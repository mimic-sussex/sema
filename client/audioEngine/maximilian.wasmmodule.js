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
  'initial': 981,
  'maximum': 981 + 0,
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
    STACK_BASE = 5297344,
    STACKTOP = STACK_BASE,
    STACK_MAX = 54464,
    DYNAMIC_BASE = 5297344,
    DYNAMICTOP_PTR = 54304;




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




var wasmBinaryFile = 'data:application/octet-stream;base64,AGFzbQEAAAAB9gqjAWABfwF/YAF/AGACf38AYAJ/fwF/YAN/f38Bf2ADf39/AGAFf39/f38Bf2AAAGAEf39/fwF/YAZ/f39/f38Bf2AFf39/f38AYAR/f39/AGAAAX9gBn9/f39/fwBgCH9/f39/f39/AX9gAn98AGABfwF8YAJ/fAF8YAN/fHwBfGACfHwBfGAHf39/f39/fwF/YAR/fHx8AXxgAXwBfGAHf39/f39/fwBgAn9/AXxgBH9/f3wAYAN/f3wAYAV/fn5+fgBgA39+fwF+YAF9AX1gA39/fwF8YAR/fHx/AXxgBn98fHx8fAF8YAp/f39/f39/f39/AGADf3x/AGAFf39/f34Bf2ADf3x/AXxgBXx8fHx8AXxgBX9/fn9/AGAGf398fHx/AGAFf39/f3wBf2AEf39/fwF+YAF/AX1gAn9/AX1gBH9/fH8BfGAFf398fH8BfGAGf3x/fHx8AXxgBX98fH98AXxgBX98fHx/AXxgA3x8fAF8YAh/f39/f39/fwBgB39/f39/fHwAYAZ/f39/fHwAYAR/f399AGAGf399fX9/AGAEf398fwBgBX9/fH98AGAGf398f3x8AGAHf398f3x8fABgBH9/fHwAYAR/fn5/AGAFf319f38AYAR/fH98AGAFf3x/fHwAYAZ/fH98fHwAYAN/fHwAYAV/fHx8fwBgCn9/f39/f39/f38Bf2AHf39/f39+fgF/YAZ/f39/fn4Bf2AEf39/fAF/YAR/f31/AX9gA399fwF/YAZ/fH9/f38Bf2AEf39/fwF9YAV/f39/fwF9YAR/f39/AXxgA39/fAF8YAV/f3x/fwF8YAV/f3x/fAF8YAZ/f3x/fH8BfGAHf398f3x8fAF8YAR/f3x8AXxgBn9/fHx/fAF8YAd/f3x8f3x8AXxgBX9/fHx8AXxgBn9/fHx8fwF8YAd/f3x8fH9/AXxgB39/fHx8f3wBfGAHf398fHx8fAF8YAl/f3x8fHx8f38BfGAEf3x/fwF8YAR/fH98AXxgBX98f3x/AXxgBn98fH98fAF8YAZ/fHx8f38BfGAGf3x8fH98AXxgCH98fHx8fH9/AXxgD39/f39/f39/f39/f39/fwBgA39/fQBgAn9+AGAJf39/f39/f39/AX9gC39/f39/f39/f39/AX9gDH9/f39/f39/f39/fwF/YAR/f399AX9gA39+fwF/YAJ/fAF/YAJ+fwF/YAJ+fgF/YAF8AX9gAX8BfmAEf39/fgF+YAN/f38BfWACfX8BfWABfAF9YAJ8fwF8YAN8fH8BfGAMf39/f39/f39/f39/AGANf39/f39/f39/f39/fwBgCH9/f39/f3x8AGAFf39/f30AYAV/f39/fABgB39/f319f38AYAV/f398fwBgBn9/f3x/fABgB39/f3x/fHwAYAh/f398f3x8fABgBX9/f3x8AGAHf39/fHx8fwBgA39/fgBgA39+fgBgAn99AGAGf39/f398AX9gBX9/f399AX9gBX9/f31/AX9gA39/fAF/YAd/f3x/f39/AX9gA35/fwF/YAR+fn5+AX9gAn1/AX9gAnx/AX9gAn9/AX5gBn9/f39/fwF9YAJ+fgF9YAJ9fQF9YAV/f39/fwF8YAR/f398AXxgBX9/f3x/AXxgBn9/f3x/fwF8YAZ/f398f3wBfGAHf39/fH98fwF8YAh/f398f3x8fAF8YAV/f398fAF8YAZ/f398fH8BfGAHf39/fHx/fAF8YAh/f398fH98fAF8YAZ/f398fHwBfGAHf39/fHx8fwF8YAh/f398fHx/fwF8YAh/f398fHx/fAF8YAh/f398fHx8fAF8YAp/f398fHx8fH9/AXxgAn5+AXwClgktA2VudhZfZW1iaW5kX3JlZ2lzdGVyX2NsYXNzAHYDZW52Il9lbWJpbmRfcmVnaXN0ZXJfY2xhc3NfY29uc3RydWN0b3IADQNlbnYlX2VtYmluZF9yZWdpc3Rlcl9jbGFzc19jbGFzc19mdW5jdGlvbgAXA2Vudh9fZW1iaW5kX3JlZ2lzdGVyX2NsYXNzX3Byb3BlcnR5ACEDZW52H19lbWJpbmRfcmVnaXN0ZXJfY2xhc3NfZnVuY3Rpb24AMgNlbnYVX2VtYmluZF9yZWdpc3Rlcl9lbnVtAAsDZW52G19lbWJpbmRfcmVnaXN0ZXJfZW51bV92YWx1ZQAFA2VudhpfZW1iaW5kX3JlZ2lzdGVyX3NtYXJ0X3B0cgB1A2VudhhfX2N4YV9hbGxvY2F0ZV9leGNlcHRpb24AAANlbnYLX19jeGFfdGhyb3cABQNlbnYRX2VtdmFsX3Rha2VfdmFsdWUAAwNlbnYNX2VtdmFsX2luY3JlZgABA2Vudg1fZW12YWxfZGVjcmVmAAEDZW52C19lbXZhbF9jYWxsAAgDZW52BXJvdW5kABYDZW52BGV4aXQAAQNlbnYNX19hc3NlcnRfZmFpbAALA2VudgZfX2xvY2sAAQNlbnYIX191bmxvY2sAARZ3YXNpX3NuYXBzaG90X3ByZXZpZXcxCGZkX2Nsb3NlAAADZW52Cl9fc3lzY2FsbDUAAwNlbnYMX19zeXNjYWxsMjIxAAMDZW52C19fc3lzY2FsbDU0AAMWd2FzaV9zbmFwc2hvdF9wcmV2aWV3MQdmZF9yZWFkAAgWd2FzaV9zbmFwc2hvdF9wcmV2aWV3MQhmZF93cml0ZQAIFndhc2lfc25hcHNob3RfcHJldmlldzERZW52aXJvbl9zaXplc19nZXQAAxZ3YXNpX3NuYXBzaG90X3ByZXZpZXcxC2Vudmlyb25fZ2V0AAMDZW52Cl9fbWFwX2ZpbGUAAwNlbnYLX19zeXNjYWxsOTEAAwNlbnYKc3RyZnRpbWVfbAAGA2VudgVhYm9ydAAHA2VudhVfZW1iaW5kX3JlZ2lzdGVyX3ZvaWQAAgNlbnYVX2VtYmluZF9yZWdpc3Rlcl9ib29sAAoDZW52G19lbWJpbmRfcmVnaXN0ZXJfc3RkX3N0cmluZwACA2VudhxfZW1iaW5kX3JlZ2lzdGVyX3N0ZF93c3RyaW5nAAUDZW52Fl9lbWJpbmRfcmVnaXN0ZXJfZW12YWwAAgNlbnYYX2VtYmluZF9yZWdpc3Rlcl9pbnRlZ2VyAAoDZW52Fl9lbWJpbmRfcmVnaXN0ZXJfZmxvYXQABQNlbnYcX2VtYmluZF9yZWdpc3Rlcl9tZW1vcnlfdmlldwAFA2VudhZlbXNjcmlwdGVuX3Jlc2l6ZV9oZWFwAAADZW52FWVtc2NyaXB0ZW5fbWVtY3B5X2JpZwAEA2VudgtzZXRUZW1wUmV0MAABFndhc2lfc25hcHNob3RfcHJldmlldzEHZmRfc2VlawAGA2VudgZtZW1vcnkCAIAQA2VudgV0YWJsZQFwANUHA7IKjQoHBwcHBwcHAAEADAIBAAsFAAIDBQACAAIADE1VUhgaAAxMGRAPAAIADE9QAAwQDxAPAAw4OToADBFCJw8AAEYZFTEADEE7DxAQDxAPDwABDAALCAIBNggAJSAlJTEVIAAMVFkADFdaLAACABgYFhERAAwSABESEgAMLlEADC4ADBIADA8PIAASExMTExMTExMTFhMADAAAAgACEAIQAgIAAgAMHy0AAQMAEiI3AhgeAAAAABIiAgABDApHKwMAAAAAAAAAAQxLAAEMNDMDBAABDAIFBQsABQQECAACGgUZAAUERgACBQULAAUECAAFAGM1BWgFIgcAAQAMAwEAAQIQDy9THy0AAQMBAi8ADAIPDwBgWDBWJwcAAwQDAwMIBAMDAwAAAAMDAwMDAwMDAwwQEGptAAwREgAMEgAMHwAkLFtOBwABDAAMAQIFAgUCAgAABAIAAQEDAQABARAABAABAwABAQcQEREREREREhEVERERHhoAXF0SEhUVFT4/QAQAAwQCAAQAAwAAAgUFARAVMBUQERIRFRIRDz1eIBEPDw9fYSQPDw8QAAEBAAECBCYHCwADAwkPAQILSAAqKgtKDQsCAgEFCgUKCgIBABEAFQMBAAgACAkDAw0LAQADBAQECwgKCAAAAw4KDXFxBAULAg0CAAIAHAABBAgCDAMDA3MGFAUACwpriQFrBEkCBQwAAgFubgAACGlpAgAAAAMDDAAIBAAAHAQABAEAAAAAPDyiARMGjAF0FnJyiwEdFh10FhYdkAEdFh0TBAwAAAEBAAEAAgQmCwQFAAADBAABAAQFAAQAAAEBAwEAAwAAAwMBAwADBWQBAAMAAwMDAAMAAAEBAAAAAwMDAgICAgECAgAAAwcBAQcBBwUCBQICAAABAgADAAMBAgADAAMCAAQDAgQDZACCAW8IgwEbAhsPigFsGwIbPBsLDReNAY8BBAOBAQQEBAMHBAACAwwEAwMBAAQICAZvKSkrCxgFCwYLBQQGCwUECQAUAwQJBgAFAAJDCAsJBikJBggJBggJBikJBgpncAkGHgkGCwkMBAEEAwkAFAkGAwVDCQYJBgkGCQYJBgpnCQYJBgkEAwYAAAYLBgQXAgAjBiMoBAAIF0UGBgAGFwkCBCMGIygXRQYCAg4ACQkJDQkNCQoGDgsKCgoKCgoLDQoKCg4JCQkNCQ0JCgYOCwoKCgoKCgsNCgoKFA0CBBQNBgcEAAICAgACFGYhAgUFFAEFAAIABAMCFGYhAhQBBQACAAQDRCFiBAlEIWIECQQEBA0FAg0LCwAHBwcBAQIAAgcMAQABAQEMAQMBAgEBBAgICAMEAwQDCAQGAAEDBAMECAQGDgYGAQ4GBA4JBgYAAAAGCAAOCQ4JBgQADgkOCQYEAAEAAQAAAgICAgICAgIABwEABwECAAcBAAcBAAcBAAcBAAEAAQABAAEAAQABAAEAAQEADAMBAwAFAgEACAIBCwACAQABAQUBAQMCAAIEBAcCBQAFMgICAgoFBQIBBQUyCgUCBQcHBwAAAQEBAAQEBAMFCwsLCwMEAwMLCg0KCgoNDQ0AAAcHBwcHBwcHBwcHBwcBAQEBAQEHBwcHAAABAwMCABMbFh1zbAQEBQIMAAEABQpNkgFVnAFSmAEeGhlMkQF5T5UBUJYBOHw5fTp+J4ABKDt/BjZ6WVSbAaABV54BWqEBLJMBUZcBLZkBN3sNR4YBK3BLjgEzdzV4hQFTmgFYnwFWnQGHAU6UAYgBCWUUhAEOFwEXBhRlQwYQAn8BQaCowwILfwBBnKgDCwfODmsRX193YXNtX2NhbGxfY3RvcnMAKwZtYWxsb2MA0gkEZnJlZQDTCRBfX2Vycm5vX2xvY2F0aW9uAKcECHNldFRocmV3AOEJGV9aU3QxOHVuY2F1Z2h0X2V4Y2VwdGlvbnYA8QQNX19nZXRUeXBlTmFtZQC5CSpfX2VtYmluZF9yZWdpc3Rlcl9uYXRpdmVfYW5kX2J1aWx0aW5fdHlwZXMAugkKX19kYXRhX2VuZAMBCXN0YWNrU2F2ZQDiCQpzdGFja0FsbG9jAOMJDHN0YWNrUmVzdG9yZQDkCRBfX2dyb3dXYXNtTWVtb3J5AOUJCmR5bkNhbGxfaWkAwwIKZHluQ2FsbF92aQA2CWR5bkNhbGxfaQA0C2R5bkNhbGxfdmlpAOYJDWR5bkNhbGxfdmlpaWkA5wkMZHluQ2FsbF92aWlpADkLZHluQ2FsbF9paWkAxAILZHluQ2FsbF9kaWQA6AkMZHluQ2FsbF9kaWlkAOkJDWR5bkNhbGxfZGlkZGQA6gkOZHluQ2FsbF9kaWlkZGQA6wkMZHluQ2FsbF9kaWRkAOwJDWR5bkNhbGxfZGlpZGQA7QkKZHluQ2FsbF9kaQCXAQtkeW5DYWxsX2RpaQDuCQtkeW5DYWxsX3ZpZADvCQxkeW5DYWxsX3ZpaWQA8AkMZHluQ2FsbF9kaWlpAPEJDWR5bkNhbGxfZGlpaWkA8gkNZHluQ2FsbF92aWlpZADzCQ1keW5DYWxsX2RpZGlkAPQJDmR5bkNhbGxfZGlpZGlkAPUJDmR5bkNhbGxfZGlkaWRpAPYJD2R5bkNhbGxfZGlpZGlkaQD3CQ1keW5DYWxsX3ZpZGlkAPgJDmR5bkNhbGxfdmlpZGlkAPkJDmR5bkNhbGxfdmlkaWRkAPoJD2R5bkNhbGxfdmlpZGlkZAD7CQ9keW5DYWxsX3ZpZGlkZGQA/AkQZHluQ2FsbF92aWlkaWRkZAD9CQ5keW5DYWxsX3ZpZGRkaQD+CQ9keW5DYWxsX3ZpaWRkZGkA/wkNZHluQ2FsbF9paWlpZACACgxkeW5DYWxsX2RkZGQAawxkeW5DYWxsX3ZpZGQAgQoNZHluQ2FsbF92aWlkZACCCgxkeW5DYWxsX2lpaWkAyAINZHluQ2FsbF9paWlpaQCDCg5keW5DYWxsX3ZpZmZpaQCECg9keW5DYWxsX3ZpaWZmaWkAhQoOZHluQ2FsbF9kZGRkZGQAiQEPZHluQ2FsbF9kaWRkZGRkAIYKD2R5bkNhbGxfZGlkZGlkZACHChBkeW5DYWxsX2RpaWRkaWRkAIgKEGR5bkNhbGxfZGlpZGRkZGQAiQoPZHluQ2FsbF9kaWRkZGlpAIoKEGR5bkNhbGxfZGlpZGRkaWkAiwoRZHluQ2FsbF9kaWRkZGRkaWkAjAoSZHluQ2FsbF9kaWlkZGRkZGlpAI0KDGR5bkNhbGxfZGlkaQCOCg1keW5DYWxsX2RpaWRpAI8KCmR5bkNhbGxfZGQAmgEPZHluQ2FsbF9kaWRpZGRkAJAKEGR5bkNhbGxfZGlpZGlkZGQAkQoLZHluQ2FsbF9kZGQAsgENZHluQ2FsbF9kaWRkaQCSCg5keW5DYWxsX2RpaWRkaQCTCgxkeW5DYWxsX3ZpZGkAlAoNZHluQ2FsbF92aWlkaQCVCg5keW5DYWxsX3ZpaWlpaQCWCgxkeW5DYWxsX2lpZmkAlwoNZHluQ2FsbF9paWlmaQCYCgpkeW5DYWxsX2ZpAJkKC2R5bkNhbGxfZmlpAJoKDWR5bkNhbGxfZmlpaWkAmwoOZHluQ2FsbF9maWlpaWkAnAoPZHluQ2FsbF92aWlpaWRkAJ0KEGR5bkNhbGxfdmlpaWlpZGQAngoMZHluQ2FsbF92aWlmAJ8KDWR5bkNhbGxfdmlpaWYAoAoNZHluQ2FsbF9paWlpZgChCg5keW5D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EUECQZglQcAaQcYDIABBABAEQQQQgAkiAEHHAzYCAEHYI0HZF0EDQaAlQewaQcgDIABBABAEQQQQgAkiAEHJAzYCAEHYI0HdF0EEQbAlQcAlQcoDIABBABAECwUAQdQlCwwAIAAEQCAAENMJCwsHACAAEQwACwcAQQEQgAkLCQAgASAAEQEACwwAIAAgACgCADYCBAsFAEHEJgsNACABIAIgAyAAEQUACx0AQciGAiABNgIAQcSGAiAANgIAQcyGAiACNgIACwkAQcSGAigCAAsLAEHEhgIgATYCAAs1AQF/IAEgACgCBCICQQF1aiEBIAAoAgAhACABIAJBAXEEfyABKAIAIABqKAIABSAACxEAAAs3AQF/IAEgACgCBCIDQQF1aiEBIAAoAgAhACABIAIgA0EBcQR/IAEoAgAgAGooAgAFIAALEQIACwkAQciGAigCAAsLAEHIhgIgATYCAAsJAEHMhgIoAgALCwBBzIYCIAE2AgALBQBBvCcLEgEBf0EwEIAJIgBCADcDCCAACzcBAX8gASAAKAIEIgNBAXVqIQEgACgCACEAIAEgAiADQQFxBH8gASgCACAAaigCAAUgAAsREQALOwEBfyABIAAoAgQiBUEBdWohASAAKAIAIQAgASACIAMgBCAFQQFxBH8gASgCACAAaigCAAUgAAsRFQALOQEBfyABIAAoAgQiBEEBdWohASAAKAIAIQAgASACIAMgBEEBcQR/IAEoAgAgAGooAgAFIAALERIACzUBAX8gASAAKAIEIgJBAXVqIQEgACgCACEAIAEgAkEBcQR/IAEoAgAgAGooAgAFIAALERAACzcBAX8gASAAKAIEIgNBAXVqIQEgACgCACEAIAEgAiADQQFxBH8gASgCACAAaigCAAUgAAsRDwALBQBBgCkLPAEBf0E4EIAJIgBCADcDACAAQgA3AzAgAEIANwMoIABCADcDICAAQgA3AxggAEIANwMQIABCADcDCCAACzkBAX8gASAAKAIEIgRBAXVqIQEgACgCACEAIAEgAiADIARBAXEEfyABKAIAIABqKAIABSAACxEeAAs5AQF/IAEgACgCBCIEQQF1aiEBIAAoAgAhACABIAIgAyAEQQFxBH8gASgCACAAaigCAAUgAAsRGgALBwAgACsDMAsJACAAIAE5AzALBwAgACgCLAsJACAAIAE2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ACsDCCAAKwMQoqA5AxALBwAgACsDEAsHACAAKwMACwkAIAAgATkDAAsHACAAKwMICwkAIAAgATkDCAsJACAAIAE5AxALBQBBrDELNwEBfyAABEAgACgCbCIBBEAgACABNgJwIAEQ0wkLIAAsAAtBf0wEQCAAKAIAENMJCyAAENMJCwuJAQECf0GIARCACSIAQgA3AgAgAEIANwMoIABBATsBYCAAQgA3A1ggAEKAgICAgICA8D83A1AgAEKAgICAgICA8D83A0ggAEEANgIIIABCADcDMEHEhgIoAgAhASAAQQA2AnQgAEEBOgCAASAAQoCAgICAgID4PzcDeCAAQgA3AmwgACABNgJkIAALEAAgACgCcCAAKAJsa0EDdQs5AQF/IAEgACgCBCIEQQF1aiEBIAAoAgAhACABIAIgAyAEQQFxBH8gASgCACAAaigCAAUgAAsRBQALOQEBfyABIAAoAgQiBEEBdWohASAAKAIAIQAgASACIAMgBEEBcQR/IAEoAgAgAGooAgAFIAALEQQACzUBAX8gASAAKAIEIgJBAXVqIQEgACgCACEAIAEgAkEBcQR/IAEoAgAgAGooAgAFIAALEQEACwwAIAAgACgCbDYCcAs9AQF/IAEgACgCBCIGQQF1aiEBIAAoAgAhACABIAIgAyAEIAUgBkEBcQR/IAEoAgAgAGooAgAFIAALET0AC+UBAQR/IwBBEGsiBCQAIAEgACgCBCIGQQF1aiEHIAAoAgAhBSAGQQFxBEAgBygCACAFaigCACEFCyACKAIAIQAgBEEANgIIIARCADcDACAAQXBJBEACQAJAIABBC08EQCAAQRBqQXBxIgYQgAkhASAEIAZBgICAgHhyNgIIIAQgATYCACAEIAA2AgQMAQsgBCAAOgALIAQhASAARQ0BCyABIAJBBGogABDeCRoLIAAgAWpBADoAACAHIAQgAyAFEQQAIQAgBCwAC0F/TARAIAQoAgAQ0wkLIARBEGokACAADwsQhAkACwUAQdQ0CygAIAEgAiAAIAIgAGMbIgAgACABYxsgAaEgAiABoaMgBCADoaIgA6ALFAAgASACIAMgBCAFIAAoAgARJQALKgAgBCADoyABIAIgACACIABjGyIAIAAgAWMbIAGhIAIgAaGjEO8EIAOiCy4AIAEgAiAAIAIgAGMbIgAgACABYxsgAaMQ7QQgAiABoxDtBKMgBCADoaIgA6ALHgACQCAAIAJkDQAgACICIAFjQQFzDQAgASECCyACCxAAIAEgAiADIAAoAgARMQALEQAgASACIAMgBCAFIAARJQALBQBBzDULEABB2AAQgAlBAEHYABDfCQs/AQF/IAEgACgCBCIHQQF1aiEBIAAoAgAhACABIAIgAyAEIAUgBiAHQQFxBH8gASgCACAAaigCAAUgAAsRXgALPwEBfyABIAAoAgQiB0EBdWohASAAKAIAIQAgASACIAMgBCAFIAYgB0EBcQR/IAEoAgAgAGooAgAFIAALESAACwUAQYw3CxsBAX9B2AAQgAlBAEHYABDfCSIAQQE2AjwgAAs/AQF/IAEgACgCBCIHQQF1aiEBIAAoAgAhACABIAIgAyAEIAUgBiAHQQFxBH8gASgCACAAaigCAAUgAAsRXwALQwEBfyABIAAoAgQiCUEBdWohASAAKAIAIQAgASACIAMgBCAFIAYgByAIIAlBAXEEfyABKAIAIABqKAIABSAACxFhAAs5AQF/IAEgACgCBCIEQQF1aiEBIAAoAgAhACABIAIgAyAEQQFxBH8gASgCACAAaigCAAUgAAsRJAALBwAgACgCOAsJACAAIAE2AjgLBQBB4DgLDAAgASAAKAIAERAACwkAIAEgABEQAAsXACAARAAAAAAAQI9Ao0HEhgIoAgC3ogsMACABIAAoAgARFgALCQAgASAAERYACwUAQcw5CyABAX9BGBCACSIAQgA3AwAgAEIBNwMQIABCADcDCCAAC2wBAXwgACsDACIDIAJEAAAAAABAj0CjQcSGAigCALeiIgJmQQFzRQRAIAAgAyACoSIDOQMACwJAIANEAAAAAAAA8D9jRQRAIAArAwghAQwBCyAAIAE5AwgLIAAgA0QAAAAAAADwP6A5AwAgAQsFAEHUOgseACABIAEgAaJE7FG4HoXr0T+iRAAAAAAAAPA/oKMLGgBEAAAAAAAA8D8gAhDpBKMgASACohDpBKILSgBEAAAAAAAA8D8gAiACIAKiROxRuB6F69E/okQAAAAAAADwP6CjoyABIAKiIgEgASABokTsUbgehevRP6JEAAAAAAAA8D+go6ILBQBB4DsLKAEBf0GYiSsQgAlBAEGYiSsQ3wkiABCfAxogAEHoiCtqQgA3AwggAAtoACAAIAECfyAA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CUGgxBVqNgJEIAJBAWoiAkEgRw0AC0EAIQIDQCAAIAJBoAJsaiIBQcjKAGpCADcDACABQcDKAGpCADcDACABQbjKAGpCADcDACABQbDKAGpCADcDACABQdjIAGpCADcDACABQcDIAGoiA0IANwIAIAFByMgAakIANwIAIAFB0MgAakEANgIAIAFB6MgAakKz5syZs+bM9T83AwAgAUHgyABqQpqz5syZs+b0PzcDACADQaDEFRCACSIDNgIAIAFBxMgAaiADQQBBoMQVEN8JQaDEFWo2AgAgAkEBaiICQSBHDQALIABBmJIBakIANwMAIABBkJIBakIANwMAIABBiJIBakIANwMAIABBgJIBakIANwMAIABB8JMBakIANwMAIABB+JMBakIANwMAIABBgJQBakIANwMAIABBiJQBakIANwMAIABB4JUBakIANwMAIABB6JUBakIANwMAIABB8JUBakIANwMAIABB+JUBakIANwMAIABB0JcBakIANwMAIABB2JcBakIANwMAIABB4JcBakIANwMAIABB6JcBakIANwMAIABB2JkBakIANwMAIABB0JkBakIANwMAIABByJkBakIANwMAIABBwJkBakIANwMAIABByJsBakIANwMAIABBwJsBakIANwMAIABBuJsBakIANwMAIABBsJsBakIANwMAIABBuJ0BakIANwMAIABBsJ0BakIANwMAIABBqJ0BakIANwMAIABBoJ0BakIANwMAIABBqJ8BakIANwMAIABBoJ8BakIANwMAIABBmJ8BakIANwMAIABBkJ8BakIANwMAIABBmKEBakIANwMAIABBkKEBakIANwMAIABBiKEBakIANwMAIABBgKEBakIANwMAIABBiKMBakIANwMAIABBgKMBakIANwMAIABB+KIBakIANwMAIABB8KIBakIANwMAIABB+KQBakIANwMAIABB8KQBakIANwMAIABB6KQBakIANwMAIABB4KQBakIANwMAIABB6KYBakIANwMAIABB4KYBakIANwMAIABB2KYBakIANwMAIABB0KYBakIANwMAIABB2KgBakIANwMAIABB0KgBakIANwMAIABByKgBakIANwMAIABBwKgBakIANwMAIABByKoBakIANwMAIABBwKoBakIANwMAIABBuKoBakIANwMAIABBsKoBakIANwMAIABBuKwBakIANwMAIABBsKwBakIANwMAIABBqKwBakIANwMAIABBoKwBakIANwMAIABBqK4BakIANwMAIABBoK4BakIANwMAIABBmK4BakIANwMAIABBkK4BakIANwMAIABBmLABakIANwMAIABBkLABakIANwMAIABBiLABakIANwMAIABBgLABakIANwMAIABBiLIBakIANwMAIABBgLIBakIANwMAIABB+LEBakIANwMAIABB8LEBakIANwMAIABB+LMBakIANwMAIABB8LMBakIANwMAIABB6LMBakIANwMAIABB4LMBakIANwMAIABB6LUBakIANwMAIABB4LUBakIANwMAIABB2LUBakIANwMAIABB0LUBakIANwMAIABB2LcBakIANwMAIABB0LcBakIANwMAIABByLcBakIANwMAIABBwLcBakIANwMAIABByLkBakIANwMAIABBwLkBakIANwMAIABBuLkBakIANwMAIABBsLkBakIANwMAIABBuLsBakIANwMAIABBsLsBakIANwMAIABBqLsBakIANwMAIABBoLsBakIANwMAIABBqL0BakIANwMAIABBoL0BakIANwMAIABBmL0BakIANwMAIABBkL0BakIANwMAIABBmL8BakIANwMAIABBkL8BakIANwMAIABBiL8BakIANwMAIABBgL8BakIANwMAIABBiMEBakIANwMAIABBgMEBakIANwMAIABB+MABakIANwMAIABB8MABakIANwMAIABB+MIBakIANwMAIABB8MIBakIANwMAIABB6MIBakIANwMAIABB4MIBakIANwMAIABB6MQBakIANwMAIABB4MQBakIANwMAIABB2MQBakIANwMAIABB0MQBakIANwMAIABB2MYBakIANwMAIABB0MYBakIANwMAIABByMYBakIANwMAIABBwMYBakIANwMAIABByMgBakIANwMAIABBwMgBakIANwMAIABBuMgBakIANwMAIABBsMgBakIANwMAIABBuMoBakIANwMAIABBsMoBakIANwMAIABBqMoBakIANwMAIABBoMoBakIANwMAIABBqMwBakIANwMAIABBoMwBakIANwMAIABBmMwBakIANwMAIABBkMwBakIANwMAIABB8NoBakIANwMAIABB6NoBakIANwMAIABB4NoBakIANwMAIABB2NoBakIANwMAIABBgNkBakIANwMAQQAhAiAAQfjYAWpBADYCACAAQfDYAWpCADcCACAAQgA3AujYASAAQZDZAWpCs+bMmbPmzPU/NwMAIABBiNkBakKas+bMmbPm9D83AwAgAEGgxBUQgAkiATYC6NgBIAFBAEGgxBUQ3wkhASAAQgA3A8jYASAAQezYAWogAUGgxBVqNgIAIABB0NgBakIANwMAIABCADcDwNYBIABByNYBakIANwMAIABBwMwBakEAQZAIEN8JGiAAQbjcAWpBAEHQAhDfCSEDQcSGAigCACEBIABBIDYCiN8BIABCADcD2NgBIABCADcDwNgBIABCmrPmzJmz5tw/NwOI3QEgAEKas+bMmbPm3D83A4jbASAAQZDdAWpCmrPmzJmz5tw/NwMAIABBkNsBaiIEQpqz5syZs+bcPzcDACAAQZjdAWpCmrPmzJmz5tw/NwMAIABBmNsBakKas+bMmbPm3D83AwAgAEGg3QFqQpqz5syZs+bcPzcDACAAQaDbAWpCmrPmzJmz5tw/NwMAIABBqN0BakKas+bMmbPm3D83AwAgAEGo2wFqQpqz5syZs+bcPzcDACAAQbDdAWpCmrPmzJmz5tw/NwMAIABBsNsBakKas+bMmbPm3D83AwAgAEG43QFqQpqz5syZs+bcPzcDACAAQbjbAWpCmrPmzJmz5tw/NwMAIABBwN0BakKas+bMmbPm3D83AwAgAEHA2wFqQpqz5syZs+bcPzcDACAAIAGyQwAAekSVOALg2AEgAEHI3QFqQpqz5syZs+bcPzcDACAAQcjbAWpCmrPmzJmz5tw/NwMAIABB0N0BakKas+bMmbPm3D83AwAgAEHQ2wFqQpqz5syZs+bcPzcDACAAQdjdAWpCmrPmzJmz5tw/NwMAIABB2NsBakKas+bMmbPm3D83AwAgAEHg3QFqQpqz5syZs+bcPzcDACAAQeDbAWpCmrPmzJmz5tw/NwMAIABB6N0BakKas+bMmbPm3D83AwAgAEHo2wFqQpqz5syZs+bcPzcDACAAQfDdAWpCmrPmzJmz5tw/NwMAIABB8NsBakKas+bMmbPm3D83AwAgAEH43QFqQpqz5syZs+bcPzcDACAAQfjbAWpCmrPmzJmz5tw/NwMAIABBgN4BakKas+bMmbPm3D83AwAgAEGA3AFqQpqz5syZs+bcPzcDACAAQYjeAWpCmrPmzJmz5tw/NwMAIABBiNwBakKas+bMmbPm3D83AwAgAEGQ3gFqQpqz5syZs+bcPzcDACAAQZDcAWpCmrPmzJmz5tw/NwMAIABBmN4BakKas+bMmbPm3D83AwAgAEGY3AFqQpqz5syZs+bcPzcDACAAQaDeAWpCmrPmzJmz5tw/NwMAIABBoNwBakKas+bMmbPm3D83AwAgAEGo3gFqQpqz5syZs+bcPzcDACAAQajcAWpCmrPmzJmz5tw/NwMAIABBsN4BakKas+bMmbPm3D83AwAgAEGw3AFqQpqz5syZs+bcPzcDACAAQbjeAWpCmrPmzJmz5tw/NwMAIANCmrPmzJmz5tw/NwMAIABBwN4BakKas+bMmbPm3D83AwAgAEHA3AFqQpqz5syZs+bcPzcDACAAQcjeAWpCmrPmzJmz5tw/NwMAIABByNwBakKas+bMmbPm3D83AwAgAEHQ3gFqQpqz5syZs+bcPzcDACAAQdDcAWpCmrPmzJmz5tw/NwMAIABB2N4BakKas+bMmbPm3D83AwAgAEHY3AFqQpqz5syZs+bcPzcDACAAQeDeAWpCmrPmzJmz5tw/NwMAIABB4NwBakKas+bMmbPm3D83AwAgAEHo3gFqQpqz5syZs+bcPzcDACAAQejcAWpCmrPmzJmz5tw/NwMAIABB8N4BakKas+bMmbPm3D83AwAgAEHw3AFqQpqz5syZs+bcPzcDACAAQfjeAWpCmrPmzJmz5tw/NwMAIABB+NwBakKas+bMmbPm3D83AwAgAEGA3wFqQpqz5syZs+bcPzcDACAAQYDdAWpCmrPmzJmz5tw/NwMAIAAgAUEKbTYCjN8BIARCmrPmzJmz5uQ/NwMAIABCgICAgICAgPA/NwOI2wEDQCAAIAJBA3RqIgFBwNABakKAgICAgICA+D83AwAgAUHAzgFqIAJBAWoiAkENbLciBTkDACABQcDMAWogBTkDACABQcDSAWpCgICAgICAgPg/NwMAIAFBwNQBakKas+bMmbPm5D83AwAgAUHA1gFqQoCAgICAgIDwPzcDACACQSBHDQALIABCgICAgICAwKTAADcDwMwBIABB0MwBakKAgICAgICwscAANwMAIABByMwBakKAgICAgIDArMAANwMAC5wCACAAEPYDIABB2NABakKmt5KGgtac9D83AwAgAEHQ0AFqQvWm4qDgysP0PzcDACAAQcjQAWpCkLDloYvZnfU/NwMAIABCw+uj4fXR8PQ/NwPA0AEgAEHYzAFqQoCAgICAgOPIwAA3AwAgAEHQzAFqQoCAgICAgObHwAA3AwAgAEHIzAFqQoCAgICAgIrGwAA3AwAgAEKAgICAgICUxMAANwPAzAEgAEHQ0gFqQubMmbPmzJnzPzcDACAAQcjSAWpC5syZs+bMmfM/NwMAIABC5syZs+bMmfM/NwPA0gEgAEHQzgFqQoCAgICAgICUwAA3AwAgAEHIzgFqQoCAgICAgMCiwAA3AwAgAEKAgICAgIDQr8AANwPAzgEgAAuZCAIFfwF8IABCADcD2NgBIABB1MgAagJ/IAArA8DMASIHmUQAAAAAAADgQWMEQCAHqgwBC0GAgICAeAsiAzYCACAAQdjIAGoiBCAAKALASCAAQdDIAGoiBSgCACICQQN0aiIGKwMARDMzMzMzM+s/oiABoCIHOQMAIAYgBzkDACAFQQAgAkEBaiACIANBf2pGGzYCACAAIAQrAwAgACsD2NgBoDkD2NgBIABB9MoAagJ/IABByMwBaisDACIHmUQAAAAAAADgQWMEQCAHqgwBC0GAgICAeAsiAzYCACAAQfjKAGoiBCAAQeDKAGooAgAgAEHwygBqIgUoAgAiAkEDdGoiBisDAEQzMzMzMzPrP6IgAaAiBzkDACAGIAc5AwAgBUEAIAJBAWogAiADQX9qRhs2AgAgACAEKwMAIAArA9jYAaA5A9jYASAAQZTNAGoCfyAAQdDMAWorAwAiB5lEAAAAAAAA4EFjBEAgB6oMAQtBgICAgHgLIgM2AgAgAEGYzQBqIgQgAEGAzQBqKAIAIABBkM0AaiIFKAIAIgJBA3RqIgYrAwBEMzMzMzMz6z+iIAGgIgc5AwAgBiAHOQMAIAVBACACQQFqIAIgA0F/akYbNgIAIAAgBCsDACAAKwPY2AGgOQPY2AEgAEG0zwBqAn8gAEHYzAFqKwMAIgeZRAAAAAAAAOBBYwRAIAeqDAELQYCAgIB4CyIDNgIAIABBuM8AaiIEIABBoM8AaigCACAAQbDPAGoiBSgCACICQQN0aiIGKwMARDMzMzMzM+s/oiABoCIBOQMAIAYgATkDACAFQQAgAkEBaiACIANBf2pGGzYCACAAIAQrAwAgACsD2NgBoCIBOQPY2AEgAAJ/IAArA8DOASIHmUQAAAAAAADgQWMEQCAHqgwBC0GAgICAeAsiAzYCVCAAIAAoAkAgACgCUCICQQN0aiIEKwMAIgcgByAAKwNoIgeiIAGgIgEgB6KhOQNYIAQgATkDACAAQQAgAkEBaiACIANBf2pGGzYCUCAAAn8gAEHIzgFqKwMAIgGZRAAAAAAAAOBBYwRAIAGqDAELQYCAgIB4CyIDNgL0AiAAIAAoAuACIAAoAvACIgJBA3RqIgQrAwAiASABIAArA4gDIgGiIAArA1igIgcgAaKhOQP4AiAEIAc5AwAgAEEAIAJBAWogAiADQX9qRhs2AvACIAACfyAAQdDOAWorAwAiAZlEAAAAAAAA4EFjBEAgAaoMAQtBgICAgHgLIgM2ApQFIAAgACgCgAUgACgCkAUiAkEDdGoiBCsDACIBIAEgACsDqAUiAaIgACsD+AKgIgcgAaKhOQOYBSAEIAc5AwAgAEEAIAJBAWogAiADQX9qRhs2ApAFIAAgACsDmAUiATkDwNgBIAEL6AYBAX8jAEGAAWsiASQAIAAQ9gMgAEH4zAFqQoCAgICAgNzIwAA3AwAgAEHwzAFqQoCAgICAgKTJwAA3AwAgAEHozAFqQoCAgICAgMzKwAA3AwAgAEHgzAFqQoCAgICAgP3JwAA3AwAgAEHYzAFqQoCAgICAgI7LwAA3AwAgAEHQzAFqQoCAgICAgNPLwAA3AwAgAEHIzAFqQoCAgICAgNHMwAA3AwAgAEKAgICAgICVzMAANwPAzAEgAULh9dHw+qi49T83A0ggAULh9dHw+qi49T83A0AgAULh9dHw+qi49T83A1AgAULh9dHw+qi49T83A1ggAULh9dHw+qi49T83A2AgAULh9dHw+qi49T83A2ggAULh9dHw+qi49T83A3AgAULh9dHw+qi49T83A3ggAUKas+bMmbPm5D83AzggAUKas+bMmbPm5D83AzAgAUKas+bMmbPm5D83AyggAUKas+bMmbPm5D83AyAgAUKas+bMmbPm5D83AxggAUKas+bMmbPm5D83AxAgAUKas+bMmbPm5D83AwggAUKas+bMmbPm5D83AwAgAEH40AFqQuH10fD6qLj1PzcDACAAQfDQAWpC4fXR8PqouPU/NwMAIABB6NABakLh9dHw+qi49T83AwAgAEHg0AFqQuH10fD6qLj1PzcDACAAQdjQAWpC4fXR8PqouPU/NwMAIABB0NABakLh9dHw+qi49T83AwAgAEHI0AFqQuH10fD6qLj1PzcDACAAQcDQAWpC4fXR8PqouPU/NwMAIABB4NQBaiABKQMgNwMAIABB6NQBaiABKQMoNwMAIABBwNQBaiABKQMANwMAIABByNQBaiABKQMINwMAIABB2NQBaiABKQMYNwMAIABB8NQBaiABKQMwNwMAIABB+NQBaiABKQM4NwMAIABB0NQBaiABKQMQNwMAIABB2NIBakKAgICAgICA8D83AwAgAEHQ0gFqQoCAgICAgIDwPzcDACAAQcjSAWpCgICAgICAgPA/NwMAIABCgICAgICAgPA/NwPA0gEgAEHYzgFqQoCAgICAgNS6wAA3AwAgAEHQzgFqQoCAgICAgOS9wAA3AwAgAEHIzgFqQoCAgICAgNjAwAA3AwAgAEKAgICAgICItsAANwPAzgEgAUGAAWokACAAC5gKAgZ/AXwgAEIANwPY2AEgAEG41gFqIANEAAAAAAAA8D+kRAAAAAAAAAAApSIDOQMAIABBsNYBaiADOQMAIABBqNYBaiADOQMAIABBoNYBaiADOQMAIABBmNYBaiADOQMAIABBkNYBaiADOQMAIABBiNYBaiADOQMAIABBgNYBaiADOQMAIABB+NUBaiADOQMAIABB8NUBaiADOQMAIABB6NUBaiADOQMAIABB4NUBaiADOQMAIABB2NUBaiADOQMAIABB0NUBaiADOQMAIABByNUBaiADOQMAIABBwNUBaiADOQMAIABBuNUBaiADOQMAIABBsNUBaiADOQMAIABBqNUBaiADOQMAIABBoNUBaiADOQMAIABBmNUBaiADOQMAIABBkNUBaiADOQMAIABBiNUBaiADOQMAIABBgNUBaiADOQMAIABB+NQBaiADOQMAIABB8NQBaiADOQMAIABB6NQBaiADOQMAIABB4NQBaiADOQMAIABB2NQBaiADOQMAIABB0NQBaiADOQMAIABByNQBaiADOQMAIAAgAzkDwNQBIABBuNIBaiACRJqZmZmZmbk/okThehSuR+HqP6BEAAAAAAAA8D+kRAAAAAAAAAAApSICOQMAIABBsNIBaiACOQMAIABBqNIBaiACOQMAIABBoNIBaiAC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QcAAIANrrYYgASADrSIEiIQhASACIASIIQILIAAgATcDACAAIAI3AwgLUAEBfgJAIANBwABxBEAgASADQUBqrYYhAkIAIQEMAQsgA0UNACACIAOtIgSGIAFBwAAgA2utiIQhAiABIASGIQELIAAgATcDACAAIAI3AwgL2QMCAn8CfiMAQSBrIgIkAAJAIAFC////////////AIMiBUKAgICAgIDA/0N8IAVCgICAgICAwIC8f3xUBEAgAUIEhiAAQjyIhCEEIABC//////////8PgyIAQoGAgICAgICACFoEQCAEQoGAgICAgICAwAB8IQQMAgsgBEKAgICAgICAgEB9IQQgAEKAgICAgICAgAiFQgBSDQEgBEIBgyAEfCEEDAELIABQIAVCgICAgICAwP//AFQgBUKAgICAgIDA//8AURtFBEAgAUIEhiAAQjyIhEL/////////A4NCgICAgICAgPz/AIQhBAwBC0KAgICAgICA+P8AIQQgBUL///////+//8MAVg0AQgAhBCAFQjCIpyIDQZH3AEkNACACIAAgAUL///////8/g0KAgICAgIDAAIQiBEGB+AAgA2sQ2QQgAkEQaiAAIAQgA0H/iH9qENoEIAIpAwhCBIYgAikDACIAQjyIhCEEIAIpAxAgAikDGIRCAFKtIABC//////////8Pg4QiAEKBgICAgICAgAhaBEAgBEIBfCEEDAELIABCgICAgICAgIAIhUIAUg0AIARCAYMgBHwhBAsgAkEgaiQAIAQgAUKAgICAgICAgIB/g4S/C5IBAQN8RAAAAAAAAPA/IAAgAKIiAkQAAAAAAADgP6IiA6EiBEQAAAAAAADwPyAEoSADoSACIAIgAiACRJAVyxmgAfo+okR3UcEWbMFWv6CiRExVVVVVVaU/oKIgAiACoiIDIAOiIAIgAkTUOIi+6fqovaJExLG0vZ7uIT6gokStUpyAT36SvqCioKIgACABoqGgoAv7EQMPfwF+A3wjAEGwBGsiBiQAIAIgAkF9akEYbSIFQQAgBUEAShsiDkFobGohDCAEQQJ0QbD4AGooAgAiCyADQX9qIghqQQBOBEAgAyALaiEFIA4gCGshAgNAIAZBwAJqIAdBA3RqIAJBAEgEfEQAAAAAAAAAAAUgAkECdEHA+ABqKAIAtws5AwAgAkEBaiECIAdBAWoiByAF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EI0a9yYwP6CiRBWD4P7I21c/oKJEk4Ru6eMmgj+gokT+QbMbuqGrP6CioKIgAaCiIAGgoCIGoCEBIARFBEBBASACQQF0a7ciByAAIAYgASABoiABIAego6GgIgAgAKChIgCaIAAgAxsPCyACBHxEAAAAAAAA8L8gAaMiByAHvUKAgICAcIO/IgcgBiABvUKAgICAcIO/IgEgAKGhoiAHIAGiRAAAAAAAAPA/oKCiIAegBSABCwuEAQECfyMAQRBrIgEkAAJAIAC9QiCIp0H/////B3EiAkH7w6T/A00EQCACQYCAgPIDSQ0BIABEAAAAAAAAAABBABDnBCEADAELIAJBgIDA/wdPBEAgACAAoSEADAELIAAgARDeBCECIAErAwAgASsDCCACQQFxEOcEIQALIAFBEGokACAAC/kDAwF/AX4DfCAAvSICQiCIp0H/////B3EiAUGAgMCgBEkEQAJAAn8gAUH//+/+A00EQEF/IAFBgICA8gNPDQEaDAILIACZIQAgAUH//8v/A00EQCABQf//l/8DTQRAIAAgAKBEAAAAAAAA8L+gIABEAAAAAAAAAECgoyEAQQAMAgsgAEQAAAAAAADwv6AgAEQAAAAAAADwP6CjIQBBAQwBCyABQf//jYAETQRAIABEAAAAAAAA+L+gIABEAAAAAAAA+D+iRAAAAAAAAPA/oKMhAEECDAELRAAAAAAAAPC/IACjIQBBAwshASAAIACiIgQgBKIiAyADIAMgAyADRC9saixEtKK/okSa/d5SLd6tv6CiRG2adK/ysLO/oKJEcRYj/sZxvL+gokTE65iZmZnJv6CiIQUgBCADIAMgAyADIANEEdoi4zqtkD+iROsNdiRLe6k/oKJEUT3QoGYNsT+gokRuIEzFzUW3P6CiRP+DAJIkScI/oKJEDVVVVVVV1T+goiEDIAFBf0wEQCAAIAAgBSADoKKhDwsgAUEDdCIBQdCOAWorAwAgACAFIAOgoiABQfCOAWorAwChIAChoSIAmiAAIAJCAFMbIQALIAAPCyAARBgtRFT7Ifk/IACmIAJC////////////AINCgICAgICAgPj/AFYbC9wCAgJ/A30gALwiAkH/////B3EiAUGAgIDkBEkEQAJAAn8gAUH////2A00EQEF/IAFBgICAzANPDQEaDAILIACLIQAgAUH//9/8A00E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BAsgASwAACEAQYjwAigCACgCAEUEQCAGIABB/78DcTYCAEEBIQQMBAsgAEH/AXFBvn5qIgBBMksNASAAQQJ0QYCdAWooAgAhAyACQX9qIgBFDQIgAUEBaiEBCyABLQAAIghBA3YiCUFwaiADQRp1IAlqckEHSw0AA0AgAEF/aiEAIAhBgH9qIANBBnRyIgNBAE4EQCAFQQA2AgAgBiADNgIAIAIgAGshBAwECyAARQ0CIAFBAWoiAS0AACIIQcABcUGAAUYNAAsLIAVBADYCAEGQ+wJBGTYCAEF/IQQMAQsgBSADNgIACyAHQRBqJAAgBAvLAQIEfwJ+IwBBEGsiAyQAIAG8IgRBgICAgHhxIQUCfiAEQf////8HcSICQYCAgHxqQf////cHTQRAIAKtQhmGQoCAgICAgIDAP3wMAQsgAkGAgID8B08EQCAErUIZhkKAgICAgIDA//8AhAwBCyACRQRAQgAMAQsgAyACrUIAIAJnIgJB0QBqENoEIAMpAwAhBiADKQMIQoCAgICAgMAAhUGJ/wAgAmutQjCGhAshByAAIAY3AwAgACAHIAWtQiCGhDcDCCADQRBqJAALngsCBX8PfiMAQeAAayIFJAAgBEIvhiADQhGIhCEPIAJCIIYgAUIgiIQhDSAEQv///////z+DIg5CD4YgA0IxiIQhECACIASFQoCAgICAgICAgH+DIQogDkIRiCERIAJC////////P4MiC0IgiCESIARCMIinQf//AXEhBwJAAn8gAkIwiKdB//8BcSIJQX9qQf3/AU0EQEEAIAdBf2pB/v8BSQ0BGgsgAVAgAkL///////////8AgyIMQoCAgICAgMD//wBUIAxCgICAgICAwP//AFEbRQRAIAJCgICAgICAIIQhCgwCCyADUCAEQv///////////wCDIgJCgICAgICAwP//AFQgAkKAgICAgIDA//8AURtFBEAgBEKAgICAgIAghCEKIAMhAQwCCyABIAxCgICAgICAwP//AIWEUARAIAIgA4RQBEBCgICAgICA4P//ACEKQgAhAQwDCyAKQoCAgICAgMD//wCEIQpCACEBDAILIAMgAkKAgICAgIDA//8AhYRQBEAgASAMhCECQgAhASACUARAQoCAgICAgOD//wAhCgwDCyAKQoCAgICAgMD//wCEIQoMAgsgASAMhFAEQEIAIQEMAgsgAiADhFAEQEIAIQEMAgsgDEL///////8/WARAIAVB0ABqIAEgCyABIAsgC1AiBht5IAZBBnStfKciBkFxahDaBCAFKQNYIgtCIIYgBSkDUCIBQiCIhCENIAtCIIghEkEQIAZrIQYLIAYgAkL///////8/Vg0AGiAFQUBrIAMgDiADIA4gDlAiCBt5IAhBBnStfKciCEFxahDaBCAFKQNIIgJCD4YgBSkDQCIDQjGIhCEQIAJCL4YgA0IRiIQhDyACQhGIIREgBiAIa0EQagshBiAPQv////8PgyICIAFC/////w+DIgF+Ig8gA0IPhkKAgP7/D4MiAyANQv////8PgyIMfnwiBEIghiIOIAEgA358Ig0gDlStIAIgDH4iFSADIAtC/////w+DIgt+fCITIBBC/////w+DIg4gAX58IhAgBCAPVK1CIIYgBEIgiIR8IhQgAiALfiIWIAMgEkKAgASEIg9+fCIDIAwgDn58IhIgASARQv////8Hg0KAgICACIQiAX58IhFCIIZ8Ihd8IQQgByAJaiAGakGBgH9qIQYCQCALIA5+IhggAiAPfnwiAiAYVK0gAiABIAx+fCIMIAJUrXwgDCATIBVUrSAQIBNUrXx8IgIgDFStfCABIA9+fCABIAt+IgsgDiAPfnwiASALVK1CIIYgAUIgiIR8IAIgAUIghnwiASACVK18IAEgESASVK0gAyAWVK0gEiADVK18fEIghiARQiCIhHwiAyABVK18IAMgFCAQVK0gFyAUVK18fCICIANUrXwiAUKAgICAgIDAAINQRQRAIAZBAWohBgwBCyANQj+IIQMgAUIBhiACQj+IhCEBIAJCAYYgBEI/iIQhAiANQgGGIQ0gAyAEQgGGhCEECyAGQf//AU4EQCAKQoCAgICAgMD//wCEIQpCACEBDAELAn4gBkEATARAQQEgBmsiB0H/AE0EQCAFQRBqIA0gBCAHENkEIAVBIGogAiABIAZB/wBqIgYQ2gQgBUEwaiANIAQgBhDaBCAFIAIgASAHENkEIAUpAzAgBSkDOIRCAFKtIAUpAyAgBSkDEISEIQ0gBSkDKCAFKQMYhCEEIAUpAwAhAiAFKQMIDAILQgAhAQwCCyABQv///////z+DIAatQjCGhAsgCoQhCiANUCAEQn9VIARCgICAgICAgICAf1EbRQRAIAogAkIBfCIBIAJUrXwhCgwBCyANIARCgICAgICAgICAf4WEUEUEQCACIQEMAQsgCiACIAJCAYN8IgEgAlStfCEKCyAAIAE3AwAgACAKNwMIIAVB4ABqJAALfwICfwF+IwBBEGsiAyQAIAACfiABRQRAQgAMAQsgAyABIAFBH3UiAmogAnMiAq1CACACZyICQdEAahDaBCADKQMIQoCAgICAgMAAhUGegAEgAmutQjCGfCABQYCAgIB4ca1CIIaEIQQgAykDAAs3AwAgACAENwMIIANBEGokAAvICQIEfwR+IwBB8ABrIgUkACAEQv///////////wCDIQoCQAJAIAFCf3wiC0J/USACQv///////////wCDIgkgCyABVK18Qn98IgtC////////v///AFYgC0L///////+///8AURtFBEAgA0J/fCILQn9SIAogCyADVK18Qn98IgtC////////v///AFQgC0L///////+///8AURsNAQsgAVAgCUKAgICAgIDA//8AVCAJQoCAgICAgMD//wBRG0UEQCACQoCAgICAgCCEIQQgASEDDAILIANQIApCgICAgICAwP//AFQgCkKAgICAgIDA//8AURtFBEAgBEKAgICAgIAghCEEDAILIAEgCUKAgICAgIDA//8AhYRQBEBCgICAgICA4P//ACACIAEgA4UgAiAEhUKAgICAgICAgIB/hYRQIgYbIQRCACABIAYbIQMMAgsgAyAKQoCAgICAgMD//wCFhFANASABIAmEUARAIAMgCoRCAFINAiABIAODIQMgAiAEgyEEDAILIAMgCoRQRQ0AIAEhAyACIQQMAQsgAyABIAMgAVYgCiAJViAJIApRGyIHGyEKIAQgAiAHGyILQv///////z+DIQkgAiAEIAcbIgJCMIinQf//AXEhCCALQjCIp0H//wFxIgZFBEAgBUHgAGogCiAJIAogCSAJUCIGG3kgBkEGdK18pyIGQXFqENoEIAUpA2ghCSAFKQNgIQpBECAGayEGCyABIAMgBxshAyACQv///////z+DIQEgCAR+IAEFIAVB0ABqIAMgASADIAEgAVAiBxt5IAdBBnStfKciB0FxahDaBEEQIAdrIQggBSkDUCEDIAUpA1gLQgOGIANCPYiEQoCAgICAgIAEhCEEIAlCA4YgCkI9iIQhASACIAuFIQwCfiADQgOGIgMgBiAIayIHRQ0AGiAHQf8ASwRAQgAhBEIBDAELIAVBQGsgAyAEQYABIAdrENoEIAVBMGogAyAEIAcQ2QQgBSkDOCEEIAUpAzAgBSkDQCAFKQNIhEIAUq2ECyEDIAFCgICAgICAgASEIQkgCkIDhiECAkAgDEJ/VwRAIAIgA30iASAJIAR9IAIgA1StfSIDhFAEQEIAIQNCACEEDAMLIANC/////////wNWDQEgBUEgaiABIAMgASADIANQIgcbeSAHQQZ0rXynQXRqIgcQ2gQgBiAHayEGIAUpAyghAyAFKQMgIQEMAQsgAiADfCIBIANUrSAEIAl8fCIDQoCAgICAgIAIg1ANACABQgGDIANCP4YgAUIBiISEIQEgBkEBaiEGIANCAYghAwsgC0KAgICAgICAgIB/gyECIAZB//8BTgRAIAJCgICAgICAwP//AIQhBEIAIQMMAQtBACEHAkAgBkEASgRAIAYhBwwBCyAFQRBqIAEgAyAGQf8AahDaBCAFIAEgA0EBIAZrENkEIAUpAwAgBSkDECAFKQMYhEIAUq2EIQEgBSkDCCEDCyADQj2GIAFCA4iEIgQgAadBB3EiBkEES618IgEgBFStIANCA4hC////////P4MgAoQgB61CMIaEfCABIAFCAYNCACAGQQRGGyIBfCIDIAFUrXwhBAsgACADNwMAIAAgBDcDCCAFQfAAaiQAC4ECAgJ/BH4jAEEQayICJAAgAb0iBUKAgICAgICAgIB/gyEHAn4gBUL///////////8AgyIEQoCAgICAgIB4fEL/////////7/8AWARAIARCPIYhBiAEQgSIQoCAgICAgICAPHwMAQsgBEKAgICAgICA+P8AWgRAIAVCPIYhBiAFQgSIQoCAgICAgMD//wCEDAELIARQBEBCAAwBCyACIARCACAEQoCAgIAQWgR/IARCIIinZwUgBadnQSBqCyIDQTFqENoEIAIpAwAhBiACKQMIQoCAgICAgMAAhUGM+AAgA2utQjCGhAshBCAAIAY3AwAgACAEIAeENwMIIAJBEGokAAvbAQIBfwJ+QQEhBAJAIABCAFIgAUL///////////8AgyIFQoCAgICAgMD//wBWIAVCgICAgICAwP//AFEbDQAgAkIAUiADQv///////////wCDIgZCgICAgICAwP//AFYgBkKAgICAgIDA//8AURsNACAAIAKEIAUgBoSEUARAQQAPCyABIAODQgBZBEBBfyEEIAAgAlQgASADUyABIANRGw0BIAAgAoUgASADhYRCAFIPC0F/IQQgACACViABIANVIAEgA1EbDQAgACAChSABIAOFhEIAUiEECyAEC9gBAgF/AX5BfyECAkAgAEIAUiABQv///////////wCDIgNCgICAgICAwP//AFYgA0KAgICAgIDA//8AURsNACAAIANCgICAgICAgP8/hIRQBEBBAA8LIAFCgICAgICAgP8/g0IAWQRAIABCAFQgAUKAgICAgICA/z9TIAFCgICAgICAgP8/URsNASAAIAFCgICAgICAgP8/hYRCAFIPCyAAQgBWIAFCgICAgICAgP8/VSABQoCAgICAgID/P1EbDQAgACABQoCAgICAgID/P4WEQgBSIQILIAILNQAgACABNwMAIAAgAkL///////8/gyAEQjCIp0GAgAJxIAJCMIinQf//AXFyrUIwhoQ3AwgLZwIBfwF+IwBBEGsiAiQAIAACfiABRQRAQgAMAQsgAiABrUIAQfAAIAFnQR9zIgFrENoEIAIpAwhCgICAgICAwACFIAFB//8Aaq1CMIZ8IQMgAikDAAs3AwAgACADNwMIIAJBEGokAAtFAQF/IwBBEGsiBSQAIAUgASACIAMgBEKAgICAgICAgIB/hRDhBSAFKQMAIQEgACAFKQMINwMIIAAgATcDACAFQRBqJAALxAIBAX8jAEHQAGsiBCQAAkAgA0GAgAFOBEAgBEEgaiABIAJCAEKAgICAgICA//8AEN8FIAQpAyghAiAEKQMgIQEgA0H//wFIBEAgA0GBgH9qIQMMAgsgBEEQaiABIAJCAEKAgICAgICA//8AEN8FIANB/f8CIANB/f8CSBtBgoB+aiEDIAQpAxghAiAEKQMQIQEMAQsgA0GBgH9KDQAgBEFAayABIAJCAEKAgICAgIDAABDfBSAEKQNIIQIgBCkDQCEBIANBg4B+SgRAIANB/v8AaiEDDAELIARBMGogASACQgBCgICAgICAwAAQ3wUgA0GGgH0gA0GGgH1KG0H8/wFqIQMgBCkDOCECIAQpAzAhAQsgBCABIAJCACADQf//AGqtQjCGEN8FIAAgBCkDCDcDCCAAIAQpAwA3AwAgBEHQAGokAAuOEQIFfwx+IwBBwAFrIgUkACAEQv///////z+DIRIgAkL///////8/gyEMIAIgBIVCgICAgICAgICAf4MhESAEQjCIp0H//wFxIQcCQAJAAkAgAkIwiKdB//8BcSIJQX9qQf3/AU0EQCAHQX9qQf7/AUkNAQsgAVAgAkL///////////8AgyIKQoCAgICAgMD//wBUIApCgICAgICAwP//AFEbRQRAIAJCgICAgICAIIQhEQwCCyADUCAEQv///////////wCDIgJCgICAgICAwP//AFQgAkKAgICAgIDA//8AURtFBEAgBEKAgICAgIAghCERIAMhAQwCCyABIApCgICAgICAwP//AIWEUARAIAMgAkKAgICAgIDA//8AhYRQBEBCACEBQoCAgICAgOD//wAhEQwDCyARQoCAgICAgMD//wCEIRFCACEBDAILIAMgAkKAgICAgIDA//8AhYRQBEBCACEBDAILIAEgCoRQDQIgAiADhFAEQCARQoCAgICAgMD//wCEIRFCACEBDAILIApC////////P1gEQCAFQbABaiABIAwgASAMIAxQIgYbeSAGQQZ0rXynIgZBcWoQ2gRBECAGayEGIAUpA7gBIQwgBSkDsAEhAQsgAkL///////8/Vg0AIAVBoAFqIAMgEiADIBIgElAiCBt5IAhBBnStfKciCEFxahDaBCAGIAhqQXBqIQYgBSkDqAEhEiAFKQOgASEDCyAFQZABaiASQoCAgICAgMAAhCIUQg+GIANCMYiEIgJChMn5zr/mvIL1ACACfSIEENsFIAVBgAFqQgAgBSkDmAF9IAQQ2wUgBUHwAGogBSkDiAFCAYYgBSkDgAFCP4iEIgQgAhDbBSAFQeAAaiAEQgAgBSkDeH0Q2wUgBUHQAGogBSkDaEIBhiAFKQNgQj+IhCIEIAIQ2wUgBUFAayAEQgAgBSkDWH0Q2wUgBUEwaiAFKQNIQgGGIAUpA0BCP4iEIgQgAhDbBSAFQSBqIARCACAFKQM4fRDbBSAFQRBqIAUpAyhCAYYgBSkDIEI/iIQiBCACENsFIAUgBEIAIAUpAxh9ENsFIAYgCSAHa2ohBgJ+QgAgBSkDCEIBhiAFKQMAQj+IhEJ/fCIKQv////8PgyIEIAJCIIgiDn4iECAKQiCIIgogAkL/////D4MiC358IgJCIIYiDSAEIAt+fCILIA1UrSAKIA5+IAIgEFStQiCGIAJCIIiEfHwgCyAEIANCEYhC/////w+DIg5+IhAgCiADQg+GQoCA/v8PgyINfnwiAkIghiIPIAQgDX58IA9UrSAKIA5+IAIgEFStQiCGIAJCIIiEfHx8IgIgC1StfCACQgBSrXx9IgtC/////w+DIg4gBH4iECAKIA5+Ig0gBCALQiCIIg9+fCILQiCGfCIOIBBUrSAKIA9+IAsgDVStQiCGIAtCIIiEfHwgDkIAIAJ9IgJCIIgiCyAEfiIQIAJC/////w+DIg0gCn58IgJCIIYiDyAEIA1+fCAPVK0gCiALfiACIBBUrUIghiACQiCIhHx8fCICIA5UrXwgAkJ+fCIQIAJUrXxCf3wiC0L/////D4MiAiAMQgKGIAFCPoiEQv////8PgyIEfiIOIAFCHohC/////w+DIgogC0IgiCILfnwiDSAOVK0gDSAQQiCIIg4gDEIeiEL//+//D4NCgIAQhCIMfnwiDyANVK18IAsgDH58IAIgDH4iEyAEIAt+fCINIBNUrUIghiANQiCIhHwgDyANQiCGfCINIA9UrXwgDSAKIA5+IhMgEEL/////D4MiECAEfnwiDyATVK0gDyACIAFCAoZC/P///w+DIhN+fCIVIA9UrXx8Ig8gDVStfCAPIAsgE34iCyAMIBB+fCIMIAQgDn58IgQgAiAKfnwiAkIgiCACIARUrSAMIAtUrSAEIAxUrXx8QiCGhHwiDCAPVK18IAwgFSAOIBN+IgQgCiAQfnwiCkIgiCAKIARUrUIghoR8IgQgFVStIAQgAkIghnwgBFStfHwiBCAMVK18IgJC/////////wBYBEAgAUIxhiAEQv////8PgyIBIANC/////w+DIgp+IgxCAFKtfUIAIAx9IhAgBEIgiCIMIAp+Ig0gASADQiCIIgt+fCIOQiCGIg9UrX0gAkL/////D4MgCn4gASASQv////8Pg358IAsgDH58IA4gDVStQiCGIA5CIIiEfCAEIBRCIIh+IAMgAkIgiH58IAIgC358IAwgEn58QiCGfH0hEiAGQX9qIQYgECAPfQwBCyAEQiGIIQsgAUIwhiACQj+GIARCAYiEIgRC/////w+DIgEgA0L/////D4MiCn4iDEIAUq19QgAgDH0iDiABIANCIIgiDH4iECALIAJCH4aEIg1C/////w+DIg8gCn58IgtCIIYiE1StfSAMIA9+IAogAkIBiCIKQv////8Pg358IAEgEkL/////D4N+fCALIBBUrUIghiALQiCIhHwgBCAUQiCIfiADIAJCIYh+fCAKIAx+fCANIBJ+fEIghnx9IRIgCiECIA4gE30LIQEgBkGAgAFOBEAgEUKAgICAgIDA//8AhCERQgAhAQwBCyAGQf//AGohByAGQYGAf0wEQAJAIAcNACAEIAFCAYYgA1YgEkIBhiABQj+IhCIBIBRWIAEgFFEbrXwiASAEVK0gAkL///////8/g3wiAkKAgICAgIDAAINQDQAgAiARhCERDAILQgAhAQwBCyAEIAFCAYYgA1ogEkIBhiABQj+IhCIBIBRaIAEgFFEbrXwiASAEVK0gAkL///////8/gyAHrUIwhoR8IBGEIRELIAAgATcDACAAIBE3AwggBUHAAWokAA8LIABCADcDACAAIBFCgICAgICA4P//ACACIAOEQgBSGzcDCCAFQcABaiQAC6UIAgV/An4jAEEwayIFJAACQCACQQJNBEAgAkECdCICQZyfAWooAgAhByACQZCfAWooAgAhCANAAn8gASgCBCICIAEoAmhJBEAgASACQQFqNgIEIAItAAAMAQsgARDaBQsiAiIEQSBGIARBd2pBBUlyDQALAkAgAkFVaiIEQQJLBEBBASEGDAELQQEhBiAEQQFrRQ0AQX9BASACQS1GGyEGIAEoAgQiAiABKAJoSQRAIAEgAkEBajYCBCACLQAAIQIMAQsgARDaBSECC0EAIQQCQAJAA0AgBEHMngFqLAAAIAJBIHJGBEACQCAEQQZLDQAgASgCBCICIAEoAmhJBEAgASACQQFqNgIEIAItAAAhAgwBCyABENoFIQILIARBAWoiBEEIRw0BDAILCyAEQQNHBEAgBEEIRg0BIANFDQIgBEEESQ0CIARBCEYNAQsgASgCaCICBEAgASABKAIEQX9qNgIECyADRQ0AIARBBEkNAANAIAIEQCABIAEoAgRBf2o2AgQLIARBf2oiBEEDSw0ACwsgBSAGskMAAIB/lBDeBSAFKQMIIQkgBSkDACEKDAILAkACQAJAIAQNAEEAIQQDQCAEQdWeAWosAAAgAkEgckcNAQJAIARBAUsNACABKAIEIgIgASgCaEkEQCABIAJBAWo2AgQgAi0AACECDAELIAEQ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IAAQ2gULQVBqQQpJDQALCyAAKAJoBEAgACAAKAIEQX9qNgIEC0IAIAZ9IAYgBRshBgwBC0KAgICAgICAgIB/IQYgACgCaEUNACAAIAAoAgRBf2o2AgRCgICAgICAgICAfw8LIAYLtgMCA38BfiMAQSBrIgMkAAJAIAFC////////////AIMiBUKAgICAgIDAv0B8IAVCgICAgICAwMC/f3xUBEAgAUIZiKchAiAAUCABQv///w+DIgVCgICACFQgBUKAgIAIURtFBEAgAkGBgICABGohAgwCCyACQYCAgIAEaiECIAAgBUKAgIAIhYRCAFINASACQQFxIAJqIQIMAQsgAFAgBUKAgICAgIDA//8AVCAFQoCAgICAgMD//wBRG0UEQCABQhmIp0H///8BcUGAgID+B3IhAgwBC0GAgID8ByECIAVC////////v7/AAFYNAEEAIQIgBUIwiKciBEGR/gBJDQAgAyAAIAFC////////P4NCgICAgICAwACEIgVBgf8AIARrENkEIANBEGogACAFIARB/4F/ahDaBCADKQMIIgBCGYinIQIgAykDACADKQMQIAMpAxiEQgBSrYQiBVAgAEL///8PgyIAQoCAgAhUIABCgICACFEbRQRAIAJBAWohAgwBCyAFIABCgICACIWEQgBSDQAgAkEBcSACaiECCyADQSBqJAAgAiABQiCIp0GAgICAeHFyvgvxEwINfwN+IwBBsAJrIgYkACAAKAJMQQBOBH9BAQVBAAsaAkAgAS0AACIERQ0AAkADQAJAAkAgBEH/AXEiA0EgRiADQXdqQQVJcgRAA0AgASIEQQFqIQEgBC0AASIDQSBGIANBd2pBBUlyDQALIABCABDZBQNAAn8gACgCBCIBIAAoAmhJBEAgACABQQFqNgIEIAEtAAAMAQsgABDaBQsiAUEgRiABQXdqQQVJcg0ACwJAIAAoAmhFBEAgACgCBCEBDAELIAAgACgCBEF/aiIBNgIECyABIAAoAghrrCAAKQN4IBB8fCEQDAELAkACQAJAIAEtAAAiBEElRgRAIAEtAAEiA0EqRg0BIANBJUcNAgsgAEIAENkFIAEgBEElRmohBAJ/IAAoAgQiASAAKAJoSQRAIAAgAUEBajYCBCABLQAADAELIAAQ2gULIgEgBC0AAEcEQCAAKAJoBEAgACAAKAIEQX9qNgIEC0EAIQwgAUEATg0IDAULIBBCAXwhEAwDCyABQQJqIQRBACEHDAELAkAgA0FQakEKTw0AIAEtAAJBJEcNACABQQNqIQQgAiABLQABQVBqEPAFIQcMAQsgAUEBaiEEIAIoAgAhByACQQRqIQILQQAhDEEAIQEgBC0AAEFQakEKSQRAA0AgBC0AACABQQpsakFQaiEBIAQtAAEhAyAEQQFqIQQgA0FQakEKSQ0ACwsCfyAEIAQtAAAiBUHtAEcNABpBACEJIAdBAEchDCAELQABIQVBACEKIARBAWoLIQMgBUH/AXFBv39qIghBOUsNASADQQFqIQRBAyEFAkACQAJAAkACQAJAIAhBAWsOOQcEBwQEBAcHBwcDBwcHBwcHBAcHBwcEBwcEBwcHBwcEBwQEBAQEAAQFBwEHBAQEBwcEAgQHBwQHAgQLIANBAmogBCADLQABQegARiIDGyEEQX5BfyADGyEFDAQLIANBAmogBCADLQABQewARiIDGyEEQQNBASADGyEFDAMLQQEhBQwCC0ECIQUMAQtBACEFIAMhBAtBASAFIAQtAAAiA0EvcUEDRiIIGyEOAkAgA0EgciADIAgbIgtB2wBGDQACQCALQe4ARwRAIAtB4wBHDQEgAUEBIAFBAUobIQEMAgsgByAOIBAQ8QUMAgsgAEIAENkFA0ACfyAAKAIEIgMgACgCaEkEQCAAIANBAWo2AgQgAy0AAAwBCyAAENoFCyIDQSBGIANBd2pBBUlyDQALAkAgACgCaEUEQCAAKAIEIQMMAQsgACAAKAIEQX9qIgM2AgQLIAMgACgCCGusIAApA3ggEHx8IRALIAAgAawiERDZBQJAIAAoAgQiCCAAKAJoIgNJBEAgACAIQQFqNgIEDAELIAAQ2gVBAEgNAiAAKAJoIQMLIAMEQCAAIAAoAgRBf2o2AgQLAkACQCALQah/aiIDQSBLBEAgC0G/f2oiAUEGSw0CQQEgAXRB8QBxRQ0CDAELQRAhBQJAAkACQAJAAkAgA0EBaw4fBgYEBgYGBgYFBgQBBQUFBgAGBgYGBgIDBgYEBgEGBgMLQQAhBQwCC0EKIQUMAQtBCCEFCyAAIAVBAEJ/ENwFIREgACkDeEIAIAAoAgQgACgCCGusfVENBgJAIAdFDQAgC0HwAEcNACAHIBE+AgAMAwsgByAOIBEQ8QUMAgsCQCALQRByQfMARgRAIAZBIGpBf0GBAhDfCRogBkEAOgAgIAtB8wBHDQEgBkEAOgBBIAZBADoALiAGQQA2ASoMAQsgBkEgaiAELQABIgNB3gBGIghBgQIQ3wkaIAZBADoAICAEQQJqIARBAWogCBshDQJ/AkACQCAEQQJBASAIG2otAAAiBEEtRwRAIARB3QBGDQEgA0HeAEchBSANDAMLIAYgA0HeAEciBToATgwBCyAGIANB3gBHIgU6AH4LIA1BAWoLIQQDQAJAIAQtAAAiA0EtRwRAIANFDQcgA0HdAEcNAQwDC0EtIQMgBC0AASIIRQ0AIAhB3QBGDQAgBEEBaiENAkAgBEF/ai0AACIEIAhPBEAgCCEDDAELA0AgBEEBaiIEIAZBIGpqIAU6AAAgBCANLQAAIgNJDQALCyANIQQLIAMgBmogBToAISAEQQFqIQQMAAALAAsgAUEBakEfIAtB4wBGIggbIQUCQAJAAkAgDkEBRyINRQRAIAchAyAMBEAgBUECdBDSCSIDRQ0ECyAGQgA3A6gCQQAhAQNAIAMhCgJAA0ACfyAAKAIEIgMgACgCaEkEQCAAIANBAWo2AgQgAy0AAAwBCyAAENoFCyIDIAZqLQAhRQ0BIAYgAzoAGyAGQRxqIAZBG2pBASAGQagCahDdBSIDQX5GDQAgA0F/Rg0FIAoEQCAKIAFBAnRqIAYoAhw2AgAgAUEBaiEBCyAMRQ0AIAEgBUcNAAsgCiAFQQF0QQFyIgVBAnQQ1AkiAw0BDAQLCwJ/QQEgBkGoAmoiA0UNABogAygCAEULRQ0CQQAhCQwBCyAMBEBBACEBIAUQ0gkiA0UNAwNAIAMhCQNAAn8gACgCBCIDIAAoAmhJBEAgACADQQFqNgIEIAMtAAAMAQsgABDaBQsiAyAGai0AIUUEQEEAIQoMBAsgASAJaiADOgAAIAFBAWoiASAFRw0AC0EAIQogCSAFQQF0QQFyIgUQ1AkiAw0ACwwHC0EAIQEgBwRAA0ACfyAAKAIEIgMgACgCaEkEQCAAIANBAWo2AgQgAy0AAAwBCyAAENoFCyIDIAZqLQAhBEAgASAHaiADOgAAIAFBAWohAQwBBUEAIQogByEJDAMLAAALAAsDQAJ/IAAoAgQiASAAKAJoSQRAIAAgAUEBajYCBCABLQAADAELIAAQ2gULIAZqLQAhDQALQQAhCUEAIQpBACEBCwJAIAAoAmhFBEAgACgCBCEDDAELIAAgACgCBEF/aiIDNgIECyAAKQN4IAMgACgCCGusfCISUA0HIBEgElJBACAIGw0HAkAgDEUNACANRQRAIAcgCjYCAAwBCyAHIAk2AgALIAgNAyAKBEAgCiABQQJ0akEANgIACyAJRQRAQQAhCQwECyABIAlqQQA6AAAMAwtBACEJDAQLQQAhCUEAIQoMAwsgBiAAIA5BABDqBSAAKQN4QgAgACgCBCAAKAIIa6x9UQ0EIAdFDQAgDkECSw0AIAYpAwghESAGKQMAIRICQAJAAkAgDkEBaw4CAQIACyAHIBIgERDuBTgCAAwCCyAHIBIgERDbBDkDAAwBCyAHIBI3AwAgByARNwMICyAAKAIEIAAoAghrrCAAKQN4IBB8fCEQIA8gB0EAR2ohDwsgBEEBaiEBIAQtAAEiBA0BDAMLCyAPQX8gDxshDwsgDEUNACAJENMJIAoQ0wkLIAZBsAJqJAAgDwswAQF/IwBBEGsiAiAANgIMIAIgACABQQJ0IAFBAEdBAnRraiIAQQRqNgIIIAAoAgALTgACQCAARQ0AIAFBAmoiAUEFSw0AAkACQAJAAkAgAUEBaw4FAQICBAMACyAAIAI8AAAPCyAAIAI9AQAPCyAAIAI+AgAPCyAAIAI3AwALC1MBAn8gASAAKAJUIgEgASACQYACaiIDEKoEIgQgAWsgAyAEGyIDIAIgAyACSRsiAhDeCRogACABIANqIgM2AlQgACADNgIIIAAgASACajYCBCACC0oBAX8jAEGQAWsiAyQAIANBAEGQARDfCSIDQX82AkwgAyAANgIsIANBvQU2AiAgAyAANgJUIAMgASACEO8FIQAgA0GQAWokACAACwsAIAAgASACEPIFC00BAn8gAS0AACECAkAgAC0AACIDRQ0AIAIgA0cNAANAIAEtAAEhAiAALQABIgNFDQEgAUEBaiEBIABBAWohACACIANGDQALCyADIAJrC44BAQN/IwBBEGsiACQAAkAgAEEMaiAAQQhqEBkNAEGIlAMgACgCDEECdEEEahDSCSIBNgIAIAFFDQACQCAAKAIIENIJIgEEQEGIlAMoAgAiAg0BC0GIlANBADYCAAwBCyACIAAoAgxBAnRqQQA2AgBBiJQDKAIAIAEQGkUNAEGIlANBADYCAAsgAEEQaiQAC2YBA38gAkUEQEEADwsCQCAALQAAIgNFDQADQAJAIAMgAS0AACIFRw0AIAJBf2oiAkUNACAFRQ0AIAFBAWohASAALQABIQMgAEEBaiEAIAMNAQwCCwsgAyEECyAEQf8BcSABLQAAawucAQEFfyAAEMcEIQQCQAJAQYiUAygCAEUNACAALQAARQ0AIABBPRDJBA0AQYiUAygCACgCACICRQ0AA0ACQCAAIAIgBBD3BSEDQYiUAygCACECIANFBEAgAiABQQJ0aigCACIDIARqIgUtAABBPUYNAQsgAiABQQFqIgFBAnRqKAIAIgINAQwDCwsgA0UNASAFQQFqIQELIAEPC0EAC0QBAX8jAEEQayICJAAgAiABNgIEIAIgADYCAEHbACACEBwiAEGBYE8Ef0GQ+wJBACAAazYCAEEABSAACxogAkEQaiQAC9UFAQl/IwBBkAJrIgUkAAJAIAEtAAANAEGQoAEQ+AUiAQRAIAEtAAANAQsgAEEMbEGgoAFqEPgFIgEEQCABLQAADQELQeigARD4BSIBBEAgAS0AAA0BC0HtoAEhAQsCQANAAkAgASACai0AACIDRQ0AIANBL0YNAEEPIQQgAkEBaiICQQ9HDQEMAgsLIAIhBAtB7aABIQMCQAJAAkACQAJAIAEtAAAiAkEuRg0AIAEgBGotAAANACABIQMgAkHDAEcNAQsgAy0AAUUNAQsgA0HtoAEQ9QVFDQAgA0H1oAEQ9QUNAQsgAEUEQEHEnwEhAiADLQABQS5GDQILQQAhAgwBC0GUlAMoAgAiAgRAA0AgAyACQQhqEPUFRQ0CIAIoAhgiAg0ACwtBjJQDEBFBlJQDKAIAIgIEQANAIAMgAkEIahD1BUUEQEGMlAMQEgwDCyACKAIYIgINAAsLQQAhAQJAAkACQEGc+wIoAgANAEH7oAEQ+AUiAkUNACACLQAARQ0AIARBAWohCEH+ASAEayEJA0AgAkE6EMgEIgcgAmsgBy0AACIKQQBHayIGIAlJBH8gBUEQaiACIAYQ3gkaIAVBEGogBmoiAkEvOgAAIAJBAWogAyAEEN4JGiAFQRBqIAYgCGpqQQA6AAAgBUEQaiAFQQxqEBsiBgRAQRwQ0gkiAg0EIAYgBSgCDBD5BQwDCyAHLQAABSAKC0EARyAHaiICLQAADQALC0EcENIJIgJFDQEgAkHEnwEpAgA3AgAgAkEIaiIBIAMgBBDeCRogASAEakEAOgAAIAJBlJQDKAIANgIYQZSUAyACNgIAIAIhAQwBCyACIAY2AgAgAiAFKAIMNgIEIAJBCGoiASADIAQQ3gkaIAEgBGpBADoAACACQZSUAygCADYCGEGUlAMgAjYCACACIQELQYyUAxASIAFBxJ8BIAAgAXIbIQILIAVBkAJqJAAgAguIAQEEfyMAQSBrIgEkAAJ/A0AgAUEIaiAAQQJ0aiAAQcXBAUGIoQFBASAAdEH/////B3EbEPoFIgM2AgAgAiADQQBHaiECIABBAWoiAEEGRw0ACwJAIAJBAUsNAEHgnwEgAkEBaw0BGiABKAIIQcSfAUcNAEH4nwEMAQtBAAshACABQSBqJAAgAAtjAQJ/IwBBEGsiAyQAIAMgAjYCDCADIAI2AghBfyEEAkBBAEEAIAEgAhDMBCICQQBIDQAgACACQQFqIgIQ0gkiADYCACAARQ0AIAAgAiABIAMoAgwQzAQhBAsgA0EQaiQAIAQLKgEBfyMAQRBrIgIkACACIAE2AgwgAEGwwQEgARDzBSEAIAJBEGokACAACy0BAX8jAEEQayICJAAgAiABNgIMIABB5ABBv8EBIAEQzAQhACACQRBqJAAgAAsfACAAQQBHIABB4J8BR3EgAEH4nwFHcQRAIAAQ0wkLCyMBAn8gACEBA0AgASICQQRqIQEgAigCAA0ACyACIABrQQJ1C7cDAQV/IwBBEGsiByQAAkACQAJAAkAgAARAIAJBBE8NASACIQMMAgtBACECIAEoAgAiACgCACIDRQ0DA0BBASEFIANBgAFPBEBBfyEGIAdBDGogAxCoBCIFQX9GDQULIAAoAgQhAyAAQQRqIQAgAiAFaiICIQYgAw0ACwwDCyABKAIAIQUgAiEDA0ACfyAFKAIAIgRBf2pB/wBPBEAgBEUEQCAAQQA6AAAgAUEANgIADAULQX8hBiAAIAQQqAQiBEF/Rg0FIAMgBGshAyAAIARqDAELIAAgBDoAACADQX9qIQMgASgCACEFIABBAWoLIQAgASAFQQRqIgU2AgAgA0EDSw0ACwsgAwRAIAEoAgAhBQNAAn8gBSgCACIEQX9qQf8ATwRAIARFBEAgAEEAOgAAIAFBADYCAAwFC0F/IQYgB0EMaiAEEKgEIgRBf0YNBSADIARJDQQgACAFKAIAEKgEGiADIARrIQMgACAEagwBCyAAIAQ6AAAgA0F/aiEDIAEoAgAhBSAAQQFqCyEAIAEgBUEEaiIFNgIAIAMNAAsLIAIhBgwBCyACIANrIQYLIAdBEGokACAGC90CAQZ/IwBBkAJrIgUkACAFIAEoAgAiBzYCDCAAIAVBEGogABshBgJAIANBgAIgABsiA0UNACAHRQ0AAkAgAyACTSIEDQAgAkEgSw0ADAELA0AgAiADIAIgBBsiBGshAiAGIAVBDGogBBCBBiIEQX9GBEBBACEDIAUoAgwhB0F/IQgMAgsgBiAEIAZqIAYgBUEQakYiCRshBiAEIAhqIQggBSgCDCEHIANBACAEIAkbayIDRQ0BIAdFDQEgAiADTyIEDQAgAkEhTw0ACwsCQAJAIAdFDQAgA0UNACACRQ0AA0AgBiAHKAIAEKgEIglBAWpBAU0EQEF/IQQgCQ0DIAVBADYCDAwCCyAFIAUoAgxBBGoiBzYCDCAIIAlqIQggAyAJayIDRQ0BIAYgCWohBiAIIQQgAkF/aiICDQALDAELIAghBAsgAARAIAEgBSgCDDYCAAsgBUGQAmokACAEC70IAQV/IAEoAgAhBAJAAkACQAJAAkACQAJAAn8CQAJAIANFDQAgAygCACIGRQ0AIABFBEAgAiEDDAQLIANBADYCACACIQMMAQsCQAJAQYjwAigCACgCAEUEQCAARQ0BIAJFDQsgAiEGA0AgBCwAACIDBEAgACADQf+/A3E2AgAgAEEEaiEAIARBAWohBCAGQX9qIgYNAQwNCwsgAEEANgIAIAFBADYCACACIAZrDwsgAiEDIABFDQEgAiEFQQAMAwsgBBDHBA8LQQEhBQwCC0EBCyEHA0AgB0UEQCAFRQ0IA0ACQAJAAkAgBC0AACIHQX9qIghB/gBLBEAgByEGIAUhAwwBCyAEQQNxDQEgBUEFSQ0BIAUgBUF7akF8cWtBfGohAwJAAkADQCAEKAIAIgZB//37d2ogBnJBgIGChHhxDQEgACAGQf8BcTYCACAAIAQtAAE2AgQgACAELQACNgIIIAAgBC0AAzYCDCAAQRBqIQAgBEEEaiEEIAVBfGoiBUEESw0ACyAELQAAIQYMAQsgBSEDCyAGQf8BcSIHQX9qIQgLIAhB/gBLDQEgAyEFCyAAIAc2AgAgAEEEaiEAIARBAWohBCAFQX9qIgUNAQwKCwsgB0G+fmoiB0EySw0EIARBAWohBCAHQQJ0QYCdAWooAgAhBkEBIQcMAQsgBC0AACIFQQN2IgdBcGogByAGQRp1anJBB0sNAgJAAkACfyAEQQFqIAVBgH9qIAZBBnRyIgVBf0oNABogBC0AAUGAf2oiB0E/Sw0BIARBAmogByAFQQZ0ciIFQX9KDQAaIAQtAAJBgH9qIgdBP0sNASAHIAVBBnRyIQUgBEEDagshBCAAIAU2AgAgA0F/aiEFIABBBGohAAwBC0GQ+wJBGTYCACAEQX9qIQQMBgtBACEHDAAACwALA0AgBUUEQCAELQAAQQN2IgVBcGogBkEadSAFanJBB0sNAgJ/IARBAWogBkGAgIAQcUUNABogBC0AAUHAAXFBgAFHDQMgBEECaiAGQYCAIHFFDQAaIAQtAAJBwAFxQYABRw0DIARBA2oLIQQgA0F/aiEDQQEhBQwBCwNAAkAgBC0AACIGQX9qQf4ASw0AIARBA3ENACAEKAIAIgZB//37d2ogBnJBgIGChHhxDQADQCADQXxqIQMgBCgCBCEGIARBBGoiBSEEIAYgBkH//ft3anJBgIGChHhxRQ0ACyAFIQQLIAZB/wFxIgVBf2pB/gBNBEAgA0F/aiEDIARBAWohBAwBCwsgBUG+fmoiBUEySw0CIARBAWohBCAFQQJ0QYCdAWooAgAhBkEAIQUMAAALAAsgBEF/aiEEIAYNASAELQAAIQYLIAZB/wFxDQAgAARAIABBADYCACABQQA2AgALIAIgA2sPC0GQ+wJBGTYCACAARQ0BCyABIAQ2AgALQX8PCyABIAQ2AgAgAguMAwEGfyMAQZAIayIGJAAgBiABKAIAIgk2AgwgACAGQRBqIAAbIQcCQCADQYACIAAbIgNFDQAgCUUNACACQQJ2IgUgA08hCiACQYMBTUEAIAUgA0kbDQADQCACIAMgBSAKGyIFayECIAcgBkEMaiAFIAQQgwYiBUF/RgRAQQAhAyAGKAIMIQlBfyEIDAILIAcgByAFQQJ0aiAHIAZBEGpGIgobIQcgBSAIaiEIIAYoAgwhCSADQQAgBSAKG2siA0UNASAJRQ0BIAJBAnYiBSADTyEKIAJBgwFLDQAgBSADTw0ACwsCQAJAIAlFDQAgA0UNACACRQ0AA0AgByAJIAIgBBDdBSIFQQJqQQJNBEAgBUEBaiICQQFNBEAgAkEBaw0EIAZBADYCDAwDCyAEQQA2AgAMAgsgBiAGKAIMIAVqIgk2AgwgCEEBaiEIIANBf2oiA0UNASAHQQRqIQcgAiAFayECIAghBSACDQALDAELIAghBQsgAARAIAEgBigCDDYCAAsgBkGQCGokACAFC3wBAX8jAEGQAWsiBCQAIAQgADYCLCAEIAA2AgQgBEEANgIAIARBfzYCTCAEQX8gAEH/////B2ogAEEASBs2AgggBEIAENkFIAQgAkEBIAMQ3AUhAyABBEAgASAAIAQoAgQgBCgCeGogBCgCCGtqNgIACyAEQZABaiQAIAMLDQAgACABIAJCfxCFBgsWACAAIAEgAkKAgICAgICAgIB/EIUGCzICAX8BfSMAQRBrIgIkACACIAAgAUEAEIkGIAIpAwAgAikDCBDuBSEDIAJBEGokACADC58BAgF/A34jAEGgAWsiBCQAIARBEGpBAEGQARDfCRogBEF/NgJcIAQgATYCPCAEQX82AhggBCABNgIUIARBEGpCABDZBSAEIARBEGogA0EBEOoFIAQpAwghBSAEKQMAIQYgAgRAIAIgASABIAQpA4gBIAQoAhQgBCgCGGusfCIHp2ogB1AbNgIACyAAIAY3AwAgACAFNwMIIARBoAFqJAALMgIBfwF8IwBBEGsiAiQAIAIgACABQQEQiQYgAikDACACKQMIENsEIQMgAkEQaiQAIAMLOQIBfwF+IwBBEGsiAyQAIAMgASACQQIQiQYgAykDACEEIAAgAykDCDcDCCAAIAQ3AwAgA0EQaiQACzUBAX4jAEEQayIDJAAgAyABIAIQiwYgAykDACEEIAAgAykDCDcDCCAAIAQ3AwAgA0EQaiQAC1QBAn8CQANAIAMgBEcEQEF/IQAgASACRg0CIAEsAAAiBSADLAAAIgZIDQIgBiAFSARAQQEPBSADQQFqIQMgAUEBaiEBDAILAAsLIAEgAkchAAsgAAsZACAAQgA3AgAgAEEANgIIIAAgAiADEI8GC7oBAQR/IwBBEGsiBSQAIAIgAWsiBEFvTQRAAkAgBEEKTQRAIAAgBDoACyAAIQMMAQsgACAEQQtPBH8gBEEQakFwcSIDIANBf2oiAyADQQtGGwVBCgtBAWoiBhDsCCIDNgIAIAAgBkGAgICAeHI2AgggACAENgIECwNAIAEgAkcEQCADIAEtAAA6AAAgA0EBaiEDIAFBAWohAQwBCwsgBUEAOgAPIAMgBS0ADzoAACAFQRBqJAAPCxCECQALQAEBf0EAIQADfyABIAJGBH8gAAUgASwAACAAQQR0aiIAQYCAgIB/cSIDQRh2IANyIABzIQAgAUEBaiEBDAELCwtUAQJ/AkADQCADIARHBEBBfyEAIAEgAkYNAiABKAIAIgUgAygCACIGSA0CIAYgBUgEQEEBDwUgA0EEaiEDIAFBBGohAQwCCwALCyABIAJHIQALIAALGQAgAEIANwIAIABBADYCCCAAIAIgAxCTBgvBAQEEfyMAQRBrIgUkACACIAFrQQJ1IgRB7////wNNBEACQCAEQQFNBEAgACAEOgALIAAhAwwBCyAAIARBAk8EfyAEQQRqQXxxIgMgA0F/aiIDIANBAkYbBUEBC0EBaiIGEPgIIgM2AgAgACAGQYCAgIB4cjYCCCAAIAQ2AgQLA0AgASACRwRAIAMgASgCADYCACADQQRqIQMgAUEEaiEBDAELCyAFQQA2AgwgAyAFKAIMNgIAIAVBEGokAA8LEIQJAAtAAQF/QQAhAAN/IAEgAkYEfyAABSABKAIAIABBBHRqIgBBgICAgH9xIgNBGHYgA3IgAHMhACABQQRqIQEMAQsLC/sCAQJ/IwBBIGsiBiQAIAYgATYCGAJAIAMoAgRBAXFFBEAgBkF/NgIAIAYgACABIAIgAyAEIAYgACgCACgCEBEJACIBNgIYIAYoAgAiAEEBTQRAIABBAWsEQCAFQQA6AAAMAwsgBUEBOgAADAILIAVBAToAACAEQQQ2AgAMAQsgBiADKAIcIgA2AgAgACAAKAIEQQFqNgIEIAYQkAUhBwJ/IAYoAgAiACAAKAIEQX9qIgE2AgQgAUF/RgsEQCAAIAAoAgAoAggRAQALIAYgAygCHCIANgIAIAAgACgCBEEBajYCBCAGEJYGIQACfyAGKAIAIgEgASgCBEF/aiIDNgIEIANBf0YLBEAgASABKAIAKAIIEQEACyAGIAAgACgCACgCGBECACAGQQxyIAAgACgCACgCHBECACAFIAZBGGogAiAGIAZBGGoiAyAHIARBARCXBiAGRjoAACAGKAIYIQEDQCADQXRqEIcJIgMgBkcNAAsLIAZBIGokACABCwsAIABBkJYDEJgGC9YFAQt/IwBBgAFrIggkACAIIAE2AnggAyACa0EMbSEJIAhBvgU2AhAgCEEIakEAIAhBEGoQmQYhDCAIQRBqIQoCQCAJQeUATwRAIAkQ0gkiCkUNASAMKAIAIQEgDCAKNgIAIAEEQCABIAwoAgQRAQALCyAKIQcgAiEBA0AgASADRgRAA0ACQCAJQQAgACAIQfgAahCRBRtFBEAgACAIQfgAahCUBQRAIAUgBSgCAEECcjYCAAsMAQsgABCSBSENIAZFBEAgBCANIAQoAgAoAgwRAwAhDQsgDkEBaiEPQQAhECAKIQcgAiEBA0AgASADRgRAIA8hDiAQRQ0DIAAQkwUaIAohByACIQEgCSALakECSQ0DA0AgASADRg0EAkAgBy0AAEECRw0AAn8gASwAC0EASARAIAEoAgQMAQsgAS0ACwsgDkYNACAHQQA6AAAgC0F/aiELCyAHQQFqIQcgAUEMaiEBDAAACwAFAkAgBy0AAEEBRw0AAn8gASwAC0EASARAIAEoAgAMAQsgAQsgDmosAAAhEQJAIA1B/wFxIAYEfyARBSAEIBEgBCgCACgCDBEDAAtB/wFxRgRAQQEhEAJ/IAEsAAtBAEgEQCABKAIEDAELIAEtAAsLIA9HDQIgB0ECOgAAIAtBAWohCwwBCyAHQQA6AAALIAlBf2ohCQsgB0EBaiEHIAFBDGohAQwBCwAACwALCwJAAkADQCACIANGDQEgCi0AAEECRwRAIApBAWohCiACQQxqIQIMAQsLIAIhAwwBCyAFIAUoAgBBBHI2AgALIAwiACgCACEBIABBADYCACABBEAgASAAKAIEEQEACyAIQYABaiQAIAMPBQJAAn8gASwAC0EASARAIAEoAgQMAQsgAS0ACwsEQCAHQQE6AAAMAQsgB0ECOgAAIAtBAWohCyAJQX9qIQkLIAdBAWohByABQQxqIQEMAQsAAAsACxC1BwALHgAgACgCACEAIAEQ8gchASAAKAIQIAFBAnRqKAIACzQBAX8jAEEQayIDJAAgAyABNgIMIAAgA0EMaigCADYCACAAIAIoAgA2AgQgA0EQaiQAIAALDwAgASACIAMgBCAFEJsGC8sEAQJ/IwBBkAJrIgUkACAFIAE2AoACIAUgADYCiAIgAhCcBiEGIAVB0AFqIAIgBUH/AWoQnQYgBUHAAWoQngYiACAALAALQQBIBH8gACgCCEH/////B3FBf2oFQQoLEJ8GIAUCfyAALAALQQBIBEAgACgCAAwBCyAACyIBNgK8ASAFIAVBEGo2AgwgBUEANgIIA0ACQCAFQYgCaiAFQYACahCRBUUNACAFKAK8AQJ/IAAsAAtBAEgEQCAAKAIEDAELIAAtAAsLIAFqRgRAAn8gACIBLAALQQBIBEAgASgCBAwBCyABLQALCyECIAECfyABLAALQQBIBEAgASgCBAwBCyABLQALC0EBdBCfBiABIAEsAAtBAEgEfyABKAIIQf////8HcUF/agVBCgsQnwYgBSACAn8gASwAC0EASARAIAAoAgAMAQsgAAsiAWo2ArwBCyAFQYgCahCSBSAGIAEgBUG8AWogBUEIaiAFLAD/ASAFQdABaiAFQRBqIAVBDGpBsL8BEKAGDQAgBUGIAmoQkwUaDAELCwJAAn8gBSwA2wFBAEgEQCAFKALUAQwBCyAFLQDbAQtFDQAgBSgCDCICIAVBEGprQZ8BSg0AIAUgAkEEajYCDCACIAUoAgg2AgALIAQgASAFKAK8ASADIAYQoQY2AgAgBUHQAWogBUEQaiAFKAIMIAMQogYgBUGIAmogBUGAAmoQlAUEQCADIAMoAgBBAnI2AgALIAUoAogCIQEgABCHCRogBUHQAWoQhwkaIAVBkAJqJAAgAQsuAAJAIAAoAgRBygBxIgAEQCAAQcAARgRAQQgPCyAAQQhHDQFBEA8LQQAPC0EKC4QBAQF/IwBBEGsiAyQAIAMgASgCHCIBNgIIIAEgASgCBEEBajYCBCACIANBCGoQlgYiASICIAIoAgAoAhARAAA6AAAgACABIAEoAgAoAhQRAgACfyADKAIIIgAgACgCBEF/aiIBNgIEIAFBf0YLBEAgACAAKAIAKAIIEQEACyADQRBqJAALFwAgAEIANwIAIABBADYCCCAAEL0GIAALCQAgACABEIoJC4gDAQN/IwBBEGsiCiQAIAogADoADwJAAkACQAJAIAMoAgAgAkcNACAAQf8BcSILIAktABhGIgxFBEAgCS0AGSALRw0BCyADIAJBAWo2AgAgAkErQS0gDBs6AAAMAQsCfyAGLAALQQBIBEAgBigCBAwBCyAGLQALC0UNASAAIAVHDQFBACEAIAgoAgAiASAHa0GfAUoNAiAEKAIAIQAgCCABQQRqNgIAIAEgADYCAAtBACEAIARBADYCAAwBC0F/IQAgCSAJQRpqIApBD2oQvgYgCWsiBUEXSg0AAkAgAUF4aiIGQQJLBEAgAUEQRw0BIAVBFkgNASADKAIAIgEgAkYNAiABIAJrQQJKDQIgAUF/ai0AAEEwRw0CQQAhACAEQQA2AgAgAyABQQFqNgIAIAEgBUGwvwFqLQAAOgAADAILIAZBAWtFDQAgBSABTg0BCyADIAMoAgAiAEEBajYCACAAIAVBsL8Bai0AADoAACAEIAQoAgBBAWo2AgBBACEACyAKQRBqJAAgAAvFAQICfwF+IwBBEGsiBCQAAn8CQAJAIAAgAUcEQEGQ+wIoAgAhBUGQ+wJBADYCACAAIARBDGogAxC7BhCHBiEGAkBBkPsCKAIAIgAEQCAEKAIMIAFHDQEgAEHEAEYNBAwDC0GQ+wIgBTYCACAEKAIMIAFGDQILCyACQQQ2AgBBAAwCCyAGQoCAgIB4Uw0AIAZC/////wdVDQAgBqcMAQsgAkEENgIAQf////8HIAZCAVkNABpBgICAgHgLIQAgBEEQaiQAIAAL5AEBAn8CQAJ/IAAsAAtBAEgEQCAAKAIEDAELIAAtAAsLRQ0AIAEgAhD0BiACQXxqIQQCfyAALAALQQBIBEAgACgCBAwBCyAALQALCwJ/IAAsAAtBAEgEQCAAKAIADAELIAALIgJqIQUDQAJAIAIsAAAhACABIARPDQACQCAAQQFIDQAgAEH/AE4NACABKAIAIAIsAABGDQAgA0EENgIADwsgAkEBaiACIAUgAmtBAUobIQIgAUEEaiEBDAELCyAAQQFIDQAgAEH/AE4NACAEKAIAQX9qIAIsAABJDQAgA0EENgIACwsPACABIAIgAyAEIAUQpAYLywQBAn8jAEGQAmsiBSQAIAUgATYCgAIgBSAANgKIAiACEJwGIQYgBUHQAWogAiAFQf8BahCdBiAFQcABahCeBiIAIAAsAAtBAEgEfyAAKAIIQf////8HcUF/agVBCgsQnwYgBQJ/IAAsAAtBAEgEQCAAKAIADAELIAALIgE2ArwBIAUgBUEQajYCDCAFQQA2AggDQAJAIAVBiAJqIAVBgAJqEJEFRQ0AIAUoArwBAn8gACwAC0EASARAIAAoAgQMAQsgAC0ACwsgAWpGBEACfyAAIgEsAAtBAEgEQCABKAIEDAELIAEtAAsLIQIgAQJ/IAEsAAtBAEgEQCABKAIEDAELIAEtAAsLQQF0EJ8GIAEgASwAC0EASAR/IAEoAghB/////wdxQX9qBUEKCxCfBiAFIAICfyABLAALQQBIBEAgACgCAAwBCyAACyIBajYCvAELIAVBiAJqEJIFIAYgASAFQbwBaiAFQQhqIAUsAP8BIAVB0AFqIAVBEGogBUEMakGwvwEQoAYNACAFQYgCahCTBRoMAQsLAkACfyAFLADbAUEASARAIAUoAtQBDAELIAUtANsBC0UNACAFKAIMIgIgBUEQamtBnwFKDQAgBSACQQRqNgIMIAIgBSgCCDYCAAsgBCABIAUoArwBIAMgBhClBjcDACAFQdABaiAFQRBqIAUoAgwgAxCiBiAFQYgCaiAFQYACahCUBQRAIAMgAygCAEECcjYCAAsgBSgCiAIhASAAEIcJGiAFQdABahCHCRogBUGQAmokACABC9oBAgJ/AX4jAEEQayIEJAACQAJAAkAgACABRwRAQZD7AigCACEFQZD7AkEANgIAIAAgBEEMaiADELsGEIcGIQYCQEGQ+wIoAgAiAARAIAQoAgwgAUcNASAAQcQARg0EDAMLQZD7AiAFNgIAIAQoAgwgAUYNAgsLIAJBBDYCAEIAIQYMAgsgBkKAgICAgICAgIB/Uw0AQv///////////wAgBlkNAQsgAkEENgIAIAZCAVkEQEL///////////8AIQYMAQtCgICAgICAgICAfyEGCyAEQRBqJAAgBgsPACABIAIgAyAEIAUQpwYLywQBAn8jAEGQAmsiBSQAIAUgATYCgAIgBSAANgKIAiACEJwGIQYgBUHQAWogAiAFQf8BahCdBiAFQcABahCeBiIAIAAsAAtBAEgEfyAAKAIIQf////8HcUF/agVBCgsQnwYgBQJ/IAAsAAtBAEgEQCAAKAIADAELIAALIgE2ArwBIAUgBUEQajYCDCAFQQA2AggDQAJAIAVBiAJqIAVBgAJqEJEFRQ0AIAUoArwBAn8gACwAC0EASARAIAAoAgQMAQsgAC0ACwsgAWpGBEACfyAAIgEsAAtBAEgEQCABKAIEDAELIAEtAAsLIQIgAQJ/IAEsAAtBAEgEQCABKAIEDAELIAEtAAsLQQF0EJ8GIAEgASwAC0EASAR/IAEoAghB/////wdxQX9qBUEKCxCfBiAFIAICfyABLAALQQBIBEAgACgCAAwBCyAACyIBajYCvAELIAVBiAJqEJIFIAYgASAFQbwBaiAFQQhqIAUsAP8BIAVB0AFqIAVBEGogBUEMakGwvwEQoAYNACAFQYgCahCTBRoMAQsLAkACfyAFLADbAUEASARAIAUoAtQBDAELIAUtANsBC0UNACAFKAIMIgIgBUEQamtBnwFKDQAgBSACQQRqNgIMIAIgBSgCCDYCAAsgBCABIAUoArwBIAMgBhCoBjsBACAFQdABaiAFQRBqIAUoAgwgAxCiBiAFQYgCaiAFQYACahCUBQRAIAMgAygCAEECcjYCAAsgBSgCiAIhASAAEIcJGiAFQdABahCHCRogBUGQAmokACABC90BAgN/AX4jAEEQayIEJAACfwJAAkACQCAAIAFHBEACQAJAIAAtAAAiBUEtRw0AIABBAWoiACABRw0ADAELQZD7AigCACEGQZD7AkEANgIAIAAgBEEMaiADELsGEIYGIQcCQEGQ+wIoAgAiAARAIAQoAgwgAUcNASAAQcQARg0FDAQLQZD7AiAGNgIAIAQoAgwgAUYNAwsLCyACQQQ2AgBBAAwDCyAHQv//A1gNAQsgAkEENgIAQf//AwwBC0EAIAenIgBrIAAgBUEtRhsLIQAgBEEQaiQAIABB//8DcQsPACABIAIgAyAEIAUQqgYLywQBAn8jAEGQAmsiBSQAIAUgATYCgAIgBSAANgKIAiACEJwGIQYgBUHQAWogAiAFQf8BahCdBiAFQcABahCeBiIAIAAsAAtBAEgEfyAAKAIIQf////8HcUF/agVBCgsQnwYgBQJ/IAAsAAtBAEgEQCAAKAIADAELIAALIgE2ArwBIAUgBUEQajYCDCAFQQA2AggDQAJAIAVBiAJqIAVBgAJqEJEFRQ0AIAUoArwBAn8gACwAC0EASARAIAAoAgQMAQsgAC0ACwsgAWpGBEACfyAAIgEsAAtBAEgEQCABKAIEDAELIAEtAAsLIQIgAQJ/IAEsAAtBAEgEQCABKAIEDAELIAEtAAsLQQF0EJ8GIAEgASwAC0EASAR/IAEoAghB/////wdxQX9qBUEKCxCfBiAFIAICfyABLAALQQBIBEAgACgCAAwBCyAACyIBajYCvAELIAVBiAJqEJIFIAYgASAFQbwBaiAFQQhqIAUsAP8BIAVB0AFqIAVBEGogBUEMakGwvwEQoAYNACAFQYgCahCTBRoMAQsLAkACfyAFLADbAUEASARAIAUoAtQBDAELIAUtANsBC0UNACAFKAIMIgIgBUEQamtBnwFKDQAgBSACQQRqNgIMIAIgBSgCCDYCAAsgBCABIAUoArwBIAMgBhCrBjYCACAFQdABaiAFQRBqIAUoAgwgAxCiBiAFQYgCaiAFQYACahCUBQRAIAMgAygCAEECcjYCAAsgBSgCiAIhASAAEIcJGiAFQdABahCHCRogBUGQAmokACABC9gBAgN/AX4jAEEQayIEJAACfwJAAkACQCAAIAFHBEACQAJAIAAtAAAiBUEtRw0AIABBAWoiACABRw0ADAELQZD7AigCACEGQZD7AkEANgIAIAAgBEEMaiADELsGEIYGIQcCQEGQ+wIoAgAiAARAIAQoAgwgAUcNASAAQcQARg0FDAQLQZD7AiAGNgIAIAQoAgwgAUYNAwsLCyACQQQ2AgBBAAwDCyAHQv////8PWA0BCyACQQQ2AgBBfwwBC0EAIAenIgBrIAAgBUEtRhsLIQAgBEEQaiQAIAALDwAgASACIAMgBCAFEK0GC8sEAQJ/IwBBkAJrIgUkACAFIAE2AoACIAUgADYCiAIgAhCcBiEGIAVB0AFqIAIgBUH/AWoQnQYgBUHAAWoQngYiACAALAALQQBIBH8gACgCCEH/////B3FBf2oFQQoLEJ8GIAUCfyAALAALQQBIBEAgACgCAAwBCyAACyIBNgK8ASAFIAVBEGo2AgwgBUEANgIIA0ACQCAFQYgCaiAFQYACahCRBUUNACAFKAK8AQJ/IAAsAAtBAEgEQCAAKAIEDAELIAAtAAsLIAFqRgRAAn8gACIBLAALQQBIBEAgASgCBAwBCyABLQALCyECIAECfyABLAALQQBIBEAgASgCBAwBCyABLQALC0EBdBCfBiABIAEsAAtBAEgEfyABKAIIQf////8HcUF/agVBCgsQnwYgBSACAn8gASwAC0EASARAIAAoAgAMAQsgAAsiAWo2ArwBCyAFQYgCahCSBSAGIAEgBUG8AWogBUEIaiAFLAD/ASAFQdABaiAFQRBqIAVBDGpBsL8BEKAGDQAgBUGIAmoQkwUaDAELCwJAAn8gBSwA2wFBAEgEQCAFKALUAQwBCyAFLQDbAQtFDQAgBSgCDCICIAVBEGprQZ8BSg0AIAUgAkEEajYCDCACIAUoAgg2AgALIAQgASAFKAK8ASADIAYQrgY3AwAgBUHQAWogBUEQaiAFKAIMIAMQogYgBUGIAmogBUGAAmoQlAUEQCADIAMoAgBBAnI2AgALIAUoAogCIQEgABCHCRogBUHQAWoQhwkaIAVBkAJqJAAgAQvRAQIDfwF+IwBBEGsiBCQAAn4CQAJAAkAgACABRwRAAkACQCAALQAAIgVBLUcNACAAQQFqIgAgAUcNAAwBC0GQ+wIoAgAhBkGQ+wJBADYCACAAIARBDGogAxC7BhCGBiEHAkBBkPsCKAIAIgAEQCAEKAIMIAFHDQEgAEHEAEYNBQwEC0GQ+wIgBjYCACAEKAIMIAFGDQMLCwsgAkEENgIAQgAMAwtCfyAHWg0BCyACQQQ2AgBCfwwBC0IAIAd9IAcgBUEtRhsLIQcgBEEQaiQAIAcLDwAgASACIAMgBCAFELAGC/UEAQF/IwBBkAJrIgUkACAFIAE2AoACIAUgADYCiAIgBUHQAWogAiAFQeABaiAFQd8BaiAFQd4BahCxBiAFQcABahCeBiIBIAEsAAtBAEgEfyABKAIIQf////8HcUF/agVBCgsQnwYgBQJ/IAEsAAtBAEgEQCABKAIADAELIAELIgA2ArwBIAUgBUEQajYCDCAFQQA2AgggBUEBOgAHIAVBxQA6AAYDQAJAIAVBiAJqIAVBgAJqEJEFRQ0AIAUoArwBAn8gASwAC0EASARAIAEoAgQMAQsgAS0ACwsgAGpGBEACfyABIgAsAAtBAEgEQCAAKAIEDAELIAAtAAsLIQIgAAJ/IAAsAAtBAEgEQCAAKAIEDAELIAAtAAsLQQF0EJ8GIAAgACwAC0EASAR/IAAoAghB/////wdxQX9qBUEKCxCfBiAFIAICfyAALAALQQBIBEAgASgCAAwBCyABCyIAajYCvAELIAVBiAJqEJIFIAVBB2ogBUEGaiAAIAVBvAFqIAUsAN8BIAUsAN4BIAVB0AFqIAVBEGogBUEMaiAFQQhqIAVB4AFqELIGDQAgBUGIAmoQkwUaDAELCwJAAn8gBSwA2wFBAEgEQCAFKALUAQwBCyAFLQDbAQtFDQAgBS0AB0UNACAFKAIMIgIgBUEQamtBnwFKDQAgBSACQQRqNgIMIAIgBSgCCDYCAAsgBCAAIAUoArwBIAMQswY4AgAgBUHQAWogBUEQaiAFKAIMIAMQogYgBUGIAmogBUGAAmoQlAUEQCADIAMoAgBBAnI2AgALIAUoAogCIQAgARCHCRogBUHQAWoQhwkaIAVBkAJqJAAgAAu2AQEBfyMAQRBrIgUkACAFIAEoAhwiATYCCCABIAEoAgRBAWo2AgQgBUEIahCQBSIBQbC/AUHQvwEgAiABKAIAKAIgEQgAGiADIAVBCGoQlgYiASICIAIoAgAoAgwRAAA6AAAgBCABIAEoAgAoAhARAAA6AAAgACABIAEoAgAoAhQRAgACfyAFKAIIIgAgACgCBEF/aiIBNgIEIAFBf0YLBEAgACAAKAIAKAIIEQEACyAFQRBqJAALuQQBAX8jAEEQayIMJAAgDCAAOgAPAkACQCAAIAVGBEAgAS0AAEUNAUEAIQAgAUEAOgAAIAQgBCgCACIBQQFqNgIAIAFBLjoAAAJ/IAcsAAtBAEgEQCAHKAIEDAELIActAAsLRQ0CIAkoAgAiASAIa0GfAUoNAiAKKAIAIQIgCSABQQRqNgIAIAEgAjYCAAwCCwJAIAAgBkcNAAJ/IAcsAAtBAEgEQCAHKAIEDAELIActAAsLRQ0AIAEtAABFDQFBACEAIAkoAgAiASAIa0GfAUoNAiAKKAIAIQAgCSABQQRqNgIAIAEgADYCAEEAIQAgCkEANgIADAILQX8hACALIAtBIGogDEEPahC+BiALayIFQR9KDQEgBUGwvwFqLQAAIQYCQCAFQWpqIgBBA00EQAJAAkAgAEECaw4CAAABCyADIAQoAgAiAUcEQEF/IQAgAUF/ai0AAEHfAHEgAi0AAEH/AHFHDQULIAQgAUEBajYCACABIAY6AABBACEADAQLIAJB0AA6AAAMAQsgAiwAACIAIAZB3wBxRw0AIAIgAEGAAXI6AAAgAS0AAEUNACABQQA6AAACfyAHLAALQQBIBEAgBygCBAwBCyAHLQALC0UNACAJKAIAIgAgCGtBnwFKDQAgCigCACEBIAkgAEEEajYCACAAIAE2AgALIAQgBCgCACIAQQFqNgIAIAAgBjoAAEEAIQAgBUEVSg0BIAogCigCAEEBajYCAAwBC0F/IQALIAxBEGokACAAC5QBAgN/AX0jAEEQayIDJAACQCAAIAFHBEBBkPsCKAIAIQRBkPsCQQA2AgAgA0EMaiEFELsGGiAAIAUQiAYhBgJAQZD7AigCACIABEAgAygCDCABRw0BIABBxABHDQMgAkEENgIADAMLQZD7AiAENgIAIAMoAgwgAUYNAgsLIAJBBDYCAEMAAAAAIQYLIANBEGokACAGCw8AIAEgAiADIAQgBRC1Bgv1BAEBfyMAQZACayIFJAAgBSABNgKAAiAFIAA2AogCIAVB0AFqIAIgBUHgAWogBUHfAWogBUHeAWoQsQYgBUHAAWoQngYiASABLAALQQBIBH8gASgCCEH/////B3FBf2oFQQoLEJ8GIAUCfyABLAALQQBIBEAgASgCAAwBCyABCyIANgK8ASAFIAVBEGo2AgwgBUEANgIIIAVBAToAByAFQcUAOgAGA0ACQCAFQYgCaiAFQYACahCRBUUNACAFKAK8AQJ/IAEsAAtBAEgEQCABKAIEDAELIAEtAAsLIABqRgRAAn8gASIALAALQQBIBEAgACgCBAwBCyAALQALCyECIAACfyAALAALQQBIBEAgACgCBAwBCyAALQALC0EBdBCfBiAAIAAsAAtBAEgEfyAAKAIIQf////8HcUF/agVBCgsQnwYgBSACAn8gACwAC0EASARAIAEoAgAMAQsgAQsiAGo2ArwBCyAFQYgCahCSBSAFQQdqIAVBBmogACAFQbwBaiAFLADfASAFLADeASAFQdABaiAFQRBqIAVBDGogBUEIaiAFQeABahCyBg0AIAVBiAJqEJMFGgwBCwsCQAJ/IAUsANsBQQBIBEAgBSgC1AEMAQsgBS0A2wELRQ0AIAUtAAdFDQAgBSgCDCICIAVBEGprQZ8BSg0AIAUgAkEEajYCDCACIAUoAgg2AgALIAQgACAFKAK8ASADELYGOQMAIAVB0AFqIAVBEGogBSgCDCADEKIGIAVBiAJqIAVBgAJqEJQFBEAgAyADKAIAQQJyNgIACyAFKAKIAiEAIAEQhwkaIAVB0AFqEIcJGiAFQZACaiQAIAALmAECA38BfCMAQRBrIgMkAAJAIAAgAUcEQEGQ+wIoAgAhBEGQ+wJBADYCACADQQxqIQUQuwYaIAAgBRCKBiEGAkBBkPsCKAIAIgAEQCADKAIMIAFHDQEgAEHEAEcNAyACQQQ2AgAMAwtBkPsCIAQ2AgAgAygCDCABRg0CCwsgAkEENgIARAAAAAAAAAAAIQYLIANBEGokACAGCw8AIAEgAiADIAQgBRC4BguMBQIBfwF+IwBBoAJrIgUkACAFIAE2ApACIAUgADYCmAIgBUHgAWogAiAFQfABaiAFQe8BaiAFQe4BahCxBiAFQdABahCeBiIBIAEsAAtBAEgEfyABKAIIQf////8HcUF/agVBCgsQnwYgBQJ/IAEsAAtBAEgEQCABKAIADAELIAELIgA2AswBIAUgBUEgajYCHCAFQQA2AhggBUEBOgAXIAVBxQA6ABYDQAJAIAVBmAJqIAVBkAJqEJEFRQ0AIAUoAswBAn8gASwAC0EASARAIAEoAgQMAQsgAS0ACwsgAGpGBEACfyABIgAsAAtBAEgEQCAAKAIEDAELIAAtAAsLIQIgAAJ/IAAsAAtBAEgEQCAAKAIEDAELIAAtAAsLQQF0EJ8GIAAgACwAC0EASAR/IAAoAghB/////wdxQX9qBUEKCxCfBiAFIAICfyAALAALQQBIBEAgASgCAAwBCyABCyIAajYCzAELIAVBmAJqEJIFIAVBF2ogBUEWaiAAIAVBzAFqIAUsAO8BIAUsAO4BIAVB4AFqIAVBIGogBUEcaiAFQRhqIAVB8AFqELIGDQAgBUGYAmoQkwUaDAELCwJAAn8gBSwA6wFBAEgEQCAFKALkAQwBCyAFLQDrAQtFDQAgBS0AF0UNACAFKAIcIgIgBUEgamtBnwFKDQAgBSACQQRqNgIcIAIgBSgCGDYCAAsgBSAAIAUoAswBIAMQuQYgBSkDACEGIAQgBSkDCDcDCCAEIAY3AwAgBUHgAWogBUEgaiAFKAIcIAMQogYgBUGYAmogBUGQAmoQlAUEQCADIAMoAgBBAnI2AgALIAUoApgCIQAgARCHCRogBUHgAWoQhwkaIAVBoAJqJAAgAAunAQICfwJ+IwBBIGsiBCQAAkAgASACRwRAQZD7AigCACEFQZD7AkEANgIAIAQgASAEQRxqEPsIIAQpAwghBiAEKQMAIQcCQEGQ+wIoAgAiAQRAIAQoAhwgAkcNASABQcQARw0DIANBBDYCAAwDC0GQ+wIgBTYCACAEKAIcIAJGDQILCyADQQQ2AgBCACEHQgAhBgsgACAHNwMAIAAgBjcDCCAEQSBqJAAL8wQBAX8jAEGQAmsiACQAIAAgAjYCgAIgACABNgKIAiAAQdABahCeBiEGIAAgAygCHCIBNgIQIAEgASgCBEEBajYCBCAAQRBqEJAFIgFBsL8BQcq/ASAAQeABaiABKAIAKAIgEQgAGgJ/IAAoAhAiASABKAIEQX9qIgI2AgQgAkF/RgsEQCABIAEoAgAoAggRAQALIABBwAFqEJ4GIgIgAiwAC0EASAR/IAIoAghB/////wdxQX9qBUEKCxCfBiAAAn8gAiwAC0EASARAIAIoAgAMAQsgAgsiATYCvAEgACAAQRBqNgIMIABBADYCCANAAkAgAEGIAmogAEGAAmoQkQVFDQAgACgCvAECfyACLAALQQBIBEAgAigCBAwBCyACLQALCyABakYEQAJ/IAIiASwAC0EASARAIAEoAgQMAQsgAS0ACwshAyABAn8gASwAC0EASARAIAEoAgQMAQsgAS0ACwtBAXQQnwYgASABLAALQQBIBH8gASgCCEH/////B3FBf2oFQQoLEJ8GIAAgAwJ/IAEsAAtBAEgEQCACKAIADAELIAILIgFqNgK8AQsgAEGIAmoQkgVBECABIABBvAFqIABBCGpBACAGIABBEGogAEEMaiAAQeABahCgBg0AIABBiAJqEJMFGgwBCwsgAiAAKAK8ASABaxCfBgJ/IAIsAAtBAEgEQCACKAIADAELIAILIQEQuwYhAyAAIAU2AgAgASADIAAQvAZBAUcEQCAEQQQ2AgALIABBiAJqIABBgAJqEJQFBEAgBCAEKAIAQQJyNgIACyAAKAKIAiEBIAIQhwkaIAYQhwkaIABBkAJqJAAgAQtMAAJAQcCVAy0AAEEBcQ0AQcCVAy0AAEEAR0EBc0UNAEG8lQMQ+wU2AgBBwJUDQQA2AgBBwJUDQcCVAygCAEEBcjYCAAtBvJUDKAIAC2oBAX8jAEEQayIDJAAgAyABNgIMIAMgAjYCCCADIANBDGoQvwYhASAAQdG/ASADKAIIEPMFIQIgASgCACIABEBBiPACKAIAGiAABEBBiPACQbz7AiAAIABBf0YbNgIACwsgA0EQaiQAIAILLQEBfyAAIQFBACEAA0AgAEEDRwRAIAEgAEECdGpBADYCACAAQQFqIQAMAQsLCzIAIAItAAAhAgNAAkAgACABRwR/IAAtAAAgAkcNASAABSABCw8LIABBAWohAAwAAAsACz0BAX9BiPACKAIAIQIgASgCACIBBEBBiPACQbz7AiABIAFBf0YbNgIACyAAQX8gAiACQbz7AkYbNgIAIAAL+wIBAn8jAEEgayIGJAAgBiABNgIYAkAgAygCBEEBcUUEQCAGQX82AgAgBiAAIAEgAiADIAQgBiAAKAIAKAIQEQkAIgE2AhggBigCACIAQQFNBEAgAEEBawRAIAVBADoAAAwDCyAFQQE6AAAMAgsgBUEBOgAAIARBBDYCAAwBCyAGIAMoAhwiADYCACAAIAAoAgRBAWo2AgQgBhCdBSEHAn8gBigCACIAIAAoAgRBf2oiATYCBCABQX9GCwRAIAAgACgCACgCCBEBAAsgBiADKAIcIgA2AgAgACAAKAIEQQFqNgIEIAYQwQYhAAJ/IAYoAgAiASABKAIEQX9qIgM2AgQgA0F/RgsEQCABIAEoAgAoAggRAQALIAYgACAAKAIAKAIYEQIAIAZBDHIgACAAKAIAKAIcEQIAIAUgBkEYaiACIAYgBkEYaiIDIAcgBEEBEMIGIAZGOgAAIAYoAhghAQNAIANBdGoQhwkiAyAGRw0ACwsgBkEgaiQAIAELCwAgAEGYlgMQmAYL+AUBC38jAEGAAWsiCCQAIAggATYCeCADIAJrQQxtIQkgCEG+BTYCECAIQQhqQQAgCEEQahCZBiEMIAhBEGohCgJAIAlB5QBPBEAgCRDSCSIKRQ0BIAwoAgAhASAMIAo2AgAgAQRAIAEgDCgCBBEBAAsLIAohByACIQEDQCABIANGBEADQAJAIAlBACAAIAhB+ABqEJ4FG0UEQCAAIAhB+ABqEKAFBEAgBSAFKAIAQQJyNgIACwwBCwJ/IAAoAgAiBygCDCIBIAcoAhBGBEAgByAHKAIAKAIkEQAADAELIAEoAgALIQ0gBkUEQCAEIA0gBCgCACgCHBEDACENCyAOQQFqIQ9BACEQIAohByACIQEDQCABIANGBEAgDyEOIBBFDQMgABCfBRogCiEHIAIhASAJIAtqQQJJDQMDQCABIANGDQQCQCAHLQAAQQJHDQACfyABLAALQQBIBEAgASgCBAwBCyABLQALCyAORg0AIAdBADoAACALQX9qIQsLIAdBAWohByABQQxqIQEMAAALAAUCQCAHLQAAQQFHDQACfyABLAALQQBIBEAgASgCAAwBCyABCyAOQQJ0aigCACERAkAgBgR/IBEFIAQgESAEKAIAKAIcEQMACyANRgRAQQEhEAJ/IAEsAAtBAEgEQCABKAIEDAELIAEtAAsLIA9HDQIgB0ECOgAAIAtBAWohCwwBCyAHQQA6AAALIAlBf2ohCQsgB0EBaiEHIAFBDGohAQwBCwAACwALCwJAAkADQCACIANGDQEgCi0AAEECRwRAIApBAWohCiACQQxqIQIMAQsLIAIhAwwBCyAFIAUoAgBBBHI2AgALIAwiACgCACEBIABBADYCACABBEAgASAAKAIEEQEACyAIQYABaiQAIAMPBQJAAn8gASwAC0EASARAIAEoAgQMAQsgAS0ACwsEQCAHQQE6AAAMAQsgB0ECOgAAIAtBAWohCyAJQX9qIQkLIAdBAWohByABQQxqIQEMAQsAAAsACxC1BwALDwAgASACIAMgBCAFEMQGC/oEAQR/IwBB4AJrIgUkACAFIAE2AtACIAUgADYC2AIgAhCcBiEGIAIgBUHgAWoQxQYhByAFQdABaiACIAVBzAJqEMYGIAVBwAFqEJ4GIgAgACwAC0EASAR/IAAoAghB/////wdxQX9qBUEKCxCfBiAFAn8gACwAC0EASARAIAAoAgAMAQsgAAsiATYCvAEgBSAFQRBqNgIMIAVBADYCCANAAkAgBUHYAmogBUHQAmoQngVFDQAgBSgCvAECfyAALAALQQBIBEAgACgCBAwBCyAALQALCyABakYEQAJ/IAAiASwAC0EASARAIAEoAgQMAQsgAS0ACwshAiABAn8gASwAC0EASARAIAEoAgQMAQsgAS0ACwtBAXQQnwYgASABLAALQQBIBH8gASgCCEH/////B3FBf2oFQQoLEJ8GIAUgAgJ/IAEsAAtBAEgEQCAAKAIADAELIAALIgFqNgK8AQsCfyAFKALYAiICKAIMIgggAigCEEYEQCACIAIoAgAoAiQRAAAMAQsgCCgCAAsgBiABIAVBvAFqIAVBCGogBSgCzAIgBUHQAWogBUEQaiAFQQxqIAcQxwYNACAFQdgCahCfBRoMAQsLAkACfyAFLADbAUEASARAIAUoAtQBDAELIAUtANsBC0UNACAFKAIMIgIgBUEQamtBnwFKDQAgBSACQQRqNgIMIAIgBSgCCDYCAAsgBCABIAUoArwBIAMgBhChBjYCACAFQdABaiAFQRBqIAUoAgwgAxCiBiAFQdgCaiAFQdACahCgBQRAIAMgAygCAEECcjYCAAsgBSgC2AIhASAAEIcJGiAFQdABahCHCRogBUHgAmokACABCwkAIAAgARDaBguEAQEBfyMAQRBrIgMkACADIAEoAhwiATYCCCABIAEoAgRBAWo2AgQgAiADQQhqEMEGIgEiAiACKAIAKAIQEQAANgIAIAAgASABKAIAKAIUEQIAAn8gAygCCCIAIAAoAgRBf2oiATYCBCABQX9GCwRAIAAgACgCACgCCBEBAAsgA0EQaiQAC4wDAQJ/IwBBEGsiCiQAIAogADYCDAJAAkACQAJAIAMoAgAgAkcNACAJKAJgIABGIgtFBEAgCSgCZCAARw0BCyADIAJBAWo2AgAgAkErQS0gCxs6AAAMAQsCfyAGLAALQQBIBEAgBigCBAwBCyAGLQALC0UNASAAIAVHDQFBACEAIAgoAgAiASAHa0GfAUoNAiAEKAIAIQAgCCABQQRqNgIAIAEgADYCAAtBACEAIARBADYCAAwBC0F/IQAgCSAJQegAaiAKQQxqENkGIAlrIgZB3ABKDQAgBkECdSEFAkAgAUF4aiIHQQJLBEAgAUEQRw0BIAZB2ABIDQEgAygCACIBIAJGDQIgASACa0ECSg0CIAFBf2otAABBMEcNAkEAIQAgBEEANgIAIAMgAUEBajYCACABIAVBsL8Bai0AADoAAAwCCyAHQQFrRQ0AIAUgAU4NAQsgAyADKAIAIgBBAWo2AgAgACAFQbC/AWotAAA6AAAgBCAEKAIAQQFqNgIAQQAhAAsgCkEQaiQAIAALDwAgASACIAMgBCAFEMkGC/oEAQR/IwBB4AJrIgUkACAFIAE2AtACIAUgADYC2AIgAhCcBiEGIAIgBUHgAWoQxQYhByAFQdABaiACIAVBzAJqEMYGIAVBwAFqEJ4GIgAgACwAC0EASAR/IAAoAghB/////wdxQX9qBUEKCxCfBiAFAn8gACwAC0EASARAIAAoAgAMAQsgAAsiATYCvAEgBSAFQRBqNgIMIAVBADYCCANAAkAgBUHYAmogBUHQAmoQngVFDQAgBSgCvAECfyAALAALQQBIBEAgACgCBAwBCyAALQALCyABakYEQAJ/IAAiASwAC0EASARAIAEoAgQMAQsgAS0ACwshAiABAn8gASwAC0EASARAIAEoAgQMAQsgAS0ACwtBAXQQnwYgASABLAALQQBIBH8gASgCCEH/////B3FBf2oFQQoLEJ8GIAUgAgJ/IAEsAAtBAEgEQCAAKAIADAELIAALIgFqNgK8AQsCfyAFKALYAiICKAIMIgggAigCEEYEQCACIAIoAgAoAiQRAAAMAQsgCCgCAAsgBiABIAVBvAFqIAVBCGogBSgCzAIgBUHQAWogBUEQaiAFQQxqIAcQxwYNACAFQdgCahCfBRoMAQsLAkACfyAFLADbAUEASARAIAUoAtQBDAELIAUtANsBC0UNACAFKAIMIgIgBUEQamtBnwFKDQAgBSACQQRqNgIMIAIgBSgCCDYCAAsgBCABIAUoArwBIAMgBhClBjcDACAFQdABaiAFQRBqIAUoAgwgAxCiBiAFQdgCaiAFQdACahCgBQRAIAMgAygCAEECcjYCAAsgBSgC2AIhASAAEIcJGiAFQdABahCHCRogBUHgAmokACABCw8AIAEgAiADIAQgBRDLBgv6BAEEfyMAQeACayIFJAAgBSABNgLQAiAFIAA2AtgCIAIQnAYhBiACIAVB4AFqEMUGIQcgBUHQAWogAiAFQcwCahDGBiAFQcABahCeBiIAIAAsAAtBAEgEfyAAKAIIQf////8HcUF/agVBCgsQnwYgBQJ/IAAsAAtBAEgEQCAAKAIADAELIAALIgE2ArwBIAUgBUEQajYCDCAFQQA2AggDQAJAIAVB2AJqIAVB0AJqEJ4FRQ0AIAUoArwBAn8gACwAC0EASARAIAAoAgQMAQsgAC0ACwsgAWpGBEACfyAAIgEsAAtBAEgEQCABKAIEDAELIAEtAAsLIQIgAQJ/IAEsAAtBAEgEQCABKAIEDAELIAEtAAsLQQF0EJ8GIAEgASwAC0EASAR/IAEoAghB/////wdxQX9qBUEKCxCfBiAFIAICfyABLAALQQBIBEAgACgCAAwBCyAACyIBajYCvAELAn8gBSgC2AIiAigCDCIIIAIoAhBGBEAgAiACKAIAKAIkEQAADAELIAgoAgALIAYgASAFQbwBaiAFQQhqIAUoAswCIAVB0AFqIAVBEGogBUEMaiAHEMcGDQAgBUHYAmoQnwUaDAELCwJAAn8gBSwA2wFBAEgEQCAFKALUAQwBCyAFLQDbAQtFDQAgBSgCDCICIAVBEGprQZ8BSg0AIAUgAkEEajYCDCACIAUoAgg2AgALIAQgASAFKAK8ASADIAYQqAY7AQAgBUHQAWogBUEQaiAFKAIMIAMQogYgBUHYAmogBUHQAmoQoAUEQCADIAMoAgBBAnI2AgALIAUoAtgCIQEgABCHCRogBUHQAWoQhwkaIAVB4AJqJAAgAQsPACABIAIgAyAEIAUQzQYL+gQBBH8jAEHgAmsiBSQAIAUgATYC0AIgBSAANgLYAiACEJwGIQYgAiAFQeABahDFBiEHIAVB0AFqIAIgBUHMAmoQxgYgBUHAAWoQngYiACAALAALQQBIBH8gACgCCEH/////B3FBf2oFQQoLEJ8GIAUCfyAALAALQQBIBEAgACgCAAwBCyAACyIBNgK8ASAFIAVBEGo2AgwgBUEANgIIA0ACQCAFQdgCaiAFQdACahCeBUUNACAFKAK8AQJ/IAAsAAtBAEgEQCAAKAIEDAELIAAtAAsLIAFqRgRAAn8gACIBLAALQQBIBEAgASgCBAwBCyABLQALCyECIAECfyABLAALQQBIBEAgASgCBAwBCyABLQALC0EBdBCfBiABIAEsAAtBAEgEfyABKAIIQf////8HcUF/agVBCgsQnwYgBSACAn8gASwAC0EASARAIAAoAgAMAQsgAAsiAWo2ArwBCwJ/IAUoAtgCIgIoAgwiCCACKAIQRgRAIAIgAigCACgCJBEAAAwBCyAIKAIACyAGIAEgBUG8AWogBUEIaiAFKALMAiAFQdABaiAFQRBqIAVBDGogBxDHBg0AIAVB2AJqEJ8FGgwBCwsCQAJ/IAUsANsBQQBIBEAgBSgC1AEMAQsgBS0A2wELRQ0AIAUoAgwiAiAFQRBqa0GfAUoNACAFIAJBBGo2AgwgAiAFKAIINgIACyAEIAEgBSgCvAEgAyAGEKsGNgIAIAVB0AFqIAVBEGogBSgCDCADEKIGIAVB2AJqIAVB0AJqEKAFBEAgAyADKAIAQQJyNgIACyAFKALYAiEBIAAQhwkaIAVB0AFqEIcJGiAFQeACaiQAIAELDwAgASACIAMgBCAFEM8GC/oEAQR/IwBB4AJrIgUkACAFIAE2AtACIAUgADYC2AIgAhCcBiEGIAIgBUHgAWoQxQYhByAFQdABaiACIAVBzAJqEMYGIAVBwAFqEJ4GIgAgACwAC0EASAR/IAAoAghB/////wdxQX9qBUEKCxCfBiAFAn8gACwAC0EASARAIAAoAgAMAQsgAAsiATYCvAEgBSAFQRBqNgIMIAVBADYCCANAAkAgBUHYAmogBUHQAmoQngVFDQAgBSgCvAECfyAALAALQQBIBEAgACgCBAwBCyAALQALCyABakYEQAJ/IAAiASwAC0EASARAIAEoAgQMAQsgAS0ACwshAiABAn8gASwAC0EASARAIAEoAgQMAQsgAS0ACwtBAXQQnwYgASABLAALQQBIBH8gASgCCEH/////B3FBf2oFQQoLEJ8GIAUgAgJ/IAEsAAtBAEgEQCAAKAIADAELIAALIgFqNgK8AQsCfyAFKALYAiICKAIMIgggAigCEEYEQCACIAIoAgAoAiQRAAAMAQsgCCgCAAsgBiABIAVBvAFqIAVBCGogBSgCzAIgBUHQAWogBUEQaiAFQQxqIAcQxwYNACAFQdgCahCfBRoMAQsLAkACfyAFLADbAUEASARAIAUoAtQBDAELIAUtANsBC0UNACAFKAIMIgIgBUEQamtBnwFKDQAgBSACQQRqNgIMIAIgBSgCCDYCAAsgBCABIAUoArwBIAMgBhCuBjcDACAFQdABaiAFQRBqIAUoAgwgAxCiBiAFQdgCaiAFQdACahCgBQRAIAMgAygCAEECcjYCAAsgBSgC2AIhASAAEIcJGiAFQdABahCHCRogBUHgAmokACABCw8AIAEgAiADIAQgBRDRBguZBQECfyMAQfACayIFJAAgBSABNgLgAiAFIAA2AugCIAVByAFqIAIgBUHgAWogBUHcAWogBUHYAWoQ0gYgBUG4AWoQngYiASABLAALQQBIBH8gASgCCEH/////B3FBf2oFQQoLEJ8GIAUCfyABLAALQQBIBEAgASgCAAwBCyABCyIANgK0ASAFIAVBEGo2AgwgBUEANgIIIAVBAToAByAFQcUAOgAGA0ACQCAFQegCaiAFQeACahCeBUUNACAFKAK0AQJ/IAEsAAtBAEgEQCABKAIEDAELIAEtAAsLIABqRgRAAn8gASIALAALQQBIBEAgACgCBAwBCyAALQALCyECIAACfyAALAALQQBIBEAgACgCBAwBCyAALQALC0EBdBCfBiAAIAAsAAtBAEgEfyAAKAIIQf////8HcUF/agVBCgsQnwYgBSACAn8gACwAC0EASARAIAEoAgAMAQsgAQsiAGo2ArQBCwJ/IAUoAugCIgIoAgwiBiACKAIQRgRAIAIgAigCACgCJBEAAAwBCyAGKAIACyAFQQdqIAVBBmogACAFQbQBaiAFKALcASAFKALYASAFQcgBaiAFQRBqIAVBDGogBUEIaiAFQeABahDTBg0AIAVB6AJqEJ8FGgwBCwsCQAJ/IAUsANMBQQBIBEAgBSgCzAEMAQsgBS0A0wELRQ0AIAUtAAdFDQAgBSgCDCICIAVBEGprQZ8BSg0AIAUgAkEEajYCDCACIAUoAgg2AgALIAQgACAFKAK0ASADELMGOAIAIAVByAFqIAVBEGogBSgCDCADEKIGIAVB6AJqIAVB4AJqEKAFBEAgAyADKAIAQQJyNgIACyAFKALoAiEAIAEQhwkaIAVByAFqEIcJGiAFQfACaiQAIAALtgEBAX8jAEEQayIFJAAgBSABKAIcIgE2AgggASABKAIEQQFqNgIEIAVBCGoQnQUiAUGwvwFB0L8BIAIgASgCACgCMBEIABogAyAFQQhqEMEGIgEiAiACKAIAKAIMEQAANgIAIAQgASABKAIAKAIQEQAANgIAIAAgASABKAIAKAIUEQIAAn8gBSgCCCIAIAAoAgRBf2oiATYCBCABQX9GCwRAIAAgACgCACgCCBEBAAsgBUEQaiQAC8MEAQF/IwBBEGsiDCQAIAwgADYCDAJAAkAgACAFRgRAIAEtAABFDQFBACEAIAFBADoAACAEIAQoAgAiAUEBajYCACABQS46AAACfyAHLAALQQBIBEAgBygCBAwBCyAHLQALC0UNAiAJKAIAIgEgCGtBnwFKDQIgCigCACECIAkgAUEEajYCACABIAI2AgAMAgsCQCAAIAZHDQACfyAHLAALQQBIBEAgBygCBAwBCyAHLQALC0UNACABLQAARQ0BQQAhACAJKAIAIgEgCGtBnwFKDQIgCigCACEAIAkgAUEEajYCACABIAA2AgBBACEAIApBADYCAAwCC0F/IQAgCyALQYABaiAMQQxqENkGIAtrIgVB/ABKDQEgBUECdUGwvwFqLQAAIQYCQCAFQah/akEedyIAQQNNBEACQAJAIABBAmsOAgAAAQsgAyAEKAIAIgFHBEBBfyEAIAFBf2otAABB3wBxIAItAABB/wBxRw0FCyAEIAFBAWo2AgAgASAGOgAAQQAhAAwECyACQdAAOgAADAELIAIsAAAiACAGQd8AcUcNACACIABBgAFyOgAAIAEtAABFDQAgAUEAOgAAAn8gBywAC0EASARAIAcoAgQMAQsgBy0ACwtFDQAgCSgCACIAIAhrQZ8BSg0AIAooAgAhASAJIABBBGo2AgAgACABNgIACyAEIAQoAgAiAEEBajYCACAAIAY6AABBACEAIAVB1ABKDQEgCiAKKAIAQQFqNgIADAELQX8hAAsgDEEQaiQAIAALDwAgASACIAMgBCAFENUGC5kFAQJ/IwBB8AJrIgUkACAFIAE2AuACIAUgADYC6AIgBUHIAWogAiAFQeABaiAFQdwBaiAFQdgBahDSBiAFQbgBahCeBiIBIAEsAAtBAEgEfyABKAIIQf////8HcUF/agVBCgsQnwYgBQJ/IAEsAAtBAEgEQCABKAIADAELIAELIgA2ArQBIAUgBUEQajYCDCAFQQA2AgggBUEBOgAHIAVBxQA6AAYDQAJAIAVB6AJqIAVB4AJqEJ4FRQ0AIAUoArQBAn8gASwAC0EASARAIAEoAgQMAQsgAS0ACwsgAGpGBEACfyABIgAsAAtBAEgEQCAAKAIEDAELIAAtAAsLIQIgAAJ/IAAsAAtBAEgEQCAAKAIEDAELIAAtAAsLQQF0EJ8GIAAgACwAC0EASAR/IAAoAghB/////wdxQX9qBUEKCxCfBiAFIAICfyAALAALQQBIBEAgASgCAAwBCyABCyIAajYCtAELAn8gBSgC6AIiAigCDCIGIAIoAhBGBEAgAiACKAIAKAIkEQAADAELIAYoAgALIAVBB2ogBUEGaiAAIAVBtAFqIAUoAtwBIAUoAtgBIAVByAFqIAVBEGogBUEMaiAFQQhqIAVB4AFqENMGDQAgBUHoAmoQnwUaDAELCwJAAn8gBSwA0wFBAEgEQCAFKALMAQwBCyAFLQDTAQtFDQAgBS0AB0UNACAFKAIMIgIgBUEQamtBnwFKDQAgBSACQQRqNgIMIAIgBSgCCDYCAAsgBCAAIAUoArQBIAMQtgY5AwAgBUHIAWogBUEQaiAFKAIMIAMQogYgBUHoAmogBUHgAmoQoAUEQCADIAMoAgBBAnI2AgALIAUoAugCIQAgARCHCRogBUHIAWoQhwkaIAVB8AJqJAAgAAsPACABIAIgAyAEIAUQ1wYLsAUCAn8BfiMAQYADayIFJAAgBSABNgLwAiAFIAA2AvgCIAVB2AFqIAIgBUHwAWogBUHsAWogBUHoAWoQ0gYgBUHIAWoQngYiASABLAALQQBIBH8gASgCCEH/////B3FBf2oFQQoLEJ8GIAUCfyABLAALQQBIBEAgASgCAAwBCyABCyIANgLEASAFIAVBIGo2AhwgBUEANgIYIAVBAToAFyAFQcUAOgAWA0ACQCAFQfgCaiAFQfACahCeBUUNACAFKALEAQJ/IAEsAAtBAEgEQCABKAIEDAELIAEtAAsLIABqRgRAAn8gASIALAALQQBIBEAgACgCBAwBCyAALQALCyECIAACfyAALAALQQBIBEAgACgCBAwBCyAALQALC0EBdBCfBiAAIAAsAAtBAEgEfyAAKAIIQf////8HcUF/agVBCgsQnwYgBSACAn8gACwAC0EASARAIAEoAgAMAQsgAQsiAGo2AsQBCwJ/IAUoAvgCIgIoAgwiBiACKAIQRgRAIAIgAigCACgCJBEAAAwBCyAGKAIACyAFQRdqIAVBFmogACAFQcQBaiAFKALsASAFKALoASAFQdgBaiAFQSBqIAVBHGogBUEYaiAFQfABahDTBg0AIAVB+AJqEJ8FGgwBCwsCQAJ/IAUsAOMBQQBIBEAgBSgC3AEMAQsgBS0A4wELRQ0AIAUtABdFDQAgBSgCHCICIAVBIGprQZ8BSg0AIAUgAkEEajYCHCACIAUoAhg2AgALIAUgACAFKALEASADELkGIAUpAwAhByAEIAUpAwg3AwggBCAHNwMAIAVB2AFqIAVBIGogBSgCHCADEKIGIAVB+AJqIAVB8AJqEKAFBEAgAyADKAIAQQJyNgIACyAFKAL4AiEAIAEQhwkaIAVB2AFqEIcJGiAFQYADaiQAIAALlwUBAn8jAEHgAmsiACQAIAAgAjYC0AIgACABNgLYAiAAQdABahCeBiEGIAAgAygCHCIBNgIQIAEgASgCBEEBajYCBCAAQRBqEJ0FIgFBsL8BQcq/ASAAQeABaiABKAIAKAIwEQgAGgJ/IAAoAhAiASABKAIEQX9qIgI2AgQgAkF/RgsEQCABIAEoAgAoAggRAQALIABBwAFqEJ4GIgIgAiwAC0EASAR/IAIoAghB/////wdxQX9qBUEKCxCfBiAAAn8gAiwAC0EASARAIAIoAgAMAQsgAgsiATYCvAEgACAAQRBqNgIMIABBADYCCANAAkAgAEHYAmogAEHQAmoQngVFDQAgACgCvAECfyACLAALQQBIBEAgAigCBAwBCyACLQALCyABakYEQAJ/IAIiASwAC0EASARAIAEoAgQMAQsgAS0ACwshAyABAn8gASwAC0EASARAIAEoAgQMAQsgAS0ACwtBAXQQnwYgASABLAALQQBIBH8gASgCCEH/////B3FBf2oFQQoLEJ8GIAAgAwJ/IAEsAAtBAEgEQCACKAIADAELIAILIgFqNgK8AQsCfyAAKALYAiIDKAIMIgcgAygCEEYEQCADIAMoAgAoAiQRAAAMAQsgBygCAAtBECABIABBvAFqIABBCGpBACAGIABBEGogAEEMaiAAQeABahDHBg0AIABB2AJqEJ8FGgwBCwsgAiAAKAK8ASABaxCfBgJ/IAIsAAtBAEgEQCACKAIADAELIAILIQEQuwYhAyAAIAU2AgAgASADIAAQvAZBAUcEQCAEQQQ2AgALIABB2AJqIABB0AJqEKAFBEAgBCAEKAIAQQJyNgIACyAAKALYAiEBIAIQhwkaIAYQhwkaIABB4AJqJAAgAQsyACACKAIAIQIDQAJAIAAgAUcEfyAAKAIAIAJHDQEgAAUgAQsPCyAAQQRqIQAMAAALAAt7AQJ/IwBBEGsiAiQAIAIgACgCHCIANgIIIAAgACgCBEEBajYCBCACQQhqEJ0FIgBBsL8BQcq/ASABIAAoAgAoAjARCAAaAn8gAigCCCIAIAAoAgRBf2oiAzYCBCADQX9GCwRAIAAgACgCACgCCBEBAAsgAkEQaiQAIAELpAIBAX8jAEEwayIFJAAgBSABNgIoAkAgAigCBEEBcUUEQCAAIAEgAiADIAQgACgCACgCGBEGACECDAELIAUgAigCHCIANgIYIAAgACgCBEEBajYCBCAFQRhqEJYGIQACfyAFKAIYIgEgASgCBEF/aiICNgIEIAJBf0YLBEAgASABKAIAKAIIEQEACwJAIAQEQCAFQRhqIAAgACgCACgCGBECAAwBCyAFQRhqIAAgACgCACgCHBECAAsgBSAFQRhqENwGNgIQA0AgBSAFQRhqEN0GNgIIIAUoAhAgBSgCCEZBAXNFBEAgBSgCKCECIAVBGGoQhwkaDAILIAVBKGogBSgCECwAABCvBSAFIAUoAhBBAWo2AhAMAAALAAsgBUEwaiQAIAILOQEBfyMAQRBrIgEkACABAn8gACwAC0EASARAIAAoAgAMAQsgAAs2AgggASgCCCEAIAFBEGokACAAC1QBAX8jAEEQayIBJAAgAQJ/IAAsAAtBAEgEQCAAKAIADAELIAALAn8gACwAC0EASARAIAAoAgQMAQsgAC0ACwtqNgIIIAEoAgghACABQRBqJAAgAAuIAgEEfyMAQSBrIgAkACAAQeC/AS8AADsBHCAAQdy/ASgAADYCGCAAQRhqQQFyQdS/AUEBIAIoAgQQ3wYgAigCBCEGIABBcGoiByIIJAAQuwYhBSAAIAQ2AgAgByAHIAZBCXZBAXFBDWogBSAAQRhqIAAQ4AYgB2oiBSACEOEGIQQgCEFgaiIGJAAgACACKAIcIgg2AgggCCAIKAIEQQFqNgIEIAcgBCAFIAYgAEEUaiAAQRBqIABBCGoQ4gYCfyAAKAIIIgUgBSgCBEF/aiIENgIEIARBf0YLBEAgBSAFKAIAKAIIEQEACyABIAYgACgCFCAAKAIQIAIgAxDgAyEBIABBIGokACABC48BAQF/IANBgBBxBEAgAEErOgAAIABBAWohAAsgA0GABHEEQCAAQSM6AAAgAEEBaiEACwNAIAEtAAAiBARAIAAgBDoAACAAQQFqIQAgAUEBaiEBDAELCyAAAn9B7wAgA0HKAHEiAUHAAEYNABpB2ABB+AAgA0GAgAFxGyABQQhGDQAaQeQAQfUAIAIbCzoAAAtqAQF/IwBBEGsiBSQAIAUgAjYCDCAFIAQ2AgggBSAFQQxqEL8GIQIgACABIAMgBSgCCBDMBCEBIAIoAgAiAARAQYjwAigCABogAARAQYjwAkG8+wIgACAAQX9GGzYCAAsLIAVBEGokACABC2wBAX8gAigCBEGwAXEiAkEgRgRAIAEPCwJAIAJBEEcNAAJAIAAtAAAiAkFVaiIDQQJLDQAgA0EBa0UNACAAQQFqDwsgASAAa0ECSA0AIAJBMEcNACAALQABQSByQfgARw0AIABBAmohAAsgAAvrBAEIfyMAQRBrIgckACAGEJAFIQsgByAGEJYGIgYiCCAIKAIAKAIUEQIAAkACfyAHLAALQQBIBEAgBygCBAwBCyAHLQALC0UEQCALIAAgAiADIAsoAgAoAiARCAAaIAUgAyACIABraiIGNgIADAELIAUgAzYCAAJAIAAiCC0AACIJQVVqIgpBAksNACAKQQFrRQ0AIAsgCUEYdEEYdSALKAIAKAIcEQMAIQggBSAFKAIAIglBAWo2AgAgCSAIOgAAIABBAWohCAsCQCACIAhrQQJIDQAgCC0AAEEwRw0AIAgtAAFBIHJB+ABHDQAgC0EwIAsoAgAoAhwRAwAhCSAFIAUoAgAiCkEBajYCACAKIAk6AAAgCyAILAABIAsoAgAoAhwRAwAhCSAFIAUoAgAiCkEBajYCACAKIAk6AAAgCEECaiEICyAIIAIQ4wYgBiAGKAIAKAIQEQAAIQxBACEKQQAhCSAIIQYDfyAGIAJPBH8gAyAIIABraiAFKAIAEOMGIAUoAgAFAkACfyAHLAALQQBIBEAgBygCAAwBCyAHCyAJai0AAEUNACAKAn8gBywAC0EASARAIAcoAgAMAQsgBwsgCWosAABHDQAgBSAFKAIAIgpBAWo2AgAgCiAMOgAAIAkgCQJ/IAcsAAtBAEgEQCAHKAIEDAELIActAAsLQX9qSWohCUEAIQoLIAsgBiwAACALKAIAKAIcEQMAIQ0gBSAFKAIAIg5BAWo2AgAgDiANOgAAIAZBAWohBiAKQQFqIQoMAQsLIQYLIAQgBiADIAEgAGtqIAEgAkYbNgIAIAcQhwkaIAdBEGokAAsJACAAIAEQ/QYLBwAgACgCDAv3AQEFfyMAQSBrIgAkACAAQiU3AxggAEEYakEBckHWvwFBASACKAIEEN8GIAIoAgQhByAAQWBqIgUiBiQAELsGIQggACAENwMAIAUgBSAHQQl2QQFxQRdqIAggAEEYaiAAEOAGIAVqIgggAhDhBiEJIAZBUGoiByQAIAAgAigCHCIGNgIIIAYgBigCBEEBajYCBCAFIAkgCCAHIABBFGogAEEQaiAAQQhqEOIGAn8gACgCCCIFIAUoAgRBf2oiBjYCBCAGQX9GCwRAIAUgBSgCACgCCBEBAAsgASAHIAAoAhQgACgCECACIAMQ4AMhASAAQSBqJAAgAQuIAgEEfyMAQSBrIgAkACAAQeC/AS8AADsBHCAAQdy/ASgAADYCGCAAQRhqQQFyQdS/AUEAIAIoAgQQ3wYgAigCBCEGIABBcGoiByIIJAAQuwYhBSAAIAQ2AgAgByAHIAZBCXZBAXFBDHIgBSAAQRhqIAAQ4AYgB2oiBSACEOEGIQQgCEFgaiIGJAAgACACKAIcIgg2AgggCCAIKAIEQQFqNgIEIAcgBCAFIAYgAEEUaiAAQRBqIABBCGoQ4gYCfyAAKAIIIgUgBSgCBEF/aiIENgIEIARBf0YLBEAgBSAFKAIAKAIIEQEACyABIAYgACgCFCAAKAIQIAIgAxDgAyEBIABBIGokACABC/oBAQV/IwBBIGsiACQAIABCJTcDGCAAQRhqQQFyQda/AUEAIAIoAgQQ3wYgAigCBCEHIABBYGoiBSIGJAAQuwYhCCAAIAQ3AwAgBSAFIAdBCXZBAXFBFnJBAWogCCAAQRhqIAAQ4AYgBWoiCCACEOEGIQkgBkFQaiIHJAAgACACKAIcIgY2AgggBiAGKAIEQQFqNgIEIAUgCSAIIAcgAEEUaiAAQRBqIABBCGoQ4gYCfyAAKAIIIgUgBSgCBEF/aiIGNgIEIAZBf0YLBEAgBSAFKAIAKAIIEQEACyABIAcgACgCFCAAKAIQIAIgAxDgAyEBIABBIGokACABC4AFAQd/IwBB0AFrIgAkACAAQiU3A8gBIABByAFqQQFyQdm/ASACKAIEEOkGIQUgACAAQaABajYCnAEQuwYhCAJ/IAUEQCACKAIIIQYgACAEOQMoIAAgBjYCICAAQaABakEeIAggAEHIAWogAEEgahDgBgwBCyAAIAQ5AzAgAEGgAWpBHiAIIABByAFqIABBMGoQ4AYLIQYgAEG+BTYCUCAAQZABakEAIABB0ABqEJkGIQgCQCAGQR5OBEAQuwYhBgJ/IAUEQCACKAIIIQUgACAEOQMIIAAgBTYCACAAQZwBaiAGIABByAFqIAAQ6wYMAQsgACAEOQMQIABBnAFqIAYgAEHIAWogAEEQahDrBgshBiAAKAKcASIHRQ0BIAgoAgAhBSAIIAc2AgAgBQRAIAUgCCgCBBEBAAsLIAAoApwBIgUgBSAGaiIJIAIQ4QYhCiAAQb4FNgJQIABByABqQQAgAEHQAGoQmQYhBQJ/IAAoApwBIABBoAFqRgRAIABB0ABqIQYgAEGgAWoMAQsgBkEBdBDSCSIGRQ0BIAUoAgAhByAFIAY2AgAgBwRAIAcgBSgCBBEBAAsgACgCnAELIQsgACACKAIcIgc2AjggByAHKAIEQQFqNgIEIAsgCiAJIAYgAEHEAGogAEFAayAAQThqEOwGAn8gACgCOCIHIAcoAgRBf2oiCTYCBCAJQX9GCwRAIAcgBygCACgCCBEBAAsgASAGIAAoAkQgACgCQCACIAMQ4AMhAiAFKAIAIQEgBUEANgIAIAEEQCABIAUoAgQRAQALIAgoAgAhASAIQQA2AgAgAQRAIAEgCCgCBBEBAAsgAEHQAWokACACDwsQtQcAC9ABAQN/IAJBgBBxBEAgAEErOgAAIABBAWohAAsgAkGACHEEQCAAQSM6AAAgAEEBaiEACyACQYQCcSIDQYQCRwRAIABBrtQAOwAAQQEhBCAAQQJqIQALIAJBgIABcSECA0AgAS0AACIFBEAgACAFOgAAIABBAWohACABQQFqIQEMAQsLIAACfwJAIANBgAJHBEAgA0EERw0BQcYAQeYAIAIbDAILQcUAQeUAIAIbDAELQcEAQeEAIAIbIANBhAJGDQAaQccAQecAIAIbCzoAACAECwcAIAAoAggLaAEBfyMAQRBrIgQkACAEIAE2AgwgBCADNgIIIAQgBEEMahC/BiEBIAAgAiAEKAIIEPwFIQIgASgCACIABEBBiPACKAIAGiAABEBBiPACQbz7AiAAIABBf0YbNgIACwsgBEEQaiQAIAIL+QYBCn8jAEEQayIIJAAgBhCQBSEKIAggBhCWBiINIgYgBigCACgCFBECACAFIAM2AgACQCAAIgctAAAiBkFVaiIJQQJLDQAgCUEBa0UNACAKIAZBGHRBGHUgCigCACgCHBEDACEGIAUgBSgCACIHQQFqNgIAIAcgBjoAACAAQQFqIQcLAkACQCACIAciBmtBAUwNACAHLQAAQTBHDQAgBy0AAUEgckH4AEcNACAKQTAgCigCACgCHBEDACEGIAUgBSgCACIJQQFqNgIAIAkgBjoAACAKIAcsAAEgCigCACgCHBEDACEGIAUgBSgCACIJQQFqNgIAIAkgBjoAACAHQQJqIgchBgNAIAYgAk8NAiAGLAAAIQkQuwYaIAlBUGpBCklBAEcgCUEgckGff2pBBklyRQ0CIAZBAWohBgwAAAsACwNAIAYgAk8NASAGLAAAIQkQuwYaIAlBUGpBCk8NASAGQQFqIQYMAAALAAsCQAJ/IAgsAAtBAEgEQCAIKAIEDAELIAgtAAsLRQRAIAogByAGIAUoAgAgCigCACgCIBEIABogBSAFKAIAIAYgB2tqNgIADAELIAcgBhDjBiANIA0oAgAoAhARAAAhDiAHIQkDQCAJIAZPBEAgAyAHIABraiAFKAIAEOMGBQJAAn8gCCwAC0EASARAIAgoAgAMAQsgCAsgC2osAABBAUgNACAMAn8gCCwAC0EASARAIAgoAgAMAQsgCAsgC2osAABHDQAgBSAFKAIAIgxBAWo2AgAgDCAOOgAAIAsgCwJ/IAgsAAtBAEgEQCAIKAIEDAELIAgtAAsLQX9qSWohC0EAIQwLIAogCSwAACAKKAIAKAIcEQMAIQ8gBSAFKAIAIhBBAWo2AgAgECAPOgAAIAlBAWohCSAMQQFqIQwMAQsLCwNAAkAgCgJ/IAYgAkkEQCAGLQAAIgdBLkcNAiANIA0oAgAoAgwRAAAhByAFIAUoAgAiC0EBajYCACALIAc6AAAgBkEBaiEGCyAGCyACIAUoAgAgCigCACgCIBEIABogBSAFKAIAIAIgBmtqIgU2AgAgBCAFIAMgASAAa2ogASACRhs2AgAgCBCHCRogCEEQaiQADwsgCiAHQRh0QRh1IAooAgAoAhwRAwAhByAFIAUoAgAiC0EBajYCACALIAc6AAAgBkEBaiEGDAAACwALpAUBB38jAEGAAmsiACQAIABCJTcD+AEgAEH4AWpBAXJB2r8BIAIoAgQQ6QYhBiAAIABB0AFqNgLMARC7BiEJAn8gBgRAIAIoAgghByAAIAU3A0ggAEFAayAENwMAIAAgBzYCMCAAQdABakEeIAkgAEH4AWogAEEwahDgBgwBCyAAIAQ3A1AgACAFNwNYIABB0AFqQR4gCSAAQfgBaiAAQdAAahDgBgshByAAQb4FNgKAASAAQcABakEAIABBgAFqEJkGIQkCQCAHQR5OBEAQuwYhBwJ/IAYEQCACKAIIIQYgACAFNwMYIAAgBDcDECAAIAY2AgAgAEHMAWogByAAQfgBaiAAEOsGDAELIAAgBDcDICAAIAU3AyggAEHMAWogByAAQfgBaiAAQSBqEOsGCyEHIAAoAswBIghFDQEgCSgCACEGIAkgCDYCACAGBEAgBiAJKAIEEQEACwsgACgCzAEiBiAGIAdqIgogAhDhBiELIABBvgU2AoABIABB+ABqQQAgAEGAAWoQmQYhBgJ/IAAoAswBIABB0AFqRgRAIABBgAFqIQcgAEHQAWoMAQsgB0EBdBDSCSIHRQ0BIAYoAgAhCCAGIAc2AgAgCARAIAggBigCBBEBAAsgACgCzAELIQwgACACKAIcIgg2AmggCCAIKAIEQQFqNgIEIAwgCyAKIAcgAEH0AGogAEHwAGogAEHoAGoQ7AYCfyAAKAJoIgggCCgCBEF/aiIKNgIEIApBf0YLBEAgCCAIKAIAKAIIEQEACyABIAcgACgCdCAAKAJwIAIgAxDgAyECIAYoAgAhASAGQQA2AgAgAQRAIAEgBigCBBEBAAsgCSgCACEBIAlBADYCACABBEAgASAJKAIEEQEACyAAQYACaiQAIAIPCxC1BwAL/AEBBX8jAEHgAGsiACQAIABB5r8BLwAAOwFcIABB4r8BKAAANgJYELsGIQUgACAENgIAIABBQGsgAEFAa0EUIAUgAEHYAGogABDgBiIIIABBQGtqIgUgAhDhBiEGIAAgAigCHCIENgIQIAQgBCgCBEEBajYCBCAAQRBqEJAFIQcCfyAAKAIQIgQgBCgCBEF/aiIJNgIEIAlBf0YLBEAgBCAEKAIAKAIIEQEACyAHIABBQGsgBSAAQRBqIAcoAgAoAiARCAAaIAEgAEEQaiAIIABBEGpqIgEgBiAAayAAakFQaiAFIAZGGyABIAIgAxDgAyEBIABB4ABqJAAgAQukAgEBfyMAQTBrIgUkACAFIAE2AigCQCACKAIEQQFxRQRAIAAgASACIAMgBCAAKAIAKAIYEQYAIQIMAQsgBSACKAIcIgA2AhggACAAKAIEQQFqNgIEIAVBGGoQwQYhAAJ/IAUoAhgiASABKAIEQX9qIgI2AgQgAkF/RgsEQCABIAEoAgAoAggRAQALAkAgBARAIAVBGGogACAAKAIAKAIYEQIADAELIAVBGGogACAAKAIAKAIcEQIACyAFIAVBGGoQ3AY2AhADQCAFIAVBGGoQ8AY2AgggBSgCECAFKAIIRkEBc0UEQCAFKAIoIQIgBUEYahCHCRoMAgsgBUEoaiAFKAIQKAIAELEFIAUgBSgCEEEEajYCEAwAAAsACyAFQTBqJAAgAgtXAQF/IwBBEGsiASQAIAECfyAALAALQQBIBEAgACgCAAwBCyAACwJ/IAAsAAtBAEgEQCAAKAIEDAELIAAtAAsLQQJ0ajYCCCABKAIIIQAgAUEQaiQAIAALmAIBBH8jAEEgayIAJAAgAEHgvwEvAAA7ARwgAEHcvwEoAAA2AhggAEEYakEBckHUvwFBASACKAIEEN8GIAIoAgQhBiAAQXBqIgciCCQAELsGIQUgACAENgIAIAcgByAGQQl2QQFxIgZBDWogBSAAQRhqIAAQ4AYgB2oiBSACEOEGIQQgCCAGQQN0QeAAckELakHwAHFrIggkACAAIAIoAhwiBjYCCCAGIAYoAgRBAWo2AgQgByAEIAUgCCAAQRRqIABBEGogAEEIahDyBgJ/IAAoAggiBSAFKAIEQX9qIgQ2AgQgBEF/RgsEQCAFIAUoAgAoAggRAQALIAEgCCAAKAIUIAAoAhAgAiADEPMGIQEgAEEgaiQAIAEL9AQBCH8jAEEQayIHJAAgBhCdBSELIAcgBhDBBiIGIgggCCgCACgCFBECAAJAAn8gBywAC0EASARAIAcoAgQMAQsgBy0ACwtFBEAgCyAAIAIgAyALKAIAKAIwEQgAGiAFIAMgAiAAa0ECdGoiBjYCAAwBCyAFIAM2AgACQCAAIggtAAAiCUFVaiIKQQJLDQAgCkEBa0UNACALIAlBGHRBGHUgCygCACgCLBEDACEIIAUgBSgCACIJQQRqNgIAIAkgCDYCACAAQQFqIQgLAkAgAiAIa0ECSA0AIAgtAABBMEcNACAILQABQSByQfgARw0AIAtBMCALKAIAKAIsEQMAIQkgBSAFKAIAIgpBBGo2AgAgCiAJNgIAIAsgCCwAASALKAIAKAIsEQMAIQkgBSAFKAIAIgpBBGo2AgAgCiAJNgIAIAhBAmohCAsgCCACEOMGIAYgBigCACgCEBEAACEMQQAhCkEAIQkgCCEGA38gBiACTwR/IAMgCCAAa0ECdGogBSgCABD0BiAFKAIABQJAAn8gBywAC0EASARAIAcoAgAMAQsgBwsgCWotAABFDQAgCgJ/IAcsAAtBAEgEQCAHKAIADAELIAcLIAlqLAAARw0AIAUgBSgCACIKQQRqNgIAIAogDDYCACAJIAkCfyAHLAALQQBIBEAgBygCBAwBCyAHLQALC0F/aklqIQlBACEKCyALIAYsAAAgCygCACgCLBEDACENIAUgBSgCACIOQQRqNgIAIA4gDTYCACAGQQFqIQYgCkEBaiEKDAELCyEGCyAEIAYgAyABIABrQQJ0aiABIAJGGzYCACAHEIcJGiAHQRBqJAAL4wEBBH8jAEEQayIIJAACQCAARQ0AIAQoAgwhBiACIAFrIgdBAU4EQCAAIAEgB0ECdSIHIAAoAgAoAjARBAAgB0cNAQsgBiADIAFrQQJ1IgFrQQAgBiABShsiAUEBTgRAIAACfyAIIAEgBRD1BiIGIgUsAAtBAEgEQCAFKAIADAELIAULIAEgACgCACgCMBEEACEFIAYQhwkaIAEgBUcNAQsgAyACayIBQQFOBEAgACACIAFBAnUiASAAKAIAKAIwEQQAIAFHDQELIAQoAgwaIARBADYCDCAAIQkLIAhBEGokACAJCwkAIAAgARD+BgsbACAAQgA3AgAgAEEANgIIIAAgASACEJgJIAALhwIBBX8jAEEgayIAJAAgAEIlNwMYIABBGGpBAXJB1r8BQQEgAigCBBDfBiACKAIEIQYgAEFgaiIFIgckABC7BiEIIAAgBDcDACAFIAUgBkEJdkEBcSIGQRdqIAggAEEYaiAAEOAGIAVqIgggAhDhBiEJIAcgBkEDdEGwAXJBC2pB8AFxayIGJAAgACACKAIcIgc2AgggByAHKAIEQQFqNgIEIAUgCSAIIAYgAEEUaiAAQRBqIABBCGoQ8gYCfyAAKAIIIgUgBSgCBEF/aiIHNgIEIAdBf0YLBEAgBSAFKAIAKAIIEQEACyABIAYgACgCFCAAKAIQIAIgAxDzBiEBIABBIGokACABC4kCAQR/IwBBIGsiACQAIABB4L8BLwAAOwEcIABB3L8BKAAANgIYIABBGGpBAXJB1L8BQQAgAigCBBDfBiACKAIEIQYgAEFwaiIHIggkABC7BiEFIAAgBDYCACAHIAcgBkEJdkEBcUEMciAFIABBGGogABDgBiAHaiIFIAIQ4QYhBCAIQaB/aiIGJAAgACACKAIcIgg2AgggCCAIKAIEQQFqNgIEIAcgBCAFIAYgAEEUaiAAQRBqIABBCGoQ8gYCfyAAKAIIIgUgBSgCBEF/aiIENgIEIARBf0YLBEAgBSAFKAIAKAIIEQEACyABIAYgACgCFCAAKAIQIAIgAxDzBiEBIABBIGokACABC4YCAQV/IwBBIGsiACQAIABCJTcDGCAAQRhqQQFyQda/AUEAIAIoAgQQ3wYgAigCBCEGIABBYGoiBSIHJAAQuwYhCCAAIAQ3AwAgBSAFIAZBCXZBAXFBFnIiBkEBaiAIIABBGGogABDgBiAFaiIIIAIQ4QYhCSAHIAZBA3RBC2pB8AFxayIGJAAgACACKAIcIgc2AgggByAHKAIEQQFqNgIEIAUgCSAIIAYgAEEUaiAAQRBqIABBCGoQ8gYCfyAAKAIIIgUgBSgCBEF/aiIHNgIEIAdBf0YLBEAgBSAFKAIAKAIIEQEACyABIAYgACgCFCAAKAIQIAIgAxDzBiEBIABBIGokACABC4AFAQd/IwBBgANrIgAkACAAQiU3A/gCIABB+AJqQQFyQdm/ASACKAIEEOkGIQUgACAAQdACajYCzAIQuwYhCAJ/IAUEQCACKAIIIQYgACAEOQMoIAAgBjYCICAAQdACakEeIAggAEH4AmogAEEgahDgBgwBCyAAIAQ5AzAgAEHQAmpBHiAIIABB+AJqIABBMGoQ4AYLIQYgAEG+BTYCUCAAQcACakEAIABB0ABqEJkGIQgCQCAGQR5OBEAQuwYhBgJ/IAUEQCACKAIIIQUgACAEOQMIIAAgBTYCACAAQcwCaiAGIABB+AJqIAAQ6wYMAQsgACAEOQMQIABBzAJqIAYgAEH4AmogAEEQahDrBgshBiAAKALMAiIHRQ0BIAgoAgAhBSAIIAc2AgAgBQRAIAUgCCgCBBEBAAsLIAAoAswCIgUgBSAGaiIJIAIQ4QYhCiAAQb4FNgJQIABByABqQQAgAEHQAGoQmQYhBQJ/IAAoAswCIABB0AJqRgRAIABB0ABqIQYgAEHQAmoMAQsgBkEDdBDSCSIGRQ0BIAUoAgAhByAFIAY2AgAgBwRAIAcgBSgCBBEBAAsgACgCzAILIQsgACACKAIcIgc2AjggByAHKAIEQQFqNgIEIAsgCiAJIAYgAEHEAGogAEFAayAAQThqEPoGAn8gACgCOCIHIAcoAgRBf2oiCTYCBCAJQX9GCwRAIAcgBygCACgCCBEBAAsgASAGIAAoAkQgACgCQCACIAMQ8wYhAiAFKAIAIQEgBUEANgIAIAEEQCABIAUoAgQRAQALIAgoAgAhASAIQQA2AgAgAQRAIAEgCCgCBBEBAAsgAEGAA2okACACDwsQtQcAC4oHAQp/IwBBEGsiCSQAIAYQnQUhCiAJIAYQwQYiDSIGIAYoAgAoAhQRAgAgBSADNgIAAkAgACIHLQAAIgZBVWoiCEECSw0AIAhBAWtFDQAgCiAGQRh0QRh1IAooAgAoAiwRAwAhBiAFIAUoAgAiB0EEajYCACAHIAY2AgAgAEEBaiEHCwJAAkAgAiAHIgZrQQFMDQAgBy0AAEEwRw0AIActAAFBIHJB+ABHDQAgCkEwIAooAgAoAiwRAwAhBiAFIAUoAgAiCEEEajYCACAIIAY2AgAgCiAHLAABIAooAgAoAiwRAwAhBiAFIAUoAgAiCEEEajYCACAIIAY2AgAgB0ECaiIHIQYDQCAGIAJPDQIgBiwAACEIELsGGiAIQVBqQQpJQQBHIAhBIHJBn39qQQZJckUNAiAGQQFqIQYMAAALAAsDQCAGIAJPDQEgBiwAACEIELsGGiAIQVBqQQpPDQEgBkEBaiEGDAAACwALAkACfyAJLAALQQBIBEAgCSgCBAwBCyAJLQALC0UEQCAKIAcgBiAFKAIAIAooAgAoAjARCAAaIAUgBSgCACAGIAdrQQJ0ajYCAAwBCyAHIAYQ4wYgDSANKAIAKAIQEQAAIQ4gByEIA0AgCCAGTwRAIAMgByAAa0ECdGogBSgCABD0BgUCQAJ/IAksAAtBAEgEQCAJKAIADAELIAkLIAtqLAAAQQFIDQAgDAJ/IAksAAtBAEgEQCAJKAIADAELIAkLIAtqLAAARw0AIAUgBSgCACIMQQRqNgIAIAwgDjYCACALIAsCfyAJLAALQQBIBEAgCSgCBAwBCyAJLQALC0F/aklqIQtBACEMCyAKIAgsAAAgCigCACgCLBEDACEPIAUgBSgCACIQQQRqNgIAIBAgDzYCACAIQQFqIQggDEEBaiEMDAELCwsCQAJAA0AgBiACTw0BIAYtAAAiB0EuRwRAIAogB0EYdEEYdSAKKAIAKAIsEQMAIQcgBSAFKAIAIgtBBGo2AgAgCyAHNgIAIAZBAWohBgwBCwsgDSANKAIAKAIMEQAAIQcgBSAFKAIAIgtBBGoiCDYCACALIAc2AgAgBkEBaiEGDAELIAUoAgAhCAsgCiAGIAIgCCAKKAIAKAIwEQgAGiAFIAUoAgAgAiAGa0ECdGoiBTYCACAEIAUgAyABIABrQQJ0aiABIAJGGzYCACAJEIcJGiAJQRBqJAALpAUBB38jAEGwA2siACQAIABCJTcDqAMgAEGoA2pBAXJB2r8BIAIoAgQQ6QYhBiAAIABBgANqNgL8AhC7BiEJAn8gBgRAIAIoAgghByAAIAU3A0ggAEFAayAENwMAIAAgBzYCMCAAQYADakEeIAkgAEGoA2ogAEEwahDgBgwBCyAAIAQ3A1AgACAFNwNYIABBgANqQR4gCSAAQagDaiAAQdAAahDgBgshByAAQb4FNgKAASAAQfACakEAIABBgAFqEJkGIQkCQCAHQR5OBEAQuwYhBwJ/IAYEQCACKAIIIQYgACAFNwMYIAAgBDcDECAAIAY2AgAgAEH8AmogByAAQagDaiAAEOsGDAELIAAgBDcDICAAIAU3AyggAEH8AmogByAAQagDaiAAQSBqEOsGCyEHIAAoAvwCIghFDQEgCSgCACEGIAkgCDYCACAGBEAgBiAJKAIEEQEACwsgACgC/AIiBiAGIAdqIgogAhDhBiELIABBvgU2AoABIABB+ABqQQAgAEGAAWoQmQYhBgJ/IAAoAvwCIABBgANqRgRAIABBgAFqIQcgAEGAA2oMAQsgB0EDdBDSCSIHRQ0BIAYoAgAhCCAGIAc2AgAgCARAIAggBigCBBEBAAsgACgC/AILIQwgACACKAIcIgg2AmggCCAIKAIEQQFqNgIEIAwgCyAKIAcgAEH0AGogAEHwAGogAEHoAGoQ+gYCfyAAKAJoIgggCCgCBEF/aiIKNgIEIApBf0YLBEAgCCAIKAIAKAIIEQEACyABIAcgACgCdCAAKAJwIAIgAxDzBiECIAYoAgAhASAGQQA2AgAgAQRAIAEgBigCBBEBAAsgCSgCACEBIAlBADYCACABBEAgASAJKAIEEQEACyAAQbADaiQAIAIPCxC1BwALiQIBBX8jAEHQAWsiACQAIABB5r8BLwAAOwHMASAAQeK/ASgAADYCyAEQuwYhBSAAIAQ2AgAgAEGwAWogAEGwAWpBFCAFIABByAFqIAAQ4AYiCCAAQbABamoiBSACEOEGIQYgACACKAIcIgQ2AhAgBCAEKAIEQQFqNgIEIABBEGoQnQUhBwJ/IAAoAhAiBCAEKAIEQX9qIgk2AgQgCUF/RgsEQCAEIAQoAgAoAggRAQALIAcgAEGwAWogBSAAQRBqIAcoAgAoAjARCAAaIAEgAEEQaiAAQRBqIAhBAnRqIgEgBiAAa0ECdCAAakHQemogBSAGRhsgASACIAMQ8wYhASAAQdABaiQAIAELLQACQCAAIAFGDQADQCAAIAFBf2oiAU8NASAAIAEQsAcgAEEBaiEADAAACwALCy0AAkAgACABRg0AA0AgACABQXxqIgFPDQEgACABELUFIABBBGohAAwAAAsACwuKBQEDfyMAQSBrIggkACAIIAI2AhAgCCABNgIYIAggAygCHCIBNgIIIAEgASgCBEEBajYCBCAIQQhqEJAFIQkCfyAIKAIIIgEgASgCBEF/aiICNgIEIAJBf0YLBEAgASABKAIAKAIIEQEACyAEQQA2AgBBACECAkADQCAGIAdGDQEgAg0BAkAgCEEYaiAIQRBqEJQFDQACQCAJIAYsAABBACAJKAIAKAIkEQQAQSVGBEAgBkEBaiICIAdGDQJBACEKAn8CQCAJIAIsAABBACAJKAIAKAIkEQQAIgFBxQBGDQAgAUH/AXFBMEYNACAGIQIgAQwBCyAGQQJqIAdGDQMgASEKIAkgBiwAAkEAIAkoAgAoAiQRBAALIQEgCCAAIAgoAhggCCgCECADIAQgBSABIAogACgCACgCJBEOADYCGCACQQJqIQYMAQsgBiwAACIBQQBOBH8gCSgCCCABQf8BcUEBdGovAQBBgMAAcQVBAAsEQANAAkAgByAGQQFqIgZGBEAgByEGDAELIAYsAAAiAUEATgR/IAkoAgggAUH/AXFBAXRqLwEAQYDAAHEFQQALDQELCwNAIAhBGGogCEEQahCRBUUNAiAIQRhqEJIFIgFBAE4EfyAJKAIIIAFB/wFxQQF0ai8BAEGAwABxQQBHBUEAC0UNAiAIQRhqEJMFGgwAAAsACyAJIAhBGGoQkgUgCSgCACgCDBEDACAJIAYsAAAgCSgCACgCDBEDAEYEQCAGQQFqIQYgCEEYahCTBRoMAQsgBEEENgIACyAEKAIAIQIMAQsLIARBBDYCAAsgCEEYaiAIQRBqEJQFBEAgBCAEKAIAQQJyNgIACyAIKAIYIQAgCEEgaiQAIAALBABBAgtBAQF/IwBBEGsiBiQAIAZCpZDpqdLJzpLTADcDCCAAIAEgAiADIAQgBSAGQQhqIAZBEGoQ/wYhACAGQRBqJAAgAAtsACAAIAEgAiADIAQgBQJ/IABBCGogACgCCCgCFBEAACIAIgEsAAtBAEgEQCABKAIADAELIAELAn8gACwAC0EASARAIAAoAgAMAQsgAAsCfyAALAALQQBIBEAgACgCBAwBCyAALQALC2oQ/wYLhQEBAn8jAEEQayIGJAAgBiABNgIIIAYgAygCHCIBNgIAIAEgASgCBEEBajYCBCAGEJAFIQMCfyAGKAIAIgEgASgCBEF/aiIHNgIEIAdBf0YLBEAgASABKAIAKAIIEQEACyAAIAVBGGogBkEIaiACIAQgAxCEByAGKAIIIQAgBkEQaiQAIAALQAAgAiADIABBCGogACgCCCgCABEAACIAIABBqAFqIAUgBEEAEJcGIABrIgBBpwFMBEAgASAAQQxtQQdvNgIACwuFAQECfyMAQRBrIgYkACAGIAE2AgggBiADKAIcIgE2AgAgASABKAIEQQFqNgIEIAYQkAUhAwJ/IAYoAgAiASABKAIEQX9qIgc2AgQgB0F/RgsEQCABIAEoAgAoAggRAQALIAAgBUEQaiAGQQhqIAIgBCADEIYHIAYoAgghACAGQRBqJAAgAAtAACACIAMgAEEIaiAAKAIIKAIEEQAAIgAgAEGgAmogBSAEQQAQlwYgAGsiAEGfAkwEQCABIABBDG1BDG82AgALC4MBAQF/IwBBEGsiACQAIAAgATYCCCAAIAMoAhwiATYCACABIAEoAgRBAWo2AgQgABCQBSEDAn8gACgCACIBIAEoAgRBf2oiBjYCBCAGQX9GCwRAIAEgASgCACgCCBEBAAsgBUEUaiAAQQhqIAIgBCADEIgHIAAoAgghASAAQRBqJAAgAQtCACABIAIgAyAEQQQQiQchASADLQAAQQRxRQRAIAAgAUHQD2ogAUHsDmogASABQeQASBsgAUHFAEgbQZRxajYCAAsLqgIBA38jAEEQayIFJAAgBSABNgIIAkAgACAFQQhqEJQFBEAgAiACKAIAQQZyNgIAQQAhAQwBCyAAEJIFIgEiBkEATgR/IAMoAgggBkH/AXFBAXRqLwEAQYAQcUEARwVBAAtFBEAgAiACKAIAQQRyNgIAQQAhAQwBCyADIAFBACADKAIAKAIkEQQAIQEDQAJAIAFBUGohASAAEJMFGiAAIAVBCGoQkQUhBiAEQQJIDQAgBkUNACAAEJIFIgYiB0EATgR/IAMoAgggB0H/AXFBAXRqLwEAQYAQcUEARwVBAAtFDQIgBEF/aiEEIAMgBkEAIAMoAgAoAiQRBAAgAUEKbGohAQwBCwsgACAFQQhqEJQFRQ0AIAIgAigCAEECcjYCAAsgBUEQaiQAIAEL4AgBA38jAEEgayIHJAAgByABNgIYIARBADYCACAHIAMoAhwiCDYCCCAIIAgoAgRBAWo2AgQgB0EIahCQBSEIAn8gBygCCCIJIAkoAgRBf2oiCjYCBCAKQX9GCwRAIAkgCSgCACgCCBEBAAsCfwJAAkAgBkG/f2oiCUE4SwRAIAZBJUcNASAHQRhqIAIgBCAIEIsHDAILAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkAgCUEBaw44ARYEFgUWBgcWFhYKFhYWFg4PEBYWFhMVFhYWFhYWFgABAgMDFhYBFggWFgkLFgwWDRYLFhYREhQACyAAIAVBGGogB0EYaiACIAQgCBCEBwwWCyAAIAVBEGogB0EYaiACIAQgCBCGBwwVCyAAQQhqIAAoAggoAgwRAAAhASAHIAAgBygCGCACIAMgBCAFAn8gASIALAALQQBIBEAgACgCAAwBCyAACwJ/IAAsAAtBAEgEQCAAKAIADAELIAALAn8gACwAC0EASARAIAAoAgQMAQsgAC0ACwtqEP8GNgIYDBQLIAVBDGogB0EYaiACIAQgCBCMBwwTCyAHQqXavanC7MuS+QA3AwggByAAIAEgAiADIAQgBSAHQQhqIAdBEGoQ/wY2AhgMEgsgB0KlsrWp0q3LkuQANwMIIAcgACABIAIgAyAEIAUgB0EIaiAHQRBqEP8GNgIYDBELIAVBCGogB0EYaiACIAQgCBCNBwwQCyAFQQhqIAdBGGogAiAEIAgQjgcMDwsgBUEcaiAHQRhqIAIgBCAIEI8HDA4LIAVBEGogB0EYaiACIAQgCBCQBwwNCyAFQQRqIAdBGGogAiAEIAgQkQcMDAsgB0EYaiACIAQgCBCSBwwLCyAAIAVBCGogB0EYaiACIAQgCBCTBwwKCyAHQe+/ASgAADYADyAHQei/ASkAADcDCCAHIAAgASACIAMgBCAFIAdBCGogB0ETahD/BjYCGAwJCyAHQfe/AS0AADoADCAHQfO/ASgAADYCCCAHIAAgASACIAMgBCAFIAdBCGogB0ENahD/BjYCGAwICyAFIAdBGGogAiAEIAgQlAcMBwsgB0KlkOmp0snOktMANwMIIAcgACABIAIgAyAEIAUgB0EIaiAHQRBqEP8GNgIYDAYLIAVBGGogB0EYaiACIAQgCBCVBwwFCyAAIAEgAiADIAQgBSAAKAIAKAIUEQkADAULIABBCGogACgCCCgCGBEAACEBIAcgACAHKAIYIAIgAyAEIAUCfyABIgAsAAtBAEgEQCAAKAIADAELIAALAn8gACwAC0EASARAIAAoAgAMAQsgAAsCfyAALAALQQBIBEAgACgCBAwBCyAALQALC2oQ/wY2AhgMAwsgBUEUaiAHQRhqIAIgBCAIEIgHDAILIAVBFGogB0EYaiACIAQgCBCWBwwBCyAEIAQoAgBBBHI2AgALIAcoAhgLIQAgB0EgaiQAIAALbwEBfyMAQRBrIgQkACAEIAE2AghBBiEBAkACQCAAIARBCGoQlAUNAEEEIQEgAyAAEJIFQQAgAygCACgCJBEEAEElRw0AQQIhASAAEJMFIARBCGoQlAVFDQELIAIgAigCACABcjYCAAsgBEEQaiQACz4AIAEgAiADIARBAhCJByEBIAMoAgAhAgJAIAFBf2pBHksNACACQQRxDQAgACABNgIADwsgAyACQQRyNgIACzsAIAEgAiADIARBAhCJByEBIAMoAgAhAgJAIAFBF0oNACACQQRxDQAgACABNgIADwsgAyACQQRyNgIACz4AIAEgAiADIARBAhCJByEBIAMoAgAhAgJAIAFBf2pBC0sNACACQQRxDQAgACABNgIADwsgAyACQQRyNgIACzwAIAEgAiADIARBAxCJByEBIAMoAgAhAgJAIAFB7QJKDQAgAkEEcQ0AIAAgATYCAA8LIAMgAkEEcjYCAAs+ACABIAIgAyAEQQIQiQchASADKAIAIQICQCABQQxKDQAgAkEEcQ0AIAAgAUF/ajYCAA8LIAMgAkEEcjYCAAs7ACABIAIgAyAEQQIQiQchASADKAIAIQICQCABQTtKDQAgAkEEcQ0AIAAgATYCAA8LIAMgAkEEcjYCAAt9AQF/IwBBEGsiBCQAIAQgATYCCANAAkAgACAEQQhqEJEFRQ0AIAAQkgUiAUEATgR/IAMoAgggAUH/AXFBAXRqLwEAQYDAAHFBAEcFQQALRQ0AIAAQkwUaDAELCyAAIARBCGoQlAUEQCACIAIoAgBBAnI2AgALIARBEGokAAuuAQEBfwJ/IABBCGogACgCCCgCCBEAACIAIgYsAAtBAEgEQCAGKAIEDAELIAYtAAsLQQACfyAALAAXQQBIBEAgACgCEAwBCyAALQAXC2tGBEAgBCAEKAIAQQRyNgIADwsgAiADIAAgAEEYaiAFIARBABCXBiAAayEAAkAgASgCACICQQxHDQAgAA0AIAFBADYCAA8LAkAgAkELSg0AIABBDEcNACABIAJBDGo2AgALCzsAIAEgAiADIARBAhCJByEBIAMoAgAhAgJAIAFBPEoNACACQQRxDQAgACABNgIADwsgAyACQQRyNgIACzsAIAEgAiADIARBARCJByEBIAMoAgAhAgJAIAFBBkoNACACQQRxDQAgACABNgIADwsgAyACQQRyNgIACygAIAEgAiADIARBBBCJByEBIAMtAABBBHFFBEAgACABQZRxajYCAAsLnAUBA38jAEEgayIIJAAgCCACNgIQIAggATYCGCAIIAMoAhwiATYCCCABIAEoAgRBAWo2AgQgCEEIahCdBSEJAn8gCCgCCCIBIAEoAgRBf2oiAjYCBCACQX9GCwRAIAEgASgCACgCCBEBAAsgBEEANgIAQQAhAgJAA0AgBiAHRg0BIAINAQJAIAhBGGogCEEQahCgBQ0AAkAgCSAGKAIAQQAgCSgCACgCNBEEAEElRgRAIAZBBGoiAiAHRg0CQQAhCgJ/AkAgCSACKAIAQQAgCSgCACgCNBEEACIBQcUARg0AIAFB/wFxQTBGDQAgBiECIAEMAQsgBkEIaiAHRg0DIAEhCiAJIAYoAghBACAJKAIAKAI0EQQACyEBIAggACAIKAIYIAgoAhAgAyAEIAUgASAKIAAoAgAoAiQRDgA2AhggAkEIaiEGDAELIAlBgMAAIAYoAgAgCSgCACgCDBEEAARAA0ACQCAHIAZBBGoiBkYEQCAHIQYMAQsgCUGAwAAgBigCACAJKAIAKAIMEQQADQELCwNAIAhBGGogCEEQahCeBUUNAiAJQYDAAAJ/IAgoAhgiASgCDCICIAEoAhBGBEAgASABKAIAKAIkEQAADAELIAIoAgALIAkoAgAoAgwRBABFDQIgCEEYahCfBRoMAAALAAsgCQJ/IAgoAhgiASgCDCICIAEoAhBGBEAgASABKAIAKAIkEQAADAELIAIoAgALIAkoAgAoAhwRAwAgCSAGKAIAIAkoAgAoAhwRAwBGBEAgBkEEaiEGIAhBGGoQnwUaDAELIARBBDYCAAsgBCgCACECDAELCyAEQQQ2AgALIAhBGGogCEEQahCgBQRAIAQgBCgCAEECcjYCAAsgCCgCGCEAIAhBIGokACAAC14BAX8jAEEgayIGJAAgBkGowQEpAwA3AxggBkGgwQEpAwA3AxAgBkGYwQEpAwA3AwggBkGQwQEpAwA3AwAgACABIAIgAyAEIAUgBiAGQSBqEJcHIQAgBkEgaiQAIAALbwAgACABIAIgAyAEIAUCfyAAQQhqIAAoAggoAhQRAAAiACIBLAALQQBIBEAgASgCAAwBCyABCwJ/IAAsAAtBAEgEQCAAKAIADAELIAALAn8gACwAC0EASARAIAAoAgQMAQsgAC0ACwtBAnRqEJcHC4UBAQJ/IwBBEGsiBiQAIAYgATYCCCAGIAMoAhwiATYCACABIAEoAgRBAWo2AgQgBhCdBSEDAn8gBigCACIBIAEoAgRBf2oiBzYCBCAHQX9GCwRAIAEgASgCACgCCBEBAAsgACAFQRhqIAZBCGogAiAEIAMQmwcgBigCCCEAIAZBEGokACAAC0AAIAIgAyAAQQhqIAAoAggoAgARAAAiACAAQagBaiAFIARBABDCBiAAayIAQacBTARAIAEgAEEMbUEHbzYCAAsLhQEBAn8jAEEQayIGJAAgBiABNgIIIAYgAygCHCIBNgIAIAEgASgCBEEBajYCBCAGEJ0FIQMCfyAGKAIAIgEgASgCBEF/aiIHNgIEIAdBf0YLBEAgASABKAIAKAIIEQEACyAAIAVBEGogBkEIaiACIAQgAxCdByAGKAIIIQAgBkEQaiQAIAALQAAgAiADIABBCGogACgCCCgCBBEAACIAIABBoAJqIAUgBEEAEMIGIABrIgBBnwJMBEAgASAAQQxtQQxvNgIACwuDAQEBfyMAQRBrIgAkACAAIAE2AgggACADKAIcIgE2AgAgASABKAIEQQFqNgIEIAAQnQUhAwJ/IAAoAgAiASABKAIEQX9qIgY2AgQgBkF/RgsEQCABIAEoAgAoAggRAQALIAVBFGogAEEIaiACIAQgAxCfByAAKAIIIQEgAEEQaiQAIAELQgAgASACIAMgBEEEEKAHIQEgAy0AAEEEcUUEQCAAIAFB0A9qIAFB7A5qIAEgAUHkAEgbIAFBxQBIG0GUcWo2AgALC9ACAQN/IwBBEGsiBiQAIAYgATYCCAJAIAAgBkEIahCgBQRAIAIgAigCAEEGcjYCAEEAIQEMAQsgA0GAEAJ/IAAoAgAiASgCDCIFIAEoAhBGBEAgASABKAIAKAIkEQAADAELIAUoAgALIgEgAygCACgCDBEEAEUEQCACIAIoAgBBBHI2AgBBACEBDAELIAMgAUEAIAMoAgAoAjQRBAAhAQNAAkAgAUFQaiEBIAAQnwUaIAAgBkEIahCeBSEFIARBAkgNACAFRQ0AIANBgBACfyAAKAIAIgUoAgwiByAFKAIQRgRAIAUgBSgCACgCJBEAAAwBCyAHKAIACyIFIAMoAgAoAgwRBABFDQIgBEF/aiEEIAMgBUEAIAMoAgAoAjQRBAAgAUEKbGohAQwBCwsgACAGQQhqEKAFRQ0AIAIgAigCAEECcjYCAAsgBkEQaiQAIAELswkBA38jAEFAaiIHJAAgByABNgI4IARBADYCACAHIAMoAhwiCDYCACAIIAgoAgRBAWo2AgQgBxCdBSEIAn8gBygCACIJIAkoAgRBf2oiCjYCBCAKQX9GCwRAIAkgCSgCACgCCBEBAAsCfwJAAkAgBkG/f2oiCUE4SwRAIAZBJUcNASAHQThqIAIgBCAIEKIHDAILAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkAgCUEBaw44ARYEFgUWBgcWFhYKFhYWFg4PEBYWFhMVFhYWFhYWFgABAgMDFhYBFggWFgkLFgwWDRYLFhYREhQACyAAIAVBGGogB0E4aiACIAQgCBCbBwwWCyAAIAVBEGogB0E4aiACIAQgCBCdBwwVCyAAQQhqIAAoAggoAgwRAAAhASAHIAAgBygCOCACIAMgBCAFAn8gASIALAALQQBIBEAgACgCAAwBCyAACwJ/IAAsAAtBAEgEQCAAKAIADAELIAALAn8gACwAC0EASARAIAAoAgQMAQsgAC0ACwtBAnRqEJcHNgI4DBQLIAVBDGogB0E4aiACIAQgCBCjBwwTCyAHQZjAASkDADcDGCAHQZDAASkDADcDECAHQYjAASkDADcDCCAHQYDAASkDADcDACAHIAAgASACIAMgBCAFIAcgB0EgahCXBzYCOAwSCyAHQbjAASkDADcDGCAHQbDAASkDADcDECAHQajAASkDADcDCCAHQaDAASkDADcDACAHIAAgASACIAMgBCAFIAcgB0EgahCXBzYCOAwRCyAFQQhqIAdBOGogAiAEIAgQpAcMEAsgBUEIaiAHQThqIAIgBCAIEKUHDA8LIAVBHGogB0E4aiACIAQgCBCmBwwOCyAFQRBqIAdBOGogAiAEIAgQpwcMDQsgBUEEaiAHQThqIAIgBCAIEKgHDAwLIAdBOGogAiAEIAgQqQcMCwsgACAFQQhqIAdBOGogAiAEIAgQqgcMCgsgB0HAwAFBLBDeCSIGIAAgASACIAMgBCAFIAYgBkEsahCXBzYCOAwJCyAHQYDBASgCADYCECAHQfjAASkDADcDCCAHQfDAASkDADcDACAHIAAgASACIAMgBCAFIAcgB0EUahCXBzYCOAwICyAFIAdBOGogAiAEIAgQqwcMBwsgB0GowQEpAwA3AxggB0GgwQEpAwA3AxAgB0GYwQEpAwA3AwggB0GQwQEpAwA3AwAgByAAIAEgAiADIAQgBSAHIAdBIGoQlwc2AjgMBgsgBUEYaiAHQThqIAIgBCAIEKwHDAULIAAgASACIAMgBCAFIAAoAgAoAhQRCQAMBQsgAEEIaiAAKAIIKAIYEQAAIQEgByAAIAcoAjggAiADIAQgBQJ/IAEiACwAC0EASARAIAAoAgAMAQsgAAsCfyAALAALQQBIBEAgACgCAAwBCyAACwJ/IAAsAAtBAEgEQCAAKAIEDAELIAAtAAsLQQJ0ahCXBzYCOAwDCyAFQRRqIAdBOGogAiAEIAgQnwcMAgsgBUEUaiAHQThqIAIgBCAIEK0HDAELIAQgBCgCAEEEcjYCAAsgBygCOAshACAHQUBrJAAgAAuWAQEDfyMAQRBrIgQkACAEIAE2AghBBiEBAkACQCAAIARBCGoQoAUNAEEEIQEgAwJ/IAAoAgAiBSgCDCIGIAUoAhBGBEAgBSAFKAIAKAIkEQAADAELIAYoAgALQQAgAygCACgCNBEEAEElRw0AQQIhASAAEJ8FIARBCGoQoAVFDQELIAIgAigCACABcjYCAAsgBEEQaiQACz4AIAEgAiADIARBAhCgByEBIAMoAgAhAgJAIAFBf2pBHksNACACQQRxDQAgACABNgIADwsgAyACQQRyNgIACzsAIAEgAiADIARBAhCgByEBIAMoAgAhAgJAIAFBF0oNACACQQRxDQAgACABNgIADwsgAyACQQRyNgIACz4AIAEgAiADIARBAhCgByEBIAMoAgAhAgJAIAFBf2pBC0sNACACQQRxDQAgACABNgIADwsgAyACQQRyNgIACzwAIAEgAiADIARBAxCgByEBIAMoAgAhAgJAIAFB7QJKDQAgAkEEcQ0AIAAgATYCAA8LIAMgAkEEcjYCAAs+ACABIAIgAyAEQQIQoAchASADKAIAIQICQCABQQxKDQAgAkEEcQ0AIAAgAUF/ajYCAA8LIAMgAkEEcjYCAAs7ACABIAIgAyAEQQIQoAchASADKAIAIQICQCABQTtKDQAgAkEEcQ0AIAAgATYCAA8LIAMgAkEEcjYCAAuQAQECfyMAQRBrIgQkACAEIAE2AggDQAJAIAAgBEEIahCeBUUNACADQYDAAAJ/IAAoAgAiASgCDCIFIAEoAhBGBEAgASABKAIAKAIkEQAADAELIAUoAgALIAMoAgAoAgwRBABFDQAgABCfBRoMAQsLIAAgBEEIahCgBQRAIAIgAigCAEECcjYCAAsgBEEQaiQAC64BAQF/An8gAEEIaiAAKAIIKAIIEQAAIgAiBiwAC0EASARAIAYoAgQMAQsgBi0ACwtBAAJ/IAAsABdBAEgEQCAAKAIQDAELIAAtABcLa0YEQCAEIAQoAgBBBHI2AgAPCyACIAMgACAAQRhqIAUgBEEAEMIGIABrIQACQCABKAIAIgJBDEcNACAADQAgAUEANgIADwsCQCACQQtKDQAgAEEMRw0AIAEgAkEMajYCAAsLOwAgASACIAMgBEECEKAHIQEgAygCACECAkAgAUE8Sg0AIAJBBHENACAAIAE2AgAPCyADIAJBBHI2AgALOwAgASACIAMgBEEBEKAHIQEgAygCACECAkAgAUEGSg0AIAJBBHENACAAIAE2AgAPCyADIAJBBHI2AgALKAAgASACIAMgBEEEEKAHIQEgAy0AAEEEcUUEQCAAIAFBlHFqNgIACwtKACMAQYABayICJAAgAiACQfQAajYCDCAAQQhqIAJBEGogAkEMaiAEIAUgBhCvByACQRBqIAIoAgwgARCxByEAIAJBgAFqJAAgAAtiAQF/IwBBEGsiBiQAIAZBADoADyAGIAU6AA4gBiAEOgANIAZBJToADCAFBEAgBkENaiAGQQ5qELAHCyACIAEgAigCACABayAGQQxqIAMgACgCABAdIAFqNgIAIAZBEGokAAs1AQF/IwBBEGsiAiQAIAIgAC0AADoADyAAIAEtAAA6AAAgASACQQ9qLQAAOgAAIAJBEGokAAtFAQF/IwBBEGsiAyQAIAMgAjYCCANAIAAgAUcEQCADQQhqIAAsAAAQrwUgAEEBaiEADAELCyADKAIIIQAgA0EQaiQAIAALSgAjAEGgA2siAiQAIAIgAkGgA2o2AgwgAEEIaiACQRBqIAJBDGogBCAFIAYQswcgAkEQaiACKAIMIAEQtgchACACQaADaiQAIAALfwEBfyMAQZABayIGJAAgBiAGQYQBajYCHCAAIAZBIGogBkEcaiADIAQgBRCvByAGQgA3AxAgBiAGQSBqNgIMIAEgBkEMaiACKAIAIAFrQQJ1IAZBEGogACgCABC0ByIAQX9GBEAQtQcACyACIAEgAEECdGo2AgAgBkGQAWokAAtjAQF/IwBBEGsiBSQAIAUgBDYCDCAFQQhqIAVBDGoQvwYhBCAAIAEgAiADEIMGIQEgBCgCACIABEBBiPACKAIAGiAABEBBiPACQbz7AiAAIABBf0YbNgIACwsgBUEQaiQAIAELBQAQHgALRQEBfyMAQRBrIgMkACADIAI2AggDQCAAIAFHBEAgA0EIaiAAKAIAELEFIABBBGohAAwBCwsgAygCCCEAIANBEGokACAACwUAQf8ACwgAIAAQngYaCxUAIABCADcCACAAQQA2AgggABCRCQsMACAAQYKGgCA2AAALCABB/////wcLDAAgAEEBQS0Q9QYaC+0EAQF/IwBBoAJrIgAkACAAIAE2ApgCIAAgAjYCkAIgAEG/BTYCECAAQZgBaiAAQaABaiAAQRBqEJkGIQcgACAEKAIcIgE2ApABIAEgASgCBEEBajYCBCAAQZABahCQBSEBIABBADoAjwECQCAAQZgCaiACIAMgAEGQAWogBCgCBCAFIABBjwFqIAEgByAAQZQBaiAAQYQCahC+B0UNACAAQbvBASgAADYAhwEgAEG0wQEpAAA3A4ABIAEgAEGAAWogAEGKAWogAEH2AGogASgCACgCIBEIABogAEG+BTYCECAAQQhqQQAgAEEQahCZBiEBIABBEGohAgJAIAAoApQBIAcoAgBrQeMATgRAIAAoApQBIAcoAgBrQQJqENIJIQMgASgCACECIAEgAzYCACACBEAgAiABKAIEEQEACyABKAIARQ0BIAEoAgAhAgsgAC0AjwEEQCACQS06AAAgAkEBaiECCyAHKAIAIQQDQAJAIAQgACgClAFPBEAgAkEAOgAAIAAgBjYCACAAQRBqIAAQ/QVBAUcNASABKAIAIQIgAUEANgIAIAIEQCACIAEoAgQRAQALDAQLIAIgAEH2AGogAEGAAWogBBC+BiAAayAAai0ACjoAACACQQFq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IAECfyAALAALQQBIBEAgACgCAAwBCyAACwJ/IAAsAAtBAEgEQCAAKAIEDAELIAAtAAsLQQJ0akkgByABTXELBEAgAAJ/An8gA0IANwIAIANBADYCCCADIAEgAhCTBiADIgAsAAtBAEgLBEAgACgCAAwBCyAACwJ/IAMsAAtBAEgEQCADKAIEDAELIAMtAAsLEJYJIAMQhwkaDAELIAQgBWsgBkkEQCAAIAQgBSAGaiAEayAFIAUQlQkLAn8gACwAC0EASARAIAAoAgAMAQsgAAsgBUECdGohBANAIAEgAkcEQCAEIAEoAgA2AgAgAUEEaiEBIARBBGohBAwBCwsgA0EANgIAIAQgAygCADYCACAFIAZqIQECQCAALAALQQBIBEAgACABNgIEDAELIAAgAToACwsLIANBEGokAAsLACAAQYSVAxCYBgsgACAAEPoIIAAgASgCCDYCCCAAIAEpAgA3AgAgARC9BgsLACAAQfyUAxCYBgt+AQF/IwBBIGsiAyQAIAMgATYCECADIAA2AhggAyACNgIIA0ACQAJ/QQEgAygCGCADKAIQRkEBc0UNABogAygCGCgCACADKAIIKAIARg0BQQALIQAgA0EgaiQAIAAPCyADIAMoAhhBBGo2AhggAyADKAIIQQRqNgIIDAAACwALNwEBfyMAQRBrIgIkACACIAAoAgA2AgggAiACKAIIIAFBAnRqNgIIIAIoAgghACACQRBqJAAgAAv0BgELfyMAQdADayIAJAAgACAFNwMQIAAgBjcDGCAAIABB4AJqNgLcAiAAQeACaiAAQRBqEP4FIQkgAEG+BTYC8AEgAEHoAWpBACAAQfABahCZBiELIABBvgU2AvABIABB4AFqQQAgAEHwAWoQmQYhCiAAQfABaiEMAkAgCUHkAE8EQBC7BiEHIAAgBTcDACAAIAY3AwggAEHcAmogB0G/wQEgABDrBiEJIAAoAtwCIghFDQEgCygCACEHIAsgCDYCACAHBEAgByALKAIEEQEACyAJENIJIQggCigCACEHIAogCDYCACAHBEAgByAKKAIEEQEACyAKKAIAQQBHQQFzDQEgCigCACEMCyAAIAMoAhwiBzYC2AEgByAHKAIEQQFqNgIEIABB2AFqEJAFIhEiByAAKALcAiIIIAggCWogDCAHKAIAKAIgEQgAGiACAn8gCQRAIAAo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fyMAQRBrIgIkACACIAA2AgwQ6AgiASAATwRAQbCiAygCAEGgogMoAgBrQQJ1IgAgAUEBdkkEQCACIABBAXQ2AggjAEEQayIAJAAgAkEIaiIBKAIAIAJBDGoiAygCAEkhBCAAQRBqJAAgAyABIAQbKAIAIQELIAJBEGokACABDwsQmQkAC24BA38jAEEQayIFJAAgBUEANgIMIABBDGoiBkEANgIAIAYgAzYCBCABBEAgACgCECABEOkIIQQLIAAgBDYCACAAIAQgAkECdGoiAjYCCCAAIAI2AgQgAEEMaiAEIAFBAnRqNgIAIAVBEGokACAACzMBAX8gACgCEBogACgCCCECA0AgAkEANgIAIAAgACgCCEEEaiICNgIIIAFBf2oiAQ0ACwtnAQF/QaCiAxD4B0HAogNBoKIDKAIAQaSiAygCACAAQQRqIgEQ9AhBoKIDIAEQtQVBpKIDIABBCGoQtQVBsKIDIABBDGoQtQUgACAAKAIENgIAQaSiAygCAEGgogMoAgBrQQJ1EOoICygAIAMgAygCACACIAFrIgBrIgI2AgAgAEEBTgRAIAIgASAAEN4JGgsLBwAgACgCBAslAANAIAEgACgCCEcEQCAAKAIQGiAAIAAoAghBfGo2AggMAQsLCzgBAn8gACgCACAAKAIIIgJBAXVqIQEgACgCBCEAIAEgAkEBcQR/IAEoAgAgAGooAgAFIAALEQEACx4AQf////8DIABJBEBB8O4BEPMCAAsgAEECdBCACQtQAQF/IAAQxAcgACwAC0EASARAIAAoAgAhASAALAALQQBIBH8gACgCCEH/////B3FBf2oFQQoLGiABENMJIABBgICAgHg2AgggAEEAOgALCwtQAQF/IAAQ0QcgACwAC0EASARAIAAoAgAhASAALAALQQBIBH8gACgCCEH/////B3FBf2oFQQELGiABENMJIABBgICAgHg2AgggAEEAOgALCws6AgF/AX4jAEEQayIDJAAgAyABIAIQuwYQjAYgAykDACEEIAAgAykDCDcDCCAAIAQ3AwAgA0EQaiQACwMAAAtHAQF/IABBCGoiASgCAEUEQCAAIAAoAgAoAhARAQAPCwJ/IAEgASgCAEF/aiIBNgIAIAFBf0YLBEAgACAAKAIAKAIQEQEACwsEAEEACy4AA0AgACgCAEEBRg0ACyAAKAIARQRAIABBATYCACABQcEFEQEAIABBfzYCAAsLMQECfyAAQQEgABshAANAAkAgABDSCSIBDQBBnKQDKAIAIgJFDQAgAhEHAAwBCwsgAQs6AQJ/IAEQxwQiAkENahCACSIDQQA2AgggAyACNgIEIAMgAjYCACAAIANBDGogASACQQFqEN4JNgIACykBAX8gAgRAIAAhAwNAIAMgATYCACADQQRqIQMgAkF/aiICDQALCyAAC2kBAX8CQCAAIAFrQQJ1IAJJBEADQCAAIAJBf2oiAkECdCIDaiABIANqKAIANgIAIAINAAwCAAsACyACRQ0AIAAhAwNAIAMgASgCADYCACADQQRqIQMgAUEEaiEBIAJBf2oiAg0ACwsgAAsKAEHs8AEQ8wIAC1kBAn8jAEEQayIDJAAgAEIANwIAIABBADYCCCAAIQICQCABLAALQQBOBEAgAiABKAIINgIIIAIgASkCADcCAAwBCyAAIAEoAgAgASgCBBCGCQsgA0EQaiQAC5wBAQN/IwBBEGsiBCQAQW8gAk8EQAJAIAJBCk0EQCAAIAI6AAsgACEDDAELIAAgAkELTwR/IAJBEGpBcHEiAyADQX9qIgMgA0ELRhsFQQoLQQFqIgUQ7AgiAzYCACAAIAVBgICAgHhyNgIIIAAgAjYCBAsgAyABIAIQ/gQgBEEAOgAPIAIgA2ogBC0ADzoAACAEQRBqJAAPCxCECQALHQAgACwAC0EASARAIAAoAggaIAAoAgAQ0wkLIAALyQEBA38jAEEQayIEJAACQCAALAALQQBIBH8gACgCCEH/////B3FBf2oFQQoLIgMgAk8EQAJ/IAAsAAtBAEgEQCAAKAIADAELIAALIgMhBSACBEAgBSABIAIQ4AkLIARBADoADyACIANqIAQtAA86AAACQCAALAALQQBIBEAgACACNgIEDAELIAAgAjoACwsMAQsgACADIAIgA2sCfyAALAALQQBIBEAgACgCBAwBCyAALQALCyIAQQAgACACIAEQiQkLIARBEGokAAvMAgEFfyMAQRBrIggkACABQX9zQW9qIAJPBEACfyAALAALQQBIBEAgACgCAAwBCyAACyEJAn9B5////wcgAUsEQCAIIAFBAXQ2AgggCCABIAJqNgIMAn8jAEEQayICJAAgCEEMaiIKKAIAIAhBCGoiCygCAEkhDCACQRBqJAAg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CCADIAE2AgQgAkF4aiABNgIAIAJBdGogATYCACAEQRlJDQAgAyABNgIYIAMgATYCFCADIAE2AhAgAyABNgIMIAJBcGogATYCACACQWxqIAE2AgAgAkFoaiABNgIAIAJBZGogATYCACAEIANBBHFBGHIiBGsiAkEgSQ0AIAGtIgVCIIYgBYQhBSADIARqIQEDQCABIAU3AxggASAFNwMQIAEgBTcDCCABIAU3AwAgAUEgaiEBIAJBYGoiAkEfSw0ACwsgAAvlAgECfwJAIAAgAUYNAAJAIAEgAmogAEsEQCAAIAJqIgQgAUsNAQsgACABIAIQ3gkaDwsgACABc0EDcSEDAkACQCAAIAFJBEAgAw0CIABBA3FFDQEDQCACRQ0EIAAgAS0AADoAACABQQFqIQEgAkF/aiECIABBAWoiAEEDcQ0ACwwBCwJAIAMNACAEQQNxBEADQCACRQ0FIAAgAkF/aiICaiIDIAEgAmotAAA6AAAgA0EDcQ0ACwsgAkEDTQ0AA0AgACACQXxqIgJqIAEgAmooAgA2AgAgAkEDSw0ACwsgAkUNAgNAIAAgAkF/aiICaiABIAJqLQAAOgAAIAINAAsMAgsgAkEDTQ0AIAIhAwNAIAAgASgCADYCACABQQRqIQEgAEEEaiEAIANBfGoiA0EDSw0ACyACQQNxIQILIAJFDQADQCAAIAEtAAA6AAAgAEEBaiEAIAFBAWohASACQX9qIgINAAsLCx8AQZSoAygCAEUEQEGYqAMgATYCAEGUqAMgADYCAAsLBAAjAAsQACMAIABrQXBxIgAkACAACwYAIAAkAAsGACAAQAALCwAgASACIAARAgALDwAgASACIAMgBCAAEQsACwsAIAEgAiAAEREACw0AIAEgAiADIAARTQALDwAgASACIAMgBCAAERUACxEAIAEgAiADIAQgBSAAEVUACw0AIAEgAiADIAAREgALDwAgASACIAMgBCAAEVIACwsAIAEgAiAAERgACwsAIAEgAiAAEQ8ACw0AIAEgAiADIAARGgALDQAgASACIAMgABEeAAsPACABIAIgAyAEIAARTAALDwAgASACIAMgBCAAERkACw8AIAEgAiADIAQgABFcAAsRACABIAIgAyAEIAUgABFPAAsRACABIAIgAyAEIAUgABFdAAsTACABIAIgAyAEIAUgBiAAEVAACw8AIAEgAiADIAQgABE+AAsRACABIAIgAyAEIAUgABE4AAsRACABIAIgAyAEIAUgABE/AAsTACABIAIgAyAEIAUgBiAAETkACxMAIAEgAiADIAQgBSAGIAARQAALFQAgASACIAMgBCAFIAYgByAAEToACxEAIAEgAiADIAQgBSAAEUIACxMAIAEgAiADIAQgBSAGIAARJwALDwAgASACIAMgBCAAEUYACw0AIAEgAiADIAARQQALDwAgASACIAMgBCAAETsACw8AIAEgAiADIAQgABEIAAsRACABIAIgAyAEIAUgABE9AAsTACABIAIgAyAEIAUgBiAAETYACxMAIAEgAiADIAQgBSAGIAARIAALEwAgASACIAMgBCAFIAYgABFeAAsVACABIAIgAyAEIAUgBiAHIAARVAALFQAgASACIAMgBCAFIAYgByAAEVkACxMAIAEgAiADIAQgBSAGIAARXwALFQAgASACIAMgBCAFIAYgByAAEVcACxcAIAEgAiADIAQgBSAGIAcgCCAAEWEACxkAIAEgAiADIAQgBSAGIAcgCCAJIAARWgALDQAgASACIAMgABEkAAsPACABIAIgAyAEIAARLAALEwAgASACIAMgBCAFIAYgABEuAAsVACABIAIgAyAEIAUgBiAHIAARUQALDwAgASACIAMgBCAAER8ACxEAIAEgAiADIAQgBSAAES0ACw0AIAEgAiADIAARIgALDwAgASACIAMgBCAAETcACxEAIAEgAiADIAQgBSAAEQoACw0AIAEgAiADIAARSAALDwAgASACIAMgBCAAEUcACwkAIAEgABEqAAsLACABIAIgABErAAsPACABIAIgAyAEIAARSgALEQAgASACIAMgBCAFIAARSwALEwAgASACIAMgBCAFIAYgABE0AAsVACABIAIgAyAEIAUgBiAHIAARMwALDQAgASACIAMgABFjAAsPACABIAIgAyAEIAARNQALDwAgASACIAMgBCAAEWgACxEAIAEgAiADIAQgBSAAES8ACxMAIAEgAiADIAQgBSAGIAARUwALEwAgASACIAMgBCAFIAYgABFgAAsVACABIAIgAyAEIAUgBiAHIAARWAALEQAgASACIAMgBCAFIAARMAALEwAgASACIAMgBCAFIAYgABFWAAsLACABIAIgABFqAAsPACABIAIgAyAEIAARWwALEQAgASACIAMgBCAFIAARTgALEwAgASACIAMgBCAFIAYgABFJAAsRACABIAIgAyAEIAUgABEGAAsXACABIAIgAyAEIAUgBiAHIAggABEOAAsTACABIAIgAyAEIAUgBiAAEQkACxEAIAEgAiADIAQgBSAAESgACxUAIAEgAiADIAQgBSAGIAcgABEUAAsTACABIAIgAyAEIAUgBiAAEQ0ACwcAIAARBwALGQAgASACIAOtIAStQiCGhCAFIAYgABEmAAsiAQF+IAEgAq0gA61CIIaEIAQgABEcACIFQiCIpxApIAWnCxkAIAEgAiADIAQgBa0gBq1CIIaEIAARIwALIwAgASACIAMgBCAFrSAGrUIghoQgB60gCK1CIIaEIAARRQALJQAgASACIAMgBCAFIAatIAetQiCGhCAIrSAJrUIghoQgABFEAAsL384CVgBBgAgL8BJWZWN0b3JJbnQAVmVjdG9yRG91YmxlAFZlY3RvckNoYXIAVmVjdG9yVUNoYXIAVmVjdG9yRmxvYXQAdmVjdG9yVG9vbHMAY2xlYXJWZWN0b3JEYmwAY2xlYXJWZWN0b3JGbG9hdABtYXhpU2V0dGluZ3MAc2V0dXAAc2FtcGxlUmF0ZQBjaGFubmVscwBidWZmZXJTaXplAG1heGlPc2MAc2luZXdhdmUAY29zd2F2ZQBwaGFzb3IAc2F3AHRyaWFuZ2xlAHNxdWFyZQBwdWxzZQBpbXB1bHNlAG5vaXNlAHNpbmVidWYAc2luZWJ1ZjQAc2F3bgBwaGFzZVJlc2V0AG1heGlFbnZlbG9wZQBsaW5lAHRyaWdnZXIAYW1wbGl0dWRlAHZhbGluZGV4AG1heGlEZWxheWxpbmUAZGwAbWF4aUZpbHRlcgBsb3JlcwBoaXJlcwBiYW5kcGFzcwBsb3Bhc3MAaGlwYXNzAGN1dG9mZgByZXNvbmFuY2UAbWF4aU1peABzdGVyZW8AcXVhZABhbWJpc29uaWMAbWF4aUxpbmUAcGxheQBwcmVwYXJlAHRyaWdnZXJFbmFibGUAaXNMaW5lQ29tcGxldGUAbWF4aVhGYWRlAHhmYWRlAG1heGlMYWdFeHAAaW5pdABhZGRTYW1wbGUAdmFsdWUAYWxwaGEAYWxwaGFSZWNpcHJvY2FsAHZhbABtYXhpU2FtcGxlAGdldExlbmd0aABzZXRTYW1wbGUAc2V0U2FtcGxlRnJvbU9nZ0Jsb2IAaXNSZWFkeQBwbGF5T25jZQBwbGF5T25aWABwbGF5NABjbGVhcgBub3JtYWxpc2UAYXV0b1RyaW0AbG9hZAByZWFkAGxvb3BTZXRQb3NPblpYAG1heGlNYXAAbGlubGluAGxpbmV4cABleHBsaW4AY2xhbXAAbWF4aUR5bgBnYXRlAGNvbXByZXNzb3IAY29tcHJlc3MAc2V0QXR0YWNrAHNldFJlbGVhc2UAc2V0VGhyZXNob2xkAHNldFJhdGlvAG1heGlFbnYAYXIAYWRzcgBzZXREZWNheQBzZXRTdXN0YWluAGNvbnZlcnQAbXRvZgBtc1RvU2FtcHMAbWF4aVNhbXBsZUFuZEhvbGQAc2FoAG1heGlEaXN0b3J0aW9uAGZhc3RBdGFuAGF0YW5EaXN0AGZhc3RBdGFuRGlzdABtYXhpRmxhbmdlcgBmbGFuZ2UAbWF4aUNob3J1cwBjaG9ydXMAbWF4aURDQmxvY2tlcgBtYXhpU1ZGAHNldEN1dG9mZgBzZXRSZXNvbmFuY2UAbWF4aU1hdGgAYWRkAHN1YgBtdWwAZGl2AGd0AGx0AGd0ZQBsdGUAbW9kAGFicwBwb3cAbWF4aUNsb2NrAHRpY2tlcgBzZXRUZW1wbwBzZXRUaWNrc1BlckJlYXQAaXNUaWNrAGN1cnJlbnRDb3VudABwbGF5SGVhZABicHMAYnBtAHRpY2sAdGlja3MAbWF4aUt1cmFtb3RvT3NjaWxsYXRvcgBzZXRQaGFzZQBnZXRQaGFzZQBtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0AHNldFBoYXNlcwBzaXplAG1heGlBc3luY0t1cmFtb3RvT3NjaWxsYXRvcgBtYXhpRkZUAHByb2Nlc3MAc3BlY3RyYWxGbGF0bmVzcwBzcGVjdHJhbENlbnRyb2lkAGdldE1hZ25pdHVkZXMAZ2V0TWFnbml0dWRlc0RCAGdldFBoYXNlcwBnZXROdW1CaW5zAGdldEZGVFNpemUAZ2V0SG9wU2l6ZQBnZXRXaW5kb3dTaXplAG1heGlGRlRNb2RlcwBXSVRIX1BPTEFSX0NPTlZFUlNJT04ATk9fUE9MQVJfQ09OVkVSU0lPTgBtYXhpSUZGVABtYXhpSUZGVE1vZGVzAFNQRUNUUlVNAENPTVBMRVgAbWF4aU1GQ0MAbWZjYwBtYXhpVGltZVN0cmV0Y2gAc2hhcmVkX3B0cjxtYXhpVGltZXN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4AZ2V0Tm9ybWFsaXNlZFBvc2l0aW9uAGdldFBvc2l0aW9uAHNldFBvc2l0aW9uAHBsYXlBdFBvc2l0aW9uAG1heGlQaXRjaFNoaWZ0AHNoYXJlZF9wdHI8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4AbWF4aVN0cmV0Y2gAc2V0TG9vcFN0YXJ0AHNldExvb3BFbmQAZ2V0TG9vcEVuZABtYXhpQml0cwBzaWcAYXQAc2hsAHNocgByAGxhbmQAbG9yAGx4b3IAbmVnAGluYwBkZWMAZXEAdG9TaWduYWwAdG9UcmlnU2lnbmFsAGZyb21TaWduYWwAbWF4aVRyaWdnZXIAb25aWABvbkNoYW5nZWQAbWF4aUNvdW50ZXIAY291bnQAbWF4aUluZGV4AHB1bGwAbWF4aVJhdGlvU2VxAHBsYXlUcmlnAHBsYXlWYWx1ZXMAbWF4aVNhdFJldmVyYgBtYXhpRnJlZVZlcmIAYWxsb2NhdG9yPFQ+OjphbGxvY2F0ZShzaXplX3QgbikgJ24nIGV4Y2VlZHMgbWF4aW11bSBzdXBwb3J0ZWQgc2l6ZQBwdXNoX2JhY2sAcmVzaXplAGdldABzZXQATlN0M19fMjZ2ZWN0b3JJaU5TXzlhbGxvY2F0b3JJaUVFRUUATlN0M19fMjEzX192ZWN0b3JfYmFzZUlpTlNfOWFsbG9jYXRvcklpRUVFRQBOU3QzX18yMjBfX3ZlY3Rvcl9iYXNlX2NvbW1vbklMYjFFRUUAAAAMfAAAMQwAAJB8AAAFDAAAAAAAAAEAAABYDAAAAAAAAJB8AADhCwAAAAAAAAEAAABgDAAAAAAAAFBOU3QzX18yNnZlY3RvcklpTlNfOWFsbG9jYXRvcklpRUVFRQAAAADsfAAAkAwAAAAAAAB4DAAAUEtOU3QzX18yNnZlY3RvcklpTlNfOWFsbG9jYXRvcklpRUVFRQAAAOx8AADIDAAAAQAAAHgMAABpaQB2AHZpALgMAAAUewAAuAwAAHR7AAB2aWlpAAAAABR7AAC4DAAAmHsAAHR7AAB2aWlpaQAAAJh7AADwDAAAaWlpAGQNAAB4DAAAmHsAAE4xMGVtc2NyaXB0ZW4zdmFsRQAADHwAAFANAABpaWlpAEGAGwvmBCx7AAB4DAAAmHsAAHR7AABpaWlpaQBOU3QzX18yNnZlY3RvcklkTlNfOWFsbG9jYXRvcklkRUVFRQBOU3QzX18yMTNfX3ZlY3Rvcl9iYXNlSWROU185YWxsb2NhdG9ySWRFRUVFAAAAkHwAALoNAAAAAAAAAQAAAFgMAAAAAAAAkHwAAJYNAAAAAAAAAQAAAOgNAAAAAAAAUE5TdDNfXzI2dmVjdG9ySWROU185YWxsb2NhdG9ySWRFRUVFAAAAAOx8AAAYDgAAAAAAAAAOAABQS05TdDNfXzI2dmVjdG9ySWROU185YWxsb2NhdG9ySWRFRUVFAAAA7HwAAFAOAAABAAAAAA4AAEAOAAAUewAAQA4AALB7AAB2aWlkAAAAABR7AABADgAAmHsAALB7AAB2aWlpZAAAAJh7AAB4DgAAZA0AAAAOAACYewAAAAAAACx7AAAADgAAmHsAALB7AABpaWlpZABOU3QzX18yNnZlY3RvckljTlNfOWFsbG9jYXRvckljRUVFRQBOU3QzX18yMTNfX3ZlY3Rvcl9iYXNlSWNOU185YWxsb2NhdG9ySWNFRUVFAAAAkHwAAAoPAAAAAAAAAQAAAFgMAAAAAAAAkHwAAOYOAAAAAAAAAQAAADgPAAAAAAAAUE5TdDNfXzI2dmVjdG9ySWNOU185YWxsb2NhdG9ySWNFRUVFAAAAAOx8AABoDwAAAAAAAFAPAABQS05TdDNfXzI2dmVjdG9ySWNOU185YWxsb2NhdG9ySWNFRUVFAAAA7HwAAKAPAAABAAAAUA8AAJAPAAAUewAAkA8AADh7AEHwHwsiFHsAAJAPAACYewAAOHsAAJh7AADIDwAAZA0AAFAPAACYewBBoCALsgIsewAAUA8AAJh7AAA4ewAATlN0M19fMjZ2ZWN0b3JJaE5TXzlhbGxvY2F0b3JJaEVFRUUATlN0M19fMjEzX192ZWN0b3JfYmFzZUloTlNfOWFsbG9jYXRvckloRUVFRQCQfAAAVBAAAAAAAAABAAAAWAwAAAAAAACQfAAAMBAAAAAAAAABAAAAgBAAAAAAAABQTlN0M19fMjZ2ZWN0b3JJaE5TXzlhbGxvY2F0b3JJaEVFRUUAAAAA7HwAALAQAAAAAAAAmBAAAFBLTlN0M19fMjZ2ZWN0b3JJaE5TXzlhbGxvY2F0b3JJaEVFRUUAAADsfAAA6BAAAAEAAACYEAAA2BAAABR7AADYEAAARHsAABR7AADYEAAAmHsAAER7AACYewAAEBEAAGQNAACYEAAAmHsAQeAiC5QCLHsAAJgQAACYewAARHsAAE5TdDNfXzI2dmVjdG9ySWZOU185YWxsb2NhdG9ySWZFRUVFAE5TdDNfXzIxM19fdmVjdG9yX2Jhc2VJZk5TXzlhbGxvY2F0b3JJZkVFRUUAkHwAAJQRAAAAAAAAAQAAAFgMAAAAAAAAkHwAAHARAAAAAAAAAQAAAMARAAAAAAAAUE5TdDNfXzI2dmVjdG9ySWZOU185YWxsb2NhdG9ySWZFRUVFAAAAAOx8AADwEQAAAAAAANgRAABQS05TdDNfXzI2dmVjdG9ySWZOU185YWxsb2NhdG9ySWZFRUVFAAAA7HwAACgSAAABAAAA2BEAABgSAAAUewAAGBIAAKR7AAB2aWlmAEGAJQuSAhR7AAAYEgAAmHsAAKR7AAB2aWlpZgAAAJh7AABQEgAAZA0AANgRAACYewAAAAAAACx7AADYEQAAmHsAAKR7AABpaWlpZgAxMXZlY3RvclRvb2xzAAx8AADGEgAAUDExdmVjdG9yVG9vbHMAAOx8AADcEgAAAAAAANQSAABQSzExdmVjdG9yVG9vbHMA7HwAAPwSAAABAAAA1BIAAOwSAAAUewAAAA4AAHZpaQAUewAA2BEAADEybWF4aVNldHRpbmdzAAAMfAAANBMAAFAxMm1heGlTZXR0aW5ncwDsfAAATBMAAAAAAABEEwAAUEsxMm1heGlTZXR0aW5ncwAAAADsfAAAbBMAAAEAAABEEwAAXBMAQaAnC3AUewAAdHsAAHR7AAB0ewAAN21heGlPc2MAAAAADHwAALATAABQN21heGlPc2MAAADsfAAAxBMAAAAAAAC8EwAAUEs3bWF4aU9zYwAA7HwAAOATAAABAAAAvBMAANATAACwewAA0BMAALB7AABkaWlkAEGgKAvFAbB7AADQEwAAsHsAALB7AACwewAAZGlpZGRkAAAAAAAAsHsAANATAACwewAAsHsAAGRpaWRkAAAAsHsAANATAABkaWkAFHsAANATAACwewAAMTJtYXhpRW52ZWxvcGUAAAx8AABwFAAAUDEybWF4aUVudmVsb3BlAOx8AACIFAAAAAAAAIAUAABQSzEybWF4aUVudmVsb3BlAAAAAOx8AACoFAAAAQAAAIAUAACYFAAAsHsAAJgUAAB0ewAAAA4AAGRpaWlpAEHwKQtyFHsAAJgUAAB0ewAAsHsAADEzbWF4aURlbGF5bGluZQAMfAAAABUAAFAxM21heGlEZWxheWxpbmUAAAAA7HwAABgVAAAAAAAAEBUAAFBLMTNtYXhpRGVsYXlsaW5lAAAA7HwAADwVAAABAAAAEBUAACwVAEHwKguyAbB7AAAsFQAAsHsAAHR7AACwewAAZGlpZGlkAAAAAAAAsHsAACwVAACwewAAdHsAALB7AAB0ewAAZGlpZGlkaQAxMG1heGlGaWx0ZXIAAAAADHwAALAVAABQMTBtYXhpRmlsdGVyAAAA7HwAAMgVAAAAAAAAwBUAAFBLMTBtYXhpRmlsdGVyAADsfAAA6BUAAAEAAADAFQAA2BUAAAAAAACwewAA2BUAALB7AACwewAAsHsAQbAsC6IDsHsAANgVAACwewAAsHsAADdtYXhpTWl4AAAAAAx8AABAFgAAUDdtYXhpTWl4AAAA7HwAAFQWAAAAAAAATBYAAFBLN21heGlNaXgAAOx8AABwFgAAAQAAAEwWAABgFgAAFHsAAGAWAACwewAAAA4AALB7AAB2aWlkaWQAAAAAAAAUewAAYBYAALB7AAAADgAAsHsAALB7AAB2aWlkaWRkABR7AABgFgAAsHsAAAAOAACwewAAsHsAALB7AAB2aWlkaWRkZAA4bWF4aUxpbmUAAAx8AAD1FgAAUDhtYXhpTGluZQAA7HwAAAgXAAAAAAAAABcAAFBLOG1heGlMaW5lAOx8AAAkFwAAAQAAAAAXAAAUFwAAsHsAABQXAACwewAAFHsAABQXAACwewAAsHsAALB7AAAsewAAdmlpZGRkaQAUewAAFBcAALB7AAAsewAAFBcAADltYXhpWEZhZGUAAAx8AACEFwAAUDltYXhpWEZhZGUA7HwAAJgXAAAAAAAAkBcAAFBLOW1heGlYRmFkZQAAAADsfAAAtBcAAAEAAACQFwBB4S8LpQMOAAAADgAAAA4AALB7AACwewAAsHsAALB7AACwewAAZGlkZGQAMTBtYXhpTGFnRXhwSWRFAAAADHwAAAYYAABQMTBtYXhpTGFnRXhwSWRFAAAAAOx8AAAgGAAAAAAAABgYAABQSzEwbWF4aUxhZ0V4cElkRQAAAOx8AABEGAAAAQAAABgYAAA0GAAAAAAAABR7AAA0GAAAsHsAALB7AAB2aWlkZAAAABR7AAA0GAAAsHsAALB7AABYGAAAMTBtYXhpU2FtcGxlAAAAAAx8AACcGAAAUDEwbWF4aVNhbXBsZQAAAOx8AAC0GAAAAAAAAKwYAABQSzEwbWF4aVNhbXBsZQAA7HwAANQYAAABAAAArBgAAMQYAACYewAA5BgAABR7AADEGAAAAA4AAAAAAAAUewAAxBgAAAAOAAB0ewAAdHsAAMQYAACYEAAAdHsAACx7AADEGAAAsHsAAMQYAACwewAAxBgAALB7AAAAAAAAsHsAAMQYAACwewAAsHsAALB7AADEGAAAsHsAALB7AACwewAAFHsAAMQYAAAUewAAxBgAALB7AEGQMwuGAhR7AADEGAAApHsAAKR7AAAsewAALHsAAHZpaWZmaWkALHsAAMQYAAAwGgAAdHsAAE5TdDNfXzIxMmJhc2ljX3N0cmluZ0ljTlNfMTFjaGFyX3RyYWl0c0ljRUVOU185YWxsb2NhdG9ySWNFRUVFAE5TdDNfXzIyMV9fYmFzaWNfc3RyaW5nX2NvbW1vbklMYjFFRUUAAAAADHwAAP8ZAACQfAAAwBkAAAAAAAABAAAAKBoAAAAAAAA3bWF4aU1hcAAAAAAMfAAASBoAAFA3bWF4aU1hcAAAAOx8AABcGgAAAAAAAFQaAABQSzdtYXhpTWFwAADsfAAAeBoAAAEAAABUGgAAaBoAQaA1C5QBsHsAALB7AACwewAAsHsAALB7AACwewAAZGlkZGRkZAA3bWF4aUR5bgAAAAAMfAAAwBoAAFA3bWF4aUR5bgAAAOx8AADUGgAAAAAAAMwaAABQSzdtYXhpRHluAADsfAAA8BoAAAEAAADMGgAA4BoAALB7AADgGgAAsHsAALB7AACMewAAsHsAALB7AABkaWlkZGlkZABBwDYLtAGwewAA4BoAALB7AACwewAAsHsAALB7AACwewAAZGlpZGRkZGQAAAAAsHsAAOAaAACwewAAFHsAAOAaAACwewAAN21heGlFbnYAAAAADHwAAIAbAABQN21heGlFbnYAAADsfAAAlBsAAAAAAACMGwAAUEs3bWF4aUVudgAA7HwAALAbAAABAAAAjBsAAKAbAACwewAAoBsAALB7AACwewAAsHsAAIx7AAB0ewAAZGlpZGRkaWkAQYA4C6YCsHsAAKAbAACwewAAsHsAALB7AACwewAAsHsAAIx7AAB0ewAAZGlpZGRkZGRpaQAAsHsAAKAbAACwewAAdHsAAGRpaWRpAAAAFHsAAKAbAACwewAAN2NvbnZlcnQAAAAADHwAAFQcAABQN2NvbnZlcnQAAADsfAAAaBwAAAAAAABgHAAAUEs3Y29udmVydAAA7HwAAIQcAAABAAAAYBwAAHQcAACwewAAdHsAALB7AACwewAAZGlkADE3bWF4aVNhbXBsZUFuZEhvbGQADHwAALgcAABQMTdtYXhpU2FtcGxlQW5kSG9sZAAAAADsfAAA1BwAAAAAAADMHAAAUEsxN21heGlTYW1wbGVBbmRIb2xkAAAA7HwAAPwcAAABAAAAzBwAAOwcAEGwOguCAbB7AADsHAAAsHsAALB7AAAxNG1heGlEaXN0b3J0aW9uAAAAAAx8AABAHQAAUDE0bWF4aURpc3RvcnRpb24AAADsfAAAXB0AAAAAAABUHQAAUEsxNG1heGlEaXN0b3J0aW9uAADsfAAAgB0AAAEAAABUHQAAcB0AALB7AABwHQAAsHsAQcA7C9YGsHsAAHAdAACwewAAsHsAADExbWF4aUZsYW5nZXIAAAAMfAAA0B0AAFAxMW1heGlGbGFuZ2VyAADsfAAA6B0AAAAAAADgHQAAUEsxMW1heGlGbGFuZ2VyAOx8AAAIHgAAAQAAAOAdAAD4HQAAAAAAALB7AAD4HQAAsHsAAIB7AACwewAAsHsAALB7AABkaWlkaWRkZAAxMG1heGlDaG9ydXMAAAAMfAAAVR4AAFAxMG1heGlDaG9ydXMAAADsfAAAbB4AAAAAAABkHgAAUEsxMG1heGlDaG9ydXMAAOx8AACMHgAAAQAAAGQeAAB8HgAAsHsAAHweAACwewAAgHsAALB7AACwewAAsHsAADEzbWF4aURDQmxvY2tlcgAMfAAAzB4AAFAxM21heGlEQ0Jsb2NrZXIAAAAA7HwAAOQeAAAAAAAA3B4AAFBLMTNtYXhpRENCbG9ja2VyAAAA7HwAAAgfAAABAAAA3B4AAPgeAACwewAA+B4AALB7AACwewAAN21heGlTVkYAAAAADHwAAEAfAABQN21heGlTVkYAAADsfAAAVB8AAAAAAABMHwAAUEs3bWF4aVNWRgAA7HwAAHAfAAABAAAATB8AAGAfAAAUewAAYB8AALB7AAAAAAAAsHsAAGAfAACwewAAsHsAALB7AACwewAAsHsAADhtYXhpTWF0aAAAAAx8AAC8HwAAUDhtYXhpTWF0aAAA7HwAANAfAAAAAAAAyB8AAFBLOG1heGlNYXRoAOx8AADsHwAAAQAAAMgfAADcHwAAsHsAALB7AACwewAAZGlkZAA5bWF4aUNsb2NrAAx8AAAdIAAAUDltYXhpQ2xvY2sA7HwAADAgAAAAAAAAKCAAAFBLOW1heGlDbG9jawAAAADsfAAATCAAAAEAAAAoIAAAPCAAABR7AAA8IAAAFHsAADwgAACwewAAFHsAADwgAAB0ewAAdHsAAFwgAAAyMm1heGlLdXJhbW90b09zY2lsbGF0b3IAAAAADHwAAJggAABQMjJtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yAAAA7HwAALwgAAAAAAAAtCAAAFBLMjJtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yAADsfAAA6CAAAAEAAAC0IAAA2CAAQaDCAAuiA7B7AADYIAAAsHsAALB7AAAADgAAZGlpZGRpAAAUewAA2CAAALB7AACwewAA2CAAADI1bWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldAAMfAAAUCEAAFAyNW1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQAAAAA7HwAAHQhAAAAAAAAbCEAAFBLMjVtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0AAAA7HwAAKQhAAABAAAAbCEAAJQhAACYewAAAAAAALB7AACUIQAAsHsAALB7AAAUewAAlCEAALB7AACYewAAdmlpZGkAAAAUewAAlCEAAAAOAACwewAAlCEAAJh7AABkaWlpAAAAAJh7AACUIQAAMjdtYXhpQXN5bmNLdXJhbW90b09zY2lsbGF0b3IAAAA0fAAAMCIAAGwhAABQMjdtYXhpQXN5bmNLdXJhbW90b09zY2lsbGF0b3IAAOx8AABcIgAAAAAAAFAiAABQSzI3bWF4aUFzeW5jS3VyYW1vdG9Pc2NpbGxhdG9yAOx8AACMIgAAAQAAAFAiAAB8IgAAmHsAQdDFAAviArB7AAB8IgAAsHsAALB7AAAUewAAfCIAALB7AACYewAAFHsAAHwiAAAADgAAsHsAAHwiAACYewAAmHsAAHwiAAA3bWF4aUZGVAAAAAAMfAAAECMAAFA3bWF4aUZGVAAAAOx8AAAkIwAAAAAAABwjAABQSzdtYXhpRkZUAADsfAAAQCMAAAEAAAAcIwAAMCMAABR7AAAwIwAAdHsAAHR7AAB0ewAAdmlpaWlpAAAAAAAALHsAADAjAACkewAApCMAAE43bWF4aUZGVDhmZnRNb2Rlc0UAwHsAAJAjAABpaWlmaQAAAKR7AAAwIwAAZmlpANgRAAAwIwAAdHsAADAjAAA4bWF4aUlGRlQAAAAMfAAA0CMAAFA4bWF4aUlGRlQAAOx8AADkIwAAAAAAANwjAABQSzhtYXhpSUZGVADsfAAAACQAAAEAAADcIwAA8CMAABR7AADwIwAAdHsAAHR7AAB0ewBBwMgAC7YNpHsAAPAjAADYEQAA2BEAAGwkAABOOG1heGlJRkZUOGZmdE1vZGVzRQAAAADAewAAVCQAAGZpaWlpaQAxNm1heGlNRkNDQW5hbHlzZXJJZEUAAAAADHwAAHskAABQMTZtYXhpTUZDQ0FuYWx5c2VySWRFAADsfAAAnCQAAAAAAACUJAAAUEsxNm1heGlNRkNDQW5hbHlzZXJJZEUA7HwAAMQkAAABAAAAlCQAALQkAAAUewAAtCQAAIB7AACAewAAgHsAALB7AACwewAAdmlpaWlpZGQAAAAAAA4AALQkAADYEQAAMTVtYXhpVGltZVN0cmV0Y2hJMTRoYW5uV2luRnVuY3RvckUADHwAACQlAABQMTVtYXhpVGltZVN0cmV0Y2hJMTRoYW5uV2luRnVuY3RvckUAAAAA7HwAAFAlAAAAAAAASCUAAFBLMTVtYXhpVGltZVN0cmV0Y2hJMTRoYW5uV2luRnVuY3RvckUAAADsfAAAiCUAAAEAAABIJQAAAAAAAHgmAABGAgAARwIAAEgCAABJAgAASgIAAE5TdDNfXzIyMF9fc2hhcmVkX3B0cl9wb2ludGVySVAxNW1heGlUaW1lU3RyZXRjaEkxNGhhbm5XaW5GdW5jdG9yRU4xMGVtc2NyaXB0ZW4xNXNtYXJ0X3B0cl90cmFpdElOU18xMHNoYXJlZF9wdHJJUzNfRUVFMTF2YWxfZGVsZXRlckVOU185YWxsb2NhdG9ySVMzX0VFRUUAADR8AADcJQAAVHgAAE4xMGVtc2NyaXB0ZW4xNXNtYXJ0X3B0cl90cmFpdElOU3QzX18yMTBzaGFyZWRfcHRySTE1bWF4aVRpbWVTdHJldGNoSTE0aGFubldpbkZ1bmN0b3JFRUVFMTF2YWxfZGVsZXRlckUATlN0M19fMjEwc2hhcmVkX3B0ckkxNW1heGlUaW1lU3RyZXRjaEkxNGhhbm5XaW5GdW5jdG9yRUVFAAAADHwAAOwmAABpAAAAKCcAAAAAAACsJwAASwIAAEwCAABNAgAATgIAAE8CAABOU3QzX18yMjBfX3NoYXJlZF9wdHJfZW1wbGFjZUkxNW1heGlUaW1lU3RyZXRjaEkxNGhhbm5XaW5GdW5jdG9yRU5TXzlhbGxvY2F0b3JJUzNfRUVFRQAANHwAAFQnAABUeAAAFHsAAHglAADEGAAAsHsAAHglAAAUewAAeCUAALB7AAAAAAAAJCgAAFACAABRAgAAUgIAADltYXhpR3JhaW5JMTRoYW5uV2luRnVuY3RvckUAMTNtYXhpR3JhaW5CYXNlAAAAAAx8AAAJKAAANHwAAOwnAAAcKAAAsHsAAHglAACwewAAsHsAAHR7AACwewAAZGlpZGRpZACwewAAeCUAALB7AACwewAAdHsAADE0bWF4aVBpdGNoU2hpZnRJMTRoYW5uV2luRnVuY3RvckUAAAx8AABkKAAAUDE0bWF4aVBpdGNoU2hpZnRJMTRoYW5uV2luRnVuY3RvckUA7HwAAJAoAAAAAAAAiCgAAFBLMTRtYXhpUGl0Y2hTaGlmdEkxNGhhbm5XaW5GdW5jdG9yRQAAAADsfAAAxCgAAAEAAACIKAAAAAAAALQpAABTAgAAVAIAAFUCAABWAgAAVwIAAE5TdDNfXzIyMF9fc2hhcmVkX3B0cl9wb2ludGVySVAxNG1heGlQaXRjaFNoaWZ0STE0aGFubldpbkZ1bmN0b3JFTjEwZW1zY3JpcHRlbjE1c21hcnRfcHRyX3RyYWl0SU5TXzEwc2hhcmVkX3B0cklTM19FRUUxMXZhbF9kZWxldGVyRU5TXzlhbGxvY2F0b3JJUzNfRUVFRQAAADR8AAAYKQAAVHgAAE4xMGVtc2NyaXB0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AQAAALhJAAAD9P//TlN0M19fMjEzYmFzaWNfaXN0cmVhbUl3TlNfMTFjaGFyX3RyYWl0c0l3RUVFRQAAkHwAAMxKAAAAAAAAAQAAAABKAAAD9P//TlN0M19fMjEzYmFzaWNfb3N0cmVhbUljTlNfMTFjaGFyX3RyYWl0c0ljRUVFRQAAkHwAABRLAAAAAAAAAQAAALhJAAAD9P//TlN0M19fMjEzYmFzaWNfb3N0cmVhbUl3TlNfMTFjaGFyX3RyYWl0c0l3RUVFRQAAkHwAAFxLAAAAAAAAAQAAAABKAAAD9P//2LgAAAAAAAAATAAAfgIAAKkCAACqAgAAgQIAAIICAACDAgAAhAIAAGwCAABtAgAAqwIAAKwCAACtAgAAcQIAAIcCAABOU3QzX18yMTBfX3N0ZGluYnVmSWNFRQA0fAAA6EsAAEBKAAB1bnN1cHBvcnRlZCBsb2NhbGUgZm9yIHN0YW5kYXJkIGlucHV0AAAAAAAAAIxMAACIAgAArgIAAK8CAACLAgAAjAIAAI0CAACOAgAAjwIAAJACAACwAgAAsQIAALICAACUAgAAlQIAAE5TdDNfXzIxMF9fc3RkaW5idWZJd0VFADR8AAB0TAAAfEoAAAAAAAD0TAAAfgIAALMCAAC0AgAAgQIAAIICAACDAgAAtQIAAGwCAABtAgAAhQIAAG8CAACGAgAAtgIAALcCAABOU3QzX18yMTFfX3N0ZG91dGJ1ZkljRUUAAAAANHwAANhMAABASgAAAAAAAFxNAACIAgAAuAIAALkCAACLAgAAjAIAAI0CAAC6AgAAjwIAAJACAACRAgAAkgIAAJMCAAC7AgAAvAIAAE5TdDNfXzIxMV9fc3Rkb3V0YnVmSXdFRQAAAAA0fAAAQE0AAHxKAEHwmgEL4wT/////////////////////////////////////////////////////////////////AAECAwQFBgcICf////////8KCwwNDg8QERITFBUWFxgZGhscHR4fICEiI////////woLDA0ODxAREhMUFRYXGBkaGxwdHh8gISIj/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////wABAgQHAwYFAAAAAAAAAAIAAMADAADABAAAwAUAAMAGAADABwAAwAgAAMAJAADACgAAwAsAAMAMAADADQAAwA4AAMAPAADAEAAAwBEAAMASAADAEwAAwBQAAMAVAADAFgAAwBcAAMAYAADAGQAAwBoAAMAbAADAHAAAwB0AAMAeAADAHwAAwAAAALMBAADDAgAAwwMAAMMEAADDBQAAwwYAAMMHAADDCAAAwwkAAMMKAADDCwAAwwwAAMMNAADTDgAAww8AAMMAAAy7AQAMwwIADMMDAAzDBAAM02luZmluaXR5AG5hbgAAAAAAAAAA0XSeAFedvSqAcFIP//8+JwoAAABkAAAA6AMAABAnAACghgEAQEIPAICWmAAA4fUFGAAAADUAAABxAAAAa////877//+Sv///AAAAAAAAAADeEgSVAAAAAP///////////////7BPAAAUAAAAQy5VVEYtOABB+J8BCwLETwBBkKABCwZMQ19BTEwAQaCgAQtuTENfQ1RZUEUAAAAATENfTlVNRVJJQwAATENfVElNRQAAAAAATENfQ09MTEFURQAATENfTU9ORVRBUlkATENfTUVTU0FHRVMATEFORwBDLlVURi04AFBPU0lYAE1VU0xfTE9DUEFUSAAAAAAAkFEAQZCjAQv/AQIAAgACAAIAAgACAAIAAgACAAMgAiACIAIgAiACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgABYATABMAEwATABMAEwATABMAEwATABMAEwATABMAEwAjYCNgI2AjYCNgI2AjYCNgI2AjYBMAEwATABMAEwATABMAI1QjVCNUI1QjVCNUIxQjFCMUIxQjFCMUIxQjFCMUIxQjFCMUIxQjFCMUIxQjFCMUIxQjFBMAEwATABMAEwATACNYI1gjWCNYI1gjWCMYIxgjGCMYIxgjGCMYIxgjGCMYIxgjGCMYIxgjGCMYIxgjGCMYIxgTABMAEwATAAgBBkKcBCwKgVQBBpKsBC/kDAQAAAAIAAAADAAAABAAAAAUAAAAGAAAABwAAAAgAAAAJAAAACgAAAAsAAAAMAAAADQAAAA4AAAAPAAAAEAAAABEAAAASAAAAEwAAABQAAAAVAAAA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AABPAwAAUAMAAE5TdDNfXzI3bnVtX3B1dEl3TlNfMTlvc3RyZWFtYnVmX2l0ZXJhdG9ySXdOU18xMWNoYXJfdHJhaXRzSXdFRUVFRUUATlN0M19fMjlfX251bV9wdXRJd0VFAAAAkHwAAGhqAAAAAAAAAQAAALBpAAAAAAAAkHwAACRqAAAAAAAAAgAAAABjAAACAAAAgGoAQbzVAQuaC5hrAABRAwAAUgMAANICAABTAwAAVAMAAFUDAABWAwAAVwMAAFgDAABZAwAA+P///5hrAABaAwAAWwMAAFwDAABdAwAAXgMAAF8DAABgAwAATlN0M19fMjh0aW1lX2dldEljTlNfMTlpc3RyZWFtYnVmX2l0ZXJhdG9ySWNOU18xMWNoYXJfdHJhaXRzSWNFRUVFRUUATlN0M19fMjl0aW1lX2Jhc2VFAAx8AABRawAATlN0M19fMjIwX190aW1lX2dldF9jX3N0b3JhZ2VJY0VFAAAADHwAAGxrAACQfAAADGsAAAAAAAADAAAAAGMAAAIAAABkawAAAgAAAJBrAAAACAAAAAAAAIRsAABhAwAAYgMAANICAABjAwAAZAMAAGUDAABmAwAAZwMAAGgDAABpAwAA+P///4RsAABqAwAAawMAAGwDAABtAwAAbgMAAG8DAABwAwAATlN0M19fMjh0aW1lX2dldEl3TlNfMTlpc3RyZWFtYnVmX2l0ZXJhdG9ySXdOU18xMWNoYXJfdHJhaXRzSXdFRUVFRUUATlN0M19fMjIwX190aW1lX2dldF9jX3N0b3JhZ2VJd0VFAAAMfAAAWWwAAJB8AAAUbAAAAAAAAAMAAAAAYwAAAgAAAGRrAAACAAAAfGwAAAAIAAAAAAAAKG0AAHEDAAByAwAA0gIAAHMDAABOU3QzX18yOHRpbWVfcHV0SWNOU18xOW9zdHJlYW1idWZfaXRlcmF0b3JJY05TXzExY2hhcl90cmFpdHNJY0VFRUVFRQBOU3QzX18yMTBfX3RpbWVfcHV0RQAAAAx8AAAJbQAAkHwAAMRsAAAAAAAAAgAAAABjAAACAAAAIG0AAAAIAAAAAAAAqG0AAHQDAAB1AwAA0gIAAHYDAABOU3QzX18yOHRpbWVfcHV0SXdOU18xOW9zdHJlYW1idWZfaXRlcmF0b3JJd05TXzExY2hhcl90cmFpdHNJd0VF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AAAAAPh7AAC+AwAAwwMAAMADAADBAwAAxAMAAE4xMF9fY3h4YWJpdjExNl9fZW51bV90eXBlX2luZm9FAAAAADR8AADUewAAtHkAAAAAAADkeQAAvgMAAMUDAADAAwAAwQMAAMYDAADHAwAAyAMAAMkDAAAAAAAAfHwAAL4DAADKAwAAwAMAAMEDAADGAwAAywMAAMwDAADNAwAATjEwX19jeHhhYml2MTIwX19zaV9jbGFzc190eXBlX2luZm9FAAAAADR8AABUfAAA5HkAAAAAAADYfAAAvgMAAM4DAADAAwAAwQMAAMYDAADPAwAA0AMAANEDAABOMTBfX2N4eGFiaXYxMjFfX3ZtaV9jbGFzc190eXBlX2luZm9FAAAANHwAALB8AADkeQAAAAAAAER6AAC+AwAA0gMAAMADAADBAwAA0wMAAHZvaWQAYm9vbABjaGFyAHNpZ25lZCBjaGFyAHVuc2lnbmVkIGNoYXIAc2hvcnQAdW5zaWduZWQgc2hvcnQAaW50AHVuc2lnbmVkIGludABsb25nAHVuc2lnbmVkIGxvbmcAZmxvYXQAZG91YmxlAHN0ZDo6c3RyaW5nAHN0ZDo6YmFzaWNfc3RyaW5nPHVuc2lnbmVkIGNoYXI+AHN0ZDo6d3N0cmluZwBzdGQ6OnUxNnN0cmluZwBzdGQ6OnUzMnN0cmluZwBlbXNjcmlwdGVuOjp2YWwAZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8Y2hhcj4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8c2lnbmVkIGNoYXI+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHVuc2lnbmVkIGNoYXI+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHNob3J0PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzx1bnNpZ25lZCBzaG9ydD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8aW50PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzx1bnNpZ25lZCBpbnQ+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PGxvbmc+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHVuc2lnbmVkIGxvbmc+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PGludDhfdD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8dWludDhfdD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8aW50MTZfdD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8dWludDE2X3Q+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PGludDMyX3Q+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHVpbnQzMl90PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxmbG9hdD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8ZG91YmxlPgBOU3QzX18yMTJiYXNpY19zdHJpbmdJaE5TXzExY2hhcl90cmFpdHNJaEVFTlNfOWFsbG9jYXRvckloRUVFRQAAAACQfAAAFoAAAAAAAAABAAAAKBoAAAAAAABOU3QzX18yMTJiYXNpY19zdHJpbmdJd05TXzExY2hhcl90cmFpdHNJd0VFTlNfOWFsbG9jYXRvckl3RUVFRQAAkHwAAHCAAAAAAAAAAQAAACgaAAAAAAAATlN0M19fMjEyYmFzaWNfc3RyaW5nSURzTlNfMTFjaGFyX3RyYWl0c0lEc0VFTlNfOWFsbG9jYXRvcklEc0VFRUUAAACQfAAAyIAAAAAAAAABAAAAKBoAAAAAAABOU3QzX18yMTJiYXNpY19zdHJpbmdJRGlOU18xMWNoYXJfdHJhaXRzSURpRUVOU185YWxsb2NhdG9ySURpRUVFRQAAAJB8AAAkgQAAAAAAAAEAAAAoGgAAAAAAAE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SWNFRQAADHwAAICBAABOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0lhRUUAAAx8AACogQAATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJaEVFAAAMfAAA0IEAAE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SXNFRQAADHwAAPiBAABOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0l0RUUAAAx8AAAgggAATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJaUVFAAAMfAAASIIAAE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SWpFRQAADHwAAHCCAABOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0lsRUUAAAx8AACYggAA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YmluZF9yZWdpc3Rlcl9jbGFzcwEiX2VtYmluZF9yZWdpc3Rlcl9jbGFzc19jb25zdHJ1Y3RvcgIlX2VtYmluZF9yZWdpc3Rlcl9jbGFzc19jbGFzc19mdW5jdGlvbgMfX2VtYmluZF9yZWdpc3Rlcl9jbGFzc19wcm9wZXJ0eQQfX2VtYmluZF9yZWdpc3Rlcl9jbGFzc19mdW5jdGlvbgUVX2VtYmluZF9yZWdpc3Rlcl9lbnVtBhtfZW1iaW5kX3JlZ2lzdGVyX2VudW1fdmFsdWUHGl9lbWJpbmRfcmVnaXN0ZXJfc21hcnRfcHRyCBhfX2N4YV9hbGxvY2F0ZV9leGNlcHRpb24JC19fY3hhX3Rocm93ChFfZW12YWxfdGFrZV92YWx1ZQsNX2VtdmFsX2luY3JlZgwNX2VtdmFsX2RlY3JlZg0LX2VtdmFsX2NhbGwOBXJvdW5kDwRleGl0EA1fX2Fzc2VydF9mYWlsEQZfX2xvY2sSCF9fdW5sb2NrEw9fX3dhc2lfZmRfY2xvc2UUCl9fc3lzY2FsbDUVDF9fc3lzY2FsbDIyMRYLX19zeXNjYWxsNTQXDl9fd2FzaV9mZF9yZWFkGA9fX3dhc2lfZmRfd3JpdGUZGF9fd2FzaV9lbnZpcm9uX3NpemVzX2dldBoSX193YXNpX2Vudmlyb25fZ2V0GwpfX21hcF9maWxlHAtfX3N5c2NhbGw5MR0Kc3RyZnRpbWVfbB4FYWJvcnQfFV9lbWJpbmRfcmVnaXN0ZXJfdm9pZCAVX2VtYmluZF9yZWdpc3Rlcl9ib29sIRtfZW1iaW5kX3JlZ2lzdGVyX3N0ZF9zdHJpbmciHF9lbWJpbmRfcmVnaXN0ZXJfc3RkX3dzdHJpbmcjFl9lbWJpbmRfcmVnaXN0ZXJfZW12YWwkGF9lbWJpbmRfcmVnaXN0ZXJfaW50ZWdlciUWX2VtYmluZF9yZWdpc3Rlcl9mbG9hdCYcX2VtYmluZF9yZWdpc3Rlcl9tZW1vcnlfdmlldycWZW1zY3JpcHRlbl9yZXNpemVfaGVhcCgVZW1zY3JpcHRlbl9tZW1jcHlfYmlnKQtzZXRUZW1wUmV0MCoabGVnYWxpbXBvcnQkX193YXNpX2ZkX3NlZWsrEV9fd2FzbV9jYWxsX2N0b3JzLFBFbXNjcmlwdGVuQmluZGluZ0luaXRpYWxpemVyX215X21vZHVsZTo6RW1zY3JpcHRlbkJpbmRpbmdJbml0aWFsaXplcl9teV9tb2R1bGUoKS2VAWVtc2NyaXB0ZW46OmNsYXNzXzxzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4sIGVtc2NyaXB0ZW46OmludGVybmFsOjpOb0Jhc2VDbGFzcz4gZW1zY3JpcHRlbjo6cmVnaXN0ZXJfdmVjdG9yPGludD4oY2hhciBjb25zdCopLp4BZW1zY3JpcHRlbjo6Y2xhc3NfPHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiwgZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok5vQmFzZUNsYXNzPiBlbXNjcmlwdGVuOjpyZWdpc3Rlcl92ZWN0b3I8ZG91YmxlPihjaGFyIGNvbnN0KikvmAFlbXNjcmlwdGVuOjpjbGFzc188c3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4sIGVtc2NyaXB0ZW46OmludGVybmFsOjpOb0Jhc2VDbGFzcz4gZW1zY3JpcHRlbjo6cmVnaXN0ZXJfdmVjdG9yPGNoYXI+KGNoYXIgY29uc3QqKTCzAWVtc2NyaXB0ZW46OmNsYXNzXzxzdGQ6Ol9fMjo6dmVjdG9yPHVuc2lnbmVkIGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8dW5zaWduZWQgY2hhcj4gPiwgZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok5vQmFzZUNsYXNzPiBlbXNjcmlwdGVuOjpyZWdpc3Rlcl92ZWN0b3I8dW5zaWduZWQgY2hhcj4oY2hhciBjb25zdCopMZsBZW1zY3JpcHRlbjo6Y2xhc3NfPHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4sIGVtc2NyaXB0ZW46OmludGVybmFsOjpOb0Jhc2VDbGFzcz4gZW1zY3JpcHRlbjo6cmVnaXN0ZXJfdmVjdG9yPGZsb2F0PihjaGFyIGNvbnN0KikySnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPHZlY3RvclRvb2xzPih2ZWN0b3JUb29scyopM0R2b2lkIGVtc2NyaXB0ZW46OmludGVybmFsOjpyYXdfZGVzdHJ1Y3Rvcjx2ZWN0b3JUb29scz4odmVjdG9yVG9vbHMqKTRHZW1zY3JpcHRlbjo6aW50ZXJuYWw6Okludm9rZXI8dmVjdG9yVG9vbHMqPjo6aW52b2tlKHZlY3RvclRvb2xzKiAoKikoKSk1PnZlY3RvclRvb2xzKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PHZlY3RvclRvb2xzPigpNuABZW1zY3JpcHRlbjo6aW50ZXJuYWw6Okludm9rZXI8dm9pZCwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+Jj46Omludm9rZSh2b2lkICgqKShzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mKSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+Kik3VHZlY3RvclRvb2xzOjpjbGVhclZlY3RvckRibChzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mKThMdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aVNldHRpbmdzPihtYXhpU2V0dGluZ3MqKTliZW1zY3JpcHRlbjo6aW50ZXJuYWw6Okludm9rZXI8dm9pZCwgaW50LCBpbnQsIGludD46Omludm9rZSh2b2lkICgqKShpbnQsIGludCwgaW50KSwgaW50LCBpbnQsIGludCk6Im1heGlTZXR0aW5nczo6c2V0dXAoaW50LCBpbnQsIGludCk7I21heGlTZXR0aW5nczo6Z2V0U2FtcGxlUmF0ZSgpIGNvbnN0PCBtYXhpU2V0dGluZ3M6OnNldFNhbXBsZVJhdGUoaW50KT2TAWludCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6R2V0dGVyUG9saWN5PGludCAobWF4aVNldHRpbmdzOjoqKSgpIGNvbnN0Pjo6Z2V0PG1heGlTZXR0aW5ncz4oaW50IChtYXhpU2V0dGluZ3M6OiogY29uc3QmKSgpIGNvbnN0LCBtYXhpU2V0dGluZ3MgY29uc3QmKT6PAXZvaWQgZW1zY3JpcHRlbjo6aW50ZXJuYWw6OlNldHRlclBvbGljeTx2b2lkIChtYXhpU2V0dGluZ3M6OiopKGludCk+OjpzZXQ8bWF4aVNldHRpbmdzPih2b2lkIChtYXhpU2V0dGluZ3M6OiogY29uc3QmKShpbnQpLCBtYXhpU2V0dGluZ3MmLCBpbnQpPyRtYXhpU2V0dGluZ3M6OmdldE51bUNoYW5uZWxzKCkgY29uc3RAIW1heGlTZXR0aW5nczo6c2V0TnVtQ2hhbm5lbHMoaW50KUEjbWF4aVNldHRpbmdzOjpnZXRCdWZmZXJTaXplKCkgY29uc3RCIG1heGlTZXR0aW5nczo6c2V0QnVmZmVyU2l6ZShpbnQpQ0J2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpT3NjPihtYXhpT3NjKilENm1heGlPc2MqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aU9zYz4oKUWYAWVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aU9zYzo6KikoZG91YmxlKSwgZG91YmxlLCBtYXhpT3NjKiwgZG91YmxlPjo6aW52b2tlKGRvdWJsZSAobWF4aU9zYzo6KiBjb25zdCYpKGRvdWJsZSksIG1heGlPc2MqLCBkb3VibGUpRtgBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpT3NjOjoqKShkb3VibGUsIGRvdWJsZSwgZG91YmxlKSwgZG91YmxlLCBtYXhpT3NjKiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZT46Omludm9rZShkb3VibGUgKG1heGlPc2M6OiogY29uc3QmKShkb3VibGUsIGRvdWJsZSwgZG91YmxlKSwgbWF4aU9zYyosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUpR7gBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpT3NjOjoqKShkb3VibGUsIGRvdWJsZSksIGRvdWJsZSwgbWF4aU9zYyosIGRvdWJsZSwgZG91YmxlPjo6aW52b2tlKGRvdWJsZSAobWF4aU9zYzo6KiBjb25zdCYpKGRvdWJsZSwgZG91YmxlKSwgbWF4aU9zYyosIGRvdWJsZSwgZG91YmxlKUh8ZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpT3NjOjoqKSgpLCBkb3VibGUsIG1heGlPc2MqPjo6aW52b2tlKGRvdWJsZSAobWF4aU9zYzo6KiBjb25zdCYpKCksIG1heGlPc2MqKUmSAWVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKG1heGlPc2M6OiopKGRvdWJsZSksIHZvaWQsIG1heGlPc2MqLCBkb3VibGU+OjppbnZva2Uodm9pZCAobWF4aU9zYzo6KiBjb25zdCYpKGRvdWJsZSksIG1heGlPc2MqLCBkb3VibGUpSkx2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpRW52ZWxvcGU+KG1heGlFbnZlbG9wZSopS0BtYXhpRW52ZWxvcGUqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aUVudmVsb3BlPigpTIQDZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpRW52ZWxvcGU6OiopKGludCwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiksIGRvdWJsZSwgbWF4aUVudmVsb3BlKiwgaW50LCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mPjo6aW52b2tlKGRvdWJsZSAobWF4aUVudmVsb3BlOjoqIGNvbnN0JikoaW50LCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mKSwgbWF4aUVudmVsb3BlKiwgaW50LCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4qKU26AWVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKG1heGlFbnZlbG9wZTo6KikoaW50LCBkb3VibGUpLCB2b2lkLCBtYXhpRW52ZWxvcGUqLCBpbnQsIGRvdWJsZT46Omludm9rZSh2b2lkIChtYXhpRW52ZWxvcGU6OiogY29uc3QmKShpbnQsIGRvdWJsZSksIG1heGlFbnZlbG9wZSosIGludCwgZG91YmxlKU4ibWF4aUVudmVsb3BlOjpnZXRBbXBsaXR1ZGUoKSBjb25zdE8ibWF4aUVudmVsb3BlOjpzZXRBbXBsaXR1ZGUoZG91YmxlKVAhbWF4aUVudmVsb3BlOjpnZXRWYWxpbmRleCgpIGNvbnN0UR5tYXhpRW52ZWxvcGU6OnNldFZhbGluZGV4KGludClSTnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlEZWxheWxpbmU+KG1heGlEZWxheWxpbmUqKVNCbWF4aURlbGF5bGluZSogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpRGVsYXlsaW5lPigpVOQBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpRGVsYXlsaW5lOjoqKShkb3VibGUsIGludCwgZG91YmxlKSwgZG91YmxlLCBtYXhpRGVsYXlsaW5lKiwgZG91YmxlLCBpbnQsIGRvdWJsZT46Omludm9rZShkb3VibGUgKG1heGlEZWxheWxpbmU6OiogY29uc3QmKShkb3VibGUsIGludCwgZG91YmxlKSwgbWF4aURlbGF5bGluZSosIGRvdWJsZSwgaW50LCBkb3VibGUpVfgBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpRGVsYXlsaW5lOjoqKShkb3VibGUsIGludCwgZG91YmxlLCBpbnQpLCBkb3VibGUsIG1heGlEZWxheWxpbmUqLCBkb3VibGUsIGludCwgZG91YmxlLCBpbnQ+OjppbnZva2UoZG91YmxlIChtYXhpRGVsYXlsaW5lOjoqIGNvbnN0JikoZG91YmxlLCBpbnQsIGRvdWJsZSwgaW50KSwgbWF4aURlbGF5bGluZSosIGRvdWJsZSwgaW50LCBkb3VibGUsIGludClWSHZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlGaWx0ZXI+KG1heGlGaWx0ZXIqKVc8bWF4aUZpbHRlciogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpRmlsdGVyPigpWB1tYXhpRmlsdGVyOjpnZXRDdXRvZmYoKSBjb25zdFkdbWF4aUZpbHRlcjo6c2V0Q3V0b2ZmKGRvdWJsZSlaIG1heGlGaWx0ZXI6OmdldFJlc29uYW5jZSgpIGNvbnN0WyBtYXhpRmlsdGVyOjpzZXRSZXNvbmFuY2UoZG91YmxlKVxCdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aU1peD4obWF4aU1peCopXTZtYXhpTWl4KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlNaXg+KClelgNlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChtYXhpTWl4OjoqKShkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGRvdWJsZSksIHZvaWQsIG1heGlNaXgqLCBkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGRvdWJsZT46Omludm9rZSh2b2lkIChtYXhpTWl4OjoqIGNvbnN0JikoZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBkb3VibGUpLCBtYXhpTWl4KiwgZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4qLCBkb3VibGUpX7YDZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAobWF4aU1peDo6KikoZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBkb3VibGUsIGRvdWJsZSksIHZvaWQsIG1heGlNaXgqLCBkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGRvdWJsZSwgZG91YmxlPjo6aW52b2tlKHZvaWQgKG1heGlNaXg6OiogY29uc3QmKShkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGRvdWJsZSwgZG91YmxlKSwgbWF4aU1peCosIGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KiwgZG91YmxlLCBkb3VibGUpYNYDZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAobWF4aU1peDo6KikoZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKSwgdm9pZCwgbWF4aU1peCosIGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZT46Omludm9rZSh2b2lkIChtYXhpTWl4OjoqIGNvbnN0JikoZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKSwgbWF4aU1peCosIGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSlhRHZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlMaW5lPihtYXhpTGluZSopYjhtYXhpTGluZSogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpTGluZT4oKWMWbWF4aUxpbmU6OnBsYXkoZG91YmxlKWQvbWF4aUxpbmU6OnByZXBhcmUoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgYm9vbCll7gFlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChtYXhpTGluZTo6KikoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgYm9vbCksIHZvaWQsIG1heGlMaW5lKiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgYm9vbD46Omludm9rZSh2b2lkIChtYXhpTGluZTo6KiBjb25zdCYpKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGJvb2wpLCBtYXhpTGluZSosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGJvb2wpZh9tYXhpTGluZTo6dHJpZ2dlckVuYWJsZShkb3VibGUpZxptYXhpTGluZTo6aXNMaW5lQ29tcGxldGUoKWhGdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aVhGYWRlPihtYXhpWEZhZGUqKWmHBGVtc2NyaXB0ZW46OmludGVybmFsOjpJbnZva2VyPHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+Jiwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgZG91YmxlPjo6aW52b2tlKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiAoKikoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+Jiwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgZG91YmxlKSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+Kiwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KiwgZG91YmxlKWqKAW1heGlYRmFkZTo6eGZhZGUoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+Jiwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgZG91YmxlKWuBAWVtc2NyaXB0ZW46OmludGVybmFsOjpJbnZva2VyPGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZT46Omludm9rZShkb3VibGUgKCopKGRvdWJsZSwgZG91YmxlLCBkb3VibGUpLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKWwobWF4aVhGYWRlOjp4ZmFkZShkb3VibGUsIGRvdWJsZSwgZG91YmxlKW1Zdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aUxhZ0V4cDxkb3VibGU+ID4obWF4aUxhZ0V4cDxkb3VibGU+KiluTW1heGlMYWdFeHA8ZG91YmxlPiogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpTGFnRXhwPGRvdWJsZT4gPigpbyhtYXhpTGFnRXhwPGRvdWJsZT46OmluaXQoZG91YmxlLCBkb3VibGUpcN4BZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAobWF4aUxhZ0V4cDxkb3VibGU+OjoqKShkb3VibGUsIGRvdWJsZSksIHZvaWQsIG1heGlMYWdFeHA8ZG91YmxlPiosIGRvdWJsZSwgZG91YmxlPjo6aW52b2tlKHZvaWQgKG1heGlMYWdFeHA8ZG91YmxlPjo6KiBjb25zdCYpKGRvdWJsZSwgZG91YmxlKSwgbWF4aUxhZ0V4cDxkb3VibGU+KiwgZG91YmxlLCBkb3VibGUpcSVtYXhpTGFnRXhwPGRvdWJsZT46OmFkZFNhbXBsZShkb3VibGUpciFtYXhpTGFnRXhwPGRvdWJsZT46OnZhbHVlKCkgY29uc3RzJG1heGlMYWdFeHA8ZG91YmxlPjo6Z2V0QWxwaGEoKSBjb25zdHQkbWF4aUxhZ0V4cDxkb3VibGU+OjpzZXRBbHBoYShkb3VibGUpdS5tYXhpTGFnRXhwPGRvdWJsZT46OmdldEFscGhhUmVjaXByb2NhbCgpIGNvbnN0di5tYXhpTGFnRXhwPGRvdWJsZT46OnNldEFscGhhUmVjaXByb2NhbChkb3VibGUpdyJtYXhpTGFnRXhwPGRvdWJsZT46OnNldFZhbChkb3VibGUpeEh2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpU2FtcGxlPihtYXhpU2FtcGxlKil5QnZvaWQgZW1zY3JpcHRlbjo6aW50ZXJuYWw6OnJhd19kZXN0cnVjdG9yPG1heGlTYW1wbGU+KG1heGlTYW1wbGUqKXo8bWF4aVNhbXBsZSogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpU2FtcGxlPigpex1tYXhpU2FtcGxlOjpnZXRMZW5ndGgoKSBjb25zdHz2AmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKG1heGlTYW1wbGU6OiopKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGludCksIHZvaWQsIG1heGlTYW1wbGUqLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBpbnQ+OjppbnZva2Uodm9pZCAobWF4aVNhbXBsZTo6KiBjb25zdCYpKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGludCksIG1heGlTYW1wbGUqLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4qLCBpbnQpfasDZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8aW50IChtYXhpU2FtcGxlOjoqKShzdGQ6Ol9fMjo6dmVjdG9yPHVuc2lnbmVkIGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8dW5zaWduZWQgY2hhcj4gPiYsIGludCksIGludCwgbWF4aVNhbXBsZSosIHN0ZDo6X18yOjp2ZWN0b3I8dW5zaWduZWQgY2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjx1bnNpZ25lZCBjaGFyPiA+JiwgaW50Pjo6aW52b2tlKGludCAobWF4aVNhbXBsZTo6KiBjb25zdCYpKHN0ZDo6X18yOjp2ZWN0b3I8dW5zaWduZWQgY2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjx1bnNpZ25lZCBjaGFyPiA+JiwgaW50KSwgbWF4aVNhbXBsZSosIHN0ZDo6X18yOjp2ZWN0b3I8dW5zaWduZWQgY2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjx1bnNpZ25lZCBjaGFyPiA+KiwgaW50KX6CAWVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKG1heGlTYW1wbGU6OiopKCksIHZvaWQsIG1heGlTYW1wbGUqPjo6aW52b2tlKHZvaWQgKG1heGlTYW1wbGU6OiogY29uc3QmKSgpLCBtYXhpU2FtcGxlKil/E21heGlTYW1wbGU6OmNsZWFyKCmAAeYBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAobWF4aVNhbXBsZTo6KikoZmxvYXQsIGZsb2F0LCBib29sLCBib29sKSwgdm9pZCwgbWF4aVNhbXBsZSosIGZsb2F0LCBmbG9hdCwgYm9vbCwgYm9vbD46Omludm9rZSh2b2lkIChtYXhpU2FtcGxlOjoqIGNvbnN0JikoZmxvYXQsIGZsb2F0LCBib29sLCBib29sKSwgbWF4aVNhbXBsZSosIGZsb2F0LCBmbG9hdCwgYm9vbCwgYm9vbCmBAaMEZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8Ym9vbCAobWF4aVNhbXBsZTo6Kikoc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiwgaW50KSwgYm9vbCwgbWF4aVNhbXBsZSosIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4sIGludD46Omludm9rZShib29sIChtYXhpU2FtcGxlOjoqIGNvbnN0Jikoc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiwgaW50KSwgbWF4aVNhbXBsZSosIGVtc2NyaXB0ZW46OmludGVybmFsOjpCaW5kaW5nVHlwZTxzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+LCB2b2lkPjo6J3VubmFtZWQnKiwgaW50KYIBQnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlNYXA+KG1heGlNYXAqKYMBN21heGlNYXA6Omxpbmxpbihkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSmEAe4BZW1zY3JpcHRlbjo6aW50ZXJuYWw6OkZ1bmN0aW9uSW52b2tlcjxkb3VibGUgKCopKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZT46Omludm9rZShkb3VibGUgKCoqKShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSksIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKYUBN21heGlNYXA6OmxpbmV4cChkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSmGATdtYXhpTWFwOjpleHBsaW4oZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUphwE1ZG91YmxlIG1heGlNYXA6OmNsYW1wPGRvdWJsZT4oZG91YmxlLCBkb3VibGUsIGRvdWJsZSmIAa4BZW1zY3JpcHRlbjo6aW50ZXJuYWw6OkZ1bmN0aW9uSW52b2tlcjxkb3VibGUgKCopKGRvdWJsZSwgZG91YmxlLCBkb3VibGUpLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGU+OjppbnZva2UoZG91YmxlICgqKikoZG91YmxlLCBkb3VibGUsIGRvdWJsZSksIGRvdWJsZSwgZG91YmxlLCBkb3VibGUpiQGxAWVtc2NyaXB0ZW46OmludGVybmFsOjpJbnZva2VyPGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGU+OjppbnZva2UoZG91YmxlICgqKShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSksIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKYoBQnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlEeW4+KG1heGlEeW4qKYsBNm1heGlEeW4qIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aUR5bj4oKYwBkAJlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlEeW46OiopKGRvdWJsZSwgZG91YmxlLCBsb25nLCBkb3VibGUsIGRvdWJsZSksIGRvdWJsZSwgbWF4aUR5biosIGRvdWJsZSwgZG91YmxlLCBsb25nLCBkb3VibGUsIGRvdWJsZT46Omludm9rZShkb3VibGUgKG1heGlEeW46OiogY29uc3QmKShkb3VibGUsIGRvdWJsZSwgbG9uZywgZG91YmxlLCBkb3VibGUpLCBtYXhpRHluKiwgZG91YmxlLCBkb3VibGUsIGxvbmcsIGRvdWJsZSwgZG91YmxlKY0BmAJlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlEeW46OiopKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKSwgZG91YmxlLCBtYXhpRHluKiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGU+OjppbnZva2UoZG91YmxlIChtYXhpRHluOjoqIGNvbnN0JikoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUpLCBtYXhpRHluKiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUpjgFCdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aUVudj4obWF4aUVudiopjwE2bWF4aUVudiogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpRW52PigpkAGEAmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aUVudjo6KikoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgbG9uZywgaW50KSwgZG91YmxlLCBtYXhpRW52KiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgbG9uZywgaW50Pjo6aW52b2tlKGRvdWJsZSAobWF4aUVudjo6KiBjb25zdCYpKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGxvbmcsIGludCksIG1heGlFbnYqLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBsb25nLCBpbnQpkQHEAmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aUVudjo6KikoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGxvbmcsIGludCksIGRvdWJsZSwgbWF4aUVudiosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBsb25nLCBpbnQ+OjppbnZva2UoZG91YmxlIChtYXhpRW52OjoqIGNvbnN0JikoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGxvbmcsIGludCksIG1heGlFbnYqLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgbG9uZywgaW50KZIBrAFlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlFbnY6OiopKGRvdWJsZSwgaW50KSwgZG91YmxlLCBtYXhpRW52KiwgZG91YmxlLCBpbnQ+OjppbnZva2UoZG91YmxlIChtYXhpRW52OjoqIGNvbnN0JikoZG91YmxlLCBpbnQpLCBtYXhpRW52KiwgZG91YmxlLCBpbnQpkwEbbWF4aUVudjo6Z2V0VHJpZ2dlcigpIGNvbnN0lAEYbWF4aUVudjo6c2V0VHJpZ2dlcihpbnQplQFCdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8Y29udmVydD4oY29udmVydCoplgFiZW1zY3JpcHRlbjo6aW50ZXJuYWw6OkZ1bmN0aW9uSW52b2tlcjxkb3VibGUgKCopKGludCksIGRvdWJsZSwgaW50Pjo6aW52b2tlKGRvdWJsZSAoKiopKGludCksIGludCmXAUhlbXNjcmlwdGVuOjppbnRlcm5hbDo6SW52b2tlcjxkb3VibGUsIGludD46Omludm9rZShkb3VibGUgKCopKGludCksIGludCmYARpjb252ZXJ0Ojptc1RvU2FtcHMoZG91YmxlKZkBbmVtc2NyaXB0ZW46OmludGVybmFsOjpGdW5jdGlvbkludm9rZXI8ZG91YmxlICgqKShkb3VibGUpLCBkb3VibGUsIGRvdWJsZT46Omludm9rZShkb3VibGUgKCoqKShkb3VibGUpLCBkb3VibGUpmgFRZW1zY3JpcHRlbjo6aW50ZXJuYWw6Okludm9rZXI8ZG91YmxlLCBkb3VibGU+OjppbnZva2UoZG91YmxlICgqKShkb3VibGUpLCBkb3VibGUpmwFWdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aVNhbXBsZUFuZEhvbGQ+KG1heGlTYW1wbGVBbmRIb2xkKimcAUptYXhpU2FtcGxlQW5kSG9sZCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpU2FtcGxlQW5kSG9sZD4oKZ0BJm1heGlTYW1wbGVBbmRIb2xkOjpzYWgoZG91YmxlLCBkb3VibGUpngFQdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aURpc3RvcnRpb24+KG1heGlEaXN0b3J0aW9uKimfASBtYXhpRGlzdG9ydGlvbjo6ZmFzdGF0YW4oZG91YmxlKaABKG1heGlEaXN0b3J0aW9uOjphdGFuRGlzdChkb3VibGUsIGRvdWJsZSmhASxtYXhpRGlzdG9ydGlvbjo6ZmFzdEF0YW5EaXN0KGRvdWJsZSwgZG91YmxlKaIBSnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlGbGFuZ2VyPihtYXhpRmxhbmdlciopowE+bWF4aUZsYW5nZXIqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aUZsYW5nZXI+KCmkAUFtYXhpRmxhbmdlcjo6ZmxhbmdlKGRvdWJsZSwgdW5zaWduZWQgaW50LCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKaUBwAJlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlGbGFuZ2VyOjoqKShkb3VibGUsIHVuc2lnbmVkIGludCwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSksIGRvdWJsZSwgbWF4aUZsYW5nZXIqLCBkb3VibGUsIHVuc2lnbmVkIGludCwgZG91YmxlLCBkb3VibGUsIGRvdWJsZT46Omludm9rZShkb3VibGUgKG1heGlGbGFuZ2VyOjoqIGNvbnN0JikoZG91YmxlLCB1bnNpZ25lZCBpbnQsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUpLCBtYXhpRmxhbmdlciosIGRvdWJsZSwgdW5zaWduZWQgaW50LCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKaYBSHZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlDaG9ydXM+KG1heGlDaG9ydXMqKacBPG1heGlDaG9ydXMqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aUNob3J1cz4oKagBQG1heGlDaG9ydXM6OmNob3J1cyhkb3VibGUsIHVuc2lnbmVkIGludCwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSmpAU52b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpRENCbG9ja2VyPihtYXhpRENCbG9ja2VyKimqAUJtYXhpRENCbG9ja2VyKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlEQ0Jsb2NrZXI+KCmrASNtYXhpRENCbG9ja2VyOjpwbGF5KGRvdWJsZSwgZG91YmxlKawBQnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlTVkY+KG1heGlTVkYqKa0BNm1heGlTVkYqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aVNWRj4oKa4BGm1heGlTVkY6OnNldEN1dG9mZihkb3VibGUprwEdbWF4aVNWRjo6c2V0UmVzb25hbmNlKGRvdWJsZSmwATVtYXhpU1ZGOjpwbGF5KGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKbEBRHZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlNYXRoPihtYXhpTWF0aCopsgFpZW1zY3JpcHRlbjo6aW50ZXJuYWw6Okludm9rZXI8ZG91YmxlLCBkb3VibGUsIGRvdWJsZT46Omludm9rZShkb3VibGUgKCopKGRvdWJsZSwgZG91YmxlKSwgZG91YmxlLCBkb3VibGUpswEdbWF4aU1hdGg6OmFkZChkb3VibGUsIGRvdWJsZSm0AR1tYXhpTWF0aDo6c3ViKGRvdWJsZSwgZG91YmxlKbUBHW1heGlNYXRoOjptdWwoZG91YmxlLCBkb3VibGUptgEdbWF4aU1hdGg6OmRpdihkb3VibGUsIGRvdWJsZSm3ARxtYXhpTWF0aDo6Z3QoZG91YmxlLCBkb3VibGUpuAEcbWF4aU1hdGg6Omx0KGRvdWJsZSwgZG91YmxlKbkBHW1heGlNYXRoOjpndGUoZG91YmxlLCBkb3VibGUpugEdbWF4aU1hdGg6Omx0ZShkb3VibGUsIGRvdWJsZSm7AR1tYXhpTWF0aDo6bW9kKGRvdWJsZSwgZG91YmxlKbwBFW1heGlNYXRoOjphYnMoZG91YmxlKb0BH21heGlNYXRoOjp4cG93eShkb3VibGUsIGRvdWJsZSm+AUZ2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpQ2xvY2s+KG1heGlDbG9jayopvwE6bWF4aUNsb2NrKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlDbG9jaz4oKcABGW1heGlDbG9jazo6aXNUaWNrKCkgY29uc3TBASJtYXhpQ2xvY2s6OmdldEN1cnJlbnRDb3VudCgpIGNvbnN0wgEfbWF4aUNsb2NrOjpzZXRDdXJyZW50Q291bnQoaW50KcMBH21heGlDbG9jazo6Z2V0TGFzdENvdW50KCkgY29uc3TEARxtYXhpQ2xvY2s6OnNldExhc3RDb3VudChpbnQpxQEZbWF4aUNsb2NrOjpnZXRCcHMoKSBjb25zdMYBFm1heGlDbG9jazo6c2V0QnBzKGludCnHARltYXhpQ2xvY2s6OmdldEJwbSgpIGNvbnN0yAEWbWF4aUNsb2NrOjpzZXRCcG0oaW50KckBF21heGlDbG9jazo6c2V0VGljayhpbnQpygEbbWF4aUNsb2NrOjpnZXRUaWNrcygpIGNvbnN0ywEYbWF4aUNsb2NrOjpzZXRUaWNrcyhpbnQpzAFgdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aUt1cmFtb3RvT3NjaWxsYXRvcj4obWF4aUt1cmFtb3RvT3NjaWxsYXRvciopzQFUbWF4aUt1cmFtb3RvT3NjaWxsYXRvciogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yPigpzgFkbWF4aUt1cmFtb3RvT3NjaWxsYXRvcjo6cGxheShkb3VibGUsIGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+Kc8B1gNlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlLdXJhbW90b09zY2lsbGF0b3I6OiopKGRvdWJsZSwgZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4pLCBkb3VibGUsIG1heGlLdXJhbW90b09zY2lsbGF0b3IqLCBkb3VibGUsIGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+ID46Omludm9rZShkb3VibGUgKG1heGlLdXJhbW90b09zY2lsbGF0b3I6OiogY29uc3QmKShkb3VibGUsIGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KSwgbWF4aUt1cmFtb3RvT3NjaWxsYXRvciosIGRvdWJsZSwgZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4qKdABZnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQ+KG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQqKdEBYHZvaWQgZW1zY3JpcHRlbjo6aW50ZXJuYWw6OnJhd19kZXN0cnVjdG9yPG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQ+KG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQqKdIBngFlbXNjcmlwdGVuOjppbnRlcm5hbDo6SW52b2tlcjxtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0KiwgdW5zaWduZWQgbG9uZyBjb25zdCYmPjo6aW52b2tlKG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQqICgqKSh1bnNpZ25lZCBsb25nIGNvbnN0JiYpLCB1bnNpZ25lZCBsb25nKdMBhAFtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQsIHVuc2lnbmVkIGxvbmcgY29uc3Q+KHVuc2lnbmVkIGxvbmcgY29uc3QmJinUAS9tYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0OjpwbGF5KGRvdWJsZSwgZG91YmxlKdUBOm1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQ6OnNldFBoYXNlKGRvdWJsZSwgdW5zaWduZWQgbG9uZynWAZYCZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAobWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldDo6KikoZG91YmxlLCB1bnNpZ25lZCBsb25nKSwgdm9pZCwgbWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldCosIGRvdWJsZSwgdW5zaWduZWQgbG9uZz46Omludm9rZSh2b2lkIChtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0OjoqIGNvbnN0JikoZG91YmxlLCB1bnNpZ25lZCBsb25nKSwgbWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldCosIGRvdWJsZSwgdW5zaWduZWQgbG9uZynXAWNtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0OjpzZXRQaGFzZXMoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+IGNvbnN0JinYATJtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0OjpnZXRQaGFzZSh1bnNpZ25lZCBsb25nKdkB/AFlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQ6OiopKHVuc2lnbmVkIGxvbmcpLCBkb3VibGUsIG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQqLCB1bnNpZ25lZCBsb25nPjo6aW52b2tlKGRvdWJsZSAobWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldDo6KiBjb25zdCYpKHVuc2lnbmVkIGxvbmcpLCBtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0KiwgdW5zaWduZWQgbG9uZynaASFtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0OjpzaXplKCnbAWp2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpQXN5bmNLdXJhbW90b09zY2lsbGF0b3I+KG1heGlBc3luY0t1cmFtb3RvT3NjaWxsYXRvciop3AGsAW1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQqIGVtc2NyaXB0ZW46OmJhc2U8bWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldD46OmNvbnZlcnRQb2ludGVyPG1heGlBc3luY0t1cmFtb3RvT3NjaWxsYXRvciwgbWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldD4obWF4aUFzeW5jS3VyYW1vdG9Pc2NpbGxhdG9yKindAYgBbWF4aUFzeW5jS3VyYW1vdG9Pc2NpbGxhdG9yKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlBc3luY0t1cmFtb3RvT3NjaWxsYXRvciwgdW5zaWduZWQgbG9uZyBjb25zdD4odW5zaWduZWQgbG9uZyBjb25zdCYmKd4BMW1heGlBc3luY0t1cmFtb3RvT3NjaWxsYXRvcjo6cGxheShkb3VibGUsIGRvdWJsZSnfATxtYXhpQXN5bmNLdXJhbW90b09zY2lsbGF0b3I6OnNldFBoYXNlKGRvdWJsZSwgdW5zaWduZWQgbG9uZyngAWVtYXhpQXN5bmNLdXJhbW90b09zY2lsbGF0b3I6OnNldFBoYXNlcyhzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4gY29uc3QmKeEBQnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlGRlQ+KG1heGlGRlQqKeIBPHZvaWQgZW1zY3JpcHRlbjo6aW50ZXJuYWw6OnJhd19kZXN0cnVjdG9yPG1heGlGRlQ+KG1heGlGRlQqKeMBNm1heGlGRlQqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aUZGVD4oKeQBrgFlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChtYXhpRkZUOjoqKShpbnQsIGludCwgaW50KSwgdm9pZCwgbWF4aUZGVCosIGludCwgaW50LCBpbnQ+OjppbnZva2Uodm9pZCAobWF4aUZGVDo6KiBjb25zdCYpKGludCwgaW50LCBpbnQpLCBtYXhpRkZUKiwgaW50LCBpbnQsIGludCnlAdoBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8Ym9vbCAobWF4aUZGVDo6KikoZmxvYXQsIG1heGlGRlQ6OmZmdE1vZGVzKSwgYm9vbCwgbWF4aUZGVCosIGZsb2F0LCBtYXhpRkZUOjpmZnRNb2Rlcz46Omludm9rZShib29sIChtYXhpRkZUOjoqIGNvbnN0JikoZmxvYXQsIG1heGlGRlQ6OmZmdE1vZGVzKSwgbWF4aUZGVCosIGZsb2F0LCBtYXhpRkZUOjpmZnRNb2RlcynmAXllbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxmbG9hdCAobWF4aUZGVDo6KikoKSwgZmxvYXQsIG1heGlGRlQqPjo6aW52b2tlKGZsb2F0IChtYXhpRkZUOjoqIGNvbnN0JikoKSwgbWF4aUZGVCop5wGJAmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mIChtYXhpRkZUOjoqKSgpLCBzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+JiwgbWF4aUZGVCo+OjppbnZva2Uoc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiYgKG1heGlGRlQ6OiogY29uc3QmKSgpLCBtYXhpRkZUKinoARptYXhpRkZUOjpnZXRNYWduaXR1ZGVzREIoKekBFG1heGlGRlQ6OmdldFBoYXNlcygp6gEVbWF4aUZGVDo6Z2V0TnVtQmlucygp6wEVbWF4aUZGVDo6Z2V0RkZUU2l6ZSgp7AEVbWF4aUZGVDo6Z2V0SG9wU2l6ZSgp7QEYbWF4aUZGVDo6Z2V0V2luZG93U2l6ZSgp7gFEdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aUlGRlQ+KG1heGlJRkZUKinvAT52b2lkIGVtc2NyaXB0ZW46OmludGVybmFsOjpyYXdfZGVzdHJ1Y3RvcjxtYXhpSUZGVD4obWF4aUlGRlQqKfABOG1heGlJRkZUKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlJRkZUPigp8QGBBWVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGZsb2F0IChtYXhpSUZGVDo6Kikoc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiYsIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mLCBtYXhpSUZGVDo6ZmZ0TW9kZXMpLCBmbG9hdCwgbWF4aUlGRlQqLCBzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+Jiwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiYsIG1heGlJRkZUOjpmZnRNb2Rlcz46Omludm9rZShmbG9hdCAobWF4aUlGRlQ6OiogY29uc3QmKShzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+Jiwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiYsIG1heGlJRkZUOjpmZnRNb2RlcyksIG1heGlJRkZUKiwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiosIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4qLCBtYXhpSUZGVDo6ZmZ0TW9kZXMp8gFldm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+ID4obWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+KinzAV92b2lkIGVtc2NyaXB0ZW46OmludGVybmFsOjpyYXdfZGVzdHJ1Y3RvcjxtYXhpTUZDQ0FuYWx5c2VyPGRvdWJsZT4gPihtYXhpTUZDQ0FuYWx5c2VyPGRvdWJsZT4qKfQBWW1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPiogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpTUZDQ0FuYWx5c2VyPGRvdWJsZT4gPigp9QFZbWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+OjpzZXR1cCh1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50LCBkb3VibGUsIGRvdWJsZSn2AZ4DZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAobWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+OjoqKSh1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50LCBkb3VibGUsIGRvdWJsZSksIHZvaWQsIG1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPiosIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQsIGRvdWJsZSwgZG91YmxlPjo6aW52b2tlKHZvaWQgKG1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPjo6KiBjb25zdCYpKHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQsIGRvdWJsZSwgZG91YmxlKSwgbWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+KiwgdW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgZG91YmxlLCBkb3VibGUp9wFVbWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+OjptZmNjKHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mKfgBqwRlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mIChtYXhpTUZDQ0FuYWx5c2VyPGRvdWJsZT46OiopKHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mKSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgbWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+Kiwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiY+OjppbnZva2Uoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiAobWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+OjoqIGNvbnN0Jikoc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiYpLCBtYXhpTUZDQ0FuYWx5c2VyPGRvdWJsZT4qLCBzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+Kin5AZUBdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8c3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+ID4oc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+Kin6AY8Bdm9pZCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6cmF3X2Rlc3RydWN0b3I8c3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+ID4oc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+Kin7AYkBc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiA+KCn8AUdzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID46OnB1c2hfYmFjayhpbnQgY29uc3QmKf0BvwJlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID46OiopKGludCBjb25zdCYpLCB2b2lkLCBzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4qLCBpbnQgY29uc3QmPjo6aW52b2tlKHZvaWQgKHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPjo6KiBjb25zdCYpKGludCBjb25zdCYpLCBzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4qLCBpbnQp/gFTc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+OjpyZXNpemUodW5zaWduZWQgbG9uZywgaW50IGNvbnN0Jin/AfsCZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAoc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+OjoqKSh1bnNpZ25lZCBsb25nLCBpbnQgY29uc3QmKSwgdm9pZCwgc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+KiwgdW5zaWduZWQgbG9uZywgaW50IGNvbnN0Jj46Omludm9rZSh2b2lkIChzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID46OiogY29uc3QmKSh1bnNpZ25lZCBsb25nLCBpbnQgY29uc3QmKSwgc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+KiwgdW5zaWduZWQgbG9uZywgaW50KYACPnN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPjo6c2l6ZSgpIGNvbnN0gQKiAWVtc2NyaXB0ZW46OmludGVybmFsOjpWZWN0b3JBY2Nlc3M8c3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+ID46OmdldChzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4gY29uc3QmLCB1bnNpZ25lZCBsb25nKYICgwNlbXNjcmlwdGVuOjppbnRlcm5hbDo6RnVuY3Rpb25JbnZva2VyPGVtc2NyaXB0ZW46OnZhbCAoKikoc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+IGNvbnN0JiwgdW5zaWduZWQgbG9uZyksIGVtc2NyaXB0ZW46OnZhbCwgc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+IGNvbnN0JiwgdW5zaWduZWQgbG9uZz46Omludm9rZShlbXNjcmlwdGVuOjp2YWwgKCoqKShzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4gY29uc3QmLCB1bnNpZ25lZCBsb25nKSwgc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+KiwgdW5zaWduZWQgbG9uZymDAqgBZW1zY3JpcHRlbjo6aW50ZXJuYWw6OlZlY3RvckFjY2VzczxzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4gPjo6c2V0KHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiYsIHVuc2lnbmVkIGxvbmcsIGludCBjb25zdCYphAL5AmVtc2NyaXB0ZW46OmludGVybmFsOjpGdW5jdGlvbkludm9rZXI8Ym9vbCAoKikoc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+JiwgdW5zaWduZWQgbG9uZywgaW50IGNvbnN0JiksIGJvb2wsIHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiYsIHVuc2lnbmVkIGxvbmcsIGludCBjb25zdCY+OjppbnZva2UoYm9vbCAoKiopKHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiYsIHVuc2lnbmVkIGxvbmcsIGludCBjb25zdCYpLCBzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4qLCB1bnNpZ25lZCBsb25nLCBpbnQphQKhAXZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiA+KHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiophgJQc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+OjpwdXNoX2JhY2soZG91YmxlIGNvbnN0JimHAuMCZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+OjoqKShkb3VibGUgY29uc3QmKSwgdm9pZCwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KiwgZG91YmxlIGNvbnN0Jj46Omludm9rZSh2b2lkIChzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID46OiogY29uc3QmKShkb3VibGUgY29uc3QmKSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KiwgZG91YmxlKYgCXHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPjo6cmVzaXplKHVuc2lnbmVkIGxvbmcsIGRvdWJsZSBjb25zdCYpiQKfA2Vtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPjo6KikodW5zaWduZWQgbG9uZywgZG91YmxlIGNvbnN0JiksIHZvaWQsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiosIHVuc2lnbmVkIGxvbmcsIGRvdWJsZSBjb25zdCY+OjppbnZva2Uodm9pZCAoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+OjoqIGNvbnN0JikodW5zaWduZWQgbG9uZywgZG91YmxlIGNvbnN0JiksIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiosIHVuc2lnbmVkIGxvbmcsIGRvdWJsZSmKAkRzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID46OnNpemUoKSBjb25zdIsCrgFlbXNjcmlwdGVuOjppbnRlcm5hbDo6VmVjdG9yQWNjZXNzPHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiA+OjpnZXQoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+IGNvbnN0JiwgdW5zaWduZWQgbG9uZymMArcBZW1zY3JpcHRlbjo6aW50ZXJuYWw6OlZlY3RvckFjY2VzczxzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4gPjo6c2V0KHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIHVuc2lnbmVkIGxvbmcsIGRvdWJsZSBjb25zdCYpjQKdA2Vtc2NyaXB0ZW46OmludGVybmFsOjpGdW5jdGlvbkludm9rZXI8Ym9vbCAoKikoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgdW5zaWduZWQgbG9uZywgZG91YmxlIGNvbnN0JiksIGJvb2wsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIHVuc2lnbmVkIGxvbmcsIGRvdWJsZSBjb25zdCY+OjppbnZva2UoYm9vbCAoKiopKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIHVuc2lnbmVkIGxvbmcsIGRvdWJsZSBjb25zdCYpLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4qLCB1bnNpZ25lZCBsb25nLCBkb3VibGUpjgKZAXZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+ID4oc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4qKY8CSnN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpwdXNoX2JhY2soY2hhciBjb25zdCYpkALLAmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjoqKShjaGFyIGNvbnN0JiksIHZvaWQsIHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+KiwgY2hhciBjb25zdCY+OjppbnZva2Uodm9pZCAoc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OiogY29uc3QmKShjaGFyIGNvbnN0JiksIHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+KiwgY2hhcimRAlZzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6cmVzaXplKHVuc2lnbmVkIGxvbmcsIGNoYXIgY29uc3QmKZIChwNlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6KikodW5zaWduZWQgbG9uZywgY2hhciBjb25zdCYpLCB2b2lkLCBzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiosIHVuc2lnbmVkIGxvbmcsIGNoYXIgY29uc3QmPjo6aW52b2tlKHZvaWQgKHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjoqIGNvbnN0JikodW5zaWduZWQgbG9uZywgY2hhciBjb25zdCYpLCBzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiosIHVuc2lnbmVkIGxvbmcsIGNoYXIpkwJAc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OnNpemUoKSBjb25zdJQCpgFlbXNjcmlwdGVuOjppbnRlcm5hbDo6VmVjdG9yQWNjZXNzPHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+ID46OmdldChzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCYsIHVuc2lnbmVkIGxvbmcplQKtAWVtc2NyaXB0ZW46OmludGVybmFsOjpWZWN0b3JBY2Nlc3M8c3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gPjo6c2V0KHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+JiwgdW5zaWduZWQgbG9uZywgY2hhciBjb25zdCYplgKFA2Vtc2NyaXB0ZW46OmludGVybmFsOjpGdW5jdGlvbkludm9rZXI8Ym9vbCAoKikoc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4mLCB1bnNpZ25lZCBsb25nLCBjaGFyIGNvbnN0JiksIGJvb2wsIHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+JiwgdW5zaWduZWQgbG9uZywgY2hhciBjb25zdCY+OjppbnZva2UoYm9vbCAoKiopKHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+JiwgdW5zaWduZWQgbG9uZywgY2hhciBjb25zdCYpLCBzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiosIHVuc2lnbmVkIGxvbmcsIGNoYXIplwK9AXZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPHN0ZDo6X18yOjp2ZWN0b3I8dW5zaWduZWQgY2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjx1bnNpZ25lZCBjaGFyPiA+ID4oc3RkOjpfXzI6OnZlY3Rvcjx1bnNpZ25lZCBjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHVuc2lnbmVkIGNoYXI+ID4qKZgCygFlbXNjcmlwdGVuOjppbnRlcm5hbDo6VmVjdG9yQWNjZXNzPHN0ZDo6X18yOjp2ZWN0b3I8dW5zaWduZWQgY2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjx1bnNpZ25lZCBjaGFyPiA+ID46OmdldChzdGQ6Ol9fMjo6dmVjdG9yPHVuc2lnbmVkIGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8dW5zaWduZWQgY2hhcj4gPiBjb25zdCYsIHVuc2lnbmVkIGxvbmcpmQKdAXZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4gPihzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+KimaAtcCZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAoc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPjo6KikoZmxvYXQgY29uc3QmKSwgdm9pZCwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiosIGZsb2F0IGNvbnN0Jj46Omludm9rZSh2b2lkIChzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+OjoqIGNvbnN0JikoZmxvYXQgY29uc3QmKSwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiosIGZsb2F0KZsCkwNlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+OjoqKSh1bnNpZ25lZCBsb25nLCBmbG9hdCBjb25zdCYpLCB2b2lkLCBzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+KiwgdW5zaWduZWQgbG9uZywgZmxvYXQgY29uc3QmPjo6aW52b2tlKHZvaWQgKHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID46OiogY29uc3QmKSh1bnNpZ25lZCBsb25nLCBmbG9hdCBjb25zdCYpLCBzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+KiwgdW5zaWduZWQgbG9uZywgZmxvYXQpnAKqAWVtc2NyaXB0ZW46OmludGVybmFsOjpWZWN0b3JBY2Nlc3M8c3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiA+OjpnZXQoc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiBjb25zdCYsIHVuc2lnbmVkIGxvbmcpnQKRA2Vtc2NyaXB0ZW46OmludGVybmFsOjpGdW5jdGlvbkludm9rZXI8Ym9vbCAoKikoc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiYsIHVuc2lnbmVkIGxvbmcsIGZsb2F0IGNvbnN0JiksIGJvb2wsIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mLCB1bnNpZ25lZCBsb25nLCBmbG9hdCBjb25zdCY+OjppbnZva2UoYm9vbCAoKiopKHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mLCB1bnNpZ25lZCBsb25nLCBmbG9hdCBjb25zdCYpLCBzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+KiwgdW5zaWduZWQgbG9uZywgZmxvYXQpngJec3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+OjpfX2FwcGVuZCh1bnNpZ25lZCBsb25nLCBkb3VibGUgY29uc3QmKZ8COG1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPjo6Y2FsY01lbEZpbHRlckJhbmsoZG91YmxlLCBpbnQpoAJmRW1zY3JpcHRlbkJpbmRpbmdJbml0aWFsaXplcl9teV9tb2R1bGVfbWF4aUdyYWluczo6RW1zY3JpcHRlbkJpbmRpbmdJbml0aWFsaXplcl9teV9tb2R1bGVfbWF4aUdyYWlucygpoQJzdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+KG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qKaICbXZvaWQgZW1zY3JpcHRlbjo6aW50ZXJuYWw6OnJhd19kZXN0cnVjdG9yPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPihtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KimjApgBZW1zY3JpcHRlbjo6c21hcnRfcHRyX3RyYWl0PHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+OjpnZXQoc3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+IGNvbnN0JimkAmZlbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46OmNvbnN0cnVjdF9udWxsKCmlAp0BZW1zY3JpcHRlbjo6c21hcnRfcHRyX3RyYWl0PHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+OjpzaGFyZShtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KiwgZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ol9FTV9WQUwqKaYCmwF2b2lkIGVtc2NyaXB0ZW46OmludGVybmFsOjpyYXdfZGVzdHJ1Y3RvcjxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPihzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4qKacCnAFlbXNjcmlwdGVuOjppbnRlcm5hbDo6SW52b2tlcjxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6aW52b2tlKHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiAoKikoKSmoAsIBc3RkOjpfXzI6OmVuYWJsZV9pZjwhKGlzX2FycmF5PG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPjo6dmFsdWUpLCBzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6dHlwZSBzdGQ6Ol9fMjo6bWFrZV9zaGFyZWQ8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+KCmpAjdtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+OjpzZXRTYW1wbGUobWF4aVNhbXBsZSopqgI4bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6Z2V0Tm9ybWFsaXNlZFBvc2l0aW9uKCmrAjRtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+OjpzZXRQb3NpdGlvbihkb3VibGUprAJCbWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6cGxheShkb3VibGUsIGRvdWJsZSwgaW50LCBkb3VibGUprQLMAmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6KikoZG91YmxlLCBkb3VibGUsIGludCwgZG91YmxlKSwgZG91YmxlLCBtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KiwgZG91YmxlLCBkb3VibGUsIGludCwgZG91YmxlPjo6aW52b2tlKGRvdWJsZSAobWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6KiBjb25zdCYpKGRvdWJsZSwgZG91YmxlLCBpbnQsIGRvdWJsZSksIG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qLCBkb3VibGUsIGRvdWJsZSwgaW50LCBkb3VibGUprgJEbWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6cGxheUF0UG9zaXRpb24oZG91YmxlLCBkb3VibGUsIGludCmvAqwCZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+OjoqKShkb3VibGUsIGRvdWJsZSwgaW50KSwgZG91YmxlLCBtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KiwgZG91YmxlLCBkb3VibGUsIGludD46Omludm9rZShkb3VibGUgKG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OiogY29uc3QmKShkb3VibGUsIGRvdWJsZSwgaW50KSwgbWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGRvdWJsZSwgZG91YmxlLCBpbnQpsAJxdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4obWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+KimxAmt2b2lkIGVtc2NyaXB0ZW46OmludGVybmFsOjpyYXdfZGVzdHJ1Y3RvcjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPihtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4qKbICmwFlbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4gPjo6c2hhcmUobWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+KiwgZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ol9FTV9WQUwqKbMCvwFzdGQ6Ol9fMjo6ZW5hYmxlX2lmPCEoaXNfYXJyYXk8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID46OnZhbHVlKSwgc3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4gPjo6dHlwZSBzdGQ6Ol9fMjo6bWFrZV9zaGFyZWQ8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4oKbQCNm1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPjo6c2V0U2FtcGxlKG1heGlTYW1wbGUqKbUCQW1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPjo6cGxheShkb3VibGUsIGRvdWJsZSwgaW50LCBkb3VibGUptgJrdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4obWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+Kim3Al9tYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4oKbgCM21heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6c2V0U2FtcGxlKG1heGlTYW1wbGUqKbkCMW1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6c2V0TG9vcFN0YXJ0KGRvdWJsZSm6Ai9tYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OnNldExvb3BFbmQoZG91YmxlKbsCKW1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6Z2V0TG9vcEVuZCgpvAJGbWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+OjpwbGF5KGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGludCwgZG91YmxlKb0C3AJlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6KikoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgaW50LCBkb3VibGUpLCBkb3VibGUsIG1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGludCwgZG91YmxlPjo6aW52b2tlKGRvdWJsZSAobWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+OjoqIGNvbnN0JikoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgaW50LCBkb3VibGUpLCBtYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBpbnQsIGRvdWJsZSm+AkhtYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OnBsYXlBdFBvc2l0aW9uKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGludCm/ArwCZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OiopKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGludCksIGRvdWJsZSwgbWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgaW50Pjo6aW52b2tlKGRvdWJsZSAobWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+OjoqIGNvbnN0JikoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgaW50KSwgbWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgaW50KcACcG1heGlHcmFpbjxoYW5uV2luRnVuY3Rvcj46Om1heGlHcmFpbihtYXhpU2FtcGxlKiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgbWF4aUdyYWluV2luZG93Q2FjaGU8aGFubldpbkZ1bmN0b3I+KinBAmJFbXNjcmlwdGVuQmluZGluZ0luaXRpYWxpemVyX215X21vZHVsZV9tYXhpYml0czo6RW1zY3JpcHRlbkJpbmRpbmdJbml0aWFsaXplcl9teV9tb2R1bGVfbWF4aWJpdHMoKcICRHZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlCaXRzPihtYXhpQml0cyopwwJvZW1zY3JpcHRlbjo6aW50ZXJuYWw6Okludm9rZXI8dW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQ+OjppbnZva2UodW5zaWduZWQgaW50ICgqKSh1bnNpZ25lZCBpbnQpLCB1bnNpZ25lZCBpbnQpxAKZAWVtc2NyaXB0ZW46OmludGVybmFsOjpJbnZva2VyPHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQ+OjppbnZva2UodW5zaWduZWQgaW50ICgqKSh1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCksIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KcUCKG1heGlCaXRzOjphdCh1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCnGAiltYXhpQml0czo6c2hsKHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KccCKW1heGlCaXRzOjpzaHIodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQpyALDAWVtc2NyaXB0ZW46OmludGVybmFsOjpJbnZva2VyPHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludD46Omludm9rZSh1bnNpZ25lZCBpbnQgKCopKHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQpLCB1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KckCNW1heGlCaXRzOjpyKHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQpygIqbWF4aUJpdHM6OmxhbmQodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQpywIpbWF4aUJpdHM6Omxvcih1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCnMAiptYXhpQml0czo6bHhvcih1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCnNAhttYXhpQml0czo6bmVnKHVuc2lnbmVkIGludCnOAhttYXhpQml0czo6aW5jKHVuc2lnbmVkIGludCnPAhttYXhpQml0czo6ZGVjKHVuc2lnbmVkIGludCnQAiltYXhpQml0czo6YWRkKHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KdECKW1heGlCaXRzOjpzdWIodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQp0gIpbWF4aUJpdHM6Om11bCh1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCnTAiltYXhpQml0czo6ZGl2KHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KdQCKG1heGlCaXRzOjpndCh1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCnVAihtYXhpQml0czo6bHQodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQp1gIpbWF4aUJpdHM6Omd0ZSh1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCnXAiltYXhpQml0czo6bHRlKHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KdgCKG1heGlCaXRzOjplcSh1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCnZAhFtYXhpQml0czo6bm9pc2UoKdoCIG1heGlCaXRzOjp0b1NpZ25hbCh1bnNpZ25lZCBpbnQp2wIkbWF4aUJpdHM6OnRvVHJpZ1NpZ25hbCh1bnNpZ25lZCBpbnQp3AJdZW1zY3JpcHRlbjo6aW50ZXJuYWw6Okludm9rZXI8dW5zaWduZWQgaW50LCBkb3VibGU+OjppbnZva2UodW5zaWduZWQgaW50ICgqKShkb3VibGUpLCBkb3VibGUp3QIcbWF4aUJpdHM6OmZyb21TaWduYWwoZG91YmxlKd4CSnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlUcmlnZ2VyPihtYXhpVHJpZ2dlciop3wI+bWF4aVRyaWdnZXIqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aVRyaWdnZXI+KCngAhltYXhpVHJpZ2dlcjo6b25aWChkb3VibGUp4QImbWF4aVRyaWdnZXI6Om9uQ2hhbmdlZChkb3VibGUsIGRvdWJsZSniAkp2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpQ291bnRlcj4obWF4aUNvdW50ZXIqKeMCPm1heGlDb3VudGVyKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlDb3VudGVyPigp5AIibWF4aUNvdW50ZXI6OmNvdW50KGRvdWJsZSwgZG91YmxlKeUCRnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlJbmRleD4obWF4aUluZGV4KinmAjptYXhpSW5kZXgqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aUluZGV4Pigp5wJXbWF4aUluZGV4OjpwdWxsKGRvdWJsZSwgZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4p6AJMdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aVJhdGlvU2VxPihtYXhpUmF0aW9TZXEqKekCVm1heGlSYXRpb1NlcTo6cGxheVRyaWcoZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4p6gKOA2Vtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aVJhdGlvU2VxOjoqKShkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiksIGRvdWJsZSwgbWF4aVJhdGlvU2VxKiwgZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4gPjo6aW52b2tlKGRvdWJsZSAobWF4aVJhdGlvU2VxOjoqIGNvbnN0JikoZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4pLCBtYXhpUmF0aW9TZXEqLCBkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiop6wKQAW1heGlSYXRpb1NlcTo6cGxheVZhbHVlcyhkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KewC7wRlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlSYXRpb1NlcTo6KikoZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4sIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiksIGRvdWJsZSwgbWF4aVJhdGlvU2VxKiwgZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4sIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiA+OjppbnZva2UoZG91YmxlIChtYXhpUmF0aW9TZXE6OiogY29uc3QmKShkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KSwgbWF4aVJhdGlvU2VxKiwgZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4qLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4qKe0CTkVtc2NyaXB0ZW5CaW5kaW5nSW5pdGlhbGl6ZXJfbWF4aVZlcmI6OkVtc2NyaXB0ZW5CaW5kaW5nSW5pdGlhbGl6ZXJfbWF4aVZlcmIoKe4CTnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlTYXRSZXZlcmI+KG1heGlTYXRSZXZlcmIqKe8CSHZvaWQgZW1zY3JpcHRlbjo6aW50ZXJuYWw6OnJhd19kZXN0cnVjdG9yPG1heGlTYXRSZXZlcmI+KG1heGlTYXRSZXZlcmIqKfACQm1heGlTYXRSZXZlcmIqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aVNhdFJldmVyYj4oKfECTHZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlGcmVlVmVyYj4obWF4aUZyZWVWZXJiKinyAkBtYXhpRnJlZVZlcmIqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aUZyZWVWZXJiPigp8wIrc3RkOjpfXzI6Ol9fdGhyb3dfbGVuZ3RoX2Vycm9yKGNoYXIgY29uc3QqKfQCZHZvaWQgc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+OjpfX3B1c2hfYmFja19zbG93X3BhdGg8aW50IGNvbnN0Jj4oaW50IGNvbnN0Jin1AlVzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID46Ol9fYXBwZW5kKHVuc2lnbmVkIGxvbmcsIGludCBjb25zdCYp9gJwdm9pZCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID46Ol9fcHVzaF9iYWNrX3Nsb3dfcGF0aDxkb3VibGUgY29uc3QmPihkb3VibGUgY29uc3QmKfcCWHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpfX2FwcGVuZCh1bnNpZ25lZCBsb25nLCBjaGFyIGNvbnN0Jin4Am9zdGQ6Ol9fMjo6dmVjdG9yPG1heGlLdXJhbW90b09zY2lsbGF0b3IsIHN0ZDo6X18yOjphbGxvY2F0b3I8bWF4aUt1cmFtb3RvT3NjaWxsYXRvcj4gPjo6X19hcHBlbmQodW5zaWduZWQgbG9uZyn5Ak9zdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID46Ol9fYXBwZW5kKHVuc2lnbmVkIGxvbmcp+gITbWF4aUZGVDo6fm1heGlGRlQoKfsCM21heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46On5tYXhpVGltZVN0cmV0Y2goKfwCgARzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID46OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiwgZW1zY3JpcHRlbjo6c21hcnRfcHRyX3RyYWl0PHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp2YWxfZGVsZXRlcj4obWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6dmFsX2RlbGV0ZXIsIHN0ZDo6X18yOjplbmFibGVfaWY8aXNfY29udmVydGlibGU8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qPjo6dmFsdWUsIHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPjo6X19uYXQ+Ojp0eXBlKf0CemVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6dmFsX2RlbGV0ZXI6Om9wZXJhdG9yKCkodm9pZCBjb25zdCop/gL0AXN0ZDo6X18yOjpfX3NoYXJlZF9wdHJfcG9pbnRlcjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KiwgZW1zY3JpcHRlbjo6c21hcnRfcHRyX3RyYWl0PHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp2YWxfZGVsZXRlciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6fl9fc2hhcmVkX3B0cl9wb2ludGVyKCn/AvYBc3RkOjpfXzI6Ol9fc2hhcmVkX3B0cl9wb2ludGVyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qLCBlbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46OnZhbF9kZWxldGVyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp+X19zaGFyZWRfcHRyX3BvaW50ZXIoKS4xgAPvAXN0ZDo6X18yOjpfX3NoYXJlZF9wdHJfcG9pbnRlcjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KiwgZW1zY3JpcHRlbjo6c21hcnRfcHRyX3RyYWl0PHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp2YWxfZGVsZXRlciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6X19vbl96ZXJvX3NoYXJlZCgpgQOHAnN0ZDo6X18yOjpfX3NoYXJlZF9wdHJfcG9pbnRlcjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KiwgZW1zY3JpcHRlbjo6c21hcnRfcHRyX3RyYWl0PHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp2YWxfZGVsZXRlciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6X19nZXRfZGVsZXRlcihzdGQ6OnR5cGVfaW5mbyBjb25zdCYpIGNvbnN0ggP0AXN0ZDo6X18yOjpfX3NoYXJlZF9wdHJfcG9pbnRlcjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KiwgZW1zY3JpcHRlbjo6c21hcnRfcHRyX3RyYWl0PHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp2YWxfZGVsZXRlciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6X19vbl96ZXJvX3NoYXJlZF93ZWFrKCmDA5ABc3RkOjpfXzI6Ol9fc2hhcmVkX3B0cl9lbXBsYWNlPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46On5fX3NoYXJlZF9wdHJfZW1wbGFjZSgphAOSAXN0ZDo6X18yOjpfX3NoYXJlZF9wdHJfZW1wbGFjZTxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp+X19zaGFyZWRfcHRyX2VtcGxhY2UoKS4xhQOLAXN0ZDo6X18yOjpfX3NoYXJlZF9wdHJfZW1wbGFjZTxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+OjpfX29uX3plcm9fc2hhcmVkKCmGAyFtYXhpR3JhaW48aGFubldpbkZ1bmN0b3I+OjpwbGF5KCmHAzFtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj46On5tYXhpUGl0Y2hTaGlmdCgpiAP4A3N0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+OjpzaGFyZWRfcHRyPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiwgZW1zY3JpcHRlbjo6c21hcnRfcHRyX3RyYWl0PHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+ID46OnZhbF9kZWxldGVyPihtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4qLCBlbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4gPjo6dmFsX2RlbGV0ZXIsIHN0ZDo6X18yOjplbmFibGVfaWY8aXNfY29udmVydGlibGU8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+KiwgbWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+Kj46OnZhbHVlLCBzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPjo6X19uYXQ+Ojp0eXBlKYkD8QFzdGQ6Ol9fMjo6X19zaGFyZWRfcHRyX3BvaW50ZXI8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+KiwgZW1zY3JpcHRlbjo6c21hcnRfcHRyX3RyYWl0PHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+ID46OnZhbF9kZWxldGVyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+ID46On5fX3NoYXJlZF9wdHJfcG9pbnRlcigpigPzAXN0ZDo6X18yOjpfX3NoYXJlZF9wdHJfcG9pbnRlcjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4qLCBlbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4gPjo6dmFsX2RlbGV0ZXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4gPjo6fl9fc2hhcmVkX3B0cl9wb2ludGVyKCkuMYsDhAJzdGQ6Ol9fMjo6X19zaGFyZWRfcHRyX3BvaW50ZXI8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+KiwgZW1zY3JpcHRlbjo6c21hcnRfcHRyX3RyYWl0PHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+ID46OnZhbF9kZWxldGVyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+ID46Ol9fZ2V0X2RlbGV0ZXIoc3RkOjp0eXBlX2luZm8gY29uc3QmKSBjb25zdIwDjgFzdGQ6Ol9fMjo6X19zaGFyZWRfcHRyX2VtcGxhY2U8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+ID46On5fX3NoYXJlZF9wdHJfZW1wbGFjZSgpjQOQAXN0ZDo6X18yOjpfX3NoYXJlZF9wdHJfZW1wbGFjZTxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4gPjo6fl9fc2hhcmVkX3B0cl9lbXBsYWNlKCkuMY4DiQFzdGQ6Ol9fMjo6X19zaGFyZWRfcHRyX2VtcGxhY2U8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+ID46Ol9fb25femVyb19zaGFyZWQoKY8DJF9HTE9CQUxfX3N1Yl9JX21heGltaWxpYW4uZW1iaW5kLmNwcJADEG1heGlPc2M6Om5vaXNlKCmRAxltYXhpT3NjOjpzaW5ld2F2ZShkb3VibGUpkgMZbWF4aU9zYzo6c2luZWJ1ZjQoZG91YmxlKZMDGG1heGlPc2M6OnNpbmVidWYoZG91YmxlKZQDGG1heGlPc2M6OmNvc3dhdmUoZG91YmxlKZUDF21heGlPc2M6OnBoYXNvcihkb3VibGUplgMXbWF4aU9zYzo6c3F1YXJlKGRvdWJsZSmXAx5tYXhpT3NjOjpwdWxzZShkb3VibGUsIGRvdWJsZSmYAxhtYXhpT3NjOjppbXB1bHNlKGRvdWJsZSmZAydtYXhpT3NjOjpwaGFzb3IoZG91YmxlLCBkb3VibGUsIGRvdWJsZSmaAxRtYXhpT3NjOjpzYXcoZG91YmxlKZsDFW1heGlPc2M6OnNhd24oZG91YmxlKZwDGW1heGlPc2M6OnRyaWFuZ2xlKGRvdWJsZSmdA1BtYXhpRW52ZWxvcGU6OmxpbmUoaW50LCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mKZ4DIm1heGlFbnZlbG9wZTo6dHJpZ2dlcihpbnQsIGRvdWJsZSmfAx5tYXhpRGVsYXlsaW5lOjptYXhpRGVsYXlsaW5lKCmgAyZtYXhpRGVsYXlsaW5lOjpkbChkb3VibGUsIGludCwgZG91YmxlKaEDK21heGlEZWxheWxpbmU6OmRsKGRvdWJsZSwgaW50LCBkb3VibGUsIGludCmiAyJtYXhpRmlsdGVyOjpsb3Bhc3MoZG91YmxlLCBkb3VibGUpowMibWF4aUZpbHRlcjo6aGlwYXNzKGRvdWJsZSwgZG91YmxlKaQDKW1heGlGaWx0ZXI6OmxvcmVzKGRvdWJsZSwgZG91YmxlLCBkb3VibGUppQMpbWF4aUZpbHRlcjo6aGlyZXMoZG91YmxlLCBkb3VibGUsIGRvdWJsZSmmAyxtYXhpRmlsdGVyOjpiYW5kcGFzcyhkb3VibGUsIGRvdWJsZSwgZG91YmxlKacDWG1heGlNaXg6OnN0ZXJlbyhkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGRvdWJsZSmoA15tYXhpTWl4OjpxdWFkKGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgZG91YmxlLCBkb3VibGUpqQNrbWF4aU1peDo6YW1iaXNvbmljKGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSmqA2xtYXhpU2FtcGxlOjpsb2FkKHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4sIGludCmrAxJtYXhpU2FtcGxlOjpyZWFkKCmsA2dzdGQ6Ol9fMjo6YmFzaWNfaWZzdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OmJhc2ljX2lmc3RyZWFtKGNoYXIgY29uc3QqLCB1bnNpZ25lZCBpbnQprQPdAXN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+JiBzdGQ6Ol9fMjo6X19wdXRfY2hhcmFjdGVyX3NlcXVlbmNlPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+KHN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+JiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGxvbmcprgNNc3RkOjpfXzI6OnZlY3RvcjxzaG9ydCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxzaG9ydD4gPjo6X19hcHBlbmQodW5zaWduZWQgbG9uZymvA01zdGQ6Ol9fMjo6YmFzaWNfZmlsZWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX2ZpbGVidWYoKbADbG1heGlTYW1wbGU6OnNldFNhbXBsZUZyb21PZ2dCbG9iKHN0ZDo6X18yOjp2ZWN0b3I8dW5zaWduZWQgY2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjx1bnNpZ25lZCBjaGFyPiA+JiwgaW50KbEDTHN0ZDo6X18yOjpiYXNpY19maWxlYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpiYXNpY19maWxlYnVmKCmyA1xzdGQ6Ol9fMjo6YmFzaWNfZmlsZWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6b3BlbihjaGFyIGNvbnN0KiwgdW5zaWduZWQgaW50KbMDT3N0ZDo6X18yOjpiYXNpY19pZnN0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX2lmc3RyZWFtKCm0AxVtYXhpU2FtcGxlOjppc1JlYWR5KCm1A05tYXhpU2FtcGxlOjpzZXRTYW1wbGUoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+Jim2A/YBc3RkOjpfXzI6OmVuYWJsZV9pZjwoX19pc19mb3J3YXJkX2l0ZXJhdG9yPGRvdWJsZSo+Ojp2YWx1ZSkgJiYgKGlzX2NvbnN0cnVjdGlibGU8ZG91YmxlLCBzdGQ6Ol9fMjo6aXRlcmF0b3JfdHJhaXRzPGRvdWJsZSo+OjpyZWZlcmVuY2U+Ojp2YWx1ZSksIHZvaWQ+Ojp0eXBlIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPjo6YXNzaWduPGRvdWJsZSo+KGRvdWJsZSosIGRvdWJsZSoptwNTbWF4aVNhbXBsZTo6c2V0U2FtcGxlKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGludCm4AxVtYXhpU2FtcGxlOjp0cmlnZ2VyKCm5AxJtYXhpU2FtcGxlOjpwbGF5KCm6AyhtYXhpU2FtcGxlOjpwbGF5KGRvdWJsZSwgZG91YmxlLCBkb3VibGUpuwMxbWF4aVNhbXBsZTo6cGxheShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUmKbwDKW1heGlTYW1wbGU6OnBsYXk0KGRvdWJsZSwgZG91YmxlLCBkb3VibGUpvQMWbWF4aVNhbXBsZTo6cGxheU9uY2UoKb4DHG1heGlTYW1wbGU6OnBsYXlPblpYKGRvdWJsZSm/AyRtYXhpU2FtcGxlOjpwbGF5T25aWChkb3VibGUsIGRvdWJsZSnAAxxtYXhpU2FtcGxlOjpwbGF5T25jZShkb3VibGUpwQMsbWF4aVNhbXBsZTo6cGxheU9uWlgoZG91YmxlLCBkb3VibGUsIGRvdWJsZSnCAyptYXhpU2FtcGxlOjpsb29wU2V0UG9zT25aWChkb3VibGUsIGRvdWJsZSnDAxhtYXhpU2FtcGxlOjpwbGF5KGRvdWJsZSnEAx1tYXhpU2FtcGxlOjpub3JtYWxpc2UoZG91YmxlKcUDLm1heGlTYW1wbGU6OmF1dG9UcmltKGZsb2F0LCBmbG9hdCwgYm9vbCwgYm9vbCnGAzNtYXhpRHluOjpnYXRlKGRvdWJsZSwgZG91YmxlLCBsb25nLCBkb3VibGUsIGRvdWJsZSnHAzttYXhpRHluOjpjb21wcmVzc29yKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKcgDGW1heGlEeW46OmNvbXByZXNzKGRvdWJsZSnJAxptYXhpRHluOjpzZXRBdHRhY2soZG91YmxlKcoDG21heGlEeW46OnNldFJlbGVhc2UoZG91YmxlKcsDHW1heGlEeW46OnNldFRocmVzaG9sZChkb3VibGUpzAMubWF4aUVudjo6YXIoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgbG9uZywgaW50Kc0DQG1heGlFbnY6OmFkc3IoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGxvbmcsIGludCnOAxptYXhpRW52OjphZHNyKGRvdWJsZSwgaW50Kc8DGm1heGlFbnY6OnNldEF0dGFjayhkb3VibGUp0AMbbWF4aUVudjo6c2V0U3VzdGFpbihkb3VibGUp0QMZbWF4aUVudjo6c2V0RGVjYXkoZG91YmxlKdIDEmNvbnZlcnQ6Om10b2YoaW50KdMDYHZpcnR1YWwgdGh1bmsgdG8gc3RkOjpfXzI6OmJhc2ljX2lmc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfaWZzdHJlYW0oKdQDUXN0ZDo6X18yOjpiYXNpY19pZnN0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX2lmc3RyZWFtKCkuMdUDYnZpcnR1YWwgdGh1bmsgdG8gc3RkOjpfXzI6OmJhc2ljX2lmc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfaWZzdHJlYW0oKS4x1gNDc3RkOjpfXzI6OmJhc2ljX2ZpbGVidWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnN5bmMoKdcDT3N0ZDo6X18yOjpiYXNpY19maWxlYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfZmlsZWJ1ZigpLjHYA1tzdGQ6Ol9fMjo6YmFzaWNfZmlsZWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6aW1idWUoc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYp2QNQc3RkOjpfXzI6OmJhc2ljX2ZpbGVidWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnNldGJ1ZihjaGFyKiwgbG9uZynaA3pzdGQ6Ol9fMjo6YmFzaWNfZmlsZWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6c2Vla29mZihsb25nIGxvbmcsIHN0ZDo6X18yOjppb3NfYmFzZTo6c2Vla2RpciwgdW5zaWduZWQgaW50KdsDHHN0ZDo6X18yOjpfX3Rocm93X2JhZF9jYXN0KCncA29zdGQ6Ol9fMjo6YmFzaWNfZmlsZWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6c2Vla3BvcyhzdGQ6Ol9fMjo6ZnBvczxfX21ic3RhdGVfdD4sIHVuc2lnbmVkIGludCndA0hzdGQ6Ol9fMjo6YmFzaWNfZmlsZWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6dW5kZXJmbG93KCneA0tzdGQ6Ol9fMjo6YmFzaWNfZmlsZWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6cGJhY2tmYWlsKGludCnfA0pzdGQ6Ol9fMjo6YmFzaWNfZmlsZWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6b3ZlcmZsb3coaW50KeADhQJzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiBzdGQ6Ol9fMjo6X19wYWRfYW5kX291dHB1dDxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPihzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0Kiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgY2hhcinhAxttYXhpQ2xvY2s6OnNldFRlbXBvKGRvdWJsZSniAxNtYXhpQ2xvY2s6OnRpY2tlcigp4wMfbWF4aUNsb2NrOjpzZXRUaWNrc1BlckJlYXQoaW50KeQDHW1heGlGRlQ6OnNldHVwKGludCwgaW50LCBpbnQp5QMqbWF4aUZGVDo6cHJvY2VzcyhmbG9hdCwgbWF4aUZGVDo6ZmZ0TW9kZXMp5gMTbWF4aUZGVDo6bWFnc1RvREIoKecDG21heGlGRlQ6OnNwZWN0cmFsRmxhdG5lc3MoKegDG21heGlGRlQ6OnNwZWN0cmFsQ2VudHJvaWQoKekDHm1heGlJRkZUOjpzZXR1cChpbnQsIGludCwgaW50KeoDkwFtYXhpSUZGVDo6cHJvY2VzcyhzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+Jiwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiYsIG1heGlJRkZUOjpmZnRNb2RlcynrAy5GRlQoaW50LCBib29sLCBmbG9hdCosIGZsb2F0KiwgZmxvYXQqLCBmbG9hdCop7AMkUmVhbEZGVChpbnQsIGZsb2F0KiwgZmxvYXQqLCBmbG9hdCop7QMgZmZ0OjpnZW5XaW5kb3coaW50LCBpbnQsIGZsb2F0KinuAw9mZnQ6OnNldHVwKGludCnvAwtmZnQ6On5mZnQoKfADIWZmdDo6Y2FsY0ZGVChpbnQsIGZsb2F0KiwgZmxvYXQqKfEDN2ZmdDo6cG93ZXJTcGVjdHJ1bShpbnQsIGZsb2F0KiwgZmxvYXQqLCBmbG9hdCosIGZsb2F0KinyAx1mZnQ6OmNvbnZUb0RCKGZsb2F0KiwgZmxvYXQqKfMDO2ZmdDo6aW52ZXJzZUZGVENvbXBsZXgoaW50LCBmbG9hdCosIGZsb2F0KiwgZmxvYXQqLCBmbG9hdCop9AM+ZmZ0OjppbnZlcnNlUG93ZXJTcGVjdHJ1bShpbnQsIGZsb2F0KiwgZmxvYXQqLCBmbG9hdCosIGZsb2F0Kin1AzdtYXhpTUZDQ0FuYWx5c2VyPGRvdWJsZT46Om1lbEZpbHRlckFuZExvZ1NxdWFyZShmbG9hdCop9gMgbWF4aVJldmVyYkJhc2U6Om1heGlSZXZlcmJCYXNlKCn3Ax5tYXhpU2F0UmV2ZXJiOjptYXhpU2F0UmV2ZXJiKCn4AxttYXhpU2F0UmV2ZXJiOjpwbGF5KGRvdWJsZSn5AxxtYXhpRnJlZVZlcmI6Om1heGlGcmVlVmVyYigp+gMqbWF4aUZyZWVWZXJiOjpwbGF5KGRvdWJsZSwgZG91YmxlLCBkb3VibGUp+wMncG9pbnRfY29tcGFyZSh2b2lkIGNvbnN0Kiwgdm9pZCBjb25zdCop/AMadm9yYmlzX2RlaW5pdChzdGJfdm9yYmlzKin9Aylpc193aG9sZV9wYWNrZXRfcHJlc2VudChzdGJfdm9yYmlzKiwgaW50Kf4DM3ZvcmJpc19kZWNvZGVfcGFja2V0KHN0Yl92b3JiaXMqLCBpbnQqLCBpbnQqLCBpbnQqKf8DF3N0YXJ0X3BhZ2Uoc3RiX3ZvcmJpcyopgAQvdm9yYmlzX2ZpbmlzaF9mcmFtZShzdGJfdm9yYmlzKiwgaW50LCBpbnQsIGludCmBBEB2b3JiaXNfZGVjb2RlX2luaXRpYWwoc3RiX3ZvcmJpcyosIGludCosIGludCosIGludCosIGludCosIGludCopggQaZ2V0X2JpdHMoc3RiX3ZvcmJpcyosIGludCmDBDJjb2RlYm9va19kZWNvZGVfc2NhbGFyX3JhdyhzdGJfdm9yYmlzKiwgQ29kZWJvb2sqKYQEQ2RlY29kZV9yZXNpZHVlKHN0Yl92b3JiaXMqLCBmbG9hdCoqLCBpbnQsIGludCwgaW50LCB1bnNpZ25lZCBjaGFyKimFBCtpbnZlcnNlX21kY3QoZmxvYXQqLCBpbnQsIHN0Yl92b3JiaXMqLCBpbnQphgQZZmx1c2hfcGFja2V0KHN0Yl92b3JiaXMqKYcEGnN0YXJ0X2RlY29kZXIoc3RiX3ZvcmJpcyopiAQodWludDMyX2NvbXBhcmUodm9pZCBjb25zdCosIHZvaWQgY29uc3QqKYkEJWluaXRfYmxvY2tzaXplKHN0Yl92b3JiaXMqLCBpbnQsIGludCmKBBZzdGJfdm9yYmlzX29wZW5fbWVtb3J5iwQac3RiX3ZvcmJpc19nZXRfZnJhbWVfc2hvcnSMBEBjb252ZXJ0X3NhbXBsZXNfc2hvcnQoaW50LCBzaG9ydCoqLCBpbnQsIGludCwgZmxvYXQqKiwgaW50LCBpbnQpjQQmc3RiX3ZvcmJpc19nZXRfZnJhbWVfc2hvcnRfaW50ZXJsZWF2ZWSOBEdjb252ZXJ0X2NoYW5uZWxzX3Nob3J0X2ludGVybGVhdmVkKGludCwgc2hvcnQqLCBpbnQsIGZsb2F0KiosIGludCwgaW50KY8EGHN0Yl92b3JiaXNfZGVjb2RlX21lbW9yeZAEH21heWJlX3N0YXJ0X3BhY2tldChzdGJfdm9yYmlzKimRBClzdGFydF9wYWdlX25vX2NhcHR1cmVwYXR0ZXJuKHN0Yl92b3JiaXMqKZIEMmNvZGVib29rX2RlY29kZV9zdGFydChzdGJfdm9yYmlzKiwgQ29kZWJvb2sqLCBpbnQpkwRfY29kZWJvb2tfZGVjb2RlX2RlaW50ZXJsZWF2ZV9yZXBlYXQoc3RiX3ZvcmJpcyosIENvZGVib29rKiwgZmxvYXQqKiwgaW50LCBpbnQqLCBpbnQqLCBpbnQsIGludCmUBDVpbWRjdF9zdGVwM19pdGVyMF9sb29wKGludCwgZmxvYXQqLCBpbnQsIGludCwgZmxvYXQqKZUEPGltZGN0X3N0ZXAzX2lubmVyX3JfbG9vcChpbnQsIGZsb2F0KiwgaW50LCBpbnQsIGZsb2F0KiwgaW50KZYEB3NjYWxibmaXBAZsZGV4cGaYBAZtZW1jbXCZBAVxc29ydJoEBHNpZnSbBANzaHKcBAd0cmlua2xlnQQDc2hsngQEcG50ep8EBWN5Y2xloAQHYV9jdHpfbKEEDF9fc3RkaW9fc2Vla6IECl9fbG9ja2ZpbGWjBAxfX3VubG9ja2ZpbGWkBAlfX2Z3cml0ZXilBAZmd3JpdGWmBAdpcHJpbnRmpwQQX19lcnJub19sb2NhdGlvbqgEB3djcnRvbWKpBAZ3Y3RvbWKqBAZtZW1jaHKrBAVmcmV4cKwEE19fdmZwcmludGZfaW50ZXJuYWytBAtwcmludGZfY29yZa4EA291dK8EBmdldGludLAEB3BvcF9hcmexBANwYWSyBAVmbXRfb7MEBWZtdF94tAQFZm10X3W1BAh2ZnByaW50ZrYEBmZtdF9mcLcEE3BvcF9hcmdfbG9uZ19kb3VibGW4BAl2ZmlwcmludGa5BApfX29mbF9sb2NrugQJX190b3dyaXRluwQIZmlwcmludGa8BAVmcHV0Y70EEV9fZnRlbGxvX3VubG9ja2VkvgQIX19mdGVsbG+/BAVmdGVsbMAECF9fdG9yZWFkwQQFZnJlYWTCBBFfX2ZzZWVrb191bmxvY2tlZMMECF9fZnNlZWtvxAQFZnNlZWvFBA1fX3N0ZGlvX2Nsb3NlxgQFZmdldGPHBAZzdHJsZW7IBAtfX3N0cmNocm51bMkEBnN0cmNocsoEDF9fZm1vZGVmbGFnc8sEBWZvcGVuzAQJdnNucHJpbnRmzQQIc25fd3JpdGXOBAZmY2xvc2XPBBlfX2Vtc2NyaXB0ZW5fc3Rkb3V0X2Nsb3Nl0AQYX19lbXNjcmlwdGVuX3N0ZG91dF9zZWVr0QQMX19zdGRpb19yZWFk0gQIX19mZG9wZW7TBA1fX3N0ZGlvX3dyaXRl1AQKX19vdmVyZmxvd9UEBmZmbHVzaNYEEV9fZmZsdXNoX3VubG9ja2Vk1wQHX191Zmxvd9gECV9fb2ZsX2FkZNkECV9fbHNocnRpM9oECV9fYXNobHRpM9sEDF9fdHJ1bmN0ZmRmMtwEBV9fY29z3QQQX19yZW1fcGlvMl9sYXJnZd4ECl9fcmVtX3BpbzLfBAVfX3NpbuAEA2Nvc+EEB19fY29zZGbiBAdfX3NpbmRm4wQLX19yZW1fcGlvMmbkBARjb3Nm5QQDc2lu5gQEc2luZucEBV9fdGFu6AQDdGFu6QQEYXRhbuoEBWF0YW5m6wQGYXRhbjJm7AQEZXhwZu0EA2xvZ+4EBGxvZ2bvBANwb3fwBAd3bWVtY3B58QQZc3RkOjp1bmNhdWdodF9leGNlcHRpb24oKfIERXN0ZDo6X18yOjpiYXNpY19pb3M8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19pb3MoKfMEH3N0ZDo6X18yOjppb3NfYmFzZTo6fmlvc19iYXNlKCn0BD9zdGQ6Ol9fMjo6aW9zX2Jhc2U6Ol9fY2FsbF9jYWxsYmFja3Moc3RkOjpfXzI6Omlvc19iYXNlOjpldmVudCn1BEdzdGQ6Ol9fMjo6YmFzaWNfaW9zPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfaW9zKCkuMfYEUXN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19zdHJlYW1idWYoKfcEU3N0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19zdHJlYW1idWYoKS4x+ARQc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6YmFzaWNfc3RyZWFtYnVmKCn5BF1zdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjppbWJ1ZShzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0Jin6BFJzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpzZXRidWYoY2hhciosIGxvbmcp+wR8c3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6c2Vla29mZihsb25nIGxvbmcsIHN0ZDo6X18yOjppb3NfYmFzZTo6c2Vla2RpciwgdW5zaWduZWQgaW50KfwEcXN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnNlZWtwb3Moc3RkOjpfXzI6OmZwb3M8X19tYnN0YXRlX3Q+LCB1bnNpZ25lZCBpbnQp/QRSc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6eHNnZXRuKGNoYXIqLCBsb25nKf4ERHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPjo6Y29weShjaGFyKiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGxvbmcp/wRKc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6dW5kZXJmbG93KCmABUZzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp1ZmxvdygpgQVNc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6cGJhY2tmYWlsKGludCmCBVhzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp4c3B1dG4oY2hhciBjb25zdCosIGxvbmcpgwVXc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1Zjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6fmJhc2ljX3N0cmVhbWJ1ZigphAVZc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1Zjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6fmJhc2ljX3N0cmVhbWJ1ZigpLjGFBVZzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+OjpiYXNpY19zdHJlYW1idWYoKYYFW3N0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46OnhzZ2V0bih3Y2hhcl90KiwgbG9uZymHBU1zdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD46OmNvcHkod2NoYXJfdCosIHdjaGFyX3QgY29uc3QqLCB1bnNpZ25lZCBsb25nKYgFTHN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46OnVmbG93KCmJBWFzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Ojp4c3B1dG4od2NoYXJfdCBjb25zdCosIGxvbmcpigVPc3RkOjpfXzI6OmJhc2ljX2lzdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19pc3RyZWFtKCkuMYsFXnZpcnR1YWwgdGh1bmsgdG8gc3RkOjpfXzI6OmJhc2ljX2lzdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19pc3RyZWFtKCmMBU9zdGQ6Ol9fMjo6YmFzaWNfaXN0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX2lzdHJlYW0oKS4yjQVgdmlydHVhbCB0aHVuayB0byBzdGQ6Ol9fMjo6YmFzaWNfaXN0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX2lzdHJlYW0oKS4xjgWPAXN0ZDo6X18yOjpiYXNpY19pc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpzZW50cnk6OnNlbnRyeShzdGQ6Ol9fMjo6YmFzaWNfaXN0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIGJvb2wpjwVEc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OmZsdXNoKCmQBWFzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmIHN0ZDo6X18yOjp1c2VfZmFjZXQ8c3RkOjpfXzI6OmN0eXBlPGNoYXI+ID4oc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYpkQXRAWJvb2wgc3RkOjpfXzI6Om9wZXJhdG9yIT08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gY29uc3QmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiBjb25zdCYpkgVUc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46Om9wZXJhdG9yKigpIGNvbnN0kwVPc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46Om9wZXJhdG9yKysoKZQF0QFib29sIHN0ZDo6X18yOjpvcGVyYXRvcj09PGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+IGNvbnN0Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gY29uc3QmKZUFiQFzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6c2VudHJ5OjpzZW50cnkoc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mKZYFTnN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpzZW50cnk6On5zZW50cnkoKZcFmAFzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6ZXF1YWwoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gY29uc3QmKSBjb25zdJgFR3N0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnNidW1wYygpmQVKc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6c3B1dGMoY2hhcimaBU5zdGQ6Ol9fMjo6YmFzaWNfaXN0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6cmVhZChjaGFyKiwgbG9uZymbBWpzdGQ6Ol9fMjo6YmFzaWNfaXN0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6c2Vla2cobG9uZyBsb25nLCBzdGQ6Ol9fMjo6aW9zX2Jhc2U6OnNlZWtkaXIpnAVKc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46OmZsdXNoKCmdBWdzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmIHN0ZDo6X18yOjp1c2VfZmFjZXQ8c3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+ID4oc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYpngXjAWJvb2wgc3RkOjpfXzI6Om9wZXJhdG9yIT08d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gY29uc3QmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiBjb25zdCYpnwVVc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46Om9wZXJhdG9yKysoKaAF4wFib29sIHN0ZDo6X18yOjpvcGVyYXRvcj09PHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+IGNvbnN0Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gY29uc3QmKaEFlQFzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6c2VudHJ5OjpzZW50cnkoc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mKaIFpAFzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6ZXF1YWwoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gY29uc3QmKSBjb25zdKMFTXN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46OnNidW1wYygppAVTc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1Zjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6c3B1dGMod2NoYXJfdCmlBU9zdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX29zdHJlYW0oKS4xpgVedmlydHVhbCB0aHVuayB0byBzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX29zdHJlYW0oKacFT3N0ZDo6X18yOjpiYXNpY19vc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfb3N0cmVhbSgpLjKoBWB2aXJ0dWFsIHRodW5rIHRvIHN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfb3N0cmVhbSgpLjGpBe0Bc3RkOjpfXzI6Om51bV9wdXQ8Y2hhciwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPiBjb25zdCYgc3RkOjpfXzI6OnVzZV9mYWNldDxzdGQ6Ol9fMjo6bnVtX3B1dDxjaGFyLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+ID4oc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYpqgVFc3RkOjpfXzI6OmJhc2ljX2lvczxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6ZmlsbCgpIGNvbnN0qwVKc3RkOjpfXzI6OmJhc2ljX2lvczxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6d2lkZW4oY2hhcikgY29uc3SsBU5zdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6b3BlcmF0b3I8PChzaG9ydCmtBUxzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6b3BlcmF0b3I8PChpbnQprgVWc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46Om9wZXJhdG9yPDwodW5zaWduZWQgbG9uZymvBVJzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6b3BlcmF0b3I9KGNoYXIpsAVGc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnB1dChjaGFyKbEFW3N0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+OjpvcGVyYXRvcj0od2NoYXJfdCmyBXBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpiYXNpY19zdHJpbmcoY2hhciBjb25zdCopswUhc3RkOjpfXzI6Omlvc19iYXNlOjp+aW9zX2Jhc2UoKS4xtAUfc3RkOjpfXzI6Omlvc19iYXNlOjppbml0KHZvaWQqKbUFtQFzdGQ6Ol9fMjo6ZW5hYmxlX2lmPChpc19tb3ZlX2NvbnN0cnVjdGlibGU8dW5zaWduZWQgaW50Pjo6dmFsdWUpICYmIChpc19tb3ZlX2Fzc2lnbmFibGU8dW5zaWduZWQgaW50Pjo6dmFsdWUpLCB2b2lkPjo6dHlwZSBzdGQ6Ol9fMjo6c3dhcDx1bnNpZ25lZCBpbnQ+KHVuc2lnbmVkIGludCYsIHVuc2lnbmVkIGludCYptgVZc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46Ol9fdGVzdF9mb3JfZW9mKCkgY29uc3S3BV9zdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6X190ZXN0X2Zvcl9lb2YoKSBjb25zdLgFBnVuZ2V0Y7kFIHN0ZDo6X18yOjppb3NfYmFzZTo6SW5pdDo6SW5pdCgpugUXX19jeHhfZ2xvYmFsX2FycmF5X2R0b3K7BT9zdGQ6Ol9fMjo6X19zdGRpbmJ1ZjxjaGFyPjo6X19zdGRpbmJ1ZihfSU9fRklMRSosIF9fbWJzdGF0ZV90Kim8BYoBc3RkOjpfXzI6OmJhc2ljX2lzdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OmJhc2ljX2lzdHJlYW0oc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiopvQVCc3RkOjpfXzI6Ol9fc3RkaW5idWY8d2NoYXJfdD46Ol9fc3RkaW5idWYoX0lPX0ZJTEUqLCBfX21ic3RhdGVfdCopvgWWAXN0ZDo6X18yOjpiYXNpY19pc3RyZWFtPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+OjpiYXNpY19pc3RyZWFtKHN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4qKb8FQXN0ZDo6X18yOjpfX3N0ZG91dGJ1ZjxjaGFyPjo6X19zdGRvdXRidWYoX0lPX0ZJTEUqLCBfX21ic3RhdGVfdCopwAWKAXN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpiYXNpY19vc3RyZWFtKHN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4qKcEFRHN0ZDo6X18yOjpfX3N0ZG91dGJ1Zjx3Y2hhcl90Pjo6X19zdGRvdXRidWYoX0lPX0ZJTEUqLCBfX21ic3RhdGVfdCopwgWWAXN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+OjpiYXNpY19vc3RyZWFtKHN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4qKcMFfXN0ZDo6X18yOjpiYXNpY19pb3M8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OmluaXQoc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiopxAWLAXN0ZDo6X18yOjpjb2RlY3Z0PGNoYXIsIGNoYXIsIF9fbWJzdGF0ZV90PiBjb25zdCYgc3RkOjpfXzI6OnVzZV9mYWNldDxzdGQ6Ol9fMjo6Y29kZWN2dDxjaGFyLCBjaGFyLCBfX21ic3RhdGVfdD4gPihzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JinFBZEBc3RkOjpfXzI6OmNvZGVjdnQ8d2NoYXJfdCwgY2hhciwgX19tYnN0YXRlX3Q+IGNvbnN0JiBzdGQ6Ol9fMjo6dXNlX2ZhY2V0PHN0ZDo6X18yOjpjb2RlY3Z0PHdjaGFyX3QsIGNoYXIsIF9fbWJzdGF0ZV90PiA+KHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKcYFKXN0ZDo6X18yOjpfX3N0ZGluYnVmPGNoYXI+Ojp+X19zdGRpbmJ1ZigpxwU6c3RkOjpfXzI6Ol9fc3RkaW5idWY8Y2hhcj46OmltYnVlKHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKcgFJ3N0ZDo6X18yOjpfX3N0ZGluYnVmPGNoYXI+Ojp1bmRlcmZsb3coKckFK3N0ZDo6X18yOjpfX3N0ZGluYnVmPGNoYXI+OjpfX2dldGNoYXIoYm9vbCnKBSNzdGQ6Ol9fMjo6X19zdGRpbmJ1ZjxjaGFyPjo6dWZsb3coKcsFKnN0ZDo6X18yOjpfX3N0ZGluYnVmPGNoYXI+OjpwYmFja2ZhaWwoaW50KcwFLHN0ZDo6X18yOjpfX3N0ZGluYnVmPHdjaGFyX3Q+Ojp+X19zdGRpbmJ1ZigpzQU9c3RkOjpfXzI6Ol9fc3RkaW5idWY8d2NoYXJfdD46OmltYnVlKHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKc4FKnN0ZDo6X18yOjpfX3N0ZGluYnVmPHdjaGFyX3Q+Ojp1bmRlcmZsb3coKc8FLnN0ZDo6X18yOjpfX3N0ZGluYnVmPHdjaGFyX3Q+OjpfX2dldGNoYXIoYm9vbCnQBSZzdGQ6Ol9fMjo6X19zdGRpbmJ1Zjx3Y2hhcl90Pjo6dWZsb3coKdEFNnN0ZDo6X18yOjpfX3N0ZGluYnVmPHdjaGFyX3Q+OjpwYmFja2ZhaWwodW5zaWduZWQgaW50KdIFO3N0ZDo6X18yOjpfX3N0ZG91dGJ1ZjxjaGFyPjo6aW1idWUoc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYp0wUjc3RkOjpfXzI6Ol9fc3Rkb3V0YnVmPGNoYXI+OjpzeW5jKCnUBTZzdGQ6Ol9fMjo6X19zdGRvdXRidWY8Y2hhcj46OnhzcHV0bihjaGFyIGNvbnN0KiwgbG9uZynVBSpzdGQ6Ol9fMjo6X19zdGRvdXRidWY8Y2hhcj46Om92ZXJmbG93KGludCnWBT5zdGQ6Ol9fMjo6X19zdGRvdXRidWY8d2NoYXJfdD46OmltYnVlKHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKdcFPHN0ZDo6X18yOjpfX3N0ZG91dGJ1Zjx3Y2hhcl90Pjo6eHNwdXRuKHdjaGFyX3QgY29uc3QqLCBsb25nKdgFNnN0ZDo6X18yOjpfX3N0ZG91dGJ1Zjx3Y2hhcl90Pjo6b3ZlcmZsb3codW5zaWduZWQgaW50KdkFB19fc2hsaW3aBQhfX3NoZ2V0Y9sFCF9fbXVsdGkz3AUJX19pbnRzY2Fu3QUHbWJydG93Y94FDV9fZXh0ZW5kc2Z0ZjLfBQhfX211bHRmM+AFC19fZmxvYXRzaXRm4QUIX19hZGR0ZjPiBQ1fX2V4dGVuZGRmdGYy4wUHX19sZXRmMuQFB19fZ2V0ZjLlBQljb3B5c2lnbmzmBQ1fX2Zsb2F0dW5zaXRm5wUIX19zdWJ0ZjPoBQdzY2FsYm5s6QUIX19kaXZ0ZjPqBQtfX2Zsb2F0c2NhbusFCGhleGZsb2F07AUIZGVjZmxvYXTtBQdzY2FuZXhw7gUMX190cnVuY3Rmc2Yy7wUHdmZzY2FuZvAFBWFyZ19u8QUJc3RvcmVfaW508gUNX19zdHJpbmdfcmVhZPMFB3Zzc2Nhbmb0BQdkb19yZWFk9QUGc3RyY21w9gUgX19lbXNjcmlwdGVuX2Vudmlyb25fY29uc3RydWN0b3L3BQdzdHJuY21w+AUGZ2V0ZW52+QUIX19tdW5tYXD6BQxfX2dldF9sb2NhbGX7BQtfX25ld2xvY2FsZfwFCXZhc3ByaW50Zv0FBnNzY2FuZv4FCHNucHJpbnRm/wUKZnJlZWxvY2FsZYAGBndjc2xlboEGCXdjc3J0b21ic4IGCndjc25ydG9tYnODBgltYnNydG93Y3OEBgptYnNucnRvd2NzhQYGc3RydG94hgYKc3RydG91bGxfbIcGCXN0cnRvbGxfbIgGBnN0cnRvZokGCHN0cnRveC4xigYGc3RydG9kiwYHc3RydG9sZIwGCXN0cnRvbGRfbI0GXXN0ZDo6X18yOjpjb2xsYXRlPGNoYXI+Ojpkb19jb21wYXJlKGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqKSBjb25zdI4GRXN0ZDo6X18yOjpjb2xsYXRlPGNoYXI+Ojpkb190cmFuc2Zvcm0oY2hhciBjb25zdCosIGNoYXIgY29uc3QqKSBjb25zdI8GzwFzdGQ6Ol9fMjo6ZW5hYmxlX2lmPF9faXNfZm9yd2FyZF9pdGVyYXRvcjxjaGFyIGNvbnN0Kj46OnZhbHVlLCB2b2lkPjo6dHlwZSBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpfX2luaXQ8Y2hhciBjb25zdCo+KGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KimQBkBzdGQ6Ol9fMjo6Y29sbGF0ZTxjaGFyPjo6ZG9faGFzaChjaGFyIGNvbnN0KiwgY2hhciBjb25zdCopIGNvbnN0kQZsc3RkOjpfXzI6OmNvbGxhdGU8d2NoYXJfdD46OmRvX2NvbXBhcmUod2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdCopIGNvbnN0kgZOc3RkOjpfXzI6OmNvbGxhdGU8d2NoYXJfdD46OmRvX3RyYW5zZm9ybSh3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdCopIGNvbnN0kwbkAXN0ZDo6X18yOjplbmFibGVfaWY8X19pc19mb3J3YXJkX2l0ZXJhdG9yPHdjaGFyX3QgY29uc3QqPjo6dmFsdWUsIHZvaWQ+Ojp0eXBlIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID46Ol9faW5pdDx3Y2hhcl90IGNvbnN0Kj4od2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqKZQGSXN0ZDo6X18yOjpjb2xsYXRlPHdjaGFyX3Q+Ojpkb19oYXNoKHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0KikgY29uc3SVBpoCc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgYm9vbCYpIGNvbnN0lgZnc3RkOjpfXzI6Om51bXB1bmN0PGNoYXI+IGNvbnN0JiBzdGQ6Ol9fMjo6dXNlX2ZhY2V0PHN0ZDo6X18yOjpudW1wdW5jdDxjaGFyPiA+KHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKZcGpAVzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0KiBzdGQ6Ol9fMjo6X19zY2FuX2tleXdvcmQ8c3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QqLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0Kiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCosIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYsIHVuc2lnbmVkIGludCYsIGJvb2wpmAY4c3RkOjpfXzI6OmxvY2FsZTo6dXNlX2ZhY2V0KHN0ZDo6X18yOjpsb2NhbGU6OmlkJikgY29uc3SZBswBc3RkOjpfXzI6OnVuaXF1ZV9wdHI8dW5zaWduZWQgY2hhciwgdm9pZCAoKikodm9pZCopPjo6dW5pcXVlX3B0cjx0cnVlLCB2b2lkPih1bnNpZ25lZCBjaGFyKiwgc3RkOjpfXzI6Ol9fZGVwZW5kZW50X3R5cGU8c3RkOjpfXzI6Ol9fdW5pcXVlX3B0cl9kZWxldGVyX3NmaW5hZTx2b2lkICgqKSh2b2lkKik+LCB0cnVlPjo6X19nb29kX3J2YWxfcmVmX3R5cGUpmgaaAnN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGxvbmcmKSBjb25zdJsG6wJzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiBzdGQ6Ol9fMjo6bnVtX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2RvX2dldF9zaWduZWQ8bG9uZz4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBsb25nJikgY29uc3ScBjlzdGQ6Ol9fMjo6X19udW1fZ2V0X2Jhc2U6Ol9fZ2V0X2Jhc2Uoc3RkOjpfXzI6Omlvc19iYXNlJimdBkhzdGQ6Ol9fMjo6X19udW1fZ2V0PGNoYXI+OjpfX3N0YWdlMl9pbnRfcHJlcChzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCBjaGFyJimeBmVzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpiYXNpY19zdHJpbmcoKZ8GbHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OnJlc2l6ZSh1bnNpZ25lZCBsb25nKaAG5QFzdGQ6Ol9fMjo6X19udW1fZ2V0PGNoYXI+OjpfX3N0YWdlMl9pbnRfbG9vcChjaGFyLCBpbnQsIGNoYXIqLCBjaGFyKiYsIHVuc2lnbmVkIGludCYsIGNoYXIsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QmLCB1bnNpZ25lZCBpbnQqLCB1bnNpZ25lZCBpbnQqJiwgY2hhciBjb25zdCopoQZcbG9uZyBzdGQ6Ol9fMjo6X19udW1fZ2V0X3NpZ25lZF9pbnRlZ3JhbDxsb25nPihjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGludCYsIGludCmiBqUBc3RkOjpfXzI6Ol9fY2hlY2tfZ3JvdXBpbmcoc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCYsIHVuc2lnbmVkIGludCosIHVuc2lnbmVkIGludCosIHVuc2lnbmVkIGludCYpowafAnN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGxvbmcgbG9uZyYpIGNvbnN0pAb1AnN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+IHN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZG9fZ2V0X3NpZ25lZDxsb25nIGxvbmc+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgbG9uZyBsb25nJikgY29uc3SlBmZsb25nIGxvbmcgc3RkOjpfXzI6Ol9fbnVtX2dldF9zaWduZWRfaW50ZWdyYWw8bG9uZyBsb25nPihjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGludCYsIGludCmmBqQCc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdW5zaWduZWQgc2hvcnQmKSBjb25zdKcGgQNzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiBzdGQ6Ol9fMjo6bnVtX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2RvX2dldF91bnNpZ25lZDx1bnNpZ25lZCBzaG9ydD4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB1bnNpZ25lZCBzaG9ydCYpIGNvbnN0qAZydW5zaWduZWQgc2hvcnQgc3RkOjpfXzI6Ol9fbnVtX2dldF91bnNpZ25lZF9pbnRlZ3JhbDx1bnNpZ25lZCBzaG9ydD4oY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBpbnQmLCBpbnQpqQaiAnN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHVuc2lnbmVkIGludCYpIGNvbnN0qgb9AnN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+IHN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZG9fZ2V0X3Vuc2lnbmVkPHVuc2lnbmVkIGludD4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB1bnNpZ25lZCBpbnQmKSBjb25zdKsGbnVuc2lnbmVkIGludCBzdGQ6Ol9fMjo6X19udW1fZ2V0X3Vuc2lnbmVkX2ludGVncmFsPHVuc2lnbmVkIGludD4oY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBpbnQmLCBpbnQprAaoAnN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHVuc2lnbmVkIGxvbmcgbG9uZyYpIGNvbnN0rQaJA3N0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+IHN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZG9fZ2V0X3Vuc2lnbmVkPHVuc2lnbmVkIGxvbmcgbG9uZz4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB1bnNpZ25lZCBsb25nIGxvbmcmKSBjb25zdK4GenVuc2lnbmVkIGxvbmcgbG9uZyBzdGQ6Ol9fMjo6X19udW1fZ2V0X3Vuc2lnbmVkX2ludGVncmFsPHVuc2lnbmVkIGxvbmcgbG9uZz4oY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBpbnQmLCBpbnQprwabAnN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGZsb2F0JikgY29uc3SwBvUCc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19kb19nZXRfZmxvYXRpbmdfcG9pbnQ8ZmxvYXQ+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgZmxvYXQmKSBjb25zdLEGWHN0ZDo6X18yOjpfX251bV9nZXQ8Y2hhcj46Ol9fc3RhZ2UyX2Zsb2F0X3ByZXAoc3RkOjpfXzI6Omlvc19iYXNlJiwgY2hhciosIGNoYXImLCBjaGFyJimyBvABc3RkOjpfXzI6Ol9fbnVtX2dldDxjaGFyPjo6X19zdGFnZTJfZmxvYXRfbG9vcChjaGFyLCBib29sJiwgY2hhciYsIGNoYXIqLCBjaGFyKiYsIGNoYXIsIGNoYXIsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QmLCB1bnNpZ25lZCBpbnQqLCB1bnNpZ25lZCBpbnQqJiwgdW5zaWduZWQgaW50JiwgY2hhciopswZPZmxvYXQgc3RkOjpfXzI6Ol9fbnVtX2dldF9mbG9hdDxmbG9hdD4oY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBpbnQmKbQGnAJzdGQ6Ol9fMjo6bnVtX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBkb3VibGUmKSBjb25zdLUG9wJzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiBzdGQ6Ol9fMjo6bnVtX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2RvX2dldF9mbG9hdGluZ19wb2ludDxkb3VibGU+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgZG91YmxlJikgY29uc3S2BlFkb3VibGUgc3RkOjpfXzI6Ol9fbnVtX2dldF9mbG9hdDxkb3VibGU+KGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgaW50Jim3BqECc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgbG9uZyBkb3VibGUmKSBjb25zdLgGgQNzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiBzdGQ6Ol9fMjo6bnVtX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2RvX2dldF9mbG9hdGluZ19wb2ludDxsb25nIGRvdWJsZT4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBsb25nIGRvdWJsZSYpIGNvbnN0uQZbbG9uZyBkb3VibGUgc3RkOjpfXzI6Ol9fbnVtX2dldF9mbG9hdDxsb25nIGRvdWJsZT4oY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBpbnQmKboGmwJzdGQ6Ol9fMjo6bnVtX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB2b2lkKiYpIGNvbnN0uwYSc3RkOjpfXzI6Ol9fY2xvYygpvAZMc3RkOjpfXzI6Ol9fbGliY3BwX3NzY2FuZl9sKGNoYXIgY29uc3QqLCBfX2xvY2FsZV9zdHJ1Y3QqLCBjaGFyIGNvbnN0KiwgLi4uKb0GX3N0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46Ol9femVybygpvgZUY2hhciBjb25zdCogc3RkOjpfXzI6OmZpbmQ8Y2hhciBjb25zdCosIGNoYXI+KGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdCYpvwZJc3RkOjpfXzI6Ol9fbGliY3BwX2xvY2FsZV9ndWFyZDo6X19saWJjcHBfbG9jYWxlX2d1YXJkKF9fbG9jYWxlX3N0cnVjdComKcAGrwJzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBib29sJikgY29uc3TBBm1zdGQ6Ol9fMjo6bnVtcHVuY3Q8d2NoYXJfdD4gY29uc3QmIHN0ZDo6X18yOjp1c2VfZmFjZXQ8c3RkOjpfXzI6Om51bXB1bmN0PHdjaGFyX3Q+ID4oc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYpwgbgBXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4gY29uc3QqIHN0ZDo6X18yOjpfX3NjYW5fa2V5d29yZDxzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiBjb25zdCosIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiA+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4gY29uc3QqLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+IGNvbnN0Kiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JiwgdW5zaWduZWQgaW50JiwgYm9vbCnDBq8Cc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgbG9uZyYpIGNvbnN0xAaGA3N0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+IHN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZG9fZ2V0X3NpZ25lZDxsb25nPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGxvbmcmKSBjb25zdMUGTXN0ZDo6X18yOjpfX251bV9nZXQ8d2NoYXJfdD46Ol9fZG9fd2lkZW4oc3RkOjpfXzI6Omlvc19iYXNlJiwgd2NoYXJfdCopIGNvbnN0xgZOc3RkOjpfXzI6Ol9fbnVtX2dldDx3Y2hhcl90Pjo6X19zdGFnZTJfaW50X3ByZXAoc3RkOjpfXzI6Omlvc19iYXNlJiwgd2NoYXJfdCYpxwbxAXN0ZDo6X18yOjpfX251bV9nZXQ8d2NoYXJfdD46Ol9fc3RhZ2UyX2ludF9sb29wKHdjaGFyX3QsIGludCwgY2hhciosIGNoYXIqJiwgdW5zaWduZWQgaW50Jiwgd2NoYXJfdCwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCYsIHVuc2lnbmVkIGludCosIHVuc2lnbmVkIGludComLCB3Y2hhcl90IGNvbnN0KinIBrQCc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgbG9uZyBsb25nJikgY29uc3TJBpADc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19kb19nZXRfc2lnbmVkPGxvbmcgbG9uZz4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBsb25nIGxvbmcmKSBjb25zdMoGuQJzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB1bnNpZ25lZCBzaG9ydCYpIGNvbnN0ywacA3N0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+IHN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZG9fZ2V0X3Vuc2lnbmVkPHVuc2lnbmVkIHNob3J0PihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHVuc2lnbmVkIHNob3J0JikgY29uc3TMBrcCc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdW5zaWduZWQgaW50JikgY29uc3TNBpgDc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19kb19nZXRfdW5zaWduZWQ8dW5zaWduZWQgaW50PihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHVuc2lnbmVkIGludCYpIGNvbnN0zga9AnN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHVuc2lnbmVkIGxvbmcgbG9uZyYpIGNvbnN0zwakA3N0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+IHN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZG9fZ2V0X3Vuc2lnbmVkPHVuc2lnbmVkIGxvbmcgbG9uZz4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB1bnNpZ25lZCBsb25nIGxvbmcmKSBjb25zdNAGsAJzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBmbG9hdCYpIGNvbnN00QaQA3N0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+IHN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZG9fZ2V0X2Zsb2F0aW5nX3BvaW50PGZsb2F0PihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGZsb2F0JikgY29uc3TSBmRzdGQ6Ol9fMjo6X19udW1fZ2V0PHdjaGFyX3Q+OjpfX3N0YWdlMl9mbG9hdF9wcmVwKHN0ZDo6X18yOjppb3NfYmFzZSYsIHdjaGFyX3QqLCB3Y2hhcl90Jiwgd2NoYXJfdCYp0wb/AXN0ZDo6X18yOjpfX251bV9nZXQ8d2NoYXJfdD46Ol9fc3RhZ2UyX2Zsb2F0X2xvb3Aod2NoYXJfdCwgYm9vbCYsIGNoYXImLCBjaGFyKiwgY2hhciomLCB3Y2hhcl90LCB3Y2hhcl90LCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0JiwgdW5zaWduZWQgaW50KiwgdW5zaWduZWQgaW50KiYsIHVuc2lnbmVkIGludCYsIHdjaGFyX3QqKdQGsQJzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBkb3VibGUmKSBjb25zdNUGkgNzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiBzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2RvX2dldF9mbG9hdGluZ19wb2ludDxkb3VibGU+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgZG91YmxlJikgY29uc3TWBrYCc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgbG9uZyBkb3VibGUmKSBjb25zdNcGnANzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiBzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2RvX2dldF9mbG9hdGluZ19wb2ludDxsb25nIGRvdWJsZT4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBsb25nIGRvdWJsZSYpIGNvbnN02AawAnN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHZvaWQqJikgY29uc3TZBmZ3Y2hhcl90IGNvbnN0KiBzdGQ6Ol9fMjo6ZmluZDx3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdD4od2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0JinaBmd3Y2hhcl90IGNvbnN0KiBzdGQ6Ol9fMjo6X19udW1fZ2V0PHdjaGFyX3Q+OjpfX2RvX3dpZGVuX3A8d2NoYXJfdD4oc3RkOjpfXzI6Omlvc19iYXNlJiwgd2NoYXJfdCopIGNvbnN02wbNAXN0ZDo6X18yOjpudW1fcHV0PGNoYXIsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgY2hhciwgYm9vbCkgY29uc3TcBl5zdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpiZWdpbigp3QZcc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6ZW5kKCneBs0Bc3RkOjpfXzI6Om51bV9wdXQ8Y2hhciwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCBjaGFyLCBsb25nKSBjb25zdN8GTnN0ZDo6X18yOjpfX251bV9wdXRfYmFzZTo6X19mb3JtYXRfaW50KGNoYXIqLCBjaGFyIGNvbnN0KiwgYm9vbCwgdW5zaWduZWQgaW50KeAGV3N0ZDo6X18yOjpfX2xpYmNwcF9zbnByaW50Zl9sKGNoYXIqLCB1bnNpZ25lZCBsb25nLCBfX2xvY2FsZV9zdHJ1Y3QqLCBjaGFyIGNvbnN0KiwgLi4uKeEGVXN0ZDo6X18yOjpfX251bV9wdXRfYmFzZTo6X19pZGVudGlmeV9wYWRkaW5nKGNoYXIqLCBjaGFyKiwgc3RkOjpfXzI6Omlvc19iYXNlIGNvbnN0JiniBnVzdGQ6Ol9fMjo6X19udW1fcHV0PGNoYXI+OjpfX3dpZGVuX2FuZF9ncm91cF9pbnQoY2hhciosIGNoYXIqLCBjaGFyKiwgY2hhciosIGNoYXIqJiwgY2hhciomLCBzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JinjBit2b2lkIHN0ZDo6X18yOjpyZXZlcnNlPGNoYXIqPihjaGFyKiwgY2hhciop5AYhc3RkOjpfXzI6Omlvc19iYXNlOjp3aWR0aCgpIGNvbnN05QbSAXN0ZDo6X18yOjpudW1fcHV0PGNoYXIsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgY2hhciwgbG9uZyBsb25nKSBjb25zdOYG1gFzdGQ6Ol9fMjo6bnVtX3B1dDxjaGFyLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIGNoYXIsIHVuc2lnbmVkIGxvbmcpIGNvbnN05wbbAXN0ZDo6X18yOjpudW1fcHV0PGNoYXIsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgY2hhciwgdW5zaWduZWQgbG9uZyBsb25nKSBjb25zdOgGzwFzdGQ6Ol9fMjo6bnVtX3B1dDxjaGFyLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIGNoYXIsIGRvdWJsZSkgY29uc3TpBkpzdGQ6Ol9fMjo6X19udW1fcHV0X2Jhc2U6Ol9fZm9ybWF0X2Zsb2F0KGNoYXIqLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgaW50KeoGJXN0ZDo6X18yOjppb3NfYmFzZTo6cHJlY2lzaW9uKCkgY29uc3TrBklzdGQ6Ol9fMjo6X19saWJjcHBfYXNwcmludGZfbChjaGFyKiosIF9fbG9jYWxlX3N0cnVjdCosIGNoYXIgY29uc3QqLCAuLi4p7AZ3c3RkOjpfXzI6Ol9fbnVtX3B1dDxjaGFyPjo6X193aWRlbl9hbmRfZ3JvdXBfZmxvYXQoY2hhciosIGNoYXIqLCBjaGFyKiwgY2hhciosIGNoYXIqJiwgY2hhciomLCBzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JintBtQBc3RkOjpfXzI6Om51bV9wdXQ8Y2hhciwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCBjaGFyLCBsb25nIGRvdWJsZSkgY29uc3TuBtQBc3RkOjpfXzI6Om51bV9wdXQ8Y2hhciwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCBjaGFyLCB2b2lkIGNvbnN0KikgY29uc3TvBt8Bc3RkOjpfXzI6Om51bV9wdXQ8d2NoYXJfdCwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90LCBib29sKSBjb25zdPAGZXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID46OmVuZCgp8QbfAXN0ZDo6X18yOjpudW1fcHV0PHdjaGFyX3QsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgd2NoYXJfdCwgbG9uZykgY29uc3TyBoEBc3RkOjpfXzI6Ol9fbnVtX3B1dDx3Y2hhcl90Pjo6X193aWRlbl9hbmRfZ3JvdXBfaW50KGNoYXIqLCBjaGFyKiwgY2hhciosIHdjaGFyX3QqLCB3Y2hhcl90KiYsIHdjaGFyX3QqJiwgc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYp8wajAnN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+IHN0ZDo6X18yOjpfX3BhZF9hbmRfb3V0cHV0PHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqLCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90KfQGNHZvaWQgc3RkOjpfXzI6OnJldmVyc2U8d2NoYXJfdCo+KHdjaGFyX3QqLCB3Y2hhcl90Kin1BoQBc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6YmFzaWNfc3RyaW5nKHVuc2lnbmVkIGxvbmcsIHdjaGFyX3Qp9gbkAXN0ZDo6X18yOjpudW1fcHV0PHdjaGFyX3QsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgd2NoYXJfdCwgbG9uZyBsb25nKSBjb25zdPcG6AFzdGQ6Ol9fMjo6bnVtX3B1dDx3Y2hhcl90LCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHdjaGFyX3QsIHVuc2lnbmVkIGxvbmcpIGNvbnN0+AbtAXN0ZDo6X18yOjpudW1fcHV0PHdjaGFyX3QsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgd2NoYXJfdCwgdW5zaWduZWQgbG9uZyBsb25nKSBjb25zdPkG4QFzdGQ6Ol9fMjo6bnVtX3B1dDx3Y2hhcl90LCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHdjaGFyX3QsIGRvdWJsZSkgY29uc3T6BoMBc3RkOjpfXzI6Ol9fbnVtX3B1dDx3Y2hhcl90Pjo6X193aWRlbl9hbmRfZ3JvdXBfZmxvYXQoY2hhciosIGNoYXIqLCBjaGFyKiwgd2NoYXJfdCosIHdjaGFyX3QqJiwgd2NoYXJfdComLCBzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0Jin7BuYBc3RkOjpfXzI6Om51bV9wdXQ8d2NoYXJfdCwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90LCBsb25nIGRvdWJsZSkgY29uc3T8BuYBc3RkOjpfXzI6Om51bV9wdXQ8d2NoYXJfdCwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90LCB2b2lkIGNvbnN0KikgY29uc3T9BlN2b2lkIHN0ZDo6X18yOjpfX3JldmVyc2U8Y2hhcio+KGNoYXIqLCBjaGFyKiwgc3RkOjpfXzI6OnJhbmRvbV9hY2Nlc3NfaXRlcmF0b3JfdGFnKf4GXHZvaWQgc3RkOjpfXzI6Ol9fcmV2ZXJzZTx3Y2hhcl90Kj4od2NoYXJfdCosIHdjaGFyX3QqLCBzdGQ6Ol9fMjo6cmFuZG9tX2FjY2Vzc19pdGVyYXRvcl90YWcp/wawAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpnZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB0bSosIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KikgY29uc3SAB3NzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZGF0ZV9vcmRlcigpIGNvbnN0gQeeAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXRfdGltZShzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHRtKikgY29uc3SCB54Cc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldF9kYXRlKHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdG0qKSBjb25zdIMHoQJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0X3dlZWtkYXkoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB0bSopIGNvbnN0hAevAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2dldF93ZWVrZGF5bmFtZShpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdIUHowJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0X21vbnRobmFtZShzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHRtKikgY29uc3SGB60Cc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0X21vbnRobmFtZShpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdIcHngJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0X3llYXIoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB0bSopIGNvbnN0iAeoAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2dldF95ZWFyKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYpIGNvbnN0iQelAmludCBzdGQ6Ol9fMjo6X19nZXRfdXBfdG9fbl9kaWdpdHM8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmLCBpbnQpigelAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB0bSosIGNoYXIsIGNoYXIpIGNvbnN0iwelAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2dldF9wZXJjZW50KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYpIGNvbnN0jAenAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2dldF9kYXkoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JikgY29uc3SNB6gCc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0X2hvdXIoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JikgY29uc3SOB6sCc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0XzEyX2hvdXIoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JikgY29uc3SPB7ACc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0X2RheV95ZWFyX251bShpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdJAHqQJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfbW9udGgoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JikgY29uc3SRB6oCc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0X21pbnV0ZShpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdJIHqQJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfd2hpdGVfc3BhY2Uoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JikgY29uc3STB6kCc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0X2FtX3BtKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYpIGNvbnN0lAeqAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2dldF9zZWNvbmQoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JikgY29uc3SVB6sCc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0X3dlZWtkYXkoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JikgY29uc3SWB6kCc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0X3llYXI0KGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYpIGNvbnN0lwfLAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpnZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB0bSosIHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0KikgY29uc3SYB7MCc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldF90aW1lKHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdG0qKSBjb25zdJkHswJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0X2RhdGUoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB0bSopIGNvbnN0mge2AnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXRfd2Vla2RheShzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHRtKikgY29uc3SbB8cCc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZ2V0X3dlZWtkYXluYW1lKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN0nAe4AnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXRfbW9udGhuYW1lKHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdG0qKSBjb25zdJ0HxQJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfbW9udGhuYW1lKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN0ngezAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXRfeWVhcihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHRtKikgY29uc3SfB8ACc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZ2V0X3llYXIoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JikgY29uc3SgB70CaW50IHN0ZDo6X18yOjpfX2dldF91cF90b19uX2RpZ2l0czx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYsIGludCmhB7oCc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHRtKiwgY2hhciwgY2hhcikgY29uc3SiB70Cc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZ2V0X3BlcmNlbnQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JikgY29uc3SjB78Cc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZ2V0X2RheShpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmKSBjb25zdKQHwAJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfaG91cihpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmKSBjb25zdKUHwwJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfMTJfaG91cihpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmKSBjb25zdKYHyAJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfZGF5X3llYXJfbnVtKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN0pwfBAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF9tb250aChpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmKSBjb25zdKgHwgJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfbWludXRlKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN0qQfBAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF93aGl0ZV9zcGFjZShzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmKSBjb25zdKoHwQJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfYW1fcG0oaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JikgY29uc3SrB8ICc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZ2V0X3NlY29uZChpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmKSBjb25zdKwHwwJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfd2Vla2RheShpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmKSBjb25zdK0HwQJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfeWVhcjQoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JikgY29uc3SuB98Bc3RkOjpfXzI6OnRpbWVfcHV0PGNoYXIsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgY2hhciwgdG0gY29uc3QqLCBjaGFyLCBjaGFyKSBjb25zdK8HSnN0ZDo6X18yOjpfX3RpbWVfcHV0OjpfX2RvX3B1dChjaGFyKiwgY2hhciomLCB0bSBjb25zdCosIGNoYXIsIGNoYXIpIGNvbnN0sAeNAXN0ZDo6X18yOjplbmFibGVfaWY8KGlzX21vdmVfY29uc3RydWN0aWJsZTxjaGFyPjo6dmFsdWUpICYmIChpc19tb3ZlX2Fzc2lnbmFibGU8Y2hhcj46OnZhbHVlKSwgdm9pZD46OnR5cGUgc3RkOjpfXzI6OnN3YXA8Y2hhcj4oY2hhciYsIGNoYXImKbEH7gFzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiBzdGQ6Ol9fMjo6X19jb3B5PGNoYXIqLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+KGNoYXIqLCBjaGFyKiwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4psgfxAXN0ZDo6X18yOjp0aW1lX3B1dDx3Y2hhcl90LCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHdjaGFyX3QsIHRtIGNvbnN0KiwgY2hhciwgY2hhcikgY29uc3SzB1BzdGQ6Ol9fMjo6X190aW1lX3B1dDo6X19kb19wdXQod2NoYXJfdCosIHdjaGFyX3QqJiwgdG0gY29uc3QqLCBjaGFyLCBjaGFyKSBjb25zdLQHZXN0ZDo6X18yOjpfX2xpYmNwcF9tYnNydG93Y3NfbCh3Y2hhcl90KiwgY2hhciBjb25zdCoqLCB1bnNpZ25lZCBsb25nLCBfX21ic3RhdGVfdCosIF9fbG9jYWxlX3N0cnVjdCoptQcsc3RkOjpfXzI6Ol9fdGhyb3dfcnVudGltZV9lcnJvcihjaGFyIGNvbnN0Kim2B4kCc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gc3RkOjpfXzI6Ol9fY29weTx3Y2hhcl90Kiwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPih3Y2hhcl90Kiwgd2NoYXJfdCosIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+KbcHO3N0ZDo6X18yOjptb25leXB1bmN0PGNoYXIsIGZhbHNlPjo6ZG9fZGVjaW1hbF9wb2ludCgpIGNvbnN0uAc2c3RkOjpfXzI6Om1vbmV5cHVuY3Q8Y2hhciwgZmFsc2U+Ojpkb19ncm91cGluZygpIGNvbnN0uQc7c3RkOjpfXzI6Om1vbmV5cHVuY3Q8Y2hhciwgZmFsc2U+Ojpkb19uZWdhdGl2ZV9zaWduKCkgY29uc3S6BzhzdGQ6Ol9fMjo6bW9uZXlwdW5jdDxjaGFyLCBmYWxzZT46OmRvX3Bvc19mb3JtYXQoKSBjb25zdLsHPnN0ZDo6X18yOjptb25leXB1bmN0PHdjaGFyX3QsIGZhbHNlPjo6ZG9fZGVjaW1hbF9wb2ludCgpIGNvbnN0vAc+c3RkOjpfXzI6Om1vbmV5cHVuY3Q8d2NoYXJfdCwgZmFsc2U+Ojpkb19uZWdhdGl2ZV9zaWduKCkgY29uc3S9B6kCc3RkOjpfXzI6Om1vbmV5X2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBib29sLCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBsb25nIGRvdWJsZSYpIGNvbnN0vgeMA3N0ZDo6X18yOjptb25leV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19kb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgYm9vbCwgc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50JiwgYm9vbCYsIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYsIHN0ZDo6X18yOjp1bmlxdWVfcHRyPGNoYXIsIHZvaWQgKCopKHZvaWQqKT4mLCBjaGFyKiYsIGNoYXIqKb8H3QNzdGQ6Ol9fMjo6X19tb25leV9nZXQ8Y2hhcj46Ol9fZ2F0aGVyX2luZm8oYm9vbCwgc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYsIHN0ZDo6X18yOjptb25leV9iYXNlOjpwYXR0ZXJuJiwgY2hhciYsIGNoYXImLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+JiwgaW50JinAB1JzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6b3BlcmF0b3IrKyhpbnQpwQdmdm9pZCBzdGQ6Ol9fMjo6X19kb3VibGVfb3Jfbm90aGluZzxjaGFyPihzdGQ6Ol9fMjo6dW5pcXVlX3B0cjxjaGFyLCB2b2lkICgqKSh2b2lkKik+JiwgY2hhciomLCBjaGFyKiYpwgeGAXZvaWQgc3RkOjpfXzI6Ol9fZG91YmxlX29yX25vdGhpbmc8dW5zaWduZWQgaW50PihzdGQ6Ol9fMjo6dW5pcXVlX3B0cjx1bnNpZ25lZCBpbnQsIHZvaWQgKCopKHZvaWQqKT4mLCB1bnNpZ25lZCBpbnQqJiwgdW5zaWduZWQgaW50KiYpwwfzAnN0ZDo6X18yOjptb25leV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgYm9vbCwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiYpIGNvbnN0xAdec3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6Y2xlYXIoKcUH2gFzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+JiBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpfX2FwcGVuZF9mb3J3YXJkX3Vuc2FmZTxjaGFyKj4oY2hhciosIGNoYXIqKcYHd3N0ZDo6X18yOjptb25leXB1bmN0PGNoYXIsIHRydWU+IGNvbnN0JiBzdGQ6Ol9fMjo6dXNlX2ZhY2V0PHN0ZDo6X18yOjptb25leXB1bmN0PGNoYXIsIHRydWU+ID4oc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYpxwe5AXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46Om9wZXJhdG9yPShzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+JiYpyAd5c3RkOjpfXzI6Om1vbmV5cHVuY3Q8Y2hhciwgZmFsc2U+IGNvbnN0JiBzdGQ6Ol9fMjo6dXNlX2ZhY2V0PHN0ZDo6X18yOjptb25leXB1bmN0PGNoYXIsIGZhbHNlPiA+KHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKckH7wFib29sIHN0ZDo6X18yOjplcXVhbDxzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8Y2hhcio+LCBzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8Y2hhcio+LCBzdGQ6Ol9fMjo6X19lcXVhbF90bzxjaGFyLCBjaGFyPiA+KHN0ZDo6X18yOjpfX3dyYXBfaXRlcjxjaGFyKj4sIHN0ZDo6X18yOjpfX3dyYXBfaXRlcjxjaGFyKj4sIHN0ZDo6X18yOjpfX3dyYXBfaXRlcjxjaGFyKj4sIHN0ZDo6X18yOjpfX2VxdWFsX3RvPGNoYXIsIGNoYXI+KcoHM3N0ZDo6X18yOjpfX3dyYXBfaXRlcjxjaGFyKj46Om9wZXJhdG9yKyhsb25nKSBjb25zdMsHZXN0ZDo6X18yOjp1bmlxdWVfcHRyPGNoYXIsIHZvaWQgKCopKHZvaWQqKT46Om9wZXJhdG9yPShzdGQ6Ol9fMjo6dW5pcXVlX3B0cjxjaGFyLCB2b2lkICgqKSh2b2lkKik+JiYpzAe+AnN0ZDo6X18yOjptb25leV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgYm9vbCwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgbG9uZyBkb3VibGUmKSBjb25zdM0HrQNzdGQ6Ol9fMjo6bW9uZXlfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIGJvb2wsIHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmLCB1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCYsIGJvb2wmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmLCBzdGQ6Ol9fMjo6dW5pcXVlX3B0cjx3Y2hhcl90LCB2b2lkICgqKSh2b2lkKik+Jiwgd2NoYXJfdComLCB3Y2hhcl90KinOB4EEc3RkOjpfXzI6Ol9fbW9uZXlfZ2V0PHdjaGFyX3Q+OjpfX2dhdGhlcl9pbmZvKGJvb2wsIHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmLCBzdGQ6Ol9fMjo6bW9uZXlfYmFzZTo6cGF0dGVybiYsIHdjaGFyX3QmLCB3Y2hhcl90Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiYsIGludCYpzwdYc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46Om9wZXJhdG9yKysoaW50KdAHkQNzdGQ6Ol9fMjo6bW9uZXlfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIGJvb2wsIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4mKSBjb25zdNEHZ3N0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID46OmNsZWFyKCnSB/UBc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiYgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6X19hcHBlbmRfZm9yd2FyZF91bnNhZmU8d2NoYXJfdCo+KHdjaGFyX3QqLCB3Y2hhcl90KinTB31zdGQ6Ol9fMjo6bW9uZXlwdW5jdDx3Y2hhcl90LCB0cnVlPiBjb25zdCYgc3RkOjpfXzI6OnVzZV9mYWNldDxzdGQ6Ol9fMjo6bW9uZXlwdW5jdDx3Y2hhcl90LCB0cnVlPiA+KHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKdQHywFzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+OjpvcGVyYXRvcj0oc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiYmKdUHf3N0ZDo6X18yOjptb25leXB1bmN0PHdjaGFyX3QsIGZhbHNlPiBjb25zdCYgc3RkOjpfXzI6OnVzZV9mYWNldDxzdGQ6Ol9fMjo6bW9uZXlwdW5jdDx3Y2hhcl90LCBmYWxzZT4gPihzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JinWB4oCYm9vbCBzdGQ6Ol9fMjo6ZXF1YWw8c3RkOjpfXzI6Ol9fd3JhcF9pdGVyPHdjaGFyX3QqPiwgc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPHdjaGFyX3QqPiwgc3RkOjpfXzI6Ol9fZXF1YWxfdG88d2NoYXJfdCwgd2NoYXJfdD4gPihzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8d2NoYXJfdCo+LCBzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8d2NoYXJfdCo+LCBzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8d2NoYXJfdCo+LCBzdGQ6Ol9fMjo6X19lcXVhbF90bzx3Y2hhcl90LCB3Y2hhcl90PinXBzZzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8d2NoYXJfdCo+OjpvcGVyYXRvcisobG9uZykgY29uc3TYB9wBc3RkOjpfXzI6Om1vbmV5X3B1dDxjaGFyLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIGJvb2wsIHN0ZDo6X18yOjppb3NfYmFzZSYsIGNoYXIsIGxvbmcgZG91YmxlKSBjb25zdNkHiwNzdGQ6Ol9fMjo6X19tb25leV9wdXQ8Y2hhcj46Ol9fZ2F0aGVyX2luZm8oYm9vbCwgYm9vbCwgc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYsIHN0ZDo6X18yOjptb25leV9iYXNlOjpwYXR0ZXJuJiwgY2hhciYsIGNoYXImLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4mLCBpbnQmKdoH2QNzdGQ6Ol9fMjo6X19tb25leV9wdXQ8Y2hhcj46Ol9fZm9ybWF0KGNoYXIqLCBjaGFyKiYsIGNoYXIqJiwgdW5zaWduZWQgaW50LCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYsIGJvb2wsIHN0ZDo6X18yOjptb25leV9iYXNlOjpwYXR0ZXJuIGNvbnN0JiwgY2hhciwgY2hhciwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QmLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0JiwgaW50KdsHjgFjaGFyKiBzdGQ6Ol9fMjo6Y29weTxzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8Y2hhciBjb25zdCo+LCBjaGFyKj4oc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPGNoYXIgY29uc3QqPiwgc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPGNoYXIgY29uc3QqPiwgY2hhciop3AetAnN0ZDo6X18yOjptb25leV9wdXQ8Y2hhciwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBib29sLCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCBjaGFyLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0JikgY29uc3TdB+4Bc3RkOjpfXzI6Om1vbmV5X3B1dDx3Y2hhcl90LCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIGJvb2wsIHN0ZDo6X18yOjppb3NfYmFzZSYsIHdjaGFyX3QsIGxvbmcgZG91YmxlKSBjb25zdN4HpgNzdGQ6Ol9fMjo6X19tb25leV9wdXQ8d2NoYXJfdD46Ol9fZ2F0aGVyX2luZm8oYm9vbCwgYm9vbCwgc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYsIHN0ZDo6X18yOjptb25leV9iYXNlOjpwYXR0ZXJuJiwgd2NoYXJfdCYsIHdjaGFyX3QmLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4mLCBpbnQmKd8HhgRzdGQ6Ol9fMjo6X19tb25leV9wdXQ8d2NoYXJfdD46Ol9fZm9ybWF0KHdjaGFyX3QqLCB3Y2hhcl90KiYsIHdjaGFyX3QqJiwgdW5zaWduZWQgaW50LCB3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdCosIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYsIGJvb2wsIHN0ZDo6X18yOjptb25leV9iYXNlOjpwYXR0ZXJuIGNvbnN0Jiwgd2NoYXJfdCwgd2NoYXJfdCwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4gY29uc3QmLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+IGNvbnN0JiwgaW50KeAHoAF3Y2hhcl90KiBzdGQ6Ol9fMjo6Y29weTxzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8d2NoYXJfdCBjb25zdCo+LCB3Y2hhcl90Kj4oc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPHdjaGFyX3QgY29uc3QqPiwgc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPHdjaGFyX3QgY29uc3QqPiwgd2NoYXJfdCop4QfIAnN0ZDo6X18yOjptb25leV9wdXQ8d2NoYXJfdCwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBib29sLCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90LCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+IGNvbnN0JikgY29uc3TiB5ABY2hhciogc3RkOjpfXzI6Ol9fY29weTxzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8Y2hhciBjb25zdCo+LCBjaGFyKj4oc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPGNoYXIgY29uc3QqPiwgc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPGNoYXIgY29uc3QqPiwgY2hhciop4weiAXdjaGFyX3QqIHN0ZDo6X18yOjpfX2NvcHk8c3RkOjpfXzI6Ol9fd3JhcF9pdGVyPHdjaGFyX3QgY29uc3QqPiwgd2NoYXJfdCo+KHN0ZDo6X18yOjpfX3dyYXBfaXRlcjx3Y2hhcl90IGNvbnN0Kj4sIHN0ZDo6X18yOjpfX3dyYXBfaXRlcjx3Y2hhcl90IGNvbnN0Kj4sIHdjaGFyX3QqKeQHngFzdGQ6Ol9fMjo6bWVzc2FnZXM8Y2hhcj46OmRvX29wZW4oc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCYsIHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKSBjb25zdOUHlAFzdGQ6Ol9fMjo6bWVzc2FnZXM8Y2hhcj46OmRvX2dldChsb25nLCBpbnQsIGludCwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCYpIGNvbnN05ge4A3N0ZDo6X18yOjpiYWNrX2luc2VydF9pdGVyYXRvcjxzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+ID4gc3RkOjpfXzI6Ol9fbmFycm93X3RvX3V0Zjg8OHVsPjo6b3BlcmF0b3IoKTxzdGQ6Ol9fMjo6YmFja19pbnNlcnRfaXRlcmF0b3I8c3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiA+LCBjaGFyPihzdGQ6Ol9fMjo6YmFja19pbnNlcnRfaXRlcmF0b3I8c3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiA+LCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdCopIGNvbnN05weOAXN0ZDo6X18yOjpiYWNrX2luc2VydF9pdGVyYXRvcjxzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+ID46Om9wZXJhdG9yPShjaGFyIGNvbnN0JinoB6ABc3RkOjpfXzI6Om1lc3NhZ2VzPHdjaGFyX3Q+Ojpkb19nZXQobG9uZywgaW50LCBpbnQsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4gY29uc3QmKSBjb25zdOkHwgNzdGQ6Ol9fMjo6YmFja19pbnNlcnRfaXRlcmF0b3I8c3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiA+IHN0ZDo6X18yOjpfX25hcnJvd190b191dGY4PDMydWw+OjpvcGVyYXRvcigpPHN0ZDo6X18yOjpiYWNrX2luc2VydF9pdGVyYXRvcjxzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+ID4sIHdjaGFyX3Q+KHN0ZDo6X18yOjpiYWNrX2luc2VydF9pdGVyYXRvcjxzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+ID4sIHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0KikgY29uc3TqB9ADc3RkOjpfXzI6OmJhY2tfaW5zZXJ0X2l0ZXJhdG9yPHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4gPiBzdGQ6Ol9fMjo6X193aWRlbl9mcm9tX3V0Zjg8MzJ1bD46Om9wZXJhdG9yKCk8c3RkOjpfXzI6OmJhY2tfaW5zZXJ0X2l0ZXJhdG9yPHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4gPiA+KHN0ZDo6X18yOjpiYWNrX2luc2VydF9pdGVyYXRvcjxzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+ID4sIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KikgY29uc3TrBzlzdGQ6Ol9fMjo6Y29kZWN2dDx3Y2hhcl90LCBjaGFyLCBfX21ic3RhdGVfdD46On5jb2RlY3Z0KCnsBy1zdGQ6Ol9fMjo6bG9jYWxlOjpfX2ltcDo6X19pbXAodW5zaWduZWQgbG9uZyntB35zdGQ6Ol9fMjo6X192ZWN0b3JfYmFzZTxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiA+OjpfX3ZlY3Rvcl9iYXNlKCnuB4IBc3RkOjpfXzI6OnZlY3RvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiA+OjpfX3ZhbGxvY2F0ZSh1bnNpZ25lZCBsb25nKe8HiQFzdGQ6Ol9fMjo6dmVjdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46Ol9fY29uc3RydWN0X2F0X2VuZCh1bnNpZ25lZCBsb25nKfAHdnN0ZDo6X18yOjpfX3ZlY3Rvcl9iYXNlPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46OmNsZWFyKCnxB44Bc3RkOjpfXzI6OnZlY3RvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiA+OjpfX2Fubm90YXRlX3Nocmluayh1bnNpZ25lZCBsb25nKSBjb25zdPIHHXN0ZDo6X18yOjpsb2NhbGU6OmlkOjpfX2dldCgp8wdAc3RkOjpfXzI6OmxvY2FsZTo6X19pbXA6Omluc3RhbGwoc3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBsb25nKfQHSHN0ZDo6X18yOjpjdHlwZTxjaGFyPjo6Y3R5cGUodW5zaWduZWQgc2hvcnQgY29uc3QqLCBib29sLCB1bnNpZ25lZCBsb25nKfUHG3N0ZDo6X18yOjpsb2NhbGU6OmNsYXNzaWMoKfYHfXN0ZDo6X18yOjp2ZWN0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4gPjo6cmVzaXplKHVuc2lnbmVkIGxvbmcp9wchc3RkOjpfXzI6OmxvY2FsZTo6X19pbXA6On5fX2ltcCgp+AeBAXN0ZDo6X18yOjp2ZWN0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4gPjo6X19hbm5vdGF0ZV9kZWxldGUoKSBjb25zdPkHI3N0ZDo6X18yOjpsb2NhbGU6Ol9faW1wOjp+X19pbXAoKS4x+gd/c3RkOjpfXzI6OnZlY3RvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiA+OjpfX2FwcGVuZCh1bnNpZ25lZCBsb25nKfsHHHN0ZDo6X18yOjpsb2NhbGU6Ol9fZ2xvYmFsKCn8BxpzdGQ6Ol9fMjo6bG9jYWxlOjpsb2NhbGUoKf0HLnN0ZDo6X18yOjpsb2NhbGU6Ol9faW1wOjpoYXNfZmFjZXQobG9uZykgY29uc3T+Bx5zdGQ6Ol9fMjo6bG9jYWxlOjppZDo6X19pbml0KCn/B4wBdm9pZCBzdGQ6Ol9fMjo6Y2FsbF9vbmNlPHN0ZDo6X18yOjooYW5vbnltb3VzIG5hbWVzcGFjZSk6Ol9fZmFrZV9iaW5kPihzdGQ6Ol9fMjo6b25jZV9mbGFnJiwgc3RkOjpfXzI6Oihhbm9ueW1vdXMgbmFtZXNwYWNlKTo6X19mYWtlX2JpbmQmJimACCtzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldDo6X19vbl96ZXJvX3NoYXJlZCgpgQhpdm9pZCBzdGQ6Ol9fMjo6X19jYWxsX29uY2VfcHJveHk8c3RkOjpfXzI6OnR1cGxlPHN0ZDo6X18yOjooYW5vbnltb3VzIG5hbWVzcGFjZSk6Ol9fZmFrZV9iaW5kJiY+ID4odm9pZCopggg+c3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+Ojpkb19pcyh1bnNpZ25lZCBzaG9ydCwgd2NoYXJfdCkgY29uc3SDCFZzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD46OmRvX2lzKHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0KiwgdW5zaWduZWQgc2hvcnQqKSBjb25zdIQIWnN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90Pjo6ZG9fc2Nhbl9pcyh1bnNpZ25lZCBzaG9ydCwgd2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqKSBjb25zdIUIW3N0ZDo6X18yOjpjdHlwZTx3Y2hhcl90Pjo6ZG9fc2Nhbl9ub3QodW5zaWduZWQgc2hvcnQsIHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0KikgY29uc3SGCDNzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD46OmRvX3RvdXBwZXIod2NoYXJfdCkgY29uc3SHCERzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD46OmRvX3RvdXBwZXIod2NoYXJfdCosIHdjaGFyX3QgY29uc3QqKSBjb25zdIgIM3N0ZDo6X18yOjpjdHlwZTx3Y2hhcl90Pjo6ZG9fdG9sb3dlcih3Y2hhcl90KSBjb25zdIkIRHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90Pjo6ZG9fdG9sb3dlcih3Y2hhcl90Kiwgd2NoYXJfdCBjb25zdCopIGNvbnN0igguc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+Ojpkb193aWRlbihjaGFyKSBjb25zdIsITHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90Pjo6ZG9fd2lkZW4oY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCB3Y2hhcl90KikgY29uc3SMCDhzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD46OmRvX25hcnJvdyh3Y2hhcl90LCBjaGFyKSBjb25zdI0IVnN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90Pjo6ZG9fbmFycm93KHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0KiwgY2hhciwgY2hhciopIGNvbnN0jggfc3RkOjpfXzI6OmN0eXBlPGNoYXI+Ojp+Y3R5cGUoKY8IIXN0ZDo6X18yOjpjdHlwZTxjaGFyPjo6fmN0eXBlKCkuMZAILXN0ZDo6X18yOjpjdHlwZTxjaGFyPjo6ZG9fdG91cHBlcihjaGFyKSBjb25zdJEIO3N0ZDo6X18yOjpjdHlwZTxjaGFyPjo6ZG9fdG91cHBlcihjaGFyKiwgY2hhciBjb25zdCopIGNvbnN0kggtc3RkOjpfXzI6OmN0eXBlPGNoYXI+Ojpkb190b2xvd2VyKGNoYXIpIGNvbnN0kwg7c3RkOjpfXzI6OmN0eXBlPGNoYXI+Ojpkb190b2xvd2VyKGNoYXIqLCBjaGFyIGNvbnN0KikgY29uc3SUCEZzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj46OmRvX3dpZGVuKGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgY2hhciopIGNvbnN0lQgyc3RkOjpfXzI6OmN0eXBlPGNoYXI+Ojpkb19uYXJyb3coY2hhciwgY2hhcikgY29uc3SWCE1zdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj46OmRvX25hcnJvdyhjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIGNoYXIsIGNoYXIqKSBjb25zdJcIhAFzdGQ6Ol9fMjo6Y29kZWN2dDxjaGFyLCBjaGFyLCBfX21ic3RhdGVfdD46OmRvX291dChfX21ic3RhdGVfdCYsIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdComLCBjaGFyKiwgY2hhciosIGNoYXIqJikgY29uc3SYCGBzdGQ6Ol9fMjo6Y29kZWN2dDxjaGFyLCBjaGFyLCBfX21ic3RhdGVfdD46OmRvX3Vuc2hpZnQoX19tYnN0YXRlX3QmLCBjaGFyKiwgY2hhciosIGNoYXIqJikgY29uc3SZCHJzdGQ6Ol9fMjo6Y29kZWN2dDxjaGFyLCBjaGFyLCBfX21ic3RhdGVfdD46OmRvX2xlbmd0aChfX21ic3RhdGVfdCYsIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgbG9uZykgY29uc3SaCDtzdGQ6Ol9fMjo6Y29kZWN2dDx3Y2hhcl90LCBjaGFyLCBfX21ic3RhdGVfdD46On5jb2RlY3Z0KCkuMZsIkAFzdGQ6Ol9fMjo6Y29kZWN2dDx3Y2hhcl90LCBjaGFyLCBfX21ic3RhdGVfdD46OmRvX291dChfX21ic3RhdGVfdCYsIHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdComLCBjaGFyKiwgY2hhciosIGNoYXIqJikgY29uc3ScCHVzdGQ6Ol9fMjo6X19saWJjcHBfd2NzbnJ0b21ic19sKGNoYXIqLCB3Y2hhcl90IGNvbnN0KiosIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIF9fbWJzdGF0ZV90KiwgX19sb2NhbGVfc3RydWN0KimdCExzdGQ6Ol9fMjo6X19saWJjcHBfd2NydG9tYl9sKGNoYXIqLCB3Y2hhcl90LCBfX21ic3RhdGVfdCosIF9fbG9jYWxlX3N0cnVjdCopngiPAXN0ZDo6X18yOjpjb2RlY3Z0PHdjaGFyX3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9faW4oX19tYnN0YXRlX3QmLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqJiwgd2NoYXJfdCosIHdjaGFyX3QqLCB3Y2hhcl90KiYpIGNvbnN0nwh1c3RkOjpfXzI6Ol9fbGliY3BwX21ic25ydG93Y3NfbCh3Y2hhcl90KiwgY2hhciBjb25zdCoqLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCBfX21ic3RhdGVfdCosIF9fbG9jYWxlX3N0cnVjdCopoAhic3RkOjpfXzI6Ol9fbGliY3BwX21icnRvd2NfbCh3Y2hhcl90KiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGxvbmcsIF9fbWJzdGF0ZV90KiwgX19sb2NhbGVfc3RydWN0KimhCGNzdGQ6Ol9fMjo6Y29kZWN2dDx3Y2hhcl90LCBjaGFyLCBfX21ic3RhdGVfdD46OmRvX3Vuc2hpZnQoX19tYnN0YXRlX3QmLCBjaGFyKiwgY2hhciosIGNoYXIqJikgY29uc3SiCEJzdGQ6Ol9fMjo6Y29kZWN2dDx3Y2hhcl90LCBjaGFyLCBfX21ic3RhdGVfdD46OmRvX2VuY29kaW5nKCkgY29uc3SjCFNzdGQ6Ol9fMjo6X19saWJjcHBfbWJ0b3djX2wod2NoYXJfdCosIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBsb25nLCBfX2xvY2FsZV9zdHJ1Y3QqKaQIMXN0ZDo6X18yOjpfX2xpYmNwcF9tYl9jdXJfbWF4X2woX19sb2NhbGVfc3RydWN0KimlCHVzdGQ6Ol9fMjo6Y29kZWN2dDx3Y2hhcl90LCBjaGFyLCBfX21ic3RhdGVfdD46OmRvX2xlbmd0aChfX21ic3RhdGVfdCYsIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgbG9uZykgY29uc3SmCFdzdGQ6Ol9fMjo6X19saWJjcHBfbWJybGVuX2woY2hhciBjb25zdCosIHVuc2lnbmVkIGxvbmcsIF9fbWJzdGF0ZV90KiwgX19sb2NhbGVfc3RydWN0KimnCERzdGQ6Ol9fMjo6Y29kZWN2dDx3Y2hhcl90LCBjaGFyLCBfX21ic3RhdGVfdD46OmRvX21heF9sZW5ndGgoKSBjb25zdKgIlAFzdGQ6Ol9fMjo6Y29kZWN2dDxjaGFyMTZfdCwgY2hhciwgX19tYnN0YXRlX3Q+Ojpkb19vdXQoX19tYnN0YXRlX3QmLCBjaGFyMTZfdCBjb25zdCosIGNoYXIxNl90IGNvbnN0KiwgY2hhcjE2X3QgY29uc3QqJiwgY2hhciosIGNoYXIqLCBjaGFyKiYpIGNvbnN0qQi1AXN0ZDo6X18yOjp1dGYxNl90b191dGY4KHVuc2lnbmVkIHNob3J0IGNvbnN0KiwgdW5zaWduZWQgc2hvcnQgY29uc3QqLCB1bnNpZ25lZCBzaG9ydCBjb25zdComLCB1bnNpZ25lZCBjaGFyKiwgdW5zaWduZWQgY2hhciosIHVuc2lnbmVkIGNoYXIqJiwgdW5zaWduZWQgbG9uZywgc3RkOjpfXzI6OmNvZGVjdnRfbW9kZSmqCJMBc3RkOjpfXzI6OmNvZGVjdnQ8Y2hhcjE2X3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9faW4oX19tYnN0YXRlX3QmLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqJiwgY2hhcjE2X3QqLCBjaGFyMTZfdCosIGNoYXIxNl90KiYpIGNvbnN0qwi1AXN0ZDo6X18yOjp1dGY4X3RvX3V0ZjE2KHVuc2lnbmVkIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgY2hhciBjb25zdComLCB1bnNpZ25lZCBzaG9ydCosIHVuc2lnbmVkIHNob3J0KiwgdW5zaWduZWQgc2hvcnQqJiwgdW5zaWduZWQgbG9uZywgc3RkOjpfXzI6OmNvZGVjdnRfbW9kZSmsCHZzdGQ6Ol9fMjo6Y29kZWN2dDxjaGFyMTZfdCwgY2hhciwgX19tYnN0YXRlX3Q+Ojpkb19sZW5ndGgoX19tYnN0YXRlX3QmLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGxvbmcpIGNvbnN0rQiAAXN0ZDo6X18yOjp1dGY4X3RvX3V0ZjE2X2xlbmd0aCh1bnNpZ25lZCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgY2hhciBjb25zdCosIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIHN0ZDo6X18yOjpjb2RlY3Z0X21vZGUprghFc3RkOjpfXzI6OmNvZGVjdnQ8Y2hhcjE2X3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9fbWF4X2xlbmd0aCgpIGNvbnN0rwiUAXN0ZDo6X18yOjpjb2RlY3Z0PGNoYXIzMl90LCBjaGFyLCBfX21ic3RhdGVfdD46OmRvX291dChfX21ic3RhdGVfdCYsIGNoYXIzMl90IGNvbnN0KiwgY2hhcjMyX3QgY29uc3QqLCBjaGFyMzJfdCBjb25zdComLCBjaGFyKiwgY2hhciosIGNoYXIqJikgY29uc3SwCK4Bc3RkOjpfXzI6OnVjczRfdG9fdXRmOCh1bnNpZ25lZCBpbnQgY29uc3QqLCB1bnNpZ25lZCBpbnQgY29uc3QqLCB1bnNpZ25lZCBpbnQgY29uc3QqJiwgdW5zaWduZWQgY2hhciosIHVuc2lnbmVkIGNoYXIqLCB1bnNpZ25lZCBjaGFyKiYsIHVuc2lnbmVkIGxvbmcsIHN0ZDo6X18yOjpjb2RlY3Z0X21vZGUpsQiTAXN0ZDo6X18yOjpjb2RlY3Z0PGNoYXIzMl90LCBjaGFyLCBfX21ic3RhdGVfdD46OmRvX2luKF9fbWJzdGF0ZV90JiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiYsIGNoYXIzMl90KiwgY2hhcjMyX3QqLCBjaGFyMzJfdComKSBjb25zdLIIrgFzdGQ6Ol9fMjo6dXRmOF90b191Y3M0KHVuc2lnbmVkIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgY2hhciBjb25zdComLCB1bnNpZ25lZCBpbnQqLCB1bnNpZ25lZCBpbnQqLCB1bnNpZ25lZCBpbnQqJiwgdW5zaWduZWQgbG9uZywgc3RkOjpfXzI6OmNvZGVjdnRfbW9kZSmzCHZzdGQ6Ol9fMjo6Y29kZWN2dDxjaGFyMzJfdCwgY2hhciwgX19tYnN0YXRlX3Q+Ojpkb19sZW5ndGgoX19tYnN0YXRlX3QmLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGxvbmcpIGNvbnN0tAh/c3RkOjpfXzI6OnV0ZjhfdG9fdWNzNF9sZW5ndGgodW5zaWduZWQgY2hhciBjb25zdCosIHVuc2lnbmVkIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCBzdGQ6Ol9fMjo6Y29kZWN2dF9tb2RlKbUIJXN0ZDo6X18yOjpudW1wdW5jdDxjaGFyPjo6fm51bXB1bmN0KCm2CCdzdGQ6Ol9fMjo6bnVtcHVuY3Q8Y2hhcj46On5udW1wdW5jdCgpLjG3CChzdGQ6Ol9fMjo6bnVtcHVuY3Q8d2NoYXJfdD46On5udW1wdW5jdCgpuAgqc3RkOjpfXzI6Om51bXB1bmN0PHdjaGFyX3Q+Ojp+bnVtcHVuY3QoKS4xuQgyc3RkOjpfXzI6Om51bXB1bmN0PGNoYXI+Ojpkb19kZWNpbWFsX3BvaW50KCkgY29uc3S6CDJzdGQ6Ol9fMjo6bnVtcHVuY3Q8Y2hhcj46OmRvX3Rob3VzYW5kc19zZXAoKSBjb25zdLsILXN0ZDo6X18yOjpudW1wdW5jdDxjaGFyPjo6ZG9fZ3JvdXBpbmcoKSBjb25zdLwIMHN0ZDo6X18yOjpudW1wdW5jdDx3Y2hhcl90Pjo6ZG9fZ3JvdXBpbmcoKSBjb25zdL0ILXN0ZDo6X18yOjpudW1wdW5jdDxjaGFyPjo6ZG9fdHJ1ZW5hbWUoKSBjb25zdL4IMHN0ZDo6X18yOjpudW1wdW5jdDx3Y2hhcl90Pjo6ZG9fdHJ1ZW5hbWUoKSBjb25zdL8IfHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID46OmJhc2ljX3N0cmluZyh3Y2hhcl90IGNvbnN0KinACC5zdGQ6Ol9fMjo6bnVtcHVuY3Q8Y2hhcj46OmRvX2ZhbHNlbmFtZSgpIGNvbnN0wQgxc3RkOjpfXzI6Om51bXB1bmN0PHdjaGFyX3Q+Ojpkb19mYWxzZW5hbWUoKSBjb25zdMIIbXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46Om9wZXJhdG9yPShjaGFyIGNvbnN0KinDCDVzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8Y2hhcj46Ol9fd2Vla3MoKSBjb25zdMQIFnN0ZDo6X18yOjppbml0X3dlZWtzKCnFCBpfX2N4eF9nbG9iYWxfYXJyYXlfZHRvci41NMYIOHN0ZDo6X18yOjpfX3RpbWVfZ2V0X2Nfc3RvcmFnZTx3Y2hhcl90Pjo6X193ZWVrcygpIGNvbnN0xwgXc3RkOjpfXzI6OmluaXRfd3dlZWtzKCnICBpfX2N4eF9nbG9iYWxfYXJyYXlfZHRvci42OckIeXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID46Om9wZXJhdG9yPSh3Y2hhcl90IGNvbnN0KinKCDZzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8Y2hhcj46Ol9fbW9udGhzKCkgY29uc3TLCBdzdGQ6Ol9fMjo6aW5pdF9tb250aHMoKcwIGl9fY3h4X2dsb2JhbF9hcnJheV9kdG9yLjg0zQg5c3RkOjpfXzI6Ol9fdGltZV9nZXRfY19zdG9yYWdlPHdjaGFyX3Q+OjpfX21vbnRocygpIGNvbnN0zggYc3RkOjpfXzI6OmluaXRfd21vbnRocygpzwgbX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuMTA40Ag1c3RkOjpfXzI6Ol9fdGltZV9nZXRfY19zdG9yYWdlPGNoYXI+OjpfX2FtX3BtKCkgY29uc3TRCBZzdGQ6Ol9fMjo6aW5pdF9hbV9wbSgp0ggbX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuMTMy0wg4c3RkOjpfXzI6Ol9fdGltZV9nZXRfY19zdG9yYWdlPHdjaGFyX3Q+OjpfX2FtX3BtKCkgY29uc3TUCBdzdGQ6Ol9fMjo6aW5pdF93YW1fcG0oKdUIG19fY3h4X2dsb2JhbF9hcnJheV9kdG9yLjEzNdYIMXN0ZDo6X18yOjpfX3RpbWVfZ2V0X2Nfc3RvcmFnZTxjaGFyPjo6X194KCkgY29uc3TXCBlfX2N4eF9nbG9iYWxfYXJyYXlfZHRvci4x2Ag0c3RkOjpfXzI6Ol9fdGltZV9nZXRfY19zdG9yYWdlPHdjaGFyX3Q+OjpfX3goKSBjb25zdNkIGl9fY3h4X2dsb2JhbF9hcnJheV9kdG9yLjMx2ggxc3RkOjpfXzI6Ol9fdGltZV9nZXRfY19zdG9yYWdlPGNoYXI+OjpfX1goKSBjb25zdNsIGl9fY3h4X2dsb2JhbF9hcnJheV9kdG9yLjMz3Ag0c3RkOjpfXzI6Ol9fdGltZV9nZXRfY19zdG9yYWdlPHdjaGFyX3Q+OjpfX1goKSBjb25zdN0IGl9fY3h4X2dsb2JhbF9hcnJheV9kdG9yLjM13ggxc3RkOjpfXzI6Ol9fdGltZV9nZXRfY19zdG9yYWdlPGNoYXI+OjpfX2MoKSBjb25zdN8IGl9fY3h4X2dsb2JhbF9hcnJheV9kdG9yLjM34Ag0c3RkOjpfXzI6Ol9fdGltZV9nZXRfY19zdG9yYWdlPHdjaGFyX3Q+OjpfX2MoKSBjb25zdOEIGl9fY3h4X2dsb2JhbF9hcnJheV9kdG9yLjM54ggxc3RkOjpfXzI6Ol9fdGltZV9nZXRfY19zdG9yYWdlPGNoYXI+OjpfX3IoKSBjb25zdOMIGl9fY3h4X2dsb2JhbF9hcnJheV9kdG9yLjQx5Ag0c3RkOjpfXzI6Ol9fdGltZV9nZXRfY19zdG9yYWdlPHdjaGFyX3Q+OjpfX3IoKSBjb25zdOUIGl9fY3h4X2dsb2JhbF9hcnJheV9kdG9yLjQz5ghpc3RkOjpfXzI6OnRpbWVfcHV0PGNoYXIsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46On50aW1lX3B1dCgp5whrc3RkOjpfXzI6OnRpbWVfcHV0PGNoYXIsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46On50aW1lX3B1dCgpLjHoCHhzdGQ6Ol9fMjo6dmVjdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46Om1heF9zaXplKCkgY29uc3TpCKsBc3RkOjpfXzI6OmFsbG9jYXRvcl90cmFpdHM8c3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46OmFsbG9jYXRlKHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiYsIHVuc2lnbmVkIGxvbmcp6giLAXN0ZDo6X18yOjp2ZWN0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4gPjo6X19hbm5vdGF0ZV9uZXcodW5zaWduZWQgbG9uZykgY29uc3TrCF9zdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD46OmFsbG9jYXRlKHVuc2lnbmVkIGxvbmcsIHZvaWQgY29uc3QqKewIP3N0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj46OmFsbG9jYXRlKHVuc2lnbmVkIGxvbmcsIHZvaWQgY29uc3QqKe0IyAFzdGQ6Ol9fMjo6YWxsb2NhdG9yX3RyYWl0czxzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4gPjo6ZGVhbGxvY2F0ZShzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4mLCBzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCoqLCB1bnNpZ25lZCBsb25nKe4ImwFzdGQ6Ol9fMjo6X192ZWN0b3JfYmFzZTxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiA+OjpfX2Rlc3RydWN0X2F0X2VuZChzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCoqKe8IInN0ZDo6X18yOjpfX3RpbWVfcHV0OjpfX3RpbWVfcHV0KCnwCIgBc3RkOjpfXzI6OnZlY3RvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiA+OjpfX3JlY29tbWVuZCh1bnNpZ25lZCBsb25nKSBjb25zdPEI2AFzdGQ6Ol9fMjo6X19zcGxpdF9idWZmZXI8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4mPjo6X19zcGxpdF9idWZmZXIodW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+JinyCJEBc3RkOjpfXzI6Ol9fc3BsaXRfYnVmZmVyPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+Jj46Ol9fY29uc3RydWN0X2F0X2VuZCh1bnNpZ25lZCBsb25nKfMI8wFzdGQ6Ol9fMjo6dmVjdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46Ol9fc3dhcF9vdXRfY2lyY3VsYXJfYnVmZmVyKHN0ZDo6X18yOjpfX3NwbGl0X2J1ZmZlcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiY+Jin0CMYDc3RkOjpfXzI6OmVuYWJsZV9pZjwoKHN0ZDo6X18yOjppbnRlZ3JhbF9jb25zdGFudDxib29sLCBmYWxzZT46OnZhbHVlKSB8fCAoIShfX2hhc19jb25zdHJ1Y3Q8c3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+LCBib29sKiwgYm9vbD46OnZhbHVlKSkpICYmIChpc190cml2aWFsbHlfbW92ZV9jb25zdHJ1Y3RpYmxlPGJvb2w+Ojp2YWx1ZSksIHZvaWQ+Ojp0eXBlIHN0ZDo6X18yOjphbGxvY2F0b3JfdHJhaXRzPHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiA+OjpfX2NvbnN0cnVjdF9iYWNrd2FyZDxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCo+KHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiYsIGJvb2wqLCBib29sKiwgYm9vbComKfUIfHN0ZDo6X18yOjpfX2NvbXByZXNzZWRfcGFpcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCoqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4mPjo6c2Vjb25kKCn2CMYBc3RkOjpfXzI6Ol9fc3BsaXRfYnVmZmVyPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+Jj46Ol9fZGVzdHJ1Y3RfYXRfZW5kKHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiosIHN0ZDo6X18yOjppbnRlZ3JhbF9jb25zdGFudDxib29sLCBmYWxzZT4p9whAc3RkOjpfXzI6Oihhbm9ueW1vdXMgbmFtZXNwYWNlKTo6X19mYWtlX2JpbmQ6Om9wZXJhdG9yKCkoKSBjb25zdPgIQnN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD46OmFsbG9jYXRlKHVuc2lnbmVkIGxvbmcsIHZvaWQgY29uc3QqKfkIa3N0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46Ol9fY2xlYXJfYW5kX3Nocmluaygp+gh0c3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6X19jbGVhcl9hbmRfc2hyaW5rKCn7CENsb25nIGRvdWJsZSBzdGQ6Ol9fMjo6X19kb19zdHJ0b2Q8bG9uZyBkb3VibGU+KGNoYXIgY29uc3QqLCBjaGFyKiop/Agtc3RkOjpfXzI6Ol9fc2hhcmVkX2NvdW50Ojp+X19zaGFyZWRfY291bnQoKS4x/Qgvc3RkOjpfXzI6Ol9fc2hhcmVkX3dlYWtfY291bnQ6Ol9fcmVsZWFzZV93ZWFrKCn+CElzdGQ6Ol9fMjo6X19zaGFyZWRfd2Vha19jb3VudDo6X19nZXRfZGVsZXRlcihzdGQ6OnR5cGVfaW5mbyBjb25zdCYpIGNvbnN0/whGc3RkOjpfXzI6Ol9fY2FsbF9vbmNlKHVuc2lnbmVkIGxvbmcgdm9sYXRpbGUmLCB2b2lkKiwgdm9pZCAoKikodm9pZCopKYAJG29wZXJhdG9yIG5ldyh1bnNpZ25lZCBsb25nKYEJPXN0ZDo6X18yOjpfX2xpYmNwcF9yZWZzdHJpbmc6Ol9fbGliY3BwX3JlZnN0cmluZyhjaGFyIGNvbnN0KimCCQd3bWVtc2V0gwkId21lbW1vdmWECUNzdGQ6Ol9fMjo6X19iYXNpY19zdHJpbmdfY29tbW9uPHRydWU+OjpfX3Rocm93X2xlbmd0aF9lcnJvcigpIGNvbnN0hQnBAXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OmJhc2ljX3N0cmluZyhzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0JimGCXlzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpfX2luaXQoY2hhciBjb25zdCosIHVuc2lnbmVkIGxvbmcphwlmc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6fmJhc2ljX3N0cmluZygpiAl5c3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6YXNzaWduKGNoYXIgY29uc3QqLCB1bnNpZ25lZCBsb25nKYkJ0wFzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpfX2dyb3dfYnlfYW5kX3JlcGxhY2UodW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgY2hhciBjb25zdCopiglyc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6cmVzaXplKHVuc2lnbmVkIGxvbmcsIGNoYXIpiwlyc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6YXBwZW5kKHVuc2lnbmVkIGxvbmcsIGNoYXIpjAl0c3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6X19lcmFzZV90b19lbmQodW5zaWduZWQgbG9uZymNCboBc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6X19ncm93X2J5KHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcpjgk/c3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+Ojphc3NpZ24oY2hhciosIHVuc2lnbmVkIGxvbmcsIGNoYXIpjwl5c3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6YXBwZW5kKGNoYXIgY29uc3QqLCB1bnNpZ25lZCBsb25nKZAJZnN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OnB1c2hfYmFjayhjaGFyKZEJcnN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46Ol9faW5pdCh1bnNpZ25lZCBsb25nLCBjaGFyKZIJhQFzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+OjpfX2luaXQod2NoYXJfdCBjb25zdCosIHVuc2lnbmVkIGxvbmcpkwmFAXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID46OmFzc2lnbih3Y2hhcl90IGNvbnN0KiwgdW5zaWduZWQgbG9uZymUCd8Bc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6X19ncm93X2J5X2FuZF9yZXBsYWNlKHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIHdjaGFyX3QgY29uc3QqKZUJwwFzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+OjpfX2dyb3dfYnkodW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZymWCYUBc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6YXBwZW5kKHdjaGFyX3QgY29uc3QqLCB1bnNpZ25lZCBsb25nKZcJcnN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID46OnB1c2hfYmFjayh3Y2hhcl90KZgJfnN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID46Ol9faW5pdCh1bnNpZ25lZCBsb25nLCB3Y2hhcl90KZkJQnN0ZDo6X18yOjpfX3ZlY3Rvcl9iYXNlX2NvbW1vbjx0cnVlPjo6X190aHJvd19sZW5ndGhfZXJyb3IoKSBjb25zdJoJDWFib3J0X21lc3NhZ2WbCRJfX2N4YV9wdXJlX3ZpcnR1YWycCRxzdGQ6OmV4Y2VwdGlvbjo6d2hhdCgpIGNvbnN0nQkgc3RkOjpsb2dpY19lcnJvcjo6fmxvZ2ljX2Vycm9yKCmeCTNzdGQ6Ol9fMjo6X19saWJjcHBfcmVmc3RyaW5nOjp+X19saWJjcHBfcmVmc3RyaW5nKCmfCSJzdGQ6OmxvZ2ljX2Vycm9yOjp+bG9naWNfZXJyb3IoKS4xoAkic3RkOjpsZW5ndGhfZXJyb3I6On5sZW5ndGhfZXJyb3IoKaEJG3N0ZDo6YmFkX2Nhc3Q6OndoYXQoKSBjb25zdKIJYV9fY3h4YWJpdjE6Ol9fZnVuZGFtZW50YWxfdHlwZV9pbmZvOjpjYW5fY2F0Y2goX19jeHhhYml2MTo6X19zaGltX3R5cGVfaW5mbyBjb25zdCosIHZvaWQqJikgY29uc3SjCTxpc19lcXVhbChzdGQ6OnR5cGVfaW5mbyBjb25zdCosIHN0ZDo6dHlwZV9pbmZvIGNvbnN0KiwgYm9vbCmkCVtfX2N4eGFiaXYxOjpfX2NsYXNzX3R5cGVfaW5mbzo6Y2FuX2NhdGNoKF9fY3h4YWJpdjE6Ol9fc2hpbV90eXBlX2luZm8gY29uc3QqLCB2b2lkKiYpIGNvbnN0pQkOX19keW5hbWljX2Nhc3SmCWtfX2N4eGFiaXYxOjpfX2NsYXNzX3R5cGVfaW5mbzo6cHJvY2Vzc19mb3VuZF9iYXNlX2NsYXNzKF9fY3h4YWJpdjE6Ol9fZHluYW1pY19jYXN0X2luZm8qLCB2b2lkKiwgaW50KSBjb25zdKcJbl9fY3h4YWJpdjE6Ol9fY2xhc3NfdHlwZV9pbmZvOjpoYXNfdW5hbWJpZ3VvdXNfcHVibGljX2Jhc2UoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQqLCBpbnQpIGNvbnN0qAlxX19jeHhhYml2MTo6X19zaV9jbGFzc190eXBlX2luZm86Omhhc191bmFtYmlndW91c19wdWJsaWNfYmFzZShfX2N4eGFiaXYxOjpfX2R5bmFtaWNfY2FzdF9pbmZvKiwgdm9pZCosIGludCkgY29uc3SpCXNfX2N4eGFiaXYxOjpfX2Jhc2VfY2xhc3NfdHlwZV9pbmZvOjpoYXNfdW5hbWJpZ3VvdXNfcHVibGljX2Jhc2UoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQqLCBpbnQpIGNvbnN0qglyX19jeHhhYml2MTo6X192bWlfY2xhc3NfdHlwZV9pbmZvOjpoYXNfdW5hbWJpZ3VvdXNfcHVibGljX2Jhc2UoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQqLCBpbnQpIGNvbnN0qwlbX19jeHhhYml2MTo6X19wYmFzZV90eXBlX2luZm86OmNhbl9jYXRjaChfX2N4eGFiaXYxOjpfX3NoaW1fdHlwZV9pbmZvIGNvbnN0Kiwgdm9pZComKSBjb25zdKwJXV9fY3h4YWJpdjE6Ol9fcG9pbnRlcl90eXBlX2luZm86OmNhbl9jYXRjaChfX2N4eGFiaXYxOjpfX3NoaW1fdHlwZV9pbmZvIGNvbnN0Kiwgdm9pZComKSBjb25zdK0JXF9fY3h4YWJpdjE6Ol9fcG9pbnRlcl90eXBlX2luZm86OmNhbl9jYXRjaF9uZXN0ZWQoX19jeHhhYml2MTo6X19zaGltX3R5cGVfaW5mbyBjb25zdCopIGNvbnN0rglmX19jeHhhYml2MTo6X19wb2ludGVyX3RvX21lbWJlcl90eXBlX2luZm86OmNhbl9jYXRjaF9uZXN0ZWQoX19jeHhhYml2MTo6X19zaGltX3R5cGVfaW5mbyBjb25zdCopIGNvbnN0rwmDAV9fY3h4YWJpdjE6Ol9fY2xhc3NfdHlwZV9pbmZvOjpwcm9jZXNzX3N0YXRpY190eXBlX2Fib3ZlX2RzdChfX2N4eGFiaXYxOjpfX2R5bmFtaWNfY2FzdF9pbmZvKiwgdm9pZCBjb25zdCosIHZvaWQgY29uc3QqLCBpbnQpIGNvbnN0sAlzX19jeHhhYml2MTo6X192bWlfY2xhc3NfdHlwZV9pbmZvOjpzZWFyY2hfYmVsb3dfZHN0KF9fY3h4YWJpdjE6Ol9fZHluYW1pY19jYXN0X2luZm8qLCB2b2lkIGNvbnN0KiwgaW50LCBib29sKSBjb25zdLEJgQFfX2N4eGFiaXYxOjpfX2Jhc2VfY2xhc3NfdHlwZV9pbmZvOjpzZWFyY2hfYWJvdmVfZHN0KF9fY3h4YWJpdjE6Ol9fZHluYW1pY19jYXN0X2luZm8qLCB2b2lkIGNvbnN0Kiwgdm9pZCBjb25zdCosIGludCwgYm9vbCkgY29uc3SyCXRfX2N4eGFiaXYxOjpfX2Jhc2VfY2xhc3NfdHlwZV9pbmZvOjpzZWFyY2hfYmVsb3dfZHN0KF9fY3h4YWJpdjE6Ol9fZHluYW1pY19jYXN0X2luZm8qLCB2b2lkIGNvbnN0KiwgaW50LCBib29sKSBjb25zdLMJcl9fY3h4YWJpdjE6Ol9fc2lfY2xhc3NfdHlwZV9pbmZvOjpzZWFyY2hfYmVsb3dfZHN0KF9fY3h4YWJpdjE6Ol9fZHluYW1pY19jYXN0X2luZm8qLCB2b2lkIGNvbnN0KiwgaW50LCBib29sKSBjb25zdLQJb19fY3h4YWJpdjE6Ol9fY2xhc3NfdHlwZV9pbmZvOjpzZWFyY2hfYmVsb3dfZHN0KF9fY3h4YWJpdjE6Ol9fZHluYW1pY19jYXN0X2luZm8qLCB2b2lkIGNvbnN0KiwgaW50LCBib29sKSBjb25zdLUJgAFfX2N4eGFiaXYxOjpfX3ZtaV9jbGFzc190eXBlX2luZm86OnNlYXJjaF9hYm92ZV9kc3QoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQgY29uc3QqLCB2b2lkIGNvbnN0KiwgaW50LCBib29sKSBjb25zdLYJf19fY3h4YWJpdjE6Ol9fc2lfY2xhc3NfdHlwZV9pbmZvOjpzZWFyY2hfYWJvdmVfZHN0KF9fY3h4YWJpdjE6Ol9fZHluYW1pY19jYXN0X2luZm8qLCB2b2lkIGNvbnN0Kiwgdm9pZCBjb25zdCosIGludCwgYm9vbCkgY29uc3S3CXxfX2N4eGFiaXYxOjpfX2NsYXNzX3R5cGVfaW5mbzo6c2VhcmNoX2Fib3ZlX2RzdChfX2N4eGFiaXYxOjpfX2R5bmFtaWNfY2FzdF9pbmZvKiwgdm9pZCBjb25zdCosIHZvaWQgY29uc3QqLCBpbnQsIGJvb2wpIGNvbnN0uAkIX19zdHJkdXC5CQ1fX2dldFR5cGVOYW1lugkqX19lbWJpbmRfcmVnaXN0ZXJfbmF0aXZlX2FuZF9idWlsdGluX3R5cGVzuwk/dm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX2ludGVnZXI8Y2hhcj4oY2hhciBjb25zdCopvAlGdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX2ludGVnZXI8c2lnbmVkIGNoYXI+KGNoYXIgY29uc3QqKb0JSHZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9pbnRlZ2VyPHVuc2lnbmVkIGNoYXI+KGNoYXIgY29uc3QqKb4JQHZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9pbnRlZ2VyPHNob3J0PihjaGFyIGNvbnN0Kim/CUl2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfaW50ZWdlcjx1bnNpZ25lZCBzaG9ydD4oY2hhciBjb25zdCopwAk+dm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX2ludGVnZXI8aW50PihjaGFyIGNvbnN0KinBCUd2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfaW50ZWdlcjx1bnNpZ25lZCBpbnQ+KGNoYXIgY29uc3QqKcIJP3ZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9pbnRlZ2VyPGxvbmc+KGNoYXIgY29uc3QqKcMJSHZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9pbnRlZ2VyPHVuc2lnbmVkIGxvbmc+KGNoYXIgY29uc3QqKcQJPnZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9mbG9hdDxmbG9hdD4oY2hhciBjb25zdCopxQk/dm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX2Zsb2F0PGRvdWJsZT4oY2hhciBjb25zdCopxglDdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX21lbW9yeV92aWV3PGNoYXI+KGNoYXIgY29uc3QqKccJSnZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9tZW1vcnlfdmlldzxzaWduZWQgY2hhcj4oY2hhciBjb25zdCopyAlMdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX21lbW9yeV92aWV3PHVuc2lnbmVkIGNoYXI+KGNoYXIgY29uc3QqKckJRHZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9tZW1vcnlfdmlldzxzaG9ydD4oY2hhciBjb25zdCopyglNdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX21lbW9yeV92aWV3PHVuc2lnbmVkIHNob3J0PihjaGFyIGNvbnN0KinLCUJ2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfbWVtb3J5X3ZpZXc8aW50PihjaGFyIGNvbnN0KinMCUt2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfbWVtb3J5X3ZpZXc8dW5zaWduZWQgaW50PihjaGFyIGNvbnN0KinNCUN2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfbWVtb3J5X3ZpZXc8bG9uZz4oY2hhciBjb25zdCopzglMdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX21lbW9yeV92aWV3PHVuc2lnbmVkIGxvbmc+KGNoYXIgY29uc3QqKc8JRHZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9tZW1vcnlfdmlldzxmbG9hdD4oY2hhciBjb25zdCop0AlFdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX21lbW9yeV92aWV3PGRvdWJsZT4oY2hhciBjb25zdCop0QluRW1zY3JpcHRlbkJpbmRpbmdJbml0aWFsaXplcl9uYXRpdmVfYW5kX2J1aWx0aW5fdHlwZXM6OkVtc2NyaXB0ZW5CaW5kaW5nSW5pdGlhbGl6ZXJfbmF0aXZlX2FuZF9idWlsdGluX3R5cGVzKCnSCQhkbG1hbGxvY9MJBmRsZnJlZdQJCWRscmVhbGxvY9UJEXRyeV9yZWFsbG9jX2NodW5r1gkNZGlzcG9zZV9jaHVua9cJBHNicmvYCQRmbW9k2QkFZm1vZGzaCQVsb2cxMNsJBmxvZzEwZtwJBnNjYWxibt0JDV9fZnBjbGFzc2lmeWzeCQZtZW1jcHnfCQZtZW1zZXTgCQdtZW1tb3Zl4QkIc2V0VGhyZXfiCQlzdGFja1NhdmXjCQpzdGFja0FsbG9j5AkMc3RhY2tSZXN0b3Jl5QkQX19ncm93V2FzbU1lbW9yeeYJC2R5bkNhbGxfdmlp5wkNZHluQ2FsbF92aWlpaegJC2R5bkNhbGxfZGlk6QkMZHluQ2FsbF9kaWlk6gkNZHluQ2FsbF9kaWRkZOsJDmR5bkNhbGxfZGlpZGRk7AkMZHluQ2FsbF9kaWRk7QkNZHluQ2FsbF9kaWlkZO4JC2R5bkNhbGxfZGlp7wkLZHluQ2FsbF92aWTwCQxkeW5DYWxsX3ZpaWTxCQxkeW5DYWxsX2RpaWnyCQ1keW5DYWxsX2RpaWlp8wkNZHluQ2FsbF92aWlpZPQJDWR5bkNhbGxfZGlkaWT1CQ5keW5DYWxsX2RpaWRpZPYJDmR5bkNhbGxfZGlkaWRp9wkPZHluQ2FsbF9kaWlkaWRp+AkNZHluQ2FsbF92aWRpZPkJDmR5bkNhbGxfdmlpZGlk+gkOZHluQ2FsbF92aWRpZGT7CQ9keW5DYWxsX3ZpaWRpZGT8CQ9keW5DYWxsX3ZpZGlkZGT9CRBkeW5DYWxsX3ZpaWRpZGRk/gkOZHluQ2FsbF92aWRkZGn/CQ9keW5DYWxsX3ZpaWRkZGmACg1keW5DYWxsX2lpaWlkgQoMZHluQ2FsbF92aWRkggoNZHluQ2FsbF92aWlkZIMKDWR5bkNhbGxfaWlpaWmECg5keW5DYWxsX3ZpZmZpaYUKD2R5bkNhbGxfdmlpZmZpaYYKD2R5bkNhbGxfZGlkZGRkZIcKD2R5bkNhbGxfZGlkZGlkZIgKEGR5bkNhbGxfZGlpZGRpZGSJChBkeW5DYWxsX2RpaWRkZGRkigoPZHluQ2FsbF9kaWRkZGlpiwoQZHluQ2FsbF9kaWlkZGRpaYwKEWR5bkNhbGxfZGlkZGRkZGlpjQoSZHluQ2FsbF9kaWlkZGRkZGlpjgoMZHluQ2FsbF9kaWRpjwoNZHluQ2FsbF9kaWlkaZAKD2R5bkNhbGxfZGlkaWRkZJEKEGR5bkNhbGxfZGlpZGlkZGSSCg1keW5DYWxsX2RpZGRpkwoOZHluQ2FsbF9kaWlkZGmUCgxkeW5DYWxsX3ZpZGmVCg1keW5DYWxsX3ZpaWRplgoOZHluQ2FsbF92aWlpaWmXCgxkeW5DYWxsX2lpZmmYCg1keW5DYWxsX2lpaWZpmQoKZHluQ2FsbF9maZoKC2R5bkNhbGxfZmlpmwoNZHluQ2FsbF9maWlpaZwKDmR5bkNhbGxfZmlpaWlpnQoPZHluQ2FsbF92aWlpaWRkngoQZHluQ2FsbF92aWlpaWlkZJ8KDGR5bkNhbGxfdmlpZqAKDWR5bkNhbGxfdmlpaWahCg1keW5DYWxsX2lpaWlmogoOZHluQ2FsbF9kaWRkaWSjCg9keW5DYWxsX2RpaWRkaWSkCg9keW5DYWxsX2RpZGRkaWSlChBkeW5DYWxsX2RpaWRkZGlkpgoOZHluQ2FsbF9kaWRkZGmnCg9keW5DYWxsX2RpaWRkZGmoCgtkeW5DYWxsX2lpZKkKDWR5bkNhbGxfZGlkaWmqCg5keW5DYWxsX2RpaWRpaasKD2R5bkNhbGxfaWlkaWlpaawKDmR5bkNhbGxfaWlpaWlprQoRZHluQ2FsbF9paWlpaWlpaWmuCg9keW5DYWxsX2lpaWlpaWmvCg5keW5DYWxsX2lpaWlpZLAKEGR5bkNhbGxfaWlpaWlpaWmxCg9keW5DYWxsX3ZpaWlpaWmyCglkeW5DYWxsX3azChhsZWdhbHN0dWIkZHluQ2FsbF92aWlqaWm0ChZsZWdhbHN0dWIkZHluQ2FsbF9qaWpptQoYbGVnYWxzdHViJGR5bkNhbGxfaWlpaWlqtgoZbGVnYWxzdHViJGR5bkNhbGxfaWlpaWlqarcKGmxlZ2Fsc3R1YiRkeW5DYWxsX2lpaWlpaWpqAHUQc291cmNlTWFwcGluZ1VSTGNodHRwOi8vbG9jYWxob3N0OjkwMDAvYXVkaW8td29ya2xldC9idWlsZC97e3sgRklMRU5BTUVfUkVQTEFDRU1FTlRfU1RSSU5HU19XQVNNX0JJTkFSWV9GSUxFIH19fS5tYXA=';
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




// STATICTOP = STATIC_BASE + 53440;
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
      return 54304;
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
var dynCall_iii = Module["dynCall_iii"] = asm["dynCall_iii"];
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
var dynCall_dddddd = Module["dynCall_dddddd"] = asm["dynCall_dddddd"];
var dynCall_diddddd = Module["dynCall_diddddd"] = asm["dynCall_diddddd"];
var dynCall_diddidd = Module["dynCall_diddidd"] = asm["dynCall_diddidd"];
var dynCall_diiddidd = Module["dynCall_diiddidd"] = asm["dynCall_diiddidd"];
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


