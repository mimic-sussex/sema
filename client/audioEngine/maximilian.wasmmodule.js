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
    STACK_BASE = 5297328,
    STACKTOP = STACK_BASE,
    STACK_MAX = 54448,
    DYNAMIC_BASE = 5297328,
    DYNAMICTOP_PTR = 54288;




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




var wasmBinaryFile = 'data:application/octet-stream;base64,AGFzbQEAAAAB/AqkAWABfwF/YAF/AGACf38AYAJ/fwF/YAN/f38Bf2ADf39/AGAFf39/f38Bf2AAAGAEf39/fwF/YAZ/f39/f38Bf2AFf39/f38AYAR/f39/AGAAAX9gBn9/f39/fwBgCH9/f39/f39/AX9gAn98AGABfwF8YAJ/fAF8YAN/fHwBfGACfHwBfGAHf39/f39/fwF/YAR/fHx8AXxgAXwBfGAHf39/f39/fwBgAn9/AXxgBH9/f3wAYAN/f3wAYAV/fn5+fgBgA39+fwF+YAF9AX1gA39/fwF8YAR/fHx/AXxgBn98fHx8fAF8YAp/f39/f39/f39/AGADf3x/AGAFf39/f34Bf2ADf3x/AXxgBXx8fHx8AXxgBX9/fn9/AGAFf39/f3wBf2AEf39/fwF+YAF/AX1gAn9/AX1gBH9/fH8BfGAFf398fH8BfGAGf3x/fHx8AXxgBX98fH98AXxgBX98fHx/AXxgA3x8fAF8YAh/f39/f39/fwBgB39/f39/fHwAYAZ/f39/fHwAYAR/f399AGAGf399fX9/AGAEf398fwBgBX9/fH98AGAGf398f3x8AGAHf398f3x8fABgBH9/fHwAYAV/f3x8fABgBH9+fn8AYAV/fX1/fwBgBH98f3wAYAV/fH98fABgBn98f3x8fABgA398fABgBH98fHwAYAp/f39/f39/f39/AX9gB39/f39/fn4Bf2AGf39/f35+AX9gBH9/f3wBf2AEf399fwF/YAN/fX8Bf2AGf3x/f39/AX9gBH9/f38BfWAFf39/f38BfWAEf39/fwF8YAN/f3wBfGAFf398f38BfGAFf398f3wBfGAGf398f3x/AXxgB39/fH98fHwBfGAEf398fAF8YAZ/f3x8f3wBfGAHf398fH98fAF8YAV/f3x8fAF8YAZ/f3x8fH8BfGAHf398fHx/fwF8YAd/f3x8fH98AXxgB39/fHx8fHwBfGAJf398fHx8fH9/AXxgBH98f38BfGAEf3x/fAF8YAV/fH98fwF8YAZ/fHx/fHwBfGAGf3x8fH9/AXxgBn98fHx/fAF8YAh/fHx8fHx/fwF8YA9/f39/f39/f39/f39/f38AYAN/f30AYAJ/fgBgCX9/f39/f39/fwF/YAt/f39/f39/f39/fwF/YAx/f39/f39/f39/f38Bf2AEf39/fQF/YAN/fn8Bf2ACf3wBf2ACfn8Bf2ACfn4Bf2ABfAF/YAF/AX5gBH9/f34BfmADf39/AX1gAn1/AX1gAXwBfWACfH8BfGADfHx/AXxgDH9/f39/f39/f39/fwBgDX9/f39/f39/f39/f38AYAh/f39/f398fABgBX9/f399AGAFf39/f3wAYAd/f399fX9/AGAFf39/fH8AYAZ/f398f3wAYAd/f398f3x8AGAIf39/fH98fHwAYAV/f398fABgBn9/f3x8fABgA39/fgBgBn9/fHx8fwBgA39+fgBgAn99AGAGf39/f398AX9gBX9/f399AX9gBX9/f31/AX9gA39/fAF/YAd/f3x/f39/AX9gA35/fwF/YAR+fn5+AX9gAn1/AX9gAnx/AX9gAn9/AX5gBn9/f39/fwF9YAJ+fgF9YAJ9fQF9YAV/f39/fwF8YAR/f398AXxgBX9/f3x/AXxgBn9/f3x/fwF8YAZ/f398f3wBfGAHf39/fH98fwF8YAh/f398f3x8fAF8YAV/f398fAF8YAZ/f398fH8BfGAHf39/fHx/fAF8YAh/f398fH98fAF8YAZ/f398fHwBfGAHf39/fHx8fwF8YAh/f398fHx/fwF8YAh/f398fHx/fAF8YAh/f398fHx8fAF8YAp/f398fHx8fH9/AXxgAn5+AXwClgktA2VudhZfZW1iaW5kX3JlZ2lzdGVyX2NsYXNzAHYDZW52Il9lbWJpbmRfcmVnaXN0ZXJfY2xhc3NfY29uc3RydWN0b3IADQNlbnYlX2VtYmluZF9yZWdpc3Rlcl9jbGFzc19jbGFzc19mdW5jdGlvbgAXA2Vudh9fZW1iaW5kX3JlZ2lzdGVyX2NsYXNzX3Byb3BlcnR5ACEDZW52H19lbWJpbmRfcmVnaXN0ZXJfY2xhc3NfZnVuY3Rpb24AMQNlbnYVX2VtYmluZF9yZWdpc3Rlcl9lbnVtAAsDZW52G19lbWJpbmRfcmVnaXN0ZXJfZW51bV92YWx1ZQAFA2VudhpfZW1iaW5kX3JlZ2lzdGVyX3NtYXJ0X3B0cgB1A2VudhhfX2N4YV9hbGxvY2F0ZV9leGNlcHRpb24AAANlbnYLX19jeGFfdGhyb3cABQNlbnYRX2VtdmFsX3Rha2VfdmFsdWUAAwNlbnYNX2VtdmFsX2luY3JlZgABA2Vudg1fZW12YWxfZGVjcmVmAAEDZW52C19lbXZhbF9jYWxsAAgDZW52BXJvdW5kABYDZW52BGV4aXQAAQNlbnYNX19hc3NlcnRfZmFpbAALA2VudgZfX2xvY2sAAQNlbnYIX191bmxvY2sAARZ3YXNpX3NuYXBzaG90X3ByZXZpZXcxCGZkX2Nsb3NlAAADZW52Cl9fc3lzY2FsbDUAAwNlbnYMX19zeXNjYWxsMjIxAAMDZW52C19fc3lzY2FsbDU0AAMWd2FzaV9zbmFwc2hvdF9wcmV2aWV3MQdmZF9yZWFkAAgWd2FzaV9zbmFwc2hvdF9wcmV2aWV3MQhmZF93cml0ZQAIFndhc2lfc25hcHNob3RfcHJldmlldzERZW52aXJvbl9zaXplc19nZXQAAxZ3YXNpX3NuYXBzaG90X3ByZXZpZXcxC2Vudmlyb25fZ2V0AAMDZW52Cl9fbWFwX2ZpbGUAAwNlbnYLX19zeXNjYWxsOTEAAwNlbnYKc3RyZnRpbWVfbAAGA2VudgVhYm9ydAAHA2VudhVfZW1iaW5kX3JlZ2lzdGVyX3ZvaWQAAgNlbnYVX2VtYmluZF9yZWdpc3Rlcl9ib29sAAoDZW52G19lbWJpbmRfcmVnaXN0ZXJfc3RkX3N0cmluZwACA2VudhxfZW1iaW5kX3JlZ2lzdGVyX3N0ZF93c3RyaW5nAAUDZW52Fl9lbWJpbmRfcmVnaXN0ZXJfZW12YWwAAgNlbnYYX2VtYmluZF9yZWdpc3Rlcl9pbnRlZ2VyAAoDZW52Fl9lbWJpbmRfcmVnaXN0ZXJfZmxvYXQABQNlbnYcX2VtYmluZF9yZWdpc3Rlcl9tZW1vcnlfdmlldwAFA2VudhZlbXNjcmlwdGVuX3Jlc2l6ZV9oZWFwAAADZW52FWVtc2NyaXB0ZW5fbWVtY3B5X2JpZwAEA2VudgtzZXRUZW1wUmV0MAABFndhc2lfc25hcHNob3RfcHJldmlldzEHZmRfc2VlawAGA2VudgZtZW1vcnkCAIAQA2VudgV0YWJsZQFwANUHA7MKjQoHBwcHBwcHAAEADAIBAAsFAAIDBQACAAIADE1VUhgaAAxMGRAPAAIADE9QAAwQDxAPAAw3ODkADBFCOw8AAEYZFTAADEE6DxAQDxAPDwABDAALCAIBNQgAJSAlJTAVIAAMVFkADFda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Q2FsbF9kaWRpZAD0CQ5keW5DYWxsX2RpaWRpZAD1CQ5keW5DYWxsX2RpZGlkaQD2CQ9keW5DYWxsX2RpaWRpZGkA9wkNZHluQ2FsbF92aWRpZAD4CQ5keW5DYWxsX3ZpaWRpZAD5CQ5keW5DYWxsX3ZpZGlkZAD6CQ9keW5DYWxsX3ZpaWRpZGQA+wkPZHluQ2FsbF92aWRpZGRkAPwJEGR5bkNhbGxfdmlpZGlkZGQA/QkNZHluQ2FsbF92aWRkZAD+CQ5keW5DYWxsX3ZpaWRkZAD/CQ1keW5DYWxsX2lpaWlkAIAKDGR5bkNhbGxfZGRkZABrDGR5bkNhbGxfdmlkZACBCg1keW5DYWxsX3ZpaWRkAIIKDGR5bkNhbGxfaWlpaQDIAg1keW5DYWxsX2lpaWlpAIMKDmR5bkNhbGxfdmlmZmlpAIQKD2R5bkNhbGxfdmlpZmZpaQCFCg5keW5DYWxsX2RkZGRkZACJAQ9keW5DYWxsX2RpZGRkZGQAhgoPZHluQ2FsbF9kaWRkaWRkAIcKEGR5bkNhbGxfZGlpZGRpZGQAiAoQZHluQ2FsbF9kaWlkZGRkZACJCg9keW5DYWxsX2RpZGRkaWkAigoQZHluQ2FsbF9kaWlkZGRpaQCLChFkeW5DYWxsX2RpZGRkZGRpaQCMChJkeW5DYWxsX2RpaWRkZGRkaWkAjQoMZHluQ2FsbF9kaWRpAI4KDWR5bkNhbGxfZGlpZGkAjwoKZHluQ2FsbF9kZACaAQ9keW5DYWxsX2RpZGlkZGQAkAoQZHluQ2FsbF9kaWlkaWRkZACRCgtkeW5DYWxsX2RkZACyAQ1keW5DYWxsX2RpZGRpAJIKDmR5bkNhbGxfZGlpZGRpAJMKDGR5bkNhbGxfdmlkaQCUCg1keW5DYWxsX3ZpaWRpAJUKDmR5bkNhbGxfdmlpaWlpAJYKDGR5bkNhbGxfaWlmaQCXCg1keW5DYWxsX2lpaWZpAJgKCmR5bkNhbGxfZmkAmQoLZHluQ2FsbF9maWkAmgoNZHluQ2FsbF9maWlpaQCbCg5keW5DYWxsX2ZpaWlpaQCcCg9keW5DYWxsX3ZpaWlpZGQAnQoQZHluQ2FsbF92aWlpaWlkZACeCgxkeW5DYWxsX3ZpaWYAnwoNZHluQ2FsbF92aWlpZgCgCg1keW5DYWxsX2lpaWlmAKEKDmR5bkNhbGxfZGlkZGlkAKIKD2R5bkNhbGxfZGlpZGRpZACjCg9keW5DYWxsX2RpZGRkaWQApAoQZHluQ2FsbF9kaWlkZGRpZAClCg5keW5DYWxsX2RpZGRkaQCmCg9keW5DYWxsX2RpaWRkZGkApwoLZHluQ2FsbF9paWQAqAoKZHluQ2FsbF9pZADcAg1keW5DYWxsX2RpZGlpAKkKDmR5bkNhbGxfZGlpZGlpAKoKDmR5bkNhbGxfdmlpamlpALMKDGR5bkNhbGxfamlqaQC0Cg9keW5DYWxsX2lpZGlpaWkAqwoOZHluQ2FsbF9paWlpaWkArAoRZHluQ2FsbF9paWlpaWlpaWkArQoPZHluQ2FsbF9paWlpaWlpAK4KDmR5bkNhbGxfaWlpaWlqALUKDmR5bkNhbGxfaWlpaWlkAK8KD2R5bkNhbGxfaWlpaWlqagC2ChBkeW5DYWxsX2lpaWlpaWlpALAKEGR5bkNhbGxfaWlpaWlpamoAtwoPZHluQ2FsbF92aWlpaWlpALEKCWR5bkNhbGxfdgCyCgnPDQEAQQEL1AcyMzQ1Njc2NzgzNDU5Ojs8PT4/QEFCQzM0RJEDRZQDlQOZA0aaA5wDlgOXA0eYA5ADSJMDkgObA3ZJSjM0S50DTJ4DTU5PSElQUT0+UjM0U6ADVKEDVVYzNFekA0alA6YDogNHowNYWUhJWltcMzRdpwNeqANfqQNgYTM0YmNFZGVmSWc9aDNpamtsbTM0bm9wcUlySHN0SEl1dnd4eTR6ez21Az63A3ywA320Az29A0jAA0W+A78DR8EDRrkDwwO6A7wDuAN+f8QDScUDgAGqA4EBqwPCA4IBMzQ1gwGEAYUBhgGHAYgBiQGKATM0iwHGA4wBxwONAcgDRckDScoDywN2jgEzNI8BzAOQAc0DkQHOA5IBzwNJyQPRA9ADkwGUAT0+lQEzNDXSA5YBlwGYAZkBmgGbATM0nAGdAUeeATM0NZ8BRaABR6EBogEzNKMBpAGlAaYBMzSnAagBpQGpATM0qgGrAUesATM0rQGuAUmvAbABjQGxATM0NbIBswG0AbUBtgG3AbgBuQG6AbsBvAG9Ab4BMzS/AeIDfuEDSeMDPsABPcEBwgE9PsMBxAGTAZQBxQHGAUjHAcgBwAHJAT3KAcsBzAEzNM0BzgHPAXRJc0jQAdEB0gHTAdQBR9UB1gHXAT7YAdkB2gE92wHcAdwB0QHSAd0B3gFH3wHWAeABPtgB2QHaAT3hAeIBNOMB5APkAeUD5QHnA+YB6APcAecB6AHpAeoBPesB7AHtAe4B7wE08AHpA+QB6gPxAfIB8wE09AH1AfYB9wH4AfkB+gE0+wH8Af0B/gH/AYACPYECggKDAoQChQL6ATT7AYYChwKIAokCigI9iwKCAowCjQKOAvoBNPsBjwKQApECkgKTAj2UAoIClQKWApcC+gE0+wGPApACkQKSApMCPZgCggKVApYCmQL6ATT7AfwBmgL+AZsCgAI9nAKCAoMCnQKhAqICowKkAqUCpgKnAqgCqQI+qgJIc6sCSawCrQKuAq8CsAKxAqMCpAKyAqYCpwKzArQCPrUCrQK2AqICNLcCuAI+qgJIc6sCSbkCugK7Aj28Ar0CvgK/AsICM8MC3AHEAsUCxgLHAsgCyQLKAssCzALNAs4CzwLQAtEC0gLTAtQC1QLWAtcC2AI02QKXAdoC2wLcAt0C7gLvAjTwAvgDRfEC7wI08gL6A0adCd4CMzTfAuACReECR+ICMzTjAuQCR+UCMzTmAucCzwHoAjM0qgHpAuoC6wLsAv4C/wKAA4EDggODA4QDhQP+CIIDhgPcAYIDiQOKA4ADiwOCA4wDjQOOA4ID3AGzA9QD0wPVA4oFjAWLBY0FrwPXA9gD2QPaA9wD1gPPBP0E3QOABd4DggXfA4gE+wPFBNMEoQS2BLcEzQTPBNAE0QT2BPcE+QT6BPsE/ATPBP8EgQWBBYMFhAX5BPoE+wT8BM8EzwSGBf8EiAWBBYkFgQWKBYwFiwWNBaUFpwWmBagFpQWnBaYFqAXzBLMF8gT1BPIE9QS6BcYFxwXIBcoFywXMBc0FzgXQBdEFxgXSBdMF1AXVBcwF1gXTBdcF2AX0BdMJowT+B4EIxQjICMwIzwjSCNUI1wjZCNsI3QjfCOEI4wjlCPcH+QeACI4IjwiQCJEIkgiTCIoIlAiVCJYI6weaCJsIngihCKIIzwSlCKcItQi2CLkIugi7CL0IwAi3CLgI6gbkBrwIvgjBCNwBggOCA4IIgwiECIUIhgiHCIgIiQiKCIsIjAiNCIIDlwiXCJgIogSiBJkIogSCA6gIqgiYCM8EzwSsCK4IggOvCLEImAjPBM8EswiuCIIDggPcAYIDjQaOBpAG3AGCA5EGkgaUBoIDlQaaBqMGpgapBqkGrAavBrQGtwa6BoIDwAbDBsgGygbMBswGzgbQBtQG1gbYBoID2wbeBuUG5gbnBugG7QbuBoID7wbxBvYG9wb4BvkG+wb8BtwBggOAB4EHggeDB4UHhweKB8MIygjQCN4I4gjWCNoI3AGCA4AHmAeZB5oHnAeeB6EHxgjNCNMI4AjkCNgI3AjnCOYIrgfnCOYIsgeCA7cHtwe4B7gHuAe5B88Euge6B4IDtwe3B7gHuAe4B7kHzwS6B7oHggO7B7sHuAe4B7gHvAfPBLoHugeCA7sHuwe4B7gHuAe8B88Euge6B4IDvQfDB4IDzAfQB4ID2AfcB4ID3QfhB4ID5AflB/kEggPkB+gH+QTcAfwImwncAYIDnAmfCfUIoAmCA6EJ3AGCA6MEowSiCYIDogmCA6QJtwm0CacJggO2CbMJqAmCA7UJsAmqCYIDrAnRCQqD2g+NChYAEPYFELkFEI8DQZCkA0HUBxEAABoLtjoBAn8QLRAuEC8QMBAxQdQlQewlQYwmQQBBgBpBAUGDGkEAQYMaQQBBughBhRpBAhAAQdQlQQFBnCZBgBpBA0EEEAFB1CVBxghBAkGgJkGoJkEFQQYQAkHUJUHVCEECQawmQagmQQdBCBACQcQmQdwmQYAnQQBBgBpBCUGDGkEAQYMaQQBB5ghBhRpBChAAQcQmQQFBkCdBgBpBC0EMEAFBxCZB8whBBEGgJ0GwGkENQQ4QAkEIEIAJIgBCDzcDAEEIEIAJIgFCEDcDAEHEJkH5CEHk9gFBwBpBESAAQeT2AUGYGkESIAEQA0EIEIAJIgBCEzcDAEEIEIAJIgFCFDcDAEHEJkGECUHk9gFBwBpBESAAQeT2AUGYGkESIAEQA0EIEIAJIgBCFTcDAEEIEIAJIgFCFjcDAEHEJkGNCUHk9gFBwBpBESAAQeT2AUGYGkESIAEQA0G8J0HQJ0HsJ0EAQYAaQRdBgxpBAEGDGkEAQZgJQYUaQRgQAEG8J0EBQfwnQYAaQRlBGhABQQgQgAkiAEIbNwMAQbwnQaAJQQNBgChBjChBHCAAQQAQBEEIEIAJIgBCHTcDAEG8J0GpCUEDQYAoQYwoQRwgAEEAEARBCBCACSIAQh43AwBBvCdBsQlBA0GAKEGMKEEcIABBABAEQQgQgAkiAEIfNwMAQbwnQbEJQQVBoChBtChBICAAQQAQBEEIEIAJIgBCITcDAEG8J0G4CUEDQYAoQYwoQRwgAEEAEARBCBCACSIAQiI3AwBBvCdBvAlBA0GAKEGMKEEcIABBABAEQQgQgAkiAEIjNwMAQbwnQcUJQQNBgChBjChBHCAAQQAQBEEIEIAJIgBCJDcDAEG8J0HMCUEEQcAoQdAoQSUgAEEAEARBCBCACSIAQiY3AwBBvCdB0glBA0GAKEGMKEEcIABBABAEQQgQgAkiAEInNwMAQbwnQdoJQQJB2ChB4ChBKCAAQQAQBEEIEIAJIgBCKTcDAEG8J0HgCUEDQYAoQYwoQRwgAEEAEARBCBCACSIAQio3AwBBvCdB6AlBA0GAKEGMKEEcIABBABAEQQgQgAkiAEIrNwMAQbwnQfEJQQNBgChBjChBHCAAQQAQBEEIEIAJIgBCLDcDAEG8J0H2CUEDQeQoQZgdQS0gAEEAEARBgClBmClBvClBAEGAGkEuQYMaQQBBgxpBAEGBCkGFGkEvEABBgClBAUHMKUGAGkEwQTEQAUEIEIAJIgBCMjcDAEGAKUGOCkEEQdApQeApQTMgAEEAEARBCBCACSIAQjQ3AwBBgClBkwpBBEHwKUGwHUE1IABBABAEQQgQgAkiAEI2NwMAQQgQgAkiAUI3NwMAQYApQZsKQaD3AUHgKEE4IABBoPcBQZgdQTkgARADQQgQgAkiAEI6NwMAQQgQgAkiAUI7NwMAQYApQaUKQeT2AUHAGkE8IABB5PYBQZgaQT0gARADQZAqQawqQdAqQQBBgBpBPkGDGkEAQYMaQQBBrgpBhRpBPxAAQZAqQQFB4CpBgBpBwABBwQAQAUEIEIAJIgBCwgA3AwBBkCpBvApBBUHwKkGEK0HDACAAQQAQBEEIEIAJIgBCxAA3AwBBkCpBvApBBkGQK0GoK0HFACAAQQAQBEHAK0HYK0H4K0EAQYAaQcYAQYMaQQBBgxpBAEG/CkGFGkHHABAAQcArQQFBiCxBgBpByABByQAQAUEIEIAJIgBCygA3AwBBwCtBygpBBUGQLEG0KEHLACAAQQAQBEEIEIAJIgBCzAA3AwBBwCtB0ApBBUGQLEG0KEHLACAAQQAQBEEIEIAJIgBCzQA3AwBBwCtB1gpBBUGQLEG0KEHLACAAQQAQBEEIEIAJIgBCzgA3AwBBwCtB3wpBBEGwLEHQKEHPACAAQQAQBEEIEIAJIgBC0AA3AwBBwCtB5gpBBEGwLEHQKEHPACAAQQAQBEEIEIAJIgBC0QA3AwBBCBCACSIBQtIANwMAQcArQe0KQaD3AUHgKEHTACAAQaD3AUGYHUHUACABEANBCBCACSIAQtUANwMAQQgQgAkiAULWADcDAEHAK0H0CkGg9wFB4ChB0wAgAEGg9wFBmB1B1AAgARADQcwsQeAsQfwsQQBBgBpB1wBBgxpBAEGDGkEAQf4KQYUaQdgAEABBzCxBAUGMLUGAGkHZAEHaABABQQgQgAkiAELbADcDAEHMLEGGC0EFQZAtQaQtQdwAIABBABAEQQgQgAkiAELdADcDAEHMLEGNC0EGQbAtQcgtQd4AIABBABAEQQgQgAkiAELfADcDAEHMLEGSC0EHQdAtQewtQeAAIABBABAEQYAuQZQuQbAuQQBBgBpB4QBBgxpBAEGDGkEAQZwLQYUaQeIAEABBgC5BAUHALkGAGkHjAEHkABABQQgQgAkiAELlADcDAEGALkGlC0EDQcQuQYwoQeYAIABBABAEQQgQgAkiAELnADcDAEGALkGqC0EFQdAuQeQuQegAIABBABAEQQgQgAkiAELpADcDAEGALkGyC0EDQewuQZgdQeoAIABBABAEQQgQgAkiAELrADcDAEGALkHAC0ECQfguQcAaQewAIABBABAEQYwvQaAvQcAvQQBBgBpB7QBBgxpBAEGDGkEAQc8LQYUaQe4AEABBjC9B2QtBBEHQL0HgHUHvAEHwABACQYwvQdkLQQRB4C9B8C9B8QBB8gAQAkGIMEGkMEHIMEEAQYAaQfMAQYMaQQBBgxpBAEHfC0GFGkH0ABAAQYgwQQFB2DBBgBpB9QBB9gAQAUEIEIAJIgBC9wA3AwBBiDBB6gtBBEHgMEHwMEH4ACAAQQAQBEEIEIAJIgBC+QA3AwBBiDBB7wtBA0H4MEGYHUH6ACAAQQAQBEEIEIAJIgBC+wA3AwBBiDBB+QtBAkGEMUHgKEH8ACAAQQAQBEEIEIAJIgBC/QA3AwBBCBCACSIBQv4ANwMAQYgwQf8LQaD3AUHgKEH/ACAAQaD3AUGYHUGAASABEANBCBCACSIAQoEBNwMAQQgQgAkiAUKCATcDAEGIMEGFDEGg9wFB4ChB/wAgAEGg9wFBmB1BgAEgARADQQgQgAkiAEL7ADcDAEEIEIAJIgFCgwE3AwBBiDBBlQxBoPcBQeAoQf8AIABBoPcBQZgdQYABIAEQA0GcMUG0MUHUMUEAQYAaQYQBQYMaQQBBgxpBAEGZDEGFGkGFARAAQZwxQQFB5DFBgBpBhgFBhwEQAUEIEIAJIgBCiAE3AwBBnDFBpAxBAkHoMUHAGkGJASAAQQAQBEEIEIAJIgBCigE3AwBBnDFBrgxBA0HwMUGYGkGLASAAQQAQBEEIEIAJIgBCjAE3AwBBnDFBrgxBBEGAMkGwGkGNASAAQQAQBEEIEIAJIgBCjgE3AwBBnDFBuAxBBEGQMkGQG0GPASAAQQAQBEEIEIAJIgBCkAE3AwBBnDFBzQxBAkGgMkHAGkGRASAAQQAQBEEIEIAJIgBCkgE3AwBBnDFB1QxBAkGoMkHgKEGTASAAQQAQBEEIEIAJIgBClAE3AwBBnDFB1QxBA0GwMkGMKEGVASAAQQAQBEEIEIAJIgBClgE3AwBBnDFB3gxBA0GwMkGMKEGVASAAQQAQBEEIEIAJIgBClwE3AwBBnDFB3gxBBEHAMkHQKEGYASAAQQAQBEEIEIAJIgBCmQE3AwBBnDFB3gxBBUHQMkG0KEGaASAAQQAQBEEIEIAJIgBCmwE3AwBBnDFBpQtBAkGoMkHgKEGTASAAQQAQBEEIEIAJIgBCnAE3AwBBnDFBpQtBA0GwMkGMKEGVASAAQQAQBEEIEIAJIgBCnQE3AwBBnDFBpQtBBUHQMkG0KEGaASAAQQAQBEEIEIAJIgBCngE3AwBBnDFB5wxBBUHQMkG0KEGaASAAQQAQBEEIEIAJIgBCnwE3AwBBnDFBkwpBAkHkMkGoJkGgASAAQQAQBEEIEIAJIgBCoQE3AwBBnDFB7QxBAkHkMkGoJkGgASAAQQAQBEEIEIAJIgBCogE3AwBBnDFB8wxBA0HsMkGYHUGjASAAQQAQBEEIEIAJIgBCpAE3AwBBnDFB/QxBBkGAM0GYM0GlASAAQQAQBEEIEIAJIgBCpgE3AwBBnDFBhg1BBEGgM0GQG0GnASAAQQAQBEEIEIAJIgBCqAE3AwBBnDFBiw1BAkGgMkHAGkGRASAAQQAQBEEIEIAJIgBCqQE3AwBBnDFBkA1BBEHAMkHQKEGYASAAQQAQBEHENEHYNEH0NEEAQYAaQaoBQYMaQQBBgxpBAEGfDUGFGkGrARAAQcQ0QQFBhDVBgBpBrAFBrQEQAUEEEIAJIgBBrgE2AgBBxDRBpw1BBkGQNUGoNUGvASAAQQAQBEEEEIAJIgBBsAE2AgBBxDRBrg1BBkGQNUGoNUGvASAAQQAQBEEEEIAJIgBBsQE2AgBBxDRBtQ1BBkGQNUGoNUGvASAAQQAQBEEEEIAJIgBBsgE2AgBBxDRBvA1BBEHgL0HwL0GzASAAQQAQBEHENEGnDUEGQZA1Qag1QbQBQa4BEAJBxDRBrg1BBkGQNUGoNUG0AUGwARACQcQ0QbUNQQZBkDVBqDVBtAFBsQEQAkHENEG8DUEEQeAvQfAvQfEAQbIBEAJBvDVB0DVB7DVBAEGAGkG1AUGDGkEAQYMaQQBBwg1BhRpBtgEQAEG8NUEBQfw1QYAaQbcBQbgBEAFBCBCACSIAQrkBNwMAQbw1QcoNQQdBgDZBnDZBugEgAEEAEARBCBCACSIAQrsBNwMAQbw1Qc8NQQdBsDZBzDZBvAEgAEEAEARBCBCACSIAQr0BNwMAQbw1QdoNQQNB2DZBjChBvgEgAEEAEARBCBCACSIAQr8BNwMAQbw1QeMNQQNB5DZBmB1BwAEgAEEAEARBCBCACSIAQsEBNwMAQbw1Qe0NQQNB5DZBmB1BwAEgAEEAEARBCBCACSIAQsIBNwMAQbw1QfgNQQNB5DZBmB1BwAEgAEEAEARBCBCACSIAQsMBNwMAQbw1QYUOQQNB5DZBmB1BwAEgAEEAEARB/DZBkDdBrDdBAEGAGkHEAUGDGkEAQYMaQQBBjg5BhRpBxQEQAEH8NkEBQbw3QYAaQcYBQccBEAFBCBCACSIAQsgBNwMAQfw2QZYOQQdBwDdB3DdByQEgAEEAEARBCBCACSIAQsoBNwMAQfw2QZkOQQlB8DdBlDhBywEgAEEAEARBCBCACSIAQswBNwMAQfw2QZkOQQRBoDhBsDhBzQEgAEEAEARBCBCACSIAQs4BNwMAQfw2QeMNQQNBuDhBmB1BzwEgAEEAEARBCBCACSIAQtABNwMAQfw2Qe0NQQNBuDhBmB1BzwEgAEEAEARBCBCACSIAQtEBNwMAQfw2QZ4OQQNBuDhBmB1BzwEgAEEAEARBCBCACSIAQtIBNwMAQfw2QacOQQNBuDhBmB1BzwEgAEEAEARBCBCACSIAQtMBNwMAQQgQgAkiAULUATcDAEH8NkGTCkHk9gFBwBpB1QEgAEHk9gFBmBpB1gEgARADQdA4QeQ4QYA5QQBBgBpB1wFBgxpBAEGDGkEAQbIOQYUaQdgBEABB0DhBAUGQOUGAGkHZAUHaARABQQQQgAkiAEHbATYCAEHQOEG6DkECQZQ5QeAoQdwBIABBABAEQdA4QboOQQJBlDlB4ChB3QFB2wEQAkEEEIAJIgBB3gE2AgBB0DhBvw5BAkGcOUGkOUHfASAAQQAQBEHQOEG/DkECQZw5QaQ5QeABQd4BEAJBvDlB3DlBhDpBAEGAGkHhAUGDGkEAQYMaQQBByQ5BhRpB4gEQAEG8OUEBQZQ6QYAaQeMBQeQBEAFBCBCACSIAQuUBNwMAQbw5QdsOQQRBoDpB0ChB5gEgAEEAEARBxDpB4DpBhDtBAEGAGkHnAUGDGkEAQYMaQQBB3w5BhRpB6AEQAEHEOkEBQZQ7QYAaQekBQeoBEAFBCBCACSIAQusBNwMAQcQ6Qe4OQQNBmDtBjChB7AEgAEEAEARBCBCACSIAQu0BNwMAQcQ6QfcOQQRBsDtB0ChB7gEgAEEAEARBCBCACSIAQu8BNwMAQcQ6QYAPQQRBsDtB0ChB7gEgAEEAEARB0DtB6DtBiDxBAEGAGkHwAUGDGkEAQYMaQQBBjQ9BhRpB8QEQAEHQO0EBQZg8QYAaQfIBQfMBEAFBCBCACSIAQvQBNwMAQdA7QZkPQQdBoDxBvDxB9QEgAEEAEARB1DxB7DxBjD1BAEGAGkH2AUGDGkEAQYMaQQBBoA9BhRpB9wEQAEHUPEEBQZw9QYAaQfgBQfkBEAFBCBCACSIAQvoBNwMAQdQ8QasPQQdBoD1BvDxB+wEgAEEAEARBzD1B6D1BjD5BAEGAGkH8AUGDGkEAQYMaQQBBsg9BhRpB/QEQAEHMPUEBQZw+QYAaQf4BQf8BEAFBCBCACSIAQoACNwMAQcw9QaULQQRBoD5B0ChBgQIgAEEAEARBvD5B0D5B7D5BAEGAGkGCAkGDGkEAQYMaQQBBwA9BhRpBgwIQAEG8PkEBQfw+QYAaQYQCQYUCEAFBCBCACSIAQoYCNwMAQbw+QcgPQQNBgD9BmB1BhwIgAEEAEARBCBCACSIAQogCNwMAQbw+QdIPQQNBgD9BmB1BhwIgAEEAEARBCBCACSIAQokCNwMAQbw+QaULQQdBkD9BzDZBigIgAEEAEARBuD9BzD9B6D9BAEGAGkGLAkGDGkEAQYMaQQBB3w9BhRpBjAIQAEG4P0EBQfg/QYAaQY0CQY4CEAFBuD9B6A9BA0H8P0GIwABBjwJBkAIQAkG4P0HsD0EDQfw/QYjAAEGPAkGRAhACQbg/QfAPQQNB/D9BiMAAQY8CQZICEAJBuD9B9A9BA0H8P0GIwABBjwJBkwIQAkG4P0H4D0EDQfw/QYjAAEGPAkGUAhACQbg/QfsPQQNB/D9BiMAAQY8CQZUCEAJBuD9B/g9BA0H8P0GIwABBjwJBlgIQAkG4P0GCEEEDQfw/QYjAAEGPAkGXAhACQbg/QYYQQQNB/D9BiMAAQY8CQZgCEAJBuD9BihBBAkGcOUGkOUHgAUGZAhACQbg/QY4QQQNB/D9BiMAAQY8CQZoCEAJBmMAAQazAAEHMwABBAEGAGkGbAkGDGkEAQYMaQQBBkhBBhRpBnAIQAEGYwABBAUHcwABBgBpBnQJBngIQAUEIEIAJIgBCnwI3AwBBmMAAQZwQQQJB4MAAQagmQaACIABBABAEQQgQgAkiAEKhAjcDAEGYwABBoxBBA0HowABBmB1BogIgAEEAEARBCBCACSIAQqMCNwMAQZjAAEGsEEEDQfTAAEGYGkGkAiAAQQAQBEEIEIAJIgBCpQI3AwBBmMAAQbwQQQJBgMEAQcAaQaYCIABBABAEQQgQgAkiAEKnAjcDAEEIEIAJIgFCqAI3AwBBmMAAQcMQQeT2AUHAGkGpAiAAQeT2AUGYGkGqAiABEANBCBCACSIAQqsCNwMAQQgQgAkiAUKsAjcDAEGYwABBwxBB5PYBQcAaQakCIABB5PYBQZgaQaoCIAEQA0EIEIAJIgBCrQI3AwBBCBCACSIBQq4CNwMAQZjAAEHQEEHk9gFBwBpBqQIgAEHk9gFBmBpBqgIgARADQQgQgAkiAEKvAjcDAEEIEIAJIgFCsAI3AwBBmMAAQdkQQaD3AUHgKEGxAiAAQeT2AUGYGkGqAiABEANBCBCACSIAQrICNwMAQQgQgAkiAUKzAjcDAEGYwABB3RBBoPcBQeAoQbECIABB5PYBQZgaQaoCIAEQA0EIEIAJIgBCtAI3AwBBCBCACSIBQrUCNwMAQZjAAEHhEEGc9gFBwBpBtgIgAEHk9gFBmBpBqgIgARADQQgQgAkiAEK3AjcDAEEIEIAJIgFCuAI3AwBBmMAAQeYQQeT2AUHAGkGpAiAAQeT2AUGYGkGqAiABEANBpMEAQcjBAEH0wQBBAEGAGkG5AkGDGkEAQYMaQQBB7BBBhRpBugIQAEGkwQBBAUGEwgBBgBpBuwJBvAIQAUEIEIAJIgBCvQI3AwBBpMEAQaULQQVBkMIAQaTCAEG+AiAAQQAQBEEIEIAJIgBCvwI3AwBBpMEAQYMRQQNBrMIAQZgdQcACIABBABAEQQgQgAkiAELBAjcDAEGkwQBBjBFBAkG4wgBB4ChBwgIgAEEAEARB3MIAQYTDAEG0wwBBAEGAGkHDAkGDGkEAQYMaQQBBlRFBhRpBxAIQAEHcwgBBAkHEwwBBwBpBxQJBxgIQAUEIEIAJIgBCxwI3AwBB3MIAQaULQQRB0MMAQdAoQcgCIABBABAEQQgQgAkiAELJAjcDAEHcwgBBgxFBBEHgwwBB8MMAQcoCIABBABAEQQgQgAkiAELLAjcDAEHcwgBBrxFBA0H4wwBBmBpBzAIgAEEAEARBCBCACSIAQs0CNwMAQdzCAEGMEUEDQYTEAEGQxABBzgIgAEEAEARBCBCACSIAQs8CNwMAQdzCAEG5EUECQZjEAEHAGkHQAiAAQQAQBEHAxABB7MQAQZzFAEHcwgBBgBpB0QJBgBpB0gJBgBpB0wJBvhFBhRpB1AIQAEHAxABBAkGsxQBBwBpB1QJB1gIQAUEIEIAJIgBC1wI3AwBBwMQAQaULQQRBwMUAQdAoQdgCIABBABAEQQgQgAkiAELZAjcDAEHAxABBgxFBBEHQxQBB8MMAQdoCIABBABAEQQgQgAkiAELbAjcDAEHAxABBrxFBA0HgxQBBmBpB3AIgAEEAEARBCBCACSIAQt0CNwMAQcDEAEGMEUEDQezFAEGQxABB3gIgAEEAEARBCBCACSIAQt8CNwMAQcDEAEG5EUECQfjFAEHAGkHgAiAAQQAQBEGMxgBBoMYAQbzGAEEAQYAaQeECQYMaQQBBgxpBAEHaEUGFGkHiAhAAQYzGAEEBQczGAEGAGkHjAkHkAhABQQgQgAkiAELlAjcDAEGMxgBB8whBBUHQxgBB5MYAQeYCIABBABAEQQgQgAkiAELnAjcDAEGMxgBB4hFBBEHwxgBBnMcAQegCIABBABAEQQgQgAkiAELpAjcDAEGMxgBB6hFBAkGkxwBBrMcAQeoCIABBABAEQQgQgAkiAELrAjcDAEGMxgBB+xFBAkGkxwBBrMcAQeoCIABBABAEQQgQgAkiAELsAjcDAEGMxgBBjBJBAkGwxwBBwBpB7QIgAEEAEARBCBCACSIAQu4CNwMAQYzGAEGaEkECQbDHAEHAGkHtAiAAQQAQBEEIEIAJIgBC7wI3AwBBjMYAQaoSQQJBsMcAQcAaQe0CIABBABAEQQgQgAkiAELwAjcDAEGMxgBBtBJBAkG4xwBBwBpB8QIgAEEAEARBCBCACSIAQvICNwMAQYzGAEG/EkECQbjHAEHAGkHxAiAAQQAQBEEIEIAJIgBC8wI3AwBBjMYAQcoSQQJBuMcAQcAaQfECIABBABAEQQgQgAkiAEL0AjcDAEGMxgBB1RJBAkG4xwBBwBpB8QIgAEEAEARBlMcAQeMSQQRBABAFQZTHAEHwEkEBEAZBlMcAQYYTQQAQBkHMxwBB4McAQfzHAEEAQYAaQfUCQYMaQQBBgxpBAEGaE0GFGkH2AhAAQczHAEEBQYzIAEGAGkH3AkH4AhABQQgQgAkiAEL5AjcDAEHMxwBB8whBBUGQyABB5MYAQfoCIABBABAEQQgQgAkiAEL7AjcDAEHMxwBB4hFBBUGwyABB5MgAQfwCIABBABAEQdzIAEGjE0EEQQAQBUHcyABBsRNBABAGQdzIAEG6E0EBEAZBhMkAQaTJAEHMyQBBAEGAGkH9AkGDGkEAQYMaQQBBwhNBhRpB/gIQAEGEyQBBAUHcyQBBgBpB/wJBgAMQAUEIEIAJIgBCgQM3AwBBhMkAQfMIQQdB4MkAQfzJAEGCAyAAQQAQBEEIEIAJIgBCgwM3AwBBhMkAQcsTQQNBiMoAQewaQYQDIABBABAEC/EBAQF/QfgYQbgZQfAZQQBBgBpBhQNBgxpBAEGDGkEAQYAIQYUaQYYDEABB+BhBAUGIGkGAGkGHA0GIAxABQQgQgAkiAEKJAzcDAEH4GEHIF0EDQYwaQZgaQYoDIABBABAEQQgQgAkiAEKLAzcDAEH4GEHSF0EEQaAaQbAaQYwDIABBABAEQQgQgAkiAEKNAzcDAEH4GEG5EUECQbgaQcAaQY4DIABBABAEQQQQgAkiAEGPAzYCAEH4GEHZF0EDQcQaQewaQZADIABBABAEQQQQgAkiAEGRAzYCAEH4GEHdF0EEQYAbQZAbQZIDIABBABAEC/EBAQF/QYAcQcAcQfgcQQBBgBpBkwNBgxpBAEGDGkEAQYoIQYUaQZQDEABBgBxBAUGIHUGAGkGVA0GWAxABQQgQgAkiAEKXAzcDAEGAHEHIF0EDQYwdQZgdQZgDIABBABAEQQgQgAkiAEKZAzcDAEGAHEHSF0EEQaAdQbAdQZoDIABBABAEQQgQgAkiAEKbAzcDAEGAHEG5EUECQbgdQcAaQZwDIABBABAEQQQQgAkiAEGdAzYCAEGAHEHZF0EDQcAdQewaQZ4DIABBABAEQQQQgAkiAEGfAzYCAEGAHEHdF0EEQdAdQeAdQaADIABBABAEC/EBAQF/QdAeQZAfQcgfQQBBgBpBoQNBgxpBAEGDGkEAQZcIQYUaQaIDEABB0B5BAUHYH0GAGkGjA0GkAxABQQgQgAkiAEKlAzcDAEHQHkHIF0EDQdwfQZgaQaYDIABBABAEQQgQgAkiAEKnAzcDAEHQHkHSF0EEQfAfQbAaQagDIABBABAEQQgQgAkiAEKpAzcDAEHQHkG5EUECQYAgQcAaQaoDIABBABAEQQQQgAkiAEGrAzYCAEHQHkHZF0EDQYggQewaQawDIABBABAEQQQQgAkiAEGtAzYCAEHQHkHdF0EEQaAgQZAbQa4DIABBABAEC/EBAQF/QZghQdghQZAiQQBBgBpBrwNBgxpBAEGDGkEAQaIIQYUaQbADEABBmCFBAUGgIkGAGkGxA0GyAxABQQgQgAkiAEKzAzcDAEGYIUHIF0EDQaQiQZgaQbQDIABBABAEQQgQgAkiAEK1AzcDAEGYIUHSF0EEQbAiQbAaQbYDIABBABAEQQgQgAkiAEK3AzcDAEGYIUG5EUECQcAiQcAaQbgDIABBABAEQQQQgAkiAEG5AzYCAEGYIUHZF0EDQcgiQewaQboDIABBABAEQQQQgAkiAEG7AzYCAEGYIUHdF0EEQeAiQZAbQbwDIABBABAEC/EBAQF/QdgjQZgkQdAkQQBBgBpBvQNBgxpBAEGDGkEAQa4IQYUaQb4DEABB2CNBAUHgJEGAGkG/A0HAAxABQQgQgAkiAELBAzcDAEHYI0HIF0EDQeQkQfAkQcIDIABBABAEQQgQgAkiAELDAzcDAEHYI0HSF0EEQYAlQZAlQcQDIABBABAEQQgQgAkiAELFAzcDAEHYI0G5EUECQZglQcAaQcYDIABBABAEQQQQgAkiAEHHAzYCAEHYI0HZF0EDQaAlQewaQcgDIABBABAEQQQQgAkiAEHJAzYCAEHYI0HdF0EEQbAlQcAlQcoDIABBABAECwUAQdQlCwwAIAAEQCAAENMJCwsHACAAEQwACwcAQQEQgAkLCQAgASAAEQEACwwAIAAgACgCADYCBAsFAEHEJgsNACABIAIgAyAAEQUACx0AQbiGAiABNgIAQbSGAiAANgIAQbyGAiACNgIACwkAQbSGAigCAAsLAEG0hgIgATYCAAs1AQF/IAEgACgCBCICQQF1aiEBIAAoAgAhACABIAJBAXEEfyABKAIAIABqKAIABSAACxEAAAs3AQF/IAEgACgCBCIDQQF1aiEBIAAoAgAhACABIAIgA0EBcQR/IAEoAgAgAGooAgAFIAALEQIACwkAQbiGAigCAAsLAEG4hgIgATYCAAsJAEG8hgIoAgALCwBBvIYCIAE2AgALBQBBvCcLEgEBf0EwEIAJIgBCADcDCCAACzcBAX8gASAAKAIEIgNBAXVqIQEgACgCACEAIAEgAiADQQFxBH8gASgCACAAaigCAAUgAAsREQALOwEBfyABIAAoAgQiBUEBdWohASAAKAIAIQAgASACIAMgBCAFQQFxBH8gASgCACAAaigCAAUgAAsRFQALOQEBfyABIAAoAgQiBEEBdWohASAAKAIAIQAgASACIAMgBEEBcQR/IAEoAgAgAGooAgAFIAALERIACzUBAX8gASAAKAIEIgJBAXVqIQEgACgCACEAIAEgAkEBcQR/IAEoAgAgAGooAgAFIAALERAACzcBAX8gASAAKAIEIgNBAXVqIQEgACgCACEAIAEgAiADQQFxBH8gASgCACAAaigCAAUgAAsRDwALBQBBgCkLPAEBf0E4EIAJIgBCADcDACAAQgA3AzAgAEIANwMoIABCADcDICAAQgA3AxggAEIANwMQIABCADcDCCAACzkBAX8gASAAKAIEIgRBAXVqIQEgACgCACEAIAEgAiADIARBAXEEfyABKAIAIABqKAIABSAACxEeAAs5AQF/IAEgACgCBCIEQQF1aiEBIAAoAgAhACABIAIgAyAEQQFxBH8gASgCACAAaigCAAUgAAsRGgALBwAgACsDMAsJACAAIAE5AzALBwAgACgCLAsJACAAIAE2AiwLBQBB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AX8gAARAIAAoAmwiAQRAIAAgATYCcCABENMJCyAALAALQX9MBEAgACgCABDTCQsgABDTCQsLiQEBAn9BiAEQgAkiAEIANwIAIABCADcDKCAAQQE7AWAgAEIANwNYIABCgICAgICAgPA/NwNQIABCgICAgICAgPA/NwNIIABBADYCCCAAQgA3AzBBtIYCKAIAIQEgAEEANgJ0IABBAToAgAEgAEKAgICAgICA+D83A3ggAEIANwJsIAAgATYCZCAACxAAIAAoAnAgACgCbGtBA3ULOQEBfyABIAAoAgQiBEEBdWohASAAKAIAIQAgASACIAMgBEEBcQR/IAEoAgAgAGooAgAFIAALEQUACzkBAX8gASAAKAIEIgRBAXVqIQEgACgCACEAIAEgAiADIARBAXEEfyABKAIAIABqKAIABSAACxEEAAs1AQF/IAEgACgCBCICQQF1aiEBIAAoAgAhACABIAJBAXEEfyABKAIAIABqKAIABSAACxEBAAsMACAAIAAoAmw2AnALPQEBfyABIAAoAgQiBkEBdWohASAAKAIAIQAgASACIAMgBCAFIAZBAXEEfyABKAIAIABqKAIABSAACxE9AAvlAQEEfyMAQRBrIgQkACABIAAoAgQiBkEBdWohByAAKAIAIQUgBkEBcQRAIAcoAgAgBWooAgAhBQsgAigCACEAIARBADYCCCAEQgA3AwAgAEFwSQRAAkACQCAAQQtPBEAgAEEQakFwcSIGEIAJIQEgBCAGQYCAgIB4cjYCCCAEIAE2AgAgBCAANgIEDAELIAQgADoACyAEIQEgAEUNAQsgASACQQRqIAAQ3gkaCyAAIAFqQQA6AAAgByAEIAMgBREEACEAIAQsAAtBf0wEQCAEKAIAENMJCyAEQRBqJAAgAA8LEIQJAAsFAEHENAsoACABIAIgACACIABjGyIAIAAgAWMbIAGhIAIgAaGjIAQgA6GiIAOgCxQAIAEgAiADIAQgBSAAKAIAESUACyoAIAQgA6MgASACIAAgAiAAYxsiACAAIAFjGyABoSACIAGhoxDvBCADogsuACABIAIgACACIABjGyIAIAAgAWMbIAGjEO0EIAIgAaMQ7QSjIAQgA6GiIAOgCx4AAkAgACACZA0AIAAiAiABY0EBcw0AIAEhAgsgAgsQACABIAIgAyAAKAIAETAACxEAIAEgAiAD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aiIGIApGDQEgAC0AGCEJDAAACwALIABBADoAGCAAKAIQIQMgACgCDCEAIAdBEGokACANIAMgAGtBA3W4owsZACAAKAIAIAJBBHRqIAE5AwAgAEEBOgAYC04BA38gASgCACICIAEoAgQiA0cEQCAAKAIAIQRBACEBA0AgBCABQQR0aiACKQMANwMAIAFBAWohASACQQhqIgIgA0cNAAsLIABBAToAGAsGAEGMxgALDwAgAARAIAAQ+gIQ0wkLC24BAX9BlAEQgAkiAEIANwJQIABCADcCACAAQgA3AnggAEIANwJwIABCADcCaCAAQgA3AmAgAEIANwJYIABCADcCCCAAQgA3AhAgAEIANwIYIABCADcCICAAQgA3AiggAEIANwIwIABBADYCOCAACzsBAX8gASAAKAIEIgVBAXVqIQEgACgCACEAIAEgAiADIAQgBUEBcQR/IAEoAgAgAGooAgAFIAALEQsACzkBAX8gASAAKAIEIgRBAXVqIQEgACgCACEAIAEgAiADIARBAXEEfyABKAIAIABqKAIABSAACxFIAAs1AQF/IAEgACgCBCICQQF1aiEBIAAoAgAhACABIAJBAXEEfyABKAIAIABqKAIABSAACxEpAAu8AQECfyABIAAoAgQiAkEBdWohASAAKAIAIQAgASACQQFxBH8gASgCACAAaigCAAUgAAsRAAAhAUEMEIAJIgBBADYCCCAAQgA3AgACQAJAIAEoAgQgASgCAGsiAkUNACACQQJ1IgNBgICAgARPDQEgACACEIAJIgI2AgAgACACNgIEIAAgAiADQQJ0ajYCCCABKAIEIAEoAgAiA2siAUEBSA0AIAAgAiADIAEQ3gkgAWo2AgQLIAAPCxCZCQALBwAgABDmAwsHACAAQQxqCwgAIAAoAowBCwcAIAAoAkQLCAAgACgCiAELCAAgACgChAELBgBBzMcAC1gBAX8gAARAIABBPGoQ7wMgACgCGCIBBEAgACABNgIcIAEQ0wkLIAAoAgwiAQRAIAAgATYCECABENMJCyAAKAIAIgEEQCAAIAE2AgQgARDTCQsgABDTCQsLWQEBf0H0ABCACSIAQgA3AkQgAEIANwIAIABCADcCbCAAQgA3AmQgAEIANwJcIABCADcCVCAAQgA3AkwgAEIANwIIIABCADcCECAAQgA3AhggAEEANgIgIAALOwEBfyABIAAoAgQiBUEBdWohASAAKAIAIQAgASACIAMgBCAFQQFxBH8gASgCACAAaigCAAUgAAsRSgALBgBBhMkAC1QBAX8gAARAAkAgACgCJCIBRQ0AIAEQ0wkgACgCACIBBEAgARDTCQsgACgCLCIBRQ0AIAEQ0wkLIAAoAjAiAQRAIAAgATYCNCABENMJCyAAENMJCwsoAQF/QcAAEIAJIgBCADcCLCAAQQA2AiQgAEEANgIAIABCADcCNCAAC6YDAgN/AnwjAEEQayIIJAAgACAFOQMYIAAgBDkDECAAIAM2AgggACACNgIEQbSGAigCACEGIAAgATYCKCAAIAY2AiAgAEEANgIkIAAgAkEDdCIGENIJNgIAIAhCADcDCAJAIAAoAjQgACgCMCIHa0EDdSICIANJBEAgAEEwaiADIAJrIAhBCGoQngIMAQsgAiADTQ0AIAAgByADQQN0ajYCNAsgACADIAZsENIJNgIsIAAgACgCILggARCfAgJAIAAoAgQiA0UNACAAKAIIIgZFDQBEGC1EVPshCUAgA7giBKMhBUQAAAAAAADwPyAEn6MhCUQAAAAAAAAAQCAEo58hBCAAKAIsIQdBACEBA0AgAUEBaiECQQAhAAJAIAEEQCAFIAK3oiEKA0AgByAAIAZsIAFqQQN0aiAEIAogALdEAAAAAAAA4D+gohDgBKI5AwAgAEEBaiIAIANHDQALDAELA0AgByAAIAZsQQN0aiAJIAUgALdEAAAAAAAA4D+gohDgBKI5AwAgAEEBaiIAIANHDQALCyACIgEgBkcNAAsLIAhBEGokAAs/AQF/IAEgACgCBCIHQQF1aiEBIAAoAgAhACABIAIgAyAEIAUgBiAHQQFxBH8gASgCACAAaigCAAUgAAsRMwAL1QECB38BfCAAIAEoAgAQ9QMgAEEwaiEEIAAoAggiAgRAQQAhASAAKAIwQQAgAkEDdBDfCSEDIAAoAgQiBQRAIAAoAgAhBiAAKAIsIQcDQCADIAFBA3RqIggrAwAhCUEAIQADQCAIIAcgACACbCABakEDdGorAwAgBiAAQQN0aisDAKIgCaAiCTkDACAAQQFqIgAgBUcNAAsgAUEBaiIBIAJHDQALCyACuCEJQQAhAANAIAMgAEEDdGoiASABKwMAIAmjOQMAIABBAWoiACACRw0ACwsgBAu+AQEBfyABIAAoAgQiA0EBdWohASAAKAIAIQAgASACIANBAXEEfyABKAIAIABqKAIABSAACxEDACEBQQwQgAkiAEEANgIIIABCADcCAAJAAkAgASgCBCABKAIAayICRQ0AIAJBA3UiA0GAgICAAk8NASAAIAIQgAkiAjYCACAAIAI2AgQgACACIANBA3RqNgIIIAEoAgQgASgCACIDayIBQQFIDQAgACACIAMgARDeCSABajYCBAsgAA8LEJkJAAsFAEH4GAskAQF/IAAEQCAAKAIAIgEEQCAAIAE2AgQgARDTCQsgABDTCQsLGQEBf0EMEIAJIgBBADYCCCAAQgA3AgAgAAswAQF/IAAoAgQiAiAAKAIIRwRAIAIgASgCADYCACAAIAJBBGo2AgQPCyAAIAEQ9AILUgECfyMAQRBrIgMkACABIAAoAgQiBEEBdWohASAAKAIAIQAgBEEBcQRAIAEoAgAgAGooAgAhAAsgAyACNgIMIAEgA0EMaiAAEQIAIANBEGokAAs+AQJ/IAAoAgQgACgCACIEa0ECdSIDIAFJBEAgACABIANrIAIQ9QIPCyADIAFLBEAgACAEIAFBAnRqNgIECwtUAQJ/IwBBEGsiBCQAIAEgACgCBCIFQQF1aiEBIAAoAgAhACAFQQFxBEAgASgCACAAaigCACEACyAEIAM2AgwgASACIARBDGogABEFACAEQRBqJAALEAAgACgCBCAAKAIAa0ECdQtRAQJ/IwBBEGsiAyQAQQEhBCAAIAEoAgQgASgCACIBa0ECdSACSwR/IAMgASACQQJ0aigCADYCCEHk9gEgA0EIahAKBUEBCzYCACADQRBqJAALNwEBfyMAQRBrIgMkACADQQhqIAEgAiAAKAIAEQUAIAMoAggQCyADKAIIIgAQDCADQRBqJAAgAAsXACAAKAIAIAFBAnRqIAIoAgA2AgBBAQs0AQF/IwBBEGsiBCQAIAAoAgAhACAEIAM2AgwgASACIARBDGogABEEACEAIARBEGokACAACwUAQYAcCzABAX8gACgCBCICIAAoAghHBEAgAiABKQMANwMAIAAgAkEIajYCBA8LIAAgARD2AgtSAQJ/IwBBEGsiAyQAIAEgACgCBCIEQQF1aiEBIAAoAgAhACAEQQFxBEAgASgCACAAaigCACEACyADIAI5AwggASADQQhqIAARAgAg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ygBqQgA3AwAgAUHYyABqQgA3AwAgAUHAyABqIgNCADcCACABQcjIAGpCADcCACABQdDIAGpBADYCACABQejIAGpCs+bMmbPmzPU/NwMAIAFB4MgAakKas+bMmbPm9D83AwAgA0GgxBUQgAkiAzYCACABQcTIAGogA0EAQaDEFRDfCUGgxBVqNgIAIAJBAWoiAkEgRw0ACyAAQZiSAWpCADcDACAAQZCSAWpCADcDACAAQYiSAWpCADcDACAAQYCSAWpCADcDACAAQfCTAWpCADcDACAAQfiTAWpCADcDACAAQYCUAWpCADcDACAAQYiUAWpCADcDACAAQeCVAWpCADcDACAAQeiVAWpCADcDACAAQfCVAWpCADcDACAAQfiVAWpCADcDACAAQdCXAWpCADcDACAAQdiXAWpCADcDACAAQeCXAWpCADcDACAAQeiXAWpCADcDACAAQdiZAWpCADcDACAAQdCZAWpCADcDACAAQciZAWpCADcDACAAQcCZAWpCADcDACAAQcibAWpCADcDACAAQcCbAWpCADcDACAAQbibAWpCADcDACAAQbCbAWpCADcDACAAQbidAWpCADcDACAAQbCdAWpCADcDACAAQaidAWpCADcDACAAQaCdAWpCADcDACAAQaifAWpCADcDACAAQaCfAWpCADcDACAAQZifAWpCADcDACAAQZCfAWpCADcDACAAQZihAWpCADcDACAAQZChAWpCADcDACAAQYihAWpCADcDACAAQYChAWpCADcDACAAQYijAWpCADcDACAAQYCjAWpCADcDACAAQfiiAWpCADcDACAAQfCiAWpCADcDACAAQfikAWpCADcDACAAQfCkAWpCADcDACAAQeikAWpCADcDACAAQeCkAWpCADcDACAAQeimAWpCADcDACAAQeCmAWpCADcDACAAQdimAWpCADcDACAAQdCmAWpCADcDACAAQdioAWpCADcDACAAQdCoAWpCADcDACAAQcioAWpCADcDACAAQcCoAWpCADcDACAAQciqAWpCADcDACAAQcCqAWpCADcDACAAQbiqAWpCADcDACAAQbCqAWpCADcDACAAQbisAWpCADcDACAAQbCsAWpCADcDACAAQaisAWpCADcDACAAQaCsAWpCADcDACAAQaiuAWpCADcDACAAQaCuAWpCADcDACAAQZiuAWpCADcDACAAQZCuAWpCADcDACAAQZiwAWpCADcDACAAQZCwAWpCADcDACAAQYiwAWpCADcDACAAQYCwAWpCADcDACAAQYiyAWpCADcDACAAQYCyAWpCADcDACAAQfixAWpCADcDACAAQfCxAWpCADcDACAAQfizAWpCADcDACAAQfCzAWpCADcDACAAQeizAWpCADcDACAAQeCzAWpCADcDACAAQei1AWpCADcDACAAQeC1AWpCADcDACAAQdi1AWpCADcDACAAQdC1AWpCADcDACAAQdi3AWpCADcDACAAQdC3AWpCADcDACAAQci3AWpCADcDACAAQcC3AWpCADcDACAAQci5AWpCADcDACAAQcC5AWpCADcDACAAQbi5AWpCADcDACAAQbC5AWpCADcDACAAQbi7AWpCADcDACAAQbC7AWpCADcDACAAQai7AWpCADcDACAAQaC7AWpCADcDACAAQai9AWpCADcDACAAQaC9AWpCADcDACAAQZi9AWpCADcDACAAQZC9AWpCADcDACAAQZi/AWpCADcDACAAQZC/AWpCADcDACAAQYi/AWpCADcDACAAQYC/AWpCADcDACAAQYjBAWpCADcDACAAQYDBAWpCADcDACAAQfjAAWpCADcDACAAQfDAAWpCADcDACAAQfjCAWpCADcDACAAQfDCAWpCADcDACAAQejCAWpCADcDACAAQeDCAWpCADcDACAAQejEAWpCADcDACAAQeDEAWpCADcDACAAQdjEAWpCADcDACAAQdDEAWpCADcDACAAQdjGAWpCADcDACAAQdDGAWpCADcDACAAQcjGAWpCADcDACAAQcDGAWpCADcDACAAQcjIAWpCADcDACAAQcDIAWpCADcDACAAQbjIAWpCADcDACAAQbDIAWpCADcDACAAQbjKAWpCADcDACAAQbDKAWpCADcDACAAQajKAWpCADcDACAAQaDKAWpCADcDACAAQajMAWpCADcDACAAQaDMAWpCADcDACAAQZjMAWpCADcDACAAQZDMAWpCADcDACAAQfDaAWpCADcDACAAQejaAWpCADcDACAAQeDaAWpCADcDACAAQdjaAWpCADcDACAAQYDZAWpCADcDAEEAIQIgAEH42AFqQQA2AgAgAEHw2AFqQgA3AgAgAEIANwLo2AEgAEGQ2QFqQrPmzJmz5sz1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+qi49T83AwAgAEHA0AFqQuH10fD6qLj1PzcDACAAQeDUAWogASkDIDcDACAAQejUAWogASkDKDcDACAAQcDUAWogASkDADcDACAAQcjUAWogASkDCDcDACAAQdjUAWogASkDGDcDACAAQfDUAWogASkDMDcDACAAQfjUAWogASkDODcDACAAQdDUAWogASkDEDcDACAAQdjSAWpCgICAgICAgPA/NwMAIABB0NIBakKAgICAgICA8D83AwAgAEHI0gFqQoCAgICAgIDwPzcDACAAQoCAgICAgIDwPzcDwNIBIABB2M4BakKAgICAgIDUusAANwMAIABB0M4BakKAgICAgIDkvcAANwMAIABByM4BakKAgICAgIDYwMAANwMAIABCgICAgICAiLbAADcDwM4BIAFBgAFqJAAgAAuYCgIGfwF8IABCADcD2NgBIABBuNYBaiADRAAAAAAAAPA/pEQAAAAAAAAAAKUiAzkDACAAQbDWAWogAzkDACAAQajWAWogAzkDACAAQaDWAWogAzkDACAAQZjWAWogAzkDACAAQZDWAWogAzkDACAAQYjWAWogAzkDACAAQYDWAWogAzkDACAAQfjVAWogAzkDACAAQfDVAWogAzkDACAAQejVAWogAzkDACAAQeDVAWogAzkDACAAQdjVAWogAzkDACAAQdDVAWogAzkDACAAQcjVAWogAzkDACAAQcDVAWogAzkDACAAQbjVAWogAzkDACAAQbDVAWogAzkDACAAQajVAWogAzkDACAAQaDVAWogAzkDACAAQZjVAWogAzkDACAAQZDVAWogAzkDACAAQYjVAWogAzkDACAAQYDVAWogAzkDACAAQfjUAWogAzkDACAAQfDUAWogAzkDACAAQejUAWogAzkDACAAQeDUAWogAzkDACAAQdjUAWogAzkDACAAQdDUAWogAzkDACAAQcjUAWogAzkDACAAIAM5A8DUASAAQbjSAWogAkSamZmZmZm5P6JE4XoUrkfh6j+gRAAAAAAAAPA/pEQAAAAAAAAAAKUiAjkDACAAQbDSAWogAjkDACAAQajSAWogAjkDACAAQaDSAWogAjkDACAAQZjSAWogAjkDACAAQZDSAWogAjkDACAAQYjSAWogAjkDACAAQYDSAWogAjkDACAAQfjRAWogAjkDACAAQfDRAWogAjkDACAA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DQAgAiADrSIEhiABQcAAIANrrYiEIQIgASAEhiEBCyAAIAE3AwAgACACNwMIC9kDAgJ/An4jAEEgayICJAACQCABQv///////////wCDIgVCgICAgICAwP9DfCAFQoCAgICAgMCAvH98VARAIAFCBIYgAEI8iIQhBCAAQv//////////D4MiAEKBgICAgICAgAhaBEAgBEKBgICAgICAgMAAfCEEDAILIARCgICAgICAgIBAfSEEIABCgICAgICAgIAIhUIAUg0BIARCAYMgBHwhBAwBCyAAUCAFQoCAgICAgMD//wBUIAVCgICAgICAwP//AFEbRQRAIAFCBIYgAEI8iIRC/////////wODQoCAgICAgID8/wCEIQQMAQtCgICAgICAgPj/ACEEIAVC////////v//DAFYNAEIAIQQgBUIwiKciA0GR9wBJDQAgAiAAIAFC////////P4NCgICAgICAwACEIgRBgfgAIANrENkEIAJBEGogACAEIANB/4h/ahDaBCACKQMIQgSGIAIpAwAiAEI8iIQhBCACKQMQIAIpAxiEQgBSrSAAQv//////////D4OEIgBCgYCAgICAgIAIWgRAIARCAXwhBAwBCyAAQoCAgICAgICACIVCAFINACAEQgGDIAR8IQQLIAJBIGokACAEIAFCgICAgICAgICAf4OEvwuSAQEDfEQAAAAAAADwPyAAIACiIgJEAAAAAAAA4D+iIgOhIgREAAAAAAAA8D8gBKEgA6EgAiACIAIgAkSQFcsZoAH6PqJEd1HBFmzBVr+gokRMVVVVVVWlP6CiIAIgAqIiAyADoiACIAJE1DiIvun6qL2iRMSxtL2e7iE+oKJErVKcgE9+kr6goqCiIAAgAaKhoKAL+xEDD38BfgN8IwBBsARrIgYkACACIAJBfWpBGG0iBUEAIAVBAEobIg5BaGxqIQwgBEECdEGg+ABqKAIAIgsgA0F/aiIIakEATgRAIAMgC2ohBSAOIAhrIQIDQCAGQcACaiAHQQN0aiACQQBIBHxEAAAAAAAAAAAFIAJBAnRBsPgAaigCALcLOQMAIAJBAWohAiAHQQFqIgcgBUcNAAsLIAxBaGohCUEAIQUgA0EBSCEHA0ACQCAHBEBEAAAAAAAAAAAhFQwBCyAFIAhqIQpBACECRAAAAAAAAAAAIRUDQCAAIAJBA3RqKwMAIAZBwAJqIAogAmtBA3RqKwMAoiAVoCEVIAJBAWoiAiADRw0ACwsgBiAFQQN0aiAVOQMAIAUgC0ghAiAFQQFqIQUgAg0AC0EXIAlrIRFBGCAJayEPIAshBQJAA0AgBiAFQQN0aisDACEVQQAhAiAFIQcgBUEBSCINRQRAA0AgBkHgA2ogAkECdGoCfwJ/IBVEAAAAAAAAcD6iIhaZRAAAAAAAAOBBYwRAIBaqDAELQYCAgIB4C7ciFkQAAAAAAABwwaIgFaAiFZlEAAAAAAAA4EFjBEAgFaoMAQtBgICAgHgLNgIAIAYgB0F/aiIIQQN0aisDACAWoCEVIAJBAWohAiAHQQFKIQogCCEHIAoNAAsLAn8gFSAJENwJIhUgFUQAAAAAAADAP6KcRAAAAAAAACDAoqAiFZlEAAAAAAAA4EFjBEAgFaoMAQtBgICAgHgLIQogFSAKt6EhFQJAAkACQAJ/IAlBAUgiEkUEQCAFQQJ0IAZqIgIgAigC3AMiAiACIA91IgIgD3RrIgc2AtwDIAIgCmohCiAHIBF1DAELIAkNASAFQQJ0IAZqKALcA0EXdQsiCEEBSA0CDAELQQIhCCAVRAAAAAAAAOA/ZkEBc0UNAEEAIQgMAQtBACECQQAhByANRQRAA0AgBkHgA2ogAkECdGoiEygCACENQf///wchEAJAAkAgB0UEQCANRQ0BQYCAgAghEEEBIQcLIBMgECANazYCAAwBC0EAIQcLIAJBAWoiAiAFRw0ACwsCQCASDQAgCUF/aiICQQFLDQAgAkEBawRAIAVBAnQgBmoiAiACKALcA0H///8DcTYC3AMMAQsgBUECdCAGaiICIAIoAtwDQf///wFxNgLcAwsgCkEBaiEKIAhBAkcNAEQAAAAAAADwPyAVoSEVQQIhCCAHRQ0AIBVEAAAAAAAA8D8gCRDcCaEhFQsgFUQAAAAAAAAAAGEEQEEAIQcCQCAFIgIgC0wNAANAIAZB4ANqIAJBf2oiAkECdGooAgAgB3IhByACIAtKDQALIAdFDQAgCSEMA0AgDEFoaiEMIAZB4ANqIAVBf2oiBUECdGooAgBFDQALDAMLQQEhAgNAIAIiB0EBaiECIAZB4ANqIAsgB2tBAnRqKAIARQ0ACyAFIAdqIQcDQCAGQcACaiADIAVqIghBA3RqIAVBAWoiBSAOakECdEGw+ABqKAIAtzkDAEEAIQJEAAAAAAAAAAAhFSADQQFOBEADQCAAIAJBA3RqKwMAIAZBwAJqIAggAmtBA3RqKwMAoiAVoCEVIAJBAWoiAiADRw0ACwsgBiAFQQN0aiAVOQMAIAUgB0gNAAsgByEFDAELCwJAIBVBACAJaxDcCSIVRAAAAAAAAHBBZkEBc0UEQCAGQeADaiAFQQJ0agJ/An8gFUQAAAAAAABwPqIiFplEAAAAAAAA4EFjBEAgFqoMAQtBgICAgHgLIgK3RAAAAAAAAHDBoiAVoCIVmUQAAAAAAADgQWMEQCAVqgwBC0GAgICAeAs2AgAgBUEBaiEFDAELAn8gFZlEAAAAAAAA4EFjBEAgFaoMAQtBgICAgHgLIQIgCSEMCyAGQeADaiAFQQJ0aiACNgIAC0QAAAAAAADwPyAMENwJIRUCQCAFQX9MDQAgBSECA0AgBiACQQN0aiAVIAZB4ANqIAJBAnRqKAIAt6I5AwAgFUQAAAAAAABwPqIhFSACQQBKIQAgAkF/aiECIAANAAsgBUF/TA0AIAUhAgNAIAUgAiIAayEDRAAAAAAAAAAAIRVBACECA0ACQCACQQN0QYCOAWorAwAgBiAAIAJqQQN0aisDAKIgFaAhFSACIAtODQAgAiADSSEHIAJBAWohAiAHDQELCyAGQaABaiADQQN0aiAVOQMAIABBf2ohAiAAQQBKDQALCwJAIARBA0sNAAJAAkACQAJAIARBAWsOAwICAAELRAAAAAAAAAAAIRYCQCAFQQFIDQAgBkGgAWogBUEDdGorAwAhFSAFIQIDQCAGQaABaiACQQN0aiAVIAZBoAFqIAJBf2oiAEEDdGoiAysDACIXIBcgFaAiFaGgOQMAIAMgFTkDACACQQFKIQMgACECIAMNAAsgBUECSA0AIAZBoAFqIAVBA3RqKwMAIRUgBSECA0AgBkGgAWogAkEDdGogFSAGQaABaiACQX9qIgBBA3RqIgMrAwAiFiAWIBWgIhWhoDkDACADIBU5AwAgAkECSiEDIAAhAiADDQALRAAAAAAAAAAAIRYgBUEBTA0AA0AgFiAGQaABaiAFQQN0aisDAKAhFiAFQQJKIQAgBUF/aiEFIAANAAsLIAYrA6ABIRUgCA0CIAEgFTkDACAGKQOoASEUIAEgFjkDECABIBQ3AwgMAwtEAAAAAAAAAAAhFSAFQQBOBEADQCAVIAZBoAFqIAVBA3RqKwMAoCEVIAVBAEohACAFQX9qIQUgAA0ACwsgASAVmiAVIAgbOQMADAILRAAAAAAAAAAAIRUgBUEATgRAIAUhAgNAIBUgBkGgAWogAkEDdGorAwCgIRUgAkEASiEAIAJBf2ohAiAADQALCyABIBWaIBUgCBs5AwAgBisDoAEgFaEhFUEBIQIgBUEBTgRAA0AgFSAGQaABaiACQQN0aisDAKAhFSACIAVHIQAgAkEBaiECIAANAAsLIAEgFZogFSAIGzkDCAwBCyABIBWaOQMAIAYrA6gBIRUgASAWmjkDECABIBWaOQMICyAGQbAEaiQAIApBB3ELwgkDBH8BfgR8IwBBMGsiBCQAAkACQAJAIAC9IgZCIIinIgJB/////wdxIgNB+tS9gARNBEAgAkH//z9xQfvDJEYNASADQfyyi4AETQRAIAZCAFkEQCABIABEAABAVPsh+b+gIgBEMWNiGmG00L2gIgc5AwAgASAAIAehRDFjYhphtNC9oDkDCEEBIQIMBQsgASAARAAAQFT7Ifk/oCIARDFjYhphtNA9oCIHOQMAIAEgACAHoUQxY2IaYbTQPaA5AwhBfyECDAQLIAZCAFkEQCABIABEAABAVPshCcCgIgBEMWNiGmG04L2gIgc5AwAgASAAIAehRDFjYhphtOC9oDkDCEECIQIMBAsgASAARAAAQFT7IQlAoCIARDFjYhphtOA9oCIHOQMAIAEgACAHoUQxY2IaYbTgPaA5AwhBfiECDAMLIANBu4zxgARNBEAgA0G8+9eABE0EQCADQfyyy4AERg0CIAZCAFkEQCABIABEAAAwf3zZEsCgIgBEypSTp5EO6b2gIgc5AwAgASAAIAehRMqUk6eRDum9oDkDCEEDIQIMBQsgASAARAAAMH982RJAoCIARMqUk6eRDuk9oCIHOQMAIAEgACAHoUTKlJOnkQ7pPaA5AwhBfSECDAQLIANB+8PkgARGDQEgBkIAWQRAIAEgAEQAAEBU+yEZwKAiAEQxY2IaYbTwvaAiBzkDACABIAAgB6FEMWNiGmG08L2gOQMIQQQhAgwECyABIABEAABAVPshGUCgIgBEMWNiGmG08D2gIgc5AwAgASAAIAehRDFjYhphtPA9oDkDCEF8IQIMAwsgA0H6w+SJBEsNAQsgASAAIABEg8jJbTBf5D+iRAAAAAAAADhDoEQAAAAAAAA4w6AiCEQAAEBU+yH5v6KgIgcgCEQxY2IaYbTQPaIiCqEiADkDACADQRR2IgUgAL1CNIinQf8PcWtBEUghAwJ/IAiZRAAAAAAAAOBBYwRAIAiqDAELQYCAgIB4CyECAkAgAw0AIAEgByAIRAAAYBphtNA9oiIAoSIJIAhEc3ADLooZozuiIAcgCaEgAKGhIgqhIgA5AwAgBSAAvUI0iKdB/w9xa0EySARAIAkhBwwBCyABIAkgCEQAAAAuihmjO6IiAKEiByAIRMFJICWag3s5oiAJIAehIAChoSIKoSIAOQMACyABIAcgAKEgCqE5AwgMAQsgA0GAgMD/B08EQCABIAAgAKEiADkDACABIAA5AwhBACECDAELIAZC/////////weDQoCAgICAgICwwQCEvyEAQQAhAgNAIARBEGogAiIFQQN0agJ/IACZRAAAAAAAAOBBYwRAIACqDAELQYCAgIB4C7ciBzkDACAAIAehRAAAAAAAAHBBoiEAQQEhAiAFRQ0ACyAEIAA5AyACQCAARAAAAAAAAAAAYgRAQQIhAgwBC0EBIQUDQCAFIgJBf2ohBSAEQRBqIAJBA3RqKwMARAAAAAAAAAAAYQ0ACwsgBEEQaiAEIANBFHZB6ndqIAJBAWpBARDdBCECIAQrAwAhACAGQn9XBEAgASAAmjkDACABIAQrAwiaOQMIQQAgAmshAgwBCyABIAA5AwAgASAEKQMINwMICyAEQTBqJAAgAguZAQEDfCAAIACiIgMgAyADoqIgA0R81c9aOtnlPaJE65wriublWr6goiADIANEff6xV+Mdxz6iRNVhwRmgASq/oKJEpvgQERERgT+goCEFIAMgAKIhBCACRQRAIAQgAyAFokRJVVVVVVXFv6CiIACgDwsgACADIAFEAAAAAAAA4D+iIAUgBKKhoiABoSAERElVVVVVVcU/oqChC9ABAQJ/IwBBEGsiASQAAnwgAL1CIIinQf////8HcSICQfvDpP8DTQRARAAAAAAAAPA/IAJBnsGa8gNJDQEaIABEAAAAAAAAAAAQ3AQMAQsgACAAoSACQYCAwP8HTw0AGiAAIAEQ3gRBA3EiAkECTQRAAkACQAJAIAJBAWsOAgECAAsgASsDACABKwMIENwEDAMLIAErAwAgASsDCEEBEN8EmgwCCyABKwMAIAErAwgQ3ASaDAELIAErAwAgASsDCEEBEN8ECyEAIAFBEGokACAAC08BAXwgACAAoiIAIAAgAKIiAaIgAERpUO7gQpP5PqJEJx4P6IfAVr+goiABREI6BeFTVaU/oiAARIFeDP3//9+/okQAAAAAAADwP6CgoLYLSwECfCAAIACiIgEgAKIiAiABIAGioiABRKdGO4yHzcY+okR058ri+QAqv6CiIAIgAUSy+26JEBGBP6JEd6zLVFVVxb+goiAAoKC2C4YCAgN/AXwjAEEQayIDJAACQCAAvCIEQf////8HcSICQdqfpO4ETQRAIAEgALsiBSAFRIPIyW0wX+Q/okQAAAAAAAA4Q6BEAAAAAAAAOMOgIgVEAAAAUPsh+b+ioCAFRGNiGmG0EFG+oqA5AwAgBZlEAAAAAAAA4EFjBEAgBaohAgwCC0GAgICAeCECDAELIAJBgICA/AdPBEAgASAAIACTuzkDAEEAIQIMAQsgAyACIAJBF3ZB6n5qIgJBF3Rrvrs5AwggA0EIaiADIAJBAUEAEN0EIQIgAysDACEFIARBf0wEQCABIAWaOQMAQQAgAmshAgwBCyABIAU5AwALIANBEGokACACC/wCAgN/AXwjAEEQayICJAACfSAAvCIDQf////8HcSIBQdqfpPoDTQRAQwAAgD8gAUGAgIDMA0kNARogALsQ4QQMAQsgAUHRp+2DBE0EQCAAuyEEIAFB5JfbgARPBEBEGC1EVPshCUBEGC1EVPshCcAgA0EASBsgBKAQ4QSMDAILIANBf0wEQCAERBgtRFT7Ifk/oBDiBAwCC0QYLURU+yH5PyAEoRDiBAwBCyABQdXjiIcETQRAIAFB4Nu/hQRPBEBEGC1EVPshGUBEGC1EVPshGcAgA0EASBsgALugEOEEDAILIANBf0wEQETSITN/fNkSwCAAu6EQ4gQMAgsgALtE0iEzf3zZEsCgEOIEDAELIAAgAJMgAUGAgID8B08NABogACACQQhqEOMEQQNxIgFBAk0EQAJAAkACQCABQQFrDgIBAgALIAIrAwgQ4QQMAwsgAisDCJoQ4gQMAgsgAisDCBDhBIwMAQsgAisDCBDiBAshACACQRBqJAAgAAvUAQECfyMAQRBrIgEkAAJAIAC9QiCIp0H/////B3EiAkH7w6T/A00EQCACQYCAwPIDSQ0BIABEAAAAAAAAAABBABDfBCEADAELIAJBgIDA/wdPBEAgACAAoSEADAELIAAgARDeBEEDcSICQQJNBEACQAJAAkAgAkEBaw4CAQIACyABKwMAIAErAwhBARDfBCEADAMLIAErAwAgASsDCBDcBCEADAILIAErAwAgASsDCEEBEN8EmiEADAELIAErAwAgASsDCBDcBJohAAsgAUEQaiQAIAALkgMCA38BfCMAQRBrIgIkAAJAIAC8IgNB/////wdxIgFB2p+k+gNNBEAgAUGAgIDMA0kNASAAuxDiBCEADAELIAFB0aftgwRNBEAgALshBCABQeOX24AETQRAIANBf0wEQCAERBgtRFT7Ifk/oBDhBIwhAAwDCyAERBgtRFT7Ifm/oBDhBCEADAILRBgtRFT7IQlARBgtRFT7IQnAIANBAEgbIASgmhDiBCEADAELIAFB1eOIhwRNBEAgALshBCABQd/bv4UETQRAIANBf0wEQCAERNIhM3982RJAoBDhBCEADAMLIARE0iEzf3zZEsCgEOEEjCEADAILRBgtRFT7IRlARBgtRFT7IRnAIANBAEgbIASgEOIEIQAMAQsgAUGAgID8B08EQCAAIACTIQAMAQsgACACQQhqEOMEQQNxIgFBAk0EQAJAAkACQCABQQFrDgIBAgALIAIrAwgQ4gQhAAwDCyACKwMIEOEEIQAMAgsgAisDCJoQ4gQhAAwBCyACKwMIEOEEjCEACyACQRBqJAAgAAusAwMCfwF+AnwgAL0iBUKAgICAgP////8Ag0KBgICA8ITl8j9UIgRFBEBEGC1EVPsh6T8gAJogACAFQgBTIgMboUQHXBQzJqaBPCABmiABIAMboaAhACAFQj+IpyEDRAAAAAAAAAAAIQELIAAgACAAIACiIgeiIgZEY1VVVVVV1T+iIAcgBiAHIAeiIgYgBiAGIAYgBkRzU2Dby3XzvqJEppI3oIh+FD+gokQBZfLy2ERDP6CiRCgDVskibW0/oKJEN9YGhPRklj+gokR6/hARERHBP6AgByAGIAYgBiAGIAZE1Hq/dHAq+z6iROmn8DIPuBI/oKJEaBCNGvcmMD+gokQVg+D+yNtXP6CiRJOEbunjJoI/oKJE/kGzG7qhqz+goqCiIAGgoiABoKAiBqAhASAERQRAQQEgAkEBdGu3IgcgACAGIAEgAaIgASAHoKOhoCIAIACgoSIAmiAAIAMbDwsgAgR8RAAAAAAAAPC/IAGjIgcgB71CgICAgHCDvyIHIAYgAb1CgICAgHCDvyIBIAChoaIgByABokQAAAAAAADwP6CgoiAHoAUgAQsLhAEBAn8jAEEQayIBJAACQCAAvUIgiKdB/////wdxIgJB+8Ok/wNNBEAgAkGAgIDyA0kNASAARAAAAAAAAAAAQQAQ5wQhAAwBCyACQYCAwP8HTwRAIAAgAKEhAAwBCyAAIAEQ3gQhAiABKwMAIAErAwggAkEBcRDnBCEACyABQRBqJAAgAAv5AwMBfwF+A3wgAL0iAkIgiKdB/////wdxIgFBgIDAoARJBEACQAJ/IAFB///v/gNNBEBBfyABQYCAgPIDTw0BGgwCCyAAmSEAIAFB///L/wNNBEAgAUH//5f/A00EQCAAIACgRAAAAAAAAPC/oCAARAAAAAAAAABAoKMhAEEADAILIABEAAAAAAAA8L+gIABEAAAAAAAA8D+goyEAQQEMAQsgAUH//42ABE0EQCAARAAAAAAAAPi/oCAARAAAAAAAAPg/okQAAAAAAADwP6CjIQBBAgwBC0QAAAAAAADwvyAAoyEAQQMLIQEgACAAoiIEIASiIgMgAyADIAMgA0QvbGosRLSiv6JEmv3eUi3erb+gokRtmnSv8rCzv6CiRHEWI/7Gcby/oKJExOuYmZmZyb+goiEFIAQgAyADIAMgAyADRBHaIuM6rZA/okTrDXYkS3upP6CiRFE90KBmDbE/oKJEbiBMxc1Ftz+gokT/gwCSJEnCP6CiRA1VVVVVVdU/oKIhAyABQX9MBEAgACAAIAUgA6CioQ8LIAFBA3QiAUHAjgFqKwMAIAAgBSADoKIgAUHgjgFqKwMAoSAAoaEiAJogACACQgBTGyEACyAADwsgAEQYLURU+yH5PyAApiACQv///////////wCDQoCAgICAgID4/wBWGwvcAgICfwN9IAC8IgJB/////wdxIgFBgICA5ARJBEACQAJ/IAFB////9gNNBEBBfyABQYCAgMwDTw0BGgwCCyAAiyEAIAFB///f/ANNBEAgAUH//7/5A00EQCAAIACSQwAAgL+SIABDAAAAQJKVIQBBAAwCCyAAQwAAgL+SIABDAACAP5KVIQBBAQwBCyABQf//74AETQRAIABDAADAv5IgAEMAAMA/lEMAAIA/kpUhAEECDAELQwAAgL8gAJUhAEEDCyEBIAAgAJQiBCAElCIDIANDRxLavZRDmMpMvpKUIQUgBCADIANDJax8PZRDDfURPpKUQ6mqqj6SlCEDIAFBf0wEQCAAIAAgBSADkpSTDwsgAUECdCIBQYCPAWoqAgAgACAFIAOSlCABQZCPAWoqAgCTIACTkyIAjCAAIAJBAEgbIQALIAAPCyAAQ9oPyT8gAJggAUGAgID8B0sbC9MCAQR/AkAgAbwiBEH/////B3EiBUGAgID8B00EQCAAvCICQf////8HcSIDQYGAgPwHSQ0BCyAAIAGSDwsgBEGAgID8A0YEQCAAEOoEDwsgBEEedkECcSIEIAJBH3ZyIQICQAJAAkAgA0UEQAJAIAJBAmsOAgIAAwtD2w9JwA8LIAVBgICA/AdHBEAgBUUEQEPbD8k/IACYDwsgA0GAgID8B0dBACAFQYCAgOgAaiADTxtFBEBD2w/JPyAAmA8LAn0gA0GAgIDoAGogBUkEQEMAAAAAIAQNARoLIAAgAZWLEOoECyEAIAJBAk0EQAJAAkAgAkEBaw4CAAEFCyAAjA8LQ9sPSUAgAEMuvbszkpMPCyAAQy69uzOSQ9sPScCSDwsgA0GAgID8B0YNAiACQQJ0QbCPAWoqAgAPC0PbD0lAIQALIAAPCyACQQJ0QaCPAWoqAgALxgICA38CfSAAvCICQR92IQMCQAJAAn0CQCAAAn8CQAJAIAJB/////wdxIgFB0Ni6lQRPBEAgAUGAgID8B0sEQCAADwsCQCACQQBIDQAgAUGY5MWVBEkNACAAQwAAAH+UDwsgAkF/Sg0BIAFBtOO/lgRNDQEMBgsgAUGZ5MX1A0kNAyABQZOrlPwDSQ0BCyAAQzuquD+UIANBAnRBwI8BaioCAJIiBItDAAAAT10EQCAEqAwCC0GAgICAeAwBCyADQQFzIANrCyIBsiIEQwByMb+UkiIAIARDjr6/NZQiBZMMAQsgAUGAgIDIA00NAkEAIQEgAAshBCAAIAQgBCAEIASUIgAgAEMVUjW7lEOPqio+kpSTIgCUQwAAAEAgAJOVIAWTkkMAAIA/kiEEIAFFDQAgBCABEJYEIQQLIAQPCyAAQwAAgD+SC50DAwN/AX4DfAJAAkACQAJAIAC9IgRCAFkEQCAEQiCIpyIBQf//P0sNAQsgBEL///////////8Ag1AEQEQAAAAAAADwvyAAIACiow8LIARCf1UNASAAIAChRAAAAAAAAAAAow8LIAFB//+//wdLDQJBgIDA/wMhAkGBeCEDIAFBgIDA/wNHBEAgASECDAILIASnDQFEAAAAAAAAAAAPCyAARAAAAAAAAFBDor0iBEIgiKchAkHLdyEDCyADIAJB4r4laiIBQRR2arciBkQAAOD+Qi7mP6IgBEL/////D4MgAUH//z9xQZ7Bmv8Daq1CIIaEv0QAAAAAAADwv6AiACAAIABEAAAAAAAAAECgoyIFIAAgAEQAAAAAAADgP6KiIgcgBSAFoiIFIAWiIgAgACAARJ/GeNAJmsM/okSveI4dxXHMP6CiRAT6l5mZmdk/oKIgBSAAIAAgAEREUj7fEvHCP6JE3gPLlmRGxz+gokRZkyKUJEnSP6CiRJNVVVVVVeU/oKKgoKIgBkR2PHk17znqPaKgIAehoKAhAAsgAAuQAgICfwJ9AkACQCAAvCIBQYCAgARPQQAgAUF/ShtFBEAgAUH/////B3FFBEBDAACAvyAAIACUlQ8LIAFBf0wEQCAAIACTQwAAAACVDwsgAEMAAABMlLwhAUHofiECDAELIAFB////+wdLDQFBgX8hAkMAAAAAIQAgAUGAgID8A0YNAQsgAiABQY32qwJqIgFBF3ZqsiIEQ4BxMT+UIAFB////A3FB84nU+QNqvkMAAIC/kiIAIAAgAEMAAABAkpUiAyAAIABDAAAAP5SUIgAgAyADlCIDIAMgA5QiA0Pu6ZE+lEOqqio/kpQgAyADQyaeeD6UQxPOzD6SlJKSlCAEQ9H3FzeUkiAAk5KSIQALIAAL1A8DCH8Cfgh8RAAAAAAAAPA/IQ0CQAJAAkAgAb0iCkIgiKciBEH/////B3EiAiAKpyIGckUNACAAvSILQiCIpyEHIAunIglFQQAgB0GAgMD/A0YbDQACQAJAIAdB/////wdxIgNBgIDA/wdLDQAgA0GAgMD/B0YgCUEAR3ENACACQYCAwP8HSw0AIAZFDQEgAkGAgMD/B0cNAQsgACABoA8LAkACfwJAAn9BACAHQX9KDQAaQQIgAkH///+ZBEsNABpBACACQYCAwP8DSQ0AGiACQRR2IQggAkGAgICKBEkNAUEAIAZBswggCGsiBXYiCCAFdCAGRw0AGkECIAhBAXFrCyIFIAZFDQEaDAILIAYNAUEAIAJBkwggCGsiBXYiBiAFdCACRw0AGkECIAZBAXFrCyEFIAJBgIDA/wdGBEAgA0GAgMCAfGogCXJFDQIgA0GAgMD/A08EQCABRAAAAAAAAAAAIARBf0obDwtEAAAAAAAAAAAgAZogBEF/ShsPCyACQYCAwP8DRgRAIARBf0oEQCAADwtEAAAAAAAA8D8gAKMPCyAEQYCAgIAERgRAIAAgAKIPCyAHQQBIDQAgBEGAgID/A0cNACAAnw8LIACZIQwCQCAJDQAgA0EAIANBgICAgARyQYCAwP8HRxsNAEQAAAAAAADwPyAMoyAMIARBAEgbIQ0gB0F/Sg0BIAUgA0GAgMCAfGpyRQRAIA0gDaEiACAAow8LIA2aIA0gBUEBRhsPCwJAIAdBf0oNACAFQQFLDQAgBUEBawRAIAAgAKEiACAAow8LRAAAAAAAAPC/IQ0LAnwgAkGBgICPBE8EQCACQYGAwJ8ETwRAIANB//+//wNNBEBEAAAAAAAA8H9EAAAAAAAAAAAgBEEASBsPC0QAAAAAAADwf0QAAAAAAAAAACAEQQBKGw8LIANB/v+//wNNBEAgDUScdQCIPOQ3fqJEnHUAiDzkN36iIA1EWfP4wh9upQGiRFnz+MIfbqUBoiAEQQBIGw8LIANBgYDA/wNPBEAgDUScdQCIPOQ3fqJEnHUAiDzkN36iIA1EWfP4wh9upQGiRFnz+MIfbqUBoiAEQQBKGw8LIAxEAAAAAAAA8L+gIgBEAAAAYEcV9z+iIg4gAERE3134C65UPqIgACAAokQAAAAAAADgPyAAIABEAAAAAAAA0L+iRFVVVVVVVdU/oKKhokT+gitlRxX3v6KgIgygvUKAgICAcIO/IgAgDqEMAQsgDEQAAAAAAABAQ6IiACAMIANBgIDAAEkiAhshDCAAvUIgiKcgAyACGyIFQf//P3EiBEGAgMD/A3IhAyAFQRR1Qcx3QYF4IAIbaiEFQQAhAgJAIARBj7EOSQ0AIARB+uwuSQRAQQEhAgwBCyADQYCAQGohAyAFQQFqIQULIAJBA3QiBEHwjwFqKwMAIhEgDL1C/////w+DIAOtQiCGhL8iDiAEQdCPAWorAwAiD6EiEEQAAAAAAADwPyAPIA6goyISoiIMvUKAgICAcIO/IgAgACAAoiITRAAAAAAAAAhAoCASIBAgACADQQF1QYCAgIACciACQRJ0akGAgCBqrUIghr8iEKKhIAAgDiAQIA+hoaKhoiIOIAwgAKCiIAwgDKIiACAAoiAAIAAgACAAIABE705FSih+yj+iRGXbyZNKhs0/oKJEAUEdqWB00T+gokRNJo9RVVXVP6CiRP+rb9u2bds/oKJEAzMzMzMz4z+goqAiD6C9QoCAgIBwg78iAKIiECAOIACiIAwgDyAARAAAAAAAAAjAoCAToaGioCIMoL1CgICAgHCDvyIARAAAAOAJx+4/oiIOIARB4I8BaisDACAARPUBWxTgLz6+oiAMIAAgEKGhRP0DOtwJx+4/oqCgIgygoCAFtyIPoL1CgICAgHCDvyIAIA+hIBGhIA6hCyEOIAEgCkKAgICAcIO/Ig+hIACiIAwgDqEgAaKgIgwgACAPoiIBoCIAvSIKpyECAkAgCkIgiKciA0GAgMCEBE4EQCADQYCAwPt7aiACcg0DIAxE/oIrZUcVlzygIAAgAaFkQQFzDQEMAwsgA0GA+P//B3FBgJjDhARJDQAgA0GA6Lz7A2ogAnINAyAMIAAgAaFlQQFzDQAMAwtBACECIA0CfCADQf////8HcSIEQYGAgP8DTwR+QQBBgIDAACAEQRR2QYJ4anYgA2oiBEH//z9xQYCAwAByQZMIIARBFHZB/w9xIgVrdiICayACIANBAEgbIQIgDCABQYCAQCAFQYF4anUgBHGtQiCGv6EiAaC9BSAKC0KAgICAcIO/IgBEAAAAAEMu5j+iIg0gDCAAIAGhoUTvOfr+Qi7mP6IgAEQ5bKgMYVwgvqKgIgygIgAgACAAIAAgAKIiASABIAEgASABRNCkvnJpN2Y+okTxa9LFQb27vqCiRCzeJa9qVhE/oKJEk72+FmzBZr+gokQ+VVVVVVXFP6CioSIBoiABRAAAAAAAAADAoKMgACAMIAAgDaGhIgCiIACgoaFEAAAAAAAA8D+gIgC9IgpCIIinIAJBFHRqIgNB//8/TARAIAAgAhDcCQwBCyAKQv////8PgyADrUIghoS/C6IhDQsgDQ8LIA1EnHUAiDzkN36iRJx1AIg85Dd+og8LIA1EWfP4wh9upQGiRFnz+MIfbqUBogszAQF/IAIEQCAAIQMDQCADIAEoAgA2AgAgA0EEaiEDIAFBBGohASACQX9qIgINAAsLIAALBABBAAsKACAAEPMEGiAAC2ABAn8gAEHIkgE2AgAgABD0BAJ/IAAoAhwiASABKAIEQX9qIgI2AgQgAkF/RgsEQCABIAEoAgAoAggRAQALIAAoAiAQ0wkgACgCJBDTCSAAKAIwENMJIAAoAjwQ0wkgAAs8AQJ/IAAoAighAQNAIAEEQEEAIAAgAUF/aiIBQQJ0IgIgACgCJGooAgAgACgCICACaigCABEFAAwBCwsLCgAgABDyBBDTCQs7AQJ/IABBiJABNgIAAn8gACgCBCIBIAEoAgRBf2oiAjYCBCACQX9GCwRAIAEgASgCACgCCBEBAAsgAAsKACAAEPYEENMJCyoAIABBiJABNgIAIABBBGoQ/AcgAEIANwIYIABCADcCECAAQgA3AgggAAsDAAELBAAgAAsQACAAQn83AwggAEIANwMACxAAIABCfzcDCCAAQgA3AwALgQIBBn8jAEEQayIEJAADQAJAIAYgAk4NAAJAIAAoAgwiAyAAKAIQIgVJBEAgBEH/////BzYCDCAEIAUgA2s2AgggBCACIAZrNgIEIwBBEGsiAyQAIARBBGoiBSgCACAEQQhqIgcoAgBIIQggA0EQaiQAIAUgByAIGyEDIwBBEGsiBSQAIAMoAgAgBEEMaiIHKAIASCEIIAVBEGokACADIAcgCBshAyABIAAoAgwgAygCACIDEP4EIAAgACgCDCADajYCDAwBCyAAIAAoAgAoAigRAAAiA0F/Rg0BIAEgAzoAAEEBIQMLIAEgA2ohASADIAZqIQYMAQsLIARBEGokACAGCxEAIAIEQCAAIAEgAhDeCRoLCwQAQX8LLAAgACAAKAIAKAIkEQAAQX9GBEBBfw8LIAAgACgCDCIAQQFqNgIMIAAtAAALBABBfwvOAQEGfyMAQRBrIgUkAANAAkAgBCACTg0AIAAoAhgiAyAAKAIcIgZPBEAgACABLQAAIAAoAgAoAjQRAwBBf0YNASAEQQFqIQQgAUEBaiEBDAILIAUgBiADazYCDCAFIAIgBGs2AggjAEEQayIDJAAgBUEIaiIGKAIAIAVBDGoiBygCAEghCCADQRBqJAAgBiAHIAgbIQMgACgCGCABIAMoAgAiAxD+BCAAIAMgACgCGGo2AhggAyAEaiEEIAEgA2ohAQwBCwsgBUEQaiQAIAQLOwECfyAAQciQATYCAAJ/IAAoAgQiASABKAIEQX9qIgI2AgQgAkF/RgsEQCABIAEoAgAoAggRAQALIAALCgAgABCDBRDTCQsqACAAQciQATYCACAAQQRqEPwHIABCADcCGCAAQgA3AhAgAEIANwIIIAALjwIBBn8jAEEQayIEJAADQAJAIAYgAk4NAAJ/IAAoAgwiAyAAKAIQIgVJBEAgBEH/////BzYCDCAEIAUgA2tBAnU2AgggBCACIAZrNgIEIwBBEGsiAyQAIARBBGoiBSgCACAEQQhqIgcoAgBIIQggA0EQaiQAIAUgByAIGyEDIwBBEGsiBSQAIAMoAgAgBEEMaiIHKAIASCEIIAVBEGokACADIAcgCBshAyABIAAoAgwgAygCACIDEIcFIAAgACgCDCADQQJ0ajYCDCABIANBAnRqDAELIAAgACgCACgCKBEAACIDQX9GDQEgASADNgIAQQEhAyABQQRqCyEBIAMgBmohBgwBCwsgBEEQaiQAIAYLFAAgAgR/IAAgASACEPAEBSAACxoLLAAgACAAKAIAKAIkEQAAQX9GBEBBfw8LIAAgACgCDCIAQQRqNgIMIAAoAgAL1gEBBn8jAEEQayIFJAADQAJAIAQgAk4NACAAKAIYIgMgACgCHCIGTwRAIAAgASgCACAAKAIAKAI0EQMAQX9GDQEgBEEBaiEEIAFBBGohAQwCCyAFIAYgA2tBAnU2AgwgBSACIARrNgIIIwBBEGsiAyQAIAVBCGoiBigCACAFQQxqIgcoAgBIIQggA0EQaiQAIAYgByAIGyEDIAAoAhggASADKAIAIgMQhwUgACADQQJ0IgYgACgCGGo2AhggAyAEaiEEIAEgBmohAQwBCwsgBUEQaiQAIAQLDQAgAEEIahDyBBogAAsTACAAIAAoAgBBdGooAgBqEIoFCwoAIAAQigUQ0wkLEwAgACAAKAIAQXRqKAIAahCMBQuOAQECfyMAQSBrIgMkACAAQQA6AAAgASABKAIAQXRqKAIAaiECAkAgASABKAIAQXRqKAIAaigCEEUEQCACKAJIBEAgASABKAIAQXRqKAIAaigCSBCPBQsgACABIAEoAgBBdGooAgBqKAIQRToAAAwBCyACIAIoAhhFIAIoAhBBBHJyNgIQCyADQSBqJAAgAAuHAQEDfyMAQRBrIgEkACAAIAAoAgBBdGooAgBqKAIYBEACQCABQQhqIAAQlQUiAi0AAEUNACAAIAAoAgBBdGooAgBqKAIYIgMgAygCACgCGBEAAEF/Rw0AIAAgACgCAEF0aigCAGoiACAAKAIYRSAAKAIQQQFycjYCEAsgAhCWBQsgAUEQaiQACwsAIABB2JUDEJgGCwwAIAAgARCXBUEBcws2AQF/An8gACgCACIAKAIMIgEgACgCEEYEQCAAIAAoAgAoAiQRAAAMAQsgAS0AAAtBGHRBGHULDQAgACgCABCYBRogAAsJACAAIAEQlwULVgAgACABNgIEIABBADoAACABIAEoAgBBdGooAgBqKAIQRQRAIAEgASgCAEF0aigCAGooAkgEQCABIAEoAgBBdGooAgBqKAJIEI8FCyAAQQE6AAALIAALpQEBAX8CQCAAKAIEIgEgASgCAEF0aigCAGooAhhFDQAgACgCBCIBIAEoAgBBdGooAgBqKAIQDQAgACgCBCIBIAEoAgBBdGooAgBqKAIEQYDAAHFFDQAgACgCBCIBIAEoAgBBdGooAgBqKAIYIgEgASgCACgCGBEAAEF/Rw0AIAAoAgQiACAAKAIAQXRqKAIAaiIAIAAoAhhFIAAoAhBBAXJyNgIQCwsQACAAELYFIAEQtgVzQQFzCzEBAX8gACgCDCIBIAAoAhBGBEAgACAAKAIAKAIoEQAADwsgACABQQFqNgIMIAEtAAALPwEBfyAAKAIYIgIgACgCHEYEQCAAIAFB/wFxIAAoAgAoAjQRAwAPCyAAIAJBAWo2AhggAiABOgAAIAFB/wFxC54BAQN/IwBBEGsiBCQAIABBADYCBCAEQQhqIAAQjgUtAAAhBSAAIAAoAgBBdGooAgBqIQMCQCAFBEAgACADKAIYIgMgASACIAMoAgAoAiARBAAiATYCBCABIAJGDQEgACAAKAIAQXRqKAIAaiIAIAAoAhhFIAAoAhBBBnJyNgIQDAELIAMgAygCGEUgAygCEEEEcnI2AhALIARBEGokAAuxAQEDfyMAQTBrIgIkACAAIAAoAgBBdGooAgBqIgMiBCAEKAIYRSADKAIQQX1xcjYCEAJAIAJBKGogABCOBS0AAEUNACACQRhqIAAgACgCAEF0aigCAGooAhgiAyABQQBBCCADKAIAKAIQESYAIAJCfzcDECACQgA3AwggAikDICACKQMQUg0AIAAgACgCAEF0aigCAGoiACAAKAIYRSAAKAIQQQRycjYCEAsgAkEwaiQAC4cBAQN/IwBBEGsiASQAIAAgACgCAEF0aigCAGooAhgEQAJAIAFBCGogABChBSICLQAARQ0AIAAgACgCAEF0aigCAGooAhgiAyADKAIAKAIYEQAAQX9HDQAgACAAKAIAQXRqKAIAaiIAIAAoAhhFIAAoAhBBAXJyNgIQCyACEJYFCyABQRBqJAALCwAgAEHQlQMQmAYLDAAgACABEKIFQQFzCw0AIAAoAgAQowUaIAALCQAgACABEKIFC1YAIAAgATYCBCAAQQA6AAAgASABKAIAQXRqKAIAaigCEEUEQCABIAEoAgBBdGooAgBqKAJIBEAgASABKAIAQXRqKAIAaigCSBCcBQsgAEEBOgAACyAACxAAIAAQtwUgARC3BXNBAXMLMQEBfyAAKAIMIgEgACgCEEYEQCAAIAAoAgAoAigRAAAPCyAAIAFBBGo2AgwgASgCAAs3AQF/IAAoAhgiAiAAKAIcRgRAIAAgASAAKAIAKAI0EQMADwsgACACQQRqNgIYIAIgATYCACABCw0AIABBBGoQ8gQaIAALEwAgACAAKAIAQXRqKAIAahClBQsKACAAEKUFENMJCxMAIAAgACgCAEF0aigCAGoQpwULCwAgAEGslAMQmAYLLQACQCAAKAJMQX9HBEAgACgCTCEADAELIAAgABCrBSIANgJMCyAAQRh0QRh1C3QBA38jAEEQayIBJAAgASAAKAIcIgA2AgggACAAKAIEQQFqNgIEIAFBCGoQkAUiAEEgIAAoAgAoAhwRAwAhAgJ/IAEoAggiACAAKAIEQX9qIgM2AgQgA0F/RgsEQCAAIAAoAgAoAggRAQALIAFBEGokACACC60CAQZ/IwBBIGsiAyQAAkAgA0EYaiAAEJUFIgYtAABFDQAgACAAKAIAQXRqKAIAaigCBCEHIAMgACAAKAIAQXRqKAIAaigCHCICNgIQIAIgAigCBEEBajYCBCADQRBqEKkFIQUCfyADKAIQIgIgAigCBEF/aiIENgIEIARBf0YLBEAgAiACKAIAKAIIEQEACyADIAAgACgCAEF0aigCAGooAhg2AgggACAAKAIAQXRqKAIAaiICEKoFIQQgAyAFIAMoAgggAiAEIAFB//8DcSICIAIgASAHQcoAcSIBQQhGGyABQcAARhsgBSgCACgCEBEGADYCECADKAIQDQAgACAAKAIAQXRqKAIAaiIBIAEoAhhFIAEoAhBBBXJyNgIQCyAGEJYFIANBIGokACAAC44CAQV/IwBBIGsiAiQAAkAgAkEYaiAAEJUFIgYtAABFDQAgACAAKAIAQXRqKAIAaigCBBogAiAAIAAoAgBBdGooAgBqKAIcIgM2AhAgAyADKAIEQQFqNgIEIAJBEGoQqQUhBQJ/IAIoAhAiAyADKAIEQX9qIgQ2AgQgBEF/RgsEQCADIAMoAgAoAggRAQALIAIgACAAKAIAQXRqKAIAaigCGDYCCCAAIAAoAgBBdGooAgBqIgMQqgUhBCACIAUgAigCCCADIAQgASAFKAIAKAIQEQYANgIQIAIoAhANACAAIAAoAgBBdGooAgBqIgEgASgCGEUgASgCEEEFcnI2AhALIAYQlgUgAkEgaiQAIAAL/AEBBX8jAEEgayICJAACQCACQRhqIAAQlQUiBi0AAEUNACACIAAgACgCAEF0aigCAGooAhwiAzYCECADIAMoAgRBAWo2AgQgAkEQahCpBSEFAn8gAigCECIDIAMoAgRBf2oiBDYCBCAEQX9GCwRAIAMgAygCACgCCBEBAAsgAiAAIAAoAgBBdGooAgBqKAIYNgIIIAAgACgCAEF0aigCAGoiAxCqBSEEIAIgBSACKAIIIAMgBCABIAUoAgAoAhgRBgA2AhAgAigCEA0AIAAgACgCAEF0aigCAGoiASABKAIYRSABKAIQQQVycjYCEAsgBhCWBSACQSBqJAAgAAskAQF/AkAgACgCACICRQ0AIAIgARCZBUF/Rw0AIABBADYCAAsLeQEDfyMAQRBrIgIkAAJAIAJBCGogABCVBSIDLQAARQ0AAn8gAiAAIAAoAgBBdGooAgBqKAIYNgIAIAIiBAsgARCvBSAEKAIADQAgACAAKAIAQXRqKAIAaiIAIAAoAhhFIAAoAhBBAXJyNgIQCyADEJYFIAJBEGokAAskAQF/AkAgACgCACICRQ0AIAIgARCkBUF/Rw0AIABBADYCAAsLHAAgAEIANwIAIABBADYCCCAAIAEgARDHBBCGCQsKACAAEPMEENMJC0AAIABBADYCFCAAIAE2AhggAEEANgIMIABCgqCAgOAANwIEIAAgAUU2AhAgAEEgakEAQSgQ3wkaIABBHGoQ/AcLNQEBfyMAQRBrIgIkACACIAAoAgA2AgwgACABKAIANgIAIAEgAkEMaigCADYCACACQRBqJAALSwECfyAAKAIAIgEEQAJ/IAEoAgwiAiABKAIQRgRAIAEgASgCACgCJBEAAAwBCyACLQAAC0F/RwRAIAAoAgBFDwsgAEEANgIAC0EBC0sBAn8gACgCACIBBEACfyABKAIMIgIgASgCEEYEQCABIAEoAgAoAiQRAAAMAQsgAigCAAtBf0cEQCAAKAIARQ8LIABBADYCAAtBAQt9AQN/QX8hAgJAIABBf0YNACABKAJMQQBOBEBBASEECwJAAkAgASgCBCIDRQRAIAEQwAQaIAEoAgQiA0UNAQsgAyABKAIsQXhqSw0BCyAERQ0BQX8PCyABIANBf2oiAjYCBCACIAA6AAAgASABKAIAQW9xNgIAIAAhAgsgAguHAwEBf0GUlwEoAgAiABC7BRC8BSAAEL0FEL4FQZSSA0GQ+AAoAgAiAEHEkgMQvwVBmI0DQZSSAxDABUHMkgMgAEH8kgMQwQVB7I0DQcySAxDCBUGEkwNB2PIAKAIAIgBBtJMDEL8FQcCOA0GEkwMQwAVB6I8DQcCOAygCAEF0aigCAEHAjgNqKAIYEMAFQbyTAyAAQeyTAxDBBUGUjwNBvJMDEMIFQbyQA0GUjwMoAgBBdGooAgBBlI8DaigCGBDCBUHoiwMoAgBBdGooAgBB6IsDaiIAKAJIGiAAQZiNAzYCSEHAjAMoAgBBdGooAgBBwIwDaiIAKAJIGiAAQeyNAzYCSEHAjgMoAgBBdGooAgBBwI4DaiIAIAAoAgRBgMAAcjYCBEGUjwMoAgBBdGooAgBBlI8DaiIAIAAoAgRBgMAAcjYCBEHAjgMoAgBBdGooAgBBwI4DaiIAKAJIGiAAQZiNAzYCSEGUjwMoAgBBdGooAgBBlI8DaiIAKAJIGiAAQeyNAzYCSAseAEGYjQMQjwVB7I0DEJwFQeiPAxCPBUG8kAMQnAULqQEBAn8jAEEQayIBJABBlJEDEPgEIQJBvJEDQcyRAzYCAEG0kQMgADYCAEGUkQNBoJcBNgIAQciRA0EAOgAAQcSRA0F/NgIAIAEgAigCBCIANgIIIAAgACgCBEEBajYCBEGUkQMgAUEIakGUkQMoAgAoAggRAgACfyABKAIIIgAgACgCBEF/aiICNgIEIAJBf0YLBEAgACAAKAIAKAIIEQEACyABQRBqJAALSgBB8IsDQciSATYCAEHwiwNB9JIBNgIAQeiLA0GMkQE2AgBB8IsDQaCRATYCAEHsiwNBADYCAEGAkQEoAgBB6IsDakGUkQMQwwULqQEBAn8jAEEQayIBJABB1JEDEIUFIQJB/JEDQYySAzYCAEH0kQMgADYCAEHUkQNBrJgBNgIAQYiSA0EAOgAAQYSSA0F/NgIAIAEgAigCBCIANgIIIAAgACgCBEEBajYCBEHUkQMgAUEIakHUkQMoAgAoAggRAgACfyABKAIIIgAgACgCBEF/aiICNgIEIAJBf0YLBEAgACAAKAIAKAIIEQEACyABQRBqJAALSgBByIwDQciSATYCAEHIjANBvJMBNgIAQcCMA0G8kQE2AgBByIwDQdCRATYCAEHEjANBADYCAEGwkQEoAgBBwIwDakHUkQMQwwULmgEBA38jAEEQayIEJAAgABD4BCEDIAAgATYCICAAQZCZATYCACAEIAMoAgQiATYCCCABIAEoAgRBAWo2AgQgBEEIahDEBSEBAn8gBCgCCCIDIAMoAgRBf2oiBTYCBCAFQX9GCwRAIAMgAygCACgCCBEBAAsgACACNgIoIAAgATYCJCAAIAEgASgCACgCHBEAADoALCAEQRBqJAALPAEBfyAAQQRqIgJByJIBNgIAIAJB9JIBNgIAIABB7JEBNgIAIAJBgJIBNgIAIABB4JEBKAIAaiABEMMFC5oBAQN/IwBBEGsiBCQAIAAQhQUhAyAAIAE2AiAgAEH4mQE2AgAgBCADKAIEIgE2AgggASABKAIEQQFqNgIEIARBCGoQxQUhAQJ/IAQoAggiAyADKAIEQX9qIgU2AgQgBUF/RgsEQCADIAMoAgAoAggRAQALIAAgAjYCKCAAIAE2AiQgACABIAEoAgAoAhwRAAA6ACwgBEEQaiQACzwBAX8gAEEEaiICQciSATYCACACQbyTATYCACAAQZySATYCACACQbCSATYCACAAQZCSASgCAGogARDDBQsXACAAIAEQtAUgAEEANgJIIABBfzYCTAsLACAAQeCVAxCYBgsLACAAQeiVAxCYBgsNACAAEPYEGiAAENMJC0YAIAAgARDEBSIBNgIkIAAgASABKAIAKAIYEQAANgIsIAAgACgCJCIBIAEoAgAoAhwRAAA6ADUgACgCLEEJTgRAELUHAAsLCQAgAEEAEMkFC8IDAgd/AX4jAEEgayICJAACQCAALQA0BEAgACgCMCEDIAFFDQEgAEEAOgA0IABBfzYCMAwBCyACQQE2AhgjAEEQayIEJAAgAkEYaiIFKAIAIABBLGoiBigCAEghByAEQRBqJAAgBiAFIAcbKAIAIQQCQAJAAkADQCADIARIBEAgACgCIBDGBCIFQX9GDQIgAkEYaiADaiAFOgAAIANBAWohAwwBCwsCQCAALQA1BEAgAiACLQAYOgAXDAELQQEhBSACQRhqIQYCQAJAA0AgACgCKCIDKQIAIQkgACgCJCIHIAMgAkEYaiACQRhqIARqIgggAkEQaiACQRdqIAYgAkEMaiAHKAIAKAIQEQ4AQX9qIgNBAksNAgJAAkAgA0EBaw4CAwEACyAAKAIoIAk3AgAgBEEIRg0CIAAoAiAQxgQiA0F/Rg0CIAggAzoAACAEQQFqIQQMAQsLIAIgAi0AGDoAFwwBC0EAIQVBfyEDCyAFRQ0ECyABDQEDQCAEQQFIDQMgBEF/aiIEIAJBGGpqLQAAIAAoAiAQuAVBf0cNAAsLQX8hAwwCCyAAIAItABc2AjALIAItABchAwsgAkEgaiQAIAMLCQAgAEEBEMkFC4YCAQN/IwBBIGsiAiQAIAAtADQhBAJAIAFBf0YEQCABIQMgBA0BIAAgACgCMCIDQX9GQQFzOgA0DAELIAQEQCACIAAoAjA6ABMCfwJAIAAoAiQiAyAAKAIoIAJBE2ogAkEUaiACQQxqIAJBGGogAkEgaiACQRRqIAMoAgAoAgwRDgBBf2oiA0ECTQRAIANBAmsNASAAKAIwIQMgAiACQRlqNgIUIAIgAzoAGAsDQEEBIAIoAhQiAyACQRhqTQ0CGiACIANBf2oiAzYCFCADLAAAIAAoAiAQuAVBf0cNAAsLQX8hA0EAC0UNAQsgAEEBOgA0IAAgATYCMCABIQMLIAJBIGokACADCw0AIAAQgwUaIAAQ0wkLRgAgACABEMUFIgE2AiQgACABIAEoAgAoAhgRAAA2AiwgACAAKAIkIgEgASgCACgCHBEAADoANSAAKAIsQQlOBEAQtQcACwsJACAAQQAQzwULwgMCB38BfiMAQSBrIgIkAAJAIAAtADQEQCAAKAIwIQMgAUUNASAAQQA6ADQgAEF/NgIwDAELIAJBATYCGCMAQRBrIgQkACACQRhqIgUoAgAgAEEsaiIGKAIASCEHIARBEGokACAGIAUgBxsoAgAhBAJAAkACQANAIAMgBEgEQCAAKAIgEMYEIgVBf0YNAiACQRhqIANqIAU6AAAgA0EBaiEDDAELCwJAIAAtADUEQCACIAIsABg2AhQMAQsgAkEYaiEGQQEhBQJAAkADQCAAKAIoIgMpAgAhCSAAKAIkIgcgAyACQRhqIAJBGGogBGoiCCACQRBqIAJBFGogBiACQQxqIAcoAgAoAhARDgBBf2oiA0ECSw0CAkACQCADQQFrDgIDAQALIAAoAiggCTcCACAEQQhGDQIgACgCIBDGBCIDQX9GDQIgCCADOgAAIARBAWohBAwBCwsgAiACLAAYNgIUDAELQQAhBUF/IQMLIAVFDQQLIAENAQNAIARBAUgNAyAEQX9qIgQgAkEYamosAAAgACgCIBC4BUF/Rw0ACwtBfyEDDAILIAAgAigCFDYCMAsgAigCFCEDCyACQSBqJAAgAwsJACAAQQEQzwULhgIBA38jAEEgayICJAAgAC0ANCEEAkAgAUF/RgRAIAEhAyAEDQEgACAAKAIwIgNBf0ZBAXM6ADQMAQsgBARAIAIgACgCMDYCEAJ/AkAgACgCJCIDIAAoAiggAkEQaiACQRRqIAJBDGogAkEYaiACQSBqIAJBFGogAygCACgCDBEOAEF/aiIDQQJNBEAgA0ECaw0BIAAoAjAhAyACIAJBGWo2AhQgAiADOgAYCwNAQQEgAigCFCIDIAJBGGpNDQIaIAIgA0F/aiIDNgIUIAMsAAAgACgCIBC4BUF/Rw0ACwtBfyEDQQALRQ0BCyAAQQE6ADQgACABNgIwIAEhAwsgAkEgaiQAIAMLLgAgACAAKAIAKAIYEQAAGiAAIAEQxAUiATYCJCAAIAEgASgCACgCHBEAADoALAuSAQEFfyMAQRBrIgEkACABQRBqIQQCQANAIAAoAiQiAiAAKAIoIAFBCGogBCABQQRqIAIoAgAoAhQRBgAhA0F/IQIgAUEIakEBIAEoAgQgAUEIamsiBSAAKAIgEKUEIAVHDQEgA0F/aiIDQQFNBEAgA0EBaw0BDAILC0F/QQAgACgCIBDVBBshAgsgAUEQaiQAIAILVQEBfwJAIAAtACxFBEADQCADIAJODQIgACABLQAAIAAoAgAoAjQRAwBBf0YNAiABQQFqIQEgA0EBaiEDDAAACwALIAFBASACIAAoAiAQpQQhAwsgAwuKAgEFfyMAQSBrIgIkAAJ/AkACQCABQX9GDQAgAiABOgAXIAAtACwEQCACQRdqQQFBASAAKAIgEKUEQQFGDQEMAgsgAiACQRhqNgIQIAJBIGohBSACQRhqIQYgAkEXaiEDA0AgACgCJCIEIAAoAiggAyAGIAJBDGogAkEYaiAFIAJBEGogBCgCACgCDBEOACEEIAIoAgwgA0YNAiAEQQNGBEAgA0EBQQEgACgCIBClBEEBRw0DDAILIARBAUsNAiACQRhqQQEgAigCECACQRhqayIDIAAoAiAQpQQgA0cNAiACKAIMIQMgBEEBRg0ACwtBACABIAFBf0YbDAELQX8LIQAgAkEgaiQAIAALLgAgACAAKAIAKAIYEQAAGiAAIAEQxQUiATYCJCAAIAEgASgCACgCHBEAADoALAtVAQF/AkAgAC0ALEUEQANAIAMgAk4NAiAAIAEoAgAgACgCACgCNBEDAEF/Rg0CIAFBBGohASADQQFqIQMMAAALAAsgAUEEIAIgACgCIBClBCEDCyADC4oCAQV/IwBBIGsiAiQAAn8CQAJAIAFBf0YNACACIAE2AhQgAC0ALARAIAJBFGpBBEEBIAAoAiAQpQRBAUYNAQwCCyACIAJBGGo2AhAgAkEgaiEFIAJBGGohBiACQRRqIQMDQCAAKAIkIgQgACgCKCADIAYgAkEMaiACQRhqIAUgAkEQaiAEKAIAKAIMEQ4AIQQgAigCDCADRg0CIARBA0YEQCADQQFBASAAKAIgEKUEQQFHDQMMAgsgBEEBSw0CIAJBGGpBASACKAIQIAJBGGprIgMgACgCIBClBCADRw0CIAIoAgwhAyAEQQFGDQALC0EAIAEgAUF/RhsMAQtBfwshACACQSBqJAAgAAtGAgJ/AX4gACABNwNwIAAgACgCCCICIAAoAgQiA2usIgQ3A3gCQCABUA0AIAQgAVcNACAAIAMgAadqNgJoDwsgACACNgJoC8IBAgN/AX4CQAJAIAApA3AiBFBFBEAgACkDeCAEWQ0BCyAAENcEIgJBf0oNAQsgAEEANgJoQX8PCyAAKAIIIQECQAJAIAApA3AiBFANACAEIAApA3hCf4V8IgQgASAAKAIEIgNrrFkNACAAIAMgBKdqNgJoDAELIAAgATYCaAsCQCABRQRAIAAoAgQhAAwBCyAAIAApA3ggASAAKAIEIgBrQQFqrHw3A3gLIABBf2oiAC0AACACRwRAIAAgAjoAAAsgAgtsAQN+IAAgAkIgiCIDIAFCIIgiBH5CAHwgAkL/////D4MiAiABQv////8PgyIBfiIFQiCIIAIgBH58IgJCIIh8IAEgA34gAkL/////D4N8IgFCIIh8NwMIIAAgBUL/////D4MgAUIghoQ3AwAL+woCBX8EfiMAQRBrIgckAAJAAkACQAJAAkACQCABQSRNBEADQAJ/IAAoAgQiBCAAKAJoSQRAIAAgBEEBajYCBCAELQAADAELIAAQ2gULIgQiBUEgRiAFQXdqQQVJcg0ACwJAIARBVWoiBUECSw0AIAVBAWtFDQBBf0EAIARBLUYbIQYgACgCBCIEIAAoAmhJBEAgACAEQQFqNgIEIAQtAAAhBAwBCyAAENoFIQQLAkACQCABQW9xDQAgBEEwRw0AAn8gACgCBCIEIAAoAmhJBEAgACAEQQFqNgIEIAQtAAAMAQsgABDaBQsiBEEgckH4AEYEQAJ/IAAoAgQiASAAKAJoSQRAIAAgAUEBajYCBCABLQAADAELIAAQ2gULIQRBECEBIARB4ZoBai0AAEEQSQ0FIAAoAmhFBEBCACEDIAINCgwJCyAAIAAoAgQiAUF/ajYCBCACRQ0IIAAgAUF+ajYCBEIAIQMMCQsgAQ0BQQghAQwECyABQQogARsiASAEQeGaAWotAABLDQAgACgCaARAIAAgACgCBEF/ajYCBAtCACEDIABCABDZBUGA+wJBHDYCAAwHCyABQQpHDQIgBEFQaiICQQlNBEBBACEBA0AgAUEKbCEFAn8gACgCBCIBIAAoAmhJBEAgACABQQFqNgIEIAEtAAAMAQsgABDaBQshBCACIAVqIQEgBEFQaiICQQlNQQAgAUGZs+bMAUkbDQALIAGtIQkLIAJBCUsNASAJQgp+IQogAq0hCwNAAn8gACgCBCIBIAAoAmhJBEAgACABQQFqNgIEIAEtAAAMAQsgABDaBQshBCAKIAt8IQkgBEFQaiICQQlLDQIgCUKas+bMmbPmzBlaDQIgCUIKfiIKIAKtIgtCf4VYDQALQQohAQwDC0GA+wJBHDYCAEIAIQMMBQtBCiEBIAJBCU0NAQwCCyABIAFBf2pxBEAgASAEQeGaAWotAAAiAksEQEEAIQUDQCACIAEgBWxqIgVBxuPxOE1BACABAn8gACgCBCICIAAoAmhJBEAgACACQQFqNgIEIAItAAAMAQsgABDaBQsiBEHhmgFqLQAAIgJLGw0ACyAFrSEJCyABIAJNDQEgAa0hCgNAIAkgCn4iCyACrUL/AYMiDEJ/hVYNAgJ/IAAoAgQiAiAAKAJoSQRAIAAgAkEBajYCBCACLQAADAELIAAQ2gULIQQgCyAMfCEJIAEgBEHhmgFqLQAAIgJNDQIgByAKIAkQ2wUgBykDCFANAAsMAQsgAUEXbEEFdkEHcUHhnAFqLAAAIQggASAEQeGaAWotAAAiAksEQEEAIQUDQCACIAUgCHRyIgVB////P01BACABAn8gACgCBCICIAAoAmhJBEAgACACQQFqNgIEIAItAAAMAQsgABDaBQsiBEHhmgFqLQAAIgJLGw0ACyAFrSEJC0J/IAitIgqIIgsgCVQNACABIAJNDQADQCACrUL/AYMgCSAKhoQhCQJ/IAAoAgQiAiAAKAJoSQRAIAAgAkEBajYCBCACLQAADAELIAAQ2gULIQQgCSALVg0BIAEgBEHhmgFqLQAAIgJLDQALCyABIARB4ZoBai0AAE0NAANAIAECfyAAKAIEIgIgACgCaEkEQCAAIAJBAWo2AgQgAi0AAAwBCyAAENoFC0HhmgFqLQAASw0AC0GA+wJBxAA2AgAgBkEAIANCAYNQGyEGIAMhCQsgACgCaARAIAAgACgCBEF/ajYCBAsCQCAJIANUDQACQCADp0EBcQ0AIAYNAEGA+wJBxAA2AgAgA0J/fCEDDAMLIAkgA1gNAEGA+wJBxAA2AgAMAgsgCSAGrCIDhSADfSEDDAELQgAhAyAAQgAQ2QULIAdBEGokACADC+UCAQZ/IwBBEGsiByQAIANB9JMDIAMbIgUoAgAhAwJAAkACQCABRQRAIAMNAQwDC0F+IQQgAkUNAiAAIAdBDGogABshBgJAIAMEQCACIQAMAQsgAS0AACIAQRh0QRh1IgNBAE4EQCAGIAA2AgAgA0EARyEEDAQLIAEsAAAhAEH47wIoAgAoAgBFBEAgBiAAQf+/A3E2AgBBASEEDAQLIABB/wFxQb5+aiIAQTJLDQEgAEECdEHwnAFqKAIAIQMgAkF/aiIARQ0CIAFBAWohAQsgAS0AACIIQQN2IglBcGogA0EadSAJanJBB0sNAANAIABBf2ohACAIQYB/aiADQQZ0ciIDQQBOBEAgBUEANgIAIAYgAzYCACACIABrIQQMBAsgAEUNAiABQQFqIgEtAAAiCEHAAXFBgAFGDQALCyAFQQA2AgBBgPsCQRk2AgBBfyEEDAELIAUgAzYCAAsgB0EQaiQAIAQLywECBH8CfiMAQRBrIgMkACABvCIEQYCAgIB4cSEFAn4gBEH/////B3EiAkGAgIB8akH////3B00EQCACrUIZhkKAgICAgICAwD98DAELIAJBgICA/AdPBEAgBK1CGYZCgICAgICAwP//AIQMAQsgAkUEQEIADAELIAMgAq1CACACZyICQdEAahDaBCADKQMAIQYgAykDCEKAgICAgIDAAIVBif8AIAJrrUIwhoQLIQcgACAGNwMAIAAgByAFrUIghoQ3AwggA0EQaiQAC54LAgV/D34jAEHgAGsiBSQAIARCL4YgA0IRiIQhDyACQiCGIAFCIIiEIQ0gBEL///////8/gyIOQg+GIANCMYiEIRAgAiAEhUKAgICAgICAgIB/gyEKIA5CEYghESACQv///////z+DIgtCIIghEiAEQjCIp0H//wFxIQcCQAJ/IAJCMIinQf//AXEiCUF/akH9/wFNBEBBACAHQX9qQf7/AUkNARoLIAFQIAJC////////////AIMiDEKAgICAgIDA//8AVCAMQoCAgICAgMD//wBRG0UEQCACQoCAgICAgCCEIQoMAgsgA1AgBEL///////////8AgyICQoCAgICAgMD//wBUIAJCgICAgICAwP//AFEbRQRAIARCgICAgICAIIQhCiADIQEMAgsgASAMQoCAgICAgMD//wCFhFAEQCACIAOEUARAQoCAgICAgOD//wAhCkIAIQEMAwsgCkKAgICAgIDA//8AhCEKQgAhAQwCCyADIAJCgICAgICAwP//AIWEUARAIAEgDIQhAkIAIQEgAlAEQEKAgICAgIDg//8AIQoMAwsgCkKAgICAgIDA//8AhCEKDAILIAEgDIRQBEBCACEBDAILIAIgA4RQBEBCACEBDAILIAxC////////P1gEQCAFQdAAaiABIAsgASALIAtQIgYbeSAGQQZ0rXynIgZBcWoQ2gQgBSkDWCILQiCGIAUpA1AiAUIgiIQhDSALQiCIIRJBECAGayEGCyAGIAJC////////P1YNABogBUFAayADIA4gAyAOIA5QIggbeSAIQQZ0rXynIghBcWoQ2gQgBSkDSCICQg+GIAUpA0AiA0IxiIQhECACQi+GIANCEYiEIQ8gAkIRiCERIAYgCGtBEGoLIQYgD0L/////D4MiAiABQv////8PgyIBfiIPIANCD4ZCgID+/w+DIgMgDUL/////D4MiDH58IgRCIIYiDiABIAN+fCINIA5UrSACIAx+IhUgAyALQv////8PgyILfnwiEyAQQv////8PgyIOIAF+fCIQIAQgD1StQiCGIARCIIiEfCIUIAIgC34iFiADIBJCgIAEhCIPfnwiAyAMIA5+fCISIAEgEUL/////B4NCgICAgAiEIgF+fCIRQiCGfCIXfCEEIAcgCWogBmpBgYB/aiEGAkAgCyAOfiIYIAIgD358IgIgGFStIAIgASAMfnwiDCACVK18IAwgEyAVVK0gECATVK18fCICIAxUrXwgASAPfnwgASALfiILIA4gD358IgEgC1StQiCGIAFCIIiEfCACIAFCIIZ8IgEgAlStfCABIBEgElStIAMgFlStIBIgA1StfHxCIIYgEUIgiIR8IgMgAVStfCADIBQgEFStIBcgFFStfHwiAiADVK18IgFCgICAgICAwACDUEUEQCAGQQFqIQYMAQsgDUI/iCEDIAFCAYYgAkI/iIQhASACQgGGIARCP4iEIQIgDUIBhiENIAMgBEIBhoQhBAsgBkH//wFOBEAgCkKAgICAgIDA//8AhCEKQgAhAQwBCwJ+IAZBAEwEQEEBIAZrIgdB/wBNBEAgBUEQaiANIAQgBxDZBCAFQSBqIAIgASAGQf8AaiIGENoEIAVBMGogDSAEIAYQ2gQgBSACIAEgBxDZBCAFKQMwIAUpAziEQgBSrSAFKQMgIAUpAxCEhCENIAUpAyggBSkDGIQhBCAFKQMAIQIgBSkDCAwCC0IAIQEMAgsgAUL///////8/gyAGrUIwhoQLIAqEIQogDVAgBEJ/VSAEQoCAgICAgICAgH9RG0UEQCAKIAJCAXwiASACVK18IQoMAQsgDSAEQoCAgICAgICAgH+FhFBFBEAgAiEBDAELIAogAiACQgGDfCIBIAJUrXwhCgsgACABNwMAIAAgCjcDCCAFQeAAaiQAC38CAn8BfiMAQRBrIgMkACAAAn4gAUUEQEIADAELIAMgASABQR91IgJqIAJzIgKtQgAgAmciAkHRAGoQ2gQgAykDCEKAgICAgIDAAIVBnoABIAJrrUIwhnwgAUGAgICAeHGtQiCGhCEEIAMpAwALNwMAIAAgBDcDCCADQRBqJAALyAkCBH8EfiMAQfAAayIFJAAgBEL///////////8AgyEKAkACQCABQn98IgtCf1EgAkL///////////8AgyIJIAsgAVStfEJ/fCILQv///////7///wBWIAtC////////v///AFEbRQRAIANCf3wiC0J/UiAKIAsgA1StfEJ/fCILQv///////7///wBUIAtC////////v///AFEbDQELIAFQIAlCgICAgICAwP//AFQgCUKAgICAgIDA//8AURtFBEAgAkKAgICAgIAghCEEIAEhAwwCCyADUCAKQoCAgICAgMD//wBUIApCgICAgICAwP//AFEbRQRAIARCgICAgICAIIQhBAwCCyABIAlCgICAgICAwP//AIWEUARAQoCAgICAgOD//wAgAiABIAOFIAIgBIVCgICAgICAgICAf4WEUCIGGyEEQgAgASAGGyEDDAILIAMgCkKAgICAgIDA//8AhYRQDQEgASAJhFAEQCADIAqEQgBSDQIgASADgyEDIAIgBIMhBAwCCyADIAqEUEUNACABIQMgAiEEDAELIAMgASADIAFWIAogCVYgCSAKURsiBxshCiAEIAIgBxsiC0L///////8/gyEJIAIgBCAHGyICQjCIp0H//wFxIQggC0IwiKdB//8BcSIGRQRAIAVB4ABqIAogCSAKIAkgCVAiBht5IAZBBnStfKciBkFxahDaBCAFKQNoIQkgBSkDYCEKQRAgBmshBgsgASADIAcbIQMgAkL///////8/gyEBIAgEfiABBSAFQdAAaiADIAEgAyABIAFQIgcbeSAHQQZ0rXynIgdBcWoQ2gRBECAHayEIIAUpA1AhAyAFKQNYC0IDhiADQj2IhEKAgICAgICABIQhBCAJQgOGIApCPYiEIQEgAiALhSEMAn4gA0IDhiIDIAYgCGsiB0UNABogB0H/AEsEQEIAIQRCAQwBCyAFQUBrIAMgBEGAASAHaxDaBCAFQTBqIAMgBCAHENkEIAUpAzghBCAFKQMwIAUpA0AgBSkDSIRCAFKthAshAyABQoCAgICAgIAEhCEJIApCA4YhAgJAIAxCf1cEQCACIAN9IgEgCSAEfSACIANUrX0iA4RQBEBCACEDQgAhBAwDCyADQv////////8DVg0BIAVBIGogASADIAEgAyADUCIHG3kgB0EGdK18p0F0aiIHENoEIAYgB2shBiAFKQMoIQMgBSkDICEBDAELIAIgA3wiASADVK0gBCAJfHwiA0KAgICAgICACINQDQAgAUIBgyADQj+GIAFCAYiEhCEBIAZBAWohBiADQgGIIQMLIAtCgICAgICAgICAf4MhAiAGQf//AU4EQCACQoCAgICAgMD//wCEIQRCACEDDAELQQAhBwJAIAZBAEoEQCAGIQcMAQsgBUEQaiABIAMgBkH/AGoQ2gQgBSABIANBASAGaxDZBCAFKQMAIAUpAxAgBSkDGIRCAFKthCEBIAUpAwghAwsgA0I9hiABQgOIhCIEIAGnQQdxIgZBBEutfCIBIARUrSADQgOIQv///////z+DIAKEIAetQjCGhHwgASABQgGDQgAgBkEERhsiAXwiAyABVK18IQQLIAAgAzcDACAAIAQ3AwggBUHwAGokAAuBAgICfwR+IwBBEGsiAiQAIAG9IgVCgICAgICAgICAf4MhBwJ+IAVC////////////AIMiBEKAgICAgICAeHxC/////////+//AFgEQCAEQjyGIQYgBEIEiEKAgICAgICAgDx8DAELIARCgICAgICAgPj/AFoEQCAFQjyGIQYgBUIEiEKAgICAgIDA//8AhAwBCyAEUARAQgAMAQsgAiAEQgAgBEKAgICAEFoEfyAEQiCIp2cFIAWnZ0EgagsiA0ExahDaBCACKQMAIQYgAikDCEKAgICAgIDAAIVBjPgAIANrrUIwhoQLIQQgACAGNwMAIAAgBCAHhDcDCCACQRBqJAAL2wECAX8CfkEBIQQCQCAAQgBSIAFC////////////AIMiBUKAgICAgIDA//8AViAFQoCAgICAgMD//wBRGw0AIAJCAFIgA0L///////////8AgyIGQoCAgICAgMD//wBWIAZCgICAgICAwP//AFEbDQAgACAChCAFIAaEhFAEQEEADwsgASADg0IAWQRAQX8hBCAAIAJUIAEgA1MgASADURsNASAAIAKFIAEgA4WEQgBSDwtBfyEEIAAgAlYgASADVSABIANRGw0AIAAgAoUgASADhYRCAFIhBAsgBAvYAQIBfwF+QX8hAgJAIABCAFIgAUL///////////8AgyIDQoCAgICAgMD//wBWIANCgICAgICAwP//AFEbDQAgACADQoCAgICAgID/P4SEUARAQQAPCyABQoCAgICAgID/P4NCAFkEQCAAQgBUIAFCgICAgICAgP8/UyABQoCAgICAgID/P1EbDQEgACABQoCAgICAgID/P4WEQgBSDwsgAEIAViABQoCAgICAgID/P1UgAUKAgICAgICA/z9RGw0AIAAgAUKAgICAgICA/z+FhEIAUiECCyACCzUAIAAgATcDACAAIAJC////////P4MgBEIwiKdBgIACcSACQjCIp0H//wFxcq1CMIaENwMIC2cCAX8BfiMAQRBrIgIkACAAAn4gAUUEQEIADAELIAIgAa1CAEHwACABZ0EfcyIBaxDaBCACKQMIQoCAgICAgMAAhSABQf//AGqtQjCGfCEDIAIpAwALNwMAIAAgAzcDCCACQRBqJAALRQEBfyMAQRBrIgUkACAFIAEgAiADIARCgICAgICAgICAf4UQ4QUgBSkDACEBIAAgBSkDCDcDCCAAIAE3AwAgBUEQaiQAC8QCAQF/IwBB0ABrIgQkAAJAIANBgIABTgRAIARBIGogASACQgBCgICAgICAgP//ABDfBSAEKQMoIQIgBCkDICEBIANB//8BSARAIANBgYB/aiEDDAILIARBEGogASACQgBCgICAgICAgP//ABDfBSADQf3/AiADQf3/AkgbQYKAfmohAyAEKQMYIQIgBCkDECEBDAELIANBgYB/Sg0AIARBQGsgASACQgBCgICAgICAwAAQ3wUgBCkDSCECIAQpA0AhASADQYOAfkoEQCADQf7/AGohAwwBCyAEQTBqIAEgAkIAQoCAgICAgMAAEN8FIANBhoB9IANBhoB9ShtB/P8BaiEDIAQpAzghAiAEKQMwIQELIAQgASACQgAgA0H//wBqrUIwhhDfBSAAIAQpAwg3AwggACAEKQMANwMAIARB0ABqJAALjhECBX8MfiMAQcABayIFJAAgBEL///////8/gyESIAJC////////P4MhDCACIASFQoCAgICAgICAgH+DIREgBEIwiKdB//8BcSEHAkACQAJAIAJCMIinQf//AXEiCUF/akH9/wFNBEAgB0F/akH+/wFJDQELIAFQIAJC////////////AIMiCkKAgICAgIDA//8AVCAKQoCAgICAgMD//wBRG0UEQCACQoCAgICAgCCEIREMAgsgA1AgBEL///////////8AgyICQoCAgICAgMD//wBUIAJCgICAgICAwP//AFEbRQRAIARCgICAgICAIIQhESADIQEMAgsgASAKQoCAgICAgMD//wCFhFAEQCADIAJCgICAgICAwP//AIWEUARAQgAhAUKAgICAgIDg//8AIREMAwsgEUKAgICAgIDA//8AhCERQgAhAQwCCyADIAJCgICAgICAwP//AIWEUARAQgAhAQwCCyABIAqEUA0CIAIgA4RQBEAgEUKAgICAgIDA//8AhCERQgAhAQwCCyAKQv///////z9YBEAgBUGwAWogASAMIAEgDCAMUCIGG3kgBkEGdK18pyIGQXFqENoEQRAgBmshBiAFKQO4ASEMIAUpA7ABIQELIAJC////////P1YNACAFQaABaiADIBIgAyASIBJQIggbeSAIQQZ0rXynIghBcWoQ2gQgBiAIakFwaiEGIAUpA6gBIRIgBSkDoAEhAwsgBUGQAWogEkKAgICAgIDAAIQiFEIPhiADQjGIhCICQoTJ+c6/5ryC9QAgAn0iBBDbBSAFQYABakIAIAUpA5gBfSAEENsFIAVB8ABqIAUpA4gBQgGGIAUpA4ABQj+IhCIEIAIQ2wUgBUHgAGogBEIAIAUpA3h9ENsFIAVB0ABqIAUpA2hCAYYgBSkDYEI/iIQiBCACENsFIAVBQGsgBEIAIAUpA1h9ENsFIAVBMGogBSkDSEIBhiAFKQNAQj+IhCIEIAIQ2wUgBUEgaiAEQgAgBSkDOH0Q2wUgBUEQaiAFKQMoQgGGIAUpAyBCP4iEIgQgAhDbBSAFIARCACAFKQMYfRDbBSAGIAkgB2tqIQYCfkIAIAUpAwhCAYYgBSkDAEI/iIRCf3wiCkL/////D4MiBCACQiCIIg5+IhAgCkIgiCIKIAJC/////w+DIgt+fCICQiCGIg0gBCALfnwiCyANVK0gCiAOfiACIBBUrUIghiACQiCIhHx8IAsgBCADQhGIQv////8PgyIOfiIQIAogA0IPhkKAgP7/D4MiDX58IgJCIIYiDyAEIA1+fCAPVK0gCiAOfiACIBBUrUIghiACQiCIhHx8fCICIAtUrXwgAkIAUq18fSILQv////8PgyIOIAR+IhAgCiAOfiINIAQgC0IgiCIPfnwiC0IghnwiDiAQVK0gCiAPfiALIA1UrUIghiALQiCIhHx8IA5CACACfSICQiCIIgsgBH4iECACQv////8PgyINIAp+fCICQiCGIg8gBCANfnwgD1StIAogC34gAiAQVK1CIIYgAkIgiIR8fHwiAiAOVK18IAJCfnwiECACVK18Qn98IgtC/////w+DIgIgDEIChiABQj6IhEL/////D4MiBH4iDiABQh6IQv////8PgyIKIAtCIIgiC358Ig0gDlStIA0gEEIgiCIOIAxCHohC///v/w+DQoCAEIQiDH58Ig8gDVStfCALIAx+fCACIAx+IhMgBCALfnwiDSATVK1CIIYgDUIgiIR8IA8gDUIghnwiDSAPVK18IA0gCiAOfiITIBBC/////w+DIhAgBH58Ig8gE1StIA8gAiABQgKGQvz///8PgyITfnwiFSAPVK18fCIPIA1UrXwgDyALIBN+IgsgDCAQfnwiDCAEIA5+fCIEIAIgCn58IgJCIIggAiAEVK0gDCALVK0gBCAMVK18fEIghoR8IgwgD1StfCAMIBUgDiATfiIEIAogEH58IgpCIIggCiAEVK1CIIaEfCIEIBVUrSAEIAJCIIZ8IARUrXx8IgQgDFStfCICQv////////8AWARAIAFCMYYgBEL/////D4MiASADQv////8PgyIKfiIMQgBSrX1CACAMfSIQIARCIIgiDCAKfiINIAEgA0IgiCILfnwiDkIghiIPVK19IAJC/////w+DIAp+IAEgEkL/////D4N+fCALIAx+fCAOIA1UrUIghiAOQiCIhHwgBCAUQiCIfiADIAJCIIh+fCACIAt+fCAMIBJ+fEIghnx9IRIgBkF/aiEGIBAgD30MAQsgBEIhiCELIAFCMIYgAkI/hiAEQgGIhCIEQv////8PgyIBIANC/////w+DIgp+IgxCAFKtfUIAIAx9Ig4gASADQiCIIgx+IhAgCyACQh+GhCINQv////8PgyIPIAp+fCILQiCGIhNUrX0gDCAPfiAKIAJCAYgiCkL/////D4N+fCABIBJC/////w+DfnwgCyAQVK1CIIYgC0IgiIR8IAQgFEIgiH4gAyAC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KAIEQX9qNgIEQoCAgICAgICAgH8PCyAGC7YDAgN/AX4jAEEgayIDJAACQCABQv///////////wCDIgVCgICAgICAwL9AfCAFQoCAgICAgMDAv398VARAIAFCGYinIQIgAFAgAUL///8PgyIFQoCAgAhUIAVCgICACFEbRQRAIAJBgYCAgARqIQIMAgsgAkGAgICABGohAiAAIAVCgICACIWEQgBSDQEgAkEBcSACaiECDAELIABQIAVCgICAgICAwP//AFQgBUKAgICAgIDA//8AURtFBEAgAUIZiKdB////AXFBgICA/gdyIQIMAQtBgICA/AchAiAFQv///////7+/wABWDQBBACECIAVCMIinIgRBkf4ASQ0AIAMgACABQv///////z+DQoCAgICAgMAAhCIFQYH/ACAEaxDZBCADQRBqIAAgBSAEQf+Bf2oQ2gQgAykDCCIAQhmIpyECIAMpAwAgAykDECADKQMYhEIAUq2EIgVQIABC////D4MiAEKAgIAIVCAAQoCAgAhRG0UEQCACQQFqIQIMAQsgBSAAQoCAgAiFhEIAUg0AIAJBAXEgAmohAgsgA0EgaiQAIAIgAUIgiKdBgICAgHhxcr4L8RMCDX8DfiMAQbACayIGJAAgACgCTEEATgR/QQEFQQALGgJAIAEtAAAiBEUNAAJAA0ACQAJAIARB/wFxIgNBIEYgA0F3akEFSXIEQANAIAEiBEEBaiEBIAQtAAEiA0EgRiADQXdqQQVJcg0ACyAAQgAQ2QUDQAJ/IAAoAgQiASAAKAJoSQRAIAAgAUEBajYCBCABLQAADAELIAAQ2gULIgFBIEYgAUF3akEFSXINAAsCQCAAKAJoRQRAIAAoAgQhAQwBCyAAIAAoAgRBf2oiATYCBAsgASAAKAIIa6wgACkDeCAQfHwhEAwBCwJAAkACQCABLQAAIgRBJUYEQCABLQABIgNBKkYNASADQSVHDQILIABCABDZBSABIARBJUZqIQQCfyAAKAIEIgEgACgCaEkEQCAAIAFBAWo2AgQgAS0AAAwBCyAAENoFCyIBIAQtAABHBEAgACgCaARAIAAgACgCBEF/ajYCBAtBACEMIAFBAE4NCAwFCyAQQgF8IRAMAwsgAUECaiEEQQAhBwwBCwJAIANBUGpBCk8NACABLQACQSRHDQAgAUEDaiEEIAIgAS0A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AgAPCyADIAJBBHI2AgALkAEBAn8jAEEQayIEJAAgBCABNgIIA0ACQCAAIARBCGoQngVFDQAgA0GAwAACfyAAKAIAIgEoAgwiBSABKAIQRgRAIAEgASgCACgCJBEAAAwBCyAFKAIACyADKAIAKAIMEQQARQ0AIAAQnwUaDAELCyAAIARBCGoQoAUEQCACIAIoAgBBAnI2AgALIARBEGokAAuuAQEBfwJ/IABBCGogACgCCCgCCBEAACIAIgYsAAtBAEgEQCAGKAIEDAELIAYtAAsLQQACfyAALAAXQQBIBEAgACgCEAwBCyAALQAXC2tGBEAgBCAEKAIAQQRyNgIADwsgAiADIAAgAEEYaiAFIARBABDCBiAAayEAAkAgASgCACICQQxHDQAgAA0AIAFBADYCAA8LAkAgAkELSg0AIABBDEcNACABIAJBDGo2AgALCzsAIAEgAiADIARBAhCgByEBIAMoAgAhAgJAIAFBPEoNACACQQRxDQAgACABNgIADwsgAyACQQRyNgIACzsAIAEgAiADIARBARCgByEBIAMoAgAhAgJAIAFBBkoNACACQQRxDQAgACABNgIADwsgAyACQQRyNgIACygAIAEgAiADIARBBBCgByEBIAMtAABBBHFFBEAgACABQZRxajYCAAsLSgAjAEGAAWsiAiQAIAIgAkH0AGo2AgwgAEEIaiACQRBqIAJBDGogBCAFIAYQrwcgAkEQaiACKAIMIAEQsQchACACQYABaiQAIAALYgEBfyMAQRBrIgYkACAGQQA6AA8gBiAFOgAOIAYgBDoADSAGQSU6AAwgBQRAIAZBDWogBkEOahCwBwsgAiABIAIoAgAgAWsgBkEMaiADIAAoAgAQHSABajYCACAGQRBqJAALNQEBfyMAQRBrIgIkACACIAAtAAA6AA8gACABLQAAOgAAIAEgAkEPai0AADoAACACQRBqJAALRQEBfyMAQRBrIgMkACADIAI2AggDQCAAIAFHBEAgA0EIaiAALAAAEK8FIABBAWohAAwBCwsgAygCCCEAIANBEGokACAAC0oAIwBBoANrIgIkACACIAJBoANqNgIMIABBCGogAkEQaiACQQxqIAQgBSAGELMHIAJBEGogAigCDCABELYHIQAgAkGgA2okACAAC38BAX8jAEGQAWsiBiQAIAYgBkGEAWo2AhwgACAGQSBqIAZBHGogAyAEIAUQrwcgBkIANwMQIAYgBkEgajYCDCABIAZBDGogAigCACABa0ECdSAGQRBqIAAoAgAQtAciAEF/RgRAELUHAAsgAiABIABBAnRqNgIAIAZBkAFqJAALYwEBfyMAQRBrIgUkACAFIAQ2AgwgBUEIaiAFQQxqEL8GIQQgACABIAIgAxCDBiEBIAQoAgAiAARAQfjvAigCABogAARAQfjvAkGs+wIgACAAQX9GGzYCAAsLIAVBEGokACABCwUAEB4AC0UBAX8jAEEQayIDJAAgAyACNgIIA0AgACABRwRAIANBCGogACgCABCxBSAAQQRqIQAMAQsLIAMoAgghACADQRBqJAAgAAsFAEH/AAsIACAAEJ4GGgsVACAAQgA3AgAgAEEANgIIIAAQkQkLDAAgAEGChoAgNgAACwgAQf////8HCwwAIABBAUEtEPUGGgvtBAEBfyMAQaACayIAJAAgACABNgKYAiAAIAI2ApACIABBvwU2AhAgAEGYAWogAEGgAWogAEEQahCZBiEHIAAgBCgCHCIBNgKQASABIAEoAgRBAWo2AgQgAEGQAWoQkAUhASAAQQA6AI8BAkAgAEGYAmogAiADIABBkAFqIAQoAgQgBSAAQY8BaiABIAcgAEGUAWogAEGEAmoQvgdFDQAgAEGrwQEoAAA2AIcBIABBpMEBKQAANwOAASABIABBgAFqIABBigFqIABB9gBqIAEoAgAoAiARCAAaIABBvgU2AhAgAEEIakEAIABBEGoQmQYhASAAQRBqIQICQCAAKAKUASAHKAIAa0HjAE4EQCAAKAKUASAHKAIAa0ECahDSCSEDIAEoAgAhAiABIAM2AgAgAgRAIAIgASgCBBEBAAsgASgCAEUNASABKAIAIQILIAAtAI8BBEAgAkEtOgAAIAJBAWohAgsgBygCACEEA0ACQCAEIAAoApQBTwRAIAJBADoAACAAIAY2AgAgAEEQaiAAEP0FQQFHDQEgASgCACECIAFBADYCACACBEAgAiABKAIEEQEACwwECyACIABB9gBqIABBgAFqIAQQvgYgAGsgAGotAAo6AAAgAkEBaiECIARBAWohBAwBCwsQtQcACxC1BwALIABBmAJqIABBkAJqEJQFBEAgBSAFKAIAQQJyNgIACyAAKAKYAiECAn8gACgCkAEiASABKAIE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BC0AACACRw0AIARBAWohBAwBCwsgBiAEIAMQxQcLIABBmAFqIABBkAFqEJQFBEAgBSAFKAIAQQJyNgIACyAAKAKYASEDAn8gACgCECICIAIoAgRBf2oiBDYCBCAEQX9GCwRAIAIgAigCACgCCBEBAAsgASgCACECIAFBADYCACACBEAgAiABKAIEEQEACyAAQaABaiQAIAMLWwECfyMAQRBrIgEkAAJAIAAsAAtBAEgEQCAAKAIAIQIgAUEAOgAPIAIgAS0ADzoAACAAQQA2AgQMAQsgAUEAOgAOIAAgAS0ADjoAACAAQQA6AAsLIAFBEGokAAusAwEFfyMAQSBrIgUkAAJ/IAAsAAtBAEgEQCAAKAIEDAELIAAtAAsLIQMgACwAC0EASAR/IAAoAghB/////wdxQX9qBUEKCyEEAkAgAiABayIGRQ0AAn8CfyAALAALQQBIBEAgACgCAAwBCyAACyEHIAECfyAALAALQQBIBEAgACgCAAwBCyAACwJ/IAAsAAtBAEgEQCAAKAIEDAELIAAtAAsLakkgByABTXELBEAgAAJ/An8gBUEQaiIAIgNCADcCACADQQA2AgggACABIAIQjwYgACIBLAALQQBICwRAIAEoAgAMAQsgAQsCfyAALAALQQBIBEAgACgCBAwBCyAALQALCxCPCSAAEIcJGgwBCyAEIANrIAZJBEAgACAEIAMgBmogBGsgAyADEI0JCwJ/IAAsAAtBAEgEQCAAKAIADAELIAALIANqIQQDQCABIAJHBEAgBCABLQAAOgAAIAFBAWohASAEQQFqIQQMAQsLIAVBADoADyAEIAUtAA86AAAgAyAGaiEBAkAgACwAC0EASARAIAAgATYCBAwBCyAAIAE6AAsLCyAFQSBqJAALCwAgAEHklAMQmAYLIAAgABD5CCAAIAEoAgg2AgggACABKQIANwIAIAEQvQYLCwAgAEHclAMQmAYLfgEBfyMAQSBrIgMkACADIAE2AhAgAyAANgIYIAMgAjYCCANAAkACf0EBIAMoAhggAygCEEZBAXNFDQAaIAMoAhgtAAAgAygCCC0AAEYNAUEACyEAIANBIGokACAADwsgAyADKAIYQQFqNgIYIAMgAygCCEEBajYCCAwAAAsACzQBAX8jAEEQayICJAAgAiAAKAIANgIIIAIgAigCCCABajYCCCACKAII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ARDVByIAIgEgASgCACgCLBECACACIAooAgA2AAAgCiAAIAAoAgAoAiARAgAgCCAKENQHIAoQhwkaIAogACAAKAIAKAIcEQIAIAcgChDUByAKEIcJGiADIAAgACgCACgCDBEAADYCACAEIAAgACgCACgCEBEAADYCACAKIAAgACgCACgCFBECACAFIAoQxwcgChCHCRogCiAAIAAoAgAoAhgRAgAgBiAKENQHIAoQhwkaIAAgACgCACgCJBEAAAs2AgAgCkEQaiQACx8BAX8gASgCABCjBSECIAAgASgCADYCBCAAIAI2AgAL/AIBAX8jAEHAA2siACQAIAAgATYCuAMgACACNgKwAyAAQb8FNgIUIABBGGogAEEgaiAAQRRqEJkGIQEgACAEKAIcIgc2AhAgByAHKAIEQQFqNgIEIABBEGoQnQUhByAAQQA6AA8gAEG4A2ogAiADIABBEGogBCgCBCAFIABBD2ogByABIABBFGogAEGwA2oQzQcEQCAGENEHIAAtAA8EQCAGIAdBLSAHKAIAKAIsEQMAEJcJCyAHQTAgBygCACgCLBEDACECIAEoAgAhBCAAKAIUIgNBfGohBwNAAkAgBCAHTw0AIAQoAgAgAkcNACAEQQRqIQQMAQsLIAYgBCADENIHCyAAQbgDaiAAQbADahCgBQRAIAUgBSgCAEECcjYCAAsgACgCuAMhAwJ/IAAoAhAiAiACKAIEQX9qIgQ2AgQgBEF/RgsEQCACIAIoAgAoAggRAQALIAEoAgAhAiABQQA2AgAgAgRAIAIgASgCBBEBAAsgAEHAA2okACADC1sBAn8jAEEQayIBJAACQCAALAALQQBIBEAgACgCACECIAFBADYCDCACIAEoAgw2AgAgAEEANgIEDAELIAFBADYCCCAAIAEoAgg2AgAgAEEAOgALCyABQRBqJAALrgMBBX8jAEEQayIDJAACfyAALAALQQBIBEAgACgCBAwBCyAALQALCyEFIAAsAAtBAEgEfyAAKAIIQf////8HcUF/agVBAQshBAJAIAIgAWtBAnUiBkUNAAJ/An8gACwAC0EASARAIAAoAgAMAQsgAAshByABAn8gACwAC0EASARAIAAoAgAMAQsgAAsCfyAALAALQQBIBEAgACgCBAwBCyAALQALC0ECdGpJIAcgAU1xCwRAIAACfwJ/IANCADcCACADQQA2AgggAyABIAIQkwYgAyIALAALQQBICwRAIAAoAgAMAQsgAAsCfyADLAALQQBIBEAgAygCBAwBCyADLQALCxCWCSADEIcJGgwBCyAEIAVrIAZJBEAgACAEIAUgBmogBGsgBSAFEJUJCwJ/IAAsAAtBAEgEQCAAKAIADAELIAALIAVBAnRqIQQDQCABIAJHBEAgBCABKAIANgIAIAFBBGohASAEQQRqIQQMAQsLIANBADYCACAEIAMoAgA2AgAgBSAGaiEBAkAgACwAC0EASARAIAAgATYCBAwBCyAAIAE6AAsLCyADQRBqJAALCwAgAEH0lAMQmAYLIAAgABD6CCAAIAEoAgg2AgggACABKQIANwIAIAEQvQYLCwAgAEHslAMQmAYLfgEBfyMAQSBrIgMkACADIAE2AhAgAyAANgIYIAMgAjYCCANAAkACf0EBIAMoAhggAygCEEZBAXNFDQAaIAMoAhgoAgAgAygCCCgCAEYNAUEACyEAIANBIGokACAADwsgAyADKAIYQQRqNgIYIAMgAygCCEEEajYCCAwAAAsACzcBAX8jAEEQayICJAAgAiAAKAIANgIIIAIgAigCCCABQQJ0ajYCCCACKAIIIQAgAkEQaiQAIAAL9AYBC38jAEHQA2siACQAIAAgBTcDECAAIAY3AxggACAAQeACajYC3AIgAEHgAmogAEEQahD+BSEJIABBvgU2AvABIABB6AFqQQAgAEHwAWoQmQYhCyAAQb4FNgLwASAAQeABakEAIABB8AFqEJkGIQogAEHwAWohDAJAIAlB5ABPBEAQuwYhByAAIAU3AwAgACAGNwMIIABB3AJqIAdBr8EBIAAQ6wYhCSAAKALcAiIIRQ0BIAsoAgAhByALIAg2AgAgBwRAIAcgCygCBBEBAAsgCRDSCSEIIAooAgAhByAKIAg2AgAgBwRAIAcgCigCBBEBAAsgCigCAEEAR0EBcw0BIAooAgAhDAsgACADKAIcIgc2AtgBIAcgBygCBEEBajYCBCAAQdgBahCQBSIRIgcgACgC3AIiCCAIIAlqIAwgBygCACgCIBEIABogAgJ/IAkEQCAAKALcAi0AAEEtRiEPCyAPCyAAQdgBaiAAQdABaiAAQc8BaiAAQc4BaiAAQcABahCeBiIQIABBsAFqEJ4GIg0gAEGgAWoQngYiByAAQZwBahDZByAAQb4FNgIwIABBKGpBACAAQTBqEJkGIQgCfyAJIAAoApwBIgJKBEACfyAHLAALQQBIBEAgBygCBAwBCyAHLQALCyAJIAJrQQF0QQFyagwBCwJ/IAcsAAtBAEgEQCAHKAIEDAELIActAAsLQQJqCyEOIABBMGohAiAAKAKcAQJ/IA0sAAtBAEgEQCANKAIEDAELIA0tAAsLIA5qaiIOQeUATwRAIA4Q0gkhDiAIKAIAIQIgCCAONgIAIAIEQCACIAgoAgQRAQALIAgoAgAiAkUNAQsgAiAAQSRqIABBIGogAygCBCAMIAkgDGogESAPIABB0AFqIAAsAM8BIAAsAM4BIBAgDSAHIAAoApwBENoHIAEgAiAAKAIkIAAoAiAgAyAEEOADIQIgCCgCACEBIAhBADYCACABBEAgASAIKAIEEQEACyAHEIcJGiANEIcJGiAQEIcJGgJ/IAAoAtgBIgEgASgCBEF/aiIDNgIEIANBf0YLBEAgASABKAIAKAIIEQEACyAKKAIAIQEgCkEANgIAIAEEQCABIAooAgQRAQALIAsoAgAhASALQQA2AgAgAQRAIAEgCygCBBEBAAsgAEHQA2okACACDwsQtQcAC9EDAQF/IwBBEGsiCiQAIAkCfyAABEAgAhDGByEAAkAgAQRAIAogACAAKAIAKAIsEQIAIAMgCigCADYAACAKIAAgACgCACgCIBECAAwBCyAKIAAgACgCACgCKBECACADIAooAgA2AAAgCiAAIAAoAgAoAhwRAgALIAggChDHByAKEIcJGiAEIAAgACgCACgCDBEAADoAACAFIAAgACgCACgCEBEAADoAACAKIAAgACgCACgCFBECACAGIAoQxwcgChCHCRogCiAAIAAoAgAoAhgRAgAgByAKEMcHIAoQhwkaIAAgACgCACgCJBEAAAwBCyACEMgHIQACQCABBEAgCiAAIAAoAgAoAiwRAgAgAyAKKAIANgAAIAogACAAKAIAKAIgEQIADAELIAogACAAKAIAKAIoEQIAIAMgCigCADYAACAKIAAgACgCACgCHBECAAsgCCAKEMcHIAoQhwkaIAQgACAAKAIAKAIMEQAAOgAAIAUgACAAKAIAKAIQEQAAOgAAIAogACAAKAIAKAIUEQIAIAYgChDHByAKEIcJGiAKIAAgACgCACgCGBECACAHIAoQxwcgChCHCRogACAAKAIAKAIkEQAACzYCACAKQRBqJAAL8AcBCn8jAEEQayITJAAgAiAANgIAIANBgARxIRYDQAJAAkACQAJAIBRBBEYEQAJ/IA0sAAtBAEgEQCANKAIEDAELIA0tAAsLQQFLBEAgEyANENwGNgIIIAIgE0EIakEBEMoHIA0Q3QYgAigCABDbBzYCAAsgA0GwAXEiA0EQRg0CIANBIEcNASABIAIoAgA2AgAMAgsgCCAUaiwAACIPQQRLDQMCQAJAAkACQAJAIA9BAWsOBAEDAgQACyABIAIoAgA2AgAMBwsgASACKAIANgIAIAZBICAGKAIAKAIcEQMAIQ8gAiACKAIAIhBBAWo2AgAgECAPOgAADAYLAn8gDSwAC0EASARAIA0oAgQMAQsgDS0ACwtFDQUCfyANLAALQQBIBEAgDSgCAAwBCyANCy0AACEPIAIgAigCACIQQQFqNgIAIBAgDzoAAAwFCwJ/IAwsAAtBAEgEQCAMKAIEDAELIAwtAAsLRSEPIBZFDQQgDw0EIAIgDBDcBiAMEN0GIAIoAgAQ2wc2AgAMBAsgAigCACEXIARBAWogBCAHGyIEIREDQAJAIBEgBU8NACARLAAAIg9BAE4EfyAGKAIIIA9B/wFxQQF0ai8BAEGAEHFBAEcFQQALRQ0AIBFBAWohEQwBCwsgDiIPQQFOBEADQAJAIA9BAUgiEA0AIBEgBE0NACARQX9qIhEtAAAhECACIAIoAgAiEkEBajYCACASIBA6AAAgD0F/aiEPDAELCyAQBH9BAAUgBkEwIAYoAgAoAhwRAwALIRIDQCACIAIoAgAiEEEBajYCACAPQQFOBEAgECASOgAAIA9Bf2ohDwwBCwsgECAJOgAACyAEIBFGBEAgBkEwIAYoAgAoAhwRAwAhDyACIAIoAgAiEEEBajYCACAQIA86AAAMAwsCf0F/An8gCywAC0EASARAIAsoAgQMAQsgCy0ACwtFDQAaAn8gCywAC0EASARAIAsoAgAMAQsgCwssAAALIRJBACEPQQAhEANAIAQgEUYNAwJAIA8gEkcEQCAPIRUMAQsgAiACKAIAIhJBAWo2AgAgEiAKOgAAQQAhFSAQQQFqIhACfyALLAALQQBIBEAgCygCBAwBCyALLQALC08EQCAPIRIMAQsCfyALLAALQQBIBEAgCygCAAwBCyALCyAQai0AAEH/AEYEQEF/IRIMAQsCfyALLAALQQBIBEAgCygCAAwBCyALCyAQaiwAACESCyARQX9qIhEtAAAhDyACIAIoAgAiGEEBajYCACAYIA86AAAgFUEBaiEPDAAACwALIAEgADYCAAsgE0EQaiQADwsgFyACKAIAEOMGCyAUQQFqIRQMAAALAAsLACAAIAEgAhDiBwvSBQEHfyMAQcABayIAJAAgACADKAIcIgY2ArgBIAYgBigCBEEBajYCBCAAQbgBahCQBSEKIAICfwJ/IAUiAiwAC0EASARAIAIoAgQMAQsgAi0ACwsEQAJ/IAIsAAtBAEgEQCACKAIADAELIAILLQAAIApBLSAKKAIAKAIcEQMAQf8BcUYhCwsgCwsgAEG4AWogAEGwAWogAEGvAWogAEGuAWogAEGgAWoQngYiDCAAQZABahCeBiIJIABBgAFqEJ4GIgYgAEH8AGoQ2QcgAEG+BTYCECAAQQhqQQAgAEEQahCZBiEHAn8CfyACLAALQQBIBEAgBSgCBAwBCyAFLQALCyAAKAJ8SgRAAn8gBSwAC0EASARAIAUoAgQMAQsgBS0ACwshAiAAKAJ8IQgCfyAGLAALQQBIBEAgBigCBAwBCyAGLQALCyACIAhrQQF0akEBagwBCwJ/IAYsAAtBAEgEQCAGKAIEDAELIAYtAAsLQQJqCyEIIABBEGohAgJAIAAoAnwCfyAJLAALQQBIBEAgCSgCBAwBCyAJLQALCyAIamoiCEHlAEkNACAIENIJIQggBygCACECIAcgCDYCACACBEAgAiAHKAIEEQEACyAHKAIAIgINABC1BwALIAIgAEEEaiAAIAMoAgQCfyAFLAALQQBIBEAgBSgCAAwBCyAFCwJ/IAUsAAtBAEgEQCAFKAIADAELIAULAn8gBSwAC0EASARAIAUoAgQMAQsgBS0ACwtqIAogCyAAQbABaiAALACvASAALACuASAMIAkgBiAAKAJ8ENoHIAEgAiAAKAIEIAAoAgAgAyAEEOADIQIgBygCACEBIAdBADYCACABBEAgASAHKAIEEQEACyAGEIcJGiAJEIcJGiAMEIcJGgJ/IAAoArgBIgEgASgCBEF/aiIDNgIEIANBf0YLBEAgASABKAIAKAIIEQEACyAAQcABaiQAIAIL/QYBC38jAEGwCGsiACQAIAAgBTcDECAAIAY3AxggACAAQcAHajYCvAcgAEHAB2ogAEEQahD+BSEJIABBvgU2AqAEIABBmARqQQAgAEGgBGoQmQYhCyAAQb4FNgKgBCAAQZAEakEAIABBoARqEJkGIQogAEGgBGohDAJAIAlB5ABPBEAQuwYhByAAIAU3AwAgACAGNwMIIABBvAdqIAdBr8EBIAAQ6wYhCSAAKAK8ByIIRQ0BIAsoAgAhByALIAg2AgAgBwRAIAcgCygCBBEBAAsgCUECdBDSCSEIIAooAgAhByAKIAg2AgAgBwRAIAcgCigCBBEBAAsgCigCAEEAR0EBcw0BIAooAgAhDAsgACADKAIcIgc2AogEIAcgBygCBEEBajYCBCAAQYgEahCdBSIRIgcgACgCvAciCCAIIAlqIAwgBygCACgCMBEIABogAgJ/IAkEQCAAKAK8By0AAEEtRiEPCyAPCyAAQYgEaiAAQYAEaiAAQfwDaiAAQfgDaiAAQegDahCeBiIQIABB2ANqEJ4GIg0gAEHIA2oQngYiByAAQcQDahDeByAAQb4FNgIwIABBKGpBACAAQTBqEJkGIQgCfyAJIAAoAsQDIgJKBEACfyAHLAALQQBIBEAgBygCBAwBCyAHLQALCyAJIAJrQQF0QQFyagwBCwJ/IAcsAAtBAEgEQCAHKAIEDAELIActAAsLQQJqCyEOIABBMGohAiAAKALEAwJ/IA0sAAtBAEgEQCANKAIEDAELIA0tAAsLIA5qaiIOQeUATwRAIA5BAnQQ0gkhDiAIKAIAIQIgCCAONgIAIAIEQCACIAgoAgQRAQALIAgoAgAiAkUNAQsgAiAAQSRqIABBIGogAygCBCAMIAwgCUECdGogESAPIABBgARqIAAoAvwDIAAoAvgDIBAgDSAHIAAoAsQDEN8HIAEgAiAAKAIkIAAoAiAgAyAEEPMGIQIgCCgCACEBIAhBADYCACABBEAgASAIKAIEEQEACyAHEIcJGiANEIcJGiAQEIcJGgJ/IAAoAogEIgEgASgCBEF/aiIDNgIEIANBf0YLBEAgASABKAIAKAIIEQEACyAKKAIAIQEgCkEANgIAIAEEQCABIAooAgQRAQALIAsoAgAhASALQQA2AgAgAQRAIAEgCygCBBEBAAsgAEGwCGokACACDwsQtQcAC9EDAQF/IwBBEGsiCiQAIAkCfyAABEAgAhDTByEAAkAgAQRAIAogACAAKAIAKAIsEQIAIAMgCigCADYAACAKIAAgACgCACgCIBECAAwBCyAKIAAgACgCACgCKBECACADIAooAgA2AAAgCiAAIAAoAgAoAhwRAgALIAggChDUByAKEIcJGiAEIAAgACgCACgCDBEAADYCACAFIAAgACgCACgCEBEAADYCACAKIAAgACgCACgCFBECACAGIAoQxwcgChCHCRogCiAAIAAoAgAoAhgRAgAgByAKENQHIAoQhwkaIAAgACgCACgCJBEAAAwBCyACENUHIQACQCABBEAgCiAAIAAoAgAoAiwRAgAgAyAKKAIANgAAIAogACAAKAIAKAIgEQIADAELIAogACAAKAIAKAIoEQIAIAMgCigCADYAACAKIAAgACgCACgCHBECAAsgCCAKENQHIAoQhwkaIAQgACAAKAIAKAIMEQAANgIAIAUgACAAKAIAKAIQEQAANgIAIAogACAAKAIAKAIUEQIAIAYgChDHByAKEIcJGiAKIAAgACgCACgCGBECACAHIAoQ1AcgChCHCRogACAAKAIAKAIkEQAACzYCACAKQRBqJAAL6AcBCn8jAEEQayIUJAAgAiAANgIAIANBgARxIRYCQANAAkAgFUEERgRAAn8gDSwAC0EASARAIA0oAgQMAQsgDS0ACwtBAUsEQCAUIA0Q3AY2AgggAiAUQQhqQQEQ1wcgDRDwBiACKAIAEOAHNgIACyADQbABcSIDQRBGDQMgA0EgRw0BIAEgAigCADYCAAwDCwJAIAggFWosAAAiD0EESw0AAkACQAJAAkACQCAPQQFrDgQBAwIEAAsgASACKAIANgIADAQLIAEgAigCADYCACAGQSAgBigCACgCLBEDACEPIAIgAigCACIQQQRqNgIAIBAgDzYCAAwDCwJ/IA0sAAtBAEgEQCANKAIEDAELIA0tAAsLRQ0CAn8gDSwAC0EASARAIA0oAgAMAQsgDQsoAgAhDyACIAIoAgAiEEEEajYCACAQIA82AgAMAgsCfyAMLAALQQBIBEAgDCgCBAwBCyAMLQALC0UhDyAWRQ0BIA8NASACIAwQ3AYgDBDwBiACKAIAEOAHNgIADAELIAIoAgAhFyAEQQRqIAQgBxsiBCERA0ACQCARIAVPDQAgBkGAECARKAIAIAYoAgAoAgwRBABFDQAgEUEEaiER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CGoiASgCACACQQxqIgMoAgBJIQQgAEEQaiQAIAMgASAEGygCACEBCyACQRBqJAAgAQ8LEJkJAAtuAQN/IwBBEGsiBSQAIAVBADYCDCAAQQxqIgZBADYCACAGIAM2AgQgAQRAIAAoAhAgARDpCCEECyAAIAQ2AgAgACAEIAJBAnRqIgI2AgggACACNgIEIABBDGogBCABQQJ0ajYCACAFQRBqJAAgAAszAQF/IAAoAhAaIAAoAgghAgNAIAJBADYCACAAIAAoAghBBGoiAjYCCCABQX9qIgENAAsLZwEBf0GQogMQ+AdBsKIDQZCiAygCAEGUogMoAgAgAEEEaiIBEPQIQZCiAyABELUFQZSiAyAAQQhqELUFQaCiAyAAQQxqELUFIAAgACgCBDYCAEGUogMoAgBBkKIDKAIAa0ECdRDqCAsoACADIAMoAgAgAiABayIAayICNgIAIABBAU4EQCACIAEgABDeCRoLCwcAIAAoAgQLJQADQCABIAAoAghHBEAgACgCEBogACAAKAIIQXxqNgIIDAELCws4AQJ/IAAoAgAgACgCCCICQQF1aiEBIAAoAgQhACABIAJBAXEEfyABKAIAIABqKAIABSAACxEBAAseAEH/////AyAASQRAQeDuARDzAgALIABBAnQQgAkLUAEBfyAAEMQHIAAsAAtBAEgEQCAAKAIAIQEgACwAC0EASAR/IAAoAghB/////wdxQX9qBUEKCxogARDTCSAAQYCAgIB4NgIIIABBADoACwsLUAEBfyAAENEHIAAsAAtBAEgEQCAAKAIAIQEgACwAC0EASAR/IAAoAghB/////wdxQX9qBUEBCxogARDTCSAAQYCAgIB4NgIIIABBADoACwsLOgIBfwF+IwBBEGsiAyQAIAMgASACELsGEIwGIAMpAwAhBCAAIAMpAwg3AwggACAENwMAIANBEGokAAsDAAALRwEBfyAAQQhqIgEoAgBFBEAgACAAKAIAKAIQEQEADwsCfyABIAEoAgBBf2oiATYCACABQX9GCwRAIAAgACgCACgCEBEBAAsLBABBAAsuAANAIAAoAgBBAUYNAAsgACgCAEUEQCAAQQE2AgAgAUHBBREBACAAQX82AgALCzEBAn8gAEEBIAAbIQADQAJAIAAQ0gkiAQ0AQYykAygCACICRQ0AIAIRBwAMAQsLIAELOgEC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/gQgAiADaiICIQECQCAALAALQQBIBEAgACABNgIEDAELIAAgAToACwsgBUEAOgAPIAIgBGogBS0ADzoAAAwBCyAAIAQgAiADaiAEayADIANBACACIAEQiQkLIAVBEGokAAvBAQEDfyMAQRBrIgMkACADIAE6AA8CQAJAAkACQCAALAALQQBIBEAgACgCBCIEIAAoAghB/////wdxQX9qIgJGDQEMAwtBCiEEQQohAiAALQALIgFBCkcNAQsgACACQQEgAiACEI0JIAQhASAALAALQQBIDQELIAAiAiABQQFqOgALDAELIAAoAgAhAiAAIARBAWo2AgQgBCEBCyABIAJqIgAgAy0ADzoAACADQQA6AA4gACADLQAOOgABIANBEGokAAs7AQF/IwBBEGsiASQAAkAgAEEBOgALIABBAUEtEI4JIAFBADoADyAAIAEtAA86AAEgAUEQaiQADwALAAujAQEDfyMAQRBrIgQkAEHv////AyACTwRAAkAgAkEBTQRAIAAgAjoACyAAIQMMAQsgACACQQJPBH8gAkEEakF8cSIDIANBf2oiAyADQQJGGwVBAQtBAWoiBRD4CCIDNgIAIAAgBUGAgICAeHI2AgggACACNgIECyADIAEgAhCHBSAEQQA2AgwgAyACQQJ0aiAEKAIMNgIAIARBEGokAA8LEIQJAAvQAQEDfyMAQRBrIgQkAAJAIAAsAAtBAEgEfyAAKAIIQf////8HcUF/agVBAQsiAyACTwRAAn8gACwAC0EASARAIAAoAgAMAQsgAAsiBSEDIAIEfyADIAEgAhCDCQUgAwsaIARBADYCDCAFIAJBAnRqIAQoAgw2AgACQCAALAALQQBIBEAgACACNgIEDAELIAAgAjoACwsMAQsgACADIAIgA2sCfyAALAALQQBIBEAgACgCBAwBCyAALQALCyIAQQAgACACIAEQlAkLIARBEGokAAvlAgEFfyMAQRBrIggkACABQX9zQe////8DaiACTwRAAn8gACwAC0EASARAIAAoAgAMAQsgAAshCQJ/Qef///8BIAFLBEAgCCABQQF0NgIIIAggASACajYCDAJ/IwBBEGsiAiQAIAhBDGoiCigCACAIQQhqIgsoAgBJIQwgAkEQaiQAIAsgCiAMGygCACICQQJPCwR/IAJBBGpBfHEiAiACQX9qIgIgAkECRhsFQQELDAELQe7///8DC0EBaiIKEPgIIQIgBARAIAIgCSAEEIcFCyAGBEAgBEECdCACaiAHIAYQhwULIAMgBWsiAyAEayIHBEAgBEECdCIEIAJqIAZBAnRqIAQgCWogBUECdGogBxCHBQsgAUEBRwRAIAkQ0wkLIAAgAjYCACAAIApBgICAgHhyNgIIIAAgAyAGaiIANgIEIAhBADYCBCACIABBAnRqIAgoAgQ2AgAgCEEQaiQADwsQhAkAC5oCAQV/IwBBEGsiBSQAQe////8DIAFrIAJPBEACfyAALAALQQBIBEAgACgCAAwBCyAACyEGAn9B5////wEgAUsEQCAFIAFBAXQ2AgggBSABIAJqNgIMAn8jAEEQayICJAAgBUEMaiIHKAIAIAVBCGoiCCgCAEkhCSACQRBqJAAgCCAHIAkbKAIAIgJBAk8LBH8gAkEEakF8cSICIAJBf2oiAiACQQJGGwVBAQsMAQtB7v///wMLQQFqIgcQ+AghAiAEBEAgAiAGIAQQhwULIAMgBGsiAwRAIARBAnQiBCACaiAEIAZqIAMQhwULIAFBAUcEQCAGENMJCyAAIAI2AgAgACAHQYCAgIB4cjYCCCAFQRBqJAAPCxCECQAL3QEBA38jAEEQayIFJAACQCAALAALQQBIBH8gACgCCEH/////B3FBf2oFQQELIgQCfyAALAALQQBIBEAgACgCBAwBCyAALQALCyIDayACTwRAIAJFDQECfyAALAALQQBIBEAgACgCAAwBCyAACyIEIANBAnRqIAEgAhCHBSACIANqIgIhAQJAIAAsAAtBAEgEQCAAIAE2AgQMAQsgACABOgALCyAFQQA2AgwgBCACQQJ0aiAFKAIMNgIADAELIAAgBCACIANqIARrIAMgA0EAIAIgARCUCQsgBUEQaiQAC8QBAQN/IwBBEGsiAyQAIAMgATYCDAJAAkACQAJAIAAsAAtBAEgEQCAAKAIEIgQgACgCCEH/////B3FBf2oiAkYNAQwDC0EBIQRBASECIAAtAAsiAUEBRw0BCyAAIAJBASACIAIQlQkgBCEBIAAsAAtBAEgNAQsgACICIAFBAWo6AAsMAQsgACgCACECIAAgBEEBajYCBCAEIQELIAIgAUECdGoiACADKAIMNgIAIANBADYCCCAAIAMoAgg2AgQgA0EQaiQAC6wBAQN/IwBBEGsiBCQAQe////8DIAFPBEACQCABQQFNBEAgACABOgALIAAhAwwBCyAAIAFBAk8EfyABQQRqQXxxIgMgA0F/aiIDIANBAkYbBUEBC0EBaiIFEPgIIgM2AgAgACAFQYCAgIB4cjYCCCAAIAE2AgQLIAEEfyADIAIgARCCCQUgAwsaIARBADYCDCADIAFBAnRqIAQoAgw2AgAgBEEQaiQADwsQhAkACwoAQenwARDzAgALLwEBfyMAQRBrIgAkACAAQQA2AgxB2PIAKAIAIgBB8PABQQAQtQQaIAAQvAQQHgALBgAQmgkACwYAQY7xAQsVACAAQdTxATYCACAAQQRqEJ4JIAALLAEBfwJAIAAoAgBBdGoiACIBIAEoAghBf2oiATYCCCABQX9KDQAgABDTCQsLCgAgABCdCRDTCQsNACAAEJ0JGiAAENMJCwYAQcTyAQsLACAAIAFBABCjCQscACACRQRAIAAgAUYPCyAAKAIEIAEoAgQQ9QVFC6ABAQJ/IwBBQGoiAyQAQQEhBAJAIAAgAUEAEKMJDQBBACEEIAFFDQAgAUHU8wEQpQkiAUUNACADQX82AhQgAyAANgIQIANBADYCDCADIAE2AgggA0EYakEAQScQ3wkaIANBATYCOCABIANBCGogAigCAEEBIAEoAgAoAhwRCwAgAygCIEEBRw0AIAIgAygCGDYCAEEBIQQLIANBQGskACAEC6UCAQR/IwBBQGoiAiQAIAAoAgAiA0F4aigCACEFIANBfGooAgAhAyACQQA2AhQgAkGk8wE2AhAgAiAANgIMIAIgATYCCCACQRhqQQBBJxDfCRogACAFaiEAAkAgAyABQQAQowkEQCACQQE2AjggAyACQQhqIAAgAEEBQQAgAygCACgCFBENACAAQQAgAigCIEEBRhshBAwBCyADIAJBCGogAEEBQQAgAygCACgCGBEKACACKAIsIgBBAUsNACAAQQFrBEAgAigCHEEAIAIoAihBAUYbQQAgAigCJEEBRhtBACACKAIwQQFGGyEEDAELIAIoAiBBAUcEQCACKAIwDQEgAigCJEEBRw0BIAIoAihBAUcNAQsgAigCGCEECyACQUBrJAAgBAtdAQF/IAAoAhAiA0UEQCAAQQE2AiQgACACNgIYIAAgATYCEA8LAkAgASADRgRAIAAoAhhBAkcNASAAIAI2AhgPCyAAQQE6ADYgAEECNgIYIAAgACgCJEEBajYCJAsLGgAgACABKAIIQQAQowkEQCABIAIgAxCmCQsLMwAgACABKAIIQQAQowkEQCABIAIgAxCmCQ8LIAAoAggiACABIAIgAyAAKAIAKAIcEQsAC1IBAX8gACgCBCEEIAAoAgAiACABAn9BACACRQ0AGiAEQQh1IgEgBEEBcUUNABogAigCACABaigCAAsgAmogA0ECIARBAnEbIAAoAgAoAhwRCwALcAECfyAAIAEoAghBABCjCQRAIAEgAiADEKYJDwsgACgCDCEEIABBEGoiBSABIAIgAxCpCQJAIARBAkgNACAFIARBA3RqIQQgAEEYaiEAA0AgACABIAIgAxCpCSABLQA2DQEgAEEIaiIAIARJDQALCwtAAAJAIAAgASAALQAIQRhxBH9BAQVBACEAIAFFDQEgAUGE9AEQpQkiAUUNASABLQAIQRhxQQBHCxCjCSEACyAAC+kDAQR/IwBBQGoiBSQAAkACQAJAIAFBkPYBQQAQowkEQCACQQA2AgAMAQsgACABEKsJBEBBASEDIAIoAgAiAEUNAyACIAAoAgA2AgAMAwsgAUUNASABQbT0ARClCSIBRQ0CIAIoAgAiBARAIAIgBCgCADYCAAsgASgCCCIEIAAoAggiBkF/c3FBB3ENAiAEQX9zIAZxQeAAcQ0CQQEhAyAAKAIMIAEoAgxBABCjCQ0CIAAoAgxBhPYBQQAQowkEQCABKAIMIgBFDQMgAEHo9AEQpQlFIQMMAwsgACgCDCIERQ0BQQAhAyAEQbT0ARClCSIEBEAgAC0ACEEBcUUNAyAEIAEoAgwQrQkhAwwDCyAAKAIMIgRFDQIgBEGk9QEQpQkiBARAIAAtAAhBAXFFDQMgBCABKAIMEK4JIQMMAwsgACgCDCIARQ0CIABB1PMBEKUJIgRFDQIgASgCDCIARQ0CIABB1PMBEKUJIgBFDQIgBUF/NgIUIAUgBDYCECAFQQA2AgwgBSAANgIIIAVBGGpBAEEnEN8JGiAFQQE2AjggACAFQQhqIAIoAgBBASAAKAIAKAIcEQsAIAUoAiBBAUcNAiACKAIARQ0AIAIgBSgCGDYCAAtBASEDDAELQQAhAwsgBUFAayQAIAMLnAEBAn8CQANAIAFFBEBBAA8LIAFBtPQBEKUJIgFFDQEgASgCCCAAKAIIQX9zcQ0BIAAoAgwgASgCDEEAEKMJBEBBAQ8LIAAtAAhBAXFFDQEgACgCDCIDRQ0BIANBtPQBEKUJIgMEQCABKAIMIQEgAyEADAELCyAAKAIMIgBFDQAgAEGk9QEQpQkiAEUNACAAIAEoAgwQrgkhAgsgAgtPAQF/AkAgAUUNACABQaT1ARClCSIBRQ0AIAEoAgggACgCCEF/c3ENACAAKAIMIAEoAgxBABCjCUUNACAAKAIQIAEoAhBBABCjCSECCyACC6MBACAAQQE6ADUCQCAAKAIEIAJHDQAgAEEBOgA0IAAoAhAiAkUEQCAAQQE2AiQgACADNgIYIAAgATYCECADQQFHDQEgACgCMEEBRw0BIABBAToANg8LIAEgAkYEQCAAKAIYIgJBAkYEQCAAIAM2AhggAyECCyAAKAIwQQFHDQEgAkEBRw0BIABBAToANg8LIABBAToANiAAIAAoAiRBAWo2AiQLC70EAQR/IAAgASgCCCAEEKMJBEACQCABKAIEIAJHDQAgASgCHEEBRg0AIAEgAzYCHAsPCwJAIAAgASgCACAEEKMJBEACQCACIAEoAhBHBEAgASgCFCACRw0BCyADQQFHDQIgAUEBNgIgDwsgASADNgIgIAEoAixBBEcEQCAAQRBqIgUgACgCDEEDdGohCCABAn8CQANAAkAgBSAITw0AIAFBADsBNCAFIAEgAiACQQEgBBCxCSABLQA2DQACQCABLQA1RQ0AIAEtADQEQEEBIQMgASgCGEEBRg0EQQEhB0EBIQYgAC0ACEECcQ0BDAQLQQEhByAGIQMgAC0ACEEBcUUNAwsgBUEIaiEFDAELCyAGIQNBBCAHRQ0BGgtBAws2AiwgA0EBcQ0CCyABIAI2AhQgASABKAIoQQFqNgIoIAEoAiRBAUcNASABKAIYQQJHDQEgAUEBOgA2DwsgACgCDCEGIABBEGoiBSABIAIgAyAEELIJIAZBAkgNACAFIAZBA3RqIQYgAEEYaiEFAkAgACgCCCIAQQJxRQRAIAEoAiRBAUcNAQsDQCABLQA2DQIgBSABIAIgAyAEELIJIAVBCGoiBSAGSQ0ACwwBCyAAQQFxRQRAA0AgAS0ANg0CIAEoAiRBAUYNAiAFIAEgAiADIAQQsgkgBUEIaiIFIAZJDQAMAgALAAsDQCABLQA2DQEgASgCJEEBRgRAIAEoAhhBAUYNAgsgBSABIAIgAyAEELIJIAVBCGoiBSAGSQ0ACwsLSwECfyAAKAIEIgZBCHUhByAAKAIAIgAgASACIAZBAXEEfyADKAIAIAdqKAIABSAHCyADaiAEQQIgBkECcRsgBSAAKAIAKAIUEQ0AC0kBAn8gACgCBCIFQQh1IQYgACgCACIAIAEgBUEBcQR/IAIoAgAgBmooAgAFIAYLIAJqIANBAiAFQQJxGyAEIAAoAgAoAhgRCgALigIAIAAgASgCCCAEEKMJBEACQCABKAIEIAJHDQAgASgCHEEBRg0AIAEgAzYCHAsPCwJAIAAgASgCACAEEKMJBEACQCACIAEoAhBHBEAgASgCFCACRw0BCyADQQFHDQIgAUEBNgIgDwsgASADNgIgAkAgASgCLEEERg0AIAFBADsBNCAAKAIIIgAgASACIAJBASAEIAAoAgAoAhQRDQAgAS0ANQRAIAFBAzYCLCABLQA0RQ0BDAMLIAFBBDYCLAsgASACNgIUIAEgASgCKEEBajYCKCABKAIkQQFHDQEgASgCGEECRw0BIAFBAToANg8LIAAoAggiACABIAIgAyAEIAAoAgAoAhgRCgALC6kBACAAIAEoAgggBBCjCQRAAkAgASgCBCACRw0AIAEoAhxBAUYNACABIAM2AhwLDwsCQCAAIAEoAgAgBBCjCUUNAAJAIAIgASgCEEcEQCABKAIUIAJHDQELIANBAUcNASABQQE2AiAPCyABIAI2AhQgASADNgIgIAEgASgCKEEBajYCKAJAIAEoAiRBAUcNACABKAIYQQJHDQAgAUEBOgA2CyABQQQ2AiwLC5cCAQZ/IAAgASgCCCAFEKMJBEAgASACIAMgBBCvCQ8LIAEtADUhByAAKAIMIQYgAUEAOgA1IAEtADQhCCABQQA6ADQgAEEQaiIJIAEgAiADIAQgBRCxCSAHIAEtADUiCnIhByAIIAEtADQiC3IhCAJAIAZBAkgNACAJIAZBA3RqIQkgAEEYaiEGA0AgAS0ANg0BAkAgCwRAIAEoAhhBAUYNAyAALQAIQQJxDQEMAwsgCkUNACAALQAIQQFxRQ0CCyABQQA7ATQgBiABIAIgAyAEIAUQsQkgAS0ANSIKIAdyIQcgAS0ANCILIAhyIQggBkEIaiIGIAlJDQALCyABIAdB/wFxQQBHOgA1IAEgCEH/AXFBAEc6ADQLOQAgACABKAIIIAUQowkEQCABIAIgAyAEEK8JDwsgACgCCCIAIAEgAiADIAQgBSAAKAIAKAIUEQ0ACxwAIAAgASgCCCAFEKMJBEAgASACIAMgBBCvCQsLIwECfyAAEMcEQQFqIgEQ0gkiAkUEQEEADwsgAiAAIAEQ3gkLKgEBfyMAQRBrIgEkACABIAA2AgwgASgCDCgCBBC4CSEAIAFBEGokACAAC+ABAEGE9gFB8PkBEB9BnPYBQfX5AUEBQQFBABAgELsJELwJEL0JEL4JEL8JEMAJEMEJEMIJEMMJEMQJEMUJQaA0Qd/6ARAhQciAAkHr+gEQIUGggQJBBEGM+wEQIkH8gQJBAkGZ+wEQIkHYggJBBEGo+wEQIkHkGkG3+wEQIxDGCUHl+wEQxwlBivwBEMgJQbH8ARDJCUHQ/AEQyglB+PwBEMsJQZX9ARDMCRDNCRDOCUGA/gEQxwlBoP4BEMgJQcH+ARDJCUHi/gEQyglBhP8BEMsJQaX/ARDMCRDPCRDQCQswAQF/IwBBEGsiACQAIABB+vkBNgIMQaj2ASAAKAIMQQFBgH9B/wAQJCAAQRBqJAALMAEBfyMAQRBrIgAkACAAQf/5ATYCDEHA9gEgACgCDEEBQYB/Qf8AECQgAEEQaiQACy8BAX8jAEEQayIAJAAgAEGL+gE2AgxBtPYBIAAoAgxBAUEAQf8BECQgAEEQaiQACzIBAX8jAEEQayIAJAAgAEGZ+gE2AgxBzPYBIAAoAgxBAkGAgH5B//8BECQgAEEQaiQACzABAX8jAEEQayIAJAAgAEGf+gE2AgxB2PYBIAAoAgxBAkEAQf//AxAkIABBEGokAAs2AQF/IwBBEGsiACQAIABBrvoBNgIMQeT2ASAAKAIMQQRBgICAgHhB/////wcQJCAAQRBqJAALLgEBfyMAQRBrIgAkACAAQbL6ATYCDEHw9gEgACgCDEEEQQBBfxAkIABBEGokAAs2AQF/IwBBEGsiACQAIABBv/oBNgIMQfz2ASAAKAIMQQRBgICAgHhB/////wcQJCAAQRBqJAALLgEBfyMAQRBrIgAkACAAQcT6ATYCDEGI9wEgACgCDEEEQQBBfxAkIABBEGokAAsqAQF/IwBBEGsiACQAIABB0voBNgIMQZT3ASAAKAIMQQQQJSAAQRBqJAALKgEBfyMAQRBrIgAkACAAQdj6ATYCDEGg9wEgACgCDEEIECUgAEEQaiQACyoBAX8jAEEQayIAJAAgAEHH+wE2AgxBkIMCQQAgACgCDBAmIABBEGokAAsoAQF/IwBBEGsiASQAIAEgADYCDEG4gwJBACABKAIMECYgAUEQaiQACygBAX8jAEEQayIBJAAgASAANgIMQeCDAkEBIAEoAgwQJiABQRBqJAALKAEBfyMAQRBrIgEkACABIAA2AgxBiIQCQQIgASgCDBAmIAFBEGokAAsoAQF/IwBBEGsiASQAIAEgADYCDEGwhAJBAyABKAIMECYgAUEQaiQACygBAX8jAEEQayIBJAAgASAANgIMQdiEAkEEIAEoAgwQJiABQRBqJAALKAEBfyMAQRBrIgEkACABIAA2AgxBgIUCQQUgASgCDBAmIAFBEGokAAsqAQF/IwBBEGsiACQAIABBu/0BNgIMQaiFAkEEIAAoAgwQJiAAQRBqJAALKgEBfyMAQRBrIgAkACAAQdn9ATYCDEHQhQJBBSAAKAIMECYgAEEQaiQACyoBAX8jAEEQayIAJAAgAEHH/wE2AgxB+IUCQQYgACgCDBAmIABBEGokAAsqAQF/IwBBEGsiACQAIABB5v8BNgIMQaCGAkEHIAAoAgwQJiAAQRBqJAALJwEBfyMAQRBrIgEkACABIAA2AgwgASgCDCEAELoJIAFBEGokACAAC6wyAQ1/IwBBEGsiDCQAAkACQAJAAkAgAEH0AU0EQEGUpAMoAgAiBkEQIABBC2pBeHEgAEELSRsiB0EDdiIAdiIBQQNxBEACQCABQX9zQQFxIABqIgJBA3QiA0HEpANqKAIAIgEoAggiACADQbykA2oiA0YEQEGUpAMgBkF+IAJ3cTYCAAwBC0GkpAMoAgAgAEsNBCAAKAIMIAFHDQQgACADNgIMIAMgADYCCAsgAUEIaiEAIAEgAkEDdCICQQNyNgIEIAEgAmoiASABKAIEQQFyNgIEDAULIAdBnKQDKAIAIglNDQEgAQRAAkBBAiAAdCICQQAgAmtyIAEgAHRxIgBBACAAa3FBf2oiACAAQQx2QRBxIgB2IgFBBXZBCHEiAiAAciABIAJ2IgBBAnZBBHEiAXIgACABdiIAQQF2QQJxIgFyIAAgAXYiAEEBdkEBcSIBciAAIAF2aiICQQN0IgNBxKQDaigCACIBKAIIIgAgA0G8pANqIgNGBEBBlKQDIAZBfiACd3EiBjYCAAwBC0GkpAMoAgAgAEsNBCAAKAIMIAFHDQQgACADNgIMIAMgADYCCAsgASAHQQNyNgIEIAEgB2oiBSACQQN0IgAgB2siA0EBcjYCBCAAIAFqIAM2AgAgCQRAIAlBA3YiBEEDdEG8pANqIQBBqKQDKAIAIQICQCAGQQEgBHQiBHFFBEBBlKQDIAQgBnI2AgAgACEEDAELQaSkAygCACAAKAIIIgRLDQULIAAgAjYCCCAEIAI2AgwgAiAANgIMIAIgBDYCCAsgAUEIaiEAQaikAyAFNgIAQZykAyADNgIADAULQZikAygCACIKRQ0BIApBACAKa3FBf2oiACAAQQx2QRBxIgB2IgFBBXZBCHEiAiAAciABIAJ2IgBBAnZBBHEiAXIgACABdiIAQQF2QQJxIgFyIAAgAXYiAEEBdkEBcSIBciAAIAF2akECdEHEpgNqKAIAIgEoAgRBeHEgB2shAiABIQMDQAJAIAMoAhAiAEUEQCADKAIUIgBFDQELIAAoAgRBeHEgB2siAyACIAMgAkkiAxshAiAAIAEgAxshASAAIQMMAQsLQaSkAygCACINIAFLDQIgASAHaiILIAFNDQIgASgCGCEIAkAgASABKAIMIgRHBEAgDSABKAIIIgBLDQQgACgCDCABRw0EIAQoAgggAUcNBCAAIAQ2AgwgBCAANgIIDAELAkAgAUEUaiIDKAIAIgBFBEAgASgCECIARQ0BIAFBEGohAwsDQCADIQUgACIEQRRqIgMoAgAiAA0AIARBEGohAyAEKAIQIgANAAsgDSAFSw0EIAVBADYCAAwBC0EAIQQLAkAgCEUNAAJAIAEoAhwiAEECdEHEpgNqIgMoAgAgAUYEQCADIAQ2AgAgBA0BQZikAyAKQX4gAHdxNgIADAILQaSkAygCACAISw0EIAhBEEEUIAgoAhAgAUYbaiAENgIAIARFDQELQaSkAygCACIDIARLDQMgBCAINgIYIAEoAhAiAARAIAMgAEsNBCAEIAA2AhAgACAENgIYCyABKAIUIgBFDQBBpKQDKAIAIABLDQMgBCAANgIUIAAgBDYCGAsCQCACQQ9NBEAgASACIAdqIgBBA3I2AgQgACABaiIAIAAoAgRBAXI2AgQMAQsgASAHQQNyNgIEIAsgAkEBcjYCBCACIAtqIAI2AgAgCQRAIAlBA3YiBEEDdEG8pANqIQBBqKQDKAIAIQMCQEEBIAR0IgQgBnFFBEBBlKQDIAQgBnI2AgAgACEHDAELQaSkAygCACAAKAIIIgdLDQULIAAgAzYCCCAHIAM2AgwgAyAANgIMIAMgBzYCCAtBqKQDIAs2AgBBnKQDIAI2AgALIAFBCGohAAwEC0F/IQcgAEG/f0sNACAAQQtqIgBBeHEhB0GYpAMoAgAiCEUNAEEAIAdrIQMCQAJAAkACf0EAIABBCHYiAEUNABpBHyAHQf///wdLDQAaIAAgAEGA/j9qQRB2QQhxIgB0IgEgAUGA4B9qQRB2QQRxIgF0IgIgAkGAgA9qQRB2QQJxIgJ0QQ92IAAgAXIgAnJrIgBBAXQgByAAQRVqdkEBcXJBHGoLIgVBAnRBxKYDaigCACICRQRAQQAhAAwBCyAHQQBBGSAFQQF2ayAFQR9GG3QhAUEAIQADQAJAIAIoAgRBeHEgB2siBiADTw0AIAIhBCAGIgMNAEEAIQMgAiEADAMLIAAgAigCFCIGIAYgAiABQR12QQRxaigCECICRhsgACAGGyEAIAEgAkEAR3QhASACDQALCyAAIARyRQRAQQIgBXQiAEEAIABrciAIcSIARQ0DIABBACAAa3FBf2oiACAAQQx2QRBxIgB2IgFBBXZBCHEiAiAAciABIAJ2IgBBAnZBBHEiAXIgACABdiIAQQF2QQJxIgFyIAAgAXYiAEEBdkEBcSIBciAAIAF2akECdEHEpgNqKAIAIQALIABFDQELA0AgACgCBEF4cSAHayICIANJIQEgAiADIAEbIQMgACAEIAEbIQQgACgCECIBBH8gAQUgACgCFAsiAA0ACwsgBEUNACADQZykAygCACAHa08NAEGkpAMoAgAiCiAESw0BIAQgB2oiBSAETQ0BIAQoAhghCQJAIAQgBCgCDCIBRwRAIAogBCgCCCIASw0DIAAoAgwgBEcNAyABKAIIIARHDQMgACABNgIMIAEgADYCCAwBCwJAIARBFGoiAigCACIARQRAIAQoAhAiAEUNASAEQRBqIQILA0AgAiEGIAAiAUEUaiICKAIAIgANACABQRBqIQIgASgCECIADQALIAogBksNAyAGQQA2AgAMAQtBACEBCwJAIAlFDQACQCAEKAIcIgBBAnRBxKYDaiICKAIAIARGBEAgAiABNgIAIAENAUGYpAMgCEF+IAB3cSIINgIADAILQaSkAygCACAJSw0DIAlBEEEUIAkoAhAgBEYbaiABNgIAIAFFDQELQaSkAygCACICIAFLDQIgASAJNgIYIAQoAhAiAARAIAIgAEsNAyABIAA2AhAgACABNgIYCyAEKAIUIgBFDQBBpKQDKAIAIABLDQIgASAANgIUIAAgATYCGAsCQCADQQ9NBEAgBCADIAdqIgBBA3I2AgQgACAEaiIAIAAoAgRBAXI2AgQMAQsgBCAHQQNyNgIEIAUgA0EBcjYCBCADIAVqIAM2AgAgA0H/AU0EQCADQQN2IgFBA3RBvKQDaiEAAkBBlKQDKAIAIgJBASABdCIBcUUEQEGUpAMgASACcjYCACAAIQIMAQtBpKQDKAIAIAAoAggiAksNBAsgACAFNgIIIAIgBTYCDCAFIAA2AgwgBSACNgIIDAELIAUCf0EAIANBCHYiAEUNABpBHyADQf///wdLDQAaIAAgAEGA/j9qQRB2QQhxIgB0IgEgAUGA4B9qQRB2QQRxIgF0IgIgAkGAgA9qQRB2QQJxIgJ0QQ92IAAgAXIgAnJrIgBBAXQgAyAAQRVqdkEBcXJBHGoLIgA2AhwgBUIANwIQIABBAnRBxKYDaiEBAkACQCAIQQEgAHQiAnFFBEBBmKQDIAIgCHI2AgAgASAFNgIADAELIANBAEEZIABBAXZrIABBH0YbdCEAIAEoAgAhBwNAIAciASgCBEF4cSADRg0CIABBHXYhAiAAQQF0IQAgASACQQRxakEQaiICKAIAIgcNAAtBpKQDKAIAIAJLDQQgAiAFNgIACyAFIAE2AhggBSAFNgIMIAUgBTYCCAwBC0GkpAMoAgAiACABSw0CIAAgASgCCCIASw0CIAAgBTYCDCABIAU2AgggBUEANgIYIAUgATYCDCAFIAA2AggLIARBCGohAAwDC0GcpAMoAgAiASAHTwRAQaikAygCACEAAkAgASAHayICQRBPBEBBnKQDIAI2AgBBqKQDIAAgB2oiAzYCACADIAJBAXI2AgQgACABaiACNgIAIAAgB0EDcjYCBAwBC0GopANBADYCAEGcpANBADYCACAAIAFBA3I2AgQgACABaiIBIAEoAgRBAXI2AgQLIABBCGohAAwDC0GgpAMoAgAiASAHSwRAQaCkAyABIAdrIgE2AgBBrKQDQaykAygCACIAIAdqIgI2AgAgAiABQQFyNgIEIAAgB0EDcjYCBCAAQQhqIQAMAwtBACEAIAdBL2oiBAJ/QeynAygCAARAQfSnAygCAAwBC0H4pwNCfzcCAEHwpwNCgKCAgICABDcCAEHspwMgDEEMakFwcUHYqtWqBXM2AgBBgKgDQQA2AgBB0KcDQQA2AgBBgCALIgJqIgZBACACayIFcSICIAdNDQJBzKcDKAIAIgMEQEHEpwMoAgAiCCACaiIJIAhNDQMgCSADSw0DCwJAQdCnAy0AAEEEcUUEQAJAAkACQAJAQaykAygCACIDBEBB1KcDIQADQCAAKAIAIgggA00EQCAIIAAoAgRqIANLDQMLIAAoAggiAA0ACwtBABDXCSIBQX9GDQMgAiEGQfCnAygCACIAQX9qIgMgAXEEQCACIAFrIAEgA2pBACAAa3FqIQYLIAYgB00NAyAGQf7///8HSw0DQcynAygCACIABEBBxKcDKAIAIgMgBmoiBSADTQ0EIAUgAEsNBAsgBhDXCSIAIAFHDQEMBQsgBiABayAFcSIGQf7///8HSw0CIAYQ1wkiASAAKAIAIAAoAgRqRg0BIAEhAAsgACEBAkAgB0EwaiAGTQ0AIAZB/v///wdLDQAgAUF/Rg0AQfSnAygCACIAIAQgBmtqQQAgAGtxIgBB/v///wdLDQQgABDXCUF/RwRAIAAgBmohBgwFC0EAIAZrENcJGgwCCyABQX9HDQMMAQsgAUF/Rw0CC0HQpwNB0KcDKAIAQQRyNgIACyACQf7///8HSw0CIAIQ1wkiAUEAENcJIgBPDQIgAUF/Rg0CIABBf0YNAiAAIAFrIgYgB0Eoak0NAgtBxKcDQcSnAygCACAGaiIANgIAIABByKcDKAIASwRAQcinAyAANgIACwJAAkACQEGspAMoAgAiBQRAQdSnAyEAA0AgASAAKAIAIgIgACgCBCIDakYNAiAAKAIIIgANAAsMAgtBpKQDKAIAIgBBACABIABPG0UEQEGkpAMgATYCAAtBACEAQdinAyAGNgIAQdSnAyABNgIAQbSkA0F/NgIAQbikA0HspwMoAgA2AgBB4KcDQQA2AgADQCAAQQN0IgJBxKQDaiACQbykA2oiAzYCACACQcikA2ogAzYCACAAQQFqIgBBIEcNAAtBoKQDIAZBWGoiAEF4IAFrQQdxQQAgAUEIakEHcRsiAmsiAzYCAEGspAMgASACaiICNgIAIAIgA0EBcjYCBCAAIAFqQSg2AgRBsKQDQfynAygCADYCAAwCCyAALQAMQQhxDQAgASAFTQ0AIAIgBUsNACAAIAMgBmo2AgRBrKQDIAVBeCAFa0EHcUEAIAVBCGpBB3EbIgBqIgE2AgBBoKQDQaCkAygCACAGaiICIABrIgA2AgAgASAAQQFyNgIEIAIgBWpBKDYCBEGwpANB/KcDKAIANgIADAELIAFBpKQDKAIAIgRJBEBBpKQDIAE2AgAgASEECyABIAZqIQJB1KcDIQACQAJAAkADQCACIAAoAgBHBEAgACgCCCIADQEMAgsLIAAtAAxBCHFFDQELQdSnAyEAA0AgACgCACICIAVNBEAgAiAAKAIEaiIDIAVLDQMLIAAoAgghAAwAAAsACyAAIAE2AgAgACAAKAIEIAZqNgIEIAFBeCABa0EHcUEAIAFBCGpBB3EbaiIJIAdBA3I2AgQgAkF4IAJrQQdxQQAgAkEIakEHcRtqIgEgCWsgB2shACAHIAlqIQgCQCABIAVGBEBBrKQDIAg2AgBBoKQDQaCkAygCACAAaiIANgIAIAggAEEBcjYCBAwBCyABQaikAygCAEYEQEGopAMgCDYCAEGcpANBnKQDKAIAIABqIgA2AgAgCCAAQQFyNgIEIAAgCGogADYCAAwBCyABKAIEIgpBA3FBAUYEQAJAIApB/wFNBEAgASgCDCECIAEoAggiAyAKQQN2IgdBA3RBvKQDaiIGRwRAIAQgA0sNByADKAIMIAFHDQcLIAIgA0YEQEGUpANBlKQDKAIAQX4gB3dxNgIADAILIAIgBkcEQCAEIAJLDQcgAigCCCABRw0HCyADIAI2AgwgAiADNgIIDAELIAEoAhghBQJAIAEgASgCDCIGRwRAIAQgASgCCCICSw0HIAIoAgwgAUcNByAGKAIIIAFHDQcgAiAGNgIMIAYgAjYCCAwBCwJAIAFBFGoiAigCACIHDQAgAUEQaiICKAIAIgcNAEEAIQYMAQsDQCACIQMgByIGQRRqIgIoAgAiBw0AIAZBEGohAiAGKAIQIgcNAAsgBCADSw0GIANBADYCAAsgBUUNAAJAIAEgASgCHCICQQJ0QcSmA2oiAygCAEYEQCADIAY2AgAgBg0BQZikA0GYpAMoAgBBfiACd3E2AgAMAgtBpKQDKAIAIAVLDQYgBUEQQRQgBSgCECABRhtqIAY2AgAgBkUNAQtBpKQDKAIAIgMgBksNBSAGIAU2AhggASgCECICBEAgAyACSw0GIAYgAjYCECACIAY2AhgLIAEoAhQiAkUNAEGkpAMoAgAgAksNBSAGIAI2AhQgAiAGNgIYCyAKQXhxIgIgAGohACABIAJqIQELIAEgASgCBEF+cTYCBCAIIABBAXI2AgQgACAIaiAANgIAIABB/wFNBEAgAEEDdiIBQQN0QbykA2ohAAJAQZSkAygCACICQQEgAXQiAXFFBEBBlKQDIAEgAnI2AgAgACECDAELQaSkAygCACAAKAIIIgJLDQULIAAgCDYCCCACIAg2AgwgCCAANgIMIAggAjYCCAwBCyAIAn9BACAAQQh2IgFFDQAaQR8gAEH///8HSw0AGiABIAFBgP4/akEQdkEIcSIBdCICIAJBgOAfakEQdkEEcSICdCIDIANBgIAPakEQdkECcSIDdEEPdiABIAJyIANyayIBQQF0IAAgAUEVanZBAXFyQRxqCyIBNgIcIAhCADcCECABQQJ0QcSmA2ohAwJAAkBBmKQDKAIAIgJBASABdCIEcUUEQEGYpAMgAiAEcjYCACADIAg2AgAMAQsgAEEAQRkgAUEBdmsgAUEfRht0IQIgAygCACEBA0AgASIDKAIEQXhxIABGDQIgAkEddiEBIAJBAXQhAiADIAFBBHFqQRBqIgQoAgAiAQ0AC0GkpAMoAgAgBEsNBSAEIAg2AgALIAggAzYCGCAIIAg2AgwgCCAINgIIDAELQaSkAygCACIAIANLDQMgACADKAIIIgBLDQMgACAINgIMIAMgCDYCCCAIQQA2AhggCCADNgIMIAggADYCCAsgCUEIaiEADAQLQaCkAyAGQVhqIgBBeCABa0EHcUEAIAFBCGpBB3EbIgJrIgQ2AgBBrKQDIAEgAmoiAjYCACACIARBAXI2AgQgACABakEoNgIEQbCkA0H8pwMoAgA2AgAgBSADQScgA2tBB3FBACADQVlqQQdxG2pBUWoiACAAIAVBEGpJGyICQRs2AgQgAkHcpwMpAgA3AhAgAkHUpwMpAgA3AghB3KcDIAJBCGo2AgBB2KcDIAY2AgBB1KcDIAE2AgBB4KcDQQA2AgAgAkEYaiEAA0AgAEEHNgIEIABBCGohASAAQQRqIQAgAyABSw0ACyACIAVGDQAgAiACKAIEQX5xNgIEIAUgAiAFayIDQQFyNgIEIAIgAzYCACADQf8BTQRAIANBA3YiAUEDdEG8pANqIQACQEGUpAMoAgAiAkEBIAF0IgFxRQRAQZSkAyABIAJyNgIAIAAhAwwBC0GkpAMoAgAgACgCCCIDSw0DCyAAIAU2AgggAyAFNgIMIAUgADYCDCAFIAM2AggMAQsgBUIANwIQIAUCf0EAIANBCHYiAEUNABpBHyADQf///wdLDQAaIAAgAEGA/j9qQRB2QQhxIgB0IgEgAUGA4B9qQRB2QQRxIgF0IgIgAkGAgA9qQRB2QQJxIgJ0QQ92IAAgAXIgAnJrIgBBAXQgAyAAQRVqdkEBcXJBHGoLIgA2AhwgAEECdEHEpgNqIQECQAJAQZikAygCACICQQEgAHQiBHFFBEBBmKQDIAIgBHI2AgAgASAFNgIAIAUgATYCGAwBCyADQQBBGSAAQQF2ayAAQR9GG3QhACABKAIAIQEDQCABIgIoAgRBeHEgA0YNAiAAQR12IQEgAEEBdCEAIAIgAUEEcWpBEGoiBCgCACIBDQALQaSkAygCACAESw0DIAQgBTYCACAFIAI2AhgLIAUgBTYCDCAFIAU2AggMAQtBpKQDKAIAIgAgAksNASAAIAIoAggiAEsNASAAIAU2AgwgAiAFNgIIIAVBADYCGCAFIAI2AgwgBSAANgIIC0GgpAMoAgAiACAHTQ0BQaCkAyAAIAdrIgE2AgBBrKQDQaykAygCACIAIAdqIgI2AgAgAiABQQFyNgIEIAAgB0EDcjYCBCAAQQhqIQAMAgsQHgALQYD7AkEwNgIAQQAhAAsgDEEQaiQAIAALvw8BCH8CQAJAIABFDQAgAEF4aiIDQaSkAygCACIHSQ0BIABBfGooAgAiAUEDcSICQQFGDQEgAyABQXhxIgBqIQUCQCABQQFxDQAgAkUNASADIAMoAgAiBGsiAyAHSQ0CIAAgBGohACADQaikAygCAEcEQCAEQf8BTQRAIAMoAgwhASADKAIIIgIgBEEDdiIEQQN0QbykA2oiBkcEQCAHIAJLDQUgAigCDCADRw0FCyABIAJGBEBBlKQDQZSkAygCAEF+IAR3cTYCAAwDCyABIAZHBEAgByABSw0FIAEoAgggA0cNBQsgAiABNgIMIAEgAjYCCAwCCyADKAIYIQgCQCADIAMoAgwiAUcEQCAHIAMoAggiAksNBSACKAIMIANHDQUgASgCCCADRw0FIAIgATYCDCABIAI2AggMAQsCQCADQRRqIgIoAgAiBA0AIANBEGoiAigCACIEDQBBACEBDAELA0AgAiEGIAQiAUEUaiICKAIAIgQNACABQRBqIQIgASgCECIEDQALIAcgBksNBCAGQQA2AgALIAhFDQECQCADIAMoAhwiAkECdEHEpgNqIgQoAgBGBEAgBCABNgIAIAENAUGYpANBmKQDKAIAQX4gAndxNgIADAMLQaSkAygCACAISw0EIAhBEEEUIAgoAhAgA0YbaiABNgIAIAFFDQILQaSkAygCACIEIAFLDQMgASAINgIYIAMoAhAiAgRAIAQgAksNBCABIAI2AhAgAiABNgIYCyADKAIUIgJFDQFBpKQDKAIAIAJLDQMgASACNgIUIAIgATYCGAwBCyAFKAIEIgFBA3FBA0cNAEGcpAMgADYCACAFIAFBfnE2AgQgAyAAQQFyNgIEIAAgA2ogADYCAA8LIAUgA00NASAFKAIEIgdBAXFFDQECQCAHQQJxRQRAIAVBrKQDKAIARgRAQaykAyADNgIAQaCkA0GgpAMoAgAgAGoiADYCACADIABBAXI2AgQgA0GopAMoAgBHDQNBnKQDQQA2AgBBqKQDQQA2AgAPCyAFQaikAygCAEYEQEGopAMgAzYCAEGcpANBnKQDKAIAIABqIgA2AgAgAyAAQQFyNgIEIAAgA2ogADYCAA8LAkAgB0H/AU0EQCAFKAIMIQEgBSgCCCICIAdBA3YiBEEDdEG8pANqIgZHBEBBpKQDKAIAIAJLDQYgAigCDCAFRw0GCyABIAJGBEBBlKQDQZSkAygCAEF+IAR3cTYCAAwCCyABIAZHBEBBpKQDKAIAIAFLDQYgASgCCCAFRw0GCyACIAE2AgwgASACNgIIDAELIAUoAhghCAJAIAUgBSgCDCIBRwRAQaSkAygCACAFKAIIIgJLDQYgAigCDCAFRw0GIAEoAgggBUcNBiACIAE2AgwgASACNgIIDAELAkAgBUEUaiICKAIAIgQNACAFQRBqIgIoAgAiBA0AQQAhAQwBCwNAIAIhBiAEIgFBFGoiAigCACIEDQAgAUEQaiECIAEoAhAiBA0AC0GkpAMoAgAgBksNBSAGQQA2AgALIAhFDQACQCAFIAUoAhwiAkECdEHEpgNqIgQoAgBGBEAgBCABNgIAIAENAUGYpANBmKQDKAIAQX4gAndxNgIADAILQaSkAygCACAISw0FIAhBEEEUIAgoAhAgBUYbaiABNgIAIAFFDQELQaSkAygCACIEIAFLDQQgASAINgIYIAUoAhAiAgRAIAQgAksNBSABIAI2AhAgAiABNgIYCyAFKAIUIgJFDQBBpKQDKAIAIAJLDQQgASACNgIUIAIgATYCGAsgAyAHQXhxIABqIgBBAXI2AgQgACADaiAANgIAIANBqKQDKAIARw0BQZykAyAANgIADwsgBSAHQX5xNgIEIAMgAEEBcjYCBCAAIANqIAA2AgALIABB/wFNBEAgAEEDdiIBQQN0QbykA2ohAAJAQZSkAygCACICQQEgAXQiAXFFBEBBlKQDIAEgAnI2AgAgACECDAELQaSkAygCACAAKAIIIgJLDQMLIAAgAzYCCCACIAM2AgwgAyAANgIMIAMgAjYCCA8LIANCADcCECADAn9BACAAQQh2IgFFDQAaQR8gAEH///8HSw0AGiABIAFBgP4/akEQdkEIcSIBdCICIAJBgOAfakEQdkEEcSICdCIEIARBgIAPakEQdkECcSIEdEEPdiABIAJyIARyayIBQQF0IAAgAUEVanZBAXFyQRxqCyICNgIcIAJBAnRBxKYDaiEBAkACQAJAQZikAygCACIEQQEgAnQiBnFFBEBBmKQDIAQgBnI2AgAgASADNgIAIAMgATYCGAwBCyAAQQBBGSACQQF2ayACQR9GG3QhAiABKAIAIQEDQCABIgQoAgRBeHEgAEYNAiACQR12IQEgAkEBdCECIAQgAUEEcWpBEGoiBigCACIBDQALQaSkAygCACAGSw0EIAYgAzYCACADIAQ2AhgLIAMgAzYCDCADIAM2AggMAQtBpKQDKAIAIgAgBEsNAiAAIAQoAggiAEsNAiAAIAM2AgwgBCADNgIIIANBADYCGCADIAQ2AgwgAyAANgIIC0G0pANBtKQDKAIAQX9qIgA2AgAgAA0AQdynAyEDA0AgAygCACIAQQhqIQMgAA0AC0G0pANBfzYCAAsPCxAeAAuGAQECfyAARQRAIAEQ0gkPCyABQUBPBEBBgPsCQTA2AgBBAA8LIABBeGpBECABQQtqQXhxIAFBC0kbENUJIgIEQCACQQhqDwsgARDSCSICRQRAQQAPCyACIAAgAEF8aigCACIDQXhxQQRBCCADQQNxG2siAyABIAMgAUkbEN4JGiAAENMJIAILvggBCX8CQAJAQaSkAygCACIIIABLDQAgACgCBCIGQQNxIgJBAUYNACAAIAZBeHEiA2oiBCAATQ0AIAQoAgQiBUEBcUUNACACRQRAQQAhAiABQYACSQ0CIAMgAUEEak8EQCAAIQIgAyABa0H0pwMoAgBBAXRNDQMLQQAhAgwCCyADIAFPBEAgAyABayICQRBPBEAgACAGQQFxIAFyQQJyNgIEIAAgAWoiASACQQNyNgIEIAQgBCgCBEEBcjYCBCABIAIQ1gkLIAAPC0EAIQIgBEGspAMoAgBGBEBBoKQDKAIAIANqIgMgAU0NAiAAIAZBAXEgAXJBAnI2AgQgACABaiICIAMgAWsiAUEBcjYCBEGgpAMgATYCAEGspAMgAjYCACAADwsgBEGopAMoAgBGBEBBnKQDKAIAIANqIgMgAUkNAgJAIAMgAWsiBUEQTwRAIAAgBkEBcSABckECcjYCBCAAIAFqIgEgBUEBcjYCBCAAIANqIgIgBTYCACACIAIoAgRBfnE2AgQMAQsgACAGQQFxIANyQQJyNgIEIAAgA2oiASABKAIEQQFyNgIEQQAhBUEAIQELQaikAyABNgIAQZykAyAFNgIAIAAPCyAFQQJxDQEgBUF4cSADaiIJIAFJDQECQCAFQf8BTQRAIAQoAgwhAiAEKAIIIgMgBUEDdiIFQQN0QbykA2oiCkcEQCAIIANLDQMgAygCDCAERw0DCyACIANGBEBBlKQDQZSkAygCAEF+IAV3cTYCAAwCCyACIApHBEAgCCACSw0DIAIoAgggBEcNAwsgAyACNgIMIAIgAzYCCAwBCyAEKAIYIQcCQCAEIAQoAgwiA0cEQCAIIAQoAggiAksNAyACKAIMIARHDQMgAygCCCAERw0DIAIgAzYCDCADIAI2AggMAQsCQCAEQRRqIgUoAgAiAg0AIARBEGoiBSgCACICDQBBACEDDAELA0AgBSEKIAIiA0EUaiIFKAIAIgINACADQRBqIQUgAygCECICDQALIAggCksNAiAKQQA2AgALIAdFDQACQCAEIAQoAhwiAkECdEHEpgNqIgUoAgBGBEAgBSADNgIAIAMNAUGYpANBmKQDKAIAQX4gAndxNgIADAILQaSkAygCACAHSw0CIAdBEEEUIAcoAhAgBEYbaiADNgIAIANFDQELQaSkAygCACIFIANLDQEgAyAHNgIYIAQoAhAiAgRAIAUgAksNAiADIAI2AhAgAiADNgIYCyAEKAIUIgJFDQBBpKQDKAIAIAJLDQEgAyACNgIUIAIgAzYCGAsgCSABayICQQ9NBEAgACAGQQFxIAlyQQJyNgIEIAAgCWoiASABKAIEQQFyNgIEIAAPCyAAIAZBAXEgAXJBAnI2AgQgACABaiIBIAJBA3I2AgQgACAJaiIDIAMoAgRBAXI2AgQgASACENYJIAAPCxAeAAsgAgvIDgEIfyAAIAFqIQUCQAJAAkAgACgCBCICQQFxDQAgAkEDcUUNASAAIAAoAgAiBGsiAEGkpAMoAgAiCEkNAiABIARqIQEgAEGopAMoAgBHBEAgBEH/AU0EQCAAKAIMIQIgACgCCCIDIARBA3YiBEEDdEG8pANqIgZHBEAgCCADSw0FIAMoAgwgAEcNBQsgAiADRgRAQZSkA0GUpAMoAgBBfiAEd3E2AgAMAwsgAiAGRwRAIAggAksNBSACKAIIIABHDQULIAMgAjYCDCACIAM2AggMAgsgACgCGCEHAkAgACAAKAIMIgJHBEAgCCAAKAIIIgNLDQUgAygCDCAARw0FIAIoAgggAEcNBSADIAI2AgwgAiADNgIIDAELAkAgAEEUaiIDKAIAIgQNACAAQRBqIgMoAgAiBA0AQQAhAgwBCwNAIAMhBiAEIgJBFGoiAygCACIEDQAgAkEQaiEDIAIoAhAiBA0ACyAIIAZLDQQgBkEANgIACyAHRQ0BAkAgACAAKAIcIgNBAnRBxKYDaiIEKAIARgRAIAQgAjYCACACDQFBmKQDQZikAygCAEF+IAN3cTYCAAwDC0GkpAMoAgAgB0sNBCAHQRBBFCAHKAIQIABGG2ogAjYCACACRQ0CC0GkpAMoAgAiBCACSw0DIAIgBzYCGCAAKAIQIgMEQCAEIANLDQQgAiADNgIQIAMgAjYCGAsgACgCFCIDRQ0BQaSkAygCACADSw0DIAIgAzYCFCADIAI2AhgMAQsgBSgCBCICQQNxQQNHDQBBnKQDIAE2AgAgBSACQX5xNgIEIAAgAUEBcjYCBCAFIAE2AgAPCyAFQaSkAygCACIISQ0BAkAgBSgCBCIJQQJxRQRAIAVBrKQDKAIARgRAQaykAyAANgIAQaCkA0GgpAMoAgAgAWoiATYCACAAIAFBAXI2AgQgAEGopAMoAgBHDQNBnKQDQQA2AgBBqKQDQQA2AgAPCyAFQaikAygCAEYEQEGopAMgADYCAEGcpANBnKQDKAIAIAFqIgE2AgAgACABQQFyNgIEIAAgAWogATYCAA8LAkAgCUH/AU0EQCAFKAIMIQIgBSgCCCIDIAlBA3YiBEEDdEG8pANqIgZHBEAgCCADSw0GIAMoAgwgBUcNBgsgAiADRgRAQZSkA0GUpAMoAgBBfiAEd3E2AgAMAgsgAiAGRwRAIAggAksNBiACKAIIIAVHDQYLIAMgAjYCDCACIAM2AggMAQsgBSgCGCEHAkAgBSAFKAIMIgJHBEAgCCAFKAIIIgNLDQYgAygCDCAFRw0GIAIoAgggBUcNBiADIAI2AgwgAiADNgIIDAELAkAgBUEUaiIDKAIAIgQNACAFQRBqIgMoAgAiBA0AQQAhAgwBCwNAIAMhBiAEIgJBFGoiAygCACIEDQAgAkEQaiEDIAIoAhAiBA0ACyAIIAZLDQUgBkEANgIACyAHRQ0AAkAgBSAFKAIcIgNBAnRBxKYDaiIEKAIARgRAIAQgAjYCACACDQFBmKQDQZikAygCAEF+IAN3cTYCAAwCC0GkpAMoAgAgB0sNBSAHQRBBFCAHKAIQIAVGG2ogAjYCACACRQ0BC0GkpAMoAgAiBCACSw0EIAIgBzYCGCAFKAIQIgMEQCAEIANLDQUgAiADNgIQIAMgAjYCGAsgBSgCFCIDRQ0AQaSkAygCACADSw0EIAIgAzYCFCADIAI2AhgLIAAgCUF4cSABaiIBQQFyNgIEIAAgAWogATYCACAAQaikAygCAEcNAUGcpAMgATYCAA8LIAUgCUF+cTYCBCAAIAFBAXI2AgQgACABaiABNgIACyABQf8BTQRAIAFBA3YiAkEDdEG8pANqIQECQEGUpAMoAgAiA0EBIAJ0IgJxRQRAQZSkAyACIANyNgIAIAEhAwwBC0GkpAMoAgAgASgCCCIDSw0DCyABIAA2AgggAyAANgIMIAAgATYCDCAAIAM2AggPCyAAQgA3AhAgAAJ/QQAgAUEIdiICRQ0AGkEfIAFB////B0sNABogAiACQYD+P2pBEHZBCHEiAnQiAyADQYDgH2pBEHZBBHEiA3QiBCAEQYCAD2pBEHZBAnEiBHRBD3YgAiADciAEcmsiAkEBdCABIAJBFWp2QQFxckEcagsiAzYCHCADQQJ0QcSmA2ohAgJAAkBBmKQDKAIAIgRBASADdCIGcUUEQEGYpAMgBCAGcjYCACACIAA2AgAgACACNgIYDAELIAFBAEEZIANBAXZrIANBH0YbdCEDIAIoAgAhAgNAIAIiBCgCBEF4cSABRg0CIANBHXYhAiADQQF0IQMgBCACQQRxakEQaiIGKAIAIgINAAtBpKQDKAIAIAZLDQMgBiAANgIAIAAgBDYCGAsgACAANgIMIAAgADYCCA8LQaSkAygCACIBIARLDQEgASAEKAIIIgFLDQEgASAANgIMIAQgADYCCCAAQQA2AhggACAENgIMIAAgATYCCAsPCxAeAAtUAQF/QZCoAygCACIBIABBA2pBfHFqIgBBf0wEQEGA+wJBMDYCAEF/DwsCQCAAPwBBEHRNDQAgABAnDQBBgPsCQTA2AgBBfw8LQZCoAyAANgIAIAELjwQCA38EfgJAAkAgAb0iB0IBhiIGUA0AIAdC////////////AINCgICAgICAgPj/AFYNACAAvSIIQjSIp0H/D3EiAkH/D0cNAQsgACABoiIAIACjDwsgCEIBhiIFIAZWBEAgB0I0iKdB/w9xIQMCfiACRQRAQQAhAiAIQgyGIgVCAFkEQANAIAJBf2ohAiAFQgGGIgVCf1UNAAsLIAhBASACa62GDAELIAhC/////////weDQoCAgICAgIAIhAsiBQJ+IANFBEBBACEDIAdCDIYiBkIAWQRAA0AgA0F/aiEDIAZCAYYiBkJ/VQ0ACwsgB0EBIANrrYYMAQsgB0L/////////B4NCgICAgICAgAiECyIHfSIGQn9VIQQgAiADSgRAA0ACQCAERQ0AIAYiBUIAUg0AIABEAAAAAAAAAACiDwsgBUIBhiIFIAd9IgZCf1UhBCACQX9qIgIgA0oNAAsgAyECCwJAIARFDQAgBiIFQgBSDQAgAEQAAAAAAAAAAKIPCwJAIAVC/////////wdWBEAgBSEGDAELA0AgAkF/aiECIAVCgICAgICAgARUIQMgBUIBhiIGIQUgAw0ACwsgCEKAgICAgICAgIB/gyEFIAJBAU4EfiAGQoCAgICAgIB4fCACrUI0hoQFIAZBASACa62ICyAFhL8PCyAARAAAAAAAAAAAoiAAIAUgBlEbC6sGAgV/BH4jAEGAAWsiBSQAAkACQAJAIAMgBEIAQgAQ4wVFDQAgAyAEEN0JIQcgAkIwiKciCUH//wFxIgZB//8BRg0AIAcNAQsgBUEQaiABIAIgAyAEEN8FIAUgBSkDECICIAUpAxgiASACIAEQ6QUgBSkDCCECIAUpAwAhBAwBCyABIAJC////////P4MgBq1CMIaEIgogAyAEQv///////z+DIARCMIinQf//AXEiB61CMIaEIgsQ4wVBAEwEQCABIAogAyALEOMFBEAgASEEDAILIAVB8ABqIAEgAkIAQgAQ3wUgBSkDeCECIAUpA3AhBAwBCyAGBH4gAQUgBUHgAGogASAKQgBCgICAgICAwLvAABDfBSAFKQNoIgpCMIinQYh/aiEGIAUpA2ALIQQgB0UEQCAFQdAAaiADIAtCAEKAgICAgIDAu8AAEN8FIAUpA1giC0IwiKdBiH9qIQcgBSkDUCEDCyAKQv///////z+DQoCAgICAgMAAhCIKIAtC////////P4NCgICAgICAwACEIg19IAQgA1StfSIMQn9VIQggBCADfSELIAYgB0oEQANAAn4gCARAIAsgDIRQBEAgBUEgaiABIAJCAEIAEN8FIAUpAyghAiAFKQMgIQQMBQsgC0I/iCEKIAxCAYYMAQsgCkIBhiEKIAQhCyAEQj+ICyEMIAogDIQiCiANfSALQgGGIgQgA1StfSIMQn9VIQggBCADfSELIAZBf2oiBiAHSg0ACyAHIQYLAkAgCEUNACALIgQgDCIKhEIAUg0AIAVBMGogASACQgBCABDfBSAFKQM4IQIgBSkDMCEEDAELIApC////////P1gEQANAIARCP4ghASAGQX9qIQYgBEIBhiEEIAEgCkIBhoQiCkKAgICAgIDAAFQNAAsLIAlBgIACcSEHIAZBAEwEQCAFQUBrIAQgCkL///////8/gyAGQfgAaiAHcq1CMIaEQgBCgICAgICAwMM/EN8FIAUpA0ghAiAFKQNAIQQMAQsgCkL///////8/gyAGIAdyrUIwhoQhAgsgACAENwMAIAAgAjcDCCAFQYABaiQAC+YDAwN/AX4GfAJAAkAC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aiABNgIAIAJBaGogATYCACACQWRqIAE2AgAgBCADQQRxQRhyIgRrIgJBIEkNACABrSIFQiCGIAWEIQUgAyAEaiEBA0AgASAFNwMYIAEgBTcDECABIAU3AwggASAFNwMAIAFBIGohASACQWBqIgJBH0sNAAsLIAAL5QIBAn8CQCAAIAFGDQACQCABIAJqIABLBEAgACACaiIEIAFLDQELIAAgASACEN4JGg8LIAAgAXNBA3EhAwJAAkAgACABSQRAIAMNAiAAQQNxRQ0BA0AgAkUNBCAAIAEtAAA6AAAgAUEBaiEBIAJBf2ohAiAAQQFqIgBBA3ENAAsMAQsCQCADDQAgBEEDcQRAA0AgAkUNBSAAIAJBf2oiAmoiAyABIAJqLQAAOgAAIANBA3ENAAsLIAJBA00NAANAIAAgAkF8aiICaiABIAJqKAIANgIAIAJBA0sNAAsLIAJFDQIDQCAAIAJBf2oiAmogASACai0AADoAACACDQALDAILIAJBA00NACACIQMDQCAAIAEoAgA2AgAgAUEEaiEBIABBBGohACADQXxqIgNBA0sNAAsgAkEDcSECCyACRQ0AA0AgACABLQAAOgAAIABBAWohACABQQFqIQEgAkF/aiICDQALCwsfAEGEqAMoAgBFBEBBiKgDIAE2AgBBhKgDIAA2AgALCwQAIwALEAAjACAAa0FwcSIAJAAgAAsGACAAJAALBgAgAEAACwsAIAEgAiAAEQIACw8AIAEgAiADIAQgABELAAsLACABIAIgABERAAsNACABIAIgAyAAEU0ACw8AIAEgAiADIAQgABEVAAsRACABIAIgAyAEIAUgABFVAAsNACABIAIgAyAAERIACw8AIAEgAiADIAQgABFSAAsLACABIAIgABEYAAsLACABIAIgABEPAAsNACABIAIgAyAAERoACw0AIAEgAiADIAARHgALDwAgASACIAMgBCAAEUwACw8AIAEgAiADIAQgABEZAAsPACABIAIgAyAEIAARXAALEQAgASACIAMgBCAFIAARTwALEQAgASACIAMgBCAFIAARXQALEwAgASACIAMgBCAFIAYgABFQAAsPACABIAIgAyAEIAARPgALEQAgASACIAMgBCAFIAARNwALEQAgASACIAMgBCAFIAARPwALEwAgASACIAMgBCAFIAYgABE4AAsTACABIAIgAyAEIAUgBiAAEUAACxUAIAEgAiADIAQgBSAGIAcgABE5AAsPACABIAIgAyAEIAARQgALEQAgASACIAMgBCAFIAAROwALDwAgASACIAMgBCAAEUYACw0AIAEgAiADIAARQQALDwAgASACIAMgBCAAEToACw8AIAEgAiADIAQgABEIAAsRACABIAIgAyAEIAUgABE9AAsTACABIAIgAyAEIAUgBiAAETUACxMAIAEgAiADIAQgBSAGIAARIAALEwAgASACIAMgBCAFIAYgABFeAAsVACABIAIgAyAEIAUgBiAHIAARVAALFQAgASACIAMgBCAFIAYgByAAEVkACxMAIAEgAiADIAQgBSAGIAARXwALFQAgASACIAMgBCAFIAYgByAAEVcACxcAIAEgAiADIAQgBSAGIAcgCCAAEWEACxkAIAEgAiADIAQgBSAGIAcgCCAJIAARWgALDQAgASACIAMgABEkAAsPACABIAIgAyAEIAARKwALEwAgASACIAMgBCAFIAYgABEtAAsVACABIAIgAyAEIAUgBiAHIAARUQALDwAgASACIAMgBCAAER8ACxEAIAEgAiADIAQgBSAAESwACw0AIAEgAiADIAARIgALDwAgASACIAMgBCAAETYACxEAIAEgAiADIAQgBSAAEQoACw0AIAEgAiADIAARSAALDwAgASACIAMgBCAAEUcACwkAIAEgABEpAAsLACABIAIgABEqAAsPACABIAIgAyAEIAARSgALEQAgASACIAMgBCAFIAARSwALEwAgASACIAMgBCAFIAYgABEzAAsVACABIAIgAyAEIAUgBiAHIAARMgALDQAgASACIAMgABFjAAsPACABIAIgAyAEIAARNAALDwAgASACIAMgBCAAEWgACxEAIAEgAiADIAQgBSAAES4ACxMAIAEgAiADIAQgBSAGIAARUwALEwAgASACIAMgBCAFIAYgABFgAAsVACABIAIgAyAEIAUgBiAHIAARWAALEQAgASACIAMgBCAFIAARLwALEwAgASACIAMgBCAFIAYgABFWAAsLACABIAIgABFqAAsPACABIAIgAyAEIAARWwALEQAgASACIAMgBCAFIAARTgALEwAgASACIAMgBCAFIAYgABFJAAsRACABIAIgAyAEIAUgABEGAAsXACABIAIgAyAEIAUgBiAHIAggABEOAAsTACABIAIgAyAEIAUgBiAAEQkACxEAIAEgAiADIAQgBSAAEScACxUAIAEgAiADIAQgBSAGIAcgABEUAAsTACABIAIgAyAEIAUgBiAAEQ0ACwcAIAARBwALGQAgASACIAOtIAStQiCGhCAFIAYgABEmAAsiAQF+IAEgAq0gA61CIIaEIAQgABEcACIFQiCIpxApIAWnCxkAIAEgAiADIAQgBa0gBq1CIIaEIAARIwALIwAgASACIAMgBCAFrSAGrUIghoQgB60gCK1CIIaEIAARRQALJQAgASACIAMgBCAFIAatIAetQiCGhCAIrSAJrUIghoQgABFEAAsL2M4CVQBBgAgL8BJWZWN0b3JJbnQAVmVjdG9yRG91YmxlAFZlY3RvckNoYXIAVmVjdG9yVUNoYXIAVmVjdG9yRmxvYXQAdmVjdG9yVG9vbHMAY2xlYXJWZWN0b3JEYmwAY2xlYXJWZWN0b3JGbG9hdABtYXhpU2V0dGluZ3MAc2V0dXAAc2FtcGxlUmF0ZQBjaGFubmVscwBidWZmZXJTaXplAG1heGlPc2MAc2luZXdhdmUAY29zd2F2ZQBwaGFzb3IAc2F3AHRyaWFuZ2xlAHNxdWFyZQBwdWxzZQBpbXB1bHNlAG5vaXNlAHNpbmVidWYAc2luZWJ1ZjQAc2F3bgBwaGFzZVJlc2V0AG1heGlFbnZlbG9wZQBsaW5lAHRyaWdnZXIAYW1wbGl0dWRlAHZhbGluZGV4AG1heGlEZWxheWxpbmUAZGwAbWF4aUZpbHRlcgBsb3JlcwBoaXJlcwBiYW5kcGFzcwBsb3Bhc3MAaGlwYXNzAGN1dG9mZgByZXNvbmFuY2UAbWF4aU1peABzdGVyZW8AcXVhZABhbWJpc29uaWMAbWF4aUxpbmUAcGxheQBwcmVwYXJlAHRyaWdnZXJFbmFibGUAaXNMaW5lQ29tcGxldGUAbWF4aVhGYWRlAHhmYWRlAG1heGlMYWdFeHAAaW5pdABhZGRTYW1wbGUAdmFsdWUAYWxwaGEAYWxwaGFSZWNpcHJvY2FsAHZhbABtYXhpU2FtcGxlAGdldExlbmd0aABzZXRTYW1wbGUAc2V0U2FtcGxlRnJvbU9nZ0Jsb2IAaXNSZWFkeQBwbGF5T25jZQBwbGF5T25aWABwbGF5NABjbGVhcgBub3JtYWxpc2UAYXV0b1RyaW0AbG9hZAByZWFkAGxvb3BTZXRQb3NPblpYAG1heGlNYXAAbGlubGluAGxpbmV4cABleHBsaW4AY2xhbXAAbWF4aUR5bgBnYXRlAGNvbXByZXNzb3IAY29tcHJlc3MAc2V0QXR0YWNrAHNldFJlbGVhc2UAc2V0VGhyZXNob2xkAHNldFJhdGlvAG1heGlFbnYAYXIAYWRzcgBzZXREZWNheQBzZXRTdXN0YWluAGNvbnZlcnQAbXRvZgBtc1RvU2FtcHMAbWF4aVNhbXBsZUFuZEhvbGQAc2FoAG1heGlEaXN0b3J0aW9uAGZhc3RBdGFuAGF0YW5EaXN0AGZhc3RBdGFuRGlzdABtYXhpRmxhbmdlcgBmbGFuZ2UAbWF4aUNob3J1cwBjaG9ydXMAbWF4aURDQmxvY2tlcgBtYXhpU1ZGAHNldEN1dG9mZgBzZXRSZXNvbmFuY2UAbWF4aU1hdGgAYWRkAHN1YgBtdWwAZGl2AGd0AGx0AGd0ZQBsdGUAbW9kAGFicwBwb3cAbWF4aUNsb2NrAHRpY2tlcgBzZXRUZW1wbwBzZXRUaWNrc1BlckJlYXQAaXNUaWNrAGN1cnJlbnRDb3VudABwbGF5SGVhZABicHMAYnBtAHRpY2sAdGlja3MAbWF4aUt1cmFtb3RvT3NjaWxsYXRvcgBzZXRQaGFzZQBnZXRQaGFzZQBtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0AHNldFBoYXNlcwBzaXplAG1heGlBc3luY0t1cmFtb3RvT3NjaWxsYXRvcgBtYXhpRkZUAHByb2Nlc3MAc3BlY3RyYWxGbGF0bmVzcwBzcGVjdHJhbENlbnRyb2lkAGdldE1hZ25pdHVkZXMAZ2V0TWFnbml0dWRlc0RCAGdldFBoYXNlcwBnZXROdW1CaW5zAGdldEZGVFNpemUAZ2V0SG9wU2l6ZQBnZXRXaW5kb3dTaXplAG1heGlGRlRNb2RlcwBXSVRIX1BPTEFSX0NPTlZFUlNJT04ATk9fUE9MQVJfQ09OVkVSU0lPTgBtYXhpSUZGVABtYXhpSUZGVE1vZGVzAFNQRUNUUlVNAENPTVBMRVgAbWF4aU1GQ0MAbWZjYwBtYXhpVGltZVN0cmV0Y2gAc2hhcmVkX3B0cjxtYXhpVGltZXN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4AZ2V0Tm9ybWFsaXNlZFBvc2l0aW9uAGdldFBvc2l0aW9uAHNldFBvc2l0aW9uAHBsYXlBdFBvc2l0aW9uAG1heGlQaXRjaFNoaWZ0AHNoYXJlZF9wdHI8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4AbWF4aVN0cmV0Y2gAc2V0TG9vcFN0YXJ0AHNldExvb3BFbmQAZ2V0TG9vcEVuZABtYXhpQml0cwBzaWcAYXQAc2hsAHNocgByAGxhbmQAbG9yAGx4b3IAbmVnAGluYwBkZWMAZXEAdG9TaWduYWwAdG9UcmlnU2lnbmFsAGZyb21TaWduYWwAbWF4aVRyaWdnZXIAb25aWABvbkNoYW5nZWQAbWF4aUNvdW50ZXIAY291bnQAbWF4aUluZGV4AHB1bGwAbWF4aVJhdGlvU2VxAHBsYXlUcmlnAHBsYXlWYWx1ZXMAbWF4aVNhdFJldmVyYgBtYXhpRnJlZVZlcmIAYWxsb2NhdG9yPFQ+OjphbGxvY2F0ZShzaXplX3QgbikgJ24nIGV4Y2VlZHMgbWF4aW11bSBzdXBwb3J0ZWQgc2l6ZQBwdXNoX2JhY2sAcmVzaXplAGdldABzZXQATlN0M19fMjZ2ZWN0b3JJaU5TXzlhbGxvY2F0b3JJaUVFRUUATlN0M19fMjEzX192ZWN0b3JfYmFzZUlpTlNfOWFsbG9jYXRvcklpRUVFRQBOU3QzX18yMjBfX3ZlY3Rvcl9iYXNlX2NvbW1vbklMYjFFRUUAAAD8ewAAMQwAAIB8AAAFDAAAAAAAAAEAAABYDAAAAAAAAIB8AADhCwAAAAAAAAEAAABgDAAAAAAAAFBOU3QzX18yNnZlY3RvcklpTlNfOWFsbG9jYXRvcklpRUVFRQAAAADcfAAAkAwAAAAAAAB4DAAAUEtOU3QzX18yNnZlY3RvcklpTlNfOWFsbG9jYXRvcklpRUVFRQAAANx8AADIDAAAAQAAAHgMAABpaQB2AHZpALgMAAAEewAAuAwAAGR7AAB2aWlpAAAAAAR7AAC4DAAAiHsAAGR7AAB2aWlpaQAAAIh7AADwDAAAaWlpAGQNAAB4DAAAiHsAAE4xMGVtc2NyaXB0ZW4zdmFsRQAA/HsAAFANAABpaWlpAEGAGwvmBBx7AAB4DAAAiHsAAGR7AABpaWlpaQBOU3QzX18yNnZlY3RvcklkTlNfOWFsbG9jYXRvcklkRUVFRQBOU3QzX18yMTNfX3ZlY3Rvcl9iYXNlSWROU185YWxsb2NhdG9ySWRFRUVFAAAAgHwAALoNAAAAAAAAAQAAAFgMAAAAAAAAgHwAAJYNAAAAAAAAAQAAAOgNAAAAAAAAUE5TdDNfXzI2dmVjdG9ySWROU185YWxsb2NhdG9ySWRFRUVFAAAAANx8AAAYDgAAAAAAAAAOAABQS05TdDNfXzI2dmVjdG9ySWROU185YWxsb2NhdG9ySWRFRUVFAAAA3HwAAFAOAAABAAAAAA4AAEAOAAAEewAAQA4AAKB7AAB2aWlkAAAAAAR7AABADgAAiHsAAKB7AAB2aWlpZAAAAIh7AAB4DgAAZA0AAAAOAACIewAAAAAAABx7AAAADgAAiHsAAKB7AABpaWlpZABOU3QzX18yNnZlY3RvckljTlNfOWFsbG9jYXRvckljRUVFRQBOU3QzX18yMTNfX3ZlY3Rvcl9iYXNlSWNOU185YWxsb2NhdG9ySWNFRUVFAAAAgHwAAAoPAAAAAAAAAQAAAFgMAAAAAAAAgHwAAOYOAAAAAAAAAQAAADgPAAAAAAAAUE5TdDNfXzI2dmVjdG9ySWNOU185YWxsb2NhdG9ySWNFRUVFAAAAANx8AABoDwAAAAAAAFAPAABQS05TdDNfXzI2dmVjdG9ySWNOU185YWxsb2NhdG9ySWNFRUVFAAAA3HwAAKAPAAABAAAAUA8AAJAPAAAEewAAkA8AACh7AEHwHwsiBHsAAJAPAACIewAAKHsAAIh7AADIDwAAZA0AAFAPAACIewBBoCALsgIcewAAUA8AAIh7AAAoewAATlN0M19fMjZ2ZWN0b3JJaE5TXzlhbGxvY2F0b3JJaEVFRUUATlN0M19fMjEzX192ZWN0b3JfYmFzZUloTlNfOWFsbG9jYXRvckloRUVFRQCAfAAAVBAAAAAAAAABAAAAWAwAAAAAAACAfAAAMBAAAAAAAAABAAAAgBAAAAAAAABQTlN0M19fMjZ2ZWN0b3JJaE5TXzlhbGxvY2F0b3JJaEVFRUUAAAAA3HwAALAQAAAAAAAAmBAAAFBLTlN0M19fMjZ2ZWN0b3JJaE5TXzlhbGxvY2F0b3JJaEVFRUUAAADcfAAA6BAAAAEAAACYEAAA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RlQAAAAA/HsAAAAjAABQN21heGlGRlQAAADcfAAAFCMAAAAAAAAMIwAAUEs3bWF4aUZGVAAA3HwAADAjAAABAAAADCMAACAjAAAEewAAICMAAGR7AABkewAAZHsAAHZpaWlpaQAAAAAAABx7AAAgIwAAlHsAAJQjAABON21heGlGRlQ4ZmZ0TW9kZXNFALB7AACAIwAAaWlpZmkAAACUewAAICMAAGZpaQDYEQAAICMAAGR7AAAgIwAAOG1heGlJRkZUAAAA/HsAAMAjAABQOG1heGlJRkZUAADcfAAA1CMAAAAAAADMIwAAUEs4bWF4aUlGRlQA3HwAAPAjAAABAAAAzCMAAOAjAAAEewAA4CMAAGR7AABkewAAZHsAQbDIAAu2DZR7AADgIwAA2BEAANgRAABcJAAATjhtYXhpSUZGVDhmZnRNb2Rlc0UAAAAAsHsAAEQkAABmaWlpaWkAMTZtYXhpTUZDQ0FuYWx5c2VySWRFAAAAAPx7AABrJAAAUDE2bWF4aU1GQ0NBbmFseXNlcklkRQAA3HwAAIwkAAAAAAAAhCQAAFBLMTZtYXhpTUZDQ0FuYWx5c2VySWRFANx8AAC0JAAAAQAAAIQkAACkJAAABHsAAKQkAABwewAAcHsAAHB7AACgewAAoHsAAHZpaWlpaWRkAAAAAAAOAACkJAAA2BEAADE1bWF4aVRpbWVTdHJldGNoSTE0aGFubldpbkZ1bmN0b3JFAPx7AAAUJQAAUDE1bWF4aVRpbWVTdHJldGNoSTE0aGFubldpbkZ1bmN0b3JFAAAAANx8AABAJQAAAAAAADglAABQSzE1bWF4aVRpbWVTdHJldGNoSTE0aGFubldpbkZ1bmN0b3JFAAAA3HwAAHglAAABAAAAOCUAAAAAAABoJgAARgIAAEcCAABIAgAASQIAAEoCAABOU3QzX18yMjBfX3NoYXJlZF9wdHJfcG9pbnRlcklQMTVtYXhpVGltZVN0cmV0Y2hJMTRoYW5uV2luRnVuY3RvckVOMTBlbXNjcmlwdGVuMTVzbWFydF9wdHJfdHJhaXRJTlNfMTBzaGFyZWRfcHRySVMzX0VFRTExdmFsX2RlbGV0ZXJFTlNfOWFsbG9jYXRvcklTM19FRUVFAAAkfAAAzCUAAER4AABOMTBlbXNjcmlwdGVuMTVzbWFydF9wdHJfdHJhaXRJTlN0M19fMjEwc2hhcmVkX3B0ckkxNW1heGlUaW1lU3RyZXRjaEkxNGhhbm5XaW5GdW5jdG9yRUVFRTExdmFsX2RlbGV0ZXJFAE5TdDNfXzIxMHNoYXJlZF9wdHJJMTVtYXhpVGltZVN0cmV0Y2hJMTRoYW5uV2luRnVuY3RvckVFRQAAAPx7AADcJgAAaQAAABgnAAAAAAAAnCcAAEsCAABMAgAATQIAAE4CAABPAgAATlN0M19fMjIwX19zaGFyZWRfcHRyX2VtcGxhY2VJMTVtYXhpVGltZVN0cmV0Y2hJMTRoYW5uV2luRnVuY3RvckVOU185YWxsb2NhdG9ySVMzX0VFRUUAACR8AABEJwAARHgAAAR7AABoJQAAtBgAAKB7AABoJQAABHsAAGglAACgewAAAAAAABQoAABQAgAAUQIAAFICAAA5bWF4aUdyYWluSTE0aGFubldpbkZ1bmN0b3JFADEzbWF4aUdyYWluQmFzZQAAAAD8ewAA+ScAACR8AADcJwAADCgAAKB7AABoJQAAoHsAAKB7AABkewAAoHsAAGRpaWRkaWQAoHsAAGglAACgewAAoHsAAGR7AAAxNG1heGlQaXRjaFNoaWZ0STE0aGFubldpbkZ1bmN0b3JFAAD8ewAAVCgAAFAxNG1heGlQaXRjaFNoaWZ0STE0aGFubldpbkZ1bmN0b3JFANx8AACAKAAAAAAAAHgoAABQSzE0bWF4aVBpdGNoU2hpZnRJMTRoYW5uV2luRnVuY3RvckUAAAAA3HwAALQoAAABAAAAeCgAAAAAAACkKQAAUwIAAFQCAABVAgAAVgIAAFcCAABOU3QzX18yMjBfX3NoYXJlZF9wdHJfcG9pbnRlcklQMTRtYXhpUGl0Y2hTaGlmdEkxNGhhbm5XaW5GdW5jdG9yRU4xMGVtc2NyaXB0ZW4xNXNtYXJ0X3B0cl90cmFpdElOU18xMHNoYXJlZF9wdHJJUzNfRUVFMTF2YWxfZGVsZXRlckVOU185YWxsb2NhdG9ySVMzX0VFRUUAAAAkfAAACCkAAER4AABOMTBlbXNjcmlwdGVuMTVzbWFydF9wdHJfdHJhaXRJTlN0M19fMjEwc2hhcmVkX3B0ckkxNG1heGlQaXRjaFNoaWZ0STE0aGFubldpbkZ1bmN0b3JFRUVFMTF2YWxfZGVsZXRl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XzIxM2Jhc2ljX29zdHJlYW1JY05TXzExY2hhcl90cmFpdHNJY0VFRUUAAIB8AAAESwAAAAAAAAEAAACoSQAAA/T//05TdDNfXzIxM2Jhc2ljX29zdHJlYW1Jd05TXzExY2hhcl90cmFpdHNJd0VFRUUAAIB8AABMSwAAAAAAAAEAAADwSQAAA/T//8i4AAAAAAAA8EsAAH4CAACpAgAAqgIAAIECAACCAgAAgwIAAIQCAABsAgAAbQIAAKsCAACsAgAArQIAAHECAACHAgAATlN0M19fMjEwX19zdGRpbmJ1ZkljRUUAJHwAANhLAAAwSgAAdW5zdXBwb3J0ZWQgbG9jYWxlIGZvciBzdGFuZGFyZCBpbnB1dAAAAAAAAAB8TAAAiAIAAK4CAACvAgAAiwIAAIwCAACNAgAAjgIAAI8CAACQAgAAsAIAALECAACyAgAAlAIAAJUCAABOU3QzX18yMTBfX3N0ZGluYnVmSXdFRQAkfAAAZEwAAGxKAAAAAAAA5EwAAH4CAACzAgAAtAIAAIECAACCAgAAgwIAALUCAABsAgAAbQIAAIUCAABvAgAAhgIAALYCAAC3AgAATlN0M19fMjExX19zdGRvdXRidWZJY0VFAAAAACR8AADITAAAMEoAAAAAAABMTQAAiAIAALgCAAC5AgAAiwIAAIwCAACNAgAAugIAAI8CAACQAgAAkQIAAJICAACTAgAAuwIAALwCAABOU3QzX18yMTFfX3N0ZG91dGJ1Zkl3RUUAAAAAJHwAADBNAABsSgBB4JoBC+ME/////////////////////////////////////////////////////////////////wABAgMEBQYHCAn/////////CgsMDQ4PEBESExQVFhcYGRobHB0eHyAhIiP///////8KCwwNDg8QERITFBUWFxgZGhscHR4fICEiI/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////8AAQIEBwMGBQAAAAAAAAACAADAAwAAwAQAAMAFAADABgAAwAcAAMAIAADACQAA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xQMAAMADAADBAwAAxgMAAMcDAADIAwAAyQMAAAAAAABsfAAAvgMAAMoDAADAAwAAwQMAAMYDAADLAwAAzAMAAM0DAABOMTBfX2N4eGFiaXYxMjBfX3NpX2NsYXNzX3R5cGVfaW5mb0UAAAAAJHwAAER8AADUeQAAAAAAAMh8AAC+AwAAzgMAAMADAADBAwAAxgMAAM8DAADQAwAA0QMAAE4xMF9fY3h4YWJpdjEyMV9fdm1pX2NsYXNzX3R5cGVfaW5mb0UAAAAkfAAAoHwAANR5AAAAAAAANHoAAL4DAADSAwAAwAMAAMEDAADTAwAAdm9pZABib29sAGNoYXIAc2lnbmVkIGNoYXIAdW5zaWduZWQgY2hhcgBzaG9ydAB1bnNpZ25lZCBzaG9ydABpbnQAdW5zaWduZWQgaW50AGxvbmcAdW5zaWduZWQgbG9uZwBmbG9hdABkb3VibGUAc3RkOjpzdHJpbmcAc3RkOjpiYXNpY19zdHJpbmc8dW5zaWduZWQgY2hhcj4Ac3RkOjp3c3RyaW5nAHN0ZDo6dTE2c3RyaW5nAHN0ZDo6dTMyc3RyaW5nAGVtc2NyaXB0ZW46OnZhbABlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxjaGFyPgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxzaWduZWQgY2hhcj4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8dW5zaWduZWQgY2hhcj4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8c2hvcnQ+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHVuc2lnbmVkIHNob3J0PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxpbnQ+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHVuc2lnbmVkIGludD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8bG9uZz4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8dW5zaWduZWQgbG9uZz4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8aW50OF90PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzx1aW50OF90PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxpbnQxNl90PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzx1aW50MTZfdD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8aW50MzJfdD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8dWludDMyX3Q+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PGZsb2F0PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxkb3VibGU+AE5TdDNfXzIxMmJhc2ljX3N0cmluZ0loTlNfMTFjaGFyX3RyYWl0c0loRUVOU185YWxsb2NhdG9ySWhFRUVFAAAAAIB8AAAGgAAAAAAAAAEAAAAYGgAAAAAAAE5TdDNfXzIxMmJhc2ljX3N0cmluZ0l3TlNfMTFjaGFyX3RyYWl0c0l3RUVOU185YWxsb2NhdG9ySXdFRUVFAACAfAAAYIAAAAAAAAABAAAAGBoAAAAAAABOU3QzX18yMTJiYXNpY19zdHJpbmdJRHNOU18xMWNoYXJfdHJhaXRzSURzRUVOU185YWxsb2NhdG9ySURzRUVFRQAAAIB8AAC4gAAAAAAAAAEAAAAYGgAAAAAAAE5TdDNfXzIxMmJhc2ljX3N0cmluZ0lEaU5TXzExY2hhcl90cmFpdHNJRGlFRU5TXzlhbGxvY2F0b3JJRGlFRUVFAAAAgHwAABSBAAAAAAAAAQAAABgaAAAAAAAATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJY0VFAAD8ewAAcIEAAE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SWFFRQAA/HsAAJiBAABOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0loRUUAAPx7AADAgQAATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJc0VFAAD8ewAA6IEAAE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SXRFRQAA/HsAABCCAABOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0lpRUUAAPx7AAA4ggAATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJakVFAAD8ewAAYIIAAE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SWxFRQAA/HsAAIiCAABOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0ltRUUAAPx7AACwggAATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJZkVFAAD8ewAA2IIAAE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SWRFRQAA/HsAAACDAEGyhgILDIA/RKwAAAIAAAAABABByIYCC9Ben3JMFvcfiT+fckwW9x+ZP/hVuVD516I//MdCdAgcqT+k5NU5BmSvP54KuOf507I/oMN8eQH2tT+aBkXzABa5P0vqBDQRNrw/Zw+0AkNWvz9iodY07zjBP55eKcsQx8I/Tfilft5UxD834PPDCOHFP5SkaybfbMc/1SE3ww34yD/gEKrU7IHKP9C4cCAkC8w/idLe4AuTzT/wFkhQ/BjPP6yt2F92T9A/NuUK73IR0T9t5/up8dLRP/p+arx0k9I/M+GX+nlT0z8XDoRkARPUP1PQ7SWN0dQ/HhZqTfOO1T9cOBCSBUzWPyveyDzyB9c/FytqMA3D1z/oMF9egH3YP7yWkA96Ntk/O8eA7PXu2T8Rje4gdqbaP+qymNh8XNs/bqMBvAUS3D8u4jsx68XcPwzIXu/+eN0/ezGUE+0q3j+zDHGsi9veP3trYKsEi98/za/mAMEc4D/eWbvtQnPgP5rOTgZHyeA/dOrKZ3ke4T80v5oDBHPhP7vVc9L7xuE/Qxzr4jYa4j+wG7YtymziP1g5tMh2vuI/j6omiLoP4z8csRafAmDjP3L5D+m3r+M/A2A8g4b+4z9bCHJQwkzkPwtGJXUCmuQ/vLN224Xm5D+KyLCKNzLlP5T7HYoCfeU/ZXCUvDrH5T+NeohGdxDmPw0a+ie4WOY/jukJSzyg5j8Q6bevA+fmPwb1LXO6LOc/U5YhjnVx5z+E8GjjiLXnP0bOwp52+Oc/7WRwlLw66D/rkJvhBnzoP1zJjo1AvOg/JJf/kH776D9E+u3rwDnpP2WNeohGd+k/T5KumXyz6T87x4Ds9e7pP7d/ZaVJKeo/bVZ9rrZi6j+0sKcd/prqP/s6cM6I0uo/DTfg88MI6z91yM1wAz7rPzXvOEVHcus/vodLjjul6z8r2bERiNfrP2OcvwmFCOw/R1oqb0c47D9Iv30dOGfsP9un4zEDlew/NgLxun7B7D+TjJyFPe3sP/N2hNOCF+0/xm00gLdA7T/Ughd9BWntP6sJou4DkO0/2SWqtwa27T/Qs1n1udrtP1jFG5lH/u0/VOOlm8Qg7j/8+4wLB0LuPxghPNo4Yu4/Gy/dJAaB7j875Ga4AZ/uP135LM+Du+4/16NwPQrX7j9wJTs2AvHuPwrXo3A9Cu8/p+hILv8h7z/x9EpZhjjvP64NFeP8Te8/GCE82jhi7z8wL8A+OnXvP/Q3oRABh+8/gbIpV3iX7z9JS+XtCKfvP00ychb2tO8/izcyj/zB7z92N091yM3vPyqpE9BE2O8/jBU1mIbh7z+28/3UeOnvP3FV2XdF8O8/9ihcj8L17z8n9zsUBfrvP8zR4/c2/e8/V5V9VwT/7z9WZd8Vwf/vP1eVfVcE/+8/zNHj9zb97z8n9zsUBfrvP/YoXI/C9e8/cVXZd0Xw7z+28/3UeOnvP4wVNZiG4e8/KqkT0ETY7z92N091yM3vP4s3Mo/8we8/TTJyFva07z9JS+XtCKfvP4GyKVd4l+8/9DehEAGH7z8wL8A+OnXvPxghPNo4Yu8/rg0V4/xN7z/x9EpZhjjvP6foSC7/Ie8/CtejcD0K7z9wJTs2AvHuP9ejcD0K1+4/Xfksz4O77j875Ga4AZ/uPxsv3SQGge4/GCE82jhi7j/8+4wLB0LuP1TjpZvEIO4/WMUbmUf+7T/Qs1n1udrtP9klqrcGtu0/qwmi7gOQ7T/Ughd9BWntP8ZtNIC3QO0/83aE04IX7T+TjJyFPe3sPzYC8bp+wew/26fjMQOV7D9Iv30dOGfsP0daKm9HOOw/Y5y/CYUI7D8r2bERiNfrP76HS447pes/Ne84RUdy6z91yM1wAz7rPw034PPDCOs/+zpwzojS6j+0sKcd/prqP21Wfa62Yuo/t39lpUkp6j87x4Ds9e7pP0+Srpl8s+k/ZY16iEZ36T9E+u3rwDnpPySX/5B+++g/XMmOjUC86D/rkJvhBnzoP+1kcJS8Oug/Rs7Cnnb45z+E8GjjiLXnP1OWIY51cec/BvUtc7os5z8Q6bevA+fmP47pCUs8oOY/DRr6J7hY5j+NeohGdxDmP2VwlLw6x+U/lPsdigJ95T+KyLCKNzLlP7yzdtuF5uQ/C0YldQKa5D9bCHJQwkzkPwNgPIOG/uM/cvkP6bev4z8csRafAmDjP4+qJoi6D+M/WDm0yHa+4j+wG7YtymziP0Mc6+I2GuI/u9Vz0vvG4T80v5oDBHPhP3Tqymd5HuE/ms5OBkfJ4D/eWbvtQnPgP82v5gDBHOA/e2tgqwSL3z+zDHGsi9veP3sxlBPtKt4/DMhe7/543T8u4jsx68XcP26jAbwFEtw/6rKY2Hxc2z8Rje4gdqbaPzvHgOz17tk/vJaQD3o22T/oMF9egH3YPxcrajANw9c/K97IPPIH1z9cOBCSBUzWPx4Wak3zjtU/U9DtJY3R1D8XDoRkARPUPzPhl/p5U9M/+n5qvHST0j9t5/up8dLRPzblCu9yEdE/rK3YX3ZP0D/wFkhQ/BjPP4nS3uALk80/0LhwICQLzD/gEKrU7IHKP9UhN8MN+Mg/lKRrJt9sxz834PPDCOHFP034pX7eVMQ/nl4pyxDHwj9iodY07zjBP2cPtAJDVr8/S+oENBE2vD+aBkXzABa5P6DDfHkB9rU/ngq45/nTsj+k5NU5BmSvP/zHQnQIHKk/+FW5UPnXoj+fckwW9x+ZP59yTBb3H4k/AAAAAAAAAACfckwW9x+Jv59yTBb3H5m/+FW5UPnXor/8x0J0CBypv6Tk1TkGZK+/ngq45/nTsr+gw3x5Afa1v5oGRfMAFrm/S+oENBE2vL9nD7QCQ1a/v2Kh1jTvOMG/nl4pyxDHwr9N+KV+3lTEvzfg88MI4cW/lKRrJt9sx7/VITfDDfjIv+AQqtTsgcq/0LhwICQLzL+J0t7gC5PNv/AWSFD8GM+/rK3YX3ZP0L825QrvchHRv23n+6nx0tG/+n5qvHST0r8z4Zf6eVPTvxcOhGQBE9S/U9DtJY3R1L8eFmpN847Vv1w4EJIFTNa/K97IPPIH178XK2owDcPXv+gwX16Afdi/vJaQD3o22b87x4Ds9e7ZvxGN7iB2ptq/6rKY2Hxc279uowG8BRLcvy7iOzHrxdy/DMhe7/543b97MZQT7Srev7MMcayL296/e2tgqwSL37/Nr+YAwRzgv95Zu+1Cc+C/ms5OBkfJ4L906spneR7hvzS/mgMEc+G/u9Vz0vvG4b9DHOviNhriv7Abti3KbOK/WDm0yHa+4r+PqiaIug/jvxyxFp8CYOO/cvkP6bev478DYDyDhv7jv1sIclDCTOS/C0YldQKa5L+8s3bbhebkv4rIsIo3MuW/lPsdigJ95b9lcJS8Osflv416iEZ3EOa/DRr6J7hY5r+O6QlLPKDmvxDpt68D5+a/BvUtc7os579TliGOdXHnv4TwaOOItee/Rs7Cnnb457/tZHCUvDrov+uQm+EGfOi/XMmOjUC86L8kl/+Qfvvov0T67evAOem/ZY16iEZ36b9Pkq6ZfLPpvzvHgOz17um/t39lpUkp6r9tVn2utmLqv7Swpx3+muq/+zpwzojS6r8NN+Dzwwjrv3XIzXADPuu/Ne84RUdy67++h0uOO6XrvyvZsRGI1+u/Y5y/CYUI7L9HWipvRzjsv0i/fR04Z+y/26fjMQOV7L82AvG6fsHsv5OMnIU97ey/83aE04IX7b/GbTSAt0Dtv9SCF30Fae2/qwmi7gOQ7b/ZJaq3Brbtv9CzWfW52u2/WMUbmUf+7b9U46WbxCDuv/z7jAsHQu6/GCE82jhi7r8bL90kBoHuvzvkZrgBn+6/Xfksz4O77r/Xo3A9Ctfuv3AlOzYC8e6/CtejcD0K77+n6Egu/yHvv/H0SlmGOO+/rg0V4/xN778YITzaOGLvvzAvwD46de+/9DehEAGH77+BsilXeJfvv0lL5e0Ip++/TTJyFva077+LNzKP/MHvv3Y3T3XIze+/KqkT0ETY77+MFTWYhuHvv7bz/dR46e+/cVXZd0Xw77/2KFyPwvXvvyf3OxQF+u+/zNHj9zb9779XlX1XBP/vv1Zl3xXB/++/V5V9VwT/77/M0eP3Nv3vvyf3OxQF+u+/9ihcj8L1779xVdl3RfDvv7bz/dR46e+/jBU1mIbh778qqRPQRNjvv3Y3T3XIze+/izcyj/zB779NMnIW9rTvv0lL5e0Ip++/gbIpV3iX77/0N6EQAYfvvzAvwD46de+/GCE82jhi77+uDRXj/E3vv/H0SlmGOO+/p+hILv8h778K16NwPQrvv3AlOzYC8e6/16NwPQrX7r9d+SzPg7vuvzvkZrgBn+6/Gy/dJAaB7r8YITzaOGLuv/z7jAsHQu6/VOOlm8Qg7r9YxRuZR/7tv9CzWfW52u2/2SWqtwa27b+rCaLuA5Dtv9SCF30Fae2/xm00gLdA7b/zdoTTghftv5OMnIU97ey/NgLxun7B7L/bp+MxA5Xsv0i/fR04Z+y/R1oqb0c47L9jnL8JhQjsvyvZsRGI1+u/vodLjjul67817zhFR3Lrv3XIzXADPuu/DTfg88MI67/7OnDOiNLqv7Swpx3+muq/bVZ9rrZi6r+3f2WlSSnqvzvHgOz17um/T5KumXyz6b9ljXqIRnfpv0T67evAOem/JJf/kH776L9cyY6NQLzov+uQm+EGfOi/7WRwlLw66L9GzsKedvjnv4TwaOOItee/U5YhjnVx578G9S1zuiznvxDpt68D5+a/jukJSzyg5r8NGvonuFjmv416iEZ3EOa/ZXCUvDrH5b+U+x2KAn3lv4rIsIo3MuW/vLN224Xm5L8LRiV1Aprkv1sIclDCTOS/A2A8g4b+479y+Q/pt6/jvxyxFp8CYOO/j6omiLoP479YObTIdr7iv7Abti3KbOK/Qxzr4jYa4r+71XPS+8bhvzS/mgMEc+G/dOrKZ3ke4b+azk4GR8ngv95Zu+1Cc+C/za/mAMEc4L97a2CrBIvfv7MMcayL296/ezGUE+0q3r8MyF7v/njdvy7iOzHrxdy/bqMBvAUS3L/qspjYfFzbvxGN7iB2ptq/O8eA7PXu2b+8lpAPejbZv+gwX16Afdi/FytqMA3D178r3sg88gfXv1w4EJIFTNa/HhZqTfOO1b9T0O0ljdHUvxcOhGQBE9S/M+GX+nlT07/6fmq8dJPSv23n+6nx0tG/NuUK73IR0b+srdhfdk/Qv/AWSFD8GM+/idLe4AuTzb/QuHAgJAvMv+AQqtTsgcq/1SE3ww34yL+UpGsm32zHvzfg88MI4cW/Tfilft5UxL+eXinLEMfCv2Kh1jTvOMG/Zw+0AkNWv79L6gQ0ETa8v5oGRfMAFrm/oMN8eQH2tb+eCrjn+dOyv6Tk1TkGZK+//MdCdAgcqb/4VblQ+deiv59yTBb3H5m/n3JMFvcfib8AAAAAAAAAAJ9yTBb3H4k/RNycSgYA4L9E3JxKBgDgvwvuBzwwAOC/mRHeHoQA4L/AXmHB/QDgv+er5GN3AeC/AvOQKR8C4L/7P4f58gLgv0najT7mA+C/gIC1atcE4L8G8YEd/wXgv1RzucFQB+C/smZkkLsI4L8QWg9fJgrgv+v/HObLC+C/jbeVXpsN4L/7A+W2fQ/gv5c48kBkEeC/mSuDaoMT4L95JF6ezhXgv/fJUYAoGOC/0T/BxYoa4L/MlxdgHx3gvwDGM2joH+C/eNDsurci4L95k9+ikyXgv25Q+62dKOC/ycuaWOAr4L8kRzoDIy/gv2JLj6Z6MuC/UG1wIvo14L+OWfYksDngv8xFfCdmPeC/GqN1VDVB4L8ZHvtZLEXgvyOHiJtTSeC/LPAV3XpN4L90stR6v1Hgv1aeQNgpVuC/K4TVWMJa4L/UgaynVl/gv+jAcoQMZOC/wxGkUuxo4L8gmKPH723gv1A25QrvcuC/MPKyJhZ44L/AywwbZX3gv6bydoTTguC/Rz1EozuI4L/cgTrl0Y3gvwvw3eaNk+C/Ss/0EmOZ4L9G0m70MZ/gv2O3zyozpeC/A9L+B1ir4L9vgQTFj7Hgv65ITFDDt+C/JeZZSSu+4L8fuTXptsTgv7k4KjdRy+C/O8Q/bOnR4L+ySX7Er9jgv/DgJw6g3+C/W2CPiZTm4L8KvJNPj+3gv2k1JO6x9OC/prT+lgD84L/jM9k/TwPhv5J3DmWoCuG/rfwyGCMS4b+7e4Duyxnhv50SEJNwIeG/B2LZzCEp4b/c8pGU9DDhv4+JlGbzOOG/umddo+VA4b/IztvY7Ejhv0J3SZwVUeG/P1WFBmJZ4b+zeofboWHhvzgR/dr6aeG//ACkNnFy4b8rMjogCXvhv6TC2EKQg+G/XKyowTSM4b9S76mc9pThv3CX/brTneG/2J5ZEqCm4b+V88Xei6/hv3mthO6SuOG/QfD49q7B4b9TknU4usrhv+hpwCDp0+G/pKZdTDPd4b/Sp1X0h+bhv3jwEwfQ7+G/oG6gwDv54b/ZXaCkwALiv1YpPdNLDOK/YjB/hcwV4r/ChNGsbB/iv0s+dhcoKeK/0/caguMy4r8A4UOJljziv4MXfQVpRuK/Fr8prFRQ4r9lijkIOlriv55haksdZOK/0LUvoBdu4r9BYyZRL3jivxNkBFQ4guK/+1jBb0OM4r/H1jOEY5biv9Gt1/SgoOK/+PvFbMmq4r9NMnIW9rTiv4Tx07g3v+K/zSGphZLJ4r8F4Qoo1NPiv5dw6C0e3uK/95ScE3vo4r85Qgby7PLivz6WPnRB/eK/y6Kwi6IH478NUBpqFBLjvwaeew+XHOO/k6rtJvgm47/WV1cFajHjv7ix2ZHqO+O/C9C2mnVG478KoYMu4VDjv6geaXBbW+O/+zxGeeZl479PWyOCcXDjv3sUrkfheuO/XW4w1GGF47+wjA3d7I/jv+22C811muO/7IfYYOGk47+g+Zy7Xa/jv90jm6vmueO/kpVfBmPE479Mio9PyM7jv6Yr2EY82eO/Wp2cobjj479Zbmk1JO7jv4uqX+l8+OO/F7fRAN4C5L8WiJ6USQ3kvwTo9/2bF+S/Ups4ud8h5L/lKha/KSzkv+l+TkF+NuS/mIV2TrNA5L+/02TG20rkvxMKEXAIVeS/wxA5fT1f5L/Z7bPKTGnkv5T6srRTc+S/fO9v0F595L972AsFbIfkv8qjG2FRkeS/v56vWS6b5L/ggQGED6XkvwJlU67wruS/GFqdnKG45L8YWwhyUMLkvy9QUmABzOS/GF3eHK7V5L/fh4OEKN/kv5C+SdOg6OS/QfUPIhny5L+WW1oNifvkv+HTnLzIBOW//mMhOgQO5b8EAMeePRflv2vvU1VoIOW/9diWAWcp5b865jxjXzLlv1ILJZNTO+W/h6dXyjJE5b8LJv4o6kzlvzXUKCSZVeW/Gqa21EFe5b/XEvJBz2blvxJKXwg5b+W/3LxxUph35b8zaykg7X/lvzbM0HgiiOW/zOuIQzaQ5b/xRuaRP5jlv6Xd6GM+oOW/kWKARBOo5b8/jubIyq/lv3v18dB3t+W/GLDkKha/5b/BcK5hhsblv1nABG7dzeW/UmNCzCXV5b+rWWd8X9zlv8x5xr5k4+W/8xyR71Lq5b97E0NyMvHlv01p/S0B+OW/ogxVMZX+5b/9MhgjEgXmv8+goX+CC+a/1XlU/N8R5r8axAd2/Bfmv3uFBfcDHua/PZrqyfwj5r8zGvm84inmvzojSnuDL+a/dJfEWRE15r/idmhYjDrmv1XZd0XwP+a/CK2HLxNF5r/X9+EgIUrmv8O5hhkaT+a/Wi4bnfNT5r+K5CuBlFjmv5M16iEaXea/uf3yyYph5r9ckC3L12Xmv7BYw0Xuaea/3LsGfelt5r/3rdaJy3Hmv0yOO6WDdea/lYCYhAt55r+gGcQHdnzmv4NNnUfFf+a/XJNuS+SC5r9A3xYs1YXmv/zFbMmqiOa/Y1+y8WCL5r97LlOT4I3mv+PfZ1w4kOa/Iywq4nSS5r/KTj+oi5Tmv/W+8bVnlua/hQX3Ax6Y5r/v5qkOuZnmv9WSjnIwm+a/5LuUumSc5r9xr8xbdZ3mv79J06Bonua/t5bJcDyf5r9+kGXBxJ/mv8FUM2spoOa/3bOu0XKg5r+kxRnDnKDmv92zrtFyoOa/wVQzaymg5r9QqKePwJ/mv3O6LCY2n+a/TYV4JF6e5r+NJhdjYJ3mv49uhEVFnOa/yqSGNgCb5r8XZMvydZnmv50Rpb3Bl+a/znFuE+6V5r8K2A5G7JPmv5yjjo6rkea/JIEGmzqP5r9WEW4yqozmv2a/7nTniea/+boM/+mG5r+ZvAFmvoPmv4igavRqgOa/VaLsLeV85r+m8QuvJHnmvzAvwD46dea/81oJ3SVx5r8i4BCq1GzmvzCDMSJRaOa/jQjGwaVj5r/Jq3MMyF7mv3Ko34WtWea/+MJkqmBU5r/lszwP7k7mv7HCLR9JSea/pU5AE2FD5r+N7ErLSD3mv91gqMMKN+a/ONvcmJ4w5r8zGvm84inmv2dHqu/8Iua/AkuuYvEb5r+/SGjLuRTmv9gubTgsDea/KgMHtHQF5r/irfNvl/3lv+s6VFOS9eW/C9Ri8DDt5b97T+W0p+Tlvzqt26D22+W/HQWIghnT5b+ILT2a6snlv/9byY6NwOW/r3jqkQa35b9rm+JxUa3lvwtfX+tSo+W/XFg33h2Z5b/9M4P4wI7lv2U5CaUvhOW/I6RuZ1955b9kXHFxVG7lv94CCYofY+W/8uocA7JX5b+KIM7DCUzlv9KL2v0qQOW/Dwnf+xs05b/nx19a1Cflv0HUfQBSG+W/kfKTap8O5b+RRgVOtgHlv/7zNGCQ9OS/G9e/6zPn5L9yqN+FrdnkvzXTvU7qy+S/N2+cFOa95L8XKZSFr6/kvzHRIAVPoeS/5Lop5bWS5L+TOZZ31YPkvx/WG7XCdOS/5WA2AYZl5L+g/UgRGVbkv+RqZFdaRuS/M95Wem025L+8P96rVibkv2ebG9MTFuS/V+vE5XgF5L+AKQMHtPTjv8xh9x3D4+O/OpShKqbS478Er5Y7M8Hjv/DDQUKUr+O//tKiPsmd478Z6NoX0IvjvwCquHGLeeO/xomvdhRn47+uY1xxcVTjv4tPATCeQeO/esTouYUu478abyu9Nhvjv/IHA8+9B+O/ksoUcxD04r+f5uRFJuDiv0ZEMXkDzOK/D5wzorS34r+JKZFEL6Piv5z4akdxjuK/ePF+3H554r9I/Io1XGTiv8k88gcDT+K/5L7VOnE54r8hO29jsyPivw/tYwW/DeK/mODUB5L34b/n/X+cMOHhv4f9nlinyuG/qUpbXOOz4b9P5bSn5Jzhv+qRBre1heG/1SDM7V5u4b+fzarP1Vbhv3kDzHwHP+G/jSeCOA8n4b/aOc0C7Q7hv0pGzsKe9uC/nfNTHAfe4L8qj26ERcXgvwYN/RNcrOC/M23/ykqT4L8Whsjp63ngv0mBBTBlYOC/41KVtrhG4L+2ErpL4izgv4RnQpPEEuC/FVW/0vnw37/wh5//Hrzfvz6XqUnwht+/N3Fyv0NR379HV+nuOhvfv/cBSG3i5N6/R3GOOjqu3r/MY83IIHfevwySPq2iP96/R1UTRN0H3r/IDFTGv8/dvwQAx549l92/Kxcq/1pe3b8f2zLgLCXdvyqr6Xqi69y/TYdOz7ux3L8PKJtyhXfcv+nUlc/yPNy/CHb8FwgC3L+Z84x9ycbbv/cdw2M/i9u/bVSnA1lP278of/eOGhPbv1WGcTeI1tq/qgoNxLKZ2r9FgxQ8hVzav8kfDDz3Htq/GmmpvB3h2b/CFyZTBaPZvwmLijidZNm/DDohdNAl2b/dlV0wuObYvzE/NzRlp9i/rmUyHM9n2L9eDybFxyfYv2Qe+YOB59e/7nppigCn17/NPLmmQGbXvw5qv7UTJde/pPyk2qfj1r++3CdHAaLWv1sKSPsfYNa/tHOaBdod1r9jQswlVdvVv5Zem42VmNW/S8gHPZtV1b9zDp4JTRLVv8TRVbq7ztS/l+Kqsu+K1L8cKVsk7UbUv20csRafAtS/uqRquwm+07/kSj0LQnnTv2VW73A7NNO/aK8+Hvru0r+Uha+vdanSv3GRe7q6Y9K/0erkDMUd0r+0keumlNfRv3VWC+wxkdG/jYAKR5BK0b9U4GQbuAPRv811GmmpvNC/f/lkxXB10L+G4o43+S3Qv34CKEaWzM+/Bkzg1t08z78AcsKE0azOv1wDWyVYHM6/vi8uVWmLzb/uCKcFL/rMv5C+SdOgaMy/SYCaWrbWy79kraHUXkTLv/K20muzscq/pz0l58Qeyr8qcR3jiovJv7M/UG7b98i/ZYuk3ehjyL8/VBoxs8/Hv0GasWg6O8e/ABx79lymxr+MSuoENBHGv/aWcr7Ye8W/5DCYv0LmxL+OBvAWSFDEvxb6YBkbusO/ITtvY7Mjw7+wyRr1EI3Cv2fV52or9sG/Rl7WxAJfwb9e1VktsMfAv1Vq9kArMMC/nplgONcwv7+Y+Q5+4gC+v7vW3qeq0Ly/5E7pYP2fu781RBX+DG+6v5dL9EO2Pbm/xv94ChQMuL/DYKNRJtq2v+FE9Gvrp7W/f/lkxXB1tL9Crnn6rUKzv4Uzrm6rD7K/SwaAKm7csL+Ujs3pDVKvv+kE2VfD6qy/UwoVdxeDqr+HP3kOGxuov+Px/onbsqW/EM6njlVKo7+vhnqwe+Ggv2auwhzz8Jy/idi7mpcemL/Uf9b8+EuTv3RgOUIG8oy/FW6/ncBLg79ikh1dnUpzv9GE8p51TMQ+sBIcLNZPcz88rj4FXU6DP4Mv8eyX9Iw/W2cy0kFNkz9hGRu62R+YP0zjF15J8pw/IiEl0SbioD98blee9kqjP6flrPR/s6U/ooYl1MIbqD8X/sLhu4OqPwVMhR1r66w/AC99+a5Srz+B1leyvtywPxJXhFH/D7I/z9FP3QFDsz+1yTxNwXW0P2vrTEY6qLU/UIR5NHratj9UI0/tZwy4P3lFS3kIPrk/w2fr4GBvuj9xcr9DUaC7P5JZvcPt0Lw/Jh3lYDYBvj8rvTYbKzG/Pxx8YTJVMMA/JefEHtrHwD8NcEG2LF/BPy7nUlxV9sE/d9uF5jqNwj+NfF7x1CPDP90LzApFusM/VRhbCHJQxD9QcodNZObEP72o3a8CfMU/U1xV9l0Rxj9sXWqEfqbGPwisHFpkO8c/q5UJv9TPxz/RzJNrCmTIP3pRu18F+Mg/8YKI1LSLyT8TfxR15h7KP134wfnUsco/0O6QYoBEyz8QkgVM4NbLP/z/OGHCaMw/WkqWk1D6zD+FQZlGk4vNPyMVxhaCHM4/bLOxEvOszj9xjc9k/zzPP0QUkzfAzM8/amtEMA4u0D9ighq+hXXQP7D+z2G+vNA/OGkaFM0D0T9wCcA/pUrRPyv3ArNCkdE/lxqhn6nX0T+Hi9zT1R3SPycyc4HLY9I/Siandoap0j8eUDblCu/SP0jfpGlQNNM/mus00lJ50z9vRWKCGr7TPyO9qN2vAtQ/0clS6/1G1D9Ng6J5AIvUP3pyTYHMztQ/Ka+V0F0S1T8Baf8DrFXVP0z/klSmmNU/GePD7GXb1T9qFJLM6h3WP+PCgZAsYNY/dH0fDhKi1j9anZyhuOPWP8QKt3wkJdc/g92wbVFm1z+kG2FREafXPxq/8EqS59c/FLAdjNgn2D9kBirj32fYP+ffLvt1p9g/kzZV98jm2D+V8loJ3SXZP78rgv+tZNk/eLgdGhaj2T/QCaGDLuHZP1HYRdEDH9o/zTtO0ZFc2j8zw0ZZv5naP94+q8yU1to/sDcxJCcT2z/2DOGYZU/bP4DW/PhLi9s/IazGEtbG2z+QLjatFALcP3GNz2T/PNw/mODUB5J33D/VP4hkyLHcP7JjIxCv69w/p5NsdTkl3T+zz2OUZ17dP424ADRKl90/I93PKcjP3T+iJY+n5QfeP5RKeEKvP94/VBwHXi133j+iQQqeQq7eP4C6gQLv5N4/oidlUkMb3z+/KaxUUFHfP5lnJa34ht8/eUDZlCu83z+dDflnBvHfP8hD393KEuA/4/p3feYs4D8QO1PovEbgP3dpw2FpYOA/RG6GG/B54D9hVb38TpPgPzT1ukVgrOA/V3cstknF4D/L2xFOC97gP3cujPSi9uA/CCKLNPEO4T+7D0BqEyfhP6fria4LP+E/tcGJ6NdW4T8DCYofY27hPxh6xOi5heE/fc1y2eic4T/XMhmO57PhP53xfXGpyuE//vFetTLh4T+u1LMglPfhPybhQh7BDeI/OC9OfLUj4j8Rp5NsdTniP+Aw0SAFT+I/deRIZ2Bk4j+O5V31gHniP7PsSWBzjuI/nx1wXTGj4j8lkBK7trfiP1w4EJIFzOI/ttrDXijg4j+pvvOLEvTiPwn84ee/B+M/MGMK1jgb4z+RuMfShy7jP4tPATCeQeM/xVc7inNU4z/Gia92FGfjPxeel4qNeeM/L9y5MNKL4z8Vx4FXy53jP/DDQUKUr+M/GqN1VDXB4z86lKEqptLjP8xh9x3D4+M/gCkDB7T04z9u36P+egXkP36P+usVFuQ/0zO9xFgm5D9K0jWTbzbkP+RqZFdaRuQ/oP1IERlW5D/lYDYBhmXkPx/WG7XCdOQ/kzmWd9WD5D/kuinltZLkPzHRIAVPoeQ/FymUha+v5D83b5wU5r3kPzXTvU7qy+Q/cqjfha3Z5D8b17/rM+fkP/7zNGCQ9OQ/kUYFTrYB5T+R8pNqnw7lP0HUfQBSG+U/58dfWtQn5T8PCd/7GzTlP9KL2v0qQOU/iiDOwwlM5T/y6hwDslflP94CCYofY+U/ZFxxcVRu5T8jpG5nX3nlP2U5CaUvhOU//TOD+MCO5T9cWDfeHZnlPwtfX+tSo+U/a5vicVGt5T+veOqRBrflP/9byY6NwOU/iC09murJ5T8dBYiCGdPlPzqt26D22+U/e0/ltKfk5T8L1GLwMO3lP+s6VFOS9eU/4q3zb5f95T8qAwe0dAXmP9gubTgsDeY/v0hoy7kU5j8CS65i8RvmP2dHqu/8IuY/Mxr5vOIp5j8429yYnjDmP91gqMMKN+Y/jexKy0g95j+lTkATYUPmP8i2DDhLSeY/5bM8D+5O5j/4wmSqYFTmP3Ko34WtWeY/yatzDMhe5j+NCMbBpWPmPzCDMSJRaOY/OdTvwtZs5j/zWgndJXHmPzAvwD46deY/pvELryR55j9Vouwt5XzmP5+USQ1tgOY/mbwBZr6D5j/5ugz/6YbmP2a/7nTnieY/VhFuMqqM5j8kgQabOo/mP5yjjo6rkeY/CtgORuyT5j/OcW4T7pXmP50Rpb3Bl+Y/F2TL8nWZ5j/hmGVPApvmP49uhEVFnOY/pBr2e2Kd5j9NhXgkXp7mP4quCz84n+Y/Z5yGqMKf5j/BVDNrKaDmP92zrtFyoOY/pMUZw5yg5j/ds67RcqDmP8FUM2spoOY/fpBlwcSf5j/OiqiJPp/mP9U9srlqnuY/ca/MW3Wd5j/7r3PTZpzmP+yGbYsym+Y/7+apDrmZ5j+c+dUcIJjmPwuz0M5pluY/4UIewY2U5j8jLCridJLmP+PfZ1w4kOY/kiIyrOKN5j96U5EKY4vmPxO6S+KsiOY/QN8WLNWF5j9ck25L5ILmP4NNnUfFf+Y/tw2jIHh85j+VgJiEC3nmP2KCGr6FdeY/DqK1os1x5j/cuwZ96W3mP8dMol7waeY/XJAty9dl5j/Q8dHijGHmP6opyTocXeY/odgKmpZY5j9wIvq19VPmP8O5hhkaT+Y/1/fhICFK5j8foWZIFUXmP1XZd0XwP+Y/+WpHcY465j+Li6NyEzXmP1AXKZSFL+Y/Mxr5vOIp5j9Ujsni/iPmP5J55A8GHuY/GsQHdvwX5j/sbTMV4hHmP8+goX+CC+Y/Eyf3OxQF5j+iDFUxlf7lP2Rd3EYD+OU/exNDcjLx5T/zHJHvUurlP+Ntpddm4+U/wk1GlWHc5T9pVyHlJ9XlP1nABG7dzeU/2GSNeojG5T8vpMNDGL/lP5Lp0Ol5t+U/VoLF4cyv5T+oVl9dFajlP6Xd6GM+oOU/CDvFqkGY5T/j32dcOJDlP03Ar5EkiOU/Sl8IOe9/5T/cvHFSmHflPxJKXwg5b+U/7gbRWtFm5T8xmpXtQ17lP0vIBz2bVeU/IhrdQexM5T+dmzbjNETlP2n/A6xVO+U/UdobfGEy5T8MzXUaaSnlP4LjMm5qIOU/G/Sltz8X5T8VWABTBg7lP+HTnLzIBOU/lltaDYn75D9B9Q8iGfLkP6eyKOyi6OQ/34eDhCjf5D8vUb01sNXkPy9QUmABzOQ/L0/nilLC5D8vTny1o7jkPxlZMsfyruQ/4IEBhA+l5D/Vko5yMJvkP8qjG2FRkeQ/kszqHW6H5D9872/QXn3kP6rukc1Vc+Q/7+GS405p5D/DEDl9PV/kPyr+74gKVeQ/1sdD391K5D+veVVntUDkP+l+TkF+NuQ/+x711yss5D9pjxfS4SHkPxrc1haeF+Q/FoielEkN5D8Xt9EA3gLkP4uqX+l8+OM/WW5pNSTu4z9anZyhuOPjP6Yr2EY82eM/Y35uaMrO4z+piT4fZcTjP90jm6vmueM/t+171F+v4z8DfLd546TjP+22C811muM/x4Ds9e6P4z9dbjDUYYXjP5IIjWDjeuM/Zk8Cm3Nw4z/7PEZ55mXjP74SSIldW+M/CqGDLuFQ4z8L0LaadUbjP86luKrsO+M/1ldXBWox4z+qnsw/+ibjPwaeew+XHOM/DVAaahQS4z/LorCLogfjPz6WPnRB/eI/OUIG8uzy4j8NiXssfejiP65kx0Yg3uI/G9XpQNbT4j/NIamFksniP5vlstE5v+I/YyZRL/i04j8P8KSFy6riP9Gt1/SgoOI/3soSnWWW4j8STaCIRYziPypY42w6guI/WFcFajF44j/QtS+gF27iP55haksdZOI/fH4YITxa4j8tswjFVlDiP4MXfQVpRuI/F9Uiopg84j/q6/ma5TLiP2EyVTAqKeI/2XiwxW4f4j9iMH+FzBXiP20dHOxNDOI/8FF/vcIC4j+gbqDAO/nhP4/k8h/S7+E/6Zs0DYrm4T+kpl1MM93hP/9dnznr0+E/aoZUUbzK4T9B8Pj2rsHhP5ChYweVuOE/lfPF3ouv4T/YnlkSoKbhP3CX/brTneE/Uu+pnPaU4T9crKjBNIzhP6TC2EKQg+E/KzI6IAl74T/8AKQ2cXLhPzgR/dr6aeE/s3qH26Fh4T8/VYUGYlnhP0J3SZwVUeE/38K68e5I4T/RWzy850DhP4+JlGbzOOE/3PKRlPQw4T8HYtnMISnhP50SEJNwIeE/0m9fB84Z4T+t/DIYIxLhP5J3DmWoCuE/4zPZP08D4T+mtP6WAPzgP2k1JO6x9OA/CryTT4/t4D9bYI+JlObgP/DgJw6g3+A/skl+xK/Y4D87xD9s6dHgP7k4KjdRy+A/Nq0UArnE4D8l5llJK77gP65ITFDDt+A/b4EExY+x4D8D0v4HWKvgP2O3zyozpeA/RtJu9DGf4D9Kz/QSY5ngPwvw3eaNk+A/3IE65dGN4D9HPUSjO4jgP6bydoTTguA/wMsMG2V94D9H5pE/GHjgP1A25QrvcuA/IJijx+9t4D/DEaRS7GjgP+jAcoQMZOA/1IGsp1Zf4D8rhNVYwlrgP1aeQNgpVuA/dLLUer9R4D8s8BXdek3gPyOHiJtTSeA/GR77WSxF4D8ao3VUNUHgP8xFfCdmPeA/jln2JLA54D9QbXAi+jXgP2JLj6Z6MuA/JEc6AyMv4D/Jy5pY4CvgP25Q+62dKOA/eZPfopMl4D9i3A2itSLgPwDGM2joH+A/zJcXYB8d4D/RP8HFihrgP/fJUYAoGOA/eSRens4V4D+ZK4NqgxPgP5c48kBkEeA/+wPltn0P4D+Nt5Vemw3gP+v/HObLC+A/EFoPXyYK4D+yZmSQuwjgP1RzucFQB+A/BvGBHf8F4D+AgLVq1wTgP0najT7mA+A/+z+H+fIC4D8C85ApHwLgP+er5GN3AeA/wF5hwf0A4D+ZEd4ehADgPwvuBzwwAOA/RNycSgYA4D9E3JxKBgDgPwBBqOUCC5EIb7ckB+xSIUDWNsXjoloiQAh2/BcIciNAmpmZmZmZJEDaccPvptMlQEdy+Q/pHydAAAAAAACAKEAcQL/v3/QpQAAAAAAAgCtAqU4Hsp4iLUAAi/z6Id4uQGpOXmQCWjBAb7ckB+xSMUDWNsXjoloyQAh2/BcIcjNAQkC+hAqaNEA6evzeptM1QOhpwCDpHzdAAAAAAACAOEC9N4YA4PQ5QAAAAAAAgDtASkbOwp4iPUAAi/z6Id4+QJrS+lsCWkBAnzvB/utSQUDWNsXjolpCQNjxXyAIckNAcsRafAqaREA6evzeptNFQOhpwCDpH0dAAAAAAACASEC9N4YA4PRJQAAAAAAAgEtASkbOwp4iTUDRBmADIt5OQIKQLGACWlBAnzvB/utSUUDueJPfolpSQNjxXyAIclNAWoKMgAqaVEA6evzeptNVQOhpwCDpH1dAdVq3Qe1/WEC9N4YA4PRZQAAAAAAAgFtAYYicvp4iXUDpSC7/Id5eQIKQLGACWmBAkxraAOxSYUDueJPfolpiQNjxXyAIcmNAWoKMgAqaZEA6evzeptNlQOhpwCDpH2dAgXueP+1/aEC9N4YA4PRpQAAAAAAAgGtAVWe1wJ4ibUDpSC7/Id5uQIKQLGACWnBAGavN/+tScUDueJPfolpyQNjxXyAIcnNA4BKAfwqadEC06QjgptN1QG76sx/pH3dAgXueP+1/eEC9N4YA4PR5QAAAAAAAgHtA2/eov54ifUBjuDoAIt5+QIKQLGACWoBAGavN/+tSgUCrsBngolqCQBu62R8IcoNAnUoGgAqahEC06QjgptOFQCsyOiDpH4dAPrMkQO1/iEAAAAAA4PSJQAAAAAAAgItAmC8vwJ4ijUBjuDoAIt6OQKN06V8CWpBA+MYQAOxSkUCrsBngolqSQPrVHCAIcpNAnUoGgAqalEC06QjgptOVQEwW9x/pH5dAX5fhP+1/mEAAAAAA4PSZQAAAAAAAgJtAuhPsv54inUCEnPf/Id6eQJMCC2ACWqBA+MYQAOxSoUC8IvjfolqiQApI+x8IcqNAnUoGgAqapEC06QjgptOlQEwW9x/pH6dATiUDQO1/qEAAAAAA4PSpQAAAAAAAgKtAhetRuJ4irUCEnPf/Id6uQJs7+l8CWrBAAAAAAOxSsUC8IvjfolqyQApI+x8IcrNAnUoGgAqatEC8IvjfptO1QETdByDpH7dATiUDQO1/uEAAAAAA4PS5QAAAAAAAgLtAstr8v54ivUCEnPf/Id6+QBefAmACWsBAAAAAAOxSwUA4hgDgolrCQIarAyAIcsNAIef9fwqaxEA4hgDgptPFQMh5/x/pH8dATiUDQO1/yEAAAAAA4PTJQE9nZ1N2b3JiaXMAAAAAAAAFAEHE7QILAnUCAEHc7QILCnYCAAB3AgAAgL0AQfTtAgsBAgBBg+4CCwX//////wBB+O8CCwKsvQBBsPACCwEFAEG88AILAnsCAEHU8AILDnYCAAB8AgAA2L0AAAAEAEHs8AILAQEAQfvwAgsFCv////8AQcDxAgsJMLgAAAAAAAAJAEHU8QILAnUCAEHo8QILEn0CAAAAAAAAdwIAAOjBAAAABABBlPICCwT/////AJWqCARuYW1lAYyqCLgKABZfZW1iaW5kX3JlZ2lzdGVyX2NsYXNzASJfZW1iaW5kX3JlZ2lzdGVyX2NsYXNzX2NvbnN0cnVjdG9yAiVfZW1iaW5kX3JlZ2lzdGVyX2NsYXNzX2NsYXNzX2Z1bmN0aW9uAx9fZW1iaW5kX3JlZ2lzdGVyX2NsYXNzX3Byb3BlcnR5BB9fZW1iaW5kX3JlZ2lzdGVyX2NsYXNzX2Z1bmN0aW9uBRVfZW1iaW5kX3JlZ2lzdGVyX2VudW0GG19lbWJpbmRfcmVnaXN0ZXJfZW51bV92YWx1ZQcaX2VtYmluZF9yZWdpc3Rlcl9zbWFydF9wdHIIGF9fY3hhX2FsbG9jYXRlX2V4Y2VwdGlvbgkLX19jeGFfdGhyb3cKEV9lbXZhbF90YWtlX3ZhbHVlCw1fZW12YWxfaW5jcmVmDA1fZW12YWxfZGVjcmVmDQtfZW12YWxfY2FsbA4Fcm91bmQPBGV4aXQQDV9fYXNzZXJ0X2ZhaWwRBl9fbG9jaxIIX191bmxvY2sTD19fd2FzaV9mZF9jbG9zZRQKX19zeXNjYWxsNRUMX19zeXNjYWxsMjIxFgtfX3N5c2NhbGw1NBcOX193YXNpX2ZkX3JlYWQYD19fd2FzaV9mZF93cml0ZRkYX193YXNpX2Vudmlyb25fc2l6ZXNfZ2V0GhJfX3dhc2lfZW52aXJvbl9nZXQbCl9fbWFwX2ZpbGUcC19fc3lzY2FsbDkxHQpzdHJmdGltZV9sHgVhYm9ydB8VX2VtYmluZF9yZWdpc3Rlcl92b2lkIBVfZW1iaW5kX3JlZ2lzdGVyX2Jvb2whG19lbWJpbmRfcmVnaXN0ZXJfc3RkX3N0cmluZyIcX2VtYmluZF9yZWdpc3Rlcl9zdGRfd3N0cmluZyMWX2VtYmluZF9yZWdpc3Rlcl9lbXZhbCQYX2VtYmluZF9yZWdpc3Rlcl9pbnRlZ2VyJRZfZW1iaW5kX3JlZ2lzdGVyX2Zsb2F0JhxfZW1iaW5kX3JlZ2lzdGVyX21lbW9yeV92aWV3JxZlbXNjcmlwdGVuX3Jlc2l6ZV9oZWFwKBVlbXNjcmlwdGVuX21lbWNweV9iaWcpC3NldFRlbXBSZXQwKhpsZWdhbGltcG9ydCRfX3dhc2lfZmRfc2VlaysRX193YXNtX2NhbGxfY3RvcnMsUEVtc2NyaXB0ZW5CaW5kaW5nSW5pdGlhbGl6ZXJfbXlfbW9kdWxlOjpFbXNjcmlwdGVuQmluZGluZ0luaXRpYWxpemVyX215X21vZHVsZSgpLZUBZW1zY3JpcHRlbjo6Y2xhc3NfPHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiwgZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok5vQmFzZUNsYXNzPiBlbXNjcmlwdGVuOjpyZWdpc3Rlcl92ZWN0b3I8aW50PihjaGFyIGNvbnN0KikungFlbXNjcmlwdGVuOjpjbGFzc188c3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+LCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Tm9CYXNlQ2xhc3M+IGVtc2NyaXB0ZW46OnJlZ2lzdGVyX3ZlY3Rvcjxkb3VibGU+KGNoYXIgY29uc3QqKS+YAWVtc2NyaXB0ZW46OmNsYXNzXzxzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiwgZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok5vQmFzZUNsYXNzPiBlbXNjcmlwdGVuOjpyZWdpc3Rlcl92ZWN0b3I8Y2hhcj4oY2hhciBjb25zdCopMLMBZW1zY3JpcHRlbjo6Y2xhc3NfPHN0ZDo6X18yOjp2ZWN0b3I8dW5zaWduZWQgY2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjx1bnNpZ25lZCBjaGFyPiA+LCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Tm9CYXNlQ2xhc3M+IGVtc2NyaXB0ZW46OnJlZ2lzdGVyX3ZlY3Rvcjx1bnNpZ25lZCBjaGFyPihjaGFyIGNvbnN0KikxmwFlbXNjcmlwdGVuOjpjbGFzc188c3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiwgZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok5vQmFzZUNsYXNzPiBlbXNjcmlwdGVuOjpyZWdpc3Rlcl92ZWN0b3I8ZmxvYXQ+KGNoYXIgY29uc3QqKTJKdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8dmVjdG9yVG9vbHM+KHZlY3RvclRvb2xzKikzRHZvaWQgZW1zY3JpcHRlbjo6aW50ZXJuYWw6OnJhd19kZXN0cnVjdG9yPHZlY3RvclRvb2xzPih2ZWN0b3JUb29scyopNEdlbXNjcmlwdGVuOjppbnRlcm5hbDo6SW52b2tlcjx2ZWN0b3JUb29scyo+OjppbnZva2UodmVjdG9yVG9vbHMqICgqKSgpKTU+dmVjdG9yVG9vbHMqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8dmVjdG9yVG9vbHM+KCk24AFlbXNjcmlwdGVuOjppbnRlcm5hbDo6SW52b2tlcjx2b2lkLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mPjo6aW52b2tlKHZvaWQgKCopKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYpLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4qKTdUdmVjdG9yVG9vbHM6OmNsZWFyVmVjdG9yRGJsKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYpOEx2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpU2V0dGluZ3M+KG1heGlTZXR0aW5ncyopOWJlbXNjcmlwdGVuOjppbnRlcm5hbDo6SW52b2tlcjx2b2lkLCBpbnQsIGludCwgaW50Pjo6aW52b2tlKHZvaWQgKCopKGludCwgaW50LCBpbnQpLCBpbnQsIGludCwgaW50KToibWF4aVNldHRpbmdzOjpzZXR1cChpbnQsIGludCwgaW50KTsjbWF4aVNldHRpbmdzOjpnZXRTYW1wbGVSYXRlKCkgY29uc3Q8IG1heGlTZXR0aW5nczo6c2V0U2FtcGxlUmF0ZShpbnQpPZMBaW50IGVtc2NyaXB0ZW46OmludGVybmFsOjpHZXR0ZXJQb2xpY3k8aW50IChtYXhpU2V0dGluZ3M6OiopKCkgY29uc3Q+OjpnZXQ8bWF4aVNldHRpbmdzPihpbnQgKG1heGlTZXR0aW5nczo6KiBjb25zdCYpKCkgY29uc3QsIG1heGlTZXR0aW5ncyBjb25zdCYpPo8Bdm9pZCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6U2V0dGVyUG9saWN5PHZvaWQgKG1heGlTZXR0aW5nczo6KikoaW50KT46OnNldDxtYXhpU2V0dGluZ3M+KHZvaWQgKG1heGlTZXR0aW5nczo6KiBjb25zdCYpKGludCksIG1heGlTZXR0aW5ncyYsIGludCk/JG1heGlTZXR0aW5nczo6Z2V0TnVtQ2hhbm5lbHMoKSBjb25zdEAhbWF4aVNldHRpbmdzOjpzZXROdW1DaGFubmVscyhpbnQpQSNtYXhpU2V0dGluZ3M6OmdldEJ1ZmZlclNpemUoKSBjb25zdEIgbWF4aVNldHRpbmdzOjpzZXRCdWZmZXJTaXplKGludClDQnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlPc2M+KG1heGlPc2MqKUQ2bWF4aU9zYyogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpT3NjPigpRZgBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpT3NjOjoqKShkb3VibGUpLCBkb3VibGUsIG1heGlPc2MqLCBkb3VibGU+OjppbnZva2UoZG91YmxlIChtYXhpT3NjOjoqIGNvbnN0JikoZG91YmxlKSwgbWF4aU9zYyosIGRvdWJsZSlG2AFlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlPc2M6OiopKGRvdWJsZSwgZG91YmxlLCBkb3VibGUpLCBkb3VibGUsIG1heGlPc2MqLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlPjo6aW52b2tlKGRvdWJsZSAobWF4aU9zYzo6KiBjb25zdCYpKGRvdWJsZSwgZG91YmxlLCBkb3VibGUpLCBtYXhpT3NjKiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSlHuAFlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlPc2M6OiopKGRvdWJsZSwgZG91YmxlKSwgZG91YmxlLCBtYXhpT3NjKiwgZG91YmxlLCBkb3VibGU+OjppbnZva2UoZG91YmxlIChtYXhpT3NjOjoqIGNvbnN0JikoZG91YmxlLCBkb3VibGUpLCBtYXhpT3NjKiwgZG91YmxlLCBkb3VibGUpSHxlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlPc2M6OiopKCksIGRvdWJsZSwgbWF4aU9zYyo+OjppbnZva2UoZG91YmxlIChtYXhpT3NjOjoqIGNvbnN0JikoKSwgbWF4aU9zYyopSZIBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAobWF4aU9zYzo6KikoZG91YmxlKSwgdm9pZCwgbWF4aU9zYyosIGRvdWJsZT46Omludm9rZSh2b2lkIChtYXhpT3NjOjoqIGNvbnN0JikoZG91YmxlKSwgbWF4aU9zYyosIGRvdWJsZSlKTHZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlFbnZlbG9wZT4obWF4aUVudmVsb3BlKilLQG1heGlFbnZlbG9wZSogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpRW52ZWxvcGU+KClMhANlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlFbnZlbG9wZTo6KikoaW50LCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mKSwgZG91YmxlLCBtYXhpRW52ZWxvcGUqLCBpbnQsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiY+OjppbnZva2UoZG91YmxlIChtYXhpRW52ZWxvcGU6OiogY29uc3QmKShpbnQsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYpLCBtYXhpRW52ZWxvcGUqLCBpbnQsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiopTboBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAobWF4aUVudmVsb3BlOjoqKShpbnQsIGRvdWJsZSksIHZvaWQsIG1heGlFbnZlbG9wZSosIGludCwgZG91YmxlPjo6aW52b2tlKHZvaWQgKG1heGlFbnZlbG9wZTo6KiBjb25zdCYpKGludCwgZG91YmxlKSwgbWF4aUVudmVsb3BlKiwgaW50LCBkb3VibGUpTiJtYXhpRW52ZWxvcGU6OmdldEFtcGxpdHVkZSgpIGNvbnN0TyJtYXhpRW52ZWxvcGU6OnNldEFtcGxpdHVkZShkb3VibGUpUCFtYXhpRW52ZWxvcGU6OmdldFZhbGluZGV4KCkgY29uc3RRHm1heGlFbnZlbG9wZTo6c2V0VmFsaW5kZXgoaW50KVJOdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aURlbGF5bGluZT4obWF4aURlbGF5bGluZSopU0JtYXhpRGVsYXlsaW5lKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlEZWxheWxpbmU+KClU5AFlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlEZWxheWxpbmU6OiopKGRvdWJsZSwgaW50LCBkb3VibGUpLCBkb3VibGUsIG1heGlEZWxheWxpbmUqLCBkb3VibGUsIGludCwgZG91YmxlPjo6aW52b2tlKGRvdWJsZSAobWF4aURlbGF5bGluZTo6KiBjb25zdCYpKGRvdWJsZSwgaW50LCBkb3VibGUpLCBtYXhpRGVsYXlsaW5lKiwgZG91YmxlLCBpbnQsIGRvdWJsZSlV+AFlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlEZWxheWxpbmU6OiopKGRvdWJsZSwgaW50LCBkb3VibGUsIGludCksIGRvdWJsZSwgbWF4aURlbGF5bGluZSosIGRvdWJsZSwgaW50LCBkb3VibGUsIGludD46Omludm9rZShkb3VibGUgKG1heGlEZWxheWxpbmU6OiogY29uc3QmKShkb3VibGUsIGludCwgZG91YmxlLCBpbnQpLCBtYXhpRGVsYXlsaW5lKiwgZG91YmxlLCBpbnQsIGRvdWJsZSwgaW50KVZIdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aUZpbHRlcj4obWF4aUZpbHRlciopVzxtYXhpRmlsdGVyKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlGaWx0ZXI+KClYHW1heGlGaWx0ZXI6OmdldEN1dG9mZigpIGNvbnN0WR1tYXhpRmlsdGVyOjpzZXRDdXRvZmYoZG91YmxlKVogbWF4aUZpbHRlcjo6Z2V0UmVzb25hbmNlKCkgY29uc3RbIG1heGlGaWx0ZXI6OnNldFJlc29uYW5jZShkb3VibGUpXEJ2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpTWl4PihtYXhpTWl4KildNm1heGlNaXgqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aU1peD4oKV6WA2Vtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKG1heGlNaXg6OiopKGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgZG91YmxlKSwgdm9pZCwgbWF4aU1peCosIGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgZG91YmxlPjo6aW52b2tlKHZvaWQgKG1heGlNaXg6OiogY29uc3QmKShkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGRvdWJsZSksIG1heGlNaXgqLCBkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiosIGRvdWJsZSlftgNlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChtYXhpTWl4OjoqKShkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGRvdWJsZSwgZG91YmxlKSwgdm9pZCwgbWF4aU1peCosIGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgZG91YmxlLCBkb3VibGU+OjppbnZva2Uodm9pZCAobWF4aU1peDo6KiBjb25zdCYpKGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgZG91YmxlLCBkb3VibGUpLCBtYXhpTWl4KiwgZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4qLCBkb3VibGUsIGRvdWJsZSlg1gNlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChtYXhpTWl4OjoqKShkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUpLCB2b2lkLCBtYXhpTWl4KiwgZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlPjo6aW52b2tlKHZvaWQgKG1heGlNaXg6OiogY29uc3QmKShkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUpLCBtYXhpTWl4KiwgZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4qLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKWFEdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aUxpbmU+KG1heGlMaW5lKiliOG1heGlMaW5lKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlMaW5lPigpYxZtYXhpTGluZTo6cGxheShkb3VibGUpZCltYXhpTGluZTo6cHJlcGFyZShkb3VibGUsIGRvdWJsZSwgZG91YmxlKWXWAWVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKG1heGlMaW5lOjoqKShkb3VibGUsIGRvdWJsZSwgZG91YmxlKSwgdm9pZCwgbWF4aUxpbmUqLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlPjo6aW52b2tlKHZvaWQgKG1heGlMaW5lOjoqIGNvbnN0JikoZG91YmxlLCBkb3VibGUsIGRvdWJsZSksIG1heGlMaW5lKiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSlmH21heGlMaW5lOjp0cmlnZ2VyRW5hYmxlKGRvdWJsZSlnGm1heGlMaW5lOjppc0xpbmVDb21wbGV0ZSgpaEZ2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpWEZhZGU+KG1heGlYRmFkZSopaYcEZW1zY3JpcHRlbjo6aW50ZXJuYWw6Okludm9rZXI8c3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+LCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBkb3VibGU+OjppbnZva2Uoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+ICgqKShzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBkb3VibGUpLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4qLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4qLCBkb3VibGUpaooBbWF4aVhGYWRlOjp4ZmFkZShzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBkb3VibGUpa4EBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Okludm9rZXI8ZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlPjo6aW52b2tlKGRvdWJsZSAoKikoZG91YmxlLCBkb3VibGUsIGRvdWJsZSksIGRvdWJsZSwgZG91YmxlLCBkb3VibGUpbChtYXhpWEZhZGU6OnhmYWRlKGRvdWJsZSwgZG91YmxlLCBkb3VibGUpbVl2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpTGFnRXhwPGRvdWJsZT4gPihtYXhpTGFnRXhwPGRvdWJsZT4qKW5NbWF4aUxhZ0V4cDxkb3VibGU+KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlMYWdFeHA8ZG91YmxlPiA+KClvKG1heGlMYWdFeHA8ZG91YmxlPjo6aW5pdChkb3VibGUsIGRvdWJsZSlw3gFlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChtYXhpTGFnRXhwPGRvdWJsZT46OiopKGRvdWJsZSwgZG91YmxlKSwgdm9pZCwgbWF4aUxhZ0V4cDxkb3VibGU+KiwgZG91YmxlLCBkb3VibGU+OjppbnZva2Uodm9pZCAobWF4aUxhZ0V4cDxkb3VibGU+OjoqIGNvbnN0JikoZG91YmxlLCBkb3VibGUpLCBtYXhpTGFnRXhwPGRvdWJsZT4qLCBkb3VibGUsIGRvdWJsZSlxJW1heGlMYWdFeHA8ZG91YmxlPjo6YWRkU2FtcGxlKGRvdWJsZSlyIW1heGlMYWdFeHA8ZG91YmxlPjo6dmFsdWUoKSBjb25zdHMkbWF4aUxhZ0V4cDxkb3VibGU+OjpnZXRBbHBoYSgpIGNvbnN0dCRtYXhpTGFnRXhwPGRvdWJsZT46OnNldEFscGhhKGRvdWJsZSl1Lm1heGlMYWdFeHA8ZG91YmxlPjo6Z2V0QWxwaGFSZWNpcHJvY2FsKCkgY29uc3R2Lm1heGlMYWdFeHA8ZG91YmxlPjo6c2V0QWxwaGFSZWNpcHJvY2FsKGRvdWJsZSl3Im1heGlMYWdFeHA8ZG91YmxlPjo6c2V0VmFsKGRvdWJsZSl4SHZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlTYW1wbGU+KG1heGlTYW1wbGUqKXlCdm9pZCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6cmF3X2Rlc3RydWN0b3I8bWF4aVNhbXBsZT4obWF4aVNhbXBsZSopejxtYXhpU2FtcGxlKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlTYW1wbGU+KCl7HW1heGlTYW1wbGU6OmdldExlbmd0aCgpIGNvbnN0fPYCZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAobWF4aVNhbXBsZTo6Kikoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgaW50KSwgdm9pZCwgbWF4aVNhbXBsZSosIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGludD46Omludm9rZSh2b2lkIChtYXhpU2FtcGxlOjoqIGNvbnN0Jikoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgaW50KSwgbWF4aVNhbXBsZSosIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiosIGludCl9qwNlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxpbnQgKG1heGlTYW1wbGU6OiopKHN0ZDo6X18yOjp2ZWN0b3I8dW5zaWduZWQgY2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjx1bnNpZ25lZCBjaGFyPiA+JiwgaW50KSwgaW50LCBtYXhpU2FtcGxlKiwgc3RkOjpfXzI6OnZlY3Rvcjx1bnNpZ25lZCBjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHVuc2lnbmVkIGNoYXI+ID4mLCBpbnQ+OjppbnZva2UoaW50IChtYXhpU2FtcGxlOjoqIGNvbnN0Jikoc3RkOjpfXzI6OnZlY3Rvcjx1bnNpZ25lZCBjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHVuc2lnbmVkIGNoYXI+ID4mLCBpbnQpLCBtYXhpU2FtcGxlKiwgc3RkOjpfXzI6OnZlY3Rvcjx1bnNpZ25lZCBjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHVuc2lnbmVkIGNoYXI+ID4qLCBpbnQpfoIBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAobWF4aVNhbXBsZTo6KikoKSwgdm9pZCwgbWF4aVNhbXBsZSo+OjppbnZva2Uodm9pZCAobWF4aVNhbXBsZTo6KiBjb25zdCYpKCksIG1heGlTYW1wbGUqKX8TbWF4aVNhbXBsZTo6Y2xlYXIoKYAB5gFlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChtYXhpU2FtcGxlOjoqKShmbG9hdCwgZmxvYXQsIGJvb2wsIGJvb2wpLCB2b2lkLCBtYXhpU2FtcGxlKiwgZmxvYXQsIGZsb2F0LCBib29sLCBib29sPjo6aW52b2tlKHZvaWQgKG1heGlTYW1wbGU6OiogY29uc3QmKShmbG9hdCwgZmxvYXQsIGJvb2wsIGJvb2wpLCBtYXhpU2FtcGxlKiwgZmxvYXQsIGZsb2F0LCBib29sLCBib29sKYEBowRlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxib29sIChtYXhpU2FtcGxlOjoqKShzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+LCBpbnQpLCBib29sLCBtYXhpU2FtcGxlKiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiwgaW50Pjo6aW52b2tlKGJvb2wgKG1heGlTYW1wbGU6OiogY29uc3QmKShzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+LCBpbnQpLCBtYXhpU2FtcGxlKiwgZW1zY3JpcHRlbjo6aW50ZXJuYWw6OkJpbmRpbmdUeXBlPHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4sIHZvaWQ+OjondW5uYW1lZCcqLCBpbnQpggFCdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aU1hcD4obWF4aU1hcCopgwE3bWF4aU1hcDo6bGlubGluKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKYQB7gFlbXNjcmlwdGVuOjppbnRlcm5hbDo6RnVuY3Rpb25JbnZva2VyPGRvdWJsZSAoKikoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUpLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlPjo6aW52b2tlKGRvdWJsZSAoKiopKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUphQE3bWF4aU1hcDo6bGluZXhwKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKYYBN21heGlNYXA6OmV4cGxpbihkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSmHATVkb3VibGUgbWF4aU1hcDo6Y2xhbXA8ZG91YmxlPihkb3VibGUsIGRvdWJsZSwgZG91YmxlKYgBrgFlbXNjcmlwdGVuOjppbnRlcm5hbDo6RnVuY3Rpb25JbnZva2VyPGRvdWJsZSAoKikoZG91YmxlLCBkb3VibGUsIGRvdWJsZSksIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZT46Omludm9rZShkb3VibGUgKCoqKShkb3VibGUsIGRvdWJsZSwgZG91YmxlKSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSmJAbEBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Okludm9rZXI8ZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZT46Omludm9rZShkb3VibGUgKCopKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUpigFCdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aUR5bj4obWF4aUR5biopiwE2bWF4aUR5biogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpRHluPigpjAGQAmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aUR5bjo6KikoZG91YmxlLCBkb3VibGUsIGxvbmcsIGRvdWJsZSwgZG91YmxlKSwgZG91YmxlLCBtYXhpRHluKiwgZG91YmxlLCBkb3VibGUsIGxvbmcsIGRvdWJsZSwgZG91YmxlPjo6aW52b2tlKGRvdWJsZSAobWF4aUR5bjo6KiBjb25zdCYpKGRvdWJsZSwgZG91YmxlLCBsb25nLCBkb3VibGUsIGRvdWJsZSksIG1heGlEeW4qLCBkb3VibGUsIGRvdWJsZSwgbG9uZywgZG91YmxlLCBkb3VibGUpjQGYAmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aUR5bjo6KikoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUpLCBkb3VibGUsIG1heGlEeW4qLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZT46Omludm9rZShkb3VibGUgKG1heGlEeW46OiogY29uc3QmKShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSksIG1heGlEeW4qLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSmOAUJ2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpRW52PihtYXhpRW52KimPATZtYXhpRW52KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlFbnY+KCmQAYQCZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpRW52OjoqKShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBsb25nLCBpbnQpLCBkb3VibGUsIG1heGlFbnYqLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBsb25nLCBpbnQ+OjppbnZva2UoZG91YmxlIChtYXhpRW52OjoqIGNvbnN0JikoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgbG9uZywgaW50KSwgbWF4aUVudiosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGxvbmcsIGludCmRAcQCZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpRW52OjoqKShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgbG9uZywgaW50KSwgZG91YmxlLCBtYXhpRW52KiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGxvbmcsIGludD46Omludm9rZShkb3VibGUgKG1heGlFbnY6OiogY29uc3QmKShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgbG9uZywgaW50KSwgbWF4aUVudiosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBsb25nLCBpbnQpkgGsAWVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aUVudjo6KikoZG91YmxlLCBpbnQpLCBkb3VibGUsIG1heGlFbnYqLCBkb3VibGUsIGludD46Omludm9rZShkb3VibGUgKG1heGlFbnY6OiogY29uc3QmKShkb3VibGUsIGludCksIG1heGlFbnYqLCBkb3VibGUsIGludCmTARttYXhpRW52OjpnZXRUcmlnZ2VyKCkgY29uc3SUARhtYXhpRW52OjpzZXRUcmlnZ2VyKGludCmVAUJ2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxjb252ZXJ0Pihjb252ZXJ0KimWAWJlbXNjcmlwdGVuOjppbnRlcm5hbDo6RnVuY3Rpb25JbnZva2VyPGRvdWJsZSAoKikoaW50KSwgZG91YmxlLCBpbnQ+OjppbnZva2UoZG91YmxlICgqKikoaW50KSwgaW50KZcBSGVtc2NyaXB0ZW46OmludGVybmFsOjpJbnZva2VyPGRvdWJsZSwgaW50Pjo6aW52b2tlKGRvdWJsZSAoKikoaW50KSwgaW50KZgBGmNvbnZlcnQ6Om1zVG9TYW1wcyhkb3VibGUpmQFuZW1zY3JpcHRlbjo6aW50ZXJuYWw6OkZ1bmN0aW9uSW52b2tlcjxkb3VibGUgKCopKGRvdWJsZSksIGRvdWJsZSwgZG91YmxlPjo6aW52b2tlKGRvdWJsZSAoKiopKGRvdWJsZSksIGRvdWJsZSmaAVFlbXNjcmlwdGVuOjppbnRlcm5hbDo6SW52b2tlcjxkb3VibGUsIGRvdWJsZT46Omludm9rZShkb3VibGUgKCopKGRvdWJsZSksIGRvdWJsZSmbAVZ2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpU2FtcGxlQW5kSG9sZD4obWF4aVNhbXBsZUFuZEhvbGQqKZwBSm1heGlTYW1wbGVBbmRIb2xkKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlTYW1wbGVBbmRIb2xkPigpnQEmbWF4aVNhbXBsZUFuZEhvbGQ6OnNhaChkb3VibGUsIGRvdWJsZSmeAVB2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpRGlzdG9ydGlvbj4obWF4aURpc3RvcnRpb24qKZ8BIG1heGlEaXN0b3J0aW9uOjpmYXN0YXRhbihkb3VibGUpoAEobWF4aURpc3RvcnRpb246OmF0YW5EaXN0KGRvdWJsZSwgZG91YmxlKaEBLG1heGlEaXN0b3J0aW9uOjpmYXN0QXRhbkRpc3QoZG91YmxlLCBkb3VibGUpogFKdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aUZsYW5nZXI+KG1heGlGbGFuZ2VyKimjAT5tYXhpRmxhbmdlciogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpRmxhbmdlcj4oKaQBQW1heGlGbGFuZ2VyOjpmbGFuZ2UoZG91YmxlLCB1bnNpZ25lZCBpbnQsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUppQHAAmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aUZsYW5nZXI6OiopKGRvdWJsZSwgdW5zaWduZWQgaW50LCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKSwgZG91YmxlLCBtYXhpRmxhbmdlciosIGRvdWJsZSwgdW5zaWduZWQgaW50LCBkb3VibGUsIGRvdWJsZSwgZG91YmxlPjo6aW52b2tlKGRvdWJsZSAobWF4aUZsYW5nZXI6OiogY29uc3QmKShkb3VibGUsIHVuc2lnbmVkIGludCwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSksIG1heGlGbGFuZ2VyKiwgZG91YmxlLCB1bnNpZ25lZCBpbnQsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUppgFIdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aUNob3J1cz4obWF4aUNob3J1cyoppwE8bWF4aUNob3J1cyogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpQ2hvcnVzPigpqAFAbWF4aUNob3J1czo6Y2hvcnVzKGRvdWJsZSwgdW5zaWduZWQgaW50LCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKakBTnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlEQ0Jsb2NrZXI+KG1heGlEQ0Jsb2NrZXIqKaoBQm1heGlEQ0Jsb2NrZXIqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aURDQmxvY2tlcj4oKasBI21heGlEQ0Jsb2NrZXI6OnBsYXkoZG91YmxlLCBkb3VibGUprAFCdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aVNWRj4obWF4aVNWRioprQE2bWF4aVNWRiogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpU1ZGPigprgEabWF4aVNWRjo6c2V0Q3V0b2ZmKGRvdWJsZSmvAR1tYXhpU1ZGOjpzZXRSZXNvbmFuY2UoZG91YmxlKbABNW1heGlTVkY6OnBsYXkoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUpsQFEdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aU1hdGg+KG1heGlNYXRoKimyAWllbXNjcmlwdGVuOjppbnRlcm5hbDo6SW52b2tlcjxkb3VibGUsIGRvdWJsZSwgZG91YmxlPjo6aW52b2tlKGRvdWJsZSAoKikoZG91YmxlLCBkb3VibGUpLCBkb3VibGUsIGRvdWJsZSmzAR1tYXhpTWF0aDo6YWRkKGRvdWJsZSwgZG91YmxlKbQBHW1heGlNYXRoOjpzdWIoZG91YmxlLCBkb3VibGUptQEdbWF4aU1hdGg6Om11bChkb3VibGUsIGRvdWJsZSm2AR1tYXhpTWF0aDo6ZGl2KGRvdWJsZSwgZG91YmxlKbcBHG1heGlNYXRoOjpndChkb3VibGUsIGRvdWJsZSm4ARxtYXhpTWF0aDo6bHQoZG91YmxlLCBkb3VibGUpuQEdbWF4aU1hdGg6Omd0ZShkb3VibGUsIGRvdWJsZSm6AR1tYXhpTWF0aDo6bHRlKGRvdWJsZSwgZG91YmxlKbsBHW1heGlNYXRoOjptb2QoZG91YmxlLCBkb3VibGUpvAEVbWF4aU1hdGg6OmFicyhkb3VibGUpvQEfbWF4aU1hdGg6Onhwb3d5KGRvdWJsZSwgZG91YmxlKb4BRnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlDbG9jaz4obWF4aUNsb2NrKim/ATptYXhpQ2xvY2sqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aUNsb2NrPigpwAEZbWF4aUNsb2NrOjppc1RpY2soKSBjb25zdMEBIm1heGlDbG9jazo6Z2V0Q3VycmVudENvdW50KCkgY29uc3TCAR9tYXhpQ2xvY2s6OnNldEN1cnJlbnRDb3VudChpbnQpwwEfbWF4aUNsb2NrOjpnZXRMYXN0Q291bnQoKSBjb25zdMQBHG1heGlDbG9jazo6c2V0TGFzdENvdW50KGludCnFARltYXhpQ2xvY2s6OmdldEJwcygpIGNvbnN0xgEWbWF4aUNsb2NrOjpzZXRCcHMoaW50KccBGW1heGlDbG9jazo6Z2V0QnBtKCkgY29uc3TIARZtYXhpQ2xvY2s6OnNldEJwbShpbnQpyQEXbWF4aUNsb2NrOjpzZXRUaWNrKGludCnKARttYXhpQ2xvY2s6OmdldFRpY2tzKCkgY29uc3TLARhtYXhpQ2xvY2s6OnNldFRpY2tzKGludCnMAWB2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yPihtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yKinNAVRtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlLdXJhbW90b09zY2lsbGF0b3I+KCnOAWRtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yOjpwbGF5KGRvdWJsZSwgZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4pzwHWA2Vtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aUt1cmFtb3RvT3NjaWxsYXRvcjo6KikoZG91YmxlLCBkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiksIGRvdWJsZSwgbWF4aUt1cmFtb3RvT3NjaWxsYXRvciosIGRvdWJsZSwgZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4gPjo6aW52b2tlKGRvdWJsZSAobWF4aUt1cmFtb3RvT3NjaWxsYXRvcjo6KiBjb25zdCYpKGRvdWJsZSwgZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4pLCBtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yKiwgZG91YmxlLCBkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiop0AFmdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldD4obWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldCop0QFgdm9pZCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6cmF3X2Rlc3RydWN0b3I8bWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldD4obWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldCop0gGeAWVtc2NyaXB0ZW46OmludGVybmFsOjpJbnZva2VyPG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQqLCB1bnNpZ25lZCBsb25nIGNvbnN0JiY+OjppbnZva2UobWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldCogKCopKHVuc2lnbmVkIGxvbmcgY29uc3QmJiksIHVuc2lnbmVkIGxvbmcp0wGEAW1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldCwgdW5zaWduZWQgbG9uZyBjb25zdD4odW5zaWduZWQgbG9uZyBjb25zdCYmKdQBL21heGlLdXJhbW90b09zY2lsbGF0b3JTZXQ6OnBsYXkoZG91YmxlLCBkb3VibGUp1QE6bWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldDo6c2V0UGhhc2UoZG91YmxlLCB1bnNpZ25lZCBsb25nKdYBlgJlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0OjoqKShkb3VibGUsIHVuc2lnbmVkIGxvbmcpLCB2b2lkLCBtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0KiwgZG91YmxlLCB1bnNpZ25lZCBsb25nPjo6aW52b2tlKHZvaWQgKG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQ6OiogY29uc3QmKShkb3VibGUsIHVuc2lnbmVkIGxvbmcpLCBtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0KiwgZG91YmxlLCB1bnNpZ25lZCBsb25nKdcBY21heGlLdXJhbW90b09zY2lsbGF0b3JTZXQ6OnNldFBoYXNlcyhzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4gY29uc3QmKdgBMm1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQ6OmdldFBoYXNlKHVuc2lnbmVkIGxvbmcp2QH8AWVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldDo6KikodW5zaWduZWQgbG9uZyksIGRvdWJsZSwgbWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldCosIHVuc2lnbmVkIGxvbmc+OjppbnZva2UoZG91YmxlIChtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0OjoqIGNvbnN0JikodW5zaWduZWQgbG9uZyksIG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQqLCB1bnNpZ25lZCBsb25nKdoBIW1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQ6OnNpemUoKdsBanZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlBc3luY0t1cmFtb3RvT3NjaWxsYXRvcj4obWF4aUFzeW5jS3VyYW1vdG9Pc2NpbGxhdG9yKincAawBbWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldCogZW1zY3JpcHRlbjo6YmFzZTxtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0Pjo6Y29udmVydFBvaW50ZXI8bWF4aUFzeW5jS3VyYW1vdG9Pc2NpbGxhdG9yLCBtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0PihtYXhpQXN5bmNLdXJhbW90b09zY2lsbGF0b3IqKd0BiAFtYXhpQXN5bmNLdXJhbW90b09zY2lsbGF0b3IqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aUFzeW5jS3VyYW1vdG9Pc2NpbGxhdG9yLCB1bnNpZ25lZCBsb25nIGNvbnN0Pih1bnNpZ25lZCBsb25nIGNvbnN0JiYp3gExbWF4aUFzeW5jS3VyYW1vdG9Pc2NpbGxhdG9yOjpwbGF5KGRvdWJsZSwgZG91YmxlKd8BPG1heGlBc3luY0t1cmFtb3RvT3NjaWxsYXRvcjo6c2V0UGhhc2UoZG91YmxlLCB1bnNpZ25lZCBsb25nKeABZW1heGlBc3luY0t1cmFtb3RvT3NjaWxsYXRvcjo6c2V0UGhhc2VzKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiBjb25zdCYp4QFCdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aUZGVD4obWF4aUZGVCop4gE8dm9pZCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6cmF3X2Rlc3RydWN0b3I8bWF4aUZGVD4obWF4aUZGVCop4wE2bWF4aUZGVCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpRkZUPigp5AGuAWVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKG1heGlGRlQ6OiopKGludCwgaW50LCBpbnQpLCB2b2lkLCBtYXhpRkZUKiwgaW50LCBpbnQsIGludD46Omludm9rZSh2b2lkIChtYXhpRkZUOjoqIGNvbnN0JikoaW50LCBpbnQsIGludCksIG1heGlGRlQqLCBpbnQsIGludCwgaW50KeUB2gFlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxib29sIChtYXhpRkZUOjoqKShmbG9hdCwgbWF4aUZGVDo6ZmZ0TW9kZXMpLCBib29sLCBtYXhpRkZUKiwgZmxvYXQsIG1heGlGRlQ6OmZmdE1vZGVzPjo6aW52b2tlKGJvb2wgKG1heGlGRlQ6OiogY29uc3QmKShmbG9hdCwgbWF4aUZGVDo6ZmZ0TW9kZXMpLCBtYXhpRkZUKiwgZmxvYXQsIG1heGlGRlQ6OmZmdE1vZGVzKeYBeWVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGZsb2F0IChtYXhpRkZUOjoqKSgpLCBmbG9hdCwgbWF4aUZGVCo+OjppbnZva2UoZmxvYXQgKG1heGlGRlQ6OiogY29uc3QmKSgpLCBtYXhpRkZUKinnAYkCZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8c3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiYgKG1heGlGRlQ6OiopKCksIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mLCBtYXhpRkZUKj46Omludm9rZShzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+JiAobWF4aUZGVDo6KiBjb25zdCYpKCksIG1heGlGRlQqKegBGm1heGlGRlQ6OmdldE1hZ25pdHVkZXNEQigp6QEUbWF4aUZGVDo6Z2V0UGhhc2VzKCnqARVtYXhpRkZUOjpnZXROdW1CaW5zKCnrARVtYXhpRkZUOjpnZXRGRlRTaXplKCnsARVtYXhpRkZUOjpnZXRIb3BTaXplKCntARhtYXhpRkZUOjpnZXRXaW5kb3dTaXplKCnuAUR2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpSUZGVD4obWF4aUlGRlQqKe8BPnZvaWQgZW1zY3JpcHRlbjo6aW50ZXJuYWw6OnJhd19kZXN0cnVjdG9yPG1heGlJRkZUPihtYXhpSUZGVCop8AE4bWF4aUlGRlQqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aUlGRlQ+KCnxAYEFZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZmxvYXQgKG1heGlJRkZUOjoqKShzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+Jiwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiYsIG1heGlJRkZUOjpmZnRNb2RlcyksIGZsb2F0LCBtYXhpSUZGVCosIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mLCBzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+JiwgbWF4aUlGRlQ6OmZmdE1vZGVzPjo6aW52b2tlKGZsb2F0IChtYXhpSUZGVDo6KiBjb25zdCYpKHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mLCBzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+JiwgbWF4aUlGRlQ6OmZmdE1vZGVzKSwgbWF4aUlGRlQqLCBzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+Kiwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiosIG1heGlJRkZUOjpmZnRNb2RlcynyAWV2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpTUZDQ0FuYWx5c2VyPGRvdWJsZT4gPihtYXhpTUZDQ0FuYWx5c2VyPGRvdWJsZT4qKfMBX3ZvaWQgZW1zY3JpcHRlbjo6aW50ZXJuYWw6OnJhd19kZXN0cnVjdG9yPG1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPiA+KG1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPiop9AFZbWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPiA+KCn1AVltYXhpTUZDQ0FuYWx5c2VyPGRvdWJsZT46OnNldHVwKHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQsIGRvdWJsZSwgZG91YmxlKfYBngNlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChtYXhpTUZDQ0FuYWx5c2VyPGRvdWJsZT46OiopKHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQsIGRvdWJsZSwgZG91YmxlKSwgdm9pZCwgbWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+KiwgdW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgZG91YmxlLCBkb3VibGU+OjppbnZva2Uodm9pZCAobWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+OjoqIGNvbnN0JikodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgZG91YmxlLCBkb3VibGUpLCBtYXhpTUZDQ0FuYWx5c2VyPGRvdWJsZT4qLCB1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50LCBkb3VibGUsIGRvdWJsZSn3AVVtYXhpTUZDQ0FuYWx5c2VyPGRvdWJsZT46Om1mY2Moc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiYp+AGrBGVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYgKG1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPjo6Kikoc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiYpLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBtYXhpTUZDQ0FuYWx5c2VyPGRvdWJsZT4qLCBzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+Jj46Omludm9rZShzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mIChtYXhpTUZDQ0FuYWx5c2VyPGRvdWJsZT46OiogY29uc3QmKShzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+JiksIG1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPiosIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4qKfkBlQF2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4gPihzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4qKfoBjwF2b2lkIGVtc2NyaXB0ZW46OmludGVybmFsOjpyYXdfZGVzdHJ1Y3RvcjxzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4gPihzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4qKfsBiQFzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4qIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8c3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+ID4oKfwBR3N0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPjo6cHVzaF9iYWNrKGludCBjb25zdCYp/QG/AmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPjo6KikoaW50IGNvbnN0JiksIHZvaWQsIHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiosIGludCBjb25zdCY+OjppbnZva2Uodm9pZCAoc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+OjoqIGNvbnN0JikoaW50IGNvbnN0JiksIHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiosIGludCn+AVNzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID46OnJlc2l6ZSh1bnNpZ25lZCBsb25nLCBpbnQgY29uc3QmKf8B+wJlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID46OiopKHVuc2lnbmVkIGxvbmcsIGludCBjb25zdCYpLCB2b2lkLCBzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4qLCB1bnNpZ25lZCBsb25nLCBpbnQgY29uc3QmPjo6aW52b2tlKHZvaWQgKHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPjo6KiBjb25zdCYpKHVuc2lnbmVkIGxvbmcsIGludCBjb25zdCYpLCBzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4qLCB1bnNpZ25lZCBsb25nLCBpbnQpgAI+c3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+OjpzaXplKCkgY29uc3SBAqIBZW1zY3JpcHRlbjo6aW50ZXJuYWw6OlZlY3RvckFjY2VzczxzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4gPjo6Z2V0KHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiBjb25zdCYsIHVuc2lnbmVkIGxvbmcpggKDA2Vtc2NyaXB0ZW46OmludGVybmFsOjpGdW5jdGlvbkludm9rZXI8ZW1zY3JpcHRlbjo6dmFsICgqKShzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4gY29uc3QmLCB1bnNpZ25lZCBsb25nKSwgZW1zY3JpcHRlbjo6dmFsLCBzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4gY29uc3QmLCB1bnNpZ25lZCBsb25nPjo6aW52b2tlKGVtc2NyaXB0ZW46OnZhbCAoKiopKHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiBjb25zdCYsIHVuc2lnbmVkIGxvbmcpLCBzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4qLCB1bnNpZ25lZCBsb25nKYMCqAFlbXNjcmlwdGVuOjppbnRlcm5hbDo6VmVjdG9yQWNjZXNzPHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiA+OjpzZXQoc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+JiwgdW5zaWduZWQgbG9uZywgaW50IGNvbnN0JimEAvkCZW1zY3JpcHRlbjo6aW50ZXJuYWw6OkZ1bmN0aW9uSW52b2tlcjxib29sICgqKShzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4mLCB1bnNpZ25lZCBsb25nLCBpbnQgY29uc3QmKSwgYm9vbCwgc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+JiwgdW5zaWduZWQgbG9uZywgaW50IGNvbnN0Jj46Omludm9rZShib29sICgqKikoc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+JiwgdW5zaWduZWQgbG9uZywgaW50IGNvbnN0JiksIHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiosIHVuc2lnbmVkIGxvbmcsIGludCmFAqEBdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8c3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+ID4oc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KimGAlBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID46OnB1c2hfYmFjayhkb3VibGUgY29uc3QmKYcC4wJlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID46OiopKGRvdWJsZSBjb25zdCYpLCB2b2lkLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4qLCBkb3VibGUgY29uc3QmPjo6aW52b2tlKHZvaWQgKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPjo6KiBjb25zdCYpKGRvdWJsZSBjb25zdCYpLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4qLCBkb3VibGUpiAJcc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+OjpyZXNpemUodW5zaWduZWQgbG9uZywgZG91YmxlIGNvbnN0JimJAp8DZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+OjoqKSh1bnNpZ25lZCBsb25nLCBkb3VibGUgY29uc3QmKSwgdm9pZCwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KiwgdW5zaWduZWQgbG9uZywgZG91YmxlIGNvbnN0Jj46Omludm9rZSh2b2lkIChzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID46OiogY29uc3QmKSh1bnNpZ25lZCBsb25nLCBkb3VibGUgY29uc3QmKSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KiwgdW5zaWduZWQgbG9uZywgZG91YmxlKYoCRHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPjo6c2l6ZSgpIGNvbnN0iwKuAWVtc2NyaXB0ZW46OmludGVybmFsOjpWZWN0b3JBY2Nlc3M8c3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+ID46OmdldChzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4gY29uc3QmLCB1bnNpZ25lZCBsb25nKYwCtwFlbXNjcmlwdGVuOjppbnRlcm5hbDo6VmVjdG9yQWNjZXNzPHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiA+OjpzZXQoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgdW5zaWduZWQgbG9uZywgZG91YmxlIGNvbnN0JimNAp0DZW1zY3JpcHRlbjo6aW50ZXJuYWw6OkZ1bmN0aW9uSW52b2tlcjxib29sICgqKShzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCB1bnNpZ25lZCBsb25nLCBkb3VibGUgY29uc3QmKSwgYm9vbCwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgdW5zaWduZWQgbG9uZywgZG91YmxlIGNvbnN0Jj46Omludm9rZShib29sICgqKikoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgdW5zaWduZWQgbG9uZywgZG91YmxlIGNvbnN0JiksIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiosIHVuc2lnbmVkIGxvbmcsIGRvdWJsZSmOApkBdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8c3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gPihzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiopjwJKc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OnB1c2hfYmFjayhjaGFyIGNvbnN0JimQAssCZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAoc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OiopKGNoYXIgY29uc3QmKSwgdm9pZCwgc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4qLCBjaGFyIGNvbnN0Jj46Omludm9rZSh2b2lkIChzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6KiBjb25zdCYpKGNoYXIgY29uc3QmKSwgc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4qLCBjaGFyKZECVnN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpyZXNpemUodW5zaWduZWQgbG9uZywgY2hhciBjb25zdCYpkgKHA2Vtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjoqKSh1bnNpZ25lZCBsb25nLCBjaGFyIGNvbnN0JiksIHZvaWQsIHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+KiwgdW5zaWduZWQgbG9uZywgY2hhciBjb25zdCY+OjppbnZva2Uodm9pZCAoc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OiogY29uc3QmKSh1bnNpZ25lZCBsb25nLCBjaGFyIGNvbnN0JiksIHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+KiwgdW5zaWduZWQgbG9uZywgY2hhcimTAkBzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6c2l6ZSgpIGNvbnN0lAKmAWVtc2NyaXB0ZW46OmludGVybmFsOjpWZWN0b3JBY2Nlc3M8c3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gPjo6Z2V0KHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0JiwgdW5zaWduZWQgbG9uZymVAq0BZW1zY3JpcHRlbjo6aW50ZXJuYWw6OlZlY3RvckFjY2VzczxzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiA+OjpzZXQoc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4mLCB1bnNpZ25lZCBsb25nLCBjaGFyIGNvbnN0JimWAoUDZW1zY3JpcHRlbjo6aW50ZXJuYWw6OkZ1bmN0aW9uSW52b2tlcjxib29sICgqKShzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiYsIHVuc2lnbmVkIGxvbmcsIGNoYXIgY29uc3QmKSwgYm9vbCwgc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4mLCB1bnNpZ25lZCBsb25nLCBjaGFyIGNvbnN0Jj46Omludm9rZShib29sICgqKikoc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4mLCB1bnNpZ25lZCBsb25nLCBjaGFyIGNvbnN0JiksIHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+KiwgdW5zaWduZWQgbG9uZywgY2hhcimXAr0Bdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8c3RkOjpfXzI6OnZlY3Rvcjx1bnNpZ25lZCBjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHVuc2lnbmVkIGNoYXI+ID4gPihzdGQ6Ol9fMjo6dmVjdG9yPHVuc2lnbmVkIGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8dW5zaWduZWQgY2hhcj4gPiopmALKAWVtc2NyaXB0ZW46OmludGVybmFsOjpWZWN0b3JBY2Nlc3M8c3RkOjpfXzI6OnZlY3Rvcjx1bnNpZ25lZCBjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHVuc2lnbmVkIGNoYXI+ID4gPjo6Z2V0KHN0ZDo6X18yOjp2ZWN0b3I8dW5zaWduZWQgY2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjx1bnNpZ25lZCBjaGFyPiA+IGNvbnN0JiwgdW5zaWduZWQgbG9uZymZAp0Bdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8c3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiA+KHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4qKZoC1wJlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+OjoqKShmbG9hdCBjb25zdCYpLCB2b2lkLCBzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+KiwgZmxvYXQgY29uc3QmPjo6aW52b2tlKHZvaWQgKHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID46OiogY29uc3QmKShmbG9hdCBjb25zdCYpLCBzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+KiwgZmxvYXQpmwKTA2Vtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID46OiopKHVuc2lnbmVkIGxvbmcsIGZsb2F0IGNvbnN0JiksIHZvaWQsIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4qLCB1bnNpZ25lZCBsb25nLCBmbG9hdCBjb25zdCY+OjppbnZva2Uodm9pZCAoc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPjo6KiBjb25zdCYpKHVuc2lnbmVkIGxvbmcsIGZsb2F0IGNvbnN0JiksIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4qLCB1bnNpZ25lZCBsb25nLCBmbG9hdCmcAqoBZW1zY3JpcHRlbjo6aW50ZXJuYWw6OlZlY3RvckFjY2VzczxzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+ID46OmdldChzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+IGNvbnN0JiwgdW5zaWduZWQgbG9uZymdApEDZW1zY3JpcHRlbjo6aW50ZXJuYWw6OkZ1bmN0aW9uSW52b2tlcjxib29sICgqKShzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+JiwgdW5zaWduZWQgbG9uZywgZmxvYXQgY29uc3QmKSwgYm9vbCwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiYsIHVuc2lnbmVkIGxvbmcsIGZsb2F0IGNvbnN0Jj46Omludm9rZShib29sICgqKikoc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiYsIHVuc2lnbmVkIGxvbmcsIGZsb2F0IGNvbnN0JiksIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4qLCB1bnNpZ25lZCBsb25nLCBmbG9hdCmeAl5zdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID46Ol9fYXBwZW5kKHVuc2lnbmVkIGxvbmcsIGRvdWJsZSBjb25zdCYpnwI4bWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+OjpjYWxjTWVsRmlsdGVyQmFuayhkb3VibGUsIGludCmgAmZFbXNjcmlwdGVuQmluZGluZ0luaXRpYWxpemVyX215X21vZHVsZV9tYXhpR3JhaW5zOjpFbXNjcmlwdGVuQmluZGluZ0luaXRpYWxpemVyX215X21vZHVsZV9tYXhpR3JhaW5zKCmhAnN2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4obWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiopogJtdm9pZCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6cmF3X2Rlc3RydWN0b3I8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+KG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qKaMCmAFlbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46OmdldChzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gY29uc3QmKaQCZmVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6Y29uc3RydWN0X251bGwoKaUCnQFlbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46OnNoYXJlKG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qLCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6X0VNX1ZBTCoppgKbAXZvaWQgZW1zY3JpcHRlbjo6aW50ZXJuYWw6OnJhd19kZXN0cnVjdG9yPHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+KHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPioppwKcAWVtc2NyaXB0ZW46OmludGVybmFsOjpJbnZva2VyPHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+OjppbnZva2Uoc3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ICgqKSgpKagCwgFzdGQ6Ol9fMjo6ZW5hYmxlX2lmPCEoaXNfYXJyYXk8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+Ojp2YWx1ZSksIHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp0eXBlIHN0ZDo6X18yOjptYWtlX3NoYXJlZDxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4oKakCN21heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OnNldFNhbXBsZShtYXhpU2FtcGxlKimqAjhtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+OjpnZXROb3JtYWxpc2VkUG9zaXRpb24oKasCNG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OnNldFBvc2l0aW9uKGRvdWJsZSmsAkJtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+OjpwbGF5KGRvdWJsZSwgZG91YmxlLCBpbnQsIGRvdWJsZSmtAswCZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+OjoqKShkb3VibGUsIGRvdWJsZSwgaW50LCBkb3VibGUpLCBkb3VibGUsIG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qLCBkb3VibGUsIGRvdWJsZSwgaW50LCBkb3VibGU+OjppbnZva2UoZG91YmxlIChtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+OjoqIGNvbnN0JikoZG91YmxlLCBkb3VibGUsIGludCwgZG91YmxlKSwgbWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGRvdWJsZSwgZG91YmxlLCBpbnQsIGRvdWJsZSmuAkRtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+OjpwbGF5QXRQb3NpdGlvbihkb3VibGUsIGRvdWJsZSwgaW50Ka8CrAJlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OiopKGRvdWJsZSwgZG91YmxlLCBpbnQpLCBkb3VibGUsIG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qLCBkb3VibGUsIGRvdWJsZSwgaW50Pjo6aW52b2tlKGRvdWJsZSAobWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6KiBjb25zdCYpKGRvdWJsZSwgZG91YmxlLCBpbnQpLCBtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KiwgZG91YmxlLCBkb3VibGUsIGludCmwAnF2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPihtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4qKbECa3ZvaWQgZW1zY3JpcHRlbjo6aW50ZXJuYWw6OnJhd19kZXN0cnVjdG9yPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+KG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiopsgKbAWVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPiA+OjpzaGFyZShtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4qLCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6X0VNX1ZBTCopswK/AXN0ZDo6X18yOjplbmFibGVfaWY8IShpc19hcnJheTxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPjo6dmFsdWUpLCBzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp0eXBlIHN0ZDo6X18yOjptYWtlX3NoYXJlZDxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPigptAI2bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+OjpzZXRTYW1wbGUobWF4aVNhbXBsZSoptQJBbWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+OjpwbGF5KGRvdWJsZSwgZG91YmxlLCBpbnQsIGRvdWJsZSm2Amt2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPihtYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qKbcCX21heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPigpuAIzbWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+OjpzZXRTYW1wbGUobWF4aVNhbXBsZSopuQIxbWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+OjpzZXRMb29wU3RhcnQoZG91YmxlKboCL21heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6c2V0TG9vcEVuZChkb3VibGUpuwIpbWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+OjpnZXRMb29wRW5kKCm8AkZtYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OnBsYXkoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgaW50LCBkb3VibGUpvQLcAmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+OjoqKShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBpbnQsIGRvdWJsZSksIGRvdWJsZSwgbWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgaW50LCBkb3VibGU+OjppbnZva2UoZG91YmxlIChtYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OiogY29uc3QmKShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBpbnQsIGRvdWJsZSksIG1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGludCwgZG91YmxlKb4CSG1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6cGxheUF0UG9zaXRpb24oZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgaW50Kb8CvAJlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6KikoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgaW50KSwgZG91YmxlLCBtYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBpbnQ+OjppbnZva2UoZG91YmxlIChtYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OiogY29uc3QmKShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBpbnQpLCBtYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBpbnQpwAJwbWF4aUdyYWluPGhhbm5XaW5GdW5jdG9yPjo6bWF4aUdyYWluKG1heGlTYW1wbGUqLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBtYXhpR3JhaW5XaW5kb3dDYWNoZTxoYW5uV2luRnVuY3Rvcj4qKcECYkVtc2NyaXB0ZW5CaW5kaW5nSW5pdGlhbGl6ZXJfbXlfbW9kdWxlX21heGliaXRzOjpFbXNjcmlwdGVuQmluZGluZ0luaXRpYWxpemVyX215X21vZHVsZV9tYXhpYml0cygpwgJEdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aUJpdHM+KG1heGlCaXRzKinDAm9lbXNjcmlwdGVuOjppbnRlcm5hbDo6SW52b2tlcjx1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludD46Omludm9rZSh1bnNpZ25lZCBpbnQgKCopKHVuc2lnbmVkIGludCksIHVuc2lnbmVkIGludCnEApkBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Okludm9rZXI8dW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludD46Omludm9rZSh1bnNpZ25lZCBpbnQgKCopKHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KSwgdW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQpxQIobWF4aUJpdHM6OmF0KHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KcYCKW1heGlCaXRzOjpzaGwodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQpxwIpbWF4aUJpdHM6OnNocih1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCnIAsMBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Okludm9rZXI8dW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50Pjo6aW52b2tlKHVuc2lnbmVkIGludCAoKikodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCksIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQpyQI1bWF4aUJpdHM6OnIodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCnKAiptYXhpQml0czo6bGFuZCh1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCnLAiltYXhpQml0czo6bG9yKHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KcwCKm1heGlCaXRzOjpseG9yKHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50Kc0CG21heGlCaXRzOjpuZWcodW5zaWduZWQgaW50Kc4CG21heGlCaXRzOjppbmModW5zaWduZWQgaW50Kc8CG21heGlCaXRzOjpkZWModW5zaWduZWQgaW50KdACKW1heGlCaXRzOjphZGQodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQp0QIpbWF4aUJpdHM6OnN1Yih1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCnSAiltYXhpQml0czo6bXVsKHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KdMCKW1heGlCaXRzOjpkaXYodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQp1AIobWF4aUJpdHM6Omd0KHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KdUCKG1heGlCaXRzOjpsdCh1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCnWAiltYXhpQml0czo6Z3RlKHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KdcCKW1heGlCaXRzOjpsdGUodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQp2AIobWF4aUJpdHM6OmVxKHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KdkCEW1heGlCaXRzOjpub2lzZSgp2gIgbWF4aUJpdHM6OnRvU2lnbmFsKHVuc2lnbmVkIGludCnbAiRtYXhpQml0czo6dG9UcmlnU2lnbmFsKHVuc2lnbmVkIGludCncAl1lbXNjcmlwdGVuOjppbnRlcm5hbDo6SW52b2tlcjx1bnNpZ25lZCBpbnQsIGRvdWJsZT46Omludm9rZSh1bnNpZ25lZCBpbnQgKCopKGRvdWJsZSksIGRvdWJsZSndAhxtYXhpQml0czo6ZnJvbVNpZ25hbChkb3VibGUp3gJKdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aVRyaWdnZXI+KG1heGlUcmlnZ2VyKinfAj5tYXhpVHJpZ2dlciogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpVHJpZ2dlcj4oKeACGW1heGlUcmlnZ2VyOjpvblpYKGRvdWJsZSnhAiZtYXhpVHJpZ2dlcjo6b25DaGFuZ2VkKGRvdWJsZSwgZG91YmxlKeICSnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlDb3VudGVyPihtYXhpQ291bnRlciop4wI+bWF4aUNvdW50ZXIqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aUNvdW50ZXI+KCnkAiJtYXhpQ291bnRlcjo6Y291bnQoZG91YmxlLCBkb3VibGUp5QJGdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aUluZGV4PihtYXhpSW5kZXgqKeYCOm1heGlJbmRleCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpSW5kZXg+KCnnAldtYXhpSW5kZXg6OnB1bGwoZG91YmxlLCBkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPinoAkx2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpUmF0aW9TZXE+KG1heGlSYXRpb1NlcSop6QJWbWF4aVJhdGlvU2VxOjpwbGF5VHJpZyhkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPinqAo4DZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpUmF0aW9TZXE6OiopKGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KSwgZG91YmxlLCBtYXhpUmF0aW9TZXEqLCBkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiA+OjppbnZva2UoZG91YmxlIChtYXhpUmF0aW9TZXE6OiogY29uc3QmKShkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiksIG1heGlSYXRpb1NlcSosIGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KinrApABbWF4aVJhdGlvU2VxOjpwbGF5VmFsdWVzKGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+LCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4p7ALvBGVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aVJhdGlvU2VxOjoqKShkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KSwgZG91YmxlLCBtYXhpUmF0aW9TZXEqLCBkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+ID46Omludm9rZShkb3VibGUgKG1heGlSYXRpb1NlcTo6KiBjb25zdCYpKGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+LCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4pLCBtYXhpUmF0aW9TZXEqLCBkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiosIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiop7QJORW1zY3JpcHRlbkJpbmRpbmdJbml0aWFsaXplcl9tYXhpVmVyYjo6RW1zY3JpcHRlbkJpbmRpbmdJbml0aWFsaXplcl9tYXhpVmVyYigp7gJOdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aVNhdFJldmVyYj4obWF4aVNhdFJldmVyYiop7wJIdm9pZCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6cmF3X2Rlc3RydWN0b3I8bWF4aVNhdFJldmVyYj4obWF4aVNhdFJldmVyYiop8AJCbWF4aVNhdFJldmVyYiogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpU2F0UmV2ZXJiPigp8QJMdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aUZyZWVWZXJiPihtYXhpRnJlZVZlcmIqKfICQG1heGlGcmVlVmVyYiogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpRnJlZVZlcmI+KCnzAitzdGQ6Ol9fMjo6X190aHJvd19sZW5ndGhfZXJyb3IoY2hhciBjb25zdCop9AJkdm9pZCBzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID46Ol9fcHVzaF9iYWNrX3Nsb3dfcGF0aDxpbnQgY29uc3QmPihpbnQgY29uc3QmKfUCVXN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPjo6X19hcHBlbmQodW5zaWduZWQgbG9uZywgaW50IGNvbnN0Jin2AnB2b2lkIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPjo6X19wdXNoX2JhY2tfc2xvd19wYXRoPGRvdWJsZSBjb25zdCY+KGRvdWJsZSBjb25zdCYp9wJYc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46Ol9fYXBwZW5kKHVuc2lnbmVkIGxvbmcsIGNoYXIgY29uc3QmKfgCb3N0ZDo6X18yOjp2ZWN0b3I8bWF4aUt1cmFtb3RvT3NjaWxsYXRvciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yPiA+OjpfX2FwcGVuZCh1bnNpZ25lZCBsb25nKfkCT3N0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPjo6X19hcHBlbmQodW5zaWduZWQgbG9uZyn6AhNtYXhpRkZUOjp+bWF4aUZGVCgp+wIzbWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6fm1heGlUaW1lU3RyZXRjaCgp/AKABHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+LCBlbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46OnZhbF9kZWxldGVyPihtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KiwgZW1zY3JpcHRlbjo6c21hcnRfcHRyX3RyYWl0PHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp2YWxfZGVsZXRlciwgc3RkOjpfXzI6OmVuYWJsZV9pZjxpc19jb252ZXJ0aWJsZTxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KiwgbWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPio+Ojp2YWx1ZSwgc3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+OjpfX25hdD46OnR5cGUp/QJ6ZW1zY3JpcHRlbjo6c21hcnRfcHRyX3RyYWl0PHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp2YWxfZGVsZXRlcjo6b3BlcmF0b3IoKSh2b2lkIGNvbnN0Kin+AvQBc3RkOjpfXzI6Ol9fc2hhcmVkX3B0cl9wb2ludGVyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qLCBlbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46OnZhbF9kZWxldGVyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp+X19zaGFyZWRfcHRyX3BvaW50ZXIoKf8C9gFzdGQ6Ol9fMjo6X19zaGFyZWRfcHRyX3BvaW50ZXI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6dmFsX2RlbGV0ZXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46On5fX3NoYXJlZF9wdHJfcG9pbnRlcigpLjGAA+8Bc3RkOjpfXzI6Ol9fc2hhcmVkX3B0cl9wb2ludGVyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qLCBlbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46OnZhbF9kZWxldGVyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+OjpfX29uX3plcm9fc2hhcmVkKCmBA4cCc3RkOjpfXzI6Ol9fc2hhcmVkX3B0cl9wb2ludGVyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qLCBlbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46OnZhbF9kZWxldGVyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+OjpfX2dldF9kZWxldGVyKHN0ZDo6dHlwZV9pbmZvIGNvbnN0JikgY29uc3SCA/QBc3RkOjpfXzI6Ol9fc2hhcmVkX3B0cl9wb2ludGVyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qLCBlbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46OnZhbF9kZWxldGVyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+OjpfX29uX3plcm9fc2hhcmVkX3dlYWsoKYMDkAFzdGQ6Ol9fMjo6X19zaGFyZWRfcHRyX2VtcGxhY2U8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6fl9fc2hhcmVkX3B0cl9lbXBsYWNlKCmEA5IBc3RkOjpfXzI6Ol9fc2hhcmVkX3B0cl9lbXBsYWNlPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46On5fX3NoYXJlZF9wdHJfZW1wbGFjZSgpLjGFA4sBc3RkOjpfXzI6Ol9fc2hhcmVkX3B0cl9lbXBsYWNlPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46Ol9fb25femVyb19zaGFyZWQoKYYDIW1heGlHcmFpbjxoYW5uV2luRnVuY3Rvcj46OnBsYXkoKYcDMW1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPjo6fm1heGlQaXRjaFNoaWZ0KCmIA/gDc3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID46OnNoYXJlZF9wdHI8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+LCBlbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4gPjo6dmFsX2RlbGV0ZXI+KG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiosIGVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp2YWxfZGVsZXRlciwgc3RkOjpfXzI6OmVuYWJsZV9pZjxpc19jb252ZXJ0aWJsZTxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4qLCBtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4qPjo6dmFsdWUsIHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+OjpfX25hdD46OnR5cGUpiQPxAXN0ZDo6X18yOjpfX3NoYXJlZF9wdHJfcG9pbnRlcjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4qLCBlbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4gPjo6dmFsX2RlbGV0ZXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4gPjo6fl9fc2hhcmVkX3B0cl9wb2ludGVyKCmKA/MBc3RkOjpfXzI6Ol9fc2hhcmVkX3B0cl9wb2ludGVyPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiosIGVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp2YWxfZGVsZXRlciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp+X19zaGFyZWRfcHRyX3BvaW50ZXIoKS4xiwOEAnN0ZDo6X18yOjpfX3NoYXJlZF9wdHJfcG9pbnRlcjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4qLCBlbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4gPjo6dmFsX2RlbGV0ZXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4gPjo6X19nZXRfZGVsZXRlcihzdGQ6OnR5cGVfaW5mbyBjb25zdCYpIGNvbnN0jAOOAXN0ZDo6X18yOjpfX3NoYXJlZF9wdHJfZW1wbGFjZTxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4gPjo6fl9fc2hhcmVkX3B0cl9lbXBsYWNlKCmNA5ABc3RkOjpfXzI6Ol9fc2hhcmVkX3B0cl9lbXBsYWNlPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp+X19zaGFyZWRfcHRyX2VtcGxhY2UoKS4xjgOJAXN0ZDo6X18yOjpfX3NoYXJlZF9wdHJfZW1wbGFjZTxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4gPjo6X19vbl96ZXJvX3NoYXJlZCgpjwMkX0dMT0JBTF9fc3ViX0lfbWF4aW1pbGlhbi5lbWJpbmQuY3BwkAMQbWF4aU9zYzo6bm9pc2UoKZEDGW1heGlPc2M6OnNpbmV3YXZlKGRvdWJsZSmSAxltYXhpT3NjOjpzaW5lYnVmNChkb3VibGUpkwMYbWF4aU9zYzo6c2luZWJ1Zihkb3VibGUplAMYbWF4aU9zYzo6Y29zd2F2ZShkb3VibGUplQMXbWF4aU9zYzo6cGhhc29yKGRvdWJsZSmWAxdtYXhpT3NjOjpzcXVhcmUoZG91YmxlKZcDHm1heGlPc2M6OnB1bHNlKGRvdWJsZSwgZG91YmxlKZgDGG1heGlPc2M6OmltcHVsc2UoZG91YmxlKZkDJ21heGlPc2M6OnBoYXNvcihkb3VibGUsIGRvdWJsZSwgZG91YmxlKZoDFG1heGlPc2M6OnNhdyhkb3VibGUpmwMVbWF4aU9zYzo6c2F3bihkb3VibGUpnAMZbWF4aU9zYzo6dHJpYW5nbGUoZG91YmxlKZ0DUG1heGlFbnZlbG9wZTo6bGluZShpbnQsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYpngMibWF4aUVudmVsb3BlOjp0cmlnZ2VyKGludCwgZG91YmxlKZ8DHm1heGlEZWxheWxpbmU6Om1heGlEZWxheWxpbmUoKaADJm1heGlEZWxheWxpbmU6OmRsKGRvdWJsZSwgaW50LCBkb3VibGUpoQMrbWF4aURlbGF5bGluZTo6ZGwoZG91YmxlLCBpbnQsIGRvdWJsZSwgaW50KaIDIm1heGlGaWx0ZXI6OmxvcGFzcyhkb3VibGUsIGRvdWJsZSmjAyJtYXhpRmlsdGVyOjpoaXBhc3MoZG91YmxlLCBkb3VibGUppAMpbWF4aUZpbHRlcjo6bG9yZXMoZG91YmxlLCBkb3VibGUsIGRvdWJsZSmlAyltYXhpRmlsdGVyOjpoaXJlcyhkb3VibGUsIGRvdWJsZSwgZG91YmxlKaYDLG1heGlGaWx0ZXI6OmJhbmRwYXNzKGRvdWJsZSwgZG91YmxlLCBkb3VibGUppwNYbWF4aU1peDo6c3RlcmVvKGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgZG91YmxlKagDXm1heGlNaXg6OnF1YWQoZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBkb3VibGUsIGRvdWJsZSmpA2ttYXhpTWl4OjphbWJpc29uaWMoZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKaoDbG1heGlTYW1wbGU6OmxvYWQoc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiwgaW50KasDEm1heGlTYW1wbGU6OnJlYWQoKawDZ3N0ZDo6X18yOjpiYXNpY19pZnN0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6YmFzaWNfaWZzdHJlYW0oY2hhciBjb25zdCosIHVuc2lnbmVkIGludCmtA90Bc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mIHN0ZDo6X18yOjpfX3B1dF9jaGFyYWN0ZXJfc2VxdWVuY2U8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4oc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgbG9uZymuA01zdGQ6Ol9fMjo6dmVjdG9yPHNob3J0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHNob3J0PiA+OjpfX2FwcGVuZCh1bnNpZ25lZCBsb25nKa8DTXN0ZDo6X18yOjpiYXNpY19maWxlYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfZmlsZWJ1ZigpsANsbWF4aVNhbXBsZTo6c2V0U2FtcGxlRnJvbU9nZ0Jsb2Ioc3RkOjpfXzI6OnZlY3Rvcjx1bnNpZ25lZCBjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHVuc2lnbmVkIGNoYXI+ID4mLCBpbnQpsQNMc3RkOjpfXzI6OmJhc2ljX2ZpbGVidWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OmJhc2ljX2ZpbGVidWYoKbIDXHN0ZDo6X18yOjpiYXNpY19maWxlYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpvcGVuKGNoYXIgY29uc3QqLCB1bnNpZ25lZCBpbnQpswNPc3RkOjpfXzI6OmJhc2ljX2lmc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfaWZzdHJlYW0oKbQDFW1heGlTYW1wbGU6OmlzUmVhZHkoKbUDTm1heGlTYW1wbGU6OnNldFNhbXBsZShzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mKbYD9gFzdGQ6Ol9fMjo6ZW5hYmxlX2lmPChfX2lzX2ZvcndhcmRfaXRlcmF0b3I8ZG91YmxlKj46OnZhbHVlKSAmJiAoaXNfY29uc3RydWN0aWJsZTxkb3VibGUsIHN0ZDo6X18yOjppdGVyYXRvcl90cmFpdHM8ZG91YmxlKj46OnJlZmVyZW5jZT46OnZhbHVlKSwgdm9pZD46OnR5cGUgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+Ojphc3NpZ248ZG91YmxlKj4oZG91YmxlKiwgZG91YmxlKim3A1NtYXhpU2FtcGxlOjpzZXRTYW1wbGUoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgaW50KbgDFW1heGlTYW1wbGU6OnRyaWdnZXIoKbkDEm1heGlTYW1wbGU6OnBsYXkoKboDKG1heGlTYW1wbGU6OnBsYXkoZG91YmxlLCBkb3VibGUsIGRvdWJsZSm7AzFtYXhpU2FtcGxlOjpwbGF5KGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSYpvAMpbWF4aVNhbXBsZTo6cGxheTQoZG91YmxlLCBkb3VibGUsIGRvdWJsZSm9AxZtYXhpU2FtcGxlOjpwbGF5T25jZSgpvgMcbWF4aVNhbXBsZTo6cGxheU9uWlgoZG91YmxlKb8DJG1heGlTYW1wbGU6OnBsYXlPblpYKGRvdWJsZSwgZG91YmxlKcADHG1heGlTYW1wbGU6OnBsYXlPbmNlKGRvdWJsZSnBAyxtYXhpU2FtcGxlOjpwbGF5T25aWChkb3VibGUsIGRvdWJsZSwgZG91YmxlKcIDKm1heGlTYW1wbGU6Omxvb3BTZXRQb3NPblpYKGRvdWJsZSwgZG91YmxlKcMDGG1heGlTYW1wbGU6OnBsYXkoZG91YmxlKcQDHW1heGlTYW1wbGU6Om5vcm1hbGlzZShkb3VibGUpxQMubWF4aVNhbXBsZTo6YXV0b1RyaW0oZmxvYXQsIGZsb2F0LCBib29sLCBib29sKcYDM21heGlEeW46OmdhdGUoZG91YmxlLCBkb3VibGUsIGxvbmcsIGRvdWJsZSwgZG91YmxlKccDO21heGlEeW46OmNvbXByZXNzb3IoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUpyAMZbWF4aUR5bjo6Y29tcHJlc3MoZG91YmxlKckDGm1heGlEeW46OnNldEF0dGFjayhkb3VibGUpygMbbWF4aUR5bjo6c2V0UmVsZWFzZShkb3VibGUpywMdbWF4aUR5bjo6c2V0VGhyZXNob2xkKGRvdWJsZSnMAy5tYXhpRW52Ojphcihkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBsb25nLCBpbnQpzQNAbWF4aUVudjo6YWRzcihkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgbG9uZywgaW50Kc4DGm1heGlFbnY6OmFkc3IoZG91YmxlLCBpbnQpzwMabWF4aUVudjo6c2V0QXR0YWNrKGRvdWJsZSnQAxttYXhpRW52OjpzZXRTdXN0YWluKGRvdWJsZSnRAxltYXhpRW52OjpzZXREZWNheShkb3VibGUp0gMSY29udmVydDo6bXRvZihpbnQp0wNgdmlydHVhbCB0aHVuayB0byBzdGQ6Ol9fMjo6YmFzaWNfaWZzdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19pZnN0cmVhbSgp1ANRc3RkOjpfXzI6OmJhc2ljX2lmc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfaWZzdHJlYW0oKS4x1QNidmlydHVhbCB0aHVuayB0byBzdGQ6Ol9fMjo6YmFzaWNfaWZzdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19pZnN0cmVhbSgpLjHWA0NzdGQ6Ol9fMjo6YmFzaWNfZmlsZWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6c3luYygp1wNPc3RkOjpfXzI6OmJhc2ljX2ZpbGVidWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19maWxlYnVmKCkuMdgDW3N0ZDo6X18yOjpiYXNpY19maWxlYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjppbWJ1ZShzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JinZA1BzdGQ6Ol9fMjo6YmFzaWNfZmlsZWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6c2V0YnVmKGNoYXIqLCBsb25nKdoDenN0ZDo6X18yOjpiYXNpY19maWxlYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpzZWVrb2ZmKGxvbmcgbG9uZywgc3RkOjpfXzI6Omlvc19iYXNlOjpzZWVrZGlyLCB1bnNpZ25lZCBpbnQp2wMcc3RkOjpfXzI6Ol9fdGhyb3dfYmFkX2Nhc3QoKdwDb3N0ZDo6X18yOjpiYXNpY19maWxlYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpzZWVrcG9zKHN0ZDo6X18yOjpmcG9zPF9fbWJzdGF0ZV90PiwgdW5zaWduZWQgaW50Kd0DSHN0ZDo6X18yOjpiYXNpY19maWxlYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp1bmRlcmZsb3coKd4DS3N0ZDo6X18yOjpiYXNpY19maWxlYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpwYmFja2ZhaWwoaW50Kd8DSnN0ZDo6X18yOjpiYXNpY19maWxlYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpvdmVyZmxvdyhpbnQp4AOFAnN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+IHN0ZDo6X18yOjpfX3BhZF9hbmRfb3V0cHV0PGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCBjaGFyKeEDG21heGlDbG9jazo6c2V0VGVtcG8oZG91YmxlKeIDE21heGlDbG9jazo6dGlja2VyKCnjAx9tYXhpQ2xvY2s6OnNldFRpY2tzUGVyQmVhdChpbnQp5AMdbWF4aUZGVDo6c2V0dXAoaW50LCBpbnQsIGludCnlAyptYXhpRkZUOjpwcm9jZXNzKGZsb2F0LCBtYXhpRkZUOjpmZnRNb2RlcynmAxNtYXhpRkZUOjptYWdzVG9EQigp5wMbbWF4aUZGVDo6c3BlY3RyYWxGbGF0bmVzcygp6AMbbWF4aUZGVDo6c3BlY3RyYWxDZW50cm9pZCgp6QMebWF4aUlGRlQ6OnNldHVwKGludCwgaW50LCBpbnQp6gOTAW1heGlJRkZUOjpwcm9jZXNzKHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mLCBzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+JiwgbWF4aUlGRlQ6OmZmdE1vZGVzKesDLkZGVChpbnQsIGJvb2wsIGZsb2F0KiwgZmxvYXQqLCBmbG9hdCosIGZsb2F0KinsAyRSZWFsRkZUKGludCwgZmxvYXQqLCBmbG9hdCosIGZsb2F0KintAyBmZnQ6OmdlbldpbmRvdyhpbnQsIGludCwgZmxvYXQqKe4DD2ZmdDo6c2V0dXAoaW50Ke8DC2ZmdDo6fmZmdCgp8AMhZmZ0OjpjYWxjRkZUKGludCwgZmxvYXQqLCBmbG9hdCop8QM3ZmZ0Ojpwb3dlclNwZWN0cnVtKGludCwgZmxvYXQqLCBmbG9hdCosIGZsb2F0KiwgZmxvYXQqKfIDHWZmdDo6Y29udlRvREIoZmxvYXQqLCBmbG9hdCop8wM7ZmZ0OjppbnZlcnNlRkZUQ29tcGxleChpbnQsIGZsb2F0KiwgZmxvYXQqLCBmbG9hdCosIGZsb2F0Kin0Az5mZnQ6OmludmVyc2VQb3dlclNwZWN0cnVtKGludCwgZmxvYXQqLCBmbG9hdCosIGZsb2F0KiwgZmxvYXQqKfUDN21heGlNRkNDQW5hbHlzZXI8ZG91YmxlPjo6bWVsRmlsdGVyQW5kTG9nU3F1YXJlKGZsb2F0Kin2AyBtYXhpUmV2ZXJiQmFzZTo6bWF4aVJldmVyYkJhc2UoKfcDHm1heGlTYXRSZXZlcmI6Om1heGlTYXRSZXZlcmIoKfgDG21heGlTYXRSZXZlcmI6OnBsYXkoZG91YmxlKfkDHG1heGlGcmVlVmVyYjo6bWF4aUZyZWVWZXJiKCn6AyptYXhpRnJlZVZlcmI6OnBsYXkoZG91YmxlLCBkb3VibGUsIGRvdWJsZSn7Aydwb2ludF9jb21wYXJlKHZvaWQgY29uc3QqLCB2b2lkIGNvbnN0Kin8Axp2b3JiaXNfZGVpbml0KHN0Yl92b3JiaXMqKf0DKWlzX3dob2xlX3BhY2tldF9wcmVzZW50KHN0Yl92b3JiaXMqLCBpbnQp/gMzdm9yYmlzX2RlY29kZV9wYWNrZXQoc3RiX3ZvcmJpcyosIGludCosIGludCosIGludCop/wMXc3RhcnRfcGFnZShzdGJfdm9yYmlzKimABC92b3JiaXNfZmluaXNoX2ZyYW1lKHN0Yl92b3JiaXMqLCBpbnQsIGludCwgaW50KYEEQHZvcmJpc19kZWNvZGVfaW5pdGlhbChzdGJfdm9yYmlzKiwgaW50KiwgaW50KiwgaW50KiwgaW50KiwgaW50KimCBBpnZXRfYml0cyhzdGJfdm9yYmlzKiwgaW50KYMEMmNvZGVib29rX2RlY29kZV9zY2FsYXJfcmF3KHN0Yl92b3JiaXMqLCBDb2RlYm9vayophARDZGVjb2RlX3Jlc2lkdWUoc3RiX3ZvcmJpcyosIGZsb2F0KiosIGludCwgaW50LCBpbnQsIHVuc2lnbmVkIGNoYXIqKYUEK2ludmVyc2VfbWRjdChmbG9hdCosIGludCwgc3RiX3ZvcmJpcyosIGludCmGBBlmbHVzaF9wYWNrZXQoc3RiX3ZvcmJpcyophwQac3RhcnRfZGVjb2RlcihzdGJfdm9yYmlzKimIBCh1aW50MzJfY29tcGFyZSh2b2lkIGNvbnN0Kiwgdm9pZCBjb25zdCopiQQlaW5pdF9ibG9ja3NpemUoc3RiX3ZvcmJpcyosIGludCwgaW50KYoEFnN0Yl92b3JiaXNfb3Blbl9tZW1vcnmLBBpzdGJfdm9yYmlzX2dldF9mcmFtZV9zaG9ydIwEQGNvbnZlcnRfc2FtcGxlc19zaG9ydChpbnQsIHNob3J0KiosIGludCwgaW50LCBmbG9hdCoqLCBpbnQsIGludCmNBCZzdGJfdm9yYmlzX2dldF9mcmFtZV9zaG9ydF9pbnRlcmxlYXZlZI4ER2NvbnZlcnRfY2hhbm5lbHNfc2hvcnRfaW50ZXJsZWF2ZWQoaW50LCBzaG9ydCosIGludCwgZmxvYXQqKiwgaW50LCBpbnQpjwQYc3RiX3ZvcmJpc19kZWNvZGVfbWVtb3J5kAQfbWF5YmVfc3RhcnRfcGFja2V0KHN0Yl92b3JiaXMqKZEEKXN0YXJ0X3BhZ2Vfbm9fY2FwdHVyZXBhdHRlcm4oc3RiX3ZvcmJpcyopkgQyY29kZWJvb2tfZGVjb2RlX3N0YXJ0KHN0Yl92b3JiaXMqLCBDb2RlYm9vayosIGludCmTBF9jb2RlYm9va19kZWNvZGVfZGVpbnRlcmxlYXZlX3JlcGVhdChzdGJfdm9yYmlzKiwgQ29kZWJvb2sqLCBmbG9hdCoqLCBpbnQsIGludCosIGludCosIGludCwgaW50KZQENWltZGN0X3N0ZXAzX2l0ZXIwX2xvb3AoaW50LCBmbG9hdCosIGludCwgaW50LCBmbG9hdCoplQQ8aW1kY3Rfc3RlcDNfaW5uZXJfcl9sb29wKGludCwgZmxvYXQqLCBpbnQsIGludCwgZmxvYXQqLCBpbnQplgQHc2NhbGJuZpcEBmxkZXhwZpgEBm1lbWNtcJkEBXFzb3J0mgQEc2lmdJsEA3NocpwEB3RyaW5rbGWdBANzaGyeBARwbnR6nwQFY3ljbGWgBAdhX2N0el9soQQMX19zdGRpb19zZWVrogQKX19sb2NrZmlsZaMEDF9fdW5sb2NrZmlsZaQECV9fZndyaXRleKUEBmZ3cml0ZaYEB2lwcmludGanBBBfX2Vycm5vX2xvY2F0aW9uqAQHd2NydG9tYqkEBndjdG9tYqoEBm1lbWNocqsEBWZyZXhwrAQTX192ZnByaW50Zl9pbnRlcm5hbK0EC3ByaW50Zl9jb3JlrgQDb3V0rwQGZ2V0aW50sAQHcG9wX2FyZ7EEA3BhZLIEBWZtdF9vswQFZm10X3i0BAVmbXRfdbUECHZmcHJpbnRmtgQGZm10X2ZwtwQTcG9wX2FyZ19sb25nX2RvdWJsZbgECXZmaXByaW50ZrkECl9fb2ZsX2xvY2u6BAlfX3Rvd3JpdGW7BAhmaXByaW50ZrwEBWZwdXRjvQQRX19mdGVsbG9fdW5sb2NrZWS+BAhfX2Z0ZWxsb78EBWZ0ZWxswAQIX190b3JlYWTBBAVmcmVhZMIEEV9fZnNlZWtvX3VubG9ja2VkwwQIX19mc2Vla2/EBAVmc2Vla8UEDV9fc3RkaW9fY2xvc2XGBAVmZ2V0Y8cEBnN0cmxlbsgEC19fc3RyY2hybnVsyQQGc3RyY2hyygQMX19mbW9kZWZsYWdzywQFZm9wZW7MBAl2c25wcmludGbNBAhzbl93cml0Zc4EBmZjbG9zZc8EGV9fZW1zY3JpcHRlbl9zdGRvdXRfY2xvc2XQBBhfX2Vtc2NyaXB0ZW5fc3Rkb3V0X3NlZWvRBAxfX3N0ZGlvX3JlYWTSBAhfX2Zkb3BlbtMEDV9fc3RkaW9fd3JpdGXUBApfX292ZXJmbG931QQGZmZsdXNo1gQRX19mZmx1c2hfdW5sb2NrZWTXBAdfX3VmbG932AQJX19vZmxfYWRk2QQJX19sc2hydGkz2gQJX19hc2hsdGkz2wQMX190cnVuY3RmZGYy3AQFX19jb3PdBBBfX3JlbV9waW8yX2xhcmdl3gQKX19yZW1fcGlvMt8EBV9fc2lu4AQDY29z4QQHX19jb3NkZuIEB19fc2luZGbjBAtfX3JlbV9waW8yZuQEBGNvc2blBANzaW7mBARzaW5m5wQFX190YW7oBAN0YW7pBARhdGFu6gQFYXRhbmbrBAZhdGFuMmbsBARleHBm7QQDbG9n7gQEbG9nZu8EA3Bvd/AEB3dtZW1jcHnxBBlzdGQ6OnVuY2F1Z2h0X2V4Y2VwdGlvbigp8gRFc3RkOjpfXzI6OmJhc2ljX2lvczxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX2lvcygp8wQfc3RkOjpfXzI6Omlvc19iYXNlOjp+aW9zX2Jhc2UoKfQEP3N0ZDo6X18yOjppb3NfYmFzZTo6X19jYWxsX2NhbGxiYWNrcyhzdGQ6Ol9fMjo6aW9zX2Jhc2U6OmV2ZW50KfUER3N0ZDo6X18yOjpiYXNpY19pb3M8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19pb3MoKS4x9gRRc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX3N0cmVhbWJ1Zigp9wRTc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX3N0cmVhbWJ1ZigpLjH4BFBzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpiYXNpY19zdHJlYW1idWYoKfkEXXN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OmltYnVlKHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKfoEUnN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnNldGJ1ZihjaGFyKiwgbG9uZyn7BHxzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpzZWVrb2ZmKGxvbmcgbG9uZywgc3RkOjpfXzI6Omlvc19iYXNlOjpzZWVrZGlyLCB1bnNpZ25lZCBpbnQp/ARxc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6c2Vla3BvcyhzdGQ6Ol9fMjo6ZnBvczxfX21ic3RhdGVfdD4sIHVuc2lnbmVkIGludCn9BFJzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp4c2dldG4oY2hhciosIGxvbmcp/gREc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+Ojpjb3B5KGNoYXIqLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgbG9uZyn/BEpzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp1bmRlcmZsb3coKYAFRnN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnVmbG93KCmBBU1zdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpwYmFja2ZhaWwoaW50KYIFWHN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnhzcHV0bihjaGFyIGNvbnN0KiwgbG9uZymDBVdzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Ojp+YmFzaWNfc3RyZWFtYnVmKCmEBVlzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Ojp+YmFzaWNfc3RyZWFtYnVmKCkuMYUFVnN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46OmJhc2ljX3N0cmVhbWJ1ZigphgVbc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1Zjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6eHNnZXRuKHdjaGFyX3QqLCBsb25nKYcFTXN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Pjo6Y29weSh3Y2hhcl90Kiwgd2NoYXJfdCBjb25zdCosIHVuc2lnbmVkIGxvbmcpiAVMc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1Zjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6dWZsb3coKYkFYXN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46OnhzcHV0bih3Y2hhcl90IGNvbnN0KiwgbG9uZymKBU9zdGQ6Ol9fMjo6YmFzaWNfaXN0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX2lzdHJlYW0oKS4xiwVedmlydHVhbCB0aHVuayB0byBzdGQ6Ol9fMjo6YmFzaWNfaXN0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX2lzdHJlYW0oKYwFT3N0ZDo6X18yOjpiYXNpY19pc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfaXN0cmVhbSgpLjKNBWB2aXJ0dWFsIHRodW5rIHRvIHN0ZDo6X18yOjpiYXNpY19pc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfaXN0cmVhbSgpLjGOBY8Bc3RkOjpfXzI6OmJhc2ljX2lzdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnNlbnRyeTo6c2VudHJ5KHN0ZDo6X18yOjpiYXNpY19pc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+JiwgYm9vbCmPBURzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6Zmx1c2goKZAFYXN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYgc3RkOjpfXzI6OnVzZV9mYWNldDxzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gPihzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JimRBdEBYm9vbCBzdGQ6Ol9fMjo6b3BlcmF0b3IhPTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiBjb25zdCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+IGNvbnN0JimSBVRzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6b3BlcmF0b3IqKCkgY29uc3STBU9zdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6b3BlcmF0b3IrKygplAXRAWJvb2wgc3RkOjpfXzI6Om9wZXJhdG9yPT08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gY29uc3QmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiBjb25zdCYplQWJAXN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpzZW50cnk6OnNlbnRyeShzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYplgVOc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnNlbnRyeTo6fnNlbnRyeSgplwWYAXN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjplcXVhbChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiBjb25zdCYpIGNvbnN0mAVHc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6c2J1bXBjKCmZBUpzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpzcHV0YyhjaGFyKZoFTnN0ZDo6X18yOjpiYXNpY19pc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpyZWFkKGNoYXIqLCBsb25nKZsFanN0ZDo6X18yOjpiYXNpY19pc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpzZWVrZyhsb25nIGxvbmcsIHN0ZDo6X18yOjppb3NfYmFzZTo6c2Vla2RpcimcBUpzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6Zmx1c2goKZ0FZ3N0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYgc3RkOjpfXzI6OnVzZV9mYWNldDxzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gPihzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JimeBeMBYm9vbCBzdGQ6Ol9fMjo6b3BlcmF0b3IhPTx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiBjb25zdCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+IGNvbnN0JimfBVVzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6b3BlcmF0b3IrKygpoAXjAWJvb2wgc3RkOjpfXzI6Om9wZXJhdG9yPT08d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gY29uc3QmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiBjb25zdCYpoQWVAXN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+OjpzZW50cnk6OnNlbnRyeShzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYpogWkAXN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+OjplcXVhbChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiBjb25zdCYpIGNvbnN0owVNc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1Zjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6c2J1bXBjKCmkBVNzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+OjpzcHV0Yyh3Y2hhcl90KaUFT3N0ZDo6X18yOjpiYXNpY19vc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfb3N0cmVhbSgpLjGmBV52aXJ0dWFsIHRodW5rIHRvIHN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfb3N0cmVhbSgppwVPc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19vc3RyZWFtKCkuMqgFYHZpcnR1YWwgdGh1bmsgdG8gc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19vc3RyZWFtKCkuMakF7QFzdGQ6Ol9fMjo6bnVtX3B1dDxjaGFyLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+IGNvbnN0JiBzdGQ6Ol9fMjo6dXNlX2ZhY2V0PHN0ZDo6X18yOjpudW1fcHV0PGNoYXIsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID4gPihzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JimqBUVzdGQ6Ol9fMjo6YmFzaWNfaW9zPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpmaWxsKCkgY29uc3SrBUpzdGQ6Ol9fMjo6YmFzaWNfaW9zPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp3aWRlbihjaGFyKSBjb25zdKwFTnN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpvcGVyYXRvcjw8KHNob3J0Ka0FTHN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpvcGVyYXRvcjw8KGludCmuBVZzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6b3BlcmF0b3I8PCh1bnNpZ25lZCBsb25nKa8FUnN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpvcGVyYXRvcj0oY2hhcimwBUZzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6cHV0KGNoYXIpsQVbc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46Om9wZXJhdG9yPSh3Y2hhcl90KbIFcHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OmJhc2ljX3N0cmluZyhjaGFyIGNvbnN0KimzBSFzdGQ6Ol9fMjo6aW9zX2Jhc2U6On5pb3NfYmFzZSgpLjG0BR9zdGQ6Ol9fMjo6aW9zX2Jhc2U6OmluaXQodm9pZCoptQW1AXN0ZDo6X18yOjplbmFibGVfaWY8KGlzX21vdmVfY29uc3RydWN0aWJsZTx1bnNpZ25lZCBpbnQ+Ojp2YWx1ZSkgJiYgKGlzX21vdmVfYXNzaWduYWJsZTx1bnNpZ25lZCBpbnQ+Ojp2YWx1ZSksIHZvaWQ+Ojp0eXBlIHN0ZDo6X18yOjpzd2FwPHVuc2lnbmVkIGludD4odW5zaWduZWQgaW50JiwgdW5zaWduZWQgaW50Jim2BVlzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6X190ZXN0X2Zvcl9lb2YoKSBjb25zdLcFX3N0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+OjpfX3Rlc3RfZm9yX2VvZigpIGNvbnN0uAUGdW5nZXRjuQUgc3RkOjpfXzI6Omlvc19iYXNlOjpJbml0OjpJbml0KCm6BRdfX2N4eF9nbG9iYWxfYXJyYXlfZHRvcrsFP3N0ZDo6X18yOjpfX3N0ZGluYnVmPGNoYXI+OjpfX3N0ZGluYnVmKF9JT19GSUxFKiwgX19tYnN0YXRlX3QqKbwFigFzdGQ6Ol9fMjo6YmFzaWNfaXN0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6YmFzaWNfaXN0cmVhbShzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Kim9BUJzdGQ6Ol9fMjo6X19zdGRpbmJ1Zjx3Y2hhcl90Pjo6X19zdGRpbmJ1ZihfSU9fRklMRSosIF9fbWJzdGF0ZV90Kim+BZYBc3RkOjpfXzI6OmJhc2ljX2lzdHJlYW08d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46OmJhc2ljX2lzdHJlYW0oc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1Zjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiopvwVBc3RkOjpfXzI6Ol9fc3Rkb3V0YnVmPGNoYXI+OjpfX3N0ZG91dGJ1ZihfSU9fRklMRSosIF9fbWJzdGF0ZV90KinABYoBc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OmJhc2ljX29zdHJlYW0oc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiopwQVEc3RkOjpfXzI6Ol9fc3Rkb3V0YnVmPHdjaGFyX3Q+OjpfX3N0ZG91dGJ1ZihfSU9fRklMRSosIF9fbWJzdGF0ZV90KinCBZYBc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46OmJhc2ljX29zdHJlYW0oc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1Zjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiopwwV9c3RkOjpfXzI6OmJhc2ljX2lvczxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6aW5pdChzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+KinEBYsBc3RkOjpfXzI6OmNvZGVjdnQ8Y2hhciwgY2hhciwgX19tYnN0YXRlX3Q+IGNvbnN0JiBzdGQ6Ol9fMjo6dXNlX2ZhY2V0PHN0ZDo6X18yOjpjb2RlY3Z0PGNoYXIsIGNoYXIsIF9fbWJzdGF0ZV90PiA+KHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKcUFkQFzdGQ6Ol9fMjo6Y29kZWN2dDx3Y2hhcl90LCBjaGFyLCBfX21ic3RhdGVfdD4gY29uc3QmIHN0ZDo6X18yOjp1c2VfZmFjZXQ8c3RkOjpfXzI6OmNvZGVjdnQ8d2NoYXJfdCwgY2hhciwgX19tYnN0YXRlX3Q+ID4oc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYpxgUpc3RkOjpfXzI6Ol9fc3RkaW5idWY8Y2hhcj46On5fX3N0ZGluYnVmKCnHBTpzdGQ6Ol9fMjo6X19zdGRpbmJ1ZjxjaGFyPjo6aW1idWUoc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYpyAUnc3RkOjpfXzI6Ol9fc3RkaW5idWY8Y2hhcj46OnVuZGVyZmxvdygpyQUrc3RkOjpfXzI6Ol9fc3RkaW5idWY8Y2hhcj46Ol9fZ2V0Y2hhcihib29sKcoFI3N0ZDo6X18yOjpfX3N0ZGluYnVmPGNoYXI+Ojp1ZmxvdygpywUqc3RkOjpfXzI6Ol9fc3RkaW5idWY8Y2hhcj46OnBiYWNrZmFpbChpbnQpzAUsc3RkOjpfXzI6Ol9fc3RkaW5idWY8d2NoYXJfdD46On5fX3N0ZGluYnVmKCnNBT1zdGQ6Ol9fMjo6X19zdGRpbmJ1Zjx3Y2hhcl90Pjo6aW1idWUoc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYpzgUqc3RkOjpfXzI6Ol9fc3RkaW5idWY8d2NoYXJfdD46OnVuZGVyZmxvdygpzwUuc3RkOjpfXzI6Ol9fc3RkaW5idWY8d2NoYXJfdD46Ol9fZ2V0Y2hhcihib29sKdAFJnN0ZDo6X18yOjpfX3N0ZGluYnVmPHdjaGFyX3Q+Ojp1Zmxvdygp0QU2c3RkOjpfXzI6Ol9fc3RkaW5idWY8d2NoYXJfdD46OnBiYWNrZmFpbCh1bnNpZ25lZCBpbnQp0gU7c3RkOjpfXzI6Ol9fc3Rkb3V0YnVmPGNoYXI+OjppbWJ1ZShzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JinTBSNzdGQ6Ol9fMjo6X19zdGRvdXRidWY8Y2hhcj46OnN5bmMoKdQFNnN0ZDo6X18yOjpfX3N0ZG91dGJ1ZjxjaGFyPjo6eHNwdXRuKGNoYXIgY29uc3QqLCBsb25nKdUFKnN0ZDo6X18yOjpfX3N0ZG91dGJ1ZjxjaGFyPjo6b3ZlcmZsb3coaW50KdYFPnN0ZDo6X18yOjpfX3N0ZG91dGJ1Zjx3Y2hhcl90Pjo6aW1idWUoc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYp1wU8c3RkOjpfXzI6Ol9fc3Rkb3V0YnVmPHdjaGFyX3Q+Ojp4c3B1dG4od2NoYXJfdCBjb25zdCosIGxvbmcp2AU2c3RkOjpfXzI6Ol9fc3Rkb3V0YnVmPHdjaGFyX3Q+OjpvdmVyZmxvdyh1bnNpZ25lZCBpbnQp2QUHX19zaGxpbdoFCF9fc2hnZXRj2wUIX19tdWx0aTPcBQlfX2ludHNjYW7dBQdtYnJ0b3dj3gUNX19leHRlbmRzZnRmMt8FCF9fbXVsdGYz4AULX19mbG9hdHNpdGbhBQhfX2FkZHRmM+IFDV9fZXh0ZW5kZGZ0ZjLjBQdfX2xldGYy5AUHX19nZXRmMuUFCWNvcHlzaWdubOYFDV9fZmxvYXR1bnNpdGbnBQhfX3N1YnRmM+gFB3NjYWxibmzpBQhfX2RpdnRmM+oFC19fZmxvYXRzY2Fu6wUIaGV4ZmxvYXTsBQhkZWNmbG9hdO0FB3NjYW5leHDuBQxfX3RydW5jdGZzZjLvBQd2ZnNjYW5m8AUFYXJnX27xBQlzdG9yZV9pbnTyBQ1fX3N0cmluZ19yZWFk8wUHdnNzY2FuZvQFB2RvX3JlYWT1BQZzdHJjbXD2BSBfX2Vtc2NyaXB0ZW5fZW52aXJvbl9jb25zdHJ1Y3RvcvcFB3N0cm5jbXD4BQZnZXRlbnb5BQhfX211bm1hcPoFDF9fZ2V0X2xvY2FsZfsFC19fbmV3bG9jYWxl/AUJdmFzcHJpbnRm/QUGc3NjYW5m/gUIc25wcmludGb/BQpmcmVlbG9jYWxlgAYGd2NzbGVugQYJd2NzcnRvbWJzggYKd2NzbnJ0b21ic4MGCW1ic3J0b3djc4QGCm1ic25ydG93Y3OFBgZzdHJ0b3iGBgpzdHJ0b3VsbF9shwYJc3RydG9sbF9siAYGc3RydG9miQYIc3RydG94LjGKBgZzdHJ0b2SLBgdzdHJ0b2xkjAYJc3RydG9sZF9sjQZdc3RkOjpfXzI6OmNvbGxhdGU8Y2hhcj46OmRvX2NvbXBhcmUoY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdCopIGNvbnN0jgZFc3RkOjpfXzI6OmNvbGxhdGU8Y2hhcj46OmRvX3RyYW5zZm9ybShjaGFyIGNvbnN0KiwgY2hhciBjb25zdCopIGNvbnN0jwbPAXN0ZDo6X18yOjplbmFibGVfaWY8X19pc19mb3J3YXJkX2l0ZXJhdG9yPGNoYXIgY29uc3QqPjo6dmFsdWUsIHZvaWQ+Ojp0eXBlIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46Ol9faW5pdDxjaGFyIGNvbnN0Kj4oY2hhciBjb25zdCosIGNoYXIgY29uc3QqKZAGQHN0ZDo6X18yOjpjb2xsYXRlPGNoYXI+Ojpkb19oYXNoKGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KikgY29uc3SRBmxzdGQ6Ol9fMjo6Y29sbGF0ZTx3Y2hhcl90Pjo6ZG9fY29tcGFyZSh3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0KikgY29uc3SSBk5zdGQ6Ol9fMjo6Y29sbGF0ZTx3Y2hhcl90Pjo6ZG9fdHJhbnNmb3JtKHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0KikgY29uc3STBuQBc3RkOjpfXzI6OmVuYWJsZV9pZjxfX2lzX2ZvcndhcmRfaXRlcmF0b3I8d2NoYXJfdCBjb25zdCo+Ojp2YWx1ZSwgdm9pZD46OnR5cGUgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6X19pbml0PHdjaGFyX3QgY29uc3QqPih3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdCoplAZJc3RkOjpfXzI6OmNvbGxhdGU8d2NoYXJfdD46OmRvX2hhc2god2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqKSBjb25zdJUGmgJzdGQ6Ol9fMjo6bnVtX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBib29sJikgY29uc3SWBmdzdGQ6Ol9fMjo6bnVtcHVuY3Q8Y2hhcj4gY29uc3QmIHN0ZDo6X18yOjp1c2VfZmFjZXQ8c3RkOjpfXzI6Om51bXB1bmN0PGNoYXI+ID4oc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYplwakBXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QqIHN0ZDo6X18yOjpfX3NjYW5fa2V5d29yZDxzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCosIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiA+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QqLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0Kiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JiwgdW5zaWduZWQgaW50JiwgYm9vbCmYBjhzdGQ6Ol9fMjo6bG9jYWxlOjp1c2VfZmFjZXQoc3RkOjpfXzI6OmxvY2FsZTo6aWQmKSBjb25zdJkGzAFzdGQ6Ol9fMjo6dW5pcXVlX3B0cjx1bnNpZ25lZCBjaGFyLCB2b2lkICgqKSh2b2lkKik+Ojp1bmlxdWVfcHRyPHRydWUsIHZvaWQ+KHVuc2lnbmVkIGNoYXIqLCBzdGQ6Ol9fMjo6X19kZXBlbmRlbnRfdHlwZTxzdGQ6Ol9fMjo6X191bmlxdWVfcHRyX2RlbGV0ZXJfc2ZpbmFlPHZvaWQgKCopKHZvaWQqKT4sIHRydWU+OjpfX2dvb2RfcnZhbF9yZWZfdHlwZSmaBpoCc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgbG9uZyYpIGNvbnN0mwbrAnN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+IHN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZG9fZ2V0X3NpZ25lZDxsb25nPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGxvbmcmKSBjb25zdJwGOXN0ZDo6X18yOjpfX251bV9nZXRfYmFzZTo6X19nZXRfYmFzZShzdGQ6Ol9fMjo6aW9zX2Jhc2UmKZ0GSHN0ZDo6X18yOjpfX251bV9nZXQ8Y2hhcj46Ol9fc3RhZ2UyX2ludF9wcmVwKHN0ZDo6X18yOjppb3NfYmFzZSYsIGNoYXImKZ4GZXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OmJhc2ljX3N0cmluZygpnwZsc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6cmVzaXplKHVuc2lnbmVkIGxvbmcpoAblAXN0ZDo6X18yOjpfX251bV9nZXQ8Y2hhcj46Ol9fc3RhZ2UyX2ludF9sb29wKGNoYXIsIGludCwgY2hhciosIGNoYXIqJiwgdW5zaWduZWQgaW50JiwgY2hhciwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCYsIHVuc2lnbmVkIGludCosIHVuc2lnbmVkIGludComLCBjaGFyIGNvbnN0KimhBlxsb25nIHN0ZDo6X18yOjpfX251bV9nZXRfc2lnbmVkX2ludGVncmFsPGxvbmc+KGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgaW50JiwgaW50KaIGpQFzdGQ6Ol9fMjo6X19jaGVja19ncm91cGluZyhzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0JiwgdW5zaWduZWQgaW50KiwgdW5zaWduZWQgaW50KiwgdW5zaWduZWQgaW50JimjBp8Cc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgbG9uZyBsb25nJikgY29uc3SkBvUCc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19kb19nZXRfc2lnbmVkPGxvbmcgbG9uZz4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBsb25nIGxvbmcmKSBjb25zdKUGZmxvbmcgbG9uZyBzdGQ6Ol9fMjo6X19udW1fZ2V0X3NpZ25lZF9pbnRlZ3JhbDxsb25nIGxvbmc+KGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgaW50JiwgaW50KaYGpAJzdGQ6Ol9fMjo6bnVtX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB1bnNpZ25lZCBzaG9ydCYpIGNvbnN0pwaBA3N0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+IHN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZG9fZ2V0X3Vuc2lnbmVkPHVuc2lnbmVkIHNob3J0PihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHVuc2lnbmVkIHNob3J0JikgY29uc3SoBnJ1bnNpZ25lZCBzaG9ydCBzdGQ6Ol9fMjo6X19udW1fZ2V0X3Vuc2lnbmVkX2ludGVncmFsPHVuc2lnbmVkIHNob3J0PihjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGludCYsIGludCmpBqICc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdW5zaWduZWQgaW50JikgY29uc3SqBv0Cc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19kb19nZXRfdW5zaWduZWQ8dW5zaWduZWQgaW50PihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHVuc2lnbmVkIGludCYpIGNvbnN0qwZudW5zaWduZWQgaW50IHN0ZDo6X18yOjpfX251bV9nZXRfdW5zaWduZWRfaW50ZWdyYWw8dW5zaWduZWQgaW50PihjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGludCYsIGludCmsBqgCc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdW5zaWduZWQgbG9uZyBsb25nJikgY29uc3StBokDc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19kb19nZXRfdW5zaWduZWQ8dW5zaWduZWQgbG9uZyBsb25nPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHVuc2lnbmVkIGxvbmcgbG9uZyYpIGNvbnN0rgZ6dW5zaWduZWQgbG9uZyBsb25nIHN0ZDo6X18yOjpfX251bV9nZXRfdW5zaWduZWRfaW50ZWdyYWw8dW5zaWduZWQgbG9uZyBsb25nPihjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGludCYsIGludCmvBpsCc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgZmxvYXQmKSBjb25zdLAG9QJzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiBzdGQ6Ol9fMjo6bnVtX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2RvX2dldF9mbG9hdGluZ19wb2ludDxmbG9hdD4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBmbG9hdCYpIGNvbnN0sQZYc3RkOjpfXzI6Ol9fbnVtX2dldDxjaGFyPjo6X19zdGFnZTJfZmxvYXRfcHJlcChzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCBjaGFyKiwgY2hhciYsIGNoYXImKbIG8AFzdGQ6Ol9fMjo6X19udW1fZ2V0PGNoYXI+OjpfX3N0YWdlMl9mbG9hdF9sb29wKGNoYXIsIGJvb2wmLCBjaGFyJiwgY2hhciosIGNoYXIqJiwgY2hhciwgY2hhciwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCYsIHVuc2lnbmVkIGludCosIHVuc2lnbmVkIGludComLCB1bnNpZ25lZCBpbnQmLCBjaGFyKimzBk9mbG9hdCBzdGQ6Ol9fMjo6X19udW1fZ2V0X2Zsb2F0PGZsb2F0PihjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGludCYptAacAnN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGRvdWJsZSYpIGNvbnN0tQb3AnN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+IHN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZG9fZ2V0X2Zsb2F0aW5nX3BvaW50PGRvdWJsZT4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBkb3VibGUmKSBjb25zdLYGUWRvdWJsZSBzdGQ6Ol9fMjo6X19udW1fZ2V0X2Zsb2F0PGRvdWJsZT4oY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBpbnQmKbcGoQJzdGQ6Ol9fMjo6bnVtX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBsb25nIGRvdWJsZSYpIGNvbnN0uAaBA3N0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+IHN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZG9fZ2V0X2Zsb2F0aW5nX3BvaW50PGxvbmcgZG91YmxlPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGxvbmcgZG91YmxlJikgY29uc3S5Bltsb25nIGRvdWJsZSBzdGQ6Ol9fMjo6X19udW1fZ2V0X2Zsb2F0PGxvbmcgZG91YmxlPihjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGludCYpugabAnN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHZvaWQqJikgY29uc3S7BhJzdGQ6Ol9fMjo6X19jbG9jKCm8BkxzdGQ6Ol9fMjo6X19saWJjcHBfc3NjYW5mX2woY2hhciBjb25zdCosIF9fbG9jYWxlX3N0cnVjdCosIGNoYXIgY29uc3QqLCAuLi4pvQZfc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6X196ZXJvKCm+BlRjaGFyIGNvbnN0KiBzdGQ6Ol9fMjo6ZmluZDxjaGFyIGNvbnN0KiwgY2hhcj4oY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0Jim/BklzdGQ6Ol9fMjo6X19saWJjcHBfbG9jYWxlX2d1YXJkOjpfX2xpYmNwcF9sb2NhbGVfZ3VhcmQoX19sb2NhbGVfc3RydWN0KiYpwAavAnN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGJvb2wmKSBjb25zdMEGbXN0ZDo6X18yOjpudW1wdW5jdDx3Y2hhcl90PiBjb25zdCYgc3RkOjpfXzI6OnVzZV9mYWNldDxzdGQ6Ol9fMjo6bnVtcHVuY3Q8d2NoYXJfdD4gPihzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JinCBuAFc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiBjb25zdCogc3RkOjpfXzI6Ol9fc2Nhbl9rZXl3b3JkPHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+IGNvbnN0Kiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+ID4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiBjb25zdCosIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4gY29uc3QqLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmLCB1bnNpZ25lZCBpbnQmLCBib29sKcMGrwJzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBsb25nJikgY29uc3TEBoYDc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19kb19nZXRfc2lnbmVkPGxvbmc+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgbG9uZyYpIGNvbnN0xQZNc3RkOjpfXzI6Ol9fbnVtX2dldDx3Y2hhcl90Pjo6X19kb193aWRlbihzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90KikgY29uc3TGBk5zdGQ6Ol9fMjo6X19udW1fZ2V0PHdjaGFyX3Q+OjpfX3N0YWdlMl9pbnRfcHJlcChzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90JinHBvEBc3RkOjpfXzI6Ol9fbnVtX2dldDx3Y2hhcl90Pjo6X19zdGFnZTJfaW50X2xvb3Aod2NoYXJfdCwgaW50LCBjaGFyKiwgY2hhciomLCB1bnNpZ25lZCBpbnQmLCB3Y2hhcl90LCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0JiwgdW5zaWduZWQgaW50KiwgdW5zaWduZWQgaW50KiYsIHdjaGFyX3QgY29uc3QqKcgGtAJzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBsb25nIGxvbmcmKSBjb25zdMkGkANzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiBzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2RvX2dldF9zaWduZWQ8bG9uZyBsb25nPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGxvbmcgbG9uZyYpIGNvbnN0yga5AnN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHVuc2lnbmVkIHNob3J0JikgY29uc3TLBpwDc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19kb19nZXRfdW5zaWduZWQ8dW5zaWduZWQgc2hvcnQ+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdW5zaWduZWQgc2hvcnQmKSBjb25zdMwGtwJzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB1bnNpZ25lZCBpbnQmKSBjb25zdM0GmANzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiBzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2RvX2dldF91bnNpZ25lZDx1bnNpZ25lZCBpbnQ+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdW5zaWduZWQgaW50JikgY29uc3TOBr0Cc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdW5zaWduZWQgbG9uZyBsb25nJikgY29uc3TPBqQDc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19kb19nZXRfdW5zaWduZWQ8dW5zaWduZWQgbG9uZyBsb25nPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHVuc2lnbmVkIGxvbmcgbG9uZyYpIGNvbnN00AawAnN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGZsb2F0JikgY29uc3TRBpADc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19kb19nZXRfZmxvYXRpbmdfcG9pbnQ8ZmxvYXQ+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgZmxvYXQmKSBjb25zdNIGZHN0ZDo6X18yOjpfX251bV9nZXQ8d2NoYXJfdD46Ol9fc3RhZ2UyX2Zsb2F0X3ByZXAoc3RkOjpfXzI6Omlvc19iYXNlJiwgd2NoYXJfdCosIHdjaGFyX3QmLCB3Y2hhcl90JinTBv8Bc3RkOjpfXzI6Ol9fbnVtX2dldDx3Y2hhcl90Pjo6X19zdGFnZTJfZmxvYXRfbG9vcCh3Y2hhcl90LCBib29sJiwgY2hhciYsIGNoYXIqLCBjaGFyKiYsIHdjaGFyX3QsIHdjaGFyX3QsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QmLCB1bnNpZ25lZCBpbnQqLCB1bnNpZ25lZCBpbnQqJiwgdW5zaWduZWQgaW50Jiwgd2NoYXJfdCop1AaxAnN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGRvdWJsZSYpIGNvbnN01QaSA3N0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+IHN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZG9fZ2V0X2Zsb2F0aW5nX3BvaW50PGRvdWJsZT4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBkb3VibGUmKSBjb25zdNYGtgJzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBsb25nIGRvdWJsZSYpIGNvbnN01wacA3N0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+IHN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZG9fZ2V0X2Zsb2F0aW5nX3BvaW50PGxvbmcgZG91YmxlPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGxvbmcgZG91YmxlJikgY29uc3TYBrACc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50Jiwgdm9pZComKSBjb25zdNkGZndjaGFyX3QgY29uc3QqIHN0ZDo6X18yOjpmaW5kPHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90Pih3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QmKdoGZ3djaGFyX3QgY29uc3QqIHN0ZDo6X18yOjpfX251bV9nZXQ8d2NoYXJfdD46Ol9fZG9fd2lkZW5fcDx3Y2hhcl90PihzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90KikgY29uc3TbBs0Bc3RkOjpfXzI6Om51bV9wdXQ8Y2hhciwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCBjaGFyLCBib29sKSBjb25zdNwGXnN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OmJlZ2luKCndBlxzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjplbmQoKd4GzQFzdGQ6Ol9fMjo6bnVtX3B1dDxjaGFyLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIGNoYXIsIGxvbmcpIGNvbnN03wZOc3RkOjpfXzI6Ol9fbnVtX3B1dF9iYXNlOjpfX2Zvcm1hdF9pbnQoY2hhciosIGNoYXIgY29uc3QqLCBib29sLCB1bnNpZ25lZCBpbnQp4AZXc3RkOjpfXzI6Ol9fbGliY3BwX3NucHJpbnRmX2woY2hhciosIHVuc2lnbmVkIGxvbmcsIF9fbG9jYWxlX3N0cnVjdCosIGNoYXIgY29uc3QqLCAuLi4p4QZVc3RkOjpfXzI6Ol9fbnVtX3B1dF9iYXNlOjpfX2lkZW50aWZ5X3BhZGRpbmcoY2hhciosIGNoYXIqLCBzdGQ6Ol9fMjo6aW9zX2Jhc2UgY29uc3QmKeIGdXN0ZDo6X18yOjpfX251bV9wdXQ8Y2hhcj46Ol9fd2lkZW5fYW5kX2dyb3VwX2ludChjaGFyKiwgY2hhciosIGNoYXIqLCBjaGFyKiwgY2hhciomLCBjaGFyKiYsIHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKeMGK3ZvaWQgc3RkOjpfXzI6OnJldmVyc2U8Y2hhcio+KGNoYXIqLCBjaGFyKinkBiFzdGQ6Ol9fMjo6aW9zX2Jhc2U6OndpZHRoKCkgY29uc3TlBtIBc3RkOjpfXzI6Om51bV9wdXQ8Y2hhciwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCBjaGFyLCBsb25nIGxvbmcpIGNvbnN05gbWAXN0ZDo6X18yOjpudW1fcHV0PGNoYXIsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgY2hhciwgdW5zaWduZWQgbG9uZykgY29uc3TnBtsBc3RkOjpfXzI6Om51bV9wdXQ8Y2hhciwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCBjaGFyLCB1bnNpZ25lZCBsb25nIGxvbmcpIGNvbnN06AbPAXN0ZDo6X18yOjpudW1fcHV0PGNoYXIsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgY2hhciwgZG91YmxlKSBjb25zdOkGSnN0ZDo6X18yOjpfX251bV9wdXRfYmFzZTo6X19mb3JtYXRfZmxvYXQoY2hhciosIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBpbnQp6gYlc3RkOjpfXzI6Omlvc19iYXNlOjpwcmVjaXNpb24oKSBjb25zdOsGSXN0ZDo6X18yOjpfX2xpYmNwcF9hc3ByaW50Zl9sKGNoYXIqKiwgX19sb2NhbGVfc3RydWN0KiwgY2hhciBjb25zdCosIC4uLinsBndzdGQ6Ol9fMjo6X19udW1fcHV0PGNoYXI+OjpfX3dpZGVuX2FuZF9ncm91cF9mbG9hdChjaGFyKiwgY2hhciosIGNoYXIqLCBjaGFyKiwgY2hhciomLCBjaGFyKiYsIHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKe0G1AFzdGQ6Ol9fMjo6bnVtX3B1dDxjaGFyLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIGNoYXIsIGxvbmcgZG91YmxlKSBjb25zdO4G1AFzdGQ6Ol9fMjo6bnVtX3B1dDxjaGFyLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIGNoYXIsIHZvaWQgY29uc3QqKSBjb25zdO8G3wFzdGQ6Ol9fMjo6bnVtX3B1dDx3Y2hhcl90LCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHdjaGFyX3QsIGJvb2wpIGNvbnN08AZlc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6ZW5kKCnxBt8Bc3RkOjpfXzI6Om51bV9wdXQ8d2NoYXJfdCwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90LCBsb25nKSBjb25zdPIGgQFzdGQ6Ol9fMjo6X19udW1fcHV0PHdjaGFyX3Q+OjpfX3dpZGVuX2FuZF9ncm91cF9pbnQoY2hhciosIGNoYXIqLCBjaGFyKiwgd2NoYXJfdCosIHdjaGFyX3QqJiwgd2NoYXJfdComLCBzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JinzBqMCc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gc3RkOjpfXzI6Ol9fcGFkX2FuZF9vdXRwdXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4oc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdCosIHN0ZDo6X18yOjppb3NfYmFzZSYsIHdjaGFyX3Qp9AY0dm9pZCBzdGQ6Ol9fMjo6cmV2ZXJzZTx3Y2hhcl90Kj4od2NoYXJfdCosIHdjaGFyX3QqKfUGhAFzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+OjpiYXNpY19zdHJpbmcodW5zaWduZWQgbG9uZywgd2NoYXJfdCn2BuQBc3RkOjpfXzI6Om51bV9wdXQ8d2NoYXJfdCwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90LCBsb25nIGxvbmcpIGNvbnN09wboAXN0ZDo6X18yOjpudW1fcHV0PHdjaGFyX3QsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgd2NoYXJfdCwgdW5zaWduZWQgbG9uZykgY29uc3T4Bu0Bc3RkOjpfXzI6Om51bV9wdXQ8d2NoYXJfdCwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90LCB1bnNpZ25lZCBsb25nIGxvbmcpIGNvbnN0+QbhAXN0ZDo6X18yOjpudW1fcHV0PHdjaGFyX3QsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgd2NoYXJfdCwgZG91YmxlKSBjb25zdPoGgwFzdGQ6Ol9fMjo6X19udW1fcHV0PHdjaGFyX3Q+OjpfX3dpZGVuX2FuZF9ncm91cF9mbG9hdChjaGFyKiwgY2hhciosIGNoYXIqLCB3Y2hhcl90Kiwgd2NoYXJfdComLCB3Y2hhcl90KiYsIHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKfsG5gFzdGQ6Ol9fMjo6bnVtX3B1dDx3Y2hhcl90LCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHdjaGFyX3QsIGxvbmcgZG91YmxlKSBjb25zdPwG5gFzdGQ6Ol9fMjo6bnVtX3B1dDx3Y2hhcl90LCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHdjaGFyX3QsIHZvaWQgY29uc3QqKSBjb25zdP0GU3ZvaWQgc3RkOjpfXzI6Ol9fcmV2ZXJzZTxjaGFyKj4oY2hhciosIGNoYXIqLCBzdGQ6Ol9fMjo6cmFuZG9tX2FjY2Vzc19pdGVyYXRvcl90YWcp/gZcdm9pZCBzdGQ6Ol9fMjo6X19yZXZlcnNlPHdjaGFyX3QqPih3Y2hhcl90Kiwgd2NoYXJfdCosIHN0ZDo6X18yOjpyYW5kb21fYWNjZXNzX2l0ZXJhdG9yX3RhZyn/BrACc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmdldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHRtKiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqKSBjb25zdIAHc3N0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19kYXRlX29yZGVyKCkgY29uc3SBB54Cc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldF90aW1lKHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdG0qKSBjb25zdIIHngJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0X2RhdGUoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB0bSopIGNvbnN0gwehAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXRfd2Vla2RheShzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHRtKikgY29uc3SEB68Cc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0X3dlZWtkYXluYW1lKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYpIGNvbnN0hQejAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXRfbW9udGhuYW1lKHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdG0qKSBjb25zdIYHrQJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfbW9udGhuYW1lKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYpIGNvbnN0hweeAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXRfeWVhcihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHRtKikgY29uc3SIB6gCc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0X3llYXIoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JikgY29uc3SJB6UCaW50IHN0ZDo6X18yOjpfX2dldF91cF90b19uX2RpZ2l0czxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYsIGludCmKB6UCc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHRtKiwgY2hhciwgY2hhcikgY29uc3SLB6UCc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0X3BlcmNlbnQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JikgY29uc3SMB6cCc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0X2RheShpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdI0HqAJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfaG91cihpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdI4HqwJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfMTJfaG91cihpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdI8HsAJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfZGF5X3llYXJfbnVtKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYpIGNvbnN0kAepAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2dldF9tb250aChpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdJEHqgJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfbWludXRlKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYpIGNvbnN0kgepAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2dldF93aGl0ZV9zcGFjZShzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdJMHqQJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfYW1fcG0oaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JikgY29uc3SUB6oCc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0X3NlY29uZChpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdJUHqwJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfd2Vla2RheShpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdJYHqQJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfeWVhcjQoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JikgY29uc3SXB8sCc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmdldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHRtKiwgd2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqKSBjb25zdJgHswJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0X3RpbWUoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB0bSopIGNvbnN0mQezAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXRfZGF0ZShzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHRtKikgY29uc3SaB7YCc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldF93ZWVrZGF5KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdG0qKSBjb25zdJsHxwJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfd2Vla2RheW5hbWUoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JikgY29uc3ScB7gCc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldF9tb250aG5hbWUoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB0bSopIGNvbnN0nQfFAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF9tb250aG5hbWUoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JikgY29uc3SeB7MCc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldF95ZWFyKHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdG0qKSBjb25zdJ8HwAJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfeWVhcihpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmKSBjb25zdKAHvQJpbnQgc3RkOjpfXzI6Ol9fZ2V0X3VwX3RvX25fZGlnaXRzPHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JiwgaW50KaEHugJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdG0qLCBjaGFyLCBjaGFyKSBjb25zdKIHvQJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfcGVyY2VudChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmKSBjb25zdKMHvwJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfZGF5KGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN0pAfAAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF9ob3VyKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN0pQfDAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF8xMl9ob3VyKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN0pgfIAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF9kYXlfeWVhcl9udW0oaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JikgY29uc3SnB8ECc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZ2V0X21vbnRoKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN0qAfCAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF9taW51dGUoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JikgY29uc3SpB8ECc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZ2V0X3doaXRlX3NwYWNlKHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN0qgfBAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF9hbV9wbShpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmKSBjb25zdKsHwgJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfc2Vjb25kKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN0rAfDAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF93ZWVrZGF5KGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN0rQfBAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF95ZWFyNChpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmKSBjb25zdK4H3wFzdGQ6Ol9fMjo6dGltZV9wdXQ8Y2hhciwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCBjaGFyLCB0bSBjb25zdCosIGNoYXIsIGNoYXIpIGNvbnN0rwdKc3RkOjpfXzI6Ol9fdGltZV9wdXQ6Ol9fZG9fcHV0KGNoYXIqLCBjaGFyKiYsIHRtIGNvbnN0KiwgY2hhciwgY2hhcikgY29uc3SwB40Bc3RkOjpfXzI6OmVuYWJsZV9pZjwoaXNfbW92ZV9jb25zdHJ1Y3RpYmxlPGNoYXI+Ojp2YWx1ZSkgJiYgKGlzX21vdmVfYXNzaWduYWJsZTxjaGFyPjo6dmFsdWUpLCB2b2lkPjo6dHlwZSBzdGQ6Ol9fMjo6c3dhcDxjaGFyPihjaGFyJiwgY2hhciYpsQfuAXN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+IHN0ZDo6X18yOjpfX2NvcHk8Y2hhciosIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID4oY2hhciosIGNoYXIqLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPimyB/EBc3RkOjpfXzI6OnRpbWVfcHV0PHdjaGFyX3QsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgd2NoYXJfdCwgdG0gY29uc3QqLCBjaGFyLCBjaGFyKSBjb25zdLMHUHN0ZDo6X18yOjpfX3RpbWVfcHV0OjpfX2RvX3B1dCh3Y2hhcl90Kiwgd2NoYXJfdComLCB0bSBjb25zdCosIGNoYXIsIGNoYXIpIGNvbnN0tAdlc3RkOjpfXzI6Ol9fbGliY3BwX21ic3J0b3djc19sKHdjaGFyX3QqLCBjaGFyIGNvbnN0KiosIHVuc2lnbmVkIGxvbmcsIF9fbWJzdGF0ZV90KiwgX19sb2NhbGVfc3RydWN0Kim1ByxzdGQ6Ol9fMjo6X190aHJvd19ydW50aW1lX2Vycm9yKGNoYXIgY29uc3QqKbYHiQJzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiBzdGQ6Ol9fMjo6X19jb3B5PHdjaGFyX3QqLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+KHdjaGFyX3QqLCB3Y2hhcl90Kiwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4ptwc7c3RkOjpfXzI6Om1vbmV5cHVuY3Q8Y2hhciwgZmFsc2U+Ojpkb19kZWNpbWFsX3BvaW50KCkgY29uc3S4BzZzdGQ6Ol9fMjo6bW9uZXlwdW5jdDxjaGFyLCBmYWxzZT46OmRvX2dyb3VwaW5nKCkgY29uc3S5BztzdGQ6Ol9fMjo6bW9uZXlwdW5jdDxjaGFyLCBmYWxzZT46OmRvX25lZ2F0aXZlX3NpZ24oKSBjb25zdLoHOHN0ZDo6X18yOjptb25leXB1bmN0PGNoYXIsIGZhbHNlPjo6ZG9fcG9zX2Zvcm1hdCgpIGNvbnN0uwc+c3RkOjpfXzI6Om1vbmV5cHVuY3Q8d2NoYXJfdCwgZmFsc2U+Ojpkb19kZWNpbWFsX3BvaW50KCkgY29uc3S8Bz5zdGQ6Ol9fMjo6bW9uZXlwdW5jdDx3Y2hhcl90LCBmYWxzZT46OmRvX25lZ2F0aXZlX3NpZ24oKSBjb25zdL0HqQJzdGQ6Ol9fMjo6bW9uZXlfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIGJvb2wsIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGxvbmcgZG91YmxlJikgY29uc3S+B4wDc3RkOjpfXzI6Om1vbmV5X2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2RvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBib29sLCBzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JiwgdW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQmLCBib29sJiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0Jiwgc3RkOjpfXzI6OnVuaXF1ZV9wdHI8Y2hhciwgdm9pZCAoKikodm9pZCopPiYsIGNoYXIqJiwgY2hhciopvwfdA3N0ZDo6X18yOjpfX21vbmV5X2dldDxjaGFyPjo6X19nYXRoZXJfaW5mbyhib29sLCBzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0Jiwgc3RkOjpfXzI6Om1vbmV5X2Jhc2U6OnBhdHRlcm4mLCBjaGFyJiwgY2hhciYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4mLCBpbnQmKcAHUnN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpvcGVyYXRvcisrKGludCnBB2Z2b2lkIHN0ZDo6X18yOjpfX2RvdWJsZV9vcl9ub3RoaW5nPGNoYXI+KHN0ZDo6X18yOjp1bmlxdWVfcHRyPGNoYXIsIHZvaWQgKCopKHZvaWQqKT4mLCBjaGFyKiYsIGNoYXIqJinCB4YBdm9pZCBzdGQ6Ol9fMjo6X19kb3VibGVfb3Jfbm90aGluZzx1bnNpZ25lZCBpbnQ+KHN0ZDo6X18yOjp1bmlxdWVfcHRyPHVuc2lnbmVkIGludCwgdm9pZCAoKikodm9pZCopPiYsIHVuc2lnbmVkIGludComLCB1bnNpZ25lZCBpbnQqJinDB/MCc3RkOjpfXzI6Om1vbmV5X2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBib29sLCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+JikgY29uc3TEB15zdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpjbGVhcigpxQfaAXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4mIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46Ol9fYXBwZW5kX2ZvcndhcmRfdW5zYWZlPGNoYXIqPihjaGFyKiwgY2hhciopxgd3c3RkOjpfXzI6Om1vbmV5cHVuY3Q8Y2hhciwgdHJ1ZT4gY29uc3QmIHN0ZDo6X18yOjp1c2VfZmFjZXQ8c3RkOjpfXzI6Om1vbmV5cHVuY3Q8Y2hhciwgdHJ1ZT4gPihzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JinHB7kBc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6b3BlcmF0b3I9KHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4mJinIB3lzdGQ6Ol9fMjo6bW9uZXlwdW5jdDxjaGFyLCBmYWxzZT4gY29uc3QmIHN0ZDo6X18yOjp1c2VfZmFjZXQ8c3RkOjpfXzI6Om1vbmV5cHVuY3Q8Y2hhciwgZmFsc2U+ID4oc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYpyQfvAWJvb2wgc3RkOjpfXzI6OmVxdWFsPHN0ZDo6X18yOjpfX3dyYXBfaXRlcjxjaGFyKj4sIHN0ZDo6X18yOjpfX3dyYXBfaXRlcjxjaGFyKj4sIHN0ZDo6X18yOjpfX2VxdWFsX3RvPGNoYXIsIGNoYXI+ID4oc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPGNoYXIqPiwgc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPGNoYXIqPiwgc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPGNoYXIqPiwgc3RkOjpfXzI6Ol9fZXF1YWxfdG88Y2hhciwgY2hhcj4pygczc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPGNoYXIqPjo6b3BlcmF0b3IrKGxvbmcpIGNvbnN0ywdlc3RkOjpfXzI6OnVuaXF1ZV9wdHI8Y2hhciwgdm9pZCAoKikodm9pZCopPjo6b3BlcmF0b3I9KHN0ZDo6X18yOjp1bmlxdWVfcHRyPGNoYXIsIHZvaWQgKCopKHZvaWQqKT4mJinMB74Cc3RkOjpfXzI6Om1vbmV5X2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBib29sLCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBsb25nIGRvdWJsZSYpIGNvbnN0zQetA3N0ZDo6X18yOjptb25leV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19kb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgYm9vbCwgc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50JiwgYm9vbCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYsIHN0ZDo6X18yOjp1bmlxdWVfcHRyPHdjaGFyX3QsIHZvaWQgKCopKHZvaWQqKT4mLCB3Y2hhcl90KiYsIHdjaGFyX3QqKc4HgQRzdGQ6Ol9fMjo6X19tb25leV9nZXQ8d2NoYXJfdD46Ol9fZ2F0aGVyX2luZm8oYm9vbCwgc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYsIHN0ZDo6X18yOjptb25leV9iYXNlOjpwYXR0ZXJuJiwgd2NoYXJfdCYsIHdjaGFyX3QmLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+JiwgaW50JinPB1hzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6b3BlcmF0b3IrKyhpbnQp0AeRA3N0ZDo6X18yOjptb25leV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgYm9vbCwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiYpIGNvbnN00Qdnc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6Y2xlYXIoKdIH9QFzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+JiBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+OjpfX2FwcGVuZF9mb3J3YXJkX3Vuc2FmZTx3Y2hhcl90Kj4od2NoYXJfdCosIHdjaGFyX3QqKdMHfXN0ZDo6X18yOjptb25leXB1bmN0PHdjaGFyX3QsIHRydWU+IGNvbnN0JiBzdGQ6Ol9fMjo6dXNlX2ZhY2V0PHN0ZDo6X18yOjptb25leXB1bmN0PHdjaGFyX3QsIHRydWU+ID4oc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYp1AfLAXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID46Om9wZXJhdG9yPShzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+JiYp1Qd/c3RkOjpfXzI6Om1vbmV5cHVuY3Q8d2NoYXJfdCwgZmFsc2U+IGNvbnN0JiBzdGQ6Ol9fMjo6dXNlX2ZhY2V0PHN0ZDo6X18yOjptb25leXB1bmN0PHdjaGFyX3QsIGZhbHNlPiA+KHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKdYHigJib29sIHN0ZDo6X18yOjplcXVhbDxzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8d2NoYXJfdCo+LCBzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8d2NoYXJfdCo+LCBzdGQ6Ol9fMjo6X19lcXVhbF90bzx3Y2hhcl90LCB3Y2hhcl90PiA+KHN0ZDo6X18yOjpfX3dyYXBfaXRlcjx3Y2hhcl90Kj4sIHN0ZDo6X18yOjpfX3dyYXBfaXRlcjx3Y2hhcl90Kj4sIHN0ZDo6X18yOjpfX3dyYXBfaXRlcjx3Y2hhcl90Kj4sIHN0ZDo6X18yOjpfX2VxdWFsX3RvPHdjaGFyX3QsIHdjaGFyX3Q+KdcHNnN0ZDo6X18yOjpfX3dyYXBfaXRlcjx3Y2hhcl90Kj46Om9wZXJhdG9yKyhsb25nKSBjb25zdNgH3AFzdGQ6Ol9fMjo6bW9uZXlfcHV0PGNoYXIsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgYm9vbCwgc3RkOjpfXzI6Omlvc19iYXNlJiwgY2hhciwgbG9uZyBkb3VibGUpIGNvbnN02QeLA3N0ZDo6X18yOjpfX21vbmV5X3B1dDxjaGFyPjo6X19nYXRoZXJfaW5mbyhib29sLCBib29sLCBzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0Jiwgc3RkOjpfXzI6Om1vbmV5X2Jhc2U6OnBhdHRlcm4mLCBjaGFyJiwgY2hhciYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiYsIGludCYp2gfZA3N0ZDo6X18yOjpfX21vbmV5X3B1dDxjaGFyPjo6X19mb3JtYXQoY2hhciosIGNoYXIqJiwgY2hhciomLCB1bnNpZ25lZCBpbnQsIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0Kiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JiwgYm9vbCwgc3RkOjpfXzI6Om1vbmV5X2Jhc2U6OnBhdHRlcm4gY29uc3QmLCBjaGFyLCBjaGFyLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QmLCBpbnQp2weOAWNoYXIqIHN0ZDo6X18yOjpjb3B5PHN0ZDo6X18yOjpfX3dyYXBfaXRlcjxjaGFyIGNvbnN0Kj4sIGNoYXIqPihzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8Y2hhciBjb25zdCo+LCBzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8Y2hhciBjb25zdCo+LCBjaGFyKincB60Cc3RkOjpfXzI6Om1vbmV5X3B1dDxjaGFyLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIGJvb2wsIHN0ZDo6X18yOjppb3NfYmFzZSYsIGNoYXIsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QmKSBjb25zdN0H7gFzdGQ6Ol9fMjo6bW9uZXlfcHV0PHdjaGFyX3QsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgYm9vbCwgc3RkOjpfXzI6Omlvc19iYXNlJiwgd2NoYXJfdCwgbG9uZyBkb3VibGUpIGNvbnN03gemA3N0ZDo6X18yOjpfX21vbmV5X3B1dDx3Y2hhcl90Pjo6X19nYXRoZXJfaW5mbyhib29sLCBib29sLCBzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0Jiwgc3RkOjpfXzI6Om1vbmV5X2Jhc2U6OnBhdHRlcm4mLCB3Y2hhcl90Jiwgd2NoYXJfdCYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiYsIGludCYp3weGBHN0ZDo6X18yOjpfX21vbmV5X3B1dDx3Y2hhcl90Pjo6X19mb3JtYXQod2NoYXJfdCosIHdjaGFyX3QqJiwgd2NoYXJfdComLCB1bnNpZ25lZCBpbnQsIHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0Kiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JiwgYm9vbCwgc3RkOjpfXzI6Om1vbmV5X2Jhc2U6OnBhdHRlcm4gY29uc3QmLCB3Y2hhcl90LCB3Y2hhcl90LCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiBjb25zdCYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4gY29uc3QmLCBpbnQp4AegAXdjaGFyX3QqIHN0ZDo6X18yOjpjb3B5PHN0ZDo6X18yOjpfX3dyYXBfaXRlcjx3Y2hhcl90IGNvbnN0Kj4sIHdjaGFyX3QqPihzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8d2NoYXJfdCBjb25zdCo+LCBzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8d2NoYXJfdCBjb25zdCo+LCB3Y2hhcl90KinhB8gCc3RkOjpfXzI6Om1vbmV5X3B1dDx3Y2hhcl90LCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIGJvb2wsIHN0ZDo6X18yOjppb3NfYmFzZSYsIHdjaGFyX3QsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4gY29uc3QmKSBjb25zdOIHkAFjaGFyKiBzdGQ6Ol9fMjo6X19jb3B5PHN0ZDo6X18yOjpfX3dyYXBfaXRlcjxjaGFyIGNvbnN0Kj4sIGNoYXIqPihzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8Y2hhciBjb25zdCo+LCBzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8Y2hhciBjb25zdCo+LCBjaGFyKinjB6IBd2NoYXJfdCogc3RkOjpfXzI6Ol9fY29weTxzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8d2NoYXJfdCBjb25zdCo+LCB3Y2hhcl90Kj4oc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPHdjaGFyX3QgY29uc3QqPiwgc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPHdjaGFyX3QgY29uc3QqPiwgd2NoYXJfdCop5AeeAXN0ZDo6X18yOjptZXNzYWdlczxjaGFyPjo6ZG9fb3BlbihzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0Jiwgc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYpIGNvbnN05QeUAXN0ZDo6X18yOjptZXNzYWdlczxjaGFyPjo6ZG9fZ2V0KGxvbmcsIGludCwgaW50LCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0JikgY29uc3TmB7gDc3RkOjpfXzI6OmJhY2tfaW5zZXJ0X2l0ZXJhdG9yPHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gPiBzdGQ6Ol9fMjo6X19uYXJyb3dfdG9fdXRmODw4dWw+OjpvcGVyYXRvcigpPHN0ZDo6X18yOjpiYWNrX2luc2VydF9pdGVyYXRvcjxzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+ID4sIGNoYXI+KHN0ZDo6X18yOjpiYWNrX2luc2VydF9pdGVyYXRvcjxzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+ID4sIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KikgY29uc3TnB44Bc3RkOjpfXzI6OmJhY2tfaW5zZXJ0X2l0ZXJhdG9yPHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gPjo6b3BlcmF0b3I9KGNoYXIgY29uc3QmKegHoAFzdGQ6Ol9fMjo6bWVzc2FnZXM8d2NoYXJfdD46OmRvX2dldChsb25nLCBpbnQsIGludCwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiBjb25zdCYpIGNvbnN06QfCA3N0ZDo6X18yOjpiYWNrX2luc2VydF9pdGVyYXRvcjxzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+ID4gc3RkOjpfXzI6Ol9fbmFycm93X3RvX3V0Zjg8MzJ1bD46Om9wZXJhdG9yKCk8c3RkOjpfXzI6OmJhY2tfaW5zZXJ0X2l0ZXJhdG9yPHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gPiwgd2NoYXJfdD4oc3RkOjpfXzI6OmJhY2tfaW5zZXJ0X2l0ZXJhdG9yPHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gPiwgd2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqKSBjb25zdOoH0ANzdGQ6Ol9fMjo6YmFja19pbnNlcnRfaXRlcmF0b3I8c3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiA+IHN0ZDo6X18yOjpfX3dpZGVuX2Zyb21fdXRmODwzMnVsPjo6b3BlcmF0b3IoKTxzdGQ6Ol9fMjo6YmFja19pbnNlcnRfaXRlcmF0b3I8c3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiA+ID4oc3RkOjpfXzI6OmJhY2tfaW5zZXJ0X2l0ZXJhdG9yPHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4gPiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqKSBjb25zdOsHOXN0ZDo6X18yOjpjb2RlY3Z0PHdjaGFyX3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6fmNvZGVjdnQoKewHLXN0ZDo6X18yOjpsb2NhbGU6Ol9faW1wOjpfX2ltcCh1bnNpZ25lZCBsb25nKe0HfnN0ZDo6X18yOjpfX3ZlY3Rvcl9iYXNlPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46Ol9fdmVjdG9yX2Jhc2UoKe4HggFzdGQ6Ol9fMjo6dmVjdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46Ol9fdmFsbG9jYXRlKHVuc2lnbmVkIGxvbmcp7weJAXN0ZDo6X18yOjp2ZWN0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4gPjo6X19jb25zdHJ1Y3RfYXRfZW5kKHVuc2lnbmVkIGxvbmcp8Ad2c3RkOjpfXzI6Ol9fdmVjdG9yX2Jhc2U8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4gPjo6Y2xlYXIoKfEHjgFzdGQ6Ol9fMjo6dmVjdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46Ol9fYW5ub3RhdGVfc2hyaW5rKHVuc2lnbmVkIGxvbmcpIGNvbnN08gcdc3RkOjpfXzI6OmxvY2FsZTo6aWQ6Ol9fZ2V0KCnzB0BzdGQ6Ol9fMjo6bG9jYWxlOjpfX2ltcDo6aW5zdGFsbChzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIGxvbmcp9AdIc3RkOjpfXzI6OmN0eXBlPGNoYXI+OjpjdHlwZSh1bnNpZ25lZCBzaG9ydCBjb25zdCosIGJvb2wsIHVuc2lnbmVkIGxvbmcp9Qcbc3RkOjpfXzI6OmxvY2FsZTo6Y2xhc3NpYygp9gd9c3RkOjpfXzI6OnZlY3RvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiA+OjpyZXNpemUodW5zaWduZWQgbG9uZyn3ByFzdGQ6Ol9fMjo6bG9jYWxlOjpfX2ltcDo6fl9faW1wKCn4B4EBc3RkOjpfXzI6OnZlY3RvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiA+OjpfX2Fubm90YXRlX2RlbGV0ZSgpIGNvbnN0+Qcjc3RkOjpfXzI6OmxvY2FsZTo6X19pbXA6On5fX2ltcCgpLjH6B39zdGQ6Ol9fMjo6dmVjdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46Ol9fYXBwZW5kKHVuc2lnbmVkIGxvbmcp+wccc3RkOjpfXzI6OmxvY2FsZTo6X19nbG9iYWwoKfwHGnN0ZDo6X18yOjpsb2NhbGU6OmxvY2FsZSgp/Qcuc3RkOjpfXzI6OmxvY2FsZTo6X19pbXA6Omhhc19mYWNldChsb25nKSBjb25zdP4HHnN0ZDo6X18yOjpsb2NhbGU6OmlkOjpfX2luaXQoKf8HjAF2b2lkIHN0ZDo6X18yOjpjYWxsX29uY2U8c3RkOjpfXzI6Oihhbm9ueW1vdXMgbmFtZXNwYWNlKTo6X19mYWtlX2JpbmQ+KHN0ZDo6X18yOjpvbmNlX2ZsYWcmLCBzdGQ6Ol9fMjo6KGFub255bW91cyBuYW1lc3BhY2UpOjpfX2Zha2VfYmluZCYmKYAIK3N0ZDo6X18yOjpsb2NhbGU6OmZhY2V0OjpfX29uX3plcm9fc2hhcmVkKCmBCGl2b2lkIHN0ZDo6X18yOjpfX2NhbGxfb25jZV9wcm94eTxzdGQ6Ol9fMjo6dHVwbGU8c3RkOjpfXzI6Oihhbm9ueW1vdXMgbmFtZXNwYWNlKTo6X19mYWtlX2JpbmQmJj4gPih2b2lkKimCCD5zdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD46OmRvX2lzKHVuc2lnbmVkIHNob3J0LCB3Y2hhcl90KSBjb25zdIMIVnN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90Pjo6ZG9faXMod2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqLCB1bnNpZ25lZCBzaG9ydCopIGNvbnN0hAhac3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+Ojpkb19zY2FuX2lzKHVuc2lnbmVkIHNob3J0LCB3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdCopIGNvbnN0hQhbc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+Ojpkb19zY2FuX25vdCh1bnNpZ25lZCBzaG9ydCwgd2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqKSBjb25zdIYIM3N0ZDo6X18yOjpjdHlwZTx3Y2hhcl90Pjo6ZG9fdG91cHBlcih3Y2hhcl90KSBjb25zdIcIRHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90Pjo6ZG9fdG91cHBlcih3Y2hhcl90Kiwgd2NoYXJfdCBjb25zdCopIGNvbnN0iAgzc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+Ojpkb190b2xvd2VyKHdjaGFyX3QpIGNvbnN0iQhEc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+Ojpkb190b2xvd2VyKHdjaGFyX3QqLCB3Y2hhcl90IGNvbnN0KikgY29uc3SKCC5zdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD46OmRvX3dpZGVuKGNoYXIpIGNvbnN0iwhMc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+Ojpkb193aWRlbihjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHdjaGFyX3QqKSBjb25zdIwIOHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90Pjo6ZG9fbmFycm93KHdjaGFyX3QsIGNoYXIpIGNvbnN0jQhWc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+Ojpkb19uYXJyb3cod2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqLCBjaGFyLCBjaGFyKikgY29uc3SOCB9zdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj46On5jdHlwZSgpjwghc3RkOjpfXzI6OmN0eXBlPGNoYXI+Ojp+Y3R5cGUoKS4xkAgtc3RkOjpfXzI6OmN0eXBlPGNoYXI+Ojpkb190b3VwcGVyKGNoYXIpIGNvbnN0kQg7c3RkOjpfXzI6OmN0eXBlPGNoYXI+Ojpkb190b3VwcGVyKGNoYXIqLCBjaGFyIGNvbnN0KikgY29uc3SSCC1zdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj46OmRvX3RvbG93ZXIoY2hhcikgY29uc3STCDtzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj46OmRvX3RvbG93ZXIoY2hhciosIGNoYXIgY29uc3QqKSBjb25zdJQIRnN0ZDo6X18yOjpjdHlwZTxjaGFyPjo6ZG9fd2lkZW4oY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCBjaGFyKikgY29uc3SVCDJzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj46OmRvX25hcnJvdyhjaGFyLCBjaGFyKSBjb25zdJYITXN0ZDo6X18yOjpjdHlwZTxjaGFyPjo6ZG9fbmFycm93KGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgY2hhciwgY2hhciopIGNvbnN0lwiEAXN0ZDo6X18yOjpjb2RlY3Z0PGNoYXIsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9fb3V0KF9fbWJzdGF0ZV90JiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiYsIGNoYXIqLCBjaGFyKiwgY2hhciomKSBjb25zdJgIYHN0ZDo6X18yOjpjb2RlY3Z0PGNoYXIsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9fdW5zaGlmdChfX21ic3RhdGVfdCYsIGNoYXIqLCBjaGFyKiwgY2hhciomKSBjb25zdJkIcnN0ZDo6X18yOjpjb2RlY3Z0PGNoYXIsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9fbGVuZ3RoKF9fbWJzdGF0ZV90JiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBsb25nKSBjb25zdJoIO3N0ZDo6X18yOjpjb2RlY3Z0PHdjaGFyX3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6fmNvZGVjdnQoKS4xmwiQAXN0ZDo6X18yOjpjb2RlY3Z0PHdjaGFyX3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9fb3V0KF9fbWJzdGF0ZV90Jiwgd2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0KiYsIGNoYXIqLCBjaGFyKiwgY2hhciomKSBjb25zdJwIdXN0ZDo6X18yOjpfX2xpYmNwcF93Y3NucnRvbWJzX2woY2hhciosIHdjaGFyX3QgY29uc3QqKiwgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgX19tYnN0YXRlX3QqLCBfX2xvY2FsZV9zdHJ1Y3QqKZ0ITHN0ZDo6X18yOjpfX2xpYmNwcF93Y3J0b21iX2woY2hhciosIHdjaGFyX3QsIF9fbWJzdGF0ZV90KiwgX19sb2NhbGVfc3RydWN0KimeCI8Bc3RkOjpfXzI6OmNvZGVjdnQ8d2NoYXJfdCwgY2hhciwgX19tYnN0YXRlX3Q+Ojpkb19pbihfX21ic3RhdGVfdCYsIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdComLCB3Y2hhcl90Kiwgd2NoYXJfdCosIHdjaGFyX3QqJikgY29uc3SfCHVzdGQ6Ol9fMjo6X19saWJjcHBfbWJzbnJ0b3djc19sKHdjaGFyX3QqLCBjaGFyIGNvbnN0KiosIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIF9fbWJzdGF0ZV90KiwgX19sb2NhbGVfc3RydWN0KimgCGJzdGQ6Ol9fMjo6X19saWJjcHBfbWJydG93Y19sKHdjaGFyX3QqLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgbG9uZywgX19tYnN0YXRlX3QqLCBfX2xvY2FsZV9zdHJ1Y3QqKaEIY3N0ZDo6X18yOjpjb2RlY3Z0PHdjaGFyX3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9fdW5zaGlmdChfX21ic3RhdGVfdCYsIGNoYXIqLCBjaGFyKiwgY2hhciomKSBjb25zdKIIQnN0ZDo6X18yOjpjb2RlY3Z0PHdjaGFyX3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9fZW5jb2RpbmcoKSBjb25zdKMIU3N0ZDo6X18yOjpfX2xpYmNwcF9tYnRvd2NfbCh3Y2hhcl90KiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGxvbmcsIF9fbG9jYWxlX3N0cnVjdCoppAgxc3RkOjpfXzI6Ol9fbGliY3BwX21iX2N1cl9tYXhfbChfX2xvY2FsZV9zdHJ1Y3QqKaUIdXN0ZDo6X18yOjpjb2RlY3Z0PHdjaGFyX3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9fbGVuZ3RoKF9fbWJzdGF0ZV90JiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBsb25nKSBjb25zdKYIV3N0ZDo6X18yOjpfX2xpYmNwcF9tYnJsZW5fbChjaGFyIGNvbnN0KiwgdW5zaWduZWQgbG9uZywgX19tYnN0YXRlX3QqLCBfX2xvY2FsZV9zdHJ1Y3QqKacIRHN0ZDo6X18yOjpjb2RlY3Z0PHdjaGFyX3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9fbWF4X2xlbmd0aCgpIGNvbnN0qAiUAXN0ZDo6X18yOjpjb2RlY3Z0PGNoYXIxNl90LCBjaGFyLCBfX21ic3RhdGVfdD46OmRvX291dChfX21ic3RhdGVfdCYsIGNoYXIxNl90IGNvbnN0KiwgY2hhcjE2X3QgY29uc3QqLCBjaGFyMTZfdCBjb25zdComLCBjaGFyKiwgY2hhciosIGNoYXIqJikgY29uc3SpCLUBc3RkOjpfXzI6OnV0ZjE2X3RvX3V0ZjgodW5zaWduZWQgc2hvcnQgY29uc3QqLCB1bnNpZ25lZCBzaG9ydCBjb25zdCosIHVuc2lnbmVkIHNob3J0IGNvbnN0KiYsIHVuc2lnbmVkIGNoYXIqLCB1bnNpZ25lZCBjaGFyKiwgdW5zaWduZWQgY2hhciomLCB1bnNpZ25lZCBsb25nLCBzdGQ6Ol9fMjo6Y29kZWN2dF9tb2RlKaoIkwFzdGQ6Ol9fMjo6Y29kZWN2dDxjaGFyMTZfdCwgY2hhciwgX19tYnN0YXRlX3Q+Ojpkb19pbihfX21ic3RhdGVfdCYsIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdComLCBjaGFyMTZfdCosIGNoYXIxNl90KiwgY2hhcjE2X3QqJikgY29uc3SrCLUBc3RkOjpfXzI6OnV0ZjhfdG9fdXRmMTYodW5zaWduZWQgY2hhciBjb25zdCosIHVuc2lnbmVkIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBjaGFyIGNvbnN0KiYsIHVuc2lnbmVkIHNob3J0KiwgdW5zaWduZWQgc2hvcnQqLCB1bnNpZ25lZCBzaG9ydComLCB1bnNpZ25lZCBsb25nLCBzdGQ6Ol9fMjo6Y29kZWN2dF9tb2RlKawIdnN0ZDo6X18yOjpjb2RlY3Z0PGNoYXIxNl90LCBjaGFyLCBfX21ic3RhdGVfdD46OmRvX2xlbmd0aChfX21ic3RhdGVfdCYsIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgbG9uZykgY29uc3StCIABc3RkOjpfXzI6OnV0ZjhfdG9fdXRmMTZfbGVuZ3RoKHVuc2lnbmVkIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgc3RkOjpfXzI6OmNvZGVjdnRfbW9kZSmuCEVzdGQ6Ol9fMjo6Y29kZWN2dDxjaGFyMTZfdCwgY2hhciwgX19tYnN0YXRlX3Q+Ojpkb19tYXhfbGVuZ3RoKCkgY29uc3SvCJQBc3RkOjpfXzI6OmNvZGVjdnQ8Y2hhcjMyX3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9fb3V0KF9fbWJzdGF0ZV90JiwgY2hhcjMyX3QgY29uc3QqLCBjaGFyMzJfdCBjb25zdCosIGNoYXIzMl90IGNvbnN0KiYsIGNoYXIqLCBjaGFyKiwgY2hhciomKSBjb25zdLAIrgFzdGQ6Ol9fMjo6dWNzNF90b191dGY4KHVuc2lnbmVkIGludCBjb25zdCosIHVuc2lnbmVkIGludCBjb25zdCosIHVuc2lnbmVkIGludCBjb25zdComLCB1bnNpZ25lZCBjaGFyKiwgdW5zaWduZWQgY2hhciosIHVuc2lnbmVkIGNoYXIqJiwgdW5zaWduZWQgbG9uZywgc3RkOjpfXzI6OmNvZGVjdnRfbW9kZSmxCJMBc3RkOjpfXzI6OmNvZGVjdnQ8Y2hhcjMyX3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9faW4oX19tYnN0YXRlX3QmLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqJiwgY2hhcjMyX3QqLCBjaGFyMzJfdCosIGNoYXIzMl90KiYpIGNvbnN0sgiuAXN0ZDo6X18yOjp1dGY4X3RvX3VjczQodW5zaWduZWQgY2hhciBjb25zdCosIHVuc2lnbmVkIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBjaGFyIGNvbnN0KiYsIHVuc2lnbmVkIGludCosIHVuc2lnbmVkIGludCosIHVuc2lnbmVkIGludComLCB1bnNpZ25lZCBsb25nLCBzdGQ6Ol9fMjo6Y29kZWN2dF9tb2RlKbMIdnN0ZDo6X18yOjpjb2RlY3Z0PGNoYXIzMl90LCBjaGFyLCBfX21ic3RhdGVfdD46OmRvX2xlbmd0aChfX21ic3RhdGVfdCYsIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgbG9uZykgY29uc3S0CH9zdGQ6Ol9fMjo6dXRmOF90b191Y3M0X2xlbmd0aCh1bnNpZ25lZCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgY2hhciBjb25zdCosIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIHN0ZDo6X18yOjpjb2RlY3Z0X21vZGUptQglc3RkOjpfXzI6Om51bXB1bmN0PGNoYXI+Ojp+bnVtcHVuY3QoKbYIJ3N0ZDo6X18yOjpudW1wdW5jdDxjaGFyPjo6fm51bXB1bmN0KCkuMbcIKHN0ZDo6X18yOjpudW1wdW5jdDx3Y2hhcl90Pjo6fm51bXB1bmN0KCm4CCpzdGQ6Ol9fMjo6bnVtcHVuY3Q8d2NoYXJfdD46On5udW1wdW5jdCgpLjG5CDJzdGQ6Ol9fMjo6bnVtcHVuY3Q8Y2hhcj46OmRvX2RlY2ltYWxfcG9pbnQoKSBjb25zdLoIMnN0ZDo6X18yOjpudW1wdW5jdDxjaGFyPjo6ZG9fdGhvdXNhbmRzX3NlcCgpIGNvbnN0uwgtc3RkOjpfXzI6Om51bXB1bmN0PGNoYXI+Ojpkb19ncm91cGluZygpIGNvbnN0vAgwc3RkOjpfXzI6Om51bXB1bmN0PHdjaGFyX3Q+Ojpkb19ncm91cGluZygpIGNvbnN0vQgtc3RkOjpfXzI6Om51bXB1bmN0PGNoYXI+Ojpkb190cnVlbmFtZSgpIGNvbnN0vggwc3RkOjpfXzI6Om51bXB1bmN0PHdjaGFyX3Q+Ojpkb190cnVlbmFtZSgpIGNvbnN0vwh8c3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6YmFzaWNfc3RyaW5nKHdjaGFyX3QgY29uc3QqKcAILnN0ZDo6X18yOjpudW1wdW5jdDxjaGFyPjo6ZG9fZmFsc2VuYW1lKCkgY29uc3TBCDFzdGQ6Ol9fMjo6bnVtcHVuY3Q8d2NoYXJfdD46OmRvX2ZhbHNlbmFtZSgpIGNvbnN0wghtc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6b3BlcmF0b3I9KGNoYXIgY29uc3QqKcMINXN0ZDo6X18yOjpfX3RpbWVfZ2V0X2Nfc3RvcmFnZTxjaGFyPjo6X193ZWVrcygpIGNvbnN0xAgWc3RkOjpfXzI6OmluaXRfd2Vla3MoKcUIGl9fY3h4X2dsb2JhbF9hcnJheV9kdG9yLjU0xgg4c3RkOjpfXzI6Ol9fdGltZV9nZXRfY19zdG9yYWdlPHdjaGFyX3Q+OjpfX3dlZWtzKCkgY29uc3THCBdzdGQ6Ol9fMjo6aW5pdF93d2Vla3MoKcgIGl9fY3h4X2dsb2JhbF9hcnJheV9kdG9yLjY5yQh5c3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6b3BlcmF0b3I9KHdjaGFyX3QgY29uc3QqKcoINnN0ZDo6X18yOjpfX3RpbWVfZ2V0X2Nfc3RvcmFnZTxjaGFyPjo6X19tb250aHMoKSBjb25zdMsIF3N0ZDo6X18yOjppbml0X21vbnRocygpzAgaX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuODTNCDlzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8d2NoYXJfdD46Ol9fbW9udGhzKCkgY29uc3TOCBhzdGQ6Ol9fMjo6aW5pdF93bW9udGhzKCnPCBtfX2N4eF9nbG9iYWxfYXJyYXlfZHRvci4xMDjQCDVzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8Y2hhcj46Ol9fYW1fcG0oKSBjb25zdNEIFnN0ZDo6X18yOjppbml0X2FtX3BtKCnSCBtfX2N4eF9nbG9iYWxfYXJyYXlfZHRvci4xMzLTCDhzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8d2NoYXJfdD46Ol9fYW1fcG0oKSBjb25zdNQIF3N0ZDo6X18yOjppbml0X3dhbV9wbSgp1QgbX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuMTM11ggxc3RkOjpfXzI6Ol9fdGltZV9nZXRfY19zdG9yYWdlPGNoYXI+OjpfX3goKSBjb25zdNcIGV9fY3h4X2dsb2JhbF9hcnJheV9kdG9yLjHYCDRzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8d2NoYXJfdD46Ol9feCgpIGNvbnN02QgaX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuMzHaCDFzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8Y2hhcj46Ol9fWCgpIGNvbnN02wgaX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuMzPcCDRzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8d2NoYXJfdD46Ol9fWCgpIGNvbnN03QgaX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuMzXeCDFzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8Y2hhcj46Ol9fYygpIGNvbnN03wgaX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuMzfgCDRzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8d2NoYXJfdD46Ol9fYygpIGNvbnN04QgaX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuMzniCDFzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8Y2hhcj46Ol9fcigpIGNvbnN04wgaX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuNDHkCDRzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8d2NoYXJfdD46Ol9fcigpIGNvbnN05QgaX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuNDPmCGlzdGQ6Ol9fMjo6dGltZV9wdXQ8Y2hhciwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6fnRpbWVfcHV0KCnnCGtzdGQ6Ol9fMjo6dGltZV9wdXQ8Y2hhciwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6fnRpbWVfcHV0KCkuMegIeHN0ZDo6X18yOjp2ZWN0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4gPjo6bWF4X3NpemUoKSBjb25zdOkIqwFzdGQ6Ol9fMjo6YWxsb2NhdG9yX3RyYWl0czxzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4gPjo6YWxsb2NhdGUoc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+JiwgdW5zaWduZWQgbG9uZynqCIsBc3RkOjpfXzI6OnZlY3RvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiA+OjpfX2Fubm90YXRlX25ldyh1bnNpZ25lZCBsb25nKSBjb25zdOsIX3N0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPjo6YWxsb2NhdGUodW5zaWduZWQgbG9uZywgdm9pZCBjb25zdCop7Ag/c3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPjo6YWxsb2NhdGUodW5zaWduZWQgbG9uZywgdm9pZCBjb25zdCop7QjIAXN0ZDo6X18yOjphbGxvY2F0b3JfdHJhaXRzPHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiA+OjpkZWFsbG9jYXRlKHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiYsIHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiosIHVuc2lnbmVkIGxvbmcp7gibAXN0ZDo6X18yOjpfX3ZlY3Rvcl9iYXNlPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46Ol9fZGVzdHJ1Y3RfYXRfZW5kKHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiop7wgic3RkOjpfXzI6Ol9fdGltZV9wdXQ6Ol9fdGltZV9wdXQoKfAIiAFzdGQ6Ol9fMjo6dmVjdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46Ol9fcmVjb21tZW5kKHVuc2lnbmVkIGxvbmcpIGNvbnN08QjYAXN0ZDo6X18yOjpfX3NwbGl0X2J1ZmZlcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiY+OjpfX3NwbGl0X2J1ZmZlcih1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4mKfIIkQFzdGQ6Ol9fMjo6X19zcGxpdF9idWZmZXI8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4mPjo6X19jb25zdHJ1Y3RfYXRfZW5kKHVuc2lnbmVkIGxvbmcp8wjzAXN0ZDo6X18yOjp2ZWN0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4gPjo6X19zd2FwX291dF9jaXJjdWxhcl9idWZmZXIoc3RkOjpfXzI6Ol9fc3BsaXRfYnVmZmVyPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+Jj4mKfQIxgNzdGQ6Ol9fMjo6ZW5hYmxlX2lmPCgoc3RkOjpfXzI6OmludGVncmFsX2NvbnN0YW50PGJvb2wsIGZhbHNlPjo6dmFsdWUpIHx8ICghKF9faGFzX2NvbnN0cnVjdDxzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4sIGJvb2wqLCBib29sPjo6dmFsdWUpKSkgJiYgKGlzX3RyaXZpYWxseV9tb3ZlX2NvbnN0cnVjdGlibGU8Ym9vbD46OnZhbHVlKSwgdm9pZD46OnR5cGUgc3RkOjpfXzI6OmFsbG9jYXRvcl90cmFpdHM8c3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46Ol9fY29uc3RydWN0X2JhY2t3YXJkPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kj4oc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+JiwgYm9vbCosIGJvb2wqLCBib29sKiYp9Qh8c3RkOjpfXzI6Ol9fY29tcHJlc3NlZF9wYWlyPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiY+OjpzZWNvbmQoKfYIxgFzdGQ6Ol9fMjo6X19zcGxpdF9idWZmZXI8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4mPjo6X19kZXN0cnVjdF9hdF9lbmQoc3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqKiwgc3RkOjpfXzI6OmludGVncmFsX2NvbnN0YW50PGJvb2wsIGZhbHNlPin3CEBzdGQ6Ol9fMjo6KGFub255bW91cyBuYW1lc3BhY2UpOjpfX2Zha2VfYmluZDo6b3BlcmF0b3IoKSgpIGNvbnN0+AhCc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90Pjo6YWxsb2NhdGUodW5zaWduZWQgbG9uZywgdm9pZCBjb25zdCop+Qhrc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6X19jbGVhcl9hbmRfc2hyaW5rKCn6CHRzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+OjpfX2NsZWFyX2FuZF9zaHJpbmsoKfsIQ2xvbmcgZG91YmxlIHN0ZDo6X18yOjpfX2RvX3N0cnRvZDxsb25nIGRvdWJsZT4oY2hhciBjb25zdCosIGNoYXIqKin8CC1zdGQ6Ol9fMjo6X19zaGFyZWRfY291bnQ6On5fX3NoYXJlZF9jb3VudCgpLjH9CC9zdGQ6Ol9fMjo6X19zaGFyZWRfd2Vha19jb3VudDo6X19yZWxlYXNlX3dlYWsoKf4ISXN0ZDo6X18yOjpfX3NoYXJlZF93ZWFrX2NvdW50OjpfX2dldF9kZWxldGVyKHN0ZDo6dHlwZV9pbmZvIGNvbnN0JikgY29uc3T/CEZzdGQ6Ol9fMjo6X19jYWxsX29uY2UodW5zaWduZWQgbG9uZyB2b2xhdGlsZSYsIHZvaWQqLCB2b2lkICgqKSh2b2lkKikpgAkbb3BlcmF0b3IgbmV3KHVuc2lnbmVkIGxvbmcpgQk9c3RkOjpfXzI6Ol9fbGliY3BwX3JlZnN0cmluZzo6X19saWJjcHBfcmVmc3RyaW5nKGNoYXIgY29uc3QqKYIJB3dtZW1zZXSDCQh3bWVtbW92ZYQJQ3N0ZDo6X18yOjpfX2Jhc2ljX3N0cmluZ19jb21tb248dHJ1ZT46Ol9fdGhyb3dfbGVuZ3RoX2Vycm9yKCkgY29uc3SFCcEBc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6YmFzaWNfc3RyaW5nKHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QmKYYJeXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46Ol9faW5pdChjaGFyIGNvbnN0KiwgdW5zaWduZWQgbG9uZymHCWZzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+Ojp+YmFzaWNfc3RyaW5nKCmICXlzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+Ojphc3NpZ24oY2hhciBjb25zdCosIHVuc2lnbmVkIGxvbmcpiQnTAXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46Ol9fZ3Jvd19ieV9hbmRfcmVwbGFjZSh1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCBjaGFyIGNvbnN0KimKCXJzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpyZXNpemUodW5zaWduZWQgbG9uZywgY2hhcimLCXJzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjphcHBlbmQodW5zaWduZWQgbG9uZywgY2hhcimMCXRzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpfX2VyYXNlX3RvX2VuZCh1bnNpZ25lZCBsb25nKY0JugFzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpfX2dyb3dfYnkodW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZymOCT9zdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj46OmFzc2lnbihjaGFyKiwgdW5zaWduZWQgbG9uZywgY2hhcimPCXlzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjphcHBlbmQoY2hhciBjb25zdCosIHVuc2lnbmVkIGxvbmcpkAlmc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6cHVzaF9iYWNrKGNoYXIpkQlyc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6X19pbml0KHVuc2lnbmVkIGxvbmcsIGNoYXIpkgmFAXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID46Ol9faW5pdCh3Y2hhcl90IGNvbnN0KiwgdW5zaWduZWQgbG9uZymTCYUBc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6YXNzaWduKHdjaGFyX3QgY29uc3QqLCB1bnNpZ25lZCBsb25nKZQJ3wFzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+OjpfX2dyb3dfYnlfYW5kX3JlcGxhY2UodW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgd2NoYXJfdCBjb25zdCoplQnDAXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID46Ol9fZ3Jvd19ieSh1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nKZYJhQFzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+OjphcHBlbmQod2NoYXJfdCBjb25zdCosIHVuc2lnbmVkIGxvbmcplwlyc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6cHVzaF9iYWNrKHdjaGFyX3QpmAl+c3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6X19pbml0KHVuc2lnbmVkIGxvbmcsIHdjaGFyX3QpmQlCc3RkOjpfXzI6Ol9fdmVjdG9yX2Jhc2VfY29tbW9uPHRydWU+OjpfX3Rocm93X2xlbmd0aF9lcnJvcigpIGNvbnN0mgkNYWJvcnRfbWVzc2FnZZsJEl9fY3hhX3B1cmVfdmlydHVhbJwJHHN0ZDo6ZXhjZXB0aW9uOjp3aGF0KCkgY29uc3SdCSBzdGQ6OmxvZ2ljX2Vycm9yOjp+bG9naWNfZXJyb3IoKZ4JM3N0ZDo6X18yOjpfX2xpYmNwcF9yZWZzdHJpbmc6On5fX2xpYmNwcF9yZWZzdHJpbmcoKZ8JInN0ZDo6bG9naWNfZXJyb3I6On5sb2dpY19lcnJvcigpLjGgCSJzdGQ6Omxlbmd0aF9lcnJvcjo6fmxlbmd0aF9lcnJvcigpoQkbc3RkOjpiYWRfY2FzdDo6d2hhdCgpIGNvbnN0oglhX19jeHhhYml2MTo6X19mdW5kYW1lbnRhbF90eXBlX2luZm86OmNhbl9jYXRjaChfX2N4eGFiaXYxOjpfX3NoaW1fdHlwZV9pbmZvIGNvbnN0Kiwgdm9pZComKSBjb25zdKMJPGlzX2VxdWFsKHN0ZDo6dHlwZV9pbmZvIGNvbnN0Kiwgc3RkOjp0eXBlX2luZm8gY29uc3QqLCBib29sKaQJW19fY3h4YWJpdjE6Ol9fY2xhc3NfdHlwZV9pbmZvOjpjYW5fY2F0Y2goX19jeHhhYml2MTo6X19zaGltX3R5cGVfaW5mbyBjb25zdCosIHZvaWQqJikgY29uc3SlCQ5fX2R5bmFtaWNfY2FzdKYJa19fY3h4YWJpdjE6Ol9fY2xhc3NfdHlwZV9pbmZvOjpwcm9jZXNzX2ZvdW5kX2Jhc2VfY2xhc3MoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQqLCBpbnQpIGNvbnN0pwluX19jeHhhYml2MTo6X19jbGFzc190eXBlX2luZm86Omhhc191bmFtYmlndW91c19wdWJsaWNfYmFzZShfX2N4eGFiaXYxOjpfX2R5bmFtaWNfY2FzdF9pbmZvKiwgdm9pZCosIGludCkgY29uc3SoCXFfX2N4eGFiaXYxOjpfX3NpX2NsYXNzX3R5cGVfaW5mbzo6aGFzX3VuYW1iaWd1b3VzX3B1YmxpY19iYXNlKF9fY3h4YWJpdjE6Ol9fZHluYW1pY19jYXN0X2luZm8qLCB2b2lkKiwgaW50KSBjb25zdKkJc19fY3h4YWJpdjE6Ol9fYmFzZV9jbGFzc190eXBlX2luZm86Omhhc191bmFtYmlndW91c19wdWJsaWNfYmFzZShfX2N4eGFiaXYxOjpfX2R5bmFtaWNfY2FzdF9pbmZvKiwgdm9pZCosIGludCkgY29uc3SqCXJfX2N4eGFiaXYxOjpfX3ZtaV9jbGFzc190eXBlX2luZm86Omhhc191bmFtYmlndW91c19wdWJsaWNfYmFzZShfX2N4eGFiaXYxOjpfX2R5bmFtaWNfY2FzdF9pbmZvKiwgdm9pZCosIGludCkgY29uc3SrCVtfX2N4eGFiaXYxOjpfX3BiYXNlX3R5cGVfaW5mbzo6Y2FuX2NhdGNoKF9fY3h4YWJpdjE6Ol9fc2hpbV90eXBlX2luZm8gY29uc3QqLCB2b2lkKiYpIGNvbnN0rAldX19jeHhhYml2MTo6X19wb2ludGVyX3R5cGVfaW5mbzo6Y2FuX2NhdGNoKF9fY3h4YWJpdjE6Ol9fc2hpbV90eXBlX2luZm8gY29uc3QqLCB2b2lkKiYpIGNvbnN0rQlcX19jeHhhYml2MTo6X19wb2ludGVyX3R5cGVfaW5mbzo6Y2FuX2NhdGNoX25lc3RlZChfX2N4eGFiaXYxOjpfX3NoaW1fdHlwZV9pbmZvIGNvbnN0KikgY29uc3SuCWZfX2N4eGFiaXYxOjpfX3BvaW50ZXJfdG9fbWVtYmVyX3R5cGVfaW5mbzo6Y2FuX2NhdGNoX25lc3RlZChfX2N4eGFiaXYxOjpfX3NoaW1fdHlwZV9pbmZvIGNvbnN0KikgY29uc3SvCYMBX19jeHhhYml2MTo6X19jbGFzc190eXBlX2luZm86OnByb2Nlc3Nfc3RhdGljX3R5cGVfYWJvdmVfZHN0KF9fY3h4YWJpdjE6Ol9fZHluYW1pY19jYXN0X2luZm8qLCB2b2lkIGNvbnN0Kiwgdm9pZCBjb25zdCosIGludCkgY29uc3SwCXNfX2N4eGFiaXYxOjpfX3ZtaV9jbGFzc190eXBlX2luZm86OnNlYXJjaF9iZWxvd19kc3QoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQgY29uc3QqLCBpbnQsIGJvb2wpIGNvbnN0sQmBAV9fY3h4YWJpdjE6Ol9fYmFzZV9jbGFzc190eXBlX2luZm86OnNlYXJjaF9hYm92ZV9kc3QoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQgY29uc3QqLCB2b2lkIGNvbnN0KiwgaW50LCBib29sKSBjb25zdLIJdF9fY3h4YWJpdjE6Ol9fYmFzZV9jbGFzc190eXBlX2luZm86OnNlYXJjaF9iZWxvd19kc3QoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQgY29uc3QqLCBpbnQsIGJvb2wpIGNvbnN0swlyX19jeHhhYml2MTo6X19zaV9jbGFzc190eXBlX2luZm86OnNlYXJjaF9iZWxvd19kc3QoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQgY29uc3QqLCBpbnQsIGJvb2wpIGNvbnN0tAlvX19jeHhhYml2MTo6X19jbGFzc190eXBlX2luZm86OnNlYXJjaF9iZWxvd19kc3QoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQgY29uc3QqLCBpbnQsIGJvb2wpIGNvbnN0tQmAAV9fY3h4YWJpdjE6Ol9fdm1pX2NsYXNzX3R5cGVfaW5mbzo6c2VhcmNoX2Fib3ZlX2RzdChfX2N4eGFiaXYxOjpfX2R5bmFtaWNfY2FzdF9pbmZvKiwgdm9pZCBjb25zdCosIHZvaWQgY29uc3QqLCBpbnQsIGJvb2wpIGNvbnN0tgl/X19jeHhhYml2MTo6X19zaV9jbGFzc190eXBlX2luZm86OnNlYXJjaF9hYm92ZV9kc3QoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQgY29uc3QqLCB2b2lkIGNvbnN0KiwgaW50LCBib29sKSBjb25zdLcJfF9fY3h4YWJpdjE6Ol9fY2xhc3NfdHlwZV9pbmZvOjpzZWFyY2hfYWJvdmVfZHN0KF9fY3h4YWJpdjE6Ol9fZHluYW1pY19jYXN0X2luZm8qLCB2b2lkIGNvbnN0Kiwgdm9pZCBjb25zdCosIGludCwgYm9vbCkgY29uc3S4CQhfX3N0cmR1cLkJDV9fZ2V0VHlwZU5hbWW6CSpfX2VtYmluZF9yZWdpc3Rlcl9uYXRpdmVfYW5kX2J1aWx0aW5fdHlwZXO7CT92b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfaW50ZWdlcjxjaGFyPihjaGFyIGNvbnN0Kim8CUZ2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfaW50ZWdlcjxzaWduZWQgY2hhcj4oY2hhciBjb25zdCopvQlIdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX2ludGVnZXI8dW5zaWduZWQgY2hhcj4oY2hhciBjb25zdCopvglAdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX2ludGVnZXI8c2hvcnQ+KGNoYXIgY29uc3QqKb8JSXZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9pbnRlZ2VyPHVuc2lnbmVkIHNob3J0PihjaGFyIGNvbnN0KinACT52b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfaW50ZWdlcjxpbnQ+KGNoYXIgY29uc3QqKcEJR3ZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9pbnRlZ2VyPHVuc2lnbmVkIGludD4oY2hhciBjb25zdCopwgk/dm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX2ludGVnZXI8bG9uZz4oY2hhciBjb25zdCopwwlIdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX2ludGVnZXI8dW5zaWduZWQgbG9uZz4oY2hhciBjb25zdCopxAk+dm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX2Zsb2F0PGZsb2F0PihjaGFyIGNvbnN0KinFCT92b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfZmxvYXQ8ZG91YmxlPihjaGFyIGNvbnN0KinGCUN2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfbWVtb3J5X3ZpZXc8Y2hhcj4oY2hhciBjb25zdCopxwlKdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX21lbW9yeV92aWV3PHNpZ25lZCBjaGFyPihjaGFyIGNvbnN0KinICUx2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfbWVtb3J5X3ZpZXc8dW5zaWduZWQgY2hhcj4oY2hhciBjb25zdCopyQlEdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX21lbW9yeV92aWV3PHNob3J0PihjaGFyIGNvbnN0KinKCU12b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfbWVtb3J5X3ZpZXc8dW5zaWduZWQgc2hvcnQ+KGNoYXIgY29uc3QqKcsJQnZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9tZW1vcnlfdmlldzxpbnQ+KGNoYXIgY29uc3QqKcwJS3ZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9tZW1vcnlfdmlldzx1bnNpZ25lZCBpbnQ+KGNoYXIgY29uc3QqKc0JQ3ZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9tZW1vcnlfdmlldzxsb25nPihjaGFyIGNvbnN0KinOCUx2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfbWVtb3J5X3ZpZXc8dW5zaWduZWQgbG9uZz4oY2hhciBjb25zdCopzwlEdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX21lbW9yeV92aWV3PGZsb2F0PihjaGFyIGNvbnN0KinQCUV2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfbWVtb3J5X3ZpZXc8ZG91YmxlPihjaGFyIGNvbnN0KinRCW5FbXNjcmlwdGVuQmluZGluZ0luaXRpYWxpemVyX25hdGl2ZV9hbmRfYnVpbHRpbl90eXBlczo6RW1zY3JpcHRlbkJpbmRpbmdJbml0aWFsaXplcl9uYXRpdmVfYW5kX2J1aWx0aW5fdHlwZXMoKdIJCGRsbWFsbG9j0wkGZGxmcmVl1AkJZGxyZWFsbG9j1QkRdHJ5X3JlYWxsb2NfY2h1bmvWCQ1kaXNwb3NlX2NodW5r1wkEc2Jya9gJBGZtb2TZCQVmbW9kbNoJBWxvZzEw2wkGbG9nMTBm3AkGc2NhbGJu3QkNX19mcGNsYXNzaWZ5bN4JBm1lbWNwed8JBm1lbXNldOAJB21lbW1vdmXhCQhzZXRUaHJld+IJCXN0YWNrU2F2ZeMJCnN0YWNrQWxsb2PkCQxzdGFja1Jlc3RvcmXlCRBfX2dyb3dXYXNtTWVtb3J55gkLZHluQ2FsbF92aWnnCQ1keW5DYWxsX3ZpaWlp6AkLZHluQ2FsbF9kaWTpCQxkeW5DYWxsX2RpaWTqCQ1keW5DYWxsX2RpZGRk6wkOZHluQ2FsbF9kaWlkZGTsCQxkeW5DYWxsX2RpZGTtCQ1keW5DYWxsX2RpaWRk7gkLZHluQ2FsbF9kaWnvCQtkeW5DYWxsX3ZpZPAJDGR5bkNhbGxfdmlpZPEJDGR5bkNhbGxfZGlpafIJDWR5bkNhbGxfZGlpaWnzCQ1keW5DYWxsX3ZpaWlk9AkNZHluQ2FsbF9kaWRpZPUJDmR5bkNhbGxfZGlpZGlk9gkOZHluQ2FsbF9kaWRpZGn3CQ9keW5DYWxsX2RpaWRpZGn4CQ1keW5DYWxsX3ZpZGlk+QkOZHluQ2FsbF92aWlkaWT6CQ5keW5DYWxsX3ZpZGlkZPsJD2R5bkNhbGxfdmlpZGlkZPwJD2R5bkNhbGxfdmlkaWRkZP0JEGR5bkNhbGxfdmlpZGlkZGT+CQ1keW5DYWxsX3ZpZGRk/wkOZHluQ2FsbF92aWlkZGSACg1keW5DYWxsX2lpaWlkgQoMZHluQ2FsbF92aWRkggoNZHluQ2FsbF92aWlkZIMKDWR5bkNhbGxfaWlpaWmECg5keW5DYWxsX3ZpZmZpaYUKD2R5bkNhbGxfdmlpZmZpaYYKD2R5bkNhbGxfZGlkZGRkZIcKD2R5bkNhbGxfZGlkZGlkZIgKEGR5bkNhbGxfZGlpZGRpZGSJChBkeW5DYWxsX2RpaWRkZGRkigoPZHluQ2FsbF9kaWRkZGlpiwoQZHluQ2FsbF9kaWlkZGRpaYwKEWR5bkNhbGxfZGlkZGRkZGlpjQoSZHluQ2FsbF9kaWlkZGRkZGlpjgoMZHluQ2FsbF9kaWRpjwoNZHluQ2FsbF9kaWlkaZAKD2R5bkNhbGxfZGlkaWRkZJEKEGR5bkNhbGxfZGlpZGlkZGSSCg1keW5DYWxsX2RpZGRpkwoOZHluQ2FsbF9kaWlkZGmUCgxkeW5DYWxsX3ZpZGmVCg1keW5DYWxsX3ZpaWRplgoOZHluQ2FsbF92aWlpaWmXCgxkeW5DYWxsX2lpZmmYCg1keW5DYWxsX2lpaWZpmQoKZHluQ2FsbF9maZoKC2R5bkNhbGxfZmlpmwoNZHluQ2FsbF9maWlpaZwKDmR5bkNhbGxfZmlpaWlpnQoPZHluQ2FsbF92aWlpaWRkngoQZHluQ2FsbF92aWlpaWlkZJ8KDGR5bkNhbGxfdmlpZqAKDWR5bkNhbGxfdmlpaWahCg1keW5DYWxsX2lpaWlmogoOZHluQ2FsbF9kaWRkaWSjCg9keW5DYWxsX2RpaWRkaWSkCg9keW5DYWxsX2RpZGRkaWSlChBkeW5DYWxsX2RpaWRkZGlkpgoOZHluQ2FsbF9kaWRkZGmnCg9keW5DYWxsX2RpaWRkZGmoCgtkeW5DYWxsX2lpZKkKDWR5bkNhbGxfZGlkaWmqCg5keW5DYWxsX2RpaWRpaasKD2R5bkNhbGxfaWlkaWlpaawKDmR5bkNhbGxfaWlpaWlprQoRZHluQ2FsbF9paWlpaWlpaWmuCg9keW5DYWxsX2lpaWlpaWmvCg5keW5DYWxsX2lpaWlpZLAKEGR5bkNhbGxfaWlpaWlpaWmxCg9keW5DYWxsX3ZpaWlpaWmyCglkeW5DYWxsX3azChhsZWdhbHN0dWIkZHluQ2FsbF92aWlqaWm0ChZsZWdhbHN0dWIkZHluQ2FsbF9qaWpptQoYbGVnYWxzdHViJGR5bkNhbGxfaWlpaWlqtgoZbGVnYWxzdHViJGR5bkNhbGxfaWlpaWlqarcKGmxlZ2Fsc3R1YiRkeW5DYWxsX2lpaWlpaWpqAHUQc291cmNlTWFwcGluZ1VSTGNodHRwOi8vbG9jYWxob3N0OjkwMDAvYXVkaW8td29ya2xldC9idWlsZC97e3sgRklMRU5BTUVfUkVQTEFDRU1FTlRfU1RSSU5HU19XQVNNX0JJTkFSWV9GSUxFIH19fS5tYXA=';
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




// STATICTOP = STATIC_BASE + 53424;
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
      return 54288;
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
var dynCall_viddd = Module["dynCall_viddd"] = asm["dynCall_viddd"];
var dynCall_viiddd = Module["dynCall_viiddd"] = asm["dynCall_viiddd"];
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


