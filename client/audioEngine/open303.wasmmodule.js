// Copyright 2010 The Emscripten Authors.  All rights reserved.
// Emscripten is available under two separate licenses, the MIT license and the
// University of Illinois/NCSA Open Source License.  Both these licenses can be
// found in the LICENSE file.

// The Module object: Our interface to the outside world. We import
// and export values on it. There are various ways Module can be used:
// 1. Not defined. We create it here
// 2. A function parameter, function(Module) { ..generated code.. }
// 3. pre-run appended it, var Module = {}; ..generated code..
// 4. External script tag defines var Module.
// We need to check if Module already exists (e.g. case 3 above).
// Substitution will be replaced with actual code on later stage of the build,
// this way Closure Compiler will not mangle it (e.g. case 4. above).
// Note that if you want to run closure, and also to use Module
// after the generated code, you will need to define   var Module = {};
// before the code. Then that object will be used in the code, and you
// can continue to use Module afterwards as well.
var Module = typeof Open303 !== 'undefined' ? Open303 : {};

// --pre-jses are emitted after the Module integration code, so that they can
// refer to Module (if they choose; they can also define Module)


// Sometimes an existing Module object exists with properties
// meant to overwrite the default module functionality. Here
// we collect those properties and reapply _after_ we configure
// the current environment's defaults to avoid having to be so
// defensive during initialization.
var moduleOverrides = {};
var key;
for (key in Module) {
  if (Module.hasOwnProperty(key)) {
    moduleOverrides[key] = Module[key];
  }
}

var arguments_ = [];
var thisProgram = './this.program';
var quit_ = function(status, toThrow) {
  throw toThrow;
};

// Determine the runtime environment we are in. You can customize this by
// setting the ENVIRONMENT setting at compile time (see settings.js).

var ENVIRONMENT_IS_WEB = false;
var ENVIRONMENT_IS_WORKER = false;
var ENVIRONMENT_IS_NODE = false;
var ENVIRONMENT_IS_SHELL = false;
ENVIRONMENT_IS_WEB = typeof window === 'object';
ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';
// N.b. Electron.js environment is simultaneously a NODE-environment, but
// also a web environment.
ENVIRONMENT_IS_NODE = typeof process === 'object' && typeof process.versions === 'object' && typeof process.versions.node === 'string';
ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;




// `/` should be present at the end if `scriptDirectory` is not empty
var scriptDirectory = '';
function locateFile(path) {
  if (Module['locateFile']) {
    return Module['locateFile'](path, scriptDirectory);
  }
  return scriptDirectory + path;
}

// Hooks that are implemented differently in different runtime environments.
var read_,
    readAsync,
    readBinary,
    setWindowTitle;

var nodeFS;
var nodePath;

if (ENVIRONMENT_IS_NODE) {
  if (ENVIRONMENT_IS_WORKER) {
    scriptDirectory = require('path').dirname(scriptDirectory) + '/';
  } else {
    scriptDirectory = __dirname + '/';
  }


  read_ = function shell_read(filename, binary) {
    var ret = tryParseAsDataURI(filename);
    if (ret) {
      return binary ? ret : ret.toString();
    }
    if (!nodeFS) nodeFS = require('fs');
    if (!nodePath) nodePath = require('path');
    filename = nodePath['normalize'](filename);
    return nodeFS['readFileSync'](filename, binary ? null : 'utf8');
  };

  readBinary = function readBinary(filename) {
    var ret = read_(filename, true);
    if (!ret.buffer) {
      ret = new Uint8Array(ret);
    }
    assert(ret.buffer);
    return ret;
  };




  if (process['argv'].length > 1) {
    thisProgram = process['argv'][1].replace(/\\/g, '/');
  }

  arguments_ = process['argv'].slice(2);

  if (typeof module !== 'undefined') {
    module['exports'] = Module;
  }

  process['on']('uncaughtException', function(ex) {
    // suppress ExitStatus exceptions from showing an error
    if (!(ex instanceof ExitStatus)) {
      throw ex;
    }
  });

  process['on']('unhandledRejection', abort);

  quit_ = function(status) {
    process['exit'](status);
  };

  Module['inspect'] = function () { return '[Emscripten Module object]'; };



} else
if (ENVIRONMENT_IS_SHELL) {


  if (typeof read != 'undefined') {
    read_ = function shell_read(f) {
      var data = tryParseAsDataURI(f);
      if (data) {
        return intArrayToString(data);
      }
      return read(f);
    };
  }

  readBinary = function readBinary(f) {
    var data;
    data = tryParseAsDataURI(f);
    if (data) {
      return data;
    }
    if (typeof readbuffer === 'function') {
      return new Uint8Array(readbuffer(f));
    }
    data = read(f, 'binary');
    assert(typeof data === 'object');
    return data;
  };

  if (typeof scriptArgs != 'undefined') {
    arguments_ = scriptArgs;
  } else if (typeof arguments != 'undefined') {
    arguments_ = arguments;
  }

  if (typeof quit === 'function') {
    quit_ = function(status) {
      quit(status);
    };
  }

  if (typeof print !== 'undefined') {
    // Prefer to use print/printErr where they exist, as they usually work better.
    if (typeof console === 'undefined') console = {};
    console.log = print;
    console.warn = console.error = typeof printErr !== 'undefined' ? printErr : print;
  }


} else

// Note that this includes Node.js workers when relevant (pthreads is enabled).
// Node.js workers are detected as a combination of ENVIRONMENT_IS_WORKER and
// ENVIRONMENT_IS_NODE.
if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  if (ENVIRONMENT_IS_WORKER) { // Check worker, not web, since window could be polyfilled
    scriptDirectory = self.location.href;
  } else if (document.currentScript) { // web
    scriptDirectory = document.currentScript.src;
  }
  // blob urls look like blob:http://site.com/etc/etc and we cannot infer anything from them.
  // otherwise, slice off the final part of the url to find the script directory.
  // if scriptDirectory does not contain a slash, lastIndexOf will return -1,
  // and scriptDirectory will correctly be replaced with an empty string.
  if (scriptDirectory.indexOf('blob:') !== 0) {
    scriptDirectory = scriptDirectory.substr(0, scriptDirectory.lastIndexOf('/')+1);
  } else {
    scriptDirectory = '';
  }


  // Differentiate the Web Worker from the Node Worker case, as reading must
  // be done differently.
  {


  read_ = function shell_read(url) {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, false);
      xhr.send(null);
      return xhr.responseText;
    } catch (err) {
      var data = tryParseAsDataURI(url);
      if (data) {
        return intArrayToString(data);
      }
      throw err;
    }
  };

  if (ENVIRONMENT_IS_WORKER) {
    readBinary = function readBinary(url) {
      try {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, false);
        xhr.responseType = 'arraybuffer';
        xhr.send(null);
        return new Uint8Array(xhr.response);
      } catch (err) {
        var data = tryParseAsDataURI(url);
        if (data) {
          return data;
        }
        throw err;
      }
    };
  }

  readAsync = function readAsync(url, onload, onerror) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = function xhr_onload() {
      if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) { // file URLs can return 0
        onload(xhr.response);
        return;
      }
      var data = tryParseAsDataURI(url);
      if (data) {
        onload(data.buffer);
        return;
      }
      onerror();
    };
    xhr.onerror = onerror;
    xhr.send(null);
  };




  }

  setWindowTitle = function(title) { document.title = title };
} else
{
}


// Set up the out() and err() hooks, which are how we can print to stdout or
// stderr, respectively.
var out = Module['print'] || console.log.bind(console);
var err = Module['printErr'] || console.warn.bind(console);

// Merge back in the overrides
for (key in moduleOverrides) {
  if (moduleOverrides.hasOwnProperty(key)) {
    Module[key] = moduleOverrides[key];
  }
}
// Free the object hierarchy contained in the overrides, this lets the GC
// reclaim data used e.g. in memoryInitializerRequest, which is a large typed array.
moduleOverrides = null;

// Emit code to handle expected values on the Module object. This applies Module.x
// to the proper local x. This has two benefits: first, we only emit it if it is
// expected to arrive, and second, by using a local everywhere else that can be
// minified.
if (Module['arguments']) arguments_ = Module['arguments'];
if (Module['thisProgram']) thisProgram = Module['thisProgram'];
if (Module['quit']) quit_ = Module['quit'];

// perform assertions in shell.js after we set up out() and err(), as otherwise if an assertion fails it cannot print the message

// TODO remove when SDL2 is fixed (also see above)



// Copyright 2017 The Emscripten Authors.  All rights reserved.
// Emscripten is available under two separate licenses, the MIT license and the
// University of Illinois/NCSA Open Source License.  Both these licenses can be
// found in the LICENSE file.

// {{PREAMBLE_ADDITIONS}}

var STACK_ALIGN = 16;


function dynamicAlloc(size) {
  var ret = HEAP32[DYNAMICTOP_PTR>>2];
  var end = (ret + size + 15) & -16;
  if (end > _emscripten_get_heap_size()) {
    abort();
  }
  HEAP32[DYNAMICTOP_PTR>>2] = end;
  return ret;
}

function alignMemory(size, factor) {
  if (!factor) factor = STACK_ALIGN; // stack alignment (16-byte) by default
  return Math.ceil(size / factor) * factor;
}

function getNativeTypeSize(type) {
  switch (type) {
    case 'i1': case 'i8': return 1;
    case 'i16': return 2;
    case 'i32': return 4;
    case 'i64': return 8;
    case 'float': return 4;
    case 'double': return 8;
    default: {
      if (type[type.length-1] === '*') {
        return 4; // A pointer
      } else if (type[0] === 'i') {
        var bits = parseInt(type.substr(1));
        assert(bits % 8 === 0, 'getNativeTypeSize invalid bits ' + bits + ', type ' + type);
        return bits / 8;
      } else {
        return 0;
      }
    }
  }
}

function warnOnce(text) {
  if (!warnOnce.shown) warnOnce.shown = {};
  if (!warnOnce.shown[text]) {
    warnOnce.shown[text] = 1;
    err(text);
  }
}






// Wraps a JS function as a wasm function with a given signature.
function convertJsFunctionToWasm(func, sig) {

  // If the type reflection proposal is available, use the new
  // "WebAssembly.Function" constructor.
  // Otherwise, construct a minimal wasm module importing the JS function and
  // re-exporting it.
  if (typeof WebAssembly.Function === "function") {
    var typeNames = {
      'i': 'i32',
      'j': 'i64',
      'f': 'f32',
      'd': 'f64'
    };
    var type = {
      parameters: [],
      results: sig[0] == 'v' ? [] : [typeNames[sig[0]]]
    };
    for (var i = 1; i < sig.length; ++i) {
      type.parameters.push(typeNames[sig[i]]);
    }
    return new WebAssembly.Function(type, func);
  }

  // The module is static, with the exception of the type section, which is
  // generated based on the signature passed in.
  var typeSection = [
    0x01, // id: section,
    0x00, // length: 0 (placeholder)
    0x01, // count: 1
    0x60, // form: func
  ];
  var sigRet = sig.slice(0, 1);
  var sigParam = sig.slice(1);
  var typeCodes = {
    'i': 0x7f, // i32
    'j': 0x7e, // i64
    'f': 0x7d, // f32
    'd': 0x7c, // f64
  };

  // Parameters, length + signatures
  typeSection.push(sigParam.length);
  for (var i = 0; i < sigParam.length; ++i) {
    typeSection.push(typeCodes[sigParam[i]]);
  }

  // Return values, length + signatures
  // With no multi-return in MVP, either 0 (void) or 1 (anything else)
  if (sigRet == 'v') {
    typeSection.push(0x00);
  } else {
    typeSection = typeSection.concat([0x01, typeCodes[sigRet]]);
  }

  // Write the overall length of the type section back into the section header
  // (excepting the 2 bytes for the section id and length)
  typeSection[1] = typeSection.length - 2;

  // Rest of the module is static
  var bytes = new Uint8Array([
    0x00, 0x61, 0x73, 0x6d, // magic ("\0asm")
    0x01, 0x00, 0x00, 0x00, // version: 1
  ].concat(typeSection, [
    0x02, 0x07, // import section
      // (import "e" "f" (func 0 (type 0)))
      0x01, 0x01, 0x65, 0x01, 0x66, 0x00, 0x00,
    0x07, 0x05, // export section
      // (export "f" (func 0 (type 0)))
      0x01, 0x01, 0x66, 0x00, 0x00,
  ]));

   // We can compile this wasm module synchronously because it is very small.
  // This accepts an import (at "e.f"), that it reroutes to an export (at "f")
  var module = new WebAssembly.Module(bytes);
  var instance = new WebAssembly.Instance(module, {
    'e': {
      'f': func
    }
  });
  var wrappedFunc = instance.exports['f'];
  return wrappedFunc;
}

// Add a wasm function to the table.
function addFunctionWasm(func, sig) {
  var table = wasmTable;
  var ret = table.length;

  // Grow the table
  try {
    table.grow(1);
  } catch (err) {
    if (!(err instanceof RangeError)) {
      throw err;
    }
    throw 'Unable to grow wasm table. Use a higher value for RESERVED_FUNCTION_POINTERS or set ALLOW_TABLE_GROWTH.';
  }

  // Insert new element
  try {
    // Attempting to call this with JS function will cause of table.set() to fail
    table.set(ret, func);
  } catch (err) {
    if (!(err instanceof TypeError)) {
      throw err;
    }
    assert(typeof sig !== 'undefined', 'Missing signature argument to addFunction');
    var wrapped = convertJsFunctionToWasm(func, sig);
    table.set(ret, wrapped);
  }

  return ret;
}

function removeFunctionWasm(index) {
  // TODO(sbc): Look into implementing this to allow re-using of table slots
}

// 'sig' parameter is required for the llvm backend but only when func is not
// already a WebAssembly function.
function addFunction(func, sig) {

  return addFunctionWasm(func, sig);
}

function removeFunction(index) {
  removeFunctionWasm(index);
}



var funcWrappers = {};

function getFuncWrapper(func, sig) {
  if (!func) return; // on null pointer, return undefined
  assert(sig);
  if (!funcWrappers[sig]) {
    funcWrappers[sig] = {};
  }
  var sigCache = funcWrappers[sig];
  if (!sigCache[func]) {
    // optimize away arguments usage in common cases
    if (sig.length === 1) {
      sigCache[func] = function dynCall_wrapper() {
        return dynCall(sig, func);
      };
    } else if (sig.length === 2) {
      sigCache[func] = function dynCall_wrapper(arg) {
        return dynCall(sig, func, [arg]);
      };
    } else {
      // general case
      sigCache[func] = function dynCall_wrapper() {
        return dynCall(sig, func, Array.prototype.slice.call(arguments));
      };
    }
  }
  return sigCache[func];
}


function makeBigInt(low, high, unsigned) {
  return unsigned ? ((+((low>>>0)))+((+((high>>>0)))*4294967296.0)) : ((+((low>>>0)))+((+((high|0)))*4294967296.0));
}

function dynCall(sig, ptr, args) {
  if (args && args.length) {
    return Module['dynCall_' + sig].apply(null, [ptr].concat(args));
  } else {
    return Module['dynCall_' + sig].call(null, ptr);
  }
}

var tempRet0 = 0;

var setTempRet0 = function(value) {
  tempRet0 = value;
};

var getTempRet0 = function() {
  return tempRet0;
};


var Runtime = {
};

// The address globals begin at. Very low in memory, for code size and optimization opportunities.
// Above 0 is static memory, starting with globals.
// Then the stack.
// Then 'dynamic' memory for sbrk.
var GLOBAL_BASE = 1024;




// === Preamble library stuff ===

// Documentation for the public APIs defined in this file must be updated in:
//    site/source/docs/api_reference/preamble.js.rst
// A prebuilt local version of the documentation is available at:
//    site/build/text/docs/api_reference/preamble.js.txt
// You can also build docs locally as HTML or other formats in site/
// An online HTML version (which may be of a different version of Emscripten)
//    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html


var wasmBinary;if (Module['wasmBinary']) wasmBinary = Module['wasmBinary'];
var noExitRuntime;if (Module['noExitRuntime']) noExitRuntime = Module['noExitRuntime'];


if (typeof WebAssembly !== 'object') {
  err('no native wasm support detected');
}


// In MINIMAL_RUNTIME, setValue() and getValue() are only available when building with safe heap enabled, for heap safety checking.
// In traditional runtime, setValue() and getValue() are always available (although their use is highly discouraged due to perf penalties)

