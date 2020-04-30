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
  'initial': 920,
  'maximum': 920 + 0,
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
    STACK_BASE = 5284368,
    STACKTOP = STACK_BASE,
    STACK_MAX = 41488,
    DYNAMIC_BASE = 5284368,
    DYNAMICTOP_PTR = 41328;




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




var wasmBinaryFile = 'data:application/octet-stream;base64,AGFzbQEAAAAB7QqiAWABfwF/YAF/AGACf38AYAJ/fwF/YAN/f38Bf2ADf39/AGAFf39/f38Bf2AAAGAEf39/fwF/YAZ/f39/f38Bf2AFf39/f38AYAR/f39/AGAAAX9gBn9/f39/fwBgCH9/f39/f39/AX9gAn98AGABfwF8YAJ8fAF8YAd/f39/f39/AX9gAn98AXxgA398fAF8YAR/fHx8AXxgAXwBfGAHf39/f39/fwBgAn9/AXxgBH9/f3wAYAN/f3wAYAV/fn5+fgBgA39+fwF+YAF9AX1gA39/fwF8YAR/fHx/AXxgCn9/f39/f39/f38AYAN/fH8AYAV/f39/fgF/YAN/fH8BfGAFf39+f38AYAZ/f3x8fH8AYAV/f39/fAF/YAR/f39/AX5gAX8BfWACf38BfWAEf398fwF8YAV/f3x8fwF8YAZ/fH98fHwBfGAFf3x8f3wBfGAFf3x8fH8BfGAGf3x8fHx8AXxgCH9/f39/f39/AGAHf39/f398fABgBn9/f398fABgBH9/f30AYAZ/f319f38AYAR/f3x/AGAFf398f3wAYAZ/f3x/fHwAYAd/f3x/fHx8AGAEf398fABgBH9+fn8AYAV/fX1/fwBgBH98f3wAYAV/fH98fABgBn98f3x8fABgA398fABgBX98fHx/AGAKf39/f39/f39/fwF/YAd/f39/f35+AX9gBn9/f39+fgF/YAR/f398AX9gBH9/fX8Bf2ADf31/AX9gBn98f39/fwF/YAR/f39/AX1gBX9/f39/AX1gBH9/f38BfGADf398AXxgBX9/fH9/AXxgBX9/fH98AXxgBn9/fH98fwF8YAd/f3x/fHx8AXxgBH9/fHwBfGAGf398fH98AXxgB39/fHx/fHwBfGAFf398fHwBfGAGf398fHx/AXxgB39/fHx8f38BfGAHf398fHx/fAF8YAd/f3x8fHx8AXxgCX9/fHx8fHx/fwF8YAR/fH9/AXxgBH98f3wBfGAFf3x/fH8BfGAGf3x8f3x8AXxgBn98fHx/fwF8YAZ/fHx8f3wBfGAIf3x8fHx8f38BfGAPf39/f39/f39/f39/f39/AGADf399AGACf34AYAl/f39/f39/f38Bf2ALf39/f39/f39/f38Bf2AMf39/f39/f39/f39/AX9gBH9/f30Bf2ADf35/AX9gAn98AX9gAn5/AX9gAn5+AX9gAXwBf2ABfwF+YAR/f39+AX5gA39/fwF9YAJ9fwF9YAF8AX1gAnx/AXxgA3x8fwF8YAN8fHwBfGAMf39/f39/f39/f39/AGANf39/f39/f39/f39/fwBgCH9/f39/f3x8AGAFf39/f30AYAV/f39/fABgB39/f319f38AYAV/f398fwBgBn9/f3x/fABgB39/f3x/fHwAYAh/f398f3x8fABgBX9/f3x8AGAHf39/fHx8fwBgA39/fgBgA39+fgBgAn99AGAGf39/f398AX9gBX9/f399AX9gBX9/f31/AX9gA39/fAF/YAd/f3x/f39/AX9gA35/fwF/YAR+fn5+AX9gAn1/AX9gAnx/AX9gAn9/AX5gBn9/f39/fwF9YAJ+fgF9YAJ9fQF9YAV/f39/fwF8YAR/f398AXxgBX9/f3x/AXxgBn9/f3x/fwF8YAZ/f398f3wBfGAHf39/fH98fwF8YAh/f398f3x8fAF8YAV/f398fAF8YAZ/f398fH8BfGAHf39/fHx/fAF8YAh/f398fH98fAF8YAZ/f398fHwBfGAHf39/fHx8fwF8YAh/f398fHx/fwF8YAh/f398fHx/fAF8YAh/f398fHx8fAF8YAp/f398fHx8fH9/AXxgAn5+AXwClgktA2VudhZfZW1iaW5kX3JlZ2lzdGVyX2NsYXNzAHUDZW52Il9lbWJpbmRfcmVnaXN0ZXJfY2xhc3NfY29uc3RydWN0b3IADQNlbnYlX2VtYmluZF9yZWdpc3Rlcl9jbGFzc19jbGFzc19mdW5jdGlvbgAXA2Vudh9fZW1iaW5kX3JlZ2lzdGVyX2NsYXNzX2Z1bmN0aW9uADADZW52H19lbWJpbmRfcmVnaXN0ZXJfY2xhc3NfcHJvcGVydHkAIANlbnYVX2VtYmluZF9yZWdpc3Rlcl9lbnVtAAsDZW52G19lbWJpbmRfcmVnaXN0ZXJfZW51bV92YWx1ZQAFA2VudhpfZW1iaW5kX3JlZ2lzdGVyX3NtYXJ0X3B0cgB0A2VudhhfX2N4YV9hbGxvY2F0ZV9leGNlcHRpb24AAANlbnYLX19jeGFfdGhyb3cABQNlbnYRX2VtdmFsX3Rha2VfdmFsdWUAAwNlbnYNX2VtdmFsX2luY3JlZgABA2Vudg1fZW12YWxfZGVjcmVmAAEDZW52C19lbXZhbF9jYWxsAAgDZW52BXJvdW5kABYDZW52BGV4aXQAAQNlbnYNX19hc3NlcnRfZmFpbAALA2VudgZfX2xvY2sAAQNlbnYIX191bmxvY2sAARZ3YXNpX3NuYXBzaG90X3ByZXZpZXcxCGZkX2Nsb3NlAAADZW52Cl9fc3lzY2FsbDUAAwNlbnYMX19zeXNjYWxsMjIxAAMDZW52C19fc3lzY2FsbDU0AAMWd2FzaV9zbmFwc2hvdF9wcmV2aWV3MQdmZF9yZWFkAAgWd2FzaV9zbmFwc2hvdF9wcmV2aWV3MQhmZF93cml0ZQAIFndhc2lfc25hcHNob3RfcHJldmlldzERZW52aXJvbl9zaXplc19nZXQAAxZ3YXNpX3NuYXBzaG90X3ByZXZpZXcxC2Vudmlyb25fZ2V0AAMDZW52Cl9fbWFwX2ZpbGUAAwNlbnYLX19zeXNjYWxsOTEAAwNlbnYKc3RyZnRpbWVfbAAGA2VudgVhYm9ydAAHA2VudhVfZW1iaW5kX3JlZ2lzdGVyX3ZvaWQAAgNlbnYVX2VtYmluZF9yZWdpc3Rlcl9ib29sAAoDZW52G19lbWJpbmRfcmVnaXN0ZXJfc3RkX3N0cmluZwACA2VudhxfZW1iaW5kX3JlZ2lzdGVyX3N0ZF93c3RyaW5nAAUDZW52Fl9lbWJpbmRfcmVnaXN0ZXJfZW12YWwAAgNlbnYYX2VtYmluZF9yZWdpc3Rlcl9pbnRlZ2VyAAoDZW52Fl9lbWJpbmRfcmVnaXN0ZXJfZmxvYXQABQNlbnYcX2VtYmluZF9yZWdpc3Rlcl9tZW1vcnlfdmlldwAFA2VudhZlbXNjcmlwdGVuX3Jlc2l6ZV9oZWFwAAADZW52FWVtc2NyaXB0ZW5fbWVtY3B5X2JpZwAEA2VudgtzZXRUZW1wUmV0MAABFndhc2lfc25hcHNob3RfcHJldmlldzEHZmRfc2VlawAGA2VudgZtZW1vcnkCAIAQA2VudgV0YWJsZQFwAJgHA48K6wkHBwcHBwcHAAEADAIBAAsFAAxKGRAPGBoAAgMFAAxNTgAMU1AQDxAPAAw2NzgADBNLQCUPAABEGRVzAAw/OQ8QEA8QDw8AAQwACwgCATQIAAxSVwAMVVgqAAIAGBgWExMADBQADCxPAAwsAAwUAAwPDy8AFBERERERERERERYRAAwAAAIAAhACEAICAAIADB8rAAEDABQhNQIYHgAAAAAUIQIAAQwKRSkDAAAAAAAAAAEMSQABDDIxAwQAAQwCBQULAAUEBAgAAhoFGQAFBEQAAgUFCwAFBAgABQBhMwVmBSEHAAEADAMBAAECEA8tUR8rAAEDAQItAAwCDw8AXlYuVCUHAAMEAwMDCAQDAwMAAAADAwMDAwMDAwMMEBBoawAMFAAMHwAMIypZTAcAAQwADAECBQIFAgIAAAQCAAEBAwEAAQEQAAQAAQMAAQEHExMeGgBaWxQUFRUVPD0+BAADBAIABAADAAACBQUBEBUuFRATFBMVFBMPO1wvEw8PD11fIw8PDxAAAQEAAQIEJAcLAAMDCQ8BAgtGACgoC0gNCwICAQUKBQoKAgEBABMAFQMBAAgACAkDAw0LAQADBAQECwgKCAAAAw4KDW9vBAULAg0CAAIAHAABBAgCDAMDA3EGEgUACwppiAFpBEcCBQwAAgFsbAAACGdnAgAAAAMDDAAIBAAAHAQABAEAAAAAOjqhAREGiwFyFnBwigEdFh1yFh2PAR0WHREEDAAAAQEAAQACBCQLBAUAAAMEAAEABAUABAAAAQEDAQADAAADAwEDAAMFYgEAAwADAwMAAwAAAQEAAAADAwMCAgICAQICAAADBwEBBwEHBQIFAgIAAAECAAMAAwECAAMAAwIABAMCBANiAIEBbQiCARsCGw+JAWobAhs6GwsNF4wBjgEEA4ABBAQEAwcEAAIDDAQDAwEABAgIBm0nJykLGAULBgsFBAYLBQQJABIDBAkGAAUAAkEICwkGJwkGCAkGCAkGJwkGCmVuCQYeCQYLCQwEAQQDCQASCQYDBUEJBgkGCQYJBgkGCmUJBgkGCQQDBgAABgsGBBcCACIGIiYEAAgXQwYGAAYXCQIEIgYiJhdDBgICDgAJCQkNCQ0JCgYOCwoKCgoKCgsNCgoKDgkJCQ0JDQkKBg4LCgoKCgoKCw0KCgoSDQIEEg0GBwQAAgICAAISZCACBQUSAQUAAgAEAwISZCACEgEFAAIABANCIGAECUIgYAQJBAQEDQUCDQsLAAcHBwEBAgACBwwBAAEBAQwBAwECAQEECAgIAwQDBAMIBAYAAQMEAwQIBAYOBgYBDgYEDgkGBgAAAAYIAA4JDgkGBAAOCQ4JBgQAAQABAAACAgICAgICAgAHAQAHAQIABwEABwEABwEABwEAAQABAAEAAQABAAEAAQABAQAMAwEDAAUCAQAIAgELAAIBAAEBBQEBAwIAAgQEBwIFAAUwAgICCgUFAgEFBTAKBQIFBwcHAAABAQEABAQEAwULCwsLAwQDAwsKDQoKCg0NDQAABwcHBwcHBwcHBwcHBwEBAQEBAQcHBwcAAAEDAwIAERsWHXFqBAQFAgwAAQAFCkqQARl4Gh5NlAFOlQFTmwFQlwE2ezd8OH1LkQElfyY5fgY0eVKaAVefAVWdAVigASqSAU+WASuYATV6DUWFASluSY0BMXYzd4QBUZkBVp4BVJwBhgFMkwGHAQljEoMBDhcBFwYSY0EGEAJ/AUHwwsICC38AQezCAgsHvA5qEV9fd2FzbV9jYWxsX2N0b3JzACsGbWFsbG9jALAJBGZyZWUAsQkQX19lcnJub19sb2NhdGlvbgCGBAhzZXRUaHJldwC/CRlfWlN0MTh1bmNhdWdodF9leGNlcHRpb252AM8EDV9fZ2V0VHlwZU5hbWUAlwkqX19lbWJpbmRfcmVnaXN0ZXJfbmF0aXZlX2FuZF9idWlsdGluX3R5cGVzAJgJCl9fZGF0YV9lbmQDAQlzdGFja1NhdmUAwAkKc3RhY2tBbGxvYwDBCQxzdGFja1Jlc3RvcmUAwgkQX19ncm93V2FzbU1lbW9yeQDDCQpkeW5DYWxsX2lpAK8CCmR5bkNhbGxfdmkANglkeW5DYWxsX2kANAtkeW5DYWxsX3ZpaQDECQ1keW5DYWxsX3ZpaWlpAMUJDGR5bkNhbGxfdmlpaQA5DGR5bkNhbGxfZGlpaQDGCQ1keW5DYWxsX2RpaWlpAMcJDGR5bkNhbGxfdmlpZADICQ1keW5DYWxsX3ZpaWlkAMkJCmR5bkNhbGxfZGkAhwELZHluQ2FsbF92aWQAygkLZHluQ2FsbF9kaWkAywkLZHluQ2FsbF9paWkAsAINZHluQ2FsbF9kaWRpZADMCQ5keW5DYWxsX2RpaWRpZADNCQ5keW5DYWxsX2RpZGlkaQDOCQ9keW5DYWxsX2RpaWRpZGkAzwkNZHluQ2FsbF9kaWRkZADQCQ5keW5DYWxsX2RpaWRkZADRCQxkeW5DYWxsX2RpZGQA0gkNZHluQ2FsbF9kaWlkZADTCQ1keW5DYWxsX3ZpZGlkANQJDmR5bkNhbGxfdmlpZGlkANUJDmR5bkNhbGxfdmlkaWRkANYJD2R5bkNhbGxfdmlpZGlkZADXCQ9keW5DYWxsX3ZpZGlkZGQA2AkQZHluQ2FsbF92aWlkaWRkZADZCQtkeW5DYWxsX2RpZADaCQxkeW5DYWxsX2RpaWQA2wkOZHluQ2FsbF92aWRkZGkA3AkPZHluQ2FsbF92aWlkZGRpAN0JDWR5bkNhbGxfaWlpaWQA3gkMZHluQ2FsbF9kZGRkAGMMZHluQ2FsbF92aWRkAN8JDWR5bkNhbGxfdmlpZGQA4AkMZHluQ2FsbF9paWlpALQCDWR5bkNhbGxfaWlpaWkA4QkOZHluQ2FsbF92aWZmaWkA4gkPZHluQ2FsbF92aWlmZmlpAOMJD2R5bkNhbGxfZGlkZGlkZADkCRBkeW5DYWxsX2RpaWRkaWRkAOUJD2R5bkNhbGxfZGlkZGRkZADmCRBkeW5DYWxsX2RpaWRkZGRkAOcJD2R5bkNhbGxfZGlkZGRpaQDoCRBkeW5DYWxsX2RpaWRkZGlpAOkJEWR5bkNhbGxfZGlkZGRkZGlpAOoJEmR5bkNhbGxfZGlpZGRkZGRpaQDrCQxkeW5DYWxsX2RpZGkA7AkNZHluQ2FsbF9kaWlkaQDtCQpkeW5DYWxsX2RkAIoBD2R5bkNhbGxfZGlkaWRkZADuCRBkeW5DYWxsX2RpaWRpZGRkAO8JC2R5bkNhbGxfZGRkAJ4BDWR5bkNhbGxfZGlkZGkA8AkOZHluQ2FsbF9kaWlkZGkA8QkMZHluQ2FsbF92aWRpAPIJDWR5bkNhbGxfdmlpZGkA8wkOZHluQ2FsbF92aWlpaWkA9AkMZHluQ2FsbF9paWZpAPUJDWR5bkNhbGxfaWlpZmkA9gkKZHluQ2FsbF9maQD3CQtkeW5DYWxsX2ZpaQD4CQ1keW5DYWxsX2ZpaWlpAPkJDmR5bkNhbGxfZmlpaWlpAPoJD2R5bkNhbGxfdmlpaWlkZAD7CRBkeW5DYWxsX3ZpaWlpaWRkAPwJDGR5bkNhbGxfdmlpZgD9CQ1keW5DYWxsX3ZpaWlmAP4JDWR5bkNhbGxfaWlpaWYA/wkOZHluQ2FsbF9kaWRkaWQAgAoPZHluQ2FsbF9kaWlkZGlkAIEKD2R5bkNhbGxfZGlkZGRpZACCChBkeW5DYWxsX2RpaWRkZGlkAIMKDmR5bkNhbGxfZGlkZGRpAIQKD2R5bkNhbGxfZGlpZGRkaQCFCgtkeW5DYWxsX2lpZACGCgpkeW5DYWxsX2lkAMgCDWR5bkNhbGxfZGlkaWkAhwoOZHluQ2FsbF9kaWlkaWkAiAoOZHluQ2FsbF92aWlqaWkAkQoMZHluQ2FsbF9qaWppAJIKD2R5bkNhbGxfaWlkaWlpaQCJCg5keW5DYWxsX2lpaWlpaQCKChFkeW5DYWxsX2lpaWlpaWlpaQCLCg9keW5DYWxsX2lpaWlpaWkAjAoOZHluQ2FsbF9paWlpaWoAkwoOZHluQ2FsbF9paWlpaWQAjQoPZHluQ2FsbF9paWlpaWpqAJQKEGR5bkNhbGxfaWlpaWlpaWkAjgoQZHluQ2FsbF9paWlpaWlqagCVCg9keW5DYWxsX3ZpaWlpaWkAjwoJZHluQ2FsbF92AJAKCewMAQBBAQuXBzIzNDU2NzY3ODM5OjszNDz7Aj38Aj4/QEFCQ0RFRkczNEj+Akn/AkpLMzRMggNNgwOEA4ADToEDT1BBQlFSUzM0VIUDVYYDVocDV1gzNFlaW1xdXkJfRWAzYWJjZGUzNGZnaGlCakFrbEFCbW5vcHE0cnNFkwNGlQN0jgN1kgNFmwNBngNbnAOdA06fA02XA6EDmAOaA5YDdneiA0KjA3iIA3mJA6ADejM0e6QDfKUDfaYDW6cDQqgDqQNufjM0f6oDgAGrA4EBrAOCAa0DQqcDrwOuA4MBhAFFRoUBMzQ1sAOGAYcBiAGJAYoBiwEzNIwBjQFOjgEzNI8BkAGRAZIBMzSTAZQBkQGVATM0lgGXAU6YATM0mQGaAUKbAZwBfZ0BMzQ1ngGfAaABoQGiAaMBpAGlAaYBpwGoAakBqgEzNKsBwAN2vwNCwQNGrAFFrQGuAUVGrwGwAYMBhAGxAbIBQbMBtAGsAbUBRbYBtwG4ATM0uQG6AbsBbEJrQbwBvQG+Ab8BwAFOwQHCAcMBRsQBxQHGAUXHAcgByAG9Ab4ByQHKAU7LAcIBzAFGxAHFAcYBRc0BzgE0zwHCA9ABwwPRAcUD0gHGA8gB0wHUAdUB1gFF1wHYAdkB2gHbATTcAccD0AHIA90B3gHfATTgAeEB4gHjAeQB5QHmATTnAegB6QHqAesB7AFF7QHuAe8B8AHxAeYBNOcB8gHzAfQB9QH2AUX3Ae4B+AH5AfoB5gE05wH7AfwB/QH+Af8BRYAC7gGBAoICgwLmATTnAfsB/AH9Af4B/wFFhALuAYECggKFAuYBNOcB6AGGAuoBhwLsAUWIAu4B7wGJAo0CjgKPApACkQKSApMClAKVAkaWAkFrlwJCmAKZApoCmwKcAp0CjwKQAp4CkgKTAp8CoAJGoQKZAqICjgI0owKkAkaWAkFrlwJCpQKmAqcCRagCqQKqAqsCrgIzrwLIAbACsQKyArMCtAK1ArYCtwK4ArkCugK7ArwCvQK+Ar8CwALBAsICwwLEAjTFAocBxgLHAsgCyQLXAtgCNNkC1wNb2gLYAjTbAtkDTfsIygIzNMsCzAJOzQIzNM4CzwK7AdACMzTRAtIC0wLUAtUC5wLoAukC6gLrAuwC7QLuAtwI6wLvAsgB6wLyAvMC6QL0AusC9QL2AvcC6wLIAZEDsgOxA7MD6ATqBOkE6wSNA7UDtgO3A7gDugO0A64E2wS7A94EvAPgBL0D5wPaA6QEsgSABJUElgSsBK4ErwSwBNQE1QTXBNgE2QTaBK4E3QTfBN8E4QTiBNcE2ATZBNoErgSuBOQE3QTmBN8E5wTfBOgE6gTpBOsEgwWFBYQFhgWDBYUFhAWGBdEEkQXQBNME0ATTBJgFpAWlBaYFqAWpBaoFqwWsBa4FrwWkBbAFsQWyBbMFqgW0BbEFtQW2BdIFsQmCBNwH3wejCKYIqgitCLAIswi1CLcIuQi7CL0IvwjBCMMI1QfXB94H7AftB+4H7wfwB/EH6AfyB/MH9AfJB/gH+Qf8B/8HgAiuBIMIhQiTCJQIlwiYCJkImwieCJUIlgjIBsIGmgicCJ8IyAHrAusC4AfhB+IH4wfkB+UH5gfnB+gH6QfqB+sH6wL1B/UH9geBBIEE9weBBOsChgiICPYHrgSuBIoIjAjrAo0Ijwj2B64ErgSRCIwI6wLrAsgB6wLrBewF7gXIAesC7wXwBfIF6wLzBfgFgQaEBocGhwaKBo0GkgaVBpgG6wKeBqEGpgaoBqoGqgasBq4Gsga0BrYG6wK5BrwGwwbEBsUGxgbLBswG6wLNBs8G1AbVBtYG1wbZBtoGyAHrAt4G3wbgBuEG4wblBugGoQioCK4IvAjACLQIuAjIAesC3gb2BvcG+Ab6BvwG/wakCKsIsQi+CMIItgi6CMUIxAiM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AEEIEN4IIgFC4gA3AwBB+CxBjQtB4PABQcAmQd4AIABB4PABQagbQd8AIAEQBEGMLkGkLkHELkEAQZAYQeMAQZMYQQBBkxhBAEGRC0GVGEHkABAAQYwuQQFB1C5BkBhB5QBB5gAQAUEIEN4IIgBC5wA3AwBBjC5BnAtBAkHYLkHQGEHoACAAQQAQA0EIEN4IIgBC6QA3AwBBjC5BpgtBA0HgLkGoGEHqACAAQQAQA0EIEN4IIgBC6wA3AwBBjC5BpgtBBEHwLkHAGEHsACAAQQAQA0EIEN4IIgBC7QA3AwBBjC5BsAtBBEGAL0GgGUHuACAAQQAQA0EIEN4IIgBC7wA3AwBBjC5BxQtBAkGQL0HQGEHwACAAQQAQA0EIEN4IIgBC8QA3AwBBjC5BzQtBAkGYL0HAJkHyACAAQQAQA0EIEN4IIgBC8wA3AwBBjC5BzQtBA0GgL0GgK0H0ACAAQQAQA0EIEN4IIgBC9QA3AwBBjC5B1gtBA0GgL0GgK0H0ACAAQQAQA0EIEN4IIgBC9gA3AwBBjC5B1gtBBEGwL0GAKUH3ACAAQQAQA0EIEN4IIgBC+AA3AwBBjC5B1gtBBUHAL0HkKEH5ACAAQQAQA0EIEN4IIgBC+gA3AwBBjC5BnQpBAkGYL0HAJkHyACAAQQAQA0EIEN4IIgBC+wA3AwBBjC5BnQpBA0GgL0GgK0H0ACAAQQAQA0EIEN4IIgBC/AA3AwBBjC5BnQpBBUHAL0HkKEH5ACAAQQAQA0EIEN4IIgBC/QA3AwBBjC5B3wtBBUHAL0HkKEH5ACAAQQAQA0EIEN4IIgBC/gA3AwBBjC5BiwlBAkHUL0G4JEH/ACAAQQAQA0EIEN4IIgBCgAE3AwBBjC5B5QtBAkHUL0G4JEH/ACAAQQAQA0EIEN4IIgBCgQE3AwBBjC5B6wtBA0HcL0GoG0GCASAAQQAQA0EIEN4IIgBCgwE3AwBBjC5B9QtBBkHwL0GIMEGEASAAQQAQA0EIEN4IIgBChQE3AwBBjC5B/gtBBEGQMEGgGUGGASAAQQAQA0EIEN4IIgBChwE3AwBBjC5BgwxBAkGQL0HQGEHwACAAQQAQA0EIEN4IIgBCiAE3AwBBjC5BiAxBBEGwL0GAKUH3ACAAQQAQA0G0MUHIMUHkMUEAQZAYQYkBQZMYQQBBkxhBAEGXDEGVGEGKARAAQbQx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IQAgAyAENgIEIAQQsQkgAygCECIEBEAgAyAENgIUIAQQsQkLIAMoAiAiBARAIAMgBDYCJCAEELEJCyADQTBqJAAgAAsFAEH4LAswAQF/QRgQ3ggiAEIANwMQIABCgICAgICAgPA/NwMIIABCgICAgICAgPA/NwMAIAALIQAgACACOQMQIAAgATkDACAARAAAAAAAAPA/IAGhOQMICzkBAX8gASAAKAIEIgRBAXVqIQEgACgCACEAIAEgAiADIARBAXEEfyABKAIAIABqKAIABSAACxE/AAsbACAAIAArAwAgAaIgACsDCCAAKwMQoqA5AxALBwAgACsDEAsHACAAKwMACwkAIAAgATkDAAsHACAAKwMICwkAIAAgATkDCAsJACAAIAE5AxALBQBBjC4LNwEBfyAABEAgACgCbCIBBEAgACABNgJwIAEQsQkLIAAsAAtBf0wEQCAAKAIAELEJCyAAELEJCwuJAQECf0GIARDeCCIAQgA3AgAgAEIANwMoIABBATsBYCAAQgA3A1ggAEKAgICAgICA8D83A1AgAEKAgICAgICA8D83A0ggAEEANgIIIABCADcDMEH0/wEoAgAhASAAQQA2AnQgAEIANwJsIAAgATYCZCAAQQE6AIABIABCgICAgICAgPg/NwN4IAALEAAgACgCcCAAKAJsa0EDdQs5AQF/IAEgACgCBCIEQQF1aiEBIAAoAgAhACABIAIgAyAEQQFxBH8gASgCACAAaigCAAUgAAsRBQALOQEBfyABIAAoAgQiBEEBdWohASAAKAIAIQAgASACIAMgBEEBcQR/IAEoAgAgAGooAgAFIAALEQQACzUBAX8gASAAKAIEIgJBAXVqIQEgACgCACEAIAEgAkEBcQR/IAEoAgAgAGooAgAFIAALEQEACwwAIAAgACgCbDYCcAs9AQF/IAEgACgCBCIGQQF1aiEBIAAoAgAhACABIAIgAyAEIAUgBkEBcQR/IAEoAgAgAGooAgAFIAALETsAC+UBAQR/IwBBEGsiBCQAIAEgACgCBCIGQQF1aiEHIAAoAgAhBSAGQQFxBEAgBygCACAFaigCACEFCyACKAIAIQAgBEEANgIIIARCADcDACAAQXBJBEACQAJAIABBC08EQCAAQRBqQXBxIgYQ3gghASAEIAZBgICAgHhyNgIIIAQgATYCACAEIAA2AgQM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BkEQaiIGIApGDQEgAC0AGCEJDAAACwALIABBADoAGCAAKAIQIQMgACgCDCEAIAdBEGokACANIAMgAGtBA3W4owsZACAAKAIAIAJBBHRqIAE5AwAgAEEBOgAYC04BA38gASgCACICIAEoAgQiA0cEQCAAKAIAIQRBACEBA0AgBCABQQR0aiACKQMANwMAIAFBAWohASACQQhqIgIgA0cNAAsLIABBAToAGAsGAEH8wAALDwAgAARAIAAQ4wIQsQkLC24BAX9BlAEQ3ggiAEIANwJQIABCADcCACAAQgA3AnggAEIANwJwIABCADcCaCAAQgA3AmAgAEIANwJYIABCADcCCCAAQgA3AhAgAEIANwIYIABCADcCICAAQgA3AiggAEIANwIwIABBADYCOCAACzsBAX8gASAAKAIEIgVBAXVqIQEgACgCACEAIAEgAiADIAQgBUEBcQR/IAEoAgAgAGooAgAFIAALEQsACzkBAX8gASAAKAIEIgRBAXVqIQEgACgCACEAIAEgAiADIARBAXEEfyABKAIAIABqKAIABSAACxFGAAs1AQF/IAEgACgCBCICQQF1aiEBIAAoAgAhACABIAJBAXEEfyABKAIAIABqKAIABSAACxEoAAu8AQECfyABIAAoAgQiAkEBdWohASAAKAIAIQAgASACQQFxBH8gASgCACAAaigCAAUgAAsRAAAhAUEMEN4IIgBBADYCCCAAQgA3AgACQAJAIAEoAgQgASgCAGsiAkUNACACQQJ1IgNBgICAgARPDQEgACACEN4IIgI2AgAgACACNgIEIAAgAiADQQJ0ajYCCCABKAIEIAEoAgAiA2siAUEBSA0AIAAgAiADIAEQvAkgAWo2AgQLIAAPCxD3CAALBwAgABDEAwsHACAAQQxqCwgAIAAoAowBCwcAIAAoAkQLCAAgACgCiAELCAAgACgChAELBgBBvMIAC1gBAX8gAARAIABBPGoQzQMgACgCGCIBBEAgACABNgIcIAEQsQkLIAAoAgwiAQRAIAAgATYCECABELEJCyAAKAIAIgEEQCAAIAE2AgQgARCxCQsgABCxCQsLWQEBf0H0ABDeCCIAQgA3AkQgAEIANwIAIABCADcCbCAAQgA3AmQgAEIANwJcIABCADcCVCAAQgA3AkwgAEIANwIIIABCADcCECAAQgA3AhggAEEANgIgIAALOwEBfyABIAAoAgQiBUEBdWohASAAKAIAIQAgASACIAMgBCAFQQFxBH8gASgCACAAaigCAAUgAAsRSAALBgBB9MMAC1QBAX8gAARAAkAgACgCJCIBRQ0AIAEQsQkgACgCACIBBEAgARCxCQsgACgCLCIBRQ0AIAEQsQkLIAAoAjAiAQRAIAAgATYCNCABELEJCyAAELEJCwsoAQF/QcAAEN4IIgBCADcCLCAAQQA2AiQgAEEANgIAIABCADcCNCAAC6YDAgN/AnwjAEEQayIIJAAgACAFOQMYIAAgBDkDECAAIAM2AgggACACNgIEQfT/ASgCACEGIAAgATYCKCAAIAY2AiAgAEEANgIkIAAgAkEDdCIGELAJNgIAIAhCADcDCAJAIAAoAjQgACgCMCIHa0EDdSICIANJBEAgAEEwaiADIAJrIAhBCGoQigIMAQsgAiADTQ0AIAAgByADQQN0ajYCNAsgACADIAZsELAJNgIsIAAgACgCILggARCLAgJAIAAoAgQiA0UNACAAKAIIIgZFDQBEGC1EVPshCUAgA7giBKMhBUQAAAAAAADwPyAEn6MhCUQAAAAAAAAAQCAEo58hBCAAKAIsIQdBACEBA0AgAUEBaiECQQAhAAJAIAEEQCAFIAK3oiEKA0AgByAAIAZsIAFqQQN0aiAEIAogALdEAAAAAAAA4D+gohC/BKI5AwAgAEEBaiIAIANHDQALDAELA0AgByAAIAZsQQN0aiAJIAUgALdEAAAAAAAA4D+gohC/BKI5AwAgAEEBaiIAIANHDQALCyACIgEgBkcNAAsLIAhBEGokAAs/AQF/IAEgACgCBCIHQQF1aiEBIAAoAgAhACABIAIgAyAEIAUgBiAHQQFxBH8gASgCACAAaigCAAUgAAsRMgAL1QECB38BfCAAIAEoAgAQ0wMgAEEwaiEEIAAoAggiAgRAQQAhASAAKAIwQQAgAkEDdBC9CSEDIAAoAgQiBQRAIAAoAgAhBiAAKAIsIQcDQCADIAFBA3RqIggrAwAhCUEAIQADQCAIIAcgACACbCABakEDdGorAwAgBiAAQQN0aisDAKIgCaAiCTkDACAAQQFqIgAgBUcNAAsgAUEBaiIBIAJHDQALCyACuCEJQQAhAANAIAMgAEEDdGoiASABKwMAIAmjOQMAIABBAWoiACACRw0ACwsgBAu+AQEBfyABIAAoAgQiA0EBdWohASAAKAIAIQAgASACIANBAXEEfyABKAIAIABqKAIABSAACxEDACEBQQwQ3ggiAEEANgIIIABCADcCAAJAAkAgASgCBCABKAIAayICRQ0AIAJBA3UiA0GAgICAAk8NASAAIAIQ3ggiAjYCACAAIAI2AgQgACACIANBA3RqNgIIIAEoAgQgASgCACIDayIBQQFIDQAgACACIAMgARC8CSABajYCBAsgAA8LEPcIAAsFAEGIFwskAQF/IAAEQCAAKAIAIgEEQCAAIAE2AgQgARCxCQsgABCxCQsLGQEBf0EMEN4IIgBBADYCCCAAQgA3AgAgAAswAQF/IAAoAgQiAiAAKAIIRwRAIAIgASgCADYCACAAIAJBBGo2AgQPCyAAIAEQ3QILUgECfyMAQRBrIgMkACABIAAoAgQiBEEBdWohASAAKAIAIQAgBEEBcQRAIAEoAgAgAGooAgAhAAsgAyACNgIMIAEgA0EMaiAAEQIAIANBEGokAAs+AQJ/IAAoAgQgACgCACIEa0ECdSIDIAFJBEAgACABIANrIAIQ3gIPCyADIAFLBEAgACAEIAFBAnRqNgIECwtUAQJ/IwBBEGsiBCQAIAEgACgCBCIFQQF1aiEBIAAoAgAhACAFQQFxBEAgASgCACAAaigCACEACyAEIAM2AgwgASACIARBDGogABEFACAEQRBqJAALEAAgACgCBCAAKAIAa0ECdQtRAQJ/IwBBEGsiAyQAQQEhBCAAIAEoAgQgASgCACIBa0ECdSACSwR/IAMgASACQQJ0aigCADYCCEGk8AEgA0EIahAKBUEBCzYCACADQRBqJAALNwEBfyMAQRBrIgMkACADQQhqIAEgAiAAKAIAEQUAIAMoAggQCyADKAIIIgAQDCADQRBqJAAgAAsXACAAKAIAIAFBAnRqIAIoAgA2AgBBAQs0AQF/IwBBEGsiBCQAIAAoAgAhACAEIAM2AgwgASACIARBDGogABEEACEAIARBEGokACAACwUAQZAaCzABAX8gACgCBCICIAAoAghHBEAgAiABKQMANwMAIAAgAkEIajYCBA8LIAAgARDfAgtSAQJ/IwBBEGsiAyQAIAEgACgCBCIEQQF1aiEBIAAoAgAhACAEQQFxBEAgASgCACAAaigCACEACyADIAI5AwggASADQQhqIAAR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NwPQASABQgA3A8gBIABBwJ8BaiIBQgA3A8ABIAFCADcD2AEgAUIANwPQASABQgA3A8gBIABBsKEBaiIBQgA3A8ABIAFCADcD2AEgAUIANwPQASABQgA3A8gBIABBoKMBaiIBQgA3A8ABIAFCADcD2AEgAUIANwPQASABQgA3A8gBIABBkKUBaiIBQgA3A8ABIAFCADcD2AEgAUIANwPQASABQgA3A8gBIABBgKcBaiIBQgA3A8ABIAFCADcD2AEgAUIANwPQASABQgA3A8gBIABB8KgBaiIBQgA3A8ABIAFCADcD2AEgAUIANwPQASABQgA3A8gBIABB4KoBaiIBQgA3A8ABIAFCADcD2AEgAUIANwPQASABQgA3A8gBIABB0KwBaiIBQgA3A8ABIAFCADcD2AEgAUIANwPQASABQgA3A8gBIABBwK4BaiIBQgA3A8ABIAFCADcD2AEgAUIANwPQASABQgA3A8gBIABBsLABaiIBQgA3A8ABIAFCADcD2AEgAUIANwPQASABQgA3A8gBIABBoLIBaiIBQgA3A8ABIAFCADcD2AEgAUIANwPQASABQgA3A8gBIABBkLQBaiIBQgA3A8ABIAFCADcD2AEgAUIANwPQASABQgA3A8gBIABBgLYBaiIBQgA3A8ABIAFCADcD2AEgAUIANwPQASABQgA3A8gBIABB8LcBaiIBQgA3A8ABIAFCADcD2AEgAUIANwPQASABQgA3A8gBIABB4LkBaiIBQgA3A8ABIAFCADcD2AEgAUIANwPQASABQgA3A8gBIABB0LsBaiIBQgA3A8ABIAFCADcD2AEgAUIANwPQASABQgA3A8gBIABBwL0BaiIBQgA3A8ABIAFCADcD2AEgAUIANwPQASABQgA3A8gBIABBsL8BaiIBQgA3A8ABIAFCADcD2AEgAUIANwPQASABQgA3A8gBIABBoMEBaiIBQgA3A8ABIAFCADcD2AEgAUIANwPQASABQgA3A8gBIABBkMMBaiIBQgA3A8ABIAFCADcD2AEgAUIANwPQASABQgA3A8gBIABBgMUBaiIBQgA3A8ABIAFCADcD2AEgAUIANwPQASABQgA3A8gBIABB8MYBaiIBQgA3A8ABIAFCADcD2AEgAUIANwPQASABQgA3A8gBIABB4MgBaiIBQgA3A8ABIAFCADcD2AEgAUIANwPQ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0AFqQuH10fD6qLj1PzcDACAAQeDUAWogASkDIDcDACAAQejUAWogASkDKDcDACAAQcDUAWogASkDADcDACAAQcjUAWogASkDCDcDACAAQdjUAWogASkDGDcDACAAQfDUAWogASkDMDcDACAAQfjUAWogASkDODcDACAAQdDUAWogASkDEDcDACAAQdjSAWpCgICAgICAgPA/NwMAIABB0NIBakKAgICAgICA8D83AwAgAEHI0gFqQoCAgICAgIDwPzcDACAAQoCAgICAgIDwPzcDwNIBIABB2M4BakKAgICAgIDUusAANwMAIABB0M4BakKAgICAgIDkvcAANwMAIABByM4BakKAgICAgIDYwMAANwMAIABCgICAgICAiLbAADcDwM4BIAFBgAFqJAAgAAuYCgIGfwF8IABCADcD2NgBIABBuNYBaiADRAAAAAAAAPA/pEQAAAAAAAAAAKUiAzkDACAAQbDWAWogAzkDACAAQajWAWogAzkDACAAQaDWAWogAzkDACAAQZjWAWogAzkDACAAQZDWAWogAzkDACAAQYjWAWogAzkDACAAQYDWAWogAzkDACAAQfjVAWogAzkDACAAQfDVAWogAzkDACAAQejVAWogAzkDACAAQeDVAWogAzkDACAAQdjVAWogAzkDACAAQdDVAWogAzkDACAAQcjVAWogAzkDACAAQcDVAWogAzkDACAAQbjVAWogAzkDACAAQbDVAWogAzkDACAAQajVAWogAzkDACAAQaDVAWogAzkDACAAQZjVAWogAzkDACAAQZDVAWogAzkDACAAQYjVAWogAzkDACAAQYDVAWogAzkDACAAQfjUAWogAzkDACAAQfDUAWogAzkDACAAQejUAWogAzkDACAAQeDUAWogAzkDACAAQdjUAWogAzkDACAAQdDUAWogAzkDACAAQcjUAWogAzkDACAAIAM5A8DUASAAQbjSAWogAkSamZmZmZm5P6JE4XoUrkfh6j+gRAAAAAAAAPA/pEQAAAAAAAAAAKUiAjkDACAAQbDSAWogAjkDACAAQajSAWogAjkDACAAQaDSAWogAjkDACAAQZjSAWogAjkDACAAQZDSAWogAjkDACAAQYjSAWogAjkDACAAQYDSAWogAjkDACAAQfjRAWogAjkDACAAQfDRAWogAjkDACAAQejRAWogAjkDACAA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QcAAIANrrYiEIQIgASAEhiEBCyAAIAE3AwAgACACNwMIC9kDAgJ/An4jAEEgayICJAACQCABQv///////////wCDIgVCgICAgICAwP9DfCAFQoCAgICAgMCAvH98VARAIAFCBIYgAEI8iIQhBCAAQv//////////D4MiAEKBgICAgICAgAhaBEAgBEKBgICAgICAgMAAfCEEDAILIARCgICAgICAgIBAfSEEIABCgICAgICAgIAIhUIAUg0BIARCAYMgBHwhBAwBCyAAUCAFQoCAgICAgMD//wBUIAVCgICAgICAwP//AFEbRQRAIAFCBIYgAEI8iIRC/////////wODQoCAgICAgID8/wCEIQQMAQtCgICAgICAgPj/ACEEIAVC////////v//DAFYNAEIAIQQgBUIwiKciA0GR9wBJDQAgAiAAIAFC////////P4NCgICAgICAwACEIgRBgfgAIANrELgEIAJBEGogACAEIANB/4h/ahC5BCACKQMIQgSGIAIpAwAiAEI8iIQhBCACKQMQIAIpAxiEQgBSrSAAQv//////////D4OEIgBCgYCAgICAgIAIWgRAIARCAXwhBAwBCyAAQoCAgICAgICACIVCAFINACAEQgGDIAR8IQQLIAJBIGokACAEIAFCgICAgICAgICAf4OEvwuSAQEDfEQAAAAAAADwPyAAIACiIgJEAAAAAAAA4D+iIgOhIgREAAAAAAAA8D8gBKEgA6EgAiACIAIgAkSQFcsZoAH6PqJEd1HBFmzBVr+gokRMVVVVVVWlP6CiIAIgAqIiAyADoiACIAJE1DiIvun6qL2iRMSxtL2e7iE+oKJErVKcgE9+kr6goqCiIAAgAaKhoKAL+xEDD38BfgN8IwBBsARrIgYkACACIAJBfWpBGG0iBUEAIAVBAEobIg5BaGxqIQwgBEECdEGg8gBqKAIAIgsgA0F/aiIIakEATgRAIAMgC2ohBSAOIAhrIQIDQCAGQcACaiAHQQN0aiACQQBIBHxEAAAAAAAAAAAFIAJBAnRBsPIAaigCALcLOQMAIAJBAWohAiAHQQFqIgcgBUcNAAsLIAxBaGohCUEAIQUgA0EBSCEHA0ACQCAHBEBEAAAAAAAAAAAhFQwBCyAFIAhqIQpBACECRAAAAAAAAAAAIRUDQCAAIAJBA3RqKwMAIAZBwAJqIAog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AAAAAAAAAABBABC+BCEADAELIAJBgIDA/wdPBEAgACAAoSEADAELIAAgARC9BEEDcSICQQJNBEACQAJAAkAgAkEBaw4CAQIACyABKwMAIAErAwhBARC+BCEADAMLIAErAwAgASsDCBC7BCEADAILIAErAwAgASsDCEEBEL4EmiEADAELIAErAwAgASsDCBC7BJohAAsgAUEQaiQAIAALkgMCA38BfCMAQRBrIgIkAAJAIAC8IgNB/////wdxIgFB2p+k+gNNBEAgAUGAgIDMA0kNASAAuxDBBCEADAELIAFB0aftgwRNBEAgALshBCABQeOX24AETQRAIANBf0wEQCAERBgtRFT7Ifk/oBDABIwhAAwDCyAERBgtRFT7Ifm/oBDABCEADAILRBgtRFT7IQlARBgtRFT7IQnAIANBAEgbIASgmhDBBCEADAELIAFB1eOIhwRNBEAgALshBCABQd/bv4UETQRAIANBf0wEQCAERNIhM3982RJAoBDABCEADAMLIARE0iEzf3zZEsCgEMAEjCEADAILRBgtRFT7IRlARBgtRFT7IRnAIANBAEgbIASgEMEEIQAMAQsgAUGAgID8B08EQCAAIACTIQAMAQsgACACQQhqEMIEQQNxIgFBAk0EQAJAAkACQCABQQFrDgIBAgALIAIrAwgQwQQhAAwDCyACKwMIEMAEIQAMAgsgAisDCJoQwQQhAAwBCyACKwMIEMAEjCEACyACQRBqJAAgAAusAwMCfwF+AnwgAL0iBUKAgICAgP////8Ag0KBgICA8ITl8j9UIgRFBEBEGC1EVPsh6T8gAJogACAFQgBTIgMboUQHXBQzJqaBPCABmiABIAMboaAhACAFQj+IpyEDRAAAAAAAAAAAIQELIAAgACAAIACiIgeiIgZEY1VVVVVV1T+iIAcgBiAHIAeiIgYgBiAGIAYgBkRzU2Dby3XzvqJEppI3oIh+FD+gokQBZfLy2ERDP6CiRCgDVskibW0/oKJEN9YGhPRklj+gokR6/hARERHBP6AgByAGIAYgBiAGIAZE1Hq/dHAq+z6iROmn8DIPuBI/oKJEaBCNGvcmMD+gokQVg+D+yNtXP6CiRJOEbunjJoI/oKJE/kGzG7qhqz+goqCiIAGgoiABoKAiBqAhASAERQRAQQEgAkEBdGu3IgcgACAGIAEgAaIgASAHoKOh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BEBBACAHQX9qQf7/AUkNARoLIAFQIAJC////////////AIMiDEKAgICAgIDA//8AVCAMQoCAgICAgMD//wBRG0UEQCACQoCAgICAgCCEIQoMAgsgA1AgBEL///////////8AgyICQoCAgICAgMD//wBUIAJCgICAgICAwP//AFEbRQRAIARCgICAgICAIIQhCiADIQEMAgsgASAMQoCAgICAgMD//wCFhFAEQCACIAOEUARAQoCAgICAgOD//wAhCkIAIQEMAwsgCkKAgICAgIDA//8AhCEKQgAhAQwCCyADIAJCgICAgICAwP//AIWEUARAIAEgDIQhAkIAIQEgAlAEQEKAgICAgIDg//8AIQoMAwsgCkKAgICAgIDA//8AhCEKDAILIAEgDIRQBEBCACEBDAILIAIgA4RQBEBCACEBDAILIAxC////////P1gEQCAFQdAAaiABIAsgASALIAtQIgYbeSAGQQZ0rXynIgZBcWoQuQQgBSkDWCILQiCGIAUpA1AiAUIgiIQhDSALQiCIIRJBECAGayEGCyAGIAJC////////P1YNABogBUFAayADIA4gAyAOIA5QIggbeSAIQQZ0rXynIghBcWoQuQQgBSkDSCICQg+GIAUpA0AiA0IxiIQhECACQi+GIANCEYiEIQ8gAkIRiCERIAYgCGtBEGoLIQYgD0L/////D4MiAiABQv////8PgyIBfiIPIANCD4ZCgID+/w+DIgMgDUL/////D4MiDH58IgRCIIYiDiABIAN+fCINIA5UrSACIAx+IhUgAyALQv////8PgyILfnwiEyAQQv////8PgyIOIAF+fCIQIAQgD1StQiCGIARCIIiEfCIUIAIgC34iFiADIBJCgIAEhCIPfnwiAyAMIA5+fCISIAEgEUL/////B4NCgICAgAiEIgF+fCIRQiCGfCIXfCEEIAcgCWogBmpBgYB/aiEGAkAgCyAOfiIYIAIgD358IgIgGFStIAIgASAMfnwiDCACVK18IAwgEyAVVK0gECATVK18fCICIAxUrXwgASAPfnwgASALfiILIA4gD358IgEgC1StQiCGIAFCIIiEfCACIAFCIIZ8IgEgAlStfCABIBEgElStIAMgFlStIBIgA1StfHxCIIYgEUIgiIR8IgMgAVStfCADIBQgEFStIBcgFFStfHwiAiADVK18IgFCgICAgICAwACDUEUEQCAGQQFqIQYMAQsgDUI/iCEDIAFCAYYgAkI/iIQhASACQgGGIARCP4iEIQIgDUIBhiENIAMgBEIBhoQhBAsgBkH//wFOBEAgCkKAgICAgIDA//8AhCEKQgAhAQwBCwJ+IAZBAEwEQEEBIAZrIgdB/wBNBEAgBUEQaiANIAQgBxC4BCAFQSBqIAIgASAGQf8AaiIGELkEIAVBMGogDSAEIAYQuQQgBSACIAEgBxC4BCAFKQMwIAUpAziEQgBSrSAFKQMgIAUpAxCEhCENIAUpAyggBSkDGIQhBCAFKQMAIQIgBSkDCAwCC0IAIQEMAgsgAUL///////8/gyAGrUIwhoQLIAqEIQogDVAgBEJ/VSAEQoCAgICAgICAgH9RG0UEQCAKIAJCAXwiASACVK18IQoMAQsgDSAEQoCAgICAgICAgH+FhFBFBEAgAiEBDAELIAogAiACQgGDfCIBIAJUrXwhCgsgACABNwMAIAAgCjcDCCAFQeAAaiQAC38CAn8BfiMAQRBrIgMkACAAAn4gAUUEQEIADAELIAMgASABQR91IgJqIAJzIgKtQgAgAmciAkHRAGoQuQQgAykDCEKAgICAgIDAAIVBnoABIAJrrUIwhnwgAUGAgICAeHGtQiCGhCEEIAMpAwALNwMAIAAgBDcDCCADQRBqJAALyAkCBH8EfiMAQfAAayIFJAAgBEL///////////8AgyEKAkACQCABQn98IgtCf1EgAkL///////////8AgyIJIAsgAVStfEJ/fCILQv///////7///wBWIAtC////////v///AFEbRQRAIANCf3wiC0J/UiAKIAsgA1StfEJ/fCILQv///////7///wBUIAtC////////v///AFEbDQELIAFQIAlCgICAgICAwP//AFQgCUKAgICAgIDA//8AURtFBEAgAkKAgICAgIAghCEEIAEhAwwCCyADUCAKQoCAgICAgMD//wBUIApCgICAgICAwP//AFEbRQRAIARCgICAgICAIIQhBAwCCyABIAlCgICAgICAwP//AIWEUARAQoCAgICAgOD//wAgAiABIAOFIAIgBIVCgICAgICAgICAf4WEUCIGGyEEQgAgASAGGyEDDAILIAMgCkKAgICAgIDA//8AhYRQDQEgASAJhFAEQCADIAqEQgBSDQIgASADgyEDIAIgBIMhBAwCCyADIAqEUEUNACABIQMgAiEEDAELIAMgASADIAFWIAogCVYgCSAKURsiBxshCiAEIAIgBxsiC0L///////8/gyEJIAIgBCAHGyICQjCIp0H//wFxIQggC0IwiKdB//8BcSIGRQRAIAVB4ABqIAogCSAKIAkgCVAiBht5IAZBBnStfKciBkFxahC5BCAFKQNoIQkgBSkDYCEKQRAgBmshBgsgASADIAcbIQMgAkL///////8/gyEBIAgEfiABBSAFQdAAaiADIAEgAyABIAFQIgcbeSAHQQZ0rXynIgdBcWoQuQRBECAHayEIIAUpA1AhAyAFKQNYC0IDhiADQj2IhEKAgICAgICABIQhBCAJQgOGIApCPYiEIQEgAiALhSEMAn4gA0IDhiIDIAYgCGsiB0UNABogB0H/AEsEQEIAIQRCAQwBCyAFQUBrIAMgBEGAASAHaxC5BCAFQTBqIAMgBCAHELgEIAUpAzghBCAFKQMwIAUpA0AgBSkDSIRCAFKthAshAyABQoCAgICAgIAEhCEJIApCA4YhAgJAIAxCf1cEQCACIAN9IgEgCSAEfSACIANUrX0iA4RQBEBCACEDQgAhBAwDCyADQv////////8DVg0BIAVBIGogASADIAEgAyADUCIHG3kgB0EGdK18p0F0aiIHELkEIAYgB2shBiAFKQMoIQMgBSkDICEBDAELIAIgA3wiASADVK0gBCAJfHwiA0KAgICAgICACINQDQAgAUIBgyADQj+GIAFCAYiEhCEBIAZBAWohBiADQgGIIQMLIAtCgICAgICAgICAf4MhAiAGQf//AU4EQCACQoCAgICAgMD//wCEIQRCACEDDAELQQAhBwJAIAZBAEoEQCAGIQcMAQsgBUEQaiABIAMgBkH/AGoQuQQgBSABIANBASAGaxC4BCAFKQMAIAUpAxAgBSkDGIRCAFKthCEBIAUpAwghAwsgA0I9hiABQgOIhCIEIAGnQQdxIgZBBEutfCIBIARUrSADQgOIQv///////z+DIAKEIAetQjCGhHwgASABQgGDQgAgBkEERhsiAXwiAyABVK18IQQLIAAgAzcDACAAIAQ3AwggBUHwAGokAAuBAgICfwR+IwBBEGsiAiQAIAG9IgVCgICAgICAgICAf4MhBwJ+IAVC////////////AIMiBEKAgICAgICAeHxC/////////+//AFgEQCAEQjyGIQYgBEIEiEKAgICAgICAgDx8DAELIARCgICAgICAgPj/AFoEQCAFQjyGIQYgBUIEiEKAgICAgIDA//8AhAwBCyAEUARAQgAMAQsgAiAEQgAgBEKAgICAEFoEfyAEQiCIp2cFIAWnZ0EgagsiA0ExahC5BCACKQMAIQYgAikDCEKAgICAgIDAAIVBjPgAIANrrUIwhoQLIQQgACAGNwMAIAAgBCAHhDcDCCACQRBqJAAL2wECAX8CfkEBIQQCQCAAQgBSIAFC////////////AIMiBUKAgICAgIDA//8AViAFQoCAgICAgMD//wBRGw0AIAJCAFIgA0L///////////8AgyIGQoCAgICAgMD//wBWIAZCgICAgICAwP//AFEbDQAgACAChCAFIAaEhFAEQEEADwsgASADg0IAWQRAQX8hBCAAIAJUIAEgA1MgASADURsNASAAIAKFIAEgA4WEQgBSDwtBfyEEIAAgAlYgASADVSABIANRGw0AIAAgAoUgASADhYRCAFIhBAsgBAvYAQIBfwF+QX8hAgJAIABCAFIgAUL///////////8AgyIDQoCAgICAgMD//wBWIANCgICAgICAwP//AFEbDQAgACADQoCAgICAgID/P4SEUARAQQAPCyABQoCAgICAgID/P4NCAFkEQCAAQgBUIAFCgICAgICAgP8/UyABQoCAgICAgID/P1EbDQEgACABQoCAgICAgID/P4WEQgBSDwsgAEIAViABQoCAgICAgID/P1UgAUKAgICAgICA/z9RGw0AIAAgAUKAgICAgICA/z+FhEIAUiECCyACCzUAIAAgATcDACAAIAJC////////P4MgBEIwiKdBgIACcSACQjCIp0H//wFxcq1CMIaENwMIC2cCAX8BfiMAQRBrIgIkACAAAn4gAUUEQEIADAELIAIgAa1CAEHwACABZ0EfcyIBaxC5BCACKQMIQoCAgICAgMAAhSABQf//AGqtQjCGfCEDIAIpAwALNwMAIAAgAzcDCCACQRBqJAALRQEBfyMAQRBrIgUkACAFIAEgAiADIARCgICAgICAgICAf4UQvwUgBSkDACEBIAAgBSkDCDcDCCAAIAE3AwAgBUEQaiQAC8QCAQF/IwBB0ABrIgQkAAJAIANBgIABTgRAIARBIGogASACQgBCgICAgICAgP//ABC9BSAEKQMoIQIgBCkDICEBIANB//8BSARAIANBgYB/aiEDDAILIARBEGogASACQgBCgICAgICAgP//ABC9BSADQf3/AiADQf3/AkgbQYKAfmohAyAEKQMYIQIgBCkDECEBDAELIANBgYB/Sg0AIARBQGsgASACQgBCgICAgICAwAAQvQUgBCkDSCECIAQpA0AhASADQYOAfkoEQCADQf7/AGohAwwBCyAEQTBqIAEgAkIAQoCAgICAgMAAEL0FIANBhoB9IANBhoB9ShtB/P8BaiEDIAQpAzghAiAEKQMwIQELIAQgASACQgAgA0H//wBqrUIwhhC9BSAAIAQpAwg3AwggACAEKQMANwMAIARB0ABqJAALjhECBX8MfiMAQcABayIFJAAgBEL///////8/gyESIAJC////////P4MhDCACIASFQoCAgICAgICAgH+DIREgBEIwiKdB//8BcSEHAkACQAJAIAJCMIinQf//AXEiCUF/akH9/wFNBEAgB0F/akH+/wFJDQELIAFQIAJC////////////AIMiCkKAgICAgIDA//8AVCAKQoCAgICAgMD//wBRG0UEQCACQoCAgICAgCCEIREMAgsgA1AgBEL///////////8AgyICQoCAgICAgMD//wBUIAJCgICAgICAwP//AFEbRQRAIARCgICAgICAIIQhESADIQEMAgsgASAKQoCAgICAgMD//wCFhFAEQCADIAJCgICAgICAwP//AIWEUARAQgAhAUKAgICAgIDg//8AIREMAwsgEUKAgICAgIDA//8AhCERQgAhAQwCCyADIAJCgICAgICAwP//AIWEUARAQgAhAQwCCyABIAqEUA0CIAIgA4RQBEAgEUKAgICAgIDA//8AhCERQgAhAQwCCyAKQv///////z9YBEAgBUGwAWogASAMIAEgDCAMUCIGG3kgBkEGdK18pyIGQXFqELkEQRAgBmshBiAFKQO4ASEMIAUpA7ABIQELIAJC////////P1YNACAFQaABaiADIBIgAyASIBJQIggbeSAIQQZ0rXynIghBcWoQuQQgBiAIakFwaiEGIAUpA6gBIRIgBSkDoAEhAwsgBUGQAWogEkKAgICAgIDAAIQiFEIPhiADQjGIhCICQoTJ+c6/5ryC9QAgAn0iBBC5BSAFQYABakIAIAUpA5gBfSAEELkFIAVB8ABqIAUpA4gBQgGGIAUpA4ABQj+IhCIEIAIQuQUgBUHgAGogBEIAIAUpA3h9ELkFIAVB0ABqIAUpA2hCAYYgBSkDYEI/iIQiBCACELkFIAVBQGsgBEIAIAUpA1h9ELkFIAVBMGogBSkDSEIBhiAFKQNAQj+IhCIEIAIQuQUgBUEgaiAEQgAgBSkDOH0QuQUgBUEQaiAFKQMoQgGGIAUpAyBCP4iEIgQgAhC5BSAFIARCACAFKQMYfRC5BSAGIAkgB2tqIQYCfkIAIAUpAwhCAYYgBSkDAEI/iIRCf3wiCkL/////D4MiBCACQiCIIg5+IhAgCkIgiCIKIAJC/////w+DIgt+fCICQiCGIg0gBCALfnwiCyANVK0gCiAOfiACIBBUrUIghiACQiCIhHx8IAsgBCADQhGIQv////8PgyIOfiIQIAogA0IPhkKAgP7/D4MiDX58IgJCIIYiDyAEIA1+fCAPVK0gCiAOfiACIBBUrUIghiACQiCIhHx8fCICIAtUrXwgAkIAUq18fSILQv////8PgyIOIAR+IhAgCiAOfiINIAQgC0IgiCIPfnwiC0IghnwiDiAQVK0gCiAPfiALIA1UrUIghiALQiCIhHx8IA5CACACfSICQiCIIgsgBH4iECACQv////8PgyINIAp+fCICQiCGIg8gBCANfnwgD1StIAogC34gAiAQVK1CIIYgAkIgiIR8fHwiAiAOVK18IAJCfnwiECACVK18Qn98IgtC/////w+DIgIgDEIChiABQj6IhEL/////D4MiBH4iDiABQh6IQv////8PgyIKIAtCIIgiC358Ig0gDlStIA0gEEIgiCIOIAxCHohC///v/w+DQoCAEIQiDH58Ig8gDVStfCALIAx+fCACIAx+IhMgBCALfnwiDSATVK1CIIYgDUIgiIR8IA8gDUIghnwiDSAPVK18IA0gCiAOfiITIBBC/////w+DIhAgBH58Ig8gE1StIA8gAiABQgKGQvz///8PgyITfnwiFSAPVK18fCIPIA1UrXwgDyALIBN+IgsgDCAQfnwiDCAEIA5+fCIEIAIgCn58IgJCIIggAiAEVK0gDCALVK0gBCAMVK18fEIghoR8IgwgD1StfCAMIBUgDiATfiIEIAogEH58IgpCIIggCiAEVK1CIIaEfCIEIBVUrSAEIAJCIIZ8IARUrXx8IgQgDFStfCICQv////////8AWARAIAFCMYYgBEL/////D4MiASADQv////8PgyIKfiIMQgBSrX1CACAMfSIQIARCIIgiDCAKfiINIAEgA0IgiCILfnwiDkIghiIPVK19IAJC/////w+DIAp+IAEgEkL/////D4N+fCALIAx+fCAOIA1UrUIghiAOQiCIhHwgBCAUQiCIfiADIAJCIIh+fCACIAt+fCAMIBJ+fEIghnx9IRIgBkF/aiEGIBAgD30MAQsgBEIhiCELIAFCMIYgAkI/hiAEQgGIhCIEQv////8PgyIBIANC/////w+DIgp+IgxCAFKtfUIAIAx9Ig4gASADQiCIIgx+IhAgCyACQh+GhCINQv////8PgyIPIAp+fCILQiCGIhNUrX0gDCAPfiAKIAJCAYgiCkL/////D4N+fCABIBJC/////w+DfnwgCyAQVK1CIIYgC0IgiIR8IAQgFEIgiH4gAyACQiGIfnwgCiAMfnwgDSASfnxCIIZ8fSESIAohAiAOIBN9CyEBIAZBgIABTgRAIBFCgICAgICAwP//AIQhEUIAIQEMAQsgBkH//wBqIQcgBkGBgH9MBEACQCAHDQAgBCABQgGGIANWIBJCAYYgAUI/iIQiASAUViABIBRRG618IgEgBFStIAJC////////P4N8IgJCgICAgICAwACDUA0AIAIgEYQhEQwCC0IAIQEMAQsgBCABQgGGIANaIBJCAYYgAUI/iIQiASAUWiABIBRRG618IgEgBFStIAJC////////P4MgB61CMIaEfCARhCERCyAAIAE3AwAgACARNwMIIAVBwAFqJAAPCyAAQgA3AwAgACARQoCAgICAgOD//wAgAiADhEIAUhs3AwggBUHAAWokAAulCAIFfwJ+IwBBMGsiBSQAAkAgAkECTQRAIAJBAnQiAkHMmAFqKAIAIQcgAkHAmAFqKAIAIQgDQAJ/IAEoAgQiAiABKAJoSQRAIAEgAkEBajYCBCACLQAADAELIAEQuAULIgIiBEEgRiAEQXdqQQVJcg0ACwJAIAJBVWoiBEECSwRAQQEhBgwBC0EBIQYgBEEBa0UNAEF/QQEgAkEtRhshBiABKAIEIgIgASgCaEkEQCABIAJBAWo2AgQgAi0AACECDAELIAEQuAUhAgtBACEEAkAC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CyECIANBLUYhBSACQVBqIQQCQCABRQ0AIARBCkkNACAAKAJoRQ0AIAAgACgCBEF/ajYCBAsgAiEDCwJAIARBCkkEQEEAIQQDQCADIARBCmxqIQECfyAAKAIEIgIgACgCaEkEQCAAIAJBAWo2AgQgAi0AAAwBCyAAELgFCyIDQVBqIgJBCU1BACABQVBqIgRBzJmz5gBIGw0ACyAErCEGAkAgAkEKTw0AA0AgA60gBkIKfnwhBgJ/IAAoAgQiASAAKAJoSQRAIAAgAUEBajYCBCABLQAADAELIAAQuAULIQMgBkJQfCEGIANBUGoiAkEJSw0BIAZCro+F18fC66MBUw0ACwsgAkEKSQRAA0ACfyAAKAIEIgEgACgCaEkEQCAAIAFBAWo2AgQgAS0AAAwBCyAAELgFC0FQakEKSQ0ACwsgACgCaARAIAAgACgCBEF/ajYCBAtCACAGfSAGIAUbIQYMAQtCgICAgICAgICAfyEGIAAoAmhFDQAgACAAKAIEQX9qNgIEQoCAgICAgICAgH8PCyAGC7YDAgN/AX4jAEEgayIDJAACQCABQv///////////wCDIgVCgICAgICAwL9AfCAFQoCAgICAgMDAv398VARAIAFCGYinIQIgAFAgAUL///8PgyIFQoCAgAhUIAVCgICACFEbRQRAIAJBgYCAgARqIQIMAgsgAkGAgICABGohAiAAIAVCgICACIWEQgBSDQEgAkEBcSACaiECDAELIABQIAVCgICAgICAwP//AFQgBUKAgICAgIDA//8AURtFBEAgAUIZiKdB////AXFBgICA/gdyIQIMAQtBgICA/AchAiAFQv///////7+/wABWDQBBACECIAVCMIinIgRBkf4ASQ0AIAMgACABQv///////z+DQoCAgICAgMAAhCIFQYH/ACAEaxC4BCADQRBqIAAgBSAEQf+Bf2oQuQQgAykDCCIAQhmIpyECIAMpAwAgAykDECADKQMYhEIAUq2EIgVQIABC////D4MiAEKAgIAIVCAAQoCAgAhRG0UEQCACQQFqIQIMAQsgBSAAQoCAgAiFhEIAUg0AIAJBAXEgAmohAgsgA0EgaiQAIAIgAUIgiKdBgICAgHhxcr4L8RMCDX8DfiMAQbACayIGJAAgACgCTEEATgR/QQEFQQALGgJAIAEtAAAiBEUNAAJAA0ACQAJA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AgwgAEEIaiACQRBqIAJBDGogBCAFIAYQjQcgAkEQaiACKAIMIAEQjwchACACQYABaiQAIAALYgEBfyMAQRBrIgYkACAGQQA6AA8gBiAFOgAOIAYgBDoADSAGQSU6AAwgBQRAIAZBDWogBkEOahCOBwsgAiABIAIoAgAgAWsgBkEMaiADIAAoAgAQHSABajYCACAGQRBqJAALNQEBfyMAQRBrIgIkACACIAAtAAA6AA8gACABLQAAOgAAIAEgAkEPai0AADoAACACQRBqJAALRQEBfyMAQRBrIgMkACADIAI2AggDQCAAIAFHBEAgA0EIaiAALAAAEI0FIABBAWohAAwBCwsgAygCCCEAIANBEGokACAAC0oAIwBBoANrIgIkACACIAJBoANqNgIMIABBCGogAkEQaiACQQxqIAQgBSAGEJEHIAJBEGogAigCDCABEJQHIQAgAkGgA2okACAAC38BAX8jAEGQAWsiBiQAIAYgBkGEAWo2AhwgACAGQSBqIAZBHGogAyAEIAUQjQcgBkIANwMQIAYgBkEgajYCDCABIAZBDGogAigCACABa0ECdSAGQRBqIAAoAgAQkgciAEF/RgRAEJMHAAsgAiABIABBAnRqNgIAIAZBkAFqJAALYwEBfyMAQRBrIgUkACAFIAQ2AgwgBUEIaiAFQQxqEJ0GIQQgACABIAIgAxDhBSEBIAQoAgAiAARAQdiKAigCABogAARAQdiKAkGMlgIgACAAQX9GGzYCAAsLIAVBEGokACABCwUAEB4AC0UBAX8jAEEQayIDJAAgAyACNgIIA0AgACABRwRAIANBCGogACgCABCPBSAAQQRqIQAMAQsLIAMoAgghACADQRBqJAAgAAsFAEH/AAsIACAAEPwFGgsVACAAQgA3AgAgAEEANgIIIAAQ7wgLDAAgAEGChoAgNgAACwgAQf////8HCwwAIABBAUEtENMGGgvtBAEBfyMAQaACayIAJAAgACABNgKYAiAAIAI2ApACIABBggU2AhAgAEGYAWogAEGgAWogAEEQahD3BSEHIAAgBCgCHCIBNgKQASABIAEoAgRBAWo2AgQgAEGQAWoQ7gQhASAAQQA6AI8BAkAgAEGYAmogAiADIABBkAFqIAQoAgQgBSAAQY8BaiABIAcgAEGUAWogAEGEAmoQnAdFDQAgAEHrugEoAAA2AIcBIABB5LoBKQAANwOAASABIABBgAFqIABBigFqIABB9gBqIAEoAgAoAiARCAAaIABBgQU2AhAgAEEIakEAIABBEGoQ9wUhASAAQRBqIQICQCAAKAKUASAHKAIAa0HjAE4EQCAAKAKUASAHKAIAa0ECahCwCSEDIAEoAgAhAiABIAM2AgAgAgRAIAIgASgCBBEBAAsgASgCAEUNASABKAIAIQILIAAtAI8BBEAgAkEtOgAAIAJBAWohAgsgBygCACEEA0ACQCAEIAAoApQBTwRAIAJBADoAACAAIAY2AgAgAEEQaiAAENsFQQFHDQEgASgCACECIAFBADYCACACBEAgAiABKAIEEQEACwwECyACIABB9gBqIABBgAFqIAQQnAYgAGsgAGotAAo6AAAgAkEBaiECIARBAWohBAwBCwsQkwcACxCTBwALIABBmAJqIABBkAJqEPIEBEAgBSAFKAIAQQJyNgIACyAAKAKYAiECAn8gACgCkAEiASABKAIEQX9qIgM2AgQgA0F/RgsEQCABIAEoAgAoAggRAQALIAcoAgAhASAHQQA2AgAgAQRAIAEgBygCBBEBAAsgAEGgAmokACACC7MSAQh/IwBBsARrIgskACALIAo2AqQEIAsgATYCqAQgC0GCBTYCaCALIAtBiAFqIAtBkAFqIAtB6ABqEPcFIg8oAgAiATYChAEgCyABQZADajYCgAEgC0HoAGoQ/AUhESALQdgAahD8BSEOIAtByABqEPwFIQwgC0E4ahD8BSENIAtBKGoQ/AUhECACIAMgC0H4AGogC0H3AGogC0H2AGogESAOIAwgDSALQSRqEJ0HIAkgCCgCADYCACAEQYAEcSESQQAhAUEAIQQDQCAEIQoCQAJAAkACQCABQQRGDQAgACALQagEahDvBEUNACALQfgAaiABaiwAACICQQRLDQJBACEEAkACQAJAAkACQAJAIAJBAWsOBAAEAwUBCyABQQNGDQcgABDwBCICQQBOBH8gBygCCCACQf8BcUEBdGovAQBBgMAAcQVBAAsEQCALQRhqIAAQngcgECALLAAYEO4IDAILIAUgBSgCAEEEcjYCAEEAIQAMBgsgAUEDRg0GCwNAIAAgC0GoBGoQ7wRFDQYgABDwBCICQQBOBH8gBygCCCACQf8BcUEBdGovAQBBgMAAcUEARwVBAAtFDQYgC0EY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IANrIAZJBEAgACAEIAMgBmogBGsgAyADEOsICwJ/IAAsAAtBAEgEQCAAKAIADAELIAALIANqIQQDQCABIAJHBEAgBCABLQAAOgAAIAFBAWohASAEQQFqIQQMAQsLIAVBADoADyAEIAUtAA86AAAgAyAGaiEBAkAgACwAC0EASARAIAAgATYCBAwBCyAAIAE6AAsLCyAFQSBqJAALCwAgAEHErwIQ9gULIAAgABDXCCAAIAEoAgg2AgggACABKQIANwIAIAEQmwYLCwAgAEG8rwIQ9gULfgEBfyMAQSBrIgMkACADIAE2AhAgAyAANgIYIAMgAjYCCANAAkACf0EBIAMoAhggAygCEEZBAXNFDQAaIAMoAhgtAAAgAygCCC0AAEYNAUEACyEAIANBIGokACAADwsgAyADKAIYQQFqNgIYIAMgAygCCEEBajYCCAwAAAsACzQBAX8jAEEQayICJAAgAiAAKAIANgIIIAIgAigCCCABajYCCCACKAIIIQAgAkEQaiQAIAALPQECfyABKAIAIQIgAUEANgIAIAIhAyAAKAIAIQIgACADNgIAIAIEQCACIAAoAgQRAQALIAAgASgCBDYCBAv7BAEBfyMAQfAEayIAJAAgACABNgLoBCAAIAI2AuAEIABBggU2AhAgAEHIAWogAEHQAWogAEEQahD3BSEHIAAgBCgCHCIBNgLAASABIAEoAgRBAWo2AgQgAEHAAWoQ+wQhASAAQQA6AL8BAkAgAEHoBGogAiADIABBwAFqIAQoAgQgBSAAQb8BaiABIAcgAEHEAWogAEHgBGoQqwdFDQAgAEHrugEoAAA2ALcBIABB5LoBKQAANwOwASABIABBsAFqIABBugFqIABBgAFqIAEoAgAoAjARCAAaIABBgQU2AhAgAEEIakEAIABBEGoQ9wUhASAAQRBqIQICQCAAKALEASAHKAIAa0GJA04EQCAAKALEASAHKAIAa0ECdUECahCwCSEDIAEoAgAhAiABIAM2AgAgAgRAIAIgASgCBBEBAAsgASgCAEUNASABKAIAIQILIAAtAL8BBEAgAkEtOgAAIAJBAWohAgsgBygCACEEA0ACQCAEIAAoAsQBTwRAIAJBADoAACAAIAY2AgAgAEEQaiAAENsFQQFHDQEgASgCACECIAFBADYCACACBEAgAiABKAIEEQEACwwECyAC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AgAgCygChAFGDQBBACEAIAtBADYCECARIA8oAgAgCygChAEgC0EQahCABiALKAIQBEAgBSAFKAIAQQRyNgIADAELQQEhAAsgEBDlCBogDRDlCBogDBDlCBogDhDlCBogERDlCBogDygCACEBIA9BADYCACABBEAgASAPKAIEEQEACyALQbAEaiQAIAAPCyAKIQQLIAFBAWohAQwAAAsAC6UDAQF/IwBBEGsiCiQAIAkCfyAABEAgCiABELEHIgAiASABKAIAKAIsEQIAIAIgCigCADYAACAKIAAgACgCACgCIBECACAIIAoQsgcgChDlCBogCiAAIAAoAgAoAhwRAgAgByAKELIHIAoQ5QgaIAMgACAAKAIAKAIMEQAANgIAIAQgACAAKAIAKAIQEQAANgIAIAogACAAKAIAKAIUEQIAIAUgChClByAKEOUIGiAKIAAgACgCACgCGBECACAGIAoQsgcgChDlCBogACAAKAIAKAIkEQAADAELIAogARCzByIAIgEgASgCACgCLBECACACIAooAgA2AAAgCiAAIAAoAgAoAiARAgAgCCAKELIHIAoQ5QgaIAogACAAKAIAKAIcEQIAIAcgChCyByAKEOUIGiADIAAgACgCACgCDBEAADYCACAEIAAgACgCACgCEBEAADYCACAKIAAgACgCACgCFBECACAFIAoQpQcgChDlCBogCiAAIAAoAgAoAhgRAgAgBiAKELIHIAoQ5QgaIAAgACgCACgCJBEAAAs2AgAgCkEQaiQACx8BAX8gASgCABCBBSECIAAgASgCADYCBCAAIAI2AgAL/AIBAX8jAEHAA2siACQAIAAgATYCuAMgACACNgKwAyAAQYIFNgIUIABBGGogAEEgaiAAQRRqEPcFIQEgACAEKAIcIgc2AhAgByAHKAIEQQFqNgIEIABBEGoQ+wQhByAAQQA6AA8gAEG4A2ogAiADIABBEGogBCgCBCAFIABBD2ogByABIABBFGogAEGwA2oQqwcEQCAGEK8HIAAtAA8EQCAGIAdBLSAHKAIAKAIsEQMAEPUICyAHQTAgBygCACgCLBEDACECIAEoAgAhBCAAKAIUIgNBfGohBwNAAkAgBCAHTw0AIAQoAgAgAkcNACAEQQRqIQQMAQsLIAYgBCADELAHCyAAQbgDaiAAQbADahD+BARAIAUgBSgCAEECcjYCAAsgACgCuAMhAwJ/IAAoAhAiAiACKAIEQX9qIgQ2AgQgBEF/RgsEQCACIAIoAgAoAggRAQALIAEoAgAhAiABQQA2AgAgAgRAIAIgASgCBBEBAAsgAEHAA2okACADC1sBAn8jAEEQayIBJAACQCAALAALQQBIBEAgACgCACECIAFBADYCDCACIAEoAgw2AgAgAEEANgIEDAELIAFBADYCCCAAIAEoAgg2AgAgAEEAOgALCyABQRBqJAALrgMBBX8jAEEQayIDJAACfyAALAALQQBIBEAgACgCBAwBCyAALQALCyEFIAAsAAtBAEgEfyAAKAIIQf////8HcUF/agVBAQshBAJAIAIgAWtBAnUiBkUNAAJ/An8gACwAC0EASARAIAAoAgAMAQsgAAshByABAn8gACwAC0EASARAIAAoAgAMAQsgAAsCfyAALAALQQBIBEAgACgCBAwBCyAALQALC0ECdGpJIAcgAU1xCwRAIAACfwJ/IANCADcCACADQQA2AgggAyABIAIQ8QUgAyIALAALQQBICwRAIAAoAgAMAQsgAAsCfyADLAALQQBIBEAgAygCBAwBCyADLQALCxD0CCADEOUIGgwBCyAEIAVrIAZJBEAgACAEIAUgBmogBGsgBSAFEPMICwJ/IAAsAAtBAEgEQCAAKAIADAELIAALIAVBAnRqIQQDQCABIAJHBEAgBCABKAIANgIAIAFBBGohASAEQQRqIQQMAQsLIANBADYCACAEIAMoAgA2AgAgBSAGaiEBAkAgACwAC0EASARAIAAgATYCBAwBCyAAIAE6AAsLCyADQRBqJAALCwAgAEHUrwIQ9gULIAAgABDYCCAAIAEoAgg2AgggACABKQIANwIAIAEQmwYLCwAgAEHMrwIQ9gULfgEBfyMAQSBrIgMkACADIAE2AhAgAyAANgIYIAMgAjYCCANAAkACf0EBIAMoAhggAygCEEZBAXNFDQAaIAMoAhgoAgAgAygCCCgCAEYNAUEACyEAIANBIGokACAADwsgAyADKAIYQQRqNgIYIAMgAygCCEEEajYCCAwAAAsACzcBAX8jAEEQayICJAAgAiAAKAIANgIIIAIgAigCCCABQQJ0ajYCCCACKAIIIQAgAkEQaiQAIAAL9AYBC38jAEHQA2siACQAIAAgBTcDECAAIAY3AxggACAAQeACajYC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IABBMGohAiAAKALEAwJ/IA0sAAtBAEgEQCANKAIEDAELIA0tAAsLIA5qaiIOQeUATwRAIA5BAnQQsAkhDiAIKAIAIQIgCCAONgIAIAIEQCACIAgoAgQRAQALIAgoAgAiAkUNAQsgAiAAQSRqIABBIGogAygCBCAMIAwgCUECdGogESAPIABBgARqIAAoAvwDIAAoAvgDIBAgDSAHIAAoAsQDEL0HIAEgAiAAKAIkIAAoAiAgAyAEENEGIQIgCCgCACEBIAhBADYCACABBEAgASAIKAIEEQEACyAHEOUIGiANEOUIGiAQEOUIGgJ/IAAoAogEIgEgASgCBEF/aiIDNgIEIANBf0YLBEAgASABKAIAKAIIEQEACyAKKAIAIQEgCkEANgIAIAEEQCABIAooAgQRAQALIAsoAgAhASALQQA2AgAgAQRAIAEgCygCBBEBAAsgAEGwCGokACACDwsQkwcAC9EDAQF/IwBBEGsiCiQAIAkCfyAABEAgAhCxByEAAkAgAQRAIAogACAAKAIAKAIsEQIAIAMgCigCADYAACAKIAAgACgCACgCIBECAAwBCyAKIAAgACgCACgCKBECACADIAooAgA2AAAgCiAAIAAoAgAoAhwRAgALIAggChCyByAKEOUIGiAEIAAgACgCACgCDBEAADYCACAFIAAgACgCACgCEBEAADYCACAKIAAgACgCACgCFBECACAGIAoQpQcgChDlCBogCiAAIAAoAgAoAhgRAgAgByAKELIHIAoQ5QgaIAAgACgCACgCJBEAAAwBCyACELMHIQACQCABBEAgCiAAIAAoAgAoAiwRAgAgAyAKKAIANgAAIAogACAAKAIAKAIgEQIADAELIAogACAAKAIAKAIoEQIAIAMgCigCADYAACAKIAAgACgCACgCHBECAAsgCCAKELIHIAoQ5QgaIAQgACAAKAIAKAIMEQAANgIAIAUgACAAKAIAKAIQEQAANgIAIAogACAAKAIAKAIUEQIAIAYgChClByAKEOUIGiAKIAAgACgCACgCGBECACAHIAoQsgcgChDlCBogACAAKAIAKAIkEQAACzYCACAKQRBqJAAL6AcBCn8jAEEQayIUJAAgAiAANgIAIANBgARxIRYCQANAAkAgFUEERgRAAn8gDSwAC0EASARAIA0oAgQMAQsgDS0ACwtBAUsEQCAUIA0Q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KAIAIQEgACwAC0EASAR/IAAoAghB/////wdxQX9qBUEKCxogARCxCSAAQYCAgIB4NgIIIABBADoACwsLUAEBfyAAEK8HIAAsAAtBAEgEQCAAKAIAIQEgACwAC0EASAR/IAAoAghB/////wdxQX9qBUEBCxogARCxCSAAQYCAgIB4NgIIIABBADoACwsLOgIBfwF+IwBBEGsiAyQAIAMgASACEJkGEOoFIAMpAwAhBCAAIAMpAwg3AwggACAENwMAIANBEGokAAsDAAALRwEBfyAAQQhqIgEoAgBFBEAgACAAKAIAKAIQEQEADwsCfyABIAEoAgBBf2oiATYCACABQX9GCwRAIAAgACgCACgCEBEBAAsLBABBAAsuAANAIAAoAgBBAUYNAAsgACgCAEUEQCAAQQE2AgAgAUGEBREBACAAQX82AgALCzEBAn8gAEEBIAAbIQADQAJAIAAQsAkiAQ0AQey+AigCACICRQ0AIAIRBwAMAQsLIAELOgECfyABEKYEIgJBDWoQ3ggiA0EANgIIIAMgAjYCBCADIAI2AgAgACADQQxqIAEgAkEBahC8CTYCAAspAQF/IAIEQCAAIQMDQCADIAE2AgAgA0EEaiEDIAJBf2oiAg0ACwsgAAtpAQF/AkAgACABa0ECdSACSQRAA0AgACACQX9qIgJBAnQiA2ogASADaigCADYCACACDQAMAgALAAsgAkUNACAAIQMDQCADIAEoAgA2AgAgA0EEaiEDIAFBBGohASACQX9qIgINAAsLIAALCgBBnOoBENwCAAtZAQJ/IwBBEGsiAyQAIABCADcCACAAQQA2AgggACECAkAgASwAC0EATgRAIAIgASgCCDYCCCACIAEpAgA3AgAMAQsgACABKAIAIAEoAgQQ5AgLIANBEGokAAucAQEDfyMAQRBrIgQkAEFvIAJPBEACQCACQQpNBEAgACACOgALIAAhAwwBCyAAIAJBC08EfyACQRBqQXBxIgMgA0F/aiIDIANBC0YbBUEKC0EBaiIFEMoIIgM2AgAgACAFQYCAgIB4cjYCCCAAIAI2AgQLIAMgASACENwEIARBADoADyACIANqIAQtAA86AAAgBEEQaiQADwsQ4ggACx0AIAAsAAtBAEgEQCAAKAIIGiAAKAIAELEJCyAAC8kBAQN/IwBBEGsiBCQAAkAgACwAC0EASAR/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ACABoiIAIACjDwsgCEIBhiIFIAZWBEAgB0I0iKdB/w9xIQMCfiACRQRAQQAhAiAIQgyGIgVCAFkEQANAIAJBf2ohAiAFQgGGIgVCf1UNAAsLIAhBASACa62GDAELIAhC/////////weDQoCAgICAgIAIhAsiBQJ+IANFBEBBACEDIAdCDIYiBkIAWQRAA0AgA0F/aiEDIAZCAYYiBkJ/VQ0ACwsgB0EBIANrrYYMAQsgB0L/////////B4NCgICAgICAgAiECyIHfSIGQn9VIQQgAiADSgRAA0ACQCAERQ0AIAYiBUIAUg0AIABEAAAAAAAAAACiDwsgBUIBhiIFIAd9IgZCf1UhBCACQX9qIgIgA0oNAAsgAyECCwJAIARFDQAgBiIFQgBSDQAgAEQAAAAAAAAAAKIPCwJAIAVC/////////wdWBEAgBSEGDAELA0AgAkF/aiECIAVCgICAgICAgARUIQMgBUIBhiIGIQUgAw0ACwsgCEKAgICAgICAgIB/gyEFIAJBAU4EfiAGQoCAgICAgIB4fCACrUI0hoQFIAZBASACa62ICyAFhL8PCyAARAAAAAAAAAAAoiAAIAUgBlEbC6sGAgV/BH4jAEGAAWsiBSQAAkACQAJAIAMgBEIAQgAQwQVFDQAgAyAEELsJIQcgAkIwiKciCUH//wFxIgZB//8BRg0AIAcNAQsgBUEQaiABIAIgAyAEEL0FIAUgBSkDECICIAUpAxgiASACIAEQxwUgBSkDCCECIAUpAwAhBAwBCyABIAJC////////P4MgBq1CMIaEIgogAyAEQv///////z+DIARCMIinQf//AXEiB61CMIaEIgsQwQVBAEwEQCABIAogAyALEMEFBEAgASEEDAILIAVB8ABqIAEgAkIAQgAQvQUgBSkDeCECIAUpA3AhBAwBCyAGBH4gAQUgBUHgAGogASAKQgBCgICAgICAwLvAABC9BSAFKQNoIgpCMIinQYh/aiEGIAUpA2ALIQQgB0UEQCAFQdAAaiADIAtCAEKAgICAgIDAu8AAEL0FIAUpA1giC0IwiKdBiH9qIQcgBSkDUCEDCyAKQv///////z+DQoCAgICAgMAAhCIKIAtC////////P4NCgICAgICAwACEIg19IAQgA1StfSIMQn9VIQggBCADfSELIAYgB0oEQANAAn4gCARAIAsg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A0F8aiIEIABJBEAgACECDAELIAAhAgNAIAIgAS0AADoAACACIAEtAAE6AAEgAiABLQACOgACIAIgAS0AAzoAAyABQQRqIQEgAkEEaiICIARNDQALCyACIANJBEADQCACIAEtAAA6AAAgAUEBaiEBIAJBAWoiAiADRw0ACwsgAAvzAgICfwF+AkAgAkUNACAAIAJqIgNBf2ogAToAACAAIAE6AAAgAkEDSQ0AIANBfmogAToAACAAIAE6AAEgA0F9aiABOgAAIAAgAToAAiACQQdJDQAgA0F8aiABOgAAIAAgAToAAyACQQlJDQAgAEEAIABrQQNxIgRqIgMgAUH/AXFBgYKECGwiATYCACADIAIgBGtBfHEiBGoiAkF8aiABNgIAIARBCUkNACADIAE2AgggAyABNgIEIAJBeGogATYCACACQXRqIAE2AgAgBEEZSQ0AIAMgATYCGCADIAE2AhQgAyABNgIQIAMgATYCDCACQXBqIAE2AgAgAkFsaiABNgIAIAJBaGogATYCACACQWRqIAE2AgAgBCADQQRxQRhyIgRrIgJBIEkNACABrSIFQiCGIAWEIQUgAyAEaiEBA0AgASAFNwMYIAEgBTcDECABIAU3AwggASAFNwMAIAFBIGohASACQWBqIgJBH0sNAAsLIAAL5QIBAn8CQCAAIAFGDQACQCABIAJqIABLBEAgACACaiIEIAFLDQELIAAgASACELwJGg8LIAAgAXNBA3EhAwJAAkAgACABSQRAIAMNAiAAQQNxRQ0BA0AgAkUNBCAAIAEtAAA6AAAgAUEBaiEBIAJBf2ohAiAAQQFqIgBBA3ENAAsMAQsCQCADDQAgBEEDcQRAA0AgAkUNBSAAIAJBf2oiAmoiAyABIAJqLQAAOgAAIANBA3ENAAsLIAJBA00NAANAIAAgAkF8aiICaiABIAJqKAIANgIAIAJBA0sNAAsLIAJFDQIDQCAAIAJBf2oiAmogASACai0AADoAACACDQALDAILIAJBA00NACACIQMDQCAAIAEoAgA2AgAgAUEEaiEBIABBBGohACADQXxqIgNBA0sNAAsgAkEDcSECCyACRQ0AA0AgACABLQAAOgAAIABBAWohACABQQFqIQEgAkF/aiICDQALCwsfAEHkwgIoAgBFBEBB6MICIAE2AgBB5MICIAA2AgALCwQAIwALEAAjACAAa0FwcSIAJAAgAAsGACAAJAALBgAgAEAACwsAIAEgAiAAEQIACw8AIAEgAiADIAQgABELAAsNACABIAIgAyAAER4ACw8AIAEgAiADIAQgABFKAAsNACABIAIgAyAAERoACw8AIAEgAiADIAQgABEZAAsLACABIAIgABEPAAsLACABIAIgABEYAAsPACABIAIgAyAEIAARWgALEQAgASACIAMgBCAFIAARTQALEQAgASACIAMgBCAFIAARWwALEwAgASACIAMgBCAFIAYgABFOAAsPACABIAIgAyAEIAARFQALEQAgASACIAMgBCAFIAARUwALDQAgASACIAMgABEUAAsPACABIAIgAyAEIAARUAALDwAgASACIAMgBCAAETwACxEAIAEgAiADIAQgBSAAETYACxEAIAEgAiADIAQgBSAAET0ACxMAIAEgAiADIAQgBSAGIAARNwALEwAgASACIAMgBCAFIAYgABE+AAsVACABIAIgAyAEIAUgBiAHIAAROAALCwAgASACIAAREwALDQAgASACIAMgABFLAAsRACABIAIgAyAEIAUgABFAAAsTACABIAIgAyAEIAUgBiAAESUACw8AIAEgAiADIAQgABFEAAsNACABIAIgAyAAET8ACw8AIAEgAiADIAQgABE5AAsPACABIAIgAyAEIAARCAALEQAgASACIAMgBCAFIAAROwALEwAgASACIAMgBCAFIAYgABE0AAsTACABIAIgAyAEIAUgBiAAEVwACxUAIAEgAiADIAQgBSAGIAcgABFSAAsTACABIAIgAyAEIAUgBiAAES8ACxUAIAEgAiADIAQgBSAGIAcgABFXAAsTACABIAIgAyAEIAUgBiAAEV0ACxUAIAEgAiADIAQgBSAGIAcgABFVAAsXACABIAIgAyAEIAUgBiAHIAggABFfAAsZACABIAIgAyAEIAUgBiAHIAggCSAAEVgACw0AIAEgAiADIAARIwALDwAgASACIAMgBCAAESoACxMAIAEgAiADIAQgBSAGIAARLAALFQAgASACIAMgBCAFIAYgByAAEU8ACw8AIAEgAiADIAQgABEfAAsRACABIAIgAyAEIAUgABErAAsNACABIAIgAyAAESEACw8AIAEgAiADIAQgABE1AAsRACABIAIgAyAEIAUgABEKAAsNACABIAIgAyAAEUYACw8AIAEgAiADIAQgABFFAAsJACABIAARKAALCwAgASACIAARKQALDwAgASACIAMgBCAAEUgACxEAIAEgAiADIAQgBSAAEUkACxMAIAEgAiADIAQgBSAGIAARMgALFQAgASACIAMgBCAFIAYgByAAETEACw0AIAEgAiADIAARYQALDwAgASACIAMgBCAAETMACw8AIAEgAiADIAQgABFmAAsRACABIAIgAyAEIAUgABEtAAsTACABIAIgAyAEIAUgBiAAEVEACxMAIAEgAiADIAQgBSAGIAARXgALFQAgASACIAMgBCAFIAYgByAAEVYACxEAIAEgAiADIAQgBSAAES4ACxMAIAEgAiADIAQgBSAGIAARVAALCwAgASACIAARaAALDwAgASACIAMgBCAAEVkACxEAIAEgAiADIAQgBSAAEUwACxMAIAEgAiADIAQgBSAGIAARRwALEQAgASACIAMgBCAFIAARBgALFwAgASACIAMgBCAFIAYgByAIIAARDgALEwAgASACIAMgBCAFIAYgABEJAAsRACABIAIgAyAEIAUgABEmAAsVACABIAIgAyAEIAUgBiAHIAAREgALEwAgASACIAMgBCAFIAYgABENAAsHACAAEQcACxkAIAEgAiADrSAErUIghoQgBSAGIAARJAALIgEBfiABIAKtIAOtQiCGhCAEIAARHAAiBUIgiKcQKSAFpwsZACABIAIgAyAEIAWtIAatQiCGhCAAESIACyMAIAEgAiADIAQgBa0gBq1CIIaEIAetIAitQiCGhCAAEUMACyUAIAEgAiADIAQgBSAGrSAHrUIghoQgCK0gCa1CIIaEIAARQgALC8fpAVQAQYAIC4ARVmVjdG9ySW50AFZlY3RvckRvdWJsZQBWZWN0b3JDaGFyAFZlY3RvclVDaGFyAFZlY3RvckZsb2F0AHZlY3RvclRvb2xzAGNsZWFyVmVjdG9yRGJsAGNsZWFyVmVjdG9yRmxvYXQAbWF4aVNldHRpbmdzAHNldHVwAG1heGlFbnZlbG9wZQBsaW5lAHRyaWdnZXIAYW1wbGl0dWRlAHZhbGluZGV4AG1heGlEZWxheWxpbmUAZGwAbWF4aUZpbHRlcgBsb3JlcwBoaXJlcwBiYW5kcGFzcwBsb3Bhc3MAaGlwYXNzAGN1dG9mZgByZXNvbmFuY2UAbWF4aU1peABzdGVyZW8AcXVhZABhbWJpc29uaWMAbWF4aUxpbmUAcGxheQBwcmVwYXJlAHRyaWdnZXJFbmFibGUAaXNMaW5lQ29tcGxldGUAbWF4aVhGYWRlAHhmYWRlAG1heGlMYWdFeHAAaW5pdABhZGRTYW1wbGUAdmFsdWUAYWxwaGEAYWxwaGFSZWNpcHJvY2FsAHZhbABtYXhpU2FtcGxlAGdldExlbmd0aABzZXRTYW1wbGUAc2V0U2FtcGxlRnJvbU9nZ0Jsb2IAaXNSZWFkeQBwbGF5T25jZQBwbGF5T25aWABwbGF5NABjbGVhcgBub3JtYWxpc2UAYXV0b1RyaW0AbG9hZAByZWFkAGxvb3BTZXRQb3NPblpYAG1heGlEeW4AZ2F0ZQBjb21wcmVzc29yAGNvbXByZXNzAHNldEF0dGFjawBzZXRSZWxlYXNlAHNldFRocmVzaG9sZABzZXRSYXRpbwBtYXhpRW52AGFyAGFkc3IAc2V0RGVjYXkAc2V0U3VzdGFpbgBjb252ZXJ0AG10b2YAbXNUb1NhbXBzAG1heGlTYW1wbGVBbmRIb2xkAHNhaABtYXhpRmxhbmdlcgBmbGFuZ2UAbWF4aUNob3J1cwBjaG9ydXMAbWF4aURDQmxvY2tlcgBtYXhpU1ZGAHNldEN1dG9mZgBzZXRSZXNvbmFuY2UAbWF4aU1hdGgAYWRkAHN1YgBtdWwAZGl2AGd0AGx0AGd0ZQBsdGUAbW9kAGFicwBwb3cAbWF4aUNsb2NrAHRpY2tlcgBzZXRUZW1wbwBzZXRUaWNrc1BlckJlYXQAaXNUaWNrAGN1cnJlbnRDb3VudABwbGF5SGVhZABicHMAYnBtAHRpY2sAdGlja3MAbWF4aUt1cmFtb3RvT3NjaWxsYXRvcgBzZXRQaGFzZQBnZXRQaGFzZQBtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0AHNldFBoYXNlcwBzaXplAG1heGlBc3luY0t1cmFtb3RvT3NjaWxsYXRvcgBtYXhpRkZUAHByb2Nlc3MAc3BlY3RyYWxGbGF0bmVzcwBzcGVjdHJhbENlbnRyb2lkAGdldE1hZ25pdHVkZXMAZ2V0TWFnbml0dWRlc0RCAGdldFBoYXNlcwBnZXROdW1CaW5zAGdldEZGVFNpemUAZ2V0SG9wU2l6ZQBnZXRXaW5kb3dTaXplAG1heGlGRlRNb2RlcwBXSVRIX1BPTEFSX0NPTlZFUlNJT04ATk9fUE9MQVJfQ09OVkVSU0lPTgBtYXhpSUZGVABtYXhpSUZGVE1vZGVzAFNQRUNUUlVNAENPTVBMRVgAbWF4aU1GQ0MAbWZjYwBtYXhpVGltZVN0cmV0Y2gAc2hhcmVkX3B0cjxtYXhpVGltZXN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4AZ2V0Tm9ybWFsaXNlZFBvc2l0aW9uAGdldFBvc2l0aW9uAHNldFBvc2l0aW9uAHBsYXlBdFBvc2l0aW9uAG1heGlQaXRjaFNoaWZ0AHNoYXJlZF9wdHI8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4AbWF4aVN0cmV0Y2gAc2V0TG9vcFN0YXJ0AHNldExvb3BFbmQAZ2V0TG9vcEVuZABtYXhpQml0cwBzaWcAYXQAc2hsAHNocgByAGxhbmQAbG9yAGx4b3IAbmVnAGluYwBkZWMAZXEAbm9pc2UAdG9TaWduYWwAdG9UcmlnU2lnbmFsAGZyb21TaWduYWwAbWF4aUNvdW50ZXIAY291bnQAbWF4aUluZGV4AHB1bGwAbWF4aVJhdGlvU2VxAHBsYXlUcmlnAHBsYXlWYWx1ZXMAbWF4aVNhdFJldmVyYgBtYXhpRnJlZVZlcmIAYWxsb2NhdG9yPFQ+OjphbGxvY2F0ZShzaXplX3QgbikgJ24nIGV4Y2VlZHMgbWF4aW11bSBzdXBwb3J0ZWQgc2l6ZQBwdXNoX2JhY2sAcmVzaXplAGdldABzZXQATlN0M19fMjZ2ZWN0b3JJaU5TXzlhbGxvY2F0b3JJaUVFRUUATlN0M19fMjEzX192ZWN0b3JfYmFzZUlpTlNfOWFsbG9jYXRvcklpRUVFRQBOU3QzX18yMjBfX3ZlY3Rvcl9iYXNlX2NvbW1vbklMYjFFRUUAvHgAAEMLAABAeQAAFwsAAAAAAAABAAAAaAsAAAAAAABAeQAA8woAAAAAAAABAAAAcAsAAAAAAABQTlN0M19fMjZ2ZWN0b3JJaU5TXzlhbGxvY2F0b3JJaUVFRUUAAAAAnHkAAKALAAAAAAAAiAsAAFBLTlN0M19fMjZ2ZWN0b3JJaU5TXzlhbGxvY2F0b3JJaUVFRUUAAACceQAA2AsA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ADwhAABQIQAAxHcAAFAhAAAkeAAAJHgAACR4AEGgwwALtg1UeAAAUCEAAOgQAADoEAAAzCEAAE44bWF4aUlGRlQ4ZmZ0TW9kZXNFAAAAAHB4AAC0IQAAZmlpaWlpADE2bWF4aU1GQ0NBbmFseXNlcklkRQAAAAC8eAAA2yEAAFAxNm1heGlNRkNDQW5hbHlzZXJJZEUAAJx5AAD8IQAAAAAAAPQhAABQSzE2bWF4aU1GQ0NBbmFseXNlcklkRQCceQAAJCIAAAEAAAD0IQAAFCIAAMR3AAAUIgAAMHgAADB4AAAweAAAYHgAAGB4AAB2aWlpaWlkZAAAAAAQDQAAFCIAAOgQAAAxNW1heGlUaW1lU3RyZXRjaEkxNGhhbm5XaW5GdW5jdG9yRQC8eAAAhCIAAFAxNW1heGlUaW1lU3RyZXRjaEkxNGhhbm5XaW5GdW5jdG9yRQAAAACceQAAsCIAAAAAAACoIgAAUEsxNW1heGlUaW1lU3RyZXRjaEkxNGhhbm5XaW5GdW5jdG9yRQAAAJx5AADoIgAAAQAAAKgiAAAAAAAA2CMAAAkCAAAKAgAACwIAAAwCAAANAgAATlN0M19fMjIwX19zaGFyZWRfcHRyX3BvaW50ZXJJUDE1bWF4aVRpbWVTdHJldGNoSTE0aGFubldpbkZ1bmN0b3JFTjEwZW1zY3JpcHRlbjE1c21hcnRfcHRyX3RyYWl0SU5TXzEwc2hhcmVkX3B0cklTM19FRUUxMXZhbF9kZWxldGVyRU5TXzlhbGxvY2F0b3JJUzNfRUVFRQAA5HgAADwjAAAEdQAATjEwZW1zY3JpcHRlbjE1c21hcnRfcHRyX3RyYWl0SU5TdDNfXzIxMHNoYXJlZF9wdHJJMTVtYXhpVGltZVN0cmV0Y2hJMTRoYW5uV2luRnVuY3RvckVFRUUxMXZhbF9kZWxldGVyRQBOU3QzX18yMTBzaGFyZWRfcHRySTE1bWF4aVRpbWVTdHJldGNoSTE0aGFubldpbkZ1bmN0b3JFRUUAAAC8eAAATCQAAGkAAACIJAAAAAAAAAwlAAAOAgAADwIAABACAAARAgAAEgIAAE5TdDNfXzIyMF9fc2hhcmVkX3B0cl9lbXBsYWNlSTE1bWF4aVRpbWVTdHJldGNoSTE0aGFubldpbkZ1bmN0b3JFTlNfOWFsbG9jYXRvcklTM19FRUVFAADkeAAAtCQAAAR1AADEdwAA2CIAACQXAABgeAAA2CIAAMR3AADYIgAAYHgAAAAAAACEJQAAEwIAABQCAAAVAgAAOW1heGlHcmFpbkkxNGhhbm5XaW5GdW5jdG9yRQAxM21heGlHcmFpbkJhc2UAAAAAvHgAAGklAADkeAAATCUAAHwlAABgeAAA2CIAAGB4AABgeAAAJHgAAGB4AABkaWlkZGlkAGB4AADYIgAAYHgAAGB4AAAkeAAAMTRtYXhpUGl0Y2hTaGlmdEkxNGhhbm5XaW5GdW5jdG9yRQAAvHgAAMQlAABQMTRtYXhpUGl0Y2hTaGlmdEkxNGhhbm5XaW5GdW5jdG9yRQCceQAA8CUAAAAAAADoJQAAUEsxNG1heGlQaXRjaFNoaWZ0STE0aGFubldpbkZ1bmN0b3JFAAAAAJx5AAAkJgAAAQAAAOglAAAAAAAAFCcAABYCAAAXAgAAGAIAABkCAAAaAgAATlN0M19fMjIwX19zaGFyZWRfcHRyX3BvaW50ZXJJUDE0bWF4aVBpdGNoU2hpZnRJMTRoYW5uV2luRnVuY3RvckVOMTBlbXNjcmlwdGVuMTVzbWFydF9wdHJfdHJhaXRJTlNfMTBzaGFyZWRfcHRySVMzX0VFRTExdmFsX2RlbGV0ZXJFTlNfOWFsbG9jYXRvcklTM19FRUVFAAAA5HgAAHgmAAAEdQAATjEwZW1zY3JpcHRlbjE1c21hcnRfcHRyX3RyYWl0SU5TdDNfXzIxMHNoYXJlZF9wdHJJMTRtYXhpUGl0Y2hTaGlmdEkxNGhhbm5XaW5GdW5jdG9yRUVFRTExdmFsX2RlbGV0ZXJFAE5TdDNfXzIxMHNoYXJlZF9wdHJJMTRtYXhpUGl0Y2hTaGlmdEkxNGhhbm5XaW5GdW5jdG9yRUVFALx4AACHJwAAwCcAAAAAAABAKAAAGwIAABwCAAAdAgAAEQIAAB4CAABOU3QzX18yMjBfX3NoYXJlZF9wdHJfZW1wbGFjZUkxNG1heGlQaXRjaFNoaWZ0STE0aGFubldpbkZ1bmN0b3JFTlNfOWFsbG9jYXRvcklTM19FRUVFAAAA5HgAAOgnAAAEdQAAxHcAABQmAAAkFwBB4NAAC9IBYHgAABQmAABgeAAAYHgAACR4AABgeAAAMTFtYXhpU3RyZXRjaEkx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RQAAAAAAACRGAABlAgAAZgIAAE5TdDNfXzI4aW9zX2Jhc2VFAAAAvHgAABBGAAAAAAAAaEYAAGcCAABoAgAATlN0M19fMjliYXNpY19pb3NJY05TXzExY2hhcl90cmFpdHNJY0VFRUUAAADkeAAAPEYAACRGAAAAAAAAsEYAAGkCAABqAgAATlN0M19fMjliYXNpY19pb3NJd05TXzExY2hhcl90cmFpdHNJd0VFRUUAAADkeAAAhEYAACRGAABOU3QzX18yMTViYXNpY19zdHJlYW1idWZJY05TXzExY2hhcl90cmFpdHNJY0VFRUUAAAAAvHgAALxGAABOU3QzX18yMTViYXNpY19zdHJlYW1idWZJd05TXzExY2hhcl90cmFpdHNJd0VFRUUAAAAAvHgAAPhGAABOU3QzX18yMTNiYXNpY19pc3RyZWFtSWNOU18xMWNoYXJfdHJhaXRzSWNFRUVFAABAeQAANEcAAAAAAAABAAAAaEYAAAP0//9OU3QzX18yMTNiYXNpY19pc3RyZWFtSXdOU18xMWNoYXJfdHJhaXRzSXdFRUVFAABAeQAAfEcAAAAAAAABAAAAsEYAAAP0//9OU3QzX18yMTNiYXNpY19vc3RyZWFtSWNOU18xMWNoYXJfdHJhaXRzSWNFRUVFAABAeQAAxEcAAAAAAAABAAAAaEYAAAP0//9OU3QzX18yMTNiYXNpY19vc3RyZWFtSXdOU18xMWNoYXJfdHJhaXRzSXdFRUVFAABAeQAADEgAAAAAAAABAAAAsEYAAAP0//8ohgAAAAAAALBIAABBAgAAbAIAAG0CAABEAgAARQIAAEYCAABHAgAALwIAADACAABuAgAAbwIAAHACAAA0AgAASgIAAE5TdDNfXzIxMF9fc3RkaW5idWZJY0VFAOR4AACYSAAA8EYAAHVuc3VwcG9ydGVkIGxvY2FsZSBmb3Igc3RhbmRhcmQgaW5wdXQAAAAAAAAAPEkAAEsCAABxAgAAcgIAAE4CAABPAgAAUAIAAFECAABSAgAAUwIAAHMCAAB0AgAAdQIAAFcCAABYAgAATlN0M19fMjEwX19zdGRpbmJ1Zkl3RUUA5HgAACRJAAAsRwAAAAAAAKRJAABBAgAAdgIAAHcCAABEAgAARQIAAEYCAAB4AgAALwIAADACAABIAgAAMgIAAEkCAAB5AgAAegIAAE5TdDNfXzIxMV9fc3Rkb3V0YnVmSWNFRQAAAADkeAAAiEkAAPBGAAAAAAAADEoAAEsCAAB7AgAAfAIAAE4CAABPAgAAUAIAAH0CAABSAgAAUwIAAFQCAABVAgAAVgIAAH4CAAB/AgAATlN0M19fMjExX19zdGRvdXRidWZJd0VFAAAAAOR4AADwSQAALEcAQaCUAQvjBP////////////////////////////////////////////////////////////////8AAQIDBAUGBwgJ/////////woLDA0ODxAREhMUFRYXGBkaGxwdHh8gISIj////////CgsMDQ4PEBESExQVFhcYGRobHB0eHyAhIiP/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////AAECBAcDBgUAAAAAAAAAAgAAwAMAAMAEAADABQAAwAYAAMAHAADACAAAwAkAAMAKAADACwAAwAwAAMANAADADgAAwA8AAMAQAADAEQAAwBIAAMATAADAFAAAwBUAAMAWAADAFwAAwBgAAMAZAADAGgAAwBsAAMAcAADAHQAAwB4AAMAfAADAAAAAswEAAMMCAADDAwAAwwQAAMMFAADDBgAAwwcAAMMIAADDCQAAwwoAAMMLAADDDAAAww0AANMOAADDDwAAwwAADLsBAAzDAgAMwwMADMMEAAzTaW5maW5pdHkAbmFuAAAAAAAAAADRdJ4AV529KoBwUg///z4nCgAAAGQAAADoAwAAECcAAKCGAQBAQg8AgJaYAADh9QUYAAAANQAAAHEAAABr////zvv//5K///8AAAAAAAAAAN4SBJUAAAAA////////////////YEwAABQAAABDLlVURi04AEGomQELAnRMAEHAmQELBkxDX0FMTABB0JkBC25MQ19DVFlQRQAAAABMQ19OVU1FUklDAABMQ19USU1FAAAAAABMQ19DT0xMQVRFAABMQ19NT05FVEFSWQBMQ19NRVNTQUdFUwBMQU5HAEMuVVRGLTgAUE9TSVgATVVTTF9MT0NQQVRIAAAAAABATgBBwJwBC/8BAgACAAIAAgACAAIAAgACAAIAAyACIAIgAiACIAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAFgBMAEwATABMAEwATABMAEwATABMAEwATABMAEwATACNgI2AjYCNgI2AjYCNgI2AjYCNgEwATABMAEwATABMAEwAjVCNUI1QjVCNUI1QjFCMUIxQjFCMUIxQjFCMUIxQjFCMUIxQjFCMUIxQjFCMUIxQjFCMUEwATABMAEwATABMAI1gjWCNYI1gjWCNYIxgjGCMYIxgjGCMYIxgjGCMYIxgjGCMYIxgjGCMYIxgjGCMYIxgjGBMAEwATABMACAEHAoAELAlBSAEHUpAEL+QMBAAAAAgAAAAMAAAAEAAAABQAAAAYAAAAHAAAACAAAAAkAAAAKAAAACwAAAAwAAAANAAAADgAAAA8AAAAQAAAAEQAAABIAAAATAAAAFAAAABUAAAAWAAAAFwAAABgAAAAZAAAAGgAAABsAAAAcAAAAHQAAAB4AAAAfAAAAIAAAACEAAAAiAAAAIwAAACQAAAAlAAAAJgAAACcAAAAoAAAAKQAAACoAAAArAAAALAAAAC0AAAAuAAAALwAAADAAAAAxAAAAMgAAADMAAAA0AAAANQAAADYAAAA3AAAAOAAAADkAAAA6AAAAOwAAADwAAAA9AAAAPgAAAD8AAABAAAAAQQAAAEIAAABDAAAARAAAAEUAAABGAAAARwAAAEgAAABJAAAASgAAAEsAAABMAAAATQAAAE4AAABPAAAAUAAAAFEAAABSAAAAUwAAAFQAAABVAAAAVgAAAFcAAABYAAAAWQAAAFoAAABbAAAAXAAAAF0AAABeAAAAXwAAAGAAAABBAAAAQgAAAEMAAABEAAAARQAAAEYAAABHAAAASAAAAEkAAABKAAAASwAAAEwAAABNAAAATgAAAE8AAABQAAAAUQAAAFIAAABTAAAAVAAAAFUAAABWAAAAVwAAAFgAAABZAAAAWgAAAHsAAAB8AAAAfQAAAH4AAAB/AEHQrAELAmBYAEHksAEL+QMBAAAAAgAAAAMAAAAEAAAABQAAAAYAAAAHAAAACAAAAAkAAAAKAAAACwAAAAwAAAANAAAADgAAAA8AAAAQAAAAEQAAABIAAAATAAAAFAAAABUAAAAWAAAAFwAAABgAAAAZAAAAGgAAABsAAAAcAAAAHQAAAB4AAAAfAAAAIAAAACEAAAAiAAAAIwAAACQAAAAlAAAAJgAAACcAAAAoAAAAKQAAACoAAAArAAAALAAAAC0AAAAuAAAALwAAADAAAAAxAAAAMgAAADMAAAA0AAAANQAAADYAAAA3AAAAOAAAADkAAAA6AAAAOwAAADwAAAA9AAAAPgAAAD8AAABAAAAAYQAAAGIAAABjAAAAZAAAAGUAAABmAAAAZwAAAGgAAABpAAAAagAAAGsAAABsAAAAbQAAAG4AAABvAAAAcAAAAHEAAAByAAAAcwAAAHQAAAB1AAAAdgAAAHcAAAB4AAAAeQAAAHoAAABbAAAAXAAAAF0AAABeAAAAXwAAAGAAAABhAAAAYgAAAGMAAABkAAAAZQAAAGYAAABnAAAAaAAAAGkAAABqAAAAawAAAGwAAABtAAAAbgAAAG8AAABwAAAAcQAAAHIAAABzAAAAdAAAAHUAAAB2AAAAdwAAAHgAAAB5AAAAegAAAHsAAAB8AAAAfQAAAH4AAAB/AEHguAEL0QEwMTIzNDU2Nzg5YWJjZGVmQUJDREVGeFgrLXBQaUluTgAlcABsAGxsAABMACUAAAAAACVwAAAAACVJOiVNOiVTICVwJUg6JU0AAAAAAAAAACUAAABtAAAALwAAACUAAABkAAAALwAAACUAAAB5AAAAJQAAAFkAAAAtAAAAJQAAAG0AAAAtAAAAJQAAAGQAAAAlAAAASQAAADoAAAAlAAAATQAAADoAAAAlAAAAUwAAACAAAAAlAAAAcAAAAAAAAAAlAAAASAAAADoAAAAlAAAATQBBwLoBC70EJQAAAEgAAAA6AAAAJQAAAE0AAAA6AAAAJQAAAFMAAAAlTGYAMDEyMzQ1Njc4OQAlLjBMZgBDAAAAAAAA6GIAAJMCAACUAgAAlQIAAAAAAABIYwAAlgIAAJcCAACVAgAAmAIAAJkCAACaAgAAmwIAAJwCAACdAgAAngIAAJ8CAAAAAAAAsGIAAKACAAChAgAAlQIAAKICAACjAgAApAIAAKUCAACmAgAApwIAAKgCAAAAAAAAgGMAAKkCAACqAgAAlQIAAKsCAACsAgAArQIAAK4CAACvAgAAAAAAAKRjAACwAgAAsQIAAJUCAACyAgAAswIAALQCAAC1AgAAtgIAAHRydWUAAAAAdAAAAHIAAAB1AAAAZQAAAAAAAABmYWxzZQAAAGYAAABhAAAAbAAAAHMAAABlAAAAAAAAACVtLyVkLyV5AAAAACUAAABtAAAALwAAACUAAABkAAAALwAAACUAAAB5AAAAAAAAACVIOiVNOiVTAAAAACUAAABIAAAAOgAAACUAAABNAAAAOgAAACUAAABTAAAAAAAAACVhICViICVkICVIOiVNOiVTICVZAAAAACUAAABhAAAAIAAAACUAAABiAAAAIAAAACUAAABkAAAAIAAAACUAAABIAAAAOgAAACUAAABNAAAAOgAAACUAAABTAAAAIAAAACUAAABZAAAAAAAAACVJOiVNOiVTICVwACUAAABJAAAAOgAAACUAAABNAAAAOgAAACUAAABTAAAAIAAAACUAAABwAEGIvwEL1gqwXwAAtwIAALgCAACVAgAATlN0M19fMjZsb2NhbGU1ZmFjZXRFAAAA5HgAAJhfAADcdAAAAAAAADBgAAC3AgAAuQIAAJUCAAC6AgAAuwIAALwCAAC9AgAAvgIAAL8CAADAAgAAwQIAAMICAADDAgAAxAIAAMUCAABOU3QzX18yNWN0eXBlSXdFRQBOU3QzX18yMTBjdHlwZV9iYXNlRQAAvHgAABJgAABAeQAAAGAAAAAAAAACAAAAsF8AAAIAAAAoYAAAAgAAAAAAAADEYAAAtwIAAMYCAACVAgAAxwIAAMgCAADJAgAAygIAAMsCAADMAgAAzQIAAE5TdDNfXzI3Y29kZWN2dEljYzExX19tYnN0YXRlX3RFRQBOU3QzX18yMTJjb2RlY3Z0X2Jhc2VFAAAAALx4AACiYAAAQHkAAIBgAAAAAAAAAgAAALBfAAACAAAAvGAAAAIAAAAAAAAAOGEAALcCAADOAgAAlQIAAM8CAADQAgAA0QIAANICAADTAgAA1AIAANUCAABOU3QzX18yN2NvZGVjdnRJRHNjMTFfX21ic3RhdGVfdEVFAABAeQAAFGEAAAAAAAACAAAAsF8AAAIAAAC8YAAAAgAAAAAAAACsYQAAtwIAANYCAACVAgAA1wIAANgCAADZAgAA2gIAANsCAADcAgAA3QIAAE5TdDNfXzI3Y29kZWN2dElEaWMxMV9fbWJzdGF0ZV90RUUAAEB5AACIYQAAAAAAAAIAAACwXwAAAgAAALxgAAACAAAAAAAAACBiAAC3AgAA3gIAAJUCAADXAgAA2AIAANkCAADaAgAA2wIAANwCAADdAgAATlN0M19fMjE2X19uYXJyb3dfdG9fdXRmOElMbTMyRUVFAAAA5HgAAPxhAACsYQAAAAAAAIBiAAC3AgAA3wIAAJUCAADXAgAA2AIAANkCAADaAgAA2wIAANwCAADdAgAATlN0M19fMjE3X193aWRlbl9mcm9tX3V0ZjhJTG0zMkVFRQAA5HgAAFxiAACsYQAATlN0M19fMjdjb2RlY3Z0SXdjMTFfX21ic3RhdGVfdEVFAAAAQHkAAIxiAAAAAAAAAgAAALBfAAACAAAAvGAAAAIAAABOU3QzX18yNmxvY2FsZTVfX2ltcEUAAADkeAAA0GIAALBfAABOU3QzX18yN2NvbGxhdGVJY0VFAOR4AAD0YgAAsF8AAE5TdDNfXzI3Y29sbGF0ZUl3RUUA5HgAABRjAACwXwAATlN0M19fMjVjdHlwZUljRUUAAABAeQAANGMAAAAAAAACAAAAsF8AAAIAAAAoYAAAAgAAAE5TdDNfXzI4bnVtcHVuY3RJY0VFAAAAAOR4AABoYwAAsF8AAE5TdDNfXzI4bnVtcHVuY3RJd0VFAAAAAOR4AACMYwAAsF8AAAAAAAAIYwAA4AIAAOECAACVAgAA4gIAAOMCAADkAgAAAAAAAChjAADlAgAA5gIAAJUCAADnAgAA6AIAAOkCAAAAAAAAxGQAALcCAADqAgAAlQIAAOsCAADsAgAA7QIAAO4CAADvAgAA8AIAAPECAADyAgAA8wIAAPQCAAD1AgAATlN0M19fMjdudW1fZ2V0SWNOU18xOWlzdHJlYW1idWZfaXRlcmF0b3JJY05TXzExY2hhcl90cmFpdHNJY0VFRUVFRQBOU3QzX18yOV9fbnVtX2dldEljRUUATlN0M19fMjE0X19udW1fZ2V0X2Jhc2VFAAC8eAAAimQAAEB5AAB0ZAAAAAAAAAEAAACkZAAAAAAAAEB5AAAwZAAAAAAAAAIAAACwXwAAAgAAAKxkAEHoyQELygGYZQAAtwIAAPYCAACVAgAA9wIAAPgCAAD5AgAA+gIAAPsCAAD8AgAA/QIAAP4CAAD/AgAAAAMAAAEDAABOU3QzX18yN251bV9nZXRJd05TXzE5aXN0cmVhbWJ1Zl9pdGVyYXRvckl3TlNfMTFjaGFyX3RyYWl0c0l3RUVFRUVFAE5TdDNfXzI5X19udW1fZ2V0SXdFRQAAAEB5AABoZQAAAAAAAAEAAACkZAAAAAAAAEB5AAAkZQAAAAAAAAIAAACwXwAAAgAAAIBlAEG8ywEL3gGAZgAAtwIAAAIDAACVAgAAAwMAAAQDAAAFAwAABgMAAAcDAAAIAwAACQMAAAoDAABOU3QzX18yN251bV9wdXRJY05TXzE5b3N0cmVhbWJ1Zl9pdGVyYXRvckljTlNfMTFjaGFyX3RyYWl0c0ljRUVFRUVFAE5TdDNfXzI5X19udW1fcHV0SWNFRQBOU3QzX18yMTRfX251bV9wdXRfYmFzZUUAALx4AABGZgAAQHkAADBmAAAAAAAAAQAAAGBmAAAAAAAAQHkAAOxlAAAAAAAAAgAAALBfAAACAAAAaGYAQaTNAQu+AUhnAAC3AgAACwMAAJUCAAAMAwAADQMAAA4DAAAPAwAAEAMAABEDAAASAwAAEwMAAE5TdDNfXzI3bnVtX3B1dEl3TlNfMTlvc3RyZWFtYnVmX2l0ZXJhdG9ySXdOU18xMWNoYXJfdHJhaXRzSXdFRUVFRUUATlN0M19fMjlfX251bV9wdXRJd0VFAAAAQHkAABhnAAAAAAAAAQAAAGBmAAAAAAAAQHkAANRmAAAAAAAAAgAAALBfAAACAAAAMGcAQezOAQuaC0hoAAAUAwAAFQMAAJUCAAAWAwAAFwMAABgDAAAZAwAAGgMAABsDAAAcAwAA+P///0hoAAAdAwAAHgMAAB8DAAAgAwAAIQMAACIDAAAjAwAATlN0M19fMjh0aW1lX2dldEljTlNfMTlpc3RyZWFtYnVmX2l0ZXJhdG9ySWNOU18xMWNoYXJfdHJhaXRzSWNFRUVFRUUATlN0M19fMjl0aW1lX2Jhc2VFALx4AAABaAAATlN0M19fMjIwX190aW1lX2dldF9jX3N0b3JhZ2VJY0VFAAAAvHgAABxoAABAeQAAvGcAAAAAAAADAAAAsF8AAAIAAAAUaAAAAgAAAEBoAAAACAAAAAAAADRpAAAkAwAAJQMAAJUCAAAmAwAAJwMAACgDAAApAwAAKgMAACsDAAAsAwAA+P///zRpAAAtAwAALgMAAC8DAAAwAwAAMQMAADIDAAAzAwAATlN0M19fMjh0aW1lX2dldEl3TlNfMTlpc3RyZWFtYnVmX2l0ZXJhdG9ySXdOU18xMWNoYXJfdHJhaXRzSXdFRUVFRUUATlN0M19fMjIwX190aW1lX2dldF9jX3N0b3JhZ2VJd0VFAAC8eAAACWkAAEB5AADEaAAAAAAAAAMAAACwXwAAAgAAABRoAAACAAAALGkAAAAIAAAAAAAA2GkAADQDAAA1AwAAlQIAADYDAABOU3QzX18yOHRpbWVfcHV0SWNOU18xOW9zdHJlYW1idWZfaXRlcmF0b3JJY05TXzExY2hhcl90cmFpdHNJY0VFRUVFRQBOU3QzX18yMTBfX3RpbWVfcHV0RQAAALx4AAC5aQAAQHkAAHRpAAAAAAAAAgAAALBfAAACAAAA0GkAAAAIAAAAAAAAWGoAADcDAAA4AwAAlQIAADkDAABOU3QzX18yOHRpbWVfcHV0SXdOU18xOW9zdHJlYW1idWZfaXRlcmF0b3JJd05TXzExY2hhcl90cmFpdHNJd0VFRUVFRQAAAABAeQAAEGoAAAAAAAACAAAAsF8AAAIAAADQaQAAAAgAAAAAAADsagAAtwIAADoDAACVAgAAOwMAADwDAAA9AwAAPgMAAD8DAABAAwAAQQMAAEIDAABDAwAATlN0M19fMjEwbW9uZXlwdW5jdEljTGIwRUVFAE5TdDNfXzIxMG1vbmV5X2Jhc2VFAAAAALx4AADMagAAQHkAALBqAAAAAAAAAgAAALBfAAACAAAA5GoAAAIAAAAAAAAAYGsAALcCAABEAwAAlQIAAEUDAABGAwAARwMAAEgDAABJAwAASgMAAEsDAABMAwAATQMAAE5TdDNfXzIxMG1vbmV5cHVuY3RJY0xiMUVFRQBAeQAARGsAAAAAAAACAAAAsF8AAAIAAADkagAAAgAAAAAAAADUawAAtwIAAE4DAACVAgAATwMAAFADAABRAwAAUgMAAFMDAABUAwAAVQMAAFYDAABXAwAATlN0M19fMjEwbW9uZXlwdW5jdEl3TGIwRUVFAEB5AAC4awAAAAAAAAIAAACwXwAAAgAAAORqAAACAAAAAAAAAEhsAAC3AgAAWAMAAJUCAABZAwAAWgMAAFsDAABcAwAAXQMAAF4DAABfAwAAYAMAAGEDAABOU3QzX18yMTBtb25leXB1bmN0SXdMYjFFRUUAQHkAACxsAAAAAAAAAgAAALBfAAACAAAA5GoAAAIAAAAAAAAA7GwAALcCAABiAwAAlQIAAGMDAABkAwAATlN0M19fMjltb25leV9nZXRJY05TXzE5aXN0cmVhbWJ1Zl9pdGVyYXRvckljTlNfMTFjaGFyX3RyYWl0c0ljRUVFRUVFAE5TdDNfXzIxMV9fbW9uZXlfZ2V0SWNFRQAAvHgAAMpsAABAeQAAhGwAAAAAAAACAAAAsF8AAAIAAADkbABBkNoBC5oBkG0AALcCAABlAwAAlQIAAGYDAABnAwAATlN0M19fMjltb25leV9nZXRJd05TXzE5aXN0cmVhbWJ1Zl9pdGVyYXRvckl3TlNfMTFjaGFyX3RyYWl0c0l3RUVFRUVFAE5TdDNfXzIxMV9fbW9uZXlfZ2V0SXdFRQAAvHgAAG5tAABAeQAAKG0AAAAAAAACAAAAsF8AAAIAAACIbQBBtNsBC5oBNG4AALcCAABoAwAAlQIAAGkDAABqAwAATlN0M19fMjltb25leV9wdXRJY05TXzE5b3N0cmVhbWJ1Zl9pdGVyYXRvckljTlNfMTFjaGFyX3RyYWl0c0ljRUVFRUVFAE5TdDNfXzIxMV9fbW9uZXlfcHV0SWNFRQAAvHgAABJuAABAeQAAzG0AAAAAAAACAAAAsF8AAAIAAAAsbgBB2NwBC5oB2G4AALcCAABrAwAAlQIAAGwDAABtAwAATlN0M19fMjltb25leV9wdXRJd05TXzE5b3N0cmVhbWJ1Zl9pdGVyYXRvckl3TlNfMTFjaGFyX3RyYWl0c0l3RUVFRUVFAE5TdDNfXzIxMV9fbW9uZXlfcHV0SXdFRQAAvHgAALZuAABAeQAAcG4AAAAAAAACAAAAsF8AAAIAAADQbgBB/N0BC+ohUG8AALcCAABuAwAAlQIAAG8DAABwAwAAcQMAAE5TdDNfXzI4bWVzc2FnZXNJY0VFAE5TdDNfXzIxM21lc3NhZ2VzX2Jhc2VFAAAAALx4AAAtbwAAQHkAABhvAAAAAAAAAgAAALBfAAACAAAASG8AAAIAAAAAAAAAqG8AALcCAAByAwAAlQIAAHMDAAB0AwAAdQMAAE5TdDNfXzI4bWVzc2FnZXNJd0VFAAAAAEB5AACQbwAAAAAAAAIAAACwXwAAAgAAAEhvAAACAAAAU3VuZGF5AE1vbmRheQBUdWVzZGF5AFdlZG5lc2RheQBUaHVy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bXNjcmlwdGVuOjp2YWwAZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8Y2hhcj4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8c2lnbmVkIGNoYXI+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHVuc2lnbmVkIGNoYXI+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHNob3J0PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzx1bnNpZ25lZCBzaG9ydD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8aW50PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzx1bnNpZ25lZCBpbnQ+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PGxvbmc+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHVuc2lnbmVkIGxvbmc+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PGludDhfdD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8dWludDhfdD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8aW50MTZfdD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8dWludDE2X3Q+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PGludDMyX3Q+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHVpbnQzMl90PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxmbG9hdD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8ZG91YmxlPgBOU3QzX18yMTJiYXNpY19zdHJpbmdJaE5TXzExY2hhcl90cmFpdHNJaEVFTlNfOWFsbG9jYXRvckloRUVFRQAAAABAeQAAxnwAAAAAAAABAAAAiBgAAAAAAABOU3QzX18yMTJiYXNpY19zdHJpbmdJd05TXzExY2hhcl90cmFpdHNJd0VFTlNfOWFsbG9jYXRvckl3RUVFRQAAQHkAACB9AAAAAAAAAQAAAIgYAAAAAAAATlN0M19fMjEyYmFzaWNfc3RyaW5nSURzTlNfMTFjaGFyX3RyYWl0c0lEc0VFTlNfOWFsbG9jYXRvcklEc0VFRUUAAABAeQAAeH0AAAAAAAABAAAAiBgAAAAAAABOU3QzX18yMTJiYXNpY19zdHJpbmdJRGlOU18xMWNoYXJfdHJhaXRz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dHJ1Y3RvcgIlX2VtYmluZF9yZWdpc3Rlcl9jbGFzc19jbGFzc19mdW5jdGlvbgMfX2VtYmluZF9yZWdpc3Rlcl9jbGFzc19mdW5jdGlvbgQfX2VtYmluZF9yZWdpc3Rlcl9jbGFzc19wcm9wZXJ0eQUVX2VtYmluZF9yZWdpc3Rlcl9lbnVtBhtfZW1iaW5kX3JlZ2lzdGVyX2VudW1fdmFsdWUHGl9lbWJpbmRfcmVnaXN0ZXJfc21hcnRfcHRyCBhfX2N4YV9hbGxvY2F0ZV9leGNlcHRpb24JC19fY3hhX3Rocm93ChFfZW12YWxfdGFrZV92YWx1ZQsNX2VtdmFsX2luY3JlZgwNX2VtdmFsX2RlY3JlZg0LX2VtdmFsX2NhbGwOBXJvdW5kDwRleGl0EA1fX2Fzc2VydF9mYWlsEQZfX2xvY2sSCF9fdW5sb2NrEw9fX3dhc2lfZmRfY2xvc2UUCl9fc3lzY2FsbDUVDF9fc3lzY2FsbDIyMRYLX19zeXNjYWxsNTQXDl9fd2FzaV9mZF9yZWFkGA9fX3dhc2lfZmRfd3JpdGUZGF9fd2FzaV9lbnZpcm9uX3NpemVzX2dldBoSX193YXNpX2Vudmlyb25fZ2V0GwpfX21hcF9maWxlHAtfX3N5c2NhbGw5MR0Kc3RyZnRpbWVfbB4FYWJvcnQfFV9lbWJpbmRfcmVnaXN0ZXJfdm9pZCAVX2VtYmluZF9yZWdpc3Rlcl9ib29sIRtfZW1iaW5kX3JlZ2lzdGVyX3N0ZF9zdHJpbmciHF9lbWJpbmRfcmVnaXN0ZXJfc3RkX3dzdHJpbmcjFl9lbWJpbmRfcmVnaXN0ZXJfZW12YWwkGF9lbWJpbmRfcmVnaXN0ZXJfaW50ZWdlciUWX2VtYmluZF9yZWdpc3Rlcl9mbG9hdCYcX2VtYmluZF9yZWdpc3Rlcl9tZW1vcnlfdmlldycWZW1zY3JpcHRlbl9yZXNpemVfaGVhcCgVZW1zY3JpcHRlbl9tZW1jcHlfYmlnKQtzZXRUZW1wUmV0MCoabGVnYWxpbXBvcnQkX193YXNpX2ZkX3NlZWsrEV9fd2FzbV9jYWxsX2N0b3JzLFBFbXNjcmlwdGVuQmluZGluZ0luaXRpYWxpemVyX215X21vZHVsZTo6RW1zY3JpcHRlbkJpbmRpbmdJbml0aWFsaXplcl9teV9tb2R1bGUoKS2VAWVtc2NyaXB0ZW46OmNsYXNzXzxzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4sIGVtc2NyaXB0ZW46OmludGVybmFsOjpOb0Jhc2VDbGFzcz4gZW1zY3JpcHRlbjo6cmVnaXN0ZXJfdmVjdG9yPGludD4oY2hhciBjb25zdCopLp4BZW1zY3JpcHRlbjo6Y2xhc3NfPHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiwgZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok5vQmFzZUNsYXNzPiBlbXNjcmlwdGVuOjpyZWdpc3Rlcl92ZWN0b3I8ZG91YmxlPihjaGFyIGNvbnN0KikvmAFlbXNjcmlwdGVuOjpjbGFzc188c3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4sIGVtc2NyaXB0ZW46OmludGVybmFsOjpOb0Jhc2VDbGFzcz4gZW1zY3JpcHRlbjo6cmVnaXN0ZXJfdmVjdG9yPGNoYXI+KGNoYXIgY29uc3QqKTCzAWVtc2NyaXB0ZW46OmNsYXNzXzxzdGQ6Ol9fMjo6dmVjdG9yPHVuc2lnbmVkIGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8dW5zaWduZWQgY2hhcj4gPiwgZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok5vQmFzZUNsYXNzPiBlbXNjcmlwdGVuOjpyZWdpc3Rlcl92ZWN0b3I8dW5zaWduZWQgY2hhcj4oY2hhciBjb25zdCopMZsBZW1zY3JpcHRlbjo6Y2xhc3NfPHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4sIGVtc2NyaXB0ZW46OmludGVybmFsOjpOb0Jhc2VDbGFzcz4gZW1zY3JpcHRlbjo6cmVnaXN0ZXJfdmVjdG9yPGZsb2F0PihjaGFyIGNvbnN0KikySnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPHZlY3RvclRvb2xzPih2ZWN0b3JUb29scyopM0R2b2lkIGVtc2NyaXB0ZW46OmludGVybmFsOjpyYXdfZGVzdHJ1Y3Rvcjx2ZWN0b3JUb29scz4odmVjdG9yVG9vbHMqKTRHZW1zY3JpcHRlbjo6aW50ZXJuYWw6Okludm9rZXI8dmVjdG9yVG9vbHMqPjo6aW52b2tlKHZlY3RvclRvb2xzKiAoKikoKSk1PnZlY3RvclRvb2xzKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PHZlY3RvclRvb2xzPigpNuABZW1zY3JpcHRlbjo6aW50ZXJuYWw6Okludm9rZXI8dm9pZCwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+Jj46Omludm9rZSh2b2lkICgqKShzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mKSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+Kik3VHZlY3RvclRvb2xzOjpjbGVhclZlY3RvckRibChzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mKThMdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aVNldHRpbmdzPihtYXhpU2V0dGluZ3MqKTliZW1zY3JpcHRlbjo6aW50ZXJuYWw6Okludm9rZXI8dm9pZCwgaW50LCBpbnQsIGludD46Omludm9rZSh2b2lkICgqKShpbnQsIGludCwgaW50KSwgaW50LCBpbnQsIGludCk6Im1heGlTZXR0aW5nczo6c2V0dXAoaW50LCBpbnQsIGludCk7THZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlFbnZlbG9wZT4obWF4aUVudmVsb3BlKik8QG1heGlFbnZlbG9wZSogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpRW52ZWxvcGU+KCk9hANlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlFbnZlbG9wZTo6KikoaW50LCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mKSwgZG91YmxlLCBtYXhpRW52ZWxvcGUqLCBpbnQsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiY+OjppbnZva2UoZG91YmxlIChtYXhpRW52ZWxvcGU6OiogY29uc3QmKShpbnQsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYpLCBtYXhpRW52ZWxvcGUqLCBpbnQsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiopProBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAobWF4aUVudmVsb3BlOjoqKShpbnQsIGRvdWJsZSksIHZvaWQsIG1heGlFbnZlbG9wZSosIGludCwgZG91YmxlPjo6aW52b2tlKHZvaWQgKG1heGlFbnZlbG9wZTo6KiBjb25zdCYpKGludCwgZG91YmxlKSwgbWF4aUVudmVsb3BlKiwgaW50LCBkb3VibGUpPyJtYXhpRW52ZWxvcGU6OmdldEFtcGxpdHVkZSgpIGNvbnN0QCJtYXhpRW52ZWxvcGU6OnNldEFtcGxpdHVkZShkb3VibGUpQZwBZG91YmxlIGVtc2NyaXB0ZW46OmludGVybmFsOjpHZXR0ZXJQb2xpY3k8ZG91YmxlIChtYXhpRW52ZWxvcGU6OiopKCkgY29uc3Q+OjpnZXQ8bWF4aUVudmVsb3BlPihkb3VibGUgKG1heGlFbnZlbG9wZTo6KiBjb25zdCYpKCkgY29uc3QsIG1heGlFbnZlbG9wZSBjb25zdCYpQpgBdm9pZCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6U2V0dGVyUG9saWN5PHZvaWQgKG1heGlFbnZlbG9wZTo6KikoZG91YmxlKT46OnNldDxtYXhpRW52ZWxvcGU+KHZvaWQgKG1heGlFbnZlbG9wZTo6KiBjb25zdCYpKGRvdWJsZSksIG1heGlFbnZlbG9wZSYsIGRvdWJsZSlDIW1heGlFbnZlbG9wZTo6Z2V0VmFsaW5kZXgoKSBjb25zdEQebWF4aUVudmVsb3BlOjpzZXRWYWxpbmRleChpbnQpRZMBaW50IGVtc2NyaXB0ZW46OmludGVybmFsOjpHZXR0ZXJQb2xpY3k8aW50IChtYXhpRW52ZWxvcGU6OiopKCkgY29uc3Q+OjpnZXQ8bWF4aUVudmVsb3BlPihpbnQgKG1heGlFbnZlbG9wZTo6KiBjb25zdCYpKCkgY29uc3QsIG1heGlFbnZlbG9wZSBjb25zdCYpRo8Bdm9pZCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6U2V0dGVyUG9saWN5PHZvaWQgKG1heGlFbnZlbG9wZTo6KikoaW50KT46OnNldDxtYXhpRW52ZWxvcGU+KHZvaWQgKG1heGlFbnZlbG9wZTo6KiBjb25zdCYpKGludCksIG1heGlFbnZlbG9wZSYsIGludClHTnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlEZWxheWxpbmU+KG1heGlEZWxheWxpbmUqKUhCbWF4aURlbGF5bGluZSogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpRGVsYXlsaW5lPigpSeQBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpRGVsYXlsaW5lOjoqKShkb3VibGUsIGludCwgZG91YmxlKSwgZG91YmxlLCBtYXhpRGVsYXlsaW5lKiwgZG91YmxlLCBpbnQsIGRvdWJsZT46Omludm9rZShkb3VibGUgKG1heGlEZWxheWxpbmU6OiogY29uc3QmKShkb3VibGUsIGludCwgZG91YmxlKSwgbWF4aURlbGF5bGluZSosIGRvdWJsZSwgaW50LCBkb3VibGUpSvgBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpRGVsYXlsaW5lOjoqKShkb3VibGUsIGludCwgZG91YmxlLCBpbnQpLCBkb3VibGUsIG1heGlEZWxheWxpbmUqLCBkb3VibGUsIGludCwgZG91YmxlLCBpbnQ+OjppbnZva2UoZG91YmxlIChtYXhpRGVsYXlsaW5lOjoqIGNvbnN0JikoZG91YmxlLCBpbnQsIGRvdWJsZSwgaW50KSwgbWF4aURlbGF5bGluZSosIGRvdWJsZSwgaW50LCBkb3VibGUsIGludClLSHZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlGaWx0ZXI+KG1heGlGaWx0ZXIqKUw8bWF4aUZpbHRlciogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpRmlsdGVyPigpTeQBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpRmlsdGVyOjoqKShkb3VibGUsIGRvdWJsZSwgZG91YmxlKSwgZG91YmxlLCBtYXhpRmlsdGVyKiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZT46Omludm9rZShkb3VibGUgKG1heGlGaWx0ZXI6OiogY29uc3QmKShkb3VibGUsIGRvdWJsZSwgZG91YmxlKSwgbWF4aUZpbHRlciosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUpTsQBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpRmlsdGVyOjoqKShkb3VibGUsIGRvdWJsZSksIGRvdWJsZSwgbWF4aUZpbHRlciosIGRvdWJsZSwgZG91YmxlPjo6aW52b2tlKGRvdWJsZSAobWF4aUZpbHRlcjo6KiBjb25zdCYpKGRvdWJsZSwgZG91YmxlKSwgbWF4aUZpbHRlciosIGRvdWJsZSwgZG91YmxlKU8dbWF4aUZpbHRlcjo6Z2V0Q3V0b2ZmKCkgY29uc3RQHW1heGlGaWx0ZXI6OnNldEN1dG9mZihkb3VibGUpUSBtYXhpRmlsdGVyOjpnZXRSZXNvbmFuY2UoKSBjb25zdFIgbWF4aUZpbHRlcjo6c2V0UmVzb25hbmNlKGRvdWJsZSlTQnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlNaXg+KG1heGlNaXgqKVQ2bWF4aU1peCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpTWl4PigpVZYDZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAobWF4aU1peDo6KikoZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBkb3VibGUpLCB2b2lkLCBtYXhpTWl4KiwgZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBkb3VibGU+OjppbnZva2Uodm9pZCAobWF4aU1peDo6KiBjb25zdCYpKGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgZG91YmxlKSwgbWF4aU1peCosIGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KiwgZG91YmxlKVa2A2Vtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKG1heGlNaXg6OiopKGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgZG91YmxlLCBkb3VibGUpLCB2b2lkLCBtYXhpTWl4KiwgZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBkb3VibGUsIGRvdWJsZT46Omludm9rZSh2b2lkIChtYXhpTWl4OjoqIGNvbnN0JikoZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBkb3VibGUsIGRvdWJsZSksIG1heGlNaXgqLCBkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiosIGRvdWJsZSwgZG91YmxlKVfWA2Vtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKG1heGlNaXg6OiopKGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSksIHZvaWQsIG1heGlNaXgqLCBkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGRvdWJsZSwgZG91YmxlLCBkb3VibGU+OjppbnZva2Uodm9pZCAobWF4aU1peDo6KiBjb25zdCYpKGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSksIG1heGlNaXgqLCBkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUpWER2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpTGluZT4obWF4aUxpbmUqKVk4bWF4aUxpbmUqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aUxpbmU+KClaFm1heGlMaW5lOjpwbGF5KGRvdWJsZSlbnAFlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlMaW5lOjoqKShkb3VibGUpLCBkb3VibGUsIG1heGlMaW5lKiwgZG91YmxlPjo6aW52b2tlKGRvdWJsZSAobWF4aUxpbmU6OiogY29uc3QmKShkb3VibGUpLCBtYXhpTGluZSosIGRvdWJsZSlcL21heGlMaW5lOjpwcmVwYXJlKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGJvb2wpXe4BZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAobWF4aUxpbmU6OiopKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGJvb2wpLCB2b2lkLCBtYXhpTGluZSosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGJvb2w+OjppbnZva2Uodm9pZCAobWF4aUxpbmU6OiogY29uc3QmKShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBib29sKSwgbWF4aUxpbmUqLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBib29sKV4fbWF4aUxpbmU6OnRyaWdnZXJFbmFibGUoZG91YmxlKV8abWF4aUxpbmU6OmlzTGluZUNvbXBsZXRlKClgRnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlYRmFkZT4obWF4aVhGYWRlKilhhwRlbXNjcmlwdGVuOjppbnRlcm5hbDo6SW52b2tlcjxzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4sIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGRvdWJsZT46Omludm9rZShzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4gKCopKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGRvdWJsZSksIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiosIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiosIGRvdWJsZSliigFtYXhpWEZhZGU6OnhmYWRlKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGRvdWJsZSljgQFlbXNjcmlwdGVuOjppbnRlcm5hbDo6SW52b2tlcjxkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGU+OjppbnZva2UoZG91YmxlICgqKShkb3VibGUsIGRvdWJsZSwgZG91YmxlKSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSlkKG1heGlYRmFkZTo6eGZhZGUoZG91YmxlLCBkb3VibGUsIGRvdWJsZSllWXZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlMYWdFeHA8ZG91YmxlPiA+KG1heGlMYWdFeHA8ZG91YmxlPiopZk1tYXhpTGFnRXhwPGRvdWJsZT4qIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aUxhZ0V4cDxkb3VibGU+ID4oKWcobWF4aUxhZ0V4cDxkb3VibGU+Ojppbml0KGRvdWJsZSwgZG91YmxlKWjeAWVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKG1heGlMYWdFeHA8ZG91YmxlPjo6KikoZG91YmxlLCBkb3VibGUpLCB2b2lkLCBtYXhpTGFnRXhwPGRvdWJsZT4qLCBkb3VibGUsIGRvdWJsZT46Omludm9rZSh2b2lkIChtYXhpTGFnRXhwPGRvdWJsZT46OiogY29uc3QmKShkb3VibGUsIGRvdWJsZSksIG1heGlMYWdFeHA8ZG91YmxlPiosIGRvdWJsZSwgZG91YmxlKWklbWF4aUxhZ0V4cDxkb3VibGU+OjphZGRTYW1wbGUoZG91YmxlKWohbWF4aUxhZ0V4cDxkb3VibGU+Ojp2YWx1ZSgpIGNvbnN0ayRtYXhpTGFnRXhwPGRvdWJsZT46OmdldEFscGhhKCkgY29uc3RsJG1heGlMYWdFeHA8ZG91YmxlPjo6c2V0QWxwaGEoZG91YmxlKW0ubWF4aUxhZ0V4cDxkb3VibGU+OjpnZXRBbHBoYVJlY2lwcm9jYWwoKSBjb25zdG4ubWF4aUxhZ0V4cDxkb3VibGU+OjpzZXRBbHBoYVJlY2lwcm9jYWwoZG91YmxlKW8ibWF4aUxhZ0V4cDxkb3VibGU+OjpzZXRWYWwoZG91YmxlKXBIdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aVNhbXBsZT4obWF4aVNhbXBsZSopcUJ2b2lkIGVtc2NyaXB0ZW46OmludGVybmFsOjpyYXdfZGVzdHJ1Y3RvcjxtYXhpU2FtcGxlPihtYXhpU2FtcGxlKilyPG1heGlTYW1wbGUqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aVNhbXBsZT4oKXMdbWF4aVNhbXBsZTo6Z2V0TGVuZ3RoKCkgY29uc3R09gJlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChtYXhpU2FtcGxlOjoqKShzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBpbnQpLCB2b2lkLCBtYXhpU2FtcGxlKiwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgaW50Pjo6aW52b2tlKHZvaWQgKG1heGlTYW1wbGU6OiogY29uc3QmKShzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBpbnQpLCBtYXhpU2FtcGxlKiwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KiwgaW50KXWrA2Vtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGludCAobWF4aVNhbXBsZTo6Kikoc3RkOjpfXzI6OnZlY3Rvcjx1bnNpZ25lZCBjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHVuc2lnbmVkIGNoYXI+ID4mLCBpbnQpLCBpbnQsIG1heGlTYW1wbGUqLCBzdGQ6Ol9fMjo6dmVjdG9yPHVuc2lnbmVkIGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8dW5zaWduZWQgY2hhcj4gPiYsIGludD46Omludm9rZShpbnQgKG1heGlTYW1wbGU6OiogY29uc3QmKShzdGQ6Ol9fMjo6dmVjdG9yPHVuc2lnbmVkIGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8dW5zaWduZWQgY2hhcj4gPiYsIGludCksIG1heGlTYW1wbGUqLCBzdGQ6Ol9fMjo6dmVjdG9yPHVuc2lnbmVkIGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8dW5zaWduZWQgY2hhcj4gPiosIGludCl2ggFlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChtYXhpU2FtcGxlOjoqKSgpLCB2b2lkLCBtYXhpU2FtcGxlKj46Omludm9rZSh2b2lkIChtYXhpU2FtcGxlOjoqIGNvbnN0JikoKSwgbWF4aVNhbXBsZSopdxNtYXhpU2FtcGxlOjpjbGVhcigpeOYBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAobWF4aVNhbXBsZTo6KikoZmxvYXQsIGZsb2F0LCBib29sLCBib29sKSwgdm9pZCwgbWF4aVNhbXBsZSosIGZsb2F0LCBmbG9hdCwgYm9vbCwgYm9vbD46Omludm9rZSh2b2lkIChtYXhpU2FtcGxlOjoqIGNvbnN0JikoZmxvYXQsIGZsb2F0LCBib29sLCBib29sKSwgbWF4aVNhbXBsZSosIGZsb2F0LCBmbG9hdCwgYm9vbCwgYm9vbCl5owRlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxib29sIChtYXhpU2FtcGxlOjoqKShzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+LCBpbnQpLCBib29sLCBtYXhpU2FtcGxlKiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiwgaW50Pjo6aW52b2tlKGJvb2wgKG1heGlTYW1wbGU6OiogY29uc3QmKShzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+LCBpbnQpLCBtYXhpU2FtcGxlKiwgZW1zY3JpcHRlbjo6aW50ZXJuYWw6OkJpbmRpbmdUeXBlPHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4sIHZvaWQ+OjondW5uYW1lZCcqLCBpbnQpekJ2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpRHluPihtYXhpRHluKil7Nm1heGlEeW4qIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aUR5bj4oKXyQAmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aUR5bjo6KikoZG91YmxlLCBkb3VibGUsIGxvbmcsIGRvdWJsZSwgZG91YmxlKSwgZG91YmxlLCBtYXhpRHluKiwgZG91YmxlLCBkb3VibGUsIGxvbmcsIGRvdWJsZSwgZG91YmxlPjo6aW52b2tlKGRvdWJsZSAobWF4aUR5bjo6KiBjb25zdCYpKGRvdWJsZSwgZG91YmxlLCBsb25nLCBkb3VibGUsIGRvdWJsZSksIG1heGlEeW4qLCBkb3VibGUsIGRvdWJsZSwgbG9uZywgZG91YmxlLCBkb3VibGUpfZgCZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpRHluOjoqKShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSksIGRvdWJsZSwgbWF4aUR5biosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlPjo6aW52b2tlKGRvdWJsZSAobWF4aUR5bjo6KiBjb25zdCYpKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKSwgbWF4aUR5biosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKX5Cdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aUVudj4obWF4aUVudiopfzZtYXhpRW52KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlFbnY+KCmAAYQCZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpRW52OjoqKShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBsb25nLCBpbnQpLCBkb3VibGUsIG1heGlFbnYqLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBsb25nLCBpbnQ+OjppbnZva2UoZG91YmxlIChtYXhpRW52OjoqIGNvbnN0JikoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgbG9uZywgaW50KSwgbWF4aUVudiosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGxvbmcsIGludCmBAcQCZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpRW52OjoqKShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgbG9uZywgaW50KSwgZG91YmxlLCBtYXhpRW52KiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGxvbmcsIGludD46Omludm9rZShkb3VibGUgKG1heGlFbnY6OiogY29uc3QmKShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgbG9uZywgaW50KSwgbWF4aUVudiosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBsb25nLCBpbnQpggGsAWVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aUVudjo6KikoZG91YmxlLCBpbnQpLCBkb3VibGUsIG1heGlFbnYqLCBkb3VibGUsIGludD46Omludm9rZShkb3VibGUgKG1heGlFbnY6OiogY29uc3QmKShkb3VibGUsIGludCksIG1heGlFbnYqLCBkb3VibGUsIGludCmDARttYXhpRW52OjpnZXRUcmlnZ2VyKCkgY29uc3SEARhtYXhpRW52OjpzZXRUcmlnZ2VyKGludCmFAUJ2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxjb252ZXJ0Pihjb252ZXJ0KimGAWJlbXNjcmlwdGVuOjppbnRlcm5hbDo6RnVuY3Rpb25JbnZva2VyPGRvdWJsZSAoKikoaW50KSwgZG91YmxlLCBpbnQ+OjppbnZva2UoZG91YmxlICgqKikoaW50KSwgaW50KYcBSGVtc2NyaXB0ZW46OmludGVybmFsOjpJbnZva2VyPGRvdWJsZSwgaW50Pjo6aW52b2tlKGRvdWJsZSAoKikoaW50KSwgaW50KYgBGmNvbnZlcnQ6Om1zVG9TYW1wcyhkb3VibGUpiQFuZW1zY3JpcHRlbjo6aW50ZXJuYWw6OkZ1bmN0aW9uSW52b2tlcjxkb3VibGUgKCopKGRvdWJsZSksIGRvdWJsZSwgZG91YmxlPjo6aW52b2tlKGRvdWJsZSAoKiopKGRvdWJsZSksIGRvdWJsZSmKAVFlbXNjcmlwdGVuOjppbnRlcm5hbDo6SW52b2tlcjxkb3VibGUsIGRvdWJsZT46Omludm9rZShkb3VibGUgKCopKGRvdWJsZSksIGRvdWJsZSmLAVZ2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpU2FtcGxlQW5kSG9sZD4obWF4aVNhbXBsZUFuZEhvbGQqKYwBSm1heGlTYW1wbGVBbmRIb2xkKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlTYW1wbGVBbmRIb2xkPigpjQEmbWF4aVNhbXBsZUFuZEhvbGQ6OnNhaChkb3VibGUsIGRvdWJsZSmOAUp2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpRmxhbmdlcj4obWF4aUZsYW5nZXIqKY8BPm1heGlGbGFuZ2VyKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlGbGFuZ2VyPigpkAFBbWF4aUZsYW5nZXI6OmZsYW5nZShkb3VibGUsIHVuc2lnbmVkIGludCwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSmRAcACZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpRmxhbmdlcjo6KikoZG91YmxlLCB1bnNpZ25lZCBpbnQsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUpLCBkb3VibGUsIG1heGlGbGFuZ2VyKiwgZG91YmxlLCB1bnNpZ25lZCBpbnQsIGRvdWJsZSwgZG91YmxlLCBkb3VibGU+OjppbnZva2UoZG91YmxlIChtYXhpRmxhbmdlcjo6KiBjb25zdCYpKGRvdWJsZSwgdW5zaWduZWQgaW50LCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKSwgbWF4aUZsYW5nZXIqLCBkb3VibGUsIHVuc2lnbmVkIGludCwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSmSAUh2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpQ2hvcnVzPihtYXhpQ2hvcnVzKimTATxtYXhpQ2hvcnVzKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlDaG9ydXM+KCmUAUBtYXhpQ2hvcnVzOjpjaG9ydXMoZG91YmxlLCB1bnNpZ25lZCBpbnQsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUplQFOdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aURDQmxvY2tlcj4obWF4aURDQmxvY2tlcioplgFCbWF4aURDQmxvY2tlciogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpRENCbG9ja2VyPigplwEjbWF4aURDQmxvY2tlcjo6cGxheShkb3VibGUsIGRvdWJsZSmYAUJ2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpU1ZGPihtYXhpU1ZGKimZATZtYXhpU1ZGKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlTVkY+KCmaARptYXhpU1ZGOjpzZXRDdXRvZmYoZG91YmxlKZsBHW1heGlTVkY6OnNldFJlc29uYW5jZShkb3VibGUpnAE1bWF4aVNWRjo6cGxheShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSmdAUR2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpTWF0aD4obWF4aU1hdGgqKZ4BaWVtc2NyaXB0ZW46OmludGVybmFsOjpJbnZva2VyPGRvdWJsZSwgZG91YmxlLCBkb3VibGU+OjppbnZva2UoZG91YmxlICgqKShkb3VibGUsIGRvdWJsZSksIGRvdWJsZSwgZG91YmxlKZ8BHW1heGlNYXRoOjphZGQoZG91YmxlLCBkb3VibGUpoAEdbWF4aU1hdGg6OnN1Yihkb3VibGUsIGRvdWJsZSmhAR1tYXhpTWF0aDo6bXVsKGRvdWJsZSwgZG91YmxlKaIBHW1heGlNYXRoOjpkaXYoZG91YmxlLCBkb3VibGUpowEcbWF4aU1hdGg6Omd0KGRvdWJsZSwgZG91YmxlKaQBHG1heGlNYXRoOjpsdChkb3VibGUsIGRvdWJsZSmlAR1tYXhpTWF0aDo6Z3RlKGRvdWJsZSwgZG91YmxlKaYBHW1heGlNYXRoOjpsdGUoZG91YmxlLCBkb3VibGUppwEdbWF4aU1hdGg6Om1vZChkb3VibGUsIGRvdWJsZSmoARVtYXhpTWF0aDo6YWJzKGRvdWJsZSmpAR9tYXhpTWF0aDo6eHBvd3koZG91YmxlLCBkb3VibGUpqgFGdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aUNsb2NrPihtYXhpQ2xvY2sqKasBOm1heGlDbG9jayogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpQ2xvY2s+KCmsARltYXhpQ2xvY2s6OmlzVGljaygpIGNvbnN0rQEibWF4aUNsb2NrOjpnZXRDdXJyZW50Q291bnQoKSBjb25zdK4BH21heGlDbG9jazo6c2V0Q3VycmVudENvdW50KGludCmvAR9tYXhpQ2xvY2s6OmdldExhc3RDb3VudCgpIGNvbnN0sAEcbWF4aUNsb2NrOjpzZXRMYXN0Q291bnQoaW50KbEBGW1heGlDbG9jazo6Z2V0QnBzKCkgY29uc3SyARZtYXhpQ2xvY2s6OnNldEJwcyhpbnQpswEZbWF4aUNsb2NrOjpnZXRCcG0oKSBjb25zdLQBFm1heGlDbG9jazo6c2V0QnBtKGludCm1ARdtYXhpQ2xvY2s6OnNldFRpY2soaW50KbYBG21heGlDbG9jazo6Z2V0VGlja3MoKSBjb25zdLcBGG1heGlDbG9jazo6c2V0VGlja3MoaW50KbgBYHZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlLdXJhbW90b09zY2lsbGF0b3I+KG1heGlLdXJhbW90b09zY2lsbGF0b3IqKbkBVG1heGlLdXJhbW90b09zY2lsbGF0b3IqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aUt1cmFtb3RvT3NjaWxsYXRvcj4oKboBZG1heGlLdXJhbW90b09zY2lsbGF0b3I6OnBsYXkoZG91YmxlLCBkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPim7AdYDZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yOjoqKShkb3VibGUsIGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KSwgZG91YmxlLCBtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yKiwgZG91YmxlLCBkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiA+OjppbnZva2UoZG91YmxlIChtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yOjoqIGNvbnN0JikoZG91YmxlLCBkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiksIG1heGlLdXJhbW90b09zY2lsbGF0b3IqLCBkb3VibGUsIGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+Kim8AWZ2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0PihtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0Kim9AWB2b2lkIGVtc2NyaXB0ZW46OmludGVybmFsOjpyYXdfZGVzdHJ1Y3RvcjxtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0PihtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0Kim+AZ4BZW1zY3JpcHRlbjo6aW50ZXJuYWw6Okludm9rZXI8bWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldCosIHVuc2lnbmVkIGxvbmcgY29uc3QmJj46Omludm9rZShtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0KiAoKikodW5zaWduZWQgbG9uZyBjb25zdCYmKSwgdW5zaWduZWQgbG9uZym/AYQBbWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0LCB1bnNpZ25lZCBsb25nIGNvbnN0Pih1bnNpZ25lZCBsb25nIGNvbnN0JiYpwAEvbWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldDo6cGxheShkb3VibGUsIGRvdWJsZSnBATptYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0OjpzZXRQaGFzZShkb3VibGUsIHVuc2lnbmVkIGxvbmcpwgGWAmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQ6OiopKGRvdWJsZSwgdW5zaWduZWQgbG9uZyksIHZvaWQsIG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQqLCBkb3VibGUsIHVuc2lnbmVkIGxvbmc+OjppbnZva2Uodm9pZCAobWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldDo6KiBjb25zdCYpKGRvdWJsZSwgdW5zaWduZWQgbG9uZyksIG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQqLCBkb3VibGUsIHVuc2lnbmVkIGxvbmcpwwFjbWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldDo6c2V0UGhhc2VzKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiBjb25zdCYpxAEybWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldDo6Z2V0UGhhc2UodW5zaWduZWQgbG9uZynFAfwBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0OjoqKSh1bnNpZ25lZCBsb25nKSwgZG91YmxlLCBtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0KiwgdW5zaWduZWQgbG9uZz46Omludm9rZShkb3VibGUgKG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQ6OiogY29uc3QmKSh1bnNpZ25lZCBsb25nKSwgbWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldCosIHVuc2lnbmVkIGxvbmcpxgEhbWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldDo6c2l6ZSgpxwFqdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aUFzeW5jS3VyYW1vdG9Pc2NpbGxhdG9yPihtYXhpQXN5bmNLdXJhbW90b09zY2lsbGF0b3IqKcgBrAFtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0KiBlbXNjcmlwdGVuOjpiYXNlPG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQ+Ojpjb252ZXJ0UG9pbnRlcjxtYXhpQXN5bmNLdXJhbW90b09zY2lsbGF0b3IsIG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQ+KG1heGlBc3luY0t1cmFtb3RvT3NjaWxsYXRvciopyQGIAW1heGlBc3luY0t1cmFtb3RvT3NjaWxsYXRvciogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpQXN5bmNLdXJhbW90b09zY2lsbGF0b3IsIHVuc2lnbmVkIGxvbmcgY29uc3Q+KHVuc2lnbmVkIGxvbmcgY29uc3QmJinKATFtYXhpQXN5bmNLdXJhbW90b09zY2lsbGF0b3I6OnBsYXkoZG91YmxlLCBkb3VibGUpywE8bWF4aUFzeW5jS3VyYW1vdG9Pc2NpbGxhdG9yOjpzZXRQaGFzZShkb3VibGUsIHVuc2lnbmVkIGxvbmcpzAFlbWF4aUFzeW5jS3VyYW1vdG9Pc2NpbGxhdG9yOjpzZXRQaGFzZXMoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+IGNvbnN0JinNAUJ2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpRkZUPihtYXhpRkZUKinOATx2b2lkIGVtc2NyaXB0ZW46OmludGVybmFsOjpyYXdfZGVzdHJ1Y3RvcjxtYXhpRkZUPihtYXhpRkZUKinPATZtYXhpRkZUKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlGRlQ+KCnQAa4BZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAobWF4aUZGVDo6KikoaW50LCBpbnQsIGludCksIHZvaWQsIG1heGlGRlQqLCBpbnQsIGludCwgaW50Pjo6aW52b2tlKHZvaWQgKG1heGlGRlQ6OiogY29uc3QmKShpbnQsIGludCwgaW50KSwgbWF4aUZGVCosIGludCwgaW50LCBpbnQp0QHaAWVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGJvb2wgKG1heGlGRlQ6OiopKGZsb2F0LCBtYXhpRkZUOjpmZnRNb2RlcyksIGJvb2wsIG1heGlGRlQqLCBmbG9hdCwgbWF4aUZGVDo6ZmZ0TW9kZXM+OjppbnZva2UoYm9vbCAobWF4aUZGVDo6KiBjb25zdCYpKGZsb2F0LCBtYXhpRkZUOjpmZnRNb2RlcyksIG1heGlGRlQqLCBmbG9hdCwgbWF4aUZGVDo6ZmZ0TW9kZXMp0gF5ZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZmxvYXQgKG1heGlGRlQ6OiopKCksIGZsb2F0LCBtYXhpRkZUKj46Omludm9rZShmbG9hdCAobWF4aUZGVDo6KiBjb25zdCYpKCksIG1heGlGRlQqKdMBiQJlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+JiAobWF4aUZGVDo6KikoKSwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiYsIG1heGlGRlQqPjo6aW52b2tlKHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mIChtYXhpRkZUOjoqIGNvbnN0JikoKSwgbWF4aUZGVCop1AEabWF4aUZGVDo6Z2V0TWFnbml0dWRlc0RCKCnVARRtYXhpRkZUOjpnZXRQaGFzZXMoKdYBFW1heGlGRlQ6OmdldE51bUJpbnMoKdcBFW1heGlGRlQ6OmdldEZGVFNpemUoKdgBFW1heGlGRlQ6OmdldEhvcFNpemUoKdkBGG1heGlGRlQ6OmdldFdpbmRvd1NpemUoKdoBRHZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlJRkZUPihtYXhpSUZGVCop2wE+dm9pZCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6cmF3X2Rlc3RydWN0b3I8bWF4aUlGRlQ+KG1heGlJRkZUKincAThtYXhpSUZGVCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpSUZGVD4oKd0BgQVlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxmbG9hdCAobWF4aUlGRlQ6OiopKHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mLCBzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+JiwgbWF4aUlGRlQ6OmZmdE1vZGVzKSwgZmxvYXQsIG1heGlJRkZUKiwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiYsIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mLCBtYXhpSUZGVDo6ZmZ0TW9kZXM+OjppbnZva2UoZmxvYXQgKG1heGlJRkZUOjoqIGNvbnN0Jikoc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiYsIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mLCBtYXhpSUZGVDo6ZmZ0TW9kZXMpLCBtYXhpSUZGVCosIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4qLCBzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+KiwgbWF4aUlGRlQ6OmZmdE1vZGVzKd4BZXZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPiA+KG1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPiop3wFfdm9pZCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6cmF3X2Rlc3RydWN0b3I8bWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+ID4obWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+KingAVltYXhpTUZDQ0FuYWx5c2VyPGRvdWJsZT4qIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+ID4oKeEBWW1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPjo6c2V0dXAodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgZG91YmxlLCBkb3VibGUp4gGeA2Vtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKG1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPjo6KikodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgZG91YmxlLCBkb3VibGUpLCB2b2lkLCBtYXhpTUZDQ0FuYWx5c2VyPGRvdWJsZT4qLCB1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50LCBkb3VibGUsIGRvdWJsZT46Omludm9rZSh2b2lkIChtYXhpTUZDQ0FuYWx5c2VyPGRvdWJsZT46OiogY29uc3QmKSh1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50LCBkb3VibGUsIGRvdWJsZSksIG1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPiosIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQsIGRvdWJsZSwgZG91YmxlKeMBVW1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPjo6bWZjYyhzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+JinkAasEZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8c3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiAobWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+OjoqKShzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+JiksIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIG1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPiosIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mPjo6aW52b2tlKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYgKG1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPjo6KiBjb25zdCYpKHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mKSwgbWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+Kiwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiop5QGVAXZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiA+KHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiop5gGPAXZvaWQgZW1zY3JpcHRlbjo6aW50ZXJuYWw6OnJhd19kZXN0cnVjdG9yPHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiA+KHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiop5wGJAXN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4gPigp6AFHc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+OjpwdXNoX2JhY2soaW50IGNvbnN0JinpAb8CZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAoc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+OjoqKShpbnQgY29uc3QmKSwgdm9pZCwgc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+KiwgaW50IGNvbnN0Jj46Omludm9rZSh2b2lkIChzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID46OiogY29uc3QmKShpbnQgY29uc3QmKSwgc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+KiwgaW50KeoBU3N0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPjo6cmVzaXplKHVuc2lnbmVkIGxvbmcsIGludCBjb25zdCYp6wH7AmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPjo6KikodW5zaWduZWQgbG9uZywgaW50IGNvbnN0JiksIHZvaWQsIHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiosIHVuc2lnbmVkIGxvbmcsIGludCBjb25zdCY+OjppbnZva2Uodm9pZCAoc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+OjoqIGNvbnN0JikodW5zaWduZWQgbG9uZywgaW50IGNvbnN0JiksIHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiosIHVuc2lnbmVkIGxvbmcsIGludCnsAT5zdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID46OnNpemUoKSBjb25zdO0BogFlbXNjcmlwdGVuOjppbnRlcm5hbDo6VmVjdG9yQWNjZXNzPHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiA+OjpnZXQoc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+IGNvbnN0JiwgdW5zaWduZWQgbG9uZynuAYMDZW1zY3JpcHRlbjo6aW50ZXJuYWw6OkZ1bmN0aW9uSW52b2tlcjxlbXNjcmlwdGVuOjp2YWwgKCopKHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiBjb25zdCYsIHVuc2lnbmVkIGxvbmcpLCBlbXNjcmlwdGVuOjp2YWwsIHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiBjb25zdCYsIHVuc2lnbmVkIGxvbmc+OjppbnZva2UoZW1zY3JpcHRlbjo6dmFsICgqKikoc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+IGNvbnN0JiwgdW5zaWduZWQgbG9uZyksIHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiosIHVuc2lnbmVkIGxvbmcp7wGoAWVtc2NyaXB0ZW46OmludGVybmFsOjpWZWN0b3JBY2Nlc3M8c3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+ID46OnNldChzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4mLCB1bnNpZ25lZCBsb25nLCBpbnQgY29uc3QmKfAB+QJlbXNjcmlwdGVuOjppbnRlcm5hbDo6RnVuY3Rpb25JbnZva2VyPGJvb2wgKCopKHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiYsIHVuc2lnbmVkIGxvbmcsIGludCBjb25zdCYpLCBib29sLCBzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4mLCB1bnNpZ25lZCBsb25nLCBpbnQgY29uc3QmPjo6aW52b2tlKGJvb2wgKCoqKShzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4mLCB1bnNpZ25lZCBsb25nLCBpbnQgY29uc3QmKSwgc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+KiwgdW5zaWduZWQgbG9uZywgaW50KfEBoQF2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4gPihzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4qKfIBUHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPjo6cHVzaF9iYWNrKGRvdWJsZSBjb25zdCYp8wHjAmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPjo6KikoZG91YmxlIGNvbnN0JiksIHZvaWQsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiosIGRvdWJsZSBjb25zdCY+OjppbnZva2Uodm9pZCAoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+OjoqIGNvbnN0JikoZG91YmxlIGNvbnN0JiksIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiosIGRvdWJsZSn0AVxzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID46OnJlc2l6ZSh1bnNpZ25lZCBsb25nLCBkb3VibGUgY29uc3QmKfUBnwNlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID46OiopKHVuc2lnbmVkIGxvbmcsIGRvdWJsZSBjb25zdCYpLCB2b2lkLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4qLCB1bnNpZ25lZCBsb25nLCBkb3VibGUgY29uc3QmPjo6aW52b2tlKHZvaWQgKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPjo6KiBjb25zdCYpKHVuc2lnbmVkIGxvbmcsIGRvdWJsZSBjb25zdCYpLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4qLCB1bnNpZ25lZCBsb25nLCBkb3VibGUp9gFEc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+OjpzaXplKCkgY29uc3T3Aa4BZW1zY3JpcHRlbjo6aW50ZXJuYWw6OlZlY3RvckFjY2VzczxzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4gPjo6Z2V0KHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiBjb25zdCYsIHVuc2lnbmVkIGxvbmcp+AG3AWVtc2NyaXB0ZW46OmludGVybmFsOjpWZWN0b3JBY2Nlc3M8c3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+ID46OnNldChzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCB1bnNpZ25lZCBsb25nLCBkb3VibGUgY29uc3QmKfkBnQNlbXNjcmlwdGVuOjppbnRlcm5hbDo6RnVuY3Rpb25JbnZva2VyPGJvb2wgKCopKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIHVuc2lnbmVkIGxvbmcsIGRvdWJsZSBjb25zdCYpLCBib29sLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCB1bnNpZ25lZCBsb25nLCBkb3VibGUgY29uc3QmPjo6aW52b2tlKGJvb2wgKCoqKShzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCB1bnNpZ25lZCBsb25nLCBkb3VibGUgY29uc3QmKSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KiwgdW5zaWduZWQgbG9uZywgZG91YmxlKfoBmQF2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiA+KHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+Kin7AUpzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6cHVzaF9iYWNrKGNoYXIgY29uc3QmKfwBywJlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6KikoY2hhciBjb25zdCYpLCB2b2lkLCBzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiosIGNoYXIgY29uc3QmPjo6aW52b2tlKHZvaWQgKHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjoqIGNvbnN0JikoY2hhciBjb25zdCYpLCBzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiosIGNoYXIp/QFWc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OnJlc2l6ZSh1bnNpZ25lZCBsb25nLCBjaGFyIGNvbnN0Jin+AYcDZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAoc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OiopKHVuc2lnbmVkIGxvbmcsIGNoYXIgY29uc3QmKSwgdm9pZCwgc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4qLCB1bnNpZ25lZCBsb25nLCBjaGFyIGNvbnN0Jj46Omludm9rZSh2b2lkIChzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6KiBjb25zdCYpKHVuc2lnbmVkIGxvbmcsIGNoYXIgY29uc3QmKSwgc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4qLCB1bnNpZ25lZCBsb25nLCBjaGFyKf8BQHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpzaXplKCkgY29uc3SAAqYBZW1zY3JpcHRlbjo6aW50ZXJuYWw6OlZlY3RvckFjY2VzczxzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiA+OjpnZXQoc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QmLCB1bnNpZ25lZCBsb25nKYECrQFlbXNjcmlwdGVuOjppbnRlcm5hbDo6VmVjdG9yQWNjZXNzPHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+ID46OnNldChzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiYsIHVuc2lnbmVkIGxvbmcsIGNoYXIgY29uc3QmKYIChQNlbXNjcmlwdGVuOjppbnRlcm5hbDo6RnVuY3Rpb25JbnZva2VyPGJvb2wgKCopKHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+JiwgdW5zaWduZWQgbG9uZywgY2hhciBjb25zdCYpLCBib29sLCBzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiYsIHVuc2lnbmVkIGxvbmcsIGNoYXIgY29uc3QmPjo6aW52b2tlKGJvb2wgKCoqKShzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiYsIHVuc2lnbmVkIGxvbmcsIGNoYXIgY29uc3QmKSwgc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4qLCB1bnNpZ25lZCBsb25nLCBjaGFyKYMCvQF2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxzdGQ6Ol9fMjo6dmVjdG9yPHVuc2lnbmVkIGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8dW5zaWduZWQgY2hhcj4gPiA+KHN0ZDo6X18yOjp2ZWN0b3I8dW5zaWduZWQgY2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjx1bnNpZ25lZCBjaGFyPiA+KimEAsoBZW1zY3JpcHRlbjo6aW50ZXJuYWw6OlZlY3RvckFjY2VzczxzdGQ6Ol9fMjo6dmVjdG9yPHVuc2lnbmVkIGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8dW5zaWduZWQgY2hhcj4gPiA+OjpnZXQoc3RkOjpfXzI6OnZlY3Rvcjx1bnNpZ25lZCBjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHVuc2lnbmVkIGNoYXI+ID4gY29uc3QmLCB1bnNpZ25lZCBsb25nKYUCnQF2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+ID4oc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiophgLXAmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID46OiopKGZsb2F0IGNvbnN0JiksIHZvaWQsIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4qLCBmbG9hdCBjb25zdCY+OjppbnZva2Uodm9pZCAoc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPjo6KiBjb25zdCYpKGZsb2F0IGNvbnN0JiksIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4qLCBmbG9hdCmHApMDZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAoc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPjo6KikodW5zaWduZWQgbG9uZywgZmxvYXQgY29uc3QmKSwgdm9pZCwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiosIHVuc2lnbmVkIGxvbmcsIGZsb2F0IGNvbnN0Jj46Omludm9rZSh2b2lkIChzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+OjoqIGNvbnN0JikodW5zaWduZWQgbG9uZywgZmxvYXQgY29uc3QmKSwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiosIHVuc2lnbmVkIGxvbmcsIGZsb2F0KYgCqgFlbXNjcmlwdGVuOjppbnRlcm5hbDo6VmVjdG9yQWNjZXNzPHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4gPjo6Z2V0KHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4gY29uc3QmLCB1bnNpZ25lZCBsb25nKYkCkQNlbXNjcmlwdGVuOjppbnRlcm5hbDo6RnVuY3Rpb25JbnZva2VyPGJvb2wgKCopKHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mLCB1bnNpZ25lZCBsb25nLCBmbG9hdCBjb25zdCYpLCBib29sLCBzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+JiwgdW5zaWduZWQgbG9uZywgZmxvYXQgY29uc3QmPjo6aW52b2tlKGJvb2wgKCoqKShzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+JiwgdW5zaWduZWQgbG9uZywgZmxvYXQgY29uc3QmKSwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiosIHVuc2lnbmVkIGxvbmcsIGZsb2F0KYoCXnN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPjo6X19hcHBlbmQodW5zaWduZWQgbG9uZywgZG91YmxlIGNvbnN0JimLAjhtYXhpTUZDQ0FuYWx5c2VyPGRvdWJsZT46OmNhbGNNZWxGaWx0ZXJCYW5rKGRvdWJsZSwgaW50KYwCZkVtc2NyaXB0ZW5CaW5kaW5nSW5pdGlhbGl6ZXJfbXlfbW9kdWxlX21heGlHcmFpbnM6OkVtc2NyaXB0ZW5CaW5kaW5nSW5pdGlhbGl6ZXJfbXlfbW9kdWxlX21heGlHcmFpbnMoKY0Cc3ZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPihtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KimOAm12b2lkIGVtc2NyaXB0ZW46OmludGVybmFsOjpyYXdfZGVzdHJ1Y3RvcjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4obWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiopjwKYAWVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6Z2V0KHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiBjb25zdCYpkAJmZW1zY3JpcHRlbjo6c21hcnRfcHRyX3RyYWl0PHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojpjb25zdHJ1Y3RfbnVsbCgpkQKdAWVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6c2hhcmUobWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGVtc2NyaXB0ZW46OmludGVybmFsOjpfRU1fVkFMKimSApsBdm9pZCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6cmF3X2Rlc3RydWN0b3I8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID4oc3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+KimTApwBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Okludm9rZXI8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46Omludm9rZShzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gKCopKCkplALCAXN0ZDo6X18yOjplbmFibGVfaWY8IShpc19hcnJheTxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID46OnZhbHVlKSwgc3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46OnR5cGUgc3RkOjpfXzI6Om1ha2Vfc2hhcmVkPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPigplQI3bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6c2V0U2FtcGxlKG1heGlTYW1wbGUqKZYCOG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OmdldE5vcm1hbGlzZWRQb3NpdGlvbigplwI0bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6c2V0UG9zaXRpb24oZG91YmxlKZgCQm1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OnBsYXkoZG91YmxlLCBkb3VibGUsIGludCwgZG91YmxlKZkCzAJlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OiopKGRvdWJsZSwgZG91YmxlLCBpbnQsIGRvdWJsZSksIGRvdWJsZSwgbWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGRvdWJsZSwgZG91YmxlLCBpbnQsIGRvdWJsZT46Omludm9rZShkb3VibGUgKG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OiogY29uc3QmKShkb3VibGUsIGRvdWJsZSwgaW50LCBkb3VibGUpLCBtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KiwgZG91YmxlLCBkb3VibGUsIGludCwgZG91YmxlKZoCRG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OnBsYXlBdFBvc2l0aW9uKGRvdWJsZSwgZG91YmxlLCBpbnQpmwKsAmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6KikoZG91YmxlLCBkb3VibGUsIGludCksIGRvdWJsZSwgbWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGRvdWJsZSwgZG91YmxlLCBpbnQ+OjppbnZva2UoZG91YmxlIChtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+OjoqIGNvbnN0JikoZG91YmxlLCBkb3VibGUsIGludCksIG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qLCBkb3VibGUsIGRvdWJsZSwgaW50KZwCcXZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+KG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiopnQJrdm9pZCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6cmF3X2Rlc3RydWN0b3I8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4obWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+KimeApsBZW1zY3JpcHRlbjo6c21hcnRfcHRyX3RyYWl0PHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+ID46OnNoYXJlKG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiosIGVtc2NyaXB0ZW46OmludGVybmFsOjpfRU1fVkFMKimfAr8Bc3RkOjpfXzI6OmVuYWJsZV9pZjwhKGlzX2FycmF5PG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+Ojp2YWx1ZSksIHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+ID46OnR5cGUgc3RkOjpfXzI6Om1ha2Vfc2hhcmVkPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+KCmgAjZtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj46OnNldFNhbXBsZShtYXhpU2FtcGxlKimhAkFtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj46OnBsYXkoZG91YmxlLCBkb3VibGUsIGludCwgZG91YmxlKaICa3ZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+KG1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiopowJfbWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+KCmkAjNtYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OnNldFNhbXBsZShtYXhpU2FtcGxlKimlAjFtYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OnNldExvb3BTdGFydChkb3VibGUppgIvbWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+OjpzZXRMb29wRW5kKGRvdWJsZSmnAiltYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OmdldExvb3BFbmQoKagCRm1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6cGxheShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBpbnQsIGRvdWJsZSmpAtwCZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OiopKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGludCwgZG91YmxlKSwgZG91YmxlLCBtYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBpbnQsIGRvdWJsZT46Omludm9rZShkb3VibGUgKG1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6KiBjb25zdCYpKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGludCwgZG91YmxlKSwgbWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgaW50LCBkb3VibGUpqgJIbWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+OjpwbGF5QXRQb3NpdGlvbihkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBpbnQpqwK8AmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+OjoqKShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBpbnQpLCBkb3VibGUsIG1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGludD46Omludm9rZShkb3VibGUgKG1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6KiBjb25zdCYpKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGludCksIG1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGludCmsAnBtYXhpR3JhaW48aGFubldpbkZ1bmN0b3I+OjptYXhpR3JhaW4obWF4aVNhbXBsZSosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIG1heGlHcmFpbldpbmRvd0NhY2hlPGhhbm5XaW5GdW5jdG9yPioprQJiRW1zY3JpcHRlbkJpbmRpbmdJbml0aWFsaXplcl9teV9tb2R1bGVfbWF4aWJpdHM6OkVtc2NyaXB0ZW5CaW5kaW5nSW5pdGlhbGl6ZXJfbXlfbW9kdWxlX21heGliaXRzKCmuAkR2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpQml0cz4obWF4aUJpdHMqKa8Cb2Vtc2NyaXB0ZW46OmludGVybmFsOjpJbnZva2VyPHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50Pjo6aW52b2tlKHVuc2lnbmVkIGludCAoKikodW5zaWduZWQgaW50KSwgdW5zaWduZWQgaW50KbACmQFlbXNjcmlwdGVuOjppbnRlcm5hbDo6SW52b2tlcjx1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50Pjo6aW52b2tlKHVuc2lnbmVkIGludCAoKikodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQpLCB1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCmxAihtYXhpQml0czo6YXQodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQpsgIpbWF4aUJpdHM6OnNobCh1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCmzAiltYXhpQml0czo6c2hyKHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KbQCwwFlbXNjcmlwdGVuOjppbnRlcm5hbDo6SW52b2tlcjx1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQ+OjppbnZva2UodW5zaWduZWQgaW50ICgqKSh1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KSwgdW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCm1AjVtYXhpQml0czo6cih1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KbYCKm1heGlCaXRzOjpsYW5kKHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KbcCKW1heGlCaXRzOjpsb3IodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQpuAIqbWF4aUJpdHM6Omx4b3IodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQpuQIbbWF4aUJpdHM6Om5lZyh1bnNpZ25lZCBpbnQpugIbbWF4aUJpdHM6OmluYyh1bnNpZ25lZCBpbnQpuwIbbWF4aUJpdHM6OmRlYyh1bnNpZ25lZCBpbnQpvAIpbWF4aUJpdHM6OmFkZCh1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCm9AiltYXhpQml0czo6c3ViKHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50Kb4CKW1heGlCaXRzOjptdWwodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQpvwIpbWF4aUJpdHM6OmRpdih1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCnAAihtYXhpQml0czo6Z3QodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQpwQIobWF4aUJpdHM6Omx0KHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KcICKW1heGlCaXRzOjpndGUodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQpwwIpbWF4aUJpdHM6Omx0ZSh1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCnEAihtYXhpQml0czo6ZXEodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQpxQIRbWF4aUJpdHM6Om5vaXNlKCnGAiBtYXhpQml0czo6dG9TaWduYWwodW5zaWduZWQgaW50KccCJG1heGlCaXRzOjp0b1RyaWdTaWduYWwodW5zaWduZWQgaW50KcgCXWVtc2NyaXB0ZW46OmludGVybmFsOjpJbnZva2VyPHVuc2lnbmVkIGludCwgZG91YmxlPjo6aW52b2tlKHVuc2lnbmVkIGludCAoKikoZG91YmxlKSwgZG91YmxlKckCHG1heGlCaXRzOjpmcm9tU2lnbmFsKGRvdWJsZSnKAkp2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpQ291bnRlcj4obWF4aUNvdW50ZXIqKcsCPm1heGlDb3VudGVyKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlDb3VudGVyPigpzAIibWF4aUNvdW50ZXI6OmNvdW50KGRvdWJsZSwgZG91YmxlKc0CRnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlJbmRleD4obWF4aUluZGV4KinOAjptYXhpSW5kZXgqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aUluZGV4PigpzwJXbWF4aUluZGV4OjpwdWxsKGRvdWJsZSwgZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4p0AJMdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aVJhdGlvU2VxPihtYXhpUmF0aW9TZXEqKdECQG1heGlSYXRpb1NlcSogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpUmF0aW9TZXE+KCnSAlZtYXhpUmF0aW9TZXE6OnBsYXlUcmlnKGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KdMCjgNlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlSYXRpb1NlcTo6KikoZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4pLCBkb3VibGUsIG1heGlSYXRpb1NlcSosIGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+ID46Omludm9rZShkb3VibGUgKG1heGlSYXRpb1NlcTo6KiBjb25zdCYpKGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KSwgbWF4aVJhdGlvU2VxKiwgZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4qKdQCkAFtYXhpUmF0aW9TZXE6OnBsYXlWYWx1ZXMoZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4sIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPinVAu8EZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpUmF0aW9TZXE6OiopKGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+LCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4pLCBkb3VibGUsIG1heGlSYXRpb1NlcSosIGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+LCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4gPjo6aW52b2tlKGRvdWJsZSAobWF4aVJhdGlvU2VxOjoqIGNvbnN0JikoZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4sIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiksIG1heGlSYXRpb1NlcSosIGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+Kiwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KinWAk5FbXNjcmlwdGVuQmluZGluZ0luaXRpYWxpemVyX21heGlWZXJiOjpFbXNjcmlwdGVuQmluZGluZ0luaXRpYWxpemVyX21heGlWZXJiKCnXAk52b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpU2F0UmV2ZXJiPihtYXhpU2F0UmV2ZXJiKinYAkh2b2lkIGVtc2NyaXB0ZW46OmludGVybmFsOjpyYXdfZGVzdHJ1Y3RvcjxtYXhpU2F0UmV2ZXJiPihtYXhpU2F0UmV2ZXJiKinZAkJtYXhpU2F0UmV2ZXJiKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlTYXRSZXZlcmI+KCnaAkx2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpRnJlZVZlcmI+KG1heGlGcmVlVmVyYiop2wJAbWF4aUZyZWVWZXJiKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlGcmVlVmVyYj4oKdwCK3N0ZDo6X18yOjpfX3Rocm93X2xlbmd0aF9lcnJvcihjaGFyIGNvbnN0KindAmR2b2lkIHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPjo6X19wdXNoX2JhY2tfc2xvd19wYXRoPGludCBjb25zdCY+KGludCBjb25zdCYp3gJVc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+OjpfX2FwcGVuZCh1bnNpZ25lZCBsb25nLCBpbnQgY29uc3QmKd8CcHZvaWQgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+OjpfX3B1c2hfYmFja19zbG93X3BhdGg8ZG91YmxlIGNvbnN0Jj4oZG91YmxlIGNvbnN0JingAlhzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6X19hcHBlbmQodW5zaWduZWQgbG9uZywgY2hhciBjb25zdCYp4QJvc3RkOjpfXzI6OnZlY3RvcjxtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPG1heGlLdXJhbW90b09zY2lsbGF0b3I+ID46Ol9fYXBwZW5kKHVuc2lnbmVkIGxvbmcp4gJPc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+OjpfX2FwcGVuZCh1bnNpZ25lZCBsb25nKeMCE21heGlGRlQ6On5tYXhpRkZUKCnkAjNtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+Ojp+bWF4aVRpbWVTdHJldGNoKCnlAoAEc3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+OjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4sIGVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6dmFsX2RlbGV0ZXI+KG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qLCBlbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46OnZhbF9kZWxldGVyLCBzdGQ6Ol9fMjo6ZW5hYmxlX2lmPGlzX2NvbnZlcnRpYmxlPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qLCBtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+Kj46OnZhbHVlLCBzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID46Ol9fbmF0Pjo6dHlwZSnmAnplbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46OnZhbF9kZWxldGVyOjpvcGVyYXRvcigpKHZvaWQgY29uc3QqKecC9AFzdGQ6Ol9fMjo6X19zaGFyZWRfcHRyX3BvaW50ZXI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6dmFsX2RlbGV0ZXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46On5fX3NoYXJlZF9wdHJfcG9pbnRlcigp6AL2AXN0ZDo6X18yOjpfX3NoYXJlZF9wdHJfcG9pbnRlcjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KiwgZW1zY3JpcHRlbjo6c21hcnRfcHRyX3RyYWl0PHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp2YWxfZGVsZXRlciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6fl9fc2hhcmVkX3B0cl9wb2ludGVyKCkuMekC7wFzdGQ6Ol9fMjo6X19zaGFyZWRfcHRyX3BvaW50ZXI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6dmFsX2RlbGV0ZXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46Ol9fb25femVyb19zaGFyZWQoKeoChwJzdGQ6Ol9fMjo6X19zaGFyZWRfcHRyX3BvaW50ZXI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6dmFsX2RlbGV0ZXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46Ol9fZ2V0X2RlbGV0ZXIoc3RkOjp0eXBlX2luZm8gY29uc3QmKSBjb25zdOsC9AFzdGQ6Ol9fMjo6X19zaGFyZWRfcHRyX3BvaW50ZXI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6dmFsX2RlbGV0ZXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46Ol9fb25femVyb19zaGFyZWRfd2Vhaygp7AKQAXN0ZDo6X18yOjpfX3NoYXJlZF9wdHJfZW1wbGFjZTxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp+X19zaGFyZWRfcHRyX2VtcGxhY2UoKe0CkgFzdGQ6Ol9fMjo6X19zaGFyZWRfcHRyX2VtcGxhY2U8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6fl9fc2hhcmVkX3B0cl9lbXBsYWNlKCkuMe4CiwFzdGQ6Ol9fMjo6X19zaGFyZWRfcHRyX2VtcGxhY2U8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6X19vbl96ZXJvX3NoYXJlZCgp7wIhbWF4aUdyYWluPGhhbm5XaW5GdW5jdG9yPjo6cGxheSgp8AIxbWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+Ojp+bWF4aVBpdGNoU2hpZnQoKfEC+ANzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPjo6c2hhcmVkX3B0cjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4sIGVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp2YWxfZGVsZXRlcj4obWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+KiwgZW1zY3JpcHRlbjo6c21hcnRfcHRyX3RyYWl0PHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+ID46OnZhbF9kZWxldGVyLCBzdGQ6Ol9fMjo6ZW5hYmxlX2lmPGlzX2NvbnZlcnRpYmxlPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiosIG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPio+Ojp2YWx1ZSwgc3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID46Ol9fbmF0Pjo6dHlwZSnyAvEBc3RkOjpfXzI6Ol9fc2hhcmVkX3B0cl9wb2ludGVyPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiosIGVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp2YWxfZGVsZXRlciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp+X19zaGFyZWRfcHRyX3BvaW50ZXIoKfMC8wFzdGQ6Ol9fMjo6X19zaGFyZWRfcHRyX3BvaW50ZXI8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+KiwgZW1zY3JpcHRlbjo6c21hcnRfcHRyX3RyYWl0PHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+ID46OnZhbF9kZWxldGVyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+ID46On5fX3NoYXJlZF9wdHJfcG9pbnRlcigpLjH0AoQCc3RkOjpfXzI6Ol9fc2hhcmVkX3B0cl9wb2ludGVyPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiosIGVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp2YWxfZGVsZXRlciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPiA+OjpfX2dldF9kZWxldGVyKHN0ZDo6dHlwZV9pbmZvIGNvbnN0JikgY29uc3T1Ao4Bc3RkOjpfXzI6Ol9fc2hhcmVkX3B0cl9lbXBsYWNlPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp+X19zaGFyZWRfcHRyX2VtcGxhY2UoKfYCkAFzdGQ6Ol9fMjo6X19zaGFyZWRfcHRyX2VtcGxhY2U8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+ID46On5fX3NoYXJlZF9wdHJfZW1wbGFjZSgpLjH3AokBc3RkOjpfXzI6Ol9fc2hhcmVkX3B0cl9lbXBsYWNlPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPiA+OjpfX29uX3plcm9fc2hhcmVkKCn4AiRfR0xPQkFMX19zdWJfSV9tYXhpbWlsaWFuLmVtYmluZC5jcHD5AhdtYXhpT3NjOjpwaGFzb3IoZG91YmxlKfoCGW1heGlPc2M6OnRyaWFuZ2xlKGRvdWJsZSn7AlBtYXhpRW52ZWxvcGU6OmxpbmUoaW50LCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mKfwCIm1heGlFbnZlbG9wZTo6dHJpZ2dlcihpbnQsIGRvdWJsZSn9Ah5tYXhpRGVsYXlsaW5lOjptYXhpRGVsYXlsaW5lKCn+AiZtYXhpRGVsYXlsaW5lOjpkbChkb3VibGUsIGludCwgZG91YmxlKf8CK21heGlEZWxheWxpbmU6OmRsKGRvdWJsZSwgaW50LCBkb3VibGUsIGludCmAAyJtYXhpRmlsdGVyOjpsb3Bhc3MoZG91YmxlLCBkb3VibGUpgQMibWF4aUZpbHRlcjo6aGlwYXNzKGRvdWJsZSwgZG91YmxlKYIDKW1heGlGaWx0ZXI6OmxvcmVzKGRvdWJsZSwgZG91YmxlLCBkb3VibGUpgwMpbWF4aUZpbHRlcjo6aGlyZXMoZG91YmxlLCBkb3VibGUsIGRvdWJsZSmEAyxtYXhpRmlsdGVyOjpiYW5kcGFzcyhkb3VibGUsIGRvdWJsZSwgZG91YmxlKYUDWG1heGlNaXg6OnN0ZXJlbyhkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGRvdWJsZSmGA15tYXhpTWl4OjpxdWFkKGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgZG91YmxlLCBkb3VibGUphwNrbWF4aU1peDo6YW1iaXNvbmljKGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSmIA2xtYXhpU2FtcGxlOjpsb2FkKHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4sIGludCmJAxJtYXhpU2FtcGxlOjpyZWFkKCmKA2dzdGQ6Ol9fMjo6YmFzaWNfaWZzdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OmJhc2ljX2lmc3RyZWFtKGNoYXIgY29uc3QqLCB1bnNpZ25lZCBpbnQpiwPdAXN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+JiBzdGQ6Ol9fMjo6X19wdXRfY2hhcmFjdGVyX3NlcXVlbmNlPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+KHN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+JiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGxvbmcpjANNc3RkOjpfXzI6OnZlY3RvcjxzaG9ydCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxzaG9ydD4gPjo6X19hcHBlbmQodW5zaWduZWQgbG9uZymNA01zdGQ6Ol9fMjo6YmFzaWNfZmlsZWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX2ZpbGVidWYoKY4DbG1heGlTYW1wbGU6OnNldFNhbXBsZUZyb21PZ2dCbG9iKHN0ZDo6X18yOjp2ZWN0b3I8dW5zaWduZWQgY2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjx1bnNpZ25lZCBjaGFyPiA+JiwgaW50KY8DTHN0ZDo6X18yOjpiYXNpY19maWxlYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpiYXNpY19maWxlYnVmKCmQA1xzdGQ6Ol9fMjo6YmFzaWNfZmlsZWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6b3BlbihjaGFyIGNvbnN0KiwgdW5zaWduZWQgaW50KZEDT3N0ZDo6X18yOjpiYXNpY19pZnN0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX2lmc3RyZWFtKCmSAxVtYXhpU2FtcGxlOjppc1JlYWR5KCmTA05tYXhpU2FtcGxlOjpzZXRTYW1wbGUoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JimUA/YBc3RkOjpfXzI6OmVuYWJsZV9pZjwoX19pc19mb3J3YXJkX2l0ZXJhdG9yPGRvdWJsZSo+Ojp2YWx1ZSkgJiYgKGlzX2NvbnN0cnVjdGlibGU8ZG91YmxlLCBzdGQ6Ol9fMjo6aXRlcmF0b3JfdHJhaXRzPGRvdWJsZSo+OjpyZWZlcmVuY2U+Ojp2YWx1ZSksIHZvaWQ+Ojp0eXBlIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPjo6YXNzaWduPGRvdWJsZSo+KGRvdWJsZSosIGRvdWJsZSoplQNTbWF4aVNhbXBsZTo6c2V0U2FtcGxlKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGludCmWAxVtYXhpU2FtcGxlOjp0cmlnZ2VyKCmXAxJtYXhpU2FtcGxlOjpwbGF5KCmYAyhtYXhpU2FtcGxlOjpwbGF5KGRvdWJsZSwgZG91YmxlLCBkb3VibGUpmQMxbWF4aVNhbXBsZTo6cGxheShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUmKZoDKW1heGlTYW1wbGU6OnBsYXk0KGRvdWJsZSwgZG91YmxlLCBkb3VibGUpmwMWbWF4aVNhbXBsZTo6cGxheU9uY2UoKZwDHG1heGlTYW1wbGU6OnBsYXlPblpYKGRvdWJsZSmdAyRtYXhpU2FtcGxlOjpwbGF5T25aWChkb3VibGUsIGRvdWJsZSmeAxxtYXhpU2FtcGxlOjpwbGF5T25jZShkb3VibGUpnwMsbWF4aVNhbXBsZTo6cGxheU9uWlgoZG91YmxlLCBkb3VibGUsIGRvdWJsZSmgAyptYXhpU2FtcGxlOjpsb29wU2V0UG9zT25aWChkb3VibGUsIGRvdWJsZSmhAxhtYXhpU2FtcGxlOjpwbGF5KGRvdWJsZSmiAx1tYXhpU2FtcGxlOjpub3JtYWxpc2UoZG91YmxlKaMDLm1heGlTYW1wbGU6OmF1dG9UcmltKGZsb2F0LCBmbG9hdCwgYm9vbCwgYm9vbCmkAzNtYXhpRHluOjpnYXRlKGRvdWJsZSwgZG91YmxlLCBsb25nLCBkb3VibGUsIGRvdWJsZSmlAzttYXhpRHluOjpjb21wcmVzc29yKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKaYDGW1heGlEeW46OmNvbXByZXNzKGRvdWJsZSmnAxptYXhpRHluOjpzZXRBdHRhY2soZG91YmxlKagDG21heGlEeW46OnNldFJlbGVhc2UoZG91YmxlKakDHW1heGlEeW46OnNldFRocmVzaG9sZChkb3VibGUpqgMubWF4aUVudjo6YXIoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgbG9uZywgaW50KasDQG1heGlFbnY6OmFkc3IoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGxvbmcsIGludCmsAxptYXhpRW52OjphZHNyKGRvdWJsZSwgaW50Ka0DGm1heGlFbnY6OnNldEF0dGFjayhkb3VibGUprgMbbWF4aUVudjo6c2V0U3VzdGFpbihkb3VibGUprwMZbWF4aUVudjo6c2V0RGVjYXkoZG91YmxlKbADEmNvbnZlcnQ6Om10b2YoaW50KbEDYHZpcnR1YWwgdGh1bmsgdG8gc3RkOjpfXzI6OmJhc2ljX2lmc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfaWZzdHJlYW0oKbIDUXN0ZDo6X18yOjpiYXNpY19pZnN0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX2lmc3RyZWFtKCkuMbMDYnZpcnR1YWwgdGh1bmsgdG8gc3RkOjpfXzI6OmJhc2ljX2lmc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfaWZzdHJlYW0oKS4xtANDc3RkOjpfXzI6OmJhc2ljX2ZpbGVidWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnN5bmMoKbUDT3N0ZDo6X18yOjpiYXNpY19maWxlYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfZmlsZWJ1ZigpLjG2A1tzdGQ6Ol9fMjo6YmFzaWNfZmlsZWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6aW1idWUoc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYptwNQc3RkOjpfXzI6OmJhc2ljX2ZpbGVidWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnNldGJ1ZihjaGFyKiwgbG9uZym4A3pzdGQ6Ol9fMjo6YmFzaWNfZmlsZWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6c2Vla29mZihsb25nIGxvbmcsIHN0ZDo6X18yOjppb3NfYmFzZTo6c2Vla2RpciwgdW5zaWduZWQgaW50KbkDHHN0ZDo6X18yOjpfX3Rocm93X2JhZF9jYXN0KCm6A29zdGQ6Ol9fMjo6YmFzaWNfZmlsZWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6c2Vla3BvcyhzdGQ6Ol9fMjo6ZnBvczxfX21ic3RhdGVfdD4sIHVuc2lnbmVkIGludCm7A0hzdGQ6Ol9fMjo6YmFzaWNfZmlsZWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6dW5kZXJmbG93KCm8A0tzdGQ6Ol9fMjo6YmFzaWNfZmlsZWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6cGJhY2tmYWlsKGludCm9A0pzdGQ6Ol9fMjo6YmFzaWNfZmlsZWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6b3ZlcmZsb3coaW50Kb4DhQJzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiBzdGQ6Ol9fMjo6X19wYWRfYW5kX291dHB1dDxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPihzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0Kiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgY2hhcim/AxttYXhpQ2xvY2s6OnNldFRlbXBvKGRvdWJsZSnAAxNtYXhpQ2xvY2s6OnRpY2tlcigpwQMfbWF4aUNsb2NrOjpzZXRUaWNrc1BlckJlYXQoaW50KcIDHW1heGlGRlQ6OnNldHVwKGludCwgaW50LCBpbnQpwwMqbWF4aUZGVDo6cHJvY2VzcyhmbG9hdCwgbWF4aUZGVDo6ZmZ0TW9kZXMpxAMTbWF4aUZGVDo6bWFnc1RvREIoKcUDG21heGlGRlQ6OnNwZWN0cmFsRmxhdG5lc3MoKcYDG21heGlGRlQ6OnNwZWN0cmFsQ2VudHJvaWQoKccDHm1heGlJRkZUOjpzZXR1cChpbnQsIGludCwgaW50KcgDkwFtYXhpSUZGVDo6cHJvY2VzcyhzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+Jiwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiYsIG1heGlJRkZUOjpmZnRNb2RlcynJAy5GRlQoaW50LCBib29sLCBmbG9hdCosIGZsb2F0KiwgZmxvYXQqLCBmbG9hdCopygMkUmVhbEZGVChpbnQsIGZsb2F0KiwgZmxvYXQqLCBmbG9hdCopywMgZmZ0OjpnZW5XaW5kb3coaW50LCBpbnQsIGZsb2F0KinMAw9mZnQ6OnNldHVwKGludCnNAwtmZnQ6On5mZnQoKc4DIWZmdDo6Y2FsY0ZGVChpbnQsIGZsb2F0KiwgZmxvYXQqKc8DN2ZmdDo6cG93ZXJTcGVjdHJ1bShpbnQsIGZsb2F0KiwgZmxvYXQqLCBmbG9hdCosIGZsb2F0KinQAx1mZnQ6OmNvbnZUb0RCKGZsb2F0KiwgZmxvYXQqKdEDO2ZmdDo6aW52ZXJzZUZGVENvbXBsZXgoaW50LCBmbG9hdCosIGZsb2F0KiwgZmxvYXQqLCBmbG9hdCop0gM+ZmZ0OjppbnZlcnNlUG93ZXJTcGVjdHJ1bShpbnQsIGZsb2F0KiwgZmxvYXQqLCBmbG9hdCosIGZsb2F0KinTAzdtYXhpTUZDQ0FuYWx5c2VyPGRvdWJsZT46Om1lbEZpbHRlckFuZExvZ1NxdWFyZShmbG9hdCop1AMmbWF4aVJldmVyYkZpbHRlcnM6Om1heGlSZXZlcmJGaWx0ZXJzKCnVAyBtYXhpUmV2ZXJiQmFzZTo6bWF4aVJldmVyYkJhc2UoKdYDHm1heGlTYXRSZXZlcmI6Om1heGlTYXRSZXZlcmIoKdcDG21heGlTYXRSZXZlcmI6OnBsYXkoZG91YmxlKdgDHG1heGlGcmVlVmVyYjo6bWF4aUZyZWVWZXJiKCnZAyptYXhpRnJlZVZlcmI6OnBsYXkoZG91YmxlLCBkb3VibGUsIGRvdWJsZSnaAydwb2ludF9jb21wYXJlKHZvaWQgY29uc3QqLCB2b2lkIGNvbnN0KinbAxp2b3JiaXNfZGVpbml0KHN0Yl92b3JiaXMqKdwDKWlzX3dob2xlX3BhY2tldF9wcmVzZW50KHN0Yl92b3JiaXMqLCBpbnQp3QMzdm9yYmlzX2RlY29kZV9wYWNrZXQoc3RiX3ZvcmJpcyosIGludCosIGludCosIGludCop3gMXc3RhcnRfcGFnZShzdGJfdm9yYmlzKinfAy92b3JiaXNfZmluaXNoX2ZyYW1lKHN0Yl92b3JiaXMqLCBpbnQsIGludCwgaW50KeADQHZvcmJpc19kZWNvZGVfaW5pdGlhbChzdGJfdm9yYmlzKiwgaW50KiwgaW50KiwgaW50KiwgaW50KiwgaW50KinhAxpnZXRfYml0cyhzdGJfdm9yYmlzKiwgaW50KeIDMmNvZGVib29rX2RlY29kZV9zY2FsYXJfcmF3KHN0Yl92b3JiaXMqLCBDb2RlYm9vayop4wNDZGVjb2RlX3Jlc2lkdWUoc3RiX3ZvcmJpcyosIGZsb2F0KiosIGludCwgaW50LCBpbnQsIHVuc2lnbmVkIGNoYXIqKeQDK2ludmVyc2VfbWRjdChmbG9hdCosIGludCwgc3RiX3ZvcmJpcyosIGludCnlAxlmbHVzaF9wYWNrZXQoc3RiX3ZvcmJpcyop5gMac3RhcnRfZGVjb2RlcihzdGJfdm9yYmlzKinnAyh1aW50MzJfY29tcGFyZSh2b2lkIGNvbnN0Kiwgdm9pZCBjb25zdCop6AMlaW5pdF9ibG9ja3NpemUoc3RiX3ZvcmJpcyosIGludCwgaW50KekDFnN0Yl92b3JiaXNfb3Blbl9tZW1vcnnqAxpzdGJfdm9yYmlzX2dldF9mcmFtZV9zaG9ydOsDQGNvbnZlcnRfc2FtcGxlc19zaG9ydChpbnQsIHNob3J0KiosIGludCwgaW50LCBmbG9hdCoqLCBpbnQsIGludCnsAyZzdGJfdm9yYmlzX2dldF9mcmFtZV9zaG9ydF9pbnRlcmxlYXZlZO0DR2NvbnZlcnRfY2hhbm5lbHNfc2hvcnRfaW50ZXJsZWF2ZWQoaW50LCBzaG9ydCosIGludCwgZmxvYXQqKiwgaW50LCBpbnQp7gMYc3RiX3ZvcmJpc19kZWNvZGVfbWVtb3J57wMfbWF5YmVfc3RhcnRfcGFja2V0KHN0Yl92b3JiaXMqKfADKXN0YXJ0X3BhZ2Vfbm9fY2FwdHVyZXBhdHRlcm4oc3RiX3ZvcmJpcyop8QMyY29kZWJvb2tfZGVjb2RlX3N0YXJ0KHN0Yl92b3JiaXMqLCBDb2RlYm9vayosIGludCnyA19jb2RlYm9va19kZWNvZGVfZGVpbnRlcmxlYXZlX3JlcGVhdChzdGJfdm9yYmlzKiwgQ29kZWJvb2sqLCBmbG9hdCoqLCBpbnQsIGludCosIGludCosIGludCwgaW50KfMDNWltZGN0X3N0ZXAzX2l0ZXIwX2xvb3AoaW50LCBmbG9hdCosIGludCwgaW50LCBmbG9hdCop9AM8aW1kY3Rfc3RlcDNfaW5uZXJfcl9sb29wKGludCwgZmxvYXQqLCBpbnQsIGludCwgZmxvYXQqLCBpbnQp9QMHc2NhbGJuZvYDBmxkZXhwZvcDBm1lbWNtcPgDBXFzb3J0+QMEc2lmdPoDA3NocvsDB3RyaW5rbGX8AwNzaGz9AwRwbnR6/gMFY3ljbGX/AwdhX2N0el9sgAQMX19zdGRpb19zZWVrgQQKX19sb2NrZmlsZYIEDF9fdW5sb2NrZmlsZYMECV9fZndyaXRleIQEBmZ3cml0ZYUEB2lwcmludGaGBBBfX2Vycm5vX2xvY2F0aW9uhwQHd2NydG9tYogEBndjdG9tYokEBm1lbWNocooEBWZyZXhwiwQTX192ZnByaW50Zl9pbnRlcm5hbIwEC3ByaW50Zl9jb3JljQQDb3V0jgQGZ2V0aW50jwQHcG9wX2FyZ5AEA3BhZJEEBWZtdF9vkgQFZm10X3iTBAVmbXRfdZQECHZmcHJpbnRmlQQGZm10X2ZwlgQTcG9wX2FyZ19sb25nX2RvdWJsZZcECXZmaXByaW50ZpgECl9fb2ZsX2xvY2uZBAlfX3Rvd3JpdGWaBAhmaXByaW50ZpsEBWZwdXRjnAQRX19mdGVsbG9fdW5sb2NrZWSdBAhfX2Z0ZWxsb54EBWZ0ZWxsnwQIX190b3JlYWSgBAVmcmVhZKEEEV9fZnNlZWtvX3VubG9ja2VkogQIX19mc2Vla2+jBAVmc2Vla6QEDV9fc3RkaW9fY2xvc2WlBAVmZ2V0Y6YEBnN0cmxlbqcEC19fc3RyY2hybnVsqAQGc3RyY2hyqQQMX19mbW9kZWZsYWdzqgQFZm9wZW6rBAl2c25wcmludGasBAhzbl93cml0Za0EBmZjbG9zZa4EGV9fZW1zY3JpcHRlbl9zdGRvdXRfY2xvc2WvBBhfX2Vtc2NyaXB0ZW5fc3Rkb3V0X3NlZWuwBAxfX3N0ZGlvX3JlYWSxBAhfX2Zkb3BlbrIEDV9fc3RkaW9fd3JpdGWzBApfX292ZXJmbG93tAQGZmZsdXNotQQRX19mZmx1c2hfdW5sb2NrZWS2BAdfX3VmbG93twQJX19vZmxfYWRkuAQJX19sc2hydGkzuQQJX19hc2hsdGkzugQMX190cnVuY3RmZGYyuwQFX19jb3O8BBBfX3JlbV9waW8yX2xhcmdlvQQKX19yZW1fcGlvMr4EBV9fc2luvwQDY29zwAQHX19jb3NkZsEEB19fc2luZGbCBAtfX3JlbV9waW8yZsMEBGNvc2bEBANzaW7FBARzaW5mxgQFX190YW7HBAN0YW7IBAVhdGFuZskEBmF0YW4yZsoEBGV4cGbLBANsb2fMBARsb2dmzQQDcG93zgQHd21lbWNwec8EGXN0ZDo6dW5jYXVnaHRfZXhjZXB0aW9uKCnQBEVzdGQ6Ol9fMjo6YmFzaWNfaW9zPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfaW9zKCnRBB9zdGQ6Ol9fMjo6aW9zX2Jhc2U6On5pb3NfYmFzZSgp0gQ/c3RkOjpfXzI6Omlvc19iYXNlOjpfX2NhbGxfY2FsbGJhY2tzKHN0ZDo6X18yOjppb3NfYmFzZTo6ZXZlbnQp0wRHc3RkOjpfXzI6OmJhc2ljX2lvczxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX2lvcygpLjHUBFFzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfc3RyZWFtYnVmKCnVBFNzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfc3RyZWFtYnVmKCkuMdYEUHN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OmJhc2ljX3N0cmVhbWJ1Zigp1wRdc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6aW1idWUoc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYp2ARSc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6c2V0YnVmKGNoYXIqLCBsb25nKdkEfHN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnNlZWtvZmYobG9uZyBsb25nLCBzdGQ6Ol9fMjo6aW9zX2Jhc2U6OnNlZWtkaXIsIHVuc2lnbmVkIGludCnaBHFzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpzZWVrcG9zKHN0ZDo6X18yOjpmcG9zPF9fbWJzdGF0ZV90PiwgdW5zaWduZWQgaW50KdsEUnN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnhzZ2V0bihjaGFyKiwgbG9uZyncBERzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj46OmNvcHkoY2hhciosIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBsb25nKd0ESnN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnVuZGVyZmxvdygp3gRGc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6dWZsb3coKd8ETXN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnBiYWNrZmFpbChpbnQp4ARYc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6eHNwdXRuKGNoYXIgY29uc3QqLCBsb25nKeEEV3N0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46On5iYXNpY19zdHJlYW1idWYoKeIEWXN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46On5iYXNpY19zdHJlYW1idWYoKS4x4wRWc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1Zjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6YmFzaWNfc3RyZWFtYnVmKCnkBFtzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Ojp4c2dldG4od2NoYXJfdCosIGxvbmcp5QRNc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+Ojpjb3B5KHdjaGFyX3QqLCB3Y2hhcl90IGNvbnN0KiwgdW5zaWduZWQgbG9uZynmBExzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Ojp1Zmxvdygp5wRhc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1Zjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6eHNwdXRuKHdjaGFyX3QgY29uc3QqLCBsb25nKegET3N0ZDo6X18yOjpiYXNpY19pc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfaXN0cmVhbSgpLjHpBF52aXJ0dWFsIHRodW5rIHRvIHN0ZDo6X18yOjpiYXNpY19pc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfaXN0cmVhbSgp6gRPc3RkOjpfXzI6OmJhc2ljX2lzdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19pc3RyZWFtKCkuMusEYHZpcnR1YWwgdGh1bmsgdG8gc3RkOjpfXzI6OmJhc2ljX2lzdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19pc3RyZWFtKCkuMewEjwFzdGQ6Ol9fMjo6YmFzaWNfaXN0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6c2VudHJ5OjpzZW50cnkoc3RkOjpfXzI6OmJhc2ljX2lzdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBib29sKe0ERHN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpmbHVzaCgp7gRhc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JiBzdGQ6Ol9fMjo6dXNlX2ZhY2V0PHN0ZDo6X18yOjpjdHlwZTxjaGFyPiA+KHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKe8E0QFib29sIHN0ZDo6X18yOjpvcGVyYXRvciE9PGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+IGNvbnN0Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gY29uc3QmKfAEVHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpvcGVyYXRvciooKSBjb25zdPEET3N0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpvcGVyYXRvcisrKCnyBNEBYm9vbCBzdGQ6Ol9fMjo6b3BlcmF0b3I9PTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiBjb25zdCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+IGNvbnN0JinzBIkBc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnNlbnRyeTo6c2VudHJ5KHN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jin0BE5zdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6c2VudHJ5Ojp+c2VudHJ5KCn1BJgBc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OmVxdWFsKHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+IGNvbnN0JikgY29uc3T2BEdzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpzYnVtcGMoKfcESnN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnNwdXRjKGNoYXIp+AROc3RkOjpfXzI6OmJhc2ljX2lzdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnJlYWQoY2hhciosIGxvbmcp+QRqc3RkOjpfXzI6OmJhc2ljX2lzdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnNlZWtnKGxvbmcgbG9uZywgc3RkOjpfXzI6Omlvc19iYXNlOjpzZWVrZGlyKfoESnN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+OjpmbHVzaCgp+wRnc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JiBzdGQ6Ol9fMjo6dXNlX2ZhY2V0PHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiA+KHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKfwE4wFib29sIHN0ZDo6X18yOjpvcGVyYXRvciE9PHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+IGNvbnN0Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gY29uc3QmKf0EVXN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+OjpvcGVyYXRvcisrKCn+BOMBYm9vbCBzdGQ6Ol9fMjo6b3BlcmF0b3I9PTx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiBjb25zdCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+IGNvbnN0Jin/BJUBc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46OnNlbnRyeTo6c2VudHJ5KHN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+JimABaQBc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46OmVxdWFsKHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+IGNvbnN0JikgY29uc3SBBU1zdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+OjpzYnVtcGMoKYIFU3N0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46OnNwdXRjKHdjaGFyX3QpgwVPc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19vc3RyZWFtKCkuMYQFXnZpcnR1YWwgdGh1bmsgdG8gc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19vc3RyZWFtKCmFBU9zdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX29zdHJlYW0oKS4yhgVgdmlydHVhbCB0aHVuayB0byBzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX29zdHJlYW0oKS4xhwXtAXN0ZDo6X18yOjpudW1fcHV0PGNoYXIsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID4gY29uc3QmIHN0ZDo6X18yOjp1c2VfZmFjZXQ8c3RkOjpfXzI6Om51bV9wdXQ8Y2hhciwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPiA+KHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKYgFRXN0ZDo6X18yOjpiYXNpY19pb3M8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OmZpbGwoKSBjb25zdIkFSnN0ZDo6X18yOjpiYXNpY19pb3M8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OndpZGVuKGNoYXIpIGNvbnN0igVOc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46Om9wZXJhdG9yPDwoc2hvcnQpiwVMc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46Om9wZXJhdG9yPDwoaW50KYwFVnN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpvcGVyYXRvcjw8KHVuc2lnbmVkIGxvbmcpjQVSc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46Om9wZXJhdG9yPShjaGFyKY4FRnN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpwdXQoY2hhcimPBVtzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6b3BlcmF0b3I9KHdjaGFyX3QpkAVwc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6YmFzaWNfc3RyaW5nKGNoYXIgY29uc3QqKZEFIXN0ZDo6X18yOjppb3NfYmFzZTo6fmlvc19iYXNlKCkuMZIFH3N0ZDo6X18yOjppb3NfYmFzZTo6aW5pdCh2b2lkKimTBbUBc3RkOjpfXzI6OmVuYWJsZV9pZjwoaXNfbW92ZV9jb25zdHJ1Y3RpYmxlPHVuc2lnbmVkIGludD46OnZhbHVlKSAmJiAoaXNfbW92ZV9hc3NpZ25hYmxlPHVuc2lnbmVkIGludD46OnZhbHVlKSwgdm9pZD46OnR5cGUgc3RkOjpfXzI6OnN3YXA8dW5zaWduZWQgaW50Pih1bnNpZ25lZCBpbnQmLCB1bnNpZ25lZCBpbnQmKZQFWXN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpfX3Rlc3RfZm9yX2VvZigpIGNvbnN0lQVfc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46Ol9fdGVzdF9mb3JfZW9mKCkgY29uc3SWBQZ1bmdldGOXBSBzdGQ6Ol9fMjo6aW9zX2Jhc2U6OkluaXQ6OkluaXQoKZgFF19fY3h4X2dsb2JhbF9hcnJheV9kdG9ymQU/c3RkOjpfXzI6Ol9fc3RkaW5idWY8Y2hhcj46Ol9fc3RkaW5idWYoX0lPX0ZJTEUqLCBfX21ic3RhdGVfdCopmgWKAXN0ZDo6X18yOjpiYXNpY19pc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpiYXNpY19pc3RyZWFtKHN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4qKZsFQnN0ZDo6X18yOjpfX3N0ZGluYnVmPHdjaGFyX3Q+OjpfX3N0ZGluYnVmKF9JT19GSUxFKiwgX19tYnN0YXRlX3QqKZwFlgFzdGQ6Ol9fMjo6YmFzaWNfaXN0cmVhbTx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6YmFzaWNfaXN0cmVhbShzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+KimdBUFzdGQ6Ol9fMjo6X19zdGRvdXRidWY8Y2hhcj46Ol9fc3Rkb3V0YnVmKF9JT19GSUxFKiwgX19tYnN0YXRlX3QqKZ4FigFzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6YmFzaWNfb3N0cmVhbShzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+KimfBURzdGQ6Ol9fMjo6X19zdGRvdXRidWY8d2NoYXJfdD46Ol9fc3Rkb3V0YnVmKF9JT19GSUxFKiwgX19tYnN0YXRlX3QqKaAFlgFzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6YmFzaWNfb3N0cmVhbShzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+KimhBX1zdGQ6Ol9fMjo6YmFzaWNfaW9zPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojppbml0KHN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4qKaIFiwFzdGQ6Ol9fMjo6Y29kZWN2dDxjaGFyLCBjaGFyLCBfX21ic3RhdGVfdD4gY29uc3QmIHN0ZDo6X18yOjp1c2VfZmFjZXQ8c3RkOjpfXzI6OmNvZGVjdnQ8Y2hhciwgY2hhciwgX19tYnN0YXRlX3Q+ID4oc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYpowWRAXN0ZDo6X18yOjpjb2RlY3Z0PHdjaGFyX3QsIGNoYXIsIF9fbWJzdGF0ZV90PiBjb25zdCYgc3RkOjpfXzI6OnVzZV9mYWNldDxzdGQ6Ol9fMjo6Y29kZWN2dDx3Y2hhcl90LCBjaGFyLCBfX21ic3RhdGVfdD4gPihzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JimkBSlzdGQ6Ol9fMjo6X19zdGRpbmJ1ZjxjaGFyPjo6fl9fc3RkaW5idWYoKaUFOnN0ZDo6X18yOjpfX3N0ZGluYnVmPGNoYXI+OjppbWJ1ZShzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JimmBSdzdGQ6Ol9fMjo6X19zdGRpbmJ1ZjxjaGFyPjo6dW5kZXJmbG93KCmnBStzdGQ6Ol9fMjo6X19zdGRpbmJ1ZjxjaGFyPjo6X19nZXRjaGFyKGJvb2wpqAUjc3RkOjpfXzI6Ol9fc3RkaW5idWY8Y2hhcj46OnVmbG93KCmpBSpzdGQ6Ol9fMjo6X19zdGRpbmJ1ZjxjaGFyPjo6cGJhY2tmYWlsKGludCmqBSxzdGQ6Ol9fMjo6X19zdGRpbmJ1Zjx3Y2hhcl90Pjo6fl9fc3RkaW5idWYoKasFPXN0ZDo6X18yOjpfX3N0ZGluYnVmPHdjaGFyX3Q+OjppbWJ1ZShzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JimsBSpzdGQ6Ol9fMjo6X19zdGRpbmJ1Zjx3Y2hhcl90Pjo6dW5kZXJmbG93KCmtBS5zdGQ6Ol9fMjo6X19zdGRpbmJ1Zjx3Y2hhcl90Pjo6X19nZXRjaGFyKGJvb2wprgUmc3RkOjpfXzI6Ol9fc3RkaW5idWY8d2NoYXJfdD46OnVmbG93KCmvBTZzdGQ6Ol9fMjo6X19zdGRpbmJ1Zjx3Y2hhcl90Pjo6cGJhY2tmYWlsKHVuc2lnbmVkIGludCmwBTtzdGQ6Ol9fMjo6X19zdGRvdXRidWY8Y2hhcj46OmltYnVlKHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKbEFI3N0ZDo6X18yOjpfX3N0ZG91dGJ1ZjxjaGFyPjo6c3luYygpsgU2c3RkOjpfXzI6Ol9fc3Rkb3V0YnVmPGNoYXI+Ojp4c3B1dG4oY2hhciBjb25zdCosIGxvbmcpswUqc3RkOjpfXzI6Ol9fc3Rkb3V0YnVmPGNoYXI+OjpvdmVyZmxvdyhpbnQptAU+c3RkOjpfXzI6Ol9fc3Rkb3V0YnVmPHdjaGFyX3Q+OjppbWJ1ZShzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0Jim1BTxzdGQ6Ol9fMjo6X19zdGRvdXRidWY8d2NoYXJfdD46OnhzcHV0bih3Y2hhcl90IGNvbnN0KiwgbG9uZym2BTZzdGQ6Ol9fMjo6X19zdGRvdXRidWY8d2NoYXJfdD46Om92ZXJmbG93KHVuc2lnbmVkIGludCm3BQdfX3NobGltuAUIX19zaGdldGO5BQhfX211bHRpM7oFCV9faW50c2NhbrsFB21icnRvd2O8BQ1fX2V4dGVuZHNmdGYyvQUIX19tdWx0ZjO+BQtfX2Zsb2F0c2l0Zr8FCF9fYWRkdGYzwAUNX19leHRlbmRkZnRmMsEFB19fbGV0ZjLCBQdfX2dldGYywwUJY29weXNpZ25sxAUNX19mbG9hdHVuc2l0ZsUFCF9fc3VidGYzxgUHc2NhbGJubMcFCF9fZGl2dGYzyAULX19mbG9hdHNjYW7JBQhoZXhmbG9hdMoFCGRlY2Zsb2F0ywUHc2NhbmV4cMwFDF9fdHJ1bmN0ZnNmMs0FB3Zmc2NhbmbOBQVhcmdfbs8FCXN0b3JlX2ludNAFDV9fc3RyaW5nX3JlYWTRBQd2c3NjYW5m0gUHZG9fcmVhZNMFBnN0cmNtcNQFIF9fZW1zY3JpcHRlbl9lbnZpcm9uX2NvbnN0cnVjdG9y1QUHc3RybmNtcNYFBmdldGVudtcFCF9fbXVubWFw2AUMX19nZXRfbG9jYWxl2QULX19uZXdsb2NhbGXaBQl2YXNwcmludGbbBQZzc2NhbmbcBQhzbnByaW50Zt0FCmZyZWVsb2NhbGXeBQZ3Y3NsZW7fBQl3Y3NydG9tYnPgBQp3Y3NucnRvbWJz4QUJbWJzcnRvd2Nz4gUKbWJzbnJ0b3djc+MFBnN0cnRveOQFCnN0cnRvdWxsX2zlBQlzdHJ0b2xsX2zmBQZzdHJ0b2bnBQhzdHJ0b3guMegFBnN0cnRvZOkFB3N0cnRvbGTqBQlzdHJ0b2xkX2zrBV1zdGQ6Ol9fMjo6Y29sbGF0ZTxjaGFyPjo6ZG9fY29tcGFyZShjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KikgY29uc3TsBUVzdGQ6Ol9fMjo6Y29sbGF0ZTxjaGFyPjo6ZG9fdHJhbnNmb3JtKGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KikgY29uc3TtBc8Bc3RkOjpfXzI6OmVuYWJsZV9pZjxfX2lzX2ZvcndhcmRfaXRlcmF0b3I8Y2hhciBjb25zdCo+Ojp2YWx1ZSwgdm9pZD46OnR5cGUgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6X19pbml0PGNoYXIgY29uc3QqPihjaGFyIGNvbnN0KiwgY2hhciBjb25zdCop7gVAc3RkOjpfXzI6OmNvbGxhdGU8Y2hhcj46OmRvX2hhc2goY2hhciBjb25zdCosIGNoYXIgY29uc3QqKSBjb25zdO8FbHN0ZDo6X18yOjpjb2xsYXRlPHdjaGFyX3Q+Ojpkb19jb21wYXJlKHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqKSBjb25zdPAFTnN0ZDo6X18yOjpjb2xsYXRlPHdjaGFyX3Q+Ojpkb190cmFuc2Zvcm0od2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqKSBjb25zdPEF5AFzdGQ6Ol9fMjo6ZW5hYmxlX2lmPF9faXNfZm9yd2FyZF9pdGVyYXRvcjx3Y2hhcl90IGNvbnN0Kj46OnZhbHVlLCB2b2lkPjo6dHlwZSBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+OjpfX2luaXQ8d2NoYXJfdCBjb25zdCo+KHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0KinyBUlzdGQ6Ol9fMjo6Y29sbGF0ZTx3Y2hhcl90Pjo6ZG9faGFzaCh3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdCopIGNvbnN08wWaAnN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGJvb2wmKSBjb25zdPQFZ3N0ZDo6X18yOjpudW1wdW5jdDxjaGFyPiBjb25zdCYgc3RkOjpfXzI6OnVzZV9mYWNldDxzdGQ6Ol9fMjo6bnVtcHVuY3Q8Y2hhcj4gPihzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0Jin1BaQFc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCogc3RkOjpfXzI6Ol9fc2Nhbl9rZXl3b3JkPHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0Kiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+ID4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCosIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QqLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmLCB1bnNpZ25lZCBpbnQmLCBib29sKfYFOHN0ZDo6X18yOjpsb2NhbGU6OnVzZV9mYWNldChzdGQ6Ol9fMjo6bG9jYWxlOjppZCYpIGNvbnN09wXMAXN0ZDo6X18yOjp1bmlxdWVfcHRyPHVuc2lnbmVkIGNoYXIsIHZvaWQgKCopKHZvaWQqKT46OnVuaXF1ZV9wdHI8dHJ1ZSwgdm9pZD4odW5zaWduZWQgY2hhciosIHN0ZDo6X18yOjpfX2RlcGVuZGVudF90eXBlPHN0ZDo6X18yOjpfX3VuaXF1ZV9wdHJfZGVsZXRlcl9zZmluYWU8dm9pZCAoKikodm9pZCopPiwgdHJ1ZT46Ol9fZ29vZF9ydmFsX3JlZl90eXBlKfgFmgJzdGQ6Ol9fMjo6bnVtX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBsb25nJikgY29uc3T5BesCc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19kb19nZXRfc2lnbmVkPGxvbmc+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgbG9uZyYpIGNvbnN0+gU5c3RkOjpfXzI6Ol9fbnVtX2dldF9iYXNlOjpfX2dldF9iYXNlKHN0ZDo6X18yOjppb3NfYmFzZSYp+wVIc3RkOjpfXzI6Ol9fbnVtX2dldDxjaGFyPjo6X19zdGFnZTJfaW50X3ByZXAoc3RkOjpfXzI6Omlvc19iYXNlJiwgY2hhciYp/AVlc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6YmFzaWNfc3RyaW5nKCn9BWxzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpyZXNpemUodW5zaWduZWQgbG9uZyn+BeUBc3RkOjpfXzI6Ol9fbnVtX2dldDxjaGFyPjo6X19zdGFnZTJfaW50X2xvb3AoY2hhciwgaW50LCBjaGFyKiwgY2hhciomLCB1bnNpZ25lZCBpbnQmLCBjaGFyLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0JiwgdW5zaWduZWQgaW50KiwgdW5zaWduZWQgaW50KiYsIGNoYXIgY29uc3QqKf8FXGxvbmcgc3RkOjpfXzI6Ol9fbnVtX2dldF9zaWduZWRfaW50ZWdyYWw8bG9uZz4oY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBpbnQmLCBpbnQpgAalAXN0ZDo6X18yOjpfX2NoZWNrX2dyb3VwaW5nKHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QmLCB1bnNpZ25lZCBpbnQqLCB1bnNpZ25lZCBpbnQqLCB1bnNpZ25lZCBpbnQmKYEGnwJzdGQ6Ol9fMjo6bnVtX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBsb25nIGxvbmcmKSBjb25zdIIG9QJzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiBzdGQ6Ol9fMjo6bnVtX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2RvX2dldF9zaWduZWQ8bG9uZyBsb25nPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGxvbmcgbG9uZyYpIGNvbnN0gwZmbG9uZyBsb25nIHN0ZDo6X18yOjpfX251bV9nZXRfc2lnbmVkX2ludGVncmFsPGxvbmcgbG9uZz4oY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBpbnQmLCBpbnQphAakAnN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHVuc2lnbmVkIHNob3J0JikgY29uc3SFBoEDc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19kb19nZXRfdW5zaWduZWQ8dW5zaWduZWQgc2hvcnQ+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdW5zaWduZWQgc2hvcnQmKSBjb25zdIYGcnVuc2lnbmVkIHNob3J0IHN0ZDo6X18yOjpfX251bV9nZXRfdW5zaWduZWRfaW50ZWdyYWw8dW5zaWduZWQgc2hvcnQ+KGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgaW50JiwgaW50KYcGogJzdGQ6Ol9fMjo6bnVtX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB1bnNpZ25lZCBpbnQmKSBjb25zdIgG/QJzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiBzdGQ6Ol9fMjo6bnVtX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2RvX2dldF91bnNpZ25lZDx1bnNpZ25lZCBpbnQ+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdW5zaWduZWQgaW50JikgY29uc3SJBm51bnNpZ25lZCBpbnQgc3RkOjpfXzI6Ol9fbnVtX2dldF91bnNpZ25lZF9pbnRlZ3JhbDx1bnNpZ25lZCBpbnQ+KGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgaW50JiwgaW50KYoGqAJzdGQ6Ol9fMjo6bnVtX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB1bnNpZ25lZCBsb25nIGxvbmcmKSBjb25zdIsGiQNzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiBzdGQ6Ol9fMjo6bnVtX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2RvX2dldF91bnNpZ25lZDx1bnNpZ25lZCBsb25nIGxvbmc+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdW5zaWduZWQgbG9uZyBsb25nJikgY29uc3SMBnp1bnNpZ25lZCBsb25nIGxvbmcgc3RkOjpfXzI6Ol9fbnVtX2dldF91bnNpZ25lZF9pbnRlZ3JhbDx1bnNpZ25lZCBsb25nIGxvbmc+KGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgaW50JiwgaW50KY0GmwJzdGQ6Ol9fMjo6bnVtX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBmbG9hdCYpIGNvbnN0jgb1AnN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+IHN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZG9fZ2V0X2Zsb2F0aW5nX3BvaW50PGZsb2F0PihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGZsb2F0JikgY29uc3SPBlhzdGQ6Ol9fMjo6X19udW1fZ2V0PGNoYXI+OjpfX3N0YWdlMl9mbG9hdF9wcmVwKHN0ZDo6X18yOjppb3NfYmFzZSYsIGNoYXIqLCBjaGFyJiwgY2hhciYpkAbwAXN0ZDo6X18yOjpfX251bV9nZXQ8Y2hhcj46Ol9fc3RhZ2UyX2Zsb2F0X2xvb3AoY2hhciwgYm9vbCYsIGNoYXImLCBjaGFyKiwgY2hhciomLCBjaGFyLCBjaGFyLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0JiwgdW5zaWduZWQgaW50KiwgdW5zaWduZWQgaW50KiYsIHVuc2lnbmVkIGludCYsIGNoYXIqKZEGT2Zsb2F0IHN0ZDo6X18yOjpfX251bV9nZXRfZmxvYXQ8ZmxvYXQ+KGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgaW50JimSBpwCc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgZG91YmxlJikgY29uc3STBvcCc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19kb19nZXRfZmxvYXRpbmdfcG9pbnQ8ZG91YmxlPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGRvdWJsZSYpIGNvbnN0lAZRZG91YmxlIHN0ZDo6X18yOjpfX251bV9nZXRfZmxvYXQ8ZG91YmxlPihjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGludCYplQahAnN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGxvbmcgZG91YmxlJikgY29uc3SWBoEDc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19kb19nZXRfZmxvYXRpbmdfcG9pbnQ8bG9uZyBkb3VibGU+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgbG9uZyBkb3VibGUmKSBjb25zdJcGW2xvbmcgZG91YmxlIHN0ZDo6X18yOjpfX251bV9nZXRfZmxvYXQ8bG9uZyBkb3VibGU+KGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgaW50JimYBpsCc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50Jiwgdm9pZComKSBjb25zdJkGEnN0ZDo6X18yOjpfX2Nsb2MoKZoGTHN0ZDo6X18yOjpfX2xpYmNwcF9zc2NhbmZfbChjaGFyIGNvbnN0KiwgX19sb2NhbGVfc3RydWN0KiwgY2hhciBjb25zdCosIC4uLimbBl9zdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpfX3plcm8oKZwGVGNoYXIgY29uc3QqIHN0ZDo6X18yOjpmaW5kPGNoYXIgY29uc3QqLCBjaGFyPihjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QmKZ0GSXN0ZDo6X18yOjpfX2xpYmNwcF9sb2NhbGVfZ3VhcmQ6Ol9fbGliY3BwX2xvY2FsZV9ndWFyZChfX2xvY2FsZV9zdHJ1Y3QqJimeBq8Cc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgYm9vbCYpIGNvbnN0nwZtc3RkOjpfXzI6Om51bXB1bmN0PHdjaGFyX3Q+IGNvbnN0JiBzdGQ6Ol9fMjo6dXNlX2ZhY2V0PHN0ZDo6X18yOjpudW1wdW5jdDx3Y2hhcl90PiA+KHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKaAG4AVzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+IGNvbnN0KiBzdGQ6Ol9fMjo6X19zY2FuX2tleXdvcmQ8c3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4gY29uc3QqLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+IGNvbnN0Kiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiBjb25zdCosIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYsIHVuc2lnbmVkIGludCYsIGJvb2wpoQavAnN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGxvbmcmKSBjb25zdKIGhgNzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiBzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2RvX2dldF9zaWduZWQ8bG9uZz4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBsb25nJikgY29uc3SjBk1zdGQ6Ol9fMjo6X19udW1fZ2V0PHdjaGFyX3Q+OjpfX2RvX3dpZGVuKHN0ZDo6X18yOjppb3NfYmFzZSYsIHdjaGFyX3QqKSBjb25zdKQGTnN0ZDo6X18yOjpfX251bV9nZXQ8d2NoYXJfdD46Ol9fc3RhZ2UyX2ludF9wcmVwKHN0ZDo6X18yOjppb3NfYmFzZSYsIHdjaGFyX3QmKaUG8QFzdGQ6Ol9fMjo6X19udW1fZ2V0PHdjaGFyX3Q+OjpfX3N0YWdlMl9pbnRfbG9vcCh3Y2hhcl90LCBpbnQsIGNoYXIqLCBjaGFyKiYsIHVuc2lnbmVkIGludCYsIHdjaGFyX3QsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QmLCB1bnNpZ25lZCBpbnQqLCB1bnNpZ25lZCBpbnQqJiwgd2NoYXJfdCBjb25zdCoppga0AnN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGxvbmcgbG9uZyYpIGNvbnN0pwaQA3N0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+IHN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZG9fZ2V0X3NpZ25lZDxsb25nIGxvbmc+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgbG9uZyBsb25nJikgY29uc3SoBrkCc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdW5zaWduZWQgc2hvcnQmKSBjb25zdKkGnANzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiBzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2RvX2dldF91bnNpZ25lZDx1bnNpZ25lZCBzaG9ydD4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB1bnNpZ25lZCBzaG9ydCYpIGNvbnN0qga3AnN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHVuc2lnbmVkIGludCYpIGNvbnN0qwaYA3N0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+IHN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZG9fZ2V0X3Vuc2lnbmVkPHVuc2lnbmVkIGludD4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB1bnNpZ25lZCBpbnQmKSBjb25zdKwGvQJzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB1bnNpZ25lZCBsb25nIGxvbmcmKSBjb25zdK0GpANzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiBzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2RvX2dldF91bnNpZ25lZDx1bnNpZ25lZCBsb25nIGxvbmc+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdW5zaWduZWQgbG9uZyBsb25nJikgY29uc3SuBrACc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgZmxvYXQmKSBjb25zdK8GkANzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiBzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2RvX2dldF9mbG9hdGluZ19wb2ludDxmbG9hdD4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBmbG9hdCYpIGNvbnN0sAZkc3RkOjpfXzI6Ol9fbnVtX2dldDx3Y2hhcl90Pjo6X19zdGFnZTJfZmxvYXRfcHJlcChzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90Kiwgd2NoYXJfdCYsIHdjaGFyX3QmKbEG/wFzdGQ6Ol9fMjo6X19udW1fZ2V0PHdjaGFyX3Q+OjpfX3N0YWdlMl9mbG9hdF9sb29wKHdjaGFyX3QsIGJvb2wmLCBjaGFyJiwgY2hhciosIGNoYXIqJiwgd2NoYXJfdCwgd2NoYXJfdCwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCYsIHVuc2lnbmVkIGludCosIHVuc2lnbmVkIGludComLCB1bnNpZ25lZCBpbnQmLCB3Y2hhcl90KimyBrECc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgZG91YmxlJikgY29uc3SzBpIDc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19kb19nZXRfZmxvYXRpbmdfcG9pbnQ8ZG91YmxlPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGRvdWJsZSYpIGNvbnN0tAa2AnN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGxvbmcgZG91YmxlJikgY29uc3S1BpwDc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19kb19nZXRfZmxvYXRpbmdfcG9pbnQ8bG9uZyBkb3VibGU+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgbG9uZyBkb3VibGUmKSBjb25zdLYGsAJzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB2b2lkKiYpIGNvbnN0twZmd2NoYXJfdCBjb25zdCogc3RkOjpfXzI6OmZpbmQ8d2NoYXJfdCBjb25zdCosIHdjaGFyX3Q+KHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdCYpuAZnd2NoYXJfdCBjb25zdCogc3RkOjpfXzI6Ol9fbnVtX2dldDx3Y2hhcl90Pjo6X19kb193aWRlbl9wPHdjaGFyX3Q+KHN0ZDo6X18yOjppb3NfYmFzZSYsIHdjaGFyX3QqKSBjb25zdLkGzQFzdGQ6Ol9fMjo6bnVtX3B1dDxjaGFyLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIGNoYXIsIGJvb2wpIGNvbnN0ugZec3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6YmVnaW4oKbsGXHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OmVuZCgpvAbNAXN0ZDo6X18yOjpudW1fcHV0PGNoYXIsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgY2hhciwgbG9uZykgY29uc3S9Bk5zdGQ6Ol9fMjo6X19udW1fcHV0X2Jhc2U6Ol9fZm9ybWF0X2ludChjaGFyKiwgY2hhciBjb25zdCosIGJvb2wsIHVuc2lnbmVkIGludCm+BldzdGQ6Ol9fMjo6X19saWJjcHBfc25wcmludGZfbChjaGFyKiwgdW5zaWduZWQgbG9uZywgX19sb2NhbGVfc3RydWN0KiwgY2hhciBjb25zdCosIC4uLim/BlVzdGQ6Ol9fMjo6X19udW1fcHV0X2Jhc2U6Ol9faWRlbnRpZnlfcGFkZGluZyhjaGFyKiwgY2hhciosIHN0ZDo6X18yOjppb3NfYmFzZSBjb25zdCYpwAZ1c3RkOjpfXzI6Ol9fbnVtX3B1dDxjaGFyPjo6X193aWRlbl9hbmRfZ3JvdXBfaW50KGNoYXIqLCBjaGFyKiwgY2hhciosIGNoYXIqLCBjaGFyKiYsIGNoYXIqJiwgc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYpwQYrdm9pZCBzdGQ6Ol9fMjo6cmV2ZXJzZTxjaGFyKj4oY2hhciosIGNoYXIqKcIGIXN0ZDo6X18yOjppb3NfYmFzZTo6d2lkdGgoKSBjb25zdMMG0gFzdGQ6Ol9fMjo6bnVtX3B1dDxjaGFyLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIGNoYXIsIGxvbmcgbG9uZykgY29uc3TEBtYBc3RkOjpfXzI6Om51bV9wdXQ8Y2hhciwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCBjaGFyLCB1bnNpZ25lZCBsb25nKSBjb25zdMUG2wFzdGQ6Ol9fMjo6bnVtX3B1dDxjaGFyLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIGNoYXIsIHVuc2lnbmVkIGxvbmcgbG9uZykgY29uc3TGBs8Bc3RkOjpfXzI6Om51bV9wdXQ8Y2hhciwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCBjaGFyLCBkb3VibGUpIGNvbnN0xwZKc3RkOjpfXzI6Ol9fbnVtX3B1dF9iYXNlOjpfX2Zvcm1hdF9mbG9hdChjaGFyKiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGludCnIBiVzdGQ6Ol9fMjo6aW9zX2Jhc2U6OnByZWNpc2lvbigpIGNvbnN0yQZJc3RkOjpfXzI6Ol9fbGliY3BwX2FzcHJpbnRmX2woY2hhcioqLCBfX2xvY2FsZV9zdHJ1Y3QqLCBjaGFyIGNvbnN0KiwgLi4uKcoGd3N0ZDo6X18yOjpfX251bV9wdXQ8Y2hhcj46Ol9fd2lkZW5fYW5kX2dyb3VwX2Zsb2F0KGNoYXIqLCBjaGFyKiwgY2hhciosIGNoYXIqLCBjaGFyKiYsIGNoYXIqJiwgc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYpywbUAXN0ZDo6X18yOjpudW1fcHV0PGNoYXIsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgY2hhciwgbG9uZyBkb3VibGUpIGNvbnN0zAbUAXN0ZDo6X18yOjpudW1fcHV0PGNoYXIsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgY2hhciwgdm9pZCBjb25zdCopIGNvbnN0zQbfAXN0ZDo6X18yOjpudW1fcHV0PHdjaGFyX3QsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgd2NoYXJfdCwgYm9vbCkgY29uc3TOBmVzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+OjplbmQoKc8G3wFzdGQ6Ol9fMjo6bnVtX3B1dDx3Y2hhcl90LCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHdjaGFyX3QsIGxvbmcpIGNvbnN00AaBAXN0ZDo6X18yOjpfX251bV9wdXQ8d2NoYXJfdD46Ol9fd2lkZW5fYW5kX2dyb3VwX2ludChjaGFyKiwgY2hhciosIGNoYXIqLCB3Y2hhcl90Kiwgd2NoYXJfdComLCB3Y2hhcl90KiYsIHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKdEGowJzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiBzdGQ6Ol9fMjo6X19wYWRfYW5kX291dHB1dDx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPihzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgd2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0Kiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgd2NoYXJfdCnSBjR2b2lkIHN0ZDo6X18yOjpyZXZlcnNlPHdjaGFyX3QqPih3Y2hhcl90Kiwgd2NoYXJfdCop0waEAXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID46OmJhc2ljX3N0cmluZyh1bnNpZ25lZCBsb25nLCB3Y2hhcl90KdQG5AFzdGQ6Ol9fMjo6bnVtX3B1dDx3Y2hhcl90LCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHdjaGFyX3QsIGxvbmcgbG9uZykgY29uc3TVBugBc3RkOjpfXzI6Om51bV9wdXQ8d2NoYXJfdCwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90LCB1bnNpZ25lZCBsb25nKSBjb25zdNYG7QFzdGQ6Ol9fMjo6bnVtX3B1dDx3Y2hhcl90LCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHdjaGFyX3QsIHVuc2lnbmVkIGxvbmcgbG9uZykgY29uc3TXBuEBc3RkOjpfXzI6Om51bV9wdXQ8d2NoYXJfdCwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90LCBkb3VibGUpIGNvbnN02AaDAXN0ZDo6X18yOjpfX251bV9wdXQ8d2NoYXJfdD46Ol9fd2lkZW5fYW5kX2dyb3VwX2Zsb2F0KGNoYXIqLCBjaGFyKiwgY2hhciosIHdjaGFyX3QqLCB3Y2hhcl90KiYsIHdjaGFyX3QqJiwgc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYp2QbmAXN0ZDo6X18yOjpudW1fcHV0PHdjaGFyX3QsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgd2NoYXJfdCwgbG9uZyBkb3VibGUpIGNvbnN02gbmAXN0ZDo6X18yOjpudW1fcHV0PHdjaGFyX3QsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgd2NoYXJfdCwgdm9pZCBjb25zdCopIGNvbnN02wZTdm9pZCBzdGQ6Ol9fMjo6X19yZXZlcnNlPGNoYXIqPihjaGFyKiwgY2hhciosIHN0ZDo6X18yOjpyYW5kb21fYWNjZXNzX2l0ZXJhdG9yX3RhZyncBlx2b2lkIHN0ZDo6X18yOjpfX3JldmVyc2U8d2NoYXJfdCo+KHdjaGFyX3QqLCB3Y2hhcl90Kiwgc3RkOjpfXzI6OnJhbmRvbV9hY2Nlc3NfaXRlcmF0b3JfdGFnKd0GsAJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6Z2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdG0qLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdCopIGNvbnN03gZzc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2RhdGVfb3JkZXIoKSBjb25zdN8GngJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0X3RpbWUoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB0bSopIGNvbnN04AaeAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXRfZGF0ZShzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHRtKikgY29uc3ThBqECc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldF93ZWVrZGF5KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdG0qKSBjb25zdOIGrwJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfd2Vla2RheW5hbWUoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JikgY29uc3TjBqMCc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldF9tb250aG5hbWUoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB0bSopIGNvbnN05AatAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2dldF9tb250aG5hbWUoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JikgY29uc3TlBp4Cc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldF95ZWFyKHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdG0qKSBjb25zdOYGqAJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfeWVhcihpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdOcGpQJpbnQgc3RkOjpfXzI6Ol9fZ2V0X3VwX3RvX25fZGlnaXRzPGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JiwgaW50KegGpQJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdG0qLCBjaGFyLCBjaGFyKSBjb25zdOkGpQJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfcGVyY2VudChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdOoGpwJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfZGF5KGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYpIGNvbnN06waoAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2dldF9ob3VyKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYpIGNvbnN07AarAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2dldF8xMl9ob3VyKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYpIGNvbnN07QawAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2dldF9kYXlfeWVhcl9udW0oaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JikgY29uc3TuBqkCc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0X21vbnRoKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYpIGNvbnN07waqAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2dldF9taW51dGUoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JikgY29uc3TwBqkCc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0X3doaXRlX3NwYWNlKHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYpIGNvbnN08QapAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2dldF9hbV9wbShpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdPIGqgJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfc2Vjb25kKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYpIGNvbnN08warAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2dldF93ZWVrZGF5KGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYpIGNvbnN09AapAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2dldF95ZWFyNChpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdPUGywJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6Z2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdG0qLCB3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdCopIGNvbnN09gazAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXRfdGltZShzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHRtKikgY29uc3T3BrMCc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldF9kYXRlKHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdG0qKSBjb25zdPgGtgJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0X3dlZWtkYXkoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB0bSopIGNvbnN0+QbHAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF93ZWVrZGF5bmFtZShpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmKSBjb25zdPoGuAJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0X21vbnRobmFtZShzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHRtKikgY29uc3T7BsUCc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZ2V0X21vbnRobmFtZShpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmKSBjb25zdPwGswJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0X3llYXIoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB0bSopIGNvbnN0/QbAAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF95ZWFyKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN0/ga9AmludCBzdGQ6Ol9fMjo6X19nZXRfdXBfdG9fbl9kaWdpdHM8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmLCBpbnQp/wa6AnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB0bSosIGNoYXIsIGNoYXIpIGNvbnN0gAe9AnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF9wZXJjZW50KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN0gQe/AnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF9kYXkoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JikgY29uc3SCB8ACc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZ2V0X2hvdXIoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JikgY29uc3SDB8MCc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZ2V0XzEyX2hvdXIoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JikgY29uc3SEB8gCc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZ2V0X2RheV95ZWFyX251bShpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmKSBjb25zdIUHwQJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfbW9udGgoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JikgY29uc3SGB8ICc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZ2V0X21pbnV0ZShpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmKSBjb25zdIcHwQJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfd2hpdGVfc3BhY2Uoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JikgY29uc3SIB8ECc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZ2V0X2FtX3BtKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN0iQfCAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF9zZWNvbmQoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JikgY29uc3SKB8MCc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZ2V0X3dlZWtkYXkoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JikgY29uc3SLB8ECc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZ2V0X3llYXI0KGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN0jAffAXN0ZDo6X18yOjp0aW1lX3B1dDxjaGFyLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIGNoYXIsIHRtIGNvbnN0KiwgY2hhciwgY2hhcikgY29uc3SNB0pzdGQ6Ol9fMjo6X190aW1lX3B1dDo6X19kb19wdXQoY2hhciosIGNoYXIqJiwgdG0gY29uc3QqLCBjaGFyLCBjaGFyKSBjb25zdI4HjQFzdGQ6Ol9fMjo6ZW5hYmxlX2lmPChpc19tb3ZlX2NvbnN0cnVjdGlibGU8Y2hhcj46OnZhbHVlKSAmJiAoaXNfbW92ZV9hc3NpZ25hYmxlPGNoYXI+Ojp2YWx1ZSksIHZvaWQ+Ojp0eXBlIHN0ZDo6X18yOjpzd2FwPGNoYXI+KGNoYXImLCBjaGFyJimPB+4Bc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gc3RkOjpfXzI6Ol9fY29weTxjaGFyKiwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPihjaGFyKiwgY2hhciosIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+KZAH8QFzdGQ6Ol9fMjo6dGltZV9wdXQ8d2NoYXJfdCwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90LCB0bSBjb25zdCosIGNoYXIsIGNoYXIpIGNvbnN0kQdQc3RkOjpfXzI6Ol9fdGltZV9wdXQ6Ol9fZG9fcHV0KHdjaGFyX3QqLCB3Y2hhcl90KiYsIHRtIGNvbnN0KiwgY2hhciwgY2hhcikgY29uc3SSB2VzdGQ6Ol9fMjo6X19saWJjcHBfbWJzcnRvd2NzX2wod2NoYXJfdCosIGNoYXIgY29uc3QqKiwgdW5zaWduZWQgbG9uZywgX19tYnN0YXRlX3QqLCBfX2xvY2FsZV9zdHJ1Y3QqKZMHLHN0ZDo6X18yOjpfX3Rocm93X3J1bnRpbWVfZXJyb3IoY2hhciBjb25zdCoplAeJAnN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+IHN0ZDo6X18yOjpfX2NvcHk8d2NoYXJfdCosIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID4od2NoYXJfdCosIHdjaGFyX3QqLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPimVBztzdGQ6Ol9fMjo6bW9uZXlwdW5jdDxjaGFyLCBmYWxzZT46OmRvX2RlY2ltYWxfcG9pbnQoKSBjb25zdJYHNnN0ZDo6X18yOjptb25leXB1bmN0PGNoYXIsIGZhbHNlPjo6ZG9fZ3JvdXBpbmcoKSBjb25zdJcHO3N0ZDo6X18yOjptb25leXB1bmN0PGNoYXIsIGZhbHNlPjo6ZG9fbmVnYXRpdmVfc2lnbigpIGNvbnN0mAc4c3RkOjpfXzI6Om1vbmV5cHVuY3Q8Y2hhciwgZmFsc2U+Ojpkb19wb3NfZm9ybWF0KCkgY29uc3SZBz5zdGQ6Ol9fMjo6bW9uZXlwdW5jdDx3Y2hhcl90LCBmYWxzZT46OmRvX2RlY2ltYWxfcG9pbnQoKSBjb25zdJoHPnN0ZDo6X18yOjptb25leXB1bmN0PHdjaGFyX3QsIGZhbHNlPjo6ZG9fbmVnYXRpdmVfc2lnbigpIGNvbnN0mwepAnN0ZDo6X18yOjptb25leV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgYm9vbCwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgbG9uZyBkb3VibGUmKSBjb25zdJwHjANzdGQ6Ol9fMjo6bW9uZXlfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIGJvb2wsIHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmLCB1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCYsIGJvb2wmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmLCBzdGQ6Ol9fMjo6dW5pcXVlX3B0cjxjaGFyLCB2b2lkICgqKSh2b2lkKik+JiwgY2hhciomLCBjaGFyKimdB90Dc3RkOjpfXzI6Ol9fbW9uZXlfZ2V0PGNoYXI+OjpfX2dhdGhlcl9pbmZvKGJvb2wsIHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmLCBzdGQ6Ol9fMjo6bW9uZXlfYmFzZTo6cGF0dGVybiYsIGNoYXImLCBjaGFyJiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiYsIGludCYpngdSc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46Om9wZXJhdG9yKysoaW50KZ8HZnZvaWQgc3RkOjpfXzI6Ol9fZG91YmxlX29yX25vdGhpbmc8Y2hhcj4oc3RkOjpfXzI6OnVuaXF1ZV9wdHI8Y2hhciwgdm9pZCAoKikodm9pZCopPiYsIGNoYXIqJiwgY2hhciomKaAHhgF2b2lkIHN0ZDo6X18yOjpfX2RvdWJsZV9vcl9ub3RoaW5nPHVuc2lnbmVkIGludD4oc3RkOjpfXzI6OnVuaXF1ZV9wdHI8dW5zaWduZWQgaW50LCB2b2lkICgqKSh2b2lkKik+JiwgdW5zaWduZWQgaW50KiYsIHVuc2lnbmVkIGludComKaEH8wJzdGQ6Ol9fMjo6bW9uZXlfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIGJvb2wsIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4mKSBjb25zdKIHXnN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OmNsZWFyKCmjB9oBc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiYgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6X19hcHBlbmRfZm9yd2FyZF91bnNhZmU8Y2hhcio+KGNoYXIqLCBjaGFyKimkB3dzdGQ6Ol9fMjo6bW9uZXlwdW5jdDxjaGFyLCB0cnVlPiBjb25zdCYgc3RkOjpfXzI6OnVzZV9mYWNldDxzdGQ6Ol9fMjo6bW9uZXlwdW5jdDxjaGFyLCB0cnVlPiA+KHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKaUHuQFzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpvcGVyYXRvcj0oc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiYmKaYHeXN0ZDo6X18yOjptb25leXB1bmN0PGNoYXIsIGZhbHNlPiBjb25zdCYgc3RkOjpfXzI6OnVzZV9mYWNldDxzdGQ6Ol9fMjo6bW9uZXlwdW5jdDxjaGFyLCBmYWxzZT4gPihzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JimnB+8BYm9vbCBzdGQ6Ol9fMjo6ZXF1YWw8c3RkOjpfXzI6Ol9fd3JhcF9pdGVyPGNoYXIqPiwgc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPGNoYXIqPiwgc3RkOjpfXzI6Ol9fZXF1YWxfdG88Y2hhciwgY2hhcj4gPihzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8Y2hhcio+LCBzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8Y2hhcio+LCBzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8Y2hhcio+LCBzdGQ6Ol9fMjo6X19lcXVhbF90bzxjaGFyLCBjaGFyPimoBzNzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8Y2hhcio+OjpvcGVyYXRvcisobG9uZykgY29uc3SpB2VzdGQ6Ol9fMjo6dW5pcXVlX3B0cjxjaGFyLCB2b2lkICgqKSh2b2lkKik+OjpvcGVyYXRvcj0oc3RkOjpfXzI6OnVuaXF1ZV9wdHI8Y2hhciwgdm9pZCAoKikodm9pZCopPiYmKaoHvgJzdGQ6Ol9fMjo6bW9uZXlfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIGJvb2wsIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGxvbmcgZG91YmxlJikgY29uc3SrB60Dc3RkOjpfXzI6Om1vbmV5X2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2RvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBib29sLCBzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JiwgdW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQmLCBib29sJiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0Jiwgc3RkOjpfXzI6OnVuaXF1ZV9wdHI8d2NoYXJfdCwgdm9pZCAoKikodm9pZCopPiYsIHdjaGFyX3QqJiwgd2NoYXJfdCoprAeBBHN0ZDo6X18yOjpfX21vbmV5X2dldDx3Y2hhcl90Pjo6X19nYXRoZXJfaW5mbyhib29sLCBzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0Jiwgc3RkOjpfXzI6Om1vbmV5X2Jhc2U6OnBhdHRlcm4mLCB3Y2hhcl90Jiwgd2NoYXJfdCYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4mLCBpbnQmKa0HWHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+OjpvcGVyYXRvcisrKGludCmuB5EDc3RkOjpfXzI6Om1vbmV5X2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBib29sLCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+JikgY29uc3SvB2dzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+OjpjbGVhcigpsAf1AXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4mIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID46Ol9fYXBwZW5kX2ZvcndhcmRfdW5zYWZlPHdjaGFyX3QqPih3Y2hhcl90Kiwgd2NoYXJfdCopsQd9c3RkOjpfXzI6Om1vbmV5cHVuY3Q8d2NoYXJfdCwgdHJ1ZT4gY29uc3QmIHN0ZDo6X18yOjp1c2VfZmFjZXQ8c3RkOjpfXzI6Om1vbmV5cHVuY3Q8d2NoYXJfdCwgdHJ1ZT4gPihzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JimyB8sBc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6b3BlcmF0b3I9KHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4mJimzB39zdGQ6Ol9fMjo6bW9uZXlwdW5jdDx3Y2hhcl90LCBmYWxzZT4gY29uc3QmIHN0ZDo6X18yOjp1c2VfZmFjZXQ8c3RkOjpfXzI6Om1vbmV5cHVuY3Q8d2NoYXJfdCwgZmFsc2U+ID4oc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYptAeKAmJvb2wgc3RkOjpfXzI6OmVxdWFsPHN0ZDo6X18yOjpfX3dyYXBfaXRlcjx3Y2hhcl90Kj4sIHN0ZDo6X18yOjpfX3dyYXBfaXRlcjx3Y2hhcl90Kj4sIHN0ZDo6X18yOjpfX2VxdWFsX3RvPHdjaGFyX3QsIHdjaGFyX3Q+ID4oc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPHdjaGFyX3QqPiwgc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPHdjaGFyX3QqPiwgc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPHdjaGFyX3QqPiwgc3RkOjpfXzI6Ol9fZXF1YWxfdG88d2NoYXJfdCwgd2NoYXJfdD4ptQc2c3RkOjpfXzI6Ol9fd3JhcF9pdGVyPHdjaGFyX3QqPjo6b3BlcmF0b3IrKGxvbmcpIGNvbnN0tgfcAXN0ZDo6X18yOjptb25leV9wdXQ8Y2hhciwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBib29sLCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCBjaGFyLCBsb25nIGRvdWJsZSkgY29uc3S3B4sDc3RkOjpfXzI6Ol9fbW9uZXlfcHV0PGNoYXI+OjpfX2dhdGhlcl9pbmZvKGJvb2wsIGJvb2wsIHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmLCBzdGQ6Ol9fMjo6bW9uZXlfYmFzZTo6cGF0dGVybiYsIGNoYXImLCBjaGFyJiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+JiwgaW50Jim4B9kDc3RkOjpfXzI6Ol9fbW9uZXlfcHV0PGNoYXI+OjpfX2Zvcm1hdChjaGFyKiwgY2hhciomLCBjaGFyKiYsIHVuc2lnbmVkIGludCwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmLCBib29sLCBzdGQ6Ol9fMjo6bW9uZXlfYmFzZTo6cGF0dGVybiBjb25zdCYsIGNoYXIsIGNoYXIsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QmLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCYsIGludCm5B44BY2hhciogc3RkOjpfXzI6OmNvcHk8c3RkOjpfXzI6Ol9fd3JhcF9pdGVyPGNoYXIgY29uc3QqPiwgY2hhcio+KHN0ZDo6X18yOjpfX3dyYXBfaXRlcjxjaGFyIGNvbnN0Kj4sIHN0ZDo6X18yOjpfX3dyYXBfaXRlcjxjaGFyIGNvbnN0Kj4sIGNoYXIqKboHrQJzdGQ6Ol9fMjo6bW9uZXlfcHV0PGNoYXIsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgYm9vbCwgc3RkOjpfXzI6Omlvc19iYXNlJiwgY2hhciwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCYpIGNvbnN0uwfuAXN0ZDo6X18yOjptb25leV9wdXQ8d2NoYXJfdCwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBib29sLCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90LCBsb25nIGRvdWJsZSkgY29uc3S8B6YDc3RkOjpfXzI6Ol9fbW9uZXlfcHV0PHdjaGFyX3Q+OjpfX2dhdGhlcl9pbmZvKGJvb2wsIGJvb2wsIHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmLCBzdGQ6Ol9fMjo6bW9uZXlfYmFzZTo6cGF0dGVybiYsIHdjaGFyX3QmLCB3Y2hhcl90Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+JiwgaW50Jim9B4YEc3RkOjpfXzI6Ol9fbW9uZXlfcHV0PHdjaGFyX3Q+OjpfX2Zvcm1hdCh3Y2hhcl90Kiwgd2NoYXJfdComLCB3Y2hhcl90KiYsIHVuc2lnbmVkIGludCwgd2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmLCBib29sLCBzdGQ6Ol9fMjo6bW9uZXlfYmFzZTo6cGF0dGVybiBjb25zdCYsIHdjaGFyX3QsIHdjaGFyX3QsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QmLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+IGNvbnN0Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiBjb25zdCYsIGludCm+B6ABd2NoYXJfdCogc3RkOjpfXzI6OmNvcHk8c3RkOjpfXzI6Ol9fd3JhcF9pdGVyPHdjaGFyX3QgY29uc3QqPiwgd2NoYXJfdCo+KHN0ZDo6X18yOjpfX3dyYXBfaXRlcjx3Y2hhcl90IGNvbnN0Kj4sIHN0ZDo6X18yOjpfX3dyYXBfaXRlcjx3Y2hhcl90IGNvbnN0Kj4sIHdjaGFyX3QqKb8HyAJzdGQ6Ol9fMjo6bW9uZXlfcHV0PHdjaGFyX3QsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgYm9vbCwgc3RkOjpfXzI6Omlvc19iYXNlJiwgd2NoYXJfdCwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiBjb25zdCYpIGNvbnN0wAeQAWNoYXIqIHN0ZDo6X18yOjpfX2NvcHk8c3RkOjpfXzI6Ol9fd3JhcF9pdGVyPGNoYXIgY29uc3QqPiwgY2hhcio+KHN0ZDo6X18yOjpfX3dyYXBfaXRlcjxjaGFyIGNvbnN0Kj4sIHN0ZDo6X18yOjpfX3dyYXBfaXRlcjxjaGFyIGNvbnN0Kj4sIGNoYXIqKcEHogF3Y2hhcl90KiBzdGQ6Ol9fMjo6X19jb3B5PHN0ZDo6X18yOjpfX3dyYXBfaXRlcjx3Y2hhcl90IGNvbnN0Kj4sIHdjaGFyX3QqPihzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8d2NoYXJfdCBjb25zdCo+LCBzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8d2NoYXJfdCBjb25zdCo+LCB3Y2hhcl90KinCB54Bc3RkOjpfXzI6Om1lc3NhZ2VzPGNoYXI+Ojpkb19vcGVuKHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QmLCBzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JikgY29uc3TDB5QBc3RkOjpfXzI6Om1lc3NhZ2VzPGNoYXI+Ojpkb19nZXQobG9uZywgaW50LCBpbnQsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QmKSBjb25zdMQHuANzdGQ6Ol9fMjo6YmFja19pbnNlcnRfaXRlcmF0b3I8c3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiA+IHN0ZDo6X18yOjpfX25hcnJvd190b191dGY4PDh1bD46Om9wZXJhdG9yKCk8c3RkOjpfXzI6OmJhY2tfaW5zZXJ0X2l0ZXJhdG9yPHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gPiwgY2hhcj4oc3RkOjpfXzI6OmJhY2tfaW5zZXJ0X2l0ZXJhdG9yPHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gPiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqKSBjb25zdMUHjgFzdGQ6Ol9fMjo6YmFja19pbnNlcnRfaXRlcmF0b3I8c3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiA+OjpvcGVyYXRvcj0oY2hhciBjb25zdCYpxgegAXN0ZDo6X18yOjptZXNzYWdlczx3Y2hhcl90Pjo6ZG9fZ2V0KGxvbmcsIGludCwgaW50LCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+IGNvbnN0JikgY29uc3THB8IDc3RkOjpfXzI6OmJhY2tfaW5zZXJ0X2l0ZXJhdG9yPHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gPiBzdGQ6Ol9fMjo6X19uYXJyb3dfdG9fdXRmODwzMnVsPjo6b3BlcmF0b3IoKTxzdGQ6Ol9fMjo6YmFja19pbnNlcnRfaXRlcmF0b3I8c3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiA+LCB3Y2hhcl90PihzdGQ6Ol9fMjo6YmFja19pbnNlcnRfaXRlcmF0b3I8c3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiA+LCB3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdCopIGNvbnN0yAfQA3N0ZDo6X18yOjpiYWNrX2luc2VydF9pdGVyYXRvcjxzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+ID4gc3RkOjpfXzI6Ol9fd2lkZW5fZnJvbV91dGY4PDMydWw+OjpvcGVyYXRvcigpPHN0ZDo6X18yOjpiYWNrX2luc2VydF9pdGVyYXRvcjxzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+ID4gPihzdGQ6Ol9fMjo6YmFja19pbnNlcnRfaXRlcmF0b3I8c3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiA+LCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdCopIGNvbnN0yQc5c3RkOjpfXzI6OmNvZGVjdnQ8d2NoYXJfdCwgY2hhciwgX19tYnN0YXRlX3Q+Ojp+Y29kZWN2dCgpygctc3RkOjpfXzI6OmxvY2FsZTo6X19pbXA6Ol9faW1wKHVuc2lnbmVkIGxvbmcpywd+c3RkOjpfXzI6Ol9fdmVjdG9yX2Jhc2U8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4gPjo6X192ZWN0b3JfYmFzZSgpzAeCAXN0ZDo6X18yOjp2ZWN0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4gPjo6X192YWxsb2NhdGUodW5zaWduZWQgbG9uZynNB4kBc3RkOjpfXzI6OnZlY3RvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiA+OjpfX2NvbnN0cnVjdF9hdF9lbmQodW5zaWduZWQgbG9uZynOB3ZzdGQ6Ol9fMjo6X192ZWN0b3JfYmFzZTxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiA+OjpjbGVhcigpzweOAXN0ZDo6X18yOjp2ZWN0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4gPjo6X19hbm5vdGF0ZV9zaHJpbmsodW5zaWduZWQgbG9uZykgY29uc3TQBx1zdGQ6Ol9fMjo6bG9jYWxlOjppZDo6X19nZXQoKdEHQHN0ZDo6X18yOjpsb2NhbGU6Ol9faW1wOjppbnN0YWxsKHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgbG9uZynSB0hzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj46OmN0eXBlKHVuc2lnbmVkIHNob3J0IGNvbnN0KiwgYm9vbCwgdW5zaWduZWQgbG9uZynTBxtzdGQ6Ol9fMjo6bG9jYWxlOjpjbGFzc2ljKCnUB31zdGQ6Ol9fMjo6dmVjdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46OnJlc2l6ZSh1bnNpZ25lZCBsb25nKdUHIXN0ZDo6X18yOjpsb2NhbGU6Ol9faW1wOjp+X19pbXAoKdYHgQFzdGQ6Ol9fMjo6dmVjdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46Ol9fYW5ub3RhdGVfZGVsZXRlKCkgY29uc3TXByNzdGQ6Ol9fMjo6bG9jYWxlOjpfX2ltcDo6fl9faW1wKCkuMdgHf3N0ZDo6X18yOjp2ZWN0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4gPjo6X19hcHBlbmQodW5zaWduZWQgbG9uZynZBxxzdGQ6Ol9fMjo6bG9jYWxlOjpfX2dsb2JhbCgp2gcac3RkOjpfXzI6OmxvY2FsZTo6bG9jYWxlKCnbBy5zdGQ6Ol9fMjo6bG9jYWxlOjpfX2ltcDo6aGFzX2ZhY2V0KGxvbmcpIGNvbnN03Acec3RkOjpfXzI6OmxvY2FsZTo6aWQ6Ol9faW5pdCgp3QeMAXZvaWQgc3RkOjpfXzI6OmNhbGxfb25jZTxzdGQ6Ol9fMjo6KGFub255bW91cyBuYW1lc3BhY2UpOjpfX2Zha2VfYmluZD4oc3RkOjpfXzI6Om9uY2VfZmxhZyYsIHN0ZDo6X18yOjooYW5vbnltb3VzIG5hbWVzcGFjZSk6Ol9fZmFrZV9iaW5kJiYp3gcrc3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQ6Ol9fb25femVyb19zaGFyZWQoKd8HaXZvaWQgc3RkOjpfXzI6Ol9fY2FsbF9vbmNlX3Byb3h5PHN0ZDo6X18yOjp0dXBsZTxzdGQ6Ol9fMjo6KGFub255bW91cyBuYW1lc3BhY2UpOjpfX2Zha2VfYmluZCYmPiA+KHZvaWQqKeAHPnN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90Pjo6ZG9faXModW5zaWduZWQgc2hvcnQsIHdjaGFyX3QpIGNvbnN04QdWc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+Ojpkb19pcyh3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdCosIHVuc2lnbmVkIHNob3J0KikgY29uc3TiB1pzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD46OmRvX3NjYW5faXModW5zaWduZWQgc2hvcnQsIHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0KikgY29uc3TjB1tzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD46OmRvX3NjYW5fbm90KHVuc2lnbmVkIHNob3J0LCB3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdCopIGNvbnN05Aczc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+Ojpkb190b3VwcGVyKHdjaGFyX3QpIGNvbnN05QdEc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+Ojpkb190b3VwcGVyKHdjaGFyX3QqLCB3Y2hhcl90IGNvbnN0KikgY29uc3TmBzNzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD46OmRvX3RvbG93ZXIod2NoYXJfdCkgY29uc3TnB0RzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD46OmRvX3RvbG93ZXIod2NoYXJfdCosIHdjaGFyX3QgY29uc3QqKSBjb25zdOgHLnN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90Pjo6ZG9fd2lkZW4oY2hhcikgY29uc3TpB0xzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD46OmRvX3dpZGVuKGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0Kiwgd2NoYXJfdCopIGNvbnN06gc4c3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+Ojpkb19uYXJyb3cod2NoYXJfdCwgY2hhcikgY29uc3TrB1ZzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD46OmRvX25hcnJvdyh3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdCosIGNoYXIsIGNoYXIqKSBjb25zdOwHH3N0ZDo6X18yOjpjdHlwZTxjaGFyPjo6fmN0eXBlKCntByFzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj46On5jdHlwZSgpLjHuBy1zdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj46OmRvX3RvdXBwZXIoY2hhcikgY29uc3TvBztzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj46OmRvX3RvdXBwZXIoY2hhciosIGNoYXIgY29uc3QqKSBjb25zdPAHLXN0ZDo6X18yOjpjdHlwZTxjaGFyPjo6ZG9fdG9sb3dlcihjaGFyKSBjb25zdPEHO3N0ZDo6X18yOjpjdHlwZTxjaGFyPjo6ZG9fdG9sb3dlcihjaGFyKiwgY2hhciBjb25zdCopIGNvbnN08gdGc3RkOjpfXzI6OmN0eXBlPGNoYXI+Ojpkb193aWRlbihjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIGNoYXIqKSBjb25zdPMHMnN0ZDo6X18yOjpjdHlwZTxjaGFyPjo6ZG9fbmFycm93KGNoYXIsIGNoYXIpIGNvbnN09AdNc3RkOjpfXzI6OmN0eXBlPGNoYXI+Ojpkb19uYXJyb3coY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCBjaGFyLCBjaGFyKikgY29uc3T1B4QBc3RkOjpfXzI6OmNvZGVjdnQ8Y2hhciwgY2hhciwgX19tYnN0YXRlX3Q+Ojpkb19vdXQoX19tYnN0YXRlX3QmLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqJiwgY2hhciosIGNoYXIqLCBjaGFyKiYpIGNvbnN09gdgc3RkOjpfXzI6OmNvZGVjdnQ8Y2hhciwgY2hhciwgX19tYnN0YXRlX3Q+Ojpkb191bnNoaWZ0KF9fbWJzdGF0ZV90JiwgY2hhciosIGNoYXIqLCBjaGFyKiYpIGNvbnN09wdyc3RkOjpfXzI6OmNvZGVjdnQ8Y2hhciwgY2hhciwgX19tYnN0YXRlX3Q+Ojpkb19sZW5ndGgoX19tYnN0YXRlX3QmLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGxvbmcpIGNvbnN0+Ac7c3RkOjpfXzI6OmNvZGVjdnQ8d2NoYXJfdCwgY2hhciwgX19tYnN0YXRlX3Q+Ojp+Y29kZWN2dCgpLjH5B5ABc3RkOjpfXzI6OmNvZGVjdnQ8d2NoYXJfdCwgY2hhciwgX19tYnN0YXRlX3Q+Ojpkb19vdXQoX19tYnN0YXRlX3QmLCB3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqJiwgY2hhciosIGNoYXIqLCBjaGFyKiYpIGNvbnN0+gd1c3RkOjpfXzI6Ol9fbGliY3BwX3djc25ydG9tYnNfbChjaGFyKiwgd2NoYXJfdCBjb25zdCoqLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCBfX21ic3RhdGVfdCosIF9fbG9jYWxlX3N0cnVjdCop+wdMc3RkOjpfXzI6Ol9fbGliY3BwX3djcnRvbWJfbChjaGFyKiwgd2NoYXJfdCwgX19tYnN0YXRlX3QqLCBfX2xvY2FsZV9zdHJ1Y3QqKfwHjwFzdGQ6Ol9fMjo6Y29kZWN2dDx3Y2hhcl90LCBjaGFyLCBfX21ic3RhdGVfdD46OmRvX2luKF9fbWJzdGF0ZV90JiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiYsIHdjaGFyX3QqLCB3Y2hhcl90Kiwgd2NoYXJfdComKSBjb25zdP0HdXN0ZDo6X18yOjpfX2xpYmNwcF9tYnNucnRvd2NzX2wod2NoYXJfdCosIGNoYXIgY29uc3QqKiwgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgX19tYnN0YXRlX3QqLCBfX2xvY2FsZV9zdHJ1Y3QqKf4HYnN0ZDo6X18yOjpfX2xpYmNwcF9tYnJ0b3djX2wod2NoYXJfdCosIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBsb25nLCBfX21ic3RhdGVfdCosIF9fbG9jYWxlX3N0cnVjdCop/wdjc3RkOjpfXzI6OmNvZGVjdnQ8d2NoYXJfdCwgY2hhciwgX19tYnN0YXRlX3Q+Ojpkb191bnNoaWZ0KF9fbWJzdGF0ZV90JiwgY2hhciosIGNoYXIqLCBjaGFyKiYpIGNvbnN0gAhCc3RkOjpfXzI6OmNvZGVjdnQ8d2NoYXJfdCwgY2hhciwgX19tYnN0YXRlX3Q+Ojpkb19lbmNvZGluZygpIGNvbnN0gQhTc3RkOjpfXzI6Ol9fbGliY3BwX21idG93Y19sKHdjaGFyX3QqLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgbG9uZywgX19sb2NhbGVfc3RydWN0KimCCDFzdGQ6Ol9fMjo6X19saWJjcHBfbWJfY3VyX21heF9sKF9fbG9jYWxlX3N0cnVjdCopgwh1c3RkOjpfXzI6OmNvZGVjdnQ8d2NoYXJfdCwgY2hhciwgX19tYnN0YXRlX3Q+Ojpkb19sZW5ndGgoX19tYnN0YXRlX3QmLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGxvbmcpIGNvbnN0hAhXc3RkOjpfXzI6Ol9fbGliY3BwX21icmxlbl9sKGNoYXIgY29uc3QqLCB1bnNpZ25lZCBsb25nLCBfX21ic3RhdGVfdCosIF9fbG9jYWxlX3N0cnVjdCophQhEc3RkOjpfXzI6OmNvZGVjdnQ8d2NoYXJfdCwgY2hhciwgX19tYnN0YXRlX3Q+Ojpkb19tYXhfbGVuZ3RoKCkgY29uc3SGCJQBc3RkOjpfXzI6OmNvZGVjdnQ8Y2hhcjE2X3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9fb3V0KF9fbWJzdGF0ZV90JiwgY2hhcjE2X3QgY29uc3QqLCBjaGFyMTZfdCBjb25zdCosIGNoYXIxNl90IGNvbnN0KiYsIGNoYXIqLCBjaGFyKiwgY2hhciomKSBjb25zdIcItQFzdGQ6Ol9fMjo6dXRmMTZfdG9fdXRmOCh1bnNpZ25lZCBzaG9ydCBjb25zdCosIHVuc2lnbmVkIHNob3J0IGNvbnN0KiwgdW5zaWduZWQgc2hvcnQgY29uc3QqJiwgdW5zaWduZWQgY2hhciosIHVuc2lnbmVkIGNoYXIqLCB1bnNpZ25lZCBjaGFyKiYsIHVuc2lnbmVkIGxvbmcsIHN0ZDo6X18yOjpjb2RlY3Z0X21vZGUpiAiTAXN0ZDo6X18yOjpjb2RlY3Z0PGNoYXIxNl90LCBjaGFyLCBfX21ic3RhdGVfdD46OmRvX2luKF9fbWJzdGF0ZV90JiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiYsIGNoYXIxNl90KiwgY2hhcjE2X3QqLCBjaGFyMTZfdComKSBjb25zdIkItQFzdGQ6Ol9fMjo6dXRmOF90b191dGYxNih1bnNpZ25lZCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgY2hhciBjb25zdCosIHVuc2lnbmVkIGNoYXIgY29uc3QqJiwgdW5zaWduZWQgc2hvcnQqLCB1bnNpZ25lZCBzaG9ydCosIHVuc2lnbmVkIHNob3J0KiYsIHVuc2lnbmVkIGxvbmcsIHN0ZDo6X18yOjpjb2RlY3Z0X21vZGUpigh2c3RkOjpfXzI6OmNvZGVjdnQ8Y2hhcjE2X3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9fbGVuZ3RoKF9fbWJzdGF0ZV90JiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBsb25nKSBjb25zdIsIgAFzdGQ6Ol9fMjo6dXRmOF90b191dGYxNl9sZW5ndGgodW5zaWduZWQgY2hhciBjb25zdCosIHVuc2lnbmVkIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCBzdGQ6Ol9fMjo6Y29kZWN2dF9tb2RlKYwIRXN0ZDo6X18yOjpjb2RlY3Z0PGNoYXIxNl90LCBjaGFyLCBfX21ic3RhdGVfdD46OmRvX21heF9sZW5ndGgoKSBjb25zdI0IlAFzdGQ6Ol9fMjo6Y29kZWN2dDxjaGFyMzJfdCwgY2hhciwgX19tYnN0YXRlX3Q+Ojpkb19vdXQoX19tYnN0YXRlX3QmLCBjaGFyMzJfdCBjb25zdCosIGNoYXIzMl90IGNvbnN0KiwgY2hhcjMyX3QgY29uc3QqJiwgY2hhciosIGNoYXIqLCBjaGFyKiYpIGNvbnN0jgiuAXN0ZDo6X18yOjp1Y3M0X3RvX3V0ZjgodW5zaWduZWQgaW50IGNvbnN0KiwgdW5zaWduZWQgaW50IGNvbnN0KiwgdW5zaWduZWQgaW50IGNvbnN0KiYsIHVuc2lnbmVkIGNoYXIqLCB1bnNpZ25lZCBjaGFyKiwgdW5zaWduZWQgY2hhciomLCB1bnNpZ25lZCBsb25nLCBzdGQ6Ol9fMjo6Y29kZWN2dF9tb2RlKY8IkwFzdGQ6Ol9fMjo6Y29kZWN2dDxjaGFyMzJfdCwgY2hhciwgX19tYnN0YXRlX3Q+Ojpkb19pbihfX21ic3RhdGVfdCYsIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdComLCBjaGFyMzJfdCosIGNoYXIzMl90KiwgY2hhcjMyX3QqJikgY29uc3SQCK4Bc3RkOjpfXzI6OnV0ZjhfdG9fdWNzNCh1bnNpZ25lZCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgY2hhciBjb25zdCosIHVuc2lnbmVkIGNoYXIgY29uc3QqJiwgdW5zaWduZWQgaW50KiwgdW5zaWduZWQgaW50KiwgdW5zaWduZWQgaW50KiYsIHVuc2lnbmVkIGxvbmcsIHN0ZDo6X18yOjpjb2RlY3Z0X21vZGUpkQh2c3RkOjpfXzI6OmNvZGVjdnQ8Y2hhcjMyX3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9fbGVuZ3RoKF9fbWJzdGF0ZV90JiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBsb25nKSBjb25zdJIIf3N0ZDo6X18yOjp1dGY4X3RvX3VjczRfbGVuZ3RoKHVuc2lnbmVkIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgc3RkOjpfXzI6OmNvZGVjdnRfbW9kZSmTCCVzdGQ6Ol9fMjo6bnVtcHVuY3Q8Y2hhcj46On5udW1wdW5jdCgplAgnc3RkOjpfXzI6Om51bXB1bmN0PGNoYXI+Ojp+bnVtcHVuY3QoKS4xlQgoc3RkOjpfXzI6Om51bXB1bmN0PHdjaGFyX3Q+Ojp+bnVtcHVuY3QoKZYIKnN0ZDo6X18yOjpudW1wdW5jdDx3Y2hhcl90Pjo6fm51bXB1bmN0KCkuMZcIMnN0ZDo6X18yOjpudW1wdW5jdDxjaGFyPjo6ZG9fZGVjaW1hbF9wb2ludCgpIGNvbnN0mAgyc3RkOjpfXzI6Om51bXB1bmN0PGNoYXI+Ojpkb190aG91c2FuZHNfc2VwKCkgY29uc3SZCC1zdGQ6Ol9fMjo6bnVtcHVuY3Q8Y2hhcj46OmRvX2dyb3VwaW5nKCkgY29uc3SaCDBzdGQ6Ol9fMjo6bnVtcHVuY3Q8d2NoYXJfdD46OmRvX2dyb3VwaW5nKCkgY29uc3SbCC1zdGQ6Ol9fMjo6bnVtcHVuY3Q8Y2hhcj46OmRvX3RydWVuYW1lKCkgY29uc3ScCDBzdGQ6Ol9fMjo6bnVtcHVuY3Q8d2NoYXJfdD46OmRvX3RydWVuYW1lKCkgY29uc3SdCHxzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+OjpiYXNpY19zdHJpbmcod2NoYXJfdCBjb25zdCopngguc3RkOjpfXzI6Om51bXB1bmN0PGNoYXI+Ojpkb19mYWxzZW5hbWUoKSBjb25zdJ8IMXN0ZDo6X18yOjpudW1wdW5jdDx3Y2hhcl90Pjo6ZG9fZmFsc2VuYW1lKCkgY29uc3SgCG1zdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpvcGVyYXRvcj0oY2hhciBjb25zdCopoQg1c3RkOjpfXzI6Ol9fdGltZV9nZXRfY19zdG9yYWdlPGNoYXI+OjpfX3dlZWtzKCkgY29uc3SiCBZzdGQ6Ol9fMjo6aW5pdF93ZWVrcygpowgaX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuNTSkCDhzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8d2NoYXJfdD46Ol9fd2Vla3MoKSBjb25zdKUIF3N0ZDo6X18yOjppbml0X3d3ZWVrcygppggaX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuNjmnCHlzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+OjpvcGVyYXRvcj0od2NoYXJfdCBjb25zdCopqAg2c3RkOjpfXzI6Ol9fdGltZV9nZXRfY19zdG9yYWdlPGNoYXI+OjpfX21vbnRocygpIGNvbnN0qQgXc3RkOjpfXzI6OmluaXRfbW9udGhzKCmqCBpfX2N4eF9nbG9iYWxfYXJyYXlfZHRvci44NKsIOXN0ZDo6X18yOjpfX3RpbWVfZ2V0X2Nfc3RvcmFnZTx3Y2hhcl90Pjo6X19tb250aHMoKSBjb25zdKwIGHN0ZDo6X18yOjppbml0X3dtb250aHMoKa0IG19fY3h4X2dsb2JhbF9hcnJheV9kdG9yLjEwOK4INXN0ZDo6X18yOjpfX3RpbWVfZ2V0X2Nfc3RvcmFnZTxjaGFyPjo6X19hbV9wbSgpIGNvbnN0rwgWc3RkOjpfXzI6OmluaXRfYW1fcG0oKbAIG19fY3h4X2dsb2JhbF9hcnJheV9kdG9yLjEzMrEIOHN0ZDo6X18yOjpfX3RpbWVfZ2V0X2Nfc3RvcmFnZTx3Y2hhcl90Pjo6X19hbV9wbSgpIGNvbnN0sggXc3RkOjpfXzI6OmluaXRfd2FtX3BtKCmzCBtfX2N4eF9nbG9iYWxfYXJyYXlfZHRvci4xMzW0CDFzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8Y2hhcj46Ol9feCgpIGNvbnN0tQgZX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuMbYINHN0ZDo6X18yOjpfX3RpbWVfZ2V0X2Nfc3RvcmFnZTx3Y2hhcl90Pjo6X194KCkgY29uc3S3CBpfX2N4eF9nbG9iYWxfYXJyYXlfZHRvci4zMbgIMXN0ZDo6X18yOjpfX3RpbWVfZ2V0X2Nfc3RvcmFnZTxjaGFyPjo6X19YKCkgY29uc3S5CBpfX2N4eF9nbG9iYWxfYXJyYXlfZHRvci4zM7oINHN0ZDo6X18yOjpfX3RpbWVfZ2V0X2Nfc3RvcmFnZTx3Y2hhcl90Pjo6X19YKCkgY29uc3S7CBpfX2N4eF9nbG9iYWxfYXJyYXlfZHRvci4zNbwIMXN0ZDo6X18yOjpfX3RpbWVfZ2V0X2Nfc3RvcmFnZTxjaGFyPjo6X19jKCkgY29uc3S9CBpfX2N4eF9nbG9iYWxfYXJyYXlfZHRvci4zN74INHN0ZDo6X18yOjpfX3RpbWVfZ2V0X2Nfc3RvcmFnZTx3Y2hhcl90Pjo6X19jKCkgY29uc3S/CBpfX2N4eF9nbG9iYWxfYXJyYXlfZHRvci4zOcAIMXN0ZDo6X18yOjpfX3RpbWVfZ2V0X2Nfc3RvcmFnZTxjaGFyPjo6X19yKCkgY29uc3TBCBpfX2N4eF9nbG9iYWxfYXJyYXlfZHRvci40McIINHN0ZDo6X18yOjpfX3RpbWVfZ2V0X2Nfc3RvcmFnZTx3Y2hhcl90Pjo6X19yKCkgY29uc3TDCBpfX2N4eF9nbG9iYWxfYXJyYXlfZHRvci40M8QIaXN0ZDo6X18yOjp0aW1lX3B1dDxjaGFyLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojp+dGltZV9wdXQoKcUIa3N0ZDo6X18yOjp0aW1lX3B1dDxjaGFyLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojp+dGltZV9wdXQoKS4xxgh4c3RkOjpfXzI6OnZlY3RvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiA+OjptYXhfc2l6ZSgpIGNvbnN0xwirAXN0ZDo6X18yOjphbGxvY2F0b3JfdHJhaXRzPHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiA+OjphbGxvY2F0ZShzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4mLCB1bnNpZ25lZCBsb25nKcgIiwFzdGQ6Ol9fMjo6dmVjdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46Ol9fYW5ub3RhdGVfbmV3KHVuc2lnbmVkIGxvbmcpIGNvbnN0yQhfc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+OjphbGxvY2F0ZSh1bnNpZ25lZCBsb25nLCB2b2lkIGNvbnN0KinKCD9zdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+OjphbGxvY2F0ZSh1bnNpZ25lZCBsb25nLCB2b2lkIGNvbnN0KinLCMgBc3RkOjpfXzI6OmFsbG9jYXRvcl90cmFpdHM8c3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46OmRlYWxsb2NhdGUoc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+Jiwgc3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqKiwgdW5zaWduZWQgbG9uZynMCJsBc3RkOjpfXzI6Ol9fdmVjdG9yX2Jhc2U8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4gPjo6X19kZXN0cnVjdF9hdF9lbmQoc3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqKinNCCJzdGQ6Ol9fMjo6X190aW1lX3B1dDo6X190aW1lX3B1dCgpzgiIAXN0ZDo6X18yOjp2ZWN0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4gPjo6X19yZWNvbW1lbmQodW5zaWduZWQgbG9uZykgY29uc3TPCNgBc3RkOjpfXzI6Ol9fc3BsaXRfYnVmZmVyPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+Jj46Ol9fc3BsaXRfYnVmZmVyKHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiYp0AiRAXN0ZDo6X18yOjpfX3NwbGl0X2J1ZmZlcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiY+OjpfX2NvbnN0cnVjdF9hdF9lbmQodW5zaWduZWQgbG9uZynRCPMBc3RkOjpfXzI6OnZlY3RvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiA+OjpfX3N3YXBfb3V0X2NpcmN1bGFyX2J1ZmZlcihzdGQ6Ol9fMjo6X19zcGxpdF9idWZmZXI8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4mPiYp0gjGA3N0ZDo6X18yOjplbmFibGVfaWY8KChzdGQ6Ol9fMjo6aW50ZWdyYWxfY29uc3RhbnQ8Ym9vbCwgZmFsc2U+Ojp2YWx1ZSkgfHwgKCEoX19oYXNfY29uc3RydWN0PHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiwgYm9vbCosIGJvb2w+Ojp2YWx1ZSkpKSAmJiAoaXNfdHJpdmlhbGx5X21vdmVfY29uc3RydWN0aWJsZTxib29sPjo6dmFsdWUpLCB2b2lkPjo6dHlwZSBzdGQ6Ol9fMjo6YWxsb2NhdG9yX3RyYWl0czxzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4gPjo6X19jb25zdHJ1Y3RfYmFja3dhcmQ8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqPihzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4mLCBib29sKiwgYm9vbCosIGJvb2wqJinTCHxzdGQ6Ol9fMjo6X19jb21wcmVzc2VkX3BhaXI8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqKiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+Jj46OnNlY29uZCgp1AjGAXN0ZDo6X18yOjpfX3NwbGl0X2J1ZmZlcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiY+OjpfX2Rlc3RydWN0X2F0X2VuZChzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCoqLCBzdGQ6Ol9fMjo6aW50ZWdyYWxfY29uc3RhbnQ8Ym9vbCwgZmFsc2U+KdUIQHN0ZDo6X18yOjooYW5vbnltb3VzIG5hbWVzcGFjZSk6Ol9fZmFrZV9iaW5kOjpvcGVyYXRvcigpKCkgY29uc3TWCEJzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+OjphbGxvY2F0ZSh1bnNpZ25lZCBsb25nLCB2b2lkIGNvbnN0KinXCGtzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpfX2NsZWFyX2FuZF9zaHJpbmsoKdgIdHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID46Ol9fY2xlYXJfYW5kX3Nocmluaygp2QhDbG9uZyBkb3VibGUgc3RkOjpfXzI6Ol9fZG9fc3RydG9kPGxvbmcgZG91YmxlPihjaGFyIGNvbnN0KiwgY2hhcioqKdoILXN0ZDo6X18yOjpfX3NoYXJlZF9jb3VudDo6fl9fc2hhcmVkX2NvdW50KCkuMdsIL3N0ZDo6X18yOjpfX3NoYXJlZF93ZWFrX2NvdW50OjpfX3JlbGVhc2Vfd2Vhaygp3AhJc3RkOjpfXzI6Ol9fc2hhcmVkX3dlYWtfY291bnQ6Ol9fZ2V0X2RlbGV0ZXIoc3RkOjp0eXBlX2luZm8gY29uc3QmKSBjb25zdN0IRnN0ZDo6X18yOjpfX2NhbGxfb25jZSh1bnNpZ25lZCBsb25nIHZvbGF0aWxlJiwgdm9pZCosIHZvaWQgKCopKHZvaWQqKSneCBtvcGVyYXRvciBuZXcodW5zaWduZWQgbG9uZynfCD1zdGQ6Ol9fMjo6X19saWJjcHBfcmVmc3RyaW5nOjpfX2xpYmNwcF9yZWZzdHJpbmcoY2hhciBjb25zdCop4AgHd21lbXNldOEICHdtZW1tb3Zl4ghDc3RkOjpfXzI6Ol9fYmFzaWNfc3RyaW5nX2NvbW1vbjx0cnVlPjo6X190aHJvd19sZW5ndGhfZXJyb3IoKSBjb25zdOMIwQFzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpiYXNpY19zdHJpbmcoc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCYp5Ah5c3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6X19pbml0KGNoYXIgY29uc3QqLCB1bnNpZ25lZCBsb25nKeUIZnN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46On5iYXNpY19zdHJpbmcoKeYIeXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OmFzc2lnbihjaGFyIGNvbnN0KiwgdW5zaWduZWQgbG9uZynnCNMBc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6X19ncm93X2J5X2FuZF9yZXBsYWNlKHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIGNoYXIgY29uc3QqKegIcnN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OnJlc2l6ZSh1bnNpZ25lZCBsb25nLCBjaGFyKekIcnN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OmFwcGVuZCh1bnNpZ25lZCBsb25nLCBjaGFyKeoIdHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46Ol9fZXJhc2VfdG9fZW5kKHVuc2lnbmVkIGxvbmcp6wi6AXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46Ol9fZ3Jvd19ieSh1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nKewIP3N0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPjo6YXNzaWduKGNoYXIqLCB1bnNpZ25lZCBsb25nLCBjaGFyKe0IeXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OmFwcGVuZChjaGFyIGNvbnN0KiwgdW5zaWduZWQgbG9uZynuCGZzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpwdXNoX2JhY2soY2hhcinvCHJzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpfX2luaXQodW5zaWduZWQgbG9uZywgY2hhcinwCIUBc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6X19pbml0KHdjaGFyX3QgY29uc3QqLCB1bnNpZ25lZCBsb25nKfEIhQFzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+Ojphc3NpZ24od2NoYXJfdCBjb25zdCosIHVuc2lnbmVkIGxvbmcp8gjfAXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID46Ol9fZ3Jvd19ieV9hbmRfcmVwbGFjZSh1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB3Y2hhcl90IGNvbnN0KinzCMMBc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6X19ncm93X2J5KHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcp9AiFAXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID46OmFwcGVuZCh3Y2hhcl90IGNvbnN0KiwgdW5zaWduZWQgbG9uZyn1CHJzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+OjpwdXNoX2JhY2sod2NoYXJfdCn2CH5zdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+OjpfX2luaXQodW5zaWduZWQgbG9uZywgd2NoYXJfdCn3CEJzdGQ6Ol9fMjo6X192ZWN0b3JfYmFzZV9jb21tb248dHJ1ZT46Ol9fdGhyb3dfbGVuZ3RoX2Vycm9yKCkgY29uc3T4CA1hYm9ydF9tZXNzYWdl+QgSX19jeGFfcHVyZV92aXJ0dWFs+ggcc3RkOjpleGNlcHRpb246OndoYXQoKSBjb25zdPsIIHN0ZDo6bG9naWNfZXJyb3I6On5sb2dpY19lcnJvcigp/Agzc3RkOjpfXzI6Ol9fbGliY3BwX3JlZnN0cmluZzo6fl9fbGliY3BwX3JlZnN0cmluZygp/Qgic3RkOjpsb2dpY19lcnJvcjo6fmxvZ2ljX2Vycm9yKCkuMf4IInN0ZDo6bGVuZ3RoX2Vycm9yOjp+bGVuZ3RoX2Vycm9yKCn/CBtzdGQ6OmJhZF9jYXN0Ojp3aGF0KCkgY29uc3SACWFfX2N4eGFiaXYxOjpfX2Z1bmRhbWVudGFsX3R5cGVfaW5mbzo6Y2FuX2NhdGNoKF9fY3h4YWJpdjE6Ol9fc2hpbV90eXBlX2luZm8gY29uc3QqLCB2b2lkKiYpIGNvbnN0gQk8aXNfZXF1YWwoc3RkOjp0eXBlX2luZm8gY29uc3QqLCBzdGQ6OnR5cGVfaW5mbyBjb25zdCosIGJvb2wpgglbX19jeHhhYml2MTo6X19jbGFzc190eXBlX2luZm86OmNhbl9jYXRjaChfX2N4eGFiaXYxOjpfX3NoaW1fdHlwZV9pbmZvIGNvbnN0Kiwgdm9pZComKSBjb25zdIMJDl9fZHluYW1pY19jYXN0hAlrX19jeHhhYml2MTo6X19jbGFzc190eXBlX2luZm86OnByb2Nlc3NfZm91bmRfYmFzZV9jbGFzcyhfX2N4eGFiaXYxOjpfX2R5bmFtaWNfY2FzdF9pbmZvKiwgdm9pZCosIGludCkgY29uc3SFCW5fX2N4eGFiaXYxOjpfX2NsYXNzX3R5cGVfaW5mbzo6aGFzX3VuYW1iaWd1b3VzX3B1YmxpY19iYXNlKF9fY3h4YWJpdjE6Ol9fZHluYW1pY19jYXN0X2luZm8qLCB2b2lkKiwgaW50KSBjb25zdIYJcV9fY3h4YWJpdjE6Ol9fc2lfY2xhc3NfdHlwZV9pbmZvOjpoYXNfdW5hbWJpZ3VvdXNfcHVibGljX2Jhc2UoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQqLCBpbnQpIGNvbnN0hwlzX19jeHhhYml2MTo6X19iYXNlX2NsYXNzX3R5cGVfaW5mbzo6aGFzX3VuYW1iaWd1b3VzX3B1YmxpY19iYXNlKF9fY3h4YWJpdjE6Ol9fZHluYW1pY19jYXN0X2luZm8qLCB2b2lkKiwgaW50KSBjb25zdIgJcl9fY3h4YWJpdjE6Ol9fdm1pX2NsYXNzX3R5cGVfaW5mbzo6aGFzX3VuYW1iaWd1b3VzX3B1YmxpY19iYXNlKF9fY3h4YWJpdjE6Ol9fZHluYW1pY19jYXN0X2luZm8qLCB2b2lkKiwgaW50KSBjb25zdIkJW19fY3h4YWJpdjE6Ol9fcGJhc2VfdHlwZV9pbmZvOjpjYW5fY2F0Y2goX19jeHhhYml2MTo6X19zaGltX3R5cGVfaW5mbyBjb25zdCosIHZvaWQqJikgY29uc3SKCV1fX2N4eGFiaXYxOjpfX3BvaW50ZXJfdHlwZV9pbmZvOjpjYW5fY2F0Y2goX19jeHhhYml2MTo6X19zaGltX3R5cGVfaW5mbyBjb25zdCosIHZvaWQqJikgY29uc3SLCVxfX2N4eGFiaXYxOjpfX3BvaW50ZXJfdHlwZV9pbmZvOjpjYW5fY2F0Y2hfbmVzdGVkKF9fY3h4YWJpdjE6Ol9fc2hpbV90eXBlX2luZm8gY29uc3QqKSBjb25zdIwJZl9fY3h4YWJpdjE6Ol9fcG9pbnRlcl90b19tZW1iZXJfdHlwZV9pbmZvOjpjYW5fY2F0Y2hfbmVzdGVkKF9fY3h4YWJpdjE6Ol9fc2hpbV90eXBlX2luZm8gY29uc3QqKSBjb25zdI0JgwFfX2N4eGFiaXYxOjpfX2NsYXNzX3R5cGVfaW5mbzo6cHJvY2Vzc19zdGF0aWNfdHlwZV9hYm92ZV9kc3QoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQgY29uc3QqLCB2b2lkIGNvbnN0KiwgaW50KSBjb25zdI4Jc19fY3h4YWJpdjE6Ol9fdm1pX2NsYXNzX3R5cGVfaW5mbzo6c2VhcmNoX2JlbG93X2RzdChfX2N4eGFiaXYxOjpfX2R5bmFtaWNfY2FzdF9pbmZvKiwgdm9pZCBjb25zdCosIGludCwgYm9vbCkgY29uc3SPCYEBX19jeHhhYml2MTo6X19iYXNlX2NsYXNzX3R5cGVfaW5mbzo6c2VhcmNoX2Fib3ZlX2RzdChfX2N4eGFiaXYxOjpfX2R5bmFtaWNfY2FzdF9pbmZvKiwgdm9pZCBjb25zdCosIHZvaWQgY29uc3QqLCBpbnQsIGJvb2wpIGNvbnN0kAl0X19jeHhhYml2MTo6X19iYXNlX2NsYXNzX3R5cGVfaW5mbzo6c2VhcmNoX2JlbG93X2RzdChfX2N4eGFiaXYxOjpfX2R5bmFtaWNfY2FzdF9pbmZvKiwgdm9pZCBjb25zdCosIGludCwgYm9vbCkgY29uc3SRCXJfX2N4eGFiaXYxOjpfX3NpX2NsYXNzX3R5cGVfaW5mbzo6c2VhcmNoX2JlbG93X2RzdChfX2N4eGFiaXYxOjpfX2R5bmFtaWNfY2FzdF9pbmZvKiwgdm9pZCBjb25zdCosIGludCwgYm9vbCkgY29uc3SSCW9fX2N4eGFiaXYxOjpfX2NsYXNzX3R5cGVfaW5mbzo6c2VhcmNoX2JlbG93X2RzdChfX2N4eGFiaXYxOjpfX2R5bmFtaWNfY2FzdF9pbmZvKiwgdm9pZCBjb25zdCosIGludCwgYm9vbCkgY29uc3STCYABX19jeHhhYml2MTo6X192bWlfY2xhc3NfdHlwZV9pbmZvOjpzZWFyY2hfYWJvdmVfZHN0KF9fY3h4YWJpdjE6Ol9fZHluYW1pY19jYXN0X2luZm8qLCB2b2lkIGNvbnN0Kiwgdm9pZCBjb25zdCosIGludCwgYm9vbCkgY29uc3SUCX9fX2N4eGFiaXYxOjpfX3NpX2NsYXNzX3R5cGVfaW5mbzo6c2VhcmNoX2Fib3ZlX2RzdChfX2N4eGFiaXYxOjpfX2R5bmFtaWNfY2FzdF9pbmZvKiwgdm9pZCBjb25zdCosIHZvaWQgY29uc3QqLCBpbnQsIGJvb2wpIGNvbnN0lQl8X19jeHhhYml2MTo6X19jbGFzc190eXBlX2luZm86OnNlYXJjaF9hYm92ZV9kc3QoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQgY29uc3QqLCB2b2lkIGNvbnN0KiwgaW50LCBib29sKSBjb25zdJYJCF9fc3RyZHVwlwkNX19nZXRUeXBlTmFtZZgJKl9fZW1iaW5kX3JlZ2lzdGVyX25hdGl2ZV9hbmRfYnVpbHRpbl90eXBlc5kJP3ZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9pbnRlZ2VyPGNoYXI+KGNoYXIgY29uc3QqKZoJRnZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9pbnRlZ2VyPHNpZ25lZCBjaGFyPihjaGFyIGNvbnN0KimbCUh2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfaW50ZWdlcjx1bnNpZ25lZCBjaGFyPihjaGFyIGNvbnN0KimcCUB2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfaW50ZWdlcjxzaG9ydD4oY2hhciBjb25zdCopnQlJdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX2ludGVnZXI8dW5zaWduZWQgc2hvcnQ+KGNoYXIgY29uc3QqKZ4JPnZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9pbnRlZ2VyPGludD4oY2hhciBjb25zdCopnwlHdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX2ludGVnZXI8dW5zaWduZWQgaW50PihjaGFyIGNvbnN0KimgCT92b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfaW50ZWdlcjxsb25nPihjaGFyIGNvbnN0KimhCUh2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfaW50ZWdlcjx1bnNpZ25lZCBsb25nPihjaGFyIGNvbnN0KimiCT52b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfZmxvYXQ8ZmxvYXQ+KGNoYXIgY29uc3QqKaMJP3ZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9mbG9hdDxkb3VibGU+KGNoYXIgY29uc3QqKaQJQ3ZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9tZW1vcnlfdmlldzxjaGFyPihjaGFyIGNvbnN0KimlCUp2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfbWVtb3J5X3ZpZXc8c2lnbmVkIGNoYXI+KGNoYXIgY29uc3QqKaYJTHZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9tZW1vcnlfdmlldzx1bnNpZ25lZCBjaGFyPihjaGFyIGNvbnN0KimnCUR2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfbWVtb3J5X3ZpZXc8c2hvcnQ+KGNoYXIgY29uc3QqKagJTXZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9tZW1vcnlfdmlldzx1bnNpZ25lZCBzaG9ydD4oY2hhciBjb25zdCopqQlCdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX21lbW9yeV92aWV3PGludD4oY2hhciBjb25zdCopqglLdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX21lbW9yeV92aWV3PHVuc2lnbmVkIGludD4oY2hhciBjb25zdCopqwlDdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX21lbW9yeV92aWV3PGxvbmc+KGNoYXIgY29uc3QqKawJTHZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9tZW1vcnlfdmlldzx1bnNpZ25lZCBsb25nPihjaGFyIGNvbnN0KimtCUR2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfbWVtb3J5X3ZpZXc8ZmxvYXQ+KGNoYXIgY29uc3QqKa4JRXZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9tZW1vcnlfdmlldzxkb3VibGU+KGNoYXIgY29uc3QqKa8JbkVtc2NyaXB0ZW5CaW5kaW5nSW5pdGlhbGl6ZXJfbmF0aXZlX2FuZF9idWlsdGluX3R5cGVzOjpFbXNjcmlwdGVuQmluZGluZ0luaXRpYWxpemVyX25hdGl2ZV9hbmRfYnVpbHRpbl90eXBlcygpsAkIZGxtYWxsb2OxCQZkbGZyZWWyCQlkbHJlYWxsb2OzCRF0cnlfcmVhbGxvY19jaHVua7QJDWRpc3Bvc2VfY2h1bmu1CQRzYnJrtgkEZm1vZLcJBWZtb2RsuAkFbG9nMTC5CQZsb2cxMGa6CQZzY2FsYm67CQ1fX2ZwY2xhc3NpZnlsvAkGbWVtY3B5vQkGbWVtc2V0vgkHbWVtbW92Zb8JCHNldFRocmV3wAkJc3RhY2tTYXZlwQkKc3RhY2tBbGxvY8IJDHN0YWNrUmVzdG9yZcMJEF9fZ3Jvd1dhc21NZW1vcnnECQtkeW5DYWxsX3ZpacUJDWR5bkNhbGxfdmlpaWnGCQxkeW5DYWxsX2RpaWnHCQ1keW5DYWxsX2RpaWlpyAkMZHluQ2FsbF92aWlkyQkNZHluQ2FsbF92aWlpZMoJC2R5bkNhbGxfdmlkywkLZHluQ2FsbF9kaWnMCQ1keW5DYWxsX2RpZGlkzQkOZHluQ2FsbF9kaWlkaWTOCQ5keW5DYWxsX2RpZGlkac8JD2R5bkNhbGxfZGlpZGlkadAJDWR5bkNhbGxfZGlkZGTRCQ5keW5DYWxsX2RpaWRkZNIJDGR5bkNhbGxfZGlkZNMJDWR5bkNhbGxfZGlpZGTUCQ1keW5DYWxsX3ZpZGlk1QkOZHluQ2FsbF92aWlkaWTWCQ5keW5DYWxsX3ZpZGlkZNcJD2R5bkNhbGxfdmlpZGlkZNgJD2R5bkNhbGxfdmlkaWRkZNkJEGR5bkNhbGxfdmlpZGlkZGTaCQtkeW5DYWxsX2RpZNsJDGR5bkNhbGxfZGlpZNwJDmR5bkNhbGxfdmlkZGRp3QkPZHluQ2FsbF92aWlkZGRp3gkNZHluQ2FsbF9paWlpZN8JDGR5bkNhbGxfdmlkZOAJDWR5bkNhbGxfdmlpZGThCQ1keW5DYWxsX2lpaWlp4gkOZHluQ2FsbF92aWZmaWnjCQ9keW5DYWxsX3ZpaWZmaWnkCQ9keW5DYWxsX2RpZGRpZGTlCRBkeW5DYWxsX2RpaWRkaWRk5gkPZHluQ2FsbF9kaWRkZGRk5wkQZHluQ2FsbF9kaWlkZGRkZOgJD2R5bkNhbGxfZGlkZGRpaekJEGR5bkNhbGxfZGlpZGRkaWnqCRFkeW5DYWxsX2RpZGRkZGRpaesJEmR5bkNhbGxfZGlpZGRkZGRpaewJDGR5bkNhbGxfZGlkae0JDWR5bkNhbGxfZGlpZGnuCQ9keW5DYWxsX2RpZGlkZGTvCRBkeW5DYWxsX2RpaWRpZGRk8AkNZHluQ2FsbF9kaWRkafEJDmR5bkNhbGxfZGlpZGRp8gkMZHluQ2FsbF92aWRp8wkNZHluQ2FsbF92aWlkafQJDmR5bkNhbGxfdmlpaWlp9QkMZHluQ2FsbF9paWZp9gkNZHluQ2FsbF9paWlmafcJCmR5bkNhbGxfZmn4CQtkeW5DYWxsX2ZpafkJDWR5bkNhbGxfZmlpaWn6CQ5keW5DYWxsX2ZpaWlpafsJD2R5bkNhbGxfdmlpaWlkZPwJEGR5bkNhbGxfdmlpaWlpZGT9CQxkeW5DYWxsX3ZpaWb+CQ1keW5DYWxsX3ZpaWlm/wkNZHluQ2FsbF9paWlpZoAKDmR5bkNhbGxfZGlkZGlkgQoPZHluQ2FsbF9kaWlkZGlkggoPZHluQ2FsbF9kaWRkZGlkgwoQZHluQ2FsbF9kaWlkZGRpZIQKDmR5bkNhbGxfZGlkZGRphQoPZHluQ2FsbF9kaWlkZGRphgoLZHluQ2FsbF9paWSHCg1keW5DYWxsX2RpZGlpiAoOZHluQ2FsbF9kaWlkaWmJCg9keW5DYWxsX2lpZGlpaWmKCg5keW5DYWxsX2lpaWlpaYsKEWR5bkNhbGxfaWlpaWlpaWlpjAoPZHluQ2FsbF9paWlpaWlpjQoOZHluQ2FsbF9paWlpaWSOChBkeW5DYWxsX2lpaWlpaWlpjwoPZHluQ2FsbF92aWlpaWlpkAoJZHluQ2FsbF92kQoYbGVnYWxzdHViJGR5bkNhbGxfdmlpamlpkgoWbGVnYWxzdHViJGR5bkNhbGxfamlqaZMKGGxlZ2Fsc3R1YiRkeW5DYWxsX2lpaWlpapQKGWxlZ2Fsc3R1YiRkeW5DYWxsX2lpaWlpamqVChpsZWdhbHN0dWIkZHluQ2FsbF9paWlpaWlqagB1EHNvdXJjZU1hcHBpbmdVUkxjaHR0cDovL2xvY2FsaG9zdDo5MDAwL2F1ZGlvLXdvcmtsZXQvYnVpbGQve3t7IEZJTEVOQU1FX1JFUExBQ0VNRU5UX1NUUklOR1NfV0FTTV9CSU5BUllfRklMRSB9fX0ubWFw';
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




// STATICTOP = STATIC_BASE + 40464;
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
      return 41328;
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
var dynCall_diddd = Module["dynCall_diddd"] = asm["dynCall_diddd"];
var dynCall_diiddd = Module["dynCall_diiddd"] = asm["dynCall_diiddd"];
var dynCall_didd = Module["dynCall_didd"] = asm["dynCall_didd"];
var dynCall_diidd = Module["dynCall_diidd"] = asm["dynCall_diidd"];
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

