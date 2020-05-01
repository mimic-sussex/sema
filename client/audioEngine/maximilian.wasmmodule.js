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
var Module = typeof Maximilian !== 'undefined' ? Maximilian : {};

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
  'initial': 945,
  'maximum': 945 + 0,
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
    STACK_BASE = 5296784,
    STACKTOP = STACK_BASE,
    STACK_MAX = 53904,
    DYNAMIC_BASE = 5296784,
    DYNAMICTOP_PTR = 53744;




var TOTAL_STACK = 5242880;

var INITIAL_TOTAL_MEMORY = Module['TOTAL_MEMORY'] || 134217728;







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
  if (!Module["noFSInit"] && !FS.init.initialized) FS.init();
TTY.init();
  callRuntimeCallbacks(__ATINIT__);
}

function preMain() {
  FS.ignorePermissions = false;
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




var wasmBinaryFile = 'data:application/octet-stream;base64,AGFzbQEAAAAB7QqiAWABfwF/YAF/AGACf38AYAJ/fwF/YAN/f38Bf2ADf39/AGAFf39/f38Bf2AAAGAEf39/fwF/YAZ/f39/f38Bf2AFf39/f38AYAR/f39/AGAAAX9gBn9/f39/fwBgCH9/f39/f39/AX9gAn98AGABfwF8YAJ/fAF8YAJ8fAF8YAN/fHwBfGAHf39/f39/fwF/YAR/fHx8AXxgAXwBfGAHf39/f39/fwBgAn9/AXxgBH9/f3wAYAN/f3wAYAV/fn5+fgBgA39+fwF+YAF9AX1gA39/fwF8YAR/fHx/AXxgCn9/f39/f39/f38AYAN/fH8AYAV/f39/fgF/YAN/fH8BfGAFf39+f38AYAZ/f3x8fH8AYAV/f39/fAF/YAR/f39/AX5gAX8BfWACf38BfWAEf398fwF8YAV/f3x8fwF8YAZ/fH98fHwBfGAFf3x8f3wBfGAFf3x8fH8BfGAGf3x8fHx8AXxgCH9/f39/f39/AGAHf39/f398fABgBn9/f398fABgBH9/f30AYAZ/f319f38AYAR/f3x/AGAFf398f3wAYAZ/f3x/fHwAYAd/f3x/fHx8AGAEf398fABgBH9+fn8AYAV/fX1/fwBgBH98f3wAYAV/fH98fABgBn98f3x8fABgA398fABgBX98fHx/AGAKf39/f39/f39/fwF/YAd/f39/f35+AX9gBn9/f39+fgF/YAR/f398AX9gBH9/fX8Bf2ADf31/AX9gBn98f39/fwF/YAR/f39/AX1gBX9/f39/AX1gBH9/f38BfGADf398AXxgBX9/fH9/AXxgBX9/fH98AXxgBn9/fH98fwF8YAd/f3x/fHx8AXxgBH9/fHwBfGAGf398fH98AXxgB39/fHx/fHwBfGAFf398fHwBfGAGf398fHx/AXxgB39/fHx8f38BfGAHf398fHx/fAF8YAd/f3x8fHx8AXxgCX9/fHx8fHx/fwF8YAR/fH9/AXxgBH98f3wBfGAFf3x/fH8BfGAGf3x8f3x8AXxgBn98fHx/fwF8YAZ/fHx8f3wBfGAIf3x8fHx8f38BfGAPf39/f39/f39/f39/f39/AGADf399AGACf34AYAl/f39/f39/f38Bf2ALf39/f39/f39/f38Bf2AMf39/f39/f39/f39/AX9gBH9/f30Bf2ADf35/AX9gAn98AX9gAn5/AX9gAn5+AX9gAXwBf2ABfwF+YAR/f39+AX5gA39/fwF9YAJ9fwF9YAF8AX1gAnx/AXxgA3x8fwF8YAN8fHwBfGAMf39/f39/f39/f39/AGANf39/f39/f39/f39/fwBgCH9/f39/f3x8AGAFf39/f30AYAV/f39/fABgB39/f319f38AYAV/f398fwBgBn9/f3x/fABgB39/f3x/fHwAYAh/f398f3x8fABgBX9/f3x8AGAHf39/fHx8fwBgA39/fgBgA39+fgBgAn99AGAGf39/f398AX9gBX9/f399AX9gBX9/f31/AX9gA39/fAF/YAd/f3x/f39/AX9gA35/fwF/YAR+fn5+AX9gAn1/AX9gAnx/AX9gAn9/AX5gBn9/f39/fwF9YAJ+fgF9YAJ9fQF9YAV/f39/fwF8YAR/f398AXxgBX9/f3x/AXxgBn9/f3x/fwF8YAZ/f398f3wBfGAHf39/fH98fwF8YAh/f398f3x8fAF8YAV/f398fAF8YAZ/f398fH8BfGAHf39/fHx/fAF8YAh/f398fH98fAF8YAZ/f398fHwBfGAHf39/fHx8fwF8YAh/f398fHx/fwF8YAh/f398fHx/fAF8YAh/f398fHx8fAF8YAp/f398fHx8fH9/AXxgAn5+AXwClgktA2VudhZfZW1iaW5kX3JlZ2lzdGVyX2NsYXNzAHUDZW52Il9lbWJpbmRfcmVnaXN0ZXJfY2xhc3NfY29uc3RydWN0b3IADQNlbnYlX2VtYmluZF9yZWdpc3Rlcl9jbGFzc19jbGFzc19mdW5jdGlvbgAXA2Vudh9fZW1iaW5kX3JlZ2lzdGVyX2NsYXNzX2Z1bmN0aW9uADADZW52H19lbWJpbmRfcmVnaXN0ZXJfY2xhc3NfcHJvcGVydHkAIANlbnYVX2VtYmluZF9yZWdpc3Rlcl9lbnVtAAsDZW52G19lbWJpbmRfcmVnaXN0ZXJfZW51bV92YWx1ZQAFA2VudhpfZW1iaW5kX3JlZ2lzdGVyX3NtYXJ0X3B0cgB0A2VudhhfX2N4YV9hbGxvY2F0ZV9leGNlcHRpb24AAANlbnYLX19jeGFfdGhyb3cABQNlbnYRX2VtdmFsX3Rha2VfdmFsdWUAAwNlbnYNX2VtdmFsX2luY3JlZgABA2Vudg1fZW12YWxfZGVjcmVmAAEDZW52C19lbXZhbF9jYWxsAAgDZW52BXJvdW5kABYDZW52BGV4aXQAAQNlbnYNX19hc3NlcnRfZmFpbAALA2VudgZfX2xvY2sAAQNlbnYIX191bmxvY2sAARZ3YXNpX3NuYXBzaG90X3ByZXZpZXcxCGZkX2Nsb3NlAAADZW52Cl9fc3lzY2FsbDUAAwNlbnYMX19zeXNjYWxsMjIxAAMDZW52C19fc3lzY2FsbDU0AAMWd2FzaV9zbmFwc2hvdF9wcmV2aWV3MQdmZF9yZWFkAAgWd2FzaV9zbmFwc2hvdF9wcmV2aWV3MQhmZF93cml0ZQAIFndhc2lfc25hcHNob3RfcHJldmlldzERZW52aXJvbl9zaXplc19nZXQAAxZ3YXNpX3NuYXBzaG90X3ByZXZpZXcxC2Vudmlyb25fZ2V0AAMDZW52Cl9fbWFwX2ZpbGUAAwNlbnYLX19zeXNjYWxsOTEAAwNlbnYKc3RyZnRpbWVfbAAGA2VudgVhYm9ydAAHA2VudhVfZW1iaW5kX3JlZ2lzdGVyX3ZvaWQAAgNlbnYVX2VtYmluZF9yZWdpc3Rlcl9ib29sAAoDZW52G19lbWJpbmRfcmVnaXN0ZXJfc3RkX3N0cmluZwACA2VudhxfZW1iaW5kX3JlZ2lzdGVyX3N0ZF93c3RyaW5nAAUDZW52Fl9lbWJpbmRfcmVnaXN0ZXJfZW12YWwAAgNlbnYYX2VtYmluZF9yZWdpc3Rlcl9pbnRlZ2VyAAoDZW52Fl9lbWJpbmRfcmVnaXN0ZXJfZmxvYXQABQNlbnYcX2VtYmluZF9yZWdpc3Rlcl9tZW1vcnlfdmlldwAFA2VudhZlbXNjcmlwdGVuX3Jlc2l6ZV9oZWFwAAADZW52FWVtc2NyaXB0ZW5fbWVtY3B5X2JpZwAEA2VudgtzZXRUZW1wUmV0MAABFndhc2lfc25hcHNob3RfcHJldmlldzEHZmRfc2VlawAGA2VudgZtZW1vcnkCAIAQA2VudgV0YWJsZQFwALEHA5wK+AkHBwcHBwcHAAEADAIBAAsFAAxLU1AYGgAMShkQDwACAwUADE1OAAwQDxAPAAw2NzgADBFAJQ8AAEQZFXMADD85DxAQDxAPDwABDAALCAIBNAgADFJXAAxVWCoAAgAYGBYREQAMEwAMLE8ADCwADBMADA8PLwATEhISEhISEhISFhIADAAAAgACEAIQAgIAAgAMHysAAQMAEyE1AhgeAAAAABMhAgABDApFKQMAAAAAAAAAAQxJAAEMMjEDBAABDAIFBQsABQQECAACGgUZAAUERAACBQULAAUECAAFAGEzBWYFIQcAAQAMAwEAAQIQDy1RHysAAQMBAi0ADAIPDwBeVi5UJQcAAwQDAwMIBAMDAwAAAAMDAwMDAwMDAwwQEGhrAAwTAAwfAAwjKllMBwABDAAMAQIFAgUCAgAABAIAAQEDAQABARAABAABAwABAQcQERERERERExEVERERHhoAWlsTExUVFTw9PgQAAwQCAAQAAwAAAgUFARAVLhUQERMRFRMRDztcLxEPDw9dXyMPDw8QAAEBAAECBCQHCwADAwkPAQILRgAoKAtIDQsCAgEFCgUKCgIBAQARABUDAQAIAAgJAwMNCwEAAwQEBAsICggAAAMOCg1vbwQFCwINAgACABwAAQQIAgwDAwNxBhQFAAsKaYgBaQRHAgUMAAIBbGwAAAhnZwIAAAADAwwACAQAABwEAAQBAAAAADo6oQESBosBchZwcIoBHRYdchYdjwEdFh0SBAwAAAEBAAEAAgQkCwQFAAADBAABAAQFAAQAAAEBAwEAAwAAAwMBAwADBWIBAAMAAwMDAAMAAAEBAAAAAwMDAgICAgECAgAAAwcBAQcBBwUCBQICAAABAgADAAMBAgADAAMCAAQDAgQDYgCBAW0IggEbAhsPiQFqGwIbOhsLDReMAY4BBAOAAQQEBAMHBAACAwwEAwMBAAQICAZtJycpCxgFCwYLBQQGCwUECQAUAwQJBgAFAAJBCAsJBicJBggJBggJBicJBgplbgkGHgkGCwkMBAEEAwkAFAkGAwVBCQYJBgkGCQYJBgplCQYJBgkEAwYAAAYLBgQXAgAiBiImBAAIF0MGBgAGFwkCBCIGIiYXQwYCAg4ACQkJDQkNCQoGDgsKCgoKCgoLDQoKCg4JCQkNCQ0JCgYOCwoKCgoKCgsNCgoKFA0CBBQNBgcEAAICAgACFGQgAgUFFAEFAAIABAMCFGQgAhQBBQACAAQDQiBgBAlCIGAECQQEBA0FAg0LCwAHBwcBAQIAAgcMAQABAQEMAQMBAgEBBAgICAMEAwQDCAQGAAEDBAMECAQGDgYGAQ4GBA4JBgYAAAAGCAAOCQ4JBgQADgkOCQYEAAEAAQAAAgICAgICAgIABwEABwECAAcBAAcBAAcBAAcBAAEAAQABAAEAAQABAAEAAQEADAMBAwAFAgEACAIBCwACAQABAQUBAQMCAAIEBAcCBQAFMAICAgoFBQIBBQUwCgUCBQcHBwAAAQEBAAQEBAMFCwsLCwMEAwMLCg0KCgoNDQ0AAAcHBwcHBwcHBwcHBwcBAQEBAQEHBwcHAAABAwMCABIbFh1xagQEBQIMAAEABQpLkQFTmwFQlwEeGhlKkAF4TZQBTpUBNns3fDh9JX8mOX4GNHlSmgFXnwFVnQFYoAEqkgFPlgErmAE1eg1FhQEpbkmNATF2M3eEAVGZAVaeAVScAYYBTJMBhwEJYxSDAQ4XARcGFGNBBhACfwFB8KPDAgt/AEHsowMLB7wOahFfX3dhc21fY2FsbF9jdG9ycwArBm1hbGxvYwC9CQRmcmVlAL4JEF9fZXJybm9fbG9jYXRpb24AkwQIc2V0VGhyZXcAzAkZX1pTdDE4dW5jYXVnaHRfZXhjZXB0aW9udgDcBA1fX2dldFR5cGVOYW1lAKQJKl9fZW1iaW5kX3JlZ2lzdGVyX25hdGl2ZV9hbmRfYnVpbHRpbl90eXBlcwClCQpfX2RhdGFfZW5kAwEJc3RhY2tTYXZlAM0JCnN0YWNrQWxsb2MAzgkMc3RhY2tSZXN0b3JlAM8JEF9fZ3Jvd1dhc21NZW1vcnkA0AkKZHluQ2FsbF9paQCxAgpkeW5DYWxsX3ZpADYJZHluQ2FsbF9pADQLZHluQ2FsbF92aWkA0QkNZHluQ2FsbF92aWlpaQDSCQxkeW5DYWxsX3ZpaWkAOQtkeW5DYWxsX2RpZADTCQxkeW5DYWxsX2RpaWQA1AkNZHluQ2FsbF9kaWRkZADVCQ5keW5DYWxsX2RpaWRkZADWCQxkeW5DYWxsX2RpZGQA1wkNZHluQ2FsbF9kaWlkZADYCQpkeW5DYWxsX2RpAIkBC2R5bkNhbGxfZGlpANkJC2R5bkNhbGxfdmlkANoJDGR5bkNhbGxfdmlpZADbCQxkeW5DYWxsX2RpaWkA3AkNZHluQ2FsbF9kaWlpaQDdCQ1keW5DYWxsX3ZpaWlkAN4JC2R5bkNhbGxfaWlpALICDWR5bkNhbGxfZGlkaWQA3wkOZHluQ2FsbF9kaWlkaWQA4AkOZHluQ2FsbF9kaWRpZGkA4QkPZHluQ2FsbF9kaWlkaWRpAOIJDWR5bkNhbGxfdmlkaWQA4wkOZHluQ2FsbF92aWlkaWQA5AkOZHluQ2FsbF92aWRpZGQA5QkPZHluQ2FsbF92aWlkaWRkAOYJD2R5bkNhbGxfdmlkaWRkZADnCRBkeW5DYWxsX3ZpaWRpZGRkAOgJDmR5bkNhbGxfdmlkZGRpAOkJD2R5bkNhbGxfdmlpZGRkaQDqCQ1keW5DYWxsX2lpaWlkAOsJDGR5bkNhbGxfZGRkZABlDGR5bkNhbGxfdmlkZADsCQ1keW5DYWxsX3ZpaWRkAO0JDGR5bkNhbGxfaWlpaQC2Ag1keW5DYWxsX2lpaWlpAO4JDmR5bkNhbGxfdmlmZmlpAO8JD2R5bkNhbGxfdmlpZmZpaQDwCQ9keW5DYWxsX2RpZGRpZGQA8QkQZHluQ2FsbF9kaWlkZGlkZADyCQ9keW5DYWxsX2RpZGRkZGQA8wkQZHluQ2FsbF9kaWlkZGRkZAD0CQ9keW5DYWxsX2RpZGRkaWkA9QkQZHluQ2FsbF9kaWlkZGRpaQD2CRFkeW5DYWxsX2RpZGRkZGRpaQD3CRJkeW5DYWxsX2RpaWRkZGRkaWkA+AkMZHluQ2FsbF9kaWRpAPkJDWR5bkNhbGxfZGlpZGkA+gkKZHluQ2FsbF9kZACMAQ9keW5DYWxsX2RpZGlkZGQA+wkQZHluQ2FsbF9kaWlkaWRkZAD8CQtkeW5DYWxsX2RkZACgAQ1keW5DYWxsX2RpZGRpAP0JDmR5bkNhbGxfZGlpZGRpAP4JDGR5bkNhbGxfdmlkaQD/CQ1keW5DYWxsX3ZpaWRpAIAKDmR5bkNhbGxfdmlpaWlpAIEKDGR5bkNhbGxfaWlmaQCCCg1keW5DYWxsX2lpaWZpAIMKCmR5bkNhbGxfZmkAhAoLZHluQ2FsbF9maWkAhQoNZHluQ2FsbF9maWlpaQCGCg5keW5DYWxsX2ZpaWlpaQCHCg9keW5DYWxsX3ZpaWlpZGQAiAoQZHluQ2FsbF92aWlpaWlkZACJCgxkeW5DYWxsX3ZpaWYAigoNZHluQ2FsbF92aWlpZgCLCg1keW5DYWxsX2lpaWlmAIwKDmR5bkNhbGxfZGlkZGlkAI0KD2R5bkNhbGxfZGlpZGRpZACOCg9keW5DYWxsX2RpZGRkaWQA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qJHWABDrCBCKAws7AQF/IAEgACgCBCIFQQF1aiEBIAAoAgAhACABIAIgAyAEIAVBAXEEfyABKAIAIABqKAIABSAACxFaAAs9AQF/IAEgACgCBCIGQQF1aiEBIAAoAgAhACABIAIgAyAEIAUgBkEBcQR/IAEoAgAgAGooAgAFIAALEVsACwUAQcAqCywBAX9B8AEQ6wgiAEIANwPAASAAQgA3A9gBIABCADcD0AEgAEIANwPIASAACwgAIAArA+ABCwoAIAAgATkD4AELCAAgACsD6AELCgAgACABOQPoAQsFAEHMKwsQAEH4ABDrCEEAQfgAEMoJCzsBAX8gASAAKAIEIgVBAXVqIQEgACgCACEAIAEgAiADIAQgBUEBcQR/IAEoAgAgAGooAgAFIAALETwACz0BAX8gASAAKAIEIgZBAXVqIQEgACgCACEAIAEgAiADIAQgBSAGQQFxBH8gASgCACAAaigCAAUgAAsRPQALPwEBfyABIAAoAgQiB0EBdWohASAAKAIAIQAgASACIAMgBCAFIAYgB0EBcQR/IAEoAgAgAGooAgAFIAALET4ACwUAQYAtC14BAX9B0AAQ6wgiAEIANwMAIABCADcDICAAQoCAgICAgID4v383AxggAEIANwM4IABBAToASCAAQgA3AxAgAEIANwMIIABCADcDKCAAQQA6ADAgAEFAa0IANwMAIAAL+QECAX8DfCAALQAwRQRAIAArAyghAwJAIAArAyBEAAAAAAAAAABhDQAgA0QAAAAAAAAAAGINAEQAAAAAAAAAACEDIAFEAAAAAAAAAABkQQFzRQRARAAAAAAAAPA/RAAAAAAAAAAAIAArAxhEAAAAAAAAAABlGyEDCyAAIAM5AyggACAAKQM4NwMICwJAIANEAAAAAAAAAABhDQAgACAAKwMQIgQgACsDCKAiAzkDCCAAIAMgACsDQCIFZSADIAVmIAREAAAAAAAAAABlGyICOgAwIAJFDQAgAC0ASA0AIABBADoAMCAAQgA3AygLIAAgATkDGAsgACsDCAtbAgF/AX4gACACOQNAIAApAzghBiAAIAE5AzggACAGNwMIQZSCAigCACEFIAAgBDoASCAAQQA6ADAgAEIANwMoIAAgAiABoSADRAAAAAAAQI9AoyAFt6KjOQMQCz0BAX8gASAAKAIEIgZBAXVqIQEgACgCACEAIAEgAiADIAQgBSAGQQFxBH8gASgCACAAaigCAAUgAAsRQAALJgAgAEQAAAAAAADwP0QAAAAAAAAAACABRAAAAAAAAAAAZBs5AyALBwAgAC0AMAsFAEGQLgtGAQF/IwBBEGsiBCQAIAQgASACIAMgABEZAEEMEOsIIgAgBCgCADYCACAAIAQoAgQ2AgQgACAEKAIINgIIIARBEGokACAAC98CAgN/AXxEAAAAAAAA8D8hBwJAIANEAAAAAAAA8D9kDQAgAyIHRAAAAAAAAPC/Y0EBcw0ARAAAAAAAAPC/IQcLIAEoAgAhBiABKAIEIQEgAEEANgIIIABCADcCAAJAAkAgASAGayIBRQ0AIAFBA3UiBUGAgICAAk8NASAHRAAAAAAAAPA/pEQAAAAAAADwv6VEAAAAAAAA8D+gRAAAAAAAAOA/okQAAAAAAAAAAKAiA58hB0QAAAAAAADwPyADoZ8hAyAAIAEQ6wgiBDYCACAAIAQ2AgQgACAEIAVBA3RqNgIIIARBACABEMoJIgQhAQNAIAFBCGohASAFQX9qIgUNAAsgACABNgIEIAEgBEYNACABIARrQQN1IQUgAigCACECQQAhAQNAIAQgAUEDdCIAaiAAIAZqKwMAIAOiIAcgACACaisDAKKgOQMAIAFBAWoiASAFSQ0ACwsPCxCECQALDQAgASACIAMgABFzAAvSAQEDfyMAQTBrIgMkACADQQA2AiggA0IANwMgIANBCBDrCCIENgIgIAMgBEEIaiIFNgIoIAQgADkDACADIAU2AiQgA0EANgIYIANCADcDECADQQgQ6wgiBDYCECADIARBCGoiBTYCGCAEIAE5AwAgAyAFNgIUIAMgA0EgaiADQRBqIAIQZCADKAIAIgQrAwAhACADIAQ2AgQgBBC+CSADKAIQIgQEQCADIAQ2AhQgBBC+CQsgAygCICIEBEAgAyAENgIkIAQQvgkLIANBMGokACAACwUAQZgvCzABAX9BGBDrCCIAQgA3AxAgAEKAgICAgICA8D83AwggAEKAgICAgICA8D83AwAgAAshACAAIAI5AxAgACABOQMAIABEAAAAAAAA8D8gAaE5AwgLOQEBfyABIAAoAgQiBEEBdWohASAAKAIAIQAgASACIAMgBEEBcQR/IAEoAgAgAGooAgAFIAALET8ACxsAIAAgACsDACABoiAAKwMIIAArAxCioDkDEAsHACAAKwMQCwcAIAArAwALCQAgACABOQMACwcAIAArAwgLCQAgACABOQMICwkAIAAgATkDEAsFAEGsMAs3AQF/IAAEQCAAKAJsIgEEQCAAIAE2AnAgARC+CQsgACwAC0F/TARAIAAoAgAQvgkLIAAQvgkLC4kBAQJ/QYgBEOsIIgBCADcCACAAQgA3AyggAEEBOwFgIABCADcDWCAAQoCAgICAgIDwPzcDUCAAQoCAgICAgIDwPzcDSCAAQQA2AgggAEIANwMwQZSCAigCACEBIABBADYCdCAAQgA3AmwgACABNgJkIABBAToAgAEgAEKAgICAgICA+D83A3ggAAsQACAAKAJwIAAoAmxrQQN1CzkBAX8gASAAKAIEIgRBAXVqIQEgACgCACEAIAEgAiADIARBAXEEfyABKAIAIABqKAIABSAACxEFAAs5AQF/IAEgACgCBCIEQQF1aiEBIAAoAgAhACABIAIgAyAEQQFxBH8gASgCACAAaigCAAUgAAsRBAALNQEBfyABIAAoAgQiAkEBdWohASAAKAIAIQAgASACQQFxBH8gASgCACAAaigCAAUgAAsRAQALDAAgACAAKAJsNgJwCz0BAX8gASAAKAIEIgZBAXVqIQEgACgCACEAIAEgAiADIAQgBSAGQQFxBH8gASgCACAAaigCAAUgAAsROwAL5QEBBH8jAEEQayIEJAAgASAAKAIEIgZBAXVqIQcgACgCACEFIAZBAXEEQCAHKAIAIAVqKAIAIQULIAIoAgAhACAEQQA2AgggBEIANwMAIABBcEkEQAJAAkAgAEELTwRAIABBEGpBcHEiBhDrCCEBIAQgBkGAgICAeHI2AgggBCABNgIAIAQgADYCBAwBCyAEIAA6AAsgBCEBIABFDQELIAEgAkEEaiAAEMkJGgsgACABakEAOgAAIAcgBCADIAURBAAhACAELAALQX9MBEAgBCgCABC+CQsgBEEQaiQAIAAPCxDvCAALBQBB1DMLEABB2AAQ6whBAEHYABDKCQs/AQF/IAEgACgCBCIHQQF1aiEBIAAoAgAhACABIAIgAyAEIAUgBiAHQQFxBH8gASgCACAAaigCAAUgAAsRXAALPwEBfyABIAAoAgQiB0EBdWohASAAKAIAIQAgASACIAMgBCAFIAYgB0EBcQR/IAEo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AjAgAEEANgI4IAALOwEBfyABIAAoAgQiBUEBdWohASAAKAIAIQAgASACIAMgBCAFQQFxBH8gASgCACAAaigCAAUgAAsRCwALOQEBfyABIAAoAgQiBEEBdWohASAAKAIAIQAgASACIAMgBEEBcQR/IAEoAgAgAGooAgAFIAALEUYACzUBAX8gASAAKAIEIgJBAXVqIQEgACgCACEAIAEgAkEBcQR/IAEoAgAgAGooAgAFIAALESgAC7wBAQJ/IAEgACgCBCICQQF1aiEBIAAoAgAhACABIAJBAXEEfyABKAIAIABqKAIABSAACxEAACEBQQwQ6wgiAEEANgIIIABCADcCAAJAAkAgASgCBCABKAIAayICRQ0AIAJBAnUiA0GAgICABE8NASAAIAIQ6wgiAjYCACAAIAI2AgQgACACIANBAnRqNgIIIAEoAgQgASgCACIDayIBQQFIDQAgACACIAMgARDJCSABajYCBAsgAA8LEIQJAAsHACAAENEDCwcAIABBDGoLCAAgACgCjAELBwAgACgCRAsIACAAKAKIAQsIACAAKAKEAQsGAEHcxAALWAEBfyAABEAgAEE8ahDaAyAAKAIYIgEEQCAAIAE2AhwgARC+CQsgACgCDCIBBEAgACABNgIQIAEQvgkLIAAoAgAiAQRAIAAgATYCBCABEL4JCyAAEL4JCwtZAQF/QfQAEOsIIgBCADcCRCAAQgA3AgAgAEIANwJsIABCADcCZCAAQgA3AlwgAEIANwJUIABCADcCTCAAQgA3AgggAEIANwIQIABCADcCGCAAQQA2AiAgAAs7AQF/IAEgACgCBCIFQQF1aiEBIAAoAgAhACABIAIgAyAEIAVBAXEEfyABKAIAIABqKAIABSAACxFIAAsGAEGUxgALVAEBfyAABEACQCAAKAIkIgFFDQAgARC+CSAAKAIAIgEEQCABEL4JCyAAKAIsIgFFDQAgARC+CQsgACgCMCIBBEAgACABNgI0IAEQvgkLIAAQvgkLCygBAX9BwAAQ6wgiAEIANwIsIABBADYCJCAAQQA2AgAgAEIANwI0IAALpgMCA38CfCMAQRBrIggkACAAIAU5AxggACAEOQMQIAAgAzYCCCAAIAI2AgRBlIICKAIAIQYgACABNgIoIAAgBjYCICAAQQA2AiQgACACQQN0IgYQvQk2AgAgCEIANwMIAkAgACgCNCAAKAIwIgdrQQN1IgIgA0kEQCAAQTBqIAMgAmsgCEEIahCMAgwBCyACIANNDQAgACAHIANBA3RqNgI0CyAAIAMgBmwQvQk2AiwgACAAKAIguCABEI0CAkAgACgCBCIDRQ0AIAAoAggiBkUNAEQYLURU+yEJQCADuCIEoyEFRAAAAAAAAPA/IASfoyEJRAAAAAAAAABAIASjnyEEIAAoAiwhB0EAIQEDQCABQQFqIQJBACEAAkAgAQRAIAUgAreiIQoDQCAHIAAgBmwgAWpBA3RqIAQgCiAAt0QAAAAAAADgP6CiEMwEojkDACAAQQFqIgAgA0cNAAsMAQsDQCAHIAAgBmxBA3RqIAkgBSAAt0QAAAAAAADgP6CiEMwEojkDACAAQQFqIgAgA0cNAAsLIAIiASAGRw0ACwsgCEEQaiQACz8BAX8gASAAKAIEIgdBAXVqIQEgACgCACEAIAEgAiADIAQgBSAGIAdBAXEEfyABKAIAIABqKAIABSAACxEyAAvVAQIHfwF8IAAgASgCABDgAyAAQTBqIQQgACgCCCICBEBBACEBIAAoAjBBACACQQN0EMoJIQMgACgCBCIFBEAgACgCACEGIAAoAiwhBwNAIAMgAUEDdGoiCCsDACEJQQAhAANAIAggByAAIAJsIAFqQQN0aisDACAGIABBA3RqKwMAoiAJoCIJOQMAIABBAWoiACAFRw0ACyABQQFqIgEgAkcNAAsLIAK4IQlBACEAA0AgAyAAQQN0aiIBIAErAwAgCaM5AwAgAEEBaiIAIAJHDQALCyAEC74BAQF/IAEgACgCBCIDQQF1aiEBIAAoAgAhACABIAIgA0EBcQR/IAEoAgAgAGooAgAFIAALEQMAIQFBDBDrCCIAQQA2AgggAEIANwIAAkACQCABKAIEIAEoAgBrIgJFDQAgAkEDdSIDQYCAgIACTw0BIAAgAhDrCCICNgIAIAAgAjYCBCAAIAIgA0EDdGo2AgggASgCBCABKAIAIgNrIgFBAUgNACAAIAIgAyABEMkJIAFqNgIECyAADwsQhAkACwUAQewXCyQBAX8gAARAIAAoAgAiAQRAIAAgATYCBCABEL4JCyAAEL4JCwsZAQF/QQwQ6wgiAEEANgIIIABCADcCACAACzABAX8gACgCBCICIAAoAghHBEAgAiABKAIANgIAIAAgAkEEajYCBA8LIAAgARDfAgtSAQJ/IwBBEGsiAyQAIAEgACgCBCIEQQF1aiEBIAAoAgAhACAEQQFxBEAgASgCACAAaigCACEACyADIAI2AgwgASADQQxqIAARAgAgA0EQaiQACz4BAn8gACgCBCAAKAIAIgRrQQJ1IgMgAUkEQCAAIAEgA2sgAhDgAg8LIAMgAUsEQCAAIAQgAUECdGo2AgQLC1QBAn8jAEEQayIEJAAgASAAKAIEIgVBAXVqIQEgACgCACEAIAVBAXEEQCABKAIAIABqKAIAIQALIAQgAzYCDCABIAIgBEEMaiAAEQUAIARBEGokAAsQACAAKAIEIAAoAgBrQQJ1C1EBAn8jAEEQayIDJABBASEEIAAgASgCBCABKAIAIgFrQQJ1IAJLBH8gAyABIAJBAnRqKAIANgIIQcTyASADQQhqEAoFQQELNgIAIANBEGokAAs3AQF/IwBBEGsiAyQAIANBCGogASACIAAoAgARBQAgAygCCBALIAMoAggiABAMIANBEGokACAACxcAIAAoAgAgAUECdGogAigCADYCAEEBCzQBAX8jAEEQayIEJAAgACgCACEAIAQgAzYCDCABIAIgBEEMaiAAEQQAIQAgBEEQaiQAIAALBQBBgBsLMAEBfyAAKAIEIgIgACgCCEcEQCACIAEpAwA3AwAgACACQQhqNgIEDwsgACABEOECC1IBAn8jAEEQayIDJAAgASAAKAIEIgRBAXVqIQEgACgCACEAIARBAXEEQCABKAIAIABqKAIAIQALIAMgAjkDCCABIANBCGogABECACADQRBqJAALPgECfyAAKAIEIAAoAgAiBGtBA3UiAyABSQRAIAAgASADayACEIwCDwsgAyABSwRAIAAgBCABQQN0ajYCBAsLVAECfyMAQRBrIgQkACABIAAoAgQiBUEBdWohASAAKAIAIQAgBUEBcQRAIAEoAgAgAGooAgAhAAsgBCADOQMIIAEgAiAEQQhqIAARBQAgBEEQaiQACxAAIAAoAgQgACgCAGtBA3ULUQECfyMAQRBrIgMkAEEBIQQgACABKAIEIAEoAgAiAWtBA3UgAksEfyADIAEgAkEDdGopAwA3AwhBgPMBIANBCGoQCgVBAQs2AgAgA0EQaiQACxcAIAAoAgAgAUEDdGogAikDADcDAEEBCzQBAX8jAEEQayIEJAAgACgCACEAIAQgAzkDCCABIAIgBEEIaiAAEQQAIQAgBEEQaiQAIAALBQBB0B0LxAEBBX8gACgCBCICIAAoAggiA0cEQCACIAEtAAA6AAAgACAAKAIEQQFqNgIEDwsgAiAAKAIAIgJrIgVBAWoiBEF/SgRAIAUCf0EAIAQgAyACayIDQQF0IgYgBiAESRtB/////wcgA0H/////A0kbIgNFDQAaIAMQ6wgLIgRqIgYgAS0AADoAACAFQQFOBEAgBCACIAUQyQkaCyAAIAMgBGo2AgggACAGQQFqNgIEIAAgBDYCACACBEAgAhC+CQsPCxCECQALUgECfyMAQRBrIgMkACABIAAoAgQiBEEBdWohASAAKAIAIQAgBEEBcQRAIAEoAgAgAGooAgAhAAsgAyACOgAPIAEgA0EPaiAAEQIAIANBEGokAAs4AQJ/IAAoAgQgACgCACIEayIDIAFJBEAgACABIANrIAIQ4gIPCyADIAFLBEAgACABIARqNgIECwtUAQJ/IwBBEGsiBCQAIAEgACgCBCIFQQF1aiEBIAAoAgAhACAFQQFxBEAgASgCACAAaigCACEACyAEIAM6AA8gASACIARBD2ogABEFACAEQRBqJAALDQAgACgCBCAAKAIAawtLAQJ/IwBBEGsiAyQAQQEhBCAAIAEoAgQgASgCACIBayACSwR/IAMgASACaiwAADYCCEGI8gEgA0EIahAKBUEBCzYCACADQRBqJAALFAAgACgCACABaiACLQAAOgAAQQELNAEBfyMAQRBrIgQkACAAKAIAIQAgBCADOgAPIAEgAiAEQQ9qIAARBAAhACAEQRBqJAAgAAsFAEGYIAtLAQJ/IwBBEGsiAyQAQQEhBCAAIAEoAgQgASgCACIBayACSwR/IAMgASACai0AADYCCEGU8gEgA0EIahAKBUEBCzYCACADQRBqJAALBQBB2CILUgECfyMAQRBrIgMkACABIAAoAgQiBEEBdWohASAAKAIAIQAgBEEBcQRAIAEoAgAgAGooAgAhAAsgAyACOAIMIAEgA0EMaiAAEQIAIANBEGokAAtUAQJ/IwBBEGsiBCQAIAEgACgCBCIFQQF1aiEBIAAoAgAhACAFQQFxBEAgASgCACAAaigCACEACyAEIAM4AgwgASACIARBDGogABEFACAEQRBqJAALUQECfyMAQRBr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AEHgAyAAQQAQAwsGAEHIxwALDwAgAARAIAAQ5gIQvgkLCwcAIAAoAgALEgEBf0EIEOsIIgBCADcCACAAC00BAn8jAEEQayICJABBCBDrCCEDIAEQCyACIAE2AgggAkHkGSACQQhqEAo2AgAgAyAAIAIQ5wIhACACKAIAEAwgARAMIAJBEGokACAAC0ABAn8gAARAAkAgACgCBCIBRQ0AIAEgASgCBCICQX9qNgIEIAINACABIAEoAgAoAggRAQAgARDoCAsgABC+CQsLOQEBfyMAQRBrIgEkACABQQhqIAARAQBBCBDrCCIAIAEoAgg2AgAgACABKAIMNgIEIAFBEGokACAAC5wCAgN/AXxBOBDrCCIDQgA3AgQgA0HAywA2AgAgAwJ/QZSCAigCALdEAAAAAAAA4D+iIgREAAAAAAAA8EFjIAREAAAAAAAAAABmcQRAIASrDAELQQALIgI2AiAgAyACQQJ0EL0JIgE2AiQCQCACRQ0AIAFBADYCACACQQFGDQAgAUEANgIEIAJBAkYNACABQQA2AgggAkEDRg0AIAFBADYCDCACQQRGDQAgAUEANgIQIAJBBUYNACABQQA2AhQgAkEGRg0AIAFBADYCGEEHIQEgAkEHRg0AA0AgAygCJCABQQJ0akEANgIAIAFBAWoiASACRw0ACwsgA0IANwMoIANCADcDECADQgA3AzAgACADNgIEIAAgA0EQajYCAAudAQEEfyAAKAIMIgMEQAJAIAMoAghFDQAgAygCBCICKAIAIgQgAygCACIFKAIENgIEIAUoAgQgBDYCACADQQA2AgggAiADRg0AA0AgAigCBCEEIAIQvgkgBCICIANHDQALCyADEL4JIABBADYCDAsgACABNgIIQRAQ6wgiAiABNgIMIAJBADYCCCACIAI2AgQgAiACNgIAIAAgAjYCDAscACAAKwMAIAAoAggiACgCcCAAKAJsa0EDdbijC1sCAX8BfCAAIAAoAggiAigCcCACKAJsa0EDdSICuCABoiIBOQMAAkAgASACQX9quCIDZA0AIAEiA0QAAAAAAAAAAGNBAXMNAEQAAAAAAAAAACEDCyAAIAM5AwALoAQDA38BfgN8IAAgACsDACABoCIJOQMAIAAgACsDIEQAAAAAAADwP6AiCzkDICAJIAAoAggiBSgCcCAFKAJsa0EDdbgiCqEg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gIMBahDhAyAAQaCFAWoQ4QMgAEHAhwFqEOEDIABB4IkBahDhAyAAQYCMAWoQ4QMgAEGgjgFqEOEDIABBwJABaiIBQgA3A8ABIAFCADcD2AEgAUIANwPQASABQgA3A8gBIABBsJIBaiIBQgA3A8ABIAFCADcD2AEgAUIANwPQASABQgA3A8gBIABBoJQBaiIBQgA3A8ABIAFCADcD2AEgAUIANwPQASABQgA3A8gBIABBkJYBaiIBQgA3A8ABIAFCADcD2AEgAUIANwPQASABQgA3A8gBIABBgJgBaiIBQgA3A8ABIAFCADcD2AEgAUIANwPQASABQgA3A8gBIABB8JkBaiIBQgA3A8ABIAFCADcD2AEgAUIANwPQASABQgA3A8gBIABB4JsBaiIBQgA3A8ABIAFCADcD2AEgAUIANwPQASABQgA3A8gBIABB0J0BaiIBQgA3A8ABIAFCADcD2AEgAUIANwPQASABQgA3A8gBIABBwJ8BaiIBQgA3A8ABIAFCADcD2AEgAUIANwPQASABQgA3A8gBIABBsKEBaiIBQgA3A8ABIAFCADcD2AEgAUIANwPQASABQgA3A8gBIABBoKMBaiIBQgA3A8ABIAFCADcD2AEgAUIANwPQASABQgA3A8gBIABBkKUBaiIBQgA3A8ABIAFCADcD2AEgAUIANwPQASABQgA3A8gBIABBgKcBaiIBQgA3A8ABIAFCADcD2AEgAUIANwPQASABQgA3A8gBIABB8KgBaiIBQgA3A8ABIAFCADcD2AEgAUIANwPQASABQgA3A8gBIABB4KoBaiIBQgA3A8ABIAFCADcD2AEgAUIANwPQASABQgA3A8gBIABB0KwBaiIBQgA3A8ABIAFCADcD2AEgAUIANwPQASABQgA3A8gBIABBwK4BaiIBQgA3A8ABIAFCADcD2AEgAUIANwPQASABQgA3A8gBIABBsLABaiIBQgA3A8ABIAFCADcD2AEgAUIANwPQASABQgA3A8gBIABBoLIBaiIBQgA3A8ABIAFCADcD2AEgAUIANwPQASABQgA3A8gBIABBkLQBaiIBQgA3A8ABIAFCADcD2AEgAUIANwPQASABQgA3A8gBIABBgLYBaiIBQgA3A8ABIAFCADcD2AEgAUIANwPQASABQgA3A8gBIABB8LcBaiIBQgA3A8ABIAFCADcD2AEgAUIANwPQASABQgA3A8gBIABB4LkBaiIBQgA3A8ABIAFCADcD2AEgAUIANwPQASABQgA3A8gBIABB0LsBaiIBQgA3A8ABIAFCADcD2AEgAUIANwPQASABQgA3A8gBIABBwL0BaiIBQgA3A8ABIAFCADcD2AEgAUIANwPQASABQgA3A8gBIABBsL8BaiIBQgA3A8ABIAFCADcD2AEgAUIANwPQASABQgA3A8gBIABBoMEBaiIBQgA3A8ABIAFCADcD2AEgAUIANwPQASABQgA3A8gBIABBkMMBaiIBQgA3A8ABIAFCADcD2AEgAUIANwPQASABQgA3A8gBIABBgMUBaiIBQgA3A8ABIAFCADcD2AEgAUIANwPQASABQgA3A8gBIABB8MYBaiIBQgA3A8ABIAFCADcD2AEgAUIANwPQASABQgA3A8gBIABB4MgBaiIBQgA3A8ABIAFCADcD2AEgAUIANwPQASABQgA3A8gBIABB0MoBaiIBQgA3A8ABIAFCADcD2AEgAUIANwPQASABQgA3A8gBIABB6NgBahDhAyAAQdDYAWpCADcDACAAQgA3A8jYASAAQgA3A8DWASAAQcjWAWpCADcDACAAQcDMAWpBAEGQCBDKCRogAEG43AFqQQBB0AIQygkhA0GUggIoAgAhASAAQSA2AojfASAAQgA3A9jYASAAQgA3A8DYASAAQpqz5syZs+bcPzcDiN0BIABCmrPmzJmz5tw/NwOI2wEgAEGQ3QFqQpqz5syZs+bcPzcDACAAQZDbAWoiBEKas+bMmbPm3D83AwAgAEGY3QFqQpqz5syZs+bcPzcDACAAQZjbAWpCmrPmzJmz5tw/NwMAIABBoN0BakKas+bMmbPm3D83AwAgAEGg2wFqQpqz5syZs+bcPzcDACAAQajdAWpCmrPmzJmz5tw/NwMAIABBqNsBakKas+bMmbPm3D83AwAgAEGw3QFqQpqz5syZs+bcPzcDACAAQbDbAWpCmrPmzJmz5tw/NwMAIABBuN0BakKas+bMmbPm3D83AwAgAEG42wFqQpqz5syZs+bcPzcDACAAQcDdAWpCmrPmzJmz5tw/NwMAIABBwNsBakKas+bMmbPm3D83AwAgACABskMAAHpElTgC4NgBIABByN0BakKas+bMmbPm3D83AwAgAEHI2wFqQpqz5syZs+bcPzcDACAA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IAeqDAELQYCAgIB4CyIDNgIAIABBmM0AaiIEIABBgM0AaigCACAAQZDNAGoiBSgCACICQQN0aiIGKwMARDMzMzMzM+s/oiABoCIHOQMAIAYgBzkDACAFQQAgAkEBaiACIANBf2pGGzYCACAAIAQrAwAgACsD2NgBoDkD2NgBIABBtM8AagJ/IABB2MwBaisDACIHmUQAAAAAAADgQWMEQCAHqgwBC0GAgICAeAsiAzYCACAAQbjPAGoiBCAAQaDPAGooAgAgAEGwzwBqIgUoAgAiAkEDdGoiBisDAEQzMzMzMzPrP6IgAaAiATkDACAGIAE5AwAgBUEAIAJBAWogAiADQX9qRhs2AgAgACAEKwMAIAArA9jYAaAiATkD2NgBIAACfyAAKwPAzgEiB5lEAAAAAAAA4EFjBEAgB6oMAQtBgICAgHgLIgM2AlQgACAAKAJAIAAoAlAiAkEDdGoiBCsDACIHIAcgACsDaCIHoiABoCIBIAeioTkDWCAEIAE5AwAgAEEAIAJBAWogAiADQX9qRhs2AlAgAAJ/IABByM4BaisDACIBmUQAAAAAAADgQWMEQCABqgwBC0GAgICAeAsiAzYC9AIgACAAKALgAiAAKALwAiICQQN0aiIEKwMAIgEgASAAKwOIAyIBoiAAKwNYoCIHIAGioTkD+AIgBCAHOQMAIABBACACQQFqIAIgA0F/akYbNgLwAiAAAn8gAEHQzgFqKwMAIgGZRAAAAAAAAOBBYwRAIAGqDAELQYCAgIB4CyIDNgKUBSAAIAAoAoAFIAAoApAFIgJBA3RqIgQrAwAiASABIAArA6gFIgGiIAArA/gCoCIHIAGioTkDmAUgBCAHOQMAIABBACACQQFqIAIgA0F/akYbNgKQBSAAIAArA5gFIgE5A8DYASABC+gGAQF/IwBBgAFrIgEkACAAEOIDIABB+MwBakKAgICAgIDcyMAANwMAIABB8MwBakKAgICAgICkycAANwMAIABB6MwBakKAgICAgIDMysAANwMAIABB4MwBakKAgICAgID9ycAANwMAIABB2MwBakKAgICAgICOy8AANwMAIABB0MwBakKAgICAgIDTy8AANwMAIABByMwBakKAgICAgIDRzMAANwMAIABCgICAgICAlczAADcDwMwBIAFC4fXR8PqouPU/NwNIIAFC4fXR8PqouPU/NwNAIAFC4fXR8PqouPU/NwNQIAFC4fXR8PqouPU/NwNYIAFC4fXR8PqouPU/NwNgIAFC4fXR8PqouPU/NwNoIAFC4fXR8PqouPU/NwNwIAFC4fXR8PqouPU/NwN4IAFCmrPmzJmz5uQ/NwM4IAFCmrPmzJmz5uQ/NwMwIAFCmrPmzJmz5uQ/NwMoIAFCmrPmzJmz5uQ/NwMgIAFCmrPmzJmz5uQ/NwMYIAFCmrPmzJmz5uQ/NwMQIAFCmrPmzJmz5uQ/NwMIIAFCmrPmzJmz5uQ/NwMAIABB+NABakLh9dHw+qi49T83AwAgAEHw0AFqQuH10fD6qLj1PzcDACAAQejQAWpC4fXR8PqouPU/NwMAIABB4NABakLh9dHw+qi49T83AwAgAEHY0AFqQuH10fD6qLj1PzcDACAAQdDQAWpC4fXR8PqouPU/NwMAIABByNABakLh9dHw+qi49T83AwAgAEHA0AFqQuH10fD6qLj1PzcDACAAQeDUAWogASkDIDcDACAAQejUAWogASkDKDcDACAAQcDUAWogASkDADcDACAAQcjUAWogASkDCDcDACAAQdjUAWogASkDGDcDACAAQfDUAWogASkDMDcDACAAQfjUAWogASkDODcDACAAQdDUAWogASkDEDcDACAAQdjSAWpCgICAgICAgPA/NwMAIABB0NIBakKAgICAgICA8D83AwAgAEHI0gFqQoCAgICAgIDwPzcDACAAQoCAgICAgIDwPzcDwNIBIABB2M4BakKAgICAgIDUusAANwMAIABB0M4BakKAgICAgIDkvcAANwMAIABByM4BakKAgICAgIDYwMAANwMAIABCgICAgICAiLbAADcDwM4BIAFBgAFqJAAgAAuYCgIGfwF8IABCADcD2NgBIABBuNYBaiADRAAAAAAAAPA/pEQAAAAAAAAAAKUiAzkDACAAQbDWAWogAzkDACAAQajWAWogAzkDACAAQaDWAWogAzkDACAAQZjWAWogAzkDACAAQZDWAWogAzkDACAAQYjWAWogAzkDACAAQYDWAWogAzkDACAAQfjVAWogAzkDACAAQfDVAWogAzkDACAAQejVAWogAzkDACAAQeDVAWogAzkDACAAQdjVAWogAzkDACAAQdDVAWogAzkDACAAQcjVAWogAzkDACAAQcDVAWogAzkDACAAQbjVAWogAzkDACAAQbDVAWogAzkDACAAQajVAWogAzkDACAAQaDVAWogAzkDACAAQZjVAWogAzkDACAAQZDVAWogAzkDACAAQYjVAWogAzkDACAAQYDVAWogAzkDACAAQfjUAWogAzkDACAAQfDUAWogAzkDACAAQejUAWogAzkDACAAQeDUAWogAzkDACAAQdjUAWogAzkDACAAQdDUAWogAzkDACAAQcjUAWogAzkDACAAIAM5A8DUASAAQbjSAWogAkSamZmZmZm5P6JE4XoUrkfh6j+gRAAAAAAAAPA/pEQAAAAAAAAAAKUiAjkDACAAQbDSAWogAjkDACAAQajSAWogAjkDACAAQaDSAWogAjkDACAAQZjSAWogAjkDACAAQZDSAWogAjkDACAAQYjSAWogAjkDACAAQYDSAWogAjkDACAAQfjRAWogAjkDACAAQfDRAWogAjkDACAAQejRAWogAjkDACAAQeDRAWogAjkDACAAQdjRAWogAjkDACAAQdDRAWogAjkDACAAQcjRAWogAjkDACAAQcDRAWogAjkDACAAQbjRAWogAjkDACAAQbDRAWogAjkDACAAQajRAWogAjkDACAAQaDRAWogAjkDACAAQZjRAWogAjkDACAAQZDRAWogAjkDACAAQYjRAWogAjkDACAAQYDRAWogAjkDACAAQfjQAWogAjkDACAAQfDQAWogAjkDACAAQejQAWogAjkDACAAQeDQAWogAjkDACAAQdjQAWogAjkDACAAQdDQAWogAjkDACAAQcjQAWogAjkDACAAIAI5A8DQAQN8IAAgB0EDdGoiBUHA0AFqKwMAIQogACAHQaACbGoiBEHUyABqIggCfyAFQcDMAWorAwAiAplEAAAAAAAA4EFjBEAgAqoMAQtBgICAgHgLNgIAIARB2MgAaiIJAnwgBEHwyABqIgZEAAAAAAAA8D8gA6EgBEHAyABqIgUoAgAgBEHQyABqIgQoAgBBA3RqKwMAIAYrA2giAqGiIAKgIgI5A2ggBiACOQMQIAogAqIgAaAiAgs5AwAgBSgCACAEKAIAIgVBA3RqIAI5AwBBACEGIARBACAFQQFqIAUgCCgCAEF/akYbNgIAIAAgCSsDACAAKwPY2AGgIgM5A9jYASAHQQFqIgdBCEYEfANAIAAgBkGgAmxqIgQCfyAAIAZBA3RqQcDOAWor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ASAJIAhBgIAEcxCdBCAAQTAgECAMQQAQnQQgACALIAwQmgQgAEEgIAEgCSAIQYDAAHMQnQQMAQsLQQAhDgsgB0HQAGokACAOCxgAIAAtAABBIHFFBEAgASACIAAQkAQaCwtKAQN/IAAoAgAsAABBUGpBCkkEQANAIAAoAgAiASwAACEDIAAgAUEBajYCACADIAJBCmxqQVBqIQIgASwAAUFQakEKSQ0ACwsgAgujAgACQAJAIAFBFEsNACABQXdqIgFBCUsNAAJAAkACQAJAAkACQAJAAkAgAUEBaw4JAQIJAwQFBgkHAAsgAiACKAIAIgFBBGo2AgAgACABKAIANgIADwsgAiACKAIAIgFBBGo2AgAgACABNAIANwMADwsgAiACKAIAIgFBBGo2AgAgACABNQIANwMADwsgAiACKAIAIgFBBGo2AgAgACABMgEANwMADwsgAiACKAIAIgFBBGo2AgAgACABMwEANwMADwsgAiACKAIAIgFBBGo2AgAgACABMAAANwMADwsgAiACKAIAIgFBBGo2AgAgACABMQAANwMADwsgACACIAMRAgALDwsgAiACKAIAQQdqQXhxIgFBCGo2AgAgACABKQMANwMAC3sBAX8jAEGAAmsiBSQAAkAgAiADTA0AIARBgMAEcQ0AIAUgASACIANrIgRBgAIgBEGAAkkiARsQygkaIAAgBSABBH8gBAUgAiADayEBA0AgACAFQYACEJoEIARBgH5qIgRB/wFLDQALIAFB/wFxCxCaBAsgBUGAAmokAAstACAAUEUEQANAIAFBf2oiASAAp0EHcUEwcjoAACAAQgOIIgBCAFINAAsLIAELNQAgAFBFBEADQCABQX9qIgEgAKdBD3FB4PIAai0AACACcjoAACAAQgSIIgBCAFINAAsLIAELgwECA38BfgJAIABCgICAgBBUBEAgACEFDAELA0AgAUF/aiIBIAAgAEIKgCIFQgp+fadBMHI6AAAgAEL/////nwFWIQIgBSEAIAINAAsLIAWnIgIEQANAIAFBf2oiASACIAJBCm4iA0EKbGtBMHI6AAAgAkEJSyEEIAMhAiAEDQALCyABCxEAIAAgASACQdQEQdUEEJgEC4cXAxF/An4BfCMAQbAEayIJJAAgCUEANgIsAn8gAb0iF0J/VwRAIAGaIgG9IRdBASEUQfDyAAwBCyAEQYAQcQRAQQEhFEHz8gAMAQtB9vIAQfHyACAEQQFxIhQbCyEWAkAgF0KAgICAgICA+P8Ag0KAgICAgICA+P8AUQRAIABBICACIBRBA2oiDyAEQf//e3EQnQQgACAWIBQQmgQgAEGL8wBBj/MAIAVBBXZBAXEiAxtBg/MAQYfzACADGyABIAFiG0EDEJoEDAELIAlBEGohEgJAAn8CQCABIAlBLGoQlwQiASABoCIBRAAAAAAAAAAAYgRAIAkgCSgCLCIGQX9qNgIsIAVBIHIiEUHhAEcNAQwDCyAFQSByIhFB4QBGDQIgCSgCLCELQQYgAyADQQBIGwwBCyAJIAZBY2oiCzYCLCABRAAAAAAAALBBoiEBQQYgAyADQQBIGwshCiAJQTBqIAlB0AJqIAtBAEgbIg0hCANAIAgCfyABRAAAAAAAAPBBYyABRAAAAAAAAAAAZnEEQCABqwwBC0EACyIDNgIAIAhBBGohCCABIAO4oUQAAAAAZc3NQaIiAUQAAAAAAAAAAGINAAsCQCALQQFIBEAgCCEGIA0hBwwBCyANIQcDQCALQR0gC0EdSBshDAJAIAhBfGoiBiAHSQ0AIAytIRhCACEXA0AgBiAXQv////8PgyAGNQIAIBiGfCIXIBdCgJTr3AOAIhdCgJTr3AN+fT4CACAGQXxqIgYgB08NAAsgF6ciA0UNACAHQXxqIgcgAzYCAAsDQCAIIgYgB0sEQCAGQXxqIggoAgBFDQELCyAJIAkoAiwgDGsiCzYCLCAGIQggC0EASg0ACwsgC0F/TARAIApBGWpBCW1BAWohFSARQeYARiEPA0BBCUEAIAtrIAtBd0gbIRMCQCAHIAZPBEAgByAHQQRqIAcoAgAbIQcMAQtBgJTr3AMgE3YhDkF/IBN0QX9zIQxBACELIAchCANAIAggCCgCACIDIBN2IAtqNgIAIAMgDHEgDmwhCyAIQQRqIgggBkkNAAsgByAHQQRqIAcoAgAbIQcgC0UNACAGIAs2AgAgBkEEaiEGCyAJIAkoAiwgE2oiCzYCLCANIAcgDxsiAyAVQQJ0aiAGIAYgA2tBAnUgFUobIQYgC0EASA0ACwtBACEIAkAgByAGTw0AIA0gB2tBAnVBCWwhCEEKIQsgBygCACIDQQpJDQADQCAIQQFqIQggAyALQQpsIgtPDQALCyAKQQAgCCARQeYARhtrIBFB5wBGIApBAEdxayIDIAYgDWtBAnVBCWxBd2pIBEAgA0GAyABqIg5BCW0iDEECdCANakGEYGohEEEKIQMgDiAMQQlsayILQQdMBEADQCADQQpsIQMgC0EHSCEMIAtBAWohCyAMDQALCwJAQQAgBiAQQQRqIhVGIBAoAgAiDyAPIANuIg4gA2xrIhMbDQBEAAAAAAAA4D9EAAAAAAAA8D9EAAAAAAAA+D8gEyADQQF2IgxGG0QAAAAAAAD4PyAGIBVGGyATIAxJGyEZRAEAAAAAAEBDRAAAAAAAAEBDIA5BAXEbIQECQCAURQ0AIBYtAABBLUcNACAZmiEZIAGaIQELIBAgDyATayIMNgIAIAEgGaAgAWENACAQIAMgDGoiAzYCACADQYCU69wDTwRAA0AgEEEANgIAIBBBfGoiECAHSQRAIAdBfGoiB0EANgIACyAQIBAoAgBBAWoiAzYCACADQf+T69wDSw0ACwsgDSAHa0ECdUEJbCEIQQohCyAHKAIAIgNBCkkNAANAIAhBAWohCCADIAtBCmwiC08NAAsLIBBBBGoiAyAGIAYgA0sbIQYLAn8DQEEAIAYiDCAHTQ0BGiAMQXxqIgYoAgBFDQALQQELIRACQCARQecARwRAIARBCHEhEQwBCyAIQX9zQX8gCkEBIAobIgYgCEogCEF7SnEiAxsgBmohCkF/QX4gAxsgBWohBSAEQQhxIhENAEEJIQYCQCAQRQ0AIAxBfGooAgAiDkUNAEEKIQNBACEGIA5BCnANAANAIAZBAWohBiAOIANBCmwiA3BFDQALCyAMIA1rQQJ1QQlsQXdqIQMgBUEgckHmAEYEQEEAIREgCiADIAZrIgNBACADQQBKGyIDIAogA0gbIQoMAQtBACERIAogAyAIaiAGayIDQQAgA0EAShsiAyAKIANIGyEKCyAKIBFyIhNBAEchDyAAQSAgAgJ/IAhBACAIQQBKGyAFQSByIg5B5gBGDQAaIBIgCCAIQR91IgNqIANzrSASEKAEIgZrQQFMBEADQCAGQX9qIgZBMDoAACASIAZrQQJIDQALCyAGQX5qIhUgBToAACAGQX9qQS1BKyAIQQBIGzoAACASIBVrCyAKIBRqIA9qakEBaiIPIAQQnQQgACAWIBQQmgQgAEEwIAIgDyAEQYCABHMQnQQCQAJAAkAgDkHmAEYEQCAJQRBqQQhyIQMgCUEQakEJciEIIA0gByAHIA1LGyIFIQcDQCAHNQIAIAgQoAQhBgJAIAUgB0cEQCAGIAlBEGpNDQEDQCAGQX9qIgZBMDoAACAGIAlBEGpLDQALDAELIAYgCEcNACAJQTA6ABggAyEGCyAAIAYgCCAGaxCaBCAHQQRqIgcgDU0NAAsgEwRAIABBk/MAQQEQmgQLIAcgDE8NASAKQQFIDQEDQCAHNQIAIAgQoAQiBiAJQRBqSwRAA0AgBkF/aiIGQTA6AAAgBiAJQRBqSw0ACwsgACAGIApBCSAKQQlIGxCaBCAKQXdqIQYgB0EEaiIHIAxPDQMgCkEJSiEDIAYhCiADDQALDAILAkAgCkEASA0AIAwgB0EEaiAQGyEFIAlBEGpBCHIhAyAJQRBqQQlyIQ0gByEIA0AgDSAINQIAIA0QoAQiBkYEQCAJQTA6ABggAyEGCwJAIAcgCEcEQCAGIAlBEGpNDQEDQCAGQX9qIgZBMDoAACAGIAlBEGpLDQALDAELIAAgBkEBEJoEIAZBAWohBiARRUEAIApBAUgbDQAgAEGT8wBBARCaBAsgACAGIA0gBmsiBiAKIAogBkobEJoEIAogBmshCiAIQQRqIgggBU8NASAKQX9KDQALCyAAQTAgCkESakESQQAQnQQgACAVIBIgFWsQmgQMAgsgCiEGCyAAQTAgBkEJakEJQQAQnQQLDAELIBZBCWogFiAFQSBxIg0bIQwCQCADQQtLDQBBDCADayIGRQ0ARAAAAAAAACBAIRkDQCAZRAAAAAAAADBAoiEZIAZBf2oiBg0ACyAMLQAAQS1GBEAgGSABmiAZoaCaIQEMAQsgASAZoCAZoSEBCyASIAkoAiwiBiAGQR91IgZqIAZzrSASEKAEIgZGBEAgCUEwOgAPIAlBD2ohBgsgFEECciEKIAkoAiwhCCAGQX5qIg4gBUEPajoAACAGQX9qQS1BKyAIQQBIGzoAACAEQQhxIQggCUEQaiEHA0AgByIFAn8gAZlEAAAAAAAA4EFjBEAgAaoMAQtBgICAgHgLIgZB4PIAai0AACANcjoAACABIAa3oUQAAAAAAAAwQKIhAQJAIAVBAWoiByAJQRBqa0EBRw0AAkAgCA0AIANBAEoNACABRAAAAAAAAAAAYQ0BCyAFQS46AAEgBUECaiEHCyABRAAAAAAAAAAAYg0ACyAAQSAgAiAKAn8CQCADRQ0AIAcgCWtBbmogA04NACADIBJqIA5rQQJqDAELIBIgCUEQamsgDmsgB2oLIgNqIg8gBBCdBCAAIAwgChCaBCAAQTAgAiAPIARBgIAEcxCdBCAAIAlBEGogByAJQRBqayIFEJoEIABBMCADIAUgEiAOayIDamtBAEEAEJ0EIAAgDiADEJoECyAAQSAgAiAPIARBgMAAcxCdBCAJQbAEaiQAIAIgDyAPIAJIGwspACABIAEoAgBBD2pBcHEiAUEQajYCACAAIAEpAwAgASkDCBDHBDkDAAsQACAAIAEgAkEAQQAQmAQaCwwAQaT3AhARQaz3AgtZAQF/IAAgAC0ASiIBQX9qIAFyOgBKIAAoAgAiAUEIcQRAIAAgAUEgcjYCAEF/DwsgAEIANwIEIAAgACgCLCIBNgIcIAAgATYCFCAAIAEgACgCMGo2AhBBAAsmAQF/IwBBEGsiAiQAIAIgATYCDCAAQdTfACABEKQEIAJBEGokAAt6AQF/IAAoAkxBAEgEQAJAIAAsAEtBCkYNACAAKAIUIgEgACgCEE8NACAAIAFBAWo2AhQgAUEKOgAADwsgABDABA8LAkACQCAALABLQQpGDQAgACgCFCIBIAAoAhBPDQAgACABQQFqNgIUIAFBCjoAAAwBCyAAEMAECwtgAgJ/AX4gACgCKCEBQQEhAiAAQgAgAC0AAEGAAXEEf0ECQQEgACgCFCAAKAIcSxsFQQELIAERHAAiA0IAWQR+IAAoAhQgACgCHGusIAMgACgCCCAAKAIEa6x9fAUgAwsLGAAgACgCTEF/TARAIAAQqQQPCyAAEKkECyQBAX4gABCqBCIBQoCAgIAIWQRAQeD2AkE9NgIAQX8PCyABpwt8AQJ/IAAgAC0ASiIBQX9qIAFyOgBKIAAoAhQgACgCHEsEQCAAQQBBACAAKAIkEQQAGgsgAEEANgIcIABCADcDECAAKAIAIgFBBHEEQCAAIAFBIHI2AgBBfw8LIAAgACgCLCAAKAIwaiICNgIIIAAgAjYCBCABQRt0QR91C78BAQN/IAMoAkxBAE4Ef0EBBUEACxogAyADLQBKIgVBf2ogBXI6AEoCfyABIAJsIgUgAygCCCADKAIEIgZrIgRBAUgNABogACAGIAQgBSAEIAVJGyIEEMkJGiADIAMoAgQgBGo2AgQgACAEaiEAIAUgBGsLIgQEQANAAkAgAxCsBEUEQCADIAAgBCADKAIgEQQAIgZBAWpBAUsNAQsgBSAEayABbg8LIAAgBmohACAEIAZrIgQNAAsLIAJBACABGwt9ACACQQFGBEAgASAAKAIIIAAoAgRrrH0hAQsCQCAAKAIUIAAoAhxLBEAgAEEAQQAgACgCJBEEABogACgCFEUNAQsgAEEANgIcIABCADcDECAAIAEgAiAAKAIoERwAQgBTDQAgAEIANwIEIAAgACgCAEFvcTYCAEEADwtBfwsgACAAKAJMQX9MBEAgACABIAIQrgQPCyAAIAEgAhCuBAsNACAAIAGsQQAQrwQaCwkAIAAoAjwQEwteAQF/IAAoAkxBAEgEQCAAKAIEIgEgACgCCEkEQCAAIAFBAWo2AgQgAS0AAA8LIAAQwwQPCwJ/IAAoAgQiASAAKAIISQRAIAAgAUEBajYCBCABLQAADAELIAAQwwQLC48BAQN/IAAhAQJAAkAgAEEDcUUNACAALQAARQRADAILA0AgAUEBaiIBQQNxRQ0BIAEtAAANAAsMAQsDQCABIgJBBGohASACKAIAIgNBf3MgA0H//ft3anFBgIGChHhxRQ0ACyADQf8BcUUEQCACIQEMAQsDQCACLQABIQMgAkEBaiIBIQIgAw0ACwsgASAAawvbAQECfwJAIAFB/wFxIgMEQCAAQQNxBEADQCAALQAAIgJFDQMgAiABQf8BcUYNAyAAQQFqIgBBA3ENAAsLAkAgACgCACICQX9zIAJB//37d2pxQYCBgoR4cQ0AIANBgYKECGwhAwNAIAIgA3MiAkF/cyACQf/9+3dqcUGAgYKEeHENASAAKAIEIQIgAEEEaiEAIAJB//37d2ogAkF/c3FBgIGChHhxRQ0ACwsDQCAAIgItAAAiAwRAIAJBAWohACADIAFB/wFxRw0BCwsgAg8LIAAQswQgAGoPCyAACxoAIAAgARC0BCIAQQAgAC0AACABQf8BcUYbC4ABAQJ/QQIhAAJ/QcXfAEErELUERQRAQcXfAC0AAEHyAEchAAsgAEGAAXILIABBxd8AQfgAELUEGyIAQYCAIHIgAEHF3wBB5QAQtQQbIgAgAEHAAHJBxd8ALQAAIgBB8gBGGyIBQYAEciABIABB9wBGGyIBQYAIciABIABB4QBGGwuVAQECfyMAQRBrIgIkAAJAAkBBlfMAQcXfACwAABC1BEUEQEHg9gJBHDYCAAwBCxC2BCEBIAJBtgM2AgggAiAANgIAIAIgAUGAgAJyNgIEQQAhAEEFIAIQFCIBQYFgTwRAQeD2AkEAIAFrNgIAQX8hAQsgAUEASA0BIAEQvgQiAA0BIAEQExoLQQAhAAsgAkEQaiQAIAALuwEBAn8jAEGgAWsiBCQAIARBCGpBoPMAQZABEMkJGgJAAkAgAUF/akH/////B08EQCABDQFBASEBIARBnwFqIQALIAQgADYCNCAEIAA2AhwgBEF+IABrIgUgASABIAVLGyIBNgI4IAQgACABaiIANgIkIAQgADYCGCAEQQhqIAIgAxChBCEAIAFFDQEgBCgCHCIBIAEgBCgCGEZrQQA6AAAMAQtB4PYCQT02AgBBfyEACyAEQaABaiQAIAALNAEBfyAAKAIUIgMgASACIAAoAhAgA2siASABIAJLGyIBEMkJGiAAIAAoAhQgAWo2AhQgAgueAQEEfyAAKAJMQQBOBH9BAQVBAAsaIAAoAgBBAXEiBEUEQBClBCEBIAAoAjQiAgRAIAIgACgCODYCOAsgACgCOCIDBEAgAyACNgI0CyAAIAEoAgBGBEAgASADNgIAC0Gk9wIQEgsgABDBBCEBIAAgACgCDBEAACECIAAoAmAiAwRAIAMQvgkLIAEgAnIhASAERQRAIAAQvgkgAQ8LIAELBABBAAsEAEIAC/cBAQR/IwBBIGsiAyQAIAMgATYCECADIAIgACgCMCIEQQBHazYCFCAAKAIsIQUgAyAENgIcIAMgBTYCGAJAAkACfwJ/QQAgACgCPCADQRBqQQIgA0EMahAXIgRFDQAaQeD2AiAENgIAQX8LBEAgA0F/NgIMQX8MAQsgAygCDCIEQQBKDQEgBAshAiAAIAAoAgAgAkEwcUEQc3I2AgAMAQsgBCADKAIUIgZNBEAgBCECDAELIAAgACgCLCIFNgIEIAAgBSAEIAZrajYCCCAAKAIwRQ0AIAAgBUEBajYCBCABIAJqQX9qIAUtAAA6AAALIANBIGokACACC/UCAQN/IwBBMGsiAiQAAn8CQAJAQbT0AEHF3wAsAAAQtQRFBEBB4PYCQRw2AgAMAQtBmAkQvQkiAQ0BC0EADAELIAFBAEGQARDKCRpBxd8AQSsQtQRFBEAgAUEIQQRBxd8ALQAAQfIARhs2AgALAkBBxd8ALQAAQeEARwRAIAEoAgAhAwwBCyACQQM2AiQgAiAANgIgQd0BIAJBIGoQFSIDQYAIcUUEQCACQQQ2AhQgAiAANgIQIAIgA0GACHI2AhhB3QEgAkEQahAVGgsgASABKAIAQYABciIDNgIACyABQf8BOgBLIAFBgAg2AjAgASAANgI8IAEgAUGYAWo2AiwCQCADQQhxDQAgAkGTqAE2AgQgAiAANgIAIAIgAkEoajYCCEE2IAIQFg0AIAFBCjoASwsgAUHTBDYCKCABQdIENgIkIAFB2QQ2AiAgAUHRBDYCDEHo9gIoAgBFBEAgAUF/NgJMCyABEMQECyEAIAJBMGokACAAC+8CAQZ/IwBBIGsiAyQAIAMgACgCHCIFNgIQIAAoAhQhBCADIAI2AhwgAyABNgIYIAMgBCAFayIBNgIUIAEgAmohBUECIQYgA0EQaiEBAn8CQAJAAn9BACAAKAI8IANBEGpBAiADQQxqEBgiBEUNABpB4PYCIAQ2AgBBfwtFBEADQCAFIAMoAgwiBEYNAiAEQX9MDQMgAUEIaiABIAQgASgCBCIHSyIIGyIBIAQgB0EAIAgbayIHIAEoAgBqNgIAIAEgASgCBCAHazYCBCAFIARrIQUCf0EAIAAoAjwgASAGIAhrIgYgA0EMahAYIgRFDQAaQeD2AiAENgIAQX8LRQ0ACwsgA0F/NgIMIAVBf0cNAQsgACAAKAIsIgE2AhwgACABNgIUIAAgASAAKAIwajYCECACDAELIABBADYCHCAAQgA3AxAgACAAKAIAQSByNgIAQQAgBkECRg0AGiACIAEoAgRrCyEAIANBIGokACAAC38BA38jAEEQayIBJAAgAUEKOgAPAkAgACgCECICRQRAIAAQpgQNASAAKAIQIQILAkAgACgCFCIDIAJPDQAgACwAS0EKRg0AIAAgA0EBajYCFCADQQo6AAAMAQsgACABQQ9qQQEgACgCJBEEAEEBRw0AIAEtAA8aCyABQRBqJAALfgECfyAABEAgACgCTEF/TARAIAAQwgQPCyAAEMIEDwtBoO0CKAIABEBBoO0CKAIAEMEEIQELEKUEKAIAIgAEQANAIAAoAkxBAE4Ef0EBBUEACxogACgCFCAAKAIcSwRAIAAQwgQgAXIhAQsgACgCOCIADQALC0Gk9wIQEiABC2kBAn8CQCAAKAIUIAAoAhxNDQAgAEEAQQAgACgCJBEEABogACgCFA0AQX8PCyAAKAIEIgEgACgCCCICSQRAIAAgASACa6xBASAAKAIoERwAGgsgAEEANgIcIABCADcDECAAQgA3AgRBAAtBAQJ/IwBBEGsiASQAQX8hAgJAIAAQrAQNACAAIAFBD2pBASAAKAIgEQQAQQFHDQAgAS0ADyECCyABQRBqJAAgAgsxAQJ/IAAQpQQiASgCADYCOCABKAIAIgIEQCACIAA2AjQLIAEgADYCAEGk9wIQEiAAC1ABAX4CQCADQcAAcQRAIAIgA0FAaq2IIQFCACECDAELIANFDQAgAkHAACADa62GIAEgA60iBIiEIQEgAiAEiCECCyAAIAE3AwAgACACNwMIC1ABAX4CQCADQcAAcQRAIAEgA0FAaq2GIQJCACEBDAELIANFDQAgAiADrSIEhiABQcAAIANrrYiEIQIgASAEhiEBCyAAIAE3AwAgACACNwMIC9kDAgJ/An4jAEEgayICJAACQCABQv///////////wCDIgVCgICAgICAwP9DfCAFQoCAgICAgMCAvH98VARAIAFCBIYgAEI8iIQhBCAAQv//////////D4MiAEKBgICAgICAgAhaBEAgBEKBgICAgICAgMAAfCEEDAILIARCgICAgICAgIBAfSEEIABCgICAgICAgIAIhUIAUg0BIARCAYMgBHwhBAwBCyAAUCAFQoCAgICAgMD//wBUIAVCgICAgICAwP//AFEbRQRAIAFCBIYgAEI8iIRC/////////wODQoCAgICAgID8/wCEIQQMAQtCgICAgICAgPj/ACEEIAVC////////v//DAFYNAEIAIQQgBUIwiKciA0GR9wBJDQAgAiAAIAFC////////P4NCgICAgICAwACEIgRBgfgAIANrEMUEIAJBEGogACAEIANB/4h/ahDGBCACKQMIQgSGIAIpAwAiAEI8iIQhBCACKQMQIAIpAxiEQgBSrSAAQv//////////D4OEIgBCgYCAgICAgIAIWgRAIARCAXwhBAwBCyAAQoCAgICAgICACIVCAFINACAEQgGDIAR8IQQLIAJBIGokACAEIAFCgICAgICAgICAf4OEvwuSAQEDfEQAAAAAAADwPyAAIACiIgJEAAAAAAAA4D+iIgOh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AmshAgwBCyABIAA5AwAgASAEKQMINwMICyAEQTBqJAAgAguZAQEDfCAAIACiIgMgAyADoqIgA0R81c9aOtnlPaJE65wriublWr6goiADIANEff6xV+Mdxz6iRNVhwRmgASq/oKJEpvgQERERgT+goCEFIAMgAKIhBCACRQRAIAQgAyAFokRJVVVVVVXFv6CiIACgDwsgACADIAFEAAAAAAAA4D+iIAUgBKKhoiABoSAERElVVVVVVcU/oqChC9ABAQJ/IwBBEGsiASQAAnwgAL1CIIinQf////8HcSICQfvDpP8DTQRARAAAAAAAAPA/IAJBnsGa8gNJDQEaIABEAAAAAAAAAAAQyAQMAQsgACAAoSACQYCAwP8HTw0AGiAAIAEQygRBA3EiAkECTQRAAkACQAJAIAJBAWsOAgECAAsgASsDACABKwMIEMgEDAMLIAErAwAgASsDCEEBEMsEmgwCCyABKwMAIAErAwgQyASaDAELIAErAwAgASsDCEEBEMsECyEAIAFBEGokACAAC08BAXwgACAAoiIAIAAgAKIiAaIgAERpUO7gQpP5PqJEJx4P6IfAVr+goiABREI6BeFTVaU/oiAARIFeDP3//9+/okQAAAAAAADwP6CgoLYLSwECfCAAIACiIgEgAKIiAiABIAGioiABRKdGO4yHzcY+okR058ri+QAqv6CiIAIgAUSy+26JEBGBP6JEd6zLVFVVxb+goiAAoKC2C4YCAgN/AXwjAEEQayIDJAACQCAAvCIEQf////8HcSICQdqfpO4ETQRAIAEgALsiBSAFRIPIyW0wX+Q/okQAAAAAAAA4Q6BEAAAAAAAAOMOgIgVEAAAAUPsh+b+ioCAFRGNiGmG0EFG+oqA5AwAgBZlEAAAAAAAA4EFjBEAgBaohAgwCC0GAgICAeCECDAELIAJBgICA/AdPBEAgASAAIACTuzkDAEEAIQIMAQsgAyACIAJBF3ZB6n5qIgJBF3Rrvrs5AwggA0EIaiADIAJBAUEAEMkEIQIgAysDACEFIARBf0wEQCABIAWaOQMAQQAgAmshAgwBCyABIAU5AwALIANBEGokACACC/wCAgN/AXwjAEEQayICJAACfSAAvCIDQf////8HcSIBQdqfpPoDTQRAQwAAgD8gAUGAgIDMA0kNARogALsQzQQMAQsgAUHRp+2DBE0EQCAAuyEEIAFB5JfbgARPBEBEGC1EVPshCUBEGC1EVPshCcAgA0EASBsgBKAQzQSMDAILIANBf0wEQCAERBgtRFT7Ifk/oBDOBAwCC0QYLURU+yH5PyAEoRDOBAwBCyABQdXjiIcETQRAIAFB4Nu/hQRPBEBEGC1EVPshGUBEGC1EVPshGcAgA0EASBsgALugEM0EDAILIANBf0wEQETSITN/fNkSwCAAu6EQzgQMAgsgALtE0iEzf3zZEsCgEM4EDAELIAAgAJMgAUGAgID8B08NABogACACQQhqEM8EQQNxIgFBAk0EQAJAAkACQCABQQFrDgIBAgALIAIrAwgQzQQMAwsgAisDCJoQzgQMAgsgAisDCBDNBIwMAQsgAisDCBDOBAshACACQRBqJAAgAAvUAQECfyMAQRBrIgEkAAJAIAC9QiCIp0H/////B3EiAkH7w6T/A00EQCACQYCAwPIDSQ0BIABEAAAAAAAAAABBABDLBCEADAELIAJBgIDA/wdPBEAgACAAoSEADAELIAAgARDKBEEDcSICQQJNBEACQAJAAkAgAkEBaw4CAQIACyABKwMAIAErAwhBARDLBCEADAMLIAErAwAgASsDCBDIBCEADAILIAErAwAgASsDCEEBEMsEmiEADAELIAErAwAgASsDCBDIBJohAAsgAUEQaiQAIAALkgMCA38BfCMAQRBrIgIkAAJAIAC8IgNB/////wdxIgFB2p+k+gNNBEAgAUGAgIDMA0kNASAAuxDOBCEADAELIAFB0aftgwRNBEAgALshBCABQeOX24AETQRAIANBf0wEQCAERBgtRFT7Ifk/oBDNBIwhAAwDCyAERBgtRFT7Ifm/oBDNBCEADAILRBgtRFT7IQlARBgtRFT7IQnAIANBAEgbIASgmhDOBCEADAELIAFB1eOIhwRNBEAgALshBCABQd/bv4UETQRAIANBf0wEQCAERNIhM3982RJAoBDNBCEADAMLIARE0iEzf3zZEsCgEM0EjCEADAILRBgtRFT7IRlARBgtRFT7IRnAIANBAEgbIASgEM4EIQAMAQsgAUGAgID8B08EQCAAIACTIQAMAQsgACACQQhqEM8EQQNxIgFBAk0EQAJAAkACQCABQQFrDgIBAgALIAIrAwgQzgQhAAwDCyACKwMIEM0EIQAMAgsgAisDCJoQzgQhAAwBCyAC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IAQLywECBH8CfiMAQRBrIgMkACABvCIEQYCAgIB4cSEFAn4gBEH/////B3EiAkGAgIB8akH////3B00EQCACrUIZhkKAgICAgICAwD98DAELIAJBgICA/AdPBEAgBK1CGYZCgICAgICAwP//AIQMAQsgAkUEQEIADAELIAMgAq1CACACZyICQdEAahDGBCADKQMAIQYgAykDCEKAgICAgIDAAIVBif8AIAJrrUIwhoQLIQcgACAGNwMAIAAgByAFrUIghoQ3AwggA0EQaiQAC54LAgV/D34jAEHgAGsiBSQAIARCL4YgA0IRiIQhDyACQiCGIAFCIIiEIQ0gBEL///////8/gyIOQg+GIANCMYiEIRAgAiAEhUKAgICAgICAgIB/gyEKIA5CEYghESACQv///////z+DIgtCIIghEiAEQjCIp0H//wFxIQcCQAJ/IAJCMIinQf//AXEiCUF/akH9/wFNBEBBACAHQX9qQf7/AUkNARoLIAFQIAJC////////////AIMiDEKAgICAgIDA//8AVCAMQoCAgICAgMD//wBRG0UEQCACQoCAgICAgCCEIQoMAgsgA1AgBEL///////////8AgyICQoCAgICAgMD//wBUIAJCgICAgICAwP//AFEbRQRAIARCgICAgICAIIQhCiADIQEMAgsgASAMQoCAgICAgMD//wCFhFAEQCACIAOEUARAQoCAgICAgOD//wAhCkIAIQEMAwsgCkKAgICAgIDA//8AhCEKQgAhAQwCCyADIAJCgICAgICAwP//AIWEUARAIAEgDIQhAkIAIQEgAlAEQEKAgICAgIDg//8AIQoMAwsgCkKAgICAgIDA//8AhCEKDAILIAEgDIRQBEBCACEBDAILIAIgA4RQBEBCACEBDAILIAxC////////P1gEQCAFQdAAaiABIAsgASALIAtQIgYbeSAGQQZ0rXynIgZBcWoQxgQgBSkDWCILQiCGIAUpA1AiAUIgiIQhDSALQiCIIRJBECAGayEGCyAGIAJC////////P1YNABogBUFAayADIA4gAyAOIA5QIggbeSAIQQZ0rXynIghBcWoQxgQgBSkDSCICQg+GIAUpA0AiA0IxiIQhECACQi+GIANCEYiEIQ8gAkIRiCERIAYgCGtBEGoLIQYgD0L/////D4MiAiABQv////8PgyIBfiIPIANCD4ZCgID+/w+DIgMgDUL/////D4MiDH58IgRCIIYiDiABIAN+fCINIA5UrSACIAx+IhUgAyALQv////8PgyILfnwiEyAQQv////8PgyIOIAF+fCIQIAQgD1StQiCGIARCIIiEfCIUIAIgC34iFiADIBJCgIAEhCIPfnwiAyAMIA5+fCISIAEgEUL/////B4NCgICAgAiEIgF+fCIRQiCGfCIXfCEEIAcgCWogBmpBgYB/aiEGAkAgCyAOfiIYIAIgD358IgIgGFStIAIgASAMfnwiDCACVK18IAwgEyAVVK0gECATVK18fCICIAxUrXwgASAPfnwgASALfiILIA4gD358IgEgC1StQiCGIAFCIIiEfCACIAFCIIZ8IgEgAlStfCABIBEgElStIAMgFlStIBIgA1StfHxCIIYgEUIgiIR8IgMgAVStfCADIBQgEFStIBcgFFStfHwiAiADVK18IgFCgICAgICAwACDUEUEQCAGQQFqIQYMAQsgDUI/iCEDIAFCAYYgAkI/iIQhASACQgGGIARCP4iEIQIgDUIBhiENIAMgBEIBhoQhBAsgBkH//wFOBEAgCkKAgICAgIDA//8AhCEKQgAhAQwBCwJ+IAZBAEwEQEEBIAZrIgdB/wBNBEAgBUEQaiANIAQgBxDFBCAFQSBqIAIgASAGQf8AaiIGEMYEIAVBMGogDSAEIAYQxgQgBSACIAEgBxDFBCAFKQMwIAUpAziEQgBSrSAFKQMgIAUpAxCEhCENIAUpAyggBSkDGIQhBCAFKQMAIQIgBSkDCAwCC0IAIQEMAgsgAUL///////8/gyAGrUIwhoQLIAqEIQogDVAgBEJ/VSAEQoCAgICAgICAgH9RG0UEQCAKIAJCAXwiASACVK18IQoMAQsgDSAEQoCAgICAgICAgH+FhFBFBEAgAiEBDAELIAogAiACQgGDfCIBIAJUrXwhCgsgACABNwMAIAAgCjcDCCAFQeAAaiQAC38CAn8BfiMAQRBrIgMkACAAAn4gAUUEQEIADAELIAMgASABQR91IgJqIAJzIgKtQgAgAmciAkHRAGoQxgQgAykDCEKAgICAgIDAAIVBnoABIAJrrUIwhnwgAUGAgICAeHGtQiCGhCEEIAMpAwALNwMAIAAgBDcDCCADQRBqJAALyAkCBH8EfiMAQfAAayIFJAAgBEL///////////8AgyEKAkACQCABQn98IgtCf1EgAkL///////////8AgyIJIAsgAVStfEJ/fCILQv///////7///wBWIAtC////////v///AFEbRQRAIANCf3wiC0J/UiAKIAsgA1StfEJ/fCILQv///////7///wBUIAtC////////v///AFEbDQELIAFQIAlCgICAgICAwP//AFQgCUKAgICAgIDA//8AURtFBEAgAkKAgICAgIAghCEEIAEhAwwCCyADUCAKQoCAgICAgMD//wBUIApCgICAgICAwP//AFEbRQRAIARCgICAgICAIIQhBAwCCyABIAlCgICAgICAwP//AIWEUARAQoCAgICAgOD//wAgAiABIAOFIAIgBIVCgICAgICAgICAf4WEUCIGGyEEQgAgASAGGyEDDAILIAMgCkKAgICAgIDA//8AhYRQDQEgASAJhFAEQCADIAqEQgBSDQIgASADgyEDIAIgBIMhBAwCCyADIAqEUEUNACABIQMgAiEEDAELIAMgASADIAFWIAogCVYgCSAKURsiBxshCiAEIAIgBxsiC0L///////8/gyEJIAIgBCAHGyICQjCIp0H//wFxIQggC0IwiKdB//8BcSIGRQRAIAVB4ABqIAogCSAKIAkgCVAiBht5IAZBBnStfKciBkFxahDGBCAFKQNoIQkgBSkDYCEKQRAgBmshBgsgASADIAcbIQMgAkL///////8/gyEBIAgEfiABBSAFQdAAaiADIAEgAyABIAFQIgcbeSAHQQZ0rXynIgdBcWoQxgRBECAHayEIIAUpA1AhAyAFKQNYC0IDhiADQj2IhEKAgICAgICABIQhBCAJQgOGIApCPYiEIQEgAiALhSEMAn4gA0IDhiIDIAYgCGsiB0UNABogB0H/AEsEQEIAIQRCAQwBCyAFQUBrIAMgBEGAASAHaxDGBCAFQTBqIAMgBCAHEMUEIAUpAzghBCAFKQMwIAUpA0AgBSkDSIRCAFKthAshAyABQoCAgICAgIAEhCEJIApCA4YhAgJAIAxCf1cEQCACIAN9IgEgCSAEfSACIANUrX0iA4RQBEBCACEDQgAhBAwDCyADQv////////8DVg0BIAVBIGogASADIAEgAyADUCIHG3kgB0EGdK18p0F0aiIHEMYEIAYgB2shBiAFKQMoIQMgBSkDICEBDAELIAIgA3wiASADVK0gBCAJfHwiA0KAgICAgICACINQDQAgAUIBgyADQj+GIAFCAYiEhCEBIAZBAWohBiADQgGIIQMLIAtCgICAgICAgICAf4MhAiAGQf//AU4EQCACQoCAgICAgMD//wCEIQRCACEDDAELQQAhBwJAIAZBAEoEQCAGIQcMAQsgBUEQaiABIAMgBkH/AGoQxgQgBSABIANBASAGaxDFBCAFKQMAIAUpAxAgBSkDGIRCAFKthCEBIAUpAwghAwsgA0I9hiABQgOIhCIEIAGnQQdxIgZBBEutfCIBIARUrSADQgOIQv///////z+DIAKEIAetQjCGhHwgASABQgGDQgAgBkEERhsiAXwiAyABVK18IQQLIAAgAzcDACAAIAQ3AwggBUHwAGokAAuBAgICfwR+IwBBEGsiAiQAIAG9IgVCgICAgICAgICAf4MhBwJ+IAVC////////////AIMiBEKAgICAgICAeHxC/////////+//AFgEQCAEQjyGIQYgBEIEiEKAgICAgICAgDx8DAELIARCgICAgICAgPj/AFoEQCAFQjyGIQYgBUIEiEKAgICAgIDA//8AhAwBCyAEUARAQgAMAQsgAiAEQgAgBEKAgICAEFoEfyAEQiCIp2cFIAWnZ0EgagsiA0ExahDGBCACKQMAIQYgAikDCEKAgICAgIDAAIVBjPgAIANrrUIwhoQLIQQgACAGNwMAIAAgBCAHhDcDCCACQRBqJAAL2wECAX8CfkEBIQQCQCAAQgBSIAFC////////////AIMiBUKAgICAgIDA//8AViAFQoCAgICAgMD//wBRGw0AIAJCAFIgA0L///////////8AgyIGQoCAgICAgMD//wBWIAZCgICAgICAwP//AFEbDQAgACAChCAFIAaEhFAEQEEADwsgASADg0IAWQRAQX8hBCAAIAJUIAEgA1MgASADURsNASAAIAKFIAEgA4WEQgBSDwtBfyEEIAAgAlYgASADVSABIANRGw0AIAAgAoUgASADhYRCAFIhBAsgBAvYAQIBfwF+QX8hAgJAIABCAFIgAUL///////////8AgyIDQoCAgICAgMD//wBWIANCgICAgICAwP//AFEbDQAgACADQoCAgICAgID/P4SEUARAQQAPCyABQoCAgICAgID/P4NCAFkEQCAAQgBUIAFCgICAgICAgP8/UyABQoCAgICAgID/P1EbDQEgACABQoCAgICAgID/P4WEQgBSDwsgAEIAViABQoCAgICAgID/P1UgAUKAgICAgICA/z9RGw0AIAAgAUKAgICAgICA/z+FhEIAUiECCyACCzUAIAAgATcDACAAIAJC////////P4MgBEIwiKdBgIACcSACQjCIp0H//wFxcq1CMIaENwMIC2cCAX8BfiMAQRBrIgIkACAAAn4gAUUEQEIADAELIAIgAa1CAEHwACABZ0EfcyIBaxDGBCACKQMIQoCAgICAgMAAhSABQf//AGqtQjCGfCEDIAIpAwALNwMAIAAgAzcDCCACQRBqJAALRQEBfyMAQRBrIgUkACAFIAEgAiADIARCgICAgICAgICAf4UQzAUgBSkDACEBIAAgBSkDCDcDCCAAIAE3AwAgBUEQaiQAC8QCAQF/IwBB0ABrIgQkAAJAIANBgIABTgRAIARBIGogASACQgBCgICAgICAgP//ABDKBSAEKQMoIQIgBCkDICEBIANB//8BSARAIANBgYB/aiEDDAILIARBEGogASACQgBCgICAgICAgP//ABDKBSADQf3/AiADQf3/AkgbQYKAfmohAyAEKQMYIQIgBCkDECEBDAELIANBgYB/Sg0AIARBQGsgASACQgBCgICAgICAwAAQygUgBCkDSCECIAQpA0AhASADQYOAfkoEQCADQf7/AGohAwwBCyAEQTBqIAEgAkIAQoCAgICAgMAAEMoFIANBhoB9IANBhoB9ShtB/P8BaiEDIAQpAzghAiAEKQMwIQELIAQgASACQgAgA0H//wBqrUIwhhDKBSAAIAQpAwg3AwggACAEKQMANwMAIARB0ABqJAALjhECBX8MfiMAQcABayIFJAAgBEL///////8/gyESIAJC////////P4MhDCACIASFQoCAgICAgICAgH+DIREgBEIwiKdB//8BcSEHAkACQAJAIAJCMIinQf//AXEiCUF/akH9/wFNBEAgB0F/akH+/wFJDQELIAFQIAJC////////////AIMiCkKAgICAgIDA//8AVCAKQoCAgICAgMD//wBRG0UEQCACQoCAgICAgCCEIREMAgsgA1AgBEL///////////8AgyICQoCAgICAgMD//wBUIAJCgICAgICAwP//AFEbRQRAIARCgICAgICAIIQhESADIQEMAgsgASAKQoCAgICAgMD//wCFhFAEQCADIAJCgICAgICAwP//AIWEUARAQgAhAUKAgICAgIDg//8AIREMAwsgEUKAgICAgIDA//8AhCERQgAhAQwCCyADIAJCgICAgICAwP//AIWEUARAQgAhAQwCCyABIAqEUA0CIAIgA4RQBEAgEUKAgICAgIDA//8AhCERQgAhAQwCCyAKQv///////z9YBEAgBUGwAWogASAMIAEgDCAMUCIGG3kgBkEGdK18pyIGQXFqEMYEQRAgBmshBiAFKQO4ASEMIAUpA7ABIQELIAJC////////P1YNACAFQaABaiADIBIgAyASIBJQIggbeSAIQQZ0rXynIghBcWoQxgQgBiAIakFwaiEGIAUpA6gBIRIgBSkDoAEhAwsgBUGQAWogEkKAgICAgIDAAIQiFEIPhiADQjGIhCICQoTJ+c6/5ryC9QAgAn0iBBDGBSAFQYABakIAIAUpA5gBfSAEEMYFIAVB8ABqIAUpA4gBQgGGIAUpA4ABQj+IhCIEIAIQxgUgBUHgAGogBEIAIAUpA3h9EMYFIAVB0ABqIAUpA2hCAYYgBSkDYEI/iIQiBCACEMYFIAVBQGsgBEIAIAUpA1h9EMYFIAVBMGogBSkDSEIBhiAFKQNAQj+IhCIEIAIQxgUgBUEgaiAEQgAgBSkDOH0QxgUgBUEQaiAFKQMoQgGGIAUpAyBCP4iEIgQgAhDGBSAFIARCACAFKQMYfRDGBSAGIAkgB2tqIQYCfkIAIAUpAwhCAYYgBSkDAEI/iIRCf3wiCkL/////D4MiBCACQiCIIg5+IhAgCkIgiCIKIAJC/////w+DIgt+fCICQiCGIg0gBCALfnwiCyANVK0gCiAOfiACIBBUrUIghiACQiCIhHx8IAsgBCADQhGIQv////8PgyIOfiIQIAogA0IPhkKAgP7/D4MiDX58IgJCIIYiDyAEIA1+fCAPVK0gCiAOfiACIBBUrUIghiACQiCIhHx8fCICIAtUrXwgAkIAUq18fSILQv////8PgyIOIAR+IhAgCiAOfiINIAQgC0IgiCIPfnwiC0IghnwiDiAQVK0gCiAPfiALIA1UrUIghiALQiCIhHx8IA5CACACfSICQiCIIgsgBH4iECACQv////8PgyINIAp+fCICQiCGIg8gBCANfnwgD1StIAogC34gAiAQVK1CIIYgAkIgiIR8fHwiAiAOVK18IAJCfnwiECACVK18Qn98IgtC/////w+DIgIgDEIChiABQj6IhEL/////D4MiBH4iDiABQh6IQv////8PgyIKIAtCIIgiC358Ig0gDlStIA0gEEIgiCIOIAxCHohC///v/w+DQoCAEIQiDH58Ig8gDVStfCALIAx+fCACIAx+IhMgBCALfnwiDSATVK1CIIYgDUIgiIR8IA8gDUIghnwiDSAPVK18IA0gCiAOfiITIBBC/////w+DIhAgBH58Ig8gE1StIA8gAiABQgKGQvz///8PgyITfnwiFSAPVK18fCIPIA1UrXwgDyALIBN+IgsgDCAQfnwiDCAEIA5+fCIEIAIgCn58IgJCIIggAiAEVK0gDCALVK0gBCAMVK18fEIghoR8IgwgD1StfCAMIBUgDiATfiIEIAogEH58IgpCIIggCiAEVK1CIIaEfCIEIBVUrSAEIAJCIIZ8IARUrXx8IgQgDFStfCICQv////////8AWARAIAFCMYYgBEL/////D4MiASADQv////8PgyIKfiIMQgBSrX1CACAMfSIQIARCIIgiDCAKfiINIAEgA0IgiCILfnwiDkIghiIPVK19IAJC/////w+DIAp+IAEgEkL/////D4N+fCALIAx+fCAOIA1UrUIghiAOQiCIhHwgBCAUQiCIfiADIAJCIIh+fCACIAt+fCAMIBJ+fEIghnx9IRIgBkF/aiEGIBAgD30MAQsgBEIhiCELIAFCMIYgAkI/hiAEQgGIhCIEQv////8PgyIBIANC/////w+DIgp+IgxCAFKtfUIAIAx9Ig4gASADQiCIIgx+IhAgCyACQh+GhCINQv////8PgyIPIAp+fCILQiCGIhNUrX0gDCAPfiAKIAJCAYgiCkL/////D4N+fCABIBJC/////w+DfnwgCyAQVK1CIIYgC0IgiIR8IAQgFEIgiH4gAyACQiGIfnwgCiAMfnwgDSASfnxCIIZ8fSESIAohAiAOIBN9CyEBIAZBgIABTgRAIBFCgICAgICAwP//AIQhEUIAIQEMAQsgBkH//wBqIQcgBkGBgH9MBEACQCAHDQAgBCABQgGGIANWIBJCAYYgAUI/iIQiASAUViABIBRRG618IgEgBFStIAJC////////P4N8IgJCgICAgICAwACDUA0AIAIg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AQEBfwJ/IABBCGogACgCCCgCCBEAACIAIgYsAAtBAEgEQCAGKAIEDAELIAYtAAsLQQACfyAALAAXQQBIBEAgACgCEAwBCyAALQAXC2tGBEAgBCAEKAIAQQRyNgIADwsgAiADIAAgAEEYaiAFIARBABCtBiAAayEAAkAgASgCACICQQxHDQAgAA0AIAFBADYCAA8LAkAgAkELSg0AIABBDEcNACABIAJBDGo2AgALCzsAIAEgAiADIARBAhCLByEBIAMoAgAhAgJAIAFBPEoNACACQQRxDQAgACABNgIADwsgAyACQQRyNgIACzsAIAEgAiADIARBARCLByEBIAMoAgAhAgJAIAFBBkoNACACQQRxDQAgACABNgIADwsgAyACQQRyNgIACygAIAEgAiADIARBBBCLByEBIAMtAABBBHFFBEAgACABQZRxajYCAAsLSgAjAEGAAWsiAiQAIAIgAkH0AGo2AgwgAEEIaiACQRBqIAJBDGogBCAFIAYQmgcgAkEQaiACKAIMIAEQnAchACACQYABaiQAIAALYgEBfyMAQRBrIgYkACAGQQA6AA8gBiAFOgAOIAYgBDoADSAGQSU6AAwgBQRAIAZBDWogBkEOahCbBwsgAiABIAIoAgAgAWsgBkEMaiADIAAoAgAQHSABajYCACAGQRBqJAALNQEBfyMAQRBrIgIkACACIAAtAAA6AA8gACABLQAAOgAAIAEgAkEPai0AADoAACACQRBqJAALRQEBfyMAQRBrIgMkACADIAI2AggDQCAAIAFHBEAgA0EIaiAALAAAEJoFIABBAWohAAwBCwsgAygCCCEAIANBEGokACAAC0oAIwBBoANrIgIkACACIAJBoANqNgIMIABBCGogAkEQaiACQQxqIAQgBSAGEJ4HIAJBEGogAigCDCABEKEHIQAgAkGgA2okACAAC38BAX8jAEGQAWsiBiQAIAYgBkGEAWo2AhwgACAGQSBqIAZBHGogAyAEIAUQmgcgBkIANwMQIAYgBkEgajYCDCABIAZBDGogAigCACABa0ECdSAGQRBqIAAoAgAQnwciAEF/RgRAEKAHAAsgAiABIABBAnRqNgIAIAZBkAFqJAALYwEBfyMAQRBrIgUkACAFIAQ2AgwgBUEIaiAFQQxqEKoGIQQgACABIAIgAxDuBSEBIAQoAgAiAARAQdjrAigCABogAARAQdjrAkGM9wIgACAAQX9GGzYCAAsLIAVBEGokACABCwUAEB4AC0UBAX8jAEEQayIDJAAgAyACNgIIA0AgACABRwRAIANBCGogACgCABCcBSAAQQRqIQAMAQsLIAMoAgghACADQRBqJAAgAAsFAEH/AAsIACAAEIkGGgsVACAAQgA3AgAgAEEANgIIIAAQ/AgLDAAgAEGChoAgNgAACwgAQf////8HCwwAIABBAUEtEOAGGgvtBAEBfyMAQaACayIAJAAgACABNgKYAiAAIAI2ApACIABBmwU2AhAgAEGYAWogAEGgAWogAEEQahCEBiEHIAAgBCgCHCIBNgKQASABIAEoAgRBAWo2AgQgAEGQAWoQ+wQhASAAQQA6AI8BAkAgAEGYAmogAiADIABBkAFqIAQoAgQgBSAAQY8BaiABIAcgAEGUAWogAEGEAmoQqQdFDQAgAEGLvQEoAAA2AIcBIABBhL0BKQAANwOAASABIABBgAFqIABBigFqIABB9gBqIAEoAgAoAiARCAAaIABBmgU2AhAgAEEIakEAIABBEGoQhAYhASAAQRBqIQICQCAAKAKUASAHKAIAa0HjAE4EQCAAKAKUASAHKAIAa0ECahC9CSEDIAEoAgAhAiABIAM2AgAgAgRAIAIgASgCBBEBAAsgASgCAEUNASABKAIAIQILIAAtAI8BBEAgAkEtOgAAIAJBAWohAgsgBygCACEEA0ACQCAEIAAoApQBTwRAIAJBADoAACAAIAY2AgAgAEEQaiAAEOgFQQFHDQEgASgCACECIAFBADYCACACBEAgAiABKAIEEQEACwwECyACIABB9gBqIABBgAFqIAQQqQYgAGsgAGotAAo6AAAgAkEBaiECIARBAWohBAwBCwsQoAcACxCgBwALIABBmAJqIABBkAJqEP8EBEAgBSAFKAIAQQJyNgIACyAAKAKYAiECAn8gACgCkAEiASABKAIEQX9qIgM2AgQgA0F/RgsEQCABIAEoAgAoAggRAQALIAcoAgAhASAHQQA2AgAgAQRAIAEgBygCBBEBAAsgAEGgAmokACACC7MSAQh/IwBBsARrIgskACALIAo2AqQEIAsgATYCqAQgC0GbBTYCaCALIAtBiAFqIAtBkAFqIAtB6ABqEIQGIg8oAgAiATYChAEgCyABQZADajYCgAEgC0HoAGoQ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BSAFKAIAQQRyNgIAQQAhAAwECyAJKAIAIAsoAqQERgRAIAggCSALQaQEahCtBwsCfyAAKAIAIgIoAgwiAyACKAIQRgRAIAIgAigCACgCJBEAAAwBCyADKAIACyECIAkgCSgCACIDQQRqNgIAIAMgAjYCACALIAsoAhxBf2o2AhwMAAALAAsgCiEEIAgoAgAgCSgCAEcNAyAFIAUoAgBBBHI2AgBBACEADAELAkAgCkUNAEEBIQQDQCAEAn8gCiwAC0EASARAIAooAgQMAQsgCi0ACwtPDQECQCAAIAtBqARqEIsFRQRAAn8gACgCACIBKAIMIgIgASgCEEYEQCABIAEoAgAoAiQRAAAMAQsgAigCAAsCfyAKLAALQQBIBEAgCigCAAwBCyAKCyAEQQJ0aigCAEYNAQsgBSAFKAIAQQRyNgIAQQAhAAwDCyAAEIoFGiAEQQFqIQQMAAALAAtBASEAIA8oAgAgCygChAFGDQBBACEAIAtBADYCECARIA8oAgAgCygChAEgC0EQahCNBiALKAIQBEAgBSAFKAIAQQRyNgIADAELQQEhAAsgEBDyCBogDRDyCBogDBDyCBogDhDyCBogERDyCBogDygCACEBIA9BADYCACABBEAgASAPKAIEEQEACyALQbAEaiQAIAAPCyAKIQQLIAFBAWohAQwAAAsAC6UDAQF/IwBBEGsiCiQAIAkCfyAABEAgCiABEL4HIgAiASABKAIAKAIsEQIAIAIgCigCADYAACAKIAAgACgCACgCIBECACAIIAoQvwcgChDyCBogCiAAIAAoAgAoAhwRAgAgByAKEL8HIAoQ8ggaIAMgACAAKAIAKAIMEQAANgIAIAQgACAAKAIAKAIQEQAANgIAIAogACAAKAIAKAIUEQIAIAUgChCyByAKEPIIGiAKIAAgACgCACgCGBECACAGIAoQvwcgChDyCBogACAAKAIAKAIkEQAADAELIAogARDAByIAIgEgASgCACgCLBECACACIAooAgA2AAAgCiAAIAAoAgAoAiARAgAgCCAKEL8HIAoQ8ggaIAogACAAKAIAKAIcEQIAIAcgChC/ByAKEPIIGiADIAAgACgCACgCDBEAADYCACAEIAAgACgCACgCEBEAADYCACAKIAAgACgCACgCFBECACAFIAoQsgcgChDyCBogCiAAIAAoAgAoAhgR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QeUATwRAIA4QvQkhDiAIKAIAIQIgCCAONgIAIAIEQCACIAgoAgQRAQALIAgoAgAiAkUNAQsgAiAAQSRqIABBIGogAygCBCAMIAkgDGogESAPIABB0AFqIAAsAM8BIAAsAM4BIBAgDSAHIAAoApwBEMUHIAEgAiAAKAIkIAAoAiAgAyAEEMsDIQIgCCgCACEBIAhBADYCACABBEAgASAIKAIEEQEACyAHEPIIGiANEPIIGiAQEPIIGgJ/IAAoAtgBIgEgASgCBEF/aiIDNgIEIANBf0YLBEAgASABKAIAKAIIEQEACyAKKAIAIQEgCkEANgIAIAEEQCABIAooAgQRAQALIAsoAgAhASALQQA2AgAgAQRAIAEgCygCBBEBAAsgAEHQA2okACACDwsQoAcAC9EDAQF/IwBBEGsiCiQAIAkCfyAABEAgAhCxByEAAkAgAQRAIAogACAAKAIAKAIsEQIAIAMgCigCADYAACAKIAAgACgCACgCIBECAAwBCyAKIAAgACgCACgCKBECACADIAooAgA2AAAgCiAAIAAoAgAoAhwRAgALIAggChCyByAKEPIIGiAEIAAgACgCACgCDBEAADoAACAFIAAgACgCACgCEBEAADoAACAKIAAgACgCACgCFBECACAGIAoQsgcgChDyCBogCiAAIAAoAgAoAhgRAgAgByAKELIHIAoQ8ggaIAAgACgCACgCJBEAAAwBCyACELMHIQACQCABBEAgCiAAIAAoAgAoAiwRAgAgAyAKKAIANgAAIAogACAAKAIAKAIgEQIADAELIAogACAAKAIAKAIoEQIAIAMgCigCADYAACAKIAAgACgCACgCHBECAAsgCCAKELIHIAoQ8ggaIAQgACAAKAIAKAIMEQAAOgAAIAUgACAAKAIAKAIQEQAAOgAAIAogACAAKAIAKAIUEQIAIAYgChCyByAKEPIIGiAKIAAgACgCACgCGBECACAHIAoQsgcgChDyCBogACAAKAIAKAIkEQAACzYCACAKQRBqJAAL8AcBCn8jAEEQayITJAAgAiAANgIAIANBgARxIRYDQAJAAkACQAJAIBRBBEYEQAJ/IA0sAAtBAEgEQCANKAIEDAELIA0tAAsLQQFLBEAgEyANEMcGNgIIIAIgE0EIakEBELUHIA0QyAYgAigCABDGBzYCAAsgA0GwAXEiA0EQRg0C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JAAgAAszAQF/IAAoAhAaIAAoAgghAgNAIAJBADYCACAAIAAoAghBBGoiAjYCCCABQX9qIgENAAsLZwEBf0HwnQMQ4wdBkJ4DQfCdAygCAEH0nQMoAgAgAEEEaiIBEN8IQfCdAyABEKAFQfSdAyAAQQhqEKAFQYCeAyAAQQxqEKAFIAAgACgCBDYCAEH0nQMoAgBB8J0DKAIAa0ECdRDVCAsoACADIAMoAgAgAiABayIAayICNgIAIABBAU4EQCACIAEgABDJCRoLCwcAIAAoAgQLJQADQCABIAAoAghHBEAgACgCEBogACAAKAIIQXxqNgIIDAELCws4AQJ/IAAoAgAgACgCCCICQQF1aiEBIAAoAgQhACABIAJBAXEEfyABKAIAIABqKAIABSAACxEBAAseAEH/////AyAASQRAQcDqARDeAgALIABBAnQQ6wgLUAEBfyAAEK8HIAAsAAtBAEgEQCAAKAIAIQEgACwAC0EASAR/IAAoAghB/////wdxQX9qBUEKCxogARC+CSAAQYCAgIB4NgIIIABBADoACwsLUAEBfyAAELwHIAAsAAtBAEgEQCAAKAIAIQEgACwAC0EASAR/IAAoAghB/////wdxQX9qBUEBCxogARC+CSAAQYCAgIB4NgIIIABBADoACwsLOgIBfwF+IwBBEGsiAyQAIAMgASACEKYGEPcFIAMpAwAhBCAAIAMpAwg3AwggACAENwMAIANBEGokAAsDAAALRwEBfyAAQQhqIgEoAgBFBEAgACAAKAIAKAIQEQEADwsCfyABIAEoAgBBf2oiATYCACABQX9GCwRAIAAgACgCACgCEBEBAAsLBABBAAsuAANAIAAoAgBBAUYNAAsgACgCAEUEQCAAQQE2AgAgAUGdBREBACAAQX82AgALCzEBAn8gAEEBIAAbIQADQAJAIAAQvQkiAQ0AQeyfAygCACICRQ0AIAIRBwAMAQsLIAELOgECfyABELMEIgJBDWoQ6wgiA0EANgIIIAMgAjYCBCADIAI2AgAgACADQQxqIAEgAkEBahDJCTYCAAspAQF/IAIEQCAAIQMDQCADIAE2AgAgA0EEaiEDIAJBf2oiAg0ACwsgAAtpAQF/AkAgACABa0ECdSACSQRAA0AgACACQX9qIgJBAnQiA2ogASADaigCADYCACACDQAMAgALAAsgAkUNACAA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DQEMAwtBCiEEQQohAiAALQALIgFBCkcNAQsgACACQQEgAiACEPgIIAQhASAALAALQQBIDQELIAAiAiABQQFqOgALDAELIAAoAgAhAiAAIARBAWo2AgQgBCEBCyABIAJqIgAgAy0ADzoAACADQQA6AA4gACADLQAOOgABIANBEGokAAs7AQF/IwBBEGsiASQAAkAgAEEBOgALIABBAUEtEPkIIAFBADoADyAAIAEtAA86AAEgAUEQaiQADwALAAujAQEDfyMAQRBrIgQkAEHv////AyACTwRAAkAgAkEBTQRAIAAgAjoACyAAIQMMAQsgACACQQJPBH8gAkEEakF8cSIDIANBf2oiAyADQQJGGwVBAQtBAWoiBRDjCCIDNgIAIAAgBUGAgICAeHI2AgggACACNgIECyADIAEgAhDyBCAEQQA2AgwgAyACQQJ0aiAEKAIMNgIAIARBEGokAA8LEO8IAAvQAQEDfyMAQRBrIgQkAAJAIAAsAAtBAEgEfyAAKAIIQf////8HcUF/agVBAQsiAyACTwRAAn8gACwAC0EASARAIAAoAgAMAQsgAAsiBSEDIAIEfyADIAEgAhDuCAUgAwsaIARBADYCDCAFIAJBAnRqIAQoAgw2AgACQCAALAALQQBIBEAgACACNgIEDAELIAAgAjoACwsMAQsgACADIAIgA2sCfyAALAALQQBIBEAgACgCBAwBCyAALQALCyIAQQAgACACIAEQ/wgLIARBEGokAAvlAgEFfyMAQRBrIggkACABQX9zQe////8DaiACTwRAAn8gACwAC0EASARAIAAoAgAMAQsgAAshCQJ/Qef///8BIAFLBEAgCCABQQF0NgIIIAggASACajYCDAJ/IwBBEGsiAiQAIAhBDGoiCigCACAIQQhqIgsoAgBJIQwgAkEQaiQAIAsgCiAMGygCACICQQJPCwR/IAJBBGpBfHEiAiACQX9qIgIgAkECRhsFQQELDAELQe7///8DC0EBaiIKEOMIIQIgBARAIAIgCSAEEPIECyAGBEAgBEECdCACaiAHIAYQ8gQLIAMgBWsiAyAEayIHBEAgBEECdCIEIAJqIAZBAnRqIAQgCWogBUECdGogBxDyBAsgAUEBRwRAIAkQvgkLIAAgAjYCACAAIApBgICAgHhyNgIIIAAgAyAGaiIANgIEIAhBADYCBCACIABB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IAUgBSkDECICIAUpAxgiASACIAEQ1AUgBSkDCCECIAUpAwAhBAwBCyABIAJC////////P4MgBq1CMIaEIgogAyAEQv///////z+DIARCMIinQf//AXEiB61CMIaEIgsQzgVBAEwEQCABIAogAyALEM4FBEAgASEEDAILIAVB8ABqIAEgAkIAQgAQygUgBSkDeCECIAUpA3AhBAwBCyAGBH4gAQUgBUHgAGogASAKQgBCgICAgICAwLvAABDKBSAFKQNoIgpCMIinQYh/aiEGIAUpA2ALIQQgB0UEQCAFQdAAaiADIAtCAEKAgICAgIDAu8AAEMoFIAUpA1giC0IwiKdBiH9qIQcgBSkDUCEDCyAKQv///////z+DQoCAgICAgMAAhCIKIAtC////////P4NCgICAgICAwACEIg19IAQgA1StfSIMQn9VIQggBCADfSELIAYgB0oEQANAAn4gCARAIAsgDIRQBEAgBUEgaiABIAJCAEIAEMoFIAUpAyghAiAFKQMgIQQMBQsgC0I/iCEKIAxCAYYMAQsgCkIBhiEKIAQhCyAEQj+ICyEMIAogDIQiCiANfSALQgGGIgQgA1StfSIMQn9VIQggBCADfSELIAZBf2oiBiAHSg0ACyAHIQYLAkAgCEUNACALIgQgDCIKhEIAUg0AIAVBMGogASACQgBCABDKBSAFKQM4IQIgBSkDMCEEDAELIApC////////P1gEQANAIARCP4ghASAGQX9qIQYgBEIBhiEEIAEgCkIBhoQiCkKAgICAgIDAAFQNAAsLIAlBgIACcSEHIAZBAEwEQCAFQUBrIAQgCkL///////8/gyAGQfgAaiAHcq1CMIaEQgBCgICAgICAwMM/EMoFIAUpA0ghAiAFKQNAIQQMAQsgCkL///////8/gyAGIAdyrUIwhoQhAgsgACAENwMAIAAgAjcDCCAFQYABaiQAC+YDAwN/AX4GfAJAAkACQAJAIAC9IgRCAFkEQCAEQiCIpyIBQf//P0sNAQsgBEL///////////8Ag1AEQEQAAAAAAADwvyAAIACiow8LIARCf1UNASAAIAChRAAAAAAAAAAAow8LIAFB//+//wdLDQJBgIDA/wMhAkGBeCEDIAFBgIDA/wNHBEAgASECDAILIASnDQFEAAAAAAAAAAAPCyAARAAAAAAAAFBDor0iBEIgiKchAkHLdyEDCyADIAJB4r4laiIBQRR2arciCUQAYJ9QE0TTP6IiBSAEQv////8PgyABQf//P3FBnsGa/wNqrUIghoS/RAAAAAAAAPC/oCIAIAAgAEQAAAAAAADgP6KiIgehvUKAgICAcIO/IghEAAAgFXvL2z+iIgagIgogBiAFIAqhoCAAIABEAAAAAAAAAECgoyIFIAcgBSAFoiIGIAaiIgUgBSAFRJ/GeNAJmsM/okSveI4dxXHMP6CiRAT6l5mZmdk/oKIgBiAFIAUgBUREUj7fEvHCP6JE3gPLlmRGxz+gokRZkyKUJEnSP6CiRJNVVVVVVeU/oKKgoKIgACAIoSAHoaAiAEQAACAVe8vbP6IgCUQ2K/ER8/5ZPaIgACAIoETVrZrKOJS7PaKgoKCgIQALIAALuwICAn8EfQJAAkAgALwiAUGAgIAET0EAIAFBf0obRQRAIAFB/////wdxRQRAQwAAgL8gACAAlJUPCyABQX9MBEAgACAAk0MAAAAAlQ8LIABDAAAATJS8IQFB6H4hAgwBCyABQf////sHSw0BQYF/IQJDAAAAACEAIAFBgICA/ANGDQELIAIgAUGN9qsCaiIBQRd2arIiBkOAIJo+lCABQf///wNxQfOJ1PkDar5DAACAv5IiACAAIABDAAAAP5SUIgSTvEGAYHG+IgVDAGDePpQgACAAQwAAAECSlSIDIAQgAyADlCIDIAMgA5QiA0Pu6ZE+lEOqqio/kpQgAyADQyaeeD6UQxPOzD6SlJKSlCAAIAWTIASTkiIAQwBg3j6UIAZD2ydUNZQgACAFkkPZ6gS4lJKSkpIhAAsgAAuoAQACQCABQYAITgRAIABEAAAAAAAA4H+iIQAgAUH/D0gEQCABQYF4aiEBDAILIABEAAAAAAAA4H+iIQAgAUH9FyABQf0XSBtBgnBqIQEMAQsgAUGBeEoNACAARAAAAAAAABAAoiEAIAFBg3BKBEAgAUH+B2ohAQwBCyAARAAAAAAAABAAoiEAIAFBhmggAUGGaEobQfwPaiEBCyAAIAFB/wdqrUI0hr+iC0QCAX8BfiABQv///////z+DIQMCfyABQjCIp0H//wFxIgJB//8BRwRAQQQgAg0BGkECQQMgACADhFAbDwsgACADhFALC4MEAQN/IAJBgMAATwRAIAAgASACECgaIAAPCyAAIAJqIQMCQCAAIAFzQQNxRQRAAkAgAkEBSARAIAAhAgwBCyAAQQNxRQRAIAAhAgwBCyAAIQIDQCACIAEtAAA6AAAgAUEBaiEBIAJBAWoiAiADTw0BIAJBA3ENAAsLAkAgA0F8cSIEQcAASQ0AIAIgBEFAaiIFSw0AA0AgAiABKAIANgIAIAIgASgCBDYCBCACIAEoAgg2AgggAiABKAIMNgIMIAIgASgCEDYCECACIAEoAhQ2AhQgAiABKAIYNgIYIAIgASgCHDYCHCACIAEoAiA2AiAgAiABKAIkNgIkIAIgASgCKDYCKCACIAEoAiw2AiwgAiABKAIwNgIwIAIgASgCNDYCNCACIAEoAjg2AjggAiABKAI8NgI8IAFBQGshASACQUBrIgIgBU0NAAsLIAIgBE8NAQNAIAIgASgCADYCACABQQRqIQEgAkEEaiICIARJDQALDAELIANBBEkEQCAAIQIMAQsgA0F8aiIEIABJBEAgACECDAELIAAhAgNAIAIgAS0AADoAACACIAEtAAE6AAEgAiABLQACOgACIAIgAS0AAzoAAyABQQRqIQEgAkEEaiICIARNDQALCyACIANJBEADQCACIAEtAAA6AAAgAUEBaiEBIAJBAWoiAiADRw0ACwsgAAvzAgICfwF+AkAgAkUNACAAIAJqIgNBf2ogAToAACAAIAE6AAAgAkEDSQ0AIANBfmogAToAACAAIAE6AAEgA0F9aiABOgAAIAAgAToAAiACQQdJDQAgA0F8aiABOgAAIAAgAToAAyACQQlJDQAgAEEAIABrQQNxIgRqIgMgAUH/AXFBgYKECGwiATYCACADIAIgBGtBfHEiBGoiAkF8aiABNgIAIARBCUkNACADIAE2AgggAyABNgIEIAJBeGogATYCACACQXRqIAE2AgAgBEEZSQ0AIAMgATYCGCADIAE2AhQgAyABNgIQIAMgATYCDCACQXBqIAE2AgAgAkFsaiABNgIAIAJBaGogATYCACACQWRqIAE2AgAgBCADQQRxQRhyIgRrIgJBIEkNACABrSIFQiCGIAWEIQUgAyAEaiEBA0AgASAFNwMYIAEgBTcDECABIAU3AwggASAFNwMAIAFBIGohASACQWBqIgJBH0sNAAsLIAAL5QIBAn8CQCAAIAFGDQACQCABIAJqIABLBEAgACACaiIEIAFLDQELIAAgASACEMkJGg8LIAAgAXNBA3EhAwJAAkAgACABSQRAIAMNAiAAQQNxRQ0BA0AgAkUNBCAAIAEtAAA6AAAgAUEBaiEBIAJBf2ohAiAAQQFqIgBBA3ENAAsMAQsCQCADDQAgBEEDcQRAA0AgAkUNBSAAIAJBf2oiAmoiAyABIAJqLQAAOgAAIANBA3ENAAsLIAJBA00NAANAIAAgAkF8aiICaiABIAJqKAIANgIAIAJBA0sNAAsLIAJFDQIDQCAAIAJBf2oiAmogASACai0AADoAACACDQALDAILIAJBA00NACACIQMDQCAAIAEoAgA2AgAgAUEEaiEBIABBBGohACADQXxqIgNBA0sNAAsgAkEDcSECCyACRQ0AA0AgACABLQAAOgAAIABBAWohACABQQFqIQEgAkF/aiICDQALCwsfAEHkowMoAgBFBEBB6KMDIAE2AgBB5KMDIAA2AgALCwQAIwALEAAjACAAa0FwcSIAJAAgAAsGACAAJAALBgAgAEAACwsAIAEgAiAAEQIACw8AIAEgAiADIAQgABELAAsLACABIAIgABERAAsNACABIAIgAyAAEUsACw8AIAEgAiADIAQgABEVAAsRACABIAIgAyAEIAUgABFTAAsNACABIAIgAyAAERMACw8AIAEgAiADIAQgABFQAAsLACABIAIgABEYAAsLACABIAIgABEPAAsNACABIAIgAyAAERoACw0AIAEgAiADIAARHgALDwAgASACIAMgBCAAEUoACw8AIAEgAiADIAQgABEZAAsPACABIAIgAyAEIAARWgALEQAgASACIAMgBCAFIAARTQALEQAgASACIAMgBCAFIAARWwALEwAgASACIAMgBCAFIAYgABFOAAsPACABIAIgAyAEIAARPAALEQAgASACIAMgBCAFIAARNgALEQAgASACIAMgBCAFIAARPQALEwAgASACIAMgBCAFIAYgABE3AAsTACABIAIgAyAEIAUgBiAAET4ACxUAIAEgAiADIAQgBSAGIAcgABE4AAsRACABIAIgAyAEIAUgABFAAAsTACABIAIgAyAEIAUgBiAAESUACw8AIAEgAiADIAQgABFEAAsNACABIAIgAyAAET8ACw8AIAEgAiADIAQgABE5AAsPACABIAIgAyAEIAARCAALEQAgASACIAMgBCAFIAAROwALEwAgASACIAMgBCAFIAYgABE0AAsTACABIAIgAyAEIAUgBiAAEVwACxUAIAEgAiADIAQgBSAGIAcgABFSAAsTACABIAIgAyAEIAUgBiAAES8ACxUAIAEgAiADIAQgBSAGIAcgABFXAAsTACABIAIgAyAEIAUgBiAAEV0ACxUAIAEgAiADIAQgBSAGIAcgABFVAAsXACABIAIgAyAEIAUgBiAHIAggABFfAAsZACABIAIgAyAEIAUgBiAHIAggCSAAEVgACw0AIAEgAiADIAARIwALDwAgASACIAMgBCAAESoACxMAIAEgAiADIAQgBSAGIAARLAALFQAgASACIAMgBCAFIAYgByAAEU8ACw8AIAEgAiADIAQgABEfAAsRACABIAIgAyAEIAUgABErAAsNACABIAIgAyAAESEACw8AIAEgAiADIAQgABE1AAsRACABIAIgAyAEIAUgABEKAAsNACABIAIgAyAAEUYACw8AIAEgAiADIAQgABFFAAsJACABIAARKAALCwAgASACIAARKQALDwAgASACIAMgBCAAEUgACxEAIAEgAiADIAQgBSAAEUkACxMAIAEgAiADIAQgBSAGIAARMgALFQAgASACIAMgBCAFIAYgByAAETEACw0AIAEgAiADIAARYQALDwAgASACIAMgBCAAETMACw8AIAEgAiADIAQgABFmAAsRACABIAIgAyAEIAUgABEtAAsTACABIAIgAyAEIAUgBiAAEVEACxMAIAEgAiADIAQgBSAGIAARXgALFQAgASACIAMgBCAFIAYgByAAEVYACxEAIAEgAiADIAQgBSAAES4ACxMAIAEgAiADIAQgBSAGIAARVAALCwAgASACIAARaAALDwAgASACIAMgBCAAEVkACxEAIAEgAiADIAQgBSAAEUwACxMAIAEgAiADIAQgBSAGIAARRwALEQAgASACIAMgBCAFIAARBgALFwAgASACIAMgBCAFIAYgByAIIAARDgALEwAgASACIAMgBCAFIAYgABEJAAsRACABIAIgAyAEIAUgABEmAAsVACABIAIgAyAEIAUgBiAHIAARFAALEwAgASACIAMgBCAFIAYgABENAAsHACAAEQcACxkAIAEgAiADrSAErUIghoQgBSAGIAARJAALIgEBfiABIAKtIAOtQiCGhCAEIAARHAAiBUIgiKcQKSAFpwsZACABIAIgAyAEIAWtIAatQiCGhCAAESIACyMAIAEgAiADIAQgBa0gBq1CIIaEIAetIAitQiCGhCAAEUMACyUAIAEgAiADIAQgBSAGrSAHrUIghoQgCK0gCa1CIIaEIAARQgALC6XKAlcAQYAIC5ARVmVjdG9ySW50AFZlY3RvckRvdWJsZQBWZWN0b3JDaGFyAFZlY3RvclVDaGFyAFZlY3RvckZsb2F0AHZlY3RvclRvb2xzAGNsZWFyVmVjdG9yRGJsAGNsZWFyVmVjdG9yRmxvYXQAbWF4aVNldHRpbmdzAHNldHVwAG1heGlPc2MAc2luZXdhdmUAY29zd2F2ZQBwaGFzb3IAc2F3AHRyaWFuZ2xlAHNxdWFyZQBwdWxzZQBpbXB1bHNlAG5vaXNlAHNpbmVidWYAc2luZWJ1ZjQAc2F3bgBwaGFzZVJlc2V0AG1heGlFbnZlbG9wZQBsaW5lAHRyaWdnZXIAYW1wbGl0dWRlAHZhbGluZGV4AG1heGlEZWxheWxpbmUAZGwAbWF4aUZpbHRlcgBsb3JlcwBoaXJlcwBiYW5kcGFzcwBsb3Bhc3MAaGlwYXNzAGN1dG9mZgByZXNvbmFuY2UAbWF4aU1peABzdGVyZW8AcXVhZABhbWJpc29uaWMAbWF4aUxpbmUAcGxheQBwcmVwYXJlAHRyaWdnZXJFbmFibGUAaXNMaW5lQ29tcGxldGUAbWF4aVhGYWRlAHhmYWRlAG1heGlMYWdFeHAAaW5pdABhZGRTYW1wbGUAdmFsdWUAYWxwaGEAYWxwaGFSZWNpcHJvY2FsAHZhbABtYXhpU2FtcGxlAGdldExlbmd0aABzZXRTYW1wbGUAc2V0U2FtcGxlRnJvbU9nZ0Jsb2IAaXNSZWFkeQBwbGF5T25jZQBwbGF5T25aWABwbGF5NABjbGVhcgBub3JtYWxpc2UAYXV0b1RyaW0AbG9hZAByZWFkAGxvb3BTZXRQb3NPblpYAG1heGlEeW4AZ2F0ZQBjb21wcmVzc29yAGNvbXByZXNzAHNldEF0dGFjawBzZXRSZWxlYXNlAHNldFRocmVzaG9sZABzZXRSYXRpbwBtYXhpRW52AGFyAGFkc3IAc2V0RGVjYXkAc2V0U3VzdGFpbgBjb252ZXJ0AG10b2YAbXNUb1NhbXBzAG1heGlTYW1wbGVBbmRIb2xkAHNhaABtYXhpRmxhbmdlcgBmbGFuZ2UAbWF4aUNob3J1cwBjaG9ydXMAbWF4aURDQmxvY2tlcgBtYXhpU1ZGAHNldEN1dG9mZgBzZXRSZXNvbmFuY2UAbWF4aU1hdGgAYWRkAHN1YgBtdWwAZGl2AGd0AGx0AGd0ZQBsdGUAbW9kAGFicwBwb3cAbWF4aUNsb2NrAHRpY2tlcgBzZXRUZW1wbwBzZXRUaWNrc1BlckJlYXQAaXNUaWNrAGN1cnJlbnRDb3VudABwbGF5SGVhZABicHMAYnBtAHRpY2sAdGlja3MAbWF4aUt1cmFtb3RvT3NjaWxsYXRvcgBzZXRQaGFzZQBnZXRQaGFzZQBtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0AHNldFBoYXNlcwBzaXplAG1heGlBc3luY0t1cmFtb3RvT3NjaWxsYXRvcgBtYXhpRkZUAHByb2Nlc3MAc3BlY3RyYWxGbGF0bmVzcwBzcGVjdHJhbENlbnRyb2lkAGdldE1hZ25pdHVkZXMAZ2V0TWFnbml0dWRlc0RCAGdldFBoYXNlcwBnZXROdW1CaW5zAGdldEZGVFNpemUAZ2V0SG9wU2l6ZQBnZXRXaW5kb3dTaXplAG1heGlGRlRNb2RlcwBXSVRIX1BPTEFSX0NPTlZFUlNJT04ATk9fUE9MQVJfQ09OVkVSU0lPTgBtYXhpSUZGVABtYXhpSUZGVE1vZGVzAFNQRUNUUlVNAENPTVBMRVgAbWF4aU1GQ0MAbWZjYwBtYXhpVGltZVN0cmV0Y2gAc2hhcmVkX3B0cjxtYXhpVGltZXN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4AZ2V0Tm9ybWFsaXNlZFBvc2l0aW9uAGdldFBvc2l0aW9uAHNldFBvc2l0aW9uAHBsYXlBdFBvc2l0aW9uAG1heGlQaXRjaFNoaWZ0AHNoYXJlZF9wdHI8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4AbWF4aVN0cmV0Y2gAc2V0TG9vcFN0YXJ0AHNldExvb3BFbmQAZ2V0TG9vcEVuZABtYXhpQml0cwBzaWcAYXQAc2hsAHNocgByAGxhbmQAbG9yAGx4b3IAbmVnAGluYwBkZWMAZXEAdG9TaWduYWwAdG9UcmlnU2lnbmFsAGZyb21TaWduYWwAbWF4aUNvdW50ZXIAY291bnQAbWF4aUluZGV4AHB1bGwAbWF4aVJhdGlvU2VxAHBsYXlUcmlnAHBsYXlWYWx1ZXMAbWF4aVNhdFJldmVyYgBtYXhpRnJlZVZlcmIAYWxsb2NhdG9yPFQ+OjphbGxvY2F0ZShzaXplX3QgbikgJ24nIGV4Y2VlZHMgbWF4aW11bSBzdXBwb3J0ZWQgc2l6ZQBwdXNoX2JhY2sAcmVzaXplAGdldABzZXQATlN0M19fMjZ2ZWN0b3JJaU5TXzlhbGxvY2F0b3JJaUVFRUUATlN0M19fMjEzX192ZWN0b3JfYmFzZUlpTlNfOWFsbG9jYXRvcklpRUVFRQBOU3QzX18yMjBfX3ZlY3Rvcl9iYXNlX2NvbW1vbklMYjFFRUUAANx5AACmCwAAYHoAAHoLAAAAAAAAAQAAAMwLAAAAAAAAYHoAAFYLAAAAAAAAAQAAANQLAAAAAAAAUE5TdDNfXzI2dmVjdG9ySWlOU185YWxsb2NhdG9ySWlFRUVFAAAAALx6AAAEDAAAAAAAAOwLAABQS05TdDNfXzI2dmVjdG9ySWlOU185YWxsb2NhdG9ySWlFRUVFAAAAvHoAADwMAAABAAAA7AsAAGlpAHYAdmkALAwAAOR4AAAsDAAARHkAAHZpaWkAQaAZC1DkeAAALAwAAGh5AABEeQAAdmlpaWkAAABoeQAAZAwAAGlpaQDkDAAA7AsAAGh5AABOMTBlbXNjcmlwdGVuM3ZhbEUAANx5AADQDAAAaWlpaQBBgBoL5gT8eAAA7AsAAGh5AABEeQAAaWlpaWkATlN0M19fMjZ2ZWN0b3JJZE5TXzlhbGxvY2F0b3JJZEVFRUUATlN0M19fMjEzX192ZWN0b3JfYmFzZUlkTlNfOWFsbG9jYXRvcklkRUVFRQAAAGB6AAA6DQAAAAAAAAEAAADMCwAAAAAAAGB6AAAWDQAAAAAAAAEAAABoDQAAAAAAAFBOU3QzX18yNnZlY3RvcklkTlNfOWFsbG9jYXRvcklkRUVFRQAAAAC8egAAmA0AAAAAAACADQAAUEtOU3QzX18yNnZlY3RvcklkTlNfOWFsbG9jYXRvcklkRUVFRQAAALx6AADQDQAAAQAAAIANAADADQAA5HgAAMANAACAeQAAdmlpZAAAAADkeAAAwA0AAGh5AACAeQAAdmlpaWQAAABoeQAA+A0AAOQMAACADQAAaHkAAAAAAAD8eAAAgA0AAGh5AACAeQAAaWlpaWQATlN0M19fMjZ2ZWN0b3JJY05TXzlhbGxvY2F0b3JJY0VFRUUATlN0M19fMjEzX192ZWN0b3JfYmFzZUljTlNfOWFsbG9jYXRvckljRUVFRQAAAGB6AACKDgAAAAAAAAEAAADMCwAAAAAAAGB6AABmDgAAAAAAAAEAAAC4DgAAAAAAAFBOU3QzX18yNnZlY3RvckljTlNfOWFsbG9jYXRvckljRUVFRQAAAAC8egAA6A4AAAAAAADQDgAAUEtOU3QzX18yNnZlY3RvckljTlNfOWFsbG9jYXRvckljRUVFRQAAALx6AAAgDwAAAQAAANAOAAAQDwAA5HgAABAPAAAIeQBB8B4LIuR4AAAQDwAAaHkAAAh5AABoeQAASA8AAOQMAADQDgAAaHkAQaAfC7IC/HgAANAOAABoeQAACHkAAE5TdDNfXzI2dmVjdG9ySWhOU185YWxsb2NhdG9ySWhFRUVFAE5TdDNfXzIxM19fdmVjdG9yX2Jhc2VJaE5TXzlhbGxvY2F0b3JJaEVFRUUAYHoAANQPAAAAAAAAAQAAAMwLAAAAAAAAYHoAALAPAAAAAAAAAQAAAAAQAAAAAAAAUE5TdDNfXzI2dmVjdG9ySWhOU185YWxsb2NhdG9ySWhFRUVFAAAAALx6AAAwEAAAAAAAABgQAABQS05TdDNfXzI2dmVjdG9ySWhOU185YWxsb2NhdG9ySWhFRUVFAAAAvHoAAGgQAAABAAAAGBAAAFgQAADkeAAAWBAAABR5AADkeAAAWBAAAGh5AAAUeQAAaHkAAJAQAADkDAAAGBAAAGh5AEHgIQuUAvx4AAAYEAAAaHkAABR5AABOU3QzX18yNnZlY3RvcklmTlNfOWFsbG9jYXRvcklmRUVFRQBOU3QzX18yMTNfX3ZlY3Rvcl9iYXNlSWZOU185YWxsb2NhdG9ySWZFRUVFAGB6AAAUEQAAAAAAAAEAAADMCwAAAAAAAGB6AADwEAAAAAAAAAEAAABAEQAAAAAAAFBOU3QzX18yNnZlY3RvcklmTlNfOWFsbG9jYXRvcklmRUVFRQAAAAC8egAAcBEAAAAAAABYEQAAUEtOU3QzX18yNnZlY3RvcklmTlNfOWFsbG9jYXRvcklmRUVFRQAA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MTRoYW5uV2luRnVuY3RvckUA3HkAAKQjAABQMTVtYXhpVGltZVN0cmV0Y2hJMTRoYW5uV2luRnVuY3RvckUAAAAAvHoAANAjAAAAAAAAyCMAAFBLMTVtYXhpVGltZVN0cmV0Y2hJMTRoYW5uV2luRnVuY3RvckUAAAC8egAACCQAAAEAAADIIwAAAAAAAPgkAAAiAgAAIwIAACQCAAAlAgAAJgIAAE5TdDNfXzIyMF9fc2hhcmVkX3B0cl9wb2ludGVySVAxNW1heGlUaW1lU3RyZXRjaEkxNGhhbm5XaW5GdW5jdG9yRU4xMGVtc2NyaXB0ZW4xNXNtYXJ0X3B0cl90cmFpdElOU18xMHNoYXJlZF9wdHJJUzNfRUVFMTF2YWxfZGVsZXRlckVOU185YWxsb2NhdG9ySVMzX0VFRUUAAAR6AABcJAAAJHYAAE4xMGVtc2NyaXB0ZW4xNXNtYXJ0X3B0cl90cmFpdElOU3QzX18yMTBzaGFyZWRfcHRySTE1bWF4aVRpbWVTdHJldGNoSTE0aGFubldpbkZ1bmN0b3JFRUVFMTF2YWxfZGVsZXRlckUATlN0M19fMjEwc2hhcmVkX3B0ckkxNW1heGlUaW1lU3RyZXRjaEkxNGhhbm5XaW5GdW5jdG9yRUVFAAAA3HkAAGwlAABpAAAAqCUAAAAAAAAsJgAAJwIAACgCAAApAgAAKgIAACsCAABOU3QzX18yMjBfX3NoYXJlZF9wdHJfZW1wbGFjZUkxNW1heGlUaW1lU3RyZXRjaEkxNGhhbm5XaW5GdW5jdG9yRU5TXzlhbGxvY2F0b3JJUzNfRUVFRQAABHoAANQlAAAkdgAA5HgAAPgjAABEGAAAgHkAAPgjAADkeAAA+CMAAIB5AAAAAAAApCYAACwCAAAtAgAALgIAADltYXhpR3JhaW5JMTRoYW5uV2luRnVuY3RvckUAMTNtYXhpR3JhaW5CYXNlAAAAANx5AACJJgAABHoAAGwmAACcJgAAgHkAAPgjAACAeQAAgHkAAER5AACAeQAAZGlpZGRpZACAeQAA+CMAAIB5AACAeQAARHkAADE0bWF4aVBpdGNoU2hpZnRJMTRoYW5uV2luRnVuY3RvckUAANx5AADkJgAAUDE0bWF4aVBpdGNoU2hpZnRJMTRoYW5uV2luRnVuY3RvckUAvHoAABAnAAAAAAAACCcAAFBLMTRtYXhpUGl0Y2hTaGlmdEkxNGhhbm5XaW5GdW5jdG9yRQAAAAC8egAARCcAAAEAAAAIJwAAAAAAADQoAAAvAgAAMAIAADECAAAyAgAAMwIAAE5TdDNfXzIyMF9fc2hhcmVkX3B0cl9wb2ludGVySVAxNG1heGlQaXRjaFNoaWZ0STE0aGFubldpbkZ1bmN0b3JFTjEwZW1zY3JpcHRlbjE1c21hcnRfcHRyX3RyYWl0SU5TXzEwc2hhcmVkX3B0cklTM19FRUUxMXZhbF9kZWxldGVyRU5TXzlhbGxvY2F0b3JJUzNfRUVFRQAAAAR6AACYJwAAJHYAAE4xMGVtc2NyaXB0ZW4xNXNtYXJ0X3B0cl90cmFpdElOU3QzX18yMTBzaGFyZWRfcHRySTE0bWF4aVBpdGNoU2hpZnRJMTRoYW5uV2luRnVuY3RvckVFRUUxMXZhbF9kZWxldGVyRQBOU3QzX18yMTBzaGFyZWRfcHRySTE0bWF4aVBpdGNoU2hpZnRJMTRoYW5uV2luRnVuY3RvckVFRQDceQAApygAAOAoAAAAAAAAYCkAADQCAAA1AgAANgIAACoCAAA3AgAATlN0M19fMjIwX19zaGFyZWRfcHRyX2VtcGxhY2VJMTRtYXhpUGl0Y2hTaGlmdEkxNGhhbm5XaW5GdW5jdG9yRU5TXzlhbGxvY2F0b3JJUzNfRUVFRQAAAAR6AAAIKQAAJHYAAOR4AAA0JwAARBgAQYDTAAvSAYB5AAA0JwAAgHkAAIB5AABEeQAAgHkAADExbWF4aVN0cmV0Y2hJMTRoYW5uV2luRnVuY3RvckUA3HkAAJgpAABQMTFtYXhpU3RyZXRjaEkxNGhhbm5XaW5GdW5jdG9yRQAAAAC8egAAwCkAAAAAAAC4KQAAUEsxMW1heGlTdHJldGNoSTE0aGFubldpbkZ1bmN0b3JFAAAAvHoAAPQpAAABAAAAuCkAAOQpAADkeAAA5CkAAEQYAACAeQAA5CkAAOR4AADkKQAAgHkAAGh5AADkKQBB4NQACySAeQAA5CkAAIB5AACAeQAAgHkAAER5AACAeQAAZGlpZGRkaWQAQZDVAAuCAoB5AADkKQAAgHkAAIB5AACAeQAARHkAAGRpaWRkZGkAOG1heGlCaXRzAAAA3HkAALAqAABQOG1heGlC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MWNoYXJfdHJhaXRzSXdFRUVFAAAAANx5AAAYSAAATlN0M19fMjEzYmFzaWNfaXN0cmVhbUljTlNfMTFjaGFyX3RyYWl0c0ljRUVFRQAAYHoAAFRIAAAAAAAAAQAAAIhHAAAD9P//TlN0M19fMjEzYmFzaWNfaXN0cmVhbUl3TlNfMTFjaGFyX3RyYWl0c0l3RUVFRQAAYHoAAJxIAAAAAAAAAQAAANBHAAAD9P//TlN0M19fMjEzYmFzaWNfb3N0cmVhbUljTlNfMTFjaGFyX3RyYWl0c0ljRUVFRQAAYHoAAORIAAAAAAAAAQAAAIhHAAAD9P//TlN0M19fMjEzYmFzaWNfb3N0cmVhbUl3TlNfMTFjaGFyX3RyYWl0c0l3RUVFRQAAYHoAACxJAAAAAAAAAQAAANBHAAAD9P//qLYAAAAAAADQSQAAWgIAAIUCAACGAgAAXQIAAF4CAABfAgAAYAIAAEgCAABJAgAAhwIAAIgCAACJAgAATQIAAGMCAABOU3QzX18yMTBfX3N0ZGluYnVmSWNFRQAEegAAuEkAABBIAAB1bnN1cHBvcnRlZCBsb2NhbGUgZm9yIHN0YW5kYXJkIGlucHV0AAAAAAAAAFxKAABkAgAAigIAAIsCAABnAgAAaAIAAGkCAABqAgAAawIAAGwCAACMAgAAjQIAAI4CAABwAgAAcQIAAE5TdDNfXzIxMF9fc3RkaW5idWZJd0VFAAR6AABESgAATEgAAAAAAADESgAAWgIAAI8CAACQAgAAXQIAAF4CAABfAgAAkQIAAEgCAABJAgAAYQIAAEsCAABiAgAAkgIAAJMCAABOU3QzX18yMTFfX3N0ZG91dGJ1ZkljRUUAAAAABHoAAKhKAAAQSAAAAAAAACxLAABkAgAAlAIAAJUCAABnAgAAaAIAAGkCAACWAgAAawIAAGwCAABtAgAAbgIAAG8CAACXAgAAmAIAAE5TdDNfXzIxMV9fc3Rkb3V0YnVmSXdFRQAAAAAEegAAEEsAAExIAEHAlgEL4wT/////////////////////////////////////////////////////////////////AAECAwQFBgcICf////////8KCwwNDg8QERITFBUWFxgZGhscHR4fICEiI////////woLDA0ODxAREhMUFRYXGBkaGxwdHh8gISIj/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////wABAgQHAwYFAAAAAAAAAAIAAMADAADABAAAwAUAAMAGAADABwAAwAgAAMAJAADACgAAwAsAAMAMAADADQAAwA4AAMAPAADAEAAAwBEAAMASAADAEwAAwBQAAMAVAADAFgAAwBcAAMAYAADAGQAAwBoAAMAbAADAHAAAwB0AAMAeAADAHwAAwAAAALMBAADDAgAAwwMAAMMEAADDBQAAwwYAAMMHAADDCAAAwwkAAMMKAADDCwAAwwwAAMMNAADTDgAAww8AAMMAAAy7AQAMwwIADMMDAAzDBAAM02luZmluaXR5AG5hbgAAAAAAAAAA0XSeAFedvSqAcFIP//8+JwoAAABkAAAA6AMAABAnAACghgEAQEIPAICWmAAA4fUFGAAAADUAAABxAAAAa////877//+Sv///AAAAAAAAAADeEgSVAAAAAP///////////////4BNAAAUAAAAQy5VVEYtOABByJsBCwKUTQBB4JsBCwZMQ19BTEwAQfCbAQtuTENfQ1RZUEUAAAAATENfTlVNRVJJQwAATENfVElNRQAAAAAATENfQ09MTEFURQAATENfTU9ORVRBUlkATENfTUVTU0FHRVMATEFORwBDLlVURi04AFBPU0lYAE1VU0xfTE9DUEFUSAAAAAAAYE8AQeCeAQv/AQIAAgACAAIAAgACAAIAAgACAAMgAiACIAIgAiACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgABYATABMAEwATABMAEwATABMAEwATABMAEwATABMAEwAjYCNgI2AjYCNgI2AjYCNgI2AjYBMAEwATABMAEwATABMAI1QjVCNUI1QjVCNUIxQjFCMUIxQjFCMUIxQjFCMUIxQjFCMUIxQjFCMUIxQjFCMUIxQjFBMAEwATABMAEwATACNYI1gjWCNYI1gjWCMYIxgjGCMYIxgjGCMYIxgjGCMYIxgjGCMYIxgjGCMYIxgjGCMYIxgTABMAEwATAAgBB4KIBCwJwUwBB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eAAAKHkAAHQAAACYeAAANHkAAGkAAACYeAAAQHkAAGoAAACYeAAATHkAAGwAAACYeAAAWHkAAG0AAACYeAAAZHkAAGYAAACYeAAAcHkAAGQAAACYeAAAfHkAAAAAAADIeQAAmgMAAJ8DAACcAwAAnQMAAKADAABOMTBfX2N4eGFiaXYxMTZfX2VudW1fdHlwZV9pbmZvRQAAAAAEegAApHkAAIR3AAAAAAAAtHcAAJoDAAChAwAAnAMAAJ0DAACiAwAAowMAAKQDAAClAwAAAAAAAEx6AACaAwAApgMAAJwDAACdAwAAogMAAKcDAACoAwAAqQMAAE4xMF9fY3h4YWJpdjEyMF9fc2lfY2xhc3NfdHlwZV9pbmZvRQAAAAAEegAAJHoAALR3AAAAAAAAqHoAAJoDAACqAwAAnAMAAJ0DAACiAwAAqwMAAKwDAACtAwAATjEwX19jeHhhYml2MTIxX192bWlfY2xhc3NfdHlwZV9pbmZvRQAAAAR6AACAegAAtHcAAAAAAAAUeAAAmgMAAK4DAACcAwAAnQMAAK8DAAB2b2lkAGJvb2wAY2hhcgBzaWduZWQgY2hhcgB1bnNpZ25lZCBjaGFyAHNob3J0AHVuc2lnbmVkIHNob3J0AGludAB1bnNpZ25lZCBpbnQAbG9uZwB1bnNpZ25lZCBsb25nAGZsb2F0AGRvdWJsZQBzdGQ6OnN0cmluZwBzdGQ6OmJhc2ljX3N0cmluZzx1bnNpZ25lZCBjaGFyPgBzdGQ6OndzdHJpbmcAc3RkOjp1MTZzdHJpbmcAc3RkOjp1MzJzdHJpbmcAZW1zY3JpcHRlbjo6dmFsAGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PGNoYXI+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHNpZ25lZCBjaGFyPgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzx1bnNpZ25lZCBjaGFyPgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxzaG9ydD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8dW5zaWduZWQgc2hvcnQ+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PGludD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8dW5zaWduZWQgaW50PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxsb25nPgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzx1bnNpZ25lZCBsb25nPgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxpbnQ4X3Q+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHVpbnQ4X3Q+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PGludDE2X3Q+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHVpbnQxNl90PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxpbnQzMl90PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzx1aW50MzJfdD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8ZmxvYXQ+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PGRvdWJsZT4ATlN0M19fMjEyYmFzaWNfc3RyaW5nSWhOU18xMWNoYXJfdHJhaXRzSWhFRU5TXzlhbGxvY2F0b3JJaEVFRUUAAAAAYHoAAOZ9AAAAAAAAAQAAAKgZAAAAAAAATlN0M19fMjEyYmFzaWNfc3RyaW5nSXdOU18xMWNoYXJfdHJhaXRzSXdFRU5TXzlhbGxvY2F0b3JJd0VFRUUAAGB6AABAfgAAAAAAAAEAAACoGQAAAAAAAE5TdDNfXzIxMmJhc2ljX3N0cmluZ0lEc05TXzExY2hhcl90cmFpdHNJRHNFRU5TXzlhbGxvY2F0b3JJRHNFRUVFAAAAYHoAAJh+AAAAAAAAAQAAAKgZAAAAAAAATlN0M19fMjEyYmFzaWNfc3RyaW5nSURpTlNfMTFjaGFyX3RyYWl0c0lEaUVFTlNfOWFsbG9jYXRvcklEaUVFRUUAAABgegAA9H4AAAAAAAABAAAAqBkAAAAAAABOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0ljRUUAANx5AABQfwAATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJYUVFAADceQAAeH8AAE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SWhFRQAA3HkAAKB/AABOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0lzRUUAANx5AADIfwAATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJdEVFAADceQAA8H8AAE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SWlF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2+wCCwUK/////wBBoO0CCwkQtgAAAAAAAAkAQbTtAgsCUQIAQcjtAgsSWQIAAAAAAABTAgAAyL8AAAAEAEH07QILBP////8Alp8IBG5hbWUBjZ8IowoAFl9lbWJpbmRfcmVnaXN0ZXJfY2xhc3MBIl9lbWJpbmRfcmVnaXN0ZXJfY2xhc3NfY29uc3RydWN0b3ICJV9lbWJpbmRfcmVnaXN0ZXJfY2xhc3NfY2xhc3NfZnVuY3Rpb24DH19lbWJpbmRfcmVnaXN0ZXJfY2xhc3NfZnVuY3Rpb24EH19lbWJpbmRfcmVnaXN0ZXJfY2xhc3NfcHJvcGVydHkFFV9lbWJpbmRfcmVnaXN0ZXJfZW51bQYbX2VtYmluZF9yZWdpc3Rlcl9lbnVtX3ZhbHVlBxpfZW1iaW5kX3JlZ2lzdGVyX3NtYXJ0X3B0cggYX19jeGFfYWxsb2NhdGVfZXhjZXB0aW9uCQtfX2N4YV90aHJvdwoRX2VtdmFsX3Rha2VfdmFsdWULDV9lbXZhbF9pbmNyZWYMDV9lbXZhbF9kZWNyZWYNC19lbXZhbF9jYWxsDgVyb3VuZA8EZXhpdBANX19hc3NlcnRfZmFpbBEGX19sb2NrEghfX3VubG9jaxMPX193YXNpX2ZkX2Nsb3NlFApfX3N5c2NhbGw1FQxfX3N5c2NhbGwyMjEWC19fc3lzY2FsbDU0Fw5fX3dhc2lfZmRfcmVhZBgPX193YXNpX2ZkX3dyaXRlGRhfX3dhc2lfZW52aXJvbl9zaXplc19nZXQaEl9fd2FzaV9lbnZpcm9uX2dldBsKX19tYXBfZmlsZRwLX19zeXNjYWxsOTEdCnN0cmZ0aW1lX2weBWFib3J0HxVfZW1iaW5kX3JlZ2lzdGVyX3ZvaWQgFV9lbWJpbmRfcmVnaXN0ZXJfYm9vbCEbX2VtYmluZF9yZWdpc3Rlcl9zdGRfc3RyaW5nIhxfZW1iaW5kX3JlZ2lzdGVyX3N0ZF93c3RyaW5nIxZfZW1iaW5kX3JlZ2lzdGVyX2VtdmFsJBhfZW1iaW5kX3JlZ2lzdGVyX2ludGVnZXIlFl9lbWJpbmRfcmVnaXN0ZXJfZmxvYXQmHF9lbWJpbmRfcmVnaXN0ZXJfbWVtb3J5X3ZpZXcnFmVtc2NyaXB0ZW5fcmVzaXplX2hlYXAoFWVtc2NyaXB0ZW5fbWVtY3B5X2JpZykLc2V0VGVtcFJldDAqGmxlZ2FsaW1wb3J0JF9fd2FzaV9mZF9zZWVrKxFfX3dhc21fY2FsbF9jdG9ycyxQRW1zY3JpcHRlbkJpbmRpbmdJbml0aWFsaXplcl9teV9tb2R1bGU6OkVtc2NyaXB0ZW5CaW5kaW5nSW5pdGlhbGl6ZXJfbXlfbW9kdWxlKCktlQFlbXNjcmlwdGVuOjpjbGFzc188c3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+LCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Tm9CYXNlQ2xhc3M+IGVtc2NyaXB0ZW46OnJlZ2lzdGVyX3ZlY3RvcjxpbnQ+KGNoYXIgY29uc3QqKS6eAWVtc2NyaXB0ZW46OmNsYXNzXzxzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4sIGVtc2NyaXB0ZW46OmludGVybmFsOjpOb0Jhc2VDbGFzcz4gZW1zY3JpcHRlbjo6cmVnaXN0ZXJfdmVjdG9yPGRvdWJsZT4oY2hhciBjb25zdCopL5gBZW1zY3JpcHRlbjo6Y2xhc3NfPHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+LCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Tm9CYXNlQ2xhc3M+IGVtc2NyaXB0ZW46OnJlZ2lzdGVyX3ZlY3RvcjxjaGFyPihjaGFyIGNvbnN0KikwswFlbXNjcmlwdGVuOjpjbGFzc188c3RkOjpfXzI6OnZlY3Rvcjx1bnNpZ25lZCBjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHVuc2lnbmVkIGNoYXI+ID4sIGVtc2NyaXB0ZW46OmludGVybmFsOjpOb0Jhc2VDbGFzcz4gZW1zY3JpcHRlbjo6cmVnaXN0ZXJfdmVjdG9yPHVuc2lnbmVkIGNoYXI+KGNoYXIgY29uc3QqKTGbAWVtc2NyaXB0ZW46OmNsYXNzXzxzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+LCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Tm9CYXNlQ2xhc3M+IGVtc2NyaXB0ZW46OnJlZ2lzdGVyX3ZlY3RvcjxmbG9hdD4oY2hhciBjb25zdCopMkp2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTx2ZWN0b3JUb29scz4odmVjdG9yVG9vbHMqKTNEdm9pZCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6cmF3X2Rlc3RydWN0b3I8dmVjdG9yVG9vbHM+KHZlY3RvclRvb2xzKik0R2Vtc2NyaXB0ZW46OmludGVybmFsOjpJbnZva2VyPHZlY3RvclRvb2xzKj46Omludm9rZSh2ZWN0b3JUb29scyogKCopKCkpNT52ZWN0b3JUb29scyogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzx2ZWN0b3JUb29scz4oKTbgAWVtc2NyaXB0ZW46OmludGVybmFsOjpJbnZva2VyPHZvaWQsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiY+OjppbnZva2Uodm9pZCAoKikoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiksIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiopN1R2ZWN0b3JUb29sczo6Y2xlYXJWZWN0b3JEYmwoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+Jik4THZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlTZXR0aW5ncz4obWF4aVNldHRpbmdzKik5YmVtc2NyaXB0ZW46OmludGVybmFsOjpJbnZva2VyPHZvaWQsIGludCwgaW50LCBpbnQ+OjppbnZva2Uodm9pZCAoKikoaW50LCBpbnQsIGludCksIGludCwgaW50LCBpbnQpOiJtYXhpU2V0dGluZ3M6OnNldHVwKGludCwgaW50LCBpbnQpO0J2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpT3NjPihtYXhpT3NjKik8Nm1heGlPc2MqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aU9zYz4oKT2YAWVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aU9zYzo6KikoZG91YmxlKSwgZG91YmxlLCBtYXhpT3NjKiwgZG91YmxlPjo6aW52b2tlKGRvdWJsZSAobWF4aU9zYzo6KiBjb25zdCYpKGRvdWJsZSksIG1heGlPc2MqLCBkb3VibGUpPtgBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpT3NjOjoqKShkb3VibGUsIGRvdWJsZSwgZG91YmxlKSwgZG91YmxlLCBtYXhpT3NjKiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZT46Omludm9rZShkb3VibGUgKG1heGlPc2M6OiogY29uc3QmKShkb3VibGUsIGRvdWJsZSwgZG91YmxlKSwgbWF4aU9zYyosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUpP7gBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpT3NjOjoqKShkb3VibGUsIGRvdWJsZSksIGRvdWJsZSwgbWF4aU9zYyosIGRvdWJsZSwgZG91YmxlPjo6aW52b2tlKGRvdWJsZSAobWF4aU9zYzo6KiBjb25zdCYpKGRvdWJsZSwgZG91YmxlKSwgbWF4aU9zYyosIGRvdWJsZSwgZG91YmxlKUB8ZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpT3NjOjoqKSgpLCBkb3VibGUsIG1heGlPc2MqPjo6aW52b2tlKGRvdWJsZSAobWF4aU9zYzo6KiBjb25zdCYpKCksIG1heGlPc2MqKUGSAWVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKG1heGlPc2M6OiopKGRvdWJsZSksIHZvaWQsIG1heGlPc2MqLCBkb3VibGU+OjppbnZva2Uodm9pZCAobWF4aU9zYzo6KiBjb25zdCYpKGRvdWJsZSksIG1heGlPc2MqLCBkb3VibGUpQkx2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpRW52ZWxvcGU+KG1heGlFbnZlbG9wZSopQ0BtYXhpRW52ZWxvcGUqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aUVudmVsb3BlPigpRIQDZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpRW52ZWxvcGU6OiopKGludCwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiksIGRvdWJsZSwgbWF4aUVudmVsb3BlKiwgaW50LCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mPjo6aW52b2tlKGRvdWJsZSAobWF4aUVudmVsb3BlOjoqIGNvbnN0JikoaW50LCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mKSwgbWF4aUVudmVsb3BlKiwgaW50LCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4qKUW6AWVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKG1heGlFbnZlbG9wZTo6KikoaW50LCBkb3VibGUpLCB2b2lkLCBtYXhpRW52ZWxvcGUqLCBpbnQsIGRvdWJsZT46Omludm9rZSh2b2lkIChtYXhpRW52ZWxvcGU6OiogY29uc3QmKShpbnQsIGRvdWJsZSksIG1heGlFbnZlbG9wZSosIGludCwgZG91YmxlKUYibWF4aUVudmVsb3BlOjpnZXRBbXBsaXR1ZGUoKSBjb25zdEcibWF4aUVudmVsb3BlOjpzZXRBbXBsaXR1ZGUoZG91YmxlKUghbWF4aUVudmVsb3BlOjpnZXRWYWxpbmRleCgpIGNvbnN0SR5tYXhpRW52ZWxvcGU6OnNldFZhbGluZGV4KGludClKkwFpbnQgZW1zY3JpcHRlbjo6aW50ZXJuYWw6OkdldHRlclBvbGljeTxpbnQgKG1heGlFbnZlbG9wZTo6KikoKSBjb25zdD46OmdldDxtYXhpRW52ZWxvcGU+KGludCAobWF4aUVudmVsb3BlOjoqIGNvbnN0JikoKSBjb25zdCwgbWF4aUVudmVsb3BlIGNvbnN0JilLjwF2b2lkIGVtc2NyaXB0ZW46OmludGVybmFsOjpTZXR0ZXJQb2xpY3k8dm9pZCAobWF4aUVudmVsb3BlOjoqKShpbnQpPjo6c2V0PG1heGlFbnZlbG9wZT4odm9pZCAobWF4aUVudmVsb3BlOjoqIGNvbnN0JikoaW50KSwgbWF4aUVudmVsb3BlJiwgaW50KUxOdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aURlbGF5bGluZT4obWF4aURlbGF5bGluZSopTUJtYXhpRGVsYXlsaW5lKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlEZWxheWxpbmU+KClO5AFlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlEZWxheWxpbmU6OiopKGRvdWJsZSwgaW50LCBkb3VibGUpLCBkb3VibGUsIG1heGlEZWxheWxpbmUqLCBkb3VibGUsIGludCwgZG91YmxlPjo6aW52b2tlKGRvdWJsZSAobWF4aURlbGF5bGluZTo6KiBjb25zdCYpKGRvdWJsZSwgaW50LCBkb3VibGUpLCBtYXhpRGVsYXlsaW5lKiwgZG91YmxlLCBpbnQsIGRvdWJsZSlP+AFlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlEZWxheWxpbmU6OiopKGRvdWJsZSwgaW50LCBkb3VibGUsIGludCksIGRvdWJsZSwgbWF4aURlbGF5bGluZSosIGRvdWJsZSwgaW50LCBkb3VibGUsIGludD46Omludm9rZShkb3VibGUgKG1heGlEZWxheWxpbmU6OiogY29uc3QmKShkb3VibGUsIGludCwgZG91YmxlLCBpbnQpLCBtYXhpRGVsYXlsaW5lKiwgZG91YmxlLCBpbnQsIGRvdWJsZSwgaW50KVBIdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aUZpbHRlcj4obWF4aUZpbHRlciopUTxtYXhpRmlsdGVyKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlGaWx0ZXI+KClSHW1heGlGaWx0ZXI6OmdldEN1dG9mZigpIGNvbnN0Ux1tYXhpRmlsdGVyOjpzZXRDdXRvZmYoZG91YmxlKVQgbWF4aUZpbHRlcjo6Z2V0UmVzb25hbmNlKCkgY29uc3RVIG1heGlGaWx0ZXI6OnNldFJlc29uYW5jZShkb3VibGUpVkJ2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpTWl4PihtYXhpTWl4KilXNm1heGlNaXgqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aU1peD4oKViWA2Vtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKG1heGlNaXg6OiopKGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgZG91YmxlKSwgdm9pZCwgbWF4aU1peCosIGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgZG91YmxlPjo6aW52b2tlKHZvaWQgKG1heGlNaXg6OiogY29uc3QmKShkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGRvdWJsZSksIG1heGlNaXgqLCBkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiosIGRvdWJsZSlZtgNlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChtYXhpTWl4OjoqKShkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGRvdWJsZSwgZG91YmxlKSwgdm9pZCwgbWF4aU1peCosIGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgZG91YmxlLCBkb3VibGU+OjppbnZva2Uodm9pZCAobWF4aU1peDo6KiBjb25zdCYpKGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgZG91YmxlLCBkb3VibGUpLCBtYXhpTWl4KiwgZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4qLCBkb3VibGUsIGRvdWJsZSla1gNlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChtYXhpTWl4OjoqKShkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUpLCB2b2lkLCBtYXhpTWl4KiwgZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlPjo6aW52b2tlKHZvaWQgKG1heGlNaXg6OiogY29uc3QmKShkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUpLCBtYXhpTWl4KiwgZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4qLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKVtEdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aUxpbmU+KG1heGlMaW5lKilcOG1heGlMaW5lKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlMaW5lPigpXRZtYXhpTGluZTo6cGxheShkb3VibGUpXi9tYXhpTGluZTo6cHJlcGFyZShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBib29sKV/uAWVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKG1heGlMaW5lOjoqKShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBib29sKSwgdm9pZCwgbWF4aUxpbmUqLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBib29sPjo6aW52b2tlKHZvaWQgKG1heGlMaW5lOjoqIGNvbnN0JikoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgYm9vbCksIG1heGlMaW5lKiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgYm9vbClgH21heGlMaW5lOjp0cmlnZ2VyRW5hYmxlKGRvdWJsZSlhGm1heGlMaW5lOjppc0xpbmVDb21wbGV0ZSgpYkZ2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpWEZhZGU+KG1heGlYRmFkZSopY4cEZW1zY3JpcHRlbjo6aW50ZXJuYWw6Okludm9rZXI8c3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+LCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBkb3VibGU+OjppbnZva2Uoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+ICgqKShzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBkb3VibGUpLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4qLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4qLCBkb3VibGUpZIoBbWF4aVhGYWRlOjp4ZmFkZShzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBkb3VibGUpZYEBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Okludm9rZXI8ZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlPjo6aW52b2tlKGRvdWJsZSAoKikoZG91YmxlLCBkb3VibGUsIGRvdWJsZSksIGRvdWJsZSwgZG91YmxlLCBkb3VibGUpZihtYXhpWEZhZGU6OnhmYWRlKGRvdWJsZSwgZG91YmxlLCBkb3VibGUpZ1l2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpTGFnRXhwPGRvdWJsZT4gPihtYXhpTGFnRXhwPGRvdWJsZT4qKWhNbWF4aUxhZ0V4cDxkb3VibGU+KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlMYWdFeHA8ZG91YmxlPiA+KClpKG1heGlMYWdFeHA8ZG91YmxlPjo6aW5pdChkb3VibGUsIGRvdWJsZSlq3gFlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChtYXhpTGFnRXhwPGRvdWJsZT46OiopKGRvdWJsZSwgZG91YmxlKSwgdm9pZCwgbWF4aUxhZ0V4cDxkb3VibGU+KiwgZG91YmxlLCBkb3VibGU+OjppbnZva2Uodm9pZCAobWF4aUxhZ0V4cDxkb3VibGU+OjoqIGNvbnN0JikoZG91YmxlLCBkb3VibGUpLCBtYXhpTGFnRXhwPGRvdWJsZT4qLCBkb3VibGUsIGRvdWJsZSlrJW1heGlMYWdFeHA8ZG91YmxlPjo6YWRkU2FtcGxlKGRvdWJsZSlsIW1heGlMYWdFeHA8ZG91YmxlPjo6dmFsdWUoKSBjb25zdG0kbWF4aUxhZ0V4cDxkb3VibGU+OjpnZXRBbHBoYSgpIGNvbnN0biRtYXhpTGFnRXhwPGRvdWJsZT46OnNldEFscGhhKGRvdWJsZSlvLm1heGlMYWdFeHA8ZG91YmxlPjo6Z2V0QWxwaGFSZWNpcHJvY2FsKCkgY29uc3RwLm1heGlMYWdFeHA8ZG91YmxlPjo6c2V0QWxwaGFSZWNpcHJvY2FsKGRvdWJsZSlxIm1heGlMYWdFeHA8ZG91YmxlPjo6c2V0VmFsKGRvdWJsZSlySHZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlTYW1wbGU+KG1heGlTYW1wbGUqKXNCdm9pZCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6cmF3X2Rlc3RydWN0b3I8bWF4aVNhbXBsZT4obWF4aVNhbXBsZSopdDxtYXhpU2FtcGxlKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlTYW1wbGU+KCl1HW1heGlTYW1wbGU6OmdldExlbmd0aCgpIGNvbnN0dvYCZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAobWF4aVNhbXBsZTo6Kikoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgaW50KSwgdm9pZCwgbWF4aVNhbXBsZSosIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGludD46Omludm9rZSh2b2lkIChtYXhpU2FtcGxlOjoqIGNvbnN0Jikoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgaW50KSwgbWF4aVNhbXBsZSosIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiosIGludCl3qwNlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxpbnQgKG1heGlTYW1wbGU6OiopKHN0ZDo6X18yOjp2ZWN0b3I8dW5zaWduZWQgY2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjx1bnNpZ25lZCBjaGFyPiA+JiwgaW50KSwgaW50LCBtYXhpU2FtcGxlKiwgc3RkOjpfXzI6OnZlY3Rvcjx1bnNpZ25lZCBjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHVuc2lnbmVkIGNoYXI+ID4mLCBpbnQ+OjppbnZva2UoaW50IChtYXhpU2FtcGxlOjoqIGNvbnN0Jikoc3RkOjpfXzI6OnZlY3Rvcjx1bnNpZ25lZCBjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHVuc2lnbmVkIGNoYXI+ID4mLCBpbnQpLCBtYXhpU2FtcGxlKiwgc3RkOjpfXzI6OnZlY3Rvcjx1bnNpZ25lZCBjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHVuc2lnbmVkIGNoYXI+ID4qLCBpbnQpeIIBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAobWF4aVNhbXBsZTo6KikoKSwgdm9pZCwgbWF4aVNhbXBsZSo+OjppbnZva2Uodm9pZCAobWF4aVNhbXBsZTo6KiBjb25zdCYpKCksIG1heGlTYW1wbGUqKXkTbWF4aVNhbXBsZTo6Y2xlYXIoKXrmAWVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKG1heGlTYW1wbGU6OiopKGZsb2F0LCBmbG9hdCwgYm9vbCwgYm9vbCksIHZvaWQsIG1heGlTYW1wbGUqLCBmbG9hdCwgZmxvYXQsIGJvb2wsIGJvb2w+OjppbnZva2Uodm9pZCAobWF4aVNhbXBsZTo6KiBjb25zdCYpKGZsb2F0LCBmbG9hdCwgYm9vbCwgYm9vbCksIG1heGlTYW1wbGUqLCBmbG9hdCwgZmxvYXQsIGJvb2wsIGJvb2wpe6MEZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8Ym9vbCAobWF4aVNhbXBsZTo6Kikoc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiwgaW50KSwgYm9vbCwgbWF4aVNhbXBsZSosIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4sIGludD46Omludm9rZShib29sIChtYXhpU2FtcGxlOjoqIGNvbnN0Jikoc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiwgaW50KSwgbWF4aVNhbXBsZSosIGVtc2NyaXB0ZW46OmludGVybmFsOjpCaW5kaW5nVHlwZTxzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+LCB2b2lkPjo6J3VubmFtZWQnKiwgaW50KXxCdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aUR5bj4obWF4aUR5biopfTZtYXhpRHluKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlEeW4+KCl+kAJlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlEeW46OiopKGRvdWJsZSwgZG91YmxlLCBsb25nLCBkb3VibGUsIGRvdWJsZSksIGRvdWJsZSwgbWF4aUR5biosIGRvdWJsZSwgZG91YmxlLCBsb25nLCBkb3VibGUsIGRvdWJsZT46Omludm9rZShkb3VibGUgKG1heGlEeW46OiogY29uc3QmKShkb3VibGUsIGRvdWJsZSwgbG9uZywgZG91YmxlLCBkb3VibGUpLCBtYXhpRHluKiwgZG91YmxlLCBkb3VibGUsIGxvbmcsIGRvdWJsZSwgZG91YmxlKX+YAmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aUR5bjo6KikoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUpLCBkb3VibGUsIG1heGlEeW4qLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZT46Omludm9rZShkb3VibGUgKG1heGlEeW46OiogY29uc3QmKShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSksIG1heGlEeW4qLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSmAAUJ2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpRW52PihtYXhpRW52KimBATZtYXhpRW52KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlFbnY+KCmCAYQCZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpRW52OjoqKShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBsb25nLCBpbnQpLCBkb3VibGUsIG1heGlFbnYqLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBsb25nLCBpbnQ+OjppbnZva2UoZG91YmxlIChtYXhpRW52OjoqIGNvbnN0JikoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgbG9uZywgaW50KSwgbWF4aUVudiosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGxvbmcsIGludCmDAcQCZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpRW52OjoqKShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgbG9uZywgaW50KSwgZG91YmxlLCBtYXhpRW52KiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGxvbmcsIGludD46Omludm9rZShkb3VibGUgKG1heGlFbnY6OiogY29uc3QmKShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgbG9uZywgaW50KSwgbWF4aUVudiosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBsb25nLCBpbnQphAGsAWVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aUVudjo6KikoZG91YmxlLCBpbnQpLCBkb3VibGUsIG1heGlFbnYqLCBkb3VibGUsIGludD46Omludm9rZShkb3VibGUgKG1heGlFbnY6OiogY29uc3QmKShkb3VibGUsIGludCksIG1heGlFbnYqLCBkb3VibGUsIGludCmFARttYXhpRW52OjpnZXRUcmlnZ2VyKCkgY29uc3SGARhtYXhpRW52OjpzZXRUcmlnZ2VyKGludCmHAUJ2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxjb252ZXJ0Pihjb252ZXJ0KimIAWJlbXNjcmlwdGVuOjppbnRlcm5hbDo6RnVuY3Rpb25JbnZva2VyPGRvdWJsZSAoKikoaW50KSwgZG91YmxlLCBpbnQ+OjppbnZva2UoZG91YmxlICgqKikoaW50KSwgaW50KYkBSGVtc2NyaXB0ZW46OmludGVybmFsOjpJbnZva2VyPGRvdWJsZSwgaW50Pjo6aW52b2tlKGRvdWJsZSAoKikoaW50KSwgaW50KYoBGmNvbnZlcnQ6Om1zVG9TYW1wcyhkb3VibGUpiwFuZW1zY3JpcHRlbjo6aW50ZXJuYWw6OkZ1bmN0aW9uSW52b2tlcjxkb3VibGUgKCopKGRvdWJsZSksIGRvdWJsZSwgZG91YmxlPjo6aW52b2tlKGRvdWJsZSAoKiopKGRvdWJsZSksIGRvdWJsZSmMAVFlbXNjcmlwdGVuOjppbnRlcm5hbDo6SW52b2tlcjxkb3VibGUsIGRvdWJsZT46Omludm9rZShkb3VibGUgKCopKGRvdWJsZSksIGRvdWJsZSmNAVZ2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpU2FtcGxlQW5kSG9sZD4obWF4aVNhbXBsZUFuZEhvbGQqKY4BSm1heGlTYW1wbGVBbmRIb2xkKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlTYW1wbGVBbmRIb2xkPigpjwEmbWF4aVNhbXBsZUFuZEhvbGQ6OnNhaChkb3VibGUsIGRvdWJsZSmQAUp2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpRmxhbmdlcj4obWF4aUZsYW5nZXIqKZEBPm1heGlGbGFuZ2VyKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlGbGFuZ2VyPigpkgFBbWF4aUZsYW5nZXI6OmZsYW5nZShkb3VibGUsIHVuc2lnbmVkIGludCwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSmTAcACZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpRmxhbmdlcjo6KikoZG91YmxlLCB1bnNpZ25lZCBpbnQsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUpLCBkb3VibGUsIG1heGlGbGFuZ2VyKiwgZG91YmxlLCB1bnNpZ25lZCBpbnQsIGRvdWJsZSwgZG91YmxlLCBkb3VibGU+OjppbnZva2UoZG91YmxlIChtYXhpRmxhbmdlcjo6KiBjb25zdCYpKGRvdWJsZSwgdW5zaWduZWQgaW50LCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKSwgbWF4aUZsYW5nZXIqLCBkb3VibGUsIHVuc2lnbmVkIGludCwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSmUAUh2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpQ2hvcnVzPihtYXhpQ2hvcnVzKimVATxtYXhpQ2hvcnVzKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlDaG9ydXM+KCmWAUBtYXhpQ2hvcnVzOjpjaG9ydXMoZG91YmxlLCB1bnNpZ25lZCBpbnQsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUplwFOdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aURDQmxvY2tlcj4obWF4aURDQmxvY2tlciopmAFCbWF4aURDQmxvY2tlciogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpRENCbG9ja2VyPigpmQEjbWF4aURDQmxvY2tlcjo6cGxheShkb3VibGUsIGRvdWJsZSmaAUJ2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpU1ZGPihtYXhpU1ZGKimbATZtYXhpU1ZGKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlTVkY+KCmcARptYXhpU1ZGOjpzZXRDdXRvZmYoZG91YmxlKZ0BHW1heGlTVkY6OnNldFJlc29uYW5jZShkb3VibGUpngE1bWF4aVNWRjo6cGxheShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSmfAUR2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpTWF0aD4obWF4aU1hdGgqKaABaWVtc2NyaXB0ZW46OmludGVybmFsOjpJbnZva2VyPGRvdWJsZSwgZG91YmxlLCBkb3VibGU+OjppbnZva2UoZG91YmxlICgqKShkb3VibGUsIGRvdWJsZSksIGRvdWJsZSwgZG91YmxlKaEBHW1heGlNYXRoOjphZGQoZG91YmxlLCBkb3VibGUpogEdbWF4aU1hdGg6OnN1Yihkb3VibGUsIGRvdWJsZSmjAR1tYXhpTWF0aDo6bXVsKGRvdWJsZSwgZG91YmxlKaQBHW1heGlNYXRoOjpkaXYoZG91YmxlLCBkb3VibGUppQEcbWF4aU1hdGg6Omd0KGRvdWJsZSwgZG91YmxlKaYBHG1heGlNYXRoOjpsdChkb3VibGUsIGRvdWJsZSmnAR1tYXhpTWF0aDo6Z3RlKGRvdWJsZSwgZG91YmxlKagBHW1heGlNYXRoOjpsdGUoZG91YmxlLCBkb3VibGUpqQEdbWF4aU1hdGg6Om1vZChkb3VibGUsIGRvdWJsZSmqARVtYXhpTWF0aDo6YWJzKGRvdWJsZSmrAR9tYXhpTWF0aDo6eHBvd3koZG91YmxlLCBkb3VibGUprAFGdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aUNsb2NrPihtYXhpQ2xvY2sqKa0BOm1heGlDbG9jayogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpQ2xvY2s+KCmuARltYXhpQ2xvY2s6OmlzVGljaygpIGNvbnN0rwEibWF4aUNsb2NrOjpnZXRDdXJyZW50Q291bnQoKSBjb25zdLABH21heGlDbG9jazo6c2V0Q3VycmVudENvdW50KGludCmxAR9tYXhpQ2xvY2s6OmdldExhc3RDb3VudCgpIGNvbnN0sgEcbWF4aUNsb2NrOjpzZXRMYXN0Q291bnQoaW50KbMBGW1heGlDbG9jazo6Z2V0QnBzKCkgY29uc3S0ARZtYXhpQ2xvY2s6OnNldEJwcyhpbnQptQEZbWF4aUNsb2NrOjpnZXRCcG0oKSBjb25zdLYBFm1heGlDbG9jazo6c2V0QnBtKGludCm3ARdtYXhpQ2xvY2s6OnNldFRpY2soaW50KbgBG21heGlDbG9jazo6Z2V0VGlja3MoKSBjb25zdLkBGG1heGlDbG9jazo6c2V0VGlja3MoaW50KboBYHZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlLdXJhbW90b09zY2lsbGF0b3I+KG1heGlLdXJhbW90b09zY2lsbGF0b3IqKbsBVG1heGlLdXJhbW90b09zY2lsbGF0b3IqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aUt1cmFtb3RvT3NjaWxsYXRvcj4oKbwBZG1heGlLdXJhbW90b09zY2lsbGF0b3I6OnBsYXkoZG91YmxlLCBkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPim9AdYDZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yOjoqKShkb3VibGUsIGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KSwgZG91YmxlLCBtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yKiwgZG91YmxlLCBkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiA+OjppbnZva2UoZG91YmxlIChtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yOjoqIGNvbnN0JikoZG91YmxlLCBkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiksIG1heGlLdXJhbW90b09zY2lsbGF0b3IqLCBkb3VibGUsIGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+Kim+AWZ2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0PihtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0Kim/AWB2b2lkIGVtc2NyaXB0ZW46OmludGVybmFsOjpyYXdfZGVzdHJ1Y3RvcjxtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0PihtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0KinAAZ4BZW1zY3JpcHRlbjo6aW50ZXJuYWw6Okludm9rZXI8bWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldCosIHVuc2lnbmVkIGxvbmcgY29uc3QmJj46Omludm9rZShtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0KiAoKikodW5zaWduZWQgbG9uZyBjb25zdCYmKSwgdW5zaWduZWQgbG9uZynBAYQBbWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0LCB1bnNpZ25lZCBsb25nIGNvbnN0Pih1bnNpZ25lZCBsb25nIGNvbnN0JiYpwgEvbWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldDo6cGxheShkb3VibGUsIGRvdWJsZSnDATptYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0OjpzZXRQaGFzZShkb3VibGUsIHVuc2lnbmVkIGxvbmcpxAGWAmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQ6OiopKGRvdWJsZSwgdW5zaWduZWQgbG9uZyksIHZvaWQsIG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQqLCBkb3VibGUsIHVuc2lnbmVkIGxvbmc+OjppbnZva2Uodm9pZCAobWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldDo6KiBjb25zdCYpKGRvdWJsZSwgdW5zaWduZWQgbG9uZyksIG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQqLCBkb3VibGUsIHVuc2lnbmVkIGxvbmcpxQFjbWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldDo6c2V0UGhhc2VzKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiBjb25zdCYpxgEybWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldDo6Z2V0UGhhc2UodW5zaWduZWQgbG9uZynHAfwBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0OjoqKSh1bnNpZ25lZCBsb25nKSwgZG91YmxlLCBtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0KiwgdW5zaWduZWQgbG9uZz46Omludm9rZShkb3VibGUgKG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQ6OiogY29uc3QmKSh1bnNpZ25lZCBsb25nKSwgbWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldCosIHVuc2lnbmVkIGxvbmcpyAEhbWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldDo6c2l6ZSgpyQFqdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aUFzeW5jS3VyYW1vdG9Pc2NpbGxhdG9yPihtYXhpQXN5bmNLdXJhbW90b09zY2lsbGF0b3IqKcoBrAFtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0KiBlbXNjcmlwdGVuOjpiYXNlPG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQ+Ojpjb252ZXJ0UG9pbnRlcjxtYXhpQXN5bmNLdXJhbW90b09zY2lsbGF0b3IsIG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQ+KG1heGlBc3luY0t1cmFtb3RvT3NjaWxsYXRvciopywGIAW1heGlBc3luY0t1cmFtb3RvT3NjaWxsYXRvciogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpQXN5bmNLdXJhbW90b09zY2lsbGF0b3IsIHVuc2lnbmVkIGxvbmcgY29uc3Q+KHVuc2lnbmVkIGxvbmcgY29uc3QmJinMATFtYXhpQXN5bmNLdXJhbW90b09zY2lsbGF0b3I6OnBsYXkoZG91YmxlLCBkb3VibGUpzQE8bWF4aUFzeW5jS3VyYW1vdG9Pc2NpbGxhdG9yOjpzZXRQaGFzZShkb3VibGUsIHVuc2lnbmVkIGxvbmcpzgFlbWF4aUFzeW5jS3VyYW1vdG9Pc2NpbGxhdG9yOjpzZXRQaGFzZXMoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+IGNvbnN0JinPAUJ2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpRkZUPihtYXhpRkZUKinQATx2b2lkIGVtc2NyaXB0ZW46OmludGVybmFsOjpyYXdfZGVzdHJ1Y3RvcjxtYXhpRkZUPihtYXhpRkZUKinRATZtYXhpRkZUKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlGRlQ+KCnSAa4BZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAobWF4aUZGVDo6KikoaW50LCBpbnQsIGludCksIHZvaWQsIG1heGlGRlQqLCBpbnQsIGludCwgaW50Pjo6aW52b2tlKHZvaWQgKG1heGlGRlQ6OiogY29uc3QmKShpbnQsIGludCwgaW50KSwgbWF4aUZGVCosIGludCwgaW50LCBpbnQp0wHaAWVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGJvb2wgKG1heGlGRlQ6OiopKGZsb2F0LCBtYXhpRkZUOjpmZnRNb2RlcyksIGJvb2wsIG1heGlGRlQqLCBmbG9hdCwgbWF4aUZGVDo6ZmZ0TW9kZXM+OjppbnZva2UoYm9vbCAobWF4aUZGVDo6KiBjb25zdCYpKGZsb2F0LCBtYXhpRkZUOjpmZnRNb2RlcyksIG1heGlGRlQqLCBmbG9hdCwgbWF4aUZGVDo6ZmZ0TW9kZXMp1AF5ZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZmxvYXQgKG1heGlGRlQ6OiopKCksIGZsb2F0LCBtYXhpRkZUKj46Omludm9rZShmbG9hdCAobWF4aUZGVDo6KiBjb25zdCYpKCksIG1heGlGRlQqKdUBiQJlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+JiAobWF4aUZGVDo6KikoKSwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiYsIG1heGlGRlQqPjo6aW52b2tlKHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mIChtYXhpRkZUOjoqIGNvbnN0JikoKSwgbWF4aUZGVCop1gEabWF4aUZGVDo6Z2V0TWFnbml0dWRlc0RCKCnXARRtYXhpRkZUOjpnZXRQaGFzZXMoKdgBFW1heGlGRlQ6OmdldE51bUJpbnMoKdkBFW1heGlGRlQ6OmdldEZGVFNpemUoKdoBFW1heGlGRlQ6OmdldEhvcFNpemUoKdsBGG1heGlGRlQ6OmdldFdpbmRvd1NpemUoKdwBRHZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlJRkZUPihtYXhpSUZGVCop3QE+dm9pZCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6cmF3X2Rlc3RydWN0b3I8bWF4aUlGRlQ+KG1heGlJRkZUKineAThtYXhpSUZGVCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpSUZGVD4oKd8BgQVlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxmbG9hdCAobWF4aUlGRlQ6OiopKHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mLCBzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+JiwgbWF4aUlGRlQ6OmZmdE1vZGVzKSwgZmxvYXQsIG1heGlJRkZUKiwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiYsIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mLCBtYXhpSUZGVDo6ZmZ0TW9kZXM+OjppbnZva2UoZmxvYXQgKG1heGlJRkZUOjoqIGNvbnN0Jikoc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiYsIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mLCBtYXhpSUZGVDo6ZmZ0TW9kZXMpLCBtYXhpSUZGVCosIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4qLCBzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+KiwgbWF4aUlGRlQ6OmZmdE1vZGVzKeABZXZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPiA+KG1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPiop4QFfdm9pZCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6cmF3X2Rlc3RydWN0b3I8bWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+ID4obWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+KiniAVltYXhpTUZDQ0FuYWx5c2VyPGRvdWJsZT4qIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+ID4oKeMBWW1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPjo6c2V0dXAodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgZG91YmxlLCBkb3VibGUp5AGeA2Vtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKG1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPjo6KikodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgZG91YmxlLCBkb3VibGUpLCB2b2lkLCBtYXhpTUZDQ0FuYWx5c2VyPGRvdWJsZT4qLCB1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50LCBkb3VibGUsIGRvdWJsZT46Omludm9rZSh2b2lkIChtYXhpTUZDQ0FuYWx5c2VyPGRvdWJsZT46OiogY29uc3QmKSh1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50LCBkb3VibGUsIGRvdWJsZSksIG1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPiosIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQsIGRvdWJsZSwgZG91YmxlKeUBVW1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPjo6bWZjYyhzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+JinmAasEZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8c3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiAobWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+OjoqKShzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+JiksIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIG1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPiosIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mPjo6aW52b2tlKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYgKG1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPjo6KiBjb25zdCYpKHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mKSwgbWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+Kiwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiop5wGVAXZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiA+KHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiop6AGPAXZvaWQgZW1zY3JpcHRlbjo6aW50ZXJuYWw6OnJhd19kZXN0cnVjdG9yPHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiA+KHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiop6QGJAXN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4gPigp6gFHc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+OjpwdXNoX2JhY2soaW50IGNvbnN0JinrAb8CZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAoc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+OjoqKShpbnQgY29uc3QmKSwgdm9pZCwgc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+KiwgaW50IGNvbnN0Jj46Omludm9rZSh2b2lkIChzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID46OiogY29uc3QmKShpbnQgY29uc3QmKSwgc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+KiwgaW50KewBU3N0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPjo6cmVzaXplKHVuc2lnbmVkIGxvbmcsIGludCBjb25zdCYp7QH7AmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPjo6KikodW5zaWduZWQgbG9uZywgaW50IGNvbnN0JiksIHZvaWQsIHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiosIHVuc2lnbmVkIGxvbmcsIGludCBjb25zdCY+OjppbnZva2Uodm9pZCAoc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+OjoqIGNvbnN0JikodW5zaWduZWQgbG9uZywgaW50IGNvbnN0JiksIHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiosIHVuc2lnbmVkIGxvbmcsIGludCnuAT5zdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID46OnNpemUoKSBjb25zdO8BogFlbXNjcmlwdGVuOjppbnRlcm5hbDo6VmVjdG9yQWNjZXNzPHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiA+OjpnZXQoc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+IGNvbnN0JiwgdW5zaWduZWQgbG9uZynwAYMDZW1zY3JpcHRlbjo6aW50ZXJuYWw6OkZ1bmN0aW9uSW52b2tlcjxlbXNjcmlwdGVuOjp2YWwgKCopKHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiBjb25zdCYsIHVuc2lnbmVkIGxvbmcpLCBlbXNjcmlwdGVuOjp2YWwsIHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiBjb25zdCYsIHVuc2lnbmVkIGxvbmc+OjppbnZva2UoZW1zY3JpcHRlbjo6dmFsICgqKikoc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+IGNvbnN0JiwgdW5zaWduZWQgbG9uZyksIHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiosIHVuc2lnbmVkIGxvbmcp8QGoAWVtc2NyaXB0ZW46OmludGVybmFsOjpWZWN0b3JBY2Nlc3M8c3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+ID46OnNldChzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4mLCB1bnNpZ25lZCBsb25nLCBpbnQgY29uc3QmKfIB+QJlbXNjcmlwdGVuOjppbnRlcm5hbDo6RnVuY3Rpb25JbnZva2VyPGJvb2wgKCopKHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiYsIHVuc2lnbmVkIGxvbmcsIGludCBjb25zdCYpLCBib29sLCBzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4mLCB1bnNpZ25lZCBsb25nLCBpbnQgY29uc3QmPjo6aW52b2tlKGJvb2wgKCoqKShzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4mLCB1bnNpZ25lZCBsb25nLCBpbnQgY29uc3QmKSwgc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+KiwgdW5zaWduZWQgbG9uZywgaW50KfMBoQF2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4gPihzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4qKfQBUHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPjo6cHVzaF9iYWNrKGRvdWJsZSBjb25zdCYp9QHjAmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPjo6KikoZG91YmxlIGNvbnN0JiksIHZvaWQsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiosIGRvdWJsZSBjb25zdCY+OjppbnZva2Uodm9pZCAoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+OjoqIGNvbnN0JikoZG91YmxlIGNvbnN0JiksIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiosIGRvdWJsZSn2AVxzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID46OnJlc2l6ZSh1bnNpZ25lZCBsb25nLCBkb3VibGUgY29uc3QmKfcBnwNlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID46OiopKHVuc2lnbmVkIGxvbmcsIGRvdWJsZSBjb25zdCYpLCB2b2lkLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4qLCB1bnNpZ25lZCBsb25nLCBkb3VibGUgY29uc3QmPjo6aW52b2tlKHZvaWQgKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPjo6KiBjb25zdCYpKHVuc2lnbmVkIGxvbmcsIGRvdWJsZSBjb25zdCYpLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4qLCB1bnNpZ25lZCBsb25nLCBkb3VibGUp+AFEc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+OjpzaXplKCkgY29uc3T5Aa4BZW1zY3JpcHRlbjo6aW50ZXJuYWw6OlZlY3RvckFjY2VzczxzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4gPjo6Z2V0KHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiBjb25zdCYsIHVuc2lnbmVkIGxvbmcp+gG3AWVtc2NyaXB0ZW46OmludGVybmFsOjpWZWN0b3JBY2Nlc3M8c3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+ID46OnNldChzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCB1bnNpZ25lZCBsb25nLCBkb3VibGUgY29uc3QmKfsBnQNlbXNjcmlwdGVuOjppbnRlcm5hbDo6RnVuY3Rpb25JbnZva2VyPGJvb2wgKCopKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIHVuc2lnbmVkIGxvbmcsIGRvdWJsZSBjb25zdCYpLCBib29sLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCB1bnNpZ25lZCBsb25nLCBkb3VibGUgY29uc3QmPjo6aW52b2tlKGJvb2wgKCoqKShzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCB1bnNpZ25lZCBsb25nLCBkb3VibGUgY29uc3QmKSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KiwgdW5zaWduZWQgbG9uZywgZG91YmxlKfwBmQF2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiA+KHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+Kin9AUpzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6cHVzaF9iYWNrKGNoYXIgY29uc3QmKf4BywJlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6KikoY2hhciBjb25zdCYpLCB2b2lkLCBzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiosIGNoYXIgY29uc3QmPjo6aW52b2tlKHZvaWQgKHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjoqIGNvbnN0JikoY2hhciBjb25zdCYpLCBzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiosIGNoYXIp/wFWc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OnJlc2l6ZSh1bnNpZ25lZCBsb25nLCBjaGFyIGNvbnN0JimAAocDZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAoc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OiopKHVuc2lnbmVkIGxvbmcsIGNoYXIgY29uc3QmKSwgdm9pZCwgc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4qLCB1bnNpZ25lZCBsb25nLCBjaGFyIGNvbnN0Jj46Omludm9rZSh2b2lkIChzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6KiBjb25zdCYpKHVuc2lnbmVkIGxvbmcsIGNoYXIgY29uc3QmKSwgc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4qLCB1bnNpZ25lZCBsb25nLCBjaGFyKYECQHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpzaXplKCkgY29uc3SCAqYBZW1zY3JpcHRlbjo6aW50ZXJuYWw6OlZlY3RvckFjY2VzczxzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiA+OjpnZXQoc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QmLCB1bnNpZ25lZCBsb25nKYMCrQFlbXNjcmlwdGVuOjppbnRlcm5hbDo6VmVjdG9yQWNjZXNzPHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+ID46OnNldChzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiYsIHVuc2lnbmVkIGxvbmcsIGNoYXIgY29uc3QmKYQChQNlbXNjcmlwdGVuOjppbnRlcm5hbDo6RnVuY3Rpb25JbnZva2VyPGJvb2wgKCopKHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+JiwgdW5zaWduZWQgbG9uZywgY2hhciBjb25zdCYpLCBib29sLCBzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiYsIHVuc2lnbmVkIGxvbmcsIGNoYXIgY29uc3QmPjo6aW52b2tlKGJvb2wgKCoqKShzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiYsIHVuc2lnbmVkIGxvbmcsIGNoYXIgY29uc3QmKSwgc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4qLCB1bnNpZ25lZCBsb25nLCBjaGFyKYUCvQF2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxzdGQ6Ol9fMjo6dmVjdG9yPHVuc2lnbmVkIGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8dW5zaWduZWQgY2hhcj4gPiA+KHN0ZDo6X18yOjp2ZWN0b3I8dW5zaWduZWQgY2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjx1bnNpZ25lZCBjaGFyPiA+KimGAsoBZW1zY3JpcHRlbjo6aW50ZXJuYWw6OlZlY3RvckFjY2VzczxzdGQ6Ol9fMjo6dmVjdG9yPHVuc2lnbmVkIGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8dW5zaWduZWQgY2hhcj4gPiA+OjpnZXQoc3RkOjpfXzI6OnZlY3Rvcjx1bnNpZ25lZCBjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHVuc2lnbmVkIGNoYXI+ID4gY29uc3QmLCB1bnNpZ25lZCBsb25nKYcCnQF2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+ID4oc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiopiALXAmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID46OiopKGZsb2F0IGNvbnN0JiksIHZvaWQsIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4qLCBmbG9hdCBjb25zdCY+OjppbnZva2Uodm9pZCAoc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPjo6KiBjb25zdCYpKGZsb2F0IGNvbnN0JiksIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4qLCBmbG9hdCmJApMDZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAoc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPjo6KikodW5zaWduZWQgbG9uZywgZmxvYXQgY29uc3QmKSwgdm9pZCwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiosIHVuc2lnbmVkIGxvbmcsIGZsb2F0IGNvbnN0Jj46Omludm9rZSh2b2lkIChzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+OjoqIGNvbnN0JikodW5zaWduZWQgbG9uZywgZmxvYXQgY29uc3QmKSwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiosIHVuc2lnbmVkIGxvbmcsIGZsb2F0KYoCqgFlbXNjcmlwdGVuOjppbnRlcm5hbDo6VmVjdG9yQWNjZXNzPHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4gPjo6Z2V0KHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4gY29uc3QmLCB1bnNpZ25lZCBsb25nKYsCkQNlbXNjcmlwdGVuOjppbnRlcm5hbDo6RnVuY3Rpb25JbnZva2VyPGJvb2wgKCopKHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mLCB1bnNpZ25lZCBsb25nLCBmbG9hdCBjb25zdCYpLCBib29sLCBzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+JiwgdW5zaWduZWQgbG9uZywgZmxvYXQgY29uc3QmPjo6aW52b2tlKGJvb2wgKCoqKShzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+JiwgdW5zaWduZWQgbG9uZywgZmxvYXQgY29uc3QmKSwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiosIHVuc2lnbmVkIGxvbmcsIGZsb2F0KYwCXnN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPjo6X19hcHBlbmQodW5zaWduZWQgbG9uZywgZG91YmxlIGNvbnN0JimNAjhtYXhpTUZDQ0FuYWx5c2VyPGRvdWJsZT46OmNhbGNNZWxGaWx0ZXJCYW5rKGRvdWJsZSwgaW50KY4CZkVtc2NyaXB0ZW5CaW5kaW5nSW5pdGlhbGl6ZXJfbXlfbW9kdWxlX21heGlHcmFpbnM6OkVtc2NyaXB0ZW5CaW5kaW5nSW5pdGlhbGl6ZXJfbXlfbW9kdWxlX21heGlHcmFpbnMoKY8Cc3ZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPihtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KimQAm12b2lkIGVtc2NyaXB0ZW46OmludGVybmFsOjpyYXdfZGVzdHJ1Y3RvcjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4obWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiopkQKYAWVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6Z2V0KHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiBjb25zdCYpkgJmZW1zY3JpcHRlbjo6c21hcnRfcHRyX3RyYWl0PHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojpjb25zdHJ1Y3RfbnVsbCgpkwKdAWVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6c2hhcmUobWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGVtc2NyaXB0ZW46OmludGVybmFsOjpfRU1fVkFMKimUApsBdm9pZCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6cmF3X2Rlc3RydWN0b3I8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID4oc3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+KimVApwBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Okludm9rZXI8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46Omludm9rZShzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gKCopKCkplgLCAXN0ZDo6X18yOjplbmFibGVfaWY8IShpc19hcnJheTxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID46OnZhbHVlKSwgc3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46OnR5cGUgc3RkOjpfXzI6Om1ha2Vfc2hhcmVkPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPigplwI3bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6c2V0U2FtcGxlKG1heGlTYW1wbGUqKZgCOG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OmdldE5vcm1hbGlzZWRQb3NpdGlvbigpmQI0bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6c2V0UG9zaXRpb24oZG91YmxlKZoCQm1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OnBsYXkoZG91YmxlLCBkb3VibGUsIGludCwgZG91YmxlKZsCzAJlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OiopKGRvdWJsZSwgZG91YmxlLCBpbnQsIGRvdWJsZSksIGRvdWJsZSwgbWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGRvdWJsZSwgZG91YmxlLCBpbnQsIGRvdWJsZT46Omludm9rZShkb3VibGUgKG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OiogY29uc3QmKShkb3VibGUsIGRvdWJsZSwgaW50LCBkb3VibGUpLCBtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KiwgZG91YmxlLCBkb3VibGUsIGludCwgZG91YmxlKZwCRG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OnBsYXlBdFBvc2l0aW9uKGRvdWJsZSwgZG91YmxlLCBpbnQpnQKsAmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6KikoZG91YmxlLCBkb3VibGUsIGludCksIGRvdWJsZSwgbWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGRvdWJsZSwgZG91YmxlLCBpbnQ+OjppbnZva2UoZG91YmxlIChtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+OjoqIGNvbnN0JikoZG91YmxlLCBkb3VibGUsIGludCksIG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qLCBkb3VibGUsIGRvdWJsZSwgaW50KZ4CcXZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+KG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiopnwJrdm9pZCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6cmF3X2Rlc3RydWN0b3I8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4obWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+KimgApsBZW1zY3JpcHRlbjo6c21hcnRfcHRyX3RyYWl0PHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+ID46OnNoYXJlKG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiosIGVtc2NyaXB0ZW46OmludGVybmFsOjpfRU1fVkFMKimhAr8Bc3RkOjpfXzI6OmVuYWJsZV9pZjwhKGlzX2FycmF5PG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+Ojp2YWx1ZSksIHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+ID46OnR5cGUgc3RkOjpfXzI6Om1ha2Vfc2hhcmVkPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+KCmiAjZtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj46OnNldFNhbXBsZShtYXhpU2FtcGxlKimjAkFtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj46OnBsYXkoZG91YmxlLCBkb3VibGUsIGludCwgZG91YmxlKaQCa3ZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+KG1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPioppQJfbWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+KCmmAjNtYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OnNldFNhbXBsZShtYXhpU2FtcGxlKimnAjFtYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OnNldExvb3BTdGFydChkb3VibGUpqAIvbWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+OjpzZXRMb29wRW5kKGRvdWJsZSmpAiltYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OmdldExvb3BFbmQoKaoCRm1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6cGxheShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBpbnQsIGRvdWJsZSmrAtwCZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OiopKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGludCwgZG91YmxlKSwgZG91YmxlLCBtYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBpbnQsIGRvdWJsZT46Omludm9rZShkb3VibGUgKG1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6KiBjb25zdCYpKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGludCwgZG91YmxlKSwgbWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgaW50LCBkb3VibGUprAJIbWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+OjpwbGF5QXRQb3NpdGlvbihkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBpbnQprQK8AmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+OjoqKShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBpbnQpLCBkb3VibGUsIG1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGludD46Omludm9rZShkb3VibGUgKG1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6KiBjb25zdCYpKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGludCksIG1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGludCmuAnBtYXhpR3JhaW48aGFubldpbkZ1bmN0b3I+OjptYXhpR3JhaW4obWF4aVNhbXBsZSosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIG1heGlHcmFpbldpbmRvd0NhY2hlPGhhbm5XaW5GdW5jdG9yPioprwJiRW1zY3JpcHRlbkJpbmRpbmdJbml0aWFsaXplcl9teV9tb2R1bGVfbWF4aWJpdHM6OkVtc2NyaXB0ZW5CaW5kaW5nSW5pdGlhbGl6ZXJfbXlfbW9kdWxlX21heGliaXRzKCmwAkR2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpQml0cz4obWF4aUJpdHMqKbECb2Vtc2NyaXB0ZW46OmludGVybmFsOjpJbnZva2VyPHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50Pjo6aW52b2tlKHVuc2lnbmVkIGludCAoKikodW5zaWduZWQgaW50KSwgdW5zaWduZWQgaW50KbICmQFlbXNjcmlwdGVuOjppbnRlcm5hbDo6SW52b2tlcjx1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50Pjo6aW52b2tlKHVuc2lnbmVkIGludCAoKikodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQpLCB1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCmzAihtYXhpQml0czo6YXQodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQptAIpbWF4aUJpdHM6OnNobCh1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCm1AiltYXhpQml0czo6c2hyKHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KbYCwwFlbXNjcmlwdGVuOjppbnRlcm5hbDo6SW52b2tlcjx1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQ+OjppbnZva2UodW5zaWduZWQgaW50ICgqKSh1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KSwgdW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCm3AjVtYXhpQml0czo6cih1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KbgCKm1heGlCaXRzOjpsYW5kKHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KbkCKW1heGlCaXRzOjpsb3IodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQpugIqbWF4aUJpdHM6Omx4b3IodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQpuwIbbWF4aUJpdHM6Om5lZyh1bnNpZ25lZCBpbnQpvAIbbWF4aUJpdHM6OmluYyh1bnNpZ25lZCBpbnQpvQIbbWF4aUJpdHM6OmRlYyh1bnNpZ25lZCBpbnQpvgIpbWF4aUJpdHM6OmFkZCh1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCm/AiltYXhpQml0czo6c3ViKHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KcACKW1heGlCaXRzOjptdWwodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQpwQIpbWF4aUJpdHM6OmRpdih1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCnCAihtYXhpQml0czo6Z3QodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQpwwIobWF4aUJpdHM6Omx0KHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KcQCKW1heGlCaXRzOjpndGUodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQpxQIpbWF4aUJpdHM6Omx0ZSh1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCnGAihtYXhpQml0czo6ZXEodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQpxwIRbWF4aUJpdHM6Om5vaXNlKCnIAiBtYXhpQml0czo6dG9TaWduYWwodW5zaWduZWQgaW50KckCJG1heGlCaXRzOjp0b1RyaWdTaWduYWwodW5zaWduZWQgaW50KcoCXWVtc2NyaXB0ZW46OmludGVybmFsOjpJbnZva2VyPHVuc2lnbmVkIGludCwgZG91YmxlPjo6aW52b2tlKHVuc2lnbmVkIGludCAoKikoZG91YmxlKSwgZG91YmxlKcsCHG1heGlCaXRzOjpmcm9tU2lnbmFsKGRvdWJsZSnMAkp2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpQ291bnRlcj4obWF4aUNvdW50ZXIqKc0CPm1heGlDb3VudGVyKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlDb3VudGVyPigpzgIibWF4aUNvdW50ZXI6OmNvdW50KGRvdWJsZSwgZG91YmxlKc8CRnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlJbmRleD4obWF4aUluZGV4KinQAjptYXhpSW5kZXgqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aUluZGV4Pigp0QJXbWF4aUluZGV4OjpwdWxsKGRvdWJsZSwgZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4p0gJMdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aVJhdGlvU2VxPihtYXhpUmF0aW9TZXEqKdMCQG1heGlSYXRpb1NlcSogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpUmF0aW9TZXE+KCnUAlZtYXhpUmF0aW9TZXE6OnBsYXlUcmlnKGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KdUCjgNlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlSYXRpb1NlcTo6KikoZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4pLCBkb3VibGUsIG1heGlSYXRpb1NlcSosIGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+ID46Omludm9rZShkb3VibGUgKG1heGlSYXRpb1NlcTo6KiBjb25zdCYpKGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KSwgbWF4aVJhdGlvU2VxKiwgZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4qKdYCkAFtYXhpUmF0aW9TZXE6OnBsYXlWYWx1ZXMoZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4sIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPinXAu8EZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpUmF0aW9TZXE6OiopKGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+LCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4pLCBkb3VibGUsIG1heGlSYXRpb1NlcSosIGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+LCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4gPjo6aW52b2tlKGRvdWJsZSAobWF4aVJhdGlvU2VxOjoqIGNvbnN0JikoZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4sIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiksIG1heGlSYXRpb1NlcSosIGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+Kiwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KinYAk5FbXNjcmlwdGVuQmluZGluZ0luaXRpYWxpemVyX21heGlWZXJiOjpFbXNjcmlwdGVuQmluZGluZ0luaXRpYWxpemVyX21heGlWZXJiKCnZAk52b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpU2F0UmV2ZXJiPihtYXhpU2F0UmV2ZXJiKinaAkh2b2lkIGVtc2NyaXB0ZW46OmludGVybmFsOjpyYXdfZGVzdHJ1Y3RvcjxtYXhpU2F0UmV2ZXJiPihtYXhpU2F0UmV2ZXJiKinbAkJtYXhpU2F0UmV2ZXJiKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlTYXRSZXZlcmI+KCncAkx2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpRnJlZVZlcmI+KG1heGlGcmVlVmVyYiop3QJAbWF4aUZyZWVWZXJiKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlGcmVlVmVyYj4oKd4CK3N0ZDo6X18yOjpfX3Rocm93X2xlbmd0aF9lcnJvcihjaGFyIGNvbnN0KinfAmR2b2lkIHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPjo6X19wdXNoX2JhY2tfc2xvd19wYXRoPGludCBjb25zdCY+KGludCBjb25zdCYp4AJVc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+OjpfX2FwcGVuZCh1bnNpZ25lZCBsb25nLCBpbnQgY29uc3QmKeECcHZvaWQgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+OjpfX3B1c2hfYmFja19zbG93X3BhdGg8ZG91YmxlIGNvbnN0Jj4oZG91YmxlIGNvbnN0JiniAlhzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6X19hcHBlbmQodW5zaWduZWQgbG9uZywgY2hhciBjb25zdCYp4wJvc3RkOjpfXzI6OnZlY3RvcjxtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPG1heGlLdXJhbW90b09zY2lsbGF0b3I+ID46Ol9fYXBwZW5kKHVuc2lnbmVkIGxvbmcp5AJPc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+OjpfX2FwcGVuZCh1bnNpZ25lZCBsb25nKeUCE21heGlGRlQ6On5tYXhpRkZUKCnmAjNtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+Ojp+bWF4aVRpbWVTdHJldGNoKCnnAoAEc3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+OjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4sIGVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6dmFsX2RlbGV0ZXI+KG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qLCBlbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46OnZhbF9kZWxldGVyLCBzdGQ6Ol9fMjo6ZW5hYmxlX2lmPGlzX2NvbnZlcnRpYmxlPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qLCBtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+Kj46OnZhbHVlLCBzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID46Ol9fbmF0Pjo6dHlwZSnoAnplbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46OnZhbF9kZWxldGVyOjpvcGVyYXRvcigpKHZvaWQgY29uc3QqKekC9AFzdGQ6Ol9fMjo6X19zaGFyZWRfcHRyX3BvaW50ZXI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6dmFsX2RlbGV0ZXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46On5fX3NoYXJlZF9wdHJfcG9pbnRlcigp6gL2AXN0ZDo6X18yOjpfX3NoYXJlZF9wdHJfcG9pbnRlcjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KiwgZW1zY3JpcHRlbjo6c21hcnRfcHRyX3RyYWl0PHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp2YWxfZGVsZXRlciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6fl9fc2hhcmVkX3B0cl9wb2ludGVyKCkuMesC7wFzdGQ6Ol9fMjo6X19zaGFyZWRfcHRyX3BvaW50ZXI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6dmFsX2RlbGV0ZXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46Ol9fb25femVyb19zaGFyZWQoKewChwJzdGQ6Ol9fMjo6X19zaGFyZWRfcHRyX3BvaW50ZXI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6dmFsX2RlbGV0ZXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46Ol9fZ2V0X2RlbGV0ZXIoc3RkOjp0eXBlX2luZm8gY29uc3QmKSBjb25zdO0C9AFzdGQ6Ol9fMjo6X19zaGFyZWRfcHRyX3BvaW50ZXI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6dmFsX2RlbGV0ZXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46Ol9fb25femVyb19zaGFyZWRfd2Vhaygp7gKQAXN0ZDo6X18yOjpfX3NoYXJlZF9wdHJfZW1wbGFjZTxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp+X19zaGFyZWRfcHRyX2VtcGxhY2UoKe8CkgFzdGQ6Ol9fMjo6X19zaGFyZWRfcHRyX2VtcGxhY2U8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6fl9fc2hhcmVkX3B0cl9lbXBsYWNlKCkuMfACiwFzdGQ6Ol9fMjo6X19zaGFyZWRfcHRyX2VtcGxhY2U8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6X19vbl96ZXJvX3NoYXJlZCgp8QIhbWF4aUdyYWluPGhhbm5XaW5GdW5jdG9yPjo6cGxheSgp8gIxbWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+Ojp+bWF4aVBpdGNoU2hpZnQoKfMC+ANzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPjo6c2hhcmVkX3B0cjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4sIGVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp2YWxfZGVsZXRlcj4obWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+KiwgZW1zY3JpcHRlbjo6c21hcnRfcHRyX3RyYWl0PHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+ID46OnZhbF9kZWxldGVyLCBzdGQ6Ol9fMjo6ZW5hYmxlX2lmPGlzX2NvbnZlcnRpYmxlPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiosIG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPio+Ojp2YWx1ZSwgc3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID46Ol9fbmF0Pjo6dHlwZSn0AvEBc3RkOjpfXzI6Ol9fc2hhcmVkX3B0cl9wb2ludGVyPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiosIGVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp2YWxfZGVsZXRlciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp+X19zaGFyZWRfcHRyX3BvaW50ZXIoKfUC8wFzdGQ6Ol9fMjo6X19zaGFyZWRfcHRyX3BvaW50ZXI8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+KiwgZW1zY3JpcHRlbjo6c21hcnRfcHRyX3RyYWl0PHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+ID46OnZhbF9kZWxldGVyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+ID46On5fX3NoYXJlZF9wdHJfcG9pbnRlcigpLjH2AoQCc3RkOjpfXzI6Ol9fc2hhcmVkX3B0cl9wb2ludGVyPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiosIGVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp2YWxfZGVsZXRlciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPiA+OjpfX2dldF9kZWxldGVyKHN0ZDo6dHlwZV9pbmZvIGNvbnN0JikgY29uc3T3Ao4Bc3RkOjpfXzI6Ol9fc2hhcmVkX3B0cl9lbXBsYWNlPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp+X19zaGFyZWRfcHRyX2VtcGxhY2UoKfgCkAFzdGQ6Ol9fMjo6X19zaGFyZWRfcHRyX2VtcGxhY2U8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+ID46On5fX3NoYXJlZF9wdHJfZW1wbGFjZSgpLjH5AokBc3RkOjpfXzI6Ol9fc2hhcmVkX3B0cl9lbXBsYWNlPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPiA+OjpfX29uX3plcm9fc2hhcmVkKCn6AiRfR0xPQkFMX19zdWJfSV9tYXhpbWlsaWFuLmVtYmluZC5jcHD7AhBtYXhpT3NjOjpub2lzZSgp/AIZbWF4aU9zYzo6c2luZXdhdmUoZG91YmxlKf0CGW1heGlPc2M6OnNpbmVidWY0KGRvdWJsZSn+AhhtYXhpT3NjOjpzaW5lYnVmKGRvdWJsZSn/AhhtYXhpT3NjOjpjb3N3YXZlKGRvdWJsZSmAAxdtYXhpT3NjOjpwaGFzb3IoZG91YmxlKYEDF21heGlPc2M6OnNxdWFyZShkb3VibGUpggMebWF4aU9zYzo6cHVsc2UoZG91YmxlLCBkb3VibGUpgwMYbWF4aU9zYzo6aW1wdWxzZShkb3VibGUphAMnbWF4aU9zYzo6cGhhc29yKGRvdWJsZSwgZG91YmxlLCBkb3VibGUphQMUbWF4aU9zYzo6c2F3KGRvdWJsZSmGAxVtYXhpT3NjOjpzYXduKGRvdWJsZSmHAxltYXhpT3NjOjp0cmlhbmdsZShkb3VibGUpiANQbWF4aUVudmVsb3BlOjpsaW5lKGludCwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JimJAyJtYXhpRW52ZWxvcGU6OnRyaWdnZXIoaW50LCBkb3VibGUpigMebWF4aURlbGF5bGluZTo6bWF4aURlbGF5bGluZSgpiwMmbWF4aURlbGF5bGluZTo6ZGwoZG91YmxlLCBpbnQsIGRvdWJsZSmMAyttYXhpRGVsYXlsaW5lOjpkbChkb3VibGUsIGludCwgZG91YmxlLCBpbnQpjQMibWF4aUZpbHRlcjo6bG9wYXNzKGRvdWJsZSwgZG91YmxlKY4DIm1heGlGaWx0ZXI6OmhpcGFzcyhkb3VibGUsIGRvdWJsZSmPAyltYXhpRmlsdGVyOjpsb3Jlcyhkb3VibGUsIGRvdWJsZSwgZG91YmxlKZADKW1heGlGaWx0ZXI6OmhpcmVzKGRvdWJsZSwgZG91YmxlLCBkb3VibGUpkQMsbWF4aUZpbHRlcjo6YmFuZHBhc3MoZG91YmxlLCBkb3VibGUsIGRvdWJsZSmSA1htYXhpTWl4OjpzdGVyZW8oZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBkb3VibGUpkwNebWF4aU1peDo6cXVhZChkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGRvdWJsZSwgZG91YmxlKZQDa21heGlNaXg6OmFtYmlzb25pYyhkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUplQNsbWF4aVNhbXBsZTo6bG9hZChzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+LCBpbnQplgMSbWF4aVNhbXBsZTo6cmVhZCgplwNnc3RkOjpfXzI6OmJhc2ljX2lmc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpiYXNpY19pZnN0cmVhbShjaGFyIGNvbnN0KiwgdW5zaWduZWQgaW50KZgD3QFzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYgc3RkOjpfXzI6Ol9fcHV0X2NoYXJhY3Rlcl9zZXF1ZW5jZTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPihzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBsb25nKZkDTXN0ZDo6X18yOjp2ZWN0b3I8c2hvcnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8c2hvcnQ+ID46Ol9fYXBwZW5kKHVuc2lnbmVkIGxvbmcpmgNNc3RkOjpfXzI6OmJhc2ljX2ZpbGVidWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19maWxlYnVmKCmbA2xtYXhpU2FtcGxlOjpzZXRTYW1wbGVGcm9tT2dnQmxvYihzdGQ6Ol9fMjo6dmVjdG9yPHVuc2lnbmVkIGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8dW5zaWduZWQgY2hhcj4gPiYsIGludCmcA0xzdGQ6Ol9fMjo6YmFzaWNfZmlsZWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6YmFzaWNfZmlsZWJ1ZigpnQNcc3RkOjpfXzI6OmJhc2ljX2ZpbGVidWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46Om9wZW4oY2hhciBjb25zdCosIHVuc2lnbmVkIGludCmeA09zdGQ6Ol9fMjo6YmFzaWNfaWZzdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19pZnN0cmVhbSgpnwMVbWF4aVNhbXBsZTo6aXNSZWFkeSgpoANObWF4aVNhbXBsZTo6c2V0U2FtcGxlKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYpoQP2AXN0ZDo6X18yOjplbmFibGVfaWY8KF9faXNfZm9yd2FyZF9pdGVyYXRvcjxkb3VibGUqPjo6dmFsdWUpICYmIChpc19jb25zdHJ1Y3RpYmxlPGRvdWJsZSwgc3RkOjpfXzI6Oml0ZXJhdG9yX3RyYWl0czxkb3VibGUqPjo6cmVmZXJlbmNlPjo6dmFsdWUpLCB2b2lkPjo6dHlwZSBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID46OmFzc2lnbjxkb3VibGUqPihkb3VibGUqLCBkb3VibGUqKaIDU21heGlTYW1wbGU6OnNldFNhbXBsZShzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBpbnQpowMVbWF4aVNhbXBsZTo6dHJpZ2dlcigppAMSbWF4aVNhbXBsZTo6cGxheSgppQMobWF4aVNhbXBsZTo6cGxheShkb3VibGUsIGRvdWJsZSwgZG91YmxlKaYDMW1heGlTYW1wbGU6OnBsYXkoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlJimnAyltYXhpU2FtcGxlOjpwbGF5NChkb3VibGUsIGRvdWJsZSwgZG91YmxlKagDFm1heGlTYW1wbGU6OnBsYXlPbmNlKCmpAxxtYXhpU2FtcGxlOjpwbGF5T25aWChkb3VibGUpqgMkbWF4aVNhbXBsZTo6cGxheU9uWlgoZG91YmxlLCBkb3VibGUpqwMcbWF4aVNhbXBsZTo6cGxheU9uY2UoZG91YmxlKawDLG1heGlTYW1wbGU6OnBsYXlPblpYKGRvdWJsZSwgZG91YmxlLCBkb3VibGUprQMqbWF4aVNhbXBsZTo6bG9vcFNldFBvc09uWlgoZG91YmxlLCBkb3VibGUprgMYbWF4aVNhbXBsZTo6cGxheShkb3VibGUprwMdbWF4aVNhbXBsZTo6bm9ybWFsaXNlKGRvdWJsZSmwAy5tYXhpU2FtcGxlOjphdXRvVHJpbShmbG9hdCwgZmxvYXQsIGJvb2wsIGJvb2wpsQMzbWF4aUR5bjo6Z2F0ZShkb3VibGUsIGRvdWJsZSwgbG9uZywgZG91YmxlLCBkb3VibGUpsgM7bWF4aUR5bjo6Y29tcHJlc3Nvcihkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSmzAxltYXhpRHluOjpjb21wcmVzcyhkb3VibGUptAMabWF4aUR5bjo6c2V0QXR0YWNrKGRvdWJsZSm1AxttYXhpRHluOjpzZXRSZWxlYXNlKGRvdWJsZSm2Ax1tYXhpRHluOjpzZXRUaHJlc2hvbGQoZG91YmxlKbcDLm1heGlFbnY6OmFyKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGxvbmcsIGludCm4A0BtYXhpRW52OjphZHNyKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBsb25nLCBpbnQpuQMabWF4aUVudjo6YWRzcihkb3VibGUsIGludCm6AxptYXhpRW52OjpzZXRBdHRhY2soZG91YmxlKbsDG21heGlFbnY6OnNldFN1c3RhaW4oZG91YmxlKbwDGW1heGlFbnY6OnNldERlY2F5KGRvdWJsZSm9AxJjb252ZXJ0OjptdG9mKGludCm+A2B2aXJ0dWFsIHRodW5rIHRvIHN0ZDo6X18yOjpiYXNpY19pZnN0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX2lmc3RyZWFtKCm/A1FzdGQ6Ol9fMjo6YmFzaWNfaWZzdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19pZnN0cmVhbSgpLjHAA2J2aXJ0dWFsIHRodW5rIHRvIHN0ZDo6X18yOjpiYXNpY19pZnN0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX2lmc3RyZWFtKCkuMcEDQ3N0ZDo6X18yOjpiYXNpY19maWxlYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpzeW5jKCnCA09zdGQ6Ol9fMjo6YmFzaWNfZmlsZWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX2ZpbGVidWYoKS4xwwNbc3RkOjpfXzI6OmJhc2ljX2ZpbGVidWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OmltYnVlKHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKcQDUHN0ZDo6X18yOjpiYXNpY19maWxlYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpzZXRidWYoY2hhciosIGxvbmcpxQN6c3RkOjpfXzI6OmJhc2ljX2ZpbGVidWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnNlZWtvZmYobG9uZyBsb25nLCBzdGQ6Ol9fMjo6aW9zX2Jhc2U6OnNlZWtkaXIsIHVuc2lnbmVkIGludCnGAxxzdGQ6Ol9fMjo6X190aHJvd19iYWRfY2FzdCgpxwNvc3RkOjpfXzI6OmJhc2ljX2ZpbGVidWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnNlZWtwb3Moc3RkOjpfXzI6OmZwb3M8X19tYnN0YXRlX3Q+LCB1bnNpZ25lZCBpbnQpyANIc3RkOjpfXzI6OmJhc2ljX2ZpbGVidWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnVuZGVyZmxvdygpyQNLc3RkOjpfXzI6OmJhc2ljX2ZpbGVidWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnBiYWNrZmFpbChpbnQpygNKc3RkOjpfXzI6OmJhc2ljX2ZpbGVidWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46Om92ZXJmbG93KGludCnLA4UCc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gc3RkOjpfXzI6Ol9fcGFkX2FuZF9vdXRwdXQ8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4oc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHN0ZDo6X18yOjppb3NfYmFzZSYsIGNoYXIpzAMbbWF4aUNsb2NrOjpzZXRUZW1wbyhkb3VibGUpzQMTbWF4aUNsb2NrOjp0aWNrZXIoKc4DH21heGlDbG9jazo6c2V0VGlja3NQZXJCZWF0KGludCnPAx1tYXhpRkZUOjpzZXR1cChpbnQsIGludCwgaW50KdADKm1heGlGRlQ6OnByb2Nlc3MoZmxvYXQsIG1heGlGRlQ6OmZmdE1vZGVzKdEDE21heGlGRlQ6Om1hZ3NUb0RCKCnSAxttYXhpRkZUOjpzcGVjdHJhbEZsYXRuZXNzKCnTAxttYXhpRkZUOjpzcGVjdHJhbENlbnRyb2lkKCnUAx5tYXhpSUZGVDo6c2V0dXAoaW50LCBpbnQsIGludCnVA5MBbWF4aUlGRlQ6OnByb2Nlc3Moc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiYsIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mLCBtYXhpSUZGVDo6ZmZ0TW9kZXMp1gMuRkZUKGludCwgYm9vbCwgZmxvYXQqLCBmbG9hdCosIGZsb2F0KiwgZmxvYXQqKdcDJFJlYWxGRlQoaW50LCBmbG9hdCosIGZsb2F0KiwgZmxvYXQqKdgDIGZmdDo6Z2VuV2luZG93KGludCwgaW50LCBmbG9hdCop2QMPZmZ0OjpzZXR1cChpbnQp2gMLZmZ0Ojp+ZmZ0KCnbAyFmZnQ6OmNhbGNGRlQoaW50LCBmbG9hdCosIGZsb2F0KincAzdmZnQ6OnBvd2VyU3BlY3RydW0oaW50LCBmbG9hdCosIGZsb2F0KiwgZmxvYXQqLCBmbG9hdCop3QMdZmZ0Ojpjb252VG9EQihmbG9hdCosIGZsb2F0KineAztmZnQ6OmludmVyc2VGRlRDb21wbGV4KGludCwgZmxvYXQqLCBmbG9hdCosIGZsb2F0KiwgZmxvYXQqKd8DPmZmdDo6aW52ZXJzZVBvd2VyU3BlY3RydW0oaW50LCBmbG9hdCosIGZsb2F0KiwgZmxvYXQqLCBmbG9hdCop4AM3bWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+OjptZWxGaWx0ZXJBbmRMb2dTcXVhcmUoZmxvYXQqKeEDJm1heGlSZXZlcmJGaWx0ZXJzOjptYXhpUmV2ZXJiRmlsdGVycygp4gMgbWF4aVJldmVyYkJhc2U6Om1heGlSZXZlcmJCYXNlKCnjAx5tYXhpU2F0UmV2ZXJiOjptYXhpU2F0UmV2ZXJiKCnkAxttYXhpU2F0UmV2ZXJiOjpwbGF5KGRvdWJsZSnlAxxtYXhpRnJlZVZlcmI6Om1heGlGcmVlVmVyYigp5gMqbWF4aUZyZWVWZXJiOjpwbGF5KGRvdWJsZSwgZG91YmxlLCBkb3VibGUp5wMncG9pbnRfY29tcGFyZSh2b2lkIGNvbnN0Kiwgdm9pZCBjb25zdCop6AMadm9yYmlzX2RlaW5pdChzdGJfdm9yYmlzKinpAylpc193aG9sZV9wYWNrZXRfcHJlc2VudChzdGJfdm9yYmlzKiwgaW50KeoDM3ZvcmJpc19kZWNvZGVfcGFja2V0KHN0Yl92b3JiaXMqLCBpbnQqLCBpbnQqLCBpbnQqKesDF3N0YXJ0X3BhZ2Uoc3RiX3ZvcmJpcyop7AMvdm9yYmlzX2ZpbmlzaF9mcmFtZShzdGJfdm9yYmlzKiwgaW50LCBpbnQsIGludCntA0B2b3JiaXNfZGVjb2RlX2luaXRpYWwoc3RiX3ZvcmJpcyosIGludCosIGludCosIGludCosIGludCosIGludCop7gMaZ2V0X2JpdHMoc3RiX3ZvcmJpcyosIGludCnvAzJjb2RlYm9va19kZWNvZGVfc2NhbGFyX3JhdyhzdGJfdm9yYmlzKiwgQ29kZWJvb2sqKfADQ2RlY29kZV9yZXNpZHVlKHN0Yl92b3JiaXMqLCBmbG9hdCoqLCBpbnQsIGludCwgaW50LCB1bnNpZ25lZCBjaGFyKinxAytpbnZlcnNlX21kY3QoZmxvYXQqLCBpbnQsIHN0Yl92b3JiaXMqLCBpbnQp8gMZZmx1c2hfcGFja2V0KHN0Yl92b3JiaXMqKfMDGnN0YXJ0X2RlY29kZXIoc3RiX3ZvcmJpcyop9AModWludDMyX2NvbXBhcmUodm9pZCBjb25zdCosIHZvaWQgY29uc3QqKfUDJWluaXRfYmxvY2tzaXplKHN0Yl92b3JiaXMqLCBpbnQsIGludCn2AxZzdGJfdm9yYmlzX29wZW5fbWVtb3J59wMac3RiX3ZvcmJpc19nZXRfZnJhbWVfc2hvcnT4A0Bjb252ZXJ0X3NhbXBsZXNfc2hvcnQoaW50LCBzaG9ydCoqLCBpbnQsIGludCwgZmxvYXQqKiwgaW50LCBpbnQp+QMmc3RiX3ZvcmJpc19nZXRfZnJhbWVfc2hvcnRfaW50ZXJsZWF2ZWT6A0djb252ZXJ0X2NoYW5uZWxzX3Nob3J0X2ludGVybGVhdmVkKGludCwgc2hvcnQqLCBpbnQsIGZsb2F0KiosIGludCwgaW50KfsDGHN0Yl92b3JiaXNfZGVjb2RlX21lbW9yefwDH21heWJlX3N0YXJ0X3BhY2tldChzdGJfdm9yYmlzKin9AylzdGFydF9wYWdlX25vX2NhcHR1cmVwYXR0ZXJuKHN0Yl92b3JiaXMqKf4DMmNvZGVib29rX2RlY29kZV9zdGFydChzdGJfdm9yYmlzKiwgQ29kZWJvb2sqLCBpbnQp/wNfY29kZWJvb2tfZGVjb2RlX2RlaW50ZXJsZWF2ZV9yZXBlYXQoc3RiX3ZvcmJpcyosIENvZGVib29rKiwgZmxvYXQqKiwgaW50LCBpbnQqLCBpbnQqLCBpbnQsIGludCmABDVpbWRjdF9zdGVwM19pdGVyMF9sb29wKGludCwgZmxvYXQqLCBpbnQsIGludCwgZmxvYXQqKYEEPGltZGN0X3N0ZXAzX2lubmVyX3JfbG9vcChpbnQsIGZsb2F0KiwgaW50LCBpbnQsIGZsb2F0KiwgaW50KYIEB3NjYWxibmaDBAZsZGV4cGaEBAZtZW1jbXCFBAVxc29ydIYEBHNpZnSHBANzaHKIBAd0cmlua2xliQQDc2hsigQEcG50eosEBWN5Y2xljAQHYV9jdHpfbI0EDF9fc3RkaW9fc2Vla44ECl9fbG9ja2ZpbGWPBAxfX3VubG9ja2ZpbGWQBAlfX2Z3cml0ZXiRBAZmd3JpdGWSBAdpcHJpbnRmkwQQX19lcnJub19sb2NhdGlvbpQEB3djcnRvbWKVBAZ3Y3RvbWKWBAZtZW1jaHKXBAVmcmV4cJgEE19fdmZwcmludGZfaW50ZXJuYWyZBAtwcmludGZfY29yZZoEA291dJsEBmdldGludJwEB3BvcF9hcmedBANwYWSeBAVmbXRfb58EBWZtdF94oAQFZm10X3WhBAh2ZnByaW50ZqIEBmZtdF9mcKMEE3BvcF9hcmdfbG9uZ19kb3VibGWkBAl2ZmlwcmludGalBApfX29mbF9sb2NrpgQJX190b3dyaXRlpwQIZmlwcmludGaoBAVmcHV0Y6kEEV9fZnRlbGxvX3VubG9ja2VkqgQIX19mdGVsbG+rBAVmdGVsbKwECF9fdG9yZWFkrQQFZnJlYWSuBBFfX2ZzZWVrb191bmxvY2tlZK8ECF9fZnNlZWtvsAQFZnNlZWuxBA1fX3N0ZGlvX2Nsb3NlsgQFZmdldGOzBAZzdHJsZW60BAtfX3N0cmNocm51bLUEBnN0cmNocrYEDF9fZm1vZGVmbGFnc7cEBWZvcGVuuAQJdnNucHJpbnRmuQQIc25fd3JpdGW6BAZmY2xvc2W7BBlfX2Vtc2NyaXB0ZW5fc3Rkb3V0X2Nsb3NlvAQYX19lbXNjcmlwdGVuX3N0ZG91dF9zZWVrvQQMX19zdGRpb19yZWFkvgQIX19mZG9wZW6/BA1fX3N0ZGlvX3dyaXRlwAQKX19vdmVyZmxvd8EEBmZmbHVzaMIEEV9fZmZsdXNoX3VubG9ja2VkwwQHX191Zmxvd8QECV9fb2ZsX2FkZMUECV9fbHNocnRpM8YECV9fYXNobHRpM8cEDF9fdHJ1bmN0ZmRmMsgEBV9fY29zyQQQX19yZW1fcGlvMl9sYXJnZcoECl9fcmVtX3BpbzLLBAVfX3NpbswEA2Nvc80EB19fY29zZGbOBAdfX3NpbmRmzwQLX19yZW1fcGlvMmbQBARjb3Nm0QQDc2lu0gQEc2luZtMEBV9fdGFu1AQDdGFu1QQFYXRhbmbWBAZhdGFuMmbXBARleHBm2AQDbG9n2QQEbG9nZtoEA3Bvd9sEB3dtZW1jcHncBBlzdGQ6OnVuY2F1Z2h0X2V4Y2VwdGlvbigp3QRFc3RkOjpfXzI6OmJhc2ljX2lvczxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX2lvcygp3gQfc3RkOjpfXzI6Omlvc19iYXNlOjp+aW9zX2Jhc2UoKd8EP3N0ZDo6X18yOjppb3NfYmFzZTo6X19jYWxsX2NhbGxiYWNrcyhzdGQ6Ol9fMjo6aW9zX2Jhc2U6OmV2ZW50KeAER3N0ZDo6X18yOjpiYXNpY19pb3M8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19pb3MoKS4x4QRRc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX3N0cmVhbWJ1Zigp4gRTc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX3N0cmVhbWJ1ZigpLjHjBFBzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpiYXNpY19zdHJlYW1idWYoKeQEXXN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OmltYnVlKHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKeUEUnN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnNldGJ1ZihjaGFyKiwgbG9uZynmBHxzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpzZWVrb2ZmKGxvbmcgbG9uZywgc3RkOjpfXzI6Omlvc19iYXNlOjpzZWVrZGlyLCB1bnNpZ25lZCBpbnQp5wRxc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6c2Vla3BvcyhzdGQ6Ol9fMjo6ZnBvczxfX21ic3RhdGVfdD4sIHVuc2lnbmVkIGludCnoBFJzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp4c2dldG4oY2hhciosIGxvbmcp6QREc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+Ojpjb3B5KGNoYXIqLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgbG9uZynqBEpzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp1bmRlcmZsb3coKesERnN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnVmbG93KCnsBE1zdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpwYmFja2ZhaWwoaW50Ke0EWHN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnhzcHV0bihjaGFyIGNvbnN0KiwgbG9uZynuBFdzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Ojp+YmFzaWNfc3RyZWFtYnVmKCnvBFlzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Ojp+YmFzaWNfc3RyZWFtYnVmKCkuMfAEVnN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46OmJhc2ljX3N0cmVhbWJ1Zigp8QRbc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1Zjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6eHNnZXRuKHdjaGFyX3QqLCBsb25nKfIETXN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Pjo6Y29weSh3Y2hhcl90Kiwgd2NoYXJfdCBjb25zdCosIHVuc2lnbmVkIGxvbmcp8wRMc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1Zjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6dWZsb3coKfQEYXN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46OnhzcHV0bih3Y2hhcl90IGNvbnN0KiwgbG9uZyn1BE9zdGQ6Ol9fMjo6YmFzaWNfaXN0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX2lzdHJlYW0oKS4x9gRedmlydHVhbCB0aHVuayB0byBzdGQ6Ol9fMjo6YmFzaWNfaXN0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX2lzdHJlYW0oKfcET3N0ZDo6X18yOjpiYXNpY19pc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfaXN0cmVhbSgpLjL4BGB2aXJ0dWFsIHRodW5rIHRvIHN0ZDo6X18yOjpiYXNpY19pc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfaXN0cmVhbSgpLjH5BI8Bc3RkOjpfXzI6OmJhc2ljX2lzdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnNlbnRyeTo6c2VudHJ5KHN0ZDo6X18yOjpiYXNpY19pc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+JiwgYm9vbCn6BERzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6Zmx1c2goKfsEYXN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYgc3RkOjpfXzI6OnVzZV9mYWNldDxzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gPihzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0Jin8BNEBYm9vbCBzdGQ6Ol9fMjo6b3BlcmF0b3IhPTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiBjb25zdCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+IGNvbnN0Jin9BFRzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6b3BlcmF0b3IqKCkgY29uc3T+BE9zdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6b3BlcmF0b3IrKygp/wTRAWJvb2wgc3RkOjpfXzI6Om9wZXJhdG9yPT08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gY29uc3QmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiBjb25zdCYpgAWJAXN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpzZW50cnk6OnNlbnRyeShzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYpgQVOc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnNlbnRyeTo6fnNlbnRyeSgpggWYAXN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjplcXVhbChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiBjb25zdCYpIGNvbnN0gwVHc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6c2J1bXBjKCmEBUpzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpzcHV0YyhjaGFyKYUFTnN0ZDo6X18yOjpiYXNpY19pc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpyZWFkKGNoYXIqLCBsb25nKYYFanN0ZDo6X18yOjpiYXNpY19pc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpzZWVrZyhsb25nIGxvbmcsIHN0ZDo6X18yOjppb3NfYmFzZTo6c2Vla2RpcimHBUpzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6Zmx1c2goKYgFZ3N0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYgc3RkOjpfXzI6OnVzZV9mYWNldDxzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gPihzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JimJBeMBYm9vbCBzdGQ6Ol9fMjo6b3BlcmF0b3IhPTx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiBjb25zdCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+IGNvbnN0JimKBVVzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6b3BlcmF0b3IrKygpiwXjAWJvb2wgc3RkOjpfXzI6Om9wZXJhdG9yPT08d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gY29uc3QmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiBjb25zdCYpjAWVAXN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+OjpzZW50cnk6OnNlbnRyeShzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYpjQWkAXN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+OjplcXVhbChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiBjb25zdCYpIGNvbnN0jgVNc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1Zjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6c2J1bXBjKCmPBVNzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+OjpzcHV0Yyh3Y2hhcl90KZAFT3N0ZDo6X18yOjpiYXNpY19vc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfb3N0cmVhbSgpLjGRBV52aXJ0dWFsIHRodW5rIHRvIHN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfb3N0cmVhbSgpkgVPc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19vc3RyZWFtKCkuMpMFYHZpcnR1YWwgdGh1bmsgdG8gc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19vc3RyZWFtKCkuMZQF7QFzdGQ6Ol9fMjo6bnVtX3B1dDxjaGFyLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+IGNvbnN0JiBzdGQ6Ol9fMjo6dXNlX2ZhY2V0PHN0ZDo6X18yOjpudW1fcHV0PGNoYXIsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID4gPihzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JimVBUVzdGQ6Ol9fMjo6YmFzaWNfaW9zPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpmaWxsKCkgY29uc3SWBUpzdGQ6Ol9fMjo6YmFzaWNfaW9zPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp3aWRlbihjaGFyKSBjb25zdJcFTnN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpvcGVyYXRvcjw8KHNob3J0KZgFTHN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpvcGVyYXRvcjw8KGludCmZBVZzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6b3BlcmF0b3I8PCh1bnNpZ25lZCBsb25nKZoFUnN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpvcGVyYXRvcj0oY2hhcimbBUZzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6cHV0KGNoYXIpnAVbc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46Om9wZXJhdG9yPSh3Y2hhcl90KZ0FcHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OmJhc2ljX3N0cmluZyhjaGFyIGNvbnN0KimeBSFzdGQ6Ol9fMjo6aW9zX2Jhc2U6On5pb3NfYmFzZSgpLjGfBR9zdGQ6Ol9fMjo6aW9zX2Jhc2U6OmluaXQodm9pZCopoAW1AXN0ZDo6X18yOjplbmFibGVfaWY8KGlzX21vdmVfY29uc3RydWN0aWJsZTx1bnNpZ25lZCBpbnQ+Ojp2YWx1ZSkgJiYgKGlzX21vdmVfYXNzaWduYWJsZTx1bnNpZ25lZCBpbnQ+Ojp2YWx1ZSksIHZvaWQ+Ojp0eXBlIHN0ZDo6X18yOjpzd2FwPHVuc2lnbmVkIGludD4odW5zaWduZWQgaW50JiwgdW5zaWduZWQgaW50JimhBVlzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6X190ZXN0X2Zvcl9lb2YoKSBjb25zdKIFX3N0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+OjpfX3Rlc3RfZm9yX2VvZigpIGNvbnN0owUGdW5nZXRjpAUgc3RkOjpfXzI6Omlvc19iYXNlOjpJbml0OjpJbml0KCmlBRdfX2N4eF9nbG9iYWxfYXJyYXlfZHRvcqYFP3N0ZDo6X18yOjpfX3N0ZGluYnVmPGNoYXI+OjpfX3N0ZGluYnVmKF9JT19GSUxFKiwgX19tYnN0YXRlX3QqKacFigFzdGQ6Ol9fMjo6YmFzaWNfaXN0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6YmFzaWNfaXN0cmVhbShzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+KimoBUJzdGQ6Ol9fMjo6X19zdGRpbmJ1Zjx3Y2hhcl90Pjo6X19zdGRpbmJ1ZihfSU9fRklMRSosIF9fbWJzdGF0ZV90KimpBZYBc3RkOjpfXzI6OmJhc2ljX2lzdHJlYW08d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46OmJhc2ljX2lzdHJlYW0oc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1Zjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiopqgVBc3RkOjpfXzI6Ol9fc3Rkb3V0YnVmPGNoYXI+OjpfX3N0ZG91dGJ1ZihfSU9fRklMRSosIF9fbWJzdGF0ZV90KimrBYoBc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OmJhc2ljX29zdHJlYW0oc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPioprAVEc3RkOjpfXzI6Ol9fc3Rkb3V0YnVmPHdjaGFyX3Q+OjpfX3N0ZG91dGJ1ZihfSU9fRklMRSosIF9fbWJzdGF0ZV90KimtBZYBc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46OmJhc2ljX29zdHJlYW0oc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1Zjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPioprgV9c3RkOjpfXzI6OmJhc2ljX2lvczxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6aW5pdChzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+KimvBYsBc3RkOjpfXzI6OmNvZGVjdnQ8Y2hhciwgY2hhciwgX19tYnN0YXRlX3Q+IGNvbnN0JiBzdGQ6Ol9fMjo6dXNlX2ZhY2V0PHN0ZDo6X18yOjpjb2RlY3Z0PGNoYXIsIGNoYXIsIF9fbWJzdGF0ZV90PiA+KHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKbAFkQFzdGQ6Ol9fMjo6Y29kZWN2dDx3Y2hhcl90LCBjaGFyLCBfX21ic3RhdGVfdD4gY29uc3QmIHN0ZDo6X18yOjp1c2VfZmFjZXQ8c3RkOjpfXzI6OmNvZGVjdnQ8d2NoYXJfdCwgY2hhciwgX19tYnN0YXRlX3Q+ID4oc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYpsQUpc3RkOjpfXzI6Ol9fc3RkaW5idWY8Y2hhcj46On5fX3N0ZGluYnVmKCmyBTpzdGQ6Ol9fMjo6X19zdGRpbmJ1ZjxjaGFyPjo6aW1idWUoc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYpswUnc3RkOjpfXzI6Ol9fc3RkaW5idWY8Y2hhcj46OnVuZGVyZmxvdygptAUrc3RkOjpfXzI6Ol9fc3RkaW5idWY8Y2hhcj46Ol9fZ2V0Y2hhcihib29sKbUFI3N0ZDo6X18yOjpfX3N0ZGluYnVmPGNoYXI+Ojp1ZmxvdygptgUqc3RkOjpfXzI6Ol9fc3RkaW5idWY8Y2hhcj46OnBiYWNrZmFpbChpbnQptwUsc3RkOjpfXzI6Ol9fc3RkaW5idWY8d2NoYXJfdD46On5fX3N0ZGluYnVmKCm4BT1zdGQ6Ol9fMjo6X19zdGRpbmJ1Zjx3Y2hhcl90Pjo6aW1idWUoc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYpuQUqc3RkOjpfXzI6Ol9fc3RkaW5idWY8d2NoYXJfdD46OnVuZGVyZmxvdygpugUuc3RkOjpfXzI6Ol9fc3RkaW5idWY8d2NoYXJfdD46Ol9fZ2V0Y2hhcihib29sKbsFJnN0ZDo6X18yOjpfX3N0ZGluYnVmPHdjaGFyX3Q+Ojp1ZmxvdygpvAU2c3RkOjpfXzI6Ol9fc3RkaW5idWY8d2NoYXJfdD46OnBiYWNrZmFpbCh1bnNpZ25lZCBpbnQpvQU7c3RkOjpfXzI6Ol9fc3Rkb3V0YnVmPGNoYXI+OjppbWJ1ZShzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0Jim+BSNzdGQ6Ol9fMjo6X19zdGRvdXRidWY8Y2hhcj46OnN5bmMoKb8FNnN0ZDo6X18yOjpfX3N0ZG91dGJ1ZjxjaGFyPjo6eHNwdXRuKGNoYXIgY29uc3QqLCBsb25nKcAFKnN0ZDo6X18yOjpfX3N0ZG91dGJ1ZjxjaGFyPjo6b3ZlcmZsb3coaW50KcEFPnN0ZDo6X18yOjpfX3N0ZG91dGJ1Zjx3Y2hhcl90Pjo6aW1idWUoc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYpwgU8c3RkOjpfXzI6Ol9fc3Rkb3V0YnVmPHdjaGFyX3Q+Ojp4c3B1dG4od2NoYXJfdCBjb25zdCosIGxvbmcpwwU2c3RkOjpfXzI6Ol9fc3Rkb3V0YnVmPHdjaGFyX3Q+OjpvdmVyZmxvdyh1bnNpZ25lZCBpbnQpxAUHX19zaGxpbcUFCF9fc2hnZXRjxgUIX19tdWx0aTPHBQlfX2ludHNjYW7IBQdtYnJ0b3djyQUNX19leHRlbmRzZnRmMsoFCF9fbXVsdGYzywULX19mbG9hdHNpdGbMBQhfX2FkZHRmM80FDV9fZXh0ZW5kZGZ0ZjLOBQdfX2xldGYyzwUHX19nZXRmMtAFCWNvcHlzaWdubNEFDV9fZmxvYXR1bnNpdGbSBQhfX3N1YnRmM9MFB3NjYWxibmzUBQhfX2RpdnRmM9UFC19fZmxvYXRzY2Fu1gUIaGV4ZmxvYXTXBQhkZWNmbG9hdNgFB3NjYW5leHDZBQxfX3RydW5jdGZzZjLaBQd2ZnNjYW5m2wUFYXJnX27cBQlzdG9yZV9pbnTdBQ1fX3N0cmluZ19yZWFk3gUHdnNzY2FuZt8FB2RvX3JlYWTgBQZzdHJjbXDhBSBfX2Vtc2NyaXB0ZW5fZW52aXJvbl9jb25zdHJ1Y3RvcuIFB3N0cm5jbXDjBQZnZXRlbnbkBQhfX211bm1hcOUFDF9fZ2V0X2xvY2FsZeYFC19fbmV3bG9jYWxl5wUJdmFzcHJpbnRm6AUGc3NjYW5m6QUIc25wcmludGbqBQpmcmVlbG9jYWxl6wUGd2NzbGVu7AUJd2NzcnRvbWJz7QUKd2NzbnJ0b21ic+4FCW1ic3J0b3djc+8FCm1ic25ydG93Y3PwBQZzdHJ0b3jxBQpzdHJ0b3VsbF9s8gUJc3RydG9sbF9s8wUGc3RydG9m9AUIc3RydG94LjH1BQZzdHJ0b2T2BQdzdHJ0b2xk9wUJc3RydG9sZF9s+AVdc3RkOjpfXzI6OmNvbGxhdGU8Y2hhcj46OmRvX2NvbXBhcmUoY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdCopIGNvbnN0+QVFc3RkOjpfXzI6OmNvbGxhdGU8Y2hhcj46OmRvX3RyYW5zZm9ybShjaGFyIGNvbnN0KiwgY2hhciBjb25zdCopIGNvbnN0+gXPAXN0ZDo6X18yOjplbmFibGVfaWY8X19pc19mb3J3YXJkX2l0ZXJhdG9yPGNoYXIgY29uc3QqPjo6dmFsdWUsIHZvaWQ+Ojp0eXBlIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46Ol9faW5pdDxjaGFyIGNvbnN0Kj4oY2hhciBjb25zdCosIGNoYXIgY29uc3QqKfsFQHN0ZDo6X18yOjpjb2xsYXRlPGNoYXI+Ojpkb19oYXNoKGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KikgY29uc3T8BWxzdGQ6Ol9fMjo6Y29sbGF0ZTx3Y2hhcl90Pjo6ZG9fY29tcGFyZSh3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0KikgY29uc3T9BU5zdGQ6Ol9fMjo6Y29sbGF0ZTx3Y2hhcl90Pjo6ZG9fdHJhbnNmb3JtKHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0KikgY29uc3T+BeQBc3RkOjpfXzI6OmVuYWJsZV9pZjxfX2lzX2ZvcndhcmRfaXRlcmF0b3I8d2NoYXJfdCBjb25zdCo+Ojp2YWx1ZSwgdm9pZD46OnR5cGUgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6X19pbml0PHdjaGFyX3QgY29uc3QqPih3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdCop/wVJc3RkOjpfXzI6OmNvbGxhdGU8d2NoYXJfdD46OmRvX2hhc2god2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqKSBjb25zdIAGmgJzdGQ6Ol9fMjo6bnVtX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBib29sJikgY29uc3SBBmdzdGQ6Ol9fMjo6bnVtcHVuY3Q8Y2hhcj4gY29uc3QmIHN0ZDo6X18yOjp1c2VfZmFjZXQ8c3RkOjpfXzI6Om51bXB1bmN0PGNoYXI+ID4oc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYpggakBXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QqIHN0ZDo6X18yOjpfX3NjYW5fa2V5d29yZDxzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCosIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiA+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QqLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0Kiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JiwgdW5zaWduZWQgaW50JiwgYm9vbCmDBjhzdGQ6Ol9fMjo6bG9jYWxlOjp1c2VfZmFjZXQoc3RkOjpfXzI6OmxvY2FsZTo6aWQmKSBjb25zdIQGzAFzdGQ6Ol9fMjo6dW5pcXVlX3B0cjx1bnNpZ25lZCBjaGFyLCB2b2lkICgqKSh2b2lkKik+Ojp1bmlxdWVfcHRyPHRydWUsIHZvaWQ+KHVuc2lnbmVkIGNoYXIqLCBzdGQ6Ol9fMjo6X19kZXBlbmRlbnRfdHlwZTxzdGQ6Ol9fMjo6X191bmlxdWVfcHRyX2RlbGV0ZXJfc2ZpbmFlPHZvaWQgKCopKHZvaWQqKT4sIHRydWU+OjpfX2dvb2RfcnZhbF9yZWZfdHlwZSmFBpoCc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgbG9uZyYpIGNvbnN0hgbrAnN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+IHN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZG9fZ2V0X3NpZ25lZDxsb25nPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGxvbmcmKSBjb25zdIcGOXN0ZDo6X18yOjpfX251bV9nZXRfYmFzZTo6X19nZXRfYmFzZShzdGQ6Ol9fMjo6aW9zX2Jhc2UmKYgGSHN0ZDo6X18yOjpfX251bV9nZXQ8Y2hhcj46Ol9fc3RhZ2UyX2ludF9wcmVwKHN0ZDo6X18yOjppb3NfYmFzZSYsIGNoYXImKYkGZXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OmJhc2ljX3N0cmluZygpigZsc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6cmVzaXplKHVuc2lnbmVkIGxvbmcpiwblAXN0ZDo6X18yOjpfX251bV9nZXQ8Y2hhcj46Ol9fc3RhZ2UyX2ludF9sb29wKGNoYXIsIGludCwgY2hhciosIGNoYXIqJiwgdW5zaWduZWQgaW50JiwgY2hhciwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCYsIHVuc2lnbmVkIGludCosIHVuc2lnbmVkIGludComLCBjaGFyIGNvbnN0KimMBlxsb25nIHN0ZDo6X18yOjpfX251bV9nZXRfc2lnbmVkX2ludGVncmFsPGxvbmc+KGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgaW50JiwgaW50KY0GpQFzdGQ6Ol9fMjo6X19jaGVja19ncm91cGluZyhzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0JiwgdW5zaWduZWQgaW50KiwgdW5zaWduZWQgaW50KiwgdW5zaWduZWQgaW50JimOBp8Cc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgbG9uZyBsb25nJikgY29uc3SPBvUCc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19kb19nZXRfc2lnbmVkPGxvbmcgbG9uZz4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBsb25nIGxvbmcmKSBjb25zdJAGZmxvbmcgbG9uZyBzdGQ6Ol9fMjo6X19udW1fZ2V0X3NpZ25lZF9pbnRlZ3JhbDxsb25nIGxvbmc+KGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgaW50JiwgaW50KZEGpAJzdGQ6Ol9fMjo6bnVtX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB1bnNpZ25lZCBzaG9ydCYpIGNvbnN0kgaBA3N0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+IHN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZG9fZ2V0X3Vuc2lnbmVkPHVuc2lnbmVkIHNob3J0PihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHVuc2lnbmVkIHNob3J0JikgY29uc3STBnJ1bnNpZ25lZCBzaG9ydCBzdGQ6Ol9fMjo6X19udW1fZ2V0X3Vuc2lnbmVkX2ludGVncmFsPHVuc2lnbmVkIHNob3J0PihjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGludCYsIGludCmUBqICc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdW5zaWduZWQgaW50JikgY29uc3SVBv0Cc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19kb19nZXRfdW5zaWduZWQ8dW5zaWduZWQgaW50PihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHVuc2lnbmVkIGludCYpIGNvbnN0lgZudW5zaWduZWQgaW50IHN0ZDo6X18yOjpfX251bV9nZXRfdW5zaWduZWRfaW50ZWdyYWw8dW5zaWduZWQgaW50PihjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGludCYsIGludCmXBqgCc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdW5zaWduZWQgbG9uZyBsb25nJikgY29uc3SYBokDc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19kb19nZXRfdW5zaWduZWQ8dW5zaWduZWQgbG9uZyBsb25nPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHVuc2lnbmVkIGxvbmcgbG9uZyYpIGNvbnN0mQZ6dW5zaWduZWQgbG9uZyBsb25nIHN0ZDo6X18yOjpfX251bV9nZXRfdW5zaWduZWRfaW50ZWdyYWw8dW5zaWduZWQgbG9uZyBsb25nPihjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGludCYsIGludCmaBpsCc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgZmxvYXQmKSBjb25zdJsG9QJzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiBzdGQ6Ol9fMjo6bnVtX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2RvX2dldF9mbG9hdGluZ19wb2ludDxmbG9hdD4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBmbG9hdCYpIGNvbnN0nAZYc3RkOjpfXzI6Ol9fbnVtX2dldDxjaGFyPjo6X19zdGFnZTJfZmxvYXRfcHJlcChzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCBjaGFyKiwgY2hhciYsIGNoYXImKZ0G8AFzdGQ6Ol9fMjo6X19udW1fZ2V0PGNoYXI+OjpfX3N0YWdlMl9mbG9hdF9sb29wKGNoYXIsIGJvb2wmLCBjaGFyJiwgY2hhciosIGNoYXIqJiwgY2hhciwgY2hhciwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCYsIHVuc2lnbmVkIGludCosIHVuc2lnbmVkIGludComLCB1bnNpZ25lZCBpbnQmLCBjaGFyKimeBk9mbG9hdCBzdGQ6Ol9fMjo6X19udW1fZ2V0X2Zsb2F0PGZsb2F0PihjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGludCYpnwacAnN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGRvdWJsZSYpIGNvbnN0oAb3AnN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+IHN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZG9fZ2V0X2Zsb2F0aW5nX3BvaW50PGRvdWJsZT4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBkb3VibGUmKSBjb25zdKEGUWRvdWJsZSBzdGQ6Ol9fMjo6X19udW1fZ2V0X2Zsb2F0PGRvdWJsZT4oY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBpbnQmKaIGoQJzdGQ6Ol9fMjo6bnVtX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBsb25nIGRvdWJsZSYpIGNvbnN0owaBA3N0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+IHN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZG9fZ2V0X2Zsb2F0aW5nX3BvaW50PGxvbmcgZG91YmxlPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGxvbmcgZG91YmxlJikgY29uc3SkBltsb25nIGRvdWJsZSBzdGQ6Ol9fMjo6X19udW1fZ2V0X2Zsb2F0PGxvbmcgZG91YmxlPihjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGludCYppQabAnN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHZvaWQqJikgY29uc3SmBhJzdGQ6Ol9fMjo6X19jbG9jKCmnBkxzdGQ6Ol9fMjo6X19saWJjcHBfc3NjYW5mX2woY2hhciBjb25zdCosIF9fbG9jYWxlX3N0cnVjdCosIGNoYXIgY29uc3QqLCAuLi4pqAZfc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6X196ZXJvKCmpBlRjaGFyIGNvbnN0KiBzdGQ6Ol9fMjo6ZmluZDxjaGFyIGNvbnN0KiwgY2hhcj4oY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0JimqBklzdGQ6Ol9fMjo6X19saWJjcHBfbG9jYWxlX2d1YXJkOjpfX2xpYmNwcF9sb2NhbGVfZ3VhcmQoX19sb2NhbGVfc3RydWN0KiYpqwavAnN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGJvb2wmKSBjb25zdKwGbXN0ZDo6X18yOjpudW1wdW5jdDx3Y2hhcl90PiBjb25zdCYgc3RkOjpfXzI6OnVzZV9mYWNldDxzdGQ6Ol9fMjo6bnVtcHVuY3Q8d2NoYXJfdD4gPihzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JimtBuAFc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiBjb25zdCogc3RkOjpfXzI6Ol9fc2Nhbl9rZXl3b3JkPHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+IGNvbnN0Kiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+ID4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiBjb25zdCosIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4gY29uc3QqLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmLCB1bnNpZ25lZCBpbnQmLCBib29sKa4GrwJzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBsb25nJikgY29uc3SvBoYDc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19kb19nZXRfc2lnbmVkPGxvbmc+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgbG9uZyYpIGNvbnN0sAZNc3RkOjpfXzI6Ol9fbnVtX2dldDx3Y2hhcl90Pjo6X19kb193aWRlbihzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90KikgY29uc3SxBk5zdGQ6Ol9fMjo6X19udW1fZ2V0PHdjaGFyX3Q+OjpfX3N0YWdlMl9pbnRfcHJlcChzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90JimyBvEBc3RkOjpfXzI6Ol9fbnVtX2dldDx3Y2hhcl90Pjo6X19zdGFnZTJfaW50X2xvb3Aod2NoYXJfdCwgaW50LCBjaGFyKiwgY2hhciomLCB1bnNpZ25lZCBpbnQmLCB3Y2hhcl90LCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0JiwgdW5zaWduZWQgaW50KiwgdW5zaWduZWQgaW50KiYsIHdjaGFyX3QgY29uc3QqKbMGtAJzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBsb25nIGxvbmcmKSBjb25zdLQGkANzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiBzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2RvX2dldF9zaWduZWQ8bG9uZyBsb25nPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGxvbmcgbG9uZyYpIGNvbnN0tQa5AnN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHVuc2lnbmVkIHNob3J0JikgY29uc3S2BpwDc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19kb19nZXRfdW5zaWduZWQ8dW5zaWduZWQgc2hvcnQ+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdW5zaWduZWQgc2hvcnQmKSBjb25zdLcGtwJzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB1bnNpZ25lZCBpbnQmKSBjb25zdLgGmANzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiBzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2RvX2dldF91bnNpZ25lZDx1bnNpZ25lZCBpbnQ+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdW5zaWduZWQgaW50JikgY29uc3S5Br0Cc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdW5zaWduZWQgbG9uZyBsb25nJikgY29uc3S6BqQDc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19kb19nZXRfdW5zaWduZWQ8dW5zaWduZWQgbG9uZyBsb25nPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHVuc2lnbmVkIGxvbmcgbG9uZyYpIGNvbnN0uwawAnN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGZsb2F0JikgY29uc3S8BpADc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19kb19nZXRfZmxvYXRpbmdfcG9pbnQ8ZmxvYXQ+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgZmxvYXQmKSBjb25zdL0GZHN0ZDo6X18yOjpfX251bV9nZXQ8d2NoYXJfdD46Ol9fc3RhZ2UyX2Zsb2F0X3ByZXAoc3RkOjpfXzI6Omlvc19iYXNlJiwgd2NoYXJfdCosIHdjaGFyX3QmLCB3Y2hhcl90Jim+Bv8Bc3RkOjpfXzI6Ol9fbnVtX2dldDx3Y2hhcl90Pjo6X19zdGFnZTJfZmxvYXRfbG9vcCh3Y2hhcl90LCBib29sJiwgY2hhciYsIGNoYXIqLCBjaGFyKiYsIHdjaGFyX3QsIHdjaGFyX3QsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QmLCB1bnNpZ25lZCBpbnQqLCB1bnNpZ25lZCBpbnQqJiwgdW5zaWduZWQgaW50Jiwgd2NoYXJfdCopvwaxAnN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGRvdWJsZSYpIGNvbnN0wAaSA3N0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+IHN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZG9fZ2V0X2Zsb2F0aW5nX3BvaW50PGRvdWJsZT4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBkb3VibGUmKSBjb25zdMEGtgJzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBsb25nIGRvdWJsZSYpIGNvbnN0wgacA3N0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+IHN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZG9fZ2V0X2Zsb2F0aW5nX3BvaW50PGxvbmcgZG91YmxlPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGxvbmcgZG91YmxlJikgY29uc3TDBrACc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50Jiwgdm9pZComKSBjb25zdMQGZndjaGFyX3QgY29uc3QqIHN0ZDo6X18yOjpmaW5kPHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90Pih3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QmKcUGZ3djaGFyX3QgY29uc3QqIHN0ZDo6X18yOjpfX251bV9nZXQ8d2NoYXJfdD46Ol9fZG9fd2lkZW5fcDx3Y2hhcl90PihzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90KikgY29uc3TGBs0Bc3RkOjpfXzI6Om51bV9wdXQ8Y2hhciwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCBjaGFyLCBib29sKSBjb25zdMcGXnN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OmJlZ2luKCnIBlxzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjplbmQoKckGzQFzdGQ6Ol9fMjo6bnVtX3B1dDxjaGFyLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIGNoYXIsIGxvbmcpIGNvbnN0ygZOc3RkOjpfXzI6Ol9fbnVtX3B1dF9iYXNlOjpfX2Zvcm1hdF9pbnQoY2hhciosIGNoYXIgY29uc3QqLCBib29sLCB1bnNpZ25lZCBpbnQpywZXc3RkOjpfXzI6Ol9fbGliY3BwX3NucHJpbnRmX2woY2hhciosIHVuc2lnbmVkIGxvbmcsIF9fbG9jYWxlX3N0cnVjdCosIGNoYXIgY29uc3QqLCAuLi4pzAZVc3RkOjpfXzI6Ol9fbnVtX3B1dF9iYXNlOjpfX2lkZW50aWZ5X3BhZGRpbmcoY2hhciosIGNoYXIqLCBzdGQ6Ol9fMjo6aW9zX2Jhc2UgY29uc3QmKc0GdXN0ZDo6X18yOjpfX251bV9wdXQ8Y2hhcj46Ol9fd2lkZW5fYW5kX2dyb3VwX2ludChjaGFyKiwgY2hhciosIGNoYXIqLCBjaGFyKiwgY2hhciomLCBjaGFyKiYsIHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKc4GK3ZvaWQgc3RkOjpfXzI6OnJldmVyc2U8Y2hhcio+KGNoYXIqLCBjaGFyKinPBiFzdGQ6Ol9fMjo6aW9zX2Jhc2U6OndpZHRoKCkgY29uc3TQBtIBc3RkOjpfXzI6Om51bV9wdXQ8Y2hhciwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCBjaGFyLCBsb25nIGxvbmcpIGNvbnN00QbWAXN0ZDo6X18yOjpudW1fcHV0PGNoYXIsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgY2hhciwgdW5zaWduZWQgbG9uZykgY29uc3TSBtsBc3RkOjpfXzI6Om51bV9wdXQ8Y2hhciwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCBjaGFyLCB1bnNpZ25lZCBsb25nIGxvbmcpIGNvbnN00wbPAXN0ZDo6X18yOjpudW1fcHV0PGNoYXIsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgY2hhciwgZG91YmxlKSBjb25zdNQGSnN0ZDo6X18yOjpfX251bV9wdXRfYmFzZTo6X19mb3JtYXRfZmxvYXQoY2hhciosIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBpbnQp1QYlc3RkOjpfXzI6Omlvc19iYXNlOjpwcmVjaXNpb24oKSBjb25zdNYGSXN0ZDo6X18yOjpfX2xpYmNwcF9hc3ByaW50Zl9sKGNoYXIqKiwgX19sb2NhbGVfc3RydWN0KiwgY2hhciBjb25zdCosIC4uLinXBndzdGQ6Ol9fMjo6X19udW1fcHV0PGNoYXI+OjpfX3dpZGVuX2FuZF9ncm91cF9mbG9hdChjaGFyKiwgY2hhciosIGNoYXIqLCBjaGFyKiwgY2hhciomLCBjaGFyKiYsIHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKdgG1AFzdGQ6Ol9fMjo6bnVtX3B1dDxjaGFyLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIGNoYXIsIGxvbmcgZG91YmxlKSBjb25zdNkG1AFzdGQ6Ol9fMjo6bnVtX3B1dDxjaGFyLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIGNoYXIsIHZvaWQgY29uc3QqKSBjb25zdNoG3wFzdGQ6Ol9fMjo6bnVtX3B1dDx3Y2hhcl90LCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHdjaGFyX3QsIGJvb2wpIGNvbnN02wZlc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6ZW5kKCncBt8Bc3RkOjpfXzI6Om51bV9wdXQ8d2NoYXJfdCwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90LCBsb25nKSBjb25zdN0GgQFzdGQ6Ol9fMjo6X19udW1fcHV0PHdjaGFyX3Q+OjpfX3dpZGVuX2FuZF9ncm91cF9pbnQoY2hhciosIGNoYXIqLCBjaGFyKiwgd2NoYXJfdCosIHdjaGFyX3QqJiwgd2NoYXJfdComLCBzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JineBqMCc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gc3RkOjpfXzI6Ol9fcGFkX2FuZF9vdXRwdXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4oc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdCosIHN0ZDo6X18yOjppb3NfYmFzZSYsIHdjaGFyX3Qp3wY0dm9pZCBzdGQ6Ol9fMjo6cmV2ZXJzZTx3Y2hhcl90Kj4od2NoYXJfdCosIHdjaGFyX3QqKeAGhAFzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+OjpiYXNpY19zdHJpbmcodW5zaWduZWQgbG9uZywgd2NoYXJfdCnhBuQBc3RkOjpfXzI6Om51bV9wdXQ8d2NoYXJfdCwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90LCBsb25nIGxvbmcpIGNvbnN04gboAXN0ZDo6X18yOjpudW1fcHV0PHdjaGFyX3QsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgd2NoYXJfdCwgdW5zaWduZWQgbG9uZykgY29uc3TjBu0Bc3RkOjpfXzI6Om51bV9wdXQ8d2NoYXJfdCwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90LCB1bnNpZ25lZCBsb25nIGxvbmcpIGNvbnN05AbhAXN0ZDo6X18yOjpudW1fcHV0PHdjaGFyX3QsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgd2NoYXJfdCwgZG91YmxlKSBjb25zdOUGgwFzdGQ6Ol9fMjo6X19udW1fcHV0PHdjaGFyX3Q+OjpfX3dpZGVuX2FuZF9ncm91cF9mbG9hdChjaGFyKiwgY2hhciosIGNoYXIqLCB3Y2hhcl90Kiwgd2NoYXJfdComLCB3Y2hhcl90KiYsIHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKeYG5gFzdGQ6Ol9fMjo6bnVtX3B1dDx3Y2hhcl90LCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHdjaGFyX3QsIGxvbmcgZG91YmxlKSBjb25zdOcG5gFzdGQ6Ol9fMjo6bnVtX3B1dDx3Y2hhcl90LCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHdjaGFyX3QsIHZvaWQgY29uc3QqKSBjb25zdOgGU3ZvaWQgc3RkOjpfXzI6Ol9fcmV2ZXJzZTxjaGFyKj4oY2hhciosIGNoYXIqLCBzdGQ6Ol9fMjo6cmFuZG9tX2FjY2Vzc19pdGVyYXRvcl90YWcp6QZcdm9pZCBzdGQ6Ol9fMjo6X19yZXZlcnNlPHdjaGFyX3QqPih3Y2hhcl90Kiwgd2NoYXJfdCosIHN0ZDo6X18yOjpyYW5kb21fYWNjZXNzX2l0ZXJhdG9yX3RhZynqBrACc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmdldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHRtKiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqKSBjb25zdOsGc3N0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19kYXRlX29yZGVyKCkgY29uc3TsBp4Cc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldF90aW1lKHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdG0qKSBjb25zdO0GngJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0X2RhdGUoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB0bSopIGNvbnN07gahAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXRfd2Vla2RheShzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHRtKikgY29uc3TvBq8Cc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0X3dlZWtkYXluYW1lKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYpIGNvbnN08AajAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXRfbW9udGhuYW1lKHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdG0qKSBjb25zdPEGrQJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfbW9udGhuYW1lKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYpIGNvbnN08gaeAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXRfeWVhcihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHRtKikgY29uc3TzBqgCc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0X3llYXIoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JikgY29uc3T0BqUCaW50IHN0ZDo6X18yOjpfX2dldF91cF90b19uX2RpZ2l0czxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYsIGludCn1BqUCc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHRtKiwgY2hhciwgY2hhcikgY29uc3T2BqUCc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0X3BlcmNlbnQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JikgY29uc3T3BqcCc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0X2RheShpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdPgGqAJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfaG91cihpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdPkGqwJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfMTJfaG91cihpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdPoGsAJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfZGF5X3llYXJfbnVtKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYpIGNvbnN0+wapAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2dldF9tb250aChpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdPwGqgJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfbWludXRlKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYpIGNvbnN0/QapAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2dldF93aGl0ZV9zcGFjZShzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdP4GqQJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfYW1fcG0oaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JikgY29uc3T/BqoCc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0X3NlY29uZChpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdIAHqwJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfd2Vla2RheShpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdIEHqQJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfeWVhcjQoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JikgY29uc3SCB8sCc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmdldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHRtKiwgd2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqKSBjb25zdIMHswJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0X3RpbWUoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB0bSopIGNvbnN0hAezAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXRfZGF0ZShzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHRtKikgY29uc3SFB7YCc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldF93ZWVrZGF5KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdG0qKSBjb25zdIYHxwJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfd2Vla2RheW5hbWUoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JikgY29uc3SHB7gCc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldF9tb250aG5hbWUoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB0bSopIGNvbnN0iAfFAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF9tb250aG5hbWUoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JikgY29uc3SJB7MCc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldF95ZWFyKHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdG0qKSBjb25zdIoHwAJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfeWVhcihpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmKSBjb25zdIsHvQJpbnQgc3RkOjpfXzI6Ol9fZ2V0X3VwX3RvX25fZGlnaXRzPHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JiwgaW50KYwHugJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdG0qLCBjaGFyLCBjaGFyKSBjb25zdI0HvQJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfcGVyY2VudChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmKSBjb25zdI4HvwJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfZGF5KGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN0jwfAAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF9ob3VyKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN0kAfDAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF8xMl9ob3VyKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN0kQfIAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF9kYXlfeWVhcl9udW0oaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JikgY29uc3SSB8ECc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZ2V0X21vbnRoKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN0kwfCAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF9taW51dGUoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JikgY29uc3SUB8ECc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZ2V0X3doaXRlX3NwYWNlKHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN0lQfBAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF9hbV9wbShpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmKSBjb25zdJYHwgJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfc2Vjb25kKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN0lwfDAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF93ZWVrZGF5KGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN0mAfBAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF95ZWFyNChpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmKSBjb25zdJkH3wFzdGQ6Ol9fMjo6dGltZV9wdXQ8Y2hhciwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCBjaGFyLCB0bSBjb25zdCosIGNoYXIsIGNoYXIpIGNvbnN0mgdKc3RkOjpfXzI6Ol9fdGltZV9wdXQ6Ol9fZG9fcHV0KGNoYXIqLCBjaGFyKiYsIHRtIGNvbnN0KiwgY2hhciwgY2hhcikgY29uc3SbB40Bc3RkOjpfXzI6OmVuYWJsZV9pZjwoaXNfbW92ZV9jb25zdHJ1Y3RpYmxlPGNoYXI+Ojp2YWx1ZSkgJiYgKGlzX21vdmVfYXNzaWduYWJsZTxjaGFyPjo6dmFsdWUpLCB2b2lkPjo6dHlwZSBzdGQ6Ol9fMjo6c3dhcDxjaGFyPihjaGFyJiwgY2hhciYpnAfuAXN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+IHN0ZDo6X18yOjpfX2NvcHk8Y2hhciosIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID4oY2hhciosIGNoYXIqLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPimdB/EBc3RkOjpfXzI6OnRpbWVfcHV0PHdjaGFyX3QsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgd2NoYXJfdCwgdG0gY29uc3QqLCBjaGFyLCBjaGFyKSBjb25zdJ4HUHN0ZDo6X18yOjpfX3RpbWVfcHV0OjpfX2RvX3B1dCh3Y2hhcl90Kiwgd2NoYXJfdComLCB0bSBjb25zdCosIGNoYXIsIGNoYXIpIGNvbnN0nwdlc3RkOjpfXzI6Ol9fbGliY3BwX21ic3J0b3djc19sKHdjaGFyX3QqLCBjaGFyIGNvbnN0KiosIHVuc2lnbmVkIGxvbmcsIF9fbWJzdGF0ZV90KiwgX19sb2NhbGVfc3RydWN0KimgByxzdGQ6Ol9fMjo6X190aHJvd19ydW50aW1lX2Vycm9yKGNoYXIgY29uc3QqKaEHiQJzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiBzdGQ6Ol9fMjo6X19jb3B5PHdjaGFyX3QqLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+KHdjaGFyX3QqLCB3Y2hhcl90Kiwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4pogc7c3RkOjpfXzI6Om1vbmV5cHVuY3Q8Y2hhciwgZmFsc2U+Ojpkb19kZWNpbWFsX3BvaW50KCkgY29uc3SjBzZzdGQ6Ol9fMjo6bW9uZXlwdW5jdDxjaGFyLCBmYWxzZT46OmRvX2dyb3VwaW5nKCkgY29uc3SkBztzdGQ6Ol9fMjo6bW9uZXlwdW5jdDxjaGFyLCBmYWxzZT46OmRvX25lZ2F0aXZlX3NpZ24oKSBjb25zdKUHOHN0ZDo6X18yOjptb25leXB1bmN0PGNoYXIsIGZhbHNlPjo6ZG9fcG9zX2Zvcm1hdCgpIGNvbnN0pgc+c3RkOjpfXzI6Om1vbmV5cHVuY3Q8d2NoYXJfdCwgZmFsc2U+Ojpkb19kZWNpbWFsX3BvaW50KCkgY29uc3SnBz5zdGQ6Ol9fMjo6bW9uZXlwdW5jdDx3Y2hhcl90LCBmYWxzZT46OmRvX25lZ2F0aXZlX3NpZ24oKSBjb25zdKgHqQJzdGQ6Ol9fMjo6bW9uZXlfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIGJvb2wsIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGxvbmcgZG91YmxlJikgY29uc3SpB4wDc3RkOjpfXzI6Om1vbmV5X2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2RvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBib29sLCBzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JiwgdW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQmLCBib29sJiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0Jiwgc3RkOjpfXzI6OnVuaXF1ZV9wdHI8Y2hhciwgdm9pZCAoKikodm9pZCopPiYsIGNoYXIqJiwgY2hhciopqgfdA3N0ZDo6X18yOjpfX21vbmV5X2dldDxjaGFyPjo6X19nYXRoZXJfaW5mbyhib29sLCBzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0Jiwgc3RkOjpfXzI6Om1vbmV5X2Jhc2U6OnBhdHRlcm4mLCBjaGFyJiwgY2hhciYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4mLCBpbnQmKasHUnN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpvcGVyYXRvcisrKGludCmsB2Z2b2lkIHN0ZDo6X18yOjpfX2RvdWJsZV9vcl9ub3RoaW5nPGNoYXI+KHN0ZDo6X18yOjp1bmlxdWVfcHRyPGNoYXIsIHZvaWQgKCopKHZvaWQqKT4mLCBjaGFyKiYsIGNoYXIqJimtB4YBdm9pZCBzdGQ6Ol9fMjo6X19kb3VibGVfb3Jfbm90aGluZzx1bnNpZ25lZCBpbnQ+KHN0ZDo6X18yOjp1bmlxdWVfcHRyPHVuc2lnbmVkIGludCwgdm9pZCAoKikodm9pZCopPiYsIHVuc2lnbmVkIGludComLCB1bnNpZ25lZCBpbnQqJimuB/MCc3RkOjpfXzI6Om1vbmV5X2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBib29sLCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+JikgY29uc3SvB15zdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpjbGVhcigpsAfaAXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4mIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46Ol9fYXBwZW5kX2ZvcndhcmRfdW5zYWZlPGNoYXIqPihjaGFyKiwgY2hhciopsQd3c3RkOjpfXzI6Om1vbmV5cHVuY3Q8Y2hhciwgdHJ1ZT4gY29uc3QmIHN0ZDo6X18yOjp1c2VfZmFjZXQ8c3RkOjpfXzI6Om1vbmV5cHVuY3Q8Y2hhciwgdHJ1ZT4gPihzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JimyB7kBc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6b3BlcmF0b3I9KHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4mJimzB3lzdGQ6Ol9fMjo6bW9uZXlwdW5jdDxjaGFyLCBmYWxzZT4gY29uc3QmIHN0ZDo6X18yOjp1c2VfZmFjZXQ8c3RkOjpfXzI6Om1vbmV5cHVuY3Q8Y2hhciwgZmFsc2U+ID4oc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYptAfvAWJvb2wgc3RkOjpfXzI6OmVxdWFsPHN0ZDo6X18yOjpfX3dyYXBfaXRlcjxjaGFyKj4sIHN0ZDo6X18yOjpfX3dyYXBfaXRlcjxjaGFyKj4sIHN0ZDo6X18yOjpfX2VxdWFsX3RvPGNoYXIsIGNoYXI+ID4oc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPGNoYXIqPiwgc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPGNoYXIqPiwgc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPGNoYXIqPiwgc3RkOjpfXzI6Ol9fZXF1YWxfdG88Y2hhciwgY2hhcj4ptQczc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPGNoYXIqPjo6b3BlcmF0b3IrKGxvbmcpIGNvbnN0tgdlc3RkOjpfXzI6OnVuaXF1ZV9wdHI8Y2hhciwgdm9pZCAoKikodm9pZCopPjo6b3BlcmF0b3I9KHN0ZDo6X18yOjp1bmlxdWVfcHRyPGNoYXIsIHZvaWQgKCopKHZvaWQqKT4mJim3B74Cc3RkOjpfXzI6Om1vbmV5X2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBib29sLCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBsb25nIGRvdWJsZSYpIGNvbnN0uAetA3N0ZDo6X18yOjptb25leV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19kb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgYm9vbCwgc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50JiwgYm9vbCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYsIHN0ZDo6X18yOjp1bmlxdWVfcHRyPHdjaGFyX3QsIHZvaWQgKCopKHZvaWQqKT4mLCB3Y2hhcl90KiYsIHdjaGFyX3QqKbkHgQRzdGQ6Ol9fMjo6X19tb25leV9nZXQ8d2NoYXJfdD46Ol9fZ2F0aGVyX2luZm8oYm9vbCwgc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYsIHN0ZDo6X18yOjptb25leV9iYXNlOjpwYXR0ZXJuJiwgd2NoYXJfdCYsIHdjaGFyX3QmLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+JiwgaW50Jim6B1hzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6b3BlcmF0b3IrKyhpbnQpuweRA3N0ZDo6X18yOjptb25leV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgYm9vbCwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiYpIGNvbnN0vAdnc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6Y2xlYXIoKb0H9QFzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+JiBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+OjpfX2FwcGVuZF9mb3J3YXJkX3Vuc2FmZTx3Y2hhcl90Kj4od2NoYXJfdCosIHdjaGFyX3QqKb4HfXN0ZDo6X18yOjptb25leXB1bmN0PHdjaGFyX3QsIHRydWU+IGNvbnN0JiBzdGQ6Ol9fMjo6dXNlX2ZhY2V0PHN0ZDo6X18yOjptb25leXB1bmN0PHdjaGFyX3QsIHRydWU+ID4oc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYpvwfLAXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID46Om9wZXJhdG9yPShzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+JiYpwAd/c3RkOjpfXzI6Om1vbmV5cHVuY3Q8d2NoYXJfdCwgZmFsc2U+IGNvbnN0JiBzdGQ6Ol9fMjo6dXNlX2ZhY2V0PHN0ZDo6X18yOjptb25leXB1bmN0PHdjaGFyX3QsIGZhbHNlPiA+KHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKcEHigJib29sIHN0ZDo6X18yOjplcXVhbDxzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8d2NoYXJfdCo+LCBzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8d2NoYXJfdCo+LCBzdGQ6Ol9fMjo6X19lcXVhbF90bzx3Y2hhcl90LCB3Y2hhcl90PiA+KHN0ZDo6X18yOjpfX3dyYXBfaXRlcjx3Y2hhcl90Kj4sIHN0ZDo6X18yOjpfX3dyYXBfaXRlcjx3Y2hhcl90Kj4sIHN0ZDo6X18yOjpfX3dyYXBfaXRlcjx3Y2hhcl90Kj4sIHN0ZDo6X18yOjpfX2VxdWFsX3RvPHdjaGFyX3QsIHdjaGFyX3Q+KcIHNnN0ZDo6X18yOjpfX3dyYXBfaXRlcjx3Y2hhcl90Kj46Om9wZXJhdG9yKyhsb25nKSBjb25zdMMH3AFzdGQ6Ol9fMjo6bW9uZXlfcHV0PGNoYXIsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgYm9vbCwgc3RkOjpfXzI6Omlvc19iYXNlJiwgY2hhciwgbG9uZyBkb3VibGUpIGNvbnN0xAeLA3N0ZDo6X18yOjpfX21vbmV5X3B1dDxjaGFyPjo6X19nYXRoZXJfaW5mbyhib29sLCBib29sLCBzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0Jiwgc3RkOjpfXzI6Om1vbmV5X2Jhc2U6OnBhdHRlcm4mLCBjaGFyJiwgY2hhciYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiYsIGludCYpxQfZA3N0ZDo6X18yOjpfX21vbmV5X3B1dDxjaGFyPjo6X19mb3JtYXQoY2hhciosIGNoYXIqJiwgY2hhciomLCB1bnNpZ25lZCBpbnQsIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0Kiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JiwgYm9vbCwgc3RkOjpfXzI6Om1vbmV5X2Jhc2U6OnBhdHRlcm4gY29uc3QmLCBjaGFyLCBjaGFyLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QmLCBpbnQpxgeOAWNoYXIqIHN0ZDo6X18yOjpjb3B5PHN0ZDo6X18yOjpfX3dyYXBfaXRlcjxjaGFyIGNvbnN0Kj4sIGNoYXIqPihzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8Y2hhciBjb25zdCo+LCBzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8Y2hhciBjb25zdCo+LCBjaGFyKinHB60Cc3RkOjpfXzI6Om1vbmV5X3B1dDxjaGFyLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIGJvb2wsIHN0ZDo6X18yOjppb3NfYmFzZSYsIGNoYXIsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QmKSBjb25zdMgH7gFzdGQ6Ol9fMjo6bW9uZXlfcHV0PHdjaGFyX3QsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgYm9vbCwgc3RkOjpfXzI6Omlvc19iYXNlJiwgd2NoYXJfdCwgbG9uZyBkb3VibGUpIGNvbnN0yQemA3N0ZDo6X18yOjpfX21vbmV5X3B1dDx3Y2hhcl90Pjo6X19nYXRoZXJfaW5mbyhib29sLCBib29sLCBzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0Jiwgc3RkOjpfXzI6Om1vbmV5X2Jhc2U6OnBhdHRlcm4mLCB3Y2hhcl90Jiwgd2NoYXJfdCYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiYsIGludCYpygeGBHN0ZDo6X18yOjpfX21vbmV5X3B1dDx3Y2hhcl90Pjo6X19mb3JtYXQod2NoYXJfdCosIHdjaGFyX3QqJiwgd2NoYXJfdComLCB1bnNpZ25lZCBpbnQsIHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0Kiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JiwgYm9vbCwgc3RkOjpfXzI6Om1vbmV5X2Jhc2U6OnBhdHRlcm4gY29uc3QmLCB3Y2hhcl90LCB3Y2hhcl90LCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiBjb25zdCYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4gY29uc3QmLCBpbnQpywegAXdjaGFyX3QqIHN0ZDo6X18yOjpjb3B5PHN0ZDo6X18yOjpfX3dyYXBfaXRlcjx3Y2hhcl90IGNvbnN0Kj4sIHdjaGFyX3QqPihzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8d2NoYXJfdCBjb25zdCo+LCBzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8d2NoYXJfdCBjb25zdCo+LCB3Y2hhcl90KinMB8gCc3RkOjpfXzI6Om1vbmV5X3B1dDx3Y2hhcl90LCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIGJvb2wsIHN0ZDo6X18yOjppb3NfYmFzZSYsIHdjaGFyX3QsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4gY29uc3QmKSBjb25zdM0HkAFjaGFyKiBzdGQ6Ol9fMjo6X19jb3B5PHN0ZDo6X18yOjpfX3dyYXBfaXRlcjxjaGFyIGNvbnN0Kj4sIGNoYXIqPihzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8Y2hhciBjb25zdCo+LCBzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8Y2hhciBjb25zdCo+LCBjaGFyKinOB6IBd2NoYXJfdCogc3RkOjpfXzI6Ol9fY29weTxzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8d2NoYXJfdCBjb25zdCo+LCB3Y2hhcl90Kj4oc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPHdjaGFyX3QgY29uc3QqPiwgc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPHdjaGFyX3QgY29uc3QqPiwgd2NoYXJfdCopzweeAXN0ZDo6X18yOjptZXNzYWdlczxjaGFyPjo6ZG9fb3BlbihzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0Jiwgc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYpIGNvbnN00AeUAXN0ZDo6X18yOjptZXNzYWdlczxjaGFyPjo6ZG9fZ2V0KGxvbmcsIGludCwgaW50LCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0JikgY29uc3TRB7gDc3RkOjpfXzI6OmJhY2tfaW5zZXJ0X2l0ZXJhdG9yPHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gPiBzdGQ6Ol9fMjo6X19uYXJyb3dfdG9fdXRmODw4dWw+OjpvcGVyYXRvcigpPHN0ZDo6X18yOjpiYWNrX2luc2VydF9pdGVyYXRvcjxzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+ID4sIGNoYXI+KHN0ZDo6X18yOjpiYWNrX2luc2VydF9pdGVyYXRvcjxzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+ID4sIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KikgY29uc3TSB44Bc3RkOjpfXzI6OmJhY2tfaW5zZXJ0X2l0ZXJhdG9yPHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gPjo6b3BlcmF0b3I9KGNoYXIgY29uc3QmKdMHoAFzdGQ6Ol9fMjo6bWVzc2FnZXM8d2NoYXJfdD46OmRvX2dldChsb25nLCBpbnQsIGludCwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiBjb25zdCYpIGNvbnN01AfCA3N0ZDo6X18yOjpiYWNrX2luc2VydF9pdGVyYXRvcjxzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+ID4gc3RkOjpfXzI6Ol9fbmFycm93X3RvX3V0Zjg8MzJ1bD46Om9wZXJhdG9yKCk8c3RkOjpfXzI6OmJhY2tfaW5zZXJ0X2l0ZXJhdG9yPHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gPiwgd2NoYXJfdD4oc3RkOjpfXzI6OmJhY2tfaW5zZXJ0X2l0ZXJhdG9yPHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gPiwgd2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqKSBjb25zdNUH0ANzdGQ6Ol9fMjo6YmFja19pbnNlcnRfaXRlcmF0b3I8c3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiA+IHN0ZDo6X18yOjpfX3dpZGVuX2Zyb21fdXRmODwzMnVsPjo6b3BlcmF0b3IoKTxzdGQ6Ol9fMjo6YmFja19pbnNlcnRfaXRlcmF0b3I8c3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiA+ID4oc3RkOjpfXzI6OmJhY2tfaW5zZXJ0X2l0ZXJhdG9yPHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4gPiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqKSBjb25zdNYHOXN0ZDo6X18yOjpjb2RlY3Z0PHdjaGFyX3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6fmNvZGVjdnQoKdcHLXN0ZDo6X18yOjpsb2NhbGU6Ol9faW1wOjpfX2ltcCh1bnNpZ25lZCBsb25nKdgHfnN0ZDo6X18yOjpfX3ZlY3Rvcl9iYXNlPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46Ol9fdmVjdG9yX2Jhc2UoKdkHggFzdGQ6Ol9fMjo6dmVjdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46Ol9fdmFsbG9jYXRlKHVuc2lnbmVkIGxvbmcp2geJAXN0ZDo6X18yOjp2ZWN0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4gPjo6X19jb25zdHJ1Y3RfYXRfZW5kKHVuc2lnbmVkIGxvbmcp2wd2c3RkOjpfXzI6Ol9fdmVjdG9yX2Jhc2U8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4gPjo6Y2xlYXIoKdwHjgFzdGQ6Ol9fMjo6dmVjdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46Ol9fYW5ub3RhdGVfc2hyaW5rKHVuc2lnbmVkIGxvbmcpIGNvbnN03Qcdc3RkOjpfXzI6OmxvY2FsZTo6aWQ6Ol9fZ2V0KCneB0BzdGQ6Ol9fMjo6bG9jYWxlOjpfX2ltcDo6aW5zdGFsbChzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIGxvbmcp3wdIc3RkOjpfXzI6OmN0eXBlPGNoYXI+OjpjdHlwZSh1bnNpZ25lZCBzaG9ydCBjb25zdCosIGJvb2wsIHVuc2lnbmVkIGxvbmcp4Acbc3RkOjpfXzI6OmxvY2FsZTo6Y2xhc3NpYygp4Qd9c3RkOjpfXzI6OnZlY3RvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiA+OjpyZXNpemUodW5zaWduZWQgbG9uZyniByFzdGQ6Ol9fMjo6bG9jYWxlOjpfX2ltcDo6fl9faW1wKCnjB4EBc3RkOjpfXzI6OnZlY3RvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiA+OjpfX2Fubm90YXRlX2RlbGV0ZSgpIGNvbnN05Acjc3RkOjpfXzI6OmxvY2FsZTo6X19pbXA6On5fX2ltcCgpLjHlB39zdGQ6Ol9fMjo6dmVjdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46Ol9fYXBwZW5kKHVuc2lnbmVkIGxvbmcp5gccc3RkOjpfXzI6OmxvY2FsZTo6X19nbG9iYWwoKecHGnN0ZDo6X18yOjpsb2NhbGU6OmxvY2FsZSgp6Acuc3RkOjpfXzI6OmxvY2FsZTo6X19pbXA6Omhhc19mYWNldChsb25nKSBjb25zdOkHHnN0ZDo6X18yOjpsb2NhbGU6OmlkOjpfX2luaXQoKeoHjAF2b2lkIHN0ZDo6X18yOjpjYWxsX29uY2U8c3RkOjpfXzI6Oihhbm9ueW1vdXMgbmFtZXNwYWNlKTo6X19mYWtlX2JpbmQ+KHN0ZDo6X18yOjpvbmNlX2ZsYWcmLCBzdGQ6Ol9fMjo6KGFub255bW91cyBuYW1lc3BhY2UpOjpfX2Zha2VfYmluZCYmKesHK3N0ZDo6X18yOjpsb2NhbGU6OmZhY2V0OjpfX29uX3plcm9fc2hhcmVkKCnsB2l2b2lkIHN0ZDo6X18yOjpfX2NhbGxfb25jZV9wcm94eTxzdGQ6Ol9fMjo6dHVwbGU8c3RkOjpfXzI6Oihhbm9ueW1vdXMgbmFtZXNwYWNlKTo6X19mYWtlX2JpbmQmJj4gPih2b2lkKintBz5zdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD46OmRvX2lzKHVuc2lnbmVkIHNob3J0LCB3Y2hhcl90KSBjb25zdO4HVnN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90Pjo6ZG9faXMod2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqLCB1bnNpZ25lZCBzaG9ydCopIGNvbnN07wdac3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+Ojpkb19zY2FuX2lzKHVuc2lnbmVkIHNob3J0LCB3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdCopIGNvbnN08Adbc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+Ojpkb19zY2FuX25vdCh1bnNpZ25lZCBzaG9ydCwgd2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqKSBjb25zdPEHM3N0ZDo6X18yOjpjdHlwZTx3Y2hhcl90Pjo6ZG9fdG91cHBlcih3Y2hhcl90KSBjb25zdPIHRHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90Pjo6ZG9fdG91cHBlcih3Y2hhcl90Kiwgd2NoYXJfdCBjb25zdCopIGNvbnN08wczc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+Ojpkb190b2xvd2VyKHdjaGFyX3QpIGNvbnN09AdEc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+Ojpkb190b2xvd2VyKHdjaGFyX3QqLCB3Y2hhcl90IGNvbnN0KikgY29uc3T1By5zdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD46OmRvX3dpZGVuKGNoYXIpIGNvbnN09gdMc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+Ojpkb193aWRlbihjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHdjaGFyX3QqKSBjb25zdPcHOHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90Pjo6ZG9fbmFycm93KHdjaGFyX3QsIGNoYXIpIGNvbnN0+AdWc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+Ojpkb19uYXJyb3cod2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqLCBjaGFyLCBjaGFyKikgY29uc3T5Bx9zdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj46On5jdHlwZSgp+gchc3RkOjpfXzI6OmN0eXBlPGNoYXI+Ojp+Y3R5cGUoKS4x+wctc3RkOjpfXzI6OmN0eXBlPGNoYXI+Ojpkb190b3VwcGVyKGNoYXIpIGNvbnN0/Ac7c3RkOjpfXzI6OmN0eXBlPGNoYXI+Ojpkb190b3VwcGVyKGNoYXIqLCBjaGFyIGNvbnN0KikgY29uc3T9By1zdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj46OmRvX3RvbG93ZXIoY2hhcikgY29uc3T+BztzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj46OmRvX3RvbG93ZXIoY2hhciosIGNoYXIgY29uc3QqKSBjb25zdP8HRnN0ZDo6X18yOjpjdHlwZTxjaGFyPjo6ZG9fd2lkZW4oY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCBjaGFyKikgY29uc3SACDJzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj46OmRvX25hcnJvdyhjaGFyLCBjaGFyKSBjb25zdIEITXN0ZDo6X18yOjpjdHlwZTxjaGFyPjo6ZG9fbmFycm93KGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgY2hhciwgY2hhciopIGNvbnN0ggiEAXN0ZDo6X18yOjpjb2RlY3Z0PGNoYXIsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9fb3V0KF9fbWJzdGF0ZV90JiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiYsIGNoYXIqLCBjaGFyKiwgY2hhciomKSBjb25zdIMIYHN0ZDo6X18yOjpjb2RlY3Z0PGNoYXIsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9fdW5zaGlmdChfX21ic3RhdGVfdCYsIGNoYXIqLCBjaGFyKiwgY2hhciomKSBjb25zdIQIcnN0ZDo6X18yOjpjb2RlY3Z0PGNoYXIsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9fbGVuZ3RoKF9fbWJzdGF0ZV90JiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBsb25nKSBjb25zdIUIO3N0ZDo6X18yOjpjb2RlY3Z0PHdjaGFyX3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6fmNvZGVjdnQoKS4xhgiQAXN0ZDo6X18yOjpjb2RlY3Z0PHdjaGFyX3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9fb3V0KF9fbWJzdGF0ZV90Jiwgd2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0KiYsIGNoYXIqLCBjaGFyKiwgY2hhciomKSBjb25zdIcIdXN0ZDo6X18yOjpfX2xpYmNwcF93Y3NucnRvbWJzX2woY2hhciosIHdjaGFyX3QgY29uc3QqKiwgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgX19tYnN0YXRlX3QqLCBfX2xvY2FsZV9zdHJ1Y3QqKYgITHN0ZDo6X18yOjpfX2xpYmNwcF93Y3J0b21iX2woY2hhciosIHdjaGFyX3QsIF9fbWJzdGF0ZV90KiwgX19sb2NhbGVfc3RydWN0KimJCI8Bc3RkOjpfXzI6OmNvZGVjdnQ8d2NoYXJfdCwgY2hhciwgX19tYnN0YXRlX3Q+Ojpkb19pbihfX21ic3RhdGVfdCYsIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdComLCB3Y2hhcl90Kiwgd2NoYXJfdCosIHdjaGFyX3QqJikgY29uc3SKCHVzdGQ6Ol9fMjo6X19saWJjcHBfbWJzbnJ0b3djc19sKHdjaGFyX3QqLCBjaGFyIGNvbnN0KiosIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIF9fbWJzdGF0ZV90KiwgX19sb2NhbGVfc3RydWN0KimLCGJzdGQ6Ol9fMjo6X19saWJjcHBfbWJydG93Y19sKHdjaGFyX3QqLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgbG9uZywgX19tYnN0YXRlX3QqLCBfX2xvY2FsZV9zdHJ1Y3QqKYwIY3N0ZDo6X18yOjpjb2RlY3Z0PHdjaGFyX3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9fdW5zaGlmdChfX21ic3RhdGVfdCYsIGNoYXIqLCBjaGFyKiwgY2hhciomKSBjb25zdI0IQnN0ZDo6X18yOjpjb2RlY3Z0PHdjaGFyX3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9fZW5jb2RpbmcoKSBjb25zdI4IU3N0ZDo6X18yOjpfX2xpYmNwcF9tYnRvd2NfbCh3Y2hhcl90KiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGxvbmcsIF9fbG9jYWxlX3N0cnVjdCopjwgxc3RkOjpfXzI6Ol9fbGliY3BwX21iX2N1cl9tYXhfbChfX2xvY2FsZV9zdHJ1Y3QqKZAIdXN0ZDo6X18yOjpjb2RlY3Z0PHdjaGFyX3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9fbGVuZ3RoKF9fbWJzdGF0ZV90JiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBsb25nKSBjb25zdJEIV3N0ZDo6X18yOjpfX2xpYmNwcF9tYnJsZW5fbChjaGFyIGNvbnN0KiwgdW5zaWduZWQgbG9uZywgX19tYnN0YXRlX3QqLCBfX2xvY2FsZV9zdHJ1Y3QqKZIIRHN0ZDo6X18yOjpjb2RlY3Z0PHdjaGFyX3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9fbWF4X2xlbmd0aCgpIGNvbnN0kwiUAXN0ZDo6X18yOjpjb2RlY3Z0PGNoYXIxNl90LCBjaGFyLCBfX21ic3RhdGVfdD46OmRvX291dChfX21ic3RhdGVfdCYsIGNoYXIxNl90IGNvbnN0KiwgY2hhcjE2X3QgY29uc3QqLCBjaGFyMTZfdCBjb25zdComLCBjaGFyKiwgY2hhciosIGNoYXIqJikgY29uc3SUCLUBc3RkOjpfXzI6OnV0ZjE2X3RvX3V0ZjgodW5zaWduZWQgc2hvcnQgY29uc3QqLCB1bnNpZ25lZCBzaG9ydCBjb25zdCosIHVuc2lnbmVkIHNob3J0IGNvbnN0KiYsIHVuc2lnbmVkIGNoYXIqLCB1bnNpZ25lZCBjaGFyKiwgdW5zaWduZWQgY2hhciomLCB1bnNpZ25lZCBsb25nLCBzdGQ6Ol9fMjo6Y29kZWN2dF9tb2RlKZUIkwFzdGQ6Ol9fMjo6Y29kZWN2dDxjaGFyMTZfdCwgY2hhciwgX19tYnN0YXRlX3Q+Ojpkb19pbihfX21ic3RhdGVfdCYsIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdComLCBjaGFyMTZfdCosIGNoYXIxNl90KiwgY2hhcjE2X3QqJikgY29uc3SWCLUBc3RkOjpfXzI6OnV0ZjhfdG9fdXRmMTYodW5zaWduZWQgY2hhciBjb25zdCosIHVuc2lnbmVkIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBjaGFyIGNvbnN0KiYsIHVuc2lnbmVkIHNob3J0KiwgdW5zaWduZWQgc2hvcnQqLCB1bnNpZ25lZCBzaG9ydComLCB1bnNpZ25lZCBsb25nLCBzdGQ6Ol9fMjo6Y29kZWN2dF9tb2RlKZcIdnN0ZDo6X18yOjpjb2RlY3Z0PGNoYXIxNl90LCBjaGFyLCBfX21ic3RhdGVfdD46OmRvX2xlbmd0aChfX21ic3RhdGVfdCYsIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgbG9uZykgY29uc3SYCIABc3RkOjpfXzI6OnV0ZjhfdG9fdXRmMTZfbGVuZ3RoKHVuc2lnbmVkIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgc3RkOjpfXzI6OmNvZGVjdnRfbW9kZSmZCEVzdGQ6Ol9fMjo6Y29kZWN2dDxjaGFyMTZfdCwgY2hhciwgX19tYnN0YXRlX3Q+Ojpkb19tYXhfbGVuZ3RoKCkgY29uc3SaCJQBc3RkOjpfXzI6OmNvZGVjdnQ8Y2hhcjMyX3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9fb3V0KF9fbWJzdGF0ZV90JiwgY2hhcjMyX3QgY29uc3QqLCBjaGFyMzJfdCBjb25zdCosIGNoYXIzMl90IGNvbnN0KiYsIGNoYXIqLCBjaGFyKiwgY2hhciomKSBjb25zdJsIrgFzdGQ6Ol9fMjo6dWNzNF90b191dGY4KHVuc2lnbmVkIGludCBjb25zdCosIHVuc2lnbmVkIGludCBjb25zdCosIHVuc2lnbmVkIGludCBjb25zdComLCB1bnNpZ25lZCBjaGFyKiwgdW5zaWduZWQgY2hhciosIHVuc2lnbmVkIGNoYXIqJiwgdW5zaWduZWQgbG9uZywgc3RkOjpfXzI6OmNvZGVjdnRfbW9kZSmcCJMBc3RkOjpfXzI6OmNvZGVjdnQ8Y2hhcjMyX3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9faW4oX19tYnN0YXRlX3QmLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqJiwgY2hhcjMyX3QqLCBjaGFyMzJfdCosIGNoYXIzMl90KiYpIGNvbnN0nQiuAXN0ZDo6X18yOjp1dGY4X3RvX3VjczQodW5zaWduZWQgY2hhciBjb25zdCosIHVuc2lnbmVkIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBjaGFyIGNvbnN0KiYsIHVuc2lnbmVkIGludCosIHVuc2lnbmVkIGludCosIHVuc2lnbmVkIGludComLCB1bnNpZ25lZCBsb25nLCBzdGQ6Ol9fMjo6Y29kZWN2dF9tb2RlKZ4IdnN0ZDo6X18yOjpjb2RlY3Z0PGNoYXIzMl90LCBjaGFyLCBfX21ic3RhdGVfdD46OmRvX2xlbmd0aChfX21ic3RhdGVfdCYsIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgbG9uZykgY29uc3SfCH9zdGQ6Ol9fMjo6dXRmOF90b191Y3M0X2xlbmd0aCh1bnNpZ25lZCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgY2hhciBjb25zdCosIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIHN0ZDo6X18yOjpjb2RlY3Z0X21vZGUpoAglc3RkOjpfXzI6Om51bXB1bmN0PGNoYXI+Ojp+bnVtcHVuY3QoKaEIJ3N0ZDo6X18yOjpudW1wdW5jdDxjaGFyPjo6fm51bXB1bmN0KCkuMaIIKHN0ZDo6X18yOjpudW1wdW5jdDx3Y2hhcl90Pjo6fm51bXB1bmN0KCmjCCpzdGQ6Ol9fMjo6bnVtcHVuY3Q8d2NoYXJfdD46On5udW1wdW5jdCgpLjGkCDJzdGQ6Ol9fMjo6bnVtcHVuY3Q8Y2hhcj46OmRvX2RlY2ltYWxfcG9pbnQoKSBjb25zdKUIMnN0ZDo6X18yOjpudW1wdW5jdDxjaGFyPjo6ZG9fdGhvdXNhbmRzX3NlcCgpIGNvbnN0pggtc3RkOjpfXzI6Om51bXB1bmN0PGNoYXI+Ojpkb19ncm91cGluZygpIGNvbnN0pwgwc3RkOjpfXzI6Om51bXB1bmN0PHdjaGFyX3Q+Ojpkb19ncm91cGluZygpIGNvbnN0qAgtc3RkOjpfXzI6Om51bXB1bmN0PGNoYXI+Ojpkb190cnVlbmFtZSgpIGNvbnN0qQgwc3RkOjpfXzI6Om51bXB1bmN0PHdjaGFyX3Q+Ojpkb190cnVlbmFtZSgpIGNvbnN0qgh8c3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6YmFzaWNfc3RyaW5nKHdjaGFyX3QgY29uc3QqKasILnN0ZDo6X18yOjpudW1wdW5jdDxjaGFyPjo6ZG9fZmFsc2VuYW1lKCkgY29uc3SsCDFzdGQ6Ol9fMjo6bnVtcHVuY3Q8d2NoYXJfdD46OmRvX2ZhbHNlbmFtZSgpIGNvbnN0rQhtc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6b3BlcmF0b3I9KGNoYXIgY29uc3QqKa4INXN0ZDo6X18yOjpfX3RpbWVfZ2V0X2Nfc3RvcmFnZTxjaGFyPjo6X193ZWVrcygpIGNvbnN0rwgWc3RkOjpfXzI6OmluaXRfd2Vla3MoKbAIGl9fY3h4X2dsb2JhbF9hcnJheV9kdG9yLjU0sQg4c3RkOjpfXzI6Ol9fdGltZV9nZXRfY19zdG9yYWdlPHdjaGFyX3Q+OjpfX3dlZWtzKCkgY29uc3SyCBdzdGQ6Ol9fMjo6aW5pdF93d2Vla3MoKbMIGl9fY3h4X2dsb2JhbF9hcnJheV9kdG9yLjY5tAh5c3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6b3BlcmF0b3I9KHdjaGFyX3QgY29uc3QqKbUINnN0ZDo6X18yOjpfX3RpbWVfZ2V0X2Nfc3RvcmFnZTxjaGFyPjo6X19tb250aHMoKSBjb25zdLYIF3N0ZDo6X18yOjppbml0X21vbnRocygptwgaX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuODS4CDlzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8d2NoYXJfdD46Ol9fbW9udGhzKCkgY29uc3S5CBhzdGQ6Ol9fMjo6aW5pdF93bW9udGhzKCm6CBtfX2N4eF9nbG9iYWxfYXJyYXlfZHRvci4xMDi7CDVzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8Y2hhcj46Ol9fYW1fcG0oKSBjb25zdLwIFnN0ZDo6X18yOjppbml0X2FtX3BtKCm9CBtfX2N4eF9nbG9iYWxfYXJyYXlfZHRvci4xMzK+CDhzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8d2NoYXJfdD46Ol9fYW1fcG0oKSBjb25zdL8IF3N0ZDo6X18yOjppbml0X3dhbV9wbSgpwAgbX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuMTM1wQgxc3RkOjpfXzI6Ol9fdGltZV9nZXRfY19zdG9yYWdlPGNoYXI+OjpfX3goKSBjb25zdMIIGV9fY3h4X2dsb2JhbF9hcnJheV9kdG9yLjHDCDRzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8d2NoYXJfdD46Ol9feCgpIGNvbnN0xAgaX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuMzHFCDFzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8Y2hhcj46Ol9fWCgpIGNvbnN0xggaX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuMzPHCDRzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8d2NoYXJfdD46Ol9fWCgpIGNvbnN0yAgaX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuMzXJCDFzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8Y2hhcj46Ol9fYygpIGNvbnN0yggaX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuMzfLCDRzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8d2NoYXJfdD46Ol9fYygpIGNvbnN0zAgaX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuMznNCDFzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8Y2hhcj46Ol9fcigpIGNvbnN0zggaX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuNDHPCDRzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8d2NoYXJfdD46Ol9fcigpIGNvbnN00AgaX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuNDPRCGlzdGQ6Ol9fMjo6dGltZV9wdXQ8Y2hhciwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6fnRpbWVfcHV0KCnSCGtzdGQ6Ol9fMjo6dGltZV9wdXQ8Y2hhciwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6fnRpbWVfcHV0KCkuMdMIeHN0ZDo6X18yOjp2ZWN0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4gPjo6bWF4X3NpemUoKSBjb25zdNQIqwFzdGQ6Ol9fMjo6YWxsb2NhdG9yX3RyYWl0czxzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4gPjo6YWxsb2NhdGUoc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+JiwgdW5zaWduZWQgbG9uZynVCIsBc3RkOjpfXzI6OnZlY3RvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiA+OjpfX2Fubm90YXRlX25ldyh1bnNpZ25lZCBsb25nKSBjb25zdNYIX3N0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPjo6YWxsb2NhdGUodW5zaWduZWQgbG9uZywgdm9pZCBjb25zdCop1wg/c3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPjo6YWxsb2NhdGUodW5zaWduZWQgbG9uZywgdm9pZCBjb25zdCop2AjIAXN0ZDo6X18yOjphbGxvY2F0b3JfdHJhaXRzPHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiA+OjpkZWFsbG9jYXRlKHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiYsIHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiosIHVuc2lnbmVkIGxvbmcp2QibAXN0ZDo6X18yOjpfX3ZlY3Rvcl9iYXNlPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46Ol9fZGVzdHJ1Y3RfYXRfZW5kKHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiop2ggic3RkOjpfXzI6Ol9fdGltZV9wdXQ6Ol9fdGltZV9wdXQoKdsIiAFzdGQ6Ol9fMjo6dmVjdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46Ol9fcmVjb21tZW5kKHVuc2lnbmVkIGxvbmcpIGNvbnN03AjYAXN0ZDo6X18yOjpfX3NwbGl0X2J1ZmZlcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiY+OjpfX3NwbGl0X2J1ZmZlcih1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4mKd0IkQFzdGQ6Ol9fMjo6X19zcGxpdF9idWZmZXI8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4mPjo6X19jb25zdHJ1Y3RfYXRfZW5kKHVuc2lnbmVkIGxvbmcp3gjzAXN0ZDo6X18yOjp2ZWN0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4gPjo6X19zd2FwX291dF9jaXJjdWxhcl9idWZmZXIoc3RkOjpfXzI6Ol9fc3BsaXRfYnVmZmVyPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+Jj4mKd8IxgNzdGQ6Ol9fMjo6ZW5hYmxlX2lmPCgoc3RkOjpfXzI6OmludGVncmFsX2NvbnN0YW50PGJvb2wsIGZhbHNlPjo6dmFsdWUpIHx8ICghKF9faGFzX2NvbnN0cnVjdDxzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4sIGJvb2wqLCBib29sPjo6dmFsdWUpKSkgJiYgKGlzX3RyaXZpYWxseV9tb3ZlX2NvbnN0cnVjdGlibGU8Ym9vbD46OnZhbHVlKSwgdm9pZD46OnR5cGUgc3RkOjpfXzI6OmFsbG9jYXRvcl90cmFpdHM8c3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46Ol9fY29uc3RydWN0X2JhY2t3YXJkPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kj4oc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+JiwgYm9vbCosIGJvb2wqLCBib29sKiYp4Ah8c3RkOjpfXzI6Ol9fY29tcHJlc3NlZF9wYWlyPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiY+OjpzZWNvbmQoKeEIxgFzdGQ6Ol9fMjo6X19zcGxpdF9idWZmZXI8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4mPjo6X19kZXN0cnVjdF9hdF9lbmQoc3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqKiwgc3RkOjpfXzI6OmludGVncmFsX2NvbnN0YW50PGJvb2wsIGZhbHNlPiniCEBzdGQ6Ol9fMjo6KGFub255bW91cyBuYW1lc3BhY2UpOjpfX2Zha2VfYmluZDo6b3BlcmF0b3IoKSgpIGNvbnN04whCc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90Pjo6YWxsb2NhdGUodW5zaWduZWQgbG9uZywgdm9pZCBjb25zdCop5Ahrc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6X19jbGVhcl9hbmRfc2hyaW5rKCnlCHRzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+OjpfX2NsZWFyX2FuZF9zaHJpbmsoKeYIQ2xvbmcgZG91YmxlIHN0ZDo6X18yOjpfX2RvX3N0cnRvZDxsb25nIGRvdWJsZT4oY2hhciBjb25zdCosIGNoYXIqKinnCC1zdGQ6Ol9fMjo6X19zaGFyZWRfY291bnQ6On5fX3NoYXJlZF9jb3VudCgpLjHoCC9zdGQ6Ol9fMjo6X19zaGFyZWRfd2Vha19jb3VudDo6X19yZWxlYXNlX3dlYWsoKekISXN0ZDo6X18yOjpfX3NoYXJlZF93ZWFrX2NvdW50OjpfX2dldF9kZWxldGVyKHN0ZDo6dHlwZV9pbmZvIGNvbnN0JikgY29uc3TqCEZzdGQ6Ol9fMjo6X19jYWxsX29uY2UodW5zaWduZWQgbG9uZyB2b2xhdGlsZSYsIHZvaWQqLCB2b2lkICgqKSh2b2lkKikp6wgbb3BlcmF0b3IgbmV3KHVuc2lnbmVkIGxvbmcp7Ag9c3RkOjpfXzI6Ol9fbGliY3BwX3JlZnN0cmluZzo6X19saWJjcHBfcmVmc3RyaW5nKGNoYXIgY29uc3QqKe0IB3dtZW1zZXTuCAh3bWVtbW92Ze8IQ3N0ZDo6X18yOjpfX2Jhc2ljX3N0cmluZ19jb21tb248dHJ1ZT46Ol9fdGhyb3dfbGVuZ3RoX2Vycm9yKCkgY29uc3TwCMEBc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6YmFzaWNfc3RyaW5nKHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QmKfEIeXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46Ol9faW5pdChjaGFyIGNvbnN0KiwgdW5zaWduZWQgbG9uZynyCGZzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+Ojp+YmFzaWNfc3RyaW5nKCnzCHlzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+Ojphc3NpZ24oY2hhciBjb25zdCosIHVuc2lnbmVkIGxvbmcp9AjTAXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46Ol9fZ3Jvd19ieV9hbmRfcmVwbGFjZSh1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCBjaGFyIGNvbnN0Kin1CHJzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpyZXNpemUodW5zaWduZWQgbG9uZywgY2hhcin2CHJzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjphcHBlbmQodW5zaWduZWQgbG9uZywgY2hhcin3CHRzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpfX2VyYXNlX3RvX2VuZCh1bnNpZ25lZCBsb25nKfgIugFzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpfX2dyb3dfYnkodW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZyn5CD9zdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj46OmFzc2lnbihjaGFyKiwgdW5zaWduZWQgbG9uZywgY2hhcin6CHlzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjphcHBlbmQoY2hhciBjb25zdCosIHVuc2lnbmVkIGxvbmcp+whmc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6cHVzaF9iYWNrKGNoYXIp/Ahyc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6X19pbml0KHVuc2lnbmVkIGxvbmcsIGNoYXIp/QiFAXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID46Ol9faW5pdCh3Y2hhcl90IGNvbnN0KiwgdW5zaWduZWQgbG9uZyn+CIUBc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6YXNzaWduKHdjaGFyX3QgY29uc3QqLCB1bnNpZ25lZCBsb25nKf8I3wFzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+OjpfX2dyb3dfYnlfYW5kX3JlcGxhY2UodW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgd2NoYXJfdCBjb25zdCopgAnDAXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID46Ol9fZ3Jvd19ieSh1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nKYEJhQFzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+OjphcHBlbmQod2NoYXJfdCBjb25zdCosIHVuc2lnbmVkIGxvbmcpgglyc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6cHVzaF9iYWNrKHdjaGFyX3Qpgwl+c3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6X19pbml0KHVuc2lnbmVkIGxvbmcsIHdjaGFyX3QphAlCc3RkOjpfXzI6Ol9fdmVjdG9yX2Jhc2VfY29tbW9uPHRydWU+OjpfX3Rocm93X2xlbmd0aF9lcnJvcigpIGNvbnN0hQkNYWJvcnRfbWVzc2FnZYYJEl9fY3hhX3B1cmVfdmlydHVhbIcJHHN0ZDo6ZXhjZXB0aW9uOjp3aGF0KCkgY29uc3SICSBzdGQ6OmxvZ2ljX2Vycm9yOjp+bG9naWNfZXJyb3IoKYkJM3N0ZDo6X18yOjpfX2xpYmNwcF9yZWZzdHJpbmc6On5fX2xpYmNwcF9yZWZzdHJpbmcoKYoJInN0ZDo6bG9naWNfZXJyb3I6On5sb2dpY19lcnJvcigpLjGLCSJzdGQ6Omxlbmd0aF9lcnJvcjo6fmxlbmd0aF9lcnJvcigpjAkbc3RkOjpiYWRfY2FzdDo6d2hhdCgpIGNvbnN0jQlhX19jeHhhYml2MTo6X19mdW5kYW1lbnRhbF90eXBlX2luZm86OmNhbl9jYXRjaChfX2N4eGFiaXYxOjpfX3NoaW1fdHlwZV9pbmZvIGNvbnN0Kiwgdm9pZComKSBjb25zdI4JPGlzX2VxdWFsKHN0ZDo6dHlwZV9pbmZvIGNvbnN0Kiwgc3RkOjp0eXBlX2luZm8gY29uc3QqLCBib29sKY8JW19fY3h4YWJpdjE6Ol9fY2xhc3NfdHlwZV9pbmZvOjpjYW5fY2F0Y2goX19jeHhhYml2MTo6X19zaGltX3R5cGVfaW5mbyBjb25zdCosIHZvaWQqJikgY29uc3SQCQ5fX2R5bmFtaWNfY2FzdJEJa19fY3h4YWJpdjE6Ol9fY2xhc3NfdHlwZV9pbmZvOjpwcm9jZXNzX2ZvdW5kX2Jhc2VfY2xhc3MoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQqLCBpbnQpIGNvbnN0kgluX19jeHhhYml2MTo6X19jbGFzc190eXBlX2luZm86Omhhc191bmFtYmlndW91c19wdWJsaWNfYmFzZShfX2N4eGFiaXYxOjpfX2R5bmFtaWNfY2FzdF9pbmZvKiwgdm9pZCosIGludCkgY29uc3STCXFfX2N4eGFiaXYxOjpfX3NpX2NsYXNzX3R5cGVfaW5mbzo6aGFzX3VuYW1iaWd1b3VzX3B1YmxpY19iYXNlKF9fY3h4YWJpdjE6Ol9fZHluYW1pY19jYXN0X2luZm8qLCB2b2lkKiwgaW50KSBjb25zdJQJc19fY3h4YWJpdjE6Ol9fYmFzZV9jbGFzc190eXBlX2luZm86Omhhc191bmFtYmlndW91c19wdWJsaWNfYmFzZShfX2N4eGFiaXYxOjpfX2R5bmFtaWNfY2FzdF9pbmZvKiwgdm9pZCosIGludCkgY29uc3SVCXJfX2N4eGFiaXYxOjpfX3ZtaV9jbGFzc190eXBlX2luZm86Omhhc191bmFtYmlndW91c19wdWJsaWNfYmFzZShfX2N4eGFiaXYxOjpfX2R5bmFtaWNfY2FzdF9pbmZvKiwgdm9pZCosIGludCkgY29uc3SWCVtfX2N4eGFiaXYxOjpfX3BiYXNlX3R5cGVfaW5mbzo6Y2FuX2NhdGNoKF9fY3h4YWJpdjE6Ol9fc2hpbV90eXBlX2luZm8gY29uc3QqLCB2b2lkKiYpIGNvbnN0lwldX19jeHhhYml2MTo6X19wb2ludGVyX3R5cGVfaW5mbzo6Y2FuX2NhdGNoKF9fY3h4YWJpdjE6Ol9fc2hpbV90eXBlX2luZm8gY29uc3QqLCB2b2lkKiYpIGNvbnN0mAlcX19jeHhhYml2MTo6X19wb2ludGVyX3R5cGVfaW5mbzo6Y2FuX2NhdGNoX25lc3RlZChfX2N4eGFiaXYxOjpfX3NoaW1fdHlwZV9pbmZvIGNvbnN0KikgY29uc3SZCWZfX2N4eGFiaXYxOjpfX3BvaW50ZXJfdG9fbWVtYmVyX3R5cGVfaW5mbzo6Y2FuX2NhdGNoX25lc3RlZChfX2N4eGFiaXYxOjpfX3NoaW1fdHlwZV9pbmZvIGNvbnN0KikgY29uc3SaCYMBX19jeHhhYml2MTo6X19jbGFzc190eXBlX2luZm86OnByb2Nlc3Nfc3RhdGljX3R5cGVfYWJvdmVfZHN0KF9fY3h4YWJpdjE6Ol9fZHluYW1pY19jYXN0X2luZm8qLCB2b2lkIGNvbnN0Kiwgdm9pZCBjb25zdCosIGludCkgY29uc3SbCXNfX2N4eGFiaXYxOjpfX3ZtaV9jbGFzc190eXBlX2luZm86OnNlYXJjaF9iZWxvd19kc3QoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQgY29uc3QqLCBpbnQsIGJvb2wpIGNvbnN0nAmBAV9fY3h4YWJpdjE6Ol9fYmFzZV9jbGFzc190eXBlX2luZm86OnNlYXJjaF9hYm92ZV9kc3QoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQgY29uc3QqLCB2b2lkIGNvbnN0KiwgaW50LCBib29sKSBjb25zdJ0JdF9fY3h4YWJpdjE6Ol9fYmFzZV9jbGFzc190eXBlX2luZm86OnNlYXJjaF9iZWxvd19kc3QoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQgY29uc3QqLCBpbnQsIGJvb2wpIGNvbnN0nglyX19jeHhhYml2MTo6X19zaV9jbGFzc190eXBlX2luZm86OnNlYXJjaF9iZWxvd19kc3QoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQgY29uc3QqLCBpbnQsIGJvb2wpIGNvbnN0nwlvX19jeHhhYml2MTo6X19jbGFzc190eXBlX2luZm86OnNlYXJjaF9iZWxvd19kc3QoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQgY29uc3QqLCBpbnQsIGJvb2wpIGNvbnN0oAmAAV9fY3h4YWJpdjE6Ol9fdm1pX2NsYXNzX3R5cGVfaW5mbzo6c2VhcmNoX2Fib3ZlX2RzdChfX2N4eGFiaXYxOjpfX2R5bmFtaWNfY2FzdF9pbmZvKiwgdm9pZCBjb25zdCosIHZvaWQgY29uc3QqLCBpbnQsIGJvb2wpIGNvbnN0oQl/X19jeHhhYml2MTo6X19zaV9jbGFzc190eXBlX2luZm86OnNlYXJjaF9hYm92ZV9kc3QoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQgY29uc3QqLCB2b2lkIGNvbnN0KiwgaW50LCBib29sKSBjb25zdKIJfF9fY3h4YWJpdjE6Ol9fY2xhc3NfdHlwZV9pbmZvOjpzZWFyY2hfYWJvdmVfZHN0KF9fY3h4YWJpdjE6Ol9fZHluYW1pY19jYXN0X2luZm8qLCB2b2lkIGNvbnN0Kiwgdm9pZCBjb25zdCosIGludCwgYm9vbCkgY29uc3SjCQhfX3N0cmR1cKQJDV9fZ2V0VHlwZU5hbWWlCSpfX2VtYmluZF9yZWdpc3Rlcl9uYXRpdmVfYW5kX2J1aWx0aW5fdHlwZXOmCT92b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfaW50ZWdlcjxjaGFyPihjaGFyIGNvbnN0KimnCUZ2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfaW50ZWdlcjxzaWduZWQgY2hhcj4oY2hhciBjb25zdCopqAlIdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX2ludGVnZXI8dW5zaWduZWQgY2hhcj4oY2hhciBjb25zdCopqQlAdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX2ludGVnZXI8c2hvcnQ+KGNoYXIgY29uc3QqKaoJSXZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9pbnRlZ2VyPHVuc2lnbmVkIHNob3J0PihjaGFyIGNvbnN0KimrCT52b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfaW50ZWdlcjxpbnQ+KGNoYXIgY29uc3QqKawJR3ZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9pbnRlZ2VyPHVuc2lnbmVkIGludD4oY2hhciBjb25zdCoprQk/dm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX2ludGVnZXI8bG9uZz4oY2hhciBjb25zdCoprglIdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX2ludGVnZXI8dW5zaWduZWQgbG9uZz4oY2hhciBjb25zdCoprwk+dm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX2Zsb2F0PGZsb2F0PihjaGFyIGNvbnN0KimwCT92b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfZmxvYXQ8ZG91YmxlPihjaGFyIGNvbnN0KimxCUN2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfbWVtb3J5X3ZpZXc8Y2hhcj4oY2hhciBjb25zdCopsglKdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX21lbW9yeV92aWV3PHNpZ25lZCBjaGFyPihjaGFyIGNvbnN0KimzCUx2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfbWVtb3J5X3ZpZXc8dW5zaWduZWQgY2hhcj4oY2hhciBjb25zdCoptAlEdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX21lbW9yeV92aWV3PHNob3J0PihjaGFyIGNvbnN0Kim1CU12b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfbWVtb3J5X3ZpZXc8dW5zaWduZWQgc2hvcnQ+KGNoYXIgY29uc3QqKbYJQnZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9tZW1vcnlfdmlldzxpbnQ+KGNoYXIgY29uc3QqKbcJS3ZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9tZW1vcnlfdmlldzx1bnNpZ25lZCBpbnQ+KGNoYXIgY29uc3QqKbgJQ3ZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9tZW1vcnlfdmlldzxsb25nPihjaGFyIGNvbnN0Kim5CUx2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfbWVtb3J5X3ZpZXc8dW5zaWduZWQgbG9uZz4oY2hhciBjb25zdCopuglEdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX21lbW9yeV92aWV3PGZsb2F0PihjaGFyIGNvbnN0Kim7CUV2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfbWVtb3J5X3ZpZXc8ZG91YmxlPihjaGFyIGNvbnN0Kim8CW5FbXNjcmlwdGVuQmluZGluZ0luaXRpYWxpemVyX25hdGl2ZV9hbmRfYnVpbHRpbl90eXBlczo6RW1zY3JpcHRlbkJpbmRpbmdJbml0aWFsaXplcl9uYXRpdmVfYW5kX2J1aWx0aW5fdHlwZXMoKb0JCGRsbWFsbG9jvgkGZGxmcmVlvwkJZGxyZWFsbG9jwAkRdHJ5X3JlYWxsb2NfY2h1bmvBCQ1kaXNwb3NlX2NodW5rwgkEc2Jya8MJBGZtb2TECQVmbW9kbMUJBWxvZzEwxgkGbG9nMTBmxwkGc2NhbGJuyAkNX19mcGNsYXNzaWZ5bMkJBm1lbWNwecoJBm1lbXNldMsJB21lbW1vdmXMCQhzZXRUaHJld80JCXN0YWNrU2F2Zc4JCnN0YWNrQWxsb2PPCQxzdGFja1Jlc3RvcmXQCRBfX2dyb3dXYXNtTWVtb3J50QkLZHluQ2FsbF92aWnSCQ1keW5DYWxsX3ZpaWlp0wkLZHluQ2FsbF9kaWTUCQxkeW5DYWxsX2RpaWTVCQ1keW5DYWxsX2RpZGRk1gkOZHluQ2FsbF9kaWlkZGTXCQxkeW5DYWxsX2RpZGTYCQ1keW5DYWxsX2RpaWRk2QkLZHluQ2FsbF9kaWnaCQtkeW5DYWxsX3ZpZNsJDGR5bkNhbGxfdmlpZNwJDGR5bkNhbGxfZGlpad0JDWR5bkNhbGxfZGlpaWneCQ1keW5DYWxsX3ZpaWlk3wkNZHluQ2FsbF9kaWRpZOAJDmR5bkNhbGxfZGlpZGlk4QkOZHluQ2FsbF9kaWRpZGniCQ9keW5DYWxsX2RpaWRpZGnjCQ1keW5DYWxsX3ZpZGlk5AkOZHluQ2FsbF92aWlkaWTlCQ5keW5DYWxsX3ZpZGlkZOYJD2R5bkNhbGxfdmlpZGlkZOcJD2R5bkNhbGxfdmlkaWRkZOgJEGR5bkNhbGxfdmlpZGlkZGTpCQ5keW5DYWxsX3ZpZGRkaeoJD2R5bkNhbGxfdmlpZGRkaesJDWR5bkNhbGxfaWlpaWTsCQxkeW5DYWxsX3ZpZGTtCQ1keW5DYWxsX3ZpaWRk7gkNZHluQ2FsbF9paWlpae8JDmR5bkNhbGxfdmlmZmlp8AkPZHluQ2FsbF92aWlmZmlp8QkPZHluQ2FsbF9kaWRkaWRk8gkQZHluQ2FsbF9kaWlkZGlkZPMJD2R5bkNhbGxfZGlkZGRkZPQJEGR5bkNhbGxfZGlpZGRkZGT1CQ9keW5DYWxsX2RpZGRkaWn2CRBkeW5DYWxsX2RpaWRkZGlp9wkRZHluQ2FsbF9kaWRkZGRkaWn4CRJkeW5DYWxsX2RpaWRkZGRkaWn5CQxkeW5DYWxsX2RpZGn6CQ1keW5DYWxsX2RpaWRp+wkPZHluQ2FsbF9kaWRpZGRk/AkQZHluQ2FsbF9kaWlkaWRkZP0JDWR5bkNhbGxfZGlkZGn+CQ5keW5DYWxsX2RpaWRkaf8JDGR5bkNhbGxfdmlkaYAKDWR5bkNhbGxfdmlpZGmBCg5keW5DYWxsX3ZpaWlpaYIKDGR5bkNhbGxfaWlmaYMKDWR5bkNhbGxfaWlpZmmECgpkeW5DYWxsX2ZphQoLZHluQ2FsbF9maWmGCg1keW5DYWxsX2ZpaWlphwoOZHluQ2FsbF9maWlpaWmICg9keW5DYWxsX3ZpaWlpZGSJChBkeW5DYWxsX3ZpaWlpaWRkigoMZHluQ2FsbF92aWlmiwoNZHluQ2FsbF92aWlpZowKDWR5bkNhbGxfaWlpaWaNCg5keW5DYWxsX2RpZGRpZI4KD2R5bkNhbGxfZGlpZGRpZI8KD2R5bkNhbGxfZGlkZGRpZJAKEGR5bkNhbGxfZGlpZGRkaWSRCg5keW5DYWxsX2RpZGRkaZIKD2R5bkNhbGxfZGlpZGRkaZMKC2R5bkNhbGxfaWlklAoNZHluQ2FsbF9kaWRpaZUKDmR5bkNhbGxfZGlpZGlplgoPZHluQ2FsbF9paWRpaWlplwoOZHluQ2FsbF9paWlpaWmYChFkeW5DYWxsX2lpaWlpaWlpaZkKD2R5bkNhbGxfaWlpaWlpaZoKDmR5bkNhbGxfaWlpaWlkmwoQZHluQ2FsbF9paWlpaWlpaZwKD2R5bkNhbGxfdmlpaWlpaZ0KCWR5bkNhbGxfdp4KGGxlZ2Fsc3R1YiRkeW5DYWxsX3ZpaWppaZ8KFmxlZ2Fsc3R1YiRkeW5DYWxsX2ppammgChhsZWdhbHN0dWIkZHluQ2FsbF9paWlpaWqhChlsZWdhbHN0dWIkZHluQ2FsbF9paWlpaWpqogoabGVnYWxzdHViJGR5bkNhbGxfaWlpaWlpamoAdRBzb3VyY2VNYXBwaW5nVVJMY2h0dHA6Ly9sb2NhbGhvc3Q6OTAwMC9hdWRpby13b3JrbGV0L2J1aWxkL3t7eyBGSUxFTkFNRV9SRVBMQUNFTUVOVF9TVFJJTkdTX1dBU01fQklOQVJZX0ZJTEUgfX19Lm1hcA==';
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




// STATICTOP = STATIC_BASE + 52880;
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

  function ___assert_fail(condition, filename, line, func) {
      abort('Assertion failed: ' + UTF8ToString(condition) + ', at: ' + [filename ? UTF8ToString(filename) : 'unknown filename', line, func ? UTF8ToString(func) : 'unknown function']);
    }

  function ___cxa_allocate_exception(size) {
      return _malloc(size);
    }

  
  function _atexit(func, arg) {
      __ATEXIT__.unshift({ func: func, arg: arg });
    }function ___cxa_atexit(
  ) {
  return _atexit.apply(null, arguments)
  }

  
  var ___exception_infos={};
  
  var ___exception_last=0;function ___cxa_throw(ptr, type, destructor) {
      ___exception_infos[ptr] = {
        ptr: ptr,
        adjusted: [ptr],
        type: type,
        destructor: destructor,
        refcount: 0,
        caught: false,
        rethrown: false
      };
      ___exception_last = ptr;
      if (!("uncaught_exception" in __ZSt18uncaught_exceptionv)) {
        __ZSt18uncaught_exceptionv.uncaught_exceptions = 1;
      } else {
        __ZSt18uncaught_exceptionv.uncaught_exceptions++;
      }
      throw ptr;
    }

  function ___lock() {}

  
  function ___setErrNo(value) {
      if (Module['___errno_location']) HEAP32[((Module['___errno_location']())>>2)]=value;
      return value;
    }function ___map_file(pathname, size) {
      ___setErrNo(63);
      return -1;
    }

  
  
  var PATH={splitPath:function(filename) {
        var splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
        return splitPathRe.exec(filename).slice(1);
      },normalizeArray:function(parts, allowAboveRoot) {
        // if the path tries to go above the root, `up` ends up > 0
        var up = 0;
        for (var i = parts.length - 1; i >= 0; i--) {
          var last = parts[i];
          if (last === '.') {
            parts.splice(i, 1);
          } else if (last === '..') {
            parts.splice(i, 1);
            up++;
          } else if (up) {
            parts.splice(i, 1);
            up--;
          }
        }
        // if the path is allowed to go above the root, restore leading ..s
        if (allowAboveRoot) {
          for (; up; up--) {
            parts.unshift('..');
          }
        }
        return parts;
      },normalize:function(path) {
        var isAbsolute = path.charAt(0) === '/',
            trailingSlash = path.substr(-1) === '/';
        // Normalize the path
        path = PATH.normalizeArray(path.split('/').filter(function(p) {
          return !!p;
        }), !isAbsolute).join('/');
        if (!path && !isAbsolute) {
          path = '.';
        }
        if (path && trailingSlash) {
          path += '/';
        }
        return (isAbsolute ? '/' : '') + path;
      },dirname:function(path) {
        var result = PATH.splitPath(path),
            root = result[0],
            dir = result[1];
        if (!root && !dir) {
          // No dirname whatsoever
          return '.';
        }
        if (dir) {
          // It has a dirname, strip trailing slash
          dir = dir.substr(0, dir.length - 1);
        }
        return root + dir;
      },basename:function(path) {
        // EMSCRIPTEN return '/'' for '/', not an empty string
        if (path === '/') return '/';
        var lastSlash = path.lastIndexOf('/');
        if (lastSlash === -1) return path;
        return path.substr(lastSlash+1);
      },extname:function(path) {
        return PATH.splitPath(path)[3];
      },join:function() {
        var paths = Array.prototype.slice.call(arguments, 0);
        return PATH.normalize(paths.join('/'));
      },join2:function(l, r) {
        return PATH.normalize(l + '/' + r);
      }};
  
  
  var PATH_FS={resolve:function() {
        var resolvedPath = '',
          resolvedAbsolute = false;
        for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
          var path = (i >= 0) ? arguments[i] : FS.cwd();
          // Skip empty and invalid entries
          if (typeof path !== 'string') {
            throw new TypeError('Arguments to path.resolve must be strings');
          } else if (!path) {
            return ''; // an invalid portion invalidates the whole thing
          }
          resolvedPath = path + '/' + resolvedPath;
          resolvedAbsolute = path.charAt(0) === '/';
        }
        // At this point the path should be resolved to a full absolute path, but
        // handle relative paths to be safe (might happen when process.cwd() fails)
        resolvedPath = PATH.normalizeArray(resolvedPath.split('/').filter(function(p) {
          return !!p;
        }), !resolvedAbsolute).join('/');
        return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
      },relative:function(from, to) {
        from = PATH_FS.resolve(from).substr(1);
        to = PATH_FS.resolve(to).substr(1);
        function trim(arr) {
          var start = 0;
          for (; start < arr.length; start++) {
            if (arr[start] !== '') break;
          }
          var end = arr.length - 1;
          for (; end >= 0; end--) {
            if (arr[end] !== '') break;
          }
          if (start > end) return [];
          return arr.slice(start, end - start + 1);
        }
        var fromParts = trim(from.split('/'));
        var toParts = trim(to.split('/'));
        var length = Math.min(fromParts.length, toParts.length);
        var samePartsLength = length;
        for (var i = 0; i < length; i++) {
          if (fromParts[i] !== toParts[i]) {
            samePartsLength = i;
            break;
          }
        }
        var outputParts = [];
        for (var i = samePartsLength; i < fromParts.length; i++) {
          outputParts.push('..');
        }
        outputParts = outputParts.concat(toParts.slice(samePartsLength));
        return outputParts.join('/');
      }};
  
  var TTY={ttys:[],init:function () {
        // https://github.com/emscripten-core/emscripten/pull/1555
        // if (ENVIRONMENT_IS_NODE) {
        //   // currently, FS.init does not distinguish if process.stdin is a file or TTY
        //   // device, it always assumes it's a TTY device. because of this, we're forcing
        //   // process.stdin to UTF8 encoding to at least make stdin reading compatible
        //   // with text files until FS.init can be refactored.
        //   process['stdin']['setEncoding']('utf8');
        // }
      },shutdown:function() {
        // https://github.com/emscripten-core/emscripten/pull/1555
        // if (ENVIRONMENT_IS_NODE) {
        //   // inolen: any idea as to why node -e 'process.stdin.read()' wouldn't exit immediately (with process.stdin being a tty)?
        //   // isaacs: because now it's reading from the stream, you've expressed interest in it, so that read() kicks off a _read() which creates a ReadReq operation
        //   // inolen: I thought read() in that case was a synchronous operation that just grabbed some amount of buffered data if it exists?
        //   // isaacs: it is. but it also triggers a _read() call, which calls readStart() on the handle
        //   // isaacs: do process.stdin.pause() and i'd think it'd probably close the pending call
        //   process['stdin']['pause']();
        // }
      },register:function(dev, ops) {
        TTY.ttys[dev] = { input: [], output: [], ops: ops };
        FS.registerDevice(dev, TTY.stream_ops);
      },stream_ops:{open:function(stream) {
          var tty = TTY.ttys[stream.node.rdev];
          if (!tty) {
            throw new FS.ErrnoError(43);
          }
          stream.tty = tty;
          stream.seekable = false;
        },close:function(stream) {
          // flush any pending line data
          stream.tty.ops.flush(stream.tty);
        },flush:function(stream) {
          stream.tty.ops.flush(stream.tty);
        },read:function(stream, buffer, offset, length, pos /* ignored */) {
          if (!stream.tty || !stream.tty.ops.get_char) {
            throw new FS.ErrnoError(60);
          }
          var bytesRead = 0;
          for (var i = 0; i < length; i++) {
            var result;
            try {
              result = stream.tty.ops.get_char(stream.tty);
            } catch (e) {
              throw new FS.ErrnoError(29);
            }
            if (result === undefined && bytesRead === 0) {
              throw new FS.ErrnoError(6);
            }
            if (result === null || result === undefined) break;
            bytesRead++;
            buffer[offset+i] = result;
          }
          if (bytesRead) {
            stream.node.timestamp = Date.now();
          }
          return bytesRead;
        },write:function(stream, buffer, offset, length, pos) {
          if (!stream.tty || !stream.tty.ops.put_char) {
            throw new FS.ErrnoError(60);
          }
          try {
            for (var i = 0; i < length; i++) {
              stream.tty.ops.put_char(stream.tty, buffer[offset+i]);
            }
          } catch (e) {
            throw new FS.ErrnoError(29);
          }
          if (length) {
            stream.node.timestamp = Date.now();
          }
          return i;
        }},default_tty_ops:{get_char:function(tty) {
          if (!tty.input.length) {
            var result = null;
            if (ENVIRONMENT_IS_NODE) {
              // we will read data by chunks of BUFSIZE
              var BUFSIZE = 256;
              var buf = Buffer.alloc ? Buffer.alloc(BUFSIZE) : new Buffer(BUFSIZE);
              var bytesRead = 0;
  
              try {
                bytesRead = nodeFS.readSync(process.stdin.fd, buf, 0, BUFSIZE, null);
              } catch(e) {
                // Cross-platform differences: on Windows, reading EOF throws an exception, but on other OSes,
                // reading EOF returns 0. Uniformize behavior by treating the EOF exception to return 0.
                if (e.toString().indexOf('EOF') != -1) bytesRead = 0;
                else throw e;
              }
  
              if (bytesRead > 0) {
                result = buf.slice(0, bytesRead).toString('utf-8');
              } else {
                result = null;
              }
            } else
            if (typeof window != 'undefined' &&
              typeof window.prompt == 'function') {
              // Browser.
              result = window.prompt('Input: ');  // returns null on cancel
              if (result !== null) {
                result += '\n';
              }
            } else if (typeof readline == 'function') {
              // Command line.
              result = readline();
              if (result !== null) {
                result += '\n';
              }
            }
            if (!result) {
              return null;
            }
            tty.input = intArrayFromString(result, true);
          }
          return tty.input.shift();
        },put_char:function(tty, val) {
          if (val === null || val === 10) {
            out(UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          } else {
            if (val != 0) tty.output.push(val); // val == 0 would cut text output off in the middle.
          }
        },flush:function(tty) {
          if (tty.output && tty.output.length > 0) {
            out(UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          }
        }},default_tty1_ops:{put_char:function(tty, val) {
          if (val === null || val === 10) {
            err(UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          } else {
            if (val != 0) tty.output.push(val);
          }
        },flush:function(tty) {
          if (tty.output && tty.output.length > 0) {
            err(UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          }
        }}};
  
  var MEMFS={ops_table:null,mount:function(mount) {
        return MEMFS.createNode(null, '/', 16384 | 511 /* 0777 */, 0);
      },createNode:function(parent, name, mode, dev) {
        if (FS.isBlkdev(mode) || FS.isFIFO(mode)) {
          // no supported
          throw new FS.ErrnoError(63);
        }
        if (!MEMFS.ops_table) {
          MEMFS.ops_table = {
            dir: {
              node: {
                getattr: MEMFS.node_ops.getattr,
                setattr: MEMFS.node_ops.setattr,
                lookup: MEMFS.node_ops.lookup,
                mknod: MEMFS.node_ops.mknod,
                rename: MEMFS.node_ops.rename,
                unlink: MEMFS.node_ops.unlink,
                rmdir: MEMFS.node_ops.rmdir,
                readdir: MEMFS.node_ops.readdir,
                symlink: MEMFS.node_ops.symlink
              },
              stream: {
                llseek: MEMFS.stream_ops.llseek
              }
            },
            file: {
              node: {
                getattr: MEMFS.node_ops.getattr,
                setattr: MEMFS.node_ops.setattr
              },
              stream: {
                llseek: MEMFS.stream_ops.llseek,
                read: MEMFS.stream_ops.read,
                write: MEMFS.stream_ops.write,
                allocate: MEMFS.stream_ops.allocate,
                mmap: MEMFS.stream_ops.mmap,
                msync: MEMFS.stream_ops.msync
              }
            },
            link: {
              node: {
                getattr: MEMFS.node_ops.getattr,
                setattr: MEMFS.node_ops.setattr,
                readlink: MEMFS.node_ops.readlink
              },
              stream: {}
            },
            chrdev: {
              node: {
                getattr: MEMFS.node_ops.getattr,
                setattr: MEMFS.node_ops.setattr
              },
              stream: FS.chrdev_stream_ops
            }
          };
        }
        var node = FS.createNode(parent, name, mode, dev);
        if (FS.isDir(node.mode)) {
          node.node_ops = MEMFS.ops_table.dir.node;
          node.stream_ops = MEMFS.ops_table.dir.stream;
          node.contents = {};
        } else if (FS.isFile(node.mode)) {
          node.node_ops = MEMFS.ops_table.file.node;
          node.stream_ops = MEMFS.ops_table.file.stream;
          node.usedBytes = 0; // The actual number of bytes used in the typed array, as opposed to contents.length which gives the whole capacity.
          // When the byte data of the file is populated, this will point to either a typed array, or a normal JS array. Typed arrays are preferred
          // for performance, and used by default. However, typed arrays are not resizable like normal JS arrays are, so there is a small disk size
          // penalty involved for appending file writes that continuously grow a file similar to std::vector capacity vs used -scheme.
          node.contents = null; 
        } else if (FS.isLink(node.mode)) {
          node.node_ops = MEMFS.ops_table.link.node;
          node.stream_ops = MEMFS.ops_table.link.stream;
        } else if (FS.isChrdev(node.mode)) {
          node.node_ops = MEMFS.ops_table.chrdev.node;
          node.stream_ops = MEMFS.ops_table.chrdev.stream;
        }
        node.timestamp = Date.now();
        // add the new node to the parent
        if (parent) {
          parent.contents[name] = node;
        }
        return node;
      },getFileDataAsRegularArray:function(node) {
        if (node.contents && node.contents.subarray) {
          var arr = [];
          for (var i = 0; i < node.usedBytes; ++i) arr.push(node.contents[i]);
          return arr; // Returns a copy of the original data.
        }
        return node.contents; // No-op, the file contents are already in a JS array. Return as-is.
      },getFileDataAsTypedArray:function(node) {
        if (!node.contents) return new Uint8Array;
        if (node.contents.subarray) return node.contents.subarray(0, node.usedBytes); // Make sure to not return excess unused bytes.
        return new Uint8Array(node.contents);
      },expandFileStorage:function(node, newCapacity) {
        var prevCapacity = node.contents ? node.contents.length : 0;
        if (prevCapacity >= newCapacity) return; // No need to expand, the storage was already large enough.
        // Don't expand strictly to the given requested limit if it's only a very small increase, but instead geometrically grow capacity.
        // For small filesizes (<1MB), perform size*2 geometric increase, but for large sizes, do a much more conservative size*1.125 increase to
        // avoid overshooting the allocation cap by a very large margin.
        var CAPACITY_DOUBLING_MAX = 1024 * 1024;
        newCapacity = Math.max(newCapacity, (prevCapacity * (prevCapacity < CAPACITY_DOUBLING_MAX ? 2.0 : 1.125)) | 0);
        if (prevCapacity != 0) newCapacity = Math.max(newCapacity, 256); // At minimum allocate 256b for each file when expanding.
        var oldContents = node.contents;
        node.contents = new Uint8Array(newCapacity); // Allocate new storage.
        if (node.usedBytes > 0) node.contents.set(oldContents.subarray(0, node.usedBytes), 0); // Copy old data over to the new storage.
        return;
      },resizeFileStorage:function(node, newSize) {
        if (node.usedBytes == newSize) return;
        if (newSize == 0) {
          node.contents = null; // Fully decommit when requesting a resize to zero.
          node.usedBytes = 0;
          return;
        }
        if (!node.contents || node.contents.subarray) { // Resize a typed array if that is being used as the backing store.
          var oldContents = node.contents;
          node.contents = new Uint8Array(newSize); // Allocate new storage.
          if (oldContents) {
            node.contents.set(oldContents.subarray(0, Math.min(newSize, node.usedBytes))); // Copy old data over to the new storage.
          }
          node.usedBytes = newSize;
          return;
        }
        // Backing with a JS array.
        if (!node.contents) node.contents = [];
        if (node.contents.length > newSize) node.contents.length = newSize;
        else while (node.contents.length < newSize) node.contents.push(0);
        node.usedBytes = newSize;
      },node_ops:{getattr:function(node) {
          var attr = {};
          // device numbers reuse inode numbers.
          attr.dev = FS.isChrdev(node.mode) ? node.id : 1;
          attr.ino = node.id;
          attr.mode = node.mode;
          attr.nlink = 1;
          attr.uid = 0;
          attr.gid = 0;
          attr.rdev = node.rdev;
          if (FS.isDir(node.mode)) {
            attr.size = 4096;
          } else if (FS.isFile(node.mode)) {
            attr.size = node.usedBytes;
          } else if (FS.isLink(node.mode)) {
            attr.size = node.link.length;
          } else {
            attr.size = 0;
          }
          attr.atime = new Date(node.timestamp);
          attr.mtime = new Date(node.timestamp);
          attr.ctime = new Date(node.timestamp);
          // NOTE: In our implementation, st_blocks = Math.ceil(st_size/st_blksize),
          //       but this is not required by the standard.
          attr.blksize = 4096;
          attr.blocks = Math.ceil(attr.size / attr.blksize);
          return attr;
        },setattr:function(node, attr) {
          if (attr.mode !== undefined) {
            node.mode = attr.mode;
          }
          if (attr.timestamp !== undefined) {
            node.timestamp = attr.timestamp;
          }
          if (attr.size !== undefined) {
            MEMFS.resizeFileStorage(node, attr.size);
          }
        },lookup:function(parent, name) {
          throw FS.genericErrors[44];
        },mknod:function(parent, name, mode, dev) {
          return MEMFS.createNode(parent, name, mode, dev);
        },rename:function(old_node, new_dir, new_name) {
          // if we're overwriting a directory at new_name, make sure it's empty.
          if (FS.isDir(old_node.mode)) {
            var new_node;
            try {
              new_node = FS.lookupNode(new_dir, new_name);
            } catch (e) {
            }
            if (new_node) {
              for (var i in new_node.contents) {
                throw new FS.ErrnoError(55);
              }
            }
          }
          // do the internal rewiring
          delete old_node.parent.contents[old_node.name];
          old_node.name = new_name;
          new_dir.contents[new_name] = old_node;
          old_node.parent = new_dir;
        },unlink:function(parent, name) {
          delete parent.contents[name];
        },rmdir:function(parent, name) {
          var node = FS.lookupNode(parent, name);
          for (var i in node.contents) {
            throw new FS.ErrnoError(55);
          }
          delete parent.contents[name];
        },readdir:function(node) {
          var entries = ['.', '..'];
          for (var key in node.contents) {
            if (!node.contents.hasOwnProperty(key)) {
              continue;
            }
            entries.push(key);
          }
          return entries;
        },symlink:function(parent, newname, oldpath) {
          var node = MEMFS.createNode(parent, newname, 511 /* 0777 */ | 40960, 0);
          node.link = oldpath;
          return node;
        },readlink:function(node) {
          if (!FS.isLink(node.mode)) {
            throw new FS.ErrnoError(28);
          }
          return node.link;
        }},stream_ops:{read:function(stream, buffer, offset, length, position) {
          var contents = stream.node.contents;
          if (position >= stream.node.usedBytes) return 0;
          var size = Math.min(stream.node.usedBytes - position, length);
          if (size > 8 && contents.subarray) { // non-trivial, and typed array
            buffer.set(contents.subarray(position, position + size), offset);
          } else {
            for (var i = 0; i < size; i++) buffer[offset + i] = contents[position + i];
          }
          return size;
        },write:function(stream, buffer, offset, length, position, canOwn) {
          // If the buffer is located in main memory (HEAP), and if
          // memory can grow, we can't hold on to references of the
          // memory buffer, as they may get invalidated. That means we
          // need to do copy its contents.
          if (buffer.buffer === HEAP8.buffer) {
            canOwn = false;
          }
  
          if (!length) return 0;
          var node = stream.node;
          node.timestamp = Date.now();
  
          if (buffer.subarray && (!node.contents || node.contents.subarray)) { // This write is from a typed array to a typed array?
            if (canOwn) {
              node.contents = buffer.subarray(offset, offset + length);
              node.usedBytes = length;
              return length;
            } else if (node.usedBytes === 0 && position === 0) { // If this is a simple first write to an empty file, do a fast set since we don't need to care about old data.
              node.contents = buffer.slice(offset, offset + length);
              node.usedBytes = length;
              return length;
            } else if (position + length <= node.usedBytes) { // Writing to an already allocated and used subrange of the file?
              node.contents.set(buffer.subarray(offset, offset + length), position);
              return length;
            }
          }
  
          // Appending to an existing file and we need to reallocate, or source data did not come as a typed array.
          MEMFS.expandFileStorage(node, position+length);
          if (node.contents.subarray && buffer.subarray) node.contents.set(buffer.subarray(offset, offset + length), position); // Use typed array write if available.
          else {
            for (var i = 0; i < length; i++) {
             node.contents[position + i] = buffer[offset + i]; // Or fall back to manual write if not.
            }
          }
          node.usedBytes = Math.max(node.usedBytes, position+length);
          return length;
        },llseek:function(stream, offset, whence) {
          var position = offset;
          if (whence === 1) {
            position += stream.position;
          } else if (whence === 2) {
            if (FS.isFile(stream.node.mode)) {
              position += stream.node.usedBytes;
            }
          }
          if (position < 0) {
            throw new FS.ErrnoError(28);
          }
          return position;
        },allocate:function(stream, offset, length) {
          MEMFS.expandFileStorage(stream.node, offset + length);
          stream.node.usedBytes = Math.max(stream.node.usedBytes, offset + length);
        },mmap:function(stream, buffer, offset, length, position, prot, flags) {
          if (!FS.isFile(stream.node.mode)) {
            throw new FS.ErrnoError(43);
          }
          var ptr;
          var allocated;
          var contents = stream.node.contents;
          // Only make a new copy when MAP_PRIVATE is specified.
          if ( !(flags & 2) &&
                contents.buffer === buffer.buffer ) {
            // We can't emulate MAP_SHARED when the file is not backed by the buffer
            // we're mapping to (e.g. the HEAP buffer).
            allocated = false;
            ptr = contents.byteOffset;
          } else {
            // Try to avoid unnecessary slices.
            if (position > 0 || position + length < stream.node.usedBytes) {
              if (contents.subarray) {
                contents = contents.subarray(position, position + length);
              } else {
                contents = Array.prototype.slice.call(contents, position, position + length);
              }
            }
            allocated = true;
            // malloc() can lead to growing the heap. If targeting the heap, we need to
            // re-acquire the heap buffer object in case growth had occurred.
            var fromHeap = (buffer.buffer == HEAP8.buffer);
            ptr = _malloc(length);
            if (!ptr) {
              throw new FS.ErrnoError(48);
            }
            (fromHeap ? HEAP8 : buffer).set(contents, ptr);
          }
          return { ptr: ptr, allocated: allocated };
        },msync:function(stream, buffer, offset, length, mmapFlags) {
          if (!FS.isFile(stream.node.mode)) {
            throw new FS.ErrnoError(43);
          }
          if (mmapFlags & 2) {
            // MAP_PRIVATE calls need not to be synced back to underlying fs
            return 0;
          }
  
          var bytesWritten = MEMFS.stream_ops.write(stream, buffer, 0, length, offset, false);
          // should we check if bytesWritten and length are the same?
          return 0;
        }}};var FS={root:null,mounts:[],devices:{},streams:[],nextInode:1,nameTable:null,currentPath:"/",initialized:false,ignorePermissions:true,trackingDelegate:{},tracking:{openFlags:{READ:1,WRITE:2}},ErrnoError:null,genericErrors:{},filesystems:null,syncFSRequests:0,handleFSError:function(e) {
        if (!(e instanceof FS.ErrnoError)) throw e + ' : ' + stackTrace();
        return ___setErrNo(e.errno);
      },lookupPath:function(path, opts) {
        path = PATH_FS.resolve(FS.cwd(), path);
        opts = opts || {};
  
        if (!path) return { path: '', node: null };
  
        var defaults = {
          follow_mount: true,
          recurse_count: 0
        };
        for (var key in defaults) {
          if (opts[key] === undefined) {
            opts[key] = defaults[key];
          }
        }
  
        if (opts.recurse_count > 8) {  // max recursive lookup of 8
          throw new FS.ErrnoError(32);
        }
  
        // split the path
        var parts = PATH.normalizeArray(path.split('/').filter(function(p) {
          return !!p;
        }), false);
  
        // start at the root
        var current = FS.root;
        var current_path = '/';
  
        for (var i = 0; i < parts.length; i++) {
          var islast = (i === parts.length-1);
          if (islast && opts.parent) {
            // stop resolving
            break;
          }
  
          current = FS.lookupNode(current, parts[i]);
          current_path = PATH.join2(current_path, parts[i]);
  
          // jump to the mount's root node if this is a mountpoint
          if (FS.isMountpoint(current)) {
            if (!islast || (islast && opts.follow_mount)) {
              current = current.mounted.root;
            }
          }
  
          // by default, lookupPath will not follow a symlink if it is the final path component.
          // setting opts.follow = true will override this behavior.
          if (!islast || opts.follow) {
            var count = 0;
            while (FS.isLink(current.mode)) {
              var link = FS.readlink(current_path);
              current_path = PATH_FS.resolve(PATH.dirname(current_path), link);
  
              var lookup = FS.lookupPath(current_path, { recurse_count: opts.recurse_count });
              current = lookup.node;
  
              if (count++ > 40) {  // limit max consecutive symlinks to 40 (SYMLOOP_MAX).
                throw new FS.ErrnoError(32);
              }
            }
          }
        }
  
        return { path: current_path, node: current };
      },getPath:function(node) {
        var path;
        while (true) {
          if (FS.isRoot(node)) {
            var mount = node.mount.mountpoint;
            if (!path) return mount;
            return mount[mount.length-1] !== '/' ? mount + '/' + path : mount + path;
          }
          path = path ? node.name + '/' + path : node.name;
          node = node.parent;
        }
      },hashName:function(parentid, name) {
        var hash = 0;
  
  
        for (var i = 0; i < name.length; i++) {
          hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
        }
        return ((parentid + hash) >>> 0) % FS.nameTable.length;
      },hashAddNode:function(node) {
        var hash = FS.hashName(node.parent.id, node.name);
        node.name_next = FS.nameTable[hash];
        FS.nameTable[hash] = node;
      },hashRemoveNode:function(node) {
        var hash = FS.hashName(node.parent.id, node.name);
        if (FS.nameTable[hash] === node) {
          FS.nameTable[hash] = node.name_next;
        } else {
          var current = FS.nameTable[hash];
          while (current) {
            if (current.name_next === node) {
              current.name_next = node.name_next;
              break;
            }
            current = current.name_next;
          }
        }
      },lookupNode:function(parent, name) {
        var errCode = FS.mayLookup(parent);
        if (errCode) {
          throw new FS.ErrnoError(errCode, parent);
        }
        var hash = FS.hashName(parent.id, name);
        for (var node = FS.nameTable[hash]; node; node = node.name_next) {
          var nodeName = node.name;
          if (node.parent.id === parent.id && nodeName === name) {
            return node;
          }
        }
        // if we failed to find it in the cache, call into the VFS
        return FS.lookup(parent, name);
      },createNode:function(parent, name, mode, rdev) {
        if (!FS.FSNode) {
          FS.FSNode = function(parent, name, mode, rdev) {
            if (!parent) {
              parent = this;  // root node sets parent to itself
            }
            this.parent = parent;
            this.mount = parent.mount;
            this.mounted = null;
            this.id = FS.nextInode++;
            this.name = name;
            this.mode = mode;
            this.node_ops = {};
            this.stream_ops = {};
            this.rdev = rdev;
          };
  
          FS.FSNode.prototype = {};
  
          // compatibility
          var readMode = 292 | 73;
          var writeMode = 146;
  
          // NOTE we must use Object.defineProperties instead of individual calls to
          // Object.defineProperty in order to make closure compiler happy
          Object.defineProperties(FS.FSNode.prototype, {
            read: {
              get: function() { return (this.mode & readMode) === readMode; },
              set: function(val) { val ? this.mode |= readMode : this.mode &= ~readMode; }
            },
            write: {
              get: function() { return (this.mode & writeMode) === writeMode; },
              set: function(val) { val ? this.mode |= writeMode : this.mode &= ~writeMode; }
            },
            isFolder: {
              get: function() { return FS.isDir(this.mode); }
            },
            isDevice: {
              get: function() { return FS.isChrdev(this.mode); }
            }
          });
        }
  
        var node = new FS.FSNode(parent, name, mode, rdev);
  
        FS.hashAddNode(node);
  
        return node;
      },destroyNode:function(node) {
        FS.hashRemoveNode(node);
      },isRoot:function(node) {
        return node === node.parent;
      },isMountpoint:function(node) {
        return !!node.mounted;
      },isFile:function(mode) {
        return (mode & 61440) === 32768;
      },isDir:function(mode) {
        return (mode & 61440) === 16384;
      },isLink:function(mode) {
        return (mode & 61440) === 40960;
      },isChrdev:function(mode) {
        return (mode & 61440) === 8192;
      },isBlkdev:function(mode) {
        return (mode & 61440) === 24576;
      },isFIFO:function(mode) {
        return (mode & 61440) === 4096;
      },isSocket:function(mode) {
        return (mode & 49152) === 49152;
      },flagModes:{"r":0,"rs":1052672,"r+":2,"w":577,"wx":705,"xw":705,"w+":578,"wx+":706,"xw+":706,"a":1089,"ax":1217,"xa":1217,"a+":1090,"ax+":1218,"xa+":1218},modeStringToFlags:function(str) {
        var flags = FS.flagModes[str];
        if (typeof flags === 'undefined') {
          throw new Error('Unknown file open mode: ' + str);
        }
        return flags;
      },flagsToPermissionString:function(flag) {
        var perms = ['r', 'w', 'rw'][flag & 3];
        if ((flag & 512)) {
          perms += 'w';
        }
        return perms;
      },nodePermissions:function(node, perms) {
        if (FS.ignorePermissions) {
          return 0;
        }
        // return 0 if any user, group or owner bits are set.
        if (perms.indexOf('r') !== -1 && !(node.mode & 292)) {
          return 2;
        } else if (perms.indexOf('w') !== -1 && !(node.mode & 146)) {
          return 2;
        } else if (perms.indexOf('x') !== -1 && !(node.mode & 73)) {
          return 2;
        }
        return 0;
      },mayLookup:function(dir) {
        var errCode = FS.nodePermissions(dir, 'x');
        if (errCode) return errCode;
        if (!dir.node_ops.lookup) return 2;
        return 0;
      },mayCreate:function(dir, name) {
        try {
          var node = FS.lookupNode(dir, name);
          return 20;
        } catch (e) {
        }
        return FS.nodePermissions(dir, 'wx');
      },mayDelete:function(dir, name, isdir) {
        var node;
        try {
          node = FS.lookupNode(dir, name);
        } catch (e) {
          return e.errno;
        }
        var errCode = FS.nodePermissions(dir, 'wx');
        if (errCode) {
          return errCode;
        }
        if (isdir) {
          if (!FS.isDir(node.mode)) {
            return 54;
          }
          if (FS.isRoot(node) || FS.getPath(node) === FS.cwd()) {
            return 10;
          }
        } else {
          if (FS.isDir(node.mode)) {
            return 31;
          }
        }
        return 0;
      },mayOpen:function(node, flags) {
        if (!node) {
          return 44;
        }
        if (FS.isLink(node.mode)) {
          return 32;
        } else if (FS.isDir(node.mode)) {
          if (FS.flagsToPermissionString(flags) !== 'r' || // opening for write
              (flags & 512)) { // TODO: check for O_SEARCH? (== search for dir only)
            return 31;
          }
        }
        return FS.nodePermissions(node, FS.flagsToPermissionString(flags));
      },MAX_OPEN_FDS:4096,nextfd:function(fd_start, fd_end) {
        fd_start = fd_start || 0;
        fd_end = fd_end || FS.MAX_OPEN_FDS;
        for (var fd = fd_start; fd <= fd_end; fd++) {
          if (!FS.streams[fd]) {
            return fd;
          }
        }
        throw new FS.ErrnoError(33);
      },getStream:function(fd) {
        return FS.streams[fd];
      },createStream:function(stream, fd_start, fd_end) {
        if (!FS.FSStream) {
          FS.FSStream = function(){};
          FS.FSStream.prototype = {};
          // compatibility
          Object.defineProperties(FS.FSStream.prototype, {
            object: {
              get: function() { return this.node; },
              set: function(val) { this.node = val; }
            },
            isRead: {
              get: function() { return (this.flags & 2097155) !== 1; }
            },
            isWrite: {
              get: function() { return (this.flags & 2097155) !== 0; }
            },
            isAppend: {
              get: function() { return (this.flags & 1024); }
            }
          });
        }
        // clone it, so we can return an instance of FSStream
        var newStream = new FS.FSStream();
        for (var p in stream) {
          newStream[p] = stream[p];
        }
        stream = newStream;
        var fd = FS.nextfd(fd_start, fd_end);
        stream.fd = fd;
        FS.streams[fd] = stream;
        return stream;
      },closeStream:function(fd) {
        FS.streams[fd] = null;
      },chrdev_stream_ops:{open:function(stream) {
          var device = FS.getDevice(stream.node.rdev);
          // override node's stream ops with the device's
          stream.stream_ops = device.stream_ops;
          // forward the open call
          if (stream.stream_ops.open) {
            stream.stream_ops.open(stream);
          }
        },llseek:function() {
          throw new FS.ErrnoError(70);
        }},major:function(dev) {
        return ((dev) >> 8);
      },minor:function(dev) {
        return ((dev) & 0xff);
      },makedev:function(ma, mi) {
        return ((ma) << 8 | (mi));
      },registerDevice:function(dev, ops) {
        FS.devices[dev] = { stream_ops: ops };
      },getDevice:function(dev) {
        return FS.devices[dev];
      },getMounts:function(mount) {
        var mounts = [];
        var check = [mount];
  
        while (check.length) {
          var m = check.pop();
  
          mounts.push(m);
  
          check.push.apply(check, m.mounts);
        }
  
        return mounts;
      },syncfs:function(populate, callback) {
        if (typeof(populate) === 'function') {
          callback = populate;
          populate = false;
        }
  
        FS.syncFSRequests++;
  
        if (FS.syncFSRequests > 1) {
          err('warning: ' + FS.syncFSRequests + ' FS.syncfs operations in flight at once, probably just doing extra work');
        }
  
        var mounts = FS.getMounts(FS.root.mount);
        var completed = 0;
  
        function doCallback(errCode) {
          FS.syncFSRequests--;
          return callback(errCode);
        }
  
        function done(errCode) {
          if (errCode) {
            if (!done.errored) {
              done.errored = true;
              return doCallback(errCode);
            }
            return;
          }
          if (++completed >= mounts.length) {
            doCallback(null);
          }
        };
  
        // sync all mounts
        mounts.forEach(function (mount) {
          if (!mount.type.syncfs) {
            return done(null);
          }
          mount.type.syncfs(mount, populate, done);
        });
      },mount:function(type, opts, mountpoint) {
        var root = mountpoint === '/';
        var pseudo = !mountpoint;
        var node;
  
        if (root && FS.root) {
          throw new FS.ErrnoError(10);
        } else if (!root && !pseudo) {
          var lookup = FS.lookupPath(mountpoint, { follow_mount: false });
  
          mountpoint = lookup.path;  // use the absolute path
          node = lookup.node;
  
          if (FS.isMountpoint(node)) {
            throw new FS.ErrnoError(10);
          }
  
          if (!FS.isDir(node.mode)) {
            throw new FS.ErrnoError(54);
          }
        }
  
        var mount = {
          type: type,
          opts: opts,
          mountpoint: mountpoint,
          mounts: []
        };
  
        // create a root node for the fs
        var mountRoot = type.mount(mount);
        mountRoot.mount = mount;
        mount.root = mountRoot;
  
        if (root) {
          FS.root = mountRoot;
        } else if (node) {
          // set as a mountpoint
          node.mounted = mount;
  
          // add the new mount to the current mount's children
          if (node.mount) {
            node.mount.mounts.push(mount);
          }
        }
  
        return mountRoot;
      },unmount:function (mountpoint) {
        var lookup = FS.lookupPath(mountpoint, { follow_mount: false });
  
        if (!FS.isMountpoint(lookup.node)) {
          throw new FS.ErrnoError(28);
        }
  
        // destroy the nodes for this mount, and all its child mounts
        var node = lookup.node;
        var mount = node.mounted;
        var mounts = FS.getMounts(mount);
  
        Object.keys(FS.nameTable).forEach(function (hash) {
          var current = FS.nameTable[hash];
  
          while (current) {
            var next = current.name_next;
  
            if (mounts.indexOf(current.mount) !== -1) {
              FS.destroyNode(current);
            }
  
            current = next;
          }
        });
  
        // no longer a mountpoint
        node.mounted = null;
  
        // remove this mount from the child mounts
        var idx = node.mount.mounts.indexOf(mount);
        node.mount.mounts.splice(idx, 1);
      },lookup:function(parent, name) {
        return parent.node_ops.lookup(parent, name);
      },mknod:function(path, mode, dev) {
        var lookup = FS.lookupPath(path, { parent: true });
        var parent = lookup.node;
        var name = PATH.basename(path);
        if (!name || name === '.' || name === '..') {
          throw new FS.ErrnoError(28);
        }
        var errCode = FS.mayCreate(parent, name);
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        if (!parent.node_ops.mknod) {
          throw new FS.ErrnoError(63);
        }
        return parent.node_ops.mknod(parent, name, mode, dev);
      },create:function(path, mode) {
        mode = mode !== undefined ? mode : 438 /* 0666 */;
        mode &= 4095;
        mode |= 32768;
        return FS.mknod(path, mode, 0);
      },mkdir:function(path, mode) {
        mode = mode !== undefined ? mode : 511 /* 0777 */;
        mode &= 511 | 512;
        mode |= 16384;
        return FS.mknod(path, mode, 0);
      },mkdirTree:function(path, mode) {
        var dirs = path.split('/');
        var d = '';
        for (var i = 0; i < dirs.length; ++i) {
          if (!dirs[i]) continue;
          d += '/' + dirs[i];
          try {
            FS.mkdir(d, mode);
          } catch(e) {
            if (e.errno != 20) throw e;
          }
        }
      },mkdev:function(path, mode, dev) {
        if (typeof(dev) === 'undefined') {
          dev = mode;
          mode = 438 /* 0666 */;
        }
        mode |= 8192;
        return FS.mknod(path, mode, dev);
      },symlink:function(oldpath, newpath) {
        if (!PATH_FS.resolve(oldpath)) {
          throw new FS.ErrnoError(44);
        }
        var lookup = FS.lookupPath(newpath, { parent: true });
        var parent = lookup.node;
        if (!parent) {
          throw new FS.ErrnoError(44);
        }
        var newname = PATH.basename(newpath);
        var errCode = FS.mayCreate(parent, newname);
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        if (!parent.node_ops.symlink) {
          throw new FS.ErrnoError(63);
        }
        return parent.node_ops.symlink(parent, newname, oldpath);
      },rename:function(old_path, new_path) {
        var old_dirname = PATH.dirname(old_path);
        var new_dirname = PATH.dirname(new_path);
        var old_name = PATH.basename(old_path);
        var new_name = PATH.basename(new_path);
        // parents must exist
        var lookup, old_dir, new_dir;
        try {
          lookup = FS.lookupPath(old_path, { parent: true });
          old_dir = lookup.node;
          lookup = FS.lookupPath(new_path, { parent: true });
          new_dir = lookup.node;
        } catch (e) {
          throw new FS.ErrnoError(10);
        }
        if (!old_dir || !new_dir) throw new FS.ErrnoError(44);
        // need to be part of the same mount
        if (old_dir.mount !== new_dir.mount) {
          throw new FS.ErrnoError(75);
        }
        // source must exist
        var old_node = FS.lookupNode(old_dir, old_name);
        // old path should not be an ancestor of the new path
        var relative = PATH_FS.relative(old_path, new_dirname);
        if (relative.charAt(0) !== '.') {
          throw new FS.ErrnoError(28);
        }
        // new path should not be an ancestor of the old path
        relative = PATH_FS.relative(new_path, old_dirname);
        if (relative.charAt(0) !== '.') {
          throw new FS.ErrnoError(55);
        }
        // see if the new path already exists
        var new_node;
        try {
          new_node = FS.lookupNode(new_dir, new_name);
        } catch (e) {
          // not fatal
        }
        // early out if nothing needs to change
        if (old_node === new_node) {
          return;
        }
        // we'll need to delete the old entry
        var isdir = FS.isDir(old_node.mode);
        var errCode = FS.mayDelete(old_dir, old_name, isdir);
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        // need delete permissions if we'll be overwriting.
        // need create permissions if new doesn't already exist.
        errCode = new_node ?
          FS.mayDelete(new_dir, new_name, isdir) :
          FS.mayCreate(new_dir, new_name);
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        if (!old_dir.node_ops.rename) {
          throw new FS.ErrnoError(63);
        }
        if (FS.isMountpoint(old_node) || (new_node && FS.isMountpoint(new_node))) {
          throw new FS.ErrnoError(10);
        }
        // if we are going to change the parent, check write permissions
        if (new_dir !== old_dir) {
          errCode = FS.nodePermissions(old_dir, 'w');
          if (errCode) {
            throw new FS.ErrnoError(errCode);
          }
        }
        try {
          if (FS.trackingDelegate['willMovePath']) {
            FS.trackingDelegate['willMovePath'](old_path, new_path);
          }
        } catch(e) {
          err("FS.trackingDelegate['willMovePath']('"+old_path+"', '"+new_path+"') threw an exception: " + e.message);
        }
        // remove the node from the lookup hash
        FS.hashRemoveNode(old_node);
        // do the underlying fs rename
        try {
          old_dir.node_ops.rename(old_node, new_dir, new_name);
        } catch (e) {
          throw e;
        } finally {
          // add the node back to the hash (in case node_ops.rename
          // changed its name)
          FS.hashAddNode(old_node);
        }
        try {
          if (FS.trackingDelegate['onMovePath']) FS.trackingDelegate['onMovePath'](old_path, new_path);
        } catch(e) {
          err("FS.trackingDelegate['onMovePath']('"+old_path+"', '"+new_path+"') threw an exception: " + e.message);
        }
      },rmdir:function(path) {
        var lookup = FS.lookupPath(path, { parent: true });
        var parent = lookup.node;
        var name = PATH.basename(path);
        var node = FS.lookupNode(parent, name);
        var errCode = FS.mayDelete(parent, name, true);
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        if (!parent.node_ops.rmdir) {
          throw new FS.ErrnoError(63);
        }
        if (FS.isMountpoint(node)) {
          throw new FS.ErrnoError(10);
        }
        try {
          if (FS.trackingDelegate['willDeletePath']) {
            FS.trackingDelegate['willDeletePath'](path);
          }
        } catch(e) {
          err("FS.trackingDelegate['willDeletePath']('"+path+"') threw an exception: " + e.message);
        }
        parent.node_ops.rmdir(parent, name);
        FS.destroyNode(node);
        try {
          if (FS.trackingDelegate['onDeletePath']) FS.trackingDelegate['onDeletePath'](path);
        } catch(e) {
          err("FS.trackingDelegate['onDeletePath']('"+path+"') threw an exception: " + e.message);
        }
      },readdir:function(path) {
        var lookup = FS.lookupPath(path, { follow: true });
        var node = lookup.node;
        if (!node.node_ops.readdir) {
          throw new FS.ErrnoError(54);
        }
        return node.node_ops.readdir(node);
      },unlink:function(path) {
        var lookup = FS.lookupPath(path, { parent: true });
        var parent = lookup.node;
        var name = PATH.basename(path);
        var node = FS.lookupNode(parent, name);
        var errCode = FS.mayDelete(parent, name, false);
        if (errCode) {
          // According to POSIX, we should map EISDIR to EPERM, but
          // we instead do what Linux does (and we must, as we use
          // the musl linux libc).
          throw new FS.ErrnoError(errCode);
        }
        if (!parent.node_ops.unlink) {
          throw new FS.ErrnoError(63);
        }
        if (FS.isMountpoint(node)) {
          throw new FS.ErrnoError(10);
        }
        try {
          if (FS.trackingDelegate['willDeletePath']) {
            FS.trackingDelegate['willDeletePath'](path);
          }
        } catch(e) {
          err("FS.trackingDelegate['willDeletePath']('"+path+"') threw an exception: " + e.message);
        }
        parent.node_ops.unlink(parent, name);
        FS.destroyNode(node);
        try {
          if (FS.trackingDelegate['onDeletePath']) FS.trackingDelegate['onDeletePath'](path);
        } catch(e) {
          err("FS.trackingDelegate['onDeletePath']('"+path+"') threw an exception: " + e.message);
        }
      },readlink:function(path) {
        var lookup = FS.lookupPath(path);
        var link = lookup.node;
        if (!link) {
          throw new FS.ErrnoError(44);
        }
        if (!link.node_ops.readlink) {
          throw new FS.ErrnoError(28);
        }
        return PATH_FS.resolve(FS.getPath(link.parent), link.node_ops.readlink(link));
      },stat:function(path, dontFollow) {
        var lookup = FS.lookupPath(path, { follow: !dontFollow });
        var node = lookup.node;
        if (!node) {
          throw new FS.ErrnoError(44);
        }
        if (!node.node_ops.getattr) {
          throw new FS.ErrnoError(63);
        }
        return node.node_ops.getattr(node);
      },lstat:function(path) {
        return FS.stat(path, true);
      },chmod:function(path, mode, dontFollow) {
        var node;
        if (typeof path === 'string') {
          var lookup = FS.lookupPath(path, { follow: !dontFollow });
          node = lookup.node;
        } else {
          node = path;
        }
        if (!node.node_ops.setattr) {
          throw new FS.ErrnoError(63);
        }
        node.node_ops.setattr(node, {
          mode: (mode & 4095) | (node.mode & ~4095),
          timestamp: Date.now()
        });
      },lchmod:function(path, mode) {
        FS.chmod(path, mode, true);
      },fchmod:function(fd, mode) {
        var stream = FS.getStream(fd);
        if (!stream) {
          throw new FS.ErrnoError(8);
        }
        FS.chmod(stream.node, mode);
      },chown:function(path, uid, gid, dontFollow) {
        var node;
        if (typeof path === 'string') {
          var lookup = FS.lookupPath(path, { follow: !dontFollow });
          node = lookup.node;
        } else {
          node = path;
        }
        if (!node.node_ops.setattr) {
          throw new FS.ErrnoError(63);
        }
        node.node_ops.setattr(node, {
          timestamp: Date.now()
          // we ignore the uid / gid for now
        });
      },lchown:function(path, uid, gid) {
        FS.chown(path, uid, gid, true);
      },fchown:function(fd, uid, gid) {
        var stream = FS.getStream(fd);
        if (!stream) {
          throw new FS.ErrnoError(8);
        }
        FS.chown(stream.node, uid, gid);
      },truncate:function(path, len) {
        if (len < 0) {
          throw new FS.ErrnoError(28);
        }
        var node;
        if (typeof path === 'string') {
          var lookup = FS.lookupPath(path, { follow: true });
          node = lookup.node;
        } else {
          node = path;
        }
        if (!node.node_ops.setattr) {
          throw new FS.ErrnoError(63);
        }
        if (FS.isDir(node.mode)) {
          throw new FS.ErrnoError(31);
        }
        if (!FS.isFile(node.mode)) {
          throw new FS.ErrnoError(28);
        }
        var errCode = FS.nodePermissions(node, 'w');
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        node.node_ops.setattr(node, {
          size: len,
          timestamp: Date.now()
        });
      },ftruncate:function(fd, len) {
        var stream = FS.getStream(fd);
        if (!stream) {
          throw new FS.ErrnoError(8);
        }
        if ((stream.flags & 2097155) === 0) {
          throw new FS.ErrnoError(28);
        }
        FS.truncate(stream.node, len);
      },utime:function(path, atime, mtime) {
        var lookup = FS.lookupPath(path, { follow: true });
        var node = lookup.node;
        node.node_ops.setattr(node, {
          timestamp: Math.max(atime, mtime)
        });
      },open:function(path, flags, mode, fd_start, fd_end) {
        if (path === "") {
          throw new FS.ErrnoError(44);
        }
        flags = typeof flags === 'string' ? FS.modeStringToFlags(flags) : flags;
        mode = typeof mode === 'undefined' ? 438 /* 0666 */ : mode;
        if ((flags & 64)) {
          mode = (mode & 4095) | 32768;
        } else {
          mode = 0;
        }
        var node;
        if (typeof path === 'object') {
          node = path;
        } else {
          path = PATH.normalize(path);
          try {
            var lookup = FS.lookupPath(path, {
              follow: !(flags & 131072)
            });
            node = lookup.node;
          } catch (e) {
            // ignore
          }
        }
        // perhaps we need to create the node
        var created = false;
        if ((flags & 64)) {
          if (node) {
            // if O_CREAT and O_EXCL are set, error out if the node already exists
            if ((flags & 128)) {
              throw new FS.ErrnoError(20);
            }
          } else {
            // node doesn't exist, try to create it
            node = FS.mknod(path, mode, 0);
            created = true;
          }
        }
        if (!node) {
          throw new FS.ErrnoError(44);
        }
        // can't truncate a device
        if (FS.isChrdev(node.mode)) {
          flags &= ~512;
        }
        // if asked only for a directory, then this must be one
        if ((flags & 65536) && !FS.isDir(node.mode)) {
          throw new FS.ErrnoError(54);
        }
        // check permissions, if this is not a file we just created now (it is ok to
        // create and write to a file with read-only permissions; it is read-only
        // for later use)
        if (!created) {
          var errCode = FS.mayOpen(node, flags);
          if (errCode) {
            throw new FS.ErrnoError(errCode);
          }
        }
        // do truncation if necessary
        if ((flags & 512)) {
          FS.truncate(node, 0);
        }
        // we've already handled these, don't pass down to the underlying vfs
        flags &= ~(128 | 512);
  
        // register the stream with the filesystem
        var stream = FS.createStream({
          node: node,
          path: FS.getPath(node),  // we want the absolute path to the node
          flags: flags,
          seekable: true,
          position: 0,
          stream_ops: node.stream_ops,
          // used by the file family libc calls (fopen, fwrite, ferror, etc.)
          ungotten: [],
          error: false
        }, fd_start, fd_end);
        // call the new stream's open function
        if (stream.stream_ops.open) {
          stream.stream_ops.open(stream);
        }
        if (Module['logReadFiles'] && !(flags & 1)) {
          if (!FS.readFiles) FS.readFiles = {};
          if (!(path in FS.readFiles)) {
            FS.readFiles[path] = 1;
            err("FS.trackingDelegate error on read file: " + path);
          }
        }
        try {
          if (FS.trackingDelegate['onOpenFile']) {
            var trackingFlags = 0;
            if ((flags & 2097155) !== 1) {
              trackingFlags |= FS.tracking.openFlags.READ;
            }
            if ((flags & 2097155) !== 0) {
              trackingFlags |= FS.tracking.openFlags.WRITE;
            }
            FS.trackingDelegate['onOpenFile'](path, trackingFlags);
          }
        } catch(e) {
          err("FS.trackingDelegate['onOpenFile']('"+path+"', flags) threw an exception: " + e.message);
        }
        return stream;
      },close:function(stream) {
        if (FS.isClosed(stream)) {
          throw new FS.ErrnoError(8);
        }
        if (stream.getdents) stream.getdents = null; // free readdir state
        try {
          if (stream.stream_ops.close) {
            stream.stream_ops.close(stream);
          }
        } catch (e) {
          throw e;
        } finally {
          FS.closeStream(stream.fd);
        }
        stream.fd = null;
      },isClosed:function(stream) {
        return stream.fd === null;
      },llseek:function(stream, offset, whence) {
        if (FS.isClosed(stream)) {
          throw new FS.ErrnoError(8);
        }
        if (!stream.seekable || !stream.stream_ops.llseek) {
          throw new FS.ErrnoError(70);
        }
        if (whence != 0 && whence != 1 && whence != 2) {
          throw new FS.ErrnoError(28);
        }
        stream.position = stream.stream_ops.llseek(stream, offset, whence);
        stream.ungotten = [];
        return stream.position;
      },read:function(stream, buffer, offset, length, position) {
        if (length < 0 || position < 0) {
          throw new FS.ErrnoError(28);
        }
        if (FS.isClosed(stream)) {
          throw new FS.ErrnoError(8);
        }
        if ((stream.flags & 2097155) === 1) {
          throw new FS.ErrnoError(8);
        }
        if (FS.isDir(stream.node.mode)) {
          throw new FS.ErrnoError(31);
        }
        if (!stream.stream_ops.read) {
          throw new FS.ErrnoError(28);
        }
        var seeking = typeof position !== 'undefined';
        if (!seeking) {
          position = stream.position;
        } else if (!stream.seekable) {
          throw new FS.ErrnoError(70);
        }
        var bytesRead = stream.stream_ops.read(stream, buffer, offset, length, position);
        if (!seeking) stream.position += bytesRead;
        return bytesRead;
      },write:function(stream, buffer, offset, length, position, canOwn) {
        if (length < 0 || position < 0) {
          throw new FS.ErrnoError(28);
        }
        if (FS.isClosed(stream)) {
          throw new FS.ErrnoError(8);
        }
        if ((stream.flags & 2097155) === 0) {
          throw new FS.ErrnoError(8);
        }
        if (FS.isDir(stream.node.mode)) {
          throw new FS.ErrnoError(31);
        }
        if (!stream.stream_ops.write) {
          throw new FS.ErrnoError(28);
        }
        if (stream.flags & 1024) {
          // seek to the end before writing in append mode
          FS.llseek(stream, 0, 2);
        }
        var seeking = typeof position !== 'undefined';
        if (!seeking) {
          position = stream.position;
        } else if (!stream.seekable) {
          throw new FS.ErrnoError(70);
        }
        var bytesWritten = stream.stream_ops.write(stream, buffer, offset, length, position, canOwn);
        if (!seeking) stream.position += bytesWritten;
        try {
          if (stream.path && FS.trackingDelegate['onWriteToFile']) FS.trackingDelegate['onWriteToFile'](stream.path);
        } catch(e) {
          err("FS.trackingDelegate['onWriteToFile']('"+stream.path+"') threw an exception: " + e.message);
        }
        return bytesWritten;
      },allocate:function(stream, offset, length) {
        if (FS.isClosed(stream)) {
          throw new FS.ErrnoError(8);
        }
        if (offset < 0 || length <= 0) {
          throw new FS.ErrnoError(28);
        }
        if ((stream.flags & 2097155) === 0) {
          throw new FS.ErrnoError(8);
        }
        if (!FS.isFile(stream.node.mode) && !FS.isDir(stream.node.mode)) {
          throw new FS.ErrnoError(43);
        }
        if (!stream.stream_ops.allocate) {
          throw new FS.ErrnoError(138);
        }
        stream.stream_ops.allocate(stream, offset, length);
      },mmap:function(stream, buffer, offset, length, position, prot, flags) {
        // User requests writing to file (prot & PROT_WRITE != 0).
        // Checking if we have permissions to write to the file unless
        // MAP_PRIVATE flag is set. According to POSIX spec it is possible
        // to write to file opened in read-only mode with MAP_PRIVATE flag,
        // as all modifications will be visible only in the memory of
        // the current process.
        if ((prot & 2) !== 0
            && (flags & 2) === 0
            && (stream.flags & 2097155) !== 2) {
          throw new FS.ErrnoError(2);
        }
        if ((stream.flags & 2097155) === 1) {
          throw new FS.ErrnoError(2);
        }
        if (!stream.stream_ops.mmap) {
          throw new FS.ErrnoError(43);
        }
        return stream.stream_ops.mmap(stream, buffer, offset, length, position, prot, flags);
      },msync:function(stream, buffer, offset, length, mmapFlags) {
        if (!stream || !stream.stream_ops.msync) {
          return 0;
        }
        return stream.stream_ops.msync(stream, buffer, offset, length, mmapFlags);
      },munmap:function(stream) {
        return 0;
      },ioctl:function(stream, cmd, arg) {
        if (!stream.stream_ops.ioctl) {
          throw new FS.ErrnoError(59);
        }
        return stream.stream_ops.ioctl(stream, cmd, arg);
      },readFile:function(path, opts) {
        opts = opts || {};
        opts.flags = opts.flags || 'r';
        opts.encoding = opts.encoding || 'binary';
        if (opts.encoding !== 'utf8' && opts.encoding !== 'binary') {
          throw new Error('Invalid encoding type "' + opts.encoding + '"');
        }
        var ret;
        var stream = FS.open(path, opts.flags);
        var stat = FS.stat(path);
        var length = stat.size;
        var buf = new Uint8Array(length);
        FS.read(stream, buf, 0, length, 0);
        if (opts.encoding === 'utf8') {
          ret = UTF8ArrayToString(buf, 0);
        } else if (opts.encoding === 'binary') {
          ret = buf;
        }
        FS.close(stream);
        return ret;
      },writeFile:function(path, data, opts) {
        opts = opts || {};
        opts.flags = opts.flags || 'w';
        var stream = FS.open(path, opts.flags, opts.mode);
        if (typeof data === 'string') {
          var buf = new Uint8Array(lengthBytesUTF8(data)+1);
          var actualNumBytes = stringToUTF8Array(data, buf, 0, buf.length);
          FS.write(stream, buf, 0, actualNumBytes, undefined, opts.canOwn);
        } else if (ArrayBuffer.isView(data)) {
          FS.write(stream, data, 0, data.byteLength, undefined, opts.canOwn);
        } else {
          throw new Error('Unsupported data type');
        }
        FS.close(stream);
      },cwd:function() {
        return FS.currentPath;
      },chdir:function(path) {
        var lookup = FS.lookupPath(path, { follow: true });
        if (lookup.node === null) {
          throw new FS.ErrnoError(44);
        }
        if (!FS.isDir(lookup.node.mode)) {
          throw new FS.ErrnoError(54);
        }
        var errCode = FS.nodePermissions(lookup.node, 'x');
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        FS.currentPath = lookup.path;
      },createDefaultDirectories:function() {
        FS.mkdir('/tmp');
        FS.mkdir('/home');
        FS.mkdir('/home/web_user');
      },createDefaultDevices:function() {
        // create /dev
        FS.mkdir('/dev');
        // setup /dev/null
        FS.registerDevice(FS.makedev(1, 3), {
          read: function() { return 0; },
          write: function(stream, buffer, offset, length, pos) { return length; }
        });
        FS.mkdev('/dev/null', FS.makedev(1, 3));
        // setup /dev/tty and /dev/tty1
        // stderr needs to print output using Module['printErr']
        // so we register a second tty just for it.
        TTY.register(FS.makedev(5, 0), TTY.default_tty_ops);
        TTY.register(FS.makedev(6, 0), TTY.default_tty1_ops);
        FS.mkdev('/dev/tty', FS.makedev(5, 0));
        FS.mkdev('/dev/tty1', FS.makedev(6, 0));
        // setup /dev/[u]random
        var random_device;
        if (typeof crypto === 'object' && typeof crypto['getRandomValues'] === 'function') {
          // for modern web browsers
          var randomBuffer = new Uint8Array(1);
          random_device = function() { crypto.getRandomValues(randomBuffer); return randomBuffer[0]; };
        } else
        if (ENVIRONMENT_IS_NODE) {
          // for nodejs with or without crypto support included
          try {
            var crypto_module = require('crypto');
            // nodejs has crypto support
            random_device = function() { return crypto_module['randomBytes'](1)[0]; };
          } catch (e) {
            // nodejs doesn't have crypto support
          }
        } else
        {}
        if (!random_device) {
          // we couldn't find a proper implementation, as Math.random() is not suitable for /dev/random, see emscripten-core/emscripten/pull/7096
          random_device = function() { abort("random_device"); };
        }
        FS.createDevice('/dev', 'random', random_device);
        FS.createDevice('/dev', 'urandom', random_device);
        // we're not going to emulate the actual shm device,
        // just create the tmp dirs that reside in it commonly
        FS.mkdir('/dev/shm');
        FS.mkdir('/dev/shm/tmp');
      },createSpecialDirectories:function() {
        // create /proc/self/fd which allows /proc/self/fd/6 => readlink gives the name of the stream for fd 6 (see test_unistd_ttyname)
        FS.mkdir('/proc');
        FS.mkdir('/proc/self');
        FS.mkdir('/proc/self/fd');
        FS.mount({
          mount: function() {
            var node = FS.createNode('/proc/self', 'fd', 16384 | 511 /* 0777 */, 73);
            node.node_ops = {
              lookup: function(parent, name) {
                var fd = +name;
                var stream = FS.getStream(fd);
                if (!stream) throw new FS.ErrnoError(8);
                var ret = {
                  parent: null,
                  mount: { mountpoint: 'fake' },
                  node_ops: { readlink: function() { return stream.path } }
                };
                ret.parent = ret; // make it look like a simple root node
                return ret;
              }
            };
            return node;
          }
        }, {}, '/proc/self/fd');
      },createStandardStreams:function() {
        // TODO deprecate the old functionality of a single
        // input / output callback and that utilizes FS.createDevice
        // and instead require a unique set of stream ops
  
        // by default, we symlink the standard streams to the
        // default tty devices. however, if the standard streams
        // have been overwritten we create a unique device for
        // them instead.
        if (Module['stdin']) {
          FS.createDevice('/dev', 'stdin', Module['stdin']);
        } else {
          FS.symlink('/dev/tty', '/dev/stdin');
        }
        if (Module['stdout']) {
          FS.createDevice('/dev', 'stdout', null, Module['stdout']);
        } else {
          FS.symlink('/dev/tty', '/dev/stdout');
        }
        if (Module['stderr']) {
          FS.createDevice('/dev', 'stderr', null, Module['stderr']);
        } else {
          FS.symlink('/dev/tty1', '/dev/stderr');
        }
  
        // open default streams for the stdin, stdout and stderr devices
        var stdin = FS.open('/dev/stdin', 'r');
        var stdout = FS.open('/dev/stdout', 'w');
        var stderr = FS.open('/dev/stderr', 'w');
      },ensureErrnoError:function() {
        if (FS.ErrnoError) return;
        FS.ErrnoError = function ErrnoError(errno, node) {
          this.node = node;
          this.setErrno = function(errno) {
            this.errno = errno;
          };
          this.setErrno(errno);
          this.message = 'FS error';
  
        };
        FS.ErrnoError.prototype = new Error();
        FS.ErrnoError.prototype.constructor = FS.ErrnoError;
        // Some errors may happen quite a bit, to avoid overhead we reuse them (and suffer a lack of stack info)
        [44].forEach(function(code) {
          FS.genericErrors[code] = new FS.ErrnoError(code);
          FS.genericErrors[code].stack = '<generic error, no stack>';
        });
      },staticInit:function() {
        FS.ensureErrnoError();
  
        FS.nameTable = new Array(4096);
  
        FS.mount(MEMFS, {}, '/');
  
        FS.createDefaultDirectories();
        FS.createDefaultDevices();
        FS.createSpecialDirectories();
  
        FS.filesystems = {
          'MEMFS': MEMFS,
        };
      },init:function(input, output, error) {
        FS.init.initialized = true;
  
        FS.ensureErrnoError();
  
        // Allow Module.stdin etc. to provide defaults, if none explicitly passed to us here
        Module['stdin'] = input || Module['stdin'];
        Module['stdout'] = output || Module['stdout'];
        Module['stderr'] = error || Module['stderr'];
  
        FS.createStandardStreams();
      },quit:function() {
        FS.init.initialized = false;
        // force-flush all streams, so we get musl std streams printed out
        var fflush = Module['_fflush'];
        if (fflush) fflush(0);
        // close all of our streams
        for (var i = 0; i < FS.streams.length; i++) {
          var stream = FS.streams[i];
          if (!stream) {
            continue;
          }
          FS.close(stream);
        }
      },getMode:function(canRead, canWrite) {
        var mode = 0;
        if (canRead) mode |= 292 | 73;
        if (canWrite) mode |= 146;
        return mode;
      },joinPath:function(parts, forceRelative) {
        var path = PATH.join.apply(null, parts);
        if (forceRelative && path[0] == '/') path = path.substr(1);
        return path;
      },absolutePath:function(relative, base) {
        return PATH_FS.resolve(base, relative);
      },standardizePath:function(path) {
        return PATH.normalize(path);
      },findObject:function(path, dontResolveLastLink) {
        var ret = FS.analyzePath(path, dontResolveLastLink);
        if (ret.exists) {
          return ret.object;
        } else {
          ___setErrNo(ret.error);
          return null;
        }
      },analyzePath:function(path, dontResolveLastLink) {
        // operate from within the context of the symlink's target
        try {
          var lookup = FS.lookupPath(path, { follow: !dontResolveLastLink });
          path = lookup.path;
        } catch (e) {
        }
        var ret = {
          isRoot: false, exists: false, error: 0, name: null, path: null, object: null,
          parentExists: false, parentPath: null, parentObject: null
        };
        try {
          var lookup = FS.lookupPath(path, { parent: true });
          ret.parentExists = true;
          ret.parentPath = lookup.path;
          ret.parentObject = lookup.node;
          ret.name = PATH.basename(path);
          lookup = FS.lookupPath(path, { follow: !dontResolveLastLink });
          ret.exists = true;
          ret.path = lookup.path;
          ret.object = lookup.node;
          ret.name = lookup.node.name;
          ret.isRoot = lookup.path === '/';
        } catch (e) {
          ret.error = e.errno;
        };
        return ret;
      },createFolder:function(parent, name, canRead, canWrite) {
        var path = PATH.join2(typeof parent === 'string' ? parent : FS.getPath(parent), name);
        var mode = FS.getMode(canRead, canWrite);
        return FS.mkdir(path, mode);
      },createPath:function(parent, path, canRead, canWrite) {
        parent = typeof parent === 'string' ? parent : FS.getPath(parent);
        var parts = path.split('/').reverse();
        while (parts.length) {
          var part = parts.pop();
          if (!part) continue;
          var current = PATH.join2(parent, part);
          try {
            FS.mkdir(current);
          } catch (e) {
            // ignore EEXIST
          }
          parent = current;
        }
        return current;
      },createFile:function(parent, name, properties, canRead, canWrite) {
        var path = PATH.join2(typeof parent === 'string' ? parent : FS.getPath(parent), name);
        var mode = FS.getMode(canRead, canWrite);
        return FS.create(path, mode);
      },createDataFile:function(parent, name, data, canRead, canWrite, canOwn) {
        var path = name ? PATH.join2(typeof parent === 'string' ? parent : FS.getPath(parent), name) : parent;
        var mode = FS.getMode(canRead, canWrite);
        var node = FS.create(path, mode);
        if (data) {
          if (typeof data === 'string') {
            var arr = new Array(data.length);
            for (var i = 0, len = data.length; i < len; ++i) arr[i] = data.charCodeAt(i);
            data = arr;
          }
          // make sure we can write to the file
          FS.chmod(node, mode | 146);
          var stream = FS.open(node, 'w');
          FS.write(stream, data, 0, data.length, 0, canOwn);
          FS.close(stream);
          FS.chmod(node, mode);
        }
        return node;
      },createDevice:function(parent, name, input, output) {
        var path = PATH.join2(typeof parent === 'string' ? parent : FS.getPath(parent), name);
        var mode = FS.getMode(!!input, !!output);
        if (!FS.createDevice.major) FS.createDevice.major = 64;
        var dev = FS.makedev(FS.createDevice.major++, 0);
        // Create a fake device that a set of stream ops to emulate
        // the old behavior.
        FS.registerDevice(dev, {
          open: function(stream) {
            stream.seekable = false;
          },
          close: function(stream) {
            // flush any pending line data
            if (output && output.buffer && output.buffer.length) {
              output(10);
            }
          },
          read: function(stream, buffer, offset, length, pos /* ignored */) {
            var bytesRead = 0;
            for (var i = 0; i < length; i++) {
              var result;
              try {
                result = input();
              } catch (e) {
                throw new FS.ErrnoError(29);
              }
              if (result === undefined && bytesRead === 0) {
                throw new FS.ErrnoError(6);
              }
              if (result === null || result === undefined) break;
              bytesRead++;
              buffer[offset+i] = result;
            }
            if (bytesRead) {
              stream.node.timestamp = Date.now();
            }
            return bytesRead;
          },
          write: function(stream, buffer, offset, length, pos) {
            for (var i = 0; i < length; i++) {
              try {
                output(buffer[offset+i]);
              } catch (e) {
                throw new FS.ErrnoError(29);
              }
            }
            if (length) {
              stream.node.timestamp = Date.now();
            }
            return i;
          }
        });
        return FS.mkdev(path, mode, dev);
      },createLink:function(parent, name, target, canRead, canWrite) {
        var path = PATH.join2(typeof parent === 'string' ? parent : FS.getPath(parent), name);
        return FS.symlink(target, path);
      },forceLoadFile:function(obj) {
        if (obj.isDevice || obj.isFolder || obj.link || obj.contents) return true;
        var success = true;
        if (typeof XMLHttpRequest !== 'undefined') {
          throw new Error("Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.");
        } else if (read_) {
          // Command-line.
          try {
            // WARNING: Can't read binary files in V8's d8 or tracemonkey's js, as
            //          read() will try to parse UTF8.
            obj.contents = intArrayFromString(read_(obj.url), true);
            obj.usedBytes = obj.contents.length;
          } catch (e) {
            success = false;
          }
        } else {
          throw new Error('Cannot load without read() or XMLHttpRequest.');
        }
        if (!success) ___setErrNo(29);
        return success;
      },createLazyFile:function(parent, name, url, canRead, canWrite) {
        // Lazy chunked Uint8Array (implements get and length from Uint8Array). Actual getting is abstracted away for eventual reuse.
        function LazyUint8Array() {
          this.lengthKnown = false;
          this.chunks = []; // Loaded chunks. Index is the chunk number
        }
        LazyUint8Array.prototype.get = function LazyUint8Array_get(idx) {
          if (idx > this.length-1 || idx < 0) {
            return undefined;
          }
          var chunkOffset = idx % this.chunkSize;
          var chunkNum = (idx / this.chunkSize)|0;
          return this.getter(chunkNum)[chunkOffset];
        };
        LazyUint8Array.prototype.setDataGetter = function LazyUint8Array_setDataGetter(getter) {
          this.getter = getter;
        };
        LazyUint8Array.prototype.cacheLength = function LazyUint8Array_cacheLength() {
          // Find length
          var xhr = new XMLHttpRequest();
          xhr.open('HEAD', url, false);
          xhr.send(null);
          if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
          var datalength = Number(xhr.getResponseHeader("Content-length"));
          var header;
          var hasByteServing = (header = xhr.getResponseHeader("Accept-Ranges")) && header === "bytes";
          var usesGzip = (header = xhr.getResponseHeader("Content-Encoding")) && header === "gzip";
  
          var chunkSize = 1024*1024; // Chunk size in bytes
  
          if (!hasByteServing) chunkSize = datalength;
  
          // Function to get a range from the remote URL.
          var doXHR = (function(from, to) {
            if (from > to) throw new Error("invalid range (" + from + ", " + to + ") or no bytes requested!");
            if (to > datalength-1) throw new Error("only " + datalength + " bytes available! programmer error!");
  
            // TODO: Use mozResponseArrayBuffer, responseStream, etc. if available.
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, false);
            if (datalength !== chunkSize) xhr.setRequestHeader("Range", "bytes=" + from + "-" + to);
  
            // Some hints to the browser that we want binary data.
            if (typeof Uint8Array != 'undefined') xhr.responseType = 'arraybuffer';
            if (xhr.overrideMimeType) {
              xhr.overrideMimeType('text/plain; charset=x-user-defined');
            }
  
            xhr.send(null);
            if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
            if (xhr.response !== undefined) {
              return new Uint8Array(xhr.response || []);
            } else {
              return intArrayFromString(xhr.responseText || '', true);
            }
          });
          var lazyArray = this;
          lazyArray.setDataGetter(function(chunkNum) {
            var start = chunkNum * chunkSize;
            var end = (chunkNum+1) * chunkSize - 1; // including this byte
            end = Math.min(end, datalength-1); // if datalength-1 is selected, this is the last block
            if (typeof(lazyArray.chunks[chunkNum]) === "undefined") {
              lazyArray.chunks[chunkNum] = doXHR(start, end);
            }
            if (typeof(lazyArray.chunks[chunkNum]) === "undefined") throw new Error("doXHR failed!");
            return lazyArray.chunks[chunkNum];
          });
  
          if (usesGzip || !datalength) {
            // if the server uses gzip or doesn't supply the length, we have to download the whole file to get the (uncompressed) length
            chunkSize = datalength = 1; // this will force getter(0)/doXHR do download the whole file
            datalength = this.getter(0).length;
            chunkSize = datalength;
            out("LazyFiles on gzip forces download of the whole file when length is accessed");
          }
  
          this._length = datalength;
          this._chunkSize = chunkSize;
          this.lengthKnown = true;
        };
        if (typeof XMLHttpRequest !== 'undefined') {
          if (!ENVIRONMENT_IS_WORKER) throw 'Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc';
          var lazyArray = new LazyUint8Array();
          Object.defineProperties(lazyArray, {
            length: {
              get: function() {
                if(!this.lengthKnown) {
                  this.cacheLength();
                }
                return this._length;
              }
            },
            chunkSize: {
              get: function() {
                if(!this.lengthKnown) {
                  this.cacheLength();
                }
                return this._chunkSize;
              }
            }
          });
  
          var properties = { isDevice: false, contents: lazyArray };
        } else {
          var properties = { isDevice: false, url: url };
        }
  
        var node = FS.createFile(parent, name, properties, canRead, canWrite);
        // This is a total hack, but I want to get this lazy file code out of the
        // core of MEMFS. If we want to keep this lazy file concept I feel it should
        // be its own thin LAZYFS proxying calls to MEMFS.
        if (properties.contents) {
          node.contents = properties.contents;
        } else if (properties.url) {
          node.contents = null;
          node.url = properties.url;
        }
        // Add a function that defers querying the file size until it is asked the first time.
        Object.defineProperties(node, {
          usedBytes: {
            get: function() { return this.contents.length; }
          }
        });
        // override each stream op with one that tries to force load the lazy file first
        var stream_ops = {};
        var keys = Object.keys(node.stream_ops);
        keys.forEach(function(key) {
          var fn = node.stream_ops[key];
          stream_ops[key] = function forceLoadLazyFile() {
            if (!FS.forceLoadFile(node)) {
              throw new FS.ErrnoError(29);
            }
            return fn.apply(null, arguments);
          };
        });
        // use a custom read function
        stream_ops.read = function stream_ops_read(stream, buffer, offset, length, position) {
          if (!FS.forceLoadFile(node)) {
            throw new FS.ErrnoError(29);
          }
          var contents = stream.node.contents;
          if (position >= contents.length)
            return 0;
          var size = Math.min(contents.length - position, length);
          if (contents.slice) { // normal array
            for (var i = 0; i < size; i++) {
              buffer[offset + i] = contents[position + i];
            }
          } else {
            for (var i = 0; i < size; i++) { // LazyUint8Array from sync binary XHR
              buffer[offset + i] = contents.get(position + i);
            }
          }
          return size;
        };
        node.stream_ops = stream_ops;
        return node;
      },createPreloadedFile:function(parent, name, url, canRead, canWrite, onload, onerror, dontCreateFile, canOwn, preFinish) {
        Browser.init(); // XXX perhaps this method should move onto Browser?
        // TODO we should allow people to just pass in a complete filename instead
        // of parent and name being that we just join them anyways
        var fullname = name ? PATH_FS.resolve(PATH.join2(parent, name)) : parent;
        var dep = getUniqueRunDependency('cp ' + fullname); // might have several active requests for the same fullname
        function processData(byteArray) {
          function finish(byteArray) {
            if (preFinish) preFinish();
            if (!dontCreateFile) {
              FS.createDataFile(parent, name, byteArray, canRead, canWrite, canOwn);
            }
            if (onload) onload();
            removeRunDependency(dep);
          }
          var handled = false;
          Module['preloadPlugins'].forEach(function(plugin) {
            if (handled) return;
            if (plugin['canHandle'](fullname)) {
              plugin['handle'](byteArray, fullname, finish, function() {
                if (onerror) onerror();
                removeRunDependency(dep);
              });
              handled = true;
            }
          });
          if (!handled) finish(byteArray);
        }
        addRunDependency(dep);
        if (typeof url == 'string') {
          Browser.asyncLoad(url, function(byteArray) {
            processData(byteArray);
          }, onerror);
        } else {
          processData(url);
        }
      },indexedDB:function() {
        return window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
      },DB_NAME:function() {
        return 'EM_FS_' + window.location.pathname;
      },DB_VERSION:20,DB_STORE_NAME:"FILE_DATA",saveFilesToDB:function(paths, onload, onerror) {
        onload = onload || function(){};
        onerror = onerror || function(){};
        var indexedDB = FS.indexedDB();
        try {
          var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION);
        } catch (e) {
          return onerror(e);
        }
        openRequest.onupgradeneeded = function openRequest_onupgradeneeded() {
          out('creating db');
          var db = openRequest.result;
          db.createObjectStore(FS.DB_STORE_NAME);
        };
        openRequest.onsuccess = function openRequest_onsuccess() {
          var db = openRequest.result;
          var transaction = db.transaction([FS.DB_STORE_NAME], 'readwrite');
          var files = transaction.objectStore(FS.DB_STORE_NAME);
          var ok = 0, fail = 0, total = paths.length;
          function finish() {
            if (fail == 0) onload(); else onerror();
          }
          paths.forEach(function(path) {
            var putRequest = files.put(FS.analyzePath(path).object.contents, path);
            putRequest.onsuccess = function putRequest_onsuccess() { ok++; if (ok + fail == total) finish() };
            putRequest.onerror = function putRequest_onerror() { fail++; if (ok + fail == total) finish() };
          });
          transaction.onerror = onerror;
        };
        openRequest.onerror = onerror;
      },loadFilesFromDB:function(paths, onload, onerror) {
        onload = onload || function(){};
        onerror = onerror || function(){};
        var indexedDB = FS.indexedDB();
        try {
          var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION);
        } catch (e) {
          return onerror(e);
        }
        openRequest.onupgradeneeded = onerror; // no database to load from
        openRequest.onsuccess = function openRequest_onsuccess() {
          var db = openRequest.result;
          try {
            var transaction = db.transaction([FS.DB_STORE_NAME], 'readonly');
          } catch(e) {
            onerror(e);
            return;
          }
          var files = transaction.objectStore(FS.DB_STORE_NAME);
          var ok = 0, fail = 0, total = paths.length;
          function finish() {
            if (fail == 0) onload(); else onerror();
          }
          paths.forEach(function(path) {
            var getRequest = files.get(path);
            getRequest.onsuccess = function getRequest_onsuccess() {
              if (FS.analyzePath(path).exists) {
                FS.unlink(path);
              }
              FS.createDataFile(PATH.dirname(path), PATH.basename(path), getRequest.result, true, true, true);
              ok++;
              if (ok + fail == total) finish();
            };
            getRequest.onerror = function getRequest_onerror() { fail++; if (ok + fail == total) finish() };
          });
          transaction.onerror = onerror;
        };
        openRequest.onerror = onerror;
      }};var SYSCALLS={DEFAULT_POLLMASK:5,mappings:{},umask:511,calculateAt:function(dirfd, path) {
        if (path[0] !== '/') {
          // relative path
          var dir;
          if (dirfd === -100) {
            dir = FS.cwd();
          } else {
            var dirstream = FS.getStream(dirfd);
            if (!dirstream) throw new FS.ErrnoError(8);
            dir = dirstream.path;
          }
          path = PATH.join2(dir, path);
        }
        return path;
      },doStat:function(func, path, buf) {
        try {
          var stat = func(path);
        } catch (e) {
          if (e && e.node && PATH.normalize(path) !== PATH.normalize(FS.getPath(e.node))) {
            // an error occurred while trying to look up the path; we should just report ENOTDIR
            return -54;
          }
          throw e;
        }
        HEAP32[((buf)>>2)]=stat.dev;
        HEAP32[(((buf)+(4))>>2)]=0;
        HEAP32[(((buf)+(8))>>2)]=stat.ino;
        HEAP32[(((buf)+(12))>>2)]=stat.mode;
        HEAP32[(((buf)+(16))>>2)]=stat.nlink;
        HEAP32[(((buf)+(20))>>2)]=stat.uid;
        HEAP32[(((buf)+(24))>>2)]=stat.gid;
        HEAP32[(((buf)+(28))>>2)]=stat.rdev;
        HEAP32[(((buf)+(32))>>2)]=0;
        (tempI64 = [stat.size>>>0,(tempDouble=stat.size,(+(Math_abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? ((Math_min((+(Math_floor((tempDouble)/4294967296.0))), 4294967295.0))|0)>>>0 : (~~((+(Math_ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)],HEAP32[(((buf)+(40))>>2)]=tempI64[0],HEAP32[(((buf)+(44))>>2)]=tempI64[1]);
        HEAP32[(((buf)+(48))>>2)]=4096;
        HEAP32[(((buf)+(52))>>2)]=stat.blocks;
        HEAP32[(((buf)+(56))>>2)]=(stat.atime.getTime() / 1000)|0;
        HEAP32[(((buf)+(60))>>2)]=0;
        HEAP32[(((buf)+(64))>>2)]=(stat.mtime.getTime() / 1000)|0;
        HEAP32[(((buf)+(68))>>2)]=0;
        HEAP32[(((buf)+(72))>>2)]=(stat.ctime.getTime() / 1000)|0;
        HEAP32[(((buf)+(76))>>2)]=0;
        (tempI64 = [stat.ino>>>0,(tempDouble=stat.ino,(+(Math_abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? ((Math_min((+(Math_floor((tempDouble)/4294967296.0))), 4294967295.0))|0)>>>0 : (~~((+(Math_ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)],HEAP32[(((buf)+(80))>>2)]=tempI64[0],HEAP32[(((buf)+(84))>>2)]=tempI64[1]);
        return 0;
      },doMsync:function(addr, stream, len, flags, offset) {
        var buffer = HEAPU8.slice(addr, addr + len);
        FS.msync(stream, buffer, offset, len, flags);
      },doMkdir:function(path, mode) {
        // remove a trailing slash, if one - /a/b/ has basename of '', but
        // we want to create b in the context of this function
        path = PATH.normalize(path);
        if (path[path.length-1] === '/') path = path.substr(0, path.length-1);
        FS.mkdir(path, mode, 0);
        return 0;
      },doMknod:function(path, mode, dev) {
        // we don't want this in the JS API as it uses mknod to create all nodes.
        switch (mode & 61440) {
          case 32768:
          case 8192:
          case 24576:
          case 4096:
          case 49152:
            break;
          default: return -28;
        }
        FS.mknod(path, mode, dev);
        return 0;
      },doReadlink:function(path, buf, bufsize) {
        if (bufsize <= 0) return -28;
        var ret = FS.readlink(path);
  
        var len = Math.min(bufsize, lengthBytesUTF8(ret));
        var endChar = HEAP8[buf+len];
        stringToUTF8(ret, buf, bufsize+1);
        // readlink is one of the rare functions that write out a C string, but does never append a null to the output buffer(!)
        // stringToUTF8() always appends a null byte, so restore the character under the null byte after the write.
        HEAP8[buf+len] = endChar;
  
        return len;
      },doAccess:function(path, amode) {
        if (amode & ~7) {
          // need a valid mode
          return -28;
        }
        var node;
        var lookup = FS.lookupPath(path, { follow: true });
        node = lookup.node;
        if (!node) {
          return -44;
        }
        var perms = '';
        if (amode & 4) perms += 'r';
        if (amode & 2) perms += 'w';
        if (amode & 1) perms += 'x';
        if (perms /* otherwise, they've just passed F_OK */ && FS.nodePermissions(node, perms)) {
          return -2;
        }
        return 0;
      },doDup:function(path, flags, suggestFD) {
        var suggest = FS.getStream(suggestFD);
        if (suggest) FS.close(suggest);
        return FS.open(path, flags, 0, suggestFD, suggestFD).fd;
      },doReadv:function(stream, iov, iovcnt, offset) {
        var ret = 0;
        for (var i = 0; i < iovcnt; i++) {
          var ptr = HEAP32[(((iov)+(i*8))>>2)];
          var len = HEAP32[(((iov)+(i*8 + 4))>>2)];
          var curr = FS.read(stream, HEAP8,ptr, len, offset);
          if (curr < 0) return -1;
          ret += curr;
          if (curr < len) break; // nothing more to read
        }
        return ret;
      },doWritev:function(stream, iov, iovcnt, offset) {
        var ret = 0;
        for (var i = 0; i < iovcnt; i++) {
          var ptr = HEAP32[(((iov)+(i*8))>>2)];
          var len = HEAP32[(((iov)+(i*8 + 4))>>2)];
          var curr = FS.write(stream, HEAP8,ptr, len, offset);
          if (curr < 0) return -1;
          ret += curr;
        }
        return ret;
      },varargs:0,get:function(varargs) {
        SYSCALLS.varargs += 4;
        var ret = HEAP32[(((SYSCALLS.varargs)-(4))>>2)];
        return ret;
      },getStr:function() {
        var ret = UTF8ToString(SYSCALLS.get());
        return ret;
      },getStreamFromFD:function(fd) {
        // TODO: when all syscalls use wasi, can remove the next line
        if (fd === undefined) fd = SYSCALLS.get();
        var stream = FS.getStream(fd);
        if (!stream) throw new FS.ErrnoError(8);
        return stream;
      },get64:function() {
        var low = SYSCALLS.get(), high = SYSCALLS.get();
        return low;
      },getZero:function() {
        SYSCALLS.get();
      }};function ___syscall221(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // fcntl64
      var stream = SYSCALLS.getStreamFromFD(), cmd = SYSCALLS.get();
      switch (cmd) {
        case 0: {
          var arg = SYSCALLS.get();
          if (arg < 0) {
            return -28;
          }
          var newStream;
          newStream = FS.open(stream.path, stream.flags, 0, arg);
          return newStream.fd;
        }
        case 1:
        case 2:
          return 0;  // FD_CLOEXEC makes no sense for a single process.
        case 3:
          return stream.flags;
        case 4: {
          var arg = SYSCALLS.get();
          stream.flags |= arg;
          return 0;
        }
        case 12:
        /* case 12: Currently in musl F_GETLK64 has same value as F_GETLK, so omitted to avoid duplicate case blocks. If that changes, uncomment this */ {
          
          var arg = SYSCALLS.get();
          var offset = 0;
          // We're always unlocked.
          HEAP16[(((arg)+(offset))>>1)]=2;
          return 0;
        }
        case 13:
        case 14:
        /* case 13: Currently in musl F_SETLK64 has same value as F_SETLK, so omitted to avoid duplicate case blocks. If that changes, uncomment this */
        /* case 14: Currently in musl F_SETLKW64 has same value as F_SETLKW, so omitted to avoid duplicate case blocks. If that changes, uncomment this */
          
          
          return 0; // Pretend that the locking is successful.
        case 16:
        case 8:
          return -28; // These are for sockets. We don't have them fully implemented yet.
        case 9:
          // musl trusts getown return values, due to a bug where they must be, as they overlap with errors. just return -1 here, so fnctl() returns that, and we set errno ourselves.
          ___setErrNo(28);
          return -1;
        default: {
          return -28;
        }
      }
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall5(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // open
      var pathname = SYSCALLS.getStr(), flags = SYSCALLS.get(), mode = SYSCALLS.get(); // optional TODO
      var stream = FS.open(pathname, flags, mode);
      return stream.fd;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall54(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // ioctl
      var stream = SYSCALLS.getStreamFromFD(), op = SYSCALLS.get();
      switch (op) {
        case 21509:
        case 21505: {
          if (!stream.tty) return -59;
          return 0;
        }
        case 21510:
        case 21511:
        case 21512:
        case 21506:
        case 21507:
        case 21508: {
          if (!stream.tty) return -59;
          return 0; // no-op, not actually adjusting terminal settings
        }
        case 21519: {
          if (!stream.tty) return -59;
          var argp = SYSCALLS.get();
          HEAP32[((argp)>>2)]=0;
          return 0;
        }
        case 21520: {
          if (!stream.tty) return -59;
          return -28; // not supported
        }
        case 21531: {
          var argp = SYSCALLS.get();
          return FS.ioctl(stream, op, argp);
        }
        case 21523: {
          // TODO: in theory we should write to the winsize struct that gets
          // passed in, but for now musl doesn't read anything on it
          if (!stream.tty) return -59;
          return 0;
        }
        case 21524: {
          // TODO: technically, this ioctl call should change the window size.
          // but, since emscripten doesn't have any concept of a terminal window
          // yet, we'll just silently throw it away as we do TIOCGWINSZ
          if (!stream.tty) return -59;
          return 0;
        }
        default: abort('bad ioctl syscall ' + op);
      }
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  
  function __emscripten_syscall_munmap(addr, len) {
      if (addr === -1 || len === 0) {
        return -28;
      }
      // TODO: support unmmap'ing parts of allocations
      var info = SYSCALLS.mappings[addr];
      if (!info) return 0;
      if (len === info.len) {
        var stream = FS.getStream(info.fd);
        SYSCALLS.doMsync(addr, stream, len, info.flags, info.offset);
        FS.munmap(stream);
        SYSCALLS.mappings[addr] = null;
        if (info.allocated) {
          _free(info.malloc);
        }
      }
      return 0;
    }function ___syscall91(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // munmap
      var addr = SYSCALLS.get(), len = SYSCALLS.get();
      return __emscripten_syscall_munmap(addr, len);
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___unlock() {}

  
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
    }
  
  function runDestructors(destructors) {
      while (destructors.length) {
          var ptr = destructors.pop();
          var del = destructors.pop();
          del(ptr);
      }
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
    }
  
  function heap32VectorToArray(count, firstElement) {
      var array = [];
      for (var i = 0; i < count; i++) {
          array.push(HEAP32[(firstElement >> 2) + i]);
      }
      return array;
    }function __embind_register_class_class_function(
      rawClassType,
      methodName,
      argCount,
      rawArgTypesAddr,
      invokerSignature,
      rawInvoker,
      fn
    ) {
      var rawArgTypes = heap32VectorToArray(argCount, rawArgTypesAddr);
      methodName = readLatin1String(methodName);
      rawInvoker = embind__requireFunction(invokerSignature, rawInvoker);
      whenDependentTypesAreResolved([], [rawClassType], function(classType) {
          classType = classType[0];
          var humanName = classType.name + '.' + methodName;
  
          function unboundTypesHandler() {
              throwUnboundTypeError('Cannot call ' + humanName + ' due to unbound types', rawArgTypes);
          }
  
          var proto = classType.registeredClass.constructor;
          if (undefined === proto[methodName]) {
              // This is the first function to be registered with this name.
              unboundTypesHandler.argCount = argCount-1;
              proto[methodName] = unboundTypesHandler;
          } else {
              // There was an existing function with the same name registered. Set up a function overload routing table.
              ensureOverloadTable(proto, methodName, humanName);
              proto[methodName].overloadTable[argCount-1] = unboundTypesHandler;
          }
  
          whenDependentTypesAreResolved([], rawArgTypes, function(argTypes) {
              // Replace the initial unbound-types-handler stub with the proper function. If multiple overloads are registered,
              // the function handlers go into an overload table.
              var invokerArgsArray = [argTypes[0] /* return value */, null /* no class 'this'*/].concat(argTypes.slice(1) /* actual params */);
              var func = craftInvokerFunction(humanName, invokerArgsArray, null /* no class 'this'*/, rawInvoker, fn);
              if (undefined === proto[methodName].overloadTable) {
                  func.argCount = argCount-1;
                  proto[methodName] = func;
              } else {
                  proto[methodName].overloadTable[argCount-1] = func;
              }
              return [];
          });
          return [];
      });
    }

  function __embind_register_class_constructor(
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

  function __embind_register_class_function(
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

  
  function validateThis(this_, classType, humanName) {
      if (!(this_ instanceof Object)) {
          throwBindingError(humanName + ' with invalid "this": ' + this_);
      }
      if (!(this_ instanceof classType.registeredClass.constructor)) {
          throwBindingError(humanName + ' incompatible with "this" of type ' + this_.constructor.name);
      }
      if (!this_.$$.ptr) {
          throwBindingError('cannot call emscripten binding method ' + humanName + ' on deleted object');
      }
  
      // todo: kill this
      return upcastPointer(
          this_.$$.ptr,
          this_.$$.ptrType.registeredClass,
          classType.registeredClass);
    }function __embind_register_class_property(
      classType,
      fieldName,
      getterReturnType,
      getterSignature,
      getter,
      getterContext,
      setterArgumentType,
      setterSignature,
      setter,
      setterContext
    ) {
      fieldName = readLatin1String(fieldName);
      getter = embind__requireFunction(getterSignature, getter);
  
      whenDependentTypesAreResolved([], [classType], function(classType) {
          classType = classType[0];
          var humanName = classType.name + '.' + fieldName;
          var desc = {
              get: function() {
                  throwUnboundTypeError('Cannot access ' + humanName + ' due to unbound types', [getterReturnType, setterArgumentType]);
              },
              enumerable: true,
              configurable: true
          };
          if (setter) {
              desc.set = function() {
                  throwUnboundTypeError('Cannot access ' + humanName + ' due to unbound types', [getterReturnType, setterArgumentType]);
              };
          } else {
              desc.set = function(v) {
                  throwBindingError(humanName + ' is a read-only property');
              };
          }
  
          Object.defineProperty(classType.registeredClass.instancePrototype, fieldName, desc);
  
          whenDependentTypesAreResolved(
              [],
              (setter ? [getterReturnType, setterArgumentType] : [getterReturnType]),
          function(types) {
              var getterReturnType = types[0];
              var desc = {
                  get: function() {
                      var ptr = validateThis(this, classType, humanName + ' getter');
                      return getterReturnType['fromWireType'](getter(getterContext, ptr));
                  },
                  enumerable: true
              };
  
              if (setter) {
                  setter = embind__requireFunction(setterSignature, setter);
                  var setterArgumentType = types[1];
                  desc.set = function(v) {
                      var ptr = validateThis(this, classType, humanName + ' setter');
                      var destructors = [];
                      setter(setterContext, ptr, setterArgumentType['toWireType'](destructors, v));
                      runDestructors(destructors);
                  };
              }
  
              Object.defineProperty(classType.registeredClass.instancePrototype, fieldName, desc);
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

  
  function enumReadValueFromPointer(name, shift, signed) {
      switch (shift) {
          case 0: return function(pointer) {
              var heap = signed ? HEAP8 : HEAPU8;
              return this['fromWireType'](heap[pointer]);
          };
          case 1: return function(pointer) {
              var heap = signed ? HEAP16 : HEAPU16;
              return this['fromWireType'](heap[pointer >> 1]);
          };
          case 2: return function(pointer) {
              var heap = signed ? HEAP32 : HEAPU32;
              return this['fromWireType'](heap[pointer >> 2]);
          };
          default:
              throw new TypeError("Unknown integer type: " + name);
      }
    }function __embind_register_enum(
      rawType,
      name,
      size,
      isSigned
    ) {
      var shift = getShiftFromSize(size);
      name = readLatin1String(name);
  
      function ctor() {
      }
      ctor.values = {};
  
      registerType(rawType, {
          name: name,
          constructor: ctor,
          'fromWireType': function(c) {
              return this.constructor.values[c];
          },
          'toWireType': function(destructors, c) {
              return c.value;
          },
          'argPackAdvance': 8,
          'readValueFromPointer': enumReadValueFromPointer(name, shift, isSigned),
          destructorFunction: null,
      });
      exposePublicSymbol(name, ctor);
    }

  
  function requireRegisteredType(rawType, humanName) {
      var impl = registeredTypes[rawType];
      if (undefined === impl) {
          throwBindingError(humanName + " has unknown type " + getTypeName(rawType));
      }
      return impl;
    }function __embind_register_enum_value(
      rawEnumType,
      name,
      enumValue
    ) {
      var enumType = requireRegisteredType(rawEnumType, 'enum');
      name = readLatin1String(name);
  
      var Enum = enumType.constructor;
  
      var Value = Object.create(enumType.constructor.prototype, {
          value: {value: enumValue},
          constructor: {value: createNamedFunction(enumType.name + '_' + name, function() {})},
      });
      Enum.values[enumValue] = Value;
      Enum[name] = Value;
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

  function __embind_register_smart_ptr(
      rawType,
      rawPointeeType,
      name,
      sharingPolicy,
      getPointeeSignature,
      rawGetPointee,
      constructorSignature,
      rawConstructor,
      shareSignature,
      rawShare,
      destructorSignature,
      rawDestructor
    ) {
      name = readLatin1String(name);
      rawGetPointee = embind__requireFunction(getPointeeSignature, rawGetPointee);
      rawConstructor = embind__requireFunction(constructorSignature, rawConstructor);
      rawShare = embind__requireFunction(shareSignature, rawShare);
      rawDestructor = embind__requireFunction(destructorSignature, rawDestructor);
  
      whenDependentTypesAreResolved([rawType], [rawPointeeType], function(pointeeType) {
          pointeeType = pointeeType[0];
  
          var registeredPointer = new RegisteredPointer(
              name,
              pointeeType.registeredClass,
              false,
              false,
              // smart pointer properties
              true,
              pointeeType,
              sharingPolicy,
              rawGetPointee,
              rawConstructor,
              rawShare,
              rawDestructor);
          return [registeredPointer];
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

  
  function __emval_lookupTypes(argCount, argTypes, argWireTypes) {
      var a = new Array(argCount);
      for (var i = 0; i < argCount; ++i) {
          a[i] = requireRegisteredType(
              HEAP32[(argTypes >> 2) + i],
              "parameter " + i);
      }
      return a;
    }
  
  function requireHandle(handle) {
      if (!handle) {
          throwBindingError('Cannot use deleted val. handle = ' + handle);
      }
      return emval_handle_array[handle].value;
    }function __emval_call(handle, argCount, argTypes, argv) {
      handle = requireHandle(handle);
      var types = __emval_lookupTypes(argCount, argTypes);
  
      var args = new Array(argCount);
      for (var i = 0; i < argCount; ++i) {
          var type = types[i];
          args[i] = type['readValueFromPointer'](argv);
          argv += type['argPackAdvance'];
      }
  
      var rv = handle.apply(undefined, args);
      return __emval_register(rv);
    }


  function __emval_incref(handle) {
      if (handle > 4) {
          emval_handle_array[handle].refcount += 1;
      }
    }

  function __emval_take_value(type, argv) {
      type = requireRegisteredType(type, '_emval_take_value');
      var v = type['readValueFromPointer'](argv);
      return __emval_register(v);
    }

  function _abort() {
      abort();
    }

  function _emscripten_get_heap_size() {
      return HEAPU8.length;
    }

  function _emscripten_get_sbrk_ptr() {
      return 53744;
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

  
  
  var ENV={};
  
  function __getExecutableName() {
      return thisProgram || './this.program';
    }function _emscripten_get_environ() {
      if (!_emscripten_get_environ.strings) {
        // Default values.
        var env = {
          'USER': 'web_user',
          'LOGNAME': 'web_user',
          'PATH': '/',
          'PWD': '/',
          'HOME': '/home/web_user',
          // Browser language detection #8751
          'LANG': ((typeof navigator === 'object' && navigator.languages && navigator.languages[0]) || 'C').replace('-', '_') + '.UTF-8',
          '_': __getExecutableName()
        };
        // Apply the user-provided values, if any.
        for (var x in ENV) {
          env[x] = ENV[x];
        }
        var strings = [];
        for (var x in env) {
          strings.push(x + '=' + env[x]);
        }
        _emscripten_get_environ.strings = strings;
      }
      return _emscripten_get_environ.strings;
    }function _environ_get(__environ, environ_buf) {
      var strings = _emscripten_get_environ();
      var bufSize = 0;
      strings.forEach(function(string, i) {
        var ptr = environ_buf + bufSize;
        HEAP32[(((__environ)+(i * 4))>>2)]=ptr;
        writeAsciiToMemory(string, ptr);
        bufSize += string.length + 1;
      });
      return 0;
    }

  function _environ_sizes_get(penviron_count, penviron_buf_size) {
      var strings = _emscripten_get_environ();
      HEAP32[((penviron_count)>>2)]=strings.length;
      var bufSize = 0;
      strings.forEach(function(string) {
        bufSize += string.length + 1;
      });
      HEAP32[((penviron_buf_size)>>2)]=bufSize;
      return 0;
    }

  function _exit(status) {
      // void _exit(int status);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/exit.html
      exit(status);
    }

  function _fd_close(fd) {try {
  
      var stream = SYSCALLS.getStreamFromFD(fd);
      FS.close(stream);
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return e.errno;
  }
  }

  function _fd_read(fd, iov, iovcnt, pnum) {try {
  
      var stream = SYSCALLS.getStreamFromFD(fd);
      var num = SYSCALLS.doReadv(stream, iov, iovcnt);
      HEAP32[((pnum)>>2)]=num
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return e.errno;
  }
  }

  function _fd_seek(fd, offset_low, offset_high, whence, newOffset) {try {
  
      var stream = SYSCALLS.getStreamFromFD(fd);
      var HIGH_OFFSET = 0x100000000; // 2^32
      // use an unsigned operator on low and shift high by 32-bits
      var offset = offset_high * HIGH_OFFSET + (offset_low >>> 0);
  
      var DOUBLE_LIMIT = 0x20000000000000; // 2^53
      // we also check for equality since DOUBLE_LIMIT + 1 == DOUBLE_LIMIT
      if (offset <= -DOUBLE_LIMIT || offset >= DOUBLE_LIMIT) {
        return -61;
      }
  
      FS.llseek(stream, offset, whence);
      (tempI64 = [stream.position>>>0,(tempDouble=stream.position,(+(Math_abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? ((Math_min((+(Math_floor((tempDouble)/4294967296.0))), 4294967295.0))|0)>>>0 : (~~((+(Math_ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)],HEAP32[((newOffset)>>2)]=tempI64[0],HEAP32[(((newOffset)+(4))>>2)]=tempI64[1]);
      if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null; // reset readdir state
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return e.errno;
  }
  }

  function _fd_write(fd, iov, iovcnt, pnum) {try {
  
      var stream = SYSCALLS.getStreamFromFD(fd);
      var num = SYSCALLS.doWritev(stream, iov, iovcnt);
      HEAP32[((pnum)>>2)]=num
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return e.errno;
  }
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

  
  function _round(d) {
      d = +d;
      return d >= +0 ? +Math_floor(d + +0.5) : +Math_ceil(d - +0.5);
    }

  function _setTempRet0($i) {
      setTempRet0(($i) | 0);
    }

  
  
  function __isLeapYear(year) {
        return year%4 === 0 && (year%100 !== 0 || year%400 === 0);
    }
  
  function __arraySum(array, index) {
      var sum = 0;
      for (var i = 0; i <= index; sum += array[i++]);
      return sum;
    }
  
  
  var __MONTH_DAYS_LEAP=[31,29,31,30,31,30,31,31,30,31,30,31];
  
  var __MONTH_DAYS_REGULAR=[31,28,31,30,31,30,31,31,30,31,30,31];function __addDays(date, days) {
      var newDate = new Date(date.getTime());
      while(days > 0) {
        var leap = __isLeapYear(newDate.getFullYear());
        var currentMonth = newDate.getMonth();
        var daysInCurrentMonth = (leap ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR)[currentMonth];
  
        if (days > daysInCurrentMonth-newDate.getDate()) {
          // we spill over to next month
          days -= (daysInCurrentMonth-newDate.getDate()+1);
          newDate.setDate(1);
          if (currentMonth < 11) {
            newDate.setMonth(currentMonth+1)
          } else {
            newDate.setMonth(0);
            newDate.setFullYear(newDate.getFullYear()+1);
          }
        } else {
          // we stay in current month
          newDate.setDate(newDate.getDate()+days);
          return newDate;
        }
      }
  
      return newDate;
    }function _strftime(s, maxsize, format, tm) {
      // size_t strftime(char *restrict s, size_t maxsize, const char *restrict format, const struct tm *restrict timeptr);
      // http://pubs.opengroup.org/onlinepubs/009695399/functions/strftime.html
  
      var tm_zone = HEAP32[(((tm)+(40))>>2)];
  
      var date = {
        tm_sec: HEAP32[((tm)>>2)],
        tm_min: HEAP32[(((tm)+(4))>>2)],
        tm_hour: HEAP32[(((tm)+(8))>>2)],
        tm_mday: HEAP32[(((tm)+(12))>>2)],
        tm_mon: HEAP32[(((tm)+(16))>>2)],
        tm_year: HEAP32[(((tm)+(20))>>2)],
        tm_wday: HEAP32[(((tm)+(24))>>2)],
        tm_yday: HEAP32[(((tm)+(28))>>2)],
        tm_isdst: HEAP32[(((tm)+(32))>>2)],
        tm_gmtoff: HEAP32[(((tm)+(36))>>2)],
        tm_zone: tm_zone ? UTF8ToString(tm_zone) : ''
      };
  
      var pattern = UTF8ToString(format);
  
      // expand format
      var EXPANSION_RULES_1 = {
        '%c': '%a %b %d %H:%M:%S %Y',     // Replaced by the locale's appropriate date and time representation - e.g., Mon Aug  3 14:02:01 2013
        '%D': '%m/%d/%y',                 // Equivalent to %m / %d / %y
        '%F': '%Y-%m-%d',                 // Equivalent to %Y - %m - %d
        '%h': '%b',                       // Equivalent to %b
        '%r': '%I:%M:%S %p',              // Replaced by the time in a.m. and p.m. notation
        '%R': '%H:%M',                    // Replaced by the time in 24-hour notation
        '%T': '%H:%M:%S',                 // Replaced by the time
        '%x': '%m/%d/%y',                 // Replaced by the locale's appropriate date representation
        '%X': '%H:%M:%S',                 // Replaced by the locale's appropriate time representation
        // Modified Conversion Specifiers
        '%Ec': '%c',                      // Replaced by the locale's alternative appropriate date and time representation.
        '%EC': '%C',                      // Replaced by the name of the base year (period) in the locale's alternative representation.
        '%Ex': '%m/%d/%y',                // Replaced by the locale's alternative date representation.
        '%EX': '%H:%M:%S',                // Replaced by the locale's alternative time representation.
        '%Ey': '%y',                      // Replaced by the offset from %EC (year only) in the locale's alternative representation.
        '%EY': '%Y',                      // Replaced by the full alternative year representation.
        '%Od': '%d',                      // Replaced by the day of the month, using the locale's alternative numeric symbols, filled as needed with leading zeros if there is any alternative symbol for zero; otherwise, with leading <space> characters.
        '%Oe': '%e',                      // Replaced by the day of the month, using the locale's alternative numeric symbols, filled as needed with leading <space> characters.
        '%OH': '%H',                      // Replaced by the hour (24-hour clock) using the locale's alternative numeric symbols.
        '%OI': '%I',                      // Replaced by the hour (12-hour clock) using the locale's alternative numeric symbols.
        '%Om': '%m',                      // Replaced by the month using the locale's alternative numeric symbols.
        '%OM': '%M',                      // Replaced by the minutes using the locale's alternative numeric symbols.
        '%OS': '%S',                      // Replaced by the seconds using the locale's alternative numeric symbols.
        '%Ou': '%u',                      // Replaced by the weekday as a number in the locale's alternative representation (Monday=1).
        '%OU': '%U',                      // Replaced by the week number of the year (Sunday as the first day of the week, rules corresponding to %U ) using the locale's alternative numeric symbols.
        '%OV': '%V',                      // Replaced by the week number of the year (Monday as the first day of the week, rules corresponding to %V ) using the locale's alternative numeric symbols.
        '%Ow': '%w',                      // Replaced by the number of the weekday (Sunday=0) using the locale's alternative numeric symbols.
        '%OW': '%W',                      // Replaced by the week number of the year (Monday as the first day of the week) using the locale's alternative numeric symbols.
        '%Oy': '%y',                      // Replaced by the year (offset from %C ) using the locale's alternative numeric symbols.
      };
      for (var rule in EXPANSION_RULES_1) {
        pattern = pattern.replace(new RegExp(rule, 'g'), EXPANSION_RULES_1[rule]);
      }
  
      var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  
      function leadingSomething(value, digits, character) {
        var str = typeof value === 'number' ? value.toString() : (value || '');
        while (str.length < digits) {
          str = character[0]+str;
        }
        return str;
      }
  
      function leadingNulls(value, digits) {
        return leadingSomething(value, digits, '0');
      }
  
      function compareByDay(date1, date2) {
        function sgn(value) {
          return value < 0 ? -1 : (value > 0 ? 1 : 0);
        }
  
        var compare;
        if ((compare = sgn(date1.getFullYear()-date2.getFullYear())) === 0) {
          if ((compare = sgn(date1.getMonth()-date2.getMonth())) === 0) {
            compare = sgn(date1.getDate()-date2.getDate());
          }
        }
        return compare;
      }
  
      function getFirstWeekStartDate(janFourth) {
          switch (janFourth.getDay()) {
            case 0: // Sunday
              return new Date(janFourth.getFullYear()-1, 11, 29);
            case 1: // Monday
              return janFourth;
            case 2: // Tuesday
              return new Date(janFourth.getFullYear(), 0, 3);
            case 3: // Wednesday
              return new Date(janFourth.getFullYear(), 0, 2);
            case 4: // Thursday
              return new Date(janFourth.getFullYear(), 0, 1);
            case 5: // Friday
              return new Date(janFourth.getFullYear()-1, 11, 31);
            case 6: // Saturday
              return new Date(janFourth.getFullYear()-1, 11, 30);
          }
      }
  
      function getWeekBasedYear(date) {
          var thisDate = __addDays(new Date(date.tm_year+1900, 0, 1), date.tm_yday);
  
          var janFourthThisYear = new Date(thisDate.getFullYear(), 0, 4);
          var janFourthNextYear = new Date(thisDate.getFullYear()+1, 0, 4);
  
          var firstWeekStartThisYear = getFirstWeekStartDate(janFourthThisYear);
          var firstWeekStartNextYear = getFirstWeekStartDate(janFourthNextYear);
  
          if (compareByDay(firstWeekStartThisYear, thisDate) <= 0) {
            // this date is after the start of the first week of this year
            if (compareByDay(firstWeekStartNextYear, thisDate) <= 0) {
              return thisDate.getFullYear()+1;
            } else {
              return thisDate.getFullYear();
            }
          } else {
            return thisDate.getFullYear()-1;
          }
      }
  
      var EXPANSION_RULES_2 = {
        '%a': function(date) {
          return WEEKDAYS[date.tm_wday].substring(0,3);
        },
        '%A': function(date) {
          return WEEKDAYS[date.tm_wday];
        },
        '%b': function(date) {
          return MONTHS[date.tm_mon].substring(0,3);
        },
        '%B': function(date) {
          return MONTHS[date.tm_mon];
        },
        '%C': function(date) {
          var year = date.tm_year+1900;
          return leadingNulls((year/100)|0,2);
        },
        '%d': function(date) {
          return leadingNulls(date.tm_mday, 2);
        },
        '%e': function(date) {
          return leadingSomething(date.tm_mday, 2, ' ');
        },
        '%g': function(date) {
          // %g, %G, and %V give values according to the ISO 8601:2000 standard week-based year.
          // In this system, weeks begin on a Monday and week 1 of the year is the week that includes
          // January 4th, which is also the week that includes the first Thursday of the year, and
          // is also the first week that contains at least four days in the year.
          // If the first Monday of January is the 2nd, 3rd, or 4th, the preceding days are part of
          // the last week of the preceding year; thus, for Saturday 2nd January 1999,
          // %G is replaced by 1998 and %V is replaced by 53. If December 29th, 30th,
          // or 31st is a Monday, it and any following days are part of week 1 of the following year.
          // Thus, for Tuesday 30th December 1997, %G is replaced by 1998 and %V is replaced by 01.
  
          return getWeekBasedYear(date).toString().substring(2);
        },
        '%G': function(date) {
          return getWeekBasedYear(date);
        },
        '%H': function(date) {
          return leadingNulls(date.tm_hour, 2);
        },
        '%I': function(date) {
          var twelveHour = date.tm_hour;
          if (twelveHour == 0) twelveHour = 12;
          else if (twelveHour > 12) twelveHour -= 12;
          return leadingNulls(twelveHour, 2);
        },
        '%j': function(date) {
          // Day of the year (001-366)
          return leadingNulls(date.tm_mday+__arraySum(__isLeapYear(date.tm_year+1900) ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR, date.tm_mon-1), 3);
        },
        '%m': function(date) {
          return leadingNulls(date.tm_mon+1, 2);
        },
        '%M': function(date) {
          return leadingNulls(date.tm_min, 2);
        },
        '%n': function() {
          return '\n';
        },
        '%p': function(date) {
          if (date.tm_hour >= 0 && date.tm_hour < 12) {
            return 'AM';
          } else {
            return 'PM';
          }
        },
        '%S': function(date) {
          return leadingNulls(date.tm_sec, 2);
        },
        '%t': function() {
          return '\t';
        },
        '%u': function(date) {
          return date.tm_wday || 7;
        },
        '%U': function(date) {
          // Replaced by the week number of the year as a decimal number [00,53].
          // The first Sunday of January is the first day of week 1;
          // days in the new year before this are in week 0. [ tm_year, tm_wday, tm_yday]
          var janFirst = new Date(date.tm_year+1900, 0, 1);
          var firstSunday = janFirst.getDay() === 0 ? janFirst : __addDays(janFirst, 7-janFirst.getDay());
          var endDate = new Date(date.tm_year+1900, date.tm_mon, date.tm_mday);
  
          // is target date after the first Sunday?
          if (compareByDay(firstSunday, endDate) < 0) {
            // calculate difference in days between first Sunday and endDate
            var februaryFirstUntilEndMonth = __arraySum(__isLeapYear(endDate.getFullYear()) ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR, endDate.getMonth()-1)-31;
            var firstSundayUntilEndJanuary = 31-firstSunday.getDate();
            var days = firstSundayUntilEndJanuary+februaryFirstUntilEndMonth+endDate.getDate();
            return leadingNulls(Math.ceil(days/7), 2);
          }
  
          return compareByDay(firstSunday, janFirst) === 0 ? '01': '00';
        },
        '%V': function(date) {
          // Replaced by the week number of the year (Monday as the first day of the week)
          // as a decimal number [01,53]. If the week containing 1 January has four
          // or more days in the new year, then it is considered week 1.
          // Otherwise, it is the last week of the previous year, and the next week is week 1.
          // Both January 4th and the first Thursday of January are always in week 1. [ tm_year, tm_wday, tm_yday]
          var janFourthThisYear = new Date(date.tm_year+1900, 0, 4);
          var janFourthNextYear = new Date(date.tm_year+1901, 0, 4);
  
          var firstWeekStartThisYear = getFirstWeekStartDate(janFourthThisYear);
          var firstWeekStartNextYear = getFirstWeekStartDate(janFourthNextYear);
  
          var endDate = __addDays(new Date(date.tm_year+1900, 0, 1), date.tm_yday);
  
          if (compareByDay(endDate, firstWeekStartThisYear) < 0) {
            // if given date is before this years first week, then it belongs to the 53rd week of last year
            return '53';
          }
  
          if (compareByDay(firstWeekStartNextYear, endDate) <= 0) {
            // if given date is after next years first week, then it belongs to the 01th week of next year
            return '01';
          }
  
          // given date is in between CW 01..53 of this calendar year
          var daysDifference;
          if (firstWeekStartThisYear.getFullYear() < date.tm_year+1900) {
            // first CW of this year starts last year
            daysDifference = date.tm_yday+32-firstWeekStartThisYear.getDate()
          } else {
            // first CW of this year starts this year
            daysDifference = date.tm_yday+1-firstWeekStartThisYear.getDate();
          }
          return leadingNulls(Math.ceil(daysDifference/7), 2);
        },
        '%w': function(date) {
          return date.tm_wday;
        },
        '%W': function(date) {
          // Replaced by the week number of the year as a decimal number [00,53].
          // The first Monday of January is the first day of week 1;
          // days in the new year before this are in week 0. [ tm_year, tm_wday, tm_yday]
          var janFirst = new Date(date.tm_year, 0, 1);
          var firstMonday = janFirst.getDay() === 1 ? janFirst : __addDays(janFirst, janFirst.getDay() === 0 ? 1 : 7-janFirst.getDay()+1);
          var endDate = new Date(date.tm_year+1900, date.tm_mon, date.tm_mday);
  
          // is target date after the first Monday?
          if (compareByDay(firstMonday, endDate) < 0) {
            var februaryFirstUntilEndMonth = __arraySum(__isLeapYear(endDate.getFullYear()) ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR, endDate.getMonth()-1)-31;
            var firstMondayUntilEndJanuary = 31-firstMonday.getDate();
            var days = firstMondayUntilEndJanuary+februaryFirstUntilEndMonth+endDate.getDate();
            return leadingNulls(Math.ceil(days/7), 2);
          }
          return compareByDay(firstMonday, janFirst) === 0 ? '01': '00';
        },
        '%y': function(date) {
          // Replaced by the last two digits of the year as a decimal number [00,99]. [ tm_year]
          return (date.tm_year+1900).toString().substring(2);
        },
        '%Y': function(date) {
          // Replaced by the year as a decimal number (for example, 1997). [ tm_year]
          return date.tm_year+1900;
        },
        '%z': function(date) {
          // Replaced by the offset from UTC in the ISO 8601:2000 standard format ( +hhmm or -hhmm ).
          // For example, "-0430" means 4 hours 30 minutes behind UTC (west of Greenwich).
          var off = date.tm_gmtoff;
          var ahead = off >= 0;
          off = Math.abs(off) / 60;
          // convert from minutes into hhmm format (which means 60 minutes = 100 units)
          off = (off / 60)*100 + (off % 60);
          return (ahead ? '+' : '-') + String("0000" + off).slice(-4);
        },
        '%Z': function(date) {
          return date.tm_zone;
        },
        '%%': function() {
          return '%';
        }
      };
      for (var rule in EXPANSION_RULES_2) {
        if (pattern.indexOf(rule) >= 0) {
          pattern = pattern.replace(new RegExp(rule, 'g'), EXPANSION_RULES_2[rule](date));
        }
      }
  
      var bytes = intArrayFromString(pattern, false);
      if (bytes.length > maxsize) {
        return 0;
      }
  
      writeArrayToMemory(bytes, s);
      return bytes.length-1;
    }function _strftime_l(s, maxsize, format, tm) {
      return _strftime(s, maxsize, format, tm); // no locale support yet
    }
FS.staticInit();;
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


// ASM_LIBRARY EXTERN PRIMITIVES: Int8Array,Int32Array,Math_floor,Math_ceil

var asmGlobalArg = {};
var asmLibraryArg = { "__assert_fail": ___assert_fail, "__cxa_allocate_exception": ___cxa_allocate_exception, "__cxa_atexit": ___cxa_atexit, "__cxa_throw": ___cxa_throw, "__lock": ___lock, "__map_file": ___map_file, "__syscall221": ___syscall221, "__syscall5": ___syscall5, "__syscall54": ___syscall54, "__syscall91": ___syscall91, "__unlock": ___unlock, "_embind_register_bool": __embind_register_bool, "_embind_register_class": __embind_register_class, "_embind_register_class_class_function": __embind_register_class_class_function, "_embind_register_class_constructor": __embind_register_class_constructor, "_embind_register_class_function": __embind_register_class_function, "_embind_register_class_property": __embind_register_class_property, "_embind_register_emval": __embind_register_emval, "_embind_register_enum": __embind_register_enum, "_embind_register_enum_value": __embind_register_enum_value, "_embind_register_float": __embind_register_float, "_embind_register_integer": __embind_register_integer, "_embind_register_memory_view": __embind_register_memory_view, "_embind_register_smart_ptr": __embind_register_smart_ptr, "_embind_register_std_string": __embind_register_std_string, "_embind_register_std_wstring": __embind_register_std_wstring, "_embind_register_void": __embind_register_void, "_emval_call": __emval_call, "_emval_decref": __emval_decref, "_emval_incref": __emval_incref, "_emval_take_value": __emval_take_value, "abort": _abort, "emscripten_get_sbrk_ptr": _emscripten_get_sbrk_ptr, "emscripten_memcpy_big": _emscripten_memcpy_big, "emscripten_resize_heap": _emscripten_resize_heap, "environ_get": _environ_get, "environ_sizes_get": _environ_sizes_get, "exit": _exit, "fd_close": _fd_close, "fd_read": _fd_read, "fd_seek": _fd_seek, "fd_write": _fd_write, "memory": wasmMemory, "round": _round, "setTempRet0": _setTempRet0, "strftime_l": _strftime_l, "table": wasmTable };
var asm = createWasm();
var ___wasm_call_ctors = Module["___wasm_call_ctors"] = asm["__wasm_call_ctors"];
var _malloc = Module["_malloc"] = asm["malloc"];
var _free = Module["_free"] = asm["free"];
var ___errno_location = Module["___errno_location"] = asm["__errno_location"];
var _setThrew = Module["_setThrew"] = asm["setThrew"];
var __ZSt18uncaught_exceptionv = Module["__ZSt18uncaught_exceptionv"] = asm["_ZSt18uncaught_exceptionv"];
var ___getTypeName = Module["___getTypeName"] = asm["__getTypeName"];
var ___embind_register_native_and_builtin_types = Module["___embind_register_native_and_builtin_types"] = asm["__embind_register_native_and_builtin_types"];
var stackSave = Module["stackSave"] = asm["stackSave"];
var stackAlloc = Module["stackAlloc"] = asm["stackAlloc"];
var stackRestore = Module["stackRestore"] = asm["stackRestore"];
var __growWasmMemory = Module["__growWasmMemory"] = asm["__growWasmMemory"];
var dynCall_ii = Module["dynCall_ii"] = asm["dynCall_ii"];
var dynCall_vi = Module["dynCall_vi"] = asm["dynCall_vi"];
var dynCall_i = Module["dynCall_i"] = asm["dynCall_i"];
var dynCall_vii = Module["dynCall_vii"] = asm["dynCall_vii"];
var dynCall_viiii = Module["dynCall_viiii"] = asm["dynCall_viiii"];
var dynCall_viii = Module["dynCall_viii"] = asm["dynCall_viii"];
var dynCall_did = Module["dynCall_did"] = asm["dynCall_did"];
var dynCall_diid = Module["dynCall_diid"] = asm["dynCall_diid"];
var dynCall_diddd = Module["dynCall_diddd"] = asm["dynCall_diddd"];
var dynCall_diiddd = Module["dynCall_diiddd"] = asm["dynCall_diiddd"];
var dynCall_didd = Module["dynCall_didd"] = asm["dynCall_didd"];
var dynCall_diidd = Module["dynCall_diidd"] = asm["dynCall_diidd"];
var dynCall_di = Module["dynCall_di"] = asm["dynCall_di"];
var dynCall_dii = Module["dynCall_dii"] = asm["dynCall_dii"];
var dynCall_vid = Module["dynCall_vid"] = asm["dynCall_vid"];
var dynCall_viid = Module["dynCall_viid"] = asm["dynCall_viid"];
var dynCall_diii = Module["dynCall_diii"] = asm["dynCall_diii"];
var dynCall_diiii = Module["dynCall_diiii"] = asm["dynCall_diiii"];
var dynCall_viiid = Module["dynCall_viiid"] = asm["dynCall_viiid"];
var dynCall_iii = Module["dynCall_iii"] = asm["dynCall_iii"];
var dynCall_didid = Module["dynCall_didid"] = asm["dynCall_didid"];
var dynCall_diidid = Module["dynCall_diidid"] = asm["dynCall_diidid"];
var dynCall_dididi = Module["dynCall_dididi"] = asm["dynCall_dididi"];
var dynCall_diididi = Module["dynCall_diididi"] = asm["dynCall_diididi"];
var dynCall_vidid = Module["dynCall_vidid"] = asm["dynCall_vidid"];
var dynCall_viidid = Module["dynCall_viidid"] = asm["dynCall_viidid"];
var dynCall_vididd = Module["dynCall_vididd"] = asm["dynCall_vididd"];
var dynCall_viididd = Module["dynCall_viididd"] = asm["dynCall_viididd"];
var dynCall_vididdd = Module["dynCall_vididdd"] = asm["dynCall_vididdd"];
var dynCall_viididdd = Module["dynCall_viididdd"] = asm["dynCall_viididdd"];
var dynCall_vidddi = Module["dynCall_vidddi"] = asm["dynCall_vidddi"];
var dynCall_viidddi = Module["dynCall_viidddi"] = asm["dynCall_viidddi"];
var dynCall_iiiid = Module["dynCall_iiiid"] = asm["dynCall_iiiid"];
var dynCall_dddd = Module["dynCall_dddd"] = asm["dynCall_dddd"];
var dynCall_vidd = Module["dynCall_vidd"] = asm["dynCall_vidd"];
var dynCall_viidd = Module["dynCall_viidd"] = asm["dynCall_viidd"];
var dynCall_iiii = Module["dynCall_iiii"] = asm["dynCall_iiii"];
var dynCall_iiiii = Module["dynCall_iiiii"] = asm["dynCall_iiiii"];
var dynCall_viffii = Module["dynCall_viffii"] = asm["dynCall_viffii"];
var dynCall_viiffii = Module["dynCall_viiffii"] = asm["dynCall_viiffii"];
var dynCall_diddidd = Module["dynCall_diddidd"] = asm["dynCall_diddidd"];
var dynCall_diiddidd = Module["dynCall_diiddidd"] = asm["dynCall_diiddidd"];
var dynCall_diddddd = Module["dynCall_diddddd"] = asm["dynCall_diddddd"];
var dynCall_diiddddd = Module["dynCall_diiddddd"] = asm["dynCall_diiddddd"];
var dynCall_didddii = Module["dynCall_didddii"] = asm["dynCall_didddii"];
var dynCall_diidddii = Module["dynCall_diidddii"] = asm["dynCall_diidddii"];
var dynCall_didddddii = Module["dynCall_didddddii"] = asm["dynCall_didddddii"];
var dynCall_diidddddii = Module["dynCall_diidddddii"] = asm["dynCall_diidddddii"];
var dynCall_didi = Module["dynCall_didi"] = asm["dynCall_didi"];
var dynCall_diidi = Module["dynCall_diidi"] = asm["dynCall_diidi"];
var dynCall_dd = Module["dynCall_dd"] = asm["dynCall_dd"];
var dynCall_dididdd = Module["dynCall_dididdd"] = asm["dynCall_dididdd"];
var dynCall_diididdd = Module["dynCall_diididdd"] = asm["dynCall_diididdd"];
var dynCall_ddd = Module["dynCall_ddd"] = asm["dynCall_ddd"];
var dynCall_diddi = Module["dynCall_diddi"] = asm["dynCall_diddi"];
var dynCall_diiddi = Module["dynCall_diiddi"] = asm["dynCall_diiddi"];
var dynCall_vidi = Module["dynCall_vidi"] = asm["dynCall_vidi"];
var dynCall_viidi = Module["dynCall_viidi"] = asm["dynCall_viidi"];
var dynCall_viiiii = Module["dynCall_viiiii"] = asm["dynCall_viiiii"];
var dynCall_iifi = Module["dynCall_iifi"] = asm["dynCall_iifi"];
var dynCall_iiifi = Module["dynCall_iiifi"] = asm["dynCall_iiifi"];
var dynCall_fi = Module["dynCall_fi"] = asm["dynCall_fi"];
var dynCall_fii = Module["dynCall_fii"] = asm["dynCall_fii"];
var dynCall_fiiii = Module["dynCall_fiiii"] = asm["dynCall_fiiii"];
var dynCall_fiiiii = Module["dynCall_fiiiii"] = asm["dynCall_fiiiii"];
var dynCall_viiiidd = Module["dynCall_viiiidd"] = asm["dynCall_viiiidd"];
var dynCall_viiiiidd = Module["dynCall_viiiiidd"] = asm["dynCall_viiiiidd"];
var dynCall_viif = Module["dynCall_viif"] = asm["dynCall_viif"];
var dynCall_viiif = Module["dynCall_viiif"] = asm["dynCall_viiif"];
var dynCall_iiiif = Module["dynCall_iiiif"] = asm["dynCall_iiiif"];
var dynCall_diddid = Module["dynCall_diddid"] = asm["dynCall_diddid"];
var dynCall_diiddid = Module["dynCall_diiddid"] = asm["dynCall_diiddid"];
var dynCall_didddid = Module["dynCall_didddid"] = asm["dynCall_didddid"];
var dynCall_diidddid = Module["dynCall_diidddid"] = asm["dynCall_diidddid"];
var dynCall_didddi = Module["dynCall_didddi"] = asm["dynCall_didddi"];
var dynCall_diidddi = Module["dynCall_diidddi"] = asm["dynCall_diidddi"];
var dynCall_iid = Module["dynCall_iid"] = asm["dynCall_iid"];
var dynCall_id = Module["dynCall_id"] = asm["dynCall_id"];
var dynCall_didii = Module["dynCall_didii"] = asm["dynCall_didii"];
var dynCall_diidii = Module["dynCall_diidii"] = asm["dynCall_diidii"];
var dynCall_viijii = Module["dynCall_viijii"] = asm["dynCall_viijii"];
var dynCall_jiji = Module["dynCall_jiji"] = asm["dynCall_jiji"];
var dynCall_iidiiii = Module["dynCall_iidiiii"] = asm["dynCall_iidiiii"];
var dynCall_iiiiii = Module["dynCall_iiiiii"] = asm["dynCall_iiiiii"];
var dynCall_iiiiiiiii = Module["dynCall_iiiiiiiii"] = asm["dynCall_iiiiiiiii"];
var dynCall_iiiiiii = Module["dynCall_iiiiiii"] = asm["dynCall_iiiiiii"];
var dynCall_iiiiij = Module["dynCall_iiiiij"] = asm["dynCall_iiiiij"];
var dynCall_iiiiid = Module["dynCall_iiiiid"] = asm["dynCall_iiiiid"];
var dynCall_iiiiijj = Module["dynCall_iiiiijj"] = asm["dynCall_iiiiijj"];
var dynCall_iiiiiiii = Module["dynCall_iiiiiiii"] = asm["dynCall_iiiiiiii"];
var dynCall_iiiiiijj = Module["dynCall_iiiiiijj"] = asm["dynCall_iiiiiijj"];
var dynCall_viiiiii = Module["dynCall_viiiiii"] = asm["dynCall_viiiiii"];
var dynCall_v = Module["dynCall_v"] = asm["dynCall_v"];



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
	"running%c Maximilian v2.2.0 (Wasm)",
	"font-weight: bold; background: #222; color: #bada55"
);



//NOTE: This is the main thing that post.js adds to Maximilian setup, a Module export definition which is required for the WASM design pattern
export default Module;


"use strict";
/*Compiled using Cheerp (R) by Leaning Technologies Ltd*/
var oSlot=0;var nullArray=[null];var nullObj={d:nullArray,o:0};
function __Z7webMainv(){
	var tmp0=null;
	tmp0=_cheerpCreate_ZN6client6StringC2EPKc();
	console.log(tmp0);
}
function _cheerpCreate_ZN6client6StringC2EPKc(){
	var tmp0=0,Lgeptoindexphi=0,tmp2=null,tmp3=null;
	tmp2=String();
	Lgeptoindexphi=0;
	tmp0=77;
	while(1){
		tmp3=String.fromCharCode(tmp0<<24>>24);
		tmp2=tmp2.concat(tmp3);
		Lgeptoindexphi=Lgeptoindexphi+1|0;
		tmp0=_$pstr[0+Lgeptoindexphi|0]|0;
		if((tmp0&255)!==0)continue;
		break;
	}
	return String(tmp2);
}
function __ZN10maxiBiquadC1Ev(Larg0){
	var L$poptgep$poptgep6$poptgepsqueezed=null;
	Larg0.d0=0;
	Larg0.d1=0;
	Larg0.d2=0;
	Larg0.d3=0;
	Larg0.d4=0;
	Larg0.d6=1.4142135623730951;
	L$poptgep$poptgep6$poptgepsqueezed=Larg0.a7;
	L$poptgep$poptgep6$poptgepsqueezed[0]=0;
	L$poptgep$poptgep6$poptgepsqueezed[1]=0;
	L$poptgep$poptgep6$poptgepsqueezed[2]=0;
}
function __ZN10maxiBiquad3setENS_11filterTypesEddd(Larg0,Larg1,Larg2,Larg3,Larg4){
	var tmp0=-0.,tmp1=-0.,tmp2=-0.,tmp3=-0.,tmp4=-0.,tmp5=-0.;
	tmp0=+Math.abs(Larg4);
	tmp0=+Math.pow(10,tmp0/20);
	tmp1=+Math.tan(Larg2*3.1415926535897931/(+(__ZN12maxiSettings10sampleRateE|0)));
	switch(Larg1|0){
		case 0:
		tmp2=tmp1*tmp1;
		tmp1/=Larg3;
		tmp0=1/(tmp2+(tmp1+1));
		tmp3=tmp2*tmp0;
		Larg0.d0=tmp3;
		Larg0.d1=tmp3*2;
		Larg0.d2=tmp3;
		Larg0.d3=(tmp2+-1)*2*tmp0;
		Larg0.d4=(tmp2+(1-tmp1))*tmp0;
		break;
		case 1:
		tmp3=tmp1*tmp1;
		tmp1/=Larg3;
		tmp0=1/(tmp3+(tmp1+1));
		Larg0.d0=tmp0;
		Larg0.d1=tmp0*-2;
		Larg0.d2=tmp0;
		Larg0.d3=(tmp3+-1)*2*tmp0;
		Larg0.d4=(tmp3+(1-tmp1))*tmp0;
		break;
		case 2:
		tmp2=tmp1*tmp1;
		tmp1/=Larg3;
		tmp0=1/(tmp2+(tmp1+1));
		tmp3=tmp1*tmp0;
		Larg0.d0=tmp3;
		Larg0.d1=0;
		Larg0.d2=-tmp3;
		Larg0.d3=(tmp2+-1)*2*tmp0;
		Larg0.d4=(tmp2+(1-tmp1))*tmp0;
		break;
		case 3:
		tmp4=tmp1*tmp1;
		tmp1/=Larg3;
		tmp0=1/(tmp4+(tmp1+1));
		tmp3=(tmp4+1)*tmp0;
		Larg0.d0=tmp3;
		tmp2=(tmp4+-1)*2*tmp0;
		Larg0.d1=tmp2;
		Larg0.d2=tmp3;
		Larg0.d3=tmp2;
		Larg0.d4=(tmp4+(1-tmp1))*tmp0;
		break;
		case 4:
		if(Larg4>=0){
			tmp3=tmp1*tmp1;
			tmp2=1/Larg3*tmp1;
			tmp4=1/(tmp3+(tmp2+1));
			tmp1*=(tmp0/Larg3);
			Larg0.d0=(tmp3+(tmp1+1))*tmp4;
			tmp0=(tmp3+-1)*2*tmp4;
			Larg0.d1=tmp0;
			Larg0.d2=(tmp3+(1-tmp1))*tmp4;
			Larg0.d3=tmp0;
			Larg0.d4=(tmp3+(1-tmp2))*tmp4;
			break;
		}
		tmp3=tmp0/Larg3*tmp1;
		tmp2=tmp1*tmp1;
		tmp4=1/(tmp2+(tmp3+1));
		tmp1*=(1/Larg3);
		Larg0.d0=(tmp2+(tmp1+1))*tmp4;
		tmp0=(tmp2+-1)*2*tmp4;
		Larg0.d1=tmp0;
		Larg0.d2=(tmp2+(1-tmp1))*tmp4;
		Larg0.d3=tmp0;
		Larg0.d4=(tmp2+(1-tmp3))*tmp4;
		break;
		case 5:
		if(Larg4>=0){
			tmp3=tmp1*tmp1;
			tmp2=1/(tmp3+(tmp1* +Larg0.d6+1));
			tmp4=tmp0*2;
			tmp0=tmp1*(tmp0*tmp1);
			Larg0.d0=(tmp0+(tmp1* +Math.sqrt(tmp4)+1))*tmp2;
			Larg0.d1=(tmp0+-1)*2*tmp2;
			Larg0.d2=tmp2*(tmp0+(1-tmp1* +Math.sqrt(tmp4)));
			Larg0.d3=(tmp3+-1)*2*tmp2;
			Larg0.d4=tmp2*(tmp3+(1-tmp1* +Larg0.d6));
			break;
		}
		tmp5=tmp0*2;
		tmp0=tmp1*(tmp0*tmp1);
		tmp4=1/(tmp0+(tmp1* +Math.sqrt(tmp5)+1));
		tmp3=tmp1*tmp1;
		tmp2=tmp1* +Larg0.d6;
		Larg0.d0=tmp4*(tmp3+(tmp2+1));
		Larg0.d1=(tmp3+-1)*2*tmp4;
		Larg0.d2=tmp4*(tmp3+(1-tmp2));
		Larg0.d3=(tmp0+-1)*2*tmp4;
		Larg0.d4=tmp4*(tmp0+(1-tmp1* +Math.sqrt(tmp5)));
		break;
		case 6:
		if(Larg4>=0){
			tmp3=tmp1*tmp1;
			tmp2=1/(tmp3+(tmp1* +Larg0.d6+1));
			tmp4=tmp0*2;
			Larg0.d0=(tmp3+(tmp0+tmp1* +Math.sqrt(tmp4)))*tmp2;
			Larg0.d1=(tmp3-tmp0)*2*tmp2;
			Larg0.d2=tmp2*(tmp3+(tmp0-tmp1* +Math.sqrt(tmp4)));
			Larg0.d3=(tmp3+-1)*2*tmp2;
			Larg0.d4=tmp2*(tmp3+(1-tmp1* +Larg0.d6));
			break;
		}
		tmp3=tmp0*2;
		tmp2=tmp1*tmp1;
		tmp4=1/(tmp2+(tmp0+tmp1* +Math.sqrt(tmp3)));
		tmp5=tmp1* +Larg0.d6;
		Larg0.d0=tmp4*(tmp2+(tmp5+1));
		Larg0.d1=(tmp2+-1)*2*tmp4;
		Larg0.d2=tmp4*(tmp2+(1-tmp5));
		Larg0.d3=(tmp2-tmp0)*2*tmp4;
		Larg0.d4=tmp4*(tmp2+(tmp0-tmp1* +Math.sqrt(tmp3)));
		break;
		default:
	}
}
function __ZN10maxiBiquad4playEd(Larg0,Larg1){
	var L$poptgep$poptgep2$poptgepsqueezed=null,tmp1=-0.,tmp2=-0.,tmp3=-0.,tmp4=-0.,tmp5=-0.,tmp6=-0.;
	L$poptgep$poptgep2$poptgepsqueezed=Larg0.a7;
	tmp1=+L$poptgep$poptgep2$poptgepsqueezed[1];
	tmp2=+L$poptgep$poptgep2$poptgepsqueezed[2];
	tmp3=Larg1- +Larg0.d3*tmp1- +Larg0.d4*tmp2;
	L$poptgep$poptgep2$poptgepsqueezed[0]=tmp3;
	tmp4=+Larg0.d0;
	tmp5=+Larg0.d1;
	tmp6=+Larg0.d2;
	L$poptgep$poptgep2$poptgepsqueezed[2]=tmp1;
	L$poptgep$poptgep2$poptgepsqueezed[1]=tmp3;
	return tmp3*tmp4+tmp1*tmp5+tmp2*tmp6;
}
function __ZN16maxiNonlinearityC1Ev(Larg0){
}
function __ZN16maxiNonlinearity12fastAtanDistEdd(Larg0,Larg1,Larg2){
	var tmp0=-0.;
	tmp0=Larg1*Larg2;
	return 1/(Larg2/(Larg2*Larg2*.28+1))*(tmp0/(tmp0*tmp0*.28+1));
}
function __ZN16maxiNonlinearity8atanDistEdd(Larg0,Larg1,Larg2){
	return 1/ +Math.atan(Larg2)* +Math.atan(Larg1*Larg2);
}
function __ZN16maxiNonlinearity8fastatanEd(Larg0,Larg1){
	return Larg1/(Larg1*Larg1*.28+1);
}
function __ZN16maxiNonlinearity8softclipEd(Larg0,Larg1){
	if(Larg1>=1)return 1;
	if(Larg1<=-1)return -1;
	return (Larg1- +Math.pow(Larg1,3)/3)*.66666666666666663;
}
function __ZN16maxiNonlinearity8hardclipEd(Larg0,Larg1){
	if(Larg1>=1)return 1;
	if(Larg1<=-1)return -1;
	return Larg1;
}
function __ZN16maxiNonlinearity8asymclipEddd(Larg0,Larg1,Larg2,Larg3){
	if(Larg1>=1)return 1;
	if(Larg1<=-1)return -1;
	if(Larg1<0)return - +Math.pow(-Larg1,Larg2);
	return +Math.pow(Larg1,Larg3);
}
function __ZN7maxiMapC1Ev(Larg0){
}
function __ZN7maxiMap5clampEddd(Larg0,Larg1,Larg2){
	if(Larg0>Larg2)return Larg2;
	if(Larg0<Larg1)return Larg1;
	return Larg0;
}
function __ZN7maxiMap6explinEddddd(Larg0,Larg1,Larg2,Larg3,Larg4){
	var tmp0=-0.;
	tmp0=Larg2<Larg0?Larg2:Larg0;
	tmp0=+Math.log((tmp0<Larg1?Larg1:tmp0)/Larg1);
	return (Larg4-Larg3)*(tmp0/ +Math.log(Larg2/Larg1))+Larg3;
}
function __ZN7maxiMap6linexpEddddd(Larg0,Larg1,Larg2,Larg3,Larg4){
	var tmp0=-0.;
	tmp0=Larg2<Larg0?Larg2:Larg0;
	return  +Math.pow(Larg4/Larg3,((tmp0<Larg1?Larg1:tmp0)-Larg1)/(Larg2-Larg1))*Larg3;
}
function __ZN7maxiMap6linlinEddddd(Larg0,Larg1,Larg2,Larg3,Larg4){
	var tmp0=-0.;
	tmp0=Larg2<Larg0?Larg2:Larg0;
	return (Larg4-Larg3)*(((tmp0<Larg1?Larg1:tmp0)-Larg1)/(Larg2-Larg1))+Larg3;
}
function __ZN11maxiTriggerC1Ev(Larg0){
	Larg0.d0=1;
	Larg0.i1=1;
}
function __ZN11maxiTrigger9onChangedEdd(Larg0,Larg1,Larg2){
	var tmp0=-0.;
	tmp0=+Larg0.d0;
	tmp0=+Math.abs(Larg1-tmp0);
	if(tmp0>Larg2){
		Larg0.d0=Larg1;
		return 1;
	}
	Larg0.d0=Larg1;
	return 0;
}
function __ZN11maxiTrigger4onZXEd(Larg0,Larg1){
	var tmp0=0;
	if( +Larg0.d0<=0){
		if(!(Larg1>0)){
			Larg0.d0=Larg1;
			Larg0.i1=0;
			return 0;
		}
	}else{
		tmp0=Larg0.i1|0;
		if(!(Larg1>0)){
			Larg0.d0=Larg1;
			Larg0.i1=0;
			return 0;
		}
		if((tmp0&255)===0){
			Larg0.d0=Larg1;
			Larg0.i1=0;
			return 0;
		}
	}
	Larg0.d0=Larg1;
	Larg0.i1=0;
	return 1;
}
function __ZN12maxiSettingsC1Ev(Larg0){
}
function __ZN12maxiSettings5setupEiii(Larg0,Larg1,Larg2){
	__ZN12maxiSettings10sampleRateE=Larg0;
}
var _$pstr=new Uint8Array([77,97,120,105,109,105,108,105,97,110,32,50,32,45,32,74,97,118,97,115,99,114,105,112,116,32,84,114,97,110,115,112,105,108,101,0]);
var __ZN12maxiSettings10sampleRateE=44100;
function maxiSettings(){
	this.i0=0;
	;
	this.d=[this];
	if (arguments.length===1&&arguments[0]===undefined){
		return;
	}
	__ZN12maxiSettingsC1Ev(this);
}
maxiSettings.setup=function (a0,a1,a2){
	return __ZN12maxiSettings5setupEiii(a0,a1,a2);
};
maxiSettings.setup=function (a0,a1,a2){
	return __ZN12maxiSettings5setupEiii(a0,a1,a2);
};
function maxiTrigger(){
	this.d0=-0.;
	this.i1=0;
	;
	this.d=[this];
	if (arguments.length===1&&arguments[0]===undefined){
		return;
	}
	__ZN11maxiTriggerC1Ev(this);
}
maxiTrigger.prototype.onZX=function (a0){
	return __ZN11maxiTrigger4onZXEd(this,a0);
};
maxiTrigger.prototype.onChanged=function (a0,a1){
	return __ZN11maxiTrigger9onChangedEdd(this,a0,a1);
};
maxiTrigger.prototype.onZX=function (a0){
	return __ZN11maxiTrigger4onZXEd(this,a0);
};
maxiTrigger.prototype.onChanged=function (a0,a1){
	return __ZN11maxiTrigger9onChangedEdd(this,a0,a1);
};
function maxiMap(){
	this.i0=0;
	;
	this.d=[this];
	if (arguments.length===1&&arguments[0]===undefined){
		return;
	}
	__ZN7maxiMapC1Ev(this);
}
maxiMap.linlin=function (a0,a1,a2,a3,a4){
	return __ZN7maxiMap6linlinEddddd(a0,a1,a2,a3,a4);
};
maxiMap.linexp=function (a0,a1,a2,a3,a4){
	return __ZN7maxiMap6linexpEddddd(a0,a1,a2,a3,a4);
};
maxiMap.explin=function (a0,a1,a2,a3,a4){
	return __ZN7maxiMap6explinEddddd(a0,a1,a2,a3,a4);
};
maxiMap.clamp=function (a0,a1,a2){
	return __ZN7maxiMap5clampEddd(a0,a1,a2);
};
maxiMap.linlin=function (a0,a1,a2,a3,a4){
	return __ZN7maxiMap6linlinEddddd(a0,a1,a2,a3,a4);
};
maxiMap.linexp=function (a0,a1,a2,a3,a4){
	return __ZN7maxiMap6linexpEddddd(a0,a1,a2,a3,a4);
};
maxiMap.explin=function (a0,a1,a2,a3,a4){
	return __ZN7maxiMap6explinEddddd(a0,a1,a2,a3,a4);
};
maxiMap.clamp=function (a0,a1,a2){
	return __ZN7maxiMap5clampEddd(a0,a1,a2);
};
function maxiNonlinearity(){
	this.i0=0;
	;
	this.d=[this];
	if (arguments.length===1&&arguments[0]===undefined){
		return;
	}
	__ZN16maxiNonlinearityC1Ev(this);
}
maxiNonlinearity.prototype.asymclip=function (a0,a1,a2){
	return __ZN16maxiNonlinearity8asymclipEddd(this,a0,a1,a2);
};
maxiNonlinearity.prototype.hardclip=function (a0){
	return __ZN16maxiNonlinearity8hardclipEd(this,a0);
};
maxiNonlinearity.prototype.softclip=function (a0){
	return __ZN16maxiNonlinearity8softclipEd(this,a0);
};
maxiNonlinearity.prototype.fastatan=function (a0){
	return __ZN16maxiNonlinearity8fastatanEd(this,a0);
};
maxiNonlinearity.prototype.atanDist=function (a0,a1){
	return __ZN16maxiNonlinearity8atanDistEdd(this,a0,a1);
};
maxiNonlinearity.prototype.fastAtanDist=function (a0,a1){
	return __ZN16maxiNonlinearity12fastAtanDistEdd(this,a0,a1);
};
maxiNonlinearity.prototype.asymclip=function (a0,a1,a2){
	return __ZN16maxiNonlinearity8asymclipEddd(this,a0,a1,a2);
};
maxiNonlinearity.prototype.hardclip=function (a0){
	return __ZN16maxiNonlinearity8hardclipEd(this,a0);
};
maxiNonlinearity.prototype.softclip=function (a0){
	return __ZN16maxiNonlinearity8softclipEd(this,a0);
};
maxiNonlinearity.prototype.fastatan=function (a0){
	return __ZN16maxiNonlinearity8fastatanEd(this,a0);
};
maxiNonlinearity.prototype.atanDist=function (a0,a1){
	return __ZN16maxiNonlinearity8atanDistEdd(this,a0,a1);
};
maxiNonlinearity.prototype.fastAtanDist=function (a0,a1){
	return __ZN16maxiNonlinearity12fastAtanDistEdd(this,a0,a1);
};
function maxiBiquad(){
	this.d0=-0.;
	this.d1=-0.;
	this.d2=-0.;
	this.d3=-0.;
	this.d4=-0.;
	this.i5=0;
	this.d6=-0.;
	this.a7=new Float64Array(3);
	;
	this.d=[this];
	if (arguments.length===1&&arguments[0]===undefined){
		return;
	}
	__ZN10maxiBiquadC1Ev(this);
}
maxiBiquad.prototype.play=function (a0){
	return __ZN10maxiBiquad4playEd(this,a0);
};
maxiBiquad.prototype.set=function (a0,a1,a2,a3){
	return __ZN10maxiBiquad3setENS_11filterTypesEddd(this,a0,a1,a2,a3);
};
maxiBiquad.prototype.play=function (a0){
	return __ZN10maxiBiquad4playEd(this,a0);
};
maxiBiquad.prototype.set=function (a0,a1,a2,a3){
	return __ZN10maxiBiquad3setENS_11filterTypesEddd(this,a0,a1,a2,a3);
};
maxiSettings.promise=
maxiTrigger.promise=
maxiMap.promise=
maxiNonlinearity.promise=
maxiBiquad.promise=
Promise.resolve();
__Z7webMainv();
//bindings- intended to mix this source in with the emscripten modules
Module.maxiMap = maxiMap;
Module.maxiTrigger = maxiTrigger;
Module.maxiNonlinearity = maxiNonlinearity;
Module.maxiJSSettings = maxiSettings;
Module.maxiBiquad = maxiBiquad;