/** @type {function(number, number, string, boolean=)} */
function setValue(ptr, value, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': HEAP8[((ptr)>>0)]=value; break;
      case 'i8': HEAP8[((ptr)>>0)]=value; break;
      case 'i16': HEAP16[((ptr)>>1)]=value; break;
      case 'i32': HEAP32[((ptr)>>2)]=value; break;
      case 'i64': (tempI64 = [value>>>0,(tempDouble=value,(+(Math_abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? ((Math_min((+(Math_floor((tempDouble)/4294967296.0))), 4294967295.0))|0)>>>0 : (~~((+(Math_ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)],HEAP32[((ptr)>>2)]=tempI64[0],HEAP32[(((ptr)+(4))>>2)]=tempI64[1]); break;
      case 'float': HEAPF32[((ptr)>>2)]=value; break;
      case 'double': HEAPF64[((ptr)>>3)]=value; break;
      default: abort('invalid type for setValue: ' + type);
    }
}

/** @type {function(number, string, boolean=)} */
function getValue(ptr, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': return HEAP8[((ptr)>>0)];
      case 'i8': return HEAP8[((ptr)>>0)];
      case 'i16': return HEAP16[((ptr)>>1)];
      case 'i32': return HEAP32[((ptr)>>2)];
      case 'i64': return HEAP32[((ptr)>>2)];
      case 'float': return HEAPF32[((ptr)>>2)];
      case 'double': return HEAPF64[((ptr)>>3)];
      default: abort('invalid type for getValue: ' + type);
    }
  return null;
}





// Wasm globals

var wasmMemory;

// In fastcomp asm.js, we don't need a wasm Table at all.
// In the wasm backend, we polyfill the WebAssembly object,
// so this creates a (non-native-wasm) table for us.
var wasmTable = new WebAssembly.Table({
  'initial': 54,
  'maximum': 54 + 0,
  'element': 'anyfunc'
});


//========================================
// Runtime essentials
//========================================

// whether we are quitting the application. no code should run after this.
// set in exit() and abort()
var ABORT = false;

// set by exit() and abort().  Passed to 'onExit' handler.
// NOTE: This is also used as the process return code code in shell environments
// but only when noExitRuntime is false.
var EXITSTATUS = 0;

/** @type {function(*, string=)} */
function assert(condition, text) {
  if (!condition) {
    abort('Assertion failed: ' + text);
  }
}

// Returns the C function with a specified identifier (for C++, you need to do manual name mangling)
function getCFunc(ident) {
  var func = Module['_' + ident]; // closure exported function
  assert(func, 'Cannot call unknown function ' + ident + ', make sure it is exported');
  return func;
}

// C calling interface.
function ccall(ident, returnType, argTypes, args, opts) {
  // For fast lookup of conversion functions
  var toC = {
    'string': function(str) {
      var ret = 0;
      if (str !== null && str !== undefined && str !== 0) { // null string
        // at most 4 bytes per UTF-8 code point, +1 for the trailing '\0'
        var len = (str.length << 2) + 1;
        ret = stackAlloc(len);
        stringToUTF8(str, ret, len);
      }
      return ret;
    },
    'array': function(arr) {
      var ret = stackAlloc(arr.length);
      writeArrayToMemory(arr, ret);
      return ret;
    }
  };

  function convertReturnValue(ret) {
    if (returnType === 'string') return UTF8ToString(ret);
    if (returnType === 'boolean') return Boolean(ret);
    return ret;
  }

  var func = getCFunc(ident);
  var cArgs = [];
  var stack = 0;
  if (args) {
    for (var i = 0; i < args.length; i++) {
      var converter = toC[argTypes[i]];
      if (converter) {
        if (stack === 0) stack = stackSave();
        cArgs[i] = converter(args[i]);
      } else {
        cArgs[i] = args[i];
      }
    }
  }
  var ret = func.apply(null, cArgs);

  ret = convertReturnValue(ret);
  if (stack !== 0) stackRestore(stack);
  return ret;
}

function cwrap(ident, returnType, argTypes, opts) {
  argTypes = argTypes || [];
  // When the function takes numbers and returns a number, we can just return
  // the original function
  var numericArgs = argTypes.every(function(type){ return type === 'number'});
  var numericRet = returnType !== 'string';
  if (numericRet && numericArgs && !opts) {
    return getCFunc(ident);
  }
  return function() {
    return ccall(ident, returnType, argTypes, arguments, opts);
  }
}

var ALLOC_NORMAL = 0; // Tries to use _malloc()
var ALLOC_STACK = 1; // Lives for the duration of the current function call
var ALLOC_DYNAMIC = 2; // Cannot be freed except through sbrk
var ALLOC_NONE = 3; // Do not allocate

// allocate(): This is for internal use. You can use it yourself as well, but the interface
//             is a little tricky (see docs right below). The reason is that it is optimized
//             for multiple syntaxes to save space in generated code. So you should
//             normally not use allocate(), and instead allocate memory using _malloc(),
//             initialize it with setValue(), and so forth.
// @slab: An array of data, or a number. If a number, then the size of the block to allocate,
//        in *bytes* (note that this is sometimes confusing: the next parameter does not
//        affect this!)
// @types: Either an array of types, one for each byte (or 0 if no type at that position),
//         or a single type which is used for the entire block. This only matters if there
//         is initial data - if @slab is a number, then this does not matter at all and is
//         ignored.
// @allocator: How to allocate memory, see ALLOC_*
/** @type {function((TypedArray|Array<number>|number), string, number, number=)} */
function allocate(slab, types, allocator, ptr) {
  var zeroinit, size;
  if (typeof slab === 'number') {
    zeroinit = true;
    size = slab;
  } else {
    zeroinit = false;
    size = slab.length;
  }

  var singleType = typeof types === 'string' ? types : null;

  var ret;
  if (allocator == ALLOC_NONE) {
    ret = ptr;
  } else {
    ret = [_malloc,
    stackAlloc,
    dynamicAlloc][allocator](Math.max(size, singleType ? 1 : types.length));
  }

  if (zeroinit) {
    var stop;
    ptr = ret;
    assert((ret & 3) == 0);
    stop = ret + (size & ~3);
    for (; ptr < stop; ptr += 4) {
      HEAP32[((ptr)>>2)]=0;
    }
    stop = ret + size;
    while (ptr < stop) {
      HEAP8[((ptr++)>>0)]=0;
    }
    return ret;
  }

  if (singleType === 'i8') {
    if (slab.subarray || slab.slice) {
      HEAPU8.set(/** @type {!Uint8Array} */ (slab), ret);
    } else {
      HEAPU8.set(new Uint8Array(slab), ret);
    }
    return ret;
  }

  var i = 0, type, typeSize, previousType;
  while (i < size) {
    var curr = slab[i];

    type = singleType || types[i];
    if (type === 0) {
      i++;
      continue;
    }

    if (type == 'i64') type = 'i32'; // special case: we have one i32 here, and one i32 later

    setValue(ret+i, curr, type);

    // no need to look up size unless type changes, so cache it
    if (previousType !== type) {
      typeSize = getNativeTypeSize(type);
      previousType = type;
    }
    i += typeSize;
  }

  return ret;
}

// Allocate memory during any stage of startup - static memory early on, dynamic memory later, malloc when ready
function getMemory(size) {
  if (!runtimeInitialized) return dynamicAlloc(size);
  return _malloc(size);
}


// runtime_strings.js: Strings related runtime functions that are part of both MINIMAL_RUNTIME and regular runtime.

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the given array that contains uint8 values, returns
// a copy of that string as a Javascript String object.

var UTF8Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf8') : undefined;

/**
 * @param {number} idx
 * @param {number=} maxBytesToRead
 * @return {string}
 */
function UTF8ArrayToString(u8Array, idx, maxBytesToRead) {
  var endIdx = idx + maxBytesToRead;
  var endPtr = idx;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  // (As a tiny code save trick, compare endPtr against endIdx using a negation, so that undefined means Infinity)
  while (u8Array[endPtr] && !(endPtr >= endIdx)) ++endPtr;

  if (endPtr - idx > 16 && u8Array.subarray && UTF8Decoder) {
    return UTF8Decoder.decode(u8Array.subarray(idx, endPtr));
  } else {
    var str = '';
    // If building with TextDecoder, we have already computed the string length above, so test loop end condition against that
    while (idx < endPtr) {
      // For UTF8 byte structure, see:
      // http://en.wikipedia.org/wiki/UTF-8#Description
      // https://www.ietf.org/rfc/rfc2279.txt
      // https://tools.ietf.org/html/rfc3629
      var u0 = u8Array[idx++];
      if (!(u0 & 0x80)) { str += String.fromCharCode(u0); continue; }
      var u1 = u8Array[idx++] & 63;
      if ((u0 & 0xE0) == 0xC0) { str += String.fromCharCode(((u0 & 31) << 6) | u1); continue; }
      var u2 = u8Array[idx++] & 63;
      if ((u0 & 0xF0) == 0xE0) {
        u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
      } else {
        u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | (u8Array[idx++] & 63);
      }

      if (u0 < 0x10000) {
        str += String.fromCharCode(u0);
      } else {
        var ch = u0 - 0x10000;
        str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
      }
    }
  }
  return str;
}

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the emscripten HEAP, returns a
// copy of that string as a Javascript String object.
// maxBytesToRead: an optional length that specifies the maximum number of bytes to read. You can omit
//                 this parameter to scan the string until the first \0 byte. If maxBytesToRead is
//                 passed, and the string at [ptr, ptr+maxBytesToReadr[ contains a null byte in the
//                 middle, then the string will cut short at that byte index (i.e. maxBytesToRead will
//                 not produce a string of exact length [ptr, ptr+maxBytesToRead[)
//                 N.B. mixing frequent uses of UTF8ToString() with and without maxBytesToRead may
//                 throw JS JIT optimizations off, so it is worth to consider consistently using one
//                 style or the other.
/**
 * @param {number} ptr
 * @param {number=} maxBytesToRead
 * @return {string}
 */
function UTF8ToString(ptr, maxBytesToRead) {
  return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : '';
}

// Copies the given Javascript String object 'str' to the given byte array at address 'outIdx',
// encoded in UTF8 form and null-terminated. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outU8Array: the array to copy to. Each index in this array is assumed to be one 8-byte element.
//   outIdx: The starting offset in the array to begin the copying.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array.
//                    This count should include the null terminator,
//                    i.e. if maxBytesToWrite=1, only the null terminator will be written and nothing else.
//                    maxBytesToWrite=0 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
  if (!(maxBytesToWrite > 0)) // Parameter maxBytesToWrite is not optional. Negative values, 0, null, undefined and false each don't write out any bytes.
    return 0;

  var startIdx = outIdx;
  var endIdx = outIdx + maxBytesToWrite - 1; // -1 for string null terminator.
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) {
      var u1 = str.charCodeAt(++i);
      u = 0x10000 + ((u & 0x3FF) << 10) | (u1 & 0x3FF);
    }
    if (u <= 0x7F) {
      if (outIdx >= endIdx) break;
      outU8Array[outIdx++] = u;
    } else if (u <= 0x7FF) {
      if (outIdx + 1 >= endIdx) break;
      outU8Array[outIdx++] = 0xC0 | (u >> 6);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0xFFFF) {
      if (outIdx + 2 >= endIdx) break;
      outU8Array[outIdx++] = 0xE0 | (u >> 12);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else {
      if (outIdx + 3 >= endIdx) break;
      outU8Array[outIdx++] = 0xF0 | (u >> 18);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    }
  }
  // Null-terminate the pointer to the buffer.
  outU8Array[outIdx] = 0;
  return outIdx - startIdx;
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF8 form. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8(str, outPtr, maxBytesToWrite) {
  return stringToUTF8Array(str, HEAPU8,outPtr, maxBytesToWrite);
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF8 byte array, EXCLUDING the null terminator byte.
function lengthBytesUTF8(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) ++len;
    else if (u <= 0x7FF) len += 2;
    else if (u <= 0xFFFF) len += 3;
    else len += 4;
  }
  return len;
}



// runtime_strings_extra.js: Strings related runtime functions that are available only in regular runtime.

// Given a pointer 'ptr' to a null-terminated ASCII-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function AsciiToString(ptr) {
  var str = '';
  while (1) {
    var ch = HEAPU8[((ptr++)>>0)];
    if (!ch) return str;
    str += String.fromCharCode(ch);
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in ASCII form. The copy will require at most str.length+1 bytes of space in the HEAP.

function stringToAscii(str, outPtr) {
  return writeAsciiToMemory(str, outPtr, false);
}

// Given a pointer 'ptr' to a null-terminated UTF16LE-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

var UTF16Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-16le') : undefined;

function UTF16ToString(ptr) {
  var endPtr = ptr;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  var idx = endPtr >> 1;
  while (HEAP16[idx]) ++idx;
  endPtr = idx << 1;

  if (endPtr - ptr > 32 && UTF16Decoder) {
    return UTF16Decoder.decode(HEAPU8.subarray(ptr, endPtr));
  } else {
    var i = 0;

    var str = '';
    while (1) {
      var codeUnit = HEAP16[(((ptr)+(i*2))>>1)];
      if (codeUnit == 0) return str;
      ++i;
      // fromCharCode constructs a character from a UTF-16 code unit, so we can pass the UTF16 string right through.
      str += String.fromCharCode(codeUnit);
    }
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF16 form. The copy will require at most str.length*4+2 bytes of space in the HEAP.
// Use the function lengthBytesUTF16() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=2, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<2 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF16(str, outPtr, maxBytesToWrite) {
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 2) return 0;
  maxBytesToWrite -= 2; // Null terminator.
  var startPtr = outPtr;
  var numCharsToWrite = (maxBytesToWrite < str.length*2) ? (maxBytesToWrite / 2) : str.length;
  for (var i = 0; i < numCharsToWrite; ++i) {
    // charCodeAt returns a UTF-16 encoded code unit, so it can be directly written to the HEAP.
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    HEAP16[((outPtr)>>1)]=codeUnit;
    outPtr += 2;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP16[((outPtr)>>1)]=0;
  return outPtr - startPtr;
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF16(str) {
  return str.length*2;
}

function UTF32ToString(ptr) {
  var i = 0;

  var str = '';
  while (1) {
    var utf32 = HEAP32[(((ptr)+(i*4))>>2)];
    if (utf32 == 0)
      return str;
    ++i;
    // Gotcha: fromCharCode constructs a character from a UTF-16 encoded code (pair), not from a Unicode code point! So encode the code point to UTF-16 for constructing.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    if (utf32 >= 0x10000) {
      var ch = utf32 - 0x10000;
      str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
    } else {
      str += String.fromCharCode(utf32);
    }
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF32 form. The copy will require at most str.length*4+4 bytes of space in the HEAP.
// Use the function lengthBytesUTF32() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=4, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<4 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF32(str, outPtr, maxBytesToWrite) {
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 4) return 0;
  var startPtr = outPtr;
  var endPtr = startPtr + maxBytesToWrite - 4;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) {
      var trailSurrogate = str.charCodeAt(++i);
      codeUnit = 0x10000 + ((codeUnit & 0x3FF) << 10) | (trailSurrogate & 0x3FF);
    }
    HEAP32[((outPtr)>>2)]=codeUnit;
    outPtr += 4;
    if (outPtr + 4 > endPtr) break;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP32[((outPtr)>>2)]=0;
  return outPtr - startPtr;
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF32(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i);
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) ++i; // possibly a lead surrogate, so skip over the tail surrogate.
    len += 4;
  }

  return len;
}

// Allocate heap space for a JS string, and write it there.
// It is the responsibility of the caller to free() that memory.
function allocateUTF8(str) {
  var size = lengthBytesUTF8(str) + 1;
  var ret = _malloc(size);
  if (ret) stringToUTF8Array(str, HEAP8, ret, size);
  return ret;
}

// Allocate stack space for a JS string, and write it there.
function allocateUTF8OnStack(str) {
  var size = lengthBytesUTF8(str) + 1;
  var ret = stackAlloc(size);
  stringToUTF8Array(str, HEAP8, ret, size);
  return ret;
}

// Deprecated: This function should not be called because it is unsafe and does not provide
// a maximum length limit of how many bytes it is allowed to write. Prefer calling the
// function stringToUTF8Array() instead, which takes in a maximum length that can be used
// to be secure from out of bounds writes.
/** @deprecated */
function writeStringToMemory(string, buffer, dontAddNull) {
  warnOnce('writeStringToMemory is deprecated and should not be called! Use stringToUTF8() instead!');

  var /** @type {number} */ lastChar, /** @type {number} */ end;
  if (dontAddNull) {
    // stringToUTF8Array always appends null. If we don't want to do that, remember the
    // character that existed at the location where the null will be placed, and restore
    // that after the write (below).
    end = buffer + lengthBytesUTF8(string);
    lastChar = HEAP8[end];
  }
  stringToUTF8(string, buffer, Infinity);
  if (dontAddNull) HEAP8[end] = lastChar; // Restore the value under the null character.
}

function writeArrayToMemory(array, buffer) {
  HEAP8.set(array, buffer);
}

function writeAsciiToMemory(str, buffer, dontAddNull) {
  for (var i = 0; i < str.length; ++i) {
    HEAP8[((buffer++)>>0)]=str.charCodeAt(i);
  }
  // Null-terminate the pointer to the HEAP.
  if (!dontAddNull) HEAP8[((buffer)>>0)]=0;
}



// Memory management

var PAGE_SIZE = 16384;
var WASM_PAGE_SIZE = 65536;
var ASMJS_PAGE_SIZE = 16777216;

function alignUp(x, multiple) {
  if (x % multiple > 0) {
    x += multiple - (x % multiple);
  }
  return x;
}

var HEAP,
/** @type {ArrayBuffer} */
  buffer,
/** @type {Int8Array} */
  HEAP8,
/** @type {Uint8Array} */
  HEAPU8,
/** @type {Int16Array} */
  HEAP16,
/** @type {Uint16Array} */
  HEAPU16,
/** @type {Int32Array} */
  HEAP32,
/** @type {Uint32Array} */
  HEAPU32,
/** @type {Float32Array} */
  HEAPF32,
/** @type {Float64Array} */
  HEAPF64;

function updateGlobalBufferAndViews(buf) {
  buffer = buf;
  Module['HEAP8'] = HEAP8 = new Int8Array(buf);
  Module['HEAP16'] = HEAP16 = new Int16Array(buf);
  Module['HEAP32'] = HEAP32 = new Int32Array(buf);
  Module['HEAPU8'] = HEAPU8 = new Uint8Array(buf);
  Module['HEAPU16'] = HEAPU16 = new Uint16Array(buf);
  Module['HEAPU32'] = HEAPU32 = new Uint32Array(buf);
  Module['HEAPF32'] = HEAPF32 = new Float32Array(buf);
  Module['HEAPF64'] = HEAPF64 = new Float64Array(buf);
}

var STATIC_BASE = 1024,
    STACK_BASE = 5271136,
    STACKTOP = STACK_BASE,
    STACK_MAX = 28256,
    DYNAMIC_BASE = 5271136,
    DYNAMICTOP_PTR = 28096;




var TOTAL_STACK = 5242880;

var INITIAL_TOTAL_MEMORY = Module['TOTAL_MEMORY'] || 16777216;







// In standalone mode, the wasm creates the memory, and the user can't provide it.
// In non-standalone/normal mode, we create the memory here.

// Create the main memory. (Note: this isn't used in STANDALONE_WASM mode since the wasm
// memory is created in the wasm, not in JS.)

  if (Module['wasmMemory']) {
    wasmMemory = Module['wasmMemory'];
  } else
  {
    wasmMemory = new WebAssembly.Memory({
      'initial': INITIAL_TOTAL_MEMORY / WASM_PAGE_SIZE
    });
  }


if (wasmMemory) {
  buffer = wasmMemory.buffer;
}

// If the user provides an incorrect length, just use that length instead rather than providing the user to
// specifically provide the memory length with Module['TOTAL_MEMORY'].
INITIAL_TOTAL_MEMORY = buffer.byteLength;
updateGlobalBufferAndViews(buffer);

HEAP32[DYNAMICTOP_PTR>>2] = DYNAMIC_BASE;










function callRuntimeCallbacks(callbacks) {
  while(callbacks.length > 0) {
    var callback = callbacks.shift();
    if (typeof callback == 'function') {
      callback();
      continue;
    }
    var func = callback.func;
    if (typeof func === 'number') {
      if (callback.arg === undefined) {
        Module['dynCall_v'](func);
      } else {
        Module['dynCall_vi'](func, callback.arg);
      }
    } else {
      func(callback.arg === undefined ? null : callback.arg);
    }
  }
}

var __ATPRERUN__  = []; // functions called before the runtime is initialized
var __ATINIT__    = []; // functions called during startup
var __ATMAIN__    = []; // functions called when main() is to be run
var __ATEXIT__    = []; // functions called during shutdown
var __ATPOSTRUN__ = []; // functions called after the main() is called

var runtimeInitialized = false;
var runtimeExited = false;


function preRun() {

  if (Module['preRun']) {
    if (typeof Module['preRun'] == 'function') Module['preRun'] = [Module['preRun']];
    while (Module['preRun'].length) {
      addOnPreRun(Module['preRun'].shift());
    }
  }

  callRuntimeCallbacks(__ATPRERUN__);
}

function initRuntime() {
  runtimeInitialized = true;
  
  callRuntimeCallbacks(__ATINIT__);
}

function preMain() {
  
  callRuntimeCallbacks(__ATMAIN__);
}

function exitRuntime() {
  runtimeExited = true;
}

function postRun() {

  if (Module['postRun']) {
    if (typeof Module['postRun'] == 'function') Module['postRun'] = [Module['postRun']];
    while (Module['postRun'].length) {
      addOnPostRun(Module['postRun'].shift());
    }
  }

  callRuntimeCallbacks(__ATPOSTRUN__);
}

function addOnPreRun(cb) {
  __ATPRERUN__.unshift(cb);
}

function addOnInit(cb) {
  __ATINIT__.unshift(cb);
}

function addOnPreMain(cb) {
  __ATMAIN__.unshift(cb);
}

function addOnExit(cb) {
}

function addOnPostRun(cb) {
  __ATPOSTRUN__.unshift(cb);
}

function unSign(value, bits, ignore) {
  if (value >= 0) {
    return value;
  }
  return bits <= 32 ? 2*Math.abs(1 << (bits-1)) + value // Need some trickery, since if bits == 32, we are right at the limit of the bits JS uses in bitshifts
                    : Math.pow(2, bits)         + value;
}
function reSign(value, bits, ignore) {
  if (value <= 0) {
    return value;
  }
  var half = bits <= 32 ? Math.abs(1 << (bits-1)) // abs is needed if bits == 32
                        : Math.pow(2, bits-1);
  if (value >= half && (bits <= 32 || value > half)) { // for huge values, we can hit the precision limit and always get true here. so don't do that
                                                       // but, in general there is no perfect solution here. With 64-bit ints, we get rounding and errors
                                                       // TODO: In i64 mode 1, resign the two parts separately and safely
    value = -2*half + value; // Cannot bitshift half, as it may be at the limit of the bits JS uses in bitshifts
  }
  return value;
}


// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/imul

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/fround

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/clz32

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/trunc


var Math_abs = Math.abs;
var Math_cos = Math.cos;
var Math_sin = Math.sin;
var Math_tan = Math.tan;
var Math_acos = Math.acos;
var Math_asin = Math.asin;
var Math_atan = Math.atan;
var Math_atan2 = Math.atan2;
var Math_exp = Math.exp;
var Math_log = Math.log;
var Math_sqrt = Math.sqrt;
var Math_ceil = Math.ceil;
var Math_floor = Math.floor;
var Math_pow = Math.pow;
var Math_imul = Math.imul;
var Math_fround = Math.fround;
var Math_round = Math.round;
var Math_min = Math.min;
var Math_max = Math.max;
var Math_clz32 = Math.clz32;
var Math_trunc = Math.trunc;



// A counter of dependencies for calling run(). If we need to
// do asynchronous work before running, increment this and
// decrement it. Incrementing must happen in a place like
// Module.preRun (used by emcc to add file preloading).
// Note that you can add dependencies in preRun, even though
// it happens right before run - run will be postponed until
// the dependencies are met.
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null; // overridden to take different actions when all run dependencies are fulfilled

function getUniqueRunDependency(id) {
  return id;
}

function addRunDependency(id) {
  runDependencies++;

  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }

}

function removeRunDependency(id) {
  runDependencies--;

  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }

  if (runDependencies == 0) {
    if (runDependencyWatcher !== null) {
      clearInterval(runDependencyWatcher);
      runDependencyWatcher = null;
    }
    if (dependenciesFulfilled) {
      var callback = dependenciesFulfilled;
      dependenciesFulfilled = null;
      callback(); // can add another dependenciesFulfilled
    }
  }
}

Module["preloadedImages"] = {}; // maps url to image data
Module["preloadedAudios"] = {}; // maps url to audio data


function abort(what) {
  if (Module['onAbort']) {
    Module['onAbort'](what);
  }

  what += '';
  out(what);
  err(what);

  ABORT = true;
  EXITSTATUS = 1;

  what = 'abort(' + what + '). Build with -s ASSERTIONS=1 for more info.';

  // Throw a wasm runtime error, because a JS error might be seen as a foreign
  // exception, which means we'd run destructors on it. We need the error to
  // simply make the program stop.
  throw new WebAssembly.RuntimeError(what);
}


var memoryInitializer = null;





// Copyright 2017 The Emscripten Authors.  All rights reserved.
// Emscripten is available under two separate licenses, the MIT license and the
// University of Illinois/NCSA Open Source License.  Both these licenses can be
// found in the LICENSE file.

// Prefix of data URIs emitted by SINGLE_FILE and related options.
var dataURIPrefix = 'data:application/octet-stream;base64,';

// Indicates whether filename is a base64 data URI.
function isDataURI(filename) {
  return String.prototype.startsWith ?
      filename.startsWith(dataURIPrefix) :
      filename.indexOf(dataURIPrefix) === 0;
}




