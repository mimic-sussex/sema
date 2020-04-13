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
  'initial': 969,
  'maximum': 969 + 0,
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




var wasmBinaryFile = 'data:application/octet-stream;base64,AGFzbQEAAAAB/AqkAWABfwF/YAF/AGACf38AYAJ/fwF/YAN/f38Bf2ADf39/AGAFf39/f38Bf2AAAGAEf39/fwF/YAZ/f39/f38Bf2AFf39/f38AYAR/f39/AGAAAX9gBn9/f39/fwBgCH9/f39/f39/AX9gAn98AGABfwF8YAJ/fAF8YAN/fHwBfGACfHwBfGAHf39/f39/fwF/YAR/fHx8AXxgAXwBfGAHf39/f39/fwBgAn9/AXxgBH9/f3wAYAN/f3wAYAV/fn5+fgBgA39+fwF+YAF9AX1gA39/fwF8YAR/fHx/AXxgBn98fHx8fAF8YAp/f39/f39/f39/AGADf3x/AGAFf39/f34Bf2ADf3x/AXxgBXx8fHx8AXxgBX9/fn9/AGAFf39/f3wBf2AEf39/fwF+YAF/AX1gAn9/AX1gBH9/fH8BfGAFf398fH8BfGAGf3x/fHx8AXxgBX98fH98AXxgBX98fHx/AXxgA3x8fAF8YAh/f39/f39/fwBgB39/f39/fHwAYAZ/f39/fHwAYAR/f399AGAGf399fX9/AGAEf398fwBgBX9/fH98AGAGf398f3x8AGAHf398f3x8fABgBH9/fHwAYAV/f3x8fABgBH9+fn8AYAV/fX1/fwBgBH98f3wAYAV/fH98fABgBn98f3x8fABgA398fABgBH98fHwAYAp/f39/f39/f39/AX9gB39/f39/fn4Bf2AGf39/f35+AX9gBH9/f3wBf2AEf399fwF/YAN/fX8Bf2AGf3x/f39/AX9gBH9/f38BfWAFf39/f38BfWAEf39/fwF8YAN/f3wBfGAFf398f38BfGAFf398f3wBfGAGf398f3x/AXxgB39/fH98fHwBfGAEf398fAF8YAZ/f3x8f3wBfGAHf398fH98fAF8YAV/f3x8fAF8YAZ/f3x8fH8BfGAHf398fHx/fwF8YAd/f3x8fH98AXxgB39/fHx8fHwBfGAJf398fHx8fH9/AXxgBH98f38BfGAEf3x/fAF8YAV/fH98fwF8YAZ/fHx/fHwBfGAGf3x8fH9/AXxgBn98fHx/fAF8YAh/fHx8fHx/fwF8YA9/f39/f39/f39/f39/f38AYAN/f30AYAJ/fgBgCX9/f39/f39/fwF/YAt/f39/f39/f39/fwF/YAx/f39/f39/f39/f38Bf2AEf39/fQF/YAN/fn8Bf2ACf3wBf2ACfn8Bf2ACfn4Bf2ABfAF/YAF/AX5gBH9/f34BfmADf39/AX1gAn1/AX1gAXwBfWACfH8BfGADfHx/AXxgDH9/f39/f39/f39/fwBgDX9/f39/f39/f39/f38AYAh/f39/f398fABgBX9/f399AGAFf39/f3wAYAd/f399fX9/AGAFf39/fH8AYAZ/f398f3wAYAd/f398f3x8AGAIf39/fH98fHwAYAV/f398fABgBn9/f3x8fABgA39/fgBgBn9/fHx8fwBgA39+fgBgAn99AGAGf39/f398AX9gBX9/f399AX9gBX9/f31/AX9gA39/fAF/YAd/f3x/f39/AX9gA35/fwF/YAR+fn5+AX9gAn1/AX9gAnx/AX9gAn9/AX5gBn9/f39/fwF9YAJ+fgF9YAJ9fQF9YAV/f39/fwF8YAR/f398AXxgBX9/f3x/AXxgBn9/f3x/fwF8YAZ/f398f3wBfGAHf39/fH98fwF8YAh/f398f3x8fAF8YAV/f398fAF8YAZ/f398fH8BfGAHf39/fHx/fAF8YAh/f398fH98fAF8YAZ/f398fHwBfGAHf39/fHx8fwF8YAh/f398fHx/fwF8YAh/f398fHx/fAF8YAh/f398fHx8fAF8YAp/f398fHx8fH9/AXxgAn5+AXwClgktA2VudhZfZW1iaW5kX3JlZ2lzdGVyX2NsYXNzAHYDZW52Il9lbWJpbmRfcmVnaXN0ZXJfY2xhc3NfY29uc3RydWN0b3IADQNlbnYlX2VtYmluZF9yZWdpc3Rlcl9jbGFzc19jbGFzc19mdW5jdGlvbgAXA2Vudh9fZW1iaW5kX3JlZ2lzdGVyX2NsYXNzX3Byb3BlcnR5ACEDZW52H19lbWJpbmRfcmVnaXN0ZXJfY2xhc3NfZnVuY3Rpb24AMQNlbnYVX2VtYmluZF9yZWdpc3Rlcl9lbnVtAAsDZW52G19lbWJpbmRfcmVnaXN0ZXJfZW51bV92YWx1ZQAFA2VudhpfZW1iaW5kX3JlZ2lzdGVyX3NtYXJ0X3B0cgB1A2VudhhfX2N4YV9hbGxvY2F0ZV9leGNlcHRpb24AAANlbnYLX19jeGFfdGhyb3cABQNlbnYRX2VtdmFsX3Rha2VfdmFsdWUAAwNlbnYNX2VtdmFsX2luY3JlZgABA2Vudg1fZW12YWxfZGVjcmVmAAEDZW52C19lbXZhbF9jYWxsAAgDZW52BXJvdW5kABYDZW52BGV4aXQAAQNlbnYNX19hc3NlcnRfZmFpbAALA2VudgZfX2xvY2sAAQNlbnYIX191bmxvY2sAARZ3YXNpX3NuYXBzaG90X3ByZXZpZXcxCGZkX2Nsb3NlAAADZW52Cl9fc3lzY2FsbDUAAwNlbnYMX19zeXNjYWxsMjIxAAMDZW52C19fc3lzY2FsbDU0AAMWd2FzaV9zbmFwc2hvdF9wcmV2aWV3MQdmZF9yZWFkAAgWd2FzaV9zbmFwc2hvdF9wcmV2aWV3MQhmZF93cml0ZQAIFndhc2lfc25hcHNob3RfcHJldmlldzERZW52aXJvbl9zaXplc19nZXQAAxZ3YXNpX3NuYXBzaG90X3ByZXZpZXcxC2Vudmlyb25fZ2V0AAMDZW52Cl9fbWFwX2ZpbGUAAwNlbnYLX19zeXNjYWxsOTEAAwNlbnYKc3RyZnRpbWVfbAAGA2VudgVhYm9ydAAHA2VudhVfZW1iaW5kX3JlZ2lzdGVyX3ZvaWQAAgNlbnYVX2VtYmluZF9yZWdpc3Rlcl9ib29sAAoDZW52G19lbWJpbmRfcmVnaXN0ZXJfc3RkX3N0cmluZwACA2VudhxfZW1iaW5kX3JlZ2lzdGVyX3N0ZF93c3RyaW5nAAUDZW52Fl9lbWJpbmRfcmVnaXN0ZXJfZW12YWwAAgNlbnYYX2VtYmluZF9yZWdpc3Rlcl9pbnRlZ2VyAAoDZW52Fl9lbWJpbmRfcmVnaXN0ZXJfZmxvYXQABQNlbnYcX2VtYmluZF9yZWdpc3Rlcl9tZW1vcnlfdmlldwAFA2VudhZlbXNjcmlwdGVuX3Jlc2l6ZV9oZWFwAAADZW52FWVtc2NyaXB0ZW5fbWVtY3B5X2JpZwAEA2VudgtzZXRUZW1wUmV0MAABFndhc2lfc25hcHNob3RfcHJldmlldzEHZmRfc2VlawAGA2VudgZtZW1vcnkCAIAQA2VudgV0YWJsZQFwAMkHA6gKggoHBwcHBwcHAAEADAIBAAsFAAIDBQACAAIADE1VUhgaAAxMGRAPAAIADE9QAAwQDxAPAAw3ODkADBFCOw8AAEYZFTAADEE6DxAQDxAPDwABDAALCAIBNQgAJSAlJTAVIAAMVFkADFda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6QkOZHluQ2FsbF9kaWlkaWQA6gkOZHluQ2FsbF9kaWRpZGkA6wkPZHluQ2FsbF9kaWlkaWRpAOwJDWR5bkNhbGxfdmlkaWQA7QkOZHluQ2FsbF92aWlkaWQA7gkOZHluQ2FsbF92aWRpZGQA7wkPZHluQ2FsbF92aWlkaWRkAPAJD2R5bkNhbGxfdmlkaWRkZADxCRBkeW5DYWxsX3ZpaWRpZGRkAPIJDWR5bkNhbGxfdmlkZGQA8wkOZHluQ2FsbF92aWlkZGQA9AkNZHluQ2FsbF9paWlpZAD1CQxkeW5DYWxsX2RkZGQAawxkeW5DYWxsX3ZpZGQA9gkNZHluQ2FsbF92aWlkZAD3CQxkeW5DYWxsX2lpaWkAyAINZHluQ2FsbF9paWlpaQD4CQ5keW5DYWxsX3ZpZmZpaQD5CQ9keW5DYWxsX3ZpaWZmaWkA+gkOZHluQ2FsbF9kZGRkZGQAiQEPZHluQ2FsbF9kaWRkZGRkAPsJD2R5bkNhbGxfZGlkZGlkZAD8CRBkeW5DYWxsX2RpaWRkaWRkAP0JEGR5bkNhbGxfZGlpZGRkZGQA/gkPZHluQ2FsbF9kaWRkZGlpAP8JEGR5bkNhbGxfZGlpZGRkaWkAgAoRZHluQ2FsbF9kaWRkZGRkaWkAgQoSZHluQ2FsbF9kaWlkZGRkZGlpAIIKDGR5bkNhbGxfZGlkaQCDCg1keW5DYWxsX2RpaWRpAIQKCmR5bkNhbGxfZGQAmgEPZHluQ2FsbF9kaWRpZGRkAIUKEGR5bkNhbGxfZGlpZGlkZGQAhgoLZHluQ2FsbF9kZGQAsgENZHluQ2FsbF9kaWRkaQCHCg5keW5DYWxsX2RpaWRkaQCICgxkeW5DYWxsX3ZpZGkAiQoNZHluQ2FsbF92aWlkaQCKCg5keW5DYWxsX3ZpaWlpaQCLCgxkeW5DYWxsX2lpZmkAjAoNZHluQ2FsbF9paWlmaQCNCgpkeW5DYWxsX2ZpAI4KC2R5bkNhbGxfZmlpAI8KDWR5bkNhbGxfZmlpaWkAkAoOZHluQ2FsbF9maWlpaWkAkQoPZHluQ2FsbF92aWlpaWRkAJIKEGR5bkNhbGxfdmlpaWlpZGQAkwoMZHluQ2FsbF92aWlmAJQKDWR5bkNhbGxfdmlpaWYAlQoNZHluQ2FsbF9paWlpZgCWCg5keW5DYWxsX2Rp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AyAAQQAQBEEEEPUIIgBByQM2AgBByCNBwhdBBEGgJUGwJUHKAyAAQQAQBAsFAEHEJQsMACAABEAgABDICQsLBwAgABEMAAsHAEEBEPUICwkAIAEgABEBAAsMACAAIAAoAgA2AgQLBQBBtCYLDQAgASACIAMgABEFAAsdAEGIhAIgATYCAEGEhAIgADYCAEGMhAIgAjYCAAsJAEGEhAIoAgALCwBBhIQCIAE2AgALNQEBfyABIAAoAgQiAkEBdWohASAAKAIAIQAgASACQQFxBH8gASgCACAAaigCAAUgAAsRAAALNwEBfyABIAAoAgQiA0EBdWohASAAKAIAIQAgASACIANBAXEEfyABKAIAIABqKAIABSAACxECAAsJAEGIhAIoAgALCwBBiIQCIAE2AgALCQBBjIQCKAIACwsAQYyEAiABNgIACwUAQawnCxIBAX9BMBD1CCIAQgA3AwggAAs3AQF/IAEgACgCBCIDQQF1aiEBIAAoAgAhACABIAIgA0EBcQR/IAEoAgAgAGooAgAFIAALEREACzsBAX8gASAAKAIEIgVBAXVqIQEgACgCACEAIAEgAiADIAQgBUEBcQR/IAEoAgAgAGooAgAFIAALERUACzkBAX8gASAAKAIEIgRBAXVqIQEgACgCACEAIAEgAiADIARBAXEEfyABKAIAIABqKAIABSAACxESAAs1AQF/IAEgACgCBCICQQF1aiEBIAAoAgAhACABIAJBAXEEfyABKAIAIABqKAIABSAACxEQAAs3AQF/IAEgACgCBCIDQQF1aiEBIAAoAgAhACABIAIgA0EBcQR/IAEoAgAgAGooAgAFIAALEQ8ACwUAQfAoCzwBAX9BOBD1CCIAQgA3AwAgAEIANwMwIABCADcDKCAAQgA3AyAgAEIANwMYIABCADcDECAAQgA3AwggAAs5AQF/IAEgACgCBCIEQQF1aiEBIAAoAgAhACABIAIgAyAEQQFxBH8gASgCACAAaigCAAUgAAsRHgALOQEBfyABIAAoAgQiBEEBdWohASAAKAIAIQAgASACIAMgBEEBcQR/IAEoAgAgAGooAgAFIAALERoACwcAIAArAzALCQAgACABOQMwCwcAIAAoAiwLCQAgACABNgIsCwUAQYAqCwwAQeiIKxD1CBCZAws7AQF/IAEgACgCBCIFQQF1aiEBIAAoAgAh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AgAQyAkLIAAQyAkLC4kBAQJ/QYgBEPUIIgBCADcCACAAQgA3AyggAEEBOwFgIABCADcDWCAAQoCAgICAgIDwPzcDUCAAQoCAgICAgIDwPzcDSCAAQQA2AgggAEIANwMwQYSEAigCACEBIABBADYCdCAAQQE6AIABIABCgICAgICAgPg/NwN4IABCADcCbCAAIAE2AmQgAAsQACAAKAJwIAAoAmxrQQN1CzkBAX8gASAAKAIEIgRBAXVqIQEgACgCACEAIAEgAiADIARBAXEEfyABKAIAIABqKAIABSAACxEFAAs5AQF/IAEgACgCBCIEQQF1aiEBIAAoAgAhACABIAIgAyAEQQFxBH8gASgCACAAaigCAAUgAAsRBAALNQEBfyABIAAoAgQiAkEBdWohASAAKAIAIQAgASACQQFxBH8gASgCACAAaigCAAUgAAsRAQALDAAgACAAKAJsNgJwCz0BAX8gASAAKAIEIgZBAXVqIQEgACgCACEAIAEgAiADIAQgBSAGQQFxBH8gASgCACAAaigCAAUgAAsRPQAL5QEBBH8jAEEQayIEJAAgASAAKAIEIgZBAXVqIQcgACgCACEFIAZBAXEEQCAHKAIAIAVqKAIAIQULIAIoAgAhACAEQQA2AgggBEIANwMAIABBcEkEQAJAAkAgAEELTwRAIABBEGpBcHEiBhD1CCEBIAQgBkGAgICAeHI2AgggBCABNgIAIAQgADYCBAwBCyAEIAA6AAsgBCEBIABFDQELIAEgAkEEaiAAENMJGgsgACABakEAOgAAIAcgBCADIAURBAAhACAELAALQX9MBEAgBCgCABDICQsgBEEQaiQAIAAPCxD5CAALBQBBtDQLKAAgASACIAAgAiAAYxsiACAAIAFjGyABoSACIAGhoyAEIAOhoiADoAsUACABIAIgAyAEIAUgACgCABElAAsqACAEIAOjIAEgAiAAIAIgAGMbIgAgACABYxsgAaEgAiABoaMQ5AQgA6ILLgAgASACIAAgAiAAYxsiACAAIAFjGyABoxDiBCACIAGjEOIEoyAEIAOhoiADoAseAAJAIAAgAmQNACAAIgIgAWNBAXMNACABIQILIAILEAAgASACIAMgACgCABEwAAsRACABIAIgAyAEIAUgABElAAsFAEGsNQsQAEHYABD1CEEAQdgAENQJCz8BAX8gASAA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ACAHQRBqJAAgDSADIABrQQN1uKMLGQAgACgCACACQQR0aiABOQMAIABBAToAGAtOAQN/IAEoAgAiAiABKAIEIgNHBEAgACgCACEEQQAhAQNAIAQgAUEEdGogAikDADcDACABQQFqIQEgAkEIaiICIANHDQALCyAAQQE6ABgLBgBB/MUACw8AIAAEQCAAEPQCEMgJCwtuAQF/QZQBEPUIIgBCADcCUCAAQgA3AgAgAEIANwJ4IABCADcCcCAAQgA3AmggAEIANwJgIABCADcCWCAAQgA3AgggAEIANwIQIABCADcCGCAAQgA3AiAgAEIANwIoIABCADcCMCAAQQA2AjggAAs7AQF/IAEgACgCBCIFQQF1aiEBIAAoAgAhACABIAIgAyAEIAVBAXEEfyABKAIAIABqKAIABSAACxELAAs5AQF/IAEgACgCBCIEQQF1aiEBIAAoAgAhACABIAIgAyAEQQFxBH8gASgCACAAaigCAAUgAAsRSAALNQEBfyABIAAoAgQiAkEBdWohASAAKAIAIQAgASACQQFxBH8gASgCACAAaigCAAUgAAsRKQALvAEBAn8gASAAKAIEIgJBAXVqIQEgACgCACEAIAEgAkEBcQR/IAEoAgAgAGooAgAFIAALEQAAIQFBDBD1CCIAQQA2AgggAEIANwIAAkACQCABKAIEIAEoAgBrIgJFDQAgAkECdSIDQYCAgIAETw0BIAAgAhD1CCICNgIAIAAgAjYCBCAAIAIgA0ECdGo2AgggASgCBCABKAIAIgNrIgFBAUgNACAAIAIgAyABENMJIAFqNgIECyAADwsQjgkACwcAIAAQ4AMLBwAgAEEMagsIACAAKAKMAQsHACAAKAJECwgAIAAoAogBCwgAIAAoAoQBCwYAQbzHAAtYAQF/IAAEQCAAQTxqEOkDIAAoAhgiAQRAIAAgATYCHCABEMgJCyAAKAIMIgEEQCAAIAE2AhAgARDICQsgACgCACIBBEAgACABNgIEIAEQyAkLIAAQyAkLC1kBAX9B9AAQ9QgiAEIANwJEIABCADcCACAAQgA3AmwgAEIANwJkIABCADcCXCAAQgA3AlQgAEIANwJMIABCADcCCCAAQgA3AhAgAEIANwIYIABBADYCICAACzsBAX8gASAAKAIEIgVBAXVqIQEgACgCACEAIAEgAiADIAQgBUEBcQR/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ASAAKAIIIgJJBEAgACABIAJrrEEBIAAoAigRHAAaCyAAQQA2AhwgAEIANwMQIABCADcCBEEAC0EBAn8jAEEQayIBJABBfyECAkAgABC1BA0AIAAgAUEPakEBIAAoAiARBABBAUcNACABLQAPIQILIAFBEGokACACCzEBAn8gABCuBCIBKAIANgI4IAEoAgAiAgRAIAIgADYCNAsgASAANgIAQZT5AhASIAALUAEBfgJAIANBwABxBEAgAiADQUBqrYghAUIAIQIMAQsgA0UNACACQcAAIANrrYYgASADrSIEiIQhASACIASIIQILIAAgATcDACAAIAI3AwgLUAEBfgJAIANBwABxBEAgASADQUBqrYYhAkIAIQEMAQsgA0UNACACIAOtIgSGIAFBwAAgA2utiIQhAiABIASGIQELIAAgATcDACAAIAI3AwgL2QMCAn8CfiMAQSBrIgIkAAJAIAFC////////////AIMiBUKAgICAgIDA/0N8IAVCgICAgICAwIC8f3xUBEAgAUIEhiAAQjyIhCEEIABC//////////8PgyIAQoGAgICAgICACFoEQCAEQoGAgICAgICAwAB8IQQMAgsgBEKAgICAgICAgEB9IQQgAEKAgICAgICAgAiFQgBSDQEgBEIBgyAEfCEEDAELIABQIAVCgICAgICAwP//AFQgBUKAgICAgIDA//8AURtFBEAgAUIEhiAAQjyIhEL/////////A4NCgICAgICAgPz/AIQhBAwBC0KAgICAgICA+P8AIQQgBUL///////+//8MAVg0AQgAhBCAFQjCIpyIDQZH3AEkNACACIAAgAUL///////8/g0KAgICAgIDAAIQiBEGB+AAgA2sQzgQgAkEQaiAAIAQgA0H/iH9qEM8EIAIpAwhCBIYgAikDACIAQjyIhCEEIAIpAxAgAikDGIRCAFKtIABC//////////8Pg4QiAEKBgICAgICAgAhaBEAgBEIBfCEEDAELIABCgICAgICAgIAIhUIAUg0AIARCAYMgBHwhBAsgAkEgaiQAIAQgAUKAgICAgICAgIB/g4S/C5IBAQN8RAAAAAAAAPA/IAAgAKIiAkQAAAAAAADgP6IiA6EiBEQAAAAAAADwPyAEoSADoSACIAIgAiACRJAVyxmgAfo+okR3UcEWbMFWv6CiRExVVVVVVaU/oKIg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/////wCDIgJCgICAgICAwP//AFQgAkKAgICAgIDA//8AURtFBEAgBEKAgICAgIAghCEKIAMhAQwCCyABIAxCgICAgICAwP//AIWEUARAIAIgA4RQBEBCgICAgICA4P//ACEKQgAhAQwDCyAKQoCAgICAgMD//wCEIQpCACEBDAILIAMgAkKAgICAgIDA//8AhYRQBEAgASAMhCECQgAhASACUARAQoCAgICAgOD//wAhCgwDCyAKQoCAgICAgMD//wCEIQoMAgsgASAMhFAEQEIAIQEMAgsgAiADhFAEQEIAIQEMAgsgDEL///////8/WARAIAVB0ABqIAEgCyABIAsgC1AiBht5IAZBBnStfKciBkFxahDPBCAFKQNYIgtCIIYgBSkDUCIBQiCIhCENIAtCIIghEkEQIAZrIQYLIAYgAkL///////8/Vg0AGiAFQUBrIAMgDiADIA4gDlAiCBt5IAhBBnStfKciCEFxahDPBCAFKQNIIgJCD4YgBSkDQCIDQjGIhCEQIAJCL4YgA0IRiIQhDyACQhGIIREgBiAIa0EQagshBiAPQv////8PgyICIAFC/////w+DIgF+Ig8gA0IPhkKAgP7/D4MiAyANQv////8PgyIMfnwiBEIghiIOIAEgA358Ig0gDlStIAIgDH4iFSADIAtC/////w+DIgt+fCITIBBC/////w+DIg4gAX58IhAgBCAPVK1CIIYgBEIgiIR8IhQgAiALfiIWIAMgEkKAgASEIg9+fCIDIAwgDn58IhIgASARQv////8Hg0KAgICACIQiAX58IhFCIIZ8Ihd8IQQgByAJaiAGakGBgH9qIQYCQCALIA5+IhggAiAPfnwiAiAYVK0gAiABIAx+fCIMIAJUrXwgDCATIBVUrSAQIBNUrXx8IgIgDFStfCABIA9+fCABIAt+IgsgDiAPfnwiASALVK1CIIYgAUIgiIR8IAIgAUIghnwiASACVK18IAEgESASVK0gAyAWVK0gEiADVK18fEIghiARQiCIhHwiAyABVK18IAMgFCAQVK0gFyAUVK18fCICIANUrXwiAUKAgICAgIDAAINQRQRAIAZBAWohBgwBCyANQj+IIQMgAUIBhiACQj+IhCEBIAJCAYYgBEI/iIQhAiANQgGGIQ0gAyAEQgGGhCEECyAGQf//AU4EQCAKQoCAgICAgMD//wCEIQpCACEBDAELAn4gBkEATARAQQEgBmsiB0H/AE0EQCAFQRBqIA0gBCAHEM4EIAVBIGogAiABIAZB/wBqIgYQzwQgBUEwaiANIAQgBhDPBCAFIAIgASAHEM4EIAUpAzAgBSkDOIRCAFKtIAUpAyAgBSkDEISEIQ0gBSkDKCAFKQMYhCEEIAUpAwAhAiAFKQMIDAILQgAhAQwCCyABQv///////z+DIAatQjCGhAsgCoQhCiANUCAEQn9VIARCgICAgICAgICAf1EbRQRAIAogAkIBfCIBIAJUrXwhCgwBCyANIARCgICAgICAgICAf4WEUEUEQCACIQEMAQsgCiACIAJCAYN8IgEgAlStfCEKCyAAIAE3AwAgACAKNwMIIAVB4ABqJAALfwICfwF+IwBBEGsiAyQAIAACfiABRQRAQgAMAQsgAyABIAFBH3UiAmogAnMiAq1CACACZyICQdEAahDPBCADKQMIQoCAgICAgMAAhUGegAEgAmutQjCGfCABQYCAgIB4ca1CIIaEIQQgAykDAAs3AwAgACAENwMIIANBEGokAAvICQIEfwR+IwBB8ABrIgUkACAEQv///////////wCDIQoCQAJAIAFCf3wiC0J/USACQv///////////wCDIgkgCyABVK18Qn98IgtC////////v///AFYgC0L///////+///8AURtFBEAgA0J/fCILQn9SIAogCyADVK18Qn98IgtC////////v///AFQgC0L///////+///8AURsNAQsgAVAgCUKAgICAgIDA//8AVCAJQoCAgICAgMD//wBRG0UEQCACQoCAgICAgCCEIQQgASEDDAILIANQIApCgICAgICAwP//AFQgCkKAgICAgIDA//8AURtFBEAgBEKAgICAgIAghCEEDAILIAEgCUKAgICAgIDA//8AhYRQBEBCgICAgICA4P//ACACIAEgA4UgAiAEhUKAgICAgICAgIB/hYRQIgYbIQRCACABIAYbIQMMAgsgAyAKQoCAgICAgMD//wCFhFANASABIAmEUARAIAMgCoRCAFINAiABIAODIQMgAiAEgyEEDAILIAMgCoRQRQ0AIAEhAyACIQQMAQsgAyABIAMgAVYgCiAJViAJIApRGyIHGyEKIAQgAiAHGyILQv///////z+DIQkgAiAEIAcbIgJCMIinQf//AXEhCCALQjCIp0H//wFxIgZFBEAgBUHgAGogCiAJIAogCSAJUCIGG3kgBkEGdK18pyIGQXFqEM8EIAUpA2ghCSAFKQNgIQpBECAGayEGCyABIAMgBxshAyACQv///////z+DIQEgCAR+IAEFIAVB0ABqIAMgASADIAEgAVAiBxt5IAdBBnStfKciB0FxahDPBEEQIAdrIQggBSkDUCEDIAUpA1gLQgOGIANCPYiEQoCAgICAgIAEhCEEIAlCA4YgCkI9iIQhASACIAuFIQwCfiADQgOGIgMgBiAIayIHRQ0AGiAHQf8ASwRAQgAhBEIBDAELIAVBQGsgAyAEQYABIAdrEM8EIAVBMGogAyAEIAcQzgQgBSkDOCEEIAUpAzAgBSkDQCAFKQNIhEIAUq2ECyEDIAFCgICAgICAgASEIQkgCkIDhiECAkAgDEJ/VwRAIAIgA30iASAJIAR9IAIgA1StfSIDhFAEQEIAIQNCACEEDAMLIANC/////////wNWDQEgBUEgaiABIAMgASADIANQIgcbeSAHQQZ0rXynQXRqIgcQzwQgBiAHayEGIAUpAyghAyAFKQMgIQEMAQsgAiADfCIBIANUrSAEIAl8fCIDQoCAgICAgIAIg1ANACABQgGDIANCP4YgAUIBiISEIQEgBkEBaiEGIANCAYghAwsgC0KAgICAgICAgIB/gyECIAZB//8BTgRAIAJCgICAgICAwP//AIQhBEIAIQMMAQtBACEHAkAgBkEASgRAIAYhBwwBCyAFQRBqIAEgAyAGQf8AahDPBCAFIAEgA0EBIAZrEM4EIAUpAwAgBSkDECAFKQMYhEIAUq2EIQEgBSkDCCEDCyADQj2GIAFCA4iEIgQgAadBB3EiBkEES618IgEgBFStIANCA4hC////////P4MgAoQgB61CMIaEfCABIAFCAYNCACAGQQRGGyIBfCIDIAFUrXwhBAsgACADNwMAIAAgBDcDCCAFQfAAaiQAC4ECAgJ/BH4jAEEQayICJAAgAb0iBUKAgICAgICAgIB/gyEHAn4gBUL///////////8AgyIEQoCAgICAgIB4fEL/////////7/8AWARAIARCPIYhBiAEQgSIQoCAgICAgICAPHwMAQsgBEKAgICAgICA+P8AWgRAIAVCPIYhBiAFQgSIQoCAgICAgMD//wCEDAELIARQBEBCAAwBCyACIARCACAEQoCAgIAQWgR/IARCIIinZwUgBadnQSBqCyIDQTFqEM8EIAIpAwAhBiACKQMIQoCAgICAgMAAhUGM+AAgA2utQjCGhAshBCAAIAY3AwAgACAEIAeENwMIIAJBEGokAAvbAQIBfwJ+QQEhBAJAIABCAFIgAUL///////////8AgyIFQoCAgICAgMD//wBWIAVCgICAgICAwP//AFEbDQAgAkIAUiADQv///////////wCDIgZCgICAgICAwP//AFYgBkKAgICAgIDA//8AURsNACAAIAKEIAUgBoSEUARAQQAPCyABIAODQgBZBEBBfyEEIAAgAlQgASADUyABIANRGw0BIAAgAoUgASADhYRCAFIPC0F/IQQgACACViABIANVIAEgA1EbDQAgACAChSABIAOFhEIAUiEECyAEC9gBAgF/AX5BfyECAkAgAEIAUiABQv///////////wCDIgNCgICAgICAwP//AFYgA0KAgICAgIDA//8AURsNACAAIANCgICAgICAgP8/hIRQBEBBAA8LIAFCgICAgICAgP8/g0IAWQRAIABCAFQgAUKAgICAgICA/z9TIAFCgICAgICAgP8/URsNASAAIAFCgICAgICAgP8/hYRCAFIPCyAAQgBWIAFCgICAgICAgP8/VSABQoCAgICAgID/P1EbDQAgACABQoCAgICAgID/P4WEQgBSIQILIAILNQAgACABNwMAIAAgAkL///////8/gyAEQjCIp0GAgAJxIAJCMIinQf//AXFyrUIwhoQ3AwgLZwIBfwF+IwBBEGsiAiQAIAACfiABRQRAQgAMAQsgAiABrUIAQfAAIAFnQR9zIgFrEM8EIAIpAwhCgICAgICAwACFIAFB//8Aaq1CMIZ8IQMgAikDAAs3AwAgACADNwMIIAJBEGokAAtFAQF/IwBBEGsiBSQAIAUgASACIAMgBEKAgICAgICAgIB/hRDWBSAFKQMAIQEgACAFKQMINwMIIAAgATcDACAFQRBqJAALxAIBAX8jAEHQAGsiBCQAAkAgA0GAgAFOBEAgBEEgaiABIAJCAEKAgICAgICA//8AENQFIAQpAyghAiAEKQMgIQEgA0H//wFIBEAgA0GBgH9qIQMMAgsgBEEQaiABIAJCAEKAgICAgICA//8AENQFIANB/f8CIANB/f8CSBtBgoB+aiEDIAQpAxghAiAEKQMQIQEMAQsgA0GBgH9KDQAgBEFAayABIAJCAEKAgICAgIDAABDUBSAEKQNIIQIgBCkDQCEBIANBg4B+SgRAIANB/v8AaiEDDAELIARBMGogASACQgBCgICAgICAwAAQ1AUgA0GGgH0gA0GGgH1KG0H8/wFqIQMgBCkDOCECIAQpAzAhAQsgBCABIAJCACADQf//AGqtQjCGENQFIAAgBCkDCDcDCCAAIAQpAwA3AwAgBEHQAGokAAuOEQIFfwx+IwBBwAFrIgUkACAEQv///////z+DIRIgAkL///////8/gyEMIAIgBIVCgICAgICAgICAf4MhESAEQjCIp0H//wFxIQcCQAJAAkAgAkIwiKdB//8BcSIJQX9qQf3/AU0EQCAHQX9qQf7/AUkNAQsgAVAgAkL///////////8AgyIKQoCAgICAgMD//wBUIApCgICAgICAwP//AFEbRQRAIAJCgICAgICAIIQhEQwCCyADUCAEQv///////////wCDIgJCgICAgICAwP//AFQgAkKAgICAgIDA//8AURtFBEAgBEKAgICAgIAghCERIAMhAQwCCyABIApCgICAgICAwP//AIWEUARAIAMgAkKAgICAgIDA//8AhYRQBEBCACEBQoCAgICAgOD//wAhEQwDCyARQoCAgICAgMD//wCEIRFCACEBDAILIAMgAkKAgICAgIDA//8AhYRQBEBCACEBDAILIAEgCoRQDQIgAiADhFAEQCARQoCAgICAgMD//wCEIRFCACEBDAILIApC////////P1gEQCAFQbABaiABIAwgASAMIAxQIgYbeSAGQQZ0rXynIgZBcWoQzwRBECAGayEGIAUpA7gBIQwgBSkDsAEhAQsgAkL///////8/Vg0AIAVBoAFqIAMgEiADIBIgElAiCBt5IAhBBnStfKciCEFxahDPBCAGIAhqQXBqIQYgBSkDqAEhEiAFKQOgASEDCyAFQZABaiASQoCAgICAgMAAhCIUQg+GIANCMYiEIgJChMn5zr/mvIL1ACACfSIEENAFIAVBgAFqQgAgBSkDmAF9IAQQ0AUgBUHwAGogBSkDiAFCAYYgBSkDgAFCP4iEIgQgAhDQBSAFQeAAaiAEQgAgBSkDeH0Q0AUgBUHQAGogBSkDaEIBhiAFKQNgQj+IhCIEIAIQ0AUgBUFAayAEQgAgBSkDWH0Q0AUgBUEwaiAFKQNIQgGGIAUpA0BCP4iEIgQgAhDQBSAFQSBqIARCACAFKQM4fRDQBSAFQRBqIAUpAyhCAYYgBSkDIEI/iIQiBCACENAFIAUgBEIAIAUpAxh9ENAFIAYgCSAHa2ohBgJ+QgAgBSkDCEIBhiAFKQMAQj+IhEJ/fCIKQv////8PgyIEIAJCIIgiDn4iECAKQiCIIgogAkL/////D4MiC358IgJCIIYiDSAEIAt+fCILIA1UrSAKIA5+IAIgEFStQiCGIAJCIIiEfHwgCyAEIANCEYhC/////w+DIg5+IhAgCiADQg+GQoCA/v8PgyINfnwiAkIghiIPIAQgDX58IA9UrSAKIA5+IAIgEFStQiCGIAJCIIiEfHx8IgIgC1StfCACQgBSrXx9IgtC/////w+DIg4gBH4iECAKIA5+Ig0gBCALQiCIIg9+fCILQiCGfCIOIBBUrSAKIA9+IAsgDVStQiCGIAtCIIiEfHwgDkIAIAJ9IgJCIIgiCyAEfiIQIAJC/////w+DIg0gCn58IgJCIIYiDyAEIA1+fCAPVK0gCiALfiACIBBUrUIghiACQiCIhHx8fCICIA5UrXwgAkJ+fCIQIAJUrXxCf3wiC0L/////D4MiAiAMQgKGIAFCPoiEQv////8PgyIEfiIOIAFCHohC/////w+DIgogC0IgiCILfnwiDSAOVK0gDSAQQiCIIg4gDEIeiEL//+//D4NCgIAQhCIMfnwiDyANVK18IAsgDH58IAIgDH4iEyAEIAt+fCINIBNUrUIghiANQiCIhHwgDyANQiCGfCINIA9UrXwgDSAKIA5+IhMgEEL/////D4MiECAEfnwiDyATVK0gDyACIAFCAoZC/P///w+DIhN+fCIVIA9UrXx8Ig8gDVStfCAPIAsgE34iCyAMIBB+fCIMIAQgDn58IgQgAiAKfnwiAkIgiCACIARUrSAMIAtUrSAEIAxUrXx8QiCGhHwiDCAPVK18IAwgFSAOIBN+IgQgCiAQfnwiCkIgiCAKIARUrUIghoR8IgQgFVStIAQgAkIghnwgBFStfHwiBCAMVK18IgJC/////////wBYBEAgAUIxhiAEQv////8PgyIBIANC/////w+DIgp+IgxCAFKtfUIAIAx9IhAgBEIgiCIMIAp+Ig0gASADQiCIIgt+fCIOQiCGIg9UrX0gAkL/////D4MgCn4gASASQv////8Pg358IAsgDH58IA4gDVStQiCGIA5CIIiEfCAEIBRCIIh+IAMgAkIgiH58IAIgC358IAwgEn58QiCGfH0hEiAGQX9qIQYgECAPfQwBCyAEQiGIIQsgAUIwhiACQj+GIARCAYiEIgRC/////w+DIgEgA0L/////D4MiCn4iDEIAUq19QgAgDH0iDiABIANCIIgiDH4iECALIAJCH4aEIg1C/////w+DIg8gCn58IgtCIIYiE1StfSAMIA9+IAogAkIBiCIKQv////8Pg358IAEgEkL/////D4N+fCALIBBUrUIghiALQiCIhHwgBCAUQiCIfiADIAJCIYh+fCAKIAx+fCANIBJ+fEIghnx9IRIgCiECIA4gE30LIQEgBkGAgAFOBEAgEUKAgICAgIDA//8AhCERQgAhAQwBCyAGQf//AGohByAGQYGAf0wEQAJAIAcNACAEIAFCAYYgA1YgEkIBhiABQj+IhCIBIBRWIAEgFFEbrXwiASAEVK0gAkL///////8/g3wiAkKAgICAgIDAAINQDQAgAiARhCERDAILQgAhAQwBCyAEIAFCAYYgA1ogEkIBhiABQj+IhCIBIBRaIAEgFFEbrXwiASAEVK0gAkL///////8/gyAHrUIwhoR8IBGEIRELIAAgATcDACAAIBE3AwggBUHAAWokAA8LIABCADcDACAAIBFCgICAgICA4P//ACACIAOEQgBSGzcDCCAFQcABaiQAC6UIAgV/An4jAEEwayIFJAACQCACQQJNBEAgAkECdCICQdycAWooAgAhByACQdCcAWooAgAhCANAAn8gASgCBCICIAEoAmhJBEAgASACQQFqNgIEIAItAAAMAQsgARDPBQsiAiIEQSBGIARBd2pBBUlyDQALAkAgAkFVaiIEQQJLBEBBASEGDAELQQEhBiAEQQFrRQ0AQX9BASACQS1GGyEGIAEoAgQiAiABKAJoSQRAIAEgAkEBajYCBCACLQAAIQIMAQsgARDPBSECC0EAIQQCQAJAA0AgBEGMnAFqLAAAIAJBIHJGBEACQCAEQQZLDQAgASgCBCICIAEoAmhJBEAgASACQQFqNgIEIAItAAAhAgwBCyABEM8FIQILIARBAWoiBEEIRw0BDAILCyAEQQNH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KAJoSQRAIAAgAkEBajYCBCACLQAADAELIAAQzwULIgNBUGoiAkEJTUEAIAFBUGoiBEHMmbPmAEgbDQALIASsIQYCQCACQQpPDQADQCADrSAGQgp+fCEGAn8gACgCBCIBIAAoAmhJBEAgACABQQFqNgIEIAEtAAAMAQsgABDPBQshAyAGQlB8IQYgA0FQaiICQQlLDQEgBkKuj4XXx8LrowFTDQALCyACQQpJBEADQAJ/IAAoAgQiASAAKAJoSQRAIAAgAUEBajYCBCABLQAADAELIAAQzwULQVBqQQpJDQALCyAAKAJoBEAgACAAKAIEQX9qNgIEC0IAIAZ9IAYgBRshBgwBC0KAgICAgICAgIB/IQYgACgCaEUNACAAIAAoAgRBf2o2AgRCgICAgICAgICAfw8LIAYLtgMCA38BfiMAQSBrIgMkAAJAIAFC////////////AIMiBUKAgICAgIDAv0B8IAVCgICAgICAwMC/f3xUBEAgAUIZiKchAiAAUCABQv///w+DIgVCgICACFQgBUKAgIAIURtFBEAgAkGBgICABGohAgwCCyACQYCAgIAEaiECIAAgBUKAgIAIhYRCAFINASACQQFxIAJqIQIMAQsgAFAgBUKAgICAgIDA//8AVCAFQoCAgICAgMD//wBRG0UEQCABQhmIp0H///8BcUGAgID+B3IhAgwBC0GAgID8ByECIAVC////////v7/AAFYNAEEAIQIgBUIwiKciBEGR/gBJDQAgAyAAIAFC////////P4NCgICAgICAwACEIgVBgf8AIARrEM4EIANBEGogACAFIARB/4F/ahDPBCADKQMIIgBCGYinIQIgAykDACADKQMQIAMpAxiEQgBSrYQiBVAgAEL///8PgyIAQoCAgAhUIABCgICACFEbRQRAIAJBAWohAgwBCyAFIABCgICACIWEQgBSDQAgAkEBcSACaiECCyADQSBqJAAgAiABQiCIp0GAgICAeHFyvgvxEwINfwN+IwBBsAJrIgYkACAAKAJMQQBOBH9BAQVBAAsaAkAgAS0AACIERQ0AAkADQAJAAkAgBEH/AXEiA0EgRiADQXdqQQVJcgRAA0AgASIEQQFqIQEgBC0AASIDQSBGIANBd2pBBUlyDQALIABCABDOBQNAAn8gACgCBCIBIAAoAmhJBEAgACABQQFqNgIEIAEt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DyEOIBBFDQMgABCUBRogCiEHIAIhASAJIAtqQQJJDQMDQCABIANGDQQCQCAHLQAAQQJHDQACfyABLAALQQBIBEAgASgCBAwBCyABLQALCyAORg0AIAdBADoAACALQX9qIQsLIAdBAWohByABQQxqIQEMAAALAAUCQCAHLQAAQQFHDQACfyABLAALQQBIBEAgASgCAAwBCyABCyAOQQJ0aigCACERAkAgBgR/IBEFIAQgESAEKAIAKAIcEQMACyANRgRAQQEhEAJ/IAEsAAtBAEgEQCABKAIEDAELIAEtAAsLIA9HDQIgB0ECOgAAIAtBAWohCwwBCyAHQQA6AAALIAlBf2ohCQsgB0EBaiEHIAFBDGohAQwBCwAACwALCwJAAkADQCACIANGDQEgCi0AAEECRwRAIApBAWohCiACQQxqIQIMAQsLIAIhAwwBCyAFIAUoAgBBBHI2AgALIAwiACgCACEBIABBADYCACABBEAgASAAKAIEEQEACyAIQYABaiQAIAMPBQJAAn8gASwAC0EASARAIAEoAgQMAQsgAS0ACwsEQCAHQQE6AAAMAQsgB0ECOgAAIAtBAWohCyAJQX9qIQkLIAdBAWohByABQQxqIQEMAQsAAAsACxCqBwALDwAgASACIAMgBCAFELkGC/oEAQR/IwBB4AJrIgUkACAFIAE2AtACIAUgADYC2AIgAhCRBiEGIAIgBUHgAWoQugYhByAFQdABaiACIAVBzAJqELsGIAVBwAFqEJMGIgAgACwAC0EASAR/IAAoAghB/////wdxQX9qBUEKCxCUBiAFAn8gACwAC0EASARAIAAoAgAMAQsgAAsiATYCvAEgBSAFQRBqNgIMIAVBADYCCANAAkAgBUHYAmogBUHQAmoQkwVFDQAgBSgCvAECfyAALAALQQBIBEAgACgCBAwBCyAALQALCyABakYEQAJ/IAAiASwAC0EASARAIAEoAgQMAQsgAS0ACwshAiABAn8gASwAC0EASARAIAEoAgQMAQsgAS0ACwtBAXQQlAYgASABLAALQQBIBH8gASgCCEH/////B3FBf2oFQQoLEJQGIAUgAgJ/IAEsAAtBAEgEQCAAKAIADAELIAALIgFqNgK8AQsCfyAFKALYAiICKAIMIgggAigCEEYEQCACIAIoAgAoAiQRAAAMAQsgCCgCAAsgBiABIAVB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AiEBIAAQ/AgaIAVB0AFqEPwIGiAFQeACaiQAIAELDwAgASACIAMgBCAFEMQGC/oEAQR/IwBB4AJrIgUkACAFIAE2AtACIAUgADYC2AIgAhCRBiEGIAIgBUHgAWoQugYhByAFQdABaiACIAVBzAJqELsGIAVBwAFqEJMGIgAgACwAC0EASAR/IAAoAghB/////wdxQX9qBUEKCxCUBiAFAn8gACwAC0EASARAIAAoAgAMAQsgAAsiATYCvAEgBSAFQRBqNgIMIAVBADYCCANAAkAgBUHYAmogBUHQAmoQkwVFDQAgBSgCvAECfyAALAALQQBIBEAgACgCBAwBCyAALQALCyABakYEQAJ/IAAiASwAC0EASARAIAEoAgQMAQsgAS0ACwshAiABAn8gASwAC0EASARAIAEoAgQMAQsgAS0ACwtBAXQQlAYgASABLAALQQBIBH8gASgCCEH/////B3FBf2oFQQoLEJQGIAUgAgJ/IAEsAAtBAEgEQCAAKAIADAELIAALIgFqNgK8AQsCfyAFKALYAiICKAIMIgggAigCEEYEQCACIAIoAgAoAiQRAAAMAQsgCCgCAAsgBiABIAVBvAFqIAVBCGogBSgCzAIgBUHQAWogBUEQaiAFQQxqIAcQvAYNACAFQdgCahCUBRoMAQsLAkACfyAFLADbAUEASARAIAUoAtQBDAELIAUtANsBC0UNACAFKAIMIgIgBUEQamtBnwFKDQAgBSACQQRqNgIMIAIgBSgCCDYCAAsgBCABIAUoArwBIAMgBhCjBjcDACAFQdABaiAFQRBqIAUoAgwgAxCXBiAFQdgCaiAFQdACahCVBQRAIAMgAygCAEECcjYCAAsgBSgC2AIhASAAEPwIGiAFQdABahD8CBogBUHgAmokACABCw8AIAEgAiADIAQgBRDGBguZBQECfyMAQfACayIFJAAgBSABNgLgAiAFIAA2AugCIAVByAFqIAIgBUHgAWogBUHcAWogBUHYAWoQxwYgBUG4AWoQkwYiASABLAALQQBIBH8gASgCCEH/////B3FBf2oFQQoLEJQGIAUCfyABLAALQQBIBEAgASgCAAwBCyABCyIANgK0ASAFIAVBEGo2AgwgBUEANgIIIAVBAToAByAFQcUAOgAGA0ACQCAFQegCaiAFQeACahCTBUUNACAFKAK0AQJ/IAEsAAtB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QQBHBUEACwtGAANAIAEgAkcEQCADIAEoAgBB/wBNBH9BzJ4BKAIAIAEoAgBBAXRqLwEABUEACzsBACADQQJqIQMgAUEEaiEBDAELCyACC0UAA0ACQCACIANHBH8gAigCAEH/AEsNAUHMngEoAgAgAigCAEEBdGovAQAgAXFFDQEgAgUgAwsPCyACQQRqIQIMAAALAAtFAAJAA0AgAiADRg0BAkAgAigCAEH/AEsNAEHMngEoAgAgAigCAEEBdGovAQAgAXFFDQAgAkEEaiECDAELCyACIQMLIAMLHgAgAUH/AE0Ef0HQpAEoAgAgAUECdGooAgAFIAELC0EAA0AgASACRwRAIAEgASgCACIAQf8ATQR/QdCkASgCACABKAIAQQJ0aigCAAUgAAs2AgAgAUEEaiEBDAELCyACCx4AIAFB/wBNBH9B4LABKAIAIAFBAnRqKAIABSABCwtBAANAIAEgAkcEQCABIAEoAgAiAEH/AE0Ef0HgsAEoAgAgASgCAEECdGooAgAFIAALNgIAIAFBBGohAQwBCwsgAgsEACABCyoAA0AgASACRkUEQCADIAEsAAA2AgAgA0EEaiEDIAFBAWohAQwBCwsgAgsTACABIAIgAUGAAUkbQRh0QRh1CzUAA0AgASACRkUEQCAEIAEoAgAiACADIABBgAFJGzoAACAEQQFqIQQgAUEEaiEBDAELCyACCykBAX8gAEGkvwE2AgACQCAAKAIIIgFFDQAgAC0ADEUNACABEMgJCyAACwoAIAAQgwgQyAkLJwAgAUEATgR/QdCkASgCACABQf8BcUECdGooAgAFIAELQRh0QRh1C0AAA0AgASACRwRAIAEgASwAACIAQQBOBH9B0KQBKAIAIAEsAABBAnRqKAIABSAACzoAACABQQFqIQEMAQsLIAILJwAgAUEATgR/QeCwASgCACABQf8BcUECdGooAgAFIAELQRh0QRh1C0AAA0AgASACRwRAIAEgASwAACIAQQBOBH9B4LABKAIAIAEsAABBAnRqKAIABSAACzoAACABQQFqIQEMAQsLIAILKgADQCABIAJGRQRAIAMgAS0AADoAACADQQFqIQMgAUEBaiEBDAELCyACCwwAIAEgAiABQX9KGws0AANAIAEgAkZFBEAgBCABLAAAIgAgAyAAQX9KGzoAACAEQQFqIQQgAUEBaiEB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IAcgCRsoAgAiAkELTwsEfyACQRBqQXBxIgIgAkF/aiICIAJBC0YbBUEKCwwBC0FuC0EBaiIHEOEIIQIgBARAIAIgBiAEEPMECyADIARrIgMEQCACIARqIAQgBmogAxDzBAsgAUEKRwRAIAYQyAkLIAAgAjYCACAAIAdBgICAgHhyNgIIIAVBEGokAA8LEPkIAAsVACABBEAgACACQf8BcSABENQJGgsL1wEBA38jAEEQayIFJAACQCAALAALQQBIBH8gACgCCEH/////B3FBf2oFQQoLIgQCfyAALAALQQBIBEAgACgCBAwBCyAALQALCyIDayACTwRAIAJFDQECfyAALAALQQBIBEAgACgCAAwBCyAACyIEIANqIAEgAhDzBCACIANqIgIhAQJAIAAsAAtBAEgEQCAAIAE2AgQMAQsgACABOgALCyAFQQA6AA8gAiAEaiAFLQAPOgAADAELIAAgBCACIANqIARrIAMgA0EAIAIgARD+CAsgBUEQaiQAC8EBAQN/IwBBEGsiAyQAIAMgAToADwJAAkACQAJAIAAsAAtBAEgEQCAAKAIEIgQgACgCCEH/////B3FBf2oiAkYNAQwDC0EKIQRBCiECIAAtAAsiAUEKRw0BCyAAIAJBASACIAIQggkgBCEBIAAsAAtBAEgNAQsgACICIAFBAWo6AAsMAQsgACgCACECIAAgBEEBajYCBCAEIQELIAEgAmoiACADLQAPOgAAIANBADoADiAAIAMtAA46AAEgA0EQaiQACzsBAX8jAEEQayIBJAACQCAAQQE6AAsgAEEBQS0QgwkgAUEAOgAPIAAgAS0ADzoAASABQRBqJAAPAAsAC6MBAQN/IwBBEGsiBCQAQe////8DIAJPBEACQCACQQFNBEAgACACOgALIAAhAwwBCyAAIAJBAk8EfyACQQRqQXxxIgMgA0F/aiIDIANBAkYbBUEBC0EBaiIFEO0IIgM2AgAgACAFQYCAgIB4cjYCCCAAIAI2AgQLIAMgASACEPwEIARBADYCDCADIAJBAnRqIAQoAgw2AgAgBEEQaiQADwsQ+QgAC9ABAQN/IwBBEGsiBCQAAkAgACwAC0EASAR/IAAoAghB/////wdxQX9qBUEBCyIDIAJPBEACfyAALAALQQBIBEAgACgCAAwBCyAACyIFIQMgAgR/IAMgASACEPgIBSAD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CEL/////////B4NCgICAgICAgAiECyIFAn4gA0UEQEEAIQMgB0IMhiIGQgBZBEADQCADQX9qIQMgBkIBhiIGQn9VDQALCyAHQQEgA2uthgwBCyAHQv////////8Hg0KAgICAgICACIQLIgd9IgZCf1UhBCACIANKBEADQAJAIARFDQAgBiIFQgBSDQAgAEQAAAAAAAAAAKIPCyAFQgGGIgUgB30iBkJ/VSEEIAJBf2oiAiADSg0ACyADIQILAkAgBEUNACAGIgVCAFINACAARAAAAAAAAAAAog8LAkAgBUL/////////B1YEQCAFIQYMAQsDQCACQX9qIQIgBUKAgICAgICABFQhAyAFQgGGIgYhBSADDQALCyAIQoCAgICAgICAgH+DIQUgAkEBTgR+IAZCgICAgICAgHh8IAKtQjSGhAUgBkEBIAJrrYgLIAWEvw8LIABEAAAAAAAAAACiIAAgBSAGURsLqwYCBX8EfiMAQYABayIFJAACQAJAAkAgAyAEQgBCABDYBUUNACADIAQQ0gkhByACQjCIpyIJQf//AXEiBkH//wFGDQAgBw0BCyAFQRBqIAEgAiADIAQQ1AUgBSAFKQMQIgIgBSkDGCIBIAIgARDeBSAFKQMIIQIgBSkDACEEDAELIAEgAkL///////8/gyAGrUIwhoQiCiADIARC////////P4MgBEIwiKdB//8BcSIHrUIwhoQiCxDYBUEATARAIAEgCiADIAsQ2AUEQCABIQQMAgsgBUHwAGogASACQgBCABDUBSAFKQN4IQIgBSkDcCEEDAELIAYEfiABBSAFQeAAaiABIApCAEKAgICAgIDAu8AAENQFIAUpA2giCkIwiKdBiH9qIQYgBSkDYAshBCAHRQRAIAVB0ABqIAMgC0IAQoCAgICAgMC7wAAQ1AUgBSkDWCILQjCIp0GIf2ohByAFKQNQIQMLIApC////////P4NCgICAgICAwACEIgogC0L///////8/g0KAgICAgIDAAIQiDX0gBCADVK19IgxCf1UhCCAEIAN9IQsgBiAHSgRAA0ACfiAIBEAgCyAMhFAEQCAFQSBqIAEgAkIAQgAQ1AUgBSkDKCECIAUpAyAhBAwFCyALQj+IIQogDEIBhgwBCyAKQgGGIQogBCELIARCP4gLIQwgCiAMhCIKIA19IAtCAYYiBCADVK19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ERUACxEAIAEgAiADIAQgBSAAEVUACw0AIAEgAiADIAAREgALDwAgASACIAMgBCAAEVIACwsAIAEgAiAAERgACwsAIAEgAiAAEQ8ACw0AIAEgAiADIAARGgALDQAgASACIAMgABEeAAsPACABIAIgAyAEIAARTAALDwAgASACIAMgBCAAERkACw8AIAEgAiADIAQgABFcAAsRACABIAIgAyAEIAUgABFPAAsRACABIAIgAyAEIAUgABFdAAsTACABIAIgAyAEIAUgBiAAEVAACw8AIAEgAiADIAQgABE+AAsRACABIAIgAyAEIAUgABE3AAsRACABIAIgAyAEIAUgABE/AAsTACABIAIgAyAEIAUgBiAAETgACxMAIAEgAiADIAQgBSAGIAARQAALFQAgASACIAMgBCAFIAYgByAAETkACw8AIAEgAiADIAQgABFCAAsRACABIAIgAyAEIAUgABE7AAsPACABIAIgAyAEIAARRgALDQAgASACIAMgABFBAAsPACABIAIgAyAEIAAROgALDwAgASACIAMgBCAAEQgACxEAIAEgAiADIAQgBSAAET0ACxMAIAEgAiADIAQgBSAGIAARNQALEwAgASACIAMgBCAFIAYgABEgAAsTACABIAIgAyAEIAUgBiAAEV4ACxUAIAEgAiADIAQgBSAGIAcgABFUAAsVACABIAIgAyAEIAUgBiAHIAARWQALEwAgASACIAMgBCAFIAYgABFfAAsVACABIAIgAyAEIAUgBiAHIAARVwALFwAgASACIAMgBCAFIAYgByAIIAARYQALGQAgASACIAMgBCAFIAYgByAIIAkgABFaAAsNACABIAIgAyAAESQACw8AIAEgAiADIAQgABErAAsTACABIAIgAyAEIAUgBiAAES0ACxUAIAEgAiADIAQgBSAGIAcgABFRAAsPACABIAIgAyAEIAARHwALEQAgASACIAMgBCAFIAARLAALDQAgASACIAMgABEiAAsPACABIAIgAyAEIAARNgALEQAgASACIAMgBCAFIAARCgALDQAgASACIAMgABFIAAsPACABIAIgAyAEIAARRwALCQAgASAAESkACwsAIAEgAiAAESoACw8AIAEgAiADIAQgABFKAAsRACABIAIgAyAEIAUgABFLAAsTACABIAIgAyAEIAUgBiAAETMACxUAIAEgAiADIAQgBSAGIAcgABEyAAsNACABIAIgAyAAEWMACw8AIAEgAiADIAQgABE0AAsPACABIAIgAyAEIAARaAALEQAgASACIAMgBCAFIAARLgALEwAgASACIAMgBCAFIAYgABFTAAsTACABIAIgAyAEIAUgBiAAEWAACxUAIAEgAiADIAQgBSAGIAcgABFYAAsRACABIAIgAyAEIAUgABEvAAsTACABIAIgAyAEIAUgBiAAEVYACwsAIAEgAiAAEWoACw8AIAEgAiADIAQgABFbAAsRACABIAIgAyAEIAUgABFOAAsTACABIAIgAyAEIAUgBiAAEUkACxEAIAEgAiADIAQgBSAAEQYACxcAIAEgAiADIAQgBSAGIAcgCCAAEQ4ACxMAIAEgAiADIAQgBSAGIAARCQALEQAgASACIAMgBCAFIAARJwALFQAgASACIAMgBCAFIAYgByAAERQACxMAIAEgAiADIAQgBSAGIAARDQALBwAgABEHAAsZACABIAIgA60gBK1CIIaEIAUgBiAAESYACyIBAX4gASACrSADrUIghoQgBCAAERwAIgVCIIinECkgBacLGQAgASACIAMgBCAFrSAGrUIghoQgABEjAAsjACABIAIgAyAEIAWtIAatQiCGhCAHrSAIrUIghoQgABFFAAslACABIAIgAyAEIAUgBq0gB61CIIaEIAitIAmtQiCGhCAAEUQACwuazAJWAEGACAuAElZlY3RvckludABWZWN0b3JEb3VibGUAVmVjdG9yQ2hhcgBWZWN0b3JVQ2hhcgBWZWN0b3JGbG9hdAB2ZWN0b3JUb29scwBjbGVhclZlY3RvckRibABjbGVhclZlY3RvckZsb2F0AG1heGlTZXR0aW5ncwBzZXR1cABzYW1wbGVSYXRlAGNoYW5uZWxzAGJ1ZmZlclNpemUAbWF4aU9zYwBzaW5ld2F2ZQBjb3N3YXZlAHBoYXNvcgBzYXcAdHJpYW5nbGUAc3F1YXJlAHB1bHNlAGltcHVsc2UAbm9pc2UAc2luZWJ1ZgBzaW5lYnVmNABzYXduAHBoYXNlUmVzZXQAbWF4aUVudmVsb3BlAGxpbmUAdHJpZ2dlcgBhbXBsaXR1ZGUAdmFsaW5kZXgAbWF4aURlbGF5bGluZQBkbABtYXhpRmlsdGVyAGxvcmVzAGhpcmVzAGJhbmRwYXNzAGxvcGFzcwBoaXBhc3MAY3V0b2ZmAHJlc29uYW5jZQBtYXhpTWl4AHN0ZXJlbwBxdWFkAGFtYmlzb25pYwBtYXhpTGluZQBwbGF5AHByZXBhcmUAdHJpZ2dlckVuYWJsZQBpc0xpbmVDb21wbGV0ZQBtYXhpWEZhZGUAeGZhZGUAbWF4aUxhZ0V4cABpbml0AGFkZFNhbXBsZQB2YWx1ZQBhbHBoYQBhbHBoYVJlY2lwcm9jYWwAdmFsAG1heGlTYW1wbGUAZ2V0TGVuZ3RoAHNldFNhbXBsZQBzZXRTYW1wbGVGcm9tT2dnQmxvYgBpc1JlYWR5AHBsYXlPbmNlAHBsYXlPblpYAHBsYXk0AGNsZWFyAG5vcm1hbGlzZQBhdXRvVHJpbQBsb2FkAHJlYWQAbG9vcFNldFBvc09uWlgAbWF4aU1hcABsaW5saW4AbGluZXhwAGV4cGxpbgBjbGFtcABtYXhpRHluAGdhdGUAY29tcHJlc3NvcgBjb21wcmVzcwBzZXRBdHRhY2sAc2V0UmVsZWFzZQBzZXRUaHJlc2hvbGQAc2V0UmF0aW8AbWF4aUVudgBhcgBhZHNyAHNldERlY2F5AHNldFN1c3RhaW4AY29udmVydABtdG9mAG1zVG9TYW1wcwBtYXhpU2FtcGxlQW5kSG9sZABzYWgAbWF4aURpc3RvcnRpb24AZmFzdEF0YW4AYXRhbkRpc3QAZmFzdEF0YW5EaXN0AG1heGlGbGFuZ2VyAGZsYW5nZQBtYXhpQ2hvcnVzAGNob3J1cwBtYXhpRENCbG9ja2VyAG1heGlTVkYAc2V0Q3V0b2ZmAHNldFJlc29uYW5jZQBtYXhpTWF0aABhZGQAc3ViAG11bABkaXYAZ3QAbHQAZ3RlAGx0ZQBtb2QAYWJzAHBvdwBtYXhpQ2xvY2sAdGlja2VyAHNldFRlbXBvAHNldFRpY2tzUGVyQmVhdABpc1RpY2sAY3VycmVudENvdW50AHBsYXlIZWFkAGJwcwBicG0AdGljawB0aWNrcwBtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yAHNldFBoYXNlAGdldFBoYXNlAG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQAc2V0UGhhc2VzAHNpemUAbWF4aUFzeW5jS3VyYW1vdG9Pc2NpbGxhdG9yAG1heGlGRlQAcHJvY2VzcwBzcGVjdHJhbEZsYXRuZXNzAHNwZWN0cmFsQ2VudHJvaWQAZ2V0TWFnbml0dWRlcwBnZXRNYWduaXR1ZGVzREIAZ2V0UGhhc2VzAGdldE51bUJpbnMAZ2V0RkZUU2l6ZQBnZXRIb3BTaXplAGdldFdpbmRvd1NpemUAbWF4aUZGVE1vZGVzAFdJVEhfUE9MQVJfQ09OVkVSU0lPTgBOT19QT0xBUl9DT05WRVJTSU9OAG1heGlJRkZUAG1heGlJRkZUTW9kZXMAU1BFQ1RSVU0AQ09NUExFWABtYXhpTUZDQwBtZmNjAG1heGlUaW1lU3RyZXRjaABzaGFyZWRfcHRyPG1heGlUaW1lc3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPgBnZXROb3JtYWxpc2VkUG9zaXRpb24AZ2V0UG9zaXRpb24Ac2V0UG9zaXRpb24AcGxheUF0UG9zaXRpb24AbWF4aVBpdGNoU2hpZnQAc2hhcmVkX3B0cjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPgBtYXhpU3RyZXRjaABzZXRMb29wU3RhcnQAc2V0TG9vcEVuZABnZXRMb29wRW5kAG1heGlCaXRzAHNpZwBhdABzaGwAc2hyAHIAbGFuZABsb3IAbHhvcgBuZWcAaW5jAGRlYwBlcQB0b1NpZ25hbAB0b1RyaWdTaWduYWwAZnJvbVNpZ25hbABtYXhpVHJpZ2dlcgBvblpYAG9uQ2hhbmdlZABtYXhpQ291bnRlcgBjb3VudABtYXhpSW5kZXgAcHVsbABtYXhpUmF0aW9TZXEAcGxheVRyaWcAcGxheVZhbHVlcwBhbGxvY2F0b3I8VD46OmFsbG9jYXRlKHNpemVfdCBuKSAnbicgZXhjZWVkcyBtYXhpbXVtIHN1cHBvcnRlZCBzaXplAHB1c2hfYmFjawByZXNpemUAZ2V0AHNldABOU3QzX18yNnZlY3RvcklpTlNfOWFsbG9jYXRvcklpRUVFRQBOU3QzX18yMTNfX3ZlY3Rvcl9iYXNlSWlOU185YWxsb2NhdG9ySWlFRUVFAE5TdDNfXzIyMF9fdmVjdG9yX2Jhc2VfY29tbW9uSUxiMUVFRQAAzHoAABYMAABQewAA6gsAAAAAAAABAAAAPAwAAAAAAABQewAAxgsAAAAAAAAB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STE0aGFubldpbkZ1bmN0b3JFAAAArHsAAGglAAABAAAAKCUAAAAAAABYJgAAOgIAADsCAAA8AgAAPQIAAD4CAABOU3QzX18yMjBfX3NoYXJlZF9wdHJfcG9pbnRlcklQMTVtYXhpVGltZVN0cmV0Y2hJMTRoYW5uV2luRnVuY3RvckVOMTBlbXNjcmlwdGVuMTVzbWFydF9wdHJfdHJhaXRJTlNfMTBzaGFyZWRfcHRySVMzX0VFRTExdmFsX2RlbGV0ZXJFTlNfOWFsbG9jYXRvcklTM19FRUVFAAD0egAAvCUAABR3AABOMTBlbXNjcmlwdGVuMTVzbWFydF9wdHJfdHJhaXRJTlN0M19fMjEwc2hhcmVkX3B0ckkxNW1heGlUaW1lU3RyZXRjaEkxNGhhbm5XaW5GdW5jdG9yRUVFRTExdmFsX2RlbGV0ZXJFAE5TdDNfXzIxMHNoYXJlZF9wdHJJMTVtYXhpVGltZVN0cmV0Y2hJMTRoYW5uV2luRnVuY3RvckVFRQAAAMx6AADMJgAAaQAAAAgnAAAAAAAAjCcAAD8CAABAAgAAQQIAAEICAABDAgAATlN0M19fMjIwX19zaGFyZWRfcHRyX2VtcGxhY2VJMTVtYXhpVGltZVN0cmV0Y2hJMTRoYW5uV2luRnVuY3RvckVOU185YWxsb2NhdG9ySVMzX0VFRUUAAPR6AAA0JwAAFHcAANR5AABYJQAApBgAAHB6AABYJQAA1HkAAFglAABwegAAAAAAAAQoAABEAgAARQIAAEYCAAA5bWF4aUdyYWluSTE0aGFubldpbkZ1bmN0b3JFADEzbWF4aUdyYWluQmFzZQAAAADMegAA6ScAAPR6AADMJwAA/CcAAHB6AABYJQAAcHoAAHB6AAA0egAAcHoAAGRpaWRkaWQAcHoAAFglAABwegAAcHoAADR6AAAxNG1heGlQaXRjaFNoaWZ0STE0aGFubldpbkZ1bmN0b3JFAADMegAARCgAAFAxNG1heGlQaXRjaFNoaWZ0STE0aGFubldpbkZ1bmN0b3JFAKx7AABwKAAAAAAAAGgoAABQSzE0bWF4aVBpdGNoU2hpZnRJMTRoYW5uV2luRnVuY3RvckUAAAAArHsAAKQoAAABAAAAaCgAAAAAAACUKQAARwIAAEgCAABJAgAASgIAAEsCAABOU3QzX18yMjBfX3NoYXJlZF9wdHJfcG9pbnRlcklQMTRtYXhpUGl0Y2hTaGlmdEkxNGhhbm5XaW5GdW5jdG9yRU4xMGVtc2NyaXB0ZW4xNXNtYXJ0X3B0cl90cmFpdElOU18xMHNoYXJlZF9wdHJJUzNfRUVFMTF2YWxfZGVsZXRlckVOU185YWxsb2NhdG9ySVMzX0VFRUUAAAD0egAA+CgAABR3AABOMTBlbXNjcmlwdGVuMTVzbWFydF9wdHJfdHJhaXRJTlN0M19fMjEwc2hhcmVkX3B0ckkxNG1heGlQaXRjaFNoaWZ0STE0aGFubldpbkZ1bmN0b3JFRUVFMTF2YWxfZGVsZXRlckUATlN0M19fMjEwc2hhcmVkX3B0ckkxNG1heGlQaXRjaFNoaWZ0STE0aGFubldpbkZ1bmN0b3JFRUUAzHoAAAcqAABAKgAAAAAAAMAqAABMAgAATQIAAE4CAABCAgAATwIAAE5TdDNfXzIyMF9fc2hhcmVkX3B0cl9lbXBsYWNlSTE0bWF4aVBpdGNoU2hpZnRJMTRoYW5uV2luRnVuY3RvckVOU185YWxsb2NhdG9ySVMzX0VFRUUAAAD0egAAaCoAABR3AADUeQAAlCgAAKQYAEHg1QAL0gFwegAAlCgAAHB6AABwegAANHoAAHB6AAAxMW1heGlTdHJldGNoSTE0aGFubldpbkZ1bmN0b3JFAMx6AAD4KgAAUDExbWF4aVN0cmV0Y2hJMTRoYW5uV2luRnVuY3RvckUAAAAArHsAACArAAAAAAAAGCsAAFBLMTFtYXhpU3RyZXRjaEkxNGhhbm5XaW5GdW5jdG9yRQAAAKx7AABUKwAAAQAAABgrAABEKwAA1HkAAEQrAACkGAAAcHoAAEQrAADUeQAARCsAAHB6AABYegAARCsAQcDXAAskcHoAAEQrAABwegAAcHoAAHB6AAA0egAAcHoAAGRpaWRkZGlkAEHw1wAL4gNwegAARCsAAHB6AABwegAAcHoAADR6AABkaWlkZGRpADhtYXhpQml0cwAAAMx6AAAQLAAAUDhtYXhpQml0cwAArHsAACQsAAAAAAAAHCwAAFBLOG1heGlCaXRzAKx7AABALAAAAQAAABwsAABAegAAQHoAAEB6AABAegAAQHoAAEB6AABAegAAQHoAAEB6AABAegAAcHoAAEB6AABAegAA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cmFpdHNJY0VFRUUAAFB7AADUSQAAAAAAAAEAAAB4SAAAA/T//05TdDNfXzIxM2Jhc2ljX29zdHJlYW1Jd05TXzExY2hhcl90cmFpdHNJd0VFRUUAAFB7AAAcSgAAAAAAAAEAAADASAAAA/T//5i3AAAAAAAAwEoAAHICAACdAgAAngIAAHUCAAB2AgAAdwIAAHgCAABgAgAAYQIAAJ8CAACgAgAAoQIAAGUCAAB7AgAATlN0M19fMjEwX19zdGRpbmJ1ZkljRUUA9HoAAKhKAAAASQAAdW5zdXBwb3J0ZWQgbG9jYWxlIGZvciBzdGFuZGFyZCBpbnB1dAAAAAAAAABMSwAAfAIAAKICAACjAgAAfwIAAIACAACBAgAAggIAAIMCAACEAgAApAIAAKUCAACmAgAAiAIAAIkCAABOU3QzX18yMTBfX3N0ZGluYnVmSXdFRQD0egAANEsAADxJAAAAAAAAtEsAAHICAACnAgAAqAIAAHUCAAB2AgAAdwIAAKkCAABgAgAAYQIAAHkCAABjAgAAegIAAKoCAACrAgAATlN0M19fMjExX19zdGRvdXRidWZJY0VFAAAAAPR6AACYSwAAAEkAAAAAAAAcTAAAfAIAAKwCAACtAgAAfwIAAIACAACBAgAArgIAAIMCAACEAgAAhQIAAIYCAACHAgAArwIAALACAABOU3QzX18yMTFfX3N0ZG91dGJ1Zkl3RUUAAAAA9HoAAABMAAA8SQBBsJgBC+ME/////////////////////////////////////////////////////////////////wABAgMEBQYHCAn/////////CgsMDQ4PEBESExQVFhcYGRobHB0eHyAhIiP///////8KCwwNDg8QERITFBUWFxgZGhscHR4fICEiI/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////8AAQIEBwMGBQAAAAAAAAACAADAAwAAwAQAAMAFAADABgAAwAcAAMAIAADACQAAwAoAAMALAADADAAAwA0AAMAOAADADwAAwBAAAMAR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AAA8ewAAsgMAAL4DAAC0AwAAtQMAALoDAAC/AwAAwAMAAMEDAABOMTBfX2N4eGFiaXYxMjBfX3NpX2NsYXNzX3R5cGVfaW5mb0UAAAAA9HoAABR7AACkeAAAAAAAAJh7AACyAwAAwgMAALQDAAC1AwAAugMAAMMDAADEAwAAxQMAAE4xMF9fY3h4YWJpdjEyMV9fdm1pX2NsYXNzX3R5cGVfaW5mb0UAAAD0egAAcHsAAKR4AAAAAAAABHkAALIDAADGAwAAtAMAALUDAADHAwAAdm9pZABib29sAGNoYXIAc2lnbmVkIGNoYXIAdW5zaWduZWQgY2hhcgBzaG9ydAB1bnNpZ25lZCBzaG9ydABpbnQAdW5zaWduZWQgaW50AGxvbmcAdW5zaWduZWQgbG9uZwBmbG9hdABkb3VibGUAc3RkOjpzdHJpbmcAc3RkOjpiYXNpY19zdHJpbmc8dW5zaWduZWQgY2hhcj4Ac3RkOjp3c3RyaW5nAHN0ZDo6dTE2c3RyaW5nAHN0ZDo6dTMyc3RyaW5nAGVtc2NyaXB0ZW46OnZhbABlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxjaGFyPgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxzaWduZWQgY2hhcj4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8dW5zaWduZWQgY2hhcj4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8c2hvcnQ+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHVuc2lnbmVkIHNob3J0PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxpbnQ+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHVuc2lnbmVkIGludD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8bG9uZz4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8dW5zaWduZWQgbG9uZz4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8aW50OF90PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzx1aW50OF90PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxpbnQxNl90PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzx1aW50MTZfdD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8aW50MzJfdD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8dWludDMyX3Q+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PGZsb2F0PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxkb3VibGU+AE5TdDNfXzIxMmJhc2ljX3N0cmluZ0loTlNfMTFjaGFyX3RyYWl0c0loRUVOU185YWxsb2NhdG9ySWhFRUVFAAAAAFB7AADWfgAAAAAAAAEAAAAIGgAAAAAAAE5TdDNfXzIxMmJhc2ljX3N0cmluZ0l3TlNfMTFjaGFyX3RyYWl0c0l3RUVOU185YWxsb2NhdG9ySXdFRUVFAABQewAAMH8AAAAAAAABAAAACBoAAAAAAABOU3QzX18yMTJiYXNpY19zdHJpbmdJRHNOU18xMWNoYXJfdHJhaXRzSURzRUVOU185YWxsb2NhdG9ySURzRUVFRQAAAFB7AACIfwAAAAAAAAEAAAAIGgAAAAAAAE5TdDNfXzIxMmJhc2ljX3N0cmluZ0lEaU5TXzExY2hhcl90cmFpdHNJRGlFRU5TXzlhbGxvY2F0b3JJRGlFRUVFAAAAUHsAAOR/AAAAAAAAAQAAAAgaAAAAAAAATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJY0VFAADMegAAQIAAAE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SWFFRQAAzHoAAGiAAABOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0loRUUAAMx6AACQgAAATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJc0VFAADMegAAuIAAAE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SXRFRQAAzHoAAOCAAABOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0lpRUUAAMx6AAAIgQAATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJakVFAADMegAAMIEAAE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SWxFRQAAzHoAAFiBAABOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0ltRUUAAMx6AACAgQAATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJZkVFAADMegAAqIEAAE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SWRFRQAAzHoAANCB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cHJvcGVydHkEH19lbWJpbmRfcmVnaXN0ZXJfY2xhc3NfZnVuY3Rpb24FFV9lbWJpbmRfcmVnaXN0ZXJfZW51bQYbX2VtYmluZF9yZWdpc3Rlcl9lbnVtX3ZhbHVlBxpfZW1iaW5kX3JlZ2lzdGVyX3NtYXJ0X3B0cggYX19jeGFfYWxsb2NhdGVfZXhjZXB0aW9uCQtfX2N4YV90aHJvdwoRX2VtdmFsX3Rha2VfdmFsdWULDV9lbXZhbF9pbmNyZWYMDV9lbXZhbF9kZWNyZWYNC19lbXZhbF9jYWxsDgVyb3VuZA8EZXhpdBANX19hc3NlcnRfZmFpbBEGX19sb2NrEghfX3VubG9jaxMPX193YXNpX2ZkX2Nsb3NlFApfX3N5c2NhbGw1FQxfX3N5c2NhbGwyMjEWC19fc3lzY2FsbDU0Fw5fX3dhc2lfZmRfcmVhZBgPX193YXNpX2ZkX3dyaXRlGRhfX3dhc2lfZW52aXJvbl9zaXplc19nZXQaEl9fd2FzaV9lbnZpcm9uX2dldBsKX19tYXBfZmlsZRwLX19zeXNjYWxsOTEdCnN0cmZ0aW1lX2weBWFib3J0HxVfZW1iaW5kX3JlZ2lzdGVyX3ZvaWQgFV9lbWJpbmRfcmVnaXN0ZXJfYm9vbCEbX2VtYmluZF9yZWdpc3Rlcl9zdGRfc3RyaW5nIhxfZW1iaW5kX3JlZ2lzdGVyX3N0ZF93c3RyaW5nIxZfZW1iaW5kX3JlZ2lzdGVyX2VtdmFsJBhfZW1iaW5kX3JlZ2lzdGVyX2ludGVnZXIlFl9lbWJpbmRfcmVnaXN0ZXJfZmxvYXQmHF9lbWJpbmRfcmVnaXN0ZXJfbWVtb3J5X3ZpZXcnFmVtc2NyaXB0ZW5fcmVzaXplX2hlYXAoFWVtc2NyaXB0ZW5fbWVtY3B5X2JpZykLc2V0VGVtcFJldDAqGmxlZ2FsaW1wb3J0JF9fd2FzaV9mZF9zZWVrKxFfX3dhc21fY2FsbF9jdG9ycyxQRW1zY3JpcHRlbkJpbmRpbmdJbml0aWFsaXplcl9teV9tb2R1bGU6OkVtc2NyaXB0ZW5CaW5kaW5nSW5pdGlhbGl6ZXJfbXlfbW9kdWxlKCktlQFlbXNjcmlwdGVuOjpjbGFzc188c3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+LCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Tm9CYXNlQ2xhc3M+IGVtc2NyaXB0ZW46OnJlZ2lzdGVyX3ZlY3RvcjxpbnQ+KGNoYXIgY29uc3QqKS6eAWVtc2NyaXB0ZW46OmNsYXNzXzxzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4sIGVtc2NyaXB0ZW46OmludGVybmFsOjpOb0Jhc2VDbGFzcz4gZW1zY3JpcHRlbjo6cmVnaXN0ZXJfdmVjdG9yPGRvdWJsZT4oY2hhciBjb25zdCopL5gBZW1zY3JpcHRlbjo6Y2xhc3NfPHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+LCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Tm9CYXNlQ2xhc3M+IGVtc2NyaXB0ZW46OnJlZ2lzdGVyX3ZlY3RvcjxjaGFyPihjaGFyIGNvbnN0KikwswFlbXNjcmlwdGVuOjpjbGFzc188c3RkOjpfXzI6OnZlY3Rvcjx1bnNpZ25lZCBjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHVuc2lnbmVkIGNoYXI+ID4sIGVtc2NyaXB0ZW46OmludGVybmFsOjpOb0Jhc2VDbGFzcz4gZW1zY3JpcHRlbjo6cmVnaXN0ZXJfdmVjdG9yPHVuc2lnbmVkIGNoYXI+KGNoYXIgY29uc3QqKTGbAWVtc2NyaXB0ZW46OmNsYXNzXzxzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+LCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Tm9CYXNlQ2xhc3M+IGVtc2NyaXB0ZW46OnJlZ2lzdGVyX3ZlY3RvcjxmbG9hdD4oY2hhciBjb25zdCopMkp2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTx2ZWN0b3JUb29scz4odmVjdG9yVG9vbHMqKTNEdm9pZCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6cmF3X2Rlc3RydWN0b3I8dmVjdG9yVG9vbHM+KHZlY3RvclRvb2xzKik0R2Vtc2NyaXB0ZW46OmludGVybmFsOjpJbnZva2VyPHZlY3RvclRvb2xzKj46Omludm9rZSh2ZWN0b3JUb29scyogKCopKCkpNT52ZWN0b3JUb29scyogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzx2ZWN0b3JUb29scz4oKTbgAWVtc2NyaXB0ZW46OmludGVybmFsOjpJbnZva2VyPHZvaWQsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiY+OjppbnZva2Uodm9pZCAoKikoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiksIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiopN1R2ZWN0b3JUb29sczo6Y2xlYXJWZWN0b3JEYmwoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+Jik4THZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlTZXR0aW5ncz4obWF4aVNldHRpbmdzKik5YmVtc2NyaXB0ZW46OmludGVybmFsOjpJbnZva2VyPHZvaWQsIGludCwgaW50LCBpbnQ+OjppbnZva2Uodm9pZCAoKikoaW50LCBpbnQsIGludCksIGludCwgaW50LCBpbnQpOiJtYXhpU2V0dGluZ3M6OnNldHVwKGludCwgaW50LCBpbnQpOyNtYXhpU2V0dGluZ3M6OmdldFNhbXBsZVJhdGUoKSBjb25zdDwgbWF4aVNldHRpbmdzOjpzZXRTYW1wbGVSYXRlKGludCk9kwFpbnQgZW1zY3JpcHRlbjo6aW50ZXJuYWw6OkdldHRlclBvbGljeTxpbnQgKG1heGlTZXR0aW5nczo6KikoKSBjb25zdD46OmdldDxtYXhpU2V0dGluZ3M+KGludCAobWF4aVNldHRpbmdzOjoqIGNvbnN0JikoKSBjb25zdCwgbWF4aVNldHRpbmdzIGNvbnN0Jik+jwF2b2lkIGVtc2NyaXB0ZW46OmludGVybmFsOjpTZXR0ZXJQb2xpY3k8dm9pZCAobWF4aVNldHRpbmdzOjoqKShpbnQpPjo6c2V0PG1heGlTZXR0aW5ncz4odm9pZCAobWF4aVNldHRpbmdzOjoqIGNvbnN0JikoaW50KSwgbWF4aVNldHRpbmdzJiwgaW50KT8kbWF4aVNldHRpbmdzOjpnZXROdW1DaGFubmVscygpIGNvbnN0QCFtYXhpU2V0dGluZ3M6OnNldE51bUNoYW5uZWxzKGludClBI21heGlTZXR0aW5nczo6Z2V0QnVmZmVyU2l6ZSgpIGNvbnN0QiBtYXhpU2V0dGluZ3M6OnNldEJ1ZmZlclNpemUoaW50KUNCdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aU9zYz4obWF4aU9zYyopRDZtYXhpT3NjKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlPc2M+KClFmAFlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlPc2M6OiopKGRvdWJsZSksIGRvdWJsZSwgbWF4aU9zYyosIGRvdWJsZT46Omludm9rZShkb3VibGUgKG1heGlPc2M6OiogY29uc3QmKShkb3VibGUpLCBtYXhpT3NjKiwgZG91YmxlKUbYAWVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aU9zYzo6KikoZG91YmxlLCBkb3VibGUsIGRvdWJsZSksIGRvdWJsZSwgbWF4aU9zYyosIGRvdWJsZSwgZG91YmxlLCBkb3VibGU+OjppbnZva2UoZG91YmxlIChtYXhpT3NjOjoqIGNvbnN0JikoZG91YmxlLCBkb3VibGUsIGRvdWJsZSksIG1heGlPc2MqLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKUe4AWVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aU9zYzo6KikoZG91YmxlLCBkb3VibGUpLCBkb3VibGUsIG1heGlPc2MqLCBkb3VibGUsIGRvdWJsZT46Omludm9rZShkb3VibGUgKG1heGlPc2M6OiogY29uc3QmKShkb3VibGUsIGRvdWJsZSksIG1heGlPc2MqLCBkb3VibGUsIGRvdWJsZSlIfGVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aU9zYzo6KikoKSwgZG91YmxlLCBtYXhpT3NjKj46Omludm9rZShkb3VibGUgKG1heGlPc2M6OiogY29uc3QmKSgpLCBtYXhpT3NjKilJkgFlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChtYXhpT3NjOjoqKShkb3VibGUpLCB2b2lkLCBtYXhpT3NjKiwgZG91YmxlPjo6aW52b2tlKHZvaWQgKG1heGlPc2M6OiogY29uc3QmKShkb3VibGUpLCBtYXhpT3NjKiwgZG91YmxlKUpMdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aUVudmVsb3BlPihtYXhpRW52ZWxvcGUqKUtAbWF4aUVudmVsb3BlKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlFbnZlbG9wZT4oKUyEA2Vtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aUVudmVsb3BlOjoqKShpbnQsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYpLCBkb3VibGUsIG1heGlFbnZlbG9wZSosIGludCwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+Jj46Omludm9rZShkb3VibGUgKG1heGlFbnZlbG9wZTo6KiBjb25zdCYpKGludCwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiksIG1heGlFbnZlbG9wZSosIGludCwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KilNugFlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChtYXhpRW52ZWxvcGU6OiopKGludCwgZG91YmxlKSwgdm9pZCwgbWF4aUVudmVsb3BlKiwgaW50LCBkb3VibGU+OjppbnZva2Uodm9pZCAobWF4aUVudmVsb3BlOjoqIGNvbnN0JikoaW50LCBkb3VibGUpLCBtYXhpRW52ZWxvcGUqLCBpbnQsIGRvdWJsZSlOIm1heGlFbnZlbG9wZTo6Z2V0QW1wbGl0dWRlKCkgY29uc3RPIm1heGlFbnZlbG9wZTo6c2V0QW1wbGl0dWRlKGRvdWJsZSlQIW1heGlFbnZlbG9wZTo6Z2V0VmFsaW5kZXgoKSBjb25zdFEebWF4aUVudmVsb3BlOjpzZXRWYWxpbmRleChpbnQpUk52b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpRGVsYXlsaW5lPihtYXhpRGVsYXlsaW5lKilTQm1heGlEZWxheWxpbmUqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aURlbGF5bGluZT4oKVTkAWVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aURlbGF5bGluZTo6KikoZG91YmxlLCBpbnQsIGRvdWJsZSksIGRvdWJsZSwgbWF4aURlbGF5bGluZSosIGRvdWJsZSwgaW50LCBkb3VibGU+OjppbnZva2UoZG91YmxlIChtYXhpRGVsYXlsaW5lOjoqIGNvbnN0JikoZG91YmxlLCBpbnQsIGRvdWJsZSksIG1heGlEZWxheWxpbmUqLCBkb3VibGUsIGludCwgZG91YmxlKVX4AWVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aURlbGF5bGluZTo6KikoZG91YmxlLCBpbnQsIGRvdWJsZSwgaW50KSwgZG91YmxlLCBtYXhpRGVsYXlsaW5lKiwgZG91YmxlLCBpbnQsIGRvdWJsZSwgaW50Pjo6aW52b2tlKGRvdWJsZSAobWF4aURlbGF5bGluZTo6KiBjb25zdCYpKGRvdWJsZSwgaW50LCBkb3VibGUsIGludCksIG1heGlEZWxheWxpbmUqLCBkb3VibGUsIGludCwgZG91YmxlLCBpbnQpVkh2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpRmlsdGVyPihtYXhpRmlsdGVyKilXPG1heGlGaWx0ZXIqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aUZpbHRlcj4oKVgdbWF4aUZpbHRlcjo6Z2V0Q3V0b2ZmKCkgY29uc3RZHW1heGlGaWx0ZXI6OnNldEN1dG9mZihkb3VibGUpWiBtYXhpRmlsdGVyOjpnZXRSZXNvbmFuY2UoKSBjb25zdFsgbWF4aUZpbHRlcjo6c2V0UmVzb25hbmNlKGRvdWJsZSlcQnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlNaXg+KG1heGlNaXgqKV02bWF4aU1peCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpTWl4PigpXpYDZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAobWF4aU1peDo6KikoZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBkb3VibGUpLCB2b2lkLCBtYXhpTWl4KiwgZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBkb3VibGU+OjppbnZva2Uodm9pZCAobWF4aU1peDo6KiBjb25zdCYpKGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgZG91YmxlKSwgbWF4aU1peCosIGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KiwgZG91YmxlKV+2A2Vtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKG1heGlNaXg6OiopKGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgZG91YmxlLCBkb3VibGUpLCB2b2lkLCBtYXhpTWl4KiwgZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBkb3VibGUsIGRvdWJsZT46Omludm9rZSh2b2lkIChtYXhpTWl4OjoqIGNvbnN0JikoZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBkb3VibGUsIGRvdWJsZSksIG1heGlNaXgqLCBkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiosIGRvdWJsZSwgZG91YmxlKWDWA2Vtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKG1heGlNaXg6OiopKGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSksIHZvaWQsIG1heGlNaXgqLCBkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGRvdWJsZSwgZG91YmxlLCBkb3VibGU+OjppbnZva2Uodm9pZCAobWF4aU1peDo6KiBjb25zdCYpKGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSksIG1heGlNaXgqLCBkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUpYUR2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpTGluZT4obWF4aUxpbmUqKWI4bWF4aUxpbmUqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aUxpbmU+KCljFm1heGlMaW5lOjpwbGF5KGRvdWJsZSlkKW1heGlMaW5lOjpwcmVwYXJlKGRvdWJsZSwgZG91YmxlLCBkb3VibGUpZdYBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAobWF4aUxpbmU6OiopKGRvdWJsZSwgZG91YmxlLCBkb3VibGUpLCB2b2lkLCBtYXhpTGluZSosIGRvdWJsZSwgZG91YmxlLCBkb3VibGU+OjppbnZva2Uodm9pZCAobWF4aUxpbmU6OiogY29uc3QmKShkb3VibGUsIGRvdWJsZSwgZG91YmxlKSwgbWF4aUxpbmUqLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKWYfbWF4aUxpbmU6OnRyaWdnZXJFbmFibGUoZG91YmxlKWcabWF4aUxpbmU6OmlzTGluZUNvbXBsZXRlKCloRnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlYRmFkZT4obWF4aVhGYWRlKilphwRlbXNjcmlwdGVuOjppbnRlcm5hbDo6SW52b2tlcjxzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4sIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGRvdWJsZT46Omludm9rZShzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4gKCopKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGRvdWJsZSksIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiosIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiosIGRvdWJsZSlqigFtYXhpWEZhZGU6OnhmYWRlKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGRvdWJsZSlrgQFlbXNjcmlwdGVuOjppbnRlcm5hbDo6SW52b2tlcjxkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGU+OjppbnZva2UoZG91YmxlICgqKShkb3VibGUsIGRvdWJsZSwgZG91YmxlKSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSlsKG1heGlYRmFkZTo6eGZhZGUoZG91YmxlLCBkb3VibGUsIGRvdWJsZSltWXZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlMYWdFeHA8ZG91YmxlPiA+KG1heGlMYWdFeHA8ZG91YmxlPiopbk1tYXhpTGFnRXhwPGRvdWJsZT4qIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aUxhZ0V4cDxkb3VibGU+ID4oKW8obWF4aUxhZ0V4cDxkb3VibGU+Ojppbml0KGRvdWJsZSwgZG91YmxlKXDeAWVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKG1heGlMYWdFeHA8ZG91YmxlPjo6KikoZG91YmxlLCBkb3VibGUpLCB2b2lkLCBtYXhpTGFnRXhwPGRvdWJsZT4qLCBkb3VibGUsIGRvdWJsZT46Omludm9rZSh2b2lkIChtYXhpTGFnRXhwPGRvdWJsZT46OiogY29uc3QmKShkb3VibGUsIGRvdWJsZSksIG1heGlMYWdFeHA8ZG91YmxlPiosIGRvdWJsZSwgZG91YmxlKXElbWF4aUxhZ0V4cDxkb3VibGU+OjphZGRTYW1wbGUoZG91YmxlKXIhbWF4aUxhZ0V4cDxkb3VibGU+Ojp2YWx1ZSgpIGNvbnN0cyRtYXhpTGFnRXhwPGRvdWJsZT46OmdldEFscGhhKCkgY29uc3R0JG1heGlMYWdFeHA8ZG91YmxlPjo6c2V0QWxwaGEoZG91YmxlKXUubWF4aUxhZ0V4cDxkb3VibGU+OjpnZXRBbHBoYVJlY2lwcm9jYWwoKSBjb25zdHYubWF4aUxhZ0V4cDxkb3VibGU+OjpzZXRBbHBoYVJlY2lwcm9jYWwoZG91YmxlKXcibWF4aUxhZ0V4cDxkb3VibGU+OjpzZXRWYWwoZG91YmxlKXhIdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aVNhbXBsZT4obWF4aVNhbXBsZSopeUJ2b2lkIGVtc2NyaXB0ZW46OmludGVybmFsOjpyYXdfZGVzdHJ1Y3RvcjxtYXhpU2FtcGxlPihtYXhpU2FtcGxlKil6PG1heGlTYW1wbGUqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aVNhbXBsZT4oKXsdbWF4aVNhbXBsZTo6Z2V0TGVuZ3RoKCkgY29uc3R89gJlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChtYXhpU2FtcGxlOjoqKShzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBpbnQpLCB2b2lkLCBtYXhpU2FtcGxlKiwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgaW50Pjo6aW52b2tlKHZvaWQgKG1heGlTYW1wbGU6OiogY29uc3QmKShzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBpbnQpLCBtYXhpU2FtcGxlKiwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KiwgaW50KX2rA2Vtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGludCAobWF4aVNhbXBsZTo6Kikoc3RkOjpfXzI6OnZlY3Rvcjx1bnNpZ25lZCBjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHVuc2lnbmVkIGNoYXI+ID4mLCBpbnQpLCBpbnQsIG1heGlTYW1wbGUqLCBzdGQ6Ol9fMjo6dmVjdG9yPHVuc2lnbmVkIGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8dW5zaWduZWQgY2hhcj4gPiYsIGludD46Omludm9rZShpbnQgKG1heGlTYW1wbGU6OiogY29uc3QmKShzdGQ6Ol9fMjo6dmVjdG9yPHVuc2lnbmVkIGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8dW5zaWduZWQgY2hhcj4gPiYsIGludCksIG1heGlTYW1wbGUqLCBzdGQ6Ol9fMjo6dmVjdG9yPHVuc2lnbmVkIGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8dW5zaWduZWQgY2hhcj4gPiosIGludCl+ggFlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChtYXhpU2FtcGxlOjoqKSgpLCB2b2lkLCBtYXhpU2FtcGxlKj46Omludm9rZSh2b2lkIChtYXhpU2FtcGxlOjoqIGNvbnN0JikoKSwgbWF4aVNhbXBsZSopfxNtYXhpU2FtcGxlOjpjbGVhcigpgAHmAWVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKG1heGlTYW1wbGU6OiopKGZsb2F0LCBmbG9hdCwgYm9vbCwgYm9vbCksIHZvaWQsIG1heGlTYW1wbGUqLCBmbG9hdCwgZmxvYXQsIGJvb2wsIGJvb2w+OjppbnZva2Uodm9pZCAobWF4aVNhbXBsZTo6KiBjb25zdCYpKGZsb2F0LCBmbG9hdCwgYm9vbCwgYm9vbCksIG1heGlTYW1wbGUqLCBmbG9hdCwgZmxvYXQsIGJvb2wsIGJvb2wpgQGjBGVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGJvb2wgKG1heGlTYW1wbGU6OiopKHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4sIGludCksIGJvb2wsIG1heGlTYW1wbGUqLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+LCBpbnQ+OjppbnZva2UoYm9vbCAobWF4aVNhbXBsZTo6KiBjb25zdCYpKHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4sIGludCksIG1heGlTYW1wbGUqLCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6QmluZGluZ1R5cGU8c3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiwgdm9pZD46Oid1bm5hbWVkJyosIGludCmCAUJ2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpTWFwPihtYXhpTWFwKimDATdtYXhpTWFwOjpsaW5saW4oZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUphAHuAWVtc2NyaXB0ZW46OmludGVybmFsOjpGdW5jdGlvbkludm9rZXI8ZG91YmxlICgqKShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSksIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGU+OjppbnZva2UoZG91YmxlICgqKikoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUpLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSmFATdtYXhpTWFwOjpsaW5leHAoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUphgE3bWF4aU1hcDo6ZXhwbGluKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKYcBNWRvdWJsZSBtYXhpTWFwOjpjbGFtcDxkb3VibGU+KGRvdWJsZSwgZG91YmxlLCBkb3VibGUpiAGuAWVtc2NyaXB0ZW46OmludGVybmFsOjpGdW5jdGlvbkludm9rZXI8ZG91YmxlICgqKShkb3VibGUsIGRvdWJsZSwgZG91YmxlKSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlPjo6aW52b2tlKGRvdWJsZSAoKiopKGRvdWJsZSwgZG91YmxlLCBkb3VibGUpLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKYkBsQFlbXNjcmlwdGVuOjppbnRlcm5hbDo6SW52b2tlcjxkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlPjo6aW52b2tlKGRvdWJsZSAoKikoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUpLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSmKAUJ2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpRHluPihtYXhpRHluKimLATZtYXhpRHluKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlEeW4+KCmMAZACZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpRHluOjoqKShkb3VibGUsIGRvdWJsZSwgbG9uZywgZG91YmxlLCBkb3VibGUpLCBkb3VibGUsIG1heGlEeW4qLCBkb3VibGUsIGRvdWJsZSwgbG9uZywgZG91YmxlLCBkb3VibGU+OjppbnZva2UoZG91YmxlIChtYXhpRHluOjoqIGNvbnN0JikoZG91YmxlLCBkb3VibGUsIGxvbmcsIGRvdWJsZSwgZG91YmxlKSwgbWF4aUR5biosIGRvdWJsZSwgZG91YmxlLCBsb25nLCBkb3VibGUsIGRvdWJsZSmNAZgCZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpRHluOjoqKShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSksIGRvdWJsZSwgbWF4aUR5biosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlPjo6aW52b2tlKGRvdWJsZSAobWF4aUR5bjo6KiBjb25zdCYpKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKSwgbWF4aUR5biosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKY4BQnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlFbnY+KG1heGlFbnYqKY8BNm1heGlFbnYqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aUVudj4oKZABhAJlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlFbnY6OiopKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGxvbmcsIGludCksIGRvdWJsZSwgbWF4aUVudiosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGxvbmcsIGludD46Omludm9rZShkb3VibGUgKG1heGlFbnY6OiogY29uc3QmKShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBsb25nLCBpbnQpLCBtYXhpRW52KiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgbG9uZywgaW50KZEBxAJlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlFbnY6OiopKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBsb25nLCBpbnQpLCBkb3VibGUsIG1heGlFbnYqLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgbG9uZywgaW50Pjo6aW52b2tlKGRvdWJsZSAobWF4aUVudjo6KiBjb25zdCYpKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBsb25nLCBpbnQpLCBtYXhpRW52KiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGxvbmcsIGludCmSAawBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpRW52OjoqKShkb3VibGUsIGludCksIGRvdWJsZSwgbWF4aUVudiosIGRvdWJsZSwgaW50Pjo6aW52b2tlKGRvdWJsZSAobWF4aUVudjo6KiBjb25zdCYpKGRvdWJsZSwgaW50KSwgbWF4aUVudiosIGRvdWJsZSwgaW50KZMBG21heGlFbnY6OmdldFRyaWdnZXIoKSBjb25zdJQBGG1heGlFbnY6OnNldFRyaWdnZXIoaW50KZUBQnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPGNvbnZlcnQ+KGNvbnZlcnQqKZYBYmVtc2NyaXB0ZW46OmludGVybmFsOjpGdW5jdGlvbkludm9rZXI8ZG91YmxlICgqKShpbnQpLCBkb3VibGUsIGludD46Omludm9rZShkb3VibGUgKCoqKShpbnQpLCBpbnQplwFIZW1zY3JpcHRlbjo6aW50ZXJuYWw6Okludm9rZXI8ZG91YmxlLCBpbnQ+OjppbnZva2UoZG91YmxlICgqKShpbnQpLCBpbnQpmAEaY29udmVydDo6bXNUb1NhbXBzKGRvdWJsZSmZAW5lbXNjcmlwdGVuOjppbnRlcm5hbDo6RnVuY3Rpb25JbnZva2VyPGRvdWJsZSAoKikoZG91YmxlKSwgZG91YmxlLCBkb3VibGU+OjppbnZva2UoZG91YmxlICgqKikoZG91YmxlKSwgZG91YmxlKZoBUWVtc2NyaXB0ZW46OmludGVybmFsOjpJbnZva2VyPGRvdWJsZSwgZG91YmxlPjo6aW52b2tlKGRvdWJsZSAoKikoZG91YmxlKSwgZG91YmxlKZsBVnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlTYW1wbGVBbmRIb2xkPihtYXhpU2FtcGxlQW5kSG9sZCopnAFKbWF4aVNhbXBsZUFuZEhvbGQqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aVNhbXBsZUFuZEhvbGQ+KCmdASZtYXhpU2FtcGxlQW5kSG9sZDo6c2FoKGRvdWJsZSwgZG91YmxlKZ4BUHZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlEaXN0b3J0aW9uPihtYXhpRGlzdG9ydGlvbiopnwEgbWF4aURpc3RvcnRpb246OmZhc3RhdGFuKGRvdWJsZSmgAShtYXhpRGlzdG9ydGlvbjo6YXRhbkRpc3QoZG91YmxlLCBkb3VibGUpoQEsbWF4aURpc3RvcnRpb246OmZhc3RBdGFuRGlzdChkb3VibGUsIGRvdWJsZSmiAUp2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpRmxhbmdlcj4obWF4aUZsYW5nZXIqKaMBPm1heGlGbGFuZ2VyKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlGbGFuZ2VyPigppAFBbWF4aUZsYW5nZXI6OmZsYW5nZShkb3VibGUsIHVuc2lnbmVkIGludCwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSmlAcACZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpRmxhbmdlcjo6KikoZG91YmxlLCB1bnNpZ25lZCBpbnQsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUpLCBkb3VibGUsIG1heGlGbGFuZ2VyKiwgZG91YmxlLCB1bnNpZ25lZCBpbnQsIGRvdWJsZSwgZG91YmxlLCBkb3VibGU+OjppbnZva2UoZG91YmxlIChtYXhpRmxhbmdlcjo6KiBjb25zdCYpKGRvdWJsZSwgdW5zaWduZWQgaW50LCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKSwgbWF4aUZsYW5nZXIqLCBkb3VibGUsIHVuc2lnbmVkIGludCwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSmmAUh2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpQ2hvcnVzPihtYXhpQ2hvcnVzKimnATxtYXhpQ2hvcnVzKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlDaG9ydXM+KCmoAUBtYXhpQ2hvcnVzOjpjaG9ydXMoZG91YmxlLCB1bnNpZ25lZCBpbnQsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUpqQFOdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aURDQmxvY2tlcj4obWF4aURDQmxvY2tlciopqgFCbWF4aURDQmxvY2tlciogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpRENCbG9ja2VyPigpqwEjbWF4aURDQmxvY2tlcjo6cGxheShkb3VibGUsIGRvdWJsZSmsAUJ2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpU1ZGPihtYXhpU1ZGKimtATZtYXhpU1ZGKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlTVkY+KCmuARptYXhpU1ZGOjpzZXRDdXRvZmYoZG91YmxlKa8BHW1heGlTVkY6OnNldFJlc29uYW5jZShkb3VibGUpsAE1bWF4aVNWRjo6cGxheShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSmxAUR2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpTWF0aD4obWF4aU1hdGgqKbIBaWVtc2NyaXB0ZW46OmludGVybmFsOjpJbnZva2VyPGRvdWJsZSwgZG91YmxlLCBkb3VibGU+OjppbnZva2UoZG91YmxlICgqKShkb3VibGUsIGRvdWJsZSksIGRvdWJsZSwgZG91YmxlKbMBHW1heGlNYXRoOjphZGQoZG91YmxlLCBkb3VibGUptAEdbWF4aU1hdGg6OnN1Yihkb3VibGUsIGRvdWJsZSm1AR1tYXhpTWF0aDo6bXVsKGRvdWJsZSwgZG91YmxlKbYBHW1heGlNYXRoOjpkaXYoZG91YmxlLCBkb3VibGUptwEcbWF4aU1hdGg6Omd0KGRvdWJsZSwgZG91YmxlKbgBHG1heGlNYXRoOjpsdChkb3VibGUsIGRvdWJsZSm5AR1tYXhpTWF0aDo6Z3RlKGRvdWJsZSwgZG91YmxlKboBHW1heGlNYXRoOjpsdGUoZG91YmxlLCBkb3VibGUpuwEdbWF4aU1hdGg6Om1vZChkb3VibGUsIGRvdWJsZSm8ARVtYXhpTWF0aDo6YWJzKGRvdWJsZSm9AR9tYXhpTWF0aDo6eHBvd3koZG91YmxlLCBkb3VibGUpvgFGdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aUNsb2NrPihtYXhpQ2xvY2sqKb8BOm1heGlDbG9jayogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpQ2xvY2s+KCnAARltYXhpQ2xvY2s6OmlzVGljaygpIGNvbnN0wQEibWF4aUNsb2NrOjpnZXRDdXJyZW50Q291bnQoKSBjb25zdMIBH21heGlDbG9jazo6c2V0Q3VycmVudENvdW50KGludCnDAR9tYXhpQ2xvY2s6OmdldExhc3RDb3VudCgpIGNvbnN0xAEcbWF4aUNsb2NrOjpzZXRMYXN0Q291bnQoaW50KcUBGW1heGlDbG9jazo6Z2V0QnBzKCkgY29uc3TGARZtYXhpQ2xvY2s6OnNldEJwcyhpbnQpxwEZbWF4aUNsb2NrOjpnZXRCcG0oKSBjb25zdMgBFm1heGlDbG9jazo6c2V0QnBtKGludCnJARdtYXhpQ2xvY2s6OnNldFRpY2soaW50KcoBG21heGlDbG9jazo6Z2V0VGlja3MoKSBjb25zdMsBGG1heGlDbG9jazo6c2V0VGlja3MoaW50KcwBYHZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlLdXJhbW90b09zY2lsbGF0b3I+KG1heGlLdXJhbW90b09zY2lsbGF0b3IqKc0BVG1heGlLdXJhbW90b09zY2lsbGF0b3IqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aUt1cmFtb3RvT3NjaWxsYXRvcj4oKc4BZG1heGlLdXJhbW90b09zY2lsbGF0b3I6OnBsYXkoZG91YmxlLCBkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPinPAdYDZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yOjoqKShkb3VibGUsIGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KSwgZG91YmxlLCBtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yKiwgZG91YmxlLCBkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiA+OjppbnZva2UoZG91YmxlIChtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yOjoqIGNvbnN0JikoZG91YmxlLCBkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiksIG1heGlLdXJhbW90b09zY2lsbGF0b3IqLCBkb3VibGUsIGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KinQAWZ2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0PihtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0KinRAWB2b2lkIGVtc2NyaXB0ZW46OmludGVybmFsOjpyYXdfZGVzdHJ1Y3RvcjxtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0PihtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0KinSAZ4BZW1zY3JpcHRlbjo6aW50ZXJuYWw6Okludm9rZXI8bWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldCosIHVuc2lnbmVkIGxvbmcgY29uc3QmJj46Omludm9rZShtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0KiAoKikodW5zaWduZWQgbG9uZyBjb25zdCYmKSwgdW5zaWduZWQgbG9uZynTAYQBbWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0LCB1bnNpZ25lZCBsb25nIGNvbnN0Pih1bnNpZ25lZCBsb25nIGNvbnN0JiYp1AEvbWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldDo6cGxheShkb3VibGUsIGRvdWJsZSnVATptYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0OjpzZXRQaGFzZShkb3VibGUsIHVuc2lnbmVkIGxvbmcp1gGWAmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQ6OiopKGRvdWJsZSwgdW5zaWduZWQgbG9uZyksIHZvaWQsIG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQqLCBkb3VibGUsIHVuc2lnbmVkIGxvbmc+OjppbnZva2Uodm9pZCAobWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldDo6KiBjb25zdCYpKGRvdWJsZSwgdW5zaWduZWQgbG9uZyksIG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQqLCBkb3VibGUsIHVuc2lnbmVkIGxvbmcp1wFjbWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldDo6c2V0UGhhc2VzKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiBjb25zdCYp2AEybWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldDo6Z2V0UGhhc2UodW5zaWduZWQgbG9uZynZAfwBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0OjoqKSh1bnNpZ25lZCBsb25nKSwgZG91YmxlLCBtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0KiwgdW5zaWduZWQgbG9uZz46Omludm9rZShkb3VibGUgKG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQ6OiogY29uc3QmKSh1bnNpZ25lZCBsb25nKSwgbWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldCosIHVuc2lnbmVkIGxvbmcp2gEhbWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldDo6c2l6ZSgp2wFqdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aUFzeW5jS3VyYW1vdG9Pc2NpbGxhdG9yPihtYXhpQXN5bmNLdXJhbW90b09zY2lsbGF0b3IqKdwBrAFtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0KiBlbXNjcmlwdGVuOjpiYXNlPG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQ+Ojpjb252ZXJ0UG9pbnRlcjxtYXhpQXN5bmNLdXJhbW90b09zY2lsbGF0b3IsIG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQ+KG1heGlBc3luY0t1cmFtb3RvT3NjaWxsYXRvciop3QGIAW1heGlBc3luY0t1cmFtb3RvT3NjaWxsYXRvciogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpQXN5bmNLdXJhbW90b09zY2lsbGF0b3IsIHVuc2lnbmVkIGxvbmcgY29uc3Q+KHVuc2lnbmVkIGxvbmcgY29uc3QmJineATFtYXhpQXN5bmNLdXJhbW90b09zY2lsbGF0b3I6OnBsYXkoZG91YmxlLCBkb3VibGUp3wE8bWF4aUFzeW5jS3VyYW1vdG9Pc2NpbGxhdG9yOjpzZXRQaGFzZShkb3VibGUsIHVuc2lnbmVkIGxvbmcp4AFlbWF4aUFzeW5jS3VyYW1vdG9Pc2NpbGxhdG9yOjpzZXRQaGFzZXMoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+IGNvbnN0JinhAUJ2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpRkZUPihtYXhpRkZUKiniATx2b2lkIGVtc2NyaXB0ZW46OmludGVybmFsOjpyYXdfZGVzdHJ1Y3RvcjxtYXhpRkZUPihtYXhpRkZUKinjATZtYXhpRkZUKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlGRlQ+KCnkAa4BZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAobWF4aUZGVDo6KikoaW50LCBpbnQsIGludCksIHZvaWQsIG1heGlGRlQqLCBpbnQsIGludCwgaW50Pjo6aW52b2tlKHZvaWQgKG1heGlGRlQ6OiogY29uc3QmKShpbnQsIGludCwgaW50KSwgbWF4aUZGVCosIGludCwgaW50LCBpbnQp5QHaAWVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGJvb2wgKG1heGlGRlQ6OiopKGZsb2F0LCBtYXhpRkZUOjpmZnRNb2RlcyksIGJvb2wsIG1heGlGRlQqLCBmbG9hdCwgbWF4aUZGVDo6ZmZ0TW9kZXM+OjppbnZva2UoYm9vbCAobWF4aUZGVDo6KiBjb25zdCYpKGZsb2F0LCBtYXhpRkZUOjpmZnRNb2RlcyksIG1heGlGRlQqLCBmbG9hdCwgbWF4aUZGVDo6ZmZ0TW9kZXMp5gF5ZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZmxvYXQgKG1heGlGRlQ6OiopKCksIGZsb2F0LCBtYXhpRkZUKj46Omludm9rZShmbG9hdCAobWF4aUZGVDo6KiBjb25zdCYpKCksIG1heGlGRlQqKecBiQJlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+JiAobWF4aUZGVDo6KikoKSwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiYsIG1heGlGRlQqPjo6aW52b2tlKHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mIChtYXhpRkZUOjoqIGNvbnN0JikoKSwgbWF4aUZGVCop6AEabWF4aUZGVDo6Z2V0TWFnbml0dWRlc0RCKCnpARRtYXhpRkZUOjpnZXRQaGFzZXMoKeoBFW1heGlGRlQ6OmdldE51bUJpbnMoKesBFW1heGlGRlQ6OmdldEZGVFNpemUoKewBFW1heGlGRlQ6OmdldEhvcFNpemUoKe0BGG1heGlGRlQ6OmdldFdpbmRvd1NpemUoKe4BRHZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlJRkZUPihtYXhpSUZGVCop7wE+dm9pZCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6cmF3X2Rlc3RydWN0b3I8bWF4aUlGRlQ+KG1heGlJRkZUKinwAThtYXhpSUZGVCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpSUZGVD4oKfEBgQVlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxmbG9hdCAobWF4aUlGRlQ6OiopKHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mLCBzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+JiwgbWF4aUlGRlQ6OmZmdE1vZGVzKSwgZmxvYXQsIG1heGlJRkZUKiwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiYsIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mLCBtYXhpSUZGVDo6ZmZ0TW9kZXM+OjppbnZva2UoZmxvYXQgKG1heGlJRkZUOjoqIGNvbnN0Jikoc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiYsIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mLCBtYXhpSUZGVDo6ZmZ0TW9kZXMpLCBtYXhpSUZGVCosIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4qLCBzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+KiwgbWF4aUlGRlQ6OmZmdE1vZGVzKfIBZXZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPiA+KG1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPiop8wFfdm9pZCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6cmF3X2Rlc3RydWN0b3I8bWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+ID4obWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+Kin0AVltYXhpTUZDQ0FuYWx5c2VyPGRvdWJsZT4qIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+ID4oKfUBWW1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPjo6c2V0dXAodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgZG91YmxlLCBkb3VibGUp9gGeA2Vtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKG1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPjo6KikodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgZG91YmxlLCBkb3VibGUpLCB2b2lkLCBtYXhpTUZDQ0FuYWx5c2VyPGRvdWJsZT4qLCB1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50LCBkb3VibGUsIGRvdWJsZT46Omludm9rZSh2b2lkIChtYXhpTUZDQ0FuYWx5c2VyPGRvdWJsZT46OiogY29uc3QmKSh1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50LCBkb3VibGUsIGRvdWJsZSksIG1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPiosIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQsIGRvdWJsZSwgZG91YmxlKfcBVW1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPjo6bWZjYyhzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+Jin4AasEZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8c3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiAobWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+OjoqKShzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+JiksIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIG1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPiosIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mPjo6aW52b2tlKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYgKG1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPjo6KiBjb25zdCYpKHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mKSwgbWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+Kiwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiop+QGVAXZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiA+KHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiop+gGPAXZvaWQgZW1zY3JpcHRlbjo6aW50ZXJuYWw6OnJhd19kZXN0cnVjdG9yPHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiA+KHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiop+wGJAXN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4gPigp/AFHc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+OjpwdXNoX2JhY2soaW50IGNvbnN0Jin9Ab8CZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAoc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+OjoqKShpbnQgY29uc3QmKSwgdm9pZCwgc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+KiwgaW50IGNvbnN0Jj46Omludm9rZSh2b2lkIChzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID46OiogY29uc3QmKShpbnQgY29uc3QmKSwgc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+KiwgaW50Kf4BU3N0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPjo6cmVzaXplKHVuc2lnbmVkIGxvbmcsIGludCBjb25zdCYp/wH7AmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPjo6KikodW5zaWduZWQgbG9uZywgaW50IGNvbnN0JiksIHZvaWQsIHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiosIHVuc2lnbmVkIGxvbmcsIGludCBjb25zdCY+OjppbnZva2Uodm9pZCAoc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+OjoqIGNvbnN0JikodW5zaWduZWQgbG9uZywgaW50IGNvbnN0JiksIHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiosIHVuc2lnbmVkIGxvbmcsIGludCmAAj5zdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID46OnNpemUoKSBjb25zdIECogFlbXNjcmlwdGVuOjppbnRlcm5hbDo6VmVjdG9yQWNjZXNzPHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiA+OjpnZXQoc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+IGNvbnN0JiwgdW5zaWduZWQgbG9uZymCAoMDZW1zY3JpcHRlbjo6aW50ZXJuYWw6OkZ1bmN0aW9uSW52b2tlcjxlbXNjcmlwdGVuOjp2YWwgKCopKHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiBjb25zdCYsIHVuc2lnbmVkIGxvbmcpLCBlbXNjcmlwdGVuOjp2YWwsIHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiBjb25zdCYsIHVuc2lnbmVkIGxvbmc+OjppbnZva2UoZW1zY3JpcHRlbjo6dmFsICgqKikoc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+IGNvbnN0JiwgdW5zaWduZWQgbG9uZyksIHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiosIHVuc2lnbmVkIGxvbmcpgwKoAWVtc2NyaXB0ZW46OmludGVybmFsOjpWZWN0b3JBY2Nlc3M8c3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+ID46OnNldChzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4mLCB1bnNpZ25lZCBsb25nLCBpbnQgY29uc3QmKYQC+QJlbXNjcmlwdGVuOjppbnRlcm5hbDo6RnVuY3Rpb25JbnZva2VyPGJvb2wgKCopKHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiYsIHVuc2lnbmVkIGxvbmcsIGludCBjb25zdCYpLCBib29sLCBzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4mLCB1bnNpZ25lZCBsb25nLCBpbnQgY29uc3QmPjo6aW52b2tlKGJvb2wgKCoqKShzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4mLCB1bnNpZ25lZCBsb25nLCBpbnQgY29uc3QmKSwgc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+KiwgdW5zaWduZWQgbG9uZywgaW50KYUCoQF2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4gPihzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4qKYYCUHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPjo6cHVzaF9iYWNrKGRvdWJsZSBjb25zdCYphwLjAmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPjo6KikoZG91YmxlIGNvbnN0JiksIHZvaWQsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiosIGRvdWJsZSBjb25zdCY+OjppbnZva2Uodm9pZCAoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+OjoqIGNvbnN0JikoZG91YmxlIGNvbnN0JiksIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiosIGRvdWJsZSmIAlxzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID46OnJlc2l6ZSh1bnNpZ25lZCBsb25nLCBkb3VibGUgY29uc3QmKYkCnwNlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID46OiopKHVuc2lnbmVkIGxvbmcsIGRvdWJsZSBjb25zdCYpLCB2b2lkLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4qLCB1bnNpZ25lZCBsb25nLCBkb3VibGUgY29uc3QmPjo6aW52b2tlKHZvaWQgKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPjo6KiBjb25zdCYpKHVuc2lnbmVkIGxvbmcsIGRvdWJsZSBjb25zdCYpLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4qLCB1bnNpZ25lZCBsb25nLCBkb3VibGUpigJEc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+OjpzaXplKCkgY29uc3SLAq4BZW1zY3JpcHRlbjo6aW50ZXJuYWw6OlZlY3RvckFjY2VzczxzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4gPjo6Z2V0KHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiBjb25zdCYsIHVuc2lnbmVkIGxvbmcpjAK3AWVtc2NyaXB0ZW46OmludGVybmFsOjpWZWN0b3JBY2Nlc3M8c3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+ID46OnNldChzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCB1bnNpZ25lZCBsb25nLCBkb3VibGUgY29uc3QmKY0CnQNlbXNjcmlwdGVuOjppbnRlcm5hbDo6RnVuY3Rpb25JbnZva2VyPGJvb2wgKCopKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIHVuc2lnbmVkIGxvbmcsIGRvdWJsZSBjb25zdCYpLCBib29sLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCB1bnNpZ25lZCBsb25nLCBkb3VibGUgY29uc3QmPjo6aW52b2tlKGJvb2wgKCoqKShzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCB1bnNpZ25lZCBsb25nLCBkb3VibGUgY29uc3QmKSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KiwgdW5zaWduZWQgbG9uZywgZG91YmxlKY4CmQF2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiA+KHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+KimPAkpzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6cHVzaF9iYWNrKGNoYXIgY29uc3QmKZACywJlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6KikoY2hhciBjb25zdCYpLCB2b2lkLCBzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiosIGNoYXIgY29uc3QmPjo6aW52b2tlKHZvaWQgKHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjoqIGNvbnN0JikoY2hhciBjb25zdCYpLCBzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiosIGNoYXIpkQJWc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OnJlc2l6ZSh1bnNpZ25lZCBsb25nLCBjaGFyIGNvbnN0JimSAocDZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAoc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OiopKHVuc2lnbmVkIGxvbmcsIGNoYXIgY29uc3QmKSwgdm9pZCwgc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4qLCB1bnNpZ25lZCBsb25nLCBjaGFyIGNvbnN0Jj46Omludm9rZSh2b2lkIChzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6KiBjb25zdCYpKHVuc2lnbmVkIGxvbmcsIGNoYXIgY29uc3QmKSwgc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4qLCB1bnNpZ25lZCBsb25nLCBjaGFyKZMCQHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpzaXplKCkgY29uc3SUAqYBZW1zY3JpcHRlbjo6aW50ZXJuYWw6OlZlY3RvckFjY2VzczxzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiA+OjpnZXQoc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QmLCB1bnNpZ25lZCBsb25nKZUCrQFlbXNjcmlwdGVuOjppbnRlcm5hbDo6VmVjdG9yQWNjZXNzPHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+ID46OnNldChzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiYsIHVuc2lnbmVkIGxvbmcsIGNoYXIgY29uc3QmKZYChQNlbXNjcmlwdGVuOjppbnRlcm5hbDo6RnVuY3Rpb25JbnZva2VyPGJvb2wgKCopKHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+JiwgdW5zaWduZWQgbG9uZywgY2hhciBjb25zdCYpLCBib29sLCBzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiYsIHVuc2lnbmVkIGxvbmcsIGNoYXIgY29uc3QmPjo6aW52b2tlKGJvb2wgKCoqKShzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiYsIHVuc2lnbmVkIGxvbmcsIGNoYXIgY29uc3QmKSwgc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4qLCB1bnNpZ25lZCBsb25nLCBjaGFyKZcCvQF2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxzdGQ6Ol9fMjo6dmVjdG9yPHVuc2lnbmVkIGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8dW5zaWduZWQgY2hhcj4gPiA+KHN0ZDo6X18yOjp2ZWN0b3I8dW5zaWduZWQgY2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjx1bnNpZ25lZCBjaGFyPiA+KimYAsoBZW1zY3JpcHRlbjo6aW50ZXJuYWw6OlZlY3RvckFjY2VzczxzdGQ6Ol9fMjo6dmVjdG9yPHVuc2lnbmVkIGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8dW5zaWduZWQgY2hhcj4gPiA+OjpnZXQoc3RkOjpfXzI6OnZlY3Rvcjx1bnNpZ25lZCBjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHVuc2lnbmVkIGNoYXI+ID4gY29uc3QmLCB1bnNpZ25lZCBsb25nKZkCnQF2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+ID4oc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiopmgLXAmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID46OiopKGZsb2F0IGNvbnN0JiksIHZvaWQsIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4qLCBmbG9hdCBjb25zdCY+OjppbnZva2Uodm9pZCAoc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPjo6KiBjb25zdCYpKGZsb2F0IGNvbnN0JiksIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4qLCBmbG9hdCmbApMDZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAoc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPjo6KikodW5zaWduZWQgbG9uZywgZmxvYXQgY29uc3QmKSwgdm9pZCwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiosIHVuc2lnbmVkIGxvbmcsIGZsb2F0IGNvbnN0Jj46Omludm9rZSh2b2lkIChzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+OjoqIGNvbnN0JikodW5zaWduZWQgbG9uZywgZmxvYXQgY29uc3QmKSwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiosIHVuc2lnbmVkIGxvbmcsIGZsb2F0KZwCqgFlbXNjcmlwdGVuOjppbnRlcm5hbDo6VmVjdG9yQWNjZXNzPHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4gPjo6Z2V0KHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4gY29uc3QmLCB1bnNpZ25lZCBsb25nKZ0CkQNlbXNjcmlwdGVuOjppbnRlcm5hbDo6RnVuY3Rpb25JbnZva2VyPGJvb2wgKCopKHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mLCB1bnNpZ25lZCBsb25nLCBmbG9hdCBjb25zdCYpLCBib29sLCBzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+JiwgdW5zaWduZWQgbG9uZywgZmxvYXQgY29uc3QmPjo6aW52b2tlKGJvb2wgKCoqKShzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+JiwgdW5zaWduZWQgbG9uZywgZmxvYXQgY29uc3QmKSwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiosIHVuc2lnbmVkIGxvbmcsIGZsb2F0KZ4CXnN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPjo6X19hcHBlbmQodW5zaWduZWQgbG9uZywgZG91YmxlIGNvbnN0JimfAjhtYXhpTUZDQ0FuYWx5c2VyPGRvdWJsZT46OmNhbGNNZWxGaWx0ZXJCYW5rKGRvdWJsZSwgaW50KaACZkVtc2NyaXB0ZW5CaW5kaW5nSW5pdGlhbGl6ZXJfbXlfbW9kdWxlX21heGlHcmFpbnM6OkVtc2NyaXB0ZW5CaW5kaW5nSW5pdGlhbGl6ZXJfbXlfbW9kdWxlX21heGlHcmFpbnMoKaECc3ZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPihtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KimiAm12b2lkIGVtc2NyaXB0ZW46OmludGVybmFsOjpyYXdfZGVzdHJ1Y3RvcjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4obWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiopowKYAWVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6Z2V0KHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiBjb25zdCYppAJmZW1zY3JpcHRlbjo6c21hcnRfcHRyX3RyYWl0PHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojpjb25zdHJ1Y3RfbnVsbCgppQKdAWVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6c2hhcmUobWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGVtc2NyaXB0ZW46OmludGVybmFsOjpfRU1fVkFMKimmApsBdm9pZCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6cmF3X2Rlc3RydWN0b3I8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID4oc3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+KimnApwBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Okludm9rZXI8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46Omludm9rZShzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gKCopKCkpqALCAXN0ZDo6X18yOjplbmFibGVfaWY8IShpc19hcnJheTxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID46OnZhbHVlKSwgc3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46OnR5cGUgc3RkOjpfXzI6Om1ha2Vfc2hhcmVkPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPigpqQI3bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6c2V0U2FtcGxlKG1heGlTYW1wbGUqKaoCOG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OmdldE5vcm1hbGlzZWRQb3NpdGlvbigpqwI0bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6c2V0UG9zaXRpb24oZG91YmxlKawCQm1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OnBsYXkoZG91YmxlLCBkb3VibGUsIGludCwgZG91YmxlKa0CzAJlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OiopKGRvdWJsZSwgZG91YmxlLCBpbnQsIGRvdWJsZSksIGRvdWJsZSwgbWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGRvdWJsZSwgZG91YmxlLCBpbnQsIGRvdWJsZT46Omludm9rZShkb3VibGUgKG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OiogY29uc3QmKShkb3VibGUsIGRvdWJsZSwgaW50LCBkb3VibGUpLCBtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KiwgZG91YmxlLCBkb3VibGUsIGludCwgZG91YmxlKa4CRG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OnBsYXlBdFBvc2l0aW9uKGRvdWJsZSwgZG91YmxlLCBpbnQprwKsAmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6KikoZG91YmxlLCBkb3VibGUsIGludCksIGRvdWJsZSwgbWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGRvdWJsZSwgZG91YmxlLCBpbnQ+OjppbnZva2UoZG91YmxlIChtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+OjoqIGNvbnN0JikoZG91YmxlLCBkb3VibGUsIGludCksIG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qLCBkb3VibGUsIGRvdWJsZSwgaW50KbACcXZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+KG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiopsQJrdm9pZCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6cmF3X2Rlc3RydWN0b3I8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4obWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+KimyApsBZW1zY3JpcHRlbjo6c21hcnRfcHRyX3RyYWl0PHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+ID46OnNoYXJlKG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiosIGVtc2NyaXB0ZW46OmludGVybmFsOjpfRU1fVkFMKimzAr8Bc3RkOjpfXzI6OmVuYWJsZV9pZjwhKGlzX2FycmF5PG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+Ojp2YWx1ZSksIHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+ID46OnR5cGUgc3RkOjpfXzI6Om1ha2Vfc2hhcmVkPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+KCm0AjZtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj46OnNldFNhbXBsZShtYXhpU2FtcGxlKim1AkFtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj46OnBsYXkoZG91YmxlLCBkb3VibGUsIGludCwgZG91YmxlKbYCa3ZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+KG1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPioptwJfbWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+KCm4AjNtYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OnNldFNhbXBsZShtYXhpU2FtcGxlKim5AjFtYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OnNldExvb3BTdGFydChkb3VibGUpugIvbWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+OjpzZXRMb29wRW5kKGRvdWJsZSm7AiltYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OmdldExvb3BFbmQoKbwCRm1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6cGxheShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBpbnQsIGRvdWJsZSm9AtwCZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OiopKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGludCwgZG91YmxlKSwgZG91YmxlLCBtYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBpbnQsIGRvdWJsZT46Omludm9rZShkb3VibGUgKG1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6KiBjb25zdCYpKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGludCwgZG91YmxlKSwgbWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgaW50LCBkb3VibGUpvgJIbWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+OjpwbGF5QXRQb3NpdGlvbihkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBpbnQpvwK8AmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+OjoqKShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBpbnQpLCBkb3VibGUsIG1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGludD46Omludm9rZShkb3VibGUgKG1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6KiBjb25zdCYpKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGludCksIG1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGludCnAAnBtYXhpR3JhaW48aGFubldpbkZ1bmN0b3I+OjptYXhpR3JhaW4obWF4aVNhbXBsZSosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIG1heGlHcmFpbldpbmRvd0NhY2hlPGhhbm5XaW5GdW5jdG9yPiopwQJiRW1zY3JpcHRlbkJpbmRpbmdJbml0aWFsaXplcl9teV9tb2R1bGVfbWF4aWJpdHM6OkVtc2NyaXB0ZW5CaW5kaW5nSW5pdGlhbGl6ZXJfbXlfbW9kdWxlX21heGliaXRzKCnCAkR2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpQml0cz4obWF4aUJpdHMqKcMCb2Vtc2NyaXB0ZW46OmludGVybmFsOjpJbnZva2VyPHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50Pjo6aW52b2tlKHVuc2lnbmVkIGludCAoKikodW5zaWduZWQgaW50KSwgdW5zaWduZWQgaW50KcQCmQFlbXNjcmlwdGVuOjppbnRlcm5hbDo6SW52b2tlcjx1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50Pjo6aW52b2tlKHVuc2lnbmVkIGludCAoKikodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQpLCB1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCnFAihtYXhpQml0czo6YXQodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQpxgIpbWF4aUJpdHM6OnNobCh1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCnHAiltYXhpQml0czo6c2hyKHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KcgCwwFlbXNjcmlwdGVuOjppbnRlcm5hbDo6SW52b2tlcjx1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQ+OjppbnZva2UodW5zaWduZWQgaW50ICgqKSh1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KSwgdW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCnJAjVtYXhpQml0czo6cih1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KcoCKm1heGlCaXRzOjpsYW5kKHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KcsCKW1heGlCaXRzOjpsb3IodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQpzAIqbWF4aUJpdHM6Omx4b3IodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQpzQIbbWF4aUJpdHM6Om5lZyh1bnNpZ25lZCBpbnQpzgIbbWF4aUJpdHM6OmluYyh1bnNpZ25lZCBpbnQpzwIbbWF4aUJpdHM6OmRlYyh1bnNpZ25lZCBpbnQp0AIpbWF4aUJpdHM6OmFkZCh1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCnRAiltYXhpQml0czo6c3ViKHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KdICKW1heGlCaXRzOjptdWwodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQp0wIpbWF4aUJpdHM6OmRpdih1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCnUAihtYXhpQml0czo6Z3QodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQp1QIobWF4aUJpdHM6Omx0KHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KdYCKW1heGlCaXRzOjpndGUodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQp1wIpbWF4aUJpdHM6Omx0ZSh1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCnYAihtYXhpQml0czo6ZXEodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQp2QIRbWF4aUJpdHM6Om5vaXNlKCnaAiBtYXhpQml0czo6dG9TaWduYWwodW5zaWduZWQgaW50KdsCJG1heGlCaXRzOjp0b1RyaWdTaWduYWwodW5zaWduZWQgaW50KdwCXWVtc2NyaXB0ZW46OmludGVybmFsOjpJbnZva2VyPHVuc2lnbmVkIGludCwgZG91YmxlPjo6aW52b2tlKHVuc2lnbmVkIGludCAoKikoZG91YmxlKSwgZG91YmxlKd0CHG1heGlCaXRzOjpmcm9tU2lnbmFsKGRvdWJsZSneAkp2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpVHJpZ2dlcj4obWF4aVRyaWdnZXIqKd8CPm1heGlUcmlnZ2VyKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlUcmlnZ2VyPigp4AIZbWF4aVRyaWdnZXI6Om9uWlgoZG91YmxlKeECJm1heGlUcmlnZ2VyOjpvbkNoYW5nZWQoZG91YmxlLCBkb3VibGUp4gJKdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aUNvdW50ZXI+KG1heGlDb3VudGVyKinjAj5tYXhpQ291bnRlciogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpQ291bnRlcj4oKeQCIm1heGlDb3VudGVyOjpjb3VudChkb3VibGUsIGRvdWJsZSnlAkZ2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpSW5kZXg+KG1heGlJbmRleCop5gI6bWF4aUluZGV4KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlJbmRleD4oKecCV21heGlJbmRleDo6cHVsbChkb3VibGUsIGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KegCTHZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlSYXRpb1NlcT4obWF4aVJhdGlvU2VxKinpAlZtYXhpUmF0aW9TZXE6OnBsYXlUcmlnKGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KeoCjgNlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlSYXRpb1NlcTo6KikoZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4pLCBkb3VibGUsIG1heGlSYXRpb1NlcSosIGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+ID46Omludm9rZShkb3VibGUgKG1heGlSYXRpb1NlcTo6KiBjb25zdCYpKGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KSwgbWF4aVJhdGlvU2VxKiwgZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4qKesCkAFtYXhpUmF0aW9TZXE6OnBsYXlWYWx1ZXMoZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4sIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPinsAu8EZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpUmF0aW9TZXE6OiopKGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+LCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4pLCBkb3VibGUsIG1heGlSYXRpb1NlcSosIGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+LCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4gPjo6aW52b2tlKGRvdWJsZSAobWF4aVJhdGlvU2VxOjoqIGNvbnN0JikoZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4sIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiksIG1heGlSYXRpb1NlcSosIGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+Kiwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KintAitzdGQ6Ol9fMjo6X190aHJvd19sZW5ndGhfZXJyb3IoY2hhciBjb25zdCop7gJkdm9pZCBzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID46Ol9fcHVzaF9iYWNrX3Nsb3dfcGF0aDxpbnQgY29uc3QmPihpbnQgY29uc3QmKe8CVXN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPjo6X19hcHBlbmQodW5zaWduZWQgbG9uZywgaW50IGNvbnN0JinwAnB2b2lkIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPjo6X19wdXNoX2JhY2tfc2xvd19wYXRoPGRvdWJsZSBjb25zdCY+KGRvdWJsZSBjb25zdCYp8QJYc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46Ol9fYXBwZW5kKHVuc2lnbmVkIGxvbmcsIGNoYXIgY29uc3QmKfICb3N0ZDo6X18yOjp2ZWN0b3I8bWF4aUt1cmFtb3RvT3NjaWxsYXRvciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yPiA+OjpfX2FwcGVuZCh1bnNpZ25lZCBsb25nKfMCT3N0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPjo6X19hcHBlbmQodW5zaWduZWQgbG9uZyn0AhNtYXhpRkZUOjp+bWF4aUZGVCgp9QIzbWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6fm1heGlUaW1lU3RyZXRjaCgp9gKABHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+LCBlbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46OnZhbF9kZWxldGVyPihtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KiwgZW1zY3JpcHRlbjo6c21hcnRfcHRyX3RyYWl0PHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp2YWxfZGVsZXRlciwgc3RkOjpfXzI6OmVuYWJsZV9pZjxpc19jb252ZXJ0aWJsZTxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KiwgbWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPio+Ojp2YWx1ZSwgc3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+OjpfX25hdD46OnR5cGUp9wJ6ZW1zY3JpcHRlbjo6c21hcnRfcHRyX3RyYWl0PHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp2YWxfZGVsZXRlcjo6b3BlcmF0b3IoKSh2b2lkIGNvbnN0Kin4AvQBc3RkOjpfXzI6Ol9fc2hhcmVkX3B0cl9wb2ludGVyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qLCBlbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46OnZhbF9kZWxldGVyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp+X19zaGFyZWRfcHRyX3BvaW50ZXIoKfkC9gFzdGQ6Ol9fMjo6X19zaGFyZWRfcHRyX3BvaW50ZXI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6dmFsX2RlbGV0ZXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46On5fX3NoYXJlZF9wdHJfcG9pbnRlcigpLjH6Au8Bc3RkOjpfXzI6Ol9fc2hhcmVkX3B0cl9wb2ludGVyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qLCBlbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46OnZhbF9kZWxldGVyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+OjpfX29uX3plcm9fc2hhcmVkKCn7AocCc3RkOjpfXzI6Ol9fc2hhcmVkX3B0cl9wb2ludGVyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qLCBlbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46OnZhbF9kZWxldGVyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+OjpfX2dldF9kZWxldGVyKHN0ZDo6dHlwZV9pbmZvIGNvbnN0JikgY29uc3T8AvQBc3RkOjpfXzI6Ol9fc2hhcmVkX3B0cl9wb2ludGVyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qLCBlbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46OnZhbF9kZWxldGVyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+OjpfX29uX3plcm9fc2hhcmVkX3dlYWsoKf0CkAFzdGQ6Ol9fMjo6X19zaGFyZWRfcHRyX2VtcGxhY2U8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6fl9fc2hhcmVkX3B0cl9lbXBsYWNlKCn+ApIBc3RkOjpfXzI6Ol9fc2hhcmVkX3B0cl9lbXBsYWNlPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46On5fX3NoYXJlZF9wdHJfZW1wbGFjZSgpLjH/AosBc3RkOjpfXzI6Ol9fc2hhcmVkX3B0cl9lbXBsYWNlPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46Ol9fb25femVyb19zaGFyZWQoKYADIW1heGlHcmFpbjxoYW5uV2luRnVuY3Rvcj46OnBsYXkoKYEDMW1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPjo6fm1heGlQaXRjaFNoaWZ0KCmCA/gDc3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID46OnNoYXJlZF9wdHI8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+LCBlbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4gPjo6dmFsX2RlbGV0ZXI+KG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiosIGVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp2YWxfZGVsZXRlciwgc3RkOjpfXzI6OmVuYWJsZV9pZjxpc19jb252ZXJ0aWJsZTxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4qLCBtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4qPjo6dmFsdWUsIHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+OjpfX25hdD46OnR5cGUpgwPxAXN0ZDo6X18yOjpfX3NoYXJlZF9wdHJfcG9pbnRlcjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4qLCBlbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4gPjo6dmFsX2RlbGV0ZXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4gPjo6fl9fc2hhcmVkX3B0cl9wb2ludGVyKCmEA/MBc3RkOjpfXzI6Ol9fc2hhcmVkX3B0cl9wb2ludGVyPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiosIGVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp2YWxfZGVsZXRlciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp+X19zaGFyZWRfcHRyX3BvaW50ZXIoKS4xhQOEAnN0ZDo6X18yOjpfX3NoYXJlZF9wdHJfcG9pbnRlcjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4qLCBlbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4gPjo6dmFsX2RlbGV0ZXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4gPjo6X19nZXRfZGVsZXRlcihzdGQ6OnR5cGVfaW5mbyBjb25zdCYpIGNvbnN0hgOOAXN0ZDo6X18yOjpfX3NoYXJlZF9wdHJfZW1wbGFjZTxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4gPjo6fl9fc2hhcmVkX3B0cl9lbXBsYWNlKCmHA5ABc3RkOjpfXzI6Ol9fc2hhcmVkX3B0cl9lbXBsYWNlPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp+X19zaGFyZWRfcHRyX2VtcGxhY2UoKS4xiAOJAXN0ZDo6X18yOjpfX3NoYXJlZF9wdHJfZW1wbGFjZTxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4gPjo6X19vbl96ZXJvX3NoYXJlZCgpiQMkX0dMT0JBTF9fc3ViX0lfbWF4aW1pbGlhbi5lbWJpbmQuY3BwigMQbWF4aU9zYzo6bm9pc2UoKYsDGW1heGlPc2M6OnNpbmV3YXZlKGRvdWJsZSmMAxltYXhpT3NjOjpzaW5lYnVmNChkb3VibGUpjQMYbWF4aU9zYzo6c2luZWJ1Zihkb3VibGUpjgMYbWF4aU9zYzo6Y29zd2F2ZShkb3VibGUpjwMXbWF4aU9zYzo6cGhhc29yKGRvdWJsZSmQAxdtYXhpT3NjOjpzcXVhcmUoZG91YmxlKZEDHm1heGlPc2M6OnB1bHNlKGRvdWJsZSwgZG91YmxlKZIDGG1heGlPc2M6OmltcHVsc2UoZG91YmxlKZMDJ21heGlPc2M6OnBoYXNvcihkb3VibGUsIGRvdWJsZSwgZG91YmxlKZQDFG1heGlPc2M6OnNhdyhkb3VibGUplQMVbWF4aU9zYzo6c2F3bihkb3VibGUplgMZbWF4aU9zYzo6dHJpYW5nbGUoZG91YmxlKZcDUG1heGlFbnZlbG9wZTo6bGluZShpbnQsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYpmAMibWF4aUVudmVsb3BlOjp0cmlnZ2VyKGludCwgZG91YmxlKZkDHm1heGlEZWxheWxpbmU6Om1heGlEZWxheWxpbmUoKZoDJm1heGlEZWxheWxpbmU6OmRsKGRvdWJsZSwgaW50LCBkb3VibGUpmwMrbWF4aURlbGF5bGluZTo6ZGwoZG91YmxlLCBpbnQsIGRvdWJsZSwgaW50KZwDIm1heGlGaWx0ZXI6OmxvcGFzcyhkb3VibGUsIGRvdWJsZSmdAyJtYXhpRmlsdGVyOjpoaXBhc3MoZG91YmxlLCBkb3VibGUpngMpbWF4aUZpbHRlcjo6bG9yZXMoZG91YmxlLCBkb3VibGUsIGRvdWJsZSmfAyltYXhpRmlsdGVyOjpoaXJlcyhkb3VibGUsIGRvdWJsZSwgZG91YmxlKaADLG1heGlGaWx0ZXI6OmJhbmRwYXNzKGRvdWJsZSwgZG91YmxlLCBkb3VibGUpoQNYbWF4aU1peDo6c3RlcmVvKGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgZG91YmxlKaIDXm1heGlNaXg6OnF1YWQoZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBkb3VibGUsIGRvdWJsZSmjA2ttYXhpTWl4OjphbWJpc29uaWMoZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKaQDbG1heGlTYW1wbGU6OmxvYWQoc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiwgaW50KaUDEm1heGlTYW1wbGU6OnJlYWQoKaYDZ3N0ZDo6X18yOjpiYXNpY19pZnN0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6YmFzaWNfaWZzdHJlYW0oY2hhciBjb25zdCosIHVuc2lnbmVkIGludCmnA90Bc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mIHN0ZDo6X18yOjpfX3B1dF9jaGFyYWN0ZXJfc2VxdWVuY2U8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4oc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgbG9uZymoA01zdGQ6Ol9fMjo6dmVjdG9yPHNob3J0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHNob3J0PiA+OjpfX2FwcGVuZCh1bnNpZ25lZCBsb25nKakDTXN0ZDo6X18yOjpiYXNpY19maWxlYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfZmlsZWJ1ZigpqgNsbWF4aVNhbXBsZTo6c2V0U2FtcGxlRnJvbU9nZ0Jsb2Ioc3RkOjpfXzI6OnZlY3Rvcjx1bnNpZ25lZCBjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHVuc2lnbmVkIGNoYXI+ID4mLCBpbnQpqwNMc3RkOjpfXzI6OmJhc2ljX2ZpbGVidWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OmJhc2ljX2ZpbGVidWYoKawDXHN0ZDo6X18yOjpiYXNpY19maWxlYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpvcGVuKGNoYXIgY29uc3QqLCB1bnNpZ25lZCBpbnQprQNPc3RkOjpfXzI6OmJhc2ljX2lmc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfaWZzdHJlYW0oKa4DFW1heGlTYW1wbGU6OmlzUmVhZHkoKa8DTm1heGlTYW1wbGU6OnNldFNhbXBsZShzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mKbAD9gFzdGQ6Ol9fMjo6ZW5hYmxlX2lmPChfX2lzX2ZvcndhcmRfaXRlcmF0b3I8ZG91YmxlKj46OnZhbHVlKSAmJiAoaXNfY29uc3RydWN0aWJsZTxkb3VibGUsIHN0ZDo6X18yOjppdGVyYXRvcl90cmFpdHM8ZG91YmxlKj46OnJlZmVyZW5jZT46OnZhbHVlKSwgdm9pZD46OnR5cGUgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+Ojphc3NpZ248ZG91YmxlKj4oZG91YmxlKiwgZG91YmxlKimxA1NtYXhpU2FtcGxlOjpzZXRTYW1wbGUoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgaW50KbIDFW1heGlTYW1wbGU6OnRyaWdnZXIoKbMDEm1heGlTYW1wbGU6OnBsYXkoKbQDKG1heGlTYW1wbGU6OnBsYXkoZG91YmxlLCBkb3VibGUsIGRvdWJsZSm1AzFtYXhpU2FtcGxlOjpwbGF5KGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSYptgMpbWF4aVNhbXBsZTo6cGxheTQoZG91YmxlLCBkb3VibGUsIGRvdWJsZSm3AxZtYXhpU2FtcGxlOjpwbGF5T25jZSgpuAMcbWF4aVNhbXBsZTo6cGxheU9uWlgoZG91YmxlKbkDJG1heGlTYW1wbGU6OnBsYXlPblpYKGRvdWJsZSwgZG91YmxlKboDHG1heGlTYW1wbGU6OnBsYXlPbmNlKGRvdWJsZSm7AyxtYXhpU2FtcGxlOjpwbGF5T25aWChkb3VibGUsIGRvdWJsZSwgZG91YmxlKbwDKm1heGlTYW1wbGU6Omxvb3BTZXRQb3NPblpYKGRvdWJsZSwgZG91YmxlKb0DGG1heGlTYW1wbGU6OnBsYXkoZG91YmxlKb4DHW1heGlTYW1wbGU6Om5vcm1hbGlzZShkb3VibGUpvwMubWF4aVNhbXBsZTo6YXV0b1RyaW0oZmxvYXQsIGZsb2F0LCBib29sLCBib29sKcADM21heGlEeW46OmdhdGUoZG91YmxlLCBkb3VibGUsIGxvbmcsIGRvdWJsZSwgZG91YmxlKcEDO21heGlEeW46OmNvbXByZXNzb3IoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUpwgMZbWF4aUR5bjo6Y29tcHJlc3MoZG91YmxlKcMDGm1heGlEeW46OnNldEF0dGFjayhkb3VibGUpxAMbbWF4aUR5bjo6c2V0UmVsZWFzZShkb3VibGUpxQMdbWF4aUR5bjo6c2V0VGhyZXNob2xkKGRvdWJsZSnGAy5tYXhpRW52Ojphcihkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBsb25nLCBpbnQpxwNAbWF4aUVudjo6YWRzcihkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgbG9uZywgaW50KcgDGm1heGlFbnY6OmFkc3IoZG91YmxlLCBpbnQpyQMabWF4aUVudjo6c2V0QXR0YWNrKGRvdWJsZSnKAxttYXhpRW52OjpzZXRTdXN0YWluKGRvdWJsZSnLAxltYXhpRW52OjpzZXREZWNheShkb3VibGUpzAMSY29udmVydDo6bXRvZihpbnQpzQNgdmlydHVhbCB0aHVuayB0byBzdGQ6Ol9fMjo6YmFzaWNfaWZzdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19pZnN0cmVhbSgpzgNRc3RkOjpfXzI6OmJhc2ljX2lmc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfaWZzdHJlYW0oKS4xzwNidmlydHVhbCB0aHVuayB0byBzdGQ6Ol9fMjo6YmFzaWNfaWZzdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19pZnN0cmVhbSgpLjHQA0NzdGQ6Ol9fMjo6YmFzaWNfZmlsZWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6c3luYygp0QNPc3RkOjpfXzI6OmJhc2ljX2ZpbGVidWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19maWxlYnVmKCkuMdIDW3N0ZDo6X18yOjpiYXNpY19maWxlYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjppbWJ1ZShzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JinTA1BzdGQ6Ol9fMjo6YmFzaWNfZmlsZWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6c2V0YnVmKGNoYXIqLCBsb25nKdQDenN0ZDo6X18yOjpiYXNpY19maWxlYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpzZWVrb2ZmKGxvbmcgbG9uZywgc3RkOjpfXzI6Omlvc19iYXNlOjpzZWVrZGlyLCB1bnNpZ25lZCBpbnQp1QMcc3RkOjpfXzI6Ol9fdGhyb3dfYmFkX2Nhc3QoKdYDb3N0ZDo6X18yOjpiYXNpY19maWxlYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpzZWVrcG9zKHN0ZDo6X18yOjpmcG9zPF9fbWJzdGF0ZV90PiwgdW5zaWduZWQgaW50KdcDSHN0ZDo6X18yOjpiYXNpY19maWxlYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp1bmRlcmZsb3coKdgDS3N0ZDo6X18yOjpiYXNpY19maWxlYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpwYmFja2ZhaWwoaW50KdkDSnN0ZDo6X18yOjpiYXNpY19maWxlYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpvdmVyZmxvdyhpbnQp2gOFAnN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+IHN0ZDo6X18yOjpfX3BhZF9hbmRfb3V0cHV0PGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCBjaGFyKdsDG21heGlDbG9jazo6c2V0VGVtcG8oZG91YmxlKdwDE21heGlDbG9jazo6dGlja2VyKCndAx9tYXhpQ2xvY2s6OnNldFRpY2tzUGVyQmVhdChpbnQp3gMdbWF4aUZGVDo6c2V0dXAoaW50LCBpbnQsIGludCnfAyptYXhpRkZUOjpwcm9jZXNzKGZsb2F0LCBtYXhpRkZUOjpmZnRNb2RlcyngAxNtYXhpRkZUOjptYWdzVG9EQigp4QMbbWF4aUZGVDo6c3BlY3RyYWxGbGF0bmVzcygp4gMbbWF4aUZGVDo6c3BlY3RyYWxDZW50cm9pZCgp4wMebWF4aUlGRlQ6OnNldHVwKGludCwgaW50LCBpbnQp5AOTAW1heGlJRkZUOjpwcm9jZXNzKHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mLCBzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+JiwgbWF4aUlGRlQ6OmZmdE1vZGVzKeUDLkZGVChpbnQsIGJvb2wsIGZsb2F0KiwgZmxvYXQqLCBmbG9hdCosIGZsb2F0KinmAyRSZWFsRkZUKGludCwgZmxvYXQqLCBmbG9hdCosIGZsb2F0KinnAyBmZnQ6OmdlbldpbmRvdyhpbnQsIGludCwgZmxvYXQqKegDD2ZmdDo6c2V0dXAoaW50KekDC2ZmdDo6fmZmdCgp6gMhZmZ0OjpjYWxjRkZUKGludCwgZmxvYXQqLCBmbG9hdCop6wM3ZmZ0Ojpwb3dlclNwZWN0cnVtKGludCwgZmxvYXQqLCBmbG9hdCosIGZsb2F0KiwgZmxvYXQqKewDHWZmdDo6Y29udlRvREIoZmxvYXQqLCBmbG9hdCop7QM7ZmZ0OjppbnZlcnNlRkZUQ29tcGxleChpbnQsIGZsb2F0KiwgZmxvYXQqLCBmbG9hdCosIGZsb2F0KinuAz5mZnQ6OmludmVyc2VQb3dlclNwZWN0cnVtKGludCwgZmxvYXQqLCBmbG9hdCosIGZsb2F0KiwgZmxvYXQqKe8DN21heGlNRkNDQW5hbHlzZXI8ZG91YmxlPjo6bWVsRmlsdGVyQW5kTG9nU3F1YXJlKGZsb2F0KinwAydwb2ludF9jb21wYXJlKHZvaWQgY29uc3QqLCB2b2lkIGNvbnN0KinxAxp2b3JiaXNfZGVpbml0KHN0Yl92b3JiaXMqKfIDKWlzX3dob2xlX3BhY2tldF9wcmVzZW50KHN0Yl92b3JiaXMqLCBpbnQp8wMzdm9yYmlzX2RlY29kZV9wYWNrZXQoc3RiX3ZvcmJpcyosIGludCosIGludCosIGludCop9AMXc3RhcnRfcGFnZShzdGJfdm9yYmlzKin1Ay92b3JiaXNfZmluaXNoX2ZyYW1lKHN0Yl92b3JiaXMqLCBpbnQsIGludCwgaW50KfYDQHZvcmJpc19kZWNvZGVfaW5pdGlhbChzdGJfdm9yYmlzKiwgaW50KiwgaW50KiwgaW50KiwgaW50KiwgaW50Kin3AxpnZXRfYml0cyhzdGJfdm9yYmlzKiwgaW50KfgDMmNvZGVib29rX2RlY29kZV9zY2FsYXJfcmF3KHN0Yl92b3JiaXMqLCBDb2RlYm9vayop+QNDZGVjb2RlX3Jlc2lkdWUoc3RiX3ZvcmJpcyosIGZsb2F0KiosIGludCwgaW50LCBpbnQsIHVuc2lnbmVkIGNoYXIqKfoDK2ludmVyc2VfbWRjdChmbG9hdCosIGludCwgc3RiX3ZvcmJpcyosIGludCn7AxlmbHVzaF9wYWNrZXQoc3RiX3ZvcmJpcyop/AMac3RhcnRfZGVjb2RlcihzdGJfdm9yYmlzKin9Ayh1aW50MzJfY29tcGFyZSh2b2lkIGNvbnN0Kiwgdm9pZCBjb25zdCop/gMlaW5pdF9ibG9ja3NpemUoc3RiX3ZvcmJpcyosIGludCwgaW50Kf8DFnN0Yl92b3JiaXNfb3Blbl9tZW1vcnmABBpzdGJfdm9yYmlzX2dldF9mcmFtZV9zaG9ydIEEQGNvbnZlcnRfc2FtcGxlc19zaG9ydChpbnQsIHNob3J0KiosIGludCwgaW50LCBmbG9hdCoqLCBpbnQsIGludCmCBCZzdGJfdm9yYmlzX2dldF9mcmFtZV9zaG9ydF9pbnRlcmxlYXZlZIMER2NvbnZlcnRfY2hhbm5lbHNfc2hvcnRfaW50ZXJsZWF2ZWQoaW50LCBzaG9ydCosIGludCwgZmxvYXQqKiwgaW50LCBpbnQphAQYc3RiX3ZvcmJpc19kZWNvZGVfbWVtb3J5hQQfbWF5YmVfc3RhcnRfcGFja2V0KHN0Yl92b3JiaXMqKYYEKXN0YXJ0X3BhZ2Vfbm9fY2FwdHVyZXBhdHRlcm4oc3RiX3ZvcmJpcyophwQyY29kZWJvb2tfZGVjb2RlX3N0YXJ0KHN0Yl92b3JiaXMqLCBDb2RlYm9vayosIGludCmIBF9jb2RlYm9va19kZWNvZGVfZGVpbnRlcmxlYXZlX3JlcGVhdChzdGJfdm9yYmlzKiwgQ29kZWJvb2sqLCBmbG9hdCoqLCBpbnQsIGludCosIGludCosIGludCwgaW50KYkENWltZGN0X3N0ZXAzX2l0ZXIwX2xvb3AoaW50LCBmbG9hdCosIGludCwgaW50LCBmbG9hdCopigQ8aW1kY3Rfc3RlcDNfaW5uZXJfcl9sb29wKGludCwgZmxvYXQqLCBpbnQsIGludCwgZmxvYXQqLCBpbnQpiwQHc2NhbGJuZowEBmxkZXhwZo0EBm1lbWNtcI4EBXFzb3J0jwQEc2lmdJAEA3NocpEEB3RyaW5rbGWSBANzaGyTBARwbnR6lAQFY3ljbGWVBAdhX2N0el9slgQMX19zdGRpb19zZWVrlwQKX19sb2NrZmlsZZgEDF9fdW5sb2NrZmlsZZkECV9fZndyaXRleJoEBmZ3cml0ZZsEB2lwcmludGacBBBfX2Vycm5vX2xvY2F0aW9unQQHd2NydG9tYp4EBndjdG9tYp8EBm1lbWNocqAEBWZyZXhwoQQTX192ZnByaW50Zl9pbnRlcm5hbKIEC3ByaW50Zl9jb3JlowQDb3V0pAQGZ2V0aW50pQQHcG9wX2FyZ6YEA3BhZKcEBWZtdF9vqAQFZm10X3ipBAVmbXRfdaoECHZmcHJpbnRmqwQGZm10X2ZwrAQTcG9wX2FyZ19sb25nX2RvdWJsZa0ECXZmaXByaW50Zq4ECl9fb2ZsX2xvY2uvBAlfX3Rvd3JpdGWwBAhmaXByaW50ZrEEBWZwdXRjsgQRX19mdGVsbG9fdW5sb2NrZWSzBAhfX2Z0ZWxsb7QEBWZ0ZWxstQQIX190b3JlYWS2BAVmcmVhZLcEEV9fZnNlZWtvX3VubG9ja2VkuAQIX19mc2Vla2+5BAVmc2Vla7oEDV9fc3RkaW9fY2xvc2W7BAVmZ2V0Y7wEBnN0cmxlbr0EC19fc3RyY2hybnVsvgQGc3RyY2hyvwQMX19mbW9kZWZsYWdzwAQFZm9wZW7BBAl2c25wcmludGbCBAhzbl93cml0ZcMEBmZjbG9zZcQEGV9fZW1zY3JpcHRlbl9zdGRvdXRfY2xvc2XFBBhfX2Vtc2NyaXB0ZW5fc3Rkb3V0X3NlZWvGBAxfX3N0ZGlvX3JlYWTHBAhfX2Zkb3BlbsgEDV9fc3RkaW9fd3JpdGXJBApfX292ZXJmbG93ygQGZmZsdXNoywQRX19mZmx1c2hfdW5sb2NrZWTMBAdfX3VmbG93zQQJX19vZmxfYWRkzgQJX19sc2hydGkzzwQJX19hc2hsdGkz0AQMX190cnVuY3RmZGYy0QQFX19jb3PSBBBfX3JlbV9waW8yX2xhcmdl0wQKX19yZW1fcGlvMtQEBV9fc2lu1QQDY29z1gQHX19jb3NkZtcEB19fc2luZGbYBAtfX3JlbV9waW8yZtkEBGNvc2baBANzaW7bBARzaW5m3AQFX190YW7dBAN0YW7eBARhdGFu3wQFYXRhbmbgBAZhdGFuMmbhBARleHBm4gQDbG9n4wQEbG9nZuQEA3Bvd+UEB3dtZW1jcHnmBBlzdGQ6OnVuY2F1Z2h0X2V4Y2VwdGlvbigp5wRFc3RkOjpfXzI6OmJhc2ljX2lvczxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX2lvcygp6AQfc3RkOjpfXzI6Omlvc19iYXNlOjp+aW9zX2Jhc2UoKekEP3N0ZDo6X18yOjppb3NfYmFzZTo6X19jYWxsX2NhbGxiYWNrcyhzdGQ6Ol9fMjo6aW9zX2Jhc2U6OmV2ZW50KeoER3N0ZDo6X18yOjpiYXNpY19pb3M8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19pb3MoKS4x6wRRc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX3N0cmVhbWJ1Zigp7ARTc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX3N0cmVhbWJ1ZigpLjHtBFBzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpiYXNpY19zdHJlYW1idWYoKe4EXXN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OmltYnVlKHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKe8EUnN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnNldGJ1ZihjaGFyKiwgbG9uZynwBHxzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpzZWVrb2ZmKGxvbmcgbG9uZywgc3RkOjpfXzI6Omlvc19iYXNlOjpzZWVrZGlyLCB1bnNpZ25lZCBpbnQp8QRxc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6c2Vla3BvcyhzdGQ6Ol9fMjo6ZnBvczxfX21ic3RhdGVfdD4sIHVuc2lnbmVkIGludCnyBFJzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp4c2dldG4oY2hhciosIGxvbmcp8wREc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+Ojpjb3B5KGNoYXIqLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgbG9uZyn0BEpzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp1bmRlcmZsb3coKfUERnN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnVmbG93KCn2BE1zdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpwYmFja2ZhaWwoaW50KfcEWHN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnhzcHV0bihjaGFyIGNvbnN0KiwgbG9uZyn4BFdzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Ojp+YmFzaWNfc3RyZWFtYnVmKCn5BFlzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Ojp+YmFzaWNfc3RyZWFtYnVmKCkuMfoEVnN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46OmJhc2ljX3N0cmVhbWJ1Zigp+wRbc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1Zjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6eHNnZXRuKHdjaGFyX3QqLCBsb25nKfwETXN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Pjo6Y29weSh3Y2hhcl90Kiwgd2NoYXJfdCBjb25zdCosIHVuc2lnbmVkIGxvbmcp/QRMc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1Zjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6dWZsb3coKf4EYXN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46OnhzcHV0bih3Y2hhcl90IGNvbnN0KiwgbG9uZyn/BE9zdGQ6Ol9fMjo6YmFzaWNfaXN0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX2lzdHJlYW0oKS4xgAVedmlydHVhbCB0aHVuayB0byBzdGQ6Ol9fMjo6YmFzaWNfaXN0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX2lzdHJlYW0oKYEFT3N0ZDo6X18yOjpiYXNpY19pc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfaXN0cmVhbSgpLjKCBWB2aXJ0dWFsIHRodW5rIHRvIHN0ZDo6X18yOjpiYXNpY19pc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfaXN0cmVhbSgpLjGDBY8Bc3RkOjpfXzI6OmJhc2ljX2lzdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnNlbnRyeTo6c2VudHJ5KHN0ZDo6X18yOjpiYXNpY19pc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+JiwgYm9vbCmEBURzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6Zmx1c2goKYUFYXN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYgc3RkOjpfXzI6OnVzZV9mYWNldDxzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gPihzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JimGBdEBYm9vbCBzdGQ6Ol9fMjo6b3BlcmF0b3IhPTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiBjb25zdCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+IGNvbnN0JimHBVRzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6b3BlcmF0b3IqKCkgY29uc3SIBU9zdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6b3BlcmF0b3IrKygpiQXRAWJvb2wgc3RkOjpfXzI6Om9wZXJhdG9yPT08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gY29uc3QmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiBjb25zdCYpigWJAXN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpzZW50cnk6OnNlbnRyeShzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYpiwVOc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnNlbnRyeTo6fnNlbnRyeSgpjAWYAXN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjplcXVhbChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiBjb25zdCYpIGNvbnN0jQVHc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6c2J1bXBjKCmOBUpzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpzcHV0YyhjaGFyKY8FTnN0ZDo6X18yOjpiYXNpY19pc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpyZWFkKGNoYXIqLCBsb25nKZAFanN0ZDo6X18yOjpiYXNpY19pc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpzZWVrZyhsb25nIGxvbmcsIHN0ZDo6X18yOjppb3NfYmFzZTo6c2Vla2RpcimRBUpzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6Zmx1c2goKZIFZ3N0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYgc3RkOjpfXzI6OnVzZV9mYWNldDxzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gPihzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JimTBeMBYm9vbCBzdGQ6Ol9fMjo6b3BlcmF0b3IhPTx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiBjb25zdCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+IGNvbnN0JimUBVVzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6b3BlcmF0b3IrKygplQXjAWJvb2wgc3RkOjpfXzI6Om9wZXJhdG9yPT08d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gY29uc3QmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiBjb25zdCYplgWVAXN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+OjpzZW50cnk6OnNlbnRyeShzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYplwWkAXN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+OjplcXVhbChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiBjb25zdCYpIGNvbnN0mAVNc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1Zjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6c2J1bXBjKCmZBVNzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+OjpzcHV0Yyh3Y2hhcl90KZoFT3N0ZDo6X18yOjpiYXNpY19vc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfb3N0cmVhbSgpLjGbBV52aXJ0dWFsIHRodW5rIHRvIHN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfb3N0cmVhbSgpnAVPc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19vc3RyZWFtKCkuMp0FYHZpcnR1YWwgdGh1bmsgdG8gc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19vc3RyZWFtKCkuMZ4F7QFzdGQ6Ol9fMjo6bnVtX3B1dDxjaGFyLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+IGNvbnN0JiBzdGQ6Ol9fMjo6dXNlX2ZhY2V0PHN0ZDo6X18yOjpudW1fcHV0PGNoYXIsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID4gPihzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JimfBUVzdGQ6Ol9fMjo6YmFzaWNfaW9zPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpmaWxsKCkgY29uc3SgBUpzdGQ6Ol9fMjo6YmFzaWNfaW9zPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp3aWRlbihjaGFyKSBjb25zdKEFTnN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpvcGVyYXRvcjw8KHNob3J0KaIFTHN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpvcGVyYXRvcjw8KGludCmjBVZzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6b3BlcmF0b3I8PCh1bnNpZ25lZCBsb25nKaQFUnN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpvcGVyYXRvcj0oY2hhcimlBUZzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6cHV0KGNoYXIppgVbc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46Om9wZXJhdG9yPSh3Y2hhcl90KacFcHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OmJhc2ljX3N0cmluZyhjaGFyIGNvbnN0KimoBSFzdGQ6Ol9fMjo6aW9zX2Jhc2U6On5pb3NfYmFzZSgpLjGpBR9zdGQ6Ol9fMjo6aW9zX2Jhc2U6OmluaXQodm9pZCopqgW1AXN0ZDo6X18yOjplbmFibGVfaWY8KGlzX21vdmVfY29uc3RydWN0aWJsZTx1bnNpZ25lZCBpbnQ+Ojp2YWx1ZSkgJiYgKGlzX21vdmVfYXNzaWduYWJsZTx1bnNpZ25lZCBpbnQ+Ojp2YWx1ZSksIHZvaWQ+Ojp0eXBlIHN0ZDo6X18yOjpzd2FwPHVuc2lnbmVkIGludD4odW5zaWduZWQgaW50JiwgdW5zaWduZWQgaW50JimrBVlzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6X190ZXN0X2Zvcl9lb2YoKSBjb25zdKwFX3N0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+OjpfX3Rlc3RfZm9yX2VvZigpIGNvbnN0rQUGdW5nZXRjrgUgc3RkOjpfXzI6Omlvc19iYXNlOjpJbml0OjpJbml0KCmvBRdfX2N4eF9nbG9iYWxfYXJyYXlfZHRvcrAFP3N0ZDo6X18yOjpfX3N0ZGluYnVmPGNoYXI+OjpfX3N0ZGluYnVmKF9JT19GSUxFKiwgX19tYnN0YXRlX3QqKbEFigFzdGQ6Ol9fMjo6YmFzaWNfaXN0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6YmFzaWNfaXN0cmVhbShzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+KimyBUJzdGQ6Ol9fMjo6X19zdGRpbmJ1Zjx3Y2hhcl90Pjo6X19zdGRpbmJ1ZihfSU9fRklMRSosIF9fbWJzdGF0ZV90KimzBZYBc3RkOjpfXzI6OmJhc2ljX2lzdHJlYW08d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46OmJhc2ljX2lzdHJlYW0oc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1Zjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPioptAVBc3RkOjpfXzI6Ol9fc3Rkb3V0YnVmPGNoYXI+OjpfX3N0ZG91dGJ1ZihfSU9fRklMRSosIF9fbWJzdGF0ZV90Kim1BYoBc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OmJhc2ljX29zdHJlYW0oc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPioptgVEc3RkOjpfXzI6Ol9fc3Rkb3V0YnVmPHdjaGFyX3Q+OjpfX3N0ZG91dGJ1ZihfSU9fRklMRSosIF9fbWJzdGF0ZV90Kim3BZYBc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46OmJhc2ljX29zdHJlYW0oc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1Zjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiopuAV9c3RkOjpfXzI6OmJhc2ljX2lvczxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6aW5pdChzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Kim5BYsBc3RkOjpfXzI6OmNvZGVjdnQ8Y2hhciwgY2hhciwgX19tYnN0YXRlX3Q+IGNvbnN0JiBzdGQ6Ol9fMjo6dXNlX2ZhY2V0PHN0ZDo6X18yOjpjb2RlY3Z0PGNoYXIsIGNoYXIsIF9fbWJzdGF0ZV90PiA+KHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKboFkQFzdGQ6Ol9fMjo6Y29kZWN2dDx3Y2hhcl90LCBjaGFyLCBfX21ic3RhdGVfdD4gY29uc3QmIHN0ZDo6X18yOjp1c2VfZmFjZXQ8c3RkOjpfXzI6OmNvZGVjdnQ8d2NoYXJfdCwgY2hhciwgX19tYnN0YXRlX3Q+ID4oc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYpuwUpc3RkOjpfXzI6Ol9fc3RkaW5idWY8Y2hhcj46On5fX3N0ZGluYnVmKCm8BTpzdGQ6Ol9fMjo6X19zdGRpbmJ1ZjxjaGFyPjo6aW1idWUoc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYpvQUnc3RkOjpfXzI6Ol9fc3RkaW5idWY8Y2hhcj46OnVuZGVyZmxvdygpvgUrc3RkOjpfXzI6Ol9fc3RkaW5idWY8Y2hhcj46Ol9fZ2V0Y2hhcihib29sKb8FI3N0ZDo6X18yOjpfX3N0ZGluYnVmPGNoYXI+Ojp1ZmxvdygpwAUqc3RkOjpfXzI6Ol9fc3RkaW5idWY8Y2hhcj46OnBiYWNrZmFpbChpbnQpwQUsc3RkOjpfXzI6Ol9fc3RkaW5idWY8d2NoYXJfdD46On5fX3N0ZGluYnVmKCnCBT1zdGQ6Ol9fMjo6X19zdGRpbmJ1Zjx3Y2hhcl90Pjo6aW1idWUoc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYpwwUqc3RkOjpfXzI6Ol9fc3RkaW5idWY8d2NoYXJfdD46OnVuZGVyZmxvdygpxAUuc3RkOjpfXzI6Ol9fc3RkaW5idWY8d2NoYXJfdD46Ol9fZ2V0Y2hhcihib29sKcUFJnN0ZDo6X18yOjpfX3N0ZGluYnVmPHdjaGFyX3Q+Ojp1ZmxvdygpxgU2c3RkOjpfXzI6Ol9fc3RkaW5idWY8d2NoYXJfdD46OnBiYWNrZmFpbCh1bnNpZ25lZCBpbnQpxwU7c3RkOjpfXzI6Ol9fc3Rkb3V0YnVmPGNoYXI+OjppbWJ1ZShzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JinIBSNzdGQ6Ol9fMjo6X19zdGRvdXRidWY8Y2hhcj46OnN5bmMoKckFNnN0ZDo6X18yOjpfX3N0ZG91dGJ1ZjxjaGFyPjo6eHNwdXRuKGNoYXIgY29uc3QqLCBsb25nKcoFKnN0ZDo6X18yOjpfX3N0ZG91dGJ1ZjxjaGFyPjo6b3ZlcmZsb3coaW50KcsFPnN0ZDo6X18yOjpfX3N0ZG91dGJ1Zjx3Y2hhcl90Pjo6aW1idWUoc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYpzAU8c3RkOjpfXzI6Ol9fc3Rkb3V0YnVmPHdjaGFyX3Q+Ojp4c3B1dG4od2NoYXJfdCBjb25zdCosIGxvbmcpzQU2c3RkOjpfXzI6Ol9fc3Rkb3V0YnVmPHdjaGFyX3Q+OjpvdmVyZmxvdyh1bnNpZ25lZCBpbnQpzgUHX19zaGxpbc8FCF9fc2hnZXRj0AUIX19tdWx0aTPRBQlfX2ludHNjYW7SBQdtYnJ0b3dj0wUNX19leHRlbmRzZnRmMtQFCF9fbXVsdGYz1QULX19mbG9hdHNpdGbWBQhfX2FkZHRmM9cFDV9fZXh0ZW5kZGZ0ZjLYBQdfX2xldGYy2QUHX19nZXRmMtoFCWNvcHlzaWdubNsFDV9fZmxvYXR1bnNpdGbcBQhfX3N1YnRmM90FB3NjYWxibmzeBQhfX2RpdnRmM98FC19fZmxvYXRzY2Fu4AUIaGV4ZmxvYXThBQhkZWNmbG9hdOIFB3NjYW5leHDjBQxfX3RydW5jdGZzZjLkBQd2ZnNjYW5m5QUFYXJnX27mBQlzdG9yZV9pbnTnBQ1fX3N0cmluZ19yZWFk6AUHdnNzY2FuZukFB2RvX3JlYWTqBQZzdHJjbXDrBSBfX2Vtc2NyaXB0ZW5fZW52aXJvbl9jb25zdHJ1Y3RvcuwFB3N0cm5jbXDtBQZnZXRlbnbuBQhfX211bm1hcO8FDF9fZ2V0X2xvY2FsZfAFC19fbmV3bG9jYWxl8QUJdmFzcHJpbnRm8gUGc3NjYW5m8wUIc25wcmludGb0BQpmcmVlbG9jYWxl9QUGd2NzbGVu9gUJd2NzcnRvbWJz9wUKd2NzbnJ0b21ic/gFCW1ic3J0b3djc/kFCm1ic25ydG93Y3P6BQZzdHJ0b3j7BQpzdHJ0b3VsbF9s/AUJc3RydG9sbF9s/QUGc3RydG9m/gUIc3RydG94LjH/BQZzdHJ0b2SABgdzdHJ0b2xkgQYJc3RydG9sZF9sggZdc3RkOjpfXzI6OmNvbGxhdGU8Y2hhcj46OmRvX2NvbXBhcmUoY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdCopIGNvbnN0gwZFc3RkOjpfXzI6OmNvbGxhdGU8Y2hhcj46OmRvX3RyYW5zZm9ybShjaGFyIGNvbnN0KiwgY2hhciBjb25zdCopIGNvbnN0hAbPAXN0ZDo6X18yOjplbmFibGVfaWY8X19pc19mb3J3YXJkX2l0ZXJhdG9yPGNoYXIgY29uc3QqPjo6dmFsdWUsIHZvaWQ+Ojp0eXBlIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46Ol9faW5pdDxjaGFyIGNvbnN0Kj4oY2hhciBjb25zdCosIGNoYXIgY29uc3QqKYUGQHN0ZDo6X18yOjpjb2xsYXRlPGNoYXI+Ojpkb19oYXNoKGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KikgY29uc3SGBmxzdGQ6Ol9fMjo6Y29sbGF0ZTx3Y2hhcl90Pjo6ZG9fY29tcGFyZSh3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0KikgY29uc3SHBk5zdGQ6Ol9fMjo6Y29sbGF0ZTx3Y2hhcl90Pjo6ZG9fdHJhbnNmb3JtKHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0KikgY29uc3SIBuQBc3RkOjpfXzI6OmVuYWJsZV9pZjxfX2lzX2ZvcndhcmRfaXRlcmF0b3I8d2NoYXJfdCBjb25zdCo+Ojp2YWx1ZSwgdm9pZD46OnR5cGUgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6X19pbml0PHdjaGFyX3QgY29uc3QqPih3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdCopiQZJc3RkOjpfXzI6OmNvbGxhdGU8d2NoYXJfdD46OmRvX2hhc2god2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqKSBjb25zdIoGmgJzdGQ6Ol9fMjo6bnVtX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBib29sJikgY29uc3SLBmdzdGQ6Ol9fMjo6bnVtcHVuY3Q8Y2hhcj4gY29uc3QmIHN0ZDo6X18yOjp1c2VfZmFjZXQ8c3RkOjpfXzI6Om51bXB1bmN0PGNoYXI+ID4oc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYpjAakBXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QqIHN0ZDo6X18yOjpfX3NjYW5fa2V5d29yZDxzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCosIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiA+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QqLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0Kiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JiwgdW5zaWduZWQgaW50JiwgYm9vbCmNBjhzdGQ6Ol9fMjo6bG9jYWxlOjp1c2VfZmFjZXQoc3RkOjpfXzI6OmxvY2FsZTo6aWQmKSBjb25zdI4GzAFzdGQ6Ol9fMjo6dW5pcXVlX3B0cjx1bnNpZ25lZCBjaGFyLCB2b2lkICgqKSh2b2lkKik+Ojp1bmlxdWVfcHRyPHRydWUsIHZvaWQ+KHVuc2lnbmVkIGNoYXIqLCBzdGQ6Ol9fMjo6X19kZXBlbmRlbnRfdHlwZTxzdGQ6Ol9fMjo6X191bmlxdWVfcHRyX2RlbGV0ZXJfc2ZpbmFlPHZvaWQgKCopKHZvaWQqKT4sIHRydWU+OjpfX2dvb2RfcnZhbF9yZWZfdHlwZSmPBpoCc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgbG9uZyYpIGNvbnN0kAbrAnN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+IHN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZG9fZ2V0X3NpZ25lZDxsb25nPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGxvbmcmKSBjb25zdJEGOXN0ZDo6X18yOjpfX251bV9nZXRfYmFzZTo6X19nZXRfYmFzZShzdGQ6Ol9fMjo6aW9zX2Jhc2UmKZIGSHN0ZDo6X18yOjpfX251bV9nZXQ8Y2hhcj46Ol9fc3RhZ2UyX2ludF9wcmVwKHN0ZDo6X18yOjppb3NfYmFzZSYsIGNoYXImKZMGZXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OmJhc2ljX3N0cmluZygplAZsc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6cmVzaXplKHVuc2lnbmVkIGxvbmcplQblAXN0ZDo6X18yOjpfX251bV9nZXQ8Y2hhcj46Ol9fc3RhZ2UyX2ludF9sb29wKGNoYXIsIGludCwgY2hhciosIGNoYXIqJiwgdW5zaWduZWQgaW50JiwgY2hhciwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCYsIHVuc2lnbmVkIGludCosIHVuc2lnbmVkIGludComLCBjaGFyIGNvbnN0KimWBlxsb25nIHN0ZDo6X18yOjpfX251bV9nZXRfc2lnbmVkX2ludGVncmFsPGxvbmc+KGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgaW50JiwgaW50KZcGpQFzdGQ6Ol9fMjo6X19jaGVja19ncm91cGluZyhzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0JiwgdW5zaWduZWQgaW50KiwgdW5zaWduZWQgaW50KiwgdW5zaWduZWQgaW50JimYBp8Cc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgbG9uZyBsb25nJikgY29uc3SZBvUCc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19kb19nZXRfc2lnbmVkPGxvbmcgbG9uZz4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBsb25nIGxvbmcmKSBjb25zdJoGZmxvbmcgbG9uZyBzdGQ6Ol9fMjo6X19udW1fZ2V0X3NpZ25lZF9pbnRlZ3JhbDxsb25nIGxvbmc+KGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgaW50JiwgaW50KZsGpAJzdGQ6Ol9fMjo6bnVtX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB1bnNpZ25lZCBzaG9ydCYpIGNvbnN0nAaBA3N0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+IHN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZG9fZ2V0X3Vuc2lnbmVkPHVuc2lnbmVkIHNob3J0PihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHVuc2lnbmVkIHNob3J0JikgY29uc3SdBnJ1bnNpZ25lZCBzaG9ydCBzdGQ6Ol9fMjo6X19udW1fZ2V0X3Vuc2lnbmVkX2ludGVncmFsPHVuc2lnbmVkIHNob3J0PihjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGludCYsIGludCmeBqICc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdW5zaWduZWQgaW50JikgY29uc3SfBv0Cc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19kb19nZXRfdW5zaWduZWQ8dW5zaWduZWQgaW50PihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHVuc2lnbmVkIGludCYpIGNvbnN0oAZudW5zaWduZWQgaW50IHN0ZDo6X18yOjpfX251bV9nZXRfdW5zaWduZWRfaW50ZWdyYWw8dW5zaWduZWQgaW50PihjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGludCYsIGludCmhBqgCc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdW5zaWduZWQgbG9uZyBsb25nJikgY29uc3SiBokDc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19kb19nZXRfdW5zaWduZWQ8dW5zaWduZWQgbG9uZyBsb25nPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHVuc2lnbmVkIGxvbmcgbG9uZyYpIGNvbnN0owZ6dW5zaWduZWQgbG9uZyBsb25nIHN0ZDo6X18yOjpfX251bV9nZXRfdW5zaWduZWRfaW50ZWdyYWw8dW5zaWduZWQgbG9uZyBsb25nPihjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGludCYsIGludCmkBpsCc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgZmxvYXQmKSBjb25zdKUG9QJzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiBzdGQ6Ol9fMjo6bnVtX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2RvX2dldF9mbG9hdGluZ19wb2ludDxmbG9hdD4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBmbG9hdCYpIGNvbnN0pgZYc3RkOjpfXzI6Ol9fbnVtX2dldDxjaGFyPjo6X19zdGFnZTJfZmxvYXRfcHJlcChzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCBjaGFyKiwgY2hhciYsIGNoYXImKacG8AFzdGQ6Ol9fMjo6X19udW1fZ2V0PGNoYXI+OjpfX3N0YWdlMl9mbG9hdF9sb29wKGNoYXIsIGJvb2wmLCBjaGFyJiwgY2hhciosIGNoYXIqJiwgY2hhciwgY2hhciwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCYsIHVuc2lnbmVkIGludCosIHVuc2lnbmVkIGludComLCB1bnNpZ25lZCBpbnQmLCBjaGFyKimoBk9mbG9hdCBzdGQ6Ol9fMjo6X19udW1fZ2V0X2Zsb2F0PGZsb2F0PihjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGludCYpqQacAnN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGRvdWJsZSYpIGNvbnN0qgb3AnN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+IHN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZG9fZ2V0X2Zsb2F0aW5nX3BvaW50PGRvdWJsZT4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBkb3VibGUmKSBjb25zdKsGUWRvdWJsZSBzdGQ6Ol9fMjo6X19udW1fZ2V0X2Zsb2F0PGRvdWJsZT4oY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBpbnQmKawGoQJzdGQ6Ol9fMjo6bnVtX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBsb25nIGRvdWJsZSYpIGNvbnN0rQaBA3N0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+IHN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZG9fZ2V0X2Zsb2F0aW5nX3BvaW50PGxvbmcgZG91YmxlPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGxvbmcgZG91YmxlJikgY29uc3SuBltsb25nIGRvdWJsZSBzdGQ6Ol9fMjo6X19udW1fZ2V0X2Zsb2F0PGxvbmcgZG91YmxlPihjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGludCYprwabAnN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHZvaWQqJikgY29uc3SwBhJzdGQ6Ol9fMjo6X19jbG9jKCmxBkxzdGQ6Ol9fMjo6X19saWJjcHBfc3NjYW5mX2woY2hhciBjb25zdCosIF9fbG9jYWxlX3N0cnVjdCosIGNoYXIgY29uc3QqLCAuLi4psgZfc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6X196ZXJvKCmzBlRjaGFyIGNvbnN0KiBzdGQ6Ol9fMjo6ZmluZDxjaGFyIGNvbnN0KiwgY2hhcj4oY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0Jim0BklzdGQ6Ol9fMjo6X19saWJjcHBfbG9jYWxlX2d1YXJkOjpfX2xpYmNwcF9sb2NhbGVfZ3VhcmQoX19sb2NhbGVfc3RydWN0KiYptQavAnN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGJvb2wmKSBjb25zdLYGbXN0ZDo6X18yOjpudW1wdW5jdDx3Y2hhcl90PiBjb25zdCYgc3RkOjpfXzI6OnVzZV9mYWNldDxzdGQ6Ol9fMjo6bnVtcHVuY3Q8d2NoYXJfdD4gPihzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0Jim3BuAFc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiBjb25zdCogc3RkOjpfXzI6Ol9fc2Nhbl9rZXl3b3JkPHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+IGNvbnN0Kiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+ID4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiBjb25zdCosIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4gY29uc3QqLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmLCB1bnNpZ25lZCBpbnQmLCBib29sKbgGrwJzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBsb25nJikgY29uc3S5BoYDc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19kb19nZXRfc2lnbmVkPGxvbmc+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgbG9uZyYpIGNvbnN0ugZNc3RkOjpfXzI6Ol9fbnVtX2dldDx3Y2hhcl90Pjo6X19kb193aWRlbihzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90KikgY29uc3S7Bk5zdGQ6Ol9fMjo6X19udW1fZ2V0PHdjaGFyX3Q+OjpfX3N0YWdlMl9pbnRfcHJlcChzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90Jim8BvEBc3RkOjpfXzI6Ol9fbnVtX2dldDx3Y2hhcl90Pjo6X19zdGFnZTJfaW50X2xvb3Aod2NoYXJfdCwgaW50LCBjaGFyKiwgY2hhciomLCB1bnNpZ25lZCBpbnQmLCB3Y2hhcl90LCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0JiwgdW5zaWduZWQgaW50KiwgdW5zaWduZWQgaW50KiYsIHdjaGFyX3QgY29uc3QqKb0GtAJzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBsb25nIGxvbmcmKSBjb25zdL4GkANzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiBzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2RvX2dldF9zaWduZWQ8bG9uZyBsb25nPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGxvbmcgbG9uZyYpIGNvbnN0vwa5AnN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHVuc2lnbmVkIHNob3J0JikgY29uc3TABpwDc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19kb19nZXRfdW5zaWduZWQ8dW5zaWduZWQgc2hvcnQ+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdW5zaWduZWQgc2hvcnQmKSBjb25zdMEGtwJzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB1bnNpZ25lZCBpbnQmKSBjb25zdMIGmANzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiBzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2RvX2dldF91bnNpZ25lZDx1bnNpZ25lZCBpbnQ+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdW5zaWduZWQgaW50JikgY29uc3TDBr0Cc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdW5zaWduZWQgbG9uZyBsb25nJikgY29uc3TEBqQDc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19kb19nZXRfdW5zaWduZWQ8dW5zaWduZWQgbG9uZyBsb25nPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHVuc2lnbmVkIGxvbmcgbG9uZyYpIGNvbnN0xQawAnN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGZsb2F0JikgY29uc3TGBpADc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19kb19nZXRfZmxvYXRpbmdfcG9pbnQ8ZmxvYXQ+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgZmxvYXQmKSBjb25zdMcGZHN0ZDo6X18yOjpfX251bV9nZXQ8d2NoYXJfdD46Ol9fc3RhZ2UyX2Zsb2F0X3ByZXAoc3RkOjpfXzI6Omlvc19iYXNlJiwgd2NoYXJfdCosIHdjaGFyX3QmLCB3Y2hhcl90JinIBv8Bc3RkOjpfXzI6Ol9fbnVtX2dldDx3Y2hhcl90Pjo6X19zdGFnZTJfZmxvYXRfbG9vcCh3Y2hhcl90LCBib29sJiwgY2hhciYsIGNoYXIqLCBjaGFyKiYsIHdjaGFyX3QsIHdjaGFyX3QsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QmLCB1bnNpZ25lZCBpbnQqLCB1bnNpZ25lZCBpbnQqJiwgdW5zaWduZWQgaW50Jiwgd2NoYXJfdCopyQaxAnN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGRvdWJsZSYpIGNvbnN0ygaSA3N0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+IHN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZG9fZ2V0X2Zsb2F0aW5nX3BvaW50PGRvdWJsZT4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBkb3VibGUmKSBjb25zdMsGtgJzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBsb25nIGRvdWJsZSYpIGNvbnN0zAacA3N0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+IHN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZG9fZ2V0X2Zsb2F0aW5nX3BvaW50PGxvbmcgZG91YmxlPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGxvbmcgZG91YmxlJikgY29uc3TNBrACc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50Jiwgdm9pZComKSBjb25zdM4GZndjaGFyX3QgY29uc3QqIHN0ZDo6X18yOjpmaW5kPHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90Pih3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QmKc8GZ3djaGFyX3QgY29uc3QqIHN0ZDo6X18yOjpfX251bV9nZXQ8d2NoYXJfdD46Ol9fZG9fd2lkZW5fcDx3Y2hhcl90PihzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90KikgY29uc3TQBs0Bc3RkOjpfXzI6Om51bV9wdXQ8Y2hhciwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCBjaGFyLCBib29sKSBjb25zdNEGXnN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OmJlZ2luKCnSBlxzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjplbmQoKdMGzQFzdGQ6Ol9fMjo6bnVtX3B1dDxjaGFyLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIGNoYXIsIGxvbmcpIGNvbnN01AZOc3RkOjpfXzI6Ol9fbnVtX3B1dF9iYXNlOjpfX2Zvcm1hdF9pbnQoY2hhciosIGNoYXIgY29uc3QqLCBib29sLCB1bnNpZ25lZCBpbnQp1QZXc3RkOjpfXzI6Ol9fbGliY3BwX3NucHJpbnRmX2woY2hhciosIHVuc2lnbmVkIGxvbmcsIF9fbG9jYWxlX3N0cnVjdCosIGNoYXIgY29uc3QqLCAuLi4p1gZVc3RkOjpfXzI6Ol9fbnVtX3B1dF9iYXNlOjpfX2lkZW50aWZ5X3BhZGRpbmcoY2hhciosIGNoYXIqLCBzdGQ6Ol9fMjo6aW9zX2Jhc2UgY29uc3QmKdcGdXN0ZDo6X18yOjpfX251bV9wdXQ8Y2hhcj46Ol9fd2lkZW5fYW5kX2dyb3VwX2ludChjaGFyKiwgY2hhciosIGNoYXIqLCBjaGFyKiwgY2hhciomLCBjaGFyKiYsIHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKdgGK3ZvaWQgc3RkOjpfXzI6OnJldmVyc2U8Y2hhcio+KGNoYXIqLCBjaGFyKinZBiFzdGQ6Ol9fMjo6aW9zX2Jhc2U6OndpZHRoKCkgY29uc3TaBtIBc3RkOjpfXzI6Om51bV9wdXQ8Y2hhciwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCBjaGFyLCBsb25nIGxvbmcpIGNvbnN02wbWAXN0ZDo6X18yOjpudW1fcHV0PGNoYXIsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgY2hhciwgdW5zaWduZWQgbG9uZykgY29uc3TcBtsBc3RkOjpfXzI6Om51bV9wdXQ8Y2hhciwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCBjaGFyLCB1bnNpZ25lZCBsb25nIGxvbmcpIGNvbnN03QbPAXN0ZDo6X18yOjpudW1fcHV0PGNoYXIsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgY2hhciwgZG91YmxlKSBjb25zdN4GSnN0ZDo6X18yOjpfX251bV9wdXRfYmFzZTo6X19mb3JtYXRfZmxvYXQoY2hhciosIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBpbnQp3wYlc3RkOjpfXzI6Omlvc19iYXNlOjpwcmVjaXNpb24oKSBjb25zdOAGSXN0ZDo6X18yOjpfX2xpYmNwcF9hc3ByaW50Zl9sKGNoYXIqKiwgX19sb2NhbGVfc3RydWN0KiwgY2hhciBjb25zdCosIC4uLinhBndzdGQ6Ol9fMjo6X19udW1fcHV0PGNoYXI+OjpfX3dpZGVuX2FuZF9ncm91cF9mbG9hdChjaGFyKiwgY2hhciosIGNoYXIqLCBjaGFyKiwgY2hhciomLCBjaGFyKiYsIHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKeIG1AFzdGQ6Ol9fMjo6bnVtX3B1dDxjaGFyLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIGNoYXIsIGxvbmcgZG91YmxlKSBjb25zdOMG1AFzdGQ6Ol9fMjo6bnVtX3B1dDxjaGFyLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIGNoYXIsIHZvaWQgY29uc3QqKSBjb25zdOQG3wFzdGQ6Ol9fMjo6bnVtX3B1dDx3Y2hhcl90LCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHdjaGFyX3QsIGJvb2wpIGNvbnN05QZlc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6ZW5kKCnmBt8Bc3RkOjpfXzI6Om51bV9wdXQ8d2NoYXJfdCwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90LCBsb25nKSBjb25zdOcGgQFzdGQ6Ol9fMjo6X19udW1fcHV0PHdjaGFyX3Q+OjpfX3dpZGVuX2FuZF9ncm91cF9pbnQoY2hhciosIGNoYXIqLCBjaGFyKiwgd2NoYXJfdCosIHdjaGFyX3QqJiwgd2NoYXJfdComLCBzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JinoBqMCc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gc3RkOjpfXzI6Ol9fcGFkX2FuZF9vdXRwdXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4oc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdCosIHN0ZDo6X18yOjppb3NfYmFzZSYsIHdjaGFyX3Qp6QY0dm9pZCBzdGQ6Ol9fMjo6cmV2ZXJzZTx3Y2hhcl90Kj4od2NoYXJfdCosIHdjaGFyX3QqKeoGhAFzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+OjpiYXNpY19zdHJpbmcodW5zaWduZWQgbG9uZywgd2NoYXJfdCnrBuQBc3RkOjpfXzI6Om51bV9wdXQ8d2NoYXJfdCwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90LCBsb25nIGxvbmcpIGNvbnN07AboAXN0ZDo6X18yOjpudW1fcHV0PHdjaGFyX3QsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgd2NoYXJfdCwgdW5zaWduZWQgbG9uZykgY29uc3TtBu0Bc3RkOjpfXzI6Om51bV9wdXQ8d2NoYXJfdCwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90LCB1bnNpZ25lZCBsb25nIGxvbmcpIGNvbnN07gbhAXN0ZDo6X18yOjpudW1fcHV0PHdjaGFyX3QsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgd2NoYXJfdCwgZG91YmxlKSBjb25zdO8GgwFzdGQ6Ol9fMjo6X19udW1fcHV0PHdjaGFyX3Q+OjpfX3dpZGVuX2FuZF9ncm91cF9mbG9hdChjaGFyKiwgY2hhciosIGNoYXIqLCB3Y2hhcl90Kiwgd2NoYXJfdComLCB3Y2hhcl90KiYsIHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKfAG5gFzdGQ6Ol9fMjo6bnVtX3B1dDx3Y2hhcl90LCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHdjaGFyX3QsIGxvbmcgZG91YmxlKSBjb25zdPEG5gFzdGQ6Ol9fMjo6bnVtX3B1dDx3Y2hhcl90LCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHdjaGFyX3QsIHZvaWQgY29uc3QqKSBjb25zdPIGU3ZvaWQgc3RkOjpfXzI6Ol9fcmV2ZXJzZTxjaGFyKj4oY2hhciosIGNoYXIqLCBzdGQ6Ol9fMjo6cmFuZG9tX2FjY2Vzc19pdGVyYXRvcl90YWcp8wZcdm9pZCBzdGQ6Ol9fMjo6X19yZXZlcnNlPHdjaGFyX3QqPih3Y2hhcl90Kiwgd2NoYXJfdCosIHN0ZDo6X18yOjpyYW5kb21fYWNjZXNzX2l0ZXJhdG9yX3RhZyn0BrACc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmdldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHRtKiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqKSBjb25zdPUGc3N0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19kYXRlX29yZGVyKCkgY29uc3T2Bp4Cc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldF90aW1lKHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdG0qKSBjb25zdPcGngJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0X2RhdGUoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB0bSopIGNvbnN0+AahAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXRfd2Vla2RheShzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHRtKikgY29uc3T5Bq8Cc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0X3dlZWtkYXluYW1lKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYpIGNvbnN0+gajAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXRfbW9udGhuYW1lKHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdG0qKSBjb25zdPsGrQJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfbW9udGhuYW1lKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYpIGNvbnN0/AaeAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXRfeWVhcihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHRtKikgY29uc3T9BqgCc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0X3llYXIoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JikgY29uc3T+BqUCaW50IHN0ZDo6X18yOjpfX2dldF91cF90b19uX2RpZ2l0czxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYsIGludCn/BqUCc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHRtKiwgY2hhciwgY2hhcikgY29uc3SAB6UCc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0X3BlcmNlbnQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JikgY29uc3SBB6cCc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0X2RheShpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdIIHqAJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfaG91cihpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdIMHqwJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfMTJfaG91cihpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdIQHsAJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfZGF5X3llYXJfbnVtKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYpIGNvbnN0hQepAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2dldF9tb250aChpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdIYHqgJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfbWludXRlKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYpIGNvbnN0hwepAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2dldF93aGl0ZV9zcGFjZShzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdIgHqQJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfYW1fcG0oaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JikgY29uc3SJB6oCc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0X3NlY29uZChpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdIoHqwJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfd2Vla2RheShpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdIsHqQJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfeWVhcjQoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JikgY29uc3SMB8sCc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmdldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHRtKiwgd2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqKSBjb25zdI0HswJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0X3RpbWUoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB0bSopIGNvbnN0jgezAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXRfZGF0ZShzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHRtKikgY29uc3SPB7YCc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldF93ZWVrZGF5KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdG0qKSBjb25zdJAHxwJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfd2Vla2RheW5hbWUoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JikgY29uc3SRB7gCc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldF9tb250aG5hbWUoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB0bSopIGNvbnN0kgfFAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF9tb250aG5hbWUoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JikgY29uc3STB7MCc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldF95ZWFyKHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdG0qKSBjb25zdJQHwAJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfeWVhcihpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmKSBjb25zdJUHvQJpbnQgc3RkOjpfXzI6Ol9fZ2V0X3VwX3RvX25fZGlnaXRzPHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JiwgaW50KZYHugJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdG0qLCBjaGFyLCBjaGFyKSBjb25zdJcHvQJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfcGVyY2VudChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmKSBjb25zdJgHvwJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfZGF5KGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN0mQfAAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF9ob3VyKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN0mgfDAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF8xMl9ob3VyKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN0mwfIAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF9kYXlfeWVhcl9udW0oaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JikgY29uc3ScB8ECc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZ2V0X21vbnRoKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN0nQfCAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF9taW51dGUoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JikgY29uc3SeB8ECc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZ2V0X3doaXRlX3NwYWNlKHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN0nwfBAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF9hbV9wbShpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmKSBjb25zdKAHwgJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfc2Vjb25kKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN0oQfDAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF93ZWVrZGF5KGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN0ogfBAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF95ZWFyNChpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmKSBjb25zdKMH3wFzdGQ6Ol9fMjo6dGltZV9wdXQ8Y2hhciwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCBjaGFyLCB0bSBjb25zdCosIGNoYXIsIGNoYXIpIGNvbnN0pAdKc3RkOjpfXzI6Ol9fdGltZV9wdXQ6Ol9fZG9fcHV0KGNoYXIqLCBjaGFyKiYsIHRtIGNvbnN0KiwgY2hhciwgY2hhcikgY29uc3SlB40Bc3RkOjpfXzI6OmVuYWJsZV9pZjwoaXNfbW92ZV9jb25zdHJ1Y3RpYmxlPGNoYXI+Ojp2YWx1ZSkgJiYgKGlzX21vdmVfYXNzaWduYWJsZTxjaGFyPjo6dmFsdWUpLCB2b2lkPjo6dHlwZSBzdGQ6Ol9fMjo6c3dhcDxjaGFyPihjaGFyJiwgY2hhciYppgfuAXN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+IHN0ZDo6X18yOjpfX2NvcHk8Y2hhciosIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID4oY2hhciosIGNoYXIqLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPimnB/EBc3RkOjpfXzI6OnRpbWVfcHV0PHdjaGFyX3QsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgd2NoYXJfdCwgdG0gY29uc3QqLCBjaGFyLCBjaGFyKSBjb25zdKgHUHN0ZDo6X18yOjpfX3RpbWVfcHV0OjpfX2RvX3B1dCh3Y2hhcl90Kiwgd2NoYXJfdComLCB0bSBjb25zdCosIGNoYXIsIGNoYXIpIGNvbnN0qQdlc3RkOjpfXzI6Ol9fbGliY3BwX21ic3J0b3djc19sKHdjaGFyX3QqLCBjaGFyIGNvbnN0KiosIHVuc2lnbmVkIGxvbmcsIF9fbWJzdGF0ZV90KiwgX19sb2NhbGVfc3RydWN0KimqByxzdGQ6Ol9fMjo6X190aHJvd19ydW50aW1lX2Vycm9yKGNoYXIgY29uc3QqKasHiQJzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiBzdGQ6Ol9fMjo6X19jb3B5PHdjaGFyX3QqLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+KHdjaGFyX3QqLCB3Y2hhcl90Kiwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4prAc7c3RkOjpfXzI6Om1vbmV5cHVuY3Q8Y2hhciwgZmFsc2U+Ojpkb19kZWNpbWFsX3BvaW50KCkgY29uc3StBzZzdGQ6Ol9fMjo6bW9uZXlwdW5jdDxjaGFyLCBmYWxzZT46OmRvX2dyb3VwaW5nKCkgY29uc3SuBztzdGQ6Ol9fMjo6bW9uZXlwdW5jdDxjaGFyLCBmYWxzZT46OmRvX25lZ2F0aXZlX3NpZ24oKSBjb25zdK8HOHN0ZDo6X18yOjptb25leXB1bmN0PGNoYXIsIGZhbHNlPjo6ZG9fcG9zX2Zvcm1hdCgpIGNvbnN0sAc+c3RkOjpfXzI6Om1vbmV5cHVuY3Q8d2NoYXJfdCwgZmFsc2U+Ojpkb19kZWNpbWFsX3BvaW50KCkgY29uc3SxBz5zdGQ6Ol9fMjo6bW9uZXlwdW5jdDx3Y2hhcl90LCBmYWxzZT46OmRvX25lZ2F0aXZlX3NpZ24oKSBjb25zdLIHqQJzdGQ6Ol9fMjo6bW9uZXlfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIGJvb2wsIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGxvbmcgZG91YmxlJikgY29uc3SzB4wDc3RkOjpfXzI6Om1vbmV5X2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2RvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBib29sLCBzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JiwgdW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQmLCBib29sJiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0Jiwgc3RkOjpfXzI6OnVuaXF1ZV9wdHI8Y2hhciwgdm9pZCAoKikodm9pZCopPiYsIGNoYXIqJiwgY2hhcioptAfdA3N0ZDo6X18yOjpfX21vbmV5X2dldDxjaGFyPjo6X19nYXRoZXJfaW5mbyhib29sLCBzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0Jiwgc3RkOjpfXzI6Om1vbmV5X2Jhc2U6OnBhdHRlcm4mLCBjaGFyJiwgY2hhciYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4mLCBpbnQmKbUHUnN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpvcGVyYXRvcisrKGludCm2B2Z2b2lkIHN0ZDo6X18yOjpfX2RvdWJsZV9vcl9ub3RoaW5nPGNoYXI+KHN0ZDo6X18yOjp1bmlxdWVfcHRyPGNoYXIsIHZvaWQgKCopKHZvaWQqKT4mLCBjaGFyKiYsIGNoYXIqJim3B4YBdm9pZCBzdGQ6Ol9fMjo6X19kb3VibGVfb3Jfbm90aGluZzx1bnNpZ25lZCBpbnQ+KHN0ZDo6X18yOjp1bmlxdWVfcHRyPHVuc2lnbmVkIGludCwgdm9pZCAoKikodm9pZCopPiYsIHVuc2lnbmVkIGludComLCB1bnNpZ25lZCBpbnQqJim4B/MCc3RkOjpfXzI6Om1vbmV5X2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBib29sLCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+JikgY29uc3S5B15zdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpjbGVhcigpugfaAXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4mIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46Ol9fYXBwZW5kX2ZvcndhcmRfdW5zYWZlPGNoYXIqPihjaGFyKiwgY2hhciopuwd3c3RkOjpfXzI6Om1vbmV5cHVuY3Q8Y2hhciwgdHJ1ZT4gY29uc3QmIHN0ZDo6X18yOjp1c2VfZmFjZXQ8c3RkOjpfXzI6Om1vbmV5cHVuY3Q8Y2hhciwgdHJ1ZT4gPihzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0Jim8B7kBc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6b3BlcmF0b3I9KHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4mJim9B3lzdGQ6Ol9fMjo6bW9uZXlwdW5jdDxjaGFyLCBmYWxzZT4gY29uc3QmIHN0ZDo6X18yOjp1c2VfZmFjZXQ8c3RkOjpfXzI6Om1vbmV5cHVuY3Q8Y2hhciwgZmFsc2U+ID4oc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYpvgfvAWJvb2wgc3RkOjpfXzI6OmVxdWFsPHN0ZDo6X18yOjpfX3dyYXBfaXRlcjxjaGFyKj4sIHN0ZDo6X18yOjpfX3dyYXBfaXRlcjxjaGFyKj4sIHN0ZDo6X18yOjpfX2VxdWFsX3RvPGNoYXIsIGNoYXI+ID4oc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPGNoYXIqPiwgc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPGNoYXIqPiwgc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPGNoYXIqPiwgc3RkOjpfXzI6Ol9fZXF1YWxfdG88Y2hhciwgY2hhcj4pvwczc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPGNoYXIqPjo6b3BlcmF0b3IrKGxvbmcpIGNvbnN0wAdlc3RkOjpfXzI6OnVuaXF1ZV9wdHI8Y2hhciwgdm9pZCAoKikodm9pZCopPjo6b3BlcmF0b3I9KHN0ZDo6X18yOjp1bmlxdWVfcHRyPGNoYXIsIHZvaWQgKCopKHZvaWQqKT4mJinBB74Cc3RkOjpfXzI6Om1vbmV5X2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBib29sLCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBsb25nIGRvdWJsZSYpIGNvbnN0wgetA3N0ZDo6X18yOjptb25leV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19kb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgYm9vbCwgc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50JiwgYm9vbCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYsIHN0ZDo6X18yOjp1bmlxdWVfcHRyPHdjaGFyX3QsIHZvaWQgKCopKHZvaWQqKT4mLCB3Y2hhcl90KiYsIHdjaGFyX3QqKcMHgQRzdGQ6Ol9fMjo6X19tb25leV9nZXQ8d2NoYXJfdD46Ol9fZ2F0aGVyX2luZm8oYm9vbCwgc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYsIHN0ZDo6X18yOjptb25leV9iYXNlOjpwYXR0ZXJuJiwgd2NoYXJfdCYsIHdjaGFyX3QmLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+JiwgaW50JinEB1hzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6b3BlcmF0b3IrKyhpbnQpxQeRA3N0ZDo6X18yOjptb25leV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgYm9vbCwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiYpIGNvbnN0xgdnc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6Y2xlYXIoKccH9QFzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+JiBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+OjpfX2FwcGVuZF9mb3J3YXJkX3Vuc2FmZTx3Y2hhcl90Kj4od2NoYXJfdCosIHdjaGFyX3QqKcgHfXN0ZDo6X18yOjptb25leXB1bmN0PHdjaGFyX3QsIHRydWU+IGNvbnN0JiBzdGQ6Ol9fMjo6dXNlX2ZhY2V0PHN0ZDo6X18yOjptb25leXB1bmN0PHdjaGFyX3QsIHRydWU+ID4oc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYpyQfLAXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID46Om9wZXJhdG9yPShzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+JiYpygd/c3RkOjpfXzI6Om1vbmV5cHVuY3Q8d2NoYXJfdCwgZmFsc2U+IGNvbnN0JiBzdGQ6Ol9fMjo6dXNlX2ZhY2V0PHN0ZDo6X18yOjptb25leXB1bmN0PHdjaGFyX3QsIGZhbHNlPiA+KHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKcsHigJib29sIHN0ZDo6X18yOjplcXVhbDxzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8d2NoYXJfdCo+LCBzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8d2NoYXJfdCo+LCBzdGQ6Ol9fMjo6X19lcXVhbF90bzx3Y2hhcl90LCB3Y2hhcl90PiA+KHN0ZDo6X18yOjpfX3dyYXBfaXRlcjx3Y2hhcl90Kj4sIHN0ZDo6X18yOjpfX3dyYXBfaXRlcjx3Y2hhcl90Kj4sIHN0ZDo6X18yOjpfX3dyYXBfaXRlcjx3Y2hhcl90Kj4sIHN0ZDo6X18yOjpfX2VxdWFsX3RvPHdjaGFyX3QsIHdjaGFyX3Q+KcwHNnN0ZDo6X18yOjpfX3dyYXBfaXRlcjx3Y2hhcl90Kj46Om9wZXJhdG9yKyhsb25nKSBjb25zdM0H3AFzdGQ6Ol9fMjo6bW9uZXlfcHV0PGNoYXIsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgYm9vbCwgc3RkOjpfXzI6Omlvc19iYXNlJiwgY2hhciwgbG9uZyBkb3VibGUpIGNvbnN0zgeLA3N0ZDo6X18yOjpfX21vbmV5X3B1dDxjaGFyPjo6X19nYXRoZXJfaW5mbyhib29sLCBib29sLCBzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0Jiwgc3RkOjpfXzI6Om1vbmV5X2Jhc2U6OnBhdHRlcm4mLCBjaGFyJiwgY2hhciYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiYsIGludCYpzwfZA3N0ZDo6X18yOjpfX21vbmV5X3B1dDxjaGFyPjo6X19mb3JtYXQoY2hhciosIGNoYXIqJiwgY2hhciomLCB1bnNpZ25lZCBpbnQsIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0Kiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JiwgYm9vbCwgc3RkOjpfXzI6Om1vbmV5X2Jhc2U6OnBhdHRlcm4gY29uc3QmLCBjaGFyLCBjaGFyLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QmLCBpbnQp0AeOAWNoYXIqIHN0ZDo6X18yOjpjb3B5PHN0ZDo6X18yOjpfX3dyYXBfaXRlcjxjaGFyIGNvbnN0Kj4sIGNoYXIqPihzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8Y2hhciBjb25zdCo+LCBzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8Y2hhciBjb25zdCo+LCBjaGFyKinRB60Cc3RkOjpfXzI6Om1vbmV5X3B1dDxjaGFyLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIGJvb2wsIHN0ZDo6X18yOjppb3NfYmFzZSYsIGNoYXIsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QmKSBjb25zdNIH7gFzdGQ6Ol9fMjo6bW9uZXlfcHV0PHdjaGFyX3QsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgYm9vbCwgc3RkOjpfXzI6Omlvc19iYXNlJiwgd2NoYXJfdCwgbG9uZyBkb3VibGUpIGNvbnN00wemA3N0ZDo6X18yOjpfX21vbmV5X3B1dDx3Y2hhcl90Pjo6X19nYXRoZXJfaW5mbyhib29sLCBib29sLCBzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0Jiwgc3RkOjpfXzI6Om1vbmV5X2Jhc2U6OnBhdHRlcm4mLCB3Y2hhcl90Jiwgd2NoYXJfdCYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiYsIGludCYp1AeGBHN0ZDo6X18yOjpfX21vbmV5X3B1dDx3Y2hhcl90Pjo6X19mb3JtYXQod2NoYXJfdCosIHdjaGFyX3QqJiwgd2NoYXJfdComLCB1bnNpZ25lZCBpbnQsIHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0Kiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JiwgYm9vbCwgc3RkOjpfXzI6Om1vbmV5X2Jhc2U6OnBhdHRlcm4gY29uc3QmLCB3Y2hhcl90LCB3Y2hhcl90LCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiBjb25zdCYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4gY29uc3QmLCBpbnQp1QegAXdjaGFyX3QqIHN0ZDo6X18yOjpjb3B5PHN0ZDo6X18yOjpfX3dyYXBfaXRlcjx3Y2hhcl90IGNvbnN0Kj4sIHdjaGFyX3QqPihzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8d2NoYXJfdCBjb25zdCo+LCBzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8d2NoYXJfdCBjb25zdCo+LCB3Y2hhcl90KinWB8gCc3RkOjpfXzI6Om1vbmV5X3B1dDx3Y2hhcl90LCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIGJvb2wsIHN0ZDo6X18yOjppb3NfYmFzZSYsIHdjaGFyX3QsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4gY29uc3QmKSBjb25zdNcHkAFjaGFyKiBzdGQ6Ol9fMjo6X19jb3B5PHN0ZDo6X18yOjpfX3dyYXBfaXRlcjxjaGFyIGNvbnN0Kj4sIGNoYXIqPihzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8Y2hhciBjb25zdCo+LCBzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8Y2hhciBjb25zdCo+LCBjaGFyKinYB6IBd2NoYXJfdCogc3RkOjpfXzI6Ol9fY29weTxzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8d2NoYXJfdCBjb25zdCo+LCB3Y2hhcl90Kj4oc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPHdjaGFyX3QgY29uc3QqPiwgc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPHdjaGFyX3QgY29uc3QqPiwgd2NoYXJfdCop2QeeAXN0ZDo6X18yOjptZXNzYWdlczxjaGFyPjo6ZG9fb3BlbihzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0Jiwgc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYpIGNvbnN02geUAXN0ZDo6X18yOjptZXNzYWdlczxjaGFyPjo6ZG9fZ2V0KGxvbmcsIGludCwgaW50LCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0JikgY29uc3TbB7gDc3RkOjpfXzI6OmJhY2tfaW5zZXJ0X2l0ZXJhdG9yPHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gPiBzdGQ6Ol9fMjo6X19uYXJyb3dfdG9fdXRmODw4dWw+OjpvcGVyYXRvcigpPHN0ZDo6X18yOjpiYWNrX2luc2VydF9pdGVyYXRvcjxzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+ID4sIGNoYXI+KHN0ZDo6X18yOjpiYWNrX2luc2VydF9pdGVyYXRvcjxzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+ID4sIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KikgY29uc3TcB44Bc3RkOjpfXzI6OmJhY2tfaW5zZXJ0X2l0ZXJhdG9yPHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gPjo6b3BlcmF0b3I9KGNoYXIgY29uc3QmKd0HoAFzdGQ6Ol9fMjo6bWVzc2FnZXM8d2NoYXJfdD46OmRvX2dldChsb25nLCBpbnQsIGludCwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiBjb25zdCYpIGNvbnN03gfCA3N0ZDo6X18yOjpiYWNrX2luc2VydF9pdGVyYXRvcjxzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+ID4gc3RkOjpfXzI6Ol9fbmFycm93X3RvX3V0Zjg8MzJ1bD46Om9wZXJhdG9yKCk8c3RkOjpfXzI6OmJhY2tfaW5zZXJ0X2l0ZXJhdG9yPHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gPiwgd2NoYXJfdD4oc3RkOjpfXzI6OmJhY2tfaW5zZXJ0X2l0ZXJhdG9yPHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gPiwgd2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqKSBjb25zdN8H0ANzdGQ6Ol9fMjo6YmFja19pbnNlcnRfaXRlcmF0b3I8c3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiA+IHN0ZDo6X18yOjpfX3dpZGVuX2Zyb21fdXRmODwzMnVsPjo6b3BlcmF0b3IoKTxzdGQ6Ol9fMjo6YmFja19pbnNlcnRfaXRlcmF0b3I8c3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiA+ID4oc3RkOjpfXzI6OmJhY2tfaW5zZXJ0X2l0ZXJhdG9yPHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4gPiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqKSBjb25zdOAHOXN0ZDo6X18yOjpjb2RlY3Z0PHdjaGFyX3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6fmNvZGVjdnQoKeEHLXN0ZDo6X18yOjpsb2NhbGU6Ol9faW1wOjpfX2ltcCh1bnNpZ25lZCBsb25nKeIHfnN0ZDo6X18yOjpfX3ZlY3Rvcl9iYXNlPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46Ol9fdmVjdG9yX2Jhc2UoKeMHggFzdGQ6Ol9fMjo6dmVjdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46Ol9fdmFsbG9jYXRlKHVuc2lnbmVkIGxvbmcp5AeJAXN0ZDo6X18yOjp2ZWN0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4gPjo6X19jb25zdHJ1Y3RfYXRfZW5kKHVuc2lnbmVkIGxvbmcp5Qd2c3RkOjpfXzI6Ol9fdmVjdG9yX2Jhc2U8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4gPjo6Y2xlYXIoKeYHjgFzdGQ6Ol9fMjo6dmVjdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46Ol9fYW5ub3RhdGVfc2hyaW5rKHVuc2lnbmVkIGxvbmcpIGNvbnN05wcdc3RkOjpfXzI6OmxvY2FsZTo6aWQ6Ol9fZ2V0KCnoB0BzdGQ6Ol9fMjo6bG9jYWxlOjpfX2ltcDo6aW5zdGFsbChzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIGxvbmcp6QdIc3RkOjpfXzI6OmN0eXBlPGNoYXI+OjpjdHlwZSh1bnNpZ25lZCBzaG9ydCBjb25zdCosIGJvb2wsIHVuc2lnbmVkIGxvbmcp6gcbc3RkOjpfXzI6OmxvY2FsZTo6Y2xhc3NpYygp6wd9c3RkOjpfXzI6OnZlY3RvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiA+OjpyZXNpemUodW5zaWduZWQgbG9uZynsByFzdGQ6Ol9fMjo6bG9jYWxlOjpfX2ltcDo6fl9faW1wKCntB4EBc3RkOjpfXzI6OnZlY3RvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiA+OjpfX2Fubm90YXRlX2RlbGV0ZSgpIGNvbnN07gcjc3RkOjpfXzI6OmxvY2FsZTo6X19pbXA6On5fX2ltcCgpLjHvB39zdGQ6Ol9fMjo6dmVjdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46Ol9fYXBwZW5kKHVuc2lnbmVkIGxvbmcp8Accc3RkOjpfXzI6OmxvY2FsZTo6X19nbG9iYWwoKfEHGnN0ZDo6X18yOjpsb2NhbGU6OmxvY2FsZSgp8gcuc3RkOjpfXzI6OmxvY2FsZTo6X19pbXA6Omhhc19mYWNldChsb25nKSBjb25zdPMHHnN0ZDo6X18yOjpsb2NhbGU6OmlkOjpfX2luaXQoKfQHjAF2b2lkIHN0ZDo6X18yOjpjYWxsX29uY2U8c3RkOjpfXzI6Oihhbm9ueW1vdXMgbmFtZXNwYWNlKTo6X19mYWtlX2JpbmQ+KHN0ZDo6X18yOjpvbmNlX2ZsYWcmLCBzdGQ6Ol9fMjo6KGFub255bW91cyBuYW1lc3BhY2UpOjpfX2Zha2VfYmluZCYmKfUHK3N0ZDo6X18yOjpsb2NhbGU6OmZhY2V0OjpfX29uX3plcm9fc2hhcmVkKCn2B2l2b2lkIHN0ZDo6X18yOjpfX2NhbGxfb25jZV9wcm94eTxzdGQ6Ol9fMjo6dHVwbGU8c3RkOjpfXzI6Oihhbm9ueW1vdXMgbmFtZXNwYWNlKTo6X19mYWtlX2JpbmQmJj4gPih2b2lkKin3Bz5zdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD46OmRvX2lzKHVuc2lnbmVkIHNob3J0LCB3Y2hhcl90KSBjb25zdPgHVnN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90Pjo6ZG9faXMod2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqLCB1bnNpZ25lZCBzaG9ydCopIGNvbnN0+Qdac3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+Ojpkb19zY2FuX2lzKHVuc2lnbmVkIHNob3J0LCB3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdCopIGNvbnN0+gdbc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+Ojpkb19zY2FuX25vdCh1bnNpZ25lZCBzaG9ydCwgd2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqKSBjb25zdPsHM3N0ZDo6X18yOjpjdHlwZTx3Y2hhcl90Pjo6ZG9fdG91cHBlcih3Y2hhcl90KSBjb25zdPwHRHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90Pjo6ZG9fdG91cHBlcih3Y2hhcl90Kiwgd2NoYXJfdCBjb25zdCopIGNvbnN0/Qczc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+Ojpkb190b2xvd2VyKHdjaGFyX3QpIGNvbnN0/gdEc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+Ojpkb190b2xvd2VyKHdjaGFyX3QqLCB3Y2hhcl90IGNvbnN0KikgY29uc3T/By5zdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD46OmRvX3dpZGVuKGNoYXIpIGNvbnN0gAhMc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+Ojpkb193aWRlbihjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHdjaGFyX3QqKSBjb25zdIEIOHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90Pjo6ZG9fbmFycm93KHdjaGFyX3QsIGNoYXIpIGNvbnN0gghWc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+Ojpkb19uYXJyb3cod2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqLCBjaGFyLCBjaGFyKikgY29uc3SDCB9zdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj46On5jdHlwZSgphAghc3RkOjpfXzI6OmN0eXBlPGNoYXI+Ojp+Y3R5cGUoKS4xhQgtc3RkOjpfXzI6OmN0eXBlPGNoYXI+Ojpkb190b3VwcGVyKGNoYXIpIGNvbnN0hgg7c3RkOjpfXzI6OmN0eXBlPGNoYXI+Ojpkb190b3VwcGVyKGNoYXIqLCBjaGFyIGNvbnN0KikgY29uc3SHCC1zdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj46OmRvX3RvbG93ZXIoY2hhcikgY29uc3SICDtzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj46OmRvX3RvbG93ZXIoY2hhciosIGNoYXIgY29uc3QqKSBjb25zdIkIRnN0ZDo6X18yOjpjdHlwZTxjaGFyPjo6ZG9fd2lkZW4oY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCBjaGFyKikgY29uc3SKCDJzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj46OmRvX25hcnJvdyhjaGFyLCBjaGFyKSBjb25zdIsITXN0ZDo6X18yOjpjdHlwZTxjaGFyPjo6ZG9fbmFycm93KGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgY2hhciwgY2hhciopIGNvbnN0jAiEAXN0ZDo6X18yOjpjb2RlY3Z0PGNoYXIsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9fb3V0KF9fbWJzdGF0ZV90JiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiYsIGNoYXIqLCBjaGFyKiwgY2hhciomKSBjb25zdI0IYHN0ZDo6X18yOjpjb2RlY3Z0PGNoYXIsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9fdW5zaGlmdChfX21ic3RhdGVfdCYsIGNoYXIqLCBjaGFyKiwgY2hhciomKSBjb25zdI4IcnN0ZDo6X18yOjpjb2RlY3Z0PGNoYXIsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9fbGVuZ3RoKF9fbWJzdGF0ZV90JiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBsb25nKSBjb25zdI8IO3N0ZDo6X18yOjpjb2RlY3Z0PHdjaGFyX3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6fmNvZGVjdnQoKS4xkAiQAXN0ZDo6X18yOjpjb2RlY3Z0PHdjaGFyX3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9fb3V0KF9fbWJzdGF0ZV90Jiwgd2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0KiYsIGNoYXIqLCBjaGFyKiwgY2hhciomKSBjb25zdJEIdXN0ZDo6X18yOjpfX2xpYmNwcF93Y3NucnRvbWJzX2woY2hhciosIHdjaGFyX3QgY29uc3QqKiwgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgX19tYnN0YXRlX3QqLCBfX2xvY2FsZV9zdHJ1Y3QqKZIITHN0ZDo6X18yOjpfX2xpYmNwcF93Y3J0b21iX2woY2hhciosIHdjaGFyX3QsIF9fbWJzdGF0ZV90KiwgX19sb2NhbGVfc3RydWN0KimTCI8Bc3RkOjpfXzI6OmNvZGVjdnQ8d2NoYXJfdCwgY2hhciwgX19tYnN0YXRlX3Q+Ojpkb19pbihfX21ic3RhdGVfdCYsIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdComLCB3Y2hhcl90Kiwgd2NoYXJfdCosIHdjaGFyX3QqJikgY29uc3SUCHVzdGQ6Ol9fMjo6X19saWJjcHBfbWJzbnJ0b3djc19sKHdjaGFyX3QqLCBjaGFyIGNvbnN0KiosIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIF9fbWJzdGF0ZV90KiwgX19sb2NhbGVfc3RydWN0KimVCGJzdGQ6Ol9fMjo6X19saWJjcHBfbWJydG93Y19sKHdjaGFyX3QqLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgbG9uZywgX19tYnN0YXRlX3QqLCBfX2xvY2FsZV9zdHJ1Y3QqKZYIY3N0ZDo6X18yOjpjb2RlY3Z0PHdjaGFyX3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9fdW5zaGlmdChfX21ic3RhdGVfdCYsIGNoYXIqLCBjaGFyKiwgY2hhciomKSBjb25zdJcIQnN0ZDo6X18yOjpjb2RlY3Z0PHdjaGFyX3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9fZW5jb2RpbmcoKSBjb25zdJgIU3N0ZDo6X18yOjpfX2xpYmNwcF9tYnRvd2NfbCh3Y2hhcl90KiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGxvbmcsIF9fbG9jYWxlX3N0cnVjdCopmQgxc3RkOjpfXzI6Ol9fbGliY3BwX21iX2N1cl9tYXhfbChfX2xvY2FsZV9zdHJ1Y3QqKZoIdXN0ZDo6X18yOjpjb2RlY3Z0PHdjaGFyX3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9fbGVuZ3RoKF9fbWJzdGF0ZV90JiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBsb25nKSBjb25zdJsIV3N0ZDo6X18yOjpfX2xpYmNwcF9tYnJsZW5fbChjaGFyIGNvbnN0KiwgdW5zaWduZWQgbG9uZywgX19tYnN0YXRlX3QqLCBfX2xvY2FsZV9zdHJ1Y3QqKZwIRHN0ZDo6X18yOjpjb2RlY3Z0PHdjaGFyX3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9fbWF4X2xlbmd0aCgpIGNvbnN0nQiUAXN0ZDo6X18yOjpjb2RlY3Z0PGNoYXIxNl90LCBjaGFyLCBfX21ic3RhdGVfdD46OmRvX291dChfX21ic3RhdGVfdCYsIGNoYXIxNl90IGNvbnN0KiwgY2hhcjE2X3QgY29uc3QqLCBjaGFyMTZfdCBjb25zdComLCBjaGFyKiwgY2hhciosIGNoYXIqJikgY29uc3SeCLUBc3RkOjpfXzI6OnV0ZjE2X3RvX3V0ZjgodW5zaWduZWQgc2hvcnQgY29uc3QqLCB1bnNpZ25lZCBzaG9ydCBjb25zdCosIHVuc2lnbmVkIHNob3J0IGNvbnN0KiYsIHVuc2lnbmVkIGNoYXIqLCB1bnNpZ25lZCBjaGFyKiwgdW5zaWduZWQgY2hhciomLCB1bnNpZ25lZCBsb25nLCBzdGQ6Ol9fMjo6Y29kZWN2dF9tb2RlKZ8IkwFzdGQ6Ol9fMjo6Y29kZWN2dDxjaGFyMTZfdCwgY2hhciwgX19tYnN0YXRlX3Q+Ojpkb19pbihfX21ic3RhdGVfdCYsIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdComLCBjaGFyMTZfdCosIGNoYXIxNl90KiwgY2hhcjE2X3QqJikgY29uc3SgCLUBc3RkOjpfXzI6OnV0ZjhfdG9fdXRmMTYodW5zaWduZWQgY2hhciBjb25zdCosIHVuc2lnbmVkIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBjaGFyIGNvbnN0KiYsIHVuc2lnbmVkIHNob3J0KiwgdW5zaWduZWQgc2hvcnQqLCB1bnNpZ25lZCBzaG9ydComLCB1bnNpZ25lZCBsb25nLCBzdGQ6Ol9fMjo6Y29kZWN2dF9tb2RlKaEIdnN0ZDo6X18yOjpjb2RlY3Z0PGNoYXIxNl90LCBjaGFyLCBfX21ic3RhdGVfdD46OmRvX2xlbmd0aChfX21ic3RhdGVfdCYsIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgbG9uZykgY29uc3SiCIABc3RkOjpfXzI6OnV0ZjhfdG9fdXRmMTZfbGVuZ3RoKHVuc2lnbmVkIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgc3RkOjpfXzI6OmNvZGVjdnRfbW9kZSmjCEVzdGQ6Ol9fMjo6Y29kZWN2dDxjaGFyMTZfdCwgY2hhciwgX19tYnN0YXRlX3Q+Ojpkb19tYXhfbGVuZ3RoKCkgY29uc3SkCJQBc3RkOjpfXzI6OmNvZGVjdnQ8Y2hhcjMyX3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9fb3V0KF9fbWJzdGF0ZV90JiwgY2hhcjMyX3QgY29uc3QqLCBjaGFyMzJfdCBjb25zdCosIGNoYXIzMl90IGNvbnN0KiYsIGNoYXIqLCBjaGFyKiwgY2hhciomKSBjb25zdKUIrgFzdGQ6Ol9fMjo6dWNzNF90b191dGY4KHVuc2lnbmVkIGludCBjb25zdCosIHVuc2lnbmVkIGludCBjb25zdCosIHVuc2lnbmVkIGludCBjb25zdComLCB1bnNpZ25lZCBjaGFyKiwgdW5zaWduZWQgY2hhciosIHVuc2lnbmVkIGNoYXIqJiwgdW5zaWduZWQgbG9uZywgc3RkOjpfXzI6OmNvZGVjdnRfbW9kZSmmCJMBc3RkOjpfXzI6OmNvZGVjdnQ8Y2hhcjMyX3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9faW4oX19tYnN0YXRlX3QmLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqJiwgY2hhcjMyX3QqLCBjaGFyMzJfdCosIGNoYXIzMl90KiYpIGNvbnN0pwiuAXN0ZDo6X18yOjp1dGY4X3RvX3VjczQodW5zaWduZWQgY2hhciBjb25zdCosIHVuc2lnbmVkIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBjaGFyIGNvbnN0KiYsIHVuc2lnbmVkIGludCosIHVuc2lnbmVkIGludCosIHVuc2lnbmVkIGludComLCB1bnNpZ25lZCBsb25nLCBzdGQ6Ol9fMjo6Y29kZWN2dF9tb2RlKagIdnN0ZDo6X18yOjpjb2RlY3Z0PGNoYXIzMl90LCBjaGFyLCBfX21ic3RhdGVfdD46OmRvX2xlbmd0aChfX21ic3RhdGVfdCYsIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgbG9uZykgY29uc3SpCH9zdGQ6Ol9fMjo6dXRmOF90b191Y3M0X2xlbmd0aCh1bnNpZ25lZCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgY2hhciBjb25zdCosIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIHN0ZDo6X18yOjpjb2RlY3Z0X21vZGUpqgglc3RkOjpfXzI6Om51bXB1bmN0PGNoYXI+Ojp+bnVtcHVuY3QoKasIJ3N0ZDo6X18yOjpudW1wdW5jdDxjaGFyPjo6fm51bXB1bmN0KCkuMawIKHN0ZDo6X18yOjpudW1wdW5jdDx3Y2hhcl90Pjo6fm51bXB1bmN0KCmtCCpzdGQ6Ol9fMjo6bnVtcHVuY3Q8d2NoYXJfdD46On5udW1wdW5jdCgpLjGuCDJzdGQ6Ol9fMjo6bnVtcHVuY3Q8Y2hhcj46OmRvX2RlY2ltYWxfcG9pbnQoKSBjb25zdK8IMnN0ZDo6X18yOjpudW1wdW5jdDxjaGFyPjo6ZG9fdGhvdXNhbmRzX3NlcCgpIGNvbnN0sAgtc3RkOjpfXzI6Om51bXB1bmN0PGNoYXI+Ojpkb19ncm91cGluZygpIGNvbnN0sQgwc3RkOjpfXzI6Om51bXB1bmN0PHdjaGFyX3Q+Ojpkb19ncm91cGluZygpIGNvbnN0sggtc3RkOjpfXzI6Om51bXB1bmN0PGNoYXI+Ojpkb190cnVlbmFtZSgpIGNvbnN0swgwc3RkOjpfXzI6Om51bXB1bmN0PHdjaGFyX3Q+Ojpkb190cnVlbmFtZSgpIGNvbnN0tAh8c3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6YmFzaWNfc3RyaW5nKHdjaGFyX3QgY29uc3QqKbUILnN0ZDo6X18yOjpudW1wdW5jdDxjaGFyPjo6ZG9fZmFsc2VuYW1lKCkgY29uc3S2CDFzdGQ6Ol9fMjo6bnVtcHVuY3Q8d2NoYXJfdD46OmRvX2ZhbHNlbmFtZSgpIGNvbnN0twhtc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6b3BlcmF0b3I9KGNoYXIgY29uc3QqKbgINXN0ZDo6X18yOjpfX3RpbWVfZ2V0X2Nfc3RvcmFnZTxjaGFyPjo6X193ZWVrcygpIGNvbnN0uQgWc3RkOjpfXzI6OmluaXRfd2Vla3MoKboIGl9fY3h4X2dsb2JhbF9hcnJheV9kdG9yLjU0uwg4c3RkOjpfXzI6Ol9fdGltZV9nZXRfY19zdG9yYWdlPHdjaGFyX3Q+OjpfX3dlZWtzKCkgY29uc3S8CBdzdGQ6Ol9fMjo6aW5pdF93d2Vla3MoKb0IGl9fY3h4X2dsb2JhbF9hcnJheV9kdG9yLjY5vgh5c3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6b3BlcmF0b3I9KHdjaGFyX3QgY29uc3QqKb8INnN0ZDo6X18yOjpfX3RpbWVfZ2V0X2Nfc3RvcmFnZTxjaGFyPjo6X19tb250aHMoKSBjb25zdMAIF3N0ZDo6X18yOjppbml0X21vbnRocygpwQgaX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuODTCCDlzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8d2NoYXJfdD46Ol9fbW9udGhzKCkgY29uc3TDCBhzdGQ6Ol9fMjo6aW5pdF93bW9udGhzKCnECBtfX2N4eF9nbG9iYWxfYXJyYXlfZHRvci4xMDjFCDVzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8Y2hhcj46Ol9fYW1fcG0oKSBjb25zdMYIFnN0ZDo6X18yOjppbml0X2FtX3BtKCnHCBtfX2N4eF9nbG9iYWxfYXJyYXlfZHRvci4xMzLICDhzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8d2NoYXJfdD46Ol9fYW1fcG0oKSBjb25zdMkIF3N0ZDo6X18yOjppbml0X3dhbV9wbSgpyggbX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuMTM1ywgxc3RkOjpfXzI6Ol9fdGltZV9nZXRfY19zdG9yYWdlPGNoYXI+OjpfX3goKSBjb25zdMwIGV9fY3h4X2dsb2JhbF9hcnJheV9kdG9yLjHNCDRzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8d2NoYXJfdD46Ol9feCgpIGNvbnN0zggaX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuMzHPCDFzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8Y2hhcj46Ol9fWCgpIGNvbnN00AgaX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuMzPRCDRzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8d2NoYXJfdD46Ol9fWCgpIGNvbnN00ggaX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuMzXTCDFzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8Y2hhcj46Ol9fYygpIGNvbnN01AgaX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuMzfVCDRzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8d2NoYXJfdD46Ol9fYygpIGNvbnN01ggaX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuMznXCDFzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8Y2hhcj46Ol9fcigpIGNvbnN02AgaX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuNDHZCDRzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8d2NoYXJfdD46Ol9fcigpIGNvbnN02ggaX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuNDPbCGlzdGQ6Ol9fMjo6dGltZV9wdXQ8Y2hhciwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6fnRpbWVfcHV0KCncCGtzdGQ6Ol9fMjo6dGltZV9wdXQ8Y2hhciwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6fnRpbWVfcHV0KCkuMd0IeHN0ZDo6X18yOjp2ZWN0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4gPjo6bWF4X3NpemUoKSBjb25zdN4IqwFzdGQ6Ol9fMjo6YWxsb2NhdG9yX3RyYWl0czxzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4gPjo6YWxsb2NhdGUoc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+JiwgdW5zaWduZWQgbG9uZynfCIsBc3RkOjpfXzI6OnZlY3RvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiA+OjpfX2Fubm90YXRlX25ldyh1bnNpZ25lZCBsb25nKSBjb25zdOAIX3N0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPjo6YWxsb2NhdGUodW5zaWduZWQgbG9uZywgdm9pZCBjb25zdCop4Qg/c3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPjo6YWxsb2NhdGUodW5zaWduZWQgbG9uZywgdm9pZCBjb25zdCop4gjIAXN0ZDo6X18yOjphbGxvY2F0b3JfdHJhaXRzPHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiA+OjpkZWFsbG9jYXRlKHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiYsIHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiosIHVuc2lnbmVkIGxvbmcp4wibAXN0ZDo6X18yOjpfX3ZlY3Rvcl9iYXNlPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46Ol9fZGVzdHJ1Y3RfYXRfZW5kKHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiop5Agic3RkOjpfXzI6Ol9fdGltZV9wdXQ6Ol9fdGltZV9wdXQoKeUIiAFzdGQ6Ol9fMjo6dmVjdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46Ol9fcmVjb21tZW5kKHVuc2lnbmVkIGxvbmcpIGNvbnN05gjYAXN0ZDo6X18yOjpfX3NwbGl0X2J1ZmZlcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiY+OjpfX3NwbGl0X2J1ZmZlcih1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4mKecIkQFzdGQ6Ol9fMjo6X19zcGxpdF9idWZmZXI8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4mPjo6X19jb25zdHJ1Y3RfYXRfZW5kKHVuc2lnbmVkIGxvbmcp6AjzAXN0ZDo6X18yOjp2ZWN0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4gPjo6X19zd2FwX291dF9jaXJjdWxhcl9idWZmZXIoc3RkOjpfXzI6Ol9fc3BsaXRfYnVmZmVyPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+Jj4mKekIxgNzdGQ6Ol9fMjo6ZW5hYmxlX2lmPCgoc3RkOjpfXzI6OmludGVncmFsX2NvbnN0YW50PGJvb2wsIGZhbHNlPjo6dmFsdWUpIHx8ICghKF9faGFzX2NvbnN0cnVjdDxzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4sIGJvb2wqLCBib29sPjo6dmFsdWUpKSkgJiYgKGlzX3RyaXZpYWxseV9tb3ZlX2NvbnN0cnVjdGlibGU8Ym9vbD46OnZhbHVlKSwgdm9pZD46OnR5cGUgc3RkOjpfXzI6OmFsbG9jYXRvcl90cmFpdHM8c3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46Ol9fY29uc3RydWN0X2JhY2t3YXJkPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kj4oc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+JiwgYm9vbCosIGJvb2wqLCBib29sKiYp6gh8c3RkOjpfXzI6Ol9fY29tcHJlc3NlZF9wYWlyPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiY+OjpzZWNvbmQoKesIxgFzdGQ6Ol9fMjo6X19zcGxpdF9idWZmZXI8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4mPjo6X19kZXN0cnVjdF9hdF9lbmQoc3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqKiwgc3RkOjpfXzI6OmludGVncmFsX2NvbnN0YW50PGJvb2wsIGZhbHNlPinsCEBzdGQ6Ol9fMjo6KGFub255bW91cyBuYW1lc3BhY2UpOjpfX2Zha2VfYmluZDo6b3BlcmF0b3IoKSgpIGNvbnN07QhCc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90Pjo6YWxsb2NhdGUodW5zaWduZWQgbG9uZywgdm9pZCBjb25zdCop7ghrc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6X19jbGVhcl9hbmRfc2hyaW5rKCnvCHRzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+OjpfX2NsZWFyX2FuZF9zaHJpbmsoKfAIQ2xvbmcgZG91YmxlIHN0ZDo6X18yOjpfX2RvX3N0cnRvZDxsb25nIGRvdWJsZT4oY2hhciBjb25zdCosIGNoYXIqKinxCC1zdGQ6Ol9fMjo6X19zaGFyZWRfY291bnQ6On5fX3NoYXJlZF9jb3VudCgpLjHyCC9zdGQ6Ol9fMjo6X19zaGFyZWRfd2Vha19jb3VudDo6X19yZWxlYXNlX3dlYWsoKfMISXN0ZDo6X18yOjpfX3NoYXJlZF93ZWFrX2NvdW50OjpfX2dldF9kZWxldGVyKHN0ZDo6dHlwZV9pbmZvIGNvbnN0JikgY29uc3T0CEZzdGQ6Ol9fMjo6X19jYWxsX29uY2UodW5zaWduZWQgbG9uZyB2b2xhdGlsZSYsIHZvaWQqLCB2b2lkICgqKSh2b2lkKikp9Qgbb3BlcmF0b3IgbmV3KHVuc2lnbmVkIGxvbmcp9gg9c3RkOjpfXzI6Ol9fbGliY3BwX3JlZnN0cmluZzo6X19saWJjcHBfcmVmc3RyaW5nKGNoYXIgY29uc3QqKfcIB3dtZW1zZXT4CAh3bWVtbW92ZfkIQ3N0ZDo6X18yOjpfX2Jhc2ljX3N0cmluZ19jb21tb248dHJ1ZT46Ol9fdGhyb3dfbGVuZ3RoX2Vycm9yKCkgY29uc3T6CMEBc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6YmFzaWNfc3RyaW5nKHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QmKfsIeXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46Ol9faW5pdChjaGFyIGNvbnN0KiwgdW5zaWduZWQgbG9uZyn8CGZzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+Ojp+YmFzaWNfc3RyaW5nKCn9CHlzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+Ojphc3NpZ24oY2hhciBjb25zdCosIHVuc2lnbmVkIGxvbmcp/gjTAXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46Ol9fZ3Jvd19ieV9hbmRfcmVwbGFjZSh1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCBjaGFyIGNvbnN0Kin/CHJzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpyZXNpemUodW5zaWduZWQgbG9uZywgY2hhcimACXJzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjphcHBlbmQodW5zaWduZWQgbG9uZywgY2hhcimBCXRzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpfX2VyYXNlX3RvX2VuZCh1bnNpZ25lZCBsb25nKYIJugFzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpfX2dyb3dfYnkodW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZymDCT9zdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj46OmFzc2lnbihjaGFyKiwgdW5zaWduZWQgbG9uZywgY2hhcimECXlzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjphcHBlbmQoY2hhciBjb25zdCosIHVuc2lnbmVkIGxvbmcphQlmc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6cHVzaF9iYWNrKGNoYXIphglyc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6X19pbml0KHVuc2lnbmVkIGxvbmcsIGNoYXIphwmFAXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID46Ol9faW5pdCh3Y2hhcl90IGNvbnN0KiwgdW5zaWduZWQgbG9uZymICYUBc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6YXNzaWduKHdjaGFyX3QgY29uc3QqLCB1bnNpZ25lZCBsb25nKYkJ3wFzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+OjpfX2dyb3dfYnlfYW5kX3JlcGxhY2UodW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgd2NoYXJfdCBjb25zdCopignDAXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID46Ol9fZ3Jvd19ieSh1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nKYsJhQFzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+OjphcHBlbmQod2NoYXJfdCBjb25zdCosIHVuc2lnbmVkIGxvbmcpjAlyc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6cHVzaF9iYWNrKHdjaGFyX3QpjQl+c3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6X19pbml0KHVuc2lnbmVkIGxvbmcsIHdjaGFyX3QpjglCc3RkOjpfXzI6Ol9fdmVjdG9yX2Jhc2VfY29tbW9uPHRydWU+OjpfX3Rocm93X2xlbmd0aF9lcnJvcigpIGNvbnN0jwkNYWJvcnRfbWVzc2FnZZAJEl9fY3hhX3B1cmVfdmlydHVhbJEJHHN0ZDo6ZXhjZXB0aW9uOjp3aGF0KCkgY29uc3SSCSBzdGQ6OmxvZ2ljX2Vycm9yOjp+bG9naWNfZXJyb3IoKZMJM3N0ZDo6X18yOjpfX2xpYmNwcF9yZWZzdHJpbmc6On5fX2xpYmNwcF9yZWZzdHJpbmcoKZQJInN0ZDo6bG9naWNfZXJyb3I6On5sb2dpY19lcnJvcigpLjGVCSJzdGQ6Omxlbmd0aF9lcnJvcjo6fmxlbmd0aF9lcnJvcigplgkbc3RkOjpiYWRfY2FzdDo6d2hhdCgpIGNvbnN0lwlhX19jeHhhYml2MTo6X19mdW5kYW1lbnRhbF90eXBlX2luZm86OmNhbl9jYXRjaChfX2N4eGFiaXYxOjpfX3NoaW1fdHlwZV9pbmZvIGNvbnN0Kiwgdm9pZComKSBjb25zdJgJPGlzX2VxdWFsKHN0ZDo6dHlwZV9pbmZvIGNvbnN0Kiwgc3RkOjp0eXBlX2luZm8gY29uc3QqLCBib29sKZkJW19fY3h4YWJpdjE6Ol9fY2xhc3NfdHlwZV9pbmZvOjpjYW5fY2F0Y2goX19jeHhhYml2MTo6X19zaGltX3R5cGVfaW5mbyBjb25zdCosIHZvaWQqJikgY29uc3SaCQ5fX2R5bmFtaWNfY2FzdJsJa19fY3h4YWJpdjE6Ol9fY2xhc3NfdHlwZV9pbmZvOjpwcm9jZXNzX2ZvdW5kX2Jhc2VfY2xhc3MoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQqLCBpbnQpIGNvbnN0nAluX19jeHhhYml2MTo6X19jbGFzc190eXBlX2luZm86Omhhc191bmFtYmlndW91c19wdWJsaWNfYmFzZShfX2N4eGFiaXYxOjpfX2R5bmFtaWNfY2FzdF9pbmZvKiwgdm9pZCosIGludCkgY29uc3SdCXFfX2N4eGFiaXYxOjpfX3NpX2NsYXNzX3R5cGVfaW5mbzo6aGFzX3VuYW1iaWd1b3VzX3B1YmxpY19iYXNlKF9fY3h4YWJpdjE6Ol9fZHluYW1pY19jYXN0X2luZm8qLCB2b2lkKiwgaW50KSBjb25zdJ4Jc19fY3h4YWJpdjE6Ol9fYmFzZV9jbGFzc190eXBlX2luZm86Omhhc191bmFtYmlndW91c19wdWJsaWNfYmFzZShfX2N4eGFiaXYxOjpfX2R5bmFtaWNfY2FzdF9pbmZvKiwgdm9pZCosIGludCkgY29uc3SfCXJfX2N4eGFiaXYxOjpfX3ZtaV9jbGFzc190eXBlX2luZm86Omhhc191bmFtYmlndW91c19wdWJsaWNfYmFzZShfX2N4eGFiaXYxOjpfX2R5bmFtaWNfY2FzdF9pbmZvKiwgdm9pZCosIGludCkgY29uc3SgCVtfX2N4eGFiaXYxOjpfX3BiYXNlX3R5cGVfaW5mbzo6Y2FuX2NhdGNoKF9fY3h4YWJpdjE6Ol9fc2hpbV90eXBlX2luZm8gY29uc3QqLCB2b2lkKiYpIGNvbnN0oQldX19jeHhhYml2MTo6X19wb2ludGVyX3R5cGVfaW5mbzo6Y2FuX2NhdGNoKF9fY3h4YWJpdjE6Ol9fc2hpbV90eXBlX2luZm8gY29uc3QqLCB2b2lkKiYpIGNvbnN0oglcX19jeHhhYml2MTo6X19wb2ludGVyX3R5cGVfaW5mbzo6Y2FuX2NhdGNoX25lc3RlZChfX2N4eGFiaXYxOjpfX3NoaW1fdHlwZV9pbmZvIGNvbnN0KikgY29uc3SjCWZfX2N4eGFiaXYxOjpfX3BvaW50ZXJfdG9fbWVtYmVyX3R5cGVfaW5mbzo6Y2FuX2NhdGNoX25lc3RlZChfX2N4eGFiaXYxOjpfX3NoaW1fdHlwZV9pbmZvIGNvbnN0KikgY29uc3SkCYMBX19jeHhhYml2MTo6X19jbGFzc190eXBlX2luZm86OnByb2Nlc3Nfc3RhdGljX3R5cGVfYWJvdmVfZHN0KF9fY3h4YWJpdjE6Ol9fZHluYW1pY19jYXN0X2luZm8qLCB2b2lkIGNvbnN0Kiwgdm9pZCBjb25zdCosIGludCkgY29uc3SlCXNfX2N4eGFiaXYxOjpfX3ZtaV9jbGFzc190eXBlX2luZm86OnNlYXJjaF9iZWxvd19kc3QoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQgY29uc3QqLCBpbnQsIGJvb2wpIGNvbnN0pgmBAV9fY3h4YWJpdjE6Ol9fYmFzZV9jbGFzc190eXBlX2luZm86OnNlYXJjaF9hYm92ZV9kc3QoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQgY29uc3QqLCB2b2lkIGNvbnN0KiwgaW50LCBib29sKSBjb25zdKcJdF9fY3h4YWJpdjE6Ol9fYmFzZV9jbGFzc190eXBlX2luZm86OnNlYXJjaF9iZWxvd19kc3QoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQgY29uc3QqLCBpbnQsIGJvb2wpIGNvbnN0qAlyX19jeHhhYml2MTo6X19zaV9jbGFzc190eXBlX2luZm86OnNlYXJjaF9iZWxvd19kc3QoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQgY29uc3QqLCBpbnQsIGJvb2wpIGNvbnN0qQlvX19jeHhhYml2MTo6X19jbGFzc190eXBlX2luZm86OnNlYXJjaF9iZWxvd19kc3QoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQgY29uc3QqLCBpbnQsIGJvb2wpIGNvbnN0qgmAAV9fY3h4YWJpdjE6Ol9fdm1pX2NsYXNzX3R5cGVfaW5mbzo6c2VhcmNoX2Fib3ZlX2RzdChfX2N4eGFiaXYxOjpfX2R5bmFtaWNfY2FzdF9pbmZvKiwgdm9pZCBjb25zdCosIHZvaWQgY29uc3QqLCBpbnQsIGJvb2wpIGNvbnN0qwl/X19jeHhhYml2MTo6X19zaV9jbGFzc190eXBlX2luZm86OnNlYXJjaF9hYm92ZV9kc3QoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQgY29uc3QqLCB2b2lkIGNvbnN0KiwgaW50LCBib29sKSBjb25zdKwJfF9fY3h4YWJpdjE6Ol9fY2xhc3NfdHlwZV9pbmZvOjpzZWFyY2hfYWJvdmVfZHN0KF9fY3h4YWJpdjE6Ol9fZHluYW1pY19jYXN0X2luZm8qLCB2b2lkIGNvbnN0Kiwgdm9pZCBjb25zdCosIGludCwgYm9vbCkgY29uc3StCQhfX3N0cmR1cK4JDV9fZ2V0VHlwZU5hbWWvCSpfX2VtYmluZF9yZWdpc3Rlcl9uYXRpdmVfYW5kX2J1aWx0aW5fdHlwZXOwCT92b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfaW50ZWdlcjxjaGFyPihjaGFyIGNvbnN0KimxCUZ2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfaW50ZWdlcjxzaWduZWQgY2hhcj4oY2hhciBjb25zdCopsglIdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX2ludGVnZXI8dW5zaWduZWQgY2hhcj4oY2hhciBjb25zdCopswlAdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX2ludGVnZXI8c2hvcnQ+KGNoYXIgY29uc3QqKbQJSXZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9pbnRlZ2VyPHVuc2lnbmVkIHNob3J0PihjaGFyIGNvbnN0Kim1CT52b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfaW50ZWdlcjxpbnQ+KGNoYXIgY29uc3QqKbYJR3ZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9pbnRlZ2VyPHVuc2lnbmVkIGludD4oY2hhciBjb25zdCoptwk/dm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX2ludGVnZXI8bG9uZz4oY2hhciBjb25zdCopuAlIdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX2ludGVnZXI8dW5zaWduZWQgbG9uZz4oY2hhciBjb25zdCopuQk+dm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX2Zsb2F0PGZsb2F0PihjaGFyIGNvbnN0Kim6CT92b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfZmxvYXQ8ZG91YmxlPihjaGFyIGNvbnN0Kim7CUN2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfbWVtb3J5X3ZpZXc8Y2hhcj4oY2hhciBjb25zdCopvAlKdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX21lbW9yeV92aWV3PHNpZ25lZCBjaGFyPihjaGFyIGNvbnN0Kim9CUx2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfbWVtb3J5X3ZpZXc8dW5zaWduZWQgY2hhcj4oY2hhciBjb25zdCopvglEdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX21lbW9yeV92aWV3PHNob3J0PihjaGFyIGNvbnN0Kim/CU12b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfbWVtb3J5X3ZpZXc8dW5zaWduZWQgc2hvcnQ+KGNoYXIgY29uc3QqKcAJQnZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9tZW1vcnlfdmlldzxpbnQ+KGNoYXIgY29uc3QqKcEJS3ZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9tZW1vcnlfdmlldzx1bnNpZ25lZCBpbnQ+KGNoYXIgY29uc3QqKcIJQ3ZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9tZW1vcnlfdmlldzxsb25nPihjaGFyIGNvbnN0KinDCUx2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfbWVtb3J5X3ZpZXc8dW5zaWduZWQgbG9uZz4oY2hhciBjb25zdCopxAlEdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX21lbW9yeV92aWV3PGZsb2F0PihjaGFyIGNvbnN0KinFCUV2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfbWVtb3J5X3ZpZXc8ZG91YmxlPihjaGFyIGNvbnN0KinGCW5FbXNjcmlwdGVuQmluZGluZ0luaXRpYWxpemVyX25hdGl2ZV9hbmRfYnVpbHRpbl90eXBlczo6RW1zY3JpcHRlbkJpbmRpbmdJbml0aWFsaXplcl9uYXRpdmVfYW5kX2J1aWx0aW5fdHlwZXMoKccJCGRsbWFsbG9jyAkGZGxmcmVlyQkJZGxyZWFsbG9jygkRdHJ5X3JlYWxsb2NfY2h1bmvLCQ1kaXNwb3NlX2NodW5rzAkEc2Jya80JBGZtb2TOCQVmbW9kbM8JBWxvZzEw0AkGbG9nMTBm0QkGc2NhbGJu0gkNX19mcGNsYXNzaWZ5bNMJBm1lbWNwedQJBm1lbXNldNUJB21lbW1vdmXWCQhzZXRUaHJld9cJCXN0YWNrU2F2ZdgJCnN0YWNrQWxsb2PZCQxzdGFja1Jlc3RvcmXaCRBfX2dyb3dXYXNtTWVtb3J52wkLZHluQ2FsbF92aWncCQ1keW5DYWxsX3ZpaWlp3QkLZHluQ2FsbF9kaWTeCQxkeW5DYWxsX2RpaWTfCQ1keW5DYWxsX2RpZGRk4AkOZHluQ2FsbF9kaWlkZGThCQxkeW5DYWxsX2RpZGTiCQ1keW5DYWxsX2RpaWRk4wkLZHluQ2FsbF9kaWnkCQtkeW5DYWxsX3ZpZOUJDGR5bkNhbGxfdmlpZOYJDGR5bkNhbGxfZGlpaecJDWR5bkNhbGxfZGlpaWnoCQ1keW5DYWxsX3ZpaWlk6QkNZHluQ2FsbF9kaWRpZOoJDmR5bkNhbGxfZGlpZGlk6wkOZHluQ2FsbF9kaWRpZGnsCQ9keW5DYWxsX2RpaWRpZGntCQ1keW5DYWxsX3ZpZGlk7gkOZHluQ2FsbF92aWlkaWTvCQ5keW5DYWxsX3ZpZGlkZPAJD2R5bkNhbGxfdmlpZGlkZPEJD2R5bkNhbGxfdmlkaWRkZPIJEGR5bkNhbGxfdmlpZGlkZGTzCQ1keW5DYWxsX3ZpZGRk9AkOZHluQ2FsbF92aWlkZGT1CQ1keW5DYWxsX2lpaWlk9gkMZHluQ2FsbF92aWRk9wkNZHluQ2FsbF92aWlkZPgJDWR5bkNhbGxfaWlpaWn5CQ5keW5DYWxsX3ZpZmZpafoJD2R5bkNhbGxfdmlpZmZpafsJD2R5bkNhbGxfZGlkZGRkZPwJD2R5bkNhbGxfZGlkZGlkZP0JEGR5bkNhbGxfZGlpZGRpZGT+CRBkeW5DYWxsX2RpaWRkZGRk/wkPZHluQ2FsbF9kaWRkZGlpgAoQZHluQ2FsbF9kaWlkZGRpaYEKEWR5bkNhbGxfZGlkZGRkZGlpggoSZHluQ2FsbF9kaWlkZGRkZGlpgwoMZHluQ2FsbF9kaWRphAoNZHluQ2FsbF9kaWlkaYUKD2R5bkNhbGxfZGlkaWRkZIYKEGR5bkNhbGxfZGlpZGlkZGSHCg1keW5DYWxsX2RpZGRpiAoOZHluQ2FsbF9kaWlkZGmJCgxkeW5DYWxsX3ZpZGmKCg1keW5DYWxsX3ZpaWRpiwoOZHluQ2FsbF92aWlpaWmMCgxkeW5DYWxsX2lpZmmNCg1keW5DYWxsX2lpaWZpjgoKZHluQ2FsbF9maY8KC2R5bkNhbGxfZmlpkAoNZHluQ2FsbF9maWlpaZEKDmR5bkNhbGxfZmlpaWlpkgoPZHluQ2FsbF92aWlpaWRkkwoQZHluQ2FsbF92aWlpaWlkZJQKDGR5bkNhbGxfdmlpZpUKDWR5bkNhbGxfdmlpaWaWCg1keW5DYWxsX2lpaWlmlwoOZHluQ2FsbF9kaWRkaWSYCg9keW5DYWxsX2RpaWRkaWSZCg9keW5DYWxsX2RpZGRkaWSaChBkeW5DYWxsX2RpaWRkZGlkmwoOZHluQ2FsbF9kaWRkZGmcCg9keW5DYWxsX2RpaWRkZGmdCgtkeW5DYWxsX2lpZJ4KDWR5bkNhbGxfZGlkaWmfCg5keW5DYWxsX2RpaWRpaaAKD2R5bkNhbGxfaWlkaWlpaaEKDmR5bkNhbGxfaWlpaWlpogoRZHluQ2FsbF9paWlpaWlpaWmjCg9keW5DYWxsX2lpaWlpaWmkCg5keW5DYWxsX2lpaWlpZKUKEGR5bkNhbGxfaWlpaWlpaWmmCg9keW5DYWxsX3ZpaWlpaWmnCglkeW5DYWxsX3aoChhsZWdhbHN0dWIkZHluQ2FsbF92aWlqaWmpChZsZWdhbHN0dWIkZHluQ2FsbF9qaWppqgoYbGVnYWxzdHViJGR5bkNhbGxfaWlpaWlqqwoZbGVnYWxzdHViJGR5bkNhbGxfaWlpaWlqaqwKGmxlZ2Fsc3R1YiRkeW5DYWxsX2lpaWlpaWpqAHUQc291cmNlTWFwcGluZ1VSTGNodHRwOi8vbG9jYWxob3N0OjkwMDAvYXVkaW8td29ya2xldC9idWlsZC97e3sgRklMRU5BTUVfUkVQTEFDRU1FTlRfU1RSSU5HU19XQVNNX0JJTkFSWV9GSUxFIH19fS5tYXA=';
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


