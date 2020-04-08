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




var wasmBinaryFile = 'data:application/octet-stream;base64,AGFzbQEAAAAB/AqkAWABfwF/YAF/AGACf38AYAJ/fwF/YAN/f38Bf2ADf39/AGAFf39/f38Bf2AAAGAEf39/fwF/YAZ/f39/f38Bf2AFf39/f38AYAR/f39/AGAAAX9gBn9/f39/fwBgCH9/f39/f39/AX9gAn98AGABfwF8YAJ/fAF8YAN/fHwBfGACfHwBfGAHf39/f39/fwF/YAF8AXxgBH98fHwBfGAHf39/f39/fwBgAn9/AXxgBH9/f3wAYAN/f3wAYAV/fn5+fgBgA39+fwF+YAF9AX1gA39/fwF8YAR/fHx/AXxgBn98fHx8fAF8YAp/f39/f39/f39/AGADf3x/AGAFf39/f34Bf2ADf3x/AXxgBXx8fHx8AXxgBX9/fn9/AGAFf39/f3wBf2AEf39/fwF+YAF/AX1gAn9/AX1gBH9/fH8BfGAFf398fH8BfGAGf3x/fHx8AXxgBX98fH98AXxgBX98fHx/AXxgA3x8fAF8YAh/f39/f39/fwBgB39/f39/fHwAYAZ/f39/fHwAYAR/f399AGAGf399fX9/AGAEf398fwBgBX9/fH98AGAGf398f3x8AGAHf398f3x8fABgBH9/fHwAYAV/f3x8fABgBH9+fn8AYAV/fX1/fwBgBH98f3wAYAV/fH98fABgBn98f3x8fABgA398fABgBH98fHwAYAp/f39/f39/f39/AX9gB39/f39/fn4Bf2AGf39/f35+AX9gBH9/f3wBf2AEf399fwF/YAN/fX8Bf2AGf3x/f39/AX9gBH9/f38BfWAFf39/f38BfWAEf39/fwF8YAN/f3wBfGAFf398f38BfGAFf398f3wBfGAGf398f3x/AXxgB39/fH98fHwBfGAEf398fAF8YAZ/f3x8f3wBfGAHf398fH98fAF8YAV/f3x8fAF8YAZ/f3x8fH8BfGAHf398fHx/fwF8YAd/f3x8fH98AXxgB39/fHx8fHwBfGAJf398fHx8fH9/AXxgBH98f38BfGAEf3x/fAF8YAV/fH98fwF8YAZ/fHx/fHwBfGAGf3x8fH9/AXxgBn98fHx/fAF8YAh/fHx8fHx/fwF8YA9/f39/f39/f39/f39/f38AYAN/f30AYAJ/fgBgCX9/f39/f39/fwF/YAt/f39/f39/f39/fwF/YAx/f39/f39/f39/f38Bf2AEf39/fQF/YAN/fn8Bf2ACf3wBf2ACfn8Bf2ACfn4Bf2ABfAF/YAF/AX5gBH9/f34BfmADf39/AX1gAn1/AX1gAXwBfWACfH8BfGADfHx/AXxgDH9/f39/f39/f39/fwBgDX9/f39/f39/f39/f38AYAh/f39/f398fABgBX9/f399AGAFf39/f3wAYAd/f399fX9/AGAFf39/fH8AYAZ/f398f3wAYAd/f398f3x8AGAIf39/fH98fHwAYAV/f398fABgBn9/f3x8fABgA39/fgBgBn9/fHx8fwBgA39+fgBgAn99AGAGf39/f398AX9gBX9/f399AX9gBX9/f31/AX9gA39/fAF/YAd/f3x/f39/AX9gA35/fwF/YAR+fn5+AX9gAn1/AX9gAnx/AX9gAn9/AX5gBn9/f39/fwF9YAJ+fgF9YAJ9fQF9YAV/f39/fwF8YAR/f398AXxgBX9/f3x/AXxgBn9/f3x/fwF8YAZ/f398f3wBfGAHf39/fH98fwF8YAh/f398f3x8fAF8YAV/f398fAF8YAZ/f398fH8BfGAHf39/fHx/fAF8YAh/f398fH98fAF8YAZ/f398fHwBfGAHf39/fHx8fwF8YAh/f398fHx/fwF8YAh/f398fHx/fAF8YAh/f398fHx8fAF8YAp/f398fHx8fH9/AXxgAn5+AXwClgktA2VudhZfZW1iaW5kX3JlZ2lzdGVyX2NsYXNzAHYDZW52Il9lbWJpbmRfcmVnaXN0ZXJfY2xhc3NfY29uc3RydWN0b3IADQNlbnYlX2VtYmluZF9yZWdpc3Rlcl9jbGFzc19jbGFzc19mdW5jdGlvbgAXA2Vudh9fZW1iaW5kX3JlZ2lzdGVyX2NsYXNzX3Byb3BlcnR5ACEDZW52H19lbWJpbmRfcmVnaXN0ZXJfY2xhc3NfZnVuY3Rpb24AMQNlbnYVX2VtYmluZF9yZWdpc3Rlcl9lbnVtAAsDZW52G19lbWJpbmRfcmVnaXN0ZXJfZW51bV92YWx1ZQAFA2VudhpfZW1iaW5kX3JlZ2lzdGVyX3NtYXJ0X3B0cgB1A2VudhhfX2N4YV9hbGxvY2F0ZV9leGNlcHRpb24AAANlbnYLX19jeGFfdGhyb3cABQNlbnYRX2VtdmFsX3Rha2VfdmFsdWUAAwNlbnYNX2VtdmFsX2luY3JlZgABA2Vudg1fZW12YWxfZGVjcmVmAAEDZW52C19lbXZhbF9jYWxsAAgDZW52BXJvdW5kABUDZW52BGV4aXQAAQNlbnYNX19hc3NlcnRfZmFpbAALA2VudgZfX2xvY2sAAQNlbnYIX191bmxvY2sAARZ3YXNpX3NuYXBzaG90X3ByZXZpZXcxCGZkX2Nsb3NlAAADZW52Cl9fc3lzY2FsbDUAAwNlbnYMX19zeXNjYWxsMjIxAAMDZW52C19fc3lzY2FsbDU0AAMWd2FzaV9zbmFwc2hvdF9wcmV2aWV3MQdmZF9yZWFkAAgWd2FzaV9zbmFwc2hvdF9wcmV2aWV3MQhmZF93cml0ZQAIFndhc2lfc25hcHNob3RfcHJldmlldzERZW52aXJvbl9zaXplc19nZXQAAxZ3YXNpX3NuYXBzaG90X3ByZXZpZXcxC2Vudmlyb25fZ2V0AAMDZW52Cl9fbWFwX2ZpbGUAAwNlbnYLX19zeXNjYWxsOTEAAwNlbnYKc3RyZnRpbWVfbAAGA2VudgVhYm9ydAAHA2VudhVfZW1iaW5kX3JlZ2lzdGVyX3ZvaWQAAgNlbnYVX2VtYmluZF9yZWdpc3Rlcl9ib29sAAoDZW52G19lbWJpbmRfcmVnaXN0ZXJfc3RkX3N0cmluZwACA2VudhxfZW1iaW5kX3JlZ2lzdGVyX3N0ZF93c3RyaW5nAAUDZW52Fl9lbWJpbmRfcmVnaXN0ZXJfZW12YWwAAgNlbnYYX2VtYmluZF9yZWdpc3Rlcl9pbnRlZ2VyAAoDZW52Fl9lbWJpbmRfcmVnaXN0ZXJfZmxvYXQABQNlbnYcX2VtYmluZF9yZWdpc3Rlcl9tZW1vcnlfdmlldwAFA2VudhZlbXNjcmlwdGVuX3Jlc2l6ZV9oZWFwAAADZW52FWVtc2NyaXB0ZW5fbWVtY3B5X2JpZwAEA2VudgtzZXRUZW1wUmV0MAABFndhc2lfc25hcHNob3RfcHJldmlldzEHZmRfc2VlawAGA2VudgZtZW1vcnkCAIAQA2VudgV0YWJsZQFwAMcHA6YKgAoHBwcHBwcHAAEADAIBAAsFAAIDBQACAAIADE1VUhgaAAxMGRAPAAIADE9QAAwQDxAPAAw3ODkADBFCOw8AAEYZFjAADEE6DxAQDxAPDwABDAALCAIBNQgAJSAlJTAWIAAMVFkADFda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DmR5bkNhbGxfZGlpZGlkAOgJDmR5bkNhbGxfZGlkaWRpAOkJD2R5bkNhbGxfZGlpZGlkaQDqCQ1keW5DYWxsX3ZpZGlkAOsJDmR5bkNhbGxfdmlpZGlkAOwJDmR5bkNhbGxfdmlkaWRkAO0JD2R5bkNhbGxfdmlpZGlkZADuCQ9keW5DYWxsX3ZpZGlkZGQA7wkQZHluQ2FsbF92aWlkaWRkZADwCQ1keW5DYWxsX3ZpZGRkAPEJDmR5bkNhbGxfdmlpZGRkAPIJDWR5bkNhbGxfaWlpaWQA8wkMZHluQ2FsbF9kZGRkAGsMZHluQ2FsbF92aWRkAPQJDWR5bkNhbGxfdmlpZGQA9QkMZHluQ2FsbF9paWlpAMgCDWR5bkNhbGxfaWlpaWkA9gkOZHluQ2FsbF92aWZmaWkA9wkPZHluQ2FsbF92aWlmZmlpAPgJDmR5bkNhbGxfZGRkZGRkAIkBD2R5bkNhbGxfZGlkZGRkZAD5CQ9keW5DYWxsX2RpZGRpZGQA+gkQZHluQ2FsbF9kaWlkZGlkZAD7CRBkeW5DYWxsX2RpaWRkZGRkAPwJD2R5bkNhbGxfZGlkZGRpaQD9CRBkeW5DYWxsX2RpaWRkZGlpAP4JEWR5bkNhbGxfZGlkZGRkZGlpAP8JEmR5bkNhbGxfZGlpZGRkZGRpaQCACgxkeW5DYWxsX2RpZGkAgQoNZHluQ2FsbF9kaWlkaQCCCgpkeW5DYWxsX2RkAJoBD2R5bkNhbGxfZGlkaWRkZACDChBkeW5DYWxsX2RpaWRpZGRkAIQKC2R5bkNhbGxfZGRkALIBDWR5bkNhbGxfZGlkZGkAhQoOZHluQ2FsbF9kaWlkZGkAhgoMZHluQ2FsbF92aWRpAIcKDWR5bkNhbGxfdmlpZGkAiAoOZHluQ2FsbF92aWlpaWkAiQoMZHluQ2FsbF9paWZpAIoKDWR5bkNhbGxfaWlpZmkAiwoKZHluQ2FsbF9maQCMCgtkeW5DYWxsX2ZpaQCNCg1keW5DYWxsX2ZpaWlpAI4KDmR5bkNhbGxfZmlpaWlpAI8KD2R5bkNhbGxfdmlpaWlkZACQChBkeW5DYWxsX3ZpaWlpaWRkAJEKDGR5bkNhbGxfdmlpZgCSCg1keW5DYWxsX3ZpaWlmAJMKDWR5bkNhbGxfaWlpaWYAlAoOZHluQ2FsbF9kaWRk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CwkAIAEgABEBAAsMACAAIAAoAgA2AgQLBQBBtCYLDQAgASACIAMgABEFAAsdAEGIhAIgATYCAEGEhAIgADYCAEGMhAIgAjYCAAsJAEGEhAIoAgALCwBBhIQCIAE2AgALNQEBfyABIAAoAgQiAkEBdWohASAAKAIAIQAgASACQQFxBH8gASgCACAAaigCAAUgAAsRAAALNwEBfyABIAAoAgQiA0EBdWohASAAKAIAIQAgASACIANBAXEEfyABKAIAIABqKAIABSAACxECAAsJAEGIhAIoAgALCwBBiIQCIAE2AgALCQBBjIQCKAIACwsAQYyEAiABNgIACwUAQawnCxIBAX9BMBDzCCIAQgA3AwggAAs3AQF/IAEgACgCBCIDQQF1aiEBIAAoAgAhACABIAIgA0EBcQR/IAEoAgAgAGooAgAFIAALEREACzsBAX8gASAAKAIEIgVBAXVqIQEgACgCACEAIAEgAiADIAQgBUEBcQR/IAEoAgAgAGooAgAFIAALERYACzkBAX8gASAAKAIEIgRBAXVqIQEgACgCACEAIAEgAiADIARBAXEEfyABKAIAIABqKAIABSAACxESAAs1AQF/IAEgACgCBCICQQF1aiEBIAAoAgAhACABIAJBAXEEfyABKAIAIABqKAIABSAACxEQAAs3AQF/IAEgACgCBCIDQQF1aiEBIAAoAgAhACABIAIgA0EBcQR/IAEoAgAgAGooAgAFIAALEQ8ACwUAQfAoCzwBAX9BOBDzCCIAQgA3AwAgAEIANwMwIABCADcDKCAAQgA3AyAgAEIANwMYIABCADcDECAAQgA3AwggAAs5AQF/IAEgACgCBCIEQQF1aiEBIAAoAgAhACABIAIgAyAEQQFxBH8gASgCACAAaigCAAUgAAsRHgALOQEBfyABIAAoAgQiBEEBdWohASAAKAIAIQAgASACIAMgBEEBcQR/IAEoAgAgAGooAgAFIAALERoACwcAIAArAzALCQAgACABOQMwCwcAIAAoAiwLCQAgACABNgIsCwUAQYAqCwwAQeiIKxDzCBCZAws7AQF/IAEgACgCBCIFQQF1aiEBIAAoAgAhACABIAIgAyAEIAVBAXEEfyABKAIAIABqKAIABSAACxFcAAs9AQF/IAEgACgCBCIGQQF1aiEBIAAoAgAhACABIAIgAyAEIAUgBkEBcQR/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PzcDSCAAQQA2AgggAEIANwMwQYSEAigCACEBIABBADYCdCAAQoCAgICAgID4PzcDeCAAQgA3AmwgACABNgJkIAALEAAgACgCcCAAKAJsa0EDdQs5AQF/IAEgACgCBCIEQQF1aiEBIAAoAgAhACABIAIgAyAEQQFxBH8gASgCACAAaigCAAUgAAsRBQALOQEBfyABIAAoAgQiBEEBdWohASAAKAIAIQAgASACIAMgBEEBcQR/IAEoAgAgAGooAgAFIAALEQQACzUBAX8gASAAKAIEIgJBAXVqIQEgACgCACEAIAEgAkEBcQR/IAEoAgAgAGooAgAFIAALEQEACwwAIAAgACgCbDYCcAs9AQF/IAEgACgCBCIGQQF1aiEBIAAoAgAhACABIAIgAyAEIAUgBkEBcQR/IAEoAgAgAGooAgAFIAALET0AC+UBAQR/IwBBEGsiBCQAIAEgACgCBCIGQQF1aiEHIAAoAgAhBSAGQQFxBEAgBygCACAFaigCACEFCyACKAIAIQAgBEEANgIIIARCADcDACAAQXBJBEACQAJAIABBC08EQCAAQRBqQXBxIgYQ8wghASAEIAZBgICAgHhyNgIIIAQgATYCACAEIAA2AgQMAQsgBCAAOgALIAQhASAARQ0BCyABIAJBBGogABDRCRoLIAAgAWpBADoAACAHIAQgAyAFEQQAIQAgBCwAC0F/TARAIAQoAgAQxgkLIARBEGokACAADwsQ9wgACwUAQbw0CygAIAEgAiAAIAIgAGMbIgAgACABYxsgAaEgAiABoaMgBCADoaIgA6ALFAAgASACIAMgBCAFIAAoAgARJQALKgAgBCADoyABIAIgACACIABjGyIAIAAgAWMbIAGhIAIgAaGjEOIEIAOiCy4AIAEgAiAAIAIgAGMbIgAgACABYxsgAaMQ4AQgAiABoxDgBKMgBCADoaIgA6ALHgACQCAAIAJkDQAgACICIAFjQQFzDQAgASECCyACCxAAIAEgAiADIAAoAgARMAALEQAgASACIAMgBCAFIAARJQALBQBBrDULEABB2AAQ8whBAEHYABDSCQs/AQF/IAEgACgCBCIHQQF1aiEBIAAoAgAhACABIAIgAyAEIAUgBiAHQQFxBH8gASgCACAAaigCAAUgAAsRXgALPwEBfyABIAAoAgQiB0EBdWohASAAKAIAIQAgASAC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BHRqIAIpAwA3AwAgAUEBaiEBIAJBCGoiAiADRw0ACwsgAEEBOgAYCwYAQfzFAAsPACAABEAgABD0AhDGCQsLbgEBf0GUARDzCCIAQgA3AlAgAEIANwIAIABCADcCeCAAQgA3AnAgAEIANwJoIABCADcCYCAAQgA3AlggAEIANwIIIABCADcCECAAQgA3AhggAEIANwIgIABCADcCKCAAQgA3AjAgAEEANgI4IAALOwEBfyABIAAoAgQiBUEBdWohASAAKAIAIQAgASACIAMgBCAFQQFxBH8gASgCACAAaigCAAUgAAsRCwALOQEBfyABIAAoAgQiBEEBdWohASAAKAIAIQAgASACIAMgBEEBcQR/IAEoAgAgAGooAgAFIAALEUgACzUBAX8gASAAKAIEIgJBAXVqIQEgACgCACEAIAEgAkEBcQR/IAEoAgAgAGooAgAFIAALESkAC7wBAQJ/IAEgACgCBCICQQF1aiEBIAAoAgAhACABIAJBAXEEfyABKAIAIABqKAIABSAACxEAACEBQQwQ8wgiAEEANgIIIABCADcCAAJAAkAgASgCBCABKAIAayICRQ0AIAJBAnUiA0GAgICABE8NASAAIAIQ8wgiAjYCACAAIAI2AgQgACACIANBAnRqNgIIIAEoAgQgASgCACIDayIBQQFIDQAgACACIAMgARDRCSABajYCBAsgAA8LEIwJAAsHACAAEN4DCwcAIABBDGoLCAAgACgCjAELBwAgACgCRAsIACAAKAKIAQsIACAAKAKEAQsGAEG8xwALWAEBfyAABEAgAEE8ahDnAyAAKAIYIgEEQCAAIAE2AhwgARDGCQsgACgCDCIBBEAgACABNgIQIAEQxgkLIAAoAgAiAQRAIAAgATYCBCABEMYJCyAAEMYJCwtZAQF/QfQAEPMIIgBCADcCRCAAQgA3AgAgAEIANwJsIABCADcCZCAAQgA3AlwgAEIANwJUIABCADcCTCAAQgA3AgggAEIANwIQIABCADcCGCAAQQA2AiAgAAs7AQF/IAEgACgCBCIFQQF1aiEBIAAoAgAhACABIAIgAyAEIAVBAXEEfyABKAIAIABqKAIABSAACxFKAAsGAEH0yAALVAEBfyAABEACQCAAKAIkIgFFDQAgARDGCSAAKAIAIgEEQCABEMYJCyAAKAIsIgFFDQAgARDGCQsgACgCMCIBBEAgACABNgI0IAEQxgkLIAAQxgkLCygBAX9BwAAQ8wgiAEIANwIsIABBADYCJCAAQQA2AgAgAEIANwI0IAALpgMCA38CfCMAQRBrIggkACAAIAU5AxggACAEOQMQIAAgAzYCCCAAIAI2AgRBhIQCKAIAIQYgACABNgIoIAAgBjYCICAAQQA2AiQgACACQQN0IgYQxQk2AgAgCEIANwMIAkAgACgCNCAAKAIwIgdrQQN1IgIgA0kEQCAAQTBqIAMgAmsgCEEIahCeAgwBCyACIANNDQAgACAHIANBA3RqNgI0CyAAIAMgBmwQxQk2AiwgACAAKAIguCABEJ8CAkAgACgCBCIDRQ0AIAAoAggiBkUNAEQYLURU+yEJQCADuCIEoyEFRAAAAAAAAPA/IASfoyEJRAAAAAAAAABAIASjnyEEIAAoAiwhB0EAIQEDQCABQQFqIQJBACEAAkAgAQRAIAUgAreiIQoDQCAHIAAgBmwgAWpBA3RqIAQgCiAAt0QAAAAAAADgP6CiENMEojkDACAAQQFqIgAgA0cNAAsMAQsDQCAHIAAgBmxBA3RqIAkgBSAAt0QAAAAAAADgP6CiENMEojkDACAAQQFqIgAgA0cNAAsLIAIiASAGRw0ACwsgCEEQaiQACz8BAX8gASAAKAIEIgdBAXVqIQEgACgCACEAIAEgAiADIAQgBSAGIAdBAXEEfyABKAIAIABqKAIABSAACxEzAAvVAQIHfwF8IAAgASgCABDtAyAAQTBqIQQgACgCCCICBEBBACEBIAAoAjBBACACQQN0ENIJIQMgACgCBCIFBEAgACgCACEGIAAoAiwhBwNAIAMgAUEDdGoiCCsDACEJQQAhAANAIAggByAAIAJsIAFqQQN0aisDACAGIABBA3RqKwMAoiAJoCIJOQMAIABBAWoiACAFRw0ACyABQQFqIgEgAkcNAAsLIAK4IQlBACEAA0AgAyAAQQN0aiIBIAErAwAgCaM5AwAgAEEBaiIAIAJHDQALCyAEC74BAQF/IAEgACgCBCIDQQF1aiEBIAAoAgAhACABIAIgA0EBcQR/IAEoAgAgAGooAgAFIAALEQMAIQFBDBDzCCIAQQA2AgggAEIANwIAAkACQCABKAIEIAEoAgBrIgJFDQAgAkEDdSIDQYCAgIACTw0BIAAgAhDzCCICNgIAIAAgAjYCBCAAIAIgA0EDdGo2AgggASgCBCABKAIAIgNrIgFBAUgNACAAIAIgAyABENEJIAFqNgIECyAADwsQjAkACwUAQdwYCyQBAX8gAARAIAAoAgAiAQRAIAAgATYCBCABEMYJCyAAEMYJCwsZAQF/QQwQ8wgiAEEANgIIIABCADcCACAACzABAX8gACgCBCICIAAoAghHBEAgAiABKAIANgIAIAAgAkEEajYCBA8LIAAgARDuAgtSAQJ/IwBBEGsiAyQAIAEgACgCBCIEQQF1aiEBIAAoAgAhACAEQQFxBEAgASgCACAAaigCACEACyADIAI2AgwgASADQQxqIAARAgAgA0EQaiQACz4BAn8gACgCBCAAKAIAIgRrQQJ1IgMgAUkEQCAAIAEgA2sgAhDvAg8LIAMgAUsEQCAAIAQgAUECdGo2AgQLC1QBAn8jAEEQayIEJAAgASAAKAIEIgVBAXVqIQEgACgCACEAIAVBAXEEQCABKAIAIABqKAIAIQALIAQgAzYCDCABIAIgBEEMaiAAEQUAIARBEGokAAsQACAAKAIEIAAoAgBrQQJ1C1EBAn8jAEEQayIDJABBASEEIAAgASgCBCABKAIAIgFrQQJ1IAJLBH8gAyABIAJBAnRqKAIANgIIQbT0ASADQQhqEAoFQQELNgIAIANBEGokAAs3AQF/IwBBEGsiAyQAIANBCGogASACIAAoAgARBQAgAygCCBALIAMoAggiABAMIANBEGokACAACxcAIAAoAgAgAUECdGogAigCADYCAEEBCzQBAX8jAEEQayIEJAAgACgCACEAIAQgAzYCDCABIAIgBEEMaiAAEQQAIQAgBEEQaiQAIAALBQBB8BsLMAEBfyAAKAIEIgIgACgCCEcEQCACIAEpAwA3AwAgACACQQhqNgIEDwsgACABEPACC1IBAn8jAEEQayIDJAAgASAAKAIEIgRBAXVqIQEgACgCACEAIARBAXEEQCABKAIAIABqKAIAIQALIAMgAjkDCCABIANBCGogABECACADQRBqJAALPgECfyAAKAIEIAAoAgAiBGtBA3UiAyABSQRAIAAgASADayACEJ4CDwsgAyABSwRAIAAgBCABQQN0ajYCBAsLVAECfyMAQRBrIgQkACABIAAoAgQiBUEBdWohASAAKAIAIQAgBUEBcQRAIAEoAgAgAGooAgAhAAsg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AgQgACAGNgIIIAAgAygCACIENgIAIAQgADYCBCADIAA2AgAgAyADKAIIQQFqNgIIC0QAAAAAAAAAACECIAMoAgQiACADRwRAA0AgACgCCCIEIAQoAgAoAgAREAAhAQJ/IAAoAggiBC0ABARAIAQEQCAEIAQoAgAoAggRAQALIAAoAgAiBCAAKAIEIgU2AgQgACgCBCAENgIAIAMgAygCCEF/ajYCCCAAEMYJIAUMAQsgACgCBAshACACIAGgIQIgACADRw0ACwsgAgs7AQF/IAEgACgCBCIFQQF1aiEBIAAoAgAhACABIAIgAyAEIAVBAXEEfyABKAIAIABqKAIABSAACxEfAAsGAEHo0AALDwAgAARAIAAQgQMQxgkLC00BAn8jAEEQayICJABBCBDzCCEDIAEQCyACIAE2AgggAkHUGiACQQhqEAo2AgAgAyAAIAIQggMhACACKAIAEAwgARAMIAJBEGokACAAC5wCAgN/AXxBOBDzCCIDQgA3AgQgA0HU1AA2AgAgAwJ/QYSEAigCALdEAAAAAAAA4D+iIgREAAAAAAAA8EFjIAREAAAAAAAAAABmcQRAIASrDAELQQALIgI2AiQgAyACQQJ0EMUJIgE2AigCQCACRQ0AIAFBADYCACACQQFGDQAgAUEANgIEIAJBAkYNACABQQA2AgggAkEDRg0AIAFBADYCDCACQQRGDQAgAUEANgIQIAJBBUYNACABQQA2AhQgAkEGRg0AIAFBADYCGEEHIQEgAkEHRg0AA0AgAygCKCABQQJ0akEANgIAIAFBAWoiASACRw0ACwsgA0IANwMwIANBADYCGCADQgA3AxAgACADNgIEIAAgA0EQajYCAAudAQEEfyAAKAIQIgMEQAJAIAMoAghFDQAgAygCBCICKAIAIgQgAygCACIFKAIENgIEIAUoAgQgBDYCACADQQA2AgggAiADRg0AA0AgAigCBCEEIAIQxgkgBCICIANHDQALCyADEMYJIABBADYCEAsgACABNgIMQRAQ8wgiAiABNgIMIAJBADYCCCACIAI2AgQgAiACNgIAIAAgAjYCEAvbAwICfwN8IAAgACsDAEQAAAAAAADwP6AiBzkDACAAIAAoAghBAWoiBjYCCAJAIAcgACgCDCIFKAJwIAUoAmxrQQN1uCIJZEUEQCAJIQggB0QAAAAAAAAAAGNB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CkkEQANAIAAoAgAiASwAACEDIAAgAUEBajYCACADIAJBCmxqQVBqIQIgASwAAUFQakEKSQ0ACwsgAgujAgACQAJAIAFBFEsNACABQXdqIgFBCUsNAAJAAkACQAJAAkACQAJAAkAgAUEBaw4JAQIJAwQFBgkHAAsgAiACKAIAIgFBBGo2AgAgACABKAIANgIADwsgAiACKAIAIgFBBGo2AgAgACABNAIANwMADwsgAiACKAIAIgFBBGo2AgAgACABNQIANwMADwsgAiACKAIAIgFBBGo2AgAgACABMgEANwMADwsgAiACKAIAIgFBBGo2AgAgACABMwEANwMADwsgAiACKAIAIgFBBGo2AgAgACABMAAANwMADwsgAiACKAIAIgFBBGo2AgAgACABMQAANwMADwsgACACIAMRAgALDwsgAiACKAIAQQdqQXhxIgFBCGo2AgAgACABKQMANwMAC3sBAX8jAEGAAmsiBSQAAkAgAiADTA0AIARBgMAEcQ0AIAUgASACIANrIgRBgAIgBEGAAkkiARsQ0gkaIAAgBSABBH8gBAUgAiADayEBA0AgACAFQYACEKEEIARBgH5qIgRB/wFLDQALIAFB/wFxCxChBAsgBUGAAmokAAstACAAUEUEQANAIAFBf2oiASAAp0EHcUEwcjoAACAAQgOIIgBCAFINAAsLIAELNQAgAFBFBEADQCABQX9qIgEgAKdBD3FBkPQAai0AACACcjoAACAAQgSIIgBCAFINAAsLIAELgwECA38BfgJAIABCgICAgBBUBEAgACEFDAELA0AgAUF/aiIBIAAgAEIKgCIFQgp+fadBMHI6AAAgAEL/////nwFWIQIgBSEAIAINAAsLIAWnIgIEQANAIAFBf2oiASACIAJBCm4iA0EKbGtBMHI6AAAgAkEJSyEEIAMhAiAEDQALCyABCxEAIAAgASACQeoEQesEEJ8EC4cXAxF/An4BfCMAQbAEayIJJAAgCUEANgIsAn8gAb0iF0J/VwRAIAGaIgG9IRdBASEUQaD0AAwBCyAEQYAQcQRAQQEhFEGj9AAMAQtBpvQAQaH0ACAEQQFxIhQbCyEWAkAgF0KAgICAgICA+P8Ag0KAgICAgICA+P8AUQRAIABBICACIBRBA2oiDyAEQf//e3EQpAQgACAWIBQQoQQgAEG79ABBv/QAIAVBBXZBAXEiAxtBs/QAQbf0ACADGyABIAFiG0EDEKEEDAELIAlBEGohEgJAAn8CQCABIAlBLGoQngQiASABoCIBRAAAAAAAAAAAYgRAIAkgCSgCLCIGQX9qNgIsIAVBIHIiEUHhAEcNAQwDCyAFQSByIhFB4QBGDQIgCSgCLCELQQYgAyADQQBIGwwBCyAJIAZBY2oiCzYCLCABRAAAAAAAALBBoiEBQQYgAyADQQBIGwshCiAJQTBqIAlB0AJqIAtBAEgbIg0hCANAIAgCfyABRAAAAAAAAPBBYyABRAAAAAAAAAAAZnEEQCABqwwBC0EACyIDNgIAIAhBBGohCCABIAO4oUQAAAAAZc3NQaIiAUQAAAAAAAAAAGINAAsCQCALQQFIBEAgCCEGIA0hBwwBCyANIQcDQCALQR0gC0EdSBshDAJAIAhBfGoiBiAHSQ0AIAytIRhCACEXA0AgBiAXQv////8PgyAGNQIAIBiGfCIXIBdCgJTr3AOAIhdCgJTr3AN+fT4CACAGQXxqIgYgB08NAAsgF6ciA0UNACAHQXxqIgcgAzYCAAsDQCAIIgYgB0sEQCAGQXxqIggoAgBFDQELCyAJIAkoAiwgDGsiCzYCLCAGIQggC0EASg0ACwsgC0F/TARAIApBGWpBCW1BAWohFSARQeYARiEPA0BBCUEAIAtrIAtBd0gbIRMCQCAHIAZPBEAgByAHQQRqIAcoAgAbIQcMAQtBgJTr3AMgE3YhDkF/IBN0QX9zIQxBACELIAchCANAIAggCCgCACIDIBN2IAtqNgIAIAMgDHEgDmwhCyAIQQRqIgggBkkNAAsgByAHQQRqIAcoAgAbIQcgC0UNACAGIAs2AgAgBkEEaiEGCyAJIAkoAiwgE2oiCzYCLCANIAcgDxsiAyAVQQJ0aiAGIAYgA2tBAnUgFUobIQYgC0EASA0ACwtBACEIAkAgByAGTw0AIA0gB2tBAnVBCWwhCEEKIQsgBygCACIDQQpJDQADQCAIQQFqIQggAyALQQpsIgtPDQALCyAKQQAgCCARQeYARhtrIBFB5wBGIApBAEdxayIDIAYgDWtBAnVBCWxBd2pIBEAgA0GAyABqIg5BCW0iDEECdCANakGEYGohEEEKIQMgDiAMQQlsayILQQdMBEADQCADQQpsIQMgC0EHSCEMIAtBAWohCyAMDQALCwJAQQAgBiAQQQRqIhVGIBAoAgAiDyAPIANuIg4gA2xrIhMbDQBEAAAAAAAA4D9EAAAAAAAA8D9EAAAAAAAA+D8gEyADQQF2IgxGG0QAAAAAAAD4PyAGIBVGGyATIAxJGyEZRAEAAAAAAEBDRAAAAAAAAEBDIA5BAXEbIQECQCAURQ0AIBYtAABBLUcNACAZmiEZIAGaIQELIBAgDyATayIMNgIAIAEgGaAgAWENACAQIAMgDGoiAzYCACADQYCU69wDTwRAA0AgEEEANgIAIBBBfGoiECAHSQRAIAdBfGoiB0EANgIACyAQIBAoAgBBAWoiAzYCACADQf+T69wDSw0ACwsgDSAHa0ECdUEJbCEIQQohCyAHKAIAIgNBCkkNAANAIAhBAWohCCADIAtBCmwiC08NAAsLIBBBBGoiAyAGIAYgA0sbIQYLAn8DQEEAIAYiDCAHTQ0BGiAMQXxqIgYoAgBFDQALQQELIRACQCARQecARwRAIARBCHEhEQwBCyAIQX9zQX8gCkEBIAobIgYgCEogCEF7SnEiAxsgBmohCkF/QX4gAxsgBWohBSAEQQhxIhENAEEJIQYCQCAQRQ0AIAxBfGooAgAiDkUNAEEKIQNBACEGIA5BCnANAANAIAZBAWohBiAOIANBCmwiA3BFDQALCyAMIA1rQQJ1QQlsQXdqIQMgBUEgckHmAEYEQEEAIREgCiADIAZrIgNBACADQQBKGyIDIAogA0gbIQoMAQtBACERIAogAyAIaiAGayIDQQAgA0EAShsiAyAKIANIGyEKCyAKIBFyIhNBAEchDyAAQSAgAgJ/IAhBACAIQQBKGyAFQSByIg5B5gBGDQAaIBIgCCAIQR91IgNqIANzrSASEKcEIgZrQQFMBEADQCAGQX9qIgZBMDoAACASIAZrQQJIDQALCyAGQX5qIhUgBToAACAGQX9qQS1BKyAIQQBIGzoAACASIBVrCyAKIBRqIA9qakEBaiIPIAQQpAQgACAWIBQQoQQgAEEwIAIgDyAEQYCABHMQpAQCQAJAAkAgDkHmAEYEQCAJQRBqQQhyIQMgCUEQakEJciEIIA0gByAHIA1LGyIFIQcDQCAHNQIAIAgQpwQhBgJAIAUgB0cEQCAGIAlBEGpNDQEDQCAGQX9qIgZBMDoAACAGIAlBEGpLDQALDAELIAYgCEcNACAJQTA6ABggAyEGCyAAIAYgCCAGaxChBCAHQQRqIgcgDU0NAAsgEwRAIABBw/QAQQEQoQQLIAcgDE8NASAKQQFIDQEDQCAHNQIAIAgQpwQiBiAJQRBqSwRAA0AgBkF/aiIGQTA6AAAgBiAJQRBqSw0ACwsgACAGIApBCSAKQQlIGxChBCAKQXdqIQYgB0EEaiIHIAxPDQMgCkEJSiEDIAYhCiADDQALDAILAkAgCkEASA0AIAwgB0EEaiAQGyEFIAlBEGpBCHIhAyAJQRBqQQlyIQ0gByEIA0AgDSAINQIAIA0QpwQiBkYEQCAJQTA6ABggAyEGCwJAIAcgCEcEQCAGIAlBEGpNDQEDQCAGQX9qIgZBMDoAACAGIAlBEGpLDQALDAELIAAgBkEBEKEEIAZBAWohBiARRUEAIApBAUgbDQAgAEHD9ABBARChBAsgACAGIA0gBmsiBiAKIAogBkobEKEEIAogBmshCiAIQQRqIgggBU8NASAKQX9KDQALCyAAQTAgCkESakESQQAQpAQgACAVIBIgFWsQoQQMAgsgCiEGCyAAQTAgBkEJakEJQQAQpAQLDAELIBZBCWogFiAFQSBxIg0bIQwCQCADQQtLDQBBDCADayIGRQ0ARAAAAAAAACBAIRkDQCAZRAAAAAAAADBAoiEZIAZBf2oiBg0ACyAMLQAAQS1GBEAgGSABmiAZoaCaIQEMAQsgASAZoCAZoSEBCyASIAkoAiwiBiAGQR91IgZqIAZzrSASEKcEIgZGBEAgCUEwOgAPIAlBD2ohBgsgFEECciEKIAkoAiwhCCAGQX5qIg4gBUEPajoAACAGQX9qQS1BKyAIQQBIGzoAACAEQQhxIQggCUEQaiEHA0AgByIFAn8gAZlEAAAAAAAA4EFjBEAgAaoMAQtBgICAgHgLIgZBkPQAai0AACANcjoAACABIAa3oUQAAAAAAAAwQKIhAQJAIAVBAWoiByAJQRBqa0EBRw0AAkAgCA0AIANBAEoNACABRAAAAAAAAAAAYQ0BCyAFQS46AAEgBUECaiEHCyABRAAAAAAAAAAAYg0ACyAAQSAgAiAKAn8CQCADRQ0AIAcgCWtBbmogA04NACADIBJqIA5rQQJqDAELIBIgCUEQamsgDmsgB2oLIgNqIg8gBBCkBCAAIAwgChChBCAAQTAgAiAPIARBgIAEcxCkBCAAIAlBEGogByAJQRBqayIFEKEEIABBMCADIAUgEiAOayIDamtBAEEAEKQEIAAgDiADEKEECyAAQSAgAiAPIARBgMAAcxCkBCAJQbAEaiQAIAIgDyAPIAJIGwspACABIAEoAgBBD2pBcHEiAUEQajYCACAAIAEpAwAgASkDCBDOBDkDAAsQACAAIAEgAkEAQQAQnwQaCwwAQZT5AhARQZz5AgtZAQF/IAAgAC0ASiIBQX9qIAFyOgBKIAAoAgAiAUEIcQRAIAAgAUEgcjYCAEF/DwsgAEIANwIEIAAgACgCLCIBNgIcIAAgATYCFCAAIAEgACgCMGo2AhBBAAsmAQF/IwBBEGsiAiQAIAIgATYCDCAAQfzgACABEKsEIAJBEGokAAt6AQF/IAAoAkxBAEgEQAJAIAAsAEtBCkYNACAAKAIUIgEgACgCEE8NACAAIAFBAWo2AhQgAUEKOgAADwsgABDHBA8LAkACQCAALABLQQpGDQAgACgCFCIBIAAoAhBPDQAgACABQQFqNgIUIAFBCjoAAAwBCyAAEMcECwtgAgJ/AX4gACgCKCEBQQEhAiAAQgAgAC0AAEGAAXEEf0ECQQEgACgCFCAAKAIcSxsFQQELIAERHAAiA0IAWQR+IAAoAhQgACgCHGusIAMgACgCCCAAKAIEa6x9fAUgAwsLGAAgACgCTEF/TARAIAAQsAQPCyAAELAECyQBAX4gABCxBCIBQoCAgIAIWQRAQdD4AkE9NgIAQX8PCyABpwt8AQJ/IAAgAC0ASiIBQX9qIAFyOgBKIAAoAhQgACgCHEsEQCAAQQBBACAAKAIkEQQAGgsgAEEANgIcIABCADcDECAAKAIAIgFBBHEEQCAAIAFBIHI2AgBBfw8LIAAgACgCLCAAKAIwaiICNgIIIAAgAjYCBCABQRt0QR91C78BAQN/IAMoAkxBAE4Ef0EBBUEACxogAyADLQBKIgVBf2ogBXI6AEoCfyABIAJsIgUgAygCCCADKAIEIgZrIgRBAUgNABogACAGIAQgBSAEIAVJGyIEENEJGiADIAMoAgQgBGo2AgQgACAEaiEAIAUgBGsLIgQEQANAAkAgAxCzBEUEQCADIAAgBCADKAIgEQQAIgZBAWpBAUsNAQsgBSAEayABbg8LIAAgBmohACAEIAZrIgQNAAsLIAJBACABGwt9ACACQQFGBEAgASAAKAIIIAAoAgRrrH0hAQsCQCAAKAIUIAAoAhxLBEAgAEEAQQAgACgCJBEEABogACgCFEUNAQsgAEEANgIcIABCADcDECAAIAEgAiAAKAIoERwAQgBTDQAgAEIANwIEIAAgACgCAEFvcTYCAEEADwtBfwsgACAAKAJMQX9MBEAgACABIAIQtQQPCyAAIAEgAhC1BAsNACAAIAGsQQAQtgQaCwkAIAAoAjwQEwteAQF/IAAoAkxBAEgEQCAAKAIEIgEgACgCCEkEQCAAIAFBAWo2AgQgAS0AAA8LIAAQygQPCwJ/IAAoAgQiASAAKAIISQRAIAAgAUEBajYCBCABLQAADAELIAAQygQLC48BAQN/IAAhAQJAAkAgAEEDcUUNACAALQAARQRADAILA0AgAUEBaiIBQQNxRQ0BIAEtAAANAAsMAQsDQCABIgJBBGohASACKAIAIgNBf3MgA0H//ft3anFBgIGChHhxRQ0ACyADQf8BcUUEQCACIQEMAQsDQCACLQABIQMgAkEBaiIBIQIgAw0ACwsgASAAawvbAQECfwJAIAFB/wFxIgMEQCAAQQNxBEADQCAALQAAIgJFDQMgAiABQf8BcUYNAyAAQQFqIgBBA3ENAAsLAkAgACgCACICQX9zIAJB//37d2pxQYCBgoR4cQ0AIANBgYKECGwhAwNAIAIgA3MiAkF/cyACQf/9+3dqcUGAgYKEeHENASAAKAIEIQIgAEEEaiEAIAJB//37d2ogAkF/c3FBgIGChHhxRQ0ACwsDQCAAIgItAAAiAwRAIAJBAWohACADIAFB/wFxRw0BCwsgAg8LIAAQugQgAGoPCyAACxoAIAAgARC7BCIAQQAgAC0AACABQf8BcUYbC4ABAQJ/QQIhAAJ/Qe3gAEErELwERQRAQe3gAC0AAEHyAEchAAsgAEGAAXILIABB7eAAQfgAELwEGyIAQYCAIHIgAEHt4ABB5QAQvAQbIgAgAEHAAHJB7eAALQAAIgBB8gBGGyIBQYAEciABIABB9wBGGyIBQYAIciABIABB4QBGGwuVAQECfyMAQRBrIgIkAAJAAkBBxfQAQe3gACwAABC8BEUEQEHQ+AJBHDYCAAwBCxC9BCEBIAJBtgM2AgggAiAANgIAIAIgAUGAgAJyNgIEQQAhAEEFIAIQFCIBQYFgTwRAQdD4AkEAIAFrNgIAQX8hAQsgAUEASA0BIAEQxQQiAA0BIAEQExoLQQAhAAsgAkEQaiQAIAALuwEBAn8jAEGgAWsiBCQAIARBCGpB0PQAQZABENEJGgJAAkAgAUF/akH/////B08EQCABDQFBASEBIARBnwFqIQALIAQgADYCNCAEIAA2AhwgBEF+IABrIgUgASABIAVLGyIBNgI4IAQgACABaiIANgIkIAQgADYCGCAEQQhqIAIgAxCoBCEAIAFFDQEgBCgCHCIBIAEgBCgCGEZrQQA6AAAMAQtB0PgCQT02AgBBfyEACyAEQaABaiQAIAALNAEBfyAAKAIUIgMgASACIAAoAhAgA2siASABIAJLGyIBENEJGiAAIAAoAhQgAWo2AhQgAgueAQEEfyAAKAJMQQBOBH9BAQVBAAsaIAAoAgBBAXEiBEUEQBCsBCEBIAAoAjQiAgRAIAIgACgCODYCOAsgACgCOCIDBEAgAyACNgI0CyAAIAEoAgBGBEAgASADNgIAC0GU+QIQEgsgABDIBCEBIAAgACgCDBEAACECIAAoAmAiAwRAIAMQxgkLIAEgAnIhASAERQRAIAAQxgkgAQ8LIAELBABBAAsEAEIAC/cBAQR/IwBBIGsiAyQAIAMgATYCECADIAIgACgCMCIEQQBHazYCFCAAKAIsIQUgAyAENgIcIAMgBTYCGAJAAkACfwJ/QQAgACgCPCADQRBqQQIgA0EMahAXIgRFDQAaQdD4AiAENgIAQX8LBEAgA0F/NgIMQX8MAQsgAygCDCIEQQBKDQEgBAshAiAAIAAoAgAgAkEwcUEQc3I2AgAMAQsgBCADKAIUIgZNBEAgBCECDAELIAAgACgCLCIFNgIEIAAgBSAEIAZrajYCCCAAKAIwRQ0AIAAgBUEBajYCBCABIAJqQX9qIAUtAAA6AAALIANBIGokACACC/UCAQN/IwBBMGsiAiQAAn8CQAJAQeT1AEHt4AAsAAAQvARFBEBB0PgCQRw2AgAMAQtBmAkQxQkiAQ0BC0EADAELIAFBAEGQARDSCRpB7eAAQSsQvARFBEAgAUEIQQRB7eAALQAAQfIARhs2AgALAkBB7eAALQAAQeEARwRAIAEoAgAhAwwBCyACQQM2AiQgAiAANgIgQd0BIAJBIGoQFSIDQYAIcUUEQCACQQQ2AhQgAiAANgIQIAIgA0GACHI2AhhB3QEgAkEQahAVGgsgASABKAIAQYABciIDNgIACyABQf8BOgBLIAFBgAg2AjAgASAANgI8IAEgAUGYAWo2AiwCQCADQQhxDQAgAkGTqAE2AgQgAiAANgIAIAIgAkEoajYCCEE2IAIQFg0AIAFBCjoASwsgAUHpBDYCKCABQegENgIkIAFB7wQ2AiAgAUHnBDYCDEHY+AIoAgBFBEAgAUF/NgJMCyABEMsECyEAIAJBMGokACAAC+8CAQZ/IwBBIGsiAyQAIAMgACgCHCIFNgIQIAAoAhQhBCADIAI2AhwgAyABNgIYIAMgBCAFayIBNgIUIAEgAmohBUECIQYgA0EQaiEBAn8CQAJAAn9BACAAKAI8IANBEGpBAiADQQxqEBgiBEUNABpB0PgCIAQ2AgBBfwtFBEADQCAFIAMoAgwiBEYNAiAEQX9MDQMgAUEIaiABIAQgASgCBCIHSyIIGyIBIAQgB0EAIAgbayIHIAEoAgBqNgIAIAEgASgCBCAHazYCBCAFIARrIQUCf0EAIAAoAjwgASAGIAhrIgYgA0EMahAYIgRFDQAaQdD4AiAENgIAQX8LRQ0ACwsgA0F/NgIMIAVBf0cNAQsgACAAKAIsIgE2AhwgACABNgIUIAAgASAAKAIwajYCECACDAELIABBADYCHCAAQgA3AxAgACAAKAIAQSByNgIAQQAgBkECRg0AGiACIAEoAgRrCyEAIANBIGokACAAC38BA38jAEEQayIBJAAgAUEKOgAPAkAgACgCECICRQRAIAAQrQQNASAAKAIQIQILAkAgACgCFCIDIAJPDQAgACwAS0EKRg0AIAAgA0EBajYCFCADQQo6AAAMAQsgACABQQ9qQQEgACgCJBEEAEEBRw0AIAEtAA8aCyABQRBqJAALfgECfyAABEAgACgCTEF/TARAIAAQyQQPCyAAEMkEDwtBkO8CKAIABEBBkO8CKAIAEMgEIQELEKwEKAIAIgAEQANAIAAoAkxBAE4Ef0EBBUEACxogACgCFCAAKAIcSwRAIAAQyQQgAXIhAQsgACgCOCIADQALC0GU+QIQEiABC2kBAn8CQCAAKAIUIAAoAhxNDQAgAEEAQQAgACgCJBEEABogACgCFA0AQX8PCyAAKAIEIgEgACgCCCICSQRAIAAgASACa6xBASAAKAIoERwAGgsgAEEANgIcIABCADcDECAAQgA3AgRBAAtBAQJ/IwBBEGsiASQAQX8hAgJAIAAQswQNACAAIAFBD2pBASAAKAIgEQQAQQFHDQAgAS0ADyECCyABQRBqJAAgAgsxAQJ/IAAQrAQiASgCADYCOCABKAIAIgIEQCACIAA2AjQLIAEgADYCAEGU+QIQEiAAC1ABAX4CQCADQcAAcQRAIAIgA0FAaq2IIQFCACECDAELIANFDQAgAkHAACADa62GIAEgA60iBIiEIQEgAiAEiCECCyAAIAE3AwAgACACNwMIC1ABAX4CQCADQcAAcQRAIAEgA0FAaq2GIQJCACEBDAELIANFDQAgAiADrSIEhiABQcAAIANrrYiEIQIgASAEhiEBCyAAIAE3AwAgACACNwMIC9kDAgJ/An4jAEEgayICJAACQCABQv///////////wCDIgVCgICAgICAwP9DfCAFQoCAgICAgMCAvH98VARAIAFCBIYgAEI8iIQhBCAAQv//////////D4MiAEKBgICAgICAgAhaBEAgBEKBgICAgICAgMAAfCEEDAILIARCgICAgICAgIBAfSEEIABCgICAgICAgIAIhUIAUg0BIARCAYMgBHwhBAwBCyAAUCAFQoCAgICAgMD//wBUIAVCgICAgICAwP//AFEbRQRAIAFCBIYgAEI8iIRC/////////wODQoCAgICAgID8/wCEIQQMAQtCgICAgICAgPj/ACEEIAVC////////v//DAFYNAEIAIQQgBUIwiKciA0GR9wBJDQAgAiAAIAFC////////P4NCgICAgICAwACEIgRBgfgAIANrEMwEIAJBEGogACAEIANB/4h/ahDNBCACKQMIQgSGIAIpAwAiAEI8iIQhBCACKQMQIAIpAxiEQgBSrSAAQv//////////D4OEIgBCgYCAgICAgIAIWgRAIARCAXwhBAwBCyAAQoCAgICAgICACIVCAFINACAEQgGDIAR8IQQLIAJBIGokACAEIAFCgICAgICAgICAf4OEvwuSAQEDfEQAAAAAAADwPyAAIACiIgJEAAAAAAAA4D+iIgOhIgREAAAAAAAA8D8gBKEgA6EgAiACIAIgAkSQFcsZoAH6PqJEd1HBFmzBVr+gokRMVVVVVVWlP6CiIAIgAqIiAyADoiACIAJE1DiIvun6qL2iRMSxtL2e7iE+oKJErVKcgE9+kr6goqCiIAAgAaKhoKAL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GC1EVPshGUBEGC1EVPshGcAgA0EASBsgALugENQEDAILIANBf0wEQETSITN/fNkSwCAAu6EQ1QQMAgsgALtE0iEzf3zZEsCgENUEDAELIAAgAJMgAUGAgID8B08NABogACACQQhqENYEQQNxIgFBAk0EQAJAAkACQCABQQFrDgIBAgALIAIrAwgQ1AQMAwsgAisDCJoQ1QQMAgsgAisDCBDUBIwMAQsgAisDCBDVBAshACACQRBqJAAgAAvUAQECfyMAQRBrIgEkAAJAIAC9QiCIp0H/////B3EiAkH7w6T/A00EQCACQYCAwPIDSQ0BIABEAAAAAAAAAABBABDSBCEADAELIAJBgIDA/wdPBEAgACAAoSEADAELIAAgARDRBEEDcSICQQJNBEACQAJAAkAgAkEBaw4CAQIACyABKwMAIAErAwhBARDSBCEADAMLIAErAwAgASsDCBDPBCEADAILIAErAwAgASsDCEEBENIEmiEADAELIAErAwAgASsDCBDPBJohAAsgAUEQaiQAIAALkgMCA38BfCMAQRBrIgIkAAJAIAC8IgNB/////wdxIgFB2p+k+gNNBEAgAUGAgIDMA0kNASAAuxDVBCEADAELIAFB0aftgwRNBEAgALshBCABQeOX24AETQRAIANBf0wEQCAERBgtRFT7Ifk/oBDUBIwhAAwDCyAERBgtRFT7Ifm/oBDUBCEADAILRBgtRFT7IQlARBgtRFT7IQnAIANBAEgbIASgmhDVBCEADAELIAFB1eOIhwRNBEAgALshBCABQd/bv4UETQRAIANBf0wEQCAERNIhM3982RJAoBDUBCEADAMLIARE0iEzf3zZEsCgENQEjCEADAILRBgtRFT7IRlARBgtRFT7IRnAIANBAEgbIASgENUEIQAMAQsgAUGAgID8B08EQCAAIACTIQAMAQsgACACQQhqENYEQQNxIgFBAk0EQAJAAkACQCABQQFrDgIBAgALIAIrAwgQ1QQhAAwDCyACKwMIENQEIQAMAgsgAisDCJoQ1QQhAAwBCyACKwMIENQEjCEACyACQRBqJAAgAAusAwMCfwF+AnwgAL0iBUKAgICAgP////8Ag0KBgICA8ITl8j9UIgRFBEBEGC1EVPsh6T8gAJogACAFQgBTIgMboUQHXBQzJqaBPCABmiABIAMboaAhACAFQj+IpyEDRAAAAAAAAAAAIQELIAAgACAAIACiIgeiIgZEY1VVVVVV1T+iIAcgBiAHIAeiIgYgBiAGIAYgBkRzU2Dby3XzvqJEppI3oIh+FD+gokQBZfLy2ERDP6CiRCgDVskibW0/oKJEN9YGhPRklj+gokR6/hARERHBP6AgByAGIAYgBiAGIAZE1Hq/dHAq+z6iROmn8DIPuBI/oKJEaBCNGvcmMD+gokQVg+D+yNtXP6CiRJOEbunjJoI/oKJE/kGzG7qhqz+goqCiIAGgoiABoKAiBqAhASAERQRAQQEgAkEBdGu3IgcgACAGIAEgAaIgASAHoKOhoCIAIACgoSIAmiAAIAMbDwsgAgR8RAAAAAAAAPC/IAGjIgcgB71CgICAgHCDvyIHIAYgAb1CgICAgHCDvyIBIAChoaIgByABokQAAAAAAADwP6CgoiAHoAUgAQsLhAEBAn8jAEEQayIBJAACQCAAvUIgiKdB/////wdxIgJB+8Ok/wNNBEAgAkGAgIDyA0kNASAARAAAAAAAAAAAQQAQ2gQhAAwBCyACQYCAwP8HTwRAIAAgAKEhAAwBCyAAIAEQ0QQhAiABKwMAIAErAwggAkEBcRDaBCEACyABQRBqJAAgAAv5AwMBfwF+A3wgAL0iAkIgiKdB/////wdxIgFBgIDAoARJBEACQAJ/IAFB///v/gNNBEBBfyABQYCAgPIDTw0BGgwCCyAAmSEAIAFB///L/wNNBEAgAUH//5f/A00EQCAAIACgRAAAAAAAAPC/oCAARAAAAAAAAABAoKMhAEEADAILIABEAAAAAAAA8L+gIABEAAAAAAAA8D+goyEAQQEMAQsgAUH//42ABE0EQCAARAAAAAAAAPi/oCAARAAAAAAAAPg/okQAAAAAAADwP6CjIQBBAgwBC0QAAAAAAADwvyAAoyEAQQMLIQEgACAAoiIEIASiIgMgAyADIAMgA0QvbGosRLSiv6JEmv3eUi3erb+gokRtmnSv8rCzv6CiRHEWI/7Gcby/oKJExOuYmZmZyb+goiEFIAQgAyADIAMgAyADRBHaIuM6rZA/okTrDXYkS3upP6CiRFE90KBmDbE/oKJEbiBMxc1Ftz+gokT/gwCSJEnCP6CiRA1VVVVVVdU/oKIhAyABQX9MBEAgACAAIAUgA6CioQ8LIAFBA3QiAUGQjAFqKwMAIAAgBSADoKIgAUGwjAFqKwMAoSAAoaEiAJogACACQgBTGyEACyAADwsgAEQYLURU+yH5PyAApiACQv///////////wCDQoCAgICAgID4/wBWGwvcAgICfwN9IAC8IgJB/////wdxIgFBgICA5ARJBEACQAJ/IAFB////9gNNBEBBfyABQYCAgMwDTw0BGgwCCyAAiyEAIAFB///f/ANNBEAgAUH//7/5A00EQCAAIACSQwAAgL+SIABDAAAAQJKVIQBBAAwCCyAAQwAAgL+SIABDAACAP5KVIQBBAQwBCyABQf//74AETQRAIABDAADAv5IgAEMAAMA/lEMAAIA/kpUhAEECDAELQwAAgL8gAJUhAEEDCyEBIAAgAJQiBCAElCIDIANDRxLavZRDmMpMvpKUIQUgBCADIANDJax8PZRDDfURPpKUQ6mqqj6SlCEDIAFBf0wEQCAAIAAgBSADkpSTDwsgAUECdCIBQdCMAWoqAgAgACAFIAOSlCABQeCMAWoqAgCTIACTkyIAjCAAIAJBAEgbIQALIAAPCyAAQ9oPyT8gAJggAUGAgID8B0sbC9MCAQR/AkAgAbwiBEH/////B3EiBUGAgID8B00EQCAAvCICQf////8HcSIDQYGAgPwHSQ0BCyAAIAGSDwsgBEGAgID8A0YEQCAAEN0EDwsgBEEedkECcSIEIAJBH3ZyIQICQAJAAkAgA0UEQAJAIAJBAmsOAgIAAwtD2w9JwA8LIAVBgICA/AdHBEAgBUUEQEPbD8k/IACYDwsgA0GAgID8B0dBACAFQYCAgOgAaiADTxtFBEBD2w/JPyAAmA8LAn0gA0GAgIDoAGogBUkEQEMAAAAAIAQNARoLIAAgAZWLEN0ECyEAIAJBAk0EQAJAAkAgAkEBaw4CAAEFCyAAjA8LQ9sPSUAgAEMuvbszkpMPCyAAQy69uzOSQ9sPScCSDwsgA0GAgID8B0YNAiACQQJ0QYCNAWoqAgAPC0PbD0lAIQALIAAPCyACQQJ0QfCMAWoqAgALxgICA38CfSAAvCICQR92IQMCQAJAAn0CQCAAAn8CQAJAIAJB/////wdxIgFB0Ni6lQRPBEAgAUGAgID8B0sEQCAADwsCQCACQQBIDQAgAUGY5MWVBEkNACAAQwAAAH+UDwsgAkF/Sg0BIAFBtOO/lgRNDQEMBgsgAUGZ5MX1A0kNAyABQZOrlPwDSQ0BCyAAQzuquD+UIANBAnRBkI0BaioCAJIiBItDAAAAT10EQCAEqAwCC0GAgICAeAwBCyADQQFzIANrCyIBsiIEQwByMb+UkiIAIARDjr6/NZQiBZMMAQsgAUGAgIDIA00NAkEAIQEgAAshBCAAIAQgBCAEIASUIgAgAEMVUjW7lEOPqio+kpSTIgCUQwAAAEAgAJOVIAWTkkMAAIA/kiEEIAFFDQAgBCABEIkEIQQLIAQPCyAAQwAAgD+SC50DAwN/AX4DfAJAAkACQAJAIAC9IgRCAFkEQCAEQiCIpyIBQf//P0sNAQsgBEL///////////8Ag1AEQEQAAAAAAADwvyAAIACiow8LIARCf1UNASAAIAChRAAAAAAAAAAAow8LIAFB//+//wdLDQJBgIDA/wMhAkGBeCEDIAFBgIDA/wNHBEAgASECDAILIASnDQFEAAAAAAAAAAAPCyAARAAAAAAAAFBDor0iBEIgiKchAkHLdyEDCyADIAJB4r4laiIBQRR2arciBkQAAOD+Qi7mP6IgBEL/////D4MgAUH//z9xQZ7Bmv8Daq1CIIaEv0QAAAAAAADwv6AiACAAIABEAAAAAAAAAECgoyIFIAAgAEQAAAAAAADgP6KiIgcgBSAFoiIFIAWiIgAgACAARJ/GeNAJmsM/okSveI4dxXHMP6CiRAT6l5mZmdk/oKIgBSAAIAAgAEREUj7fEvHCP6JE3gPLlmRGxz+gokRZkyKUJEnSP6CiRJNVVVVVVeU/oKKgoKIgBkR2PHk17znqPaKgIAehoKAhAAsgAAuQAgICfwJ9AkACQCAAvCIBQYCAgARPQQAgAUF/ShtFBEAgAUH/////B3FFBEBDAACAvyAAIACUlQ8LIAFBf0wEQCAAIACTQwAAAACVDwsgAEMAAABMlLwhAUHofiECDAELIAFB////+wdLDQFBgX8hAkMAAAAAIQAgAUGAgID8A0YNAQsgAiABQY32qwJqIgFBF3ZqsiIEQ4BxMT+UIAFB////A3FB84nU+QNqvkMAAIC/kiIAIAAgAEMAAABAkpUiAyAAIABDAAAAP5SUIgAgAyADlCIDIAMgA5QiA0Pu6ZE+lEOqqio/kpQgAyADQyaeeD6UQxPOzD6SlJKSlCAEQ9H3FzeUkiAAk5KSIQALIAAL1A8DCH8Cfgh8RAAAAAAAAPA/IQ0CQAJAAkAgAb0iCkIgiKciBEH/////B3EiAiAKpyIGckUNACAAvSILQiCIpyEHIAunIglFQQAgB0GAgMD/A0YbDQACQAJAIAdB/////wdxIgNBgIDA/wdLDQAgA0GAgMD/B0YgCUEAR3ENACACQYCAwP8HSw0AIAZFDQEgAkGAgMD/B0cNAQsgACABoA8LAkACfwJAAn9BACAHQX9KDQAaQQIgAkH///+ZBEsNABpBACACQYCAwP8DSQ0AGiACQRR2IQggAkGAgICKBEkNAUEAIAZBswggCGsiBXYiCCAFdCAGRw0AGkECIAhBAXFrCyIFIAZFDQEaDAILIAYNAUEAIAJBkwggCGsiBXYiBiAFdCACRw0AGkECIAZBAXFrCyEFIAJBgIDA/wdGBEAgA0GAgMCAfGogCXJFDQIgA0GAgMD/A08EQCABRAAAAAAAAAAAIARBf0obDwtEAAAAAAAAAAAgAZogBEF/ShsPCyACQYCAwP8DRgRAIARBf0oEQCAADwtEAAAAAAAA8D8gAKMPCyAEQYCAgIAERgRAIAAgAKIPCyAHQQBIDQAgBEGAgID/A0cNACAAnw8LIACZIQwCQCAJDQAgA0EAIANBgICAgARyQYCAwP8HRxsNAEQAAAAAAADwPyAMoyAMIARBAEgbIQ0gB0F/Sg0BIAUgA0GAgMCAfGpyRQRAIA0gDaEiACAAow8LIA2aIA0gBUEBRhsPCwJAIAdBf0oNACAFQQFLDQAgBUEBawRAIAAgAKEiACAAow8LRAAAAAAAAPC/IQ0LAnwgAkGBgICPBE8EQCACQYGAwJ8ETwRAIANB//+//wNNBEBEAAAAAAAA8H9EAAAAAAAAAAAgBEEASBsPC0QAAAAAAADwf0QAAAAAAAAAACAEQQBKGw8LIANB/v+//wNNBEAgDUScdQCIPOQ3fqJEnHUAiDzkN36iIA1EWfP4wh9upQGiRFnz+MIfbqUBoiAEQQBIGw8LIANBgYDA/wNPBEAgDUScdQCIPOQ3fqJEnHUAiDzkN36iIA1EWfP4wh9upQGiRFnz+MIfbqUBoiAEQQBKGw8LIAxEAAAAAAAA8L+gIgBEAAAAYEcV9z+iIg4gAERE3134C65UPqIgACAAokQAAAAAAADgPyAAIABEAAAAAAAA0L+iRFVVVVVVVdU/oKKhokT+gitlRxX3v6KgIgygvUKAgICAcIO/IgAgDqEMAQsgDEQAAAAAAABAQ6IiACAMIANBgIDAAEkiAhshDCAAvUIgiKcgAyACGyIFQf//P3EiBEGAgMD/A3IhAyAFQRR1Qcx3QYF4IAIbaiEFQQAhAgJAIARBj7EOSQ0AIARB+uwuSQRAQQEhAgwBCyADQYCAQGohAyAFQQFqIQULIAJBA3QiBEHAjQFqKwMAIhEgDL1C/////w+DIAOtQiCGhL8iDiAEQaCNAWorAwAiD6EiEEQAAAAAAADwPyAPIA6goyISoiIMvUKAgICAcIO/IgAgACAAoiITRAAAAAAAAAhAoCASIBAgACADQQF1QYCAgIACciACQRJ0akGAgCBqrUIghr8iEKKhIAAgDiAQIA+hoaKhoiIOIAwgAKCiIAwgDKIiACAAoiAAIAAgACAAIABE705FSih+yj+iRGXbyZNKhs0/oKJEAUEdqWB00T+gokRNJo9RVVXVP6CiRP+rb9u2bds/oKJEAzMzMzMz4z+goqAiD6C9QoCAgIBwg78iAKIiECAOIACiIAwgDyAARAAAAAAAAAjAoCAToaGioCIMoL1CgICAgHCDvyIARAAAAOAJx+4/oiIOIARBsI0BaisDACAARPUBWxTgLz6+oiAMIAAgEKGhRP0DOtwJx+4/oqCgIgygoCAFtyIPoL1CgICAgHCDvyIAIA+hIBGhIA6hCyEOIAEgCkKAgICAcIO/Ig+hIACiIAwgDqEgAaKgIgwgACAPoiIBoCIAvSIKpyECAkAgCkIgiKciA0GAgMCEBE4EQCADQYCAwPt7aiACcg0DIAxE/oIrZUcVlzygIAAgAaFkQQFzDQEMAwsgA0GA+P//B3FBgJjDhARJDQAgA0GA6Lz7A2ogAnINAyAMIAAgAaFlQQFzDQAMAwtBACECIA0CfCADQf////8HcSIEQYGAgP8DTwR+QQBBgIDAACAEQRR2QYJ4anYgA2oiBEH//z9xQYCAwAByQZMIIARBFHZB/w9xIgVrdiICayACIANBAEgbIQIgDCABQYCAQCAFQYF4anUgBHGtQiCGv6EiAaC9BSAKC0KAgICAcIO/IgBEAAAAAEMu5j+iIg0gDCAAIAGhoUTvOfr+Qi7mP6IgAEQ5bKgMYVwgvqKgIgygIgAgACAAIAAgAKIiASABIAEgASABRNCkvnJpN2Y+okTxa9LFQb27vqCiRCzeJa9qVhE/oKJEk72+FmzBZr+gokQ+VVVVVVXFP6CioSIBoiABRAAAAAAAAADAoKMgACAMIAAgDaGhIgCiIACgoaFEAAAAAAAA8D+gIgC9IgpCIIinIAJBFHRqIgNB//8/TARAIAAgAhDPCQwBCyAKQv////8PgyADrUIghoS/C6IhDQsgDQ8LIA1EnHUAiDzkN36iRJx1AIg85Dd+og8LIA1EWfP4wh9upQGiRFnz+MIfbqUBogszAQF/IAIEQCAAIQMDQCADIAEoAgA2AgAgA0EEaiEDIAFBBGohASACQX9qIgINAAsLIAALBABBAAsKACAAEOYEGiAAC2ABAn8gAEGYkAE2AgAgABDnBAJ/IAAoAhwiASABKAIEQX9qIgI2AgQgAkF/RgsEQCABIAEoAgAoAggRAQALIAAoAiAQxgkgACgCJBDGCSAAKAIwEMYJIAAoAjwQxgkgAAs8AQJ/IAAoAighAQNAIAEEQEEAIAAgAUF/aiIBQQJ0IgIgACgCJGooAgAgACgCICACaigCABEFAAwBCwsLCgAgABDlBBDGCQs7AQJ/IABB2I0BNgIAAn8gACgCBCIBIAEoAgRBf2oiAjYCBCACQX9GCwRAIAEgASgCACgCCBEBAAsgAAsKACAAEOkEEMYJCyoAIABB2I0BNgIAIABBBGoQ7wcgAEIANwIYIABCADcCECAAQgA3AgggAAsDAAELBAAgAAsQACAAQn83AwggAEIANwMACxAAIABCfzcDCCAAQgA3AwALgQIBBn8jAEEQayIEJAADQAJAIAYgAk4NAAJAIAAoAgwiAyAAKAIQIgVJBEAgBEH/////BzYCDCAEIAUgA2s2AgggBCACIAZrNgIEIwBBEGsiAyQAIARBBGoiBSgCACAEQQhqIgcoAgBIIQggA0EQaiQAIAUgByAIGyEDIwBBEGsiBSQAIAMoAgAgBEEMaiIHKAIASCEIIAVBEGokACADIAcgCBshAyABIAAoAgwgAygCACIDEPEEIAAgACgCDCADajYCDAwBCyAAIAAoAgAoAigRAAAiA0F/Rg0BIAEgAzoAAEEBIQMLIAEgA2ohASADIAZqIQYMAQsLIARBEGokACAGCxEAIAIEQCAAIAEgAhDRCRoLCwQAQX8LLAAgACAAKAIAKAIkEQAAQX9GBEBBfw8LIAAgACgCDCIAQQFqNgIMIAAtAAALBABBfwvOAQEGfyMAQRBrIgUkAANAAkAgBCACTg0AIAAoAhgiAyAAKAIcIgZPBEAgACABLQAAIAAoAgAoAjQRAwBBf0YNASAEQQFqIQQgAUEBaiEBDAILIAUgBiADazYCDCAFIAIgBGs2AggjAEEQayIDJAAgBUEIaiIGKAIAIAVBDGoiBygCAEghCCADQRBqJAAgBiAHIAgbIQMgACgCGCABIAMoAgAiAxDxBCAAIAMgACgCGGo2AhggAyAEaiEEIAEgA2ohAQwBCwsgBUEQaiQAIAQLOwECfyAAQZiOATYCAAJ/IAAoAgQiASABKAIEQX9qIgI2AgQgAkF/RgsEQCABIAEoAgAoAggRAQALIAALCgAgABD2BBDGCQsqACAAQZiOATYCACAAQQRqEO8HIABCADcCGCAAQgA3AhAgAEIANwIIIAALjwIBBn8jAEEQayIEJAADQAJAIAYgAk4NAAJ/IAAoAgwiAyAAKAIQIgVJBEAgBEH/////BzYCDCAEIAUgA2tBAnU2AgggBCACIAZrNgIEIwBBEGsiAyQAIARBBGoiBSgCACAEQQhqIgcoAgBIIQggA0EQaiQAIAUgByAIGyEDIwBBEGsiBSQAIAMoAgAgBEEMaiIHKAIASCEIIAVBEGokACADIAcgCBshAyABIAAoAgwgAygCACIDEPoEIAAgACgCDCADQQJ0ajYCDCABIANBAnRqDAELIAAgACgCACgCKBEAACIDQX9GDQEgASADNgIAQQEhAyABQQRqCyEBIAMgBmohBgwBCwsgBEEQaiQAIAYLFAAgAgR/IAAgASACEOMEBSAACxoLLAAgACAAKAIAKAIkEQAAQX9GBEBBfw8LIAAgACgCDCIAQQRqNgIMIAAoAgAL1gEBBn8jAEEQayIFJAADQAJAIAQgAk4NACAAKAIYIgMgACgCHCIGTwRAIAAgASgCACAAKAIAKAI0EQMAQX9GDQEgBEEBaiEEIAFBBGohAQwCCyAFIAYgA2tBAnU2AgwgBSACIARrNgIIIwBBEGsiAyQAIAVBCGoiBigCACAFQQxqIgcoAgBIIQggA0EQaiQAIAYgByAIGyEDIAAoAhggASADKAIAIgMQ+gQgACADQQJ0IgYgACgCGGo2AhggAyAEaiEEIAEgBmohAQwBCwsgBUEQaiQAIAQLDQAgAEEIahDlBBogAAsTACAAIAAoAgBBdGooAgBqEP0ECwoAIAAQ/QQQxgkLEwAgACAAKAIAQXRqKAIAahD/BAuOAQECfyMAQSBrIgMkACAAQQA6AAAgASABKAIAQXRqKAIAaiECAkAgASABKAIAQXRqKAIAaigCEEUEQCACKAJIBEAgASABKAIAQXRqKAIAaigCSBCCBQsgACABIAEoAgBBdGooAgBqKAIQRToAAAwBCyACIAIoAhhFIAIoAhBBBHJyNgIQCyADQSBqJAAgAAuHAQEDfyMAQRBrIgEkACAAIAAoAgBBdGooAgBqKAIYBEACQCABQQhqIAAQiAUiAi0AAEUNACAAIAAoAgBBdGooAgBqKAIYIgMgAygCACgCGBEAAEF/Rw0AIAAgACgCAEF0aigCAGoiACAAKAIYRSAAKAIQQQFycjYCEAsgAhCJBQsgAUEQaiQACwsAIABBqJMDEIsGCwwAIAAgARCKBUEBcws2AQF/An8gACgCACIAKAIMIgEgACgCEEYEQCAAIAAoAgAoAiQRAAAMAQsgAS0AAAtBGHRBGHULDQAgACgCABCLBRogAAsJACAAIAEQigULVgAgACABNgIEIABBADoAACABIAEoAgBBdGooAgBqKAIQRQRAIAEgASgCAEF0aigCAGooAkgEQCABIAEoAgBBdGooAgBqKAJIEIIFCyAAQQE6AAALIAALpQEBAX8CQCAAKAIEIgEgASgCAEF0aigCAGooAhhFDQAgACgCBCIBIAEoAgBBdGooAgBqKAIQDQAgACgCBCIBIAEoAgBBdGooAgBqKAIEQYDAAHFFDQAgACgCBCIBIAEoAgBBdGooAgBqKAIYIgEgASgCACgCGBEAAEF/Rw0AIAAoAgQiACAAKAIAQXRqKAIAaiIAIAAoAhhFIAAoAhBBAXJyNgIQCwsQACAAEKkFIAEQqQVzQQFzCzEBAX8gACgCDCIBIAAoAhBGBEAgACAAKAIAKAIoEQAADwsgACABQQFqNgIMIAEtAAALPwEBfyAAKAIYIgIgACgCHEYEQCAAIAFB/wFxIAAoAgAoAjQRAwAPCyAAIAJBAWo2AhggAiABOgAAIAFB/wFxC54BAQN/IwBBEGsiBCQAIABBADYCBCAEQQhqIAAQgQUtAAAhBSAAIAAoAgBBdGooAgBqIQMCQCAFBEAgACADKAIYIgMgASACIAMoAgAoAiARBAAiATYCBCABIAJGDQEgACAAKAIAQXRqKAIAaiIAIAAoAhhFIAAoAhBBBnJyNgIQDAELIAMgAygCGEUgAygCEEEEcnI2AhALIARBEGokAAuxAQEDfyMAQTBrIgIkACAAIAAoAgBBdGooAgBqIgMiBCAEKAIYRSADKAIQQX1xcjYCEAJAIAJBKGogABCBBS0AAEUNACACQRhqIAAgACgCAEF0aigCAGooAhgiAyABQQBBCCADKAIAKAIQESYAIAJCfzcDECACQgA3AwggAikDICACKQMQUg0AIAAgACgCAEF0aigCAGoiACAAKAIYRSAAKAIQQQRycjYCEAsgAkEwaiQAC4cBAQN/IwBBEGsiASQAIAAgACgCAEF0aigCAGooAhgEQAJAIAFBCGogABCUBSICLQAARQ0AIAAgACgCAEF0aigCAGooAhgiAyADKAIAKAIYEQAAQX9HDQAgACAAKAIAQXRqKAIAaiIAIAAoAhhFIAAoAhBBAXJyNgIQCyACEIkFCyABQRBqJAALCwAgAEGgkwMQiwYLDAAgACABEJUFQQFzCw0AIAAoAgAQlgUaIAALCQAgACABEJUFC1YAIAAgATYCBCAAQQA6AAAgASABKAIAQXRqKAIAaigCEEUEQCABIAEoAgBBdGooAgBqKAJIBEAgASABKAIAQXRqKAIAaigCSBCPBQsgAEEBOgAACyAACxAAIAAQqgUgARCqBXNBAXMLMQEBfyAAKAIMIgEgACgCEEYEQCAAIAAoAgAoAigRAAAPCyAAIAFBBGo2AgwgASgCAAs3AQF/IAAoAhgiAiAAKAIcRgRAIAAgASAAKAIAKAI0EQMADwsgACACQQRqNgIYIAIgATYCACABCw0AIABBBGoQ5QQaIAALEwAgACAAKAIAQXRqKAIAahCYBQsKACAAEJgFEMYJCxMAIAAgACgCAEF0aigCAGoQmgULCwAgAEH8kQMQiwYLLQACQCAAKAJMQX9HBEAgACgCTCEADAELIAAgABCeBSIANgJMCyAAQRh0QRh1C3QBA38jAEEQayIBJAAgASAAKAIcIgA2AgggACAAKAIEQQFqNgIEIAFBCGoQgwUiAEEgIAAoAgAoAhwRAwAhAgJ/IAEoAggiACAAKAIEQX9qIgM2AgQgA0F/RgsEQCAAIAAoAgAoAggRAQALIAFBEGokACACC60CAQZ/IwBBIGsiAyQAAkAgA0EYaiAAEIgFIgYtAABFDQAgACAAKAIAQXRqKAIAaigCBCEHIAMgACAAKAIAQXRqKAIAaigCHCICNgIQIAIgAigCBEEBajYCBCADQRBqEJwFIQUCfyADKAIQIgIgAigCBEF/aiIENgIEIARBf0YLBEAgAiACKAIAKAIIEQEACyADIAAgACgCAEF0aigCAGooAhg2AgggACAAKAIAQXRqKAIAaiICEJ0FIQQgAyAFIAMoAgggAiAEIAFB//8DcSICIAIgASAHQcoAcSIBQQhGGyABQcAARhsgBSgCACgCEBEGADYCECADKAIQDQAgACAAKAIAQXRqKAIAaiIBIAEoAhhFIAEoAhBBBXJyNgIQCyAGEIkFIANBIGokACAAC44CAQV/IwBBIGsiAiQAAkAgAkEYaiAAEIgFIgYtAABFDQAgACAAKAIAQXRqKAIAaigCBBogAiAAIAAoAgBBdGooAgBqKAIcIgM2AhAgAyADKAIEQQFqNgIEIAJBEGoQnAUhBQJ/IAIoAhAiAyADKAIEQX9qIgQ2AgQgBEF/RgsEQCADIAMoAgAoAggRAQALIAIgACAAKAIAQXRqKAIAaigCGDYCCCAAIAAoAgBBdGooAgBqIgMQnQUhBCACIAUgAigCCCADIAQgASAFKAIAKAIQEQYANgIQIAIoAhANACAAIAAoAgBBdGooAgBqIgEgASgCGEUgASgCEEEFcnI2AhALIAYQiQUgAkEgaiQAIAAL/AEBBX8jAEEgayICJAACQCACQRhqIAAQiAUiBi0AAEUNACACIAAgACgCAEF0aigCAGooAhwiAzYCECADIAMoAgRBAWo2AgQgAkEQahCcBSEFAn8gAigCECIDIAMoAgRBf2oiBDYCBCAEQX9GCwRAIAMgAygCACgCCBEBAAsgAiAAIAAoAgBBdGooAgBqKAIYNgIIIAAgACgCAEF0aigCAGoiAxCdBSEEIAIgBSACKAIIIAMgBCABIAUoAgAoAhgRBgA2AhAgAigCEA0AIAAgACgCAEF0aigCAGoiASABKAIYRSABKAIQQQVycjYCEAsgBhCJBSACQSBqJAAgAAskAQF/AkAgACgCACICRQ0AIAIgARCMBUF/Rw0AIABBADYCAAsLeQEDfyMAQRBrIgIkAAJAIAJBCGogABCIBSIDLQAARQ0AAn8gAiAAIAAoAgBBdGooAgBqKAIYNgIAIAIiBAsgARCiBSAEKAIADQAgACAAKAIAQXRqKAIAaiIAIAAoAhhFIAAoAhBBAXJyNgIQCyADEIkFIAJBEGokAAskAQF/AkAgACgCACICRQ0AIAIgARCXBUF/Rw0AIABBADYCAAsLHAAgAEIANwIAIABBADYCCCAAIAEgARC6BBD5CAsKACAAEOYEEMYJC0AAIABBADYCFCAAIAE2AhggAEEANgIMIABCgqCAgOAANwIEIAAgAUU2AhAgAEEgakEAQSgQ0gkaIABBHGoQ7wcLNQEBfyMAQRBrIgIkACACIAAoAgA2AgwgACABKAIANgIAIAEgAkEMaigCADYCACACQRBqJAALSwECfyAAKAIAIgEEQAJ/IAEoAgwiAiABKAIQRgRAIAEgASgCACgCJBEAAAwBCyACLQAAC0F/RwRAIAAoAgBFDwsgAEEANgIAC0EBC0sBAn8gACgCACIBBEACfyABKAIMIgIgASgCEEYEQCABIAEoAgAoAiQRAAAMAQsgAigCAAtBf0cEQCAAKAIARQ8LIABBADYCAAtBAQt9AQN/QX8hAgJAIABBf0YNACABKAJMQQBOBEBBASEECwJAAkAgASgCBCIDRQRAIAEQswQaIAEoAgQiA0UNAQsgAyABKAIsQXhqSw0BCyAERQ0BQX8PCyABIANBf2oiAjYCBCACIAA6AAAgASABKAIAQW9xNgIAIAAhAgsgAguHAwEBf0HklAEoAgAiABCuBRCvBSAAELAFELEFQeSPA0Hg9QAoAgAiAEGUkAMQsgVB6IoDQeSPAxCzBUGckAMgAEHMkAMQtAVBvIsDQZyQAxC1BUHUkANBqPAAKAIAIgBBhJEDELIFQZCMA0HUkAMQswVBuI0DQZCMAygCAEF0aigCAEGQjANqKAIYELMFQYyRAyAAQbyRAxC0BUHkjANBjJEDELUFQYyOA0HkjAMoAgBBdGooAgBB5IwDaigCGBC1BUG4iQMoAgBBdGooAgBBuIkDaiIAKAJIGiAAQeiKAzYCSEGQigMoAgBBdGooAgBBkIoDaiIAKAJIGiAAQbyLAzYCSEGQjAMoAgBBdGooAgBBkIwDaiIAIAAoAgRBgMAAcjYCBEHkjAMoAgBBdGooAgBB5IwDaiIAIAAoAgRBgMAAcjYCBEGQjAMoAgBBdGooAgBBkIwDaiIAKAJIGiAAQeiKAzYCSEHkjAMoAgBBdGooAgBB5IwDaiIAKAJIGiAAQbyLAzYCSAseAEHoigMQggVBvIsDEI8FQbiNAxCCBUGMjgMQjwULqQEBAn8jAEEQayIBJABB5I4DEOsEIQJBjI8DQZyPAzYCAEGEjwMgADYCAEHkjgNB8JQBNgIAQZiPA0EAOgAAQZSPA0F/NgIAIAEgAigCBCIANgIIIAAgACgCBEEBajYCBEHkjgMgAUEIakHkjgMoAgAoAggRAgACfyABKAIIIgAgACgCBEF/aiICNgIEIAJBf0YLBEAgACAAKAIAKAIIEQEACyABQRBqJAALSgBBwIkDQZiQATYCAEHAiQNBxJABNgIAQbiJA0HcjgE2AgBBwIkDQfCOATYCAEG8iQNBADYCAEHQjgEoAgBBuIkDakHkjgMQtgULqQEBAn8jAEEQayIBJABBpI8DEPgEIQJBzI8DQdyPAzYCAEHEjwMgADYCAEGkjwNB/JUBNgIAQdiPA0EAOgAAQdSPA0F/NgIAIAEgAigCBCIANgIIIAAgACgCBEEBajYCBEGkjwMgAUEIakGkjwMoAgAoAggRAgACfyABKAIIIgAgACgCBEF/aiICNgIEIAJBf0YLBEAgACAAKAIAKAIIEQEACyABQRBqJAALSgBBmIoDQZiQATYCAEGYigNBjJEBNgIAQZCKA0GMjwE2AgBBmIoDQaCPATYCAEGUigNBADYCAEGAjwEoAgBBkIoDakGkjwMQtgULmgEBA38jAEEQayIEJAAgABDrBCEDIAAgATYCICAAQeCWATYCACAEIAMoAgQiATYCCCABIAEoAgRBAWo2AgQgBEEIahC3BSEBAn8gBCgCCCIDIAMoAgRBf2oiBTYCBCAFQX9GCwRAIAMgAygCACgCCBEBAAsgACACNgIoIAAgATYCJCAAIAEgASgCACgCHBEAADoALCAEQRBqJAALPAEBfyAAQQRqIgJBmJABNgIAIAJBxJABNgIAIABBvI8BNgIAIAJB0I8BNgIAIABBsI8BKAIAaiABELYFC5oBAQN/IwBBEGsiBCQAIAAQ+AQhAyAAIAE2AiAgAEHIlwE2AgAgBCADKAIEIgE2AgggASABKAIEQQFqNgIEIARBCGoQuAUhAQJ/IAQoAggiAyADKAIEQX9qIgU2AgQgBUF/RgsEQCADIAMoAgAoAggRAQALIAAgAjYCKCAAIAE2AiQgACABIAEoAgAoAhwRAAA6ACwgBEEQaiQACzwBAX8gAEEEaiICQZiQATYCACACQYyRATYCACAAQeyPATYCACACQYCQATYCACAAQeCPASgCAGogARC2BQsXACAAIAEQpwUgAEEANgJIIABBfzYCTAsLACAAQbCTAxCLBgsLACAAQbiTAxCLBgsNACAAEOkEGiAAEMYJC0YAIAAgARC3BSIBNgIkIAAgASABKAIAKAIYEQAANgIsIAAgACgCJCIBIAEoAgAoAhwRAAA6ADUgACgCLEEJTgRAEKgHAAsLCQAgAEEAELwFC8IDAgd/AX4jAEEgayICJAACQCAALQA0BEAgACgCMCEDIAFFDQEgAEEAOgA0IABBfzYCMAwBCyACQQE2AhgjAEEQayIEJAAgAkEYaiIFKAIAIABBLGoiBigCAEghByAEQRBqJAAgBiAFIAcbKAIAIQQCQAJAAkADQCADIARIBEAgACgCIBC5BCIFQX9GDQIgAkEYaiADaiAFOgAAIANBAWohAwwBCwsCQCAALQA1BEAgAiACLQAYOgAXDAELQQEhBSACQRhqIQYCQAJAA0AgACgCKCIDKQIAIQkgACgCJCIHIAMgAkEYaiACQRhqIARqIgggAkEQaiACQRdqIAYgAkEMaiAHKAIAKAIQEQ4AQX9qIgNBAksNAgJAAkAgA0EBaw4CAwEACyAAKAIoIAk3AgAgBEEIRg0CIAAoAiAQuQQiA0F/Rg0CIAggAzoAACAEQQFqIQQMAQsLIAIgAi0AGDoAFwwBC0EAIQVBfyEDCyAFRQ0ECyABDQEDQCAEQQFIDQMgBEF/aiIEIAJBGGpqLQAAIAAoAiAQqwVBf0cNAAsLQX8hAwwCCyAAIAItABc2AjALIAItABchAwsgAkEgaiQAIAMLCQAgAEEBELwFC4YCAQN/IwBBIGsiAiQAIAAtADQhBAJAIAFBf0YEQCABIQMgBA0BIAAgACgCMCIDQX9GQQFzOgA0DAELIAQEQCACIAAoAjA6ABMCfwJAIAAoAiQiAyAAKAIoIAJBE2ogAkEUaiACQQxqIAJBGGogAkEgaiACQRRqIAMoAgAoAgwRDgBBf2oiA0ECTQRAIANBAmsNASAAKAIwIQMgAiACQRlqNgIUIAIgAzoAGAsDQEEBIAIoAhQiAyACQRhqTQ0CGiACIANBf2oiAzYCFCADLAAAIAAoAiAQqwVBf0cNAAsLQX8hA0EAC0UNAQsgAEEBOgA0IAAgATYCMCABIQMLIAJBIGokACADCw0AIAAQ9gQaIAAQxgkLRgAgACABELgFIgE2AiQgACABIAEoAgAoAhgRAAA2AiwgACAAKAIkIgEgASgCACgCHBEAADoANSAAKAIsQQlOBEAQqAcACwsJACAAQQAQwgULwgMCB38BfiMAQSBrIgIkAAJAIAAtADQEQCAAKAIwIQMgAUUNASAAQQA6ADQgAEF/NgIwDAELIAJBATYCGCMAQRBrIgQkACACQRhqIgUoAgAgAEEsaiIGKAIASCEHIARBEGokACAGIAUgBxsoAgAhBAJAAkACQANAIAMgBEgEQCAAKAIgELkEIgVBf0YNAiACQRhqIANqIAU6AAAgA0EBaiEDDAELCwJAIAAtADUEQCACIAIsABg2AhQMAQsgAkEYaiEGQQEhBQJAAkADQCAAKAIoIgMpAgAhCSAAKAIkIgcgAyACQRhqIAJBGGogBGoiCCACQRBqIAJBFGogBiACQQxqIAcoAgAoAhARDgBBf2oiA0ECSw0CAkACQCADQQFrDgIDAQALIAAoAiggCTcCACAEQQhGDQIgACgCIBC5BCIDQX9GDQIgCCADOgAAIARBAWohBAwBCwsgAiACLAAYNgIUDAELQQAhBUF/IQMLIAVFDQQLIAENAQNAIARBAUgNAyAEQX9qIgQgAkEYamosAAAgACgCIBCrBUF/Rw0ACwtBfyEDDAILIAAgAigCFDYCMAsgAigCFCEDCyACQSBqJAAgAwsJACAAQQEQwgULhgIBA38jAEEgayICJAAgAC0ANCEEAkAgAUF/RgRAIAEhAyAEDQEgACAAKAIwIgNBf0ZBAXM6ADQMAQsgBARAIAIgACgCMDYCEAJ/AkAgACgCJCIDIAAoAiggAkEQaiACQRRqIAJBDGogAkEYaiACQSBqIAJBFGogAygCACgCDBEOAEF/aiIDQQJNBEAgA0ECaw0BIAAoAjAhAyACIAJBGWo2AhQgAiADOgAYCwNAQQEgAigCFCIDIAJBGGpNDQIaIAIgA0F/aiIDNgIUIAMsAAAgACgCIBCrBUF/Rw0ACwtBfyEDQQALRQ0BCyAAQQE6ADQgACABNgIwIAEhAwsgAkEgaiQAIAMLLgAgACAAKAIAKAIYEQAAGiAAIAEQtwUiATYCJCAAIAEgASgCACgCHBEAADoALAuSAQEFfyMAQRBrIgEkACABQRBqIQQCQANAIAAoAiQiAiAAKAIoIAFBCGogBCABQQRqIAIoAgAoAhQRBgAhA0F/IQIgAUEIakEBIAEoAgQgAUEIamsiBSAAKAIgEJgEIAVHDQEgA0F/aiIDQQFNBEAgA0EBaw0BDAILC0F/QQAgACgCIBDIBBshAgsgAUEQaiQAIAILVQEBfwJAIAAtACxFBEADQCADIAJODQIgACABLQAAIAAoAgAoAjQRAwBBf0YNAiABQQFqIQEgA0EBaiEDDAAACwALIAFBASACIAAoAiAQmAQhAwsgAwuKAgEFfyMAQSBrIgIkAAJ/AkACQCABQX9GDQAgAiABOgAXIAAtACwEQCACQRdqQQFBASAAKAIgEJgEQQFGDQEMAgsgAiACQRhqNgIQIAJBIGohBSACQRhqIQYgAkEXaiEDA0AgACgCJCIEIAAoAiggAyAGIAJBDGogAkEYaiAFIAJBEGogBCgCACgCDBEOACEEIAIoAgwgA0YNAiAEQQNGBEAgA0EBQQEgACgCIBCYBEEBRw0DDAILIARBAUsNAiACQRhqQQEgAigCECACQRhqayIDIAAoAiAQmAQgA0cNAiACKAIMIQMgBEEBRg0ACwtBACABIAFBf0YbDAELQX8LIQAgAkEgaiQAIAALLgAgACAAKAIAKAIYEQAAGiAAIAEQuAUiATYCJCAAIAEgASgCACgCHBEAADoALAtVAQF/AkAgAC0ALEUEQANAIAMgAk4NAiAAIAEoAgAgACgCACgCNBEDAEF/Rg0CIAFBBGohASADQQFqIQMMAAALAAsgAUEEIAIgACgCIBCYBCEDCyADC4oCAQV/IwBBIGsiAiQAAn8CQAJAIAFBf0YNACACIAE2AhQgAC0ALARAIAJBFGpBBEEBIAAoAiAQmARBAUYNAQwCCyACIAJBGGo2AhAgAkEgaiEFIAJBGGohBiACQRRqIQMDQCAAKAIkIgQgACgCKCADIAYgAkEMaiACQRhqIAUgAkEQaiAEKAIAKAIMEQ4AIQQgAigCDCADRg0CIARBA0YEQCADQQFBASAAKAIgEJgEQQFHDQMMAgsgBEEBSw0CIAJBGGpBASACKAIQIAJBGGprIgMgACgCIBCYBCADRw0CIAIoAgwhAyAEQQFGDQALC0EAIAEgAUF/RhsMAQtBfwshACACQSBqJAAgAAtGAgJ/AX4gACABNwNwIAAgACgCCCICIAAoAgQiA2usIgQ3A3gCQCABUA0AIAQgAVcNACAAIAMgAadqNgJoDwsgACACNgJoC8IBAgN/AX4CQAJAIAApA3AiBFBFBEAgACkDeCAEWQ0BCyAAEMoEIgJBf0oNAQsgAEEANgJoQX8PCyAAKAIIIQECQAJAIAApA3AiBFANACAEIAApA3hCf4V8IgQgASAAKAIEIgNrrFkNACAAIAMgBKdqNgJoDAELIAAgATYCaAsCQCABRQRAIAAoAgQhAAwBCyAAIAApA3ggASAAKAIEIgBrQQFqrHw3A3gLIABBf2oiAC0AACACRwRAIAAgAjoAAAsgAgtsAQN+IAAgAkIgiCIDIAFCIIgiBH5CAHwgAkL/////D4MiAiABQv////8PgyIBfiIFQiCIIAIgBH58IgJCIIh8IAEgA34gAkL/////D4N8IgFCIIh8NwMIIAAgBUL/////D4MgAUIghoQ3AwAL+woCBX8EfiMAQRBrIgckAAJAAkACQAJAAkACQCABQSRNBEADQAJ/IAAoAgQiBCAAKAJoSQRAIAAgBEEBajYCBCAELQAADAELIAAQzQULIgQiBUEgRiAFQXdqQQVJcg0ACwJAIARBVWoiBUECSw0AIAVBAWtFDQBBf0EAIARBLUYbIQYgACgCBCIEIAAoAmhJBEAgACAEQQFqNgIEIAQtAAAhBAwBCyAAEM0FIQQLAkACQCABQW9xDQAgBEEwRw0AAn8gACgCBCIEIAAoAmhJBEAgACAEQQFqNgIEIAQtAAAMAQsgABDNBQsiBEEgckH4AEYEQAJ/IAAoAgQiASAAKAJoSQRAIAAgAUEBajYCBCABLQAADAELIAAQzQULIQRBECEBIARBsZgBai0AAEEQSQ0FIAAoAmhFBEBCACEDIAINCgwJCyAAIAAoAgQiAUF/ajYCBCACRQ0IIAAgAUF+ajYCBEIAIQMMCQsgAQ0BQQghAQwECyABQQogARsiASAEQbGYAWotAABLDQAgACgCaARAIAAgACgCBEF/ajYCBAtCACEDIABCABDMBUHQ+AJBHDYCAAwHCyABQQpHDQIgBEFQaiICQQlNBEBBACEBA0AgAUEKbCEFAn8gACgCBCIBIAAoAmhJBEAgACABQQFqNgIEIAEtAAAMAQsgABDNBQshBCACIAVqIQEgBEFQaiICQQlNQQAgAUGZs+bMAUkbDQALIAGtIQkLIAJBCUsNASAJQgp+IQogAq0hCwNAAn8gACgCBCIBIAAoAmhJBEAgACABQQFqNgIEIAEtAAAMAQsgABDNBQshBCAKIAt8IQkgBEFQaiICQQlLDQIgCUKas+bMmbPmzBlaDQIgCUIKfiIKIAKtIgtCf4VYDQALQQohAQwDC0HQ+AJBHDYCAEIAIQMMBQtBCiEBIAJBCU0NAQwCCyABIAFBf2pxBEAgASAEQbGYAWotAAAiAksEQEEAIQUDQCACIAEgBWxqIgVBxuPxOE1BACABAn8gACgCBCICIAAoAmhJBEAgACACQQFqNgIEIAItAAAMAQsgABDNBQsiBEGxmAFqLQAAIgJLGw0ACyAFrSEJCyABIAJNDQEgAa0hCgNAIAkgCn4iCyACrUL/AYMiDEJ/hVYNAgJ/IAAoAgQiAiAAKAJoSQRAIAAgAkEBajYCBCACLQAADAELIAAQzQULIQQgCyAMfCEJIAEgBEGxmAFqLQAAIgJNDQIgByAKIAkQzgUgBykDCFANAAsMAQsgAUEXbEEFdkEHcUGxmgFqLAAAIQggASAEQbGYAWotAAAiAksEQEEAIQUDQCACIAUgCHRyIgVB////P01BACABAn8gACgCBCICIAAoAmhJBEAgACACQQFqNgIEIAItAAAMAQsgABDNBQsiBEGxmAFqLQAAIgJLGw0ACyAFrSEJC0J/IAitIgqIIgsgCVQNACABIAJNDQADQCACrUL/AYMgCSAKhoQhCQJ/IAAoAgQiAiAAKAJoSQRAIAAgAkEBajYCBCACLQAADAELIAAQzQULIQQgCSALVg0BIAEgBEGxmAFqLQAAIgJLDQALCyABIARBsZgBai0AAE0NAANAIAECfyAAKAIEIgIgACgCaEkEQCAAIAJBAWo2AgQgAi0AAAwBCyAAEM0FC0GxmAFqLQAASw0AC0HQ+AJBxAA2AgAgBkEAIANCAYNQGyEGIAMhCQsgACgCaARAIAAgACgCBEF/ajYCBAsCQCAJIANUDQACQCADp0EBcQ0AIAYNAEHQ+AJBxAA2AgAgA0J/fCEDDAMLIAkgA1gNAEHQ+AJBxAA2AgAMAgsgCSAGrCIDhSADfSEDDAELQgAhAyAAQgAQzAULIAdBEGokACADC+UCAQZ/IwBBEGsiByQAIANBxJEDIAMbIgUoAgAhAwJAAkACQCABRQRAIAMNAQwDC0F+IQQgAkUNAiAAIAdBDGogABshBgJAIAMEQCACIQAMAQsgAS0AACIAQRh0QRh1IgNBAE4EQCAGIAA2AgAgA0EARyEEDAQLIAEsAAAhAEHI7QIoAgAoAgBFBEAgBiAAQf+/A3E2AgBBASEEDAQLIABB/wFxQb5+aiIAQTJLDQEgAEECdEHAmgFqKAIAIQMgAkF/aiIARQ0CIAFBAWohAQsgAS0AACIIQQN2IglBcGogA0EadSAJanJBB0sNAANAIABBf2ohACAIQYB/aiADQQZ0ciIDQQBOBEAgBUEANgIAIAYgAzYCACACIABrIQQMBAsgAEUNAiABQQFqIgEtAAAiCEHAAXFBgAFGDQALCyAFQQA2AgBB0PgCQRk2AgBBfyEEDAELIAUgAzYCAAsgB0EQaiQAIAQLywECBH8CfiMAQRBrIgMkACABvCIEQYCAgIB4cSEFAn4gBEH/////B3EiAkGAgIB8akH////3B00EQCACrUIZhkKAgICAgICAwD98DAELIAJBgICA/AdPBEAgBK1CGYZCgICAgICAwP//AIQMAQsgAkUEQEIADAELIAMgAq1CACACZyICQdEAahDNBCADKQMAIQYgAykDCEKAgICAgIDAAIVBif8AIAJrrUIwhoQLIQcgACAGNwMAIAAgByAFrUIghoQ3AwggA0EQaiQAC54LAgV/D34jAEHgAGsiBSQAIARCL4YgA0IRiIQhDyACQiCGIAFCIIiEIQ0gBEL///////8/gyIOQg+GIANCMYiEIRAgAiAEhUKAgICAgICAgIB/gyEKIA5CEYghESACQv///////z+DIgtCIIghEiAEQjCIp0H//wFxIQcCQAJ/IAJCMIinQf//AXEiCUF/akH9/wFNBEBBACAHQX9qQf7/AUkNARoLIAFQIAJC////////////AIMiDEKAgICAgIDA//8AVCAMQoCAgICAgMD//wBRG0UEQCACQoCAgICAgCCEIQoMAgsgA1AgBEL///////////8AgyICQoCAgICAgMD//wBUIAJCgICAgICAwP//AFEbRQRAIARCgICAgICAIIQhCiADIQEMAgsgASAMQoCAgICAgMD//wCFhFAEQCACIAOEUARAQoCAgICAgOD//wAhCkIAIQEMAwsgCkKAgICAgIDA//8AhCEKQgAhAQwCCyADIAJCgICAgICAwP//AIWEUARAIAEgDIQhAkIAIQEgAlAEQEKAgICAgIDg//8AIQoMAwsgCkKAgICAgIDA//8AhCEKDAILIAEgDIRQBEBCACEBDAILIAIgA4RQBEBCACEBDAILIAxC////////P1gEQCAFQdAAaiABIAsgASALIAtQIgYbeSAGQQZ0rXynIgZBcWoQzQQgBSkDWCILQiCGIAUpA1AiAUIgiIQhDSALQiCIIRJBECAGayEGCyAGIAJC////////P1YNABogBUFAayADIA4gAyAOIA5QIggbeSAIQQZ0rXynIghBcWoQzQQgBSkDSCICQg+GIAUpA0AiA0IxiIQhECACQi+GIANCEYiEIQ8gAkIRiCERIAYgCGtBEGoLIQYgD0L/////D4MiAiABQv////8PgyIBfiIPIANCD4ZCgID+/w+DIgMgDUL/////D4MiDH58IgRCIIYiDiABIAN+fCINIA5UrSACIAx+IhUgAyALQv////8PgyILfnwiEyAQQv////8PgyIOIAF+fCIQIAQgD1StQiCGIARCIIiEfCIUIAIgC34iFiADIBJCgIAEhCIPfnwiAyAMIA5+fCISIAEgEUL/////B4NCgICAgAiEIgF+fCIRQiCGfCIXfCEEIAcgCWogBmpBgYB/aiEGAkAgCyAOfiIYIAIgD358IgIgGFStIAIgASAMfnwiDCACVK18IAwgEyAVVK0gECATVK18fCICIAxUrXwgASAPfnwgASALfiILIA4gD358IgEgC1StQiCGIAFCIIiEfCACIAFCIIZ8IgEgAlStfCABIBEgElStIAMgFlStIBIgA1StfHxCIIYgEUIgiIR8IgMgAVStfCADIBQgEFStIBcgFFStfHwiAiADVK18IgFCgICAgICAwACDUEUEQCAGQQFqIQYMAQsgDUI/iCEDIAFCAYYgAkI/iIQhASACQgGGIARCP4iEIQIgDUIBhiENIAMgBEIBhoQhBAsgBkH//wFOBEAgCkKAgICAgIDA//8AhCEKQgAhAQwBCwJ+IAZBAEwEQEEBIAZrIgdB/wBNBEAgBUEQaiANIAQgBxDMBCAFQSBqIAIgASAGQf8AaiIGEM0EIAVBMGogDSAEIAYQzQQgBSACIAEgBxDMBCAFKQMwIAUpAziEQgBSrSAFKQMgIAUpAxCEhCENIAUpAyggBSkDGIQhBCAFKQMAIQIgBSkDCAwCC0IAIQEMAgsgAUL///////8/gyAGrUIwhoQLIAqEIQogDVAgBEJ/VSAEQoCAgICAgICAgH9RG0UEQCAKIAJCAXwiASACVK18IQoMAQsgDSAEQoCAgICAgICAgH+FhFBFBEAgAiEBDAELIAogAiACQgGDfCIBIAJUrXwhCgsgACABNwMAIAAgCjcDCCAFQeAAaiQAC38CAn8BfiMAQRBrIgMkACAAAn4gAUUEQEIADAELIAMgASABQR91IgJqIAJzIgKtQgAgAmciAkHRAGoQzQQgAykDCEKAgICAgIDAAIVBnoABIAJrrUIwhnwgAUGAgICAeHGtQiCGhCEEIAMpAwALNwMAIAAgBDcDCCADQRBqJAALyAkCBH8EfiMAQfAAayIFJAAgBEL///////////8AgyEKAkACQCABQn98IgtCf1EgAkL///////////8AgyIJIAsgAVStfEJ/fCILQv///////7///wBWIAtC////////v///AFEbRQRAIANCf3wiC0J/UiAKIAsgA1StfEJ/fCILQv///////7///wBUIAtC////////v///AFEbDQELIAFQIAlCgICAgICAwP//AFQgCUKAgICAgIDA//8AURtFBEAgAkKAgICAgIAghCEEIAEhAwwCCyADUCAKQoCAgICAgMD//wBUIApCgICAgICAwP//AFEbRQRAIARCgICAgICAIIQhBAwCCyABIAlCgICAgICAwP//AIWEUARAQoCAgICAgOD//wAgAiABIAOFIAIgBIVCgICAgICAgICAf4WEUCIGGyEEQgAgASAGGyEDDAILIAMgCkKAgICAgIDA//8AhYRQDQEgASAJhFAEQCADIAqEQgBSDQIgASADgyEDIAIgBIMhBAwCCyADIAqEUEUNACABIQMgAiEEDAELIAMgASADIAFWIAogCVYgCSAKURsiBxshCiAEIAIgBxsiC0L///////8/gyEJIAIgBCAHGyICQjCIp0H//wFxIQggC0IwiKdB//8BcSIGRQRAIAVB4ABqIAogCSAKIAkgCVAiBht5IAZBBnStfKciBkFxahDNBCAFKQNoIQkgBSkDYCEKQRAgBmshBgsgASADIAcbIQMgAkL///////8/gyEBIAgEfiABBSAFQdAAaiADIAEgAyABIAFQIgcbeSAHQQZ0rXynIgdBcWoQzQRBECAHayEIIAUpA1AhAyAFKQNYC0IDhiADQj2IhEKAgICAgICABIQhBCAJQgOGIApCPYiEIQEgAiALhSEMAn4gA0IDhiIDIAYgCGsiB0UNABogB0H/AEsEQEIAIQRCAQwBCyAFQUBrIAMgBEGAASAHaxDNBCAFQTBqIAMgBCAHEMwEIAUpAzghBCAFKQMwIAUpA0AgBSkDSIRCAFKthAshAyABQoCAgICAgIAEhCEJIApCA4YhAgJAIAxCf1cEQCACIAN9IgEgCSAEfSACIANUrX0iA4RQBEBCACEDQgAhBAwDCyADQv////////8DVg0BIAVBIGogASADIAEgAyADUCIHG3kgB0EGdK18p0F0aiIHEM0EIAYgB2shBiAFKQMoIQMgBSkDICEBDAELIAIgA3wiASADVK0gBCAJfHwiA0KAgICAgICACINQDQAgAUIBgyADQj+GIAFCAYiEhCEBIAZBAWohBiADQgGIIQMLIAtCgICAgICAgICAf4MhAiAGQf//AU4EQCACQoCAgICAgMD//wCEIQRCACEDDAELQQAhBwJAIAZBAEoEQCAGIQcMAQsgBUEQaiABIAMgBkH/AGoQzQQgBSABIANBASAGaxDMBCAFKQMAIAUpAxAgBSkDGIRCAFKthCEBIAUpAwghAwsgA0I9hiABQgOIhCIEIAGnQQdxIgZBBEutfCIBIARUrSADQgOIQv///////z+DIAKEIAetQjCGhHwgASABQgGDQgAgBkEERhsiAXwiAyABVK18IQQLIAAgAzcDACAAIAQ3AwggBUHwAGokAAuBAgICfwR+IwBBEGsiAiQAIAG9IgVCgICAgICAgICAf4MhBwJ+IAVC////////////AIMiBEKAgICAgICAeHxC/////////+//AFgEQCAEQjyGIQYgBEIEiEKAgICAgICAgDx8DAELIARCgICAgICAgPj/AFoEQCAFQjyGIQYgBUIEiEKAgICAgIDA//8AhAwBCyAEUARAQgAMAQsgAiAEQgAgBEKAgICAEFoEfyAEQiCIp2cFIAWnZ0EgagsiA0ExahDNBCACKQMAIQYgAikDCEKAgICAgIDAAIVBjPgAIANrrUIwhoQLIQQgACAGNwMAIAAgBCAHhDcDCCACQRBqJAAL2wECAX8CfkEBIQQCQCAAQgBSIAFC////////////AIMiBUKAgICAgIDA//8AViAFQoCAgICAgMD//wBRGw0AIAJCAFIgA0L///////////8AgyIGQoCAgICAgMD//wBWIAZCgICAgICAwP//AFEbDQAgACAChCAFIAaEhFAEQEEADwsgASADg0IAWQRAQX8hBCAAIAJUIAEgA1MgASADURsNASAAIAKFIAEgA4WEQgBSDwtBfyEEIAAgAlYgASADVSABIANRGw0AIAAgAoUgASADhYRCAFIhBAsgBAvYAQIBfwF+QX8hAgJAIABCAFIgAUL///////////8AgyIDQoCAgICAgMD//wBWIANCgICAgICAwP//AFEbDQAgACADQoCAgICAgID/P4SEUARAQQAPCyABQoCAgICAgID/P4NCAFkEQCAAQgBUIAFCgICAgICAgP8/UyABQoCAgICAgID/P1EbDQEgACABQoCAgICAgID/P4WEQgBSDwsgAEIAViABQoCAgICAgID/P1UgAUKAgICAgICA/z9RGw0AIAAgAUKAgICAgICA/z+FhEIAUiECCyACCzUAIAAgATcDACAAIAJC////////P4MgBEIwiKdBgIACcSACQjCIp0H//wFxcq1CMIaENwMIC2cCAX8BfiMAQRBrIgIkACAAAn4gAUUEQEIADAELIAIgAa1CAEHwACABZ0EfcyIBaxDNBCACKQMIQoCAgICAgMAAhSABQf//AGqtQjCGfCEDIAIpAwALNwMAIAAgAzcDCCACQRBqJAALRQEBfyMAQRBrIgUkACAFIAEgAiADIARCgICAgICAgICAf4UQ1AUgBSkDACEBIAAgBSkDCDcDCCAAIAE3AwAgBUEQaiQAC8QCAQF/IwBB0ABrIgQkAAJAIANBgIABTgRAIARBIGogASACQgBCgICAgICAgP//ABDSBSAEKQMoIQIgBCkDICEBIANB//8BSARAIANBgYB/aiEDDAILIARBEGogASACQgBCgICAgICAgP//ABDSBSADQf3/AiADQf3/AkgbQYKAfmohAyAEKQMYIQIgBCkDECEBDAELIANBgYB/Sg0AIARBQGsgASACQgBCgICAgICAwAAQ0gUgBCkDSCECIAQpA0AhASADQYOAfkoEQCADQf7/AGohAwwBCyAEQTBqIAEgAkIAQoCAgICAgMAAENIFIANBhoB9IANBhoB9ShtB/P8BaiEDIAQpAzghAiAEKQMwIQELIAQgASACQgAgA0H//wBqrUIwhhDSBSAAIAQpAwg3AwggACAEKQMANwMAIARB0ABqJAALjhECBX8MfiMAQcABayIFJAAgBEL///////8/gyESIAJC////////P4MhDCACIASFQoCAgICAgICAgH+DIREgBEIwiKdB//8BcSEHAkACQAJAIAJCMIinQf//AXEiCUF/akH9/wFNBEAgB0F/akH+/wFJDQELIAFQIAJC////////////AIMiCkKAgICAgIDA//8AVCAKQoCAgICAgMD//wBRG0UEQCACQoCAgICAgCCEIREMAgsgA1AgBEL///////////8AgyICQoCAgICAgMD//wBUIAJCgICAgICAwP//AFEbRQRAIARCgICAgICAIIQhESADIQEMAgsgASAKQoCAgICAgMD//wCFhFAEQCADIAJCgICAgICAwP//AIWEUARAQgAhAUKAgICAgIDg//8AIREMAwsgEUKAgICAgIDA//8AhCERQgAhAQwCCyADIAJCgICAgICAwP//AIWEUARAQgAhAQwCCyABIAqEUA0CIAIgA4RQBEAgEUKAgICAgIDA//8AhCERQgAhAQwCCyAKQv///////z9YBEAgBUGwAWogASAMIAEgDCAMUCIGG3kgBkEGdK18pyIGQXFqEM0EQRAgBmshBiAFKQO4ASEMIAUpA7ABIQELIAJC////////P1YNACAFQaABaiADIBIgAyASIBJQIggbeSAIQQZ0rXynIghBcWoQzQQgBiAIakFwaiEGIAUpA6gBIRIgBSkDoAEhAwsgBUGQAWogEkKAgICAgIDAAIQiFEIPhiADQjGIhCICQoTJ+c6/5ryC9QAgAn0iBBDOBSAFQYABakIAIAUpA5gBfSAEEM4FIAVB8ABqIAUpA4gBQgGGIAUpA4ABQj+IhCIEIAIQzgUgBUHgAGogBEIAIAUpA3h9EM4FIAVB0ABqIAUpA2hCAYYgBSkDYEI/iIQiBCACEM4FIAVBQGsgBEIAIAUpA1h9EM4FIAVBMGogBSkDSEIBhiAFKQNAQj+IhCIEIAIQzgUgBUEgaiAEQgAgBSkDOH0QzgUgBUEQaiAFKQMoQgGGIAUpAyBCP4iEIgQgAhDOBSAFIARCACAFKQMYfRDOBSAGIAkgB2tqIQYCfkIAIAUpAwhCAYYgBSkDAEI/iIRCf3wiCkL/////D4MiBCACQiCIIg5+IhAgCkIgiCIKIAJC/////w+DIgt+fCICQiCGIg0gBCALfnwiCyANVK0gCiAOfiACIBBUrUIghiACQiCIhHx8IAsgBCADQhGIQv////8PgyIOfiIQIAogA0IPhkKAgP7/D4MiDX58IgJCIIYiDyAEIA1+fCAPVK0gCiAOfiACIBBUrUIghiACQiCIhHx8fCICIAtUrXwgAkIAUq18fSILQv////8PgyIOIAR+IhAgCiAOfiINIAQgC0IgiCIPfnwiC0IghnwiDiAQVK0gCiAPfiALIA1UrUIghiALQiCIhHx8IA5CACACfSICQiCIIgsgBH4iECACQv////8PgyINIAp+fCICQiCGIg8gBCANfnwgD1StIAogC34gAiAQVK1CIIYgAkIgiIR8fHwiAiAOVK18IAJCfnwiECACVK18Qn98IgtC/////w+DIgIgDEIChiABQj6IhEL/////D4MiBH4iDiABQh6IQv////8PgyIKIAtCIIgiC358Ig0gDlStIA0gEEIgiCIOIAxCHohC///v/w+DQoCAEIQiDH58Ig8gDVStfCALIAx+fCACIAx+IhMgBCALfnwiDSATVK1CIIYgDUIgiIR8IA8gDUIghnwiDSAPVK18IA0gCiAOfiITIBBC/////w+DIhAgBH58Ig8gE1StIA8gAiABQgKGQvz///8PgyITfnwiFSAPVK18fCIPIA1UrXwgDyALIBN+IgsgDCAQfnwiDCAEIA5+fCIEIAIgCn58IgJCIIggAiAEVK0gDCALVK0gBCAMVK18fEIghoR8IgwgD1StfCAMIBUgDiATfiIEIAogEH58IgpCIIggCiAEVK1CIIaEfCIEIBVUrSAEIAJCIIZ8IARUrXx8IgQgDFStfCICQv////////8AWARAIAFCMYYgBEL/////D4MiASADQv////8PgyIKfiIMQgBSrX1CACAMfSIQIARCIIgiDCAKfiINIAEgA0IgiCILfnwiDkIghiIPVK19IAJC/////w+DIAp+IAEgEkL/////D4N+fCALIAx+fCAOIA1U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ACABIAIgAyAEQQIQkwchASADKAIAIQICQCABQX9qQQtLDQAgAkEEcQ0AIAAgATYCAA8LIAMgAkEEcjYCAAs8ACABIAIgAyAEQQMQkwchASADKAIAIQICQCABQe0CSg0AIAJBBHENACAAIAE2AgAPCyADIAJBBHI2AgALPgAgASACIAMgBEECEJMHIQEgAygCACECAkAgAUEMSg0AIAJBBHENACAAIAFBf2o2AgAPCyADIAJBBHI2AgALOwAgASACIAMgBEECEJMHIQEgAygCACECAkAgAUE7Sg0AIAJBBHENACAAIAE2AgAPCyADIAJBBHI2AgALkAEBAn8jAEEQayIEJAAgBCABNgIIA0ACQCAAIARBCGoQkQVFDQAgA0GAwAACfyAAKAIAIgEoAgwiBSABKAIQRgRAIAEgASgCACgCJBEAAAwBCyAFKAIACyADKAIAKAIMEQQARQ0AIAAQkgUaDAELCyAAIARBCGoQkwUEQCACIAIoAgBBAnI2AgALIARBEGokAAuuAQEBfwJ/IABBCGogACgCCCgCCBEAACIAIgYsAAtBAEgEQCAGKAIEDAELIAYtAAsLQQACfyAALAAXQQBIBEAgACgCEAwBCyAALQAXC2tGBEAgBCAEKAIAQQRyNgIADwsgAiADIAAgAEEYaiAFIARBABC1BiAAayEAAkAgASgCACICQQxHDQAgAA0AIAFBADYCAA8LAkAgAkELSg0AIABBDEcNACABIAJBDGo2AgALCzsAIAEgAiADIARBAhCTByEBIAMoAgAhAgJAIAFBPEoNACACQQRxDQAgACABNgIADwsgAyACQQRyNgIACzsAIAEgAiADIARBARCTByEBIAMoAgAhAgJAIAFBBkoNACACQQRxDQAgACABNgIADwsgAyACQQRyNgIACygAIAEgAiADIARBBBCTByEBIAMtAABBBHFFBEAgACABQZRxajYCAAsLSgAjAEGAAWsiAiQAIAIgAkH0AGo2AgwgAEEIaiACQRBqIAJBDGogBCAFIAYQogcgAkEQaiACKAIMIAEQpAchACACQYABaiQAIAALYgEBfyMAQRBrIgYkACAGQQA6AA8gBiAFOgAOIAYgBDoADSAGQSU6AAwgBQRAIAZBDWogBkEOahCjBwsgAiABIAIoAgAgAWsgBkEMaiADIAAoAgAQHSABajYCACAGQRBqJAALNQEBfyMAQRBrIgIkACACIAAtAAA6AA8gACABLQAAOgAAIAEgAkEPai0AADoAACACQRBqJAALRQEBfyMAQRBrIgMkACADIAI2AggDQCAAIAFHBEAgA0EIaiAALAAAEKIFIABBAWohAAwBCwsgAygCCCEAIANBEGokACAAC0oAIwBBoANrIgIkACACIAJBoANqNgIMIABBCGogAkEQaiACQQxqIAQgBSAGEKYHIAJBEGogAigCDCABEKkHIQAgAkGgA2okACAAC38BAX8jAEGQAWsiBiQAIAYgBkGEAWo2AhwgACAGQSBqIAZBHGogAyAEIAUQogcgBkIANwMQIAYgBkEgajYCDCABIAZBDGogAigCACABa0ECdSAGQRBqIAAoAgAQpwciAEF/RgRAEKgHAAsgAiABIABBAnRqNgIAIAZBkAFqJAALYwEBfyMAQRBrIgUkACAFIAQ2AgwgBUEIaiAFQQxqELIGIQQgACABIAIgAxD2BSEBIAQoAgAiAARAQcjtAigCABogAARAQcjtAkH8+AIgACAAQX9GGzYCAAsLIAVBEGokACABCwUAEB4AC0UBAX8jAEEQayIDJAAgAyACNgIIA0AgACABRwRAIANBCGogACgCABCkBSAAQQRqIQAMAQsLIAMoAgghACADQRBqJAAgAAsFAEH/AAsIACAAEJEGGgsVACAAQgA3AgAgAEEANgIIIAAQhAkLDAAgAEGChoAgNgAACwgAQf////8HCwwAIABBAUEtEOgGGgvtBAEBfyMAQaACayIAJAAgACABNgKYAiAAIAI2ApACIABBsQU2AhAgAEGYAWogAEGgAWogAEEQahCMBiEHIAAgBCgCHCIBNgKQASABIAEoAgRBAWo2AgQgAEGQAWoQgwUhASAAQQA6AI8BAkAgAEGYAmogAiADIABBkAFqIAQoAgQgBSAAQY8BaiABIAcgAEGUAWogAEGEAmoQsQdFDQAgAEH7vgEoAAA2AIcBIABB9L4BKQAANwOAASABIABBgAFqIABBigFqIABB9gBqIAEoAgAoAiARCAAaIABBsAU2AhAgAEEIakEAIABBEGoQjAYhASAAQRBqIQICQCAAKAKUASAHKAIAa0HjAE4EQCAAKAKUASAHKAIAa0ECahDFCSEDIAEoAgAhAiABIAM2AgAgAgRAIAIgASgCBBEBAAsgASgCAEUNASABKAIAIQILIAAtAI8BBEAgAkEtOgAAIAJBAWohAgsgBygCACEEA0ACQCAEIAAoApQBTwRAIAJBADoAACAAIAY2AgAgAEEQaiAAEPAFQQFHDQEgASgCACECIAFBADYCACACBEAgAiABKAIEEQEACwwECyACIABB9gBqIABBgAFqIAQQsQYgAGsgAGotAAo6AAAgAkEBaiECIARBAWohBAwBCwsQqAcACxCoBwALIABBmAJqIABBkAJqEIcFBEAgBSAFKAIAQQJyNgIACyAAKAKYAiECAn8gACgCkAEiASABKAIEQX9qIgM2AgQgA0F/RgsEQCABIAEoAgAoAggRAQALIAcoAgAhASAHQQA2AgAgAQRAIAEgBygCBBEBAAsgAEGgAmokACACC7MSAQh/IwBBsARrIgskACALIAo2AqQEIAsgATYCqAQgC0GxBTYCaCALIAtBiAFqIAtBkAFqIAtB6ABqEIwGIg8oAgAiATYChAEgCyABQZADajYCgAEgC0HoAGoQkQYhESALQdgAahCRBiEOIAtByABqEJEGIQwgC0E4ahCRBiENIAtBKGoQkQYhECACIAMgC0H4AGogC0H3AGogC0H2AGogESAOIAwgDSALQSRqELIHIAkgCCgCADYCACAEQYAEcSESQQAhAUEAIQQDQCAEIQoCQAJAAkACQCABQQRGDQAgACALQagEahCEBUUNACALQfgAaiABaiwAACICQQRLDQJBACEEAkACQAJAAkACQAJAIAJBAWsOBAAEAwUBCyABQQNGDQcgABCFBSICQQBOBH8gBygCCCACQf8BcUEBdGovAQBBgMAAcQVBAAsEQCALQRhqIAAQswcgECALLAAYEIMJDAILIAUgBSgCAEEEcjYCAEEAIQAMBgsgAUEDRg0GCwNAIAAgC0GoBGoQhAVFDQYgABCFBSICQQBOBH8gBygCCCACQf8BcUEBdGovAQBBgMAAcUEARwVBAAtFDQYgC0EYaiAAELMHIBAgCywAGBCDCQwAAAsACwJ/IAwsAAtBAEgEQCAMKAIEDAELIAwtAAsLQQACfyANLAALQQBIBEAgDSgCBAwBCyANLQALC2tGDQQCQAJ/IAwsAAtBAEgEQCAMKAIEDAELIAwtAAsLBEACfyANLAALQQBIBEAgDSgCBAwBCyANLQALCw0BCwJ/IAwsAAtBAEgE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QSBqJAALCwAgAEG0kgMQiwYLIAAgABDsCCAAIAEoAgg2AgggACABKQIANwIAIAEQsAYLCwAgAEGskgMQiwYLfgEBfyMAQSBrIgMkACADIAE2AhAgAyAANgIYIAMgAjYCCANAAkACf0EBIAMoAhggAygCEEZBAXNFDQAaIAMoAhgtAAAgAygCCC0AAEYNAUEACyEAIANBIGokACAADwsgAyADKAIYQQFqNgIYIAMgAygCCEEBajYCCAwAAAsACzQBAX8jAEEQayICJAAgAiAAKAIANgIIIAIgAigCCCABajYCCCACKAIIIQAgAkEQaiQAIAALPQECfyABKAIAIQIgAUEANgIAIAIhAyAAKAIAIQIgACADNgIAIAIEQCACIAAoAgQRAQALIAAgASgCBDYCBAv7BAEBfyMAQfAEayIAJAAgACABNgLoBCAAIAI2AuAEIABBsQU2AhAgAEHIAWogAEHQAWogAEEQahCMBiEHIAAgBCgCHCIBNgLAASABIAEoAgRBAWo2AgQgAEHAAWoQkAUhASAAQQA6AL8BAkAgAEHoBGogAiADIABBwAFqIAQoAgQgBSAAQb8BaiABIAcgAEHEAWogAEHgBGoQwAdFDQAgAEH7vgEoAAA2ALcBIABB9L4BKQAANwOwASABIABBsAFqIABBugFqIABBgAFqIAEoAgAoAjARCAAaIABBsAU2AhAgAEEIakEAIABBEGoQjAYhASAAQRBqIQICQCAAKALEASAHKAIAa0GJA04EQCAAKALEASAHKAIAa0ECdUECahDFCSEDIAEoAgAhAiABIAM2AgAgAgRAIAIgASgCBBEBAAsgASgCAEUNASABKAIAIQILIAAtAL8BBEAgAkEtOgAAIAJBAWohAgsgBygCACEEA0ACQCAEIAAoAsQBTwRAIAJBADoAACAAIAY2AgAgAEEQaiAAEPAFQQFHDQEgASgCACECIAFBADYCACACBEAgAiABKAIEEQEACwwECyACIABBsAFqIABBgAFqIABBqAFqIAQQzAYgAEGAAWprQQJ1ai0AADoAACACQQFqIQIgBEEEaiEEDAELCxCoBwALEKgHAAsgAEHoBGogAEHgBGoQkwUEQCAFIAUoAgBBAnI2AgALIAAoAugEIQICfyAAKALAASIBIAEoAgRBf2oiAzYCBCADQX9GCwRAIAEgASgCACgCCBEB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AWohAQwAAAsAC6UDAQF/IwBBEGsiCiQAIAkCfyAABEAgCiABEMYHIgAiASABKAIAKAIsEQIAIAIgCigCADYAACAKIAAgACgCACgCIBECACAIIAoQxwcgChD6CBogCiAAIAAoAgAoAhwRAgAgByAKEMcHIAoQ+ggaIAMgACAAKAIAKAIMEQAANgIAIAQgACAAKAIAKAIQEQAANgIAIAogACAAKAIAKAIUEQIAIAUgChC6ByAKEPoIGiAKIAAgACgCACgCGBECACAGIAoQxwcgChD6CBogACAAKAIAKAIkEQAADAELIAogARDIByIAIgEgASgCACgCLBECACACIAooAgA2AAAgCiAAIAAoAgAoAiARAgAgCCAKEMcHIAoQ+ggaIAogACAAKAIAKAIcEQIAIAcgChDHByAKEPoIGiADIAAgACgCACgCDBEAADYCACAEIAAgACgCACgCEBEAADYCACAKIAAgACgCACgCFBECACAFIAoQugcgChD6CBogCiAAIAAoAgAoAhgRAgAgBiAKEMcHIAoQ+ggaIAAgACgCACgCJBEAAAs2AgAgCkEQaiQACx8BAX8gASgCABCWBSECIAAgASgCADYCBCAAIAI2AgAL/AIBAX8jAEHAA2siACQAIAAgATYCuAMgACACNgKwAyAAQbEFNgIUIABBGGogAEEgaiAAQRRqEIwGIQEgACAEKAIcIgc2AhAgByAHKAIEQQFqNgIEIABBEGoQkAUhByAAQQA6AA8gAEG4A2ogAiADIABBEGogBCgCBCAFIABBD2ogByABIABBFGogAEGwA2oQwAcEQCAGEMQHIAAtAA8EQCAGIAdBLSAHKAIAKAIsEQMAEIoJCyAHQTAgBygCACgCLBEDACECIAEoAgAhBCAAKAIUIgNBfGohBwNAAkAgBCAHTw0AIAQoAgAgAkcNACAEQQRqIQQMAQsLIAYgBCADEMUHCyAAQbgDaiAAQbADahCTBQRAIAUgBSgCAEECcjYCAAsgACgCuAMhAwJ/IAAoAhAiAiACKAIEQX9qIgQ2AgQgBEF/RgsEQCACIAIoAgAoAggRAQALIAEoAgAhAiABQQA2AgAgAgRAIAIgASgCBBEBAAsgAEHAA2okACADC1sBAn8jAEEQayIBJAACQCAALAALQQBIBEAgACgCACECIAFBADYCDCACIAEoAgw2AgAgAEEANgIEDAELIAFBADYCCCAAIAEoAgg2AgAgAEEAOgALCyABQRBqJAALrgMBBX8jAEEQayIDJAACfyAALAALQQBIBEAgACgCBAwBCyAALQALCyEFIAAsAAtBAEgEfyAAKAIIQf////8HcUF/agVBAQshBAJAIAIgAWtBAnUiBkUNAAJ/An8gACwAC0EASARAIAAoAgAMAQsgAAshByABAn8gACwAC0EASARAIAAoAgAMAQsgAAsCfyAALAALQQBIBEAgACgCBAwBCyAALQALC0ECdGpJIAcgAU1xCwRAIAACfwJ/IANCADcCACADQQA2AgggAyABIAIQhgYgAyIALAALQQBICwRAIAAoAgAMAQsgAAsCfyADLAALQQBIBEAgAygCBAwBCyADLQALCxCJCSADEPoIGgwBCyAEIAVrIAZJBEAgACAEIAUgBmogBGsgBSAFEIgJCwJ/IAAsAAtBAEgEQCAAKAIADAELIAALIAVBAnRqIQQDQCABIAJHBEAgBCABKAIANgIAIAFBBGohASAEQQRqIQQMAQsLIANBADYCACAEIAMoAgA2AgAgBSAGaiEBAkAgACwAC0EASARAIAAgATYCBAwBCyAAIAE6AAsLCyADQRBqJAALCwAgAEHEkgMQiwYLIAAgABDtCCAAIAEoAgg2AgggACABKQIANwIAIAEQsAYLCwAgAEG8kgMQiwYLfgEBfyMAQSBrIgMkACADIAE2AhAgAyAANgIYIAMgAjYCCANAAkACf0EBIAMoAhggAygCEEZBAXNFDQAaIAMoAhgoAgAgAygCCCgCAEYNAUEACyEAIANBIGokACAADwsgAyADKAIYQQRqNgIYIAMgAygCCEEEajYCCAwAAAsACzcBAX8jAEEQayICJAAgAiAAKAIANgIIIAIgAigCCCABQQJ0ajYCCCACKAIIIQAgAkEQaiQAIAAL9AYBC38jAEHQA2siACQAIAAgBTcDECAAIAY3AxggACAAQeACajYC3AIgAEHgAmogAEEQahDxBSEJIABBsAU2AvABIABB6AFqQQAgAEHwAWoQjAYhCyAAQbAFNgLwASAAQeABakEAIABB8AFqEIwGIQogAEHwAWohDAJAIAlB5ABPBEAQrgYhByAAIAU3AwAgACAGNwMIIABB3AJqIAdB/74BIAAQ3gYhCSAAKALcAiIIRQ0BIAsoAgAhByAL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IBAgDSAHIAAoAsQDENIHIAEgAiAAKAIkIAAoAiAgAyAEEOYGIQIgCCgCACEBIAhBADYCACABBEAgASAIKAIEEQEACyAHEPoIGiANEPoIGiAQEPoIGgJ/IAAoAogEIgEgASgCBEF/aiIDNgIEIANBf0YLBEAgASABKAIAKAIIEQEACyAKKAIAIQEgCkEANgIAIAEEQCABIAooAgQRAQALIAsoAgAhASALQQA2AgAgAQRAIAEgCygCBBEBAAsgAEGwCGokACACDwsQqAcAC9EDAQF/IwBBEGsiCiQAIAkCfyAABEAgAhDGByEAAkAgAQRAIAogACAAKAIAKAIsEQIAIAMgCigCADYAACAKIAAgACgCACgCIBECAAwBCyAKIAAgACgCACgCKBECACADIAooAgA2AAAgCiAAIAAoAgAoAhwRAgALIAggChDHByAKEPoIGiAEIAAgACgCACgCDBEAADYCACAFIAAgACgCACgCEBEAADYCACAKIAAgACgCACgCFBECACAGIAoQugcgChD6CBogCiAAIAAoAgAoAhgRAgAgByAKEMcHIAoQ+ggaIAAgACgCACgCJBEAAAwBCyACEMgHIQACQCABBEAgCiAAIAAoAgAoAiwRAgAgAyAKKAIANgAAIAogACAAKAIAKAIgEQIADAELIAogACAAKAIAKAIoEQIAIAMgCigCADYAACAKIAAgACgCACgCHBECAAsgCCAKEMcHIAoQ+ggaIAQgACAAKAIAKAIMEQAANgIAIAUgACAAKAIAKAIQEQAANgIAIAogACAAKAIAKAIUEQIAIAYgChC6ByAKEPoIGiAKIAAgACgCACgCGBECACAHIAoQxwcgChD6CBogACAAKAIAKAIkEQAACzYCACAKQRBqJAAL6AcBCn8jAEEQayIUJAAgAiAANgIAIANBgARxIRYCQANAAkAgFUEERgRAAn8gDSwAC0EASARAIA0oAgQMAQsgDS0ACwtBAUsEQCAUIA0QzwY2AgggAiAUQQhqQQEQygcgDRDjBiACKAIAENMHNgIACyADQbABcSIDQRBGDQMgA0EgRw0BIAEgAigCADYCAAwDCwJAIAggFWosAAAiD0EESw0AAkACQAJAAkACQCAPQQFrDgQBAwIEAAsgASACKAIANgIADAQLIAEgAigCADYCACAGQSAgBigCACgCLBEDACEPIAIg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EGsiAyQAIAMgASACEK4GEP8FIAMpAwAhBCAAIAMpAwg3AwggACAENwMAIANBEGokAAsDAAALRwEBfyAAQQhqIgEoAgBFBEAgACAAKAIAKAIQEQEADwsCfyABIAEoAgBBf2oiATYCACABQX9GCwRAIAAgACgCACgCEBEBAAsLBABBAAsuAANAIAAoAgBBAUYNAAsgACgCAEUEQCAAQQE2AgAgAUGzBREBACAAQX82AgALCzEBAn8gAEEBIAAbIQADQAJAIAAQxQkiAQ0AQdyhAygCACICRQ0AIAIRBwAMAQsLIAELOgECfyABELoEIgJBDWoQ8wgiA0EANgIIIAMgAjYCBCADIAI2AgAgACADQQxqIAEgAkEBahDRCTYCAAspAQF/IAIEQCAAIQMDQCADIAE2AgAgA0EEaiEDIAJBf2oiAg0ACwsgAAtpAQF/AkAgACABa0ECdSACSQRAA0AgACACQX9qIgJBAnQiA2ogASADaigCADYCACACDQAMAgALAAsgAkUNACAAIQMDQCADIAEoAgA2AgAgA0EEaiEDIAFBBGohASACQX9qIgINAAsLIAALCgBBrO4BEO0CAAtZAQJ/IwBBEGsiAyQAIABCADcCACAAQQA2AgggACECAkAgASwAC0EATgRAIAIgASgCCDYCCCACIAEpAgA3AgAMAQsgACABKAIAIAEoAgQQ+QgLIANBEGokAAucAQEDfyMAQRBrIgQkAEFvIAJPBEACQCACQQpNBEAgACACOgALIAAhAwwBCyAAIAJBC08EfyACQRBqQXBxIgMgA0F/aiIDIANBC0YbBUEKC0EBaiIFEN8IIgM2AgAgACAFQYCAgIB4cjYCCCAAIAI2AgQLIAMgASACEPEEIARBADoADyACIANqIAQtAA86AAAgBEEQaiQADwsQ9wgACx0AIAAsAAtBAEgEQCAAKAIIGiAAKAIAEMYJCyAAC8kBAQN/IwBBEGsiBCQAAkAgACwAC0EASAR/IAAoAghB/////wdxQX9qBUEKCyIDIAJPBEACfyAALAALQQBIBEAgACgCAAwBCyAACyIDIQUgAgRAIAUgASACENMJCyAEQQA6AA8gAiADaiAELQAPOgAAAkAgACwAC0EASARAIAAgAjYCBAwBCyAAIAI6AAsLDAELIAAgAyACIANrAn8gACwAC0EASARAIAAoAgQMAQsgAC0ACwsiAEEAIAAgAiABEPwICyAEQRBqJAALzAIBBX8jAEEQayIIJAAgAUF/c0FvaiACTwRAAn8gACwAC0EASARAIAAoAgAMAQsgAAshCQJ/Qef///8HIAFLBEAgCCABQQF0NgIIIAggASACajYCDAJ/IwBBEGsiAiQAIAhBDGoiCigCACAIQQhqIgsoAgBJIQwgAkEQaiQAIAsgCiAMGygCACICQQtPCwR/IAJBEGpBcHEiAiACQX9qIgIgAkELRhsFQQoLDAELQW4LQQFqIgoQ3wghAiAEBEAgAiAJIAQQ8QQLIAYEQCACIARqIAcgBhDxBAsgAyAFayIDIARrIgcEQCACIARqIAZqIAQgCWogBWogBxDxBAsgAUEKRwRAIAkQxgkLIAAgAjYCACAAIApBgICAgHhyNgIIIAAgAyAGaiIANgIEIAhBADoAByAAIAJqIAgtAAc6AAAgCEEQaiQADwsQ9wgACzgBAX8CfyAALAALQQBIBEAgACgCBAwBCyAALQALCyICIAFJBEAgACABIAJrEP4IDwsgACABEP8IC8kBAQR/IwBBEGsiBSQAIAEEQCAALAALQQBIBH8gACgCCEH/////B3FBf2oFQQoLIQICfyAALAALQQBIBEAgACgCBAwBCyAALQALCyIDIAFqIQQgAiADayABSQRAIAAgAiAEIAJrIAMgAxCACQsgAwJ/IAAsAAtBAEgEQCAAKAIADAELIAALIgJqIAFBABCBCQJAIAAsAAtBAEgEQCAAIAQ2AgQMAQsgACAEOgALCyAFQQA6AA8gAiAEaiAFLQAPOgAACyAFQRBqJAALYQECfyMAQRBrIgIkAAJAIAAsAAtBAEgEQCAAKAIAIQMgAkEAOgAPIAEgA2ogAi0ADzoAACAAIAE2AgQMAQsgAkEAOgAOIAAgAWogAi0ADjoAACAAIAE6AAsLIAJBEGokAAuNAgEFfyMAQRBrIgUkAEFvIAFrIAJPBEACfyAALAALQQBIBEAgACgCAAwBCyAACyEGAn9B5////wcgAUsEQCAFIAFBAXQ2AgggBSABIAJqNgIMAn8jAEEQayICJAAgBUEMaiIHKAIAIAVBCGoiCCgCAEkhCSACQRBqJAAgCCAHIAkbKAIAIgJBC08LBH8gAkEQakFwcSICIAJBf2oiAiACQQtGGwVBCgsMAQtBbgtBAWoiBxDfCCECIAQEQCACIAYgBBDxBAsgAyAEayIDBEAgAiAEaiAEIAZqIAMQ8QQLIAFBCkcEQCAGEMYJCyAAIAI2AgAgACAHQYCAgIB4cjYCCCAFQRBqJAAPCxD3CAALFQAgAQRAIAAgAkH/AXEgARDSCRoLC9cBAQN/IwBBEGsiBSQAAkAgACwAC0EASAR/IAAoAghB/////wdxQX9qBUEKCyIEAn8gACwAC0EASARAIAAoAgQMAQsgAC0ACwsiA2sgAk8EQCACRQ0BAn8gACwAC0EASARAIAAoAgAMAQsgAAsiBCADaiABIAIQ8QQgAiADaiICIQECQCAALAALQQBIBEAgACABNgIEDAELIAAgAToACwsgBUEAOgAPIAIgBGogBS0ADzoAAAwBCyAAIAQgAiADaiAEayADIANBACACIAEQ/AgLIAVBEGokAAvBAQEDfyMAQRBrIgMkACADIAE6AA8CQAJAAkACQCAALAALQQBIBEAgACgCBCIEIAAoAghB/////wdxQX9qIgJGDQEMAwtBCiEEQQohAiAALQALIgFBCkcNAQsgACACQQEgAiACEIAJIAQhASAALAALQQBIDQELIAAiAiABQQFqOgALDAELIAAoAgAhAiAAIARBAWo2AgQgBCEBCyABIAJqIgAgAy0ADzoAACADQQA6AA4gACADLQAOOgABIANBEGokAAs7AQF/IwBBEGsiASQAAkAgAEEBOgALIABBAUEtEIEJIAFBADoADyAAIAEtAA86AAEgAUEQaiQADwALAAujAQEDfyMAQRBrIgQkAEHv////AyACTwRAAkAgAkEBTQRAIAAgAjoACyAAIQMMAQsgACACQQJPBH8gAkEEakF8cSIDIANBf2oiAyADQQJGGwVBAQtBAWoiBRDrCCIDNgIAIAAgBUGAgICAeHI2AgggACACNgIECyADIAEgAhD6BCAEQQA2AgwgAyACQQJ0aiAEKAIMNgIAIARBEGokAA8LEPcIAAvQAQEDfyMAQRBrIgQkAAJAIAAsAAtBAEgEfyAAKAIIQf////8HcUF/agVBAQsiAyACTwRAAn8gACwAC0EASARAIAAoAgAMAQsgAAsiBSEDIAIEfyADIAEgAhD2CAUgAwsaIARBADYCDCAFIAJBAnRqIAQoAgw2AgACQCAALAALQQBIBEAgACACNgIEDAELIAAgAjoACwsM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f2ogAToAACAAIAE6AAAgAkEDSQ0AIANBfmogAToAACAAIAE6AAEgA0F9aiABOgAAIAAgAToAAiACQQdJDQAgA0F8aiABOgAAIAAgAToAAyACQQlJDQAgAEEAIABrQQNxIgRqIgMgAUH/AXFBgYKECGwiATYCACADIAIgBGtBfHEiBGoiAkF8aiABNgIAIARBCUkNACADIAE2AgggAyABNgIEIAJBeGogATYCACACQXRqIAE2AgAgBEEZSQ0AIAMgATYCGCADIAE2AhQgAyABNgIQIAMgATYCDCACQXBqIAE2AgAgAkFsaiABNgIAIAJBaGogATYCACACQWRqIAE2AgAgBCADQQRxQRhyIgRrIgJBIEkNACABrSIFQiCGIAWEIQUgAyAEaiEBA0AgASAFNwMYIAEgBTcDECABIAU3AwggASAFNwMAIAFBIGohASACQWBqIgJBH0sNAAsLIAAL5QIBAn8CQCAAIAFGDQACQCABIAJqIABLBEAgACACaiIEIAFLDQELIAAgASACENEJGg8LIAAgAXNBA3EhAwJAAkAgACABSQRAIAMNAiAAQQNxRQ0BA0AgAkUNBCAAIAEtAAA6AAAgAUEBaiEBIAJBf2ohAiAAQQFqIgBBA3ENAAsMAQsCQCADDQAgBEEDcQRAA0AgAkUNBSAAIAJBf2oiAmoiAyABIAJqLQAAOgAAIANBA3ENAAsLIAJBA00NAANAIAAgAkF8aiICaiABIAJqKAIANgIAIAJBA0sNAAsLIAJFDQIDQCAAIAJBf2oiAmogASACai0AADoAACACDQALDAILIAJBA00NACACIQMDQCAAIAEoAgA2AgAgAUEEaiEBIABBBGohACADQXxqIgNBA0sNAAsgAkEDcSECCyACRQ0AA0AgACABLQAAOgAAIABBAWohACABQQFqIQEgAkF/aiICDQALCwsfAEHUpQMoAgBFBEBB2KUDIAE2AgBB1KUDIAA2AgALCwQAIwALEAAjACAAa0FwcSIAJAAgAAsGACAAJAALBgAgAEAACwsAIAEgAiAAEQIACw8AIAEgAiADIAQgABELAAsLACABIAIgABERAAsNACABIAIgAyAAEU0ACw8AIAEgAiADIAQgABEWAAsRACABIAIgAyAEIAUgABFVAAsNACABIAIgAyAAERIACw8AIAEgAiADIAQgABFSAAsLACABIAIgABEYAAsLACABIAIgABEPAAsNACABIAIgAyAAERoACw0AIAEgAiADIAARHgALDwAgASACIAMgBCAAEUwACw8AIAEgAiADIAQgABEZAAsPACABIAIgAyAEIAARXAALEQAgASACIAMgBCAFIAARTwALEQAgASACIAMgBCAFIAARXQALEwAgASACIAMgBCAFIAYgABFQAAsPACABIAIgAyAEIAARPgALEQAgASACIAMgBCAFIAARNwALEQAgASACIAMgBCAFIAARPwALEwAgASACIAMgBCAFIAYgABE4AAsTACABIAIgAyAEIAUgBiAAEUAACxUAIAEgAiADIAQgBSAGIAcgABE5AAsPACABIAIgAyAEIAARQgALEQAgASACIAMgBCAFIAAROwALDwAgASACIAMgBCAAEUYACw0AIAEgAiADIAARQQALDwAgASACIAMgBCAAEToACw8AIAEgAiADIAQgABEIAAsRACABIAIgAyAEIAUgABE9AAsTACABIAIgAyAEIAUgBiAAETUACxMAIAEgAiADIAQgBSAGIAARIAALEwAgASACIAMgBCAFIAYgABFeAAsVACABIAIgAyAEIAUgBiAHIAARVAALFQAgASACIAMgBCAFIAYgByAAEVkACxMAIAEgAiADIAQgBSAGIAARXwALFQAgASACIAMgBCAFIAYgByAAEVcACxcAIAEgAiADIAQgBSAGIAcgCCAAEWEACxkAIAEgAiADIAQgBSAGIAcgCCAJIAARWgALDQAgASACIAMgABEkAAsPACABIAIgAyAEIAARKwALEwAgASACIAMgBCAFIAYgABEtAAsVACABIAIgAyAEIAUgBiAHIAARUQALDwAgASACIAMgBCAAER8ACxEAIAEgAiADIAQgBSAAESwACw0AIAEgAiADIAARIgALDwAgASACIAMgBCAAETYACxEAIAEgAiADIAQgBSAAEQoACw0AIAEgAiADIAARSAALDwAgASACIAMgBCAAEUcACwkAIAEgABEpAAsLACABIAIgABEqAAsPACABIAIgAyAEIAARSgALEQAgASACIAMgBCAFIAARSwALEwAgASACIAMgBCAFIAYgABEzAAsVACABIAIgAyAEIAUgBiAHIAARMgALDQAgASACIAMgABFjAAsPACABIAIgAyAEIAARNAALDwAgASACIAMgBCAAEWgACxEAIAEgAiADIAQgBSAAES4ACxMAIAEgAiADIAQgBSAGIAARUwALEwAgASACIAMgBCAFIAYgABFgAAsVACABIAIgAyAEIAUgBiAHIAARWAALEQAgASACIAMgBCAFIAARLwALEwAgASACIAMgBCAFIAYgABFWAAsLACABIAIgABFqAAsPACABIAIgAyAEIAARWwALEQAgASACIAMgBCAFIAARTgALEwAgASACIAMgBCAFIAYgABFJAAsRACABIAIgAyAEIAUgABEGAAsXACABIAIgAyAEIAUgBiAHIAggABEOAAsTACABIAIgAyAEIAUgBiAAEQkACxEAIAEgAiADIAQgBSAAEScACxUAIAEgAiADIAQgBSAGIAcgABEUAAsTACABIAIgAyAEIAUgBiAAEQ0ACwcAIAARBwALGQAgASACIAOtIAStQiCGhCAFIAYgABEmAAsiAQF+IAEgAq0gA61CIIaEIAQgABEcACIFQiCIpxApIAWnCxkAIAEgAiADIAQgBa0gBq1CIIaEIAARIwALIwAgASACIAMgBCAFrSAGrUIghoQgB60gCK1CIIaEIAARRQALJQAgASACIAMgBCAFIAatIAetQiCGhCAIrSAJrUIghoQgABFEAAsLlswCVgBBgAgLgBJWZWN0b3JJbnQAVmVjdG9yRG91YmxlAFZlY3RvckNoYXIAVmVjdG9yVUNoYXIAVmVjdG9yRmxvYXQAdmVjdG9yVG9vbHMAY2xlYXJWZWN0b3JEYmwAY2xlYXJWZWN0b3JGbG9hdABtYXhpU2V0dGluZ3MAc2V0dXAAc2FtcGxlUmF0ZQBjaGFubmVscwBidWZmZXJTaXplAG1heGlPc2MAc2luZXdhdmUAY29zd2F2ZQBwaGFzb3IAc2F3AHRyaWFuZ2xlAHNxdWFyZQBwdWxzZQBpbXB1bHNlAG5vaXNlAHNpbmVidWYAc2luZWJ1ZjQAc2F3bgBwaGFzZVJlc2V0AG1heGlFbnZlbG9wZQBsaW5lAHRyaWdnZXIAYW1wbGl0dWRlAHZhbGluZGV4AG1heGlEZWxheWxpbmUAZGwAbWF4aUZpbHRlcgBsb3JlcwBoaXJlcwBiYW5kcGFzcwBsb3Bhc3MAaGlwYXNzAGN1dG9mZgByZXNvbmFuY2UAbWF4aU1peABzdGVyZW8AcXVhZABhbWJpc29uaWMAbWF4aUxpbmUAcGxheQBwcmVwYXJlAHRyaWdnZXJFbmFibGUAaXNMaW5lQ29tcGxldGUAbWF4aVhGYWRlAHhmYWRlAG1heGlMYWdFeHAAaW5pdABhZGRTYW1wbGUAdmFsdWUAYWxwaGEAYWxwaGFSZWNpcHJvY2FsAHZhbABtYXhpU2FtcGxlAGdldExlbmd0aABzZXRTYW1wbGUAc2V0U2FtcGxlRnJvbU9nZ0Jsb2IAaXNSZWFkeQBwbGF5T25jZQBwbGF5T25aWABwbGF5NABjbGVhcgBub3JtYWxpc2UAYXV0b1RyaW0AbG9hZAByZWFkAGxvb3BTZXRQb3NPblpYAG1heGlNYXAAbGlubGluAGxpbmV4cABleHBsaW4AY2xhbXAAbWF4aUR5bgBnYXRlAGNvbXByZXNzb3IAY29tcHJlc3MAc2V0QXR0YWNrAHNldFJlbGVhc2UAc2V0VGhyZXNob2xkAHNldFJhdGlvAG1heGlFbnYAYXIAYWRzcgBzZXREZWNheQBzZXRTdXN0YWluAGNvbnZlcnQAbXRvZgBtc1RvU2FtcHMAbWF4aVNhbXBsZUFuZEhvbGQAc2FoAG1heGlEaXN0b3J0aW9uAGZhc3RBdGFuAGF0YW5EaXN0AGZhc3RBdGFuRGlzdABtYXhpRmxhbmdlcgBmbGFuZ2UAbWF4aUNob3J1cwBjaG9ydXMAbWF4aURDQmxvY2tlcgBtYXhpU1ZGAHNldEN1dG9mZgBzZXRSZXNvbmFuY2UAbWF4aU1hdGgAYWRkAHN1YgBtdWwAZGl2AGd0AGx0AGd0ZQBsdGUAbW9kAGFicwBwb3cAbWF4aUNsb2NrAHRpY2tlcgBzZXRUZW1wbwBzZXRUaWNrc1BlckJlYXQAaXNUaWNrAGN1cnJlbnRDb3VudABwbGF5SGVhZABicHMAYnBtAHRpY2sAdGlja3MAbWF4aUt1cmFtb3RvT3NjaWxsYXRvcgBzZXRQaGFzZQBnZXRQaGFzZQBtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0AHNldFBoYXNlcwBzaXplAG1heGlBc3luY0t1cmFtb3RvT3NjaWxsYXRvcgBtYXhpRkZUAHByb2Nlc3MAc3BlY3RyYWxGbGF0bmVzcwBzcGVjdHJhbENlbnRyb2lkAGdldE1hZ25pdHVkZXMAZ2V0TWFnbml0dWRlc0RCAGdldFBoYXNlcwBnZXROdW1CaW5zAGdldEZGVFNpemUAZ2V0SG9wU2l6ZQBnZXRXaW5kb3dTaXplAG1heGlGRlRNb2RlcwBXSVRIX1BPTEFSX0NPTlZFUlNJT04ATk9fUE9MQVJfQ09OVkVSU0lPTgBtYXhpSUZGVABtYXhpSUZGVE1vZGVzAFNQRUNUUlVNAENPTVBMRVgAbWF4aU1GQ0MAbWZjYwBtYXhpVGltZVN0cmV0Y2gAc2hhcmVkX3B0cjxtYXhpVGltZXN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4AZ2V0Tm9ybWFsaXNlZFBvc2l0aW9uAGdldFBvc2l0aW9uAHNldFBvc2l0aW9uAHBsYXlBdFBvc2l0aW9uAG1heGlQaXRjaFNoaWZ0AHNoYXJlZF9wdHI8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4AbWF4aVN0cmV0Y2gAc2V0TG9vcFN0YXJ0AHNldExvb3BFbmQAZ2V0TG9vcEVuZABtYXhpQml0cwBzaWcAYXQAc2hsAHNocgByAGxhbmQAbG9yAGx4b3IAbmVnAGluYwBkZWMAZXEAdG9TaWduYWwAdG9UcmlnU2lnbmFsAGZyb21TaWduYWwAbWF4aVRyaWdnZXIAb25aWABvbkNoYW5nZWQAbWF4aUNvdW50ZXIAY291bnQAbWF4aUluZGV4AHB1bGwAbWF4aVJhdGlvU2VxAHBsYXlUcmlnAHBsYXlWYWx1ZXMAYWxsb2NhdG9yPFQ+OjphbGxvY2F0ZShzaXplX3QgbikgJ24nIGV4Y2VlZHMgbWF4aW11bSBzdXBwb3J0ZWQgc2l6ZQBwdXNoX2JhY2sAcmVzaXplAGdldABzZXQATlN0M19fMjZ2ZWN0b3JJaU5TXzlhbGxvY2F0b3JJaUVFRUUATlN0M19fMjEzX192ZWN0b3JfYmFzZUlpTlNfOWFsbG9jYXRvcklpRUVFRQBOU3QzX18yMjBfX3ZlY3Rvcl9iYXNlX2NvbW1vbklMYjFFRUUAAMx6AAAWDAAAUHsAAOoLAAAAAAAAAQAAADwMAAAAAAAAUHsAAMYLAAAAAAAAAQAAAEQMAAAAAAAAUE5TdDNfXzI2dmVjdG9ySWlOU185YWxsb2NhdG9ySWlFRUVFAAAAAKx7AAB0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ADwCAABOU3QzX18yMjBfX3NoYXJlZF9wdHJfcG9pbnRlcklQMTVtYXhpVGltZVN0cmV0Y2hJMTRoYW5uV2luRnVuY3RvckVOMTBlbXNjcmlwdGVuMTVzbWFydF9wdHJfdHJhaXRJTlNfMTBzaGFyZWRfcHRySVMzX0VFRTExdmFsX2RlbGV0ZXJFTlNfOWFsbG9jYXRvcklTM19FRUVFAAD0egAAvCUAABR3AABOMTBlbXNjcmlwdGVuMTVzbWFydF9wdHJfdHJhaXRJTlN0M19fMjEwc2hhcmVkX3B0ckkxNW1heGlUaW1lU3RyZXRjaEkxNGhhbm5XaW5GdW5jdG9yRUVFRTExdmFsX2RlbGV0ZXJFAE5TdDNfXzIxMHNoYXJlZF9wdHJJMTVtYXhpVGltZVN0cmV0Y2hJMTRoYW5uV2luRnVuY3RvckVFRQAAAMx6AADMJgAAaQAAAAgnAAAAAAAAjCcAAD0CAAA+AgAAPwIAAEACAABBAgAATlN0M19fMjIwX19zaGFyZWRfcHRyX2VtcGxhY2VJMTVtYXhpVGltZVN0cmV0Y2hJMTRoYW5uV2luRnVuY3RvckVOU185YWxsb2NhdG9ySVMzX0VFRUUAAPR6AAA0JwAAFHcAANR5AABYJQAApBgAAHB6AABYJQAA1HkAAFglAABwegAAAAAAAAQoAABCAgAAQwIAAEQCAAA5bWF4aUdyYWluSTE0aGFubldpbkZ1bmN0b3JFADEzbWF4aUdyYWluQmFzZQAAAADMegAA6ScAAPR6AADMJwAA/CcAAHB6AABYJQAAcHoAAHB6AAA0egAAcHoAAGRpaWRkaWQAcHoAAFglAABwegAAcHoAADR6AAAxNG1heGlQaXRjaFNoaWZ0STE0aGFubldpbkZ1bmN0b3JFAADMegAARCgAAFAxNG1heGlQaXRjaFNoaWZ0STE0aGFubldpbkZ1bmN0b3JFAKx7AABwKAAAAAAAAGgoAABQSzE0bWF4aVBpdGNoU2hpZnRJMTRoYW5uV2luRnVuY3RvckUAAAAArHsAAKQoAAABAAAAaCgAAAAAAACUKQAARQIAAEYCAABHAgAASAIAAEkCAABOU3QzX18yMjBfX3NoYXJlZF9wdHJfcG9pbnRlcklQMTRtYXhpUGl0Y2hTaGlmdEkxNGhhbm5XaW5GdW5jdG9yRU4xMGVtc2NyaXB0ZW4xNXNtYXJ0X3B0cl90cmFpdElOU18xMHNoYXJlZF9wdHJJUzNfRUVFMTF2YWxfZGVsZXRlckVOU185YWxsb2NhdG9ySVMzX0VFRUUAAAD0egAA+CgAABR3AABOMTBlbXNjcmlwdGVuMTVzbWFydF9wdHJfdHJhaXRJTlN0M19fMjEwc2hhcmVkX3B0ckkxNG1heGlQaXRjaFNoaWZ0STE0aGFubldpbkZ1bmN0b3JFRUVFMTF2YWxfZGVsZXRlckUATlN0M19fMjEwc2hhcmVkX3B0ckkxNG1heGlQaXRjaFNoaWZ0STE0aGFubldpbkZ1bmN0b3JFRUUAzHoAAAcqAABAKgAAAAAAAMAqAABKAgAASwIAAEwCAABAAgAATQIAAE5TdDNfXzIyMF9fc2hhcmVkX3B0cl9lbXBsYWNlSTE0bWF4aVBpdGNoU2hpZnRJMTRoYW5uV2luRnVuY3RvckVOU185YWxsb2NhdG9ySVMzX0VFRUUAAAD0egAAaCoAABR3AADUeQAAlCgAAKQYAEHg1QAL0gFwegAAlCgAAHB6AABwegAANHoAAHB6AAAxMW1heGlTdHJldGNoSTE0aGFubldpbkZ1bmN0b3JFAMx6AAD4KgAAUDExbWF4aVN0cmV0Y2hJMTRoYW5uV2luRnVuY3RvckUAAAAArHsAACArAAAAAAAAGCsAAFBLMTFtYXhpU3RyZXRjaEkxNGhhbm5XaW5GdW5jdG9yRQAAAKx7AABUKwAAAQAAABgrAABEKwAA1HkAAEQrAACkGAAAcHoAAEQrAADUeQAARCsAAHB6AABYegAARCsAQcDXAAskcHoAAEQrAABwegAAcHoAAHB6AAA0egAAcHoAAGRpaWRkZGlkAEHw1wAL4gNwegAARCsAAHB6AABwegAAcHoAADR6AABkaWlkZGRpADhtYXhpQml0cwAAAMx6AAAQLAAAUDhtYXhpQml0cwAArHsAACQsAAAAAAAAHCwAAFBLOG1heGlCaXRzAKx7AABALAAAAQAAABwsAABAegAAQHoAAEB6AABAegAAQHoAAEB6AABAegAAQHoAAEB6AABAegAAcHoAAEB6AABAegAAcHoAAGlpZAAxMW1heGlUcmlnZ2VyAAAAzHoAAJgsAABQMTFtYXhpVHJpZ2dlcgAArHsAALAsAAAAAAAA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d05TXzExY2hhcl90cmFpdHNJd0VFRUUAAFB7AAAcSgAAAAAAAAEAAADASAAAA/T//5i3AAAAAAAAwEoAAHACAACbAgAAnAIAAHMCAAB0AgAAdQIAAHYCAABeAgAAXwIAAJ0CAACeAgAAnwIAAGMCAAB5AgAATlN0M19fMjEwX19zdGRpbmJ1ZkljRUUA9HoAAKhKAAAASQAAdW5zdXBwb3J0ZWQgbG9jYWxlIGZvciBzdGFuZGFyZCBpbnB1dAAAAAAAAABMSwAAegIAAKACAAChAgAAfQIAAH4CAAB/AgAAgAIAAIECAACCAgAAogIAAKMCAACkAgAAhgIAAIcCAABOU3QzX18yMTBfX3N0ZGluYnVmSXdFRQD0egAANEsAADxJAAAAAAAAtEsAAHACAAClAgAApgIAAHMCAAB0AgAAdQIAAKcCAABeAgAAXwIAAHcCAABhAgAAeAIAAKgCAACpAgAATlN0M19fMjExX19zdGRvdXRidWZJY0VFAAAAAPR6AACYSwAAAEkAAAAAAAAcTAAAegIAAKoCAACrAgAAfQIAAH4CAAB/AgAArAIAAIECAACCAgAAgwIAAIQCAACFAgAArQIAAK4CAABOU3QzX18yMTFfX3N0ZG91dGJ1Zkl3RUUAAAAA9HoAAABMAAA8SQBBsJgBC+ME/////////////////////////////////////////////////////////////////wABAgMEBQYHCAn/////////CgsMDQ4PEBESExQVFhcYGRobHB0eHyAhIiP///////8KCwwNDg8QERITFBUWFxgZGhscHR4fICEiI/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////8AAQIEBwMGBQAAAAAAAAACAADAAwAAwAQAAMAFAADABgAAwAcAAMAIAADACQAAwAoAAMALAADADAAAwA0AAMAOAADADwAAwBAAAMARAADAEgAAwBMAAMAUAADAFQAAwBYAAMAXAADAGAAAwBkAAMAaAADAGwAAwBwAAMAdAADAHgAAwB8AAMAA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YXNzX3R5cGVfaW5mb0UAAAAA9HoAABR7AACkeAAAAAAAAJh7AACwAwAAwAMAALIDAACzAwAAuAMAAMEDAADCAwAAwwMAAE4xMF9fY3h4YWJpdjEyMV9fdm1pX2NsYXNzX3R5cGVfaW5mb0UAAAD0egAAcHsAAKR4AAAAAAAABHkAALADAADEAwAAsgMAALMDAADFAwAAdm9pZABib29sAGNoYXIAc2lnbmVkIGNoYXIAdW5zaWduZWQgY2hhcgBzaG9ydAB1bnNpZ25lZCBzaG9ydABpbnQAdW5zaWduZWQgaW50AGxvbmcAdW5zaWduZWQgbG9uZwBmbG9hdABkb3VibGUAc3RkOjpzdHJpbmcAc3RkOjpiYXNpY19zdHJpbmc8dW5zaWduZWQgY2hhcj4Ac3RkOjp3c3RyaW5nAHN0ZDo6dTE2c3RyaW5nAHN0ZDo6dTMyc3RyaW5nAGVtc2NyaXB0ZW46OnZhbABlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxjaGFyPgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxzaWduZWQgY2hhcj4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8dW5zaWduZWQgY2hhcj4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8c2hvcnQ+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHVuc2lnbmVkIHNob3J0PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxpbnQ+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHVuc2lnbmVkIGludD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8bG9uZz4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8dW5zaWduZWQgbG9uZz4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8aW50OF90PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzx1aW50OF90PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxpbnQxNl90PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzx1aW50MTZfdD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8aW50MzJfdD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8dWludDMyX3Q+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PGZsb2F0PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxkb3VibGU+AE5TdDNfXzIxMmJhc2ljX3N0cmluZ0loTlNfMTFjaGFyX3RyYWl0c0loRUVOU185YWxsb2NhdG9ySWhFRUVFAAAAAFB7AADWfgAAAAAAAAEAAAD4GQAAAAAAAE5TdDNfXzIxMmJhc2ljX3N0cmluZ0l3TlNfMTFjaGFyX3RyYWl0c0l3RUVOU185YWxsb2NhdG9ySXdFRUVFAABQewAAMH8AAAAAAAABAAAA+BkAAAAAAABOU3QzX18yMTJiYXNpY19zdHJpbmdJRHNOU18xMWNoYXJfdHJhaXRzSURzRUVOU185YWxsb2NhdG9ySURzRUVFRQAAAFB7AACIfwAAAAAAAAEAAAD4GQAAAAAAAE5TdDNfXzIxMmJhc2ljX3N0cmluZ0lEaU5TXzExY2hhcl90cmFpdHNJRGlFRU5TXzlhbGxvY2F0b3JJRGlFRUVFAAAAUHsAAOR/AAAAAAAAAQAAAPgZAAAAAAAATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJY0VFAADMegAAQIAAAE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SWFFRQAAzHoAAGiAAABOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0loRUUAAMx6AACQgAAATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJc0VFAADMegAAuIAAAE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SXRFRQAAzHoAAOCAAABOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0lpRUUAAMx6AAAIgQAATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJakVFAADMegAAMIEAAE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SWxFRQAAzHoAAFiBAABOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0ltRUUAAMx6AACAgQAATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJZkVFAADMegAAqIEAAE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SWRFRQAAzHoAANCBAEGChAILDIA/RKwAAAIAAAAABABBmIQCC9Ben3JMFvcfiT+fckwW9x+ZP/hVuVD516I//MdCdAgcqT+k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ZW51bQYbX2VtYmluZF9yZWdpc3Rlcl9lbnVtX3ZhbHVlBxpfZW1iaW5kX3JlZ2lzdGVyX3NtYXJ0X3B0cggYX19jeGFfYWxsb2NhdGVfZXhjZXB0aW9uCQtfX2N4YV90aHJvdwoRX2VtdmFsX3Rha2VfdmFsdWULDV9lbXZhbF9pbmNyZWYMDV9lbXZhbF9kZWNyZWYNC19lbXZhbF9jYWxsDgVyb3VuZA8EZXhpdBANX19hc3NlcnRfZmFpbBEGX19sb2NrEghfX3VubG9jaxMPX193YXNpX2ZkX2Nsb3NlFApfX3N5c2NhbGw1FQxfX3N5c2NhbGwyMjEWC19fc3lzY2FsbDU0Fw5fX3dhc2lfZmRfcmVhZBgPX193YXNpX2ZkX3dyaXRlGRhfX3dhc2lfZW52aXJvbl9zaXplc19nZXQaEl9fd2FzaV9lbnZpcm9uX2dldBsKX19tYXBfZmlsZRwLX19zeXNjYWxsOTEdCnN0cmZ0aW1lX2weBWFib3J0HxVfZW1iaW5kX3JlZ2lzdGVyX3ZvaWQgFV9lbWJpbmRfcmVnaXN0ZXJfYm9vbCEbX2VtYmluZF9yZWdpc3Rlcl9zdGRfc3RyaW5nIhxfZW1iaW5kX3JlZ2lzdGVyX3N0ZF93c3RyaW5nIxZfZW1iaW5kX3JlZ2lzdGVyX2VtdmFsJBhfZW1iaW5kX3JlZ2lzdGVyX2ludGVnZXIlFl9lbWJpbmRfcmVnaXN0ZXJfZmxvYXQmHF9lbWJpbmRfcmVnaXN0ZXJfbWVtb3J5X3ZpZXcnFmVtc2NyaXB0ZW5fcmVzaXplX2hlYXAoFWVtc2NyaXB0ZW5fbWVtY3B5X2JpZykLc2V0VGVtcFJldDAqGmxlZ2FsaW1wb3J0JF9fd2FzaV9mZF9zZWVrKxFfX3dhc21fY2FsbF9jdG9ycyxQRW1zY3JpcHRlbkJpbmRpbmdJbml0aWFsaXplcl9teV9tb2R1bGU6OkVtc2NyaXB0ZW5CaW5kaW5nSW5pdGlhbGl6ZXJfbXlfbW9kdWxlKCktlQFlbXNjcmlwdGVuOjpjbGFzc188c3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+LCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Tm9CYXNlQ2xhc3M+IGVtc2NyaXB0ZW46OnJlZ2lzdGVyX3ZlY3RvcjxpbnQ+KGNoYXIgY29uc3QqKS6eAWVtc2NyaXB0ZW46OmNsYXNzXzxzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4sIGVtc2NyaXB0ZW46OmludGVybmFsOjpOb0Jhc2VDbGFzcz4gZW1zY3JpcHRlbjo6cmVnaXN0ZXJfdmVjdG9yPGRvdWJsZT4oY2hhciBjb25zdCopL5gBZW1zY3JpcHRlbjo6Y2xhc3NfPHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+LCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Tm9CYXNlQ2xhc3M+IGVtc2NyaXB0ZW46OnJlZ2lzdGVyX3ZlY3RvcjxjaGFyPihjaGFyIGNvbnN0KikwswFlbXNjcmlwdGVuOjpjbGFzc188c3RkOjpfXzI6OnZlY3Rvcjx1bnNpZ25lZCBjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHVuc2lnbmVkIGNoYXI+ID4sIGVtc2NyaXB0ZW46OmludGVybmFsOjpOb0Jhc2VDbGFzcz4gZW1zY3JpcHRlbjo6cmVnaXN0ZXJfdmVjdG9yPHVuc2lnbmVkIGNoYXI+KGNoYXIgY29uc3QqKTGbAWVtc2NyaXB0ZW46OmNsYXNzXzxzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+LCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Tm9CYXNlQ2xhc3M+IGVtc2NyaXB0ZW46OnJlZ2lzdGVyX3ZlY3RvcjxmbG9hdD4oY2hhciBjb25zdCopMkp2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTx2ZWN0b3JUb29scz4odmVjdG9yVG9vbHMqKTNEdm9pZCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6cmF3X2Rlc3RydWN0b3I8dmVjdG9yVG9vbHM+KHZlY3RvclRvb2xzKik0R2Vtc2NyaXB0ZW46OmludGVybmFsOjpJbnZva2VyPHZlY3RvclRvb2xzKj46Omludm9rZSh2ZWN0b3JUb29scyogKCopKCkpNT52ZWN0b3JUb29scyogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzx2ZWN0b3JUb29scz4oKTbgAWVtc2NyaXB0ZW46OmludGVybmFsOjpJbnZva2VyPHZvaWQsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiY+OjppbnZva2Uodm9pZCAoKikoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiksIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiopN1R2ZWN0b3JUb29sczo6Y2xlYXJWZWN0b3JEYmwoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+Jik4THZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlTZXR0aW5ncz4obWF4aVNldHRpbmdzKik5YmVtc2NyaXB0ZW46OmludGVybmFsOjpJbnZva2VyPHZvaWQsIGludCwgaW50LCBpbnQ+OjppbnZva2Uodm9pZCAoKikoaW50LCBpbnQsIGludCksIGludCwgaW50LCBpbnQpOiJtYXhpU2V0dGluZ3M6OnNldHVwKGludCwgaW50LCBpbnQpOyNtYXhpU2V0dGluZ3M6OmdldFNhbXBsZVJhdGUoKSBjb25zdDwgbWF4aVNldHRpbmdzOjpzZXRTYW1wbGVSYXRlKGludCk9kwFpbnQgZW1zY3JpcHRlbjo6aW50ZXJuYWw6OkdldHRlclBvbGljeTxpbnQgKG1heGlTZXR0aW5nczo6KikoKSBjb25zdD46OmdldDxtYXhpU2V0dGluZ3M+KGludCAobWF4aVNldHRpbmdzOjoqIGNvbnN0JikoKSBjb25zdCwgbWF4aVNldHRpbmdzIGNvbnN0Jik+jwF2b2lkIGVtc2NyaXB0ZW46OmludGVybmFsOjpTZXR0ZXJQb2xpY3k8dm9pZCAobWF4aVNldHRpbmdzOjoqKShpbnQpPjo6c2V0PG1heGlTZXR0aW5ncz4odm9pZCAobWF4aVNldHRpbmdzOjoqIGNvbnN0JikoaW50KSwgbWF4aVNldHRpbmdzJiwgaW50KT8kbWF4aVNldHRpbmdzOjpnZXROdW1DaGFubmVscygpIGNvbnN0QCFtYXhpU2V0dGluZ3M6OnNldE51bUNoYW5uZWxzKGludClBI21heGlTZXR0aW5nczo6Z2V0QnVmZmVyU2l6ZSgpIGNvbnN0QiBtYXhpU2V0dGluZ3M6OnNldEJ1ZmZlclNpemUoaW50KUNCdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aU9zYz4obWF4aU9zYyopRDZtYXhpT3NjKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlPc2M+KClFmAFlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlPc2M6OiopKGRvdWJsZSksIGRvdWJsZSwgbWF4aU9zYyosIGRvdWJsZT46Omludm9rZShkb3VibGUgKG1heGlPc2M6OiogY29uc3QmKShkb3VibGUpLCBtYXhpT3NjKiwgZG91YmxlKUbYAWVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aU9zYzo6KikoZG91YmxlLCBkb3VibGUsIGRvdWJsZSksIGRvdWJsZSwgbWF4aU9zYyosIGRvdWJsZSwgZG91YmxlLCBkb3VibGU+OjppbnZva2UoZG91YmxlIChtYXhpT3NjOjoqIGNvbnN0JikoZG91YmxlLCBkb3VibGUsIGRvdWJsZSksIG1heGlPc2MqLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKUe4AWVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aU9zYzo6KikoZG91YmxlLCBkb3VibGUpLCBkb3VibGUsIG1heGlPc2MqLCBkb3VibGUsIGRvdWJsZT46Omludm9rZShkb3VibGUgKG1heGlPc2M6OiogY29uc3QmKShkb3VibGUsIGRvdWJsZSksIG1heGlPc2MqLCBkb3VibGUsIGRvdWJsZSlIfGVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aU9zYzo6KikoKSwgZG91YmxlLCBtYXhpT3NjKj46Omludm9rZShkb3VibGUgKG1heGlPc2M6OiogY29uc3QmKSgpLCBtYXhpT3NjKilJkgFlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChtYXhpT3NjOjoqKShkb3VibGUpLCB2b2lkLCBtYXhpT3NjKiwgZG91YmxlPjo6aW52b2tlKHZvaWQgKG1heGlPc2M6OiogY29uc3QmKShkb3VibGUpLCBtYXhpT3NjKiwgZG91YmxlKUpMdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aUVudmVsb3BlPihtYXhpRW52ZWxvcGUqKUtAbWF4aUVudmVsb3BlKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlFbnZlbG9wZT4oKUyEA2Vtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aUVudmVsb3BlOjoqKShpbnQsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYpLCBkb3VibGUsIG1heGlFbnZlbG9wZSosIGludCwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+Jj46Omludm9rZShkb3VibGUgKG1heGlFbnZlbG9wZTo6KiBjb25zdCYpKGludCwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiksIG1heGlFbnZlbG9wZSosIGludCwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KilNugFlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChtYXhpRW52ZWxvcGU6OiopKGludCwgZG91YmxlKSwgdm9pZCwgbWF4aUVudmVsb3BlKiwgaW50LCBkb3VibGU+OjppbnZva2Uodm9pZCAobWF4aUVudmVsb3BlOjoqIGNvbnN0JikoaW50LCBkb3VibGUpLCBtYXhpRW52ZWxvcGUqLCBpbnQsIGRvdWJsZSlOIm1heGlFbnZlbG9wZTo6Z2V0QW1wbGl0dWRlKCkgY29uc3RPIm1heGlFbnZlbG9wZTo6c2V0QW1wbGl0dWRlKGRvdWJsZSlQIW1heGlFbnZlbG9wZTo6Z2V0VmFsaW5kZXgoKSBjb25zdFEebWF4aUVudmVsb3BlOjpzZXRWYWxpbmRleChpbnQpUk52b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpRGVsYXlsaW5lPihtYXhpRGVsYXlsaW5lKilTQm1heGlEZWxheWxpbmUqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aURlbGF5bGluZT4oKVTkAWVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aURlbGF5bGluZTo6KikoZG91YmxlLCBpbnQsIGRvdWJsZSksIGRvdWJsZSwgbWF4aURlbGF5bGluZSosIGRvdWJsZSwgaW50LCBkb3VibGU+OjppbnZva2UoZG91YmxlIChtYXhpRGVsYXlsaW5lOjoqIGNvbnN0JikoZG91YmxlLCBpbnQsIGRvdWJsZSksIG1heGlEZWxheWxpbmUqLCBkb3VibGUsIGludCwgZG91YmxlKVX4AWVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aURlbGF5bGluZTo6KikoZG91YmxlLCBpbnQsIGRvdWJsZSwgaW50KSwgZG91YmxlLCBtYXhpRGVsYXlsaW5lKiwgZG91YmxlLCBpbnQsIGRvdWJsZSwgaW50Pjo6aW52b2tlKGRvdWJsZSAobWF4aURlbGF5bGluZTo6KiBjb25zdCYpKGRvdWJsZSwgaW50LCBkb3VibGUsIGludCksIG1heGlEZWxheWxpbmUqLCBkb3VibGUsIGludCwgZG91YmxlLCBpbnQpVkh2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpRmlsdGVyPihtYXhpRmlsdGVyKilXPG1heGlGaWx0ZXIqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aUZpbHRlcj4oKVgdbWF4aUZpbHRlcjo6Z2V0Q3V0b2ZmKCkgY29uc3RZHW1heGlGaWx0ZXI6OnNldEN1dG9mZihkb3VibGUpWiBtYXhpRmlsdGVyOjpnZXRSZXNvbmFuY2UoKSBjb25zdFsgbWF4aUZpbHRlcjo6c2V0UmVzb25hbmNlKGRvdWJsZSlcQnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlNaXg+KG1heGlNaXgqKV02bWF4aU1peCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpTWl4PigpXpYDZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAobWF4aU1peDo6KikoZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBkb3VibGUpLCB2b2lkLCBtYXhpTWl4KiwgZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBkb3VibGU+OjppbnZva2Uodm9pZCAobWF4aU1peDo6KiBjb25zdCYpKGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgZG91YmxlKSwgbWF4aU1peCosIGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KiwgZG91YmxlKV+2A2Vtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKG1heGlNaXg6OiopKGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgZG91YmxlLCBkb3VibGUpLCB2b2lkLCBtYXhpTWl4KiwgZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBkb3VibGUsIGRvdWJsZT46Omludm9rZSh2b2lkIChtYXhpTWl4OjoqIGNvbnN0JikoZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBkb3VibGUsIGRvdWJsZSksIG1heGlNaXgqLCBkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiosIGRvdWJsZSwgZG91YmxlKWDWA2Vtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKG1heGlNaXg6OiopKGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSksIHZvaWQsIG1heGlNaXgqLCBkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGRvdWJsZSwgZG91YmxlLCBkb3VibGU+OjppbnZva2Uodm9pZCAobWF4aU1peDo6KiBjb25zdCYpKGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSksIG1heGlNaXgqLCBkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUpYUR2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpTGluZT4obWF4aUxpbmUqKWI4bWF4aUxpbmUqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aUxpbmU+KCljFm1heGlMaW5lOjpwbGF5KGRvdWJsZSlkKW1heGlMaW5lOjpwcmVwYXJlKGRvdWJsZSwgZG91YmxlLCBkb3VibGUpZdYBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAobWF4aUxpbmU6OiopKGRvdWJsZSwgZG91YmxlLCBkb3VibGUpLCB2b2lkLCBtYXhpTGluZSosIGRvdWJsZSwgZG91YmxlLCBkb3VibGU+OjppbnZva2Uodm9pZCAobWF4aUxpbmU6OiogY29uc3QmKShkb3VibGUsIGRvdWJsZSwgZG91YmxlKSwgbWF4aUxpbmUqLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKWYfbWF4aUxpbmU6OnRyaWdnZXJFbmFibGUoZG91YmxlKWcabWF4aUxpbmU6OmlzTGluZUNvbXBsZXRlKCloRnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlYRmFkZT4obWF4aVhGYWRlKilphwRlbXNjcmlwdGVuOjppbnRlcm5hbDo6SW52b2tlcjxzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4sIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGRvdWJsZT46Omludm9rZShzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4gKCopKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGRvdWJsZSksIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiosIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiosIGRvdWJsZSlqigFtYXhpWEZhZGU6OnhmYWRlKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGRvdWJsZSlrgQFlbXNjcmlwdGVuOjppbnRlcm5hbDo6SW52b2tlcjxkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGU+OjppbnZva2UoZG91YmxlICgqKShkb3VibGUsIGRvdWJsZSwgZG91YmxlKSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSlsKG1heGlYRmFkZTo6eGZhZGUoZG91YmxlLCBkb3VibGUsIGRvdWJsZSltWXZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlMYWdFeHA8ZG91YmxlPiA+KG1heGlMYWdFeHA8ZG91YmxlPiopbk1tYXhpTGFnRXhwPGRvdWJsZT4qIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aUxhZ0V4cDxkb3VibGU+ID4oKW8obWF4aUxhZ0V4cDxkb3VibGU+Ojppbml0KGRvdWJsZSwgZG91YmxlKXDeAWVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKG1heGlMYWdFeHA8ZG91YmxlPjo6KikoZG91YmxlLCBkb3VibGUpLCB2b2lkLCBtYXhpTGFnRXhwPGRvdWJsZT4qLCBkb3VibGUsIGRvdWJsZT46Omludm9rZSh2b2lkIChtYXhpTGFnRXhwPGRvdWJsZT46OiogY29uc3QmKShkb3VibGUsIGRvdWJsZSksIG1heGlMYWdFeHA8ZG91YmxlPiosIGRvdWJsZSwgZG91YmxlKXElbWF4aUxhZ0V4cDxkb3VibGU+OjphZGRTYW1wbGUoZG91YmxlKXIhbWF4aUxhZ0V4cDxkb3VibGU+Ojp2YWx1ZSgpIGNvbnN0cyRtYXhpTGFnRXhwPGRvdWJsZT46OmdldEFscGhhKCkgY29uc3R0JG1heGlMYWdFeHA8ZG91YmxlPjo6c2V0QWxwaGEoZG91YmxlKXUubWF4aUxhZ0V4cDxkb3VibGU+OjpnZXRBbHBoYVJlY2lwcm9jYWwoKSBjb25zdHYubWF4aUxhZ0V4cDxkb3VibGU+OjpzZXRBbHBoYVJlY2lwcm9jYWwoZG91YmxlKXcibWF4aUxhZ0V4cDxkb3VibGU+OjpzZXRWYWwoZG91YmxlKXhIdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aVNhbXBsZT4obWF4aVNhbXBsZSopeUJ2b2lkIGVtc2NyaXB0ZW46OmludGVybmFsOjpyYXdfZGVzdHJ1Y3RvcjxtYXhpU2FtcGxlPihtYXhpU2FtcGxlKil6PG1heGlTYW1wbGUqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aVNhbXBsZT4oKXsdbWF4aVNhbXBsZTo6Z2V0TGVuZ3RoKCkgY29uc3R89gJlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChtYXhpU2FtcGxlOjoqKShzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBpbnQpLCB2b2lkLCBtYXhpU2FtcGxlKiwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgaW50Pjo6aW52b2tlKHZvaWQgKG1heGlTYW1wbGU6OiogY29uc3QmKShzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBpbnQpLCBtYXhpU2FtcGxlKiwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KiwgaW50KX2rA2Vtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGludCAobWF4aVNhbXBsZTo6Kikoc3RkOjpfXzI6OnZlY3Rvcjx1bnNpZ25lZCBjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHVuc2lnbmVkIGNoYXI+ID4mLCBpbnQpLCBpbnQsIG1heGlTYW1wbGUqLCBzdGQ6Ol9fMjo6dmVjdG9yPHVuc2lnbmVkIGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8dW5zaWduZWQgY2hhcj4gPiYsIGludD46Omludm9rZShpbnQgKG1heGlTYW1wbGU6OiogY29uc3QmKShzdGQ6Ol9fMjo6dmVjdG9yPHVuc2lnbmVkIGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8dW5zaWduZWQgY2hhcj4gPiYsIGludCksIG1heGlTYW1wbGUqLCBzdGQ6Ol9fMjo6dmVjdG9yPHVuc2lnbmVkIGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8dW5zaWduZWQgY2hhcj4gPiosIGludCl+ggFlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChtYXhpU2FtcGxlOjoqKSgpLCB2b2lkLCBtYXhpU2FtcGxlKj46Omludm9rZSh2b2lkIChtYXhpU2FtcGxlOjoqIGNvbnN0JikoKSwgbWF4aVNhbXBsZSopfxNtYXhpU2FtcGxlOjpjbGVhcigpgAHmAWVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKG1heGlTYW1wbGU6OiopKGZsb2F0LCBmbG9hdCwgYm9vbCwgYm9vbCksIHZvaWQsIG1heGlTYW1wbGUqLCBmbG9hdCwgZmxvYXQsIGJvb2wsIGJvb2w+OjppbnZva2Uodm9pZCAobWF4aVNhbXBsZTo6KiBjb25zdCYpKGZsb2F0LCBmbG9hdCwgYm9vbCwgYm9vbCksIG1heGlTYW1wbGUqLCBmbG9hdCwgZmxvYXQsIGJvb2wsIGJvb2wpgQGjBGVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGJvb2wgKG1heGlTYW1wbGU6OiopKHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4sIGludCksIGJvb2wsIG1heGlTYW1wbGUqLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+LCBpbnQ+OjppbnZva2UoYm9vbCAobWF4aVNhbXBsZTo6KiBjb25zdCYpKHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4sIGludCksIG1heGlTYW1wbGUqLCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6QmluZGluZ1R5cGU8c3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiwgdm9pZD46Oid1bm5hbWVkJyosIGludCmCAUJ2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpTWFwPihtYXhpTWFwKimDATdtYXhpTWFwOjpsaW5saW4oZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUphAHuAWVtc2NyaXB0ZW46OmludGVybmFsOjpGdW5jdGlvbkludm9rZXI8ZG91YmxlICgqKShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSksIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGU+OjppbnZva2UoZG91YmxlICgqKikoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUpLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSmFATdtYXhpTWFwOjpsaW5leHAoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUphgE3bWF4aU1hcDo6ZXhwbGluKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKYcBNWRvdWJsZSBtYXhpTWFwOjpjbGFtcDxkb3VibGU+KGRvdWJsZSwgZG91YmxlLCBkb3VibGUpiAGuAWVtc2NyaXB0ZW46OmludGVybmFsOjpGdW5jdGlvbkludm9rZXI8ZG91YmxlICgqKShkb3VibGUsIGRvdWJsZSwgZG91YmxlKSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlPjo6aW52b2tlKGRvdWJsZSAoKiopKGRvdWJsZSwgZG91YmxlLCBkb3VibGUpLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKYkBsQFlbXNjcmlwdGVuOjppbnRlcm5hbDo6SW52b2tlcjxkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlPjo6aW52b2tlKGRvdWJsZSAoKikoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUpLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSmKAUJ2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpRHluPihtYXhpRHluKimLATZtYXhpRHluKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlEeW4+KCmMAZACZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpRHluOjoqKShkb3VibGUsIGRvdWJsZSwgbG9uZywgZG91YmxlLCBkb3VibGUpLCBkb3VibGUsIG1heGlEeW4qLCBkb3VibGUsIGRvdWJsZSwgbG9uZywgZG91YmxlLCBkb3VibGU+OjppbnZva2UoZG91YmxlIChtYXhpRHluOjoqIGNvbnN0JikoZG91YmxlLCBkb3VibGUsIGxvbmcsIGRvdWJsZSwgZG91YmxlKSwgbWF4aUR5biosIGRvdWJsZSwgZG91YmxlLCBsb25nLCBkb3VibGUsIGRvdWJsZSmNAZgCZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpRHluOjoqKShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSksIGRvdWJsZSwgbWF4aUR5biosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlPjo6aW52b2tlKGRvdWJsZSAobWF4aUR5bjo6KiBjb25zdCYpKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKSwgbWF4aUR5biosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKY4BQnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlFbnY+KG1heGlFbnYqKY8BNm1heGlFbnYqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aUVudj4oKZABhAJlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlFbnY6OiopKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGxvbmcsIGludCksIGRvdWJsZSwgbWF4aUVudiosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGxvbmcsIGludD46Omludm9rZShkb3VibGUgKG1heGlFbnY6OiogY29uc3QmKShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBsb25nLCBpbnQpLCBtYXhpRW52KiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgbG9uZywgaW50KZEBxAJlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlFbnY6OiopKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBsb25nLCBpbnQpLCBkb3VibGUsIG1heGlFbnYqLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgbG9uZywgaW50Pjo6aW52b2tlKGRvdWJsZSAobWF4aUVudjo6KiBjb25zdCYpKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBsb25nLCBpbnQpLCBtYXhpRW52KiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGxvbmcsIGludCmSAawBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpRW52OjoqKShkb3VibGUsIGludCksIGRvdWJsZSwgbWF4aUVudiosIGRvdWJsZSwgaW50Pjo6aW52b2tlKGRvdWJsZSAobWF4aUVudjo6KiBjb25zdCYpKGRvdWJsZSwgaW50KSwgbWF4aUVudiosIGRvdWJsZSwgaW50KZMBG21heGlFbnY6OmdldFRyaWdnZXIoKSBjb25zdJQBGG1heGlFbnY6OnNldFRyaWdnZXIoaW50KZUBQnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPGNvbnZlcnQ+KGNvbnZlcnQqKZYBYmVtc2NyaXB0ZW46OmludGVybmFsOjpGdW5jdGlvbkludm9rZXI8ZG91YmxlICgqKShpbnQpLCBkb3VibGUsIGludD46Omludm9rZShkb3VibGUgKCoqKShpbnQpLCBpbnQplwFIZW1zY3JpcHRlbjo6aW50ZXJuYWw6Okludm9rZXI8ZG91YmxlLCBpbnQ+OjppbnZva2UoZG91YmxlICgqKShpbnQpLCBpbnQpmAEaY29udmVydDo6bXNUb1NhbXBzKGRvdWJsZSmZAW5lbXNjcmlwdGVuOjppbnRlcm5hbDo6RnVuY3Rpb25JbnZva2VyPGRvdWJsZSAoKikoZG91YmxlKSwgZG91YmxlLCBkb3VibGU+OjppbnZva2UoZG91YmxlICgqKikoZG91YmxlKSwgZG91YmxlKZoBUWVtc2NyaXB0ZW46OmludGVybmFsOjpJbnZva2VyPGRvdWJsZSwgZG91YmxlPjo6aW52b2tlKGRvdWJsZSAoKikoZG91YmxlKSwgZG91YmxlKZsBVnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlTYW1wbGVBbmRIb2xkPihtYXhpU2FtcGxlQW5kSG9sZCopnAFKbWF4aVNhbXBsZUFuZEhvbGQqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aVNhbXBsZUFuZEhvbGQ+KCmdASZtYXhpU2FtcGxlQW5kSG9sZDo6c2FoKGRvdWJsZSwgZG91YmxlKZ4BUHZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlEaXN0b3J0aW9uPihtYXhpRGlzdG9ydGlvbiopnwEgbWF4aURpc3RvcnRpb246OmZhc3RhdGFuKGRvdWJsZSmgAShtYXhpRGlzdG9ydGlvbjo6YXRhbkRpc3QoZG91YmxlLCBkb3VibGUpoQEsbWF4aURpc3RvcnRpb246OmZhc3RBdGFuRGlzdChkb3VibGUsIGRvdWJsZSmiAUp2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpRmxhbmdlcj4obWF4aUZsYW5nZXIqKaMBPm1heGlGbGFuZ2VyKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlGbGFuZ2VyPigppAFBbWF4aUZsYW5nZXI6OmZsYW5nZShkb3VibGUsIHVuc2lnbmVkIGludCwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSmlAcACZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpRmxhbmdlcjo6KikoZG91YmxlLCB1bnNpZ25lZCBpbnQsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUpLCBkb3VibGUsIG1heGlGbGFuZ2VyKiwgZG91YmxlLCB1bnNpZ25lZCBpbnQsIGRvdWJsZSwgZG91YmxlLCBkb3VibGU+OjppbnZva2UoZG91YmxlIChtYXhpRmxhbmdlcjo6KiBjb25zdCYpKGRvdWJsZSwgdW5zaWduZWQgaW50LCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKSwgbWF4aUZsYW5nZXIqLCBkb3VibGUsIHVuc2lnbmVkIGludCwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSmmAUh2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpQ2hvcnVzPihtYXhpQ2hvcnVzKimnATxtYXhpQ2hvcnVzKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlDaG9ydXM+KCmoAUBtYXhpQ2hvcnVzOjpjaG9ydXMoZG91YmxlLCB1bnNpZ25lZCBpbnQsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUpqQFOdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aURDQmxvY2tlcj4obWF4aURDQmxvY2tlciopqgFCbWF4aURDQmxvY2tlciogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpRENCbG9ja2VyPigpqwEjbWF4aURDQmxvY2tlcjo6cGxheShkb3VibGUsIGRvdWJsZSmsAUJ2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpU1ZGPihtYXhpU1ZGKimtATZtYXhpU1ZGKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlTVkY+KCmuARptYXhpU1ZGOjpzZXRDdXRvZmYoZG91YmxlKa8BHW1heGlTVkY6OnNldFJlc29uYW5jZShkb3VibGUpsAE1bWF4aVNWRjo6cGxheShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSmxAUR2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpTWF0aD4obWF4aU1hdGgqKbIBaWVtc2NyaXB0ZW46OmludGVybmFsOjpJbnZva2VyPGRvdWJsZSwgZG91YmxlLCBkb3VibGU+OjppbnZva2UoZG91YmxlICgqKShkb3VibGUsIGRvdWJsZSksIGRvdWJsZSwgZG91YmxlKbMBHW1heGlNYXRoOjphZGQoZG91YmxlLCBkb3VibGUptAEdbWF4aU1hdGg6OnN1Yihkb3VibGUsIGRvdWJsZSm1AR1tYXhpTWF0aDo6bXVsKGRvdWJsZSwgZG91YmxlKbYBHW1heGlNYXRoOjpkaXYoZG91YmxlLCBkb3VibGUptwEcbWF4aU1hdGg6Omd0KGRvdWJsZSwgZG91YmxlKbgBHG1heGlNYXRoOjpsdChkb3VibGUsIGRvdWJsZSm5AR1tYXhpTWF0aDo6Z3RlKGRvdWJsZSwgZG91YmxlKboBHW1heGlNYXRoOjpsdGUoZG91YmxlLCBkb3VibGUpuwEdbWF4aU1hdGg6Om1vZChkb3VibGUsIGRvdWJsZSm8ARVtYXhpTWF0aDo6YWJzKGRvdWJsZSm9AR9tYXhpTWF0aDo6eHBvd3koZG91YmxlLCBkb3VibGUpvgFGdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aUNsb2NrPihtYXhpQ2xvY2sqKb8BOm1heGlDbG9jayogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpQ2xvY2s+KCnAARltYXhpQ2xvY2s6OmlzVGljaygpIGNvbnN0wQEibWF4aUNsb2NrOjpnZXRDdXJyZW50Q291bnQoKSBjb25zdMIBH21heGlDbG9jazo6c2V0Q3VycmVudENvdW50KGludCnDAR9tYXhpQ2xvY2s6OmdldExhc3RDb3VudCgpIGNvbnN0xAEcbWF4aUNsb2NrOjpzZXRMYXN0Q291bnQoaW50KcUBGW1heGlDbG9jazo6Z2V0QnBzKCkgY29uc3TGARZtYXhpQ2xvY2s6OnNldEJwcyhpbnQpxwEZbWF4aUNsb2NrOjpnZXRCcG0oKSBjb25zdMgBFm1heGlDbG9jazo6c2V0QnBtKGludCnJARdtYXhpQ2xvY2s6OnNldFRpY2soaW50KcoBG21heGlDbG9jazo6Z2V0VGlja3MoKSBjb25zdMsBGG1heGlDbG9jazo6c2V0VGlja3MoaW50KcwBYHZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlLdXJhbW90b09zY2lsbGF0b3I+KG1heGlLdXJhbW90b09zY2lsbGF0b3IqKc0BVG1heGlLdXJhbW90b09zY2lsbGF0b3IqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aUt1cmFtb3RvT3NjaWxsYXRvcj4oKc4BZG1heGlLdXJhbW90b09zY2lsbGF0b3I6OnBsYXkoZG91YmxlLCBkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPinPAdYDZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yOjoqKShkb3VibGUsIGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KSwgZG91YmxlLCBtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yKiwgZG91YmxlLCBkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiA+OjppbnZva2UoZG91YmxlIChtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yOjoqIGNvbnN0JikoZG91YmxlLCBkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiksIG1heGlLdXJhbW90b09zY2lsbGF0b3IqLCBkb3VibGUsIGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KinQAWZ2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0PihtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0KinRAWB2b2lkIGVtc2NyaXB0ZW46OmludGVybmFsOjpyYXdfZGVzdHJ1Y3RvcjxtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0PihtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0KinSAZ4BZW1zY3JpcHRlbjo6aW50ZXJuYWw6Okludm9rZXI8bWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldCosIHVuc2lnbmVkIGxvbmcgY29uc3QmJj46Omludm9rZShtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0KiAoKikodW5zaWduZWQgbG9uZyBjb25zdCYmKSwgdW5zaWduZWQgbG9uZynTAYQBbWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0LCB1bnNpZ25lZCBsb25nIGNvbnN0Pih1bnNpZ25lZCBsb25nIGNvbnN0JiYp1AEvbWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldDo6cGxheShkb3VibGUsIGRvdWJsZSnVATptYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0OjpzZXRQaGFzZShkb3VibGUsIHVuc2lnbmVkIGxvbmcp1gGWAmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQ6OiopKGRvdWJsZSwgdW5zaWduZWQgbG9uZyksIHZvaWQsIG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQqLCBkb3VibGUsIHVuc2lnbmVkIGxvbmc+OjppbnZva2Uodm9pZCAobWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldDo6KiBjb25zdCYpKGRvdWJsZSwgdW5zaWduZWQgbG9uZyksIG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQqLCBkb3VibGUsIHVuc2lnbmVkIGxvbmcp1wFjbWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldDo6c2V0UGhhc2VzKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiBjb25zdCYp2AEybWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldDo6Z2V0UGhhc2UodW5zaWduZWQgbG9uZynZAfwBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0OjoqKSh1bnNpZ25lZCBsb25nKSwgZG91YmxlLCBtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0KiwgdW5zaWduZWQgbG9uZz46Omludm9rZShkb3VibGUgKG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQ6OiogY29uc3QmKSh1bnNpZ25lZCBsb25nKSwgbWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldCosIHVuc2lnbmVkIGxvbmcp2gEhbWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldDo6c2l6ZSgp2wFqdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aUFzeW5jS3VyYW1vdG9Pc2NpbGxhdG9yPihtYXhpQXN5bmNLdXJhbW90b09zY2lsbGF0b3IqKdwBrAFtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0KiBlbXNjcmlwdGVuOjpiYXNlPG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQ+Ojpjb252ZXJ0UG9pbnRlcjxtYXhpQXN5bmNLdXJhbW90b09zY2lsbGF0b3IsIG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQ+KG1heGlBc3luY0t1cmFtb3RvT3NjaWxsYXRvciop3QGIAW1heGlBc3luY0t1cmFtb3RvT3NjaWxsYXRvciogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpQXN5bmNLdXJhbW90b09zY2lsbGF0b3IsIHVuc2lnbmVkIGxvbmcgY29uc3Q+KHVuc2lnbmVkIGxvbmcgY29uc3QmJineATFtYXhpQXN5bmNLdXJhbW90b09zY2lsbGF0b3I6OnBsYXkoZG91YmxlLCBkb3VibGUp3wE8bWF4aUFzeW5jS3VyYW1vdG9Pc2NpbGxhdG9yOjpzZXRQaGFzZShkb3VibGUsIHVuc2lnbmVkIGxvbmcp4AFlbWF4aUFzeW5jS3VyYW1vdG9Pc2NpbGxhdG9yOjpzZXRQaGFzZXMoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+IGNvbnN0JinhAUJ2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpRkZUPihtYXhpRkZUKiniATx2b2lkIGVtc2NyaXB0ZW46OmludGVybmFsOjpyYXdfZGVzdHJ1Y3RvcjxtYXhpRkZUPihtYXhpRkZUKinjATZtYXhpRkZUKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlGRlQ+KCnkAa4BZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAobWF4aUZGVDo6KikoaW50LCBpbnQsIGludCksIHZvaWQsIG1heGlGRlQqLCBpbnQsIGludCwgaW50Pjo6aW52b2tlKHZvaWQgKG1heGlGRlQ6OiogY29uc3QmKShpbnQsIGludCwgaW50KSwgbWF4aUZGVCosIGludCwgaW50LCBpbnQp5QHaAWVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGJvb2wgKG1heGlGRlQ6OiopKGZsb2F0LCBtYXhpRkZUOjpmZnRNb2RlcyksIGJvb2wsIG1heGlGRlQqLCBmbG9hdCwgbWF4aUZGVDo6ZmZ0TW9kZXM+OjppbnZva2UoYm9vbCAobWF4aUZGVDo6KiBjb25zdCYpKGZsb2F0LCBtYXhpRkZUOjpmZnRNb2RlcyksIG1heGlGRlQqLCBmbG9hdCwgbWF4aUZGVDo6ZmZ0TW9kZXMp5gF5ZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZmxvYXQgKG1heGlGRlQ6OiopKCksIGZsb2F0LCBtYXhpRkZUKj46Omludm9rZShmbG9hdCAobWF4aUZGVDo6KiBjb25zdCYpKCksIG1heGlGRlQqKecBiQJlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+JiAobWF4aUZGVDo6KikoKSwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiYsIG1heGlGRlQqPjo6aW52b2tlKHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mIChtYXhpRkZUOjoqIGNvbnN0JikoKSwgbWF4aUZGVCop6AEabWF4aUZGVDo6Z2V0TWFnbml0dWRlc0RCKCnpARRtYXhpRkZUOjpnZXRQaGFzZXMoKeoBFW1heGlGRlQ6OmdldE51bUJpbnMoKesBFW1heGlGRlQ6OmdldEZGVFNpemUoKewBFW1heGlGRlQ6OmdldEhvcFNpemUoKe0BGG1heGlGRlQ6OmdldFdpbmRvd1NpemUoKe4BRHZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlJRkZUPihtYXhpSUZGVCop7wE+dm9pZCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6cmF3X2Rlc3RydWN0b3I8bWF4aUlGRlQ+KG1heGlJRkZUKinwAThtYXhpSUZGVCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpSUZGVD4oKfEBgQVlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxmbG9hdCAobWF4aUlGRlQ6OiopKHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mLCBzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+JiwgbWF4aUlGRlQ6OmZmdE1vZGVzKSwgZmxvYXQsIG1heGlJRkZUKiwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiYsIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mLCBtYXhpSUZGVDo6ZmZ0TW9kZXM+OjppbnZva2UoZmxvYXQgKG1heGlJRkZUOjoqIGNvbnN0Jikoc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiYsIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mLCBtYXhpSUZGVDo6ZmZ0TW9kZXMpLCBtYXhpSUZGVCosIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4qLCBzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+KiwgbWF4aUlGRlQ6OmZmdE1vZGVzKfIBZXZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPiA+KG1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPiop8wFfdm9pZCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6cmF3X2Rlc3RydWN0b3I8bWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+ID4obWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+Kin0AVltYXhpTUZDQ0FuYWx5c2VyPGRvdWJsZT4qIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+ID4oKfUBWW1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPjo6c2V0dXAodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgZG91YmxlLCBkb3VibGUp9gGeA2Vtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKG1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPjo6KikodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgZG91YmxlLCBkb3VibGUpLCB2b2lkLCBtYXhpTUZDQ0FuYWx5c2VyPGRvdWJsZT4qLCB1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50LCBkb3VibGUsIGRvdWJsZT46Omludm9rZSh2b2lkIChtYXhpTUZDQ0FuYWx5c2VyPGRvdWJsZT46OiogY29uc3QmKSh1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50LCBkb3VibGUsIGRvdWJsZSksIG1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPiosIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQsIGRvdWJsZSwgZG91YmxlKfcBVW1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPjo6bWZjYyhzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+Jin4AasEZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8c3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiAobWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+OjoqKShzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+JiksIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIG1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPiosIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mPjo6aW52b2tlKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYgKG1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPjo6KiBjb25zdCYpKHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mKSwgbWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+Kiwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiop+QGVAXZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiA+KHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiop+gGPAXZvaWQgZW1zY3JpcHRlbjo6aW50ZXJuYWw6OnJhd19kZXN0cnVjdG9yPHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiA+KHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiop+wGJAXN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4gPigp/AFHc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+OjpwdXNoX2JhY2soaW50IGNvbnN0Jin9Ab8CZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAoc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+OjoqKShpbnQgY29uc3QmKSwgdm9pZCwgc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+KiwgaW50IGNvbnN0Jj46Omludm9rZSh2b2lkIChzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID46OiogY29uc3QmKShpbnQgY29uc3QmKSwgc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+KiwgaW50Kf4BU3N0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPjo6cmVzaXplKHVuc2lnbmVkIGxvbmcsIGludCBjb25zdCYp/wH7AmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPjo6KikodW5zaWduZWQgbG9uZywgaW50IGNvbnN0JiksIHZvaWQsIHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiosIHVuc2lnbmVkIGxvbmcsIGludCBjb25zdCY+OjppbnZva2Uodm9pZCAoc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+OjoqIGNvbnN0JikodW5zaWduZWQgbG9uZywgaW50IGNvbnN0JiksIHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiosIHVuc2lnbmVkIGxvbmcsIGludCmAAj5zdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID46OnNpemUoKSBjb25zdIECogFlbXNjcmlwdGVuOjppbnRlcm5hbDo6VmVjdG9yQWNjZXNzPHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiA+OjpnZXQoc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+IGNvbnN0JiwgdW5zaWduZWQgbG9uZymCAoMDZW1zY3JpcHRlbjo6aW50ZXJuYWw6OkZ1bmN0aW9uSW52b2tlcjxlbXNjcmlwdGVuOjp2YWwgKCopKHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiBjb25zdCYsIHVuc2lnbmVkIGxvbmcpLCBlbXNjcmlwdGVuOjp2YWwsIHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiBjb25zdCYsIHVuc2lnbmVkIGxvbmc+OjppbnZva2UoZW1zY3JpcHRlbjo6dmFsICgqKikoc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+IGNvbnN0JiwgdW5zaWduZWQgbG9uZyksIHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiosIHVuc2lnbmVkIGxvbmcpgwKoAWVtc2NyaXB0ZW46OmludGVybmFsOjpWZWN0b3JBY2Nlc3M8c3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+ID46OnNldChzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4mLCB1bnNpZ25lZCBsb25nLCBpbnQgY29uc3QmKYQC+QJlbXNjcmlwdGVuOjppbnRlcm5hbDo6RnVuY3Rpb25JbnZva2VyPGJvb2wgKCopKHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiYsIHVuc2lnbmVkIGxvbmcsIGludCBjb25zdCYpLCBib29sLCBzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4mLCB1bnNpZ25lZCBsb25nLCBpbnQgY29uc3QmPjo6aW52b2tlKGJvb2wgKCoqKShzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4mLCB1bnNpZ25lZCBsb25nLCBpbnQgY29uc3QmKSwgc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+KiwgdW5zaWduZWQgbG9uZywgaW50KYUCoQF2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4gPihzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4qKYYCUHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPjo6cHVzaF9iYWNrKGRvdWJsZSBjb25zdCYphwLjAmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPjo6KikoZG91YmxlIGNvbnN0JiksIHZvaWQsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiosIGRvdWJsZSBjb25zdCY+OjppbnZva2Uodm9pZCAoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+OjoqIGNvbnN0JikoZG91YmxlIGNvbnN0JiksIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiosIGRvdWJsZSmIAlxzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID46OnJlc2l6ZSh1bnNpZ25lZCBsb25nLCBkb3VibGUgY29uc3QmKYkCnwNlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID46OiopKHVuc2lnbmVkIGxvbmcsIGRvdWJsZSBjb25zdCYpLCB2b2lkLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4qLCB1bnNpZ25lZCBsb25nLCBkb3VibGUgY29uc3QmPjo6aW52b2tlKHZvaWQgKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPjo6KiBjb25zdCYpKHVuc2lnbmVkIGxvbmcsIGRvdWJsZSBjb25zdCYpLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4qLCB1bnNpZ25lZCBsb25nLCBkb3VibGUpigJEc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+OjpzaXplKCkgY29uc3SLAq4BZW1zY3JpcHRlbjo6aW50ZXJuYWw6OlZlY3RvckFjY2VzczxzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4gPjo6Z2V0KHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiBjb25zdCYsIHVuc2lnbmVkIGxvbmcpjAK3AWVtc2NyaXB0ZW46OmludGVybmFsOjpWZWN0b3JBY2Nlc3M8c3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+ID46OnNldChzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCB1bnNpZ25lZCBsb25nLCBkb3VibGUgY29uc3QmKY0CnQNlbXNjcmlwdGVuOjppbnRlcm5hbDo6RnVuY3Rpb25JbnZva2VyPGJvb2wgKCopKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIHVuc2lnbmVkIGxvbmcsIGRvdWJsZSBjb25zdCYpLCBib29sLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCB1bnNpZ25lZCBsb25nLCBkb3VibGUgY29uc3QmPjo6aW52b2tlKGJvb2wgKCoqKShzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCB1bnNpZ25lZCBsb25nLCBkb3VibGUgY29uc3QmKSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KiwgdW5zaWduZWQgbG9uZywgZG91YmxlKY4CmQF2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiA+KHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+KimPAkpzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6cHVzaF9iYWNrKGNoYXIgY29uc3QmKZACywJlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6KikoY2hhciBjb25zdCYpLCB2b2lkLCBzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiosIGNoYXIgY29uc3QmPjo6aW52b2tlKHZvaWQgKHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjoqIGNvbnN0JikoY2hhciBjb25zdCYpLCBzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiosIGNoYXIpkQJWc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OnJlc2l6ZSh1bnNpZ25lZCBsb25nLCBjaGFyIGNvbnN0JimSAocDZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAoc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OiopKHVuc2lnbmVkIGxvbmcsIGNoYXIgY29uc3QmKSwgdm9pZCwgc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4qLCB1bnNpZ25lZCBsb25nLCBjaGFyIGNvbnN0Jj46Omludm9rZSh2b2lkIChzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6KiBjb25zdCYpKHVuc2lnbmVkIGxvbmcsIGNoYXIgY29uc3QmKSwgc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4qLCB1bnNpZ25lZCBsb25nLCBjaGFyKZMCQHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpzaXplKCkgY29uc3SUAqYBZW1zY3JpcHRlbjo6aW50ZXJuYWw6OlZlY3RvckFjY2VzczxzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiA+OjpnZXQoc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QmLCB1bnNpZ25lZCBsb25nKZUCrQFlbXNjcmlwdGVuOjppbnRlcm5hbDo6VmVjdG9yQWNjZXNzPHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+ID46OnNldChzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiYsIHVuc2lnbmVkIGxvbmcsIGNoYXIgY29uc3QmKZYChQNlbXNjcmlwdGVuOjppbnRlcm5hbDo6RnVuY3Rpb25JbnZva2VyPGJvb2wgKCopKHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+JiwgdW5zaWduZWQgbG9uZywgY2hhciBjb25zdCYpLCBib29sLCBzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiYsIHVuc2lnbmVkIGxvbmcsIGNoYXIgY29uc3QmPjo6aW52b2tlKGJvb2wgKCoqKShzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiYsIHVuc2lnbmVkIGxvbmcsIGNoYXIgY29uc3QmKSwgc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4qLCB1bnNpZ25lZCBsb25nLCBjaGFyKZcCvQF2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxzdGQ6Ol9fMjo6dmVjdG9yPHVuc2lnbmVkIGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8dW5zaWduZWQgY2hhcj4gPiA+KHN0ZDo6X18yOjp2ZWN0b3I8dW5zaWduZWQgY2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjx1bnNpZ25lZCBjaGFyPiA+KimYAsoBZW1zY3JpcHRlbjo6aW50ZXJuYWw6OlZlY3RvckFjY2VzczxzdGQ6Ol9fMjo6dmVjdG9yPHVuc2lnbmVkIGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8dW5zaWduZWQgY2hhcj4gPiA+OjpnZXQoc3RkOjpfXzI6OnZlY3Rvcjx1bnNpZ25lZCBjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHVuc2lnbmVkIGNoYXI+ID4gY29uc3QmLCB1bnNpZ25lZCBsb25nKZkCnQF2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+ID4oc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiopmgLXAmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID46OiopKGZsb2F0IGNvbnN0JiksIHZvaWQsIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4qLCBmbG9hdCBjb25zdCY+OjppbnZva2Uodm9pZCAoc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPjo6KiBjb25zdCYpKGZsb2F0IGNvbnN0JiksIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4qLCBmbG9hdCmbApMDZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAoc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPjo6KikodW5zaWduZWQgbG9uZywgZmxvYXQgY29uc3QmKSwgdm9pZCwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiosIHVuc2lnbmVkIGxvbmcsIGZsb2F0IGNvbnN0Jj46Omludm9rZSh2b2lkIChzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+OjoqIGNvbnN0JikodW5zaWduZWQgbG9uZywgZmxvYXQgY29uc3QmKSwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiosIHVuc2lnbmVkIGxvbmcsIGZsb2F0KZwCqgFlbXNjcmlwdGVuOjppbnRlcm5hbDo6VmVjdG9yQWNjZXNzPHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4gPjo6Z2V0KHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4gY29uc3QmLCB1bnNpZ25lZCBsb25nKZ0CkQNlbXNjcmlwdGVuOjppbnRlcm5hbDo6RnVuY3Rpb25JbnZva2VyPGJvb2wgKCopKHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mLCB1bnNpZ25lZCBsb25nLCBmbG9hdCBjb25zdCYpLCBib29sLCBzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+JiwgdW5zaWduZWQgbG9uZywgZmxvYXQgY29uc3QmPjo6aW52b2tlKGJvb2wgKCoqKShzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+JiwgdW5zaWduZWQgbG9uZywgZmxvYXQgY29uc3QmKSwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiosIHVuc2lnbmVkIGxvbmcsIGZsb2F0KZ4CXnN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPjo6X19hcHBlbmQodW5zaWduZWQgbG9uZywgZG91YmxlIGNvbnN0JimfAjhtYXhpTUZDQ0FuYWx5c2VyPGRvdWJsZT46OmNhbGNNZWxGaWx0ZXJCYW5rKGRvdWJsZSwgaW50KaACZkVtc2NyaXB0ZW5CaW5kaW5nSW5pdGlhbGl6ZXJfbXlfbW9kdWxlX21heGlHcmFpbnM6OkVtc2NyaXB0ZW5CaW5kaW5nSW5pdGlhbGl6ZXJfbXlfbW9kdWxlX21heGlHcmFpbnMoKaECc3ZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPihtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KimiAm12b2lkIGVtc2NyaXB0ZW46OmludGVybmFsOjpyYXdfZGVzdHJ1Y3RvcjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4obWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiopowKYAWVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6Z2V0KHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiBjb25zdCYppAJmZW1zY3JpcHRlbjo6c21hcnRfcHRyX3RyYWl0PHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojpjb25zdHJ1Y3RfbnVsbCgppQKdAWVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6c2hhcmUobWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGVtc2NyaXB0ZW46OmludGVybmFsOjpfRU1fVkFMKimmApsBdm9pZCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6cmF3X2Rlc3RydWN0b3I8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID4oc3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+KimnApwBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Okludm9rZXI8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46Omludm9rZShzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gKCopKCkpqALCAXN0ZDo6X18yOjplbmFibGVfaWY8IShpc19hcnJheTxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID46OnZhbHVlKSwgc3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46OnR5cGUgc3RkOjpfXzI6Om1ha2Vfc2hhcmVkPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPigpqQI3bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6c2V0U2FtcGxlKG1heGlTYW1wbGUqKaoCOG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OmdldE5vcm1hbGlzZWRQb3NpdGlvbigpqwI0bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6c2V0UG9zaXRpb24oZG91YmxlKawCQm1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OnBsYXkoZG91YmxlLCBkb3VibGUsIGludCwgZG91YmxlKa0CzAJlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OiopKGRvdWJsZSwgZG91YmxlLCBpbnQsIGRvdWJsZSksIGRvdWJsZSwgbWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGRvdWJsZSwgZG91YmxlLCBpbnQsIGRvdWJsZT46Omludm9rZShkb3VibGUgKG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OiogY29uc3QmKShkb3VibGUsIGRvdWJsZSwgaW50LCBkb3VibGUpLCBtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KiwgZG91YmxlLCBkb3VibGUsIGludCwgZG91YmxlKa4CRG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OnBsYXlBdFBvc2l0aW9uKGRvdWJsZSwgZG91YmxlLCBpbnQprwKsAmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6KikoZG91YmxlLCBkb3VibGUsIGludCksIGRvdWJsZSwgbWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGRvdWJsZSwgZG91YmxlLCBpbnQ+OjppbnZva2UoZG91YmxlIChtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+OjoqIGNvbnN0JikoZG91YmxlLCBkb3VibGUsIGludCksIG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qLCBkb3VibGUsIGRvdWJsZSwgaW50KbACcXZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+KG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiopsQJrdm9pZCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6cmF3X2Rlc3RydWN0b3I8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4obWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+KimyApsBZW1zY3JpcHRlbjo6c21hcnRfcHRyX3RyYWl0PHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+ID46OnNoYXJlKG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiosIGVtc2NyaXB0ZW46OmludGVybmFsOjpfRU1fVkFMKimzAr8Bc3RkOjpfXzI6OmVuYWJsZV9pZjwhKGlzX2FycmF5PG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+Ojp2YWx1ZSksIHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+ID46OnR5cGUgc3RkOjpfXzI6Om1ha2Vfc2hhcmVkPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+KCm0AjZtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj46OnNldFNhbXBsZShtYXhpU2FtcGxlKim1AkFtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj46OnBsYXkoZG91YmxlLCBkb3VibGUsIGludCwgZG91YmxlKbYCa3ZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+KG1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPioptwJfbWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+KCm4AjNtYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OnNldFNhbXBsZShtYXhpU2FtcGxlKim5AjFtYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OnNldExvb3BTdGFydChkb3VibGUpugIvbWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+OjpzZXRMb29wRW5kKGRvdWJsZSm7AiltYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OmdldExvb3BFbmQoKbwCRm1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6cGxheShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBpbnQsIGRvdWJsZSm9AtwCZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OiopKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGludCwgZG91YmxlKSwgZG91YmxlLCBtYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBpbnQsIGRvdWJsZT46Omludm9rZShkb3VibGUgKG1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6KiBjb25zdCYpKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGludCwgZG91YmxlKSwgbWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgaW50LCBkb3VibGUpvgJIbWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+OjpwbGF5QXRQb3NpdGlvbihkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBpbnQpvwK8AmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+OjoqKShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBpbnQpLCBkb3VibGUsIG1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGludD46Omludm9rZShkb3VibGUgKG1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6KiBjb25zdCYpKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGludCksIG1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGludCnAAnBtYXhpR3JhaW48aGFubldpbkZ1bmN0b3I+OjptYXhpR3JhaW4obWF4aVNhbXBsZSosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIG1heGlHcmFpbldpbmRvd0NhY2hlPGhhbm5XaW5GdW5jdG9yPiopwQJiRW1zY3JpcHRlbkJpbmRpbmdJbml0aWFsaXplcl9teV9tb2R1bGVfbWF4aWJpdHM6OkVtc2NyaXB0ZW5CaW5kaW5nSW5pdGlhbGl6ZXJfbXlfbW9kdWxlX21heGliaXRzKCnCAkR2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpQml0cz4obWF4aUJpdHMqKcMCb2Vtc2NyaXB0ZW46OmludGVybmFsOjpJbnZva2VyPHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50Pjo6aW52b2tlKHVuc2lnbmVkIGludCAoKikodW5zaWduZWQgaW50KSwgdW5zaWduZWQgaW50KcQCmQFlbXNjcmlwdGVuOjppbnRlcm5hbDo6SW52b2tlcjx1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50Pjo6aW52b2tlKHVuc2lnbmVkIGludCAoKikodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQpLCB1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCnFAihtYXhpQml0czo6YXQodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQpxgIpbWF4aUJpdHM6OnNobCh1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCnHAiltYXhpQml0czo6c2hyKHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KcgCwwFlbXNjcmlwdGVuOjppbnRlcm5hbDo6SW52b2tlcjx1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQ+OjppbnZva2UodW5zaWduZWQgaW50ICgqKSh1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KSwgdW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCnJAjVtYXhpQml0czo6cih1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KcoCKm1heGlCaXRzOjpsYW5kKHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KcsCKW1heGlCaXRzOjpsb3IodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQpzAIqbWF4aUJpdHM6Omx4b3IodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQpzQIbbWF4aUJpdHM6Om5lZyh1bnNpZ25lZCBpbnQpzgIbbWF4aUJpdHM6OmluYyh1bnNpZ25lZCBpbnQpzwIbbWF4aUJpdHM6OmRlYyh1bnNpZ25lZCBpbnQp0AIpbWF4aUJpdHM6OmFkZCh1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCnRAiltYXhpQml0czo6c3ViKHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KdICKW1heGlCaXRzOjptdWwodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQp0wIpbWF4aUJpdHM6OmRpdih1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCnUAihtYXhpQml0czo6Z3QodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQp1QIobWF4aUJpdHM6Omx0KHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KdYCKW1heGlCaXRzOjpndGUodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQp1wIpbWF4aUJpdHM6Omx0ZSh1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCnYAihtYXhpQml0czo6ZXEodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQp2QIRbWF4aUJpdHM6Om5vaXNlKCnaAiBtYXhpQml0czo6dG9TaWduYWwodW5zaWduZWQgaW50KdsCJG1heGlCaXRzOjp0b1RyaWdTaWduYWwodW5zaWduZWQgaW50KdwCXWVtc2NyaXB0ZW46OmludGVybmFsOjpJbnZva2VyPHVuc2lnbmVkIGludCwgZG91YmxlPjo6aW52b2tlKHVuc2lnbmVkIGludCAoKikoZG91YmxlKSwgZG91YmxlKd0CHG1heGlCaXRzOjpmcm9tU2lnbmFsKGRvdWJsZSneAkp2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpVHJpZ2dlcj4obWF4aVRyaWdnZXIqKd8CPm1heGlUcmlnZ2VyKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlUcmlnZ2VyPigp4AIZbWF4aVRyaWdnZXI6Om9uWlgoZG91YmxlKeECJm1heGlUcmlnZ2VyOjpvbkNoYW5nZWQoZG91YmxlLCBkb3VibGUp4gJKdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aUNvdW50ZXI+KG1heGlDb3VudGVyKinjAj5tYXhpQ291bnRlciogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpQ291bnRlcj4oKeQCIm1heGlDb3VudGVyOjpjb3VudChkb3VibGUsIGRvdWJsZSnlAkZ2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpSW5kZXg+KG1heGlJbmRleCop5gI6bWF4aUluZGV4KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlJbmRleD4oKecCV21heGlJbmRleDo6cHVsbChkb3VibGUsIGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KegCTHZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlSYXRpb1NlcT4obWF4aVJhdGlvU2VxKinpAlZtYXhpUmF0aW9TZXE6OnBsYXlUcmlnKGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KeoCjgNlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlSYXRpb1NlcTo6KikoZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4pLCBkb3VibGUsIG1heGlSYXRpb1NlcSosIGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+ID46Omludm9rZShkb3VibGUgKG1heGlSYXRpb1NlcTo6KiBjb25zdCYpKGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KSwgbWF4aVJhdGlvU2VxKiwgZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4qKesCkAFtYXhpUmF0aW9TZXE6OnBsYXlWYWx1ZXMoZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4sIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPinsAu8EZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpUmF0aW9TZXE6OiopKGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+LCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4pLCBkb3VibGUsIG1heGlSYXRpb1NlcSosIGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+LCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4gPjo6aW52b2tlKGRvdWJsZSAobWF4aVJhdGlvU2VxOjoqIGNvbnN0JikoZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4sIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiksIG1heGlSYXRpb1NlcSosIGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+Kiwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KintAitzdGQ6Ol9fMjo6X190aHJvd19sZW5ndGhfZXJyb3IoY2hhciBjb25zdCop7gJkdm9pZCBzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID46Ol9fcHVzaF9iYWNrX3Nsb3dfcGF0aDxpbnQgY29uc3QmPihpbnQgY29uc3QmKe8CVXN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPjo6X19hcHBlbmQodW5zaWduZWQgbG9uZywgaW50IGNvbnN0JinwAnB2b2lkIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPjo6X19wdXNoX2JhY2tfc2xvd19wYXRoPGRvdWJsZSBjb25zdCY+KGRvdWJsZSBjb25zdCYp8QJYc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46Ol9fYXBwZW5kKHVuc2lnbmVkIGxvbmcsIGNoYXIgY29uc3QmKfICb3N0ZDo6X18yOjp2ZWN0b3I8bWF4aUt1cmFtb3RvT3NjaWxsYXRvciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yPiA+OjpfX2FwcGVuZCh1bnNpZ25lZCBsb25nKfMCT3N0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPjo6X19hcHBlbmQodW5zaWduZWQgbG9uZyn0AhNtYXhpRkZUOjp+bWF4aUZGVCgp9QIzbWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6fm1heGlUaW1lU3RyZXRjaCgp9gKABHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+LCBlbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46OnZhbF9kZWxldGVyPihtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KiwgZW1zY3JpcHRlbjo6c21hcnRfcHRyX3RyYWl0PHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp2YWxfZGVsZXRlciwgc3RkOjpfXzI6OmVuYWJsZV9pZjxpc19jb252ZXJ0aWJsZTxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KiwgbWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPio+Ojp2YWx1ZSwgc3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+OjpfX25hdD46OnR5cGUp9wJ6ZW1zY3JpcHRlbjo6c21hcnRfcHRyX3RyYWl0PHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp2YWxfZGVsZXRlcjo6b3BlcmF0b3IoKSh2b2lkIGNvbnN0Kin4AvQBc3RkOjpfXzI6Ol9fc2hhcmVkX3B0cl9wb2ludGVyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qLCBlbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46OnZhbF9kZWxldGVyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp+X19zaGFyZWRfcHRyX3BvaW50ZXIoKfkC9gFzdGQ6Ol9fMjo6X19zaGFyZWRfcHRyX3BvaW50ZXI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6dmFsX2RlbGV0ZXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46On5fX3NoYXJlZF9wdHJfcG9pbnRlcigpLjH6Au8Bc3RkOjpfXzI6Ol9fc2hhcmVkX3B0cl9wb2ludGVyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qLCBlbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46OnZhbF9kZWxldGVyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+OjpfX29uX3plcm9fc2hhcmVkKCn7AocCc3RkOjpfXzI6Ol9fc2hhcmVkX3B0cl9wb2ludGVyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qLCBlbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46OnZhbF9kZWxldGVyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+OjpfX2dldF9kZWxldGVyKHN0ZDo6dHlwZV9pbmZvIGNvbnN0JikgY29uc3T8AvQBc3RkOjpfXzI6Ol9fc2hhcmVkX3B0cl9wb2ludGVyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qLCBlbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46OnZhbF9kZWxldGVyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+OjpfX29uX3plcm9fc2hhcmVkX3dlYWsoKf0CkAFzdGQ6Ol9fMjo6X19zaGFyZWRfcHRyX2VtcGxhY2U8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6fl9fc2hhcmVkX3B0cl9lbXBsYWNlKCn+ApIBc3RkOjpfXzI6Ol9fc2hhcmVkX3B0cl9lbXBsYWNlPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46On5fX3NoYXJlZF9wdHJfZW1wbGFjZSgpLjH/AosBc3RkOjpfXzI6Ol9fc2hhcmVkX3B0cl9lbXBsYWNlPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46Ol9fb25femVyb19zaGFyZWQoKYADIW1heGlHcmFpbjxoYW5uV2luRnVuY3Rvcj46OnBsYXkoKYEDMW1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPjo6fm1heGlQaXRjaFNoaWZ0KCmCA/gDc3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID46OnNoYXJlZF9wdHI8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+LCBlbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4gPjo6dmFsX2RlbGV0ZXI+KG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiosIGVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp2YWxfZGVsZXRlciwgc3RkOjpfXzI6OmVuYWJsZV9pZjxpc19jb252ZXJ0aWJsZTxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4qLCBtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4qPjo6dmFsdWUsIHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+OjpfX25hdD46OnR5cGUpgwPxAXN0ZDo6X18yOjpfX3NoYXJlZF9wdHJfcG9pbnRlcjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4qLCBlbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4gPjo6dmFsX2RlbGV0ZXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4gPjo6fl9fc2hhcmVkX3B0cl9wb2ludGVyKCmEA/MBc3RkOjpfXzI6Ol9fc2hhcmVkX3B0cl9wb2ludGVyPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiosIGVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp2YWxfZGVsZXRlciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp+X19zaGFyZWRfcHRyX3BvaW50ZXIoKS4xhQOEAnN0ZDo6X18yOjpfX3NoYXJlZF9wdHJfcG9pbnRlcjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4qLCBlbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4gPjo6dmFsX2RlbGV0ZXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4gPjo6X19nZXRfZGVsZXRlcihzdGQ6OnR5cGVfaW5mbyBjb25zdCYpIGNvbnN0hgOOAXN0ZDo6X18yOjpfX3NoYXJlZF9wdHJfZW1wbGFjZTxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4gPjo6fl9fc2hhcmVkX3B0cl9lbXBsYWNlKCmHA5ABc3RkOjpfXzI6Ol9fc2hhcmVkX3B0cl9lbXBsYWNlPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp+X19zaGFyZWRfcHRyX2VtcGxhY2UoKS4xiAOJAXN0ZDo6X18yOjpfX3NoYXJlZF9wdHJfZW1wbGFjZTxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4gPjo6X19vbl96ZXJvX3NoYXJlZCgpiQMkX0dMT0JBTF9fc3ViX0lfbWF4aW1pbGlhbi5lbWJpbmQuY3BwigMQbWF4aU9zYzo6bm9pc2UoKYsDGW1heGlPc2M6OnNpbmV3YXZlKGRvdWJsZSmMAxltYXhpT3NjOjpzaW5lYnVmNChkb3VibGUpjQMYbWF4aU9zYzo6c2luZWJ1Zihkb3VibGUpjgMYbWF4aU9zYzo6Y29zd2F2ZShkb3VibGUpjwMXbWF4aU9zYzo6cGhhc29yKGRvdWJsZSmQAxdtYXhpT3NjOjpzcXVhcmUoZG91YmxlKZEDHm1heGlPc2M6OnB1bHNlKGRvdWJsZSwgZG91YmxlKZIDGG1heGlPc2M6OmltcHVsc2UoZG91YmxlKZMDJ21heGlPc2M6OnBoYXNvcihkb3VibGUsIGRvdWJsZSwgZG91YmxlKZQDFG1heGlPc2M6OnNhdyhkb3VibGUplQMVbWF4aU9zYzo6c2F3bihkb3VibGUplgMZbWF4aU9zYzo6dHJpYW5nbGUoZG91YmxlKZcDUG1heGlFbnZlbG9wZTo6bGluZShpbnQsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYpmAMibWF4aUVudmVsb3BlOjp0cmlnZ2VyKGludCwgZG91YmxlKZkDHm1heGlEZWxheWxpbmU6Om1heGlEZWxheWxpbmUoKZoDJm1heGlEZWxheWxpbmU6OmRsKGRvdWJsZSwgaW50LCBkb3VibGUpmwMrbWF4aURlbGF5bGluZTo6ZGwoZG91YmxlLCBpbnQsIGRvdWJsZSwgaW50KZwDIm1heGlGaWx0ZXI6OmxvcGFzcyhkb3VibGUsIGRvdWJsZSmdAyJtYXhpRmlsdGVyOjpoaXBhc3MoZG91YmxlLCBkb3VibGUpngMpbWF4aUZpbHRlcjo6bG9yZXMoZG91YmxlLCBkb3VibGUsIGRvdWJsZSmfAyltYXhpRmlsdGVyOjpoaXJlcyhkb3VibGUsIGRvdWJsZSwgZG91YmxlKaADLG1heGlGaWx0ZXI6OmJhbmRwYXNzKGRvdWJsZSwgZG91YmxlLCBkb3VibGUpoQNYbWF4aU1peDo6c3RlcmVvKGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgZG91YmxlKaIDXm1heGlNaXg6OnF1YWQoZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBkb3VibGUsIGRvdWJsZSmjA2ttYXhpTWl4OjphbWJpc29uaWMoZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKaQDbG1heGlTYW1wbGU6OmxvYWQoc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiwgaW50KaUDEm1heGlTYW1wbGU6OnJlYWQoKaYDZ3N0ZDo6X18yOjpiYXNpY19pZnN0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6YmFzaWNfaWZzdHJlYW0oY2hhciBjb25zdCosIHVuc2lnbmVkIGludCmnA90Bc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mIHN0ZDo6X18yOjpfX3B1dF9jaGFyYWN0ZXJfc2VxdWVuY2U8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4oc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgbG9uZymoA01zdGQ6Ol9fMjo6dmVjdG9yPHNob3J0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHNob3J0PiA+OjpfX2FwcGVuZCh1bnNpZ25lZCBsb25nKakDTXN0ZDo6X18yOjpiYXNpY19maWxlYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfZmlsZWJ1ZigpqgNsbWF4aVNhbXBsZTo6c2V0U2FtcGxlRnJvbU9nZ0Jsb2Ioc3RkOjpfXzI6OnZlY3Rvcjx1bnNpZ25lZCBjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHVuc2lnbmVkIGNoYXI+ID4mLCBpbnQpqwNMc3RkOjpfXzI6OmJhc2ljX2ZpbGVidWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OmJhc2ljX2ZpbGVidWYoKawDXHN0ZDo6X18yOjpiYXNpY19maWxlYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpvcGVuKGNoYXIgY29uc3QqLCB1bnNpZ25lZCBpbnQprQNPc3RkOjpfXzI6OmJhc2ljX2lmc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfaWZzdHJlYW0oKa4DFW1heGlTYW1wbGU6OmlzUmVhZHkoKa8DTm1heGlTYW1wbGU6OnNldFNhbXBsZShzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mKbAD9gFzdGQ6Ol9fMjo6ZW5hYmxlX2lmPChfX2lzX2ZvcndhcmRfaXRlcmF0b3I8ZG91YmxlKj46OnZhbHVlKSAmJiAoaXNfY29uc3RydWN0aWJsZTxkb3VibGUsIHN0ZDo6X18yOjppdGVyYXRvcl90cmFpdHM8ZG91YmxlKj46OnJlZmVyZW5jZT46OnZhbHVlKSwgdm9pZD46OnR5cGUgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+Ojphc3NpZ248ZG91YmxlKj4oZG91YmxlKiwgZG91YmxlKimxA1NtYXhpU2FtcGxlOjpzZXRTYW1wbGUoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgaW50KbIDFW1heGlTYW1wbGU6OnRyaWdnZXIoKbMDEm1heGlTYW1wbGU6OnBsYXkoKbQDKG1heGlTYW1wbGU6OnBsYXkoZG91YmxlLCBkb3VibGUsIGRvdWJsZSm1AzFtYXhpU2FtcGxlOjpwbGF5KGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSYptgMpbWF4aVNhbXBsZTo6cGxheTQoZG91YmxlLCBkb3VibGUsIGRvdWJsZSm3AxZtYXhpU2FtcGxlOjpwbGF5T25jZSgpuAMcbWF4aVNhbXBsZTo6cGxheU9uWlgoZG91YmxlKbkDKm1heGlTYW1wbGU6Omxvb3BTZXRQb3NPblpYKGRvdWJsZSwgZG91YmxlKboDHG1heGlTYW1wbGU6OnBsYXlPbmNlKGRvdWJsZSm7AxhtYXhpU2FtcGxlOjpwbGF5KGRvdWJsZSm8Ax1tYXhpU2FtcGxlOjpub3JtYWxpc2UoZG91YmxlKb0DLm1heGlTYW1wbGU6OmF1dG9UcmltKGZsb2F0LCBmbG9hdCwgYm9vbCwgYm9vbCm+AzNtYXhpRHluOjpnYXRlKGRvdWJsZSwgZG91YmxlLCBsb25nLCBkb3VibGUsIGRvdWJsZSm/AzttYXhpRHluOjpjb21wcmVzc29yKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKcADGW1heGlEeW46OmNvbXByZXNzKGRvdWJsZSnBAxptYXhpRHluOjpzZXRBdHRhY2soZG91YmxlKcIDG21heGlEeW46OnNldFJlbGVhc2UoZG91YmxlKcMDHW1heGlEeW46OnNldFRocmVzaG9sZChkb3VibGUpxAMubWF4aUVudjo6YXIoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgbG9uZywgaW50KcUDQG1heGlFbnY6OmFkc3IoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGxvbmcsIGludCnGAxptYXhpRW52OjphZHNyKGRvdWJsZSwgaW50KccDGm1heGlFbnY6OnNldEF0dGFjayhkb3VibGUpyAMbbWF4aUVudjo6c2V0U3VzdGFpbihkb3VibGUpyQMZbWF4aUVudjo6c2V0RGVjYXkoZG91YmxlKcoDEmNvbnZlcnQ6Om10b2YoaW50KcsDYHZpcnR1YWwgdGh1bmsgdG8gc3RkOjpfXzI6OmJhc2ljX2lmc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfaWZzdHJlYW0oKcwDUXN0ZDo6X18yOjpiYXNpY19pZnN0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX2lmc3RyZWFtKCkuMc0DYnZpcnR1YWwgdGh1bmsgdG8gc3RkOjpfXzI6OmJhc2ljX2lmc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfaWZzdHJlYW0oKS4xzgNDc3RkOjpfXzI6OmJhc2ljX2ZpbGVidWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnN5bmMoKc8DT3N0ZDo6X18yOjpiYXNpY19maWxlYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfZmlsZWJ1ZigpLjHQA1tzdGQ6Ol9fMjo6YmFzaWNfZmlsZWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6aW1idWUoc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYp0QNQc3RkOjpfXzI6OmJhc2ljX2ZpbGVidWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnNldGJ1ZihjaGFyKiwgbG9uZynSA3pzdGQ6Ol9fMjo6YmFzaWNfZmlsZWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6c2Vla29mZihsb25nIGxvbmcsIHN0ZDo6X18yOjppb3NfYmFzZTo6c2Vla2RpciwgdW5zaWduZWQgaW50KdMDHHN0ZDo6X18yOjpfX3Rocm93X2JhZF9jYXN0KCnUA29zdGQ6Ol9fMjo6YmFzaWNfZmlsZWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6c2Vla3BvcyhzdGQ6Ol9fMjo6ZnBvczxfX21ic3RhdGVfdD4sIHVuc2lnbmVkIGludCnVA0hzdGQ6Ol9fMjo6YmFzaWNfZmlsZWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6dW5kZXJmbG93KCnWA0tzdGQ6Ol9fMjo6YmFzaWNfZmlsZWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6cGJhY2tmYWlsKGludCnXA0pzdGQ6Ol9fMjo6YmFzaWNfZmlsZWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6b3ZlcmZsb3coaW50KdgDhQJzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiBzdGQ6Ol9fMjo6X19wYWRfYW5kX291dHB1dDxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPihzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0Kiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgY2hhcinZAxttYXhpQ2xvY2s6OnNldFRlbXBvKGRvdWJsZSnaAxNtYXhpQ2xvY2s6OnRpY2tlcigp2wMfbWF4aUNsb2NrOjpzZXRUaWNrc1BlckJlYXQoaW50KdwDHW1heGlGRlQ6OnNldHVwKGludCwgaW50LCBpbnQp3QMqbWF4aUZGVDo6cHJvY2VzcyhmbG9hdCwgbWF4aUZGVDo6ZmZ0TW9kZXMp3gMTbWF4aUZGVDo6bWFnc1RvREIoKd8DG21heGlGRlQ6OnNwZWN0cmFsRmxhdG5lc3MoKeADG21heGlGRlQ6OnNwZWN0cmFsQ2VudHJvaWQoKeEDHm1heGlJRkZUOjpzZXR1cChpbnQsIGludCwgaW50KeIDkwFtYXhpSUZGVDo6cHJvY2VzcyhzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+Jiwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiYsIG1heGlJRkZUOjpmZnRNb2RlcynjAy5GRlQoaW50LCBib29sLCBmbG9hdCosIGZsb2F0KiwgZmxvYXQqLCBmbG9hdCop5AMkUmVhbEZGVChpbnQsIGZsb2F0KiwgZmxvYXQqLCBmbG9hdCop5QMgZmZ0OjpnZW5XaW5kb3coaW50LCBpbnQsIGZsb2F0KinmAw9mZnQ6OnNldHVwKGludCnnAwtmZnQ6On5mZnQoKegDIWZmdDo6Y2FsY0ZGVChpbnQsIGZsb2F0KiwgZmxvYXQqKekDN2ZmdDo6cG93ZXJTcGVjdHJ1bShpbnQsIGZsb2F0KiwgZmxvYXQqLCBmbG9hdCosIGZsb2F0KinqAx1mZnQ6OmNvbnZUb0RCKGZsb2F0KiwgZmxvYXQqKesDO2ZmdDo6aW52ZXJzZUZGVENvbXBsZXgoaW50LCBmbG9hdCosIGZsb2F0KiwgZmxvYXQqLCBmbG9hdCop7AM+ZmZ0OjppbnZlcnNlUG93ZXJTcGVjdHJ1bShpbnQsIGZsb2F0KiwgZmxvYXQqLCBmbG9hdCosIGZsb2F0KintAzdtYXhpTUZDQ0FuYWx5c2VyPGRvdWJsZT46Om1lbEZpbHRlckFuZExvZ1NxdWFyZShmbG9hdCop7gMncG9pbnRfY29tcGFyZSh2b2lkIGNvbnN0Kiwgdm9pZCBjb25zdCop7wMadm9yYmlzX2RlaW5pdChzdGJfdm9yYmlzKinwAylpc193aG9sZV9wYWNrZXRfcHJlc2VudChzdGJfdm9yYmlzKiwgaW50KfEDM3ZvcmJpc19kZWNvZGVfcGFja2V0KHN0Yl92b3JiaXMqLCBpbnQqLCBpbnQqLCBpbnQqKfIDF3N0YXJ0X3BhZ2Uoc3RiX3ZvcmJpcyop8wMvdm9yYmlzX2ZpbmlzaF9mcmFtZShzdGJfdm9yYmlzKiwgaW50LCBpbnQsIGludCn0A0B2b3JiaXNfZGVjb2RlX2luaXRpYWwoc3RiX3ZvcmJpcyosIGludCosIGludCosIGludCosIGludCosIGludCop9QMaZ2V0X2JpdHMoc3RiX3ZvcmJpcyosIGludCn2AzJjb2RlYm9va19kZWNvZGVfc2NhbGFyX3JhdyhzdGJfdm9yYmlzKiwgQ29kZWJvb2sqKfcDQ2RlY29kZV9yZXNpZHVlKHN0Yl92b3JiaXMqLCBmbG9hdCoqLCBpbnQsIGludCwgaW50LCB1bnNpZ25lZCBjaGFyKin4AytpbnZlcnNlX21kY3QoZmxvYXQqLCBpbnQsIHN0Yl92b3JiaXMqLCBpbnQp+QMZZmx1c2hfcGFja2V0KHN0Yl92b3JiaXMqKfoDGnN0YXJ0X2RlY29kZXIoc3RiX3ZvcmJpcyop+wModWludDMyX2NvbXBhcmUodm9pZCBjb25zdCosIHZvaWQgY29uc3QqKfwDJWluaXRfYmxvY2tzaXplKHN0Yl92b3JiaXMqLCBpbnQsIGludCn9AxZzdGJfdm9yYmlzX29wZW5fbWVtb3J5/gMac3RiX3ZvcmJpc19nZXRfZnJhbWVfc2hvcnT/A0Bjb252ZXJ0X3NhbXBsZXNfc2hvcnQoaW50LCBzaG9ydCoqLCBpbnQsIGludCwgZmxvYXQqKiwgaW50LCBpbnQpgAQmc3RiX3ZvcmJpc19nZXRfZnJhbWVfc2hvcnRfaW50ZXJsZWF2ZWSBBEdjb252ZXJ0X2NoYW5uZWxzX3Nob3J0X2ludGVybGVhdmVkKGludCwgc2hvcnQqLCBpbnQsIGZsb2F0KiosIGludCwgaW50KYIEGHN0Yl92b3JiaXNfZGVjb2RlX21lbW9yeYMEH21heWJlX3N0YXJ0X3BhY2tldChzdGJfdm9yYmlzKimEBClzdGFydF9wYWdlX25vX2NhcHR1cmVwYXR0ZXJuKHN0Yl92b3JiaXMqKYUEMmNvZGVib29rX2RlY29kZV9zdGFydChzdGJfdm9yYmlzKiwgQ29kZWJvb2sqLCBpbnQphgRfY29kZWJvb2tfZGVjb2RlX2RlaW50ZXJsZWF2ZV9yZXBlYXQoc3RiX3ZvcmJpcyosIENvZGVib29rKiwgZmxvYXQqKiwgaW50LCBpbnQqLCBpbnQqLCBpbnQsIGludCmHBDVpbWRjdF9zdGVwM19pdGVyMF9sb29wKGludCwgZmxvYXQqLCBpbnQsIGludCwgZmxvYXQqKYgEPGltZGN0X3N0ZXAzX2lubmVyX3JfbG9vcChpbnQsIGZsb2F0KiwgaW50LCBpbnQsIGZsb2F0KiwgaW50KYkEB3NjYWxibmaKBAZsZGV4cGaLBAZtZW1jbXCMBAVxc29ydI0EBHNpZnSOBANzaHKPBAd0cmlua2xlkAQDc2hskQQEcG50epIEBWN5Y2xlkwQHYV9jdHpfbJQEDF9fc3RkaW9fc2Vla5UECl9fbG9ja2ZpbGWWBAxfX3VubG9ja2ZpbGWXBAlfX2Z3cml0ZXiYBAZmd3JpdGWZBAdpcHJpbnRmmgQQX19lcnJub19sb2NhdGlvbpsEB3djcnRvbWKcBAZ3Y3RvbWKdBAZtZW1jaHKeBAVmcmV4cJ8EE19fdmZwcmludGZfaW50ZXJuYWygBAtwcmludGZfY29yZaEEA291dKIEBmdldGludKMEB3BvcF9hcmekBANwYWSlBAVmbXRfb6YEBWZtdF94pwQFZm10X3WoBAh2ZnByaW50ZqkEBmZtdF9mcKoEE3BvcF9hcmdfbG9uZ19kb3VibGWrBAl2ZmlwcmludGasBApfX29mbF9sb2NrrQQJX190b3dyaXRlrgQIZmlwcmludGavBAVmcHV0Y7AEEV9fZnRlbGxvX3VubG9ja2VksQQIX19mdGVsbG+yBAVmdGVsbLMECF9fdG9yZWFktAQFZnJlYWS1BBFfX2ZzZWVrb191bmxvY2tlZLYECF9fZnNlZWtvtwQFZnNlZWu4BA1fX3N0ZGlvX2Nsb3NluQQFZmdldGO6BAZzdHJsZW67BAtfX3N0cmNocm51bLwEBnN0cmNocr0EDF9fZm1vZGVmbGFnc74EBWZvcGVuvwQJdnNucHJpbnRmwAQIc25fd3JpdGXBBAZmY2xvc2XCBBlfX2Vtc2NyaXB0ZW5fc3Rkb3V0X2Nsb3NlwwQYX19lbXNjcmlwdGVuX3N0ZG91dF9zZWVrxAQMX19zdGRpb19yZWFkxQQIX19mZG9wZW7GBA1fX3N0ZGlvX3dyaXRlxwQKX19vdmVyZmxvd8gEBmZmbHVzaMkEEV9fZmZsdXNoX3VubG9ja2VkygQHX191Zmxvd8sECV9fb2ZsX2FkZMwECV9fbHNocnRpM80ECV9fYXNobHRpM84EDF9fdHJ1bmN0ZmRmMs8EBV9fY29z0AQQX19yZW1fcGlvMl9sYXJnZdEECl9fcmVtX3BpbzLSBAVfX3NpbtMEA2Nvc9QEB19fY29zZGbVBAdfX3NpbmRm1gQLX19yZW1fcGlvMmbXBARjb3Nm2AQDc2lu2QQEc2luZtoEBV9fdGFu2wQDdGFu3AQEYXRhbt0EBWF0YW5m3gQGYXRhbjJm3wQEZXhwZuAEA2xvZ+EEBGxvZ2biBANwb3fjBAd3bWVtY3B55AQZc3RkOjp1bmNhdWdodF9leGNlcHRpb24oKeUERXN0ZDo6X18yOjpiYXNpY19pb3M8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19pb3MoKeYEH3N0ZDo6X18yOjppb3NfYmFzZTo6fmlvc19iYXNlKCnnBD9zdGQ6Ol9fMjo6aW9zX2Jhc2U6Ol9fY2FsbF9jYWxsYmFja3Moc3RkOjpfXzI6Omlvc19iYXNlOjpldmVudCnoBEdzdGQ6Ol9fMjo6YmFzaWNfaW9zPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfaW9zKCkuMekEUXN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19zdHJlYW1idWYoKeoEU3N0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19zdHJlYW1idWYoKS4x6wRQc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6YmFzaWNfc3RyZWFtYnVmKCnsBF1zdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjppbWJ1ZShzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JintBFJzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpzZXRidWYoY2hhciosIGxvbmcp7gR8c3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6c2Vla29mZihsb25nIGxvbmcsIHN0ZDo6X18yOjppb3NfYmFzZTo6c2Vla2RpciwgdW5zaWduZWQgaW50Ke8EcXN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnNlZWtwb3Moc3RkOjpfXzI6OmZwb3M8X19tYnN0YXRlX3Q+LCB1bnNpZ25lZCBpbnQp8ARSc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6eHNnZXRuKGNoYXIqLCBsb25nKfEERHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPjo6Y29weShjaGFyKiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGxvbmcp8gRKc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6dW5kZXJmbG93KCnzBEZzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp1Zmxvdygp9ARNc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6cGJhY2tmYWlsKGludCn1BFhzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp4c3B1dG4oY2hhciBjb25zdCosIGxvbmcp9gRXc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1Zjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6fmJhc2ljX3N0cmVhbWJ1Zigp9wRZc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1Zjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6fmJhc2ljX3N0cmVhbWJ1ZigpLjH4BFZzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+OjpiYXNpY19zdHJlYW1idWYoKfkEW3N0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46OnhzZ2V0bih3Y2hhcl90KiwgbG9uZyn6BE1zdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD46OmNvcHkod2NoYXJfdCosIHdjaGFyX3QgY29uc3QqLCB1bnNpZ25lZCBsb25nKfsETHN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46OnVmbG93KCn8BGFzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Ojp4c3B1dG4od2NoYXJfdCBjb25zdCosIGxvbmcp/QRPc3RkOjpfXzI6OmJhc2ljX2lzdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19pc3RyZWFtKCkuMf4EXnZpcnR1YWwgdGh1bmsgdG8gc3RkOjpfXzI6OmJhc2ljX2lzdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19pc3RyZWFtKCn/BE9zdGQ6Ol9fMjo6YmFzaWNfaXN0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX2lzdHJlYW0oKS4ygAVgdmlydHVhbCB0aHVuayB0byBzdGQ6Ol9fMjo6YmFzaWNfaXN0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX2lzdHJlYW0oKS4xgQWPAXN0ZDo6X18yOjpiYXNpY19pc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpzZW50cnk6OnNlbnRyeShzdGQ6Ol9fMjo6YmFzaWNfaXN0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIGJvb2wpggVEc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OmZsdXNoKCmDBWFzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmIHN0ZDo6X18yOjp1c2VfZmFjZXQ8c3RkOjpfXzI6OmN0eXBlPGNoYXI+ID4oc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYphAXRAWJvb2wgc3RkOjpfXzI6Om9wZXJhdG9yIT08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gY29uc3QmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiBjb25zdCYphQVUc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46Om9wZXJhdG9yKigpIGNvbnN0hgVPc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46Om9wZXJhdG9yKysoKYcF0QFib29sIHN0ZDo6X18yOjpvcGVyYXRvcj09PGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+IGNvbnN0Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gY29uc3QmKYgFiQFzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6c2VudHJ5OjpzZW50cnkoc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mKYkFTnN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpzZW50cnk6On5zZW50cnkoKYoFmAFzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6ZXF1YWwoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gY29uc3QmKSBjb25zdIsFR3N0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnNidW1wYygpjAVKc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6c3B1dGMoY2hhcimNBU5zdGQ6Ol9fMjo6YmFzaWNfaXN0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6cmVhZChjaGFyKiwgbG9uZymOBWpzdGQ6Ol9fMjo6YmFzaWNfaXN0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6c2Vla2cobG9uZyBsb25nLCBzdGQ6Ol9fMjo6aW9zX2Jhc2U6OnNlZWtkaXIpjwVKc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46OmZsdXNoKCmQBWdzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmIHN0ZDo6X18yOjp1c2VfZmFjZXQ8c3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+ID4oc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYpkQXjAWJvb2wgc3RkOjpfXzI6Om9wZXJhdG9yIT08d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gY29uc3QmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiBjb25zdCYpkgVVc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46Om9wZXJhdG9yKysoKZMF4wFib29sIHN0ZDo6X18yOjpvcGVyYXRvcj09PHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+IGNvbnN0Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gY29uc3QmKZQFlQFzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6c2VudHJ5OjpzZW50cnkoc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mKZUFpAFzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6ZXF1YWwoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gY29uc3QmKSBjb25zdJYFTXN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46OnNidW1wYygplwVTc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1Zjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6c3B1dGMod2NoYXJfdCmYBU9zdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX29zdHJlYW0oKS4xmQVedmlydHVhbCB0aHVuayB0byBzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX29zdHJlYW0oKZoFT3N0ZDo6X18yOjpiYXNpY19vc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfb3N0cmVhbSgpLjKbBWB2aXJ0dWFsIHRodW5rIHRvIHN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfb3N0cmVhbSgpLjGcBe0Bc3RkOjpfXzI6Om51bV9wdXQ8Y2hhciwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPiBjb25zdCYgc3RkOjpfXzI6OnVzZV9mYWNldDxzdGQ6Ol9fMjo6bnVtX3B1dDxjaGFyLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+ID4oc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYpnQVFc3RkOjpfXzI6OmJhc2ljX2lvczxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6ZmlsbCgpIGNvbnN0ngVKc3RkOjpfXzI6OmJhc2ljX2lvczxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6d2lkZW4oY2hhcikgY29uc3SfBU5zdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6b3BlcmF0b3I8PChzaG9ydCmgBUxzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6b3BlcmF0b3I8PChpbnQpoQVWc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46Om9wZXJhdG9yPDwodW5zaWduZWQgbG9uZymiBVJzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6b3BlcmF0b3I9KGNoYXIpowVGc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnB1dChjaGFyKaQFW3N0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+OjpvcGVyYXRvcj0od2NoYXJfdCmlBXBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpiYXNpY19zdHJpbmcoY2hhciBjb25zdCoppgUhc3RkOjpfXzI6Omlvc19iYXNlOjp+aW9zX2Jhc2UoKS4xpwUfc3RkOjpfXzI6Omlvc19iYXNlOjppbml0KHZvaWQqKagFtQFzdGQ6Ol9fMjo6ZW5hYmxlX2lmPChpc19tb3ZlX2NvbnN0cnVjdGlibGU8dW5zaWduZWQgaW50Pjo6dmFsdWUpICYmIChpc19tb3ZlX2Fzc2lnbmFibGU8dW5zaWduZWQgaW50Pjo6dmFsdWUpLCB2b2lkPjo6dHlwZSBzdGQ6Ol9fMjo6c3dhcDx1bnNpZ25lZCBpbnQ+KHVuc2lnbmVkIGludCYsIHVuc2lnbmVkIGludCYpqQVZc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46Ol9fdGVzdF9mb3JfZW9mKCkgY29uc3SqBV9zdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6X190ZXN0X2Zvcl9lb2YoKSBjb25zdKsFBnVuZ2V0Y6wFIHN0ZDo6X18yOjppb3NfYmFzZTo6SW5pdDo6SW5pdCgprQUXX19jeHhfZ2xvYmFsX2FycmF5X2R0b3KuBT9zdGQ6Ol9fMjo6X19zdGRpbmJ1ZjxjaGFyPjo6X19zdGRpbmJ1ZihfSU9fRklMRSosIF9fbWJzdGF0ZV90KimvBYoBc3RkOjpfXzI6OmJhc2ljX2lzdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OmJhc2ljX2lzdHJlYW0oc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiopsAVCc3RkOjpfXzI6Ol9fc3RkaW5idWY8d2NoYXJfdD46Ol9fc3RkaW5idWYoX0lPX0ZJTEUqLCBfX21ic3RhdGVfdCopsQWWAXN0ZDo6X18yOjpiYXNpY19pc3RyZWFtPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+OjpiYXNpY19pc3RyZWFtKHN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4qKbIFQXN0ZDo6X18yOjpfX3N0ZG91dGJ1ZjxjaGFyPjo6X19zdGRvdXRidWYoX0lPX0ZJTEUqLCBfX21ic3RhdGVfdCopswWKAXN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpiYXNpY19vc3RyZWFtKHN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4qKbQFRHN0ZDo6X18yOjpfX3N0ZG91dGJ1Zjx3Y2hhcl90Pjo6X19zdGRvdXRidWYoX0lPX0ZJTEUqLCBfX21ic3RhdGVfdCoptQWWAXN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+OjpiYXNpY19vc3RyZWFtKHN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4qKbYFfXN0ZDo6X18yOjpiYXNpY19pb3M8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OmluaXQoc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPioptwWLAXN0ZDo6X18yOjpjb2RlY3Z0PGNoYXIsIGNoYXIsIF9fbWJzdGF0ZV90PiBjb25zdCYgc3RkOjpfXzI6OnVzZV9mYWNldDxzdGQ6Ol9fMjo6Y29kZWN2dDxjaGFyLCBjaGFyLCBfX21ic3RhdGVfdD4gPihzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0Jim4BZEBc3RkOjpfXzI6OmNvZGVjdnQ8d2NoYXJfdCwgY2hhciwgX19tYnN0YXRlX3Q+IGNvbnN0JiBzdGQ6Ol9fMjo6dXNlX2ZhY2V0PHN0ZDo6X18yOjpjb2RlY3Z0PHdjaGFyX3QsIGNoYXIsIF9fbWJzdGF0ZV90PiA+KHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKbkFKXN0ZDo6X18yOjpfX3N0ZGluYnVmPGNoYXI+Ojp+X19zdGRpbmJ1ZigpugU6c3RkOjpfXzI6Ol9fc3RkaW5idWY8Y2hhcj46OmltYnVlKHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKbsFJ3N0ZDo6X18yOjpfX3N0ZGluYnVmPGNoYXI+Ojp1bmRlcmZsb3coKbwFK3N0ZDo6X18yOjpfX3N0ZGluYnVmPGNoYXI+OjpfX2dldGNoYXIoYm9vbCm9BSNzdGQ6Ol9fMjo6X19zdGRpbmJ1ZjxjaGFyPjo6dWZsb3coKb4FKnN0ZDo6X18yOjpfX3N0ZGluYnVmPGNoYXI+OjpwYmFja2ZhaWwoaW50Kb8FLHN0ZDo6X18yOjpfX3N0ZGluYnVmPHdjaGFyX3Q+Ojp+X19zdGRpbmJ1ZigpwAU9c3RkOjpfXzI6Ol9fc3RkaW5idWY8d2NoYXJfdD46OmltYnVlKHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKcEFKnN0ZDo6X18yOjpfX3N0ZGluYnVmPHdjaGFyX3Q+Ojp1bmRlcmZsb3coKcIFLnN0ZDo6X18yOjpfX3N0ZGluYnVmPHdjaGFyX3Q+OjpfX2dldGNoYXIoYm9vbCnDBSZzdGQ6Ol9fMjo6X19zdGRpbmJ1Zjx3Y2hhcl90Pjo6dWZsb3coKcQFNnN0ZDo6X18yOjpfX3N0ZGluYnVmPHdjaGFyX3Q+OjpwYmFja2ZhaWwodW5zaWduZWQgaW50KcUFO3N0ZDo6X18yOjpfX3N0ZG91dGJ1ZjxjaGFyPjo6aW1idWUoc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYpxgUjc3RkOjpfXzI6Ol9fc3Rkb3V0YnVmPGNoYXI+OjpzeW5jKCnHBTZzdGQ6Ol9fMjo6X19zdGRvdXRidWY8Y2hhcj46OnhzcHV0bihjaGFyIGNvbnN0KiwgbG9uZynIBSpzdGQ6Ol9fMjo6X19zdGRvdXRidWY8Y2hhcj46Om92ZXJmbG93KGludCnJBT5zdGQ6Ol9fMjo6X19zdGRvdXRidWY8d2NoYXJfdD46OmltYnVlKHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKcoFPHN0ZDo6X18yOjpfX3N0ZG91dGJ1Zjx3Y2hhcl90Pjo6eHNwdXRuKHdjaGFyX3QgY29uc3QqLCBsb25nKcsFNnN0ZDo6X18yOjpfX3N0ZG91dGJ1Zjx3Y2hhcl90Pjo6b3ZlcmZsb3codW5zaWduZWQgaW50KcwFB19fc2hsaW3NBQhfX3NoZ2V0Y84FCF9fbXVsdGkzzwUJX19pbnRzY2Fu0AUHbWJydG93Y9EFDV9fZXh0ZW5kc2Z0ZjLSBQhfX211bHRmM9MFC19fZmxvYXRzaXRm1AUIX19hZGR0ZjPVBQ1fX2V4dGVuZGRmdGYy1gUHX19sZXRmMtcFB19fZ2V0ZjLYBQljb3B5c2lnbmzZBQ1fX2Zsb2F0dW5zaXRm2gUIX19zdWJ0ZjPbBQdzY2FsYm5s3AUIX19kaXZ0ZjPdBQtfX2Zsb2F0c2Nhbt4FCGhleGZsb2F03wUIZGVjZmxvYXTgBQdzY2FuZXhw4QUMX190cnVuY3Rmc2Yy4gUHdmZzY2FuZuMFBWFyZ19u5AUJc3RvcmVfaW505QUNX19zdHJpbmdfcmVhZOYFB3Zzc2NhbmbnBQdkb19yZWFk6AUGc3RyY21w6QUgX19lbXNjcmlwdGVuX2Vudmlyb25fY29uc3RydWN0b3LqBQdzdHJuY21w6wUGZ2V0ZW527AUIX19tdW5tYXDtBQxfX2dldF9sb2NhbGXuBQtfX25ld2xvY2FsZe8FCXZhc3ByaW50ZvAFBnNzY2FuZvEFCHNucHJpbnRm8gUKZnJlZWxvY2FsZfMFBndjc2xlbvQFCXdjc3J0b21ic/UFCndjc25ydG9tYnP2BQltYnNydG93Y3P3BQptYnNucnRvd2Nz+AUGc3RydG94+QUKc3RydG91bGxfbPoFCXN0cnRvbGxfbPsFBnN0cnRvZvwFCHN0cnRveC4x/QUGc3RydG9k/gUHc3RydG9sZP8FCXN0cnRvbGRfbIAGXXN0ZDo6X18yOjpjb2xsYXRlPGNoYXI+Ojpkb19jb21wYXJlKGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqKSBjb25zdIEGRXN0ZDo6X18yOjpjb2xsYXRlPGNoYXI+Ojpkb190cmFuc2Zvcm0oY2hhciBjb25zdCosIGNoYXIgY29uc3QqKSBjb25zdIIGzwFzdGQ6Ol9fMjo6ZW5hYmxlX2lmPF9faXNfZm9yd2FyZF9pdGVyYXRvcjxjaGFyIGNvbnN0Kj46OnZhbHVlLCB2b2lkPjo6dHlwZSBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpfX2luaXQ8Y2hhciBjb25zdCo+KGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KimDBkBzdGQ6Ol9fMjo6Y29sbGF0ZTxjaGFyPjo6ZG9faGFzaChjaGFyIGNvbnN0KiwgY2hhciBjb25zdCopIGNvbnN0hAZsc3RkOjpfXzI6OmNvbGxhdGU8d2NoYXJfdD46OmRvX2NvbXBhcmUod2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdCopIGNvbnN0hQZOc3RkOjpfXzI6OmNvbGxhdGU8d2NoYXJfdD46OmRvX3RyYW5zZm9ybSh3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdCopIGNvbnN0hgbkAXN0ZDo6X18yOjplbmFibGVfaWY8X19pc19mb3J3YXJkX2l0ZXJhdG9yPHdjaGFyX3QgY29uc3QqPjo6dmFsdWUsIHZvaWQ+Ojp0eXBlIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID46Ol9faW5pdDx3Y2hhcl90IGNvbnN0Kj4od2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqKYcGSXN0ZDo6X18yOjpjb2xsYXRlPHdjaGFyX3Q+Ojpkb19oYXNoKHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0KikgY29uc3SIBpoCc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgYm9vbCYpIGNvbnN0iQZnc3RkOjpfXzI6Om51bXB1bmN0PGNoYXI+IGNvbnN0JiBzdGQ6Ol9fMjo6dXNlX2ZhY2V0PHN0ZDo6X18yOjpudW1wdW5jdDxjaGFyPiA+KHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKYoGpAVzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0KiBzdGQ6Ol9fMjo6X19zY2FuX2tleXdvcmQ8c3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QqLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0Kiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCosIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYsIHVuc2lnbmVkIGludCYsIGJvb2wpiwY4c3RkOjpfXzI6OmxvY2FsZTo6dXNlX2ZhY2V0KHN0ZDo6X18yOjpsb2NhbGU6OmlkJikgY29uc3SMBswBc3RkOjpfXzI6OnVuaXF1ZV9wdHI8dW5zaWduZWQgY2hhciwgdm9pZCAoKikodm9pZCopPjo6dW5pcXVlX3B0cjx0cnVlLCB2b2lkPih1bnNpZ25lZCBjaGFyKiwgc3RkOjpfXzI6Ol9fZGVwZW5kZW50X3R5cGU8c3RkOjpfXzI6Ol9fdW5pcXVlX3B0cl9kZWxldGVyX3NmaW5hZTx2b2lkICgqKSh2b2lkKik+LCB0cnVlPjo6X19nb29kX3J2YWxfcmVmX3R5cGUpjQaaAnN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGxvbmcmKSBjb25zdI4G6wJzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiBzdGQ6Ol9fMjo6bnVtX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2RvX2dldF9zaWduZWQ8bG9uZz4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBsb25nJikgY29uc3SPBjlzdGQ6Ol9fMjo6X19udW1fZ2V0X2Jhc2U6Ol9fZ2V0X2Jhc2Uoc3RkOjpfXzI6Omlvc19iYXNlJimQBkhzdGQ6Ol9fMjo6X19udW1fZ2V0PGNoYXI+OjpfX3N0YWdlMl9pbnRfcHJlcChzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCBjaGFyJimRBmVzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpiYXNpY19zdHJpbmcoKZIGbHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OnJlc2l6ZSh1bnNpZ25lZCBsb25nKZMG5QFzdGQ6Ol9fMjo6X19udW1fZ2V0PGNoYXI+OjpfX3N0YWdlMl9pbnRfbG9vcChjaGFyLCBpbnQsIGNoYXIqLCBjaGFyKiYsIHVuc2lnbmVkIGludCYsIGNoYXIsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QmLCB1bnNpZ25lZCBpbnQqLCB1bnNpZ25lZCBpbnQqJiwgY2hhciBjb25zdCoplAZcbG9uZyBzdGQ6Ol9fMjo6X19udW1fZ2V0X3NpZ25lZF9pbnRlZ3JhbDxsb25nPihjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGludCYsIGludCmVBqUBc3RkOjpfXzI6Ol9fY2hlY2tfZ3JvdXBpbmcoc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCYsIHVuc2lnbmVkIGludCosIHVuc2lnbmVkIGludCosIHVuc2lnbmVkIGludCYplgafAnN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGxvbmcgbG9uZyYpIGNvbnN0lwb1AnN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+IHN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZG9fZ2V0X3NpZ25lZDxsb25nIGxvbmc+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgbG9uZyBsb25nJikgY29uc3SYBmZsb25nIGxvbmcgc3RkOjpfXzI6Ol9fbnVtX2dldF9zaWduZWRfaW50ZWdyYWw8bG9uZyBsb25nPihjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGludCYsIGludCmZBqQCc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdW5zaWduZWQgc2hvcnQmKSBjb25zdJoGgQNzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiBzdGQ6Ol9fMjo6bnVtX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2RvX2dldF91bnNpZ25lZDx1bnNpZ25lZCBzaG9ydD4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB1bnNpZ25lZCBzaG9ydCYpIGNvbnN0mwZydW5zaWduZWQgc2hvcnQgc3RkOjpfXzI6Ol9fbnVtX2dldF91bnNpZ25lZF9pbnRlZ3JhbDx1bnNpZ25lZCBzaG9ydD4oY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBpbnQmLCBpbnQpnAaiAnN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHVuc2lnbmVkIGludCYpIGNvbnN0nQb9AnN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+IHN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZG9fZ2V0X3Vuc2lnbmVkPHVuc2lnbmVkIGludD4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB1bnNpZ25lZCBpbnQmKSBjb25zdJ4GbnVuc2lnbmVkIGludCBzdGQ6Ol9fMjo6X19udW1fZ2V0X3Vuc2lnbmVkX2ludGVncmFsPHVuc2lnbmVkIGludD4oY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBpbnQmLCBpbnQpnwaoAnN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHVuc2lnbmVkIGxvbmcgbG9uZyYpIGNvbnN0oAaJA3N0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+IHN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZG9fZ2V0X3Vuc2lnbmVkPHVuc2lnbmVkIGxvbmcgbG9uZz4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB1bnNpZ25lZCBsb25nIGxvbmcmKSBjb25zdKEGenVuc2lnbmVkIGxvbmcgbG9uZyBzdGQ6Ol9fMjo6X19udW1fZ2V0X3Vuc2lnbmVkX2ludGVncmFsPHVuc2lnbmVkIGxvbmcgbG9uZz4oY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBpbnQmLCBpbnQpogabAnN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGZsb2F0JikgY29uc3SjBvUCc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19kb19nZXRfZmxvYXRpbmdfcG9pbnQ8ZmxvYXQ+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgZmxvYXQmKSBjb25zdKQGWHN0ZDo6X18yOjpfX251bV9nZXQ8Y2hhcj46Ol9fc3RhZ2UyX2Zsb2F0X3ByZXAoc3RkOjpfXzI6Omlvc19iYXNlJiwgY2hhciosIGNoYXImLCBjaGFyJimlBvABc3RkOjpfXzI6Ol9fbnVtX2dldDxjaGFyPjo6X19zdGFnZTJfZmxvYXRfbG9vcChjaGFyLCBib29sJiwgY2hhciYsIGNoYXIqLCBjaGFyKiYsIGNoYXIsIGNoYXIsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QmLCB1bnNpZ25lZCBpbnQqLCB1bnNpZ25lZCBpbnQqJiwgdW5zaWduZWQgaW50JiwgY2hhcioppgZPZmxvYXQgc3RkOjpfXzI6Ol9fbnVtX2dldF9mbG9hdDxmbG9hdD4oY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBpbnQmKacGnAJzdGQ6Ol9fMjo6bnVtX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBkb3VibGUmKSBjb25zdKgG9wJzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiBzdGQ6Ol9fMjo6bnVtX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2RvX2dldF9mbG9hdGluZ19wb2ludDxkb3VibGU+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgZG91YmxlJikgY29uc3SpBlFkb3VibGUgc3RkOjpfXzI6Ol9fbnVtX2dldF9mbG9hdDxkb3VibGU+KGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgaW50JimqBqECc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgbG9uZyBkb3VibGUmKSBjb25zdKsGgQNzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiBzdGQ6Ol9fMjo6bnVtX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2RvX2dldF9mbG9hdGluZ19wb2ludDxsb25nIGRvdWJsZT4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBsb25nIGRvdWJsZSYpIGNvbnN0rAZbbG9uZyBkb3VibGUgc3RkOjpfXzI6Ol9fbnVtX2dldF9mbG9hdDxsb25nIGRvdWJsZT4oY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBpbnQmKa0GmwJzdGQ6Ol9fMjo6bnVtX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB2b2lkKiYpIGNvbnN0rgYSc3RkOjpfXzI6Ol9fY2xvYygprwZMc3RkOjpfXzI6Ol9fbGliY3BwX3NzY2FuZl9sKGNoYXIgY29uc3QqLCBfX2xvY2FsZV9zdHJ1Y3QqLCBjaGFyIGNvbnN0KiwgLi4uKbAGX3N0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46Ol9femVybygpsQZUY2hhciBjb25zdCogc3RkOjpfXzI6OmZpbmQ8Y2hhciBjb25zdCosIGNoYXI+KGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdCYpsgZJc3RkOjpfXzI6Ol9fbGliY3BwX2xvY2FsZV9ndWFyZDo6X19saWJjcHBfbG9jYWxlX2d1YXJkKF9fbG9jYWxlX3N0cnVjdComKbMGrwJzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBib29sJikgY29uc3S0Bm1zdGQ6Ol9fMjo6bnVtcHVuY3Q8d2NoYXJfdD4gY29uc3QmIHN0ZDo6X18yOjp1c2VfZmFjZXQ8c3RkOjpfXzI6Om51bXB1bmN0PHdjaGFyX3Q+ID4oc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYptQbgBXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4gY29uc3QqIHN0ZDo6X18yOjpfX3NjYW5fa2V5d29yZDxzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiBjb25zdCosIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiA+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4gY29uc3QqLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+IGNvbnN0Kiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JiwgdW5zaWduZWQgaW50JiwgYm9vbCm2Bq8Cc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgbG9uZyYpIGNvbnN0twaGA3N0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+IHN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZG9fZ2V0X3NpZ25lZDxsb25nPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGxvbmcmKSBjb25zdLgGTXN0ZDo6X18yOjpfX251bV9nZXQ8d2NoYXJfdD46Ol9fZG9fd2lkZW4oc3RkOjpfXzI6Omlvc19iYXNlJiwgd2NoYXJfdCopIGNvbnN0uQZOc3RkOjpfXzI6Ol9fbnVtX2dldDx3Y2hhcl90Pjo6X19zdGFnZTJfaW50X3ByZXAoc3RkOjpfXzI6Omlvc19iYXNlJiwgd2NoYXJfdCYpugbxAXN0ZDo6X18yOjpfX251bV9nZXQ8d2NoYXJfdD46Ol9fc3RhZ2UyX2ludF9sb29wKHdjaGFyX3QsIGludCwgY2hhciosIGNoYXIqJiwgdW5zaWduZWQgaW50Jiwgd2NoYXJfdCwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCYsIHVuc2lnbmVkIGludCosIHVuc2lnbmVkIGludComLCB3Y2hhcl90IGNvbnN0Kim7BrQCc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgbG9uZyBsb25nJikgY29uc3S8BpADc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19kb19nZXRfc2lnbmVkPGxvbmcgbG9uZz4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBsb25nIGxvbmcmKSBjb25zdL0GuQJzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB1bnNpZ25lZCBzaG9ydCYpIGNvbnN0vgacA3N0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+IHN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZG9fZ2V0X3Vuc2lnbmVkPHVuc2lnbmVkIHNob3J0PihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHVuc2lnbmVkIHNob3J0JikgY29uc3S/BrcCc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdW5zaWduZWQgaW50JikgY29uc3TABpgDc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19kb19nZXRfdW5zaWduZWQ8dW5zaWduZWQgaW50PihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHVuc2lnbmVkIGludCYpIGNvbnN0wQa9AnN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHVuc2lnbmVkIGxvbmcgbG9uZyYpIGNvbnN0wgakA3N0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+IHN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZG9fZ2V0X3Vuc2lnbmVkPHVuc2lnbmVkIGxvbmcgbG9uZz4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB1bnNpZ25lZCBsb25nIGxvbmcmKSBjb25zdMMGsAJzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBmbG9hdCYpIGNvbnN0xAaQA3N0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+IHN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZG9fZ2V0X2Zsb2F0aW5nX3BvaW50PGZsb2F0PihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGZsb2F0JikgY29uc3TFBmRzdGQ6Ol9fMjo6X19udW1fZ2V0PHdjaGFyX3Q+OjpfX3N0YWdlMl9mbG9hdF9wcmVwKHN0ZDo6X18yOjppb3NfYmFzZSYsIHdjaGFyX3QqLCB3Y2hhcl90Jiwgd2NoYXJfdCYpxgb/AXN0ZDo6X18yOjpfX251bV9nZXQ8d2NoYXJfdD46Ol9fc3RhZ2UyX2Zsb2F0X2xvb3Aod2NoYXJfdCwgYm9vbCYsIGNoYXImLCBjaGFyKiwgY2hhciomLCB3Y2hhcl90LCB3Y2hhcl90LCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0JiwgdW5zaWduZWQgaW50KiwgdW5zaWduZWQgaW50KiYsIHVuc2lnbmVkIGludCYsIHdjaGFyX3QqKccGsQJzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBkb3VibGUmKSBjb25zdMgGkgNzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiBzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2RvX2dldF9mbG9hdGluZ19wb2ludDxkb3VibGU+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgZG91YmxlJikgY29uc3TJBrYCc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgbG9uZyBkb3VibGUmKSBjb25zdMoGnANzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiBzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2RvX2dldF9mbG9hdGluZ19wb2ludDxsb25nIGRvdWJsZT4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBsb25nIGRvdWJsZSYpIGNvbnN0ywawAnN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHZvaWQqJikgY29uc3TMBmZ3Y2hhcl90IGNvbnN0KiBzdGQ6Ol9fMjo6ZmluZDx3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdD4od2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0JinNBmd3Y2hhcl90IGNvbnN0KiBzdGQ6Ol9fMjo6X19udW1fZ2V0PHdjaGFyX3Q+OjpfX2RvX3dpZGVuX3A8d2NoYXJfdD4oc3RkOjpfXzI6Omlvc19iYXNlJiwgd2NoYXJfdCopIGNvbnN0zgbNAXN0ZDo6X18yOjpudW1fcHV0PGNoYXIsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgY2hhciwgYm9vbCkgY29uc3TPBl5zdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpiZWdpbigp0AZcc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6ZW5kKCnRBs0Bc3RkOjpfXzI6Om51bV9wdXQ8Y2hhciwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCBjaGFyLCBsb25nKSBjb25zdNIGTnN0ZDo6X18yOjpfX251bV9wdXRfYmFzZTo6X19mb3JtYXRfaW50KGNoYXIqLCBjaGFyIGNvbnN0KiwgYm9vbCwgdW5zaWduZWQgaW50KdMGV3N0ZDo6X18yOjpfX2xpYmNwcF9zbnByaW50Zl9sKGNoYXIqLCB1bnNpZ25lZCBsb25nLCBfX2xvY2FsZV9zdHJ1Y3QqLCBjaGFyIGNvbnN0KiwgLi4uKdQGVXN0ZDo6X18yOjpfX251bV9wdXRfYmFzZTo6X19pZGVudGlmeV9wYWRkaW5nKGNoYXIqLCBjaGFyKiwgc3RkOjpfXzI6Omlvc19iYXNlIGNvbnN0JinVBnVzdGQ6Ol9fMjo6X19udW1fcHV0PGNoYXI+OjpfX3dpZGVuX2FuZF9ncm91cF9pbnQoY2hhciosIGNoYXIqLCBjaGFyKiwgY2hhciosIGNoYXIqJiwgY2hhciomLCBzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JinWBit2b2lkIHN0ZDo6X18yOjpyZXZlcnNlPGNoYXIqPihjaGFyKiwgY2hhciop1wYhc3RkOjpfXzI6Omlvc19iYXNlOjp3aWR0aCgpIGNvbnN02AbSAXN0ZDo6X18yOjpudW1fcHV0PGNoYXIsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgY2hhciwgbG9uZyBsb25nKSBjb25zdNkG1gFzdGQ6Ol9fMjo6bnVtX3B1dDxjaGFyLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIGNoYXIsIHVuc2lnbmVkIGxvbmcpIGNvbnN02gbbAXN0ZDo6X18yOjpudW1fcHV0PGNoYXIsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgY2hhciwgdW5zaWduZWQgbG9uZyBsb25nKSBjb25zdNsGzwFzdGQ6Ol9fMjo6bnVtX3B1dDxjaGFyLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIGNoYXIsIGRvdWJsZSkgY29uc3TcBkpzdGQ6Ol9fMjo6X19udW1fcHV0X2Jhc2U6Ol9fZm9ybWF0X2Zsb2F0KGNoYXIqLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgaW50Kd0GJXN0ZDo6X18yOjppb3NfYmFzZTo6cHJlY2lzaW9uKCkgY29uc3TeBklzdGQ6Ol9fMjo6X19saWJjcHBfYXNwcmludGZfbChjaGFyKiosIF9fbG9jYWxlX3N0cnVjdCosIGNoYXIgY29uc3QqLCAuLi4p3wZ3c3RkOjpfXzI6Ol9fbnVtX3B1dDxjaGFyPjo6X193aWRlbl9hbmRfZ3JvdXBfZmxvYXQoY2hhciosIGNoYXIqLCBjaGFyKiwgY2hhciosIGNoYXIqJiwgY2hhciomLCBzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JingBtQBc3RkOjpfXzI6Om51bV9wdXQ8Y2hhciwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCBjaGFyLCBsb25nIGRvdWJsZSkgY29uc3ThBtQBc3RkOjpfXzI6Om51bV9wdXQ8Y2hhciwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCBjaGFyLCB2b2lkIGNvbnN0KikgY29uc3TiBt8Bc3RkOjpfXzI6Om51bV9wdXQ8d2NoYXJfdCwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90LCBib29sKSBjb25zdOMGZXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID46OmVuZCgp5AbfAXN0ZDo6X18yOjpudW1fcHV0PHdjaGFyX3QsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgd2NoYXJfdCwgbG9uZykgY29uc3TlBoEBc3RkOjpfXzI6Ol9fbnVtX3B1dDx3Y2hhcl90Pjo6X193aWRlbl9hbmRfZ3JvdXBfaW50KGNoYXIqLCBjaGFyKiwgY2hhciosIHdjaGFyX3QqLCB3Y2hhcl90KiYsIHdjaGFyX3QqJiwgc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYp5gajAnN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+IHN0ZDo6X18yOjpfX3BhZF9hbmRfb3V0cHV0PHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqLCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90KecGNHZvaWQgc3RkOjpfXzI6OnJldmVyc2U8d2NoYXJfdCo+KHdjaGFyX3QqLCB3Y2hhcl90KinoBoQBc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6YmFzaWNfc3RyaW5nKHVuc2lnbmVkIGxvbmcsIHdjaGFyX3Qp6QbkAXN0ZDo6X18yOjpudW1fcHV0PHdjaGFyX3QsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgd2NoYXJfdCwgbG9uZyBsb25nKSBjb25zdOoG6AFzdGQ6Ol9fMjo6bnVtX3B1dDx3Y2hhcl90LCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHdjaGFyX3QsIHVuc2lnbmVkIGxvbmcpIGNvbnN06wbtAXN0ZDo6X18yOjpudW1fcHV0PHdjaGFyX3QsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgd2NoYXJfdCwgdW5zaWduZWQgbG9uZyBsb25nKSBjb25zdOwG4QFzdGQ6Ol9fMjo6bnVtX3B1dDx3Y2hhcl90LCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHdjaGFyX3QsIGRvdWJsZSkgY29uc3TtBoMBc3RkOjpfXzI6Ol9fbnVtX3B1dDx3Y2hhcl90Pjo6X193aWRlbl9hbmRfZ3JvdXBfZmxvYXQoY2hhciosIGNoYXIqLCBjaGFyKiwgd2NoYXJfdCosIHdjaGFyX3QqJiwgd2NoYXJfdComLCBzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JinuBuYBc3RkOjpfXzI6Om51bV9wdXQ8d2NoYXJfdCwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90LCBsb25nIGRvdWJsZSkgY29uc3TvBuYBc3RkOjpfXzI6Om51bV9wdXQ8d2NoYXJfdCwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90LCB2b2lkIGNvbnN0KikgY29uc3TwBlN2b2lkIHN0ZDo6X18yOjpfX3JldmVyc2U8Y2hhcio+KGNoYXIqLCBjaGFyKiwgc3RkOjpfXzI6OnJhbmRvbV9hY2Nlc3NfaXRlcmF0b3JfdGFnKfEGXHZvaWQgc3RkOjpfXzI6Ol9fcmV2ZXJzZTx3Y2hhcl90Kj4od2NoYXJfdCosIHdjaGFyX3QqLCBzdGQ6Ol9fMjo6cmFuZG9tX2FjY2Vzc19pdGVyYXRvcl90YWcp8gawAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpnZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB0bSosIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KikgY29uc3TzBnNzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZGF0ZV9vcmRlcigpIGNvbnN09AaeAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXRfdGltZShzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHRtKikgY29uc3T1Bp4Cc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldF9kYXRlKHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdG0qKSBjb25zdPYGoQJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0X3dlZWtkYXkoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB0bSopIGNvbnN09wavAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2dldF93ZWVrZGF5bmFtZShpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdPgGowJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0X21vbnRobmFtZShzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHRtKikgY29uc3T5Bq0Cc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0X21vbnRobmFtZShpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdPoGngJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0X3llYXIoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB0bSopIGNvbnN0+waoAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2dldF95ZWFyKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYpIGNvbnN0/AalAmludCBzdGQ6Ol9fMjo6X19nZXRfdXBfdG9fbl9kaWdpdHM8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmLCBpbnQp/QalAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB0bSosIGNoYXIsIGNoYXIpIGNvbnN0/galAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2dldF9wZXJjZW50KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYpIGNvbnN0/wanAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2dldF9kYXkoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JikgY29uc3SAB6gCc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0X2hvdXIoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JikgY29uc3SBB6sCc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0XzEyX2hvdXIoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JikgY29uc3SCB7ACc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0X2RheV95ZWFyX251bShpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdIMHqQJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfbW9udGgoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JikgY29uc3SEB6oCc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0X21pbnV0ZShpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdIUHqQJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfd2hpdGVfc3BhY2Uoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JikgY29uc3SGB6kCc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0X2FtX3BtKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYpIGNvbnN0hweqAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2dldF9zZWNvbmQoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JikgY29uc3SIB6sCc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0X3dlZWtkYXkoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JikgY29uc3SJB6kCc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0X3llYXI0KGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYpIGNvbnN0igfLAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpnZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB0bSosIHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0KikgY29uc3SLB7MCc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldF90aW1lKHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdG0qKSBjb25zdIwHswJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0X2RhdGUoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB0bSopIGNvbnN0jQe2AnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXRfd2Vla2RheShzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHRtKikgY29uc3SOB8cCc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZ2V0X3dlZWtkYXluYW1lKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN0jwe4AnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXRfbW9udGhuYW1lKHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdG0qKSBjb25zdJAHxQJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfbW9udGhuYW1lKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN0kQezAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXRfeWVhcihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHRtKikgY29uc3SSB8ACc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZ2V0X3llYXIoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JikgY29uc3STB70CaW50IHN0ZDo6X18yOjpfX2dldF91cF90b19uX2RpZ2l0czx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYsIGludCmUB7oCc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHRtKiwgY2hhciwgY2hhcikgY29uc3SVB70Cc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZ2V0X3BlcmNlbnQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JikgY29uc3SWB78Cc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZ2V0X2RheShpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmKSBjb25zdJcHwAJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfaG91cihpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmKSBjb25zdJgHwwJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfMTJfaG91cihpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmKSBjb25zdJkHyAJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfZGF5X3llYXJfbnVtKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN0mgfBAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF9tb250aChpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmKSBjb25zdJsHwgJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfbWludXRlKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN0nAfBAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF93aGl0ZV9zcGFjZShzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmKSBjb25zdJ0HwQJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfYW1fcG0oaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JikgY29uc3SeB8ICc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZ2V0X3NlY29uZChpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmKSBjb25zdJ8HwwJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfd2Vla2RheShpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmKSBjb25zdKAHwQJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfeWVhcjQoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JikgY29uc3ShB98Bc3RkOjpfXzI6OnRpbWVfcHV0PGNoYXIsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgY2hhciwgdG0gY29uc3QqLCBjaGFyLCBjaGFyKSBjb25zdKIHSnN0ZDo6X18yOjpfX3RpbWVfcHV0OjpfX2RvX3B1dChjaGFyKiwgY2hhciomLCB0bSBjb25zdCosIGNoYXIsIGNoYXIpIGNvbnN0oweNAXN0ZDo6X18yOjplbmFibGVfaWY8KGlzX21vdmVfY29uc3RydWN0aWJsZTxjaGFyPjo6dmFsdWUpICYmIChpc19tb3ZlX2Fzc2lnbmFibGU8Y2hhcj46OnZhbHVlKSwgdm9pZD46OnR5cGUgc3RkOjpfXzI6OnN3YXA8Y2hhcj4oY2hhciYsIGNoYXImKaQH7gFzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiBzdGQ6Ol9fMjo6X19jb3B5PGNoYXIqLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+KGNoYXIqLCBjaGFyKiwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4ppQfxAXN0ZDo6X18yOjp0aW1lX3B1dDx3Y2hhcl90LCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHdjaGFyX3QsIHRtIGNvbnN0KiwgY2hhciwgY2hhcikgY29uc3SmB1BzdGQ6Ol9fMjo6X190aW1lX3B1dDo6X19kb19wdXQod2NoYXJfdCosIHdjaGFyX3QqJiwgdG0gY29uc3QqLCBjaGFyLCBjaGFyKSBjb25zdKcHZXN0ZDo6X18yOjpfX2xpYmNwcF9tYnNydG93Y3NfbCh3Y2hhcl90KiwgY2hhciBjb25zdCoqLCB1bnNpZ25lZCBsb25nLCBfX21ic3RhdGVfdCosIF9fbG9jYWxlX3N0cnVjdCopqAcsc3RkOjpfXzI6Ol9fdGhyb3dfcnVudGltZV9lcnJvcihjaGFyIGNvbnN0KimpB4kCc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gc3RkOjpfXzI6Ol9fY29weTx3Y2hhcl90Kiwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPih3Y2hhcl90Kiwgd2NoYXJfdCosIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+KaoHO3N0ZDo6X18yOjptb25leXB1bmN0PGNoYXIsIGZhbHNlPjo6ZG9fZGVjaW1hbF9wb2ludCgpIGNvbnN0qwc2c3RkOjpfXzI6Om1vbmV5cHVuY3Q8Y2hhciwgZmFsc2U+Ojpkb19ncm91cGluZygpIGNvbnN0rAc7c3RkOjpfXzI6Om1vbmV5cHVuY3Q8Y2hhciwgZmFsc2U+Ojpkb19uZWdhdGl2ZV9zaWduKCkgY29uc3StBzhzdGQ6Ol9fMjo6bW9uZXlwdW5jdDxjaGFyLCBmYWxzZT46OmRvX3Bvc19mb3JtYXQoKSBjb25zdK4HPnN0ZDo6X18yOjptb25leXB1bmN0PHdjaGFyX3QsIGZhbHNlPjo6ZG9fZGVjaW1hbF9wb2ludCgpIGNvbnN0rwc+c3RkOjpfXzI6Om1vbmV5cHVuY3Q8d2NoYXJfdCwgZmFsc2U+Ojpkb19uZWdhdGl2ZV9zaWduKCkgY29uc3SwB6kCc3RkOjpfXzI6Om1vbmV5X2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBib29sLCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBsb25nIGRvdWJsZSYpIGNvbnN0sQeMA3N0ZDo6X18yOjptb25leV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19kb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgYm9vbCwgc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50JiwgYm9vbCYsIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYsIHN0ZDo6X18yOjp1bmlxdWVfcHRyPGNoYXIsIHZvaWQgKCopKHZvaWQqKT4mLCBjaGFyKiYsIGNoYXIqKbIH3QNzdGQ6Ol9fMjo6X19tb25leV9nZXQ8Y2hhcj46Ol9fZ2F0aGVyX2luZm8oYm9vbCwgc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYsIHN0ZDo6X18yOjptb25leV9iYXNlOjpwYXR0ZXJuJiwgY2hhciYsIGNoYXImLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+JiwgaW50JimzB1JzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6b3BlcmF0b3IrKyhpbnQptAdmdm9pZCBzdGQ6Ol9fMjo6X19kb3VibGVfb3Jfbm90aGluZzxjaGFyPihzdGQ6Ol9fMjo6dW5pcXVlX3B0cjxjaGFyLCB2b2lkICgqKSh2b2lkKik+JiwgY2hhciomLCBjaGFyKiYptQeGAXZvaWQgc3RkOjpfXzI6Ol9fZG91YmxlX29yX25vdGhpbmc8dW5zaWduZWQgaW50PihzdGQ6Ol9fMjo6dW5pcXVlX3B0cjx1bnNpZ25lZCBpbnQsIHZvaWQgKCopKHZvaWQqKT4mLCB1bnNpZ25lZCBpbnQqJiwgdW5zaWduZWQgaW50KiYptgfzAnN0ZDo6X18yOjptb25leV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgYm9vbCwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiYpIGNvbnN0twdec3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6Y2xlYXIoKbgH2gFzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+JiBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpfX2FwcGVuZF9mb3J3YXJkX3Vuc2FmZTxjaGFyKj4oY2hhciosIGNoYXIqKbkHd3N0ZDo6X18yOjptb25leXB1bmN0PGNoYXIsIHRydWU+IGNvbnN0JiBzdGQ6Ol9fMjo6dXNlX2ZhY2V0PHN0ZDo6X18yOjptb25leXB1bmN0PGNoYXIsIHRydWU+ID4oc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYpuge5AXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46Om9wZXJhdG9yPShzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+JiYpuwd5c3RkOjpfXzI6Om1vbmV5cHVuY3Q8Y2hhciwgZmFsc2U+IGNvbnN0JiBzdGQ6Ol9fMjo6dXNlX2ZhY2V0PHN0ZDo6X18yOjptb25leXB1bmN0PGNoYXIsIGZhbHNlPiA+KHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKbwH7wFib29sIHN0ZDo6X18yOjplcXVhbDxzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8Y2hhcio+LCBzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8Y2hhcio+LCBzdGQ6Ol9fMjo6X19lcXVhbF90bzxjaGFyLCBjaGFyPiA+KHN0ZDo6X18yOjpfX3dyYXBfaXRlcjxjaGFyKj4sIHN0ZDo6X18yOjpfX3dyYXBfaXRlcjxjaGFyKj4sIHN0ZDo6X18yOjpfX3dyYXBfaXRlcjxjaGFyKj4sIHN0ZDo6X18yOjpfX2VxdWFsX3RvPGNoYXIsIGNoYXI+Kb0HM3N0ZDo6X18yOjpfX3dyYXBfaXRlcjxjaGFyKj46Om9wZXJhdG9yKyhsb25nKSBjb25zdL4HZXN0ZDo6X18yOjp1bmlxdWVfcHRyPGNoYXIsIHZvaWQgKCopKHZvaWQqKT46Om9wZXJhdG9yPShzdGQ6Ol9fMjo6dW5pcXVlX3B0cjxjaGFyLCB2b2lkICgqKSh2b2lkKik+JiYpvwe+AnN0ZDo6X18yOjptb25leV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgYm9vbCwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgbG9uZyBkb3VibGUmKSBjb25zdMAHrQNzdGQ6Ol9fMjo6bW9uZXlfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIGJvb2wsIHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmLCB1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCYsIGJvb2wmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmLCBzdGQ6Ol9fMjo6dW5pcXVlX3B0cjx3Y2hhcl90LCB2b2lkICgqKSh2b2lkKik+Jiwgd2NoYXJfdComLCB3Y2hhcl90KinBB4EEc3RkOjpfXzI6Ol9fbW9uZXlfZ2V0PHdjaGFyX3Q+OjpfX2dhdGhlcl9pbmZvKGJvb2wsIHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmLCBzdGQ6Ol9fMjo6bW9uZXlfYmFzZTo6cGF0dGVybiYsIHdjaGFyX3QmLCB3Y2hhcl90Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiYsIGludCYpwgdYc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46Om9wZXJhdG9yKysoaW50KcMHkQNzdGQ6Ol9fMjo6bW9uZXlfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIGJvb2wsIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4mKSBjb25zdMQHZ3N0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID46OmNsZWFyKCnFB/UBc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiYgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6X19hcHBlbmRfZm9yd2FyZF91bnNhZmU8d2NoYXJfdCo+KHdjaGFyX3QqLCB3Y2hhcl90KinGB31zdGQ6Ol9fMjo6bW9uZXlwdW5jdDx3Y2hhcl90LCB0cnVlPiBjb25zdCYgc3RkOjpfXzI6OnVzZV9mYWNldDxzdGQ6Ol9fMjo6bW9uZXlwdW5jdDx3Y2hhcl90LCB0cnVlPiA+KHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKccHywFzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+OjpvcGVyYXRvcj0oc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiYmKcgHf3N0ZDo6X18yOjptb25leXB1bmN0PHdjaGFyX3QsIGZhbHNlPiBjb25zdCYgc3RkOjpfXzI6OnVzZV9mYWNldDxzdGQ6Ol9fMjo6bW9uZXlwdW5jdDx3Y2hhcl90LCBmYWxzZT4gPihzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JinJB4oCYm9vbCBzdGQ6Ol9fMjo6ZXF1YWw8c3RkOjpfXzI6Ol9fd3JhcF9pdGVyPHdjaGFyX3QqPiwgc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPHdjaGFyX3QqPiwgc3RkOjpfXzI6Ol9fZXF1YWxfdG88d2NoYXJfdCwgd2NoYXJfdD4gPihzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8d2NoYXJfdCo+LCBzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8d2NoYXJfdCo+LCBzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8d2NoYXJfdCo+LCBzdGQ6Ol9fMjo6X19lcXVhbF90bzx3Y2hhcl90LCB3Y2hhcl90PinKBzZzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8d2NoYXJfdCo+OjpvcGVyYXRvcisobG9uZykgY29uc3TLB9wBc3RkOjpfXzI6Om1vbmV5X3B1dDxjaGFyLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIGJvb2wsIHN0ZDo6X18yOjppb3NfYmFzZSYsIGNoYXIsIGxvbmcgZG91YmxlKSBjb25zdMwHiwNzdGQ6Ol9fMjo6X19tb25leV9wdXQ8Y2hhcj46Ol9fZ2F0aGVyX2luZm8oYm9vbCwgYm9vbCwgc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYsIHN0ZDo6X18yOjptb25leV9iYXNlOjpwYXR0ZXJuJiwgY2hhciYsIGNoYXImLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4mLCBpbnQmKc0H2QNzdGQ6Ol9fMjo6X19tb25leV9wdXQ8Y2hhcj46Ol9fZm9ybWF0KGNoYXIqLCBjaGFyKiYsIGNoYXIqJiwgdW5zaWduZWQgaW50LCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYsIGJvb2wsIHN0ZDo6X18yOjptb25leV9iYXNlOjpwYXR0ZXJuIGNvbnN0JiwgY2hhciwgY2hhciwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QmLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0JiwgaW50Kc4HjgFjaGFyKiBzdGQ6Ol9fMjo6Y29weTxzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8Y2hhciBjb25zdCo+LCBjaGFyKj4oc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPGNoYXIgY29uc3QqPiwgc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPGNoYXIgY29uc3QqPiwgY2hhciopzwetAnN0ZDo6X18yOjptb25leV9wdXQ8Y2hhciwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBib29sLCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCBjaGFyLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0JikgY29uc3TQB+4Bc3RkOjpfXzI6Om1vbmV5X3B1dDx3Y2hhcl90LCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIGJvb2wsIHN0ZDo6X18yOjppb3NfYmFzZSYsIHdjaGFyX3QsIGxvbmcgZG91YmxlKSBjb25zdNEHpgNzdGQ6Ol9fMjo6X19tb25leV9wdXQ8d2NoYXJfdD46Ol9fZ2F0aGVyX2luZm8oYm9vbCwgYm9vbCwgc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYsIHN0ZDo6X18yOjptb25leV9iYXNlOjpwYXR0ZXJuJiwgd2NoYXJfdCYsIHdjaGFyX3QmLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4mLCBpbnQmKdIHhgRzdGQ6Ol9fMjo6X19tb25leV9wdXQ8d2NoYXJfdD46Ol9fZm9ybWF0KHdjaGFyX3QqLCB3Y2hhcl90KiYsIHdjaGFyX3QqJiwgdW5zaWduZWQgaW50LCB3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdCosIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYsIGJvb2wsIHN0ZDo6X18yOjptb25leV9iYXNlOjpwYXR0ZXJuIGNvbnN0Jiwgd2NoYXJfdCwgd2NoYXJfdCwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4gY29uc3QmLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+IGNvbnN0JiwgaW50KdMHoAF3Y2hhcl90KiBzdGQ6Ol9fMjo6Y29weTxzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8d2NoYXJfdCBjb25zdCo+LCB3Y2hhcl90Kj4oc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPHdjaGFyX3QgY29uc3QqPiwgc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPHdjaGFyX3QgY29uc3QqPiwgd2NoYXJfdCop1AfIAnN0ZDo6X18yOjptb25leV9wdXQ8d2NoYXJfdCwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBib29sLCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90LCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+IGNvbnN0JikgY29uc3TVB5ABY2hhciogc3RkOjpfXzI6Ol9fY29weTxzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8Y2hhciBjb25zdCo+LCBjaGFyKj4oc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPGNoYXIgY29uc3QqPiwgc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPGNoYXIgY29uc3QqPiwgY2hhciop1geiAXdjaGFyX3QqIHN0ZDo6X18yOjpfX2NvcHk8c3RkOjpfXzI6Ol9fd3JhcF9pdGVyPHdjaGFyX3QgY29uc3QqPiwgd2NoYXJfdCo+KHN0ZDo6X18yOjpfX3dyYXBfaXRlcjx3Y2hhcl90IGNvbnN0Kj4sIHN0ZDo6X18yOjpfX3dyYXBfaXRlcjx3Y2hhcl90IGNvbnN0Kj4sIHdjaGFyX3QqKdcHngFzdGQ6Ol9fMjo6bWVzc2FnZXM8Y2hhcj46OmRvX29wZW4oc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCYsIHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKSBjb25zdNgHlAFzdGQ6Ol9fMjo6bWVzc2FnZXM8Y2hhcj46OmRvX2dldChsb25nLCBpbnQsIGludCwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCYpIGNvbnN02Qe4A3N0ZDo6X18yOjpiYWNrX2luc2VydF9pdGVyYXRvcjxzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+ID4gc3RkOjpfXzI6Ol9fbmFycm93X3RvX3V0Zjg8OHVsPjo6b3BlcmF0b3IoKTxzdGQ6Ol9fMjo6YmFja19pbnNlcnRfaXRlcmF0b3I8c3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiA+LCBjaGFyPihzdGQ6Ol9fMjo6YmFja19pbnNlcnRfaXRlcmF0b3I8c3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiA+LCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdCopIGNvbnN02geOAXN0ZDo6X18yOjpiYWNrX2luc2VydF9pdGVyYXRvcjxzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+ID46Om9wZXJhdG9yPShjaGFyIGNvbnN0JinbB6ABc3RkOjpfXzI6Om1lc3NhZ2VzPHdjaGFyX3Q+Ojpkb19nZXQobG9uZywgaW50LCBpbnQsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4gY29uc3QmKSBjb25zdNwHwgNzdGQ6Ol9fMjo6YmFja19pbnNlcnRfaXRlcmF0b3I8c3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiA+IHN0ZDo6X18yOjpfX25hcnJvd190b191dGY4PDMydWw+OjpvcGVyYXRvcigpPHN0ZDo6X18yOjpiYWNrX2luc2VydF9pdGVyYXRvcjxzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+ID4sIHdjaGFyX3Q+KHN0ZDo6X18yOjpiYWNrX2luc2VydF9pdGVyYXRvcjxzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+ID4sIHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0KikgY29uc3TdB9ADc3RkOjpfXzI6OmJhY2tfaW5zZXJ0X2l0ZXJhdG9yPHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4gPiBzdGQ6Ol9fMjo6X193aWRlbl9mcm9tX3V0Zjg8MzJ1bD46Om9wZXJhdG9yKCk8c3RkOjpfXzI6OmJhY2tfaW5zZXJ0X2l0ZXJhdG9yPHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4gPiA+KHN0ZDo6X18yOjpiYWNrX2luc2VydF9pdGVyYXRvcjxzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+ID4sIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KikgY29uc3TeBzlzdGQ6Ol9fMjo6Y29kZWN2dDx3Y2hhcl90LCBjaGFyLCBfX21ic3RhdGVfdD46On5jb2RlY3Z0KCnfBy1zdGQ6Ol9fMjo6bG9jYWxlOjpfX2ltcDo6X19pbXAodW5zaWduZWQgbG9uZyngB35zdGQ6Ol9fMjo6X192ZWN0b3JfYmFzZTxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiA+OjpfX3ZlY3Rvcl9iYXNlKCnhB4IBc3RkOjpfXzI6OnZlY3RvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiA+OjpfX3ZhbGxvY2F0ZSh1bnNpZ25lZCBsb25nKeIHiQFzdGQ6Ol9fMjo6dmVjdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46Ol9fY29uc3RydWN0X2F0X2VuZCh1bnNpZ25lZCBsb25nKeMHdnN0ZDo6X18yOjpfX3ZlY3Rvcl9iYXNlPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46OmNsZWFyKCnkB44Bc3RkOjpfXzI6OnZlY3RvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiA+OjpfX2Fubm90YXRlX3Nocmluayh1bnNpZ25lZCBsb25nKSBjb25zdOUHHXN0ZDo6X18yOjpsb2NhbGU6OmlkOjpfX2dldCgp5gdAc3RkOjpfXzI6OmxvY2FsZTo6X19pbXA6Omluc3RhbGwoc3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBsb25nKecHSHN0ZDo6X18yOjpjdHlwZTxjaGFyPjo6Y3R5cGUodW5zaWduZWQgc2hvcnQgY29uc3QqLCBib29sLCB1bnNpZ25lZCBsb25nKegHG3N0ZDo6X18yOjpsb2NhbGU6OmNsYXNzaWMoKekHfXN0ZDo6X18yOjp2ZWN0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4gPjo6cmVzaXplKHVuc2lnbmVkIGxvbmcp6gchc3RkOjpfXzI6OmxvY2FsZTo6X19pbXA6On5fX2ltcCgp6weBAXN0ZDo6X18yOjp2ZWN0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4gPjo6X19hbm5vdGF0ZV9kZWxldGUoKSBjb25zdOwHI3N0ZDo6X18yOjpsb2NhbGU6Ol9faW1wOjp+X19pbXAoKS4x7Qd/c3RkOjpfXzI6OnZlY3RvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiA+OjpfX2FwcGVuZCh1bnNpZ25lZCBsb25nKe4HHHN0ZDo6X18yOjpsb2NhbGU6Ol9fZ2xvYmFsKCnvBxpzdGQ6Ol9fMjo6bG9jYWxlOjpsb2NhbGUoKfAHLnN0ZDo6X18yOjpsb2NhbGU6Ol9faW1wOjpoYXNfZmFjZXQobG9uZykgY29uc3TxBx5zdGQ6Ol9fMjo6bG9jYWxlOjppZDo6X19pbml0KCnyB4wBdm9pZCBzdGQ6Ol9fMjo6Y2FsbF9vbmNlPHN0ZDo6X18yOjooYW5vbnltb3VzIG5hbWVzcGFjZSk6Ol9fZmFrZV9iaW5kPihzdGQ6Ol9fMjo6b25jZV9mbGFnJiwgc3RkOjpfXzI6Oihhbm9ueW1vdXMgbmFtZXNwYWNlKTo6X19mYWtlX2JpbmQmJinzBytzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldDo6X19vbl96ZXJvX3NoYXJlZCgp9Adpdm9pZCBzdGQ6Ol9fMjo6X19jYWxsX29uY2VfcHJveHk8c3RkOjpfXzI6OnR1cGxlPHN0ZDo6X18yOjooYW5vbnltb3VzIG5hbWVzcGFjZSk6Ol9fZmFrZV9iaW5kJiY+ID4odm9pZCop9Qc+c3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+Ojpkb19pcyh1bnNpZ25lZCBzaG9ydCwgd2NoYXJfdCkgY29uc3T2B1ZzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD46OmRvX2lzKHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0KiwgdW5zaWduZWQgc2hvcnQqKSBjb25zdPcHWnN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90Pjo6ZG9fc2Nhbl9pcyh1bnNpZ25lZCBzaG9ydCwgd2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqKSBjb25zdPgHW3N0ZDo6X18yOjpjdHlwZTx3Y2hhcl90Pjo6ZG9fc2Nhbl9ub3QodW5zaWduZWQgc2hvcnQsIHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0KikgY29uc3T5BzNzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD46OmRvX3RvdXBwZXIod2NoYXJfdCkgY29uc3T6B0RzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD46OmRvX3RvdXBwZXIod2NoYXJfdCosIHdjaGFyX3QgY29uc3QqKSBjb25zdPsHM3N0ZDo6X18yOjpjdHlwZTx3Y2hhcl90Pjo6ZG9fdG9sb3dlcih3Y2hhcl90KSBjb25zdPwHRHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90Pjo6ZG9fdG9sb3dlcih3Y2hhcl90Kiwgd2NoYXJfdCBjb25zdCopIGNvbnN0/Qcuc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+Ojpkb193aWRlbihjaGFyKSBjb25zdP4HTHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90Pjo6ZG9fd2lkZW4oY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCB3Y2hhcl90KikgY29uc3T/BzhzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD46OmRvX25hcnJvdyh3Y2hhcl90LCBjaGFyKSBjb25zdIAIVnN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90Pjo6ZG9fbmFycm93KHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0KiwgY2hhciwgY2hhciopIGNvbnN0gQgfc3RkOjpfXzI6OmN0eXBlPGNoYXI+Ojp+Y3R5cGUoKYIIIXN0ZDo6X18yOjpjdHlwZTxjaGFyPjo6fmN0eXBlKCkuMYMILXN0ZDo6X18yOjpjdHlwZTxjaGFyPjo6ZG9fdG91cHBlcihjaGFyKSBjb25zdIQIO3N0ZDo6X18yOjpjdHlwZTxjaGFyPjo6ZG9fdG91cHBlcihjaGFyKiwgY2hhciBjb25zdCopIGNvbnN0hQgtc3RkOjpfXzI6OmN0eXBlPGNoYXI+Ojpkb190b2xvd2VyKGNoYXIpIGNvbnN0hgg7c3RkOjpfXzI6OmN0eXBlPGNoYXI+Ojpkb190b2xvd2VyKGNoYXIqLCBjaGFyIGNvbnN0KikgY29uc3SHCEZzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj46OmRvX3dpZGVuKGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgY2hhciopIGNvbnN0iAgyc3RkOjpfXzI6OmN0eXBlPGNoYXI+Ojpkb19uYXJyb3coY2hhciwgY2hhcikgY29uc3SJCE1zdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj46OmRvX25hcnJvdyhjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIGNoYXIsIGNoYXIqKSBjb25zdIoIhAFzdGQ6Ol9fMjo6Y29kZWN2dDxjaGFyLCBjaGFyLCBfX21ic3RhdGVfdD46OmRvX291dChfX21ic3RhdGVfdCYsIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdComLCBjaGFyKiwgY2hhciosIGNoYXIqJikgY29uc3SLCGBzdGQ6Ol9fMjo6Y29kZWN2dDxjaGFyLCBjaGFyLCBfX21ic3RhdGVfdD46OmRvX3Vuc2hpZnQoX19tYnN0YXRlX3QmLCBjaGFyKiwgY2hhciosIGNoYXIqJikgY29uc3SMCHJzdGQ6Ol9fMjo6Y29kZWN2dDxjaGFyLCBjaGFyLCBfX21ic3RhdGVfdD46OmRvX2xlbmd0aChfX21ic3RhdGVfdCYsIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgbG9uZykgY29uc3SNCDtzdGQ6Ol9fMjo6Y29kZWN2dDx3Y2hhcl90LCBjaGFyLCBfX21ic3RhdGVfdD46On5jb2RlY3Z0KCkuMY4IkAFzdGQ6Ol9fMjo6Y29kZWN2dDx3Y2hhcl90LCBjaGFyLCBfX21ic3RhdGVfdD46OmRvX291dChfX21ic3RhdGVfdCYsIHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdComLCBjaGFyKiwgY2hhciosIGNoYXIqJikgY29uc3SPCHVzdGQ6Ol9fMjo6X19saWJjcHBfd2NzbnJ0b21ic19sKGNoYXIqLCB3Y2hhcl90IGNvbnN0KiosIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIF9fbWJzdGF0ZV90KiwgX19sb2NhbGVfc3RydWN0KimQCExzdGQ6Ol9fMjo6X19saWJjcHBfd2NydG9tYl9sKGNoYXIqLCB3Y2hhcl90LCBfX21ic3RhdGVfdCosIF9fbG9jYWxlX3N0cnVjdCopkQiPAXN0ZDo6X18yOjpjb2RlY3Z0PHdjaGFyX3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9faW4oX19tYnN0YXRlX3QmLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqJiwgd2NoYXJfdCosIHdjaGFyX3QqLCB3Y2hhcl90KiYpIGNvbnN0kgh1c3RkOjpfXzI6Ol9fbGliY3BwX21ic25ydG93Y3NfbCh3Y2hhcl90KiwgY2hhciBjb25zdCoqLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCBfX21ic3RhdGVfdCosIF9fbG9jYWxlX3N0cnVjdCopkwhic3RkOjpfXzI6Ol9fbGliY3BwX21icnRvd2NfbCh3Y2hhcl90KiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGxvbmcsIF9fbWJzdGF0ZV90KiwgX19sb2NhbGVfc3RydWN0KimUCGNzdGQ6Ol9fMjo6Y29kZWN2dDx3Y2hhcl90LCBjaGFyLCBfX21ic3RhdGVfdD46OmRvX3Vuc2hpZnQoX19tYnN0YXRlX3QmLCBjaGFyKiwgY2hhciosIGNoYXIqJikgY29uc3SVCEJzdGQ6Ol9fMjo6Y29kZWN2dDx3Y2hhcl90LCBjaGFyLCBfX21ic3RhdGVfdD46OmRvX2VuY29kaW5nKCkgY29uc3SWCFNzdGQ6Ol9fMjo6X19saWJjcHBfbWJ0b3djX2wod2NoYXJfdCosIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBsb25nLCBfX2xvY2FsZV9zdHJ1Y3QqKZcIMXN0ZDo6X18yOjpfX2xpYmNwcF9tYl9jdXJfbWF4X2woX19sb2NhbGVfc3RydWN0KimYCHVzdGQ6Ol9fMjo6Y29kZWN2dDx3Y2hhcl90LCBjaGFyLCBfX21ic3RhdGVfdD46OmRvX2xlbmd0aChfX21ic3RhdGVfdCYsIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgbG9uZykgY29uc3SZCFdzdGQ6Ol9fMjo6X19saWJjcHBfbWJybGVuX2woY2hhciBjb25zdCosIHVuc2lnbmVkIGxvbmcsIF9fbWJzdGF0ZV90KiwgX19sb2NhbGVfc3RydWN0KimaCERzdGQ6Ol9fMjo6Y29kZWN2dDx3Y2hhcl90LCBjaGFyLCBfX21ic3RhdGVfdD46OmRvX21heF9sZW5ndGgoKSBjb25zdJsIlAFzdGQ6Ol9fMjo6Y29kZWN2dDxjaGFyMTZfdCwgY2hhciwgX19tYnN0YXRlX3Q+Ojpkb19vdXQoX19tYnN0YXRlX3QmLCBjaGFyMTZfdCBjb25zdCosIGNoYXIxNl90IGNvbnN0KiwgY2hhcjE2X3QgY29uc3QqJiwgY2hhciosIGNoYXIqLCBjaGFyKiYpIGNvbnN0nAi1AXN0ZDo6X18yOjp1dGYxNl90b191dGY4KHVuc2lnbmVkIHNob3J0IGNvbnN0KiwgdW5zaWduZWQgc2hvcnQgY29uc3QqLCB1bnNpZ25lZCBzaG9ydCBjb25zdComLCB1bnNpZ25lZCBjaGFyKiwgdW5zaWduZWQgY2hhciosIHVuc2lnbmVkIGNoYXIqJiwgdW5zaWduZWQgbG9uZywgc3RkOjpfXzI6OmNvZGVjdnRfbW9kZSmdCJMBc3RkOjpfXzI6OmNvZGVjdnQ8Y2hhcjE2X3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9faW4oX19tYnN0YXRlX3QmLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqJiwgY2hhcjE2X3QqLCBjaGFyMTZfdCosIGNoYXIxNl90KiYpIGNvbnN0ngi1AXN0ZDo6X18yOjp1dGY4X3RvX3V0ZjE2KHVuc2lnbmVkIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgY2hhciBjb25zdComLCB1bnNpZ25lZCBzaG9ydCosIHVuc2lnbmVkIHNob3J0KiwgdW5zaWduZWQgc2hvcnQqJiwgdW5zaWduZWQgbG9uZywgc3RkOjpfXzI6OmNvZGVjdnRfbW9kZSmfCHZzdGQ6Ol9fMjo6Y29kZWN2dDxjaGFyMTZfdCwgY2hhciwgX19tYnN0YXRlX3Q+Ojpkb19sZW5ndGgoX19tYnN0YXRlX3QmLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGxvbmcpIGNvbnN0oAiAAXN0ZDo6X18yOjp1dGY4X3RvX3V0ZjE2X2xlbmd0aCh1bnNpZ25lZCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgY2hhciBjb25zdCosIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIHN0ZDo6X18yOjpjb2RlY3Z0X21vZGUpoQhFc3RkOjpfXzI6OmNvZGVjdnQ8Y2hhcjE2X3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9fbWF4X2xlbmd0aCgpIGNvbnN0ogiUAXN0ZDo6X18yOjpjb2RlY3Z0PGNoYXIzMl90LCBjaGFyLCBfX21ic3RhdGVfdD46OmRvX291dChfX21ic3RhdGVfdCYsIGNoYXIzMl90IGNvbnN0KiwgY2hhcjMyX3QgY29uc3QqLCBjaGFyMzJfdCBjb25zdComLCBjaGFyKiwgY2hhciosIGNoYXIqJikgY29uc3SjCK4Bc3RkOjpfXzI6OnVjczRfdG9fdXRmOCh1bnNpZ25lZCBpbnQgY29uc3QqLCB1bnNpZ25lZCBpbnQgY29uc3QqLCB1bnNpZ25lZCBpbnQgY29uc3QqJiwgdW5zaWduZWQgY2hhciosIHVuc2lnbmVkIGNoYXIqLCB1bnNpZ25lZCBjaGFyKiYsIHVuc2lnbmVkIGxvbmcsIHN0ZDo6X18yOjpjb2RlY3Z0X21vZGUppAiTAXN0ZDo6X18yOjpjb2RlY3Z0PGNoYXIzMl90LCBjaGFyLCBfX21ic3RhdGVfdD46OmRvX2luKF9fbWJzdGF0ZV90JiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiYsIGNoYXIzMl90KiwgY2hhcjMyX3QqLCBjaGFyMzJfdComKSBjb25zdKUIrgFzdGQ6Ol9fMjo6dXRmOF90b191Y3M0KHVuc2lnbmVkIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgY2hhciBjb25zdComLCB1bnNpZ25lZCBpbnQqLCB1bnNpZ25lZCBpbnQqLCB1bnNpZ25lZCBpbnQqJiwgdW5zaWduZWQgbG9uZywgc3RkOjpfXzI6OmNvZGVjdnRfbW9kZSmmCHZzdGQ6Ol9fMjo6Y29kZWN2dDxjaGFyMzJfdCwgY2hhciwgX19tYnN0YXRlX3Q+Ojpkb19sZW5ndGgoX19tYnN0YXRlX3QmLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGxvbmcpIGNvbnN0pwh/c3RkOjpfXzI6OnV0ZjhfdG9fdWNzNF9sZW5ndGgodW5zaWduZWQgY2hhciBjb25zdCosIHVuc2lnbmVkIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCBzdGQ6Ol9fMjo6Y29kZWN2dF9tb2RlKagIJXN0ZDo6X18yOjpudW1wdW5jdDxjaGFyPjo6fm51bXB1bmN0KCmpCCdzdGQ6Ol9fMjo6bnVtcHVuY3Q8Y2hhcj46On5udW1wdW5jdCgpLjGqCChzdGQ6Ol9fMjo6bnVtcHVuY3Q8d2NoYXJfdD46On5udW1wdW5jdCgpqwgqc3RkOjpfXzI6Om51bXB1bmN0PHdjaGFyX3Q+Ojp+bnVtcHVuY3QoKS4xrAgyc3RkOjpfXzI6Om51bXB1bmN0PGNoYXI+Ojpkb19kZWNpbWFsX3BvaW50KCkgY29uc3StCDJzdGQ6Ol9fMjo6bnVtcHVuY3Q8Y2hhcj46OmRvX3Rob3VzYW5kc19zZXAoKSBjb25zdK4ILXN0ZDo6X18yOjpudW1wdW5jdDxjaGFyPjo6ZG9fZ3JvdXBpbmcoKSBjb25zdK8IMHN0ZDo6X18yOjpudW1wdW5jdDx3Y2hhcl90Pjo6ZG9fZ3JvdXBpbmcoKSBjb25zdLAILXN0ZDo6X18yOjpudW1wdW5jdDxjaGFyPjo6ZG9fdHJ1ZW5hbWUoKSBjb25zdLEIMHN0ZDo6X18yOjpudW1wdW5jdDx3Y2hhcl90Pjo6ZG9fdHJ1ZW5hbWUoKSBjb25zdLIIfHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID46OmJhc2ljX3N0cmluZyh3Y2hhcl90IGNvbnN0KimzCC5zdGQ6Ol9fMjo6bnVtcHVuY3Q8Y2hhcj46OmRvX2ZhbHNlbmFtZSgpIGNvbnN0tAgxc3RkOjpfXzI6Om51bXB1bmN0PHdjaGFyX3Q+Ojpkb19mYWxzZW5hbWUoKSBjb25zdLUIbXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46Om9wZXJhdG9yPShjaGFyIGNvbnN0Kim2CDVzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8Y2hhcj46Ol9fd2Vla3MoKSBjb25zdLcIFnN0ZDo6X18yOjppbml0X3dlZWtzKCm4CBpfX2N4eF9nbG9iYWxfYXJyYXlfZHRvci41NLkIOHN0ZDo6X18yOjpfX3RpbWVfZ2V0X2Nfc3RvcmFnZTx3Y2hhcl90Pjo6X193ZWVrcygpIGNvbnN0uggXc3RkOjpfXzI6OmluaXRfd3dlZWtzKCm7CBpfX2N4eF9nbG9iYWxfYXJyYXlfZHRvci42ObwIeXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID46Om9wZXJhdG9yPSh3Y2hhcl90IGNvbnN0Kim9CDZzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8Y2hhcj46Ol9fbW9udGhzKCkgY29uc3S+CBdzdGQ6Ol9fMjo6aW5pdF9tb250aHMoKb8IGl9fY3h4X2dsb2JhbF9hcnJheV9kdG9yLjg0wAg5c3RkOjpfXzI6Ol9fdGltZV9nZXRfY19zdG9yYWdlPHdjaGFyX3Q+OjpfX21vbnRocygpIGNvbnN0wQgYc3RkOjpfXzI6OmluaXRfd21vbnRocygpwggbX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuMTA4wwg1c3RkOjpfXzI6Ol9fdGltZV9nZXRfY19zdG9yYWdlPGNoYXI+OjpfX2FtX3BtKCkgY29uc3TECBZzdGQ6Ol9fMjo6aW5pdF9hbV9wbSgpxQgbX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuMTMyxgg4c3RkOjpfXzI6Ol9fdGltZV9nZXRfY19zdG9yYWdlPHdjaGFyX3Q+OjpfX2FtX3BtKCkgY29uc3THCBdzdGQ6Ol9fMjo6aW5pdF93YW1fcG0oKcgIG19fY3h4X2dsb2JhbF9hcnJheV9kdG9yLjEzNckIMXN0ZDo6X18yOjpfX3RpbWVfZ2V0X2Nfc3RvcmFnZTxjaGFyPjo6X194KCkgY29uc3TKCBlfX2N4eF9nbG9iYWxfYXJyYXlfZHRvci4xywg0c3RkOjpfXzI6Ol9fdGltZV9nZXRfY19zdG9yYWdlPHdjaGFyX3Q+OjpfX3goKSBjb25zdMwIGl9fY3h4X2dsb2JhbF9hcnJheV9kdG9yLjMxzQgxc3RkOjpfXzI6Ol9fdGltZV9nZXRfY19zdG9yYWdlPGNoYXI+OjpfX1goKSBjb25zdM4IGl9fY3h4X2dsb2JhbF9hcnJheV9kdG9yLjMzzwg0c3RkOjpfXzI6Ol9fdGltZV9nZXRfY19zdG9yYWdlPHdjaGFyX3Q+OjpfX1goKSBjb25zdNAIGl9fY3h4X2dsb2JhbF9hcnJheV9kdG9yLjM10Qgxc3RkOjpfXzI6Ol9fdGltZV9nZXRfY19zdG9yYWdlPGNoYXI+OjpfX2MoKSBjb25zdNIIGl9fY3h4X2dsb2JhbF9hcnJheV9kdG9yLjM30wg0c3RkOjpfXzI6Ol9fdGltZV9nZXRfY19zdG9yYWdlPHdjaGFyX3Q+OjpfX2MoKSBjb25zdNQIGl9fY3h4X2dsb2JhbF9hcnJheV9kdG9yLjM51Qgxc3RkOjpfXzI6Ol9fdGltZV9nZXRfY19zdG9yYWdlPGNoYXI+OjpfX3IoKSBjb25zdNYIGl9fY3h4X2dsb2JhbF9hcnJheV9kdG9yLjQx1wg0c3RkOjpfXzI6Ol9fdGltZV9nZXRfY19zdG9yYWdlPHdjaGFyX3Q+OjpfX3IoKSBjb25zdNgIGl9fY3h4X2dsb2JhbF9hcnJheV9kdG9yLjQz2Qhpc3RkOjpfXzI6OnRpbWVfcHV0PGNoYXIsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46On50aW1lX3B1dCgp2ghrc3RkOjpfXzI6OnRpbWVfcHV0PGNoYXIsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46On50aW1lX3B1dCgpLjHbCHhzdGQ6Ol9fMjo6dmVjdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46Om1heF9zaXplKCkgY29uc3TcCKsBc3RkOjpfXzI6OmFsbG9jYXRvcl90cmFpdHM8c3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46OmFsbG9jYXRlKHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiYsIHVuc2lnbmVkIGxvbmcp3QiLAXN0ZDo6X18yOjp2ZWN0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4gPjo6X19hbm5vdGF0ZV9uZXcodW5zaWduZWQgbG9uZykgY29uc3TeCF9zdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD46OmFsbG9jYXRlKHVuc2lnbmVkIGxvbmcsIHZvaWQgY29uc3QqKd8IP3N0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj46OmFsbG9jYXRlKHVuc2lnbmVkIGxvbmcsIHZvaWQgY29uc3QqKeAIyAFzdGQ6Ol9fMjo6YWxsb2NhdG9yX3RyYWl0czxzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4gPjo6ZGVhbGxvY2F0ZShzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4mLCBzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCoqLCB1bnNpZ25lZCBsb25nKeEImwFzdGQ6Ol9fMjo6X192ZWN0b3JfYmFzZTxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiA+OjpfX2Rlc3RydWN0X2F0X2VuZChzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCoqKeIIInN0ZDo6X18yOjpfX3RpbWVfcHV0OjpfX3RpbWVfcHV0KCnjCIgBc3RkOjpfXzI6OnZlY3RvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiA+OjpfX3JlY29tbWVuZCh1bnNpZ25lZCBsb25nKSBjb25zdOQI2AFzdGQ6Ol9fMjo6X19zcGxpdF9idWZmZXI8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4mPjo6X19zcGxpdF9idWZmZXIodW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+JinlCJEBc3RkOjpfXzI6Ol9fc3BsaXRfYnVmZmVyPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+Jj46Ol9fY29uc3RydWN0X2F0X2VuZCh1bnNpZ25lZCBsb25nKeYI8wFzdGQ6Ol9fMjo6dmVjdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46Ol9fc3dhcF9vdXRfY2lyY3VsYXJfYnVmZmVyKHN0ZDo6X18yOjpfX3NwbGl0X2J1ZmZlcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiY+JinnCMYDc3RkOjpfXzI6OmVuYWJsZV9pZjwoKHN0ZDo6X18yOjppbnRlZ3JhbF9jb25zdGFudDxib29sLCBmYWxzZT46OnZhbHVlKSB8fCAoIShfX2hhc19jb25zdHJ1Y3Q8c3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+LCBib29sKiwgYm9vbD46OnZhbHVlKSkpICYmIChpc190cml2aWFsbHlfbW92ZV9jb25zdHJ1Y3RpYmxlPGJvb2w+Ojp2YWx1ZSksIHZvaWQ+Ojp0eXBlIHN0ZDo6X18yOjphbGxvY2F0b3JfdHJhaXRzPHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiA+OjpfX2NvbnN0cnVjdF9iYWNrd2FyZDxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCo+KHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiYsIGJvb2wqLCBib29sKiwgYm9vbComKegIfHN0ZDo6X18yOjpfX2NvbXByZXNzZWRfcGFpcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCoqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4mPjo6c2Vjb25kKCnpCMYBc3RkOjpfXzI6Ol9fc3BsaXRfYnVmZmVyPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+Jj46Ol9fZGVzdHJ1Y3RfYXRfZW5kKHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiosIHN0ZDo6X18yOjppbnRlZ3JhbF9jb25zdGFudDxib29sLCBmYWxzZT4p6ghAc3RkOjpfXzI6Oihhbm9ueW1vdXMgbmFtZXNwYWNlKTo6X19mYWtlX2JpbmQ6Om9wZXJhdG9yKCkoKSBjb25zdOsIQnN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD46OmFsbG9jYXRlKHVuc2lnbmVkIGxvbmcsIHZvaWQgY29uc3QqKewIa3N0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46Ol9fY2xlYXJfYW5kX3Nocmluaygp7Qh0c3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6X19jbGVhcl9hbmRfc2hyaW5rKCnuCENsb25nIGRvdWJsZSBzdGQ6Ol9fMjo6X19kb19zdHJ0b2Q8bG9uZyBkb3VibGU+KGNoYXIgY29uc3QqLCBjaGFyKiop7wgtc3RkOjpfXzI6Ol9fc2hhcmVkX2NvdW50Ojp+X19zaGFyZWRfY291bnQoKS4x8Agvc3RkOjpfXzI6Ol9fc2hhcmVkX3dlYWtfY291bnQ6Ol9fcmVsZWFzZV93ZWFrKCnxCElzdGQ6Ol9fMjo6X19zaGFyZWRfd2Vha19jb3VudDo6X19nZXRfZGVsZXRlcihzdGQ6OnR5cGVfaW5mbyBjb25zdCYpIGNvbnN08ghGc3RkOjpfXzI6Ol9fY2FsbF9vbmNlKHVuc2lnbmVkIGxvbmcgdm9sYXRpbGUmLCB2b2lkKiwgdm9pZCAoKikodm9pZCopKfMIG29wZXJhdG9yIG5ldyh1bnNpZ25lZCBsb25nKfQIPXN0ZDo6X18yOjpfX2xpYmNwcF9yZWZzdHJpbmc6Ol9fbGliY3BwX3JlZnN0cmluZyhjaGFyIGNvbnN0Kin1CAd3bWVtc2V09ggId21lbW1vdmX3CENzdGQ6Ol9fMjo6X19iYXNpY19zdHJpbmdfY29tbW9uPHRydWU+OjpfX3Rocm93X2xlbmd0aF9lcnJvcigpIGNvbnN0+AjBAXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OmJhc2ljX3N0cmluZyhzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0Jin5CHlzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpfX2luaXQoY2hhciBjb25zdCosIHVuc2lnbmVkIGxvbmcp+ghmc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6fmJhc2ljX3N0cmluZygp+wh5c3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6YXNzaWduKGNoYXIgY29uc3QqLCB1bnNpZ25lZCBsb25nKfwI0wFzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpfX2dyb3dfYnlfYW5kX3JlcGxhY2UodW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgY2hhciBjb25zdCop/Qhyc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6cmVzaXplKHVuc2lnbmVkIGxvbmcsIGNoYXIp/ghyc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6YXBwZW5kKHVuc2lnbmVkIGxvbmcsIGNoYXIp/wh0c3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6X19lcmFzZV90b19lbmQodW5zaWduZWQgbG9uZymACboBc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6X19ncm93X2J5KHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcpgQk/c3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+Ojphc3NpZ24oY2hhciosIHVuc2lnbmVkIGxvbmcsIGNoYXIpggl5c3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6YXBwZW5kKGNoYXIgY29uc3QqLCB1bnNpZ25lZCBsb25nKYMJZnN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OnB1c2hfYmFjayhjaGFyKYQJcnN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46Ol9faW5pdCh1bnNpZ25lZCBsb25nLCBjaGFyKYUJhQFzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+OjpfX2luaXQod2NoYXJfdCBjb25zdCosIHVuc2lnbmVkIGxvbmcphgmFAXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID46OmFzc2lnbih3Y2hhcl90IGNvbnN0KiwgdW5zaWduZWQgbG9uZymHCd8Bc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6X19ncm93X2J5X2FuZF9yZXBsYWNlKHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIHdjaGFyX3QgY29uc3QqKYgJwwFzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+OjpfX2dyb3dfYnkodW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZymJCYUBc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6YXBwZW5kKHdjaGFyX3QgY29uc3QqLCB1bnNpZ25lZCBsb25nKYoJcnN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID46OnB1c2hfYmFjayh3Y2hhcl90KYsJfnN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID46Ol9faW5pdCh1bnNpZ25lZCBsb25nLCB3Y2hhcl90KYwJQnN0ZDo6X18yOjpfX3ZlY3Rvcl9iYXNlX2NvbW1vbjx0cnVlPjo6X190aHJvd19sZW5ndGhfZXJyb3IoKSBjb25zdI0JDWFib3J0X21lc3NhZ2WOCRJfX2N4YV9wdXJlX3ZpcnR1YWyPCRxzdGQ6OmV4Y2VwdGlvbjo6d2hhdCgpIGNvbnN0kAkgc3RkOjpsb2dpY19lcnJvcjo6fmxvZ2ljX2Vycm9yKCmRCTNzdGQ6Ol9fMjo6X19saWJjcHBfcmVmc3RyaW5nOjp+X19saWJjcHBfcmVmc3RyaW5nKCmSCSJzdGQ6OmxvZ2ljX2Vycm9yOjp+bG9naWNfZXJyb3IoKS4xkwkic3RkOjpsZW5ndGhfZXJyb3I6On5sZW5ndGhfZXJyb3IoKZQJG3N0ZDo6YmFkX2Nhc3Q6OndoYXQoKSBjb25zdJUJYV9fY3h4YWJpdjE6Ol9fZnVuZGFtZW50YWxfdHlwZV9pbmZvOjpjYW5fY2F0Y2goX19jeHhhYml2MTo6X19zaGltX3R5cGVfaW5mbyBjb25zdCosIHZvaWQqJikgY29uc3SWCTxpc19lcXVhbChzdGQ6OnR5cGVfaW5mbyBjb25zdCosIHN0ZDo6dHlwZV9pbmZvIGNvbnN0KiwgYm9vbCmXCVtfX2N4eGFiaXYxOjpfX2NsYXNzX3R5cGVfaW5mbzo6Y2FuX2NhdGNoKF9fY3h4YWJpdjE6Ol9fc2hpbV90eXBlX2luZm8gY29uc3QqLCB2b2lkKiYpIGNvbnN0mAkOX19keW5hbWljX2Nhc3SZCWtfX2N4eGFiaXYxOjpfX2NsYXNzX3R5cGVfaW5mbzo6cHJvY2Vzc19mb3VuZF9iYXNlX2NsYXNzKF9fY3h4YWJpdjE6Ol9fZHluYW1pY19jYXN0X2luZm8qLCB2b2lkKiwgaW50KSBjb25zdJoJbl9fY3h4YWJpdjE6Ol9fY2xhc3NfdHlwZV9pbmZvOjpoYXNfdW5hbWJpZ3VvdXNfcHVibGljX2Jhc2UoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQqLCBpbnQpIGNvbnN0mwlxX19jeHhhYml2MTo6X19zaV9jbGFzc190eXBlX2luZm86Omhhc191bmFtYmlndW91c19wdWJsaWNfYmFzZShfX2N4eGFiaXYxOjpfX2R5bmFtaWNfY2FzdF9pbmZvKiwgdm9pZCosIGludCkgY29uc3ScCXNfX2N4eGFiaXYxOjpfX2Jhc2VfY2xhc3NfdHlwZV9pbmZvOjpoYXNfdW5hbWJpZ3VvdXNfcHVibGljX2Jhc2UoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQqLCBpbnQpIGNvbnN0nQlyX19jeHhhYml2MTo6X192bWlfY2xhc3NfdHlwZV9pbmZvOjpoYXNfdW5hbWJpZ3VvdXNfcHVibGljX2Jhc2UoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQqLCBpbnQpIGNvbnN0nglbX19jeHhhYml2MTo6X19wYmFzZV90eXBlX2luZm86OmNhbl9jYXRjaChfX2N4eGFiaXYxOjpfX3NoaW1fdHlwZV9pbmZvIGNvbnN0Kiwgdm9pZComKSBjb25zdJ8JXV9fY3h4YWJpdjE6Ol9fcG9pbnRlcl90eXBlX2luZm86OmNhbl9jYXRjaChfX2N4eGFiaXYxOjpfX3NoaW1fdHlwZV9pbmZvIGNvbnN0Kiwgdm9pZComKSBjb25zdKAJXF9fY3h4YWJpdjE6Ol9fcG9pbnRlcl90eXBlX2luZm86OmNhbl9jYXRjaF9uZXN0ZWQoX19jeHhhYml2MTo6X19zaGltX3R5cGVfaW5mbyBjb25zdCopIGNvbnN0oQlmX19jeHhhYml2MTo6X19wb2ludGVyX3RvX21lbWJlcl90eXBlX2luZm86OmNhbl9jYXRjaF9uZXN0ZWQoX19jeHhhYml2MTo6X19zaGltX3R5cGVfaW5mbyBjb25zdCopIGNvbnN0ogmDAV9fY3h4YWJpdjE6Ol9fY2xhc3NfdHlwZV9pbmZvOjpwcm9jZXNzX3N0YXRpY190eXBlX2Fib3ZlX2RzdChfX2N4eGFiaXYxOjpfX2R5bmFtaWNfY2FzdF9pbmZvKiwgdm9pZCBjb25zdCosIHZvaWQgY29uc3QqLCBpbnQpIGNvbnN0owlzX19jeHhhYml2MTo6X192bWlfY2xhc3NfdHlwZV9pbmZvOjpzZWFyY2hfYmVsb3dfZHN0KF9fY3h4YWJpdjE6Ol9fZHluYW1pY19jYXN0X2luZm8qLCB2b2lkIGNvbnN0KiwgaW50LCBib29sKSBjb25zdKQJgQFfX2N4eGFiaXYxOjpfX2Jhc2VfY2xhc3NfdHlwZV9pbmZvOjpzZWFyY2hfYWJvdmVfZHN0KF9fY3h4YWJpdjE6Ol9fZHluYW1pY19jYXN0X2luZm8qLCB2b2lkIGNvbnN0Kiwgdm9pZCBjb25zdCosIGludCwgYm9vbCkgY29uc3SlCXRfX2N4eGFiaXYxOjpfX2Jhc2VfY2xhc3NfdHlwZV9pbmZvOjpzZWFyY2hfYmVsb3dfZHN0KF9fY3h4YWJpdjE6Ol9fZHluYW1pY19jYXN0X2luZm8qLCB2b2lkIGNvbnN0KiwgaW50LCBib29sKSBjb25zdKYJcl9fY3h4YWJpdjE6Ol9fc2lfY2xhc3NfdHlwZV9pbmZvOjpzZWFyY2hfYmVsb3dfZHN0KF9fY3h4YWJpdjE6Ol9fZHluYW1pY19jYXN0X2luZm8qLCB2b2lkIGNvbnN0KiwgaW50LCBib29sKSBjb25zdKcJb19fY3h4YWJpdjE6Ol9fY2xhc3NfdHlwZV9pbmZvOjpzZWFyY2hfYmVsb3dfZHN0KF9fY3h4YWJpdjE6Ol9fZHluYW1pY19jYXN0X2luZm8qLCB2b2lkIGNvbnN0KiwgaW50LCBib29sKSBjb25zdKgJgAFfX2N4eGFiaXYxOjpfX3ZtaV9jbGFzc190eXBlX2luZm86OnNlYXJjaF9hYm92ZV9kc3QoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQgY29uc3QqLCB2b2lkIGNvbnN0KiwgaW50LCBib29sKSBjb25zdKkJf19fY3h4YWJpdjE6Ol9fc2lfY2xhc3NfdHlwZV9pbmZvOjpzZWFyY2hfYWJvdmVfZHN0KF9fY3h4YWJpdjE6Ol9fZHluYW1pY19jYXN0X2luZm8qLCB2b2lkIGNvbnN0Kiwgdm9pZCBjb25zdCosIGludCwgYm9vbCkgY29uc3SqCXxfX2N4eGFiaXYxOjpfX2NsYXNzX3R5cGVfaW5mbzo6c2VhcmNoX2Fib3ZlX2RzdChfX2N4eGFiaXYxOjpfX2R5bmFtaWNfY2FzdF9pbmZvKiwgdm9pZCBjb25zdCosIHZvaWQgY29uc3QqLCBpbnQsIGJvb2wpIGNvbnN0qwkIX19zdHJkdXCsCQ1fX2dldFR5cGVOYW1lrQkqX19lbWJpbmRfcmVnaXN0ZXJfbmF0aXZlX2FuZF9idWlsdGluX3R5cGVzrgk/dm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX2ludGVnZXI8Y2hhcj4oY2hhciBjb25zdCoprwlGdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX2ludGVnZXI8c2lnbmVkIGNoYXI+KGNoYXIgY29uc3QqKbAJSHZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9pbnRlZ2VyPHVuc2lnbmVkIGNoYXI+KGNoYXIgY29uc3QqKbEJQHZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9pbnRlZ2VyPHNob3J0PihjaGFyIGNvbnN0KimyCUl2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfaW50ZWdlcjx1bnNpZ25lZCBzaG9ydD4oY2hhciBjb25zdCopswk+dm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX2ludGVnZXI8aW50PihjaGFyIGNvbnN0Kim0CUd2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfaW50ZWdlcjx1bnNpZ25lZCBpbnQ+KGNoYXIgY29uc3QqKbUJP3ZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9pbnRlZ2VyPGxvbmc+KGNoYXIgY29uc3QqKbYJSHZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9pbnRlZ2VyPHVuc2lnbmVkIGxvbmc+KGNoYXIgY29uc3QqKbcJPnZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9mbG9hdDxmbG9hdD4oY2hhciBjb25zdCopuAk/dm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX2Zsb2F0PGRvdWJsZT4oY2hhciBjb25zdCopuQlDdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX21lbW9yeV92aWV3PGNoYXI+KGNoYXIgY29uc3QqKboJSnZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9tZW1vcnlfdmlldzxzaWduZWQgY2hhcj4oY2hhciBjb25zdCopuwlMdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX21lbW9yeV92aWV3PHVuc2lnbmVkIGNoYXI+KGNoYXIgY29uc3QqKbwJRHZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9tZW1vcnlfdmlldzxzaG9ydD4oY2hhciBjb25zdCopvQlNdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX21lbW9yeV92aWV3PHVuc2lnbmVkIHNob3J0PihjaGFyIGNvbnN0Kim+CUJ2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfbWVtb3J5X3ZpZXc8aW50PihjaGFyIGNvbnN0Kim/CUt2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfbWVtb3J5X3ZpZXc8dW5zaWduZWQgaW50PihjaGFyIGNvbnN0KinACUN2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfbWVtb3J5X3ZpZXc8bG9uZz4oY2hhciBjb25zdCopwQlMdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX21lbW9yeV92aWV3PHVuc2lnbmVkIGxvbmc+KGNoYXIgY29uc3QqKcIJRHZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9tZW1vcnlfdmlldzxmbG9hdD4oY2hhciBjb25zdCopwwlFdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX21lbW9yeV92aWV3PGRvdWJsZT4oY2hhciBjb25zdCopxAluRW1zY3JpcHRlbkJpbmRpbmdJbml0aWFsaXplcl9uYXRpdmVfYW5kX2J1aWx0aW5fdHlwZXM6OkVtc2NyaXB0ZW5CaW5kaW5nSW5pdGlhbGl6ZXJfbmF0aXZlX2FuZF9idWlsdGluX3R5cGVzKCnFCQhkbG1hbGxvY8YJBmRsZnJlZccJCWRscmVhbGxvY8gJEXRyeV9yZWFsbG9jX2NodW5ryQkNZGlzcG9zZV9jaHVua8oJBHNicmvLCQRmbW9kzAkFZm1vZGzNCQVsb2cxMM4JBmxvZzEwZs8JBnNjYWxibtAJDV9fZnBjbGFzc2lmeWzRCQZtZW1jcHnSCQZtZW1zZXTTCQdtZW1tb3Zl1AkIc2V0VGhyZXfVCQlzdGFja1NhdmXWCQpzdGFja0FsbG9j1wkMc3RhY2tSZXN0b3Jl2AkQX19ncm93V2FzbU1lbW9yedkJC2R5bkNhbGxfdmlp2gkNZHluQ2FsbF92aWlpadsJC2R5bkNhbGxfZGlk3AkMZHluQ2FsbF9kaWlk3QkNZHluQ2FsbF9kaWRkZN4JDmR5bkNhbGxfZGlpZGRk3wkMZHluQ2FsbF9kaWRk4AkNZHluQ2FsbF9kaWlkZOEJC2R5bkNhbGxfZGlp4gkLZHluQ2FsbF92aWTjCQxkeW5DYWxsX3ZpaWTkCQxkeW5DYWxsX2RpaWnlCQ1keW5DYWxsX2RpaWlp5gkNZHluQ2FsbF92aWlpZOcJDWR5bkNhbGxfZGlkaWToCQ5keW5DYWxsX2RpaWRpZOkJDmR5bkNhbGxfZGlkaWRp6gkPZHluQ2FsbF9kaWlkaWRp6wkNZHluQ2FsbF92aWRpZOwJDmR5bkNhbGxfdmlpZGlk7QkOZHluQ2FsbF92aWRpZGTuCQ9keW5DYWxsX3ZpaWRpZGTvCQ9keW5DYWxsX3ZpZGlkZGTwCRBkeW5DYWxsX3ZpaWRpZGRk8QkNZHluQ2FsbF92aWRkZPIJDmR5bkNhbGxfdmlpZGRk8wkNZHluQ2FsbF9paWlpZPQJDGR5bkNhbGxfdmlkZPUJDWR5bkNhbGxfdmlpZGT2CQ1keW5DYWxsX2lpaWlp9wkOZHluQ2FsbF92aWZmaWn4CQ9keW5DYWxsX3ZpaWZmaWn5CQ9keW5DYWxsX2RpZGRkZGT6CQ9keW5DYWxsX2RpZGRpZGT7CRBkeW5DYWxsX2RpaWRkaWRk/AkQZHluQ2FsbF9kaWlkZGRkZP0JD2R5bkNhbGxfZGlkZGRpaf4JEGR5bkNhbGxfZGlpZGRkaWn/CRFkeW5DYWxsX2RpZGRkZGRpaYAKEmR5bkNhbGxfZGlpZGRkZGRpaYEKDGR5bkNhbGxfZGlkaYIKDWR5bkNhbGxfZGlpZGmDCg9keW5DYWxsX2RpZGlkZGSEChBkeW5DYWxsX2RpaWRpZGRkhQoNZHluQ2FsbF9kaWRkaYYKDmR5bkNhbGxfZGlpZGRphwoMZHluQ2FsbF92aWRpiAoNZHluQ2FsbF92aWlkaYkKDmR5bkNhbGxfdmlpaWlpigoMZHluQ2FsbF9paWZpiwoNZHluQ2FsbF9paWlmaYwKCmR5bkNhbGxfZmmNCgtkeW5DYWxsX2ZpaY4KDWR5bkNhbGxfZmlpaWmPCg5keW5DYWxsX2ZpaWlpaZAKD2R5bkNhbGxfdmlpaWlkZJEKEGR5bkNhbGxfdmlpaWlpZGSSCgxkeW5DYWxsX3ZpaWaTCg1keW5DYWxsX3ZpaWlmlAoNZHluQ2FsbF9paWlpZpUKDmR5bkNhbGxfZGlkZGlklgoPZHluQ2FsbF9kaWlkZGlklwoPZHluQ2FsbF9kaWRkZGlkmAoQZHluQ2FsbF9kaWlkZGRpZJkKDmR5bkNhbGxfZGlkZGRpmgoPZHluQ2FsbF9kaWlkZGRpmwoLZHluQ2FsbF9paWScCg1keW5DYWxsX2RpZGlpnQoOZHluQ2FsbF9kaWlkaWmeCg9keW5DYWxsX2lpZGlpaWmfCg5keW5DYWxsX2lpaWlpaaAKEWR5bkNhbGxfaWlpaWlpaWlpoQoPZHluQ2FsbF9paWlpaWlpogoOZHluQ2FsbF9paWlpaWSjChBkeW5DYWxsX2lpaWlpaWlppAoPZHluQ2FsbF92aWlpaWlppQoJZHluQ2FsbF92pgoYbGVnYWxzdHViJGR5bkNhbGxfdmlpamlppwoWbGVnYWxzdHViJGR5bkNhbGxfamlqaagKGGxlZ2Fsc3R1YiRkeW5DYWxsX2lpaWlpaqkKGWxlZ2Fsc3R1YiRkeW5DYWxsX2lpaWlpamqqChpsZWdhbHN0dWIkZHluQ2FsbF9paWlpaWlqagB1EHNvdXJjZU1hcHBpbmdVUkxjaHR0cDovL2xvY2FsaG9zdDo5MDAwL2F1ZGlvLXdvcmtsZXQvYnVpbGQve3t7IEZJTEVOQU1FX1JFUExBQ0VNRU5UX1NUUklOR1NfV0FTTV9CSU5BUllfRklMRSB9fX0ubWFw';
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