var wasmBinaryFile = 'data:application/octet-stream;base64,AGFzbQEAAAABvAEcYAJ/fABgAX8AYAF/AX9gAABgAn9/AGADf39/AGAEf39/fwBgBX9/f39/AGAGf39/f39/AGADf39/AX9gAXwBfGACf38Bf2AAAX9gAX8BfGADf398AGACf38BfGAEf39/fwF/YAJ8fAF8YAN8fH8BfGAHf39/f39/fwBgCH9/f39/f39/AGANf39/f39/f39/f39/fwBgBH9/f3wAYAN8fHwAYAJ8fwF/YAN/f38BfGACf3wBfGACfH8BfALIAxADZW52Fl9lbWJpbmRfcmVnaXN0ZXJfY2xhc3MAFQNlbnYiX2VtYmluZF9yZWdpc3Rlcl9jbGFzc19jb25zdHJ1Y3RvcgAIA2Vudh9fZW1iaW5kX3JlZ2lzdGVyX2NsYXNzX2Z1bmN0aW9uABQDZW52BWFib3J0AAMDZW52FV9lbWJpbmRfcmVnaXN0ZXJfdm9pZAAEA2VudhVfZW1iaW5kX3JlZ2lzdGVyX2Jvb2wABwNlbnYbX2VtYmluZF9yZWdpc3Rlcl9zdGRfc3RyaW5nAAQDZW52HF9lbWJpbmRfcmVnaXN0ZXJfc3RkX3dzdHJpbmcABQNlbnYWX2VtYmluZF9yZWdpc3Rlcl9lbXZhbAAEA2VudhhfZW1iaW5kX3JlZ2lzdGVyX2ludGVnZXIABwNlbnYWX2VtYmluZF9yZWdpc3Rlcl9mbG9hdAAFA2VudhxfZW1iaW5kX3JlZ2lzdGVyX21lbW9yeV92aWV3AAUDZW52FmVtc2NyaXB0ZW5fcmVzaXplX2hlYXAAAgNlbnYVZW1zY3JpcHRlbl9tZW1jcHlfYmlnAAkDZW52Bm1lbW9yeQIAgAIDZW52BXRhYmxlAXAANgO2AbQBAwMCAQIMDQ8OAAAAAAAAAAAAAAAAAAYCGgEBAgEAAAABAgACAQAEAAAAAQUFBQUGBwIEAQQEAAAXCQIBAQQBAQECAQAEAAIAAAIAAAAAAAUEBQUEAQAKCg0KERAYEgoKEgoKChECDAsCAQEJCQkLBQYGBgYLCQsLBgcIBwcHCAgIAgICAwMDAwMDAwMDAwMDAwEBAQEBAQMDAwMCAgECChsJBAkEDAIBAgsEDxkOFgYHEBMIBhACfwFBwNvBAgt/AEG42wELB4sDGBFfX3dhc21fY2FsbF9jdG9ycwAOEF9fZXJybm9fbG9jYXRp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77+goiAMROOsHvz//+8/oqBEfwr+////77+gIg05AwAgACANRAAAAAAAAPA/oDkD+IcaIABBmIkaaigCAEEPRw0AIAAgDETNO39mnqDmP6JEGC1EVPshGUCjIgxEQLEECNXEGECiRO2kgd9h1T0/oCAMIAyiRHVbIhecqRFAoiAMRBXI7Cx6tyhAokQAAAAAAADwP6CgozkD+IcaIAAgDyAMIAwgDCAMIAwgDEQDCYofsx68QKCiRD7o2azKzbbAoKJERIZVvJHHfcCgokQH6/8cpjeDQKCiRATKplzhu2pAoKJEpoEf1bD/MECgIgyiOQPQiBogACAPRAAAAAAAAPA/oCAMRB4eHh4eHq4/okQAAAAAAADwv6AgD6JEAAAAAAAA8D+gojkD2IgaCyAAQfiHGmohBSAAQaiLGmoCfCAAQeiKGmorAwAiDCAAQdCKGmorAwBlQQFzRQRAIAAgDCAAQfiKGmorAwCgOQPoihogAEGQixpqKwMAIABBiIsaaisDACAAQfiJGmorAwCiIABBqIsaaisDACIMoaIgDKAMAQsgDCAAQdiKGmorAwBlQQFzRQRAIAAgDCAAQfiKGmorAwCgOQPoihogAEGYixpqKwMAIABBgIoaaisDACAAQaiLGmorAwAiDKGiIAygDAELIABBqIsaaisDACENIABBuYsaai0AAARAIABBmIsaaisDACAAQYCKGmorAwAgDaGiIA2gDAELIAAgDCAAQfiKGmorAwCgOQPoihogAEGgixpqKwMAIABBiIoaaisDACANoaIgDaALIgw5AwAgAEHAjBpqIgErAwAhDSABIABBuIwaaiIBKwMAIg85AwAgAEHQjBpqIgIrAwAhESACIABByIwaaiICKwMAIhI5AwAgASAQRAAAAAAAABBAokTNzMzMzMzcP6AgDqIgDKAgDCAAQbmLGmotAAAbIgw5AwAgAiARIABBsIwaaisDAKIgEiAAQaiMGmorAwCiIA0gAEGgjBpqKwMAoiAAKwOQjBogDKIgDyAAQZiMGmorAwCioKCgoEQAAAAAAAAQOKAiGTkDACAAQaiQGmohByAAQaCQGmohBkEBIQEDQEQAAAAAAAAAACEMAkAgACgC8IcaIghFDQAgACgC9IcaIgNFDQAgACkDyIcaIgtCNIinQf8PcSICQYN4aiEEIAArA7iHGiIMIAAr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cQ0AIAFBfyABIAJGG0F/IAUbIQELIAMgATYCACAAIAhBAWogBygCwAFvNgKcGgsgAwuIBAEFfCAAKAKgAUEPRgRAIAArA6gBIQQgACAAKwNYRM07f2aeoPY/IAArAygiA0TNO39mnqD2v6UgA0TNO39mnqD2P2QbIgIgAkRVVVVVVVXFv6KiIAKiIAKgoiICOQOoASAAIAArA8gBIAArA7ABoiAAKwO4ASACoiAEIAArA8ABoqCgRAAAAAAAABA4oCIFOQOwASAAIAArAwAiAiACoCAAKwMYIgQgASAFoSAAKwMQIgGhoKIgAaAiBTkDECAAIAQgAiAAKwMgIgEgBSAEIASgoaCioCIEOQMYIAAgASACIAMgBCABIAGgoaCioCIBOQMgIAAgAyACIAEgAyADoKGioCIBOQMoIAArA2AiAyADoCABog8LIAArA6gBIQMgACAAKwNYIAArAygiBqIiAjkDqAEgACAAKwPIASAAKwOwAaIgACsDuAEgAqIgAyAAKwPAAaKgoEQAAAAAAAAQOKAiAjkDsAEgACAAKwMIIgMgACsDaEQAAAAAAADAP6IgAaIgAqEiBSAAKwMQoaIgBaAiATkDECAAIAMgASAAKwMYoaIgAaAiAjkDGCAAIAMgAiAAKwMgoaIgAqAiBDkDICAAIAMgBCAGoaIgBKAiAzkDKCAAKwNQIAOiIAArA0ggBKIgACsDQCACoiAAKwMwIAWiIAEgACsDOKKgoKCgRAAAAAAAACBAoguEAgAgAEIANwIAIABCADcCDCAAQgA3AhggAEIANwIkIABCADcCMCAAQgA3AjwgAEIANwJIIABCADcCVCAAQgA3AmAgAEEANgAHIABBADYAEyAAQQA2AB8gAEEANgArIABBADYANyAAQQA2AEMgAEEANgBPIABBADYAWyAAQQA2AGcgAEEANgBzIABCADcCbCAAQQA2AH8gAEIANwJ4IABBADYAiwEgAEIANwKEASAAQQA2AJcBIABCADcCkAEgAEEANgCjASAAQgA3ApwBIABBADYArwEgAEIANwKoASAAQQA2ALsBIABCADcCtAEgAEKAgICAgICA8D83A8gBIABBEDYCwAEL7gEAIAAQJyAAQdABahAnIABBoANqECcgAEHwBGoQJyAAQcAGahAnIABBkAhqECcgAEHgCWoQJyAAQbALahAnIABB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NwMAIABBAWoiACADRw0ACwsgAiAHIAhqIARqIgRBA3RqIgApAwAhDiACIAQgB2pBA3RqIgQiCEEIaikDACEPIAAgBCkDADcDACAAKQMIIRAgACAPNwMIIAggEDcDCCAEIA43AwAgA0EBaiIDIApHDQALCwvoAwIIfwx8QQIhAwJAIABBCUgNACAAIAEgAhA8QQghBSAAQSFIBEBBCCEDDAELQSAhBANAIAAgBSABIAIQPSAEIgMhBSADQQJ0IgQgAEgNAAsLAkAgACADQQJ0RwRAQQAhACADQQBMDQEDQCABIAAgA2pBA3RqIgYiBUEIaisDACEMIAEgAEEDdCICQQhyaiIEKwMAIQsgASACaiICIAIrAwAiDSAGKwMAIg6gOQMAIAQgCyAFKwMIoDkDACAFIAsgDKE5AwggBiANIA6hOQMAIABBAmoiACADSA0ACwwBCyADQQFIDQBBACEAA0AgASAAIANqIgQgA2oiAkEDdGoiByIKQQhqKwMAIQ8gASACIANqQQN0aiIIIgZBCGorAwAhECABIABBA3QiAkEIcmoiBSsDACERIAEgBEEDdGoiCSIEQQhqKwMAIRIgASACaiICIAIrAwAiEyAJKwMAIhSgIgsgBysDACIVIAgrAwAiFqAiDKA5AwAgBSARIBKgIg0gDyAQoCIOoDkDACAKIA0gDqE5AwggByALIAyhOQMAIAQgESASoSILIBUgFqEiDKA5AwggCSATIBShIg0gDyAQoSIOoTkDACAGIAsgDKE5AwggCCANIA6gOQMAIABBAmoiACADSA0ACwsL6gMCCH8MfEECIQMCQCAAQQlIDQAgACABIAIQPEEIIQUgAEEhSARAQQghAwwBC0EgIQQDQCAAIAUgASACED0gBCIDIQUgA0ECdCIEIABIDQALCwJAIAAgA0ECdEcEQEEAIQAgA0EATA0BA0AgASAAIANqQQN0aiIGIgVBCGorAwAhDCABIABBA3QiAkEIcmoiBCsDACELIAEgAmoiAiACKwMAIg0gBisDACIOoDkDACAEIAuaIAUrAwihOQMAIAUgDCALoTkDCCAGIA0gDqE5AwAgAEECaiIAIANIDQALDAELIANBAUgNAEEAIQADQCABIAAgA2oiBCADaiICQQN0aiIHIgpBCGorAwAhDyABIAIgA2pBA3RqIggiBkEIaisDACEQIAEg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NwMAIAIhDSAAQcCNGmoQTyEGIABBkI4aahBPIQcgAEHgjhpqEE8hCCAAQbCPGmoQMSECIABBoJAaakHgABCwASAAQYCRGmoQKCAAQYytGmpBADYCACAAQYitGmogAEGErRpqIg42AgAgACAONgKErRogAEGAAjsBgK0aIABC/////w83A/isGiAAQoCAgICAgID4PzcD4KwaIABCADcD2KwaIABCgICAgICAwKTAADcD0KwaIABCgICAgICAgPg/NwPIrBogAEKAgICAgIDAtMAANwPArBogAEKAgICAgIDQx8AANwO4rBogAEKAgICAgICAhMAANwOwrBogAEKAgICAgICAhMAANwOorBogAELVqtWq1arV8j83A5CsGiAAQoCAgICAgNDHwAA3A4CsGiAAQoCAgICAgICnwAA3A/irGiAAQgA3A/CrGiAAQoCAgICAgICUwAA3A+irGiAAQoCAgICAgICUQDcD4KsaIABCgICAgICQ4vLAADcD2KsaIABCgICAgICA4L3AADcD0KsaIABCgICAgICAgPg/NwPIqxogAEKAgICAgIDgvcAANwPAqxogAELEybTUscvA/j83A6CsGiAAQoCAgICAgMCcwAA3A4isGiAAQprnt/2H0qbqPzcDmKwaIAMgBTYCQCADKAJAIgUEQCAFQQYQSwsgAyAJNgJEIAMoAkQiAwRAIANBBRBLCyAKEDggBBAqIAREAAAAAAA4k0AQKyAAQYCKGmpCADcDACAERAAAAAAAAOA/ECwgBBAuIAtEAAAAAAAATkAQRSABQQIQNCABRH5YxyQYFQjAOQNQIAEQMiABRAAAAAAAAGlAEDUgDEQAAAAAAAAAABBFIA1EAAAAAAAALkAQRSAGQQIQUiAHQQIQUiAIQQUQUiACQQYQNCAAIAArA9irGhBVIABB8IcaaigCABBOIABB9IcaaigCABBOIAZEke18PzU+RkAQUyAHRJhuEoPAKjhAEFMgCERqvHSTGAQsQBBTIAJEG55eKcsQHkAQNSACRM3MzMzMzBJAOQNYIAIQMiAAQaCJGmpEAAAAAADAYkAQUyAAC74BAgF/AXwgAEHAixpqIAEQNiAAQfCJGmogARAtIABB8IsaaiABtrsiAxBEIABBkIwaaiADEDMgAEGAjRpqIAMQRCAAQaCNGmogAxBEIABBgJEaaiECIAFE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AgQgBSgCBCAANgIAIAJBADYCCCABIAJGDQEDQCABKAIEIQAgARCrASAAIgEgAkcNAAsMAQsDQAJ/IAMoAgQiASADKAIIIAdHDQAaQQAhBQJ/IAAgACABRg0AGgJAIAEoAgggB0YEQANAIAAgASgCBCIBRg0CIAcgASgCCEYNAAsLQQEhBSABDAELIAALIgggA0cEQCADKAIAIgQgCCgCACIGKAIENgIEIAYoAgQgBDYCACACKAIAIgQgAzYCBCADIAQ2AgAgAiAGNgIAIAYgAjYCBAsgASAFRQ0AGiAIKAIECyIDIABHDQALCyACQRBqJAAL4wQCAX8BfCAALQCBrRoEQCAAQbCHGmoiAyADKQMoNwMIIABB+IcaaiIDQgA3A6gBIANCADcDsAEgA0IANwMoIANCADcDICADQgA3AxggA0IANwMQIABBwI0aaiIDQgA3AwAgA0IANwMIIABBkI4aaiIDQgA3AwAgA0IANwMIIABB4I4aaiIDQgA3AwAgA0IANwMIIABBsI8aaiIDQgA3AyggA0FAa0IANwMAIANCADcDOCADQgA3AzAgAEGgkBpqQeAAELABIABBkIwaaiIDQgA3AyggA0FAa0IANwMAIANCADcDOCADQgA3AzALAn8gAgRAIAAgACkD8KsaNwPYrBogAEHAixpqIAArA8CsGhA3IABB2IsaaiICKwMAIABBmI0aaisDACAAKwPYqxoQRiAAQoCAgICAgID4PzcD6KwaIAIrAwAgAEG4jRpqKwMAIAArA9irGhBGIABCgICAgICAgPg/NwPwrBogAEHQrBpqDAELIABCADcD2KwaIABBwIsaaiAAKwO4rBoQNyAAQdiLGmoiAisDACAAQZiNGmorAwAgACsD2KsaEEYgAEKAgICAgICA+D83A+isGiACKwMAIABBuI0aaisDACAAKwPYqxoQRiAAQoCAgICAgID4PzcD8KwaIABByKwaagshAyAAQfCJGmoiAiADKwMAECwgACsDwKsaIQQgACABt0Tq96L+A5OtP6IQcCAERBW3MQr+BpM/oqIiBDkD0KsaIABB+IsaaiAEOQMAIABBwIsaaiIBIAEpAxA3AwggAkIANwN4IAJBgAI7AcgBIABBADoAga0aC8YCAQF8IAArA8CrGiEDIAAgAbdE6vei/gOTrT+iEHAgA0QVtzEK/gaTP6Ki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tyIHOQMAIAAgB6FEAAAAAAAAcEGiIQBBASECIAVFDQALIAQgADkDIAJAIABEAAAAAAAAAABiBEBBAiECDAELQQEhBQNAIAUiAkF/aiEFIARBEGogAkEDdGorAwBEAAAAAAAAAABhDQALCyAEQRBqIAQgA0EUdkHqd2ogAkEBahBpIQIgBCsDACEAIAZCf1cEQCABIACaOQMAIAEgBCsDCJo5AwhBACACayECDAELIAEgADkDACABIAQpAwg3AwgLIARBMGokACACC5kBAQN8IAAgAKIiAyADIAOioiADRHzVz1o62eU9okTrnCuK5uVavqCiIAMgA0R9/rFX4x3HPqJE1WHBGaABKr+gokSm+BARERGBP6CgIQUgAyAAoiEEIAJFBEAgBCADIAWiRElVVVVVVcW/oKIgAKAPCyAAIAMgAUQAAAAAAADgP6IgBSAEoqGiIAGhIARESVVVVVVVxT+ioKELygEBAn8jAEEQayIBJAACfCAAvUIgiKdB/////wdxIgJB+8Ok/wNNBEBEAAAAAAAA8D8gAkGewZryA0kNARogAEQAAAAAAAAAABBoDAELIAAgAKEgAkGAgMD/B08NABogACABEGpBA3EiAkECTQRAAkACQAJAIAJBAWsOAgECAAsgASsDACABKwMIEGgMAwsgASsDACABKwMIQQEQa5oMAgsgASsDACABKwMIEGiaDAELIAErAwAgASsDCEEBEGsLIQAgAUEQaiQAIAALzgEBAn8jAEEQayIBJAACQCAAvUIgiKdB/////wdxIgJB+8Ok/wNNBEAgAkGAgMDyA0kNASAARAAAAAAAAAAAQQAQayEADAELIAJBgIDA/wdPBEAgACAAoSEADAELIAAgARBqQQNxIgJBAk0EQAJAAkACQCACQQFrDgIBAgALIAErAwAgASsDCEEBEGshAAwDCyABKwMAIAErAwgQaCEADAILIAErAwAgASsDCEEBEGuaIQAMAQsgASsDACABKwMIEGiaIQALIAFBEGokACAAC6wDAwJ/AX4CfCAAvSIFQoCAgICA/////wCDQoGAgIDwhOXyP1QiBEUEQEQYLURU+yHpPyAAmiAAIAVCAFMiAxuhRAdcFDMmpoE8IAGaIAEgAxuhoCEAIAVCP4inIQNEAAAAAAAAAAAhAQsgACAAIAAgAKIiB6IiBkRjVVVVVVXVP6Ig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IAFB/gdqIQEMAQsgAEQAAAAAAAAQAKIhACABQYZoIAFBhmhKG0H8D2ohAQsgACABQf8Haq1CNIa/oguDBAEDfyACQYDAAE8EQCAAIAEgAhANGiAADwsgACACaiEDAkAgACABc0EDcUUEQAJAIAJBAUgEQCAAIQIMAQsgAEEDcUUEQCAAIQIMAQsgACECA0AgAiABLQAAOgAAIAFBAWohASACQQFqIgIgA08NASACQQNxDQALCwJAIANBfHEiBEHAAEkNACACIARBQGoiBUsNAANAIAIgASgCADYCACACIAEoAgQ2AgQgAiABKAIINgIIIAIgASgCDDYCDCACIAEoAhA2AhAgAiABKAIUNgIUIAIgASgCGDYCGCACIAEoAhw2AhwgAiABKAIgNgIgIAIgASgCJDYCJCACIAEoAig2AiggAiABKAIsNgIsIAIgASgCMDYCMCACIAEoAjQ2AjQgAiABKAI4NgI4IAIgASgCPDYCPCABQUBrIQEgAkFAayICIAVNDQALCyACIARPDQEDQCACIAEoAgA2AgAgAUEEaiEBIAJBBGoiAiAESQ0ACwwBCyADQQRJBEAgACECDAELIANBfGoiBCAASQRAIAAhAgwBCyAAIQIDQCACIAEtAAA6AAAgAiABLQABOgABIAIgAS0AAjoAAiACIAEtAAM6AAMgAUEEaiEBIAJBBGoiAiAETQ0ACwsgAiADSQRAA0AgAiABLQAAOgAAIAFBAWohASACQQFqIgIgA0cNAAsLIAAL1gIBAX8CQCABRQ0AIAAgAWoiAkF/akEAOgAAIABBADoAACABQQNJDQAgAkF+akEAOgAAIABBADoAASACQX1qQQA6AAAgAEEAOgACIAFBB0kNACACQXxqQQA6AAAgAEEAOgADIAFBCUkNACAAQQAgAGtBA3EiAmoiAEEANgIAIAAgASACa0F8cSICaiIBQXxqQQA2AgAgAkEJSQ0AIABBADYCCCAAQQA2AgQgAUF4akEANgIAIAFBdGpBADYCACACQRlJDQAgAEEANgIYIABBADYCFCAAQQA2AhAgAEEANgIMIAFBcGpBADYCACABQWxqQQA2AgAgAUFoakEANgIAIAFBZGpBADYCACACIABBBHFBGHIiAmsiAUEgSQ0AIAAgAmohAANAIABCADcDGCAAQgA3AxAgAEIANwMIIABCADcDACAA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EwAAYwAAANASAAA8EwAAaAAAANASAABIEwAAYQAAANASAABUEwAAcwAAANASAABgEwAAdAAAANASAABsEwAAaQAAANASAAB4EwAAagAAANASAACEEwAAbAAAANASAACQEwAAbQAAANASAACcEwAAZgAAANASAACoEwAAZAAAANASAAC0EwAAAAAAAOwRAAAhAAAAJgAAACMAAAAkAAAAJwAAACgAAAApAAAAKgAAAAAAAAA4FAAAIQAAACsAAAAjAAAAJAAAACcAAAAsAAAALQAAAC4AAABOMTBfX2N4eGFiaXYxMjBfX3NpX2NsYXNzX3R5cGVfaW5mb0UAAAAA8BMAABAUAADsEQAAAAAAAJQUAAAhAAAALwAAACMAAAAkAAAAJwAAADAAAAAxAAAAMgAAAE4xMF9fY3h4YWJpdjEyMV9fdm1pX2NsYXNzX3R5cGVfaW5mb0UAAADwEwAAbBQAAOwRAAAAAAAATBIAACEAAAAzAAAAIwAAACQAAAA0AAAAdm9pZABib29sAGNoYXIAc2lnbmVkIGNoYXIAdW5zaWduZWQgY2hhcgBzaG9ydAB1bnNpZ25lZCBzaG9ydABpbnQAdW5zaWduZWQgaW50AGxvbmcAdW5zaWduZWQgbG9uZwBmbG9hdABkb3VibGUAc3RkOjpzdHJpbmcAc3RkOjpiYXNpY19zdHJpbmc8dW5zaWduZWQgY2hhcj4Ac3RkOjp3c3RyaW5nAHN0ZDo6dTE2c3RyaW5nAHN0ZDo6dTMyc3RyaW5nAGVtc2NyaXB0ZW46OnZhbABlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxjaGFyPgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxzaWduZWQgY2hhcj4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8dW5zaWduZWQgY2hhcj4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8c2hvcnQ+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHVuc2lnbmVkIHNob3J0PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxpbnQ+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHVuc2lnbmVkIGludD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8bG9uZz4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8dW5zaWduZWQgbG9uZz4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8aW50OF90PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzx1aW50OF90PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxpbnQxNl90PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzx1aW50MTZfdD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8aW50MzJfdD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8dWludDMyX3Q+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PGZsb2F0PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxkb3VibGU+AE5TdDNfXzIxMmJhc2ljX3N0cmluZ0ljTlNfMTFjaGFyX3RyYWl0c0ljRUVOU185YWxsb2NhdG9ySWNFRUVFAE5TdDNfXzIyMV9fYmFzaWNfc3RyaW5nX2NvbW1vbklMYjFFRUUAAMgTAAARGAAATBQAANIXAAAAAAAAAQAAADgYAAAAAAAATlN0M19fMjEyYmFzaWNfc3RyaW5nSWhOU18xMWNoYXJfdHJhaXRzSWhFRU5TXzlhbGxvY2F0b3JJaEVFRUUAAEwUAABYGAAAAAAAAAEAAAA4GAAAAAAAAE5TdDNfXzIxMmJhc2ljX3N0cmluZ0l3TlNfMTFjaGFyX3RyYWl0c0l3RUVOU185YWxsb2NhdG9ySXdFRUVFAABMFAAAsBgAAAAAAAABAAAAOBgAAAAAAABOU3QzX18yMTJiYXNpY19zdHJpbmdJRHNOU18xMWNoYXJfdHJhaXRzSURzRUVOU185YWxsb2NhdG9ySURzRUVFRQAAAEwUAAAIGQAAAAAAAAEAAAA4GAAAAAAAAE5TdDNfXzIxMmJhc2ljX3N0cmluZ0lEaU5TXzExY2hhcl90cmFpdHNJRGlFRU5TXzlhbGxvY2F0b3JJRGlFRUVFAAAATBQAAGQZAAAAAAAAAQAAADgYAAAAAAAATjEwZW1zY3JpcHRlbjN2YWxFAADIEwAAwBkAAE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SWNFRQAAyBMAANwZAABOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0lhRUUAAMgTAAAEGgAATjEwZW1zY3JpcHRlbjExbWVtb3J5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c19jb25zdHJ1Y3RvcgIfX2VtYmluZF9yZWdpc3Rlcl9jbGFzc19mdW5jdGlvbgMFYWJvcnQEFV9lbWJpbmRfcmVnaXN0ZXJfdm9pZAUVX2VtYmluZF9yZWdpc3Rlcl9ib29sBhtfZW1iaW5kX3JlZ2lzdGVyX3N0ZF9zdHJpbmcHHF9lbWJpbmRfcmVnaXN0ZXJfc3RkX3dzdHJpbmcIFl9lbWJpbmRfcmVnaXN0ZXJfZW12YWwJGF9lbWJpbmRfcmVnaXN0ZXJfaW50ZWdlcgoWX2VtYmluZF9yZWdpc3Rlcl9mbG9hdAscX2VtYmluZF9yZWdpc3Rlcl9tZW1vcnlfdmlldwwWZW1zY3JpcHRlbl9yZXNpemVfaGVhcA0VZW1zY3JpcHRlbl9tZW1jcHlfYmlnDhFfX3dhc21fY2FsbF9jdG9ycw9MRW1zY3JpcHRlbkJpbmRpbmdJbml0aWFsaXplcl9PcGVuMzAzOjpFbXNjcmlwdGVuQmluZGluZ0luaXRpYWxpemVyX09wZW4zMDMoKRBQdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8cm9zaWM6Ok9wZW4zMDM+KHJvc2ljOjpPcGVuMzAzKikRSnZvaWQgZW1zY3JpcHRlbjo6aW50ZXJuYWw6OnJhd19kZXN0cnVjdG9yPHJvc2ljOjpPcGVuMzAzPihyb3NpYzo6T3BlbjMwMyopEk1lbXNjcmlwdGVuOjppbnRlcm5hbDo6SW52b2tlcjxyb3NpYzo6T3BlbjMwMyo+OjppbnZva2Uocm9zaWM6Ok9wZW4zMDMqICgqKSgpKRNEcm9zaWM6Ok9wZW4zMDMqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8cm9zaWM6Ok9wZW4zMDM+KCkUG3Jvc2ljOjpPcGVuMzAzOjpnZXRTYW1wbGUoKRWYAWVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAocm9zaWM6Ok9wZW4zMDM6OiopKCksIGRvdWJsZSwgcm9zaWM6Ok9wZW4zMDMqPjo6aW52b2tlKGRvdWJsZSAocm9zaWM6Ok9wZW4zMDM6OiogY29uc3QmKSgpLCByb3NpYzo6T3BlbjMwMyopFq4BZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAocm9zaWM6Ok9wZW4zMDM6OiopKGRvdWJsZSksIHZvaWQsIHJvc2ljOjpPcGVuMzAzKiwgZG91YmxlPjo6aW52b2tlKHZvaWQgKHJvc2ljOjpPcGVuMzAzOjoqIGNvbnN0JikoZG91YmxlKSwgcm9zaWM6Ok9wZW4zMDMqLCBkb3VibGUpFyNyb3NpYzo6T3BlbjMwMzo6c2V0V2F2ZWZvcm0oZG91YmxlKRgkcm9zaWM6Ok9wZW4zMDM6OnNldFJlc29uYW5jZShkb3VibGUpGSByb3NpYzo6T3BlbjMwMzo6c2V0RGVjYXkoZG91YmxlKRolcm9zaWM6Ok9wZW4zMDM6OnNldEFtcFN1c3RhaW4oZG91YmxlKRsscm9zaWM6Ok9wZW4zMDM6OnNldFByZUZpbHRlckhpZ2hwYXNzKGRvdWJsZSkcK3Jvc2ljOjpPcGVuMzAzOjpzZXRGZWVkYmFja0hpZ2hwYXNzKGRvdWJsZSkdLXJvc2ljOjpPcGVuMzAzOjpzZXRQb3N0RmlsdGVySGlnaHBhc3MoZG91YmxlKR4rcm9zaWM6Ok9wZW4zMDM6OnNldFNxdWFyZVBoYXNlU2hpZnQoZG91YmxlKR8ncm9zaWM6Ok9wZW4zMDM6OnNldE5vcm1hbEF0dGFjayhkb3VibGUpICdyb3NpYzo6T3BlbjMwMzo6c2V0QWNjZW50QXR0YWNrKGRvdWJsZSkhJnJvc2ljOjpPcGVuMzAzOjpzZXRBY2NlbnREZWNheShkb3VibGUpIiNyb3NpYzo6T3BlbjMwMzo6c2V0QW1wRGVjYXkoZG91YmxlKSMlcm9zaWM6Ok9wZW4zMDM6OnNldEFtcFJlbGVhc2UoZG91YmxlKSS6AWVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKHJvc2ljOjpPcGVuMzAzOjoqKShpbnQsIGJvb2wpLCB2b2lkLCByb3NpYzo6T3BlbjMwMyosIGludCwgYm9vbD46Omludm9rZSh2b2lkIChyb3NpYzo6T3BlbjMwMzo6KiBjb25zdCYpKGludCwgYm9vbCksIHJvc2ljOjpPcGVuMzAzKiwgaW50LCBib29sKSUfcm9zaWM6OkFjaWRTZXF1ZW5jZXI6OmdldE5vdGUoKSYmcm9zaWM6OlRlZUJlZUZpbHRlcjo6Z2V0U2FtcGxlKGRvdWJsZSknIXJvc2ljOjpBY2lkUGF0dGVybjo6QWNpZFBhdHRlcm4oKSglcm9zaWM6OkFjaWRTZXF1ZW5jZXI6OkFjaWRTZXF1ZW5jZXIoKSkncm9zaWM6OkFuYWxvZ0VudmVsb3BlOjpBbmFsb2dFbnZlbG9wZSgpKihyb3NpYzo6QW5hbG9nRW52ZWxvcGU6OnNldEF0dGFjayhkb3VibGUpKydyb3NpYzo6QW5hbG9nRW52ZWxvcGU6OnNldERlY2F5KGRvdWJsZSksKXJvc2ljOjpBbmFsb2dFbnZlbG9wZTo6c2V0UmVsZWFzZShkb3VibGUpLSxyb3NpYzo6QW5hbG9nRW52ZWxvcGU6OnNldFNhbXBsZVJhdGUoZG91YmxlKS4qcm9zaWM6OkFuYWxvZ0VudmVsb3BlOjpzZXRUYXVTY2FsZShkb3VibGUpLylyb3NpYzo6QmxlbmRPc2NpbGxhdG9yOjpCbGVuZE9zY2lsbGF0b3IoKTAtcm9zaWM6OkJsZW5kT3NjaWxsYXRvcjo6c2V0U2FtcGxlUmF0ZShkb3VibGUpMSNyb3NpYzo6QmlxdWFkRmlsdGVyOjpCaXF1YWRGaWx0ZXIoKTIhcm9zaWM6OkJpcXVhZEZpbHRlcjo6Y2FsY0NvZWZmcygpMypyb3NpYzo6QmlxdWFkRmlsdGVyOjpzZXRTYW1wbGVSYXRlKGRvdWJsZSk0IXJvc2ljOjpCaXF1YWRGaWx0ZXI6OnNldE1vZGUoaW50KTUpcm9zaWM6OkJpcXVhZEZpbHRlcjo6c2V0RnJlcXVlbmN5KGRvdWJsZSk2K3Jvc2ljOjpEZWNheUVudmVsb3BlOjpzZXRTYW1wbGVSYXRlKGRvdWJsZSk3MnJvc2ljOjpEZWNheUVudmVsb3BlOjpzZXREZWNheVRpbWVDb25zdGFudChkb3VibGUpOCtyb3NpYzo6RGVjYXlFbnZlbG9wZTo6c2V0Tm9ybWFsaXplU3VtKGJvb2wpORpiaXRydjIoaW50LCBpbnQqLCBkb3VibGUqKToeY2Z0ZnN1YihpbnQsIGRvdWJsZSosIGRvdWJsZSopOx5jZnRic3ViKGludCwgZG91YmxlKiwgZG91YmxlKik8HWNmdDFzdChpbnQsIGRvdWJsZSosIGRvdWJsZSopPSJjZnRtZGwoaW50LCBpbnQsIGRvdWJsZSosIGRvdWJsZSopPiZyZGZ0KGludCwgaW50LCBkb3VibGUqLCBpbnQqLCBkb3VibGUqKT87cm9zaWM6OkZvdXJpZXJUcmFuc2Zvcm1lclJhZGl4Mjo6Rm91cmllclRyYW5zZm9ybWVyUmFkaXgyKClAMnJvc2ljOjpGb3VyaWVyVHJhbnNmb3JtZXJSYWRpeDI6OnNldEJsb2NrU2l6ZShpbnQpQTxyb3NpYzo6Rm91cmllclRyYW5zZm9ybWVyUmFkaXgyOjp+Rm91cmllclRyYW5zZm9ybWVyUmFkaXgyKClCTnJvc2ljOjpGb3VyaWVyVHJhbnNmb3JtZXJSYWRpeDI6OnRyYW5zZm9ybVJlYWxTaWduYWwoZG91YmxlKiwgcm9zaWM6OkNvbXBsZXgqKUNVcm9zaWM6OkZvdXJpZXJUcmFuc2Zvcm1lclJhZGl4Mjo6dHJhbnNmb3JtU3ltbWV0cmljU3BlY3RydW0ocm9zaWM6OkNvbXBsZXgqLCBkb3VibGUqKUQtcm9zaWM6OkxlYWt5SW50ZWdyYXRvcjo6c2V0U2FtcGxlUmF0ZShkb3VibGUpRS9yb3NpYzo6TGVha3lJbnRlZ3JhdG9yOjpzZXRUaW1lQ29uc3RhbnQoZG91YmxlKUY9cm9zaWM6OkxlYWt5SW50ZWdyYXRvcjo6Z2V0Tm9ybWFsaXplcihkb3VibGUsIGRvdWJsZSwgZG91YmxlKUc3cm9zaWM6Ok1pZGlOb3RlRXZlbnQ6Ok1pZGlOb3RlRXZlbnQoaW50LCBpbnQsIGludCwgaW50KUgvcm9zaWM6Ok1pcE1hcHBlZFdhdmVUYWJsZTo6TWlwTWFwcGVkV2F2ZVRhYmxlKClJMHJvc2ljOjpNaXBNYXBwZWRXYXZlVGFibGU6On5NaXBNYXBwZWRXYXZlVGFibGUoKUorcm9zaWM6Ok1pcE1hcHBlZFdhdmVUYWJsZTo6Z2VuZXJhdGVNaXBNYXAoKUsrcm9zaWM6Ok1pcE1hcHBlZFdhdmVUYWJsZTo6c2V0V2F2ZWZvcm0oaW50KUwrcm9zaWM6Ok1pcE1hcHBlZFdhdmVUYWJsZTo6cmVuZGVyV2F2ZWZvcm0oKU0ucm9zaWM6Ok1pcE1hcHBlZFdhdmVUYWJsZTo6ZmlsbFdpdGhTcXVhcmUzMDMoKU4ucm9zaWM6Ok1pcE1hcHBlZFdhdmVUYWJsZTo6c2V0U3ltbWV0cnkoZG91YmxlKU8lcm9zaWM6Ok9uZVBvbGVGaWx0ZXI6Ok9uZVBvbGVGaWx0ZXIoKVAicm9zaWM6Ok9uZVBvbGVGaWx0ZXI6OmNhbGNDb2VmZnMoKVErcm9zaWM6Ok9uZVBvbGVGaWx0ZXI6OnNldFNhbXBsZVJhdGUoZG91YmxlKVIicm9zaWM6Ok9uZVBvbGVGaWx0ZXI6OnNldE1vZGUoaW50KVMncm9zaWM6Ok9uZVBvbGVGaWx0ZXI6OnNldEN1dG9mZihkb3VibGUpVBlyb3NpYzo6T3BlbjMwMzo6T3BlbjMwMygpVSVyb3NpYzo6T3BlbjMwMzo6c2V0U2FtcGxlUmF0ZShkb3VibGUpViFyb3NpYzo6T3BlbjMwMzo6c2V0RW52TW9kKGRvdWJsZSlXGnJvc2ljOjpPcGVuMzAzOjp+T3BlbjMwMygpWCFyb3NpYzo6T3BlbjMwMzo6c2V0Q3V0b2ZmKGRvdWJsZSlZIXJvc2ljOjpPcGVuMzAzOjpzZXRBY2NlbnQoZG91YmxlKVohcm9zaWM6Ok9wZW4zMDM6OnNldFZvbHVtZShkb3VibGUpWyRyb3NpYzo6T3BlbjMwMzo6c2V0U2xpZGVUaW1lKGRvdWJsZSlcJHJvc2ljOjpPcGVuMzAzOjpzZXRQaXRjaEJlbmQoZG91YmxlKV0gcm9zaWM6Ok9wZW4zMDM6Om5vdGVPbihpbnQsIGludCledXN0ZDo6X18yOjpsaXN0PHJvc2ljOjpNaWRpTm90ZUV2ZW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHJvc2ljOjpNaWRpTm90ZUV2ZW50PiA+OjpyZW1vdmUocm9zaWM6Ok1pZGlOb3RlRXZlbnQgY29uc3QmKV8mcm9zaWM6Ok9wZW4zMDM6OnRyaWdnZXJOb3RlKGludCwgYm9vbClgJnJvc2ljOjpPcGVuMzAzOjpzbGlkZVRvTm90ZShpbnQsIGJvb2wpYSByb3NpYzo6T3BlbjMwMzo6cmVsZWFzZU5vdGUoaW50KWIjcm9zaWM6OlRlZUJlZUZpbHRlcjo6VGVlQmVlRmlsdGVyKCljKnJvc2ljOjpUZWVCZWVGaWx0ZXI6OnNldFNhbXBsZVJhdGUoZG91YmxlKWQEdGFuaGUEc2luaGYFbGRleHBnBWV4cG0xaAVfX2Nvc2kQX19yZW1fcGlvMl9sYXJnZWoKX19yZW1fcGlvMmsFX19zaW5sA2Nvc20Dc2lubgVfX3Rhbm8DdGFucANleHBxA2xvZ3IDcG93cxtvcGVyYXRvciBuZXcodW5zaWduZWQgbG9uZyl0EF9fZXJybm9fbG9jYXRpb251BnN0cmNtcHYxX19jeHhhYml2MTo6X19zaGltX3R5cGVfaW5mbzo6fl9fc2hpbV90eXBlX2luZm8oKXcrX19jeHhhYml2MTo6X19zaGltX3R5cGVfaW5mbzo6bm9vcDEoKSBjb25zdHg/X19jeHhhYml2MTo6X19mdW5kYW1lbnRhbF90eXBlX2luZm86On5fX2Z1bmRhbWVudGFsX3R5cGVfaW5mbygpeWFfX2N4eGFiaXYxOjpfX2Z1bmRhbWVudGFsX3R5cGVfaW5mbzo6Y2FuX2NhdGNoKF9fY3h4YWJpdjE6Ol9fc2hpbV90eXBlX2luZm8gY29uc3QqLCB2b2lkKiYpIGNvbnN0ejxpc19lcXVhbChzdGQ6OnR5cGVfaW5mbyBjb25zdCosIHN0ZDo6dHlwZV9pbmZvIGNvbnN0KiwgYm9vbCl7W19fY3h4YWJpdjE6Ol9fY2xhc3NfdHlwZV9pbmZvOjpjYW5fY2F0Y2goX19jeHhhYml2MTo6X19zaGltX3R5cGVfaW5mbyBjb25zdCosIHZvaWQqJikgY29uc3R8Dl9fZHluYW1pY19jYXN0fWtfX2N4eGFiaXYxOjpfX2NsYXNzX3R5cGVfaW5mbzo6cHJvY2Vzc19mb3VuZF9iYXNlX2NsYXNzKF9fY3h4YWJpdjE6Ol9fZHluYW1pY19jYXN0X2luZm8qLCB2b2lkKiwgaW50KSBjb25zdH5uX19jeHhhYml2MTo6X19jbGFzc190eXBlX2luZm86Omhhc191bmFtYmlndW91c19wdWJsaWNfYmFzZShfX2N4eGFiaXYxOjpfX2R5bmFtaWNfY2FzdF9pbmZvKiwgdm9pZCosIGludCkgY29uc3R/cV9fY3h4YWJpdjE6Ol9fc2lfY2xhc3NfdHlwZV9pbmZvOjpoYXNfdW5hbWJpZ3VvdXNfcHVibGljX2Jhc2UoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQqLCBpbnQpIGNvbnN0gAFzX19jeHhhYml2MTo6X19iYXNlX2NsYXNzX3R5cGVfaW5mbzo6aGFzX3VuYW1iaWd1b3VzX3B1YmxpY19iYXNlKF9fY3h4YWJpdjE6Ol9fZHluYW1pY19jYXN0X2luZm8qLCB2b2lkKiwgaW50KSBjb25zdIEBcl9fY3h4YWJpdjE6Ol9fdm1pX2NsYXNzX3R5cGVfaW5mbzo6aGFzX3VuYW1iaWd1b3VzX3B1YmxpY19iYXNlKF9fY3h4YWJpdjE6Ol9fZHluYW1pY19jYXN0X2luZm8qLCB2b2lkKiwgaW50KSBjb25zdIIBW19fY3h4YWJpdjE6Ol9fcGJhc2VfdHlwZV9pbmZvOjpjYW5fY2F0Y2goX19jeHhhYml2MTo6X19zaGltX3R5cGVfaW5mbyBjb25zdCosIHZvaWQqJikgY29uc3SDAV1fX2N4eGFiaXYxOjpfX3BvaW50ZXJfdHlwZV9pbmZvOjpjYW5fY2F0Y2goX19jeHhhYml2MTo6X19zaGltX3R5cGVfaW5mbyBjb25zdCosIHZvaWQqJikgY29uc3SEAVxfX2N4eGFiaXYxOjpfX3BvaW50ZXJfdHlwZV9pbmZvOjpjYW5fY2F0Y2hfbmVzdGVkKF9fY3h4YWJpdjE6Ol9fc2hpbV90eXBlX2luZm8gY29uc3QqKSBjb25zdIUBZl9fY3h4YWJpdjE6Ol9fcG9pbnRlcl90b19tZW1iZXJfdHlwZV9pbmZvOjpjYW5fY2F0Y2hfbmVzdGVkKF9fY3h4YWJpdjE6Ol9fc2hpbV90eXBlX2luZm8gY29uc3QqKSBjb25zdIYBgwFfX2N4eGFiaXYxOjpfX2NsYXNzX3R5cGVfaW5mbzo6cHJvY2Vzc19zdGF0aWNfdHlwZV9hYm92ZV9kc3QoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQgY29uc3QqLCB2b2lkIGNvbnN0KiwgaW50KSBjb25zdIcBc19fY3h4YWJpdjE6Ol9fdm1pX2NsYXNzX3R5cGVfaW5mbzo6c2VhcmNoX2JlbG93X2RzdChfX2N4eGFiaXYxOjpfX2R5bmFtaWNfY2FzdF9pbmZvKiwgdm9pZCBjb25zdCosIGludCwgYm9vbCkgY29uc3SIAYEBX19jeHhhYml2MTo6X19iYXNlX2NsYXNzX3R5cGVfaW5mbzo6c2VhcmNoX2Fib3ZlX2RzdChfX2N4eGFiaXYxOjpfX2R5bmFtaWNfY2FzdF9pbmZvKiwgdm9pZCBjb25zdCosIHZvaWQgY29uc3QqLCBpbnQsIGJvb2wpIGNvbnN0iQF0X19jeHhhYml2MTo6X19iYXNlX2NsYXNzX3R5cGVfaW5mbzo6c2VhcmNoX2JlbG93X2RzdChfX2N4eGFiaXYxOjpfX2R5bmFtaWNfY2FzdF9pbmZvKiwgdm9pZCBjb25zdCosIGludCwgYm9vbCkgY29uc3SKAXJfX2N4eGFiaXYxOjpfX3NpX2NsYXNzX3R5cGVfaW5mbzo6c2VhcmNoX2JlbG93X2RzdChfX2N4eGFiaXYxOjpfX2R5bmFtaWNfY2FzdF9pbmZvKiwgdm9pZCBjb25zdCosIGludCwgYm9vbCkgY29uc3SLAW9fX2N4eGFiaXYxOjpfX2NsYXNzX3R5cGVfaW5mbzo6c2VhcmNoX2JlbG93X2RzdChfX2N4eGFiaXYxOjpfX2R5bmFtaWNfY2FzdF9pbmZvKiwgdm9pZCBjb25zdCosIGludCwgYm9vbCkgY29uc3SMAYABX19jeHhhYml2MTo6X192bWlfY2xhc3NfdHlwZV9pbmZvOjpzZWFyY2hfYWJvdmVfZHN0KF9fY3h4YWJpdjE6Ol9fZHluYW1pY19jYXN0X2luZm8qLCB2b2lkIGNvbnN0Kiwgdm9pZCBjb25zdCosIGludCwgYm9vbCkgY29uc3SNAX9fX2N4eGFiaXYxOjpfX3NpX2NsYXNzX3R5cGVfaW5mbzo6c2VhcmNoX2Fib3ZlX2RzdChfX2N4eGFiaXYxOjpfX2R5bmFtaWNfY2FzdF9pbmZvKiwgdm9pZCBjb25zdCosIHZvaWQgY29uc3QqLCBpbnQsIGJvb2wpIGNvbnN0jgF8X19jeHhhYml2MTo6X19jbGFzc190eXBlX2luZm86OnNlYXJjaF9hYm92ZV9kc3QoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQgY29uc3QqLCB2b2lkIGNvbnN0KiwgaW50LCBib29sKSBjb25zdI8BBnN0cmxlbpABCF9fc3RyZHVwkQENX19nZXRUeXBlTmFtZZIBKl9fZW1iaW5kX3JlZ2lzdGVyX25hdGl2ZV9hbmRfYnVpbHRpbl90eXBlc5MBP3ZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9pbnRlZ2VyPGNoYXI+KGNoYXIgY29uc3QqKZQBRnZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9pbnRlZ2VyPHNpZ25lZCBjaGFyPihjaGFyIGNvbnN0KimVAUh2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfaW50ZWdlcjx1bnNpZ25lZCBjaGFyPihjaGFyIGNvbnN0KimWAUB2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfaW50ZWdlcjxzaG9ydD4oY2hhciBjb25zdCoplwFJdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX2ludGVnZXI8dW5zaWduZWQgc2hvcnQ+KGNoYXIgY29uc3QqKZgBPnZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9pbnRlZ2VyPGludD4oY2hhciBjb25zdCopmQFHdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX2ludGVnZXI8dW5zaWduZWQgaW50PihjaGFyIGNvbnN0KimaAT92b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfaW50ZWdlcjxsb25nPihjaGFyIGNvbnN0KimbAUh2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfaW50ZWdlcjx1bnNpZ25lZCBsb25nPihjaGFyIGNvbnN0KimcAT52b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfZmxvYXQ8ZmxvYXQ+KGNoYXIgY29uc3QqKZ0BP3ZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9mbG9hdDxkb3VibGU+KGNoYXIgY29uc3QqKZ4BQ3ZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9tZW1vcnlfdmlldzxjaGFyPihjaGFyIGNvbnN0KimfAUp2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfbWVtb3J5X3ZpZXc8c2lnbmVkIGNoYXI+KGNoYXIgY29uc3QqKaABTHZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9tZW1vcnlfdmlldzx1bnNpZ25lZCBjaGFyPihjaGFyIGNvbnN0KimhAUR2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfbWVtb3J5X3ZpZXc8c2hvcnQ+KGNoYXIgY29uc3QqKaIBTXZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9tZW1vcnlfdmlldzx1bnNpZ25lZCBzaG9ydD4oY2hhciBjb25zdCopowFCdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX21lbW9yeV92aWV3PGludD4oY2hhciBjb25zdCoppAFLdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX21lbW9yeV92aWV3PHVuc2lnbmVkIGludD4oY2hhciBjb25zdCoppQFDdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX21lbW9yeV92aWV3PGxvbmc+KGNoYXIgY29uc3QqKaYBTHZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9tZW1vcnlfdmlldzx1bnNpZ25lZCBsb25nPihjaGFyIGNvbnN0KimnAUR2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfbWVtb3J5X3ZpZXc8ZmxvYXQ+KGNoYXIgY29uc3QqKagBRXZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9tZW1vcnlfdmlldzxkb3VibGU+KGNoYXIgY29uc3QqKakBbkVtc2NyaXB0ZW5CaW5kaW5nSW5pdGlhbGl6ZXJfbmF0aXZlX2FuZF9idWlsdGluX3R5cGVzOjpFbXNjcmlwdGVuQmluZGluZ0luaXRpYWxpemVyX25hdGl2ZV9hbmRfYnVpbHRpbl90eXBlcygpqgEIZGxtYWxsb2OrAQZkbGZyZWWsAQRzYnJrrQEEZXhwMq4BBnNjYWxibq8BBm1lbWNwebABBm1lbXNldLEBB21lbW1vdmWyAQhzZXRUaHJld7MBCXN0YWNrU2F2ZbQBCnN0YWNrQWxsb2O1AQxzdGFja1Jlc3RvcmW2ARBfX2dyb3dXYXNtTWVtb3J5twEKZHluQ2FsbF9pabgBCmR5bkNhbGxfdmm5AQpkeW5DYWxsX2RpugELZHluQ2FsbF9kaWm7AQtkeW5DYWxsX3ZpZLwBDGR5bkNhbGxfdmlpZL0BDGR5bkNhbGxfdmlpab4BDWR5bkNhbGxfdmlpaWm/AQxkeW5DYWxsX2lpaWnAAQ9keW5DYWxsX3ZpaWlpaWnBAQ5keW5DYWxsX3ZpaWlpaQB1EHNvdXJjZU1hcHBpbmdVUkxjaHR0cDovL2xvY2FsaG9zdDo5MDAwL2F1ZGlvLXdvcmtsZXQvYnVpbGQve3t7IEZJTEVOQU1FX1JFUExBQ0VNRU5UX1NUUklOR1NfV0FTTV9CSU5BUllfRklMRSB9fX0ubWFw';
if (!isDataURI(wasmBinaryFile)) {
  wasmBinaryFile = locateFile(wasmBinaryFile);
}

