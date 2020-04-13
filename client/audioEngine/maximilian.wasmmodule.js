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
  'initial': 967,
  'maximum': 967 + 0,
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
    STACK_BASE = 5297024,
    STACKTOP = STACK_BASE,
    STACK_MAX = 54144,
    DYNAMIC_BASE = 5297024,
    DYNAMICTOP_PTR = 53984;




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




var wasmBinaryFile = 'data:application/octet-stream;base64,AGFzbQEAAAAB/AqkAWABfwF/YAF/AGACf38AYAJ/fwF/YAN/f38Bf2ADf39/AGAFf39/f38Bf2AAAGAEf39/fwF/YAZ/f39/f38Bf2AFf39/f38AYAR/f39/AGAAAX9gBn9/f39/fwBgCH9/f39/f39/AX9gAn98AGABfwF8YAJ/fAF8YAN/fHwBfGACfHwBfGAHf39/f39/fwF/YAF8AXxgBH98fHwBfGAHf39/f39/fwBgAn9/AXxgBH9/f3wAYAN/f3wAYAV/fn5+fgBgA39+fwF+YAF9AX1gA39/fwF8YAR/fHx/AXxgBn98fHx8fAF8YAp/f39/f39/f39/AGADf3x/AGAFf39/f34Bf2ADf3x/AXxgBXx8fHx8AXxgBX9/fn9/AGAFf39/f3wBf2AEf39/fwF+YAF/AX1gAn9/AX1gBH9/fH8BfGAFf398fH8BfGAGf3x/fHx8AXxgBX98fH98AXxgBX98fHx/AXxgA3x8fAF8YAh/f39/f39/fwBgB39/f39/fHwAYAZ/f39/fHwAYAR/f399AGAGf399fX9/AGAEf398fwBgBX9/fH98AGAGf398f3x8AGAHf398f3x8fABgBH9/fHwAYAV/f3x8fABgBH9+fn8AYAV/fX1/fwBgBH98f3wAYAV/fH98fABgBn98f3x8fABgA398fABgBH98fHwAYAp/f39/f39/f39/AX9gB39/f39/fn4Bf2AGf39/f35+AX9gBH9/f3wBf2AEf399fwF/YAN/fX8Bf2AGf3x/f39/AX9gBH9/f38BfWAFf39/f38BfWAEf39/fwF8YAN/f3wBfGAFf398f38BfGAFf398f3wBfGAGf398f3x/AXxgB39/fH98fHwBfGAEf398fAF8YAZ/f3x8f3wBfGAHf398fH98fAF8YAV/f3x8fAF8YAZ/f3x8fH8BfGAHf398fHx/fwF8YAd/f3x8fH98AXxgB39/fHx8fHwBfGAJf398fHx8fH9/AXxgBH98f38BfGAEf3x/fAF8YAV/fH98fwF8YAZ/fHx/fHwBfGAGf3x8fH9/AXxgBn98fHx/fAF8YAh/fHx8fHx/fwF8YA9/f39/f39/f39/f39/f38AYAN/f30AYAJ/fgBgCX9/f39/f39/fwF/YAt/f39/f39/f39/fwF/YAx/f39/f39/f39/f38Bf2AEf39/fQF/YAN/fn8Bf2ACf3wBf2ACfn8Bf2ACfn4Bf2ABfAF/YAF/AX5gBH9/f34BfmADf39/AX1gAn1/AX1gAXwBfWACfH8BfGADfHx/AXxgDH9/f39/f39/f39/fwBgDX9/f39/f39/f39/f38AYAh/f39/f398fABgBX9/f399AGAFf39/f3wAYAd/f399fX9/AGAFf39/fH8AYAZ/f398f3wAYAd/f398f3x8AGAIf39/fH98fHwAYAV/f398fABgBn9/f3x8fABgA39/fgBgBn9/fHx8fwBgA39+fgBgAn99AGAGf39/f398AX9gBX9/f399AX9gBX9/f31/AX9gA39/fAF/YAd/f3x/f39/AX9gA35/fwF/YAR+fn5+AX9gAn1/AX9gAnx/AX9gAn9/AX5gBn9/f39/fwF9YAJ+fgF9YAJ9fQF9YAV/f39/fwF8YAR/f398AXxgBX9/f3x/AXxgBn9/f3x/fwF8YAZ/f398f3wBfGAHf39/fH98fwF8YAh/f398f3x8fAF8YAV/f398fAF8YAZ/f398fH8BfGAHf39/fHx/fAF8YAh/f398fH98fAF8YAZ/f398fHwBfGAHf39/fHx8fwF8YAh/f398fHx/fwF8YAh/f398fHx/fAF8YAh/f398fHx8fAF8YAp/f398fHx8fH9/AXxgAn5+AXwClgktA2VudhZfZW1iaW5kX3JlZ2lzdGVyX2NsYXNzAHYDZW52Il9lbWJpbmRfcmVnaXN0ZXJfY2xhc3NfY29uc3RydWN0b3IADQNlbnYlX2VtYmluZF9yZWdpc3Rlcl9jbGFzc19jbGFzc19mdW5jdGlvbgAXA2Vudh9fZW1iaW5kX3JlZ2lzdGVyX2NsYXNzX3Byb3BlcnR5ACEDZW52H19lbWJpbmRfcmVnaXN0ZXJfY2xhc3NfZnVuY3Rpb24AMQNlbnYVX2VtYmluZF9yZWdpc3Rlcl9lbnVtAAsDZW52G19lbWJpbmRfcmVnaXN0ZXJfZW51bV92YWx1ZQAFA2VudhpfZW1iaW5kX3JlZ2lzdGVyX3NtYXJ0X3B0cgB1A2VudhhfX2N4YV9hbGxvY2F0ZV9leGNlcHRpb24AAANlbnYLX19jeGFfdGhyb3cABQNlbnYRX2VtdmFsX3Rha2VfdmFsdWUAAwNlbnYNX2VtdmFsX2luY3JlZgABA2Vudg1fZW12YWxfZGVjcmVmAAEDZW52C19lbXZhbF9jYWxsAAgDZW52BXJvdW5kABUDZW52BGV4aXQAAQNlbnYNX19hc3NlcnRfZmFpbAALA2VudgZfX2xvY2sAAQNlbnYIX191bmxvY2sAARZ3YXNpX3NuYXBzaG90X3ByZXZpZXcxCGZkX2Nsb3NlAAADZW52Cl9fc3lzY2FsbDUAAwNlbnYMX19zeXNjYWxsMjIxAAMDZW52C19fc3lzY2FsbDU0AAMWd2FzaV9zbmFwc2hvdF9wcmV2aWV3MQdmZF9yZWFkAAgWd2FzaV9zbmFwc2hvdF9wcmV2aWV3MQhmZF93cml0ZQAIFndhc2lfc25hcHNob3RfcHJldmlldzERZW52aXJvbl9zaXplc19nZXQAAxZ3YXNpX3NuYXBzaG90X3ByZXZpZXcxC2Vudmlyb25fZ2V0AAMDZW52Cl9fbWFwX2ZpbGUAAwNlbnYLX19zeXNjYWxsOTEAAwNlbnYKc3RyZnRpbWVfbAAGA2VudgVhYm9ydAAHA2VudhVfZW1iaW5kX3JlZ2lzdGVyX3ZvaWQAAgNlbnYVX2VtYmluZF9yZWdpc3Rlcl9ib29sAAoDZW52G19lbWJpbmRfcmVnaXN0ZXJfc3RkX3N0cmluZwACA2VudhxfZW1iaW5kX3JlZ2lzdGVyX3N0ZF93c3RyaW5nAAUDZW52Fl9lbWJpbmRfcmVnaXN0ZXJfZW12YWwAAgNlbnYYX2VtYmluZF9yZWdpc3Rlcl9pbnRlZ2VyAAoDZW52Fl9lbWJpbmRfcmVnaXN0ZXJfZmxvYXQABQNlbnYcX2VtYmluZF9yZWdpc3Rlcl9tZW1vcnlfdmlldwAFA2VudhZlbXNjcmlwdGVuX3Jlc2l6ZV9oZWFwAAADZW52FWVtc2NyaXB0ZW5fbWVtY3B5X2JpZwAEA2VudgtzZXRUZW1wUmV0MAABFndhc2lfc25hcHNob3RfcHJldmlldzEHZmRfc2VlawAGA2VudgZtZW1vcnkCAIAQA2VudgV0YWJsZQFwAMcHA6YKgAoHBwcHBwcHAAEADAIBAAsFAAIDBQACAAIADE1VUhgaAAxMGRAPAAIADE9QAAwQDxAPAAw3ODkADBFCOw8AAEYZFjAADEE6DxAQDxAPDwABDAALCAIBNQgAJSAlJTAWIAAMVFkADFda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DmR5bkNhbGxfZGlpZGlkAOgJDmR5bkNhbGxfZGlkaWRpAOkJD2R5bkNhbGxfZGlpZGlkaQDqCQ1keW5DYWxsX3ZpZGlkAOsJDmR5bkNhbGxfdmlpZGlkAOwJDmR5bkNhbGxfdmlkaWRkAO0JD2R5bkNhbGxfdmlpZGlkZADuCQ9keW5DYWxsX3ZpZGlkZGQA7wkQZHluQ2FsbF92aWlkaWRkZADwCQ1keW5DYWxsX3ZpZGRkAPEJDmR5bkNhbGxfdmlpZGRkAPIJDWR5bkNhbGxfaWlpaWQA8wkMZHluQ2FsbF9kZGRkAGsMZHluQ2FsbF92aWRkAPQJDWR5bkNhbGxfdmlpZGQA9QkMZHluQ2FsbF9paWlpAMgCDWR5bkNhbGxfaWlpaWkA9gkOZHluQ2FsbF92aWZmaWkA9wkPZHluQ2FsbF92aWlmZmlpAPgJDmR5bkNhbGxfZGRkZGRkAIkBD2R5bkNhbGxfZGlkZGRkZAD5CQ9keW5DYWxsX2RpZGRpZGQA+gkQZHluQ2FsbF9kaWlkZGlkZAD7CRBkeW5DYWxsX2RpaWRkZGRkAPwJD2R5bkNhbGxfZGlkZGRpaQD9CRBkeW5DYWxsX2RpaWRkZGlpAP4JEWR5bkNhbGxfZGlkZGRkZGlpAP8JEmR5bkNhbGxfZGlpZGRkZGRpaQCACgxkeW5DYWxsX2RpZGkAgQoNZHluQ2FsbF9kaWlkaQCCCgpkeW5DYWxsX2RkAJoBD2R5bkNhbGxfZGlkaWRkZACDChBkeW5DYWxsX2RpaWRpZGRkAIQKC2R5bkNhbGxfZGRkALIBDWR5bkNhbGxfZGlkZGkAhQoOZHluQ2FsbF9kaWlkZGkAhgoMZHluQ2FsbF92aWRpAIcKDWR5bkNhbGxfdmlpZGkAiAoOZHluQ2FsbF92aWlpaWkAiQoMZHluQ2FsbF9paWZpAIoKDWR5bkNhbGxfaWlpZmkAiwoKZHluQ2FsbF9maQCMCgtkeW5DYWxsX2ZpaQCNCg1keW5DYWxsX2ZpaWlpAI4KDmR5bkNhbGxfZmlpaWlpAI8KD2R5bkNhbGxfdmlpaWlkZACQChBkeW5DYWxsX3ZpaWlpaWRkAJEKDGR5bkNhbGxfdmlpZgCSCg1keW5DYWxsX3ZpaWlmAJMKDWR5bkNhbGxfaWlpaWYAlAoOZHluQ2FsbF9kaWRk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CwkAIAEgABEBAAsMACAAIAAoAgA2AgQLBQBBtCYLDQAgASACIAMgABEFAAsdAEGIhAIgATYCAEGEhAIgADYCAEGMhAIgAjYCAAsJAEGEhAIoAgALCwBBhIQCIAE2AgALNQEBfyABIAAoAgQiAkEBdWohASAAKAIAIQAgASACQQFxBH8gASgCACAAaigCAAUgAAsRAAALNwEBfyABIAAoAgQiA0EBdWohASAAKAIAIQAgASACIANBAXEEfyABKAIAIABqKAIABSAACxECAAsJAEGIhAIoAgALCwBBiIQCIAE2AgALCQBBjIQCKAIACwsAQYyEAiABNgIACwUAQawnCxIBAX9BMBDzCCIAQgA3AwggAAs3AQF/IAEgACgCBCIDQQF1aiEBIAAoAgAhACABIAIgA0EBcQR/IAEoAgAgAGooAgAFIAALEREACzsBAX8gASAAKAIEIgVBAXVqIQEgACgCACEAIAEgAiADIAQgBUEBcQR/IAEoAgAgAGooAgAFIAALERYACzkBAX8gASAAKAIEIgRBAXVqIQEgACgCACEAIAEgAiADIARBAXEEfyABKAIAIABqKAIABSAACxESAAs1AQF/IAEgACgCBCICQQF1aiEBIAAoAgAhACABIAJBAXEEfyABKAIAIABqKAIABSAACxEQAAs3AQF/IAEgACgCBCIDQQF1aiEBIAAoAgAhACABIAIgA0EBcQR/IAEoAgAgAGooAgAFIAALEQ8ACwUAQfAoCzwBAX9BOBDzCCIAQgA3AwAgAEIANwMwIABCADcDKCAAQgA3AyAgAEIANwMYIABCADcDECAAQgA3AwggAAs5AQF/IAEgACgCBCIEQQF1aiEBIAAoAgAhACABIAIgAyAEQQFxBH8gASgCACAAaigCAAUgAAsRHgALOQEBfyABIAAoAgQiBEEBdWohASAAKAIAIQAgASACIAMgBEEBcQR/IAEoAgAgAGooAgAFIAALERoACwcAIAArAzALCQAgACABOQMwCwcAIAAoAiwLCQAgACABNgIsCwUAQYAqCwwAQeiIKxDzCBCZAws7AQF/IAEgACgCBCIFQQF1aiEBIAAoAgAhACABIAIgAyAEIAVBAXEEfyABKAIAIABqKAIABSAACxFcAAs9AQF/IAEgACgCBCIGQQF1aiEBIAAoAgAhACABIAIgAyAEIAUgBkEBcQR/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PzcDSCAAQQA2AgggAEIANwMwQYSEAigCACEBIABBADYCdCAAQQE6AIABIABCgICAgICAgPg/NwN4IABCADcCbCAAIAE2AmQgAAsQACAAKAJwIAAoAmxrQQN1CzkBAX8gASAAKAIEIgRBAXVqIQEgACgCACEAIAEgAiADIARBAXEEfyABKAIAIABqKAIABSAACxEFAAs5AQF/IAEgACgCBCIEQQF1aiEBIAAoAgAhACABIAIgAyAEQQFxBH8gASgCACAAaigCAAUgAAsRBAALNQEBfyABIAAoAgQiAkEBdWohASAAKAIAIQAgASACQQFxBH8gASgCACAAaigCAAUgAAsRAQALDAAgACAAKAJsNgJwCz0BAX8gASAAKAIEIgZBAXVqIQEgACgCACEAIAEgAiADIAQgBSAGQQFxBH8gASgCACAAaigCAAUgAAsRPQAL5QEBBH8jAEEQayIEJAAgASAAKAIEIgZBAXVqIQcgACgCACEFIAZBAXEEQCAHKAIAIAVqKAIAIQULIAIoAgAhACAEQQA2AgggBEIANwMAIABBcEkEQAJAAkAgAEELTwRAIABBEGpBcHEiBhDzCCEBIAQgBkGAgICAeHI2AgggBCABNgIAIAQgADYCBAwBCyAEIAA6AAsgBCEBIABFDQELIAEgAkEEaiAAENEJGgsgACABakEAOgAAIAcgBCADIAURBAAhACAELAALQX9MBEAgBCgCABDGCQsgBEEQaiQAIAAPCxD3CAALBQBBvDQLKAAgASACIAAgAiAAYxsiACAAIAFjGyABoSACIAGhoyAEIAOhoiADoAsUACABIAIgAyAEIAUgACgCABElAAsqACAEIAOjIAEgAiAAIAIgAGMbIgAgACABYxsgAaEgAiABoaMQ4gQgA6ILLgAgASACIAAgAiAAYxsiACAAIAFjGyABoxDgBCACIAGjEOAEoyAEIAOhoiADoAseAAJAIAAgAmQNACAAIgIgAWNBAXMNACABIQILIAILEAAgASACIAMgACgCABEwAAsRACABIAIgAyAEIAUgABElAAsFAEGsNQsQAEHYABDzCEEAQdgAENIJCz8BAX8gASAAKAIEIgdBAXVqIQEgACgCACEAIAEgAiADIAQgBSAGIAdBAXEEfyABKAIAIABqKAIABSAACxFeAAs/AQF/IAEgACgCBCIHQQF1aiEBIAAo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aigCACEACyAEIAM5AwggASACIARBCGogABEFACAEQRBqJAALEAAgACgCBCAAKAIAa0EDdQtRAQJ/IwBBEGsiAyQAQQEhBCAAIAEoAgQgASgCACIBa0EDdSACSwR/IAMgASACQQN0aikDADcDCEHw9AEgA0EIahAKBUEBCzYCACADQRBqJAALFwAgACgCACABQQN0aiACKQMANwMAQQELNAEBfyMAQRBrIgQkACAAKAIAIQAgBCADOQMIIAEgAiAEQQhqIAARBAAhACAEQRBqJAAgAAsFAEHAHgvEAQEFfyAAKAIEIgIgACgCCCIDRwRAIAIgAS0AADoAACAAIAAoAgRBAWo2AgQPCyACIAAoAgAiAmsiBUEBaiIEQX9KBEAgBQJ/QQAgBCADIAJrIgNBAXQiBiAGIARJG0H/////ByADQf////8DSRsiA0UNABogAxDzCAsiBGoiBiABLQAAOgAAIAVBAU4EQCAEIAIgBRDRCRoLIAAgAyAEajYCCCAAIAZBAWo2AgQgACAENgIAIAIEQCACEMYJCw8LEIwJAAtSAQJ/IwBBEGsiAyQAIAEgACgCBCIEQQF1aiEBIAAoAgAhACAEQQFxBEAgASgCACAAaigCACEACyADIAI6AA8gASADQQ9qIAARAgAgA0EQaiQACzgBAn8gACgCBCAAKAIAIgRrIgMgAUkEQCAAIAEgA2sgAhDxAg8LIAMgAUsEQCAAIAEgBGo2AgQLC1QBAn8jAEEQayIEJAAgASAAKAIEIgVBAXVqIQEgACgCACEAIAVBAXEEQCABKAIAIABqKAIAIQALIAQgAzoADyABIAIgBEEPaiAAEQUAIARBEGokAAsNACAAKAIEIAAoAgBrC0sBAn8jAEEQayIDJABBASEEIAAgASgCBCABKAIAIgFrIAJLBH8gAyABIAJqLAAANgIIQfjzASADQQhqEAoFQQELNgIAIANBEGokAAsUACAAKAIAIAFqIAItAAA6AABBAQs0AQF/IwBBEGsiBCQAIAAoAgAhACAEIAM6AA8gASACIARBD2ogABEEACEAIARBEGokACAACwUAQYghC0sBAn8jAEEQayIDJABBASEEIAAgASgCBCABKAIAIgFrIAJLBH8gAyABIAJqLQAANgIIQYT0ASADQQhqEAoFQQELNgIAIANBEGokAAsFAEHIIwtSAQJ/IwBB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QQpGDQAgACADQQFqNgIUIANBCjoAAAwBCyAAIAFBD2pBASAAKAIkEQQAQQFHDQAgAS0ADxoLIAFBEGokAAt+AQJ/IAAEQCAAKAJMQX9MBEAgABDJBA8LIAAQyQQPC0GQ7wIoAgAEQEGQ7wIoAgAQyAQhAQsQrAQoAgAiAARAA0AgACgCTEEATgR/QQEFQQALGiAAKAIUIAAoAhxLBEAgABDJBCABciEBCyAAKAI4IgANAAsLQZT5AhASIAELaQECfwJAIAAoAhQgACgCHE0NACAAQQBBACAAKAIkEQQAGiAAKAIUDQBBfw8LIAAoAgQiASAAKAIIIgJJBEAgACABIAJrrEEBIAAoAigRHAAaCyAAQQA2AhwgAEIANwMQIABCADcCBEEAC0EBAn8jAEEQayIBJABBfyECAkAgABCzBA0AIAAgAUEPakEBIAAoAiARBABBAUcNACABLQAPIQILIAFBEGokACACCzEBAn8gABCsBCIBKAIANgI4IAEoAgAiAgRAIAIgADYCNAsgASAANgIAQZT5AhASIAALUAEBfgJAIANBwABxBEAgAiADQUBqrYghAUIAIQIMAQsgA0UNACACQcAAIANrrYYgASADrSIEiIQhASACIASIIQILIAAgATcDACAAIAI3AwgLUAEBfgJAIANBwABxBEAgASADQUBqrYYhAkIAIQEMAQsgA0UNACACIAOtIgSGIAFBwAAgA2utiIQhAiABIASGIQELIAAgATcDACAAIAI3AwgL2QMCAn8CfiMAQSBrIgIkAAJAIAFC////////////AIMiBUKAgICAgIDA/0N8IAVCgICAgICAwIC8f3xUBEAgAUIEhiAAQjyIhCEEIABC//////////8PgyIAQoGAgICAgICACFoEQCAEQoGAgICAgICAwAB8IQQMAgsgBEKAgICAgICAgEB9IQQgAEKAgICAgICAgAiFQgBSDQEgBEIBgyAEfCEEDAELIABQIAVCgICAgICAwP//AFQgBUKAgICAgIDA//8AURtFBEAgAUIEhiAAQjyIhEL/////////A4NCgICAgICAgPz/AIQhBAwBC0KAgICAgICA+P8AIQQgBUL///////+//8MAVg0AQgAhBCAFQjCIpyIDQZH3AEkNACACIAAgAUL///////8/g0KAgICAgIDAAIQiBEGB+AAgA2sQzAQg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BX8PfiMAQeAAayIFJAAgBEIvhiADQhGIhCEPIAJCIIYgAUIgiIQhDSAEQv///////z+DIg5CD4YgA0IxiIQhECACIASFQoCAgICAgICAgH+DIQogDkIRiCERIAJC////////P4MiC0IgiCESIARCMIinQf//AXEhBwJAAn8gAkIwiKdB//8BcSIJQX9qQf3/AU0EQEEAIAdBf2pB/v8BSQ0BGgsgAVAgAkL///////////8AgyIMQoCAgICAgMD//wBUIAxCgICAgICAwP//AFEbRQRAIAJCgICAgICAIIQhCgwCCyADUCAEQv///////////wCDIgJCgICAgICAwP//AFQgAkKAgICAgIDA//8AURtFBEAgBEKAgICAgIAghCEKIAMhAQwCCyABIAxCgICAgICAwP//AIWEUARAIAIgA4RQBEBCgICAgICA4P//ACEKQgAhAQwDCyAKQoCAgICAgMD//wCEIQpCACEBDAILIAMgAkKAgICAgIDA//8AhYRQBEAgASAMhCECQgAhASACUARAQoCAgICAgOD//wAhCgwDCyAKQoCAgICAgMD//wCEIQoMAgsgASAMhFAEQEIAIQEMAgsgAiADhFAEQEIAIQEMAgsgDEL///////8/WARAIAVB0ABqIAEgCyABIAsgC1AiBht5IAZBBnStfKciBkFxahDNBCAFKQNYIgtCIIYgBSkDUCIBQiCIhCENIAtCIIghEkEQIAZrIQYLIAYgAkL///////8/Vg0AGiAFQUBrIAMgDiADIA4gDlAiCBt5IAhBBnStfKciCEFxahDNBCAFKQNIIgJCD4YgBSkDQCIDQjGIhCEQIAJCL4YgA0IRiIQhDyACQhGIIREgBiAIa0EQagshBiAPQv////8PgyICIAFC/////w+DIgF+Ig8gA0IPhkKAgP7/D4MiAyANQv////8PgyIMfnwiBEIghiIOIAEgA358Ig0gDlStIAIgDH4iFSADIAtC/////w+DIgt+fCITIBBC/////w+DIg4gAX58IhAgBCAPVK1CIIYgBEIgiIR8IhQgAiALfiIWIAMgEkKAgASEIg9+fCIDIAwgDn58IhIgASARQv////8Hg0KAgICACIQiAX58IhFCIIZ8Ihd8IQQgByAJaiAGakGBgH9qIQYCQCALIA5+IhggAiAPfnwiAiAYVK0gAiABIAx+fCIMIAJUrXwgDCATIBVUrSAQIBNUrXx8IgIgDFStfCABIA9+fCABIAt+IgsgDiAPfnwiASALVK1CIIYgAUIgiIR8IAIgAUIghnwiASACVK18IAEgESASVK0gAyAWVK0gEiADVK18fEIghiARQiCIhHwiAyABVK18IAMgFCAQVK0gFyAUVK18fCICIANUrXwiAUKAgICAgIDAAINQRQRAIAZBAWohBgwBCyANQj+IIQMgAUIBhiACQj+IhCEBIAJCAYYgBEI/iIQhAiANQgGGIQ0gAyAEQgGGhCEECyAGQf//AU4EQCAKQoCAgICAgMD//wCEIQpCACEBDAELAn4gBkEATARAQQEgBmsiB0H/AE0EQCAFQRBqIA0gBCAHEMwEIAVBIGogAiABIAZB/wBqIgYQzQQgBUEwaiANIAQgBhDNBCAFIAIgASAHEMwEIAUpAzAgBSkDOIRCAFKtIAUpAyAgBSkDEISEIQ0gBSkDKCAFKQMYhCEEIAUpAwAhAiAFKQMIDAILQgAhAQwCCyABQv///////z+DIAatQjCGhAsgCoQhCiANUCAEQn9VIARCgICAgICAgICAf1EbRQRAIAogAkIBfCIBIAJUrXwhCgwBCyANIARCgICAgICAgICAf4WEUEUEQCACIQEMAQsgCiACIAJCAYN8IgEgAlStfCEKCyAAIAE3AwAgACAKNwMIIAVB4ABqJAALfwICfwF+IwBBEGsiAyQAIAACfiABRQRAQgAMAQsgAyABIAFBH3UiAmogAnMiAq1CACACZyICQdEAahDNBCADKQMIQoCAgICAgMAAhUGegAEgAmutQjCGfCABQYCAgIB4ca1CIIaEIQQgAykDAAs3AwAgACAENwMIIANBEGokAAvICQIEfwR+IwBB8ABrIgUkACAEQv///////////wCDIQoCQAJAIAFCf3wiC0J/USACQv///////////wCDIgkgCyABVK18Qn98IgtC////////v///AFYgC0L///////+///8AURtFBEAgA0J/fCILQn9SIAogCyADVK18Qn98IgtC////////v///AFQgC0L///////+///8AURsNAQsgAVAgCUKAgICAgIDA//8AVCAJQoCAgICAgMD//wBRG0UEQCACQoCAgICAgCCEIQQgASEDDAILIANQIApCgICAgICAwP//AFQgCkKAgICAgIDA//8AURtFBEAgBEKAgICAgIAghCEEDAILIAEgCUKAgICAgIDA//8AhYRQBEBCgICAgICA4P//ACACIAEgA4UgAiAEhUKAgICAgICAgIB/hYRQIgYbIQRCACABIAYbIQMMAgsgAyAKQoCAgICAgMD//wCFhFANASABIAmEUARAIAMgCoRCAFINAiABIAODIQMgAiAEgyEEDAILIAMgCoRQRQ0AIAEhAyACIQQMAQsgAyABIAMgAVYgCiAJViAJIApRGyIHGyEKIAQgAiAHGyILQv///////z+DIQkgAiAEIAcbIgJCMIinQf//AXEhCCALQjCIp0H//wFxIgZFBEAgBUHgAGogCiAJIAogCSAJUCIGG3kgBkEGdK18pyIGQXFqEM0EIAUpA2ghCSAFKQNgIQpBECAGayEGCyABIAMgBxshAyACQv///////z+DIQEgCAR+IAEFIAVB0ABqIAMgASADIAEgAVAiBxt5IAdBBnStfKciB0FxahDNBEEQIAdrIQggBSkDUCEDIAUpA1gLQgOGIANCPYiEQoCAgICAgIAEhCEEIAlCA4YgCkI9iIQhASACIAuFIQwCfiADQgOGIgMgBiAIayIHRQ0AGiAHQf8ASwRAQgAhBEIBDAELIAVBQGsgAyAEQYABIAdrEM0EIAVBMGogAyAEIAcQzAQgBSkDOCEEIAUpAzAgBSkDQCAFKQNIhEIAUq2ECyEDIAFCgICAgICAgASEIQkgCkIDhiECAkAgDEJ/VwRAIAIgA30iASAJIAR9IAIgA1StfSIDhFAEQEIAIQNCACEEDAMLIANC/////////wNWDQEgBUEgaiABIAMgASADIANQIgcbeSAHQQZ0rXynQXRqIgcQzQQgBiAHayEGIAUpAyghAyAFKQMgIQEMAQsgAiADfCIBIANUrSAEIAl8fCIDQoCAgICAgIAIg1ANACABQgGDIANCP4YgAUIBiISEIQEgBkEBaiEGIANCAYghAwsgC0KAgICAgICAgIB/gyECIAZB//8BTgRAIAJCgICAgICAwP//AIQhBEIAIQMMAQtBACEHAkAgBkEASgRAIAYhBwwBCyAFQRBqIAEgAyAGQf8AahDNBCAFIAEgA0EBIAZrEMwEIAUpAwAgBSkDECAFKQMYhEIAUq2EIQEgBSkDCCEDCyADQj2GIAFCA4iEIgQgAadBB3EiBkEES618IgEgBFStIANCA4hC////////P4MgAoQgB61CMIaEfCABIAFCAYNCACAGQQRGGyIBfCIDIAFUrXwhBAsgACADNwMAIAAgBDcDCCAFQfAAaiQAC4ECAgJ/BH4jAEEQayICJAAgAb0iBUKAgICAgICAgIB/gyEHAn4gBUL///////////8AgyIEQoCAgICAgIB4fEL/////////7/8AWARAIARCPIYhBiAEQgSIQoCAgICAgICAPHwMAQsgBEKAgICAgICA+P8AWgRAIAVCPIYhBiAFQgSIQoCAgICAgMD//wCEDAELIARQBEBCAAwBCyACIARCACAEQoCAgIAQWgR/IARCIIinZwUgBadnQSBqCyIDQTFqEM0EIAIpAwAhBiACKQMIQoCAgICAgMAAhUGM+AAgA2utQjCGhAshBCAAIAY3AwAgACAEIAeENwMIIAJBEGokAAvbAQIBfwJ+QQEhBAJAIABCAFIgAUL///////////8AgyIFQoCAgICAgMD//wBWIAVCgICAgICAwP//AFEbDQAgAkIAUiADQv///////////wCDIgZCgICAgICAwP//AFYgBkKAgICAgIDA//8AURsNACAAIAKEIAUgBoSEUARAQQAPCyABIAODQgBZBEBBfyEEIAAgAlQgASADUyABIANRGw0BIAAgAoUgASADhYRCAFIPC0F/IQQgACACViABIANVIAEgA1EbDQAgACAChSABIAOFhEIAUiEECyAEC9gBAgF/AX5BfyECAkAgAEIAUiABQv///////////wCDIgNCgICAgICAwP//AFYgA0KAgICAgIDA//8AURsNACAAIANCgICAgICAgP8/hIRQBEBBAA8LIAFCgICAgICAgP8/g0IAWQRAIABCAFQgAUKAgICAgICA/z9TIAFCgICAgICAgP8/URsNASAAIAFCgICAgICAgP8/hYRCAFIPCyAAQgBWIAFCgICAgICAgP8/VSABQoCAgICAgID/P1EbDQAgACABQoCAgICAgID/P4WEQgBSIQILIAILNQAgACABNwMAIAAgAkL///////8/gyAEQjCIp0GAgAJxIAJCMIinQf//AXFyrUIwhoQ3AwgLZwIBfwF+IwBBEGsiAiQAIAACfiABRQRAQgAMAQsgAiABrUIAQfAAIAFnQR9zIgFrEM0EIAIpAwhCgICAgICAwACFIAFB//8Aaq1CMIZ8IQMgAikDAAs3AwAgACADNwMIIAJBEGokAAtFAQF/IwBBEGsiBSQAIAUgASACIAMgBEKAgICAgICAgIB/hRDUBSAFKQMAIQEgACAFKQMINwMIIAAgATcDACAFQRBqJAALxAIBAX8jAEHQAGsiBCQAAkAgA0GAgAFOBEAgBEEgaiABIAJCAEKAgICAgICA//8AENIFIAQpAyghAiAEKQMgIQEgA0H//wFIBEAgA0GBgH9qIQMMAgsgBEEQaiABIAJCAEKAgICAgICA//8AENIFIANB/f8CIANB/f8CSBtBgoB+aiEDIAQpAxghAiAEKQMQIQEMAQsgA0GBgH9KDQAgBEFAayABIAJCAEKAgICAgIDAABDSBSAEKQNIIQIgBCkDQCEBIANBg4B+SgRAIANB/v8AaiEDDAELIARBMGogASACQgBCgICAgICAwAAQ0gUgA0GGgH0gA0GGgH1KG0H8/wFqIQMgBCkDOCECIAQpAzAhAQsgBCABIAJCACADQf//AGqtQjCGENIFIAAgBCkDCDcDCCAAIAQpAwA3AwAgBEHQAGokAAuOEQIFfwx+IwBBwAFrIgUkACAEQv///////z+DIRIgAkL///////8/gyEMIAIgBIVCgICAgICAgICAf4MhESAEQjCIp0H//wFxIQcCQAJAAkAgAkIwiKdB//8BcSIJQX9qQf3/AU0EQCAHQX9qQf7/AUkNAQsgAVAgAkL///////////8AgyIKQoCAgICAgMD//wBUIApCgICAgICAwP//AFEbRQRAIAJCgICAgICAIIQhEQwCCyADUCAEQv///////////wCDIgJCgICAgICAwP//AFQgAkKAgICAgIDA//8AURtFBEAgBEKAgICAgIAghCERIAMhAQwCCyABIApCgICAgICAwP//AIWEUARAIAMgAkKAgICAgIDA//8AhYRQBEBCACEBQoCAgICAgOD//wAhEQwDCyARQoCAgICAgMD//wCEIRFCACEBDAILIAMgAkKAgICAgIDA//8AhYRQBEBCACEBDAILIAEgCoRQDQIgAiADhFAEQCARQoCAgICAgMD//wCEIRFCACEBDAILIApC////////P1gEQCAFQbABaiABIAwgASAMIAxQIgYbeSAGQQZ0rXynIgZBcWoQzQRBECAGayEGIAUpA7gBIQwgBSkDsAEhAQsgAkL///////8/Vg0AIAVBoAFqIAMgEiADIBIgElAiCBt5IAhBBnStfKciCEFxahDNBCAGIAhqQXBqIQYgBSkDqAEhEiAFKQOgASEDCyAFQZABaiASQoCAgICAgMAAhCIUQg+GIANCMYiEIgJChMn5zr/mvIL1ACACfSIEEM4FIAVBgAFqQgAgBSkDmAF9IAQQzgUgBUHwAGogBSkDiAFCAYYgBSkDgAFCP4iEIgQgAhDOBSAFQeAAaiAEQgAgBSkDeH0QzgUgBUHQAGogBSkDaEIBhiAFKQNgQj+IhCIEIAIQzgUgBUFAayAEQgAgBSkDWH0QzgUgBUEwaiAFKQNIQgGGIAUpA0BCP4iEIgQgAhDOBSAFQSBqIARCACAFKQM4fRDOBSAFQRBqIAUpAyhCAYYgBSkDIEI/iIQiBCACEM4FIAUgBEIAIAUpAxh9EM4FIAYgCSAHa2ohBgJ+QgAgBSkDCEIBhiAFKQMAQj+IhEJ/fCIKQv////8PgyIEIAJCIIgiDn4iECAKQiCIIgogAkL/////D4MiC358IgJCIIYiDSAEIAt+fCILIA1UrSAKIA5+IAIgEFStQiCGIAJCIIiEfHwgCyAEIANCEYhC/////w+DIg5+IhAgCiADQg+GQoCA/v8PgyINfnwiAkIghiIPIAQgDX58IA9UrSAKIA5+IAIgEFStQiCGIAJCIIiEfHx8IgIgC1StfCACQgBSrXx9IgtC/////w+DIg4gBH4iECAKIA5+Ig0gBCALQiCIIg9+fCILQiCGfCIOIBBUrSAKIA9+IAsgDVStQiCGIAtCIIiEfHwgDkIAIAJ9IgJCIIgiCyAEfiIQIAJC/////w+DIg0gCn58IgJCIIYiDyAEIA1+fCAPVK0gCiALfiACIBBUrUIghiACQiCIhHx8fCICIA5UrXwgAkJ+fCIQIAJUrXxCf3wiC0L/////D4MiAiAMQgKGIAFCPoiEQv////8PgyIEfiIOIAFCHohC/////w+DIgogC0IgiCILfnwiDSAOVK0gDSAQQiCIIg4gDEIeiEL//+//D4NCgIAQhCIMfnwiDyANVK18IAsgDH58IAIgDH4iEyAEIAt+fCINIBNUrUIghiANQiCIhHwgDyANQiCGfCINIA9UrXwgDSAKIA5+IhMgEEL/////D4MiECAEfnwiDyATVK0gDyACIAFCAoZC/P///w+DIhN+fCIVIA9UrXx8Ig8gDVStfCAPIAsgE34iCyAMIBB+fCIMIAQgDn58IgQgAiAKfnwiAkIgiCACIARUrSAMIAtUrSAEIAxUrXx8QiCGhHwiDCAPVK18IAwgFSAOIBN+IgQgCiAQfnwiCkIgiCAKIARUrUIghoR8IgQgFVStIAQgAkIghnwgBFStfHwiBCAMVK18IgJC/////////wBYBEAgAUIxhiAEQv////8PgyIBIANC/////w+DIgp+IgxCAFKtfUIAIAx9IhAgBEIgiCIMIAp+Ig0gASADQiCIIgt+fCIOQiCGIg9UrX0gAkL/////D4MgCn4gASASQv////8Pg358IAsgDH58IA4gDVStQiCGIA5CIIiEfCAEIBRCIIh+IAMgAkIgiH58IAIgC358IAwgEn58QiCGfH0hEiAGQX9qIQYgECAPfQwBCyAEQiGIIQsgAUIwhiACQj+GIARCAYiEIgRC/////w+DIgEgA0L/////D4MiCn4iDEIAUq19QgAgDH0iDiABIANCIIgiDH4iECALIAJCH4aEIg1C/////w+DIg8gCn58IgtCIIYiE1StfSAMIA9+IAogAkIBiCIKQv////8Pg358IAEgEkL/////D4N+fCALIBBUrUIghiALQiCIhHwgBCAUQiCIfiADIAJCIYh+fCAKIAx+fCANIBJ+fEIghnx9IRIgCiECIA4gE30LIQEgBkGAgAFOBEAgEUKAgICAgIDA//8AhCERQgAhAQwBCyAGQf//AGohByAGQYGAf0wEQAJAIAcNACAEIAFCAYYgA1YgEkIBhiABQj+IhCIBIBRWIAEgFFEbrXwiASAEVK0gAkL///////8/g3wiAkKAgICAgIDAAINQDQAgAiARhCERDAILQgAhAQwBCyAEIAFCAYYgA1ogEkIBhiABQj+IhCIBIBRaIAEgFFEbrXwiASAEVK0gAkL///////8/gyAHrUIwhoR8IBGEIRELIAAgATcDACAAIBE3AwggBUHAAWokAA8LIABCADcDACAAIBFCgICAgICA4P//ACACIAOEQgBSGzcDCCAFQcABaiQAC6UIAgV/An4jAEEwayIFJAACQCACQQJNBEAgAkECdCICQdycAWooAgAhByACQdCcAWooAgAhCANAAn8gASgCBCIC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EyAAIBQ3AwAgACATNwMIIAdBgMYAaiQAC40EAgR/AX4CQAJ/IAAoAgQiAiAAKAJoSQRAIAAgAkEBajYCBCACLQAADAELIAAQzQULIgNBVWoiAkECTUEAIAJBAWsbRQRAIANBUGohBAwBCwJ/IAAoAgQiAiAAKAJoSQRAIAAgAkEBajYCBCACLQAADAELIAAQzQULIQIgA0EtRiEFIAJBUGohBAJAIAFFDQAgBEEKSQ0AIAAoAmhFDQAgACAAKAIEQX9qNgIECyACIQMLAkAgBEEKSQRAQQAhBANAIAMgBEEKbGohAQJ/IAAoAgQiAiAAKAJoSQRAIAAgAkEBajYCBCACLQAADAELIAAQzQULIgNBUGoiAkEJTUEAIAFBUGoiBEHMmbPmAEgbDQALIASsIQYCQCACQQpPDQADQCADrSAGQgp+fCEGAn8gACgCBCIBIAAoAmhJBEAgACABQQFqNgIEIAEtAAAMAQsgABDNBQshAyAGQlB8IQYgA0FQaiICQQlLDQEgBkKuj4XXx8LrowFTDQALCyACQQpJBEADQAJ/IAAoAgQiASAAKAJoSQRAIAAgAUEBajYCBCABLQAADAELIAAQzQULQVBqQQpJDQALCyAAKAJoBEAgACAAKAIEQX9qNgIEC0IAIAZ9IAYgBRshBgwBC0KAgICAgICAgIB/IQYgACgCaEUNACAAIAAoAgRBf2o2AgRCgICAgICAgICAfw8LIAYLtgMCA38BfiMAQSBrIgMkAAJAIAFC////////////AIMiBUKAgICAgIDAv0B8IAVCgICAgICAwMC/f3xUBEAgAUIZiKchAiAAUCABQv///w+DIgVCgICACFQgBUKAgIAIURtFBEAgAkGBgICABGohAgwCCyACQYCAgIAEaiECIAAgBUKAgIAIhYRCAFINASACQQFxIAJqIQIMAQsgAFAgBUKAgICAgIDA//8AVCAFQoCAgICAgMD//wBRG0UEQCABQhmIp0H///8BcUGAgID+B3IhAgwBC0GAgID8ByECIAVC////////v7/AAFYNAEEAIQIgBUIwiKciBEGR/gBJDQAgAyAAIAFC////////P4NCgICAgICAwACEIgVBgf8AIARrEMwEIANBEGogACAFIARB/4F/ahDNBCADKQMIIgBCGYinIQIgAykDACADKQMQIAMpAxiEQgBSrYQiBVAgAEL///8PgyIAQoCAgAhUIABCgICACFEbRQRAIAJBAWohAgwBCyAFIABCgICACIWEQgBSDQAgAkEBcSACaiECCyADQSBqJAAgAiABQiCIp0GAgICAeHFyvgvxEwINfwN+IwBBsAJrIgYkACAAKAJMQQBOBH9BAQVBAAsaAkAgAS0AACIERQ0AAkADQAJAAkAgBEH/AXEiA0EgRiADQXdqQQVJcgRAA0AgASIEQQFqIQEgBC0AASIDQSBGIANBd2pBBUlyDQALIABCABDMBQNAAn8gACgCBCIBIAAoAmhJBEAgACABQQFqNgIEIAEtAAAMAQsgABDNBQsiAUEgRiABQXdqQQVJcg0ACwJAIAAoAmhFBEAgACgCBCEBDAELIAAgACgCBEF/aiIBNgIECyABIAAoAghrrCAAKQN4IBB8fCEQDAELAkACQAJAIAEtAAAiBEElRgRAIAEtAAEiA0EqRg0BIANBJUcNAgsgAEIAEMwFIAEgBEElRmohBAJ/IAAoAgQiASAAKAJoSQRAIAAgAUEBajYCBCABLQAADAELIAAQzQULIgEgBC0AAEcEQCAAKAJoBEAgACAAKAIEQX9qNgIEC0EAIQwgAUEATg0IDAULIBBCAXwhEAwDCyABQQJqIQRBACEHDAELAkAgA0FQakEKTw0AIAEtAAJBJEcNACABQQNqIQQgAiABLQABQVBqEOMFIQcMAQsgAUEBaiEEIAIoAgAhByACQQRqIQILQQAhDEEAIQEgBC0AAEFQakEKSQRAA0AgBC0AACABQQpsakFQaiEBIAQtAAEhAyAEQQFqIQQgA0FQakEKSQ0ACwsCfyAEIAQtAAAiBUHtAEcNABpBACEJIAdBAEchDCAELQABIQVBACEKIARBAWoLIQMgBUH/AXFBv39qIghBOUsNASADQQFqIQRBAyEFAkACQAJAAkACQAJAIAhBAWsOOQcEBwQEBAcHBwcDBwcHBwcHBAcHBwcEBwcEBwcHBwcEBwQEBAQEAAQFBwEHBAQEBwcEAgQHBwQHAgQLIANBAmogBCADLQABQegARiIDGyEEQX5BfyADGyEFDAQLIANBAmogBCADLQABQewARiIDGyEEQQNBASADGyEFDAMLQQEhBQwCC0ECIQUMAQtBACEFIAMhBAtBASAFIAQtAAAiA0EvcUEDRiIIGyEOAkAgA0EgciADIAgbIgtB2wBGDQACQCALQe4ARwRAIAtB4wBHDQEgAUEBIAFBAUobIQEMAgsgByAOIBAQ5AUMAgsgAEIAEMwFA0ACfyAAKAIEIgMgACgCaEkEQCAAIANBAWo2AgQgAy0AAAwBCyAAEM0FCyIDQSBGIANBd2pBBUlyDQALAkAgACgCaEUEQCAAKAIEIQMMAQsgACAAKAIEQX9qIgM2AgQLIAMgACgCCGusIAApA3ggEHx8IRALIAAgAawiERDMBQJAIAAoAgQiCCAAKAJoIgNJBEAgACAIQQFqNgIEDAELIAAQzQVBAEgNAiAAKAJoIQMLIAMEQCAAIAAoAgRBf2o2AgQLAkACQCALQah/aiIDQSBLBEAgC0G/f2oiAUEGSw0CQQEgAXRB8QBxRQ0CDAELQRAhBQJAAkACQAJAAkAgA0EBaw4fBgYEBgYGBgYFBgQBBQUFBgAGBgYGBgIDBgYEBgEGBgMLQQAhBQwCC0EKIQUMAQtBCCEFCyAAIAVBAEJ/EM8FIREgACkDeEIAIAAoAgQgACgCCGusfVENBgJAIAdFDQAgC0HwAEcNACAHIBE+AgAMAwsgByAOIBEQ5AUMAgsCQCALQRByQfMARgRAIAZBIGpBf0GBAhDSCRogBkEAOgAgIAtB8wBHDQEgBkEAOgBBIAZBADoALiAGQQA2ASoMAQsgBkEgaiAELQABIgNB3gBGIghBgQIQ0gkaIAZBADoAICAEQQJqIARBAWogCBshDQJ/AkACQCAEQQJBASAIG2otAAAiBEEtRwRAIARB3QBGDQEgA0HeAEchBSANDAMLIAYgA0HeAEciBToATgwBCyAGIANB3gBHIgU6AH4LIA1BAWoLIQQDQAJAIAQtAAAiA0EtRwRAIANFDQcgA0HdAEcNAQwDC0EtIQMgBC0AASIIRQ0AIAhB3QBGDQAgBEEBaiENAkAgBEF/ai0AACIEIAhPBEAgCCEDDAELA0AgBEEBaiIEIAZBIGpqIAU6AAAgBCANLQAAIgNJDQALCyANIQQLIAMgBmogBToAISAEQQFqIQQMAAALAAsgAUEBakEfIAtB4wBGIggbIQUCQAJAAkAgDkEBRyINRQRAIAchAyAMBEAgBUECdBDFCSIDRQ0ECyAGQgA3A6gCQQAhAQNAIAMhCgJAA0ACfyAAKAIEIgMgACgCaEkEQCAAIANBAWo2AgQgAy0AAAwBCyAAEM0FCyIDIAZqLQAhRQ0BIAYgAzoAGyAGQRxqIAZBG2pBASAGQagCahDQBSIDQX5GDQAgA0F/Rg0FIAoEQCAKIAFBAnRqIAYoAhw2AgAgAUEBaiEBCyAMRQ0AIAEgBUcNAAsgCiAFQQF0QQFyIgVBAnQQxwkiAw0BDAQLCwJ/QQEgBkGoAmoiA0UNABogAygCAEULRQ0CQQAhCQwBCyAMBEBBACEBIAUQxQkiA0UNAwNAIAMhCQNAAn8gACgCBCIDIAAoAmhJBEAgACADQQFqNgIEIAMtAAAMAQsgABDNBQsiAyAGai0AIUUEQEEAIQoMBAsgASAJaiADOgAAIAFBAWoiASAFRw0AC0EAIQogCSAFQQF0QQFyIgUQxwkiAw0ACwwHC0EAIQEgBwRAA0ACfyAAKAIEIgMgACgCaEkEQCAAIANBAWo2AgQgAy0AAAwBCyAAEM0FCyIDIAZqLQAhBEAgASAHaiADOgAAIAFBAWohAQwBBUEAIQogByEJDAMLAAALAAsDQAJ/IAAoAgQiASAAKAJoSQRAIAAgAUEBajYCBCABLQAADAELIAAQzQULIAZqLQAhDQALQQAhCUEAIQpBACEBCwJAIAAoAmhFBEAgACgCBCEDDAELIAAgACgCBEF/aiIDNgIECyAAKQN4IAMgACgCCGusfCISUA0HIBEgElJBACAIGw0HAkAgDEUNACANRQRAIAcgCjYCAAwBCyAHIAk2AgALIAgNAyAKBEAgCiABQQJ0akEANgIACyAJRQRAQQAhCQwECyABIAlqQQA6AAAMAwtBACEJDAQLQQAhCUEAIQoMAwsgBiAAIA5BABDdBSAAKQN4QgAgACgCBCAAKAIIa6x9UQ0EIAdFDQAgDkECSw0AIAYpAwghESAGKQMAIRICQAJAAkAgDkEBaw4CAQIACyAHIBIgERDhBTgCAAwCCyAHIBIgERDOBDkDAAwBCyAHIBI3AwAgByARNwMICyAAKAIEIAAoAghrrCAAKQN4IBB8fCEQIA8gB0EAR2ohDwsgBEEBaiEBIAQtAAEiBA0BDAMLCyAPQX8gDxshDwsgDEUNACAJEMYJIAoQxgkLIAZBsAJqJAAgDwswAQF/IwBBEGsiAiAANgIMIAIgACABQQJ0IAFBAEdBAnRraiIAQQRqNgIIIAAoAgALTgACQCAARQ0AIAFBAmoiAUEFSw0AAkACQAJAAkAgAUEBaw4FAQICBAMACyAAIAI8AAAPCyAAIAI9AQAPCyAAIAI+AgAPCyAAIAI3AwALC1MBAn8gASAAKAJUIgEgASACQYACaiIDEJ0EIgQgAWsgAyAEGyIDIAIgAyACSRsiAhDRCRogACABIANqIgM2AlQgACADNgIIIAAgASACajYCBCACC0oBAX8jAEGQAWsiAyQAIANBAEGQARDSCSIDQX82AkwgAyAANgIsIANBrwU2AiAgAyAANgJUIAMgASACEOIFIQAgA0GQAWokACAACwsAIAAgASACEOUFC00BAn8gAS0AACECAkAgAC0AACIDRQ0AIAIgA0cNAANAIAEtAAEhAiAALQABIgNFDQEgAUEBaiEBIABBAWohACACIANGDQALCyADIAJrC44BAQN/IwBBEGsiACQAAkAgAEEMaiAAQQhqEBkNAEHIkQMgACgCDEECdEEEahDFCSIBNgIAIAFFDQACQCAAKAIIEMUJIgEEQEHIkQMoAgAiAg0BC0HIkQNBADYCAAwBCyACIAAoAgxBAnRqQQA2AgBByJEDKAIAIAEQGkUNAEHIkQNBADYCAAsgAEEQaiQAC2YBA38gAkUEQEEADwsCQCAALQAAIgNFDQADQAJAIAMgAS0AACIFRw0AIAJBf2oiAkUNACAFRQ0AIAFBAWohASAALQABIQMgAEEBaiEAIAMNAQwCCwsgAyEECyAEQf8BcSABLQAAawucAQEFfyAAELoEIQQCQAJAQciRAygCAEUNACAALQAARQ0AIABBPRC8BA0AQciRAygCACgCACICRQ0AA0ACQCAAIAIgBBDqBSEDQciRAygCACECIANFBEAgAiABQQJ0aigCACIDIARqIgUtAABBPUYNAQsgAiABQQFqIgFBAnRqKAIAIgINAQwDCwsgA0UNASAFQQFqIQELIAEPC0EAC0QBAX8jAEEQayICJAAgAiABNgIEIAIgADYCAEHbACACEBwiAEGBYE8Ef0HQ+AJBACAAazYCAEEABSAACxogAkEQaiQAC9UFAQl/IwBBkAJrIgUkAAJAIAEtAAANAEHQnQEQ6wUiAQRAIAEtAAANAQsgAEEMbEHgnQFqEOsFIgEEQCABLQAADQELQaieARDrBSIBBEAgAS0AAA0BC0GtngEhAQsCQANAAkAgASACai0AACID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IAQgBCgCACIDQQFqNgIAIAMgADoAACABQX9qIQEgAkEBaiECDAEFQQALCyECCyAFQRBqJAAgAgstAQF/QX8hAQJAIAAoAggQlggEf0F/BSAAKAIIIgANAUEBCw8LIAAQlwhBAUYLZgECfyMAQRBrIgEkACABIAA2AgwgAUEIaiABQQxqELIGIQAjAEEQayICJAAgAkEQaiQAIAAoAgAiAARAQcjtAigCABogAARAQcjtAkH8+AIgACAAQX9GGzYCAAsLIAFBEGokAEEAC2cBAn8jAEEQayIBJAAgASAANgIMIAFBCGogAUEMahCyBiEAQQRBAUHI7QIoAgAoAgAbIQIgACgCACIABEBByO0CKAIAGiAABEBByO0CQfz4AiAAIABBf0YbNgIACwsgAUEQaiQAIAILWgEEfwNAAkAgAiADRg0AIAYgBE8NACACIAMgAmsgASAAKAIIEJkIIgdBAmoiCEECTQRAQQEhByAIQQJrDQELIAZBAWohBiAFIAdqIQUgAiAHaiECDAELCyAFC2oBAX8jAEEQayIEJAAgBCADNgIMIARBCGogBEEMahCyBiEDQQAgACABIAJB2JEDIAIbENAFIQEgAygCACIABEBByO0CKAIAGiAABEBByO0CQfz4AiAAIABBf0YbNgIACwsgBEEQaiQAIAELFQAgACgCCCIARQRAQQEPCyAAEJcIC00AIwBBEGsiACQAIAAgAjYCDCAAIAU2AgggAiADIABBDGogBSAGIABBCGoQnAghASAEIAAoAgw2AgAgByAAKAIINgIAIABBEGokACABC78FAQJ/IAIgADYCACAFIAM2AgAgAigCACEGAkACQANAIAYgAU8EQEEAIQAMAwtBAiEAIAYvAQAiA0H//8MASw0CAkACQCADQf8ATQRAQQEhACAEIAUoAgAiBmtBAUgNBSAFIAZBAWo2AgAgBiADOgAADAELIANB/w9NBEAgBCAFKAIAIgBrQQJIDQQgBSAAQQFqNgIAIAAgA0EGdkHAAXI6AAAgBSAFKAIAIgBBAWo2AgAgACADQT9xQYABcjoAAAwBCyADQf+vA00EQCAEIAUoAgAiAGtBA0gNBCAFIABBAWo2AgAgACADQQx2QeABcjoAACAFIAUoAgAiAEEBajYCACAAIANBBnZBP3FBgAFyOgAAIAUgBSgCACIAQQFqNgIAIAAg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AANAIAEgACgCCEcEQCAAKAIQGiAAIAAoAghBfGo2AggMAQsLCzgBAn8gACgCACAAKAIIIgJBAXVqIQEgACgCBCEAIAEgAkEBcQR/IAEoAgAgAGooAgAFIAALEQEACx4AQf////8DIABJBEBBsOwBEO0CAAsgAEECdBDzCAtQAQF/IAAQtwcgACwAC0EASARAIAAoAgAhASAALAALQQBIBH8gACgCCEH/////B3FBf2oFQQoLGiABEMYJIABBgICAgHg2AgggAEEAOgALCwtQAQF/IAAQxAcgACwAC0EASARAIAAoAgAhASAALAALQQBIBH8gACgCCEH/////B3FBf2oFQQELGiABEMYJIABBgICAgHg2AgggAEEAOgALCws6AgF/AX4jAEEQayIDJAAgAyABIAIQrgYQ/wUgAykDACEEIAAgAykDCDcDCCAAIAQ3AwAgA0EQaiQACwMAAAtHAQF/IABBCGoiASgCAEUEQCAAIAAoAgAoAhARAQAPCwJ/IAEgASgCAEF/aiIBNgIAIAFBf0YLBEAgACAAKAIAKAIQEQEACwsEAEEACy4AA0AgACgCAEEBRg0ACyAAKAIARQRAIABBATYCACABQbMFEQEAIABBfzYCAAsLMQECfyAAQQEgABshAANAAkAgABDFCSIBDQBB3KEDKAIAIgJFDQAgAhEHAAwBCwsgAQs6AQJ/IAEQugQiAkENahDzCCIDQQA2AgggAyACNgIEIAMgAjYCACAAIANBDGogASACQQFqENEJNgIACykBAX8gAgRAIAAhAwNAIAMgATYCACADQQRqIQMgAkF/aiICDQALCyAAC2kBAX8CQCAAIAFrQQJ1IAJJBEADQCAAIAJBf2oiAkECdCIDaiABIANqKAIANgIAIAINAAwCAAsACyACRQ0AIAAhAwNAIAMgASgCADYCACADQQRqIQMgAUEEaiEBIAJBf2oiAg0ACwsgAAsKAEGs7gEQ7QIAC1kBAn8jAEEQayIDJAAgAEIANwIAIABBADYCCCAAIQICQCABLAALQQBOBEAgAiABKAIINgIIIAIgASkCADcCAAwBCyAAIAEoAgAgASgCBBD5CAsgA0EQaiQAC5wBAQN/IwBBEGsiBCQAQW8gAk8EQAJAIAJBCk0EQCAAIAI6AAsgACEDDAELIAAgAkELTwR/IAJBEGpBcHEiAyADQX9qIgMgA0ELRhsFQQoLQQFqIgUQ3wgiAzYCACAAIAVBgICAgHhyNgIIIAAgAjYCBAsgAyABIAIQ8QQgBEEAOgAPIAIgA2ogBC0ADzoAACAEQRBqJAAPCxD3CAALHQAgACwAC0EASARAIAAoAggaIAAoAgAQxgkLIAALyQEBA38jAEEQayIEJAACQCAALAALQQBIBH8gACgCCEH/////B3FBf2oFQQoLIgMgAk8EQAJ/IAAsAAtBAEgEQCAAKAIADAELIAALIgMhBSACBEAgBSABIAIQ0wkLIARBADoADyACIANqIAQtAA86AAACQCAALAALQQBIBEAgACACNgIEDAELIAAgAjoACwsMAQsgACADIAIgA2sCfyAALAALQQBIBEAgACgCBAwBCyAALQALCyIAQQAgACACIAEQ/AgLIARBEGokAAvMAgEFfyMAQRBrIggkACABQX9zQW9qIAJPBEACfyAALAALQQBIBEAgACgCAAwBCyAACyEJAn9B5////wcgAUsEQCAIIAFBAXQ2AgggCCABIAJqNgIMAn8jAEEQayICJAAgCEEMaiIKKAIAIAhBCGoiCygCAEkhDCACQRBqJAAgCyAKIAwbKAIAIgJBC08LBH8gAkEQakFwcSICIAJBf2oiAiACQQtGGwVBCgsMAQtBbgtBAWoiChDfCCECIAQEQCACIAkgBBDxBAsgBgRAIAIgBGogByAGEPEECyADIAVrIgMgBGsiBwRAIAIgBGogBmogBCAJaiAFaiAHEPEECyABQQpHBEAgCRDGCQsgACACNgIAIAAgCkGAgICAeHI2AgggACADIAZqIgA2AgQgCEEAOgAHIAAgAmogCC0ABzoAACAIQRBqJAAPCxD3CAALOAEBfwJ/IAAsAAtBAEgEQCAAKAIEDAELIAAtAAsLIgIgAUkEQCAAIAEgAmsQ/ggPCyAAIAEQ/wgLyQEBBH8jAEEQayIFJAAgAQRAIAAsAAtBAEgEfyAAKAIIQf////8HcUF/agVBCgshAgJ/IAAsAAtBAEgEQCAAKAIEDAELIAAtAAsLIgMgAWohBCACIANrIAFJBEAgACACIAQgAmsgAyADEIAJCyADAn8gACwAC0EASARAIAAoAgAMAQsgAAsiAmogAUEAEIEJAkAgACwAC0EASARAIAAgBDYCBAwBCyAAIAQ6AAsLIAVBADoADyACIARqIAUtAA86AAALIAVBEGokAAthAQJ/IwBBEGsiAiQAAkAgACwAC0EASARAIAAoAgAhAyACQQA6AA8gASADaiACLQAPOgAAIAAgATYCBAwBCyACQQA6AA4gACABaiACLQAOOgAAIAAgAToACwsgAkEQaiQAC40CAQV/IwBBEGsiBSQAQW8gAWsgAk8EQAJ/IAAsAAtBAEgEQCAAKAIADAELIAALIQYCf0Hn////ByABSwRAIAUgAUEBdDYCCCAFIAEgAmo2AgwCfyMAQRBrIgIkACAFQQxqIgcoAgAgBUEIaiIIKAIASSEJIAJBEGokACAIIAcgCRsoAgAiAkELTwsEfyACQRBqQXBxIgIgAkF/aiICIAJBC0YbBUEKCwwBC0FuC0EBaiIHEN8IIQIgBARAIAIgBiAEEPEECyADIARrIgMEQCACIARqIAQgBmogAxDxBAsgAUEKRwRAIAYQxgkLIAAgAjYCACAAIAdBgICAgHhyNgIIIAVBEGokAA8LEPcIAAsVACABBEAgACACQf8BcSABENIJGgsL1wEBA38jAEEQayIFJAACQCAALAALQQBIBH8gACgCCEH/////B3FBf2oFQQoLIgQCfyAALAALQQBIBEAgACgCBAwBCyAALQALCyIDayACTwRAIAJFDQECfyAALAALQQBIBEAgACgCAAwBCyAACyIEIANqIAEgAhDxBCACIANqIgIhAQJAIAAsAAtBAEgEQCAAIAE2AgQMAQsgACABOgALCyAFQQA6AA8gAiAEaiAFLQAPOgAADAELIAAgBCACIANqIARrIAMgA0EAIAIgARD8CAsgBUEQaiQAC8EBAQN/IwBBEGsiAyQAIAMgAToADwJAAkACQAJAIAAsAAtBAEgEQCAAKAIEIgQgACgCCEH/////B3FBf2oiAkYNAQwDC0EKIQRBCiECIAAtAAsiAUEKRw0BCyAAIAJBASACIAIQgAkgBCEBIAAsAAtBAEgNAQsgACICIAFBAWo6AAsMAQsgACgCACECIAAgBEEBajYCBCAEIQELIAEgAmoiACADLQAPOgAAIANBADoADiAAIAMtAA46AAEgA0EQaiQACzsBAX8jAEEQayIBJAACQCAAQQE6AAsgAEEBQS0QgQkgAUEAOgAPIAAgAS0ADzoAASABQRBqJAAPAAsAC6MBAQN/IwBBEGsiBCQAQe////8D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BBDoBUULoAEBAn8jAEFAaiIDJABBASEEAkAgACABQQAQlgkNAEEAIQQgAUUNACABQaTxARCYCSIBRQ0AIANBfzYCFCADIAA2AhAgA0EANgIMIAMgATYCCCADQRhqQQBBJxDSCRogA0EBNgI4IAEgA0EIaiACKAIAQQEgASgCACgCHBELACADKAIgQQFHDQAgAiADKAIYNgIAQQEhBAsgA0FAayQAIAQLpQIBBH8jAEFAaiICJAAgACgCACIDQXhqKAIAIQUgA0F8aigCACEDIAJBADYCFCACQfTwATYCECACIAA2AgwgAiABNgIIIAJBGGpBAEEnENIJGiAAIAVqIQACQCADIAFBABCWCQRAIAJBATYCOCADIAJBCGogACAAQQFBACADKAIAKAIUEQ0AIABBACACKAIgQQFGGyEEDAELIAMgAkEIaiAAQQFBACADKAIAKAIYEQoAIAIoAiwiAEEBSw0AIABBAWsEQCACKAIcQQAgAigCKEEBRhtBACACKAIkQQFGG0EAIAIoAjBBAUYbIQQMAQsgAigCIEEBRwRAIAIoAjANASACKAIkQQFHDQEgAigCKEEBRw0BCyACKAIYIQQLIAJBQGskACAEC10BAX8gACgCECIDRQRAIABBATYCJCAAIAI2AhggACABNgIQDwsCQCABIANGBEAgACgCGEECRw0BIAAgAjYCGA8LIABBAToANiAAQQI2AhggACAAKAIkQQFqNgIkCwsaACAAIAEoAghBABCWCQRAIAEgAiADEJkJCwszACAAIAEoAghBABCWCQRAIAEgAiADEJkJDwsgACgCCCIAIAEgAiADIAAoAgAoAhwRCwALUgEBfyAAKAIEIQQgACgCACIAIAECf0EAIAJFDQAaIARBCHUiASAEQQFxRQ0AGiACKAIAIAFqKAIACyACaiADQQIgBEECcRsgACgCACgCHBELAAtwAQJ/IAAgASgCCEEAEJYJBEAgASACIAMQmQkPCyAAKAIMIQQgAEEQaiIFIAEgAiADEJwJAkAgBEECSA0AIAUgBEEDdGohBCAAQRhqIQADQCAAIAEgAiADEJwJIAEtADYNASAAQQhqIgAgBEkNAAsLC0AAAkAgACABIAAtAAhBGHEEf0EBBUEAIQAgAUUNASABQdTxARCYCSIBRQ0BIAEtAAhBGHFBAEcLEJYJIQALIAAL6QMB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AAsMAgsgAkEDTQ0AIAIhAwNAIAAgASgCADYCACABQQRqIQEgAEEEaiEAIANBfGoiA0EDSw0ACyACQQNxIQILIAJFDQADQCAAIAEtAAA6AAAgAEEBaiEAIAFBAWohASACQX9qIgINAAsLCx8AQdSlAygCAEUEQEHYpQMgATYCAEHUpQMgADYCAAsLBAAjAAsQACMAIABrQXBxIgAkACAACwYAIAAkAAsGACAAQAALCwAgASACIAARAgALDwAgASACIAMgBCAAEQsACwsAIAEgAiAAEREACw0AIAEgAiADIAARTQALDwAgASACIAMgBCAAERYACxEAIAEgAiADIAQgBSAAEVUACw0AIAEgAiADIAAREgALDwAgASACIAMgBCAAEVIACwsAIAEgAiAAERgACwsAIAEgAiAAEQ8ACw0AIAEgAiADIAARGgALDQAgASACIAMgABEeAAsPACABIAIgAyAEIAARTAALDwAgASACIAMgBCAAERkACw8AIAEgAiADIAQgABFcAAsRACABIAIgAyAEIAUgABFPAAsRACABIAIgAyAEIAUgABFdAAsTACABIAIgAyAEIAUgBiAAEVAACw8AIAEgAiADIAQgABE+AAsRACABIAIgAyAEIAUgABE3AAsRACABIAIgAyAEIAUgABE/AAsTACABIAIgAyAEIAUgBiAAETgACxMAIAEgAiADIAQgBSAGIAARQAALFQAgASACIAMgBCAFIAYgByAAETkACw8AIAEgAiADIAQgABFCAAsRACABIAIgAyAEIAUgABE7AAsPACABIAIgAyAEIAARRgALDQAgASACIAMgABFBAAsPACABIAIgAyAEIAAROgALDwAgASACIAMgBCAAEQgACxEAIAEgAiADIAQgBSAAET0ACxMAIAEgAiADIAQgBSAGIAARNQALEwAgASACIAMgBCAFIAYgABEgAAsTACABIAIgAyAEIAUgBiAAEV4ACxUAIAEgAiADIAQgBSAGIAcgABFUAAsVACABIAIgAyAEIAUgBiAHIAARWQALEwAgASACIAMgBCAFIAYgABFfAAsVACABIAIgAyAEIAUgBiAHIAARVwALFwAgASACIAMgBCAFIAYgByAIIAARYQALGQAgASACIAMgBCAFIAYgByAIIAkgABFaAAsNACABIAIgAyAAESQACw8AIAEgAiADIAQgABErAAsTACABIAIgAyAEIAUgBiAAES0ACxUAIAEgAiADIAQgBSAGIAcgABFRAAsPACABIAIgAyAEIAARHwALEQAgASACIAMgBCAFIAARLAALDQAgASACIAMgABEiAAsPACABIAIgAyAEIAARNgALEQAgASACIAMgBCAFIAARCgALDQAgASACIAMgABFIAAsPACABIAIgAyAEIAARRwALCQAgASAAESkACwsAIAEgAiAAESoACw8AIAEgAiADIAQgABFKAAsRACABIAIgAyAEIAUgABFLAAsTACABIAIgAyAEIAUgBiAAETMACxUAIAEgAiADIAQgBSAGIAcgABEyAAsNACABIAIgAyAAEWMACw8AIAEgAiADIAQgABE0AAsPACABIAIgAyAEIAARaAALEQAgASACIAMgBCAFIAARLgALEwAgASACIAMgBCAFIAYgABFTAAsTACABIAIgAyAEIAUgBiAAEWAACxUAIAEgAiADIAQgBSAGIAcgABFYAAsRACABIAIgAyAEIAUgABEvAAsTACABIAIgAyAEIAUgBiAAEVYACwsAIAEgAiAAEWoACw8AIAEgAiADIAQgABFbAAsRACABIAIgAyAEIAUgABFOAAsTACABIAIgAyAEIAUgBiAAEUkACxEAIAEgAiADIAQgBSAAEQYACxcAIAEgAiADIAQgBSAGIAcgCCAAEQ4ACxMAIAEgAiADIAQgBSAGIAARCQALEQAgASACIAMgBCAFIAARJwALFQAgASACIAMgBCAFIAYgByAAERQACxMAIAEgAiADIAQgBSAGIAARDQALBwAgABEHAAsZACABIAIgA60gBK1CIIaEIAUgBiAAESYACyIBAX4gASACrSADrUIghoQgBCAAERwAIgVCIIinECkgBacLGQAgASACIAMgBCAFrSAGrUIghoQgABEjAAsjACABIAIgAyAEIAWtIAatQiCGhCAHrSAIrUIghoQgABFFAAslACABIAIgAyAEIAUgBq0gB61CIIaEIAitIAmtQiCGhCAAEUQACwuWzAJWAEGACAuAElZlY3RvckludABWZWN0b3JEb3VibGUAVmVjdG9yQ2hhcgBWZWN0b3JVQ2hhcgBWZWN0b3JGbG9hdAB2ZWN0b3JUb29scwBjbGVhclZlY3RvckRibABjbGVhclZlY3RvckZsb2F0AG1heGlTZXR0aW5ncwBzZXR1cABzYW1wbGVSYXRlAGNoYW5uZWxzAGJ1ZmZlclNpemUAbWF4aU9zYwBzaW5ld2F2ZQBjb3N3YXZlAHBoYXNvcgBzYXcAdHJpYW5nbGUAc3F1YXJlAHB1bHNlAGltcHVsc2UAbm9pc2UAc2luZWJ1ZgBzaW5lYnVmNABzYXduAHBoYXNlUmVzZXQAbWF4aUVudmVsb3BlAGxpbmUAdHJpZ2dlcgBhbXBsaXR1ZGUAdmFsaW5kZXgAbWF4aURlbGF5bGluZQBkbABtYXhpRmlsdGVyAGxvcmVzAGhpcmVzAGJhbmRwYXNzAGxvcGFzcwBoaXBhc3MAY3V0b2ZmAHJlc29uYW5jZQBtYXhpTWl4AHN0ZXJlbwBxdWFkAGFtYmlzb25pYwBtYXhpTGluZQBwbGF5AHByZXBhcmUAdHJpZ2dlckVuYWJsZQBpc0xpbmVDb21wbGV0ZQBtYXhpWEZhZGUAeGZhZGUAbWF4aUxhZ0V4cABpbml0AGFkZFNhbXBsZQB2YWx1ZQBhbHBoYQBhbHBoYVJlY2lwcm9jYWwAdmFsAG1heGlTYW1wbGUAZ2V0TGVuZ3RoAHNldFNhbXBsZQBzZXRTYW1wbGVGcm9tT2dnQmxvYgBpc1JlYWR5AHBsYXlPbmNlAHBsYXlPblpYAHBsYXk0AGNsZWFyAG5vcm1hbGlzZQBhdXRvVHJpbQBsb2FkAHJlYWQAbG9vcFNldFBvc09uWlgAbWF4aU1hcABsaW5saW4AbGluZXhwAGV4cGxpbgBjbGFtcABtYXhpRHluAGdhdGUAY29tcHJlc3NvcgBjb21wcmVzcwBzZXRBdHRhY2sAc2V0UmVsZWFzZQBzZXRUaHJlc2hvbGQAc2V0UmF0aW8AbWF4aUVudgBhcgBhZHNyAHNldERlY2F5AHNldFN1c3RhaW4AY29udmVydABtdG9mAG1zVG9TYW1wcwBtYXhpU2FtcGxlQW5kSG9sZABzYWgAbWF4aURpc3RvcnRpb24AZmFzdEF0YW4AYXRhbkRpc3QAZmFzdEF0YW5EaXN0AG1heGlGbGFuZ2VyAGZsYW5nZQBtYXhpQ2hvcnVzAGNob3J1cwBtYXhpRENCbG9ja2VyAG1heGlTVkYAc2V0Q3V0b2ZmAHNldFJlc29uYW5jZQBtYXhpTWF0aABhZGQAc3ViAG11bABkaXYAZ3QAbHQAZ3RlAGx0ZQBtb2QAYWJzAHBvdwBtYXhpQ2xvY2sAdGlja2VyAHNldFRlbXBvAHNldFRpY2tzUGVyQmVhdABpc1RpY2sAY3VycmVudENvdW50AHBsYXlIZWFkAGJwcwBicG0AdGljawB0aWNrcwBtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yAHNldFBoYXNlAGdldFBoYXNlAG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQAc2V0UGhhc2VzAHNpemUAbWF4aUFzeW5jS3VyYW1vdG9Pc2NpbGxhdG9yAG1heGlGRlQAcHJvY2VzcwBzcGVjdHJhbEZsYXRuZXNzAHNwZWN0cmFsQ2VudHJvaWQAZ2V0TWFnbml0dWRlcwBnZXRNYWduaXR1ZGVzREIAZ2V0UGhhc2VzAGdldE51bUJpbnMAZ2V0RkZUU2l6ZQBnZXRIb3BTaXplAGdldFdpbmRvd1NpemUAbWF4aUZGVE1vZGVzAFdJVEhfUE9MQVJfQ09OVkVSU0lPTgBOT19QT0xBUl9DT05WRVJTSU9OAG1heGlJRkZUAG1heGlJRkZUTW9kZXMAU1BFQ1RSVU0AQ09NUExFWABtYXhpTUZDQwBtZmNjAG1heGlUaW1lU3RyZXRjaABzaGFyZWRfcHRyPG1heGlUaW1lc3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPgBnZXROb3JtYWxpc2VkUG9zaXRpb24AZ2V0UG9zaXRpb24Ac2V0UG9zaXRpb24AcGxheUF0UG9zaXRpb24AbWF4aVBpdGNoU2hpZnQAc2hhcmVkX3B0cjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPgBtYXhpU3RyZXRjaABzZXRMb29wU3RhcnQAc2V0TG9vcEVuZABnZXRMb29wRW5kAG1heGlCaXRzAHNpZwBhdABzaGwAc2hyAHIAbGFuZABsb3IAbHhvcgBuZWcAaW5jAGRlYwBlcQB0b1NpZ25hbAB0b1RyaWdTaWduYWwAZnJvbVNpZ25hbABtYXhpVHJpZ2dlcgBvblpYAG9uQ2hhbmdlZABtYXhpQ291bnRlcgBjb3VudABtYXhpSW5kZXgAcHVsbABtYXhpUmF0aW9TZXEAcGxheVRyaWcAcGxheVZhbHVlcwBhbGxvY2F0b3I8VD46OmFsbG9jYXRlKHNpemVfdCBuKSAnbicgZXhjZWVkcyBtYXhpbXVtIHN1cHBvcnRlZCBzaXplAHB1c2hfYmFjawByZXNpemUAZ2V0AHNldABOU3QzX18yNnZlY3RvcklpTlNfOWFsbG9jYXRvcklpRUVFRQBOU3QzX18yMTNfX3ZlY3Rvcl9iYXNlSWlOU185YWxsb2NhdG9ySWlFRUVFAE5TdDNfXzIyMF9fdmVjdG9yX2Jhc2VfY29tbW9uSUxiMUVFRQAAzHoAABYMAABQewAA6gsAAAAAAAABAAAAPAwAAAAAAABQewAAxgsAAAAAAAABAAAARAwAAAAAAABQTlN0M19fMjZ2ZWN0b3JJaU5TXzlhbGxvY2F0b3JJaUVFRUUAAAAArHsAAHQMAAAAAAAAXAwAAFBLTlN0M19fMjZ2ZWN0b3JJaU5TXzlhbGxvY2F0b3JJaUVFRUUAAACsewAArAwAAAEAAABcDAAAaWkAdgB2aQCcDAAA1HkAAJwMAAA0egAAdmlpaQBBkBoLUNR5AACcDAAAWHoAADR6AAB2aWlpaQAAAFh6AADUDAAAaWlpAFQNAABcDAAAWHoAAE4xMGVtc2NyaXB0ZW4zdmFsRQAAzHoAAEANAABpaWlpAEHwGgvmBOx5AABcDAAAWHoAADR6AABpaWlpaQBOU3QzX18yNnZlY3RvcklkTlNfOWFsbG9jYXRvcklkRUVFRQBOU3QzX18yMTNfX3ZlY3Rvcl9iYXNlSWROU185YWxsb2NhdG9ySWRFRUVFAAAAUHsAAKoNAAAAAAAAAQAAADwMAAAAAAAAUHsAAIYNAAAAAAAAAQAAANgNAAAAAAAAUE5TdDNfXzI2dmVjdG9ySWROU185YWxsb2NhdG9ySWRFRUVFAAAAAKx7AAAIDgAAAAAAAPANAABQS05TdDNfXzI2dmVjdG9ySWROU185YWxsb2NhdG9ySWRFRUVFAAAArHsAAEAOAAABAAAA8A0AADAOAADUeQAAMA4AAHB6AAB2aWlkAAAAANR5AAAwDgAAWHoAAHB6AAB2aWlpZAAAAFh6AABoDgAAVA0AAPANAABYegAAAAAAAOx5AADwDQAAWHoAAHB6AABpaWlpZABOU3QzX18yNnZlY3RvckljTlNfOWFsbG9jYXRvckljRUVFRQBOU3QzX18yMTNfX3ZlY3Rvcl9iYXNl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SWRFAACsewAAfCQAAAAAAAB0JAAAUEsxNm1heGlNRkNDQW5hbHlzZXJJZEUArHsAAKQkAAABAAAAdCQAAJQkAADUeQAAlCQAAEB6AABAegAAQHoAAHB6AABwegAAdmlpaWlpZGQAAAAA8A0AAJQkAADIEQAAMTVtYXhpVGltZVN0cmV0Y2hJMTRoYW5uV2luRnVuY3RvckUAzHoAAAQlAABQMTVtYXhpVGltZVN0cmV0Y2hJMTRoYW5uV2luRnVuY3RvckUAAAAArHsAADAlAAAAAAAAKCUAAFBLMTVtYXhpVGltZVN0cmV0Y2hJMTRoYW5uV2luRnVuY3RvckUAAACsewAAaCUAAAEAAAAoJQAAAAAAAFgmAAA4AgAAOQIAADoCAAA7AgAAPAIAAE5TdDNfXzIyMF9fc2hhcmVkX3B0cl9wb2ludGVySVAxNW1heGlUaW1lU3RyZXRjaEkxNGhhbm5XaW5GdW5jdG9yRU4xMGVtc2NyaXB0ZW4xNXNtYXJ0X3B0cl90cmFpdElOU18xMHNoYXJlZF9wdHJJUzNfRUVFMTF2YWxfZGVsZXRlckVOU185YWxsb2NhdG9ySVMzX0VFRUUAAPR6AAC8JQAAFHcAAE4xMGVtc2NyaXB0ZW4xNXNtYXJ0X3B0cl90cmFpdElOU3QzX18yMTBzaGFyZWRfcHRySTE1bWF4aVRpbWVTdHJldGNoSTE0aGFubldpbkZ1bmN0b3JFRUVFMTF2YWxfZGVsZXRlckUATlN0M19fMjEwc2hhcmVkX3B0ckkxNW1heGlUaW1lU3RyZXRjaEkxNGhhbm5XaW5GdW5jdG9yRUVFAAAAzHoAAMwmAABpAAAACCcAAAAAAACMJwAAPQIAAD4CAAA/AgAAQAIAAEECAABOU3QzX18yMjBfX3NoYXJlZF9wdHJfZW1wbGFjZUkxNW1heGlUaW1lU3RyZXRjaEkxNGhhbm5XaW5GdW5jdG9yRU5TXzlhbGxvY2F0b3JJUzNfRUVFRQAA9HoAADQnAAAUdwAA1HkAAFglAACkGAAAcHoAAFglAADUeQAAWCUAAHB6AAAAAAAABCgAAEICAABDAgAARAIAADltYXhpR3JhaW5JMTRoYW5uV2luRnVuY3RvckUAMTNtYXhpR3JhaW5CYXNlAAAAAMx6AADpJwAA9HoAAMwnAAD8JwAAcHoAAFglAABwegAAcHoAADR6AABwegAAZGlpZGRpZABwegAAWCUAAHB6AABwegAANHoAADE0bWF4aVBpdGNoU2hpZnRJMTRoYW5uV2luRnVuY3RvckUAAMx6AABEKAAAUDE0bWF4aVBpdGNoU2hpZnRJMTRoYW5uV2luRnVuY3RvckUArHsAAHAoAAAAAAAAaCgAAFBLMTRtYXhpUGl0Y2hTaGlmdEkxNGhhbm5XaW5GdW5jdG9yRQAAAACsewAApCgAAAEAAABoKAAAAAAAAJQpAABFAgAARgIAAEcCAABIAgAASQIAAE5TdDNfXzIyMF9fc2hhcmVkX3B0cl9wb2ludGVySVAxNG1heGlQaXRjaFNoaWZ0STE0aGFubldpbkZ1bmN0b3JFTjEwZW1zY3JpcHRlbjE1c21hcnRfcHRyX3RyYWl0SU5TXzEwc2hhcmVkX3B0cklTM19FRUUxMXZhbF9kZWxldGVyRU5TXzlhbGxvY2F0b3JJUzNfRUVFRQAAAPR6AAD4KAAAFHcAAE4xMGVtc2NyaXB0ZW4xNXNtYXJ0X3B0cl90cmFpdElOU3QzX18yMTBzaGFyZWRfcHRySTE0bWF4aVBpdGNoU2hpZnRJMTRoYW5uV2luRnVuY3RvckVFRUUxMXZhbF9kZWxldGVyRQBOU3QzX18yMTBzaGFyZWRfcHRySTE0bWF4aVBpdGNoU2hpZnRJMTRoYW5uV2luRnVuY3RvckVFRQDMegAAByoAAEAqAAAAAAAAwCoAAEoCAABLAgAATAIAAEACAABNAgAATlN0M19fMjIwX19zaGFyZWRfcHRyX2VtcGxhY2VJMTRtYXhpUGl0Y2hTaGlmdEkxNGhhbm5XaW5GdW5jdG9yRU5TXzlhbGxvY2F0b3JJUzNfRUVFRQAAAPR6AABoKgAAFHcAANR5AACUKAAApBgAQeDVAAvSAXB6AACUKAAAcHoAAHB6AAA0egAAcHoAADExbWF4aVN0cmV0Y2hJMTRoYW5uV2luRnVuY3RvckUAzHoAAPgqAABQMTFtYXhpU3RyZXRjaEkxNGhhbm5XaW5GdW5jdG9yRQAAAACsewAAICsAAAAAAAAYKwAAUEsxMW1heGlTdHJldGNoSTE0aGFubldpbkZ1bmN0b3JFAAAArHsAAFQrAAABAAAAGCsAAEQrAADUeQAARCsAAKQYAABwegAARCsAANR5AABEKwAAcHoAAFh6AABEKwBBwNcACyRwegAARCsAAHB6AABwegAAcHoAADR6AABwegAAZGlpZGRkaWQAQfDXAAviA3B6AABEKwAAcHoAAHB6AABwegAANHoAAGRpaWRkZGkAOG1heGlCaXRzAAAAzHoAABAsAABQOG1heGlCaXRzAACsewAAJCwAAAAAAAAcLAAAUEs4bWF4aUJpdHMArHsAAEAsAAABAAAAHCwAAEB6AABAegAAQHoAAEB6AABAegAAQHoAAEB6AABAegAAQHoAAEB6AABwegAAQHoAAEB6AABwegAAaWlkADExbWF4aVRyaWdnZXIAAADMegAAmCwAAFAxMW1heGlUcmlnZ2VyAACsewAAsCwAAAAAAACoLAAAUEsxMW1heGlUcmlnZ2VyAKx7AADQLAAAAQAAAKgsAADALAAAcHoAAMAsAABwegAAcHoAAMAsAABwegAAcHoAADExbWF4aUNvdW50ZXIAAADMegAAEC0AAFAxMW1heGlDb3VudGVyAACsewAAKC0AAAAAAAAgLQAAUEsxMW1heGlDb3VudGVyAKx7AABILQAAAQAAACAtAAA4LQAAAAAAAHB6AAA4LQAAcHoAAHB6AAA5bWF4aUluZGV4AADMegAAgC0AAFA5bWF4aUluZGV4AKx7AACULQAAAAAAAIwtAABQSzltYXhpSW5kZXgAAAAArHsAALAtAAABAAAAjC0AAKAtAEHg2wALcnB6AACgLQAAcHoAAHB6AADwDQAAMTJtYXhpUmF0aW9TZXEAAMx6AAD0LQAAUDEybWF4aVJhdGlvU2VxAKx7AAAMLgAAAAAAAAQuAABQSzEybWF4aVJhdGlvU2VxAAAAAKx7AAAsLgAAAQAAAAQuAAAcLgBB4NwAC8EFcHoAABwuAABwegAA8A0AAHB6AAAcLgAAcHoAAPANAADwDQAAZGlpZGlpAApjaGFubmVscyA9ICVkCmxlbmd0aCA9ICVkAExvYWRpbmc6IABkYXRhAENoOiAALCBsZW46IABFUlJPUjogQ291bGQgbm90IGxvYWQgc2FtcGxlLgBBdXRvdHJpbTogc3RhcnQ6IAAsIGVuZDogAAAAbAAAAAAAAACMLwAATwIAAFACAACU////lP///4wvAABRAgAAUgIAAAgvAABALwAAVC8AABwvAABs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M19fMjE1YmFzaWNfc3RyZWFtYnVmSXdOU18xMWNoYXJfdHJhaXRzSXdFRUVFAAAAAMx6AAAISQAATlN0M19fMjEzYmFzaWNfaXN0cmVhbUljTlNfMTFjaGFyX3RyYWl0c0ljRUVFRQAAUHsAAERJAAAAAAAAAQAAAHhIAAAD9P//TlN0M19fMjEzYmFzaWNfaXN0cmVhbUl3TlNfMTFjaGFyX3RyYWl0c0l3RUVFRQAAUHsAAIxJAAAAAAAAAQAAAMBIAAAD9P//TlN0M19fMjEzYmFzaWNfb3N0cmVhbUljTlNfMTFjaGFyX3RyYWl0c0ljRUVFRQAAUHsAANRJAAAAAAAAAQAAAHhIAAAD9P//TlN0M19fMjEzYmFzaWNfb3N0cmVhbUl3TlNfMTFjaGFyX3RyYWl0c0l3RUVFRQAAUHsAABxKAAAAAAAAAQAAAMBIAAAD9P//mLcAAAAAAADASgAAcAIAAJsCAACcAgAAcwIAAHQCAAB1AgAAdgIAAF4CAABfAgAAnQIAAJ4CAACfAgAAYwIAAHkCAABOU3QzX18yMTBfX3N0ZGluYnVmSWNFRQD0egAAqEoAAABJAAB1bnN1cHBvcnRlZCBsb2NhbGUgZm9yIHN0YW5kYXJkIGlucHV0AAAAAAAAAExLAAB6AgAAoAIAAKECAAB9AgAAfgIAAH8CAACAAgAAgQIAAIICAACiAgAAowIAAKQCAACGAgAAhwIAAE5TdDNfXzIxMF9fc3RkaW5idWZJd0VFAPR6AAA0SwAAPEkAAAAAAAC0SwAAcAIAAKUCAACmAgAAcwIAAHQCAAB1AgAApwIAAF4CAABfAgAAdwIAAGECAAB4AgAAqAIAAKkCAABOU3QzX18yMTFfX3N0ZG91dGJ1ZkljRUUAAAAA9HoAAJhLAAAASQAAAAAAABxMAAB6AgAAqgIAAKsCAAB9AgAAfgIAAH8CAACsAgAAgQIAAIICAACDAgAAhAIAAIUCAACtAgAArgIAAE5TdDNfXzIxMV9fc3Rkb3V0YnVmSXdFRQAAAAD0egAAAEwAADxJAEGwmAEL4wT/////////////////////////////////////////////////////////////////AAECAwQFBgcICf////////8KCwwNDg8QERITFBUWFxgZGhscHR4fICEiI////////woLDA0ODxAREhMUFRYXGBkaGxwdHh8gISIj/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////wABAgQHAwYFAAAAAAAAAAIAAMADAADABAAAwAUAAMAGAADABwAAwAgAAMAJAADACgAAwAsAAMAMAADADQAAwA4AAMAPAADAEAAAwBEAAMASAADAEwAAwBQAAMAVAADAFgAAwBcAAMAYAADAGQAAwBoAAMAbAADAHAAAwB0AAMAeAADAHwAAwAAAALMBAADDAgAAwwMAAMMEAADDBQAAwwYAAMMHAADDCAAAwwkAAMMKAADDCwAAwwwAAMMNAADTDgAAww8AAMMAAAy7AQAMwwIADMMDAAzDBAAM02luZmluaXR5AG5hbgAAAAAAAAAA0XSeAFedvSqAcFIP//8+JwoAAABkAAAA6AMAABAnAACghgEAQEIPAICWmAAA4fUFGAAAADUAAABxAAAAa////877//+Sv///AAAAAAAAAADeEgSVAAAAAP///////////////3BOAAAUAAAAQy5VVEYtOABBuJ0BCwKETgBB0J0BCwZMQ19BTEwAQeCdAQtuTENfQ1RZUEUAAAAATENfTlVNRVJJQwAATENfVElNRQAAAAAATENfQ09MTEFURQAATENfTU9ORVRBUlkATENfTUVTU0FHRVMATEFORwBDLlVURi04AFBPU0lYAE1VU0xfTE9DUEFUSAAAAAAAUFAAQdCgAQv/AQIAAgACAAIAAgACAAIAAgACAAMgAiACIAIgAiACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgABYATABMAEwATABMAEwATABMAEwATABMAEwATABMAEwAjYCNgI2AjYCNgI2AjYCNgI2AjYBMAEwATABMAEwATABMAI1QjVCNUI1QjVCNUIxQjFCMUIxQjFCMUIxQjFCMUIxQjFCMUIxQjFCMUIxQjFCMUIxQjFBMAEwATABMAEwATACNYI1gjWCNYI1gjWCMYIxgjGCMYIxgjGCMYIxgjGCMYIxgjGCMYIxgjGCMYI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AACIeQAAAHoAAGEAAACIeQAADHoAAHMAAACIeQAAGHoAAHQAAACIeQAAJHoAAGkAAACIeQAAMHoAAGoAAACIeQAAPHoAAGwAAACIeQAASHoAAG0AAACIeQAAVHoAAGYAAACIeQAAYHoAAGQAAACIeQAAbHoAAAAAAAC4egAAsAMAALUDAACyAwAAswMAALYDAABOMTBfX2N4eGFiaXYxMTZfX2VudW1fdHlwZV9pbmZvRQAAAAD0egAAlHoAAHR4AAAAAAAApHgAALADAAC3AwAAsgMAALMDAAC4AwAAuQMAALoDAAC7AwAAAAAAADx7AACwAwAAvAMAALIDAACzAwAAuAMAAL0DAAC+AwAAvwMAAE4xMF9fY3h4YWJpdjEyMF9fc2lfY2xhc3NfdHlwZV9pbmZvRQAAAAD0egAAFHsAAKR4AAAAAAAAmHsAALADAADAAwAAsgMAALMDAAC4AwAAwQMAAMIDAADDAwAATjEwX19jeHhhYml2MTIxX192bWlfY2xhc3NfdHlwZV9pbmZvRQAAAPR6AABwewAApHgAAAAAAAAEeQAAsAMAAMQDAACyAwAAswMAAMUDAAB2b2lkAGJvb2wAY2hhcgBzaWduZWQgY2hhcgB1bnNpZ25lZCBjaGFyAHNob3J0AHVuc2lnbmVkIHNob3J0AGludAB1bnNpZ25lZCBpbnQAbG9uZwB1bnNpZ25lZCBsb25nAGZsb2F0AGRvdWJsZQBzdGQ6OnN0cmluZwBzdGQ6OmJhc2ljX3N0cmluZzx1bnNpZ25lZCBjaGFyPgBzdGQ6OndzdHJpbmcAc3RkOjp1MTZzdHJpbmcAc3RkOjp1MzJzdHJpbmcAZW1zY3JpcHRlbjo6dmFsAGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PGNoYXI+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHNpZ25lZCBjaGFyPgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzx1bnNpZ25lZCBjaGFyPgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxzaG9ydD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8dW5zaWduZWQgc2hvcnQ+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PGludD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8dW5zaWduZWQgaW50PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxsb25nPgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzx1bnNpZ25lZCBsb25nPgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxpbnQ4X3Q+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHVpbnQ4X3Q+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PGludDE2X3Q+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHVpbnQxNl90PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxpbnQzMl90PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzx1aW50MzJfdD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8ZmxvYXQ+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PGRvdWJsZT4ATlN0M19fMjEyYmFzaWNfc3RyaW5nSWhOU18xMWNoYXJfdHJhaXRzSWhFRU5TXzlhbGxvY2F0b3JJaEVFRUUAAAAAUHsAANZ+AAAAAAAAAQAAAPgZAAAAAAAATlN0M19fMjEyYmFzaWNfc3RyaW5nSXdOU18xMWNoYXJfdHJhaXRzSXdFRU5TXzlhbGxvY2F0b3JJd0VFRUUAAFB7AAAwfwAAAAAAAAEAAAD4GQAAAAAAAE5TdDNfXzIxMmJhc2ljX3N0cmluZ0lEc05TXzExY2hhcl90cmFpdHNJRHNFRU5TXzlhbGxvY2F0b3JJRHNFRUVFAAAAUHsAAIh/AAAAAAAAAQAAAPgZAAAAAAAATlN0M19fMjEyYmFzaWNfc3RyaW5nSURpTlNfMTFjaGFyX3RyYWl0c0lEaUVFTlNfOWFsbG9jYXRvcklEaUVFRUUAAABQewAA5H8AAAAAAAABAAAA+BkAAAAAAABOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0ljRUUAAMx6AABAgAAATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJYUVFAADMegAAaIAAAE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SWhFRQAAzHoAAJCAAABOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0lzRUUAAMx6AAC4gAAATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJdEVFAADMegAA4IAAAE4x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AgsOaAIAAG4CAACovAAAAAQAQbzuAgsBAQBBy+4CCwUK/////wBBke8CCwi3AAAAAAAACQBBpO8CCwJnAgBBuO8CCxJvAgAAAAAAAGkCAAC4wAAAAAQAQeTvAgsE/////wDNpAgEbmFtZQHEpAirCgAWX2VtYmluZF9yZWdpc3Rlcl9jbGFzcwEiX2VtYmluZF9yZWdpc3Rlcl9jbGFzc19jb25zdHJ1Y3RvcgIlX2VtYmluZF9yZWdpc3Rlcl9jbGFzc19jbGFzc19mdW5jdGlvbgMfX2VtYmluZF9yZWdpc3Rlcl9jbGFzc19wcm9wZXJ0eQQfX2VtYmluZF9yZWdpc3Rlcl9jbGFzc19mdW5jdGlvbgUVX2VtYmluZF9yZWdpc3Rlcl9lbnVtBhtfZW1iaW5kX3JlZ2lzdGVyX2VudW1fdmFsdWUHGl9lbWJpbmRfcmVnaXN0ZXJfc21hcnRfcHRyCBhfX2N4YV9hbGxvY2F0ZV9leGNlcHRpb24JC19fY3hhX3Rocm93ChFfZW12YWxfdGFrZV92YWx1ZQsNX2VtdmFsX2luY3JlZgwNX2VtdmFsX2RlY3JlZg0LX2VtdmFsX2NhbGwOBXJvdW5kDwRleGl0EA1fX2Fzc2VydF9mYWlsEQZfX2xvY2sSCF9fdW5sb2NrEw9fX3dhc2lfZmRfY2xvc2UUCl9fc3lzY2FsbDUVDF9fc3lzY2FsbDIyMRYLX19zeXNjYWxsNTQXDl9fd2FzaV9mZF9yZWFkGA9fX3dhc2lfZmRfd3JpdGUZGF9fd2FzaV9lbnZpcm9uX3NpemVzX2dldBoSX193YXNpX2Vudmlyb25fZ2V0GwpfX21hcF9maWxlHAtfX3N5c2NhbGw5MR0Kc3RyZnRpbWVfbB4FYWJvcnQfFV9lbWJpbmRfcmVnaXN0ZXJfdm9pZCAVX2VtYmluZF9yZWdpc3Rlcl9ib29sIRtfZW1iaW5kX3JlZ2lzdGVyX3N0ZF9zdHJpbmciHF9lbWJpbmRfcmVnaXN0ZXJfc3RkX3dzdHJpbmcjFl9lbWJpbmRfcmVnaXN0ZXJfZW12YWwkGF9lbWJpbmRfcmVnaXN0ZXJfaW50ZWdlciUWX2VtYmluZF9yZWdpc3Rlcl9mbG9hdCYcX2VtYmluZF9yZWdpc3Rlcl9tZW1vcnlfdmlldycWZW1zY3JpcHRlbl9yZXNpemVfaGVhcCgVZW1zY3JpcHRlbl9tZW1jcHlfYmlnKQtzZXRUZW1wUmV0MCoabGVnYWxpbXBvcnQkX193YXNpX2ZkX3NlZWsrEV9fd2FzbV9jYWxsX2N0b3JzLFBFbXNjcmlwdGVuQmluZGluZ0luaXRpYWxpemVyX215X21vZHVsZTo6RW1zY3JpcHRlbkJpbmRpbmdJbml0aWFsaXplcl9teV9tb2R1bGUoKS2VAWVtc2NyaXB0ZW46OmNsYXNzXzxzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4sIGVtc2NyaXB0ZW46OmludGVybmFsOjpOb0Jhc2VDbGFzcz4gZW1zY3JpcHRlbjo6cmVnaXN0ZXJfdmVjdG9yPGludD4oY2hhciBjb25zdCopLp4BZW1zY3JpcHRlbjo6Y2xhc3NfPHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiwgZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok5vQmFzZUNsYXNzPiBlbXNjcmlwdGVuOjpyZWdpc3Rlcl92ZWN0b3I8ZG91YmxlPihjaGFyIGNvbnN0KikvmAFlbXNjcmlwdGVuOjpjbGFzc188c3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4sIGVtc2NyaXB0ZW46OmludGVybmFsOjpOb0Jhc2VDbGFzcz4gZW1zY3JpcHRlbjo6cmVnaXN0ZXJfdmVjdG9yPGNoYXI+KGNoYXIgY29uc3QqKTCzAWVtc2NyaXB0ZW46OmNsYXNzXzxzdGQ6Ol9fMjo6dmVjdG9yPHVuc2lnbmVkIGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8dW5zaWduZWQgY2hhcj4gPiwgZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok5vQmFzZUNsYXNzPiBlbXNjcmlwdGVuOjpyZWdpc3Rlcl92ZWN0b3I8dW5zaWduZWQgY2hhcj4oY2hhciBjb25zdCopMZsBZW1zY3JpcHRlbjo6Y2xhc3NfPHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4sIGVtc2NyaXB0ZW46OmludGVybmFsOjpOb0Jhc2VDbGFzcz4gZW1zY3JpcHRlbjo6cmVnaXN0ZXJfdmVjdG9yPGZsb2F0PihjaGFyIGNvbnN0KikySnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPHZlY3RvclRvb2xzPih2ZWN0b3JUb29scyopM0R2b2lkIGVtc2NyaXB0ZW46OmludGVybmFsOjpyYXdfZGVzdHJ1Y3Rvcjx2ZWN0b3JUb29scz4odmVjdG9yVG9vbHMqKTRHZW1zY3JpcHRlbjo6aW50ZXJuYWw6Okludm9rZXI8dmVjdG9yVG9vbHMqPjo6aW52b2tlKHZlY3RvclRvb2xzKiAoKikoKSk1PnZlY3RvclRvb2xzKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PHZlY3RvclRvb2xzPigpNuABZW1zY3JpcHRlbjo6aW50ZXJuYWw6Okludm9rZXI8dm9pZCwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+Jj46Omludm9rZSh2b2lkICgqKShzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mKSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+Kik3VHZlY3RvclRvb2xzOjpjbGVhclZlY3RvckRibChzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mKThMdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aVNldHRpbmdzPihtYXhpU2V0dGluZ3MqKTliZW1zY3JpcHRlbjo6aW50ZXJuYWw6Okludm9rZXI8dm9pZCwgaW50LCBpbnQsIGludD46Omludm9rZSh2b2lkICgqKShpbnQsIGludCwgaW50KSwgaW50LCBpbnQsIGludCk6Im1heGlTZXR0aW5nczo6c2V0dXAoaW50LCBpbnQsIGludCk7I21heGlTZXR0aW5nczo6Z2V0U2FtcGxlUmF0ZSgpIGNvbnN0PCBtYXhpU2V0dGluZ3M6OnNldFNhbXBsZVJhdGUoaW50KT2TAWludCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6R2V0dGVyUG9saWN5PGludCAobWF4aVNldHRpbmdzOjoqKSgpIGNvbnN0Pjo6Z2V0PG1heGlTZXR0aW5ncz4oaW50IChtYXhpU2V0dGluZ3M6OiogY29uc3QmKSgpIGNvbnN0LCBtYXhpU2V0dGluZ3MgY29uc3QmKT6PAXZvaWQgZW1zY3JpcHRlbjo6aW50ZXJuYWw6OlNldHRlclBvbGljeTx2b2lkIChtYXhpU2V0dGluZ3M6OiopKGludCk+OjpzZXQ8bWF4aVNldHRpbmdzPih2b2lkIChtYXhpU2V0dGluZ3M6OiogY29uc3QmKShpbnQpLCBtYXhpU2V0dGluZ3MmLCBpbnQpPyRtYXhpU2V0dGluZ3M6OmdldE51bUNoYW5uZWxzKCkgY29uc3RAIW1heGlTZXR0aW5nczo6c2V0TnVtQ2hhbm5lbHMoaW50KUEjbWF4aVNldHRpbmdzOjpnZXRCdWZmZXJTaXplKCkgY29uc3RCIG1heGlTZXR0aW5nczo6c2V0QnVmZmVyU2l6ZShpbnQpQ0J2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpT3NjPihtYXhpT3NjKilENm1heGlPc2MqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aU9zYz4oKUWYAWVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aU9zYzo6KikoZG91YmxlKSwgZG91YmxlLCBtYXhpT3NjKiwgZG91YmxlPjo6aW52b2tlKGRvdWJsZSAobWF4aU9zYzo6KiBjb25zdCYpKGRvdWJsZSksIG1heGlPc2MqLCBkb3VibGUpRtgBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpT3NjOjoqKShkb3VibGUsIGRvdWJsZSwgZG91YmxlKSwgZG91YmxlLCBtYXhpT3NjKiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZT46Omludm9rZShkb3VibGUgKG1heGlPc2M6OiogY29uc3QmKShkb3VibGUsIGRvdWJsZSwgZG91YmxlKSwgbWF4aU9zYyosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUpR7gBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpT3NjOjoqKShkb3VibGUsIGRvdWJsZSksIGRvdWJsZSwgbWF4aU9zYyosIGRvdWJsZSwgZG91YmxlPjo6aW52b2tlKGRvdWJsZSAobWF4aU9zYzo6KiBjb25zdCYpKGRvdWJsZSwgZG91YmxlKSwgbWF4aU9zYyosIGRvdWJsZSwgZG91YmxlKUh8ZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpT3NjOjoqKSgpLCBkb3VibGUsIG1heGlPc2MqPjo6aW52b2tlKGRvdWJsZSAobWF4aU9zYzo6KiBjb25zdCYpKCksIG1heGlPc2MqKUmSAWVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKG1heGlPc2M6OiopKGRvdWJsZSksIHZvaWQsIG1heGlPc2MqLCBkb3VibGU+OjppbnZva2Uodm9pZCAobWF4aU9zYzo6KiBjb25zdCYpKGRvdWJsZSksIG1heGlPc2MqLCBkb3VibGUpSkx2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpRW52ZWxvcGU+KG1heGlFbnZlbG9wZSopS0BtYXhpRW52ZWxvcGUqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aUVudmVsb3BlPigpTIQDZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpRW52ZWxvcGU6OiopKGludCwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiksIGRvdWJsZSwgbWF4aUVudmVsb3BlKiwgaW50LCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mPjo6aW52b2tlKGRvdWJsZSAobWF4aUVudmVsb3BlOjoqIGNvbnN0JikoaW50LCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mKSwgbWF4aUVudmVsb3BlKiwgaW50LCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4qKU26AWVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKG1heGlFbnZlbG9wZTo6KikoaW50LCBkb3VibGUpLCB2b2lkLCBtYXhpRW52ZWxvcGUqLCBpbnQsIGRvdWJsZT46Omludm9rZSh2b2lkIChtYXhpRW52ZWxvcGU6OiogY29uc3QmKShpbnQsIGRvdWJsZSksIG1heGlFbnZlbG9wZSosIGludCwgZG91YmxlKU4ibWF4aUVudmVsb3BlOjpnZXRBbXBsaXR1ZGUoKSBjb25zdE8ibWF4aUVudmVsb3BlOjpzZXRBbXBsaXR1ZGUoZG91YmxlKVAhbWF4aUVudmVsb3BlOjpnZXRWYWxpbmRleCgpIGNvbnN0UR5tYXhpRW52ZWxvcGU6OnNldFZhbGluZGV4KGludClSTnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlEZWxheWxpbmU+KG1heGlEZWxheWxpbmUqKVNCbWF4aURlbGF5bGluZSogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpRGVsYXlsaW5lPigpVOQBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpRGVsYXlsaW5lOjoqKShkb3VibGUsIGludCwgZG91YmxlKSwgZG91YmxlLCBtYXhpRGVsYXlsaW5lKiwgZG91YmxlLCBpbnQsIGRvdWJsZT46Omludm9rZShkb3VibGUgKG1heGlEZWxheWxpbmU6OiogY29uc3QmKShkb3VibGUsIGludCwgZG91YmxlKSwgbWF4aURlbGF5bGluZSosIGRvdWJsZSwgaW50LCBkb3VibGUpVfgBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpRGVsYXlsaW5lOjoqKShkb3VibGUsIGludCwgZG91YmxlLCBpbnQpLCBkb3VibGUsIG1heGlEZWxheWxpbmUqLCBkb3VibGUsIGludCwgZG91YmxlLCBpbnQ+OjppbnZva2UoZG91YmxlIChtYXhpRGVsYXlsaW5lOjoqIGNvbnN0JikoZG91YmxlLCBpbnQsIGRvdWJsZSwgaW50KSwgbWF4aURlbGF5bGluZSosIGRvdWJsZSwgaW50LCBkb3VibGUsIGludClWSHZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlGaWx0ZXI+KG1heGlGaWx0ZXIqKVc8bWF4aUZpbHRlciogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpRmlsdGVyPigpWB1tYXhpRmlsdGVyOjpnZXRDdXRvZmYoKSBjb25zdFkdbWF4aUZpbHRlcjo6c2V0Q3V0b2ZmKGRvdWJsZSlaIG1heGlGaWx0ZXI6OmdldFJlc29uYW5jZSgpIGNvbnN0WyBtYXhpRmlsdGVyOjpzZXRSZXNvbmFuY2UoZG91YmxlKVxCdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aU1peD4obWF4aU1peCopXTZtYXhpTWl4KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlNaXg+KClelgNlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChtYXhpTWl4OjoqKShkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGRvdWJsZSksIHZvaWQsIG1heGlNaXgqLCBkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGRvdWJsZT46Omludm9rZSh2b2lkIChtYXhpTWl4OjoqIGNvbnN0JikoZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBkb3VibGUpLCBtYXhpTWl4KiwgZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4qLCBkb3VibGUpX7YDZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAobWF4aU1peDo6KikoZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBkb3VibGUsIGRvdWJsZSksIHZvaWQsIG1heGlNaXgqLCBkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGRvdWJsZSwgZG91YmxlPjo6aW52b2tlKHZvaWQgKG1heGlNaXg6OiogY29uc3QmKShkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGRvdWJsZSwgZG91YmxlKSwgbWF4aU1peCosIGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KiwgZG91YmxlLCBkb3VibGUpYNYDZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAobWF4aU1peDo6KikoZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKSwgdm9pZCwgbWF4aU1peCosIGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZT46Omludm9rZSh2b2lkIChtYXhpTWl4OjoqIGNvbnN0JikoZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKSwgbWF4aU1peCosIGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSlhRHZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlMaW5lPihtYXhpTGluZSopYjhtYXhpTGluZSogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpTGluZT4oKWMWbWF4aUxpbmU6OnBsYXkoZG91YmxlKWQpbWF4aUxpbmU6OnByZXBhcmUoZG91YmxlLCBkb3VibGUsIGRvdWJsZSll1gFlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChtYXhpTGluZTo6KikoZG91YmxlLCBkb3VibGUsIGRvdWJsZSksIHZvaWQsIG1heGlMaW5lKiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZT46Omludm9rZSh2b2lkIChtYXhpTGluZTo6KiBjb25zdCYpKGRvdWJsZSwgZG91YmxlLCBkb3VibGUpLCBtYXhpTGluZSosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUpZh9tYXhpTGluZTo6dHJpZ2dlckVuYWJsZShkb3VibGUpZxptYXhpTGluZTo6aXNMaW5lQ29tcGxldGUoKWhGdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aVhGYWRlPihtYXhpWEZhZGUqKWmHBGVtc2NyaXB0ZW46OmludGVybmFsOjpJbnZva2VyPHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+Jiwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgZG91YmxlPjo6aW52b2tlKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiAoKikoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+Jiwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgZG91YmxlKSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+Kiwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KiwgZG91YmxlKWqKAW1heGlYRmFkZTo6eGZhZGUoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+Jiwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgZG91YmxlKWuBAWVtc2NyaXB0ZW46OmludGVybmFsOjpJbnZva2VyPGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZT46Omludm9rZShkb3VibGUgKCopKGRvdWJsZSwgZG91YmxlLCBkb3VibGUpLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKWwobWF4aVhGYWRlOjp4ZmFkZShkb3VibGUsIGRvdWJsZSwgZG91YmxlKW1Zdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aUxhZ0V4cDxkb3VibGU+ID4obWF4aUxhZ0V4cDxkb3VibGU+KiluTW1heGlMYWdFeHA8ZG91YmxlPiogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpTGFnRXhwPGRvdWJsZT4gPigpbyhtYXhpTGFnRXhwPGRvdWJsZT46OmluaXQoZG91YmxlLCBkb3VibGUpcN4BZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAobWF4aUxhZ0V4cDxkb3VibGU+OjoqKShkb3VibGUsIGRvdWJsZSksIHZvaWQsIG1heGlMYWdFeHA8ZG91YmxlPiosIGRvdWJsZSwgZG91YmxlPjo6aW52b2tlKHZvaWQgKG1heGlMYWdFeHA8ZG91YmxlPjo6KiBjb25zdCYpKGRvdWJsZSwgZG91YmxlKSwgbWF4aUxhZ0V4cDxkb3VibGU+KiwgZG91YmxlLCBkb3VibGUpcSVtYXhpTGFnRXhwPGRvdWJsZT46OmFkZFNhbXBsZShkb3VibGUpciFtYXhpTGFnRXhwPGRvdWJsZT46OnZhbHVlKCkgY29uc3RzJG1heGlMYWdFeHA8ZG91YmxlPjo6Z2V0QWxwaGEoKSBjb25zdHQkbWF4aUxhZ0V4cDxkb3VibGU+OjpzZXRBbHBoYShkb3VibGUpdS5tYXhpTGFnRXhwPGRvdWJsZT46OmdldEFscGhhUmVjaXByb2NhbCgpIGNvbnN0di5tYXhpTGFnRXhwPGRvdWJsZT46OnNldEFscGhhUmVjaXByb2NhbChkb3VibGUpdyJtYXhpTGFnRXhwPGRvdWJsZT46OnNldFZhbChkb3VibGUpeEh2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpU2FtcGxlPihtYXhpU2FtcGxlKil5QnZvaWQgZW1zY3JpcHRlbjo6aW50ZXJuYWw6OnJhd19kZXN0cnVjdG9yPG1heGlTYW1wbGU+KG1heGlTYW1wbGUqKXo8bWF4aVNhbXBsZSogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpU2FtcGxlPigpex1tYXhpU2FtcGxlOjpnZXRMZW5ndGgoKSBjb25zdHz2AmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKG1heGlTYW1wbGU6OiopKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGludCksIHZvaWQsIG1heGlTYW1wbGUqLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBpbnQ+OjppbnZva2Uodm9pZCAobWF4aVNhbXBsZTo6KiBjb25zdCYpKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGludCksIG1heGlTYW1wbGUqLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4qLCBpbnQpfasDZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8aW50IChtYXhpU2FtcGxlOjoqKShzdGQ6Ol9fMjo6dmVjdG9yPHVuc2lnbmVkIGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8dW5zaWduZWQgY2hhcj4gPiYsIGludCksIGludCwgbWF4aVNhbXBsZSosIHN0ZDo6X18yOjp2ZWN0b3I8dW5zaWduZWQgY2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjx1bnNpZ25lZCBjaGFyPiA+JiwgaW50Pjo6aW52b2tlKGludCAobWF4aVNhbXBsZTo6KiBjb25zdCYpKHN0ZDo6X18yOjp2ZWN0b3I8dW5zaWduZWQgY2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjx1bnNpZ25lZCBjaGFyPiA+JiwgaW50KSwgbWF4aVNhbXBsZSosIHN0ZDo6X18yOjp2ZWN0b3I8dW5zaWduZWQgY2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjx1bnNpZ25lZCBjaGFyPiA+KiwgaW50KX6CAWVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKG1heGlTYW1wbGU6OiopKCksIHZvaWQsIG1heGlTYW1wbGUqPjo6aW52b2tlKHZvaWQgKG1heGlTYW1wbGU6OiogY29uc3QmKSgpLCBtYXhpU2FtcGxlKil/E21heGlTYW1wbGU6OmNsZWFyKCmAAeYBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAobWF4aVNhbXBsZTo6KikoZmxvYXQsIGZsb2F0LCBib29sLCBib29sKSwgdm9pZCwgbWF4aVNhbXBsZSosIGZsb2F0LCBmbG9hdCwgYm9vbCwgYm9vbD46Omludm9rZSh2b2lkIChtYXhpU2FtcGxlOjoqIGNvbnN0JikoZmxvYXQsIGZsb2F0LCBib29sLCBib29sKSwgbWF4aVNhbXBsZSosIGZsb2F0LCBmbG9hdCwgYm9vbCwgYm9vbCmBAaMEZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8Ym9vbCAobWF4aVNhbXBsZTo6Kikoc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiwgaW50KSwgYm9vbCwgbWF4aVNhbXBsZSosIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4sIGludD46Omludm9rZShib29sIChtYXhpU2FtcGxlOjoqIGNvbnN0Jikoc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiwgaW50KSwgbWF4aVNhbXBsZSosIGVtc2NyaXB0ZW46OmludGVybmFsOjpCaW5kaW5nVHlwZTxzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+LCB2b2lkPjo6J3VubmFtZWQnKiwgaW50KYIBQnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlNYXA+KG1heGlNYXAqKYMBN21heGlNYXA6Omxpbmxpbihkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSmEAe4BZW1zY3JpcHRlbjo6aW50ZXJuYWw6OkZ1bmN0aW9uSW52b2tlcjxkb3VibGUgKCopKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZT46Omludm9rZShkb3VibGUgKCoqKShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSksIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKYUBN21heGlNYXA6OmxpbmV4cChkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSmGATdtYXhpTWFwOjpleHBsaW4oZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUphwE1ZG91YmxlIG1heGlNYXA6OmNsYW1wPGRvdWJsZT4oZG91YmxlLCBkb3VibGUsIGRvdWJsZSmIAa4BZW1zY3JpcHRlbjo6aW50ZXJuYWw6OkZ1bmN0aW9uSW52b2tlcjxkb3VibGUgKCopKGRvdWJsZSwgZG91YmxlLCBkb3VibGUpLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGU+OjppbnZva2UoZG91YmxlICgqKikoZG91YmxlLCBkb3VibGUsIGRvdWJsZSksIGRvdWJsZSwgZG91YmxlLCBkb3VibGUpiQGxAWVtc2NyaXB0ZW46OmludGVybmFsOjpJbnZva2VyPGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGU+OjppbnZva2UoZG91YmxlICgqKShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSksIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKYoBQnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlEeW4+KG1heGlEeW4qKYsBNm1heGlEeW4qIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aUR5bj4oKYwBkAJlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlEeW46OiopKGRvdWJsZSwgZG91YmxlLCBsb25nLCBkb3VibGUsIGRvdWJsZSksIGRvdWJsZSwgbWF4aUR5biosIGRvdWJsZSwgZG91YmxlLCBsb25nLCBkb3VibGUsIGRvdWJsZT46Omludm9rZShkb3VibGUgKG1heGlEeW46OiogY29uc3QmKShkb3VibGUsIGRvdWJsZSwgbG9uZywgZG91YmxlLCBkb3VibGUpLCBtYXhpRHluKiwgZG91YmxlLCBkb3VibGUsIGxvbmcsIGRvdWJsZSwgZG91YmxlKY0BmAJlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlEeW46OiopKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKSwgZG91YmxlLCBtYXhpRHluKiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGU+OjppbnZva2UoZG91YmxlIChtYXhpRHluOjoqIGNvbnN0JikoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUpLCBtYXhpRHluKiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUpjgFCdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aUVudj4obWF4aUVudiopjwE2bWF4aUVudiogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpRW52PigpkAGEAmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aUVudjo6KikoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgbG9uZywgaW50KSwgZG91YmxlLCBtYXhpRW52KiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgbG9uZywgaW50Pjo6aW52b2tlKGRvdWJsZSAobWF4aUVudjo6KiBjb25zdCYpKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGxvbmcsIGludCksIG1heGlFbnYqLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBsb25nLCBpbnQpkQHEAmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aUVudjo6KikoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGxvbmcsIGludCksIGRvdWJsZSwgbWF4aUVudiosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBsb25nLCBpbnQ+OjppbnZva2UoZG91YmxlIChtYXhpRW52OjoqIGNvbnN0JikoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGxvbmcsIGludCksIG1heGlFbnYqLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgbG9uZywgaW50KZIBrAFlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlFbnY6OiopKGRvdWJsZSwgaW50KSwgZG91YmxlLCBtYXhpRW52KiwgZG91YmxlLCBpbnQ+OjppbnZva2UoZG91YmxlIChtYXhpRW52OjoqIGNvbnN0JikoZG91YmxlLCBpbnQpLCBtYXhpRW52KiwgZG91YmxlLCBpbnQpkwEbbWF4aUVudjo6Z2V0VHJpZ2dlcigpIGNvbnN0lAEYbWF4aUVudjo6c2V0VHJpZ2dlcihpbnQplQFCdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8Y29udmVydD4oY29udmVydCoplgFiZW1zY3JpcHRlbjo6aW50ZXJuYWw6OkZ1bmN0aW9uSW52b2tlcjxkb3VibGUgKCopKGludCksIGRvdWJsZSwgaW50Pjo6aW52b2tlKGRvdWJsZSAoKiopKGludCksIGludCmXAUhlbXNjcmlwdGVuOjppbnRlcm5hbDo6SW52b2tlcjxkb3VibGUsIGludD46Omludm9rZShkb3VibGUgKCopKGludCksIGludCmYARpjb252ZXJ0Ojptc1RvU2FtcHMoZG91YmxlKZkBbmVtc2NyaXB0ZW46OmludGVybmFsOjpGdW5jdGlvbkludm9rZXI8ZG91YmxlICgqKShkb3VibGUpLCBkb3VibGUsIGRvdWJsZT46Omludm9rZShkb3VibGUgKCoqKShkb3VibGUpLCBkb3VibGUpmgFRZW1zY3JpcHRlbjo6aW50ZXJuYWw6Okludm9rZXI8ZG91YmxlLCBkb3VibGU+OjppbnZva2UoZG91YmxlICgqKShkb3VibGUpLCBkb3VibGUpmwFWdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aVNhbXBsZUFuZEhvbGQ+KG1heGlTYW1wbGVBbmRIb2xkKimcAUptYXhpU2FtcGxlQW5kSG9sZCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpU2FtcGxlQW5kSG9sZD4oKZ0BJm1heGlTYW1wbGVBbmRIb2xkOjpzYWgoZG91YmxlLCBkb3VibGUpngFQdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aURpc3RvcnRpb24+KG1heGlEaXN0b3J0aW9uKimfASBtYXhpRGlzdG9ydGlvbjo6ZmFzdGF0YW4oZG91YmxlKaABKG1heGlEaXN0b3J0aW9uOjphdGFuRGlzdChkb3VibGUsIGRvdWJsZSmhASxtYXhpRGlzdG9ydGlvbjo6ZmFzdEF0YW5EaXN0KGRvdWJsZSwgZG91YmxlKaIBSnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlGbGFuZ2VyPihtYXhpRmxhbmdlciopowE+bWF4aUZsYW5nZXIqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aUZsYW5nZXI+KCmkAUFtYXhpRmxhbmdlcjo6ZmxhbmdlKGRvdWJsZSwgdW5zaWduZWQgaW50LCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKaUBwAJlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlGbGFuZ2VyOjoqKShkb3VibGUsIHVuc2lnbmVkIGludCwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSksIGRvdWJsZSwgbWF4aUZsYW5nZXIqLCBkb3VibGUsIHVuc2lnbmVkIGludCwgZG91YmxlLCBkb3VibGUsIGRvdWJsZT46Omludm9rZShkb3VibGUgKG1heGlGbGFuZ2VyOjoqIGNvbnN0JikoZG91YmxlLCB1bnNpZ25lZCBpbnQsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUpLCBtYXhpRmxhbmdlciosIGRvdWJsZSwgdW5zaWduZWQgaW50LCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKaYBSHZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlDaG9ydXM+KG1heGlDaG9ydXMqKacBPG1heGlDaG9ydXMqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aUNob3J1cz4oKagBQG1heGlDaG9ydXM6OmNob3J1cyhkb3VibGUsIHVuc2lnbmVkIGludCwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSmpAU52b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpRENCbG9ja2VyPihtYXhpRENCbG9ja2VyKimqAUJtYXhpRENCbG9ja2VyKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlEQ0Jsb2NrZXI+KCmrASNtYXhpRENCbG9ja2VyOjpwbGF5KGRvdWJsZSwgZG91YmxlKawBQnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlTVkY+KG1heGlTVkYqKa0BNm1heGlTVkYqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aVNWRj4oKa4BGm1heGlTVkY6OnNldEN1dG9mZihkb3VibGUprwEdbWF4aVNWRjo6c2V0UmVzb25hbmNlKGRvdWJsZSmwATVtYXhpU1ZGOjpwbGF5KGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKbEBRHZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlNYXRoPihtYXhpTWF0aCopsgFpZW1zY3JpcHRlbjo6aW50ZXJuYWw6Okludm9rZXI8ZG91YmxlLCBkb3VibGUsIGRvdWJsZT46Omludm9rZShkb3VibGUgKCopKGRvdWJsZSwgZG91YmxlKSwgZG91YmxlLCBkb3VibGUpswEdbWF4aU1hdGg6OmFkZChkb3VibGUsIGRvdWJsZSm0AR1tYXhpTWF0aDo6c3ViKGRvdWJsZSwgZG91YmxlKbUBHW1heGlNYXRoOjptdWwoZG91YmxlLCBkb3VibGUptgEdbWF4aU1hdGg6OmRpdihkb3VibGUsIGRvdWJsZSm3ARxtYXhpTWF0aDo6Z3QoZG91YmxlLCBkb3VibGUpuAEcbWF4aU1hdGg6Omx0KGRvdWJsZSwgZG91YmxlKbkBHW1heGlNYXRoOjpndGUoZG91YmxlLCBkb3VibGUpugEdbWF4aU1hdGg6Omx0ZShkb3VibGUsIGRvdWJsZSm7AR1tYXhpTWF0aDo6bW9kKGRvdWJsZSwgZG91YmxlKbwBFW1heGlNYXRoOjphYnMoZG91YmxlKb0BH21heGlNYXRoOjp4cG93eShkb3VibGUsIGRvdWJsZSm+AUZ2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpQ2xvY2s+KG1heGlDbG9jayopvwE6bWF4aUNsb2NrKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlDbG9jaz4oKcABGW1heGlDbG9jazo6aXNUaWNrKCkgY29uc3TBASJtYXhpQ2xvY2s6OmdldEN1cnJlbnRDb3VudCgpIGNvbnN0wgEfbWF4aUNsb2NrOjpzZXRDdXJyZW50Q291bnQoaW50KcMBH21heGlDbG9jazo6Z2V0TGFzdENvdW50KCkgY29uc3TEARxtYXhpQ2xvY2s6OnNldExhc3RDb3VudChpbnQpxQEZbWF4aUNsb2NrOjpnZXRCcHMoKSBjb25zdMYBFm1heGlDbG9jazo6c2V0QnBzKGludCnHARltYXhpQ2xvY2s6OmdldEJwbSgpIGNvbnN0yAEWbWF4aUNsb2NrOjpzZXRCcG0oaW50KckBF21heGlDbG9jazo6c2V0VGljayhpbnQpygEbbWF4aUNsb2NrOjpnZXRUaWNrcygpIGNvbnN0ywEYbWF4aUNsb2NrOjpzZXRUaWNrcyhpbnQpzAFgdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aUt1cmFtb3RvT3NjaWxsYXRvcj4obWF4aUt1cmFtb3RvT3NjaWxsYXRvciopzQFUbWF4aUt1cmFtb3RvT3NjaWxsYXRvciogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yPigpzgFkbWF4aUt1cmFtb3RvT3NjaWxsYXRvcjo6cGxheShkb3VibGUsIGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+Kc8B1gNlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlLdXJhbW90b09zY2lsbGF0b3I6OiopKGRvdWJsZSwgZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4pLCBkb3VibGUsIG1heGlLdXJhbW90b09zY2lsbGF0b3IqLCBkb3VibGUsIGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+ID46Omludm9rZShkb3VibGUgKG1heGlLdXJhbW90b09zY2lsbGF0b3I6OiogY29uc3QmKShkb3VibGUsIGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KSwgbWF4aUt1cmFtb3RvT3NjaWxsYXRvciosIGRvdWJsZSwgZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4qKdABZnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQ+KG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQqKdEBYHZvaWQgZW1zY3JpcHRlbjo6aW50ZXJuYWw6OnJhd19kZXN0cnVjdG9yPG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQ+KG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQqKdIBngFlbXNjcmlwdGVuOjppbnRlcm5hbDo6SW52b2tlcjxtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0KiwgdW5zaWduZWQgbG9uZyBjb25zdCYmPjo6aW52b2tlKG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQqICgqKSh1bnNpZ25lZCBsb25nIGNvbnN0JiYpLCB1bnNpZ25lZCBsb25nKdMBhAFtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQsIHVuc2lnbmVkIGxvbmcgY29uc3Q+KHVuc2lnbmVkIGxvbmcgY29uc3QmJinUAS9tYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0OjpwbGF5KGRvdWJsZSwgZG91YmxlKdUBOm1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQ6OnNldFBoYXNlKGRvdWJsZSwgdW5zaWduZWQgbG9uZynWAZYCZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAobWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldDo6KikoZG91YmxlLCB1bnNpZ25lZCBsb25nKSwgdm9pZCwgbWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldCosIGRvdWJsZSwgdW5zaWduZWQgbG9uZz46Omludm9rZSh2b2lkIChtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0OjoqIGNvbnN0JikoZG91YmxlLCB1bnNpZ25lZCBsb25nKSwgbWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldCosIGRvdWJsZSwgdW5zaWduZWQgbG9uZynXAWNtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0OjpzZXRQaGFzZXMoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+IGNvbnN0JinYATJtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0OjpnZXRQaGFzZSh1bnNpZ25lZCBsb25nKdkB/AFlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQ6OiopKHVuc2lnbmVkIGxvbmcpLCBkb3VibGUsIG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQqLCB1bnNpZ25lZCBsb25nPjo6aW52b2tlKGRvdWJsZSAobWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldDo6KiBjb25zdCYpKHVuc2lnbmVkIGxvbmcpLCBtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0KiwgdW5zaWduZWQgbG9uZynaASFtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0OjpzaXplKCnbAWp2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpQXN5bmNLdXJhbW90b09zY2lsbGF0b3I+KG1heGlBc3luY0t1cmFtb3RvT3NjaWxsYXRvciop3AGsAW1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQqIGVtc2NyaXB0ZW46OmJhc2U8bWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldD46OmNvbnZlcnRQb2ludGVyPG1heGlBc3luY0t1cmFtb3RvT3NjaWxsYXRvciwgbWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldD4obWF4aUFzeW5jS3VyYW1vdG9Pc2NpbGxhdG9yKindAYgBbWF4aUFzeW5jS3VyYW1vdG9Pc2NpbGxhdG9yKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlBc3luY0t1cmFtb3RvT3NjaWxsYXRvciwgdW5zaWduZWQgbG9uZyBjb25zdD4odW5zaWduZWQgbG9uZyBjb25zdCYmKd4BMW1heGlBc3luY0t1cmFtb3RvT3NjaWxsYXRvcjo6cGxheShkb3VibGUsIGRvdWJsZSnfATxtYXhpQXN5bmNLdXJhbW90b09zY2lsbGF0b3I6OnNldFBoYXNlKGRvdWJsZSwgdW5zaWduZWQgbG9uZyngAWVtYXhpQXN5bmNLdXJhbW90b09zY2lsbGF0b3I6OnNldFBoYXNlcyhzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4gY29uc3QmKeEBQnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlGRlQ+KG1heGlGRlQqKeIBPHZvaWQgZW1zY3JpcHRlbjo6aW50ZXJuYWw6OnJhd19kZXN0cnVjdG9yPG1heGlGRlQ+KG1heGlGRlQqKeMBNm1heGlGRlQqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aUZGVD4oKeQBrgFlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChtYXhpRkZUOjoqKShpbnQsIGludCwgaW50KSwgdm9pZCwgbWF4aUZGVCosIGludCwgaW50LCBpbnQ+OjppbnZva2Uodm9pZCAobWF4aUZGVDo6KiBjb25zdCYpKGludCwgaW50LCBpbnQpLCBtYXhpRkZUKiwgaW50LCBpbnQsIGludCnlAdoBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8Ym9vbCAobWF4aUZGVDo6KikoZmxvYXQsIG1heGlGRlQ6OmZmdE1vZGVzKSwgYm9vbCwgbWF4aUZGVCosIGZsb2F0LCBtYXhpRkZUOjpmZnRNb2Rlcz46Omludm9rZShib29sIChtYXhpRkZUOjoqIGNvbnN0JikoZmxvYXQsIG1heGlGRlQ6OmZmdE1vZGVzKSwgbWF4aUZGVCosIGZsb2F0LCBtYXhpRkZUOjpmZnRNb2RlcynmAXllbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxmbG9hdCAobWF4aUZGVDo6KikoKSwgZmxvYXQsIG1heGlGRlQqPjo6aW52b2tlKGZsb2F0IChtYXhpRkZUOjoqIGNvbnN0JikoKSwgbWF4aUZGVCop5wGJAmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mIChtYXhpRkZUOjoqKSgpLCBzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+JiwgbWF4aUZGVCo+OjppbnZva2Uoc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiYgKG1heGlGRlQ6OiogY29uc3QmKSgpLCBtYXhpRkZUKinoARptYXhpRkZUOjpnZXRNYWduaXR1ZGVzREIoKekBFG1heGlGRlQ6OmdldFBoYXNlcygp6gEVbWF4aUZGVDo6Z2V0TnVtQmlucygp6wEVbWF4aUZGVDo6Z2V0RkZUU2l6ZSgp7AEVbWF4aUZGVDo6Z2V0SG9wU2l6ZSgp7QEYbWF4aUZGVDo6Z2V0V2luZG93U2l6ZSgp7gFEdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aUlGRlQ+KG1heGlJRkZUKinvAT52b2lkIGVtc2NyaXB0ZW46OmludGVybmFsOjpyYXdfZGVzdHJ1Y3RvcjxtYXhpSUZGVD4obWF4aUlGRlQqKfABOG1heGlJRkZUKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlJRkZUPigp8QGBBWVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGZsb2F0IChtYXhpSUZGVDo6Kikoc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiYsIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mLCBtYXhpSUZGVDo6ZmZ0TW9kZXMpLCBmbG9hdCwgbWF4aUlGRlQqLCBzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+Jiwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiYsIG1heGlJRkZUOjpmZnRNb2Rlcz46Omludm9rZShmbG9hdCAobWF4aUlGRlQ6OiogY29uc3QmKShzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+Jiwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiYsIG1heGlJRkZUOjpmZnRNb2RlcyksIG1heGlJRkZUKiwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiosIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4qLCBtYXhpSUZGVDo6ZmZ0TW9kZXMp8gFldm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+ID4obWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+KinzAV92b2lkIGVtc2NyaXB0ZW46OmludGVybmFsOjpyYXdfZGVzdHJ1Y3RvcjxtYXhpTUZDQ0FuYWx5c2VyPGRvdWJsZT4gPihtYXhpTUZDQ0FuYWx5c2VyPGRvdWJsZT4qKfQBWW1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPiogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpTUZDQ0FuYWx5c2VyPGRvdWJsZT4gPigp9QFZbWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+OjpzZXR1cCh1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50LCBkb3VibGUsIGRvdWJsZSn2AZ4DZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAobWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+OjoqKSh1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50LCBkb3VibGUsIGRvdWJsZSksIHZvaWQsIG1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPiosIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQsIGRvdWJsZSwgZG91YmxlPjo6aW52b2tlKHZvaWQgKG1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPjo6KiBjb25zdCYpKHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQsIGRvdWJsZSwgZG91YmxlKSwgbWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+KiwgdW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgZG91YmxlLCBkb3VibGUp9wFVbWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+OjptZmNjKHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mKfgBqwRlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mIChtYXhpTUZDQ0FuYWx5c2VyPGRvdWJsZT46OiopKHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mKSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgbWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+Kiwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiY+OjppbnZva2Uoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiAobWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+OjoqIGNvbnN0Jikoc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiYpLCBtYXhpTUZDQ0FuYWx5c2VyPGRvdWJsZT4qLCBzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+Kin5AZUBdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8c3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+ID4oc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+Kin6AY8Bdm9pZCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6cmF3X2Rlc3RydWN0b3I8c3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+ID4oc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+Kin7AYkBc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiA+KCn8AUdzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID46OnB1c2hfYmFjayhpbnQgY29uc3QmKf0BvwJlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID46OiopKGludCBjb25zdCYpLCB2b2lkLCBzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4qLCBpbnQgY29uc3QmPjo6aW52b2tlKHZvaWQgKHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPjo6KiBjb25zdCYpKGludCBjb25zdCYpLCBzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4qLCBpbnQp/gFTc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+OjpyZXNpemUodW5zaWduZWQgbG9uZywgaW50IGNvbnN0Jin/AfsCZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAoc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+OjoqKSh1bnNpZ25lZCBsb25nLCBpbnQgY29uc3QmKSwgdm9pZCwgc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+KiwgdW5zaWduZWQgbG9uZywgaW50IGNvbnN0Jj46Omludm9rZSh2b2lkIChzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID46OiogY29uc3QmKSh1bnNpZ25lZCBsb25nLCBpbnQgY29uc3QmKSwgc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+KiwgdW5zaWduZWQgbG9uZywgaW50KYACPnN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPjo6c2l6ZSgpIGNvbnN0gQKiAWVtc2NyaXB0ZW46OmludGVybmFsOjpWZWN0b3JBY2Nlc3M8c3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+ID46OmdldChzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4gY29uc3QmLCB1bnNpZ25lZCBsb25nKYICgwNlbXNjcmlwdGVuOjppbnRlcm5hbDo6RnVuY3Rpb25JbnZva2VyPGVtc2NyaXB0ZW46OnZhbCAoKikoc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+IGNvbnN0JiwgdW5zaWduZWQgbG9uZyksIGVtc2NyaXB0ZW46OnZhbCwgc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+IGNvbnN0JiwgdW5zaWduZWQgbG9uZz46Omludm9rZShlbXNjcmlwdGVuOjp2YWwgKCoqKShzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4gY29uc3QmLCB1bnNpZ25lZCBsb25nKSwgc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+KiwgdW5zaWduZWQgbG9uZymDAqgBZW1zY3JpcHRlbjo6aW50ZXJuYWw6OlZlY3RvckFjY2VzczxzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4gPjo6c2V0KHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiYsIHVuc2lnbmVkIGxvbmcsIGludCBjb25zdCYphAL5AmVtc2NyaXB0ZW46OmludGVybmFsOjpGdW5jdGlvbkludm9rZXI8Ym9vbCAoKikoc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+JiwgdW5zaWduZWQgbG9uZywgaW50IGNvbnN0JiksIGJvb2wsIHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiYsIHVuc2lnbmVkIGxvbmcsIGludCBjb25zdCY+OjppbnZva2UoYm9vbCAoKiopKHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiYsIHVuc2lnbmVkIGxvbmcsIGludCBjb25zdCYpLCBzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4qLCB1bnNpZ25lZCBsb25nLCBpbnQphQKhAXZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiA+KHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiophgJQc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+OjpwdXNoX2JhY2soZG91YmxlIGNvbnN0JimHAuMCZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+OjoqKShkb3VibGUgY29uc3QmKSwgdm9pZCwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KiwgZG91YmxlIGNvbnN0Jj46Omludm9rZSh2b2lkIChzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID46OiogY29uc3QmKShkb3VibGUgY29uc3QmKSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KiwgZG91YmxlKYgCXHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPjo6cmVzaXplKHVuc2lnbmVkIGxvbmcsIGRvdWJsZSBjb25zdCYpiQKfA2Vtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPjo6KikodW5zaWduZWQgbG9uZywgZG91YmxlIGNvbnN0JiksIHZvaWQsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiosIHVuc2lnbmVkIGxvbmcsIGRvdWJsZSBjb25zdCY+OjppbnZva2Uodm9pZCAoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+OjoqIGNvbnN0JikodW5zaWduZWQgbG9uZywgZG91YmxlIGNvbnN0JiksIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiosIHVuc2lnbmVkIGxvbmcsIGRvdWJsZSmKAkRzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID46OnNpemUoKSBjb25zdIsCrgFlbXNjcmlwdGVuOjppbnRlcm5hbDo6VmVjdG9yQWNjZXNzPHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiA+OjpnZXQoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+IGNvbnN0JiwgdW5zaWduZWQgbG9uZymMArcBZW1zY3JpcHRlbjo6aW50ZXJuYWw6OlZlY3RvckFjY2VzczxzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4gPjo6c2V0KHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIHVuc2lnbmVkIGxvbmcsIGRvdWJsZSBjb25zdCYpjQKdA2Vtc2NyaXB0ZW46OmludGVybmFsOjpGdW5jdGlvbkludm9rZXI8Ym9vbCAoKikoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgdW5zaWduZWQgbG9uZywgZG91YmxlIGNvbnN0JiksIGJvb2wsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIHVuc2lnbmVkIGxvbmcsIGRvdWJsZSBjb25zdCY+OjppbnZva2UoYm9vbCAoKiopKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIHVuc2lnbmVkIGxvbmcsIGRvdWJsZSBjb25zdCYpLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4qLCB1bnNpZ25lZCBsb25nLCBkb3VibGUpjgKZAXZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+ID4oc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4qKY8CSnN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpwdXNoX2JhY2soY2hhciBjb25zdCYpkALLAmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjoqKShjaGFyIGNvbnN0JiksIHZvaWQsIHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+KiwgY2hhciBjb25zdCY+OjppbnZva2Uodm9pZCAoc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OiogY29uc3QmKShjaGFyIGNvbnN0JiksIHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+KiwgY2hhcimRAlZzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6cmVzaXplKHVuc2lnbmVkIGxvbmcsIGNoYXIgY29uc3QmKZIChwNlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6KikodW5zaWduZWQgbG9uZywgY2hhciBjb25zdCYpLCB2b2lkLCBzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiosIHVuc2lnbmVkIGxvbmcsIGNoYXIgY29uc3QmPjo6aW52b2tlKHZvaWQgKHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjoqIGNvbnN0JikodW5zaWduZWQgbG9uZywgY2hhciBjb25zdCYpLCBzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiosIHVuc2lnbmVkIGxvbmcsIGNoYXIpkwJAc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OnNpemUoKSBjb25zdJQCpgFlbXNjcmlwdGVuOjppbnRlcm5hbDo6VmVjdG9yQWNjZXNzPHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+ID46OmdldChzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCYsIHVuc2lnbmVkIGxvbmcplQKtAWVtc2NyaXB0ZW46OmludGVybmFsOjpWZWN0b3JBY2Nlc3M8c3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gPjo6c2V0KHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+JiwgdW5zaWduZWQgbG9uZywgY2hhciBjb25zdCYplgKFA2Vtc2NyaXB0ZW46OmludGVybmFsOjpGdW5jdGlvbkludm9rZXI8Ym9vbCAoKikoc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4mLCB1bnNpZ25lZCBsb25nLCBjaGFyIGNvbnN0JiksIGJvb2wsIHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+JiwgdW5zaWduZWQgbG9uZywgY2hhciBjb25zdCY+OjppbnZva2UoYm9vbCAoKiopKHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+JiwgdW5zaWduZWQgbG9uZywgY2hhciBjb25zdCYpLCBzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiosIHVuc2lnbmVkIGxvbmcsIGNoYXIplwK9AXZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPHN0ZDo6X18yOjp2ZWN0b3I8dW5zaWduZWQgY2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjx1bnNpZ25lZCBjaGFyPiA+ID4oc3RkOjpfXzI6OnZlY3Rvcjx1bnNpZ25lZCBjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHVuc2lnbmVkIGNoYXI+ID4qKZgCygFlbXNjcmlwdGVuOjppbnRlcm5hbDo6VmVjdG9yQWNjZXNzPHN0ZDo6X18yOjp2ZWN0b3I8dW5zaWduZWQgY2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjx1bnNpZ25lZCBjaGFyPiA+ID46OmdldChzdGQ6Ol9fMjo6dmVjdG9yPHVuc2lnbmVkIGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8dW5zaWduZWQgY2hhcj4gPiBjb25zdCYsIHVuc2lnbmVkIGxvbmcpmQKdAXZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4gPihzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+KimaAtcCZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAoc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPjo6KikoZmxvYXQgY29uc3QmKSwgdm9pZCwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiosIGZsb2F0IGNvbnN0Jj46Omludm9rZSh2b2lkIChzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+OjoqIGNvbnN0JikoZmxvYXQgY29uc3QmKSwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiosIGZsb2F0KZsCkwNlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+OjoqKSh1bnNpZ25lZCBsb25nLCBmbG9hdCBjb25zdCYpLCB2b2lkLCBzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+KiwgdW5zaWduZWQgbG9uZywgZmxvYXQgY29uc3QmPjo6aW52b2tlKHZvaWQgKHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID46OiogY29uc3QmKSh1bnNpZ25lZCBsb25nLCBmbG9hdCBjb25zdCYpLCBzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+KiwgdW5zaWduZWQgbG9uZywgZmxvYXQpnAKqAWVtc2NyaXB0ZW46OmludGVybmFsOjpWZWN0b3JBY2Nlc3M8c3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiA+OjpnZXQoc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiBjb25zdCYsIHVuc2lnbmVkIGxvbmcpnQKRA2Vtc2NyaXB0ZW46OmludGVybmFsOjpGdW5jdGlvbkludm9rZXI8Ym9vbCAoKikoc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiYsIHVuc2lnbmVkIGxvbmcsIGZsb2F0IGNvbnN0JiksIGJvb2wsIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mLCB1bnNpZ25lZCBsb25nLCBmbG9hdCBjb25zdCY+OjppbnZva2UoYm9vbCAoKiopKHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mLCB1bnNpZ25lZCBsb25nLCBmbG9hdCBjb25zdCYpLCBzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+KiwgdW5zaWduZWQgbG9uZywgZmxvYXQpngJec3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+OjpfX2FwcGVuZCh1bnNpZ25lZCBsb25nLCBkb3VibGUgY29uc3QmKZ8COG1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPjo6Y2FsY01lbEZpbHRlckJhbmsoZG91YmxlLCBpbnQpoAJmRW1zY3JpcHRlbkJpbmRpbmdJbml0aWFsaXplcl9teV9tb2R1bGVfbWF4aUdyYWluczo6RW1zY3JpcHRlbkJpbmRpbmdJbml0aWFsaXplcl9teV9tb2R1bGVfbWF4aUdyYWlucygpoQJzdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+KG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qKaICbXZvaWQgZW1zY3JpcHRlbjo6aW50ZXJuYWw6OnJhd19kZXN0cnVjdG9yPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPihtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KimjApgBZW1zY3JpcHRlbjo6c21hcnRfcHRyX3RyYWl0PHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+OjpnZXQoc3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+IGNvbnN0JimkAmZlbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46OmNvbnN0cnVjdF9udWxsKCmlAp0BZW1zY3JpcHRlbjo6c21hcnRfcHRyX3RyYWl0PHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+OjpzaGFyZShtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KiwgZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ol9FTV9WQUwqKaYCmwF2b2lkIGVtc2NyaXB0ZW46OmludGVybmFsOjpyYXdfZGVzdHJ1Y3RvcjxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPihzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4qKacCnAFlbXNjcmlwdGVuOjppbnRlcm5hbDo6SW52b2tlcjxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6aW52b2tlKHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiAoKikoKSmoAsIBc3RkOjpfXzI6OmVuYWJsZV9pZjwhKGlzX2FycmF5PG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPjo6dmFsdWUpLCBzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6dHlwZSBzdGQ6Ol9fMjo6bWFrZV9zaGFyZWQ8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+KCmpAjdtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+OjpzZXRTYW1wbGUobWF4aVNhbXBsZSopqgI4bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6Z2V0Tm9ybWFsaXNlZFBvc2l0aW9uKCmrAjRtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+OjpzZXRQb3NpdGlvbihkb3VibGUprAJCbWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6cGxheShkb3VibGUsIGRvdWJsZSwgaW50LCBkb3VibGUprQLMAmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6KikoZG91YmxlLCBkb3VibGUsIGludCwgZG91YmxlKSwgZG91YmxlLCBtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KiwgZG91YmxlLCBkb3VibGUsIGludCwgZG91YmxlPjo6aW52b2tlKGRvdWJsZSAobWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6KiBjb25zdCYpKGRvdWJsZSwgZG91YmxlLCBpbnQsIGRvdWJsZSksIG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qLCBkb3VibGUsIGRvdWJsZSwgaW50LCBkb3VibGUprgJEbWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6cGxheUF0UG9zaXRpb24oZG91YmxlLCBkb3VibGUsIGludCmvAqwCZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+OjoqKShkb3VibGUsIGRvdWJsZSwgaW50KSwgZG91YmxlLCBtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KiwgZG91YmxlLCBkb3VibGUsIGludD46Omludm9rZShkb3VibGUgKG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OiogY29uc3QmKShkb3VibGUsIGRvdWJsZSwgaW50KSwgbWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGRvdWJsZSwgZG91YmxlLCBpbnQpsAJxdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4obWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+KimxAmt2b2lkIGVtc2NyaXB0ZW46OmludGVybmFsOjpyYXdfZGVzdHJ1Y3RvcjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPihtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4qKbICmwFlbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4gPjo6c2hhcmUobWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+KiwgZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ol9FTV9WQUwqKbMCvwFzdGQ6Ol9fMjo6ZW5hYmxlX2lmPCEoaXNfYXJyYXk8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID46OnZhbHVlKSwgc3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4gPjo6dHlwZSBzdGQ6Ol9fMjo6bWFrZV9zaGFyZWQ8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4oKbQCNm1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPjo6c2V0U2FtcGxlKG1heGlTYW1wbGUqKbUCQW1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPjo6cGxheShkb3VibGUsIGRvdWJsZSwgaW50LCBkb3VibGUptgJrdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4obWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+Kim3Al9tYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4oKbgCM21heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6c2V0U2FtcGxlKG1heGlTYW1wbGUqKbkCMW1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6c2V0TG9vcFN0YXJ0KGRvdWJsZSm6Ai9tYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OnNldExvb3BFbmQoZG91YmxlKbsCKW1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6Z2V0TG9vcEVuZCgpvAJGbWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+OjpwbGF5KGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGludCwgZG91YmxlKb0C3AJlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6KikoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgaW50LCBkb3VibGUpLCBkb3VibGUsIG1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGludCwgZG91YmxlPjo6aW52b2tlKGRvdWJsZSAobWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+OjoqIGNvbnN0JikoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgaW50LCBkb3VibGUpLCBtYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBpbnQsIGRvdWJsZSm+AkhtYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OnBsYXlBdFBvc2l0aW9uKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGludCm/ArwCZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OiopKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGludCksIGRvdWJsZSwgbWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgaW50Pjo6aW52b2tlKGRvdWJsZSAobWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+OjoqIGNvbnN0JikoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgaW50KSwgbWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgaW50KcACcG1heGlHcmFpbjxoYW5uV2luRnVuY3Rvcj46Om1heGlHcmFpbihtYXhpU2FtcGxlKiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgbWF4aUdyYWluV2luZG93Q2FjaGU8aGFubldpbkZ1bmN0b3I+KinBAmJFbXNjcmlwdGVuQmluZGluZ0luaXRpYWxpemVyX215X21vZHVsZV9tYXhpYml0czo6RW1zY3JpcHRlbkJpbmRpbmdJbml0aWFsaXplcl9teV9tb2R1bGVfbWF4aWJpdHMoKcICRHZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlCaXRzPihtYXhpQml0cyopwwJvZW1zY3JpcHRlbjo6aW50ZXJuYWw6Okludm9rZXI8dW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQ+OjppbnZva2UodW5zaWduZWQgaW50ICgqKSh1bnNpZ25lZCBpbnQpLCB1bnNpZ25lZCBpbnQpxAKZAWVtc2NyaXB0ZW46OmludGVybmFsOjpJbnZva2VyPHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQ+OjppbnZva2UodW5zaWduZWQgaW50ICgqKSh1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCksIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KcUCKG1heGlCaXRzOjphdCh1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCnGAiltYXhpQml0czo6c2hsKHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KccCKW1heGlCaXRzOjpzaHIodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQpyALDAWVtc2NyaXB0ZW46OmludGVybmFsOjpJbnZva2VyPHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludD46Omludm9rZSh1bnNpZ25lZCBpbnQgKCopKHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQpLCB1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KckCNW1heGlCaXRzOjpyKHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQpygIqbWF4aUJpdHM6OmxhbmQodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQpywIpbWF4aUJpdHM6Omxvcih1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCnMAiptYXhpQml0czo6bHhvcih1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCnNAhttYXhpQml0czo6bmVnKHVuc2lnbmVkIGludCnOAhttYXhpQml0czo6aW5jKHVuc2lnbmVkIGludCnPAhttYXhpQml0czo6ZGVjKHVuc2lnbmVkIGludCnQAiltYXhpQml0czo6YWRkKHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KdECKW1heGlCaXRzOjpzdWIodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQp0gIpbWF4aUJpdHM6Om11bCh1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCnTAiltYXhpQml0czo6ZGl2KHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KdQCKG1heGlCaXRzOjpndCh1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCnVAihtYXhpQml0czo6bHQodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQp1gIpbWF4aUJpdHM6Omd0ZSh1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCnXAiltYXhpQml0czo6bHRlKHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KdgCKG1heGlCaXRzOjplcSh1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCnZAhFtYXhpQml0czo6bm9pc2UoKdoCIG1heGlCaXRzOjp0b1NpZ25hbCh1bnNpZ25lZCBpbnQp2wIkbWF4aUJpdHM6OnRvVHJpZ1NpZ25hbCh1bnNpZ25lZCBpbnQp3AJdZW1zY3JpcHRlbjo6aW50ZXJuYWw6Okludm9rZXI8dW5zaWduZWQgaW50LCBkb3VibGU+OjppbnZva2UodW5zaWduZWQgaW50ICgqKShkb3VibGUpLCBkb3VibGUp3QIcbWF4aUJpdHM6OmZyb21TaWduYWwoZG91YmxlKd4CSnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlUcmlnZ2VyPihtYXhpVHJpZ2dlciop3wI+bWF4aVRyaWdnZXIqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aVRyaWdnZXI+KCngAhltYXhpVHJpZ2dlcjo6b25aWChkb3VibGUp4QImbWF4aVRyaWdnZXI6Om9uQ2hhbmdlZChkb3VibGUsIGRvdWJsZSniAkp2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpQ291bnRlcj4obWF4aUNvdW50ZXIqKeMCPm1heGlDb3VudGVyKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlDb3VudGVyPigp5AIibWF4aUNvdW50ZXI6OmNvdW50KGRvdWJsZSwgZG91YmxlKeUCRnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlJbmRleD4obWF4aUluZGV4KinmAjptYXhpSW5kZXgqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aUluZGV4Pigp5wJXbWF4aUluZGV4OjpwdWxsKGRvdWJsZSwgZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4p6AJMdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aVJhdGlvU2VxPihtYXhpUmF0aW9TZXEqKekCVm1heGlSYXRpb1NlcTo6cGxheVRyaWcoZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4p6gKOA2Vtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aVJhdGlvU2VxOjoqKShkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiksIGRvdWJsZSwgbWF4aVJhdGlvU2VxKiwgZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4gPjo6aW52b2tlKGRvdWJsZSAobWF4aVJhdGlvU2VxOjoqIGNvbnN0JikoZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4pLCBtYXhpUmF0aW9TZXEqLCBkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiop6wKQAW1heGlSYXRpb1NlcTo6cGxheVZhbHVlcyhkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KewC7wRlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlSYXRpb1NlcTo6KikoZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4sIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiksIGRvdWJsZSwgbWF4aVJhdGlvU2VxKiwgZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4sIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiA+OjppbnZva2UoZG91YmxlIChtYXhpUmF0aW9TZXE6OiogY29uc3QmKShkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KSwgbWF4aVJhdGlvU2VxKiwgZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4qLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4qKe0CK3N0ZDo6X18yOjpfX3Rocm93X2xlbmd0aF9lcnJvcihjaGFyIGNvbnN0KinuAmR2b2lkIHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPjo6X19wdXNoX2JhY2tfc2xvd19wYXRoPGludCBjb25zdCY+KGludCBjb25zdCYp7wJVc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+OjpfX2FwcGVuZCh1bnNpZ25lZCBsb25nLCBpbnQgY29uc3QmKfACcHZvaWQgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+OjpfX3B1c2hfYmFja19zbG93X3BhdGg8ZG91YmxlIGNvbnN0Jj4oZG91YmxlIGNvbnN0JinxAlhzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6X19hcHBlbmQodW5zaWduZWQgbG9uZywgY2hhciBjb25zdCYp8gJvc3RkOjpfXzI6OnZlY3RvcjxtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPG1heGlLdXJhbW90b09zY2lsbGF0b3I+ID46Ol9fYXBwZW5kKHVuc2lnbmVkIGxvbmcp8wJPc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+OjpfX2FwcGVuZCh1bnNpZ25lZCBsb25nKfQCE21heGlGRlQ6On5tYXhpRkZUKCn1AjNtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+Ojp+bWF4aVRpbWVTdHJldGNoKCn2AoAEc3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+OjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4sIGVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6dmFsX2RlbGV0ZXI+KG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qLCBlbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46OnZhbF9kZWxldGVyLCBzdGQ6Ol9fMjo6ZW5hYmxlX2lmPGlzX2NvbnZlcnRpYmxlPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qLCBtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+Kj46OnZhbHVlLCBzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID46Ol9fbmF0Pjo6dHlwZSn3AnplbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46OnZhbF9kZWxldGVyOjpvcGVyYXRvcigpKHZvaWQgY29uc3QqKfgC9AFzdGQ6Ol9fMjo6X19zaGFyZWRfcHRyX3BvaW50ZXI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6dmFsX2RlbGV0ZXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46On5fX3NoYXJlZF9wdHJfcG9pbnRlcigp+QL2AXN0ZDo6X18yOjpfX3NoYXJlZF9wdHJfcG9pbnRlcjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KiwgZW1zY3JpcHRlbjo6c21hcnRfcHRyX3RyYWl0PHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp2YWxfZGVsZXRlciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6fl9fc2hhcmVkX3B0cl9wb2ludGVyKCkuMfoC7wFzdGQ6Ol9fMjo6X19zaGFyZWRfcHRyX3BvaW50ZXI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6dmFsX2RlbGV0ZXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46Ol9fb25femVyb19zaGFyZWQoKfsChwJzdGQ6Ol9fMjo6X19zaGFyZWRfcHRyX3BvaW50ZXI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6dmFsX2RlbGV0ZXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46Ol9fZ2V0X2RlbGV0ZXIoc3RkOjp0eXBlX2luZm8gY29uc3QmKSBjb25zdPwC9AFzdGQ6Ol9fMjo6X19zaGFyZWRfcHRyX3BvaW50ZXI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6dmFsX2RlbGV0ZXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46Ol9fb25femVyb19zaGFyZWRfd2Vhaygp/QKQAXN0ZDo6X18yOjpfX3NoYXJlZF9wdHJfZW1wbGFjZTxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp+X19zaGFyZWRfcHRyX2VtcGxhY2UoKf4CkgFzdGQ6Ol9fMjo6X19zaGFyZWRfcHRyX2VtcGxhY2U8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6fl9fc2hhcmVkX3B0cl9lbXBsYWNlKCkuMf8CiwFzdGQ6Ol9fMjo6X19zaGFyZWRfcHRyX2VtcGxhY2U8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6X19vbl96ZXJvX3NoYXJlZCgpgAMhbWF4aUdyYWluPGhhbm5XaW5GdW5jdG9yPjo6cGxheSgpgQMxbWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+Ojp+bWF4aVBpdGNoU2hpZnQoKYID+ANzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPjo6c2hhcmVkX3B0cjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4sIGVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp2YWxfZGVsZXRlcj4obWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+KiwgZW1zY3JpcHRlbjo6c21hcnRfcHRyX3RyYWl0PHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+ID46OnZhbF9kZWxldGVyLCBzdGQ6Ol9fMjo6ZW5hYmxlX2lmPGlzX2NvbnZlcnRpYmxlPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiosIG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPio+Ojp2YWx1ZSwgc3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID46Ol9fbmF0Pjo6dHlwZSmDA/EBc3RkOjpfXzI6Ol9fc2hhcmVkX3B0cl9wb2ludGVyPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiosIGVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp2YWxfZGVsZXRlciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp+X19zaGFyZWRfcHRyX3BvaW50ZXIoKYQD8wFzdGQ6Ol9fMjo6X19zaGFyZWRfcHRyX3BvaW50ZXI8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+KiwgZW1zY3JpcHRlbjo6c21hcnRfcHRyX3RyYWl0PHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+ID46OnZhbF9kZWxldGVyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+ID46On5fX3NoYXJlZF9wdHJfcG9pbnRlcigpLjGFA4QCc3RkOjpfXzI6Ol9fc2hhcmVkX3B0cl9wb2ludGVyPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiosIGVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp2YWxfZGVsZXRlciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPiA+OjpfX2dldF9kZWxldGVyKHN0ZDo6dHlwZV9pbmZvIGNvbnN0JikgY29uc3SGA44Bc3RkOjpfXzI6Ol9fc2hhcmVkX3B0cl9lbXBsYWNlPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp+X19zaGFyZWRfcHRyX2VtcGxhY2UoKYcDkAFzdGQ6Ol9fMjo6X19zaGFyZWRfcHRyX2VtcGxhY2U8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+ID46On5fX3NoYXJlZF9wdHJfZW1wbGFjZSgpLjGIA4kBc3RkOjpfXzI6Ol9fc2hhcmVkX3B0cl9lbXBsYWNlPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPiA+OjpfX29uX3plcm9fc2hhcmVkKCmJAyRfR0xPQkFMX19zdWJfSV9tYXhpbWlsaWFuLmVtYmluZC5jcHCKAxBtYXhpT3NjOjpub2lzZSgpiwMZbWF4aU9zYzo6c2luZXdhdmUoZG91YmxlKYwDGW1heGlPc2M6OnNpbmVidWY0KGRvdWJsZSmNAxhtYXhpT3NjOjpzaW5lYnVmKGRvdWJsZSmOAxhtYXhpT3NjOjpjb3N3YXZlKGRvdWJsZSmPAxdtYXhpT3NjOjpwaGFzb3IoZG91YmxlKZADF21heGlPc2M6OnNxdWFyZShkb3VibGUpkQMebWF4aU9zYzo6cHVsc2UoZG91YmxlLCBkb3VibGUpkgMYbWF4aU9zYzo6aW1wdWxzZShkb3VibGUpkwMnbWF4aU9zYzo6cGhhc29yKGRvdWJsZSwgZG91YmxlLCBkb3VibGUplAMUbWF4aU9zYzo6c2F3KGRvdWJsZSmVAxVtYXhpT3NjOjpzYXduKGRvdWJsZSmWAxltYXhpT3NjOjp0cmlhbmdsZShkb3VibGUplwNQbWF4aUVudmVsb3BlOjpsaW5lKGludCwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JimYAyJtYXhpRW52ZWxvcGU6OnRyaWdnZXIoaW50LCBkb3VibGUpmQMebWF4aURlbGF5bGluZTo6bWF4aURlbGF5bGluZSgpmgMmbWF4aURlbGF5bGluZTo6ZGwoZG91YmxlLCBpbnQsIGRvdWJsZSmbAyttYXhpRGVsYXlsaW5lOjpkbChkb3VibGUsIGludCwgZG91YmxlLCBpbnQpnAMibWF4aUZpbHRlcjo6bG9wYXNzKGRvdWJsZSwgZG91YmxlKZ0DIm1heGlGaWx0ZXI6OmhpcGFzcyhkb3VibGUsIGRvdWJsZSmeAyltYXhpRmlsdGVyOjpsb3Jlcyhkb3VibGUsIGRvdWJsZSwgZG91YmxlKZ8DKW1heGlGaWx0ZXI6OmhpcmVzKGRvdWJsZSwgZG91YmxlLCBkb3VibGUpoAMsbWF4aUZpbHRlcjo6YmFuZHBhc3MoZG91YmxlLCBkb3VibGUsIGRvdWJsZSmhA1htYXhpTWl4OjpzdGVyZW8oZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBkb3VibGUpogNebWF4aU1peDo6cXVhZChkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGRvdWJsZSwgZG91YmxlKaMDa21heGlNaXg6OmFtYmlzb25pYyhkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUppANsbWF4aVNhbXBsZTo6bG9hZChzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+LCBpbnQppQMSbWF4aVNhbXBsZTo6cmVhZCgppgNnc3RkOjpfXzI6OmJhc2ljX2lmc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpiYXNpY19pZnN0cmVhbShjaGFyIGNvbnN0KiwgdW5zaWduZWQgaW50KacD3QFzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYgc3RkOjpfXzI6Ol9fcHV0X2NoYXJhY3Rlcl9zZXF1ZW5jZTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPihzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBsb25nKagDTXN0ZDo6X18yOjp2ZWN0b3I8c2hvcnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8c2hvcnQ+ID46Ol9fYXBwZW5kKHVuc2lnbmVkIGxvbmcpqQNNc3RkOjpfXzI6OmJhc2ljX2ZpbGVidWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19maWxlYnVmKCmqA2xtYXhpU2FtcGxlOjpzZXRTYW1wbGVGcm9tT2dnQmxvYihzdGQ6Ol9fMjo6dmVjdG9yPHVuc2lnbmVkIGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8dW5zaWduZWQgY2hhcj4gPiYsIGludCmrA0xzdGQ6Ol9fMjo6YmFzaWNfZmlsZWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6YmFzaWNfZmlsZWJ1ZigprANcc3RkOjpfXzI6OmJhc2ljX2ZpbGVidWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46Om9wZW4oY2hhciBjb25zdCosIHVuc2lnbmVkIGludCmtA09zdGQ6Ol9fMjo6YmFzaWNfaWZzdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19pZnN0cmVhbSgprgMVbWF4aVNhbXBsZTo6aXNSZWFkeSgprwNObWF4aVNhbXBsZTo6c2V0U2FtcGxlKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYpsAP2AXN0ZDo6X18yOjplbmFibGVfaWY8KF9faXNfZm9yd2FyZF9pdGVyYXRvcjxkb3VibGUqPjo6dmFsdWUpICYmIChpc19jb25zdHJ1Y3RpYmxlPGRvdWJsZSwgc3RkOjpfXzI6Oml0ZXJhdG9yX3RyYWl0czxkb3VibGUqPjo6cmVmZXJlbmNlPjo6dmFsdWUpLCB2b2lkPjo6dHlwZSBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID46OmFzc2lnbjxkb3VibGUqPihkb3VibGUqLCBkb3VibGUqKbEDU21heGlTYW1wbGU6OnNldFNhbXBsZShzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBpbnQpsgMVbWF4aVNhbXBsZTo6dHJpZ2dlcigpswMSbWF4aVNhbXBsZTo6cGxheSgptAMobWF4aVNhbXBsZTo6cGxheShkb3VibGUsIGRvdWJsZSwgZG91YmxlKbUDMW1heGlTYW1wbGU6OnBsYXkoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlJim2AyltYXhpU2FtcGxlOjpwbGF5NChkb3VibGUsIGRvdWJsZSwgZG91YmxlKbcDFm1heGlTYW1wbGU6OnBsYXlPbmNlKCm4AxxtYXhpU2FtcGxlOjpwbGF5T25aWChkb3VibGUpuQMqbWF4aVNhbXBsZTo6bG9vcFNldFBvc09uWlgoZG91YmxlLCBkb3VibGUpugMcbWF4aVNhbXBsZTo6cGxheU9uY2UoZG91YmxlKbsDGG1heGlTYW1wbGU6OnBsYXkoZG91YmxlKbwDHW1heGlTYW1wbGU6Om5vcm1hbGlzZShkb3VibGUpvQMubWF4aVNhbXBsZTo6YXV0b1RyaW0oZmxvYXQsIGZsb2F0LCBib29sLCBib29sKb4DM21heGlEeW46OmdhdGUoZG91YmxlLCBkb3VibGUsIGxvbmcsIGRvdWJsZSwgZG91YmxlKb8DO21heGlEeW46OmNvbXByZXNzb3IoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUpwAMZbWF4aUR5bjo6Y29tcHJlc3MoZG91YmxlKcEDGm1heGlEeW46OnNldEF0dGFjayhkb3VibGUpwgMbbWF4aUR5bjo6c2V0UmVsZWFzZShkb3VibGUpwwMdbWF4aUR5bjo6c2V0VGhyZXNob2xkKGRvdWJsZSnEAy5tYXhpRW52Ojphcihkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBsb25nLCBpbnQpxQNAbWF4aUVudjo6YWRzcihkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgbG9uZywgaW50KcYDGm1heGlFbnY6OmFkc3IoZG91YmxlLCBpbnQpxwMabWF4aUVudjo6c2V0QXR0YWNrKGRvdWJsZSnIAxttYXhpRW52OjpzZXRTdXN0YWluKGRvdWJsZSnJAxltYXhpRW52OjpzZXREZWNheShkb3VibGUpygMSY29udmVydDo6bXRvZihpbnQpywNgdmlydHVhbCB0aHVuayB0byBzdGQ6Ol9fMjo6YmFzaWNfaWZzdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19pZnN0cmVhbSgpzANRc3RkOjpfXzI6OmJhc2ljX2lmc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfaWZzdHJlYW0oKS4xzQNidmlydHVhbCB0aHVuayB0byBzdGQ6Ol9fMjo6YmFzaWNfaWZzdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19pZnN0cmVhbSgpLjHOA0NzdGQ6Ol9fMjo6YmFzaWNfZmlsZWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6c3luYygpzwNPc3RkOjpfXzI6OmJhc2ljX2ZpbGVidWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19maWxlYnVmKCkuMdADW3N0ZDo6X18yOjpiYXNpY19maWxlYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjppbWJ1ZShzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JinRA1BzdGQ6Ol9fMjo6YmFzaWNfZmlsZWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6c2V0YnVmKGNoYXIqLCBsb25nKdIDenN0ZDo6X18yOjpiYXNpY19maWxlYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpzZWVrb2ZmKGxvbmcgbG9uZywgc3RkOjpfXzI6Omlvc19iYXNlOjpzZWVrZGlyLCB1bnNpZ25lZCBpbnQp0wMcc3RkOjpfXzI6Ol9fdGhyb3dfYmFkX2Nhc3QoKdQDb3N0ZDo6X18yOjpiYXNpY19maWxlYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpzZWVrcG9zKHN0ZDo6X18yOjpmcG9zPF9fbWJzdGF0ZV90PiwgdW5zaWduZWQgaW50KdUDSHN0ZDo6X18yOjpiYXNpY19maWxlYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp1bmRlcmZsb3coKdYDS3N0ZDo6X18yOjpiYXNpY19maWxlYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpwYmFja2ZhaWwoaW50KdcDSnN0ZDo6X18yOjpiYXNpY19maWxlYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpvdmVyZmxvdyhpbnQp2AOFAnN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+IHN0ZDo6X18yOjpfX3BhZF9hbmRfb3V0cHV0PGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCBjaGFyKdkDG21heGlDbG9jazo6c2V0VGVtcG8oZG91YmxlKdoDE21heGlDbG9jazo6dGlja2VyKCnbAx9tYXhpQ2xvY2s6OnNldFRpY2tzUGVyQmVhdChpbnQp3AMdbWF4aUZGVDo6c2V0dXAoaW50LCBpbnQsIGludCndAyptYXhpRkZUOjpwcm9jZXNzKGZsb2F0LCBtYXhpRkZUOjpmZnRNb2RlcyneAxNtYXhpRkZUOjptYWdzVG9EQigp3wMbbWF4aUZGVDo6c3BlY3RyYWxGbGF0bmVzcygp4AMbbWF4aUZGVDo6c3BlY3RyYWxDZW50cm9pZCgp4QMebWF4aUlGRlQ6OnNldHVwKGludCwgaW50LCBpbnQp4gOTAW1heGlJRkZUOjpwcm9jZXNzKHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mLCBzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+JiwgbWF4aUlGRlQ6OmZmdE1vZGVzKeMDLkZGVChpbnQsIGJvb2wsIGZsb2F0KiwgZmxvYXQqLCBmbG9hdCosIGZsb2F0KinkAyRSZWFsRkZUKGludCwgZmxvYXQqLCBmbG9hdCosIGZsb2F0KinlAyBmZnQ6OmdlbldpbmRvdyhpbnQsIGludCwgZmxvYXQqKeYDD2ZmdDo6c2V0dXAoaW50KecDC2ZmdDo6fmZmdCgp6AMhZmZ0OjpjYWxjRkZUKGludCwgZmxvYXQqLCBmbG9hdCop6QM3ZmZ0Ojpwb3dlclNwZWN0cnVtKGludCwgZmxvYXQqLCBmbG9hdCosIGZsb2F0KiwgZmxvYXQqKeoDHWZmdDo6Y29udlRvREIoZmxvYXQqLCBmbG9hdCop6wM7ZmZ0OjppbnZlcnNlRkZUQ29tcGxleChpbnQsIGZsb2F0KiwgZmxvYXQqLCBmbG9hdCosIGZsb2F0KinsAz5mZnQ6OmludmVyc2VQb3dlclNwZWN0cnVtKGludCwgZmxvYXQqLCBmbG9hdCosIGZsb2F0KiwgZmxvYXQqKe0DN21heGlNRkNDQW5hbHlzZXI8ZG91YmxlPjo6bWVsRmlsdGVyQW5kTG9nU3F1YXJlKGZsb2F0KinuAydwb2ludF9jb21wYXJlKHZvaWQgY29uc3QqLCB2b2lkIGNvbnN0KinvAxp2b3JiaXNfZGVpbml0KHN0Yl92b3JiaXMqKfADKWlzX3dob2xlX3BhY2tldF9wcmVzZW50KHN0Yl92b3JiaXMqLCBpbnQp8QMzdm9yYmlzX2RlY29kZV9wYWNrZXQoc3RiX3ZvcmJpcyosIGludCosIGludCosIGludCop8gMXc3RhcnRfcGFnZShzdGJfdm9yYmlzKinzAy92b3JiaXNfZmluaXNoX2ZyYW1lKHN0Yl92b3JiaXMqLCBpbnQsIGludCwgaW50KfQDQHZvcmJpc19kZWNvZGVfaW5pdGlhbChzdGJfdm9yYmlzKiwgaW50KiwgaW50KiwgaW50KiwgaW50KiwgaW50Kin1AxpnZXRfYml0cyhzdGJfdm9yYmlzKiwgaW50KfYDMmNvZGVib29rX2RlY29kZV9zY2FsYXJfcmF3KHN0Yl92b3JiaXMqLCBDb2RlYm9vayop9wNDZGVjb2RlX3Jlc2lkdWUoc3RiX3ZvcmJpcyosIGZsb2F0KiosIGludCwgaW50LCBpbnQsIHVuc2lnbmVkIGNoYXIqKfgDK2ludmVyc2VfbWRjdChmbG9hdCosIGludCwgc3RiX3ZvcmJpcyosIGludCn5AxlmbHVzaF9wYWNrZXQoc3RiX3ZvcmJpcyop+gMac3RhcnRfZGVjb2RlcihzdGJfdm9yYmlzKin7Ayh1aW50MzJfY29tcGFyZSh2b2lkIGNvbnN0Kiwgdm9pZCBjb25zdCop/AMlaW5pdF9ibG9ja3NpemUoc3RiX3ZvcmJpcyosIGludCwgaW50Kf0DFnN0Yl92b3JiaXNfb3Blbl9tZW1vcnn+AxpzdGJfdm9yYmlzX2dldF9mcmFtZV9zaG9ydP8DQGNvbnZlcnRfc2FtcGxlc19zaG9ydChpbnQsIHNob3J0KiosIGludCwgaW50LCBmbG9hdCoqLCBpbnQsIGludCmABCZzdGJfdm9yYmlzX2dldF9mcmFtZV9zaG9ydF9pbnRlcmxlYXZlZIEER2NvbnZlcnRfY2hhbm5lbHNfc2hvcnRfaW50ZXJsZWF2ZWQoaW50LCBzaG9ydCosIGludCwgZmxvYXQqKiwgaW50LCBpbnQpggQYc3RiX3ZvcmJpc19kZWNvZGVfbWVtb3J5gwQfbWF5YmVfc3RhcnRfcGFja2V0KHN0Yl92b3JiaXMqKYQEKXN0YXJ0X3BhZ2Vfbm9fY2FwdHVyZXBhdHRlcm4oc3RiX3ZvcmJpcyophQQyY29kZWJvb2tfZGVjb2RlX3N0YXJ0KHN0Yl92b3JiaXMqLCBDb2RlYm9vayosIGludCmGBF9jb2RlYm9va19kZWNvZGVfZGVpbnRlcmxlYXZlX3JlcGVhdChzdGJfdm9yYmlzKiwgQ29kZWJvb2sqLCBmbG9hdCoqLCBpbnQsIGludCosIGludCosIGludCwgaW50KYcENWltZGN0X3N0ZXAzX2l0ZXIwX2xvb3AoaW50LCBmbG9hdCosIGludCwgaW50LCBmbG9hdCopiAQ8aW1kY3Rfc3RlcDNfaW5uZXJfcl9sb29wKGludCwgZmxvYXQqLCBpbnQsIGludCwgZmxvYXQqLCBpbnQpiQQHc2NhbGJuZooEBmxkZXhwZosEBm1lbWNtcIwEBXFzb3J0jQQEc2lmdI4EA3Noco8EB3RyaW5rbGWQBANzaGyRBARwbnR6kgQFY3ljbGWTBAdhX2N0el9slAQMX19zdGRpb19zZWVrlQQKX19sb2NrZmlsZZYEDF9fdW5sb2NrZmlsZZcECV9fZndyaXRleJgEBmZ3cml0ZZkEB2lwcmludGaaBBBfX2Vycm5vX2xvY2F0aW9umwQHd2NydG9tYpwEBndjdG9tYp0EBm1lbWNocp4EBWZyZXhwnwQTX192ZnByaW50Zl9pbnRlcm5hbKAEC3ByaW50Zl9jb3JloQQDb3V0ogQGZ2V0aW50owQHcG9wX2FyZ6QEA3BhZKUEBWZtdF9vpgQFZm10X3inBAVmbXRfdagECHZmcHJpbnRmqQQGZm10X2ZwqgQTcG9wX2FyZ19sb25nX2RvdWJsZasECXZmaXByaW50ZqwECl9fb2ZsX2xvY2utBAlfX3Rvd3JpdGWuBAhmaXByaW50Zq8EBWZwdXRjsAQRX19mdGVsbG9fdW5sb2NrZWSxBAhfX2Z0ZWxsb7IEBWZ0ZWxsswQIX190b3JlYWS0BAVmcmVhZLUEEV9fZnNlZWtvX3VubG9ja2VktgQIX19mc2Vla2+3BAVmc2Vla7gEDV9fc3RkaW9fY2xvc2W5BAVmZ2V0Y7oEBnN0cmxlbrsEC19fc3RyY2hybnVsvAQGc3RyY2hyvQQMX19mbW9kZWZsYWdzvgQFZm9wZW6/BAl2c25wcmludGbABAhzbl93cml0ZcEEBmZjbG9zZcIEGV9fZW1zY3JpcHRlbl9zdGRvdXRfY2xvc2XDBBhfX2Vtc2NyaXB0ZW5fc3Rkb3V0X3NlZWvEBAxfX3N0ZGlvX3JlYWTFBAhfX2Zkb3BlbsYEDV9fc3RkaW9fd3JpdGXHBApfX292ZXJmbG93yAQGZmZsdXNoyQQRX19mZmx1c2hfdW5sb2NrZWTKBAdfX3VmbG93ywQJX19vZmxfYWRkzAQJX19sc2hydGkzzQQJX19hc2hsdGkzzgQMX190cnVuY3RmZGYyzwQFX19jb3PQBBBfX3JlbV9waW8yX2xhcmdl0QQKX19yZW1fcGlvMtIEBV9fc2lu0wQDY29z1AQHX19jb3NkZtUEB19fc2luZGbWBAtfX3JlbV9waW8yZtcEBGNvc2bYBANzaW7ZBARzaW5m2gQFX190YW7bBAN0YW7cBARhdGFu3QQFYXRhbmbeBAZhdGFuMmbfBARleHBm4AQDbG9n4QQEbG9nZuIEA3Bvd+MEB3dtZW1jcHnkBBlzdGQ6OnVuY2F1Z2h0X2V4Y2VwdGlvbigp5QRFc3RkOjpfXzI6OmJhc2ljX2lvczxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX2lvcygp5gQfc3RkOjpfXzI6Omlvc19iYXNlOjp+aW9zX2Jhc2UoKecEP3N0ZDo6X18yOjppb3NfYmFzZTo6X19jYWxsX2NhbGxiYWNrcyhzdGQ6Ol9fMjo6aW9zX2Jhc2U6OmV2ZW50KegER3N0ZDo6X18yOjpiYXNpY19pb3M8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19pb3MoKS4x6QRRc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX3N0cmVhbWJ1Zigp6gRTc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX3N0cmVhbWJ1ZigpLjHrBFBzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpiYXNpY19zdHJlYW1idWYoKewEXXN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OmltYnVlKHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKe0EUnN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnNldGJ1ZihjaGFyKiwgbG9uZynuBHxzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpzZWVrb2ZmKGxvbmcgbG9uZywgc3RkOjpfXzI6Omlvc19iYXNlOjpzZWVrZGlyLCB1bnNpZ25lZCBpbnQp7wRxc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6c2Vla3BvcyhzdGQ6Ol9fMjo6ZnBvczxfX21ic3RhdGVfdD4sIHVuc2lnbmVkIGludCnwBFJzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp4c2dldG4oY2hhciosIGxvbmcp8QREc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+Ojpjb3B5KGNoYXIqLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgbG9uZynyBEpzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp1bmRlcmZsb3coKfMERnN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnVmbG93KCn0BE1zdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpwYmFja2ZhaWwoaW50KfUEWHN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnhzcHV0bihjaGFyIGNvbnN0KiwgbG9uZyn2BFdzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Ojp+YmFzaWNfc3RyZWFtYnVmKCn3BFlzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Ojp+YmFzaWNfc3RyZWFtYnVmKCkuMfgEVnN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46OmJhc2ljX3N0cmVhbWJ1Zigp+QRbc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1Zjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6eHNnZXRuKHdjaGFyX3QqLCBsb25nKfoETXN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Pjo6Y29weSh3Y2hhcl90Kiwgd2NoYXJfdCBjb25zdCosIHVuc2lnbmVkIGxvbmcp+wRMc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1Zjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6dWZsb3coKfwEYXN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46OnhzcHV0bih3Y2hhcl90IGNvbnN0KiwgbG9uZyn9BE9zdGQ6Ol9fMjo6YmFzaWNfaXN0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX2lzdHJlYW0oKS4x/gRedmlydHVhbCB0aHVuayB0byBzdGQ6Ol9fMjo6YmFzaWNfaXN0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX2lzdHJlYW0oKf8ET3N0ZDo6X18yOjpiYXNpY19pc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfaXN0cmVhbSgpLjKABWB2aXJ0dWFsIHRodW5rIHRvIHN0ZDo6X18yOjpiYXNpY19pc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfaXN0cmVhbSgpLjGBBY8Bc3RkOjpfXzI6OmJhc2ljX2lzdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnNlbnRyeTo6c2VudHJ5KHN0ZDo6X18yOjpiYXNpY19pc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+JiwgYm9vbCmCBURzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6Zmx1c2goKYMFYXN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYgc3RkOjpfXzI6OnVzZV9mYWNldDxzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gPihzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JimEBdEBYm9vbCBzdGQ6Ol9fMjo6b3BlcmF0b3IhPTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiBjb25zdCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+IGNvbnN0JimFBVRzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6b3BlcmF0b3IqKCkgY29uc3SGBU9zdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6b3BlcmF0b3IrKygphwXRAWJvb2wgc3RkOjpfXzI6Om9wZXJhdG9yPT08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gY29uc3QmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiBjb25zdCYpiAWJAXN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpzZW50cnk6OnNlbnRyeShzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYpiQVOc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnNlbnRyeTo6fnNlbnRyeSgpigWYAXN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjplcXVhbChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiBjb25zdCYpIGNvbnN0iwVHc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6c2J1bXBjKCmMBUpzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpzcHV0YyhjaGFyKY0FTnN0ZDo6X18yOjpiYXNpY19pc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpyZWFkKGNoYXIqLCBsb25nKY4FanN0ZDo6X18yOjpiYXNpY19pc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpzZWVrZyhsb25nIGxvbmcsIHN0ZDo6X18yOjppb3NfYmFzZTo6c2Vla2RpcimPBUpzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6Zmx1c2goKZAFZ3N0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYgc3RkOjpfXzI6OnVzZV9mYWNldDxzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gPihzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JimRBeMBYm9vbCBzdGQ6Ol9fMjo6b3BlcmF0b3IhPTx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiBjb25zdCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+IGNvbnN0JimSBVVzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6b3BlcmF0b3IrKygpkwXjAWJvb2wgc3RkOjpfXzI6Om9wZXJhdG9yPT08d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gY29uc3QmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiBjb25zdCYplAWVAXN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+OjpzZW50cnk6OnNlbnRyeShzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYplQWkAXN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+OjplcXVhbChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiBjb25zdCYpIGNvbnN0lgVNc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1Zjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6c2J1bXBjKCmXBVNzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+OjpzcHV0Yyh3Y2hhcl90KZgFT3N0ZDo6X18yOjpiYXNpY19vc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfb3N0cmVhbSgpLjGZBV52aXJ0dWFsIHRodW5rIHRvIHN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfb3N0cmVhbSgpmgVPc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19vc3RyZWFtKCkuMpsFYHZpcnR1YWwgdGh1bmsgdG8gc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19vc3RyZWFtKCkuMZwF7QFzdGQ6Ol9fMjo6bnVtX3B1dDxjaGFyLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+IGNvbnN0JiBzdGQ6Ol9fMjo6dXNlX2ZhY2V0PHN0ZDo6X18yOjpudW1fcHV0PGNoYXIsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID4gPihzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JimdBUVzdGQ6Ol9fMjo6YmFzaWNfaW9zPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpmaWxsKCkgY29uc3SeBUpzdGQ6Ol9fMjo6YmFzaWNfaW9zPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp3aWRlbihjaGFyKSBjb25zdJ8FTnN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpvcGVyYXRvcjw8KHNob3J0KaAFTHN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpvcGVyYXRvcjw8KGludCmhBVZzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6b3BlcmF0b3I8PCh1bnNpZ25lZCBsb25nKaIFUnN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpvcGVyYXRvcj0oY2hhcimjBUZzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6cHV0KGNoYXIppAVbc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46Om9wZXJhdG9yPSh3Y2hhcl90KaUFcHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OmJhc2ljX3N0cmluZyhjaGFyIGNvbnN0KimmBSFzdGQ6Ol9fMjo6aW9zX2Jhc2U6On5pb3NfYmFzZSgpLjGnBR9zdGQ6Ol9fMjo6aW9zX2Jhc2U6OmluaXQodm9pZCopqAW1AXN0ZDo6X18yOjplbmFibGVfaWY8KGlzX21vdmVfY29uc3RydWN0aWJsZTx1bnNpZ25lZCBpbnQ+Ojp2YWx1ZSkgJiYgKGlzX21vdmVfYXNzaWduYWJsZTx1bnNpZ25lZCBpbnQ+Ojp2YWx1ZSksIHZvaWQ+Ojp0eXBlIHN0ZDo6X18yOjpzd2FwPHVuc2lnbmVkIGludD4odW5zaWduZWQgaW50JiwgdW5zaWduZWQgaW50JimpBVlzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6X190ZXN0X2Zvcl9lb2YoKSBjb25zdKoFX3N0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+OjpfX3Rlc3RfZm9yX2VvZigpIGNvbnN0qwUGdW5nZXRjrAUgc3RkOjpfXzI6Omlvc19iYXNlOjpJbml0OjpJbml0KCmtBRdfX2N4eF9nbG9iYWxfYXJyYXlfZHRvcq4FP3N0ZDo6X18yOjpfX3N0ZGluYnVmPGNoYXI+OjpfX3N0ZGluYnVmKF9JT19GSUxFKiwgX19tYnN0YXRlX3QqKa8FigFzdGQ6Ol9fMjo6YmFzaWNfaXN0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6YmFzaWNfaXN0cmVhbShzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+KimwBUJzdGQ6Ol9fMjo6X19zdGRpbmJ1Zjx3Y2hhcl90Pjo6X19zdGRpbmJ1ZihfSU9fRklMRSosIF9fbWJzdGF0ZV90KimxBZYBc3RkOjpfXzI6OmJhc2ljX2lzdHJlYW08d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46OmJhc2ljX2lzdHJlYW0oc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1Zjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiopsgVBc3RkOjpfXzI6Ol9fc3Rkb3V0YnVmPGNoYXI+OjpfX3N0ZG91dGJ1ZihfSU9fRklMRSosIF9fbWJzdGF0ZV90KimzBYoBc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OmJhc2ljX29zdHJlYW0oc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPioptAVEc3RkOjpfXzI6Ol9fc3Rkb3V0YnVmPHdjaGFyX3Q+OjpfX3N0ZG91dGJ1ZihfSU9fRklMRSosIF9fbWJzdGF0ZV90Kim1BZYBc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46OmJhc2ljX29zdHJlYW0oc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1Zjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPioptgV9c3RkOjpfXzI6OmJhc2ljX2lvczxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6aW5pdChzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Kim3BYsBc3RkOjpfXzI6OmNvZGVjdnQ8Y2hhciwgY2hhciwgX19tYnN0YXRlX3Q+IGNvbnN0JiBzdGQ6Ol9fMjo6dXNlX2ZhY2V0PHN0ZDo6X18yOjpjb2RlY3Z0PGNoYXIsIGNoYXIsIF9fbWJzdGF0ZV90PiA+KHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKbgFkQFzdGQ6Ol9fMjo6Y29kZWN2dDx3Y2hhcl90LCBjaGFyLCBfX21ic3RhdGVfdD4gY29uc3QmIHN0ZDo6X18yOjp1c2VfZmFjZXQ8c3RkOjpfXzI6OmNvZGVjdnQ8d2NoYXJfdCwgY2hhciwgX19tYnN0YXRlX3Q+ID4oc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYpuQUpc3RkOjpfXzI6Ol9fc3RkaW5idWY8Y2hhcj46On5fX3N0ZGluYnVmKCm6BTpzdGQ6Ol9fMjo6X19zdGRpbmJ1ZjxjaGFyPjo6aW1idWUoc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYpuwUnc3RkOjpfXzI6Ol9fc3RkaW5idWY8Y2hhcj46OnVuZGVyZmxvdygpvAUrc3RkOjpfXzI6Ol9fc3RkaW5idWY8Y2hhcj46Ol9fZ2V0Y2hhcihib29sKb0FI3N0ZDo6X18yOjpfX3N0ZGluYnVmPGNoYXI+Ojp1ZmxvdygpvgUqc3RkOjpfXzI6Ol9fc3RkaW5idWY8Y2hhcj46OnBiYWNrZmFpbChpbnQpvwUsc3RkOjpfXzI6Ol9fc3RkaW5idWY8d2NoYXJfdD46On5fX3N0ZGluYnVmKCnABT1zdGQ6Ol9fMjo6X19zdGRpbmJ1Zjx3Y2hhcl90Pjo6aW1idWUoc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYpwQUqc3RkOjpfXzI6Ol9fc3RkaW5idWY8d2NoYXJfdD46OnVuZGVyZmxvdygpwgUuc3RkOjpfXzI6Ol9fc3RkaW5idWY8d2NoYXJfdD46Ol9fZ2V0Y2hhcihib29sKcMFJnN0ZDo6X18yOjpfX3N0ZGluYnVmPHdjaGFyX3Q+Ojp1ZmxvdygpxAU2c3RkOjpfXzI6Ol9fc3RkaW5idWY8d2NoYXJfdD46OnBiYWNrZmFpbCh1bnNpZ25lZCBpbnQpxQU7c3RkOjpfXzI6Ol9fc3Rkb3V0YnVmPGNoYXI+OjppbWJ1ZShzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JinGBSNzdGQ6Ol9fMjo6X19zdGRvdXRidWY8Y2hhcj46OnN5bmMoKccFNnN0ZDo6X18yOjpfX3N0ZG91dGJ1ZjxjaGFyPjo6eHNwdXRuKGNoYXIgY29uc3QqLCBsb25nKcgFKnN0ZDo6X18yOjpfX3N0ZG91dGJ1ZjxjaGFyPjo6b3ZlcmZsb3coaW50KckFPnN0ZDo6X18yOjpfX3N0ZG91dGJ1Zjx3Y2hhcl90Pjo6aW1idWUoc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYpygU8c3RkOjpfXzI6Ol9fc3Rkb3V0YnVmPHdjaGFyX3Q+Ojp4c3B1dG4od2NoYXJfdCBjb25zdCosIGxvbmcpywU2c3RkOjpfXzI6Ol9fc3Rkb3V0YnVmPHdjaGFyX3Q+OjpvdmVyZmxvdyh1bnNpZ25lZCBpbnQpzAUHX19zaGxpbc0FCF9fc2hnZXRjzgUIX19tdWx0aTPPBQlfX2ludHNjYW7QBQdtYnJ0b3dj0QUNX19leHRlbmRzZnRmMtIFCF9fbXVsdGYz0wULX19mbG9hdHNpdGbUBQhfX2FkZHRmM9UFDV9fZXh0ZW5kZGZ0ZjLWBQdfX2xldGYy1wUHX19nZXRmMtgFCWNvcHlzaWdubNkFDV9fZmxvYXR1bnNpdGbaBQhfX3N1YnRmM9sFB3NjYWxibmzcBQhfX2RpdnRmM90FC19fZmxvYXRzY2Fu3gUIaGV4ZmxvYXTfBQhkZWNmbG9hdOAFB3NjYW5leHDhBQxfX3RydW5jdGZzZjLiBQd2ZnNjYW5m4wUFYXJnX27kBQlzdG9yZV9pbnTlBQ1fX3N0cmluZ19yZWFk5gUHdnNzY2FuZucFB2RvX3JlYWToBQZzdHJjbXDpBSBfX2Vtc2NyaXB0ZW5fZW52aXJvbl9jb25zdHJ1Y3RvcuoFB3N0cm5jbXDrBQZnZXRlbnbsBQhfX211bm1hcO0FDF9fZ2V0X2xvY2FsZe4FC19fbmV3bG9jYWxl7wUJdmFzcHJpbnRm8AUGc3NjYW5m8QUIc25wcmludGbyBQpmcmVlbG9jYWxl8wUGd2NzbGVu9AUJd2NzcnRvbWJz9QUKd2NzbnJ0b21ic/YFCW1ic3J0b3djc/cFCm1ic25ydG93Y3P4BQZzdHJ0b3j5BQpzdHJ0b3VsbF9s+gUJc3RydG9sbF9s+wUGc3RydG9m/AUIc3RydG94LjH9BQZzdHJ0b2T+BQdzdHJ0b2xk/wUJc3RydG9sZF9sgAZdc3RkOjpfXzI6OmNvbGxhdGU8Y2hhcj46OmRvX2NvbXBhcmUoY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdCopIGNvbnN0gQZFc3RkOjpfXzI6OmNvbGxhdGU8Y2hhcj46OmRvX3RyYW5zZm9ybShjaGFyIGNvbnN0KiwgY2hhciBjb25zdCopIGNvbnN0ggbPAXN0ZDo6X18yOjplbmFibGVfaWY8X19pc19mb3J3YXJkX2l0ZXJhdG9yPGNoYXIgY29uc3QqPjo6dmFsdWUsIHZvaWQ+Ojp0eXBlIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46Ol9faW5pdDxjaGFyIGNvbnN0Kj4oY2hhciBjb25zdCosIGNoYXIgY29uc3QqKYMGQHN0ZDo6X18yOjpjb2xsYXRlPGNoYXI+Ojpkb19oYXNoKGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KikgY29uc3SEBmxzdGQ6Ol9fMjo6Y29sbGF0ZTx3Y2hhcl90Pjo6ZG9fY29tcGFyZSh3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0KikgY29uc3SFBk5zdGQ6Ol9fMjo6Y29sbGF0ZTx3Y2hhcl90Pjo6ZG9fdHJhbnNmb3JtKHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0KikgY29uc3SGBuQBc3RkOjpfXzI6OmVuYWJsZV9pZjxfX2lzX2ZvcndhcmRfaXRlcmF0b3I8d2NoYXJfdCBjb25zdCo+Ojp2YWx1ZSwgdm9pZD46OnR5cGUgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6X19pbml0PHdjaGFyX3QgY29uc3QqPih3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdCophwZJc3RkOjpfXzI6OmNvbGxhdGU8d2NoYXJfdD46OmRvX2hhc2god2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqKSBjb25zdIgGmgJzdGQ6Ol9fMjo6bnVtX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBib29sJikgY29uc3SJBmdzdGQ6Ol9fMjo6bnVtcHVuY3Q8Y2hhcj4gY29uc3QmIHN0ZDo6X18yOjp1c2VfZmFjZXQ8c3RkOjpfXzI6Om51bXB1bmN0PGNoYXI+ID4oc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYpigakBXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QqIHN0ZDo6X18yOjpfX3NjYW5fa2V5d29yZDxzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCosIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiA+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QqLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0Kiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JiwgdW5zaWduZWQgaW50JiwgYm9vbCmLBjhzdGQ6Ol9fMjo6bG9jYWxlOjp1c2VfZmFjZXQoc3RkOjpfXzI6OmxvY2FsZTo6aWQmKSBjb25zdIwGzAFzdGQ6Ol9fMjo6dW5pcXVlX3B0cjx1bnNpZ25lZCBjaGFyLCB2b2lkICgqKSh2b2lkKik+Ojp1bmlxdWVfcHRyPHRydWUsIHZvaWQ+KHVuc2lnbmVkIGNoYXIqLCBzdGQ6Ol9fMjo6X19kZXBlbmRlbnRfdHlwZTxzdGQ6Ol9fMjo6X191bmlxdWVfcHRyX2RlbGV0ZXJfc2ZpbmFlPHZvaWQgKCopKHZvaWQqKT4sIHRydWU+OjpfX2dvb2RfcnZhbF9yZWZfdHlwZSmNBpoCc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgbG9uZyYpIGNvbnN0jgbrAnN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+IHN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZG9fZ2V0X3NpZ25lZDxsb25nPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGxvbmcmKSBjb25zdI8GOXN0ZDo6X18yOjpfX251bV9nZXRfYmFzZTo6X19nZXRfYmFzZShzdGQ6Ol9fMjo6aW9zX2Jhc2UmKZAGSHN0ZDo6X18yOjpfX251bV9nZXQ8Y2hhcj46Ol9fc3RhZ2UyX2ludF9wcmVwKHN0ZDo6X18yOjppb3NfYmFzZSYsIGNoYXImKZEGZXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OmJhc2ljX3N0cmluZygpkgZsc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6cmVzaXplKHVuc2lnbmVkIGxvbmcpkwblAXN0ZDo6X18yOjpfX251bV9nZXQ8Y2hhcj46Ol9fc3RhZ2UyX2ludF9sb29wKGNoYXIsIGludCwgY2hhciosIGNoYXIqJiwgdW5zaWduZWQgaW50JiwgY2hhciwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCYsIHVuc2lnbmVkIGludCosIHVuc2lnbmVkIGludComLCBjaGFyIGNvbnN0KimUBlxsb25nIHN0ZDo6X18yOjpfX251bV9nZXRfc2lnbmVkX2ludGVncmFsPGxvbmc+KGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgaW50JiwgaW50KZUGpQFzdGQ6Ol9fMjo6X19jaGVja19ncm91cGluZyhzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0JiwgdW5zaWduZWQgaW50KiwgdW5zaWduZWQgaW50KiwgdW5zaWduZWQgaW50JimWBp8Cc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgbG9uZyBsb25nJikgY29uc3SXBvUCc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19kb19nZXRfc2lnbmVkPGxvbmcgbG9uZz4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBsb25nIGxvbmcmKSBjb25zdJgGZmxvbmcgbG9uZyBzdGQ6Ol9fMjo6X19udW1fZ2V0X3NpZ25lZF9pbnRlZ3JhbDxsb25nIGxvbmc+KGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgaW50JiwgaW50KZkGpAJzdGQ6Ol9fMjo6bnVtX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB1bnNpZ25lZCBzaG9ydCYpIGNvbnN0mgaBA3N0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+IHN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZG9fZ2V0X3Vuc2lnbmVkPHVuc2lnbmVkIHNob3J0PihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHVuc2lnbmVkIHNob3J0JikgY29uc3SbBnJ1bnNpZ25lZCBzaG9ydCBzdGQ6Ol9fMjo6X19udW1fZ2V0X3Vuc2lnbmVkX2ludGVncmFsPHVuc2lnbmVkIHNob3J0PihjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGludCYsIGludCmcBqICc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdW5zaWduZWQgaW50JikgY29uc3SdBv0Cc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19kb19nZXRfdW5zaWduZWQ8dW5zaWduZWQgaW50PihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHVuc2lnbmVkIGludCYpIGNvbnN0ngZudW5zaWduZWQgaW50IHN0ZDo6X18yOjpfX251bV9nZXRfdW5zaWduZWRfaW50ZWdyYWw8dW5zaWduZWQgaW50PihjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGludCYsIGludCmfBqgCc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdW5zaWduZWQgbG9uZyBsb25nJikgY29uc3SgBokDc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19kb19nZXRfdW5zaWduZWQ8dW5zaWduZWQgbG9uZyBsb25nPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHVuc2lnbmVkIGxvbmcgbG9uZyYpIGNvbnN0oQZ6dW5zaWduZWQgbG9uZyBsb25nIHN0ZDo6X18yOjpfX251bV9nZXRfdW5zaWduZWRfaW50ZWdyYWw8dW5zaWduZWQgbG9uZyBsb25nPihjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGludCYsIGludCmiBpsCc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgZmxvYXQmKSBjb25zdKMG9QJzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiBzdGQ6Ol9fMjo6bnVtX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2RvX2dldF9mbG9hdGluZ19wb2ludDxmbG9hdD4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBmbG9hdCYpIGNvbnN0pAZYc3RkOjpfXzI6Ol9fbnVtX2dldDxjaGFyPjo6X19zdGFnZTJfZmxvYXRfcHJlcChzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCBjaGFyKiwgY2hhciYsIGNoYXImKaUG8AFzdGQ6Ol9fMjo6X19udW1fZ2V0PGNoYXI+OjpfX3N0YWdlMl9mbG9hdF9sb29wKGNoYXIsIGJvb2wmLCBjaGFyJiwgY2hhciosIGNoYXIqJiwgY2hhciwgY2hhciwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCYsIHVuc2lnbmVkIGludCosIHVuc2lnbmVkIGludComLCB1bnNpZ25lZCBpbnQmLCBjaGFyKimmBk9mbG9hdCBzdGQ6Ol9fMjo6X19udW1fZ2V0X2Zsb2F0PGZsb2F0PihjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGludCYppwacAnN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGRvdWJsZSYpIGNvbnN0qAb3AnN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+IHN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZG9fZ2V0X2Zsb2F0aW5nX3BvaW50PGRvdWJsZT4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBkb3VibGUmKSBjb25zdKkGUWRvdWJsZSBzdGQ6Ol9fMjo6X19udW1fZ2V0X2Zsb2F0PGRvdWJsZT4oY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBpbnQmKaoGoQJzdGQ6Ol9fMjo6bnVtX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBsb25nIGRvdWJsZSYpIGNvbnN0qwaBA3N0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+IHN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZG9fZ2V0X2Zsb2F0aW5nX3BvaW50PGxvbmcgZG91YmxlPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGxvbmcgZG91YmxlJikgY29uc3SsBltsb25nIGRvdWJsZSBzdGQ6Ol9fMjo6X19udW1fZ2V0X2Zsb2F0PGxvbmcgZG91YmxlPihjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGludCYprQabAnN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHZvaWQqJikgY29uc3SuBhJzdGQ6Ol9fMjo6X19jbG9jKCmvBkxzdGQ6Ol9fMjo6X19saWJjcHBfc3NjYW5mX2woY2hhciBjb25zdCosIF9fbG9jYWxlX3N0cnVjdCosIGNoYXIgY29uc3QqLCAuLi4psAZfc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6X196ZXJvKCmxBlRjaGFyIGNvbnN0KiBzdGQ6Ol9fMjo6ZmluZDxjaGFyIGNvbnN0KiwgY2hhcj4oY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0JimyBklzdGQ6Ol9fMjo6X19saWJjcHBfbG9jYWxlX2d1YXJkOjpfX2xpYmNwcF9sb2NhbGVfZ3VhcmQoX19sb2NhbGVfc3RydWN0KiYpswavAnN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGJvb2wmKSBjb25zdLQGbXN0ZDo6X18yOjpudW1wdW5jdDx3Y2hhcl90PiBjb25zdCYgc3RkOjpfXzI6OnVzZV9mYWNldDxzdGQ6Ol9fMjo6bnVtcHVuY3Q8d2NoYXJfdD4gPihzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0Jim1BuAFc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiBjb25zdCogc3RkOjpfXzI6Ol9fc2Nhbl9rZXl3b3JkPHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+IGNvbnN0Kiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+ID4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiBjb25zdCosIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4gY29uc3QqLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmLCB1bnNpZ25lZCBpbnQmLCBib29sKbYGrwJzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBsb25nJikgY29uc3S3BoYDc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19kb19nZXRfc2lnbmVkPGxvbmc+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgbG9uZyYpIGNvbnN0uAZNc3RkOjpfXzI6Ol9fbnVtX2dldDx3Y2hhcl90Pjo6X19kb193aWRlbihzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90KikgY29uc3S5Bk5zdGQ6Ol9fMjo6X19udW1fZ2V0PHdjaGFyX3Q+OjpfX3N0YWdlMl9pbnRfcHJlcChzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90Jim6BvEBc3RkOjpfXzI6Ol9fbnVtX2dldDx3Y2hhcl90Pjo6X19zdGFnZTJfaW50X2xvb3Aod2NoYXJfdCwgaW50LCBjaGFyKiwgY2hhciomLCB1bnNpZ25lZCBpbnQmLCB3Y2hhcl90LCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0JiwgdW5zaWduZWQgaW50KiwgdW5zaWduZWQgaW50KiYsIHdjaGFyX3QgY29uc3QqKbsGtAJzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBsb25nIGxvbmcmKSBjb25zdLwGkANzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiBzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2RvX2dldF9zaWduZWQ8bG9uZyBsb25nPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGxvbmcgbG9uZyYpIGNvbnN0vQa5AnN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHVuc2lnbmVkIHNob3J0JikgY29uc3S+BpwDc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19kb19nZXRfdW5zaWduZWQ8dW5zaWduZWQgc2hvcnQ+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdW5zaWduZWQgc2hvcnQmKSBjb25zdL8GtwJzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB1bnNpZ25lZCBpbnQmKSBjb25zdMAGmANzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiBzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2RvX2dldF91bnNpZ25lZDx1bnNpZ25lZCBpbnQ+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdW5zaWduZWQgaW50JikgY29uc3TBBr0Cc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdW5zaWduZWQgbG9uZyBsb25nJikgY29uc3TCBqQDc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19kb19nZXRfdW5zaWduZWQ8dW5zaWduZWQgbG9uZyBsb25nPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHVuc2lnbmVkIGxvbmcgbG9uZyYpIGNvbnN0wwawAnN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGZsb2F0JikgY29uc3TEBpADc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19kb19nZXRfZmxvYXRpbmdfcG9pbnQ8ZmxvYXQ+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgZmxvYXQmKSBjb25zdMUGZHN0ZDo6X18yOjpfX251bV9nZXQ8d2NoYXJfdD46Ol9fc3RhZ2UyX2Zsb2F0X3ByZXAoc3RkOjpfXzI6Omlvc19iYXNlJiwgd2NoYXJfdCosIHdjaGFyX3QmLCB3Y2hhcl90JinGBv8Bc3RkOjpfXzI6Ol9fbnVtX2dldDx3Y2hhcl90Pjo6X19zdGFnZTJfZmxvYXRfbG9vcCh3Y2hhcl90LCBib29sJiwgY2hhciYsIGNoYXIqLCBjaGFyKiYsIHdjaGFyX3QsIHdjaGFyX3QsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QmLCB1bnNpZ25lZCBpbnQqLCB1bnNpZ25lZCBpbnQqJiwgdW5zaWduZWQgaW50Jiwgd2NoYXJfdCopxwaxAnN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGRvdWJsZSYpIGNvbnN0yAaSA3N0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+IHN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZG9fZ2V0X2Zsb2F0aW5nX3BvaW50PGRvdWJsZT4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBkb3VibGUmKSBjb25zdMkGtgJzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBsb25nIGRvdWJsZSYpIGNvbnN0ygacA3N0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+IHN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZG9fZ2V0X2Zsb2F0aW5nX3BvaW50PGxvbmcgZG91YmxlPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGxvbmcgZG91YmxlJikgY29uc3TLBrACc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50Jiwgdm9pZComKSBjb25zdMwGZndjaGFyX3QgY29uc3QqIHN0ZDo6X18yOjpmaW5kPHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90Pih3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QmKc0GZ3djaGFyX3QgY29uc3QqIHN0ZDo6X18yOjpfX251bV9nZXQ8d2NoYXJfdD46Ol9fZG9fd2lkZW5fcDx3Y2hhcl90PihzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90KikgY29uc3TOBs0Bc3RkOjpfXzI6Om51bV9wdXQ8Y2hhciwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCBjaGFyLCBib29sKSBjb25zdM8GXnN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OmJlZ2luKCnQBlxzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjplbmQoKdEGzQFzdGQ6Ol9fMjo6bnVtX3B1dDxjaGFyLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIGNoYXIsIGxvbmcpIGNvbnN00gZOc3RkOjpfXzI6Ol9fbnVtX3B1dF9iYXNlOjpfX2Zvcm1hdF9pbnQoY2hhciosIGNoYXIgY29uc3QqLCBib29sLCB1bnNpZ25lZCBpbnQp0wZXc3RkOjpfXzI6Ol9fbGliY3BwX3NucHJpbnRmX2woY2hhciosIHVuc2lnbmVkIGxvbmcsIF9fbG9jYWxlX3N0cnVjdCosIGNoYXIgY29uc3QqLCAuLi4p1AZVc3RkOjpfXzI6Ol9fbnVtX3B1dF9iYXNlOjpfX2lkZW50aWZ5X3BhZGRpbmcoY2hhciosIGNoYXIqLCBzdGQ6Ol9fMjo6aW9zX2Jhc2UgY29uc3QmKdUGdXN0ZDo6X18yOjpfX251bV9wdXQ8Y2hhcj46Ol9fd2lkZW5fYW5kX2dyb3VwX2ludChjaGFyKiwgY2hhciosIGNoYXIqLCBjaGFyKiwgY2hhciomLCBjaGFyKiYsIHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKdYGK3ZvaWQgc3RkOjpfXzI6OnJldmVyc2U8Y2hhcio+KGNoYXIqLCBjaGFyKinXBiFzdGQ6Ol9fMjo6aW9zX2Jhc2U6OndpZHRoKCkgY29uc3TYBtIBc3RkOjpfXzI6Om51bV9wdXQ8Y2hhciwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCBjaGFyLCBsb25nIGxvbmcpIGNvbnN02QbWAXN0ZDo6X18yOjpudW1fcHV0PGNoYXIsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgY2hhciwgdW5zaWduZWQgbG9uZykgY29uc3TaBtsBc3RkOjpfXzI6Om51bV9wdXQ8Y2hhciwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCBjaGFyLCB1bnNpZ25lZCBsb25nIGxvbmcpIGNvbnN02wbPAXN0ZDo6X18yOjpudW1fcHV0PGNoYXIsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgY2hhciwgZG91YmxlKSBjb25zdNwGSnN0ZDo6X18yOjpfX251bV9wdXRfYmFzZTo6X19mb3JtYXRfZmxvYXQoY2hhciosIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBpbnQp3QYlc3RkOjpfXzI6Omlvc19iYXNlOjpwcmVjaXNpb24oKSBjb25zdN4GSXN0ZDo6X18yOjpfX2xpYmNwcF9hc3ByaW50Zl9sKGNoYXIqKiwgX19sb2NhbGVfc3RydWN0KiwgY2hhciBjb25zdCosIC4uLinfBndzdGQ6Ol9fMjo6X19udW1fcHV0PGNoYXI+OjpfX3dpZGVuX2FuZF9ncm91cF9mbG9hdChjaGFyKiwgY2hhciosIGNoYXIqLCBjaGFyKiwgY2hhciomLCBjaGFyKiYsIHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKeAG1AFzdGQ6Ol9fMjo6bnVtX3B1dDxjaGFyLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIGNoYXIsIGxvbmcgZG91YmxlKSBjb25zdOEG1AFzdGQ6Ol9fMjo6bnVtX3B1dDxjaGFyLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIGNoYXIsIHZvaWQgY29uc3QqKSBjb25zdOIG3wFzdGQ6Ol9fMjo6bnVtX3B1dDx3Y2hhcl90LCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHdjaGFyX3QsIGJvb2wpIGNvbnN04wZlc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6ZW5kKCnkBt8Bc3RkOjpfXzI6Om51bV9wdXQ8d2NoYXJfdCwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90LCBsb25nKSBjb25zdOUGgQFzdGQ6Ol9fMjo6X19udW1fcHV0PHdjaGFyX3Q+OjpfX3dpZGVuX2FuZF9ncm91cF9pbnQoY2hhciosIGNoYXIqLCBjaGFyKiwgd2NoYXJfdCosIHdjaGFyX3QqJiwgd2NoYXJfdComLCBzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JinmBqMCc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gc3RkOjpfXzI6Ol9fcGFkX2FuZF9vdXRwdXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4oc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdCosIHN0ZDo6X18yOjppb3NfYmFzZSYsIHdjaGFyX3Qp5wY0dm9pZCBzdGQ6Ol9fMjo6cmV2ZXJzZTx3Y2hhcl90Kj4od2NoYXJfdCosIHdjaGFyX3QqKegGhAFzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+OjpiYXNpY19zdHJpbmcodW5zaWduZWQgbG9uZywgd2NoYXJfdCnpBuQBc3RkOjpfXzI6Om51bV9wdXQ8d2NoYXJfdCwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90LCBsb25nIGxvbmcpIGNvbnN06gboAXN0ZDo6X18yOjpudW1fcHV0PHdjaGFyX3QsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgd2NoYXJfdCwgdW5zaWduZWQgbG9uZykgY29uc3TrBu0Bc3RkOjpfXzI6Om51bV9wdXQ8d2NoYXJfdCwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90LCB1bnNpZ25lZCBsb25nIGxvbmcpIGNvbnN07AbhAXN0ZDo6X18yOjpudW1fcHV0PHdjaGFyX3QsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgd2NoYXJfdCwgZG91YmxlKSBjb25zdO0GgwFzdGQ6Ol9fMjo6X19udW1fcHV0PHdjaGFyX3Q+OjpfX3dpZGVuX2FuZF9ncm91cF9mbG9hdChjaGFyKiwgY2hhciosIGNoYXIqLCB3Y2hhcl90Kiwgd2NoYXJfdComLCB3Y2hhcl90KiYsIHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKe4G5gFzdGQ6Ol9fMjo6bnVtX3B1dDx3Y2hhcl90LCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHdjaGFyX3QsIGxvbmcgZG91YmxlKSBjb25zdO8G5gFzdGQ6Ol9fMjo6bnVtX3B1dDx3Y2hhcl90LCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHdjaGFyX3QsIHZvaWQgY29uc3QqKSBjb25zdPAGU3ZvaWQgc3RkOjpfXzI6Ol9fcmV2ZXJzZTxjaGFyKj4oY2hhciosIGNoYXIqLCBzdGQ6Ol9fMjo6cmFuZG9tX2FjY2Vzc19pdGVyYXRvcl90YWcp8QZcdm9pZCBzdGQ6Ol9fMjo6X19yZXZlcnNlPHdjaGFyX3QqPih3Y2hhcl90Kiwgd2NoYXJfdCosIHN0ZDo6X18yOjpyYW5kb21fYWNjZXNzX2l0ZXJhdG9yX3RhZynyBrACc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmdldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHRtKiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqKSBjb25zdPMGc3N0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19kYXRlX29yZGVyKCkgY29uc3T0Bp4Cc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldF90aW1lKHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdG0qKSBjb25zdPUGngJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0X2RhdGUoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB0bSopIGNvbnN09gahAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXRfd2Vla2RheShzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHRtKikgY29uc3T3Bq8Cc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0X3dlZWtkYXluYW1lKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYpIGNvbnN0+AajAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXRfbW9udGhuYW1lKHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdG0qKSBjb25zdPkGrQJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfbW9udGhuYW1lKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYpIGNvbnN0+gaeAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXRfeWVhcihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHRtKikgY29uc3T7BqgCc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0X3llYXIoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JikgY29uc3T8BqUCaW50IHN0ZDo6X18yOjpfX2dldF91cF90b19uX2RpZ2l0czxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYsIGludCn9BqUCc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHRtKiwgY2hhciwgY2hhcikgY29uc3T+BqUCc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0X3BlcmNlbnQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JikgY29uc3T/BqcCc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0X2RheShpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdIAHqAJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfaG91cihpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdIEHqwJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfMTJfaG91cihpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdIIHsAJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfZGF5X3llYXJfbnVtKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYpIGNvbnN0gwepAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2dldF9tb250aChpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdIQHqgJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfbWludXRlKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYpIGNvbnN0hQepAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2dldF93aGl0ZV9zcGFjZShzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdIYHqQJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfYW1fcG0oaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JikgY29uc3SHB6oCc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0X3NlY29uZChpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdIgHqwJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfd2Vla2RheShpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdIkHqQJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfeWVhcjQoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JikgY29uc3SKB8sCc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmdldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHRtKiwgd2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqKSBjb25zdIsHswJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0X3RpbWUoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB0bSopIGNvbnN0jAezAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXRfZGF0ZShzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHRtKikgY29uc3SNB7YCc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldF93ZWVrZGF5KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdG0qKSBjb25zdI4HxwJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfd2Vla2RheW5hbWUoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JikgY29uc3SPB7gCc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldF9tb250aG5hbWUoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB0bSopIGNvbnN0kAfFAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF9tb250aG5hbWUoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JikgY29uc3SRB7MCc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldF95ZWFyKHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdG0qKSBjb25zdJIHwAJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfeWVhcihpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmKSBjb25zdJMHvQJpbnQgc3RkOjpfXzI6Ol9fZ2V0X3VwX3RvX25fZGlnaXRzPHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JiwgaW50KZQHugJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdG0qLCBjaGFyLCBjaGFyKSBjb25zdJUHvQJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfcGVyY2VudChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmKSBjb25zdJYHvwJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfZGF5KGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN0lwfAAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF9ob3VyKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN0mAfDAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF8xMl9ob3VyKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN0mQfIAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF9kYXlfeWVhcl9udW0oaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JikgY29uc3SaB8ECc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZ2V0X21vbnRoKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN0mwfCAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF9taW51dGUoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JikgY29uc3ScB8ECc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZ2V0X3doaXRlX3NwYWNlKHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN0nQfBAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF9hbV9wbShpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmKSBjb25zdJ4HwgJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfc2Vjb25kKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN0nwfDAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF93ZWVrZGF5KGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN0oAfBAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF95ZWFyNChpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmKSBjb25zdKEH3wFzdGQ6Ol9fMjo6dGltZV9wdXQ8Y2hhciwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCBjaGFyLCB0bSBjb25zdCosIGNoYXIsIGNoYXIpIGNvbnN0ogdKc3RkOjpfXzI6Ol9fdGltZV9wdXQ6Ol9fZG9fcHV0KGNoYXIqLCBjaGFyKiYsIHRtIGNvbnN0KiwgY2hhciwgY2hhcikgY29uc3SjB40Bc3RkOjpfXzI6OmVuYWJsZV9pZjwoaXNfbW92ZV9jb25zdHJ1Y3RpYmxlPGNoYXI+Ojp2YWx1ZSkgJiYgKGlzX21vdmVfYXNzaWduYWJsZTxjaGFyPjo6dmFsdWUpLCB2b2lkPjo6dHlwZSBzdGQ6Ol9fMjo6c3dhcDxjaGFyPihjaGFyJiwgY2hhciYppAfuAXN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+IHN0ZDo6X18yOjpfX2NvcHk8Y2hhciosIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID4oY2hhciosIGNoYXIqLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPimlB/EBc3RkOjpfXzI6OnRpbWVfcHV0PHdjaGFyX3QsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgd2NoYXJfdCwgdG0gY29uc3QqLCBjaGFyLCBjaGFyKSBjb25zdKYHUHN0ZDo6X18yOjpfX3RpbWVfcHV0OjpfX2RvX3B1dCh3Y2hhcl90Kiwgd2NoYXJfdComLCB0bSBjb25zdCosIGNoYXIsIGNoYXIpIGNvbnN0pwdlc3RkOjpfXzI6Ol9fbGliY3BwX21ic3J0b3djc19sKHdjaGFyX3QqLCBjaGFyIGNvbnN0KiosIHVuc2lnbmVkIGxvbmcsIF9fbWJzdGF0ZV90KiwgX19sb2NhbGVfc3RydWN0KimoByxzdGQ6Ol9fMjo6X190aHJvd19ydW50aW1lX2Vycm9yKGNoYXIgY29uc3QqKakHiQJzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiBzdGQ6Ol9fMjo6X19jb3B5PHdjaGFyX3QqLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+KHdjaGFyX3QqLCB3Y2hhcl90Kiwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4pqgc7c3RkOjpfXzI6Om1vbmV5cHVuY3Q8Y2hhciwgZmFsc2U+Ojpkb19kZWNpbWFsX3BvaW50KCkgY29uc3SrBzZzdGQ6Ol9fMjo6bW9uZXlwdW5jdDxjaGFyLCBmYWxzZT46OmRvX2dyb3VwaW5nKCkgY29uc3SsBztzdGQ6Ol9fMjo6bW9uZXlwdW5jdDxjaGFyLCBmYWxzZT46OmRvX25lZ2F0aXZlX3NpZ24oKSBjb25zdK0HOHN0ZDo6X18yOjptb25leXB1bmN0PGNoYXIsIGZhbHNlPjo6ZG9fcG9zX2Zvcm1hdCgpIGNvbnN0rgc+c3RkOjpfXzI6Om1vbmV5cHVuY3Q8d2NoYXJfdCwgZmFsc2U+Ojpkb19kZWNpbWFsX3BvaW50KCkgY29uc3SvBz5zdGQ6Ol9fMjo6bW9uZXlwdW5jdDx3Y2hhcl90LCBmYWxzZT46OmRvX25lZ2F0aXZlX3NpZ24oKSBjb25zdLAHqQJzdGQ6Ol9fMjo6bW9uZXlfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIGJvb2wsIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGxvbmcgZG91YmxlJikgY29uc3SxB4wDc3RkOjpfXzI6Om1vbmV5X2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2RvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBib29sLCBzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JiwgdW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQmLCBib29sJiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0Jiwgc3RkOjpfXzI6OnVuaXF1ZV9wdHI8Y2hhciwgdm9pZCAoKikodm9pZCopPiYsIGNoYXIqJiwgY2hhciopsgfdA3N0ZDo6X18yOjpfX21vbmV5X2dldDxjaGFyPjo6X19nYXRoZXJfaW5mbyhib29sLCBzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0Jiwgc3RkOjpfXzI6Om1vbmV5X2Jhc2U6OnBhdHRlcm4mLCBjaGFyJiwgY2hhciYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4mLCBpbnQmKbMHUnN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpvcGVyYXRvcisrKGludCm0B2Z2b2lkIHN0ZDo6X18yOjpfX2RvdWJsZV9vcl9ub3RoaW5nPGNoYXI+KHN0ZDo6X18yOjp1bmlxdWVfcHRyPGNoYXIsIHZvaWQgKCopKHZvaWQqKT4mLCBjaGFyKiYsIGNoYXIqJim1B4YBdm9pZCBzdGQ6Ol9fMjo6X19kb3VibGVfb3Jfbm90aGluZzx1bnNpZ25lZCBpbnQ+KHN0ZDo6X18yOjp1bmlxdWVfcHRyPHVuc2lnbmVkIGludCwgdm9pZCAoKikodm9pZCopPiYsIHVuc2lnbmVkIGludComLCB1bnNpZ25lZCBpbnQqJim2B/MCc3RkOjpfXzI6Om1vbmV5X2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBib29sLCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+JikgY29uc3S3B15zdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpjbGVhcigpuAfaAXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4mIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46Ol9fYXBwZW5kX2ZvcndhcmRfdW5zYWZlPGNoYXIqPihjaGFyKiwgY2hhciopuQd3c3RkOjpfXzI6Om1vbmV5cHVuY3Q8Y2hhciwgdHJ1ZT4gY29uc3QmIHN0ZDo6X18yOjp1c2VfZmFjZXQ8c3RkOjpfXzI6Om1vbmV5cHVuY3Q8Y2hhciwgdHJ1ZT4gPihzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0Jim6B7kBc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6b3BlcmF0b3I9KHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4mJim7B3lzdGQ6Ol9fMjo6bW9uZXlwdW5jdDxjaGFyLCBmYWxzZT4gY29uc3QmIHN0ZDo6X18yOjp1c2VfZmFjZXQ8c3RkOjpfXzI6Om1vbmV5cHVuY3Q8Y2hhciwgZmFsc2U+ID4oc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYpvAfvAWJvb2wgc3RkOjpfXzI6OmVxdWFsPHN0ZDo6X18yOjpfX3dyYXBfaXRlcjxjaGFyKj4sIHN0ZDo6X18yOjpfX3dyYXBfaXRlcjxjaGFyKj4sIHN0ZDo6X18yOjpfX2VxdWFsX3RvPGNoYXIsIGNoYXI+ID4oc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPGNoYXIqPiwgc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPGNoYXIqPiwgc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPGNoYXIqPiwgc3RkOjpfXzI6Ol9fZXF1YWxfdG88Y2hhciwgY2hhcj4pvQczc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPGNoYXIqPjo6b3BlcmF0b3IrKGxvbmcpIGNvbnN0vgdlc3RkOjpfXzI6OnVuaXF1ZV9wdHI8Y2hhciwgdm9pZCAoKikodm9pZCopPjo6b3BlcmF0b3I9KHN0ZDo6X18yOjp1bmlxdWVfcHRyPGNoYXIsIHZvaWQgKCopKHZvaWQqKT4mJim/B74Cc3RkOjpfXzI6Om1vbmV5X2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBib29sLCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBsb25nIGRvdWJsZSYpIGNvbnN0wAetA3N0ZDo6X18yOjptb25leV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19kb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgYm9vbCwgc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50JiwgYm9vbCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYsIHN0ZDo6X18yOjp1bmlxdWVfcHRyPHdjaGFyX3QsIHZvaWQgKCopKHZvaWQqKT4mLCB3Y2hhcl90KiYsIHdjaGFyX3QqKcEHgQRzdGQ6Ol9fMjo6X19tb25leV9nZXQ8d2NoYXJfdD46Ol9fZ2F0aGVyX2luZm8oYm9vbCwgc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYsIHN0ZDo6X18yOjptb25leV9iYXNlOjpwYXR0ZXJuJiwgd2NoYXJfdCYsIHdjaGFyX3QmLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+JiwgaW50JinCB1hzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6b3BlcmF0b3IrKyhpbnQpwweRA3N0ZDo6X18yOjptb25leV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgYm9vbCwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiYpIGNvbnN0xAdnc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6Y2xlYXIoKcUH9QFzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+JiBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+OjpfX2FwcGVuZF9mb3J3YXJkX3Vuc2FmZTx3Y2hhcl90Kj4od2NoYXJfdCosIHdjaGFyX3QqKcYHfXN0ZDo6X18yOjptb25leXB1bmN0PHdjaGFyX3QsIHRydWU+IGNvbnN0JiBzdGQ6Ol9fMjo6dXNlX2ZhY2V0PHN0ZDo6X18yOjptb25leXB1bmN0PHdjaGFyX3QsIHRydWU+ID4oc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYpxwfLAXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID46Om9wZXJhdG9yPShzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+JiYpyAd/c3RkOjpfXzI6Om1vbmV5cHVuY3Q8d2NoYXJfdCwgZmFsc2U+IGNvbnN0JiBzdGQ6Ol9fMjo6dXNlX2ZhY2V0PHN0ZDo6X18yOjptb25leXB1bmN0PHdjaGFyX3QsIGZhbHNlPiA+KHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKckHigJib29sIHN0ZDo6X18yOjplcXVhbDxzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8d2NoYXJfdCo+LCBzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8d2NoYXJfdCo+LCBzdGQ6Ol9fMjo6X19lcXVhbF90bzx3Y2hhcl90LCB3Y2hhcl90PiA+KHN0ZDo6X18yOjpfX3dyYXBfaXRlcjx3Y2hhcl90Kj4sIHN0ZDo6X18yOjpfX3dyYXBfaXRlcjx3Y2hhcl90Kj4sIHN0ZDo6X18yOjpfX3dyYXBfaXRlcjx3Y2hhcl90Kj4sIHN0ZDo6X18yOjpfX2VxdWFsX3RvPHdjaGFyX3QsIHdjaGFyX3Q+KcoHNnN0ZDo6X18yOjpfX3dyYXBfaXRlcjx3Y2hhcl90Kj46Om9wZXJhdG9yKyhsb25nKSBjb25zdMsH3AFzdGQ6Ol9fMjo6bW9uZXlfcHV0PGNoYXIsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgYm9vbCwgc3RkOjpfXzI6Omlvc19iYXNlJiwgY2hhciwgbG9uZyBkb3VibGUpIGNvbnN0zAeLA3N0ZDo6X18yOjpfX21vbmV5X3B1dDxjaGFyPjo6X19nYXRoZXJfaW5mbyhib29sLCBib29sLCBzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0Jiwgc3RkOjpfXzI6Om1vbmV5X2Jhc2U6OnBhdHRlcm4mLCBjaGFyJiwgY2hhciYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiYsIGludCYpzQfZA3N0ZDo6X18yOjpfX21vbmV5X3B1dDxjaGFyPjo6X19mb3JtYXQoY2hhciosIGNoYXIqJiwgY2hhciomLCB1bnNpZ25lZCBpbnQsIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0Kiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JiwgYm9vbCwgc3RkOjpfXzI6Om1vbmV5X2Jhc2U6OnBhdHRlcm4gY29uc3QmLCBjaGFyLCBjaGFyLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QmLCBpbnQpzgeOAWNoYXIqIHN0ZDo6X18yOjpjb3B5PHN0ZDo6X18yOjpfX3dyYXBfaXRlcjxjaGFyIGNvbnN0Kj4sIGNoYXIqPihzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8Y2hhciBjb25zdCo+LCBzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8Y2hhciBjb25zdCo+LCBjaGFyKinPB60Cc3RkOjpfXzI6Om1vbmV5X3B1dDxjaGFyLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIGJvb2wsIHN0ZDo6X18yOjppb3NfYmFzZSYsIGNoYXIsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QmKSBjb25zdNAH7gFzdGQ6Ol9fMjo6bW9uZXlfcHV0PHdjaGFyX3QsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgYm9vbCwgc3RkOjpfXzI6Omlvc19iYXNlJiwgd2NoYXJfdCwgbG9uZyBkb3VibGUpIGNvbnN00QemA3N0ZDo6X18yOjpfX21vbmV5X3B1dDx3Y2hhcl90Pjo6X19nYXRoZXJfaW5mbyhib29sLCBib29sLCBzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0Jiwgc3RkOjpfXzI6Om1vbmV5X2Jhc2U6OnBhdHRlcm4mLCB3Y2hhcl90Jiwgd2NoYXJfdCYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiYsIGludCYp0geGBHN0ZDo6X18yOjpfX21vbmV5X3B1dDx3Y2hhcl90Pjo6X19mb3JtYXQod2NoYXJfdCosIHdjaGFyX3QqJiwgd2NoYXJfdComLCB1bnNpZ25lZCBpbnQsIHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0Kiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JiwgYm9vbCwgc3RkOjpfXzI6Om1vbmV5X2Jhc2U6OnBhdHRlcm4gY29uc3QmLCB3Y2hhcl90LCB3Y2hhcl90LCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiBjb25zdCYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4gY29uc3QmLCBpbnQp0wegAXdjaGFyX3QqIHN0ZDo6X18yOjpjb3B5PHN0ZDo6X18yOjpfX3dyYXBfaXRlcjx3Y2hhcl90IGNvbnN0Kj4sIHdjaGFyX3QqPihzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8d2NoYXJfdCBjb25zdCo+LCBzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8d2NoYXJfdCBjb25zdCo+LCB3Y2hhcl90KinUB8gCc3RkOjpfXzI6Om1vbmV5X3B1dDx3Y2hhcl90LCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIGJvb2wsIHN0ZDo6X18yOjppb3NfYmFzZSYsIHdjaGFyX3QsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4gY29uc3QmKSBjb25zdNUHkAFjaGFyKiBzdGQ6Ol9fMjo6X19jb3B5PHN0ZDo6X18yOjpfX3dyYXBfaXRlcjxjaGFyIGNvbnN0Kj4sIGNoYXIqPihzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8Y2hhciBjb25zdCo+LCBzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8Y2hhciBjb25zdCo+LCBjaGFyKinWB6IBd2NoYXJfdCogc3RkOjpfXzI6Ol9fY29weTxzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8d2NoYXJfdCBjb25zdCo+LCB3Y2hhcl90Kj4oc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPHdjaGFyX3QgY29uc3QqPiwgc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPHdjaGFyX3QgY29uc3QqPiwgd2NoYXJfdCop1weeAXN0ZDo6X18yOjptZXNzYWdlczxjaGFyPjo6ZG9fb3BlbihzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0Jiwgc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYpIGNvbnN02AeUAXN0ZDo6X18yOjptZXNzYWdlczxjaGFyPjo6ZG9fZ2V0KGxvbmcsIGludCwgaW50LCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0JikgY29uc3TZB7gDc3RkOjpfXzI6OmJhY2tfaW5zZXJ0X2l0ZXJhdG9yPHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gPiBzdGQ6Ol9fMjo6X19uYXJyb3dfdG9fdXRmODw4dWw+OjpvcGVyYXRvcigpPHN0ZDo6X18yOjpiYWNrX2luc2VydF9pdGVyYXRvcjxzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+ID4sIGNoYXI+KHN0ZDo6X18yOjpiYWNrX2luc2VydF9pdGVyYXRvcjxzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+ID4sIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KikgY29uc3TaB44Bc3RkOjpfXzI6OmJhY2tfaW5zZXJ0X2l0ZXJhdG9yPHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gPjo6b3BlcmF0b3I9KGNoYXIgY29uc3QmKdsHoAFzdGQ6Ol9fMjo6bWVzc2FnZXM8d2NoYXJfdD46OmRvX2dldChsb25nLCBpbnQsIGludCwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiBjb25zdCYpIGNvbnN03AfCA3N0ZDo6X18yOjpiYWNrX2luc2VydF9pdGVyYXRvcjxzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+ID4gc3RkOjpfXzI6Ol9fbmFycm93X3RvX3V0Zjg8MzJ1bD46Om9wZXJhdG9yKCk8c3RkOjpfXzI6OmJhY2tfaW5zZXJ0X2l0ZXJhdG9yPHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gPiwgd2NoYXJfdD4oc3RkOjpfXzI6OmJhY2tfaW5zZXJ0X2l0ZXJhdG9yPHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gPiwgd2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqKSBjb25zdN0H0ANzdGQ6Ol9fMjo6YmFja19pbnNlcnRfaXRlcmF0b3I8c3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiA+IHN0ZDo6X18yOjpfX3dpZGVuX2Zyb21fdXRmODwzMnVsPjo6b3BlcmF0b3IoKTxzdGQ6Ol9fMjo6YmFja19pbnNlcnRfaXRlcmF0b3I8c3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiA+ID4oc3RkOjpfXzI6OmJhY2tfaW5zZXJ0X2l0ZXJhdG9yPHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4gPiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqKSBjb25zdN4HOXN0ZDo6X18yOjpjb2RlY3Z0PHdjaGFyX3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6fmNvZGVjdnQoKd8HLXN0ZDo6X18yOjpsb2NhbGU6Ol9faW1wOjpfX2ltcCh1bnNpZ25lZCBsb25nKeAHfnN0ZDo6X18yOjpfX3ZlY3Rvcl9iYXNlPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46Ol9fdmVjdG9yX2Jhc2UoKeEHggFzdGQ6Ol9fMjo6dmVjdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46Ol9fdmFsbG9jYXRlKHVuc2lnbmVkIGxvbmcp4geJAXN0ZDo6X18yOjp2ZWN0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4gPjo6X19jb25zdHJ1Y3RfYXRfZW5kKHVuc2lnbmVkIGxvbmcp4wd2c3RkOjpfXzI6Ol9fdmVjdG9yX2Jhc2U8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4gPjo6Y2xlYXIoKeQHjgFzdGQ6Ol9fMjo6dmVjdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46Ol9fYW5ub3RhdGVfc2hyaW5rKHVuc2lnbmVkIGxvbmcpIGNvbnN05Qcdc3RkOjpfXzI6OmxvY2FsZTo6aWQ6Ol9fZ2V0KCnmB0BzdGQ6Ol9fMjo6bG9jYWxlOjpfX2ltcDo6aW5zdGFsbChzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIGxvbmcp5wdIc3RkOjpfXzI6OmN0eXBlPGNoYXI+OjpjdHlwZSh1bnNpZ25lZCBzaG9ydCBjb25zdCosIGJvb2wsIHVuc2lnbmVkIGxvbmcp6Acbc3RkOjpfXzI6OmxvY2FsZTo6Y2xhc3NpYygp6Qd9c3RkOjpfXzI6OnZlY3RvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiA+OjpyZXNpemUodW5zaWduZWQgbG9uZynqByFzdGQ6Ol9fMjo6bG9jYWxlOjpfX2ltcDo6fl9faW1wKCnrB4EBc3RkOjpfXzI6OnZlY3RvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiA+OjpfX2Fubm90YXRlX2RlbGV0ZSgpIGNvbnN07Acjc3RkOjpfXzI6OmxvY2FsZTo6X19pbXA6On5fX2ltcCgpLjHtB39zdGQ6Ol9fMjo6dmVjdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46Ol9fYXBwZW5kKHVuc2lnbmVkIGxvbmcp7gccc3RkOjpfXzI6OmxvY2FsZTo6X19nbG9iYWwoKe8HGnN0ZDo6X18yOjpsb2NhbGU6OmxvY2FsZSgp8Acuc3RkOjpfXzI6OmxvY2FsZTo6X19pbXA6Omhhc19mYWNldChsb25nKSBjb25zdPEHHnN0ZDo6X18yOjpsb2NhbGU6OmlkOjpfX2luaXQoKfIHjAF2b2lkIHN0ZDo6X18yOjpjYWxsX29uY2U8c3RkOjpfXzI6Oihhbm9ueW1vdXMgbmFtZXNwYWNlKTo6X19mYWtlX2JpbmQ+KHN0ZDo6X18yOjpvbmNlX2ZsYWcmLCBzdGQ6Ol9fMjo6KGFub255bW91cyBuYW1lc3BhY2UpOjpfX2Zha2VfYmluZCYmKfMHK3N0ZDo6X18yOjpsb2NhbGU6OmZhY2V0OjpfX29uX3plcm9fc2hhcmVkKCn0B2l2b2lkIHN0ZDo6X18yOjpfX2NhbGxfb25jZV9wcm94eTxzdGQ6Ol9fMjo6dHVwbGU8c3RkOjpfXzI6Oihhbm9ueW1vdXMgbmFtZXNwYWNlKTo6X19mYWtlX2JpbmQmJj4gPih2b2lkKin1Bz5zdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD46OmRvX2lzKHVuc2lnbmVkIHNob3J0LCB3Y2hhcl90KSBjb25zdPYHVnN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90Pjo6ZG9faXMod2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqLCB1bnNpZ25lZCBzaG9ydCopIGNvbnN09wdac3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+Ojpkb19zY2FuX2lzKHVuc2lnbmVkIHNob3J0LCB3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdCopIGNvbnN0+Adbc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+Ojpkb19zY2FuX25vdCh1bnNpZ25lZCBzaG9ydCwgd2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqKSBjb25zdPkHM3N0ZDo6X18yOjpjdHlwZTx3Y2hhcl90Pjo6ZG9fdG91cHBlcih3Y2hhcl90KSBjb25zdPoHRHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90Pjo6ZG9fdG91cHBlcih3Y2hhcl90Kiwgd2NoYXJfdCBjb25zdCopIGNvbnN0+wczc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+Ojpkb190b2xvd2VyKHdjaGFyX3QpIGNvbnN0/AdEc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+Ojpkb190b2xvd2VyKHdjaGFyX3QqLCB3Y2hhcl90IGNvbnN0KikgY29uc3T9By5zdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD46OmRvX3dpZGVuKGNoYXIpIGNvbnN0/gdMc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+Ojpkb193aWRlbihjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHdjaGFyX3QqKSBjb25zdP8HOHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90Pjo6ZG9fbmFycm93KHdjaGFyX3QsIGNoYXIpIGNvbnN0gAhWc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+Ojpkb19uYXJyb3cod2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqLCBjaGFyLCBjaGFyKikgY29uc3SBCB9zdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj46On5jdHlwZSgpggghc3RkOjpfXzI6OmN0eXBlPGNoYXI+Ojp+Y3R5cGUoKS4xgwgtc3RkOjpfXzI6OmN0eXBlPGNoYXI+Ojpkb190b3VwcGVyKGNoYXIpIGNvbnN0hAg7c3RkOjpfXzI6OmN0eXBlPGNoYXI+Ojpkb190b3VwcGVyKGNoYXIqLCBjaGFyIGNvbnN0KikgY29uc3SFCC1zdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj46OmRvX3RvbG93ZXIoY2hhcikgY29uc3SGCDtzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj46OmRvX3RvbG93ZXIoY2hhciosIGNoYXIgY29uc3QqKSBjb25zdIcIRnN0ZDo6X18yOjpjdHlwZTxjaGFyPjo6ZG9fd2lkZW4oY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCBjaGFyKikgY29uc3SICDJzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj46OmRvX25hcnJvdyhjaGFyLCBjaGFyKSBjb25zdIkITXN0ZDo6X18yOjpjdHlwZTxjaGFyPjo6ZG9fbmFycm93KGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgY2hhciwgY2hhciopIGNvbnN0igiEAXN0ZDo6X18yOjpjb2RlY3Z0PGNoYXIsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9fb3V0KF9fbWJzdGF0ZV90JiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiYsIGNoYXIqLCBjaGFyKiwgY2hhciomKSBjb25zdIsIYHN0ZDo6X18yOjpjb2RlY3Z0PGNoYXIsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9fdW5zaGlmdChfX21ic3RhdGVfdCYsIGNoYXIqLCBjaGFyKiwgY2hhciomKSBjb25zdIwIcnN0ZDo6X18yOjpjb2RlY3Z0PGNoYXIsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9fbGVuZ3RoKF9fbWJzdGF0ZV90JiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBsb25nKSBjb25zdI0IO3N0ZDo6X18yOjpjb2RlY3Z0PHdjaGFyX3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6fmNvZGVjdnQoKS4xjgiQAXN0ZDo6X18yOjpjb2RlY3Z0PHdjaGFyX3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9fb3V0KF9fbWJzdGF0ZV90Jiwgd2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0KiYsIGNoYXIqLCBjaGFyKiwgY2hhciomKSBjb25zdI8IdXN0ZDo6X18yOjpfX2xpYmNwcF93Y3NucnRvbWJzX2woY2hhciosIHdjaGFyX3QgY29uc3QqKiwgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgX19tYnN0YXRlX3QqLCBfX2xvY2FsZV9zdHJ1Y3QqKZAITHN0ZDo6X18yOjpfX2xpYmNwcF93Y3J0b21iX2woY2hhciosIHdjaGFyX3QsIF9fbWJzdGF0ZV90KiwgX19sb2NhbGVfc3RydWN0KimRCI8Bc3RkOjpfXzI6OmNvZGVjdnQ8d2NoYXJfdCwgY2hhciwgX19tYnN0YXRlX3Q+Ojpkb19pbihfX21ic3RhdGVfdCYsIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdComLCB3Y2hhcl90Kiwgd2NoYXJfdCosIHdjaGFyX3QqJikgY29uc3SSCHVzdGQ6Ol9fMjo6X19saWJjcHBfbWJzbnJ0b3djc19sKHdjaGFyX3QqLCBjaGFyIGNvbnN0KiosIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIF9fbWJzdGF0ZV90KiwgX19sb2NhbGVfc3RydWN0KimTCGJzdGQ6Ol9fMjo6X19saWJjcHBfbWJydG93Y19sKHdjaGFyX3QqLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgbG9uZywgX19tYnN0YXRlX3QqLCBfX2xvY2FsZV9zdHJ1Y3QqKZQIY3N0ZDo6X18yOjpjb2RlY3Z0PHdjaGFyX3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9fdW5zaGlmdChfX21ic3RhdGVfdCYsIGNoYXIqLCBjaGFyKiwgY2hhciomKSBjb25zdJUIQnN0ZDo6X18yOjpjb2RlY3Z0PHdjaGFyX3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9fZW5jb2RpbmcoKSBjb25zdJYIU3N0ZDo6X18yOjpfX2xpYmNwcF9tYnRvd2NfbCh3Y2hhcl90KiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGxvbmcsIF9fbG9jYWxlX3N0cnVjdCoplwgxc3RkOjpfXzI6Ol9fbGliY3BwX21iX2N1cl9tYXhfbChfX2xvY2FsZV9zdHJ1Y3QqKZgIdXN0ZDo6X18yOjpjb2RlY3Z0PHdjaGFyX3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9fbGVuZ3RoKF9fbWJzdGF0ZV90JiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBsb25nKSBjb25zdJkIV3N0ZDo6X18yOjpfX2xpYmNwcF9tYnJsZW5fbChjaGFyIGNvbnN0KiwgdW5zaWduZWQgbG9uZywgX19tYnN0YXRlX3QqLCBfX2xvY2FsZV9zdHJ1Y3QqKZoIRHN0ZDo6X18yOjpjb2RlY3Z0PHdjaGFyX3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9fbWF4X2xlbmd0aCgpIGNvbnN0mwiUAXN0ZDo6X18yOjpjb2RlY3Z0PGNoYXIxNl90LCBjaGFyLCBfX21ic3RhdGVfdD46OmRvX291dChfX21ic3RhdGVfdCYsIGNoYXIxNl90IGNvbnN0KiwgY2hhcjE2X3QgY29uc3QqLCBjaGFyMTZfdCBjb25zdComLCBjaGFyKiwgY2hhciosIGNoYXIqJikgY29uc3ScCLUBc3RkOjpfXzI6OnV0ZjE2X3RvX3V0ZjgodW5zaWduZWQgc2hvcnQgY29uc3QqLCB1bnNpZ25lZCBzaG9ydCBjb25zdCosIHVuc2lnbmVkIHNob3J0IGNvbnN0KiYsIHVuc2lnbmVkIGNoYXIqLCB1bnNpZ25lZCBjaGFyKiwgdW5zaWduZWQgY2hhciomLCB1bnNpZ25lZCBsb25nLCBzdGQ6Ol9fMjo6Y29kZWN2dF9tb2RlKZ0IkwFzdGQ6Ol9fMjo6Y29kZWN2dDxjaGFyMTZfdCwgY2hhciwgX19tYnN0YXRlX3Q+Ojpkb19pbihfX21ic3RhdGVfdCYsIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdComLCBjaGFyMTZfdCosIGNoYXIxNl90KiwgY2hhcjE2X3QqJikgY29uc3SeCLUBc3RkOjpfXzI6OnV0ZjhfdG9fdXRmMTYodW5zaWduZWQgY2hhciBjb25zdCosIHVuc2lnbmVkIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBjaGFyIGNvbnN0KiYsIHVuc2lnbmVkIHNob3J0KiwgdW5zaWduZWQgc2hvcnQqLCB1bnNpZ25lZCBzaG9ydComLCB1bnNpZ25lZCBsb25nLCBzdGQ6Ol9fMjo6Y29kZWN2dF9tb2RlKZ8IdnN0ZDo6X18yOjpjb2RlY3Z0PGNoYXIxNl90LCBjaGFyLCBfX21ic3RhdGVfdD46OmRvX2xlbmd0aChfX21ic3RhdGVfdCYsIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgbG9uZykgY29uc3SgCIABc3RkOjpfXzI6OnV0ZjhfdG9fdXRmMTZfbGVuZ3RoKHVuc2lnbmVkIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgc3RkOjpfXzI6OmNvZGVjdnRfbW9kZSmhCEVzdGQ6Ol9fMjo6Y29kZWN2dDxjaGFyMTZfdCwgY2hhciwgX19tYnN0YXRlX3Q+Ojpkb19tYXhfbGVuZ3RoKCkgY29uc3SiCJQBc3RkOjpfXzI6OmNvZGVjdnQ8Y2hhcjMyX3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9fb3V0KF9fbWJzdGF0ZV90JiwgY2hhcjMyX3QgY29uc3QqLCBjaGFyMzJfdCBjb25zdCosIGNoYXIzMl90IGNvbnN0KiYsIGNoYXIqLCBjaGFyKiwgY2hhciomKSBjb25zdKMIrgFzdGQ6Ol9fMjo6dWNzNF90b191dGY4KHVuc2lnbmVkIGludCBjb25zdCosIHVuc2lnbmVkIGludCBjb25zdCosIHVuc2lnbmVkIGludCBjb25zdComLCB1bnNpZ25lZCBjaGFyKiwgdW5zaWduZWQgY2hhciosIHVuc2lnbmVkIGNoYXIqJiwgdW5zaWduZWQgbG9uZywgc3RkOjpfXzI6OmNvZGVjdnRfbW9kZSmkCJMBc3RkOjpfXzI6OmNvZGVjdnQ8Y2hhcjMyX3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9faW4oX19tYnN0YXRlX3QmLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqJiwgY2hhcjMyX3QqLCBjaGFyMzJfdCosIGNoYXIzMl90KiYpIGNvbnN0pQiuAXN0ZDo6X18yOjp1dGY4X3RvX3VjczQodW5zaWduZWQgY2hhciBjb25zdCosIHVuc2lnbmVkIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBjaGFyIGNvbnN0KiYsIHVuc2lnbmVkIGludCosIHVuc2lnbmVkIGludCosIHVuc2lnbmVkIGludComLCB1bnNpZ25lZCBsb25nLCBzdGQ6Ol9fMjo6Y29kZWN2dF9tb2RlKaYIdnN0ZDo6X18yOjpjb2RlY3Z0PGNoYXIzMl90LCBjaGFyLCBfX21ic3RhdGVfdD46OmRvX2xlbmd0aChfX21ic3RhdGVfdCYsIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgbG9uZykgY29uc3SnCH9zdGQ6Ol9fMjo6dXRmOF90b191Y3M0X2xlbmd0aCh1bnNpZ25lZCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgY2hhciBjb25zdCosIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIHN0ZDo6X18yOjpjb2RlY3Z0X21vZGUpqAglc3RkOjpfXzI6Om51bXB1bmN0PGNoYXI+Ojp+bnVtcHVuY3QoKakIJ3N0ZDo6X18yOjpudW1wdW5jdDxjaGFyPjo6fm51bXB1bmN0KCkuMaoIKHN0ZDo6X18yOjpudW1wdW5jdDx3Y2hhcl90Pjo6fm51bXB1bmN0KCmrCCpzdGQ6Ol9fMjo6bnVtcHVuY3Q8d2NoYXJfdD46On5udW1wdW5jdCgpLjGsCDJzdGQ6Ol9fMjo6bnVtcHVuY3Q8Y2hhcj46OmRvX2RlY2ltYWxfcG9pbnQoKSBjb25zdK0IMnN0ZDo6X18yOjpudW1wdW5jdDxjaGFyPjo6ZG9fdGhvdXNhbmRzX3NlcCgpIGNvbnN0rggtc3RkOjpfXzI6Om51bXB1bmN0PGNoYXI+Ojpkb19ncm91cGluZygpIGNvbnN0rwgwc3RkOjpfXzI6Om51bXB1bmN0PHdjaGFyX3Q+Ojpkb19ncm91cGluZygpIGNvbnN0sAgtc3RkOjpfXzI6Om51bXB1bmN0PGNoYXI+Ojpkb190cnVlbmFtZSgpIGNvbnN0sQgwc3RkOjpfXzI6Om51bXB1bmN0PHdjaGFyX3Q+Ojpkb190cnVlbmFtZSgpIGNvbnN0sgh8c3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6YmFzaWNfc3RyaW5nKHdjaGFyX3QgY29uc3QqKbMILnN0ZDo6X18yOjpudW1wdW5jdDxjaGFyPjo6ZG9fZmFsc2VuYW1lKCkgY29uc3S0CDFzdGQ6Ol9fMjo6bnVtcHVuY3Q8d2NoYXJfdD46OmRvX2ZhbHNlbmFtZSgpIGNvbnN0tQhtc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6b3BlcmF0b3I9KGNoYXIgY29uc3QqKbYINXN0ZDo6X18yOjpfX3RpbWVfZ2V0X2Nfc3RvcmFnZTxjaGFyPjo6X193ZWVrcygpIGNvbnN0twgWc3RkOjpfXzI6OmluaXRfd2Vla3MoKbgIGl9fY3h4X2dsb2JhbF9hcnJheV9kdG9yLjU0uQg4c3RkOjpfXzI6Ol9fdGltZV9nZXRfY19zdG9yYWdlPHdjaGFyX3Q+OjpfX3dlZWtzKCkgY29uc3S6CBdzdGQ6Ol9fMjo6aW5pdF93d2Vla3MoKbsIGl9fY3h4X2dsb2JhbF9hcnJheV9kdG9yLjY5vAh5c3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6b3BlcmF0b3I9KHdjaGFyX3QgY29uc3QqKb0INnN0ZDo6X18yOjpfX3RpbWVfZ2V0X2Nfc3RvcmFnZTxjaGFyPjo6X19tb250aHMoKSBjb25zdL4IF3N0ZDo6X18yOjppbml0X21vbnRocygpvwgaX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuODTACDlzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8d2NoYXJfdD46Ol9fbW9udGhzKCkgY29uc3TBCBhzdGQ6Ol9fMjo6aW5pdF93bW9udGhzKCnCCBtfX2N4eF9nbG9iYWxfYXJyYXlfZHRvci4xMDjDCDVzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8Y2hhcj46Ol9fYW1fcG0oKSBjb25zdMQIFnN0ZDo6X18yOjppbml0X2FtX3BtKCnFCBtfX2N4eF9nbG9iYWxfYXJyYXlfZHRvci4xMzLGCDhzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8d2NoYXJfdD46Ol9fYW1fcG0oKSBjb25zdMcIF3N0ZDo6X18yOjppbml0X3dhbV9wbSgpyAgbX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuMTM1yQgxc3RkOjpfXzI6Ol9fdGltZV9nZXRfY19zdG9yYWdlPGNoYXI+OjpfX3goKSBjb25zdMoIGV9fY3h4X2dsb2JhbF9hcnJheV9kdG9yLjHLCDRzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8d2NoYXJfdD46Ol9feCgpIGNvbnN0zAgaX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuMzHNCDFzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8Y2hhcj46Ol9fWCgpIGNvbnN0zggaX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuMzPPCDRzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8d2NoYXJfdD46Ol9fWCgpIGNvbnN00AgaX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuMzXRCDFzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8Y2hhcj46Ol9fYygpIGNvbnN00ggaX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuMzfTCDRzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8d2NoYXJfdD46Ol9fYygpIGNvbnN01AgaX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuMznVCDFzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8Y2hhcj46Ol9fcigpIGNvbnN01ggaX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuNDHXCDRzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8d2NoYXJfdD46Ol9fcigpIGNvbnN02AgaX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuNDPZCGlzdGQ6Ol9fMjo6dGltZV9wdXQ8Y2hhciwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6fnRpbWVfcHV0KCnaCGtzdGQ6Ol9fMjo6dGltZV9wdXQ8Y2hhciwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6fnRpbWVfcHV0KCkuMdsIeHN0ZDo6X18yOjp2ZWN0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4gPjo6bWF4X3NpemUoKSBjb25zdNwIqwFzdGQ6Ol9fMjo6YWxsb2NhdG9yX3RyYWl0czxzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4gPjo6YWxsb2NhdGUoc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+JiwgdW5zaWduZWQgbG9uZyndCIsBc3RkOjpfXzI6OnZlY3RvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiA+OjpfX2Fubm90YXRlX25ldyh1bnNpZ25lZCBsb25nKSBjb25zdN4IX3N0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPjo6YWxsb2NhdGUodW5zaWduZWQgbG9uZywgdm9pZCBjb25zdCop3wg/c3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPjo6YWxsb2NhdGUodW5zaWduZWQgbG9uZywgdm9pZCBjb25zdCop4AjIAXN0ZDo6X18yOjphbGxvY2F0b3JfdHJhaXRzPHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiA+OjpkZWFsbG9jYXRlKHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiYsIHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiosIHVuc2lnbmVkIGxvbmcp4QibAXN0ZDo6X18yOjpfX3ZlY3Rvcl9iYXNlPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46Ol9fZGVzdHJ1Y3RfYXRfZW5kKHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiop4ggic3RkOjpfXzI6Ol9fdGltZV9wdXQ6Ol9fdGltZV9wdXQoKeMIiAFzdGQ6Ol9fMjo6dmVjdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46Ol9fcmVjb21tZW5kKHVuc2lnbmVkIGxvbmcpIGNvbnN05AjYAXN0ZDo6X18yOjpfX3NwbGl0X2J1ZmZlcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiY+OjpfX3NwbGl0X2J1ZmZlcih1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4mKeUIkQFzdGQ6Ol9fMjo6X19zcGxpdF9idWZmZXI8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4mPjo6X19jb25zdHJ1Y3RfYXRfZW5kKHVuc2lnbmVkIGxvbmcp5gjzAXN0ZDo6X18yOjp2ZWN0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4gPjo6X19zd2FwX291dF9jaXJjdWxhcl9idWZmZXIoc3RkOjpfXzI6Ol9fc3BsaXRfYnVmZmVyPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+Jj4mKecIxgNzdGQ6Ol9fMjo6ZW5hYmxlX2lmPCgoc3RkOjpfXzI6OmludGVncmFsX2NvbnN0YW50PGJvb2wsIGZhbHNlPjo6dmFsdWUpIHx8ICghKF9faGFzX2NvbnN0cnVjdDxzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4sIGJvb2wqLCBib29sPjo6dmFsdWUpKSkgJiYgKGlzX3RyaXZpYWxseV9tb3ZlX2NvbnN0cnVjdGlibGU8Ym9vbD46OnZhbHVlKSwgdm9pZD46OnR5cGUgc3RkOjpfXzI6OmFsbG9jYXRvcl90cmFpdHM8c3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46Ol9fY29uc3RydWN0X2JhY2t3YXJkPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kj4oc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+JiwgYm9vbCosIGJvb2wqLCBib29sKiYp6Ah8c3RkOjpfXzI6Ol9fY29tcHJlc3NlZF9wYWlyPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiY+OjpzZWNvbmQoKekIxgFzdGQ6Ol9fMjo6X19zcGxpdF9idWZmZXI8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4mPjo6X19kZXN0cnVjdF9hdF9lbmQoc3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqKiwgc3RkOjpfXzI6OmludGVncmFsX2NvbnN0YW50PGJvb2wsIGZhbHNlPinqCEBzdGQ6Ol9fMjo6KGFub255bW91cyBuYW1lc3BhY2UpOjpfX2Zha2VfYmluZDo6b3BlcmF0b3IoKSgpIGNvbnN06whCc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90Pjo6YWxsb2NhdGUodW5zaWduZWQgbG9uZywgdm9pZCBjb25zdCop7Ahrc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6X19jbGVhcl9hbmRfc2hyaW5rKCntCHRzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+OjpfX2NsZWFyX2FuZF9zaHJpbmsoKe4IQ2xvbmcgZG91YmxlIHN0ZDo6X18yOjpfX2RvX3N0cnRvZDxsb25nIGRvdWJsZT4oY2hhciBjb25zdCosIGNoYXIqKinvCC1zdGQ6Ol9fMjo6X19zaGFyZWRfY291bnQ6On5fX3NoYXJlZF9jb3VudCgpLjHwCC9zdGQ6Ol9fMjo6X19zaGFyZWRfd2Vha19jb3VudDo6X19yZWxlYXNlX3dlYWsoKfEISXN0ZDo6X18yOjpfX3NoYXJlZF93ZWFrX2NvdW50OjpfX2dldF9kZWxldGVyKHN0ZDo6dHlwZV9pbmZvIGNvbnN0JikgY29uc3TyCEZzdGQ6Ol9fMjo6X19jYWxsX29uY2UodW5zaWduZWQgbG9uZyB2b2xhdGlsZSYsIHZvaWQqLCB2b2lkICgqKSh2b2lkKikp8wgbb3BlcmF0b3IgbmV3KHVuc2lnbmVkIGxvbmcp9Ag9c3RkOjpfXzI6Ol9fbGliY3BwX3JlZnN0cmluZzo6X19saWJjcHBfcmVmc3RyaW5nKGNoYXIgY29uc3QqKfUIB3dtZW1zZXT2CAh3bWVtbW92ZfcIQ3N0ZDo6X18yOjpfX2Jhc2ljX3N0cmluZ19jb21tb248dHJ1ZT46Ol9fdGhyb3dfbGVuZ3RoX2Vycm9yKCkgY29uc3T4CMEBc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6YmFzaWNfc3RyaW5nKHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QmKfkIeXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46Ol9faW5pdChjaGFyIGNvbnN0KiwgdW5zaWduZWQgbG9uZyn6CGZzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+Ojp+YmFzaWNfc3RyaW5nKCn7CHlzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+Ojphc3NpZ24oY2hhciBjb25zdCosIHVuc2lnbmVkIGxvbmcp/AjTAXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46Ol9fZ3Jvd19ieV9hbmRfcmVwbGFjZSh1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCBjaGFyIGNvbnN0Kin9CHJzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpyZXNpemUodW5zaWduZWQgbG9uZywgY2hhcin+CHJzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjphcHBlbmQodW5zaWduZWQgbG9uZywgY2hhcin/CHRzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpfX2VyYXNlX3RvX2VuZCh1bnNpZ25lZCBsb25nKYAJugFzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpfX2dyb3dfYnkodW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZymBCT9zdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj46OmFzc2lnbihjaGFyKiwgdW5zaWduZWQgbG9uZywgY2hhcimCCXlzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjphcHBlbmQoY2hhciBjb25zdCosIHVuc2lnbmVkIGxvbmcpgwlmc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6cHVzaF9iYWNrKGNoYXIphAlyc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6X19pbml0KHVuc2lnbmVkIGxvbmcsIGNoYXIphQmFAXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID46Ol9faW5pdCh3Y2hhcl90IGNvbnN0KiwgdW5zaWduZWQgbG9uZymGCYUBc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6YXNzaWduKHdjaGFyX3QgY29uc3QqLCB1bnNpZ25lZCBsb25nKYcJ3wFzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+OjpfX2dyb3dfYnlfYW5kX3JlcGxhY2UodW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgd2NoYXJfdCBjb25zdCopiAnDAXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID46Ol9fZ3Jvd19ieSh1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nKYkJhQFzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+OjphcHBlbmQod2NoYXJfdCBjb25zdCosIHVuc2lnbmVkIGxvbmcpiglyc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6cHVzaF9iYWNrKHdjaGFyX3Qpiwl+c3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6X19pbml0KHVuc2lnbmVkIGxvbmcsIHdjaGFyX3QpjAlCc3RkOjpfXzI6Ol9fdmVjdG9yX2Jhc2VfY29tbW9uPHRydWU+OjpfX3Rocm93X2xlbmd0aF9lcnJvcigpIGNvbnN0jQkNYWJvcnRfbWVzc2FnZY4JEl9fY3hhX3B1cmVfdmlydHVhbI8JHHN0ZDo6ZXhjZXB0aW9uOjp3aGF0KCkgY29uc3SQCSBzdGQ6OmxvZ2ljX2Vycm9yOjp+bG9naWNfZXJyb3IoKZEJM3N0ZDo6X18yOjpfX2xpYmNwcF9yZWZzdHJpbmc6On5fX2xpYmNwcF9yZWZzdHJpbmcoKZIJInN0ZDo6bG9naWNfZXJyb3I6On5sb2dpY19lcnJvcigpLjGTCSJzdGQ6Omxlbmd0aF9lcnJvcjo6fmxlbmd0aF9lcnJvcigplAkbc3RkOjpiYWRfY2FzdDo6d2hhdCgpIGNvbnN0lQlhX19jeHhhYml2MTo6X19mdW5kYW1lbnRhbF90eXBlX2luZm86OmNhbl9jYXRjaChfX2N4eGFiaXYxOjpfX3NoaW1fdHlwZV9pbmZvIGNvbnN0Kiwgdm9pZComKSBjb25zdJYJPGlzX2VxdWFsKHN0ZDo6dHlwZV9pbmZvIGNvbnN0Kiwgc3RkOjp0eXBlX2luZm8gY29uc3QqLCBib29sKZcJW19fY3h4YWJpdjE6Ol9fY2xhc3NfdHlwZV9pbmZvOjpjYW5fY2F0Y2goX19jeHhhYml2MTo6X19zaGltX3R5cGVfaW5mbyBjb25zdCosIHZvaWQqJikgY29uc3SYCQ5fX2R5bmFtaWNfY2FzdJkJa19fY3h4YWJpdjE6Ol9fY2xhc3NfdHlwZV9pbmZvOjpwcm9jZXNzX2ZvdW5kX2Jhc2VfY2xhc3MoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQqLCBpbnQpIGNvbnN0mgluX19jeHhhYml2MTo6X19jbGFzc190eXBlX2luZm86Omhhc191bmFtYmlndW91c19wdWJsaWNfYmFzZShfX2N4eGFiaXYxOjpfX2R5bmFtaWNfY2FzdF9pbmZvKiwgdm9pZCosIGludCkgY29uc3SbCXFfX2N4eGFiaXYxOjpfX3NpX2NsYXNzX3R5cGVfaW5mbzo6aGFzX3VuYW1iaWd1b3VzX3B1YmxpY19iYXNlKF9fY3h4YWJpdjE6Ol9fZHluYW1pY19jYXN0X2luZm8qLCB2b2lkKiwgaW50KSBjb25zdJwJc19fY3h4YWJpdjE6Ol9fYmFzZV9jbGFzc190eXBlX2luZm86Omhhc191bmFtYmlndW91c19wdWJsaWNfYmFzZShfX2N4eGFiaXYxOjpfX2R5bmFtaWNfY2FzdF9pbmZvKiwgdm9pZCosIGludCkgY29uc3SdCXJfX2N4eGFiaXYxOjpfX3ZtaV9jbGFzc190eXBlX2luZm86Omhhc191bmFtYmlndW91c19wdWJsaWNfYmFzZShfX2N4eGFiaXYxOjpfX2R5bmFtaWNfY2FzdF9pbmZvKiwgdm9pZCosIGludCkgY29uc3SeCVtfX2N4eGFiaXYxOjpfX3BiYXNlX3R5cGVfaW5mbzo6Y2FuX2NhdGNoKF9fY3h4YWJpdjE6Ol9fc2hpbV90eXBlX2luZm8gY29uc3QqLCB2b2lkKiYpIGNvbnN0nwldX19jeHhhYml2MTo6X19wb2ludGVyX3R5cGVfaW5mbzo6Y2FuX2NhdGNoKF9fY3h4YWJpdjE6Ol9fc2hpbV90eXBlX2luZm8gY29uc3QqLCB2b2lkKiYpIGNvbnN0oAlcX19jeHhhYml2MTo6X19wb2ludGVyX3R5cGVfaW5mbzo6Y2FuX2NhdGNoX25lc3RlZChfX2N4eGFiaXYxOjpfX3NoaW1fdHlwZV9pbmZvIGNvbnN0KikgY29uc3ShCWZfX2N4eGFiaXYxOjpfX3BvaW50ZXJfdG9fbWVtYmVyX3R5cGVfaW5mbzo6Y2FuX2NhdGNoX25lc3RlZChfX2N4eGFiaXYxOjpfX3NoaW1fdHlwZV9pbmZvIGNvbnN0KikgY29uc3SiCYMBX19jeHhhYml2MTo6X19jbGFzc190eXBlX2luZm86OnByb2Nlc3Nfc3RhdGljX3R5cGVfYWJvdmVfZHN0KF9fY3h4YWJpdjE6Ol9fZHluYW1pY19jYXN0X2luZm8qLCB2b2lkIGNvbnN0Kiwgdm9pZCBjb25zdCosIGludCkgY29uc3SjCXNfX2N4eGFiaXYxOjpfX3ZtaV9jbGFzc190eXBlX2luZm86OnNlYXJjaF9iZWxvd19kc3QoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQgY29uc3QqLCBpbnQsIGJvb2wpIGNvbnN0pAmBAV9fY3h4YWJpdjE6Ol9fYmFzZV9jbGFzc190eXBlX2luZm86OnNlYXJjaF9hYm92ZV9kc3QoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQgY29uc3QqLCB2b2lkIGNvbnN0KiwgaW50LCBib29sKSBjb25zdKUJdF9fY3h4YWJpdjE6Ol9fYmFzZV9jbGFzc190eXBlX2luZm86OnNlYXJjaF9iZWxvd19kc3QoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQgY29uc3QqLCBpbnQsIGJvb2wpIGNvbnN0pglyX19jeHhhYml2MTo6X19zaV9jbGFzc190eXBlX2luZm86OnNlYXJjaF9iZWxvd19kc3QoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQgY29uc3QqLCBpbnQsIGJvb2wpIGNvbnN0pwlvX19jeHhhYml2MTo6X19jbGFzc190eXBlX2luZm86OnNlYXJjaF9iZWxvd19kc3QoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQgY29uc3QqLCBpbnQsIGJvb2wpIGNvbnN0qAmAAV9fY3h4YWJpdjE6Ol9fdm1pX2NsYXNzX3R5cGVfaW5mbzo6c2VhcmNoX2Fib3ZlX2RzdChfX2N4eGFiaXYxOjpfX2R5bmFtaWNfY2FzdF9pbmZvKiwgdm9pZCBjb25zdCosIHZvaWQgY29uc3QqLCBpbnQsIGJvb2wpIGNvbnN0qQl/X19jeHhhYml2MTo6X19zaV9jbGFzc190eXBlX2luZm86OnNlYXJjaF9hYm92ZV9kc3QoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQgY29uc3QqLCB2b2lkIGNvbnN0KiwgaW50LCBib29sKSBjb25zdKoJfF9fY3h4YWJpdjE6Ol9fY2xhc3NfdHlwZV9pbmZvOjpzZWFyY2hfYWJvdmVfZHN0KF9fY3h4YWJpdjE6Ol9fZHluYW1pY19jYXN0X2luZm8qLCB2b2lkIGNvbnN0Kiwgdm9pZCBjb25zdCosIGludCwgYm9vbCkgY29uc3SrCQhfX3N0cmR1cKwJDV9fZ2V0VHlwZU5hbWWtCSpfX2VtYmluZF9yZWdpc3Rlcl9uYXRpdmVfYW5kX2J1aWx0aW5fdHlwZXOuCT92b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfaW50ZWdlcjxjaGFyPihjaGFyIGNvbnN0KimvCUZ2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfaW50ZWdlcjxzaWduZWQgY2hhcj4oY2hhciBjb25zdCopsAlIdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX2ludGVnZXI8dW5zaWduZWQgY2hhcj4oY2hhciBjb25zdCopsQlAdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX2ludGVnZXI8c2hvcnQ+KGNoYXIgY29uc3QqKbIJSXZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9pbnRlZ2VyPHVuc2lnbmVkIHNob3J0PihjaGFyIGNvbnN0KimzCT52b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfaW50ZWdlcjxpbnQ+KGNoYXIgY29uc3QqKbQJR3ZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9pbnRlZ2VyPHVuc2lnbmVkIGludD4oY2hhciBjb25zdCoptQk/dm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX2ludGVnZXI8bG9uZz4oY2hhciBjb25zdCoptglIdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX2ludGVnZXI8dW5zaWduZWQgbG9uZz4oY2hhciBjb25zdCoptwk+dm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX2Zsb2F0PGZsb2F0PihjaGFyIGNvbnN0Kim4CT92b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfZmxvYXQ8ZG91YmxlPihjaGFyIGNvbnN0Kim5CUN2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfbWVtb3J5X3ZpZXc8Y2hhcj4oY2hhciBjb25zdCopuglKdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX21lbW9yeV92aWV3PHNpZ25lZCBjaGFyPihjaGFyIGNvbnN0Kim7CUx2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfbWVtb3J5X3ZpZXc8dW5zaWduZWQgY2hhcj4oY2hhciBjb25zdCopvAlEdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX21lbW9yeV92aWV3PHNob3J0PihjaGFyIGNvbnN0Kim9CU12b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfbWVtb3J5X3ZpZXc8dW5zaWduZWQgc2hvcnQ+KGNoYXIgY29uc3QqKb4JQnZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9tZW1vcnlfdmlldzxpbnQ+KGNoYXIgY29uc3QqKb8JS3ZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9tZW1vcnlfdmlldzx1bnNpZ25lZCBpbnQ+KGNoYXIgY29uc3QqKcAJQ3ZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9tZW1vcnlfdmlldzxsb25nPihjaGFyIGNvbnN0KinBCUx2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfbWVtb3J5X3ZpZXc8dW5zaWduZWQgbG9uZz4oY2hhciBjb25zdCopwglEdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX21lbW9yeV92aWV3PGZsb2F0PihjaGFyIGNvbnN0KinDCUV2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfbWVtb3J5X3ZpZXc8ZG91YmxlPihjaGFyIGNvbnN0KinECW5FbXNjcmlwdGVuQmluZGluZ0luaXRpYWxpemVyX25hdGl2ZV9hbmRfYnVpbHRpbl90eXBlczo6RW1zY3JpcHRlbkJpbmRpbmdJbml0aWFsaXplcl9uYXRpdmVfYW5kX2J1aWx0aW5fdHlwZXMoKcUJCGRsbWFsbG9jxgkGZGxmcmVlxwkJZGxyZWFsbG9jyAkRdHJ5X3JlYWxsb2NfY2h1bmvJCQ1kaXNwb3NlX2NodW5rygkEc2Jya8sJBGZtb2TMCQVmbW9kbM0JBWxvZzEwzgkGbG9nMTBmzwkGc2NhbGJu0AkNX19mcGNsYXNzaWZ5bNEJBm1lbWNwedIJBm1lbXNldNMJB21lbW1vdmXUCQhzZXRUaHJld9UJCXN0YWNrU2F2ZdYJCnN0YWNrQWxsb2PXCQxzdGFja1Jlc3RvcmXYCRBfX2dyb3dXYXNtTWVtb3J52QkLZHluQ2FsbF92aWnaCQ1keW5DYWxsX3ZpaWlp2wkLZHluQ2FsbF9kaWTcCQxkeW5DYWxsX2RpaWTdCQ1keW5DYWxsX2RpZGRk3gkOZHluQ2FsbF9kaWlkZGTfCQxkeW5DYWxsX2RpZGTgCQ1keW5DYWxsX2RpaWRk4QkLZHluQ2FsbF9kaWniCQtkeW5DYWxsX3ZpZOMJDGR5bkNhbGxfdmlpZOQJDGR5bkNhbGxfZGlpaeUJDWR5bkNhbGxfZGlpaWnmCQ1keW5DYWxsX3ZpaWlk5wkNZHluQ2FsbF9kaWRpZOgJDmR5bkNhbGxfZGlpZGlk6QkOZHluQ2FsbF9kaWRpZGnqCQ9keW5DYWxsX2RpaWRpZGnrCQ1keW5DYWxsX3ZpZGlk7AkOZHluQ2FsbF92aWlkaWTtCQ5keW5DYWxsX3ZpZGlkZO4JD2R5bkNhbGxfdmlpZGlkZO8JD2R5bkNhbGxfdmlkaWRkZPAJEGR5bkNhbGxfdmlpZGlkZGTxCQ1keW5DYWxsX3ZpZGRk8gkOZHluQ2FsbF92aWlkZGTzCQ1keW5DYWxsX2lpaWlk9AkMZHluQ2FsbF92aWRk9QkNZHluQ2FsbF92aWlkZPYJDWR5bkNhbGxfaWlpaWn3CQ5keW5DYWxsX3ZpZmZpafgJD2R5bkNhbGxfdmlpZmZpafkJD2R5bkNhbGxfZGlkZGRkZPoJD2R5bkNhbGxfZGlkZGlkZPsJEGR5bkNhbGxfZGlpZGRpZGT8CRBkeW5DYWxsX2RpaWRkZGRk/QkPZHluQ2FsbF9kaWRkZGlp/gkQZHluQ2FsbF9kaWlkZGRpaf8JEWR5bkNhbGxfZGlkZGRkZGlpgAoSZHluQ2FsbF9kaWlkZGRkZGlpgQoMZHluQ2FsbF9kaWRpggoNZHluQ2FsbF9kaWlkaYMKD2R5bkNhbGxfZGlkaWRkZIQKEGR5bkNhbGxfZGlpZGlkZGSFCg1keW5DYWxsX2RpZGRphgoOZHluQ2FsbF9kaWlkZGmHCgxkeW5DYWxsX3ZpZGmICg1keW5DYWxsX3ZpaWRpiQoOZHluQ2FsbF92aWlpaWmKCgxkeW5DYWxsX2lpZmmLCg1keW5DYWxsX2lpaWZpjAoKZHluQ2FsbF9maY0KC2R5bkNhbGxfZmlpjgoNZHluQ2FsbF9maWlpaY8KDmR5bkNhbGxfZmlpaWlpkAoPZHluQ2FsbF92aWlpaWRkkQoQZHluQ2FsbF92aWlpaWlkZJIKDGR5bkNhbGxfdmlpZpMKDWR5bkNhbGxfdmlpaWaUCg1keW5DYWxsX2lpaWlmlQoOZHluQ2FsbF9kaWRkaWSWCg9keW5DYWxsX2RpaWRkaWSXCg9keW5DYWxsX2RpZGRkaWSYChBkeW5DYWxsX2RpaWRkZGlkmQoOZHluQ2FsbF9kaWRkZGmaCg9keW5DYWxsX2RpaWRkZGmbCgtkeW5DYWxsX2lpZJwKDWR5bkNhbGxfZGlkaWmdCg5keW5DYWxsX2RpaWRpaZ4KD2R5bkNhbGxfaWlkaWlpaZ8KDmR5bkNhbGxfaWlpaWlpoAoRZHluQ2FsbF9paWlpaWlpaWmhCg9keW5DYWxsX2lpaWlpaWmiCg5keW5DYWxsX2lpaWlpZKMKEGR5bkNhbGxfaWlpaWlpaWmkCg9keW5DYWxsX3ZpaWlpaWmlCglkeW5DYWxsX3amChhsZWdhbHN0dWIkZHluQ2FsbF92aWlqaWmnChZsZWdhbHN0dWIkZHluQ2FsbF9qaWppqAoYbGVnYWxzdHViJGR5bkNhbGxfaWlpaWlqqQoZbGVnYWxzdHViJGR5bkNhbGxfaWlpaWlqaqoKGmxlZ2Fsc3R1YiRkeW5DYWxsX2lpaWlpaWpqAHUQc291cmNlTWFwcGluZ1VSTGNodHRwOi8vbG9jYWxob3N0OjkwMDAvYXVkaW8td29ya2xldC9idWlsZC97e3sgRklMRU5BTUVfUkVQTEFDRU1FTlRfU1RSSU5HU19XQVNNX0JJTkFSWV9GSUxFIH19fS5tYXA=';
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




// STATICTOP = STATIC_BASE + 53120;
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
      return 53984;
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


