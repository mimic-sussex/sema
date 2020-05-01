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
  'initial': 895,
  'maximum': 895 + 0,
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
    STACK_BASE = 5283968,
    STACKTOP = STACK_BASE,
    STACK_MAX = 41088,
    DYNAMIC_BASE = 5283968,
    DYNAMICTOP_PTR = 40928;




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




var wasmBinaryFile = 'data:application/octet-stream;base64,AGFzbQEAAAAB0gqfAWABfwF/YAF/AGACf38AYAJ/fwF/YAN/f38Bf2ADf39/AGAFf39/f38Bf2AAAGAEf39/fwF/YAZ/f39/f38Bf2AFf39/f38AYAR/f39/AGAAAX9gBn9/f39/fwBgCH9/f39/f39/AX9gAn98AGABfwF8YAJ8fAF8YAd/f39/f39/AX9gAn98AXxgA398fAF8YAF8AXxgB39/f39/f38AYAJ/fwF8YAR/fHx8AXxgBH9/f3wAYAN/f3wAYAV/fn5+fgBgA39+fwF+YAF9AX1gA39/fwF8YAR/fHx/AXxgCn9/f39/f39/f38AYAN/fH8AYAV/f39/fgF/YAV/f35/fwBgBn9/fHx8fwBgBX9/f398AX9gBH9/f38BfmABfwF9YAJ/fwF9YAV/f3x8fwF8YAZ/fH98fHwBfGAFf3x8f3wBfGAFf3x8fH8BfGAGf3x8fHx8AXxgCH9/f39/f39/AGAHf39/f398fABgBn9/f398fABgBH9/f30AYAZ/f319f38AYAR/f3x/AGAFf398f3wAYAZ/f3x/fHwAYAd/f3x/fHx8AGAEf398fABgBH9+fn8AYAV/fX1/fwBgBH98f3wAYAV/fH98fABgBn98f3x8fABgA398fABgBX98fHx/AGAKf39/f39/f39/fwF/YAd/f39/f35+AX9gBn9/f39+fgF/YAR/f398AX9gBH9/fX8Bf2ADf31/AX9gBn98f39/fwF/YAR/f39/AX1gBX9/f39/AX1gBH9/f38BfGADf398AXxgBH9/fH8BfGAFf398f3wBfGAGf398f3x/AXxgB39/fH98fHwBfGAEf398fAF8YAZ/f3x8f3wBfGAHf398fH98fAF8YAV/f3x8fAF8YAZ/f3x8fH8BfGAHf398fHx/fwF8YAd/f3x8fH98AXxgB39/fHx8fHwBfGAJf398fHx8fH9/AXxgA398fwF8YAR/fH98AXxgBX98f3x/AXxgBn98fH98fAF8YAZ/fHx8f38BfGAGf3x8fH98AXxgCH98fHx8fH9/AXxgD39/f39/f39/f39/f39/fwBgA39/fQBgAn9+AGAJf39/f39/f39/AX9gC39/f39/f39/f39/AX9gDH9/f39/f39/f39/fwF/YAR/f399AX9gA39+fwF/YAJ/fAF/YAJ+fwF/YAJ+fgF/YAF8AX9gAX8BfmAEf39/fgF+YAN/f38BfWACfX8BfWABfAF9YAJ8fwF8YAN8fH8BfGADfHx8AXxgDH9/f39/f39/f39/fwBgDX9/f39/f39/f39/f38AYAh/f39/f398fABgBX9/f399AGAFf39/f3wAYAd/f399fX9/AGAFf39/fH8AYAZ/f398f3wAYAd/f398f3x8AGAIf39/fH98fHwAYAV/f398fABgB39/f3x8fH8AYAN/f34AYAN/fn4AYAJ/fQBgBn9/f39/fAF/YAV/f39/fQF/YAV/f399fwF/YAN/f3wBf2AHf398f39/fwF/YAN+f38Bf2AEfn5+fgF/YAJ9fwF/YAJ8fwF/YAJ/fwF+YAZ/f39/f38BfWACfn4BfWACfX0BfWAFf39/f38BfGAEf39/fAF8YAV/f398fwF8YAZ/f398f3wBfGAHf39/fH98fwF8YAh/f398f3x8fAF8YAV/f398fAF8YAZ/f398fH8BfGAHf39/fHx/fAF8YAh/f398fH98fAF8YAZ/f398fHwBfGAHf39/fHx8fwF8YAh/f398fHx/fwF8YAh/f398fHx/fAF8YAh/f398fHx8fAF8YAp/f398fHx8fH9/AXxgAn5+AXwClgktA2VudhZfZW1iaW5kX3JlZ2lzdGVyX2NsYXNzAHMDZW52Il9lbWJpbmRfcmVnaXN0ZXJfY2xhc3NfY29uc3RydWN0b3IADQNlbnYlX2VtYmluZF9yZWdpc3Rlcl9jbGFzc19jbGFzc19mdW5jdGlvbgAWA2Vudh9fZW1iaW5kX3JlZ2lzdGVyX2NsYXNzX2Z1bmN0aW9uAC4DZW52H19lbWJpbmRfcmVnaXN0ZXJfY2xhc3NfcHJvcGVydHkAIANlbnYVX2VtYmluZF9yZWdpc3Rlcl9lbnVtAAsDZW52G19lbWJpbmRfcmVnaXN0ZXJfZW51bV92YWx1ZQAFA2VudhpfZW1iaW5kX3JlZ2lzdGVyX3NtYXJ0X3B0cgByA2VudhhfX2N4YV9hbGxvY2F0ZV9leGNlcHRpb24AAANlbnYLX19jeGFfdGhyb3cABQNlbnYRX2VtdmFsX3Rha2VfdmFsdWUAAwNlbnYNX2VtdmFsX2luY3JlZgABA2Vudg1fZW12YWxfZGVjcmVmAAEDZW52C19lbXZhbF9jYWxsAAgDZW52BXJvdW5kABUDZW52BGV4aXQAAQNlbnYNX19hc3NlcnRfZmFpbAALA2VudgZfX2xvY2sAAQNlbnYIX191bmxvY2sAARZ3YXNpX3NuYXBzaG90X3ByZXZpZXcxCGZkX2Nsb3NlAAADZW52Cl9fc3lzY2FsbDUAAwNlbnYMX19zeXNjYWxsMjIxAAMDZW52C19fc3lzY2FsbDU0AAMWd2FzaV9zbmFwc2hvdF9wcmV2aWV3MQdmZF9yZWFkAAgWd2FzaV9zbmFwc2hvdF9wcmV2aWV3MQhmZF93cml0ZQAIFndhc2lfc25hcHNob3RfcHJldmlldzERZW52aXJvbl9zaXplc19nZXQAAxZ3YXNpX3NuYXBzaG90X3ByZXZpZXcxC2Vudmlyb25fZ2V0AAMDZW52Cl9fbWFwX2ZpbGUAAwNlbnYLX19zeXNjYWxsOTEAAwNlbnYKc3RyZnRpbWVfbAAGA2VudgVhYm9ydAAHA2VudhVfZW1iaW5kX3JlZ2lzdGVyX3ZvaWQAAgNlbnYVX2VtYmluZF9yZWdpc3Rlcl9ib29sAAoDZW52G19lbWJpbmRfcmVnaXN0ZXJfc3RkX3N0cmluZwACA2VudhxfZW1iaW5kX3JlZ2lzdGVyX3N0ZF93c3RyaW5nAAUDZW52Fl9lbWJpbmRfcmVnaXN0ZXJfZW12YWwAAgNlbnYYX2VtYmluZF9yZWdpc3Rlcl9pbnRlZ2VyAAoDZW52Fl9lbWJpbmRfcmVnaXN0ZXJfZmxvYXQABQNlbnYcX2VtYmluZF9yZWdpc3Rlcl9tZW1vcnlfdmlldwAFA2VudhZlbXNjcmlwdGVuX3Jlc2l6ZV9oZWFwAAADZW52FWVtc2NyaXB0ZW5fbWVtY3B5X2JpZwAEA2VudgtzZXRUZW1wUmV0MAABFndhc2lfc25hcHNob3RfcHJldmlldzEHZmRfc2VlawAGA2VudgZtZW1vcnkCAIAQA2VudgV0YWJsZQFwAP8GA/oJ2QkHBwcHBwcHAAEADAIBAAsFAAxIGRAPFxoAAgMFAAxLTAAMNDU2AAwTST4kDwAAQhkYcQAMPTcPEBAPEA8PAAEMAAsITlECATIIAAxQVQAMU1ZKAAIAFxcVExMADBQADCpNAAwqAAwUAAwPDy0AFBERERERERERERURAAwAAAIAAhACEAICAAIADB8pAAEDABQhMwIXHgAAAAAUIQIAAQwKQygDAAAAAAAAAAEMRwABDDAvAwQAAQwCBQULAAUEBAgAAhoFGQAFBEIAAgUFCwAFBAgABQBfMQVkBSEHAAEADAMBAAECEA8rTx8pAAEDAQIrAAwCDw8AXFQsUiQHAAMEAwMDCAQDAwMAAAADAwMDAwMDAwMMEBBmaQAMFAAMHwcAAQwADAECBQIFAgIAAAQCAAEBAwEAAQEQAAQAAQMAAQEHExMeGgBYWRQ6OzwEAAMEAgAEAAMAAAIFBQEQGCwYEBMUExgUEw85Wi0TDw8PW11XDw8PEAABAQABAgQjBwsAAwMJDwECC0QAJycLRg0LAgIBBQoFCgoCAQEAEwAYAwEACAAICQMDDQsBAAMEBAQLCAoIAAADDgoNbW0EBQsCDQIAAgAcAAEECAIMAwMDbwYSBQALCmeGAWcERQIFDAACAWpqAAAIZWUCAAAAAwMMAAgEAAAcBAAEAQAAAAA4OJ4BEQaJAXAVbm6IAR0VHXAVHY0BHRUdEQQMAAABAQABAAIEIwsEBQAAAwQAAQAEBQAEAAABAQMBAAMAAAMDAQMAAwVgAQADAAMDAwADAAABAQAAAAMDAwICAgIBAgIAAAMHAQEHAQcFAgUCAgAAAQIAAwADAQIAAwADAgAEAwIEA2AAf2sIgAEbAhsPhwFoGwIbOBsLDRaKAYwBBAN+BAQEAwcEAAIDDAQDAwEABAgIBmsmJigLFwULBgsFBAYLBQQJABIDBAkGAAUAAj8ICwkGJgkGCAkGCAkGJgkGCmNsCQYeCQYLCQwEAQQDCQASCQYDBT8JBgkGCQYJBgkGCmMJBgkGCQQDBgAABgsGBBYCACIGIiUEAAgWQQYGAAYWCQIEIgYiJRZBBgICDgAJCQkNCQ0JCgYOCwoKCgoKCgsNCgoKDgkJCQ0JDQkKBg4LCgoKCgoKCw0KCgoSDQIEEg0GBwQAAgICAAISYiACBQUSAQUAAgAEAwISYiACEgEFAAIABANAIF4ECUAgXgQJBAQEDQUCDQsLAAcHBwEBAgACBwwBAAEBAQwBAwECAQEECAgIAwQDBAMIBAYAAQMEAwQIBAYOBgYBDgYEDgkGBgAAAAYIAA4JDgkGBAAOCQ4JBgQAAQABAAACAgICAgICAgAHAQAHAQIABwEABwEABwEABwEAAQABAAEAAQABAAEAAQABAQAMAwEDAAUCAQAIAgELAAIBAAEBBQEBAwIAAgQEBwIFAAUuAgICCgUFAgEFBS4KBQIFBwcHAAABAQEABAQEAwULCwsLAwQDAwsKDQoKCg0NDQAABwcHBwcHBwcHBwcHBwEBAQEBAQcHBwcAAAEDAwIAERsVHW9oBAQFAgwAAQAFCkiOARl2Gh5LkQFMkgE0eTV6NntJjwEkfSVRN3wGTpQBmAEyd1CXAVWcAVOaAVadAUqQAU2TASmVATN4DUODAShsR4sBL3QxdYIBT5YBVJsBUpkBhAGFAQlhEoEBDhYBFgYSYT8GEAJ/AUHgv8ICC38AQdy/AgsHmQ5oEV9fd2FzbV9jYWxsX2N0b3JzACsGbWFsbG9jAKAJBGZyZWUAoQkQX19lcnJub19sb2NhdGlvbgD2AwhzZXRUaHJldwCvCRlfWlN0MTh1bmNhdWdodF9leGNlcHRpb252AL8EDV9fZ2V0VHlwZU5hbWUAhwkqX19lbWJpbmRfcmVnaXN0ZXJfbmF0aXZlX2FuZF9idWlsdGluX3R5cGVzAIgJCl9fZGF0YV9lbmQDAQlzdGFja1NhdmUAsAkKc3RhY2tBbGxvYwCxCQxzdGFja1Jlc3RvcmUAsgkQX19ncm93V2FzbU1lbW9yeQCzCQpkeW5DYWxsX2lpAKkCCmR5bkNhbGxfdmkANglkeW5DYWxsX2kANAtkeW5DYWxsX3ZpaQC0CQ1keW5DYWxsX3ZpaWlpALUJDGR5bkNhbGxfdmlpaQA5DGR5bkNhbGxfZGlpaQC2CQ1keW5DYWxsX2RpaWlpALcJDGR5bkNhbGxfdmlpZAC4CQ1keW5DYWxsX3ZpaWlkALkJCmR5bkNhbGxfZGkAgQELZHluQ2FsbF92aWQAugkLZHluQ2FsbF9kaWkAuwkLZHluQ2FsbF9paWkAqgINZHluQ2FsbF9kaWRpZAC8CQ5keW5DYWxsX2RpaWRpZAC9CQ5keW5DYWxsX2RpZGlkaQC+CQ9keW5DYWxsX2RpaWRpZGkAvwkNZHluQ2FsbF92aWRpZADACQ5keW5DYWxsX3ZpaWRpZADBCQ5keW5DYWxsX3ZpZGlkZADCCQ9keW5DYWxsX3ZpaWRpZGQAwwkPZHluQ2FsbF92aWRpZGRkAMQJEGR5bkNhbGxfdmlpZGlkZGQAxQkLZHluQ2FsbF9kaWQAxgkMZHluQ2FsbF9kaWlkAMcJDmR5bkNhbGxfdmlkZGRpAMgJD2R5bkNhbGxfdmlpZGRkaQDJCQ1keW5DYWxsX2lpaWlkAMoJDWR5bkNhbGxfZGlkZGQAywkMZHluQ2FsbF9kZGRkAFsMZHluQ2FsbF92aWRkAMwJDWR5bkNhbGxfdmlpZGQAzQkMZHluQ2FsbF9paWlpAK4CDWR5bkNhbGxfaWlpaWkAzgkMZHluQ2FsbF9kaWRkAM8JDWR5bkNhbGxfZGlpZGQA0AkOZHluQ2FsbF9kaWlkZGQA0QkOZHluQ2FsbF92aWZmaWkA0gkPZHluQ2FsbF92aWlmZmlpANMJD2R5bkNhbGxfZGlkZGlkZADUCRBkeW5DYWxsX2RpaWRkaWRkANUJD2R5bkNhbGxfZGlkZGRkZADWCRBkeW5DYWxsX2RpaWRkZGRkANcJD2R5bkNhbGxfZGlkZGRpaQDYCRBkeW5DYWxsX2RpaWRkZGlpANkJEWR5bkNhbGxfZGlkZGRkZGlpANoJEmR5bkNhbGxfZGlpZGRkZGRpaQDbCQxkeW5DYWxsX2RpZGkA3AkNZHluQ2FsbF9kaWlkaQDdCQpkeW5DYWxsX2RkAIQBD2R5bkNhbGxfZGlkaWRkZADeCRBkeW5DYWxsX2RpaWRpZGRkAN8JC2R5bkNhbGxfZGRkAJgBDWR5bkNhbGxfZGlkZGkA4AkOZHluQ2FsbF9kaWlkZGkA4QkMZHluQ2FsbF92aWRpAOIJDWR5bkNhbGxfdmlpZGkA4wkOZHluQ2FsbF92aWlpaWkA5AkMZHluQ2FsbF9paWZpAOUJDWR5bkNhbGxfaWlpZmkA5gkKZHluQ2FsbF9maQDnCQtkeW5DYWxsX2ZpaQDoCQ1keW5DYWxsX2ZpaWlpAOkJDmR5bkNhbGxfZmlpaWlpAOoJD2R5bkNhbGxfdmlpaWlkZADrCRBkeW5DYWxsX3ZpaWlpaWRkAOwJDGR5bkNhbGxfdmlpZgDtCQ1keW5DYWxsX3ZpaWlmAO4JDWR5bkNhbGxfaWlpaWYA7wkOZHluQ2FsbF9kaWRkaWQA8AkPZHluQ2FsbF9kaWlkZGlkAPEJD2R5bkNhbGxfZGlkZGRpZADyCRBkeW5DYWxsX2RpaWRkZGlkAPMJDmR5bkNhbGxfZGlkZGRpAPQJD2R5bkNhbGxfZGlpZGRkaQD1CQtkeW5DYWxsX2lpZAD2CQpkeW5DYWxsX2lkAMICDmR5bkNhbGxfdmlpamlpAP8JDGR5bkNhbGxfamlqaQCACg9keW5DYWxsX2lpZGlpaWkA9wkOZHluQ2FsbF9paWlpaWkA+AkRZHluQ2FsbF9paWlpaWlpaWkA+QkPZHluQ2FsbF9paWlpaWlpAPoJDmR5bkNhbGxfaWlpaWlqAIEKDmR5bkNhbGxfaWlpaWlkAPsJD2R5bkNhbGxfaWlpaWlqagCCChBkeW5DYWxsX2lpaWlpaWlpAPwJEGR5bkNhbGxfaWlpaWlpamoAgwoPZHluQ2FsbF92aWlpaWlpAP0JCWR5bkNhbGxfdgD+CQnADAEAQQEL/gYyMzQ1Njc2NzgzOTo7MzQ87wI98AI+P0BBQkNERUZHMzRI8gJJ8wJKSzM0TPUCTfYCTvcCT1AzNFFSU1RVVkJXRVgzWVpbXF0zNF5fYGFCYkFjZEFCZWZnaGk0amtFgwNGhQNs/gJtggNFiwNBjgNTjAONA26PA2+HA5EDiAOKA4YDcHGSA0KTA3L4AnP5ApADdDM0dZQDdpUDd5YDU5cDQpgDmQNmeDM0eZoDepsDe5wDfJ0DQpcDnwOeA31+RUZ/MzQ1oAOAAYEBggGDAYQBhQEzNIYBhwFuiAEzNIkBigGLAYwBMzSNAY4BiwGPATM0kAGRAW6SATM0kwGUAUKVAZYBd5cBMzQ1mAGZAZoBmwGcAZ0BngGfAaABoQGiAaMBpAEzNKUBsANwrwNCsQNGpgFFpwGoAUVGqQGqAX1+qwGsAUGtAa4BpgGvAUWwAbEBsgEzNLMBtAG1AWRCY0G2AbcBuAG5AboBbrsBvAG9AUa+Ab8BwAFFwQHCAcIBtwG4AcMBxAFuxQG8AcYBRr4BvwHAAUXHAcgBNMkBsgPKAbMDywG1A8wBtgPCAc0BzgHPAdABRdEB0gHTAdQB1QE01gG3A8oBuAPXAdgB2QE02gHbAdwB3QHeAd8B4AE04QHiAeMB5AHlAeYBRecB6AHpAeoB6wHgATThAewB7QHuAe8B8AFF8QHoAfIB8wH0AeABNOEB9QH2AfcB+AH5AUX6AegB+wH8Af0B4AE04QH1AfYB9wH4AfkBRf4B6AH7AfwB/wHgATThAeIBgALkAYEC5gFFggLoAekBgwKHAogCiQKKAosCjAKNAo4CjwJGkAJBY5ECQpICkwKUApUClgKXAokCigKYAowCjQKZApoCRpsCkwKcAogCNJ0CngJGkAJBY5ECQp8CoAKhAkWiAqMCpAKlAqgCM6kCwgGqAqsCrAKtAq4CrwKwArECsgKzArQCtQK2ArcCuAK5AroCuwK8Ar0CvgI0vwKBAcACwQLCAsMCywLMAjTNAscDU84CzAI0zwLJA2/rCMQCMzTFAsYCbscCMzTIAskCtQHbAtwC3QLeAt8C4ALhAuICzAjfAuMCwgHfAuYC5wLdAugC3wLpAuoC6wLfAsIBgQOiA6EDowPYBNoE2QTbBP0CpQOmA6cDqAOqA6QDngTLBKsDzgSsA9AErQPXA8oDlASiBPADhQSGBJwEngSfBKAExATFBMcEyATJBMoEngTNBM8EzwTRBNIExwTIBMkEygSeBJ4E1ATNBNYEzwTXBM8E2ATaBNkE2wTzBPUE9AT2BPME9QT0BPYEwQSBBcAEwwTABMMEiAWUBZUFlgWYBZkFmgWbBZwFngWfBZQFoAWhBaIFowWaBaQFoQWlBaYFwgWhCfIDzAfPB5MIlgiaCJ0IoAijCKUIpwipCKsIrQivCLEIswjFB8cHzgfcB90H3gffB+AH4QfYB+IH4wfkB7kH6AfpB+wH7wfwB54E8wf1B4MIhAiHCIgIiQiLCI4IhQiGCLgGsgaKCIwIjwjCAd8C3wLQB9EH0gfTB9QH1QfWB9cH2AfZB9oH2wffAuUH5QfmB/ED8QPnB/ED3wL2B/gH5geeBJ4E+gf8B98C/Qf/B+YHngSeBIEI/AffAt8CwgHfAtsF3AXeBcIB3wLfBeAF4gXfAuMF6AXxBfQF9wX3BfoF/QWCBoUGiAbfAo4GkQaWBpgGmgaaBpwGngaiBqQGpgbfAqkGrAazBrQGtQa2BrsGvAbfAr0GvwbEBsUGxgbHBskGygbCAd8CzgbPBtAG0QbTBtUG2AaRCJgIngisCLAIpAioCMIB3wLOBuYG5wboBuoG7AbvBpQImwihCK4IsgimCKoItQi0CPwGtQi0CIAH3wKFB4UHhgeGB4YHhweeBIgHiAffAoUHhQeGB4YHhgeHB54EiAeIB98CiQeJB4YHhgeGB4oHngSIB4gH3wKJB4kHhgeGB4YHigeeBIgHiAffAosHkQffApoHngffAqYHqgffAqsHrwffArIHswfHBN8Csge2B8cEwgHKCOkIwgHfAuoI7QjDCO4I3wLvCMIB3wLyA/ID8AjfAvAI3wLyCIUJggn1CN8ChAmBCfYI3wKDCf4I+AjfAvoInwkK+qYP2QkWABDEBRCHBRDsAkHguwJB/gYRAAAaC8ktAQJ/EC0QLhAvEDAQMUGEI0GcI0G8I0EAQbAXQQFBsxdBAEGzF0EAQboIQbUXQQIQAEGEI0EBQcwjQbAXQQNBBBABQYQjQcYIQQJB0CNB2CNBBUEGEAJBhCNB1QhBAkHcI0HYI0EHQQgQAkH0I0GMJEGwJEEAQbAXQQlBsxdBAEGzF0EAQeYIQbUXQQoQAEH0I0HzCEEEQcAkQeAXQQtBDBACQeAkQfgkQZwlQQBBsBdBDUGzF0EAQbMXQQBB+QhBtRdBDhAAQeAkQQFBrCVBsBdBD0EQEAFBCBDOCCIAQhE3AwBB4CRBhglBBEGwJUHAJUESIABBABADQQgQzggiAEITNwMAQeAkQYsJQQRB0CVB4BpBFCAAQQAQA0EIEM4IIgBCFTcDAEEIEM4IIgFCFjcDAEHgJEGTCUHQ7QFB4CVBFyAAQdDtAUHIGkEYIAEQBEEIEM4IIgBCGTcDAEEIEM4IIgFCGjcDAEHgJEGdCUGU7QFB8BdBGyAAQZTtAUHIF0EcIAEQBEH0JUGQJkG0JkEAQbAXQR1BsxdBAEGzF0EAQaYJQbUXQR4QAEH0JUEBQcQmQbAXQR9BIBABQQgQzggiAEIhNwMAQfQlQbQJQQVB0CZB5CZBIiAAQQAQA0EIEM4IIgBCIzcDAEH0JUG0CUEGQfAmQYgnQSQgAEEAEANBnCdBsCdBzCdBAEGwF0ElQbMXQQBBsxdBAEG3CUG1F0EmEABBnCdBAUHcJ0GwF0EnQSgQAUEIEM4IIgBCKTcDAEGcJ0G/CUEFQeAnQfQnQSogAEEAEANBCBDOCCIAQis3AwBBnCdBxglBBkGAKEGYKEEsIABBABADQQgQzggiAEItNwMAQZwnQcsJQQdBoChBvChBLiAAQQAQA0HQKEHkKEGAKUEAQbAXQS9BsxdBAEGzF0EAQdUJQbUXQTAQAEHQKEEBQZApQbAXQTFBMhABQQgQzggiAEIzNwMAQdAoQd4JQQNBlClBoClBNCAAQQAQA0EIEM4IIgBCNTcDAEHQKEHjCUEGQbApQcgpQTYgAEEAEANBCBDOCCIAQjc3AwBB0ChB6wlBA0HQKUHIGkE4IABBABADQQgQzggiAEI5NwMAQdAoQfkJQQJB3ClB8BdBOiAAQQAQA0HwKUGEKkGkKkEAQbAXQTtBsxdBAEGzF0EAQYgKQbUXQTwQAEHwKUGSCkEEQcAqQZAbQT1BPhACQfApQZIKQQRB0CpB4CpBP0HAABACQfgqQZQrQbgrQQBBsBdBwQBBsxdBAEGzF0EAQZgKQbUXQcIAEABB+CpBAUHIK0GwF0HDAEHEABABQQgQzggiAELFADcDAEH4KkGjCkEEQdArQeArQcYAIABBABADQQgQzggiAELHADcDAEH4KkGoCkEDQegrQcgaQcgAIABBABADQQgQzggiAELJADcDAEH4KkGyCkECQfQrQeAlQcoAIABBABADQQgQzggiAELLADcDAEEIEM4IIgFCzAA3AwBB+CpBuApB0O0BQeAlQc0AIABB0O0BQcgaQc4AIAEQBEEIEM4IIgBCzwA3AwBBCBDOCCIBQtAANwMAQfgqQb4KQdDtAUHgJUHNACAAQdDtAUHIGkHOACABEARBCBDOCCIAQskANwMAQQgQzggiAULRADcDAEH4KkHOCkHQ7QFB4CVBzQAgAEHQ7QFByBpBzgAgARAEQYwsQaQsQcQsQQBBsBdB0gBBsxdBAEGzF0EAQdIKQbUXQdMAEABBjCxBAUHULEGwF0HUAEHVABABQQgQzggiAELWADcDAEGMLEHdCkECQdgsQfAXQdcAIABBABADQQgQzggiAELYADcDAEGMLEHnCkEDQeAsQcgXQdkAIABBABADQQgQzggiAELaADcDAEGMLEHnCkEEQfAsQeAXQdsAIABBABADQQgQzggiAELcADcDAEGMLEHxCkEEQYAtQcAYQd0AIABBABADQQgQzggiAELeADcDAEGMLEGGC0ECQZAtQfAXQd8AIABBABADQQgQzggiAELgADcDAEGMLEGOC0ECQZgtQeAlQeEAIABBABADQQgQzggiAELiADcDAEGMLEGOC0EDQaAtQaApQeMAIABBABADQQgQzggiAELkADcDAEGMLEGXC0EDQaAtQaApQeMAIABBABADQQgQzggiAELlADcDAEGMLEGXC0EEQbAtQcAtQeYAIABBABADQQgQzggiAELnADcDAEGMLEGXC0EFQdAtQeQtQegAIABBABADQQgQzggiAELpADcDAEGMLEHeCUECQZgtQeAlQeEAIABBABADQQgQzggiAELqADcDAEGMLEHeCUEDQaAtQaApQeMAIABBABADQQgQzggiAELrADcDAEGMLEHeCUEFQdAtQeQtQegAIABBABADQQgQzggiAELsADcDAEGMLEGgC0EFQdAtQeQtQegAIABBABADQQgQzggiAELtADcDAEGMLEGLCUECQewtQdgjQe4AIABBABADQQgQzggiAELvADcDAEGMLEGmC0ECQewtQdgjQe4AIABBABADQQgQzggiAELwADcDAEGMLEGsC0EDQfQtQcgaQfEAIABBABADQQgQzggiAELyADcDAEGMLEG2C0EGQYAuQZguQfMAIABBABADQQgQzggiAEL0ADcDAEGMLEG/C0EEQaAuQcAYQfUAIABBABADQQgQzggiAEL2ADcDAEGMLEHEC0ECQZAtQfAXQd8AIABBABADQQgQzggiAEL3ADcDAEGMLEHJC0EEQbAtQcAtQeYAIABBABADQcQvQdgvQfQvQQBBsBdB+ABBsxdBAEGzF0EAQdgLQbUXQfkAEABBxC9BAUGEMEGwF0H6AEH7ABABQQgQzggiAEL8ADcDAEHEL0HgC0EHQZAwQawwQf0AIABBABADQQgQzggiAEL+ADcDAEHEL0HlC0EHQcAwQdwwQf8AIABBABADQQgQzggiAEKAATcDAEHEL0HwC0EDQegwQaApQYEBIABBABADQQgQzggiAEKCATcDAEHEL0H5C0EDQfQwQcgaQYMBIABBABADQQgQzggiAEKEATcDAEHEL0GDDEEDQfQwQcgaQYMBIABBABADQQgQzggiAEKFATcDAEHEL0GODEEDQfQwQcgaQYMBIABBABADQQgQzggiAEKGATcDAEHEL0GbDEEDQfQwQcgaQYMBIABBABADQYwxQaAxQbwxQQBBsBdBhwFBsxdBAEGzF0EAQaQMQbUXQYgBEABBjDFBAUHMMUGwF0GJAUGKARABQQgQzggiAEKLATcDAEGMMUGsDEEHQdAxQewxQYwBIABBABADQQgQzggiAEKNATcDAEGMMUGvDEEJQYAyQaQyQY4BIABBABADQQgQzggiAEKPATcDAEGMMUGvDEEEQbAyQcAyQZABIABBABADQQgQzggiAEKRATcDAEGMMUH5C0EDQcgyQcgaQZIBIABBABADQQgQzggi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ADYCBAsFAEH0IwsNACABIAIgAyAAEQUACx0AQej8ASABNgIAQeT8ASAANgIAQez8ASACNgIACwUAQeAkCwcAQTgQzggLOQEBfyABIAAoAgQiBEEBdWohASAAKAIAIQAgASACIAMgBEEBcQR/IAEoAgAgAGooAgAFIAALER4ACzkBAX8gASAAKAIEIgRBAXVqIQEgACgCACEAIAEgAiADIARBAXEEfyABKAIAIABqKAIABSAACxEaAAsHACAAKwMwCwkAIAAgATkDMAs1AQF/IAEgACgCBCICQQF1aiEBIAAoAgAhACABIAJBAXEEfyABKAIAIABqKAIABSAACxEQAAs3AQF/IAEgACgCBCIDQQF1aiEBIAAoAgAhACABIAIgA0EBcQR/IAEoAgAgAGooAgAFIAALEQ8ACwcAIAAoAiwLCQAgACABNgIsCzUBAX8gASAAKAIEIgJBAXVqIQEgACgCACEAIAEgAkEBcQR/IAEoAgAgAGooAgAFIAALEQAACzcBAX8gASAAKAIEIgNBAXVqIQEgACgCACEAIAEgAiADQQFxBH8gASgCACAAaigCAAUgAAsRAgALBQBB9CULDQBBqJHWABDOCBDxAgs7AQF/IAEgACgCBCIFQQF1aiEBIAAoAgAhACABIAIgAyAEIAVBAXEEfyABKAIAIABqKAIABSAACxFYAAs9AQF/IAEgACgCBCIGQQF1aiEBIAAoAgAhACABIAIgAyAEIAUgBkEBcQR/IAEoAgAgAGooAgAFIAALEVkACwUAQZwnCxAAQfgAEM4IQQBB+AAQrQkLOwEBfyABIAAoAgQiBUEBdWohASAAKAIAIQAgASACIAMgBCAFQQFxBH8gASgCACAAaigCAAUgAAsROgALPQEBfyABIAAoAgQiBkEBdWohASAAKAIAIQAgASACIAMgBCAFIAZBAXEEfyABKAIAIABqKAIABSAACxE7AAs/AQF/IAEgACgCBCIHQQF1aiEBIAAoAgAhACABIAIgAyAEIAUgBiAHQQFxBH8gASgCACAAaigCAAUgAAsRPAALBQBB0CgLXgEBf0HQABDOCCIAQgA3AwAgAEIANwMgIABCgICAgICAgPi/fzcDGCAAQgA3AzggAEEBOgBIIABCADcDECAAQgA3AwggAEIANwMoIABBADoAMCAAQUBrQgA3AwAgAAv5AQIBfwN8IAAtADBFBEAgACsDKCEDAkAgACsDIEQAAAAAAAAAAGENACADRAAAAAAAAAAAYg0ARAAAAAAAAAAAIQMgAUQAAAAAAAAAAGRBAXNFBEBEAAAAAAAA8D9EAAAAAAAAAAAgACsDGEQAAAAAAAAAAGUbIQMLIAAgAzkDKCAAIAApAzg3AwgLAkAgA0QAAAAAAAAAAGENACAAIAArAxAiBCAAKwMIoCIDOQMIIAAgAyAAKwNAIgVlIAMgBWYgBEQAAAAAAAAAAGUbIgI6ADAgAkUNACAALQBIDQAgAEEAOgAwIABCADcDKAsgACABOQMYCyAAKwMICzcBAX8gASAAKAIEIgNBAXVqIQEgACgCACEAIAEgAiADQQFxBH8gASgCACAAaigCAAUgAAsREwALWwIBfwF+IAAgAjkDQCAAKQM4IQYgACABOQM4IAAgBjcDCEHk/AEoAgAhBSAAIAQ6AEggAEEAOgAwIABCADcDKCAAIAIgAaEgA0QAAAAAAECPQKMgBbeiozkDEAs9AQF/IAEgACgCBCIGQQF1aiEBIAAoAgAhACABIAIgAyAEIAUgBkEBcQR/IAEoAgAgAGooAgAFIAALET4ACyYAIABEAAAAAAAA8D9EAAAAAAAAAAAgAUQAAAAAAAAAAGQbOQMgCwcAIAAtADALBQBB8CkLRgEBfyMAQRBrIgQkACAEIAEgAiADIAARGQBBDBDOCCIAIAQoAgA2AgAgACAEKAIENgIEIAAgBCgCCDYCCCAEQRBqJAAgAAvfAgIDfwF8RAAAAAAAAPA/IQcCQCADRAAAAAAAAPA/ZA0AIAMiB0QAAAAAAADwv2NBAXMNAEQAAAAAAADwvyEHCyABKAIAIQYgASgCBCEBIABBADYCCCAAQgA3AgACQAJAIAEgBmsiAUUNACABQQN1IgVBgICAgAJPDQEgB0QAAAAAAADwP6REAAAAAAAA8L+lRAAAAAAAAPA/oEQAAAAAAADgP6JEAAAAAAAAAACgIgOfIQdEAAAAAAAA8D8gA6GfIQMgACABEM4IIgQ2AgAgACAENgIEIAAgBCAFQQN0ajYCCCAEQQAgARCtCSIEIQEDQCABQQhqIQEgBUF/aiIFDQALIAAgATYCBCABIARGDQAgASAEa0EDdSEFIAIoAgAhAkEAIQEDQCAEIAFBA3QiAGogACAGaisDACADoiAHIAAgAmorAwCioDkDACABQQFqIgEgBUkNAAsLDwsQ5wgACw0AIAEgAiADIAARcQAL0gEBA38jAEEwayIDJAAgA0EANgIoIANCADcDICADQQgQzggiBDYCICADIARBCGoiBTYCKCAEIAA5AwAgAyAFNgIkIANBADYCGCADQgA3AxAgA0EIEM4IIgQ2AhAgAyAEQQhqIgU2AhggBCABOQMAIAMgBTYCFCADIANBIGogA0EQaiACEFogAygCACIEKwMAIQAgAyAENgIEIAQQoQkgAygCECIEBEAgAyAENgIUIAQQoQkLIAMoAiAiBARAIAMgBDYCJCAEEKEJCyADQTBqJAAgAAsFAEH4KgswAQF/QRgQzggiAEIANwMQIABCgICAgICAgPA/NwMIIABCgICAgICAgPA/NwMAIAALIQAgACACOQMQIAAgATkDACAARAAAAAAAAPA/IAGhOQMICzkBAX8gASAAKAIEIgRBAXVqIQEgACgCACEAIAEgAiADIARBAXEEfyABKAIAIABqKAIABSAACxE9AAsbACAAIAArAwAgAaIgACsDCCAAKwMQoqA5AxALBwAgACsDEAsHACAAKwMACwkAIAAgATkDAAsHACAAKwMICwkAIAAgATkDCAsJACAAIAE5AxALBQBBjCwLNwEBfyAABEAgACgCbCIBBEAgACABNgJwIAEQoQkLIAAsAAtBf0wEQCAAKAIAEKEJCyAAEKEJCwuJAQECf0GIARDOCCIAQgA3AgAgAEIANwMoIABBATsBYCAAQgA3A1ggAEKAgICAgICA8D83A1AgAEKAgICAgICA8D83A0ggAEEANgIIIABCADcDMEHk/AEoAgAhASAAQQA2AnQgAEIANwJsIAAgATYCZCAAQQE6AIABIABCgICAgICAgPg/NwN4IAALEAAgACgCcCAAKAJsa0EDdQs5AQF/IAEgACgCBCIEQQF1aiEBIAAoAgAhACABIAIgAyAEQQFxBH8gASgCACAAaigCAAUgAAsRBQALOQEBfyABIAAoAgQiBEEBdWohASAAKAIAIQAgASACIAMgBEEBcQR/IAEoAgAgAGooAgAFIAALEQQACzkBAX8gASAAKAIEIgRBAXVqIQEgACgCACEAIAEgAiADIARBAXEEfyABKAIAIABqKAIABSAACxEUAAs7AQF/IAEgACgCBCIFQQF1aiEBIAAoAgAhACABIAIgAyAEIAVBAXEEfyABKAIAIABqKAIABSAACxEYAAs1AQF/IAEgACgCBCICQQF1aiEBIAAoAgAhACABIAJBAXEEfyABKAIAIABqKAIABSAACxEBAAsMACAAIAAoAmw2AnALPQEBfyABIAAoAgQiBkEBdWohASAAKAIAIQAgASACIAMgBCAFIAZBAXEEfyABKAIAIABqKAIABSAACxE5AAvlAQEEfyMAQRBrIgQkACABIAAoAgQiBkEBdWohByAAKAIAIQUgBkEBcQRAIAcoAgAgBWooAgAhBQsgAigCACEAIARBADYCCCAEQgA3AwAgAEFwSQRAAkACQCAAQQtPBEAgAEEQakFwcSIGEM4IIQEgBCAGQYCAgIB4cjYCCCAEIAE2AgAgBCAANgIEDAELIAQgADoACyAEIQEgAEUNAQsgASACQQRqIAAQrAkaCyAAIAFqQQA6AAAgByAEIAMgBREEACEAIAQsAAtBf0wEQCAEKAIAEKEJCyAEQRBqJAAgAA8LENIIAAsFAEHELwsQAEHYABDOCEEAQdgAEK0JCz8BAX8gASAAKAIEIgdBAXVqIQEgACgCACEAIAEgAiADIAQgBSAGIAdBAXEEfyABKAIAIABqKAIABSAACxFaAAs/AQF/IAEgACgCBCIHQQF1aiEBIAAoAgAhACABIAIgAyAEIAUgBiAHQQFxBH8gASgCACAAaigCAAUgAAsRLQALBQBBjDELGwEBf0HYABDOCEEAQdgAEK0JIgBBATYCPCAACz8BAX8gASAAKAIEIgdBAXVqIQEgACgCACEAIAEgAiADIAQgBSAGIAdBAXEEfyABKAIAIABqKAIABSAACxFbAAtDAQF/IAEgACgCBCIJQQF1aiEBIAAoAgAhACABIAIgAyAEIAUgBiAHIAggCUEBcQR/IAEoAgAgAGooAgAFIAALEV0ACzkBAX8gASAAKAIEIgRBAXVqIQEgACgCACEAIAEgAiADIARBAXEEfyABKAIAIABqKAIABSAACxFXAAsHACAAKAI4CwkAIAAgATYCOAsFAEHgMgsMACABIAAoAgAREAALCQAgASAAERAACxcAIABEAAAAAABAj0CjQeT8ASgCALeiCwwAIAEgACgCABEVAAsJACABIAARFQALBQBBzDMLIAEBf0EYEM4IIgBCADcDACAAQgE3AxAgAEIA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gICAAk8NAiAHIAgQzggiAzYCACAHIAM2AgQgByADIARBA3RqNgIIIAhBAEoNAQsgBisDACEMRAAAAAAAAAAAIQsgAyEFDAILIAcgAyAFIAgQrAkiBCAIaiIFNgIEIAYrAwAhDEQAAAAAAAAAACELIAhFDQEDQCALIAQrAwAgDKEQtASgIQsgBEEIaiIEIAVHDQALDAELEOcIAAsgBiAGKwMIIAJEAAAAAAAAAAAgCRsgBSADa0EDdbijIAuiIAGgoiAMoCILOQMARBgtRFT7IRnAIQwCQCALRBgtRFT7IRlAZkEBcwRARBgtRFT7IRlAIQwgC0QAAAAAAAAAAGNBAXMNAQsgBiALIAygIgs5AwALIAMEQCAHIAM2AgQgAxChCQsgDSALoCENIAZBEGoiBiAKRg0BIAAtABghCQwAAAsACyAAQQA6ABggACgCECEDIAAoAgwhACAHQRBqJAAgDSADIABrQQN1uKMLGQAgACgCACACQQR0aiABOQMAIABBAToAGAtOAQN/IAEoAgAiAiABKAIEIgNHBEAgACgCACEEQQAhAQNAIAQgAUEEdGogAikDADcDACABQQFqIQEgAkEIaiICIANHDQALCyAAQQE6ABgLBQBBjD8LDwAgAARAIAAQ1wIQoQkLC24BAX9BlAEQzggiAEIANwJQIABCADcCACAAQgA3AnggAEIANwJwIABCADcCaCAAQgA3AmAgAEIANwJYIABCADcCCCAAQgA3AhAgAEIANwIYIABCADcCICAAQgA3AiggAEIANwIwIABBADYCOCAACzsBAX8gASAAKAIEIgVBAXVqIQEgACgCACEAIAEgAiADIAQgBUEBcQR/IAEoAgAgAGooAgAFIAALEQsACzkBAX8gASAAKAIEIgRBAXVqIQEgACgCACEAIAEgAiADIARBAXEEfyABKAIAIABqKAIABSAACxFEAAs1AQF/IAEgACgCBCICQQF1aiEBIAAoAgAhACABIAJBAXEEfyABKAIAIABqKAIABSAACxEnAAu8AQECfyABIAAoAgQiAkEBdWohASAAKAIAIQAgASACQQFxBH8gASgCACAAaigCAAUgAAsRAAAhAUEMEM4IIgBBADYCCCAAQgA3AgACQAJAIAEoAgQgASgCAGsiAkUNACACQQJ1IgNBgICAgARPDQEgACACEM4IIgI2AgAgACAC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IANBD2ogABECACADQRBqJAALOAECfyAAKAIEIAAoAgAiBGsiAyABSQRAIAAgASADayACENQCDwsgAyABSwRAIAAgASAEajYCBAsLVAECfyMAQRBrIgQkACABIAAoAgQiBUEBdWohASAAKAIAIQAgBUEBcQRAIAEoAgAgAGooAgAhAAsgBCADOgAPIAEgAiAEQQ9qIAARBQAgBEEQaiQACw0AIAAoAgQgACgCAGsLSwECfyMAQRBrIgMkAEEBIQQgACABKAIEIAEoAgAiAWsgAksEfyADIAEgAmosAAA2AghB2OwBIANBCGoQCgVBAQs2AgAgA0EQaiQACxQAIAAoAgAgAWogAi0AADoAAEEBCzQBAX8jAEEQayIEJAAgACgCACEAIAQgAzoADyABIAIgBEEPaiAAEQQAIQAgBEEQaiQAIAALBQBByB4LSwECfyMAQRBrIgMkAEEBIQQgACABKAIEIAEoAgAiAWsgAksEfyADIAEgAmotAAA2AghB5OwBIANBCGoQCgVBAQs2AgAgA0EQaiQACwUAQYghC1IBAn8jAEEQayIDJAAgASAAKAIEIgRBAXVqIQEgACgCACEAIARBAXEEQCABKAIAIABqKAIAIQALIAMgAjgCDCABIANBDGogABECACADQRBqJAALVAECfyMAQRBrIgQkACABIAAoAgQiBUEBdWohASAAKAIAIQAgBUEBcQRAIAEoAgAgAGooAgAhAAsgBCADOAIMIAEgAiAEQQxqIAARBQAgBEEQaiQAC1EBAn8jAEEQayIDJABBASEEIAAgASgCBCABKAIAIgFrQQJ1IAJLBH8gAyABIAJBAnRqKAIANgIIQcTtASADQQhqEAoFQQELNgIAIANBEGokAAs0AQF/IwBBEGsiBCQAIAAoAgAhACAEIAM4AgwgASACIARBDGogABEEACEAIARBEGokACAAC5MCAQZ/IAAoAggiBCAAKAIEIgNrQQN1IAFPBEADQCADIAIpAwA3AwAgA0EIaiEDIAFBf2oiAQ0ACyAAIAM2AgQPCwJAIAMgACgCACIGayIHQQN1IgggAWoiA0GAgICAAkkEQAJ/QQAgAyAEIAZrIgRBAnUiBSAFIANJG0H/////ASAEQQN1Qf////8ASRsiBEUNABogBEGAgICAAk8NAiAEQQN0EM4ICyIFIAhBA3RqIQMDQCADIAIp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dCADaiEDIARBAWoiBCACRw0ACwsgACADIAEgAmtBAWoiAHRxIAB2CwcAIAAgAXELBwAgACABcgsHACAAIAFzCwcAIABBf3MLBwAgAEEBagsHACAAQX9qCwcAIAAgAWoLBwAgACABawsHACAAIAFsCwcAIAAgAW4LBwAgACABSwsHACAAIAFJCwcAIAAgAU8LBwAgACABTQsHACAAIAFGCykBAX5BwJICQcCSAikDAEKt/tXk1IX9qNgAfkIBfCIANwMAIABCIYinCyoBAXwgALhEAADg////70GkRAAA4P///+9BoyIBIAGgRAAAAAAAAPC/oAsXAEQAAAAAAADwP0QAAAAAAADwvyAAGwsJACABIAARaQALOgAgAEQAAID////fQaJEAADA////30GgIgBEAAAAAAAA8EFjIABEAAAAAAAAAABmcQRAIACrDwtBAAsGAEG40gALXwECf0EoEM4IIgBCADcDCCAAQgA3AwAgAEIANwMgIABBGGoiAUIANwMAIABCADcDECAAQQE6ABAgAEKAgICAgICA+D83AwggAUEBOgAIIAFCgICAgICAgPg/NwMAIAAL7QEAAkACQAJAIAArAwhEAAAAAAAAAABlRQRAIAFEAAAAAAAAAABkQQFzDQEgAC0AEEUNAQwCCyABRAAAAAAAAAAAZA0BCyAAIAE5AwggAEEAOgAQDAELIAAgATkDCCAAQQA6ABAgACAAKwMARAAAAAAAAPA/oDkDAAsCQAJAIAArAxhEAAAAAAAAAABlRQRAIAJEAAAAAAAAAABkQQFzDQEgAC0AIEUNAQwCCyACRAAAAAAAAAAAZA0BCyAAIAI5AxggAEEAOgAgIAArAwAPCyAAIAI5AxggAEIANwMAIABBADoAIEQAAAAAAAAAAAsGAEGs0wALPQEBf0EYEM4IIgBCADcDACAAQgA3AxAgAEIANwMIIABBAToACCAAQoCAgICAgID4PzcDACAAQgA3AxAgAAvUAQEBfgJAAkAgACsDAEQAAAAAAAAAAGVFBEAgAUQAAAAAAAAAAGRBAXMNASAALQAIRQ0BDAILIAFEAAAAAAAAAABkDQELIABBADoACCAAIAE5AwAgACsDEA8LIABBADoACCAAIAE5AwAgAAJ/IAJEAAAAAAAAAAClRAAAAAAAAPA/pERHnKH6///vP6IgAygCBCADKAIA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GC1EVPshGUCiIAOjEK8ERAAAAAAAAOC/okQAAAAAAADgP6C2OAIAIAJBAWoiAiAASA0ACwsL4gIBA38jAEEQayIDJAAgACABNgIAIAAgAUECbTYCBCADQQA2AgwCQCAAKAIMIAAoAggiBGtBAnUiAiABSQRAIABBCGogASACayADQQxqENICIAAoAgAhAQwBCyACIAFNDQAgACAEIAFBAnRqNgIMCyADQQA2AgwCQCABIAAoAiQgACgCICIEa0ECdSICSwRAIABBIGogASACayADQQxqENICIAAoAgAhAQwBCyABIAJPDQAgACAEIAFBAnRqNgIkCyADQQA2AgwCQCABIAAoAhggACgCFCIEa0ECdSICSwRAIABBFGogASACayADQQxqENICIAAoAgAhAQwBCyABIAJPDQAgACAEIAFBAnRqNgIYCyADQQA2AgwCQCABIAAoAjAgACgCLCIEa0ECdSICSwRAIABBLGogASACayADQQxqENICDAELIAEgAk8NACAAIAQgAUECdGo2AjALIANBEGokAAtcAQF/IAAoAiwiAQRAIAAgATYCMCABEKEJCyAAKAIgIgEEQCAAIAE2AiQgARChCQsgACgCFCIBBEAgACABNgIYIAEQoQkLIAAoAggiAQRAIAAgATYCDCABEKEJCwtZAQR/IAAoAgghBCAAKAIAIgVBAEoEQANAIAQgA0ECdCIGaiABIANBAnRqKgIAIAIgBmoqAgCUOAIAIANBAWoiAyAFSA0ACwsgBSAEIAAoAhQgACgCLBC6AwvLAQIEfwF9IAAoAgghBiAAKAIAIgdBAU4EQANAIAYgBUECdCIIaiABIAVBAnRqKgIAIAIgCGoqAgCUOAIAIAVBAWoiBSAHRw0ACwsgByAGIAAoAhQgACgCLBC6AyAAKAIEIgJBAU4EQCAAKAIsIQUgACgCFCEGQQAhAANAIAMgAEECdCIBaiABIAZqIgcqAgAiCSAJlCABIAVqIggqAgAiCSAJlJKROAIAIAEgBGogCCoCACAHKgIAELkEOAIAIABBAWoiACACRw0ACwsLWwICfwF9IAAoAgQiAEEASgRAA0AgAiADQQJ0IgRqQwAAAAAgASAEaioCACIFQwAAgD+SEKkJQwAAoEGUIAW7RI3ttaD3xrA+Yxs4AgAgA0EBaiIDIABIDQALCwu7AQEFfyAAKAIsIQYgACgCFCEHIAAoAgQiCUEASgRAA0AgByAIQQJ0IgVqIAMgBWooAgA2AgAgBSAGaiAEIAVqKAIANgIAIAhBAWoiCCAJSA0ACwsgACgCAEEBIAAoAgggACgCICAHIAYQuQMgACgCACIDQQFOBEAgACgCFCEEQQAhAANAIAEgAEECdGoiBSAEIABBAnQiBmoqAgAgAiAGaioCAJQgBSoCAJI4AgAgAEEBaiIAIANHDQALCwuBAgEHfyAAKAIIIQYgACgCBCIHQQFOBEAgACgCICEJA0AgBiAIQQJ0IgVqIAMgBWoiCioCACAEIAVqIgsqAgAQswSUOAIAIAUgCWogCioCACALKgIAELUElDgCACAIQQFqIgggB0cNAAsLQQAhAyAGIAdBAnQiBGpBACAEEK0JGiAAKAIEQQJ0IgQgACgCIGpBACAEEK0JGiAAKAIAQQEgACgCCCAAKAIgIAAoAhQgACgCLBC5AyAAKAIAIgRBAU4EQCAAKAIUIQADQCABIANBAnRqIgUgACADQQJ0IgZqKgIAIAIgBmoqAgCUIAUqAgCSOAIAIANBAWoiAyAERw0ACwsL8QECBn8BfCAAKAIEIgIEQCAAKAIAIQMCQCAAKAIoIgVFBEAgA0EAIAJBASACQQFLG0EDdBCtCRogACgCACEDDAELIAAoAiQhBgNAIAMgBEEDdGoiB0IANwMARAAAAAAAAAAAIQhBACEAA0AgByAGIAAgAmwgBGpBA3RqKwMAIAEgAEECdGoqAgC7oiAIoCIIOQMAIABBAWoiACAFRw0ACyAEQQFqIgQgAkcNAAsLQQAhAANAIAMgAEEDdGoiASABKwMAIgggCKIQuwREAAAAAAAAAAAgCESN7bWg98awPmQbOQMAIABBAWoiACACRw0ACwsL2wEBAn8gAEIANwIAIABCADcD8AEgAEIANwOIAiAAQgA3A4ACIABCADcD+AEgAEIANwMYIABCADcDCCAAQrPmzJmz5sz1PzcDKCAAQpqz5syZs+b0PzcDICAAQQA2AhAgACgCACIBBEAgASAAKAIEIgJHBEAgACACIAIgAWtBeGpBA3ZBf3NBA3RqNgIECyABEKEJIABCADcCAAsgAEGgxBUQzggiATYCACAAIAE2AgQgAUEAQaDEFRCtCRpBxNgCIQIDQCABQQhqIQEgAkF/aiICDQALIAAgATYCBAu1GwIEfwF8IABBQGsQxAMgAEHgAmoQxAMgAEGABWoQxAMgAEGgB2oQxAMgAEHACWoQxAMgAEHgC2oQxAMgAEGADmoQxAMgAEGgEGoQxAMgAEHAEmoQxAMgAEHgFGoQxAMgAEGAF2oQxAMgAEGgGWoQxAMgAEHAG2oQxAMgAEHgHWoQxAMgAEGAIGoQxAMgAEGgImoQxAMgAEHAJGoQxAMgAEHgJmoQxAMgAEGAKWoQxAMgAEGgK2oQxAMgAEHALWoQxAMgAEHgL2oQxAMgAEGAMmoQxAMgAEGgNGoQxAMgAEHANmoQxAMgAEHgOGoQxAMgAEGAO2oQxAMgAEGgPWoQxAMgAEHAP2oQxAMgAEHgwQBqEMQDIABBgMQAahDEAyAAQaDGAGoQxAMgAEHAyABqEMQDIABB4MoAahDEAyAAQYDNAGoQxAMgAEGgzwBqEMQDIABBwNEAahDEAyAAQeDTAGoQxAMgAEGA1gBqEMQDIABBoNgAahDEAyAAQcDaAGoQxAMgAEHg3ABqEMQDIABBgN8AahDEAyAAQaDhAGoQxAMgAEHA4wBqEMQDIABB4OUAahDEAyAAQYDoAGoQxAMgAEGg6gBqEMQDIABBwOwAahDEAyAAQeDuAGoQxAMgAEGA8QBqEMQDIABBoPMAahDEAyAAQcD1AGoQxAMgAEHg9wBqEMQDIABBgPoAahDEAyAAQaD8AGoQxAMgAEHA/gBqEMQDIABB4IABahDEAyAAQYCDAWoQxAMgAEGghQFqEMQDIABBwIcBahDEAyAAQeCJAWoQxAMgAEGAjAFqEMQDIABBoI4BahDEAyAAQcCQAWoiAUIANwPAASABQgA3A9gBIAFCADcD0AEgAUIANwPIASAAQbCSAWoiAUIANwPAASABQgA3A9gBIAFCADcD0AEgAUIANwPIASAAQaCUAWoiAUIANwPAASABQgA3A9gBIAFCADcD0AEgAUIANwPIASAAQZCWAWoiAUIANwPAASABQgA3A9gBIAFCADcD0AEgAUIANwPIASAAQYCYAWoiAUIANwPAASABQgA3A9gBIAFCADcD0AEgAUIANwPIASAAQfCZAWoiAUIANwPAASABQgA3A9gBIAFCADcD0AEgAUIANwPIASAAQeCbAWoiAUIANwPAASABQgA3A9gBIAFCADcD0AEgAUIANwPIASAAQdCdAWoiAUIANwPAASABQgA3A9gBIAFCADcD0AEgAUIANwPIASAAQcCfAWoiAUIANwPAASABQgA3A9gBIAFCADcD0AEgAUIANwPIASAAQbChAWoiAUIANwPAASABQgA3A9gBIAFCADcD0AEgAUIANwPIASAAQaCjAWoiAUIANwPAASABQgA3A9gBIAFCADcD0AEgAUIANwPIASAAQZClAWoiAUIANwPAASABQgA3A9gBIAFCADcD0AEgAUIANwPIASAAQYCnAWoiAUIANwPAASABQgA3A9gBIAFCADcD0AEgAUIANwPIASAAQfCoAWoiAUIANwPAASABQgA3A9gBIAFCADcD0AEgAUIANwPIASAAQeCqAWoiAUIANwPAASABQgA3A9gBIAFCADcD0AEgAUIANwPIASAAQdCsAWoiAUIANwPAASABQgA3A9gBIAFCADcD0AEgAUIANwPIASAAQcCuAWoiAUIANwPAASABQgA3A9gBIAFCADcD0AEgAUIANwPIASAAQbCwAWoiAUIANwPAASABQgA3A9gBIAFCADcD0AEgAUIANwPIASAAQaCyAWoiAUIANwPAASABQgA3A9gBIAFCADcD0AEgAUIANwPIASAAQZC0AWoiAUIANwPAASABQgA3A9gBIAFCADcD0AEgAUIANwPIASAAQYC2AWoiAUIANwPAASABQgA3A9gBIAFCADcD0AEgAUIANwPIASAAQfC3AWoiAUIANwPAASABQgA3A9gBIAFCADcD0AEgAUIANwPIASAAQeC5AWoiAUIANwPAASABQgA3A9gBIAFCADcD0AEgAUIANwPIASAAQdC7AWoiAUIANwPAASABQgA3A9gBIAFCADcD0AEgAUIANwPIASAAQcC9AWoiAUIANwPAASABQgA3A9gBIAFCADcD0AEgAUIANwPIASAAQbC/AWoiAUIANwPAASABQgA3A9gBIAFCADcD0AEgAUIANwPIASAAQaDBAWoiAUIANwPAASABQgA3A9gBIAFCADcD0AEgAUIANwPIASAAQZDDAWoiAUIANwPAASABQgA3A9gBIAFCADcD0AEgAUIANwPIASAAQYDFAWoiAUIANwPAASABQgA3A9gBIAFCADcD0AEgAUIANwPIASAAQfDGAWoiAUIANwPAASABQgA3A9gBIAFCADcD0AEgAUIANwPIASAAQeDIAWoiAUIANwPAASABQgA3A9gBIAFCADcD0AEgAUIANwPIASAAQdDKAWoiAUIANwPAASABQgA3A9gBIAFCADcD0AEgAUIANwPIASAAQejYAWoQxAMgAEHQ2AFqQgA3AwAgAEIANwPI2AEgAEIANwPA1gEgAEHI1gFqQgA3AwAgAEHAzAFqQQBBkAgQrQkaIABBuNwBakEAQdACEK0JIQNB5PwBKAIAIQEgAEEgNgKI3wEgAEIANwPY2AEgAEIANwPA2AEgAEKas+bMmbPm3D83A4jdASAAQpqz5syZs+bcPzcDiNsBIABBkN0BakKas+bMmbPm3D83AwAgAEGQ2wFqIgRCmrPmzJmz5tw/NwMAIABBmN0BakKas+bMmbPm3D83AwAgAEGY2wFqQpqz5syZs+bcPzcDACAAQaDdAWpCmrPmzJmz5tw/NwMAIABBoNsBakKas+bMmbPm3D83AwAgAEGo3QFqQpqz5syZs+bcPzcDACAAQajbAWpCmrPmzJmz5tw/NwMAIABBsN0BakKas+bMmbPm3D83AwAgAEGw2wFqQpqz5syZs+bcPzcDACAAQbjdAWpCmrPmzJmz5tw/NwMAIABBuNsBakKas+bMmbPm3D83AwAgAEHA3QFqQpqz5syZs+bcPzcDACAAQcDbAWpCmrPmzJmz5tw/NwMAIAAgAbJDAAB6RJU4AuDYASAAQcjdAWpCmrPmzJmz5tw/NwMAIABByNsBakKas+bMmbPm3D83AwAgAEHQ3QFqQpqz5syZs+bcPzcDACAAQdDbAWpCmrPmzJmz5tw/NwMAIABB2N0BakKas+bMmbPm3D83AwAgAEHY2wFqQpqz5syZs+bcPzcDACAAQeDdAWpCmrPmzJmz5tw/NwMAIABB4NsBakKas+bMmbPm3D83AwAgAEHo3QFqQpqz5syZs+bcPzcDACAAQejbAWpCmrPmzJmz5tw/NwMAIABB8N0BakKas+bMmbPm3D83AwAgAEHw2wFqQpqz5syZs+bcPzcDACAAQfjdAWpCmrPmzJmz5tw/NwMAIABB+NsBakKas+bMmbPm3D83AwAgAEGA3gFqQpqz5syZs+bcPzcDACAAQYDcAWpCmrPmzJmz5tw/NwMAIABBiN4BakKas+bMmbPm3D83AwAgAEGI3AFqQpqz5syZs+bcPzcDACAAQZDeAWpCmrPmzJmz5tw/NwMAIABBkNwBakKas+bMmbPm3D83AwAgAEGY3gFqQpqz5syZs+bcPzcDACAAQZjcAWpCmrPmzJmz5tw/NwMAIABBoN4BakKas+bMmbPm3D83AwAgAEGg3AFqQpqz5syZs+bcPzcDACAAQajeAWpCmrPmzJmz5tw/NwMAIABBqNwBakKas+bMmbPm3D83AwAgAEGw3gFqQpqz5syZs+bcPzcDACAAQbDcAWpCmrPmzJmz5tw/NwMAIABBuN4BakKas+bMmbPm3D83AwAgA0Kas+bMmbPm3D83AwAgAEHA3gFqQpqz5syZs+bcPzcDACAAQcDcAWpCmrPmzJmz5tw/NwMAIABByN4BakKas+bMmbPm3D83AwAgAEHI3AFqQpqz5syZs+bcPzcDACAAQdDeAWpCmrPmzJmz5tw/NwMAIABB0NwBakKas+bMmbPm3D83AwAgAEHY3gFqQpqz5syZs+bcPzcDACAAQdjcAWpCmrPmzJmz5tw/NwMAIABB4N4BakKas+bMmbPm3D83AwAgAEHg3AFqQpqz5syZs+bcPzcDACAAQejeAWpCmrPmzJmz5tw/NwMAIABB6NwBakKas+bMmbPm3D83AwAgAEHw3gFqQpqz5syZs+bcPzcDACAAQfDcAWpCmrPmzJmz5tw/NwMAIABB+N4BakKas+bMmbPm3D83AwAgAEH43AFqQpqz5syZs+bcPzcDACAAQYDfAWpCmrPmzJmz5tw/NwMAIABBgN0BakKas+bMmbPm3D83AwAgACABQQptNgKM3wEgBEKas+bMmbPm5D83AwAgAEKAgICAgICA8D83A4jbAQNAIAAgAkEDdGoiAUHA0AFqQoCAgICAgID4PzcDACABQcDOAWogAkEBaiICQQ1styIFOQMAIAFBwMwBaiAFOQMAIAFBwNIBakKAgICAgICA+D83AwAgAUHA1AFqQpqz5syZs+bkPzcDACABQcDWAWpCgICAgICAgPA/NwMAIAJBIEcNAAsgAEKAgICAgIDApMAANwPAzAEgAEHQzAFqQoCAgICAgLCxwAA3AwAgAEHIzAFqQoCAgICAgMCswAA3AwALnAIAIAAQxQMgAEHY0AFqQqa3koaC1pz0PzcDACAAQdDQAWpC9abioODKw/Q/NwMAIABByNABakKQsOWhi9md9T83AwAgAELD66Ph9dHw9D83A8DQASAAQdjMAWpCgICAgICA48jAADcDACAAQdDMAWpCgICAgICA5sfAADcDACAAQcjMAWpCgICAgICAisbAADcDACAAQoCAgICAgJTEwAA3A8DMASAAQdDSAWpC5syZs+bMmfM/NwMAIABByNIBakLmzJmz5syZ8z83AwAgAELmzJmz5syZ8z83A8DSASAAQdDOAWpCgICAgICAgJTAADcDACAAQcjOAWpCgICAgICAwKLAADcDACAAQoCAgICAgNCvwAA3A8DOASAAC5kIAgV/AXwgAEIANwPY2AEgAEHUyABqAn8gACsDwMwBIgeZRAAAAAAAAOBBYwRAIAeqDAELQYCAgIB4CyIDNgIAIABB2MgAaiIEIAAoAsBIIABB0MgAaiIFKAIAIgJBA3RqIgYrAwBEMzMzMzMz6z+iIAGgIgc5AwAgBiAHOQMAIAVBACACQQFqIAIgA0F/akYbNgIAIAAgBCsDACAAKwPY2AGgOQPY2AEgAEH0ygBqAn8gAEHIzAFqKwMAIgeZRAAAAAAAAOBBYwRAIAeqDAELQYCAgIB4CyIDNgIAIABB+MoAaiIEIABB4MoAaigCACAAQfDKAGoiBSgCACICQQN0aiIGKwMARDMzMzMzM+s/oiABoCIHOQMAIAYgBzkDACAFQQAgAkEBaiACIANBf2pGGzYCACAAIAQrAwAgACsD2NgBoDkD2NgBIABBlM0AagJ/IABB0MwBaisDACIHmUQAAAAAAADgQWMEQCAHqgwBC0GAgICAeAsiAzYCACAAQZjNAGoiBCAAQYDNAGooAgAgAEGQzQBqIgUoAgAiAkEDdGoiBisDAEQzMzMzMzPrP6IgAaAiBzkDACAGIAc5AwAgBUEAIAJBAWogAiADQX9qRhs2AgAgACAEKwMAIAArA9jYAaA5A9jYASAAQbTPAGoCfyAAQdjMAWorAwAiB5lEAAAAAAAA4EFjBEAgB6oMAQtBgICAgHgLIgM2AgAgAEG4zwBqIgQgAEGgzwBqKAIAIABBsM8AaiIFKAIAIgJBA3RqIgYrAwBEMzMzMzMz6z+iIAGgIgE5AwAgBiABOQMAIAVBACACQQFqIAIgA0F/akYbNgIAIAAgBCsDACAAKwPY2AGgIgE5A9jYASAAAn8gACsDwM4BIgeZRAAAAAAAAOBBYwRAIAeqDAELQYCAgIB4CyIDNgJUIAAgACgCQCAAKAJQIgJBA3RqIgQrAwAiByAHIAArA2giB6IgAaAiASAHoqE5A1ggBCABOQMAIABBACACQQFqIAIgA0F/akYbNgJQIAACfyAAQcjOAWorAwAiAZlEAAAAAAAA4EFjBEAgAaoMAQtBgICAgHgLIgM2AvQCIAAgACgC4AIgACgC8AIiAkEDdGoiBCsDACIBIAEgACsDiAMiAaIgACsDWKAiByABoqE5A/gCIAQgBzkDACAAQQAgAkEBaiACIANBf2pGGzYC8AIgAAJ/IABB0M4BaisDACIBmUQAAAAAAADgQWMEQCABqgwBC0GAgICAeAsiAzYClAUgACAAKAKABSAAKAKQBSICQQN0aiIEKwMAIgEgASAAKwOoBSIBoiAAKwP4AqAiByABoqE5A5gFIAQgBzkDACAAQQAgAkEBaiACIANBf2pGGzYCkAUgACAAKwOYBSIBOQPA2AEgAQvoBgEBfyMAQYABayIBJAAgABDFAyAAQfjMAWpCgICAgICA3MjAADcDACAAQfDMAWpCgICAgICApMnAADcDACAAQejMAWpCgICAgICAzMrAADcDACAAQeDMAWpCgICAgICA/cnAADcDACAAQdjMAWpCgICAgICAjsvAADcDACAAQdDMAWpCgICAgICA08vAADcDACAAQcjMAWpCgICAgICA0czAADcDACAAQoCAgICAgJXMwAA3A8DMASABQuH10fD6qLj1PzcDSCABQuH10fD6qLj1PzcDQCABQuH10fD6qLj1PzcDUCABQuH10fD6qLj1PzcDWCABQuH10fD6qLj1PzcDYCABQuH10fD6qLj1PzcDaCABQuH10fD6qLj1PzcDcCABQuH10fD6qLj1PzcDeCABQpqz5syZs+bkPzcDOCABQpqz5syZs+bkPzcDMCABQpqz5syZs+bkPzcDKCABQpqz5syZs+bkPzcDICABQpqz5syZs+bkPzcDGCABQpqz5syZs+bkPzcDECABQpqz5syZs+bkPzcDCCABQpqz5syZs+bkPzcDACAAQfjQAWpC4fXR8PqouPU/NwMAIABB8NABakLh9dHw+qi49T83AwAgAEHo0AFqQuH10fD6qLj1PzcDACAAQeDQAWpC4fXR8PqouPU/NwMAIABB2NABakLh9dHw+qi49T83AwAgAEHQ0AFqQuH10fD6qLj1PzcDACAAQcjQ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AQwBCyADRQ0AIAIgA60iBIYgAUHAACADa62IhCECIAEgBIYhAQsgACABNwMAIAAgAjcDCAvZAwICfwJ+IwBBIGsiAiQAAkAgAUL///////////8AgyIFQoCAgICAgMD/Q3wgBUKAgICAgIDAgLx/fFQEQCABQgSGIABCPIiEIQQgAEL//////////w+DIgBCgYCAgICAgIAIWgRAIARCgYCAgICAgIDAAHwhBAwCCyAEQoCAgICAgICAQH0hBCAAQoCAgICAgICACIVCAFINASAEQgGDIAR8IQQMAQsgAFAgBUKAgICAgIDA//8AVCAFQoCAgICAgMD//wBRG0UEQCABQgSGIABCPIiEQv////////8Dg0KAgICAgICA/P8AhCEEDAELQoCAgICAgID4/wAhBCAFQv///////7//wwBWDQBCACEEIAVCMIinIgNBkfcASQ0AIAIgACABQv///////z+DQoCAgICAgMAAhCIEQYH4ACADaxCoBCACQRBqIAAgBCADQf+If2oQqQQgAikDCEIEhiACKQMAIgBCPIiEIQQgAikDECACKQMYhEIAUq0gAEL//////////w+DhCIAQoGAgICAgICACFoEQCAEQgF8IQQMAQsgAEKAgICAgICAgAiFQgBSDQAgBEIBgyAEfCEECyACQSBqJAAgBCABQoCAgICAgICAgH+DhL8LkgEBA3xEAAAAAAAA8D8gACAAoiICRAAAAAAAAOA/oiIDoSIERAAAAAAAAPA/IAShIAOhIAIgAiACIAJEkBXLGaAB+j6iRHdRwRZswVa/oKJETFVVVVVVpT+goiACIAKiIgMgA6IgAiACRNQ4iL7p+qi9okTEsbS9nu4hPqCiRK1SnIBPfpK+oKKgoiAAIAGioaCgC/sRAw9/AX4DfCMAQbAEayIGJAAgAiACQX1qQRhtIgVBACAFQQBKGyIOQWhsaiEMIARBAnRBkO8AaigCACILIANBf2oiCGpBAE4EQCADIAtqIQUgDiAIayECA0AgBkHAAmogB0EDdGogAkEASAR8RAAAAAAAAAAABSACQQJ0QaDvAGooAgC3CzkDACACQQFqIQIgB0EBaiIHIAVHDQALCyAMQWhqIQlBACEFIANBAUghBwNAAkAgBwRARAAAAAAAAAAAIRUMAQsgBSAIaiEKQQAhAkQAAAAAAAAAACEVA0Ag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QCABAn8gACgCBCICIAAoAmhJBEAgACACQQFqNgIEIAItAAAMAQsgABCoBQtBkZEBai0AAEsNAAtB0JICQcQANgIAIAZBACADQgGDUBshBiADIQkLIAAoAmgEQCAAIAAoAgRBf2o2AgQLAkAgCSADVA0AAkAgA6dBAXENACAGDQBB0JICQcQANgIAIANCf3whAwwDCyAJIANYDQBB0JICQcQANgIADAILIAkgBqwiA4UgA30hAwwBC0IAIQMgAEIAEKcFCyAHQRBqJAAgAwvlAgEGfyMAQRBrIgckACADQcSrAiADGyIFKAIAIQMCQAJAAkAgAUUEQCADDQEMAwtBfiEEIAJFDQIgACAHQQxqIAAbIQYCQCADBEAgAiEADAELIAEtAAAiAEEYdEEYdSIDQQBOBEAgBiAANgIAIANBAEchBAwECyABLAAAIQBByIcCKAIAKAIARQRAIAYgAEH/vwNxNgIAQQEhBAwECyAAQf8BcUG+fmoiAEEySw0BIABBAnRBoJMBaigCACEDIAJBf2oiAEUNAiABQQFqIQELIAEtAAAiCEEDdiIJQXBqIANBGnUgCWpyQQdLDQADQCAAQX9qIQAgCEGAf2ogA0EGdHIiA0EATgRAIAVBADYCACAGIAM2AgAgAiAAayEEDAQLIABFDQIgAUEBaiIBLQAAIghBwAFxQYABRg0ACwsgBUEANgIAQdCSAkEZNgIAQX8hBAwBCyAFIAM2AgALIAdBEGokACAEC8sBAgR/An4jAEEQayIDJAAgAbwiBEGAgICAeHEhBQJ+IARB/////wdxIgJBgICAfGpB////9wdNBEAgAq1CGYZCgICAgICAgMA/fAwBCyACQYCAgPwHTwRAIAStQhmGQoCAgICAgMD//wCEDAELIAJFBEBCAAwBCyADIAKtQgAgAmciAkHRAGoQqQQgAykDACEGIAMpAwhCgICAgICAwACFQYn/ACACa61CMIaECyEHIAAgBjcDACAAIAcgBa1CIIaENwMIIANBEGokAAueCwIFfw9+IwBB4ABrIgUkACAEQi+GIANCEYiEIQ8gAkIghiABQiCIhCENIARC////////P4MiDkIPhiADQjGIhCEQIAIgBIVCgICAgICAgICAf4MhCiAOQhGIIREgAkL///////8/gyILQiCIIRIgBEIwiKdB//8BcSEHAkACfyACQjCIp0H//wFxIglBf2pB/f8BTQRAQQAgB0F/akH+/wFJDQEaCyABUCACQv///////////wCDIgxCgICAgICAwP//AFQgDEKAgICAgIDA//8AURtFBEAgAkKAgICAgIAghCEKDAILIANQIARC////////////AIMiAkKAgICAgIDA//8AVCACQoCAgICAgMD//wBRG0UEQCAEQoCAgICAgCCEIQogAyEBDAILIAEgDEKAgICAgIDA//8AhYRQBEAgAiADhFAEQEKAgICAgIDg//8AIQpCACEBDAMLIApCgICAgICAwP//AIQhCkIAIQEMAgsgAyACQoCAgICAgMD//wCFhFAEQCABIAyEIQJCACEBIAJQBEBCgICAgICA4P//ACEKDAMLIApCgICAgICAwP//AIQhCgwCCyABIAyEUARAQgAhAQwCCyACIAOEUARAQgAhAQwCCyAMQv///////z9YBEAgBUHQAGogASALIAEgCyALUCIGG3kgBkEGdK18pyIGQXFqEKkEIAUpA1giC0IghiAFKQNQIgFCIIiEIQ0gC0IgiCESQRAgBmshBgsgBiACQv///////z9WDQAaIAVBQGsgAyAOIAMgDiAOUCIIG3kgCEEGdK18pyIIQXFqEKkEIAUpA0giAkIPhiAFKQNAIgNCMYiEIRAgAkIvhiADQhGIhCEPIAJCEYghESAGIAhrQRBqCyEGIA9C/////w+DIgIgAUL/////D4MiAX4iDyADQg+GQoCA/v8PgyIDIA1C/////w+DIgx+fCIEQiCGIg4gASADfnwiDSAOVK0gAiAMfiIVIAMgC0L/////D4MiC358IhMgEEL/////D4MiDiABfnwiECAEIA9UrUIghiAEQiCIhHwiFCACIAt+IhYgAyASQoCABIQiD358IgMgDCAOfnwiEiABIBFC/////weDQoCAgIAIhCIBfnwiEUIghnwiF3whBCAHIAlqIAZqQYGAf2ohBgJAIAsgDn4iGCACIA9+fCICIBhUrSACIAEgDH58IgwgAlStfCAMIBMgFVStIBAgE1StfHwiAiAMVK18IAEgD358IAEgC34iCyAOIA9+fCIBIAtUrUIghiABQiCIhHwgAiABQiCGfCIBIAJUrXwgASARIBJUrSADIBZUrSASIANUrXx8QiCGIBFCIIiEfCIDIAFUrXwgAyAUIBBUrSAXIBRUrXx8IgIgA1StfCIBQoCAgICAgMAAg1BFBEAgBkEBaiEGDAELIA1CP4ghAyABQgGGIAJCP4iEIQEgAkIBhiAEQj+IhCECIA1CAYYhDSADIARCAYaEIQQLIAZB//8BTgRAIApCgICAgICAwP//AIQhCkIAIQEMAQsCfiAGQQBMBEBBASAGayIHQf8ATQRAIAVBEGogDSAEIAcQqAQgBUEgaiACIAEgBkH/AGoiBhCpBCAFQTBqIA0gBCAGEKkEIAUgAiABIAcQqAQgBSkDMCAFKQM4hEIAUq0gBSkDICAFKQMQhIQhDSAFKQMoIAUpAxiEIQQgBSkDACECIAUpAwgMAgtCACEBDAILIAFC////////P4MgBq1CMIaECyAKhCEKIA1QIARCf1UgBEKAgICAgICAgIB/URtFBEAgCiACQgF8IgEgAlStfCEKDAELIA0gBEKAgICAgICAgIB/hYRQRQRAIAIhAQwBCyAKIAIgAkIBg3wiASACVK18IQoLIAAgATcDACAAIAo3AwggBUHgAGokAAt/AgJ/AX4jAEEQayIDJAAgAAJ+IAFFBEBCAAwBCyADIAEgAUEfdSICaiACcyICrUIAIAJnIgJB0QBqEKkEIAMpAwhCgICAgICAwACFQZ6AASACa61CMIZ8IAFBgICAgHhxrUIghoQhBCADKQMACzcDACAAIAQ3AwggA0EQaiQAC8gJAgR/BH4jAEHwAGsiBSQAIARC////////////AIMhCgJAAkAgAUJ/fCILQn9RIAJC////////////AIMiCSALIAFUrXxCf3wiC0L///////+///8AViALQv///////7///wBRG0UEQCADQn98IgtCf1IgCiALIANUrXxCf3wiC0L///////+///8AVCALQv///////7///wBRGw0BCyABUCAJQoCAgICAgMD//wBUIAlCgICAgICAwP//AFEbRQRAIAJCgICAgICAIIQhBCABIQMMAgsgA1AgCkKAgICAgIDA//8AVCAKQoCAgICAgMD//wBRG0UEQCAEQoCAgICAgCCEIQQMAgsgASAJQoCAgICAgMD//wCFhFAEQEKAgICAgIDg//8AIAIgASADhSACIASFQoCAgICAgICAgH+FhFAiBhshBEIAIAEgBhshAwwCCyADIApCgICAgICAwP//AIWEUA0BIAEgCYRQBEAgAyAKhEIAUg0CIAEgA4MhAyACIASDIQQMAgsgAyAKhFBFDQAgASEDIAIhBAwBCyADIAEgAyABViAKIAlWIAkgClEbIgcbIQogBCACIAcbIgtC////////P4MhCSACIAQgBxsiAkIwiKdB//8BcSEIIAtCMIinQf//AXEiBkUEQCAFQeAAaiAKIAkgCiAJIAlQIgYbeSAGQQZ0rXynIgZBcWoQqQQgBSkDaCEJIAUpA2AhCkEQIAZrIQYLIAEgAyAHGyEDIAJC////////P4MhASAIBH4gAQUgBUHQAGogAyABIAMgASABUCIHG3kgB0EGdK18pyIHQXFqEKkEQRAgB2shCCAFKQNQIQMgBSkDWAtCA4YgA0I9iIRCgICAgICAgASEIQQgCUIDhiAKQj2IhCEBIAIgC4UhDAJ+IANCA4YiAyAGIAhrIgdFDQAaIAdB/wBLBEBCACEEQgEMAQsgBUFAayADIARBgAEgB2sQqQQgBUEwaiADIAQgBxCoBCAFKQM4IQQgBSkDMCAFKQNAIAUpA0iEQgBSrYQLIQMgAUKAgICAgICABIQhCSAKQgOGIQICQCAMQn9XBEAgAiADfSIBIAkgBH0gAiADVK19IgOEUARAQgAhA0IAIQQMAwsgA0L/////////A1YNASAFQSBqIAEgAyABIAMgA1AiBxt5IAdBBnStfKdBdGoiBxCpBCAGIAdrIQYgBSkDKCEDIAUpAyAhAQwBCyACIAN8IgEgA1StIAQgCXx8IgNCgICAgICAgAiDUA0AIAFCAYMgA0I/hiABQgGIhIQhASAGQQFqIQYgA0IBiCEDCyALQoCAgICAgICAgH+DIQIgBkH//wFOBEAgAkKAgICAgIDA//8AhCEEQgAhAwwBC0EAIQcCQCAGQQBKBEAgBiEHDAELIAVBEGogASADIAZB/wBqEKkEIAUgASADQQEgBmsQqAQgBSkDACAFKQMQIAUpAxiEQgBSrYQhASAFKQMIIQMLIANCPYYgAUIDiIQiBCABp0EHcSIGQQRLrXwiASAEVK0gA0IDiEL///////8/gyAChCAHrUIwhoR8IAEgAUIBg0IAIAZBBEYbIgF8IgMgAVStfCEECyAAIAM3AwAgACAENwMIIAVB8ABqJAALgQICAn8EfiMAQRBrIgIkACABvSIFQoCAgICAgICAgH+DIQcCfiAFQv///////////wCDIgRCgICAgICAgHh8Qv/////////v/wBYBEAgBEI8hiEGIARCBIhCgICAgICAgIA8fAwBCyAEQoCAgICAgID4/wBaBEAgBUI8hiEGIAVCBIhCgICAgICAwP//AIQMAQsgBFAEQEIADAELIAIgBEIAIARCgICAgBBaBH8gBEIgiKdnBSAFp2dBIGoLIgNBMWoQqQQgAikDACEGIAIpAwhCgICAgICAwACFQYz4ACADa61CMIaECyEEIAAgBjcDACAAIAQgB4Q3AwggAkEQaiQAC9sBAgF/An5BASEEAkAgAEIAUiABQv///////////wCDIgVCgICAgICAwP//AFYgBUKAgICAgIDA//8AURsNACACQgBSIANC////////////AIMiBkKAgICAgIDA//8AViAGQoCAgICAgMD//wBRGw0AIAAgAoQgBSAGhIRQBEBBAA8LIAEgA4NCAFkEQEF/IQQgACACVCABIANTIAEgA1EbDQEgACAChSABIAOFhEIAUg8LQX8hBCAAIAJWIAEgA1UgASADURsNACAAIAKFIAEgA4WEQgBSIQQLIAQL2AECAX8BfkF/IQICQCAAQgBSIAFC////////////AIMiA0KAgICAgIDA//8AViADQoCAgICAgMD//wBRGw0AIAAgA0KAgICAgICA/z+EhFAEQEEADwsgAUKAgICAgICA/z+DQgBZBEAgAEIAVCABQoCAgICAgID/P1MgAUKAgICAgICA/z9RGw0BIAAgAUKAgICAgICA/z+FhEIAUg8LIABCAFYgAUKAgICAgICA/z9VIAFCgICAgICAgP8/URsNACAAIAFCgICAgICAgP8/hYRCAFIhAgsgAgs1ACAAIAE3AwAgACACQv///////z+DIARCMIinQYCAAnEgAkIwiKdB//8BcXKtQjCGhDcDCAtnAgF/AX4jAEEQayICJAAgAAJ+IAFFBEBCAAwBCyACIAGtQgBB8AAgAWdBH3MiAWsQqQQgAikDCEKAgICAgIDAAIUgAUH//wBqrUIwhnwhAyACKQMACzcDACAAIAM3AwggAkEQaiQAC0UBAX8jAEEQayIFJAAgBSABIAIgAyAEQoCAgICAgICAgH+FEK8FIAUpAwAhASAAIAUpAwg3AwggACABNwMAIAVBEGokAAvEAgEBfyMAQdAAayIEJAACQCADQYCAAU4EQCAEQSBqIAEgAkIAQoCAgICAgID//wAQrQUgBCkDKCECIAQpAyAhASADQf//AUgEQCADQYGAf2ohAwwCCyAEQRBqIAEgAkIAQoCAgICAgID//wAQrQUgA0H9/wIgA0H9/wJIG0GCgH5qIQMgBCkDGCECIAQpAxAhAQwBCyADQYGAf0oNACAEQUBrIAEgAkIAQoCAgICAgMAAEK0FIAQpA0ghAiAEKQNAIQEgA0GDgH5KBEAgA0H+/wBqIQMMAQsgBEEwaiABIAJCAEKAgICAgIDAABCtBSADQYaAfSADQYaAfUobQfz/AWohAyAEKQM4IQIgBCkDMCEBCyAEIAEgAkIAIANB//8Aaq1CMIYQrQUgACAEKQMINwMIIAAgBCkDADcDACAEQdAAaiQAC44RAgV/DH4jAEHAAWsiBSQAIARC////////P4MhEiACQv///////z+DIQwgAiAEhUKAgICAgICAgIB/gyERIARCMIinQf//AXEhBwJAAkACQCACQjCIp0H//wFxIglBf2pB/f8BTQRAIAdBf2pB/v8BSQ0BCyABUCACQv///////////wCDIgpCgICAgICAwP//AFQgCkKAgICAgIDA//8AURtFBEAgAkKAgICAgIAghCERDAILIANQIARC////////////AIMiAkKAgICAgIDA//8AVCACQoCAgICAgMD//wBRG0UEQCAEQoCAgICAgCCEIREgAyEBDAILIAEgCkKAgICAgIDA//8AhYRQBEAgAyACQoCAgICAgMD//wCFhFAEQEIAIQFCgICAgICA4P//ACERDAMLIBFCgICAgICAwP//AIQhEUIAIQEMAgsgAyACQoCAgICAgMD//wCFhFAEQEIAIQEMAgsgASAKhFANAiACIAOEUARAIBFCgICAgICAwP//AIQhEUIAIQEMAgsgCkL///////8/WARAIAVBsAFqIAEgDCABIAwgDFAiBht5IAZBBnStfKciBkFxahCpBEEQIAZrIQYgBSkDuAEhDCAFKQOwASEBCyACQv///////z9WDQAgBUGgAWogAyASIAMgEiASUCIIG3kgCEEGdK18pyIIQXFqEKkEIAYgCGpBcGohBiAFKQOoASESIAUpA6ABIQMLIAVBkAFqIBJCgICAgICAwACEIhRCD4YgA0IxiIQiAkKEyfnOv+a8gvUAIAJ9IgQQqQUgBUGAAWpCACAFKQOYAX0gBBCpBSAFQfAAaiAFKQOIAUIBhiAFKQOAAUI/iIQiBCACEKkFIAVB4ABqIARCACAFKQN4fRCpBSAFQdAAaiAFKQNoQgGGIAUpA2BCP4iEIgQgAhCpBSAFQUBrIARCACAFKQNYfRCpBSAFQTBqIAUpA0hCAYYgBSkDQEI/iIQiBCACEKkFIAVBIGogBEIAIAUpAzh9EKkFIAVBEGogBSkDKEIBhiAFKQMgQj+IhCIEIAIQqQUgBSAEQgAgBSkDGH0QqQUgBiAJIAdraiEGAn5CACAFKQMIQgGGIAUpAwBCP4iEQn98IgpC/////w+DIgQgAkIgiCIOfiIQIApCIIgiCiACQv////8PgyILfnwiAkIghiINIAQgC358IgsgDVStIAogDn4gAiAQVK1CIIYgAkIgiIR8fCALIAQgA0IRiEL/////D4MiDn4iECAKIANCD4ZCgID+/w+DIg1+fCICQiCGIg8gBCANfnwgD1StIAogDn4gAiAQVK1CIIYgAkIgiIR8fHwiAiALVK18IAJCAFKtfH0iC0L/////D4MiDiAEfiIQIAogDn4iDSAEIAtCIIgiD358IgtCIIZ8Ig4gEFStIAogD34gCyANVK1CIIYgC0IgiIR8fCAOQgAgAn0iAkIgiCILIAR+IhAgAkL/////D4MiDSAKfnwiAkIghiIPIAQgDX58IA9UrSAKIAt+IAIgEFStQiCGIAJCIIiEfHx8IgIgDlStfCACQn58IhAgAlStfEJ/fCILQv////8PgyICIAxCAoYgAUI+iIRC/////w+DIgR+Ig4gAUIeiEL/////D4MiCiALQiCIIgt+fCINIA5UrSANIBBCIIgiDiAMQh6IQv//7/8Pg0KAgBCEIgx+fCIPIA1UrXwgCyAMfnwgAiAMfiITIAQgC358Ig0gE1StQiCGIA1CIIiEfCAPIA1CIIZ8Ig0gD1StfCANIAogDn4iEyAQQv////8PgyIQIAR+fCIPIBNUrSAPIAIgAUIChkL8////D4MiE358IhUgD1StfHwiDyANVK18IA8gCyATfiILIAwgEH58IgwgBCAOfnwiBCACIAp+fCICQiCIIAIgBFStIAwgC1StIAQgDFStfHxCIIaEfCIMIA9UrXwgDCAVIA4gE34iBCAKIBB+fCIKQiCIIAogBFStQiCGhHwiBCAVVK0gBCACQiCGfCAEVK18fCIEIAxUrXwiAkL/////////AFgEQCABQjGGIARC/////w+DIgEgA0L/////D4MiCn4iDEIAUq19QgAgDH0iECAEQiCIIgwgCn4iDSABIANCIIgiC358Ig5CIIYiD1StfSACQv////8PgyAKfiABIBJC/////w+DfnwgCyAMfnwgDiANVK1CIIYgDkIgiIR8IAQgFEIgiH4gAyACQiCIfnwgAiALfnwgDCASfnxCIIZ8fSESIAZBf2ohBiAQIA99DAELIARCIYghCyABQjCGIAJCP4YgBEIBiIQiBEL/////D4MiASADQv////8PgyIKfiIMQgBSrX1CACAMfSIOIAEgA0IgiCIMfiIQIAsgAkIfhoQiDUL/////D4MiDyAKfnwiC0IghiITVK19IAwgD34gCiACQgGIIgpC/////w+DfnwgASASQv////8Pg358IAsgEFStQiCGIAtCIIiEfCAEIBRCIIh+IAMgAkIhiH58IAogDH58IA0gEn58QiCGfH0hEiAKIQIgDiATfQshASAGQYCAAU4EQCARQoCAgICAgMD//wCEIRFCACEBDAELIAZB//8AaiEHIAZBgYB/TARAAkAgBw0AIAQgAUIBhiADViASQgGGIAFCP4iEIgEgFFYgASAUURutfCIBIARUrSACQv///////z+DfCICQoCAgICAgMAAg1ANACACIBGEIREMAgtCACEBDAELIAQgAUIBhiADWiASQgGGIAFCP4iEIgEgFFogASAUURutfCIBIARUrSACQv///////z+DIAetQjCGhHwgEYQhEQsgACABNwMAIAAgETcDCCAFQcABaiQADwsgAEIANwMAIAAgEUKAgICAgIDg//8AIAIgA4RCAFIbNwMIIAVBwAFqJAALpQgCBX8CfiMAQTBrIgUkAAJAIAJBAk0EQCACQQJ0IgJBvJUBaigCACEHIAJBsJUBaigCACEIA0ACfyABKAIEIgIgASgCaEkEQCABIAJBAWo2AgQgAi0AAAwBCyABEKgFCyICIgRBIEYgBEF3akEFSXINAAsCQCACQVVqIgRBAksEQEEBIQYMAQtBASEGIARBAWtFDQBBf0EBIAJBLUYbIQYgASgCBCICIAEoAmhJBEAgASACQQFqNgIEIAItAAAh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ASECIAMtAAFBLkYNAgtBACECDAELQdSrAigCACICBEADQCADIAJBCGoQwwVFDQIgAigCGCICDQALC0HMqwIQEUHUqwIoAgAiAgRAA0AgAyACQQhqEMMFRQRAQcyrAhASDAMLIAIoAhgiAg0ACwtBACEBAkACQAJAQdySAigCAA0AQZuXARDGBSICRQ0AIAItAABFDQAgBEEBaiEIQf4BIARrIQkDQCACQToQlwQiByACayAHLQAAIgpBAEdrIgYgCUkEfyAFQRBqIAIgBhCsCRogBUEQaiAGaiICQS86AAAgAkEBaiADIAQQrAkaIAVBEGogBiAIampBADoAACAFQRBqIAVBDGoQGyIGBEBBHBCgCSICDQQgBiAFKAIMEMcFDAMLIActAAAFIAoLQQBHIAdqIgItAAANAAsLQRwQoAkiAkUNASACQeSVASkCADcCACACQQhqIgEgAyAEEKwJGiABIARqQQA6AAAgAkHUqwIoAgA2AhhB1KsCIAI2AgAgAiEBDAELIAIgBjYCACACIAUoAgw2AgQgAkEIaiIBIAMgBBCsCRogASAEakEAOgAAIAJB1KsCKAIANgIYQdSrAiACNgIAIAIhAQtBzKsCEBIgAUHklQEgACABchshAgsgBUGQAmokACACC4gBAQR/IwBBIGsiASQAAn8DQCABQQhqIABBAnRqIABB5bcBQaiXAUEBIAB0Qf////8HcRsQyAUiAzYCACACIANBAEdqIQIgAEEBaiIAQQZHDQALAkAgAkEBSw0AQYCWASACQQFrDQEaIAEoAghB5JUBRw0AQZiWAQwBC0EACyEAIAFBIGokACAAC2MBAn8jAEEQayIDJAAgAyACNgIMIAMgAjYCCEF/IQQCQEEAQQAgASACEJsEIgJBAEgNACAAIAJBAWoiAhCgCSIANgIAIABFDQAgACACIAEgAygCDBCbBCEECyADQRBqJAAgBAsqAQF/IwBBEGsiAiQAIAIgATYCDCAAQdC3ASABEMEFIQAgAkEQaiQAIAALLQEBfyMAQRBrIgIkACACIAE2AgwgAEHkAEHftwEgARCbBCEAIAJBEGokACAACx8AIABBAEcgAEGAlgFHcSAAQZiWAUdxBEAgABChCQsLIwECfyAAIQEDQCABIgJBBGohASACKAIADQALIAIgAGtBAnULtwMBBX8jAEEQayIHJAAC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DQBBAiEBIAAQ7QQgBEEIahDuBEUNAQsgAiACKAIAIAFyNgIACyAEQRBqJAALPgAgASACIAMgBEECEO4GIQEgAygCACECAkAgAUF/akEeSw0AIAJBBHENACAAIAE2AgAPCyADIAJBBHI2AgALOwAgASACIAMgBEECEO4GIQEgAygCACECAkAgAUEXSg0AIAJBBHENACAAIAE2AgAPCyADIAJBBHI2AgALPgAgASACIAMgBEECEO4GIQEgAygCACECAkAgAUF/akELSw0AIAJBBHENACAAIAE2AgAPCyADIAJBBHI2AgALPAAgASACIAMgBEEDEO4GIQEgAygCACECAkAgAUHtAkoNACACQQRxDQAgACABNgIADwsgAyACQQRyNgIACz4AIAEgAiADIARBAhDuBiEBIAMoAgAhAgJAIAFBDEoNACACQQRxDQAgACABQX9qNgIADwsgAyACQQRyNgIACzsAIAEgAiADIARBAhDuBiEBIAMoAgAhAgJAIAFBO0oNACACQQRxDQAgACABNgIADwsgAyACQQRyNgIAC5ABAQJ/IwBBEGsiBCQAIAQgATYCCANAAkAgACAEQQhqEOwERQ0AIANBgMAAAn8gACgCACIBKAIMIgUgASgCEEYEQCABIAEoAgAoAiQRAAAMAQsgBSgCAAsgAygCACgCDBEEAEUNACAAEO0EGgwBCwsgACAEQQhqEO4EBEAgAiACKAIAQQJyNgIACyAEQRBqJAALrgEBAX8CfyAAQQhqIAAoAggoAggRAAAiACIGLAALQQBIBEAgBigCBAwBCyAGLQALC0EAAn8gACwAF0EASARAIAAoAhAMAQsgAC0AFwtrRgRAIAQgBCgCAEEEcjYCAA8LIAIgAyAAIABBGGogBSAEQQAQkAYgAGshAAJAIAEoAgAiAkEMRw0AIAANACABQQA2AgAPCwJAIAJBC0oNACAAQQxHDQAgASACQQxqNgIACws7ACABIAIgAyAEQQIQ7gYhASADKAIAIQICQCABQTxKDQAgAkEEcQ0AIAAgATYCAA8LIAMgAkEEcjYCAAs7ACABIAIgAyAEQQEQ7gYhASADKAIAIQICQCABQQZKDQAgAkEEcQ0AIAAgATYCAA8LIAMgAkEEcjYCAAsoACABIAIgAyAEQQQQ7gYhASADLQAAQQRxRQRAIAAgAUGUcWo2AgALC0oA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hAEgC0EYahDwBSALKAIYBEAgBSAFKAIAQQRyNgIADAELQQEhAAsgEBDVCBogDRDVCBogDBDVCBogDhDVCBogERDVCBogDygCACEBIA9BADYCACABBEAgASAPKAIEEQEACyALQbAEaiQAIAAPCyAKIQQLIAFBAWohAQwAAAsAC6UDAQF/IwBBEGsiCiQAIAkCfyAABEAgCiABEJQHIgAiASABKAIAKAIsEQIAIAIgCigCADYAACAKIAAgACgCACgCIBECACAIIAoQlQcgChDVCBogCiAAIAAoAgAoAhwRAgAgByAKEJUHIAoQ1QgaIAMgACAAKAIAKAIMEQAAOgAAIAQgACAAKAIAKAIQEQAAOgAAIAogACAAKAIAKAIUEQIAIAUgChCVByAKENUIGiAKIAAgACgCACgCGBECACAGIAoQlQcgChDVCBogACAAKAIAKAIkEQAADAELIAogARCWByIAIgEgASgCACgCLBECACACIAooAgA2AAAgCiAAIAAoAgAoAiARAgAgCCAKEJUHIAoQ1QgaIAogACAAKAIAKAIcEQIAIAcgChCVByAKENUIGiADIAAgACgCACgCDBEAADoAACAEIAAgACgCACgCEBEAADoAACAKIAAgACgCACgCFBECACAFIAoQlQcgChDVCBogCiAAIAAoAgAoAhgRAgAgBiAKEJUHIAoQ1QgaIAAgACgCACgCJBEAAAs2AgAgCkEQaiQACyUBAX8gASgCABDmBEEYdEEYdSECIAAgASgCADYCBCAAIAI6AAAL5wEBBn8jAEEQayIFJAAgACgCBCEDAn8gAigCACAAKAIAayIEQf////8HSQRAIARBAXQMAQtBfwsiBEEBIAQbIQQgASgCACEGIAAoAgAhByADQekERgR/QQAFIAAoAgALIAQQogkiCARAIANB6QRHBEAgACgCABogAEEANgIACyAGIAdrIQcgBUHoBDYCBCAAIAVBCGogCCAFQQRqEOcFIgMQmQcgAygCACEGIANBADYCACAGBEAgBiADKAIEEQEACyABIAcgACgCAGo2AgAgAiAEIAAoAgBqNgIAIAVBEGokAA8LEIMHAAvwAQEGfyMAQRBrIgUkACAAKAIEIQMCfyACKAIAIAAoAgBrIgRB/////wdJBEAgBEEBdAwBC0F/CyIEQQQgBBshBCABKAIAIQYgACgCACEHIANB6QRGBH9BAAUgACgCAAsgBBCiCSIIBEAgA0HpBEcEQCAAKAIAGiAAQQA2AgALIAYgB2tBAnUhByAFQegENgIEIAAgBUEIaiAIIAVBBGoQ5wUiAxCZByADKAIAIQYgA0EANgIAIAYEQCAGIAMoAgQRAQALIAEgACgCACAHQQJ0ajYCACACIAAoAgAgBEF8cWo2AgAgBUEQaiQADwsQgwcAC4QDAQF/IwBBoAFrIgAkACAAIAE2ApgBIAAgAjYCkAEgAEHpBDYCFCAAQRhqIABBIGogAEEUahDnBSEBIAAgBCgCHCIHNgIQIAcgBygCBEEBajYCBCAAQRBqEN4EIQcgAEEAOgAPIABBmAFqIAIgAyAAQRBqIAQoAgQgBSAAQQ9qIAcgASAAQRRqIABBhAFqEIwHBEAgBhCSByAALQAPBEAgBiAHQS0gBygCACgCHBEDABDeCAsgB0EwIAcoAgAoAhwRAwAhAiABKAIAIQQgACgCFCIDQX9qIQcgAkH/AXEhAgNAAkAgBCAHTw0AIAQtAAAgAkcNACAEQQFqIQQMAQsLIAYgBCADEJMHCyAAQZgBaiAAQZABahDiBARAIAUgBSgCAEECcjYCAAsgACgCmAEhAwJ/IAAoAhAiAiACKAIEQX9qIgQ2AgQgBEF/RgsEQCACIAIoAgAoAggRAQALIAEoAgAhAiABQQA2AgAgAgRAIAIgASgCBBEBAAsgAEGgAWokACADC1sBAn8jAEEQayIBJAACQCAALAALQQBIBEAgACgCACECIAFBADoADyACIAEtAA86AAAgAEEANgIEDAELIAFBADoADiAAIAEtAA46AAAgAEEAOgALCyABQRBqJAALrAMBBX8jAEEgayIFJAACfyAALAALQQBIBEAgACgCBAwBCyAALQALCyEDIAAsAAtBAEgEfyAAKAIIQf////8HcUF/agVBCgshBAJAIAIgAWsiBkUNAAJ/An8gACwAC0EASARAIAAoAgAMAQsgAAshByABAn8gACwAC0EASARAIAAoAgAMAQsgAAsCfyAALAALQQBIBEAgACgCBAwBCyAALQALC2pJIAcgAU1xCwRAIAACfwJ/IAVBEGoiACIDQgA3AgAgA0EANgIIIAAgASACEN0FIAAiASwAC0EASAsEQCABKAIADAELIAELAn8gACwAC0EASARAIAAoAgQMAQsgAC0ACwsQ3QggABDVCBoMAQsgBCADayAGSQRAIAAgBCADIAZqIARrIAMgAxDbCAsCfyAALAALQQBIBEAgACgCAAwBCyAACyADaiEEA0AgASACRwRAIAQgAS0AADoAACABQQFqIQEgBEEBaiEEDAELCyAFQQA6AA8gBCAFLQAPOgAAIAMgBmohAQJAIAAsAAtBAEgEQCAAIAE2AgQMAQsgACABOgALCwsgBUEgaiQACwsAIABBtKwCEOYFCyAAIAAQxwggACABKAIINgIIIAAgASkCADcCACABEIsGCwsAIABBrKwCEOYFC34BAX8jAEEgayIDJAAgAyABNgIQIAMgADYCGCADIAI2AggDQAJAAn9BASADKAIYIAMoAhBGQQFzRQ0AGiADKAIYLQAAIAMoAggtAABGDQFBAAshACADQSBqJAAgAA8LIAMgAygCGEEBajYCGCADIAMoAghBAWo2AggMAAALAAs0AQF/IwBBEGsiAiQAIAIgACgCADYCCCACIAIoAgggAWo2AgggAigCCCEAIAJBEGokACAACz0BAn8gASgCACECIAFBADYCACACIQMgACgCACECIAAgAzYCACACBEAgAiAAKAIEEQEACyAAIAEoAgQ2AgQL+wQBAX8jAEHwBGsiACQAIAAgATYC6AQgACACNgLgBCAAQekENgIQIABByAFqIABB0AFqIABBEGoQ5wUhByAAIAQoAhwiATYCwAEgASABKAIEQQFqNgIEIABBwAFqEOsEIQEgAEEAOgC/AQJAIABB6ARqIAIgAyAAQcABaiAEKAIEIAUgAEG/AWogASAHIABBxAFqIABB4ARqEJsHRQ0AIABB27cBKAAANgC3ASAAQdS3ASkAADcDsAEgASAAQbABaiAAQboBaiAAQYABaiABKAIAKAIwEQgAGiAAQegENgIQIABBCGpBACAAQRBqEOcFIQEgAEEQaiECAkAgACgCxAEgBygCAGtBiQNOBEAgACgCxAEgBygCAGtBAnVBAmoQoAkhAyABKAIAIQIgASADNgIAIAIEQCACIAEoAgQRAQALIAEoAgBFDQEgASgCACECCyAALQC/AQRAIAJBLToAACACQQFqIQILIAcoAgAhBANAAkAgBCAAKALEAU8EQCACQQA6AAAgACAGNgIAIABBEGogABDLBUEBRw0BIAEoAgAhAiABQQA2AgAg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AEGwA2oQ7gQEQCAFIAUoAgBBAnI2AgALIAAoArgDIQMCfyAAKAIQIgIgAigCBEF/aiIENgIEIARBf0YLBEAgAiACKAIAKAIIEQEACyABKAIAIQIgAUEANgIAIAIEQCACIAEoAgQRAQALIABBwANqJAAgAwtbAQJ/IwBBEGsiASQAAkAgACwAC0EASARAIAAoAgAhAiABQQA2AgwgAiABKAIMNgIAIABBADYCBAwBCyABQQA2AgggACABKAIINgIAIABBADoACwsgAUEQaiQAC64DAQV/IwBBEGsiAyQAAn8gACwAC0EASARAIAAoAgQMAQsgAC0ACwshBSAALAALQQBIBH8gACgCCEH/////B3FBf2oFQQELIQQCQCACIAFrQQJ1IgZFDQACfwJ/IAAsAAtBAEgEQCAAKAIADAELIAALIQcgAQJ/IAAsAAtBAEgEQCAAKAIADAELIAALAn8gACwAC0EASARAIAAoAgQMAQsgAC0ACwtBAnRqSSAHIAFNcQsEQCAAAn8CfyADQgA3AgAgA0EANgIIIAMgASACEOEFIAMiACwAC0EASAsEQCAAKAIADAELIAALAn8gAywAC0EASARAIAMoAgQMAQsgAy0ACwsQ5AggAxDVCBoMAQsgBCAFayAGSQRAIAAgBCAFIAZqIARrIAUgBRDjCAsCfyAALAALQQBIBEAgACgCAAwBCyAACyAFQQJ0aiEEA0AgASACRwRAIAQgASgCADYCACABQQRqIQEgBEEEaiEEDAELCyADQQA2AgAgBCADKAIANgIAIAUgBmohAQJAIAAsAAtBAEgEQCAAIAE2AgQMAQsgACABOgALCwsgA0EQaiQACwsAIABBxKwCEOYFCyAAIAAQyAggACABKAIINgIIIAAgASkCADcCACABEIsGCwsAIABBvKwCEOYFC34BAX8jAEEgayIDJAAgAyABNgIQIAMgADYCGCADIAI2AggDQAJAAn9BASADKAIYIAMoAhBGQQFzRQ0AGiADKAIYKAIAIAMoAggoAgBGDQFBAAshACADQSBqJAAgAA8LIAMgAygCGEEEajYCGCADIAMoAghBBGo2AggMAAALAAs3AQF/IwBBEGsiAiQAIAIgACgCADYCCCACIAIoAgggAUECdGo2AgggAigCCCEAIAJBEGokACAAC/QGAQt/IwBB0ANrIgAkACAAIAU3AxAgACAGNwMYIAAgAEHgAmo2AtwCIABB4AJqIABBEGoQzAUhCSAAQegENgLwASAAQegBakEAIABB8AFqEOcFIQsgAEHoBDYC8AEgAEHgAWpBACAAQfABahDnBSEKIABB8AFqIQwCQCAJQeQATwRAEIkGIQcgACAFNwMAIAAgBjcDCCAAQdwCaiAHQd+3ASAAELkGIQkgACgC3AIiCEUNASALKAIAIQcgCyAINgIAIAcEQCAHIAsoAgQRAQALIAkQoAkhCCAKKAIAIQcgCiAINgIAIAcEQCAHIAooAgQRAQALIAooAgBBAEdBAXMNASAKKAIAIQwLIAAgAygCHCIHNgLYASAHIAcoAgRBAWo2AgQgAEHYAWoQ3gQiESIHIAAoAtwCIgggCCAJaiAMIAcoAgAoAiARCAAaIAICfyAJBEAgACgC3AItAABBLUYhDwsgDwsgAEHYAWogAEHQAWogAEHPAWogAEHOAWogAEHAAWoQ7AUiECAAQbABahDsBSINIABBoAFqEOwFIgcgAEGcAWoQpwcgAEHoBDYCMCAAQShqQQAgAEEwahDnBSEIAn8gCSAAKAKcASICSgRAAn8gBywAC0EASARAIAcoAgQMAQsgBy0ACwsgCSACa0EBdEEBcmoMAQsCfyAHLAALQQBIBEAgBygCBAwBCyAHLQALC0ECagshDiAAQTBqIQIgACgCnAECfyANLAALQQBIBEAgDSgCBAwBCyANLQALCyAOamoiDkHlAE8EQCAOEKAJIQ4gCCgCACECIAggDjYCACACBEAgAiAIKAIEEQEACyAIKAIAIgJFDQELIAIgAEEkaiAAQSBqIAMoAgQgDCAJIAxqIBEgDyAAQdABaiAALADPASAALADOASAQIA0gByAAKAKcARCoByABIAIgACgCJCAAKAIgIAMgBBCuAyECIAgoAgAhASAIQQA2AgAgAQRAIAEgCCgCBBEBAAsgBxDVCBogDRDVCBogEBDVCBoCfyAAKALYASIBIAEoAgRBf2oiAzYCBCADQX9GCwRAIAEgASgCACgCCBEBAAsgCigCACEBIApBADYCACABBEAgASAKKAIEEQEACyALKAIAIQEgC0EANgIAIAEEQCABIAsoAgQRAQALIABB0ANqJAAgAg8LEIMHAAvRAwEBfyMAQRBrIgokACAJAn8gAARAIAIQlAchAAJAIAEEQCAKIAAgACgCACgCLBECACADIAooAgA2AAAgCiAAIAAoAgAoAiARAgAMAQsgCiAAIAAoAgAoAigRAgAgAyAKKAIANgAAIAogACAAKAIAKAIcEQIACyAIIAoQlQcgChDVCBogBCAAIAAoAgAoAgwRAAA6AAAgBSAAIAAoAgAoAhARAAA6AAAgCiAAIAAoAgAoAhQRAgAgBiAKEJUHIAoQ1QgaIAogACAAKAIAKAIYEQIAIAcgChCVByAKENUIGiAAIAAoAgAoAiQRAAAMAQsgAhCWByEAAkAgAQRAIAogACAAKAIAKAIsEQIAIAMgCigCADYAACAKIAAgACgCACgCIBECAAwBCyAKIAAgACgCACgCKBECACADIAooAgA2AAAgCiAAIAAoAgAoAhwRAgALIAggChCVByAKENUIGiAEIAAgACgCACgCDBEAADoAACAFIAAgACgCACgCEBEAADoAACAKIAAgACgCACgCFBECACAGIAoQlQcgChDVCBogCiAAIAAoAgAoAhgRAgAgByAKEJUHIAoQ1QgaIAAgACgCACgCJBEAAAs2AgAgCkEQaiQAC/AHAQp/IwBBEGsiEyQAIAIgADYCACADQYAEcSEWA0ACQAJAAkACQCAUQQRGBEACfyANLAALQQBIBEAgDSgCBAwBCyANLQALC0EBSwRAIBMgDRCqBjYCCCACIBNBCGpBARCYByANEKsGIAIoAgAQqQc2AgALIANBsAFxIgNBEEYNAiADQSBHDQEgASACKAIANgIADAILIAggFGosAAAiD0EESw0DAkACQAJAAkACQCAPQQFrDgQBAwIEAAsgASACKAIANgIADAcLIAEgAigCADYCACAGQSAgBigCACgCHBEDACEPIAIgAigCACIQQQFqNgIAIBAgDzoAAAwGCwJ/IA0sAAtBAEgEQCANKAIEDAELIA0tAAsLRQ0FAn8gDSwAC0EASARAIA0oAgAMAQsgDQstAAAhDyACIAIoAgAiEEEBajYCACAQIA86AAAMBQsCfyAMLAALQQBIBEAgDCgCBAwBCyAMLQALC0UhDyAWRQ0EIA8NBCACIAwQqgYgDBCrBiACKAIAEKkHNgIADAQLIAIoAgAhFyAEQQFqIAQgBxsiBCERA0ACQCARIAVPDQAgESwAACIPQQBOBH8gBigCCCAPQf8BcUEBdGovAQBBgBBxQQBH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IgIkACAAKAIAQX9HBEAgAkEIaiIDIAE2AgAgAiADNgIAIAAgAhDNCAsgAkEQaiQACxQAIAAEQCAAIAAoAgAoAgQRAQALCw0AIAAoAgAoAgAQxQgLJAAgAkH/AE0Ef0GslwEoAgAgAkEBdGovAQAgAXFBAEcFQQALC0YAA0AgASACRwRAIAMgASgCAEH/AE0Ef0GslwEoAgAgASgCAEEBdGovAQAFQQALOwEAIANBAmohAyABQQRqIQEMAQsLIAILRQADQAJAIAIgA0cEfyACKAIAQf8ASw0BQayXASgCACACKAIAQQF0ai8BACABcUUNASACBSADCw8LIAJBBGohAgwAAAsAC0UAAkADQCACIANGDQECQCACKAIAQf8ASw0AQayXASgCACACKAIAQQF0ai8BACABcUUNACACQQRqIQIMAQsLIAIhAwsgAwseACABQf8ATQR/QbCdASgCACABQQJ0aigCAAUgAQsLQQADQCABIAJHBEAgASABKAIAIgBB/wBNBH9BsJ0BKAIAIAEoAgBBAnRqKAIABSAACzYCACABQQRqIQEMAQsLIAILHgAgAUH/AE0Ef0HAqQEoAgAgAUECdGooAgAFIAELC0EAA0AgASACRwRAIAEgASgCACIAQf8ATQR/QcCpASgCACABKAIAQQJ0aigCAAUgAAs2AgAgAUEEaiEBDAELCyACCwQAIAELKgADQCABIAJGRQRAIAMgASwAADYCACADQQRqIQMgAUEBaiEBDAELCyACCxMAIAEgAiABQYABSRtBGHRBGHULNQADQCABIAJGRQRAIAQgASgCACIAIAMgAEGAAUkbOgAAIARBAWohBCABQQRqIQEMAQsLIAILKQEBfyAAQYS4ATYCAAJAIAAoAggiAUUNACAALQAMRQ0AIAEQoQkLIAALCgAgABDcBxChCQsnACABQQBOBH9BsJ0BKAIAIAFB/wFxQQJ0aigCAAUgAQtBGHRBGHULQAADQCABIAJHBEAgASABLAAAIgBBAE4Ef0GwnQEoAgAgASwAAEECdGooAgAFIAALOgAAIAFBAWohAQwBCwsgAgsnACABQQBOBH9BwKkBKAIAIAFB/wFxQQJ0aigCAAUgAQtBGHRBGHULQAADQCABIAJHBEAgASABLAAAIgBBAE4Ef0HAqQEoAgAgASwAAEECdGooAgAFIAALOgAAIAFBAWohAQwBCwsgAgsqAANAIAEgAkZFBEAgAyABLQAAOgAAIANBAWohAyABQQFqIQEMAQsLIAILDAAgASACIAFBf0obCzQAA0AgASACRkUEQCAEIAEsAAAiACADIABBf0obOgAAIARBAWohBCABQQFqIQEMAQsLIAILEgAgBCACNgIAIAcgBTYCAEEDCwsAIAQgAjYCAEEDC1gAIwBBEGsiACQAIAAgBDYCDCAAIAMgAms2AggjAEEQayIBJAAgAEEIaiICKAIAIABBDGoiAygCAEkhBCABQRBqJAAgAiADIAQbKAIAIQEgAEEQaiQAIAELCgAgABC5BxChCQveAwEFfyMAQRBrIgkkACACIQgDQAJAIAMgCEYEQCADIQgMAQsgCCgCAEUNACAIQQRqIQgMAQsLIAcgBTYCACAEIAI2AgBBASEKA0ACQAJAAkAgBSAGRg0AIAIgA0YNACAJIAEpAgA3AwgCQAJAAkAgBSAEIAggAmtBAnUgBiAFayAAKAIIEOoHIgtBAWoiDEEBTQRAIAxBAWtFDQUgByAFNgIAA0ACQCACIAQoAgBGDQAgBSACKAIAIAAoAggQ6wciAUF/Rg0AIAcgBygCACABaiIFNgIAIAJBBGohAgwBCwsgBCACNgIADAELIAcgBygCACALaiIFNgIAIAUgBkYNAiADIAhGBEAgBCgCACECIAMhCAwHCyAJQQRqQQAgACgCCBDrByIIQX9HDQELQQIhCgwDCyAJQQRqIQUgCCAGIAcoAgBrSwRADAMLA0AgCARAIAUtAAAhAiAHIAcoAgAiC0EBajYCACALIAI6AAAgCEF/aiEIIAVBAWohBQwBCwsgBCAEKAIAQQRqIgI2AgAgAiEIA0AgAyAIRgRAIAMhCAwFCyAIKAIARQ0EIAhBBGohCAwAAAsACyAEKAIAIQILIAIgA0chCgsgCUEQaiQAIAoPCyAHKAIAIQUMAAALAAtjAQF/IwBBEGsiBSQAIAUgBDYCDCAFQQhqIAVBDGoQjQYhBCAAIAEgAiADENAFIQEgBCgCACIABEBByIcCKAIAGiAABEBByIcCQfySAiAAIABBf0YbNgIACwsgBUEQaiQAIAELXwEBfyMAQRBrIgMkACADIAI2AgwgA0EIaiADQQxqEI0GIQIgACABEPcDIQEgAigCACIABEBByIcCKAIAGiAABEBByIcCQfySAiAAIABBf0YbNgIACwsgA0EQaiQAIAELwAMBA38jAEEQayIJJAAgAiEIA0ACQCADIAhGBEAgAyEIDAELIAgtAABFDQAgCEEBaiEIDAELCyAHIAU2AgAgBCACNgIAA0ACQAJ/AkAgBSAGRg0AIAIgA0YNACAJIAEpAgA3AwgCQAJAAkACQCAFIAQgCCACayAGIAVrQQJ1IAEgACgCCBDtByIKQX9GBEADQAJAIAcgBTYCACACIAQoAgBGDQACQCAFIAIgCCACayAJQQhqIAAoAggQ7gciBUECaiIBQQJLDQBBASEFAkAgAUEBaw4CAAEHCyAEIAI2AgAMBAsgAiAFaiECIAcoAgBBBGohBQwBCwsgBCACNgIADAULIAcgBygCACAKQQJ0aiIFNgIAIAUgBkYNAyAEKAIAIQIgAyAIRgRAIAMhCAwICyAFIAJBASABIAAoAggQ7gdFDQELQQIMBAsgByAHKAIAQQRqNgIAIAQgBCgCAEEBaiICNgIAIAIhCANAIAMgCEYEQCADIQgMBgsgCC0AAEUNBSAIQQFqIQgMAAALAAsgBCACNgIAQQEMAgsgBCgCACECCyACIANHCyEIIAlBEGokACAIDwsgBygCACEFDAAACwALZQEBfyMAQRBrIgYkACAGIAU2AgwgBkEIaiAGQQxqEI0GIQUgACABIAIgAyAEENIFIQEgBSgCACIABEBByIcCKAIAGiAABEBByIcCQfySAiAAIABBf0YbNgIACwsgBkEQaiQAIAELYwEBfyMAQRBrIgUkACAFIAQ2AgwgBUEIaiAFQQxqEI0GIQQgACABIAIgAxCrBSEBIAQoAgAiAARAQciHAigCABogAARAQciHAkH8kgIgACAAQX9GGzYCAAsLIAVBEGokACABC5QBAQF/IwBBEGsiBSQAIAQgAjYCAEECIQICQCAFQQxqQQAgACgCCBDrByIAQQFqQQJJDQBBASECIABBf2oiASADIAQoAgBrSw0AIAVBDGohAgN/IAEEfyACLQAAIQAgBCAEKAIAIgNBAWo2AgAgAyAAOgAAIAFBf2ohASACQQFqIQIMAQVBAAsLIQILIAVBEGokACACCy0BAX9BfyEBAkAgACgCCBDxBwR/QX8FIAAoAggiAA0BQQELDwsgABDyB0EBRgtmAQJ/IwBBEGsiASQAIAEgADYCDCABQQhqIAFBDGoQjQYhACMAQRBrIgIkACACQRBqJAAgACgCACIABEBByIcCKAIAGiAABEBByIcCQfySAiAAIABBf0YbNgIACwsgAUEQaiQAQQALZwECfyMAQRBrIgEkACABIAA2AgwgAUEIaiABQQxqEI0GIQBBBEEBQciHAigCACgCABshAiAAKAIAIgAEQEHIhwIoAgAaIAAEQEHIhwJB/JICIAAgAEF/Rhs2AgALCyABQRBqJAAgAgtaAQR/A0ACQCACIANGDQAgBiAETw0AIAIgAyACayABIAAoAggQ9AciB0ECaiIIQQJNBEBBASEHIAhBAmsNAQsgBkEBaiEGIAUgB2ohBSACIAdqIQIMAQsLIAULagEBfyMAQRBrIgQkACAEIAM2AgwgBEEIaiAEQQxqEI0GIQNBACAAIAEgAkHYqwIgAhsQqwUhASADKAIAIgAEQEHIhwIoAgAaIAAEQEHIhwJB/JICIAAgAEF/Rhs2AgALCyAEQRBqJAAgAQsVACAAKAIIIgBFBEBBAQ8LIAAQ8gcLTQAjAEEQayIAJAAgACACNgIMIAAgBTYCCCACIAMgAEEMaiAFIAYgAEEIahD3ByEBIAQgACgCDDYCACAHIAAoAgg2AgAgAEEQaiQAIAELvwUBAn8gAiAANgIAIAUgAzYCACACKAIAIQYCQAJAA0AgBiABTwRAQQAhAAwDC0ECIQAgBi8BACIDQf//wwBLDQICQAJAIANB/wBNBEBBASEAIAQgBSgCACIGa0EBSA0FIAUgBkEBajYCACAGIAM6AAAMAQsgA0H/D00EQCAEIAUoAgAiAGtBAkgNBCAFIABBAWo2AgAgACADQQZ2QcABcjoAACAFIAUoAgAiAEEBajYCACAAIANBP3FBgAFyOgAADAELIANB/68DTQRAIAQgBSgCACIAa0EDSA0EIAUgAEEBajYCACAAIANBDHZB4AFyOgAAIAUgBSgCACIAQQFqNgIAIAAgA0EGdkE/cUGAAXI6AAAgBSAFKAIAIgBBAWo2AgAgACADQT9xQYABcjoAAAwBCyADQf+3A00EQEEBIQAgASAGa0EESA0FIAYvAQIiB0GA+ANxQYC4A0cNAiAEIAUoAgBrQQRIDQUgB0H/B3EgA0EKdEGA+ANxIANBwAdxIgBBCnRyckGAgARqQf//wwBLDQIgAiAGQQJqNgIAIAUgBSgCACIGQQFqNgIAIAYgAEEGdkEBaiIAQQJ2QfABcjoAACAFIAUoAgAiBkEBajYCACAGIABBBHRBMHEgA0ECdkEPcXJBgAFyOgAAIAUgBSgCACIAQQFqNgIAIAAgB0EGdkEPcSADQQR0QTBxckGAAXI6AAAgBSAFKAIAIgBBAWo2AgAgACAHQT9xQYABcjoAAAwBCyADQYDAA0kNBCAEIAUoAgAiAGtBA0gNAyAFIABBAWo2AgAgACADQQx2QeABcjoAACAFIAUoAgAiAEEBajYCACAAIANBBnZBP3FBgAFyOgAAIAUgBSgCACIAQQFqNgIAIAAgA0E/cUGAAXI6AAALIAIgAigCAEECaiIGNgIADAELC0ECDwtBAQ8LIAALTQAjAEEQayIAJAAgACACNgIMIAAgBTYCCCACIAMgAEEMaiAFIAYgAEEIahD5ByEBIAQgACgCDDYCACAHIAAoAgg2AgAgAEEQaiQAIAELnwUBBX8gAiAANgIAIAUgAzYCAAJAA0AgAigCACIAIAFPBEBBACEJDAILQQEhCSAFKAIAIgcgBE8NAQJAIAAtAAAiA0H//8MASw0AIAICfyADQRh0QRh1QQBOBEAgByADOwEAIABBAWoMAQsgA0HCAUkNASADQd8BTQRAIAEgAGtBAkgNBCAALQABIgZBwAFxQYABRw0CQQIhCSAGQT9xIANBBnRBwA9xciIDQf//wwBLDQQgByADOwEAIABBAmoMAQsgA0HvAU0EQCABIABrQQNIDQQgAC0AAiEIIAAtAAEhBgJAAkAgA0HtAUcEQCADQeABRw0BIAZB4AFxQaABRw0FDAILIAZB4AFxQYABRw0EDAELIAZBwAFxQYABRw0DCyAIQcABcUGAAUcNAkECIQkgCEE/cSAGQT9xQQZ0IANBDHRyciIDQf//A3FB///DAEsNBCAHIAM7AQAgAEEDagwBCyADQfQBSw0BIAEgAGtBBEgNAyAALQADIQggAC0AAiEGIAAtAAEhAAJAAkAgA0GQfmoiCkEESw0AAkACQCAKQQFrDgQCAgIBAAsgAEHwAGpB/wFxQTBPDQQMAgsgAEHwAXFBgAFHDQMMAQsgAEHAAXFBgAFHDQILIAZBwAFxQYABRw0BIAhBwAFxQYABRw0BIAQgB2tBBEgNA0ECIQkgCEE/cSIIIAZBBnQiCkHAH3EgAEEMdEGA4A9xIANBB3EiA0ESdHJyckH//8MASw0DIAcgAEECdCIAQcABcSADQQh0ciAGQQR2QQNxIABBPHFyckHA/wBqQYCwA3I7AQAgBSAHQQJqNgIAIAcgCkHAB3EgCHJBgLgDcjsBAiACKAIAQQRqCzYCACAFIAUoAgBBAmo2AgAMAQsLQQIPCyAJCwsAIAIgAyAEEPsHC4AEAQd/IAAhAwNAAkAgBiACTw0AIAMgAU8NACADLQAAIgRB///DAEsNAAJ/IANBAWogBEEYdEEYdUEATg0AGiAEQcIBSQ0BIARB3wFNBEAgASADa0ECSA0CIAMtAAEiBUHAAXFBgAFHDQIgBUE/cSAEQQZ0QcAPcXJB///DAEsNAiADQQJqDAELAkACQCAEQe8BTQRAIAEgA2tBA0gNBCADLQACIQcgAy0AASEFIARB7QFGDQEgBEHgAUYEQCAFQeABcUGgAUYNAwwFCyAFQcABcUGAAUcNBAwCCyAEQfQBSw0DIAIgBmtBAkkNAyABIANrQQRIDQMgAy0AAyEHIAMtAAIhCCADLQABIQUCQAJAIARBkH5qIglBBEsNAAJAAkAgCUEBaw4EAgICAQALIAVB8ABqQf8BcUEwSQ0CDAYLIAVB8AFxQYABRg0BDAULIAVBwAFxQYABRw0ECyAIQcABcUGAAUcNAyAHQcABcUGAAUcNAyAHQT9xIAhBBnRBwB9xIARBEnRBgIDwAHEgBUE/cUEMdHJyckH//8MASw0DIAZBAWohBiADQQRqDAILIAVB4AFxQYABRw0CCyAHQcABcUGAAUcNASAHQT9xIARBDHRBgOADcSAFQT9xQQZ0cnJB///DAEsNASADQQNqCyEDIAZBAWohBgwBCwsgAyAAawsEAEEEC00AIwBBEGsiACQAIAAgAjYCDCAAIAU2AgggAiADIABBDGogBSAGIABBCGoQ/gchASAEIAAoAgw2AgAgByAAKAIINgIAIABBEGokACABC9cDAQF/IAIgADYCACAFIAM2AgAgAigCACEDAkADQCADIAFPBEBBACEGDAILQQIhBiADKAIAIgBB///DAEsNASAAQYBwcUGAsANGDQECQAJAIABB/wBNBEBBASEGIAQgBSgCACIDa0EBSA0EIAUgA0EBajYCACADIAA6AAAMAQsgAEH/D00EQCAEIAUoAgAiA2tBAkgNAiAFIANBAWo2AgAgAyAAQQZ2QcABcjoAACAFIAUoAgAiA0EBajYCACADIABBP3FBgAFyOgAADAELIAQgBSgCACIDayEGIABB//8DTQRAIAZBA0gNAiAFIANBAWo2AgAgAyAAQQx2QeABcjoAACAFIAUoAgAiA0EBajYCACADIABBBnZBP3FBgAFyOgAAIAUgBSgCACIDQQFqNgIAIAMgAEE/cUGAAXI6AAAMAQsgBkEESA0BIAUgA0EBajYCACADIABBEnZB8AFyOgAAIAUgBSgCACIDQQFqNgIAIAMgAEEMdkE/cUGAAXI6AAAgBSAFKAIAIgNBAWo2AgAgAyAAQQZ2QT9xQYABcjoAACAFIAUoAgAiA0EBajYCACADIABBP3FBgAFyOgAACyACIAIoAgBBBGoiAzYCAAwBCwtBAQ8LIAYLTQAjAEEQayIAJAAgACACNgIMIAAgBTYCCCACIAMgAEEMaiAFIAYgAEEIahCACCEBIAQgACgCDDYCACAHIAAoAgg2AgAgAEEQaiQAIAELugQBBn8gAiAANgIAIAUgAzYCAANAIAIoAgAiBiABTwRAQQAPC0EBIQkCQAJAAkAgBSgCACILIARPDQAgBiwAACIAQf8BcSEDIABBAE4EQCADQf//wwBLDQNBASEADAILIANBwgFJDQIgA0HfAU0EQCABIAZrQQJIDQFBAiEJIAYtAAEiB0HAAXFBgAFHDQFBAiEAIAdBP3EgA0EGdEHAD3FyIgNB///DAE0NAgwBCwJAIANB7wFNBEAgASAGa0EDSA0CIAYtAAIhCCAGLQABIQcCQAJAIANB7QFHBEAgA0HgAUcNASAHQeABcUGgAUYNAgwHCyAHQeABcUGAAUYNAQwGCyAHQcABcUGAAUcNBQsgCEHAAXFBgAFGDQEMBAsgA0H0AUsNAyABIAZrQQRIDQEgBi0AAyEIIAYtAAIhCiAGLQABIQcCQAJAIANBkH5qIgBBBEsNAAJAAkAgAEEBaw4EAgICAQALIAdB8ABqQf8BcUEwTw0GDAILIAdB8AFxQYABRw0FDAELIAdBwAFxQYABRw0ECyAKQcABcUGAAUcNAyAIQcABcUGAAUcNA0EEIQBBAiEJIAhBP3EgCkEGdEHAH3EgA0ESdEGAgPAAcSAHQT9xQQx0cnJyIgNB///DAEsNAQwCC0EDIQBBAiEJIAhBP3EgA0EMdEGA4ANxIAdBP3FBBnRyciIDQf//wwBNDQELIAkPCyALIAM2AgAgAiAAIAZqNgIAIAUgBSgCAEEEajYCAAwBCwtBAgsLACACIAMgBBCCCAvzAwEHfyAAIQMDQAJAIAcgAk8NACADIAFPDQAgAywAACIEQf8BcSEFAn8gBEEATgRAIAVB///DAEsNAiADQQFqDAELIAVBwgFJDQEgBUHfAU0EQCABIANrQQJIDQIgAy0AASIEQcABcUGAAUcNAiAEQT9xIAVBBnRBwA9xckH//8MASw0CIANBAmoMAQsCQAJAIAVB7wFNBEAgASADa0EDSA0EIAMtAAIhBiADLQABIQQgBUHtAUYNASAFQeABRgRAIARB4AFxQaABRg0DDAULIARBwAFxQYABRw0EDAILIAVB9AFLDQMgASADa0EESA0DIAMtAAMhBiADLQACIQggAy0AASEEAkACQCAFQZB+aiIJQQRLDQACQAJAIAlBAWsOBAICAgEACyAEQfAAakH/AXFBMEkNAgwGCyAEQfABcUGAAUYNAQwFCyAEQcABcUGAAUcNBAsgCEHAAXFBgAFHDQMgBkHAAXFBgAFHDQMgBkE/cSAIQQZ0QcAfcSAFQRJ0QYCA8ABxIARBP3FBDHRycnJB///DAEsNAyADQQRqDAILIARB4AFxQYABRw0CCyAGQcABcUGAAUcNASAGQT9xIAVBDHRBgOADcSAEQT9xQQZ0cnJB///DAEsNASADQQNqCyEDIAdBAWohBwwBCwsgAyAAawsWACAAQei4ATYCACAAQQxqENUIGiAACwoAIAAQgwgQoQkLFgAgAEGQuQE2AgAgAEEQahDVCBogAAsKACAAEIUIEKEJCwcAIAAsAAgLBwAgACwACQsMACAAIAFBDGoQ0wgLDAAgACABQRBqENMICwsAIABBsLkBEIAFCwsAIABBuLkBEI0ICxwAIABCADcCACAAQQA2AgggACABIAEQzgUQ4AgLCwAgAEHMuQEQgAULCwAgAEHUuQEQjQgLDgAgACABIAEQlgQQ1ggLUAACQEHkrQItAABBAXENAEHkrQItAABBAEdBAXNFDQAQkghB4K0CQZCvAjYCAEHkrQJBADYCAEHkrQJB5K0CKAIAQQFyNgIAC0HgrQIoAgAL8QEBAX8CQEG4sAItAABBAXENAEG4sAItAABBAEdBAXNFDQBBkK8CIQADQCAAEOwFQQxqIgBBuLACRw0AC0G4sAJBADYCAEG4sAJBuLACKAIAQQFyNgIAC0GQrwJBuNwBEJAIQZyvAkG/3AEQkAhBqK8CQcbcARCQCEG0rwJBztwBEJAIQcCvAkHY3AEQkAhBzK8CQeHcARCQCEHYrwJB6NwBEJAIQeSvAkHx3AEQkAhB8K8CQfXcARCQCEH8rwJB+dwBEJAIQYiwAkH93AEQkAhBlLACQYHdARCQCEGgsAJBhd0BEJAIQaywAkGJ3QEQkAgLHABBuLACIQADQCAAQXRqENUIIgBBkK8CRw0ACwtQAAJAQeytAi0AAEEBcQ0AQeytAi0AAEEAR0EBc0UNABCVCEHorQJBwLACNgIAQeytAkEANgIAQeytAkHsrQIoAgBBAXI2AgALQeitAigCAAvxAQEBfwJAQeixAi0AAEEBcQ0AQeixAi0AAEEAR0EBc0UNAEHAsAIhAANAIAAQ7AVBDGoiAEHosQJHDQALQeixAkEANgIAQeixAkHosQIoAgBBAXI2AgALQcCwAkGQ3QEQlwhBzLACQazdARCXCEHYsAJByN0BEJcIQeSwAkHo3QEQlwhB8LACQZDeARCXCEH8sAJBtN4BEJcIQYixAkHQ3gEQlwhBlLECQfTeARCXCEGgsQJBhN8BEJcIQayxAkGU3wEQlwhBuLECQaTfARCXCEHEsQJBtN8BEJcIQdCxAkHE3wEQlwhB3LECQdTfARCXCAscAEHosQIhAANAIABBdGoQ1QgiAEHAsAJHDQALCw4AIAAgASABEM4FEOEIC1AAAkBB9K0CLQAAQQFxDQBB9K0CLQAAQQBHQQFzRQ0AEJkIQfCtAkHwsQI2AgBB9K0CQQA2AgBB9K0CQfStAigCAEEBcjYCAAtB8K0CKAIAC98CAQF/AkBBkLQCLQAAQQFxDQBBkLQCLQAAQQBHQQFzRQ0AQfCxAiEAA0AgABDsBUEMaiIAQZC0AkcNAAtBkLQCQQA2AgBBkLQCQZC0AigCAEEBcjYCAAtB8LECQeTfARCQCEH8sQJB7N8BEJAIQYiyAkH13wEQkAhBlLICQfvfARCQCEGgsgJBgeABEJAIQayyAkGF4AEQkAhBuLICQYrgARCQCEHEsgJBj+ABEJAIQdCyAkGW4AEQkAhB3LICQaDgARCQCEHosgJBqOABEJAIQfSyAkGx4AEQkAhBgLMCQbrgARCQCEGMswJBvuABEJAIQZizAkHC4AEQkAhBpLMCQcbgARCQCEGwswJBgeABEJAIQbyzAkHK4AEQkAhByLMCQc7gARCQCEHUswJB0uABEJAIQeCzAkHW4AEQkAhB7LMCQdrgARCQCEH4swJB3uABEJAIQYS0AkHi4AEQkAgLHABBkLQCIQADQCAAQXRqENUIIgBB8LECRw0ACwtQAAJAQfytAi0AAEEBcQ0AQfytAi0AAEEAR0EBc0UNABCcCEH4rQJBoLQCNgIAQfytAkEANgIAQfytAkH8rQIoAgBBAXI2AgALQfitAigCAAvfAgEBfwJAQcC2Ai0AAEEBcQ0AQcC2Ai0AAEEAR0EBc0UNAEGgtAIhAANAIAAQ7AVBDGoiAEHAtgJHDQALQcC2AkEANgIAQcC2AkHAtgIoAgBBAXI2AgALQaC0AkHo4AEQlwhBrLQCQYjhARCXCEG4tAJBrOEBEJcIQcS0AkHE4QEQlwhB0LQCQdzhARCXCEHctAJB7OEBEJcIQei0AkGA4gEQlwhB9LQCQZTiARCXCEGAtQJBsOIBEJcIQYy1AkHY4gEQlwhBmLUCQfjiARCXCEGktQJBnOMBEJcIQbC1AkHA4wEQlwhBvLUCQdDjARCXCEHItQJB4OMBEJcIQdS1AkHw4wEQlwhB4LUCQdzhARCXCEHstQJBgOQBEJcIQfi1AkGQ5AEQlwhBhLYCQaDkARCXCEGQtgJBsOQBEJcIQZy2AkHA5AEQlwhBqLYCQdDkARCXCEG0tgJB4OQBEJcICxwAQcC2AiEAA0AgAEF0ahDVCCIAQaC0AkcNAAsLUAACQEGErgItAABBAXENAEGErgItAABBAEdBAXNFDQAQnwhBgK4CQdC2AjYCAEGErgJBADYCAEGErgJBhK4CKAIAQQFyNgIAC0GArgIoAgALbQEBfwJAQei2Ai0AAEEBcQ0AQei2Ai0AAEEAR0EBc0UNAEHQtgIhAANAIAAQ7AVBDGoiAEHotgJHDQALQei2AkEANgIAQei2AkHotgIoAgBBAXI2AgALQdC2AkHw5AEQkAhB3LYCQfPkARCQCAscAEHotgIhAANAIABBdGoQ1QgiAEHQtgJHDQALC1AAAkBBjK4CLQAAQQFxDQBBjK4CLQAAQQBHQQFzRQ0AEKIIQYiuAkHwtgI2AgBBjK4CQQA2AgBBjK4CQYyuAigCAEEBcjYCAAtBiK4CKAIAC20BAX8CQEGItwItAABBAXENAEGItwItAABBAEdBAXNFDQBB8LYCIQADQCAAEOwFQQxqIgBBiLcCRw0AC0GItwJBADYCAEGItwJBiLcCKAIAQQFyNgIAC0HwtgJB+OQBEJcIQfy2AkGE5QEQlwgLHABBiLcCIQADQCAAQXRqENUIIgBB8LYCRw0ACwtKAAJAQZyuAi0AAEEBcQ0AQZyuAi0AAEEAR0EBc0UNAEGQrgJB7LkBEIAFQZyuAkEANgIAQZyuAkGcrgIoAgBBAXI2AgALQZCuAgsKAEGQrgIQ1QgaC0oAAkBBrK4CLQAAQQFxDQBBrK4CLQAAQQBHQQFzRQ0AQaCuAkH4uQEQjQhBrK4CQQA2AgBBrK4CQayuAigCAEEBcjYCAAtBoK4CCwoAQaCuAhDVCBoLSgACQEG8rgItAABBAXENAEG8rgItAABBAEdBAXNFDQBBsK4CQZy6ARCABUG8rgJBADYCAEG8rgJBvK4CKAIAQQFyNgIAC0GwrgILCgBBsK4CENUIGgtKAAJAQcyuAi0AAEEBcQ0AQcyuAi0AAEEAR0EBc0UNAEHArgJBqLoBEI0IQcyuAkEANgIAQcyuAkHMrgIoAgBBAXI2AgALQcCuAgsKAEHArgIQ1QgaC0oAAkBB3K4CLQAAQQFxDQBB3K4CLQAAQQBHQQFzRQ0AQdCuAkHMugEQgAVB3K4CQQA2AgBB3K4CQdyuAigCAEEBcjYCAAtB0K4CCwoAQdCuAhDVCBoLSgACQEHsrgItAABBAXENAEHsrgItAABBAEdBAXNFDQBB4K4CQeS6ARCNCEHsrgJBADYCAEHsrgJB7K4CKAIAQQFyNgIAC0HgrgILCgBB4K4CENUIGgtKAAJAQfyuAi0AAEEBcQ0AQfyuAi0AAEEAR0EBc0UNAEHwrgJBuLsBEIAFQfyuAkEANgIAQfyuAkH8rgIoAgBBAXI2AgALQfCuAgsKAEHwrgIQ1QgaC0oAAkBBjK8CLQAAQQFxDQBBjK8CLQAAQQBHQQFzRQ0AQYCvAkHEuwEQjQhBjK8CQQA2AgBBjK8CQYyvAigCAEEBcjYCAAtBgK8CCwoAQYCvAhDVCBoLCgAgABC1CBChCQsYACAAKAIIEIkGRwRAIAAoAggQzQULIAALXwEFfyMAQRBrIgAkACAAQf////8DNgIMIABB/////wc2AggjAEEQayIBJAAgAEEIaiICKAIAIABBDGoiAygCAEkhBCABQRBqJAAgAiADIAQbKAIAIQEgAEEQaiQAIAELCQAgACABELkIC04AQeC5AigCABpB4LkCKAIAQfC5AigCAEHguQIoAgBrQQJ1QQJ0ahpB4LkCKAIAQfC5AigCAEHguQIoAgBrQQJ1QQJ0ahpB4LkCKAIAGgslAAJAIAFBHEsNACAALQBwDQAgAEEBOgBwIAAPCyABQQJ0EM4ICxcAQX8gAEkEQEGQ5QEQ0AIACyAAEM4ICxsAAkAgACABRgRAIABBADoAcAwBCyABEKEJCwsmAQF/IAAoAgQhAgNAIAEgAkcEQCACQXxqIQIMAQsLIAAgATYCBAsKACAAEIkGNgIAC4cBAQR/IwBBEGsiAiQAIAIgADYCDBC2CCIBIABPBEBB8LkCKAIAQeC5AigCAGtBAnUiACABQQF2SQRAIAIgAEEBdDYCCCMAQRBrIgAkACACQQhqIgEoAgAgAkEMaiIDKAIASSEEIABBEGokACADIAEgBBsoAgAhAQsgAkEQaiQAIAEPCxDnCAALbgEDfyMAQRBrIgUkACAFQQA2AgwgAEEMaiIGQQA2AgAgBiADNgIEIAEEQCAAKAIQIAEQtwghBAsgACAENgIAIAAgBCACQQJ0aiICNgIIIAAgAjYCBCAAQQxqIAQgAUECdGo2AgAgBUEQaiQAIAALMwEBfyAAKAIQGiAAKAIIIQIDQCACQQA2AgAgACAAKAIIQQRqIgI2AgggAUF/aiIBDQALC2cBAX9B4LkCEMYHQYC6AkHguQIoAgBB5LkCKAIAIABBBGoiARDCCEHguQIgARCDBUHkuQIgAEEIahCDBUHwuQIgAEEMahCDBSAAIAAoAgQ2AgBB5LkCKAIAQeC5AigCAGtBAnUQuAgLKAAgAyADKAIAIAIgAWsiAGsiAjYCACAAQQFOBEAgAiABIAAQrAkaCwsHACAAKAIECyUAA0AgASAAKAIIRwRAIAAoAhAaIAAgACgCCEF8ajYCCAwBCwsLOAECfyAAKAIAIAAoAggiAkEBdWohASAAKAIEIQAgASACQQFxBH8gASgCACAAaigCAAUgAAsRAQALHgBB/////wMgAEkEQEGQ5QEQ0AIACyAAQQJ0EM4IC1ABAX8gABCSByAALAALQQBIBEAgACgCACEBIAAsAAtBAEgEfyAAKAIIQf////8HcUF/agVBCgsaIAEQoQkgAEGAgICAeDYCCCAAQQA6AAsLC1ABAX8gABCfByAALAALQQBIBEAgACgCACEBIAAsAAtBAEgEfyAAKAIIQf////8HcUF/agVBAQsaIAEQoQkgAEGAgICAeDYCCCAAQQA6AAsLCzoCAX8BfiMAQRBrIgMkACADIAEgAhCJBhDaBSADKQMAIQQgACADKQMINwMIIAAgBDcDACADQRBqJAALAwAAC0cBAX8gAEEIaiIBKAIARQRAIAAgACgCACgCEBEBAA8LAn8gASABKAIAQX9qIgE2AgAgAUF/RgsEQCAAIAAoAgAoAhARAQALCwQAQQALLgADQCAAKAIAQQFGDQALIAAoAgBFBEAgAEEBNgIAIAFB6wQRAQAgAEF/NgIACwsxAQJ/IABBASAAGyEAA0ACQCAAEKAJIgENAEHcuwIoAgAiAkUNACACEQcADAELCyABCzoBAn8gARCWBCICQQ1qEM4IIgNBADYCCCADIAI2AgQgAyACNgIAIAAgA0EMaiABIAJBAWoQrAk2AgALKQEBfyACBEAgACEDA0AgAyABNgIAIANBBGohAyACQX9qIgINAAsLIAALaQEBfwJAIAAgAWtBAnUgAkkEQANAIAAgAkF/aiICQQJ0IgNqIAEgA2ooAgA2AgAgAg0ADAIACwALIAJFDQAgACEDA0AgAyABKAIANgIAIANBBGohAyABQQRqIQEgAkF/aiICDQALCyAACwoAQYznARDQAgALWQECfyMAQRBrIgMkACAAQgA3AgAgAEEANgIIIAAhAgJAIAEsAAtBAE4EQCACIAEoAgg2AgggAiABKQIANwIADAELIAAgASgCACABKAIEENQICyADQRBqJAALnAEBA38jAEEQayIEJABBbyACTwRAAkAgAkEKTQRAIAAgAjoACyAAIQMMAQsgACACQQtPBH8gAkEQakFwcSIDIANBf2oiAyADQQtGGwVBCgtBAWoiBRC6CCIDNgIAIAAgBUGAgICAeHI2AgggACACNgIECyADIAEgAhDMBCAEQQA6AA8gAiADaiAELQAPOgAAIARBEGokAA8LENIIAAsdACAALAALQQBIBEAgACgCCBogACgCABChCQsgAAvJAQEDfyMA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AghB/////wdxQX9qBUEBCyIEAn8gACwAC0EASARAIAAoAgQMAQsgAC0ACwsiA2sgAk8EQCACRQ0BAn8gACwAC0EASARAIAAoAgAMAQsgAAsiBCADQQJ0aiABIAIQ1QQgAiADaiICIQECQCAALAALQQBIBEAgACABNgIEDAELIAAgAToACwsgBUEANgIMIAQgAkECdGogBSgCDDYCAAwBCyAAIAQgAiADaiAEayADIANBACACIAEQ4ggLIAVBEGokAAvEAQEDfyMAQRBrIgMkACADIAE2AgwCQAJAAkACQCAALAALQQBIBEAgACgCBCIEIAAoAghB/////wdxQX9qIgJGDQEMAwtBASEEQQEhAiAALQALIgFBAUcNAQsgACACQQEgAiACEOMIIAQhASAALAALQQBIDQELIAAiAiABQQFqOgALDAELIAAoAgAhAiAAIARBAWo2AgQgBCEBCyACIAFBAnRqIgAgAygCDDYCACADQQA2AgggACADKAIINgIEIANBEGokAAusAQEDfyMAQRBrIgQkAEHv////AyABTwRAAkAgAUEBTQRAIAAgAToACyAAIQMMAQsgACABQQJPBH8gAUEEakF8cSIDIANBf2oiAyADQQJGGwVBAQtBAWoiBRDGCCIDNgIAIAAgBUGAgICAeHI2AgggACABNgIECyABBH8gAyACIAEQ0AgFIAMLGiAEQQA2AgwgAyABQQJ0aiAEKAIMNgIAIARBEGokAA8LENIIAAsKAEGZ5wEQ0AIACy8BAX8jAEEQayIAJAAgAEEANgIMQcjpACgCACIAQaDnAUEAEIQEGiAAEIsEEB4ACwYAEOgIAAsGAEG+5wELFQAgAEGE6AE2AgAgAEEEahDsCCAACywBAX8CQCAAKAIAQXRqIgAiASABKAIIQX9qIgE2AgggAUF/Sg0AIAAQoQkLCwoAIAAQ6wgQoQkLDQAgABDrCBogABChCQsGAEH06AELCwAgACABQQAQ8QgLHAAgAkUEQCAAIAFGDwsgACgCBCABKAIEEMMFRQugAQECfyMAQUBqIgMkAEEBIQQCQCAAIAFBABDxCA0AQQAhBCABRQ0AIAFBhOoBEPMIIgFFDQAgA0F/NgIUIAMgADYCECADQQA2AgwgAyABNgIIIANBGGpBAEEnEK0JGiADQQE2AjggASADQQhqIAIoAgBBASABKAIA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CEI0iKdB/w9xIgJB/w9HDQELIAAgAaIiACAAow8LIAhCAYYiBSAGVgRAIAdCNIinQf8PcSEDAn4gAkUEQEEAIQIgCEIMhiIFQgBZBEADQCACQX9qIQIgBUIBhiIFQn9VDQALCyAIQQEgAmuthgwBCyAIQv////////8Hg0KAgICAgICACIQLIgUCfiADRQRAQQAhAyAHQgyGIgZCAFkEQANAIANBf2ohAyAGQgGGIgZCf1UNAAsLIAdBASADa62GDAELIAdC/////////weDQoCAgICAgIAIhAsiB30iBkJ/VSEEIAIgA0oEQANAAkAgBEUNACAGIgVCAFINACAARAAAAAAAAAAAog8LIAVCAYYiBSAHfSIGQn9VIQQgAkF/aiICIANKDQALIAMhAgsCQCAERQ0AIAYiBUIAUg0AIABEAAAAAAAAAACiDwsCQCAFQv////////8HVgRAIAUhBgwBCwNAIAJBf2ohAiAFQoCAgICAgIAEVCEDIAVCAYYiBiEFIAMNAAsLIAhCgICAgICAgICAf4MhBSACQQFOBH4gBkKAgICAgICAeHwgAq1CNIaEBSAGQQEgAmutiAsgBYS/DwsgAEQAAAAAAAAAAKIgACAFIAZRGwurBgIFfwR+IwBBgAFrIgUkAAJAAkACQCADIARCAEIAELEFRQ0AIAMgBBCrCSEHIAJCMIinIglB//8BcSIGQf//AUYNACAHDQELIAVBEGogASACIAMgBBCtBSAFIAUpAxAiAiAFKQMYIgEgAiABELcFIAUpAwghAiAFKQMAIQQMAQsgASACQv///////z+DIAatQjCGhCIKIAMgBEL///////8/gyAEQjCIp0H//wFxIgetQjCGhCILELEFQQBMBEAgASAKIAMgCxCxBQRAIAEhBAwCCyAFQfAAaiABIAJCAEIAEK0FIAUpA3ghAiAFKQNwIQQMAQsgBgR+IAEFIAVB4ABqIAEgCkIAQoCAgICAgMC7wAAQrQUgBSkDaCIKQjCIp0GIf2ohBiAFKQNgCyEEIAdFBEAgBUHQAGogAyALQgBCgICAgICAwLvAABCtBSAFKQNYIgtCMIinQYh/aiEHIAUpA1AhAwsgCkL///////8/g0KAgICAgIDAAIQiCiALQv///////z+DQoCAgICAgMAAhCINfSAEIANUrX0iDEJ/VSEIIAQgA30h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CwwBCyADQQRJBEAgACECDAELIANBfGoiBCAASQRAIAAhAgwBCyAAIQIDQCACIAEtAAA6AAAgAiABLQABOgABIAIgAS0AAjoAAiACIAEtAAM6AAMgAUEEaiEBIAJBBGoiAiAETQ0ACwsgAiADSQRAA0AgAiABLQAAOgAAIAFBAWohASACQQFqIgIgA0cNAAsLIAAL8wICAn8BfgJAIAJFDQAgACACaiIDQX9qIAE6AAAgACABOgAAIAJBA0kNACADQX5qIAE6AAAgACABOgABIANBfWogAToAACAAIAE6AAIgAkEHSQ0AIANBfGogAToAACAAIAE6AAMgAkEJSQ0AIABBACAAa0EDcSIEaiIDIAFB/wFxQYGChAhsIgE2AgAgAyACIARrQXxxIgRqIgJBfGogATYCACAEQQlJDQAgAyABNgIIIAMgATYCBCACQXhqIAE2AgAgAkF0aiABNgIAIARBGUkNACADIAE2AhggAyABNgIUIAMgATYCECADIAE2AgwgAkFwaiABNgIAIAJBbGogATYCACACQWhqIAE2AgAgAkFkaiABNgIAIAQgA0EEcUEYciIEayICQSBJDQAgAa0iBUIghiAFhCEFIAMgBGohAQNAIAEgBTcDGCABIAU3AxAgASAFNwMIIAEgBTcDACABQSBqIQEgAkFgaiICQR9LDQALCyAAC+UCAQJ/AkAgACABRg0AAkAgASACaiAASwRAIAAgAmoiBCABSw0BCyAAIAEgAhCsCRoPCyAAIAFzQQNxIQMCQAJAIAAgAUkEQCADDQIgAEEDcUUNAQNAIAJFDQQgACABLQAAOgAAIAFBAWohASACQX9qIQIgAEEBaiIAQQNxDQALDAELAkAgAw0AIARBA3EEQANAIAJFDQUgACACQX9qIgJqIgMgASACai0AADoAACADQQNxDQALCyACQQNNDQADQCAAIAJBfGoiAmogASACaigCADYCACACQQNLDQALCyACRQ0CA0AgACACQX9qIgJqIAEgAmotAAA6AAAgAg0ACwwCCyACQQNNDQAgAiEDA0AgACABKAIANgIAIAFBBGohASAAQQRqIQAgA0F8aiIDQQNLDQALIAJBA3EhAgsgAkUNAANAIAAgAS0AADoAACAAQQFqIQAgAUEBaiEBIAJBf2oiAg0ACwsLHwBB1L8CKAIARQRAQdi/AiABNgIAQdS/AiAANgIACwsEACMACxAAIwAgAGtBcHEiACQAIAALBgAgACQACwYAIABAAAsLACABIAIgABECAAsPACABIAIgAyAEIAARCwALDQAgASACIAMgABEeAAsPACABIAIgAyAEIAARSAALDQAgASACIAMgABEaAAsPACABIAIgAyAEIAARGQALCwAgASACIAARDwALCwAgASACIAARFwALDwAgASACIAMgBCAAEVgACxEAIAEgAiADIAQgBSAAEUsACxEAIAEgAiADIAQgBSAAEVkACxMAIAEgAiADIAQgBSAGIAARTAALDwAgASACIAMgBCAAEToACxEAIAEgAiADIAQgBSAAETQACxEAIAEgAiADIAQgBSAAETsACxMAIAEgAiADIAQgBSAGIAARNQALEwAgASACIAMgBCAFIAYgABE8AAsVACABIAIgAyAEIAUgBiAHIAARNgALCwAgASACIAAREwALDQAgASACIAMgABFJAAsRACABIAIgAyAEIAUgABE+AAsTACABIAIgAyAEIAUgBiAAESQACw8AIAEgAiADIAQgABFCAAsPACABIAIgAyAEIAARGAALDQAgASACIAMgABE9AAsPACABIAIgAyAEIAARNwALDwAgASACIAMgBCAAEQgACw0AIAEgAiADIAARFAALDwAgASACIAMgBCAAEU4ACxEAIAEgAiADIAQgBSAAEVEACxEAIAEgAiADIAQgBSAAETkACxMAIAEgAiADIAQgBSAGIAARMgALEwAgASACIAMgBCAFIAYgABFaAAsVACABIAIgAyAEIAUgBiAHIAARUAALEwAgASACIAMgBCAFIAYgABEtAAsVACABIAIgAyAEIAUgBiAHIAARVQALEwAgASACIAMgBCAFIAYgABFbAAsVACABIAIgAyAEIAUgBiAHIAARUwALFwAgASACIAMgBCAFIAYgByAIIAARXQALGQAgASACIAMgBCAFIAYgByAIIAkgABFWAAsNACABIAIgAyAAEVcACw8AIAEgAiADIAQgABFKAAsTACABIAIgAyAEIAUgBiAAESoACxUAIAEgAiADIAQgBSAGIAcgABFNAAsPACABIAIgAyAEIAARHwALEQAgASACIAMgBCAFIAARKQALDQAgASACIAMgABEhAAsPACABIAIgAyAEIAARMwALEQAgASACIAMgBCAFIAARCgALDQAgASACIAMgABFEAAsPACABIAIgAyAEIAARQwALCQAgASAAEScACwsAIAEgAiAAESgACw8AIAEgAiADIAQgABFGAAsRACABIAIgAyAEIAUgABFHAAsTACABIAIgAyAEIAUgBiAAETAACxUAIAEgAiADIAQgBSAGIAcgABEvAAsNACABIAIgAyAAEV8ACw8AIAEgAiADIAQgABExAAsPACABIAIgAyAEIAARZAALEQAgASACIAMgBCAFIAARKwALEwAgASACIAMgBCAFIAYgABFPAAsTACABIAIgAyAEIAUgBiAAEVwACxUAIAEgAiADIAQgBSAGIAcgABFUAAsRACABIAIgAyAEIAUgABEsAAsTACABIAIgAyAEIAUgBiAAEVIACwsAIAEgAiAAEWYACxMAIAEgAiADIAQgBSAGIAARRQALEQAgASACIAMgBCAFIAARBgALFwAgASACIAMgBCAFIAYgByAIIAARDgALEwAgASACIAMgBCAFIAYgABEJAAsRACABIAIgAyAEIAUgABElAAsVACABIAIgAyAEIAUgBiAHIAAREgALEwAgASACIAMgBCAFIAYgABENAAsHACAAEQcACxkAIAEgAiADrSAErUIghoQgBSAGIAARIwALIgEBfiABIAKtIAOtQiCGhCAEIAARHAAiBUIgiKcQKSAFpwsZACABIAIgAyAEIAWtIAatQiCGhCAAESIACyMAIAEgAiADIAQgBa0gBq1CIIaEIAetIAitQiCGhCAAEUEACyUAIAEgAiADIAQgBSAGrSAHrUIghoQgCK0gCa1CIIaEIAARQAALC8bmAVEAQYAIC6AQVmVjdG9ySW50AFZlY3RvckRvdWJsZQBWZWN0b3JDaGFyAFZlY3RvclVDaGFyAFZlY3RvckZsb2F0AHZlY3RvclRvb2xzAGNsZWFyVmVjdG9yRGJsAGNsZWFyVmVjdG9yRmxvYXQAbWF4aVNldHRpbmdzAHNldHVwAG1heGlFbnZlbG9wZQBsaW5lAHRyaWdnZXIAYW1wbGl0dWRlAHZhbGluZGV4AG1heGlEZWxheWxpbmUAZGwAbWF4aU1peABzdGVyZW8AcXVhZABhbWJpc29uaWMAbWF4aUxpbmUAcGxheQBwcmVwYXJlAHRyaWdnZXJFbmFibGUAaXNMaW5lQ29tcGxldGUAbWF4aVhGYWRlAHhmYWRlAG1heGlMYWdFeHAAaW5pdABhZGRTYW1wbGUAdmFsdWUAYWxwaGEAYWxwaGFSZWNpcHJvY2FsAHZhbABtYXhpU2FtcGxlAGdldExlbmd0aABzZXRTYW1wbGUAc2V0U2FtcGxlRnJvbU9nZ0Jsb2IAaXNSZWFkeQBwbGF5T25jZQBwbGF5T25aWABwbGF5NABjbGVhcgBub3JtYWxpc2UAYXV0b1RyaW0AbG9hZAByZWFkAGxvb3BTZXRQb3NPblpYAG1heGlEeW4AZ2F0ZQBjb21wcmVzc29yAGNvbXByZXNzAHNldEF0dGFjawBzZXRSZWxlYXNlAHNldFRocmVzaG9sZABzZXRSYXRpbwBtYXhpRW52AGFyAGFkc3IAc2V0RGVjYXkAc2V0U3VzdGFpbgBjb252ZXJ0AG10b2YAbXNUb1NhbXBzAG1heGlTYW1wbGVBbmRIb2xkAHNhaABtYXhpRmxhbmdlcgBmbGFuZ2UAbWF4aUNob3J1cwBjaG9ydXMAbWF4aURDQmxvY2tlcgBtYXhpU1ZGAHNldEN1dG9mZgBzZXRSZXNvbmFuY2UAbWF4aU1hdGgAYWRkAHN1YgBtdWwAZGl2AGd0AGx0AGd0ZQBsdGUAbW9kAGFicwBwb3cAbWF4aUNsb2NrAHRpY2tlcgBzZXRUZW1wbwBzZXRUaWNrc1BlckJlYXQAaXNUaWNrAGN1cnJlbnRDb3VudABwbGF5SGVhZABicHMAYnBtAHRpY2sAdGlja3MAbWF4aUt1cmFtb3RvT3NjaWxsYXRvcgBzZXRQaGFzZQBnZXRQaGFzZQBtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0AHNldFBoYXNlcwBzaXplAG1heGlBc3luY0t1cmFtb3RvT3NjaWxsYXRvcgBtYXhpRkZUAHByb2Nlc3MAc3BlY3RyYWxGbGF0bmVzcwBzcGVjdHJhbENlbnRyb2lkAGdldE1hZ25pdHVkZXMAZ2V0TWFnbml0dWRlc0RCAGdldFBoYXNlcwBnZXROdW1CaW5zAGdldEZGVFNpemUAZ2V0SG9wU2l6ZQBnZXRXaW5kb3dTaXplAG1heGlGRlRNb2RlcwBXSVRIX1BPTEFSX0NPTlZFUlNJT04ATk9fUE9MQVJfQ09OVkVSU0lPTgBtYXhpSUZGVABtYXhpSUZGVE1vZGVzAFNQRUNUUlVNAENPTVBMRVgAbWF4aU1GQ0MAbWZjYwBtYXhpVGltZVN0cmV0Y2gAc2hhcmVkX3B0cjxtYXhpVGltZXN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4AZ2V0Tm9ybWFsaXNlZFBvc2l0aW9uAGdldFBvc2l0aW9uAHNldFBvc2l0aW9uAHBsYXlBdFBvc2l0aW9uAG1heGlQaXRjaFNoaWZ0AHNoYXJlZF9wdHI8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4AbWF4aVN0cmV0Y2gAc2V0TG9vcFN0YXJ0AHNldExvb3BFbmQAZ2V0TG9vcEVuZABtYXhpQml0cwBzaWcAYXQAc2hsAHNocgByAGxhbmQAbG9yAGx4b3IAbmVnAGluYwBkZWMAZXEAbm9pc2UAdG9TaWduYWwAdG9UcmlnU2lnbmFsAGZyb21TaWduYWwAbWF4aUNvdW50ZXIAY291bnQAbWF4aUluZGV4AHB1bGwAbWF4aVNhdFJldmVyYgBtYXhpRnJlZVZlcmIAYWxsb2NhdG9yPFQ+OjphbGxvY2F0ZShzaXplX3QgbikgJ24nIGV4Y2VlZHMgbWF4aW11bSBzdXBwb3J0ZWQgc2l6ZQBwdXNoX2JhY2sAcmVzaXplAGdldABzZXQATlN0M19fMjZ2ZWN0b3JJaU5TXzlhbGxvY2F0b3JJaUVFRUUATlN0M19fMjEzX192ZWN0b3JfYmFzZUlpTlNfOWFsbG9jYXRvcklpRUVFRQBOU3QzX18yMjBfX3ZlY3Rvcl9iYXNlX2NvbW1vbklMYjFFRUUALHcAAOMKAACwdwAAtwoAAAAAAAABAAAACAsAAAAAAACwdwAAkwoAAAAAAAABAAAAEAsAAAAAAABQTlN0M19fMjZ2ZWN0b3JJaU5TXzlhbGxvY2F0b3JJaUVFRUUAAAAADHgAAEALAAAAAAAAKAsAAFBLTlN0M19fMjZ2ZWN0b3JJaU5TXzlhbGxvY2F0b3JJaUVFRUUAAAAMeAAAeAsAAAEAAAAoCwAAaWkAdgB2aQBoCwAANHYAAGgLAACUdgAAdmlpaQAAAAA0dgAAaAsAALh2AACUdgAAdmlpaWkAAAC4dgAAoAsAAGlpaQAUDAAAKAsAALh2AABOMTBlbXNjcmlwdGVuM3ZhbEUAACx3AAAADAAAaWlpaQBBsBgL5gRMdgAAKAsAALh2AACUdgAAaWlpaWkATlN0M19fMjZ2ZWN0b3JJZE5TXzlhbGxvY2F0b3JJZEVFRUUATlN0M19fMjEzX192ZWN0b3JfYmFzZUlkTlNfOWFsbG9jYXRvcklkRUVFRQAAALB3AABqDAAAAAAAAAEAAAAICwAAAAAAALB3AABGDAAAAAAAAAEAAACYDAAAAAAAAFBOU3QzX18yNnZlY3RvcklkTlNfOWFsbG9jYXRvcklkRUVFRQAAAAAMeAAAyAwAAAAAAACwDAAAUEtOU3QzX18yNnZlY3RvcklkTlNfOWFsbG9jYXRvcklkRUVFRQAAAAx4AAAADQAAAQAAALAMAADwDAAANHYAAPAMAADQdgAAdmlpZAAAAAA0dgAA8AwAALh2AADQdgAAdmlpaWQAAAC4dgAAKA0AABQMAACwDAAAuHYAAAAAAABMdgAAsAwAALh2AADQdgAAaWlpaWQATlN0M19fMjZ2ZWN0b3JJY05TXzlhbGxvY2F0b3JJY0VFRUUATlN0M19fMjEzX192ZWN0b3JfYmFzZUljTlNfOWFsbG9jYXRvckljRUVFRQAAALB3AAC6DQAAAAAAAAEAAAAICwAAAAAAALB3AACWDQAAAAAAAAEAAADoDQAAAAAAAFBOU3QzX18yNnZlY3RvckljTlNfOWFsbG9jYXRvckljRUVFRQAAAAAMeAAAGA4AAAAAAAAADgAAUEtOU3QzX18yNnZlY3RvckljTlNfOWFsbG9jYXRvckljRUVFRQAAAAx4AABQDgAAAQAAAAAOAABADgAANHYAAEAOAABYdgBBoB0LIjR2AABADgAAuHYAAFh2AAC4dgAAeA4AABQMAAAADgAAuHYAQdAdC7ICTHYAAAAOAAC4dgAAWHYAAE5TdDNfXzI2dmVjdG9ySWhOU185YWxsb2NhdG9ySWhFRUVFAE5TdDNfXzIxM19fdmVjdG9yX2Jhc2VJaE5TXzlhbGxvY2F0b3JJaEVFRUUAsHcAAAQPAAAAAAAAAQAAAAgLAAAAAAAAsHcAAOAOAAAAAAAAAQAAADAPAAAAAAAAUE5TdDNfXzI2dmVjdG9ySWhOU185YWxsb2NhdG9ySWhFRUVFAAAAAAx4AABgDwAAAAAAAEgPAABQS05TdDNfXzI2dmVjdG9ySWhOU185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ALAMAAAkIQAAiBAAADE1bWF4aVRpbWVTdHJldGNoSTE0aGFubldpbkZ1bmN0b3JFACx3AACUIQAAUDE1bWF4aVRpbWVTdHJldGNoSTE0aGFubldpbkZ1bmN0b3JFAAAAAAx4AADAIQAAAAAAALghAABQSzE1bWF4aVRpbWVTdHJldGNoSTE0aGFubldpbkZ1bmN0b3JFAAAADHgAAPghAAABAAAAuCEAAAAAAADoIgAA8AEAAPEBAADyAQAA8wEAAPQBAABOU3QzX18yMjBfX3NoYXJlZF9wdHJfcG9pbnRlcklQMTVtYXhpVGltZVN0cmV0Y2hJMTRoYW5uV2luRnVuY3RvckVOMTBlbXNjcmlwdGVuMTVzbWFydF9wdHJfdHJhaXRJTlNfMTBzaGFyZWRfcHRySVMzX0VFRTExdmFsX2RlbGV0ZXJFTlNfOWFsbG9jYXRvcklTM19FRUVFAABUdwAATCIAAHRzAABOMTBlbXNjcmlwdGVuMTVzbWFydF9wdHJfdHJhaXRJTlN0M19fMjEwc2hhcmVkX3B0ckkxNW1heGlUaW1lU3RyZXRjaEkxNGhhbm5XaW5GdW5jdG9yRUVFRTExdmFsX2RlbGV0ZXJFAE5TdDNfXzIxMHNoYXJlZF9wdHJJMTVtYXhpVGltZVN0cmV0Y2hJMTRoYW5uV2luRnVuY3RvckVFRQAAACx3AABcIwAAaQAAAJgjAAAAAAAAHCQAAPUBAAD2AQAA9wEAAPgBAAD5AQAATlN0M19fMjIwX19zaGFyZWRfcHRyX2VtcGxhY2VJMTVtYXhpVGltZVN0cmV0Y2hJMTRoYW5uV2luRnVuY3RvckVOU185YWxsb2NhdG9ySVMzX0VFRUUAAFR3AADEIwAAdHMAADR2AADoIQAAJBYAANB2AADoIQAANHYAAOghAADQdgAAAAAAAJQkAAD6AQAA+wEAAPwBAAA5bWF4aUdyYWluSTE0aGFubldpbkZ1bmN0b3JFADEzbWF4aUdyYWluQmFzZQAAAAAsdwAAeSQAAFR3AABcJAAAjCQAANB2AADoIQAA0HYAANB2AACUdgAA0HYAAGRpaWRkaWQA0HYAAOghAADQdgAA0HYAAJR2AAAxNG1heGlQaXRjaFNoaWZ0STE0aGFubldpbkZ1bmN0b3JFAAAsdwAA1CQAAFAxNG1heGlQaXRjaFNoaWZ0STE0aGFubldpbkZ1bmN0b3JFAAx4AAAAJQAAAAAAAPgkAABQSzE0bWF4aVBpdGNoU2hpZnRJMTRoYW5uV2luRnVuY3RvckUAAAAADHgAADQlAAABAAAA+CQAAAAAAAAkJgAA/QEAAP4BAAD/AQAAAAIAAAECAABOU3QzX18yMjBfX3NoYXJlZF9wdHJfcG9pbnRlcklQMTRtYXhpUGl0Y2hTaGlmdEkxNGhhbm5XaW5GdW5jdG9yRU4xMGVtc2NyaXB0ZW4xNXNtYXJ0X3B0cl90cmFpdElOU18xMHNoYXJlZF9wdHJJUzNfRUVFMTF2YWxfZGVsZXRlckVOU185YWxsb2NhdG9ySVMzX0VFRUUAAABUdwAAiCUAAHRzAABOMTBlbXNjcmlwdGVuMTVzbWFydF9wdHJfdHJhaXRJTlN0M19fMjEwc2hhcmVkX3B0ckkxNG1heGlQaXRjaFNoaWZ0STE0aGFubldpbkZ1bmN0b3JFRUVFMTF2YWxfZGVsZXRlckUATlN0M19fMjEwc2hhcmVkX3B0ckkxNG1heGlQaXRjaFNoaWZ0STE0aGFubldpbkZ1bmN0b3JFRUUALHcAAJcmAADQJgAAAAAAAFAnAAACAgAAAwIAAAQCAAD4AQAABQIAAE5TdDNfXzIyMF9fc2hhcmVkX3B0cl9lbXBsYWNlSTE0bWF4aVBpdGNoU2hpZnRJMTRoYW5uV2luRnVuY3RvckVOU185YWxsb2NhdG9ySVMzX0VFRUUAAABUdwAA+CYAAHRzAAA0dgAAJCUAACQWAEHwzgAL0gHQdgAAJCUAANB2AADQdgAAlHYAANB2AAAxMW1heGlTdHJldGNoSTE0aGFubldpbkZ1bmN0b3JFACx3AACIJwAAUDExbWF4aVN0cmV0Y2hJMTRoYW5uV2luRnVuY3RvckUAAAAADHgAALAnAAAAAAAAqCcAAFBLMTFtYXhpU3RyZXRjaEkxNGhhbm5XaW5GdW5jdG9yRQAAAAx4AADkJwAAAQAAAKgnAADUJwAANHYAANQnAAAkFgAA0HYAANQnAAA0dgAA1CcAANB2AAC4dgAA1CcAQdDQAAsk0HYAANQnAADQdgAA0HYAANB2AACUdgAA0HYAAGRpaWRkZGlkAEGA0QALggLQdgAA1CcAANB2AADQdgAA0HYAAJR2AABkaWlk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aXN0cmVhbUl3TlNfMTFjaGFyX3RyYWl0c0l3RUVFRQAAsHcAAOxFAAAAAAAAAQAAACBFAAAD9P//TlN0M19fMjEzYmFzaWNfb3N0cmVhbUljTlNfMTFjaGFyX3RyYWl0c0ljRUVFRQAAsHcAADRGAAAAAAAAAQAAANhEAAAD9P//TlN0M19fMjEzYmFzaWNfb3N0cmVhbUl3TlNfMTFjaGFyX3RyYWl0c0l3RUVFRQAAsHcAAHxGAAAAAAAAAQAAACBFAAAD9P//mIQAAAAAAAAgRwAAKAIAAFMCAABUAgAAKwIAACwCAAAtAgAALgIAABYCAAAXAgAAVQIAAFYCAABXAgAAGwIAADECAABOU3QzX18yMTBfX3N0ZGluYnVmSWNFRQBUdwAACEcAAGBFAAB1bnN1cHBvcnRlZCBsb2NhbGUgZm9yIHN0YW5kYXJkIGlucHV0AAAAAAAAAKxHAAAyAgAAWAIAAFkCAAA1AgAANgIAADcCAAA4AgAAOQIAADoCAABaAgAAWwIAAFwCAAA+AgAAPwIAAE5TdDNfXzIxMF9fc3RkaW5idWZJd0VFAFR3AACURwAAnEUAAAAAAAAUSAAAKAIAAF0CAABeAgAAKwIAACwCAAAtAgAAXwIAABYCAAAXAgAALwIAABkCAAAwAgAAYAIAAGECAABOU3QzX18yMTFfX3N0ZG91dGJ1ZkljRUUAAAAAVHcAAPhHAABgRQAAAAAAAHxIAAAyAgAAYgIAAGMCAAA1AgAANgIAADcCAABkAgAAOQIAADoCAAA7AgAAPAIAAD0CAABlAgAAZgIAAE5TdDNfXzIxMV9fc3Rkb3V0YnVmSXdFRQAAAABUdwAAYEgAAJxFAEGQkQEL4wT/////////////////////////////////////////////////////////////////AAECAwQFBgcICf////////8KCwwNDg8QERITFBUWFxgZGhscHR4fICEiI////////woLDA0ODxAREhMUFRYXGBkaGxwdHh8gISIj/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////wABAgQHAwYFAAAAAAAAAAIAAMADAADABAAAwAUAAMAGAADABwAAwAgAAMAJAADACgAAwAsAAMAMAADADQAAwA4AAMAPAADAEAAAwBEAAMASAADAEwAAwBQAAMAVAADAFgAAwBcAAMAYAADAGQAAwBoAAMAbAADAHAAAwB0AAMAeAADAHwAAwAAAALMBAADDAgAAwwMAAMMEAADDBQAAwwYAAMMHAADDCAAAwwkAAMMKAADDCwAAwwwAAMMNAADTDgAAww8AAMMAAAy7AQAMwwIADMMDAAzDBAAM02luZmluaXR5AG5hbgAAAAAAAAAA0XSeAFedvSqAcFIP//8+JwoAAABkAAAA6AMAABAnAACghgEAQEIPAICWmAAA4fUFGAAAADUAAABxAAAAa////877//+Sv///AAAAAAAAAADeEgSVAAAAAP///////////////9BKAAAUAAAAQy5VVEYtOABBmJYBCwLkSgBBsJYBCwZMQ19BTEwAQcCWAQtuTENfQ1RZUEUAAAAATENfTlVNRVJJQwAATENfVElNRQAAAAAATENfQ09MTEFURQAATENfTU9ORVRBUlkATENfTUVTU0FHRVMATEFORwBDLlVURi04AFBPU0lYAE1VU0xfTE9DUEFUSAAAAAAAsEwAQbCZAQv/AQIAAgACAAIAAgACAAIAAgACAAMgAiACIAIgAiACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgABYATABMAEwATABMAEwATABMAEwATABMAEwATABMAEwAjYCNgI2AjYCNgI2AjYCNgI2AjYBMAEwATABMAEwATABMAI1QjVCNUI1QjVCNUIxQjFCMUIxQjFCMUIxQjFCMUIxQjFCMUIxQjFCMUIxQjFCMUIxQjFBMAEwATABMAEwATACNYI1gjWCNYI1gjWCMYIxgjGCMYIxgjGCMYIxgjGCMYIxgjGCMYIxgjGCMYIxgjGCMYIxgTABMAEwATAAgBBsJ0BCwLAUABBxKEBC/kDAQAAAAIAAAADAAAABAAAAAUAAAAGAAAABwAAAAgAAAAJAAAACgAAAAsAAAAMAAAADQAAAA4AAAAPAAAAEAAAABEAAAASAAAAEwAAABQAAAAVAAAAFgAAABcAAAAYAAAAGQAAABoAAAAbAAAAHAAA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AE4xMF9fY3h4YWJpdjExNl9fZW51bV90eXBlX2luZm9FAAAAAFR3AAD0dgAA1HQAAAAAAAAEdQAAaAMAAG8DAABqAwAAawMAAHADAABxAwAAcgMAAHMDAAAAAAAAnHcAAGgDAAB0AwAAagMAAGsDAABwAwAAdQMAAHYDAAB3AwAATjEwX19jeHhhYml2MTIwX19zaV9jbGFzc190eXBlX2luZm9FAAAAAFR3AAB0dwAABHUAAAAAAAD4dwAAaAMAAHgDAABqAwAAawMAAHADAAB5AwAAegMAAHsDAABOMTBfX2N4eGFiaXYxMjFfX3ZtaV9jbGFzc190eXBlX2luZm9FAAAAVHcAANB3AAAEdQAAAAAAAGR1AABoAwAAfAMAAGoDAABrAwAAfQMAAHZvaWQAYm9vbABjaGFyAHNpZ25lZCBjaGFyAHVuc2lnbmVkIGNoYXIAc2hvcnQAdW5zaWduZWQgc2hvcnQAaW50AHVuc2lnbmVkIGludABsb25nAHVuc2lnbmVkIGxvbmcAZmxvYXQAZG91YmxlAHN0ZDo6c3RyaW5nAHN0ZDo6YmFzaWNfc3RyaW5nPHVuc2lnbmVkIGNoYXI+AHN0ZDo6d3N0cmluZwBzdGQ6OnUxNnN0cmluZwBzdGQ6OnUzMnN0cmluZwBlbXNjcmlwdGVuOjp2YWwAZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8Y2hhcj4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8c2lnbmVkIGNoYXI+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHVuc2lnbmVkIGNoYXI+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHNob3J0PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzx1bnNpZ25lZCBzaG9ydD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8aW50PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzx1bnNpZ25lZCBpbnQ+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PGxvbmc+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHVuc2lnbmVkIGxvbmc+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PGludDhfdD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8dWludDhfdD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8aW50MTZfdD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8dWludDE2X3Q+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PGludDMyX3Q+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHVpbnQzMl90PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxmbG9hdD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8ZG91YmxlPgBOU3QzX18yMTJiYXNpY19zdHJpbmdJaE5TXzExY2hhcl90cmFpdHNJaEVFTlNfOWFsbG9jYXRvckloRUVFRQAAAACwdwAANnsAAAAAAAABAAAAmBcAAAAAAABOU3QzX18yMTJiYXNpY19zdHJpbmdJd05TXzExY2hhcl90cmFpdHNJd0VFTlNfOWFsbG9jYXRvckl3RUVFRQAAsHcAAJB7AAAAAAAAAQAAAJgXAAAAAAAATlN0M19fMjEyYmFzaWNfc3RyaW5nSURzTlNfMTFjaGFyX3RyYWl0c0lEc0VFTlNfOWFsbG9jYXRvcklEc0VFRUUAAACwdwAA6HsAAAAAAAABAAAAmBcAAAAAAABOU3QzX18yMTJiYXNpY19zdHJpbmdJRGlOU18xMWNoYXJfdHJhaXRzSURpRUVOU185YWxsb2NhdG9ySURpRUVFRQAAALB3AABEfAAAAAAAAAEAAACYFwAAAAAAAE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SWNFRQAALHcAAKB8AABOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0lhRUUAACx3AADIfAAATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJaEVFAAAsdwAA8HwAAE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SXNFRQAALHcAABh9AABOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0l0RUUAACx3AABAfQAATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJaUVFAAAsdwAAaH0AAE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SWpFRQAALHcAAJB9AABOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0lsRUUAACx3AAC4fQAATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJ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YXNpX2ZkX3JlYWQYD19fd2FzaV9mZF93cml0ZRkYX193YXNpX2Vudmlyb25fc2l6ZXNfZ2V0GhJfX3dhc2lfZW52aXJvbl9nZXQbCl9fbWFwX2ZpbGUcC19fc3lzY2FsbDkxHQpzdHJmdGltZV9sHgVhYm9ydB8VX2VtYmluZF9yZWdpc3Rlcl92b2lkIBVfZW1iaW5kX3JlZ2lzdGVyX2Jvb2whG19lbWJpbmRfcmVnaXN0ZXJfc3RkX3N0cmluZyIcX2VtYmluZF9yZWdpc3Rlcl9zdGRfd3N0cmluZyMWX2VtYmluZF9yZWdpc3Rlcl9lbXZhbCQYX2VtYmluZF9yZWdpc3Rlcl9pbnRlZ2VyJRZfZW1iaW5kX3JlZ2lzdGVyX2Zsb2F0JhxfZW1iaW5kX3JlZ2lzdGVyX21lbW9yeV92aWV3JxZlbXNjcmlwdGVuX3Jlc2l6ZV9oZWFwKBVlbXNjcmlwdGVuX21lbWNweV9iaWcpC3NldFRlbXBSZXQwKhpsZWdhbGltcG9ydCRfX3dhc2lfZmRfc2VlaysRX193YXNtX2NhbGxfY3RvcnMsUEVtc2NyaXB0ZW5CaW5kaW5nSW5pdGlhbGl6ZXJfbXlfbW9kdWxlOjpFbXNjcmlwdGVuQmluZGluZ0luaXRpYWxpemVyX215X21vZHVsZSgpLZUBZW1zY3JpcHRlbjo6Y2xhc3NfPHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiwgZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok5vQmFzZUNsYXNzPiBlbXNjcmlwdGVuOjpyZWdpc3Rlcl92ZWN0b3I8aW50PihjaGFyIGNvbnN0KikungFlbXNjcmlwdGVuOjpjbGFzc188c3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+LCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Tm9CYXNlQ2xhc3M+IGVtc2NyaXB0ZW46OnJlZ2lzdGVyX3ZlY3Rvcjxkb3VibGU+KGNoYXIgY29uc3QqKS+YAWVtc2NyaXB0ZW46OmNsYXNzXzxzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiwgZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok5vQmFzZUNsYXNzPiBlbXNjcmlwdGVuOjpyZWdpc3Rlcl92ZWN0b3I8Y2hhcj4oY2hhciBjb25zdCopMLMBZW1zY3JpcHRlbjo6Y2xhc3NfPHN0ZDo6X18yOjp2ZWN0b3I8dW5zaWduZWQgY2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjx1bnNpZ25lZCBjaGFyPiA+LCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Tm9CYXNlQ2xhc3M+IGVtc2NyaXB0ZW46OnJlZ2lzdGVyX3ZlY3Rvcjx1bnNpZ25lZCBjaGFyPihjaGFyIGNvbnN0KikxmwFlbXNjcmlwdGVuOjpjbGFzc188c3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiwgZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok5vQmFzZUNsYXNzPiBlbXNjcmlwdGVuOjpyZWdpc3Rlcl92ZWN0b3I8ZmxvYXQ+KGNoYXIgY29uc3QqKTJKdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8dmVjdG9yVG9vbHM+KHZlY3RvclRvb2xzKikzRHZvaWQgZW1zY3JpcHRlbjo6aW50ZXJuYWw6OnJhd19kZXN0cnVjdG9yPHZlY3RvclRvb2xzPih2ZWN0b3JUb29scyopNEdlbXNjcmlwdGVuOjppbnRlcm5hbDo6SW52b2tlcjx2ZWN0b3JUb29scyo+OjppbnZva2UodmVjdG9yVG9vbHMqICgqKSgpKTU+dmVjdG9yVG9vbHMqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8dmVjdG9yVG9vbHM+KCk24AFlbXNjcmlwdGVuOjppbnRlcm5hbDo6SW52b2tlcjx2b2lkLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mPjo6aW52b2tlKHZvaWQgKCopKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYpLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4qKTdUdmVjdG9yVG9vbHM6OmNsZWFyVmVjdG9yRGJsKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYpOEx2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpU2V0dGluZ3M+KG1heGlTZXR0aW5ncyopOWJlbXNjcmlwdGVuOjppbnRlcm5hbDo6SW52b2tlcjx2b2lkLCBpbnQsIGludCwgaW50Pjo6aW52b2tlKHZvaWQgKCopKGludCwgaW50LCBpbnQpLCBpbnQsIGludCwgaW50KToibWF4aVNldHRpbmdzOjpzZXR1cChpbnQsIGludCwgaW50KTtMdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aUVudmVsb3BlPihtYXhpRW52ZWxvcGUqKTxAbWF4aUVudmVsb3BlKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlFbnZlbG9wZT4oKT2EA2Vtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aUVudmVsb3BlOjoqKShpbnQsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYpLCBkb3VibGUsIG1heGlFbnZlbG9wZSosIGludCwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+Jj46Omludm9rZShkb3VibGUgKG1heGlFbnZlbG9wZTo6KiBjb25zdCYpKGludCwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiksIG1heGlFbnZlbG9wZSosIGludCwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+Kik+ugFlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChtYXhpRW52ZWxvcGU6OiopKGludCwgZG91YmxlKSwgdm9pZCwgbWF4aUVudmVsb3BlKiwgaW50LCBkb3VibGU+OjppbnZva2Uodm9pZCAobWF4aUVudmVsb3BlOjoqIGNvbnN0JikoaW50LCBkb3VibGUpLCBtYXhpRW52ZWxvcGUqLCBpbnQsIGRvdWJsZSk/Im1heGlFbnZlbG9wZTo6Z2V0QW1wbGl0dWRlKCkgY29uc3RAIm1heGlFbnZlbG9wZTo6c2V0QW1wbGl0dWRlKGRvdWJsZSlBnAFkb3VibGUgZW1zY3JpcHRlbjo6aW50ZXJuYWw6OkdldHRlclBvbGljeTxkb3VibGUgKG1heGlFbnZlbG9wZTo6KikoKSBjb25zdD46OmdldDxtYXhpRW52ZWxvcGU+KGRvdWJsZSAobWF4aUVudmVsb3BlOjoqIGNvbnN0JikoKSBjb25zdCwgbWF4aUVudmVsb3BlIGNvbnN0JilCmAF2b2lkIGVtc2NyaXB0ZW46OmludGVybmFsOjpTZXR0ZXJQb2xpY3k8dm9pZCAobWF4aUVudmVsb3BlOjoqKShkb3VibGUpPjo6c2V0PG1heGlFbnZlbG9wZT4odm9pZCAobWF4aUVudmVsb3BlOjoqIGNvbnN0JikoZG91YmxlKSwgbWF4aUVudmVsb3BlJiwgZG91YmxlKUMhbWF4aUVudmVsb3BlOjpnZXRWYWxpbmRleCgpIGNvbnN0RB5tYXhpRW52ZWxvcGU6OnNldFZhbGluZGV4KGludClFkwFpbnQgZW1zY3JpcHRlbjo6aW50ZXJuYWw6OkdldHRlclBvbGljeTxpbnQgKG1heGlFbnZlbG9wZTo6KikoKSBjb25zdD46OmdldDxtYXhpRW52ZWxvcGU+KGludCAobWF4aUVudmVsb3BlOjoqIGNvbnN0JikoKSBjb25zdCwgbWF4aUVudmVsb3BlIGNvbnN0JilGjwF2b2lkIGVtc2NyaXB0ZW46OmludGVybmFsOjpTZXR0ZXJQb2xpY3k8dm9pZCAobWF4aUVudmVsb3BlOjoqKShpbnQpPjo6c2V0PG1heGlFbnZlbG9wZT4odm9pZCAobWF4aUVudmVsb3BlOjoqIGNvbnN0JikoaW50KSwgbWF4aUVudmVsb3BlJiwgaW50KUdOdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aURlbGF5bGluZT4obWF4aURlbGF5bGluZSopSEJtYXhpRGVsYXlsaW5lKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlEZWxheWxpbmU+KClJ5AFlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlEZWxheWxpbmU6OiopKGRvdWJsZSwgaW50LCBkb3VibGUpLCBkb3VibGUsIG1heGlEZWxheWxpbmUqLCBkb3VibGUsIGludCwgZG91YmxlPjo6aW52b2tlKGRvdWJsZSAobWF4aURlbGF5bGluZTo6KiBjb25zdCYpKGRvdWJsZSwgaW50LCBkb3VibGUpLCBtYXhpRGVsYXlsaW5lKiwgZG91YmxlLCBpbnQsIGRvdWJsZSlK+AFlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlEZWxheWxpbmU6OiopKGRvdWJsZSwgaW50LCBkb3VibGUsIGludCksIGRvdWJsZSwgbWF4aURlbGF5bGluZSosIGRvdWJsZSwgaW50LCBkb3VibGUsIGludD46Omludm9rZShkb3VibGUgKG1heGlEZWxheWxpbmU6OiogY29uc3QmKShkb3VibGUsIGludCwgZG91YmxlLCBpbnQpLCBtYXhpRGVsYXlsaW5lKiwgZG91YmxlLCBpbnQsIGRvdWJsZSwgaW50KUtCdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aU1peD4obWF4aU1peCopTDZtYXhpTWl4KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlNaXg+KClNlgNlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChtYXhpTWl4OjoqKShkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGRvdWJsZSksIHZvaWQsIG1heGlNaXgqLCBkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGRvdWJsZT46Omludm9rZSh2b2lkIChtYXhpTWl4OjoqIGNvbnN0JikoZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBkb3VibGUpLCBtYXhpTWl4KiwgZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4qLCBkb3VibGUpTrYDZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAobWF4aU1peDo6KikoZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBkb3VibGUsIGRvdWJsZSksIHZvaWQsIG1heGlNaXgqLCBkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGRvdWJsZSwgZG91YmxlPjo6aW52b2tlKHZvaWQgKG1heGlNaXg6OiogY29uc3QmKShkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGRvdWJsZSwgZG91YmxlKSwgbWF4aU1peCosIGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KiwgZG91YmxlLCBkb3VibGUpT9YDZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAobWF4aU1peDo6KikoZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKSwgdm9pZCwgbWF4aU1peCosIGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZT46Omludm9rZSh2b2lkIChtYXhpTWl4OjoqIGNvbnN0JikoZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKSwgbWF4aU1peCosIGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSlQRHZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlMaW5lPihtYXhpTGluZSopUThtYXhpTGluZSogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpTGluZT4oKVIWbWF4aUxpbmU6OnBsYXkoZG91YmxlKVOcAWVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aUxpbmU6OiopKGRvdWJsZSksIGRvdWJsZSwgbWF4aUxpbmUqLCBkb3VibGU+OjppbnZva2UoZG91YmxlIChtYXhpTGluZTo6KiBjb25zdCYpKGRvdWJsZSksIG1heGlMaW5lKiwgZG91YmxlKVQvbWF4aUxpbmU6OnByZXBhcmUoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgYm9vbClV7gFlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChtYXhpTGluZTo6KikoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgYm9vbCksIHZvaWQsIG1heGlMaW5lKiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgYm9vbD46Omludm9rZSh2b2lkIChtYXhpTGluZTo6KiBjb25zdCYpKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGJvb2wpLCBtYXhpTGluZSosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGJvb2wpVh9tYXhpTGluZTo6dHJpZ2dlckVuYWJsZShkb3VibGUpVxptYXhpTGluZTo6aXNMaW5lQ29tcGxldGUoKVhGdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aVhGYWRlPihtYXhpWEZhZGUqKVmHBGVtc2NyaXB0ZW46OmludGVybmFsOjpJbnZva2VyPHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+Jiwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgZG91YmxlPjo6aW52b2tlKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiAoKikoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+Jiwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgZG91YmxlKSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+Kiwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KiwgZG91YmxlKVqKAW1heGlYRmFkZTo6eGZhZGUoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+Jiwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgZG91YmxlKVuBAWVtc2NyaXB0ZW46OmludGVybmFsOjpJbnZva2VyPGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZT46Omludm9rZShkb3VibGUgKCopKGRvdWJsZSwgZG91YmxlLCBkb3VibGUpLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKVwobWF4aVhGYWRlOjp4ZmFkZShkb3VibGUsIGRvdWJsZSwgZG91YmxlKV1Zdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aUxhZ0V4cDxkb3VibGU+ID4obWF4aUxhZ0V4cDxkb3VibGU+KileTW1heGlMYWdFeHA8ZG91YmxlPiogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpTGFnRXhwPGRvdWJsZT4gPigpXyhtYXhpTGFnRXhwPGRvdWJsZT46OmluaXQoZG91YmxlLCBkb3VibGUpYN4BZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAobWF4aUxhZ0V4cDxkb3VibGU+OjoqKShkb3VibGUsIGRvdWJsZSksIHZvaWQsIG1heGlMYWdFeHA8ZG91YmxlPiosIGRvdWJsZSwgZG91YmxlPjo6aW52b2tlKHZvaWQgKG1heGlMYWdFeHA8ZG91YmxlPjo6KiBjb25zdCYpKGRvdWJsZSwgZG91YmxlKSwgbWF4aUxhZ0V4cDxkb3VibGU+KiwgZG91YmxlLCBkb3VibGUpYSVtYXhpTGFnRXhwPGRvdWJsZT46OmFkZFNhbXBsZShkb3VibGUpYiFtYXhpTGFnRXhwPGRvdWJsZT46OnZhbHVlKCkgY29uc3RjJG1heGlMYWdFeHA8ZG91YmxlPjo6Z2V0QWxwaGEoKSBjb25zdGQkbWF4aUxhZ0V4cDxkb3VibGU+OjpzZXRBbHBoYShkb3VibGUpZS5tYXhpTGFnRXhwPGRvdWJsZT46OmdldEFscGhhUmVjaXByb2NhbCgpIGNvbnN0Zi5tYXhpTGFnRXhwPGRvdWJsZT46OnNldEFscGhhUmVjaXByb2NhbChkb3VibGUpZyJtYXhpTGFnRXhwPGRvdWJsZT46OnNldFZhbChkb3VibGUpaEh2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpU2FtcGxlPihtYXhpU2FtcGxlKilpQnZvaWQgZW1zY3JpcHRlbjo6aW50ZXJuYWw6OnJhd19kZXN0cnVjdG9yPG1heGlTYW1wbGU+KG1heGlTYW1wbGUqKWo8bWF4aVNhbXBsZSogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpU2FtcGxlPigpax1tYXhpU2FtcGxlOjpnZXRMZW5ndGgoKSBjb25zdGz2AmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKG1heGlTYW1wbGU6OiopKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGludCksIHZvaWQsIG1heGlTYW1wbGUqLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBpbnQ+OjppbnZva2Uodm9pZCAobWF4aVNhbXBsZTo6KiBjb25zdCYpKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGludCksIG1heGlTYW1wbGUqLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4qLCBpbnQpbasDZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8aW50IChtYXhpU2FtcGxlOjoqKShzdGQ6Ol9fMjo6dmVjdG9yPHVuc2lnbmVkIGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8dW5zaWduZWQgY2hhcj4gPiYsIGludCksIGludCwgbWF4aVNhbXBsZSosIHN0ZDo6X18yOjp2ZWN0b3I8dW5zaWduZWQgY2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjx1bnNpZ25lZCBjaGFyPiA+JiwgaW50Pjo6aW52b2tlKGludCAobWF4aVNhbXBsZTo6KiBjb25zdCYpKHN0ZDo6X18yOjp2ZWN0b3I8dW5zaWduZWQgY2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjx1bnNpZ25lZCBjaGFyPiA+JiwgaW50KSwgbWF4aVNhbXBsZSosIHN0ZDo6X18yOjp2ZWN0b3I8dW5zaWduZWQgY2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjx1bnNpZ25lZCBjaGFyPiA+KiwgaW50KW7EAWVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aVNhbXBsZTo6KikoZG91YmxlLCBkb3VibGUpLCBkb3VibGUsIG1heGlTYW1wbGUqLCBkb3VibGUsIGRvdWJsZT46Omludm9rZShkb3VibGUgKG1heGlTYW1wbGU6OiogY29uc3QmKShkb3VibGUsIGRvdWJsZSksIG1heGlTYW1wbGUqLCBkb3VibGUsIGRvdWJsZSlv5AFlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlTYW1wbGU6OiopKGRvdWJsZSwgZG91YmxlLCBkb3VibGUpLCBkb3VibGUsIG1heGlTYW1wbGUqLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlPjo6aW52b2tlKGRvdWJsZSAobWF4aVNhbXBsZTo6KiBjb25zdCYpKGRvdWJsZSwgZG91YmxlLCBkb3VibGUpLCBtYXhpU2FtcGxlKiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSlwggFlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChtYXhpU2FtcGxlOjoqKSgpLCB2b2lkLCBtYXhpU2FtcGxlKj46Omludm9rZSh2b2lkIChtYXhpU2FtcGxlOjoqIGNvbnN0JikoKSwgbWF4aVNhbXBsZSopcRNtYXhpU2FtcGxlOjpjbGVhcigpcuYBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAobWF4aVNhbXBsZTo6KikoZmxvYXQsIGZsb2F0LCBib29sLCBib29sKSwgdm9pZCwgbWF4aVNhbXBsZSosIGZsb2F0LCBmbG9hdCwgYm9vbCwgYm9vbD46Omludm9rZSh2b2lkIChtYXhpU2FtcGxlOjoqIGNvbnN0JikoZmxvYXQsIGZsb2F0LCBib29sLCBib29sKSwgbWF4aVNhbXBsZSosIGZsb2F0LCBmbG9hdCwgYm9vbCwgYm9vbClzowRlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxib29sIChtYXhpU2FtcGxlOjoqKShzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+LCBpbnQpLCBib29sLCBtYXhpU2FtcGxlKiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiwgaW50Pjo6aW52b2tlKGJvb2wgKG1heGlTYW1wbGU6OiogY29uc3QmKShzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+LCBpbnQpLCBtYXhpU2FtcGxlKiwgZW1zY3JpcHRlbjo6aW50ZXJuYWw6OkJpbmRpbmdUeXBlPHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4sIHZvaWQ+OjondW5uYW1lZCcqLCBpbnQpdEJ2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpRHluPihtYXhpRHluKil1Nm1heGlEeW4qIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aUR5bj4oKXaQAmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aUR5bjo6KikoZG91YmxlLCBkb3VibGUsIGxvbmcsIGRvdWJsZSwgZG91YmxlKSwgZG91YmxlLCBtYXhpRHluKiwgZG91YmxlLCBkb3VibGUsIGxvbmcsIGRvdWJsZSwgZG91YmxlPjo6aW52b2tlKGRvdWJsZSAobWF4aUR5bjo6KiBjb25zdCYpKGRvdWJsZSwgZG91YmxlLCBsb25nLCBkb3VibGUsIGRvdWJsZSksIG1heGlEeW4qLCBkb3VibGUsIGRvdWJsZSwgbG9uZywgZG91YmxlLCBkb3VibGUpd5gCZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpRHluOjoqKShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSksIGRvdWJsZSwgbWF4aUR5biosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlPjo6aW52b2tlKGRvdWJsZSAobWF4aUR5bjo6KiBjb25zdCYpKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKSwgbWF4aUR5biosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKXhCdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aUVudj4obWF4aUVudiopeTZtYXhpRW52KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlFbnY+KCl6hAJlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlFbnY6OiopKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGxvbmcsIGludCksIGRvdWJsZSwgbWF4aUVudiosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGxvbmcsIGludD46Omludm9rZShkb3VibGUgKG1heGlFbnY6OiogY29uc3QmKShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBsb25nLCBpbnQpLCBtYXhpRW52KiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgbG9uZywgaW50KXvEAmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aUVudjo6KikoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGxvbmcsIGludCksIGRvdWJsZSwgbWF4aUVudiosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBsb25nLCBpbnQ+OjppbnZva2UoZG91YmxlIChtYXhpRW52OjoqIGNvbnN0JikoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGxvbmcsIGludCksIG1heGlFbnYqLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgbG9uZywgaW50KXysAWVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aUVudjo6KikoZG91YmxlLCBpbnQpLCBkb3VibGUsIG1heGlFbnYqLCBkb3VibGUsIGludD46Omludm9rZShkb3VibGUgKG1heGlFbnY6OiogY29uc3QmKShkb3VibGUsIGludCksIG1heGlFbnYqLCBkb3VibGUsIGludCl9G21heGlFbnY6OmdldFRyaWdnZXIoKSBjb25zdH4YbWF4aUVudjo6c2V0VHJpZ2dlcihpbnQpf0J2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxjb252ZXJ0Pihjb252ZXJ0KimAAWJlbXNjcmlwdGVuOjppbnRlcm5hbDo6RnVuY3Rpb25JbnZva2VyPGRvdWJsZSAoKikoaW50KSwgZG91YmxlLCBpbnQ+OjppbnZva2UoZG91YmxlICgqKikoaW50KSwgaW50KYEBSGVtc2NyaXB0ZW46OmludGVybmFsOjpJbnZva2VyPGRvdWJsZSwgaW50Pjo6aW52b2tlKGRvdWJsZSAoKikoaW50KSwgaW50KYIBGmNvbnZlcnQ6Om1zVG9TYW1wcyhkb3VibGUpgwFuZW1zY3JpcHRlbjo6aW50ZXJuYWw6OkZ1bmN0aW9uSW52b2tlcjxkb3VibGUgKCopKGRvdWJsZSksIGRvdWJsZSwgZG91YmxlPjo6aW52b2tlKGRvdWJsZSAoKiopKGRvdWJsZSksIGRvdWJsZSmEAVFlbXNjcmlwdGVuOjppbnRlcm5hbDo6SW52b2tlcjxkb3VibGUsIGRvdWJsZT46Omludm9rZShkb3VibGUgKCopKGRvdWJsZSksIGRvdWJsZSmFAVZ2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpU2FtcGxlQW5kSG9sZD4obWF4aVNhbXBsZUFuZEhvbGQqKYYBSm1heGlTYW1wbGVBbmRIb2xkKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlTYW1wbGVBbmRIb2xkPigphwEmbWF4aVNhbXBsZUFuZEhvbGQ6OnNhaChkb3VibGUsIGRvdWJsZSmIAUp2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpRmxhbmdlcj4obWF4aUZsYW5nZXIqKYkBPm1heGlGbGFuZ2VyKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlGbGFuZ2VyPigpigFBbWF4aUZsYW5nZXI6OmZsYW5nZShkb3VibGUsIHVuc2lnbmVkIGludCwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSmLAcACZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpRmxhbmdlcjo6KikoZG91YmxlLCB1bnNpZ25lZCBpbnQsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUpLCBkb3VibGUsIG1heGlGbGFuZ2VyKiwgZG91YmxlLCB1bnNpZ25lZCBpbnQsIGRvdWJsZSwgZG91YmxlLCBkb3VibGU+OjppbnZva2UoZG91YmxlIChtYXhpRmxhbmdlcjo6KiBjb25zdCYpKGRvdWJsZSwgdW5zaWduZWQgaW50LCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKSwgbWF4aUZsYW5nZXIqLCBkb3VibGUsIHVuc2lnbmVkIGludCwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSmMAUh2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpQ2hvcnVzPihtYXhpQ2hvcnVzKimNATxtYXhpQ2hvcnVzKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlDaG9ydXM+KCmOAUBtYXhpQ2hvcnVzOjpjaG9ydXMoZG91YmxlLCB1bnNpZ25lZCBpbnQsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUpjwFOdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aURDQmxvY2tlcj4obWF4aURDQmxvY2tlciopkAFCbWF4aURDQmxvY2tlciogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpRENCbG9ja2VyPigpkQEjbWF4aURDQmxvY2tlcjo6cGxheShkb3VibGUsIGRvdWJsZSmSAUJ2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpU1ZGPihtYXhpU1ZGKimTATZtYXhpU1ZGKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlTVkY+KCmUARptYXhpU1ZGOjpzZXRDdXRvZmYoZG91YmxlKZUBHW1heGlTVkY6OnNldFJlc29uYW5jZShkb3VibGUplgE1bWF4aVNWRjo6cGxheShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSmXAUR2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpTWF0aD4obWF4aU1hdGgqKZgBaWVtc2NyaXB0ZW46OmludGVybmFsOjpJbnZva2VyPGRvdWJsZSwgZG91YmxlLCBkb3VibGU+OjppbnZva2UoZG91YmxlICgqKShkb3VibGUsIGRvdWJsZSksIGRvdWJsZSwgZG91YmxlKZkBHW1heGlNYXRoOjphZGQoZG91YmxlLCBkb3VibGUpmgEdbWF4aU1hdGg6OnN1Yihkb3VibGUsIGRvdWJsZSmbAR1tYXhpTWF0aDo6bXVsKGRvdWJsZSwgZG91YmxlKZwBHW1heGlNYXRoOjpkaXYoZG91YmxlLCBkb3VibGUpnQEcbWF4aU1hdGg6Omd0KGRvdWJsZSwgZG91YmxlKZ4BHG1heGlNYXRoOjpsdChkb3VibGUsIGRvdWJsZSmfAR1tYXhpTWF0aDo6Z3RlKGRvdWJsZSwgZG91YmxlKaABHW1heGlNYXRoOjpsdGUoZG91YmxlLCBkb3VibGUpoQEdbWF4aU1hdGg6Om1vZChkb3VibGUsIGRvdWJsZSmiARVtYXhpTWF0aDo6YWJzKGRvdWJsZSmjAR9tYXhpTWF0aDo6eHBvd3koZG91YmxlLCBkb3VibGUppAFGdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aUNsb2NrPihtYXhpQ2xvY2sqKaUBOm1heGlDbG9jayogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpQ2xvY2s+KCmmARltYXhpQ2xvY2s6OmlzVGljaygpIGNvbnN0pwEibWF4aUNsb2NrOjpnZXRDdXJyZW50Q291bnQoKSBjb25zdKgBH21heGlDbG9jazo6c2V0Q3VycmVudENvdW50KGludCmpAR9tYXhpQ2xvY2s6OmdldExhc3RDb3VudCgpIGNvbnN0qgEcbWF4aUNsb2NrOjpzZXRMYXN0Q291bnQoaW50KasBGW1heGlDbG9jazo6Z2V0QnBzKCkgY29uc3SsARZtYXhpQ2xvY2s6OnNldEJwcyhpbnQprQEZbWF4aUNsb2NrOjpnZXRCcG0oKSBjb25zdK4BFm1heGlDbG9jazo6c2V0QnBtKGludCmvARdtYXhpQ2xvY2s6OnNldFRpY2soaW50KbABG21heGlDbG9jazo6Z2V0VGlja3MoKSBjb25zdLEBGG1heGlDbG9jazo6c2V0VGlja3MoaW50KbIBYHZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlLdXJhbW90b09zY2lsbGF0b3I+KG1heGlLdXJhbW90b09zY2lsbGF0b3IqKbMBVG1heGlLdXJhbW90b09zY2lsbGF0b3IqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aUt1cmFtb3RvT3NjaWxsYXRvcj4oKbQBZG1heGlLdXJhbW90b09zY2lsbGF0b3I6OnBsYXkoZG91YmxlLCBkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPim1AdYDZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yOjoqKShkb3VibGUsIGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KSwgZG91YmxlLCBtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yKiwgZG91YmxlLCBkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiA+OjppbnZva2UoZG91YmxlIChtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yOjoqIGNvbnN0JikoZG91YmxlLCBkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiksIG1heGlLdXJhbW90b09zY2lsbGF0b3IqLCBkb3VibGUsIGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+Kim2AWZ2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0PihtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0Kim3AWB2b2lkIGVtc2NyaXB0ZW46OmludGVybmFsOjpyYXdfZGVzdHJ1Y3RvcjxtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0PihtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0Kim4AZ4BZW1zY3JpcHRlbjo6aW50ZXJuYWw6Okludm9rZXI8bWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldCosIHVuc2lnbmVkIGxvbmcgY29uc3QmJj46Omludm9rZShtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0KiAoKikodW5zaWduZWQgbG9uZyBjb25zdCYmKSwgdW5zaWduZWQgbG9uZym5AYQBbWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0LCB1bnNpZ25lZCBsb25nIGNvbnN0Pih1bnNpZ25lZCBsb25nIGNvbnN0JiYpugEvbWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldDo6cGxheShkb3VibGUsIGRvdWJsZSm7ATptYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0OjpzZXRQaGFzZShkb3VibGUsIHVuc2lnbmVkIGxvbmcpvAGWAmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQ6OiopKGRvdWJsZSwgdW5zaWduZWQgbG9uZyksIHZvaWQsIG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQqLCBkb3VibGUsIHVuc2lnbmVkIGxvbmc+OjppbnZva2Uodm9pZCAobWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldDo6KiBjb25zdCYpKGRvdWJsZSwgdW5zaWduZWQgbG9uZyksIG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQqLCBkb3VibGUsIHVuc2lnbmVkIGxvbmcpvQFjbWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldDo6c2V0UGhhc2VzKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiBjb25zdCYpvgEybWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldDo6Z2V0UGhhc2UodW5zaWduZWQgbG9uZym/AfwBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0OjoqKSh1bnNpZ25lZCBsb25nKSwgZG91YmxlLCBtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0KiwgdW5zaWduZWQgbG9uZz46Omludm9rZShkb3VibGUgKG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQ6OiogY29uc3QmKSh1bnNpZ25lZCBsb25nKSwgbWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldCosIHVuc2lnbmVkIGxvbmcpwAEhbWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldDo6c2l6ZSgpwQFqdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aUFzeW5jS3VyYW1vdG9Pc2NpbGxhdG9yPihtYXhpQXN5bmNLdXJhbW90b09zY2lsbGF0b3IqKcIBrAFtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0KiBlbXNjcmlwdGVuOjpiYXNlPG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQ+Ojpjb252ZXJ0UG9pbnRlcjxtYXhpQXN5bmNLdXJhbW90b09zY2lsbGF0b3IsIG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQ+KG1heGlBc3luY0t1cmFtb3RvT3NjaWxsYXRvciopwwGIAW1heGlBc3luY0t1cmFtb3RvT3NjaWxsYXRvciogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpQXN5bmNLdXJhbW90b09zY2lsbGF0b3IsIHVuc2lnbmVkIGxvbmcgY29uc3Q+KHVuc2lnbmVkIGxvbmcgY29uc3QmJinEATFtYXhpQXN5bmNLdXJhbW90b09zY2lsbGF0b3I6OnBsYXkoZG91YmxlLCBkb3VibGUpxQE8bWF4aUFzeW5jS3VyYW1vdG9Pc2NpbGxhdG9yOjpzZXRQaGFzZShkb3VibGUsIHVuc2lnbmVkIGxvbmcpxgFlbWF4aUFzeW5jS3VyYW1vdG9Pc2NpbGxhdG9yOjpzZXRQaGFzZXMoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+IGNvbnN0JinHAUJ2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpRkZUPihtYXhpRkZUKinIATx2b2lkIGVtc2NyaXB0ZW46OmludGVybmFsOjpyYXdfZGVzdHJ1Y3RvcjxtYXhpRkZUPihtYXhpRkZUKinJATZtYXhpRkZUKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlGRlQ+KCnKAa4BZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAobWF4aUZGVDo6KikoaW50LCBpbnQsIGludCksIHZvaWQsIG1heGlGRlQqLCBpbnQsIGludCwgaW50Pjo6aW52b2tlKHZvaWQgKG1heGlGRlQ6OiogY29uc3QmKShpbnQsIGludCwgaW50KSwgbWF4aUZGVCosIGludCwgaW50LCBpbnQpywHaAWVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGJvb2wgKG1heGlGRlQ6OiopKGZsb2F0LCBtYXhpRkZUOjpmZnRNb2RlcyksIGJvb2wsIG1heGlGRlQqLCBmbG9hdCwgbWF4aUZGVDo6ZmZ0TW9kZXM+OjppbnZva2UoYm9vbCAobWF4aUZGVDo6KiBjb25zdCYpKGZsb2F0LCBtYXhpRkZUOjpmZnRNb2RlcyksIG1heGlGRlQqLCBmbG9hdCwgbWF4aUZGVDo6ZmZ0TW9kZXMpzAF5ZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZmxvYXQgKG1heGlGRlQ6OiopKCksIGZsb2F0LCBtYXhpRkZUKj46Omludm9rZShmbG9hdCAobWF4aUZGVDo6KiBjb25zdCYpKCksIG1heGlGRlQqKc0BiQJlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+JiAobWF4aUZGVDo6KikoKSwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiYsIG1heGlGRlQqPjo6aW52b2tlKHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mIChtYXhpRkZUOjoqIGNvbnN0JikoKSwgbWF4aUZGVCopzgEabWF4aUZGVDo6Z2V0TWFnbml0dWRlc0RCKCnPARRtYXhpRkZUOjpnZXRQaGFzZXMoKdABFW1heGlGRlQ6OmdldE51bUJpbnMoKdEBFW1heGlGRlQ6OmdldEZGVFNpemUoKdIBFW1heGlGRlQ6OmdldEhvcFNpemUoKdMBGG1heGlGRlQ6OmdldFdpbmRvd1NpemUoKdQBRHZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlJRkZUPihtYXhpSUZGVCop1QE+dm9pZCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6cmF3X2Rlc3RydWN0b3I8bWF4aUlGRlQ+KG1heGlJRkZUKinWAThtYXhpSUZGVCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpSUZGVD4oKdcBgQVlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxmbG9hdCAobWF4aUlGRlQ6OiopKHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mLCBzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+JiwgbWF4aUlGRlQ6OmZmdE1vZGVzKSwgZmxvYXQsIG1heGlJRkZUKiwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiYsIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mLCBtYXhpSUZGVDo6ZmZ0TW9kZXM+OjppbnZva2UoZmxvYXQgKG1heGlJRkZUOjoqIGNvbnN0Jikoc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiYsIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mLCBtYXhpSUZGVDo6ZmZ0TW9kZXMpLCBtYXhpSUZGVCosIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4qLCBzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+KiwgbWF4aUlGRlQ6OmZmdE1vZGVzKdgBZXZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPiA+KG1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPiop2QFfdm9pZCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6cmF3X2Rlc3RydWN0b3I8bWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+ID4obWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+KinaAVltYXhpTUZDQ0FuYWx5c2VyPGRvdWJsZT4qIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+ID4oKdsBWW1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPjo6c2V0dXAodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgZG91YmxlLCBkb3VibGUp3AGeA2Vtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKG1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPjo6KikodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgZG91YmxlLCBkb3VibGUpLCB2b2lkLCBtYXhpTUZDQ0FuYWx5c2VyPGRvdWJsZT4qLCB1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50LCBkb3VibGUsIGRvdWJsZT46Omludm9rZSh2b2lkIChtYXhpTUZDQ0FuYWx5c2VyPGRvdWJsZT46OiogY29uc3QmKSh1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50LCBkb3VibGUsIGRvdWJsZSksIG1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPiosIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQsIGRvdWJsZSwgZG91YmxlKd0BVW1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPjo6bWZjYyhzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+JineAasEZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8c3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiAobWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+OjoqKShzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+JiksIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIG1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPiosIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mPjo6aW52b2tlKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYgKG1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPjo6KiBjb25zdCYpKHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mKSwgbWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+Kiwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiop3wGVAXZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiA+KHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiop4AGPAXZvaWQgZW1zY3JpcHRlbjo6aW50ZXJuYWw6OnJhd19kZXN0cnVjdG9yPHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiA+KHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiop4QGJAXN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4gPigp4gFHc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+OjpwdXNoX2JhY2soaW50IGNvbnN0JinjAb8CZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAoc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+OjoqKShpbnQgY29uc3QmKSwgdm9pZCwgc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+KiwgaW50IGNvbnN0Jj46Omludm9rZSh2b2lkIChzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID46OiogY29uc3QmKShpbnQgY29uc3QmKSwgc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+KiwgaW50KeQBU3N0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPjo6cmVzaXplKHVuc2lnbmVkIGxvbmcsIGludCBjb25zdCYp5QH7AmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPjo6KikodW5zaWduZWQgbG9uZywgaW50IGNvbnN0JiksIHZvaWQsIHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiosIHVuc2lnbmVkIGxvbmcsIGludCBjb25zdCY+OjppbnZva2Uodm9pZCAoc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+OjoqIGNvbnN0JikodW5zaWduZWQgbG9uZywgaW50IGNvbnN0JiksIHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiosIHVuc2lnbmVkIGxvbmcsIGludCnmAT5zdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID46OnNpemUoKSBjb25zdOcBogFlbXNjcmlwdGVuOjppbnRlcm5hbDo6VmVjdG9yQWNjZXNzPHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiA+OjpnZXQoc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+IGNvbnN0JiwgdW5zaWduZWQgbG9uZynoAYMDZW1zY3JpcHRlbjo6aW50ZXJuYWw6OkZ1bmN0aW9uSW52b2tlcjxlbXNjcmlwdGVuOjp2YWwgKCopKHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiBjb25zdCYsIHVuc2lnbmVkIGxvbmcpLCBlbXNjcmlwdGVuOjp2YWwsIHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiBjb25zdCYsIHVuc2lnbmVkIGxvbmc+OjppbnZva2UoZW1zY3JpcHRlbjo6dmFsICgqKikoc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+IGNvbnN0JiwgdW5zaWduZWQgbG9uZyksIHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiosIHVuc2lnbmVkIGxvbmcp6QGoAWVtc2NyaXB0ZW46OmludGVybmFsOjpWZWN0b3JBY2Nlc3M8c3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+ID46OnNldChzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4mLCB1bnNpZ25lZCBsb25nLCBpbnQgY29uc3QmKeoB+QJlbXNjcmlwdGVuOjppbnRlcm5hbDo6RnVuY3Rpb25JbnZva2VyPGJvb2wgKCopKHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiYsIHVuc2lnbmVkIGxvbmcsIGludCBjb25zdCYpLCBib29sLCBzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4mLCB1bnNpZ25lZCBsb25nLCBpbnQgY29uc3QmPjo6aW52b2tlKGJvb2wgKCoqKShzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4mLCB1bnNpZ25lZCBsb25nLCBpbnQgY29uc3QmKSwgc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+KiwgdW5zaWduZWQgbG9uZywgaW50KesBoQF2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4gPihzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4qKewBUHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPjo6cHVzaF9iYWNrKGRvdWJsZSBjb25zdCYp7QHjAmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPjo6KikoZG91YmxlIGNvbnN0JiksIHZvaWQsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiosIGRvdWJsZSBjb25zdCY+OjppbnZva2Uodm9pZCAoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+OjoqIGNvbnN0JikoZG91YmxlIGNvbnN0JiksIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiosIGRvdWJsZSnuAVxzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID46OnJlc2l6ZSh1bnNpZ25lZCBsb25nLCBkb3VibGUgY29uc3QmKe8BnwNlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID46OiopKHVuc2lnbmVkIGxvbmcsIGRvdWJsZSBjb25zdCYpLCB2b2lkLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4qLCB1bnNpZ25lZCBsb25nLCBkb3VibGUgY29uc3QmPjo6aW52b2tlKHZvaWQgKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPjo6KiBjb25zdCYpKHVuc2lnbmVkIGxvbmcsIGRvdWJsZSBjb25zdCYpLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4qLCB1bnNpZ25lZCBsb25nLCBkb3VibGUp8AFEc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+OjpzaXplKCkgY29uc3TxAa4BZW1zY3JpcHRlbjo6aW50ZXJuYWw6OlZlY3RvckFjY2VzczxzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4gPjo6Z2V0KHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiBjb25zdCYsIHVuc2lnbmVkIGxvbmcp8gG3AWVtc2NyaXB0ZW46OmludGVybmFsOjpWZWN0b3JBY2Nlc3M8c3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+ID46OnNldChzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCB1bnNpZ25lZCBsb25nLCBkb3VibGUgY29uc3QmKfMBnQNlbXNjcmlwdGVuOjppbnRlcm5hbDo6RnVuY3Rpb25JbnZva2VyPGJvb2wgKCopKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIHVuc2lnbmVkIGxvbmcsIGRvdWJsZSBjb25zdCYpLCBib29sLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCB1bnNpZ25lZCBsb25nLCBkb3VibGUgY29uc3QmPjo6aW52b2tlKGJvb2wgKCoqKShzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCB1bnNpZ25lZCBsb25nLCBkb3VibGUgY29uc3QmKSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KiwgdW5zaWduZWQgbG9uZywgZG91YmxlKfQBmQF2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiA+KHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+Kin1AUpzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6cHVzaF9iYWNrKGNoYXIgY29uc3QmKfYBywJlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6KikoY2hhciBjb25zdCYpLCB2b2lkLCBzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiosIGNoYXIgY29uc3QmPjo6aW52b2tlKHZvaWQgKHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjoqIGNvbnN0JikoY2hhciBjb25zdCYpLCBzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiosIGNoYXIp9wFWc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OnJlc2l6ZSh1bnNpZ25lZCBsb25nLCBjaGFyIGNvbnN0Jin4AYcDZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAoc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OiopKHVuc2lnbmVkIGxvbmcsIGNoYXIgY29uc3QmKSwgdm9pZCwgc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4qLCB1bnNpZ25lZCBsb25nLCBjaGFyIGNvbnN0Jj46Omludm9rZSh2b2lkIChzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6KiBjb25zdCYpKHVuc2lnbmVkIGxvbmcsIGNoYXIgY29uc3QmKSwgc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4qLCB1bnNpZ25lZCBsb25nLCBjaGFyKfkBQHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpzaXplKCkgY29uc3T6AaYBZW1zY3JpcHRlbjo6aW50ZXJuYWw6OlZlY3RvckFjY2VzczxzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiA+OjpnZXQoc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QmLCB1bnNpZ25lZCBsb25nKfsBrQFlbXNjcmlwdGVuOjppbnRlcm5hbDo6VmVjdG9yQWNjZXNzPHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+ID46OnNldChzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiYsIHVuc2lnbmVkIGxvbmcsIGNoYXIgY29uc3QmKfwBhQNlbXNjcmlwdGVuOjppbnRlcm5hbDo6RnVuY3Rpb25JbnZva2VyPGJvb2wgKCopKHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+JiwgdW5zaWduZWQgbG9uZywgY2hhciBjb25zdCYpLCBib29sLCBzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiYsIHVuc2lnbmVkIGxvbmcsIGNoYXIgY29uc3QmPjo6aW52b2tlKGJvb2wgKCoqKShzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiYsIHVuc2lnbmVkIGxvbmcsIGNoYXIgY29uc3QmKSwgc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4qLCB1bnNpZ25lZCBsb25nLCBjaGFyKf0BvQF2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxzdGQ6Ol9fMjo6dmVjdG9yPHVuc2lnbmVkIGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8dW5zaWduZWQgY2hhcj4gPiA+KHN0ZDo6X18yOjp2ZWN0b3I8dW5zaWduZWQgY2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjx1bnNpZ25lZCBjaGFyPiA+Kin+AcoBZW1zY3JpcHRlbjo6aW50ZXJuYWw6OlZlY3RvckFjY2VzczxzdGQ6Ol9fMjo6dmVjdG9yPHVuc2lnbmVkIGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8dW5zaWduZWQgY2hhcj4gPiA+OjpnZXQoc3RkOjpfXzI6OnZlY3Rvcjx1bnNpZ25lZCBjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHVuc2lnbmVkIGNoYXI+ID4gY29uc3QmLCB1bnNpZ25lZCBsb25nKf8BnQF2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+ID4oc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiopgALXAmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID46OiopKGZsb2F0IGNvbnN0JiksIHZvaWQsIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4qLCBmbG9hdCBjb25zdCY+OjppbnZva2Uodm9pZCAoc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPjo6KiBjb25zdCYpKGZsb2F0IGNvbnN0JiksIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4qLCBmbG9hdCmBApMDZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAoc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPjo6KikodW5zaWduZWQgbG9uZywgZmxvYXQgY29uc3QmKSwgdm9pZCwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiosIHVuc2lnbmVkIGxvbmcsIGZsb2F0IGNvbnN0Jj46Omludm9rZSh2b2lkIChzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+OjoqIGNvbnN0JikodW5zaWduZWQgbG9uZywgZmxvYXQgY29uc3QmKSwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiosIHVuc2lnbmVkIGxvbmcsIGZsb2F0KYICqgFlbXNjcmlwdGVuOjppbnRlcm5hbDo6VmVjdG9yQWNjZXNzPHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4gPjo6Z2V0KHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4gY29uc3QmLCB1bnNpZ25lZCBsb25nKYMCkQNlbXNjcmlwdGVuOjppbnRlcm5hbDo6RnVuY3Rpb25JbnZva2VyPGJvb2wgKCopKHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mLCB1bnNpZ25lZCBsb25nLCBmbG9hdCBjb25zdCYpLCBib29sLCBzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+JiwgdW5zaWduZWQgbG9uZywgZmxvYXQgY29uc3QmPjo6aW52b2tlKGJvb2wgKCoqKShzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+JiwgdW5zaWduZWQgbG9uZywgZmxvYXQgY29uc3QmKSwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiosIHVuc2lnbmVkIGxvbmcsIGZsb2F0KYQCXnN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPjo6X19hcHBlbmQodW5zaWduZWQgbG9uZywgZG91YmxlIGNvbnN0JimFAjhtYXhpTUZDQ0FuYWx5c2VyPGRvdWJsZT46OmNhbGNNZWxGaWx0ZXJCYW5rKGRvdWJsZSwgaW50KYYCZkVtc2NyaXB0ZW5CaW5kaW5nSW5pdGlhbGl6ZXJfbXlfbW9kdWxlX21heGlHcmFpbnM6OkVtc2NyaXB0ZW5CaW5kaW5nSW5pdGlhbGl6ZXJfbXlfbW9kdWxlX21heGlHcmFpbnMoKYcCc3ZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPihtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KimIAm12b2lkIGVtc2NyaXB0ZW46OmludGVybmFsOjpyYXdfZGVzdHJ1Y3RvcjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4obWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiopiQKYAWVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6Z2V0KHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiBjb25zdCYpigJmZW1zY3JpcHRlbjo6c21hcnRfcHRyX3RyYWl0PHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojpjb25zdHJ1Y3RfbnVsbCgpiwKdAWVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6c2hhcmUobWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGVtc2NyaXB0ZW46OmludGVybmFsOjpfRU1fVkFMKimMApsBdm9pZCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6cmF3X2Rlc3RydWN0b3I8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID4oc3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+KimNApwBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Okludm9rZXI8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46Omludm9rZShzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gKCopKCkpjgLCAXN0ZDo6X18yOjplbmFibGVfaWY8IShpc19hcnJheTxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID46OnZhbHVlKSwgc3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46OnR5cGUgc3RkOjpfXzI6Om1ha2Vfc2hhcmVkPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPigpjwI3bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6c2V0U2FtcGxlKG1heGlTYW1wbGUqKZACOG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OmdldE5vcm1hbGlzZWRQb3NpdGlvbigpkQI0bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6c2V0UG9zaXRpb24oZG91YmxlKZICQm1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OnBsYXkoZG91YmxlLCBkb3VibGUsIGludCwgZG91YmxlKZMCzAJlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OiopKGRvdWJsZSwgZG91YmxlLCBpbnQsIGRvdWJsZSksIGRvdWJsZSwgbWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGRvdWJsZSwgZG91YmxlLCBpbnQsIGRvdWJsZT46Omludm9rZShkb3VibGUgKG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OiogY29uc3QmKShkb3VibGUsIGRvdWJsZSwgaW50LCBkb3VibGUpLCBtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KiwgZG91YmxlLCBkb3VibGUsIGludCwgZG91YmxlKZQCRG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OnBsYXlBdFBvc2l0aW9uKGRvdWJsZSwgZG91YmxlLCBpbnQplQKsAmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6KikoZG91YmxlLCBkb3VibGUsIGludCksIGRvdWJsZSwgbWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGRvdWJsZSwgZG91YmxlLCBpbnQ+OjppbnZva2UoZG91YmxlIChtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+OjoqIGNvbnN0JikoZG91YmxlLCBkb3VibGUsIGludCksIG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qLCBkb3VibGUsIGRvdWJsZSwgaW50KZYCcXZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+KG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPioplwJrdm9pZCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6cmF3X2Rlc3RydWN0b3I8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4obWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+KimYApsBZW1zY3JpcHRlbjo6c21hcnRfcHRyX3RyYWl0PHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+ID46OnNoYXJlKG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiosIGVtc2NyaXB0ZW46OmludGVybmFsOjpfRU1fVkFMKimZAr8Bc3RkOjpfXzI6OmVuYWJsZV9pZjwhKGlzX2FycmF5PG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+Ojp2YWx1ZSksIHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+ID46OnR5cGUgc3RkOjpfXzI6Om1ha2Vfc2hhcmVkPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+KCmaAjZtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj46OnNldFNhbXBsZShtYXhpU2FtcGxlKimbAkFtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj46OnBsYXkoZG91YmxlLCBkb3VibGUsIGludCwgZG91YmxlKZwCa3ZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+KG1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiopnQJfbWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+KCmeAjNtYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OnNldFNhbXBsZShtYXhpU2FtcGxlKimfAjFtYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OnNldExvb3BTdGFydChkb3VibGUpoAIvbWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+OjpzZXRMb29wRW5kKGRvdWJsZSmhAiltYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OmdldExvb3BFbmQoKaICRm1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6cGxheShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBpbnQsIGRvdWJsZSmjAtwCZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OiopKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGludCwgZG91YmxlKSwgZG91YmxlLCBtYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBpbnQsIGRvdWJsZT46Omludm9rZShkb3VibGUgKG1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6KiBjb25zdCYpKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGludCwgZG91YmxlKSwgbWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgaW50LCBkb3VibGUppAJIbWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+OjpwbGF5QXRQb3NpdGlvbihkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBpbnQppQK8AmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+OjoqKShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBpbnQpLCBkb3VibGUsIG1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGludD46Omludm9rZShkb3VibGUgKG1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6KiBjb25zdCYpKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGludCksIG1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGludCmmAnBtYXhpR3JhaW48aGFubldpbkZ1bmN0b3I+OjptYXhpR3JhaW4obWF4aVNhbXBsZSosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIG1heGlHcmFpbldpbmRvd0NhY2hlPGhhbm5XaW5GdW5jdG9yPioppwJiRW1zY3JpcHRlbkJpbmRpbmdJbml0aWFsaXplcl9teV9tb2R1bGVfbWF4aWJpdHM6OkVtc2NyaXB0ZW5CaW5kaW5nSW5pdGlhbGl6ZXJfbXlfbW9kdWxlX21heGliaXRzKCmoAkR2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpQml0cz4obWF4aUJpdHMqKakCb2Vtc2NyaXB0ZW46OmludGVybmFsOjpJbnZva2VyPHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50Pjo6aW52b2tlKHVuc2lnbmVkIGludCAoKikodW5zaWduZWQgaW50KSwgdW5zaWduZWQgaW50KaoCmQFlbXNjcmlwdGVuOjppbnRlcm5hbDo6SW52b2tlcjx1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50Pjo6aW52b2tlKHVuc2lnbmVkIGludCAoKikodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQpLCB1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCmrAihtYXhpQml0czo6YXQodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQprAIpbWF4aUJpdHM6OnNobCh1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCmtAiltYXhpQml0czo6c2hyKHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50Ka4CwwFlbXNjcmlwdGVuOjppbnRlcm5hbDo6SW52b2tlcjx1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQ+OjppbnZva2UodW5zaWduZWQgaW50ICgqKSh1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KSwgdW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCmvAjVtYXhpQml0czo6cih1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KbACKm1heGlCaXRzOjpsYW5kKHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KbECKW1heGlCaXRzOjpsb3IodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQpsgIqbWF4aUJpdHM6Omx4b3IodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQpswIbbWF4aUJpdHM6Om5lZyh1bnNpZ25lZCBpbnQptAIbbWF4aUJpdHM6OmluYyh1bnNpZ25lZCBpbnQptQIbbWF4aUJpdHM6OmRlYyh1bnNpZ25lZCBpbnQptgIpbWF4aUJpdHM6OmFkZCh1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCm3AiltYXhpQml0czo6c3ViKHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KbgCKW1heGlCaXRzOjptdWwodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQpuQIpbWF4aUJpdHM6OmRpdih1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCm6AihtYXhpQml0czo6Z3QodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQpuwIobWF4aUJpdHM6Omx0KHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KbwCKW1heGlCaXRzOjpndGUodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQpvQIpbWF4aUJpdHM6Omx0ZSh1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCm+AihtYXhpQml0czo6ZXEodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQpvwIRbWF4aUJpdHM6Om5vaXNlKCnAAiBtYXhpQml0czo6dG9TaWduYWwodW5zaWduZWQgaW50KcECJG1heGlCaXRzOjp0b1RyaWdTaWduYWwodW5zaWduZWQgaW50KcICXWVtc2NyaXB0ZW46OmludGVybmFsOjpJbnZva2VyPHVuc2lnbmVkIGludCwgZG91YmxlPjo6aW52b2tlKHVuc2lnbmVkIGludCAoKikoZG91YmxlKSwgZG91YmxlKcMCHG1heGlCaXRzOjpmcm9tU2lnbmFsKGRvdWJsZSnEAkp2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpQ291bnRlcj4obWF4aUNvdW50ZXIqKcUCPm1heGlDb3VudGVyKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlDb3VudGVyPigpxgIibWF4aUNvdW50ZXI6OmNvdW50KGRvdWJsZSwgZG91YmxlKccCRnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlJbmRleD4obWF4aUluZGV4KinIAjptYXhpSW5kZXgqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aUluZGV4PigpyQJXbWF4aUluZGV4OjpwdWxsKGRvdWJsZSwgZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4pygJORW1zY3JpcHRlbkJpbmRpbmdJbml0aWFsaXplcl9tYXhpVmVyYjo6RW1zY3JpcHRlbkJpbmRpbmdJbml0aWFsaXplcl9tYXhpVmVyYigpywJOdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aVNhdFJldmVyYj4obWF4aVNhdFJldmVyYiopzAJIdm9pZCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6cmF3X2Rlc3RydWN0b3I8bWF4aVNhdFJldmVyYj4obWF4aVNhdFJldmVyYiopzQJCbWF4aVNhdFJldmVyYiogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpU2F0UmV2ZXJiPigpzgJMdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aUZyZWVWZXJiPihtYXhpRnJlZVZlcmIqKc8CQG1heGlGcmVlVmVyYiogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpRnJlZVZlcmI+KCnQAitzdGQ6Ol9fMjo6X190aHJvd19sZW5ndGhfZXJyb3IoY2hhciBjb25zdCop0QJkdm9pZCBzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID46Ol9fcHVzaF9iYWNrX3Nsb3dfcGF0aDxpbnQgY29uc3QmPihpbnQgY29uc3QmKdICVXN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPjo6X19hcHBlbmQodW5zaWduZWQgbG9uZywgaW50IGNvbnN0JinTAnB2b2lkIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPjo6X19wdXNoX2JhY2tfc2xvd19wYXRoPGRvdWJsZSBjb25zdCY+KGRvdWJsZSBjb25zdCYp1AJYc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46Ol9fYXBwZW5kKHVuc2lnbmVkIGxvbmcsIGNoYXIgY29uc3QmKdUCb3N0ZDo6X18yOjp2ZWN0b3I8bWF4aUt1cmFtb3RvT3NjaWxsYXRvciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yPiA+OjpfX2FwcGVuZCh1bnNpZ25lZCBsb25nKdYCT3N0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPjo6X19hcHBlbmQodW5zaWduZWQgbG9uZynXAhNtYXhpRkZUOjp+bWF4aUZGVCgp2AIzbWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6fm1heGlUaW1lU3RyZXRjaCgp2QKABHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+LCBlbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46OnZhbF9kZWxldGVyPihtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KiwgZW1zY3JpcHRlbjo6c21hcnRfcHRyX3RyYWl0PHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp2YWxfZGVsZXRlciwgc3RkOjpfXzI6OmVuYWJsZV9pZjxpc19jb252ZXJ0aWJsZTxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KiwgbWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPio+Ojp2YWx1ZSwgc3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+OjpfX25hdD46OnR5cGUp2gJ6ZW1zY3JpcHRlbjo6c21hcnRfcHRyX3RyYWl0PHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp2YWxfZGVsZXRlcjo6b3BlcmF0b3IoKSh2b2lkIGNvbnN0KinbAvQBc3RkOjpfXzI6Ol9fc2hhcmVkX3B0cl9wb2ludGVyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qLCBlbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46OnZhbF9kZWxldGVyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp+X19zaGFyZWRfcHRyX3BvaW50ZXIoKdwC9gFzdGQ6Ol9fMjo6X19zaGFyZWRfcHRyX3BvaW50ZXI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6dmFsX2RlbGV0ZXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46On5fX3NoYXJlZF9wdHJfcG9pbnRlcigpLjHdAu8Bc3RkOjpfXzI6Ol9fc2hhcmVkX3B0cl9wb2ludGVyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qLCBlbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46OnZhbF9kZWxldGVyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+OjpfX29uX3plcm9fc2hhcmVkKCneAocCc3RkOjpfXzI6Ol9fc2hhcmVkX3B0cl9wb2ludGVyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qLCBlbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46OnZhbF9kZWxldGVyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+OjpfX2dldF9kZWxldGVyKHN0ZDo6dHlwZV9pbmZvIGNvbnN0JikgY29uc3TfAvQBc3RkOjpfXzI6Ol9fc2hhcmVkX3B0cl9wb2ludGVyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qLCBlbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46OnZhbF9kZWxldGVyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+OjpfX29uX3plcm9fc2hhcmVkX3dlYWsoKeACkAFzdGQ6Ol9fMjo6X19zaGFyZWRfcHRyX2VtcGxhY2U8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6fl9fc2hhcmVkX3B0cl9lbXBsYWNlKCnhApIBc3RkOjpfXzI6Ol9fc2hhcmVkX3B0cl9lbXBsYWNlPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46On5fX3NoYXJlZF9wdHJfZW1wbGFjZSgpLjHiAosBc3RkOjpfXzI6Ol9fc2hhcmVkX3B0cl9lbXBsYWNlPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46Ol9fb25femVyb19zaGFyZWQoKeMCIW1heGlHcmFpbjxoYW5uV2luRnVuY3Rvcj46OnBsYXkoKeQCMW1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPjo6fm1heGlQaXRjaFNoaWZ0KCnlAvgDc3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID46OnNoYXJlZF9wdHI8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+LCBlbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4gPjo6dmFsX2RlbGV0ZXI+KG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiosIGVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp2YWxfZGVsZXRlciwgc3RkOjpfXzI6OmVuYWJsZV9pZjxpc19jb252ZXJ0aWJsZTxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4qLCBtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4qPjo6dmFsdWUsIHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+OjpfX25hdD46OnR5cGUp5gLxAXN0ZDo6X18yOjpfX3NoYXJlZF9wdHJfcG9pbnRlcjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4qLCBlbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4gPjo6dmFsX2RlbGV0ZXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4gPjo6fl9fc2hhcmVkX3B0cl9wb2ludGVyKCnnAvMBc3RkOjpfXzI6Ol9fc2hhcmVkX3B0cl9wb2ludGVyPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiosIGVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp2YWxfZGVsZXRlciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp+X19zaGFyZWRfcHRyX3BvaW50ZXIoKS4x6AKEAnN0ZDo6X18yOjpfX3NoYXJlZF9wdHJfcG9pbnRlcjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4qLCBlbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4gPjo6dmFsX2RlbGV0ZXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4gPjo6X19nZXRfZGVsZXRlcihzdGQ6OnR5cGVfaW5mbyBjb25zdCYpIGNvbnN06QKOAXN0ZDo6X18yOjpfX3NoYXJlZF9wdHJfZW1wbGFjZTxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4gPjo6fl9fc2hhcmVkX3B0cl9lbXBsYWNlKCnqApABc3RkOjpfXzI6Ol9fc2hhcmVkX3B0cl9lbXBsYWNlPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp+X19zaGFyZWRfcHRyX2VtcGxhY2UoKS4x6wKJAXN0ZDo6X18yOjpfX3NoYXJlZF9wdHJfZW1wbGFjZTxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4gPjo6X19vbl96ZXJvX3NoYXJlZCgp7AIkX0dMT0JBTF9fc3ViX0lfbWF4aW1pbGlhbi5lbWJpbmQuY3Bw7QIXbWF4aU9zYzo6cGhhc29yKGRvdWJsZSnuAhltYXhpT3NjOjp0cmlhbmdsZShkb3VibGUp7wJQbWF4aUVudmVsb3BlOjpsaW5lKGludCwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JinwAiJtYXhpRW52ZWxvcGU6OnRyaWdnZXIoaW50LCBkb3VibGUp8QIebWF4aURlbGF5bGluZTo6bWF4aURlbGF5bGluZSgp8gImbWF4aURlbGF5bGluZTo6ZGwoZG91YmxlLCBpbnQsIGRvdWJsZSnzAittYXhpRGVsYXlsaW5lOjpkbChkb3VibGUsIGludCwgZG91YmxlLCBpbnQp9AIpbWF4aUZpbHRlcjo6bG9yZXMoZG91YmxlLCBkb3VibGUsIGRvdWJsZSn1AlhtYXhpTWl4OjpzdGVyZW8oZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBkb3VibGUp9gJebWF4aU1peDo6cXVhZChkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGRvdWJsZSwgZG91YmxlKfcCa21heGlNaXg6OmFtYmlzb25pYyhkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUp+AJsbWF4aVNhbXBsZTo6bG9hZChzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+LCBpbnQp+QISbWF4aVNhbXBsZTo6cmVhZCgp+gJnc3RkOjpfXzI6OmJhc2ljX2lmc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpiYXNpY19pZnN0cmVhbShjaGFyIGNvbnN0KiwgdW5zaWduZWQgaW50KfsC3QFzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYgc3RkOjpfXzI6Ol9fcHV0X2NoYXJhY3Rlcl9zZXF1ZW5jZTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPihzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBsb25nKfwCTXN0ZDo6X18yOjp2ZWN0b3I8c2hvcnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8c2hvcnQ+ID46Ol9fYXBwZW5kKHVuc2lnbmVkIGxvbmcp/QJNc3RkOjpfXzI6OmJhc2ljX2ZpbGVidWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19maWxlYnVmKCn+AmxtYXhpU2FtcGxlOjpzZXRTYW1wbGVGcm9tT2dnQmxvYihzdGQ6Ol9fMjo6dmVjdG9yPHVuc2lnbmVkIGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8dW5zaWduZWQgY2hhcj4gPiYsIGludCn/AkxzdGQ6Ol9fMjo6YmFzaWNfZmlsZWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6YmFzaWNfZmlsZWJ1ZigpgANcc3RkOjpfXzI6OmJhc2ljX2ZpbGVidWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46Om9wZW4oY2hhciBjb25zdCosIHVuc2lnbmVkIGludCmBA09zdGQ6Ol9fMjo6YmFzaWNfaWZzdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19pZnN0cmVhbSgpggMVbWF4aVNhbXBsZTo6aXNSZWFkeSgpgwNObWF4aVNhbXBsZTo6c2V0U2FtcGxlKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYphAP2AXN0ZDo6X18yOjplbmFibGVfaWY8KF9faXNfZm9yd2FyZF9pdGVyYXRvcjxkb3VibGUqPjo6dmFsdWUpICYmIChpc19jb25zdHJ1Y3RpYmxlPGRvdWJsZSwgc3RkOjpfXzI6Oml0ZXJhdG9yX3RyYWl0czxkb3VibGUqPjo6cmVmZXJlbmNlPjo6dmFsdWUpLCB2b2lkPjo6dHlwZSBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID46OmFzc2lnbjxkb3VibGUqPihkb3VibGUqLCBkb3VibGUqKYUDU21heGlTYW1wbGU6OnNldFNhbXBsZShzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBpbnQphgMVbWF4aVNhbXBsZTo6dHJpZ2dlcigphwMSbWF4aVNhbXBsZTo6cGxheSgpiAMobWF4aVNhbXBsZTo6cGxheShkb3VibGUsIGRvdWJsZSwgZG91YmxlKYkDMW1heGlTYW1wbGU6OnBsYXkoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlJimKAyltYXhpU2FtcGxlOjpwbGF5NChkb3VibGUsIGRvdWJsZSwgZG91YmxlKYsDFm1heGlTYW1wbGU6OnBsYXlPbmNlKCmMAxxtYXhpU2FtcGxlOjpwbGF5T25aWChkb3VibGUpjQMkbWF4aVNhbXBsZTo6cGxheU9uWlgoZG91YmxlLCBkb3VibGUpjgMcbWF4aVNhbXBsZTo6cGxheU9uY2UoZG91YmxlKY8DLG1heGlTYW1wbGU6OnBsYXlPblpYKGRvdWJsZSwgZG91YmxlLCBkb3VibGUpkAMqbWF4aVNhbXBsZTo6bG9vcFNldFBvc09uWlgoZG91YmxlLCBkb3VibGUpkQMYbWF4aVNhbXBsZTo6cGxheShkb3VibGUpkgMdbWF4aVNhbXBsZTo6bm9ybWFsaXNlKGRvdWJsZSmTAy5tYXhpU2FtcGxlOjphdXRvVHJpbShmbG9hdCwgZmxvYXQsIGJvb2wsIGJvb2wplAMzbWF4aUR5bjo6Z2F0ZShkb3VibGUsIGRvdWJsZSwgbG9uZywgZG91YmxlLCBkb3VibGUplQM7bWF4aUR5bjo6Y29tcHJlc3Nvcihkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSmWAxltYXhpRHluOjpjb21wcmVzcyhkb3VibGUplwMabWF4aUR5bjo6c2V0QXR0YWNrKGRvdWJsZSmYAxttYXhpRHluOjpzZXRSZWxlYXNlKGRvdWJsZSmZAx1tYXhpRHluOjpzZXRUaHJlc2hvbGQoZG91YmxlKZoDLm1heGlFbnY6OmFyKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGxvbmcsIGludCmbA0BtYXhpRW52OjphZHNyKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBsb25nLCBpbnQpnAMabWF4aUVudjo6YWRzcihkb3VibGUsIGludCmdAxptYXhpRW52OjpzZXRBdHRhY2soZG91YmxlKZ4DG21heGlFbnY6OnNldFN1c3RhaW4oZG91YmxlKZ8DGW1heGlFbnY6OnNldERlY2F5KGRvdWJsZSmgAxJjb252ZXJ0OjptdG9mKGludCmhA2B2aXJ0dWFsIHRodW5rIHRvIHN0ZDo6X18yOjpiYXNpY19pZnN0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX2lmc3RyZWFtKCmiA1FzdGQ6Ol9fMjo6YmFzaWNfaWZzdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19pZnN0cmVhbSgpLjGjA2J2aXJ0dWFsIHRodW5rIHRvIHN0ZDo6X18yOjpiYXNpY19pZnN0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX2lmc3RyZWFtKCkuMaQDQ3N0ZDo6X18yOjpiYXNpY19maWxlYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpzeW5jKCmlA09zdGQ6Ol9fMjo6YmFzaWNfZmlsZWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX2ZpbGVidWYoKS4xpgNbc3RkOjpfXzI6OmJhc2ljX2ZpbGVidWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OmltYnVlKHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKacDUHN0ZDo6X18yOjpiYXNpY19maWxlYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpzZXRidWYoY2hhciosIGxvbmcpqAN6c3RkOjpfXzI6OmJhc2ljX2ZpbGVidWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnNlZWtvZmYobG9uZyBsb25nLCBzdGQ6Ol9fMjo6aW9zX2Jhc2U6OnNlZWtkaXIsIHVuc2lnbmVkIGludCmpAxxzdGQ6Ol9fMjo6X190aHJvd19iYWRfY2FzdCgpqgNvc3RkOjpfXzI6OmJhc2ljX2ZpbGVidWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnNlZWtwb3Moc3RkOjpfXzI6OmZwb3M8X19tYnN0YXRlX3Q+LCB1bnNpZ25lZCBpbnQpqwNIc3RkOjpfXzI6OmJhc2ljX2ZpbGVidWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnVuZGVyZmxvdygprANLc3RkOjpfXzI6OmJhc2ljX2ZpbGVidWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnBiYWNrZmFpbChpbnQprQNKc3RkOjpfXzI6OmJhc2ljX2ZpbGVidWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46Om92ZXJmbG93KGludCmuA4UCc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gc3RkOjpfXzI6Ol9fcGFkX2FuZF9vdXRwdXQ8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4oc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHN0ZDo6X18yOjppb3NfYmFzZSYsIGNoYXIprwMbbWF4aUNsb2NrOjpzZXRUZW1wbyhkb3VibGUpsAMTbWF4aUNsb2NrOjp0aWNrZXIoKbEDH21heGlDbG9jazo6c2V0VGlja3NQZXJCZWF0KGludCmyAx1tYXhpRkZUOjpzZXR1cChpbnQsIGludCwgaW50KbMDKm1heGlGRlQ6OnByb2Nlc3MoZmxvYXQsIG1heGlGRlQ6OmZmdE1vZGVzKbQDE21heGlGRlQ6Om1hZ3NUb0RCKCm1AxttYXhpRkZUOjpzcGVjdHJhbEZsYXRuZXNzKCm2AxttYXhpRkZUOjpzcGVjdHJhbENlbnRyb2lkKCm3Ax5tYXhpSUZGVDo6c2V0dXAoaW50LCBpbnQsIGludCm4A5MBbWF4aUlGRlQ6OnByb2Nlc3Moc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiYsIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mLCBtYXhpSUZGVDo6ZmZ0TW9kZXMpuQMuRkZUKGludCwgYm9vbCwgZmxvYXQqLCBmbG9hdCosIGZsb2F0KiwgZmxvYXQqKboDJFJlYWxGRlQoaW50LCBmbG9hdCosIGZsb2F0KiwgZmxvYXQqKbsDIGZmdDo6Z2VuV2luZG93KGludCwgaW50LCBmbG9hdCopvAMPZmZ0OjpzZXR1cChpbnQpvQMLZmZ0Ojp+ZmZ0KCm+AyFmZnQ6OmNhbGNGRlQoaW50LCBmbG9hdCosIGZsb2F0Kim/AzdmZnQ6OnBvd2VyU3BlY3RydW0oaW50LCBmbG9hdCosIGZsb2F0KiwgZmxvYXQqLCBmbG9hdCopwAMdZmZ0Ojpjb252VG9EQihmbG9hdCosIGZsb2F0KinBAztmZnQ6OmludmVyc2VGRlRDb21wbGV4KGludCwgZmxvYXQqLCBmbG9hdCosIGZsb2F0KiwgZmxvYXQqKcIDPmZmdDo6aW52ZXJzZVBvd2VyU3BlY3RydW0oaW50LCBmbG9hdCosIGZsb2F0KiwgZmxvYXQqLCBmbG9hdCopwwM3bWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+OjptZWxGaWx0ZXJBbmRMb2dTcXVhcmUoZmxvYXQqKcQDJm1heGlSZXZlcmJGaWx0ZXJzOjptYXhpUmV2ZXJiRmlsdGVycygpxQMgbWF4aVJldmVyYkJhc2U6Om1heGlSZXZlcmJCYXNlKCnGAx5tYXhpU2F0UmV2ZXJiOjptYXhpU2F0UmV2ZXJiKCnHAxttYXhpU2F0UmV2ZXJiOjpwbGF5KGRvdWJsZSnIAxxtYXhpRnJlZVZlcmI6Om1heGlGcmVlVmVyYigpyQMqbWF4aUZyZWVWZXJiOjpwbGF5KGRvdWJsZSwgZG91YmxlLCBkb3VibGUpygMncG9pbnRfY29tcGFyZSh2b2lkIGNvbnN0Kiwgdm9pZCBjb25zdCopywMadm9yYmlzX2RlaW5pdChzdGJfdm9yYmlzKinMAylpc193aG9sZV9wYWNrZXRfcHJlc2VudChzdGJfdm9yYmlzKiwgaW50Kc0DM3ZvcmJpc19kZWNvZGVfcGFja2V0KHN0Yl92b3JiaXMqLCBpbnQqLCBpbnQqLCBpbnQqKc4DF3N0YXJ0X3BhZ2Uoc3RiX3ZvcmJpcyopzwMvdm9yYmlzX2ZpbmlzaF9mcmFtZShzdGJfdm9yYmlzKiwgaW50LCBpbnQsIGludCnQA0B2b3JiaXNfZGVjb2RlX2luaXRpYWwoc3RiX3ZvcmJpcyosIGludCosIGludCosIGludCosIGludCosIGludCop0QMaZ2V0X2JpdHMoc3RiX3ZvcmJpcyosIGludCnSAzJjb2RlYm9va19kZWNvZGVfc2NhbGFyX3JhdyhzdGJfdm9yYmlzKiwgQ29kZWJvb2sqKdMDQ2RlY29kZV9yZXNpZHVlKHN0Yl92b3JiaXMqLCBmbG9hdCoqLCBpbnQsIGludCwgaW50LCB1bnNpZ25lZCBjaGFyKinUAytpbnZlcnNlX21kY3QoZmxvYXQqLCBpbnQsIHN0Yl92b3JiaXMqLCBpbnQp1QMZZmx1c2hfcGFja2V0KHN0Yl92b3JiaXMqKdYDGnN0YXJ0X2RlY29kZXIoc3RiX3ZvcmJpcyop1wModWludDMyX2NvbXBhcmUodm9pZCBjb25zdCosIHZvaWQgY29uc3QqKdgDJWluaXRfYmxvY2tzaXplKHN0Yl92b3JiaXMqLCBpbnQsIGludCnZAxZzdGJfdm9yYmlzX29wZW5fbWVtb3J52gMac3RiX3ZvcmJpc19nZXRfZnJhbWVfc2hvcnTbA0Bjb252ZXJ0X3NhbXBsZXNfc2hvcnQoaW50LCBzaG9ydCoqLCBpbnQsIGludCwgZmxvYXQqKiwgaW50LCBpbnQp3AMmc3RiX3ZvcmJpc19nZXRfZnJhbWVfc2hvcnRfaW50ZXJsZWF2ZWTdA0djb252ZXJ0X2NoYW5uZWxzX3Nob3J0X2ludGVybGVhdmVkKGludCwgc2hvcnQqLCBpbnQsIGZsb2F0KiosIGludCwgaW50Kd4DGHN0Yl92b3JiaXNfZGVjb2RlX21lbW9yed8DH21heWJlX3N0YXJ0X3BhY2tldChzdGJfdm9yYmlzKingAylzdGFydF9wYWdlX25vX2NhcHR1cmVwYXR0ZXJuKHN0Yl92b3JiaXMqKeEDMmNvZGVib29rX2RlY29kZV9zdGFydChzdGJfdm9yYmlzKiwgQ29kZWJvb2sqLCBpbnQp4gNfY29kZWJvb2tfZGVjb2RlX2RlaW50ZXJsZWF2ZV9yZXBlYXQoc3RiX3ZvcmJpcyosIENvZGVib29rKiwgZmxvYXQqKiwgaW50LCBpbnQqLCBpbnQqLCBpbnQsIGludCnjAzVpbWRjdF9zdGVwM19pdGVyMF9sb29wKGludCwgZmxvYXQqLCBpbnQsIGludCwgZmxvYXQqKeQDPGltZGN0X3N0ZXAzX2lubmVyX3JfbG9vcChpbnQsIGZsb2F0KiwgaW50LCBpbnQsIGZsb2F0KiwgaW50KeUDB3NjYWxibmbmAwZsZGV4cGbnAwZtZW1jbXDoAwVxc29ydOkDBHNpZnTqAwNzaHLrAwd0cmlua2xl7AMDc2hs7QMEcG50eu4DBWN5Y2xl7wMHYV9jdHpfbPADDF9fc3RkaW9fc2Vla/EDCl9fbG9ja2ZpbGXyAwxfX3VubG9ja2ZpbGXzAwlfX2Z3cml0ZXj0AwZmd3JpdGX1AwdpcHJpbnRm9gMQX19lcnJub19sb2NhdGlvbvcDB3djcnRvbWL4AwZ3Y3RvbWL5AwZtZW1jaHL6AwVmcmV4cPsDE19fdmZwcmludGZfaW50ZXJuYWz8AwtwcmludGZfY29yZf0DA291dP4DBmdldGludP8DB3BvcF9hcmeABANwYWSBBAVmbXRfb4IEBWZtdF94gwQFZm10X3WEBAh2ZnByaW50ZoUEBmZtdF9mcIYEE3BvcF9hcmdfbG9uZ19kb3VibGWHBAl2ZmlwcmludGaIBApfX29mbF9sb2NriQQJX190b3dyaXRligQIZmlwcmludGaLBAVmcHV0Y4wEEV9fZnRlbGxvX3VubG9ja2VkjQQIX19mdGVsbG+OBAVmdGVsbI8ECF9fdG9yZWFkkAQFZnJlYWSRBBFfX2ZzZWVrb191bmxvY2tlZJIECF9fZnNlZWtvkwQFZnNlZWuUBA1fX3N0ZGlvX2Nsb3NllQQFZmdldGOWBAZzdHJsZW6XBAtfX3N0cmNocm51bJgEBnN0cmNocpkEDF9fZm1vZGVmbGFnc5oEBWZvcGVumwQJdnNucHJpbnRmnAQIc25fd3JpdGWdBAZmY2xvc2WeBBlfX2Vtc2NyaXB0ZW5fc3Rkb3V0X2Nsb3NlnwQYX19lbXNjcmlwdGVuX3N0ZG91dF9zZWVroAQMX19zdGRpb19yZWFkoQQIX19mZG9wZW6iBA1fX3N0ZGlvX3dyaXRlowQKX19vdmVyZmxvd6QEBmZmbHVzaKUEEV9fZmZsdXNoX3VubG9ja2VkpgQHX191Zmxvd6cECV9fb2ZsX2FkZKgECV9fbHNocnRpM6kECV9fYXNobHRpM6oEDF9fdHJ1bmN0ZmRmMqsEBV9fY29zrAQQX19yZW1fcGlvMl9sYXJnZa0ECl9fcmVtX3BpbzKuBAVfX3Npbq8EA2Nvc7AEB19fY29zZGaxBAdfX3NpbmRmsgQLX19yZW1fcGlvMmazBARjb3NmtAQDc2lutQQEc2luZrYEBV9fdGFutwQDdGFuuAQFYXRhbma5BAZhdGFuMma6BARleHBmuwQDbG9nvAQEbG9nZr0EA3Bvd74EB3dtZW1jcHm/BBlzdGQ6OnVuY2F1Z2h0X2V4Y2VwdGlvbigpwARFc3RkOjpfXzI6OmJhc2ljX2lvczxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX2lvcygpwQQfc3RkOjpfXzI6Omlvc19iYXNlOjp+aW9zX2Jhc2UoKcIEP3N0ZDo6X18yOjppb3NfYmFzZTo6X19jYWxsX2NhbGxiYWNrcyhzdGQ6Ol9fMjo6aW9zX2Jhc2U6OmV2ZW50KcMER3N0ZDo6X18yOjpiYXNpY19pb3M8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19pb3MoKS4xxARRc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX3N0cmVhbWJ1ZigpxQRTc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX3N0cmVhbWJ1ZigpLjHGBFBzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpiYXNpY19zdHJlYW1idWYoKccEXXN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OmltYnVlKHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKcgEUnN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnNldGJ1ZihjaGFyKiwgbG9uZynJBHxzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpzZWVrb2ZmKGxvbmcgbG9uZywgc3RkOjpfXzI6Omlvc19iYXNlOjpzZWVrZGlyLCB1bnNpZ25lZCBpbnQpygRxc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6c2Vla3BvcyhzdGQ6Ol9fMjo6ZnBvczxfX21ic3RhdGVfdD4sIHVuc2lnbmVkIGludCnLBFJzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp4c2dldG4oY2hhciosIGxvbmcpzAREc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+Ojpjb3B5KGNoYXIqLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgbG9uZynNBEpzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp1bmRlcmZsb3coKc4ERnN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnVmbG93KCnPBE1zdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpwYmFja2ZhaWwoaW50KdAEWHN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnhzcHV0bihjaGFyIGNvbnN0KiwgbG9uZynRBFdzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Ojp+YmFzaWNfc3RyZWFtYnVmKCnSBFlzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Ojp+YmFzaWNfc3RyZWFtYnVmKCkuMdMEVnN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46OmJhc2ljX3N0cmVhbWJ1Zigp1ARbc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1Zjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6eHNnZXRuKHdjaGFyX3QqLCBsb25nKdUETXN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Pjo6Y29weSh3Y2hhcl90Kiwgd2NoYXJfdCBjb25zdCosIHVuc2lnbmVkIGxvbmcp1gRMc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1Zjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6dWZsb3coKdcEYXN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46OnhzcHV0bih3Y2hhcl90IGNvbnN0KiwgbG9uZynYBE9zdGQ6Ol9fMjo6YmFzaWNfaXN0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX2lzdHJlYW0oKS4x2QRedmlydHVhbCB0aHVuayB0byBzdGQ6Ol9fMjo6YmFzaWNfaXN0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX2lzdHJlYW0oKdoET3N0ZDo6X18yOjpiYXNpY19pc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfaXN0cmVhbSgpLjLbBGB2aXJ0dWFsIHRodW5rIHRvIHN0ZDo6X18yOjpiYXNpY19pc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfaXN0cmVhbSgpLjHcBI8Bc3RkOjpfXzI6OmJhc2ljX2lzdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnNlbnRyeTo6c2VudHJ5KHN0ZDo6X18yOjpiYXNpY19pc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+JiwgYm9vbCndBERzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6Zmx1c2goKd4EYXN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYgc3RkOjpfXzI6OnVzZV9mYWNldDxzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gPihzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JinfBNEBYm9vbCBzdGQ6Ol9fMjo6b3BlcmF0b3IhPTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiBjb25zdCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+IGNvbnN0JingBFRzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6b3BlcmF0b3IqKCkgY29uc3ThBE9zdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6b3BlcmF0b3IrKygp4gTRAWJvb2wgc3RkOjpfXzI6Om9wZXJhdG9yPT08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gY29uc3QmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiBjb25zdCYp4wSJAXN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpzZW50cnk6OnNlbnRyeShzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYp5AROc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnNlbnRyeTo6fnNlbnRyeSgp5QSYAXN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjplcXVhbChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiBjb25zdCYpIGNvbnN05gRHc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6c2J1bXBjKCnnBEpzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpzcHV0YyhjaGFyKegETnN0ZDo6X18yOjpiYXNpY19pc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpyZWFkKGNoYXIqLCBsb25nKekEanN0ZDo6X18yOjpiYXNpY19pc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpzZWVrZyhsb25nIGxvbmcsIHN0ZDo6X18yOjppb3NfYmFzZTo6c2Vla2RpcinqBEpzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6Zmx1c2goKesEZ3N0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYgc3RkOjpfXzI6OnVzZV9mYWNldDxzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gPihzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JinsBOMBYm9vbCBzdGQ6Ol9fMjo6b3BlcmF0b3IhPTx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiBjb25zdCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+IGNvbnN0JintBFVzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6b3BlcmF0b3IrKygp7gTjAWJvb2wgc3RkOjpfXzI6Om9wZXJhdG9yPT08d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gY29uc3QmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiBjb25zdCYp7wSVAXN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+OjpzZW50cnk6OnNlbnRyeShzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYp8ASkAXN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+OjplcXVhbChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiBjb25zdCYpIGNvbnN08QRNc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1Zjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6c2J1bXBjKCnyBFNzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+OjpzcHV0Yyh3Y2hhcl90KfMET3N0ZDo6X18yOjpiYXNpY19vc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfb3N0cmVhbSgpLjH0BF52aXJ0dWFsIHRodW5rIHRvIHN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfb3N0cmVhbSgp9QRPc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19vc3RyZWFtKCkuMvYEYHZpcnR1YWwgdGh1bmsgdG8gc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19vc3RyZWFtKCkuMfcE7QFzdGQ6Ol9fMjo6bnVtX3B1dDxjaGFyLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+IGNvbnN0JiBzdGQ6Ol9fMjo6dXNlX2ZhY2V0PHN0ZDo6X18yOjpudW1fcHV0PGNoYXIsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID4gPihzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0Jin4BEVzdGQ6Ol9fMjo6YmFzaWNfaW9zPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpmaWxsKCkgY29uc3T5BEpzdGQ6Ol9fMjo6YmFzaWNfaW9zPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp3aWRlbihjaGFyKSBjb25zdPoETnN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpvcGVyYXRvcjw8KHNob3J0KfsETHN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpvcGVyYXRvcjw8KGludCn8BFZzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6b3BlcmF0b3I8PCh1bnNpZ25lZCBsb25nKf0EUnN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpvcGVyYXRvcj0oY2hhcin+BEZzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6cHV0KGNoYXIp/wRbc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46Om9wZXJhdG9yPSh3Y2hhcl90KYAFcHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OmJhc2ljX3N0cmluZyhjaGFyIGNvbnN0KimBBSFzdGQ6Ol9fMjo6aW9zX2Jhc2U6On5pb3NfYmFzZSgpLjGCBR9zdGQ6Ol9fMjo6aW9zX2Jhc2U6OmluaXQodm9pZCopgwW1AXN0ZDo6X18yOjplbmFibGVfaWY8KGlzX21vdmVfY29uc3RydWN0aWJsZTx1bnNpZ25lZCBpbnQ+Ojp2YWx1ZSkgJiYgKGlzX21vdmVfYXNzaWduYWJsZTx1bnNpZ25lZCBpbnQ+Ojp2YWx1ZSksIHZvaWQ+Ojp0eXBlIHN0ZDo6X18yOjpzd2FwPHVuc2lnbmVkIGludD4odW5zaWduZWQgaW50JiwgdW5zaWduZWQgaW50JimEBVlzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6X190ZXN0X2Zvcl9lb2YoKSBjb25zdIUFX3N0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+OjpfX3Rlc3RfZm9yX2VvZigpIGNvbnN0hgUGdW5nZXRjhwUgc3RkOjpfXzI6Omlvc19iYXNlOjpJbml0OjpJbml0KCmIBRdfX2N4eF9nbG9iYWxfYXJyYXlfZHRvcokFP3N0ZDo6X18yOjpfX3N0ZGluYnVmPGNoYXI+OjpfX3N0ZGluYnVmKF9JT19GSUxFKiwgX19tYnN0YXRlX3QqKYoFigFzdGQ6Ol9fMjo6YmFzaWNfaXN0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6YmFzaWNfaXN0cmVhbShzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+KimLBUJzdGQ6Ol9fMjo6X19zdGRpbmJ1Zjx3Y2hhcl90Pjo6X19zdGRpbmJ1ZihfSU9fRklMRSosIF9fbWJzdGF0ZV90KimMBZYBc3RkOjpfXzI6OmJhc2ljX2lzdHJlYW08d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46OmJhc2ljX2lzdHJlYW0oc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1Zjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiopjQVBc3RkOjpfXzI6Ol9fc3Rkb3V0YnVmPGNoYXI+OjpfX3N0ZG91dGJ1ZihfSU9fRklMRSosIF9fbWJzdGF0ZV90KimOBYoBc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OmJhc2ljX29zdHJlYW0oc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiopjwVEc3RkOjpfXzI6Ol9fc3Rkb3V0YnVmPHdjaGFyX3Q+OjpfX3N0ZG91dGJ1ZihfSU9fRklMRSosIF9fbWJzdGF0ZV90KimQBZYBc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46OmJhc2ljX29zdHJlYW0oc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1Zjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiopkQV9c3RkOjpfXzI6OmJhc2ljX2lvczxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6aW5pdChzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+KimSBYsBc3RkOjpfXzI6OmNvZGVjdnQ8Y2hhciwgY2hhciwgX19tYnN0YXRlX3Q+IGNvbnN0JiBzdGQ6Ol9fMjo6dXNlX2ZhY2V0PHN0ZDo6X18yOjpjb2RlY3Z0PGNoYXIsIGNoYXIsIF9fbWJzdGF0ZV90PiA+KHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKZMFkQFzdGQ6Ol9fMjo6Y29kZWN2dDx3Y2hhcl90LCBjaGFyLCBfX21ic3RhdGVfdD4gY29uc3QmIHN0ZDo6X18yOjp1c2VfZmFjZXQ8c3RkOjpfXzI6OmNvZGVjdnQ8d2NoYXJfdCwgY2hhciwgX19tYnN0YXRlX3Q+ID4oc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYplAUpc3RkOjpfXzI6Ol9fc3RkaW5idWY8Y2hhcj46On5fX3N0ZGluYnVmKCmVBTpzdGQ6Ol9fMjo6X19zdGRpbmJ1ZjxjaGFyPjo6aW1idWUoc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYplgUnc3RkOjpfXzI6Ol9fc3RkaW5idWY8Y2hhcj46OnVuZGVyZmxvdygplwUrc3RkOjpfXzI6Ol9fc3RkaW5idWY8Y2hhcj46Ol9fZ2V0Y2hhcihib29sKZgFI3N0ZDo6X18yOjpfX3N0ZGluYnVmPGNoYXI+Ojp1ZmxvdygpmQUqc3RkOjpfXzI6Ol9fc3RkaW5idWY8Y2hhcj46OnBiYWNrZmFpbChpbnQpmgUsc3RkOjpfXzI6Ol9fc3RkaW5idWY8d2NoYXJfdD46On5fX3N0ZGluYnVmKCmbBT1zdGQ6Ol9fMjo6X19zdGRpbmJ1Zjx3Y2hhcl90Pjo6aW1idWUoc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYpnAUqc3RkOjpfXzI6Ol9fc3RkaW5idWY8d2NoYXJfdD46OnVuZGVyZmxvdygpnQUuc3RkOjpfXzI6Ol9fc3RkaW5idWY8d2NoYXJfdD46Ol9fZ2V0Y2hhcihib29sKZ4FJnN0ZDo6X18yOjpfX3N0ZGluYnVmPHdjaGFyX3Q+Ojp1ZmxvdygpnwU2c3RkOjpfXzI6Ol9fc3RkaW5idWY8d2NoYXJfdD46OnBiYWNrZmFpbCh1bnNpZ25lZCBpbnQpoAU7c3RkOjpfXzI6Ol9fc3Rkb3V0YnVmPGNoYXI+OjppbWJ1ZShzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JimhBSNzdGQ6Ol9fMjo6X19zdGRvdXRidWY8Y2hhcj46OnN5bmMoKaIFNnN0ZDo6X18yOjpfX3N0ZG91dGJ1ZjxjaGFyPjo6eHNwdXRuKGNoYXIgY29uc3QqLCBsb25nKaMFKnN0ZDo6X18yOjpfX3N0ZG91dGJ1ZjxjaGFyPjo6b3ZlcmZsb3coaW50KaQFPnN0ZDo6X18yOjpfX3N0ZG91dGJ1Zjx3Y2hhcl90Pjo6aW1idWUoc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYppQU8c3RkOjpfXzI6Ol9fc3Rkb3V0YnVmPHdjaGFyX3Q+Ojp4c3B1dG4od2NoYXJfdCBjb25zdCosIGxvbmcppgU2c3RkOjpfXzI6Ol9fc3Rkb3V0YnVmPHdjaGFyX3Q+OjpvdmVyZmxvdyh1bnNpZ25lZCBpbnQppwUHX19zaGxpbagFCF9fc2hnZXRjqQUIX19tdWx0aTOqBQlfX2ludHNjYW6rBQdtYnJ0b3djrAUNX19leHRlbmRzZnRmMq0FCF9fbXVsdGYzrgULX19mbG9hdHNpdGavBQhfX2FkZHRmM7AFDV9fZXh0ZW5kZGZ0ZjKxBQdfX2xldGYysgUHX19nZXRmMrMFCWNvcHlzaWdubLQFDV9fZmxvYXR1bnNpdGa1BQhfX3N1YnRmM7YFB3NjYWxibmy3BQhfX2RpdnRmM7gFC19fZmxvYXRzY2FuuQUIaGV4ZmxvYXS6BQhkZWNmbG9hdLsFB3NjYW5leHC8BQxfX3RydW5jdGZzZjK9BQd2ZnNjYW5mvgUFYXJnX26/BQlzdG9yZV9pbnTABQ1fX3N0cmluZ19yZWFkwQUHdnNzY2FuZsIFB2RvX3JlYWTDBQZzdHJjbXDEBSBfX2Vtc2NyaXB0ZW5fZW52aXJvbl9jb25zdHJ1Y3RvcsUFB3N0cm5jbXDGBQZnZXRlbnbHBQhfX211bm1hcMgFDF9fZ2V0X2xvY2FsZckFC19fbmV3bG9jYWxlygUJdmFzcHJpbnRmywUGc3NjYW5mzAUIc25wcmludGbNBQpmcmVlbG9jYWxlzgUGd2NzbGVuzwUJd2NzcnRvbWJz0AUKd2NzbnJ0b21ic9EFCW1ic3J0b3djc9IFCm1ic25ydG93Y3PTBQZzdHJ0b3jUBQpzdHJ0b3VsbF9s1QUJc3RydG9sbF9s1gUGc3RydG9m1wUIc3RydG94LjHYBQZzdHJ0b2TZBQdzdHJ0b2xk2gUJc3RydG9sZF9s2wVdc3RkOjpfXzI6OmNvbGxhdGU8Y2hhcj46OmRvX2NvbXBhcmUoY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdCopIGNvbnN03AVFc3RkOjpfXzI6OmNvbGxhdGU8Y2hhcj46OmRvX3RyYW5zZm9ybShjaGFyIGNvbnN0KiwgY2hhciBjb25zdCopIGNvbnN03QXPAXN0ZDo6X18yOjplbmFibGVfaWY8X19pc19mb3J3YXJkX2l0ZXJhdG9yPGNoYXIgY29uc3QqPjo6dmFsdWUsIHZvaWQ+Ojp0eXBlIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46Ol9faW5pdDxjaGFyIGNvbnN0Kj4oY2hhciBjb25zdCosIGNoYXIgY29uc3QqKd4FQHN0ZDo6X18yOjpjb2xsYXRlPGNoYXI+Ojpkb19oYXNoKGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KikgY29uc3TfBWxzdGQ6Ol9fMjo6Y29sbGF0ZTx3Y2hhcl90Pjo6ZG9fY29tcGFyZSh3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0KikgY29uc3TgBU5zdGQ6Ol9fMjo6Y29sbGF0ZTx3Y2hhcl90Pjo6ZG9fdHJhbnNmb3JtKHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0KikgY29uc3ThBeQBc3RkOjpfXzI6OmVuYWJsZV9pZjxfX2lzX2ZvcndhcmRfaXRlcmF0b3I8d2NoYXJfdCBjb25zdCo+Ojp2YWx1ZSwgdm9pZD46OnR5cGUgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6X19pbml0PHdjaGFyX3QgY29uc3QqPih3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdCop4gVJc3RkOjpfXzI6OmNvbGxhdGU8d2NoYXJfdD46OmRvX2hhc2god2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqKSBjb25zdOMFmgJzdGQ6Ol9fMjo6bnVtX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBib29sJikgY29uc3TkBWdzdGQ6Ol9fMjo6bnVtcHVuY3Q8Y2hhcj4gY29uc3QmIHN0ZDo6X18yOjp1c2VfZmFjZXQ8c3RkOjpfXzI6Om51bXB1bmN0PGNoYXI+ID4oc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYp5QWkBXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QqIHN0ZDo6X18yOjpfX3NjYW5fa2V5d29yZDxzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCosIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiA+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QqLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0Kiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JiwgdW5zaWduZWQgaW50JiwgYm9vbCnmBThzdGQ6Ol9fMjo6bG9jYWxlOjp1c2VfZmFjZXQoc3RkOjpfXzI6OmxvY2FsZTo6aWQmKSBjb25zdOcFzAFzdGQ6Ol9fMjo6dW5pcXVlX3B0cjx1bnNpZ25lZCBjaGFyLCB2b2lkICgqKSh2b2lkKik+Ojp1bmlxdWVfcHRyPHRydWUsIHZvaWQ+KHVuc2lnbmVkIGNoYXIqLCBzdGQ6Ol9fMjo6X19kZXBlbmRlbnRfdHlwZTxzdGQ6Ol9fMjo6X191bmlxdWVfcHRyX2RlbGV0ZXJfc2ZpbmFlPHZvaWQgKCopKHZvaWQqKT4sIHRydWU+OjpfX2dvb2RfcnZhbF9yZWZfdHlwZSnoBZoCc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgbG9uZyYpIGNvbnN06QXrAnN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+IHN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZG9fZ2V0X3NpZ25lZDxsb25nPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGxvbmcmKSBjb25zdOoFOXN0ZDo6X18yOjpfX251bV9nZXRfYmFzZTo6X19nZXRfYmFzZShzdGQ6Ol9fMjo6aW9zX2Jhc2UmKesFSHN0ZDo6X18yOjpfX251bV9nZXQ8Y2hhcj46Ol9fc3RhZ2UyX2ludF9wcmVwKHN0ZDo6X18yOjppb3NfYmFzZSYsIGNoYXImKewFZXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OmJhc2ljX3N0cmluZygp7QVsc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6cmVzaXplKHVuc2lnbmVkIGxvbmcp7gXlAXN0ZDo6X18yOjpfX251bV9nZXQ8Y2hhcj46Ol9fc3RhZ2UyX2ludF9sb29wKGNoYXIsIGludCwgY2hhciosIGNoYXIqJiwgdW5zaWduZWQgaW50JiwgY2hhciwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCYsIHVuc2lnbmVkIGludCosIHVuc2lnbmVkIGludComLCBjaGFyIGNvbnN0KinvBVxsb25nIHN0ZDo6X18yOjpfX251bV9nZXRfc2lnbmVkX2ludGVncmFsPGxvbmc+KGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgaW50JiwgaW50KfAFpQFzdGQ6Ol9fMjo6X19jaGVja19ncm91cGluZyhzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0JiwgdW5zaWduZWQgaW50KiwgdW5zaWduZWQgaW50KiwgdW5zaWduZWQgaW50JinxBZ8Cc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgbG9uZyBsb25nJikgY29uc3TyBfUCc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19kb19nZXRfc2lnbmVkPGxvbmcgbG9uZz4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBsb25nIGxvbmcmKSBjb25zdPMFZmxvbmcgbG9uZyBzdGQ6Ol9fMjo6X19udW1fZ2V0X3NpZ25lZF9pbnRlZ3JhbDxsb25nIGxvbmc+KGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgaW50JiwgaW50KfQFpAJzdGQ6Ol9fMjo6bnVtX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB1bnNpZ25lZCBzaG9ydCYpIGNvbnN09QWBA3N0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+IHN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZG9fZ2V0X3Vuc2lnbmVkPHVuc2lnbmVkIHNob3J0PihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHVuc2lnbmVkIHNob3J0JikgY29uc3T2BXJ1bnNpZ25lZCBzaG9ydCBzdGQ6Ol9fMjo6X19udW1fZ2V0X3Vuc2lnbmVkX2ludGVncmFsPHVuc2lnbmVkIHNob3J0PihjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGludCYsIGludCn3BaICc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdW5zaWduZWQgaW50JikgY29uc3T4Bf0Cc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19kb19nZXRfdW5zaWduZWQ8dW5zaWduZWQgaW50PihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHVuc2lnbmVkIGludCYpIGNvbnN0+QVudW5zaWduZWQgaW50IHN0ZDo6X18yOjpfX251bV9nZXRfdW5zaWduZWRfaW50ZWdyYWw8dW5zaWduZWQgaW50PihjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGludCYsIGludCn6BagCc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdW5zaWduZWQgbG9uZyBsb25nJikgY29uc3T7BYkDc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19kb19nZXRfdW5zaWduZWQ8dW5zaWduZWQgbG9uZyBsb25nPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHVuc2lnbmVkIGxvbmcgbG9uZyYpIGNvbnN0/AV6dW5zaWduZWQgbG9uZyBsb25nIHN0ZDo6X18yOjpfX251bV9nZXRfdW5zaWduZWRfaW50ZWdyYWw8dW5zaWduZWQgbG9uZyBsb25nPihjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGludCYsIGludCn9BZsCc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgZmxvYXQmKSBjb25zdP4F9QJzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiBzdGQ6Ol9fMjo6bnVtX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2RvX2dldF9mbG9hdGluZ19wb2ludDxmbG9hdD4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBmbG9hdCYpIGNvbnN0/wVYc3RkOjpfXzI6Ol9fbnVtX2dldDxjaGFyPjo6X19zdGFnZTJfZmxvYXRfcHJlcChzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCBjaGFyKiwgY2hhciYsIGNoYXImKYAG8AFzdGQ6Ol9fMjo6X19udW1fZ2V0PGNoYXI+OjpfX3N0YWdlMl9mbG9hdF9sb29wKGNoYXIsIGJvb2wmLCBjaGFyJiwgY2hhciosIGNoYXIqJiwgY2hhciwgY2hhciwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCYsIHVuc2lnbmVkIGludCosIHVuc2lnbmVkIGludComLCB1bnNpZ25lZCBpbnQmLCBjaGFyKimBBk9mbG9hdCBzdGQ6Ol9fMjo6X19udW1fZ2V0X2Zsb2F0PGZsb2F0PihjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGludCYpggacAnN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGRvdWJsZSYpIGNvbnN0gwb3AnN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+IHN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZG9fZ2V0X2Zsb2F0aW5nX3BvaW50PGRvdWJsZT4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBkb3VibGUmKSBjb25zdIQGUWRvdWJsZSBzdGQ6Ol9fMjo6X19udW1fZ2V0X2Zsb2F0PGRvdWJsZT4oY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBpbnQmKYUGoQJzdGQ6Ol9fMjo6bnVtX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBsb25nIGRvdWJsZSYpIGNvbnN0hgaBA3N0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+IHN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZG9fZ2V0X2Zsb2F0aW5nX3BvaW50PGxvbmcgZG91YmxlPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGxvbmcgZG91YmxlJikgY29uc3SHBltsb25nIGRvdWJsZSBzdGQ6Ol9fMjo6X19udW1fZ2V0X2Zsb2F0PGxvbmcgZG91YmxlPihjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGludCYpiAabAnN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHZvaWQqJikgY29uc3SJBhJzdGQ6Ol9fMjo6X19jbG9jKCmKBkxzdGQ6Ol9fMjo6X19saWJjcHBfc3NjYW5mX2woY2hhciBjb25zdCosIF9fbG9jYWxlX3N0cnVjdCosIGNoYXIgY29uc3QqLCAuLi4piwZfc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6X196ZXJvKCmMBlRjaGFyIGNvbnN0KiBzdGQ6Ol9fMjo6ZmluZDxjaGFyIGNvbnN0KiwgY2hhcj4oY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0JimNBklzdGQ6Ol9fMjo6X19saWJjcHBfbG9jYWxlX2d1YXJkOjpfX2xpYmNwcF9sb2NhbGVfZ3VhcmQoX19sb2NhbGVfc3RydWN0KiYpjgavAnN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGJvb2wmKSBjb25zdI8GbXN0ZDo6X18yOjpudW1wdW5jdDx3Y2hhcl90PiBjb25zdCYgc3RkOjpfXzI6OnVzZV9mYWNldDxzdGQ6Ol9fMjo6bnVtcHVuY3Q8d2NoYXJfdD4gPihzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JimQBuAFc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiBjb25zdCogc3RkOjpfXzI6Ol9fc2Nhbl9rZXl3b3JkPHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+IGNvbnN0Kiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+ID4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiBjb25zdCosIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4gY29uc3QqLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmLCB1bnNpZ25lZCBpbnQmLCBib29sKZEGrwJzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBsb25nJikgY29uc3SSBoYDc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19kb19nZXRfc2lnbmVkPGxvbmc+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgbG9uZyYpIGNvbnN0kwZNc3RkOjpfXzI6Ol9fbnVtX2dldDx3Y2hhcl90Pjo6X19kb193aWRlbihzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90KikgY29uc3SUBk5zdGQ6Ol9fMjo6X19udW1fZ2V0PHdjaGFyX3Q+OjpfX3N0YWdlMl9pbnRfcHJlcChzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90JimVBvEBc3RkOjpfXzI6Ol9fbnVtX2dldDx3Y2hhcl90Pjo6X19zdGFnZTJfaW50X2xvb3Aod2NoYXJfdCwgaW50LCBjaGFyKiwgY2hhciomLCB1bnNpZ25lZCBpbnQmLCB3Y2hhcl90LCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0JiwgdW5zaWduZWQgaW50KiwgdW5zaWduZWQgaW50KiYsIHdjaGFyX3QgY29uc3QqKZYGtAJzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBsb25nIGxvbmcmKSBjb25zdJcGkANzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiBzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2RvX2dldF9zaWduZWQ8bG9uZyBsb25nPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGxvbmcgbG9uZyYpIGNvbnN0mAa5AnN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHVuc2lnbmVkIHNob3J0JikgY29uc3SZBpwDc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19kb19nZXRfdW5zaWduZWQ8dW5zaWduZWQgc2hvcnQ+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdW5zaWduZWQgc2hvcnQmKSBjb25zdJoGtwJzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB1bnNpZ25lZCBpbnQmKSBjb25zdJsGmANzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiBzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2RvX2dldF91bnNpZ25lZDx1bnNpZ25lZCBpbnQ+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdW5zaWduZWQgaW50JikgY29uc3ScBr0Cc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdW5zaWduZWQgbG9uZyBsb25nJikgY29uc3SdBqQDc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19kb19nZXRfdW5zaWduZWQ8dW5zaWduZWQgbG9uZyBsb25nPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHVuc2lnbmVkIGxvbmcgbG9uZyYpIGNvbnN0ngawAnN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGZsb2F0JikgY29uc3SfBpADc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19kb19nZXRfZmxvYXRpbmdfcG9pbnQ8ZmxvYXQ+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgZmxvYXQmKSBjb25zdKAGZHN0ZDo6X18yOjpfX251bV9nZXQ8d2NoYXJfdD46Ol9fc3RhZ2UyX2Zsb2F0X3ByZXAoc3RkOjpfXzI6Omlvc19iYXNlJiwgd2NoYXJfdCosIHdjaGFyX3QmLCB3Y2hhcl90JimhBv8Bc3RkOjpfXzI6Ol9fbnVtX2dldDx3Y2hhcl90Pjo6X19zdGFnZTJfZmxvYXRfbG9vcCh3Y2hhcl90LCBib29sJiwgY2hhciYsIGNoYXIqLCBjaGFyKiYsIHdjaGFyX3QsIHdjaGFyX3QsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QmLCB1bnNpZ25lZCBpbnQqLCB1bnNpZ25lZCBpbnQqJiwgdW5zaWduZWQgaW50Jiwgd2NoYXJfdCopogaxAnN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGRvdWJsZSYpIGNvbnN0owaSA3N0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+IHN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZG9fZ2V0X2Zsb2F0aW5nX3BvaW50PGRvdWJsZT4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBkb3VibGUmKSBjb25zdKQGtgJzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBsb25nIGRvdWJsZSYpIGNvbnN0pQacA3N0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+IHN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZG9fZ2V0X2Zsb2F0aW5nX3BvaW50PGxvbmcgZG91YmxlPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGxvbmcgZG91YmxlJikgY29uc3SmBrACc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50Jiwgdm9pZComKSBjb25zdKcGZndjaGFyX3QgY29uc3QqIHN0ZDo6X18yOjpmaW5kPHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90Pih3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QmKagGZ3djaGFyX3QgY29uc3QqIHN0ZDo6X18yOjpfX251bV9nZXQ8d2NoYXJfdD46Ol9fZG9fd2lkZW5fcDx3Y2hhcl90PihzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90KikgY29uc3SpBs0Bc3RkOjpfXzI6Om51bV9wdXQ8Y2hhciwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCBjaGFyLCBib29sKSBjb25zdKoGXnN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OmJlZ2luKCmrBlxzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjplbmQoKawGzQFzdGQ6Ol9fMjo6bnVtX3B1dDxjaGFyLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIGNoYXIsIGxvbmcpIGNvbnN0rQZOc3RkOjpfXzI6Ol9fbnVtX3B1dF9iYXNlOjpfX2Zvcm1hdF9pbnQoY2hhciosIGNoYXIgY29uc3QqLCBib29sLCB1bnNpZ25lZCBpbnQprgZXc3RkOjpfXzI6Ol9fbGliY3BwX3NucHJpbnRmX2woY2hhciosIHVuc2lnbmVkIGxvbmcsIF9fbG9jYWxlX3N0cnVjdCosIGNoYXIgY29uc3QqLCAuLi4prwZVc3RkOjpfXzI6Ol9fbnVtX3B1dF9iYXNlOjpfX2lkZW50aWZ5X3BhZGRpbmcoY2hhciosIGNoYXIqLCBzdGQ6Ol9fMjo6aW9zX2Jhc2UgY29uc3QmKbAGdXN0ZDo6X18yOjpfX251bV9wdXQ8Y2hhcj46Ol9fd2lkZW5fYW5kX2dyb3VwX2ludChjaGFyKiwgY2hhciosIGNoYXIqLCBjaGFyKiwgY2hhciomLCBjaGFyKiYsIHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKbEGK3ZvaWQgc3RkOjpfXzI6OnJldmVyc2U8Y2hhcio+KGNoYXIqLCBjaGFyKimyBiFzdGQ6Ol9fMjo6aW9zX2Jhc2U6OndpZHRoKCkgY29uc3SzBtIBc3RkOjpfXzI6Om51bV9wdXQ8Y2hhciwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCBjaGFyLCBsb25nIGxvbmcpIGNvbnN0tAbWAXN0ZDo6X18yOjpudW1fcHV0PGNoYXIsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgY2hhciwgdW5zaWduZWQgbG9uZykgY29uc3S1BtsBc3RkOjpfXzI6Om51bV9wdXQ8Y2hhciwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCBjaGFyLCB1bnNpZ25lZCBsb25nIGxvbmcpIGNvbnN0tgbPAXN0ZDo6X18yOjpudW1fcHV0PGNoYXIsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgY2hhciwgZG91YmxlKSBjb25zdLcGSnN0ZDo6X18yOjpfX251bV9wdXRfYmFzZTo6X19mb3JtYXRfZmxvYXQoY2hhciosIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBpbnQpuAYlc3RkOjpfXzI6Omlvc19iYXNlOjpwcmVjaXNpb24oKSBjb25zdLkGSXN0ZDo6X18yOjpfX2xpYmNwcF9hc3ByaW50Zl9sKGNoYXIqKiwgX19sb2NhbGVfc3RydWN0KiwgY2hhciBjb25zdCosIC4uLim6BndzdGQ6Ol9fMjo6X19udW1fcHV0PGNoYXI+OjpfX3dpZGVuX2FuZF9ncm91cF9mbG9hdChjaGFyKiwgY2hhciosIGNoYXIqLCBjaGFyKiwgY2hhciomLCBjaGFyKiYsIHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKbsG1AFzdGQ6Ol9fMjo6bnVtX3B1dDxjaGFyLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIGNoYXIsIGxvbmcgZG91YmxlKSBjb25zdLwG1AFzdGQ6Ol9fMjo6bnVtX3B1dDxjaGFyLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIGNoYXIsIHZvaWQgY29uc3QqKSBjb25zdL0G3wFzdGQ6Ol9fMjo6bnVtX3B1dDx3Y2hhcl90LCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHdjaGFyX3QsIGJvb2wpIGNvbnN0vgZlc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6ZW5kKCm/Bt8Bc3RkOjpfXzI6Om51bV9wdXQ8d2NoYXJfdCwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90LCBsb25nKSBjb25zdMAGgQFzdGQ6Ol9fMjo6X19udW1fcHV0PHdjaGFyX3Q+OjpfX3dpZGVuX2FuZF9ncm91cF9pbnQoY2hhciosIGNoYXIqLCBjaGFyKiwgd2NoYXJfdCosIHdjaGFyX3QqJiwgd2NoYXJfdComLCBzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JinBBqMCc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gc3RkOjpfXzI6Ol9fcGFkX2FuZF9vdXRwdXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4oc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdCosIHN0ZDo6X18yOjppb3NfYmFzZSYsIHdjaGFyX3QpwgY0dm9pZCBzdGQ6Ol9fMjo6cmV2ZXJzZTx3Y2hhcl90Kj4od2NoYXJfdCosIHdjaGFyX3QqKcMGhAFzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+OjpiYXNpY19zdHJpbmcodW5zaWduZWQgbG9uZywgd2NoYXJfdCnEBuQBc3RkOjpfXzI6Om51bV9wdXQ8d2NoYXJfdCwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90LCBsb25nIGxvbmcpIGNvbnN0xQboAXN0ZDo6X18yOjpudW1fcHV0PHdjaGFyX3QsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgd2NoYXJfdCwgdW5zaWduZWQgbG9uZykgY29uc3TGBu0Bc3RkOjpfXzI6Om51bV9wdXQ8d2NoYXJfdCwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90LCB1bnNpZ25lZCBsb25nIGxvbmcpIGNvbnN0xwbhAXN0ZDo6X18yOjpudW1fcHV0PHdjaGFyX3QsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgd2NoYXJfdCwgZG91YmxlKSBjb25zdMgGgwFzdGQ6Ol9fMjo6X19udW1fcHV0PHdjaGFyX3Q+OjpfX3dpZGVuX2FuZF9ncm91cF9mbG9hdChjaGFyKiwgY2hhciosIGNoYXIqLCB3Y2hhcl90Kiwgd2NoYXJfdComLCB3Y2hhcl90KiYsIHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKckG5gFzdGQ6Ol9fMjo6bnVtX3B1dDx3Y2hhcl90LCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHdjaGFyX3QsIGxvbmcgZG91YmxlKSBjb25zdMoG5gFzdGQ6Ol9fMjo6bnVtX3B1dDx3Y2hhcl90LCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHdjaGFyX3QsIHZvaWQgY29uc3QqKSBjb25zdMsGU3ZvaWQgc3RkOjpfXzI6Ol9fcmV2ZXJzZTxjaGFyKj4oY2hhciosIGNoYXIqLCBzdGQ6Ol9fMjo6cmFuZG9tX2FjY2Vzc19pdGVyYXRvcl90YWcpzAZcdm9pZCBzdGQ6Ol9fMjo6X19yZXZlcnNlPHdjaGFyX3QqPih3Y2hhcl90Kiwgd2NoYXJfdCosIHN0ZDo6X18yOjpyYW5kb21fYWNjZXNzX2l0ZXJhdG9yX3RhZynNBrACc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmdldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHRtKiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqKSBjb25zdM4Gc3N0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19kYXRlX29yZGVyKCkgY29uc3TPBp4Cc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldF90aW1lKHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdG0qKSBjb25zdNAGngJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0X2RhdGUoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB0bSopIGNvbnN00QahAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXRfd2Vla2RheShzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHRtKikgY29uc3TSBq8Cc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0X3dlZWtkYXluYW1lKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYpIGNvbnN00wajAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXRfbW9udGhuYW1lKHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdG0qKSBjb25zdNQGrQJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfbW9udGhuYW1lKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYpIGNvbnN01QaeAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXRfeWVhcihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHRtKikgY29uc3TWBqgCc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0X3llYXIoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JikgY29uc3TXBqUCaW50IHN0ZDo6X18yOjpfX2dldF91cF90b19uX2RpZ2l0czxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYsIGludCnYBqUCc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHRtKiwgY2hhciwgY2hhcikgY29uc3TZBqUCc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0X3BlcmNlbnQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JikgY29uc3TaBqcCc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0X2RheShpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdNsGqAJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfaG91cihpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdNwGqwJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfMTJfaG91cihpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdN0GsAJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfZGF5X3llYXJfbnVtKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYpIGNvbnN03gapAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2dldF9tb250aChpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdN8GqgJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfbWludXRlKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYpIGNvbnN04AapAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2dldF93aGl0ZV9zcGFjZShzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdOEGqQJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfYW1fcG0oaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JikgY29uc3TiBqoCc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0X3NlY29uZChpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdOMGqwJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfd2Vla2RheShpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdOQGqQJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfeWVhcjQoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JikgY29uc3TlBssCc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmdldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHRtKiwgd2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqKSBjb25zdOYGswJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0X3RpbWUoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB0bSopIGNvbnN05wazAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXRfZGF0ZShzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHRtKikgY29uc3ToBrYCc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldF93ZWVrZGF5KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdG0qKSBjb25zdOkGxwJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfd2Vla2RheW5hbWUoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JikgY29uc3TqBrgCc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldF9tb250aG5hbWUoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB0bSopIGNvbnN06wbFAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF9tb250aG5hbWUoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JikgY29uc3TsBrMCc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldF95ZWFyKHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdG0qKSBjb25zdO0GwAJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfeWVhcihpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmKSBjb25zdO4GvQJpbnQgc3RkOjpfXzI6Ol9fZ2V0X3VwX3RvX25fZGlnaXRzPHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JiwgaW50Ke8GugJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdG0qLCBjaGFyLCBjaGFyKSBjb25zdPAGvQJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfcGVyY2VudChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmKSBjb25zdPEGvwJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfZGF5KGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN08gbAAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF9ob3VyKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN08wbDAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF8xMl9ob3VyKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN09AbIAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF9kYXlfeWVhcl9udW0oaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JikgY29uc3T1BsECc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZ2V0X21vbnRoKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN09gbCAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF9taW51dGUoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JikgY29uc3T3BsECc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZ2V0X3doaXRlX3NwYWNlKHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN0+AbBAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF9hbV9wbShpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmKSBjb25zdPkGwgJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfc2Vjb25kKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN0+gbDAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF93ZWVrZGF5KGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN0+wbBAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF95ZWFyNChpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmKSBjb25zdPwG3wFzdGQ6Ol9fMjo6dGltZV9wdXQ8Y2hhciwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCBjaGFyLCB0bSBjb25zdCosIGNoYXIsIGNoYXIpIGNvbnN0/QZKc3RkOjpfXzI6Ol9fdGltZV9wdXQ6Ol9fZG9fcHV0KGNoYXIqLCBjaGFyKiYsIHRtIGNvbnN0KiwgY2hhciwgY2hhcikgY29uc3T+Bo0Bc3RkOjpfXzI6OmVuYWJsZV9pZjwoaXNfbW92ZV9jb25zdHJ1Y3RpYmxlPGNoYXI+Ojp2YWx1ZSkgJiYgKGlzX21vdmVfYXNzaWduYWJsZTxjaGFyPjo6dmFsdWUpLCB2b2lkPjo6dHlwZSBzdGQ6Ol9fMjo6c3dhcDxjaGFyPihjaGFyJiwgY2hhciYp/wbuAXN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+IHN0ZDo6X18yOjpfX2NvcHk8Y2hhciosIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID4oY2hhciosIGNoYXIqLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPimAB/EBc3RkOjpfXzI6OnRpbWVfcHV0PHdjaGFyX3QsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgd2NoYXJfdCwgdG0gY29uc3QqLCBjaGFyLCBjaGFyKSBjb25zdIEHUHN0ZDo6X18yOjpfX3RpbWVfcHV0OjpfX2RvX3B1dCh3Y2hhcl90Kiwgd2NoYXJfdComLCB0bSBjb25zdCosIGNoYXIsIGNoYXIpIGNvbnN0ggdlc3RkOjpfXzI6Ol9fbGliY3BwX21ic3J0b3djc19sKHdjaGFyX3QqLCBjaGFyIGNvbnN0KiosIHVuc2lnbmVkIGxvbmcsIF9fbWJzdGF0ZV90KiwgX19sb2NhbGVfc3RydWN0KimDByxzdGQ6Ol9fMjo6X190aHJvd19ydW50aW1lX2Vycm9yKGNoYXIgY29uc3QqKYQHiQJzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiBzdGQ6Ol9fMjo6X19jb3B5PHdjaGFyX3QqLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+KHdjaGFyX3QqLCB3Y2hhcl90Kiwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4phQc7c3RkOjpfXzI6Om1vbmV5cHVuY3Q8Y2hhciwgZmFsc2U+Ojpkb19kZWNpbWFsX3BvaW50KCkgY29uc3SGBzZzdGQ6Ol9fMjo6bW9uZXlwdW5jdDxjaGFyLCBmYWxzZT46OmRvX2dyb3VwaW5nKCkgY29uc3SHBztzdGQ6Ol9fMjo6bW9uZXlwdW5jdDxjaGFyLCBmYWxzZT46OmRvX25lZ2F0aXZlX3NpZ24oKSBjb25zdIgHOHN0ZDo6X18yOjptb25leXB1bmN0PGNoYXIsIGZhbHNlPjo6ZG9fcG9zX2Zvcm1hdCgpIGNvbnN0iQc+c3RkOjpfXzI6Om1vbmV5cHVuY3Q8d2NoYXJfdCwgZmFsc2U+Ojpkb19kZWNpbWFsX3BvaW50KCkgY29uc3SKBz5zdGQ6Ol9fMjo6bW9uZXlwdW5jdDx3Y2hhcl90LCBmYWxzZT46OmRvX25lZ2F0aXZlX3NpZ24oKSBjb25zdIsHqQJzdGQ6Ol9fMjo6bW9uZXlfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIGJvb2wsIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGxvbmcgZG91YmxlJikgY29uc3SMB4wDc3RkOjpfXzI6Om1vbmV5X2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2RvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBib29sLCBzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JiwgdW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQmLCBib29sJiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0Jiwgc3RkOjpfXzI6OnVuaXF1ZV9wdHI8Y2hhciwgdm9pZCAoKikodm9pZCopPiYsIGNoYXIqJiwgY2hhciopjQfdA3N0ZDo6X18yOjpfX21vbmV5X2dldDxjaGFyPjo6X19nYXRoZXJfaW5mbyhib29sLCBzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0Jiwgc3RkOjpfXzI6Om1vbmV5X2Jhc2U6OnBhdHRlcm4mLCBjaGFyJiwgY2hhciYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4mLCBpbnQmKY4HUnN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpvcGVyYXRvcisrKGludCmPB2Z2b2lkIHN0ZDo6X18yOjpfX2RvdWJsZV9vcl9ub3RoaW5nPGNoYXI+KHN0ZDo6X18yOjp1bmlxdWVfcHRyPGNoYXIsIHZvaWQgKCopKHZvaWQqKT4mLCBjaGFyKiYsIGNoYXIqJimQB4YBdm9pZCBzdGQ6Ol9fMjo6X19kb3VibGVfb3Jfbm90aGluZzx1bnNpZ25lZCBpbnQ+KHN0ZDo6X18yOjp1bmlxdWVfcHRyPHVuc2lnbmVkIGludCwgdm9pZCAoKikodm9pZCopPiYsIHVuc2lnbmVkIGludComLCB1bnNpZ25lZCBpbnQqJimRB/MCc3RkOjpfXzI6Om1vbmV5X2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBib29sLCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+JikgY29uc3SSB15zdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpjbGVhcigpkwfaAXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4mIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46Ol9fYXBwZW5kX2ZvcndhcmRfdW5zYWZlPGNoYXIqPihjaGFyKiwgY2hhcioplAd3c3RkOjpfXzI6Om1vbmV5cHVuY3Q8Y2hhciwgdHJ1ZT4gY29uc3QmIHN0ZDo6X18yOjp1c2VfZmFjZXQ8c3RkOjpfXzI6Om1vbmV5cHVuY3Q8Y2hhciwgdHJ1ZT4gPihzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JimVB7kBc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6b3BlcmF0b3I9KHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4mJimWB3lzdGQ6Ol9fMjo6bW9uZXlwdW5jdDxjaGFyLCBmYWxzZT4gY29uc3QmIHN0ZDo6X18yOjp1c2VfZmFjZXQ8c3RkOjpfXzI6Om1vbmV5cHVuY3Q8Y2hhciwgZmFsc2U+ID4oc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYplwfvAWJvb2wgc3RkOjpfXzI6OmVxdWFsPHN0ZDo6X18yOjpfX3dyYXBfaXRlcjxjaGFyKj4sIHN0ZDo6X18yOjpfX3dyYXBfaXRlcjxjaGFyKj4sIHN0ZDo6X18yOjpfX2VxdWFsX3RvPGNoYXIsIGNoYXI+ID4oc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPGNoYXIqPiwgc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPGNoYXIqPiwgc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPGNoYXIqPiwgc3RkOjpfXzI6Ol9fZXF1YWxfdG88Y2hhciwgY2hhcj4pmAczc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPGNoYXIqPjo6b3BlcmF0b3IrKGxvbmcpIGNvbnN0mQdlc3RkOjpfXzI6OnVuaXF1ZV9wdHI8Y2hhciwgdm9pZCAoKikodm9pZCopPjo6b3BlcmF0b3I9KHN0ZDo6X18yOjp1bmlxdWVfcHRyPGNoYXIsIHZvaWQgKCopKHZvaWQqKT4mJimaB74Cc3RkOjpfXzI6Om1vbmV5X2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBib29sLCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBsb25nIGRvdWJsZSYpIGNvbnN0mwetA3N0ZDo6X18yOjptb25leV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19kb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgYm9vbCwgc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50JiwgYm9vbCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYsIHN0ZDo6X18yOjp1bmlxdWVfcHRyPHdjaGFyX3QsIHZvaWQgKCopKHZvaWQqKT4mLCB3Y2hhcl90KiYsIHdjaGFyX3QqKZwHgQRzdGQ6Ol9fMjo6X19tb25leV9nZXQ8d2NoYXJfdD46Ol9fZ2F0aGVyX2luZm8oYm9vbCwgc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYsIHN0ZDo6X18yOjptb25leV9iYXNlOjpwYXR0ZXJuJiwgd2NoYXJfdCYsIHdjaGFyX3QmLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+JiwgaW50JimdB1hzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6b3BlcmF0b3IrKyhpbnQpngeRA3N0ZDo6X18yOjptb25leV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgYm9vbCwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiYpIGNvbnN0nwdnc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6Y2xlYXIoKaAH9QFzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+JiBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+OjpfX2FwcGVuZF9mb3J3YXJkX3Vuc2FmZTx3Y2hhcl90Kj4od2NoYXJfdCosIHdjaGFyX3QqKaEHfXN0ZDo6X18yOjptb25leXB1bmN0PHdjaGFyX3QsIHRydWU+IGNvbnN0JiBzdGQ6Ol9fMjo6dXNlX2ZhY2V0PHN0ZDo6X18yOjptb25leXB1bmN0PHdjaGFyX3QsIHRydWU+ID4oc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYpogfLAXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID46Om9wZXJhdG9yPShzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+JiYpowd/c3RkOjpfXzI6Om1vbmV5cHVuY3Q8d2NoYXJfdCwgZmFsc2U+IGNvbnN0JiBzdGQ6Ol9fMjo6dXNlX2ZhY2V0PHN0ZDo6X18yOjptb25leXB1bmN0PHdjaGFyX3QsIGZhbHNlPiA+KHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKaQHigJib29sIHN0ZDo6X18yOjplcXVhbDxzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8d2NoYXJfdCo+LCBzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8d2NoYXJfdCo+LCBzdGQ6Ol9fMjo6X19lcXVhbF90bzx3Y2hhcl90LCB3Y2hhcl90PiA+KHN0ZDo6X18yOjpfX3dyYXBfaXRlcjx3Y2hhcl90Kj4sIHN0ZDo6X18yOjpfX3dyYXBfaXRlcjx3Y2hhcl90Kj4sIHN0ZDo6X18yOjpfX3dyYXBfaXRlcjx3Y2hhcl90Kj4sIHN0ZDo6X18yOjpfX2VxdWFsX3RvPHdjaGFyX3QsIHdjaGFyX3Q+KaUHNnN0ZDo6X18yOjpfX3dyYXBfaXRlcjx3Y2hhcl90Kj46Om9wZXJhdG9yKyhsb25nKSBjb25zdKYH3AFzdGQ6Ol9fMjo6bW9uZXlfcHV0PGNoYXIsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgYm9vbCwgc3RkOjpfXzI6Omlvc19iYXNlJiwgY2hhciwgbG9uZyBkb3VibGUpIGNvbnN0pweLA3N0ZDo6X18yOjpfX21vbmV5X3B1dDxjaGFyPjo6X19nYXRoZXJfaW5mbyhib29sLCBib29sLCBzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0Jiwgc3RkOjpfXzI6Om1vbmV5X2Jhc2U6OnBhdHRlcm4mLCBjaGFyJiwgY2hhciYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiYsIGludCYpqAfZA3N0ZDo6X18yOjpfX21vbmV5X3B1dDxjaGFyPjo6X19mb3JtYXQoY2hhciosIGNoYXIqJiwgY2hhciomLCB1bnNpZ25lZCBpbnQsIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0Kiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JiwgYm9vbCwgc3RkOjpfXzI6Om1vbmV5X2Jhc2U6OnBhdHRlcm4gY29uc3QmLCBjaGFyLCBjaGFyLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QmLCBpbnQpqQeOAWNoYXIqIHN0ZDo6X18yOjpjb3B5PHN0ZDo6X18yOjpfX3dyYXBfaXRlcjxjaGFyIGNvbnN0Kj4sIGNoYXIqPihzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8Y2hhciBjb25zdCo+LCBzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8Y2hhciBjb25zdCo+LCBjaGFyKimqB60Cc3RkOjpfXzI6Om1vbmV5X3B1dDxjaGFyLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIGJvb2wsIHN0ZDo6X18yOjppb3NfYmFzZSYsIGNoYXIsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QmKSBjb25zdKsH7gFzdGQ6Ol9fMjo6bW9uZXlfcHV0PHdjaGFyX3QsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgYm9vbCwgc3RkOjpfXzI6Omlvc19iYXNlJiwgd2NoYXJfdCwgbG9uZyBkb3VibGUpIGNvbnN0rAemA3N0ZDo6X18yOjpfX21vbmV5X3B1dDx3Y2hhcl90Pjo6X19nYXRoZXJfaW5mbyhib29sLCBib29sLCBzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0Jiwgc3RkOjpfXzI6Om1vbmV5X2Jhc2U6OnBhdHRlcm4mLCB3Y2hhcl90Jiwgd2NoYXJfdCYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiYsIGludCYprQeGBHN0ZDo6X18yOjpfX21vbmV5X3B1dDx3Y2hhcl90Pjo6X19mb3JtYXQod2NoYXJfdCosIHdjaGFyX3QqJiwgd2NoYXJfdComLCB1bnNpZ25lZCBpbnQsIHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0Kiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JiwgYm9vbCwgc3RkOjpfXzI6Om1vbmV5X2Jhc2U6OnBhdHRlcm4gY29uc3QmLCB3Y2hhcl90LCB3Y2hhcl90LCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiBjb25zdCYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4gY29uc3QmLCBpbnQprgegAXdjaGFyX3QqIHN0ZDo6X18yOjpjb3B5PHN0ZDo6X18yOjpfX3dyYXBfaXRlcjx3Y2hhcl90IGNvbnN0Kj4sIHdjaGFyX3QqPihzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8d2NoYXJfdCBjb25zdCo+LCBzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8d2NoYXJfdCBjb25zdCo+LCB3Y2hhcl90KimvB8gCc3RkOjpfXzI6Om1vbmV5X3B1dDx3Y2hhcl90LCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIGJvb2wsIHN0ZDo6X18yOjppb3NfYmFzZSYsIHdjaGFyX3QsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4gY29uc3QmKSBjb25zdLAHkAFjaGFyKiBzdGQ6Ol9fMjo6X19jb3B5PHN0ZDo6X18yOjpfX3dyYXBfaXRlcjxjaGFyIGNvbnN0Kj4sIGNoYXIqPihzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8Y2hhciBjb25zdCo+LCBzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8Y2hhciBjb25zdCo+LCBjaGFyKimxB6IBd2NoYXJfdCogc3RkOjpfXzI6Ol9fY29weTxzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8d2NoYXJfdCBjb25zdCo+LCB3Y2hhcl90Kj4oc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPHdjaGFyX3QgY29uc3QqPiwgc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPHdjaGFyX3QgY29uc3QqPiwgd2NoYXJfdCopsgeeAXN0ZDo6X18yOjptZXNzYWdlczxjaGFyPjo6ZG9fb3BlbihzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0Jiwgc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYpIGNvbnN0sweUAXN0ZDo6X18yOjptZXNzYWdlczxjaGFyPjo6ZG9fZ2V0KGxvbmcsIGludCwgaW50LCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0JikgY29uc3S0B7gDc3RkOjpfXzI6OmJhY2tfaW5zZXJ0X2l0ZXJhdG9yPHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gPiBzdGQ6Ol9fMjo6X19uYXJyb3dfdG9fdXRmODw4dWw+OjpvcGVyYXRvcigpPHN0ZDo6X18yOjpiYWNrX2luc2VydF9pdGVyYXRvcjxzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+ID4sIGNoYXI+KHN0ZDo6X18yOjpiYWNrX2luc2VydF9pdGVyYXRvcjxzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+ID4sIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KikgY29uc3S1B44Bc3RkOjpfXzI6OmJhY2tfaW5zZXJ0X2l0ZXJhdG9yPHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gPjo6b3BlcmF0b3I9KGNoYXIgY29uc3QmKbYHoAFzdGQ6Ol9fMjo6bWVzc2FnZXM8d2NoYXJfdD46OmRvX2dldChsb25nLCBpbnQsIGludCwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiBjb25zdCYpIGNvbnN0twfCA3N0ZDo6X18yOjpiYWNrX2luc2VydF9pdGVyYXRvcjxzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+ID4gc3RkOjpfXzI6Ol9fbmFycm93X3RvX3V0Zjg8MzJ1bD46Om9wZXJhdG9yKCk8c3RkOjpfXzI6OmJhY2tfaW5zZXJ0X2l0ZXJhdG9yPHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gPiwgd2NoYXJfdD4oc3RkOjpfXzI6OmJhY2tfaW5zZXJ0X2l0ZXJhdG9yPHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gPiwgd2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqKSBjb25zdLgH0ANzdGQ6Ol9fMjo6YmFja19pbnNlcnRfaXRlcmF0b3I8c3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiA+IHN0ZDo6X18yOjpfX3dpZGVuX2Zyb21fdXRmODwzMnVsPjo6b3BlcmF0b3IoKTxzdGQ6Ol9fMjo6YmFja19pbnNlcnRfaXRlcmF0b3I8c3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiA+ID4oc3RkOjpfXzI6OmJhY2tfaW5zZXJ0X2l0ZXJhdG9yPHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4gPiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqKSBjb25zdLkHOXN0ZDo6X18yOjpjb2RlY3Z0PHdjaGFyX3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6fmNvZGVjdnQoKboHLXN0ZDo6X18yOjpsb2NhbGU6Ol9faW1wOjpfX2ltcCh1bnNpZ25lZCBsb25nKbsHfnN0ZDo6X18yOjpfX3ZlY3Rvcl9iYXNlPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46Ol9fdmVjdG9yX2Jhc2UoKbwHggFzdGQ6Ol9fMjo6dmVjdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46Ol9fdmFsbG9jYXRlKHVuc2lnbmVkIGxvbmcpvQeJAXN0ZDo6X18yOjp2ZWN0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4gPjo6X19jb25zdHJ1Y3RfYXRfZW5kKHVuc2lnbmVkIGxvbmcpvgd2c3RkOjpfXzI6Ol9fdmVjdG9yX2Jhc2U8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4gPjo6Y2xlYXIoKb8HjgFzdGQ6Ol9fMjo6dmVjdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46Ol9fYW5ub3RhdGVfc2hyaW5rKHVuc2lnbmVkIGxvbmcpIGNvbnN0wAcdc3RkOjpfXzI6OmxvY2FsZTo6aWQ6Ol9fZ2V0KCnBB0BzdGQ6Ol9fMjo6bG9jYWxlOjpfX2ltcDo6aW5zdGFsbChzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIGxvbmcpwgdIc3RkOjpfXzI6OmN0eXBlPGNoYXI+OjpjdHlwZSh1bnNpZ25lZCBzaG9ydCBjb25zdCosIGJvb2wsIHVuc2lnbmVkIGxvbmcpwwcbc3RkOjpfXzI6OmxvY2FsZTo6Y2xhc3NpYygpxAd9c3RkOjpfXzI6OnZlY3RvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiA+OjpyZXNpemUodW5zaWduZWQgbG9uZynFByFzdGQ6Ol9fMjo6bG9jYWxlOjpfX2ltcDo6fl9faW1wKCnGB4EBc3RkOjpfXzI6OnZlY3RvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiA+OjpfX2Fubm90YXRlX2RlbGV0ZSgpIGNvbnN0xwcjc3RkOjpfXzI6OmxvY2FsZTo6X19pbXA6On5fX2ltcCgpLjHIB39zdGQ6Ol9fMjo6dmVjdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46Ol9fYXBwZW5kKHVuc2lnbmVkIGxvbmcpyQccc3RkOjpfXzI6OmxvY2FsZTo6X19nbG9iYWwoKcoHGnN0ZDo6X18yOjpsb2NhbGU6OmxvY2FsZSgpywcuc3RkOjpfXzI6OmxvY2FsZTo6X19pbXA6Omhhc19mYWNldChsb25nKSBjb25zdMwHHnN0ZDo6X18yOjpsb2NhbGU6OmlkOjpfX2luaXQoKc0HjAF2b2lkIHN0ZDo6X18yOjpjYWxsX29uY2U8c3RkOjpfXzI6Oihhbm9ueW1vdXMgbmFtZXNwYWNlKTo6X19mYWtlX2JpbmQ+KHN0ZDo6X18yOjpvbmNlX2ZsYWcmLCBzdGQ6Ol9fMjo6KGFub255bW91cyBuYW1lc3BhY2UpOjpfX2Zha2VfYmluZCYmKc4HK3N0ZDo6X18yOjpsb2NhbGU6OmZhY2V0OjpfX29uX3plcm9fc2hhcmVkKCnPB2l2b2lkIHN0ZDo6X18yOjpfX2NhbGxfb25jZV9wcm94eTxzdGQ6Ol9fMjo6dHVwbGU8c3RkOjpfXzI6Oihhbm9ueW1vdXMgbmFtZXNwYWNlKTo6X19mYWtlX2JpbmQmJj4gPih2b2lkKinQBz5zdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD46OmRvX2lzKHVuc2lnbmVkIHNob3J0LCB3Y2hhcl90KSBjb25zdNEHVnN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90Pjo6ZG9faXMod2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqLCB1bnNpZ25lZCBzaG9ydCopIGNvbnN00gdac3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+Ojpkb19zY2FuX2lzKHVuc2lnbmVkIHNob3J0LCB3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdCopIGNvbnN00wdbc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+Ojpkb19zY2FuX25vdCh1bnNpZ25lZCBzaG9ydCwgd2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqKSBjb25zdNQHM3N0ZDo6X18yOjpjdHlwZTx3Y2hhcl90Pjo6ZG9fdG91cHBlcih3Y2hhcl90KSBjb25zdNUHRHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90Pjo6ZG9fdG91cHBlcih3Y2hhcl90Kiwgd2NoYXJfdCBjb25zdCopIGNvbnN01gczc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+Ojpkb190b2xvd2VyKHdjaGFyX3QpIGNvbnN01wdEc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+Ojpkb190b2xvd2VyKHdjaGFyX3QqLCB3Y2hhcl90IGNvbnN0KikgY29uc3TYBy5zdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD46OmRvX3dpZGVuKGNoYXIpIGNvbnN02QdMc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+Ojpkb193aWRlbihjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHdjaGFyX3QqKSBjb25zdNoHOHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90Pjo6ZG9fbmFycm93KHdjaGFyX3QsIGNoYXIpIGNvbnN02wdWc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+Ojpkb19uYXJyb3cod2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqLCBjaGFyLCBjaGFyKikgY29uc3TcBx9zdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj46On5jdHlwZSgp3Qchc3RkOjpfXzI6OmN0eXBlPGNoYXI+Ojp+Y3R5cGUoKS4x3gctc3RkOjpfXzI6OmN0eXBlPGNoYXI+Ojpkb190b3VwcGVyKGNoYXIpIGNvbnN03wc7c3RkOjpfXzI6OmN0eXBlPGNoYXI+Ojpkb190b3VwcGVyKGNoYXIqLCBjaGFyIGNvbnN0KikgY29uc3TgBy1zdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj46OmRvX3RvbG93ZXIoY2hhcikgY29uc3ThBztzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj46OmRvX3RvbG93ZXIoY2hhciosIGNoYXIgY29uc3QqKSBjb25zdOIHRnN0ZDo6X18yOjpjdHlwZTxjaGFyPjo6ZG9fd2lkZW4oY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCBjaGFyKikgY29uc3TjBzJzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj46OmRvX25hcnJvdyhjaGFyLCBjaGFyKSBjb25zdOQHTXN0ZDo6X18yOjpjdHlwZTxjaGFyPjo6ZG9fbmFycm93KGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgY2hhciwgY2hhciopIGNvbnN05QeEAXN0ZDo6X18yOjpjb2RlY3Z0PGNoYXIsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9fb3V0KF9fbWJzdGF0ZV90JiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiYsIGNoYXIqLCBjaGFyKiwgY2hhciomKSBjb25zdOYHYHN0ZDo6X18yOjpjb2RlY3Z0PGNoYXIsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9fdW5zaGlmdChfX21ic3RhdGVfdCYsIGNoYXIqLCBjaGFyKiwgY2hhciomKSBjb25zdOcHcnN0ZDo6X18yOjpjb2RlY3Z0PGNoYXIsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9fbGVuZ3RoKF9fbWJzdGF0ZV90JiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBsb25nKSBjb25zdOgHO3N0ZDo6X18yOjpjb2RlY3Z0PHdjaGFyX3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6fmNvZGVjdnQoKS4x6QeQAXN0ZDo6X18yOjpjb2RlY3Z0PHdjaGFyX3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9fb3V0KF9fbWJzdGF0ZV90Jiwgd2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0KiYsIGNoYXIqLCBjaGFyKiwgY2hhciomKSBjb25zdOoHdXN0ZDo6X18yOjpfX2xpYmNwcF93Y3NucnRvbWJzX2woY2hhciosIHdjaGFyX3QgY29uc3QqKiwgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgX19tYnN0YXRlX3QqLCBfX2xvY2FsZV9zdHJ1Y3QqKesHTHN0ZDo6X18yOjpfX2xpYmNwcF93Y3J0b21iX2woY2hhciosIHdjaGFyX3QsIF9fbWJzdGF0ZV90KiwgX19sb2NhbGVfc3RydWN0KinsB48Bc3RkOjpfXzI6OmNvZGVjdnQ8d2NoYXJfdCwgY2hhciwgX19tYnN0YXRlX3Q+Ojpkb19pbihfX21ic3RhdGVfdCYsIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdComLCB3Y2hhcl90Kiwgd2NoYXJfdCosIHdjaGFyX3QqJikgY29uc3TtB3VzdGQ6Ol9fMjo6X19saWJjcHBfbWJzbnJ0b3djc19sKHdjaGFyX3QqLCBjaGFyIGNvbnN0KiosIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIF9fbWJzdGF0ZV90KiwgX19sb2NhbGVfc3RydWN0KinuB2JzdGQ6Ol9fMjo6X19saWJjcHBfbWJydG93Y19sKHdjaGFyX3QqLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgbG9uZywgX19tYnN0YXRlX3QqLCBfX2xvY2FsZV9zdHJ1Y3QqKe8HY3N0ZDo6X18yOjpjb2RlY3Z0PHdjaGFyX3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9fdW5zaGlmdChfX21ic3RhdGVfdCYsIGNoYXIqLCBjaGFyKiwgY2hhciomKSBjb25zdPAHQnN0ZDo6X18yOjpjb2RlY3Z0PHdjaGFyX3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9fZW5jb2RpbmcoKSBjb25zdPEHU3N0ZDo6X18yOjpfX2xpYmNwcF9tYnRvd2NfbCh3Y2hhcl90KiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGxvbmcsIF9fbG9jYWxlX3N0cnVjdCop8gcxc3RkOjpfXzI6Ol9fbGliY3BwX21iX2N1cl9tYXhfbChfX2xvY2FsZV9zdHJ1Y3QqKfMHdXN0ZDo6X18yOjpjb2RlY3Z0PHdjaGFyX3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9fbGVuZ3RoKF9fbWJzdGF0ZV90JiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBsb25nKSBjb25zdPQHV3N0ZDo6X18yOjpfX2xpYmNwcF9tYnJsZW5fbChjaGFyIGNvbnN0KiwgdW5zaWduZWQgbG9uZywgX19tYnN0YXRlX3QqLCBfX2xvY2FsZV9zdHJ1Y3QqKfUHRHN0ZDo6X18yOjpjb2RlY3Z0PHdjaGFyX3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9fbWF4X2xlbmd0aCgpIGNvbnN09geUAXN0ZDo6X18yOjpjb2RlY3Z0PGNoYXIxNl90LCBjaGFyLCBfX21ic3RhdGVfdD46OmRvX291dChfX21ic3RhdGVfdCYsIGNoYXIxNl90IGNvbnN0KiwgY2hhcjE2X3QgY29uc3QqLCBjaGFyMTZfdCBjb25zdComLCBjaGFyKiwgY2hhciosIGNoYXIqJikgY29uc3T3B7UBc3RkOjpfXzI6OnV0ZjE2X3RvX3V0ZjgodW5zaWduZWQgc2hvcnQgY29uc3QqLCB1bnNpZ25lZCBzaG9ydCBjb25zdCosIHVuc2lnbmVkIHNob3J0IGNvbnN0KiYsIHVuc2lnbmVkIGNoYXIqLCB1bnNpZ25lZCBjaGFyKiwgdW5zaWduZWQgY2hhciomLCB1bnNpZ25lZCBsb25nLCBzdGQ6Ol9fMjo6Y29kZWN2dF9tb2RlKfgHkwFzdGQ6Ol9fMjo6Y29kZWN2dDxjaGFyMTZfdCwgY2hhciwgX19tYnN0YXRlX3Q+Ojpkb19pbihfX21ic3RhdGVfdCYsIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdComLCBjaGFyMTZfdCosIGNoYXIxNl90KiwgY2hhcjE2X3QqJikgY29uc3T5B7UBc3RkOjpfXzI6OnV0ZjhfdG9fdXRmMTYodW5zaWduZWQgY2hhciBjb25zdCosIHVuc2lnbmVkIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBjaGFyIGNvbnN0KiYsIHVuc2lnbmVkIHNob3J0KiwgdW5zaWduZWQgc2hvcnQqLCB1bnNpZ25lZCBzaG9ydComLCB1bnNpZ25lZCBsb25nLCBzdGQ6Ol9fMjo6Y29kZWN2dF9tb2RlKfoHdnN0ZDo6X18yOjpjb2RlY3Z0PGNoYXIxNl90LCBjaGFyLCBfX21ic3RhdGVfdD46OmRvX2xlbmd0aChfX21ic3RhdGVfdCYsIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgbG9uZykgY29uc3T7B4ABc3RkOjpfXzI6OnV0ZjhfdG9fdXRmMTZfbGVuZ3RoKHVuc2lnbmVkIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgc3RkOjpfXzI6OmNvZGVjdnRfbW9kZSn8B0VzdGQ6Ol9fMjo6Y29kZWN2dDxjaGFyMTZfdCwgY2hhciwgX19tYnN0YXRlX3Q+Ojpkb19tYXhfbGVuZ3RoKCkgY29uc3T9B5QBc3RkOjpfXzI6OmNvZGVjdnQ8Y2hhcjMyX3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9fb3V0KF9fbWJzdGF0ZV90JiwgY2hhcjMyX3QgY29uc3QqLCBjaGFyMzJfdCBjb25zdCosIGNoYXIzMl90IGNvbnN0KiYsIGNoYXIqLCBjaGFyKiwgY2hhciomKSBjb25zdP4HrgFzdGQ6Ol9fMjo6dWNzNF90b191dGY4KHVuc2lnbmVkIGludCBjb25zdCosIHVuc2lnbmVkIGludCBjb25zdCosIHVuc2lnbmVkIGludCBjb25zdComLCB1bnNpZ25lZCBjaGFyKiwgdW5zaWduZWQgY2hhciosIHVuc2lnbmVkIGNoYXIqJiwgdW5zaWduZWQgbG9uZywgc3RkOjpfXzI6OmNvZGVjdnRfbW9kZSn/B5MBc3RkOjpfXzI6OmNvZGVjdnQ8Y2hhcjMyX3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9faW4oX19tYnN0YXRlX3QmLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqJiwgY2hhcjMyX3QqLCBjaGFyMzJfdCosIGNoYXIzMl90KiYpIGNvbnN0gAiuAXN0ZDo6X18yOjp1dGY4X3RvX3VjczQodW5zaWduZWQgY2hhciBjb25zdCosIHVuc2lnbmVkIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBjaGFyIGNvbnN0KiYsIHVuc2lnbmVkIGludCosIHVuc2lnbmVkIGludCosIHVuc2lnbmVkIGludComLCB1bnNpZ25lZCBsb25nLCBzdGQ6Ol9fMjo6Y29kZWN2dF9tb2RlKYEIdnN0ZDo6X18yOjpjb2RlY3Z0PGNoYXIzMl90LCBjaGFyLCBfX21ic3RhdGVfdD46OmRvX2xlbmd0aChfX21ic3RhdGVfdCYsIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgbG9uZykgY29uc3SCCH9zdGQ6Ol9fMjo6dXRmOF90b191Y3M0X2xlbmd0aCh1bnNpZ25lZCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgY2hhciBjb25zdCosIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIHN0ZDo6X18yOjpjb2RlY3Z0X21vZGUpgwglc3RkOjpfXzI6Om51bXB1bmN0PGNoYXI+Ojp+bnVtcHVuY3QoKYQIJ3N0ZDo6X18yOjpudW1wdW5jdDxjaGFyPjo6fm51bXB1bmN0KCkuMYUIKHN0ZDo6X18yOjpudW1wdW5jdDx3Y2hhcl90Pjo6fm51bXB1bmN0KCmGCCpzdGQ6Ol9fMjo6bnVtcHVuY3Q8d2NoYXJfdD46On5udW1wdW5jdCgpLjGHCDJzdGQ6Ol9fMjo6bnVtcHVuY3Q8Y2hhcj46OmRvX2RlY2ltYWxfcG9pbnQoKSBjb25zdIgIMnN0ZDo6X18yOjpudW1wdW5jdDxjaGFyPjo6ZG9fdGhvdXNhbmRzX3NlcCgpIGNvbnN0iQgtc3RkOjpfXzI6Om51bXB1bmN0PGNoYXI+Ojpkb19ncm91cGluZygpIGNvbnN0iggwc3RkOjpfXzI6Om51bXB1bmN0PHdjaGFyX3Q+Ojpkb19ncm91cGluZygpIGNvbnN0iwgtc3RkOjpfXzI6Om51bXB1bmN0PGNoYXI+Ojpkb190cnVlbmFtZSgpIGNvbnN0jAgwc3RkOjpfXzI6Om51bXB1bmN0PHdjaGFyX3Q+Ojpkb190cnVlbmFtZSgpIGNvbnN0jQh8c3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6YmFzaWNfc3RyaW5nKHdjaGFyX3QgY29uc3QqKY4ILnN0ZDo6X18yOjpudW1wdW5jdDxjaGFyPjo6ZG9fZmFsc2VuYW1lKCkgY29uc3SPCDFzdGQ6Ol9fMjo6bnVtcHVuY3Q8d2NoYXJfdD46OmRvX2ZhbHNlbmFtZSgpIGNvbnN0kAhtc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6b3BlcmF0b3I9KGNoYXIgY29uc3QqKZEINXN0ZDo6X18yOjpfX3RpbWVfZ2V0X2Nfc3RvcmFnZTxjaGFyPjo6X193ZWVrcygpIGNvbnN0kggWc3RkOjpfXzI6OmluaXRfd2Vla3MoKZMIGl9fY3h4X2dsb2JhbF9hcnJheV9kdG9yLjU0lAg4c3RkOjpfXzI6Ol9fdGltZV9nZXRfY19zdG9yYWdlPHdjaGFyX3Q+OjpfX3dlZWtzKCkgY29uc3SVCBdzdGQ6Ol9fMjo6aW5pdF93d2Vla3MoKZYIGl9fY3h4X2dsb2JhbF9hcnJheV9kdG9yLjY5lwh5c3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6b3BlcmF0b3I9KHdjaGFyX3QgY29uc3QqKZgINnN0ZDo6X18yOjpfX3RpbWVfZ2V0X2Nfc3RvcmFnZTxjaGFyPjo6X19tb250aHMoKSBjb25zdJkIF3N0ZDo6X18yOjppbml0X21vbnRocygpmggaX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuODSbCDlzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8d2NoYXJfdD46Ol9fbW9udGhzKCkgY29uc3ScCBhzdGQ6Ol9fMjo6aW5pdF93bW9udGhzKCmdCBtfX2N4eF9nbG9iYWxfYXJyYXlfZHRvci4xMDieCDVzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8Y2hhcj46Ol9fYW1fcG0oKSBjb25zdJ8IFnN0ZDo6X18yOjppbml0X2FtX3BtKCmgCBtfX2N4eF9nbG9iYWxfYXJyYXlfZHRvci4xMzKhCDhzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8d2NoYXJfdD46Ol9fYW1fcG0oKSBjb25zdKIIF3N0ZDo6X18yOjppbml0X3dhbV9wbSgpowgbX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuMTM1pAgxc3RkOjpfXzI6Ol9fdGltZV9nZXRfY19zdG9yYWdlPGNoYXI+OjpfX3goKSBjb25zdKUIGV9fY3h4X2dsb2JhbF9hcnJheV9kdG9yLjGmCDRzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8d2NoYXJfdD46Ol9feCgpIGNvbnN0pwgaX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuMzGoCDFzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8Y2hhcj46Ol9fWCgpIGNvbnN0qQgaX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuMzOqCDRzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8d2NoYXJfdD46Ol9fWCgpIGNvbnN0qwgaX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuMzWsCDFzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8Y2hhcj46Ol9fYygpIGNvbnN0rQgaX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuMzeuCDRzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8d2NoYXJfdD46Ol9fYygpIGNvbnN0rwgaX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuMzmwCDFzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8Y2hhcj46Ol9fcigpIGNvbnN0sQgaX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuNDGyCDRzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8d2NoYXJfdD46Ol9fcigpIGNvbnN0swgaX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuNDO0CGlzdGQ6Ol9fMjo6dGltZV9wdXQ8Y2hhciwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6fnRpbWVfcHV0KCm1CGtzdGQ6Ol9fMjo6dGltZV9wdXQ8Y2hhciwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6fnRpbWVfcHV0KCkuMbYIeHN0ZDo6X18yOjp2ZWN0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4gPjo6bWF4X3NpemUoKSBjb25zdLcIqwFzdGQ6Ol9fMjo6YWxsb2NhdG9yX3RyYWl0czxzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4gPjo6YWxsb2NhdGUoc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+JiwgdW5zaWduZWQgbG9uZym4CIsBc3RkOjpfXzI6OnZlY3RvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiA+OjpfX2Fubm90YXRlX25ldyh1bnNpZ25lZCBsb25nKSBjb25zdLkIX3N0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPjo6YWxsb2NhdGUodW5zaWduZWQgbG9uZywgdm9pZCBjb25zdCopugg/c3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPjo6YWxsb2NhdGUodW5zaWduZWQgbG9uZywgdm9pZCBjb25zdCopuwjIAXN0ZDo6X18yOjphbGxvY2F0b3JfdHJhaXRzPHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiA+OjpkZWFsbG9jYXRlKHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiYsIHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiosIHVuc2lnbmVkIGxvbmcpvAibAXN0ZDo6X18yOjpfX3ZlY3Rvcl9iYXNlPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46Ol9fZGVzdHJ1Y3RfYXRfZW5kKHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiopvQgic3RkOjpfXzI6Ol9fdGltZV9wdXQ6Ol9fdGltZV9wdXQoKb4IiAFzdGQ6Ol9fMjo6dmVjdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46Ol9fcmVjb21tZW5kKHVuc2lnbmVkIGxvbmcpIGNvbnN0vwjYAXN0ZDo6X18yOjpfX3NwbGl0X2J1ZmZlcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiY+OjpfX3NwbGl0X2J1ZmZlcih1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4mKcAIkQFzdGQ6Ol9fMjo6X19zcGxpdF9idWZmZXI8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4mPjo6X19jb25zdHJ1Y3RfYXRfZW5kKHVuc2lnbmVkIGxvbmcpwQjzAXN0ZDo6X18yOjp2ZWN0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4gPjo6X19zd2FwX291dF9jaXJjdWxhcl9idWZmZXIoc3RkOjpfXzI6Ol9fc3BsaXRfYnVmZmVyPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+Jj4mKcIIxgNzdGQ6Ol9fMjo6ZW5hYmxlX2lmPCgoc3RkOjpfXzI6OmludGVncmFsX2NvbnN0YW50PGJvb2wsIGZhbHNlPjo6dmFsdWUpIHx8ICghKF9faGFzX2NvbnN0cnVjdDxzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4sIGJvb2wqLCBib29sPjo6dmFsdWUpKSkgJiYgKGlzX3RyaXZpYWxseV9tb3ZlX2NvbnN0cnVjdGlibGU8Ym9vbD46OnZhbHVlKSwgdm9pZD46OnR5cGUgc3RkOjpfXzI6OmFsbG9jYXRvcl90cmFpdHM8c3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46Ol9fY29uc3RydWN0X2JhY2t3YXJkPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kj4oc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+JiwgYm9vbCosIGJvb2wqLCBib29sKiYpwwh8c3RkOjpfXzI6Ol9fY29tcHJlc3NlZF9wYWlyPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiY+OjpzZWNvbmQoKcQIxgFzdGQ6Ol9fMjo6X19zcGxpdF9idWZmZXI8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4mPjo6X19kZXN0cnVjdF9hdF9lbmQoc3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqKiwgc3RkOjpfXzI6OmludGVncmFsX2NvbnN0YW50PGJvb2wsIGZhbHNlPinFCEBzdGQ6Ol9fMjo6KGFub255bW91cyBuYW1lc3BhY2UpOjpfX2Zha2VfYmluZDo6b3BlcmF0b3IoKSgpIGNvbnN0xghCc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90Pjo6YWxsb2NhdGUodW5zaWduZWQgbG9uZywgdm9pZCBjb25zdCopxwhrc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6X19jbGVhcl9hbmRfc2hyaW5rKCnICHRzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+OjpfX2NsZWFyX2FuZF9zaHJpbmsoKckIQ2xvbmcgZG91YmxlIHN0ZDo6X18yOjpfX2RvX3N0cnRvZDxsb25nIGRvdWJsZT4oY2hhciBjb25zdCosIGNoYXIqKinKCC1zdGQ6Ol9fMjo6X19zaGFyZWRfY291bnQ6On5fX3NoYXJlZF9jb3VudCgpLjHLCC9zdGQ6Ol9fMjo6X19zaGFyZWRfd2Vha19jb3VudDo6X19yZWxlYXNlX3dlYWsoKcwISXN0ZDo6X18yOjpfX3NoYXJlZF93ZWFrX2NvdW50OjpfX2dldF9kZWxldGVyKHN0ZDo6dHlwZV9pbmZvIGNvbnN0JikgY29uc3TNCEZzdGQ6Ol9fMjo6X19jYWxsX29uY2UodW5zaWduZWQgbG9uZyB2b2xhdGlsZSYsIHZvaWQqLCB2b2lkICgqKSh2b2lkKikpzggbb3BlcmF0b3IgbmV3KHVuc2lnbmVkIGxvbmcpzwg9c3RkOjpfXzI6Ol9fbGliY3BwX3JlZnN0cmluZzo6X19saWJjcHBfcmVmc3RyaW5nKGNoYXIgY29uc3QqKdAIB3dtZW1zZXTRCAh3bWVtbW92ZdIIQ3N0ZDo6X18yOjpfX2Jhc2ljX3N0cmluZ19jb21tb248dHJ1ZT46Ol9fdGhyb3dfbGVuZ3RoX2Vycm9yKCkgY29uc3TTCMEBc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6YmFzaWNfc3RyaW5nKHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QmKdQIeXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46Ol9faW5pdChjaGFyIGNvbnN0KiwgdW5zaWduZWQgbG9uZynVCGZzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+Ojp+YmFzaWNfc3RyaW5nKCnWCHlzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+Ojphc3NpZ24oY2hhciBjb25zdCosIHVuc2lnbmVkIGxvbmcp1wjTAXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46Ol9fZ3Jvd19ieV9hbmRfcmVwbGFjZSh1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCBjaGFyIGNvbnN0KinYCHJzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpyZXNpemUodW5zaWduZWQgbG9uZywgY2hhcinZCHJzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjphcHBlbmQodW5zaWduZWQgbG9uZywgY2hhcinaCHRzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpfX2VyYXNlX3RvX2VuZCh1bnNpZ25lZCBsb25nKdsIugFzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpfX2dyb3dfYnkodW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZyncCD9zdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj46OmFzc2lnbihjaGFyKiwgdW5zaWduZWQgbG9uZywgY2hhcindCHlzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjphcHBlbmQoY2hhciBjb25zdCosIHVuc2lnbmVkIGxvbmcp3ghmc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6cHVzaF9iYWNrKGNoYXIp3whyc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6X19pbml0KHVuc2lnbmVkIGxvbmcsIGNoYXIp4AiFAXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID46Ol9faW5pdCh3Y2hhcl90IGNvbnN0KiwgdW5zaWduZWQgbG9uZynhCIUBc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6YXNzaWduKHdjaGFyX3QgY29uc3QqLCB1bnNpZ25lZCBsb25nKeII3wFzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+OjpfX2dyb3dfYnlfYW5kX3JlcGxhY2UodW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgd2NoYXJfdCBjb25zdCop4wjDAXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID46Ol9fZ3Jvd19ieSh1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nKeQIhQFzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+OjphcHBlbmQod2NoYXJfdCBjb25zdCosIHVuc2lnbmVkIGxvbmcp5Qhyc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6cHVzaF9iYWNrKHdjaGFyX3Qp5gh+c3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6X19pbml0KHVuc2lnbmVkIGxvbmcsIHdjaGFyX3Qp5whCc3RkOjpfXzI6Ol9fdmVjdG9yX2Jhc2VfY29tbW9uPHRydWU+OjpfX3Rocm93X2xlbmd0aF9lcnJvcigpIGNvbnN06AgNYWJvcnRfbWVzc2FnZekIEl9fY3hhX3B1cmVfdmlydHVhbOoIHHN0ZDo6ZXhjZXB0aW9uOjp3aGF0KCkgY29uc3TrCCBzdGQ6OmxvZ2ljX2Vycm9yOjp+bG9naWNfZXJyb3IoKewIM3N0ZDo6X18yOjpfX2xpYmNwcF9yZWZzdHJpbmc6On5fX2xpYmNwcF9yZWZzdHJpbmcoKe0IInN0ZDo6bG9naWNfZXJyb3I6On5sb2dpY19lcnJvcigpLjHuCCJzdGQ6Omxlbmd0aF9lcnJvcjo6fmxlbmd0aF9lcnJvcigp7wgbc3RkOjpiYWRfY2FzdDo6d2hhdCgpIGNvbnN08AhhX19jeHhhYml2MTo6X19mdW5kYW1lbnRhbF90eXBlX2luZm86OmNhbl9jYXRjaChfX2N4eGFiaXYxOjpfX3NoaW1fdHlwZV9pbmZvIGNvbnN0Kiwgdm9pZComKSBjb25zdPEIPGlzX2VxdWFsKHN0ZDo6dHlwZV9pbmZvIGNvbnN0Kiwgc3RkOjp0eXBlX2luZm8gY29uc3QqLCBib29sKfIIW19fY3h4YWJpdjE6Ol9fY2xhc3NfdHlwZV9pbmZvOjpjYW5fY2F0Y2goX19jeHhhYml2MTo6X19zaGltX3R5cGVfaW5mbyBjb25zdCosIHZvaWQqJikgY29uc3TzCA5fX2R5bmFtaWNfY2FzdPQIa19fY3h4YWJpdjE6Ol9fY2xhc3NfdHlwZV9pbmZvOjpwcm9jZXNzX2ZvdW5kX2Jhc2VfY2xhc3MoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQqLCBpbnQpIGNvbnN09QhuX19jeHhhYml2MTo6X19jbGFzc190eXBlX2luZm86Omhhc191bmFtYmlndW91c19wdWJsaWNfYmFzZShfX2N4eGFiaXYxOjpfX2R5bmFtaWNfY2FzdF9pbmZvKiwgdm9pZCosIGludCkgY29uc3T2CHFfX2N4eGFiaXYxOjpfX3NpX2NsYXNzX3R5cGVfaW5mbzo6aGFzX3VuYW1iaWd1b3VzX3B1YmxpY19iYXNlKF9fY3h4YWJpdjE6Ol9fZHluYW1pY19jYXN0X2luZm8qLCB2b2lkKiwgaW50KSBjb25zdPcIc19fY3h4YWJpdjE6Ol9fYmFzZV9jbGFzc190eXBlX2luZm86Omhhc191bmFtYmlndW91c19wdWJsaWNfYmFzZShfX2N4eGFiaXYxOjpfX2R5bmFtaWNfY2FzdF9pbmZvKiwgdm9pZCosIGludCkgY29uc3T4CHJfX2N4eGFiaXYxOjpfX3ZtaV9jbGFzc190eXBlX2luZm86Omhhc191bmFtYmlndW91c19wdWJsaWNfYmFzZShfX2N4eGFiaXYxOjpfX2R5bmFtaWNfY2FzdF9pbmZvKiwgdm9pZCosIGludCkgY29uc3T5CFtfX2N4eGFiaXYxOjpfX3BiYXNlX3R5cGVfaW5mbzo6Y2FuX2NhdGNoKF9fY3h4YWJpdjE6Ol9fc2hpbV90eXBlX2luZm8gY29uc3QqLCB2b2lkKiYpIGNvbnN0+ghdX19jeHhhYml2MTo6X19wb2ludGVyX3R5cGVfaW5mbzo6Y2FuX2NhdGNoKF9fY3h4YWJpdjE6Ol9fc2hpbV90eXBlX2luZm8gY29uc3QqLCB2b2lkKiYpIGNvbnN0+whcX19jeHhhYml2MTo6X19wb2ludGVyX3R5cGVfaW5mbzo6Y2FuX2NhdGNoX25lc3RlZChfX2N4eGFiaXYxOjpfX3NoaW1fdHlwZV9pbmZvIGNvbnN0KikgY29uc3T8CGZfX2N4eGFiaXYxOjpfX3BvaW50ZXJfdG9fbWVtYmVyX3R5cGVfaW5mbzo6Y2FuX2NhdGNoX25lc3RlZChfX2N4eGFiaXYxOjpfX3NoaW1fdHlwZV9pbmZvIGNvbnN0KikgY29uc3T9CIMBX19jeHhhYml2MTo6X19jbGFzc190eXBlX2luZm86OnByb2Nlc3Nfc3RhdGljX3R5cGVfYWJvdmVfZHN0KF9fY3h4YWJpdjE6Ol9fZHluYW1pY19jYXN0X2luZm8qLCB2b2lkIGNvbnN0Kiwgdm9pZCBjb25zdCosIGludCkgY29uc3T+CHNfX2N4eGFiaXYxOjpfX3ZtaV9jbGFzc190eXBlX2luZm86OnNlYXJjaF9iZWxvd19kc3QoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQgY29uc3QqLCBpbnQsIGJvb2wpIGNvbnN0/wiBAV9fY3h4YWJpdjE6Ol9fYmFzZV9jbGFzc190eXBlX2luZm86OnNlYXJjaF9hYm92ZV9kc3QoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQgY29uc3QqLCB2b2lkIGNvbnN0KiwgaW50LCBib29sKSBjb25zdIAJdF9fY3h4YWJpdjE6Ol9fYmFzZV9jbGFzc190eXBlX2luZm86OnNlYXJjaF9iZWxvd19kc3QoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQgY29uc3QqLCBpbnQsIGJvb2wpIGNvbnN0gQlyX19jeHhhYml2MTo6X19zaV9jbGFzc190eXBlX2luZm86OnNlYXJjaF9iZWxvd19kc3QoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQgY29uc3QqLCBpbnQsIGJvb2wpIGNvbnN0gglvX19jeHhhYml2MTo6X19jbGFzc190eXBlX2luZm86OnNlYXJjaF9iZWxvd19kc3QoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQgY29uc3QqLCBpbnQsIGJvb2wpIGNvbnN0gwmAAV9fY3h4YWJpdjE6Ol9fdm1pX2NsYXNzX3R5cGVfaW5mbzo6c2VhcmNoX2Fib3ZlX2RzdChfX2N4eGFiaXYxOjpfX2R5bmFtaWNfY2FzdF9pbmZvKiwgdm9pZCBjb25zdCosIHZvaWQgY29uc3QqLCBpbnQsIGJvb2wpIGNvbnN0hAl/X19jeHhhYml2MTo6X19zaV9jbGFzc190eXBlX2luZm86OnNlYXJjaF9hYm92ZV9kc3QoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQgY29uc3QqLCB2b2lkIGNvbnN0KiwgaW50LCBib29sKSBjb25zdIUJfF9fY3h4YWJpdjE6Ol9fY2xhc3NfdHlwZV9pbmZvOjpzZWFyY2hfYWJvdmVfZHN0KF9fY3h4YWJpdjE6Ol9fZHluYW1pY19jYXN0X2luZm8qLCB2b2lkIGNvbnN0Kiwgdm9pZCBjb25zdCosIGludCwgYm9vbCkgY29uc3SGCQhfX3N0cmR1cIcJDV9fZ2V0VHlwZU5hbWWICSpfX2VtYmluZF9yZWdpc3Rlcl9uYXRpdmVfYW5kX2J1aWx0aW5fdHlwZXOJCT92b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfaW50ZWdlcjxjaGFyPihjaGFyIGNvbnN0KimKCUZ2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfaW50ZWdlcjxzaWduZWQgY2hhcj4oY2hhciBjb25zdCopiwlIdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX2ludGVnZXI8dW5zaWduZWQgY2hhcj4oY2hhciBjb25zdCopjAlAdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX2ludGVnZXI8c2hvcnQ+KGNoYXIgY29uc3QqKY0JSXZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9pbnRlZ2VyPHVuc2lnbmVkIHNob3J0PihjaGFyIGNvbnN0KimOCT52b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfaW50ZWdlcjxpbnQ+KGNoYXIgY29uc3QqKY8JR3ZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9pbnRlZ2VyPHVuc2lnbmVkIGludD4oY2hhciBjb25zdCopkAk/dm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX2ludGVnZXI8bG9uZz4oY2hhciBjb25zdCopkQlIdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX2ludGVnZXI8dW5zaWduZWQgbG9uZz4oY2hhciBjb25zdCopkgk+dm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX2Zsb2F0PGZsb2F0PihjaGFyIGNvbnN0KimTCT92b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfZmxvYXQ8ZG91YmxlPihjaGFyIGNvbnN0KimUCUN2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfbWVtb3J5X3ZpZXc8Y2hhcj4oY2hhciBjb25zdCoplQlKdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX21lbW9yeV92aWV3PHNpZ25lZCBjaGFyPihjaGFyIGNvbnN0KimWCUx2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfbWVtb3J5X3ZpZXc8dW5zaWduZWQgY2hhcj4oY2hhciBjb25zdCoplwlEdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX21lbW9yeV92aWV3PHNob3J0PihjaGFyIGNvbnN0KimYCU12b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfbWVtb3J5X3ZpZXc8dW5zaWduZWQgc2hvcnQ+KGNoYXIgY29uc3QqKZkJQnZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9tZW1vcnlfdmlldzxpbnQ+KGNoYXIgY29uc3QqKZoJS3ZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9tZW1vcnlfdmlldzx1bnNpZ25lZCBpbnQ+KGNoYXIgY29uc3QqKZsJQ3ZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9tZW1vcnlfdmlldzxsb25nPihjaGFyIGNvbnN0KimcCUx2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfbWVtb3J5X3ZpZXc8dW5zaWduZWQgbG9uZz4oY2hhciBjb25zdCopnQlEdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX21lbW9yeV92aWV3PGZsb2F0PihjaGFyIGNvbnN0KimeCUV2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfbWVtb3J5X3ZpZXc8ZG91YmxlPihjaGFyIGNvbnN0KimfCW5FbXNjcmlwdGVuQmluZGluZ0luaXRpYWxpemVyX25hdGl2ZV9hbmRfYnVpbHRpbl90eXBlczo6RW1zY3JpcHRlbkJpbmRpbmdJbml0aWFsaXplcl9uYXRpdmVfYW5kX2J1aWx0aW5fdHlwZXMoKaAJCGRsbWFsbG9joQkGZGxmcmVlogkJZGxyZWFsbG9jowkRdHJ5X3JlYWxsb2NfY2h1bmukCQ1kaXNwb3NlX2NodW5rpQkEc2Jya6YJBGZtb2SnCQVmbW9kbKgJBWxvZzEwqQkGbG9nMTBmqgkGc2NhbGJuqwkNX19mcGNsYXNzaWZ5bKwJBm1lbWNwea0JBm1lbXNldK4JB21lbW1vdmWvCQhzZXRUaHJld7AJCXN0YWNrU2F2ZbEJCnN0YWNrQWxsb2OyCQxzdGFja1Jlc3RvcmWzCRBfX2dyb3dXYXNtTWVtb3J5tAkLZHluQ2FsbF92aWm1CQ1keW5DYWxsX3ZpaWlptgkMZHluQ2FsbF9kaWlptwkNZHluQ2FsbF9kaWlpabgJDGR5bkNhbGxfdmlpZLkJDWR5bkNhbGxfdmlpaWS6CQtkeW5DYWxsX3ZpZLsJC2R5bkNhbGxfZGlpvAkNZHluQ2FsbF9kaWRpZL0JDmR5bkNhbGxfZGlpZGlkvgkOZHluQ2FsbF9kaWRpZGm/CQ9keW5DYWxsX2RpaWRpZGnACQ1keW5DYWxsX3ZpZGlkwQkOZHluQ2FsbF92aWlkaWTCCQ5keW5DYWxsX3ZpZGlkZMMJD2R5bkNhbGxfdmlpZGlkZMQJD2R5bkNhbGxfdmlkaWRkZMUJEGR5bkNhbGxfdmlpZGlkZGTGCQtkeW5DYWxsX2RpZMcJDGR5bkNhbGxfZGlpZMgJDmR5bkNhbGxfdmlkZGRpyQkPZHluQ2FsbF92aWlkZGRpygkNZHluQ2FsbF9paWlpZMsJDWR5bkNhbGxfZGlkZGTMCQxkeW5DYWxsX3ZpZGTNCQ1keW5DYWxsX3ZpaWRkzgkNZHluQ2FsbF9paWlpac8JDGR5bkNhbGxfZGlkZNAJDWR5bkNhbGxfZGlpZGTRCQ5keW5DYWxsX2RpaWRkZNIJDmR5bkNhbGxfdmlmZmlp0wkPZHluQ2FsbF92aWlmZmlp1AkPZHluQ2FsbF9kaWRkaWRk1QkQZHluQ2FsbF9kaWlkZGlkZNYJD2R5bkNhbGxfZGlkZGRkZNcJEGR5bkNhbGxfZGlpZGRkZGTYCQ9keW5DYWxsX2RpZGRkaWnZCRBkeW5DYWxsX2RpaWRkZGlp2gkRZHluQ2FsbF9kaWRkZGRkaWnbCRJkeW5DYWxsX2RpaWRkZGRkaWncCQxkeW5DYWxsX2RpZGndCQ1keW5DYWxsX2RpaWRp3gkPZHluQ2FsbF9kaWRpZGRk3wkQZHluQ2FsbF9kaWlkaWRkZOAJDWR5bkNhbGxfZGlkZGnhCQ5keW5DYWxsX2RpaWRkaeIJDGR5bkNhbGxfdmlkaeMJDWR5bkNhbGxfdmlpZGnkCQ5keW5DYWxsX3ZpaWlpaeUJDGR5bkNhbGxfaWlmaeYJDWR5bkNhbGxfaWlpZmnnCQpkeW5DYWxsX2Zp6AkLZHluQ2FsbF9maWnpCQ1keW5DYWxsX2ZpaWlp6gkOZHluQ2FsbF9maWlpaWnrCQ9keW5DYWxsX3ZpaWlpZGTsCRBkeW5DYWxsX3ZpaWlpaWRk7QkMZHluQ2FsbF92aWlm7gkNZHluQ2FsbF92aWlpZu8JDWR5bkNhbGxfaWlpaWbwCQ5keW5DYWxsX2RpZGRpZPEJD2R5bkNhbGxfZGlpZGRpZPIJD2R5bkNhbGxfZGlkZGRpZPMJEGR5bkNhbGxfZGlpZGRkaWT0CQ5keW5DYWxsX2RpZGRkafUJD2R5bkNhbGxfZGlpZGRkafYJC2R5bkNhbGxfaWlk9wkPZHluQ2FsbF9paWRpaWlp+AkOZHluQ2FsbF9paWlpaWn5CRFkeW5DYWxsX2lpaWlpaWlpafoJD2R5bkNhbGxfaWlpaWlpafsJDmR5bkNhbGxfaWlpaWlk/AkQZHluQ2FsbF9paWlpaWlpaf0JD2R5bkNhbGxfdmlpaWlpaf4JCWR5bkNhbGxfdv8JGGxlZ2Fsc3R1YiRkeW5DYWxsX3ZpaWppaYAKFmxlZ2Fsc3R1YiRkeW5DYWxsX2ppammBChhsZWdhbHN0dWIkZHluQ2FsbF9paWlpaWqCChlsZWdhbHN0dWIkZHluQ2FsbF9paWlpaWpqgwoabGVnYWxzdHViJGR5bkNhbGxfaWlpaWlpamoAdRBzb3VyY2VNYXBwaW5nVVJMY2h0dHA6Ly9sb2NhbGhvc3Q6OTAwMC9hdWRpby13b3JrbGV0L2J1aWxkL3t7eyBGSUxFTkFNRV9SRVBMQUNFTUVOVF9TVFJJTkdTX1dBU01fQklOQVJZX0ZJTEUgfX19Lm1hcA==';
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




// STATICTOP = STATIC_BASE + 40064;
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
      return 40928;
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
function __ZN12cheerpTypes210vectorTestERSt6vectorIdSaIdEEi(Larg0,Larg1,Larg2){
	var tmp0=null;
	tmp0=Larg1.a0;
	return +tmp0[Larg2];
}
function __ZN12cheerpTypes216makeDoubleVectorEid(Larg0,Larg1,Larg2,Larg3){
	var tmp0=null,Lgeptoindexphi=0,tmp2=0;
	Larg0.a0=nullArray;
	Larg0.a1=nullArray;
	Larg0.a1o=0;
	Larg0.a2.a0=null;
	if((Larg2|0)!==0){
		tmp0=new Float64Array((Larg2<<3)/8|0);
		Larg0.a1=tmp0;
		Larg0.a1o=0;
		Larg0.a0=tmp0;
		Larg0.a2.a0=tmp0[Larg2];
		tmp2=Larg2;
		Lgeptoindexphi=0;
		while(1){
			tmp0[Lgeptoindexphi]=Larg3;
			tmp2=tmp2-1|0;
			if((tmp2|0)!==0){
				Lgeptoindexphi=Lgeptoindexphi+1|0;
				continue;
			}
			break;
		}
		Larg0.a1=tmp0;
		Larg0.a1o=0+Larg2|0;
	}
}
function __ZN12cheerpTypes2C1Ev(Larg0){
}
function __ZN10vectorTest9sumVectorERSt6vectorIdSaIdEE(Larg0,Larg1){
	var tmp0=null,tmp0o=0,tmp1=null,tmp2=0,tmp3=0,tmp4=-0.;
	tmp0o=Larg1.a1o;
	tmp0=Larg1.a1;
	tmp1=Larg1.a0;
	tmp2=((0)*8);
	tmp3=((tmp0o)*8);
	if((tmp3|0)===(tmp2|0))return 0;
	tmp2=tmp3-tmp2>>3;
	tmp4=0;
	tmp3=0;
	while(1){
		tmp4+= +tmp1[tmp3];
		tmp3=tmp3+1|0;
		if(tmp3>>>0<tmp2>>>0)continue;
		break;
	}
	return tmp4;
}
function __ZN10vectorTest16makeDoubleVectorEid(Larg0,Larg1,Larg2,Larg3){
	var tmp0=null,Lgeptoindexphi=0,tmp2=0;
	Larg0.a0=nullArray;
	Larg0.a1=nullArray;
	Larg0.a1o=0;
	Larg0.a2.a0=null;
	if((Larg2|0)!==0){
		tmp0=new Float64Array((Larg2<<3)/8|0);
		Larg0.a1=tmp0;
		Larg0.a1o=0;
		Larg0.a0=tmp0;
		Larg0.a2.a0=tmp0[Larg2];
		tmp2=Larg2;
		Lgeptoindexphi=0;
		while(1){
			tmp0[Lgeptoindexphi]=Larg3;
			tmp2=tmp2-1|0;
			if((tmp2|0)!==0){
				Lgeptoindexphi=Lgeptoindexphi+1|0;
				continue;
			}
			break;
		}
		Larg0.a1=tmp0;
		Larg0.a1o=0+Larg2|0;
	}
}
function __ZN10vectorTestC1Ev(Larg0){
}
function __ZN11cheerpTypes10vectorTestERSt6vectorIdSaIdEEi(Larg0,Larg1){
	var tmp0=null;
	tmp0=Larg0.a0;
	return +tmp0[Larg1];
}
function __ZN11cheerpTypes16makeDoubleVectorEid(Larg0,Larg1,Larg2){
	var tmp0=null,Lgeptoindexphi=0,tmp2=0;
	Larg0.a0=nullArray;
	Larg0.a1=nullArray;
	Larg0.a1o=0;
	Larg0.a2.a0=null;
	if((Larg1|0)!==0){
		tmp0=new Float64Array((Larg1<<3)/8|0);
		Larg0.a1=tmp0;
		Larg0.a1o=0;
		Larg0.a0=tmp0;
		Larg0.a2.a0=tmp0[Larg1];
		tmp2=Larg1;
		Lgeptoindexphi=0;
		while(1){
			tmp0[Lgeptoindexphi]=Larg2;
			tmp2=tmp2-1|0;
			if((tmp2|0)!==0){
				Lgeptoindexphi=Lgeptoindexphi+1|0;
				continue;
			}
			break;
		}
		Larg0.a1=tmp0;
		Larg0.a1o=0+Larg1|0;
	}
}
function __ZN11cheerpTypesC1Ev(Larg0){
}
function __ZN12maxiRatioSeqC1Ev(Larg0){
	Larg0.d0=0;
	Larg0.i1=0;
}
function __ZN12maxiRatioSeq10playValuesEdSt6vectorIdSaIdEES2_(Larg0,Larg1,Larg2,Larg3){
	var tmp0=null,tmp0o=0,tmp1=-0.,tmp2=-0.,L$psroa$p0$p012=null,L$psroa$p0$p012o=0,L$psroa$p9$p011=null,L$psroa$p9$p011o=0,tmp5=0,Lgeptoindexphi=0,Lgeptoindexphi3=0,Lgeptoindexphi6=0,tmp9=-0.,tmp10=-0.,tmp11=-0.;
	L$psroa$p0$p012o=Larg2.a1o;
	L$psroa$p0$p012=Larg2.a1;
	L$psroa$p9$p011=Larg2.a0;
	tmp5=((L$psroa$p0$p012o)*8)-((0)*8)|0;
	if((tmp5|0)!==0){
		L$psroa$p0$p012=new Float64Array(tmp5/8|0);
		L$psroa$p9$p011=Larg2.a0;
		tmp0o=Larg2.a1o;
		tmp0=Larg2.a1;
		tmp5=((tmp0o)*8)-((0)*8)|0;
		if((tmp5|0)>0){
			Lgeptoindexphi=tmp5>>>3;
			if((Lgeptoindexphi|0)!==0){
				Lgeptoindexphi6=0;
				Lgeptoindexphi3=0;
				while(1){
					L$psroa$p0$p012[Lgeptoindexphi6]=+L$psroa$p9$p011[Lgeptoindexphi3];
					Lgeptoindexphi6=Lgeptoindexphi6+1|0;
					if(L$psroa$p0$p012!==L$psroa$p0$p012||(0+Lgeptoindexphi|0)!==(0+Lgeptoindexphi6|0)){
						Lgeptoindexphi3=Lgeptoindexphi3+1|0;
						continue;
					}
					break;
				}
			}
			tmp5>>>=3;
			if((tmp5|0)!==0){
				Lgeptoindexphi3=0;
				Lgeptoindexphi=0;
				while(1){
					Lgeptoindexphi3=~~( +L$psroa$p0$p012[Lgeptoindexphi]+(+(Lgeptoindexphi3|0)));
					Lgeptoindexphi=Lgeptoindexphi+1|0;
					if(L$psroa$p0$p012!==L$psroa$p0$p012||(0+Lgeptoindexphi|0)!==(0+tmp5|0))continue;
					break;
				}
				L$psroa$p9$p011o=0+tmp5|0;
				L$psroa$p9$p011=L$psroa$p0$p012;
				tmp1=(+(Lgeptoindexphi3|0));
			}else{
				L$psroa$p9$p011o=0+tmp5|0;
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
	tmp5=((0)*8);
	Lgeptoindexphi=((L$psroa$p9$p011o)*8);
	a:if((Lgeptoindexphi|0)===(tmp5|0))Larg0.d0=Larg1;
	else{
		tmp5=Lgeptoindexphi-tmp5>>3;
		tmp2=-1/(+(__ZN12maxiSettings10sampleRateE|0));
		tmp9=0;
		Lgeptoindexphi=0;
		while(1){
			tmp9+= +L$psroa$p0$p012[Lgeptoindexphi];
			tmp10=tmp9/tmp1;
			if(tmp10===1){
				tmp10=0;
			}
			tmp11=+Larg0.d0;
			if(tmp11>Larg1){
				Larg0.d0=tmp2;
				tmp11=tmp2;
			}
			Lgeptoindexphi3=tmp11<=tmp10?1:0;
			if(tmp10<Larg1)if(Lgeptoindexphi3){
				Larg0.d0=Larg1;
				tmp5=(Larg0.i1|0)+1|0;
				Larg0.i1=tmp5;
				L$psroa$p0$p012o=Larg3.a1o;
				L$psroa$p0$p012=Larg3.a1;
				L$psroa$p9$p011=Larg3.a0;
				if((tmp5|0)!==(((L$psroa$p0$p012o)*8)-((0)*8)>>3|0))break a;
				Larg0.i1=0;
				break a;
			}
			Lgeptoindexphi=Lgeptoindexphi+1|0;
			if(Lgeptoindexphi>>>0<tmp5>>>0)continue;
			break;
		}
		Larg0.d0=Larg1;
	}
	L$psroa$p0$p012=Larg3.a0;
	return +L$psroa$p0$p012[Larg0.i1|0];
}
function __ZN12maxiRatioSeq8playTrigEdSt6vectorIdSaIdEE(Larg0,Larg1,Larg2){
	var tmp0=null,tmp1=null,tmp1o=0,tmp2=-0.,tmp3=-0.,tmp4=0,Lgeptoindexphi=0,tmp6=0,tmp7=-0.,tmp8=-0.,tmp9=-0.;
	tmp0=Larg2.a0;
	tmp1o=Larg2.a1o;
	tmp1=Larg2.a1;
	if(tmp0===tmp1&&0===tmp1o){
		tmp2=0;
	}else{
		tmp6=0;
		Lgeptoindexphi=0;
		while(1){
			tmp6=~~( +tmp0[Lgeptoindexphi]+(+(tmp6|0)));
			Lgeptoindexphi=Lgeptoindexphi+1|0;
			if(tmp0!==tmp1||(0+Lgeptoindexphi|0)!==tmp1o)continue;
			break;
		}
		tmp2=(+(tmp6|0));
	}
	Lgeptoindexphi=((0)*8);
	tmp6=((tmp1o)*8);
	if((tmp6|0)===(Lgeptoindexphi|0)){
		Larg0.d0=Larg1;
		return 0;
	}
	Lgeptoindexphi=tmp6-Lgeptoindexphi>>3;
	tmp3=-1/(+(__ZN12maxiSettings10sampleRateE|0));
	tmp7=0;
	tmp6=0;
	while(1){
		tmp7+= +tmp0[tmp6];
		tmp8=tmp7/tmp2;
		if(tmp8===1){
			tmp8=0;
		}
		tmp9=+Larg0.d0;
		if(tmp9>Larg1){
			Larg0.d0=tmp3;
			tmp9=tmp3;
		}
		tmp4=tmp9<=tmp8?1:0;
		if(tmp8<Larg1)if(tmp4){
			Larg0.d0=Larg1;
			return 1;
		}
		tmp6=tmp6+1|0;
		if(tmp6>>>0<Lgeptoindexphi>>>0)continue;
		break;
	}
	Larg0.d0=Larg1;
	return 0;
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
	return __ZN12maxiRatioSeq8playTrigEdSt6vectorIdSaIdEE(this,a0,a1);
};
maxiRatioSeq.prototype.playValues=function (a0,a1,a2){
	return __ZN12maxiRatioSeq10playValuesEdSt6vectorIdSaIdEES2_(this,a0,a1,a2);
};
maxiRatioSeq.prototype.playTrig=function (a0,a1){
	return __ZN12maxiRatioSeq8playTrigEdSt6vectorIdSaIdEE(this,a0,a1);
};
maxiRatioSeq.prototype.playValues=function (a0,a1,a2){
	return __ZN12maxiRatioSeq10playValuesEdSt6vectorIdSaIdEES2_(this,a0,a1,a2);
};
function cheerpTypes(){
	this.i0=0;
	;
	this.d=[this];
	if (arguments.length===1&&arguments[0]===undefined){
		return;
	}
	__ZN11cheerpTypesC1Ev(this);
}
cheerpTypes.makeDoubleVector=function (a0,a1,a2){
	return __ZN11cheerpTypes16makeDoubleVectorEid(a0,a1,a2);
};
cheerpTypes.vectorTest=function (a0,a1){
	return __ZN11cheerpTypes10vectorTestERSt6vectorIdSaIdEEi(a0,a1);
};
function vectorTest(){
	this.i0=0;
	;
	this.d=[this];
	if (arguments.length===1&&arguments[0]===undefined){
		return;
	}
	__ZN10vectorTestC1Ev(this);
}
vectorTest.prototype.makeDoubleVector=function (a0,a1,a2){
	return __ZN10vectorTest16makeDoubleVectorEid(this,a0,a1,a2);
};
vectorTest.prototype.sumVector=function (a0){
	return __ZN10vectorTest9sumVectorERSt6vectorIdSaIdEE(this,a0);
};
function cheerpTypes2(){
	this.i0=0;
	;
	this.d=[this];
	if (arguments.length===1&&arguments[0]===undefined){
		return;
	}
	__ZN12cheerpTypes2C1Ev(this);
}
cheerpTypes2.prototype.makeDoubleVector=function (a0,a1,a2){
	return __ZN12cheerpTypes216makeDoubleVectorEid(this,a0,a1,a2);
};
cheerpTypes2.prototype.vectorTest=function (a0,a1){
	return __ZN12cheerpTypes210vectorTestERSt6vectorIdSaIdEEi(this,a0,a1);
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
maxiRatioSeq.promise=
cheerpTypes.promise=
vectorTest.promise=
cheerpTypes2.promise=
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
Module.cheerpTypes = cheerpTypes;
// Module.maxiFilter = maxiFilter;
// Module.maxiZeroCrossingDetector = maxiZeroCrossingDetector;

Module.cheerpTypes2 = cheerpTypes2;
Module.vectorTest = vectorTest;