function getBinary() {
  try {
    if (wasmBinary) {
      return new Uint8Array(wasmBinary);
    }

    var binary = tryParseAsDataURI(wasmBinaryFile);
    if (binary) {
      return binary;
    }
    if (readBinary) {
      return readBinary(wasmBinaryFile);
    } else {
      throw "sync fetching of the wasm failed: you can preload it to Module['wasmBinary'] manually, or emcc.py will do that for you when generating HTML (but not JS)";
    }
  }
  catch (err) {
    abort(err);
  }
}

function getBinaryPromise() {
  // if we don't have the binary yet, and have the Fetch api, use that
  // in some environments, like Electron's render process, Fetch api may be present, but have a different context than expected, let's only use it on the Web
  if (!wasmBinary && (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) && typeof fetch === 'function') {
    return fetch(wasmBinaryFile, { credentials: 'same-origin' }).then(function(response) {
      if (!response['ok']) {
        throw "failed to load wasm binary file at '" + wasmBinaryFile + "'";
      }
      return response['arrayBuffer']();
    }).catch(function () {
      return getBinary();
    });
  }
  // Otherwise, getBinary should be able to get it synchronously
  return new Promise(function(resolve, reject) {
    resolve(getBinary());
  });
}



// Create the wasm instance.
// Receives the wasm imports, returns the exports.
function createWasm() {
  // prepare imports
  var info = {
    'env': asmLibraryArg,
    'wasi_snapshot_preview1': asmLibraryArg
  };
  // Load the wasm module and create an instance of using native support in the JS engine.
  // handle a generated wasm instance, receiving its exports and
  // performing other necessary setup
  /** @param {WebAssembly.Module=} module*/
  function receiveInstance(instance, module) {
    var exports = instance.exports;
    Module['asm'] = exports;
    removeRunDependency('wasm-instantiate');
  }
   // we can't run yet (except in a pthread, where we have a custom sync instantiator)
  addRunDependency('wasm-instantiate');


  function receiveInstantiatedSource(output) {
    // 'output' is a WebAssemblyInstantiatedSource object which has both the module and instance.
    // receiveInstance() will swap in the exports (to Module.asm) so they can be called
      // TODO: Due to Closure regression https://github.com/google/closure-compiler/issues/3193, the above line no longer optimizes out down to the following line.
      // When the regression is fixed, can restore the above USE_PTHREADS-enabled path.
    receiveInstance(output['instance']);
  }


  function instantiateArrayBuffer(receiver) {
    return getBinaryPromise().then(function(binary) {
      return WebAssembly.instantiate(binary, info);
    }).then(receiver, function(reason) {
      err('failed to asynchronously prepare wasm: ' + reason);
      abort(reason);
    });
  }

  // Prefer streaming instantiation if available.
  function instantiateSync() {
    var instance;
    var module;
    var binary;
    try {
      binary = getBinary();
      module = new WebAssembly.Module(binary);
      instance = new WebAssembly.Instance(module, info);
    } catch (e) {
      var str = e.toString();
      err('failed to compile wasm module: ' + str);
      if (str.indexOf('imported Memory') >= 0 ||
          str.indexOf('memory import') >= 0) {
        err('Memory size incompatibility issues may be due to changing TOTAL_MEMORY at runtime to something too large. Use ALLOW_MEMORY_GROWTH to allow any size memory (and also make sure not to set TOTAL_MEMORY at runtime to something smaller than it was at compile time).');
      }
      throw e;
    }
    receiveInstance(instance, module);
  }
  // User shell pages can write their own Module.instantiateWasm = function(imports, successCallback) callback
  // to manually instantiate the Wasm module themselves. This allows pages to run the instantiation parallel
  // to any other async startup actions they are performing.
  if (Module['instantiateWasm']) {
    try {
      var exports = Module['instantiateWasm'](info, receiveInstance);
      return exports;
    } catch(e) {
      err('Module.instantiateWasm callback failed with error: ' + e);
      return false;
    }
  }

  instantiateSync();
  return Module['asm']; // exports were assigned here
}


