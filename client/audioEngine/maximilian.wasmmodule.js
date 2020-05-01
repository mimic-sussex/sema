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
  'initial': 889,
  'maximum': 889 + 0,
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
    STACK_BASE = 5283856,
    STACKTOP = STACK_BASE,
    STACK_MAX = 40976,
    DYNAMIC_BASE = 5283856,
    DYNAMICTOP_PTR = 40816;




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




var wasmBinaryFile = 'data:application/octet-stream;base64,AGFzbQEAAAAB0gqfAWABfwF/YAF/AGACf38AYAJ/fwF/YAN/f38Bf2ADf39/AGAFf39/f38Bf2AAAGAEf39/fwF/YAZ/f39/f38Bf2AFf39/f38AYAR/f39/AGAAAX9gBn9/f39/fwBgCH9/f39/f39/AX9gAn98AGABfwF8YAJ8fAF8YAd/f39/f39/AX9gAn98AXxgA398fAF8YAF8AXxgB39/f39/f38AYAJ/fwF8YAR/fHx8AXxgBH9/f3wAYAN/f3wAYAV/fn5+fgBgA39+fwF+YAF9AX1gA39/fwF8YAp/f39/f39/f39/AGADf3x/AGAFf39/f34Bf2AEf3x8fwF8YAV/f35/fwBgBn9/fHx8fwBgBX9/f398AX9gBH9/f38BfmABfwF9YAJ/fwF9YAV/f3x8fwF8YAZ/fH98fHwBfGAFf3x8f3wBfGAFf3x8fH8BfGAGf3x8fHx8AXxgCH9/f39/f39/AGAHf39/f398fABgBn9/f398fABgBH9/f30AYAZ/f319f38AYAR/f3x/AGAFf398f3wAYAZ/f3x/fHwAYAd/f3x/fHx8AGAEf398fABgBH9+fn8AYAV/fX1/fwBgBH98f3wAYAV/fH98fABgBn98f3x8fABgA398fABgBX98fHx/AGAKf39/f39/f39/fwF/YAd/f39/f35+AX9gBn9/f39+fgF/YAR/f398AX9gBH9/fX8Bf2ADf31/AX9gBn98f39/fwF/YAR/f39/AX1gBX9/f39/AX1gBH9/f38BfGADf398AXxgBH9/fH8BfGAFf398f3wBfGAGf398f3x/AXxgB39/fH98fHwBfGAEf398fAF8YAZ/f3x8f3wBfGAHf398fH98fAF8YAV/f3x8fAF8YAZ/f3x8fH8BfGAHf398fHx/fwF8YAd/f3x8fH98AXxgB39/fHx8fHwBfGAJf398fHx8fH9/AXxgA398fwF8YAR/fH98AXxgBX98f3x/AXxgBn98fH98fAF8YAZ/fHx8f38BfGAGf3x8fH98AXxgCH98fHx8fH9/AXxgD39/f39/f39/f39/f39/fwBgA39/fQBgAn9+AGAJf39/f39/f39/AX9gC39/f39/f39/f39/AX9gDH9/f39/f39/f39/fwF/YAR/f399AX9gA39+fwF/YAJ/fAF/YAJ+fwF/YAJ+fgF/YAF8AX9gAX8BfmAEf39/fgF+YAN/f38BfWACfX8BfWABfAF9YAJ8fwF8YAN8fH8BfGADfHx8AXxgDH9/f39/f39/f39/fwBgDX9/f39/f39/f39/f38AYAh/f39/f398fABgBX9/f399AGAFf39/f3wAYAd/f399fX9/AGAFf39/fH8AYAZ/f398f3wAYAd/f398f3x8AGAIf39/fH98fHwAYAV/f398fABgB39/f3x8fH8AYAN/f34AYAN/fn4AYAJ/fQBgBn9/f39/fAF/YAV/f39/fQF/YAV/f399fwF/YAN/f3wBf2AHf398f39/fwF/YAN+f38Bf2AEfn5+fgF/YAJ9fwF/YAJ8fwF/YAJ/fwF+YAZ/f39/f38BfWACfn4BfWACfX0BfWAFf39/f38BfGAEf39/fAF8YAV/f398fwF8YAZ/f398f3wBfGAHf39/fH98fwF8YAh/f398f3x8fAF8YAV/f398fAF8YAZ/f398fH8BfGAHf39/fHx/fAF8YAh/f398fH98fAF8YAZ/f398fHwBfGAHf39/fHx8fwF8YAh/f398fHx/fwF8YAh/f398fHx/fAF8YAh/f398fHx8fAF8YAp/f398fHx8fH9/AXxgAn5+AXwClgktA2VudhZfZW1iaW5kX3JlZ2lzdGVyX2NsYXNzAHMDZW52Il9lbWJpbmRfcmVnaXN0ZXJfY2xhc3NfY29uc3RydWN0b3IADQNlbnYlX2VtYmluZF9yZWdpc3Rlcl9jbGFzc19jbGFzc19mdW5jdGlvbgAWA2Vudh9fZW1iaW5kX3JlZ2lzdGVyX2NsYXNzX2Z1bmN0aW9uAC4DZW52H19lbWJpbmRfcmVnaXN0ZXJfY2xhc3NfcHJvcGVydHkAHwNlbnYVX2VtYmluZF9yZWdpc3Rlcl9lbnVtAAsDZW52G19lbWJpbmRfcmVnaXN0ZXJfZW51bV92YWx1ZQAFA2VudhpfZW1iaW5kX3JlZ2lzdGVyX3NtYXJ0X3B0cgByA2VudhhfX2N4YV9hbGxvY2F0ZV9leGNlcHRpb24AAANlbnYLX19jeGFfdGhyb3cABQNlbnYRX2VtdmFsX3Rha2VfdmFsdWUAAwNlbnYNX2VtdmFsX2luY3JlZgABA2Vudg1fZW12YWxfZGVjcmVmAAEDZW52C19lbXZhbF9jYWxsAAgDZW52BXJvdW5kABUDZW52BGV4aXQAAQNlbnYNX19hc3NlcnRfZmFpbAALA2VudgZfX2xvY2sAAQNlbnYIX191bmxvY2sAARZ3YXNpX3NuYXBzaG90X3ByZXZpZXcxCGZkX2Nsb3NlAAADZW52Cl9fc3lzY2FsbDUAAwNlbnYMX19zeXNjYWxsMjIxAAMDZW52C19fc3lzY2FsbDU0AAMWd2FzaV9zbmFwc2hvdF9wcmV2aWV3MQdmZF9yZWFkAAgWd2FzaV9zbmFwc2hvdF9wcmV2aWV3MQhmZF93cml0ZQAIFndhc2lfc25hcHNob3RfcHJldmlldzERZW52aXJvbl9zaXplc19nZXQAAxZ3YXNpX3NuYXBzaG90X3ByZXZpZXcxC2Vudmlyb25fZ2V0AAMDZW52Cl9fbWFwX2ZpbGUAAwNlbnYLX19zeXNjYWxsOTEAAwNlbnYKc3RyZnRpbWVfbAAGA2VudgVhYm9ydAAHA2VudhVfZW1iaW5kX3JlZ2lzdGVyX3ZvaWQAAgNlbnYVX2VtYmluZF9yZWdpc3Rlcl9ib29sAAoDZW52G19lbWJpbmRfcmVnaXN0ZXJfc3RkX3N0cmluZwACA2VudhxfZW1iaW5kX3JlZ2lzdGVyX3N0ZF93c3RyaW5nAAUDZW52Fl9lbWJpbmRfcmVnaXN0ZXJfZW12YWwAAgNlbnYYX2VtYmluZF9yZWdpc3Rlcl9pbnRlZ2VyAAoDZW52Fl9lbWJpbmRfcmVnaXN0ZXJfZmxvYXQABQNlbnYcX2VtYmluZF9yZWdpc3Rlcl9tZW1vcnlfdmlldwAFA2VudhZlbXNjcmlwdGVuX3Jlc2l6ZV9oZWFwAAADZW52FWVtc2NyaXB0ZW5fbWVtY3B5X2JpZwAEA2VudgtzZXRUZW1wUmV0MAABFndhc2lfc25hcHNob3RfcHJldmlldzEHZmRfc2VlawAGA2VudgZtZW1vcnkCAIAQA2VudgV0YWJsZQFwAPkGA/cJ1gkHBwcHBwcHAAEADAIBAAsFAAxIGRAPFxoAAgMFAAxLTAAMNDU2AAwTST4kDwAAQhkYcQAMPTcPEBAPEA8PAAEMAAsITlECATIIAAxQVQAMU1ZKAAIAFxcVExMADBQADCpNAAwqAAwUAAwPDy0AFBERERERERERERURAAwAAAIAAhACEAICAAIADCIpAAEDABQgMwIXHgAAAAAUIAIAAQwKQygDAAAAAAAAAAEMRwABDDAvAwQAAQwCBQULAAUEBAgAAhoFGQAFBEIAAgUFCwAFBAgABQBfMQVkBSAHAAEADAMBAAECEA8rTyIpAAEDAQIrAAwCDw8AXFQsUiQHAAMEAwMDCAQDAwMAAAADAwMDAwMDAwMMEBBmaQAMFAcAAQwADAECBQIFAgIAAAQCAAEBAwEAAQEQAAQAAQMAAQEHExMeGgBYWRQ6OzwEAAMEAgAEAAMAAAIFBQEQGCwYEBMUExgUEw85Wi0TDw8PW11XDw8PEAABAQABAgQjBwsAAwMJDwECC0QAJycLRg0LAgIBBQoFCgoCAQEAEwAYAwEACAAICQMDDQsBAAMEBAQLCAoIAAADDgoNbW0EBQsCDQIAAgAcAAEECAIMAwMDbwYSBQALCmeGAWcERQIFDAACAWpqAAAIZWUCAAAAAwMMAAgEAAAcBAAEAQAAAAA4OJ4BEQaJAXAVbm6IAR0VHXAVHY0BHRUdEQQMAAABAQABAAIEIwsEBQAAAwQAAQAEBQAEAAABAQMBAAMAAAMDAQMAAwVgAQADAAMDAwADAAABAQAAAAMDAwICAgIBAgIAAAMHAQEHAQcFAgUCAgAAAQIAAwADAQIAAwADAgAEAwIEA2AAf2sIgAEbAhsPhwFoGwIbOBsLDRaKAYwBBAN+BAQEAwcEAAIDDAQDAwEABAgIBmsmJigLFwULBgsFBAYLBQQJABIDBAkGAAUAAj8ICwkGJgkGCAkGCAkGJgkGCmNsCQYeCQYLCQwEAQQDCQASCQYDBT8JBgkGCQYJBgkGCmMJBgkGCQQDBgAABgsGBBYCACEGISUEAAgWQQYGAAYWCQIEIQYhJRZBBgICDgAJCQkNCQ0JCgYOCwoKCgoKCgsNCgoKDgkJCQ0JDQkKBg4LCgoKCgoKCw0KCgoSDQIEEg0GBwQAAgICAAISYh8CBQUSAQUAAgAEAwISYh8CEgEFAAIABANAH14ECUAfXgQJBAQEDQUCDQsLAAcHBwEBAgACBwwBAAEBAQwBAwECAQEECAgIAwQDBAMIBAYAAQMEAwQIBAYOBgYBDgYEDgkGBgAAAAYIAA4JDgkGBAAOCQ4JBgQAAQABAAACAgICAgICAgAHAQAHAQIABwEABwEABwEABwEAAQABAAEAAQABAAEAAQABAQAMAwEDAAUCAQAIAgELAAIBAAEBBQEBAwIAAgQEBwIFAAUuAgICCgUFAgEFBS4KBQIFBwcHAAABAQEABAQEAwULCwsLAwQDAwsKDQoKCg0NDQAABwcHBwcHBwcHBwcHBwEBAQEBAQcHBwcAAAEDAwIAERsVHW9oBAQFAgwAAQAFCkiOARl2Gh5LkQFMkgE0eTV6NntJjwEkfSVRN3wGTpQBmAEyd1CXAVWcAVOaAVadAUqQAU2TASmVATN4DUODAShsR4sBL3QxdYIBT5YBVJsBUpkBhAGFAQlhEoEBDhYBFgYSYT8GEAJ/AUHwvsICC38AQey+AgsHmQ5oEV9fd2FzbV9jYWxsX2N0b3JzACsGbWFsbG9jAJ0JBGZyZWUAngkQX19lcnJub19sb2NhdGlvbgDzAwhzZXRUaHJldwCsCRlfWlN0MTh1bmNhdWdodF9leGNlcHRpb252ALwEDV9fZ2V0VHlwZU5hbWUAhAkqX19lbWJpbmRfcmVnaXN0ZXJfbmF0aXZlX2FuZF9idWlsdGluX3R5cGVzAIUJCl9fZGF0YV9lbmQDAQlzdGFja1NhdmUArQkKc3RhY2tBbGxvYwCuCQxzdGFja1Jlc3RvcmUArwkQX19ncm93V2FzbU1lbW9yeQCwCQpkeW5DYWxsX2lpAKkCCmR5bkNhbGxfdmkANglkeW5DYWxsX2kANAtkeW5DYWxsX3ZpaQCxCQ1keW5DYWxsX3ZpaWlpALIJDGR5bkNhbGxfdmlpaQA5DGR5bkNhbGxfZGlpaQCzCQ1keW5DYWxsX2RpaWlpALQJDGR5bkNhbGxfdmlpZAC1CQ1keW5DYWxsX3ZpaWlkALYJCmR5bkNhbGxfZGkAgQELZHluQ2FsbF92aWQAtwkLZHluQ2FsbF9kaWkAuAkLZHluQ2FsbF9paWkAqgINZHluQ2FsbF9kaWRpZAC5CQ5keW5DYWxsX2RpaWRpZAC6CQ5keW5DYWxsX2RpZGlkaQC7CQ9keW5DYWxsX2RpaWRpZGkAvAkNZHluQ2FsbF92aWRpZAC9CQ5keW5DYWxsX3ZpaWRpZAC+CQ5keW5DYWxsX3ZpZGlkZAC/CQ9keW5DYWxsX3ZpaWRpZGQAwAkPZHluQ2FsbF92aWRpZGRkAMEJEGR5bkNhbGxfdmlpZGlkZGQAwgkLZHluQ2FsbF9kaWQAwwkMZHluQ2FsbF9kaWlkAMQJDmR5bkNhbGxfdmlkZGRpAMUJD2R5bkNhbGxfdmlpZGRkaQDGCQ1keW5DYWxsX2lpaWlkAMcJDWR5bkNhbGxfZGlkZGQAyAkMZHluQ2FsbF9kZGRkAFsMZHluQ2FsbF92aWRkAMkJDWR5bkNhbGxfdmlpZGQAygkMZHluQ2FsbF9paWlpAK4CDWR5bkNhbGxfaWlpaWkAywkMZHluQ2FsbF9kaWRkAMwJDWR5bkNhbGxfZGlpZGQAzQkOZHluQ2FsbF9kaWlkZGQAzgkOZHluQ2FsbF92aWZmaWkAzwkPZHluQ2FsbF92aWlmZmlpANAJD2R5bkNhbGxfZGlkZGlkZADRCRBkeW5DYWxsX2RpaWRkaWRkANIJD2R5bkNhbGxfZGlkZGRkZADTCRBkeW5DYWxsX2RpaWRkZGRkANQJD2R5bkNhbGxfZGlkZGRpaQDVCRBkeW5DYWxsX2RpaWRkZGlpANYJEWR5bkNhbGxfZGlkZGRkZGlpANcJEmR5bkNhbGxfZGlpZGRkZGRpaQDYCQxkeW5DYWxsX2RpZGkA2QkNZHluQ2FsbF9kaWlkaQDaCQpkeW5DYWxsX2RkAIQBD2R5bkNhbGxfZGlkaWRkZADbCRBkeW5DYWxsX2RpaWRpZGRkANwJC2R5bkNhbGxfZGRkAJgBDWR5bkNhbGxfZGlkZGkA3QkOZHluQ2FsbF9kaWlkZGkA3gkMZHluQ2FsbF92aWRpAN8JDWR5bkNhbGxfdmlpZGkA4AkOZHluQ2FsbF92aWlpaWkA4QkMZHluQ2FsbF9paWZpAOIJDWR5bkNhbGxfaWlpZmkA4wkKZHluQ2FsbF9maQDkCQtkeW5DYWxsX2ZpaQDlCQ1keW5DYWxsX2ZpaWlpAOYJDmR5bkNhbGxfZmlpaWlpAOcJD2R5bkNhbGxfdmlpaWlkZADoCRBkeW5DYWxsX3ZpaWlpaWRkAOkJDGR5bkNhbGxfdmlpZgDqCQ1keW5DYWxsX3ZpaWlmAOsJDWR5bkNhbGxfaWlpaWYA7AkOZHluQ2FsbF9kaWRkaWQA7QkPZHluQ2FsbF9kaWlkZGlkAO4JD2R5bkNhbGxfZGlkZGRpZADvCRBkeW5DYWxsX2RpaWRkZGlkAPAJDmR5bkNhbGxfZGlkZGRpAPEJD2R5bkNhbGxfZGlpZGRkaQDyCQtkeW5DYWxsX2lpZADzCQpkeW5DYWxsX2lkAMICDmR5bkNhbGxfdmlpamlpAPwJDGR5bkNhbGxfamlqaQD9CQ9keW5DYWxsX2lpZGlpaWkA9AkOZHluQ2FsbF9paWlpaWkA9QkRZHluQ2FsbF9paWlpaWlpaWkA9gkPZHluQ2FsbF9paWlpaWlpAPcJDmR5bkNhbGxfaWlpaWlqAP4JDmR5bkNhbGxfaWlpaWlkAPgJD2R5bkNhbGxfaWlpaWlqagD/CRBkeW5DYWxsX2lpaWlpaWlpAPkJEGR5bkNhbGxfaWlpaWlpamoAgAoPZHluQ2FsbF92aWlpaWlpAPoJCWR5bkNhbGxfdgD7CQm2DAEAQQEL+AYyMzQ1Njc2NzgzOTo7MzQ87AI97QI+P0BBQkNERUZHMzRI7wJJ8AJKSzM0TPICTfMCTvQCT1AzNFFSU1RVVkJXRVgzWVpbXF0zNF5fYGFCYkFjZEFCZWZnaGk0amtFgANGggNs+wJt/wJFiANBiwNTiQOKA26MA2+EA44DhQOHA4MDcHGPA0KQA3L1AnP2Ao0DdDM0dZEDdpIDd5MDU5QDQpUDlgNmeDM0eZcDepgDe5kDfJoDQpQDnAObA31+RUZ/MzQ1nQOAAYEBggGDAYQBhQEzNIYBhwFuiAEzNIkBigGLAYwBMzSNAY4BiwGPATM0kAGRAW6SATM0kwGUAUKVAZYBd5cBMzQ1mAGZAZoBmwGcAZ0BngGfAaABoQGiAaMBpAEzNKUBrQNwrANCrgNGpgFFpwGoAUVGqQGqAX1+qwGsAUGtAa4BpgGvAUWwAbEBsgEzNLMBtAG1AWRCY0G2AbcBuAG5AboBbrsBvAG9AUa+Ab8BwAFFwQHCAcIBtwG4AcMBxAFuxQG8AcYBRr4BvwHAAUXHAcgBNMkBrwPKAbADywGyA8wBswPCAc0BzgHPAdABRdEB0gHTAdQB1QE01gG0A8oBtQPXAdgB2QE02gHbAdwB3QHeAd8B4AE04QHiAeMB5AHlAeYBRecB6AHpAeoB6wHgATThAewB7QHuAe8B8AFF8QHoAfIB8wH0AeABNOEB9QH2AfcB+AH5AUX6AegB+wH8Af0B4AE04QH1AfYB9wH4AfkBRf4B6AH7AfwB/wHgATThAeIBgALkAYEC5gFFggLoAekBgwKHAogCiQKKAosCjAKNAo4CjwJGkAJBY5ECQpICkwKUApUClgKXAokCigKYAowCjQKZApoCRpsCkwKcAogCNJ0CngJGkAJBY5ECQp8CoAKhAkWiAqMCpAKlAqgCM6kCwgGqAqsCrAKtAq4CrwKwArECsgKzArQCtQK2ArcCuAK5AroCuwK8Ar0CvgI0vwKBAcACwQLCAsMCyALJAjTKAsQDU8sCyQI0zALGA2/oCMQCMzTFAsYCbtgC2QLaAtsC3ALdAt4C3wLJCNwC4ALCAdwC4wLkAtoC5QLcAuYC5wLoAtwCwgH+Ap8DngOgA9UE1wTWBNgE+gKiA6MDpAOlA6cDoQObBMgEqAPLBKkDzQSqA9QDxwORBJ8E7QOCBIMEmQSbBJwEnQTBBMIExATFBMYExwSbBMoEzATMBM4EzwTEBMUExgTHBJsEmwTRBMoE0wTMBNQEzATVBNcE1gTYBPAE8gTxBPME8ATyBPEE8wS+BP4EvQTABL0EwASFBZEFkgWTBZUFlgWXBZgFmQWbBZwFkQWdBZ4FnwWgBZcFoQWeBaIFowW/BZ4J7wPJB8wHkAiTCJcImgidCKAIogikCKYIqAiqCKwIrgiwCMIHxAfLB9kH2gfbB9wH3QfeB9UH3wfgB+EHtgflB+YH6QfsB+0HmwTwB/IHgAiBCIQIhQiGCIgIiwiCCIMItQavBocIiQiMCMIB3ALcAs0HzgfPB9AH0QfSB9MH1AfVB9YH1wfYB9wC4gfiB+MH7gPuA+QH7gPcAvMH9QfjB5sEmwT3B/kH3AL6B/wH4webBJsE/gf5B9wC3ALCAdwC2AXZBdsFwgHcAtwF3QXfBdwC4AXlBe4F8QX0BfQF9wX6Bf8FggaFBtwCiwaOBpMGlQaXBpcGmQabBp8GoQajBtwCpgapBrAGsQayBrMGuAa5BtwCuga8BsEGwgbDBsQGxgbHBsIB3ALLBswGzQbOBtAG0gbVBo4IlQibCKkIrQihCKUIwgHcAssG4wbkBuUG5wbpBuwGkQiYCJ4IqwivCKMIpwiyCLEI+QayCLEI/QbcAoIHggeDB4MHgweEB5sEhQeFB9wCggeCB4MHgweDB4QHmwSFB4UH3AKGB4YHgweDB4MHhwebBIUHhQfcAoYHhgeDB4MHgweHB5sEhQeFB9wCiAeOB9wClwebB9wCowenB9wCqAesB9wCrwewB8QE3AKvB7MHxATCAccI5gjCAdwC5wjq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IAEgAiADIAARBQALHQBB+PsBIAE2AgBB9PsBIAA2AgBB/PsBIAI2AgALBQBB4CQLBwBBOBDLCAs5AQF/IAEgACgCBCIEQQF1aiEBIAAoAgAhACABIAIgAyAEQQFxBH8gASgCACAAaigCAAUgAAsRHgALOQEBfyABIAAoAgQiBEEBdWohASAAKAIAIQAgASACIAMgBEEBcQR/IAEoAgAgAGooAgAFIAALERoACwcAIAArAzALCQAgACABOQMwCzUBAX8gASAAKAIEIgJBAXVqIQEgACgCACEAIAEgAkEBcQR/IAEoAgAgAGooAgAFIAALERAACzcBAX8gASAAKAIEIgNBAXVqIQEgACgCACEAIAEgAiADQQFxBH8gASgCACAAaigCAAUgAAsRDwALBwAgACgCLAsJACAAIAE2AiwLNQEBfyABIAAoAgQiAkEBdWohASAAKAIAIQAgASACQQFxBH8gASgCACAAaigCAAUgAAsRAAALNwEBfyABIAAoAgQiA0EBdWohASAAKAIAIQAgASACIANBAXEEfyABKAIAIABqKAIABSAACxECAAsFAEH0JQsNAEGokdYAEMsIEO4CCzsBAX8gASAAKAIEIgVBAXVqIQEgACgCACEAIAEgAiADIAQgBUEBcQR/IAEoAgAgAGooAgAFIAALEVgACz0BAX8gASAAKAIEIgZBAXVqIQEgACgCACEAIAEgAiADIAQgBSAGQQFxBH8gASgCACAAaigCAAUgAAsRWQALBQBBnCcLEABB+AAQywhBAEH4ABCqCQs7AQF/IAEgACgCBCIFQQF1aiEBIAAoAgAhACABIAIgAyAEIAVBAXEEfyABKAIAIABqKAIABSAACxE6AAs9AQF/IAEgACgCBCIGQQF1aiEBIAAoAgAhACABIAIgAyAEIAUgBkEBcQR/IAEoAgAgAGooAgAFIAALETsACz8BAX8gASAAKAIEIgdBAXVqIQEgACgCACEAIAEgAiADIAQgBSAGIAdBAXEEfyABKAIAIABqKAIABSAACxE8AAsFAEHQKAteAQF/QdAAEMsIIgBCADcDACAAQgA3AyAgAEKAgICAgICA+L9/NwMYIABCADcDOCAAQQE6AEggAEIANwMQIABCADcDCCAAQgA3AyggAEEAOgAwIABBQGtCADcDACAAC/kBAgF/A3wgAC0AMEUEQCAAKwMoIQMCQCAAKwMgRAAAAAAAAAAAYQ0AIANEAAAAAAAAAABiDQBEAAAAAAAAAAAhAyABRAAAAAAAAAAAZEEBc0UEQEQAAAAAAADwP0QAAAAAAAAAACAAKwMYRAAAAAAAAAAAZRshAwsgACADOQMoIAAgACkDODcDCAsCQCADRAAAAAAAAAAAYQ0AIAAgACsDECIEIAArAwigIgM5AwggACADIAArA0AiBWUgAyAFZiAERAAAAAAAAAAAZRsiAjoAMCACRQ0AIAAtAEgNACAAQQA6ADAgAEIANwMoCyAAIAE5AxgLIAArAwgLNwEBfyABIAAoAgQiA0EBdWohASAAKAIAIQAgASACIANBAXEEfyABKAIAIABqKAIABSAACxETAAtbAgF/AX4gACACOQNAIAApAzghBiAAIAE5AzggACAGNwMIQfT7ASgCACEFIAAgBDoASCAAQQA6ADAgAEIANwMoIAAgAiABoSADRAAAAAAAQI9AoyAFt6KjOQMQCz0BAX8gASAAKAIEIgZBAXVqIQEgACgCACEAIAEgAiADIAQgBSAGQQFxBH8gASgCACAAaigCAAUgAAsRPgALJgAgAEQAAAAAAADwP0QAAAAAAAAAACABRAAAAAAAAAAAZBs5AyALBwAgAC0AMAsFAEHwKQtGAQF/IwBBEGsiBCQAIAQgASACIAMgABEZAEEMEMsIIgAgBCgCADYCACAAIAQoAgQ2AgQgACAEKAIINgIIIARBEGokACAAC98CAgN/AXxEAAAAAAAA8D8hBwJAIANEAAAAAAAA8D9kDQAgAyIHRAAAAAAAAPC/Y0EBcw0ARAAAAAAAAPC/IQcLIAEoAgAhBiABKAIEIQEgAEEANgIIIABCADcCAAJAAkAgASAGayIBRQ0AIAFBA3UiBUGAgICAAk8NASAHRAAAAAAAAPA/pEQAAAAAAADwv6VEAAAAAAAA8D+gRAAAAAAAAOA/okQAAAAAAAAAAKAiA58hB0QAAAAAAADwPyADoZ8hAyAAIAEQywgiBDYCACAAIAQ2AgQgACAEIAVBA3RqNgIIIARBACABEKoJIgQhAQNAIAFBCGohASAFQX9qIgUNAAsgACABNgIEIAEgBEYNACABIARrQQN1IQUgAigCACECQQAhAQNAIAQgAUEDdCIAaiAAIAZqKwMAIAOiIAcgACACaisDAKKgOQMAIAFBAWoiASAFSQ0ACwsPCxDkCAALDQAgASACIAMgABFxAAvSAQEDfyMAQTBrIgMkACADQQA2AiggA0IANwMgIANBCBDLCCIENgIgIAMgBEEIaiIFNgIoIAQgADkDACADIAU2AiQgA0EANgIYIANCADcDECADQQgQywgiBDYCECADIARBCGoiBTYCGCAEIAE5AwAgAyAFNgIUIAMgA0EgaiADQRBqIAIQWiADKAIAIgQrAwAhACADIAQ2AgQgBBCeCSADKAIQIgQEQCADIAQ2AhQgBBCeCQsgAygCICIEBEAgAyAENgIkIAQQngkLIANBMGokACAACwUAQfgqCzABAX9BGBDLCCIAQgA3AxAgAEKAgICAgICA8D83AwggAEKAgICAgICA8D83AwAgAAshACAAIAI5AxAgACABOQMAIABEAAAAAAAA8D8gAaE5AwgLOQEBfyABIAAoAgQiBEEBdWohASAAKAIAIQAgASACIAMgBEEBcQR/IAEoAgAgAGooAgAFIAALET0ACxsAIAAgACsDACABoiAAKwMIIAArAxCioDkDEAsHACAAKwMQCwcAIAArAwALCQAgACABOQMACwcAIAArAwgLCQAgACABOQMICwkAIAAgATkDEAsFAEGMLAs3AQF/IAAEQCAAKAJsIgEEQCAAIAE2AnAgARCeCQsgACwAC0F/TARAIAAoAgAQngkLIAAQngkLC4kBAQJ/QYgBEMsIIgBCADcCACAAQgA3AyggAEEBOwFgIABCADcDWCAAQoCAgICAgIDwPzcDUCAAQoCAgICAgIDwPzcDSCAAQQA2AgggAEIANwMwQfT7ASgCACEBIABBADYCdCAAQgA3AmwgACABNgJkIABBAToAgAEgAEKAgICAgICA+D83A3ggAAsQACAAKAJwIAAoAmxrQQN1CzkBAX8gASAAKAIEIgRBAXVqIQEgACgCACEAIAEgAiADIARBAXEEfyABKAIAIABqKAIABSAACxEFAAs5AQF/IAEgACgCBCIEQQF1aiEBIAAoAgAhACABIAIgAyAEQQFxBH8gASgCACAAaigCAAUgAAsRBAALOQEBfyABIAAoAgQiBEEBdWohASAAKAIAIQAgASACIAMgBEEBcQR/IAEoAgAgAGooAgAFIAALERQACzsBAX8gASAAKAIEIgVBAXVqIQEgACgCACEAIAEgAiADIAQgBUEBcQR/IAEoAgAgAGooAgAFIAALERgACzUBAX8gASAAKAIEIgJBAXVqIQEgACgCACEAIAEgAkEBcQR/IAEoAgAgAGooAgAFIAALEQEACwwAIAAgACgCbDYCcAs9AQF/IAEgACgCBCIGQQF1aiEBIAAoAgAhACABIAIgAyAEIAUgBkEBcQR/IAEoAgAgAGooAgAFIAALETkAC+UBAQR/IwBBEGsiBCQAIAEgACgCBCIGQQF1aiEHIAAoAgAhBSAGQQFxBEAgBygCACAFaigCACEFCyACKAIAIQAgBEEANgIIIARCADcDACAAQXBJBEACQAJAIABBC08EQCAAQRBqQXBxIgYQywghASAEIAZBgICAgHhyNgIIIAQgATYCACAEIAA2AgQMAQsgBCAAOgALIAQhASAARQ0BCyABIAJBBGogABCpCRoLIAAgAWpBADoAACAHIAQgAyAFEQQAIQAgBCwAC0F/TARAIAQoAgAQngkLIARBEGokACAADwsQzwgACwUAQcQvCxAAQdgAEMsIQQBB2AAQqgkLPwEBfyABIAAoAgQiB0EBdWohASAAKAIAIQAgASACIAMgBCAFIAYgB0EBcQR/IAEoAgAgAGooAgAFIAALEVoACz8BAX8gASAAKAIEIgdBAXVqIQEgACgCACEAIAEgAiADIAQgBSAGIAdBAXEEfyABKAIAIABqKAIABSAACxEtAAsFAEGMMQsbAQF/QdgAEMsIQQBB2AAQqgkiAEEBNgI8IAALPwEBfyABIAAoAgQiB0EBdWohASAAKAIAIQAgASACIAMgBCAFIAYgB0EBcQR/IAEoAgAgAGooAgAFIAALEVsAC0MBAX8gASAAKAIEIglBAXVqIQEgACgCACEAIAEgAiADIAQgBSAGIAcgCCAJQQFxBH8gASgCACAAaigCAAUgAAsRXQALOQEBfyABIAAoAgQiBEEBdWohASAAKAIAIQAgASACIAMgBEEBcQR/IAEoAgAgAGooAgAFIAALEVcACwcAIAAoAjgLCQAgACABNgI4CwUAQeAyCwwAIAEgACgCABEQAAsJACABIAAREAALFwAgAEQAAAAAAECPQKNB9PsBKAIAt6ILDAAgASAAKAIAERUACwkAIAEgABEVAAsFAEHMMwsgAQF/QRgQywgiAEIANwMAIABCATcDECAAQgA3AwggAAtsAQF8IAAr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ASADQQhqEAoFQQELNgIAIANBEGokAAs3AQF/IwBBEGsiAyQAIANBCGogASACIAAoAgARBQAgAygCCBALIAMoAggiABAMIANBEGokACAACxcAIAAoAgAgAUECdGogAigCADYCAEEBCzQBAX8jAEEQayIEJAAgACgCACEAIAQgAzYCDCABIAIgBEEMaiAAEQQAIQAgBEEQaiQAIAALBQBBsBkLMAEBfyAAKAIEIgIgACgCCEcEQCACIAEpAwA3AwAgACACQQhqNgIEDwsgACABENACC1IBAn8jAEEQayIDJAAgASAAKAIEIgRBAXVqIQEgACgCACEAIARBAXEEQCABKAIAIABqKAIAIQALIAMgAjkDCCABIANBCGogABECACADQRBqJAALPgECfyAAKAIEIAAoAgAiBGtBA3UiAyABSQRAIAAgASADayACEIQCDwsgAyABSwRAIAAgBCABQQN0ajYCBAsLVAECfyMAQRBrIgQkACABIAAoAgQiBUEBdWohASAAKAIAIQAgBUEBcQRAIAEoAgAgAGooAgAhAAsgBCADOQMIIAEgAiAEQQhqIAARBQAgBEEQaiQACxAAIAAoAgQgACgCAGtBA3ULUQECfyMAQRBrIgMkAEEBIQQgACABKAIEIAEoAgAiAWtBA3UgAksEfyADIAEgAkEDdGopAwA3AwhB4OwBIANBCGoQCgVBAQs2AgAgA0EQaiQACxcAIAAoAgAgAUEDdGogAikDADcDAEEBCzQBAX8jAEEQayIEJAAgACgCACEAIAQgAzkDCCABIAIgBEEIaiAAEQQAIQAgBEEQaiQAIAALBQBBgBwLxAEBBX8gACgCBCICIAAoAggiA0cEQCACIAEtAAA6AAAgACAAKAIEQQFqNgIEDwsgAiAAKAIAIgJrIgVBAWoiBEF/SgRAIAUCf0EAIAQgAyACayIDQQF0IgYgBiAESRtB/////wcgA0H/////A0kbIgNFDQAaIAMQywgLIgRqIgYgAS0AADoAACAFQQFOBEAgBCACIAUQqQkaCyAAIAMgBGo2AgggACAGQQFqNgIEIAAgBDYCACACBEAgAhCeCQsPCxDkCAALUgECfyMAQRBrIgMkACABIAAoAgQiBEEBdWohASAAKAIAIQAgBEEBcQRAIAEoAgAgAGooAgAhAAsgAyACOgAPIAEgA0EPaiAAEQIAIANBEGokAAs4AQJ/IAAoAgQgACgCACIEayIDIAFJBEAgACABIANrIAIQ0QIPCyADIAFLBEAgACABIARqNgIECwtUAQJ/IwBBEGsiBCQAIAEgACgCBCIFQQF1aiEBIAAoAgAhACAFQQFxBEAgASgCACAAaigCACEACyAEIAM6AA8gASACIARBD2ogABEFACAEQRBqJAALDQAgACgCBCAAKAIAawtLAQJ/IwBBEGsiAyQAQQEhBCAAIAEoAgQgASgCACIBayACSwR/IAMgASACaiwAADYCCEHo6wEgA0EIahAKBUEBCzYCACADQRBqJAALFAAgACgCACABaiACLQAAOgAAQQELNAEBfyMAQRBrIgQkACAAKAIAIQAgBCADOgAPIAEgAiAEQQ9qIAARBAAhACAEQRBqJAAgAAsFAEHIHgtLAQJ/IwBBEGsiAyQAQQEhBCAAIAEoAgQgASgCACIBayACSwR/IAMgASACai0AADYCCEH06wEgA0EIahAKBUEBCzYCACADQRBqJAALBQBBiCELUgECfyMAQRBrIgMkACABIAAoAgQiBEEBdWohASAAKAIAIQAgBEEBcQRAIAEoAgAgAGooAgAhAAsgAyACOAIMIAEgA0EMaiAAEQIAIANBEGokAAtUAQJ/IwBBEGsiBCQAIAEgACgCBCIFQQF1aiEBIAAoAgAhACAFQQFxBEAgASgCACAAaigCACEACyAEIAM4AgwgASACIARBDGogABEFACAEQRBqJAALUQECfyMAQRBrIgMkAEEBIQQgACABKAIEIAEoAgAiAWtBAnUgAksEfyADIAEgAkECdGooAgA2AghB1OwBIANBCGoQCgVBAQs2AgAgA0EQaiQACzQBAX8jAEEQayIEJAAgACgCACEAIAQgAzgCDCABIAIgBEEMaiAAEQQAIQAgBEEQaiQAIAALkwIBBn8gACgCCCIEIAAoAgQiA2tBA3UgAU8EQANAIAMgAikDADcDACADQQhqIQMgAUF/aiIBDQALIAAgAzYCBA8LAkAgAyAAKAIAIgZrIgdBA3UiCCABaiIDQYCAgIACSQRAAn9BACADIAQgBmsiBEECdSIFIAUgA0kbQf////8BIARBA3VB/////wBJGyIERQ0AGiAEQYCAgIACTw0CIARBA3QQywgLIgUgCEEDdGohAwNAIAMgAikDADcDACADQQhqIQMg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QeDcAWpCmrPmzJmz5tw/NwMAIABB6N4BakKas+bMmbPm3D83AwAgAEHo3AFqQpqz5syZs+bcPzcDACAAQfDeAWpCmrPmzJmz5tw/NwMAIABB8NwBakKas+bMmbPm3D83AwAgAEH43gFqQpqz5syZs+bcPzcDACAAQfjcAWpCmrPmzJmz5tw/NwMAIABBgN8BakKas+bMmbPm3D83AwAgAEGA3QFqQpqz5syZs+bcPzcDACAAIAFBCm02AozfASAEQpqz5syZs+bkPzcDACAAQoCAgICAgIDwPzcDiNsBA0AgACACQQN0aiIBQcDQAWpCgICAgICAgPg/NwMAIAFBwM4BaiACQQFqIgJBDWy3IgU5AwAgAUHAzAFqIAU5AwAgAUHA0gFqQoCAgICAgID4PzcDACABQcDUAWpCmrPmzJmz5uQ/NwMAIAFBwNYBakKAgICAgICA8D83AwAgAkEgRw0ACyAAQoCAgICAgMCkwAA3A8DMASAAQdDMAWpCgICAgICAsLHAADcDACAAQcjMAWpCgICAgICAwKzAADcDAAucAgAgABDCAyAAQdjQAWpCpreShoLWnPQ/NwMAIABB0NABakL1puKg4MrD9D83AwAgAEHI0AFqQpCw5aGL2Z31PzcDACAAQsPro+H10fD0PzcDwNABIABB2MwBakKAgICAgIDjyMAANwMAIABB0MwBakKAgICAgIDmx8AANwMAIABByMwBakKAgICAgICKxsAANwMAIABCgICAgICAlMTAADcDwMwBIABB0NIBakLmzJmz5syZ8z83AwAgAEHI0gFqQubMmbPmzJnzPzcDACAAQubMmbPmzJnzPzcDwNIBIABB0M4BakKAgICAgICAlMAANwMAIABByM4BakKAgICAgIDAosAANwMAIABCgICAgICA0K/AADcDwM4BIAALmQgCBX8BfCAAQgA3A9jYASAAQdTIAGoCfyAAKwPAzAEiB5lEAAAAAAAA4EFjBEAgB6oMAQtBgICAgHgLIgM2AgAgAEHYyABqIgQgACgCwEggAEHQyABqIgUoAgAiAkEDdGoiBisDAEQzMzMzMzPrP6IgAaAiBzkDACAGIAc5AwAgBUEAIAJBAWogAiADQX9qRhs2AgAgACAEKwMAIAArA9jYAaA5A9jYASAAQfTKAGoCfyAAQcjMAWorAwAiB5lEAAAAAAAA4EFjBEAgB6oMAQtBgICAgHgLIgM2AgAgAEH4ygBqIgQgAEHgygBqKAIAIABB8MoAaiIFKAIAIgJBA3RqIgYrAwBEMzMzMzMz6z+iIAGgIgc5AwAgBiAHOQMAIAVBACACQQFqIAIgA0F/akYbNgIAIAAgBCsDACAAKwPY2AGgOQPY2AEgAEGUzQBqAn8gAEHQzAFqKwMAIgeZRAAAAAAAAOBBYwRAIAeqDAELQYCAgIB4CyIDNgIAIABBmM0AaiIEIABBgM0AaigCACAAQZDNAGoiBSgCACICQQN0aiIGKwMARDMzMzMzM+s/oiABoCIHOQMAIAYgBzkDACAFQQAgAkEBaiACIANBf2pGGzYCACAAIAQrAwAgACsD2NgBoDkD2NgBIABBtM8AagJ/IABB2MwBaisDACIHmUQAAAAAAADgQWMEQCAHqgwBC0GAgICAeAsiAzYCACAAQbjPAGoiBCAAQaDPAGooAgAgAEGwzwBqIgUoAgAiAkEDdGoiBisDAEQzMzMzMzPrP6IgAaAiATkDACAGIAE5AwAgBUEAIAJBAWogAiADQX9qRhs2AgAgACAEKwMAIAArA9jYAaAiATkD2NgBIAACfyAAKwPAzgEiB5lEAAAAAAAA4EFjBEAgB6oMAQtBgICAgHgLIgM2AlQgACAAKAJAIAAoAlAiAkEDdGoiBCsDACIHIAcgACsDaCIHoiABoCIBIAeioTkDWCAEIAE5AwAgAEEAIAJBAWogAiADQX9qRhs2AlAgAAJ/IABByM4BaisDACIBmUQAAAAAAADgQWMEQCABqgwBC0GAgICAeAsiAzYC9AIgACAAKALgAiAAKALwAiICQQN0aiIEKwMAIgEgASAAKwOIAyIBoiAAKwNYoCIHIAGioTkD+AIgBCAHOQMAIABBACACQQFqIAIgA0F/akYbNgLwAiAAAn8gAEHQzgFqKwMAIgGZRAAAAAAAAOBBYwRAIAGqDAELQYCAgIB4CyIDNgKUBSAAIAAoAoAFIAAoApAFIgJBA3RqIgQrAwAiASABIAArA6gFIgGiIAArA/gCoCIHIAGioTkDmAUgBCAHOQMAIABBACACQQFqIAIgA0F/akYbNgKQBSAAIAArA5gFIgE5A8DYASABC+gGAQF/IwBBgAFrIgEkACAAEMIDIABB+MwBakKAgICAgIDcyMAANwMAIABB8MwBakKAgICAgICkycAANwMAIABB6MwBakKAgICAgIDMysAANwMAIABB4MwBakKAgICAgID9ycAANwMAIABB2MwBakKAgICAgICOy8AANwMAIABB0MwBakKAgICAgIDTy8AANwMAIABByMwBakKAgICAgIDRzMAANwMAIABCgICAgICAlczAADcDwMwBIAFC4fXR8PqouPU/NwNIIAFC4fXR8PqouPU/NwNAIAFC4fXR8PqouPU/NwNQIAFC4fXR8PqouPU/NwNYIAFC4fXR8PqouPU/NwNgIAFC4fXR8PqouPU/NwNoIAFC4fXR8PqouPU/NwNwIAFC4fXR8PqouPU/NwN4IAFCmrPmzJmz5uQ/NwM4IAFCmrPmzJmz5uQ/NwMwIAFCmrPmzJmz5uQ/NwMoIAFCmrPmzJmz5uQ/NwMgIAFCmrPmzJmz5uQ/NwMYIAFCmrPmzJmz5uQ/NwMQIAFCmrPmzJmz5uQ/NwMIIAFCmrPmzJmz5uQ/NwMAIABB+NABakLh9dHw+qi49T83AwAgAEHw0AFqQuH10fD6qLj1PzcDACAAQejQAWpC4fXR8PqouPU/NwMAIABB4NABakLh9dHw+qi49T83AwAgAEHY0AFqQuH10fD6qLj1PzcDACAAQdDQAWpC4fXR8PqouPU/NwMAIABByNABakLh9dHw+qi49T83AwAgAEHA0AFqQuH10fD6qLj1PzcDACAAQeDUAWogASkDIDcDACAAQejUAWogASkDKDcDACAAQcDUAWogASkDADcDACAAQcjUAWogASkDCDcDACAAQdjUAWogASkDGDcDACAAQfDUAWogASkDMDcDACAAQfjUAWogASkDODcDACAAQdDUAWogASkDEDcDACAAQdjSAWpCgICAgICAgPA/NwMAIABB0NIBakKAgICAgICA8D83AwAgAEHI0gFqQoCAgICAgIDwPzcDACAAQoCAgICAgIDwPzcDwNIBIABB2M4BakKAgICAgIDUusAANwMAIABB0M4BakKAgICAgIDkvcAANwMAIABByM4BakKAgICAgIDYwMAANwMAIABCgICAgICAiLbAADcDwM4BIAFBgAFqJAAgAAuYCgIGfwF8IABCADcD2NgBIABBuNYBaiADRAAAAAAAAPA/pEQAAAAAAAAAAKUiAzkDACAAQbDWAWogAzkDACAAQajWAWogAzkDACAAQaDWAWogAzkDACAAQZjWAWogAzkDACAAQZDWAWogAzkDACAAQYjWAWogAzkDACAAQYDWAWogAzkDACAAQfjVAWogAzkDACAAQfDVAWogAzkDACAAQejVAWogAzkDACAAQeDVAWogAzkDACAAQdjVAWogAzkDACAAQdDVAWogAzkDACAAQcjVAWogAzkDACAAQcDVAWogAzkDACAAQbjVAWogAzkDACAAQbDVAWogAzkDACAAQajVAWogAzkDACAAQaDVAWogAzkDACAAQZjVAWogAzkDACAAQZDVAWogAzkDACAAQYjVAWogAzkDACAAQYDVAWogAzkDACAAQfjUAWogAzkDACAAQfDUAWogAzkDACAAQejUAWogAzkDACAAQeDUAWogAzkDACAAQdjUAWogAzkDACAAQdDUAWogAzkDACAAQcjUAWogAzkDACAAIAM5A8DUASAAQbjSAWogAkSamZmZmZm5P6JE4XoUrkfh6j+gRAAAAAAAAPA/pEQAAAAAAAAAAKUiAjkDACAAQbDSAWogAjkDACAAQajSAWogAjkDACAAQaDSAWogAjkDACAAQZjSAWogAjkDACAAQZDSAWogAjkDACAAQYjSAWogAjkDACAAQYDSAWogAjkDACAAQfjRAWogAjkDACAAQfDRAWogAjkDACAAQejRAWogAjkDACAAQeDRAWogAjkDACAAQdjRAWogAjkDACAAQdDRAWogAjkDACAAQcjRAWogAjkDACAAQcDRAWogAjkDACAAQbjRAWogAjkDACAAQbDRAWogAjkDACAAQajRAWogAjkDACAAQaDRAWogAjkDACAAQZjRAWogAjkDACAAQZDRAWogAjkDACAAQYjRAWogAjkDACAAQYDRAWogAjkDACAAQfjQAWogAjkDACAAQfDQAWogAjkDACAAQejQAWogAjkDACAAQeDQAWogAjkDACAAQdjQAWogAjkDACAAQdDQAWogAjkDACAAQcjQAWogAjkDACAAIAI5A8DQAQN8IAAgB0EDdGoiBUHA0AFqKwMAIQogACAHQaACbGoiBEHUyABqIggCfyAFQcDMAWorAwAiAplEAAAAAAAA4EFjBEAgAqoMAQtBgICAgHgLNgIAIARB2MgAaiIJAnwgBEHwyABqIgZEAAAAAAAA8D8gA6EgBEHAyABqIgUoAgAgBEHQ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IAcoAkAgD6w3AwAMBQsgBykDQCEWQdzoAAshESAWIBIQgAQhCwsgCEH//3txIAggCkF/ShshCCAHKQNAIRYCfwJAIAoNACAWUEUNACASIQtBAAwBCyAKIBZQIBIgC2tqIgEgCiABShsLIQoLIABBICAOIAkgC2siDCAKIAogDEgbIhBqIgkgDSANIAlIGyIBIAkgCBD9AyAAIBEgDhD6AyAAQTAgASAJIAhBgIAEcxD9AyAAQTAgECAMQQAQ/QMgACALIAwQ+gMgAEEgIAEgCSAIQYDAAHMQ/QMMAQsLQQAhDgsgB0HQAGokACAOCxgAIAAtAABBIHFFBEAgASACIAAQ8AMaCwtKAQN/IAAoAgAsAABBUGpBCkkEQANAIAAoAgAiASwAACEDIAAgAUEBajYCACADIAJBCmxqQVBqIQIgASwAAUFQakEKSQ0ACwsgAgujAgACQAJAIAFBFEsNACABQXdqIgFBCUsNAAJAAkACQAJAAkACQAJAAkAgAUEBaw4JAQIJAwQFBgkHAAsgAiACKAIAIgFBBGo2AgAgACABKAIANgIADwsgAiACKAIAIgFBBGo2AgAgACABNAIANwMADwsgAiACKAIAIgFBBGo2AgAgACABNQIANwMADwsgAiACKAIAIgFBBGo2AgAgACABMgEANwMADwsgAiACKAIAIgFBBGo2AgAgACABMwEANwMADwsgAiACKAIAIgFBBGo2AgAgACABMAAANwMADwsgAiACKAIAIgFBBGo2AgAgACABMQAANwMADwsgACACIAMRAgALDwsgAiACKAIAQQdqQXhxIgFBCGo2AgAgACABKQMANwMAC3sBAX8jAEGAAmsiBSQAAkAgAiADTA0AIARBgMAEcQ0AIAUgASACIANrIgRBgAIgBEGAAkkiARsQqgkaIAAgBSABBH8gBAUgAiADayEBA0AgACAFQYACEPoDIARBgH5qIgRB/wFLDQALIAFB/wFxCxD6AwsgBUGAAmokAAstACAAUEUEQANAIAFBf2oiASAAp0EHcUEwcjoAACAAQgOIIgBCAFINAAsLIAELNQAgAFBFBEADQCABQX9qIgEgAKdBD3FBwOwAai0AACACcjoAACAAQgSIIgBCAFINAAsLIAELgwECA38BfgJAIABCgICAgBBUBEAgACEFDAELA0AgAUF/aiIBIAAgAEIKgCIF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QQo6AAAMAQsgACABQQ9qQQEgACgCJBEEAEEBRw0AIAEtAA8aCyABQRBqJAALfgECfyAABEAgACgCTEF/TARAIAAQogQPCyAAEKIEDwtBoIgCKAIABEBBoIgCKAIAEKEEIQELEIUEKAIAIgAEQANAIAAoAkxBAE4Ef0EBBUEACxogACgCFCAAKAIcSwRAIAAQogQgAXIhAQsgACgCOCIADQALC0GkkgIQEiABC2kBAn8CQCAAKAIUIAAoAhxNDQAgAEEAQQAgACgCJBEEABogACgCFA0AQX8PCyAAKAIEIgEgACgCCCICSQRAIAAgASACa6xBASAAKAIoERwAGgsgAEEANgIcIABCADcDECAAQgA3AgRBAAtBAQJ/IwBBEGsiASQAQX8hAgJAIAAQjAQNACAAIAFBD2pBASAAKAIgEQQAQQFHDQAgAS0ADyECCyABQRBqJAAgAgsxAQJ/IAAQhQQiASgCADYCOCABKAIAIgIEQCACIAA2AjQLIAEgADYCAEGkkgIQEiAAC1ABAX4CQCADQcAAcQRAIAIgA0FAaq2IIQFCACECDAELIANFDQAgAkHAACADa62GIAEgA60iBIiEIQEgAiAEiCECCyAAIAE3AwAgACACNwMIC1ABAX4CQCADQcAAcQRAIAEgA0FAaq2GIQJCACEBDAELIANFDQAgAiADrSIEhiABQcAAIANrrYiEIQIgASAEhiEBCyAAIAE3AwAgACACNwMIC9kDAgJ/An4jAEEgayICJAACQCABQv///////////wCDIgVCgICAgICAwP9DfCAFQoCAgICAgMCAvH98VARAIAFCBIYgAEI8iIQhBCAAQv//////////D4MiAEKBgICAgICAgAhaBEAgBEKBgICAgICAgMAAfCEEDAILIARCgICAgICAgIBAfSEEIABCgICAgICAgIAIhUIAUg0BIARCAYMgBHwhBAwBCyAAUCAFQoCAgICAgMD//wBUIAVCgICAgICAwP//AFEbRQRAIAFCBIYgAEI8iIRC/////////wODQoCAgICAgID8/wCEIQQMAQtCgICAgICAgPj/ACEEIAVC////////v//DAFYNAEIAIQQgBUIwiKciA0GR9wBJDQAgAiAAIAFC////////P4NCgICAgICAwACEIgRBgfgAIANrEKUEIAJBEGogACAEIANB/4h/ahCm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F3ZB6n5qIgJBF3Rrvrs5AwggA0EIaiADIAJBAUEAEKkEIQIgAysDACEFIARBf0wEQCABIAWaOQMAQQAgAmshAgwBCyABIAU5AwALIANBEGokACACC/wCAgN/AXwjAEEQayICJAACfSAAvCIDQf////8HcSIBQdqfpPoDTQRAQwAAgD8gAUGAgIDMA0kNARogALsQrQQMAQsgAUHRp+2DBE0EQCAAuyEEIAFB5JfbgARPBEBEGC1EVPshCUBEGC1EVPshCcAgA0EASBsgBKAQrQSMDAILIANBf0wEQCAERBgtRFT7Ifk/oBCuBAwCC0QYLURU+yH5PyAEoRCuBAwBCyABQdXjiIcETQRAIAFB4Nu/hQRPBEBEGC1EVPshGUBEGC1EVPshGcAgA0EASBsgALugEK0EDAILIANBf0wEQETSITN/fNkSwCAAu6EQrgQMAgsgALtE0iEzf3zZEsCgEK4EDAELIAAgAJMgAUGAgID8B08NABogACACQQhqEK8EQQNxIgFBAk0EQAJAAkACQCABQQFrDgIBAgALIAIrAwgQrQQMAwsgAisDCJoQrgQMAgsgAisDCBCtBIwMAQsgAisDCBCuBAshACACQRBqJAAgAAvUAQECfyMAQRBrIgEkAAJAIAC9QiCIp0H/////B3EiAkH7w6T/A00EQCACQYCAwPIDSQ0BIABEAAAAAAAAAABBABCrBCEADAELIAJBgIDA/wdPBEAgACAAoSEADAELIAAgARCqBEEDcSICQQJNBEACQAJAAkAgAkEBaw4CAQIACyABKwMAIAErAwhBARCrBCEADAMLIAErAwAgASsDCBCoBCEADAILIAErAwAgASsDCEEBEKsEmiEADAELIAErAwAgASsDCBCoBJohAAsgAUEQaiQAIAALkgMCA38BfCMAQRBrIgIkAAJAIAC8IgNB/////wdxIgFB2p+k+gNNBEAgAUGAgIDMA0kNASAAuxCuBCEADAELIAFB0aftgwRNBEAgALshBCABQeOX24AETQRAIANBf0wEQCAERBgtRFT7Ifk/oBCtBIwhAAwDCyAERBgtRFT7Ifm/oBCtBCEADAILRBgtRFT7IQlARBgtRFT7IQnAIANBAEgbIASgmhCuBCEADAELIAFB1eOIhwRNBEAgALshBCABQd/bv4UETQRAIANBf0wEQCAERNIhM3982RJA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AkF/aiIARQ0CIAFBAWohAQsgAS0AACIIQQN2IglBcGogA0EadSAJanJBB0sNAANAIABBf2ohACAIQYB/aiADQQZ0ciIDQQBOBEAgBUEANgIAIAYgAzYCACACIABrIQQMBAsgAEUNAiABQQFqIgEtAAAiCEHAAXFBgAFGDQALCyAFQQA2AgBB4JECQRk2AgBBfyEEDAELIAUgAzYCAAsgB0EQaiQAIAQLywECBH8CfiMAQRBrIgMkACABvCIEQYCAgIB4cSEFAn4gBEH/////B3EiAkGAgIB8akH////3B00EQCACrUIZhkKAgICAgICAwD98DAELIAJBgICA/AdPBEAgBK1CGYZCgICAgICAwP//AIQMAQsgAkUEQEIADAELIAMgAq1CACACZyICQdEAahCmBCADKQMAIQYgAykDCEKAgICAgIDAAIVBif8AIAJrrUIwhoQLIQcgACAGNwMAIAAgByAFrUIghoQ3AwggA0EQaiQAC54LAgV/D34jAEHgAGsiBSQAIARCL4YgA0IRiIQhDyACQiCGIAFCIIiEIQ0gBEL///////8/gyIOQg+GIANCMYiEIRAgAiAEhUKAgICAgICAgIB/gyEKIA5CEYghESACQv///////z+DIgtCIIghEiAEQjCIp0H//wFxIQcCQAJ/IAJCMIinQf//AXEiCUF/akH9/wFNBEBBACAHQX9qQf7/AUkNARoLIAFQIAJC////////////AIMiDEKAgICAgIDA//8AVCAMQoCAgICAgMD//wBRG0UEQCACQoCAgICAgCCEIQoMAgsgA1AgBEL///////////8AgyICQoCAgICAgMD//wBUIAJCgICAgICAwP//AFEbRQRAIARCgICAgICAIIQhCiADIQEMAgsgASAMQoCAgICAgMD//wCFhFAEQCACIAOEUARAQoCAgICAgOD//wAhCkIAIQEMAwsgCkKAgICAgIDA//8AhCEKQgAhAQwCCyADIAJCgICAgICAwP//AIWEUARAIAEgDIQhAkIAIQEgAlAEQEKAgICAgIDg//8AIQoMAwsgCkKAgICAgIDA//8AhCEKDAILIAEgDIRQBEBCACEBDAILIAIgA4RQBEBCACEBDAILIAxC////////P1gEQCAFQdAAaiABIAsgASALIAtQIgYbeSAGQQZ0rXynIgZBcWoQpgQgBSkDWCILQiCGIAUpA1AiAUIgiIQhDSALQiCIIRJBECAGayEGCyAGIAJC////////P1YNABogBUFAayADIA4gAyAOIA5QIggbeSAIQQZ0rXynIghBcWoQpgQgBSkDSCICQg+GIAUpA0AiA0IxiIQhECACQi+GIANCEYiEIQ8gAkIRiCERIAYgCGtBEGoLIQYgD0L/////D4MiAiABQv////8PgyIBfiIPIANCD4ZCgID+/w+DIgMgDUL/////D4MiDH58IgRCIIYiDiABIAN+fCINIA5UrSACIAx+IhUgAyALQv////8PgyILfnwiEyAQQv////8PgyIOIAF+fCIQIAQgD1StQiCGIARCIIiEfCIUIAIgC34iFiADIBJCgIAEhCIPfnwiAyAMIA5+fCISIAEgEUL/////B4NCgICAgAiEIgF+fCIRQiCGfCIXfCEEIAcgCWogBmpBgYB/aiEGAkAgCyAOfiIYIAIgD358IgIgGFStIAIgASAMfnwiDCACVK18IAwgEyAVVK0gECATVK18fCICIAxUrXwgASAPfnwgASALfiILIA4gD358IgEgC1StQiCGIAFCIIiEfCACIAFCIIZ8IgEgAlStfCABIBEgElStIAMgFlStIBIgA1StfHxCIIYgEUIgiIR8IgMgAVStfCADIBQgEFStIBcgFFStfHwiAiADVK18IgFCgICAgICAwACDUEUEQCAGQQFqIQYMAQsgDUI/iCEDIAFCAYYgAkI/iIQhASACQgGGIARCP4iEIQIgDUIBhiENIAMgBEIBhoQhBAsgBkH//wFOBEAgCkKAgICAgIDA//8AhCEKQgAhAQwBCwJ+IAZBAEwEQEEBIAZrIgdB/wBNBEAgBUEQaiANIAQgBxClBCAFQSBqIAIgASAGQf8AaiIGEKYEIAVBMGogDSAEIAYQpgQgBSACIAEgBxClBCAFKQMwIAUpAziEQgBSrSAFKQMgIAUpAxCEhCENIAUpAyggBSkDGIQhBCAFKQMAIQIgBSkDCAwCC0IAIQEMAgsgAUL///////8/gyAGrUIwhoQLIAqEIQogDVAgBEJ/VSAEQoCAgICAgICAgH9RG0UEQCAKIAJCAXwiASACVK18IQoMAQsgDSAEQoCAgICAgICAgH+FhFBFBEAgAiEBDAELIAogAiACQgGDfCIBIAJUrXwhCgsgACABNwMAIAAgCjcDCCAFQeAAaiQAC38CAn8BfiMAQRBrIgMkACAAAn4gAUUEQEIADAELIAMgASABQR91IgJqIAJzIgKtQgAgAmciAkHRAGoQpgQgAykDCEKAgICAgIDAAIVBnoABIAJrrUIwhnwgAUGAgICAeHGtQiCGhCEEIAMpAwALNwMAIAAgBDcDCCADQRBqJAALyAkCBH8EfiMAQfAAayIFJAAgBEL///////////8AgyEKAkACQCABQn98IgtCf1EgAkL///////////8AgyIJIAsgAVStfEJ/fCILQv///////7///wBWIAtC////////v///AFEbRQRAIANCf3wiC0J/UiAKIAsgA1StfEJ/fCILQv///////7///wBUIAtC////////v///AFEbDQELIAFQIAlCgICAgICAwP//AFQgCUKAgICAgIDA//8AURtFBEAgAkKAgICAgIAghCEEIAEhAwwCCyADUCAKQoCAgICAgMD//wBUIApCgICAgICAwP//AFEbRQRAIARCgICAgICAIIQhBAwCCyABIAlCgICAgICAwP//AIWEUARAQoCAgICAgOD//wAgAiABIAOFIAIgBIVCgICAgICAgICAf4WEUCIGGyEEQgAgASAGGyEDDAILIAMgCkKAgICAgIDA//8AhYRQDQEgASAJhFAEQCADIAqEQgBSDQIgASADgyEDIAIgBIMhBAwCCyADIAqEUEUNACABIQMgAiEEDAELIAMgASADIAFWIAogCVYgCSAKURsiBxshCiAEIAIgBxsiC0L///////8/gyEJIAIgBCAHGyICQjCIp0H//wFxIQggC0IwiKdB//8BcSIGRQRAIAVB4ABqIAogCSAKIAkgCVAiBht5IAZBBnStfKciBkFxahCmBCAFKQNoIQkgBSkDYCEKQRAgBmshBgsgASADIAcbIQMgAkL///////8/gyEBIAgEfiABBSAFQdAAaiADIAEgAyABIAFQIgcbeSAHQQZ0rXynIgdBcWoQpgRBECAHayEIIAUpA1AhAyAFKQNYC0IDhiADQj2IhEKAgICAgICABIQhBCAJQgOGIApCPYiEIQEgAiALhSEMAn4gA0IDhiIDIAYgCGsiB0UNABogB0H/AEsEQEIAIQRCAQwBCyAFQUBrIAMgBEGAASAHaxCmBCAFQTBqIAMgBCAHEKUEIAUpAzghBCAFKQMwIAUpA0AgBSkDSIRCAFKthAshAyABQoCAgICAgIAEhCEJIApCA4YhAgJAIAxCf1cEQCACIAN9IgEgCSAEfSACIANUrX0iA4RQBEBCACEDQgAhBAwDCyADQv////////8DVg0BIAVBIGogASADIAEgAyADUCIHG3kgB0EGdK18p0F0aiIHEKYEIAYgB2shBiAFKQMoIQMgBSkDICEBDAELIAIgA3wiASADVK0gBCAJfHwiA0KAgICAgICACINQDQAgAUIBgyADQj+GIAFCAYiEhCEBIAZBAWohBiADQgGIIQMLIAtCgICAgICAgICAf4MhAiAGQf//AU4EQCACQoCAgICAgMD//wCEIQRCACEDDAELQQAhBwJAIAZBAEoEQCAGIQcMAQsgBUEQaiABIAMgBkH/AGoQpgQgBSABIANBASAGaxClBCAFKQMAIAUpAxAgBSkDGIRCAFKthCEBIAUpAwghAwsgA0I9hiABQgOIhCIEIAGnQQdxIgZBBEutfCIBIARUrSADQgOIQv///////z+DIAKEIAetQjCGhHwgASABQgGDQgAgBkEERhsiAXwiAyABVK18IQQLIAAgAzcDACAAIAQ3AwggBUHwAGokAAuBAgICfwR+IwBBEGsiAiQAIAG9IgVCgICAgICAgICAf4MhBwJ+IAVC////////////AIMiBEKAgICAgICAeHxC/////////+//AFgEQCAEQjyGIQYgBEIEiEKAgICAgICAgDx8DAELIARCgICAgICAgPj/AFoEQCAFQjyGIQYgBUIEiEKAgICAgIDA//8AhAwBCyAEUARAQgAMAQsgAiAEQgAgBEKAgICAEFoEfyAEQiCIp2cFIAWnZ0EgagsiA0ExahCmBCACKQMAIQYgAikDCEKAgICAgIDAAIVBjPgAIANrrUIwhoQLIQQgACAGNwMAIAAgBCAHhDcDCCACQRBqJAAL2wECAX8CfkEBIQQCQCAAQgBSIAFC////////////AIMiBUKAgICAgIDA//8AViAFQoCAgICAgMD//wBRGw0AIAJCAFIgA0L///////////8AgyIGQoCAgICAgMD//wBWIAZCgICAgICAwP//AFEbDQAgACAChCAFIAaEhFAEQEEADwsgASADg0IAWQRAQX8hBCAAIAJUIAEgA1MgASADURsNASAAIAKFIAEgA4WEQgBSDwtBfyEEIAAgAlYgASADVSABIANRGw0AIAAgAoUgASADhYRCAFIhBAsgBAvYAQIBfwF+QX8hAgJAIABCAFIgAUL///////////8AgyIDQoCAgICAgMD//wBWIANCgICAgICAwP//AFEbDQAgACADQoCAgICAgID/P4SEUARAQQAPCyABQoCAgICAgID/P4NCAFkEQCAAQgBUIAFCgICAgICAgP8/UyABQoCAgICAgID/P1EbDQEgACABQoCAgICAgID/P4WEQgBSDwsgAEIAViABQoCAgICAgID/P1UgAUKAgICAgICA/z9RGw0AIAAgAUKAgICAgICA/z+FhEIAUiECCyACCzUAIAAgATcDACAAIAJC////////P4MgBEIwiKdBgIACcSACQjCIp0H//wFxcq1CMIaENwMIC2cCAX8BfiMAQRBrIgIkACAAAn4gAUUEQEIADAELIAIgAa1CAEHwACABZ0EfcyIBaxCmBCACKQMIQoCAgICAgMAAhSABQf//AGqtQjCGfCEDIAIpAwALNwMAIAAgAzcDCCACQRBqJAALRQEBfyMAQRBrIgUkACAFIAEgAiADIARCgICAgICAgICAf4UQrAUgBSkDACEBIAAgBSkDCDcDCCAAIAE3AwAgBUEQaiQAC8QCAQF/IwBB0ABrIgQkAAJAIANBgIABTgRAIARBIGogASACQgBCgICAgICAgP//ABCqBSAEKQMoIQIgBCkDICEBIANB//8BSARAIANBgYB/aiEDDAILIARBEGogASACQgBCgICAgICAgP//ABCqBSADQf3/AiADQf3/AkgbQYKAfmohAyAEKQMYIQIgBCkDECEBDAELIANBgYB/Sg0AIARBQGsgASACQgBCgICAgICAwAAQqgUgBCkDSCECIAQpA0AhASADQYOAfkoEQCADQf7/AGohAwwBCyAEQTBqIAEgAkIAQoCAgICAgMAAEKoFIANBhoB9IANBhoB9ShtB/P8BaiEDIAQpAzghAiAEKQMwIQELIAQgASACQgAgA0H//wBqrUIwhhCqBSAAIAQpAwg3AwggACAEKQMANwMAIARB0ABqJAALjhECBX8MfiMAQcABayIFJAAgBEL///////8/gyESIAJC////////P4MhDCACIASFQoCAgICAgICAgH+DIREgBEIwiKdB//8BcSEHAkACQAJAIAJCMIinQf//AXEiCUF/akH9/wFNBEAgB0F/akH+/wFJDQELIAFQIAJC////////////AIMiCkKAgICAgIDA//8AVCAKQoCAgICAgMD//wBRG0UEQCACQoCAgICAgCCEIREMAgsgA1AgBEL///////////8AgyICQoCAgICAgMD//wBUIAJCgICAgICAwP//AFEbRQRAIARCgICAgICAIIQhESADIQEMAgsgASAKQoCAgICAgMD//wCFhFAEQCADIAJCgICAgICAwP//AIWEUARAQgAhAUKAgICAgIDg//8AIREMAwsgEUKAgICAgIDA//8AhCERQgAhAQwCCyADIAJCgICAgICAwP//AIWEUARAQgAhAQwCCyABIAqEUA0CIAIgA4RQBEAgEUKAgICAgIDA//8AhCERQgAhAQwCCyAKQv///////z9YBEAgBUGwAWogASAMIAEgDCAMUCIGG3kgBkEGdK18pyIGQXFqEKYEQRAgBmshBiAFKQO4ASEMIAUpA7ABIQELIAJC////////P1YNACAFQaABaiADIBIgAyASIBJQIggbeSAIQQZ0rXynIghBcWoQpgQgBiAIakFwaiEGIAUpA6gBIRIgBSkDoAEhAwsgBUGQAWogEkKAgICAgIDAAIQiFEIPhiADQjGIhCICQoTJ+c6/5ryC9QAgAn0iBBCmBSAFQYABakIAIAUpA5gBfSAEEKYFIAVB8ABqIAUpA4gBQgGGIAUpA4ABQj+IhCIEIAIQpgUgBUHgAGogBEIAIAUpA3h9EKYFIAVB0ABqIAUpA2hCAYYgBSkDYEI/iIQiBCACEKYFIAVBQGsgBEIAIAUpA1h9EKYFIAVBMGogBSkDSEIBhiAFKQNAQj+IhCIEIAIQpgUgBUEgaiAEQgAgBSkDOH0QpgUgBUEQaiAFKQMoQgGGIAUpAyBCP4iEIgQgAhCmBSAFIARCACAFKQMYfRCmBSAGIAkgB2tqIQYCfkIAIAUpAwhCAYYgBSkDAEI/iIRCf3wiCkL/////D4MiBCACQiCIIg5+IhAgCkIgiCIKIAJC/////w+DIgt+fCICQiCGIg0gBCALfnwiCyANVK0gCiAOfiACIBBUrUIghiACQiCIhHx8IAsgBCADQhGIQv////8PgyIOfiIQIAogA0IPhkKAgP7/D4MiDX58IgJCIIYiDyAEIA1+fCAPVK0gCiAOfiACIBBUrUIghiACQiCIhHx8fCICIAtUrXwgAkIAUq18fSILQv////8PgyIOIAR+IhAgCiAOfiINIAQgC0IgiCIPfnwiC0IghnwiDiAQVK0gCiAPfiALIA1UrUIghiALQiCIhHx8IA5CACACfSICQiCIIgsgBH4iECACQv////8PgyINIAp+fCICQiCGIg8gBCANfnwgD1StIAogC34gAiAQVK1CIIYgAkIgiIR8fHwiAiAOVK18IAJCfnwiECACVK18Qn98IgtC/////w+DIgIgDEIChiABQj6IhEL/////D4MiBH4iDiABQh6IQv////8PgyIKIAtCIIgiC358Ig0gDlStIA0gEEIgiCIOIAxCHohC///v/w+DQoCAEIQiDH58Ig8gDVStfCALIAx+fCACIAx+IhMgBCALfnwiDSATVK1CIIYgDUIgiIR8IA8gDUIghnwiDSAPVK18IA0gCiAOfiITIBBC/////w+DIhAgBH58Ig8gE1StIA8gAiABQgKGQvz///8PgyITfnwiFSAPVK18fCIPIA1UrXwgDyALIBN+IgsgDCAQfnwiDCAEIA5+fCIEIAIgCn58IgJCIIggAiAEVK0gDCALVK0gBCAMVK18fEIghoR8IgwgD1StfCAMIBUgDiATfiIEIAogEH58IgpCIIggCiAEVK1CIIaEfCIEIBVUrSAEIAJCIIZ8IARUrXx8IgQgDFStfCICQv////////8AWARAIAFCMYYgBEL/////D4MiASADQv////8PgyIKfiIMQgBSrX1CACAMfSIQIARCIIgiDCAKfiINIAEgA0IgiCILfnwiDkIghiIPVK19IAJC/////w+DIAp+IAEgEkL/////D4N+fCALIAx+fCAOIA1UrUIghiAOQiCIhHwgBCAUQiCIfiADIAJCIIh+fCACIAt+fCAMIBJ+fEIghnx9IRIgBkF/aiEGIBAgD30MAQsgBEIhiCELIAFCMIYgAkI/hiAEQgGIhCIEQv////8PgyIBIANC/////w+DIgp+IgxCAFKtfUIAIAx9Ig4gASADQiCIIgx+IhAgCyACQh+GhCINQv////8PgyIPIAp+fCILQiCGIhNUrX0gDCAPfiAKIAJCAYgiCkL/////D4N+fCABIBJC/////w+DfnwgCyAQVK1CIIYgC0IgiIR8IAQgFEIgiH4g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ACAAKAIEQX9qNgIEQoCAgICAgICAgH8PCyAGC7YDAgN/AX4jAEEgayIDJAACQCABQv///////////wCDIgVCgICAgICAwL9AfCAFQoCAgICAgMDAv398VARAIAFCGYinIQIgAFAgAUL///8PgyIFQoCAgAhUIAVCgICACFEbRQRAIAJBgYCAgARqIQIMAgsgAkGAgICABGohAiAAIAVCgICACIWEQgBSDQEgAkEBcSACaiECDAELIABQIAVCgICAgICAwP//AFQgBUKAgICAgIDA//8AURtFBEAgAUIZiKdB////AXFBgICA/gdyIQIMAQtBgICA/AchAiAFQv///////7+/wABWDQBBACECIAVCMIinIgRBkf4ASQ0AIAMgACABQv///////z+DQoCAgICAgMAAhCIFQYH/ACAEaxClBCADQRBqIAAgBSAEQf+Bf2oQpgQgAykDCCIAQhmIpyECIAMpAwAgAykDECADKQMYhEIAUq2EIgVQIABC////D4MiAEKAgIAIVCAAQoCAgAhRG0UEQCACQQFqIQIMAQsgBSAAQoCAgAiFhEIAUg0AIAJBAXEgAmohAgsgA0EgaiQAIAIgAUIgiKdBgICAgHhxcr4L8RMCDX8DfiMAQbACayIGJAAgACgCTEEATgR/QQEFQQALGgJAIAEtAAAiBEUNAAJAA0ACQAJAIARB/wFxIgNBIEYgA0F3akEFSXIEQANAIAEiBEEBaiEBIAQtAAEiA0EgRiADQXdqQQVJcg0ACyAAQgAQpAUDQAJ/IAAoAgQiASAAKAJoSQRAIAAgAUEBajYCBCABLQAADAELIAAQpQULIgFBIEYgAUF3akEFSXINAAsCQCAAKAJoRQRAIAAoAgQhAQwBCyAAIAAoAgRBf2oiATYCBAsgASAAKAIIa6wgACkDeCAQfHwhEAwBCwJAAkACQCABLQAAIgRBJUYEQCABLQABIgNBKkYNASADQSVHDQILIABCABCkBSABIARBJUZqIQQCfyAAKAIEIgEgACgCaEkEQCAAIAFBAWo2AgQgAS0AAAwBCyAAEKUFCyIBIAQtAABHBEAgACgCaARAIAAgACgCBEF/ajYCBAtBACEMIAFBAE4NCAwFCyAQQgF8IRAMAwsgAUECaiEEQQAhBwwBCwJAIANBUGpBCk8NACABLQACQSRHDQAgAUEDaiEEIAIg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DQAgBC0AACACRw0AIARBAWohBAwBCwsgBiAEIAMQkAcLIABBmAFqIABBkAFqEN8EBEAgBSAFKAIAQQJyNgIACyAAKAKYASEDAn8gACgCECICIAIoAgRBf2oiBDYCBCAEQX9GCwRAIAIgAigCACgCCBEBAAsgASgCACECIAFBADYCACACBEAgAiABKAIEEQEACyAAQaABaiQAIAMLWwECfyMAQRBrIgEkAAJAIAAsAAtBAEgEQCAAKAIAIQIgAUEAOgAPIAIgAS0ADzoAACAAQQA2AgQMAQsgAUEAOgAOIAAgAS0ADjoAACAAQQA6AAsLIAFBEGokAAusAwEFfyMAQSBrIgUkAAJ/IAAsAAtBAEgEQCAAKAIEDAELIAAtAAsLIQMgACwAC0EASAR/IAAoAghB/////wdxQX9qBUEKCyEEAkAgAiABayIGRQ0AAn8CfyAALAALQQBIBEAgACgCAAwBCyAACyEHIAECfyAALAALQQBIBEAgACgCAAwBCyAACwJ/IAAsAAtBAEgEQCAAKAIEDAELIAAtAAsLakkgByABTXELBEAgAAJ/An8gBUEQaiIAIgNCADcCACADQQA2AgggACABIAIQ2gUgACIBLAALQQBICwRAIAEoAgAMAQsgAQsCfyAALAALQQBIBEAgACgCBAwBCyAALQALCxDaCCAAENIIGgwBCyAEIANrIAZJBEAgACAEIAMgBmogBGsgAyADENgICwJ/IAAsAAtBAEgEQCAAKAIADAELIAALIANqIQQDQCABIAJHBEAgBCABLQAAOgAAIAFBAWohASAEQQFqIQQMAQsLIAVBADoADyAEIAUtAA86AAAgAyAGaiEBAkAgACwAC0EASARAIAAgATYCBAwBCyAAIAE6AAsLCyAFQSBqJAALCwAgAEHEqwIQ4wULIAAgABDECCAAIAEoAgg2AgggACABKQIANwIAIAEQiAYLCwAgAEG8qwIQ4wULfgEBfyMAQSBrIgMkACADIAE2AhAgAyAANgIYIAMgAjYCCANAAkACf0EBIAMoAhggAygCEEZBAXNFDQAaIAMoAhgtAAAgAygCCC0AAEYNAUEACyEAIANBIGokACAADwsgAyADKAIYQQFqNgIYIAMgAygCCEEBajYCCAwAAAsACzQBAX8jAEEQayICJAAgAiAAKAIANgIIIAIgAigCCCABajYCCCAC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IAogARCgByIAIgEgASgCACgCLBECACACIAooAgA2AAAgCiAAIAAoAgAoAiARAgAgCCAKEJ8HIAoQ0ggaIAogACAAKAIAKAIcEQIAIAcgChCfByAKENIIGiADIAAgACgCACgCDBEAADYCACAEIAAgACgCACgCEBEAADYCACAKIAAgACgCACgCFBECACAFIAoQkgcgChDSCBogCiAAIAAoAgAoAhgRAgAgBiAKEJ8HIAoQ0ggaIAAgACgCACgCJBEAAAs2AgAgCkEQaiQACx8BAX8gASgCABDuBCECIAAgASgCADYCBCAAIAI2AgAL/AIBAX8jAEHAA2siACQAIAAgATYCuAMgACACNgKwAyAAQeMENgIUIABBGGogAEEgaiAAQRRqEOQFIQEgACAEKAIcIgc2AhAgByAHKAIEQQFqNgIEIABBEGoQ6AQhByAAQQA6AA8gAEG4A2ogAiADIABBEGogBCgCBCAFIABBD2ogByABIABBFGogAEGwA2oQmAcEQCAGEJwHIAAtAA8EQCAGIAdBLSAHKAIAKAIsEQMAEOIICyAHQTAgBygCACgCLBEDACECIAEoAgAhBCAAKAIUIgNBfGohBwNAAkAgBCAHTw0AIAQoAgAgAkcNACAEQQRqIQQMAQsLIAYgBCADEJ0HCyAAQbgDaiAAQbADahDrBARAIAUgBSgCAEECcjYCAAsgACgCuAMhAwJ/IAAoAhAiAiACKAIEQX9qIgQ2AgQgBEF/RgsEQCACIAIoAgAoAggRAQALIAEoAgAhAiABQQA2AgAgAgRAIAIgASgCBBEBAAsgAEHAA2okACADC1sBAn8jAEEQayIBJAACQCAALAALQQBIBEAgACgCACECIAFBADYCDCACIAEoAgw2AgAgAEEANgIEDAELIAFBADYCCCAAIAEoAgg2AgAgAEEAOgALCyABQRBqJAALrgMBBX8jAEEQayIDJAACfyAALAALQQBIBEAgACgCBAwBCyAALQALCyEFIAAsAAtBAEgEfyAAKAIIQf////8HcUF/agVBAQshBAJAIAIgAWtBAnUiBkUNAAJ/An8gACwAC0EASARAIAAoAgAMAQsgAAshByABAn8gACwAC0EASARAIAAoAgAMAQsgAAsCfyAALAALQQBIBEAgACgCBAwBCyAALQALC0ECdGpJIAcgAU1xCwRAIAACfwJ/IANCADcCACADQQA2AgggAyABIAIQ3gUgAyIALAALQQBICwRAIAAoAgAMAQsgAAsCfyADLAALQQBIBEAgAygCBAwBCyADLQALCxDhCCADENIIGgwBCyAEIAVrIAZJBEAgACAEIAUgBmogBGsgBSAFEOAICwJ/IAAsAAtBAEgEQCAAKAIADAELIAALIAVBAnRqIQQDQCABIAJHBEAgBCABKAIANgIAIAFBBGohASAEQQRqIQQMAQsLIANBADYCACAEIAMoAgA2AgAgBSAGaiEBAkAgACwAC0EASARAIAAgATYCBAwBCyAAIAE6AAsLCyADQRBqJAALCwAgAEHUqwIQ4wULIAAgABDFCCAAIAEoAgg2AgggACABKQIANwIAIAEQiAYLCwAgAEHMqwIQ4wULfgEBfyMAQSBrIgMkACADIAE2AhAgAyAANgIYIAMgAjYCCANAAkACf0EBIAMoAhggAygCEEZBAXNFDQAaIAMoAhgoAgAgAygCCCgCAEYNAUEACyEAIANBIGokACAADwsgAyADKAIYQQRqNgIYIAMgAygCCEEEajYCCAwAAAsACzcBAX8jAEEQayICJAAgAiAAKAIANgIIIAIgAigCCCABQQJ0ajYCCCACKAIIIQAgAkEQaiQAIAAL9AYBC38jAEHQA2siACQAIAAgBTcDECAAIAY3AxggACAAQeACajYC3AIgAEHgAmogAEEQahDJBSEJIABB4gQ2AvABIABB6AFqQQAgAEHwAWoQ5AUhCyAAQeIENgLwASAAQeABakEAIABB8AFqEOQFIQogAEHwAWohDAJAIAlB5ABPBEAQhgYhByAAIAU3AwAgACAGNwMIIABB3AJqIAdB77YBIAAQtgYhCSAAKALcAiIIRQ0BIAsoAgAhByALIAg2AgAgBwRAIAcgCygCBBEBAAsgCRCdCSEIIAooAgAhByAKIAg2AgAgBwRAIAcgCigCBBEBAAsgCigCAEEAR0EBcw0BIAooAgAhDAsgACADKAIcIgc2AtgBIAcgBygCBEEBajYCBCAAQdgBahDbBCIRIgcgACgC3AIiCCAIIAlqIAwgBygCACgCIBEIABogAgJ/IAkEQCAAKALcAi0AAEEtRiEPCyAPCyAAQdgBaiAAQdABaiAAQc8BaiAAQc4BaiAAQcABahDpBSIQIABBsAFqEOkFIg0gAEGgAWoQ6QUiByAAQZwBahCkByAAQeIENgIwIABBKGpBACAAQTBqEOQFIQgCfyAJIAAoApwBIgJKBEACfyAHLAALQQBIBEAgBygCBAwBCyAHLQALCyAJIAJrQQF0QQFyagwBCwJ/IAcsAAtBAEgEQCAHKAIEDAELIActAAsLQQJqCyEOIABBMGohAiAAKAKcAQJ/IA0sAAtBAEgEQCANKAIEDAELIA0tAAsLIA5qaiIOQeUATwRAIA4QnQkhDiAIKAIAIQIgCCAONgIAIAIEQCACIAgoAgQRAQALIAgoAgAiAkUNAQsgAiAAQSRqIABBIGogAygCBCAMIAkgDGogESAPIABB0AFqIAAsAM8BIAAsAM4BIBAgDSAHIAAoApwBEKUHIAEgAiAAKAIkIAAoAiAgAyAEEKsDIQIgCCgCACEBIAhBADYCACABBEAgASAIKAIEEQEACyAHENIIGiANENIIGiAQENIIGgJ/IAAoAtgBIgEgASgCBEF/aiIDNgIEIANBf0YLBEAgASABKAIAKAIIEQEACyAKKAIAIQEgCkEANgIAIAEEQCABIAooAgQRAQALIAsoAgAhASALQQA2AgAgAQRAIAEgCygCBBEBAAsgAEHQA2okACACDwsQgAcAC9EDAQF/IwBBEGsiCiQAIAkCfyAABEAgAhCRByEAAkAgAQRAIAogACAAKAIAKAIsEQIAIAMgCigCADYAACAKIAAgACgCACgCIBECAAwBCyAKIAAgACgCACgCKBECACADIAooAgA2AAAgCiAAIAAoAgAoAhwRAgALIAggChCSByAKENIIGiAEIAAgACgCACgCDBEAADoAACAFIAAgACgCACgCEBEAADoAACAKIAAgACgCACgCFBECACAGIAoQkgcgChDSCBogCiAAIAAoAgAoAhgRAgAgByAKEJIHIAoQ0ggaIAAgACgCACgCJBEAAAwBCyACEJMHIQACQCABBEAgCiAAIAAoAgAoAiwRAgAgAyAKKAIANgAAIAogACAAKAIAKAIgEQIADAELIAogACAAKAIAKAIoEQIAIAMgCigCADYAACAKIAAgACgCACgCHBECAAsgCCAKEJIHIAoQ0ggaIAQgACAAKAIAKAIMEQAAOgAAIAUgACAAKAIAKAIQEQAAOgAAIAogACAAKAIAKAIUEQIAIAYgChCSByAKENIIGiAKIAAgACgCACgCGBECACAH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AhCeByEAAkAgAQRAIAogACAAKAIAKAIsEQIAIAMgCigCADYAACAKIAAgACgCACgCIBECAAwBCyAKIAAgACgCACgCKBECACADIAooAgA2AAAgCiAAIAAoAgAoAhwRAgALIAggChCfByAKENIIGiAEIAAgACgCACgCDBEAADYCACAFIAAgACgCACgCEBEAADYCACAKIAAgACgCACgCFBECACAGIAoQkgcgChDSCBogCiAAIAAoAgAoAhgRAgAgByAKEJ8HIAoQ0ggaIAAgACgCACgCJBEAAAwBCyACEKAHIQACQCABBEAgCiAAIAAoAgAoAiwRAgAgAyAKKAIANgAAIAogACAAKAIAKAIgEQIADAELIAogACAAKAIAKAIoEQIAIAMgCigCADYAACAKIAAgACgCACgCHBECAAsgCCAKEJ8HIAoQ0ggaIAQgACAAKAIAKAIMEQAANgIAIAUgACAAKAIAKAIQEQAANgIAIAogACAAKAIAKAIUEQIAIAYgChCSByAKENIIGiAKIAAgACgCACgCGBECACAHIAoQnwcgChDSCBogACAAKAIAKAIkEQAACzYCACAKQRBqJAAL6AcBCn8jAEEQayIUJAAgAiAANgIAIANBgARxIRYCQANAAkAgFUEERgRAAn8gDSwAC0EASARAIA0oAgQMAQsgDS0ACwtBAUsEQCAUIA0QpwY2AgggAiAUQQhqQQEQogcgDRC7BiACKAIAEKsHNgIACyADQbABcSIDQRBGDQMgA0EgRw0BIAEgAigCADYCAAwDCwJAIAggFWosAAAiD0EESw0AAkACQAJAAkACQCAPQQFrDgQBAwIEAAsgASACKAIANgIADAQLIAEgAigCADYCACAGQSAgBigCACgCLBEDACEPIAIgAigCACIQQQRqNgIAIBAgDzYCAAwDCwJ/IA0sAAtBAEgEQCANKAIEDAELIA0tAAsLRQ0CAn8gDSwAC0EASARAIA0oAgAMAQsgDQsoAgAhDyACIAIoAgAiEEEEajYCACAQIA82AgAMAgsCfyAMLAALQQBIBEAgDCgCBAwBCyAMLQALC0UhDyAWRQ0BIA8NASACIAwQpwYgDBC7BiACKAIAEKsHNgIADAELIAIoAgAhFyAEQQRqIAQgBxsiBCERA0ACQCARIAVPDQAgBkGAECARKAIAIAYoAgAoAgwRBABFDQAgEUEEaiERDAELCyAOIg9BAU4EQANAAkAgD0EBSCIQDQAgESAETQ0AIBFBfGoiESgCACEQIAIgAigCACISQQRqNgIAIBIgEDYCACAPQX9qIQ8MAQsLIBAEf0EABSAGQTAgBigCACgCLBEDAAshEyACKAIAIRADQCAQQQRqIRIgD0EBTgRAIBAgEzYCACAPQX9qIQ8gEiEQDAELCyACIBI2AgAgECAJNgIACwJAIAQgEUYEQCAGQTAgBigCACgCLBEDACEPIAIgAigCACIQQQRqIhE2AgAgECAPNgIADAELAn9BfwJ/IAssAAtBAEgEQCALKAIEDAELIAstAAsLRQ0AGgJ/IAssAAtBAEgEQCALKAIADAELIAsLLAAACyETQQAhD0EAIRIDQCAEIBFHBEACQCAPIBNHBEAgDyEQDAELIAIgAigCACIQQQRqNgIAIBAgCjYCAEEAIRAgEkEBaiISAn8gCywAC0EASARAIAsoAgQMAQsgCy0ACwtPBEAgDyETDAELAn8gCywAC0EASARAIAsoAgAMAQsgCwsgEmotAABB/wBGBEBBfyETDAELAn8gCywAC0EASARAIAsoAgAMAQsgCwsgEmosAAAhEwsgEUF8aiIRKAIAIQ8gAiACKAIAIhhBBGo2AgAgGCAPNgIAIBBBAWohDwwBCwsgAigCACERCyAXIBEQvwYLIBVBAWohFQwBCwsgASAANgIACyAUQRBqJAALCwAgACABIAIQrgcL2AUBB38jAEHwA2siACQAIAAgAygCHCIGNgLoAyAGIAYoAgRBAWo2AgQgAEHoA2oQ6AQhCiACAn8CfyAFIgIsAAtBAEgEQCACKAIEDAELIAItAAsLBEACfyACLAALQQBIBEAgAigCAAwBCyACCygCACAKQS0gCigCACgCLBEDAEYhCwsgCwsgAEHoA2ogAEHgA2ogAEHcA2ogAEHYA2ogAEHIA2oQ6QUiDCAAQbgDahDpBSIJIABBqANqEOkFIgYgAEGkA2oQqQcgAEHiBDYCECAAQQhqQQAgAEEQahDkBSEHAn8CfyACLAALQQBIBEAgBSgCBAwBCyAFLQALCyAAKAKkA0oEQAJ/IAUsAAtBAEgEQCAFKAIEDAELIAUtAAsLIQIgACgCpAMhCAJ/IAYsAAtBAEgEQCAGKAIEDAELIAYtAAsLIAIgCGtBAXRqQQFqDAELAn8gBiwAC0EASARAIAYoAgQMAQsgBi0ACwtBAmoLIQggAEEQaiECAkAgACgCpAMCfyAJLAALQQBIBEAgCSgCBAwBCyAJLQALCyAIamoiCEHlAEkNACAIQQJ0EJ0JIQggBygCACECIAcgCDYCACACBEAgAiAHKAIEEQEACyAHKAIAIgINABCABwALIAIgAEEEaiAAIAMoAgQCfyAFLAALQQBIBEAgBSgCAAwBCyAFCwJ/IAUsAAtBAEgEQCAFKAIADAELIAULAn8gBSwAC0EASARAIAUoAgQMAQsgBS0ACwtBAnRqIAogCyAAQeADaiAAKALcAyAAKALYAyAMIAkgBiAAKAKkAxCqByABIAIgACgCBCAAKAIAIAMgBBC+BiECIAcoAgAhASAHQQA2AgAgAQRAIAEgBygCBBEBAAsgBhDSCBogCRDSCBogDBDSCBoCfyAAKALoAyIBIAEoAgRBf2oiAzYCBCADQX9GCwRAIAEgASgCACgCCBEBAAsgAEHwA2okACACC1sBAX8jAEEQayIDJAAgAyABNgIAIAMgADYCCANAIAMoAgggAygCAEZBAXMEQCACIAMoAggtAAA6AAAgAkEBaiECIAMgAygCCEEBajYCCAwBCwsgA0EQaiQAIAILWwEBfyMAQRBrIgMkACADIAE2AgAgAyAANgIIA0AgAygCCCADKAIARkEBcwRAIAIgAygCCCgCADYCACACQQRqIQIgAyADKAIIQQRqNgIIDAELCyADQRBqJAAgAgsoAEF/An8CfyABLAALQQBIBEAgASgCAAwBC0EACxpB/////wcLQQEbC+MBACMAQSBrIgEkAAJ/IAFBEGoQ6QUiAyEEIwBBEGsiAiQAIAIgBDYCCCACKAIIIQQgAkEQaiQAIAQLAn8gBSwAC0EASARAIAUoAgAMAQsgBQsCfyAFLAALQQBIBEAgBSgCAAwBCyAFCwJ/IAUsAAtBAEgEQCAFKAIEDAELIAUtAAsLahCxBwJ/IAMsAAtBAEgEQCADKAIADAELIAMLIQICfyAAEOkFIQQjAEEQayIAJAAgACAENgIIIAAoAgghBCAAQRBqJAAgBAsgAiACEJMEIAJqELEHIAMQ0ggaIAFBIGokAAs/AQF/IwBBEGsiAyQAIAMgADYCCANAIAEgAkkEQCADQQhqIAEQsgcgAUEBaiEBDAELCyADKAIIGiADQRBqJAALDwAgACgCACABLAAAENsIC9ICACMAQSBrIgEkACABQRBqEOkFIQQCfyABQQhqIgMiAkEANgIEIAJBtOUBNgIAIAJBjLsBNgIAIAJB4L4BNgIAIANB1L8BNgIAIAMLAn8jAEEQayICJAAgAiAENgIIIAIoAgghAyACQRBqJAAgAwsCfyAFLAALQQBIBEAgBSgCAAwBCyAFCwJ/IAUsAAtBAEgEQCAFKAIADAELIAULAn8gBSwAC0EASARAIAUoAgQMAQsgBS0ACwtBAnRqELQHAn8gBCwAC0EASARAIAQoAgAMAQsgBAshAiAAEOkFIQUCfyABQQhqIgMiAEEANgIEIABBtOUBNgIAIABBjLsBNgIAIABB4L4BNgIAIANBtMABNgIAIAMLAn8jAEEQayIAJAAgACAFNgIIIAAoAgghAyAAQRBqJAAgAwsgAiACEJMEIAJqELUHIAQQ0ggaIAFBIGokAAu2AQEDfyMAQUBqIgQkACAEIAE2AjggBEEwaiEFAkADQAJAIAZBAkYNACACIANPDQAgBCACNgIIIAAgBEEwaiACIAMgBEEIaiAEQRBqIAUgBEEMaiAAKAIAKAIMEQ4AIgZBAkYNAiAEQRBqIQEgBCgCCCACRg0CA0AgASAEKAIMTwRAIAQoAgghAgwDCyAEQThqIAEQsgcgAUEBaiEBDAAACwALCyAEKAI4GiAEQUBrJAAPCxCABwAL2wEBA38jAEGgAWsiBCQAIAQgATYCmAEgBEGQAWohBQJAA0ACQCAGQQJGDQAgAiADTw0AIAQgAjYCCCAAIARBkAFqIAIgAkEgaiADIAMgAmtBIEobIARBCGogBEEQaiAFIARBDGogACgCACgCEBEOACIGQQJGDQIgBEEQaiEBIAQoAgggAkYNAgNAIAEgBCgCDE8EQCAEKAIIIQIMAwsgBCABKAIANgIEIAQoApgBIARBBGooAgAQ4gggAUEEaiEBDAAACwALCyAEKAKYARogBEGgAWokAA8LEIAHAAshACAAQci3ATYCACAAKAIIEIYGRwRAIAAoAggQygULIAALzg0BAX9B5LgCQQA2AgBB4LgCQbTlATYCAEHguAJBjLsBNgIAQeC4AkGAtwE2AgAQuAcQuQdBHBC6B0GQugJB9bYBEP0EQfS4AigCAEHwuAIoAgBrQQJ1IQBB8LgCELsHQfC4AiAAELwHQaS2AkEANgIAQaC2AkG05QE2AgBBoLYCQYy7ATYCAEGgtgJBuMMBNgIAQaC2AkHsqgIQvQcQvgdBrLYCQQA2AgBBqLYCQbTlATYCAEGotgJBjLsBNgIAQai2AkHYwwE2AgBBqLYCQfSqAhC9BxC+BxC/B0GwtgJBuKwCEL0HEL4HQcS2AkEANgIAQcC2AkG05QE2AgBBwLYCQYy7ATYCAEHAtgJBxLsBNgIAQcC2AkGwrAIQvQcQvgdBzLYCQQA2AgBByLYCQbTlATYCAEHItgJBjLsBNgIAQci2AkHYvAE2AgBByLYCQcCsAhC9BxC+B0HUtgJBADYCAEHQtgJBtOUBNgIAQdC2AkGMuwE2AgBB0LYCQci3ATYCAEHYtgIQhgY2AgBB0LYCQcisAhC9BxC+B0HktgJBADYCAEHgtgJBtOUBNgIAQeC2AkGMuwE2AgBB4LYCQey9ATYCAEHgtgJB0KwCEL0HEL4HQey2AkEANgIAQei2AkG05QE2AgBB6LYCQYy7ATYCAEHotgJB4L4BNgIAQei2AkHYrAIQvQcQvgdB9LYCQQA2AgBB8LYCQbTlATYCAEHwtgJBjLsBNgIAQfi2AkGu2AA7AQBB8LYCQfi3ATYCAEH8tgIQ6QUaQfC2AkHgrAIQvQcQvgdBlLcCQQA2AgBBkLcCQbTlATYCAEGQtwJBjLsBNgIAQZi3AkKugICAwAU3AgBBkLcCQaC4ATYCAEGgtwIQ6QUaQZC3AkHorAIQvQcQvgdBtLcCQQA2AgBBsLcCQbTlATYCAEGwtwJBjLsBNgIAQbC3AkH4wwE2AgBBsLcCQfyqAhC9BxC+B0G8twJBADYCAEG4twJBtOUBNgIAQbi3AkGMuwE2AgBBuLcCQezFATYCAEG4twJBhKsCEL0HEL4HQcS3AkEANgIAQcC3AkG05QE2AgBBwLcCQYy7ATYCAEHAtwJBwMcBNgIAQcC3AkGMqwIQvQcQvgdBzLcCQQA2AgBByLcCQbTlATYCAEHItwJBjLsBNgIAQci3AkGoyQE2AgBByLcCQZSrAhC9BxC+B0HUtwJBADYCAEHQtwJBtOUBNgIAQdC3AkGMuwE2AgBB0LcCQYDRATYCAEHQtwJBvKsCEL0HEL4HQdy3AkEANgIAQdi3AkG05QE2AgBB2LcCQYy7ATYCAEHYtwJBlNIBNgIAQdi3AkHEqwIQvQcQvgdB5LcCQQA2AgBB4LcCQbTlATYCAEHgtwJBjLsBNgIAQeC3AkGI0wE2AgBB4LcCQcyrAhC9BxC+B0HstwJBADYCAEHotwJBtOUBNgIAQei3AkGMuwE2AgBB6LcCQfzTATYCAEHotwJB1KsCEL0HEL4HQfS3AkEANgIAQfC3AkG05QE2AgBB8LcCQYy7ATYCAEHwtwJB8NQBNgIAQfC3AkHcqwIQvQcQvgdB/LcCQQA2AgBB+LcCQbTlATYCAEH4twJBjLsBNgIAQfi3AkGU1gE2AgBB+LcCQeSrAhC9BxC+B0GEuAJBADYCAEGAuAJBtOUBNgIAQYC4AkGMuwE2AgBBgLgCQbjXATYCAEGAuAJB7KsCEL0HEL4HQYy4AkEANgIAQYi4AkG05QE2AgBBiLgCQYy7ATYCAEGIuAJB3NgBNgIAQYi4AkH0qwIQvQcQvgdBlLgCQQA2AgBBkLgCQbTlATYCAEGQuAJBjLsBNgIAQZi4AkHs5AE2AgBBkLgCQfDKATYCAEGYuAJBoMsBNgIAQZC4AkGcqwIQvQcQvgdBpLgCQQA2AgBBoLgCQbTlATYCAEGguAJBjLsBNgIAQai4AkGQ5QE2AgBBoLgCQfjMATYCAEGouAJBqM0BNgIAQaC4AkGkqwIQvQcQvgdBtLgCQQA2AgBBsLgCQbTlATYCAEGwuAJBjLsBNgIAQbi4AhC6CEGwuAJB5M4BNgIAQbC4AkGsqwIQvQcQvgdBxLgCQQA2AgBBwLgCQbTlATYCAEHAuAJBjLsBNgIAQci4AhC6CEHAuAJBgNABNgIAQcC4AkG0qwIQvQcQvgdB1LgCQQA2AgBB0LgCQbTlATYCAEHQuAJBjLsBNgIAQdC4AkGA2gE2AgBB0LgCQfyrAhC9BxC+B0HcuAJBADYCAEHYuAJBtOUBNgIAQdi4AkGMuwE2AgBB2LgCQfjaATYCAEHYuAJBhKwCEL0HEL4HCzYBAX8jAEEQayIAJABB8LgCQgA3AwAgAEEANgIMQYC5AkEANgIAQYC6AkEAOgAAIABBEGokAAs+AQF/ELMIQRxJBEAQ5AgAC0HwuAJBkLkCQRwQtAgiADYCAEH0uAIgADYCAEGAuQIgAEHwAGo2AgBBABC1CAs9AQF/IwBBEGsiASQAA0BB9LgCKAIAQQA2AgBB9LgCQfS4AigCAEEEajYCACAAQX9qIgANAAsgAUEQaiQACwwAIAAgACgCABC5CAs+ACAAKAIAGiAAKAIAIAAoAhAgACgCAGtBAnVBAnRqGiAAKAIAGiAAKAIAIAAoAgQgACgCAGtBAnVBAnRqGgtZAQJ/IwBBIGsiASQAIAFBADYCDCABQeQENgIIIAEgASkDCDcDACAAAn8gAUEQaiICIAEpAgA3AgQgAiAANgIAIAILEMoHIAAoAgQhACABQSBqJAAgAEF/aguPAgEDfyMAQRBrIgMkACAAIAAoAgRBAWo2AgQjAEEQayICJAAgAiAANgIMIANBCGoiACACKAIMNgIAIAJBEGokACAAIQJB9LgCKAIAQfC4AigCAGtBAnUgAU0EQCABQQFqEMEHC0HwuAIoAgAgAUECdGooAgAEQAJ/QfC4AigCACABQQJ0aigCACIAIAAoAgRBf2oiBDYCBCAEQX9GCwRAIAAgACgCACgCCBEBAAsLIAIoAgAhACACQQA2AgBB8LgCKAIAIAFBAnRqIAA2AgAgAigCACEAIAJBADYCACAABEACfyAAIAAoAgRBf2oiATYCBCABQX9GCwRAIAAgACgCACgCCBEBAAsLIANBEGokAAtMAEG0tgJBADYCAEGwtgJBtOUBNgIAQbC2AkGMuwE2AgBBvLYCQQA6AABBuLYCQQA2AgBBsLYCQZS3ATYCAEG4tgJBvJYBKAIANgIAC1sAAkBBnKwCLQAAQQFxDQBBnKwCLQAAQQBHQQFzRQ0AELcHQZSsAkHguAI2AgBBmKwCQZSsAjYCAEGcrAJBADYCAEGcrAJBnKwCKAIAQQFyNgIAC0GYrAIoAgALYAEBf0H0uAIoAgBB8LgCKAIAa0ECdSIBIABJBEAgACABaxDFBw8LIAEgAEsEQEH0uAIoAgBB8LgCKAIAa0ECdSEBQfC4AkHwuAIoAgAgAEECdGoQuQhB8LgCIAEQvAcLC7MBAQR/IABBgLcBNgIAIABBEGohAQNAIAIgASgCBCABKAIAa0ECdUkEQCABKAIAIAJBAnRqKAIABEACfyABKAIAIAJBAnRqKAIAIgMgAygCBEF/aiIENgIEIARBf0YLBEAgAyADKAIAKAIIEQEACwsgAkEBaiECDAELCyAAQbABahDSCBogARDDByABKAIABEAgARC7ByABQSBqIAEoAgAgASgCECABKAIAa0ECdRC4CAsgAAtQACAAKAIAGiAAKAIAIAAoAhAgACgCAGtBAnVBAnRqGiAAKAIAIAAoAgQgACgCAGtBAnVBAnRqGiAAKAIAIAAoAhAgACgCAGtBAnVBAnRqGgsKACAAEMIHEJ4JC6gBAQJ/IwBBIGsiAiQAAkBBgLkCKAIAQfS4AigCAGtBAnUgAE8EQCAAELoHDAELIAJBCGogAEH0uAIoAgBB8LgCKAIAa0ECdWoQuwhB9LgCKAIAQfC4AigCAGtBAnVBkLkCELwIIgEgABC9CCABEL4IIAEgASgCBBDBCCABKAIABEAgASgCECABKAIAIAFBDGooAgAgASgCAGtBAnUQuAgLCyACQSBqJAALawEBfwJAQaisAi0AAEEBcQ0AQaisAi0AAEEAR0EBc0UNAEGgrAIQwAcoAgAiADYCACAAIAAoAgRBAWo2AgRBpKwCQaCsAjYCAEGorAJBADYCAEGorAJBqKwCKAIAQQFyNgIAC0GkrAIoAgALHAAgABDGBygCACIANgIAIAAgACgCBEEBajYCBAszAQF/IABBEGoiACICKAIEIAIoAgBrQQJ1IAFLBH8gACgCACABQQJ0aigCAEEARwVBAAsLHwAgAAJ/QaysAkGsrAIoAgBBAWoiADYCACAACzYCBAs5AQJ/IwBBEGsiAiQAIAAoAgBBf0cEQCACQQhqIgMgATYCACACIAM2AgAgACACEMoICyACQRBqJAALFAAgAARAIAAgACgCACgCBBEBAAsLDQAgACgCACgCABDCCAskACACQf8ATQR/QbyWASgCACACQQF0ai8BACABcUEARwVBAAsLRgADQCABIAJHBEAgAyABKAIAQf8ATQR/QbyWASgCACABKAIAQQF0ai8BAAVBAAs7AQAgA0ECaiEDIAFBBGohAQwBCwsgAgtFAANAAkAgAiADRwR/IAIoAgBB/wBLDQFBvJYBKAIAIAIoAgBBAXRqLwEAIAFxRQ0BIAIFIAMLDwsgAkEEaiECDAAACwALRQACQANAIAIgA0YNAQJAIAIoAgBB/wBLDQBBvJYBKAIAIAIoAgBBAXRqLwEAIAFxRQ0AIAJBBGohAgwBCwsgAiEDCyADCx4AIAFB/wBNBH9BwJwBKAIAIAFBAnRqKAIABSABCwtBAANAIAEgAkcEQCABIAEoAgAiAEH/AE0Ef0HAnAEoAgAgASgCAEECdGooAgAFIAALNgIAIAFBBGohAQwBCwsgAgseACABQf8ATQR/QdCoASgCACABQQJ0aigCAAUgAQsLQQADQCABIAJHBEAgASABKAIAIgBB/wBNBH9B0KgBKAIAIAEoAgBBAnRqKAIABSAACzYCACABQQRqIQEMAQsLIAILBAAgAQsqAANAIAEgAkZFBEAgAyABLAAANgIAIANBBGohAyABQQFqIQEMAQsLIAILEwAgASACIAFBgAFJG0EYdEEYdQs1AANAIAEgAkZFBEAgBCABKAIAIgAgAyAAQYABSRs6AAAgBEEBaiEEIAFBBGohAQwBCwsgAgspAQF/IABBlLcBNgIAAkAgACgCCCIBRQ0AIAAtAAxFDQAgARCeCQsgAAsKACAAENkHEJ4JCycAIAFBAE4Ef0HAnAEoAgAgAUH/AXFBAnRqKAIABSABC0EYdEEYdQtAAANAIAEgAkcEQCABIAEsAAAiAEEATgR/QcCcASgCACABLAAAQQJ0aigCAAUgAAs6AAAgAUEBaiEBDAELCyACCycAIAFBAE4Ef0HQqAEoAgAgAUH/AXFBAnRqKAIABSABC0EYdEEYdQtAAANAIAEgAkcEQCABIAEsAAAiAEEATgR/QdCoASgCACABLAAAQQJ0aigCAAUgAAs6AAAgAUEBaiEBDAELCyACCyoAA0AgASACRkUEQCADIAEtAAA6AAAgA0EBaiEDIAFBAWohAQwBCwsgAgsMACABIAIgAUF/ShsLNAADQCABIAJGRQRAIAQgASwAACIAIAMgAEF/Shs6AAAgBEEBaiEEIAFBAWohAQwBCwsgAgsSACAEIAI2AgAgByAFNgIAQQMLCwAgBCACNgIAQQMLWAAjAEEQayIAJAAgACAENgIMIAAgAyACazYCCCMAQRBrIgEkACAAQQhqIgIoAgAgAEEMaiIDKAIASSEEIAFBEGokACACIAMgBBsoAgAhASAAQRBqJAAgAQsKACAAELYHEJ4JC94DAQV/IwBBEGsiCSQAIAIhCANAAkAgAyAIRgRAIAMhCAwBCyAIKAIARQ0AIAhBBGohCAwBCwsgByAFNgIAIAQgAjYCAEEBIQoDQAJAAkACQCAFIAZGDQAgAiADRg0AIAkgASkCADcDCAJAAkACQCAFIAQgCCACa0ECdSAGIAVrIAAoAggQ5wciC0EBaiIMQQFNBEAgDEEBa0UNBSAHIAU2AgADQAJAIAIgBCgCAEYNACAFIAIoAgAgACgCCBDoByIBQX9GDQAgByAHKAIAIAFqIgU2AgAgAkEEaiECDAELCyAEIAI2AgAMAQsgByAHKAIAIAtqIgU2AgAgBSAGRg0CIAMgCEYEQCAEKAIAIQIgAyEIDAcLIAlBBGpBACAAKAIIEOgHIghBf0cNAQtBAiEKDAMLIAlBBGohBSAIIAYgBygCAGtLBEAMAwsDQCAIBEAgBS0AACECIAcgBygCACILQQFqNgIAIAsgAjoAACAIQX9qIQggBUEBaiEFDAELCyAEIAQoAgBBBGoiAjYCACACIQgDQCADIAhGBEAgAyEIDAULIAgoAgBFDQQgCEEEaiEIDAAACwALIAQoAgAhAgsgAiADRyEKCyAJQRBqJAAgCg8LIAcoAgAhBQwAAAsAC2MBAX8jAEEQayIFJAAgBSAENgIMIAVBCGogBUEMahCKBiEEIAAgASACIAMQzQUhASAEKAIAIgAEQEHYhgIoAgAaIAAEQEHYhgJBjJICIAAgAEF/Rhs2AgALCyAFQRBqJAAgAQtfAQF/IwBBEGsiAyQAIAMgAjYCDCADQQhqIANBDGoQigYhAiAAIAEQ9AMhASACKAIAIgAEQEHYhgIoAgAaIAAEQEHYhgJBjJICIAAgAEF/Rhs2AgALCyADQRBqJAAgAQvAAwEDfyMAQRBrIgkkACACIQgDQAJAIAMgCEYEQCADIQgMAQsgCC0AAEUNACAIQQFqIQgMAQsLIAcgBTYCACAEIAI2AgADQAJAAn8CQCAFIAZGDQAgAiADRg0AIAkgASkCADcDCAJAAkACQAJAIAUgBCAIIAJrIAYgBWtBAnUgASAAKAIIEOoHIgpBf0YEQANAAkAgByAFNgIAIAIgBCgCAEYNAAJAIAUgAiAIIAJrIAlBCGogACgCCBDrByIFQQJqIgFBAksNAEEBIQUCQCABQQFrDgIAAQcLIAQgAjYCAAwECyACIAVqIQIgBygCAEEEaiEFDAELCyAEIAI2AgAMBQsgByAHKAIAIApBAnRqIgU2AgAgBSAGRg0DIAQoAgAhAiADIAhGBEAgAyEIDAgLIAUgAkEBIAEgACgCCBDrB0UNAQtBAgwECyAHIAcoAgBBBGo2AgAgBCAEKAIAQQFqIgI2AgAgAiEIA0AgAyAIRgRAIAMhCAwGCyAILQAARQ0FIAhBAWohCAwAAAsACyAEIAI2AgBBAQwCCyAEKAIAIQILIAIgA0cLIQggCUEQaiQAIAgPCyAHKAIAIQUMAAALAAtlAQF/IwBBEGsiBiQAIAYgBTYCDCAGQQhqIAZBDGoQigYhBSAAIAEgAiADIAQQzwUhASAFKAIAIgAEQEHYhgIoAgAaIAAEQEHYhgJBjJICIAAgAEF/Rhs2AgALCyAGQRBqJAAgAQtjAQF/IwBBEGsiBSQAIAUgBDYCDCAFQQhqIAVBDGoQigYhBCAAIAEgAiADEKgFIQEgBCgCACIABEBB2IYCKAIAGiAABEBB2IYCQYySAiAAIABBf0YbNgIACwsgBUEQaiQAIAELlAEBAX8jAEEQayIFJAAgBCACNgIAQQIhAgJAIAVBDGpBACAAKAIIEOgHIgBBAWpBAkkNAEEBIQIgAEF/aiIBIAMgBCgCAGtLDQAgBUEMaiECA38gAQR/IAItAAAhACAEIAQoAgAiA0EBajYCACADIAA6AAAgAUF/aiEBIAJBAWohAgwBBUEACwshAgsgBUEQaiQAIAILLQEBf0F/IQECQCAAKAIIEO4HBH9BfwUgACgCCCIADQFBAQsPCyAAEO8HQQFGC2YBAn8jAEEQayIBJAAgASAANgIMIAFBCGogAUEMahCKBiEAIwBBEGsiAiQAIAJBEGokACAAKAIAIgAEQEHYhgIoAgAaIAAEQEHYhgJBjJICIAAgAEF/Rhs2AgALCyABQRBqJABBAAtnAQJ/IwBBEGsiASQAIAEgADYCDCABQQhqIAFBDGoQigYhAEEEQQFB2IYCKAIAKAIAGyECIAAoAgAiAARAQdiGAigCABogAARAQdiGAkGMkgIgACAAQX9GGzYCAAsLIAFBEGokACACC1oBBH8DQAJAIAIgA0YNACAGIARPDQAgAiADIAJrIAEgACgCCBDxByIHQQJqIghBAk0EQEEBIQcgCEECaw0BCyAGQQFqIQYgBSAHaiEFIAIgB2ohAgwBCwsgBQtqAQF/IwBBEGsiBCQAIAQgAzYCDCAEQQhqIARBDGoQigYhA0EAIAAgASACQeiqAiACGxCoBSEBIAMoAgAiAARAQdiGAigCABogAARAQdiGAkGMkgIgACAAQX9GGzYCAAsLIARBEGokACABCxUAIAAoAggiAEUEQEEBDwsgABDvBwtNACMAQRBrIgAkACAAIAI2AgwgACAFNgIIIAIgAyAAQQxqIAUgBiAAQQhqEPQHIQEgBCAAKAIMNgIAIAcgACgCCDYCACAAQRBqJAAgAQu/BQECfyACIAA2AgAgBSADNgIAIAIoAgAhBgJAAkADQCAGIAFPBEBBACEADAMLQQIhACAGLwEAIgNB///DAEsNAgJAAkAgA0H/AE0EQEEBIQAgBCAFKAIAIgZrQQFIDQUgBSAGQQFqNgIAIAYgAzoAAAwBCyADQf8PTQRAIAQgBSgCACIAa0ECSA0EIAUgAEEBajYCACAAIANBBnZBwAFyOgAAIAUgBSgCACIAQQFqNgIAIAAgA0E/cUGAAXI6AAAMAQsgA0H/rwNNBEAgBCAFKAIAIgBrQQNIDQQgBSAAQQFqNgIAIAAgA0EMdkHgAXI6AAAgBSAFKAIAIgBBAWo2AgAgACADQQZ2QT9xQYABcjoAACAFIAUoAgAiAEEBajYCACAAIANBP3FBgAFyOgAADAELIANB/7cDTQRAQQEhACABIAZrQQRIDQUgBi8BAiIHQYD4A3FBgLgDRw0CIAQgBSgCAGtBBEgNBSAHQf8HcSADQQp0QYD4A3EgA0HAB3EiAEEKdHJyQYCABGpB///DAEsNAiACIAZBAmo2AgAgBSAFKAIAIgZBAWo2AgAgBiAAQQZ2QQFqIgBBAnZB8AFyOgAAIAUgBSgCACIGQQFqNgIAIAYgAEEEdEEwcSADQQJ2QQ9xckGAAXI6AAAgBSAFKAIAIgBBAWo2AgAgACAHQQZ2QQ9xIANBBHRBMHFyQYABcjoAACAFIAUoAgAiAEEBajYCACAAIAdBP3FBgAFyOgAADAELIANBgMADSQ0EIAQgBSgCACIAa0EDSA0DIAUgAEEBajYCACAAIANBDHZB4AFyOgAAIAUgBSgCACIAQQFqNgIAIAAgA0EGdkE/cUGAAXI6AAAgBSAFKAIAIgBBAWo2AgAgACADQT9xQYABcjoAAAsgAiACKAIAQQJqIgY2AgAMAQsLQQIPC0EBDwsgAAtNACMAQRBrIgAkACAAIAI2AgwgACAFNgIIIAIgAyAAQQxqIAUgBiAAQQhqEPYHIQEgBCAAKAIMNgIAIAcgACgCCDYCACAAQRBqJAAgAQufBQEFfyACIAA2AgAgBSADNgIAAkADQCACKAIAIgAgAU8EQEEAIQkMAgtBASEJIAUoAgAiByAETw0BAkAgAC0AACIDQf//wwBLDQAgAgJ/IANBGHRBGHVBAE4EQCAHIAM7AQAgAEEBagwBCyADQcIBSQ0BIANB3wFNBEAgASAAa0ECSA0EIAAtAAEiBkHAAXFBgAFHDQJBAiEJIAZBP3EgA0EGdEHAD3FyIgNB///DAEsNBCAHIAM7AQAgAEECagwBCyADQe8BTQRAIAEgAGtBA0gNBCAALQACIQggAC0AASEGAkACQCADQe0BRwRAIANB4AFHDQEgBkHgAXFBoAFHDQUMAgsgBkHgAXFBgAFHDQQMAQsgBkHAAXFBgAFHDQMLIAhBwAFxQYABRw0CQQIhCSAIQT9xIAZBP3FBBnQgA0EMdHJyIgNB//8DcUH//8MASw0EIAcgAzsBACAAQQNqDAELIANB9AFLDQEgASAAa0EESA0DIAAtAAMhCCAALQACIQYgAC0AASEAAkACQCADQZB+aiIKQQRLDQACQAJAIApBAWsOBAICAgEACyAAQfAAakH/AXFBME8NBAwCCyAAQfABcUGAAUcNAwwBCyAAQcABcUGAAUcNAgsgBkHAAXFBgAFHDQEgCEHAAXFBgAFHDQEgBCAHa0EESA0DQQIhCSAIQT9xIgggBkEGdCIKQcAfcSAAQQx0QYDgD3EgA0EHcSIDQRJ0cnJyQf//wwBLDQMgByAAQQJ0IgBBwAFxIANBCHRyIAZBBHZBA3EgAEE8cXJyQcD/AGpBgLADcjsBACAFIAdBAmo2AgAgByAKQcAHcSAIckGAuANyOwECIAIoAgBBBGoLNgIAIAUgBSgCAEECajYCAAwBCwtBAg8LIAkLCwAgAiADIAQQ+AcLgAQBB38gACEDA0ACQCAGIAJPDQAgAyABTw0AIAMtAAAiBEH//8MASw0AAn8gA0EBaiAEQRh0QRh1QQBODQAaIARBwgFJDQEgBEHfAU0EQCABIANrQQJIDQIgAy0AASIFQcABcUGAAUcNAiAFQT9xIARBBnRBwA9xckH//8MASw0CIANBAmoMAQsCQAJAIARB7wFNBEAgASADa0EDSA0EIAMtAAIhByADLQABIQUgBEHtAUYNASAEQeABRgRAIAVB4AFxQaABRg0DDAULIAVBwAFxQYABRw0EDAILIARB9AFLDQMgAiAGa0ECSQ0DIAEgA2tBBEgNAyADLQADIQcgAy0AAiEIIAMtAAEhBQJAAkAgBEGQfmoiCUEESw0AAkACQCAJQQFrDgQCAgIBAAsgBUHwAGpB/wFxQTBJDQIMBgsgBUHwAXFBgAFGDQEMBQsgBUHAAXFBgAFHDQQLIAhBwAFxQYABRw0DIAdBwAFxQYABRw0DIAdBP3EgCEEGdEHAH3EgBEESdEGAgPAAcSAFQT9xQQx0cnJyQf//wwBLDQMgBkEBaiEGIANBBGoMAgsgBUHgAXFBgAFHDQILIAdBwAFxQYABRw0BIAdBP3EgBEEMdEGA4ANxIAVBP3FBBnRyckH//8MASw0BIANBA2oLIQMgBkEBaiEGDAELCyADIABrCwQAQQQLTQAjAEEQayIAJAAgACACNgIMIAAgBTYCCCACIAMgAEEMaiAFIAYgAEEIahD7ByEBIAQgACgCDDYCACAHIAAoAgg2AgAgAEEQaiQAIAEL1wMBAX8gAiAANgIAIAUgAzYCACACKAIAIQMCQANAIAMgAU8EQEEAIQYMAgtBAiEGIAMoAgAiAEH//8MASw0BIABBgHBxQYCwA0YNAQJAAkAgAEH/AE0EQEEBIQYgBCAFKAIAIgNrQQFIDQQgBSADQQFqNgIAIAMgADoAAAwBCyAAQf8PTQRAIAQgBSgCACIDa0ECSA0CIAUgA0EBajYCACADIABBBnZBwAFyOgAAIAUgBSgCACIDQQFqNgIAIAMgAEE/cUGAAXI6AAAMAQsgBCAFKAIAIgNrIQYgAEH//wNNBEAgBkEDSA0CIAUgA0EBajYCACADIABBDHZB4AFyOgAAIAUgBSgCACIDQQFqNgIAIAMgAEEGdkE/cUGAAXI6AAAgBSAFKAIAIgNBAWo2AgAgAyAAQT9xQYABcjoAAAwBCyAGQQRIDQEgBSADQQFqNgIAIAMgAEESdkHwAXI6AAAgBSAFKAIAIgNBAWo2AgAgAyAAQQx2QT9xQYABcjoAACAFIAUoAgAiA0EBajYCACADIABBBnZBP3FBgAFyOgAAIAUgBSgCACIDQQFqNgIAIAMgAEE/cUGAAXI6AAALIAIgAigCAEEEaiIDNgIADAELC0EBDwsgBgtNACMAQRBrIgAkACAAIAI2AgwgACAFNgIIIAIgAyAAQQxqIAUgBiAAQQhqEP0HIQEgBCAAKAIMNgIAIAcgACgCCDYCACAAQRBqJAAgAQu6BAEGfyACIAA2AgAgBSADNgIAA0AgAigCACIGIAFPBEBBAA8LQQEhCQJAAkACQCAFKAIAIgsgBE8NACAGLAAAIgBB/wFxIQMgAEEATgRAIANB///DAEsNA0EBIQAMAgsgA0HCAUkNAiADQd8BTQRAIAEgBmtBAkgNAUECIQkgBi0AASIHQcABcUGAAUcNAUECIQAgB0E/cSADQQZ0QcAPcXIiA0H//8MATQ0CDAELAkAgA0HvAU0EQCABIAZrQQNIDQIgBi0AAiEIIAYtAAEhBwJAAkAgA0HtAUcEQCADQeABRw0BIAdB4AFxQaABRg0CDAcLIAdB4AFxQYABRg0BDAYLIAdBwAFxQYABRw0FCyAIQcABcUGAAUYNAQwECyADQfQBSw0DIAEgBmtBBEgNASAGLQADIQggBi0AAiEKIAYtAAEhBwJAAkAgA0GQfmoiAEEESw0AAkACQCAAQQFrDgQCAgIBAAsgB0HwAGpB/wFxQTBPDQYMAgsgB0HwAXFBgAFHDQUMAQsgB0HAAXFBgAFHDQQLIApBwAFxQYABRw0DIAhBwAFxQYABRw0DQQQhAEECIQkgCEE/cSAKQQZ0QcAfcSADQRJ0QYCA8ABxIAdBP3FBDHRycnIiA0H//8MASw0BDAILQQMhAEECIQkgCEE/cSADQQx0QYDgA3EgB0E/cUEGdHJyIgNB///DAE0NAQsgCQ8LIAsgAzYCACACIAAgBmo2AgAgBSAFKAIAQQRqNgIADAELC0ECCwsAIAIgAyAEEP8HC/MDAQd/IAAhAwNAAkAgByACTw0AIAMgAU8NACADLAAAIgRB/wFxIQUCfyAEQQBOBEAgBUH//8MASw0CIANBAWoMAQsgBUHCAUkNASAFQd8BTQRAIAEgA2tBAkgNAiADLQABIgRBwAFxQYABRw0CIARBP3EgBUEGdEHAD3FyQf//wwBLDQIgA0ECagwBCwJAAkAgBUHvAU0EQCABIANrQQNIDQQgAy0AAiEGIAMtAAEhBCAFQe0BRg0BIAVB4AFGBEAgBEHgAXFBoAFGDQMMBQsgBEHAAXFBgAFHDQQMAgsgBUH0AUsNAyABIANrQQRIDQMgAy0AAyEGIAMtAAIhCCADLQABIQQCQAJAIAVBkH5qIglBBEsNAAJAAkAgCUEBaw4EAgICAQALIARB8ABqQf8BcUEwSQ0CDAYLIARB8AFxQYABRg0BDAULIARBwAFxQYABRw0ECyAIQcABcUGAAUcNAyAGQcABcUGAAUcNAyAGQT9xIAhBBnRBwB9xIAVBEnRBgIDwAHEgBEE/cUEMdHJyckH//8MASw0DIANBBGoMAgsgBEHgAXFBgAFHDQILIAZBwAFxQYABRw0BIAZBP3EgBUEMdEGA4ANxIARBP3FBBnRyckH//8MASw0BIANBA2oLIQMgB0EBaiEHDAELCyADIABrCxYAIABB+LcBNgIAIABBDGoQ0ggaIAALCgAgABCACBCeCQsWACAAQaC4ATYCACAAQRBqENIIGiAACwoAIAAQgggQngkLBwAgACwACAsHACAALAAJCwwAIAAgAUEMahDQCAsMACAAIAFBEGoQ0AgLCwAgAEHAuAEQ/QQLCwAgAEHIuAEQiggLHAAgAEIANwIAIABBADYCCCAAIAEgARDLBRDdCAsLACAAQdy4ARD9BAsLACAAQeS4ARCKCAsOACAAIAEgARCTBBDTCAtQAAJAQfSsAi0AAEEBcQ0AQfSsAi0AAEEAR0EBc0UNABCPCEHwrAJBoK4CNgIAQfSsAkEANgIAQfSsAkH0rAIoAgBBAXI2AgALQfCsAigCAAvxAQEBfwJAQcivAi0AAEEBcQ0AQcivAi0AAEEAR0EBc0UNAEGgrgIhAANAIAAQ6QVBDGoiAEHIrwJHDQALQcivAkEANgIAQcivAkHIrwIoAgBBAXI2AgALQaCuAkHI2wEQjQhBrK4CQc/bARCNCEG4rgJB1tsBEI0IQcSuAkHe2wEQjQhB0K4CQejbARCNCEHcrgJB8dsBEI0IQeiuAkH42wEQjQhB9K4CQYHcARCNCEGArwJBhdwBEI0IQYyvAkGJ3AEQjQhBmK8CQY3cARCNCEGkrwJBkdwBEI0IQbCvAkGV3AEQjQhBvK8CQZncARCNCAscAEHIrwIhAANAIABBdGoQ0ggiAEGgrgJHDQALC1AAAkBB/KwCLQAAQQFxDQBB/KwCLQAAQQBHQQFzRQ0AEJIIQfisAkHQrwI2AgBB/KwCQQA2AgBB/KwCQfysAigCAEEBcjYCAAtB+KwCKAIAC/EBAQF/AkBB+LACLQAAQQFxDQBB+LACLQAAQQBHQQFzRQ0AQdCvAiEAA0AgABDpBUEMaiIAQfiwAkcNAAtB+LACQQA2AgBB+LACQfiwAigCAEEBcjYCAAtB0K8CQaDcARCUCEHcrwJBvNwBEJQIQeivAkHY3AEQlAhB9K8CQfjcARCUCEGAsAJBoN0BEJQIQYywAkHE3QEQlAhBmLACQeDdARCUCEGksAJBhN4BEJQIQbCwAkGU3gEQlAhBvLACQaTeARCUCEHIsAJBtN4BEJQIQdSwAkHE3gEQlAhB4LACQdTeARCUCEHssAJB5N4BEJQICxwAQfiwAiEAA0AgAEF0ahDSCCIAQdCvAkcNAAsLDgAgACABIAEQywUQ3ggLUAACQEGErQItAABBAXENAEGErQItAABBAEdBAXNFDQAQlghBgK0CQYCxAjYCAEGErQJBADYCAEGErQJBhK0CKAIAQQFyNgIAC0GArQIoAgAL3wIBAX8CQEGgswItAABBAXENAEGgswItAABBAEdBAXNFDQBBgLECIQADQCAAEOkFQQxqIgBBoLMCRw0AC0GgswJBADYCAEGgswJBoLMCKAIAQQFyNgIAC0GAsQJB9N4BEI0IQYyxAkH83gEQjQhBmLECQYXfARCNCEGksQJBi98BEI0IQbCxAkGR3wEQjQhBvLECQZXfARCNCEHIsQJBmt8BEI0IQdSxAkGf3wEQjQhB4LECQabfARCNCEHssQJBsN8BEI0IQfixAkG43wEQjQhBhLICQcHfARCNCEGQsgJByt8BEI0IQZyyAkHO3wEQjQhBqLICQdLfARCNCEG0sgJB1t8BEI0IQcCyAkGR3wEQjQhBzLICQdrfARCNCEHYsgJB3t8BEI0IQeSyAkHi3wEQjQhB8LICQebfARCNCEH8sgJB6t8BEI0IQYizAkHu3wEQjQhBlLMCQfLfARCNCAscAEGgswIhAANAIABBdGoQ0ggiAEGAsQJHDQALC1AAAkBBjK0CLQAAQQFxDQBBjK0CLQAAQQBHQQFzRQ0AEJkIQYitAkGwswI2AgBBjK0CQQA2AgBBjK0CQYytAigCAEEBcjYCAAtBiK0CKAIAC98CAQF/AkBB0LUCLQAAQQFxDQBB0LUCLQAAQQBHQQFzRQ0AQbCzAiEAA0AgABDpBUEMaiIAQdC1AkcNAAtB0LUCQQA2AgBB0LUCQdC1AigCAEEBcjYCAAtBsLMCQfjfARCUCEG8swJBmOABEJQIQcizAkG84AEQlAhB1LMCQdTgARCUCEHgswJB7OABEJQIQeyzAkH84AEQlAhB+LMCQZDhARCUCEGEtAJBpOEBEJQIQZC0AkHA4QEQlAhBnLQCQejhARCUCEGotAJBiOIBEJQIQbS0AkGs4gEQlAhBwLQCQdDiARCUCEHMtAJB4OIBEJQIQdi0AkHw4gEQlAhB5LQCQYDjARCUCEHwtAJB7OABEJQIQfy0AkGQ4wEQlAhBiLUCQaDjARCUCEGUtQJBsOMBEJQIQaC1AkHA4wEQlAhBrLUCQdDjARCUCEG4tQJB4OMBEJQIQcS1AkHw4wEQlAgLHABB0LUCIQADQCAAQXRqENIIIgBBsLMCRw0ACwtQAAJAQZStAi0AAEEBcQ0AQZStAi0AAEEAR0EBc0UNABCcCEGQrQJB4LUCNgIAQZStAkEANgIAQZStAkGUrQIoAgBBAXI2AgALQZCtAigCAAttAQF/AkBB+LUCLQAAQQFxDQBB+LUCLQAAQQBHQQFzRQ0AQeC1AiEAA0AgABDpBUEMaiIAQfi1AkcNAAtB+LUCQQA2AgBB+LUCQfi1AigCAEEBcjYCAAtB4LUCQYDkARCNCEHstQJBg+QBEI0ICxwAQfi1AiEAA0AgAEF0ahDSCCIAQeC1AkcNAAsLUAACQEGcrQItAABBAXENAEGcrQItAABBAEdBAXNFDQAQnwhBmK0CQYC2AjYCAEGcrQJBADYCAEGcrQJBnK0CKAIAQQFyNgIAC0GYrQIoAgALbQEBfwJAQZi2Ai0AAEEBcQ0AQZi2Ai0AAEEAR0EBc0UNAEGAtgIhAANAIAAQ6QVBDGoiAEGYtgJHDQALQZi2AkEANgIAQZi2AkGYtgIoAgBBAXI2AgALQYC2AkGI5AEQlAhBjLYCQZTkARCUCAscAEGYtgIhAANAIABBdGoQ0ggiAEGAtgJHDQALC0oAAkBBrK0CLQAAQQFxDQBBrK0CLQAAQQBHQQFzRQ0AQaCtAkH8uAEQ/QRBrK0CQQA2AgBBrK0CQaytAigCAEEBcjYCAAtBoK0CCwoAQaCtAhDSCBoLSgACQEG8rQItAABBAXENAEG8rQItAABBAEdBAXNFDQBBsK0CQYi5ARCKCEG8rQJBADYCAEG8rQJBvK0CKAIAQQFyNgIAC0GwrQILCgBBsK0CENIIGgtKAAJAQcytAi0AAEEBcQ0AQcytAi0AAEEAR0EBc0UNAEHArQJBrLkBEP0EQcytAkEANgIAQcytAkHMrQIoAgBBAXI2AgALQcCtAgsKAEHArQIQ0ggaC0oAAkBB3K0CLQAAQQFxDQBB3K0CLQAAQQBHQQFzRQ0AQdCtAkG4uQEQighB3K0CQQA2AgBB3K0CQdytAigCAEEBcjYCAAtB0K0CCwoAQdCtAhDSCBoLSgACQEHsrQItAABBAXENAEHsrQItAABBAEdBAXNFDQBB4K0CQdy5ARD9BEHsrQJBADYCAEHsrQJB7K0CKAIAQQFyNgIAC0HgrQILCgBB4K0CENIIGgtKAAJAQfytAi0AAEEBcQ0AQfytAi0AAEEAR0EBc0UNAEHwrQJB9LkBEIoIQfytAkEANgIAQfytAkH8rQIoAgBBAXI2AgALQfCtAgsKAEHwrQIQ0ggaC0oAAkBBjK4CLQAAQQFxDQBBjK4CLQAAQQBHQQFzRQ0AQYCuAkHIugEQ/QRBjK4CQQA2AgBBjK4CQYyuAigCAEEBcjYCAAtBgK4CCwoAQYCuAhDSCBoLSgACQEGcrgItAABBAXENAEGcrgItAABBAEdBAXNFDQBBkK4CQdS6ARCKCEGcrgJBADYCAEGcrgJBnK4CKAIAQQFyNgIAC0GQrgILCgBBkK4CENIIGgsKACAAELIIEJ4JCxgAIAAoAggQhgZHBEAgACgCCBDKBQsgAAtfAQV/IwBBEGsiACQAIABB/////wM2AgwgAEH/////BzYCCCMAQRBrIgEkACAAQQhqIgIoAgAgAEEMaiIDKAIASSEEIAFBEGokACACIAMgBBsoAgAhASAAQRBqJAAgAQsJACAAIAEQtggLTgBB8LgCKAIAGkHwuAIoAgBBgLkCKAIAQfC4AigCAGtBAnVBAnRqGkHwuAIoAgBBgLkCKAIAQfC4AigCAGtBAnVBAnRqGkHwuAIoAgAaCyUAAkAgAUEcSw0AIAAtAHANACAAQQE6AHAgAA8LIAFBAnQQywgLFwBBfyAASQRAQaDkARDNAgALIAAQywgLGwACQCAAIAFGBEAgAEEAOgBwDAELIAEQngkLCyYBAX8gACgCBCECA0AgASACRwRAIAJBfGohAgwBCwsgACABNgIECwoAIAAQhgY2AgALhwEBBH8jAEEQayICJAAgAiAANgIMELMIIgEgAE8EQEGAuQIoAgBB8LgCKAIAa0ECdSIAIAFBAXZJBEAgAiAAQQF0NgIIIwBBEGsiACQAIAJBCGoiASgCACACQQxqIgMoAgBJIQQgAEEQaiQAIAMgASAEGygCACEBCyACQRBqJAAgAQ8LEOQIAAtuAQN/IwBBEGsiBSQAIAVBADYCDCAAQQxqIgZBADYCACAGIAM2AgQgAQRAIAAoAhAgARC0CCEECyAAIAQ2AgAgACAEIAJBAnRqIgI2AgggACACNgIEIABBDGogBCABQQJ0ajYCACAFQRBqJAAgAAszAQF/IAAoAhAaIAAoAgghAgNAIAJBADYCACAAIAAoAghBBGoiAjYCCCABQX9qIgENAAsLZwEBf0HwuAIQwwdBkLkCQfC4AigCAEH0uAIoAgAgAEEEaiIBEL8IQfC4AiABEIAFQfS4AiAAQQhqEIAFQYC5AiAAQQxqEIAFIAAgACgCBDYCAEH0uAIoAgBB8LgCKAIAa0ECdRC1CAsoACADIAMoAgAgAiABayIAayICNgIAIABBAU4EQCACIAEgABCpCRoLCwcAIAAoAgQLJQADQCABIAAoAghHBEAgACgCEBogACAAKAIIQXxqNgIIDAELCws4AQJ/IAAoAgAgACgCCCICQQF1aiEBIAAoAgQhACABIAJBAXEEfyABKAIAIABqKAIABSAACxEBAAseAEH/////AyAASQRAQaDkARDNAgALIABBAnQQywgLUAEBfyAAEI8HIAAsAAtBAEgEQCAAKAIAIQEgACwAC0EASAR/IAAoAghB/////wdxQX9qBUEKCxogARCeCSAAQYCAgIB4NgIIIABBADoACwsLUAEBfyAAEJwHIAAsAAtBAEgEQCAAKAIAIQEgACwAC0EASAR/IAAoAghB/////wdxQX9qBUEBCxogARCeCSAAQYCAgIB4NgIIIABBADoACwsLOgIBfwF+IwBBEGsiAyQAIAMgASACEIYGENcFIAMpAwAhBCAAIAMpAwg3AwggACAENwMAIANBEGokAAsDAAALRwEBfyAAQQhqIgEoAgBFBEAgACAAKAIAKAIQEQEADwsCfyABIAEoAgBBf2oiATYCACABQX9GCwRAIAAgACgCACgCEBEBAAsLBABBAAsuAANAIAAoAgBBAUYNAAsgACgCAEUEQCAAQQE2AgAgAUHlBBEBACAAQX82AgALCzEBAn8gAEEBIAAbIQADQAJAIAAQnQkiAQ0AQey6AigCACICRQ0AIAIRBwAMAQsLIAELOgECfyABEJMEIgJBDWoQywgiA0EANgIIIAMgAjYCBCADIAI2AgAgACADQQxqIAEgAkEBahCpCTYCAAspAQF/IAIEQCAAIQMDQCADIAE2AgAgA0EEaiEDIAJBf2oiAg0ACwsgAAtpAQF/AkAgACABa0ECdSACSQRAA0AgACACQX9qIgJBAnQiA2ogASADaigCADYCACACDQAMAgALAAsgAkUNACAAIQMDQCADIAEoAgA2AgAgA0EEaiEDIAFBBGohASACQX9qIgINAAsLIAALCgBBnOYBEM0CAAtZAQJ/IwBBEGsiAyQAIABCADcCACAAQQA2AgggACECAkAgASwAC0EATgRAIAIgASgCCDYCCCACIAEpAgA3AgAMAQsgACABKAIAIAEoAgQQ0QgLIANBEGokAAucAQEDfyMAQRBrIgQkAEFvIAJPBEACQCACQQpNBEAgACACOgALIAAhAwwBCyAAIAJBC08EfyACQRBqQXBxIgMgA0F/aiIDIANBC0YbBUEKC0EBaiIFELcIIgM2AgAgACAFQYCAgIB4cjYCCCAAIAI2AgQLIAMgASACEMkEIARBADoADyACIANqIAQtAA86AAAgBEEQaiQADwsQzwgACx0AIAAsAAtBAEgEQCAAKAIIGiAAKAIAEJ4JCyAAC8kBAQN/IwBBEGsiBCQAAkAgACwAC0EASAR/IAAoAghB/////wdxQX9qBUEKCyIDIAJPBEACfyAALAALQQBIBEAgACgCAAwBCyAACyIDIQUgAgRAIAUgASACEKsJCyAEQQA6AA8gAiADaiAELQAPOgAAAkAgACwAC0EASARAIAAgAjYCBAwBCyAAIAI6AAsLDAELIAAgAyACIANrAn8gACwAC0EASARAIAAoAgQMAQsgAC0ACwsiAEEAIAAgAiABENQICyAEQRBqJAALzAIBBX8jAEEQayIIJAAgAUF/c0FvaiACTwRAAn8gACwAC0EASARAIAAoAgAMAQsgAAshCQJ/Qef///8HIAFLBEAgCCABQQF0NgIIIAggASACajYCDAJ/IwBBEGsiAiQAIAhBDGoiCigCACAIQQhqIgsoAgBJIQwgAkEQaiQAIAsgCiAMGygCACICQQtPCwR/IAJBEGpBcHEiAiACQX9qIgIgAkELRhsFQQoLDAELQW4LQQFqIgoQtwghAiAEBEAgAiAJIAQQyQQLIAYEQCACIARqIAcgBhDJBAsgAyAFayIDIARrIgcEQCACIARqIAZqIAQgCWogBWogBxDJBAsgAUEKRwRAIAkQngkLIAAgAjYCACAAIApBgICAgHhyNgIIIAAgAyAGaiIANgIEIAhBADoAByAAIAJqIAgtAAc6AAAgCEEQaiQADwsQzwgACzgBAX8CfyAALAALQQBIBEAgACgCBAwBCyAALQALCyICIAFJBEAgACABIAJrENYIDwsgACABENcIC8kBAQR/IwBBEGsiBSQAIAEEQCAALAALQQBIBH8gACgCCEH/////B3FBf2oFQQoLIQICfyAALAALQQBIBEAgACgCBAwBCyAALQALCyIDIAFqIQQgAiADayABSQRAIAAgAiAEIAJrIAMgAxDYCAsgAwJ/IAAsAAtBAEgEQCAAKAIADAELIAALIgJqIAFBABDZCAJAIAAsAAtBAEgEQCAAIAQ2AgQMAQsgACAEOgALCyAFQQA6AA8gAiAEaiAFLQAPOgAACyAFQRBqJAALYQECfyMAQRBrIgIkAAJAIAAsAAtBAEgEQCAAKAIAIQMgAkEAOgAPIAEgA2ogAi0ADzoAACAAIAE2AgQMAQsgAkEAOgAOIAAgAWogAi0ADjoAACAAIAE6AAsLIAJBEGokAAuNAgEFfyMAQRBrIgUkAEFvIAFrIAJPBEACfyAALAALQQBIBEAgACgCAAwBCyAACyEGAn9B5////wcgAUsEQCAFIAFBAXQ2AgggBSABIAJqNgIMAn8jAEEQayICJAAgBUEMaiIHKAIAIAVBCGoiCCgCAEkhCSACQRBqJAAgCCAHIAkbKAIAIgJBC08LBH8gAkEQakFwcSICIAJBf2oiAiACQQtGGwVBCgsMAQtBbgtBAWoiBxC3CCECIAQEQCACIAYgBBDJBAsgAyAEayIDBEAgAiAEaiAEIAZqIAMQyQQLIAFBCkcEQCAGEJ4JCyAAIAI2AgAgACAHQYCAgIB4cjYCCCAFQRBqJAAPCxDPCAALFQAgAQRAIAAgAkH/AXEgARCqCRoLC9cBAQN/IwBBEGsiBSQAAkAgACwAC0EASAR/IAAoAghB/////wdxQX9qBUEKCyIEAn8gACwAC0EASARAIAAoAgQMAQsgAC0ACwsiA2sgAk8EQCACRQ0BAn8gACwAC0EASARAIAAoAgAMAQsgAAsiBCADaiABIAIQyQQgAiADaiICIQECQCAALAALQQBIBEAgACABNgIEDAELIAAgAToACwsgBUEAOgAPIAIgBGogBS0ADzoAAAwBCyAAIAQgAiADaiAEayADIANBACACIAEQ1AgLIAVBEGokAAvBAQEDfyMAQRBrIgMkACADIAE6AA8CQAJAAkACQCAALAALQQBIBEAgACgCBCIEIAAoAghB/////wdxQX9qIgJGDQEMAwtBCiEEQQohAiAALQALIgFBCkcNAQsgACACQQEgAiACENgIIAQhASAALAALQQBIDQELIAAiAiABQQFqOgALDAELIAAoAgAhAiAAIARBAWo2AgQgBCEBCyABIAJqIgAgAy0ADzoAACADQQA6AA4gACADLQAOOgABIANBEGokAAs7AQF/IwBBEGsiASQAAkAgAEEBOgALIABBAUEtENkIIAFBADoADyAAIAEtAA86AAEgAUEQaiQADwALAAujAQEDfyMAQRBrIgQkAEHv////AyACTwRAAkAgAkEBTQRAIAAgAjoACyAAIQMMAQsgACACQQJPBH8gAkEEakF8cSIDIANBf2oiAyADQQJGGwVBAQtBAWoiBRDDCCIDNgIAIAAgBUGAgICAeHI2AgggACACNgIECyADIAEgAhDSBCAEQQA2AgwgAyACQQJ0aiAEKAIMNgIAIARBEGokAA8LEM8IAAvQAQEDfyMAQRBrIgQkAAJAIAAsAAtBAEgEfyAAKAIIQf////8HcUF/agVBAQsiAyACTwRAAn8gACwAC0EASARAIAAoAgAMAQsgAAsiBSEDIAIEfyADIAEgAhDOCAUgAwsaIARBADYCDCAFIAJBAnRqIAQoAgw2AgACQCAALAALQQBIBEAgACACNgIEDAELIAAgAjoACwsMAQsgACADIAIgA2sCfyAALAALQQBIBEAgACgCBAwBCyAALQALCyIAQQAgACACIAEQ3wgLIARBEGokAAvlAgEFfyMAQRBrIggkACABQX9zQe////8DaiACTwRAAn8gACwAC0EASARAIAAoAgAMAQsgAAshCQJ/Qef///8BIAFLBEAgCCABQQF0NgIIIAggASACajYCDAJ/IwBBEGsiAiQAIAhBDGoiCigCACAIQQhqIgsoAgBJIQwgAkEQaiQAIAsgCiAMGygCACICQQJPCwR/IAJBBGpBfHEiAiACQX9qIgIgAkEC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gICAgICAgIB/gyEFIAJBAU4EfiAGQoCAgICAgIB4fCACrUI0hoQFIAZBASACa62ICyAFhL8PCyAARAAAAAAAAAAAoiAAIAUgBlEbC6sGAgV/BH4jAEGAAWsiBSQAAkACQAJAIAMgBEIAQgAQrgVFDQAgAyAEEKgJIQcgAkIwiKciCUH//wFxIgZB//8BRg0AIAcNAQsgBUEQaiABIAIgAyAEEKoFIAUgBSkDECICIAUpAxgiASACIAEQtAUgBSkDCCECIAUpAwAhBAwBCyABIAJC////////P4MgBq1CMIaEIgogAyAEQv///////z+DIARCMIinQf//AXEiB61CMIaEIgsQrgVBAEwEQCABIAogAyALEK4FBEAgASEEDAILIAVB8ABqIAEgAkIAQgAQqgUgBSkDeCECIAUpA3AhBAwBCyAGBH4gAQUgBUHgAGogASAKQgBCgICAgICAwLvAABCqBSAFKQNoIgpCMIinQYh/aiEGIAUpA2ALIQQgB0UEQCAFQdAAaiADIAtCAEKAgICAgIDAu8AAEKoFIAUpA1giC0IwiKdBiH9qIQcgBSkDUCEDCyAKQv///////z+DQoCAgICAgMAAhCIKIAtC////////P4NCgICAgICAwACEIg19IAQgA1StfSIMQn9VIQggBCADfSELIAYgB0oEQANAAn4gCARAIAsgDIRQBEAgBUEgaiABIAJCAEIAEKoFIAUpAyghAiAFKQMgIQQMBQsgC0I/iCEKIAxCAYYMAQsgCkIBhiEKIAQhCyAEQj+ICyEMIAogDIQiCiANfSALQgGGIgQgA1StfSIMQn9VIQggBCADfSELIAZBf2oiBiAHSg0ACyAHIQYLAkAgCEUNACALIgQgDCIKhEIAUg0AIAVBMGogASACQgBCABCqBSAFKQM4IQIgBSkDMCEEDAELIApC////////P1gEQANAIARCP4ghASAGQX9qIQYgBEIBhiEEIAEgCkIBhoQiCkKAgICAgIDAAFQNAAsLIAlBgIACcSEHIAZBAEwEQCAFQUBrIAQgCkL///////8/gyAGQfgAaiAHcq1CMIaEQgBCgICAgICAwMM/EKoFIAUpA0ghAiAFKQNAIQQMAQsgCkL///////8/gyAGIAdyrUIwhoQhAgsgACAENwMAIAAgAjcDCCAFQYABaiQAC+YDAwN/AX4GfAJA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AkFsaiABNgIAIAJBaGogATYCACACQWRqIAE2AgAgBCADQQRxQRhyIgRrIgJBIEkNACABrSIFQiCGIAWEIQUgAyAEaiEBA0AgASAFNwMYIAEgBTcDECABIAU3AwggASAFNwMAIAFBIGohASACQWBqIgJBH0sNAAsLIAAL5QIBAn8CQCAAIAFGDQACQCABIAJqIABLBEAgACACaiIEIAFLDQELIAAgASACEKkJGg8LIAAgAXNBA3EhAwJAAkAgACABSQRAIAMNAiAAQQNxRQ0BA0AgAkUNBCAAIAEtAAA6AAAgAUEBaiEBIAJBf2ohAiAAQQFqIgBBA3ENAAsMAQsCQCADDQAgBEEDcQRAA0AgAkUNBSAAIAJBf2oiAmoiAyABIAJqLQAAOgAAIANBA3ENAAsLIAJBA00NAANAIAAgAkF8aiICaiABIAJqKAIANgIAIAJBA0sNAAsLIAJFDQIDQCAAIAJBf2oiAmogASACai0AADoAACACDQALDAILIAJBA00NACACIQMDQCAAIAEoAgA2AgAgAUEEaiEBIABBBGohACADQXxqIgNBA0sNAAsgAkEDcSECCyACRQ0AA0AgACABLQAAOgAAIABBAWohACABQQFqIQEgAkF/aiICDQALCwsfAEHkvgIoAgBFBEBB6L4CIAE2AgBB5L4CIAA2AgALCwQAIwALEAAjACAAa0FwcSIAJAAgAAsGACAAJAALBgAgAEAACwsAIAEgAiAAEQIACw8AIAEgAiADIAQgABELAAsNACABIAIgAyAAER4ACw8AIAEgAiADIAQgABFIAAsNACABIAIgAyAAERoACw8AIAEgAiADIAQgABEZAAsLACABIAIgABEPAAsLACABIAIgABEXAAsPACABIAIgAyAEIAARWAALEQAgASACIAMgBCAFIAARSwALEQAgASACIAMgBCAFIAARWQALEwAgASACIAMgBCAFIAYgABFMAAsPACABIAIgAyAEIAAROgALEQAgASACIAMgBCAFIAARNAALEQAgASACIAMgBCAFIAAROwALEwAgASACIAMgBCAFIAYgABE1AAsTACABIAIgAyAEIAUgBiAAETwACxUAIAEgAiADIAQgBSAGIAcgABE2AAsLACABIAIgABETAAsNACABIAIgAyAAEUkACxEAIAEgAiADIAQgBSAAET4ACxMAIAEgAiADIAQgBSAGIAARJAALDwAgASACIAMgBCAAEUIACw8AIAEgAiADIAQgABEYAAsNACABIAIgAyAAET0ACw8AIAEgAiADIAQgABE3AAsPACABIAIgAyAEIAARCAALDQAgASACIAMgABEUAAsPACABIAIgAyAEIAARTgALEQAgASACIAMgBCAFIAARUQALEQAgASACIAMgBCAFIAAROQALEwAgASACIAMgBCAFIAYgABEyAAsTACABIAIgAyAEIAUgBiAAEVoACxUAIAEgAiADIAQgBSAGIAcgABFQAAsTACABIAIgAyAEIAUgBiAAES0ACxUAIAEgAiADIAQgBSAGIAcgABFVAAsTACABIAIgAyAEIAUgBiAAEVsACxUAIAEgAiADIAQgBSAGIAcgABFTAAsXACABIAIgAyAEIAUgBiAHIAggABFdAAsZACABIAIgAyAEIAUgBiAHIAggCSAAEVYACw0AIAEgAiADIAARVwALDwAgASACIAMgBCAAEUoACxMAIAEgAiADIAQgBSAGIAARKgALFQAgASACIAMgBCAFIAYgByAAEU0ACw8AIAEgAiADIAQgABEiAAsRACABIAIgAyAEIAUgABEpAAsNACABIAIgAyAAESAACw8AIAEgAiADIAQgABEzAAsRACABIAIgAyAEIAUgABEKAAsNACABIAIgAyAAEUQACw8AIAEgAiADIAQgABFDAAsJACABIAARJwALCwAgASACIAARKAALDwAgASACIAMgBCAAEUYACxEAIAEgAiADIAQgBSAAEUcACxMAIAEgAiADIAQgBSAGIAARMAALFQAgASACIAMgBCAFIAYgByAAES8ACw0AIAEgAiADIAARXwALDwAgASACIAMgBCAAETEACw8AIAEgAiADIAQgABFkAAsRACABIAIgAyAEIAUgABErAAsTACABIAIgAyAEIAUgBiAAEU8ACxMAIAEgAiADIAQgBSAGIAARXAALFQAgASACIAMgBCAFIAYgByAAEVQACxEAIAEgAiADIAQgBSAAESwACxMAIAEgAiADIAQgBSAGIAARUgALCwAgASACIAARZgALEwAgASACIAMgBCAFIAYgABFFAAsRACABIAIgAyAEIAUgABEGAAsXACABIAIgAyAEIAUgBiAHIAggABEOAAsTACABIAIgAyAEIAUgBiAAEQkACxEAIAEgAiADIAQgBSAAESUACxUAIAEgAiADIAQgBSAGIAcgABESAAsTACABIAIgAyAEIAUgBiAAEQ0ACwcAIAARBwALGQAgASACIAOtIAStQiCGhCAFIAYgABEjAAsiAQF+IAEgAq0gA61CIIaEIAQgABEcACIFQiCIpxApIAWnCxkAIAEgAiADIAQgBa0gBq1CIIaEIAARIQALIwAgASACIAMgBCAFrSAGrUIghoQgB60gCK1CIIaEIAARQQALJQAgASACIAMgBCAFIAatIAetQiCGhCAIrSAJrUIghoQgABFAAAsL1uUBUQBBgAgLwA9WZWN0b3JJbnQAVmVjdG9yRG91YmxlAFZlY3RvckNoYXIAVmVjdG9yVUNoYXIAVmVjdG9yRmxvYXQAdmVjdG9yVG9vbHMAY2xlYXJWZWN0b3JEYmwAY2xlYXJWZWN0b3JGbG9hdABtYXhpU2V0dGluZ3MAc2V0dXAAbWF4aUVudmVsb3BlAGxpbmUAdHJpZ2dlcgBhbXBsaXR1ZGUAdmFsaW5kZXgAbWF4aURlbGF5bGluZQBkbABtYXhpTWl4AHN0ZXJlbwBxdWFkAGFtYmlzb25pYwBtYXhpTGluZQBwbGF5AHByZXBhcmUAdHJpZ2dlckVuYWJsZQBpc0xpbmVDb21wbGV0ZQBtYXhpWEZhZGUAeGZhZGUAbWF4aUxhZ0V4cABpbml0AGFkZFNhbXBsZQB2YWx1ZQBhbHBoYQBhbHBoYVJlY2lwcm9jYWwAdmFsAG1heGlTYW1wbGUAZ2V0TGVuZ3RoAHNldFNhbXBsZQBzZXRTYW1wbGVGcm9tT2dnQmxvYgBpc1JlYWR5AHBsYXlPbmNlAHBsYXlPblpYAHBsYXk0AGNsZWFyAG5vcm1hbGlzZQBhdXRvVHJpbQBsb2FkAHJlYWQAbG9vcFNldFBvc09uWlgAbWF4aUR5bgBnYXRlAGNvbXByZXNzb3IAY29tcHJlc3MAc2V0QXR0YWNrAHNldFJlbGVhc2UAc2V0VGhyZXNob2xkAHNldFJhdGlvAG1heGlFbnYAYXIAYWRzcgBzZXREZWNheQBzZXRTdXN0YWluAGNvbnZlcnQAbXRvZgBtc1RvU2FtcHMAbWF4aVNhbXBsZUFuZEhvbGQAc2FoAG1heGlGbGFuZ2VyAGZsYW5nZQBtYXhpQ2hvcnVzAGNob3J1cwBtYXhpRENCbG9ja2VyAG1heGlTVkYAc2V0Q3V0b2ZmAHNldFJlc29uYW5jZQBtYXhpTWF0aABhZGQAc3ViAG11bABkaXYAZ3QAbHQAZ3RlAGx0ZQBtb2QAYWJzAHBvdwBtYXhpQ2xvY2sAdGlja2VyAHNldFRlbXBvAHNldFRpY2tzUGVyQmVhdABpc1RpY2sAY3VycmVudENvdW50AHBsYXlIZWFkAGJwcwBicG0AdGljawB0aWNrcwBtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yAHNldFBoYXNlAGdldFBoYXNlAG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQAc2V0UGhhc2VzAHNpemUAbWF4aUFzeW5jS3VyYW1vdG9Pc2NpbGxhdG9yAG1heGlGRlQAcHJvY2VzcwBzcGVjdHJhbEZsYXRuZXNzAHNwZWN0cmFsQ2VudHJvaWQAZ2V0TWFnbml0dWRlcwBnZXRNYWduaXR1ZGVzREIAZ2V0UGhhc2VzAGdldE51bUJpbnMAZ2V0RkZUU2l6ZQBnZXRIb3BTaXplAGdldFdpbmRvd1NpemUAbWF4aUZGVE1vZGVzAFdJVEhfUE9MQVJfQ09OVkVSU0lPTgBOT19QT0xBUl9DT05WRVJTSU9OAG1heGlJRkZUAG1heGlJRkZUTW9kZXMAU1BFQ1RSVU0AQ09NUExFWABtYXhpTUZDQwBtZmNjAG1heGlUaW1lU3RyZXRjaABzaGFyZWRfcHRyPG1heGlUaW1lc3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPgBnZXROb3JtYWxpc2VkUG9zaXRpb24AZ2V0UG9zaXRpb24Ac2V0UG9zaXRpb24AcGxheUF0UG9zaXRpb24AbWF4aVBpdGNoU2hpZnQAc2hhcmVkX3B0cjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPgBtYXhpU3RyZXRjaABzZXRMb29wU3RhcnQAc2V0TG9vcEVuZABnZXRMb29wRW5kAG1heGlCaXRzAHNpZwBhdABzaGwAc2hyAHIAbGFuZABsb3IAbHhvcgBuZWcAaW5jAGRlYwBlcQBub2lzZQB0b1NpZ25hbAB0b1RyaWdTaWduYWwAZnJvbVNpZ25hbABtYXhpQ291bnRlcgBjb3VudABtYXhpU2F0UmV2ZXJiAG1heGlGcmVlVmVyYgBhbGxvY2F0b3I8VD46OmFsbG9jYXRlKHNpemVfdCBuKSAnbicgZXhjZWVkcyBtYXhpbXVtIHN1cHBvcnRlZCBzaXplAHB1c2hfYmFjawByZXNpemUAZ2V0AHNldABOU3QzX18yNnZlY3RvcklpTlNfOWFsbG9jYXRvcklpRUVFRQBOU3QzX18yMTNfX3ZlY3Rvcl9iYXNlSWlOU185YWxsb2NhdG9ySWlFRUVFAE5TdDNfXzIyMF9fdmVjdG9yX2Jhc2VfY29tbW9uSUxiMUVFRQAAAAC8dgAA1AoAAEB3AACoCgAAAAAAAAEAAAD8CgAAAAAAAEB3AACECgAAAAAAAAEAAAAECwAAAAAAAFBOU3QzX18yNnZlY3RvcklpTlNfOWFsbG9jYXRvcklpRUVFRQAAAACcdwAANAsAAAAAAAAcCwAAUEtOU3QzX18yNnZlY3RvcklpTlNfOWFsbG9jYXRvcklpRUVFRQAAAJx3AABsCwAAAQAAABwLAABpaQB2AHZpAFwLAADEdQAAXAsAACR2AAB2aWlpAEHQFwtQxHUAAFwLAABIdgAAJHYAAHZpaWlpAAAASHYAAJQLAABpaWkAFAwAABwLAABIdgAATjEwZW1zY3JpcHRlbjN2YWxFAAC8dgAAAAwAAGlpaWkAQbAYC+YE3HUAABwLAABIdgAAJHYAAGlpaWlpAE5TdDNfXzI2dmVjdG9ySWROU185YWxsb2NhdG9ySWRFRUVFAE5TdDNfXzIxM19fdmVjdG9yX2Jhc2VJZE5TXzlhbGxvY2F0b3JJZEVFRUUAAABAdwAAagwAAAAAAAABAAAA/AoAAAAAAABAdwAARgwAAAAAAAABAAAAmAwAAAAAAABQTlN0M19fMjZ2ZWN0b3JJZE5TXzlhbGxvY2F0b3JJZEVFRUUAAAAAnHcAAMgMAAAAAAAAsAwAAFBLTlN0M19fMjZ2ZWN0b3JJZE5TXzlhbGxvY2F0b3JJZEVFRUUAAACcdwAAAA0AAAEAAACwDAAA8AwAAMR1AADwDAAAYHYAAHZpaWQAAAAAxHUAAPAMAABIdgAAYHYAAHZpaWlkAAAASHYAACgNAAAUDAAAsAwAAEh2AAAAAAAA3HUAALAMAABIdgAAYHYAAGlpaWlkAE5TdDNfXzI2dmVjdG9ySWNOU185YWxsb2NhdG9ySWNF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UDdtYXhpRkZUAAAAnHcAAJQfAAAAAAAAjB8AAFBLN21heGlGRlQAAJx3AACwHwAAAQAAAIwfAACgHwAAxHUAAKAfAAAkdgAAJHYAACR2AAB2aWlpaWkAAAAAAADcdQAAoB8AAFR2AAAUIAAATjdtYXhpRkZUOGZmdE1vZGVzRQBwdgAAACAAAGlpaWZpAAAAVHYAAKAfAABmaWkAiBAAAKAfAAAkdgAAoB8AADhtYXhpSUZGVAAAALx2AABAIAAAUDhtYXhpSUZGVAAAnHcAAFQgAAAAAAAATCAAAFBLOG1heGlJRkZUAJx3AABwIAAAAQAAAEwgAABgIAAAxHUAAGAgAAAkdgAAJHYAACR2AEGwwQALtg1UdgAAYCAAAIgQAACIEAAA3CAAAE44bWF4aUlGRlQ4ZmZ0TW9kZXNFAAAAAHB2AADEIAAAZmlpaWlpADE2bWF4aU1GQ0NBbmFseXNlcklkRQAAAAC8dgAA6yAAAFAxNm1heGlNRkNDQW5hbHlzZXJJZEUAAJx3AAAMIQAAAAAAAAQhAABQSzE2bWF4aU1GQ0NBbmFseXNlcklkRQCcdwAANCEAAAEAAAAEIQAAJCEAAMR1AAAkIQAAMHYAADB2AAAwdgAAYHYAAGB2AAB2aWlpaWlkZAAAAACwDAAAJCEAAIgQAAAxNW1heGlUaW1lU3RyZXRjaEkxNGhhbm5XaW5GdW5jdG9yRQC8dgAAlCEAAFAxNW1heGlUaW1lU3RyZXRjaEkxNGhhbm5XaW5GdW5jdG9yRQAAAACcdwAAwCEAAAAAAAC4IQAAUEsxNW1heGlUaW1lU3RyZXRjaEkxNGhhbm5XaW5GdW5jdG9yRQAAAJx3AAD4IQAAAQAAALghAAAAAAAA6CIAAOoBAADrAQAA7AEAAO0BAADuAQAATlN0M19fMjIwX19zaGFyZWRfcHRyX3BvaW50ZXJJUDE1bWF4aVRpbWVTdHJldGNoSTE0aGFubldpbkZ1bmN0b3JFTjEwZW1zY3JpcHRlbjE1c21hcnRfcHRyX3RyYWl0SU5TXzEwc2hhcmVkX3B0cklTM19FRUUxMXZhbF9kZWxldGVyRU5TXzlhbGxvY2F0b3JJUzNfRUVFRQAA5HYAAEwiAAAEcwAATjEwZW1zY3JpcHRlbjE1c21hcnRfcHRyX3RyYWl0SU5TdDNfXzIxMHNoYXJlZF9wdHJJMTVtYXhpVGltZVN0cmV0Y2hJMTRoYW5uV2luRnVuY3RvckVFRUUxMXZhbF9kZWxldGVyRQBOU3QzX18yMTBzaGFyZWRfcHRySTE1bWF4aVRpbWVTdHJldGNoSTE0aGFubldpbkZ1bmN0b3JFRUUAAAC8dgAAXCMAAGkAAACYIwAAAAAAABwkAADvAQAA8AEAAPEBAADyAQAA8wEAAE5TdDNfXzIyMF9fc2hhcmVkX3B0cl9lbXBsYWNlSTE1bWF4aVRpbWVTdHJldGNoSTE0aGFubldpbkZ1bmN0b3JFTlNfOWFsbG9jYXRvcklTM19FRUVFAADkdgAAxCMAAARzAADEdQAA6CEAACQWAABgdgAA6CEAAMR1AADoIQAAYHYAAAAAAACUJAAA9AEAAPUBAAD2AQAAOW1heGlHcmFpbkkxNGhhbm5XaW5GdW5jdG9yRQAxM21heGlHcmFpbkJhc2UAAAAAvHYAAHkkAADkdgAAXCQAAIwkAABgdgAA6CEAAGB2AABgdgAAJHYAAGB2AABkaWlkZGlkAGB2AADoIQAAYHYAAGB2AAAkdgAAMTRtYXhpUGl0Y2hTaGlmdEkxNGhhbm5XaW5GdW5jdG9yRQAAvHYAANQkAABQMTRtYXhpUGl0Y2hTaGlmdEkxNGhhbm5XaW5GdW5jdG9yRQCcdwAAACUAAAAAAAD4JAAAUEsxNG1heGlQaXRjaFNoaWZ0STE0aGFubldpbkZ1bmN0b3JFAAAAAJx3AAA0JQAAAQAAAPgkAAAAAAAAJCYAAPcBAAD4AQAA+QEAAPoBAAD7AQAATlN0M19fMjIwX19zaGFyZWRfcHRyX3BvaW50ZXJJUDE0bWF4aVBpdGNoU2hpZnRJMTRoYW5uV2luRnVuY3RvckVOMTBlbXNjcmlwdGVuMTVzbWFydF9wdHJfdHJhaXRJTlNfMTBzaGFyZWRfcHRySVMzX0VFRTExdmFsX2RlbGV0ZXJFTlNfOWFsbG9jYXRvcklTM19FRUVFAAAA5HYAAIglAAAEcwAATjEwZW1zY3JpcHRlbjE1c21hcnRfcHRyX3RyYWl0SU5TdDNfXzIxMHNoYXJlZF9wdHJJMTRtYXhpUGl0Y2hTaGlmdEkxNGhhbm5XaW5GdW5jdG9yRUVFRTExdmFsX2RlbGV0ZXJFAE5TdDNfXzIxMHNo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AABGAgAARwIAAE5TdDNfXzI4aW9zX2Jhc2VFAAAAvHYAABBEAAAAAAAAaEQAAEgCAABJAgAATlN0M19fMjliYXNpY19pb3NJY05TXzExY2hhcl90cmFpdHNJY0VFRUUAAADkdgAAPEQAACREAAAAAAAAsEQAAEoCAABLAgAATlN0M19fMjliYXNpY19pb3NJd05TXzExY2hhcl90cmFpdHNJd0VFRUUAAADkdgAAhEQAACREAABOU3QzX18yMTViYXNpY19zdHJlYW1idWZJY05TXzExY2hhcl90cmFpdHNJY0VFRUUAAAAAvHYAALxEAABOU3QzX18yMTViYXNpY19zdHJlYW1idWZJd05TXzExY2hhcl90cmFpdHNJd0VFRUUAAAAAvHYAAPhEAABOU3QzX18yMTNiYXNpY19pc3RyZWFtSWNOU18xMWNoYXJfdHJhaXRzSWNFRUVFAABAdwAANEUAAAAAAAABAAAAaEQAAAP0//9OU3QzX18yMTNiYXNpY19pc3RyZWFtSXdOU18xMWNoYXJfdHJhaXRzSXdFRUVFAABAdwAAfEUAAAAAAAABAAAAsEQAAAP0//9OU3QzX18yMTNiYXNpY19vc3RyZWFtSWNOU18xMWNoYXJfdHJhaXRzSWNFRUVFAABAdwAAxEUAAAAAAAABAAAAaEQAAAP0//9OU3QzX18yMTNiYXNpY19vc3RyZWFtSXdOU18xMWNoYXJfdHJhaXRzSXdFRUVFAABAdwAADEYAAAAAAAABAAAAsEQAAAP0//8ohAAAAAAAALBGAAAiAgAATQIAAE4CAAAlAgAAJgIAACcCAAAoAgAAEAIAABECAABPAgAAUAIAAFECAAAVAgAAKwIAAE5TdDNfXzIxMF9fc3RkaW5idWZJY0VFAOR2AACYRgAA8EQAAHVuc3VwcG9ydGVkIGxvY2FsZSBmb3Igc3RhbmRhcmQgaW5wdXQAAAAAAAAAPEcAACwCAABSAgAAUwIAAC8CAAAwAgAAMQIAADICAAAzAgAANAIAAFQCAABVAgAAVgIAADgCAAA5AgAATlN0M19fMjEwX19zdGRpbmJ1Zkl3RUUA5HYAACRHAAAsRQAAAAAAAKRHAAAiAgAAVwIAAFgCAAAlAgAAJgIAACcCAABZAgAAEAIAABECAAApAgAAEwIAACoCAABaAgAAWwIAAE5TdDNfXzIxMV9fc3Rkb3V0YnVmSWNFRQAAAADkdgAAiEcAAPBEAAAAAAAADEgAACwCAABcAgAAXQIAAC8CAAAwAgAAMQIAAF4CAAAzAgAANAIAADUCAAA2AgAANwIAAF8CAABgAgAATlN0M19fMjExX19zdGRvdXRidWZJd0VFAAAAAOR2AADwRwAALEUAQaCQAQvjBP////////////////////////////////////////////////////////////////8AAQIDBAUGBwgJ/////////woLDA0ODxAREhMUFRYXGBkaGxwdHh8gISIj////////CgsMDQ4PEBESExQVFhcYGRobHB0eHyAhIiP/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////AAECBAcDBgUAAAAAAAAAAgAAwAMAAMAEAADABQAAwAYAAMAHAADACAAAwAkAAMAKAADACwAAwAwAAMANAADADgAAwA8AAMAQAADAEQAAwBIAAMATAADAFAAAwBUAAMAWAADAFwAAwBgAAMAZAADAGgAAwBsAAMAcAADAHQAAwB4AAMAfAADAAAAAswEAAMMCAADDAwAAwwQAAMMFAADDBgAAwwcAAMMIAADDCQAAwwoAAMMLAADDDAAAww0AANMOAADDDwAAwwAADLsBAAzDAgAMwwMADMMEAAzTaW5maW5pdHkAbmFuAAAAAAAAAADRdJ4AV529KoBwUg///z4nCgAAAGQAAADoAwAAECcAAKCGAQBAQg8AgJaYAADh9QUYAAAANQAAAHEAAABr////zvv//5K///8AAAAAAAAAAN4SBJUAAAAA////////////////YEoAABQAAABDLlVURi04AEGolQELAnRKAEHAlQELBkxDX0FMTABB0JUBC25MQ19DVFlQRQAAAABMQ19OVU1FUklDAABMQ19USU1FAAAAAABMQ19DT0xMQVRFAABMQ19NT05FVEFSWQBMQ19NRVNTQUdFUwBMQU5HAEMuVVRGLTgAUE9TSVgATVVTTF9MT0NQQVRIAAAAAABATABB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AAAA7GoAAJgCAABDAwAAdgIAAEQDAABFAwAATlN0M19fMjltb25leV9nZXRJY05TXzE5aXN0cmVhbWJ1Zl9pdGVyYXRvckljTlNfMTFjaGFyX3RyYWl0c0ljRUVFRUVFAE5TdDNfXzIxMV9fbW9uZXlfZ2V0SWNFRQAAvHYAAMpqAABAdwAAhGoAAAAAAAACAAAAsF0AAAIAAADkagBBkNYBC5oBkGsAAJgCAABGAwAAdgIAAEcDAABIAwAATlN0M19fMjltb25leV9nZXRJd05TXzE5aXN0cmVhbWJ1Zl9pdGVyYXRvckl3TlNfMTFjaGFyX3RyYWl0c0l3RUVFRUVFAE5TdDNfXzIxMV9fbW9uZXlfZ2V0SXdFRQAAvHYAAG5rAABAdwAAKGsAAAAAAAACAAAAsF0AAAIAAACIawBBtNcBC5oBNGwAAJgCAABJAwAAdgIAAEoDAABLAwAATlN0M19fMjltb25leV9wdXRJY05TXzE5b3N0cmVhbWJ1Zl9pdGVyYXRvckljTlNfMTFjaGFyX3RyYWl0c0ljRUVFRUVFAE5TdDNfXzIxMV9fbW9uZXlfcHV0SWNFRQAAvHYAABJsAABAdwAAzGsAAAAAAAACAAAAsF0AAAIAAAAsbABB2NgBC5oB2GwAAJgCAABMAwAAdgIAAE0DAABOAwAATlN0M19fMjltb25leV9wdXRJd05TXzE5b3N0cmVhbWJ1Zl9pdGVyYXRvckl3TlNfMTFjaGFyX3RyYWl0c0l3RUVFRUVFAE5TdDNfXzIxMV9fbW9uZXlfcHV0SXdFRQAAvHYAALZsAABAdwAAcGwAAAAAAAACAAAAsF0AAAIAAADQbABB/NkBC+ohUG0AAJgCAABPAwAAdgIAAFADAABRAwAAUgMAAE5TdDNfXzI4bWVzc2FnZXNJY0VFAE5TdDNfXzIxM21lc3NhZ2VzX2Jhc2VFAAAAALx2AAAtbQAAQHcAABhtAAAAAAAAAgAAALBdAAACAAAASG0AAAIAAAAAAAAAqG0AAJgCAABTAwAAdgIAAFQDAABVAwAAVgMAAE5TdDNfXzI4bWVzc2FnZXNJd0VFAAAAAEB3AACQbQAAAAAAAAIAAACwXQAAAgAAAEhtAAACAAAAU3VuZGF5AE1vbmRheQBUdWVzZGF5AFdlZG5lc2RheQBUaHVyc2RheQBGcmlk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Ojp2YWwAZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8Y2hhcj4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8c2lnbmVkIGNoYXI+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHVuc2lnbmVkIGNoYXI+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHNob3J0PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzx1bnNpZ25lZCBzaG9ydD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8aW50PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzx1bnNpZ25lZCBpbnQ+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PGxvbmc+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHVuc2lnbmVkIGxvbmc+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PGludDhfdD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8dWludDhfdD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8aW50MTZfdD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8dWludDE2X3Q+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PGludDMyX3Q+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHVpbnQzMl90PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxmbG9hdD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8ZG91YmxlPgBOU3QzX18yMTJiYXNpY19zdHJpbmdJaE5TXzExY2hhcl90cmFpdHNJaEVFTlNfOWFsbG9jYXRvckloRUVFRQAAAABAdwAAxnoAAAAAAAABAAAAmBcAAAAAAABOU3QzX18yMTJiYXNpY19zdHJpbmdJd05TXzExY2hhcl90cmFpdHNJd0VFTlNfOWFsbG9jYXRvckl3RUVFRQAAQHcAACB7AAAAAAAAAQAAAJgXAAAAAAAATlN0M19fMjEyYmFzaWNfc3RyaW5nSURzTlNfMTFjaGFyX3RyYWl0c0lEc0VFTlNfOWFsbG9jYXRvcklEc0VFRUUAAABAdwAAeHsAAAAAAAABAAAAmBcAAAAAAABOU3QzX18yMTJiYXNpY19zdHJpbmdJRGlOU18xMWNoYXJfdHJhaXRzSURpRUVOU185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X2VtYmluZF9yZWdpc3Rlcl9jbGFzc19jbGFzc19mdW5jdGlvbgMfX2VtYmluZF9yZWdpc3Rlcl9jbGFzc19mdW5jdGlvbgQfX2VtYmluZF9yZWdpc3Rlcl9jbGFzc19wcm9wZXJ0eQUVX2VtYmluZF9yZWdpc3Rlcl9lbnVtBhtfZW1iaW5kX3JlZ2lzdGVyX2VudW1fdmFsdWUHGl9lbWJpbmRfcmVnaXN0ZXJfc21hcnRfcHRyCBhfX2N4YV9hbGxvY2F0ZV9leGNlcHRpb24JC19fY3hhX3Rocm93ChFfZW12YWxfdGFrZV92YWx1ZQsNX2VtdmFsX2luY3JlZgwNX2VtdmFsX2RlY3JlZg0LX2VtdmFsX2NhbGwOBXJvdW5kDwRleGl0EA1fX2Fzc2VydF9mYWlsEQZfX2xvY2sSCF9fdW5sb2NrEw9fX3dhc2lfZmRfY2xvc2UUCl9fc3lzY2FsbDUVDF9fc3lzY2FsbDIyMRYLX19zeXNjYWxsNTQXDl9fd2FzaV9mZF9yZWFkGA9fX3dhc2lfZmRfd3JpdGUZGF9fd2FzaV9lbnZpcm9uX3NpemVzX2dldBoSX193YXNpX2Vudmlyb25fZ2V0GwpfX21hcF9maWxlHAtfX3N5c2NhbGw5MR0Kc3RyZnRpbWVfbB4FYWJvcnQfFV9lbWJpbmRfcmVnaXN0ZXJfdm9pZCAVX2VtYmluZF9yZWdpc3Rlcl9ib29sIRtfZW1iaW5kX3JlZ2lzdGVyX3N0ZF9zdHJpbmciHF9lbWJpbmRfcmVnaXN0ZXJfc3RkX3dzdHJpbmcjFl9lbWJpbmRfcmVnaXN0ZXJfZW12YWwkGF9lbWJpbmRfcmVnaXN0ZXJfaW50ZWdlciUWX2VtYmluZF9yZWdpc3Rlcl9mbG9hdCYcX2VtYmluZF9yZWdpc3Rlcl9tZW1vcnlfdmlldycWZW1zY3JpcHRlbl9yZXNpemVfaGVhcCgVZW1zY3JpcHRlbl9tZW1jcHlfYmlnKQtzZXRUZW1wUmV0MCoabGVnYWxpbXBvcnQkX193YXNpX2ZkX3NlZWsrEV9fd2FzbV9jYWxsX2N0b3JzLFBFbXNjcmlwdGVuQmluZGluZ0luaXRpYWxpemVyX215X21vZHVsZTo6RW1zY3JpcHRlbkJpbmRpbmdJbml0aWFsaXplcl9teV9tb2R1bGUoKS2VAWVtc2NyaXB0ZW46OmNsYXNzXzxzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4sIGVtc2NyaXB0ZW46OmludGVybmFsOjpOb0Jhc2VDbGFzcz4gZW1zY3JpcHRlbjo6cmVnaXN0ZXJfdmVjdG9yPGludD4oY2hhciBjb25zdCopLp4BZW1zY3JpcHRlbjo6Y2xhc3NfPHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiwgZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok5vQmFzZUNsYXNzPiBlbXNjcmlwdGVuOjpyZWdpc3Rlcl92ZWN0b3I8ZG91YmxlPihjaGFyIGNvbnN0KikvmAFlbXNjcmlwdGVuOjpjbGFzc188c3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4sIGVtc2NyaXB0ZW46OmludGVybmFsOjpOb0Jhc2VDbGFzcz4gZW1zY3JpcHRlbjo6cmVnaXN0ZXJfdmVjdG9yPGNoYXI+KGNoYXIgY29uc3QqKTCzAWVtc2NyaXB0ZW46OmNsYXNzXzxzdGQ6Ol9fMjo6dmVjdG9yPHVuc2lnbmVkIGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8dW5zaWduZWQgY2hhcj4gPiwgZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok5vQmFzZUNsYXNzPiBlbXNjcmlwdGVuOjpyZWdpc3Rlcl92ZWN0b3I8dW5zaWduZWQgY2hhcj4oY2hhciBjb25zdCopMZsBZW1zY3JpcHRlbjo6Y2xhc3NfPHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4sIGVtc2NyaXB0ZW46OmludGVybmFsOjpOb0Jhc2VDbGFzcz4gZW1zY3JpcHRlbjo6cmVnaXN0ZXJfdmVjdG9yPGZsb2F0PihjaGFyIGNvbnN0KikySnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPHZlY3RvclRvb2xzPih2ZWN0b3JUb29scyopM0R2b2lkIGVtc2NyaXB0ZW46OmludGVybmFsOjpyYXdfZGVzdHJ1Y3Rvcjx2ZWN0b3JUb29scz4odmVjdG9yVG9vbHMqKTRHZW1zY3JpcHRlbjo6aW50ZXJuYWw6Okludm9rZXI8dmVjdG9yVG9vbHMqPjo6aW52b2tlKHZlY3RvclRvb2xzKiAoKikoKSk1PnZlY3RvclRvb2xzKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PHZlY3RvclRvb2xzPigpNuABZW1zY3JpcHRlbjo6aW50ZXJuYWw6Okludm9rZXI8dm9pZCwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+Jj46Omludm9rZSh2b2lkICgqKShzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mKSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+Kik3VHZlY3RvclRvb2xzOjpjbGVhclZlY3RvckRibChzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mKThMdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aVNldHRpbmdzPihtYXhpU2V0dGluZ3MqKTliZW1zY3JpcHRlbjo6aW50ZXJuYWw6Okludm9rZXI8dm9pZCwgaW50LCBpbnQsIGludD46Omludm9rZSh2b2lkICgqKShpbnQsIGludCwgaW50KSwgaW50LCBpbnQsIGludCk6Im1heGlTZXR0aW5nczo6c2V0dXAoaW50LCBpbnQsIGludCk7THZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlFbnZlbG9wZT4obWF4aUVudmVsb3BlKik8QG1heGlFbnZlbG9wZSogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpRW52ZWxvcGU+KCk9hANlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlFbnZlbG9wZTo6KikoaW50LCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mKSwgZG91YmxlLCBtYXhpRW52ZWxvcGUqLCBpbnQsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiY+OjppbnZva2UoZG91YmxlIChtYXhpRW52ZWxvcGU6OiogY29uc3QmKShpbnQsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYpLCBtYXhpRW52ZWxvcGUqLCBpbnQsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiopProBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAobWF4aUVudmVsb3BlOjoqKShpbnQsIGRvdWJsZSksIHZvaWQsIG1heGlFbnZlbG9wZSosIGludCwgZG91YmxlPjo6aW52b2tlKHZvaWQgKG1heGlFbnZlbG9wZTo6KiBjb25zdCYpKGludCwgZG91YmxlKSwgbWF4aUVudmVsb3BlKiwgaW50LCBkb3VibGUpPyJtYXhpRW52ZWxvcGU6OmdldEFtcGxpdHVkZSgpIGNvbnN0QCJtYXhpRW52ZWxvcGU6OnNldEFtcGxpdHVkZShkb3VibGUpQZwBZG91YmxlIGVtc2NyaXB0ZW46OmludGVybmFsOjpHZXR0ZXJQb2xpY3k8ZG91YmxlIChtYXhpRW52ZWxvcGU6OiopKCkgY29uc3Q+OjpnZXQ8bWF4aUVudmVsb3BlPihkb3VibGUgKG1heGlFbnZlbG9wZTo6KiBjb25zdCYpKCkgY29uc3QsIG1heGlFbnZlbG9wZSBjb25zdCYpQpgBdm9pZCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6U2V0dGVyUG9saWN5PHZvaWQgKG1heGlFbnZlbG9wZTo6KikoZG91YmxlKT46OnNldDxtYXhpRW52ZWxvcGU+KHZvaWQgKG1heGlFbnZlbG9wZTo6KiBjb25zdCYpKGRvdWJsZSksIG1heGlFbnZlbG9wZSYsIGRvdWJsZSlDIW1heGlFbnZlbG9wZTo6Z2V0VmFsaW5kZXgoKSBjb25zdEQebWF4aUVudmVsb3BlOjpzZXRWYWxpbmRleChpbnQpRZMBaW50IGVtc2NyaXB0ZW46OmludGVybmFsOjpHZXR0ZXJQb2xpY3k8aW50IChtYXhpRW52ZWxvcGU6OiopKCkgY29uc3Q+OjpnZXQ8bWF4aUVudmVsb3BlPihpbnQgKG1heGlFbnZlbG9wZTo6KiBjb25zdCYpKCkgY29uc3QsIG1heGlFbnZlbG9wZSBjb25zdCYpRo8Bdm9pZCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6U2V0dGVyUG9saWN5PHZvaWQgKG1heGlFbnZlbG9wZTo6KikoaW50KT46OnNldDxtYXhpRW52ZWxvcGU+KHZvaWQgKG1heGlFbnZlbG9wZTo6KiBjb25zdCYpKGludCksIG1heGlFbnZlbG9wZSYsIGludClHTnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlEZWxheWxpbmU+KG1heGlEZWxheWxpbmUqKUhCbWF4aURlbGF5bGluZSogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpRGVsYXlsaW5lPigpSeQBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpRGVsYXlsaW5lOjoqKShkb3VibGUsIGludCwgZG91YmxlKSwgZG91YmxlLCBtYXhpRGVsYXlsaW5lKiwgZG91YmxlLCBpbnQsIGRvdWJsZT46Omludm9rZShkb3VibGUgKG1heGlEZWxheWxpbmU6OiogY29uc3QmKShkb3VibGUsIGludCwgZG91YmxlKSwgbWF4aURlbGF5bGluZSosIGRvdWJsZSwgaW50LCBkb3VibGUpSvgBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpRGVsYXlsaW5lOjoqKShkb3VibGUsIGludCwgZG91YmxlLCBpbnQpLCBkb3VibGUsIG1heGlEZWxheWxpbmUqLCBkb3VibGUsIGludCwgZG91YmxlLCBpbnQ+OjppbnZva2UoZG91YmxlIChtYXhpRGVsYXlsaW5lOjoqIGNvbnN0JikoZG91YmxlLCBpbnQsIGRvdWJsZSwgaW50KSwgbWF4aURlbGF5bGluZSosIGRvdWJsZSwgaW50LCBkb3VibGUsIGludClLQnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlNaXg+KG1heGlNaXgqKUw2bWF4aU1peCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpTWl4PigpTZYDZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAobWF4aU1peDo6KikoZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBkb3VibGUpLCB2b2lkLCBtYXhpTWl4KiwgZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBkb3VibGU+OjppbnZva2Uodm9pZCAobWF4aU1peDo6KiBjb25zdCYpKGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgZG91YmxlKSwgbWF4aU1peCosIGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KiwgZG91YmxlKU62A2Vtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKG1heGlNaXg6OiopKGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgZG91YmxlLCBkb3VibGUpLCB2b2lkLCBtYXhpTWl4KiwgZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBkb3VibGUsIGRvdWJsZT46Omludm9rZSh2b2lkIChtYXhpTWl4OjoqIGNvbnN0JikoZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBkb3VibGUsIGRvdWJsZSksIG1heGlNaXgqLCBkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiosIGRvdWJsZSwgZG91YmxlKU/WA2Vtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKG1heGlNaXg6OiopKGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSksIHZvaWQsIG1heGlNaXgqLCBkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGRvdWJsZSwgZG91YmxlLCBkb3VibGU+OjppbnZva2Uodm9pZCAobWF4aU1peDo6KiBjb25zdCYpKGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSksIG1heGlNaXgqLCBkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUpUER2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpTGluZT4obWF4aUxpbmUqKVE4bWF4aUxpbmUqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aUxpbmU+KClSFm1heGlMaW5lOjpwbGF5KGRvdWJsZSlTnAFlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlMaW5lOjoqKShkb3VibGUpLCBkb3VibGUsIG1heGlMaW5lKiwgZG91YmxlPjo6aW52b2tlKGRvdWJsZSAobWF4aUxpbmU6OiogY29uc3QmKShkb3VibGUpLCBtYXhpTGluZSosIGRvdWJsZSlUL21heGlMaW5lOjpwcmVwYXJlKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGJvb2wpVe4BZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAobWF4aUxpbmU6OiopKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGJvb2wpLCB2b2lkLCBtYXhpTGluZSosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGJvb2w+OjppbnZva2Uodm9pZCAobWF4aUxpbmU6OiogY29uc3QmKShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBib29sKSwgbWF4aUxpbmUqLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBib29sKVYfbWF4aUxpbmU6OnRyaWdnZXJFbmFibGUoZG91YmxlKVcabWF4aUxpbmU6OmlzTGluZUNvbXBsZXRlKClYRnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlYRmFkZT4obWF4aVhGYWRlKilZhwRlbXNjcmlwdGVuOjppbnRlcm5hbDo6SW52b2tlcjxzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4sIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGRvdWJsZT46Omludm9rZShzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4gKCopKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGRvdWJsZSksIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiosIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiosIGRvdWJsZSlaigFtYXhpWEZhZGU6OnhmYWRlKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGRvdWJsZSlbgQFlbXNjcmlwdGVuOjppbnRlcm5hbDo6SW52b2tlcjxkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGU+OjppbnZva2UoZG91YmxlICgqKShkb3VibGUsIGRvdWJsZSwgZG91YmxlKSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSlcKG1heGlYRmFkZTo6eGZhZGUoZG91YmxlLCBkb3VibGUsIGRvdWJsZSldWXZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlMYWdFeHA8ZG91YmxlPiA+KG1heGlMYWdFeHA8ZG91YmxlPiopXk1tYXhpTGFnRXhwPGRvdWJsZT4qIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aUxhZ0V4cDxkb3VibGU+ID4oKV8obWF4aUxhZ0V4cDxkb3VibGU+Ojppbml0KGRvdWJsZSwgZG91YmxlKWDeAWVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKG1heGlMYWdFeHA8ZG91YmxlPjo6KikoZG91YmxlLCBkb3VibGUpLCB2b2lkLCBtYXhpTGFnRXhwPGRvdWJsZT4qLCBkb3VibGUsIGRvdWJsZT46Omludm9rZSh2b2lkIChtYXhpTGFnRXhwPGRvdWJsZT46OiogY29uc3QmKShkb3VibGUsIGRvdWJsZSksIG1heGlMYWdFeHA8ZG91YmxlPiosIGRvdWJsZSwgZG91YmxlKWElbWF4aUxhZ0V4cDxkb3VibGU+OjphZGRTYW1wbGUoZG91YmxlKWIhbWF4aUxhZ0V4cDxkb3VibGU+Ojp2YWx1ZSgpIGNvbnN0YyRtYXhpTGFnRXhwPGRvdWJsZT46OmdldEFscGhhKCkgY29uc3RkJG1heGlMYWdFeHA8ZG91YmxlPjo6c2V0QWxwaGEoZG91YmxlKWUubWF4aUxhZ0V4cDxkb3VibGU+OjpnZXRBbHBoYVJlY2lwcm9jYWwoKSBjb25zdGYubWF4aUxhZ0V4cDxkb3VibGU+OjpzZXRBbHBoYVJlY2lwcm9jYWwoZG91YmxlKWcibWF4aUxhZ0V4cDxkb3VibGU+OjpzZXRWYWwoZG91YmxlKWhIdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aVNhbXBsZT4obWF4aVNhbXBsZSopaUJ2b2lkIGVtc2NyaXB0ZW46OmludGVybmFsOjpyYXdfZGVzdHJ1Y3RvcjxtYXhpU2FtcGxlPihtYXhpU2FtcGxlKilqPG1heGlTYW1wbGUqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aVNhbXBsZT4oKWsdbWF4aVNhbXBsZTo6Z2V0TGVuZ3RoKCkgY29uc3Rs9gJlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChtYXhpU2FtcGxlOjoqKShzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBpbnQpLCB2b2lkLCBtYXhpU2FtcGxlKiwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgaW50Pjo6aW52b2tlKHZvaWQgKG1heGlTYW1wbGU6OiogY29uc3QmKShzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBpbnQpLCBtYXhpU2FtcGxlKiwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KiwgaW50KW2rA2Vtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGludCAobWF4aVNhbXBsZTo6Kikoc3RkOjpfXzI6OnZlY3Rvcjx1bnNpZ25lZCBjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHVuc2lnbmVkIGNoYXI+ID4mLCBpbnQpLCBpbnQsIG1heGlTYW1wbGUqLCBzdGQ6Ol9fMjo6dmVjdG9yPHVuc2lnbmVkIGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8dW5zaWduZWQgY2hhcj4gPiYsIGludD46Omludm9rZShpbnQgKG1heGlTYW1wbGU6OiogY29uc3QmKShzdGQ6Ol9fMjo6dmVjdG9yPHVuc2lnbmVkIGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8dW5zaWduZWQgY2hhcj4gPiYsIGludCksIG1heGlTYW1wbGUqLCBzdGQ6Ol9fMjo6dmVjdG9yPHVuc2lnbmVkIGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8dW5zaWduZWQgY2hhcj4gPiosIGludCluxAFlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlTYW1wbGU6OiopKGRvdWJsZSwgZG91YmxlKSwgZG91YmxlLCBtYXhpU2FtcGxlKiwgZG91YmxlLCBkb3VibGU+OjppbnZva2UoZG91YmxlIChtYXhpU2FtcGxlOjoqIGNvbnN0JikoZG91YmxlLCBkb3VibGUpLCBtYXhpU2FtcGxlKiwgZG91YmxlLCBkb3VibGUpb+QBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpU2FtcGxlOjoqKShkb3VibGUsIGRvdWJsZSwgZG91YmxlKSwgZG91YmxlLCBtYXhpU2FtcGxlKiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZT46Omludm9rZShkb3VibGUgKG1heGlTYW1wbGU6OiogY29uc3QmKShkb3VibGUsIGRvdWJsZSwgZG91YmxlKSwgbWF4aVNhbXBsZSosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUpcIIBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAobWF4aVNhbXBsZTo6KikoKSwgdm9pZCwgbWF4aVNhbXBsZSo+OjppbnZva2Uodm9pZCAobWF4aVNhbXBsZTo6KiBjb25zdCYpKCksIG1heGlTYW1wbGUqKXETbWF4aVNhbXBsZTo6Y2xlYXIoKXLmAWVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKG1heGlTYW1wbGU6OiopKGZsb2F0LCBmbG9hdCwgYm9vbCwgYm9vbCksIHZvaWQsIG1heGlTYW1wbGUqLCBmbG9hdCwgZmxvYXQsIGJvb2wsIGJvb2w+OjppbnZva2Uodm9pZCAobWF4aVNhbXBsZTo6KiBjb25zdCYpKGZsb2F0LCBmbG9hdCwgYm9vbCwgYm9vbCksIG1heGlTYW1wbGUqLCBmbG9hdCwgZmxvYXQsIGJvb2wsIGJvb2wpc6MEZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8Ym9vbCAobWF4aVNhbXBsZTo6Kikoc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiwgaW50KSwgYm9vbCwgbWF4aVNhbXBsZSosIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4sIGludD46Omludm9rZShib29sIChtYXhpU2FtcGxlOjoqIGNvbnN0Jikoc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiwgaW50KSwgbWF4aVNhbXBsZSosIGVtc2NyaXB0ZW46OmludGVybmFsOjpCaW5kaW5nVHlwZTxzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+LCB2b2lkPjo6J3VubmFtZWQnKiwgaW50KXRCdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aUR5bj4obWF4aUR5biopdTZtYXhpRHluKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlEeW4+KCl2kAJlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlEeW46OiopKGRvdWJsZSwgZG91YmxlLCBsb25nLCBkb3VibGUsIGRvdWJsZSksIGRvdWJsZSwgbWF4aUR5biosIGRvdWJsZSwgZG91YmxlLCBsb25nLCBkb3VibGUsIGRvdWJsZT46Omludm9rZShkb3VibGUgKG1heGlEeW46OiogY29uc3QmKShkb3VibGUsIGRvdWJsZSwgbG9uZywgZG91YmxlLCBkb3VibGUpLCBtYXhpRHluKiwgZG91YmxlLCBkb3VibGUsIGxvbmcsIGRvdWJsZSwgZG91YmxlKXeYAmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aUR5bjo6KikoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUpLCBkb3VibGUsIG1heGlEeW4qLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZT46Omludm9rZShkb3VibGUgKG1heGlEeW46OiogY29uc3QmKShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSksIG1heGlEeW4qLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSl4QnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlFbnY+KG1heGlFbnYqKXk2bWF4aUVudiogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpRW52PigpeoQCZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpRW52OjoqKShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBsb25nLCBpbnQpLCBkb3VibGUsIG1heGlFbnYqLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBsb25nLCBpbnQ+OjppbnZva2UoZG91YmxlIChtYXhpRW52OjoqIGNvbnN0JikoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgbG9uZywgaW50KSwgbWF4aUVudiosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGxvbmcsIGludCl7xAJlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlFbnY6OiopKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBsb25nLCBpbnQpLCBkb3VibGUsIG1heGlFbnYqLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgbG9uZywgaW50Pjo6aW52b2tlKGRvdWJsZSAobWF4aUVudjo6KiBjb25zdCYpKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBsb25nLCBpbnQpLCBtYXhpRW52KiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGxvbmcsIGludCl8rAFlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlFbnY6OiopKGRvdWJsZSwgaW50KSwgZG91YmxlLCBtYXhpRW52KiwgZG91YmxlLCBpbnQ+OjppbnZva2UoZG91YmxlIChtYXhpRW52OjoqIGNvbnN0JikoZG91YmxlLCBpbnQpLCBtYXhpRW52KiwgZG91YmxlLCBpbnQpfRttYXhpRW52OjpnZXRUcmlnZ2VyKCkgY29uc3R+GG1heGlFbnY6OnNldFRyaWdnZXIoaW50KX9Cdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8Y29udmVydD4oY29udmVydCopgAFiZW1zY3JpcHRlbjo6aW50ZXJuYWw6OkZ1bmN0aW9uSW52b2tlcjxkb3VibGUgKCopKGludCksIGRvdWJsZSwgaW50Pjo6aW52b2tlKGRvdWJsZSAoKiopKGludCksIGludCmBAUhlbXNjcmlwdGVuOjppbnRlcm5hbDo6SW52b2tlcjxkb3VibGUsIGludD46Omludm9rZShkb3VibGUgKCopKGludCksIGludCmCARpjb252ZXJ0Ojptc1RvU2FtcHMoZG91YmxlKYMBbmVtc2NyaXB0ZW46OmludGVybmFsOjpGdW5jdGlvbkludm9rZXI8ZG91YmxlICgqKShkb3VibGUpLCBkb3VibGUsIGRvdWJsZT46Omludm9rZShkb3VibGUgKCoqKShkb3VibGUpLCBkb3VibGUphAFRZW1zY3JpcHRlbjo6aW50ZXJuYWw6Okludm9rZXI8ZG91YmxlLCBkb3VibGU+OjppbnZva2UoZG91YmxlICgqKShkb3VibGUpLCBkb3VibGUphQFWdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aVNhbXBsZUFuZEhvbGQ+KG1heGlTYW1wbGVBbmRIb2xkKimGAUptYXhpU2FtcGxlQW5kSG9sZCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpU2FtcGxlQW5kSG9sZD4oKYcBJm1heGlTYW1wbGVBbmRIb2xkOjpzYWgoZG91YmxlLCBkb3VibGUpiAFKdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aUZsYW5nZXI+KG1heGlGbGFuZ2VyKimJAT5tYXhpRmxhbmdlciogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpRmxhbmdlcj4oKYoBQW1heGlGbGFuZ2VyOjpmbGFuZ2UoZG91YmxlLCB1bnNpZ25lZCBpbnQsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUpiwHAAmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aUZsYW5nZXI6OiopKGRvdWJsZSwgdW5zaWduZWQgaW50LCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKSwgZG91YmxlLCBtYXhpRmxhbmdlciosIGRvdWJsZSwgdW5zaWduZWQgaW50LCBkb3VibGUsIGRvdWJsZSwgZG91YmxlPjo6aW52b2tlKGRvdWJsZSAobWF4aUZsYW5nZXI6OiogY29uc3QmKShkb3VibGUsIHVuc2lnbmVkIGludCwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSksIG1heGlGbGFuZ2VyKiwgZG91YmxlLCB1bnNpZ25lZCBpbnQsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUpjAFIdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aUNob3J1cz4obWF4aUNob3J1cyopjQE8bWF4aUNob3J1cyogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpQ2hvcnVzPigpjgFAbWF4aUNob3J1czo6Y2hvcnVzKGRvdWJsZSwgdW5zaWduZWQgaW50LCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKY8BTnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlEQ0Jsb2NrZXI+KG1heGlEQ0Jsb2NrZXIqKZABQm1heGlEQ0Jsb2NrZXIqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aURDQmxvY2tlcj4oKZEBI21heGlEQ0Jsb2NrZXI6OnBsYXkoZG91YmxlLCBkb3VibGUpkgFCdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aVNWRj4obWF4aVNWRiopkwE2bWF4aVNWRiogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpU1ZGPigplAEabWF4aVNWRjo6c2V0Q3V0b2ZmKGRvdWJsZSmVAR1tYXhpU1ZGOjpzZXRSZXNvbmFuY2UoZG91YmxlKZYBNW1heGlTVkY6OnBsYXkoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUplwFEdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aU1hdGg+KG1heGlNYXRoKimYAWllbXNjcmlwdGVuOjppbnRlcm5hbDo6SW52b2tlcjxkb3VibGUsIGRvdWJsZSwgZG91YmxlPjo6aW52b2tlKGRvdWJsZSAoKikoZG91YmxlLCBkb3VibGUpLCBkb3VibGUsIGRvdWJsZSmZAR1tYXhpTWF0aDo6YWRkKGRvdWJsZSwgZG91YmxlKZoBHW1heGlNYXRoOjpzdWIoZG91YmxlLCBkb3VibGUpmwEdbWF4aU1hdGg6Om11bChkb3VibGUsIGRvdWJsZSmcAR1tYXhpTWF0aDo6ZGl2KGRvdWJsZSwgZG91YmxlKZ0BHG1heGlNYXRoOjpndChkb3VibGUsIGRvdWJsZSmeARxtYXhpTWF0aDo6bHQoZG91YmxlLCBkb3VibGUpnwEdbWF4aU1hdGg6Omd0ZShkb3VibGUsIGRvdWJsZSmgAR1tYXhpTWF0aDo6bHRlKGRvdWJsZSwgZG91YmxlKaEBHW1heGlNYXRoOjptb2QoZG91YmxlLCBkb3VibGUpogEVbWF4aU1hdGg6OmFicyhkb3VibGUpowEfbWF4aU1hdGg6Onhwb3d5KGRvdWJsZSwgZG91YmxlKaQBRnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlDbG9jaz4obWF4aUNsb2NrKimlATptYXhpQ2xvY2sqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aUNsb2NrPigppgEZbWF4aUNsb2NrOjppc1RpY2soKSBjb25zdKcBIm1heGlDbG9jazo6Z2V0Q3VycmVudENvdW50KCkgY29uc3SoAR9tYXhpQ2xvY2s6OnNldEN1cnJlbnRDb3VudChpbnQpqQEfbWF4aUNsb2NrOjpnZXRMYXN0Q291bnQoKSBjb25zdKoBHG1heGlDbG9jazo6c2V0TGFzdENvdW50KGludCmrARltYXhpQ2xvY2s6OmdldEJwcygpIGNvbnN0rAEWbWF4aUNsb2NrOjpzZXRCcHMoaW50Ka0BGW1heGlDbG9jazo6Z2V0QnBtKCkgY29uc3SuARZtYXhpQ2xvY2s6OnNldEJwbShpbnQprwEXbWF4aUNsb2NrOjpzZXRUaWNrKGludCmwARttYXhpQ2xvY2s6OmdldFRpY2tzKCkgY29uc3SxARhtYXhpQ2xvY2s6OnNldFRpY2tzKGludCmyAWB2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yPihtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yKimzAVRtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlLdXJhbW90b09zY2lsbGF0b3I+KCm0AWRtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yOjpwbGF5KGRvdWJsZSwgZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4ptQHWA2Vtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aUt1cmFtb3RvT3NjaWxsYXRvcjo6KikoZG91YmxlLCBkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiksIGRvdWJsZSwgbWF4aUt1cmFtb3RvT3NjaWxsYXRvciosIGRvdWJsZSwgZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4gPjo6aW52b2tlKGRvdWJsZSAobWF4aUt1cmFtb3RvT3NjaWxsYXRvcjo6KiBjb25zdCYpKGRvdWJsZSwgZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4pLCBtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yKiwgZG91YmxlLCBkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPioptgFmdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldD4obWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldCoptwFgdm9pZCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6cmF3X2Rlc3RydWN0b3I8bWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldD4obWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldCopuAGeAWVtc2NyaXB0ZW46OmludGVybmFsOjpJbnZva2VyPG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQqLCB1bnNpZ25lZCBsb25nIGNvbnN0JiY+OjppbnZva2UobWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldCogKCopKHVuc2lnbmVkIGxvbmcgY29uc3QmJiksIHVuc2lnbmVkIGxvbmcpuQGEAW1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldCwgdW5zaWduZWQgbG9uZyBjb25zdD4odW5zaWduZWQgbG9uZyBjb25zdCYmKboBL21heGlLdXJhbW90b09zY2lsbGF0b3JTZXQ6OnBsYXkoZG91YmxlLCBkb3VibGUpuwE6bWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldDo6c2V0UGhhc2UoZG91YmxlLCB1bnNpZ25lZCBsb25nKbwBlgJlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0OjoqKShkb3VibGUsIHVuc2lnbmVkIGxvbmcpLCB2b2lkLCBtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0KiwgZG91YmxlLCB1bnNpZ25lZCBsb25nPjo6aW52b2tlKHZvaWQgKG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQ6OiogY29uc3QmKShkb3VibGUsIHVuc2lnbmVkIGxvbmcpLCBtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0KiwgZG91YmxlLCB1bnNpZ25lZCBsb25nKb0BY21heGlLdXJhbW90b09zY2lsbGF0b3JTZXQ6OnNldFBoYXNlcyhzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4gY29uc3QmKb4BMm1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQ6OmdldFBoYXNlKHVuc2lnbmVkIGxvbmcpvwH8AWVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldDo6KikodW5zaWduZWQgbG9uZyksIGRvdWJsZSwgbWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldCosIHVuc2lnbmVkIGxvbmc+OjppbnZva2UoZG91YmxlIChtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0OjoqIGNvbnN0JikodW5zaWduZWQgbG9uZyksIG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQqLCB1bnNpZ25lZCBsb25nKcABIW1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQ6OnNpemUoKcEBanZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlBc3luY0t1cmFtb3RvT3NjaWxsYXRvcj4obWF4aUFzeW5jS3VyYW1vdG9Pc2NpbGxhdG9yKinCAawBbWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldCogZW1zY3JpcHRlbjo6YmFzZTxtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0Pjo6Y29udmVydFBvaW50ZXI8bWF4aUFzeW5jS3VyYW1vdG9Pc2NpbGxhdG9yLCBtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0PihtYXhpQXN5bmNLdXJhbW90b09zY2lsbGF0b3IqKcMBiAFtYXhpQXN5bmNLdXJhbW90b09zY2lsbGF0b3IqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aUFzeW5jS3VyYW1vdG9Pc2NpbGxhdG9yLCB1bnNpZ25lZCBsb25nIGNvbnN0Pih1bnNpZ25lZCBsb25nIGNvbnN0JiYpxAExbWF4aUFzeW5jS3VyYW1vdG9Pc2NpbGxhdG9yOjpwbGF5KGRvdWJsZSwgZG91YmxlKcUBPG1heGlBc3luY0t1cmFtb3RvT3NjaWxsYXRvcjo6c2V0UGhhc2UoZG91YmxlLCB1bnNpZ25lZCBsb25nKcYBZW1heGlBc3luY0t1cmFtb3RvT3NjaWxsYXRvcjo6c2V0UGhhc2VzKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiBjb25zdCYpxwFCdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aUZGVD4obWF4aUZGVCopyAE8dm9pZCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6cmF3X2Rlc3RydWN0b3I8bWF4aUZGVD4obWF4aUZGVCopyQE2bWF4aUZGVCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpRkZUPigpygGuAWVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKG1heGlGRlQ6OiopKGludCwgaW50LCBpbnQpLCB2b2lkLCBtYXhpRkZUKiwgaW50LCBpbnQsIGludD46Omludm9rZSh2b2lkIChtYXhpRkZUOjoqIGNvbnN0JikoaW50LCBpbnQsIGludCksIG1heGlGRlQqLCBpbnQsIGludCwgaW50KcsB2gFlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxib29sIChtYXhpRkZUOjoqKShmbG9hdCwgbWF4aUZGVDo6ZmZ0TW9kZXMpLCBib29sLCBtYXhpRkZUKiwgZmxvYXQsIG1heGlGRlQ6OmZmdE1vZGVzPjo6aW52b2tlKGJvb2wgKG1heGlGRlQ6OiogY29uc3QmKShmbG9hdCwgbWF4aUZGVDo6ZmZ0TW9kZXMpLCBtYXhpRkZUKiwgZmxvYXQsIG1heGlGRlQ6OmZmdE1vZGVzKcwBeWVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGZsb2F0IChtYXhpRkZUOjoqKSgpLCBmbG9hdCwgbWF4aUZGVCo+OjppbnZva2UoZmxvYXQgKG1heGlGRlQ6OiogY29uc3QmKSgpLCBtYXhpRkZUKinNAYkCZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8c3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiYgKG1heGlGRlQ6OiopKCksIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mLCBtYXhpRkZUKj46Omludm9rZShzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+JiAobWF4aUZGVDo6KiBjb25zdCYpKCksIG1heGlGRlQqKc4BGm1heGlGRlQ6OmdldE1hZ25pdHVkZXNEQigpzwEUbWF4aUZGVDo6Z2V0UGhhc2VzKCnQARVtYXhpRkZUOjpnZXROdW1CaW5zKCnRARVtYXhpRkZUOjpnZXRGRlRTaXplKCnSARVtYXhpRkZUOjpnZXRIb3BTaXplKCnTARhtYXhpRkZUOjpnZXRXaW5kb3dTaXplKCnUAUR2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpSUZGVD4obWF4aUlGRlQqKdUBPnZvaWQgZW1zY3JpcHRlbjo6aW50ZXJuYWw6OnJhd19kZXN0cnVjdG9yPG1heGlJRkZUPihtYXhpSUZGVCop1gE4bWF4aUlGRlQqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aUlGRlQ+KCnXAYEFZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZmxvYXQgKG1heGlJRkZUOjoqKShzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+Jiwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiYsIG1heGlJRkZUOjpmZnRNb2RlcyksIGZsb2F0LCBtYXhpSUZGVCosIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mLCBzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+JiwgbWF4aUlGRlQ6OmZmdE1vZGVzPjo6aW52b2tlKGZsb2F0IChtYXhpSUZGVDo6KiBjb25zdCYpKHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mLCBzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+JiwgbWF4aUlGRlQ6OmZmdE1vZGVzKSwgbWF4aUlGRlQqLCBzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+Kiwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiosIG1heGlJRkZUOjpmZnRNb2RlcynYAWV2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpTUZDQ0FuYWx5c2VyPGRvdWJsZT4gPihtYXhpTUZDQ0FuYWx5c2VyPGRvdWJsZT4qKdkBX3ZvaWQgZW1zY3JpcHRlbjo6aW50ZXJuYWw6OnJhd19kZXN0cnVjdG9yPG1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPiA+KG1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPiop2gFZbWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPiA+KCnbAVltYXhpTUZDQ0FuYWx5c2VyPGRvdWJsZT46OnNldHVwKHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQsIGRvdWJsZSwgZG91YmxlKdwBngNlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChtYXhpTUZDQ0FuYWx5c2VyPGRvdWJsZT46OiopKHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQsIGRvdWJsZSwgZG91YmxlKSwgdm9pZCwgbWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+KiwgdW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgZG91YmxlLCBkb3VibGU+OjppbnZva2Uodm9pZCAobWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+OjoqIGNvbnN0JikodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgZG91YmxlLCBkb3VibGUpLCBtYXhpTUZDQ0FuYWx5c2VyPGRvdWJsZT4qLCB1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50LCBkb3VibGUsIGRvdWJsZSndAVVtYXhpTUZDQ0FuYWx5c2VyPGRvdWJsZT46Om1mY2Moc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiYp3gGrBGVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYgKG1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPjo6Kikoc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiYpLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBtYXhpTUZDQ0FuYWx5c2VyPGRvdWJsZT4qLCBzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+Jj46Omludm9rZShzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mIChtYXhpTUZDQ0FuYWx5c2VyPGRvdWJsZT46OiogY29uc3QmKShzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+JiksIG1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPiosIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4qKd8BlQF2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4gPihzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4qKeABjwF2b2lkIGVtc2NyaXB0ZW46OmludGVybmFsOjpyYXdfZGVzdHJ1Y3RvcjxzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4gPihzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4qKeEBiQFzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4qIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8c3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+ID4oKeIBR3N0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPjo6cHVzaF9iYWNrKGludCBjb25zdCYp4wG/AmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPjo6KikoaW50IGNvbnN0JiksIHZvaWQsIHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiosIGludCBjb25zdCY+OjppbnZva2Uodm9pZCAoc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+OjoqIGNvbnN0JikoaW50IGNvbnN0JiksIHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiosIGludCnkAVNzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID46OnJlc2l6ZSh1bnNpZ25lZCBsb25nLCBpbnQgY29uc3QmKeUB+wJlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID46OiopKHVuc2lnbmVkIGxvbmcsIGludCBjb25zdCYpLCB2b2lkLCBzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4qLCB1bnNpZ25lZCBsb25nLCBpbnQgY29uc3QmPjo6aW52b2tlKHZvaWQgKHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPjo6KiBjb25zdCYpKHVuc2lnbmVkIGxvbmcsIGludCBjb25zdCYpLCBzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4qLCB1bnNpZ25lZCBsb25nLCBpbnQp5gE+c3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+OjpzaXplKCkgY29uc3TnAaIBZW1zY3JpcHRlbjo6aW50ZXJuYWw6OlZlY3RvckFjY2VzczxzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4gPjo6Z2V0KHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiBjb25zdCYsIHVuc2lnbmVkIGxvbmcp6AGDA2Vtc2NyaXB0ZW46OmludGVybmFsOjpGdW5jdGlvbkludm9rZXI8ZW1zY3JpcHRlbjo6dmFsICgqKShzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4gY29uc3QmLCB1bnNpZ25lZCBsb25nKSwgZW1zY3JpcHRlbjo6dmFsLCBzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4gY29uc3QmLCB1bnNpZ25lZCBsb25nPjo6aW52b2tlKGVtc2NyaXB0ZW46OnZhbCAoKiopKHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiBjb25zdCYsIHVuc2lnbmVkIGxvbmcpLCBzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4qLCB1bnNpZ25lZCBsb25nKekBqAFlbXNjcmlwdGVuOjppbnRlcm5hbDo6VmVjdG9yQWNjZXNzPHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiA+OjpzZXQoc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+JiwgdW5zaWduZWQgbG9uZywgaW50IGNvbnN0JinqAfkCZW1zY3JpcHRlbjo6aW50ZXJuYWw6OkZ1bmN0aW9uSW52b2tlcjxib29sICgqKShzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4mLCB1bnNpZ25lZCBsb25nLCBpbnQgY29uc3QmKSwgYm9vbCwgc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+JiwgdW5zaWduZWQgbG9uZywgaW50IGNvbnN0Jj46Omludm9rZShib29sICgqKikoc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+JiwgdW5zaWduZWQgbG9uZywgaW50IGNvbnN0JiksIHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiosIHVuc2lnbmVkIGxvbmcsIGludCnrAaEBdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8c3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+ID4oc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KinsAVBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID46OnB1c2hfYmFjayhkb3VibGUgY29uc3QmKe0B4wJlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID46OiopKGRvdWJsZSBjb25zdCYpLCB2b2lkLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4qLCBkb3VibGUgY29uc3QmPjo6aW52b2tlKHZvaWQgKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPjo6KiBjb25zdCYpKGRvdWJsZSBjb25zdCYpLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4qLCBkb3VibGUp7gFcc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+OjpyZXNpemUodW5zaWduZWQgbG9uZywgZG91YmxlIGNvbnN0JinvAZ8DZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+OjoqKSh1bnNpZ25lZCBsb25nLCBkb3VibGUgY29uc3QmKSwgdm9pZCwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KiwgdW5zaWduZWQgbG9uZywgZG91YmxlIGNvbnN0Jj46Omludm9rZSh2b2lkIChzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID46OiogY29uc3QmKSh1bnNpZ25lZCBsb25nLCBkb3VibGUgY29uc3QmKSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KiwgdW5zaWduZWQgbG9uZywgZG91YmxlKfABRHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPjo6c2l6ZSgpIGNvbnN08QGuAWVtc2NyaXB0ZW46OmludGVybmFsOjpWZWN0b3JBY2Nlc3M8c3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+ID46OmdldChzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4gY29uc3QmLCB1bnNpZ25lZCBsb25nKfIBtwFlbXNjcmlwdGVuOjppbnRlcm5hbDo6VmVjdG9yQWNjZXNzPHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiA+OjpzZXQoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgdW5zaWduZWQgbG9uZywgZG91YmxlIGNvbnN0JinzAZ0DZW1zY3JpcHRlbjo6aW50ZXJuYWw6OkZ1bmN0aW9uSW52b2tlcjxib29sICgqKShzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCB1bnNpZ25lZCBsb25nLCBkb3VibGUgY29uc3QmKSwgYm9vbCwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgdW5zaWduZWQgbG9uZywgZG91YmxlIGNvbnN0Jj46Omludm9rZShib29sICgqKikoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgdW5zaWduZWQgbG9uZywgZG91YmxlIGNvbnN0JiksIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiosIHVuc2lnbmVkIGxvbmcsIGRvdWJsZSn0AZkBdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8c3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gPihzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiop9QFKc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OnB1c2hfYmFjayhjaGFyIGNvbnN0Jin2AcsCZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAoc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OiopKGNoYXIgY29uc3QmKSwgdm9pZCwgc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4qLCBjaGFyIGNvbnN0Jj46Omludm9rZSh2b2lkIChzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6KiBjb25zdCYpKGNoYXIgY29uc3QmKSwgc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4qLCBjaGFyKfcBVnN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpyZXNpemUodW5zaWduZWQgbG9uZywgY2hhciBjb25zdCYp+AGHA2Vtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjoqKSh1bnNpZ25lZCBsb25nLCBjaGFyIGNvbnN0JiksIHZvaWQsIHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+KiwgdW5zaWduZWQgbG9uZywgY2hhciBjb25zdCY+OjppbnZva2Uodm9pZCAoc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OiogY29uc3QmKSh1bnNpZ25lZCBsb25nLCBjaGFyIGNvbnN0JiksIHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+KiwgdW5zaWduZWQgbG9uZywgY2hhcin5AUBzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6c2l6ZSgpIGNvbnN0+gGmAWVtc2NyaXB0ZW46OmludGVybmFsOjpWZWN0b3JBY2Nlc3M8c3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gPjo6Z2V0KHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0JiwgdW5zaWduZWQgbG9uZyn7Aa0BZW1zY3JpcHRlbjo6aW50ZXJuYWw6OlZlY3RvckFjY2VzczxzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiA+OjpzZXQoc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4mLCB1bnNpZ25lZCBsb25nLCBjaGFyIGNvbnN0Jin8AYUDZW1zY3JpcHRlbjo6aW50ZXJuYWw6OkZ1bmN0aW9uSW52b2tlcjxib29sICgqKShzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiYsIHVuc2lnbmVkIGxvbmcsIGNoYXIgY29uc3QmKSwgYm9vbCwgc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4mLCB1bnNpZ25lZCBsb25nLCBjaGFyIGNvbnN0Jj46Omludm9rZShib29sICgqKikoc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4mLCB1bnNpZ25lZCBsb25nLCBjaGFyIGNvbnN0JiksIHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+KiwgdW5zaWduZWQgbG9uZywgY2hhcin9Ab0Bdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8c3RkOjpfXzI6OnZlY3Rvcjx1bnNpZ25lZCBjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHVuc2lnbmVkIGNoYXI+ID4gPihzdGQ6Ol9fMjo6dmVjdG9yPHVuc2lnbmVkIGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8dW5zaWduZWQgY2hhcj4gPiop/gHKAWVtc2NyaXB0ZW46OmludGVybmFsOjpWZWN0b3JBY2Nlc3M8c3RkOjpfXzI6OnZlY3Rvcjx1bnNpZ25lZCBjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHVuc2lnbmVkIGNoYXI+ID4gPjo6Z2V0KHN0ZDo6X18yOjp2ZWN0b3I8dW5zaWduZWQgY2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjx1bnNpZ25lZCBjaGFyPiA+IGNvbnN0JiwgdW5zaWduZWQgbG9uZyn/AZ0Bdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8c3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiA+KHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4qKYAC1wJlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+OjoqKShmbG9hdCBjb25zdCYpLCB2b2lkLCBzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+KiwgZmxvYXQgY29uc3QmPjo6aW52b2tlKHZvaWQgKHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID46OiogY29uc3QmKShmbG9hdCBjb25zdCYpLCBzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+KiwgZmxvYXQpgQKTA2Vtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID46OiopKHVuc2lnbmVkIGxvbmcsIGZsb2F0IGNvbnN0JiksIHZvaWQsIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4qLCB1bnNpZ25lZCBsb25nLCBmbG9hdCBjb25zdCY+OjppbnZva2Uodm9pZCAoc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPjo6KiBjb25zdCYpKHVuc2lnbmVkIGxvbmcsIGZsb2F0IGNvbnN0JiksIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4qLCB1bnNpZ25lZCBsb25nLCBmbG9hdCmCAqoBZW1zY3JpcHRlbjo6aW50ZXJuYWw6OlZlY3RvckFjY2VzczxzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+ID46OmdldChzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+IGNvbnN0JiwgdW5zaWduZWQgbG9uZymDApEDZW1zY3JpcHRlbjo6aW50ZXJuYWw6OkZ1bmN0aW9uSW52b2tlcjxib29sICgqKShzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+JiwgdW5zaWduZWQgbG9uZywgZmxvYXQgY29uc3QmKSwgYm9vbCwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiYsIHVuc2lnbmVkIGxvbmcsIGZsb2F0IGNvbnN0Jj46Omludm9rZShib29sICgqKikoc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiYsIHVuc2lnbmVkIGxvbmcsIGZsb2F0IGNvbnN0JiksIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4qLCB1bnNpZ25lZCBsb25nLCBmbG9hdCmEAl5zdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID46Ol9fYXBwZW5kKHVuc2lnbmVkIGxvbmcsIGRvdWJsZSBjb25zdCYphQI4bWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+OjpjYWxjTWVsRmlsdGVyQmFuayhkb3VibGUsIGludCmGAmZFbXNjcmlwdGVuQmluZGluZ0luaXRpYWxpemVyX215X21vZHVsZV9tYXhpR3JhaW5zOjpFbXNjcmlwdGVuQmluZGluZ0luaXRpYWxpemVyX215X21vZHVsZV9tYXhpR3JhaW5zKCmHAnN2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4obWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiopiAJtdm9pZCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6cmF3X2Rlc3RydWN0b3I8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+KG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qKYkCmAFlbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46OmdldChzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gY29uc3QmKYoCZmVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6Y29uc3RydWN0X251bGwoKYsCnQFlbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46OnNoYXJlKG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qLCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6X0VNX1ZBTCopjAKbAXZvaWQgZW1zY3JpcHRlbjo6aW50ZXJuYWw6OnJhd19kZXN0cnVjdG9yPHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+KHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiopjQKcAWVtc2NyaXB0ZW46OmludGVybmFsOjpJbnZva2VyPHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+OjppbnZva2Uoc3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ICgqKSgpKY4CwgFzdGQ6Ol9fMjo6ZW5hYmxlX2lmPCEoaXNfYXJyYXk8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+Ojp2YWx1ZSksIHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp0eXBlIHN0ZDo6X18yOjptYWtlX3NoYXJlZDxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4oKY8CN21heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OnNldFNhbXBsZShtYXhpU2FtcGxlKimQAjhtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+OjpnZXROb3JtYWxpc2VkUG9zaXRpb24oKZECNG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OnNldFBvc2l0aW9uKGRvdWJsZSmSAkJtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+OjpwbGF5KGRvdWJsZSwgZG91YmxlLCBpbnQsIGRvdWJsZSmTAswCZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+OjoqKShkb3VibGUsIGRvdWJsZSwgaW50LCBkb3VibGUpLCBkb3VibGUsIG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qLCBkb3VibGUsIGRvdWJsZSwgaW50LCBkb3VibGU+OjppbnZva2UoZG91YmxlIChtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+OjoqIGNvbnN0JikoZG91YmxlLCBkb3VibGUsIGludCwgZG91YmxlKSwgbWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGRvdWJsZSwgZG91YmxlLCBpbnQsIGRvdWJsZSmUAkRtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+OjpwbGF5QXRQb3NpdGlvbihkb3VibGUsIGRvdWJsZSwgaW50KZUCrAJlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OiopKGRvdWJsZSwgZG91YmxlLCBpbnQpLCBkb3VibGUsIG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qLCBkb3VibGUsIGRvdWJsZSwgaW50Pjo6aW52b2tlKGRvdWJsZSAobWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6KiBjb25zdCYpKGRvdWJsZSwgZG91YmxlLCBpbnQpLCBtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KiwgZG91YmxlLCBkb3VibGUsIGludCmWAnF2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPihtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4qKZcCa3ZvaWQgZW1zY3JpcHRlbjo6aW50ZXJuYWw6OnJhd19kZXN0cnVjdG9yPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+KG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiopmAKbAWVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPiA+OjpzaGFyZShtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4qLCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6X0VNX1ZBTCopmQK/AXN0ZDo6X18yOjplbmFibGVfaWY8IShpc19hcnJheTxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPjo6dmFsdWUpLCBzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp0eXBlIHN0ZDo6X18yOjptYWtlX3NoYXJlZDxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPigpmgI2bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+OjpzZXRTYW1wbGUobWF4aVNhbXBsZSopmwJBbWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+OjpwbGF5KGRvdWJsZSwgZG91YmxlLCBpbnQsIGRvdWJsZSmcAmt2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPihtYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qKZ0CX21heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPigpngIzbWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+OjpzZXRTYW1wbGUobWF4aVNhbXBsZSopnwIxbWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+OjpzZXRMb29wU3RhcnQoZG91YmxlKaACL21heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6c2V0TG9vcEVuZChkb3VibGUpoQIpbWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+OjpnZXRMb29wRW5kKCmiAkZtYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OnBsYXkoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgaW50LCBkb3VibGUpowLcAmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+OjoqKShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBpbnQsIGRvdWJsZSksIGRvdWJsZSwgbWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgaW50LCBkb3VibGU+OjppbnZva2UoZG91YmxlIChtYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OiogY29uc3QmKShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBpbnQsIGRvdWJsZSksIG1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGludCwgZG91YmxlKaQCSG1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6cGxheUF0UG9zaXRpb24oZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgaW50KaUCvAJlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6KikoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgaW50KSwgZG91YmxlLCBtYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBpbnQ+OjppbnZva2UoZG91YmxlIChtYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OiogY29uc3QmKShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBpbnQpLCBtYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBpbnQppgJwbWF4aUdyYWluPGhhbm5XaW5GdW5jdG9yPjo6bWF4aUdyYWluKG1heGlTYW1wbGUqLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBtYXhpR3JhaW5XaW5kb3dDYWNoZTxoYW5uV2luRnVuY3Rvcj4qKacCYkVtc2NyaXB0ZW5CaW5kaW5nSW5pdGlhbGl6ZXJfbXlfbW9kdWxlX21heGliaXRzOjpFbXNjcmlwdGVuQmluZGluZ0luaXRpYWxpemVyX215X21vZHVsZV9tYXhpYml0cygpqAJEdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aUJpdHM+KG1heGlCaXRzKimpAm9lbXNjcmlwdGVuOjppbnRlcm5hbDo6SW52b2tlcjx1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludD46Omludm9rZSh1bnNpZ25lZCBpbnQgKCopKHVuc2lnbmVkIGludCksIHVuc2lnbmVkIGludCmqApkBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Okludm9rZXI8dW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludD46Omludm9rZSh1bnNpZ25lZCBpbnQgKCopKHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KSwgdW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQpqwIobWF4aUJpdHM6OmF0KHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KawCKW1heGlCaXRzOjpzaGwodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQprQIpbWF4aUJpdHM6OnNocih1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCmuAsMBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Okludm9rZXI8dW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50Pjo6aW52b2tlKHVuc2lnbmVkIGludCAoKikodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCksIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQprwI1bWF4aUJpdHM6OnIodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCmwAiptYXhpQml0czo6bGFuZCh1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCmxAiltYXhpQml0czo6bG9yKHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KbICKm1heGlCaXRzOjpseG9yKHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KbMCG21heGlCaXRzOjpuZWcodW5zaWduZWQgaW50KbQCG21heGlCaXRzOjppbmModW5zaWduZWQgaW50KbUCG21heGlCaXRzOjpkZWModW5zaWduZWQgaW50KbYCKW1heGlCaXRzOjphZGQodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQptwIpbWF4aUJpdHM6OnN1Yih1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCm4AiltYXhpQml0czo6bXVsKHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KbkCKW1heGlCaXRzOjpkaXYodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQpugIobWF4aUJpdHM6Omd0KHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KbsCKG1heGlCaXRzOjpsdCh1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCm8AiltYXhpQml0czo6Z3RlKHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50Kb0CKW1heGlCaXRzOjpsdGUodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQpvgIobWF4aUJpdHM6OmVxKHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50Kb8CEW1heGlCaXRzOjpub2lzZSgpwAIgbWF4aUJpdHM6OnRvU2lnbmFsKHVuc2lnbmVkIGludCnBAiRtYXhpQml0czo6dG9UcmlnU2lnbmFsKHVuc2lnbmVkIGludCnCAl1lbXNjcmlwdGVuOjppbnRlcm5hbDo6SW52b2tlcjx1bnNpZ25lZCBpbnQsIGRvdWJsZT46Omludm9rZSh1bnNpZ25lZCBpbnQgKCopKGRvdWJsZSksIGRvdWJsZSnDAhxtYXhpQml0czo6ZnJvbVNpZ25hbChkb3VibGUpxAJKdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aUNvdW50ZXI+KG1heGlDb3VudGVyKinFAj5tYXhpQ291bnRlciogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpQ291bnRlcj4oKcYCIm1heGlDb3VudGVyOjpjb3VudChkb3VibGUsIGRvdWJsZSnHAk5FbXNjcmlwdGVuQmluZGluZ0luaXRpYWxpemVyX21heGlWZXJiOjpFbXNjcmlwdGVuQmluZGluZ0luaXRpYWxpemVyX21heGlWZXJiKCnIAk52b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpU2F0UmV2ZXJiPihtYXhpU2F0UmV2ZXJiKinJAkh2b2lkIGVtc2NyaXB0ZW46OmludGVybmFsOjpyYXdfZGVzdHJ1Y3RvcjxtYXhpU2F0UmV2ZXJiPihtYXhpU2F0UmV2ZXJiKinKAkJtYXhpU2F0UmV2ZXJiKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlTYXRSZXZlcmI+KCnLAkx2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpRnJlZVZlcmI+KG1heGlGcmVlVmVyYiopzAJAbWF4aUZyZWVWZXJiKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlGcmVlVmVyYj4oKc0CK3N0ZDo6X18yOjpfX3Rocm93X2xlbmd0aF9lcnJvcihjaGFyIGNvbnN0KinOAmR2b2lkIHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPjo6X19wdXNoX2JhY2tfc2xvd19wYXRoPGludCBjb25zdCY+KGludCBjb25zdCYpzwJVc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+OjpfX2FwcGVuZCh1bnNpZ25lZCBsb25nLCBpbnQgY29uc3QmKdACcHZvaWQgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+OjpfX3B1c2hfYmFja19zbG93X3BhdGg8ZG91YmxlIGNvbnN0Jj4oZG91YmxlIGNvbnN0JinRAlhzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6X19hcHBlbmQodW5zaWduZWQgbG9uZywgY2hhciBjb25zdCYp0gJvc3RkOjpfXzI6OnZlY3RvcjxtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPG1heGlLdXJhbW90b09zY2lsbGF0b3I+ID46Ol9fYXBwZW5kKHVuc2lnbmVkIGxvbmcp0wJPc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+OjpfX2FwcGVuZCh1bnNpZ25lZCBsb25nKdQCE21heGlGRlQ6On5tYXhpRkZUKCnVAjNtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+Ojp+bWF4aVRpbWVTdHJldGNoKCnWAoAEc3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+OjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4sIGVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6dmFsX2RlbGV0ZXI+KG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qLCBlbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46OnZhbF9kZWxldGVyLCBzdGQ6Ol9fMjo6ZW5hYmxlX2lmPGlzX2NvbnZlcnRpYmxlPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qLCBtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+Kj46OnZhbHVlLCBzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID46Ol9fbmF0Pjo6dHlwZSnXAnplbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46OnZhbF9kZWxldGVyOjpvcGVyYXRvcigpKHZvaWQgY29uc3QqKdgC9AFzdGQ6Ol9fMjo6X19zaGFyZWRfcHRyX3BvaW50ZXI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6dmFsX2RlbGV0ZXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46On5fX3NoYXJlZF9wdHJfcG9pbnRlcigp2QL2AXN0ZDo6X18yOjpfX3NoYXJlZF9wdHJfcG9pbnRlcjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KiwgZW1zY3JpcHRlbjo6c21hcnRfcHRyX3RyYWl0PHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp2YWxfZGVsZXRlciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6fl9fc2hhcmVkX3B0cl9wb2ludGVyKCkuMdoC7wFzdGQ6Ol9fMjo6X19zaGFyZWRfcHRyX3BvaW50ZXI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6dmFsX2RlbGV0ZXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46Ol9fb25femVyb19zaGFyZWQoKdsChwJzdGQ6Ol9fMjo6X19zaGFyZWRfcHRyX3BvaW50ZXI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6dmFsX2RlbGV0ZXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46Ol9fZ2V0X2RlbGV0ZXIoc3RkOjp0eXBlX2luZm8gY29uc3QmKSBjb25zdNwC9AFzdGQ6Ol9fMjo6X19zaGFyZWRfcHRyX3BvaW50ZXI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6dmFsX2RlbGV0ZXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46Ol9fb25femVyb19zaGFyZWRfd2Vhaygp3QKQAXN0ZDo6X18yOjpfX3NoYXJlZF9wdHJfZW1wbGFjZTxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp+X19zaGFyZWRfcHRyX2VtcGxhY2UoKd4CkgFzdGQ6Ol9fMjo6X19zaGFyZWRfcHRyX2VtcGxhY2U8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6fl9fc2hhcmVkX3B0cl9lbXBsYWNlKCkuMd8CiwFzdGQ6Ol9fMjo6X19zaGFyZWRfcHRyX2VtcGxhY2U8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6X19vbl96ZXJvX3NoYXJlZCgp4AIhbWF4aUdyYWluPGhhbm5XaW5GdW5jdG9yPjo6cGxheSgp4QIxbWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+Ojp+bWF4aVBpdGNoU2hpZnQoKeIC+ANzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPjo6c2hhcmVkX3B0cjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4sIGVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp2YWxfZGVsZXRlcj4obWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+KiwgZW1zY3JpcHRlbjo6c21hcnRfcHRyX3RyYWl0PHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+ID46OnZhbF9kZWxldGVyLCBzdGQ6Ol9fMjo6ZW5hYmxlX2lmPGlzX2NvbnZlcnRpYmxlPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiosIG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPio+Ojp2YWx1ZSwgc3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID46Ol9fbmF0Pjo6dHlwZSnjAvEBc3RkOjpfXzI6Ol9fc2hhcmVkX3B0cl9wb2ludGVyPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiosIGVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp2YWxfZGVsZXRlciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp+X19zaGFyZWRfcHRyX3BvaW50ZXIoKeQC8wFzdGQ6Ol9fMjo6X19zaGFyZWRfcHRyX3BvaW50ZXI8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+KiwgZW1zY3JpcHRlbjo6c21hcnRfcHRyX3RyYWl0PHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+ID46OnZhbF9kZWxldGVyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+ID46On5fX3NoYXJlZF9wdHJfcG9pbnRlcigpLjHlAoQCc3RkOjpfXzI6Ol9fc2hhcmVkX3B0cl9wb2ludGVyPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiosIGVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp2YWxfZGVsZXRlciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPiA+OjpfX2dldF9kZWxldGVyKHN0ZDo6dHlwZV9pbmZvIGNvbnN0JikgY29uc3TmAo4Bc3RkOjpfXzI6Ol9fc2hhcmVkX3B0cl9lbXBsYWNlPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp+X19zaGFyZWRfcHRyX2VtcGxhY2UoKecCkAFzdGQ6Ol9fMjo6X19zaGFyZWRfcHRyX2VtcGxhY2U8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+ID46On5fX3NoYXJlZF9wdHJfZW1wbGFjZSgpLjHoAokBc3RkOjpfXzI6Ol9fc2hhcmVkX3B0cl9lbXBsYWNlPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPiA+OjpfX29uX3plcm9fc2hhcmVkKCnpAiRfR0xPQkFMX19zdWJfSV9tYXhpbWlsaWFuLmVtYmluZC5jcHDqAhdtYXhpT3NjOjpwaGFzb3IoZG91YmxlKesCGW1heGlPc2M6OnRyaWFuZ2xlKGRvdWJsZSnsAlBtYXhpRW52ZWxvcGU6OmxpbmUoaW50LCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mKe0CIm1heGlFbnZlbG9wZTo6dHJpZ2dlcihpbnQsIGRvdWJsZSnuAh5tYXhpRGVsYXlsaW5lOjptYXhpRGVsYXlsaW5lKCnvAiZtYXhpRGVsYXlsaW5lOjpkbChkb3VibGUsIGludCwgZG91YmxlKfACK21heGlEZWxheWxpbmU6OmRsKGRvdWJsZSwgaW50LCBkb3VibGUsIGludCnxAiltYXhpRmlsdGVyOjpsb3Jlcyhkb3VibGUsIGRvdWJsZSwgZG91YmxlKfICWG1heGlNaXg6OnN0ZXJlbyhkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGRvdWJsZSnzAl5tYXhpTWl4OjpxdWFkKGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgZG91YmxlLCBkb3VibGUp9AJrbWF4aU1peDo6YW1iaXNvbmljKGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSn1AmxtYXhpU2FtcGxlOjpsb2FkKHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4sIGludCn2AhJtYXhpU2FtcGxlOjpyZWFkKCn3AmdzdGQ6Ol9fMjo6YmFzaWNfaWZzdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OmJhc2ljX2lmc3RyZWFtKGNoYXIgY29uc3QqLCB1bnNpZ25lZCBpbnQp+ALdAXN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+JiBzdGQ6Ol9fMjo6X19wdXRfY2hhcmFjdGVyX3NlcXVlbmNlPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+KHN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+JiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGxvbmcp+QJNc3RkOjpfXzI6OnZlY3RvcjxzaG9ydCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxzaG9ydD4gPjo6X19hcHBlbmQodW5zaWduZWQgbG9uZyn6Ak1zdGQ6Ol9fMjo6YmFzaWNfZmlsZWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX2ZpbGVidWYoKfsCbG1heGlTYW1wbGU6OnNldFNhbXBsZUZyb21PZ2dCbG9iKHN0ZDo6X18yOjp2ZWN0b3I8dW5zaWduZWQgY2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjx1bnNpZ25lZCBjaGFyPiA+JiwgaW50KfwCTHN0ZDo6X18yOjpiYXNpY19maWxlYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpiYXNpY19maWxlYnVmKCn9AlxzdGQ6Ol9fMjo6YmFzaWNfZmlsZWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6b3BlbihjaGFyIGNvbnN0KiwgdW5zaWduZWQgaW50Kf4CT3N0ZDo6X18yOjpiYXNpY19pZnN0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX2lmc3RyZWFtKCn/AhVtYXhpU2FtcGxlOjppc1JlYWR5KCmAA05tYXhpU2FtcGxlOjpzZXRTYW1wbGUoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JimBA/YBc3RkOjpfXzI6OmVuYWJsZV9pZjwoX19pc19mb3J3YXJkX2l0ZXJhdG9yPGRvdWJsZSo+Ojp2YWx1ZSkgJiYgKGlzX2NvbnN0cnVjdGlibGU8ZG91YmxlLCBzdGQ6Ol9fMjo6aXRlcmF0b3JfdHJhaXRzPGRvdWJsZSo+OjpyZWZlcmVuY2U+Ojp2YWx1ZSksIHZvaWQ+Ojp0eXBlIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPjo6YXNzaWduPGRvdWJsZSo+KGRvdWJsZSosIGRvdWJsZSopggNTbWF4aVNhbXBsZTo6c2V0U2FtcGxlKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGludCmDAxVtYXhpU2FtcGxlOjp0cmlnZ2VyKCmEAxJtYXhpU2FtcGxlOjpwbGF5KCmFAyhtYXhpU2FtcGxlOjpwbGF5KGRvdWJsZSwgZG91YmxlLCBkb3VibGUphgMxbWF4aVNhbXBsZTo6cGxheShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUmKYcDKW1heGlTYW1wbGU6OnBsYXk0KGRvdWJsZSwgZG91YmxlLCBkb3VibGUpiAMWbWF4aVNhbXBsZTo6cGxheU9uY2UoKYkDHG1heGlTYW1wbGU6OnBsYXlPblpYKGRvdWJsZSmKAyRtYXhpU2FtcGxlOjpwbGF5T25aWChkb3VibGUsIGRvdWJsZSmLAxxtYXhpU2FtcGxlOjpwbGF5T25jZShkb3VibGUpjAMsbWF4aVNhbXBsZTo6cGxheU9uWlgoZG91YmxlLCBkb3VibGUsIGRvdWJsZSmNAyptYXhpU2FtcGxlOjpsb29wU2V0UG9zT25aWChkb3VibGUsIGRvdWJsZSmOAxhtYXhpU2FtcGxlOjpwbGF5KGRvdWJsZSmPAx1tYXhpU2FtcGxlOjpub3JtYWxpc2UoZG91YmxlKZADLm1heGlTYW1wbGU6OmF1dG9UcmltKGZsb2F0LCBmbG9hdCwgYm9vbCwgYm9vbCmRAzNtYXhpRHluOjpnYXRlKGRvdWJsZSwgZG91YmxlLCBsb25nLCBkb3VibGUsIGRvdWJsZSmSAzttYXhpRHluOjpjb21wcmVzc29yKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKZMDGW1heGlEeW46OmNvbXByZXNzKGRvdWJsZSmUAxptYXhpRHluOjpzZXRBdHRhY2soZG91YmxlKZUDG21heGlEeW46OnNldFJlbGVhc2UoZG91YmxlKZYDHW1heGlEeW46OnNldFRocmVzaG9sZChkb3VibGUplwMubWF4aUVudjo6YXIoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgbG9uZywgaW50KZgDQG1heGlFbnY6OmFkc3IoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGxvbmcsIGludCmZAxptYXhpRW52OjphZHNyKGRvdWJsZSwgaW50KZoDGm1heGlFbnY6OnNldEF0dGFjayhkb3VibGUpmwMbbWF4aUVudjo6c2V0U3VzdGFpbihkb3VibGUpnAMZbWF4aUVudjo6c2V0RGVjYXkoZG91YmxlKZ0DEmNvbnZlcnQ6Om10b2YoaW50KZ4DYHZpcnR1YWwgdGh1bmsgdG8gc3RkOjpfXzI6OmJhc2ljX2lmc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfaWZzdHJlYW0oKZ8DUXN0ZDo6X18yOjpiYXNpY19pZnN0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX2lmc3RyZWFtKCkuMaADYnZpcnR1YWwgdGh1bmsgdG8gc3RkOjpfXzI6OmJhc2ljX2lmc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfaWZzdHJlYW0oKS4xoQNDc3RkOjpfXzI6OmJhc2ljX2ZpbGVidWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnN5bmMoKaIDT3N0ZDo6X18yOjpiYXNpY19maWxlYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfZmlsZWJ1ZigpLjGjA1tzdGQ6Ol9fMjo6YmFzaWNfZmlsZWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6aW1idWUoc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYppANQc3RkOjpfXzI6OmJhc2ljX2ZpbGVidWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnNldGJ1ZihjaGFyKiwgbG9uZymlA3pzdGQ6Ol9fMjo6YmFzaWNfZmlsZWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6c2Vla29mZihsb25nIGxvbmcsIHN0ZDo6X18yOjppb3NfYmFzZTo6c2Vla2RpciwgdW5zaWduZWQgaW50KaYDHHN0ZDo6X18yOjpfX3Rocm93X2JhZF9jYXN0KCmnA29zdGQ6Ol9fMjo6YmFzaWNfZmlsZWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6c2Vla3BvcyhzdGQ6Ol9fMjo6ZnBvczxfX21ic3RhdGVfdD4sIHVuc2lnbmVkIGludCmoA0hzdGQ6Ol9fMjo6YmFzaWNfZmlsZWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6dW5kZXJmbG93KCmpA0tzdGQ6Ol9fMjo6YmFzaWNfZmlsZWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6cGJhY2tmYWlsKGludCmqA0pzdGQ6Ol9fMjo6YmFzaWNfZmlsZWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6b3ZlcmZsb3coaW50KasDhQJzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiBzdGQ6Ol9fMjo6X19wYWRfYW5kX291dHB1dDxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPihzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0Kiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgY2hhcimsAxttYXhpQ2xvY2s6OnNldFRlbXBvKGRvdWJsZSmtAxNtYXhpQ2xvY2s6OnRpY2tlcigprgMfbWF4aUNsb2NrOjpzZXRUaWNrc1BlckJlYXQoaW50Ka8DHW1heGlGRlQ6OnNldHVwKGludCwgaW50LCBpbnQpsAMqbWF4aUZGVDo6cHJvY2VzcyhmbG9hdCwgbWF4aUZGVDo6ZmZ0TW9kZXMpsQMTbWF4aUZGVDo6bWFnc1RvREIoKbIDG21heGlGRlQ6OnNwZWN0cmFsRmxhdG5lc3MoKbMDG21heGlGRlQ6OnNwZWN0cmFsQ2VudHJvaWQoKbQDHm1heGlJRkZUOjpzZXR1cChpbnQsIGludCwgaW50KbUDkwFtYXhpSUZGVDo6cHJvY2VzcyhzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+Jiwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiYsIG1heGlJRkZUOjpmZnRNb2Rlcym2Ay5GRlQoaW50LCBib29sLCBmbG9hdCosIGZsb2F0KiwgZmxvYXQqLCBmbG9hdCoptwMkUmVhbEZGVChpbnQsIGZsb2F0KiwgZmxvYXQqLCBmbG9hdCopuAMgZmZ0OjpnZW5XaW5kb3coaW50LCBpbnQsIGZsb2F0Kim5Aw9mZnQ6OnNldHVwKGludCm6AwtmZnQ6On5mZnQoKbsDIWZmdDo6Y2FsY0ZGVChpbnQsIGZsb2F0KiwgZmxvYXQqKbwDN2ZmdDo6cG93ZXJTcGVjdHJ1bShpbnQsIGZsb2F0KiwgZmxvYXQqLCBmbG9hdCosIGZsb2F0Kim9Ax1mZnQ6OmNvbnZUb0RCKGZsb2F0KiwgZmxvYXQqKb4DO2ZmdDo6aW52ZXJzZUZGVENvbXBsZXgoaW50LCBmbG9hdCosIGZsb2F0KiwgZmxvYXQqLCBmbG9hdCopvwM+ZmZ0OjppbnZlcnNlUG93ZXJTcGVjdHJ1bShpbnQsIGZsb2F0KiwgZmxvYXQqLCBmbG9hdCosIGZsb2F0KinAAzdtYXhpTUZDQ0FuYWx5c2VyPGRvdWJsZT46Om1lbEZpbHRlckFuZExvZ1NxdWFyZShmbG9hdCopwQMmbWF4aVJldmVyYkZpbHRlcnM6Om1heGlSZXZlcmJGaWx0ZXJzKCnCAyBtYXhpUmV2ZXJiQmFzZTo6bWF4aVJldmVyYkJhc2UoKcMDHm1heGlTYXRSZXZlcmI6Om1heGlTYXRSZXZlcmIoKcQDG21heGlTYXRSZXZlcmI6OnBsYXkoZG91YmxlKcUDHG1heGlGcmVlVmVyYjo6bWF4aUZyZWVWZXJiKCnGAyptYXhpRnJlZVZlcmI6OnBsYXkoZG91YmxlLCBkb3VibGUsIGRvdWJsZSnHAydwb2ludF9jb21wYXJlKHZvaWQgY29uc3QqLCB2b2lkIGNvbnN0KinIAxp2b3JiaXNfZGVpbml0KHN0Yl92b3JiaXMqKckDKWlzX3dob2xlX3BhY2tldF9wcmVzZW50KHN0Yl92b3JiaXMqLCBpbnQpygMzdm9yYmlzX2RlY29kZV9wYWNrZXQoc3RiX3ZvcmJpcyosIGludCosIGludCosIGludCopywMXc3RhcnRfcGFnZShzdGJfdm9yYmlzKinMAy92b3JiaXNfZmluaXNoX2ZyYW1lKHN0Yl92b3JiaXMqLCBpbnQsIGludCwgaW50Kc0DQHZvcmJpc19kZWNvZGVfaW5pdGlhbChzdGJfdm9yYmlzKiwgaW50KiwgaW50KiwgaW50KiwgaW50KiwgaW50KinOAxpnZXRfYml0cyhzdGJfdm9yYmlzKiwgaW50Kc8DMmNvZGVib29rX2RlY29kZV9zY2FsYXJfcmF3KHN0Yl92b3JiaXMqLCBDb2RlYm9vayop0ANDZGVjb2RlX3Jlc2lkdWUoc3RiX3ZvcmJpcyosIGZsb2F0KiosIGludCwgaW50LCBpbnQsIHVuc2lnbmVkIGNoYXIqKdEDK2ludmVyc2VfbWRjdChmbG9hdCosIGludCwgc3RiX3ZvcmJpcyosIGludCnSAxlmbHVzaF9wYWNrZXQoc3RiX3ZvcmJpcyop0wMac3RhcnRfZGVjb2RlcihzdGJfdm9yYmlzKinUAyh1aW50MzJfY29tcGFyZSh2b2lkIGNvbnN0Kiwgdm9pZCBjb25zdCop1QMlaW5pdF9ibG9ja3NpemUoc3RiX3ZvcmJpcyosIGludCwgaW50KdYDFnN0Yl92b3JiaXNfb3Blbl9tZW1vcnnXAxpzdGJfdm9yYmlzX2dldF9mcmFtZV9zaG9ydNgDQGNvbnZlcnRfc2FtcGxlc19zaG9ydChpbnQsIHNob3J0KiosIGludCwgaW50LCBmbG9hdCoqLCBpbnQsIGludCnZAyZzdGJfdm9yYmlzX2dldF9mcmFtZV9zaG9ydF9pbnRlcmxlYXZlZNoDR2NvbnZlcnRfY2hhbm5lbHNfc2hvcnRfaW50ZXJsZWF2ZWQoaW50LCBzaG9ydCosIGludCwgZmxvYXQqKiwgaW50LCBpbnQp2wMYc3RiX3ZvcmJpc19kZWNvZGVfbWVtb3J53AMfbWF5YmVfc3RhcnRfcGFja2V0KHN0Yl92b3JiaXMqKd0DKXN0YXJ0X3BhZ2Vfbm9fY2FwdHVyZXBhdHRlcm4oc3RiX3ZvcmJpcyop3gMyY29kZWJvb2tfZGVjb2RlX3N0YXJ0KHN0Yl92b3JiaXMqLCBDb2RlYm9vayosIGludCnfA19jb2RlYm9va19kZWNvZGVfZGVpbnRlcmxlYXZlX3JlcGVhdChzdGJfdm9yYmlzKiwgQ29kZWJvb2sqLCBmbG9hdCoqLCBpbnQsIGludCosIGludCosIGludCwgaW50KeADNWltZGN0X3N0ZXAzX2l0ZXIwX2xvb3AoaW50LCBmbG9hdCosIGludCwgaW50LCBmbG9hdCop4QM8aW1kY3Rfc3RlcDNfaW5uZXJfcl9sb29wKGludCwgZmxvYXQqLCBpbnQsIGludCwgZmxvYXQqLCBpbnQp4gMHc2NhbGJuZuMDBmxkZXhwZuQDBm1lbWNtcOUDBXFzb3J05gMEc2lmdOcDA3NocugDB3RyaW5rbGXpAwNzaGzqAwRwbnR66wMFY3ljbGXsAwdhX2N0el9s7QMMX19zdGRpb19zZWVr7gMKX19sb2NrZmlsZe8DDF9fdW5sb2NrZmlsZfADCV9fZndyaXRlePEDBmZ3cml0ZfIDB2lwcmludGbzAxBfX2Vycm5vX2xvY2F0aW9u9AMHd2NydG9tYvUDBndjdG9tYvYDBm1lbWNocvcDBWZyZXhw+AMTX192ZnByaW50Zl9pbnRlcm5hbPkDC3ByaW50Zl9jb3Jl+gMDb3V0+wMGZ2V0aW50/AMHcG9wX2FyZ/0DA3BhZP4DBWZtdF9v/wMFZm10X3iABAVmbXRfdYEECHZmcHJpbnRmggQGZm10X2ZwgwQTcG9wX2FyZ19sb25nX2RvdWJsZYQECXZmaXByaW50ZoUECl9fb2ZsX2xvY2uGBAlfX3Rvd3JpdGWHBAhmaXByaW50ZogEBWZwdXRjiQQRX19mdGVsbG9fdW5sb2NrZWSKBAhfX2Z0ZWxsb4sEBWZ0ZWxsjAQIX190b3JlYWSNBAVmcmVhZI4EEV9fZnNlZWtvX3VubG9ja2VkjwQIX19mc2Vla2+QBAVmc2Vla5EEDV9fc3RkaW9fY2xvc2WSBAVmZ2V0Y5MEBnN0cmxlbpQEC19fc3RyY2hybnVslQQGc3RyY2hylgQMX19mbW9kZWZsYWdzlwQFZm9wZW6YBAl2c25wcmludGaZBAhzbl93cml0ZZoEBmZjbG9zZZsEGV9fZW1zY3JpcHRlbl9zdGRvdXRfY2xvc2WcBBhfX2Vtc2NyaXB0ZW5fc3Rkb3V0X3NlZWudBAxfX3N0ZGlvX3JlYWSeBAhfX2Zkb3Blbp8EDV9fc3RkaW9fd3JpdGWgBApfX292ZXJmbG93oQQGZmZsdXNoogQRX19mZmx1c2hfdW5sb2NrZWSjBAdfX3VmbG93pAQJX19vZmxfYWRkpQQJX19sc2hydGkzpgQJX19hc2hsdGkzpwQMX190cnVuY3RmZGYyqAQFX19jb3OpBBBfX3JlbV9waW8yX2xhcmdlqgQKX19yZW1fcGlvMqsEBV9fc2lurAQDY29zrQQHX19jb3NkZq4EB19fc2luZGavBAtfX3JlbV9waW8yZrAEBGNvc2axBANzaW6yBARzaW5mswQFX190YW60BAN0YW61BAVhdGFuZrYEBmF0YW4yZrcEBGV4cGa4BANsb2e5BARsb2dmugQDcG93uwQHd21lbWNwebwEGXN0ZDo6dW5jYXVnaHRfZXhjZXB0aW9uKCm9BEVzdGQ6Ol9fMjo6YmFzaWNfaW9zPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfaW9zKCm+BB9zdGQ6Ol9fMjo6aW9zX2Jhc2U6On5pb3NfYmFzZSgpvwQ/c3RkOjpfXzI6Omlvc19iYXNlOjpfX2NhbGxfY2FsbGJhY2tzKHN0ZDo6X18yOjppb3NfYmFzZTo6ZXZlbnQpwARHc3RkOjpfXzI6OmJhc2ljX2lvczxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX2lvcygpLjHBBFFzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfc3RyZWFtYnVmKCnCBFNzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfc3RyZWFtYnVmKCkuMcMEUHN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OmJhc2ljX3N0cmVhbWJ1ZigpxARdc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6aW1idWUoc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYpxQRSc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6c2V0YnVmKGNoYXIqLCBsb25nKcYEfHN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnNlZWtvZmYobG9uZyBsb25nLCBzdGQ6Ol9fMjo6aW9zX2Jhc2U6OnNlZWtkaXIsIHVuc2lnbmVkIGludCnHBHFzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpzZWVrcG9zKHN0ZDo6X18yOjpmcG9zPF9fbWJzdGF0ZV90PiwgdW5zaWduZWQgaW50KcgEUnN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnhzZ2V0bihjaGFyKiwgbG9uZynJBERzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj46OmNvcHkoY2hhciosIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBsb25nKcoESnN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnVuZGVyZmxvdygpywRGc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6dWZsb3coKcwETXN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnBiYWNrZmFpbChpbnQpzQRYc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6eHNwdXRuKGNoYXIgY29uc3QqLCBsb25nKc4EV3N0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46On5iYXNpY19zdHJlYW1idWYoKc8EWXN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46On5iYXNpY19zdHJlYW1idWYoKS4x0ARWc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1Zjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6YmFzaWNfc3RyZWFtYnVmKCnRBFtzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Ojp4c2dldG4od2NoYXJfdCosIGxvbmcp0gRNc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+Ojpjb3B5KHdjaGFyX3QqLCB3Y2hhcl90IGNvbnN0KiwgdW5zaWduZWQgbG9uZynTBExzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Ojp1Zmxvdygp1ARhc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1Zjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6eHNwdXRuKHdjaGFyX3QgY29uc3QqLCBsb25nKdUET3N0ZDo6X18yOjpiYXNpY19pc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfaXN0cmVhbSgpLjHWBF52aXJ0dWFsIHRodW5rIHRvIHN0ZDo6X18yOjpiYXNpY19pc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfaXN0cmVhbSgp1wRPc3RkOjpfXzI6OmJhc2ljX2lzdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19pc3RyZWFtKCkuMtgEYHZpcnR1YWwgdGh1bmsgdG8gc3RkOjpfXzI6OmJhc2ljX2lzdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19pc3RyZWFtKCkuMdkEjwFzdGQ6Ol9fMjo6YmFzaWNfaXN0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6c2VudHJ5OjpzZW50cnkoc3RkOjpfXzI6OmJhc2ljX2lzdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBib29sKdoERHN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpmbHVzaCgp2wRhc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JiBzdGQ6Ol9fMjo6dXNlX2ZhY2V0PHN0ZDo6X18yOjpjdHlwZTxjaGFyPiA+KHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKdwE0QFib29sIHN0ZDo6X18yOjpvcGVyYXRvciE9PGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+IGNvbnN0Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gY29uc3QmKd0EVHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpvcGVyYXRvciooKSBjb25zdN4ET3N0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpvcGVyYXRvcisrKCnfBNEBYm9vbCBzdGQ6Ol9fMjo6b3BlcmF0b3I9PTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiBjb25zdCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+IGNvbnN0JingBIkBc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnNlbnRyeTo6c2VudHJ5KHN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+JinhBE5zdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6c2VudHJ5Ojp+c2VudHJ5KCniBJgBc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OmVxdWFsKHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+IGNvbnN0JikgY29uc3TjBEdzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpzYnVtcGMoKeQESnN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnNwdXRjKGNoYXIp5QROc3RkOjpfXzI6OmJhc2ljX2lzdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnJlYWQoY2hhciosIGxvbmcp5gRqc3RkOjpfXzI6OmJhc2ljX2lzdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnNlZWtnKGxvbmcgbG9uZywgc3RkOjpfXzI6Omlvc19iYXNlOjpzZWVrZGlyKecESnN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+OjpmbHVzaCgp6ARnc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JiBzdGQ6Ol9fMjo6dXNlX2ZhY2V0PHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiA+KHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKekE4wFib29sIHN0ZDo6X18yOjpvcGVyYXRvciE9PHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+IGNvbnN0Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gY29uc3QmKeoEVXN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+OjpvcGVyYXRvcisrKCnrBOMBYm9vbCBzdGQ6Ol9fMjo6b3BlcmF0b3I9PTx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiBjb25zdCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+IGNvbnN0JinsBJUBc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46OnNlbnRyeTo6c2VudHJ5KHN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+JintBKQBc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46OmVxdWFsKHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+IGNvbnN0JikgY29uc3TuBE1zdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+OjpzYnVtcGMoKe8EU3N0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46OnNwdXRjKHdjaGFyX3Qp8ARPc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19vc3RyZWFtKCkuMfEEXnZpcnR1YWwgdGh1bmsgdG8gc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19vc3RyZWFtKCnyBE9zdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX29zdHJlYW0oKS4y8wRgdmlydHVhbCB0aHVuayB0byBzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX29zdHJlYW0oKS4x9ATtAXN0ZDo6X18yOjpudW1fcHV0PGNoYXIsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID4gY29uc3QmIHN0ZDo6X18yOjp1c2VfZmFjZXQ8c3RkOjpfXzI6Om51bV9wdXQ8Y2hhciwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPiA+KHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKfUERXN0ZDo6X18yOjpiYXNpY19pb3M8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OmZpbGwoKSBjb25zdPYESnN0ZDo6X18yOjpiYXNpY19pb3M8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OndpZGVuKGNoYXIpIGNvbnN09wROc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46Om9wZXJhdG9yPDwoc2hvcnQp+ARMc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46Om9wZXJhdG9yPDwoaW50KfkEVnN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpvcGVyYXRvcjw8KHVuc2lnbmVkIGxvbmcp+gRSc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46Om9wZXJhdG9yPShjaGFyKfsERnN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpwdXQoY2hhcin8BFtzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6b3BlcmF0b3I9KHdjaGFyX3Qp/QRwc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6YmFzaWNfc3RyaW5nKGNoYXIgY29uc3QqKf4EIXN0ZDo6X18yOjppb3NfYmFzZTo6fmlvc19iYXNlKCkuMf8EH3N0ZDo6X18yOjppb3NfYmFzZTo6aW5pdCh2b2lkKimABbUBc3RkOjpfXzI6OmVuYWJsZV9pZjwoaXNfbW92ZV9jb25zdHJ1Y3RpYmxlPHVuc2lnbmVkIGludD46OnZhbHVlKSAmJiAoaXNfbW92ZV9hc3NpZ25hYmxlPHVuc2lnbmVkIGludD46OnZhbHVlKSwgdm9pZD46OnR5cGUgc3RkOjpfXzI6OnN3YXA8dW5zaWduZWQgaW50Pih1bnNpZ25lZCBpbnQmLCB1bnNpZ25lZCBpbnQmKYEFWXN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpfX3Rlc3RfZm9yX2VvZigpIGNvbnN0ggVfc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46Ol9fdGVzdF9mb3JfZW9mKCkgY29uc3SDBQZ1bmdldGOEBSBzdGQ6Ol9fMjo6aW9zX2Jhc2U6OkluaXQ6OkluaXQoKYUFF19fY3h4X2dsb2JhbF9hcnJheV9kdG9yhgU/c3RkOjpfXzI6Ol9fc3RkaW5idWY8Y2hhcj46Ol9fc3RkaW5idWYoX0lPX0ZJTEUqLCBfX21ic3RhdGVfdCophwWKAXN0ZDo6X18yOjpiYXNpY19pc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpiYXNpY19pc3RyZWFtKHN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4qKYgFQnN0ZDo6X18yOjpfX3N0ZGluYnVmPHdjaGFyX3Q+OjpfX3N0ZGluYnVmKF9JT19GSUxFKiwgX19tYnN0YXRlX3QqKYkFlgFzdGQ6Ol9fMjo6YmFzaWNfaXN0cmVhbTx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6YmFzaWNfaXN0cmVhbShzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+KimKBUFzdGQ6Ol9fMjo6X19zdGRvdXRidWY8Y2hhcj46Ol9fc3Rkb3V0YnVmKF9JT19GSUxFKiwgX19tYnN0YXRlX3QqKYsFigFzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6YmFzaWNfb3N0cmVhbShzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+KimMBURzdGQ6Ol9fMjo6X19zdGRvdXRidWY8d2NoYXJfdD46Ol9fc3Rkb3V0YnVmKF9JT19GSUxFKiwgX19tYnN0YXRlX3QqKY0FlgFzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6YmFzaWNfb3N0cmVhbShzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+KimOBX1zdGQ6Ol9fMjo6YmFzaWNfaW9zPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojppbml0KHN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4qKY8FiwFzdGQ6Ol9fMjo6Y29kZWN2dDxjaGFyLCBjaGFyLCBfX21ic3RhdGVfdD4gY29uc3QmIHN0ZDo6X18yOjp1c2VfZmFjZXQ8c3RkOjpfXzI6OmNvZGVjdnQ8Y2hhciwgY2hhciwgX19tYnN0YXRlX3Q+ID4oc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYpkAWRAXN0ZDo6X18yOjpjb2RlY3Z0PHdjaGFyX3QsIGNoYXIsIF9fbWJzdGF0ZV90PiBjb25zdCYgc3RkOjpfXzI6OnVzZV9mYWNldDxzdGQ6Ol9fMjo6Y29kZWN2dDx3Y2hhcl90LCBjaGFyLCBfX21ic3RhdGVfdD4gPihzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JimRBSlzdGQ6Ol9fMjo6X19zdGRpbmJ1ZjxjaGFyPjo6fl9fc3RkaW5idWYoKZIFOnN0ZDo6X18yOjpfX3N0ZGluYnVmPGNoYXI+OjppbWJ1ZShzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JimTBSdzdGQ6Ol9fMjo6X19zdGRpbmJ1ZjxjaGFyPjo6dW5kZXJmbG93KCmUBStzdGQ6Ol9fMjo6X19zdGRpbmJ1ZjxjaGFyPjo6X19nZXRjaGFyKGJvb2wplQUjc3RkOjpfXzI6Ol9fc3RkaW5idWY8Y2hhcj46OnVmbG93KCmWBSpzdGQ6Ol9fMjo6X19zdGRpbmJ1ZjxjaGFyPjo6cGJhY2tmYWlsKGludCmXBSxzdGQ6Ol9fMjo6X19zdGRpbmJ1Zjx3Y2hhcl90Pjo6fl9fc3RkaW5idWYoKZgFPXN0ZDo6X18yOjpfX3N0ZGluYnVmPHdjaGFyX3Q+OjppbWJ1ZShzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JimZBSpzdGQ6Ol9fMjo6X19zdGRpbmJ1Zjx3Y2hhcl90Pjo6dW5kZXJmbG93KCmaBS5zdGQ6Ol9fMjo6X19zdGRpbmJ1Zjx3Y2hhcl90Pjo6X19nZXRjaGFyKGJvb2wpmwUmc3RkOjpfXzI6Ol9fc3RkaW5idWY8d2NoYXJfdD46OnVmbG93KCmcBTZzdGQ6Ol9fMjo6X19zdGRpbmJ1Zjx3Y2hhcl90Pjo6cGJhY2tmYWlsKHVuc2lnbmVkIGludCmdBTtzdGQ6Ol9fMjo6X19zdGRvdXRidWY8Y2hhcj46OmltYnVlKHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKZ4FI3N0ZDo6X18yOjpfX3N0ZG91dGJ1ZjxjaGFyPjo6c3luYygpnwU2c3RkOjpfXzI6Ol9fc3Rkb3V0YnVmPGNoYXI+Ojp4c3B1dG4oY2hhciBjb25zdCosIGxvbmcpoAUqc3RkOjpfXzI6Ol9fc3Rkb3V0YnVmPGNoYXI+OjpvdmVyZmxvdyhpbnQpoQU+c3RkOjpfXzI6Ol9fc3Rkb3V0YnVmPHdjaGFyX3Q+OjppbWJ1ZShzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JimiBTxzdGQ6Ol9fMjo6X19zdGRvdXRidWY8d2NoYXJfdD46OnhzcHV0bih3Y2hhcl90IGNvbnN0KiwgbG9uZymjBTZzdGQ6Ol9fMjo6X19zdGRvdXRidWY8d2NoYXJfdD46Om92ZXJmbG93KHVuc2lnbmVkIGludCmkBQdfX3NobGltpQUIX19zaGdldGOmBQhfX211bHRpM6cFCV9faW50c2NhbqgFB21icnRvd2OpBQ1fX2V4dGVuZHNmdGYyqgUIX19tdWx0ZjOrBQtfX2Zsb2F0c2l0ZqwFCF9fYWRkdGYzrQUNX19leHRlbmRkZnRmMq4FB19fbGV0ZjKvBQdfX2dldGYysAUJY29weXNpZ25ssQUNX19mbG9hdHVuc2l0ZrIFCF9fc3VidGYzswUHc2NhbGJubLQFCF9fZGl2dGYztQULX19mbG9hdHNjYW62BQhoZXhmbG9hdLcFCGRlY2Zsb2F0uAUHc2NhbmV4cLkFDF9fdHJ1bmN0ZnNmMroFB3Zmc2Nhbma7BQVhcmdfbrwFCXN0b3JlX2ludL0FDV9fc3RyaW5nX3JlYWS+BQd2c3NjYW5mvwUHZG9fcmVhZMAFBnN0cmNtcMEFIF9fZW1zY3JpcHRlbl9lbnZpcm9uX2NvbnN0cnVjdG9ywgUHc3RybmNtcMMFBmdldGVudsQFCF9fbXVubWFwxQUMX19nZXRfbG9jYWxlxgULX19uZXdsb2NhbGXHBQl2YXNwcmludGbIBQZzc2NhbmbJBQhzbnByaW50ZsoFCmZyZWVsb2NhbGXLBQZ3Y3NsZW7MBQl3Y3NydG9tYnPNBQp3Y3NucnRvbWJzzgUJbWJzcnRvd2NzzwUKbWJzbnJ0b3djc9AFBnN0cnRveNEFCnN0cnRvdWxsX2zSBQlzdHJ0b2xsX2zTBQZzdHJ0b2bUBQhzdHJ0b3guMdUFBnN0cnRvZNYFB3N0cnRvbGTXBQlzdHJ0b2xkX2zYBV1zdGQ6Ol9fMjo6Y29sbGF0ZTxjaGFyPjo6ZG9fY29tcGFyZShjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KikgY29uc3TZBUVzdGQ6Ol9fMjo6Y29sbGF0ZTxjaGFyPjo6ZG9fdHJhbnNmb3JtKGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KikgY29uc3TaBc8Bc3RkOjpfXzI6OmVuYWJsZV9pZjxfX2lzX2ZvcndhcmRfaXRlcmF0b3I8Y2hhciBjb25zdCo+Ojp2YWx1ZSwgdm9pZD46OnR5cGUgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6X19pbml0PGNoYXIgY29uc3QqPihjaGFyIGNvbnN0KiwgY2hhciBjb25zdCop2wVAc3RkOjpfXzI6OmNvbGxhdGU8Y2hhcj46OmRvX2hhc2goY2hhciBjb25zdCosIGNoYXIgY29uc3QqKSBjb25zdNwFbHN0ZDo6X18yOjpjb2xsYXRlPHdjaGFyX3Q+Ojpkb19jb21wYXJlKHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqKSBjb25zdN0FTnN0ZDo6X18yOjpjb2xsYXRlPHdjaGFyX3Q+Ojpkb190cmFuc2Zvcm0od2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqKSBjb25zdN4F5AFzdGQ6Ol9fMjo6ZW5hYmxlX2lmPF9faXNfZm9yd2FyZF9pdGVyYXRvcjx3Y2hhcl90IGNvbnN0Kj46OnZhbHVlLCB2b2lkPjo6dHlwZSBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+OjpfX2luaXQ8d2NoYXJfdCBjb25zdCo+KHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0KinfBUlzdGQ6Ol9fMjo6Y29sbGF0ZTx3Y2hhcl90Pjo6ZG9faGFzaCh3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdCopIGNvbnN04AWaAnN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGJvb2wmKSBjb25zdOEFZ3N0ZDo6X18yOjpudW1wdW5jdDxjaGFyPiBjb25zdCYgc3RkOjpfXzI6OnVzZV9mYWNldDxzdGQ6Ol9fMjo6bnVtcHVuY3Q8Y2hhcj4gPihzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JiniBaQFc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCogc3RkOjpfXzI6Ol9fc2Nhbl9rZXl3b3JkPHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0Kiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+ID4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCosIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QqLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmLCB1bnNpZ25lZCBpbnQmLCBib29sKeMFOHN0ZDo6X18yOjpsb2NhbGU6OnVzZV9mYWNldChzdGQ6Ol9fMjo6bG9jYWxlOjppZCYpIGNvbnN05AXMAXN0ZDo6X18yOjp1bmlxdWVfcHRyPHVuc2lnbmVkIGNoYXIsIHZvaWQgKCopKHZvaWQqKT46OnVuaXF1ZV9wdHI8dHJ1ZSwgdm9pZD4odW5zaWduZWQgY2hhciosIHN0ZDo6X18yOjpfX2RlcGVuZGVudF90eXBlPHN0ZDo6X18yOjpfX3VuaXF1ZV9wdHJfZGVsZXRlcl9zZmluYWU8dm9pZCAoKikodm9pZCopPiwgdHJ1ZT46Ol9fZ29vZF9ydmFsX3JlZl90eXBlKeUFmgJzdGQ6Ol9fMjo6bnVtX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBsb25nJikgY29uc3TmBesCc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19kb19nZXRfc2lnbmVkPGxvbmc+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgbG9uZyYpIGNvbnN05wU5c3RkOjpfXzI6Ol9fbnVtX2dldF9iYXNlOjpfX2dldF9iYXNlKHN0ZDo6X18yOjppb3NfYmFzZSYp6AVIc3RkOjpfXzI6Ol9fbnVtX2dldDxjaGFyPjo6X19zdGFnZTJfaW50X3ByZXAoc3RkOjpfXzI6Omlvc19iYXNlJiwgY2hhciYp6QVlc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6YmFzaWNfc3RyaW5nKCnqBWxzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpyZXNpemUodW5zaWduZWQgbG9uZynrBeUBc3RkOjpfXzI6Ol9fbnVtX2dldDxjaGFyPjo6X19zdGFnZTJfaW50X2xvb3AoY2hhciwgaW50LCBjaGFyKiwgY2hhciomLCB1bnNpZ25lZCBpbnQmLCBjaGFyLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0JiwgdW5zaWduZWQgaW50KiwgdW5zaWduZWQgaW50KiYsIGNoYXIgY29uc3QqKewFXGxvbmcgc3RkOjpfXzI6Ol9fbnVtX2dldF9zaWduZWRfaW50ZWdyYWw8bG9uZz4oY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBpbnQmLCBpbnQp7QWlAXN0ZDo6X18yOjpfX2NoZWNrX2dyb3VwaW5nKHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QmLCB1bnNpZ25lZCBpbnQqLCB1bnNpZ25lZCBpbnQqLCB1bnNpZ25lZCBpbnQmKe4FnwJzdGQ6Ol9fMjo6bnVtX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBsb25nIGxvbmcmKSBjb25zdO8F9QJzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiBzdGQ6Ol9fMjo6bnVtX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2RvX2dldF9zaWduZWQ8bG9uZyBsb25nPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGxvbmcgbG9uZyYpIGNvbnN08AVmbG9uZyBsb25nIHN0ZDo6X18yOjpfX251bV9nZXRfc2lnbmVkX2ludGVncmFsPGxvbmcgbG9uZz4oY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBpbnQmLCBpbnQp8QWkAnN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHVuc2lnbmVkIHNob3J0JikgY29uc3TyBYEDc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19kb19nZXRfdW5zaWduZWQ8dW5zaWduZWQgc2hvcnQ+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdW5zaWduZWQgc2hvcnQmKSBjb25zdPMFcnVuc2lnbmVkIHNob3J0IHN0ZDo6X18yOjpfX251bV9nZXRfdW5zaWduZWRfaW50ZWdyYWw8dW5zaWduZWQgc2hvcnQ+KGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgaW50JiwgaW50KfQFogJzdGQ6Ol9fMjo6bnVtX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB1bnNpZ25lZCBpbnQmKSBjb25zdPUF/QJzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiBzdGQ6Ol9fMjo6bnVtX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2RvX2dldF91bnNpZ25lZDx1bnNpZ25lZCBpbnQ+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdW5zaWduZWQgaW50JikgY29uc3T2BW51bnNpZ25lZCBpbnQgc3RkOjpfXzI6Ol9fbnVtX2dldF91bnNpZ25lZF9pbnRlZ3JhbDx1bnNpZ25lZCBpbnQ+KGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgaW50JiwgaW50KfcFqAJzdGQ6Ol9fMjo6bnVtX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB1bnNpZ25lZCBsb25nIGxvbmcmKSBjb25zdPgFiQNzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiBzdGQ6Ol9fMjo6bnVtX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2RvX2dldF91bnNpZ25lZDx1bnNpZ25lZCBsb25nIGxvbmc+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdW5zaWduZWQgbG9uZyBsb25nJikgY29uc3T5BXp1bnNpZ25lZCBsb25nIGxvbmcgc3RkOjpfXzI6Ol9fbnVtX2dldF91bnNpZ25lZF9pbnRlZ3JhbDx1bnNpZ25lZCBsb25nIGxvbmc+KGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgaW50JiwgaW50KfoFmwJzdGQ6Ol9fMjo6bnVtX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBmbG9hdCYpIGNvbnN0+wX1AnN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+IHN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZG9fZ2V0X2Zsb2F0aW5nX3BvaW50PGZsb2F0PihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGZsb2F0JikgY29uc3T8BVhzdGQ6Ol9fMjo6X19udW1fZ2V0PGNoYXI+OjpfX3N0YWdlMl9mbG9hdF9wcmVwKHN0ZDo6X18yOjppb3NfYmFzZSYsIGNoYXIqLCBjaGFyJiwgY2hhciYp/QXwAXN0ZDo6X18yOjpfX251bV9nZXQ8Y2hhcj46Ol9fc3RhZ2UyX2Zsb2F0X2xvb3AoY2hhciwgYm9vbCYsIGNoYXImLCBjaGFyKiwgY2hhciomLCBjaGFyLCBjaGFyLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0JiwgdW5zaWduZWQgaW50KiwgdW5zaWduZWQgaW50KiYsIHVuc2lnbmVkIGludCYsIGNoYXIqKf4FT2Zsb2F0IHN0ZDo6X18yOjpfX251bV9nZXRfZmxvYXQ8ZmxvYXQ+KGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgaW50Jin/BZwCc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgZG91YmxlJikgY29uc3SABvcCc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19kb19nZXRfZmxvYXRpbmdfcG9pbnQ8ZG91YmxlPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGRvdWJsZSYpIGNvbnN0gQZRZG91YmxlIHN0ZDo6X18yOjpfX251bV9nZXRfZmxvYXQ8ZG91YmxlPihjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGludCYpggahAnN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGxvbmcgZG91YmxlJikgY29uc3SDBoEDc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19kb19nZXRfZmxvYXRpbmdfcG9pbnQ8bG9uZyBkb3VibGU+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgbG9uZyBkb3VibGUmKSBjb25zdIQGW2xvbmcgZG91YmxlIHN0ZDo6X18yOjpfX251bV9nZXRfZmxvYXQ8bG9uZyBkb3VibGU+KGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgaW50JimFBpsCc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50Jiwgdm9pZComKSBjb25zdIYGEnN0ZDo6X18yOjpfX2Nsb2MoKYcGTHN0ZDo6X18yOjpfX2xpYmNwcF9zc2NhbmZfbChjaGFyIGNvbnN0KiwgX19sb2NhbGVfc3RydWN0KiwgY2hhciBjb25zdCosIC4uLimIBl9zdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpfX3plcm8oKYkGVGNoYXIgY29uc3QqIHN0ZDo6X18yOjpmaW5kPGNoYXIgY29uc3QqLCBjaGFyPihjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QmKYoGSXN0ZDo6X18yOjpfX2xpYmNwcF9sb2NhbGVfZ3VhcmQ6Ol9fbGliY3BwX2xvY2FsZV9ndWFyZChfX2xvY2FsZV9zdHJ1Y3QqJimLBq8Cc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgYm9vbCYpIGNvbnN0jAZtc3RkOjpfXzI6Om51bXB1bmN0PHdjaGFyX3Q+IGNvbnN0JiBzdGQ6Ol9fMjo6dXNlX2ZhY2V0PHN0ZDo6X18yOjpudW1wdW5jdDx3Y2hhcl90PiA+KHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKY0G4AVzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+IGNvbnN0KiBzdGQ6Ol9fMjo6X19zY2FuX2tleXdvcmQ8c3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4gY29uc3QqLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+IGNvbnN0Kiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiBjb25zdCosIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYsIHVuc2lnbmVkIGludCYsIGJvb2wpjgavAnN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGxvbmcmKSBjb25zdI8GhgNzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiBzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2RvX2dldF9zaWduZWQ8bG9uZz4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBsb25nJikgY29uc3SQBk1zdGQ6Ol9fMjo6X19udW1fZ2V0PHdjaGFyX3Q+OjpfX2RvX3dpZGVuKHN0ZDo6X18yOjppb3NfYmFzZSYsIHdjaGFyX3QqKSBjb25zdJEGTnN0ZDo6X18yOjpfX251bV9nZXQ8d2NoYXJfdD46Ol9fc3RhZ2UyX2ludF9wcmVwKHN0ZDo6X18yOjppb3NfYmFzZSYsIHdjaGFyX3QmKZIG8QFzdGQ6Ol9fMjo6X19udW1fZ2V0PHdjaGFyX3Q+OjpfX3N0YWdlMl9pbnRfbG9vcCh3Y2hhcl90LCBpbnQsIGNoYXIqLCBjaGFyKiYsIHVuc2lnbmVkIGludCYsIHdjaGFyX3QsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QmLCB1bnNpZ25lZCBpbnQqLCB1bnNpZ25lZCBpbnQqJiwgd2NoYXJfdCBjb25zdCopkwa0AnN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGxvbmcgbG9uZyYpIGNvbnN0lAaQA3N0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+IHN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZG9fZ2V0X3NpZ25lZDxsb25nIGxvbmc+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgbG9uZyBsb25nJikgY29uc3SVBrkCc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdW5zaWduZWQgc2hvcnQmKSBjb25zdJYGnANzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiBzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2RvX2dldF91bnNpZ25lZDx1bnNpZ25lZCBzaG9ydD4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB1bnNpZ25lZCBzaG9ydCYpIGNvbnN0lwa3AnN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHVuc2lnbmVkIGludCYpIGNvbnN0mAaYA3N0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+IHN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZG9fZ2V0X3Vuc2lnbmVkPHVuc2lnbmVkIGludD4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB1bnNpZ25lZCBpbnQmKSBjb25zdJkGvQJzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB1bnNpZ25lZCBsb25nIGxvbmcmKSBjb25zdJoGpANzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiBzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2RvX2dldF91bnNpZ25lZDx1bnNpZ25lZCBsb25nIGxvbmc+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdW5zaWduZWQgbG9uZyBsb25nJikgY29uc3SbBrACc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgZmxvYXQmKSBjb25zdJwGkANzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiBzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2RvX2dldF9mbG9hdGluZ19wb2ludDxmbG9hdD4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBmbG9hdCYpIGNvbnN0nQZkc3RkOjpfXzI6Ol9fbnVtX2dldDx3Y2hhcl90Pjo6X19zdGFnZTJfZmxvYXRfcHJlcChzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90Kiwgd2NoYXJfdCYsIHdjaGFyX3QmKZ4G/wFzdGQ6Ol9fMjo6X19udW1fZ2V0PHdjaGFyX3Q+OjpfX3N0YWdlMl9mbG9hdF9sb29wKHdjaGFyX3QsIGJvb2wmLCBjaGFyJiwgY2hhciosIGNoYXIqJiwgd2NoYXJfdCwgd2NoYXJfdCwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCYsIHVuc2lnbmVkIGludCosIHVuc2lnbmVkIGludComLCB1bnNpZ25lZCBpbnQmLCB3Y2hhcl90KimfBrECc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgZG91YmxlJikgY29uc3SgBpIDc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19kb19nZXRfZmxvYXRpbmdfcG9pbnQ8ZG91YmxlPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGRvdWJsZSYpIGNvbnN0oQa2AnN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGxvbmcgZG91YmxlJikgY29uc3SiBpwDc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19kb19nZXRfZmxvYXRpbmdfcG9pbnQ8bG9uZyBkb3VibGU+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgbG9uZyBkb3VibGUmKSBjb25zdKMGsAJzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB2b2lkKiYpIGNvbnN0pAZmd2NoYXJfdCBjb25zdCogc3RkOjpfXzI6OmZpbmQ8d2NoYXJfdCBjb25zdCosIHdjaGFyX3Q+KHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdCYppQZnd2NoYXJfdCBjb25zdCogc3RkOjpfXzI6Ol9fbnVtX2dldDx3Y2hhcl90Pjo6X19kb193aWRlbl9wPHdjaGFyX3Q+KHN0ZDo6X18yOjppb3NfYmFzZSYsIHdjaGFyX3QqKSBjb25zdKYGzQFzdGQ6Ol9fMjo6bnVtX3B1dDxjaGFyLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIGNoYXIsIGJvb2wpIGNvbnN0pwZec3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6YmVnaW4oKagGXHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OmVuZCgpqQbNAXN0ZDo6X18yOjpudW1fcHV0PGNoYXIsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgY2hhciwgbG9uZykgY29uc3SqBk5zdGQ6Ol9fMjo6X19udW1fcHV0X2Jhc2U6Ol9fZm9ybWF0X2ludChjaGFyKiwgY2hhciBjb25zdCosIGJvb2wsIHVuc2lnbmVkIGludCmrBldzdGQ6Ol9fMjo6X19saWJjcHBfc25wcmludGZfbChjaGFyKiwgdW5zaWduZWQgbG9uZywgX19sb2NhbGVfc3RydWN0KiwgY2hhciBjb25zdCosIC4uLimsBlVzdGQ6Ol9fMjo6X19udW1fcHV0X2Jhc2U6Ol9faWRlbnRpZnlfcGFkZGluZyhjaGFyKiwgY2hhciosIHN0ZDo6X18yOjppb3NfYmFzZSBjb25zdCYprQZ1c3RkOjpfXzI6Ol9fbnVtX3B1dDxjaGFyPjo6X193aWRlbl9hbmRfZ3JvdXBfaW50KGNoYXIqLCBjaGFyKiwgY2hhciosIGNoYXIqLCBjaGFyKiYsIGNoYXIqJiwgc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYprgYrdm9pZCBzdGQ6Ol9fMjo6cmV2ZXJzZTxjaGFyKj4oY2hhciosIGNoYXIqKa8GIXN0ZDo6X18yOjppb3NfYmFzZTo6d2lkdGgoKSBjb25zdLAG0gFzdGQ6Ol9fMjo6bnVtX3B1dDxjaGFyLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIGNoYXIsIGxvbmcgbG9uZykgY29uc3SxBtYBc3RkOjpfXzI6Om51bV9wdXQ8Y2hhciwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCBjaGFyLCB1bnNpZ25lZCBsb25nKSBjb25zdLIG2wFzdGQ6Ol9fMjo6bnVtX3B1dDxjaGFyLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIGNoYXIsIHVuc2lnbmVkIGxvbmcgbG9uZykgY29uc3SzBs8Bc3RkOjpfXzI6Om51bV9wdXQ8Y2hhciwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCBjaGFyLCBkb3VibGUpIGNvbnN0tAZKc3RkOjpfXzI6Ol9fbnVtX3B1dF9iYXNlOjpfX2Zvcm1hdF9mbG9hdChjaGFyKiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGludCm1BiVzdGQ6Ol9fMjo6aW9zX2Jhc2U6OnByZWNpc2lvbigpIGNvbnN0tgZJc3RkOjpfXzI6Ol9fbGliY3BwX2FzcHJpbnRmX2woY2hhcioqLCBfX2xvY2FsZV9zdHJ1Y3QqLCBjaGFyIGNvbnN0KiwgLi4uKbcGd3N0ZDo6X18yOjpfX251bV9wdXQ8Y2hhcj46Ol9fd2lkZW5fYW5kX2dyb3VwX2Zsb2F0KGNoYXIqLCBjaGFyKiwgY2hhciosIGNoYXIqLCBjaGFyKiYsIGNoYXIqJiwgc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYpuAbUAXN0ZDo6X18yOjpudW1fcHV0PGNoYXIsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgY2hhciwgbG9uZyBkb3VibGUpIGNvbnN0uQbUAXN0ZDo6X18yOjpudW1fcHV0PGNoYXIsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgY2hhciwgdm9pZCBjb25zdCopIGNvbnN0ugbfAXN0ZDo6X18yOjpudW1fcHV0PHdjaGFyX3QsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgd2NoYXJfdCwgYm9vbCkgY29uc3S7BmVzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+OjplbmQoKbwG3wFzdGQ6Ol9fMjo6bnVtX3B1dDx3Y2hhcl90LCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHdjaGFyX3QsIGxvbmcpIGNvbnN0vQaBAXN0ZDo6X18yOjpfX251bV9wdXQ8d2NoYXJfdD46Ol9fd2lkZW5fYW5kX2dyb3VwX2ludChjaGFyKiwgY2hhciosIGNoYXIqLCB3Y2hhcl90Kiwgd2NoYXJfdComLCB3Y2hhcl90KiYsIHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKb4GowJzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiBzdGQ6Ol9fMjo6X19wYWRfYW5kX291dHB1dDx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPihzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgd2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0Kiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgd2NoYXJfdCm/BjR2b2lkIHN0ZDo6X18yOjpyZXZlcnNlPHdjaGFyX3QqPih3Y2hhcl90Kiwgd2NoYXJfdCopwAaEAXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID46OmJhc2ljX3N0cmluZyh1bnNpZ25lZCBsb25nLCB3Y2hhcl90KcEG5AFzdGQ6Ol9fMjo6bnVtX3B1dDx3Y2hhcl90LCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHdjaGFyX3QsIGxvbmcgbG9uZykgY29uc3TCBugBc3RkOjpfXzI6Om51bV9wdXQ8d2NoYXJfdCwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90LCB1bnNpZ25lZCBsb25nKSBjb25zdMMG7QFzdGQ6Ol9fMjo6bnVtX3B1dDx3Y2hhcl90LCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHdjaGFyX3QsIHVuc2lnbmVkIGxvbmcgbG9uZykgY29uc3TEBuEBc3RkOjpfXzI6Om51bV9wdXQ8d2NoYXJfdCwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90LCBkb3VibGUpIGNvbnN0xQaDAXN0ZDo6X18yOjpfX251bV9wdXQ8d2NoYXJfdD46Ol9fd2lkZW5fYW5kX2dyb3VwX2Zsb2F0KGNoYXIqLCBjaGFyKiwgY2hhciosIHdjaGFyX3QqLCB3Y2hhcl90KiYsIHdjaGFyX3QqJiwgc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYpxgbmAXN0ZDo6X18yOjpudW1fcHV0PHdjaGFyX3QsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgd2NoYXJfdCwgbG9uZyBkb3VibGUpIGNvbnN0xwbmAXN0ZDo6X18yOjpudW1fcHV0PHdjaGFyX3QsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgd2NoYXJfdCwgdm9pZCBjb25zdCopIGNvbnN0yAZTdm9pZCBzdGQ6Ol9fMjo6X19yZXZlcnNlPGNoYXIqPihjaGFyKiwgY2hhciosIHN0ZDo6X18yOjpyYW5kb21fYWNjZXNzX2l0ZXJhdG9yX3RhZynJBlx2b2lkIHN0ZDo6X18yOjpfX3JldmVyc2U8d2NoYXJfdCo+KHdjaGFyX3QqLCB3Y2hhcl90Kiwgc3RkOjpfXzI6OnJhbmRvbV9hY2Nlc3NfaXRlcmF0b3JfdGFnKcoGsAJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6Z2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdG0qLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdCopIGNvbnN0ywZzc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2RhdGVfb3JkZXIoKSBjb25zdMwGngJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0X3RpbWUoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB0bSopIGNvbnN0zQaeAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXRfZGF0ZShzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHRtKikgY29uc3TOBqECc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldF93ZWVrZGF5KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdG0qKSBjb25zdM8GrwJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfd2Vla2RheW5hbWUoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JikgY29uc3TQBqMCc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldF9tb250aG5hbWUoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB0bSopIGNvbnN00QatAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2dldF9tb250aG5hbWUoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JikgY29uc3TSBp4Cc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldF95ZWFyKHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdG0qKSBjb25zdNMGqAJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfeWVhcihpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdNQGpQJpbnQgc3RkOjpfXzI6Ol9fZ2V0X3VwX3RvX25fZGlnaXRzPGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JiwgaW50KdUGpQJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdG0qLCBjaGFyLCBjaGFyKSBjb25zdNYGpQJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfcGVyY2VudChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdNcGpwJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfZGF5KGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYpIGNvbnN02AaoAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2dldF9ob3VyKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYpIGNvbnN02QarAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2dldF8xMl9ob3VyKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYpIGNvbnN02gawAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2dldF9kYXlfeWVhcl9udW0oaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JikgY29uc3TbBqkCc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0X21vbnRoKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYpIGNvbnN03AaqAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2dldF9taW51dGUoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JikgY29uc3TdBqkCc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0X3doaXRlX3NwYWNlKHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYpIGNvbnN03gapAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2dldF9hbV9wbShpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdN8GqgJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfc2Vjb25kKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYpIGNvbnN04AarAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2dldF93ZWVrZGF5KGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYpIGNvbnN04QapAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2dldF95ZWFyNChpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdOIGywJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6Z2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdG0qLCB3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdCopIGNvbnN04wazAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXRfdGltZShzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHRtKikgY29uc3TkBrMCc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldF9kYXRlKHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdG0qKSBjb25zdOUGtgJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0X3dlZWtkYXkoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB0bSopIGNvbnN05gbHAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF93ZWVrZGF5bmFtZShpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmKSBjb25zdOcGuAJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0X21vbnRobmFtZShzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHRtKikgY29uc3ToBsUCc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZ2V0X21vbnRobmFtZShpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmKSBjb25zdOkGswJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0X3llYXIoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB0bSopIGNvbnN06gbAAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF95ZWFyKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN06wa9AmludCBzdGQ6Ol9fMjo6X19nZXRfdXBfdG9fbl9kaWdpdHM8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmLCBpbnQp7Aa6AnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB0bSosIGNoYXIsIGNoYXIpIGNvbnN07Qa9AnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF9wZXJjZW50KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN07ga/AnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF9kYXkoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JikgY29uc3TvBsACc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZ2V0X2hvdXIoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JikgY29uc3TwBsMCc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZ2V0XzEyX2hvdXIoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JikgY29uc3TxBsgCc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZ2V0X2RheV95ZWFyX251bShpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmKSBjb25zdPIGwQJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfbW9udGgoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JikgY29uc3TzBsICc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZ2V0X21pbnV0ZShpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmKSBjb25zdPQGwQJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfd2hpdGVfc3BhY2Uoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JikgY29uc3T1BsECc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZ2V0X2FtX3BtKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN09gbCAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF9zZWNvbmQoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JikgY29uc3T3BsMCc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZ2V0X3dlZWtkYXkoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JikgY29uc3T4BsECc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZ2V0X3llYXI0KGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN0+QbfAXN0ZDo6X18yOjp0aW1lX3B1dDxjaGFyLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIGNoYXIsIHRtIGNvbnN0KiwgY2hhciwgY2hhcikgY29uc3T6BkpzdGQ6Ol9fMjo6X190aW1lX3B1dDo6X19kb19wdXQoY2hhciosIGNoYXIqJiwgdG0gY29uc3QqLCBjaGFyLCBjaGFyKSBjb25zdPsGjQFzdGQ6Ol9fMjo6ZW5hYmxlX2lmPChpc19tb3ZlX2NvbnN0cnVjdGlibGU8Y2hhcj46OnZhbHVlKSAmJiAoaXNfbW92ZV9hc3NpZ25hYmxlPGNoYXI+Ojp2YWx1ZSksIHZvaWQ+Ojp0eXBlIHN0ZDo6X18yOjpzd2FwPGNoYXI+KGNoYXImLCBjaGFyJin8Bu4Bc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gc3RkOjpfXzI6Ol9fY29weTxjaGFyKiwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPihjaGFyKiwgY2hhciosIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Kf0G8QFzdGQ6Ol9fMjo6dGltZV9wdXQ8d2NoYXJfdCwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90LCB0bSBjb25zdCosIGNoYXIsIGNoYXIpIGNvbnN0/gZQc3RkOjpfXzI6Ol9fdGltZV9wdXQ6Ol9fZG9fcHV0KHdjaGFyX3QqLCB3Y2hhcl90KiYsIHRtIGNvbnN0KiwgY2hhciwgY2hhcikgY29uc3T/BmVzdGQ6Ol9fMjo6X19saWJjcHBfbWJzcnRvd2NzX2wod2NoYXJfdCosIGNoYXIgY29uc3QqKiwgdW5zaWduZWQgbG9uZywgX19tYnN0YXRlX3QqLCBfX2xvY2FsZV9zdHJ1Y3QqKYAHLHN0ZDo6X18yOjpfX3Rocm93X3J1bnRpbWVfZXJyb3IoY2hhciBjb25zdCopgQeJAnN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+IHN0ZDo6X18yOjpfX2NvcHk8d2NoYXJfdCosIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID4od2NoYXJfdCosIHdjaGFyX3QqLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPimCBztzdGQ6Ol9fMjo6bW9uZXlwdW5jdDxjaGFyLCBmYWxzZT46OmRvX2RlY2ltYWxfcG9pbnQoKSBjb25zdIMHNnN0ZDo6X18yOjptb25leXB1bmN0PGNoYXIsIGZhbHNlPjo6ZG9fZ3JvdXBpbmcoKSBjb25zdIQHO3N0ZDo6X18yOjptb25leXB1bmN0PGNoYXIsIGZhbHNlPjo6ZG9fbmVnYXRpdmVfc2lnbigpIGNvbnN0hQc4c3RkOjpfXzI6Om1vbmV5cHVuY3Q8Y2hhciwgZmFsc2U+Ojpkb19wb3NfZm9ybWF0KCkgY29uc3SGBz5zdGQ6Ol9fMjo6bW9uZXlwdW5jdDx3Y2hhcl90LCBmYWxzZT46OmRvX2RlY2ltYWxfcG9pbnQoKSBjb25zdIcHPnN0ZDo6X18yOjptb25leXB1bmN0PHdjaGFyX3QsIGZhbHNlPjo6ZG9fbmVnYXRpdmVfc2lnbigpIGNvbnN0iAepAnN0ZDo6X18yOjptb25leV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgYm9vbCwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgbG9uZyBkb3VibGUmKSBjb25zdIkHjANzdGQ6Ol9fMjo6bW9uZXlfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIGJvb2wsIHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmLCB1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCYsIGJvb2wmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmLCBzdGQ6Ol9fMjo6dW5pcXVlX3B0cjxjaGFyLCB2b2lkICgqKSh2b2lkKik+JiwgY2hhciomLCBjaGFyKimKB90Dc3RkOjpfXzI6Ol9fbW9uZXlfZ2V0PGNoYXI+OjpfX2dhdGhlcl9pbmZvKGJvb2wsIHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmLCBzdGQ6Ol9fMjo6bW9uZXlfYmFzZTo6cGF0dGVybiYsIGNoYXImLCBjaGFyJiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiYsIGludCYpiwdSc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46Om9wZXJhdG9yKysoaW50KYwHZnZvaWQgc3RkOjpfXzI6Ol9fZG91YmxlX29yX25vdGhpbmc8Y2hhcj4oc3RkOjpfXzI6OnVuaXF1ZV9wdHI8Y2hhciwgdm9pZCAoKikodm9pZCopPiYsIGNoYXIqJiwgY2hhciomKY0HhgF2b2lkIHN0ZDo6X18yOjpfX2RvdWJsZV9vcl9ub3RoaW5nPHVuc2lnbmVkIGludD4oc3RkOjpfXzI6OnVuaXF1ZV9wdHI8dW5zaWduZWQgaW50LCB2b2lkICgqKSh2b2lkKik+JiwgdW5zaWduZWQgaW50KiYsIHVuc2lnbmVkIGludComKY4H8wJzdGQ6Ol9fMjo6bW9uZXlfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIGJvb2wsIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4mKSBjb25zdI8HXnN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OmNsZWFyKCmQB9oBc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiYgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6X19hcHBlbmRfZm9yd2FyZF91bnNhZmU8Y2hhcio+KGNoYXIqLCBjaGFyKimRB3dzdGQ6Ol9fMjo6bW9uZXlwdW5jdDxjaGFyLCB0cnVlPiBjb25zdCYgc3RkOjpfXzI6OnVzZV9mYWNldDxzdGQ6Ol9fMjo6bW9uZXlwdW5jdDxjaGFyLCB0cnVlPiA+KHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKZIHuQFzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpvcGVyYXRvcj0oc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiYmKZMHeXN0ZDo6X18yOjptb25leXB1bmN0PGNoYXIsIGZhbHNlPiBjb25zdCYgc3RkOjpfXzI6OnVzZV9mYWNldDxzdGQ6Ol9fMjo6bW9uZXlwdW5jdDxjaGFyLCBmYWxzZT4gPihzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JimUB+8BYm9vbCBzdGQ6Ol9fMjo6ZXF1YWw8c3RkOjpfXzI6Ol9fd3JhcF9pdGVyPGNoYXIqPiwgc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPGNoYXIqPiwgc3RkOjpfXzI6Ol9fZXF1YWxfdG88Y2hhciwgY2hhcj4gPihzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8Y2hhcio+LCBzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8Y2hhcio+LCBzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8Y2hhcio+LCBzdGQ6Ol9fMjo6X19lcXVhbF90bzxjaGFyLCBjaGFyPimVBzNzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8Y2hhcio+OjpvcGVyYXRvcisobG9uZykgY29uc3SWB2VzdGQ6Ol9fMjo6dW5pcXVlX3B0cjxjaGFyLCB2b2lkICgqKSh2b2lkKik+OjpvcGVyYXRvcj0oc3RkOjpfXzI6OnVuaXF1ZV9wdHI8Y2hhciwgdm9pZCAoKikodm9pZCopPiYmKZcHvgJzdGQ6Ol9fMjo6bW9uZXlfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIGJvb2wsIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGxvbmcgZG91YmxlJikgY29uc3SYB60Dc3RkOjpfXzI6Om1vbmV5X2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2RvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBib29sLCBzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JiwgdW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQmLCBib29sJiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0Jiwgc3RkOjpfXzI6OnVuaXF1ZV9wdHI8d2NoYXJfdCwgdm9pZCAoKikodm9pZCopPiYsIHdjaGFyX3QqJiwgd2NoYXJfdCopmQeBBHN0ZDo6X18yOjpfX21vbmV5X2dldDx3Y2hhcl90Pjo6X19nYXRoZXJfaW5mbyhib29sLCBzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0Jiwgc3RkOjpfXzI6Om1vbmV5X2Jhc2U6OnBhdHRlcm4mLCB3Y2hhcl90Jiwgd2NoYXJfdCYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4mLCBpbnQmKZoHWHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+OjpvcGVyYXRvcisrKGludCmbB5EDc3RkOjpfXzI6Om1vbmV5X2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBib29sLCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+JikgY29uc3ScB2dzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+OjpjbGVhcigpnQf1AXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4mIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID46Ol9fYXBwZW5kX2ZvcndhcmRfdW5zYWZlPHdjaGFyX3QqPih3Y2hhcl90Kiwgd2NoYXJfdCopngd9c3RkOjpfXzI6Om1vbmV5cHVuY3Q8d2NoYXJfdCwgdHJ1ZT4gY29uc3QmIHN0ZDo6X18yOjp1c2VfZmFjZXQ8c3RkOjpfXzI6Om1vbmV5cHVuY3Q8d2NoYXJfdCwgdHJ1ZT4gPihzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JimfB8sBc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6b3BlcmF0b3I9KHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4mJimgB39zdGQ6Ol9fMjo6bW9uZXlwdW5jdDx3Y2hhcl90LCBmYWxzZT4gY29uc3QmIHN0ZDo6X18yOjp1c2VfZmFjZXQ8c3RkOjpfXzI6Om1vbmV5cHVuY3Q8d2NoYXJfdCwgZmFsc2U+ID4oc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYpoQeKAmJvb2wgc3RkOjpfXzI6OmVxdWFsPHN0ZDo6X18yOjpfX3dyYXBfaXRlcjx3Y2hhcl90Kj4sIHN0ZDo6X18yOjpfX3dyYXBfaXRlcjx3Y2hhcl90Kj4sIHN0ZDo6X18yOjpfX2VxdWFsX3RvPHdjaGFyX3QsIHdjaGFyX3Q+ID4oc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPHdjaGFyX3QqPiwgc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPHdjaGFyX3QqPiwgc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPHdjaGFyX3QqPiwgc3RkOjpfXzI6Ol9fZXF1YWxfdG88d2NoYXJfdCwgd2NoYXJfdD4pogc2c3RkOjpfXzI6Ol9fd3JhcF9pdGVyPHdjaGFyX3QqPjo6b3BlcmF0b3IrKGxvbmcpIGNvbnN0owfcAXN0ZDo6X18yOjptb25leV9wdXQ8Y2hhciwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBib29sLCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCBjaGFyLCBsb25nIGRvdWJsZSkgY29uc3SkB4sDc3RkOjpfXzI6Ol9fbW9uZXlfcHV0PGNoYXI+OjpfX2dhdGhlcl9pbmZvKGJvb2wsIGJvb2wsIHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmLCBzdGQ6Ol9fMjo6bW9uZXlfYmFzZTo6cGF0dGVybiYsIGNoYXImLCBjaGFyJiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+JiwgaW50JimlB9kDc3RkOjpfXzI6Ol9fbW9uZXlfcHV0PGNoYXI+OjpfX2Zvcm1hdChjaGFyKiwgY2hhciomLCBjaGFyKiYsIHVuc2lnbmVkIGludCwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmLCBib29sLCBzdGQ6Ol9fMjo6bW9uZXlfYmFzZTo6cGF0dGVybiBjb25zdCYsIGNoYXIsIGNoYXIsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QmLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCYsIGludCmmB44BY2hhciogc3RkOjpfXzI6OmNvcHk8c3RkOjpfXzI6Ol9fd3JhcF9pdGVyPGNoYXIgY29uc3QqPiwgY2hhcio+KHN0ZDo6X18yOjpfX3dyYXBfaXRlcjxjaGFyIGNvbnN0Kj4sIHN0ZDo6X18yOjpfX3dyYXBfaXRlcjxjaGFyIGNvbnN0Kj4sIGNoYXIqKacHrQJzdGQ6Ol9fMjo6bW9uZXlfcHV0PGNoYXIsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgYm9vbCwgc3RkOjpfXzI6Omlvc19iYXNlJiwgY2hhciwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCYpIGNvbnN0qAfuAXN0ZDo6X18yOjptb25leV9wdXQ8d2NoYXJfdCwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBib29sLCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90LCBsb25nIGRvdWJsZSkgY29uc3SpB6YDc3RkOjpfXzI6Ol9fbW9uZXlfcHV0PHdjaGFyX3Q+OjpfX2dhdGhlcl9pbmZvKGJvb2wsIGJvb2wsIHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmLCBzdGQ6Ol9fMjo6bW9uZXlfYmFzZTo6cGF0dGVybiYsIHdjaGFyX3QmLCB3Y2hhcl90Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+JiwgaW50JimqB4YEc3RkOjpfXzI6Ol9fbW9uZXlfcHV0PHdjaGFyX3Q+OjpfX2Zvcm1hdCh3Y2hhcl90Kiwgd2NoYXJfdComLCB3Y2hhcl90KiYsIHVuc2lnbmVkIGludCwgd2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmLCBib29sLCBzdGQ6Ol9fMjo6bW9uZXlfYmFzZTo6cGF0dGVybiBjb25zdCYsIHdjaGFyX3QsIHdjaGFyX3QsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QmLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+IGNvbnN0Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiBjb25zdCYsIGludCmrB6ABd2NoYXJfdCogc3RkOjpfXzI6OmNvcHk8c3RkOjpfXzI6Ol9fd3JhcF9pdGVyPHdjaGFyX3QgY29uc3QqPiwgd2NoYXJfdCo+KHN0ZDo6X18yOjpfX3dyYXBfaXRlcjx3Y2hhcl90IGNvbnN0Kj4sIHN0ZDo6X18yOjpfX3dyYXBfaXRlcjx3Y2hhcl90IGNvbnN0Kj4sIHdjaGFyX3QqKawHyAJzdGQ6Ol9fMjo6bW9uZXlfcHV0PHdjaGFyX3QsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgYm9vbCwgc3RkOjpfXzI6Omlvc19iYXNlJiwgd2NoYXJfdCwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiBjb25zdCYpIGNvbnN0rQeQAWNoYXIqIHN0ZDo6X18yOjpfX2NvcHk8c3RkOjpfXzI6Ol9fd3JhcF9pdGVyPGNoYXIgY29uc3QqPiwgY2hhcio+KHN0ZDo6X18yOjpfX3dyYXBfaXRlcjxjaGFyIGNvbnN0Kj4sIHN0ZDo6X18yOjpfX3dyYXBfaXRlcjxjaGFyIGNvbnN0Kj4sIGNoYXIqKa4HogF3Y2hhcl90KiBzdGQ6Ol9fMjo6X19jb3B5PHN0ZDo6X18yOjpfX3dyYXBfaXRlcjx3Y2hhcl90IGNvbnN0Kj4sIHdjaGFyX3QqPihzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8d2NoYXJfdCBjb25zdCo+LCBzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8d2NoYXJfdCBjb25zdCo+LCB3Y2hhcl90KimvB54Bc3RkOjpfXzI6Om1lc3NhZ2VzPGNoYXI+Ojpkb19vcGVuKHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QmLCBzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JikgY29uc3SwB5QBc3RkOjpfXzI6Om1lc3NhZ2VzPGNoYXI+Ojpkb19nZXQobG9uZywgaW50LCBpbnQsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QmKSBjb25zdLEHuANzdGQ6Ol9fMjo6YmFja19pbnNlcnRfaXRlcmF0b3I8c3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiA+IHN0ZDo6X18yOjpfX25hcnJvd190b191dGY4PDh1bD46Om9wZXJhdG9yKCk8c3RkOjpfXzI6OmJhY2tfaW5zZXJ0X2l0ZXJhdG9yPHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gPiwgY2hhcj4oc3RkOjpfXzI6OmJhY2tfaW5zZXJ0X2l0ZXJhdG9yPHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gPiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqKSBjb25zdLIHjgFzdGQ6Ol9fMjo6YmFja19pbnNlcnRfaXRlcmF0b3I8c3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiA+OjpvcGVyYXRvcj0oY2hhciBjb25zdCYpswegAXN0ZDo6X18yOjptZXNzYWdlczx3Y2hhcl90Pjo6ZG9fZ2V0KGxvbmcsIGludCwgaW50LCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+IGNvbnN0JikgY29uc3S0B8IDc3RkOjpfXzI6OmJhY2tfaW5zZXJ0X2l0ZXJhdG9yPHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gPiBzdGQ6Ol9fMjo6X19uYXJyb3dfdG9fdXRmODwzMnVsPjo6b3BlcmF0b3IoKTxzdGQ6Ol9fMjo6YmFja19pbnNlcnRfaXRlcmF0b3I8c3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiA+LCB3Y2hhcl90PihzdGQ6Ol9fMjo6YmFja19pbnNlcnRfaXRlcmF0b3I8c3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiA+LCB3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdCopIGNvbnN0tQfQA3N0ZDo6X18yOjpiYWNrX2luc2VydF9pdGVyYXRvcjxzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+ID4gc3RkOjpfXzI6Ol9fd2lkZW5fZnJvbV91dGY4PDMydWw+OjpvcGVyYXRvcigpPHN0ZDo6X18yOjpiYWNrX2luc2VydF9pdGVyYXRvcjxzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+ID4gPihzdGQ6Ol9fMjo6YmFja19pbnNlcnRfaXRlcmF0b3I8c3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiA+LCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdCopIGNvbnN0tgc5c3RkOjpfXzI6OmNvZGVjdnQ8d2NoYXJfdCwgY2hhciwgX19tYnN0YXRlX3Q+Ojp+Y29kZWN2dCgptwctc3RkOjpfXzI6OmxvY2FsZTo6X19pbXA6Ol9faW1wKHVuc2lnbmVkIGxvbmcpuAd+c3RkOjpfXzI6Ol9fdmVjdG9yX2Jhc2U8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4gPjo6X192ZWN0b3JfYmFzZSgpuQeCAXN0ZDo6X18yOjp2ZWN0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4gPjo6X192YWxsb2NhdGUodW5zaWduZWQgbG9uZym6B4kBc3RkOjpfXzI6OnZlY3RvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiA+OjpfX2NvbnN0cnVjdF9hdF9lbmQodW5zaWduZWQgbG9uZym7B3ZzdGQ6Ol9fMjo6X192ZWN0b3JfYmFzZTxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiA+OjpjbGVhcigpvAeOAXN0ZDo6X18yOjp2ZWN0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4gPjo6X19hbm5vdGF0ZV9zaHJpbmsodW5zaWduZWQgbG9uZykgY29uc3S9Bx1zdGQ6Ol9fMjo6bG9jYWxlOjppZDo6X19nZXQoKb4HQHN0ZDo6X18yOjpsb2NhbGU6Ol9faW1wOjppbnN0YWxsKHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgbG9uZym/B0hzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj46OmN0eXBlKHVuc2lnbmVkIHNob3J0IGNvbnN0KiwgYm9vbCwgdW5zaWduZWQgbG9uZynABxtzdGQ6Ol9fMjo6bG9jYWxlOjpjbGFzc2ljKCnBB31zdGQ6Ol9fMjo6dmVjdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46OnJlc2l6ZSh1bnNpZ25lZCBsb25nKcIHIXN0ZDo6X18yOjpsb2NhbGU6Ol9faW1wOjp+X19pbXAoKcMHgQFzdGQ6Ol9fMjo6dmVjdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46Ol9fYW5ub3RhdGVfZGVsZXRlKCkgY29uc3TEByNzdGQ6Ol9fMjo6bG9jYWxlOjpfX2ltcDo6fl9faW1wKCkuMcUHf3N0ZDo6X18yOjp2ZWN0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4gPjo6X19hcHBlbmQodW5zaWduZWQgbG9uZynGBxxzdGQ6Ol9fMjo6bG9jYWxlOjpfX2dsb2JhbCgpxwcac3RkOjpfXzI6OmxvY2FsZTo6bG9jYWxlKCnIBy5zdGQ6Ol9fMjo6bG9jYWxlOjpfX2ltcDo6aGFzX2ZhY2V0KGxvbmcpIGNvbnN0yQcec3RkOjpfXzI6OmxvY2FsZTo6aWQ6Ol9faW5pdCgpygeMAXZvaWQgc3RkOjpfXzI6OmNhbGxfb25jZTxzdGQ6Ol9fMjo6KGFub255bW91cyBuYW1lc3BhY2UpOjpfX2Zha2VfYmluZD4oc3RkOjpfXzI6Om9uY2VfZmxhZyYsIHN0ZDo6X18yOjooYW5vbnltb3VzIG5hbWVzcGFjZSk6Ol9fZmFrZV9iaW5kJiYpywcrc3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQ6Ol9fb25femVyb19zaGFyZWQoKcwHaXZvaWQgc3RkOjpfXzI6Ol9fY2FsbF9vbmNlX3Byb3h5PHN0ZDo6X18yOjp0dXBsZTxzdGQ6Ol9fMjo6KGFub255bW91cyBuYW1lc3BhY2UpOjpfX2Zha2VfYmluZCYmPiA+KHZvaWQqKc0HPnN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90Pjo6ZG9faXModW5zaWduZWQgc2hvcnQsIHdjaGFyX3QpIGNvbnN0zgdWc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+Ojpkb19pcyh3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdCosIHVuc2lnbmVkIHNob3J0KikgY29uc3TPB1pzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD46OmRvX3NjYW5faXModW5zaWduZWQgc2hvcnQsIHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0KikgY29uc3TQB1tzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD46OmRvX3NjYW5fbm90KHVuc2lnbmVkIHNob3J0LCB3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdCopIGNvbnN00Qczc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+Ojpkb190b3VwcGVyKHdjaGFyX3QpIGNvbnN00gdEc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+Ojpkb190b3VwcGVyKHdjaGFyX3QqLCB3Y2hhcl90IGNvbnN0KikgY29uc3TTBzNzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD46OmRvX3RvbG93ZXIod2NoYXJfdCkgY29uc3TUB0RzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD46OmRvX3RvbG93ZXIod2NoYXJfdCosIHdjaGFyX3QgY29uc3QqKSBjb25zdNUHLnN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90Pjo6ZG9fd2lkZW4oY2hhcikgY29uc3TWB0xzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD46OmRvX3dpZGVuKGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0Kiwgd2NoYXJfdCopIGNvbnN01wc4c3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+Ojpkb19uYXJyb3cod2NoYXJfdCwgY2hhcikgY29uc3TYB1ZzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD46OmRvX25hcnJvdyh3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdCosIGNoYXIsIGNoYXIqKSBjb25zdNkHH3N0ZDo6X18yOjpjdHlwZTxjaGFyPjo6fmN0eXBlKCnaByFzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj46On5jdHlwZSgpLjHbBy1zdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj46OmRvX3RvdXBwZXIoY2hhcikgY29uc3TcBztzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj46OmRvX3RvdXBwZXIoY2hhciosIGNoYXIgY29uc3QqKSBjb25zdN0HLXN0ZDo6X18yOjpjdHlwZTxjaGFyPjo6ZG9fdG9sb3dlcihjaGFyKSBjb25zdN4HO3N0ZDo6X18yOjpjdHlwZTxjaGFyPjo6ZG9fdG9sb3dlcihjaGFyKiwgY2hhciBjb25zdCopIGNvbnN03wdGc3RkOjpfXzI6OmN0eXBlPGNoYXI+Ojpkb193aWRlbihjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIGNoYXIqKSBjb25zdOAHMnN0ZDo6X18yOjpjdHlwZTxjaGFyPjo6ZG9fbmFycm93KGNoYXIsIGNoYXIpIGNvbnN04QdNc3RkOjpfXzI6OmN0eXBlPGNoYXI+Ojpkb19uYXJyb3coY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCBjaGFyLCBjaGFyKikgY29uc3TiB4QBc3RkOjpfXzI6OmNvZGVjdnQ8Y2hhciwgY2hhciwgX19tYnN0YXRlX3Q+Ojpkb19vdXQoX19tYnN0YXRlX3QmLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqJiwgY2hhciosIGNoYXIqLCBjaGFyKiYpIGNvbnN04wdgc3RkOjpfXzI6OmNvZGVjdnQ8Y2hhciwgY2hhciwgX19tYnN0YXRlX3Q+Ojpkb191bnNoaWZ0KF9fbWJzdGF0ZV90JiwgY2hhciosIGNoYXIqLCBjaGFyKiYpIGNvbnN05Adyc3RkOjpfXzI6OmNvZGVjdnQ8Y2hhciwgY2hhciwgX19tYnN0YXRlX3Q+Ojpkb19sZW5ndGgoX19tYnN0YXRlX3QmLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGxvbmcpIGNvbnN05Qc7c3RkOjpfXzI6OmNvZGVjdnQ8d2NoYXJfdCwgY2hhciwgX19tYnN0YXRlX3Q+Ojp+Y29kZWN2dCgpLjHmB5ABc3RkOjpfXzI6OmNvZGVjdnQ8d2NoYXJfdCwgY2hhciwgX19tYnN0YXRlX3Q+Ojpkb19vdXQoX19tYnN0YXRlX3QmLCB3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqJiwgY2hhciosIGNoYXIqLCBjaGFyKiYpIGNvbnN05wd1c3RkOjpfXzI6Ol9fbGliY3BwX3djc25ydG9tYnNfbChjaGFyKiwgd2NoYXJfdCBjb25zdCoqLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCBfX21ic3RhdGVfdCosIF9fbG9jYWxlX3N0cnVjdCop6AdMc3RkOjpfXzI6Ol9fbGliY3BwX3djcnRvbWJfbChjaGFyKiwgd2NoYXJfdCwgX19tYnN0YXRlX3QqLCBfX2xvY2FsZV9zdHJ1Y3QqKekHjwFzdGQ6Ol9fMjo6Y29kZWN2dDx3Y2hhcl90LCBjaGFyLCBfX21ic3RhdGVfdD46OmRvX2luKF9fbWJzdGF0ZV90JiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiYsIHdjaGFyX3QqLCB3Y2hhcl90Kiwgd2NoYXJfdComKSBjb25zdOoHdXN0ZDo6X18yOjpfX2xpYmNwcF9tYnNucnRvd2NzX2wod2NoYXJfdCosIGNoYXIgY29uc3QqKiwgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgX19tYnN0YXRlX3QqLCBfX2xvY2FsZV9zdHJ1Y3QqKesHYnN0ZDo6X18yOjpfX2xpYmNwcF9tYnJ0b3djX2wod2NoYXJfdCosIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBsb25nLCBfX21ic3RhdGVfdCosIF9fbG9jYWxlX3N0cnVjdCop7Adjc3RkOjpfXzI6OmNvZGVjdnQ8d2NoYXJfdCwgY2hhciwgX19tYnN0YXRlX3Q+Ojpkb191bnNoaWZ0KF9fbWJzdGF0ZV90JiwgY2hhciosIGNoYXIqLCBjaGFyKiYpIGNvbnN07QdCc3RkOjpfXzI6OmNvZGVjdnQ8d2NoYXJfdCwgY2hhciwgX19tYnN0YXRlX3Q+Ojpkb19lbmNvZGluZygpIGNvbnN07gdTc3RkOjpfXzI6Ol9fbGliY3BwX21idG93Y19sKHdjaGFyX3QqLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgbG9uZywgX19sb2NhbGVfc3RydWN0KinvBzFzdGQ6Ol9fMjo6X19saWJjcHBfbWJfY3VyX21heF9sKF9fbG9jYWxlX3N0cnVjdCop8Ad1c3RkOjpfXzI6OmNvZGVjdnQ8d2NoYXJfdCwgY2hhciwgX19tYnN0YXRlX3Q+Ojpkb19sZW5ndGgoX19tYnN0YXRlX3QmLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGxvbmcpIGNvbnN08QdXc3RkOjpfXzI6Ol9fbGliY3BwX21icmxlbl9sKGNoYXIgY29uc3QqLCB1bnNpZ25lZCBsb25nLCBfX21ic3RhdGVfdCosIF9fbG9jYWxlX3N0cnVjdCop8gdEc3RkOjpfXzI6OmNvZGVjdnQ8d2NoYXJfdCwgY2hhciwgX19tYnN0YXRlX3Q+Ojpkb19tYXhfbGVuZ3RoKCkgY29uc3TzB5QBc3RkOjpfXzI6OmNvZGVjdnQ8Y2hhcjE2X3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9fb3V0KF9fbWJzdGF0ZV90JiwgY2hhcjE2X3QgY29uc3QqLCBjaGFyMTZfdCBjb25zdCosIGNoYXIxNl90IGNvbnN0KiYsIGNoYXIqLCBjaGFyKiwgY2hhciomKSBjb25zdPQHtQFzdGQ6Ol9fMjo6dXRmMTZfdG9fdXRmOCh1bnNpZ25lZCBzaG9ydCBjb25zdCosIHVuc2lnbmVkIHNob3J0IGNvbnN0KiwgdW5zaWduZWQgc2hvcnQgY29uc3QqJiwgdW5zaWduZWQgY2hhciosIHVuc2lnbmVkIGNoYXIqLCB1bnNpZ25lZCBjaGFyKiYsIHVuc2lnbmVkIGxvbmcsIHN0ZDo6X18yOjpjb2RlY3Z0X21vZGUp9QeTAXN0ZDo6X18yOjpjb2RlY3Z0PGNoYXIxNl90LCBjaGFyLCBfX21ic3RhdGVfdD46OmRvX2luKF9fbWJzdGF0ZV90JiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiYsIGNoYXIxNl90KiwgY2hhcjE2X3QqLCBjaGFyMTZfdComKSBjb25zdPYHtQFzdGQ6Ol9fMjo6dXRmOF90b191dGYxNih1bnNpZ25lZCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgY2hhciBjb25zdCosIHVuc2lnbmVkIGNoYXIgY29uc3QqJiwgdW5zaWduZWQgc2hvcnQqLCB1bnNpZ25lZCBzaG9ydCosIHVuc2lnbmVkIHNob3J0KiYsIHVuc2lnbmVkIGxvbmcsIHN0ZDo6X18yOjpjb2RlY3Z0X21vZGUp9wd2c3RkOjpfXzI6OmNvZGVjdnQ8Y2hhcjE2X3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9fbGVuZ3RoKF9fbWJzdGF0ZV90JiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBsb25nKSBjb25zdPgHgAFzdGQ6Ol9fMjo6dXRmOF90b191dGYxNl9sZW5ndGgodW5zaWduZWQgY2hhciBjb25zdCosIHVuc2lnbmVkIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCBzdGQ6Ol9fMjo6Y29kZWN2dF9tb2RlKfkHRXN0ZDo6X18yOjpjb2RlY3Z0PGNoYXIxNl90LCBjaGFyLCBfX21ic3RhdGVfdD46OmRvX21heF9sZW5ndGgoKSBjb25zdPoHlAFzdGQ6Ol9fMjo6Y29kZWN2dDxjaGFyMzJfdCwgY2hhciwgX19tYnN0YXRlX3Q+Ojpkb19vdXQoX19tYnN0YXRlX3QmLCBjaGFyMzJfdCBjb25zdCosIGNoYXIzMl90IGNvbnN0KiwgY2hhcjMyX3QgY29uc3QqJiwgY2hhciosIGNoYXIqLCBjaGFyKiYpIGNvbnN0+weuAXN0ZDo6X18yOjp1Y3M0X3RvX3V0ZjgodW5zaWduZWQgaW50IGNvbnN0KiwgdW5zaWduZWQgaW50IGNvbnN0KiwgdW5zaWduZWQgaW50IGNvbnN0KiYsIHVuc2lnbmVkIGNoYXIqLCB1bnNpZ25lZCBjaGFyKiwgdW5zaWduZWQgY2hhciomLCB1bnNpZ25lZCBsb25nLCBzdGQ6Ol9fMjo6Y29kZWN2dF9tb2RlKfwHkwFzdGQ6Ol9fMjo6Y29kZWN2dDxjaGFyMzJfdCwgY2hhciwgX19tYnN0YXRlX3Q+Ojpkb19pbihfX21ic3RhdGVfdCYsIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdComLCBjaGFyMzJfdCosIGNoYXIzMl90KiwgY2hhcjMyX3QqJikgY29uc3T9B64Bc3RkOjpfXzI6OnV0ZjhfdG9fdWNzNCh1bnNpZ25lZCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgY2hhciBjb25zdCosIHVuc2lnbmVkIGNoYXIgY29uc3QqJiwgdW5zaWduZWQgaW50KiwgdW5zaWduZWQgaW50KiwgdW5zaWduZWQgaW50KiYsIHVuc2lnbmVkIGxvbmcsIHN0ZDo6X18yOjpjb2RlY3Z0X21vZGUp/gd2c3RkOjpfXzI6OmNvZGVjdnQ8Y2hhcjMyX3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9fbGVuZ3RoKF9fbWJzdGF0ZV90JiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBsb25nKSBjb25zdP8Hf3N0ZDo6X18yOjp1dGY4X3RvX3VjczRfbGVuZ3RoKHVuc2lnbmVkIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgc3RkOjpfXzI6OmNvZGVjdnRfbW9kZSmACCVzdGQ6Ol9fMjo6bnVtcHVuY3Q8Y2hhcj46On5udW1wdW5jdCgpgQgnc3RkOjpfXzI6Om51bXB1bmN0PGNoYXI+Ojp+bnVtcHVuY3QoKS4xgggoc3RkOjpfXzI6Om51bXB1bmN0PHdjaGFyX3Q+Ojp+bnVtcHVuY3QoKYMIKnN0ZDo6X18yOjpudW1wdW5jdDx3Y2hhcl90Pjo6fm51bXB1bmN0KCkuMYQIMnN0ZDo6X18yOjpudW1wdW5jdDxjaGFyPjo6ZG9fZGVjaW1hbF9wb2ludCgpIGNvbnN0hQgyc3RkOjpfXzI6Om51bXB1bmN0PGNoYXI+Ojpkb190aG91c2FuZHNfc2VwKCkgY29uc3SGCC1zdGQ6Ol9fMjo6bnVtcHVuY3Q8Y2hhcj46OmRvX2dyb3VwaW5nKCkgY29uc3SHCDBzdGQ6Ol9fMjo6bnVtcHVuY3Q8d2NoYXJfdD46OmRvX2dyb3VwaW5nKCkgY29uc3SICC1zdGQ6Ol9fMjo6bnVtcHVuY3Q8Y2hhcj46OmRvX3RydWVuYW1lKCkgY29uc3SJCDBzdGQ6Ol9fMjo6bnVtcHVuY3Q8d2NoYXJfdD46OmRvX3RydWVuYW1lKCkgY29uc3SKCHxzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+OjpiYXNpY19zdHJpbmcod2NoYXJfdCBjb25zdCopiwguc3RkOjpfXzI6Om51bXB1bmN0PGNoYXI+Ojpkb19mYWxzZW5hbWUoKSBjb25zdIwIMXN0ZDo6X18yOjpudW1wdW5jdDx3Y2hhcl90Pjo6ZG9fZmFsc2VuYW1lKCkgY29uc3SNCG1zdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpvcGVyYXRvcj0oY2hhciBjb25zdCopjgg1c3RkOjpfXzI6Ol9fdGltZV9nZXRfY19zdG9yYWdlPGNoYXI+OjpfX3dlZWtzKCkgY29uc3SPCBZzdGQ6Ol9fMjo6aW5pdF93ZWVrcygpkAgaX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuNTSRCDhzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8d2NoYXJfdD46Ol9fd2Vla3MoKSBjb25zdJIIF3N0ZDo6X18yOjppbml0X3d3ZWVrcygpkwgaX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuNjmUCHlzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+OjpvcGVyYXRvcj0od2NoYXJfdCBjb25zdCoplQg2c3RkOjpfXzI6Ol9fdGltZV9nZXRfY19zdG9yYWdlPGNoYXI+OjpfX21vbnRocygpIGNvbnN0lggXc3RkOjpfXzI6OmluaXRfbW9udGhzKCmXCBpfX2N4eF9nbG9iYWxfYXJyYXlfZHRvci44NJgIOXN0ZDo6X18yOjpfX3RpbWVfZ2V0X2Nfc3RvcmFnZTx3Y2hhcl90Pjo6X19tb250aHMoKSBjb25zdJkIGHN0ZDo6X18yOjppbml0X3dtb250aHMoKZoIG19fY3h4X2dsb2JhbF9hcnJheV9kdG9yLjEwOJsINXN0ZDo6X18yOjpfX3RpbWVfZ2V0X2Nfc3RvcmFnZTxjaGFyPjo6X19hbV9wbSgpIGNvbnN0nAgWc3RkOjpfXzI6OmluaXRfYW1fcG0oKZ0IG19fY3h4X2dsb2JhbF9hcnJheV9kdG9yLjEzMp4IOHN0ZDo6X18yOjpfX3RpbWVfZ2V0X2Nfc3RvcmFnZTx3Y2hhcl90Pjo6X19hbV9wbSgpIGNvbnN0nwgXc3RkOjpfXzI6OmluaXRfd2FtX3BtKCmgCBtfX2N4eF9nbG9iYWxfYXJyYXlfZHRvci4xMzWhCDFzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8Y2hhcj46Ol9feCgpIGNvbnN0oggZX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuMaMINHN0ZDo6X18yOjpfX3RpbWVfZ2V0X2Nfc3RvcmFnZTx3Y2hhcl90Pjo6X194KCkgY29uc3SkCBpfX2N4eF9nbG9iYWxfYXJyYXlfZHRvci4zMaUIMXN0ZDo6X18yOjpfX3RpbWVfZ2V0X2Nfc3RvcmFnZTxjaGFyPjo6X19YKCkgY29uc3SmCBpfX2N4eF9nbG9iYWxfYXJyYXlfZHRvci4zM6cINHN0ZDo6X18yOjpfX3RpbWVfZ2V0X2Nfc3RvcmFnZTx3Y2hhcl90Pjo6X19YKCkgY29uc3SoCBpfX2N4eF9nbG9iYWxfYXJyYXlfZHRvci4zNakIMXN0ZDo6X18yOjpfX3RpbWVfZ2V0X2Nfc3RvcmFnZTxjaGFyPjo6X19jKCkgY29uc3SqCBpfX2N4eF9nbG9iYWxfYXJyYXlfZHRvci4zN6sINHN0ZDo6X18yOjpfX3RpbWVfZ2V0X2Nfc3RvcmFnZTx3Y2hhcl90Pjo6X19jKCkgY29uc3SsCBpfX2N4eF9nbG9iYWxfYXJyYXlfZHRvci4zOa0IMXN0ZDo6X18yOjpfX3RpbWVfZ2V0X2Nfc3RvcmFnZTxjaGFyPjo6X19yKCkgY29uc3SuCBpfX2N4eF9nbG9iYWxfYXJyYXlfZHRvci40Ma8INHN0ZDo6X18yOjpfX3RpbWVfZ2V0X2Nfc3RvcmFnZTx3Y2hhcl90Pjo6X19yKCkgY29uc3SwCBpfX2N4eF9nbG9iYWxfYXJyYXlfZHRvci40M7EIaXN0ZDo6X18yOjp0aW1lX3B1dDxjaGFyLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojp+dGltZV9wdXQoKbIIa3N0ZDo6X18yOjp0aW1lX3B1dDxjaGFyLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojp+dGltZV9wdXQoKS4xswh4c3RkOjpfXzI6OnZlY3RvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiA+OjptYXhfc2l6ZSgpIGNvbnN0tAirAXN0ZDo6X18yOjphbGxvY2F0b3JfdHJhaXRzPHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiA+OjphbGxvY2F0ZShzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4mLCB1bnNpZ25lZCBsb25nKbUIiwFzdGQ6Ol9fMjo6dmVjdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46Ol9fYW5ub3RhdGVfbmV3KHVuc2lnbmVkIGxvbmcpIGNvbnN0tghfc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+OjphbGxvY2F0ZSh1bnNpZ25lZCBsb25nLCB2b2lkIGNvbnN0Kim3CD9zdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+OjphbGxvY2F0ZSh1bnNpZ25lZCBsb25nLCB2b2lkIGNvbnN0Kim4CMgBc3RkOjpfXzI6OmFsbG9jYXRvcl90cmFpdHM8c3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46OmRlYWxsb2NhdGUoc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+Jiwgc3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqKiwgdW5zaWduZWQgbG9uZym5CJsBc3RkOjpfXzI6Ol9fdmVjdG9yX2Jhc2U8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4gPjo6X19kZXN0cnVjdF9hdF9lbmQoc3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqKim6CCJzdGQ6Ol9fMjo6X190aW1lX3B1dDo6X190aW1lX3B1dCgpuwiIAXN0ZDo6X18yOjp2ZWN0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4gPjo6X19yZWNvbW1lbmQodW5zaWduZWQgbG9uZykgY29uc3S8CNgBc3RkOjpfXzI6Ol9fc3BsaXRfYnVmZmVyPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+Jj46Ol9fc3BsaXRfYnVmZmVyKHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiYpvQiRAXN0ZDo6X18yOjpfX3NwbGl0X2J1ZmZlcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiY+OjpfX2NvbnN0cnVjdF9hdF9lbmQodW5zaWduZWQgbG9uZym+CPMBc3RkOjpfXzI6OnZlY3RvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiA+OjpfX3N3YXBfb3V0X2NpcmN1bGFyX2J1ZmZlcihzdGQ6Ol9fMjo6X19zcGxpdF9idWZmZXI8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4mPiYpvwjGA3N0ZDo6X18yOjplbmFibGVfaWY8KChzdGQ6Ol9fMjo6aW50ZWdyYWxfY29uc3RhbnQ8Ym9vbCwgZmFsc2U+Ojp2YWx1ZSkgfHwgKCEoX19oYXNfY29uc3RydWN0PHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiwgYm9vbCosIGJvb2w+Ojp2YWx1ZSkpKSAmJiAoaXNfdHJpdmlhbGx5X21vdmVfY29uc3RydWN0aWJsZTxib29sPjo6dmFsdWUpLCB2b2lkPjo6dHlwZSBzdGQ6Ol9fMjo6YWxsb2NhdG9yX3RyYWl0czxzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4gPjo6X19jb25zdHJ1Y3RfYmFja3dhcmQ8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqPihzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4mLCBib29sKiwgYm9vbCosIGJvb2wqJinACHxzdGQ6Ol9fMjo6X19jb21wcmVzc2VkX3BhaXI8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqKiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+Jj46OnNlY29uZCgpwQjGAXN0ZDo6X18yOjpfX3NwbGl0X2J1ZmZlcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiY+OjpfX2Rlc3RydWN0X2F0X2VuZChzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCoqLCBzdGQ6Ol9fMjo6aW50ZWdyYWxfY29uc3RhbnQ8Ym9vbCwgZmFsc2U+KcIIQHN0ZDo6X18yOjooYW5vbnltb3VzIG5hbWVzcGFjZSk6Ol9fZmFrZV9iaW5kOjpvcGVyYXRvcigpKCkgY29uc3TDCEJzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+OjphbGxvY2F0ZSh1bnNpZ25lZCBsb25nLCB2b2lkIGNvbnN0KinECGtzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpfX2NsZWFyX2FuZF9zaHJpbmsoKcUIdHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID46Ol9fY2xlYXJfYW5kX3NocmluaygpxghDbG9uZyBkb3VibGUgc3RkOjpfXzI6Ol9fZG9fc3RydG9kPGxvbmcgZG91YmxlPihjaGFyIGNvbnN0KiwgY2hhcioqKccILXN0ZDo6X18yOjpfX3NoYXJlZF9jb3VudDo6fl9fc2hhcmVkX2NvdW50KCkuMcgIL3N0ZDo6X18yOjpfX3NoYXJlZF93ZWFrX2NvdW50OjpfX3JlbGVhc2Vfd2VhaygpyQhJc3RkOjpfXzI6Ol9fc2hhcmVkX3dlYWtfY291bnQ6Ol9fZ2V0X2RlbGV0ZXIoc3RkOjp0eXBlX2luZm8gY29uc3QmKSBjb25zdMoIRnN0ZDo6X18yOjpfX2NhbGxfb25jZSh1bnNpZ25lZCBsb25nIHZvbGF0aWxlJiwgdm9pZCosIHZvaWQgKCopKHZvaWQqKSnLCBtvcGVyYXRvciBuZXcodW5zaWduZWQgbG9uZynMCD1zdGQ6Ol9fMjo6X19saWJjcHBfcmVmc3RyaW5nOjpfX2xpYmNwcF9yZWZzdHJpbmcoY2hhciBjb25zdCopzQgHd21lbXNldM4ICHdtZW1tb3ZlzwhDc3RkOjpfXzI6Ol9fYmFzaWNfc3RyaW5nX2NvbW1vbjx0cnVlPjo6X190aHJvd19sZW5ndGhfZXJyb3IoKSBjb25zdNAIwQFzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpiYXNpY19zdHJpbmcoc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCYp0Qh5c3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6X19pbml0KGNoYXIgY29uc3QqLCB1bnNpZ25lZCBsb25nKdIIZnN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46On5iYXNpY19zdHJpbmcoKdMIeXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OmFzc2lnbihjaGFyIGNvbnN0KiwgdW5zaWduZWQgbG9uZynUCNMBc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6X19ncm93X2J5X2FuZF9yZXBsYWNlKHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIGNoYXIgY29uc3QqKdUIcnN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OnJlc2l6ZSh1bnNpZ25lZCBsb25nLCBjaGFyKdYIcnN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OmFwcGVuZCh1bnNpZ25lZCBsb25nLCBjaGFyKdcIdHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46Ol9fZXJhc2VfdG9fZW5kKHVuc2lnbmVkIGxvbmcp2Ai6AXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46Ol9fZ3Jvd19ieSh1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nKdkIP3N0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPjo6YXNzaWduKGNoYXIqLCB1bnNpZ25lZCBsb25nLCBjaGFyKdoIeXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OmFwcGVuZChjaGFyIGNvbnN0KiwgdW5zaWduZWQgbG9uZynbCGZzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpwdXNoX2JhY2soY2hhcincCHJzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpfX2luaXQodW5zaWduZWQgbG9uZywgY2hhcindCIUBc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6X19pbml0KHdjaGFyX3QgY29uc3QqLCB1bnNpZ25lZCBsb25nKd4IhQFzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+Ojphc3NpZ24od2NoYXJfdCBjb25zdCosIHVuc2lnbmVkIGxvbmcp3wjfAXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID46Ol9fZ3Jvd19ieV9hbmRfcmVwbGFjZSh1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB3Y2hhcl90IGNvbnN0KingCMMBc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6X19ncm93X2J5KHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcp4QiFAXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID46OmFwcGVuZCh3Y2hhcl90IGNvbnN0KiwgdW5zaWduZWQgbG9uZyniCHJzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+OjpwdXNoX2JhY2sod2NoYXJfdCnjCH5zdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+OjpfX2luaXQodW5zaWduZWQgbG9uZywgd2NoYXJfdCnkCEJzdGQ6Ol9fMjo6X192ZWN0b3JfYmFzZV9jb21tb248dHJ1ZT46Ol9fdGhyb3dfbGVuZ3RoX2Vycm9yKCkgY29uc3TlCA1hYm9ydF9tZXNzYWdl5ggSX19jeGFfcHVyZV92aXJ0dWFs5wgcc3RkOjpleGNlcHRpb246OndoYXQoKSBjb25zdOgIIHN0ZDo6bG9naWNfZXJyb3I6On5sb2dpY19lcnJvcigp6Qgzc3RkOjpfXzI6Ol9fbGliY3BwX3JlZnN0cmluZzo6fl9fbGliY3BwX3JlZnN0cmluZygp6ggic3RkOjpsb2dpY19lcnJvcjo6fmxvZ2ljX2Vycm9yKCkuMesIInN0ZDo6bGVuZ3RoX2Vycm9yOjp+bGVuZ3RoX2Vycm9yKCnsCBtzdGQ6OmJhZF9jYXN0Ojp3aGF0KCkgY29uc3TtCGFfX2N4eGFiaXYxOjpfX2Z1bmRhbWVudGFsX3R5cGVfaW5mbzo6Y2FuX2NhdGNoKF9fY3h4YWJpdjE6Ol9fc2hpbV90eXBlX2luZm8gY29uc3QqLCB2b2lkKiYpIGNvbnN07gg8aXNfZXF1YWwoc3RkOjp0eXBlX2luZm8gY29uc3QqLCBzdGQ6OnR5cGVfaW5mbyBjb25zdCosIGJvb2wp7whbX19jeHhhYml2MTo6X19jbGFzc190eXBlX2luZm86OmNhbl9jYXRjaChfX2N4eGFiaXYxOjpfX3NoaW1fdHlwZV9pbmZvIGNvbnN0Kiwgdm9pZComKSBjb25zdPAIDl9fZHluYW1pY19jYXN08QhrX19jeHhhYml2MTo6X19jbGFzc190eXBlX2luZm86OnByb2Nlc3NfZm91bmRfYmFzZV9jbGFzcyhfX2N4eGFiaXYxOjpfX2R5bmFtaWNfY2FzdF9pbmZvKiwgdm9pZCosIGludCkgY29uc3TyCG5fX2N4eGFiaXYxOjpfX2NsYXNzX3R5cGVfaW5mbzo6aGFzX3VuYW1iaWd1b3VzX3B1YmxpY19iYXNlKF9fY3h4YWJpdjE6Ol9fZHluYW1pY19jYXN0X2luZm8qLCB2b2lkKiwgaW50KSBjb25zdPMIcV9fY3h4YWJpdjE6Ol9fc2lfY2xhc3NfdHlwZV9pbmZvOjpoYXNfdW5hbWJpZ3VvdXNfcHVibGljX2Jhc2UoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQqLCBpbnQpIGNvbnN09AhzX19jeHhhYml2MTo6X19iYXNlX2NsYXNzX3R5cGVfaW5mbzo6aGFzX3VuYW1iaWd1b3VzX3B1YmxpY19iYXNlKF9fY3h4YWJpdjE6Ol9fZHluYW1pY19jYXN0X2luZm8qLCB2b2lkKiwgaW50KSBjb25zdPUIcl9fY3h4YWJpdjE6Ol9fdm1pX2NsYXNzX3R5cGVfaW5mbzo6aGFzX3VuYW1iaWd1b3VzX3B1YmxpY19iYXNlKF9fY3h4YWJpdjE6Ol9fZHluYW1pY19jYXN0X2luZm8qLCB2b2lkKiwgaW50KSBjb25zdPYIW19fY3h4YWJpdjE6Ol9fcGJhc2VfdHlwZV9pbmZvOjpjYW5fY2F0Y2goX19jeHhhYml2MTo6X19zaGltX3R5cGVfaW5mbyBjb25zdCosIHZvaWQqJikgY29uc3T3CF1fX2N4eGFiaXYxOjpfX3BvaW50ZXJfdHlwZV9pbmZvOjpjYW5fY2F0Y2goX19jeHhhYml2MTo6X19zaGltX3R5cGVfaW5mbyBjb25zdCosIHZvaWQqJikgY29uc3T4CFxfX2N4eGFiaXYxOjpfX3BvaW50ZXJfdHlwZV9pbmZvOjpjYW5fY2F0Y2hfbmVzdGVkKF9fY3h4YWJpdjE6Ol9fc2hpbV90eXBlX2luZm8gY29uc3QqKSBjb25zdPkIZl9fY3h4YWJpdjE6Ol9fcG9pbnRlcl90b19tZW1iZXJfdHlwZV9pbmZvOjpjYW5fY2F0Y2hfbmVzdGVkKF9fY3h4YWJpdjE6Ol9fc2hpbV90eXBlX2luZm8gY29uc3QqKSBjb25zdPoIgwFfX2N4eGFiaXYxOjpfX2NsYXNzX3R5cGVfaW5mbzo6cHJvY2Vzc19zdGF0aWNfdHlwZV9hYm92ZV9kc3QoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQgY29uc3QqLCB2b2lkIGNvbnN0KiwgaW50KSBjb25zdPsIc19fY3h4YWJpdjE6Ol9fdm1pX2NsYXNzX3R5cGVfaW5mbzo6c2VhcmNoX2JlbG93X2RzdChfX2N4eGFiaXYxOjpfX2R5bmFtaWNfY2FzdF9pbmZvKiwgdm9pZCBjb25zdCosIGludCwgYm9vbCkgY29uc3T8CIEBX19jeHhhYml2MTo6X19iYXNlX2NsYXNzX3R5cGVfaW5mbzo6c2VhcmNoX2Fib3ZlX2RzdChfX2N4eGFiaXYxOjpfX2R5bmFtaWNfY2FzdF9pbmZvKiwgdm9pZCBjb25zdCosIHZvaWQgY29uc3QqLCBpbnQsIGJvb2wpIGNvbnN0/Qh0X19jeHhhYml2MTo6X19iYXNlX2NsYXNzX3R5cGVfaW5mbzo6c2VhcmNoX2JlbG93X2RzdChfX2N4eGFiaXYxOjpfX2R5bmFtaWNfY2FzdF9pbmZvKiwgdm9pZCBjb25zdCosIGludCwgYm9vbCkgY29uc3T+CHJfX2N4eGFiaXYxOjpfX3NpX2NsYXNzX3R5cGVfaW5mbzo6c2VhcmNoX2JlbG93X2RzdChfX2N4eGFiaXYxOjpfX2R5bmFtaWNfY2FzdF9pbmZvKiwgdm9pZCBjb25zdCosIGludCwgYm9vbCkgY29uc3T/CG9fX2N4eGFiaXYxOjpfX2NsYXNzX3R5cGVfaW5mbzo6c2VhcmNoX2JlbG93X2RzdChfX2N4eGFiaXYxOjpfX2R5bmFtaWNfY2FzdF9pbmZvKiwgdm9pZCBjb25zdCosIGludCwgYm9vbCkgY29uc3SACYABX19jeHhhYml2MTo6X192bWlfY2xhc3NfdHlwZV9pbmZvOjpzZWFyY2hfYWJvdmVfZHN0KF9fY3h4YWJpdjE6Ol9fZHluYW1pY19jYXN0X2luZm8qLCB2b2lkIGNvbnN0Kiwgdm9pZCBjb25zdCosIGludCwgYm9vbCkgY29uc3SBCX9fX2N4eGFiaXYxOjpfX3NpX2NsYXNzX3R5cGVfaW5mbzo6c2VhcmNoX2Fib3ZlX2RzdChfX2N4eGFiaXYxOjpfX2R5bmFtaWNfY2FzdF9pbmZvKiwgdm9pZCBjb25zdCosIHZvaWQgY29uc3QqLCBpbnQsIGJvb2wpIGNvbnN0ggl8X19jeHhhYml2MTo6X19jbGFzc190eXBlX2luZm86OnNlYXJjaF9hYm92ZV9kc3QoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQgY29uc3QqLCB2b2lkIGNvbnN0KiwgaW50LCBib29sKSBjb25zdIMJCF9fc3RyZHVwhAkNX19nZXRUeXBlTmFtZYUJKl9fZW1iaW5kX3JlZ2lzdGVyX25hdGl2ZV9hbmRfYnVpbHRpbl90eXBlc4YJP3ZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9pbnRlZ2VyPGNoYXI+KGNoYXIgY29uc3QqKYcJRnZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9pbnRlZ2VyPHNpZ25lZCBjaGFyPihjaGFyIGNvbnN0KimICUh2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfaW50ZWdlcjx1bnNpZ25lZCBjaGFyPihjaGFyIGNvbnN0KimJCUB2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfaW50ZWdlcjxzaG9ydD4oY2hhciBjb25zdCopiglJdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX2ludGVnZXI8dW5zaWduZWQgc2hvcnQ+KGNoYXIgY29uc3QqKYsJPnZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9pbnRlZ2VyPGludD4oY2hhciBjb25zdCopjAlHdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX2ludGVnZXI8dW5zaWduZWQgaW50PihjaGFyIGNvbnN0KimNCT92b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfaW50ZWdlcjxsb25nPihjaGFyIGNvbnN0KimOCUh2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfaW50ZWdlcjx1bnNpZ25lZCBsb25nPihjaGFyIGNvbnN0KimPCT52b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfZmxvYXQ8ZmxvYXQ+KGNoYXIgY29uc3QqKZAJP3ZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9mbG9hdDxkb3VibGU+KGNoYXIgY29uc3QqKZEJQ3ZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9tZW1vcnlfdmlldzxjaGFyPihjaGFyIGNvbnN0KimSCUp2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfbWVtb3J5X3ZpZXc8c2lnbmVkIGNoYXI+KGNoYXIgY29uc3QqKZMJTHZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9tZW1vcnlfdmlldzx1bnNpZ25lZCBjaGFyPihjaGFyIGNvbnN0KimUCUR2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfbWVtb3J5X3ZpZXc8c2hvcnQ+KGNoYXIgY29uc3QqKZUJTXZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9tZW1vcnlfdmlldzx1bnNpZ25lZCBzaG9ydD4oY2hhciBjb25zdCoplglCdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX21lbW9yeV92aWV3PGludD4oY2hhciBjb25zdCoplwlLdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX21lbW9yeV92aWV3PHVuc2lnbmVkIGludD4oY2hhciBjb25zdCopmAlDdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX21lbW9yeV92aWV3PGxvbmc+KGNoYXIgY29uc3QqKZkJTHZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9tZW1vcnlfdmlldzx1bnNpZ25lZCBsb25nPihjaGFyIGNvbnN0KimaCUR2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfbWVtb3J5X3ZpZXc8ZmxvYXQ+KGNoYXIgY29uc3QqKZsJRXZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9tZW1vcnlfdmlldzxkb3VibGU+KGNoYXIgY29uc3QqKZwJbkVtc2NyaXB0ZW5CaW5kaW5nSW5pdGlhbGl6ZXJfbmF0aXZlX2FuZF9idWlsdGluX3R5cGVzOjpFbXNjcmlwdGVuQmluZGluZ0luaXRpYWxpemVyX25hdGl2ZV9hbmRfYnVpbHRpbl90eXBlcygpnQkIZGxtYWxsb2OeCQZkbGZyZWWfCQlkbHJlYWxsb2OgCRF0cnlfcmVhbGxvY19jaHVua6EJDWRpc3Bvc2VfY2h1bmuiCQRzYnJrowkEZm1vZKQJBWZtb2RspQkFbG9nMTCmCQZsb2cxMGanCQZzY2FsYm6oCQ1fX2ZwY2xhc3NpZnlsqQkGbWVtY3B5qgkGbWVtc2V0qwkHbWVtbW92ZawJCHNldFRocmV3rQkJc3RhY2tTYXZlrgkKc3RhY2tBbGxvY68JDHN0YWNrUmVzdG9yZbAJEF9fZ3Jvd1dhc21NZW1vcnmxCQtkeW5DYWxsX3ZpabIJDWR5bkNhbGxfdmlpaWmzCQxkeW5DYWxsX2RpaWm0CQ1keW5DYWxsX2RpaWlptQkMZHluQ2FsbF92aWlktgkNZHluQ2FsbF92aWlpZLcJC2R5bkNhbGxfdmlkuAkLZHluQ2FsbF9kaWm5CQ1keW5DYWxsX2RpZGlkugkOZHluQ2FsbF9kaWlkaWS7CQ5keW5DYWxsX2RpZGlkabwJD2R5bkNhbGxfZGlpZGlkab0JDWR5bkNhbGxfdmlkaWS+CQ5keW5DYWxsX3ZpaWRpZL8JDmR5bkNhbGxfdmlkaWRkwAkPZHluQ2FsbF92aWlkaWRkwQkPZHluQ2FsbF92aWRpZGRkwgkQZHluQ2FsbF92aWlkaWRkZMMJC2R5bkNhbGxfZGlkxAkMZHluQ2FsbF9kaWlkxQkOZHluQ2FsbF92aWRkZGnGCQ9keW5DYWxsX3ZpaWRkZGnHCQ1keW5DYWxsX2lpaWlkyAkNZHluQ2FsbF9kaWRkZMkJDGR5bkNhbGxfdmlkZMoJDWR5bkNhbGxfdmlpZGTLCQ1keW5DYWxsX2lpaWlpzAkMZHluQ2FsbF9kaWRkzQkNZHluQ2FsbF9kaWlkZM4JDmR5bkNhbGxfZGlpZGRkzwkOZHluQ2FsbF92aWZmaWnQCQ9keW5DYWxsX3ZpaWZmaWnRCQ9keW5DYWxsX2RpZGRpZGTSCRBkeW5DYWxsX2RpaWRkaWRk0wkPZHluQ2FsbF9kaWRkZGRk1AkQZHluQ2FsbF9kaWlkZGRkZNUJD2R5bkNhbGxfZGlkZGRpadYJEGR5bkNhbGxfZGlpZGRkaWnXCRFkeW5DYWxsX2RpZGRkZGRpadgJEmR5bkNhbGxfZGlpZGRkZGRpadkJDGR5bkNhbGxfZGlkadoJDWR5bkNhbGxfZGlpZGnbCQ9keW5DYWxsX2RpZGlkZGTcCRBkeW5DYWxsX2RpaWRpZGRk3QkNZHluQ2FsbF9kaWRkad4JDmR5bkNhbGxfZGlpZGRp3wkMZHluQ2FsbF92aWRp4AkNZHluQ2FsbF92aWlkaeEJDmR5bkNhbGxfdmlpaWlp4gkMZHluQ2FsbF9paWZp4wkNZHluQ2FsbF9paWlmaeQJCmR5bkNhbGxfZmnlCQtkeW5DYWxsX2ZpaeYJDWR5bkNhbGxfZmlpaWnnCQ5keW5DYWxsX2ZpaWlpaegJD2R5bkNhbGxfdmlpaWlkZOkJEGR5bkNhbGxfdmlpaWlpZGTqCQxkeW5DYWxsX3ZpaWbrCQ1keW5DYWxsX3ZpaWlm7AkNZHluQ2FsbF9paWlpZu0JDmR5bkNhbGxfZGlkZGlk7gkPZHluQ2FsbF9kaWlkZGlk7wkPZHluQ2FsbF9kaWRkZGlk8AkQZHluQ2FsbF9kaWlkZGRpZPEJDmR5bkNhbGxfZGlkZGRp8gkPZHluQ2FsbF9kaWlkZGRp8wkLZHluQ2FsbF9paWT0CQ9keW5DYWxsX2lpZGlpaWn1CQ5keW5DYWxsX2lpaWlpafYJEWR5bkNhbGxfaWlpaWlpaWlp9wkPZHluQ2FsbF9paWlpaWlp+AkOZHluQ2FsbF9paWlpaWT5CRBkeW5DYWxsX2lpaWlpaWlp+gkPZHluQ2FsbF92aWlpaWlp+wkJZHluQ2FsbF92/AkYbGVnYWxzdHViJGR5bkNhbGxfdmlpamlp/QkWbGVnYWxzdHViJGR5bkNhbGxfamlqaf4JGGxlZ2Fsc3R1YiRkeW5DYWxsX2lpaWlpav8JGWxlZ2Fsc3R1YiRkeW5DYWxsX2lpaWlpamqAChpsZWdhbHN0dWIkZHluQ2FsbF9paWlpaWlqagB1EHNvdXJjZU1hcHBpbmdVUkxjaHR0cDovL2xvY2FsaG9zdDo5MDAwL2F1ZGlvLXdvcmtsZXQvYnVpbGQve3t7IEZJTEVOQU1FX1JFUExBQ0VNRU5UX1NUUklOR1NfV0FTTV9CSU5BUllfRklMRSB9fX0ubWFw';
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




// STATICTOP = STATIC_BASE + 39952;
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
      return 40816;
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
var dynCall_diii = Module["dynCall_diii"] = asm["dynCall_diii"];
var dynCall_diiii = Module["dynCall_diiii"] = asm["dynCall_diiii"];
var dynCall_viid = Module["dynCall_viid"] = asm["dynCall_viid"];
var dynCall_viiid = Module["dynCall_viiid"] = asm["dynCall_viiid"];
var dynCall_di = Module["dynCall_di"] = asm["dynCall_di"];
var dynCall_vid = Module["dynCall_vid"] = asm["dynCall_vid"];
var dynCall_dii = Module["dynCall_dii"] = asm["dynCall_dii"];
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
var dynCall_did = Module["dynCall_did"] = asm["dynCall_did"];
var dynCall_diid = Module["dynCall_diid"] = asm["dynCall_diid"];
var dynCall_vidddi = Module["dynCall_vidddi"] = asm["dynCall_vidddi"];
var dynCall_viidddi = Module["dynCall_viidddi"] = asm["dynCall_viidddi"];
var dynCall_iiiid = Module["dynCall_iiiid"] = asm["dynCall_iiiid"];
var dynCall_diddd = Module["dynCall_diddd"] = asm["dynCall_diddd"];
var dynCall_dddd = Module["dynCall_dddd"] = asm["dynCall_dddd"];
var dynCall_vidd = Module["dynCall_vidd"] = asm["dynCall_vidd"];
var dynCall_viidd = Module["dynCall_viidd"] = asm["dynCall_viidd"];
var dynCall_iiii = Module["dynCall_iiii"] = asm["dynCall_iiii"];
var dynCall_iiiii = Module["dynCall_iiiii"] = asm["dynCall_iiiii"];
var dynCall_didd = Module["dynCall_didd"] = asm["dynCall_didd"];
var dynCall_diidd = Module["dynCall_diidd"] = asm["dynCall_diidd"];
var dynCall_diiddd = Module["dynCall_diiddd"] = asm["dynCall_diiddd"];
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
function __ZN7maxiOsc8triangleEd(Larg0,Larg1){
	var tmp0=-0.;
	tmp0=+Larg0.d1;
	if(tmp0>=1){
		tmp0+=-1;
		Larg0.d1=tmp0;
	}
	tmp0+=(1/((+(__ZN12maxiSettings10sampleRateE|0))/Larg1));
	Larg0.d1=tmp0;
	if(!(tmp0<=.5)){
		tmp0=1-tmp0;
	}
	tmp0=(tmp0+-0.25)*4;
	Larg0.d4=tmp0;
	return tmp0;
}
function __ZN7maxiOsc4rectEdd(Larg0,Larg1,Larg2){
	return +Larg0.d4;
}
function __ZN7maxiOsc4sawnEd(Larg0,Larg1){
	var tmp0=0,tmp1=-0.,tmp2=-0.,tmp3=-0.;
	tmp1=+Larg0.d1;
	if(tmp1>=.5){
		tmp1+=-1;
		Larg0.d1=tmp1;
	}
	tmp1+=(1/((+(__ZN12maxiSettings10sampleRateE|0))/Larg1));
	Larg0.d1=tmp1;
	tmp2=8820.22/Larg1*tmp1;
	if(tmp2<-0.5){
		tmp2=-0.5;
	}else if(tmp2>.5){
		tmp2=.5;
	}
	tmp2=tmp2*1000+500;
	tmp3=+Math.floor(tmp2);
	tmp3=tmp2-tmp3;
	tmp0=~~tmp2;
	tmp1=tmp3* +_transition[tmp0+1|0]+ +_transition[tmp0]*(1-tmp3)-tmp1;
	Larg0.d4=tmp1;
	return tmp1;
}
function __ZN7maxiOsc3sawEd(Larg0,Larg1){
	var tmp0=-0.,tmp1=-0.;
	tmp0=+Larg0.d1;
	Larg0.d4=tmp0;
	if(tmp0>=1){
		tmp1=tmp0+-2;
		Larg0.d1=tmp1;
	}else{
		tmp1=tmp0;
	}
	Larg0.d1=tmp1+1/((+(__ZN12maxiSettings10sampleRateE|0))/Larg1)*2;
	return tmp0;
}
function __ZN7maxiOsc6phasorEddd(Larg0,Larg1,Larg2,Larg3){
	var tmp0=-0.,L$pmux=-0.,tmp2=-0.;
	tmp0=+Larg0.d1;
	Larg0.d4=tmp0;
	if(tmp0<Larg2){
		tmp2=Larg2;
	}else{
		tmp2=tmp0;
	}
	L$pmux=tmp2>=Larg3?Larg2:tmp2;
	a:{
		if(!(tmp2>=Larg3))if(!(tmp0<Larg2))break a;
		Larg0.d1=L$pmux;
		tmp2=L$pmux;
	}
	Larg0.d1=tmp2+(Larg3-Larg2)/((+(__ZN12maxiSettings10sampleRateE|0))/Larg1);
	return tmp0;
}
function __ZN7maxiOsc7impulseEd(Larg0,Larg1){
	var tmp0=-0.,tmp1=-0.;
	tmp1=+Larg0.d1;
	if(tmp1>=1){
		tmp1+=-1;
		Larg0.d1=tmp1;
	}
	tmp0=1/((+(__ZN12maxiSettings10sampleRateE|0))/Larg1);
	Larg0.d1=tmp1+tmp0;
	return tmp1<tmp0?1:0;
}
function __ZN7maxiOsc5pulseEdd(Larg0,Larg1,Larg2){
	var tmp0=-0.,tmp1=-0.;
	if(Larg2<0){
		tmp0=0;
	}else if(Larg2>1){
		tmp0=1;
	}else{
		tmp0=Larg2;
	}
	tmp1=+Larg0.d1;
	if(tmp1>=1){
		tmp1+=-1;
		Larg0.d1=tmp1;
	}
	tmp1+=(1/((+(__ZN12maxiSettings10sampleRateE|0))/Larg1));
	Larg0.d1=tmp1;
	if(tmp1<tmp0)Larg0.d4=-1;
	if(tmp1>tmp0){
		Larg0.d4=1;
		return 1;
	}
	return +Larg0.d4;
}
function __ZN7maxiOsc6squareEd(Larg0,Larg1){
	var tmp0=-0.;
	tmp0=+Larg0.d1;
	if(tmp0<.5)Larg0.d4=-1;
	if(tmp0>.5)Larg0.d4=1;
	if(tmp0>=1){
		tmp0+=-1;
		Larg0.d1=tmp0;
	}
	Larg0.d1=tmp0+1/((+(__ZN12maxiSettings10sampleRateE|0))/Larg1);
	return +Larg0.d4;
}
function __ZN7maxiOsc6phasorEd(Larg0,Larg1){
	var tmp0=-0.,tmp1=-0.;
	tmp0=+Larg0.d1;
	Larg0.d4=tmp0;
	if(tmp0>=1){
		tmp1=tmp0+-1;
		Larg0.d1=tmp1;
	}else{
		tmp1=tmp0;
	}
	Larg0.d1=tmp1+1/((+(__ZN12maxiSettings10sampleRateE|0))/Larg1);
	return tmp0;
}
function __ZN7maxiOsc7coswaveEd(Larg0,Larg1){
	var tmp0=-0.,tmp1=-0.;
	tmp0=+Math.cos( +Larg0.d1*6.2831853071795862);
	Larg0.d4=tmp0;
	tmp1=+Larg0.d1;
	if(tmp1>=1){
		tmp1+=-1;
		Larg0.d1=tmp1;
	}
	Larg0.d1=tmp1+1/((+(__ZN12maxiSettings10sampleRateE|0))/Larg1);
	return tmp0;
}
function __ZN7maxiOsc7sinebufEd(Larg0,Larg1){
	var tmp0=0,tmp1=-0.,tmp2=-0.;
	tmp1= +Larg0.d1+512/((+(__ZN12maxiSettings10sampleRateE|0))/Larg1);
	if(tmp1>=511){
		tmp1+=-512;
	}
	Larg0.d1=tmp1;
	tmp2=+Math.floor(tmp1);
	tmp2=tmp1-tmp2;
	tmp0=~~tmp1;
	tmp1=(1-tmp2)* +_sineBuffer[tmp0+1|0]+tmp2* +_sineBuffer[tmp0+2|0];
	Larg0.d4=tmp1;
	return tmp1;
}
function __ZN7maxiOsc8sinebuf4Ed(Larg0,Larg1){
	var tmp0=0,tmp1=-0.,tmp2=-0.,tmp3=-0.,tmp4=-0.,tmp5=-0.;
	tmp3= +Larg0.d1+512/((+(__ZN12maxiSettings10sampleRateE|0))/Larg1);
	if(tmp3>=511){
		tmp3+=-512;
	}
	Larg0.d1=tmp3;
	tmp4=+Math.floor(tmp3);
	tmp4=tmp3-tmp4;
	tmp0=~~tmp3;
	if(tmp3===0){
		tmp1=+_sineBuffer[tmp0+1|0];
		tmp2=+_sineBuffer[tmp0+2|0];
		tmp5=+_sineBuffer[tmp0];
		tmp3=0;
	}else{
		tmp1=+_sineBuffer[tmp0+1|0];
		tmp2=+_sineBuffer[tmp0+2|0];
		tmp3=+_sineBuffer[tmp0-1|0];
		tmp5=+_sineBuffer[tmp0];
	}
	tmp5+=(tmp4*((tmp1-tmp3)*.5+tmp4*(tmp3-tmp5*2.5+tmp1*2-tmp2*.5+tmp4*((tmp5-tmp1)*1.5+(tmp2-tmp3)*.5))));
	Larg0.d4=tmp5;
	return tmp5;
}
function __ZN7maxiOsc8sinewaveEd(Larg0,Larg1){
	var tmp0=-0.,tmp1=-0.;
	tmp0=+Math.sin( +Larg0.d1*6.2831853071795862);
	Larg0.d4=tmp0;
	tmp1=+Larg0.d1;
	if(tmp1>=1){
		tmp1+=-1;
		Larg0.d1=tmp1;
	}
	Larg0.d1=tmp1+1/((+(__ZN12maxiSettings10sampleRateE|0))/Larg1);
	return tmp0;
}
function __ZN7maxiOsc10phaseResetEd(Larg0,Larg1){
	Larg0.d1=Larg1;
}
function __ZN7maxiOsc5noiseEv(Larg0){
	var tmp0=0,tmp1=0,tmp2=0,tmp3=0,tmp4=0,tmp5=0,tmp6=-0.,L$poptgep11$poptgep$poptgepsqueezed=null,L$poptgep$poptgep$poptgepsqueezed=null,L$ppre$pi=0;
	L$poptgep11$poptgep$poptgepsqueezed=_impure_data$p14;
	if(L$poptgep11$poptgep$poptgepsqueezed!==null){
		L$poptgep$poptgep$poptgepsqueezed=L$poptgep11$poptgep$poptgepsqueezed.a3;
		L$ppre$pi=L$poptgep$poptgep$poptgepsqueezed[1]|0;
		tmp0=L$poptgep$poptgep$poptgepsqueezed[0]|0;
		tmp1=L$ppre$pi*1284865837|0;
	}else{
		L$poptgep11$poptgep$poptgepsqueezed={a0:new Uint16Array(3),a1:new Uint16Array(3),i2:0,a3:new Int32Array(2)};
		_impure_data$p14=L$poptgep11$poptgep$poptgepsqueezed;
		L$poptgep$poptgep$poptgepsqueezed=L$poptgep11$poptgep$poptgepsqueezed.a0;
		L$poptgep$poptgep$poptgepsqueezed[0]=13070;
		L$poptgep$poptgep$poptgepsqueezed[1]=43981;
		L$poptgep$poptgep$poptgepsqueezed[2]=4660;
		L$poptgep$poptgep$poptgepsqueezed=L$poptgep11$poptgep$poptgepsqueezed.a1;
		L$poptgep$poptgep$poptgepsqueezed[0]=58989;
		L$poptgep$poptgep$poptgepsqueezed[1]=57068;
		L$poptgep$poptgep$poptgepsqueezed[2]=5;
		L$poptgep11$poptgep$poptgepsqueezed.i2=11;
		L$poptgep$poptgep$poptgepsqueezed=L$poptgep11$poptgep$poptgepsqueezed.a3;
		L$poptgep$poptgep$poptgepsqueezed[1]=0;
		L$poptgep$poptgep$poptgepsqueezed[0]=1;
		tmp1=0;
		tmp0=1;
	}
	tmp2=tmp0>>>16;
	L$ppre$pi=tmp0&65535;
	tmp3=(tmp2*32557|0)+(L$ppre$pi*19605|0)|0;
	tmp4=tmp3<<16;
	L$ppre$pi=L$ppre$pi*32557|0;
	tmp5=tmp4+L$ppre$pi|0;
	L$ppre$pi=(((((tmp0*1481765933|0)+tmp1|0)+(tmp2*19605|0)|0)+(tmp3>>>16)|0)+(tmp4>>>0>(L$ppre$pi^ -1)>>>0?1:0)|0)+((tmp5|0)===-1?1:0)|0;
	L$poptgep11$poptgep$poptgepsqueezed=L$poptgep11$poptgep$poptgepsqueezed.a3;
	L$poptgep11$poptgep$poptgepsqueezed[1]=L$ppre$pi;
	L$poptgep11$poptgep$poptgepsqueezed[0]=tmp5+1|0;
	tmp6=(+(L$ppre$pi&2147483647|0))*4.6566128730773926E-10*2+-1;
	Larg0.d4=tmp6;
	return tmp6;
}
function __ZN7maxiOscC1Ev(Larg0){
	Larg0.d1=0;
}
function __ZN12maxiRatioSeqC1Ev(Larg0){
	Larg0.d0=0;
	Larg0.i1=0;
}
function __ZN12maxiRatioSeq10playValuesEdPN6client12Float64ArrayES2_(Larg0,Larg1,Larg2,Larg3){
	var L$psroa$p7$p0=null,L$psroa$p7$p0o=0,tmp1=-0.,L$p=0,Lgeptoindexphi6=0,L$psroa$p0$p0=null,Lgeptoindexphi=0,Lgeptoindexphi2=0;
	L$p=~~ +Larg2.length;
	Lgeptoindexphi6=L$p<<3;
	if((Lgeptoindexphi6|0)!==0){
		L$psroa$p0$p0=new Float64Array(Lgeptoindexphi6/8|0);
		if((Lgeptoindexphi6|0)>0){
			L$p&=536870911;
			if((L$p|0)!==0){
				Lgeptoindexphi=0;
				Lgeptoindexphi6=0;
				while(1){
					L$psroa$p0$p0[Lgeptoindexphi]=+Larg2[0+Lgeptoindexphi6|0];
					Lgeptoindexphi=Lgeptoindexphi+1|0;
					if(L$psroa$p0$p0!==L$psroa$p0$p0||(0+L$p|0)!==(0+Lgeptoindexphi|0)){
						Lgeptoindexphi6=Lgeptoindexphi6+1|0;
						continue;
					}
					break;
				}
			}
		}
	}
	L$p=~~ +Larg3.length;
	Lgeptoindexphi6=L$p<<3;
	if((Lgeptoindexphi6|0)!==0){
		L$psroa$p0$p0=new Float64Array(Lgeptoindexphi6/8|0);
		if((Lgeptoindexphi6|0)>0){
			Lgeptoindexphi6=L$p&536870911;
			if((Lgeptoindexphi6|0)!==0){
				Lgeptoindexphi2=0;
				Lgeptoindexphi=0;
				while(1){
					L$psroa$p0$p0[Lgeptoindexphi2]=+Larg3[0+Lgeptoindexphi|0];
					Lgeptoindexphi2=Lgeptoindexphi2+1|0;
					if(L$psroa$p0$p0!==L$psroa$p0$p0||(0+Lgeptoindexphi6|0)!==(0+Lgeptoindexphi2|0)){
						Lgeptoindexphi=Lgeptoindexphi+1|0;
						continue;
					}
					break;
				}
			}
			L$psroa$p7$p0o=0+(L$p&536870911)|0;
			L$psroa$p7$p0=L$psroa$p0$p0;
		}else{
			L$psroa$p7$p0o=0;
			L$psroa$p7$p0=L$psroa$p0$p0;
		}
	}else{
		L$psroa$p0$p0=nullArray;
		L$psroa$p7$p0o=0;
		L$psroa$p7$p0=nullArray;
	}
	tmp1=+__ZN12maxiRatioSeq8playTrigEdPN6client12Float64ArrayE(Larg0,Larg1,Larg2);
	L$p=Larg0.i1|0;
	if(tmp1===0)return +L$psroa$p0$p0[L$p];
	L$p=L$p+1|0;
	L$p=(L$p|0)===(((L$psroa$p7$p0o)*8)-((0)*8)>>3|0)?0|0:L$p|0;
	Larg0.i1=L$p;
	return +L$psroa$p0$p0[L$p];
}
function __ZN12maxiRatioSeq8playTrigEdPN6client12Float64ArrayE(Larg0,Larg1,Larg2){
	var L$psroa$p9$p011=null,L$psroa$p9$p011o=0,tmp1=-0.,tmp2=-0.,tmp3=0,Lgeptoindexphi=0,L$psroa$p0$p012=null,Lgeptoindexphi3=0,Lgeptoindexphi6=0,tmp8=-0.,tmp9=-0.,tmp10=-0.;
	tmp3=~~ +Larg2.length;
	Lgeptoindexphi=tmp3<<3;
	if((Lgeptoindexphi|0)!==0){
		L$psroa$p0$p012=new Float64Array(Lgeptoindexphi/8|0);
		if((Lgeptoindexphi|0)>0){
			Lgeptoindexphi=tmp3&536870911;
			if((Lgeptoindexphi|0)!==0){
				Lgeptoindexphi6=0;
				Lgeptoindexphi3=0;
				while(1){
					L$psroa$p0$p012[Lgeptoindexphi6]=+Larg2[0+Lgeptoindexphi3|0];
					Lgeptoindexphi6=Lgeptoindexphi6+1|0;
					if(L$psroa$p0$p012!==L$psroa$p0$p012||(0+Lgeptoindexphi|0)!==(0+Lgeptoindexphi6|0)){
						Lgeptoindexphi3=Lgeptoindexphi3+1|0;
						continue;
					}
					break;
				}
			}
			tmp3&=536870911;
			if((tmp3|0)!==0){
				Lgeptoindexphi3=0;
				Lgeptoindexphi=0;
				while(1){
					Lgeptoindexphi3=~~( +L$psroa$p0$p012[Lgeptoindexphi]+(+(Lgeptoindexphi3|0)));
					Lgeptoindexphi=Lgeptoindexphi+1|0;
					if(L$psroa$p0$p012!==L$psroa$p0$p012||(0+Lgeptoindexphi|0)!==(0+tmp3|0))continue;
					break;
				}
				L$psroa$p9$p011o=0+tmp3|0;
				L$psroa$p9$p011=L$psroa$p0$p012;
				tmp1=(+(Lgeptoindexphi3|0));
			}else{
				L$psroa$p9$p011o=0+tmp3|0;
				L$psroa$p9$p011=L$psroa$p0$p012;
				tmp1=0;
			}
		}else{
			L$psroa$p9$p011o=0;
			L$psroa$p9$p011=L$psroa$p0$p012;
			tmp1=0;
		}
	}else{
		tmp1=0;
		L$psroa$p9$p011o=0;
		L$psroa$p9$p011=nullArray;
		L$psroa$p0$p012=nullArray;
	}
	tmp3=((0)*8);
	Lgeptoindexphi=((L$psroa$p9$p011o)*8);
	if((Lgeptoindexphi|0)===(tmp3|0)){
		Larg0.d0=Larg1;
		return 0;
	}
	tmp3=Lgeptoindexphi-tmp3>>3;
	tmp2=-1/(+(__ZN12maxiSettings10sampleRateE|0));
	tmp8=0;
	Lgeptoindexphi=0;
	while(1){
		tmp8+= +L$psroa$p0$p012[Lgeptoindexphi];
		tmp9=tmp8/tmp1;
		if(tmp9===1){
			tmp9=0;
		}
		tmp10=+Larg0.d0;
		if(tmp10>Larg1){
			Larg0.d0=tmp2;
			tmp10=tmp2;
		}
		Lgeptoindexphi3=tmp10<=tmp9?1:0;
		if(tmp9<Larg1)if(Lgeptoindexphi3){
			Larg0.d0=Larg1;
			return 1;
		}
		Lgeptoindexphi=Lgeptoindexphi+1|0;
		if(Lgeptoindexphi>>>0<tmp3>>>0)continue;
		break;
	}
	Larg0.d0=Larg1;
	return 0;
}
function __ZN9maxiIndexC1Ev(Larg0){
	Larg0.d0=1;
	Larg0.i1=1;
	Larg0.d2=0;
}
function __ZN9maxiIndex4pullEddPN6client12Float64ArrayE(Larg0,Larg1,Larg2,Larg3){
	var Lgeptoindexphi=0,L$psroa$p7$p0=null,L$psroa$p7$p0o=0,tmp2=0,tmp3=0,L$psroa$p0$p0=null,Lgeptoindexphi2=0,tmp6=-0.;
	tmp2=~~ +Larg3.length;
	tmp3=tmp2<<3;
	if((tmp3|0)!==0){
		L$psroa$p0$p0=new Float64Array(tmp3/8|0);
		if((tmp3|0)>0){
			tmp3=tmp2&536870911;
			if((tmp3|0)!==0){
				Lgeptoindexphi2=0;
				Lgeptoindexphi=0;
				while(1){
					L$psroa$p0$p0[Lgeptoindexphi2]=+Larg3[0+Lgeptoindexphi|0];
					Lgeptoindexphi2=Lgeptoindexphi2+1|0;
					if(L$psroa$p0$p0!==L$psroa$p0$p0||(0+tmp3|0)!==(0+Lgeptoindexphi2|0)){
						Lgeptoindexphi=Lgeptoindexphi+1|0;
						continue;
					}
					break;
				}
			}
			L$psroa$p7$p0o=0+(tmp2&536870911)|0;
			L$psroa$p7$p0=L$psroa$p0$p0;
		}else{
			L$psroa$p7$p0o=0;
			L$psroa$p7$p0=L$psroa$p0$p0;
		}
	}else{
		L$psroa$p0$p0=nullArray;
		L$psroa$p7$p0o=0;
		L$psroa$p7$p0=nullArray;
	}
	a:{
		if( +Larg0.d0<=0){
			if(!(Larg1>0))break a;
		}else{
			tmp2=Larg0.i1|0;
			if(!(Larg1>0))break a;
			if((tmp2&255)===0)break a;
		}
		Larg0.d0=Larg1;
		Larg0.i1=0;
		if(Larg2<0){
			tmp6=0;
		}else if(Larg2>1){
			tmp6=1;
		}else{
			tmp6=Larg2;
		}
		tmp6=+Math.floor(tmp6*.99999998999999994*(+(((L$psroa$p7$p0o)*8)-((0)*8)>>3>>>0)));
		tmp6=+L$psroa$p0$p0[~~tmp6];
		Larg0.d2=tmp6;
		return tmp6;
	}
	Larg0.d0=Larg1;
	Larg0.i1=0;
	return +Larg0.d2;
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
	tmp1=+Math.abs(Larg4);
	tmp1=+Math.pow(10,tmp1/20);
	tmp2=+Math.tan(Larg2*3.1415926535897931/(+(__ZN12maxiSettings10sampleRateE|0)));
	switch(Larg1|0){
		case 0:
		tmp3=tmp2*tmp2;
		tmp2/=Larg3;
		tmp1=1/(tmp3+(tmp2+1));
		tmp4=tmp3*tmp1;
		Larg0.d0=tmp4;
		Larg0.d1=tmp4*2;
		Larg0.d2=tmp4;
		Larg0.d3=(tmp3+-1)*2*tmp1;
		Larg0.d4=(tmp3+(1-tmp2))*tmp1;
		break;
		case 1:
		tmp4=tmp2*tmp2;
		tmp2/=Larg3;
		tmp1=1/(tmp4+(tmp2+1));
		Larg0.d0=tmp1;
		Larg0.d1=tmp1*-2;
		Larg0.d2=tmp1;
		Larg0.d3=(tmp4+-1)*2*tmp1;
		Larg0.d4=(tmp4+(1-tmp2))*tmp1;
		break;
		case 2:
		tmp3=tmp2*tmp2;
		tmp2/=Larg3;
		tmp1=1/(tmp3+(tmp2+1));
		tmp4=tmp2*tmp1;
		Larg0.d0=tmp4;
		Larg0.d1=0;
		Larg0.d2=-tmp4;
		Larg0.d3=(tmp3+-1)*2*tmp1;
		Larg0.d4=(tmp3+(1-tmp2))*tmp1;
		break;
		case 3:
		tmp5=tmp2*tmp2;
		tmp2/=Larg3;
		tmp1=1/(tmp5+(tmp2+1));
		tmp4=(tmp5+1)*tmp1;
		Larg0.d0=tmp4;
		tmp3=(tmp5+-1)*2*tmp1;
		Larg0.d1=tmp3;
		Larg0.d2=tmp4;
		Larg0.d3=tmp3;
		Larg0.d4=(tmp5+(1-tmp2))*tmp1;
		break;
		case 4:
		if(Larg4>=0){
			tmp4=tmp2*tmp2;
			tmp3=1/Larg3*tmp2;
			tmp5=1/(tmp4+(tmp3+1));
			tmp2*=(tmp1/Larg3);
			Larg0.d0=(tmp4+(tmp2+1))*tmp5;
			tmp1=(tmp4+-1)*2*tmp5;
			Larg0.d1=tmp1;
			Larg0.d2=(tmp4+(1-tmp2))*tmp5;
			Larg0.d3=tmp1;
			Larg0.d4=(tmp4+(1-tmp3))*tmp5;
			break;
		}
		tmp4=tmp1/Larg3*tmp2;
		tmp3=tmp2*tmp2;
		tmp5=1/(tmp3+(tmp4+1));
		tmp2*=(1/Larg3);
		Larg0.d0=(tmp3+(tmp2+1))*tmp5;
		tmp1=(tmp3+-1)*2*tmp5;
		Larg0.d1=tmp1;
		Larg0.d2=(tmp3+(1-tmp2))*tmp5;
		Larg0.d3=tmp1;
		Larg0.d4=(tmp3+(1-tmp4))*tmp5;
		break;
		case 5:
		if(Larg4>=0){
			tmp4=tmp2*tmp2;
			tmp3=tmp2* +Larg0.d6;
			tmp5=1/(tmp4+(tmp3+1));
			tmp0=tmp2* +Math.sqrt(tmp1*2);
			tmp2*=(tmp1*tmp2);
			Larg0.d0=(tmp2+(tmp0+1))*tmp5;
			Larg0.d1=(tmp2+-1)*2*tmp5;
			Larg0.d2=tmp5*(tmp2+(1-tmp0));
			Larg0.d3=(tmp4+-1)*2*tmp5;
			Larg0.d4=(tmp4+(1-tmp3))*tmp5;
			break;
		}
		tmp5=tmp2* +Math.sqrt(tmp1*2);
		tmp1=tmp2*(tmp1*tmp2);
		tmp4=1/(tmp1+(tmp5+1));
		tmp3=tmp2*tmp2;
		tmp2*= +Larg0.d6;
		Larg0.d0=tmp4*(tmp3+(tmp2+1));
		Larg0.d1=(tmp3+-1)*2*tmp4;
		Larg0.d2=tmp4*(tmp3+(1-tmp2));
		Larg0.d3=(tmp1+-1)*2*tmp4;
		Larg0.d4=(tmp1+(1-tmp5))*tmp4;
		break;
		case 6:
		if(Larg4>=0){
			tmp4=tmp2*tmp2;
			tmp3=tmp2* +Larg0.d6;
			tmp5=1/(tmp4+(tmp3+1));
			tmp2*= +Math.sqrt(tmp1*2);
			Larg0.d0=(tmp4+(tmp1+tmp2))*tmp5;
			Larg0.d1=(tmp4-tmp1)*2*tmp5;
			Larg0.d2=tmp5*(tmp4+(tmp1-tmp2));
			Larg0.d3=(tmp4+-1)*2*tmp5;
			Larg0.d4=(tmp4+(1-tmp3))*tmp5;
			break;
		}
		tmp4=tmp2* +Math.sqrt(tmp1*2);
		tmp3=tmp2*tmp2;
		tmp5=1/(tmp3+(tmp1+tmp4));
		tmp2*= +Larg0.d6;
		Larg0.d0=tmp5*(tmp3+(tmp2+1));
		Larg0.d1=(tmp3+-1)*2*tmp5;
		Larg0.d2=tmp5*(tmp3+(1-tmp2));
		Larg0.d3=(tmp3-tmp1)*2*tmp5;
		Larg0.d4=(tmp3+(tmp1-tmp4))*tmp5;
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
	return (Larg4-Larg3)*( +Math.log((tmp0<Larg1?Larg1:tmp0)/Larg1)/ +Math.log(Larg2/Larg1))+Larg3;
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
var _transition=new Float64Array([-0.500003,-0.500003,-0.500023,-0.500063,-0.500121,-0.500179,-0.500259,-0.50036,-0.500476,-0.500591,-0.500732,-0.500893,-0.501066,-0.501239,-0.50144,-0.501661,-0.501891,-0.502123,-0.502382,-0.502662,-0.502949,-0.50324,-0.503555,-0.503895,-0.504238,-0.504587,-0.504958,-0.505356,-0.505754,-0.506162,-0.506589,-0.507042,-0.507495,-0.50796,-0.508444,-0.508951,-0.509458,-0.509979,-0.510518,-0.511079,-0.511638,-0.512213,-0.512808,-0.51342,-0.51403,-0.514659,-0.515307,-0.51597,-0.51663,-0.517312,-0.518012,-0.518724,-0.519433,-0.520166,-0.520916,-0.521675,-0.522432,-0.523214,-0.524013,-0.524819,-0.525624,-0.526451,-0.527298,-0.528147,-0.528999,-0.52987,-0.530762,-0.531654,-0.532551,-0.533464,-0.534399,-0.535332,-0.536271,-0.537226,-0.538202,-0.539172,-0.540152,-0.541148,-0.542161,-0.543168,-0.544187,-0.54522,-0.546269,-0.54731,-0.548365,-0.549434,-0.550516,-0.55159,-0.552679,-0.553781,-0.554893,-0.555997,-0.557118,-0.558252,-0.559391,-0.560524,-0.561674,-0.562836,-0.564001,-0.565161,-0.566336,-0.567524,-0.568712,-0.569896,-0.571095,-0.572306,-0.573514,-0.574721,-0.575939,-0.577171,-0.578396,-0.579622,-0.580858,-0.582108,-0.583348,-0.58459,-0.585842,-0.587106,-0.588358,-0.589614,-0.590879,-0.592154,-0.593415,-0.594682,-0.595957,-0.59724,-0.598507,-0.599782,-0.601064,-0.602351,-0.603623,-0.604902,-0.606189,-0.607476,-0.60875,-0.610032,-0.61131899999999995,-0.612605,-0.613877,-0.615157,-0.616443,-0.617723,-0.618992,-0.620268,-0.62154799999999999,-0.62282,-0.624083,-0.62535,-0.626622,-0.627882,-0.629135,-0.630391,-0.631652,-0.632898,-0.634138,-0.63538,-0.636626,-0.637854,-0.639078,-0.640304,-0.641531,-0.64273899999999995,-0.643943,-0.645149,-0.646355,-0.647538,-0.64872,-0.649903,-0.651084,-0.652241,-0.653397,-0.654553,-0.65570499999999998,-0.656834,-0.657961,-0.659087,-0.660206,-0.661304,-0.66239899999999996,-0.66349199999999997,-0.664575,-0.665639,-0.666699,-0.667756,-0.6688,-0.66982699999999995,-0.670849,-0.671866,-0.672868,-0.673854,-0.674835,-0.675811,-0.676767,-0.677709,-0.678646,-0.679576,-0.680484,-0.68138,-0.682269,-0.683151,-0.684008,-0.684854,-0.685693,-0.686524,-0.687327,-0.688119,-0.688905,-0.689682,-0.690428,-0.691164,-0.691893,-0.692613,-0.6933,-0.693978,-0.694647,-0.695305,-0.695932,-0.696549,-0.697156,-0.697748,-0.69831299999999996,-0.698865,-0.699407,-0.699932,-0.700431,-0.700917,-0.701391,-0.701845,-0.702276,-0.702693,-0.703097,-0.703478,-0.703837,-0.704183,-0.704514,-0.704819,-0.705105,-0.705378,-0.70563299999999995,-0.70586,-0.706069,-0.706265,-0.706444,-0.706591,-0.706721,-0.706837,-0.706938,-0.707003,-0.707051,-0.707086,-0.707106,-0.707086,-0.707051,-0.70700099999999999,-0.706935,-0.706832,-0.706711,-0.706576,-0.70642099999999997,-0.706233,-0.706025,-0.705802,-0.70555699999999999,-0.705282,-0.704984,-0.704671,-0.704334,-0.703969,-0.703582,-0.703176,-0.702746,-0.702288,-0.70181,-0.701312,-0.70078499999999999,-0.700234,-0.699664,-0.69907,-0.698447,-0.6978,-0.697135,-0.696446,-0.695725,-0.694981,-0.694219,-0.693435,-0.692613,-0.691771,-0.690911,-0.69003,-0.689108,-0.688166,-0.68720599999999998,-0.686227,-0.685204,-0.684162,-0.68310099999999996,-0.682019,-0.680898,-0.679755,-0.678592,-0.677407,-0.676187,-0.674941,-0.673676,-0.672386,-0.671066,-0.669718,-0.66835,-0.66695499999999996,-0.665532,-0.66408299999999998,-0.662611,-0.661112,-0.659585,-0.658035,-0.656459,-0.654854,-0.653223,-0.651572,-0.649892,-0.648181,-0.646446,-0.644691,-0.642909,-0.641093,-0.639253,-0.637393,-0.63551,-0.633588,-0.631644,-0.62968,-0.627695,-0.625668,-0.62362099999999998,-0.621553,-0.619464,-0.617334,-0.615183,-0.61301099999999997,-0.610817,-0.608587,-0.606333,-0.60405799999999998,-0.60176,-0.59942899999999999,-0.597072,-0.594695,-0.592293,-0.589862,-0.587404,-0.584925,-0.58242,-0.579888,-0.577331,-0.574751,-0.572145,-0.569512,-0.566858,-0.564178,-0.561471,-0.558739,-0.555988,-0.553209,-0.550402,-0.547572,-0.544723,-0.54185,-0.538944,-0.536018,-0.533072,-0.530105,-0.527103,-0.524081,-0.52104,-0.51798,-0.514883,-0.511767,-0.508633,-0.505479,-0.502291,-0.499083,-0.495857,-0.492611,-0.489335,-0.486037,-0.48272,-0.479384,-0.476021,-0.472634,-0.46923,-0.465805,-0.462356,-0.458884,-0.455394,-0.451882,-0.448348,-0.444795,-0.44122,-0.437624,-0.434008,-0.430374,-0.426718,-0.423041,-0.419344,-0.415631,-0.411897,-0.40814,-0.404365,-0.400575,-0.396766,-0.392933,-0.389082,-0.385217,-0.381336,-0.377428,-0.373505,-0.369568,-0.365616,-0.361638,-0.357645,-0.353638,-0.349617,-0.345572,-0.341512,-0.337438,-0.33335,-0.329242,-0.325118,-0.32098,-0.316829,-0.31266,-0.308474,-0.304276,-0.300063,-0.295836,-0.291593,-0.287337,-0.283067,-0.278783,-0.274487,-0.270176,-0.265852,-0.261515,-0.257168,-0.252806,-0.248431,-0.244045,-0.239649,-0.23524,-0.230817,-0.226385,-0.221943,-0.21749,-0.213024,-0.208548,-0.204064,-0.199571,-0.195064,-0.190549,-0.186026,-0.181495,-0.176952,-0.1724,-0.167842,-0.163277,-0.1587,-0.154117,-0.149527,-0.14493,-0.140325,-0.135712,-0.131094,-0.12647,-0.121839,-0.117201,-0.112559,-0.10791,-0.103257,-0.0985979,-0.093934299999999998,-0.0892662,-0.0845935,-0.079917,-0.0752362,-0.0705516,-0.0658635,-0.0611729,-0.0564786,-0.0517814,-0.0470818,-0.0423802,-0.0376765,-0.0329703,-0.0282629,-0.0235542,-0.0188445,-0.0141335,-0.00942183,-0.00470983,2.41979E-6,.00471481,.00942681,.0141384,.0188494,.023559,.028268,.0329754,.0376813,.0423851,.0470868,.0517863,.0564836,.0611777,.0658683,.0705566,.075241199999999994,.0799218,.084598199999999998,.089271199999999995,.0939393,.0986028,.103262,.107915,.112563,.117206,.121844,.126475,.131099,.135717,.14033,.144935,.149531,.154122,.158705,.163281,.167847,.172405,.176956,.1815,.18603,.190553,.195069,.199576,.204068,.208552,.213028,.217495,.221947,.226389,.230822,.235245,.239653,.244049,.248436,.252811,.257173,.26152,.265857,.270181,.274491,.278788,.283071,.287341,.291597,.29584,.300068,.30428,.308478,.312664,.316833,.320984,.325122,.329246,.333354,.337442,.341516,.345576,.34962,.353642,.357649,.361642,.36562,.369572,.373509,.377432,.38134,.385221,.389086,.392936,.39677,.400579,.404369,.408143,.4119,.415634,.419347,.423044,.426721,.430377,.434011,.437627,.441223,.444798,.448351,.451885,.455397,.458887,.462359,.465807,.469232,.472637,.476024,.479386,.482723,.486039,.489338,.492613,.49586,.499086,.502294,.505481,.508635,.511769,.514885,.517982,.521042,.524083,.527105,.530107,.533074,.53602,.538946,.541851,.544725,.547574,.550404,.553211,.555989,.55874,.561472,.564179,.566859,.569514,.572146,.574753,.577332,.579889,.582421,.584926,.587405,.589863,.592294,.594696,.59707299999999996,.59943,.60176,.604059,.606333,.608588,.610818,.613012,.615183,.61733499999999997,.619464,.621553,.62362099999999998,.625669,.627696,.629681,.631645,.633588,.63551,.637393,.639253,.641093,.642909,.644691,.646446,.648181,.649892,.651572,.653223,.654854,.656459,.658035,.659585,.661112,.662611,.66408299999999998,.665532,.66695499999999996,.66835,.669718,.671066,.672386,.673676,.674941,.676187,.677407,.678592,.679755,.680898,.682019,.68310099999999996,.684162,.685204,.686227,.68720599999999998,.688166,.689108,.69003,.690911,.691771,.692613,.693435,.694219,.694981,.695725,.696447,.697135,.6978,.698447,.69907,.699664,.700234,.700786,.701312,.70181,.702288,.702746,.703177,.703582,.703969,.704334,.704671,.704984,.705282,.70555699999999999,.705802,.706025,.706233,.706422,.706576,.706712,.706832,.706936,.707002,.707051,.707086,.707106,.707086,.707051,.707003,.70693899999999998,.706838,.706721,.706592,.706445,.706265,.70607,.705861,.705634,.705378,.705105,.70482,.704515,.704184,.703837,.703478,.703097,.702694,.702276,.70184599999999997,.701392,.700917,.700432,.699932,.699408,.69886599999999999,.698314,.69774899999999995,.697156,.696549,.695933,.695305,.694648,.693979,.69330099999999995,.692613,.691894,.691165,.690428,.689683,.688905,.68812,.687327,.686525,.685693,.684854,.684009,.68315199999999998,.68227,.68138,.680485,.679577,.678647,.67771,.676768,.675811,.674836,.673855,.672869,.67186699999999999,.670849,.66982699999999995,.66880099999999998,.667757,.6667,.66564,.664576,.663493,.6624,.661305,.66020699999999999,.659088,.657962,.656834,.65570499999999998,.654553,.653398,.652241,.651085,.649903,.648721,.647539,.646356,.645149,.643944,.64273899999999995,.64153199999999999,.640304,.63907899999999995,.637855,.636626,.63538099999999997,.634139,.632899,.631652,.630392,.629136,.62788299999999997,.626622,.62535,.624083,.62282,.62154799999999999,.620268,.618993,.617724,.616443,.615158,.613878,.612605,.61132,.610032,.608751,.607477,.606189,.60490299999999997,.603623,.602351,.60106499999999996,.599782,.598508,.59724,.595957,.594682,.593415,.592154,.59088,.589615,.588359,.587106,.585843,.584591,.583349,.582108,.580859,.579623,.578397,.577172,.575939,.574721,.573515,.572307,.571095,.569897,.568713,.567525,.566337,.565161,.564002,.562837,.561674,.560525,.559392,.558252,.557119,.555998,.554893,.553782,.552679,.55159,.550516,.549434,.548365,.54731,.546269,.54522,.544187,.543168,.542161,.541148,.540153,.539173,.538202,.537226,.536271,.535332,.5344,.533464,.532551,.531654,.530762,.52987,.528999,.528147,.527298,.526451,.525624,.524819,.524014,.523214,.522432,.521675,.520916,.520166,.519433,.518724,.518012,.517312,.51663,.51597,.515307,.51466,.51403,.51342,.512808,.512213,.511638,.511079,.510518,.509979,.509458,.508951,.508444,.50796,.507495,.507042,.506589,.506162,.505754,.505356,.504958,.504587,.504237,.503895,.503555,.50324,.502949,.502662,.502382,.502123,.501891,.501661,.50144,.501239,.501066,.500893,.500732,.500591,.500476,.50036,.500259,.500179,.500121,.500063,.500023,.500003,.500003]);
var _sineBuffer=new Float64Array([0,.012268,.024536,.036804,.049042,.06131,.073547,.085785,.097991999999999995,.1102,.12241,.13455,.1467,.15884,.17093,.18301,.19507,.20709,.21909,.23105,.24295,.25485,.26669,.2785,.29025,.30197,.31366,.32529,.33685,.34839,.35986,.37128,.38266,.39395,.40521,.41641,.42752,.4386,.44958,.46051,.47137,.48215,.49286,.50351,.51407,.52457,.53497,.54529,.55554,.5657,.57578,.58575,.59567,.60547,.61519999999999997,.62482,.63437,.6438,.65314,.66237999999999997,.67151,.68057,.68951,.69833,.70706,.7157,.72421,.7326,.74091,.74907999999999997,.75717,.76514,.77298,.78069999999999994,.7883,.79581,.80316,.81042,.81754,.82455,.83142,.8382,.84482,.85132,.8577,.86392,.87006,.87604,.88187,.8876,.89319,.89861999999999997,.90396,.90912,.91415,.91907,.92383,.92847,.93294999999999995,.93728999999999995,.9415,.94555999999999995,.94948999999999994,.95325,.95691,.96038999999999996,.96374999999999999,.96692,.96999999999999997,.97289999999999998,.97565,.97826999999999997,.98073999999999994,.98306,.98523,.98724,.98914,.99084,.99243,.99387,.99514999999999998,.99628,.99724999999999997,.99807999999999996,.99875,.99926999999999999,.99965999999999999,.99987999999999999,.99997,.99987999999999999,.99965999999999999,.99926999999999999,.99875,.99807999999999996,.99724999999999997,.99628,.99514999999999998,.99387,.99243,.99084,.98914,.98724,.98523,.98306,.98073999999999994,.97826999999999997,.97565,.97289999999999998,.96999999999999997,.96692,.96374999999999999,.96038999999999996,.95691,.95325,.94948999999999994,.94555999999999995,.9415,.93728999999999995,.93294999999999995,.92847,.92383,.91907,.91415,.90912,.90396,.89861999999999997,.89319,.8876,.88187,.87604,.87006,.86392,.8577,.85132,.84482,.8382,.83142,.82455,.81754,.81042,.80316,.79581,.7883,.78069999999999994,.77298,.76514,.75717,.74907999999999997,.74091,.7326,.72421,.7157,.70706,.69833,.68951,.68057,.67151,.66237999999999997,.65314,.6438,.63437,.62482,.61519999999999997,.60547,.59567,.58575,.57578,.5657,.55554,.54529,.53497,.52457,.51407,.50351,.49286,.48215,.47137,.46051,.44958,.4386,.42752,.41641,.40521,.39395,.38266,.37128,.35986,.34839,.33685,.32529,.31366,.30197,.29025,.2785,.26669,.25485,.24295,.23105,.21909,.20709,.19507,.18301,.17093,.15884,.1467,.13455,.12241,.1102,.097991999999999995,.085785,.073547,.06131,.049042,.036804,.024536,.012268,0,-0.012268,-0.024536,-0.036804,-0.049042,-0.06131,-0.073547,-0.085785,-0.097991999999999995,-0.1102,-0.12241,-0.13455,-0.1467,-0.15884,-0.17093,-0.18301,-0.19507,-0.20709,-0.21909,-0.23105,-0.24295,-0.25485,-0.26669,-0.2785,-0.29025,-0.30197,-0.31366,-0.32529,-0.33685,-0.34839,-0.35986,-0.37128,-0.38266,-0.39395,-0.40521,-0.41641,-0.42752,-0.4386,-0.44958,-0.46051,-0.47137,-0.48215,-0.49286,-0.50351,-0.51407,-0.52457,-0.53497,-0.54529,-0.55554,-0.5657,-0.57578,-0.58575,-0.59567,-0.60547,-0.61519999999999997,-0.62482,-0.63437,-0.6438,-0.65314,-0.66237999999999997,-0.67151,-0.68057,-0.68951,-0.69833,-0.70706,-0.7157,-0.72421,-0.7326,-0.74091,-0.74907999999999997,-0.75717,-0.76514,-0.77298,-0.78069999999999994,-0.7883,-0.79581,-0.80316,-0.81042,-0.81754,-0.82455,-0.83142,-0.8382,-0.84482,-0.85132,-0.8577,-0.86392,-0.87006,-0.87604,-0.88187,-0.8876,-0.89319,-0.89861999999999997,-0.90396,-0.90912,-0.91415,-0.91907,-0.92383,-0.92847,-0.93294999999999995,-0.93728999999999995,-0.9415,-0.94555999999999995,-0.94948999999999994,-0.95325,-0.95691,-0.96038999999999996,-0.96374999999999999,-0.96692,-0.96999999999999997,-0.97289999999999998,-0.97565,-0.97826999999999997,-0.98073999999999994,-0.98306,-0.98523,-0.98724,-0.98914,-0.99084,-0.99243,-0.99387,-0.99514999999999998,-0.99628,-0.99724999999999997,-0.99807999999999996,-0.99875,-0.99926999999999999,-0.99965999999999999,-0.99987999999999999,-0.99997,-0.99987999999999999,-0.99965999999999999,-0.99926999999999999,-0.99875,-0.99807999999999996,-0.99724999999999997,-0.99628,-0.99514999999999998,-0.99387,-0.99243,-0.99084,-0.98914,-0.98724,-0.98523,-0.98306,-0.98073999999999994,-0.97826999999999997,-0.97565,-0.97289999999999998,-0.96999999999999997,-0.96692,-0.96374999999999999,-0.96038999999999996,-0.95691,-0.95325,-0.94948999999999994,-0.94555999999999995,-0.9415,-0.93728999999999995,-0.93294999999999995,-0.92847,-0.92383,-0.91907,-0.91415,-0.90912,-0.90396,-0.89861999999999997,-0.89319,-0.8876,-0.88187,-0.87604,-0.87006,-0.86392,-0.8577,-0.85132,-0.84482,-0.8382,-0.83142,-0.82455,-0.81754,-0.81042,-0.80316,-0.79581,-0.7883,-0.78069999999999994,-0.77298,-0.76514,-0.75717,-0.74907999999999997,-0.74091,-0.7326,-0.72421,-0.7157,-0.70706,-0.69833,-0.68951,-0.68057,-0.67151,-0.66237999999999997,-0.65314,-0.6438,-0.63437,-0.62482,-0.61519999999999997,-0.60547,-0.59567,-0.58575,-0.57578,-0.5657,-0.55554,-0.54529,-0.53497,-0.52457,-0.51407,-0.50351,-0.49286,-0.48215,-0.47137,-0.46051,-0.44958,-0.4386,-0.42752,-0.41641,-0.40521,-0.39395,-0.38266,-0.37128,-0.35986,-0.34839,-0.33685,-0.32529,-0.31366,-0.30197,-0.29025,-0.2785,-0.26669,-0.25485,-0.24295,-0.23105,-0.21909,-0.20709,-0.19507,-0.18301,-0.17093,-0.15884,-0.1467,-0.13455,-0.12241,-0.1102,-0.097991999999999995,-0.085785,-0.073547,-0.06131,-0.049042,-0.036804,-0.024536,-0.012268,0,.012268]);
var _impure_data$p14=null;
function createArray_literal0(e){
	var r=[];
	for(var i=0;i<e;i++)
	r[i]=-0.;
	return r;
}
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
function maxiIndex(){
	this.d0=-0.;
	this.i1=0;
	this.d2=-0.;
	;
	this.d=[this];
	if (arguments.length===1&&arguments[0]===undefined){
		return;
	}
	__ZN9maxiIndexC1Ev(this);
}
maxiIndex.prototype.pull=function (a0,a1,a2){
	return __ZN9maxiIndex4pullEddPN6client12Float64ArrayE(this,a0,a1,a2);
};
maxiIndex.prototype.pull=function (a0,a1,a2){
	return __ZN9maxiIndex4pullEddPN6client12Float64ArrayE(this,a0,a1,a2);
};
function maxiRatioSeq(){
	this.d0=-0.;
	this.i1=0;
	;
	this.d=[this];
	if (arguments.length===1&&arguments[0]===undefined){
		return;
	}
	__ZN12maxiRatioSeqC1Ev(this);
}
maxiRatioSeq.prototype.playTrig=function (a0,a1){
	return __ZN12maxiRatioSeq8playTrigEdPN6client12Float64ArrayE(this,a0,a1);
};
maxiRatioSeq.prototype.playValues=function (a0,a1,a2){
	return __ZN12maxiRatioSeq10playValuesEdPN6client12Float64ArrayES2_(this,a0,a1,a2);
};
maxiRatioSeq.prototype.playTrig=function (a0,a1){
	return __ZN12maxiRatioSeq8playTrigEdPN6client12Float64ArrayE(this,a0,a1);
};
maxiRatioSeq.prototype.playValues=function (a0,a1,a2){
	return __ZN12maxiRatioSeq10playValuesEdPN6client12Float64ArrayES2_(this,a0,a1,a2);
};
function maxiOsc(){
	this.d0=-0.;
	this.d1=-0.;
	this.d2=-0.;
	this.d3=-0.;
	this.d4=-0.;
	this.d5=-0.;
	;
	this.d=[this];
	if (arguments.length===1&&arguments[0]===undefined){
		return;
	}
	__ZN7maxiOscC1Ev(this);
}
maxiOsc.prototype.noise=function (){
	return __ZN7maxiOsc5noiseEv(this);
};
maxiOsc.prototype.phaseReset=function (a0){
	return __ZN7maxiOsc10phaseResetEd(this,a0);
};
maxiOsc.prototype.sinewave=function (a0){
	return __ZN7maxiOsc8sinewaveEd(this,a0);
};
maxiOsc.prototype.sinebuf4=function (a0){
	return __ZN7maxiOsc8sinebuf4Ed(this,a0);
};
maxiOsc.prototype.sinebuf=function (a0){
	return __ZN7maxiOsc7sinebufEd(this,a0);
};
maxiOsc.prototype.coswave=function (a0){
	return __ZN7maxiOsc7coswaveEd(this,a0);
};
maxiOsc.prototype.phasor=function (a0){
	return __ZN7maxiOsc6phasorEd(this,a0);
};
maxiOsc.prototype.square=function (a0){
	return __ZN7maxiOsc6squareEd(this,a0);
};
maxiOsc.prototype.pulse=function (a0,a1){
	return __ZN7maxiOsc5pulseEdd(this,a0,a1);
};
maxiOsc.prototype.impulse=function (a0){
	return __ZN7maxiOsc7impulseEd(this,a0);
};
maxiOsc.prototype.phasor=function (a0,a1,a2){
	return __ZN7maxiOsc6phasorEddd(this,a0,a1,a2);
};
maxiOsc.prototype.saw=function (a0){
	return __ZN7maxiOsc3sawEd(this,a0);
};
maxiOsc.prototype.sawn=function (a0){
	return __ZN7maxiOsc4sawnEd(this,a0);
};
maxiOsc.prototype.rect=function (a0,a1){
	return __ZN7maxiOsc4rectEdd(this,a0,a1);
};
maxiOsc.prototype.triangle=function (a0){
	return __ZN7maxiOsc8triangleEd(this,a0);
};
maxiSettings.promise=
maxiTrigger.promise=
maxiMap.promise=
maxiNonlinearity.promise=
maxiBiquad.promise=
maxiIndex.promise=
maxiRatioSeq.promise=
maxiOsc.promise=
Promise.resolve();
__Z7webMainv();
//bindings- intended to mix this source in with the emscripten modules
Module.maxiMap = maxiMap;
Module.maxiTrigger = maxiTrigger;
Module.maxiNonlinearity = maxiNonlinearity;
Module.maxiJSSettings = maxiSettings;
Module.maxiBiquad = maxiBiquad;
Module.maxiOsc = maxiOsc;
Module.maxiRatioSeq = maxiRatioSeq;
Module.maxiIndex = maxiIndex;
Module.maxiRatioSeq = maxiRatioSeq;

// Module.cheerpTypes = cheerpTypes;
// Module.maxiFilter = maxiFilter;
// Module.maxiZeroCrossingDetector = maxiZeroCrossingDetector;

// Module.cheerpTypes2 = cheerpTypes2;
// Module.vectorTest = vectorTest;

