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
    STACK_BASE = 5283920,
    STACKTOP = STACK_BASE,
    STACK_MAX = 41040,
    DYNAMIC_BASE = 5283920,
    DYNAMICTOP_PTR = 40880;




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




var wasmBinaryFile = 'data:application/octet-stream;base64,AGFzbQEAAAAB0gqfAWABfwF/YAF/AGACf38AYAJ/fwF/YAN/f38Bf2ADf39/AGAFf39/f38Bf2AAAGAEf39/fwF/YAZ/f39/f38Bf2AEf39/fwBgBX9/f39/AGAAAX9gBn9/f39/fwBgCH9/f39/f39/AX9gAn98AGABfwF8YAJ8fAF8YAd/f39/f39/AX9gAn98AXxgA398fAF8YAF8AXxgB39/f39/f38AYAJ/fwF8YAR/fHx8AXxgBH9/f3wAYAN/f3wAYAV/fn5+fgBgA39+fwF+YAF/AX1gAX0BfWADf39/AXxgCn9/f39/f39/f38AYAN/fH8AYAV/f39/fgF/YAR/fHx/AXxgBX9/fn9/AGAGf398fHx/AGAFf39/f3wBf2ADf31/AX9gBH9/f38BfmACf38BfWAFf398fH8BfGAGf3x/fHx8AXxgBX98fH98AXxgBX98fHx/AXxgBn98fHx8fAF8YAh/f39/f39/fwBgB39/f39/fHwAYAZ/f39/fHwAYAR/f399AGAGf399fX9/AGAEf398fwBgBX9/fH98AGAGf398f3x8AGAHf398f3x8fABgBH9/fHwAYAR/fn5/AGAFf319f38AYAR/fH98AGAFf3x/fHwAYAZ/fH98fHwAYAN/fHwAYAV/fHx8fwBgCn9/f39/f39/f38Bf2AHf39/f39+fgF/YAZ/f39/fn4Bf2AEf39/fAF/YAR/f31/AX9gBn98f39/fwF/YAR/f39/AX1gBX9/f39/AX1gBH9/f38BfGADf398AXxgBH9/fH8BfGAFf398f3wBfGAGf398f3x/AXxgB39/fH98fHwBfGAEf398fAF8YAZ/f3x8f3wBfGAHf398fH98fAF8YAV/f3x8fAF8YAZ/f3x8fH8BfGAHf398fHx/fwF8YAd/f3x8fH98AXxgB39/fHx8fHwBfGAJf398fHx8fH9/AXxgA398fwF8YAR/fH98AXxgBX98f3x/AXxgBn98fH98fAF8YAZ/fHx8f38BfGAGf3x8fH98AXxgCH98fHx8fH9/AXxgD39/f39/f39/f39/f39/fwBgA39/fQBgAn9+AGAJf39/f39/f39/AX9gC39/f39/f39/f39/AX9gDH9/f39/f39/f39/fwF/YAR/f399AX9gA39+fwF/YAJ/fAF/YAJ+fwF/YAJ+fgF/YAF8AX9gAX8BfmAEf39/fgF+YAN/f38BfWACfX8BfWABfAF9YAJ8fwF8YAN8fH8BfGADfHx8AXxgDH9/f39/f39/f39/fwBgDX9/f39/f39/f39/f38AYAh/f39/f398fABgBX9/f399AGAFf39/f3wAYAd/f399fX9/AGAFf39/fH8AYAZ/f398f3wAYAd/f398f3x8AGAIf39/fH98fHwAYAV/f398fABgB39/f3x8fH8AYAN/f34AYAN/fn4AYAJ/fQBgBn9/f39/fAF/YAV/f39/fQF/YAV/f399fwF/YAN/f3wBf2AHf398f39/fwF/YAN+f38Bf2AEfn5+fgF/YAJ9fwF/YAJ8fwF/YAJ/fwF+YAZ/f39/f38BfWACfn4BfWACfX0BfWAFf39/f38BfGAEf39/fAF8YAV/f398fwF8YAZ/f398f3wBfGAHf39/fH98fwF8YAh/f398f3x8fAF8YAV/f398fAF8YAZ/f398fH8BfGAHf39/fHx/fAF8YAh/f398fH98fAF8YAZ/f398fHwBfGAHf39/fHx8fwF8YAh/f398fHx/fwF8YAh/f398fHx/fAF8YAh/f398fHx8fAF8YAp/f398fHx8fH9/AXxgAn5+AXwClgktA2VudhZfZW1iaW5kX3JlZ2lzdGVyX2NsYXNzAHMDZW52Il9lbWJpbmRfcmVnaXN0ZXJfY2xhc3NfY29uc3RydWN0b3IADQNlbnYlX2VtYmluZF9yZWdpc3Rlcl9jbGFzc19jbGFzc19mdW5jdGlvbgAWA2Vudh9fZW1iaW5kX3JlZ2lzdGVyX2NsYXNzX2Z1bmN0aW9uAC8DZW52H19lbWJpbmRfcmVnaXN0ZXJfY2xhc3NfcHJvcGVydHkAIANlbnYaX2VtYmluZF9yZWdpc3Rlcl9zbWFydF9wdHIAcgNlbnYVX2VtYmluZF9yZWdpc3Rlcl9lbnVtAAoDZW52G19lbWJpbmRfcmVnaXN0ZXJfZW51bV92YWx1ZQAFA2VudhFfZW12YWxfdGFrZV92YWx1ZQADA2VudhhfX2N4YV9hbGxvY2F0ZV9leGNlcHRpb24AAANlbnYLX19jeGFfdGhyb3cABQNlbnYNX2VtdmFsX2luY3JlZgABA2Vudg1fZW12YWxfZGVjcmVmAAEDZW52C19lbXZhbF9jYWxsAAgDZW52BXJvdW5kABUDZW52BGV4aXQAAQNlbnYNX19hc3NlcnRfZmFpbAAKA2VudgZfX2xvY2sAAQNlbnYIX191bmxvY2sAARZ3YXNpX3NuYXBzaG90X3ByZXZpZXcxCGZkX2Nsb3NlAAADZW52Cl9fc3lzY2FsbDUAAwNlbnYMX19zeXNjYWxsMjIxAAMDZW52C19fc3lzY2FsbDU0AAMWd2FzaV9zbmFwc2hvdF9wcmV2aWV3MQdmZF9yZWFkAAgWd2FzaV9zbmFwc2hvdF9wcmV2aWV3MQhmZF93cml0ZQAIFndhc2lfc25hcHNob3RfcHJldmlldzERZW52aXJvbl9zaXplc19nZXQAAxZ3YXNpX3NuYXBzaG90X3ByZXZpZXcxC2Vudmlyb25fZ2V0AAMDZW52Cl9fbWFwX2ZpbGUAAwNlbnYLX19zeXNjYWxsOTEAAwNlbnYKc3RyZnRpbWVfbAAGA2VudgVhYm9ydAAHA2VudhVfZW1iaW5kX3JlZ2lzdGVyX3ZvaWQAAgNlbnYVX2VtYmluZF9yZWdpc3Rlcl9ib29sAAsDZW52G19lbWJpbmRfcmVnaXN0ZXJfc3RkX3N0cmluZwACA2VudhxfZW1iaW5kX3JlZ2lzdGVyX3N0ZF93c3RyaW5nAAUDZW52Fl9lbWJpbmRfcmVnaXN0ZXJfZW12YWwAAgNlbnYYX2VtYmluZF9yZWdpc3Rlcl9pbnRlZ2VyAAsDZW52Fl9lbWJpbmRfcmVnaXN0ZXJfZmxvYXQABQNlbnYcX2VtYmluZF9yZWdpc3Rlcl9tZW1vcnlfdmlldwAFA2VudhZlbXNjcmlwdGVuX3Jlc2l6ZV9oZWFwAAADZW52FWVtc2NyaXB0ZW5fbWVtY3B5X2JpZwAEA2VudgtzZXRUZW1wUmV0MAABFndhc2lfc25hcHNob3RfcHJldmlldzEHZmRfc2VlawAGA2VudgZtZW1vcnkCAIAQA2VudgV0YWJsZQFwAPkGA/4J3QkHBwcHBwcHAAEADAIBAAoFAAxIGRAPFxoAAgMFAAxLTAAMNTY3AAwTST8lDwAAQxkYcQAMPjgPEBAPEA8PAAEMAAIFCghOUQIBMwgADFBVAAxTVkoAAgAXFxUTEwAMFAAMK00ADCsADBQADA8PLgAUERERERERERERFREADAAAAgACEAIQAgIAAgAMIyoAAQMAFCE0AhcfAAAAABQhAgABDAIFBQoABQQECAACGgUZAAUEQwACBQUKAAUECAAFAF8yBWQFBwABAAwDAQABAhAPLE8jKgABAwECLAAMAg8PAFxULVIlBwADBAMDAwgEAwMDAAAAAwMDAwMDAwMDDBAQZmkADBQHAAEMAAwHAAEMCgsnRB0pHQIDAgIAAAAAAAEMRwABDDEwAwQFIQECBQIFAgIABAIAAQEDAQABARAABAABAwABAQEHExMfGgBYWRQ7PD0ABAAAAwAAAQQAAwQCEBgtGBATFBMYFBMPOlouEw8PD1tdVw8PDxAAAQEAAQIEJAcKAAMDCQ8BAgonAB0dCkYNCgICAQULBQsLAgEBABMAGAMBAAgACAkDAw0KAQADBAQECggLCAAAAw4LDW1tBAUKAg0CAAIAHAABBAgCDAMDA28GEgUACgtnhgFnBEUCBQwAAgFqagAACGVlAgAAAAMDDAAIBAAAHAQABAEAAAAAOTmeAREGiQFwFW5uiAEeFR5wFR6NAR4VHhEEDAAAAQEAAQACBCQKBAUAAAMEAAEABAUABAAAAQEDAQADAAADAwEDAAMFYAEAAwADAwMAAwAAAQEAAAADAwMCAgICAQICAAADBwEBBwEHBQIFAgIAAAECAAMAAwECAAMAAwIABAMCBANgAH9rCIABGwIbD4cBaBsCGzkbCg0WigGMAQQDfgQEBAMHBAACAwwEAwMBAAQICAZrKCgpChcFCgYKBQQGCgUECQASAwQJBgAFAAJACAoJBigJBggJBggJBigJBgtjbAkGHwkGCgkMBAEEAwkAEgkGAwVACQYJBgkGCQYJBgtjCQYJBgkEAwYAAAYKBgQWAgAiBiImBAAIFkIGBgAGFgkCBCIGIiYWQgYCAg4ACQkJDQkNCQsGDgoLCwsLCwsKDQsLCw4JCQkNCQ0JCwYOCgsLCwsLCwoNCwsLEg0CBBINBgcEAAICAgACEmIgAgUFEgEFAAIABAMCEmIgAhIBBQACAAQDQSBeBAlBIF4ECQQEBA0FAg0KCgAHBwcBAQIAAgcMAQABAQEMAQMBAgEBBAgICAMEAwQDCAQGAAEDBAMECAQGDgYGAQ4GBA4JBgYAAAAGCAAOCQ4JBgQADgkOCQYEAAEAAQAAAgICAgICAgIABwEABwECAAcBAAcBAAcBAAcBAAEAAQABAAEAAQABAAEAAQEADAMBAwAFAgEACAIBCgACAQABAQUBAQMCAAIEBAcCBQAFLwICAgsFBQIBBQUvCwUCBQcHBwAAAQEBAAQEBAMFCgoKCgMEAwMKCw0LCwsNDQ0AAAcHBwcHBwcHBwcHBwcBAQEBAQEHBwcHAAABAwMCABEbFR5vaAQEBQIMAAEABQtIjgEZdhofS5EBTJIBNXk2ejd7SY8BJX0mUTh8Bk6UAZgBM3dQlwFVnAFTmgFWnQFKkAFNkwEqlQE0eDJ1ggFPlgFUmwFSmQGEAQ1EgwEpbEeLATB0hQEJYRKBAQ4WARYGEmFABhACfwFBsL/CAgt/AEGsvwILB5kOaBFfX3dhc21fY2FsbF9jdG9ycwArBm1hbGxvYwCkCQRmcmVlAKUJEF9fZXJybm9fbG9jYXRpb24A+gMIc2V0VGhyZXcAswkZX1pTdDE4dW5jYXVnaHRfZXhjZXB0aW9udgDDBA1fX2dldFR5cGVOYW1lAIsJKl9fZW1iaW5kX3JlZ2lzdGVyX25hdGl2ZV9hbmRfYnVpbHRpbl90eXBlcwCMCQpfX2RhdGFfZW5kAwEJc3RhY2tTYXZlALQJCnN0YWNrQWxsb2MAtQkMc3RhY2tSZXN0b3JlALYJEF9fZ3Jvd1dhc21NZW1vcnkAtwkKZHluQ2FsbF9paQCSAgpkeW5DYWxsX3ZpADYJZHluQ2FsbF9pADQLZHluQ2FsbF92aWkAuAkNZHluQ2FsbF92aWlpaQC5CQxkeW5DYWxsX3ZpaWkAOQxkeW5DYWxsX2RpaWkAugkNZHluQ2FsbF9kaWlpaQC7CQxkeW5DYWxsX3ZpaWQAvAkNZHluQ2FsbF92aWlpZAC9CQpkeW5DYWxsX2RpAIMBC2R5bkNhbGxfdmlkAL4JC2R5bkNhbGxfZGlpAL8JC2R5bkNhbGxfaWlpAJMCDWR5bkNhbGxfZGlkaWQAwAkOZHluQ2FsbF9kaWlkaWQAwQkOZHluQ2FsbF9kaWRpZGkAwgkPZHluQ2FsbF9kaWlkaWRpAMMJDWR5bkNhbGxfdmlkaWQAxAkOZHluQ2FsbF92aWlkaWQAxQkOZHluQ2FsbF92aWRpZGQAxgkPZHluQ2FsbF92aWlkaWRkAMcJD2R5bkNhbGxfdmlkaWRkZADICRBkeW5DYWxsX3ZpaWRpZGRkAMkJC2R5bkNhbGxfZGlkAMoJDGR5bkNhbGxfZGlpZADLCQ5keW5DYWxsX3ZpZGRkaQDMCQ9keW5DYWxsX3ZpaWRkZGkAzQkNZHluQ2FsbF9paWlpZADOCQ1keW5DYWxsX2RpZGRkAM8JDGR5bkNhbGxfZGRkZABbDGR5bkNhbGxfdmlkZADQCQ1keW5DYWxsX3ZpaWRkANEJDGR5bkNhbGxfaWlpaQCXAg1keW5DYWxsX2lpaWlpANIJDGR5bkNhbGxfZGlkZADTCQ1keW5DYWxsX2RpaWRkANQJDmR5bkNhbGxfZGlpZGRkANUJDmR5bkNhbGxfdmlmZmlpANYJD2R5bkNhbGxfdmlpZmZpaQDXCQ9keW5DYWxsX2RpZGRpZGQA2AkQZHluQ2FsbF9kaWlkZGlkZADZCQ9keW5DYWxsX2RpZGRkZGQA2gkQZHluQ2FsbF9kaWlkZGRkZADbCQ9keW5DYWxsX2RpZGRkaWkA3AkQZHluQ2FsbF9kaWlkZGRpaQDdCRFkeW5DYWxsX2RpZGRkZGRpaQDeCRJkeW5DYWxsX2RpaWRkZGRkaWkA3wkMZHluQ2FsbF9kaWRpAOAJDWR5bkNhbGxfZGlpZGkA4QkKZHluQ2FsbF9kZACGAQ9keW5DYWxsX2RpZGlkZGQA4gkQZHluQ2FsbF9kaWlkaWRkZADjCQtkeW5DYWxsX2RkZACaAQ1keW5DYWxsX2RpZGRpAOQJDmR5bkNhbGxfZGlpZGRpAOUJDGR5bkNhbGxfdmlkaQDmCQ1keW5DYWxsX3ZpaWRpAOcJDGR5bkNhbGxfdmlpZgDoCQ1keW5DYWxsX3ZpaWlmAOkJDWR5bkNhbGxfaWlpaWYA6gkOZHluQ2FsbF9kaWRkaWQA6wkPZHluQ2FsbF9kaWlkZGlkAOwJD2R5bkNhbGxfZGlkZGRpZADtCRBkeW5DYWxsX2RpaWRkZGlkAO4JDmR5bkNhbGxfZGlkZGRpAO8JD2R5bkNhbGxfZGlpZGRkaQDwCQtkeW5DYWxsX2lpZADxCQpkeW5DYWxsX2lkAKsCDmR5bkNhbGxfdmlpaWlpAPIJDGR5bkNhbGxfaWlmaQDzCQ1keW5DYWxsX2lpaWZpAPQJCmR5bkNhbGxfZmkA9QkLZHluQ2FsbF9maWkA9gkNZHluQ2FsbF9maWlpaQD3CQ5keW5DYWxsX2ZpaWlpaQD4CQ9keW5DYWxsX3ZpaWlpZGQA+QkQZHluQ2FsbF92aWlpaWlkZAD6CQ5keW5DYWxsX3ZpaWppaQCDCgxkeW5DYWxsX2ppamkAhAoPZHluQ2FsbF9paWRpaWlpAPsJDmR5bkNhbGxfaWlpaWlpAPwJEWR5bkNhbGxfaWlpaWlpaWlpAP0JD2R5bkNhbGxfaWlpaWlpaQD+CQ5keW5DYWxsX2lpaWlpagCFCg5keW5DYWxsX2lpaWlpZAD/CQ9keW5DYWxsX2lpaWlpamoAhgoQZHluQ2FsbF9paWlpaWlpaQCAChBkeW5DYWxsX2lpaWlpaWpqAIcKD2R5bkNhbGxfdmlpaWlpaQCBCglkeW5DYWxsX3YAggoJtwwBAEEBC/gGMjM0NTY3Njc4Mzk6OzM0PPUCPfYCPj9AQUJDREVGRzM0SPgCSfkCSkszNEz7Ak38Ak79Ak9QMzRRUlNUVVZCV0VYM1laW1xdMzReX2BhQmJBY2RBQmVmZ2hpNGprRWxGbW7/Am+EA0WPA0GSA1OQA5EDcJMDcYsDlQOMA44DhQNyc5YDQpcDdIYDdYcDlAN2MzR3mAN4mQN5mgNTmwNCnAOdA2Z6MzR7ngN8nwN9oAN+oQNCmwOjA6IDf4ABRUaBATM0NaQDggGDAYQBhQGGAYcBMzSIAYkBcIoBMzSLAYwBjQGOATM0jwGQAY0BkQEzNJIBkwFwlAEzNJUBlgFClwGYAXmZATM0NZoBmwGcAZ0BngGfAaABoQGiAaMBpAGlAaYBMzSnAbQDcrMDQrUDRqgBRakBqgFFRqsBrAF/gAGtAa4BQa8BsAGoAbEBRbIBswG0ATM0tQG2AbcBZEJjQbgBuQG6AbsBvAFwvQG+Ab8BRsABwQHCAUXDAcQBxAG5AboBxQHGAXDHAb4ByAFGwAHBAcIBRckBygE0ywHMAc0BzgHPAdABRdEB0gHTAdQB1QHKATTLAdYB1wHYAdkB2gFF2wHSAdwB3QHeAcoBNMsB3wHgAeEB4gHjAUXkAdIB5QHmAecBygE0ywHfAeAB4QHiAeMBRegB0gHlAeYB6QHKATTLAcwB6gHOAesB0AFF7AHSAdMB7QHwAfEB8gHzAfQB9QH2AfcB+AFG+QFBY/oBQvsB/AH9Af4B/wGAAvIB8wGBAvUB9gGCAoMCRoQC/AGFAvEBNIYChwJG+QFBY/oBQogCiQKKAkWLAowCjQKOApECM5ICxAGTApQClQKWApcCmAKZApoCmwKcAp0CngKfAqACoQKiAqMCpAKlAqYCpwI0qAKDAakCqgKrAqwCsQKyAjSzAssDU7QCsgI0tQLNA3G3ArgCNLkCugK7ArwCvQK+Ar8CwALBAsICwwLEAsUCRcYCxwLIAskCygI0ywK7A7sCvAPMAs0CzgI0zwLQAtEC0gLTAu8IrQIzNK4CrwJw4ALhAuIC4wLkAuUC5gLnAtAI5ALoAsQB5ALrAuwC4gLtAuQC7gLvAvAC5ALEAYMDpgOlA6cD3ATeBN0E3wSAA6kDqgOrA6wDrgOoA6IEzwSvA9IEsAPUBLED2wPOA5gEpgT0A4kEigSgBKIEowSkBMgEyQTLBMwEzQTOBKIE0QTTBNME1QTWBMsEzATNBM4EogSiBNgE0QTaBNME2wTTBNwE3gTdBN8E9wT5BPgE+gT3BPkE+AT6BMUEhQXEBMcExATHBIwFmAWZBZoFnAWdBZ4FnwWgBaIFowWYBaQFpQWmBacFngWoBaUFqQWqBcYFpQn2A9AH0weXCJoIngihCKQIpwipCKsIrQivCLEIswi1CLcIyQfLB9IH4AfhB+IH4wfkB+UH3AfmB+cH6Ae9B+wH7QfwB/MH9AeiBPcH+QeHCIgIiwiMCI0IjwiSCIkIigi8BrYGjgiQCJMIxAHkAuQC1AfVB9YH1wfYB9kH2gfbB9wH3QfeB98H5ALpB+kH6gf1A/UD6wf1A+QC+gf8B+oHogSiBP4HgAjkAoEIgwjqB6IEogSFCIAI5ALkAsQB5ALfBeAF4gXEAeQC4wXkBeYF5ALnBewF9QX4BfsF+wX+BYEGhgaJBowG5AKSBpUGmgacBp4GngagBqIGpgaoBqoG5AKtBrAGtwa4BrkGuga/BsAG5ALBBsMGyAbJBsoGywbNBs4GxAHkAtIG0wbUBtUG1wbZBtwGlQicCKIIsAi0CKgIrAjEAeQC0gbqBusG7AbuBvAG8waYCJ8IpQiyCLYIqgiuCLkIuAiAB7kIuAiEB+QCiQeJB4oHigeKB4sHogSMB4wH5AKJB4kHigeKB4oHiweiBIwHjAfkAo0HjQeKB4oHigeOB6IEjAeMB+QCjQeNB4oHigeKB44HogSMB4wH5AKPB5UH5AKeB6IH5AKqB64H5AKvB7MH5AK2B7cHywTkArYHugfLBMQBzgjt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3wI2AgBByCFByRVBBEGgI0GwI0HgAiAAQQAQAwsFAEHEIwsMACAABEAgABClCQsLBwAgABEMAAsHAEEBENIICwkAIAEgABEBAAsMACAAIAAoAgA2AgQLBQBBtCQLDQAgASACIAMgABEFAAsdAEG4/AEgATYCAEG0/AEgADYCAEG8/AEgAjYCAAsFAEGgJQsHAEE4ENIICzkBAX8gASAAKAIEIgRBAXVqIQEgACgCACEAIAEgAiADIARBAXEEfyABKAIAIABqKAIABSAACxEfAAs5AQF/IAEgACgCBCIEQQF1aiEBIAAoAgAhACABIAIgAyAEQQFxBH8gASgCACAAaigCAAUgAAsRGgALBwAgACsDMAsJACAAIAE5AzALNQEBfyABIAAoAgQiAkEBdWohASAAKAIAIQAgASACQQFxBH8gASgCACAAaigCAAUgAAsREAALNwEBfyABIAAoAgQiA0EBdWohASAAKAIAIQAgASACIANBAXEEfyABKAIAIABqKAIABSAACxEPAAsHACAAKAIsCwkAIAAgATYCLAs1AQF/IAEgACgCBCICQQF1aiEBIAAoAgAhACABIAJBAXEEfyABKAIAIABqKAIABSAACxEAAAs3AQF/IAEgACgCBCIDQQF1aiEBIAAoAgAhACABIAIgA0EBcQR/IAEoAgAgAGooAgAFIAALEQIACwUAQbQmCw0AQaiR1gAQ0ggQ9wILOwEBfyABIAAoAgQiBUEBdWohASAAKAIAIQAgASACIAMgBCAFQQFxBH8gASgCACAAaigCAAUgAAsRWAALPQEBfyABIAAoAgQiBkEBdWohASAAKAIAIQAgASACIAMgBCAFIAZBAXEEfyABKAIAIABqKAIABSAACxFZAAsFAEHcJwsQAEH4ABDSCEEAQfgAELEJCzsBAX8gASAAKAIEIgVBAXVqIQEgACgCACEAIAEgAiADIAQgBUEBcQR/IAEoAgAgAGooAgAFIAALETsACz0BAX8gASAAKAIEIgZBAXVqIQEgACgCACEAIAEgAiADIAQgBSAGQQFxBH8gASgCACAAaigCAAUgAAsRPAALPwEBfyABIAAoAgQiB0EBdWohASAAKAIAIQAgASACIAMgBCAFIAYgB0EBcQR/IAEoAgAgAGooAgAFIAALET0ACwUAQZApC14BAX9B0AAQ0ggiAEIANwMAIABC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EKUJCyACQRBqJAAPCxDrCAALDwAgACABEGwgACACNgJkCzkBAX8gASAAKAIEIgRBAXVqIQEgACgCACEAIAEgAiADIARBAXEEfyABKAIAIABqKAIABSAACxEFAAs5AQF/IAEgACgCBCIEQQF1aiEBIAAoAgAhACABIAIgAyAEQQFxBH8gASgCACAAaigCAAUgAAsRBAALOQEBfyABIAAoAgQiBEEBdWohASAAKAIAIQAgASACIAMgBEEBcQR/IAEoAgAgAGooAgAFIAALERQACzsBAX8gASAAKAIEIgVBAXVqIQEgACgCACEAIAEgAiADIAQgBUEBcQR/IAEoAgAgAGooAgAFIAALERgACzUBAX8gASAAKAIEIgJBAXVqIQEgACgCACEAIAEgAkEBcQR/IAEoAgAgAGooAgAFIAALEQEACwwAIAAgACgCbDYCcAs9AQF/IAEgACgCBCIGQQF1aiEBIAAoAgAhACABIAIgAyAEIAUgBkEBcQR/IAEoAgAgAGooAgAFIAALEToAC+UBAQR/IwBBEGsiBCQAIAEgACgCBCIGQQF1aiEHIAAoAgAhBSAGQQFxBEAgBygCACAFaigCACEFCyACKAIAIQAgBEEANgIIIARCADcDACAAQXBJBEACQAJAIABBC08EQCAAQRBqQXBxIgYQ0gghASAEIAZBgICAgHhyNgIIIAQgATYCACAEIAA2AgQMAQsgBCAAOgALIAQhASAARQ0BCyABIAJBBGogABCwCRoLIAAgAWpBADoAACAHIAQgAyAFEQQAIQAgBCwAC0F/TARAIAQoAgAQpQkLIARBEGokACAADwsQ1ggACwUAQYQwCxAAQdgAENIIQQBB2AAQsQkLPwEBfyABIAAoAgQiB0EBdWohASAAKAIAIQAgASACIAMgBCAFIAYgB0EBcQR/IAEoAgAgAGooAgAFIAALEVoACz8BAX8gASAAKAIEIgdBAXVqIQEgACgCACEAIAEgAiADIAQgBSAGIAdBAXEEfyABKAIAIABqKAIABSAACxEuAAsFAEHMMQsbAQF/QdgAENIIQQBB2AAQsQkiAEEBNgI8IAALPwEBfyABIAAoAgQiB0EBdWohASAAKAIAIQAgASACIAMgBCAFIAYgB0EBcQR/IAEoAgAgAGooAgAFIAALEVsAC0MBAX8gASAAKAIEIglBAXVqIQEgACgC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ACICayIFQQFqIgRBf0oEQCAFAn9BACAEIAMgAmsiA0EBdCIGIAYgBEkbQf////8HIANB/////wNJGyIDRQ0AGiADENIICyIEaiIGIAEtAAA6AAAgBUEBTgRAIAQgAiAFELAJGgsgACADIARqNgIIIAAgBkEBajYCBCAAIAQ2AgAgAgRAIAIQpQkLDwsQ6wgAC1IBAn8jAEEQayIDJAAgASAAKAIEIgRBAXVqIQEgACgCACEAIARBAXEEQCABKAIAIABqKAIAIQALIAMgAjoADyABIANBD2ogABECACADQRBqJAALOAECfyAAKAIEIAAoAgAiBGsiAyABSQRAIAAgASADayACENoCDwsgAyABSwRAIAAgASAEajYCBAsLVAECfyMAQRBrIgQkACABIAAoAgQiBUEBdWohASAAKAIAIQAgBUEBcQRAIAEoAgAgAGooAgAhAAsgBCADOgAPIAEgAiAEQQ9qIAARBQAgBEEQaiQACw0AIAAoAgQgACgCAGsLSwECfyMAQRBrIgMkAEEBIQQgACABKAIEIAEoAgAiAWsgAksEfyADIAEgAmosAAA2AghB2OwBIANBCGoQCAVBAQs2AgAgA0EQaiQACxQAIAAoAgAgAWogAi0AADoAAEEBCzQBAX8jAEEQayIEJAAgACgCACEAIAQgAzoADyABIAIgBEEPaiAAEQQAIQAgBEEQaiQAIAALBQBBiB8LSwECfyMAQRBrIgMkAEEBIQQgACABKAIEIAEoAgAiAWsgAksEfyADIAEgAmotAAA2AghB5OwBIANBCGoQCAVBAQs2AgAgA0EQaiQACwUAQcghC1IBAn8jAEEQayIDJAAgASAAKAIEIgRBAXVqIQEgACgCACEAIARBAXEEQCABKAIAIABqKAIAIQALIAMgAjgCDCABIANBDGogABECACADQRBqJAALVAECfyMAQRBrIgQkACABIAAoAgQiBUEBdWohASAAKAIAIQAgBUEBcQRAIAEoAgAgAGooAgAhAAsgBCADOAIMIAEgAiAEQQxqIAARBQAgBEEQaiQAC1EBAn8jAEEQayIDJABBASEEIAAgASgCBCABKAIAIgFrQQJ1IAJLBH8gAyABIAJBAnRqKAIANgIIQcTtASADQQhqEAgFQQELNgIAIANBEGokAAs0AQF/IwBBEGsiBCQAIAAoAgAhACAEIAM4Agwg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AAsRACAABEAgABDxAiAAEKUJCwsQAEGUARDSCEEAQZQBELEJCw0AIAAgASACIAMQtgMLOwEBfyABIAAoAgQiBUEBdWohASAAKAIAIQAgASACIAMgBCAFQQFxBH8gASgCACAAaigCAAUgAAsRCgALCwAgACABIAIQtwMLOQEBfyABIAAoAgQiBEEBdWohASAAKAIAIQAgASACIAMgBEEBcQR/IAEoAgAgAGooAgAFIAALEScACwcAIAAQuQMLNQEBfyABIAAoAgQiAkEBdWohASAAKAIAIQAgASACQQFxBH8gASgCACAAaigCAAUgAAsRHQALBwAgABC6AwtDAQJ/IwBBEGsiAiQAIAEoAgQhAyACIAEoAgAiATYCDCACIAMgAWtBAnU2AgggAEGsFSACQQhqEAg2AgAgAkEQaiQAC1wBAn8jAEEQayICJAAgASAAKAIEIgNBAXVqIQEgACgCACEAIAJBCGogASADQQFxBH8gASgCACAAaigCAAUgAAsRAgAgAigCCBALIAIoAggiABAMIAJBEGokACAAC0gBAn8jAEEQayICJAAgARC4AyIBKAIEIQMgAiABKAIAIgE2AgwgAiADIAFrQQJ1NgIIIABBrBUgAkEIahAINgIAIAJBEGokAAtDAQJ/IwBBEGsiAiQAIAEoAhAhAyACIAEoAgwiATYCDCACIAMgAWtBAnU2AgggAEGsFSACQQhqEAg2AgAgAkEQaiQACwgAIAAoAowBCwcAIAAoAkQLCAAgACgCiAELCAAgACgChAELBgBB7NMAC1gBAX8gAARAIABBPGoQwQMgACgCGCIBBEAgACABNgIcIAEQpQkLIAAoAgwiAQRAIAAgATYCECABEKUJCyAAKAIAIgEEQCAAIAE2AgQgARClCQsgABClCQsLWQEBf0H0ABDSCCIAQgA3AkQgAEIANwIAIABCADcCbCAAQgA3AmQgAEIANwJcIABCADcCVCAAQgA3AkwgAEIANwIIIABCADcCECAAQgA3AhggAEEANgIgIAALOwEBfyABIAAoAgQiBUEBdWohASAAKAIAIQAgASACIAMgBCAFQQFxBH8gASgCACAAaigCAAUgAAsRRgALBgBBpNUAC1QBAX8gAARAAkAgACgCJCIBRQ0AIAEQpQkgACgCACIBBEAgARClCQsgACgCLCIBRQ0AIAEQpQkLIAAo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ADcD0AEgAUIANwPIASAAQYCnAWoiAUIANwPAASABQgA3A9gBIAFCADcD0AEgAUIANwPIASAAQfCoAWoiAUIANwPAASABQgA3A9gBIAFCADcD0AEgAUIANwPIASAAQeCqAWoiAUIANwPAASABQgA3A9gBIAFCADcD0AEgAUIANwPIASAAQdCsAWoiAUIANwPAASABQgA3A9gBIAFCADcD0AEgAUIANwPIASAAQcCuAWoiAUIANwPAASABQgA3A9gBIAFCADcD0AEgAUIANwPIASAAQbCwAWoiAUIANwPAASABQgA3A9gBIAFCADcD0AEgAUIANwPIASAAQaCyAWoiAUIANwPAASABQgA3A9gBIAFCADcD0AEgAUIANwPIASAAQZC0AWoiAUIANwPAASABQgA3A9gBIAFCADcD0AEgAUIANwPIASAAQYC2AWoiAUIANwPAASABQgA3A9gBIAFCADcD0AEgAUIANwPIASAAQfC3AWoiAUIANwPAASABQgA3A9gBIAFCADcD0AEgAUIANwPIASAAQeC5AWoiAUIANwPAASABQgA3A9gBIAFCADcD0AEgAUIANwPIASAAQdC7AWoiAUIANwPAASABQgA3A9gBIAFCADcD0AEgAUIANwPIASAAQcC9AWoiAUIANwPAASABQgA3A9gBIAFCADcD0AEgAUIANwPIASAAQbC/AWoiAUIANwPAASABQgA3A9gBIAFCADcD0AEgAUIANwPIASAAQaDBAWoiAUIANwPAASABQgA3A9gBIAFCADcD0AEgAUIANwPIASAAQZDDAWoiAUIANwPAASABQgA3A9gBIAFCADcD0AEgAUIANwPIASAAQYDFAWoiAUIANwPAASABQgA3A9gBIAFCADcD0AEgAUIANwPIASAAQfDGAWoiAUIANwPAASABQgA3A9gBIAFCADcD0AEgAUIANwPIASAAQeDIAWoiAUIANwPAASABQgA3A9gBIAFCADcD0AEgAUIANwPIASAAQdDKAWoiAUIANwPAASABQgA3A9gBIAFCADcD0AEgAUIANwPIASAAQejYAWoQyAMgAEHQ2AFqQgA3AwAgAEIANwPI2AEgAEIANwPA1gEgAEHI1gFqQgA3AwAgAEHAzAFqQQBBkAgQsQkaIABBuNwBakEAQdACELEJIQNBtPwBKAIAIQEgAEEgNgKI3wEgAEIANwPY2AEgAEIANwPA2AEgAEKas+bMmbPm3D83A4jdASAAQpqz5syZs+bcPzcDiNsBIABBkN0BakKas+bMmbPm3D83AwAgAEGQ2wFqIgRCmrPmzJmz5tw/NwMAIABBmN0BakKas+bMmbPm3D83AwAgAEGY2wFqQpqz5syZs+bcPzcDACAAQaDdAWpCmrPmzJmz5tw/NwMAIABBoNsBakKas+bMmbPm3D83AwAgAEGo3QFqQpqz5syZs+bcPzcDACAAQajbAWpCmrPmzJmz5tw/NwMAIABBsN0BakKas+bMmbPm3D83AwAgAEGw2wFqQpqz5syZs+bcPzcDACAAQbjdAWpCmrPmzJmz5tw/NwMAIABBuNsBakKas+bMmbPm3D83AwAgAEHA3QFqQpqz5syZs+bcPzcDACAAQcDbAWpCmrPmzJmz5tw/NwMAIAAgAbJDAAB6RJU4AuDYASAAQcjdAWpCmrPmzJmz5tw/NwMAIABByNsBakKas+bMmbPm3D83AwAgAEHQ3QFqQpqz5syZs+bcPzcDACAAQdDbAWpCmrPmzJmz5tw/NwMAIABB2N0BakKas+bMmbPm3D83AwAgAEHY2wFqQpqz5syZs+bcPzcDACAAQeDdAWpCmrPmzJmz5tw/NwMAIABB4NsBakKas+bMmbPm3D83AwAgAEHo3QFqQpqz5syZs+bcPzcDACAAQejbAWpCmrPmzJmz5tw/NwMAIABB8N0BakKas+bMmbPm3D83AwAgAEHw2wFqQpqz5syZs+bcPzcDACAAQfjdAWpCmrPmzJmz5tw/NwMAIABB+NsBakKas+bMmbPm3D83AwAgAEGA3gFqQpqz5syZs+bcPzcDACAAQYDcAWpCmrPmzJmz5tw/NwMAIABBiN4BakKas+bMmbPm3D83AwAgAEGI3AFqQpqz5syZs+bcPzcDACAAQZDeAWpCmrPmzJmz5tw/NwMAIABBkNwBakKas+bMmbPm3D83AwAgAEGY3gFqQpqz5syZs+bcPzcDACAAQZjcAWpCmrPmzJmz5tw/NwMAIABBoN4BakKas+bMmbPm3D83AwAgAEGg3AFqQpqz5syZs+bcPzcDACAAQajeAWpCmrPmzJmz5tw/NwMAIABBqNwBakKas+bMmbPm3D83AwAgAEGw3gFqQpqz5syZs+bcPzcDACAAQbDcAWpCmrPmzJmz5tw/NwMAIABBuN4BakKas+bMmbPm3D83AwAgA0Kas+bMmbPm3D83AwAgAEHA3gFqQpqz5syZs+bcPzcDACAAQcDcAWpCmrPmzJmz5tw/NwMAIABByN4BakKas+bMmbPm3D83AwAgAEHI3AFqQpqz5syZs+bcPzcDACAAQdDeAWpCmrPmzJmz5tw/NwMAIABB0NwBakKas+bMmbPm3D83AwAgAEHY3gFqQpqz5syZs+bcPzcDACAAQdjcAWpCmrPmzJmz5tw/NwMAIABB4N4BakKas+bMmbPm3D83AwAgAEHg3AFqQpqz5syZs+bcPzcDACAAQejeAWpCmrPmzJmz5tw/NwMAIABB6NwBakKas+bMmbPm3D83AwAgAEHw3gFqQpqz5syZs+bcPzcDACAAQfDcAWpCmrPmzJmz5tw/NwMAIABB+N4BakKas+bMmbPm3D83AwAgAEH43AFqQpqz5syZs+bcPzcDACAAQYDfAWpCmrPmzJmz5tw/NwMAIABBgN0BakKas+bMmbPm3D83AwAgACABQQptNgKM3wEgBEKas+bMmbPm5D83AwAgAEKAgICAgICA8D83A4jbAQNAIAAgAkEDdGoiAUHA0AFqQoCAgICAgID4PzcDACABQcDOAWogAkEBaiICQQ1styIFOQMAIAFBwMwBaiAFOQMAIAFBwNIBakKAgICAgICA+D83AwAgAUHA1AFqQpqz5syZs+bkPzcDACABQcDWAWpCgICAgICAgPA/NwMAIAJBIEcNAAsgAEKAgICAgIDApMAANwPAzAEgAEHQzAFqQoCAgICAgLCxwAA3AwAgAEHIzAFqQoCAgICAgMCswAA3AwALnAIAIAAQyQMgAEHY0AFqQqa3koaC1pz0PzcDACAAQdDQAWpC9abioODKw/Q/NwMAIABByNABakKQsOWhi9md9T83AwAgAELD66Ph9dHw9D83A8DQASAAQdjMAWpCgICAgICA48jAADcDACAAQdDMAWpCgICAgICA5sfAADcDACAAQcjMAWpCgICAgICAisbAADcDACAAQoCAgICAgJTEwAA3A8DMASAAQdDSAWpC5syZs+bMmfM/NwMAIABByNIBakLmzJmz5syZ8z83AwAgAELmzJmz5syZ8z83A8DSASAAQdDOAWpCgICAgICAgJTAADcDACAAQcjOAWpCgICAgICAwKLAADcDACAAQoCAgICAgNCvwAA3A8DOASAAC5kIAgV/AXwgAEIANwPY2AEgAEHUyABqAn8gACsDwMwBIgeZRAAAAAAAAOBBYwRAIAeqDAELQYCAgIB4CyIDNgIAIABB2MgAaiIEIAAoAsBIIABB0MgAaiIFKAIAIgJBA3RqIgYrAwBEMzMzMzMz6z+iIAGgIgc5AwAgBiAHOQMAIAVBACACQQFqIAIgA0F/akYbNgIAIAAgBCsDACAAKwPY2AGgOQPY2AEgAEH0ygBqAn8gAEHIzAFqKwMAIgeZRAAAAAAAAOBBYwRAIAeqDAELQYCAgIB4CyIDNgIAIABB+MoAaiIEIABB4MoAaigCACAAQfDKAGoiBSgCACICQQN0aiIGKwMARDMzMzMzM+s/oiABoCIHOQMAIAYgBzkDACAFQQAgAkEBaiACIANBf2pGGzYCACAAIAQrAwAgACsD2NgBoDkD2NgBIABBlM0AagJ/IABB0MwBaisDACIHmUQAAAAAAADgQWMEQCAHqgwBC0GAgICAeAsiAzYCACAAQZjNAGoiBCAAQYDNAGooAgAgAEGQzQBqIgUoAgAiAkEDdGoiBisDAEQzMzMzMzPrP6IgAaAiBzkDACAGIAc5AwAgBUEAIAJBAWogAiADQX9qRhs2AgAgACAEKwMAIAArA9jYAaA5A9jYASAAQbTPAGoCfyAAQdjMAWorAwAiB5lEAAAAAAAA4EFjBEAgB6oMAQtBgICAgHgLIgM2AgAgAEG4zwBqIgQgAEGgzwBqKAIAIABBsM8AaiIFKAIAIgJBA3RqIgYrAwBEMzMzMzMz6z+iIAGgIgE5AwAgBiABOQMAIAVBACACQQFqIAIgA0F/akYbNgIAIAAgBCsDACAAKwPY2AGgIgE5A9jYASAAAn8gACsDwM4BIgeZRAAAAAAAAOBBYwRAIAeqDAELQYCAgIB4CyIDNgJUIAAgACgCQCAAKAJQIgJBA3RqIgQrAwAiByAHIAArA2giB6IgAaAiASAHoqE5A1ggBCABOQMAIABBACACQQFqIAIgA0F/akYbNgJQIAACfyAAQcjOAWorAwAiAZlEAAAAAAAA4EFjBEAgAaoMAQtBgICAgHgLIgM2AvQCIAAgACgC4AIgACgC8AIiAkEDdGoiBCsDACIBIAEgACsDiAMiAaIgACsDWKAiByABoqE5A/gCIAQgBzkDACAAQQAgAkEBaiACIANBf2pGGzYC8AIgAAJ/IABB0M4BaisDACIBmUQAAAAAAADgQWMEQCABqgwBC0GAgICAeAsiAzYClAUgACAAKAKABSAAKAKQBSICQQN0aiIEKwMAIgEgASAAKwOoBSIBoiAAKwP4AqAiByABoqE5A5gFIAQgBzkDACAAQQAgAkEBaiACIANBf2pGGzYCkAUgACAAKwOYBSIBOQPA2AEgAQvoBgEBfyMAQYABayIBJAAgABDJAyAAQfjMAWpCgICAgICA3MjAADcDACAAQfDMAWpCgICAgICApMnAADcDACAAQejMAWpCgICAgICAzMrAADcDACAAQeDMAWpCgICAgICA/cnAADcDACAAQdjMAWpCgICAgICAjsvAADcDACAAQdDMAWpCgICAgICA08vAADcDACAAQcjMAWpCgICAgICA0czAADcDACAAQoCAgICAgJXMwAA3A8DMASABQuH10fD6qLj1PzcDSCABQuH10fD6qLj1PzcDQCABQuH10fD6qLj1PzcDUCABQuH10fD6qLj1PzcDWCABQuH10fD6qLj1PzcDYCABQuH10fD6qLj1PzcDaCABQuH10fD6qLj1PzcDcCABQuH10fD6qLj1PzcDeCABQpqz5syZs+bkPzcDOCABQpqz5syZs+bkPzcDMCABQpqz5syZs+bkPzcDKCABQpqz5syZs+bkPzcDICABQpqz5syZs+bkPzcDGCABQpqz5syZs+bkPzcDECABQpqz5syZs+bkPzcDCCABQpqz5syZs+bkPzcDACAAQfjQAWpC4fXR8PqouPU/NwMAIABB8NABakLh9dHw+qi49T83AwAgAEHo0AFqQuH10fD6qLj1PzcDACAAQeDQAWpC4fXR8PqouPU/NwMAIABB2NABakLh9dHw+qi49T83AwAgAEHQ0AFqQuH10fD6qLj1PzcDACAAQcjQAWpC4fXR8PqouPU/NwMAIABBwNABakLh9dHw+qi49T83AwAgAEHg1AFqIAEpAyA3AwAgAEHo1AFqIAEpAyg3AwAgAEHA1AFqIAEpAwA3AwAgAEHI1AFqIAEpAwg3AwAgAEHY1AFqIAEpAxg3AwAgAEHw1AFqIAEpAzA3AwAgAEH41AFqIAEpAzg3AwAgAEHQ1AFqIAEpAxA3AwAgAEHY0gFqQoCAgICAgIDwPzcD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CyAEQoCAgICAgICAQH0hBCAAQoCAgICAgICACIVCAFINASAEQgGDIAR8IQQMAQsgAFAgBUKAgICAgIDA//8AVCAFQoCAgICAgMD//wBRG0UEQCABQgSGIABCPIiEQv////////8Dg0KAgICAgICA/P8AhCEEDAELQoCAgICAgID4/wAhBCAFQv///////7//wwBWDQBCACEEIAVCMIinIgNBkfcASQ0AIAIgACABQv///////z+DQoCAgICAgMAAhCIEQYH4ACADaxCsBCACQRBqIAAgBCADQf+If2oQrQQgAikDCEIEhiACKQMAIgBCPIiEIQQgAikDECACKQMYhEIAUq0gAEL//////////w+DhCIAQoGAgICAgICACFoEQCAEQgF8IQQMAQsgAEKAgICAgICAgAiFQgBSDQAgBEIBgyAEfCEECyACQSBqJAAgBCABQoCAgICAgICAgH+DhL8LkgEBA3xEAAAAAAAA8D8gACAAoiICRAAAAAAAAOA/oiIDoSIERAAAAAAAAPA/IAShIAOhIAIgAiACIAJEkBXLGaAB+j6iRHdRwRZswVa/oKJETFVVVVVVpT+goiACIAKiIgMgA6IgAiACRNQ4iL7p+qi9okTEsbS9nu4hPqCiRK1SnIBPfpK+oKKgoiAAIAGioaCgC/sRAw9/AX4DfCMAQbAEayIGJAAgAiACQX1qQRhtIgVBACAFQQBKGyIOQWhsaiEMIARBAnRBkO8AaigCACILIANBf2oiCGpBAE4EQCADIAtqIQUgDiAIayECA0AgBkHAAmogB0EDdGogAkEASAR8RAAAAAAAAAAABSACQQJ0QaDvAGooAgC3CzkDACACQQFqIQIgB0EBaiIHIAVHDQALCyAMQWhqIQlBACEFIANBAUghBwNAAkAgBwRARAAAAAAAAAAAIRUMAQsgBSAIaiEKQQAhAkQAAAAAAAAAACEVA0AgACACQQN0aisDACAGQcACaiAKIAJrQQN0aisDAKIgFaAhFSACQQFqIgIgA0cNAAsLIAYgBUEDdGogFTkDACAFIAtIIQIgBUEBaiEFIAINAAtBFyAJayERQRggCWshDyALIQUCQANAIAYgBUEDdGorAwAhFUEAIQIgBSEHIAVBAUgiDUUEQANAIAZB4ANqIAJBAnRqAn8CfyAVRAAAAAAAAHA+oiIWmUQAAAAAAADg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A4UgA30hAwwBC0IAIQMgAEIAEKsFCyAHQRBqJAAgAwvlAgEGfyMAQRBrIgckACADQZSrAiADGyIFKAIAIQMCQAJAAkAgAUUEQCADDQEMAwtBfiEEIAJFDQIgACAHQQxqIAAbIQYCQCADBEAgAiEADAELIAEtAAAiAEEYdEEYdSIDQQBOBEAgBiAANgIAIANBAEchBAwECyABLAAAIQBBmIcCKAIAKAIARQRAIAYgAEH/vwNxNgIAQQEhBAwECyAAQf8BcUG+fmoiAEEySw0BIABBAnRBoJMBaigCACEDIAJBf2oiAEUNAiABQQFqIQELIAEtAAAiCEEDdiIJQXBqIANBGnUgCWpyQQdLDQADQCAAQX9qIQAgCEGAf2ogA0EGdHIiA0EATgRAIAVBADYCACAGIAM2AgAgAiAAayEEDAQLIABFDQIgAUEBaiIBLQAAIghBwAFxQYABRg0ACwsgBUEANgIAQaCSAkEZNgIAQX8hBAwBCyAFIAM2AgALIAdBEGokACAEC8sBAgR/An4jAEEQayIDJAAgAbwiBEGAgICAeHEhBQJ+IARB/////wdxIgJBgICAfGpB////9wdNBEAgAq1CGYZCgICAgICAgMA/fAwBCyACQYCAgPwHTwRAIAStQhmGQoCAgICAgMD//wCEDAELIAJFBEBCAAwBCyADIAKtQgAgAmciAkHRAGoQrQQgAykDACEGIAMpAwhCgICAgICAwACFQYn/ACACa61CMIaECyEHIAAgBjcDACAAIAcgBa1CIIaENwMIIANBEGokAAueCwIFfw9+IwBB4ABrIgUkACAEQi+GIANCEYiEIQ8gAkIghiABQiCIhCENIARC////////P4MiDkIPhiADQjGIhCEQIAIgBIVCgICAgICAgICAf4MhCiAOQhGIIREgAkL///////8/gyILQiCIIRIgBEIwiKdB//8BcSEHAkACfyACQjCIp0H//wFxIglBf2pB/f8BTQRAQQAgB0F/akH+/wFJDQEaCyABUCACQv///////////wCDIgxCgICAgICAwP//AFQgDEKAgICAgIDA//8AURtFBEAgAkKAgICAgIAghCEKDAILIANQIARC////////////AIMiAkKAgICAgIDA//8AVCACQoCAgICAgMD//wBRG0UEQCAEQoCAgICAgCCEIQogAyEBDAILIAEgDEKAgICAgIDA//8AhYRQBEAgAiADhFAEQEKAgICAgIDg//8AIQpCACEBDAMLIApCgICAgICAwP//AIQhCkIAIQEMAgsgAyACQoCAgICAgMD//wCFhFAEQCABIAyEIQJCACEBIAJQBEBCgICAgICA4P//ACEKDAMLIApCgICAgICAwP//AIQhCgwCCyABIAyEUARAQgAhAQwCCyACIAOEUARAQgAhAQwCCyAMQv///////z9YBEAgBUHQAGogASALIAEgCyALUCIGG3kgBkEGdK18pyIGQXFqEK0EIAUpA1giC0IghiAFKQNQIgFCIIiEIQ0gC0IgiCESQRAgBmshBgsgBiACQv///////z9WDQAaIAVBQGsgAyAOIAMgDiAOUCIIG3kgCEEGdK18pyIIQXFqEK0EIAUpA0giAkIPhiAFKQNAIgNCMYiEIRAgAkIvhiADQhGIhCEPIAJCEYghESAGIAhrQRBqCyEGIA9C/////w+DIgIgAUL/////D4MiAX4iDyADQg+GQoCA/v8PgyIDIA1C/////w+DIgx+fCIEQiCGIg4gASADfnwiDSAOVK0gAiAMfiIVIAMgC0L/////D4MiC358IhMgEEL/////D4MiDiABfnwiECAEIA9UrUIghiAEQiCIhHwiFCACIAt+IhYgAyASQoCABIQiD358IgMgDCAOfnwiEiABIBFC/////weDQoCAgIAIhCIBfnwiEUIghnwiF3whBCAHIAlqIAZqQYGAf2ohBgJAIAsgDn4iGCACIA9+fCICIBhUrSACIAEgDH58IgwgAlStfCAMIBMgFVStIBAgE1StfHwiAiAMVK18IAEgD358IAEgC34iCyAOIA9+fCIBIAtUrUIghiABQiCIhHwgAiABQiCGfCIBIAJUrXwgASARIBJUrSADIBZUrSASIANUrXx8QiCGIBFCIIiEfCIDIAFUrXwgAyAUIBBUrSAXIBRUrXx8IgIgA1StfCIBQoCAgICAgMAAg1BFBEAgBkEBaiEGDAELIA1CP4ghAyABQgGGIAJCP4iEIQEgAkIBhiAEQj+IhCECIA1CAYYhDSADIARCAYaEIQQLIAZB//8BTgRAIApCgICAgICAwP//AIQhCkIAIQEMAQsCfiAGQQBMBEBBASAGayIHQf8ATQRAIAVBEGogDSAEIAcQrAQgBUEgaiACIAEgBkH/AGoiBhCtBCAFQTBqIA0gBCAGEK0EIAUgAiABIAcQrAQgBSkDMCAFKQM4hEIAUq0gBSkDICAFKQMQhIQhDSAFKQMoIAUpAxiEIQQgBSkDACECIAUpAwgMAgtCACEBDAILIAFC////////P4MgBq1CMIaECyAKhCEKIA1QIARCf1UgBEKAgICAgICAgIB/URtFBEAgCiACQgF8IgEgAlStfCEKDAELIA0gBEKAgICAgICAgIB/hYRQRQRAIAIhAQwBCyAKIAIgAkIBg3wiASACVK18IQoLIAAgATcDACAAIAo3AwggBUHgAGokAAt/AgJ/AX4jAEEQayIDJAAgAAJ+IAFFBEBCAAwBCyADIAEgAUEfdSICaiACcyICrUIAIAJnIgJB0QBqEK0EIAMpAwhCgICAgICAwACFQZ6AASACa61CMIZ8IAFBgICAgHhxrUIghoQhBCADKQMACzcDACAAIAQ3AwggA0EQaiQAC8gJAgR/BH4jAEHwAGsiBSQAIARC////////////AIMhCgJAAkAgAUJ/fCILQn9RIAJC////////////AIMiCSALIAFUrXxCf3wiC0L///////+///8AViALQv///////7///wBRG0UEQCADQn98IgtCf1IgCiALIANUrXxCf3wiC0L///////+///8AVCALQv///////7///wBRGw0BCyABUCAJQoCAgICAgMD//wBUIAlCgICAgICAwP//AFEbRQRAIAJCgICAgICAIIQhBCABIQMMAgsgA1AgCkKAgICAgIDA//8AVCAKQoCAgICAgMD//wBRG0UEQCAEQoCAgICAgCCEIQQMAgsgASAJQoCAgICAgMD//wCFhFAEQEKAgICAgIDg//8AIAIgASADhSACIASFQoCAgICAgICAgH+FhFAiBhshBEIAIAEgBhshAwwCCyADIApCgICAgICAwP//AIWEUA0BIAEgCYRQBEAgAyAKhEIAUg0CIAEgA4MhAyACIASDIQQMAgsgAyAKhFBFDQAgASEDIAIhBAwBCyADIAEgAyABViAKIAlWIAkgClEbIgcbIQogBCACIAcbIgtC////////P4MhCSACIAQgBxsiAkIwiKdB//8BcSEIIAtCMIinQf//AXEiBkUEQCAFQeAAaiAKIAkgCiAJIAlQIgYbeSAGQQZ0rXynIgZBcWoQrQQgBSkDaCEJIAUpA2AhCkEQIAZrIQYLIAEgAyAHGyEDIAJC////////P4MhASAIBH4gAQUgBUHQAGogAyABIAMgASABUCIHG3kgB0EGdK18pyIHQXFqEK0EQRAgB2shCCAFKQNQIQMgBSkDWAtCA4YgA0I9iIRCgICAgICAgASEIQQgCUIDhiAKQj2IhCEBIAIgC4UhDAJ+IANCA4YiAyAGIAhrIgdFDQAaIAdB/wBLBEBCACEEQgEMAQsgBUFAayADIARBgAEgB2sQrQQgBUEwaiADIAQgBxCsBCAFKQM4IQQgBSkDMCAFKQNAIAUpA0iEQgBSrYQLIQMgAUKAgICAgICABIQhCSAKQgOGIQICQCAMQn9XBEAgAiADfSIBIAkgBH0gAiADVK19IgOEUARAQgAhA0IAIQQMAwsgA0L/////////A1YNASAFQSBqIAEgAyABIAMgA1AiBxt5IAdBBnStfKdBdGoiBxCtBCAGIAdrIQYgBSkDKCEDIAUpAyAhAQwBCyACIAN8IgEgA1StIAQgCXx8IgNCgICAgICAgAiDUA0AIAFCAYMgA0I/hiABQgGIhIQhASAGQQFqIQYgA0IBiCEDCyALQoCAgICAgICAgH+DIQIgBkH//wFOBEAgAkKAgICAgIDA//8AhCEEQgAhAwwBC0EAIQcCQCAGQQBKBEAgBiEHDAELIAVBEGogASADIAZB/wBqEK0EIAUgASADQQEgBmsQrAQgBSkDACAFKQMQIAUpAxiEQgBSrYQhASAFKQMIIQMLIANCPYYgAUIDiIQiBCABp0EHcSIGQQRLrXwiASAEVK0gA0IDiEL///////8/gyAChCAHrUIwhoR8IAEgAUIBg0IAIAZBBEYbIgF8IgMgAVStfCEECyAAIAM3AwAgACAENwMIIAVB8ABqJAALgQICAn8EfiMAQRBrIgIkACABvSIFQoCAgICAgICAgH+DIQcCfiAFQv///////////wCDIgRCgICAgICAgHh8Qv/////////v/wBYBEAgBEI8hiEGIARCBIhCgICAgICAgIA8fAwBCyAEQoCAgICAgID4/wBaBEAgBUI8hiEGIAVCBIhCgICAgICAwP//AIQMAQsgBFAEQEIADAELIAIgBEIAIARCgICAgBBaBH8gBEIgiKdnBSAFp2dBIGoLIgNBMWoQrQQgAikDACEGIAIpAwhCgICAgICAwACFQYz4ACADa61CMIaECyEEIAAgBjcDACAAIAQgB4Q3AwggAkEQaiQAC9sBAgF/An5BASEEAkAgAEIAUiABQv///////////wCDIgVCgICAgICAwP//AFYgBUKAgICAgIDA//8AURsNACACQgBSIANC////////////AIMiBkKAgICAgIDA//8AViAGQoCAgICAgMD//wBRGw0AIAAgAoQgBSAGhIRQBEBBAA8LIAEgA4NCAFkEQEF/IQQgACACVCABIANTIAEgA1EbDQEgACAChSABIAOFhEIAUg8LQX8hBCAAIAJWIAEgA1UgASADURsNACAAIAKFIAEgA4WEQgBSIQQLIAQL2AECAX8BfkF/IQICQCAAQgBSIAFC////////////AIMiA0KAgICAgIDA//8AViADQoCAgICAgMD//wBRGw0AIAAgA0KAgICAgICA/z+EhFAEQEEADwsgAUKAgICAgICA/z+DQgBZBEAgAEIAVCABQoCAgICAgID/P1MgAUKAgICAgICA/z9RGw0BIAAgAUKAgICAgICA/z+FhEIAUg8LIABCAFYgAUKAgICAgICA/z9VIAFCgICAgICAgP8/URsNACAAIAFCgICAgICAgP8/hYRCAFIhAgsgAgs1ACAAIAE3AwAgACACQv///////z+DIARCMIinQYCAAnEgAkIwiKdB//8BcXKtQjCGhDcDCAtnAgF/AX4jAEEQayICJAAgAAJ+IAFFBEBCAAwBCyACIAGtQgBB8AAgAWdBH3MiAWsQrQQgAikDCEKAgICAgIDAAIUgAUH//wBqrUIwhnwhAyACKQMACzcDACAAIAM3AwggAkEQaiQAC0UBAX8jAEEQayIFJAAgBSABIAIgAyAEQoCAgICAgICAgH+FELMFIAUpAwAhASAAIAUpAwg3AwggACABNwMAIAVBEGokAAvEAgEBfyMAQdAAayIEJAACQCADQYCAAU4EQCAEQSBqIAEgAkIAQoCAgICAgID//wAQsQUgBCkDKCECIAQpAyAhASADQf//AUgEQCADQYGAf2ohAwwCCyAEQRBqIAEgAkIAQoCAgICAgID//wAQsQUgA0H9/wIgA0H9/wJIG0GCgH5qIQMgBCkDGCECIAQpAxAhAQwBCyADQYGAf0oNACAEQUBrIAEgAkIAQoCAgICAgMAAELEFIAQpA0ghAiAEKQNAIQEgA0GDgH5KBEAgA0H+/wBqIQMMAQsgBEEwaiABIAJCAEKAgICAgIDAABCxBSADQYaAfSADQYaAfUobQfz/AWohAyAEKQM4IQIgBCkDMCEBCyAEIAEgAkIAIANB//8Aaq1CMIYQsQUgACAEKQMINwMIIAAgBCkDADcDACAEQdAAaiQAC44RAgV/DH4jAEHAAWsiBSQAIARC////////P4MhEiACQv///////z+DIQwgAiAEhUKAgICAgICAgIB/gyERIARCMIinQf//AXEhBwJAAkACQCACQjCIp0H//wFxIglBf2pB/f8BTQRAIAdBf2pB/v8BSQ0BCyABUCACQv///////////wCDIgpCgICAgICAwP//AFQgCkKAgICAgIDA//8AURtFBEAgAkKAgICAgIAghCERDAILIANQIARC////////////AIMiAkKAgICAgIDA//8AVCACQoCAgICAgMD//wBRG0UEQCAEQoCAgICAgCCEIREgAyEBDAILIAEgCkKAgICAgIDA//8AhYRQBEAgAyACQoCAgICAgMD//wCFhFAEQEIAIQFCgICAgICA4P//ACERDAMLIBFCgICAgICAwP//AIQhEUIAIQEMAgsgAyACQoCAgICAgMD//wCFhFAEQEIAIQEMAgsgASAKhFANAiACIAOEUARAIBFCgICAgICAwP//AIQhEUIAIQEMAgsgCkL///////8/WARAIAVBsAFqIAEgDCABIAwgDFAiBht5IAZBBnStfKciBkFxahCtBEEQIAZrIQYgBSkDuAEhDCAFKQOwASEBCyACQv///////z9WDQAgBUGgAWogAyASIAMgEiASUCIIG3kgCEEGdK18pyIIQXFqEK0EIAYgCGpBcGohBiAFKQOoASESIAUpA6ABIQMLIAVBkAFqIBJCgICAgICAwACEIhRCD4YgA0IxiIQiAkKEyfnOv+a8gvUAIAJ9IgQQrQUgBUGAAWpCACAFKQOYAX0gBBCtBSAFQfAAaiAFKQOIAUIBhiAFKQOAAUI/iIQiBCACEK0FIAVB4ABqIARCACAFKQN4fRCtBSAFQdAAaiAFKQNoQgGGIAUpA2BCP4iEIgQgAhCtBSAFQUBrIARCACAFKQNYfRCtBSAFQTBqIAUpA0hCAYYgBSkDQEI/iIQiBCACEK0FIAVBIGogBEIAIAUpAzh9EK0FIAVBEGogBSkDKEIBhiAFKQMgQj+IhCIEIAIQrQUgBSAEQgAgBSkDGH0QrQUgBiAJIAdraiEGAn5CACAFKQMIQgGGIAUpAwBCP4iEQn98IgpC/////w+DIgQgAkIgiCIOfiIQIApCIIgiCiACQv////8PgyILfnwiAkIghiINIAQgC358IgsgDVStIAogDn4gAiAQVK1CIIYgAkIgiIR8fCALIAQgA0IRiEL/////D4MiDn4iECAKIANCD4ZCgID+/w+DIg1+fCICQiCGIg8gBCANfnwgD1StIAogDn4gAiAQVK1CIIYgAkIgiIR8fHwiAiALVK18IAJCAFKtfH0iC0L/////D4MiDiAEfiIQIAogDn4iDSAEIAtCIIgiD358IgtCIIZ8Ig4gEFStIAogD34gCyANVK1CIIYgC0IgiIR8fCAOQgAgAn0iAkIgiCILIAR+IhAgAkL/////D4MiDSAKfnwiAkIghiIPIAQgDX58IA9UrSAKIAt+IAIgEFStQiCGIAJCIIiEfHx8IgIgDlStfCACQn58IhAgAlStfEJ/fCILQv////8PgyICIAxCAoYgAUI+iIRC/////w+DIgR+Ig4gAUIeiEL/////D4MiCiALQiCIIgt+fCINIA5UrSANIBBCIIgiDiAMQh6IQv//7/8Pg0KAgBCEIgx+fCIPIA1UrXwgCyAMfnwgAiAMfiITIAQgC358Ig0gE1StQiCGIA1CIIiEfCAPIA1CIIZ8Ig0gD1StfCANIAogDn4iEyAQQv////8PgyIQIAR+fCIPIBNUrSAPIAIgAUIChkL8////D4MiE358IhUgD1StfHwiDyANVK18IA8gCyATfiILIAwgEH58IgwgBCAOfnwiBCACIAp+fCICQiCIIAIgBFStIAwgC1StIAQgDFStfHxCIIaEfCIMIA9UrXwgDCAVIA4gE34iBCAKIBB+fCIKQiCIIAogBFStQiCGhHwiBCAVVK0gBCACQiCGfCAEVK18fCIEIAxUrXwiAkL/////////AFgEQCABQjGGIARC/////w+DIgEgA0L/////D4MiCn4iDEIAUq19QgAgDH0iECAEQiCIIgwgCn4iDSABIANCIIgiC358Ig5CIIYiD1StfSACQv////8PgyAKfiABIBJC/////w+DfnwgCyAMfnwgDiANVK1CIIYgDkIgiIR8IAQgFEIgiH4gAyACQiCIfnwgAiALfnwgDCASfnxCIIZ8fSESIAZBf2ohBiAQIA99DAELIARCIYghCyABQjCGIAJCP4YgBEIBiIQiBEL/////D4MiASADQv////8PgyIKfiIMQgBSrX1CACAMfSIOIAEgA0IgiCIMfiIQIAsgAkIfhoQiDUL/////D4MiDyAKfnwiC0IghiITVK19IAwgD34gCiACQgGIIgpC/////w+DfnwgASASQv////8Pg358IAsgEFStQiCGIAtCIIiEfCAEIBRCIIh+IAMgAkIhiH58IAogDH58IA0gEn58QiCGfH0hEiAKIQIgDiATfQshASAGQYCAAU4EQCARQoCAgICAgMD//wCEIRFCACEBDAELIAZB//8AaiEHIAZBgYB/TARAAkAgBw0AIAQgAUIBhiADViASQgGGIAFCP4iEIgEgFFYgASAUURutfCIBIARUrSACQv///////z+DfCICQoCAgICAgMAAg1ANACACIBGEIREMAgtCACEBDAELIAQgAUIBhiADWiASQgGGIAFCP4iEIgEgFFogASAUURutfCIBIARUrSACQv///////z+DIAetQjCGhHwgEYQhEQsgACABNwMAIAAgETcDCCAFQcABaiQADwsgAEIANwMAIAAgEUKAgICAgIDg//8AIAIgA4RCAFIbNwMIIAVBwAFqJAALpQgCBX8CfiMAQTBrIgUkAAJAIAJBAk0EQCACQQJ0IgJBvJUBaigCACEHIAJBsJUBaigCACEIA0ACfyABKAIEIgIgASgCaEkEQCABIAJBAWo2AgQgAi0AAAwBCyABEKwFCyICIgRBIEYgBEF3akEFSXINAAsCQCACQVVqIgRBAksEQEEBIQYMAQtBASEGIARBAWtFDQBBf0EBIAJBLUYbIQYgASgCBCICIAEoAmhJBEAgASACQQFqNgIEIAItAAAhAgwBCyABEKwFIQILQQAhBAJAAkADQCAEQeyUAWosAAAgAkEgckYEQAJAIARBBksNACABKAIEIgIgASgCaEkEQCABIAJBAWo2AgQgAi0AACECDAELIAEQrAUhAgsgBEEBaiIEQQhHDQEMAgsLIARBA0cEQCAEQQhGDQEgA0UNAiAEQQRJDQIgBEEIRg0BCyABKAJoIgIEQCABIAEoAgRBf2o2AgQLIANFDQAgBEEE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ByACayAHLQAAIgpBAEdrIgYgCUkEfyAFQRBqIAIgBhCwCRogBUEQaiAGaiICQS86AAAgAkEBaiADIAQQsAkaIAVBEGogBiAIampBADoAACAFQRBqIAVBDGoQGyIGBEBBHBCkCSICDQQgBiAFKAIMEMsFDAMLIActAAAFIAoLQQBHIAdqIgItAAANAAsLQRwQpAkiAkUNASACQeSVASkCADcCACACQQhqIgEgAyAEELAJGiABIARqQQA6AAAgAkGkqwIoAgA2AhhBpKsCIAI2AgAgAiEBDAELIAIgBjYCACACIAUoAgw2AgQgAkEIaiIBIAMgBBCwCRogASAEakEAOgAAIAJBpKsCKAIANgIYQaSrAiACNgIAIAIhAQtBnKsCEBIgAUHklQEgACABchshAgsgBUGQAmokACACC4gBAQR/IwBBIGsiASQAAn8DQCABQQhqIABBAnRqIABB5bcBQaiXAUEBIAB0Qf////8HcRsQzAUiAzYCACACIANBAEdqIQIgAEEBaiIAQQZHDQALAkAgAkEBSw0AQYCWASACQQFrDQEaIAEoAghB5JUBRw0AQZiWAQwBC0EACyEAIAFBIGokACAAC2MBAn8jAEEQayIDJAAgAyACNgIMIAMgAjYCCEF/IQQCQEEAQQAgASACEJ8EIgJBAEgNACAAIAJBAWoiAhCkCSIANgIAIABFDQAgACACIAEgAygCDBCfBCEECyADQRBqJAAgBAsqAQF/IwBBEGsiAiQAIAIgATYCDCAAQdC3ASABEMUFIQAgAkEQaiQAIAALLQEBfyMAQRBrIgIkACACIAE2AgwgAEHkAEHftwEgARCfBCEAIAJBEGokACAACx8AIABBAEcgAEGAlgFHcSAAQZiWAUdxBEAgABClCQsLIwECfyAAIQEDQCABIgJBBGohASACKAIADQALIAIgAGtBAnULtwMBBX8jAEEQayIHJAACQAJAAkACQCAABEAgAkEETw0BIAIhAwwCC0EAIQIgASgCACIAKAIAIgNFDQMDQEEBIQUgA0GAAU8EQEF/IQYgB0EMaiADEPsDIgVBf0YNBQsgACgCBCEDIABBBGohACACIAVqIgIhBiADDQALDAMLIAEoAgAhBSACIQMDQAJ/IAUoAgAiBEF/akH/AE8EQCAERQRAIABBADoAACABQQA2AgAMBQtBfyEGIAAgBBD7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CigCADYAACAKIAAgACgCACgCIBECACAIIAoQmQcgChDZCBogCiAAIAAoAgAoAhwRAgAgByAKEJkHIAoQ2QgaIAMgACAAKAIAKAIMEQAAOgAAIAQgACAAKAIAKAIQEQAAOgAAIAogACAAKAIAKAIUEQIAIAUgChCZByAKENkIGiAKIAAgACgCACgCGBECACAGIAoQmQcgChDZCBogACAAKAIAKAIkEQAADAELIAogARCaByIAIgEgASgCACgCLBECACACIAooAgA2AAAgCiAAIAAoAgAoAiARAgAgCCAKEJkHIAoQ2QgaIAogACAAKAIAKAIcEQIAIAcgChCZByAKENkIGiADIAAgACgCACgCDBEAADoAACAEIAAgACgCACgCEBEAADoAACAKIAAgACgCACgCFBECACAFIAoQmQcgChDZCBogCiAAIAAoAgAoAhgRAgAgBiAKEJkHIAoQ2QgaIAAgACgCACgCJBEAAAs2AgAgCkEQaiQACyUBAX8gASgCABDqBEEYdEEYdSECIAAgASgCADYCBCAAIAI6AAAL5wEBBn8jAEEQayIFJAAgACgCBCEDAn8gAigCACAAKAIAayIEQf////8HSQRAIARBAXQMAQtBfwsiBEEBIAQbIQQgASgCACEGIAAoAgAhByADQeMERgR/QQAFIAAoAgALIAQQpgkiCARAIANB4wRHBEAgACgCABogAEEANgIACyAGIAdrIQcgBUHiBDYCBCAAIAVBCGogCCAFQQRqEOsFIgMQnQcgAygCACEGIANBADYCACAGBEAgBiADKAIEEQEACyABIAcgACgCAGo2AgAgAiAEIAAoAgBqNgIAIAVBEGokAA8LEIcHAAvwAQEGfyMAQRBrIgUkACAAKAIEIQMCfyACKAIAIAAoAgBrIgRB/////wdJBEAgBEEBdAwBC0F/CyIEQQQgBBshBCABKAIAIQYgACgCACEHIANB4wRGBH9BAAUgACgCAAsgBBCmCSIIBEAgA0HjBEcEQCAAKAIAGiAAQQA2AgALIAYgB2tBAnUhByAFQeIENgIEIAAgBUEIaiAIIAVBBGoQ6wUiAxCdByADKAIAIQYgA0EANgIAIAYEQCAGIAMoAgQRAQALIAEgACgCACAHQQJ0ajYCACACIAAoAgAgBEF8cWo2AgAgBUEQaiQADwsQhwcAC4QDAQF/IwBBoAFrIgAkACAAIAE2ApgBIAAgAjYCkAEgAEHjBDYCFCAAQRhqIABBIGogAEEUahDrBSEBIAAgBCgCHCIHNgIQIAcgBygCBEEBajYCBCAAQRBqEOIEIQcgAEEAOgAPIABBmAFqIAIgAyAAQRBqIAQoAgQgBSAAQQ9qIAcgASAAQRRqIABBhAFqEJAHBEAgBhCWByAALQAPBEAgBiAHQS0gBygCACgCHBEDABDiCAsgB0EwIAcoAgAoAhwRAwAhAiABKAIAIQQgACgCFCIDQX9qIQcgAkH/AXEhAgNAAkAgBCAHTw0AIAQtAAAgAkcNACAEQQFqIQQMAQsLIAYgBCADEJcHCyAAQZgBaiAAQZABahDmBARAIAUgBSgCAEECcjYCAAsgACgCmAEhAwJ/IAAoAhAiAiACKAIEQX9qIgQ2AgQgBEF/RgsEQCACIAIoAgAoAggRAQALIAEoAgAhAiABQQA2AgAgAgRAIAIgASgCBBEBAAsgAEGgAWokACADC1sBAn8jAEEQayIBJAACQCAALAALQQBIBEAgACgCACECIAFBADoADyACIAEtAA86AAAgAEEANgIEDAELIAFBADoADiAAIAEtAA46AAAgAEEAOgALCyABQRBqJAALrAMBBX8jAEEgayIFJAACfyAALAALQQBIBEAgACgCBAwBCyAALQALCyEDIAAsAAtBAEgEfyAAKAIIQf////8HcUF/agVBCgshBAJAIAIgAWsiBkUNAAJ/An8gACwAC0EASARAIAAoAgAMAQsgAAshByABAn8gACwAC0EASARAIAAoAgAMAQsgAAsCfyAALAALQQBIBEAgACgCBAwBCyAALQALC2pJIAcgAU1xCwRAIAACfwJ/IAVBEGoiACIDQgA3AgAgA0EANgIIIAAgASACEOEFIAAiASwAC0EASAsEQCABKAIADAELIAELAn8gACwAC0EASARAIAAoAgQMAQsgAC0ACwsQ4QggABDZCBoMAQsgBCADayAGSQRAIAAgBCADIAZqIARrIAMgAxDfCAsCfyAALAALQQBIBEAgACgCAAwBCyAACyADaiEEA0AgASACRwRAIAQgAS0AADoAACABQQFqIQEgBEEBaiEEDAELCyAFQQA6AA8gBCAFLQAPOgAAIAMgBmohAQJAIAAsAAtBAEgEQCAAIAE2AgQMAQsgACABOgALCwsgBUEgaiQACwsAIABBhKwCEOoFCyAAIAAQywggACABKAIINgIIIAAgASkCADcCACABEI8GCwsAIABB/KsCEOoFC34BAX8jAEEgayIDJAAgAyABNgIQIAMgADYCGCADIAI2AggDQAJAAn9BASADKAIYIAMoAhBGQQFzRQ0AGiADKAIYLQAAIAMoAggtAABGDQFBAAshACADQSBqJAAgAA8LIAMgAygCGEEBajYCGCADIAMoAghBAWo2AggMAAALAAs0AQF/IwBBEGsiAiQAIAIgACgCADYCCCACIAIoAgggAWo2AgggAigCCCEAIAJBEGokACAACz0BAn8gASgCACECIAFBADYCACACIQMgACgCACECIAAgAzYCACACBEAgAiAAKAIEEQEACyAAIAEoAgQ2AgQL+wQBAX8jAEHwBGsiACQAIAAgATYC6AQgACACNgLgBCAAQeMENgIQIABByAFqIABB0AFqIABBEGoQ6wUhByAAIAQoAhwiATYCwAEgASABKAIEQQFqNgIEIABBwAFqEO8EIQEgAEEAOgC/AQJAIABB6ARqIAIgAyAAQcABaiAEKAIEIAUgAEG/AWogASAHIABBxAFqIABB4ARqEJ8HRQ0AIABB27cBKAAANgC3ASAAQdS3ASkAADcDsAEgASAAQbABaiAAQboBaiAAQYABaiABKAIAKAIwEQgAGiAAQeIENgIQIABBCGpBACAAQRBqEOsFIQEgAEEQaiECAkAgACgCxAEgBygCAGtBiQNOBEAgACgCxAEgBygCAGtBAnVBAmoQpAkhAyABKAIAIQIgASADNgIAIAIEQCACIAEoAgQRAQALIAEoAgBFDQEgASgCACECCyAALQC/AQRAIAJBLToAACACQQFqIQILIAcoAgAhBANAAkAgBCAAKALEAU8EQCACQQA6AAAgACAGNgIAIABBEGogABDPBUEBRw0BIAEoAgAhAiABQQA2AgAgAgRAIAIgASgCBBEBAAsMBAsgAiAAQbABaiAAQYABaiAAQagBaiAEEKsGIABBgAFqa0ECdWotAAA6AAAgAkEBaiECIARBBGohBAwBCwsQhwcACxCHBwALIABB6ARqIABB4ARqEPIEBEAgBSAFKAIAQQJyNgIACyAAKALoBCECAn8gACgCwAEiASABKAIEQX9qIgM2AgQgA0F/RgsEQCABIAEoAgAoAggRAQALIAco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CyABQQA2AgggACABKAIINgIAIABBADoACwsgAUEQaiQAC64DAQV/IwBBEGsiAyQAAn8gACwAC0EASARAIAAoAgQMAQsgAC0ACwshBSAALAALQQBIBH8gACgCCEH/////B3FBf2oFQQELIQQCQCACIAFrQQJ1IgZFDQACfwJ/IAAsAAtBAEgEQCAAKAIADAELIAALIQcgAQJ/IAAsAAtBAEgEQCAAKAIADAELIAALAn8gACwAC0EASARAIAAoAgQMAQsgAC0ACwtBAnRqSSAHIAFNcQsEQCAAAn8CfyADQgA3AgAgA0EANgIIIAMgASACEOUFIAMiACwAC0EASAsEQCAAKAIADAELIAALAn8gAywAC0EASARAIAMoAgQMAQsgAy0ACwsQ6AggAxDZCBoMAQsgBCAFayAGSQRAIAAgBCAFIAZqIARrIAUgBRDnCAsCfyAALAALQQBIBEAgACgCAAwBCyAACyAFQQJ0aiEEA0AgASACRwRAIAQgASgCADYCACABQQRqIQEgBEEEaiEEDAELCyADQQA2AgAgBCADKAIANgIAIAUgBmohAQJAIAAsAAtBAEgEQCAAIAE2AgQMAQsgACABOgALCwsgA0EQaiQACwsAIABBlKwCEOoFCyAAIAAQzAggACABKAIINgIIIAAgASkCADcCACABEI8GCwsAIABBjKwCEOoFC34BAX8jAEEgayIDJAAgAyABNgIQIAMgADYCGCADIAI2AggDQAJAAn9BASADKAIYIAMoAhBGQQFzRQ0AGiADKAIYKAIAIAMoAggoAgBGDQFBAAshACADQSBqJAAgAA8LIAMgAygCGEEEajYCGCADIAMoAghBBGo2AggMAAALAAs3AQF/IwBBEGsiAiQAIAIgACgCADYCCCACIAIoAgggAUECdGo2AgggAigCCCEAIAJBEGokACAAC/QGAQt/IwBB0ANrIgAkACAAIAU3AxAgACAGNwMYIAAgAEHgAmo2AtwCIABB4AJqIABBEGoQ0AUhCSAAQeIENgLwASAAQegBakEAIABB8AFqEOsFIQsgAEHiBDYC8AEgAEHgAWpBACAAQfABahDrBSEKIABB8AFqIQwCQCAJQeQATwRAEI0GIQcgACAFNwMAIAAgBjcDCCAAQdwCaiAHQd+3ASAAEL0GIQkgACgC3AIiCEUNASALKAIAIQcgCyAINgIA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AmohAyABQQRqIQEMAQsLIAILRQADQAJAIAIgA0cEfyACKAIAQf8ASw0BQayXASgCACACKAIAQQF0ai8BACABcUUNASACBSADCw8LIAJBBGohAgwAAAsAC0UAAkADQCACIANGDQECQCACKAIAQf8ASw0AQayXASgCACACKAIAQQF0ai8BACABcUUNACACQQRqIQIMAQsLIAIhAwsgAwseACABQf8ATQR/QbCdASgCACABQQJ0aigCAAUgAQsLQQADQCABIAJHBEAgASABKAIAIgBB/wBNBH9BsJ0BKAIAIAEoAgBBAnRqKAIABSAACzYCACABQQRqIQEMAQsLIAILHgAgAUH/AE0Ef0HAqQEoAgAgAUECdGooAgAFIAELC0EAA0AgASACRwRAIAEgASgCACIAQf8ATQR/QcCpASgCACABKAIAQQJ0aigCAAUgAAs2AgAgAUEEaiEBDAELCyACCwQAIAELKgADQCABIAJGRQRAIAMgASwAADYCACADQQRqIQMgAUEBaiEBDAELCyACCxMAIAEgAiABQYABSRtBGHRBGHULNQADQCABIAJGRQRAIAQgASgCACIAIAMgAEGAAUkbOgAAIARBAWohBCABQQRqIQEMAQsLIAILKQEBfyAAQYS4ATYCAAJAIAAoAggiAUUNACAALQAMRQ0AIAEQpQkLIAALCgAgABDgBxClCQsnACABQQBOBH9BsJ0BKAIAIAFB/wFxQQJ0aigCAAUgAQtBGHRBGHULQAADQCABIAJHBEAgASABLAAAIgBBAE4Ef0GwnQEoAgAgASwAAEECdGooAgAFIAALOgAAIAFBAWohAQwBCwsgAgsnACABQQBOBH9BwKkBKAIAIAFB/wFxQQJ0aigCAAUgAQtBGHRBGHULQAADQCABIAJHBEAgASABLAAAIgBBAE4Ef0HAqQEoAgAgASwAAEECdGooAgAFIAALOgAAIAFBAWohAQwBCwsgAgsqAANAIAEgAkZFBEAgAyABLQAAOgAAIANBAWohAyABQQFqIQEMAQsLIAILDAAgASACIAFBf0obCzQAA0AgASACRkUEQCAEIAEsAAAiACADIABBf0obOgAAIARBAWohBCABQQFqIQEMAQsLIAILEgAgBCACNgIAIAcgBTYCAEEDCwsAIAQgAjYCAEEDC1gAIwBBEGsiACQAIAAgBDYCDCAAIAMg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ACADIAEgAhCNBhDeBSADKQMAIQQgACADKQMINwMIIAAgBDcDACADQRBqJAALAwAAC0cBAX8gAEEIaiIBKAIARQRAIAAgACgCACgCEBEBAA8LAn8gASABKAIAQX9qIgE2AgAgAUF/RgsEQCAAIAAoAgAoAhARAQALCwQAQQALLgADQCAAKAIAQQFGDQALIAAoAgBFBEAgAEEBNgIAIAFB5QQRAQAgAEF/NgIACwsxAQJ/IABBASAAGyEAA0ACQCAAEKQJIgENAEGsuwIoAgAiAkUNACACEQcADAELCyABCzoBAn8gARCaBCICQQ1qENIIIgNBADYCCCADIAI2AgQgAyACNgIAIAAgA0EMaiABIAJBAWoQsAk2AgALKQEBfyACBEAgACEDA0AgAyABNgIAIANBBGohAyACQX9qIgINAAsLIAALaQEBfwJAIAAgAWtBAnUgAkkEQANAIAAgAkF/aiICQQJ0IgNqIAEgA2ooAgA2AgAgAg0ADAIACwALIAJFDQAgACEDA0AgAyABKAIANgIAIANBBGohAyABQQRqIQEgAkF/aiICDQALCyAACwoAQYznARDWAgALWQECfyMAQRBrIgMkACAAQgA3AgAgAEEANgIIIAAhAgJAIAEsAAtBAE4EQCACIAEoAgg2AgggAiABKQIANwIADAELIAAgASgCACABKAIEENgICyADQRBqJAALnAEBA38jAEEQayIEJABBbyACTwRAAkAgAkEKTQRAIAAgAjoACyAAIQMMAQsgACACQQtPBH8gAkEQakFwcSIDIANBf2oiAyADQQtGGwVBCgtBAWoiBRC+CCIDNgIAIAAgBUGAgICAeHI2AgggACACNgIECyADIAEgAhDQBCAEQQA6AA8gAiADaiAELQAPOgAAIARBEGokAA8LENYIAAsdACAALAALQQBIBEAgACgCCBogACgCABClCQsgAAvJAQEDfyMAQRBrIgQkAAJAIAAsAAtBAEgEfyAAKAIIQf////8HcUF/agVBCgsiAyACTwRAAn8gACwAC0EASARAIAAoAgAMAQsgAAsiAyEFIAIEQCAFIAEgAhCyCQsgBEEAOgAPIAIgA2ogBC0ADzoAAAJAIAAsAAtBAEgEQCAAIAI2AgQMAQsgACACOgALCwwBCyAAIAMgAiADawJ/IAAsAAtBAEgEQCAAKAIEDAELIAAtAAsLIgBBACAAIAIgARDbCAsgBEEQaiQAC8wCAQV/IwBBEGsiCCQAIAFBf3NBb2ogAk8EQAJ/IAAsAAtBAEgEQCAAKAIADAELIAALIQkCf0Hn////ByABSwRAIAggAUEBdDYCCCAIIAEgAmo2AgwCfyMAQRBrIgIkACAIQQxqIgooAgAgCEEIaiILKAIASSEMIAJBEGokACALIAogDBsoAgAiAkELTwsEfyACQRBqQXBxIgIgAkF/aiICIAJBC0YbBUEKCwwBC0FuC0EBaiIKEL4IIQIgBARAIAIgCSAEENAECyAGBEAgAiAEaiAHIAYQ0AQLIAMgBWsiAyAEayIHBEAgAiAEaiAGaiAEIAlqIAVqIAcQ0AQLIAFBCkcEQCAJEKUJCyAAIAI2AgAgACAKQYCAgIB4cjYCCCAAIAMgBmoiADYCBCAIQQA6AAcgACACaiAILQAHOgAAIAhBEGokAA8LENYIAAs4AQF/An8gACwAC0EASARAIAAoAgQMAQsgAC0ACwsiAiABSQRAIAAgASACaxDdCA8LIAAgARDeCAvJAQEEfyMAQRBrIgUkACABBEAgACwAC0EASAR/IAAoAghB/////wdxQX9qBUEKCyECAn8gACwAC0EASARAIAAoAgQMAQsgAC0ACwsiAyABaiEEIAIgA2sgAUkEQCAAIAIgBCACayADIAMQ3wgLIAMCfyAALAALQQBIBEAgACgCAAwBCyAACyICaiABQQAQ4AgCQCAALAALQQBIBEAgACAENgIEDAELIAAgBDoACwsgBUEAOgAPIAIgBGogBS0ADzoAAAsgBUEQaiQAC2EBAn8jAEEQayICJAACQCAALAALQQBIBEAgACgCACEDIAJBADoADyABIANqIAItAA86AAAgACABNgIEDAELIAJBADoADiAAIAFqIAItAA46AAAgACABOgALCyACQRBqJAALjQIBBX8jAEEQayIFJABBbyABayACTwRAAn8gACwAC0EASARAIAAoAgAMAQsgAAshBgJ/Qef///8HIAFLBEAgBSABQQF0NgIIIAUgASACajYCDAJ/IwBBEGsiAiQAIAVBDGoiBygCACAFQQhqIggoAgBJIQkgAkEQaiQAIAggByAJGygCACICQQtPCwR/IAJBEGpBcHEiAiACQX9qIgIgAkELRhsFQQoLDAELQW4LQQFqIgcQvgghAiAEBEAgAiAGIAQQ0AQLIAMgBGsiAwRAIAIgBGogBCAGaiADENAECyABQQpHBEAgBhClCQsgACACNgIAIAAgB0GAgICAeHI2AgggBUEQaiQADwsQ1ggACxUAIAEEQCAAIAJB/wFxIAEQsQkaCwvXAQEDfyMAQRBrIgUkAAJAIAAsAAtBAEgEfyAAKAIIQf////8HcUF/agVBCgsiBAJ/IAAsAAtBAEgEQCAAKAIEDAELIAAtAAsLIgNrIAJPBEAgAkUNAQJ/IAAsAAtBAEgEQCAAKAIADAELIAALIgQgA2ogASACENAEIAIgA2oiAiEBAkAgACwAC0EASARAIAAgATYCBAwBCyAAIAE6AAsLIAVBADoADyACIARqIAUtAA86AAAMAQsgACAEIAIgA2ogBGsgAyADQQAgAiABENsICyAFQRBqJAALwQEBA38jAEEQayIDJAAgAyABOgAPAkACQAJAAkAgACwAC0EASARAIAAoAgQiBCAAKAIIQf////8HcUF/aiICRg0BDAMLQQohBEEKIQIgAC0ACyIBQQpHDQELIAAgAkEBIAIgAhDfCCAEIQEgACwAC0EASA0BCyAAIgIgAUEBajoACwwBCyAAKAIAIQIgACAEQQFqNgIEIAQhAQsgASACaiIAIAMtAA86AAAgA0EAOgAOIAAgAy0ADjoAASADQRBqJAALOwEBfyMAQRBrIgEkAAJAIABBAToACyAAQQFBLRDgCCABQQA6AA8gACABLQAPOgABIAFBEGokAA8ACwALowEBA38jAEEQayIEJABB7////wMgAk8EQAJAIAJBAU0EQCAAIAI6AAsgACEDDAELIAAgAkECTwR/IAJBBGpBfHEiAyADQX9qIgMgA0ECRhsFQQELQQFqIgUQyggiAzYCACAAIAVBgICAgHhyNgIIIAAgAjYCBAsgAyABIAIQ2QQgBEEANgIMIAMgAkECdGogBCgCDDYCACAEQRBqJAAPCxDWCAAL0AEBA38jAEEQayIEJAACQCAALAALQQBIBH8gACgCCEH/////B3FBf2oFQQELIgMgAk8EQAJ/IAAsAAtBAEgEQCAAKAIADAELIAALIgUhAyACBH8gAyABIAIQ1QgFIAMLGiAEQQA2AgwgBSACQQJ0aiAEKAIMNgIAAkAgACwAC0EASARAIAAgAjYCBAwBCyAAIAI6AAsLDAELIAAgAyACIANrAn8gACwAC0EASARAIAAoAgQMAQsgAC0ACwsiAEEAIAAgAiABEOYICyAEQRBqJAAL5QIBBX8jAEEQayIIJAAgAUF/c0Hv////A2ogAk8EQAJ/IAAsAAtBAEgEQCAAKAIADAELIAALIQkCf0Hn////ASABSwRAIAggAUEBdDYCCCAIIAEgAmo2AgwCfyMAQRBrIgIkACAIQQxqIgooAgAgCEEIaiILKAIASSEMIAJBEGokACALIAogDBsoAgAiAkECTwsEfyACQQRqQXxxIgIgAkF/aiICIAJBAkYbBUEBCwwBC0Hu////AwtBAWoiChDKCCECIAQEQCACIAkgBBDZBAsgBgRAIARBAnQgAmogByAGENkECyADIAVrIgMgBGsiBwRAIARBAnQiBCACaiAGQQJ0aiAEIAlqIAVBAnRqIAcQ2QQLIAFBAUcEQCAJEKUJCyAAIAI2AgAgACAKQYCAgIB4cjYCCCAAIAMgBmoiADYCBCAIQQA2AgQgAiAAQQJ0aiAIKAIENgIAIAhBEGokAA8LENYIAAuaAgEFfyMAQRBrIgUkAEHv////AyABayACTwRAAn8gACwAC0EASARAIAAoAgAMAQsgAAshBgJ/Qef///8BIAFLBEAgBSABQQF0NgIIIAUgASACajYCDAJ/IwBBEGsiAiQAIAVBDGoiBygCACAFQQhqIggoAgBJIQkgAkEQaiQAIAggByAJGygCACICQQJPCwR/IAJBBGpBfHEiAiACQX9qIgIgAkECRhsFQQELDAELQe7///8DC0EBaiIHEMoIIQIgBARAIAIgBiAEENkECyADIARrIgMEQCAEQQJ0IgQgAmogBCAGaiADENkECyABQQFHBEAgBhClCQsgACACNgIAIAAgB0GAgICAeHI2AgggBUEQaiQADwsQ1ggAC90BAQN/IwBBEGsiBSQAAkAgACwAC0EASAR/IAAoAghB/////wdxQX9qBUEBCyIEAn8gACwAC0EASARAIAAoAgQMAQsgAC0ACwsiA2sgAk8EQCACRQ0BAn8gACwAC0EASARAIAAoAgAMAQsgAAsiBCADQQJ0aiABIAIQ2QQgAiADaiICIQECQCAALAALQQBIBEAgACABNgIEDAELIAAgAToACwsgBUEANgIMIAQgAkECdGogBSgCDDYCAAwBCyAAIAQgAiADaiAEayAD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BkJ/VQ0ACwsgB0EBIANrrYYMAQsgB0L/////////B4NCgICAgICAgAiECyIHfSIGQn9VIQQgAiADSgRAA0ACQCAERQ0AIAYiBUIAUg0AIABEAAAAAAAAAACiDwsgBUIBhiIFIAd9IgZCf1UhBCACQX9qIgIgA0oNAAsgAyECCwJAIARFDQAgBiIFQgBSDQAgAEQAAAAAAAAAAKIPCwJAIAVC/////////wdWBEAgBSEGDAELA0AgAkF/aiECIAVCgICAgICAgARUIQMgBUIBhiIGIQUgAw0ACwsgCEKAgICAgICAgIB/gyEFIAJBAU4EfiAGQoCAgICAgIB4fCACrUI0hoQFIAZBASACa62ICyAFhL8PCyAARAAAAAAAAAAAoiAAIAUgBlEbC6sGAgV/BH4jAEGAAWsiBSQAAkACQAJAIAMgBEIAQgAQtQVFDQAgAyAEEK8JIQcgAkIwiKciCUH//wFxIgZB//8BRg0AIAcNAQsgBUEQaiABIAIgAyAEELEFIAUgBSkDECICIAUpAxgiASACIAEQuwUgBSkDCCECIAUpAwAhBAwBCyABIAJC////////P4MgBq1CMIaEIgogAyAEQv///////z+DIARCMIinQf//AXEiB61CMIaEIgsQtQVBAEwEQCABIAogAyALELUFBEAgASEEDAILIAVB8ABqIAEgAkIAQgAQsQUgBSkDeCECIAUpA3AhBAwBCyAGBH4gAQUgBUHgAGogASAKQgBCgICAgICAwLvAABCxBSAFKQNoIgpCMIinQYh/aiEGIAUpA2ALIQQgB0UEQCAFQdAAaiADIAtCAEKAgICAgIDAu8AAELEFIAUpA1giC0IwiKdBiH9qIQcgBSkDUCEDCyAKQv///////z+DQoCAgICAgMAAhCIKIAtC////////P4NCgICAgICAwACEIg19IAQgA1StfSIMQn9VIQggBCADfSELIAYgB0oEQANAAn4gCARAIAsgDIRQBEAgBUEgaiABIAJCAEIAELEFIAUpAyghAiAFKQMgIQQMBQsgC0I/iCEKIAxCAYYMAQsgCkIBhiEKIAQhCyAEQj+ICyEMIAogDIQiCiANfSALQgGGIgQgA1StfSIMQn9VIQggBCADfSELIAZBf2oiBiAHSg0ACyAHIQYLAkAgCEUNACALIgQgDCIKhEIAUg0AIAVBMGogASAC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ACAAIAE6AAAgAkEDSQ0AIANBfmogAToAACAAIAE6AAEgA0F9aiABOgAAIAAgAToAAiACQQdJDQAgA0F8aiABOgAAIAAgAToAAyACQQlJDQAgAEEAIABrQQNxIgRqIgMgAUH/AXFBgYKECGwiATYCACADIAIgBGtBfHEiBGoiAkF8aiABNgIAIARBCUkNACADIAE2AgggAyABNgIEIAJBeGogATYCACACQXRqIAE2AgAgBEEZSQ0AIAMgATYCGCADIAE2AhQgAyABNgIQIAMgATYCDCACQXBqIAE2AgAgAkFsaiABNgIAIAJBaGogATYCACACQWRqIAE2AgAgBCADQQRxQRhyIgRrIgJBIEkNACABrSIFQiCGIAWEIQUgAyAEaiEBA0AgASAFNwMYIAEgBTcDECABIAU3AwggASAFNwMAIAFBIGohASACQWBqIgJBH0sNAAsLIAAL5QIBAn8CQCAAIAFGDQACQCABIAJqIABLBEAgACACaiIEIAFLDQELIAAgASACELAJGg8LIAAgAXNBA3EhAwJAAkAgACABSQRAIAMNAiAAQQNxRQ0BA0AgAkUNBCAAIAEtAAA6AAAgAUEBaiEBIAJBf2ohAiAAQQFqIgBBA3ENAAsMAQsCQCADDQAgBEEDcQRAA0AgAkUNBSAAIAJBf2oiAmoiAyABIAJqLQAAOgAAIANBA3ENAAsLIAJBA00NAANAIAAgAkF8aiICaiABIAJqKAIANgIAIAJBA0sNAAsLIAJFDQIDQCAAIAJBf2oiAmogASACai0AADoAACACDQALDAILIAJBA00NACACIQMDQCAAIAEoAgA2AgAgAUEEaiEBIABBBGohACADQXxqIgNBA0sNAAsgAkEDcSECCyACRQ0AA0AgACABLQAAOgAAIABBAWohACABQQFqIQEgAkF/aiICDQALCwsfAEGkvwIoAgBFBEBBqL8CIAE2AgBBpL8CIAA2AgALCwQAIwALEAAjACAAa0FwcSIAJAAgAAsGACAAJAALBgAgAEAACwsAIAEgAiAAEQIACw8AIAEgAiADIAQgABEKAAsNACABIAIgAyAAER8ACw8AIAEgAiADIAQgABFIAAsNACABIAIgAyAAERoACw8AIAEgAiADIAQgABEZAAsLACABIAIgABEPAAsLACABIAIgABEXAAsPACABIAIgAyAEIAARWAALEQAgASACIAMgBCAFIAARSwALEQAgASACIAMgBCAFIAARWQALEwAgASACIAMgBCAFIAYgABFMAAsPACABIAIgAyAEIAAROwALEQAgASACIAMgBCAFIAARNQALEQAgASACIAMgBCAFIAARPAALEwAgASACIAMgBCAFIAYgABE2AAsTACABIAIgAyAEIAUgBiAAET0ACxUAIAEgAiADIAQgBSAGIAcgABE3AAsLACABIAIgABETAAsNACABIAIgAyAAEUkACxEAIAEgAiADIAQgBSAAET8ACxMAIAEgAiADIAQgBSAGIAARJQALDwAgASACIAMgBCAAEUMACw8AIAEgAiADIAQgABEYAAsNACABIAIgAyAAET4ACw8AIAEgAiADIAQgABE4AAsPACABIAIgAyAEIAARCAALDQAgASACIAMgABEUAAsPACABIAIgAyAEIAARTgALEQAgASACIAMgBCAFIAARUQALEQAgASACIAMgBCAFIAAROgALEwAgASACIAMgBCAFIAYgABEzAAsTACABIAIgAyAEIAUgBiAAEVoACxUAIAEgAiADIAQgBSAGIAcgABFQAAsTACABIAIgAyAEIAUgBiAAES4ACxUAIAEgAiADIAQgBSAGIAcgABFVAAsTACABIAIgAyAEIAUgBiAAEVsACxUAIAEgAiADIAQgBSAGIAcgABFTAAsXACABIAIgAyAEIAUgBiAHIAggABFdAAsZACABIAIgAyAEIAUgBiAHIAggCSAAEVYACw0AIAEgAiADIAARVwALDwAgASACIAMgBCAAEUoACxMAIAEgAiADIAQgBSAGIAARKwALFQAgASACIAMgBCAFIAYgByAAEU0ACw8AIAEgAiADIAQgABEjAAsRACABIAIgAyAEIAUgABEqAAsNACABIAIgAyAAESEACw8AIAEgAiADIAQgABE0AAsNACABIAIgAyAAEV8ACw8AIAEgAiADIAQgABEyAAsPACABIAIgAyAEIAARZAALEQAgASACIAMgBCAFIAARLAALEwAgASACIAMgBCAFIAYgABFPAAsTACABIAIgAyAEIAUgBiAAEVwACxUAIAEgAiADIAQgBSAGIAcgABFUAAsRACABIAIgAyAEIAUgABEtAAsTACABIAIgAyAEIAUgBiAAEVIACwsAIAEgAiAAEWYACxEAIAEgAiADIAQgBSAAEQsACw0AIAEgAiADIAARJwALDwAgASACIAMgBCAAEUQACwkAIAEgABEdAAsLACABIAIgABEpAAsPACABIAIgAyAEIAARRgALEQAgASACIAMgBCAFIAARRwALEwAgASACIAMgBCAFIAYgABExAAsVACABIAIgAyAEIAUgBiAHIAARMAALEwAgASACIAMgBCAFIAYgABFFAAsRACABIAIgAyAEIAUgABEGAAsXACABIAIgAyAEIAUgBiAHIAggABEOAAsTACABIAIgAyAEIAUgBiAAEQkACxEAIAEgAiADIAQgBSAAESYACxUAIAEgAiADIAQgBSAGIAcgABESAAsTACABIAIgAyAEIAUgBiAAEQ0ACwcAIAARBwALGQAgASACIAOtIAStQiCGhCAFIAYgABEkAAsiAQF+IAEgAq0gA61CIIaEIAQgABEcACIFQiCIpxApIAWnCxkAIAEgAiADIAQgBa0gBq1CIIaEIAARIgALIwAgASACIAMgBCAFrSAGrUIghoQgB60gCK1CIIaEIAARQgALJQAgASACIAMgBCAFIAatIAetQiCGhCAIrSAJrUIghoQgABFBAAsLp+YBUABBgAgL4BBWZWN0b3JJbnQAVmVjdG9yRG91YmxlAFZlY3RvckNoYXIAVmVjdG9yVUNoYXIAVmVjdG9yRmxvYXQAdmVjdG9yVG9vbHMAY2xlYXJWZWN0b3JEYmwAY2xlYXJWZWN0b3JGbG9hdABtYXhpU2V0dGluZ3MAc2V0dXAAbWF4aUVudmVsb3BlAGxpbmUAdHJpZ2dlcgBhbXBsaXR1ZGUAdmFsaW5kZXgAbWF4aURlbGF5bGluZQBkbABtYXhpTWl4AHN0ZXJlbwBxdWFkAGFtYmlzb25pYwBtYXhpTGluZQBwbGF5AHByZXBhcmUAdHJpZ2dlckVuYWJsZQBpc0xpbmVDb21wbGV0ZQBtYXhpWEZhZGUAeGZhZGUAbWF4aUxhZ0V4cABpbml0AGFkZFNhbXBsZQB2YWx1ZQBhbHBoYQBhbHBoYVJlY2lwcm9jYWwAdmFsAG1heGlTYW1wbGUAZ2V0TGVuZ3RoAHNldFNhbXBsZQBzZXRTYW1wbGVGcm9tT2dnQmxvYgBpc1JlYWR5AHBsYXlPbmNlAHBsYXlPblpYAHBsYXk0AGNsZWFyAG5vcm1hbGlzZQBhdXRvVHJpbQBsb2FkAHJlYWQAbG9vcFNldFBvc09uWlgAbWF4aUR5bgBnYXRlAGNvbXByZXNzb3IAY29tcHJlc3MAc2V0QXR0YWNrAHNldFJlbGVhc2UAc2V0VGhyZXNob2xkAHNldFJhdGlvAG1heGlFbnYAYXIAYWRzcgBzZXREZWNheQBzZXRTdXN0YWluAGNvbnZlcnQAbXRvZgBtc1RvU2FtcHMAbWF4aVNhbXBsZUFuZEhvbGQAc2FoAG1heGlGbGFuZ2VyAGZsYW5nZQBtYXhpQ2hvcnVzAGNob3J1cwBtYXhpRENCbG9ja2VyAG1heGlTVkYAc2V0Q3V0b2ZmAHNldFJlc29uYW5jZQBtYXhpTWF0aABhZGQAc3ViAG11bABkaXYAZ3QAbHQAZ3RlAGx0ZQBtb2QAYWJzAHBvdwBtYXhpQ2xvY2sAdGlja2VyAHNldFRlbXBvAHNldFRpY2tzUGVyQmVhdABpc1RpY2sAY3VycmVudENvdW50AHBsYXlIZWFkAGJwcwBicG0AdGljawB0aWNrcwBtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yAHNldFBoYXNlAGdldFBoYXNlAG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQAc2V0UGhhc2VzAHNpemUAbWF4aUFzeW5jS3VyYW1vdG9Pc2NpbGxhdG9yAG1heGlUaW1lU3RyZXRjaABzaGFyZWRfcHRyPG1heGlUaW1lc3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPgBnZXROb3JtYWxpc2VkUG9zaXRpb24AZ2V0UG9zaXRpb24Ac2V0UG9zaXRpb24AcGxheUF0UG9zaXRpb24AbWF4aVBpdGNoU2hpZnQAc2hhcmVkX3B0cjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPgBtYXhpU3RyZXRjaABzZXRMb29wU3RhcnQAc2V0TG9vcEVuZABnZXRMb29wRW5kAG1heGlCaXRzAHNpZwBhdABzaGwAc2hyAHIAbGFuZABsb3IAbHhvcgBuZWcAaW5jAGRlYwBlcQBub2lzZQB0b1NpZ25hbAB0b1RyaWdTaWduYWwAZnJvbVNpZ25hbABtYXhpQ291bnRlcgBjb3VudABtYXhpU2F0UmV2ZXJiAG1heGlGcmVlVmVyYgBtYXhpRkZUQWRhcHRvcgBwcm9jZXNzAHNwZWN0cmFsRmxhdG5lc3MAc3BlY3RyYWxDZW50cm9pZABnZXRNYWduaXR1ZGVzQXNKU0FycmF5AGdldE1hZ25pdHVkZXNEQkFzSlNBcnJheQBnZXRQaGFzZXNBc0pTQXJyYXkAZ2V0TnVtQmlucwBnZXRGRlRTaXplAGdldEhvcFNpemUAZ2V0V2luZG93U2l6ZQBtYXhpRkZUTW9kZXMAV0lUSF9QT0xBUl9DT05WRVJTSU9OAE5PX1BPTEFSX0NPTlZFUlNJT04AbWF4aUlGRlQAbWF4aUlGRlRNb2RlcwBTUEVDVFJVTQBDT01QTEVYAG1heGlNRkNDAG1mY2MAYWxsb2NhdG9yPFQ+OjphbGxvY2F0ZShzaXplX3QgbikgJ24nIGV4Y2VlZHMgbWF4aW11bSBzdXBwb3J0ZWQgc2l6ZQBOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0lmRUUALHcAAI0KAABwdXNoX2JhY2sAcmVzaXplAGdldABzZXQATlN0M19fMjZ2ZWN0b3JJaU5TXzlhbGxvY2F0b3JJaUVFRUUATlN0M19fMjEzX192ZWN0b3JfYmFzZUlpTlNfOWFsbG9jYXRvcklpRUVFRQBOU3QzX18yMjBfX3ZlY3Rvcl9iYXNlX2NvbW1vbklMYjFFRUUAAAAsdwAAHQsAALB3AADxCgAAAAAAAAEAAABECwAAAAAAALB3AADNCgAAAAAAAAEAAABMCwAAAAAAAFBOU3QzX18yNnZlY3RvcklpTlNfOWFsbG9jYXRvcklpRUVFRQAAAAAMeAAAfAsAAAAAAABkCwAAUEtOU3QzX18yNnZlY3RvcklpTlNfOWFsbG9jYXRvcklpRUVFRQAAAAx4AAC0CwAAAQAAAGQLAABpaQB2AHZpAKQLAAA0dgAApAsAAJR2AAB2aWlpAAAAAAAAAAA0dgAApAsAALh2AACUdgAAdmlpaWkAAAC4dgAA3AsAAGlpaQBUDAAAZAsAALh2AABOMTBlbXNjcmlwdGVuM3ZhbEUAACx3AABADAAAaWlpaQBB8BgL5gRMdgAAZAsAALh2AACUdgAAaWlpaWkATlN0M19fMjZ2ZWN0b3JJZE5TXzlhbGxvY2F0b3JJZEVFRUUATlN0M19fMjEzX192ZWN0b3JfYmFzZUlkTlNfOWFsbG9jYXRv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HgAA0HYAALh2AAB2aWlkaQAAADR2AABEHgAA8AwAANB2AABEHgAAuHYAAGRpaWkAAAAAuHYAAEQeAAAyN21heGlBc3luY0t1cmFtb3RvT3NjaWxsYXRvcgAAAFR3AADgHgAAHB4AAFAyN21heGlBc3luY0t1cmFtb3RvT3NjaWxsYXRvcgAADHgAAAwfAAAAAAAAAB8AAFBLMjdtYXhpQXN5bmNLdXJhbW90b09zY2lsbGF0b3IADHgAADwfAAABAAAAAB8AACwfAAC4dgBBgD8LlgzQdgAALB8AANB2AADQdgAANHYAACwfAADQdgAAuHYAADR2AAAsHwAA8AwAANB2AAAsHwAAuHYAALh2AAAsHwAAMTVtYXhpVGltZVN0cmV0Y2hJMTRoYW5uV2luRnVuY3RvckUALHcAAMAfAABQMTVtYXhpVGltZVN0cmV0Y2hJMTRoYW5uV2luRnVuY3RvckUAAAAADHgAAOwfAAAAAAAA5B8AAFBLMTVtYXhpVGltZVN0cmV0Y2hJMTRoYW5uV2luRnVuY3RvckUAAAAMeAAAJCAAAAEAAADkHwAAAAAAABQhAADqAQAA6wEAAOwBAADtAQAA7gEAAE5TdDNfXzIyMF9fc2hhcmVkX3B0cl9wb2ludGVySVAxNW1heGlUaW1lU3RyZXRjaEkxNGhhbm5XaW5GdW5jdG9yRU4xMGVtc2NyaXB0ZW4xNXNtYXJ0X3B0cl90cmFpdElOU18xMHNoYXJlZF9wdHJJUzNfRUVFMTF2YWxfZGVsZXRlckVOU185YWxsb2NhdG9ySVMzX0VFRUUAAFR3AAB4IAAAdHMAAE4xMGVtc2NyaXB0ZW4xNXNtYXJ0X3B0cl90cmFpdElOU3QzX18yMTBzaGFyZWRfcHRySTE1bWF4aVRpbWVTdHJldGNoSTE0aGFubldpbkZ1bmN0b3JFRUVFMTF2YWxfZGVsZXRlckUATlN0M19fMjEwc2hhcmVkX3B0ckkxNW1heGlUaW1lU3RyZXRjaEkxNGhhbm5XaW5GdW5jdG9yRUVFAAAALHcAAIghAABpAAAAxCEAAAAAAABIIgAA7wEAAPABAADxAQAA8gEAAPMBAABOU3QzX18yMjBfX3NoYXJlZF9wdHJfZW1wbGFjZUkxNW1heGlUaW1lU3RyZXRjaEkxNGhhbm5XaW5GdW5jdG9yRU5TXzlhbGxvY2F0b3JJUzNfRUVFRQAAVHcAAPAhAAB0cwAANHYAABQgAABkFgAA0HYAABQgAAA0dgAAFCAAANB2AAAAAAAAwCIAAPQBAAD1AQAA9gEAADltYXhpR3JhaW5JMTRoYW5uV2luRnVuY3RvckUAMTNtYXhpR3JhaW5CYXNlAAAAACx3AAClIgAAVHcAAIgiAAC4IgAAAAAAANB2AAAUIAAA0HYAANB2AACUdgAA0HYAAGRpaWRkaWQA0HYAABQgAADQdgAA0HYAAJR2AAAxNG1heGlQaXRjaFNoaWZ0STE0aGFubldpbkZ1bmN0b3JFAAAsdwAABCMAAFAxNG1heGlQaXRjaFNoaWZ0STE0aGFubldpbkZ1bmN0b3JFAAx4AAAwIwAAAAAAACgjAABQSzE0bWF4aVBpdGNoU2hpZnRJMTRoYW5uV2luRnVuY3RvckUAAAAADHgAAGQjAAABAAAAKCMAAAAAAABUJAAA9wEAAPgBAAD5AQAA+gEAAPsBAABOU3QzX18yMjBfX3NoYXJlZF9wdHJfcG9pbnRlcklQMTRtYXhpUGl0Y2hTaGlmdEkxNGhhbm5XaW5GdW5jdG9yRU4xMGVtc2NyaXB0ZW4xNXNtYXJ0X3B0cl90cmFpdElOU18xMHNoYXJlZF9wdHJJUzNfRUVFMTF2YWxfZGVsZXRlckVOU185YWxsb2NhdG9ySVMzX0VFRUUAAABUdwAAuCMAAHRzAABOMTBlbXNjcmlwdGVuMTVzbWFydF9wdHJfdHJhaXRJTlN0M19fMjEwc2hhcmVkX3B0ckkxNG1heGlQaXRjaFNoaWZ0STE0aGFubldpbkZ1bmN0b3JFRUVFMTF2YWxfZGVsZXRlckUATlN0M19fMjEwc2hhcmVkX3B0ckkxNG1heGlQaXRjaFNoaWZ0STE0aGFubldpbkZ1bmN0b3JFRUUALHcAAMckAAAAJQAAAAAAAIAlAAD8AQAA/QEAAP4BAADyAQAA/wEAAE5TdDNfXzIyMF9fc2hhcmVkX3B0cl9lbXBsYWNlSTE0bWF4aVBpdGNoU2hpZnRJMTRoYW5uV2luRnVuY3RvckVOU185YWxsb2NhdG9ySVMzX0VFRUUAAABUdwAAKCUAAHRzAAA0dgAAVCMAAGQWAEGgywAL0gHQdgAAVCMAANB2AADQdgAAlHYAANB2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dHNJd0VFRUUAALB3AAB8RgAAAAAAAAEAAAAgRQAAA/T//2iEAAAAAAAAIEcAACICAABNAgAATgIAACUCAAAmAgAAJwIAACgCAAAQAgAAEQIAAE8CAABQAgAAUQIAABUCAAArAgAATlN0M19fMjEwX19zdGRpbmJ1ZkljRUUAVHcAAAhHAABgRQAAdW5zdXBwb3J0ZWQgbG9jYWxlIGZvciBzdGFuZGFyZCBpbnB1dAAAAAAAAACsRwAALAIAAFICAABTAgAALwIAADACAAAxAgAAMgIAADMCAAA0AgAAVAIAAFUCAABWAgAAOAIAADkCAABOU3QzX18yMTBfX3N0ZGluYnVmSXdFRQBUdwAAlEcAAJxFAAAAAAAAFEgAACICAABXAgAAWAIAACUCAAAmAgAAJwIAAFkCAAAQAgAAEQIAACkCAAATAgAAKgIAAFoCAABbAgAATlN0M19fMjExX19zdGRvdXRidWZJY0VFAAAAAFR3AAD4RwAAYEUAAAAAAAB8SAAALAIAAFwCAABdAgAALwIAADACAAAxAgAAXgIAADMCAAA0AgAANQIAADYCAAA3AgAAXwIAAGACAABOU3QzX18yMTFfX3N0ZG91dGJ1Zkl3RUUAAAAAVHcAAGBIAACcRQBBkJEBC+ME/////////////////////////////////////////////////////////////////wABAgMEBQYHCAn/////////CgsMDQ4PEBESExQVFhcYGRobHB0eHyAhIiP///////8KCwwNDg8QERITFBUWFxgZGhscHR4fICEiI/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////8AAQIEBwMGBQAAAAAAAAACAADAAwAAwAQAAMAFAADABgAAwAcAAMAIAADACQAAwAoAAMALAADADAAAwA0AAMAOAADADwAAwBAAAMARAADAEgAAwBMAAMAUAADAFQAAwBYAAMAXAADAGAAAwBkAAMAaAADAGwAAwBwAAMAdAADAHgAAwB8AAMAAAACzAQAAwwIAAMMDAADD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AABUdwAAdHcAAAR1AAAAAAAA+HcAAGIDAAByAwAAZAMAAGUDAABqAwAAcwMAAHQDAAB1AwAATjEwX19jeHhhYml2MTIxX192bWlfY2xhc3NfdHlwZV9pbmZvRQAAAFR3AADQdwAABHUAAAAAAABkdQAAYgMAAHYDAABkAwAAZQMAAHcDAAB2b2lkAGJvb2wAY2hhcgBzaWduZWQgY2hhcgB1bnNpZ25lZCBjaGFyAHNob3J0AHVuc2lnbmVkIHNob3J0AGludAB1bnNpZ25lZCBpbnQAbG9uZwB1bnNpZ25lZCBsb25nAGZsb2F0AGRvdWJsZQBzdGQ6OnN0cmluZwBzdGQ6OmJhc2ljX3N0cmluZzx1bnNpZ25lZCBjaGFyPgBzdGQ6OndzdHJpbmcAc3RkOjp1MTZzdHJpbmcAc3RkOjp1MzJzdHJpbmcAZW1zY3JpcHRlbjo6dmFsAGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PGNoYXI+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHNpZ25lZCBjaGFyPgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzx1bnNpZ25lZCBjaGFyPgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxzaG9ydD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8dW5zaWduZWQgc2hvcnQ+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PGludD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8dW5zaWduZWQgaW50PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxsb25nPgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzx1bnNpZ25lZCBsb25nPgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxpbnQ4X3Q+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHVpbnQ4X3Q+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PGludDE2X3Q+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHVpbnQxNl90PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxpbnQzMl90PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzx1aW50MzJfdD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8ZmxvYXQ+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PGRvdWJsZT4ATlN0M19fMjEyYmFzaWNfc3RyaW5nSWhOU18xMWNoYXJfdHJhaXRzSWhFRU5TXzlhbGxvY2F0b3JJaEVFRUUAAAAAsHcAADZ7AAAAAAAAAQAAANgXAAAAAAAATlN0M19fMjEyYmFzaWNfc3RyaW5nSXdOU18xMWNoYXJfdHJhaXRzSXdFRU5TXzlhbGxvY2F0b3JJd0VFRUUAALB3AACQewAAAAAAAAEAAADYFwAAAAAAAE5TdDNfXzIxMmJhc2ljX3N0cmluZ0lEc05TXzExY2hhcl90cmFpdHNJRHNFRU5TXzlhbGxvY2F0b3JJRHNFRUVFAAAAsHcAAOh7AAAAAAAAAQAAANgXAAAAAAAATlN0M19fMjEyYmFzaWNfc3RyaW5nSURpTlNfMTFjaGFyX3RyYWl0c0lEaUVFTlNfOWFsbG9jYXRvcklEaUVFRUUAAACwdwAARHwAAAAAAAABAAAA2BcAAAAAAABOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0ljRUUAACx3AACgfAAATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJYUVFAAAsdwAAyHwAAE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SWhFRQAALHcAAPB8AABOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0lzRUUAACx3AAAYfQAATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJdEVFAAAsdwAAQH0AAE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SWlFRQAALHcAAGh9AABOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0lqRUUAACx3AACQfQAATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJbEVFAAAsdwAAuH0AAE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SW1FRQAALHcAAOB9AABOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0lkRUUAACx3AAAIfgBBsvwBCwyAP0SsAAACAAAAAAQAQcj8AQuRCG+3JAfsUiFA1jbF46JaIkAIdvwXCHIjQJqZmZmZmSRA2nHD76bTJUBHcvkP6R8nQAAAAAAAgChAHEC/79/0KUAAAAAAAIArQKlOB7KeIi1AAIv8+iHeLkBqTl5kAlowQG+3JAfsUjFA1jbF46JaMkAIdvwXCHIzQEJAvoQKmjRAOnr83qbTNUDoacAg6R83QAAAAAAAgDhAvTeGAOD0OUAAAAAAAIA7QEpGzsKeIj1AAIv8+iHePkCa0vpbAlpAQJ87wf7rUkFA1jbF46JaQkDY8V8gCHJDQHLEWnwKmkRAOnr83qbTRUDoacAg6R9HQAAAAAAAgEhAvTeGAOD0SUAAAAAAAIBLQEpGzsKeIk1A0QZgAyLeTkCCkCxgAlpQQJ87wf7rUlFA7niT36JaUkDY8V8gCHJTQFqCjIAKmlRAOnr83qbTVUDoacAg6R9XQHVat0Htf1hAvTeGAOD0WUAAAAAAAIBbQGGInL6eIl1A6Ugu/yHeXkCCkCxgAlpgQJMa2gDsUmFA7niT36JaYkDY8V8gCHJjQFqCjIAKmmRAOnr83qbTZUDoacAg6R9nQIF7nj/tf2hAvTeGAOD0aUAAAAAAAIBrQFVntcCeIm1A6Ugu/yHebkCCkCxgAlpwQBmrzf/rUnFA7niT36JackDY8V8gCHJzQOASgH8KmnRAtOkI4KbTdUBu+rMf6R93QIF7nj/tf3hAvTeGAOD0eUAAAAAAAIB7QNv3qL+eIn1AY7g6ACLefkCCkCxgAlqAQBmrzf/rUoFAq7AZ4KJagkAbutkfCHKDQJ1KBoAKmoRAtOkI4KbThUArMjog6R+HQD6zJEDtf4hAAAAAAOD0iUAAAAAAAICLQJgvL8CeIo1AY7g6ACLejkCjdOlfAlqQQPjGEADsUpFAq7AZ4KJakkD61RwgCHKTQJ1KBoAKmpRAtOkI4KbTlUBMFvcf6R+XQF+X4T/tf5hAAAAAAOD0mUAAAAAAAICbQLoT7L+eIp1AhJz3/yHenkCTAgtgAlqgQPjGEADsUqFAvCL436JaokAKSPsfCHKjQJ1KBoAKmqRAtOkI4KbTpUBMFvcf6R+nQE4lA0Dtf6hAAAAAAOD0qUAAAAAAAICrQIXrUbieIq1AhJz3/yHerkCbO/pfAlqwQAAAAADsUrFAvCL436JaskAKSPsfCHKzQJ1KBoAKmrRAvCL436bTtUBE3Qcg6R+3QE4lA0Dtf7hAAAAAAOD0uUAAAAAAAIC7QLLa/L+eIr1AhJz3/yHevkAXnwJgAlrAQAAAAADsUsFAOIYA4KJawkCGqwMgCHLDQCHn/X8KmsRAOIYA4KbTxUDIef8f6R/HQE4lA0Dtf8hAAAAAAOD0yUBPZ2dTdm9yYmlzAAAAAAAABQBB5IQCCwIZAgBB/IQCCwoaAgAAGwIAACCJAEGUhQILAQIAQaOFAgsF//////8AQZiHAgsCTIkAQdCHAgsBBQBB3IcCCwIfAgBB9IcCCw4aAgAAIAIAAHiJAAAABABBjIgCCwEBAEGbiAILBQr/////AEHgiAILCdCDAAAAAAAACQBB9IgCCwIZAgBBiIkCCxIhAgAAAAAAABsCAACIjQAAAAQAQbSJAgsE/////wCajwgEbmFtZQGRjwiICgAWX2VtYmluZF9yZWdpc3Rlcl9jbGFzcwEiX2VtYmluZF9yZWdpc3Rlcl9jbGFzc19jb25zdHJ1Y3RvcgIlX2VtYmluZF9yZWdpc3Rlcl9jbGFzc19jbGFzc19mdW5jdGlvbgMfX2VtYmluZF9yZWdpc3Rlcl9jbGFzc19mdW5jdGlvbgQfX2VtYmluZF9yZWdpc3Rlcl9jbGFzc19wcm9wZXJ0eQUaX2VtYmluZF9yZWdpc3Rlcl9zbWFydF9wdHIGFV9lbWJpbmRfcmVnaXN0ZXJfZW51bQcbX2VtYmluZF9yZWdpc3Rlcl9lbnVtX3ZhbHVlCBFfZW12YWxfdGFrZV92YWx1ZQkYX19jeGFfYWxsb2NhdGVfZXhjZXB0aW9uCgtfX2N4YV90aHJvdwsNX2VtdmFsX2luY3JlZgwNX2VtdmFsX2RlY3JlZg0LX2VtdmFsX2NhbGwOBXJvdW5kDwRleGl0EA1fX2Fzc2VydF9mYWlsEQZfX2xvY2sSCF9fdW5sb2NrEw9fX3dhc2lfZmRfY2xvc2UUCl9fc3lzY2FsbDUVDF9fc3lzY2FsbDIyMRYLX19zeXNjYWxsNTQXDl9fd2FzaV9mZF9yZWFkGA9fX3dhc2lfZmRfd3JpdGUZGF9fd2FzaV9lbnZpcm9uX3NpemVzX2dldBoSX193YXNpX2Vudmlyb25fZ2V0GwpfX21hcF9maWxlHAtfX3N5c2NhbGw5MR0Kc3RyZnRpbWVfbB4FYWJvcnQfFV9lbWJpbmRfcmVnaXN0ZXJfdm9pZCAVX2VtYmluZF9yZWdpc3Rlcl9ib29sIRtfZW1iaW5kX3JlZ2lzdGVyX3N0ZF9zdHJpbmciHF9lbWJpbmRfcmVnaXN0ZXJfc3RkX3dzdHJpbmcjFl9lbWJpbmRfcmVnaXN0ZXJfZW12YWwkGF9lbWJpbmRfcmVnaXN0ZXJfaW50ZWdlciUWX2VtYmluZF9yZWdpc3Rlcl9mbG9hdCYcX2VtYmluZF9yZWdpc3Rlcl9tZW1vcnlfdmlldycWZW1zY3JpcHRlbl9yZXNpemVfaGVhcCgVZW1zY3JpcHRlbl9tZW1jcHlfYmlnKQtzZXRUZW1wUmV0MCoabGVnYWxpbXBvcnQkX193YXNpX2ZkX3NlZWsrEV9fd2FzbV9jYWxsX2N0b3JzLFBFbXNjcmlwdGVuQmluZGluZ0luaXRpYWxpemVyX215X21vZHVsZTo6RW1zY3JpcHRlbkJpbmRpbmdJbml0aWFsaXplcl9teV9tb2R1bGUoKS2VAWVtc2NyaXB0ZW46OmNsYXNzXzxzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4sIGVtc2NyaXB0ZW46OmludGVybmFsOjpOb0Jhc2VDbGFzcz4gZW1zY3JpcHRlbjo6cmVnaXN0ZXJfdmVjdG9yPGludD4oY2hhciBjb25zdCopLp4BZW1zY3JpcHRlbjo6Y2xhc3NfPHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiwgZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok5vQmFzZUNsYXNzPiBlbXNjcmlwdGVuOjpyZWdpc3Rlcl92ZWN0b3I8ZG91YmxlPihjaGFyIGNvbnN0KikvmAFlbXNjcmlwdGVuOjpjbGFzc188c3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4sIGVtc2NyaXB0ZW46OmludGVybmFsOjpOb0Jhc2VDbGFzcz4gZW1zY3JpcHRlbjo6cmVnaXN0ZXJfdmVjdG9yPGNoYXI+KGNoYXIgY29uc3QqKTCzAWVtc2NyaXB0ZW46OmNsYXNzXzxzdGQ6Ol9fMjo6dmVjdG9yPHVuc2lnbmVkIGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8dW5zaWduZWQgY2hhcj4gPiwgZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok5vQmFzZUNsYXNzPiBlbXNjcmlwdGVuOjpyZWdpc3Rlcl92ZWN0b3I8dW5zaWduZWQgY2hhcj4oY2hhciBjb25zdCopMZsBZW1zY3JpcHRlbjo6Y2xhc3NfPHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4sIGVtc2NyaXB0ZW46OmludGVybmFsOjpOb0Jhc2VDbGFzcz4gZW1zY3JpcHRlbjo6cmVnaXN0ZXJfdmVjdG9yPGZsb2F0PihjaGFyIGNvbnN0KikySnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPHZlY3RvclRvb2xzPih2ZWN0b3JUb29scyopM0R2b2lkIGVtc2NyaXB0ZW46OmludGVybmFsOjpyYXdfZGVzdHJ1Y3Rvcjx2ZWN0b3JUb29scz4odmVjdG9yVG9vbHMqKTRHZW1zY3JpcHRlbjo6aW50ZXJuYWw6Okludm9rZXI8dmVjdG9yVG9vbHMqPjo6aW52b2tlKHZlY3RvclRvb2xzKiAoKikoKSk1PnZlY3RvclRvb2xzKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PHZlY3RvclRvb2xzPigpNuABZW1zY3JpcHRlbjo6aW50ZXJuYWw6Okludm9rZXI8dm9pZCwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+Jj46Omludm9rZSh2b2lkICgqKShzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mKSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+Kik3VHZlY3RvclRvb2xzOjpjbGVhclZlY3RvckRibChzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mKThMdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aVNldHRpbmdzPihtYXhpU2V0dGluZ3MqKTliZW1zY3JpcHRlbjo6aW50ZXJuYWw6Okludm9rZXI8dm9pZCwgaW50LCBpbnQsIGludD46Omludm9rZSh2b2lkICgqKShpbnQsIGludCwgaW50KSwgaW50LCBpbnQsIGludCk6Im1heGlTZXR0aW5nczo6c2V0dXAoaW50LCBpbnQsIGludCk7THZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlFbnZlbG9wZT4obWF4aUVudmVsb3BlKik8QG1heGlFbnZlbG9wZSogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpRW52ZWxvcGU+KCk9hANlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlFbnZlbG9wZTo6KikoaW50LCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mKSwgZG91YmxlLCBtYXhpRW52ZWxvcGUqLCBpbnQsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiY+OjppbnZva2UoZG91YmxlIChtYXhpRW52ZWxvcGU6OiogY29uc3QmKShpbnQsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYpLCBtYXhpRW52ZWxvcGUqLCBpbnQsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiopProBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAobWF4aUVudmVsb3BlOjoqKShpbnQsIGRvdWJsZSksIHZvaWQsIG1heGlFbnZlbG9wZSosIGludCwgZG91YmxlPjo6aW52b2tlKHZvaWQgKG1heGlFbnZlbG9wZTo6KiBjb25zdCYpKGludCwgZG91YmxlKSwgbWF4aUVudmVsb3BlKiwgaW50LCBkb3VibGUpPyJtYXhpRW52ZWxvcGU6OmdldEFtcGxpdHVkZSgpIGNvbnN0QCJtYXhpRW52ZWxvcGU6OnNldEFtcGxpdHVkZShkb3VibGUpQZwBZG91YmxlIGVtc2NyaXB0ZW46OmludGVybmFsOjpHZXR0ZXJQb2xpY3k8ZG91YmxlIChtYXhpRW52ZWxvcGU6OiopKCkgY29uc3Q+OjpnZXQ8bWF4aUVudmVsb3BlPihkb3VibGUgKG1heGlFbnZlbG9wZTo6KiBjb25zdCYpKCkgY29uc3QsIG1heGlFbnZlbG9wZSBjb25zdCYpQpgBdm9pZCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6U2V0dGVyUG9saWN5PHZvaWQgKG1heGlFbnZlbG9wZTo6KikoZG91YmxlKT46OnNldDxtYXhpRW52ZWxvcGU+KHZvaWQgKG1heGlFbnZlbG9wZTo6KiBjb25zdCYpKGRvdWJsZSksIG1heGlFbnZlbG9wZSYsIGRvdWJsZSlDIW1heGlFbnZlbG9wZTo6Z2V0VmFsaW5kZXgoKSBjb25zdEQebWF4aUVudmVsb3BlOjpzZXRWYWxpbmRleChpbnQpRZMBaW50IGVtc2NyaXB0ZW46OmludGVybmFsOjpHZXR0ZXJQb2xpY3k8aW50IChtYXhpRW52ZWxvcGU6OiopKCkgY29uc3Q+OjpnZXQ8bWF4aUVudmVsb3BlPihpbnQgKG1heGlFbnZlbG9wZTo6KiBjb25zdCYpKCkgY29uc3QsIG1heGlFbnZlbG9wZSBjb25zdCYpRo8Bdm9pZCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6U2V0dGVyUG9saWN5PHZvaWQgKG1heGlFbnZlbG9wZTo6KikoaW50KT46OnNldDxtYXhpRW52ZWxvcGU+KHZvaWQgKG1heGlFbnZlbG9wZTo6KiBjb25zdCYpKGludCksIG1heGlFbnZlbG9wZSYsIGludClHTnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlEZWxheWxpbmU+KG1heGlEZWxheWxpbmUqKUhCbWF4aURlbGF5bGluZSogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpRGVsYXlsaW5lPigpSeQBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpRGVsYXlsaW5lOjoqKShkb3VibGUsIGludCwgZG91YmxlKSwgZG91YmxlLCBtYXhpRGVsYXlsaW5lKiwgZG91YmxlLCBpbnQsIGRvdWJsZT46Omludm9rZShkb3VibGUgKG1heGlEZWxheWxpbmU6OiogY29uc3QmKShkb3VibGUsIGludCwgZG91YmxlKSwgbWF4aURlbGF5bGluZSosIGRvdWJsZSwgaW50LCBkb3VibGUpSvgBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpRGVsYXlsaW5lOjoqKShkb3VibGUsIGludCwgZG91YmxlLCBpbnQpLCBkb3VibGUsIG1heGlEZWxheWxpbmUqLCBkb3VibGUsIGludCwgZG91YmxlLCBpbnQ+OjppbnZva2UoZG91YmxlIChtYXhpRGVsYXlsaW5lOjoqIGNvbnN0JikoZG91YmxlLCBpbnQsIGRvdWJsZSwgaW50KSwgbWF4aURlbGF5bGluZSosIGRvdWJsZSwgaW50LCBkb3VibGUsIGludClLQnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlNaXg+KG1heGlNaXgqKUw2bWF4aU1peCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpTWl4PigpTZYDZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAobWF4aU1peDo6KikoZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBkb3VibGUpLCB2b2lkLCBtYXhpTWl4KiwgZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBkb3VibGU+OjppbnZva2Uodm9pZCAobWF4aU1peDo6KiBjb25zdCYpKGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgZG91YmxlKSwgbWF4aU1peCosIGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KiwgZG91YmxlKU62A2Vtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKG1heGlNaXg6OiopKGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgZG91YmxlLCBkb3VibGUpLCB2b2lkLCBtYXhpTWl4KiwgZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBkb3VibGUsIGRvdWJsZT46Omludm9rZSh2b2lkIChtYXhpTWl4OjoqIGNvbnN0JikoZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBkb3VibGUsIGRvdWJsZSksIG1heGlNaXgqLCBkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiosIGRvdWJsZSwgZG91YmxlKU/WA2Vtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKG1heGlNaXg6OiopKGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSksIHZvaWQsIG1heGlNaXgqLCBkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGRvdWJsZSwgZG91YmxlLCBkb3VibGU+OjppbnZva2Uodm9pZCAobWF4aU1peDo6KiBjb25zdCYpKGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSksIG1heGlNaXgqLCBkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUpUER2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpTGluZT4obWF4aUxpbmUqKVE4bWF4aUxpbmUqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aUxpbmU+KClSFm1heGlMaW5lOjpwbGF5KGRvdWJsZSlTnAFlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlMaW5lOjoqKShkb3VibGUpLCBkb3VibGUsIG1heGlMaW5lKiwgZG91YmxlPjo6aW52b2tlKGRvdWJsZSAobWF4aUxpbmU6OiogY29uc3QmKShkb3VibGUpLCBtYXhpTGluZSosIGRvdWJsZSlUL21heGlMaW5lOjpwcmVwYXJlKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGJvb2wpVe4BZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAobWF4aUxpbmU6OiopKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGJvb2wpLCB2b2lkLCBtYXhpTGluZSosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGJvb2w+OjppbnZva2Uodm9pZCAobWF4aUxpbmU6OiogY29uc3QmKShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBib29sKSwgbWF4aUxpbmUqLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBib29sKVYfbWF4aUxpbmU6OnRyaWdnZXJFbmFibGUoZG91YmxlKVcabWF4aUxpbmU6OmlzTGluZUNvbXBsZXRlKClYRnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlYRmFkZT4obWF4aVhGYWRlKilZhwRlbXNjcmlwdGVuOjppbnRlcm5hbDo6SW52b2tlcjxzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4sIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGRvdWJsZT46Omludm9rZShzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4gKCopKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGRvdWJsZSksIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiosIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiosIGRvdWJsZSlaigFtYXhpWEZhZGU6OnhmYWRlKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGRvdWJsZSlbgQFlbXNjcmlwdGVuOjppbnRlcm5hbDo6SW52b2tlcjxkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGU+OjppbnZva2UoZG91YmxlICgqKShkb3VibGUsIGRvdWJsZSwgZG91YmxlKSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSlcKG1heGlYRmFkZTo6eGZhZGUoZG91YmxlLCBkb3VibGUsIGRvdWJsZSldWXZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlMYWdFeHA8ZG91YmxlPiA+KG1heGlMYWdFeHA8ZG91YmxlPiopXk1tYXhpTGFnRXhwPGRvdWJsZT4qIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aUxhZ0V4cDxkb3VibGU+ID4oKV8obWF4aUxhZ0V4cDxkb3VibGU+Ojppbml0KGRvdWJsZSwgZG91YmxlKWDeAWVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKG1heGlMYWdFeHA8ZG91YmxlPjo6KikoZG91YmxlLCBkb3VibGUpLCB2b2lkLCBtYXhpTGFnRXhwPGRvdWJsZT4qLCBkb3VibGUsIGRvdWJsZT46Omludm9rZSh2b2lkIChtYXhpTGFnRXhwPGRvdWJsZT46OiogY29uc3QmKShkb3VibGUsIGRvdWJsZSksIG1heGlMYWdFeHA8ZG91YmxlPiosIGRvdWJsZSwgZG91YmxlKWElbWF4aUxhZ0V4cDxkb3VibGU+OjphZGRTYW1wbGUoZG91YmxlKWIhbWF4aUxhZ0V4cDxkb3VibGU+Ojp2YWx1ZSgpIGNvbnN0YyRtYXhpTGFnRXhwPGRvdWJsZT46OmdldEFscGhhKCkgY29uc3RkJG1heGlMYWdFeHA8ZG91YmxlPjo6c2V0QWxwaGEoZG91YmxlKWUubWF4aUxhZ0V4cDxkb3VibGU+OjpnZXRBbHBoYVJlY2lwcm9jYWwoKSBjb25zdGYubWF4aUxhZ0V4cDxkb3VibGU+OjpzZXRBbHBoYVJlY2lwcm9jYWwoZG91YmxlKWcibWF4aUxhZ0V4cDxkb3VibGU+OjpzZXRWYWwoZG91YmxlKWhIdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aVNhbXBsZT4obWF4aVNhbXBsZSopaUJ2b2lkIGVtc2NyaXB0ZW46OmludGVybmFsOjpyYXdfZGVzdHJ1Y3RvcjxtYXhpU2FtcGxlPihtYXhpU2FtcGxlKilqPG1heGlTYW1wbGUqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aVNhbXBsZT4oKWsdbWF4aVNhbXBsZTo6Z2V0TGVuZ3RoKCkgY29uc3RsTm1heGlTYW1wbGU6OnNldFNhbXBsZShzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mKW1TbWF4aVNhbXBsZTo6c2V0U2FtcGxlKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGludClu9gJlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChtYXhpU2FtcGxlOjoqKShzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBpbnQpLCB2b2lkLCBtYXhpU2FtcGxlKiwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgaW50Pjo6aW52b2tlKHZvaWQgKG1heGlTYW1wbGU6OiogY29uc3QmKShzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBpbnQpLCBtYXhpU2FtcGxlKiwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KiwgaW50KW+rA2Vtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGludCAobWF4aVNhbXBsZTo6Kikoc3RkOjpfXzI6OnZlY3Rvcjx1bnNpZ25lZCBjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHVuc2lnbmVkIGNoYXI+ID4mLCBpbnQpLCBpbnQsIG1heGlTYW1wbGUqLCBzdGQ6Ol9fMjo6dmVjdG9yPHVuc2lnbmVkIGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8dW5zaWduZWQgY2hhcj4gPiYsIGludD46Omludm9rZShpbnQgKG1heGlTYW1wbGU6OiogY29uc3QmKShzdGQ6Ol9fMjo6dmVjdG9yPHVuc2lnbmVkIGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8dW5zaWduZWQgY2hhcj4gPiYsIGludCksIG1heGlTYW1wbGUqLCBzdGQ6Ol9fMjo6dmVjdG9yPHVuc2lnbmVkIGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8dW5zaWduZWQgY2hhcj4gPiosIGludClwxAFlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlTYW1wbGU6OiopKGRvdWJsZSwgZG91YmxlKSwgZG91YmxlLCBtYXhpU2FtcGxlKiwgZG91YmxlLCBkb3VibGU+OjppbnZva2UoZG91YmxlIChtYXhpU2FtcGxlOjoqIGNvbnN0JikoZG91YmxlLCBkb3VibGUpLCBtYXhpU2FtcGxlKiwgZG91YmxlLCBkb3VibGUpceQBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpU2FtcGxlOjoqKShkb3VibGUsIGRvdWJsZSwgZG91YmxlKSwgZG91YmxlLCBtYXhpU2FtcGxlKiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZT46Omludm9rZShkb3VibGUgKG1heGlTYW1wbGU6OiogY29uc3QmKShkb3VibGUsIGRvdWJsZSwgZG91YmxlKSwgbWF4aVNhbXBsZSosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUpcoIBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAobWF4aVNhbXBsZTo6KikoKSwgdm9pZCwgbWF4aVNhbXBsZSo+OjppbnZva2Uodm9pZCAobWF4aVNhbXBsZTo6KiBjb25zdCYpKCksIG1heGlTYW1wbGUqKXMTbWF4aVNhbXBsZTo6Y2xlYXIoKXTmAWVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKG1heGlTYW1wbGU6OiopKGZsb2F0LCBmbG9hdCwgYm9vbCwgYm9vbCksIHZvaWQsIG1heGlTYW1wbGUqLCBmbG9hdCwgZmxvYXQsIGJvb2wsIGJvb2w+OjppbnZva2Uodm9pZCAobWF4aVNhbXBsZTo6KiBjb25zdCYpKGZsb2F0LCBmbG9hdCwgYm9vbCwgYm9vbCksIG1heGlTYW1wbGUqLCBmbG9hdCwgZmxvYXQsIGJvb2wsIGJvb2wpdaMEZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8Ym9vbCAobWF4aVNhbXBsZTo6Kikoc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiwgaW50KSwgYm9vbCwgbWF4aVNhbXBsZSosIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4sIGludD46Omludm9rZShib29sIChtYXhpU2FtcGxlOjoqIGNvbnN0Jikoc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiwgaW50KSwgbWF4aVNhbXBsZSosIGVtc2NyaXB0ZW46OmludGVybmFsOjpCaW5kaW5nVHlwZTxzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+LCB2b2lkPjo6J3VubmFtZWQnKiwgaW50KXZCdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aUR5bj4obWF4aUR5biopdzZtYXhpRHluKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlEeW4+KCl4kAJlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlEeW46OiopKGRvdWJsZSwgZG91YmxlLCBsb25nLCBkb3VibGUsIGRvdWJsZSksIGRvdWJsZSwgbWF4aUR5biosIGRvdWJsZSwgZG91YmxlLCBsb25nLCBkb3VibGUsIGRvdWJsZT46Omludm9rZShkb3VibGUgKG1heGlEeW46OiogY29uc3QmKShkb3VibGUsIGRvdWJsZSwgbG9uZywgZG91YmxlLCBkb3VibGUpLCBtYXhpRHluKiwgZG91YmxlLCBkb3VibGUsIGxvbmcsIGRvdWJsZSwgZG91YmxlKXmYAmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aUR5bjo6KikoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUpLCBkb3VibGUsIG1heGlEeW4qLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZT46Omludm9rZShkb3VibGUgKG1heGlEeW46OiogY29uc3QmKShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSksIG1heGlEeW4qLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSl6QnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlFbnY+KG1heGlFbnYqKXs2bWF4aUVudiogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpRW52PigpfIQCZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpRW52OjoqKShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBsb25nLCBpbnQpLCBkb3VibGUsIG1heGlFbnYqLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBsb25nLCBpbnQ+OjppbnZva2UoZG91YmxlIChtYXhpRW52OjoqIGNvbnN0JikoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgbG9uZywgaW50KSwgbWF4aUVudiosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGxvbmcsIGludCl9xAJlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlFbnY6OiopKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBsb25nLCBpbnQpLCBkb3VibGUsIG1heGlFbnYqLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgbG9uZywgaW50Pjo6aW52b2tlKGRvdWJsZSAobWF4aUVudjo6KiBjb25zdCYpKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBsb25nLCBpbnQpLCBtYXhpRW52KiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGxvbmcsIGludCl+rAFlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlFbnY6OiopKGRvdWJsZSwgaW50KSwgZG91YmxlLCBtYXhpRW52KiwgZG91YmxlLCBpbnQ+OjppbnZva2UoZG91YmxlIChtYXhpRW52OjoqIGNvbnN0JikoZG91YmxlLCBpbnQpLCBtYXhpRW52KiwgZG91YmxlLCBpbnQpfxttYXhpRW52OjpnZXRUcmlnZ2VyKCkgY29uc3SAARhtYXhpRW52OjpzZXRUcmlnZ2VyKGludCmBAUJ2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxjb252ZXJ0Pihjb252ZXJ0KimCAWJlbXNjcmlwdGVuOjppbnRlcm5hbDo6RnVuY3Rpb25JbnZva2VyPGRvdWJsZSAoKikoaW50KSwgZG91YmxlLCBpbnQ+OjppbnZva2UoZG91YmxlICgqKikoaW50KSwgaW50KYMBSGVtc2NyaXB0ZW46OmludGVybmFsOjpJbnZva2VyPGRvdWJsZSwgaW50Pjo6aW52b2tlKGRvdWJsZSAoKikoaW50KSwgaW50KYQBGmNvbnZlcnQ6Om1zVG9TYW1wcyhkb3VibGUphQFuZW1zY3JpcHRlbjo6aW50ZXJuYWw6OkZ1bmN0aW9uSW52b2tlcjxkb3VibGUgKCopKGRvdWJsZSksIGRvdWJsZSwgZG91YmxlPjo6aW52b2tlKGRvdWJsZSAoKiopKGRvdWJsZSksIGRvdWJsZSmGAVFlbXNjcmlwdGVuOjppbnRlcm5hbDo6SW52b2tlcjxkb3VibGUsIGRvdWJsZT46Omludm9rZShkb3VibGUgKCopKGRvdWJsZSksIGRvdWJsZSmHAVZ2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpU2FtcGxlQW5kSG9sZD4obWF4aVNhbXBsZUFuZEhvbGQqKYgBSm1heGlTYW1wbGVBbmRIb2xkKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlTYW1wbGVBbmRIb2xkPigpiQEmbWF4aVNhbXBsZUFuZEhvbGQ6OnNhaChkb3VibGUsIGRvdWJsZSmKAUp2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpRmxhbmdlcj4obWF4aUZsYW5nZXIqKYsBPm1heGlGbGFuZ2VyKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlGbGFuZ2VyPigpjAFBbWF4aUZsYW5nZXI6OmZsYW5nZShkb3VibGUsIHVuc2lnbmVkIGludCwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSmNAcACZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpRmxhbmdlcjo6KikoZG91YmxlLCB1bnNpZ25lZCBpbnQsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUpLCBkb3VibGUsIG1heGlGbGFuZ2VyKiwgZG91YmxlLCB1bnNpZ25lZCBpbnQsIGRvdWJsZSwgZG91YmxlLCBkb3VibGU+OjppbnZva2UoZG91YmxlIChtYXhpRmxhbmdlcjo6KiBjb25zdCYpKGRvdWJsZSwgdW5zaWduZWQgaW50LCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKSwgbWF4aUZsYW5nZXIqLCBkb3VibGUsIHVuc2lnbmVkIGludCwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSmOAUh2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpQ2hvcnVzPihtYXhpQ2hvcnVzKimPATxtYXhpQ2hvcnVzKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlDaG9ydXM+KCmQAUBtYXhpQ2hvcnVzOjpjaG9ydXMoZG91YmxlLCB1bnNpZ25lZCBpbnQsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUpkQFOdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aURDQmxvY2tlcj4obWF4aURDQmxvY2tlciopkgFCbWF4aURDQmxvY2tlciogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpRENCbG9ja2VyPigpkwEjbWF4aURDQmxvY2tlcjo6cGxheShkb3VibGUsIGRvdWJsZSmUAUJ2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpU1ZGPihtYXhpU1ZGKimVATZtYXhpU1ZGKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlTVkY+KCmWARptYXhpU1ZGOjpzZXRDdXRvZmYoZG91YmxlKZcBHW1heGlTVkY6OnNldFJlc29uYW5jZShkb3VibGUpmAE1bWF4aVNWRjo6cGxheShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSmZAUR2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpTWF0aD4obWF4aU1hdGgqKZoBaWVtc2NyaXB0ZW46OmludGVybmFsOjpJbnZva2VyPGRvdWJsZSwgZG91YmxlLCBkb3VibGU+OjppbnZva2UoZG91YmxlICgqKShkb3VibGUsIGRvdWJsZSksIGRvdWJsZSwgZG91YmxlKZsBHW1heGlNYXRoOjphZGQoZG91YmxlLCBkb3VibGUpnAEdbWF4aU1hdGg6OnN1Yihkb3VibGUsIGRvdWJsZSmdAR1tYXhpTWF0aDo6bXVsKGRvdWJsZSwgZG91YmxlKZ4BHW1heGlNYXRoOjpkaXYoZG91YmxlLCBkb3VibGUpnwEcbWF4aU1hdGg6Omd0KGRvdWJsZSwgZG91YmxlKaABHG1heGlNYXRoOjpsdChkb3VibGUsIGRvdWJsZSmhAR1tYXhpTWF0aDo6Z3RlKGRvdWJsZSwgZG91YmxlKaIBHW1heGlNYXRoOjpsdGUoZG91YmxlLCBkb3VibGUpowEdbWF4aU1hdGg6Om1vZChkb3VibGUsIGRvdWJsZSmkARVtYXhpTWF0aDo6YWJzKGRvdWJsZSmlAR9tYXhpTWF0aDo6eHBvd3koZG91YmxlLCBkb3VibGUppgFGdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aUNsb2NrPihtYXhpQ2xvY2sqKacBOm1heGlDbG9jayogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpQ2xvY2s+KCmoARltYXhpQ2xvY2s6OmlzVGljaygpIGNvbnN0qQEibWF4aUNsb2NrOjpnZXRDdXJyZW50Q291bnQoKSBjb25zdKoBH21heGlDbG9jazo6c2V0Q3VycmVudENvdW50KGludCmrAR9tYXhpQ2xvY2s6OmdldExhc3RDb3VudCgpIGNvbnN0rAEcbWF4aUNsb2NrOjpzZXRMYXN0Q291bnQoaW50Ka0BGW1heGlDbG9jazo6Z2V0QnBzKCkgY29uc3SuARZtYXhpQ2xvY2s6OnNldEJwcyhpbnQprwEZbWF4aUNsb2NrOjpnZXRCcG0oKSBjb25zdLABFm1heGlDbG9jazo6c2V0QnBtKGludCmxARdtYXhpQ2xvY2s6OnNldFRpY2soaW50KbIBG21heGlDbG9jazo6Z2V0VGlja3MoKSBjb25zdLMBGG1heGlDbG9jazo6c2V0VGlja3MoaW50KbQBYHZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlLdXJhbW90b09zY2lsbGF0b3I+KG1heGlLdXJhbW90b09zY2lsbGF0b3IqKbUBVG1heGlLdXJhbW90b09zY2lsbGF0b3IqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aUt1cmFtb3RvT3NjaWxsYXRvcj4oKbYBZG1heGlLdXJhbW90b09zY2lsbGF0b3I6OnBsYXkoZG91YmxlLCBkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPim3AdYDZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yOjoqKShkb3VibGUsIGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KSwgZG91YmxlLCBtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yKiwgZG91YmxlLCBkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiA+OjppbnZva2UoZG91YmxlIChtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yOjoqIGNvbnN0JikoZG91YmxlLCBkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiksIG1heGlLdXJhbW90b09zY2lsbGF0b3IqLCBkb3VibGUsIGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+Kim4AWZ2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0PihtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0Kim5AWB2b2lkIGVtc2NyaXB0ZW46OmludGVybmFsOjpyYXdfZGVzdHJ1Y3RvcjxtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0PihtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0Kim6AZ4BZW1zY3JpcHRlbjo6aW50ZXJuYWw6Okludm9rZXI8bWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldCosIHVuc2lnbmVkIGxvbmcgY29uc3QmJj46Omludm9rZShtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0KiAoKikodW5zaWduZWQgbG9uZyBjb25zdCYmKSwgdW5zaWduZWQgbG9uZym7AYQBbWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0LCB1bnNpZ25lZCBsb25nIGNvbnN0Pih1bnNpZ25lZCBsb25nIGNvbnN0JiYpvAEvbWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldDo6cGxheShkb3VibGUsIGRvdWJsZSm9ATptYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0OjpzZXRQaGFzZShkb3VibGUsIHVuc2lnbmVkIGxvbmcpvgGWAmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQ6OiopKGRvdWJsZSwgdW5zaWduZWQgbG9uZyksIHZvaWQsIG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQqLCBkb3VibGUsIHVuc2lnbmVkIGxvbmc+OjppbnZva2Uodm9pZCAobWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldDo6KiBjb25zdCYpKGRvdWJsZSwgdW5zaWduZWQgbG9uZyksIG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQqLCBkb3VibGUsIHVuc2lnbmVkIGxvbmcpvwFjbWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldDo6c2V0UGhhc2VzKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiBjb25zdCYpwAEybWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldDo6Z2V0UGhhc2UodW5zaWduZWQgbG9uZynBAfwBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0OjoqKSh1bnNpZ25lZCBsb25nKSwgZG91YmxlLCBtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0KiwgdW5zaWduZWQgbG9uZz46Omludm9rZShkb3VibGUgKG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQ6OiogY29uc3QmKSh1bnNpZ25lZCBsb25nKSwgbWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldCosIHVuc2lnbmVkIGxvbmcpwgEhbWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldDo6c2l6ZSgpwwFqdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aUFzeW5jS3VyYW1vdG9Pc2NpbGxhdG9yPihtYXhpQXN5bmNLdXJhbW90b09zY2lsbGF0b3IqKcQBrAFtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0KiBlbXNjcmlwdGVuOjpiYXNlPG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQ+Ojpjb252ZXJ0UG9pbnRlcjxtYXhpQXN5bmNLdXJhbW90b09zY2lsbGF0b3IsIG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQ+KG1heGlBc3luY0t1cmFtb3RvT3NjaWxsYXRvciopxQGIAW1heGlBc3luY0t1cmFtb3RvT3NjaWxsYXRvciogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpQXN5bmNLdXJhbW90b09zY2lsbGF0b3IsIHVuc2lnbmVkIGxvbmcgY29uc3Q+KHVuc2lnbmVkIGxvbmcgY29uc3QmJinGATFtYXhpQXN5bmNLdXJhbW90b09zY2lsbGF0b3I6OnBsYXkoZG91YmxlLCBkb3VibGUpxwE8bWF4aUFzeW5jS3VyYW1vdG9Pc2NpbGxhdG9yOjpzZXRQaGFzZShkb3VibGUsIHVuc2lnbmVkIGxvbmcpyAFlbWF4aUFzeW5jS3VyYW1vdG9Pc2NpbGxhdG9yOjpzZXRQaGFzZXMoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+IGNvbnN0JinJAZUBdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8c3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+ID4oc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+KinKAY8Bdm9pZCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6cmF3X2Rlc3RydWN0b3I8c3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+ID4oc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+KinLAYkBc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiA+KCnMAUdzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID46OnB1c2hfYmFjayhpbnQgY29uc3QmKc0BvwJlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID46OiopKGludCBjb25zdCYpLCB2b2lkLCBzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4qLCBpbnQgY29uc3QmPjo6aW52b2tlKHZvaWQgKHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPjo6KiBjb25zdCYpKGludCBjb25zdCYpLCBzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4qLCBpbnQpzgFTc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+OjpyZXNpemUodW5zaWduZWQgbG9uZywgaW50IGNvbnN0JinPAfsCZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAoc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+OjoqKSh1bnNpZ25lZCBsb25nLCBpbnQgY29uc3QmKSwgdm9pZCwgc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+KiwgdW5zaWduZWQgbG9uZywgaW50IGNvbnN0Jj46Omludm9rZSh2b2lkIChzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID46OiogY29uc3QmKSh1bnNpZ25lZCBsb25nLCBpbnQgY29uc3QmKSwgc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+KiwgdW5zaWduZWQgbG9uZywgaW50KdABPnN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPjo6c2l6ZSgpIGNvbnN00QGiAWVtc2NyaXB0ZW46OmludGVybmFsOjpWZWN0b3JBY2Nlc3M8c3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+ID46OmdldChzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4gY29uc3QmLCB1bnNpZ25lZCBsb25nKdIBgwNlbXNjcmlwdGVuOjppbnRlcm5hbDo6RnVuY3Rpb25JbnZva2VyPGVtc2NyaXB0ZW46OnZhbCAoKikoc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+IGNvbnN0JiwgdW5zaWduZWQgbG9uZyksIGVtc2NyaXB0ZW46OnZhbCwgc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+IGNvbnN0JiwgdW5zaWduZWQgbG9uZz46Omludm9rZShlbXNjcmlwdGVuOjp2YWwgKCoqKShzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4gY29uc3QmLCB1bnNpZ25lZCBsb25nKSwgc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+KiwgdW5zaWduZWQgbG9uZynTAagBZW1zY3JpcHRlbjo6aW50ZXJuYWw6OlZlY3RvckFjY2VzczxzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4gPjo6c2V0KHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiYsIHVuc2lnbmVkIGxvbmcsIGludCBjb25zdCYp1AH5AmVtc2NyaXB0ZW46OmludGVybmFsOjpGdW5jdGlvbkludm9rZXI8Ym9vbCAoKikoc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+JiwgdW5zaWduZWQgbG9uZywgaW50IGNvbnN0JiksIGJvb2wsIHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiYsIHVuc2lnbmVkIGxvbmcsIGludCBjb25zdCY+OjppbnZva2UoYm9vbCAoKiopKHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiYsIHVuc2lnbmVkIGxvbmcsIGludCBjb25zdCYpLCBzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4qLCB1bnNpZ25lZCBsb25nLCBpbnQp1QGhAXZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiA+KHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiop1gFQc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+OjpwdXNoX2JhY2soZG91YmxlIGNvbnN0JinXAeMCZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+OjoqKShkb3VibGUgY29uc3QmKSwgdm9pZCwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KiwgZG91YmxlIGNvbnN0Jj46Omludm9rZSh2b2lkIChzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID46OiogY29uc3QmKShkb3VibGUgY29uc3QmKSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KiwgZG91YmxlKdgBXHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPjo6cmVzaXplKHVuc2lnbmVkIGxvbmcsIGRvdWJsZSBjb25zdCYp2QGfA2Vtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPjo6KikodW5zaWduZWQgbG9uZywgZG91YmxlIGNvbnN0JiksIHZvaWQsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiosIHVuc2lnbmVkIGxvbmcsIGRvdWJsZSBjb25zdCY+OjppbnZva2Uodm9pZCAoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+OjoqIGNvbnN0JikodW5zaWduZWQgbG9uZywgZG91YmxlIGNvbnN0JiksIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiosIHVuc2lnbmVkIGxvbmcsIGRvdWJsZSnaAURzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID46OnNpemUoKSBjb25zdNsBrgFlbXNjcmlwdGVuOjppbnRlcm5hbDo6VmVjdG9yQWNjZXNzPHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiA+OjpnZXQoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+IGNvbnN0JiwgdW5zaWduZWQgbG9uZyncAbcBZW1zY3JpcHRlbjo6aW50ZXJuYWw6OlZlY3RvckFjY2VzczxzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4gPjo6c2V0KHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIHVuc2lnbmVkIGxvbmcsIGRvdWJsZSBjb25zdCYp3QGdA2Vtc2NyaXB0ZW46OmludGVybmFsOjpGdW5jdGlvbkludm9rZXI8Ym9vbCAoKikoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgdW5zaWduZWQgbG9uZywgZG91YmxlIGNvbnN0JiksIGJvb2wsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIHVuc2lnbmVkIGxvbmcsIGRvdWJsZSBjb25zdCY+OjppbnZva2UoYm9vbCAoKiopKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIHVuc2lnbmVkIGxvbmcsIGRvdWJsZSBjb25zdCYpLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4qLCB1bnNpZ25lZCBsb25nLCBkb3VibGUp3gGZAXZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+ID4oc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4qKd8BSnN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpwdXNoX2JhY2soY2hhciBjb25zdCYp4AHLAmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjoqKShjaGFyIGNvbnN0JiksIHZvaWQsIHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+KiwgY2hhciBjb25zdCY+OjppbnZva2Uodm9pZCAoc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OiogY29uc3QmKShjaGFyIGNvbnN0JiksIHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+KiwgY2hhcinhAVZzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6cmVzaXplKHVuc2lnbmVkIGxvbmcsIGNoYXIgY29uc3QmKeIBhwNlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6KikodW5zaWduZWQgbG9uZywgY2hhciBjb25zdCYpLCB2b2lkLCBzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiosIHVuc2lnbmVkIGxvbmcsIGNoYXIgY29uc3QmPjo6aW52b2tlKHZvaWQgKHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjoqIGNvbnN0JikodW5zaWduZWQgbG9uZywgY2hhciBjb25zdCYpLCBzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiosIHVuc2lnbmVkIGxvbmcsIGNoYXIp4wFAc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OnNpemUoKSBjb25zdOQBpgFlbXNjcmlwdGVuOjppbnRlcm5hbDo6VmVjdG9yQWNjZXNzPHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+ID46OmdldChzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCYsIHVuc2lnbmVkIGxvbmcp5QGtAWVtc2NyaXB0ZW46OmludGVybmFsOjpWZWN0b3JBY2Nlc3M8c3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gPjo6c2V0KHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+JiwgdW5zaWduZWQgbG9uZywgY2hhciBjb25zdCYp5gGFA2Vtc2NyaXB0ZW46OmludGVybmFsOjpGdW5jdGlvbkludm9rZXI8Ym9vbCAoKikoc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4mLCB1bnNpZ25lZCBsb25nLCBjaGFyIGNvbnN0JiksIGJvb2wsIHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+JiwgdW5zaWduZWQgbG9uZywgY2hhciBjb25zdCY+OjppbnZva2UoYm9vbCAoKiopKHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+JiwgdW5zaWduZWQgbG9uZywgY2hhciBjb25zdCYpLCBzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiosIHVuc2lnbmVkIGxvbmcsIGNoYXIp5wG9AXZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPHN0ZDo6X18yOjp2ZWN0b3I8dW5zaWduZWQgY2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjx1bnNpZ25lZCBjaGFyPiA+ID4oc3RkOjpfXzI6OnZlY3Rvcjx1bnNpZ25lZCBjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHVuc2lnbmVkIGNoYXI+ID4qKegBygFlbXNjcmlwdGVuOjppbnRlcm5hbDo6VmVjdG9yQWNjZXNzPHN0ZDo6X18yOjp2ZWN0b3I8dW5zaWduZWQgY2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjx1bnNpZ25lZCBjaGFyPiA+ID46OmdldChzdGQ6Ol9fMjo6dmVjdG9yPHVuc2lnbmVkIGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8dW5zaWduZWQgY2hhcj4gPiBjb25zdCYsIHVuc2lnbmVkIGxvbmcp6QGdAXZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4gPihzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+KinqAdcCZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAoc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPjo6KikoZmxvYXQgY29uc3QmKSwgdm9pZCwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiosIGZsb2F0IGNvbnN0Jj46Omludm9rZSh2b2lkIChzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+OjoqIGNvbnN0JikoZmxvYXQgY29uc3QmKSwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiosIGZsb2F0KesBkwNlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+OjoqKSh1bnNpZ25lZCBsb25nLCBmbG9hdCBjb25zdCYpLCB2b2lkLCBzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+KiwgdW5zaWduZWQgbG9uZywgZmxvYXQgY29uc3QmPjo6aW52b2tlKHZvaWQgKHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID46OiogY29uc3QmKSh1bnNpZ25lZCBsb25nLCBmbG9hdCBjb25zdCYpLCBzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+KiwgdW5zaWduZWQgbG9uZywgZmxvYXQp7AGqAWVtc2NyaXB0ZW46OmludGVybmFsOjpWZWN0b3JBY2Nlc3M8c3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiA+OjpnZXQoc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiBjb25zdCYsIHVuc2lnbmVkIGxvbmcp7QGRA2Vtc2NyaXB0ZW46OmludGVybmFsOjpGdW5jdGlvbkludm9rZXI8Ym9vbCAoKikoc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiYsIHVuc2lnbmVkIGxvbmcsIGZsb2F0IGNvbnN0JiksIGJvb2wsIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mLCB1bnNpZ25lZCBsb25nLCBmbG9hdCBjb25zdCY+OjppbnZva2UoYm9vbCAoKiopKHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mLCB1bnNpZ25lZCBsb25nLCBmbG9hdCBjb25zdCYpLCBzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+KiwgdW5zaWduZWQgbG9uZywgZmxvYXQp7gH2AXN0ZDo6X18yOjplbmFibGVfaWY8KF9faXNfZm9yd2FyZF9pdGVyYXRvcjxkb3VibGUqPjo6dmFsdWUpICYmIChpc19jb25zdHJ1Y3RpYmxlPGRvdWJsZSwgc3RkOjpfXzI6Oml0ZXJhdG9yX3RyYWl0czxkb3VibGUqPjo6cmVmZXJlbmNlPjo6dmFsdWUpLCB2b2lkPjo6dHlwZSBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID46OmFzc2lnbjxkb3VibGUqPihkb3VibGUqLCBkb3VibGUqKe8BZkVtc2NyaXB0ZW5CaW5kaW5nSW5pdGlhbGl6ZXJfbXlfbW9kdWxlX21heGlHcmFpbnM6OkVtc2NyaXB0ZW5CaW5kaW5nSW5pdGlhbGl6ZXJfbXlfbW9kdWxlX21heGlHcmFpbnMoKfABc3ZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPihtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KinxAW12b2lkIGVtc2NyaXB0ZW46OmludGVybmFsOjpyYXdfZGVzdHJ1Y3RvcjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4obWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiop8gGYAWVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6Z2V0KHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiBjb25zdCYp8wFmZW1zY3JpcHRlbjo6c21hcnRfcHRyX3RyYWl0PHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojpjb25zdHJ1Y3RfbnVsbCgp9AGdAWVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6c2hhcmUobWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGVtc2NyaXB0ZW46OmludGVybmFsOjpfRU1fVkFMKin1AZsBdm9pZCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6cmF3X2Rlc3RydWN0b3I8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID4oc3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+Kin2AZwBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Okludm9rZXI8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46Omludm9rZShzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gKCopKCkp9wHCAXN0ZDo6X18yOjplbmFibGVfaWY8IShpc19hcnJheTxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID46OnZhbHVlKSwgc3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46OnR5cGUgc3RkOjpfXzI6Om1ha2Vfc2hhcmVkPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPigp+AE3bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6c2V0U2FtcGxlKG1heGlTYW1wbGUqKfkBOG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OmdldE5vcm1hbGlzZWRQb3NpdGlvbigp+gE0bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6c2V0UG9zaXRpb24oZG91YmxlKfsBQm1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OnBsYXkoZG91YmxlLCBkb3VibGUsIGludCwgZG91YmxlKfwBzAJlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OiopKGRvdWJsZSwgZG91YmxlLCBpbnQsIGRvdWJsZSksIGRvdWJsZSwgbWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGRvdWJsZSwgZG91YmxlLCBpbnQsIGRvdWJsZT46Omludm9rZShkb3VibGUgKG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OiogY29uc3QmKShkb3VibGUsIGRvdWJsZSwgaW50LCBkb3VibGUpLCBtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KiwgZG91YmxlLCBkb3VibGUsIGludCwgZG91YmxlKf0BRG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OnBsYXlBdFBvc2l0aW9uKGRvdWJsZSwgZG91YmxlLCBpbnQp/gGsAmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6KikoZG91YmxlLCBkb3VibGUsIGludCksIGRvdWJsZSwgbWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGRvdWJsZSwgZG91YmxlLCBpbnQ+OjppbnZva2UoZG91YmxlIChtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+OjoqIGNvbnN0JikoZG91YmxlLCBkb3VibGUsIGludCksIG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qLCBkb3VibGUsIGRvdWJsZSwgaW50Kf8BcXZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+KG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiopgAJrdm9pZCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6cmF3X2Rlc3RydWN0b3I8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4obWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+KimBApsBZW1zY3JpcHRlbjo6c21hcnRfcHRyX3RyYWl0PHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+ID46OnNoYXJlKG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiosIGVtc2NyaXB0ZW46OmludGVybmFsOjpfRU1fVkFMKimCAr8Bc3RkOjpfXzI6OmVuYWJsZV9pZjwhKGlzX2FycmF5PG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+Ojp2YWx1ZSksIHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+ID46OnR5cGUgc3RkOjpfXzI6Om1ha2Vfc2hhcmVkPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+KCmDAjZtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj46OnNldFNhbXBsZShtYXhpU2FtcGxlKimEAkFtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj46OnBsYXkoZG91YmxlLCBkb3VibGUsIGludCwgZG91YmxlKYUCa3ZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+KG1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiophgJfbWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+KCmHAjNtYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OnNldFNhbXBsZShtYXhpU2FtcGxlKimIAjFtYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OnNldExvb3BTdGFydChkb3VibGUpiQIvbWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+OjpzZXRMb29wRW5kKGRvdWJsZSmKAiltYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OmdldExvb3BFbmQoKYsCRm1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6cGxheShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBpbnQsIGRvdWJsZSmMAtwCZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OiopKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGludCwgZG91YmxlKSwgZG91YmxlLCBtYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBpbnQsIGRvdWJsZT46Omludm9rZShkb3VibGUgKG1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6KiBjb25zdCYpKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGludCwgZG91YmxlKSwgbWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgaW50LCBkb3VibGUpjQJIbWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+OjpwbGF5QXRQb3NpdGlvbihkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBpbnQpjgK8AmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+OjoqKShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBpbnQpLCBkb3VibGUsIG1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGludD46Omludm9rZShkb3VibGUgKG1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6KiBjb25zdCYpKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGludCksIG1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGludCmPAnBtYXhpR3JhaW48aGFubldpbkZ1bmN0b3I+OjptYXhpR3JhaW4obWF4aVNhbXBsZSosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIG1heGlHcmFpbldpbmRvd0NhY2hlPGhhbm5XaW5GdW5jdG9yPiopkAJiRW1zY3JpcHRlbkJpbmRpbmdJbml0aWFsaXplcl9teV9tb2R1bGVfbWF4aWJpdHM6OkVtc2NyaXB0ZW5CaW5kaW5nSW5pdGlhbGl6ZXJfbXlfbW9kdWxlX21heGliaXRzKCmRAkR2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpQml0cz4obWF4aUJpdHMqKZICb2Vtc2NyaXB0ZW46OmludGVybmFsOjpJbnZva2VyPHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50Pjo6aW52b2tlKHVuc2lnbmVkIGludCAoKikodW5zaWduZWQgaW50KSwgdW5zaWduZWQgaW50KZMCmQFlbXNjcmlwdGVuOjppbnRlcm5hbDo6SW52b2tlcjx1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50Pjo6aW52b2tlKHVuc2lnbmVkIGludCAoKikodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQpLCB1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCmUAihtYXhpQml0czo6YXQodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQplQIpbWF4aUJpdHM6OnNobCh1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCmWAiltYXhpQml0czo6c2hyKHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KZcCwwFlbXNjcmlwdGVuOjppbnRlcm5hbDo6SW52b2tlcjx1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQ+OjppbnZva2UodW5zaWduZWQgaW50ICgqKSh1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KSwgdW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCmYAjVtYXhpQml0czo6cih1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KZkCKm1heGlCaXRzOjpsYW5kKHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KZoCKW1heGlCaXRzOjpsb3IodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQpmwIqbWF4aUJpdHM6Omx4b3IodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQpnAIbbWF4aUJpdHM6Om5lZyh1bnNpZ25lZCBpbnQpnQIbbWF4aUJpdHM6OmluYyh1bnNpZ25lZCBpbnQpngIbbWF4aUJpdHM6OmRlYyh1bnNpZ25lZCBpbnQpnwIpbWF4aUJpdHM6OmFkZCh1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCmgAiltYXhpQml0czo6c3ViKHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KaECKW1heGlCaXRzOjptdWwodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQpogIpbWF4aUJpdHM6OmRpdih1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCmjAihtYXhpQml0czo6Z3QodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQppAIobWF4aUJpdHM6Omx0KHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KaUCKW1heGlCaXRzOjpndGUodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQppgIpbWF4aUJpdHM6Omx0ZSh1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCmnAihtYXhpQml0czo6ZXEodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQpqAIRbWF4aUJpdHM6Om5vaXNlKCmpAiBtYXhpQml0czo6dG9TaWduYWwodW5zaWduZWQgaW50KaoCJG1heGlCaXRzOjp0b1RyaWdTaWduYWwodW5zaWduZWQgaW50KasCXWVtc2NyaXB0ZW46OmludGVybmFsOjpJbnZva2VyPHVuc2lnbmVkIGludCwgZG91YmxlPjo6aW52b2tlKHVuc2lnbmVkIGludCAoKikoZG91YmxlKSwgZG91YmxlKawCHG1heGlCaXRzOjpmcm9tU2lnbmFsKGRvdWJsZSmtAkp2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpQ291bnRlcj4obWF4aUNvdW50ZXIqKa4CPm1heGlDb3VudGVyKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlDb3VudGVyPigprwIibWF4aUNvdW50ZXI6OmNvdW50KGRvdWJsZSwgZG91YmxlKbACTkVtc2NyaXB0ZW5CaW5kaW5nSW5pdGlhbGl6ZXJfbWF4aVZlcmI6OkVtc2NyaXB0ZW5CaW5kaW5nSW5pdGlhbGl6ZXJfbWF4aVZlcmIoKbECTnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlTYXRSZXZlcmI+KG1heGlTYXRSZXZlcmIqKbICSHZvaWQgZW1zY3JpcHRlbjo6aW50ZXJuYWw6OnJhd19kZXN0cnVjdG9yPG1heGlTYXRSZXZlcmI+KG1heGlTYXRSZXZlcmIqKbMCQm1heGlTYXRSZXZlcmIqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aVNhdFJldmVyYj4oKbQCTHZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlGcmVlVmVyYj4obWF4aUZyZWVWZXJiKim1AkBtYXhpRnJlZVZlcmIqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aUZyZWVWZXJiPigptgJWRW1zY3JpcHRlbkJpbmRpbmdJbml0aWFsaXplcl9tYXhpU3BlY3RyYWw6OkVtc2NyaXB0ZW5CaW5kaW5nSW5pdGlhbGl6ZXJfbWF4aVNwZWN0cmFsKCm3AlB2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpRkZUQWRhcHRvcj4obWF4aUZGVEFkYXB0b3IqKbgCSnZvaWQgZW1zY3JpcHRlbjo6aW50ZXJuYWw6OnJhd19kZXN0cnVjdG9yPG1heGlGRlRBZGFwdG9yPihtYXhpRkZUQWRhcHRvciopuQJEbWF4aUZGVEFkYXB0b3IqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aUZGVEFkYXB0b3I+KCm6AiRtYXhpRkZUQWRhcHRvcjo6c2V0dXAoaW50LCBpbnQsIGludCm7AsoBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAobWF4aUZGVEFkYXB0b3I6OiopKGludCwgaW50LCBpbnQpLCB2b2lkLCBtYXhpRkZUQWRhcHRvciosIGludCwgaW50LCBpbnQ+OjppbnZva2Uodm9pZCAobWF4aUZGVEFkYXB0b3I6OiogY29uc3QmKShpbnQsIGludCwgaW50KSwgbWF4aUZGVEFkYXB0b3IqLCBpbnQsIGludCwgaW50KbwCMW1heGlGRlRBZGFwdG9yOjpwcm9jZXNzKGZsb2F0LCBtYXhpRkZUOjpmZnRNb2Rlcym9AvYBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8Ym9vbCAobWF4aUZGVEFkYXB0b3I6OiopKGZsb2F0LCBtYXhpRkZUOjpmZnRNb2RlcyksIGJvb2wsIG1heGlGRlRBZGFwdG9yKiwgZmxvYXQsIG1heGlGRlQ6OmZmdE1vZGVzPjo6aW52b2tlKGJvb2wgKG1heGlGRlRBZGFwdG9yOjoqIGNvbnN0JikoZmxvYXQsIG1heGlGRlQ6OmZmdE1vZGVzKSwgbWF4aUZGVEFkYXB0b3IqLCBmbG9hdCwgbWF4aUZGVDo6ZmZ0TW9kZXMpvgIibWF4aUZGVEFkYXB0b3I6OnNwZWN0cmFsRmxhdG5lc3MoKb8ClQFlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxmbG9hdCAobWF4aUZGVEFkYXB0b3I6OiopKCksIGZsb2F0LCBtYXhpRkZUQWRhcHRvcio+OjppbnZva2UoZmxvYXQgKG1heGlGRlRBZGFwdG9yOjoqIGNvbnN0JikoKSwgbWF4aUZGVEFkYXB0b3IqKcACIm1heGlGRlRBZGFwdG9yOjpzcGVjdHJhbENlbnRyb2lkKCnBAihtYXhpRkZUQWRhcHRvcjo6Z2V0TWFnbml0dWRlc0FzSlNBcnJheSgpwgKzAWVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGVtc2NyaXB0ZW46OnZhbCAobWF4aUZGVEFkYXB0b3I6OiopKCksIGVtc2NyaXB0ZW46OnZhbCwgbWF4aUZGVEFkYXB0b3IqPjo6aW52b2tlKGVtc2NyaXB0ZW46OnZhbCAobWF4aUZGVEFkYXB0b3I6OiogY29uc3QmKSgpLCBtYXhpRkZUQWRhcHRvciopwwIqbWF4aUZGVEFkYXB0b3I6OmdldE1hZ25pdHVkZXNEQkFzSlNBcnJheSgpxAIkbWF4aUZGVEFkYXB0b3I6OmdldFBoYXNlc0FzSlNBcnJheSgpxQIcbWF4aUZGVEFkYXB0b3I6OmdldE51bUJpbnMoKcYCHG1heGlGRlRBZGFwdG9yOjpnZXRGRlRTaXplKCnHAhxtYXhpRkZUQWRhcHRvcjo6Z2V0SG9wU2l6ZSgpyAIfbWF4aUZGVEFkYXB0b3I6OmdldFdpbmRvd1NpemUoKckCRHZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlJRkZUPihtYXhpSUZGVCopygI+dm9pZCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6cmF3X2Rlc3RydWN0b3I8bWF4aUlGRlQ+KG1heGlJRkZUKinLAjhtYXhpSUZGVCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpSUZGVD4oKcwCgQVlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxmbG9hdCAobWF4aUlGRlQ6OiopKHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mLCBzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+JiwgbWF4aUlGRlQ6OmZmdE1vZGVzKSwgZmxvYXQsIG1heGlJRkZUKiwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiYsIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mLCBtYXhpSUZGVDo6ZmZ0TW9kZXM+OjppbnZva2UoZmxvYXQgKG1heGlJRkZUOjoqIGNvbnN0Jikoc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiYsIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mLCBtYXhpSUZGVDo6ZmZ0TW9kZXMpLCBtYXhpSUZGVCosIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4qLCBzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+KiwgbWF4aUlGRlQ6OmZmdE1vZGVzKc0CZXZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPiA+KG1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPiopzgJfdm9pZCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6cmF3X2Rlc3RydWN0b3I8bWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+ID4obWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+KinPAlltYXhpTUZDQ0FuYWx5c2VyPGRvdWJsZT4qIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+ID4oKdACWW1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPjo6c2V0dXAodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgZG91YmxlLCBkb3VibGUp0QKeA2Vtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKG1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPjo6KikodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgZG91YmxlLCBkb3VibGUpLCB2b2lkLCBtYXhpTUZDQ0FuYWx5c2VyPGRvdWJsZT4qLCB1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50LCBkb3VibGUsIGRvdWJsZT46Omludm9rZSh2b2lkIChtYXhpTUZDQ0FuYWx5c2VyPGRvdWJsZT46OiogY29uc3QmKSh1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50LCBkb3VibGUsIGRvdWJsZSksIG1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPiosIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQsIGRvdWJsZSwgZG91YmxlKdICVW1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPjo6bWZjYyhzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+JinTAqsEZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8c3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiAobWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+OjoqKShzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+JiksIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIG1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPiosIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mPjo6aW52b2tlKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYgKG1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPjo6KiBjb25zdCYpKHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mKSwgbWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+Kiwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiop1AJec3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+OjpfX2FwcGVuZCh1bnNpZ25lZCBsb25nLCBkb3VibGUgY29uc3QmKdUCOG1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPjo6Y2FsY01lbEZpbHRlckJhbmsoZG91YmxlLCBpbnQp1gIrc3RkOjpfXzI6Ol9fdGhyb3dfbGVuZ3RoX2Vycm9yKGNoYXIgY29uc3QqKdcCZHZvaWQgc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+OjpfX3B1c2hfYmFja19zbG93X3BhdGg8aW50IGNvbnN0Jj4oaW50IGNvbnN0JinYAlVzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID46Ol9fYXBwZW5kKHVuc2lnbmVkIGxvbmcsIGludCBjb25zdCYp2QJwdm9pZCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID46Ol9fcHVzaF9iYWNrX3Nsb3dfcGF0aDxkb3VibGUgY29uc3QmPihkb3VibGUgY29uc3QmKdoCWHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpfX2FwcGVuZCh1bnNpZ25lZCBsb25nLCBjaGFyIGNvbnN0JinbAm9zdGQ6Ol9fMjo6dmVjdG9yPG1heGlLdXJhbW90b09zY2lsbGF0b3IsIHN0ZDo6X18yOjphbGxvY2F0b3I8bWF4aUt1cmFtb3RvT3NjaWxsYXRvcj4gPjo6X19hcHBlbmQodW5zaWduZWQgbG9uZyncAk9zdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID46Ol9fYXBwZW5kKHVuc2lnbmVkIGxvbmcp3QIzbWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6fm1heGlUaW1lU3RyZXRjaCgp3gKABHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+LCBlbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46OnZhbF9kZWxldGVyPihtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KiwgZW1zY3JpcHRlbjo6c21hcnRfcHRyX3RyYWl0PHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp2YWxfZGVsZXRlciwgc3RkOjpfXzI6OmVuYWJsZV9pZjxpc19jb252ZXJ0aWJsZTxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KiwgbWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPio+Ojp2YWx1ZSwgc3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+OjpfX25hdD46OnR5cGUp3wJ6ZW1zY3JpcHRlbjo6c21hcnRfcHRyX3RyYWl0PHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp2YWxfZGVsZXRlcjo6b3BlcmF0b3IoKSh2b2lkIGNvbnN0KingAvQBc3RkOjpfXzI6Ol9fc2hhcmVkX3B0cl9wb2ludGVyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qLCBlbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46OnZhbF9kZWxldGVyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp+X19zaGFyZWRfcHRyX3BvaW50ZXIoKeEC9gFzdGQ6Ol9fMjo6X19zaGFyZWRfcHRyX3BvaW50ZXI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6dmFsX2RlbGV0ZXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46On5fX3NoYXJlZF9wdHJfcG9pbnRlcigpLjHiAu8Bc3RkOjpfXzI6Ol9fc2hhcmVkX3B0cl9wb2ludGVyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qLCBlbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46OnZhbF9kZWxldGVyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+OjpfX29uX3plcm9fc2hhcmVkKCnjAocCc3RkOjpfXzI6Ol9fc2hhcmVkX3B0cl9wb2ludGVyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qLCBlbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46OnZhbF9kZWxldGVyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+OjpfX2dldF9kZWxldGVyKHN0ZDo6dHlwZV9pbmZvIGNvbnN0JikgY29uc3TkAvQBc3RkOjpfXzI6Ol9fc2hhcmVkX3B0cl9wb2ludGVyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qLCBlbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46OnZhbF9kZWxldGVyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+OjpfX29uX3plcm9fc2hhcmVkX3dlYWsoKeUCkAFzdGQ6Ol9fMjo6X19zaGFyZWRfcHRyX2VtcGxhY2U8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6fl9fc2hhcmVkX3B0cl9lbXBsYWNlKCnmApIBc3RkOjpfXzI6Ol9fc2hhcmVkX3B0cl9lbXBsYWNlPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46On5fX3NoYXJlZF9wdHJfZW1wbGFjZSgpLjHnAosBc3RkOjpfXzI6Ol9fc2hhcmVkX3B0cl9lbXBsYWNlPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46Ol9fb25femVyb19zaGFyZWQoKegCIW1heGlHcmFpbjxoYW5uV2luRnVuY3Rvcj46OnBsYXkoKekCMW1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPjo6fm1heGlQaXRjaFNoaWZ0KCnqAvgDc3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID46OnNoYXJlZF9wdHI8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+LCBlbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4gPjo6dmFsX2RlbGV0ZXI+KG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiosIGVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp2YWxfZGVsZXRlciwgc3RkOjpfXzI6OmVuYWJsZV9pZjxpc19jb252ZXJ0aWJsZTxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4qLCBtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4qPjo6dmFsdWUsIHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+OjpfX25hdD46OnR5cGUp6wLxAXN0ZDo6X18yOjpfX3NoYXJlZF9wdHJfcG9pbnRlcjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4qLCBlbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4gPjo6dmFsX2RlbGV0ZXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4gPjo6fl9fc2hhcmVkX3B0cl9wb2ludGVyKCnsAvMBc3RkOjpfXzI6Ol9fc2hhcmVkX3B0cl9wb2ludGVyPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiosIGVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp2YWxfZGVsZXRlciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp+X19zaGFyZWRfcHRyX3BvaW50ZXIoKS4x7QKEAnN0ZDo6X18yOjpfX3NoYXJlZF9wdHJfcG9pbnRlcjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4qLCBlbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4gPjo6dmFsX2RlbGV0ZXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4gPjo6X19nZXRfZGVsZXRlcihzdGQ6OnR5cGVfaW5mbyBjb25zdCYpIGNvbnN07gKOAXN0ZDo6X18yOjpfX3NoYXJlZF9wdHJfZW1wbGFjZTxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4gPjo6fl9fc2hhcmVkX3B0cl9lbXBsYWNlKCnvApABc3RkOjpfXzI6Ol9fc2hhcmVkX3B0cl9lbXBsYWNlPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp+X19zaGFyZWRfcHRyX2VtcGxhY2UoKS4x8AKJAXN0ZDo6X18yOjpfX3NoYXJlZF9wdHJfZW1wbGFjZTxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4gPjo6X19vbl96ZXJvX3NoYXJlZCgp8QITbWF4aUZGVDo6fm1heGlGRlQoKfICJF9HTE9CQUxfX3N1Yl9JX21heGltaWxpYW4uZW1iaW5kLmNwcPMCF21heGlPc2M6OnBoYXNvcihkb3VibGUp9AIZbWF4aU9zYzo6dHJpYW5nbGUoZG91YmxlKfUCUG1heGlFbnZlbG9wZTo6bGluZShpbnQsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYp9gIibWF4aUVudmVsb3BlOjp0cmlnZ2VyKGludCwgZG91YmxlKfcCHm1heGlEZWxheWxpbmU6Om1heGlEZWxheWxpbmUoKfgCJm1heGlEZWxheWxpbmU6OmRsKGRvdWJsZSwgaW50LCBkb3VibGUp+QIrbWF4aURlbGF5bGluZTo6ZGwoZG91YmxlLCBpbnQsIGRvdWJsZSwgaW50KfoCKW1heGlGaWx0ZXI6OmxvcmVzKGRvdWJsZSwgZG91YmxlLCBkb3VibGUp+wJYbWF4aU1peDo6c3RlcmVvKGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgZG91YmxlKfwCXm1heGlNaXg6OnF1YWQoZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBkb3VibGUsIGRvdWJsZSn9AmttYXhpTWl4OjphbWJpc29uaWMoZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKf4CGG1heGlTYW1wbGU6Om1heGlTYW1wbGUoKf8CbG1heGlTYW1wbGU6OnNldFNhbXBsZUZyb21PZ2dCbG9iKHN0ZDo6X18yOjp2ZWN0b3I8dW5zaWduZWQgY2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjx1bnNpZ25lZCBjaGFyPiA+JiwgaW50KYADTXN0ZDo6X18yOjpiYXNpY19maWxlYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfZmlsZWJ1ZigpgQNMc3RkOjpfXzI6OmJhc2ljX2ZpbGVidWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OmJhc2ljX2ZpbGVidWYoKYIDXHN0ZDo6X18yOjpiYXNpY19maWxlYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpvcGVuKGNoYXIgY29uc3QqLCB1bnNpZ25lZCBpbnQpgwNPc3RkOjpfXzI6OmJhc2ljX2lmc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfaWZzdHJlYW0oKYQDFW1heGlTYW1wbGU6OmlzUmVhZHkoKYUDFW1heGlTYW1wbGU6OnRyaWdnZXIoKYYDbG1heGlTYW1wbGU6OmxvYWQoc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiwgaW50KYcDEm1heGlTYW1wbGU6OnJlYWQoKYgDZ3N0ZDo6X18yOjpiYXNpY19pZnN0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6YmFzaWNfaWZzdHJlYW0oY2hhciBjb25zdCosIHVuc2lnbmVkIGludCmJA90Bc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mIHN0ZDo6X18yOjpfX3B1dF9jaGFyYWN0ZXJfc2VxdWVuY2U8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4oc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgbG9uZymKA01zdGQ6Ol9fMjo6dmVjdG9yPHNob3J0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHNob3J0PiA+OjpfX2FwcGVuZCh1bnNpZ25lZCBsb25nKYsDEm1heGlTYW1wbGU6OnBsYXkoKYwDKG1heGlTYW1wbGU6OnBsYXkoZG91YmxlLCBkb3VibGUsIGRvdWJsZSmNAzFtYXhpU2FtcGxlOjpwbGF5KGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSYpjgMpbWF4aVNhbXBsZTo6cGxheTQoZG91YmxlLCBkb3VibGUsIGRvdWJsZSmPAxZtYXhpU2FtcGxlOjpwbGF5T25jZSgpkAMcbWF4aVNhbXBsZTo6cGxheU9uWlgoZG91YmxlKZEDJG1heGlTYW1wbGU6OnBsYXlPblpYKGRvdWJsZSwgZG91YmxlKZIDHG1heGlTYW1wbGU6OnBsYXlPbmNlKGRvdWJsZSmTAyxtYXhpU2FtcGxlOjpwbGF5T25aWChkb3VibGUsIGRvdWJsZSwgZG91YmxlKZQDKm1heGlTYW1wbGU6Omxvb3BTZXRQb3NPblpYKGRvdWJsZSwgZG91YmxlKZUDGG1heGlTYW1wbGU6OnBsYXkoZG91YmxlKZYDHW1heGlTYW1wbGU6Om5vcm1hbGlzZShkb3VibGUplwMubWF4aVNhbXBsZTo6YXV0b1RyaW0oZmxvYXQsIGZsb2F0LCBib29sLCBib29sKZgDM21heGlEeW46OmdhdGUoZG91YmxlLCBkb3VibGUsIGxvbmcsIGRvdWJsZSwgZG91YmxlKZkDO21heGlEeW46OmNvbXByZXNzb3IoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUpmgMZbWF4aUR5bjo6Y29tcHJlc3MoZG91YmxlKZsDGm1heGlEeW46OnNldEF0dGFjayhkb3VibGUpnAMbbWF4aUR5bjo6c2V0UmVsZWFzZShkb3VibGUpnQMdbWF4aUR5bjo6c2V0VGhyZXNob2xkKGRvdWJsZSmeAy5tYXhpRW52Ojphcihkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBsb25nLCBpbnQpnwNAbWF4aUVudjo6YWRzcihkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgbG9uZywgaW50KaADGm1heGlFbnY6OmFkc3IoZG91YmxlLCBpbnQpoQMabWF4aUVudjo6c2V0QXR0YWNrKGRvdWJsZSmiAxttYXhpRW52OjpzZXRTdXN0YWluKGRvdWJsZSmjAxltYXhpRW52OjpzZXREZWNheShkb3VibGUppAMSY29udmVydDo6bXRvZihpbnQppQNgdmlydHVhbCB0aHVuayB0byBzdGQ6Ol9fMjo6YmFzaWNfaWZzdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19pZnN0cmVhbSgppgNRc3RkOjpfXzI6OmJhc2ljX2lmc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfaWZzdHJlYW0oKS4xpwNidmlydHVhbCB0aHVuayB0byBzdGQ6Ol9fMjo6YmFzaWNfaWZzdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19pZnN0cmVhbSgpLjGoA0NzdGQ6Ol9fMjo6YmFzaWNfZmlsZWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6c3luYygpqQNPc3RkOjpfXzI6OmJhc2ljX2ZpbGVidWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19maWxlYnVmKCkuMaoDW3N0ZDo6X18yOjpiYXNpY19maWxlYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjppbWJ1ZShzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JimrA1BzdGQ6Ol9fMjo6YmFzaWNfZmlsZWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6c2V0YnVmKGNoYXIqLCBsb25nKawDenN0ZDo6X18yOjpiYXNpY19maWxlYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpzZWVrb2ZmKGxvbmcgbG9uZywgc3RkOjpfXzI6Omlvc19iYXNlOjpzZWVrZGlyLCB1bnNpZ25lZCBpbnQprQMcc3RkOjpfXzI6Ol9fdGhyb3dfYmFkX2Nhc3QoKa4Db3N0ZDo6X18yOjpiYXNpY19maWxlYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpzZWVrcG9zKHN0ZDo6X18yOjpmcG9zPF9fbWJzdGF0ZV90PiwgdW5zaWduZWQgaW50Ka8DSHN0ZDo6X18yOjpiYXNpY19maWxlYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp1bmRlcmZsb3coKbADS3N0ZDo6X18yOjpiYXNpY19maWxlYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpwYmFja2ZhaWwoaW50KbEDSnN0ZDo6X18yOjpiYXNpY19maWxlYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpvdmVyZmxvdyhpbnQpsgOFAnN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+IHN0ZDo6X18yOjpfX3BhZF9hbmRfb3V0cHV0PGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCBjaGFyKbMDG21heGlDbG9jazo6c2V0VGVtcG8oZG91YmxlKbQDE21heGlDbG9jazo6dGlja2VyKCm1Ax9tYXhpQ2xvY2s6OnNldFRpY2tzUGVyQmVhdChpbnQptgMdbWF4aUZGVDo6c2V0dXAoaW50LCBpbnQsIGludCm3AyptYXhpRkZUOjpwcm9jZXNzKGZsb2F0LCBtYXhpRkZUOjpmZnRNb2Rlcym4AxNtYXhpRkZUOjptYWdzVG9EQigpuQMbbWF4aUZGVDo6c3BlY3RyYWxGbGF0bmVzcygpugMbbWF4aUZGVDo6c3BlY3RyYWxDZW50cm9pZCgpuwMebWF4aUlGRlQ6OnNldHVwKGludCwgaW50LCBpbnQpvAOTAW1heGlJRkZUOjpwcm9jZXNzKHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mLCBzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+JiwgbWF4aUlGRlQ6OmZmdE1vZGVzKb0DLkZGVChpbnQsIGJvb2wsIGZsb2F0KiwgZmxvYXQqLCBmbG9hdCosIGZsb2F0Kim+AyRSZWFsRkZUKGludCwgZmxvYXQqLCBmbG9hdCosIGZsb2F0Kim/AyBmZnQ6OmdlbldpbmRvdyhpbnQsIGludCwgZmxvYXQqKcADD2ZmdDo6c2V0dXAoaW50KcEDC2ZmdDo6fmZmdCgpwgMhZmZ0OjpjYWxjRkZUKGludCwgZmxvYXQqLCBmbG9hdCopwwM3ZmZ0Ojpwb3dlclNwZWN0cnVtKGludCwgZmxvYXQqLCBmbG9hdCosIGZsb2F0KiwgZmxvYXQqKcQDHWZmdDo6Y29udlRvREIoZmxvYXQqLCBmbG9hdCopxQM7ZmZ0OjppbnZlcnNlRkZUQ29tcGxleChpbnQsIGZsb2F0KiwgZmxvYXQqLCBmbG9hdCosIGZsb2F0KinGAz5mZnQ6OmludmVyc2VQb3dlclNwZWN0cnVtKGludCwgZmxvYXQqLCBmbG9hdCosIGZsb2F0KiwgZmxvYXQqKccDN21heGlNRkNDQW5hbHlzZXI8ZG91YmxlPjo6bWVsRmlsdGVyQW5kTG9nU3F1YXJlKGZsb2F0KinIAyZtYXhpUmV2ZXJiRmlsdGVyczo6bWF4aVJldmVyYkZpbHRlcnMoKckDIG1heGlSZXZlcmJCYXNlOjptYXhpUmV2ZXJiQmFzZSgpygMebWF4aVNhdFJldmVyYjo6bWF4aVNhdFJldmVyYigpywMbbWF4aVNhdFJldmVyYjo6cGxheShkb3VibGUpzAMcbWF4aUZyZWVWZXJiOjptYXhpRnJlZVZlcmIoKc0DKm1heGlGcmVlVmVyYjo6cGxheShkb3VibGUsIGRvdWJsZSwgZG91YmxlKc4DJ3BvaW50X2NvbXBhcmUodm9pZCBjb25zdCosIHZvaWQgY29uc3QqKc8DGnZvcmJpc19kZWluaXQoc3RiX3ZvcmJpcyop0AMpaXNfd2hvbGVfcGFja2V0X3ByZXNlbnQoc3RiX3ZvcmJpcyosIGludCnRAzN2b3JiaXNfZGVjb2RlX3BhY2tldChzdGJfdm9yYmlzKiwgaW50KiwgaW50KiwgaW50KinSAxdzdGFydF9wYWdlKHN0Yl92b3JiaXMqKdMDL3ZvcmJpc19maW5pc2hfZnJhbWUoc3RiX3ZvcmJpcyosIGludCwgaW50LCBpbnQp1ANAdm9yYmlzX2RlY29kZV9pbml0aWFsKHN0Yl92b3JiaXMqLCBpbnQqLCBpbnQqLCBpbnQqLCBpbnQqLCBpbnQqKdUDGmdldF9iaXRzKHN0Yl92b3JiaXMqLCBpbnQp1gMyY29kZWJvb2tfZGVjb2RlX3NjYWxhcl9yYXcoc3RiX3ZvcmJpcyosIENvZGVib29rKinXA0NkZWNvZGVfcmVzaWR1ZShzdGJfdm9yYmlzKiwgZmxvYXQqKiwgaW50LCBpbnQsIGludCwgdW5zaWduZWQgY2hhciop2AMraW52ZXJzZV9tZGN0KGZsb2F0KiwgaW50LCBzdGJfdm9yYmlzKiwgaW50KdkDGWZsdXNoX3BhY2tldChzdGJfdm9yYmlzKinaAxpzdGFydF9kZWNvZGVyKHN0Yl92b3JiaXMqKdsDKHVpbnQzMl9jb21wYXJlKHZvaWQgY29uc3QqLCB2b2lkIGNvbnN0KincAyVpbml0X2Jsb2Nrc2l6ZShzdGJfdm9yYmlzKiwgaW50LCBpbnQp3QMWc3RiX3ZvcmJpc19vcGVuX21lbW9yed4DGnN0Yl92b3JiaXNfZ2V0X2ZyYW1lX3Nob3J03wNAY29udmVydF9zYW1wbGVzX3Nob3J0KGludCwgc2hvcnQqKiwgaW50LCBpbnQsIGZsb2F0KiosIGludCwgaW50KeADJnN0Yl92b3JiaXNfZ2V0X2ZyYW1lX3Nob3J0X2ludGVybGVhdmVk4QNHY29udmVydF9jaGFubmVsc19zaG9ydF9pbnRlcmxlYXZlZChpbnQsIHNob3J0KiwgaW50LCBmbG9hdCoqLCBpbnQsIGludCniAxhzdGJfdm9yYmlzX2RlY29kZV9tZW1vcnnjAx9tYXliZV9zdGFydF9wYWNrZXQoc3RiX3ZvcmJpcyop5AMpc3RhcnRfcGFnZV9ub19jYXB0dXJlcGF0dGVybihzdGJfdm9yYmlzKinlAzJjb2RlYm9va19kZWNvZGVfc3RhcnQoc3RiX3ZvcmJpcyosIENvZGVib29rKiwgaW50KeYDX2NvZGVib29rX2RlY29kZV9kZWludGVybGVhdmVfcmVwZWF0KHN0Yl92b3JiaXMqLCBDb2RlYm9vayosIGZsb2F0KiosIGludCwgaW50KiwgaW50KiwgaW50LCBpbnQp5wM1aW1kY3Rfc3RlcDNfaXRlcjBfbG9vcChpbnQsIGZsb2F0KiwgaW50LCBpbnQsIGZsb2F0KinoAzxpbWRjdF9zdGVwM19pbm5lcl9yX2xvb3AoaW50LCBmbG9hdCosIGludCwgaW50LCBmbG9hdCosIGludCnpAwdzY2FsYm5m6gMGbGRleHBm6wMGbWVtY21w7AMFcXNvcnTtAwRzaWZ07gMDc2hy7wMHdHJpbmtsZfADA3NobPEDBHBudHryAwVjeWNsZfMDB2FfY3R6X2z0AwxfX3N0ZGlvX3NlZWv1AwpfX2xvY2tmaWxl9gMMX191bmxvY2tmaWxl9wMJX19md3JpdGV4+AMGZndyaXRl+QMHaXByaW50ZvoDEF9fZXJybm9fbG9jYXRpb277Awd3Y3J0b21i/AMGd2N0b21i/QMGbWVtY2hy/gMFZnJleHD/AxNfX3ZmcHJpbnRmX2ludGVybmFsgAQLcHJpbnRmX2NvcmWBBANvdXSCBAZnZXRpbnSDBAdwb3BfYXJnhAQDcGFkhQQFZm10X2+GBAVmbXRfeIcEBWZtdF91iAQIdmZwcmludGaJBAZmbXRfZnCKBBNwb3BfYXJnX2xvbmdfZG91YmxliwQJdmZpcHJpbnRmjAQKX19vZmxfbG9ja40ECV9fdG93cml0ZY4ECGZpcHJpbnRmjwQFZnB1dGOQBBFfX2Z0ZWxsb191bmxvY2tlZJEECF9fZnRlbGxvkgQFZnRlbGyTBAhfX3RvcmVhZJQEBWZyZWFklQQRX19mc2Vla29fdW5sb2NrZWSWBAhfX2ZzZWVrb5cEBWZzZWVrmAQNX19zdGRpb19jbG9zZZkEBWZnZXRjmgQGc3RybGVumwQLX19zdHJjaHJudWycBAZzdHJjaHKdBAxfX2Ztb2RlZmxhZ3OeBAVmb3Blbp8ECXZzbnByaW50ZqAECHNuX3dyaXRloQQGZmNsb3NlogQZX19lbXNjcmlwdGVuX3N0ZG91dF9jbG9zZaMEGF9fZW1zY3JpcHRlbl9zdGRvdXRfc2Vla6QEDF9fc3RkaW9fcmVhZKUECF9fZmRvcGVupgQNX19zdGRpb193cml0ZacECl9fb3ZlcmZsb3eoBAZmZmx1c2ipBBFfX2ZmbHVzaF91bmxvY2tlZKoEB19fdWZsb3erBAlfX29mbF9hZGSsBAlfX2xzaHJ0aTOtBAlfX2FzaGx0aTOuBAxfX3RydW5jdGZkZjKvBAVfX2Nvc7AEEF9fcmVtX3BpbzJfbGFyZ2WxBApfX3JlbV9waW8ysgQFX19zaW6zBANjb3O0BAdfX2Nvc2RmtQQHX19zaW5kZrYEC19fcmVtX3BpbzJmtwQEY29zZrgEA3NpbrkEBHNpbma6BAVfX3RhbrsEA3RhbrwEBWF0YW5mvQQGYXRhbjJmvgQEZXhwZr8EA2xvZ8AEBGxvZ2bBBANwb3fCBAd3bWVtY3B5wwQZc3RkOjp1bmNhdWdodF9leGNlcHRpb24oKcQERXN0ZDo6X18yOjpiYXNpY19pb3M8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19pb3MoKcUEH3N0ZDo6X18yOjppb3NfYmFzZTo6fmlvc19iYXNlKCnGBD9zdGQ6Ol9fMjo6aW9zX2Jhc2U6Ol9fY2FsbF9jYWxsYmFja3Moc3RkOjpfXzI6Omlvc19iYXNlOjpldmVudCnHBEdzdGQ6Ol9fMjo6YmFzaWNfaW9zPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfaW9zKCkuMcgEUXN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19zdHJlYW1idWYoKckEU3N0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19zdHJlYW1idWYoKS4xygRQc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6YmFzaWNfc3RyZWFtYnVmKCnLBF1zdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjppbWJ1ZShzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JinMBFJzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpzZXRidWYoY2hhciosIGxvbmcpzQR8c3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6c2Vla29mZihsb25nIGxvbmcsIHN0ZDo6X18yOjppb3NfYmFzZTo6c2Vla2RpciwgdW5zaWduZWQgaW50Kc4EcXN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnNlZWtwb3Moc3RkOjpfXzI6OmZwb3M8X19tYnN0YXRlX3Q+LCB1bnNpZ25lZCBpbnQpzwRSc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6eHNnZXRuKGNoYXIqLCBsb25nKdAERHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPjo6Y29weShjaGFyKiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGxvbmcp0QRKc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6dW5kZXJmbG93KCnSBEZzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp1Zmxvdygp0wRNc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6cGJhY2tmYWlsKGludCnUBFhzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp4c3B1dG4oY2hhciBjb25zdCosIGxvbmcp1QRXc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1Zjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6fmJhc2ljX3N0cmVhbWJ1Zigp1gRZc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1Zjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6fmJhc2ljX3N0cmVhbWJ1ZigpLjHXBFZzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+OjpiYXNpY19zdHJlYW1idWYoKdgEW3N0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46OnhzZ2V0bih3Y2hhcl90KiwgbG9uZynZBE1zdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD46OmNvcHkod2NoYXJfdCosIHdjaGFyX3QgY29uc3QqLCB1bnNpZ25lZCBsb25nKdoETHN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46OnVmbG93KCnbBGFzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Ojp4c3B1dG4od2NoYXJfdCBjb25zdCosIGxvbmcp3ARPc3RkOjpfXzI6OmJhc2ljX2lzdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19pc3RyZWFtKCkuMd0EXnZpcnR1YWwgdGh1bmsgdG8gc3RkOjpfXzI6OmJhc2ljX2lzdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19pc3RyZWFtKCneBE9zdGQ6Ol9fMjo6YmFzaWNfaXN0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX2lzdHJlYW0oKS4y3wRgdmlydHVhbCB0aHVuayB0byBzdGQ6Ol9fMjo6YmFzaWNfaXN0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX2lzdHJlYW0oKS4x4ASPAXN0ZDo6X18yOjpiYXNpY19pc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpzZW50cnk6OnNlbnRyeShzdGQ6Ol9fMjo6YmFzaWNfaXN0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIGJvb2wp4QREc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OmZsdXNoKCniBGFzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmIHN0ZDo6X18yOjp1c2VfZmFjZXQ8c3RkOjpfXzI6OmN0eXBlPGNoYXI+ID4oc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYp4wTRAWJvb2wgc3RkOjpfXzI6Om9wZXJhdG9yIT08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gY29uc3QmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiBjb25zdCYp5ARUc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46Om9wZXJhdG9yKigpIGNvbnN05QRPc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46Om9wZXJhdG9yKysoKeYE0QFib29sIHN0ZDo6X18yOjpvcGVyYXRvcj09PGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+IGNvbnN0Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gY29uc3QmKecEiQFzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6c2VudHJ5OjpzZW50cnkoc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mKegETnN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpzZW50cnk6On5zZW50cnkoKekEmAFzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6ZXF1YWwoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gY29uc3QmKSBjb25zdOoER3N0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnNidW1wYygp6wRKc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6c3B1dGMoY2hhcinsBE5zdGQ6Ol9fMjo6YmFzaWNfaXN0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6cmVhZChjaGFyKiwgbG9uZyntBGpzdGQ6Ol9fMjo6YmFzaWNfaXN0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6c2Vla2cobG9uZyBsb25nLCBzdGQ6Ol9fMjo6aW9zX2Jhc2U6OnNlZWtkaXIp7gRKc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46OmZsdXNoKCnvBGdzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmIHN0ZDo6X18yOjp1c2VfZmFjZXQ8c3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+ID4oc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYp8ATjAWJvb2wgc3RkOjpfXzI6Om9wZXJhdG9yIT08d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gY29uc3QmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiBjb25zdCYp8QRVc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46Om9wZXJhdG9yKysoKfIE4wFib29sIHN0ZDo6X18yOjpvcGVyYXRvcj09PHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+IGNvbnN0Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gY29uc3QmKfMElQFzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6c2VudHJ5OjpzZW50cnkoc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mKfQEpAFzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6ZXF1YWwoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gY29uc3QmKSBjb25zdPUETXN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46OnNidW1wYygp9gRTc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1Zjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6c3B1dGMod2NoYXJfdCn3BE9zdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX29zdHJlYW0oKS4x+ARedmlydHVhbCB0aHVuayB0byBzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX29zdHJlYW0oKfkET3N0ZDo6X18yOjpiYXNpY19vc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfb3N0cmVhbSgpLjL6BGB2aXJ0dWFsIHRodW5rIHRvIHN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfb3N0cmVhbSgpLjH7BO0Bc3RkOjpfXzI6Om51bV9wdXQ8Y2hhciwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPiBjb25zdCYgc3RkOjpfXzI6OnVzZV9mYWNldDxzdGQ6Ol9fMjo6bnVtX3B1dDxjaGFyLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+ID4oc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYp/ARFc3RkOjpfXzI6OmJhc2ljX2lvczxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6ZmlsbCgpIGNvbnN0/QRKc3RkOjpfXzI6OmJhc2ljX2lvczxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6d2lkZW4oY2hhcikgY29uc3T+BE5zdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6b3BlcmF0b3I8PChzaG9ydCn/BExzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6b3BlcmF0b3I8PChpbnQpgAVWc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46Om9wZXJhdG9yPDwodW5zaWduZWQgbG9uZymBBVJzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6b3BlcmF0b3I9KGNoYXIpggVGc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnB1dChjaGFyKYMFW3N0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+OjpvcGVyYXRvcj0od2NoYXJfdCmEBXBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpiYXNpY19zdHJpbmcoY2hhciBjb25zdCophQUhc3RkOjpfXzI6Omlvc19iYXNlOjp+aW9zX2Jhc2UoKS4xhgUfc3RkOjpfXzI6Omlvc19iYXNlOjppbml0KHZvaWQqKYcFtQFzdGQ6Ol9fMjo6ZW5hYmxlX2lmPChpc19tb3ZlX2NvbnN0cnVjdGlibGU8dW5zaWduZWQgaW50Pjo6dmFsdWUpICYmIChpc19tb3ZlX2Fzc2lnbmFibGU8dW5zaWduZWQgaW50Pjo6dmFsdWUpLCB2b2lkPjo6dHlwZSBzdGQ6Ol9fMjo6c3dhcDx1bnNpZ25lZCBpbnQ+KHVuc2lnbmVkIGludCYsIHVuc2lnbmVkIGludCYpiAVZc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46Ol9fdGVzdF9mb3JfZW9mKCkgY29uc3SJBV9zdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6X190ZXN0X2Zvcl9lb2YoKSBjb25zdIoFBnVuZ2V0Y4sFIHN0ZDo6X18yOjppb3NfYmFzZTo6SW5pdDo6SW5pdCgpjAUXX19jeHhfZ2xvYmFsX2FycmF5X2R0b3KNBT9zdGQ6Ol9fMjo6X19zdGRpbmJ1ZjxjaGFyPjo6X19zdGRpbmJ1ZihfSU9fRklMRSosIF9fbWJzdGF0ZV90KimOBYoBc3RkOjpfXzI6OmJhc2ljX2lzdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OmJhc2ljX2lzdHJlYW0oc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiopjwVCc3RkOjpfXzI6Ol9fc3RkaW5idWY8d2NoYXJfdD46Ol9fc3RkaW5idWYoX0lPX0ZJTEUqLCBfX21ic3RhdGVfdCopkAWWAXN0ZDo6X18yOjpiYXNpY19pc3RyZWFtPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+OjpiYXNpY19pc3RyZWFtKHN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4qKZEFQXN0ZDo6X18yOjpfX3N0ZG91dGJ1ZjxjaGFyPjo6X19zdGRvdXRidWYoX0lPX0ZJTEUqLCBfX21ic3RhdGVfdCopkgWKAXN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpiYXNpY19vc3RyZWFtKHN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4qKZMFRHN0ZDo6X18yOjpfX3N0ZG91dGJ1Zjx3Y2hhcl90Pjo6X19zdGRvdXRidWYoX0lPX0ZJTEUqLCBfX21ic3RhdGVfdCoplAWWAXN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+OjpiYXNpY19vc3RyZWFtKHN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4qKZUFfXN0ZDo6X18yOjpiYXNpY19pb3M8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OmluaXQoc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPioplgWLAXN0ZDo6X18yOjpjb2RlY3Z0PGNoYXIsIGNoYXIsIF9fbWJzdGF0ZV90PiBjb25zdCYgc3RkOjpfXzI6OnVzZV9mYWNldDxzdGQ6Ol9fMjo6Y29kZWN2dDxjaGFyLCBjaGFyLCBfX21ic3RhdGVfdD4gPihzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JimXBZEBc3RkOjpfXzI6OmNvZGVjdnQ8d2NoYXJfdCwgY2hhciwgX19tYnN0YXRlX3Q+IGNvbnN0JiBzdGQ6Ol9fMjo6dXNlX2ZhY2V0PHN0ZDo6X18yOjpjb2RlY3Z0PHdjaGFyX3QsIGNoYXIsIF9fbWJzdGF0ZV90PiA+KHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKZgFKXN0ZDo6X18yOjpfX3N0ZGluYnVmPGNoYXI+Ojp+X19zdGRpbmJ1ZigpmQU6c3RkOjpfXzI6Ol9fc3RkaW5idWY8Y2hhcj46OmltYnVlKHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKZoFJ3N0ZDo6X18yOjpfX3N0ZGluYnVmPGNoYXI+Ojp1bmRlcmZsb3coKZsFK3N0ZDo6X18yOjpfX3N0ZGluYnVmPGNoYXI+OjpfX2dldGNoYXIoYm9vbCmcBSNzdGQ6Ol9fMjo6X19zdGRpbmJ1ZjxjaGFyPjo6dWZsb3coKZ0FKnN0ZDo6X18yOjpfX3N0ZGluYnVmPGNoYXI+OjpwYmFja2ZhaWwoaW50KZ4FLHN0ZDo6X18yOjpfX3N0ZGluYnVmPHdjaGFyX3Q+Ojp+X19zdGRpbmJ1ZigpnwU9c3RkOjpfXzI6Ol9fc3RkaW5idWY8d2NoYXJfdD46OmltYnVlKHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKaAFKnN0ZDo6X18yOjpfX3N0ZGluYnVmPHdjaGFyX3Q+Ojp1bmRlcmZsb3coKaEFLnN0ZDo6X18yOjpfX3N0ZGluYnVmPHdjaGFyX3Q+OjpfX2dldGNoYXIoYm9vbCmiBSZzdGQ6Ol9fMjo6X19zdGRpbmJ1Zjx3Y2hhcl90Pjo6dWZsb3coKaMFNnN0ZDo6X18yOjpfX3N0ZGluYnVmPHdjaGFyX3Q+OjpwYmFja2ZhaWwodW5zaWduZWQgaW50KaQFO3N0ZDo6X18yOjpfX3N0ZG91dGJ1ZjxjaGFyPjo6aW1idWUoc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYppQUjc3RkOjpfXzI6Ol9fc3Rkb3V0YnVmPGNoYXI+OjpzeW5jKCmmBTZzdGQ6Ol9fMjo6X19zdGRvdXRidWY8Y2hhcj46OnhzcHV0bihjaGFyIGNvbnN0KiwgbG9uZymnBSpzdGQ6Ol9fMjo6X19zdGRvdXRidWY8Y2hhcj46Om92ZXJmbG93KGludCmoBT5zdGQ6Ol9fMjo6X19zdGRvdXRidWY8d2NoYXJfdD46OmltYnVlKHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKakFPHN0ZDo6X18yOjpfX3N0ZG91dGJ1Zjx3Y2hhcl90Pjo6eHNwdXRuKHdjaGFyX3QgY29uc3QqLCBsb25nKaoFNnN0ZDo6X18yOjpfX3N0ZG91dGJ1Zjx3Y2hhcl90Pjo6b3ZlcmZsb3codW5zaWduZWQgaW50KasFB19fc2hsaW2sBQhfX3NoZ2V0Y60FCF9fbXVsdGkzrgUJX19pbnRzY2FurwUHbWJydG93Y7AFDV9fZXh0ZW5kc2Z0ZjKxBQhfX211bHRmM7IFC19fZmxvYXRzaXRmswUIX19hZGR0ZjO0BQ1fX2V4dGVuZGRmdGYytQUHX19sZXRmMrYFB19fZ2V0ZjK3BQljb3B5c2lnbmy4BQ1fX2Zsb2F0dW5zaXRmuQUIX19zdWJ0ZjO6BQdzY2FsYm5suwUIX19kaXZ0ZjO8BQtfX2Zsb2F0c2Nhbr0FCGhleGZsb2F0vgUIZGVjZmxvYXS/BQdzY2FuZXhwwAUMX190cnVuY3Rmc2YywQUHdmZzY2FuZsIFBWFyZ19uwwUJc3RvcmVfaW50xAUNX19zdHJpbmdfcmVhZMUFB3Zzc2NhbmbGBQdkb19yZWFkxwUGc3RyY21wyAUgX19lbXNjcmlwdGVuX2Vudmlyb25fY29uc3RydWN0b3LJBQdzdHJuY21wygUGZ2V0ZW52ywUIX19tdW5tYXDMBQxfX2dldF9sb2NhbGXNBQtfX25ld2xvY2FsZc4FCXZhc3ByaW50Zs8FBnNzY2FuZtAFCHNucHJpbnRm0QUKZnJlZWxvY2FsZdIFBndjc2xlbtMFCXdjc3J0b21ic9QFCndjc25ydG9tYnPVBQltYnNydG93Y3PWBQptYnNucnRvd2Nz1wUGc3RydG942AUKc3RydG91bGxfbNkFCXN0cnRvbGxfbNoFBnN0cnRvZtsFCHN0cnRveC4x3AUGc3RydG9k3QUHc3RydG9sZN4FCXN0cnRvbGRfbN8FXXN0ZDo6X18yOjpjb2xsYXRlPGNoYXI+Ojpkb19jb21wYXJlKGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqKSBjb25zdOAFRXN0ZDo6X18yOjpjb2xsYXRlPGNoYXI+Ojpkb190cmFuc2Zvcm0oY2hhciBjb25zdCosIGNoYXIgY29uc3QqKSBjb25zdOEFzwFzdGQ6Ol9fMjo6ZW5hYmxlX2lmPF9faXNfZm9yd2FyZF9pdGVyYXRvcjxjaGFyIGNvbnN0Kj46OnZhbHVlLCB2b2lkPjo6dHlwZSBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpfX2luaXQ8Y2hhciBjb25zdCo+KGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiniBUBzdGQ6Ol9fMjo6Y29sbGF0ZTxjaGFyPjo6ZG9faGFzaChjaGFyIGNvbnN0KiwgY2hhciBjb25zdCopIGNvbnN04wVsc3RkOjpfXzI6OmNvbGxhdGU8d2NoYXJfdD46OmRvX2NvbXBhcmUod2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdCopIGNvbnN05AVOc3RkOjpfXzI6OmNvbGxhdGU8d2NoYXJfdD46OmRvX3RyYW5zZm9ybSh3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdCopIGNvbnN05QXkAXN0ZDo6X18yOjplbmFibGVfaWY8X19pc19mb3J3YXJkX2l0ZXJhdG9yPHdjaGFyX3QgY29uc3QqPjo6dmFsdWUsIHZvaWQ+Ojp0eXBlIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID46Ol9faW5pdDx3Y2hhcl90IGNvbnN0Kj4od2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqKeYFSXN0ZDo6X18yOjpjb2xsYXRlPHdjaGFyX3Q+Ojpkb19oYXNoKHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0KikgY29uc3TnBZoCc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgYm9vbCYpIGNvbnN06AVnc3RkOjpfXzI6Om51bXB1bmN0PGNoYXI+IGNvbnN0JiBzdGQ6Ol9fMjo6dXNlX2ZhY2V0PHN0ZDo6X18yOjpudW1wdW5jdDxjaGFyPiA+KHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKekFpAVzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0KiBzdGQ6Ol9fMjo6X19zY2FuX2tleXdvcmQ8c3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QqLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0Kiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCosIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYsIHVuc2lnbmVkIGludCYsIGJvb2wp6gU4c3RkOjpfXzI6OmxvY2FsZTo6dXNlX2ZhY2V0KHN0ZDo6X18yOjpsb2NhbGU6OmlkJikgY29uc3TrBcwBc3RkOjpfXzI6OnVuaXF1ZV9wdHI8dW5zaWduZWQgY2hhciwgdm9pZCAoKikodm9pZCopPjo6dW5pcXVlX3B0cjx0cnVlLCB2b2lkPih1bnNpZ25lZCBjaGFyKiwgc3RkOjpfXzI6Ol9fZGVwZW5kZW50X3R5cGU8c3RkOjpfXzI6Ol9fdW5pcXVlX3B0cl9kZWxldGVyX3NmaW5hZTx2b2lkICgqKSh2b2lkKik+LCB0cnVlPjo6X19nb29kX3J2YWxfcmVmX3R5cGUp7AWaAnN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGxvbmcmKSBjb25zdO0F6wJzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiBzdGQ6Ol9fMjo6bnVtX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2RvX2dldF9zaWduZWQ8bG9uZz4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBsb25nJikgY29uc3TuBTlzdGQ6Ol9fMjo6X19udW1fZ2V0X2Jhc2U6Ol9fZ2V0X2Jhc2Uoc3RkOjpfXzI6Omlvc19iYXNlJinvBUhzdGQ6Ol9fMjo6X19udW1fZ2V0PGNoYXI+OjpfX3N0YWdlMl9pbnRfcHJlcChzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCBjaGFyJinwBWVzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpiYXNpY19zdHJpbmcoKfEFbHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OnJlc2l6ZSh1bnNpZ25lZCBsb25nKfIF5QFzdGQ6Ol9fMjo6X19udW1fZ2V0PGNoYXI+OjpfX3N0YWdlMl9pbnRfbG9vcChjaGFyLCBpbnQsIGNoYXIqLCBjaGFyKiYsIHVuc2lnbmVkIGludCYsIGNoYXIsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QmLCB1bnNpZ25lZCBpbnQqLCB1bnNpZ25lZCBpbnQqJiwgY2hhciBjb25zdCop8wVcbG9uZyBzdGQ6Ol9fMjo6X19udW1fZ2V0X3NpZ25lZF9pbnRlZ3JhbDxsb25nPihjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGludCYsIGludCn0BaUBc3RkOjpfXzI6Ol9fY2hlY2tfZ3JvdXBpbmcoc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCYsIHVuc2lnbmVkIGludCosIHVuc2lnbmVkIGludCosIHVuc2lnbmVkIGludCYp9QWfAnN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGxvbmcgbG9uZyYpIGNvbnN09gX1AnN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+IHN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZG9fZ2V0X3NpZ25lZDxsb25nIGxvbmc+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgbG9uZyBsb25nJikgY29uc3T3BWZsb25nIGxvbmcgc3RkOjpfXzI6Ol9fbnVtX2dldF9zaWduZWRfaW50ZWdyYWw8bG9uZyBsb25nPihjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGludCYsIGludCn4BaQCc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdW5zaWduZWQgc2hvcnQmKSBjb25zdPkFgQNzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiBzdGQ6Ol9fMjo6bnVtX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2RvX2dldF91bnNpZ25lZDx1bnNpZ25lZCBzaG9ydD4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB1bnNpZ25lZCBzaG9ydCYpIGNvbnN0+gVydW5zaWduZWQgc2hvcnQgc3RkOjpfXzI6Ol9fbnVtX2dldF91bnNpZ25lZF9pbnRlZ3JhbDx1bnNpZ25lZCBzaG9ydD4oY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBpbnQmLCBpbnQp+wWiAnN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHVuc2lnbmVkIGludCYpIGNvbnN0/AX9AnN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+IHN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZG9fZ2V0X3Vuc2lnbmVkPHVuc2lnbmVkIGludD4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB1bnNpZ25lZCBpbnQmKSBjb25zdP0FbnVuc2lnbmVkIGludCBzdGQ6Ol9fMjo6X19udW1fZ2V0X3Vuc2lnbmVkX2ludGVncmFsPHVuc2lnbmVkIGludD4oY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBpbnQmLCBpbnQp/gWoAnN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHVuc2lnbmVkIGxvbmcgbG9uZyYpIGNvbnN0/wWJA3N0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+IHN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZG9fZ2V0X3Vuc2lnbmVkPHVuc2lnbmVkIGxvbmcgbG9uZz4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB1bnNpZ25lZCBsb25nIGxvbmcmKSBjb25zdIAGenVuc2lnbmVkIGxvbmcgbG9uZyBzdGQ6Ol9fMjo6X19udW1fZ2V0X3Vuc2lnbmVkX2ludGVncmFsPHVuc2lnbmVkIGxvbmcgbG9uZz4oY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBpbnQmLCBpbnQpgQabAnN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGZsb2F0JikgY29uc3SCBvUCc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19kb19nZXRfZmxvYXRpbmdfcG9pbnQ8ZmxvYXQ+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgZmxvYXQmKSBjb25zdIMGWHN0ZDo6X18yOjpfX251bV9nZXQ8Y2hhcj46Ol9fc3RhZ2UyX2Zsb2F0X3ByZXAoc3RkOjpfXzI6Omlvc19iYXNlJiwgY2hhciosIGNoYXImLCBjaGFyJimEBvABc3RkOjpfXzI6Ol9fbnVtX2dldDxjaGFyPjo6X19zdGFnZTJfZmxvYXRfbG9vcChjaGFyLCBib29sJiwgY2hhciYsIGNoYXIqLCBjaGFyKiYsIGNoYXIsIGNoYXIsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QmLCB1bnNpZ25lZCBpbnQqLCB1bnNpZ25lZCBpbnQqJiwgdW5zaWduZWQgaW50JiwgY2hhciophQZPZmxvYXQgc3RkOjpfXzI6Ol9fbnVtX2dldF9mbG9hdDxmbG9hdD4oY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBpbnQmKYYGnAJzdGQ6Ol9fMjo6bnVtX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBkb3VibGUmKSBjb25zdIcG9wJzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiBzdGQ6Ol9fMjo6bnVtX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2RvX2dldF9mbG9hdGluZ19wb2ludDxkb3VibGU+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgZG91YmxlJikgY29uc3SIBlFkb3VibGUgc3RkOjpfXzI6Ol9fbnVtX2dldF9mbG9hdDxkb3VibGU+KGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgaW50JimJBqECc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgbG9uZyBkb3VibGUmKSBjb25zdIoGgQNzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiBzdGQ6Ol9fMjo6bnVtX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2RvX2dldF9mbG9hdGluZ19wb2ludDxsb25nIGRvdWJsZT4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBsb25nIGRvdWJsZSYpIGNvbnN0iwZbbG9uZyBkb3VibGUgc3RkOjpfXzI6Ol9fbnVtX2dldF9mbG9hdDxsb25nIGRvdWJsZT4oY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBpbnQmKYwGmwJzdGQ6Ol9fMjo6bnVtX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB2b2lkKiYpIGNvbnN0jQYSc3RkOjpfXzI6Ol9fY2xvYygpjgZMc3RkOjpfXzI6Ol9fbGliY3BwX3NzY2FuZl9sKGNoYXIgY29uc3QqLCBfX2xvY2FsZV9zdHJ1Y3QqLCBjaGFyIGNvbnN0KiwgLi4uKY8GX3N0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46Ol9femVybygpkAZUY2hhciBjb25zdCogc3RkOjpfXzI6OmZpbmQ8Y2hhciBjb25zdCosIGNoYXI+KGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdCYpkQZJc3RkOjpfXzI6Ol9fbGliY3BwX2xvY2FsZV9ndWFyZDo6X19saWJjcHBfbG9jYWxlX2d1YXJkKF9fbG9jYWxlX3N0cnVjdComKZIGrwJzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBib29sJikgY29uc3STBm1zdGQ6Ol9fMjo6bnVtcHVuY3Q8d2NoYXJfdD4gY29uc3QmIHN0ZDo6X18yOjp1c2VfZmFjZXQ8c3RkOjpfXzI6Om51bXB1bmN0PHdjaGFyX3Q+ID4oc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYplAbgBXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4gY29uc3QqIHN0ZDo6X18yOjpfX3NjYW5fa2V5d29yZDxzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiBjb25zdCosIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiA+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4gY29uc3QqLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+IGNvbnN0Kiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JiwgdW5zaWduZWQgaW50JiwgYm9vbCmVBq8Cc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgbG9uZyYpIGNvbnN0lgaGA3N0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+IHN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZG9fZ2V0X3NpZ25lZDxsb25nPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGxvbmcmKSBjb25zdJcGTXN0ZDo6X18yOjpfX251bV9nZXQ8d2NoYXJfdD46Ol9fZG9fd2lkZW4oc3RkOjpfXzI6Omlvc19iYXNlJiwgd2NoYXJfdCopIGNvbnN0mAZOc3RkOjpfXzI6Ol9fbnVtX2dldDx3Y2hhcl90Pjo6X19zdGFnZTJfaW50X3ByZXAoc3RkOjpfXzI6Omlvc19iYXNlJiwgd2NoYXJfdCYpmQbxAXN0ZDo6X18yOjpfX251bV9nZXQ8d2NoYXJfdD46Ol9fc3RhZ2UyX2ludF9sb29wKHdjaGFyX3QsIGludCwgY2hhciosIGNoYXIqJiwgdW5zaWduZWQgaW50Jiwgd2NoYXJfdCwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCYsIHVuc2lnbmVkIGludCosIHVuc2lnbmVkIGludComLCB3Y2hhcl90IGNvbnN0KimaBrQCc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgbG9uZyBsb25nJikgY29uc3SbBpADc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19kb19nZXRfc2lnbmVkPGxvbmcgbG9uZz4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBsb25nIGxvbmcmKSBjb25zdJwGuQJzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB1bnNpZ25lZCBzaG9ydCYpIGNvbnN0nQacA3N0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+IHN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZG9fZ2V0X3Vuc2lnbmVkPHVuc2lnbmVkIHNob3J0PihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHVuc2lnbmVkIHNob3J0JikgY29uc3SeBrcCc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdW5zaWduZWQgaW50JikgY29uc3SfBpgDc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19kb19nZXRfdW5zaWduZWQ8dW5zaWduZWQgaW50PihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHVuc2lnbmVkIGludCYpIGNvbnN0oAa9AnN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHVuc2lnbmVkIGxvbmcgbG9uZyYpIGNvbnN0oQakA3N0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+IHN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZG9fZ2V0X3Vuc2lnbmVkPHVuc2lnbmVkIGxvbmcgbG9uZz4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB1bnNpZ25lZCBsb25nIGxvbmcmKSBjb25zdKIGsAJzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBmbG9hdCYpIGNvbnN0owaQA3N0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+IHN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZG9fZ2V0X2Zsb2F0aW5nX3BvaW50PGZsb2F0PihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGZsb2F0JikgY29uc3SkBmRzdGQ6Ol9fMjo6X19udW1fZ2V0PHdjaGFyX3Q+OjpfX3N0YWdlMl9mbG9hdF9wcmVwKHN0ZDo6X18yOjppb3NfYmFzZSYsIHdjaGFyX3QqLCB3Y2hhcl90Jiwgd2NoYXJfdCYppQb/AXN0ZDo6X18yOjpfX251bV9nZXQ8d2NoYXJfdD46Ol9fc3RhZ2UyX2Zsb2F0X2xvb3Aod2NoYXJfdCwgYm9vbCYsIGNoYXImLCBjaGFyKiwgY2hhciomLCB3Y2hhcl90LCB3Y2hhcl90LCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0JiwgdW5zaWduZWQgaW50KiwgdW5zaWduZWQgaW50KiYsIHVuc2lnbmVkIGludCYsIHdjaGFyX3QqKaYGsQJzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBkb3VibGUmKSBjb25zdKcGkgNzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiBzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2RvX2dldF9mbG9hdGluZ19wb2ludDxkb3VibGU+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgZG91YmxlJikgY29uc3SoBrYCc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgbG9uZyBkb3VibGUmKSBjb25zdKkGnANzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiBzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2RvX2dldF9mbG9hdGluZ19wb2ludDxsb25nIGRvdWJsZT4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBsb25nIGRvdWJsZSYpIGNvbnN0qgawAnN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHZvaWQqJikgY29uc3SrBmZ3Y2hhcl90IGNvbnN0KiBzdGQ6Ol9fMjo6ZmluZDx3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdD4od2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0JimsBmd3Y2hhcl90IGNvbnN0KiBzdGQ6Ol9fMjo6X19udW1fZ2V0PHdjaGFyX3Q+OjpfX2RvX3dpZGVuX3A8d2NoYXJfdD4oc3RkOjpfXzI6Omlvc19iYXNlJiwgd2NoYXJfdCopIGNvbnN0rQbNAXN0ZDo6X18yOjpudW1fcHV0PGNoYXIsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgY2hhciwgYm9vbCkgY29uc3SuBl5zdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpiZWdpbigprwZcc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6ZW5kKCmwBs0Bc3RkOjpfXzI6Om51bV9wdXQ8Y2hhciwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCBjaGFyLCBsb25nKSBjb25zdLEGTnN0ZDo6X18yOjpfX251bV9wdXRfYmFzZTo6X19mb3JtYXRfaW50KGNoYXIqLCBjaGFyIGNvbnN0KiwgYm9vbCwgdW5zaWduZWQgaW50KbIGV3N0ZDo6X18yOjpfX2xpYmNwcF9zbnByaW50Zl9sKGNoYXIqLCB1bnNpZ25lZCBsb25nLCBfX2xvY2FsZV9zdHJ1Y3QqLCBjaGFyIGNvbnN0KiwgLi4uKbMGVXN0ZDo6X18yOjpfX251bV9wdXRfYmFzZTo6X19pZGVudGlmeV9wYWRkaW5nKGNoYXIqLCBjaGFyKiwgc3RkOjpfXzI6Omlvc19iYXNlIGNvbnN0Jim0BnVzdGQ6Ol9fMjo6X19udW1fcHV0PGNoYXI+OjpfX3dpZGVuX2FuZF9ncm91cF9pbnQoY2hhciosIGNoYXIqLCBjaGFyKiwgY2hhciosIGNoYXIqJiwgY2hhciomLCBzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0Jim1Bit2b2lkIHN0ZDo6X18yOjpyZXZlcnNlPGNoYXIqPihjaGFyKiwgY2hhcioptgYhc3RkOjpfXzI6Omlvc19iYXNlOjp3aWR0aCgpIGNvbnN0twbSAXN0ZDo6X18yOjpudW1fcHV0PGNoYXIsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgY2hhciwgbG9uZyBsb25nKSBjb25zdLgG1gFzdGQ6Ol9fMjo6bnVtX3B1dDxjaGFyLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIGNoYXIsIHVuc2lnbmVkIGxvbmcpIGNvbnN0uQbbAXN0ZDo6X18yOjpudW1fcHV0PGNoYXIsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgY2hhciwgdW5zaWduZWQgbG9uZyBsb25nKSBjb25zdLoGzwFzdGQ6Ol9fMjo6bnVtX3B1dDxjaGFyLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIGNoYXIsIGRvdWJsZSkgY29uc3S7BkpzdGQ6Ol9fMjo6X19udW1fcHV0X2Jhc2U6Ol9fZm9ybWF0X2Zsb2F0KGNoYXIqLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgaW50KbwGJXN0ZDo6X18yOjppb3NfYmFzZTo6cHJlY2lzaW9uKCkgY29uc3S9BklzdGQ6Ol9fMjo6X19saWJjcHBfYXNwcmludGZfbChjaGFyKiosIF9fbG9jYWxlX3N0cnVjdCosIGNoYXIgY29uc3QqLCAuLi4pvgZ3c3RkOjpfXzI6Ol9fbnVtX3B1dDxjaGFyPjo6X193aWRlbl9hbmRfZ3JvdXBfZmxvYXQoY2hhciosIGNoYXIqLCBjaGFyKiwgY2hhciosIGNoYXIqJiwgY2hhciomLCBzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0Jim/BtQBc3RkOjpfXzI6Om51bV9wdXQ8Y2hhciwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCBjaGFyLCBsb25nIGRvdWJsZSkgY29uc3TABtQBc3RkOjpfXzI6Om51bV9wdXQ8Y2hhciwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCBjaGFyLCB2b2lkIGNvbnN0KikgY29uc3TBBt8Bc3RkOjpfXzI6Om51bV9wdXQ8d2NoYXJfdCwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90LCBib29sKSBjb25zdMIGZXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID46OmVuZCgpwwbfAXN0ZDo6X18yOjpudW1fcHV0PHdjaGFyX3QsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgd2NoYXJfdCwgbG9uZykgY29uc3TEBoEBc3RkOjpfXzI6Ol9fbnVtX3B1dDx3Y2hhcl90Pjo6X193aWRlbl9hbmRfZ3JvdXBfaW50KGNoYXIqLCBjaGFyKiwgY2hhciosIHdjaGFyX3QqLCB3Y2hhcl90KiYsIHdjaGFyX3QqJiwgc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYpxQajAnN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+IHN0ZDo6X18yOjpfX3BhZF9hbmRfb3V0cHV0PHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqLCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90KcYGNHZvaWQgc3RkOjpfXzI6OnJldmVyc2U8d2NoYXJfdCo+KHdjaGFyX3QqLCB3Y2hhcl90KinHBoQBc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6YmFzaWNfc3RyaW5nKHVuc2lnbmVkIGxvbmcsIHdjaGFyX3QpyAbkAXN0ZDo6X18yOjpudW1fcHV0PHdjaGFyX3QsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgd2NoYXJfdCwgbG9uZyBsb25nKSBjb25zdMkG6AFzdGQ6Ol9fMjo6bnVtX3B1dDx3Y2hhcl90LCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHdjaGFyX3QsIHVuc2lnbmVkIGxvbmcpIGNvbnN0ygbtAXN0ZDo6X18yOjpudW1fcHV0PHdjaGFyX3QsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgd2NoYXJfdCwgdW5zaWduZWQgbG9uZyBsb25nKSBjb25zdMsG4QFzdGQ6Ol9fMjo6bnVtX3B1dDx3Y2hhcl90LCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHdjaGFyX3QsIGRvdWJsZSkgY29uc3TMBoMBc3RkOjpfXzI6Ol9fbnVtX3B1dDx3Y2hhcl90Pjo6X193aWRlbl9hbmRfZ3JvdXBfZmxvYXQoY2hhciosIGNoYXIqLCBjaGFyKiwgd2NoYXJfdCosIHdjaGFyX3QqJiwgd2NoYXJfdComLCBzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JinNBuYBc3RkOjpfXzI6Om51bV9wdXQ8d2NoYXJfdCwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90LCBsb25nIGRvdWJsZSkgY29uc3TOBuYBc3RkOjpfXzI6Om51bV9wdXQ8d2NoYXJfdCwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90LCB2b2lkIGNvbnN0KikgY29uc3TPBlN2b2lkIHN0ZDo6X18yOjpfX3JldmVyc2U8Y2hhcio+KGNoYXIqLCBjaGFyKiwgc3RkOjpfXzI6OnJhbmRvbV9hY2Nlc3NfaXRlcmF0b3JfdGFnKdAGXHZvaWQgc3RkOjpfXzI6Ol9fcmV2ZXJzZTx3Y2hhcl90Kj4od2NoYXJfdCosIHdjaGFyX3QqLCBzdGQ6Ol9fMjo6cmFuZG9tX2FjY2Vzc19pdGVyYXRvcl90YWcp0QawAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpnZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB0bSosIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KikgY29uc3TSBnNzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZGF0ZV9vcmRlcigpIGNvbnN00waeAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXRfdGltZShzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHRtKikgY29uc3TUBp4Cc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldF9kYXRlKHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdG0qKSBjb25zdNUGoQJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0X3dlZWtkYXkoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB0bSopIGNvbnN01gavAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2dldF93ZWVrZGF5bmFtZShpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdNcGowJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0X21vbnRobmFtZShzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHRtKikgY29uc3TYBq0Cc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0X21vbnRobmFtZShpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdNkGngJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0X3llYXIoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB0bSopIGNvbnN02gaoAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2dldF95ZWFyKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYpIGNvbnN02walAmludCBzdGQ6Ol9fMjo6X19nZXRfdXBfdG9fbl9kaWdpdHM8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmLCBpbnQp3AalAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB0bSosIGNoYXIsIGNoYXIpIGNvbnN03QalAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2dldF9wZXJjZW50KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYpIGNvbnN03ganAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2dldF9kYXkoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JikgY29uc3TfBqgCc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0X2hvdXIoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JikgY29uc3TgBqsCc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0XzEyX2hvdXIoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JikgY29uc3ThBrACc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0X2RheV95ZWFyX251bShpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdOIGqQJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfbW9udGgoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JikgY29uc3TjBqoCc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0X21pbnV0ZShpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdOQGqQJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfd2hpdGVfc3BhY2Uoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JikgY29uc3TlBqkCc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0X2FtX3BtKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYpIGNvbnN05gaqAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2dldF9zZWNvbmQoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JikgY29uc3TnBqsCc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0X3dlZWtkYXkoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JikgY29uc3ToBqkCc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0X3llYXI0KGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYpIGNvbnN06QbLAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpnZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB0bSosIHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0KikgY29uc3TqBrMCc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldF90aW1lKHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdG0qKSBjb25zdOsGswJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0X2RhdGUoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB0bSopIGNvbnN07Aa2AnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXRfd2Vla2RheShzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHRtKikgY29uc3TtBscCc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZ2V0X3dlZWtkYXluYW1lKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN07ga4AnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXRfbW9udGhuYW1lKHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdG0qKSBjb25zdO8GxQJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfbW9udGhuYW1lKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN08AazAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXRfeWVhcihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHRtKikgY29uc3TxBsACc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZ2V0X3llYXIoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JikgY29uc3TyBr0CaW50IHN0ZDo6X18yOjpfX2dldF91cF90b19uX2RpZ2l0czx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYsIGludCnzBroCc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHRtKiwgY2hhciwgY2hhcikgY29uc3T0Br0Cc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZ2V0X3BlcmNlbnQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JikgY29uc3T1Br8Cc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZ2V0X2RheShpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmKSBjb25zdPYGwAJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfaG91cihpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmKSBjb25zdPcGwwJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfMTJfaG91cihpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmKSBjb25zdPgGyAJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfZGF5X3llYXJfbnVtKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN0+QbBAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF9tb250aChpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmKSBjb25zdPoGwgJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfbWludXRlKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN0+wbBAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF93aGl0ZV9zcGFjZShzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmKSBjb25zdPwGwQJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfYW1fcG0oaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JikgY29uc3T9BsICc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZ2V0X3NlY29uZChpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmKSBjb25zdP4GwwJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfd2Vla2RheShpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmKSBjb25zdP8GwQJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfeWVhcjQoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JikgY29uc3SAB98Bc3RkOjpfXzI6OnRpbWVfcHV0PGNoYXIsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgY2hhciwgdG0gY29uc3QqLCBjaGFyLCBjaGFyKSBjb25zdIEHSnN0ZDo6X18yOjpfX3RpbWVfcHV0OjpfX2RvX3B1dChjaGFyKiwgY2hhciomLCB0bSBjb25zdCosIGNoYXIsIGNoYXIpIGNvbnN0ggeNAXN0ZDo6X18yOjplbmFibGVfaWY8KGlzX21vdmVfY29uc3RydWN0aWJsZTxjaGFyPjo6dmFsdWUpICYmIChpc19tb3ZlX2Fzc2lnbmFibGU8Y2hhcj46OnZhbHVlKSwgdm9pZD46OnR5cGUgc3RkOjpfXzI6OnN3YXA8Y2hhcj4oY2hhciYsIGNoYXImKYMH7gFzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiBzdGQ6Ol9fMjo6X19jb3B5PGNoYXIqLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+KGNoYXIqLCBjaGFyKiwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4phAfxAXN0ZDo6X18yOjp0aW1lX3B1dDx3Y2hhcl90LCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHdjaGFyX3QsIHRtIGNvbnN0KiwgY2hhciwgY2hhcikgY29uc3SFB1BzdGQ6Ol9fMjo6X190aW1lX3B1dDo6X19kb19wdXQod2NoYXJfdCosIHdjaGFyX3QqJiwgdG0gY29uc3QqLCBjaGFyLCBjaGFyKSBjb25zdIYHZXN0ZDo6X18yOjpfX2xpYmNwcF9tYnNydG93Y3NfbCh3Y2hhcl90KiwgY2hhciBjb25zdCoqLCB1bnNpZ25lZCBsb25nLCBfX21ic3RhdGVfdCosIF9fbG9jYWxlX3N0cnVjdCophwcsc3RkOjpfXzI6Ol9fdGhyb3dfcnVudGltZV9lcnJvcihjaGFyIGNvbnN0KimIB4kCc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gc3RkOjpfXzI6Ol9fY29weTx3Y2hhcl90Kiwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPih3Y2hhcl90Kiwgd2NoYXJfdCosIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+KYkHO3N0ZDo6X18yOjptb25leXB1bmN0PGNoYXIsIGZhbHNlPjo6ZG9fZGVjaW1hbF9wb2ludCgpIGNvbnN0igc2c3RkOjpfXzI6Om1vbmV5cHVuY3Q8Y2hhciwgZmFsc2U+Ojpkb19ncm91cGluZygpIGNvbnN0iwc7c3RkOjpfXzI6Om1vbmV5cHVuY3Q8Y2hhciwgZmFsc2U+Ojpkb19uZWdhdGl2ZV9zaWduKCkgY29uc3SMBzhzdGQ6Ol9fMjo6bW9uZXlwdW5jdDxjaGFyLCBmYWxzZT46OmRvX3Bvc19mb3JtYXQoKSBjb25zdI0HPnN0ZDo6X18yOjptb25leXB1bmN0PHdjaGFyX3QsIGZhbHNlPjo6ZG9fZGVjaW1hbF9wb2ludCgpIGNvbnN0jgc+c3RkOjpfXzI6Om1vbmV5cHVuY3Q8d2NoYXJfdCwgZmFsc2U+Ojpkb19uZWdhdGl2ZV9zaWduKCkgY29uc3SPB6kCc3RkOjpfXzI6Om1vbmV5X2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBib29sLCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBsb25nIGRvdWJsZSYpIGNvbnN0kAeMA3N0ZDo6X18yOjptb25leV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19kb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgYm9vbCwgc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50JiwgYm9vbCYsIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYsIHN0ZDo6X18yOjp1bmlxdWVfcHRyPGNoYXIsIHZvaWQgKCopKHZvaWQqKT4mLCBjaGFyKiYsIGNoYXIqKZEH3QNzdGQ6Ol9fMjo6X19tb25leV9nZXQ8Y2hhcj46Ol9fZ2F0aGVyX2luZm8oYm9vbCwgc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYsIHN0ZDo6X18yOjptb25leV9iYXNlOjpwYXR0ZXJuJiwgY2hhciYsIGNoYXImLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+JiwgaW50JimSB1JzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6b3BlcmF0b3IrKyhpbnQpkwdmdm9pZCBzdGQ6Ol9fMjo6X19kb3VibGVfb3Jfbm90aGluZzxjaGFyPihzdGQ6Ol9fMjo6dW5pcXVlX3B0cjxjaGFyLCB2b2lkICgqKSh2b2lkKik+JiwgY2hhciomLCBjaGFyKiYplAeGAXZvaWQgc3RkOjpfXzI6Ol9fZG91YmxlX29yX25vdGhpbmc8dW5zaWduZWQgaW50PihzdGQ6Ol9fMjo6dW5pcXVlX3B0cjx1bnNpZ25lZCBpbnQsIHZvaWQgKCopKHZvaWQqKT4mLCB1bnNpZ25lZCBpbnQqJiwgdW5zaWduZWQgaW50KiYplQfzAnN0ZDo6X18yOjptb25leV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgYm9vbCwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiYpIGNvbnN0lgdec3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6Y2xlYXIoKZcH2gFzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+JiBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpfX2FwcGVuZF9mb3J3YXJkX3Vuc2FmZTxjaGFyKj4oY2hhciosIGNoYXIqKZgHd3N0ZDo6X18yOjptb25leXB1bmN0PGNoYXIsIHRydWU+IGNvbnN0JiBzdGQ6Ol9fMjo6dXNlX2ZhY2V0PHN0ZDo6X18yOjptb25leXB1bmN0PGNoYXIsIHRydWU+ID4oc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYpmQe5AXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46Om9wZXJhdG9yPShzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+JiYpmgd5c3RkOjpfXzI6Om1vbmV5cHVuY3Q8Y2hhciwgZmFsc2U+IGNvbnN0JiBzdGQ6Ol9fMjo6dXNlX2ZhY2V0PHN0ZDo6X18yOjptb25leXB1bmN0PGNoYXIsIGZhbHNlPiA+KHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKZsH7wFib29sIHN0ZDo6X18yOjplcXVhbDxzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8Y2hhcio+LCBzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8Y2hhcio+LCBzdGQ6Ol9fMjo6X19lcXVhbF90bzxjaGFyLCBjaGFyPiA+KHN0ZDo6X18yOjpfX3dyYXBfaXRlcjxjaGFyKj4sIHN0ZDo6X18yOjpfX3dyYXBfaXRlcjxjaGFyKj4sIHN0ZDo6X18yOjpfX3dyYXBfaXRlcjxjaGFyKj4sIHN0ZDo6X18yOjpfX2VxdWFsX3RvPGNoYXIsIGNoYXI+KZwHM3N0ZDo6X18yOjpfX3dyYXBfaXRlcjxjaGFyKj46Om9wZXJhdG9yKyhsb25nKSBjb25zdJ0HZXN0ZDo6X18yOjp1bmlxdWVfcHRyPGNoYXIsIHZvaWQgKCopKHZvaWQqKT46Om9wZXJhdG9yPShzdGQ6Ol9fMjo6dW5pcXVlX3B0cjxjaGFyLCB2b2lkICgqKSh2b2lkKik+JiYpnge+AnN0ZDo6X18yOjptb25leV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgYm9vbCwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgbG9uZyBkb3VibGUmKSBjb25zdJ8HrQNzdGQ6Ol9fMjo6bW9uZXlfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIGJvb2wsIHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmLCB1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCYsIGJvb2wmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmLCBzdGQ6Ol9fMjo6dW5pcXVlX3B0cjx3Y2hhcl90LCB2b2lkICgqKSh2b2lkKik+Jiwgd2NoYXJfdComLCB3Y2hhcl90KimgB4EEc3RkOjpfXzI6Ol9fbW9uZXlfZ2V0PHdjaGFyX3Q+OjpfX2dhdGhlcl9pbmZvKGJvb2wsIHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmLCBzdGQ6Ol9fMjo6bW9uZXlfYmFzZTo6cGF0dGVybiYsIHdjaGFyX3QmLCB3Y2hhcl90Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiYsIGludCYpoQdYc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46Om9wZXJhdG9yKysoaW50KaIHkQNzdGQ6Ol9fMjo6bW9uZXlfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIGJvb2wsIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4mKSBjb25zdKMHZ3N0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID46OmNsZWFyKCmkB/UBc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiYgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6X19hcHBlbmRfZm9yd2FyZF91bnNhZmU8d2NoYXJfdCo+KHdjaGFyX3QqLCB3Y2hhcl90KimlB31zdGQ6Ol9fMjo6bW9uZXlwdW5jdDx3Y2hhcl90LCB0cnVlPiBjb25zdCYgc3RkOjpfXzI6OnVzZV9mYWNldDxzdGQ6Ol9fMjo6bW9uZXlwdW5jdDx3Y2hhcl90LCB0cnVlPiA+KHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKaYHywFzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+OjpvcGVyYXRvcj0oc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiYmKacHf3N0ZDo6X18yOjptb25leXB1bmN0PHdjaGFyX3QsIGZhbHNlPiBjb25zdCYgc3RkOjpfXzI6OnVzZV9mYWNldDxzdGQ6Ol9fMjo6bW9uZXlwdW5jdDx3Y2hhcl90LCBmYWxzZT4gPihzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JimoB4oCYm9vbCBzdGQ6Ol9fMjo6ZXF1YWw8c3RkOjpfXzI6Ol9fd3JhcF9pdGVyPHdjaGFyX3QqPiwgc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPHdjaGFyX3QqPiwgc3RkOjpfXzI6Ol9fZXF1YWxfdG88d2NoYXJfdCwgd2NoYXJfdD4gPihzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8d2NoYXJfdCo+LCBzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8d2NoYXJfdCo+LCBzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8d2NoYXJfdCo+LCBzdGQ6Ol9fMjo6X19lcXVhbF90bzx3Y2hhcl90LCB3Y2hhcl90PimpBzZzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8d2NoYXJfdCo+OjpvcGVyYXRvcisobG9uZykgY29uc3SqB9wBc3RkOjpfXzI6Om1vbmV5X3B1dDxjaGFyLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIGJvb2wsIHN0ZDo6X18yOjppb3NfYmFzZSYsIGNoYXIsIGxvbmcgZG91YmxlKSBjb25zdKsHiwNzdGQ6Ol9fMjo6X19tb25leV9wdXQ8Y2hhcj46Ol9fZ2F0aGVyX2luZm8oYm9vbCwgYm9vbCwgc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYsIHN0ZDo6X18yOjptb25leV9iYXNlOjpwYXR0ZXJuJiwgY2hhciYsIGNoYXImLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4mLCBpbnQmKawH2QNzdGQ6Ol9fMjo6X19tb25leV9wdXQ8Y2hhcj46Ol9fZm9ybWF0KGNoYXIqLCBjaGFyKiYsIGNoYXIqJiwgdW5zaWduZWQgaW50LCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYsIGJvb2wsIHN0ZDo6X18yOjptb25leV9iYXNlOjpwYXR0ZXJuIGNvbnN0JiwgY2hhciwgY2hhciwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QmLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0JiwgaW50Ka0HjgFjaGFyKiBzdGQ6Ol9fMjo6Y29weTxzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8Y2hhciBjb25zdCo+LCBjaGFyKj4oc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPGNoYXIgY29uc3QqPiwgc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPGNoYXIgY29uc3QqPiwgY2hhcioprgetAnN0ZDo6X18yOjptb25leV9wdXQ8Y2hhciwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBib29sLCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCBjaGFyLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0JikgY29uc3SvB+4Bc3RkOjpfXzI6Om1vbmV5X3B1dDx3Y2hhcl90LCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIGJvb2wsIHN0ZDo6X18yOjppb3NfYmFzZSYsIHdjaGFyX3QsIGxvbmcgZG91YmxlKSBjb25zdLAHpgNzdGQ6Ol9fMjo6X19tb25leV9wdXQ8d2NoYXJfdD46Ol9fZ2F0aGVyX2luZm8oYm9vbCwgYm9vbCwgc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYsIHN0ZDo6X18yOjptb25leV9iYXNlOjpwYXR0ZXJuJiwgd2NoYXJfdCYsIHdjaGFyX3QmLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4mLCBpbnQmKbEHhgRzdGQ6Ol9fMjo6X19tb25leV9wdXQ8d2NoYXJfdD46Ol9fZm9ybWF0KHdjaGFyX3QqLCB3Y2hhcl90KiYsIHdjaGFyX3QqJiwgdW5zaWduZWQgaW50LCB3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdCosIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYsIGJvb2wsIHN0ZDo6X18yOjptb25leV9iYXNlOjpwYXR0ZXJuIGNvbnN0Jiwgd2NoYXJfdCwgd2NoYXJfdCwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4gY29uc3QmLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+IGNvbnN0JiwgaW50KbIHoAF3Y2hhcl90KiBzdGQ6Ol9fMjo6Y29weTxzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8d2NoYXJfdCBjb25zdCo+LCB3Y2hhcl90Kj4oc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPHdjaGFyX3QgY29uc3QqPiwgc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPHdjaGFyX3QgY29uc3QqPiwgd2NoYXJfdCopswfIAnN0ZDo6X18yOjptb25leV9wdXQ8d2NoYXJfdCwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBib29sLCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90LCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+IGNvbnN0JikgY29uc3S0B5ABY2hhciogc3RkOjpfXzI6Ol9fY29weTxzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8Y2hhciBjb25zdCo+LCBjaGFyKj4oc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPGNoYXIgY29uc3QqPiwgc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPGNoYXIgY29uc3QqPiwgY2hhcioptQeiAXdjaGFyX3QqIHN0ZDo6X18yOjpfX2NvcHk8c3RkOjpfXzI6Ol9fd3JhcF9pdGVyPHdjaGFyX3QgY29uc3QqPiwgd2NoYXJfdCo+KHN0ZDo6X18yOjpfX3dyYXBfaXRlcjx3Y2hhcl90IGNvbnN0Kj4sIHN0ZDo6X18yOjpfX3dyYXBfaXRlcjx3Y2hhcl90IGNvbnN0Kj4sIHdjaGFyX3QqKbYHngFzdGQ6Ol9fMjo6bWVzc2FnZXM8Y2hhcj46OmRvX29wZW4oc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCYsIHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKSBjb25zdLcHlAFzdGQ6Ol9fMjo6bWVzc2FnZXM8Y2hhcj46OmRvX2dldChsb25nLCBpbnQsIGludCwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCYpIGNvbnN0uAe4A3N0ZDo6X18yOjpiYWNrX2luc2VydF9pdGVyYXRvcjxzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+ID4gc3RkOjpfXzI6Ol9fbmFycm93X3RvX3V0Zjg8OHVsPjo6b3BlcmF0b3IoKTxzdGQ6Ol9fMjo6YmFja19pbnNlcnRfaXRlcmF0b3I8c3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiA+LCBjaGFyPihzdGQ6Ol9fMjo6YmFja19pbnNlcnRfaXRlcmF0b3I8c3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiA+LCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdCopIGNvbnN0uQeOAXN0ZDo6X18yOjpiYWNrX2luc2VydF9pdGVyYXRvcjxzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+ID46Om9wZXJhdG9yPShjaGFyIGNvbnN0Jim6B6ABc3RkOjpfXzI6Om1lc3NhZ2VzPHdjaGFyX3Q+Ojpkb19nZXQobG9uZywgaW50LCBpbnQsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4gY29uc3QmKSBjb25zdLsHwgNzdGQ6Ol9fMjo6YmFja19pbnNlcnRfaXRlcmF0b3I8c3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiA+IHN0ZDo6X18yOjpfX25hcnJvd190b191dGY4PDMydWw+OjpvcGVyYXRvcigpPHN0ZDo6X18yOjpiYWNrX2luc2VydF9pdGVyYXRvcjxzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+ID4sIHdjaGFyX3Q+KHN0ZDo6X18yOjpiYWNrX2luc2VydF9pdGVyYXRvcjxzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+ID4sIHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0KikgY29uc3S8B9ADc3RkOjpfXzI6OmJhY2tfaW5zZXJ0X2l0ZXJhdG9yPHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4gPiBzdGQ6Ol9fMjo6X193aWRlbl9mcm9tX3V0Zjg8MzJ1bD46Om9wZXJhdG9yKCk8c3RkOjpfXzI6OmJhY2tfaW5zZXJ0X2l0ZXJhdG9yPHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4gPiA+KHN0ZDo6X18yOjpiYWNrX2luc2VydF9pdGVyYXRvcjxzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+ID4sIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KikgY29uc3S9BzlzdGQ6Ol9fMjo6Y29kZWN2dDx3Y2hhcl90LCBjaGFyLCBfX21ic3RhdGVfdD46On5jb2RlY3Z0KCm+By1zdGQ6Ol9fMjo6bG9jYWxlOjpfX2ltcDo6X19pbXAodW5zaWduZWQgbG9uZym/B35zdGQ6Ol9fMjo6X192ZWN0b3JfYmFzZTxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiA+OjpfX3ZlY3Rvcl9iYXNlKCnAB4IBc3RkOjpfXzI6OnZlY3RvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiA+OjpfX3ZhbGxvY2F0ZSh1bnNpZ25lZCBsb25nKcEHiQFzdGQ6Ol9fMjo6dmVjdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46Ol9fY29uc3RydWN0X2F0X2VuZCh1bnNpZ25lZCBsb25nKcIHdnN0ZDo6X18yOjpfX3ZlY3Rvcl9iYXNlPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46OmNsZWFyKCnDB44Bc3RkOjpfXzI6OnZlY3RvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiA+OjpfX2Fubm90YXRlX3Nocmluayh1bnNpZ25lZCBsb25nKSBjb25zdMQHHXN0ZDo6X18yOjpsb2NhbGU6OmlkOjpfX2dldCgpxQdAc3RkOjpfXzI6OmxvY2FsZTo6X19pbXA6Omluc3RhbGwoc3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBsb25nKcYHSHN0ZDo6X18yOjpjdHlwZTxjaGFyPjo6Y3R5cGUodW5zaWduZWQgc2hvcnQgY29uc3QqLCBib29sLCB1bnNpZ25lZCBsb25nKccHG3N0ZDo6X18yOjpsb2NhbGU6OmNsYXNzaWMoKcgHfXN0ZDo6X18yOjp2ZWN0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4gPjo6cmVzaXplKHVuc2lnbmVkIGxvbmcpyQchc3RkOjpfXzI6OmxvY2FsZTo6X19pbXA6On5fX2ltcCgpygeBAXN0ZDo6X18yOjp2ZWN0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4gPjo6X19hbm5vdGF0ZV9kZWxldGUoKSBjb25zdMsHI3N0ZDo6X18yOjpsb2NhbGU6Ol9faW1wOjp+X19pbXAoKS4xzAd/c3RkOjpfXzI6OnZlY3RvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiA+OjpfX2FwcGVuZCh1bnNpZ25lZCBsb25nKc0HHHN0ZDo6X18yOjpsb2NhbGU6Ol9fZ2xvYmFsKCnOBxpzdGQ6Ol9fMjo6bG9jYWxlOjpsb2NhbGUoKc8HLnN0ZDo6X18yOjpsb2NhbGU6Ol9faW1wOjpoYXNfZmFjZXQobG9uZykgY29uc3TQBx5zdGQ6Ol9fMjo6bG9jYWxlOjppZDo6X19pbml0KCnRB4wBdm9pZCBzdGQ6Ol9fMjo6Y2FsbF9vbmNlPHN0ZDo6X18yOjooYW5vbnltb3VzIG5hbWVzcGFjZSk6Ol9fZmFrZV9iaW5kPihzdGQ6Ol9fMjo6b25jZV9mbGFnJiwgc3RkOjpfXzI6Oihhbm9ueW1vdXMgbmFtZXNwYWNlKTo6X19mYWtlX2JpbmQmJinSBytzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldDo6X19vbl96ZXJvX3NoYXJlZCgp0wdpdm9pZCBzdGQ6Ol9fMjo6X19jYWxsX29uY2VfcHJveHk8c3RkOjpfXzI6OnR1cGxlPHN0ZDo6X18yOjooYW5vbnltb3VzIG5hbWVzcGFjZSk6Ol9fZmFrZV9iaW5kJiY+ID4odm9pZCop1Ac+c3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+Ojpkb19pcyh1bnNpZ25lZCBzaG9ydCwgd2NoYXJfdCkgY29uc3TVB1ZzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD46OmRvX2lzKHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0KiwgdW5zaWduZWQgc2hvcnQqKSBjb25zdNYHWnN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90Pjo6ZG9fc2Nhbl9pcyh1bnNpZ25lZCBzaG9ydCwgd2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqKSBjb25zdNcHW3N0ZDo6X18yOjpjdHlwZTx3Y2hhcl90Pjo6ZG9fc2Nhbl9ub3QodW5zaWduZWQgc2hvcnQsIHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0KikgY29uc3TYBzNzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD46OmRvX3RvdXBwZXIod2NoYXJfdCkgY29uc3TZB0RzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD46OmRvX3RvdXBwZXIod2NoYXJfdCosIHdjaGFyX3QgY29uc3QqKSBjb25zdNoHM3N0ZDo6X18yOjpjdHlwZTx3Y2hhcl90Pjo6ZG9fdG9sb3dlcih3Y2hhcl90KSBjb25zdNsHRHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90Pjo6ZG9fdG9sb3dlcih3Y2hhcl90Kiwgd2NoYXJfdCBjb25zdCopIGNvbnN03Acuc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+Ojpkb193aWRlbihjaGFyKSBjb25zdN0HTHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90Pjo6ZG9fd2lkZW4oY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCB3Y2hhcl90KikgY29uc3TeBzhzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD46OmRvX25hcnJvdyh3Y2hhcl90LCBjaGFyKSBjb25zdN8HVnN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90Pjo6ZG9fbmFycm93KHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0KiwgY2hhciwgY2hhciopIGNvbnN04Acfc3RkOjpfXzI6OmN0eXBlPGNoYXI+Ojp+Y3R5cGUoKeEHIXN0ZDo6X18yOjpjdHlwZTxjaGFyPjo6fmN0eXBlKCkuMeIHLXN0ZDo6X18yOjpjdHlwZTxjaGFyPjo6ZG9fdG91cHBlcihjaGFyKSBjb25zdOMHO3N0ZDo6X18yOjpjdHlwZTxjaGFyPjo6ZG9fdG91cHBlcihjaGFyKiwgY2hhciBjb25zdCopIGNvbnN05Actc3RkOjpfXzI6OmN0eXBlPGNoYXI+Ojpkb190b2xvd2VyKGNoYXIpIGNvbnN05Qc7c3RkOjpfXzI6OmN0eXBlPGNoYXI+Ojpkb190b2xvd2VyKGNoYXIqLCBjaGFyIGNvbnN0KikgY29uc3TmB0ZzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj46OmRvX3dpZGVuKGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgY2hhciopIGNvbnN05wcyc3RkOjpfXzI6OmN0eXBlPGNoYXI+Ojpkb19uYXJyb3coY2hhciwgY2hhcikgY29uc3ToB01zdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj46OmRvX25hcnJvdyhjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIGNoYXIsIGNoYXIqKSBjb25zdOkHhAFzdGQ6Ol9fMjo6Y29kZWN2dDxjaGFyLCBjaGFyLCBfX21ic3RhdGVfdD46OmRvX291dChfX21ic3RhdGVfdCYsIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdComLCBjaGFyKiwgY2hhciosIGNoYXIqJikgY29uc3TqB2BzdGQ6Ol9fMjo6Y29kZWN2dDxjaGFyLCBjaGFyLCBfX21ic3RhdGVfdD46OmRvX3Vuc2hpZnQoX19tYnN0YXRlX3QmLCBjaGFyKiwgY2hhciosIGNoYXIqJikgY29uc3TrB3JzdGQ6Ol9fMjo6Y29kZWN2dDxjaGFyLCBjaGFyLCBfX21ic3RhdGVfdD46OmRvX2xlbmd0aChfX21ic3RhdGVfdCYsIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgbG9uZykgY29uc3TsBztzdGQ6Ol9fMjo6Y29kZWN2dDx3Y2hhcl90LCBjaGFyLCBfX21ic3RhdGVfdD46On5jb2RlY3Z0KCkuMe0HkAFzdGQ6Ol9fMjo6Y29kZWN2dDx3Y2hhcl90LCBjaGFyLCBfX21ic3RhdGVfdD46OmRvX291dChfX21ic3RhdGVfdCYsIHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdComLCBjaGFyKiwgY2hhciosIGNoYXIqJikgY29uc3TuB3VzdGQ6Ol9fMjo6X19saWJjcHBfd2NzbnJ0b21ic19sKGNoYXIqLCB3Y2hhcl90IGNvbnN0KiosIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIF9fbWJzdGF0ZV90KiwgX19sb2NhbGVfc3RydWN0KinvB0xzdGQ6Ol9fMjo6X19saWJjcHBfd2NydG9tYl9sKGNoYXIqLCB3Y2hhcl90LCBfX21ic3RhdGVfdCosIF9fbG9jYWxlX3N0cnVjdCop8AePAXN0ZDo6X18yOjpjb2RlY3Z0PHdjaGFyX3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9faW4oX19tYnN0YXRlX3QmLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqJiwgd2NoYXJfdCosIHdjaGFyX3QqLCB3Y2hhcl90KiYpIGNvbnN08Qd1c3RkOjpfXzI6Ol9fbGliY3BwX21ic25ydG93Y3NfbCh3Y2hhcl90KiwgY2hhciBjb25zdCoqLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCBfX21ic3RhdGVfdCosIF9fbG9jYWxlX3N0cnVjdCop8gdic3RkOjpfXzI6Ol9fbGliY3BwX21icnRvd2NfbCh3Y2hhcl90KiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGxvbmcsIF9fbWJzdGF0ZV90KiwgX19sb2NhbGVfc3RydWN0KinzB2NzdGQ6Ol9fMjo6Y29kZWN2dDx3Y2hhcl90LCBjaGFyLCBfX21ic3RhdGVfdD46OmRvX3Vuc2hpZnQoX19tYnN0YXRlX3QmLCBjaGFyKiwgY2hhciosIGNoYXIqJikgY29uc3T0B0JzdGQ6Ol9fMjo6Y29kZWN2dDx3Y2hhcl90LCBjaGFyLCBfX21ic3RhdGVfdD46OmRvX2VuY29kaW5nKCkgY29uc3T1B1NzdGQ6Ol9fMjo6X19saWJjcHBfbWJ0b3djX2wod2NoYXJfdCosIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBsb25nLCBfX2xvY2FsZV9zdHJ1Y3QqKfYHMXN0ZDo6X18yOjpfX2xpYmNwcF9tYl9jdXJfbWF4X2woX19sb2NhbGVfc3RydWN0Kin3B3VzdGQ6Ol9fMjo6Y29kZWN2dDx3Y2hhcl90LCBjaGFyLCBfX21ic3RhdGVfdD46OmRvX2xlbmd0aChfX21ic3RhdGVfdCYsIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgbG9uZykgY29uc3T4B1dzdGQ6Ol9fMjo6X19saWJjcHBfbWJybGVuX2woY2hhciBjb25zdCosIHVuc2lnbmVkIGxvbmcsIF9fbWJzdGF0ZV90KiwgX19sb2NhbGVfc3RydWN0Kin5B0RzdGQ6Ol9fMjo6Y29kZWN2dDx3Y2hhcl90LCBjaGFyLCBfX21ic3RhdGVfdD46OmRvX21heF9sZW5ndGgoKSBjb25zdPoHlAFzdGQ6Ol9fMjo6Y29kZWN2dDxjaGFyMTZfdCwgY2hhciwgX19tYnN0YXRlX3Q+Ojpkb19vdXQoX19tYnN0YXRlX3QmLCBjaGFyMTZfdCBjb25zdCosIGNoYXIxNl90IGNvbnN0KiwgY2hhcjE2X3QgY29uc3QqJiwgY2hhciosIGNoYXIqLCBjaGFyKiYpIGNvbnN0+we1AXN0ZDo6X18yOjp1dGYxNl90b191dGY4KHVuc2lnbmVkIHNob3J0IGNvbnN0KiwgdW5zaWduZWQgc2hvcnQgY29uc3QqLCB1bnNpZ25lZCBzaG9ydCBjb25zdComLCB1bnNpZ25lZCBjaGFyKiwgdW5zaWduZWQgY2hhciosIHVuc2lnbmVkIGNoYXIqJiwgdW5zaWduZWQgbG9uZywgc3RkOjpfXzI6OmNvZGVjdnRfbW9kZSn8B5MBc3RkOjpfXzI6OmNvZGVjdnQ8Y2hhcjE2X3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9faW4oX19tYnN0YXRlX3QmLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqJiwgY2hhcjE2X3QqLCBjaGFyMTZfdCosIGNoYXIxNl90KiYpIGNvbnN0/Qe1AXN0ZDo6X18yOjp1dGY4X3RvX3V0ZjE2KHVuc2lnbmVkIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgY2hhciBjb25zdComLCB1bnNpZ25lZCBzaG9ydCosIHVuc2lnbmVkIHNob3J0KiwgdW5zaWduZWQgc2hvcnQqJiwgdW5zaWduZWQgbG9uZywgc3RkOjpfXzI6OmNvZGVjdnRfbW9kZSn+B3ZzdGQ6Ol9fMjo6Y29kZWN2dDxjaGFyMTZfdCwgY2hhciwgX19tYnN0YXRlX3Q+Ojpkb19sZW5ndGgoX19tYnN0YXRlX3QmLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGxvbmcpIGNvbnN0/weAAXN0ZDo6X18yOjp1dGY4X3RvX3V0ZjE2X2xlbmd0aCh1bnNpZ25lZCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgY2hhciBjb25zdCosIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIHN0ZDo6X18yOjpjb2RlY3Z0X21vZGUpgAhFc3RkOjpfXzI6OmNvZGVjdnQ8Y2hhcjE2X3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9fbWF4X2xlbmd0aCgpIGNvbnN0gQiUAXN0ZDo6X18yOjpjb2RlY3Z0PGNoYXIzMl90LCBjaGFyLCBfX21ic3RhdGVfdD46OmRvX291dChfX21ic3RhdGVfdCYsIGNoYXIzMl90IGNvbnN0KiwgY2hhcjMyX3QgY29uc3QqLCBjaGFyMzJfdCBjb25zdComLCBjaGFyKiwgY2hhciosIGNoYXIqJikgY29uc3SCCK4Bc3RkOjpfXzI6OnVjczRfdG9fdXRmOCh1bnNpZ25lZCBpbnQgY29uc3QqLCB1bnNpZ25lZCBpbnQgY29uc3QqLCB1bnNpZ25lZCBpbnQgY29uc3QqJiwgdW5zaWduZWQgY2hhciosIHVuc2lnbmVkIGNoYXIqLCB1bnNpZ25lZCBjaGFyKiYsIHVuc2lnbmVkIGxvbmcsIHN0ZDo6X18yOjpjb2RlY3Z0X21vZGUpgwiTAXN0ZDo6X18yOjpjb2RlY3Z0PGNoYXIzMl90LCBjaGFyLCBfX21ic3RhdGVfdD46OmRvX2luKF9fbWJzdGF0ZV90JiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiYsIGNoYXIzMl90KiwgY2hhcjMyX3QqLCBjaGFyMzJfdComKSBjb25zdIQIrgFzdGQ6Ol9fMjo6dXRmOF90b191Y3M0KHVuc2lnbmVkIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgY2hhciBjb25zdComLCB1bnNpZ25lZCBpbnQqLCB1bnNpZ25lZCBpbnQqLCB1bnNpZ25lZCBpbnQqJiwgdW5zaWduZWQgbG9uZywgc3RkOjpfXzI6OmNvZGVjdnRfbW9kZSmFCHZzdGQ6Ol9fMjo6Y29kZWN2dDxjaGFyMzJfdCwgY2hhciwgX19tYnN0YXRlX3Q+Ojpkb19sZW5ndGgoX19tYnN0YXRlX3QmLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGxvbmcpIGNvbnN0hgh/c3RkOjpfXzI6OnV0ZjhfdG9fdWNzNF9sZW5ndGgodW5zaWduZWQgY2hhciBjb25zdCosIHVuc2lnbmVkIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCBzdGQ6Ol9fMjo6Y29kZWN2dF9tb2RlKYcIJXN0ZDo6X18yOjpudW1wdW5jdDxjaGFyPjo6fm51bXB1bmN0KCmICCdzdGQ6Ol9fMjo6bnVtcHVuY3Q8Y2hhcj46On5udW1wdW5jdCgpLjGJCChzdGQ6Ol9fMjo6bnVtcHVuY3Q8d2NoYXJfdD46On5udW1wdW5jdCgpiggqc3RkOjpfXzI6Om51bXB1bmN0PHdjaGFyX3Q+Ojp+bnVtcHVuY3QoKS4xiwgyc3RkOjpfXzI6Om51bXB1bmN0PGNoYXI+Ojpkb19kZWNpbWFsX3BvaW50KCkgY29uc3SMCDJzdGQ6Ol9fMjo6bnVtcHVuY3Q8Y2hhcj46OmRvX3Rob3VzYW5kc19zZXAoKSBjb25zdI0ILXN0ZDo6X18yOjpudW1wdW5jdDxjaGFyPjo6ZG9fZ3JvdXBpbmcoKSBjb25zdI4IMHN0ZDo6X18yOjpudW1wdW5jdDx3Y2hhcl90Pjo6ZG9fZ3JvdXBpbmcoKSBjb25zdI8ILXN0ZDo6X18yOjpudW1wdW5jdDxjaGFyPjo6ZG9fdHJ1ZW5hbWUoKSBjb25zdJAIMHN0ZDo6X18yOjpudW1wdW5jdDx3Y2hhcl90Pjo6ZG9fdHJ1ZW5hbWUoKSBjb25zdJEIfHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID46OmJhc2ljX3N0cmluZyh3Y2hhcl90IGNvbnN0KimSCC5zdGQ6Ol9fMjo6bnVtcHVuY3Q8Y2hhcj46OmRvX2ZhbHNlbmFtZSgpIGNvbnN0kwgxc3RkOjpfXzI6Om51bXB1bmN0PHdjaGFyX3Q+Ojpkb19mYWxzZW5hbWUoKSBjb25zdJQIbXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46Om9wZXJhdG9yPShjaGFyIGNvbnN0KimVCDVzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8Y2hhcj46Ol9fd2Vla3MoKSBjb25zdJYIFnN0ZDo6X18yOjppbml0X3dlZWtzKCmXCBpfX2N4eF9nbG9iYWxfYXJyYXlfZHRvci41NJgIOHN0ZDo6X18yOjpfX3RpbWVfZ2V0X2Nfc3RvcmFnZTx3Y2hhcl90Pjo6X193ZWVrcygpIGNvbnN0mQgXc3RkOjpfXzI6OmluaXRfd3dlZWtzKCmaCBpfX2N4eF9nbG9iYWxfYXJyYXlfZHRvci42OZsIeXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID46Om9wZXJhdG9yPSh3Y2hhcl90IGNvbnN0KimcCDZzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8Y2hhcj46Ol9fbW9udGhzKCkgY29uc3SdCBdzdGQ6Ol9fMjo6aW5pdF9tb250aHMoKZ4IGl9fY3h4X2dsb2JhbF9hcnJheV9kdG9yLjg0nwg5c3RkOjpfXzI6Ol9fdGltZV9nZXRfY19zdG9yYWdlPHdjaGFyX3Q+OjpfX21vbnRocygpIGNvbnN0oAgYc3RkOjpfXzI6OmluaXRfd21vbnRocygpoQgbX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuMTA4ogg1c3RkOjpfXzI6Ol9fdGltZV9nZXRfY19zdG9yYWdlPGNoYXI+OjpfX2FtX3BtKCkgY29uc3SjCBZzdGQ6Ol9fMjo6aW5pdF9hbV9wbSgppAgbX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuMTMypQg4c3RkOjpfXzI6Ol9fdGltZV9nZXRfY19zdG9yYWdlPHdjaGFyX3Q+OjpfX2FtX3BtKCkgY29uc3SmCBdzdGQ6Ol9fMjo6aW5pdF93YW1fcG0oKacIG19fY3h4X2dsb2JhbF9hcnJheV9kdG9yLjEzNagIMXN0ZDo6X18yOjpfX3RpbWVfZ2V0X2Nfc3RvcmFnZTxjaGFyPjo6X194KCkgY29uc3SpCBlfX2N4eF9nbG9iYWxfYXJyYXlfZHRvci4xqgg0c3RkOjpfXzI6Ol9fdGltZV9nZXRfY19zdG9yYWdlPHdjaGFyX3Q+OjpfX3goKSBjb25zdKsIGl9fY3h4X2dsb2JhbF9hcnJheV9kdG9yLjMxrAgxc3RkOjpfXzI6Ol9fdGltZV9nZXRfY19zdG9yYWdlPGNoYXI+OjpfX1goKSBjb25zdK0IGl9fY3h4X2dsb2JhbF9hcnJheV9kdG9yLjMzrgg0c3RkOjpfXzI6Ol9fdGltZV9nZXRfY19zdG9yYWdlPHdjaGFyX3Q+OjpfX1goKSBjb25zdK8IGl9fY3h4X2dsb2JhbF9hcnJheV9kdG9yLjM1sAgxc3RkOjpfXzI6Ol9fdGltZV9nZXRfY19zdG9yYWdlPGNoYXI+OjpfX2MoKSBjb25zdLEIGl9fY3h4X2dsb2JhbF9hcnJheV9kdG9yLjM3sgg0c3RkOjpfXzI6Ol9fdGltZV9nZXRfY19zdG9yYWdlPHdjaGFyX3Q+OjpfX2MoKSBjb25zdLMIGl9fY3h4X2dsb2JhbF9hcnJheV9kdG9yLjM5tAgxc3RkOjpfXzI6Ol9fdGltZV9nZXRfY19zdG9yYWdlPGNoYXI+OjpfX3IoKSBjb25zdLUIGl9fY3h4X2dsb2JhbF9hcnJheV9kdG9yLjQxtgg0c3RkOjpfXzI6Ol9fdGltZV9nZXRfY19zdG9yYWdlPHdjaGFyX3Q+OjpfX3IoKSBjb25zdLcIGl9fY3h4X2dsb2JhbF9hcnJheV9kdG9yLjQzuAhpc3RkOjpfXzI6OnRpbWVfcHV0PGNoYXIsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46On50aW1lX3B1dCgpuQhrc3RkOjpfXzI6OnRpbWVfcHV0PGNoYXIsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46On50aW1lX3B1dCgpLjG6CHhzdGQ6Ol9fMjo6dmVjdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46Om1heF9zaXplKCkgY29uc3S7CKsBc3RkOjpfXzI6OmFsbG9jYXRvcl90cmFpdHM8c3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46OmFsbG9jYXRlKHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiYsIHVuc2lnbmVkIGxvbmcpvAiLAXN0ZDo6X18yOjp2ZWN0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4gPjo6X19hbm5vdGF0ZV9uZXcodW5zaWduZWQgbG9uZykgY29uc3S9CF9zdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD46OmFsbG9jYXRlKHVuc2lnbmVkIGxvbmcsIHZvaWQgY29uc3QqKb4IP3N0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj46OmFsbG9jYXRlKHVuc2lnbmVkIGxvbmcsIHZvaWQgY29uc3QqKb8IyAFzdGQ6Ol9fMjo6YWxsb2NhdG9yX3RyYWl0czxzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4gPjo6ZGVhbGxvY2F0ZShzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4mLCBzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCoqLCB1bnNpZ25lZCBsb25nKcAImwFzdGQ6Ol9fMjo6X192ZWN0b3JfYmFzZTxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiA+OjpfX2Rlc3RydWN0X2F0X2VuZChzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCoqKcEIInN0ZDo6X18yOjpfX3RpbWVfcHV0OjpfX3RpbWVfcHV0KCnCCIgBc3RkOjpfXzI6OnZlY3RvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiA+OjpfX3JlY29tbWVuZCh1bnNpZ25lZCBsb25nKSBjb25zdMMI2AFzdGQ6Ol9fMjo6X19zcGxpdF9idWZmZXI8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4mPjo6X19zcGxpdF9idWZmZXIodW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+JinECJEBc3RkOjpfXzI6Ol9fc3BsaXRfYnVmZmVyPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+Jj46Ol9fY29uc3RydWN0X2F0X2VuZCh1bnNpZ25lZCBsb25nKcUI8wFzdGQ6Ol9fMjo6dmVjdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46Ol9fc3dhcF9vdXRfY2lyY3VsYXJfYnVmZmVyKHN0ZDo6X18yOjpfX3NwbGl0X2J1ZmZlcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiY+JinGCMYDc3RkOjpfXzI6OmVuYWJsZV9pZjwoKHN0ZDo6X18yOjppbnRlZ3JhbF9jb25zdGFudDxib29sLCBmYWxzZT46OnZhbHVlKSB8fCAoIShfX2hhc19jb25zdHJ1Y3Q8c3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+LCBib29sKiwgYm9vbD46OnZhbHVlKSkpICYmIChpc190cml2aWFsbHlfbW92ZV9jb25zdHJ1Y3RpYmxlPGJvb2w+Ojp2YWx1ZSksIHZvaWQ+Ojp0eXBlIHN0ZDo6X18yOjphbGxvY2F0b3JfdHJhaXRzPHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiA+OjpfX2NvbnN0cnVjdF9iYWNrd2FyZDxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCo+KHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiYsIGJvb2wqLCBib29sKiwgYm9vbComKccIfHN0ZDo6X18yOjpfX2NvbXByZXNzZWRfcGFpcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCoqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4mPjo6c2Vjb25kKCnICMYBc3RkOjpfXzI6Ol9fc3BsaXRfYnVmZmVyPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+Jj46Ol9fZGVzdHJ1Y3RfYXRfZW5kKHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiosIHN0ZDo6X18yOjppbnRlZ3JhbF9jb25zdGFudDxib29sLCBmYWxzZT4pyQhAc3RkOjpfXzI6Oihhbm9ueW1vdXMgbmFtZXNwYWNlKTo6X19mYWtlX2JpbmQ6Om9wZXJhdG9yKCkoKSBjb25zdMoIQnN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD46OmFsbG9jYXRlKHVuc2lnbmVkIGxvbmcsIHZvaWQgY29uc3QqKcsIa3N0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46Ol9fY2xlYXJfYW5kX3NocmluaygpzAh0c3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6X19jbGVhcl9hbmRfc2hyaW5rKCnNCENsb25nIGRvdWJsZSBzdGQ6Ol9fMjo6X19kb19zdHJ0b2Q8bG9uZyBkb3VibGU+KGNoYXIgY29uc3QqLCBjaGFyKiopzggtc3RkOjpfXzI6Ol9fc2hhcmVkX2NvdW50Ojp+X19zaGFyZWRfY291bnQoKS4xzwgvc3RkOjpfXzI6Ol9fc2hhcmVkX3dlYWtfY291bnQ6Ol9fcmVsZWFzZV93ZWFrKCnQCElzdGQ6Ol9fMjo6X19zaGFyZWRfd2Vha19jb3VudDo6X19nZXRfZGVsZXRlcihzdGQ6OnR5cGVfaW5mbyBjb25zdCYpIGNvbnN00QhGc3RkOjpfXzI6Ol9fY2FsbF9vbmNlKHVuc2lnbmVkIGxvbmcgdm9sYXRpbGUmLCB2b2lkKiwgdm9pZCAoKikodm9pZCopKdIIG29wZXJhdG9yIG5ldyh1bnNpZ25lZCBsb25nKdMIPXN0ZDo6X18yOjpfX2xpYmNwcF9yZWZzdHJpbmc6Ol9fbGliY3BwX3JlZnN0cmluZyhjaGFyIGNvbnN0KinUCAd3bWVtc2V01QgId21lbW1vdmXWCENzdGQ6Ol9fMjo6X19iYXNpY19zdHJpbmdfY29tbW9uPHRydWU+OjpfX3Rocm93X2xlbmd0aF9lcnJvcigpIGNvbnN01wjBAXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OmJhc2ljX3N0cmluZyhzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0JinYCHlzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpfX2luaXQoY2hhciBjb25zdCosIHVuc2lnbmVkIGxvbmcp2Qhmc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6fmJhc2ljX3N0cmluZygp2gh5c3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6YXNzaWduKGNoYXIgY29uc3QqLCB1bnNpZ25lZCBsb25nKdsI0wFzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpfX2dyb3dfYnlfYW5kX3JlcGxhY2UodW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgY2hhciBjb25zdCop3Ahyc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6cmVzaXplKHVuc2lnbmVkIGxvbmcsIGNoYXIp3Qhyc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6YXBwZW5kKHVuc2lnbmVkIGxvbmcsIGNoYXIp3gh0c3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6X19lcmFzZV90b19lbmQodW5zaWduZWQgbG9uZynfCLoBc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6X19ncm93X2J5KHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcp4Ag/c3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+Ojphc3NpZ24oY2hhciosIHVuc2lnbmVkIGxvbmcsIGNoYXIp4Qh5c3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6YXBwZW5kKGNoYXIgY29uc3QqLCB1bnNpZ25lZCBsb25nKeIIZnN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OnB1c2hfYmFjayhjaGFyKeMIcnN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46Ol9faW5pdCh1bnNpZ25lZCBsb25nLCBjaGFyKeQIhQFzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+OjpfX2luaXQod2NoYXJfdCBjb25zdCosIHVuc2lnbmVkIGxvbmcp5QiFAXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID46OmFzc2lnbih3Y2hhcl90IGNvbnN0KiwgdW5zaWduZWQgbG9uZynmCN8Bc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6X19ncm93X2J5X2FuZF9yZXBsYWNlKHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIHdjaGFyX3QgY29uc3QqKecIwwFzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+OjpfX2dyb3dfYnkodW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZynoCIUBc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6YXBwZW5kKHdjaGFyX3QgY29uc3QqLCB1bnNpZ25lZCBsb25nKekIcnN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID46OnB1c2hfYmFjayh3Y2hhcl90KeoIfnN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID46Ol9faW5pdCh1bnNpZ25lZCBsb25nLCB3Y2hhcl90KesIQnN0ZDo6X18yOjpfX3ZlY3Rvcl9iYXNlX2NvbW1vbjx0cnVlPjo6X190aHJvd19sZW5ndGhfZXJyb3IoKSBjb25zdOwIDWFib3J0X21lc3NhZ2XtCBJfX2N4YV9wdXJlX3ZpcnR1YWzuCBxzdGQ6OmV4Y2VwdGlvbjo6d2hhdCgpIGNvbnN07wggc3RkOjpsb2dpY19lcnJvcjo6fmxvZ2ljX2Vycm9yKCnwCDNzdGQ6Ol9fMjo6X19saWJjcHBfcmVmc3RyaW5nOjp+X19saWJjcHBfcmVmc3RyaW5nKCnxCCJzdGQ6OmxvZ2ljX2Vycm9yOjp+bG9naWNfZXJyb3IoKS4x8ggic3RkOjpsZW5ndGhfZXJyb3I6On5sZW5ndGhfZXJyb3IoKfMIG3N0ZDo6YmFkX2Nhc3Q6OndoYXQoKSBjb25zdPQIYV9fY3h4YWJpdjE6Ol9fZnVuZGFtZW50YWxfdHlwZV9pbmZvOjpjYW5fY2F0Y2goX19jeHhhYml2MTo6X19zaGltX3R5cGVfaW5mbyBjb25zdCosIHZvaWQqJikgY29uc3T1CDxpc19lcXVhbChzdGQ6OnR5cGVfaW5mbyBjb25zdCosIHN0ZDo6dHlwZV9pbmZvIGNvbnN0KiwgYm9vbCn2CFtfX2N4eGFiaXYxOjpfX2NsYXNzX3R5cGVfaW5mbzo6Y2FuX2NhdGNoKF9fY3h4YWJpdjE6Ol9fc2hpbV90eXBlX2luZm8gY29uc3QqLCB2b2lkKiYpIGNvbnN09wgOX19keW5hbWljX2Nhc3T4CGtfX2N4eGFiaXYxOjpfX2NsYXNzX3R5cGVfaW5mbzo6cHJvY2Vzc19mb3VuZF9iYXNlX2NsYXNzKF9fY3h4YWJpdjE6Ol9fZHluYW1pY19jYXN0X2luZm8qLCB2b2lkKiwgaW50KSBjb25zdPkIbl9fY3h4YWJpdjE6Ol9fY2xhc3NfdHlwZV9pbmZvOjpoYXNfdW5hbWJpZ3VvdXNfcHVibGljX2Jhc2UoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQqLCBpbnQpIGNvbnN0+ghxX19jeHhhYml2MTo6X19zaV9jbGFzc190eXBlX2luZm86Omhhc191bmFtYmlndW91c19wdWJsaWNfYmFzZShfX2N4eGFiaXYxOjpfX2R5bmFtaWNfY2FzdF9pbmZvKiwgdm9pZCosIGludCkgY29uc3T7CHNfX2N4eGFiaXYxOjpfX2Jhc2VfY2xhc3NfdHlwZV9pbmZvOjpoYXNfdW5hbWJpZ3VvdXNfcHVibGljX2Jhc2UoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQqLCBpbnQpIGNvbnN0/AhyX19jeHhhYml2MTo6X192bWlfY2xhc3NfdHlwZV9pbmZvOjpoYXNfdW5hbWJpZ3VvdXNfcHVibGljX2Jhc2UoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQqLCBpbnQpIGNvbnN0/QhbX19jeHhhYml2MTo6X19wYmFzZV90eXBlX2luZm86OmNhbl9jYXRjaChfX2N4eGFiaXYxOjpfX3NoaW1fdHlwZV9pbmZvIGNvbnN0Kiwgdm9pZComKSBjb25zdP4IXV9fY3h4YWJpdjE6Ol9fcG9pbnRlcl90eXBlX2luZm86OmNhbl9jYXRjaChfX2N4eGFiaXYxOjpfX3NoaW1fdHlwZV9pbmZvIGNvbnN0Kiwgdm9pZComKSBjb25zdP8IXF9fY3h4YWJpdjE6Ol9fcG9pbnRlcl90eXBlX2luZm86OmNhbl9jYXRjaF9uZXN0ZWQoX19jeHhhYml2MTo6X19zaGltX3R5cGVfaW5mbyBjb25zdCopIGNvbnN0gAlmX19jeHhhYml2MTo6X19wb2ludGVyX3RvX21lbWJlcl90eXBlX2luZm86OmNhbl9jYXRjaF9uZXN0ZWQoX19jeHhhYml2MTo6X19zaGltX3R5cGVfaW5mbyBjb25zdCopIGNvbnN0gQmDAV9fY3h4YWJpdjE6Ol9fY2xhc3NfdHlwZV9pbmZvOjpwcm9jZXNzX3N0YXRpY190eXBlX2Fib3ZlX2RzdChfX2N4eGFiaXYxOjpfX2R5bmFtaWNfY2FzdF9pbmZvKiwgdm9pZCBjb25zdCosIHZvaWQgY29uc3QqLCBpbnQpIGNvbnN0gglzX19jeHhhYml2MTo6X192bWlfY2xhc3NfdHlwZV9pbmZvOjpzZWFyY2hfYmVsb3dfZHN0KF9fY3h4YWJpdjE6Ol9fZHluYW1pY19jYXN0X2luZm8qLCB2b2lkIGNvbnN0KiwgaW50LCBib29sKSBjb25zdIMJgQFfX2N4eGFiaXYxOjpfX2Jhc2VfY2xhc3NfdHlwZV9pbmZvOjpzZWFyY2hfYWJvdmVfZHN0KF9fY3h4YWJpdjE6Ol9fZHluYW1pY19jYXN0X2luZm8qLCB2b2lkIGNvbnN0Kiwgdm9pZCBjb25zdCosIGludCwgYm9vbCkgY29uc3SECXRfX2N4eGFiaXYxOjpfX2Jhc2VfY2xhc3NfdHlwZV9pbmZvOjpzZWFyY2hfYmVsb3dfZHN0KF9fY3h4YWJpdjE6Ol9fZHluYW1pY19jYXN0X2luZm8qLCB2b2lkIGNvbnN0KiwgaW50LCBib29sKSBjb25zdIUJcl9fY3h4YWJpdjE6Ol9fc2lfY2xhc3NfdHlwZV9pbmZvOjpzZWFyY2hfYmVsb3dfZHN0KF9fY3h4YWJpdjE6Ol9fZHluYW1pY19jYXN0X2luZm8qLCB2b2lkIGNvbnN0KiwgaW50LCBib29sKSBjb25zdIYJb19fY3h4YWJpdjE6Ol9fY2xhc3NfdHlwZV9pbmZvOjpzZWFyY2hfYmVsb3dfZHN0KF9fY3h4YWJpdjE6Ol9fZHluYW1pY19jYXN0X2luZm8qLCB2b2lkIGNvbnN0KiwgaW50LCBib29sKSBjb25zdIcJgAFfX2N4eGFiaXYxOjpfX3ZtaV9jbGFzc190eXBlX2luZm86OnNlYXJjaF9hYm92ZV9kc3QoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQgY29uc3QqLCB2b2lkIGNvbnN0KiwgaW50LCBib29sKSBjb25zdIgJf19fY3h4YWJpdjE6Ol9fc2lfY2xhc3NfdHlwZV9pbmZvOjpzZWFyY2hfYWJvdmVfZHN0KF9fY3h4YWJpdjE6Ol9fZHluYW1pY19jYXN0X2luZm8qLCB2b2lkIGNvbnN0Kiwgdm9pZCBjb25zdCosIGludCwgYm9vbCkgY29uc3SJCXxfX2N4eGFiaXYxOjpfX2NsYXNzX3R5cGVfaW5mbzo6c2VhcmNoX2Fib3ZlX2RzdChfX2N4eGFiaXYxOjpfX2R5bmFtaWNfY2FzdF9pbmZvKiwgdm9pZCBjb25zdCosIHZvaWQgY29uc3QqLCBpbnQsIGJvb2wpIGNvbnN0igkIX19zdHJkdXCLCQ1fX2dldFR5cGVOYW1ljAkqX19lbWJpbmRfcmVnaXN0ZXJfbmF0aXZlX2FuZF9idWlsdGluX3R5cGVzjQk/dm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX2ludGVnZXI8Y2hhcj4oY2hhciBjb25zdCopjglGdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX2ludGVnZXI8c2lnbmVkIGNoYXI+KGNoYXIgY29uc3QqKY8JSHZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9pbnRlZ2VyPHVuc2lnbmVkIGNoYXI+KGNoYXIgY29uc3QqKZAJQHZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9pbnRlZ2VyPHNob3J0PihjaGFyIGNvbnN0KimRCUl2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfaW50ZWdlcjx1bnNpZ25lZCBzaG9ydD4oY2hhciBjb25zdCopkgk+dm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX2ludGVnZXI8aW50PihjaGFyIGNvbnN0KimTCUd2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfaW50ZWdlcjx1bnNpZ25lZCBpbnQ+KGNoYXIgY29uc3QqKZQJP3ZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9pbnRlZ2VyPGxvbmc+KGNoYXIgY29uc3QqKZUJSHZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9pbnRlZ2VyPHVuc2lnbmVkIGxvbmc+KGNoYXIgY29uc3QqKZYJPnZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9mbG9hdDxmbG9hdD4oY2hhciBjb25zdCoplwk/dm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX2Zsb2F0PGRvdWJsZT4oY2hhciBjb25zdCopmAlDdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX21lbW9yeV92aWV3PGNoYXI+KGNoYXIgY29uc3QqKZkJSnZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9tZW1vcnlfdmlldzxzaWduZWQgY2hhcj4oY2hhciBjb25zdCopmglMdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX21lbW9yeV92aWV3PHVuc2lnbmVkIGNoYXI+KGNoYXIgY29uc3QqKZsJRHZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9tZW1vcnlfdmlldzxzaG9ydD4oY2hhciBjb25zdCopnAlNdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX21lbW9yeV92aWV3PHVuc2lnbmVkIHNob3J0PihjaGFyIGNvbnN0KimdCUJ2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfbWVtb3J5X3ZpZXc8aW50PihjaGFyIGNvbnN0KimeCUt2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfbWVtb3J5X3ZpZXc8dW5zaWduZWQgaW50PihjaGFyIGNvbnN0KimfCUN2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfbWVtb3J5X3ZpZXc8bG9uZz4oY2hhciBjb25zdCopoAlMdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX21lbW9yeV92aWV3PHVuc2lnbmVkIGxvbmc+KGNoYXIgY29uc3QqKaEJRHZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9tZW1vcnlfdmlldzxmbG9hdD4oY2hhciBjb25zdCopoglFdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX21lbW9yeV92aWV3PGRvdWJsZT4oY2hhciBjb25zdCopowluRW1zY3JpcHRlbkJpbmRpbmdJbml0aWFsaXplcl9uYXRpdmVfYW5kX2J1aWx0aW5fdHlwZXM6OkVtc2NyaXB0ZW5CaW5kaW5nSW5pdGlhbGl6ZXJfbmF0aXZlX2FuZF9idWlsdGluX3R5cGVzKCmkCQhkbG1hbGxvY6UJBmRsZnJlZaYJCWRscmVhbGxvY6cJEXRyeV9yZWFsbG9jX2NodW5rqAkNZGlzcG9zZV9jaHVua6kJBHNicmuqCQRmbW9kqwkFZm1vZGysCQVsb2cxMK0JBmxvZzEwZq4JBnNjYWxibq8JDV9fZnBjbGFzc2lmeWywCQZtZW1jcHmxCQZtZW1zZXSyCQdtZW1tb3ZlswkIc2V0VGhyZXe0CQlzdGFja1NhdmW1CQpzdGFja0FsbG9jtgkMc3RhY2tSZXN0b3JltwkQX19ncm93V2FzbU1lbW9yebgJC2R5bkNhbGxfdmlpuQkNZHluQ2FsbF92aWlpaboJDGR5bkNhbGxfZGlpabsJDWR5bkNhbGxfZGlpaWm8CQxkeW5DYWxsX3ZpaWS9CQ1keW5DYWxsX3ZpaWlkvgkLZHluQ2FsbF92aWS/CQtkeW5DYWxsX2RpacAJDWR5bkNhbGxfZGlkaWTBCQ5keW5DYWxsX2RpaWRpZMIJDmR5bkNhbGxfZGlkaWRpwwkPZHluQ2FsbF9kaWlkaWRpxAkNZHluQ2FsbF92aWRpZMUJDmR5bkNhbGxfdmlpZGlkxgkOZHluQ2FsbF92aWRpZGTHCQ9keW5DYWxsX3ZpaWRpZGTICQ9keW5DYWxsX3ZpZGlkZGTJCRBkeW5DYWxsX3ZpaWRpZGRkygkLZHluQ2FsbF9kaWTLCQxkeW5DYWxsX2RpaWTMCQ5keW5DYWxsX3ZpZGRkac0JD2R5bkNhbGxfdmlpZGRkac4JDWR5bkNhbGxfaWlpaWTPCQ1keW5DYWxsX2RpZGRk0AkMZHluQ2FsbF92aWRk0QkNZHluQ2FsbF92aWlkZNIJDWR5bkNhbGxfaWlpaWnTCQxkeW5DYWxsX2RpZGTUCQ1keW5DYWxsX2RpaWRk1QkOZHluQ2FsbF9kaWlkZGTWCQ5keW5DYWxsX3ZpZmZpadcJD2R5bkNhbGxfdmlpZmZpadgJD2R5bkNhbGxfZGlkZGlkZNkJEGR5bkNhbGxfZGlpZGRpZGTaCQ9keW5DYWxsX2RpZGRkZGTbCRBkeW5DYWxsX2RpaWRkZGRk3AkPZHluQ2FsbF9kaWRkZGlp3QkQZHluQ2FsbF9kaWlkZGRpad4JEWR5bkNhbGxfZGlkZGRkZGlp3wkSZHluQ2FsbF9kaWlkZGRkZGlp4AkMZHluQ2FsbF9kaWRp4QkNZHluQ2FsbF9kaWlkaeIJD2R5bkNhbGxfZGlkaWRkZOMJEGR5bkNhbGxfZGlpZGlkZGTkCQ1keW5DYWxsX2RpZGRp5QkOZHluQ2FsbF9kaWlkZGnmCQxkeW5DYWxsX3ZpZGnnCQ1keW5DYWxsX3ZpaWRp6AkMZHluQ2FsbF92aWlm6QkNZHluQ2FsbF92aWlpZuoJDWR5bkNhbGxfaWlpaWbrCQ5keW5DYWxsX2RpZGRpZOwJD2R5bkNhbGxfZGlpZGRpZO0JD2R5bkNhbGxfZGlkZGRpZO4JEGR5bkNhbGxfZGlpZGRkaWTvCQ5keW5DYWxsX2RpZGRkafAJD2R5bkNhbGxfZGlpZGRkafEJC2R5bkNhbGxfaWlk8gkOZHluQ2FsbF92aWlpaWnzCQxkeW5DYWxsX2lpZmn0CQ1keW5DYWxsX2lpaWZp9QkKZHluQ2FsbF9mafYJC2R5bkNhbGxfZmlp9wkNZHluQ2FsbF9maWlpafgJDmR5bkNhbGxfZmlpaWlp+QkPZHluQ2FsbF92aWlpaWRk+gkQZHluQ2FsbF92aWlpaWlkZPsJD2R5bkNhbGxfaWlkaWlpafwJDmR5bkNhbGxfaWlpaWlp/QkRZHluQ2FsbF9paWlpaWlpaWn+CQ9keW5DYWxsX2lpaWlpaWn/CQ5keW5DYWxsX2lpaWlpZIAKEGR5bkNhbGxfaWlpaWlpaWmBCg9keW5DYWxsX3ZpaWlpaWmCCglkeW5DYWxsX3aDChhsZWdhbHN0dWIkZHluQ2FsbF92aWlqaWmEChZsZWdhbHN0dWIkZHluQ2FsbF9qaWpphQoYbGVnYWxzdHViJGR5bkNhbGxfaWlpaWlqhgoZbGVnYWxzdHViJGR5bkNhbGxfaWlpaWlqaocKGmxlZ2Fsc3R1YiRkeW5DYWxsX2lpaWlpaWpqAHUQc291cmNlTWFwcGluZ1VSTGNodHRwOi8vbG9jYWxob3N0OjkwMDAvYXVkaW8td29ya2xldC9idWlsZC97e3sgRklMRU5BTUVfUkVQTEFDRU1FTlRfU1RSSU5HU19XQVNNX0JJTkFSWV9GSUxFIH19fS5tYXA=';
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




// STATICTOP = STATIC_BASE + 40016;
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
      return 40880;
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
var dynCall_viiiii = Module["dynCall_viiiii"] = asm["dynCall_viiiii"];
var dynCall_iifi = Module["dynCall_iifi"] = asm["dynCall_iifi"];
var dynCall_iiifi = Module["dynCall_iiifi"] = asm["dynCall_iiifi"];
var dynCall_fi = Module["dynCall_fi"] = asm["dynCall_fi"];
var dynCall_fii = Module["dynCall_fii"] = asm["dynCall_fii"];
var dynCall_fiiii = Module["dynCall_fiiii"] = asm["dynCall_fiiii"];
var dynCall_fiiiii = Module["dynCall_fiiiii"] = asm["dynCall_fiiiii"];
var dynCall_viiiidd = Module["dynCall_viiiidd"] = asm["dynCall_viiiidd"];
var dynCall_viiiiidd = Module["dynCall_viiiiidd"] = asm["dynCall_viiiiidd"];
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
function __ZN13maxiDelayline2dlEdidi(Larg0,Larg1,Larg2,Larg3,Larg4){
	var L$poptgep$poptgep1$poptgepsqueezed=null,tmp1=0;
	tmp1=Larg0.i1|0;
	if((tmp1|0)>=(Larg2|0)){
		Larg0.i1=0;
		tmp1=0;
	}
	L$poptgep$poptgep1$poptgepsqueezed=Larg0.a5;
	Larg0.d4=+L$poptgep$poptgep1$poptgepsqueezed[(Larg4|0)<(Larg2|0)?Larg4|0:0|0];
	L$poptgep$poptgep1$poptgepsqueezed[tmp1]=Larg1*Larg3+ +L$poptgep$poptgep1$poptgepsqueezed[tmp1]*Larg3;
	Larg0.i1=tmp1+1|0;
	return +Larg0.d4;
}
function __ZN13maxiDelayline2dlEdid(Larg0,Larg1,Larg2,Larg3){
	var tmp0=0;
	tmp0=Larg0.i1|0;
	if((tmp0|0)>=(Larg2|0)){
		Larg0.i1=0;
		tmp0=0;
	}
	Larg0.d4=+Larg0.a5[tmp0];
	Larg0.a5[tmp0]=Larg1*Larg3*.5+ +Larg0.a5[tmp0]*Larg3;
	Larg0.i1=tmp0+1|0;
	return +Larg0.d4;
}
function __ZN13maxiDelaylineC1Ev(Larg0){
	var L$poptgep$poptgep$poptgepsqueezed=null,Lgeptoindexphi=0;
	L$poptgep$poptgep$poptgepsqueezed=Larg0.a5;
	Lgeptoindexphi=0;
	while(1){
		L$poptgep$poptgep$poptgepsqueezed[Lgeptoindexphi]=0;
		Lgeptoindexphi=Lgeptoindexphi+1|0;
		if(L$poptgep$poptgep$poptgepsqueezed!==L$poptgep$poptgep$poptgepsqueezed||88200!==(0+Lgeptoindexphi|0))continue;
		break;
	}
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
function __ZN10maxiFilterC1Ev(Larg0){
	Larg0.d6=0;
	Larg0.d7=0;
	Larg0.d8=0;
	Larg0.d9=0;
}
function __ZN10maxiFilter8bandpassEddd(Larg0,Larg1,Larg2,Larg3){
	var tmp0=-0.,tmp1=-0.,tmp2=-0.,tmp3=-0.,L$poptgep$poptgep2$poptgepsqueezed=null;
	Larg0.d10=Larg2;
	tmp1=(+(__ZN12maxiSettings10sampleRateE|0));
	tmp2=tmp1*.5;
	if(tmp2<Larg2)Larg0.d10=tmp2;
	else{
		tmp2=Larg2;
	}
	if(Larg3>=1){
		tmp3=.99999899999999997;
	}else{
		tmp3=Larg3;
	}
	tmp2=+Math.cos(tmp2*6.2831853071795862/tmp1);
	Larg0.d8=tmp2;
	tmp0=(1-tmp3)* +Math.sqrt(tmp3*(tmp3-tmp2*tmp2*4+2)+1);
	L$poptgep$poptgep2$poptgepsqueezed=Larg0.a3;
	L$poptgep$poptgep2$poptgepsqueezed[0]=tmp0;
	tmp2=tmp3*(tmp2*2);
	L$poptgep$poptgep2$poptgepsqueezed[1]=tmp2;
	tmp3*=tmp3;
	L$poptgep$poptgep2$poptgepsqueezed[2]=tmp3;
	L$poptgep$poptgep2$poptgepsqueezed=Larg0.a4;
	tmp1=+L$poptgep$poptgep2$poptgepsqueezed[1];
	tmp2=tmp0*Larg1+tmp2*tmp1+tmp3* +L$poptgep$poptgep2$poptgepsqueezed[2];
	Larg0.d2=tmp2;
	L$poptgep$poptgep2$poptgepsqueezed[2]=tmp1;
	L$poptgep$poptgep2$poptgepsqueezed[1]=tmp2;
	return tmp2;
}
function __ZN10maxiFilter5hiresEddd(Larg0,Larg1,Larg2,Larg3){
	var tmp0=-0.,tmp1=-0.,tmp2=-0.,tmp3=-0.;
	if(Larg2<10){
		tmp1=10;
	}else{
		tmp1=Larg2;
	}
	Larg0.d10=tmp1;
	tmp2=(+(__ZN12maxiSettings10sampleRateE|0));
	if(tmp1>tmp2){
		Larg0.d10=tmp2;
		tmp1=tmp2;
	}
	if(Larg3<1){
		tmp3=1;
	}else{
		tmp3=Larg3;
	}
	tmp1=+Math.cos(tmp1*6.2831853071795862/tmp2);
	Larg0.d8=tmp1;
	tmp2=2-tmp1*2;
	Larg0.d9=tmp2;
	tmp1+=-1;
	tmp0=+Math.sqrt(- +Math.pow(tmp1,3));
	tmp3*=tmp1;
	tmp1=+Larg0.d7;
	tmp2= +Larg0.d6+tmp2*(Larg1-tmp1);
	tmp1+=tmp2;
	Larg0.d7=tmp1;
	Larg0.d6=(tmp3+tmp0*1.4142135623730951)/tmp3*tmp2;
	tmp1=Larg1-tmp1;
	Larg0.d2=tmp1;
	return tmp1;
}
function __ZN10maxiFilter5loresEddd(Larg0,Larg1,Larg2,Larg3){
	var tmp0=-0.,tmp1=-0.,tmp2=-0.,tmp3=-0.;
	if(Larg2<10){
		tmp1=10;
	}else{
		tmp1=Larg2;
	}
	Larg0.d10=tmp1;
	tmp2=(+(__ZN12maxiSettings10sampleRateE|0));
	if(tmp1>tmp2){
		Larg0.d10=tmp2;
		tmp1=tmp2;
	}
	if(Larg3<1){
		tmp3=1;
	}else{
		tmp3=Larg3;
	}
	tmp1=+Math.cos(tmp1*6.2831853071795862/tmp2);
	Larg0.d8=tmp1;
	tmp2=2-tmp1*2;
	Larg0.d9=tmp2;
	tmp1+=-1;
	tmp0=+Math.sqrt(- +Math.pow(tmp1,3));
	tmp3*=tmp1;
	tmp1=+Larg0.d7;
	tmp2= +Larg0.d6+tmp2*(Larg1-tmp1);
	tmp1+=tmp2;
	Larg0.d7=tmp1;
	Larg0.d6=(tmp3+tmp0*1.4142135623730951)/tmp3*tmp2;
	Larg0.d2=tmp1;
	return tmp1;
}
function __ZN10maxiFilter6hipassEdd(Larg0,Larg1,Larg2){
	var tmp0=-0.;
	tmp0=+Larg0.a4[0];
	tmp0=Larg1-(tmp0+(Larg1-tmp0)*Larg2);
	Larg0.d2=tmp0;
	Larg0.a4[0]=tmp0;
	return tmp0;
}
function __ZN10maxiFilter6lopassEdd(Larg0,Larg1,Larg2){
	var tmp0=-0.;
	tmp0=+Larg0.a4[0];
	tmp0+=((Larg1-tmp0)*Larg2);
	Larg0.d2=tmp0;
	Larg0.a4[0]=tmp0;
	return tmp0;
}
function __ZN10maxiFilter12getResonanceEv(Larg0){
	return +Larg0.d11;
}
function __ZN10maxiFilter9getCutoffEv(Larg0){
	return +Larg0.d10;
}
function __ZN10maxiFilter12setResonanceEd(Larg0,Larg1){
	Larg0.d11=Larg1;
}
function __ZN10maxiFilter9setCutoffEd(Larg0,Larg1){
	Larg0.d10=Larg1;
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
function constructor_class$p_Z10maxiFilter(){
	this.d0=-0.;
	this.d1=-0.;
	this.d2=-0.;
	this.a3=new Float64Array(10);
	this.a4=new Float64Array(10);
	this.d5=-0.;
	this.d6=-0.;
	this.d7=-0.;
	this.d8=-0.;
	this.d9=-0.;
	this.d10=-0.;
	this.d11=-0.;
}
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
function maxiFilter(){
	this.d0=-0.;
	this.d1=-0.;
	this.d2=-0.;
	this.a3=new Float64Array(10);
	this.a4=new Float64Array(10);
	this.d5=-0.;
	this.d6=-0.;
	this.d7=-0.;
	this.d8=-0.;
	this.d9=-0.;
	this.d10=-0.;
	this.d11=-0.;
	;
	this.d=[this];
	if (arguments.length===1&&arguments[0]===undefined){
		return;
	}
	__ZN10maxiFilterC1Ev(this);
}
maxiFilter.prototype.setCutoff=function (a0){
	return __ZN10maxiFilter9setCutoffEd(this,a0);
};
maxiFilter.prototype.setResonance=function (a0){
	return __ZN10maxiFilter12setResonanceEd(this,a0);
};
maxiFilter.prototype.getCutoff=function (){
	return __ZN10maxiFilter9getCutoffEv(this);
};
maxiFilter.prototype.getResonance=function (){
	return __ZN10maxiFilter12getResonanceEv(this);
};
maxiFilter.prototype.setCutoff=function (a0){
	return __ZN10maxiFilter9setCutoffEd(this,a0);
};
maxiFilter.prototype.setResonance=function (a0){
	return __ZN10maxiFilter12setResonanceEd(this,a0);
};
maxiFilter.prototype.getCutoff=function (){
	return __ZN10maxiFilter9getCutoffEv(this);
};
maxiFilter.prototype.getResonance=function (){
	return __ZN10maxiFilter12getResonanceEv(this);
};
maxiFilter.prototype.lopass=function (a0,a1){
	return __ZN10maxiFilter6lopassEdd(this,a0,a1);
};
maxiFilter.prototype.hipass=function (a0,a1){
	return __ZN10maxiFilter6hipassEdd(this,a0,a1);
};
maxiFilter.prototype.lores=function (a0,a1,a2){
	return __ZN10maxiFilter5loresEddd(this,a0,a1,a2);
};
maxiFilter.prototype.hires=function (a0,a1,a2){
	return __ZN10maxiFilter5hiresEddd(this,a0,a1,a2);
};
maxiFilter.prototype.bandpass=function (a0,a1,a2){
	return __ZN10maxiFilter8bandpassEddd(this,a0,a1,a2);
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
function maxiDelayline(){
	this.d0=-0.;
	this.i1=0;
	this.d2=-0.;
	this.d3=-0.;
	this.d4=-0.;
	this.a5=new Float64Array(176400);
	;
	this.d=[this];
	if (arguments.length===1&&arguments[0]===undefined){
		return;
	}
	__ZN13maxiDelaylineC1Ev(this);
}
maxiDelayline.prototype.dl=function (a0,a1,a2){
	return __ZN13maxiDelayline2dlEdid(this,a0,a1,a2);
};
maxiDelayline.prototype.dl=function (a0,a1,a2,a3){
	return __ZN13maxiDelayline2dlEdidi(this,a0,a1,a2,a3);
};
maxiSettings.promise=
maxiFilter.promise=
maxiTrigger.promise=
maxiMap.promise=
maxiNonlinearity.promise=
maxiBiquad.promise=
maxiIndex.promise=
maxiRatioSeq.promise=
maxiOsc.promise=
maxiDelayline.promise=
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
Module.maxiFilter = maxiFilter;
Module.maxiDelayline = maxiDelayline;

// Module.cheerpTypes = cheerpTypes;
// Module.maxiFilter = maxiFilter;
// Module.maxiZeroCrossingDetector = maxiZeroCrossingDetector;

// Module.cheerpTypes2 = cheerpTypes2;
// Module.vectorTest = vectorTest;