// Globals used by JS i64 conversions
var tempDouble;
var tempI64;

// === Body ===

var ASM_CONSTS = {
  
};




// STATICTOP = STATIC_BASE + 27232;
/* global initializers */  __ATINIT__.push({ func: function() { ___wasm_call_ctors() } });




/* no memory initializer */
// {{PRE_LIBRARY}}


  function demangle(func) {
      return func;
    }

  function demangleAll(text) {
      var regex =
        /\b_Z[\w\d_]+/g;
      return text.replace(regex,
        function(x) {
          var y = demangle(x);
          return x === y ? x : (y + ' [' + x + ']');
        });
    }

  function jsStackTrace() {
      var err = new Error();
      if (!err.stack) {
        // IE10+ special cases: It does have callstack info, but it is only populated if an Error object is thrown,
        // so try that as a special-case.
        try {
          throw new Error();
        } catch(e) {
          err = e;
        }
        if (!err.stack) {
          return '(no stack trace available)';
        }
      }
      return err.stack.toString();
    }

  function stackTrace() {
      var js = jsStackTrace();
      if (Module['extraStackTrace']) js += '\n' + Module['extraStackTrace']();
      return demangleAll(js);
    }

  
  function getShiftFromSize(size) {
      switch (size) {
          case 1: return 0;
          case 2: return 1;
          case 4: return 2;
          case 8: return 3;
          default:
              throw new TypeError('Unknown type size: ' + size);
      }
    }
  
  
  
  function embind_init_charCodes() {
      var codes = new Array(256);
      for (var i = 0; i < 256; ++i) {
          codes[i] = String.fromCharCode(i);
      }
      embind_charCodes = codes;
    }var embind_charCodes=undefined;function readLatin1String(ptr) {
      var ret = "";
      var c = ptr;
      while (HEAPU8[c]) {
          ret += embind_charCodes[HEAPU8[c++]];
      }
      return ret;
    }
  
  
  var awaitingDependencies={};
  
  var registeredTypes={};
  
  var typeDependencies={};
  
  
  
  
  
  
  var char_0=48;
  
  var char_9=57;function makeLegalFunctionName(name) {
      if (undefined === name) {
          return '_unknown';
      }
      name = name.replace(/[^a-zA-Z0-9_]/g, '$');
      var f = name.charCodeAt(0);
      if (f >= char_0 && f <= char_9) {
          return '_' + name;
      } else {
          return name;
      }
    }function createNamedFunction(name, body) {
      name = makeLegalFunctionName(name);
      /*jshint evil:true*/
      return new Function(
          "body",
          "return function " + name + "() {\n" +
          "    \"use strict\";" +
          "    return body.apply(this, arguments);\n" +
          "};\n"
      )(body);
    }function extendError(baseErrorType, errorName) {
      var errorClass = createNamedFunction(errorName, function(message) {
          this.name = errorName;
          this.message = message;
  
          var stack = (new Error(message)).stack;
          if (stack !== undefined) {
              this.stack = this.toString() + '\n' +
                  stack.replace(/^Error(:[^\n]*)?\n/, '');
          }
      });
      errorClass.prototype = Object.create(baseErrorType.prototype);
      errorClass.prototype.constructor = errorClass;
      errorClass.prototype.toString = function() {
          if (this.message === undefined) {
              return this.name;
          } else {
              return this.name + ': ' + this.message;
          }
      };
  
      return errorClass;
    }var BindingError=undefined;function throwBindingError(message) {
      throw new BindingError(message);
    }
  
  
  
  var InternalError=undefined;function throwInternalError(message) {
      throw new InternalError(message);
    }function whenDependentTypesAreResolved(myTypes, dependentTypes, getTypeConverters) {
      myTypes.forEach(function(type) {
          typeDependencies[type] = dependentTypes;
      });
  
      function onComplete(typeConverters) {
          var myTypeConverters = getTypeConverters(typeConverters);
          if (myTypeConverters.length !== myTypes.length) {
              throwInternalError('Mismatched type converter count');
          }
          for (var i = 0; i < myTypes.length; ++i) {
              registerType(myTypes[i], myTypeConverters[i]);
          }
      }
  
      var typeConverters = new Array(dependentTypes.length);
      var unregisteredTypes = [];
      var registered = 0;
      dependentTypes.forEach(function(dt, i) {
          if (registeredTypes.hasOwnProperty(dt)) {
              typeConverters[i] = registeredTypes[dt];
          } else {
              unregisteredTypes.push(dt);
              if (!awaitingDependencies.hasOwnProperty(dt)) {
                  awaitingDependencies[dt] = [];
              }
              awaitingDependencies[dt].push(function() {
                  typeConverters[i] = registeredTypes[dt];
                  ++registered;
                  if (registered === unregisteredTypes.length) {
                      onComplete(typeConverters);
                  }
              });
          }
      });
      if (0 === unregisteredTypes.length) {
          onComplete(typeConverters);
      }
    }function registerType(rawType, registeredInstance, options) {
      options = options || {};
  
      if (!('argPackAdvance' in registeredInstance)) {
          throw new TypeError('registerType registeredInstance requires argPackAdvance');
      }
  
      var name = registeredInstance.name;
      if (!rawType) {
          throwBindingError('type "' + name + '" must have a positive integer typeid pointer');
      }
      if (registeredTypes.hasOwnProperty(rawType)) {
          if (options.ignoreDuplicateRegistrations) {
              return;
          } else {
              throwBindingError("Cannot register type '" + name + "' twice");
          }
      }
  
      registeredTypes[rawType] = registeredInstance;
      delete typeDependencies[rawType];
  
      if (awaitingDependencies.hasOwnProperty(rawType)) {
          var callbacks = awaitingDependencies[rawType];
          delete awaitingDependencies[rawType];
          callbacks.forEach(function(cb) {
              cb();
          });
      }
    }function __embind_register_bool(rawType, name, size, trueValue, falseValue) {
      var shift = getShiftFromSize(size);
  
      name = readLatin1String(name);
      registerType(rawType, {
          name: name,
          'fromWireType': function(wt) {
              // ambiguous emscripten ABI: sometimes return values are
              // true or false, and sometimes integers (0 or 1)
              return !!wt;
          },
          'toWireType': function(destructors, o) {
              return o ? trueValue : falseValue;
          },
          'argPackAdvance': 8,
          'readValueFromPointer': function(pointer) {
              // TODO: if heap is fixed (like in asm.js) this could be executed outside
              var heap;
              if (size === 1) {
                  heap = HEAP8;
              } else if (size === 2) {
                  heap = HEAP16;
              } else if (size === 4) {
                  heap = HEAP32;
              } else {
                  throw new TypeError("Unknown boolean type size: " + name);
              }
              return this['fromWireType'](heap[pointer >> shift]);
          },
          destructorFunction: null, // This type does not need a destructor
      });
    }

  
  
  
  function ClassHandle_isAliasOf(other) {
      if (!(this instanceof ClassHandle)) {
          return false;
      }
      if (!(other instanceof ClassHandle)) {
          return false;
      }
  
      var leftClass = this.$$.ptrType.registeredClass;
      var left = this.$$.ptr;
      var rightClass = other.$$.ptrType.registeredClass;
      var right = other.$$.ptr;
  
      while (leftClass.baseClass) {
          left = leftClass.upcast(left);
          leftClass = leftClass.baseClass;
      }
  
      while (rightClass.baseClass) {
          right = rightClass.upcast(right);
          rightClass = rightClass.baseClass;
      }
  
      return leftClass === rightClass && left === right;
    }
  
  
  function shallowCopyInternalPointer(o) {
      return {
          count: o.count,
          deleteScheduled: o.deleteScheduled,
          preservePointerOnDelete: o.preservePointerOnDelete,
          ptr: o.ptr,
          ptrType: o.ptrType,
          smartPtr: o.smartPtr,
          smartPtrType: o.smartPtrType,
      };
    }
  
  function throwInstanceAlreadyDeleted(obj) {
      function getInstanceTypeName(handle) {
        return handle.$$.ptrType.registeredClass.name;
      }
      throwBindingError(getInstanceTypeName(obj) + ' instance already deleted');
    }
  
  
  var finalizationGroup=false;
  
  function detachFinalizer(handle) {}
  
  
  function runDestructor($$) {
      if ($$.smartPtr) {
          $$.smartPtrType.rawDestructor($$.smartPtr);
      } else {
          $$.ptrType.registeredClass.rawDestructor($$.ptr);
      }
    }function releaseClassHandle($$) {
      $$.count.value -= 1;
      var toDelete = 0 === $$.count.value;
      if (toDelete) {
          runDestructor($$);
      }
    }function attachFinalizer(handle) {
      if ('undefined' === typeof FinalizationGroup) {
          attachFinalizer = function (handle) { return handle; };
          return handle;
      }
      // If the running environment has a FinalizationGroup (see
      // https://github.com/tc39/proposal-weakrefs), then attach finalizers
      // for class handles.  We check for the presence of FinalizationGroup
      // at run-time, not build-time.
      finalizationGroup = new FinalizationGroup(function (iter) {
          for (var result = iter.next(); !result.done; result = iter.next()) {
              var $$ = result.value;
              if (!$$.ptr) {
                  console.warn('object already deleted: ' + $$.ptr);
              } else {
                  releaseClassHandle($$);
              }
          }
      });
      attachFinalizer = function(handle) {
          finalizationGroup.register(handle, handle.$$, handle.$$);
          return handle;
      };
      detachFinalizer = function(handle) {
          finalizationGroup.unregister(handle.$$);
      };
      return attachFinalizer(handle);
    }function ClassHandle_clone() {
      if (!this.$$.ptr) {
          throwInstanceAlreadyDeleted(this);
      }
  
      if (this.$$.preservePointerOnDelete) {
          this.$$.count.value += 1;
          return this;
      } else {
          var clone = attachFinalizer(Object.create(Object.getPrototypeOf(this), {
              $$: {
                  value: shallowCopyInternalPointer(this.$$),
              }
          }));
  
          clone.$$.count.value += 1;
          clone.$$.deleteScheduled = false;
          return clone;
      }
    }
  
  function ClassHandle_delete() {
      if (!this.$$.ptr) {
          throwInstanceAlreadyDeleted(this);
      }
  
      if (this.$$.deleteScheduled && !this.$$.preservePointerOnDelete) {
          throwBindingError('Object already scheduled for deletion');
      }
  
      detachFinalizer(this);
      releaseClassHandle(this.$$);
  
      if (!this.$$.preservePointerOnDelete) {
          this.$$.smartPtr = undefined;
          this.$$.ptr = undefined;
      }
    }
  
  function ClassHandle_isDeleted() {
      return !this.$$.ptr;
    }
  
  
  var delayFunction=undefined;
  
  var deletionQueue=[];
  
  function flushPendingDeletes() {
      while (deletionQueue.length) {
          var obj = deletionQueue.pop();
          obj.$$.deleteScheduled = false;
          obj['delete']();
      }
    }function ClassHandle_deleteLater() {
      if (!this.$$.ptr) {
          throwInstanceAlreadyDeleted(this);
      }
      if (this.$$.deleteScheduled && !this.$$.preservePointerOnDelete) {
          throwBindingError('Object already scheduled for deletion');
      }
      deletionQueue.push(this);
      if (deletionQueue.length === 1 && delayFunction) {
          delayFunction(flushPendingDeletes);
      }
      this.$$.deleteScheduled = true;
      return this;
    }function init_ClassHandle() {
      ClassHandle.prototype['isAliasOf'] = ClassHandle_isAliasOf;
      ClassHandle.prototype['clone'] = ClassHandle_clone;
      ClassHandle.prototype['delete'] = ClassHandle_delete;
      ClassHandle.prototype['isDeleted'] = ClassHandle_isDeleted;
      ClassHandle.prototype['deleteLater'] = ClassHandle_deleteLater;
    }function ClassHandle() {
    }
  
  var registeredPointers={};
  
  
  function ensureOverloadTable(proto, methodName, humanName) {
      if (undefined === proto[methodName].overloadTable) {
          var prevFunc = proto[methodName];
          // Inject an overload resolver function that routes to the appropriate overload based on the number of arguments.
          proto[methodName] = function() {
              // TODO This check can be removed in -O3 level "unsafe" optimizations.
              if (!proto[methodName].overloadTable.hasOwnProperty(arguments.length)) {
                  throwBindingError("Function '" + humanName + "' called with an invalid number of arguments (" + arguments.length + ") - expects one of (" + proto[methodName].overloadTable + ")!");
              }
              return proto[methodName].overloadTable[arguments.length].apply(this, arguments);
          };
          // Move the previous function into the overload table.
          proto[methodName].overloadTable = [];
          proto[methodName].overloadTable[prevFunc.argCount] = prevFunc;
      }
    }function exposePublicSymbol(name, value, numArguments) {
      if (Module.hasOwnProperty(name)) {
          if (undefined === numArguments || (undefined !== Module[name].overloadTable && undefined !== Module[name].overloadTable[numArguments])) {
              throwBindingError("Cannot register public name '" + name + "' twice");
          }
  
          // We are exposing a function with the same name as an existing function. Create an overload table and a function selector
          // that routes between the two.
          ensureOverloadTable(Module, name, name);
          if (Module.hasOwnProperty(numArguments)) {
              throwBindingError("Cannot register multiple overloads of a function with the same number of arguments (" + numArguments + ")!");
          }
          // Add the new function into the overload table.
          Module[name].overloadTable[numArguments] = value;
      }
      else {
          Module[name] = value;
          if (undefined !== numArguments) {
              Module[name].numArguments = numArguments;
          }
      }
    }
  
  function RegisteredClass(
      name,
      constructor,
      instancePrototype,
      rawDestructor,
      baseClass,
      getActualType,
      upcast,
      downcast
    ) {
      this.name = name;
      this.constructor = constructor;
      this.instancePrototype = instancePrototype;
      this.rawDestructor = rawDestructor;
      this.baseClass = baseClass;
      this.getActualType = getActualType;
      this.upcast = upcast;
      this.downcast = downcast;
      this.pureVirtualFunctions = [];
    }
  
  
  
  function upcastPointer(ptr, ptrClass, desiredClass) {
      while (ptrClass !== desiredClass) {
          if (!ptrClass.upcast) {
              throwBindingError("Expected null or instance of " + desiredClass.name + ", got an instance of " + ptrClass.name);
          }
          ptr = ptrClass.upcast(ptr);
          ptrClass = ptrClass.baseClass;
      }
      return ptr;
    }function constNoSmartPtrRawPointerToWireType(destructors, handle) {
      if (handle === null) {
          if (this.isReference) {
              throwBindingError('null is not a valid ' + this.name);
          }
          return 0;
      }
  
      if (!handle.$$) {
          throwBindingError('Cannot pass "' + _embind_repr(handle) + '" as a ' + this.name);
      }
      if (!handle.$$.ptr) {
          throwBindingError('Cannot pass deleted object as a pointer of type ' + this.name);
      }
      var handleClass = handle.$$.ptrType.registeredClass;
      var ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass);
      return ptr;
    }
  
  function genericPointerToWireType(destructors, handle) {
      var ptr;
      if (handle === null) {
          if (this.isReference) {
              throwBindingError('null is not a valid ' + this.name);
          }
  
          if (this.isSmartPointer) {
              ptr = this.rawConstructor();
              if (destructors !== null) {
                  destructors.push(this.rawDestructor, ptr);
              }
              return ptr;
          } else {
              return 0;
          }
      }
  
      if (!handle.$$) {
          throwBindingError('Cannot pass "' + _embind_repr(handle) + '" as a ' + this.name);
      }
      if (!handle.$$.ptr) {
          throwBindingError('Cannot pass deleted object as a pointer of type ' + this.name);
      }
      if (!this.isConst && handle.$$.ptrType.isConst) {
          throwBindingError('Cannot convert argument of type ' + (handle.$$.smartPtrType ? handle.$$.smartPtrType.name : handle.$$.ptrType.name) + ' to parameter type ' + this.name);
      }
      var handleClass = handle.$$.ptrType.registeredClass;
      ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass);
  
      if (this.isSmartPointer) {
          // TODO: this is not strictly true
          // We could support BY_EMVAL conversions from raw pointers to smart pointers
          // because the smart pointer can hold a reference to the handle
          if (undefined === handle.$$.smartPtr) {
              throwBindingError('Passing raw pointer to smart pointer is illegal');
          }
  
          switch (this.sharingPolicy) {
              case 0: // NONE
                  // no upcasting
                  if (handle.$$.smartPtrType === this) {
                      ptr = handle.$$.smartPtr;
                  } else {
                      throwBindingError('Cannot convert argument of type ' + (handle.$$.smartPtrType ? handle.$$.smartPtrType.name : handle.$$.ptrType.name) + ' to parameter type ' + this.name);
                  }
                  break;
  
              case 1: // INTRUSIVE
                  ptr = handle.$$.smartPtr;
                  break;
  
              case 2: // BY_EMVAL
                  if (handle.$$.smartPtrType === this) {
                      ptr = handle.$$.smartPtr;
                  } else {
                      var clonedHandle = handle['clone']();
                      ptr = this.rawShare(
                          ptr,
                          __emval_register(function() {
                              clonedHandle['delete']();
                          })
                      );
                      if (destructors !== null) {
                          destructors.push(this.rawDestructor, ptr);
                      }
                  }
                  break;
  
              default:
                  throwBindingError('Unsupporting sharing policy');
          }
      }
      return ptr;
    }
  
  function nonConstNoSmartPtrRawPointerToWireType(destructors, handle) {
      if (handle === null) {
          if (this.isReference) {
              throwBindingError('null is not a valid ' + this.name);
          }
          return 0;
      }
  
      if (!handle.$$) {
          throwBindingError('Cannot pass "' + _embind_repr(handle) + '" as a ' + this.name);
      }
      if (!handle.$$.ptr) {
          throwBindingError('Cannot pass deleted object as a pointer of type ' + this.name);
      }
      if (handle.$$.ptrType.isConst) {
          throwBindingError('Cannot convert argument of type ' + handle.$$.ptrType.name + ' to parameter type ' + this.name);
      }
      var handleClass = handle.$$.ptrType.registeredClass;
      var ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass);
      return ptr;
    }
  
  
  function simpleReadValueFromPointer(pointer) {
      return this['fromWireType'](HEAPU32[pointer >> 2]);
    }
  
  function RegisteredPointer_getPointee(ptr) {
      if (this.rawGetPointee) {
          ptr = this.rawGetPointee(ptr);
      }
      return ptr;
    }
  
  function RegisteredPointer_destructor(ptr) {
      if (this.rawDestructor) {
          this.rawDestructor(ptr);
      }
    }
  
  function RegisteredPointer_deleteObject(handle) {
      if (handle !== null) {
          handle['delete']();
      }
    }
  
  
  function downcastPointer(ptr, ptrClass, desiredClass) {
      if (ptrClass === desiredClass) {
          return ptr;
      }
      if (undefined === desiredClass.baseClass) {
          return null; // no conversion
      }
  
      var rv = downcastPointer(ptr, ptrClass, desiredClass.baseClass);
      if (rv === null) {
          return null;
      }
      return desiredClass.downcast(rv);
    }
  
  
  
  
  function getInheritedInstanceCount() {
      return Object.keys(registeredInstances).length;
    }
  
  function getLiveInheritedInstances() {
      var rv = [];
      for (var k in registeredInstances) {
          if (registeredInstances.hasOwnProperty(k)) {
              rv.push(registeredInstances[k]);
          }
      }
      return rv;
    }
  
  function setDelayFunction(fn) {
      delayFunction = fn;
      if (deletionQueue.length && delayFunction) {
          delayFunction(flushPendingDeletes);
      }
    }function init_embind() {
      Module['getInheritedInstanceCount'] = getInheritedInstanceCount;
      Module['getLiveInheritedInstances'] = getLiveInheritedInstances;
      Module['flushPendingDeletes'] = flushPendingDeletes;
      Module['setDelayFunction'] = setDelayFunction;
    }var registeredInstances={};
  
  function getBasestPointer(class_, ptr) {
      if (ptr === undefined) {
          throwBindingError('ptr should not be undefined');
      }
      while (class_.baseClass) {
          ptr = class_.upcast(ptr);
          class_ = class_.baseClass;
      }
      return ptr;
    }function getInheritedInstance(class_, ptr) {
      ptr = getBasestPointer(class_, ptr);
      return registeredInstances[ptr];
    }
  
  function makeClassHandle(prototype, record) {
      if (!record.ptrType || !record.ptr) {
          throwInternalError('makeClassHandle requires ptr and ptrType');
      }
      var hasSmartPtrType = !!record.smartPtrType;
      var hasSmartPtr = !!record.smartPtr;
      if (hasSmartPtrType !== hasSmartPtr) {
          throwInternalError('Both smartPtrType and smartPtr must be specified');
      }
      record.count = { value: 1 };
      return attachFinalizer(Object.create(prototype, {
          $$: {
              value: record,
          },
      }));
    }function RegisteredPointer_fromWireType(ptr) {
      // ptr is a raw pointer (or a raw smartpointer)
  
      // rawPointer is a maybe-null raw pointer
      var rawPointer = this.getPointee(ptr);
      if (!rawPointer) {
          this.destructor(ptr);
          return null;
      }
  
      var registeredInstance = getInheritedInstance(this.registeredClass, rawPointer);
      if (undefined !== registeredInstance) {
          // JS object has been neutered, time to repopulate it
          if (0 === registeredInstance.$$.count.value) {
              registeredInstance.$$.ptr = rawPointer;
              registeredInstance.$$.smartPtr = ptr;
              return registeredInstance['clone']();
          } else {
              // else, just increment reference count on existing object
              // it already has a reference to the smart pointer
              var rv = registeredInstance['clone']();
              this.destructor(ptr);
              return rv;
          }
      }
  
      function makeDefaultHandle() {
          if (this.isSmartPointer) {
              return makeClassHandle(this.registeredClass.instancePrototype, {
                  ptrType: this.pointeeType,
                  ptr: rawPointer,
                  smartPtrType: this,
                  smartPtr: ptr,
              });
          } else {
              return makeClassHandle(this.registeredClass.instancePrototype, {
                  ptrType: this,
                  ptr: ptr,
              });
          }
      }
  
      var actualType = this.registeredClass.getActualType(rawPointer);
      var registeredPointerRecord = registeredPointers[actualType];
      if (!registeredPointerRecord) {
          return makeDefaultHandle.call(this);
      }
  
      var toType;
      if (this.isConst) {
          toType = registeredPointerRecord.constPointerType;
      } else {
          toType = registeredPointerRecord.pointerType;
      }
      var dp = downcastPointer(
          rawPointer,
          this.registeredClass,
          toType.registeredClass);
      if (dp === null) {
          return makeDefaultHandle.call(this);
      }
      if (this.isSmartPointer) {
          return makeClassHandle(toType.registeredClass.instancePrototype, {
              ptrType: toType,
              ptr: dp,
              smartPtrType: this,
              smartPtr: ptr,
          });
      } else {
          return makeClassHandle(toType.registeredClass.instancePrototype, {
              ptrType: toType,
              ptr: dp,
          });
      }
    }function init_RegisteredPointer() {
      RegisteredPointer.prototype.getPointee = RegisteredPointer_getPointee;
      RegisteredPointer.prototype.destructor = RegisteredPointer_destructor;
      RegisteredPointer.prototype['argPackAdvance'] = 8;
      RegisteredPointer.prototype['readValueFromPointer'] = simpleReadValueFromPointer;
      RegisteredPointer.prototype['deleteObject'] = RegisteredPointer_deleteObject;
      RegisteredPointer.prototype['fromWireType'] = RegisteredPointer_fromWireType;
    }function RegisteredPointer(
      name,
      registeredClass,
      isReference,
      isConst,
  
      // smart pointer properties
      isSmartPointer,
      pointeeType,
      sharingPolicy,
      rawGetPointee,
      rawConstructor,
      rawShare,
      rawDestructor
    ) {
      this.name = name;
      this.registeredClass = registeredClass;
      this.isReference = isReference;
      this.isConst = isConst;
  
      // smart pointer properties
      this.isSmartPointer = isSmartPointer;
      this.pointeeType = pointeeType;
      this.sharingPolicy = sharingPolicy;
      this.rawGetPointee = rawGetPointee;
      this.rawConstructor = rawConstructor;
      this.rawShare = rawShare;
      this.rawDestructor = rawDestructor;
  
      if (!isSmartPointer && registeredClass.baseClass === undefined) {
          if (isConst) {
              this['toWireType'] = constNoSmartPtrRawPointerToWireType;
              this.destructorFunction = null;
          } else {
              this['toWireType'] = nonConstNoSmartPtrRawPointerToWireType;
              this.destructorFunction = null;
          }
      } else {
          this['toWireType'] = genericPointerToWireType;
          // Here we must leave this.destructorFunction undefined, since whether genericPointerToWireType returns
          // a pointer that needs to be freed up is runtime-dependent, and cannot be evaluated at registration time.
          // TODO: Create an alternative mechanism that allows removing the use of var destructors = []; array in
          //       craftInvokerFunction altogether.
      }
    }
  
  function replacePublicSymbol(name, value, numArguments) {
      if (!Module.hasOwnProperty(name)) {
          throwInternalError('Replacing nonexistant public symbol');
      }
      // If there's an overload table for this symbol, replace the symbol in the overload table instead.
      if (undefined !== Module[name].overloadTable && undefined !== numArguments) {
          Module[name].overloadTable[numArguments] = value;
      }
      else {
          Module[name] = value;
          Module[name].argCount = numArguments;
      }
    }
  
  function embind__requireFunction(signature, rawFunction) {
      signature = readLatin1String(signature);
  
      function makeDynCaller(dynCall) {
          var args = [];
          for (var i = 1; i < signature.length; ++i) {
              args.push('a' + i);
          }
  
          var name = 'dynCall_' + signature + '_' + rawFunction;
          var body = 'return function ' + name + '(' + args.join(', ') + ') {\n';
          body    += '    return dynCall(rawFunction' + (args.length ? ', ' : '') + args.join(', ') + ');\n';
          body    += '};\n';
  
          return (new Function('dynCall', 'rawFunction', body))(dynCall, rawFunction);
      }
  
      var fp;
      if (Module['FUNCTION_TABLE_' + signature] !== undefined) {
          fp = Module['FUNCTION_TABLE_' + signature][rawFunction];
      } else if (typeof FUNCTION_TABLE !== "undefined") {
          fp = FUNCTION_TABLE[rawFunction];
      } else {
          // asm.js does not give direct access to the function tables,
          // and thus we must go through the dynCall interface which allows
          // calling into a signature's function table by pointer value.
          //
          // https://github.com/dherman/asm.js/issues/83
          //
          // This has three main penalties:
          // - dynCall is another function call in the path from JavaScript to C++.
          // - JITs may not predict through the function table indirection at runtime.
          var dc = Module['dynCall_' + signature];
          if (dc === undefined) {
              // We will always enter this branch if the signature
              // contains 'f' and PRECISE_F32 is not enabled.
              //
              // Try again, replacing 'f' with 'd'.
              dc = Module['dynCall_' + signature.replace(/f/g, 'd')];
              if (dc === undefined) {
                  throwBindingError("No dynCall invoker for signature: " + signature);
              }
          }
          fp = makeDynCaller(dc);
      }
  
      if (typeof fp !== "function") {
          throwBindingError("unknown function pointer with signature " + signature + ": " + rawFunction);
      }
      return fp;
    }
  
  
  var UnboundTypeError=undefined;
  
  function getTypeName(type) {
      var ptr = ___getTypeName(type);
      var rv = readLatin1String(ptr);
      _free(ptr);
      return rv;
    }function throwUnboundTypeError(message, types) {
      var unboundTypes = [];
      var seen = {};
      function visit(type) {
          if (seen[type]) {
              return;
          }
          if (registeredTypes[type]) {
              return;
          }
          if (typeDependencies[type]) {
              typeDependencies[type].forEach(visit);
              return;
          }
          unboundTypes.push(type);
          seen[type] = true;
      }
      types.forEach(visit);
  
      throw new UnboundTypeError(message + ': ' + unboundTypes.map(getTypeName).join([', ']));
    }function __embind_register_class(
      rawType,
      rawPointerType,
      rawConstPointerType,
      baseClassRawType,
      getActualTypeSignature,
      getActualType,
      upcastSignature,
      upcast,
      downcastSignature,
      downcast,
      name,
      destructorSignature,
      rawDestructor
    ) {
      name = readLatin1String(name);
      getActualType = embind__requireFunction(getActualTypeSignature, getActualType);
      if (upcast) {
          upcast = embind__requireFunction(upcastSignature, upcast);
      }
      if (downcast) {
          downcast = embind__requireFunction(downcastSignature, downcast);
      }
      rawDestructor = embind__requireFunction(destructorSignature, rawDestructor);
      var legalFunctionName = makeLegalFunctionName(name);
  
      exposePublicSymbol(legalFunctionName, function() {
          // this code cannot run if baseClassRawType is zero
          throwUnboundTypeError('Cannot construct ' + name + ' due to unbound types', [baseClassRawType]);
      });
  
      whenDependentTypesAreResolved(
          [rawType, rawPointerType, rawConstPointerType],
          baseClassRawType ? [baseClassRawType] : [],
          function(base) {
              base = base[0];
  
              var baseClass;
              var basePrototype;
              if (baseClassRawType) {
                  baseClass = base.registeredClass;
                  basePrototype = baseClass.instancePrototype;
              } else {
                  basePrototype = ClassHandle.prototype;
              }
  
              var constructor = createNamedFunction(legalFunctionName, function() {
                  if (Object.getPrototypeOf(this) !== instancePrototype) {
                      throw new BindingError("Use 'new' to construct " + name);
                  }
                  if (undefined === registeredClass.constructor_body) {
                      throw new BindingError(name + " has no accessible constructor");
                  }
                  var body = registeredClass.constructor_body[arguments.length];
                  if (undefined === body) {
                      throw new BindingError("Tried to invoke ctor of " + name + " with invalid number of parameters (" + arguments.length + ") - expected (" + Object.keys(registeredClass.constructor_body).toString() + ") parameters instead!");
                  }
                  return body.apply(this, arguments);
              });
  
              var instancePrototype = Object.create(basePrototype, {
                  constructor: { value: constructor },
              });
  
              constructor.prototype = instancePrototype;
  
              var registeredClass = new RegisteredClass(
                  name,
                  constructor,
                  instancePrototype,
                  rawDestructor,
                  baseClass,
                  getActualType,
                  upcast,
                  downcast);
  
              var referenceConverter = new RegisteredPointer(
                  name,
                  registeredClass,
                  true,
                  false,
                  false);
  
              var pointerConverter = new RegisteredPointer(
                  name + '*',
                  registeredClass,
                  false,
                  false,
                  false);
  
              var constPointerConverter = new RegisteredPointer(
                  name + ' const*',
                  registeredClass,
                  false,
                  true,
                  false);
  
              registeredPointers[rawType] = {
                  pointerType: pointerConverter,
                  constPointerType: constPointerConverter
              };
  
              replacePublicSymbol(legalFunctionName, constructor);
  
              return [referenceConverter, pointerConverter, constPointerConverter];
          }
      );
    }

  
  function heap32VectorToArray(count, firstElement) {
      var array = [];
      for (var i = 0; i < count; i++) {
          array.push(HEAP32[(firstElement >> 2) + i]);
      }
      return array;
    }
  
  function runDestructors(destructors) {
      while (destructors.length) {
          var ptr = destructors.pop();
          var del = destructors.pop();
          del(ptr);
      }
    }function __embind_register_class_constructor(
      rawClassType,
      argCount,
      rawArgTypesAddr,
      invokerSignature,
      invoker,
      rawConstructor
    ) {
      assert(argCount > 0);
      var rawArgTypes = heap32VectorToArray(argCount, rawArgTypesAddr);
      invoker = embind__requireFunction(invokerSignature, invoker);
      var args = [rawConstructor];
      var destructors = [];
  
      whenDependentTypesAreResolved([], [rawClassType], function(classType) {
          classType = classType[0];
          var humanName = 'constructor ' + classType.name;
  
          if (undefined === classType.registeredClass.constructor_body) {
              classType.registeredClass.constructor_body = [];
          }
          if (undefined !== classType.registeredClass.constructor_body[argCount - 1]) {
              throw new BindingError("Cannot register multiple constructors with identical number of parameters (" + (argCount-1) + ") for class '" + classType.name + "'! Overload resolution is currently only performed using the parameter count, not actual type info!");
          }
          classType.registeredClass.constructor_body[argCount - 1] = function unboundTypeHandler() {
              throwUnboundTypeError('Cannot construct ' + classType.name + ' due to unbound types', rawArgTypes);
          };
  
          whenDependentTypesAreResolved([], rawArgTypes, function(argTypes) {
              classType.registeredClass.constructor_body[argCount - 1] = function constructor_body() {
                  if (arguments.length !== argCount - 1) {
                      throwBindingError(humanName + ' called with ' + arguments.length + ' arguments, expected ' + (argCount-1));
                  }
                  destructors.length = 0;
                  args.length = argCount;
                  for (var i = 1; i < argCount; ++i) {
                      args[i] = argTypes[i]['toWireType'](destructors, arguments[i - 1]);
                  }
  
                  var ptr = invoker.apply(null, args);
                  runDestructors(destructors);
  
                  return argTypes[0]['fromWireType'](ptr);
              };
              return [];
          });
          return [];
      });
    }

  
  
  function new_(constructor, argumentList) {
      if (!(constructor instanceof Function)) {
          throw new TypeError('new_ called with constructor type ' + typeof(constructor) + " which is not a function");
      }
  
      /*
       * Previously, the following line was just:
  
       function dummy() {};
  
       * Unfortunately, Chrome was preserving 'dummy' as the object's name, even though at creation, the 'dummy' has the
       * correct constructor name.  Thus, objects created with IMVU.new would show up in the debugger as 'dummy', which
       * isn't very helpful.  Using IMVU.createNamedFunction addresses the issue.  Doublely-unfortunately, there's no way
       * to write a test for this behavior.  -NRD 2013.02.22
       */
      var dummy = createNamedFunction(constructor.name || 'unknownFunctionName', function(){});
      dummy.prototype = constructor.prototype;
      var obj = new dummy;
  
      var r = constructor.apply(obj, argumentList);
      return (r instanceof Object) ? r : obj;
    }function craftInvokerFunction(humanName, argTypes, classType, cppInvokerFunc, cppTargetFunc) {
      // humanName: a human-readable string name for the function to be generated.
      // argTypes: An array that contains the embind type objects for all types in the function signature.
      //    argTypes[0] is the type object for the function return value.
      //    argTypes[1] is the type object for function this object/class type, or null if not crafting an invoker for a class method.
      //    argTypes[2...] are the actual function parameters.
      // classType: The embind type object for the class to be bound, or null if this is not a method of a class.
      // cppInvokerFunc: JS Function object to the C++-side function that interops into C++ code.
      // cppTargetFunc: Function pointer (an integer to FUNCTION_TABLE) to the target C++ function the cppInvokerFunc will end up calling.
      var argCount = argTypes.length;
  
      if (argCount < 2) {
          throwBindingError("argTypes array size mismatch! Must at least get return value and 'this' types!");
      }
  
      var isClassMethodFunc = (argTypes[1] !== null && classType !== null);
  
      // Free functions with signature "void function()" do not need an invoker that marshalls between wire types.
  // TODO: This omits argument count check - enable only at -O3 or similar.
  //    if (ENABLE_UNSAFE_OPTS && argCount == 2 && argTypes[0].name == "void" && !isClassMethodFunc) {
  //       return FUNCTION_TABLE[fn];
  //    }
  
  
      // Determine if we need to use a dynamic stack to store the destructors for the function parameters.
      // TODO: Remove this completely once all function invokers are being dynamically generated.
      var needsDestructorStack = false;
  
      for(var i = 1; i < argTypes.length; ++i) { // Skip return value at index 0 - it's not deleted here.
          if (argTypes[i] !== null && argTypes[i].destructorFunction === undefined) { // The type does not define a destructor function - must use dynamic stack
              needsDestructorStack = true;
              break;
          }
      }
  
      var returns = (argTypes[0].name !== "void");
  
      var argsList = "";
      var argsListWired = "";
      for(var i = 0; i < argCount - 2; ++i) {
          argsList += (i!==0?", ":"")+"arg"+i;
          argsListWired += (i!==0?", ":"")+"arg"+i+"Wired";
      }
  
      var invokerFnBody =
          "return function "+makeLegalFunctionName(humanName)+"("+argsList+") {\n" +
          "if (arguments.length !== "+(argCount - 2)+") {\n" +
              "throwBindingError('function "+humanName+" called with ' + arguments.length + ' arguments, expected "+(argCount - 2)+" args!');\n" +
          "}\n";
  
  
      if (needsDestructorStack) {
          invokerFnBody +=
              "var destructors = [];\n";
      }
  
      var dtorStack = needsDestructorStack ? "destructors" : "null";
      var args1 = ["throwBindingError", "invoker", "fn", "runDestructors", "retType", "classParam"];
      var args2 = [throwBindingError, cppInvokerFunc, cppTargetFunc, runDestructors, argTypes[0], argTypes[1]];
  
  
      if (isClassMethodFunc) {
          invokerFnBody += "var thisWired = classParam.toWireType("+dtorStack+", this);\n";
      }
  
      for(var i = 0; i < argCount - 2; ++i) {
          invokerFnBody += "var arg"+i+"Wired = argType"+i+".toWireType("+dtorStack+", arg"+i+"); // "+argTypes[i+2].name+"\n";
          args1.push("argType"+i);
          args2.push(argTypes[i+2]);
      }
  
      if (isClassMethodFunc) {
          argsListWired = "thisWired" + (argsListWired.length > 0 ? ", " : "") + argsListWired;
      }
  
      invokerFnBody +=
          (returns?"var rv = ":"") + "invoker(fn"+(argsListWired.length>0?", ":"")+argsListWired+");\n";
  
      if (needsDestructorStack) {
          invokerFnBody += "runDestructors(destructors);\n";
      } else {
          for(var i = isClassMethodFunc?1:2; i < argTypes.length; ++i) { // Skip return value at index 0 - it's not deleted here. Also skip class type if not a method.
              var paramName = (i === 1 ? "thisWired" : ("arg"+(i - 2)+"Wired"));
              if (argTypes[i].destructorFunction !== null) {
                  invokerFnBody += paramName+"_dtor("+paramName+"); // "+argTypes[i].name+"\n";
                  args1.push(paramName+"_dtor");
                  args2.push(argTypes[i].destructorFunction);
              }
          }
      }
  
      if (returns) {
          invokerFnBody += "var ret = retType.fromWireType(rv);\n" +
                           "return ret;\n";
      } else {
      }
      invokerFnBody += "}\n";
  
      args1.push(invokerFnBody);
  
      var invokerFunction = new_(Function, args1).apply(null, args2);
      return invokerFunction;
    }function __embind_register_class_function(
      rawClassType,
      methodName,
      argCount,
      rawArgTypesAddr, // [ReturnType, ThisType, Args...]
      invokerSignature,
      rawInvoker,
      context,
      isPureVirtual
    ) {
      var rawArgTypes = heap32VectorToArray(argCount, rawArgTypesAddr);
      methodName = readLatin1String(methodName);
      rawInvoker = embind__requireFunction(invokerSignature, rawInvoker);
  
      whenDependentTypesAreResolved([], [rawClassType], function(classType) {
          classType = classType[0];
          var humanName = classType.name + '.' + methodName;
  
          if (isPureVirtual) {
              classType.registeredClass.pureVirtualFunctions.push(methodName);
          }
  
          function unboundTypesHandler() {
              throwUnboundTypeError('Cannot call ' + humanName + ' due to unbound types', rawArgTypes);
          }
  
          var proto = classType.registeredClass.instancePrototype;
          var method = proto[methodName];
          if (undefined === method || (undefined === method.overloadTable && method.className !== classType.name && method.argCount === argCount - 2)) {
              // This is the first overload to be registered, OR we are replacing a function in the base class with a function in the derived class.
              unboundTypesHandler.argCount = argCount - 2;
              unboundTypesHandler.className = classType.name;
              proto[methodName] = unboundTypesHandler;
          } else {
              // There was an existing function with the same name registered. Set up a function overload routing table.
              ensureOverloadTable(proto, methodName, humanName);
              proto[methodName].overloadTable[argCount - 2] = unboundTypesHandler;
          }
  
          whenDependentTypesAreResolved([], rawArgTypes, function(argTypes) {
  
              var memberFunction = craftInvokerFunction(humanName, argTypes, classType, rawInvoker, context);
  
              // Replace the initial unbound-handler-stub function with the appropriate member function, now that all types
              // are resolved. If multiple overloads are registered for this function, the function goes into an overload table.
              if (undefined === proto[methodName].overloadTable) {
                  // Set argCount in case an overload is registered later
                  memberFunction.argCount = argCount - 2;
                  proto[methodName] = memberFunction;
              } else {
                  proto[methodName].overloadTable[argCount - 2] = memberFunction;
              }
  
              return [];
          });
          return [];
      });
    }

  
  
  var emval_free_list=[];
  
  var emval_handle_array=[{},{value:undefined},{value:null},{value:true},{value:false}];function __emval_decref(handle) {
      if (handle > 4 && 0 === --emval_handle_array[handle].refcount) {
          emval_handle_array[handle] = undefined;
          emval_free_list.push(handle);
      }
    }
  
  
  
  function count_emval_handles() {
      var count = 0;
      for (var i = 5; i < emval_handle_array.length; ++i) {
          if (emval_handle_array[i] !== undefined) {
              ++count;
          }
      }
      return count;
    }
  
  function get_first_emval() {
      for (var i = 5; i < emval_handle_array.length; ++i) {
          if (emval_handle_array[i] !== undefined) {
              return emval_handle_array[i];
          }
      }
      return null;
    }function init_emval() {
      Module['count_emval_handles'] = count_emval_handles;
      Module['get_first_emval'] = get_first_emval;
    }function __emval_register(value) {
  
      switch(value){
        case undefined :{ return 1; }
        case null :{ return 2; }
        case true :{ return 3; }
        case false :{ return 4; }
        default:{
          var handle = emval_free_list.length ?
              emval_free_list.pop() :
              emval_handle_array.length;
  
          emval_handle_array[handle] = {refcount: 1, value: value};
          return handle;
          }
        }
    }function __embind_register_emval(rawType, name) {
      name = readLatin1String(name);
      registerType(rawType, {
          name: name,
          'fromWireType': function(handle) {
              var rv = emval_handle_array[handle].value;
              __emval_decref(handle);
              return rv;
          },
          'toWireType': function(destructors, value) {
              return __emval_register(value);
          },
          'argPackAdvance': 8,
          'readValueFromPointer': simpleReadValueFromPointer,
          destructorFunction: null, // This type does not need a destructor
  
          // TODO: do we need a deleteObject here?  write a test where
          // emval is passed into JS via an interface
      });
    }

  
  function _embind_repr(v) {
      if (v === null) {
          return 'null';
      }
      var t = typeof v;
      if (t === 'object' || t === 'array' || t === 'function') {
          return v.toString();
      } else {
          return '' + v;
      }
    }
  
  function floatReadValueFromPointer(name, shift) {
      switch (shift) {
          case 2: return function(pointer) {
              return this['fromWireType'](HEAPF32[pointer >> 2]);
          };
          case 3: return function(pointer) {
              return this['fromWireType'](HEAPF64[pointer >> 3]);
          };
          default:
              throw new TypeError("Unknown float type: " + name);
      }
    }function __embind_register_float(rawType, name, size) {
      var shift = getShiftFromSize(size);
      name = readLatin1String(name);
      registerType(rawType, {
          name: name,
          'fromWireType': function(value) {
              return value;
          },
          'toWireType': function(destructors, value) {
              // todo: Here we have an opportunity for -O3 level "unsafe" optimizations: we could
              // avoid the following if() and assume value is of proper type.
              if (typeof value !== "number" && typeof value !== "boolean") {
                  throw new TypeError('Cannot convert "' + _embind_repr(value) + '" to ' + this.name);
              }
              return value;
          },
          'argPackAdvance': 8,
          'readValueFromPointer': floatReadValueFromPointer(name, shift),
          destructorFunction: null, // This type does not need a destructor
      });
    }

  
  function integerReadValueFromPointer(name, shift, signed) {
      // integers are quite common, so generate very specialized functions
      switch (shift) {
          case 0: return signed ?
              function readS8FromPointer(pointer) { return HEAP8[pointer]; } :
              function readU8FromPointer(pointer) { return HEAPU8[pointer]; };
          case 1: return signed ?
              function readS16FromPointer(pointer) { return HEAP16[pointer >> 1]; } :
              function readU16FromPointer(pointer) { return HEAPU16[pointer >> 1]; };
          case 2: return signed ?
              function readS32FromPointer(pointer) { return HEAP32[pointer >> 2]; } :
              function readU32FromPointer(pointer) { return HEAPU32[pointer >> 2]; };
          default:
              throw new TypeError("Unknown integer type: " + name);
      }
    }function __embind_register_integer(primitiveType, name, size, minRange, maxRange) {
      name = readLatin1String(name);
      if (maxRange === -1) { // LLVM doesn't have signed and unsigned 32-bit types, so u32 literals come out as 'i32 -1'. Always treat those as max u32.
          maxRange = 4294967295;
      }
  
      var shift = getShiftFromSize(size);
  
      var fromWireType = function(value) {
          return value;
      };
  
      if (minRange === 0) {
          var bitshift = 32 - 8*size;
          fromWireType = function(value) {
              return (value << bitshift) >>> bitshift;
          };
      }
  
      var isUnsignedType = (name.indexOf('unsigned') != -1);
  
      registerType(primitiveType, {
          name: name,
          'fromWireType': fromWireType,
          'toWireType': function(destructors, value) {
              // todo: Here we have an opportunity for -O3 level "unsafe" optimizations: we could
              // avoid the following two if()s and assume value is of proper type.
              if (typeof value !== "number" && typeof value !== "boolean") {
                  throw new TypeError('Cannot convert "' + _embind_repr(value) + '" to ' + this.name);
              }
              if (value < minRange || value > maxRange) {
                  throw new TypeError('Passing a number "' + _embind_repr(value) + '" from JS side to C/C++ side to an argument of type "' + name + '", which is outside the valid range [' + minRange + ', ' + maxRange + ']!');
              }
              return isUnsignedType ? (value >>> 0) : (value | 0);
          },
          'argPackAdvance': 8,
          'readValueFromPointer': integerReadValueFromPointer(name, shift, minRange !== 0),
          destructorFunction: null, // This type does not need a destructor
      });
    }

  function __embind_register_memory_view(rawType, dataTypeIndex, name) {
      var typeMapping = [
          Int8Array,
          Uint8Array,
          Int16Array,
          Uint16Array,
          Int32Array,
          Uint32Array,
          Float32Array,
          Float64Array,
      ];
  
      var TA = typeMapping[dataTypeIndex];
  
      function decodeMemoryView(handle) {
          handle = handle >> 2;
          var heap = HEAPU32;
          var size = heap[handle]; // in elements
          var data = heap[handle + 1]; // byte offset into emscripten heap
          return new TA(heap['buffer'], data, size);
      }
  
      name = readLatin1String(name);
      registerType(rawType, {
          name: name,
          'fromWireType': decodeMemoryView,
          'argPackAdvance': 8,
          'readValueFromPointer': decodeMemoryView,
      }, {
          ignoreDuplicateRegistrations: true,
      });
    }

  function __embind_register_std_string(rawType, name) {
      name = readLatin1String(name);
      var stdStringIsUTF8
      //process only std::string bindings with UTF8 support, in contrast to e.g. std::basic_string<unsigned char>
      = (name === "std::string");
  
      registerType(rawType, {
          name: name,
          'fromWireType': function(value) {
              var length = HEAPU32[value >> 2];
  
              var str;
              if(stdStringIsUTF8) {
                  //ensure null termination at one-past-end byte if not present yet
                  var endChar = HEAPU8[value + 4 + length];
                  var endCharSwap = 0;
                  if(endChar != 0)
                  {
                    endCharSwap = endChar;
                    HEAPU8[value + 4 + length] = 0;
                  }
  
                  var decodeStartPtr = value + 4;
                  //looping here to support possible embedded '0' bytes
                  for (var i = 0; i <= length; ++i) {
                    var currentBytePtr = value + 4 + i;
                    if(HEAPU8[currentBytePtr] == 0)
                    {
                      var stringSegment = UTF8ToString(decodeStartPtr);
                      if(str === undefined)
                        str = stringSegment;
                      else
                      {
                        str += String.fromCharCode(0);
                        str += stringSegment;
                      }
                      decodeStartPtr = currentBytePtr + 1;
                    }
                  }
  
                  if(endCharSwap != 0)
                    HEAPU8[value + 4 + length] = endCharSwap;
              } else {
                  var a = new Array(length);
                  for (var i = 0; i < length; ++i) {
                      a[i] = String.fromCharCode(HEAPU8[value + 4 + i]);
                  }
                  str = a.join('');
              }
  
              _free(value);
  
              return str;
          },
          'toWireType': function(destructors, value) {
              if (value instanceof ArrayBuffer) {
                  value = new Uint8Array(value);
              }
  
              var getLength;
              var valueIsOfTypeString = (typeof value === 'string');
  
              if (!(valueIsOfTypeString || value instanceof Uint8Array || value instanceof Uint8ClampedArray || value instanceof Int8Array)) {
                  throwBindingError('Cannot pass non-string to std::string');
              }
              if (stdStringIsUTF8 && valueIsOfTypeString) {
                  getLength = function() {return lengthBytesUTF8(value);};
              } else {
                  getLength = function() {return value.length;};
              }
  
              // assumes 4-byte alignment
              var length = getLength();
              var ptr = _malloc(4 + length + 1);
              HEAPU32[ptr >> 2] = length;
  
              if (stdStringIsUTF8 && valueIsOfTypeString) {
                  stringToUTF8(value, ptr + 4, length + 1);
              } else {
                  if(valueIsOfTypeString) {
                      for (var i = 0; i < length; ++i) {
                          var charCode = value.charCodeAt(i);
                          if (charCode > 255) {
                              _free(ptr);
                              throwBindingError('String has UTF-16 code units that do not fit in 8 bits');
                          }
                          HEAPU8[ptr + 4 + i] = charCode;
                      }
                  } else {
                      for (var i = 0; i < length; ++i) {
                          HEAPU8[ptr + 4 + i] = value[i];
                      }
                  }
              }
  
              if (destructors !== null) {
                  destructors.push(_free, ptr);
              }
              return ptr;
          },
          'argPackAdvance': 8,
          'readValueFromPointer': simpleReadValueFromPointer,
          destructorFunction: function(ptr) { _free(ptr); },
      });
    }

  function __embind_register_std_wstring(rawType, charSize, name) {
      name = readLatin1String(name);
      var decodeString, encodeString, getHeap, lengthBytesUTF, shift;
      if (charSize === 2) {
          decodeString = UTF16ToString;
          encodeString = stringToUTF16;
          lengthBytesUTF = lengthBytesUTF16;
          getHeap = function() { return HEAPU16; };
          shift = 1;
      } else if (charSize === 4) {
          decodeString = UTF32ToString;
          encodeString = stringToUTF32;
          lengthBytesUTF = lengthBytesUTF32
          getHeap = function() { return HEAPU32; };
          shift = 2;
      }
      registerType(rawType, {
          name: name,
          'fromWireType': function(value) {
              // Code mostly taken from _embind_register_std_string fromWireType
              var length = HEAPU32[value >> 2];
              var HEAP = getHeap();
              var str;
              //ensure null termination at one-past-end byte if not present yet
              var endChar = HEAP[(value + 4 + length * charSize) >> shift];
              var endCharSwap = 0;
              if(endChar != 0)
              {
                  endCharSwap = endChar;
                  HEAP[(value + 4 + length * charSize) >> shift] = 0;
              }
  
              var decodeStartPtr = value + 4;
              //looping here to support possible embedded '0' bytes
              for (var i = 0; i <= length; ++i) {
                  var currentBytePtr = value + 4 + i * charSize;
                  if(HEAP[currentBytePtr >> shift] == 0)
                  {
                      var stringSegment = decodeString(decodeStartPtr);
                      if(str === undefined)
                          str = stringSegment;
                      else
                      {
                          str += String.fromCharCode(0);
                          str += stringSegment;
                      }
                      decodeStartPtr = currentBytePtr + charSize;
                  }
              }
  
              if(endCharSwap != 0)
                  HEAP[(value + 4 + length * charSize) >> shift] = endCharSwap;
  
              _free(value);
  
              return str;
          },
          'toWireType': function(destructors, value) {
              if (!(typeof value === 'string')) {
                  throwBindingError('Cannot pass non-string to C++ string type ' + name);
              }
  
              // assumes 4-byte alignment
              var length = lengthBytesUTF(value);
              var ptr = _malloc(4 + length + charSize);
              HEAPU32[ptr >> 2] = length >> shift;
  
              encodeString(value, ptr + 4, length + charSize);
  
              if (destructors !== null) {
                  destructors.push(_free, ptr);
              }
              return ptr;
          },
          'argPackAdvance': 8,
          'readValueFromPointer': simpleReadValueFromPointer,
          destructorFunction: function(ptr) { _free(ptr); },
      });
    }

  function __embind_register_void(rawType, name) {
      name = readLatin1String(name);
      registerType(rawType, {
          isVoid: true, // void return values can be optimized out sometimes
          name: name,
          'argPackAdvance': 0,
          'fromWireType': function() {
              return undefined;
          },
          'toWireType': function(destructors, o) {
              // TODO: assert if anything else is given?
              return undefined;
          },
      });
    }

  function _abort() {
      abort();
    }

  function _emscripten_get_heap_size() {
      return HEAPU8.length;
    }

  function _emscripten_get_sbrk_ptr() {
      return 28096;
    }

  function _emscripten_memcpy_big(dest, src, num) {
      HEAPU8.set(HEAPU8.subarray(src, src+num), dest);
    }

  
  function emscripten_realloc_buffer(size) {
      try {
        // round size grow request up to wasm page size (fixed 64KB per spec)
        wasmMemory.grow((size - buffer.byteLength + 65535) >> 16); // .grow() takes a delta compared to the previous size
        updateGlobalBufferAndViews(wasmMemory.buffer);
        return 1 /*success*/;
      } catch(e) {
      }
    }function _emscripten_resize_heap(requestedSize) {
      var oldSize = _emscripten_get_heap_size();
      // With pthreads, races can happen (another thread might increase the size in between), so return a failure, and let the caller retry.
  
  
      var PAGE_MULTIPLE = 65536;
  
      // Memory resize rules:
      // 1. When resizing, always produce a resized heap that is at least 16MB (to avoid tiny heap sizes receiving lots of repeated resizes at startup)
      // 2. Always increase heap size to at least the requested size, rounded up to next page multiple.
      // 3a. If MEMORY_GROWTH_LINEAR_STEP == -1, excessively resize the heap geometrically: increase the heap size according to 
      //                                         MEMORY_GROWTH_GEOMETRIC_STEP factor (default +20%),
      //                                         At most overreserve by MEMORY_GROWTH_GEOMETRIC_CAP bytes (default 96MB).
      // 3b. If MEMORY_GROWTH_LINEAR_STEP != -1, excessively resize the heap linearly: increase the heap size by at least MEMORY_GROWTH_LINEAR_STEP bytes.
      // 4. Max size for the heap is capped at 2048MB-PAGE_MULTIPLE, or by WASM_MEM_MAX, or by ASAN limit, depending on which is smallest
      // 5. If we were unable to allocate as much memory, it may be due to over-eager decision to excessively reserve due to (3) above.
      //    Hence if an allocation fails, cut down on the amount of excess growth, in an attempt to succeed to perform a smaller allocation.
  
      var maxHeapSize = 2147483648 - PAGE_MULTIPLE;
      if (requestedSize > maxHeapSize) {
        return false;
      }
  
      var minHeapSize = 16777216;
  
      // Loop through potential heap size increases. If we attempt a too eager reservation that fails, cut down on the
      // attempted size and reserve a smaller bump instead. (max 3 times, chosen somewhat arbitrarily)
      for(var cutDown = 1; cutDown <= 4; cutDown *= 2) {
        var overGrownHeapSize = oldSize * (1 + 0.2 / cutDown); // ensure geometric growth
        // but limit overreserving (default to capping at +96MB overgrowth at most)
        overGrownHeapSize = Math.min(overGrownHeapSize, requestedSize + 100663296 );
  
  
        var newSize = Math.min(maxHeapSize, alignUp(Math.max(minHeapSize, requestedSize, overGrownHeapSize), PAGE_MULTIPLE));
  
        var replacement = emscripten_realloc_buffer(newSize);
        if (replacement) {
  
          return true;
        }
      }
      return false;
    }

  
  function _memcpy(dest, src, num) {
      dest = dest|0; src = src|0; num = num|0;
      var ret = 0;
      var aligned_dest_end = 0;
      var block_aligned_dest_end = 0;
      var dest_end = 0;
      // Test against a benchmarked cutoff limit for when HEAPU8.set() becomes faster to use.
      if ((num|0) >= 8192) {
        _emscripten_memcpy_big(dest|0, src|0, num|0)|0;
        return dest|0;
      }
  
      ret = dest|0;
      dest_end = (dest + num)|0;
      if ((dest&3) == (src&3)) {
        // The initial unaligned < 4-byte front.
        while (dest & 3) {
          if ((num|0) == 0) return ret|0;
          HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
          dest = (dest+1)|0;
          src = (src+1)|0;
          num = (num-1)|0;
        }
        aligned_dest_end = (dest_end & -4)|0;
        block_aligned_dest_end = (aligned_dest_end - 64)|0;
        while ((dest|0) <= (block_aligned_dest_end|0) ) {
          HEAP32[((dest)>>2)]=((HEAP32[((src)>>2)])|0);
          HEAP32[(((dest)+(4))>>2)]=((HEAP32[(((src)+(4))>>2)])|0);
          HEAP32[(((dest)+(8))>>2)]=((HEAP32[(((src)+(8))>>2)])|0);
          HEAP32[(((dest)+(12))>>2)]=((HEAP32[(((src)+(12))>>2)])|0);
          HEAP32[(((dest)+(16))>>2)]=((HEAP32[(((src)+(16))>>2)])|0);
          HEAP32[(((dest)+(20))>>2)]=((HEAP32[(((src)+(20))>>2)])|0);
          HEAP32[(((dest)+(24))>>2)]=((HEAP32[(((src)+(24))>>2)])|0);
          HEAP32[(((dest)+(28))>>2)]=((HEAP32[(((src)+(28))>>2)])|0);
          HEAP32[(((dest)+(32))>>2)]=((HEAP32[(((src)+(32))>>2)])|0);
          HEAP32[(((dest)+(36))>>2)]=((HEAP32[(((src)+(36))>>2)])|0);
          HEAP32[(((dest)+(40))>>2)]=((HEAP32[(((src)+(40))>>2)])|0);
          HEAP32[(((dest)+(44))>>2)]=((HEAP32[(((src)+(44))>>2)])|0);
          HEAP32[(((dest)+(48))>>2)]=((HEAP32[(((src)+(48))>>2)])|0);
          HEAP32[(((dest)+(52))>>2)]=((HEAP32[(((src)+(52))>>2)])|0);
          HEAP32[(((dest)+(56))>>2)]=((HEAP32[(((src)+(56))>>2)])|0);
          HEAP32[(((dest)+(60))>>2)]=((HEAP32[(((src)+(60))>>2)])|0);
          dest = (dest+64)|0;
          src = (src+64)|0;
        }
        while ((dest|0) < (aligned_dest_end|0) ) {
          HEAP32[((dest)>>2)]=((HEAP32[((src)>>2)])|0);
          dest = (dest+4)|0;
          src = (src+4)|0;
        }
      } else {
        // In the unaligned copy case, unroll a bit as well.
        aligned_dest_end = (dest_end - 4)|0;
        while ((dest|0) < (aligned_dest_end|0) ) {
          HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
          HEAP8[(((dest)+(1))>>0)]=((HEAP8[(((src)+(1))>>0)])|0);
          HEAP8[(((dest)+(2))>>0)]=((HEAP8[(((src)+(2))>>0)])|0);
          HEAP8[(((dest)+(3))>>0)]=((HEAP8[(((src)+(3))>>0)])|0);
          dest = (dest+4)|0;
          src = (src+4)|0;
        }
      }
      // The remaining unaligned < 4 byte tail.
      while ((dest|0) < (dest_end|0)) {
        HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
        dest = (dest+1)|0;
        src = (src+1)|0;
      }
      return ret|0;
    }

  function _memset(ptr, value, num) {
      ptr = ptr|0; value = value|0; num = num|0;
      var end = 0, aligned_end = 0, block_aligned_end = 0, value4 = 0;
      end = (ptr + num)|0;
  
      value = value & 0xff;
      if ((num|0) >= 67 /* 64 bytes for an unrolled loop + 3 bytes for unaligned head*/) {
        while ((ptr&3) != 0) {
          HEAP8[((ptr)>>0)]=value;
          ptr = (ptr+1)|0;
        }
  
        aligned_end = (end & -4)|0;
        value4 = value | (value << 8) | (value << 16) | (value << 24);
  
        block_aligned_end = (aligned_end - 64)|0;
  
        while((ptr|0) <= (block_aligned_end|0)) {
          HEAP32[((ptr)>>2)]=value4;
          HEAP32[(((ptr)+(4))>>2)]=value4;
          HEAP32[(((ptr)+(8))>>2)]=value4;
          HEAP32[(((ptr)+(12))>>2)]=value4;
          HEAP32[(((ptr)+(16))>>2)]=value4;
          HEAP32[(((ptr)+(20))>>2)]=value4;
          HEAP32[(((ptr)+(24))>>2)]=value4;
          HEAP32[(((ptr)+(28))>>2)]=value4;
          HEAP32[(((ptr)+(32))>>2)]=value4;
          HEAP32[(((ptr)+(36))>>2)]=value4;
          HEAP32[(((ptr)+(40))>>2)]=value4;
          HEAP32[(((ptr)+(44))>>2)]=value4;
          HEAP32[(((ptr)+(48))>>2)]=value4;
          HEAP32[(((ptr)+(52))>>2)]=value4;
          HEAP32[(((ptr)+(56))>>2)]=value4;
          HEAP32[(((ptr)+(60))>>2)]=value4;
          ptr = (ptr + 64)|0;
        }
  
        while ((ptr|0) < (aligned_end|0) ) {
          HEAP32[((ptr)>>2)]=value4;
          ptr = (ptr+4)|0;
        }
      }
      // The remaining bytes.
      while ((ptr|0) < (end|0)) {
        HEAP8[((ptr)>>0)]=value;
        ptr = (ptr+1)|0;
      }
      return (end-num)|0;
    }
embind_init_charCodes();
BindingError = Module['BindingError'] = extendError(Error, 'BindingError');;
InternalError = Module['InternalError'] = extendError(Error, 'InternalError');;
init_ClassHandle();
init_RegisteredPointer();
init_embind();;
UnboundTypeError = Module['UnboundTypeError'] = extendError(Error, 'UnboundTypeError');;
init_emval();;
var ASSERTIONS = false;

// Copyright 2017 The Emscripten Authors.  All rights reserved.
// Emscripten is available under two separate licenses, the MIT license and the
// University of Illinois/NCSA Open Source License.  Both these licenses can be
// found in the LICENSE file.

/** @type {function(string, boolean=, number=)} */
function intArrayFromString(stringy, dontAddNull, length) {
  var len = length > 0 ? length : lengthBytesUTF8(stringy)+1;
  var u8array = new Array(len);
  var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
  if (dontAddNull) u8array.length = numBytesWritten;
  return u8array;
}

function intArrayToString(array) {
  var ret = [];
  for (var i = 0; i < array.length; i++) {
    var chr = array[i];
    if (chr > 0xFF) {
      if (ASSERTIONS) {
        assert(false, 'Character code ' + chr + ' (' + String.fromCharCode(chr) + ')  at offset ' + i + ' not in 0x00-0xFF.');
      }
      chr &= 0xFF;
    }
    ret.push(String.fromCharCode(chr));
  }
  return ret.join('');
}


// Copied from https://github.com/strophe/strophejs/blob/e06d027/src/polyfills.js#L149

// This code was written by Tyler Akins and has been placed in the
// public domain.  It would be nice if you left this header intact.
// Base64 code from Tyler Akins -- http://rumkin.com

/**
 * Decodes a base64 string.
 * @param {String} input The string to decode.
 */
var decodeBase64 = typeof atob === 'function' ? atob : function (input) {
  var keyStr = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

  var output = '';
  var chr1, chr2, chr3;
  var enc1, enc2, enc3, enc4;
  var i = 0;
  // remove all characters that are not A-Z, a-z, 0-9, +, /, or =
  input = input.replace(/[^A-Za-z0-9\+\/\=]/g, '');
  do {
    enc1 = keyStr.indexOf(input.charAt(i++));
    enc2 = keyStr.indexOf(input.charAt(i++));
    enc3 = keyStr.indexOf(input.charAt(i++));
    enc4 = keyStr.indexOf(input.charAt(i++));

    chr1 = (enc1 << 2) | (enc2 >> 4);
    chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    chr3 = ((enc3 & 3) << 6) | enc4;

    output = output + String.fromCharCode(chr1);

    if (enc3 !== 64) {
      output = output + String.fromCharCode(chr2);
    }
    if (enc4 !== 64) {
      output = output + String.fromCharCode(chr3);
    }
  } while (i < input.length);
  return output;
};

// Converts a string of base64 into a byte array.
// Throws error on invalid input.
function intArrayFromBase64(s) {
  if (typeof ENVIRONMENT_IS_NODE === 'boolean' && ENVIRONMENT_IS_NODE) {
    var buf;
    try {
      buf = Buffer.from(s, 'base64');
    } catch (_) {
      buf = new Buffer(s, 'base64');
    }
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }

  try {
    var decoded = decodeBase64(s);
    var bytes = new Uint8Array(decoded.length);
    for (var i = 0 ; i < decoded.length ; ++i) {
      bytes[i] = decoded.charCodeAt(i);
    }
    return bytes;
  } catch (_) {
    throw new Error('Converting base64 string to bytes failed.');
  }
}

// If filename is a base64 data URI, parses and returns data (Buffer on node,
// Uint8Array otherwise). If filename is not a base64 data URI, returns undefined.
function tryParseAsDataURI(filename) {
  if (!isDataURI(filename)) {
    return;
  }

  return intArrayFromBase64(filename.slice(dataURIPrefix.length));
}


// ASM_LIBRARY EXTERN PRIMITIVES: Int8Array,Int32Array

var asmGlobalArg = {};
var asmLibraryArg = { "_embind_register_bool": __embind_register_bool, "_embind_register_class": __embind_register_class, "_embind_register_class_constructor": __embind_register_class_constructor, "_embind_register_class_function": __embind_register_class_function, "_embind_register_emval": __embind_register_emval, "_embind_register_float": __embind_register_float, "_embind_register_integer": __embind_register_integer, "_embind_register_memory_view": __embind_register_memory_view, "_embind_register_std_string": __embind_register_std_string, "_embind_register_std_wstring": __embind_register_std_wstring, "_embind_register_void": __embind_register_void, "abort": _abort, "emscripten_get_sbrk_ptr": _emscripten_get_sbrk_ptr, "emscripten_memcpy_big": _emscripten_memcpy_big, "emscripten_resize_heap": _emscripten_resize_heap, "memory": wasmMemory, "table": wasmTable };
var asm = createWasm();
var ___wasm_call_ctors = Module["___wasm_call_ctors"] = asm["__wasm_call_ctors"];
var ___errno_location = Module["___errno_location"] = asm["__errno_location"];
var _setThrew = Module["_setThrew"] = asm["setThrew"];
var _malloc = Module["_malloc"] = asm["malloc"];
var _free = Module["_free"] = asm["free"];
var ___getTypeName = Module["___getTypeName"] = asm["__getTypeName"];
var ___embind_register_native_and_builtin_types = Module["___embind_register_native_and_builtin_types"] = asm["__embind_register_native_and_builtin_types"];
var stackSave = Module["stackSave"] = asm["stackSave"];
var stackAlloc = Module["stackAlloc"] = asm["stackAlloc"];
var stackRestore = Module["stackRestore"] = asm["stackRestore"];
var __growWasmMemory = Module["__growWasmMemory"] = asm["__growWasmMemory"];
var dynCall_ii = Module["dynCall_ii"] = asm["dynCall_ii"];
var dynCall_vi = Module["dynCall_vi"] = asm["dynCall_vi"];
var dynCall_i = Module["dynCall_i"] = asm["dynCall_i"];
var dynCall_di = Module["dynCall_di"] = asm["dynCall_di"];
var dynCall_dii = Module["dynCall_dii"] = asm["dynCall_dii"];
var dynCall_vid = Module["dynCall_vid"] = asm["dynCall_vid"];
var dynCall_viid = Module["dynCall_viid"] = asm["dynCall_viid"];
var dynCall_viii = Module["dynCall_viii"] = asm["dynCall_viii"];
var dynCall_viiii = Module["dynCall_viiii"] = asm["dynCall_viiii"];
var dynCall_iiii = Module["dynCall_iiii"] = asm["dynCall_iiii"];
var dynCall_viiiiii = Module["dynCall_viiiiii"] = asm["dynCall_viiiiii"];
var dynCall_viiiii = Module["dynCall_viiiii"] = asm["dynCall_viiiii"];



// === Auto-generated postamble setup entry stuff ===

Module['asm'] = asm;
































































































































































































































































































































var calledRun;


/**
 * @constructor
 * @this {ExitStatus}
 */
function ExitStatus(status) {
  this.name = "ExitStatus";
  this.message = "Program terminated with exit(" + status + ")";
  this.status = status;
}

var calledMain = false;


dependenciesFulfilled = function runCaller() {
  // If run has never been called, and we should call run (INVOKE_RUN is true, and Module.noInitialRun is not false)
  if (!calledRun) run();
  if (!calledRun) dependenciesFulfilled = runCaller; // try this again later, after new deps are fulfilled
};





/** @type {function(Array=)} */
function run(args) {
  args = args || arguments_;

  if (runDependencies > 0) {
    return;
  }


  preRun();

  if (runDependencies > 0) return; // a preRun added a dependency, run will be called later

  function doRun() {
    // run may have just been called through dependencies being fulfilled just in this very frame,
    // or while the async setStatus time below was happening
    if (calledRun) return;
    calledRun = true;

    if (ABORT) return;

    initRuntime();

    preMain();

    if (Module['onRuntimeInitialized']) Module['onRuntimeInitialized']();


    postRun();
  }

  if (Module['setStatus']) {
    Module['setStatus']('Running...');
    setTimeout(function() {
      setTimeout(function() {
        Module['setStatus']('');
      }, 1);
      doRun();
    }, 1);
  } else
  {
    doRun();
  }
}
Module['run'] = run;


function exit(status, implicit) {

  // if this is just main exit-ing implicitly, and the status is 0, then we
  // don't need to do anything here and can just leave. if the status is
  // non-zero, though, then we need to report it.
  // (we may have warned about this earlier, if a situation justifies doing so)
  if (implicit && noExitRuntime && status === 0) {
    return;
  }

  if (noExitRuntime) {
  } else {

    ABORT = true;
    EXITSTATUS = status;

    exitRuntime();

    if (Module['onExit']) Module['onExit'](status);
  }

  quit_(status, new ExitStatus(status));
}

if (Module['preInit']) {
  if (typeof Module['preInit'] == 'function') Module['preInit'] = [Module['preInit']];
  while (Module['preInit'].length > 0) {
    Module['preInit'].pop()();
  }
}


  noExitRuntime = true;

run();





// {{MODULE_ADDITIONS}}



/* global Module */

"use strict";

console.log(
	"running%c Open303 (Wasm)",
	"font-weight: bold; background: #222; color: #bada55"
);



//NOTE: This is the main thing that post.js adds to the setup, a Module export definition which is required for the WASM design pattern
export default Module;

