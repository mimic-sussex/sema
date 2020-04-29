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
  'initial': 953,
  'maximum': 953 + 0,
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
    STACK_BASE = 5296816,
    STACKTOP = STACK_BASE,
    STACK_MAX = 53936,
    DYNAMIC_BASE = 5296816,
    DYNAMICTOP_PTR = 53776;




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




var wasmBinaryFile = 'data:application/octet-stream;base64,AGFzbQEAAAAB7QqiAWABfwF/YAF/AGACf38AYAJ/fwF/YAN/f38Bf2ADf39/AGAFf39/f38Bf2AAAGAEf39/fwF/YAZ/f39/f38Bf2AFf39/f38AYAR/f39/AGAAAX9gBn9/f39/fwBgCH9/f39/f39/AX9gAn98AGABfwF8YAJ/fAF8YAJ8fAF8YAN/fHwBfGAHf39/f39/fwF/YAR/fHx8AXxgAXwBfGAHf39/f39/fwBgAn9/AXxgBH9/f3wAYAN/f3wAYAV/fn5+fgBgA39+fwF+YAF9AX1gA39/fwF8YAR/fHx/AXxgCn9/f39/f39/f38AYAN/fH8AYAV/f39/fgF/YAN/fH8BfGAFf39+f38AYAZ/f3x8fH8AYAV/f39/fAF/YAR/f39/AX5gAX8BfWACf38BfWAEf398fwF8YAV/f3x8fwF8YAZ/fH98fHwBfGAFf3x8f3wBfGAFf3x8fH8BfGAGf3x8fHx8AXxgCH9/f39/f39/AGAHf39/f398fABgBn9/f398fABgBH9/f30AYAZ/f319f38AYAR/f3x/AGAFf398f3wAYAZ/f3x/fHwAYAd/f3x/fHx8AGAEf398fABgBH9+fn8AYAV/fX1/fwBgBH98f3wAYAV/fH98fABgBn98f3x8fABgA398fABgBX98fHx/AGAKf39/f39/f39/fwF/YAd/f39/f35+AX9gBn9/f39+fgF/YAR/f398AX9gBH9/fX8Bf2ADf31/AX9gBn98f39/fwF/YAR/f39/AX1gBX9/f39/AX1gBH9/f38BfGADf398AXxgBX9/fH9/AXxgBX9/fH98AXxgBn9/fH98fwF8YAd/f3x/fHx8AXxgBH9/fHwBfGAGf398fH98AXxgB39/fHx/fHwBfGAFf398fHwBfGAGf398fHx/AXxgB39/fHx8f38BfGAHf398fHx/fAF8YAd/f3x8fHx8AXxgCX9/fHx8fHx/fwF8YAR/fH9/AXxgBH98f3wBfGAFf3x/fH8BfGAGf3x8f3x8AXxgBn98fHx/fwF8YAZ/fHx8f3wBfGAIf3x8fHx8f38BfGAPf39/f39/f39/f39/f39/AGADf399AGACf34AYAl/f39/f39/f38Bf2ALf39/f39/f39/f38Bf2AMf39/f39/f39/f39/AX9gBH9/f30Bf2ADf35/AX9gAn98AX9gAn5/AX9gAn5+AX9gAXwBf2ABfwF+YAR/f39+AX5gA39/fwF9YAJ9fwF9YAF8AX1gAnx/AXxgA3x8fwF8YAN8fHwBfGAMf39/f39/f39/f39/AGANf39/f39/f39/f39/fwBgCH9/f39/f3x8AGAFf39/f30AYAV/f39/fABgB39/f319f38AYAV/f398fwBgBn9/f3x/fABgB39/f3x/fHwAYAh/f398f3x8fABgBX9/f3x8AGAHf39/fHx8fwBgA39/fgBgA39+fgBgAn99AGAGf39/f398AX9gBX9/f399AX9gBX9/f31/AX9gA39/fAF/YAd/f3x/f39/AX9gA35/fwF/YAR+fn5+AX9gAn1/AX9gAnx/AX9gAn9/AX5gBn9/f39/fwF9YAJ+fgF9YAJ9fQF9YAV/f39/fwF8YAR/f398AXxgBX9/f3x/AXxgBn9/f3x/fwF8YAZ/f398f3wBfGAHf39/fH98fwF8YAh/f398f3x8fAF8YAV/f398fAF8YAZ/f398fH8BfGAHf39/fHx/fAF8YAh/f398fH98fAF8YAZ/f398fHwBfGAHf39/fHx8fwF8YAh/f398fHx/fwF8YAh/f398fHx/fAF8YAh/f398fHx8fAF8YAp/f398fHx8fH9/AXxgAn5+AXwClgktA2VudhZfZW1iaW5kX3JlZ2lzdGVyX2NsYXNzAHUDZW52Il9lbWJpbmRfcmVnaXN0ZXJfY2xhc3NfY29uc3RydWN0b3IADQNlbnYlX2VtYmluZF9yZWdpc3Rlcl9jbGFzc19jbGFzc19mdW5jdGlvbgAXA2Vudh9fZW1iaW5kX3JlZ2lzdGVyX2NsYXNzX3Byb3BlcnR5ACADZW52H19lbWJpbmRfcmVnaXN0ZXJfY2xhc3NfZnVuY3Rpb24AMANlbnYVX2VtYmluZF9yZWdpc3Rlcl9lbnVtAAsDZW52G19lbWJpbmRfcmVnaXN0ZXJfZW51bV92YWx1ZQAFA2VudhpfZW1iaW5kX3JlZ2lzdGVyX3NtYXJ0X3B0cgB0A2VudhhfX2N4YV9hbGxvY2F0ZV9leGNlcHRpb24AAANlbnYLX19jeGFfdGhyb3cABQNlbnYRX2VtdmFsX3Rha2VfdmFsdWUAAwNlbnYNX2VtdmFsX2luY3JlZgABA2Vudg1fZW12YWxfZGVjcmVmAAEDZW52C19lbXZhbF9jYWxsAAgDZW52BXJvdW5kABYDZW52BGV4aXQAAQNlbnYNX19hc3NlcnRfZmFpbAALA2VudgZfX2xvY2sAAQNlbnYIX191bmxvY2sAARZ3YXNpX3NuYXBzaG90X3ByZXZpZXcxCGZkX2Nsb3NlAAADZW52Cl9fc3lzY2FsbDUAAwNlbnYMX19zeXNjYWxsMjIxAAMDZW52C19fc3lzY2FsbDU0AAMWd2FzaV9zbmFwc2hvdF9wcmV2aWV3MQdmZF9yZWFkAAgWd2FzaV9zbmFwc2hvdF9wcmV2aWV3MQhmZF93cml0ZQAIFndhc2lfc25hcHNob3RfcHJldmlldzERZW52aXJvbl9zaXplc19nZXQAAxZ3YXNpX3NuYXBzaG90X3ByZXZpZXcxC2Vudmlyb25fZ2V0AAMDZW52Cl9fbWFwX2ZpbGUAAwNlbnYLX19zeXNjYWxsOTEAAwNlbnYKc3RyZnRpbWVfbAAGA2VudgVhYm9ydAAHA2VudhVfZW1iaW5kX3JlZ2lzdGVyX3ZvaWQAAgNlbnYVX2VtYmluZF9yZWdpc3Rlcl9ib29sAAoDZW52G19lbWJpbmRfcmVnaXN0ZXJfc3RkX3N0cmluZwACA2VudhxfZW1iaW5kX3JlZ2lzdGVyX3N0ZF93c3RyaW5nAAUDZW52Fl9lbWJpbmRfcmVnaXN0ZXJfZW12YWwAAgNlbnYYX2VtYmluZF9yZWdpc3Rlcl9pbnRlZ2VyAAoDZW52Fl9lbWJpbmRfcmVnaXN0ZXJfZmxvYXQABQNlbnYcX2VtYmluZF9yZWdpc3Rlcl9tZW1vcnlfdmlldwAFA2VudhZlbXNjcmlwdGVuX3Jlc2l6ZV9oZWFwAAADZW52FWVtc2NyaXB0ZW5fbWVtY3B5X2JpZwAEA2VudgtzZXRUZW1wUmV0MAABFndhc2lfc25hcHNob3RfcHJldmlldzEHZmRfc2VlawAGA2VudgZtZW1vcnkCAIAQA2VudgV0YWJsZQFwALkHA6IK/gkHBwcHBwcHAAEADAIBAAsFAAIDBQACAAIADEtTUBgaAAxKGRAPAAIADE1OAAwQDxAPAAw2NzgADBFAJQ8AAEQZFXMADD85DxAQDxAPDwABDAALCAIBNAgADFJXAAxVWCoAAgAYGBYREQAMEwAMLE8ADCwADBMA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ZHluQ2FsbF9kaWRpZGkA5wkPZHluQ2FsbF9kaWlkaWRpAOgJDWR5bkNhbGxfdmlkaWQA6QkOZHluQ2FsbF92aWlkaWQA6gkOZHluQ2FsbF92aWRpZGQA6wkPZHluQ2FsbF92aWlkaWRkAOwJD2R5bkNhbGxfdmlkaWRkZADtCRBkeW5DYWxsX3ZpaWRpZGRkAO4JDmR5bkNhbGxfdmlkZGRpAO8JD2R5bkNhbGxfdmlpZGRkaQDwCQ1keW5DYWxsX2lpaWlkAPEJDGR5bkNhbGxfZGRkZABrDGR5bkNhbGxfdmlkZADyCQ1keW5DYWxsX3ZpaWRkAPMJDGR5bkNhbGxfaWlpaQC8Ag1keW5DYWxsX2lpaWlpAPQJDmR5bkNhbGxfdmlmZmlpAPUJD2R5bkNhbGxfdmlpZmZpaQD2CQ9keW5DYWxsX2RpZGRpZGQA9wkQZHluQ2FsbF9kaWlkZGlkZAD4CQ9keW5DYWxsX2RpZGRkZGQA+QkQZHluQ2FsbF9kaWlkZGRkZAD6CQ9keW5DYWxsX2RpZGRkaWkA+wkQZHluQ2FsbF9kaWlkZGRpaQD8CRFkeW5DYWxsX2RpZGRkZGRpaQD9CRJkeW5DYWxsX2RpaWRkZGRkaWkA/gkMZHluQ2FsbF9kaWRpAP8JDWR5bkNhbGxfZGlpZGkAgAoKZHluQ2FsbF9kZACSAQ9keW5DYWxsX2RpZGlkZGQAgQoQZHluQ2FsbF9kaWlkaWRkZACCCgtkeW5DYWxsX2RkZACmAQ1keW5DYWxsX2RpZGRpAIMKDmR5bkNhbGxfZGlpZGRpAIQKDGR5bkNhbGxfdmlkaQCFCg1keW5DYWxsX3ZpaWRpAIYKDmR5bkNhbGxfdmlpaWlpAIcKDGR5bkNhbGxfaWlmaQCICg1keW5DYWxsX2lpaWZpAIkKCmR5bkNhbGxfZmkAigoLZHluQ2FsbF9maWkAiwoNZHluQ2FsbF9maWlpaQCMCg5keW5DYWxsX2ZpaWlpaQCNCg9keW5DYWxsX3ZpaWlpZGQAjgoQZHluQ2FsbF92aWlpaWlkZACPCgxkeW5DYWxsX3ZpaWYAkAoNZHluQ2FsbF92aWlpZgCRCg1keW5DYWxsX2lpaWlmAJIKDmR5bkNhbGxfZGlkZGlkAJMKD2R5bkNhbGxfZGlpZGRpZACUCg9keW5DYWxsX2Rp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BCABOQMAIAMgBTYCFCADIANBIGogA0EQaiACEGogAygCACIEKwMAIQAgAyAENgIEIAQQxAkgAygCECIEBEAgAyAENgIUIAQQxAkLIAMoAiAiBARAIAMgBDYCJCAEEMQJCyADQTBqJAAgAAsFAEG4LwswAQF/QRgQ8QgiAEIANwMQIABCgICAgICAgPA/NwMIIABCgICAgICAgPA/NwMAIAALIQAgACACOQMQIAAgATkDACAARAAAAAAAAPA/IAGhOQMICzkBAX8gASAAKAIEIgRBAXVqIQEgACgCACEAIAEgAiADIARBAXEEfyABKAIAIABqKAIABSAACxE/AAsbACAAIAArAwAgAaIgACsDCCAAKwMQoqA5AxALBwAgACsDEAsHACAAKwMACwkAIAAgATkDAAsHACAAKwMICwkAIAAgATkDCAsJACAAIAE5AxALBQBBzDALNwEBfyAABEAgACgCbCIBBEAgACABNgJwIAEQxAkLIAAsAAtBf0wEQCAAKAIAEMQJCyAAEMQJCwuJAQECf0GIARDxCCIAQgA3AgAgAEIANwMoIABBATsBYCAAQgA3A1ggAEKAgICAgICA8D83A1AgAEKAgICAgICA8D83A0ggAEEANgIIIABCADcDMEG0ggIoAgAhASAAQQA2AnQgAEIANwJsIAAgATYCZCAAQQE6AIABIABCgICAgICAgPg/NwN4IAALEAAgACgCcCAAKAJsa0EDdQs5AQF/IAEgACgCBCIEQQF1aiEBIAAoAgAhACABIAIgAyAEQQFxBH8gASgCACAAaigCAAUgAAsRBQALOQEBfyABIAAoAgQiBEEBdWohASAAKAIAIQAgASACIAMgBEEBcQR/IAEoAgAgAGooAgAFIAALEQQACzUBAX8gASAAKAIEIgJBAXVqIQEgACgCACEAIAEgAkEBcQR/IAEoAgAgAGooAgAFIAALEQEACwwAIAAgACgCbDYCcAs9AQF/IAEgACgCBCIGQQF1aiEBIAAoAgAhACABIAIgAyAEIAUgBkEBcQR/IAEoAgAgAGooAgAFIAALETsAC+UBAQR/IwBBEGsiBCQAIAEgACgCBCIGQQF1aiEHIAAoAgAhBSAGQQFxBEAgBygCACAFaigCACEFCyACKAIAIQAgBEEANgIIIARCADcDACAAQXBJBEACQAJAIABBC08EQCAAQRBq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QQA6ABggACgCECEDIAAoAgwhACAHQRBqJAAgDSADIABrQQN1uKMLGQAgACgCACACQQR0aiABOQMAIABBAToAGAtOAQN/IAEoAgAiAiABKAIEIgNHBEAgACgCACEEQQAhAQNAIAQgAUEEdGogAikDADcDACABQQFqIQEgAkEIaiICIANHDQALCyAAQQE6ABgLBgBBvMMACw8AIAAEQCAAEOsCEMQJCwtuAQF/QZQBEPEIIgBCADcCUCAAQgA3AgAgAEIANwJ4IABCADcCcCAAQgA3AmggAEIANwJgIABCADcCWCAAQgA3AgggAEIANwIQIABCADcCGCAAQgA3AiAgAEIANwIoIABCADcCMCAAQQA2AjggAAs7AQF/IAEgACgCBCIFQQF1aiEBIAAoAgAhACABIAIgAyAEIAVBAXEEfyABKAIAIABqKAIABSAACxELAAs5AQF/IAEgACgCBCIEQQF1aiEBIAAoAgAhACABIAIgAyAEQQFxBH8gASgCACAAaigCAAUgAAsRRgALNQEBfyABIAAoAgQiAkEBdWohASAAKAIAIQAgASACQQFxBH8gASgCACAAaigCAAUgAAsRKAALvAEBAn8gASAAKAIEIgJBAXVqIQEgACgCACEAIAEgAkEBcQR/IAEoAgAgAGooAgAFIAALEQAAIQFBDBDxCCIAQQA2AgggAEIANwIAAkACQCABKAIEIAEoAgBrIgJFDQAgAkECdSIDQYCAgIAETw0BIAAgAhDxCCICNgIAIAAgAjYCBCAAIAIgA0ECdGo2AgggASgCBCABKAIAIgNrIgFBAUgNACAAIAIgAyABEM8JIAFqNgIECyAADwsQigkACwcAIAAQ1wMLBwAgAEEMagsIACAAKAKMAQsHACAAKAJECwgAIAAoAogBCwgAIAAoAoQBCwYAQfzEAAtYAQF/IAAEQCAAQTxqEOADIAAoAhgiAQRAIAAgATYCHCABEMQJCyAAKAIMIgEEQCAAIAE2AhAgARDECQsgACgCACIBBEAgACABNgIEIAEQxAkLIAAQxAkLC1kBAX9B9AAQ8QgiAEIANwJEIABCADcCACAAQgA3AmwgAEIANwJkIABCADcCXCAAQgA3AlQgAEIANwJMIABCADcCCCAAQgA3AhAgAEIANwIYIABBADYCICAACzsBAX8gASAAKAIEIgVBAXVqIQEgACgC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IAFCADcDyAEgAEHQrAFqIgFCADcDwAEgAUIANwPYASABQgA3A9ABIAFCADcDyAEgAEHArgFqIgFCADcDwAEgAUIANwPYASABQgA3A9ABIAFCADcDyAEgAEGwsAFqIgFCADcDwAEgAUIANwPYASABQgA3A9ABIAFCADcDyAEgAEGgsgFqIgFCADcDwAEgAUIANwPYASABQgA3A9ABIAFCADcDyAEgAEGQtAFqIgFCADcDwAEgAUIANwPYASABQgA3A9ABIAFCADcDyAEgAEGAtgFqIgFCADcDwAEgAUIANwPYASABQgA3A9ABIAFCADcDyAEgAEHwtwFqIgFCADcDwAEgAUIANwPYASABQgA3A9ABIAFCADcDyAEgAEHguQFqIgFCADcDwAEgAUIANwPYASABQgA3A9ABIAFCADcDyAEgAEHQuwFqIgFCADcDwAEgAUIANwPYASABQgA3A9ABIAFCADcDyAEgAEHAvQFqIgFCADcDwAEgAUIANwPYASABQgA3A9ABIAFCADcDyAEgAEGwvwFqIgFCADcDwAEgAUIANwPYASABQgA3A9ABIAFCADcDyAEgAEGgwQFqIgFCADcDwAEgAUIANwPYASABQgA3A9ABIAFCADcDyAEgAEGQwwFqIgFCADcDwAEgAUIANwPYASABQgA3A9ABIAFCADcDyAEgAEGAxQFqIgFCADcDwAEgAUIANwPYASABQgA3A9ABIAFCADcDyAEgAEHwxgFqIgFCADcDwAEgAUIANwPYASABQgA3A9ABIAFCADcDyAEgAEHgyAFqIgFCADcDwAEgAUIANwPYASABQgA3A9ABIAFCADcDyAEgAEHQygFqIgFCADcDwAEgAUIANwPYASABQgA3A9ABIAFCADcDyAEgAEHo2AFqEOcDIABB0NgBakIANwMAIABCADcDyNgBIABCADcDwNYBIABByNYBakIANwMAIABBwMwBakEAQZAIENAJGiAAQbjcAWpBAEHQAhDQCSEDQbSCAigCACEBIABBIDYCiN8BIABCADcD2NgBIABCADcDwNgBIABCmrPmzJmz5tw/NwOI3QEgAEKas+bMmbPm3D83A4jbASAAQZDdAWpCmrPmzJmz5tw/NwMAIABBkNsBaiIEQpqz5syZs+bcPzcDACAAQZjdAWpCmrPmzJmz5tw/NwMAIABBmNsBakKas+bM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AaKhOQOYBSAEIAc5AwAgAEEAIAJBAWogAiADQX9qRhs2ApAFIAAgACsDmAUiATkDwNgBIAEL6AYBAX8jAEGAAWsiASQAIAAQ6AMgAEH4zAFqQoCAgICAgNzIwAA3AwAgAEHwzAFqQoCAgICAgKTJwAA3AwAgAEHozAFqQoCAgICAgMzKwAA3AwAgAEHgzAFqQoCAgICAgP3JwAA3AwAgAEHYzAFqQoCAgICAgI7LwAA3AwAgAEHQzAFqQoCAgICAgNPLwAA3AwAgAEHIzAFqQoCAgICAgNHMwAA3AwAgAEKAgICAgICVzMAANwPAzAEgAULh9dHw+qi49T83A0ggAULh9dHw+qi49T83A0AgAULh9dHw+qi49T83A1AgAULh9dHw+qi49T83A1ggAULh9dHw+qi49T83A2AgAULh9dHw+qi49T83A2ggAULh9dHw+qi49T83A3AgAULh9dHw+qi49T83A3ggAUKas+bMmbPm5D83AzggAUKas+bMmbPm5D83AzAgAUKas+bMmbPm5D83AyggAUKas+bMmbPm5D83AyAgAUKas+bMmbPm5D83AxggAUKas+bMmbPm5D83AxAgAUKas+bMmbPm5D83AwggAUKas+bMmbPm5D83AwAgAEH40AFqQuH10fD6qLj1PzcDACAAQfDQAWpC4fXR8PqouPU/NwMAIABB6NABakLh9dHw+qi49T83AwAgAEHg0AFqQuH10fD6qLj1PzcDACAAQdjQAWpC4fXR8PqouPU/NwMAIABB0NABakLh9dHw+qi49T83AwAgAEHI0AFqQuH10fD6qLj1PzcDACAAQcDQAWpC4fXR8PqouPU/NwMAIABB4NQBaiABKQMgNwMAIABB6NQBaiABKQMoNwMAIABBwNQBaiABKQMANwMAIABByNQBaiABKQMINwMAIABB2NQBaiABKQMYNwMAIABB8NQBaiABKQMwNwMAIABB+NQBaiABKQM4NwMAIABB0NQBaiABKQMQNwMAIABB2NIBakKAgICAgICA8D83AwAgAEHQ0gFqQoCAgICAgIDwPzcDACAAQcjSAWpCgICAgICAgPA/NwMAIABCgICAgICAgPA/NwPA0gEgAEHYzgFqQoCAgICAgNS6wAA3AwAgAEHQzgFqQoCAgICAgOS9wAA3AwAgAEHIzgFqQoCAgICAgNjAwAA3AwAgAEKAgICAgICItsAANwPAzgEgAUGAAWokACAAC5gKAgZ/AXwgAEIANwPY2AEgAEG41gFqIANEAAAAAAAA8D+kRAAAAAAAAAAApSIDOQMAIABBsNYBaiADOQMAIABBqNYBaiADOQMAIABBoNYBaiADOQMAIABBmNYBaiADOQMAIABBkNYBaiADOQMAIABBiNYBaiADOQMAIABBgNYBaiADOQMAIABB+NUBaiADOQMAIABB8NUBaiADOQMAIABB6NUBaiADOQMAIABB4NUBaiADOQMAIABB2NUBaiADOQMAIABB0NUBaiADOQMAIABByNUBaiADOQMAIABBwNUBaiADOQMAIABBuNUBaiADOQMAIABBsNUBaiADOQMAIABBqNUBaiADOQMAIABBoNUBaiADOQMAIABBmNUBaiADOQMAIABBkNUBaiADOQMAIABBiNUBaiADOQMAIABBgNUBaiADOQMAIABB+NQBaiADOQMAIABB8NQBaiADOQMAIABB6NQBaiADOQMAIABB4NQBaiADOQMAIABB2NQBaiADOQMAIABB0NQBaiADOQMAIABByNQBaiADOQMAIAAgAzkDwNQBIABBuNIBaiACRJqZmZmZmbk/okThehSuR+HqP6BEAAAAAAAA8D+kRAAAAAAAAAAApSICOQMAIABBsNIBaiACOQMAIABBqNIBaiACOQMAIABBoNIBaiACOQMAIABBmNIBaiACOQMAIABBkNIBaiACOQMAIABBiNIBaiACOQMAIABBgNIBaiACOQMAIABB+NEBaiACOQMAIABB8NEBaiACOQMAIABB6NEBaiACOQMAIABB4NEBaiACOQMAIABB2NEBaiACOQMAIABB0NEBaiACOQMAIABByNEBaiACOQMAIABBwNEBaiACOQMAIABBuNEBaiACOQMAIABBsNEBaiACOQMAIABBqNEBaiACOQMAIABBoNEBaiACOQMAIABBmNEBaiACOQMAIABBkNEBaiACOQMAIABBiNEBaiACOQMAIABBgNEBaiACOQMAIABB+NABaiACOQMAIABB8NABaiACOQMAIABB6NABaiACOQMAIABB4NABaiACOQMAIABB2NABaiACOQMAIABB0NABaiACOQMAIABByNABaiACOQMAIAAgAjkDwNABA3wgACAHQQN0aiIFQcDQAWorAwAhCiAAIAdBoAJs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ASgCBGsLIQAgA0EgaiQAIAALfwEDfyMAQRBrIgEkACABQQo6AA8CQCAAKAIQIgJFBEAgABCsBA0BIAAoAhAhAgsCQCAAKAIUIgMgAk8NACAALABLQQpGDQAgACADQQFqNgIUIANBCjoAAAwBCyAAIAFBD2pBASAAKAIkEQQAQQFHDQAgAS0ADxoLIAFBEGokAAt+AQJ/IAAEQCAAKAJMQX9MBEAgABDIBA8LIAAQyAQPC0HA7QIoAgAEQEHA7QIoAgAQxwQhAQsQqwQoAgAiAARAA0AgACgCTEEATgR/QQEFQQALGiAAKAIUIAAoAhxLBEAgABDIBCABciEBCyAAKAI4IgANAAsLQcT3AhASIAELaQECfwJAIAAoAhQgACgCHE0NACAAQQBBACAAKAIkEQQAGiAAKAIUDQBBfw8LIAAoAgQiASAAKAIIIgJJBEAgACABIAJrrEEBIAAoAigRHAAaCyAAQQA2AhwgAEIANwMQIABCADcCBEEAC0EBAn8jAEEQayIBJABBfyECAkAgABCyBA0AIAAgAUEPakEBIAAoAiARBABBAUcNACABLQAPIQILIAFBEGokACACCzEBAn8gABCrBCIBKAIANgI4IAEoAgAiAgRAIAIgADYCNAsgASAANgIAQcT3AhASIAALUAEBfgJAIANBwABxBEAgAiADQUBqrYghAUIAIQIMAQsgA0UNACACQcAAIANrrYYgASADrSIEiIQhASACIASIIQILIAAgATcDACAAIAI3AwgLUAEBfgJAIANBwABxBEAgASADQUBqrYYhAkIAIQEMAQsgA0UNACACIAOtIgSGIAFBwAAgA2utiIQhAiABIASGIQELIAAgATcDACAAIAI3AwgL2QMCAn8CfiMAQSBrIgIkAAJAIAFC////////////AIMiBUKAgICAgIDA/0N8IAVCgICAgICAwIC8f3xUBEAgAUIEhiAAQjyIhCEEIABC//////////8PgyIAQoGAgICAgICACFoEQCAEQoGAgICAgICAwAB8IQQMAgsgBEKAgICAgICAgEB9IQQgAEKAgICAgICAgAiFQgBSDQEgBEIBgyAEfCEEDAELIABQIAVCgICAgICAwP//AFQgBUKAgICAgIDA//8AURtFBEAgAUIEhiAAQjyIhEL/////////A4NCgICAgICAgPz/AIQhBAwBC0KA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GHRBGHUiA0EATgRAIAYgADYCACADQQBHIQQMBAsgASwAACEAQfjrAigCACgCAEUEQCAGIABB/78DcTYCAEEBIQQMBAsgAEH/AXFBvn5qIgBBMksNASAAQQJ0QfCYAWooAgAhAyACQX9qIgBFDQIgAUEBaiEBCyABLQAAIghBA3YiCUFwaiADQRp1IAlqckEHSw0AA0AgAEF/aiEAIAhBgH9qIANBBnRyIgNBAE4EQCAFQQA2AgAgBiADNgIAIAIgAGshBAwECyAARQ0CIAFBAWoiAS0AACIIQcABcUGAAUYNAAsLIAVBADYCAEGA9wJBGTYCAEF/IQQMAQsgBSADNgIACyAHQRBqJAAgBAvLAQIEfwJ+IwBBEGsiAyQAIAG8IgRBgICAgHhxIQUCfiAEQf////8HcSICQYCAgHxqQf////cHTQRAIAKtQhmGQoCAgICAgIDAP3wMAQsgAkGAgID8B08EQCAErUIZhkKAgICAgIDA//8AhAwBCyACRQRAQgAMAQsgAyACrUIAIAJnIgJB0QBqEMwEIAMpAwAhBiADKQMIQoCAgICAgMAAhUGJ/wAgAmutQjCGhAshByAAIAY3AwAgACAHIAWtQiCGhDcDCCADQRBqJAALngsCBX8PfiMAQeAAayIFJAAgBEIvhiADQhGIhCEPIAJCIIYgAUIgiIQhDSAEQv///////z+DIg5CD4YgA0IxiIQhECACIASFQoCAgICAgICAgH+DIQogDkIRiCERIAJC////////P4MiC0IgiCESIARCMIinQf//AXEhBwJAAn8gAkIwiKdB//8BcSIJQX9qQf3/AU0EQEEAIAdBf2pB/v8BSQ0BGgsgAVAgAkL///////////8AgyIMQoCAgICAgMD//wBUIAxCgICAgICAwP//AFEbRQRAIAJCgICAgICAIIQhCgwCCyADUCAEQv///////////wCDIgJCgICAgICAwP//AFQgAkKAgICAgIDA//8AURtFBEAgBEKAgICAgIAghCEKIAMhAQwCCyABIAxCgICAgICAwP//AIWEUARAIAIgA4RQBEBCgICAgICA4P//ACEKQgAhAQwDCyAKQoCAgICAgMD//wCEIQpCACEBDAILIAMgAkKAgICAgIDA//8AhYRQBEAgASAMhCECQgAhASACUARAQoCAgICAgOD//wAhCgwDCyAKQoCAgICAgMD//wCEIQoMAgsgASAMhFAEQEIAIQEMAgsgAiADhFAEQEIAIQEMAgsgDEL///////8/WARAIAVB0ABqIAEgCyABIAsgC1AiBht5IAZBBnStfKciBkFxahDMBCAFKQNYIgtCIIYgBSkDUCIBQiCIhCENIAtCIIghEkEQIAZrIQYLIAYgAkL///////8/Vg0AGiAFQUBrIAMgDiADIA4gDlAiCBt5IAhBBnStfKciCEFxahDMBCAFKQNIIgJCD4YgBSkDQCIDQjGIhCEQIAJCL4YgA0IRiIQhDyACQhGIIREgBiAIa0EQagshBiAPQv////8PgyICIAFC/////w+DIgF+Ig8gA0IPhkKAgP7/D4MiAyANQv////8PgyIMfnwiBEIghiIOIAEgA358Ig0gDlStIAIgDH4iFSADIAtC/////w+DIgt+fCITIBBC/////w+DIg4gAX58IhAgBCAPVK1CIIYgBEIgiIR8IhQgAiALfiIWIAMgEkKAgASEIg9+fCIDIAwgDn58IhIgASARQv////8Hg0KAgICACIQiAX58IhFCIIZ8Ihd8IQQgByAJaiAGakGBgH9qIQYCQCALIA5+IhggAiAPfnwiAiAYVK0gAiABIAx+fCIMIAJUrXwgDCATIBVUrSAQIBNUrXx8IgIgDFStfCABIA9+fCABIAt+IgsgDiAPfnwiASALVK1CIIYgAUIgiIR8IAIgAUIghnwiASACVK18IAEgESASVK0gAyAWVK0gEiADVK18fEIghiARQiCIhHwiAyABVK18IAMgFCAQVK0gFyAUVK18fCICIANUrXwiAUKAgICAgIDAAINQRQRAIAZBAWohBgwBCyANQj+IIQMgAUIBhiACQj+IhCEBIAJCAYYgBEI/iIQhAiANQgGGIQ0gAyAEQgGGhCEECyAGQf//AU4EQCAKQoCAgICAgMD//wCEIQpCACEBDAELAn4gBkEATARAQQEgBmsiB0H/AE0EQCAFQRBqIA0gBCAHEMsEIAVBIGogAiABIAZB/wBqIgYQzAQgBUEwaiANIAQgBhDMBCAFIAIgASAHEMsEIAUpAzAgBSkDOIRCAFKtIAUpAyAgBSkDEISEIQ0gBSkDKCAFKQMYhCEEIAUpAwAhAiAFKQMIDAILQgAhAQwCCyABQv///////z+DIAatQjCGhAsgCoQhCiANUCAEQn9VIARCgICAgICAgICAf1EbRQRAIAogAkIBfCIBIAJUrXwhCgwBCyANIARCgICAgICAgICAf4WEUEUEQCACIQEMAQsgCiACIAJCAYN8IgEgAlStfCEKCyAAIAE3AwAgACAKNwMIIAVB4ABqJAALfwICfwF+IwBBEGsiAyQAIAACfiABRQRAQgAMAQsgAyABIAFBH3UiAmogAnMiAq1CACACZyICQdEAahDMBCADKQMIQoCAgICAgMAAhUGegAEgAmutQjCGfCABQYCAgIB4ca1CIIaEIQQgAykDAAs3AwAgACAENwMIIANBEGokAAvICQIEfwR+IwBB8ABrIgUkACAEQv///////////wCDIQoCQAJAIAFCf3wiC0J/USACQv///////////wCDIgkgCyABVK18Qn98IgtC////////v///AFYgC0L///////+///8AURtFBEAgA0J/fCILQn9SIAogCyADVK18Qn98IgtC////////v///AFQgC0L///////+///8AURsNAQsgAVAgCUKAgICAgIDA//8AVCAJQoCAgICAgMD//wBRG0UEQCACQoCAgICAgCCEIQQgASEDDAILIANQIApCgICAgICAwP//AFQgCkKAgICAgIDA//8AURtFBEAgBEKAgICAgIAghCEEDAILIAEgCUKAgICAgIDA//8AhYRQBEBCgICAgICA4P//ACACIAEgA4UgAiAEhUKAgICAgICAgIB/hYRQIgYbIQRCACABIAYbIQMMAgsgAyAKQoCAgICAgMD//wCFhFANASABIAmEUARAIAMgCoRCAFINAiABIAODIQMgAiAEgyEEDAILIAMgCoRQRQ0AIAEhAyACIQQMAQsgAyABIAMgAVYgCiAJViAJIApRGyIHGyEKIAQgAiAHGyILQv///////z+DIQkgAiAEIAcbIgJCMIinQf//AXEhCCALQjCIp0H//wFxIgZFBEAgBUHgAGogCiAJIAogCSAJUCIGG3kgBkEGdK18pyIGQXFqEMwEIAUpA2ghCSAFKQNgIQpBECAGayEGCyABIAMgBxshAyACQv///////z+DIQEgCAR+IAEFIAVB0ABqIAMgASADIAEgAVAiBxt5IAdBBnStfKciB0FxahDMBEEQIAdrIQggBSkDUCEDIAUpA1gLQgOGIANCPYiEQoCAgICAgIAEhCEEIAlCA4YgCkI9iIQhASACIAuFIQwCfiADQgOGIgMgBiAIayIHRQ0AGiAHQf8ASwRAQgAhBEIBDAELIAVBQGsgAyAEQYABIAdrEMwEIAVBMGogAyAEIAcQywQgBSkDOCEEIAUpAzAgBSkDQCAFKQNIhEIAUq2ECyEDIAFCgICAgICAgASEIQkgCkIDhiECAkAgDEJ/VwRAIAIgA30iASAJIAR9IAIgA1StfSIDhFAEQEIAIQNCACEEDAMLIANC/////////wNWDQEgBUEgaiABIAMgASADIANQIgcbeSAHQQZ0rXynQXRqIgcQzAQgBiAHayEGIAUpAyghAyAFKQMgIQEMAQsgAiADfCIBIANUrSAEIAl8fCIDQoCAgICAgIAIg1ANACABQgGDIANCP4YgAUIBiISEIQEgBkEBaiEGIANCAYghAwsgC0KAgICAgICAgIB/gyECIAZB//8BTgRAIAJCgICAgICAwP//AIQhBEIAIQMMAQtBACEHAkAgBkEASgRAIAYhBwwBCyAFQRBqIAEgAyAGQf8AahDMBCAFIAEgA0EBIAZrEMsEIAUpAwAgBSkDECAFKQMYhEIAUq2EIQEgBSkDCCEDCyADQj2GIAFCA4iEIgQgAadBB3EiBkEES618IgEgBFStIANCA4hC////////P4MgAoQgB61CMIaEfCABIAFCAYNCACAGQQRGGyIBfCIDIAFUrXwhBAsgACADNwMAIAAgBDcDCCAFQfAAaiQAC4ECAgJ/BH4jAEEQayICJAAgAb0iBUKAgICAgICAgIB/gyEHAn4gBUL///////////8AgyIEQoCAgICAgIB4fEL/////////7/8AWARAIARCPIYhBiAEQgSIQoCAgICAgICAPHwMAQsgBEKAgICAgICA+P8AWgRAIAVCPIYhBiAFQgSIQoCAgICAgMD//wCEDAELIARQBEBCAAwBCyACIARCACAEQoCAgIAQWgR/IARCIIinZwUgBadnQSBqCyIDQTFqEMwEIAIpAwAhBiACKQMIQoCAgICAgMAAhUGM+AAgA2utQjCGhAshBCAAIAY3AwAgACAEIAeENwMIIAJBEGokAAvbAQIBfwJ+QQEhBAJAIABCAFIgAUL///////////8AgyIFQoCAgICAgMD//wBWIAVCgICAgICAwP//AFEbDQAgAkIAUiADQv///////////wCDIgZCgICAgICAwP//AFYgBkKAgICAgIDA//8AURsNACAAIAKEIAUgBoSEUARAQQAPCyABIAODQgBZBEBBfyEEIAAgAlQgASADUyABIANRGw0BIAAgAoUgASADhYRCAFIPC0F/IQQgACACViABIANVIAEgA1EbDQAgACAChSABIAOFhEIAUiEECyAEC9gBAgF/AX5BfyECAkAgAEIAUiABQv///////////wCDIgNCgICAgICAwP//AFYgA0KAgICAgIDA//8AURsNACAAIANCgICAgICAgP8/hIRQBEBBAA8LIAFCgICAgICAgP8/g0IAWQRAIABCAFQgAUKAgICAgICA/z9TIAFCgICAgICAgP8/URsNASAAIAFCgICAgICAgP8/hYRCAFIPCyAAQgBWIAFCgICAgICAgP8/VSABQoCAgICAgID/P1EbDQAgACABQoCAgICAgID/P4WEQgBSIQILIAILNQAgACABNwMAIAAgAkL///////8/gyAEQjCIp0GAgAJxIAJCMIinQf//AXFyrUIwhoQ3AwgLZwIBfwF+IwBBEGsiAiQAIAACfiABRQRAQgAMAQsgAiABrUIAQfAAIAFnQR9zIgFrEMwEIAIpAwhCgICAgICAwACFIAFB//8Aaq1CMIZ8IQMgAikDAAs3AwAgACADNwMIIAJBEGokAAtFAQF/IwBBEGsiBSQAIAUgASACIAMgBEKAgICAgICAgIB/hRDSBSAFKQMAIQEgACAFKQMINwMIIAAgATcDACAFQRBqJAALxAIBAX8jAEHQAGsiBCQAAkAgA0GAgAFOBEAgBEEgaiABIAJCAEKAgICAgICA//8AENAFIAQpAyghAiAEKQMgIQEgA0H//wFIBEAgA0GBgH9qIQMMAgsgBEEQaiABIAJCAEKAgICAgICA//8AENAFIANB/f8CIANB/f8CSBtBgoB+aiEDIAQpAxghAiAEKQMQIQEMAQsgA0GBgH9KDQAgBEFAayABIAJCAEKAgICAgIDAABDQBSAEKQNIIQIgBCkDQCEBIANBg4B+SgRAIANB/v8AaiEDDAELIARBMGogASACQgBCgICAgICAwAAQ0AUgA0GGgH0gA0GGgH1KG0H8/wFqIQMgBCkDOCECIAQpAzAhAQsgBCABIAJCACADQf//AGqtQjCGENAFIAAgBCkDCDcDCCAAIAQpAwA3AwAgBEHQAGokAAuOEQIFfwx+IwBBwAFrIgUkACAEQv///////z+DIRIgAkL///////8/gyEMIAIgBIVCgICAgICAgICAf4MhESAEQjCIp0H//wFxIQcCQAJAAkAgAkIwiKdB//8BcSIJQX9qQf3/AU0EQCAHQX9qQf7/AUkNAQsgAVAgAkL///////////8AgyIKQoCAgICAgMD//wBUIApCgICAgICAwP//AFEbRQRAIAJCgICAgICAIIQhEQwCCyADUCAEQv///////////wCDIgJCgICAgICAwP//AFQgAkKAgICAgIDA//8AURtFBEAgBEKAgICAgIAghCERIAMhAQwCCyABIApCgICAgICAwP//AIWEUARAIAMgAkKAgICAgIDA//8AhYRQBEBCACEBQoCAgICAgOD//wAhEQwDCyARQoCAgICAgMD//wCEIRFCACEBDAILIAMgAkKAgICAgIDA//8AhYRQBEBCACEBDAILIAEgCoRQDQIgAiADhFAEQCARQoCAgICAgMD//wCEIRFCACEBDAILIApC////////P1gEQCAFQbABaiABIAwgASAMIAxQIgYbeSAGQQZ0rXynIgZBcWoQzARBECAGayEGIAUpA7gBIQwgBSkDsAEhAQsgAkL///////8/Vg0AIAVBoAFqIAMgEiADIBIgElAiCBt5IAhBBnStfKciCEFxahDMBCAGIAhqQXBqIQYgBSkDqAEhEiAFKQOgASEDCyAFQZABaiASQoCAgICAgMAAhCIUQg+GIANCMYiEIgJChMn5zr/mvIL1ACACfSIEEMwFIAVBgAFqQgAgBSkDmAF9IAQQzAUgBUHwAGogBSkDiAFCAYYgBSkDgAFCP4iEIgQgAhDMBSAFQeAAaiAEQgAgBSkDeH0QzAUgBUHQAGogBSkDaEIBhiAFKQNgQj+IhCIEIAIQzAUgBUFAayAEQgAgBSkDWH0QzAUgBUEwaiAFKQNIQgGGIAUpA0BCP4iEIgQgAhDMBSAFQSBqIARCACAFKQM4fRDMBSAFQRBqIAUpAyhCAYYgBSkDIEI/iIQiBCACEMwFIAUgBEIAIAUpAxh9EMwFIAYgCSAHa2ohBgJ+QgAgBSkDCEIBhiAFKQMAQj+IhEJ/fCIKQv////8PgyIEIAJCIIgiDn4iECAKQiCIIgogAkL/////D4MiC358IgJCIIYiDSAEIAt+fCILIA1UrSAKIA5+IAIgEFStQiCGIAJCIIiEfHwgCyAEIANCEYhC/////w+DIg5+IhAgCiADQg+GQoCA/v8PgyINfnwiAkIghiIPIAQgDX58IA9UrSAKIA5+IAIgEFStQiCGIAJCIIiEfHx8IgIgC1StfCACQgBSrXx9IgtC/////w+DIg4gBH4iECAKIA5+Ig0gBCALQiCIIg9+fCILQiCGfCIOIBBUrSAKIA9+IAsgDVStQiCGIAtCIIiEfHwgDkIAIAJ9IgJCIIgiCyAEfiIQIAJC/////w+DIg0gCn58IgJCIIYiDyAEIA1+fCAPVK0gCiALfiACIBBUrUIghiACQiCIhHx8fCICIA5UrXwgAkJ+fCIQIAJUrXxCf3wiC0L/////D4MiAiAMQgKGIAFCPoiEQv////8PgyIEfiIOIAFCHohC/////w+DIgogC0IgiCILfnwiDSAOVK0gDSAQQiCIIg4gDEIeiEL//+//D4NCgIAQhCIMfnwiDyANVK18IAsgDH58IAIgDH4iEyAEIAt+fCINIBNUrUIghiANQiCIhHwgDyANQiCGfCINIA9UrXwgDSAKIA5+IhMgEEL/////D4MiECAEfnwiDyATVK0gDyACIAFCAoZC/P///w+DIhN+fCIVIA9UrXx8Ig8gDVStfCAPIAsgE34iCyAMIBB+fCIMIAQgDn58IgQgAiAKfnwiAkIgiCACIARUrSAMIAtUrSAEIAxUrXx8QiCGhHwiDCAPVK18IAwgFSAOIBN+IgQgCiAQfnwiCkIgiCAKIARUrUIghoR8IgQgFVStIAQgAkIghnwgBFStfHwiBCAMVK18IgJC/////////wBYBEAgAUIxhiAEQv////8PgyIBIANC/////w+DIgp+IgxCAFKtfUIAIAx9IhAgBEIgiCIMIAp+Ig0gASADQiCIIgt+fCIOQiCGIg9UrX0gAkL/////D4MgCn4gASASQv////8Pg358IAsgDH58IA4gDVStQiCGIA5CIIiEfCAEIBRCIIh+IAMgAkIgiH58IAIgC358IAwgEn58QiCGfH0hEiAGQX9qIQYgECAPfQwBCyAEQiGIIQsgAUIwhiACQj+GIARCAYiEIgRC/////w+DIgEgA0L/////D4MiCn4iDEIAUq19QgAgDH0iDiABIANCIIgiDH4iECALIAJCH4aEIg1C/////w+DIg8gCn58IgtCIIYiE1StfSAMIA9+IAogAkIBiCIKQv////8Pg358IAEgEkL/////D4N+fCALIBBUrUIghiALQiCIhHwgBCAUQiCIfiADIAJCIYh+fCAKIAx+fCANIBJ+fEIghnx9IRIgCiECIA4gE30LIQEgBkGAgAFOBEAgEUKAgICAgIDA//8AhCERQgAhAQwBCyAGQf//AGohByAGQYGAf0wEQAJAIAcNACAEIAFCAYYgA1YgEkIBhiABQj+IhCIBIBRWIAEgFFEbrXwiASAEVK0gAkL///////8/g3wiAkKAgICAgIDAAINQDQAgAiARhCERDAILQgAhAQwBCyAEIAFCAYYgA1ogEkIBhiABQj+IhCIBIBRaIAEgFFEbrXwiASAEVK0gAkL///////8/gyAHrUIwhoR8IBGEIRELIAAgATcDACAAIBE3AwggBUHAAWokAA8LIABCADcDACAAIBFCgICAgICA4P//ACACIAOEQgBSGzcDCCAFQcABaiQAC6UIAgV/An4jAEEwayIFJAACQCACQQJNBEAgAkECdCICQYybAWooAgAhByACQYCbAWooAgAhCANAAn8gASgCBCICIAEoAmhJBEAgASACQQFqNgIEIAItAAAMAQsgARDLBQsiAiIEQSBGIARBd2pBBUlyDQALAkAgAkFVaiIEQQJLBEBBASEGDAELQQEhBiAEQQFrRQ0AQX9BASACQS1GGyEGIAEoAgQiAiABKAJoSQRAIAEgAkEBajYCBCACLQAAIQIMAQsgARDLBSECC0EAIQQCQAJAA0AgBEG8mgFqLAAAIAJBIHJGBEACQCAEQQZLDQAgASgCBCICIAEoAmhJBEAgASACQQFqNgIEIAItAAAhAgwBCyABEMsFIQILIARBAWoiBEEIRw0BDAILCyAEQQNHBEAgBEEIRg0BIANFDQIgBEEESQ0CIARBCEYNAQsgASgCaCICBEAgASABKAIEQX9qNgIECyADRQ0AIARBBEkNAANAIAIEQCABIAEoAgRBf2o2AgQLIARBf2oiBEEDSw0ACwsgBSAGskMAAIB/lBDPBSAFKQMIIQkgBSkDACEKDAILAkACQAJAIAQNAEEAIQQDQCAEQcWaAWosAAAgAkEgckcNAQJAIARBAUsNACABKAIEIgIgASgC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ASAAKAJoSQRAIAAgAUEBajYCBCABLQAADAELIAAQywULQVBqQQpJDQALCyAAKAJoBEAgACAAKAIEQX9qNgIEC0IAIAZ9IAYgBRshBgwBC0KAgICAgICAgIB/IQYgACgCaEUNACAAIAAoAgRBf2o2AgRCgICAgICAgICAfw8LIAYLtgMCA38BfiMAQSBrIgMkAAJAIAFC////////////AIMiBUKAgICAgIDAv0B8IAVCgICAgICAwMC/f3xUBEAgAUIZiKchAiAAUCABQv///w+DIgVCgICACFQgBUKAgIAIURtFBEAgAkGBgICABGohAgwCCyACQYCAgIAEaiECIAAgBUKAgIAIhYRCAFINASACQQFxIAJqIQIMAQsgAFAgBUKAgICAgIDA//8AVCAFQoCAgICAgMD//wBRG0UEQCABQhmIp0H///8BcUGAgID+B3IhAgwBC0GAgID8ByECIAVC////////v7/AAFYNAEEAIQIgBUIwiKciBEGR/gBJDQAgAyAAIAFC////////P4NCgICAgICAwACEIgVBgf8AIARrEMsEIANBEGogACAFIARB/4F/ahDMBCADKQMIIgBCGYinIQIgAykDACADKQMQIAMpAxiEQgBSrYQiBVAgAEL///8PgyIAQoCAgAhUIABCgICACFEbRQRAIAJBAWohAgwBCyAFIABCgICACIWEQgBSDQAgAkEBcSACaiECCyADQSBqJAAgAiABQiCIp0GAgICAeHFyvgvxEwINfwN+IwBBsAJrIgYkACAAKAJMQQBOBH9BAQVBAAsaAkAgAS0AACIERQ0AAkADQAJAAkAgBEH/AXEiA0EgRiADQXdqQQVJcgRAA0AgASIEQQFqIQEgBC0AASIDQSBGIANBd2pBBUlyDQALIABCABDKBQNAAn8gACgCBCIBIAAoAmhJBEAgACABQQFqNgIEIAEtAAAMAQsgABDLBQsiAUEgRiABQXdqQQVJcg0ACwJAIAAoAmhFBEAgACgCBCEBDAELIAAgACgCBEF/aiIBNgIECyABIAAoAghrrCAAKQN4IBB8fCEQDAELAkACQAJAIAEtAAAiBEElRgRAIAEtAAEiA0EqRg0BIANBJUcNAgsgAEIAEMoFIAEgBEElRmohBAJ/IAAoAgQiASAAKAJoSQRAIAAgAUEBajYCBCABLQAADAELIAAQywUL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ATYCvAEgBSAFQRBqNgIMIAVBADYCCANAAkAgBUHYAmogBUHQAmoQjwVFDQAgBSgCvAECfyAALAALQQBIBEAgACgCBAwBCyAALQALCyABakYEQAJ/IAAiASwAC0EASARAIAEoAgQMAQsgAS0ACwshAiABAn8gASwAC0EASARAIAEoAgQMAQsgAS0ACwtBAXQQkAYgASABLAALQQBIBH8gASgCCEH/////B3FBf2oFQQoLEJAGIAUgAgJ/IAEsAAtBAEgEQCAAKAIADAELIAALIgFqNgK8AQsCfyAFKALYAiICKAIMIgggAigCEEYEQCACIAIoAgAoAiQRAAAMAQsgCCgCAAsgBiABIAVBvAFqIAVBCGogBSgCzAIgBUHQAWogBUEQaiAFQQxqIAcQuAYNACAFQdgCahCQBRoMAQsLAkACfyAFLADbAUEASARAIAUoAtQBDAELIAUtANsBC0UNACAFKAIMIgIgBUEQamtBnwFKDQAgBSACQQRqNgIMIAIgBSgCCDYCAAsgBCABIAUoArwBIAMgBhCfBjcDACAFQdABaiAFQRBqIAUoAgwgAxCTBiAFQdgCaiAFQdACahCRBQRAIAMgAygCAEECcjYCAAsgBSgC2AIhASAAEPgIGiAFQdABahD4CBogBUHgAmokACABCw8AIAEgAiADIAQgBRDCBguZBQECfyMAQfACayIFJAAgBSABNgLgAiAFIAA2AugCIAVByAFqIAIgBUHgAWogBUHcAWogBUHYAWoQwwYgBUG4AWoQjwYiASABLAALQQBIBH8gASgCCEH/////B3FBf2oFQQoLEJAGIAUCfyABLAALQQBIBEAgASgCAAwBCyABCyIANgK0ASAFIAVBEGo2AgwgBUEANgIIIAVBAToAByAFQcUAOgAGA0ACQCAFQegCaiAFQeACahCPBUUNACAFKAK0AQJ/IAEsAAtBAEgEQCABKAIEDAELIAEtAAsLIABqRgRAAn8gASIALAALQQBIBEAgACgCBAwBCyAALQALCyECIAACfyAALAALQQBIBEAgACgCBAwBCyAALQALC0EBdBCQBiAAIAAsAAtBAEgEfyAAKAIIQf////8HcUF/agVBCgsQkAYgBSACAn8gACwAC0EASARAIAEoAgAMAQsgAQsiAGo2ArQBCwJ/IAUoAugCIgIoAgwiBiACKAIQRgRAIAIg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An8CfyAALAALQQBIBEAgACgCAAwBCyAACyEHIAECfyAALAALQQBIBEAgACgCAAwBCyAACwJ/IAAsAAtBAEgEQCAAKAIEDAELIAAtAAsLQQJ0akkgByABTXELBEAgAAJ/An8gA0IANwIAIANBADYCCCADIAEgAhCEBiADIgAsAAtBAEgLBEAgACgCAAwBCyAACwJ/IAMsAAtBAEgEQCADKAIEDAELIAMtAAsLEIcJIAMQ+AgaDAELIAQgBWsgBkkEQCAAIAQgBSAGaiAEayAFIAUQhgkLAn8gACwAC0EASARAIAAoAgAMAQsgAAsgBUECdGohBANAIAEgAkcEQCAEIAEoAgA2AgAgAUEEaiEBIARBBGohBAwBCwsgA0EANgIAIAQgAygCADYCACAFIAZqIQECQCAALAALQQBIBEAgACABNgIEDAELIAAgAToACwsLIANBEGokAAsLACAAQfSQAxCJBgsgACAAEOsIIAAgASgCCDYCCCAAIAEpAgA3AgAgARCuBgsLACAAQeyQAxCJBgt+AQF/IwBBIGsiAyQAIAMgATYCECADIAA2AhggAyACNgIIA0ACQAJ/QQEgAygCGCADKAIQRkEBc0UNABogAygCGCgCACADKAIIKAIARg0BQQALIQAgA0EgaiQAIAAPCyADIAMoAhhBBGo2AhggAyADKAIIQQRqNgIIDAAACwALNwEBfyMAQRBrIgIkACACIAAoAgA2AgggAiACKAIIIAFBAnRqNgIIIAIoAgghACACQRBqJAAgAAv0BgELfyMAQdADayIAJAAgACAFNwMQIAAgBjcDGCAAIABB4AJqNgLcAiAAQeACaiAAQRBqEO8FIQkgAEGiBTYC8AEgAEHoAWpBACAAQfABahCKBiELIABBogU2AvABIABB4AFqQQAgAEHwAWoQigYhCiAAQfABaiEMAkAgCUHkAE8EQBCsBiEHIAAgBTcDACAAIAY3AwggAEHcAmogB0GvvQEgABDcBiEJIAAoAtwCIghFDQEgCygCACEHIAsgCDYCACAHBEAgByALKAIEEQEACyAJEMMJIQggCigCACEHIAogCDYCACAHBEAgByAKKAIEEQEACyAKKAIAQQBHQQFzDQEgCigCACEMCyAAIAMoAhwiBzYC2AEgByAHKAIEQQFqNgIEIABB2AFqEIEFIhEiByAAKALcAiIIIAgg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AigCAEEBdGovAQAgAXFFDQAgAkEEaiECDAELCyACIQMLIAMLHgAgAUH/AE0Ef0GAowEoAgAgAUECdGooAgAFIAELC0EAA0AgASACRwRAIAEgASgCACIAQf8ATQR/QYCjASgCACABKAIAQQJ0aigCAAUgAAs2AgAgAUEEaiEBDAELCyACCx4AIAFB/wBNBH9BkK8BKAIAIAFBAnRqKAIABSABCwtBAANAIAEgAkcEQCABIAEoAgAiAEH/AE0Ef0GQrwEoAgAgASgCAEECdGooAgAFIAALNgIAIAFBBGohAQwBCwsgAgsEACABCyoAA0AgASACRkUEQCADIAEsAAA2AgAgA0EEaiEDIAFBAWohAQwBCwsgAgsTACABIAIgAUGAAUkbQRh0QRh1CzUAA0AgASACRkUEQCAEIAEoAgAiACADIABBgAFJGzoAACAEQQFqIQQgAUEEaiEBDAELCyACCykBAX8gAEHUvQE2AgACQCAAKAIIIgFFDQAgAC0ADEUNACABEMQJCyAACwoAIAAQ/wcQxAkLJwAgAUEATgR/QYCjASgCACABQf8BcUECdGooAgAFIAELQRh0QRh1C0AAA0AgASACRwRAIAEgASwAACIAQQBOBH9BgKMBKAIAIAEsAABBAnRqKAIABSAACzoAACABQQFqIQEMAQsLIAILJwAgAUEATgR/QZCvASgCACABQf8BcUECdGooAgAFIAELQRh0QRh1C0AAA0AgASACRwRAIAEgASwAACIAQQBOBH9BkK8BKAIAIAEsAABBAnRqKAIABSAACzoAACABQQFqIQEMAQsLIAILKgADQCABIAJGRQRAIAMgAS0AADoAACADQQFqIQMgAUEBaiEBDAELCyACCwwAIAEgAiABQX9KGws0AANAIAEgAkZFBEAgBCABLAAAIgAgAyAAQX9KGzoAACAEQQFqIQQgAUEBaiEBDAELCyACCxIAIAQgAjYCACAHIAU2AgBBAwsLACAEIAI2AgBBAwtYACMAQRBrIgAkACAAIAQ2AgwgACADIAJrNgIIIwBBEGsiASQAIABBCGoiAigCACAAQQxqIgMoAgBJIQQgAUEQaiQAIAIgAyAEGygCACEBIABBEGokACABCwoAIAAQ3AcQxAkL3gMBBX8jAEEQayIJJAAgAiEIA0ACQCADIAhGBEAgAyEIDAELIAgoAgBFDQAg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AEEACy4AA0AgACgCAEEBRg0ACyAAKAIARQRAIABBATYCACABQaUFEQEAIABBfzYCAAsLMQECfyAAQQEgABshAANAAkAgABDDCSIBDQBBjKADKAIAIgJFDQAgAhEHAAwBCwsgAQs6AQJ/IAEQuQQiAkENahDxCCIDQQA2AgggAyACNgIEIAMgAjYCACAAIANBDGogASACQQFqEM8JNgIACykBAX8gAgRAIAAhAwNAIAMgATYCACADQQRqIQMgAkF/aiICDQALCyAAC2kBAX8CQCAAIAFrQQJ1IAJJBEADQCAAIAJBf2oiAkECdCIDaiABIANqKAIANgIAIAINAAwCAAsACyACRQ0AIAAhAwNAIAMgASgCADYCACADQQRqIQMgAUEEaiEBIAJBf2oiAg0ACwsgAAsKAEHc7AEQ5AIAC1kBAn8jAEEQayIDJAAgAEIANwIAIABBADYCCCAAIQICQCABLAALQQBOBEAgAiABKAIINgIIIAIgASkCADcCAAwBCyAAIAEoAgAgASgCBBD3CAsgA0EQaiQAC5wBAQN/IwBBEGsiBCQAQW8gAk8EQAJAIAJBCk0EQCAAIAI6AAsgACEDDAELIAAgAkELTwR/IAJBEGpBcHEiAyADQX9qIgMgA0ELRhsFQQoLQQFqIgUQ3QgiAzYCACAAIAVBgICAgHhyNgIIIAAgAjYCBAsgAyABIAIQ7wQgBEEAOgAPIAIgA2ogBC0ADzoAACAEQRBqJAAPCxD1CAALHQAgACwAC0EASARAIAAoAggaIAAoAgAQxAkLIAALyQEBA38jAEEQayIEJAACQCAALAALQQBIBH8gACgCCEH/////B3FBf2oFQQoLIgMgAk8EQAJ/IAAsAAtBAEgEQCAAKAIADAELIAALIgMhBSACBEAgBSABIAIQ0QkLIARBADoADyACIANqIAQtAA86AAACQCAALAALQQBIBEAgACACNgIEDAELIAAgAjoACwsMAQsgACADIAIgA2sCfyAALAALQQBIBEAgACgCBAwBCyAALQALCyIAQQAgACACIAEQ+ggLIARBEGokAAvMAgEFfyMAQRBrIggkACABQX9zQW9qIAJPBEACfyAALAALQQBIBEAgACgCAAwBCyAACyEJAn9B5////wcgAUsEQCAIIAFBAXQ2AgggCCABIAJqNgIMAn8jAEEQayICJAAgCEEMaiIKKAIAIAhBCGoiCygCAEkhDCACQRBqJAAgCyAKIAwbKAIAIgJBC08LBH8gAkEQakFwcSICIAJBf2oiAiACQQtGGwVBCgsMAQtBbgtBAWoiChDdCCECIAQEQCACIAkgBBDvBAsgBgRAIAIgBGogByAGEO8ECyADIAVrIgMgBGsiBwRAIAIgBGogBmogBCAJaiAFaiAHEO8ECyABQQpHBEAgCRDECQsgACACNgIAIAAgCkGAgICAeHI2AgggACADIAZqIgA2AgQgCEEAOgAHIAAgAmogCC0ABzoAACAIQRBqJAAPCxD1CAALOAEBfwJ/IAAsAAtBAEgEQCAAKAIEDAELIAAtAAsLIgIgAUkEQCAAIAEgAmsQ/AgPCyAAIAEQ/QgLyQEBBH8jAEEQayIFJAAgAQRAIAAsAAtBAEgEfyAAKAIIQf////8HcUF/agVBCgshAgJ/IAAsAAtBAEgEQCAAKAIEDAELIAAtAAsLIgMgAWohBCACIANrIAFJBEAgACACIAQgAmsgAyADEP4ICyADAn8gACwAC0EASARAIAAoAgAMAQsgAAsiAmogAUEAEP8IAkAgACwAC0EASARAIAAgBDYCBAwBCyAAIAQ6AAsLIAVBADoADyACIARqIAUtAA86AAALIAVBEGokAAthAQJ/IwBBEGsiAiQAAkAgACwAC0EASARAIAAoAgAhAyACQQA6AA8gASADaiACLQAPOgAAIAAgATYCBAwBCyACQQA6AA4gACABaiACLQAOOgAAIAAgAToACwsgAkEQaiQAC40CAQV/IwBBEGsiBSQAQW8gAWsgAk8EQAJ/IAAsAAtBAEgEQCAAKAIADAELIAALIQYCf0Hn////ByABSwRAIAUgAUEBdDYCCCAFIAEgAmo2AgwCfyMAQRBrIgIkACAFQQxqIgcoAgAgBUEIaiIIKAIASSEJIAJBEGokACAIIAcgCRsoAgAiAkELTwsEfyACQRBqQXBxIgIgAkF/aiICIAJBC0YbBUEKCwwBC0FuC0EBaiIHEN0IIQIgBARAIAIgBiAEEO8ECyADIARrIgMEQCACIARqIAQgBmogAxDvBAsgAUEKRwRAIAYQxAkLIAAgAjYCACAAIAdBgICAgHhyNgIIIAVBEGokAA8LEPUIAAsVACABBEAgACACQf8BcSABENAJGgsL1wEBA38jAEEQayIFJAACQCAALAALQQBIBH8gACgCCEH/////B3FBf2oFQQoLIgQCfyAALAALQQBIBEAgACgCBAwBCyAALQALCyIDayACTwRAIAJFDQECfyAALAALQQBIBEAgACgCAAwBCyAACyIEIANqIAEgAhDvBCACIANqIgIhAQJAIAAsAAtBAEgEQCAAIAE2AgQMAQsgACABOgALCyAFQQA6AA8gAiAEaiAFLQAPOgAADAELIAAgBCACIANqIARrIAMgA0EAIAIgARD6CAsgBUEQaiQAC8EBAQN/IwBBEGsiAyQAIAMgAToADwJAAkACQAJAIAAsAAtBAEgEQCAAKAIEIgQgACgCCEH/////B3FBf2oiAkYNAQwDC0EKIQRBCiECIAAtAAsiAUEKRw0BCyAAIAJBASACIAIQ/gggBCEBIAAsAAtBAEgNAQsgACICIAFBAWo6AAsMAQsgACgCACECIAAgBEEBajYCBCAEIQELIAEgAmoiACADLQAPOgAAIANBADoADiAAIAMtAA46AAEgA0EQaiQACzsBAX8jAEEQayIBJAACQCAAQQE6AAsgAEEBQS0Q/wggAUEAOgAPIAAgAS0ADzoAASABQRBqJAAPAAsAC6MBAQN/IwBBEGsiBCQAQe////8DIAJPBEACQCACQQFNBEAgACACOgALIAAhAwwBCyAAIAJBAk8EfyACQQRqQXxxIgMgA0F/aiIDIANBAkYbBUEBC0EBaiIFEOkIIgM2AgAgACAFQYCAgIB4cjYCCCAAIAI2AgQLIAMgASACEPgEIARBADYCDCADIAJBAnRqIAQoAgw2AgAgBEEQaiQADwsQ9QgAC9ABAQN/IwBBEGsiBCQAAkAgACwAC0EASAR/IAAoAghB/////wdxQX9qBUEBCyIDIAJPBEACfyAALAALQQBIBEAgACgCAAwBCyAACyIFIQMgAgR/IAMgASACEPQIBSADCxogBEEANgIMIAUgAkECdGogBCgCDDYCAAJAIAAsAAtBAEgEQCAAIAI2AgQMAQsgACACOgALCwwBCyAAIAMgAiADawJ/IAAsAAtBAEgEQCAAKAIEDAELIAAtAAsLIgBBACAAIAIgARCFCQsgBEEQaiQAC+UCAQV/IwBBEGsiCCQAIAFBf3NB7////wNqIAJPBEACfyAALAALQQBIBEAgACgCAAwBCyAACyEJAn9B5////wEgAUsEQCAIIAFBAXQ2AgggCCABIAJqNgIMAn8jAEEQayICJAAgCEEMaiIKKAIAIAhBCGoiCygCAEkhDCACQRBqJAAgCyAKIAwbKAIAIgJBAk8LBH8gAkEEakF8cSICIAJBf2oiAiACQQJGGwVBAQsMAQtB7v///wMLQQFqIgoQ6QghAiAEBEAgAiAJIAQQ+AQLIAYEQCAEQQJ0IAJqIAcgBhD4BAsgAyAFayIDIARrIgcEQCAEQQJ0IgQgAmogBkECdGogBCAJaiAFQQJ0aiAHEPgECyABQQFHBEAgCRDECQsgACACNgIAIAAgCkGAgICAeHI2AgggACADIAZqIgA2AgQgCEEANgIEIAIgAEECdGogCCgCBDYCACAIQRBqJAAPCxD1CAALmgIBBX8jAEEQayIFJABB7////wMgAWsgAk8EQAJ/IAAsAAtBAEgEQCAAKAIADAELIAALIQYCf0Hn////ASABSwRAIAUgAUEBdDYCCCAFIAEgAmo2AgwCfyMAQRBrIgIkACAFQQxqIgcoAgAgBUEIaiIIKAIASSEJIAJBEGokACAIIAcgCRsoAgAiAkECTwsEfyACQQRqQXxxIgIgAkF/aiICIAJBAkYbBUEBCwwBC0Hu////AwtBAWoiBxDpCCECIAQEQCACIAYgBBD4BAsgAyAEayIDBEAgBEECdCIEIAJqIAQgBmogAxD4BAsgAUEBRwRAIAYQxAkLIAAgAjYCACAAIAdBgICAgHhyNgIIIAVBEGokAA8LEPUIAAvdAQEDfyMAQRBrIgUkAAJAIAAsAAtBAEgEfyAAKAIIQf////8HcUF/agVBAQsiBAJ/IAAsAAtBAEgEQCAAKAIEDAELIAAtAAsLIgNrIAJPBEAgAkUNAQJ/IAAsAAtBAEgEQCAAKAIADAELIAALIgQgA0ECdGogASACEPgEIAIgA2oiAiEBAkAgACwAC0EASARAIAAgATYCBAwBCyAAIAE6AAsLIAVBADYCDCAEIAJBAnRqIAUoAgw2AgAMAQsgACAEIAIgA2ogBGsgAyADQQAgAiABEIUJCyAFQRBqJAALxAEBA38jAEEQayIDJAAgAyABNgIMAkACQAJAAkAgACwAC0EASARAIAAoAgQiBCAAKAIIQf////8HcUF/aiICRg0BDAMLQQEhBEEBIQIgAC0ACyIBQQFHDQELIAAgAkEBIAIgAhCGCSAEIQEgACwAC0EASA0BCyAAIgIgAUEBajoACwwBCyAAKAIAIQIgACAEQQFqNgIEIAQhAQsgAiABQQJ0aiIAIAMoAgw2AgAgA0EANgIIIAAgAygCCDYCBCADQRBqJAALrAEBA38jAEEQayIEJABB7////wMgAU8EQAJAIAFBAU0EQCAAIAE6AAsgACEDDAELIAAgAUECTwR/IAFBBGpBfHEiAyADQX9qIgMgA0ECRhsFQQELQQFqIgUQ6QgiAzYCACAAIAVBgICAgHhyNgIIIAAgATYCBAsgAQR/IAMgAiABEPMIBSADCxogBEEANgIMIAMgAUECdGogBCgCDDYCACAEQRBqJAAPCxD1CAALCgBB6ewBEOQCAAsvAQF/IwBBEGsiACQAIABBADYCDEGY7wAoAgAiAEHw7AFBABCnBBogABCuBBAeAAsGABCLCQALBgBBju0BCxUAIABB1O0BNgIAIABBBGoQjwkgAAssAQF/AkAgACgCAEF0aiIAIgEgASgCCEF/aiIBNgIIIAFBf0oNACAAEMQJCwsKACAAEI4JEMQJCw0AIAAQjgkaIAAQxAkLBgBBxO4BCwsAIAAgAUEAEJQJCxwAIAJFBEAgACABRg8LIAAoAgQgASgCBBDmBUULoAEBAn8jAEFAaiIDJABBASEEAkAgACABQQAQlAkNAEEAIQQgAUUNACABQdTvARCWCSIBRQ0AIANBfzYCFCADIAA2AhAgA0EANgIMIAMgATYCCCADQRhqQQBBJxDQCRogA0EBNgI4IAEgA0EIaiACKAIAQQEgASgCACgCHBELACADKAIgQQFHDQAgAiADKAIYNgIAQQEhBAsgA0FAayQAIAQLpQIBBH8jAEFAaiICJAAgACgCACIDQXhqKAIAIQUgA0F8aigCACEDIAJBADYCFCACQaTvATYCECACIAA2AgwgAiABNgIIIAJBGGpBAEEnENAJGiAAIAVqIQACQCADIAFBABCUCQRAIAJBATYCOCADIAJBCGogACAAQQFBACADKAIAKAIUEQ0AIABBACACKAIgQQFGGyEEDAELIAMgAkEIaiAAQQFBACADKAIAKAIYEQoAIAIoAiwiAEEBSw0AIABBAWsEQCACKAIcQQAgAigCKEEBRhtBACACKAIkQQFGG0EAIAIoAjBBAUYbIQQMAQsgAigCIEEBRwRAIAIoAjANASACKAIkQQFHDQEgAigCKEEBRw0BCyACKAIYIQQLIAJBQGskACAEC10BAX8gACgCECIDRQRAIABBATYCJCAAIAI2AhggACABNgIQDwsCQCABIANGBEAgACgCGEECRw0BIAAgAjYCGA8LIABBAToANiAAQQI2AhggACAAKAIkQQFqNgIkCwsaACAAIAEoAghBABCUCQRAIAEgAiADEJcJCwszACAAIAEoAghBABCUCQRAIAEgAiADEJcJDwsgACgCCCIAIAEgAiADIAAoAgAoAhwRCwALUgEBfyAAKAIEIQQgACgCACIAIAECf0EAIAJFDQAaIARBCHUiASAEQQFxRQ0AGiACKAIAIAFqKAIACyACaiADQQIgBEECcRsgACgCACgCHBELAAtwAQJ/IAAgASgCCEEAEJQJBEAgASACIAMQlwkPCyAAKAIMIQQgAEEQaiIFIAEgAiADEJoJAkAgBEECSA0AIAUgBEEDdGohBCAAQRhqIQADQCAAIAEgAiADEJoJIAEtADYNASAAQQhqIgAgBEkNAAsLC0AAAkAgACABIAAtAAhBGHEEf0EBBUEAIQAgAUUNASABQYTwARCWCSIBRQ0BIAEtAAhBGHFBAEcLEJQJIQALIAAL6QMBBH8jAEFAaiIFJAACQAJAAkAgAUGQ8gFBABCUCQRAIAJBADYCAAwBCyAAIAEQnAkEQEEBIQMgAigCACIARQ0DIAIgACgCADYCAAwDCyABRQ0BIAFBtPABEJYJIgFFDQIgAigCACIEBEAgAiAEKAIANgIACyABKAIIIgQgACgCCCIGQX9zcUEHcQ0CIARBf3MgBnFB4ABxDQJBASEDIAAoAgwgASgCDEEAEJQJDQIgACgCDEGE8gFBABCUCQRAIAEoAgwiAEUNAyAAQejwARCWCUUhAwwDCyAAKAIMIgRFDQFBACEDIARBtPABEJYJIgQEQCAALQAIQQFxRQ0DIAQgASgCDBCeCSEDDAMLIAAoAgwiBEUNAiAEQaTxARCWCSIEBEAgAC0ACEEBcUUNAyAEIAEoAgwQnwkhAwwDCyAAKAIMIgBFDQIgAEHU7wEQlgkiBEUNAiABKAIMIgBFDQIgAEHU7wEQlgkiAEUNAiAFQX82AhQgBSAENgIQIAVBADYCDCAFIAA2AgggBUEYakEAQScQ0AkaIAVBATYCOCAAIAVBCGogAigCAEEBIAAoAgAoAhwRCwAgBSgCIEEBRw0CIAIoAgBFDQAgAiAFKAIYNgIAC0EBIQMMAQtBACEDCyAFQUBrJAAgAwucAQECfwJAA0AgAUUEQEEADwsgAUG08AEQlgkiAUUNASABKAIIIAAoAghBf3NxDQEgACgCDCABKAIMQQAQlAkEQEEBDwsgAC0ACEEBcUUNASAAKAIMIgNFDQEgA0G08AEQlgkiAwRAIAEoAgwhASADIQAMAQsLIAAoAgwiAEUNACAAQaTxARCWCSIARQ0AIAAgASgCDBCfCSECCyACC08BAX8CQCABRQ0AIAFBpPEBEJYJIgFFDQAgASgCCCAAKAIIQX9zcQ0AIAAoAgwgASgCDEEAEJQJRQ0AIAAoAhAgASgCEEEAEJQJIQILIAILowEAIABBAToANQJAIAAoAgQgAkcNACAAQQE6ADQgACgCECICRQRAIABBATYCJCAAIAM2AhggACABNgIQIANBAUcNASAAKAIwQQFHDQEgAEEBOgA2DwsgASACRgRAIAAoAhgiAkECRgRAIAAgAzYCGCADIQILIAAoAjBBAUcNASACQQFHDQEgAEEBOgA2DwsgAEEBOgA2IAAgACgCJEEBajYCJAsLvQQBBH8gACABKAIIIAQQlAkEQAJAIAEoAgQgAkcNACABKAIcQQFGDQAgASADNgIcCw8LAkAgACABKAIAIAQQlAkEQAJAIAIgASgCEEcEQCABKAIUIAJHDQELIANBAUcNAiABQQE2AiAPCyABIAM2AiAgASgCLEEERwRAIABBEGoiBSAAKAIMQQN0aiEIIAECfwJAA0ACQCAFIAhPDQAgAUEAOwE0IAUgASACIAJBASAEEKIJIAEtADYNAAJAIAEtADVFDQAgAS0ANARAQQEhAyABKAIYQQFGDQRBASEHQQEhBiAALQAIQQJxDQEMBAtBASEHIAYhAyAALQAIQQFxRQ0DCyAFQQhqIQUMAQsLIAYhA0EEIAdFDQEaC0EDCzYCLCADQQFxDQILIAEgAjYCFCABIAEoAihBAWo2AiggASgCJEEBRw0BIAEoAhhBAkcNASABQQE6ADYPCyAAKAIMIQYgAEEQaiIFIAEgAiADIAQQowkgBkECSA0AIAUgBkEDdGohBiAAQRhqIQUCQCAAKAIIIgBBAnFFBEAgASgCJEEBRw0BCwNAIAEtADYNAiAFIAEgAiADIAQQowkgBUEIaiIFIAZJDQALDAELIABBAXFFBEADQCABLQA2DQIgASgCJEEBRg0CIAUgASACIAMgBBCjCSAFQQhqIgUgBkkNAAwCAAsACwNAIAEtADYNASABKAIkQQFGBEAgASgCGEEBRg0CCyAFIAEgAiADIAQQowkgBUEIaiIFIAZJDQALCwtLAQJ/IAAoAgQiBkEIdSEHIAAoAgAiACABIAIgBkEBcQR/IAMoAgAgB2ooAgAFIAcLIANqIARBAiAGQQJxGyAFIAAoAgAoAhQRDQALSQECfyAAKAIEIgVBCHUhBiAAKAIAIgAgASAFQQFxBH8gAigCACAGaigCAAUgBgsgAmogA0ECIAVBAnEbIAQgACgCACgCGBEKAAuKAgAgACABKAIIIAQQlAkEQAJAIAEoAgQgAkcNACABKAIcQQFGDQAgASADNgIcCw8LAkAgACABKAIAIAQQlAkEQAJAIAIgASgCEEcEQCABKAIUIAJHDQELIANBAUcNAiABQQE2AiAPCyABIAM2AiACQCABKAIsQQRGDQAgAUEAOwE0IAAoAggiACABIAIgAkEBIAQgACgCACgCFBENACABLQA1BEAgAUEDNgIsIAEtADRFDQEMAwsgAUEENgIsCyABIAI2AhQgASABKAIoQQFqNgIoIAEoAiRBAUcNASABKAIYQQJHDQEgAUEBOgA2DwsgACgCCCIAIAEgAiADIAQgACgCACgCGBEKAAsLqQEAIAAgASgCCCAEEJQJBEACQCABKAIEIAJHDQAgASgCHEEBRg0AIAEgAzYCHAsPCwJAIAAgASgCACAEEJQJRQ0AAkAgAiABKAIQRwRAIAEoAhQgAkcNAQsgA0EBRw0BIAFBATYCIA8LIAEgAjYCFCABIAM2AiAgASABKAIoQQFqNgIoAkAgASgCJEEBRw0AIAEoAhhBAkcNACABQQE6ADYLIAFBBDYCLAsLlwIBBn8gACABKAIIIAUQlAkEQCABIAIgAyAEEKAJDwsgAS0ANSEHIAAoAgwhBiABQQA6ADUgAS0ANCEIIAFBADoANCAAQRBqIgkgASACIAMgBCAFEKIJIAcgAS0ANSIKciEHIAggAS0ANCILciEIAkAgBkECSA0AIAkgBkEDdGohCSAAQRhqIQYDQCABLQA2DQECQCALBEAgASgCGEEBRg0DIAAtAAhBAnENAQwDCyAKRQ0AIAAtAAhBAXFFDQILIAFBADsBNCAGIAEgAiADIAQgBRCiCSABLQA1IgogB3IhByABLQA0IgsgCHIhCCAGQQhqIgYgCUkNAAsLIAEgB0H/AXFBAEc6ADUgASAIQf8BcUEARzoANAs5ACAAIAEoAgggBRCUCQRAIAEgAiADIAQQoAkPCyAAKAIIIgAgASACIAMgBCAFIAAoAgAoAhQRDQALHAAgACABKAIIIAUQlAkEQCABIAIgAyAEEKAJCwsjAQJ/IAAQuQRBAWoiARDDCSICRQRAQQAPCyACIAAgARDPCQsqAQF/IwBBEGsiASQAIAEgADYCDCABKAIMKAIEEKkJIQAgAUEQaiQAIAAL4AEAQYTyAUHw9QEQH0Gc8gFB9fUBQQFBAUEAECAQrAkQrQkQrgkQrwkQsAkQsQkQsgkQswkQtAkQtQkQtglB0DNB3/YBECFByPwBQev2ARAhQaD9AUEEQYz3ARAiQfz9AUECQZn3ARAiQdj+AUEEQaj3ARAiQYQaQbf3ARAjELcJQeX3ARC4CUGK+AEQuQlBsfgBELoJQdD4ARC7CUH4+AEQvAlBlfkBEL0JEL4JEL8JQYD6ARC4CUGg+gEQuQlBwfoBELoJQeL6ARC7CUGE+wEQvAlBpfsBEL0JEMAJEMEJCzABAX8jAEEQayIAJAAgAEH69QE2AgxBqPIBIAAoAgxBAUGAf0H/ABAkIABBEGokAAswAQF/IwBBEGsiACQAIABB//UBNgIMQcDyASAAKAIMQQFBgH9B/wAQJCAAQRBqJAALLwEBfyMAQRBrIgAkACAAQYv2ATYCDEG08gEgACgCDEEBQQBB/wEQJCAAQRBqJAALMgEBfyMAQRBrIgAkACAAQZn2ATYCDEHM8gEgACgCDEECQYCAfkH//wEQJCAAQRBqJAALMAEBfyMAQRBrIgAkACAAQZ/2ATYCDEHY8gEgACgCDEECQQBB//8DECQgAEEQaiQACzYBAX8jAEEQayIAJAAgAEGu9gE2AgxB5PIBIAAoAgxBBEGAgICAeEH/////BxAkIABBEGokAAsuAQF/IwBBEGsiACQAIABBsvYBNgIMQfDyASAAKAIMQQRBAEF/ECQgAEEQaiQACzYBAX8jAEEQayIAJAAgAEG/9gE2AgxB/PIBIAAoAgxBBEGAgICAeEH/////BxAkIABBEGokAAsuAQF/IwBBEGsiACQAIABBxPYBNgIMQYjzASAAKAIMQQRBAEF/ECQgAEEQaiQACyoBAX8jAEEQayIAJAAgAEHS9gE2AgxBlPMBIAAoAgxBBBAlIABBEGokAAsqAQF/IwBBEGsiACQAIABB2PYBNgIMQaDzASAAKAIMQQgQJSAAQRBqJAALKgEBfyMAQRBrIgAkACAAQcf3ATYCDEGQ/wFBACAAKAIMECYgAEEQaiQACygBAX8jAEEQayIBJAAgASAANgIMQbj/AUEAIAEoAgwQJiABQRBqJAALKAEBfyMAQRBrIgEkACABIAA2AgxB4P8BQQEgASgCDBAmIAFBEGokAAsoAQF/IwBBEGsiASQAIAEgADYCDEGIgAJBAiABKAIMECYgAUEQaiQACygBAX8jAEEQayIBJAAgASAANgIMQbCAAkEDIAEoAgwQJiABQRBqJAALKAEBfyMAQRBrIgEkACABIAA2AgxB2IACQQQgASgCDBAmIAFBEGokAAsoAQF/IwBBEGsiASQAIAEgADYCDEGAgQJBBSABKAIMECYgAUEQaiQACyoBAX8jAEEQayIAJAAgAEG7+QE2AgxBqIECQQQgACgCDBAmIABBEGokAAsqAQF/IwBBEGsiACQAIABB2fkBNgIMQdCBAkEFIAAoAgwQJiAAQRBqJAALKgEBfyMAQRBrIgAkACAAQcf7ATYCDEH4gQJBBiAAKAIMECYgAEEQaiQACyoBAX8jAEEQayIAJAAgAEHm+wE2AgxBoIICQQcgACgCDBAmIABBEGokAAsnAQF/IwBBEGsiASQAIAEgADYCDCABKAIMIQAQqwkgAUEQaiQAIAALrDIBDX8jAEEQayIMJAACQAJAAkACQCAAQfQBTQRAQZSgAygCACIGQRAgAEELakF4cSAAQQtJGyIHQQN2IgB2IgFBA3EEQAJAIAFBf3NBAXEgAGoiAkEDdCIDQcSgA2ooAgAiASgCCCIAIANBvKADaiIDRgRAQZSgAyAGQX4gAndxNgIADAELQaSgAygCACAASw0EIAAoAgwgAUcNBCAAIAM2AgwgAyAANgIICyABQQhqIQAgASACQQN0IgJBA3I2AgQgASACaiIBIAEoAgRBAXI2AgQMBQsgB0GcoAMoAgAiCU0NASABBEACQEECIAB0IgJBACACa3IgASAAdHEiAEEAIABrcUF/aiIAIABBDHZBEHEiAHYiAUEFdkEIcSICIAByIAEgAnYiAEECdkEEcSIBciAAIAF2IgBBAXZBAnEiAXIgACABdiIAQQF2QQFxIgFyIAAgAXZqIgJBA3QiA0HEoANqKAIAIgEoAggiACADQbygA2oiA0YEQEGUoAMgBkF+IAJ3cSIGNgIADAELQaSgAygCACAASw0EIAAoAgwgAUcNBCAAIAM2AgwgAyAANgIICyABIAdBA3I2AgQgASAHaiIFIAJBA3QiACAHayIDQQFyNgIEIAAgAWogAzYCACAJBEAgCUEDdiIEQQN0QbygA2ohAEGooAMoAgAhAgJAIAZBASAEdCIEcUUEQEGUoAMgBCAGcjYCACAAIQQMAQtBpKADKAIAIAAoAggiBEsNBQsgACACNgIIIAQgAjYCDCACIAA2AgwgAiAENgIICyABQQhqIQBBqKADIAU2AgBBnKADIAM2AgAMBQtBmKADKAIAIgpFDQEgCkEAIAprcUF/aiIAIABBDHZBEHEiAHYiAUEFdkEIcSICIAByIAEgAnYiAEECdkEEcSIBciAAIAF2IgBBAXZBAnEiAXIgACABdiIAQQF2QQFxIgFyIAAgAXZqQQJ0QcSiA2ooAgAiASgCBEF4cSAHayECIAEhAwNAAkAgAygCECIARQRAIAMoAhQiAEUNAQsgACgCBEF4cSAHayIDIAIgAyACSSIDGyECIAAgASADGyEBIAAhAwwBCwtBpKADKAIAIg0gAUsNAiABIAdqIgsgAU0NAiABKAIYIQgCQCABIAEoAgwiBEcEQCANIAEoAggiAEsNBCAAKAIMIAFHDQQgBCgCCCABRw0EIAAgBDYCDCAEIAA2AggMAQsCQCABQRRqIgMoAgAiAEUEQCABKAIQIgBFDQEgAUEQaiEDCwNAIAMhBSAAIgRBFGoiAygCACIADQAgBEEQaiEDIAQoAhAiAA0ACyANIAVLDQQgBUEANgIADAELQQAhBAsCQCAIRQ0AAkAgASgCHCIAQQJ0QcSiA2oiAygCACABRgRAIAMgBDYCACAEDQFBmKADIApBfiAAd3E2AgAMAgtBpKADKAIAIAhLDQQgCEEQQRQgCCgCECABRhtqIAQ2AgAgBEUNAQtBpKADKAIAIgMgBEsNAyAEIAg2AhggASgCECIABEAgAyAASw0EIAQgADYCECAAIAQ2AhgLIAEoAhQiAEUNAEGkoAMoAgAgAEsNAyAEIAA2AhQgACAENgIYCwJAIAJBD00EQCABIAIgB2oiAEEDcjYCBCAAIAFqIgAgACgCBEEBcjYCBAwBCyABIAdBA3I2AgQgCyACQQFyNgIEIAIgC2ogAjYCACAJBEAgCUEDdiIEQQN0QbygA2ohAEGooAMoAgAhAwJAQQEgBHQiBCAGcUUEQEGUoAMgBCAGcjYCACAAIQcMAQtBpKADKAIAIAAoAggiB0sNBQsgACADNgIIIAcgAzYCDCADIAA2AgwgAyAHNgIIC0GooAMgCzYCAEGcoAMgAjYCAAsgAUEIaiEADAQLQX8hByAAQb9/Sw0AIABBC2oiAEF4cSEHQZigAygCACIIRQ0AQQAgB2shAwJAAkACQAJ/QQAgAEEIdiIARQ0AGkEfIAdB////B0sNABogACAAQYD+P2pBEHZBCHEiAHQiASABQYDgH2pBEHZBBHEiAXQiAiACQYCAD2pBEHZBAnEiAnRBD3YgACABciACcmsiAEEBdCAHIABBFWp2QQFxckEcagsiBUECdEHEogNqKAIAIgJFBEBBACEADAELIAdBAEEZIAVBAXZrIAVBH0YbdCEBQQAhAANAAkAgAigCBEF4cSAHayIGIANPDQAgAiEEIAYiAw0AQQAhAyACIQAMAwsgACACKAIUIgYgBiACIAFBHXZBBHFqKAIQIgJGGyAAIAYbIQAgASACQQBHdCEBIAINAAsLIAAgBHJFBEBBAiAFdCIAQQAgAGtyIAhxIgBFDQMgAEEAIABrcUF/aiIAIABBDHZBEHEiAHYiAUEFdkEIcSICIAByIAEgAnYiAEECdkEEcSIBciAAIAF2IgBBAXZBAnEiAXIgACABdiIAQQF2QQFxIgFyIAAgAXZqQQJ0QcSiA2ooAgAhAAsgAEUNAQsDQCAAKAIEQXhxIAdrIgIgA0khASACIAMgARshAyAAIAQgARshBCAAKAIQIgEEfyABBSAAKAIUCyIADQALCyAERQ0AIANBnKADKAIAIAdrTw0AQaSgAygCACIKIARLDQEgBCAHaiIFIARNDQEgBCgCGCEJAkAgBCAEKAIMIgFHBEAgCiAEKAIIIgBLDQMgACgCDCAERw0DIAEoAgggBEcNAyAAIAE2AgwgASAANgIIDAELAkAgBEEUaiICKAIAIgBFBEAgBCgCECIARQ0BIARBEGohAgsDQCACIQYgACIBQRRqIgIoAgAiAA0AIAFBEGohAiABKAIQIgANAAsgCiAGSw0DIAZBADYCAAwBC0EAIQELAkAgCUUNAAJAIAQoAhwiAEECdEHEogNqIgIoAgAgBEYEQCACIAE2AgAgAQ0BQZigAyAIQX4gAHdxIgg2AgAMAgtBpKADKAIAIAlLDQMgCUEQQRQgCSgCECAERhtqIAE2AgAgAUUNAQtBpKADKAIAIgIgAUsNAiABIAk2AhggBCgCECIABEAgAiAASw0DIAEgADYCECAAIAE2AhgLIAQoAhQiAEUNAEGkoAMoAgAgAEsNAiABIAA2AhQgACABNgIYCwJAIANBD00EQCAEIAMgB2oiAEEDcjYCBCAAIARqIgAgACgCBEEBcjYCBAwBCyAEIAdBA3I2AgQgBSADQQFyNgIEIAMgBWogAzYCACADQf8BTQRAIANBA3YiAUEDdEG8oANqIQACQEGUoAMoAgAiAkEBIAF0IgFxRQRAQZSgAyABIAJyNgIAIAAhAgwBC0GkoAMoAgAgACgCCCICSw0ECyAAIAU2AgggAiAFNgIMIAUgADYCDCAFIAI2AggMAQsgBQJ/QQAgA0EIdiIARQ0AGkEfIANB////B0sNABogACAAQYD+P2pBEHZBCHEiAHQiASABQYDgH2pBEHZBBHEiAXQiAiACQYCAD2pBEHZBAnEiAnRBD3YgACABciACcmsiAEEBdCADIABBFWp2QQFxckEcagsiADYCHCAFQgA3AhAgAEECdEHEogNqIQECQAJAIAhBASAAdCICcUUEQEGYoAMgAiAIcjYCACABIAU2AgAMAQsgA0EAQRkgAEEBdmsgAEEfRht0IQAgASgCACEHA0AgByIBKAIEQXhxIANGDQIgAEEddiECIABBAXQhACABIAJBBHFqQRBqIgIoAgAiBw0AC0GkoAMoAgAgAksNBCACIAU2AgALIAUgATYCGCAFIAU2AgwgBSAFNgIIDAELQaSgAygCACIAIAFLDQIgACABKAIIIgBLDQIgACAFNgIMIAEgBTYCCCAFQQA2AhggBSABNgIMIAUgADYCCAsgBEEIaiEADAMLQZygAygCACIBIAdPBEBBqKADKAIAIQACQCABIAdrIgJBEE8EQEGcoAMgAjYCAEGooAMgACAHaiIDNgIAIAMgAkEBcjYCBCAAIAFqIAI2AgAgACAHQQNyNgIEDAELQaigA0EANgIAQZygA0EANgIAIAAgAUEDcjYCBCAAIAFqIgEgASgCBEEBcjYCBAsgAEEIaiEADAMLQaCgAygCACIBIAdLBEBBoKADIAEgB2siATYCAEGsoANBrKADKAIAIgAgB2oiAjYCACACIAFBAXI2AgQgACAHQQNyNgIEIABBCGohAAwDC0EAIQAgB0EvaiIEAn9B7KMDKAIABEBB9KMDKAIADAELQfijA0J/NwIAQfCjA0KAoICAgIAENwIAQeyjAyAMQQxqQXBxQdiq1aoFczYCAEGApANBADYCAEHQowNBADYCAEGAIAsiAmoiBkEAIAJrIgVxIgIgB00NAkHMowMoAgAiAwRAQcSjAygCACIIIAJqIgkgCE0NAyAJIANLDQMLAkBB0KMDLQAAQQRxRQRAAkACQAJAAkBBrKADKAIAIgMEQEHUowMhAANAIAAoAgAiCCADTQRAIAggACgCBGogA0sNAwsgACgCCCIADQALC0EAEMgJIgFBf0YNAyACIQZB8KMDKAIAIgBBf2oiAyABcQRAIAIgAWsgASADakEAIABrcWohBgsgBiAHTQ0DIAZB/v///wdLDQNBzKMDKAIAIgAEQEHEowMoAgAiAyAGaiIFIANNDQQgBSAASw0ECyAGEMgJIgAgAUcNAQwFCyAGIAFrIAVxIgZB/v///wdLDQIgBhDICSIBIAAoAgAgACgCBGpGDQEgASEACyAAIQECQCAHQTBqIAZNDQAgBkH+////B0sNACABQX9GDQBB9KMDKAIAIgAgBCAGa2pBACAAa3EiAEH+////B0sNBCAAEMgJQX9HBEAgACAGaiEGDAULQQAgBmsQyAkaDAILIAFBf0cNAwwBCyABQX9HDQILQdCjA0HQowMoAgBBBHI2AgALIAJB/v///wdLDQIgAhDICSIBQQAQyAkiAE8NAiABQX9GDQIgAEF/Rg0CIAAgAWsiBiAHQShqTQ0CC0HEowNBxKMDKAIAIAZqIgA2AgAgAEHIowMoAgBLBEBByKMDIAA2AgALAkACQAJAQaygAygCACIFBEBB1KMDIQADQCABIAAoAgAiAiAAKAIEIgNqRg0CIAAoAggiAA0ACwwCC0GkoAMoAgAiAEEAIAEgAE8bRQRAQaSgAyABNgIAC0EAIQBB2KMDIAY2AgBB1KMDIAE2AgBBtKADQX82AgBBuKADQeyjAygCADYCAEHgowNBADYCAANAIABBA3QiAkHEoANqIAJBvKADaiIDNgIAIAJByKADaiADNgIAIABBAWoiAEEgRw0AC0GgoAMgBkFYaiIAQXggAWtBB3FBACABQQhqQQdxGyICayIDNgIAQaygAyABIAJqIgI2AgAgAiADQQFyNgIEIAAgAWpBKDYCBEGwoANB/KMDKAIANgIADAILIAAtAAxBCHENACABIAVNDQAgAiAFSw0AIAAgAyAGajYCBEGsoAMgBUF4IAVrQQdxQQAgBUEIakEHcRsiAGoiATYCAEGgoANBoKADKAIAIAZqIgIgAGsiADYCACABIABBAXI2AgQgAiAFakEoNgIEQbCgA0H8owMoAgA2AgAMAQsgAUGkoAMoAgAiBEkEQEGkoAMgATYCACABIQQLIAEgBmohAkHUowMhAAJAAkACQANAIAIgACgCAEcEQCAAKAIIIgANAQwCCwsgAC0ADEEIcUUNAQtB1KMDIQADQCAAKAIAIgIgBU0EQCACIAAoAgRqIgMgBUsNAwsgACgCCCEADAAACwALIAAgATYCACAAIAAoAgQgBmo2AgQgAUF4IAFrQQdxQQAgAUEIakEHcRtqIgkgB0EDcjYCBCACQXggAmtBB3FBACACQQhqQQdxG2oiASAJayAHayEAIAcgCWohCAJAIAEgBUYEQEGsoAMgCDYCAEGgoANBoKADKAIAIABqIgA2AgAgCCAAQQFyNgIEDAELIAFBqKADKAIARgRAQaigAyAINgIAQZygA0GcoAMoAgAgAGoiADYCACAIIABBAXI2AgQgACAIaiAANgIADAELIAEoAgQiCkEDcUEBRgRAAkAgCkH/AU0EQCABKAIMIQIgASgCCCIDIApBA3YiB0EDdEG8oANqIgZHBEAgBCADSw0HIAMoAgwgAUcNBwsgAiADRgRAQZSgA0GUoAMoAgBBfiAHd3E2AgAMAgsgAiAGRwRAIAQgAksNByACKAIIIAFHDQcLIAMgAjYCDCACIAM2AggMAQsgASgCGCEFAkAgASABKAIMIgZHBEAgBCABKAIIIgJLDQcgAigCDCABRw0HIAYoAgggAUcNByACIAY2AgwgBiACNgIIDAELAkAgAUEUaiICKAIAIgcNACABQRBqIgIoAgAiBw0AQQAhBgwBCwNAIAIhAyAHIgZBFGoiAigCACIHDQAgBkEQaiECIAYoAhAiBw0ACyAEIANLDQYgA0EANgIACyAFRQ0AAkAgASABKAIcIgJBAnRBxKIDaiIDKAIARgRAIAMgBjYCACAGDQFBmKADQZigAygCAEF+IAJ3cTYCAAwCC0GkoAMoAgAgBUsNBiAFQRBBFCAFKAIQIAFGG2ogBjYCACAGRQ0BC0GkoAMoAgAiAyAGSw0FIAYgBTYCGCABKAIQIgIEQCADIAJLDQYgBiACNgIQIAIgBjYCGAsgASgCFCICRQ0AQaSgAygCACACSw0FIAYgAjYCFCACIAY2AhgLIApBeHEiAiAAaiEAIAEgAmohAQsgASABKAIEQX5xNgIEIAggAEEBcjYCBCAAIAhqIAA2AgAgAEH/AU0EQCAAQQN2IgFBA3RBvKADaiEAAkBBlKADKAIAIgJBASABdCIBcUUEQEGUoAMgASACcjYCACAAIQIMAQtBpKADKAIAIAAoAggiAksNBQsgACAINgIIIAIgCDYCDCAIIAA2AgwgCCACNgIIDAELIAgCf0EAIABBCHYiAUUNABpBHyAAQf///wdLDQAaIAEgAUGA/j9qQRB2QQhxIgF0IgIgAkGA4B9qQRB2QQRxIgJ0IgMgA0GAgA9qQRB2QQJxIgN0QQ92IAEgAnIgA3JrIgFBAXQgACABQRVqdkEBcXJBHGoLIgE2AhwgCEIANwIQIAFBAnRBxKIDaiEDAkACQEGYoAMoAgAiAkEBIAF0IgRxRQRAQZigAyACIARyNgIAIAMgCDYCAAwBCyAAQQBBGSABQQF2ayABQR9GG3QhAiADKAIAIQEDQCABIgMoAgRBeHEgAEYNAiACQR12IQEgAkEBdCECIAMgAUEEcWpBEGoiBCgCACIBDQALQaSgAygCACAESw0FIAQgCDYCAAsgCCADNgIYIAggCDYCDCAIIAg2AggMAQtBpKADKAIAIgAgA0sNAyAAIAMoAggiAEsNAyAAIAg2AgwgAyAINgIIIAhBADYCGCAIIAM2AgwgCCAANgIICyAJQQhqIQAMBAtBoKADIAZBWGoiAEF4IAFrQQdxQQAgAUEIakEHcRsiAmsiBDYCAEGsoAMgASACaiICNgIAIAIgBEEBcjYCBCAAIAFqQSg2AgRBsKADQfyjAygCADYCACAFIANBJyADa0EHcUEAIANBWWpBB3EbakFRaiIAIAAgBUEQakkbIgJBGzYCBCACQdyjAykCADcCECACQdSjAykCADcCCEHcowMgAkEIajYCAEHYowMgBjYCAEHUowMgATYCAEHgowNBADYCACACQRhqIQADQCAAQQc2AgQgAEEIaiEBIABBBGohACADIAFLDQALIAIgBUYNACACIAIoAgRBfnE2AgQgBSACIAVrIgNBAXI2AgQgAiADNgIAIANB/wFNBEAgA0EDdiIBQQN0QbygA2ohAAJAQZSgAygCACICQQEgAXQiAXFFBEBBlKADIAEgAnI2AgAgACEDDAELQaSgAygCACAAKAIIIgNLDQMLIAAgBTYCCCADIAU2AgwgBSAANgIMIAUgAzYCCAwBCyAFQgA3AhAgBQJ/QQAgA0EIdiIARQ0AGkEfIANB////B0sNABogACAAQYD+P2pBEHZBCHEiAHQiASABQYDgH2pBEHZBBHEiAXQiAiACQYCAD2pBEHZBAnEiAnRBD3YgACABciACcmsiAEEBdCADIABBFWp2QQFxckEcagsiADYCHCAAQQJ0QcSiA2ohAQJAAkBBmKADKAIAIgJBASAAdCIEcUUEQEGYoAMgAiAEcjYCACABIAU2AgAgBSABNgIYDAELIANBAEEZIABBAXZrIABBH0YbdCEAIAEoAgAhAQNAIAEiAigCBEF4cSADRg0CIABBHXYhASAAQQF0IQAgAiABQQRxakEQaiIEKAIAIgENAAtBpKADKAIAIARLDQMgBCAFNgIAIAUgAjYCGAsgBSAFNgIMIAUgBTYCCAwBC0GkoAMoAgAiACACSw0BIAAgAigCCCIASw0BIAAgBTYCDCACIAU2AgggBUEANgIYIAUgAjYCDCAFIAA2AggLQaCgAygCACIAIAdNDQFBoKADIAAgB2siATYCAEGsoANBrKADKAIAIgAgB2oiAjYCACACIAFBAXI2AgQgACAHQQNyNgIEIABBCGohAAwCCxAeAAtBgPcCQTA2AgBBACEACyAMQRBqJAAgAAu/DwEIfwJAAkAgAEUNACAAQXhqIgNBpKADKAIAIgdJDQEgAEF8aigCACIBQQNxIgJBAUYNASADIAFBeHEiAGohBQJAIAFBAXENACACRQ0BIAMgAygCACIEayIDIAdJDQIgACAEaiEAIANBqKADKAIA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CyADIQILAkAgBEUNACAGIgVCAFINACAARAAAAAAAAAAAog8LAkAgBUL/////////B1YEQCAFIQYMAQsDQCACQX9qIQIgBUKAgICAgICABFQhAyAFQgGGIgYhBSADDQALCyAIQoCAgICAgICAgH+DIQUgAkEBTgR+IAZCgICAgICAgHh8IAKtQjSGhAUgBkEBIAJrrYgLIAWEvw8LIABEAAAAAAAAAACiIAAgBSAGURsLqwYCBX8EfiMAQYABayIFJAACQAJAAkAgAyAEQgBCABDUBUUNACADIAQQzgkhByACQjCIpyIJQf//AXEiBkH//wFGDQAgBw0BCyAFQRBqIAEgAiADIAQQ0AUgBSAFKQMQIgIgBSkDGCIBIAIgARDaBSAFKQMIIQIgBSkDACEEDAELIAEgAkL///////8/gyAGrUIwhoQiCiADIARC////////P4MgBEIwiKdB//8BcSIHrUIwhoQiCxDUBUEATARAIAEgCiADIAsQ1AUEQCABIQQMAgsgBUHwAGogASACQgBCABDQBSAFKQN4IQIgBSkDcCEEDAELIAYEfiABBSAFQeAAaiABIApCAEKAgICAgIDAu8AAENAFIAUpA2giCkIwiKdBiH9qIQYgBSkDYAshBCAHRQRAIAVB0ABqIAMgC0IAQoCAgICAgMC7wAAQ0AUgBSkDWCILQjCIp0GIf2ohByAFKQNQIQMLIApC////////P4NCgICAgICAwACEIgogC0L///////8/g0KAgICAgIDAAIQiDX0gBCADVK19IgxCf1UhCCAEIAN9IQsgBiAHSgRAA0ACfiAIBEAgCyAMhFAEQCAFQSBqIAEgAkIAQgAQ0AUgBSkDKCECIAUpAyAhBAwFCyALQj+IIQogDEIBhgwBCyAKQgGGIQogBCELIARCP4gLIQwgCiAMhCIKIA19IAtCAYYiBCADVK19IgxCf1UhCCAEIAN9IQsgBkF/aiIGIAdKDQALIAchBgsCQCAIRQ0AIAsiBCAMIgqEQgBSDQAgBUEwaiABIAJCAEIAENAFIAUpAzghAiAFKQMwIQQMAQsgCkL///////8/WARAA0AgBEI/iCEBIAZBf2ohBiAEQgGGIQQgASAKQgGGhCIKQoCAgICAgMAAVA0ACwsgCUGAgAJxIQcgBkEATARAIAVBQGsgBCAKQv///////z+DIAZB+ABqIAdyrUIwhoRCAEKAgICAgIDAwz8Q0AUgBSkDSCECIAUpA0AhBAwBCyAKQv///////z+DIAYgB3KtQjCGhCECCyAAIAQ3AwAgACACNwMIIAVBgAFqJAAL5gMDA38BfgZ8AkACQAJAAkAgAL0iBEIAWQRAIARCIIinIgFB//8/Sw0BCyAEQv///////////wCDUARARAAAAAAAAPC/IAAgAKKjDwsgBEJ/VQ0BIAAgAKFEAAAAAAAAAACjDwsgAUH//7//B0sNAkGAgMD/AyECQYF4IQMgAUGAgMD/A0cEQCABIQIMAgsgBKcNAUQAAAAAAAAAAA8LIABEAAAAAAAAUEOivSIEQiCIpyECQct3IQMLIAMgAkHiviVqIgFBFHZqtyIJRABgn1ATRNM/oiIFIARC/////w+DIAFB//8/cUGewZr/A2qtQiCGhL9EAAAAAAAA8L+gIgAgACAARAAAAAAAAOA/oqIiB6G9QoCAgIBwg78iCEQAACAVe8vbP6IiBqAiCiAGIAUgCqGgIAAgAEQAAAAAAAAAQKCjIgUgByAFIAWiIgYgBqIiBSAFIAVEn8Z40Amawz+iRK94jh3Fccw/oKJEBPqXmZmZ2T+goiAGIAUgBSAFRERSPt8S8cI/okTeA8uWZEbHP6CiRFmTIpQkSdI/oKJEk1VVVVVV5T+goqCgoiAAIAihIAehoCIARAAAIBV7y9s/oiAJRDYr8RHz/lk9oiAAIAigRNWtmso4lLs9oqCgoKAhAAsgAAu7AgICfwR9AkACQCAAvCIBQYCAgARPQQAgAUF/ShtFBEAgAUH/////B3FFBEBDAACAvyAAIACUlQ8LIAFBf0wEQCAAIACTQwAAAACVDwsgAEMAAABMlLwhAUHofiECDAELIAFB////+wdLDQFBgX8hAkMAAAAAIQAgAUGAgID8A0YNAQsgAiABQY32qwJqIgFBF3ZqsiIGQ4Agmj6UIAFB////A3FB84nU+QNqvkMAAIC/kiIAIAAgAEMAAAA/lJQiBJO8QYBgcb4iBUMAYN4+lCAAIABDAAAAQJKVIgMgBCADIAOUIgMgAyADlCIDQ+7pkT6UQ6qqKj+SlCADIANDJp54PpRDE87MPpKUkpKUIAAgBZMgBJOSIgBDAGDePpQgBkPbJ1Q1lCAAIAWSQ9nqBLiUkpKSkiEACyAAC6gBAAJAIAFBgAhOBEAgAEQAAAAAAADgf6IhACABQf8PSARAIAFBgXhqIQEMAgsgAEQAAAAAAADgf6IhACABQf0XIAFB/RdIG0GCcGohAQwBCyABQYF4Sg0AIABEAAAAAAAAEACiIQAgAUGDcEoEQCABQf4HaiEBDAELIABEAAAAAAAAEACiIQAgAUGGaCABQYZoShtB/A9qIQELIAAgAUH/B2qtQjSGv6ILRAIBfwF+IAFC////////P4MhAwJ/IAFCMIinQf//AXEiAkH//wFHBEBBBCACDQEaQQJBAyAAIAOEUBsPCyAAIAOEUAsLgwQBA38gAkGAwABPBEAgACABIAIQKBogAA8LIAAgAmohAwJAIAAgAXNBA3FFBEACQCACQQFIBEAgACECDAELIABBA3FFBEAgACECDAELIAAhAgNAIAIgAS0AADoAACABQQFqIQEgAkEBaiICIANPDQEgAkEDcQ0ACwsCQCADQXxxIgRBwABJDQAgAiAEQUBqIgVLDQADQCACIAEoAgA2AgAgAiABKAIENgIEIAIgASgCCDYCCCACIAEoAgw2AgwgAiABKAIQNgIQIAIgASgCFDYCFCACIAEoAhg2AhggAiABKAIcNgIcIAIgASgCIDYCICACIAEoAiQ2AiQgAiABKAIoNgIoIAIgASgCLDYCLCACIAEoAjA2AjAgAiABKAI0NgI0IAIgASgCODYCOCACIAEoAjw2AjwgAUFAayEBIAJBQGsiAiAFTQ0ACwsgAiAETw0BA0AgAiABKAIANgIAIAFBBGohASACQQRqIgIgBEkNAAsMAQsgA0EESQRAIAAhAgwBCyADQXxqIgQgAEkEQCAAIQIMAQsgACECA0AgAiABLQAAOgAAIAIgAS0AAToAASACIAEtAAI6AAIgAiABLQADOgADIAFBBGohASACQQRqIgIgBE0NAAsLIAIgA0kEQANAIAIgAS0AADoAACABQQFqIQEgAkEBaiICIANHDQALCyAAC/MCAgJ/AX4CQCACRQ0AIAAgAmoiA0F/aiABOgAAIAAgAToAACACQQNJDQAgA0F+aiABOgAAIAAgAToAASADQX1qIAE6AAAgACABOgACIAJBB0kNACADQXxqIAE6AAAgACABOgADIAJBCUkNACAAQQAgAGtBA3EiBGoiAyABQf8BcUGBgoQIbCIBNgIAIAMgAiAEa0F8cSIEaiICQXxqIAE2AgAgBEEJSQ0AIAMgATYCCCADIAE2AgQgAkF4aiABNgIAIAJBdGogATYCACAEQRlJDQAgAyABNgIYIAMgATYCFCADIAE2AhAgAyABNgIMIAJBcGogATYCACACQWxqIAE2AgAgAkFoaiABNgIAIAJBZGogATYCACAEIANBBHFBGHIiBGsiAkEgSQ0AIAGtIgVCIIYgBYQhBSADIARqIQEDQCABIAU3AxggASAFNwMQIAEgBTcDCCABIAU3AwAgAUEgaiEBIAJBYGoiAkEfSw0ACwsgAAvlAgECfwJAIAAgAUYNAAJAIAEgAmogAEsEQCAAIAJqIgQgAUsNAQsgACABIAIQzwkaDwsgACABc0EDcSEDAkACQCAAIAFJBEAgAw0CIABBA3FFDQEDQCACRQ0EIAAgAS0AADoAACABQQFqIQEgAkF/aiECIABBAWoiAEEDcQ0ACwwBCwJAIAMNACAEQQNxBEADQCACRQ0FIAAgAkF/aiICaiIDIAEgAmotAAA6AAAgA0EDcQ0ACwsgAkEDTQ0AA0AgACACQXxqIgJqIAEgAmooAgA2AgAgAkEDSw0ACwsgAkUNAgNAIAAgAkF/aiICaiABIAJqLQAAOgAAIAINAAsMAgsgAkEDTQ0AIAIhAwNAIAAgASgCADYCACABQQRqIQEgAEEEaiEAIANBfGoiA0EDSw0ACyACQQNxIQILIAJFDQADQCAAIAEtAAA6AAAgAEEBaiEAIAFBAWohASACQX9qIgINAAsLCx8AQYSkAygCAEUEQEGIpAMgATYCAEGEpAMgADYCAAsLBAAjAAsQACMAIABrQXBxIgAkACAACwYAIAAkAAsGACAAQAALCwAgASACIAARAgALDwAgASACIAMgBCAAEQsACwsAIAEgAiAAEREACw0AIAEgAiADIAARSwALDwAgASACIAMgBCAAERUACxEAIAEgAiADIAQgBSAAEVMACw0AIAEgAiADIAAREwALDwAgASACIAMgBCAAEVAACwsAIAEgAiAAERgACwsAIAEgAiAAEQ8ACw0AIAEgAiADIAARGgALDQAgASACIAMgABEeAAsPACABIAIgAyAEIAARSgALDwAgASACIAMgBCAAERkACw8AIAEgAiADIAQgABFaAAsRACABIAIgAyAEIAUgABFNAAsRACABIAIgAyAEIAUgABFbAAsTACABIAIgAyAEIAUgBiAAEU4ACw8AIAEgAiADIAQgABE8AAsRACABIAIgAyAEIAUgABE2AAsRACABIAIgAyAEIAUgABE9AAsTACABIAIgAyAEIAUgBiAAETcACxMAIAEgAiADIAQgBSAGIAARPgALFQAgASACIAMgBCAFIAYgByAAETgACxEAIAEgAiADIAQgBSAAEUAACxMAIAEgAiADIAQgBSAGIAARJQALDwAgASACIAMgBCAAEUQACw0AIAEgAiADIAARPwALDwAgASACIAMgBCAAETkACw8AIAEgAiADIAQgABEIAAsRACABIAIgAyAEIAUgABE7AAsTACABIAIgAyAEIAUgBiAAETQACxMAIAEgAiADIAQgBSAGIAARXAALFQAgASACIAMgBCAFIAYgByAAEVIACxMAIAEgAiADIAQgBSAGIAARLwALFQAgASACIAMgBCAFIAYgByAAEVcACxMAIAEgAiADIAQgBSAGIAARXQALFQAgASACIAMgBCAFIAYgByAAEVUACxcAIAEgAiADIAQgBSAGIAcgCCAAEV8ACxkAIAEgAiADIAQgBSAGIAcgCCAJIAARWAALDQAgASACIAMgABEjAAsPACABIAIgAyAEIAARKgALEwAgASACIAMgBCAFIAYgABEsAAsVACABIAIgAyAEIAUgBiAHIAARTwALDwAgASACIAMgBCAAER8ACxEAIAEgAiADIAQgBSAAESsACw0AIAEgAiADIAARIQALDwAgASACIAMgBCAAETUACxEAIAEgAiADIAQgBSAAEQoACw0AIAEgAiADIAARRgALDwAgASACIAMgBCAAEUUACwkAIAEgABEoAAsLACABIAIgABEpAAsPACABIAIgAyAEIAARSAALEQAgASACIAMgBCAFIAARSQALEwAgASACIAMgBCAFIAYgABEyAAsVACABIAIgAyAEIAUgBiAHIAARMQALDQAgASACIAMgABFhAAsPACABIAIgAyAEIAARMwALDwAgASACIAMgBCAAEWYACxEAIAEgAiADIAQgBSAAES0ACxMAIAEgAiADIAQgBSAGIAARUQALEwAgASACIAMgBCAFIAYgABFeAAsVACABIAIgAyAEIAUgBiAHIAARVgALEQAgASACIAMgBCAFIAARLgALEwAgASACIAMgBCAFIAYgABFUAAsLACABIAIgABFoAAsPACABIAIgAyAEIAARWQALEQAgASACIAMgBCAFIAARTAALEwAgASACIAMgBCAFIAYgABFHAAsRACABIAIgAyAEIAUgABEGAAsXACABIAIgAyAEIAUgBiAHIAggABEOAAsTACABIAIgAyAEIAUgBiAAEQkACxEAIAEgAiADIAQgBSAAESYACxUAIAEgAiADIAQgBSAGIAcgABEUAAsTACABIAIgAyAEIAUgBiAAEQ0ACwcAIAARBwALGQAgASACIAOtIAStQiCGhCAFIAYgABEkAAsiAQF+IAEgAq0gA61CIIaEIAQgABEcACIFQiCIpxApIAWnCxkAIAEgAiADIAQgBa0gBq1CIIaEIAARIgALIwAgASACIAMgBCAFrSAGrUIghoQgB60gCK1CIIaEIAARQwALJQAgASACIAMgBCAFIAatIAetQiCGhCAIrSAJrUIghoQgABFCAAsLxcoCVwBBgAgLsBFWZWN0b3JJbnQAVmVjdG9yRG91YmxlAFZlY3RvckNoYXIAVmVjdG9yVUNoYXIAVmVjdG9yRmxvYXQAdmVjdG9yVG9vbHMAY2xlYXJWZWN0b3JEYmwAY2xlYXJWZWN0b3JGbG9hdABtYXhpU2V0dGluZ3MAc2V0dXAAc2FtcGxlUmF0ZQBjaGFubmVscwBidWZmZXJTaXplAG1heGlPc2MAc2luZXdhdmUAY29zd2F2ZQBwaGFzb3IAc2F3AHRyaWFuZ2xlAHNxdWFyZQBwdWxzZQBpbXB1bHNlAG5vaXNlAHNpbmVidWYAc2luZWJ1ZjQAc2F3bgBwaGFzZVJlc2V0AG1heGlFbnZlbG9wZQBsaW5lAHRyaWdnZXIAYW1wbGl0dWRlAHZhbGluZGV4AG1heGlEZWxheWxpbmUAZGwAbWF4aUZpbHRlcgBsb3JlcwBoaXJlcwBiYW5kcGFzcwBsb3Bhc3MAaGlwYXNzAGN1dG9mZgByZXNvbmFuY2UAbWF4aU1peABzdGVyZW8AcXVhZABhbWJpc29uaWMAbWF4aUxpbmUAcGxheQBwcmVwYXJlAHRyaWdnZXJFbmFibGUAaXNMaW5lQ29tcGxldGUAbWF4aVhGYWRlAHhmYWRlAG1heGlMYWdFeHAAaW5pdABhZGRTYW1wbGUAdmFsdWUAYWxwaGEAYWxwaGFSZWNpcHJvY2FsAHZhbABtYXhpU2FtcGxlAGdldExlbmd0aABzZXRTYW1wbGUAc2V0U2FtcGxlRnJvbU9nZ0Jsb2IAaXNSZWFkeQBwbGF5T25jZQBwbGF5T25aWABwbGF5NABjbGVhcgBub3JtYWxpc2UAYXV0b1RyaW0AbG9hZAByZWFkAGxvb3BTZXRQb3NPblpYAG1heGlEeW4AZ2F0ZQBjb21wcmVzc29yAGNvbXByZXNzAHNldEF0dGFjawBzZXRSZWxlYXNlAHNldFRocmVzaG9sZABzZXRSYXRpbwBtYXhpRW52AGFyAGFkc3IAc2V0RGVjYXkAc2V0U3VzdGFpbgBjb252ZXJ0AG10b2YAbXNUb1NhbXBzAG1heGlTYW1wbGVBbmRIb2xkAHNhaABtYXhpRmxhbmdlcgBmbGFuZ2UAbWF4aUNob3J1cwBjaG9ydXMAbWF4aURDQmxvY2tlcgBtYXhpU1ZGAHNldEN1dG9mZgBzZXRSZXNvbmFuY2UAbWF4aU1hdGgAYWRkAHN1YgBtdWwAZGl2AGd0AGx0AGd0ZQBsdGUAbW9kAGFicwBwb3cAbWF4aUNsb2NrAHRpY2tlcgBzZXRUZW1wbwBzZXRUaWNrc1BlckJlYXQAaXNUaWNrAGN1cnJlbnRDb3VudABwbGF5SGVhZABicHMAYnBtAHRpY2sAdGlja3MAbWF4aUt1cmFtb3RvT3NjaWxsYXRvcgBzZXRQaGFzZQBnZXRQaGFzZQBtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0AHNldFBoYXNlcwBzaXplAG1heGlBc3luY0t1cmFtb3RvT3NjaWxsYXRvcgBtYXhpRkZUAHByb2Nlc3MAc3BlY3RyYWxGbGF0bmVzcwBzcGVjdHJhbENlbnRyb2lkAGdldE1hZ25pdHVkZXMAZ2V0TWFnbml0dWRlc0RCAGdldFBoYXNlcwBnZXROdW1CaW5zAGdldEZGVFNpemUAZ2V0SG9wU2l6ZQBnZXRXaW5kb3dTaXplAG1heGlGRlRNb2RlcwBXSVRIX1BPTEFSX0NPTlZFUlNJT04ATk9fUE9MQVJfQ09OVkVSU0lPTgBtYXhpSUZGVABtYXhpSUZGVE1vZGVzAFNQRUNUUlVNAENPTVBMRVgAbWF4aU1GQ0MAbWZjYwBtYXhpVGltZVN0cmV0Y2gAc2hhcmVkX3B0cjxtYXhpVGltZXN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4AZ2V0Tm9ybWFsaXNlZFBvc2l0aW9uAGdldFBvc2l0aW9uAHNldFBvc2l0aW9uAHBsYXlBdFBvc2l0aW9uAG1heGlQaXRjaFNoaWZ0AHNoYXJlZF9wdHI8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4AbWF4aVN0cmV0Y2gAc2V0TG9vcFN0YXJ0AHNldExvb3BFbmQAZ2V0TG9vcEVuZABtYXhpQml0cwBzaWcAYXQAc2hsAHNocgByAGxhbmQAbG9yAGx4b3IAbmVnAGluYwBkZWMAZXEAdG9TaWduYWwAdG9UcmlnU2lnbmFsAGZyb21TaWduYWwAbWF4aUNvdW50ZXIAY291bnQAbWF4aUluZGV4AHB1bGwAbWF4aVJhdGlvU2VxAHBsYXlUcmlnAHBsYXlWYWx1ZXMAbWF4aVNhdFJldmVyYgBtYXhpRnJlZVZlcmIAYWxsb2NhdG9yPFQ+OjphbGxvY2F0ZShzaXplX3QgbikgJ24nIGV4Y2VlZHMgbWF4aW11bSBzdXBwb3J0ZWQgc2l6ZQBwdXNoX2JhY2sAcmVzaXplAGdldABzZXQATlN0M19fMjZ2ZWN0b3JJaU5TXzlhbGxvY2F0b3JJaUVFRUUATlN0M19fMjEzX192ZWN0b3JfYmFzZUlpTlNfOWFsbG9jYXRvcklpRUVFRQBOU3QzX18yMjBfX3ZlY3Rvcl9iYXNlX2NvbW1vbklMYjFFRUUAAAD8eQAAxQsAAIB6AACZCwAAAAAAAAEAAADsCwAAAAAAAIB6AAB1CwAAAAAAAAEAAAD0CwAAAAAAAFBOU3QzX18yNnZlY3RvcklpTlNfOWFsbG9jYXRvcklpRUVFRQAAAADcegAAJAwAAAAAAAAMDAAAUEtOU3QzX18yNnZlY3RvcklpTlNfOWFsbG9jYXRvcklpRUVFRQAAANx6AABcDAAAAQAAAAwMAABpaQB2AHZpAEwMAAAEeQAATAwAAGR5AAB2aWlpAEHAGQtQBHkAAEwMAACIeQAAZHkAAHZpaWlpAAAAiHkAAIQMAABpaWkABA0AAAwMAACIeQAATjEwZW1zY3JpcHRlbjN2YWxFAAD8eQAA8AwAAGlpaWkAQaAaC+YEHHkAAAwMAACIeQAAZHkAAGlpaWlpAE5TdDNfXzI2dmVjdG9ySWROU185YWxsb2NhdG9ySWRFRUVFAE5TdDNfXzIxM19fdmVjdG9yX2Jhc2VJZE5TXzlhbGxvY2F0b3JJZEVFRUUAAACAegAAWg0AAAAAAAABAAAA7AsAAAAAAACAegAANg0AAAAAAAABAAAAiA0AAAAAAABQTlN0M19fMjZ2ZWN0b3JJZE5TXzlhbGxvY2F0b3JJZEVFRUUAAAAA3HoAALgNAAAAAAAAoA0AAFBLTlN0M19fMjZ2ZWN0b3JJZE5TXzlhbGxvY2F0b3JJZEVFRUUAAADcegAA8A0AAAEAAACgDQAA4A0AAAR5AADgDQAAoHkAAHZpaWQAAAAABHkAAOANAACIeQAAoHkAAHZpaWlkAAAAiHkAABgOAAAEDQAAoA0AAIh5AAAAAAAAHHkAAKANAACIeQAAoHkAAGlpaWlkAE5TdDNfXzI2dmVjdG9ySWNOU185YWxsb2NhdG9ySWNFRUVFAE5TdDNfXzIxM19fdmVjdG9yX2Jhc2VJY05TXzlhbGxvY2F0b3JJY0VFRUUAAACAegAAqg4AAAAAAAABAAAA7AsAAAAAAACAegAAhg4AAAAAAAABAAAA2A4AAAAAAABQTlN0M19fMjZ2ZWN0b3JJY05TXzlhbGxvY2F0b3JJY0VFRUUAAAAA3HoAAAgPAAAAAAAA8A4AAFBLTlN0M19fMjZ2ZWN0b3JJY05TXzlhbGxvY2F0b3JJY0VFRUUAAADcegAAQA8AAAEAAADwDgAAMA8AAAR5AAAwDwAAKHkAQZAfCyIEeQAAMA8AAIh5AAAoeQAAiHkAAGgPAAAEDQAA8A4AAIh5AEHAHwuyAhx5AADwDgAAiHkAACh5AABOU3QzX18yNnZlY3RvckloTlNfOWFsbG9jYXRvckloRUVFRQBOU3QzX18yMTNfX3ZlY3Rvcl9iYXNlSWhOU185YWxsb2NhdG9ySWhFRUVFAIB6AAD0DwAAAAAAAAEAAADsCwAAAAAAAIB6AADQDwAAAAAAAAEAAAAgEAAAAAAAAFBOU3QzX18yNnZlY3RvckloTlNfOWFsbG9jYXRvckloRUVFRQAAAADcegAAUBAAAAAAAAA4EAAAUEtOU3QzX18yNnZlY3RvckloTlNfOWFsbG9jYXRvckloRUVFRQAAANx6AACIEAAAAQAAADgQAAB4EAAABHkAAHgQAAA0eQAABHkAAHgQAACIeQAANHkAAIh5AACwEAAABA0AADgQAACIeQBBgCILlAIceQAAOBAAAIh5AAA0eQAATlN0M19fMjZ2ZWN0b3JJZk5TXzlhbGxvY2F0b3JJZkVFRUUATlN0M19fMjEzX192ZWN0b3JfYmFzZUlmTlNfOWFsbG9jYXRvcklmRUVFRQCAegAANBEAAAAAAAABAAAA7AsAAAAAAACAegAAEBEAAAAAAAABAAAAYBEAAAAAAABQTlN0M19fMjZ2ZWN0b3JJZk5TXzlhbGxvY2F0b3JJZkVFRUUAAAAA3HoAAJARAAAAAAAAeBEAAFBLTlN0M19fMjZ2ZWN0b3JJZk5TXzlhbGxvY2F0b3JJZkVFRUUAAADcegAAyBEAAAEAAAB4EQAAuBEAAAR5AAC4EQAAlHkAAHZpaWYAQaAkC5ICBHkAALgRAACIeQAAlHkAAHZpaWlmAAAAiHkAAPARAAAEDQAAeBEAAIh5AAAAAAAAHHkAAHgRAACIeQAAlHkAAGlpaWlmADExdmVjdG9yVG9vbHMA/HkAAGYSAABQMTF2ZWN0b3JUb29scwAA3HoAAHwSAAAAAAAAdBIAAFBLMTF2ZWN0b3JUb29scwDcegAAnBIAAAEAAAB0EgAAjBIAAAR5AACgDQAAdmlpAAR5AAB4EQAAMTJtYXhpU2V0dGluZ3MAAPx5AADUEgAAUDEybWF4aVNldHRpbmdzANx6AADsEgAAAAAAAOQSAABQSzEybWF4aVNldHRpbmdzAAAAANx6AAAMEwAAAQAAAOQSAAD8EgBBwCYLcAR5AABkeQAAZHkAAGR5AAA3bWF4aU9zYwAAAAD8eQAAUBMAAFA3bWF4aU9zYwAAANx6AABkEwAAAAAAAFwTAABQSzdtYXhpT3NjAADcegAAgBMAAAEAAABcEwAAcBMAAKB5AABwEwAAoHkAAGRpaWQAQcAnC8UBoHkAAHATAACgeQAAoHkAAKB5AABkaWlkZGQAAAAAAACgeQAAcBMAAKB5AACgeQAAZGlpZGQAAACgeQAAcBMAAGRpaQAEeQAAcBMAAKB5AAAxMm1heGlFbnZlbG9wZQAA/HkAABAUAABQMTJtYXhpRW52ZWxvcGUA3HoAACgUAAAAAAAAIBQAAFBLMTJtYXhpRW52ZWxvcGUAAAAA3HoAAEgUAAABAAAAIBQAADgUAACgeQAAOBQAAGR5AACgDQAAZGlpaWkAQZApC3IEeQAAOBQAAGR5AACgeQAAMTNtYXhpRGVsYXlsaW5lAPx5AACgFAAAUDEzbWF4aURlbGF5bGluZQAAAADcegAAuBQAAAAAAACwFAAAUEsxM21heGlEZWxheWxpbmUAAADcegAA3BQAAAEAAACwFAAAzBQAQZAqC7IBoHkAAMwUAACgeQAAZHkAAKB5AABkaWlkaWQAAAAAAACgeQAAzBQAAKB5AABkeQAAoHkAAGR5AABkaWlkaWRpADEwbWF4aUZpbHRlcgAAAAD8eQAAUBUAAFAxMG1heGlGaWx0ZXIAAADcegAAaBUAAAAAAABgFQAAUEsxMG1heGlGaWx0ZXIAANx6AACIFQAAAQAAAGAVAAB4FQAAAAAAAKB5AAB4FQAAoHkAAKB5AACgeQBB0CsLogOgeQAAeBUAAKB5AACgeQAAN21heGlNaXgAAAAA/HkAAOAVAABQN21heGlNaXgAAADcegAA9BUAAAAAAADsFQAAUEs3bWF4aU1peAAA3HoAABAWAAABAAAA7BUAAAAWAAAEeQAAABYAAKB5AACgDQAAoHkAAHZpaWRpZAAAAAAAAAR5AAAAFgAAoHkAAKANAACgeQAAoHkAAHZpaWRpZGQABHkAAAAWAACgeQAAoA0AAKB5AACgeQAAoHkAAHZpaWRpZGRkADhtYXhpTGluZQAA/HkAAJUWAABQOG1heGlMaW5lAADcegAAqBYAAAAAAACgFgAAUEs4bWF4aUxpbmUA3HoAAMQWAAABAAAAoBYAALQWAACgeQAAtBYAAKB5AAAEeQAAtBYAAKB5AACgeQAAoHkAABx5AAB2aWlkZGRpAAR5AAC0FgAAoHkAABx5AAC0FgAAOW1heGlYRmFkZQAA/HkAACQXAABQOW1heGlYRmFkZQDcegAAOBcAAAAAAAAwFwAAUEs5bWF4aVhGYWRlAAAAANx6AABUFwAAAQAAADAXAEGALwumA6ANAACgDQAAoA0AAKB5AACgeQAAoHkAAKB5AACgeQAAZGlkZGQAMTBtYXhpTGFnRXhwSWRFAAAA/HkAAKYXAABQMTBtYXhpTGFnRXhwSWRFAAAAANx6AADAFwAAAAAAALgXAABQSzEwbWF4aUxhZ0V4cElkRQAAANx6AADkFwAAAQAAALgXAADUFwAAAAAAAAR5AADUFwAAoHkAAKB5AAB2aWlkZAAAAAR5AADUFwAAoHkAAKB5AAD4FwAAMTBtYXhpU2FtcGxlAAAAAPx5AAA8GAAAUDEwbWF4aVNhbXBsZQAAANx6AABUGAAAAAAAAEwYAABQSzEwbWF4aVNhbXBsZQAA3HoAAHQYAAABAAAATBgAAGQYAACIeQAAhBgAAAR5AABkGAAAoA0AAAAAAAAEeQAAZBgAAKANAABkeQAAZHkAAGQYAAA4EAAAZHkAABx5AABkGAAAoHkAAGQYAACgeQAAZBgAAKB5AAAAAAAAoHkAAGQYAACgeQAAoHkAAKB5AABkGAAAoHkAAKB5AACgeQAABHkAAGQYAAAEeQAAZBgAAKB5AEGwMguGAgR5AABkGAAAlHkAAJR5AAAceQAAHHkAAHZpaWZmaWkAHHkAAGQYAADQGQAAZHkAAE5TdDNfXzIxMmJhc2ljX3N0cmluZ0ljTlNfMTFjaGFyX3RyYWl0c0ljRUVOU185YWxsb2NhdG9ySWNFRUVFAE5TdDNfXzIyMV9fYmFzaWNfc3RyaW5nX2NvbW1vbklMYjFFRUUAAAAA/HkAAJ8ZAACAegAAYBkAAAAAAAABAAAAyBkAAAAAAAA3bWF4aUR5bgAAAAD8eQAA6BkAAFA3bWF4aUR5bgAAANx6AAD8GQAAAAAAAPQZAABQSzdtYXhpRHluAADcegAAGBoAAAEAAAD0GQAACBoAQcA0CySgeQAACBoAAKB5AACgeQAAfHkAAKB5AACgeQAAZGlpZGRpZGQAQfA0C7QBoHkAAAgaAACgeQAAoHkAAKB5AACgeQAAoHkAAGRpaWRkZGRkAAAAAKB5AAAIGgAAoHkAAAR5AAAIGgAAoHkAADdtYXhpRW52AAAAAPx5AACwGgAAUDdtYXhpRW52AAAA3HoAAMQaAAAAAAAAvBoAAFBLN21heGlFbnYAANx6AADgGgAAAQAAALwaAADQGgAAoHkAANAaAACgeQAAoHkAAKB5AAB8eQAAZHkAAGRpaWRkZGlpAEGwNgumAqB5AADQGgAAoHkAAKB5AACgeQAAoHkAAKB5AAB8eQAAZHkAAGRpaWRkZGRkaWkAAKB5AADQGgAAoHkAAGR5AABkaWlkaQAAAAR5AADQGgAAoHkAADdjb252ZXJ0AAAAAPx5AACEGwAAUDdjb252ZXJ0AAAA3HoAAJgbAAAAAAAAkBsAAFBLN2NvbnZlcnQAANx6AAC0GwAAAQAAAJAbAACkGwAAoHkAAGR5AACgeQAAoHkAAGRpZAAxN21heGlTYW1wbGVBbmRIb2xkAPx5AADoGwAAUDE3bWF4aVNhbXBsZUFuZEhvbGQAAAAA3HoAAAQcAAAAAAAA/BsAAFBLMTdtYXhpU2FtcGxlQW5kSG9sZAAAANx6AAAsHAAAAQAAAPwbAAAcHABB4DgL1gageQAAHBwAAKB5AACgeQAAMTFtYXhpRmxhbmdlcgAAAPx5AABwHAAAUDExbWF4aUZsYW5nZXIAANx6AACIHAAAAAAAAIAcAABQSzExbWF4aUZsYW5nZXIA3HoAAKgcAAABAAAAgBwAAJgcAAAAAAAAoHkAAJgcAACgeQAAcHkAAKB5AACgeQAAoHkAAGRpaWRpZGRkADEwbWF4aUNob3J1cwAAAPx5AAD1HAAAUDEwbWF4aUNob3J1cwAAANx6AAAMHQAAAAAAAAQdAABQSzEwbWF4aUNob3J1cwAA3HoAACwdAAABAAAABB0AABwdAACgeQAAHB0AAKB5AABweQAAoHkAAKB5AACgeQAAMTNtYXhpRENCbG9ja2VyAPx5AABsHQAAUDEzbWF4aURDQmxvY2tlcgAAAADcegAAhB0AAAAAAAB8HQAAUEsxM21heGlEQ0Jsb2NrZXIAAADcegAAqB0AAAEAAAB8HQAAmB0AAKB5AACYHQAAoHkAAKB5AAA3bWF4aVNWRgAAAAD8eQAA4B0AAFA3bWF4aVNWRgAAANx6AAD0HQAAAAAAAOwdAABQSzdtYXhpU1ZGAADcegAAEB4AAAEAAADsHQAAAB4AAAR5AAAAHgAAoHkAAAAAAACgeQAAAB4AAKB5AACgeQAAoHkAAKB5AACgeQAAOG1heGlNYXRoAAAA/HkAAFweAABQOG1heGlNYXRoAADcegAAcB4AAAAAAABoHgAAUEs4bWF4aU1hdGgA3HoAAIweAAABAAAAaB4AAHweAACgeQAAoHkAAKB5AABkaWRkADltYXhpQ2xvY2sA/HkAAL0eAABQOW1heGlDbG9jawDcegAA0B4AAAAAAADIHgAAUEs5bWF4aUNsb2NrAAAAANx6AADsHgAAAQAAAMgeAADcHgAABHkAANweAAAEeQAA3B4AAKB5AAAEeQAA3B4AAGR5AABkeQAA/B4AADIybWF4aUt1cmFtb3RvT3NjaWxsYXRvcgAAAAD8eQAAOB8AAFAyMm1heGlLdXJhbW90b09zY2lsbGF0b3IAAADcegAAXB8AAAAAAABUHwAAUEsyMm1heGlLdXJhbW90b09zY2lsbGF0b3IAANx6AACIHwAAAQAAAFQfAAB4HwBBwD8LogOgeQAAeB8AAKB5AACgeQAAoA0AAGRpaWRkaQAABHkAAHgfAACgeQAAoHkAAHgfAAAyNW1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQA/HkAAPAfAABQMjVtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0AAAAANx6AAAUIAAAAAAAAAwgAABQSzI1bWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldAAAANx6AABEIAAAAQAAAAwgAAA0IAAAiHkAAAAAAACgeQAANCAAAKB5AACgeQAABHkAADQgAACgeQAAiHkAAHZpaWRpAAAABHkAADQgAACgDQAAoHkAADQgAACIeQAAZGlpaQAAAACIeQAANCAAADI3bWF4aUFzeW5jS3VyYW1vdG9Pc2NpbGxhdG9yAAAAJHoAANAgAAAMIAAAUDI3bWF4aUFzeW5jS3VyYW1vdG9Pc2NpbGxhdG9yAADcegAA/CAAAAAAAADwIAAAUEsyN21heGlBc3luY0t1cmFtb3RvT3NjaWxsYXRvcgDcegAALCEAAAEAAADwIAAAHCEAAIh5AEHwwgAL4gKgeQAAHCEAAKB5AACgeQAABHkAABwhAACgeQAAiHkAAAR5AAAcIQAAoA0AAKB5AAAcIQAAiHkAAIh5AAAcIQAAN21heGlGRlQAAAAA/HkAALAhAABQN21heGlGRlQAAADcegAAxCEAAAAAAAC8IQAAUEs3bWF4aUZGVAAA3HoAAOAhAAABAAAAvCEAANAhAAAEeQAA0CEAAGR5AABkeQAAZHkAAHZpaWlpaQAAAAAAABx5AADQIQAAlHkAAEQiAABON21heGlGRlQ4ZmZ0TW9kZXNFALB5AAAwIgAAaWlpZmkAAACUeQAA0CEAAGZpaQB4EQAA0CEAAGR5AADQIQAAOG1heGlJRkZUAAAA/HkAAHAiAABQOG1heGlJRkZUAADcegAAhCIAAAAAAAB8IgAAUEs4bWF4aUlGRlQA3HoAAKAiAAABAAAAfCIAAJAiAAAEeQAAkCIAAGR5AABkeQAAZHkAQeDFAAu2DZR5AACQIgAAeBEAAHgRAAAMIwAATjhtYXhpSUZGVDhmZnRNb2Rlc0UAAAAAsHkAAPQiAABmaWlpaWkAMTZtYXhpTUZDQ0FuYWx5c2VySWRFAAAAAPx5AAAbIwAAUDE2bWF4aU1GQ0NBbmFseXNlcklkRQAA3HoAADwjAAAAAAAANCMAAFBLMTZtYXhpTUZDQ0FuYWx5c2VySWRFANx6AABkIwAAAQAAADQjAABUIwAABHkAAFQjAABweQAAcHkAAHB5AACgeQAAoHkAAHZpaWlpaWRkAAAAAKANAABUIwAAeBEAADE1bWF4aVRpbWVTdHJldGNoSTE0aGFubldpbkZ1bmN0b3JFAPx5AADEIwAAUDE1bWF4aVRpbWVTdHJldGNoSTE0aGFubldpbkZ1bmN0b3JFAAAAANx6AADwIwAAAAAAAOgjAABQSzE1bWF4aVRpbWVTdHJldGNoSTE0aGFubldpbkZ1bmN0b3JFAAAA3HoAACgkAAABAAAA6CMAAAAAAAAYJQAAKgIAACsCAAAsAgAALQIAAC4CAABOU3QzX18yMjBfX3NoYXJlZF9wdHJfcG9pbnRlcklQMTVtYXhpVGltZVN0cmV0Y2hJMTRoYW5uV2luRnVuY3RvckVOMTBlbXNjcmlwdGVuMTVzbWFydF9wdHJfdHJhaXRJTlNfMTBzaGFyZWRfcHRySVMzX0VFRTExdmFsX2RlbGV0ZXJFTlNfOWFsbG9jYXRvcklTM19FRUVFAAAkegAAfCQAAER2AABOMTBlbXNjcmlwdGVuMTVzbWFydF9wdHJfdHJhaXRJTlN0M19fMjEwc2hhcmVkX3B0ckkxNW1heGlUaW1lU3RyZXRjaEkxNGhhbm5XaW5GdW5jdG9yRUVFRTExdmFsX2RlbGV0ZXJFAE5TdDNfXzIxMHNoYXJlZF9wdHJJMTVtYXhpVGltZVN0cmV0Y2hJMTRoYW5uV2luRnVuY3RvckVFRQAAAPx5AACMJQAAaQAAAMglAAAAAAAATCYAAC8CAAAwAgAAMQIAADICAAAzAgAATlN0M19fMjIwX19zaGFyZWRfcHRyX2VtcGxhY2VJMTVtYXhpVGltZVN0cmV0Y2hJMTRoYW5uV2luRnVuY3RvckVOU185YWxsb2NhdG9ySVMzX0VFRUUAACR6AAD0JQAARHYAAAR5AAAYJAAAZBgAAKB5AAAYJAAABHkAABgkAACgeQAAAAAAAMQmAAA0AgAANQIAADYCAAA5bWF4aUdyYWluSTE0aGFubldpbkZ1bmN0b3JFADEzbWF4aUdyYWluQmFzZQAAAAD8eQAAqSYAACR6AACMJgAAvCYAAKB5AAAYJAAAoHkAAKB5AABkeQAAoHkAAGRpaWRkaWQAoHkAABgkAACgeQAAoHkAAGR5AAAxNG1heGlQaXRjaFNoaWZ0STE0aGFubldpbkZ1bmN0b3JFAAD8eQAABCcAAFAxNG1heGlQaXRjaFNoaWZ0STE0aGFubldpbkZ1bmN0b3JFANx6AAAwJwAAAAAAACgnAABQSzE0bWF4aVBpdGNoU2hpZnRJMTRoYW5uV2luRnVuY3RvckUAAAAA3HoAAGQnAAABAAAAKCcAAAAAAABUKAAANwIAADgCAAA5AgAAOgIAADsCAABOU3QzX18yMjBfX3NoYXJlZF9wdHJfcG9pbnRlcklQMTRtYXhpUGl0Y2hTaGlmdEkxNGhhbm5XaW5GdW5jdG9yRU4xMGVtc2NyaXB0ZW4xNXNtYXJ0X3B0cl90cmFpdElOU18xMHNoYXJlZF9wdHJJUzNfRUVFMTF2YWxfZGVsZXRlckVOU185YWxsb2NhdG9ySVMzX0VFRUUAAAAkegAAuCcAAER2AABOMTBlbXNjcmlwdGVuMTVzbWFydF9wdHJfdHJhaXRJTlN0M19fMjEwc2hhcmVkX3B0ckkxNG1heGlQaXRjaFNoaWZ0STE0aGFubldpbkZ1bmN0b3JFRUVFMTF2YWxfZGVsZXRlckUATlN0M19fMjEwc2hhcmVkX3B0ckkxNG1heGlQaXRjaFNoaWZ0STE0aGFubldpbkZ1bmN0b3JFRUUA/HkAAMcoAAAAKQAAAAAAAIApAAA8AgAAPQIAAD4CAAAyAgAAPwIAAE5TdDNfXzIyMF9fc2hhcmVkX3B0cl9lbXBsYWNlSTE0bWF4aVBpdGNoU2hpZnRJMTRoYW5uV2luRnVuY3RvckVOU185YWxsb2NhdG9ySVMzX0VFRUUAAAAkegAAKCkAAER2AAAEeQAAVCcAAGQYAEGg0wAL0gGgeQAAVCcAAKB5AACgeQAAZHkAAKB5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fEkAAIQCAACFAgAAHEcAADBHAAAAAAAAZEcAAIYCAACHAgAATlN0M19fMjhpb3NfYmFzZUUAAAD8eQAAUEcAAAAAAACoRwAAiAIAAIkCAABOU3QzX18yOWJhc2ljX2lvc0ljTlNfMTFjaGFyX3RyYWl0c0ljRUVFRQAAACR6AAB8RwAAZEcAAAAAAADwRwAAigIAAIsCAABOU3QzX18yOWJhc2ljX2lvc0l3TlNfMTFjaGFyX3RyYWl0c0l3RUVFRQAAACR6AADERwAAZEcAAE5TdDNfXzIxNWJhc2ljX3N0cmVhbWJ1ZkljTlNfMTFjaGFyX3RyYWl0c0ljRUVFRQAAAAD8eQAA/EcAAE5TdDNfXzIxNWJhc2ljX3N0cmVhbWJ1Zkl3TlNfMTFjaGFyX3RyYWl0c0l3RUVFRQAAAAD8eQAAOEgAAE5TdDNfXzIxM2Jhc2ljX2lzdHJlYW1JY05TXzExY2hhcl90cmFpdHNJY0VFRUUAAIB6AAB0SAAAAAAAAAEAAACoRwAAA/T//05TdDNfXzIxM2Jhc2ljX2lzdHJlYW1Jd05TXzExY2hhcl90cmFpdHNJd0VFRUUAAIB6AAC8SAAAAAAAAAEAAADwRwAAA/T//05TdDNfXzIxM2Jhc2ljX29zdHJlYW1JY05TXzExY2hhcl90cmFpdHNJY0VFRUUAAIB6AAAESQAAAAAAAAEAAACoRwAAA/T//05TdDNfXzIxM2Jhc2ljX29zdHJlYW1Jd05TXzExY2hhcl90cmFpdHNJd0VFRUUAAIB6AABMSQAAAAAAAAEAAADwRwAAA/T//8i2AAAAAAAA8EkAAGICAACNAgAAjgIAAGUCAABmAgAAZwIAAGgCAABQAgAAUQIAAI8CAACQAgAAkQIAAFUCAABrAgAATlN0M19fMjEwX19zdGRpbmJ1ZkljRUUAJHoAANhJAAAwSAAAdW5zdXBwb3J0ZWQgbG9jYWxlIGZvciBzdGFuZGFyZCBpbnB1dAAAAAAAAAB8SgAAbAIAAJICAACTAgAAbwIAAHACAABxAgAAcgIAAHMCAAB0AgAAlAIAAJUCAACWAgAAeAIAAHkCAABOU3QzX18yMTBfX3N0ZGluYnVmSXdFRQAkegAAZEoAAGxIAAAAAAAA5EoAAGICAACXAgAAmAIAAGUCAABmAgAAZwIAAJkCAABQAgAAUQIAAGkCAABTAgAAagIAAJoCAACbAgAATlN0M19fMjExX19zdGRvdXRidWZJY0VFAAAAACR6AADISgAAMEgAAAAAAABMSwAAbAIAAJwCAACdAgAAbwIAAHACAABxAgAAngIAAHMCAAB0AgAAdQIAAHYCAAB3AgAAnwIAAKACAABOU3QzX18yMTFfX3N0ZG91dGJ1Zkl3RUUAAAAAJHoAADBLAABsSABB4JYBC+ME/////////////////////////////////////////////////////////////////wABAgMEBQYHCAn/////////CgsMDQ4PEBESExQVFhcYGRobHB0eHyAhIiP///////8KCwwNDg8QERITFBUWFxgZGhscHR4fICEiI/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////8AAQIEBwMGBQAAAAAAAAACAADAAwAAwAQAAMAFAADABgAAwAcAAMAIAADACQAAwAoAAMALAADADAAAwA0AAMAOAADADwAAwBAAAMARAADAEgAAwBMAAMAUAADAFQAAwBYAAMAXAADAGAAAwBkAAMAaAADAGwAAwBwAAMAdAADAHgAAwB8AAMAAAACzAQAAwwIAAMMDAADDBAAAwwUAAMMGAADDBwAAwwgAAMMJAADDCgAAwwsAAMMMAADDDQAA0w4AAMMPAADDAAAMuwEADMMCAAzDAwAMwwQADNNpbmZpbml0eQBuYW4AAAAAAAAAANF0ngBXnb0qgHBSD///PicKAAAAZAAAAOgDAAAQJwAAoIYBAEBCDwCAlpgAAOH1BRgAAAA1AAAAcQAAAGv////O+///kr///wAAAAAAAAAA3hIElQAAAAD///////////////+gTQAAFAAAAEMuVVRGLTgAQeibAQsCtE0AQYCcAQsGTENfQUxMAEGQnAELbkxDX0NUWVBFAAAAAExDX05VTUVSSUMAAExDX1RJTUUAAAAAAExDX0NPTExBVEUAAExDX01PTkVUQVJZAExDX01FU1NBR0VTAExBTkcAQy5VVEYtOABQT1NJWABNVVNMX0xPQ1BBVEgAAAAAAIBPAEGAnwEL/wECAAIAAgACAAIAAgACAAIAAgADIAIgAiACIAIgAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAWAEwATABMAEwATABMAEwATABMAEwATABMAEwATABMAI2AjYCNgI2AjYCNgI2AjYCNgI2ATABMAEwATABMAEwATACNUI1QjVCNUI1QjVCMUIxQjFCMUIxQjFCMUIxQjFCMUIxQjFCMUIxQjFCMUIxQjFCMUIxQTABMAEwATABMAEwAjWCNYI1gjWCNYI1gjGCMYIxgjGCMYIxgjGCMYIxgjGCMYIxgjGCMYIxgjGCMYIxgjGCMYEwATABMAEwAIAQYCjAQsCkFMAQZSnAQv5AwEAAAACAAAAAwAAAAQAAAAFAAAABgAAAAcAAAAIAAAACQAAAAoAAAALAAAADAAAAA0AAAAOAAAADwAAABAAAAARAAAAEgAAABMAAAAUAAAAFQAAABYAAAAXAAAAGAAAABkAAAAaAAAAGwAAABwAAAAdAAAAHgAAAB8AAAAgAAAAIQAAACIAAAAjAAAAJAAAACUAAAAmAAAAJwAAACgAAAApAAAAKgAAACsAAAAsAAAALQAAAC4AAAAvAAAAMAAAADEAAAAyAAAAMwAAADQAAAA1AAAANgAAADcAAAA4AAAAOQAAADoAAAA7AAAAPAAAAD0AAAA+AAAAPwAAAEAAAABBAAAAQgAAAEMAAABEAAAARQAAAEYAAABHAAAASAAAAEkAAABKAAAASwAAAEwAAABNAAAATgAAAE8AAABQAAAAUQAAAFIAAABTAAAAVAAAAFUAAABWAAAAVwAAAFgAAABZAAAAWgAAAFsAAABcAAAAXQAAAF4AAABfAAAAYAAAAEEAAABCAAAAQwAAAEQAAABFAAAARgAAAEcAAABIAAAASQAAAEoAAABLAAAATAAAAE0AAABOAAAATwAAAFAAAABRAAAAUgAAAFMAAABUAAAAVQAAAFYAAABXAAAAWAAAAFkAAABaAAAAewAAAHwAAAB9AAAAfgAAAH8AQZCvAQsCoFkAQaSzAQv5AwEAAAACAAAAAwAAAAQAAAAFAAAABgAAAAcAAAAIAAAACQAAAAoAAAALAAAADAAAAA0AAAAOAAAADwAAABAAAAARAAAAEgAAABMAAAAUAAAAFQAAABYAAAAXAAAAGAAAABkAAAAaAAAAGwAAABwAAAAdAAAAHgAAAB8AAAAgAAAAIQAAACIAAAAjAAAAJAAAACUAAAAmAAAAJwAAACgAAAApAAAAKgAAACsAAAAsAAAALQAAAC4AAAAvAAAAMAAAADEAAAAyAAAAMwAAADQAAAA1AAAANgAAADcAAAA4AAAAOQAAADoAAAA7AAAAPAAAAD0AAAA+AAAAPwAAAEAAAABhAAAAYgAAAGMAAABkAAAAZQAAAGYAAABnAAAAaAAAAGkAAABqAAAAawAAAGwAAABtAAAAbgAAAG8AAABwAAAAcQAAAHIAAABzAAAAdAAAAHUAAAB2AAAAdwAAAHgAAAB5AAAAegAAAFsAAABcAAAAXQAAAF4AAABfAAAAYAAAAGEAAABiAAAAYwAAAGQAAABlAAAAZgAAAGcAAABoAAAAaQAAAGoAAABrAAAAbAAAAG0AAABuAAAAbwAAAHAAAABxAAAAcgAAAHMAAAB0AAAAdQAAAHYAAAB3AAAAeAAAAHkAAAB6AAAAewAAAHwAAAB9AAAAfgAAAH8AQaC7AQvRATAxMjM0NTY3ODlhYmNkZWZBQkNERUZ4WCstcFBpSW5OACVwAGwAbGwAAEwAJQAAAAAAJXAAAAAAJUk6JU06JVMgJXAlSDolTQAAAAAAAAAAJQAAAG0AAAAvAAAAJQAAAGQAAAAvAAAAJQAAAHkAAAAlAAAAWQAAAC0AAAAlAAAAbQAAAC0AAAAlAAAAZAAAACUAAABJAAAAOgAAACUAAABNAAAAOgAAACUAAABTAAAAIAAAACUAAABwAAAAAAAAACUAAABIAAAAOgAAACUAAABNAEGAvQELvQQlAAAASAAAADoAAAAlAAAATQAAADoAAAAlAAAAUwAAACVMZgAwMTIzNDU2Nzg5ACUuMExmAEMAAAAAAAAoZAAAtAIAALUCAAC2AgAAAAAAAIhkAAC3AgAAuAIAALYCAAC5AgAAugIAALsCAAC8AgAAvQIAAL4CAAC/AgAAwAIAAAAAAADwYwAAwQIAAMICAAC2AgAAwwIAAMQCAADFAgAAxgIAAMcCAADIAgAAyQIAAAAAAADAZAAAygIAAMsCAAC2AgAAzAIAAM0CAADOAgAAzwIAANACAAAAAAAA5GQAANECAADSAgAAtgIAANMCAADUAgAA1QIAANYCAADXAgAAdHJ1ZQAAAAB0AAAAcgAAAHUAAABlAAAAAAAAAGZhbHNlAAAAZgAAAGEAAABsAAAAcwAAAGUAAAAAAAAAJW0vJWQvJXkAAAAAJQAAAG0AAAAvAAAAJQAAAGQAAAAvAAAAJQAAAHkAAAAAAAAAJUg6JU06JVMAAAAAJQAAAEgAAAA6AAAAJQAAAE0AAAA6AAAAJQAAAFMAAAAAAAAAJWEgJWIgJWQgJUg6JU06JVMgJVkAAAAAJQAAAGEAAAAgAAAAJQAAAGIAAAAgAAAAJQAAAGQAAAAgAAAAJQAAAEgAAAA6AAAAJQAAAE0AAAA6AAAAJQAAAFMAAAAgAAAAJQAAAFkAAAAAAAAAJUk6JU06JVMgJXAAJQAAAEkAAAA6AAAAJQAAAE0AAAA6AAAAJQAAAFMAAAAgAAAAJQAAAHAAQcjBAQvWCvBgAADYAgAA2QIAALYCAABOU3QzX18yNmxvY2FsZTVmYWNldEUAAAAkegAA2GAAABx2AAAAAAAAcGEAANgCAADaAgAAtgIAANsCAADcAgAA3QIAAN4CAADfAgAA4AIAAOECAADiAgAA4wIAAOQCAADlAgAA5gIAAE5TdDNfXzI1Y3R5cGVJd0VFAE5TdDNfXzIxMGN0eXBlX2Jhc2VFAAD8eQAAUmEAAIB6AABAYQAAAAAAAAIAAADwYAAAAgAAAGhhAAACAAAAAAAAAARiAADYAgAA5wIAALYCAADoAgAA6QIAAOoCAADrAgAA7AIAAO0CAADuAgAATlN0M19fMjdjb2RlY3Z0SWNjMTFfX21ic3RhdGVfdEVFAE5TdDNfXzIxMmNvZGVjdnRfYmFzZUUAAAAA/HkAAOJhAACAegAAwGEAAAAAAAACAAAA8GAAAAIAAAD8YQAAAgAAAAAAAAB4YgAA2AIAAO8CAAC2AgAA8AIAAPECAADyAgAA8wIAAPQCAAD1AgAA9gIAAE5TdDNfXzI3Y29kZWN2dElEc2MxMV9fbWJzdGF0ZV90RUUAAIB6AABUYgAAAAAAAAIAAADwYAAAAgAAAPxhAAACAAAAAAAAAOxiAADYAgAA9wIAALYCAAD4AgAA+QIAAPoCAAD7AgAA/AIAAP0CAAD+AgAATlN0M19fMjdjb2RlY3Z0SURpYzExX19tYnN0YXRlX3RFRQAAgHoAAMhiAAAAAAAAAgAAAPBgAAACAAAA/GEAAAIAAAAAAAAAYGMAANgCAAD/AgAAtgIAAPgCAAD5AgAA+gIAAPsCAAD8AgAA/QIAAP4CAABOU3QzX18yMTZfX25hcnJvd190b191dGY4SUxtMzJFRUUAAAAkegAAPGMAAOxiAAAAAAAAwGMAANgCAAAAAwAAtgIAAPgCAAD5AgAA+gIAAPsCAAD8AgAA/QIAAP4CAABOU3QzX18yMTdfX3dpZGVuX2Zyb21fdXRmOElMbTMyRUVFAAAkegAAnGMAAOxiAABOU3QzX18yN2NvZGVjdnRJd2MxMV9fbWJzdGF0ZV90RUUAAACAegAAzGMAAAAAAAACAAAA8GAAAAIAAAD8YQAAAgAAAE5TdDNfXzI2bG9jYWxlNV9faW1wRQAAACR6AAAQZAAA8GAAAE5TdDNfXzI3Y29sbGF0ZUljRUUAJHoAADRkAADwYAAATlN0M19fMjdjb2xsYXRlSXdFRQAkegAAVGQAAPBgAABOU3QzX18yNWN0eXBlSWNFRQAAAIB6AAB0ZAAAAAAAAAIAAADwYAAAAgAAAGhhAAACAAAATlN0M19fMjhudW1wdW5jdEljRUUAAAAAJHoAAKhkAADwYAAATlN0M19fMjhudW1wdW5jdEl3RUUAAAAAJHoAAMxkAADwYAAAAAAAAEhkAAABAwAAAgMAALYCAAADAwAABAMAAAUDAAAAAAAAaGQAAAYDAAAHAwAAtgIAAAgDAAAJAwAACgMAAAAAAAAEZgAA2AIAAAsDAAC2AgAADAMAAA0DAAAOAwAADwMAABADAAARAwAAEgMAABMDAAAUAwAAFQMAABYDAABOU3QzX18yN251bV9nZXRJY05TXzE5aXN0cmVhbWJ1Zl9pdGVyYXRvckljTlNfMTFjaGFyX3RyYWl0c0ljRUVFRUVFAE5TdDNfXzI5X19udW1fZ2V0SWNFRQBOU3QzX18yMTRfX251bV9nZXRfYmFzZUUAAPx5AADKZQAAgHoAALRlAAAAAAAAAQAAAORlAAAAAAAAgHoAAHBlAAAAAAAAAgAAAPBgAAACAAAA7GUAQajMAQvKAdhmAADYAgAAFwMAALYCAAAYAwAAGQMAABoDAAAbAwAAHAMAAB0DAAAeAwAAHwMAACADAAAhAwAAIgMAAE5TdDNfXzI3bnVtX2dldEl3TlNfMTlpc3RyZWFtYnVmX2l0ZXJhdG9ySXdOU18xMWNoYXJfdHJhaXRzSXdFRUVFRUUATlN0M19fMjlfX251bV9nZXRJd0VFAAAAgHoAAKhmAAAAAAAAAQAAAORlAAAAAAAAgHoAAGRmAAAAAAAAAgAAAPBgAAACAAAAwGYAQfzNAQveAcBnAADYAgAAIwMAALYCAAAkAwAAJQMAACYDAAAnAwAAKAMAACkDAAAqAwAAKwMAAE5TdDNfXzI3bnVtX3B1dEljTlNfMTlvc3RyZWFtYnVmX2l0ZXJhdG9ySWNOU18xMWNoYXJfdHJhaXRzSWNFRUVFRUUATlN0M19fMjlfX251bV9wdXRJY0VFAE5TdDNfXzIxNF9fbnVtX3B1dF9iYXNlRQAA/HkAAIZnAACAegAAcGcAAAAAAAABAAAAoGcAAAAAAACAegAALGcAAAAAAAACAAAA8GAAAAIAAACoZwBB5M8BC74BiGgAANgCAAAsAwAAtgIAAC0DAAAuAwAALwMAADADAAAxAwAAMgMAADMDAAA0AwAATlN0M19fMjdudW1fcHV0SXdOU18xOW9zdHJlYW1idWZfaXRlcmF0b3JJd05TXzExY2hhcl90cmFpdHNJd0VFRUVFRQBOU3QzX18yOV9fbnVtX3B1dEl3RUUAAACAegAAWGgAAAAAAAABAAAAoGcAAAAAAACAegAAFGgAAAAAAAACAAAA8GAAAAIAAABwaABBrNEBC5oLiGkAADUDAAA2AwAAtgIAADcDAAA4AwAAOQMAADoDAAA7AwAAPAMAAD0DAAD4////iGkAAD4DAAA/AwAAQAMAAEEDAABCAwAAQwMAAEQDAABOU3QzX18yOHRpbWVfZ2V0SWNOU18xOWlzdHJlYW1idWZfaXRlcmF0b3JJY05TXzExY2hhcl90cmFpdHNJY0VFRUVFRQBOU3QzX18yOXRpbWVfYmFzZUUA/HkAAEFpAABOU3QzX18yMjBfX3RpbWVfZ2V0X2Nfc3RvcmFnZUljRUUAAAD8eQAAXGkAAIB6AAD8aAAAAAAAAAMAAADwYAAAAgAAAFRpAAACAAAAgGkAAAAIAAAAAAAAdGoAAEUDAABGAwAAtgIAAEcDAABIAwAASQMAAEoDAABLAwAATAMAAE0DAAD4////dGoAAE4DAABPAwAAUAMAAFEDAABSAwAAUwMAAFQDAABOU3QzX18yOHRpbWVfZ2V0SXdOU18xOWlzdHJlYW1idWZfaXRlcmF0b3JJd05TXzExY2hhcl90cmFpdHNJd0VFRUVFRQBOU3QzX18yMjBfX3RpbWVfZ2V0X2Nfc3RvcmFnZUl3RUUAAPx5AABJagAAgHoAAARqAAAAAAAAAwAAAPBgAAACAAAAVGkAAAIAAABsagAAAAgAAAAAAAAYawAAVQMAAFYDAAC2AgAAVwMAAE5TdDNfXzI4dGltZV9wdXRJY05TXzE5b3N0cmVhbWJ1Zl9pdGVyYXRvckljTlNfMTFjaGFyX3RyYWl0c0ljRUVFRUVFAE5TdDNfXzIxMF9fdGltZV9wdXRFAAAA/HkAAPlqAACAegAAtGoAAAAAAAACAAAA8GAAAAIAAAAQawAAAAgAAAAAAACYawAAWAMAAFkDAAC2AgAAWgMAAE5TdDNfXzI4dGltZV9wdXRJd05TXzE5b3N0cmVhbWJ1Zl9pdGVyYXRvckl3TlNfMTFjaGFyX3RyYWl0c0l3RUVFRUVFAAAAAIB6AABQawAAAAAAAAIAAADwYAAAAgAAABBrAAAACAAAAAAAACxsAADYAgAAWwMAALYCAABcAwAAXQMAAF4DAABfAwAAYAMAAGEDAABiAwAAYwMAAGQDAABOU3QzX18yMTBtb25leXB1bmN0SWNMYjBFRUUATlN0M19fMjEwbW9uZXlfYmFzZUUAAAAA/HkAAAxsAACAegAA8GsAAAAAAAACAAAA8GAAAAIAAAAkbAAAAgAAAAAAAACgbAAA2AIAAGUDAAC2AgAAZgMAAGcDAABoAwAAaQMAAGoDAABrAwAAbAMAAG0DAABuAwAATlN0M19fMjEwbW9uZXlwdW5jdEljTGIxRUVFAIB6AACEbAAAAAAAAAIAAADwYAAAAgAAACRsAAACAAAAAAAAABRtAADYAgAAbwMAALYCAABwAwAAcQMAAHIDAABzAwAAdAMAAHUDAAB2AwAAdwMAAHgDAABOU3QzX18yMTBtb25leXB1bmN0SXdMYjBFRUUAgHoAAPhsAAAAAAAAAgAAAPBgAAACAAAAJGwAAAIAAAAAAAAAiG0AANgCAAB5AwAAtgIAAHoDAAB7AwAAfAMAAH0DAAB+AwAAfwMAAIADAACBAwAAggMAAE5TdDNfXzIxMG1vbmV5cHVuY3RJd0xiMUVFRQCAegAAbG0AAAAAAAACAAAA8GAAAAIAAAAkbAAAAgAAAAAAAAAsbgAA2AIAAIMDAAC2AgAAhAMAAIUDAABOU3QzX18yOW1vbmV5X2dldEljTlNfMTlpc3RyZWFtYnVmX2l0ZXJhdG9ySWNOU18xMWNoYXJfdHJhaXRzSWNFRUVFRUUATlN0M19fMjExX19tb25leV9nZXRJY0VFAAD8eQAACm4AAIB6AADEbQAAAAAAAAIAAADwYAAAAgAAACRuAEHQ3AELmgHQbgAA2AIAAIYDAAC2AgAAhwMAAIgDAABOU3QzX18yOW1vbmV5X2dldEl3TlNfMTlpc3RyZWFtYnVmX2l0ZXJhdG9ySXdOU18xMWNoYXJfdHJhaXRzSXdFRUVFRUUATlN0M19fMjExX19tb25leV9nZXRJd0VFAAD8eQAArm4AAIB6AABobgAAAAAAAAIAAADwYAAAAgAAAMhuAEH03QELmgF0bwAA2AIAAIkDAAC2AgAAigMAAIsDAABOU3QzX18yOW1vbmV5X3B1dEljTlNfMTlvc3RyZWFtYnVmX2l0ZXJhdG9ySWNOU18xMWNoYXJfdHJhaXRzSWNFRUVFRUUATlN0M19fMjExX19tb25leV9wdXRJY0VFAAD8eQAAUm8AAIB6AAAMbwAAAAAAAAIAAADwYAAAAgAAAGxvAEGY3wELmgEYcAAA2AIAAIwDAAC2AgAAjQMAAI4DAABOU3QzX18yOW1vbmV5X3B1dEl3TlNfMTlvc3RyZWFtYnVmX2l0ZXJhdG9ySXdOU18xMWNoYXJfdHJhaXRzSXdFRUVFRUUATlN0M19fMjExX19tb25leV9wdXRJd0VFAAD8eQAA9m8AAIB6AACwbwAAAAAAAAIAAADwYAAAAgAAABBwAEG84AEL6iGQcAAA2AIAAI8DAAC2AgAAkAMAAJEDAACSAwAATlN0M19fMjhtZXNzYWdlc0ljRUUATlN0M19fMjEzbWVzc2FnZXNfYmFzZUUAAAAA/HkAAG1wAACAegAAWHAAAAAAAAACAAAA8GAAAAIAAACIcAAAAgAAAAAAAADocAAA2AIAAJMDAAC2AgAAlAMAAJUDAACWAwAATlN0M19fMjhtZXNzYWdlc0l3RUUAAAAAgHoAANBwAAAAAAAAAgAAAPBgAAACAAAAiHAAAAIAAABTdW5kYXkATW9uZGF5AFR1ZXNkYXkAV2VkbmVzZGF5AFRodXJzZGF5AEZyaWRheQBTYXR1cmRheQBTdW4ATW9uAFR1ZQBXZWQAVGh1AEZyaQBTYXQAAAAAUwAAAHUAAABuAAAAZAAAAGEAAAB5AAAAAAAAAE0AAABvAAAAbgAAAGQAAABhAAAAeQAAAAAAAABUAAAAdQAAAGUAAABzAAAAZAAAAGEAAAB5AAAAAAAAAFcAAABlAAAAZAAAAG4AAABlAAAAcwAAAGQAAABhAAAAeQAAAAAAAABUAAAAaAAAAHUAAAByAAAAcwAAAGQAAABhAAAAeQAAAAAAAABGAAAAcgAAAGkAAABkAAAAYQAAAHkAAAAAAAAAUwAAAGEAAAB0AAAAdQAAAHIAAABkAAAAYQAAAHkAAAAAAAAAUwAAAHUAAABuAAAAAAAAAE0AAABvAAAAbgAAAAAAAABUAAAAdQAAAGUAAAAAAAAAVwAAAGUAAABkAAAAAAAAAFQAAABoAAAAdQAAAAAAAABGAAAAcgAAAGkAAAAAAAAAUwAAAGEAAAB0AAAAAAAAAEphbnVhcnkARmVicnVhcnkATWFyY2gAQXByaWwATWF5AEp1bmUASnVseQBBdWd1c3QAU2VwdGVtYmVyAE9jdG9iZXIATm92ZW1iZXIARGVjZW1iZXIASmFuAEZlYgBNYXIAQXByAEp1bgBKdWwAQXVnAFNlcABPY3QATm92AERlYwAAAEoAAABhAAAAbgAAAHUAAABhAAAAcgAAAHkAAAAAAAAARgAAAGUAAABiAAAAcgAAAHUAAABhAAAAcgAAAHkAAAAAAAAATQAAAGEAAAByAAAAYwAAAGgAAAAAAAAAQQAAAHAAAAByAAAAaQAAAGwAAAAAAAAATQAAAGEAAAB5AAAAAAAAAEoAAAB1AAAAbgAAAGUAAAAAAAAASgAAAHUAAABsAAAAeQAAAAAAAABBAAAAdQAAAGcAAAB1AAAAcwAAAHQAAAAAAAAAUwAAAGUAAABwAAAAdAAAAGUAAABtAAAAYgAAAGUAAAByAAAAAAAAAE8AAABjAAAAdAAAAG8AAABiAAAAZQAAAHIAAAAAAAAATgAAAG8AAAB2AAAAZQAAAG0AAABiAAAAZQAAAHIAAAAAAAAARAAAAGUAAABjAAAAZQAAAG0AAABiAAAAZQAAAHIAAAAAAAAASgAAAGEAAABuAAAAAAAAAEYAAABlAAAAYgAAAAAAAABNAAAAYQAAAHIAAAAAAAAAQQAAAHAAAAByAAAAAAAAAEoAAAB1AAAAbgAAAAAAAABKAAAAdQAAAGwAAAAAAAAAQQAAAHUAAABnAAAAAAAAAFMAAABlAAAAcAAAAAAAAABPAAAAYwAAAHQAAAAAAAAATgAAAG8AAAB2AAAAAAAAAEQAAABlAAAAYwAAAAAAAABBTQBQTQAAAEEAAABNAAAAAAAAAFAAAABNAAAAAAAAAGFsbG9jYXRvcjxUPjo6YWxsb2NhdGUoc2l6ZV90IG4pICduJyBleGNlZWRzIG1heGltdW0gc3VwcG9ydGVkIHNpemUAAAAAAIBpAAA+AwAAPwMAAEADAABBAwAAQgMAAEMDAABEAwAAAAAAAGxqAABOAwAATwMAAFADAABRAwAAUgMAAFMDAABUAwAAAAAAABx2AACXAwAAmAMAAJkDAABOU3QzX18yMTRfX3NoYXJlZF9jb3VudEUAAAAA/HkAAAB2AABOU3QzX18yMTlfX3NoYXJlZF93ZWFrX2NvdW50RQAAAIB6AAAkdgAAAAAAAAEAAAAcdgAAAAAAAGJhc2ljX3N0cmluZwB2ZWN0b3IAUHVyZSB2aXJ0dWFsIGZ1bmN0aW9uIGNhbGxlZCEAc3RkOjpleGNlcHRpb24AAAAAAAAAAMR2AACaAwAAmwMAAJwDAABTdDlleGNlcHRpb24AAAAA/HkAALR2AAAAAAAA8HYAABUCAACdAwAAngMAAFN0MTFsb2dpY19lcnJvcgAkegAA4HYAAMR2AAAAAAAAJHcAABUCAACfAwAAngMAAFN0MTJsZW5ndGhfZXJyb3IAAAAAJHoAABB3AADwdgAAAAAAAHR3AABAAgAAoAMAAKEDAABzdGQ6OmJhZF9jYXN0AFN0OXR5cGVfaW5mbwAA/HkAAFJ3AABTdDhiYWRfY2FzdAAkegAAaHcAAMR2AABOMTBfX2N4eGFiaXYxMTZfX3NoaW1fdHlwZV9pbmZvRQAAAAAkegAAgHcAAGB3AABOMTBfX2N4eGFiaXYxMTdfX2NsYXNzX3R5cGVfaW5mb0UAAAAkegAAsHcAAKR3AABOMTBfX2N4eGFiaXYxMTdfX3BiYXNlX3R5cGVfaW5mb0UAAAAkegAA4HcAAKR3AABOMTBfX2N4eGFiaXYxMTlfX3BvaW50ZXJfdHlwZV9pbmZvRQAkegAAEHgAAAR4AABOMTBfX2N4eGFiaXYxMjBfX2Z1bmN0aW9uX3R5cGVfaW5mb0UAAAAAJHoAAEB4AACkdwAATjEwX19jeHhhYml2MTI5X19wb2ludGVyX3RvX21lbWJlcl90eXBlX2luZm9FAAAAJHoAAHR4AAAEeAAAAAAAAPR4AACiAwAAowMAAKQDAAClAwAApgMAAE4xMF9fY3h4YWJpdjEyM19fZnVuZGFtZW50YWxfdHlwZV9pbmZvRQAkegAAzHgAAKR3AAB2AAAAuHgAAAB5AABEbgAAuHgAAAx5AABiAAAAuHgAABh5AABjAAAAuHgAACR5AABoAAAAuHgAADB5AABhAAAAuHgAADx5AABzAAAAuHgAAEh5AAB0AAAAuHgAAFR5AABpAAAAuHgAAGB5AABqAAAAuHgAAGx5AABsAAAAuHgAAHh5AABtAAAAuHgAAIR5AABmAAAAuHgAAJB5AABkAAAAuHgAAJx5AAAAAAAA6HkAAKIDAACnAwAApAMAAKUDAACoAwAATjEwX19jeHhhYml2MTE2X19lbnVtX3R5cGVfaW5mb0UAAAAAJHoAAMR5AACkdwAAAAAAANR3AACiAwAAqQMAAKQDAAClAwAAqgMAAKsDAACsAwAArQMAAAAAAABsegAAogMAAK4DAACkAwAApQMAAKoDAACvAwAAsAMAALEDAABOMTBfX2N4eGFiaXYxMjBfX3NpX2NsYXNzX3R5cGVfaW5mb0UAAAAAJHoAAER6AADUdwAAAAAAAMh6AACiAwAAsgMAAKQDAAClAwAAqgMAALMDAAC0AwAAtQMAAE4xMF9fY3h4YWJpdjEyMV9fdm1pX2NsYXNzX3R5cGVfaW5mb0UAAAAkegAAoHoAANR3AAAAAAAANHgAAKIDAAC2AwAApAMAAKUDAAC3AwAAdm9pZABib29sAGNoYXIAc2lnbmVkIGNoYXIAdW5zaWduZWQgY2hhcgBzaG9ydAB1bnNpZ25lZCBzaG9ydABpbnQAdW5zaWduZWQgaW50AGxvbmcAdW5zaWduZWQgbG9uZwBmbG9hdABkb3VibGUAc3RkOjpzdHJpbmcAc3RkOjpiYXNpY19zdHJpbmc8dW5zaWduZWQgY2hhcj4Ac3RkOjp3c3RyaW5nAHN0ZDo6dTE2c3RyaW5nAHN0ZDo6dTMyc3RyaW5nAGVtc2NyaXB0ZW46OnZhbABlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxjaGFyPgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxzaWduZWQgY2hhcj4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8dW5zaWduZWQgY2hhcj4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8c2hvcnQ+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHVuc2lnbmVkIHNob3J0PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxpbnQ+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHVuc2lnbmVkIGludD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8bG9uZz4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8dW5zaWduZWQgbG9uZz4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8aW50OF90PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzx1aW50OF90PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxpbnQxNl90PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzx1aW50MTZfdD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8aW50MzJfdD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8dWludDMyX3Q+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PGZsb2F0PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxkb3VibGU+AE5TdDNfXzIxMmJhc2ljX3N0cmluZ0loTlNfMTFjaGFyX3RyYWl0c0loRUVOU185YWxsb2NhdG9ySWhFRUVFAAAAAIB6AAAGfgAAAAAAAAEAAADIGQAAAAAAAE5TdDNfXzIxMmJhc2ljX3N0cmluZ0l3TlNfMTFjaGFyX3RyYWl0c0l3RUVOU185YWxsb2NhdG9ySXdFRUVFAACAegAAYH4AAAAAAAABAAAAyBkAAAAAAABOU3QzX18yMTJiYXNpY19zdHJpbmdJRHNOU18xMWNoYXJfdHJhaXRzSURzRUVOU185YWxsb2NhdG9ySURzRUVFRQAAAIB6AAC4fgAAAAAAAAEAAADIGQAAAAAAAE5TdDNfXzIxMmJhc2ljX3N0cmluZ0lEaU5TXzExY2hhcl90cmFpdHNJRGlFRU5TXzlhbGxvY2F0b3JJRGlFRUVFAAAAgHoAABR/AAAAAAAAAQAAAMgZAAAAAAAATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJY0VFAAD8eQAAcH8AAE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SWFFRQAA/HkAAJh/AABOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0loRUUAAPx5AADAfwAATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJc0VFAAD8eQAA6H8AAE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SXRFRQAA/HkAABCAAABOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0lpRUUAAPx5AAA4gAAATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJakVFAAD8eQAAYIAAAE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SWxFRQAA/HkAAIiAAABOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0ltRUUAAPx5AACwgAAATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJZkVFAAD8eQAA2IAAAE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SWRFRQAA/HkAAACBAEGyggILDIA/RKwAAAIAAAAABABByIICC9Ben3JMFvcfiT+fckwW9x+ZP/hVuVD516I//MdCdAgcqT+k5NU5BmSvP54KuOf507I/oMN8eQH2tT+aBkXzABa5P0vqBDQRNrw/Zw+0AkNWvz9iodY07zjBP55eKcsQx8I/Tfilft5UxD834PPDCOHFP5SkaybfbMc/1SE3ww34yD/gEKrU7IHKP9C4cCAkC8w/idLe4AuTzT/wFkhQ/BjPP6yt2F92T9A/NuUK73IR0T9t5/up8dLRP/p+arx0k9I/M+GX+nlT0z8XDoRkARPUP1PQ7SWN0dQ/HhZqTfOO1T9cOBCSBUzWPyveyDzyB9c/FytqMA3D1z/oMF9egH3YP7yWkA96Ntk/O8eA7PXu2T8Rje4gdqbaP+qymNh8XNs/bqMBvAUS3D8u4jsx68XcPwzIXu/+eN0/ezGUE+0q3j+zDHGsi9veP3trYKsEi98/za/mAMEc4D/eWbvtQnPgP5rOTgZHyeA/dOrKZ3ke4T80v5oDBHPhP7vVc9L7xuE/Qxzr4jYa4j+wG7YtymziP1g5tMh2vuI/j6omiLoP4z8csRafAmDjP3L5D+m3r+M/A2A8g4b+4z9bCHJQwkzkPwtGJXUCmuQ/vLN224Xm5D+KyLCKNzLlP5T7HYoCfeU/ZXCUvDrH5T+NeohGdxDmPw0a+ie4WOY/jukJSzyg5j8Q6bevA+fmPwb1LXO6LOc/U5YhjnVx5z+E8GjjiLXnP0bOwp52+Oc/7WRwlLw66D/rkJvhBnzoP1zJjo1AvOg/JJf/kH776D9E+u3rwDnpP2WNeohGd+k/T5KumXyz6T87x4Ds9e7pP7d/ZaVJKeo/bVZ9rrZi6j+0sKcd/prqP/s6cM6I0uo/DTfg88MI6z91yM1wAz7rPzXvOEVHcus/vodLjjul6z8r2bERiNfrP2OcvwmFCOw/R1oqb0c47D9Iv30dOGfsP9un4zEDlew/NgLxun7B7D+TjJyFPe3sP/N2hNOCF+0/xm00gLdA7T/Ughd9BWntP6sJou4DkO0/2SWqtwa27T/Qs1n1udrtP1jFG5lH/u0/VOOlm8Qg7j/8+4wLB0LuPxghPNo4Yu4/Gy/dJAaB7j875Ga4AZ/uP135LM+Du+4/16NwPQrX7j9wJTs2AvHuPwrXo3A9Cu8/p+hILv8h7z/x9EpZhjjvP64NFeP8Te8/GCE82jhi7z8wL8A+OnXvP/Q3oRABh+8/gbIpV3iX7z9JS+XtCKfvP00ychb2tO8/izcyj/zB7z92N091yM3vPyqpE9BE2O8/jBU1mIbh7z+28/3UeOnvP3FV2XdF8O8/9ihcj8L17z8n9zsUBfrvP8zR4/c2/e8/V5V9VwT/7z9WZd8Vwf/vP1eVfVcE/+8/zNHj9zb97z8n9zsUBfrvP/YoXI/C9e8/cVXZd0Xw7z+28/3UeOnvP4wVNZiG4e8/KqkT0ETY7z92N091yM3vP4s3Mo/8we8/TTJyFva07z9JS+XtCKfvP4GyKVd4l+8/9DehEAGH7z8wL8A+OnXvPxghPNo4Yu8/rg0V4/xN7z/x9EpZhjjvP6foSC7/Ie8/CtejcD0K7z9wJTs2AvHuP9ejcD0K1+4/Xfksz4O77j875Ga4AZ/uPxsv3SQGge4/GCE82jhi7j/8+4wLB0LuP1TjpZvEIO4/WMUbmUf+7T/Qs1n1udrtP9klqrcGtu0/qwmi7gOQ7T/Ughd9BWntP8ZtNIC3QO0/83aE04IX7T+TjJyFPe3sPzYC8bp+wew/26fjMQOV7D9Iv30dOGfsP0daKm9HOOw/Y5y/CYUI7D8r2bERiNfrP76HS447pes/Ne84RUdy6z91yM1wAz7rPw034PPDCOs/+zpwzojS6j+0sKcd/prqP21Wfa62Yuo/t39lpUkp6j87x4Ds9e7pP0+Srpl8s+k/ZY16iEZ36T9E+u3rwDnpPySX/5B+++g/XMmOjUC86D/rkJvhBnzoP+1kcJS8Oug/Rs7Cnnb45z+E8GjjiLXnP1OWIY51cec/BvUtc7os5z8Q6bevA+fmP47pCUs8oOY/DRr6J7hY5j+NeohGdxDmP2VwlLw6x+U/lPsdigJ95T+KyLCKNzLlP7yzdtuF5uQ/C0YldQKa5D9bCHJQwkzkPwNgPIOG/uM/cvkP6bev4z8csRafAmDjP4+qJoi6D+M/WDm0yHa+4j+wG7YtymziP0Mc6+I2GuI/u9Vz0vvG4T80v5oDBHPhP3Tqymd5HuE/ms5OBkfJ4D/eWbvtQnPgP82v5gDBHOA/e2tgqwSL3z+zDHGsi9veP3sxlBPtKt4/DMhe7/543T8u4jsx68XcP26jAbwFEtw/6rKY2Hxc2z8Rje4gdqbaPzvHgOz17tk/vJaQD3o22T/oMF9egH3YPxcrajANw9c/K97IPPIH1z9cOBCSBUzWPx4Wak3zjtU/U9DtJY3R1D8XDoRkARPUPzPhl/p5U9M/+n5qvHST0j9t5/up8dLRPzblCu9yEdE/rK3YX3ZP0D/wFkhQ/BjPP4nS3uALk80/0LhwICQLzD/gEKrU7IHKP9UhN8MN+Mg/lKRrJt9sxz834PPDCOHFP034pX7eVMQ/nl4pyxDHwj9iodY07zjBP2cPtAJDVr8/S+oENBE2vD+aBkXzABa5P6DDfHkB9rU/ngq45/nTsj+k5NU5BmSvP/zHQnQIHKk/+FW5UPnXoj+fckwW9x+ZP59yTBb3H4k/AAAAAAAAAACfckwW9x+Jv59yTBb3H5m/+FW5UPnXor/8x0J0CBypv6Tk1TkGZK+/ngq45/nTsr+gw3x5Afa1v5oGRfMAFrm/S+oENBE2vL9nD7QCQ1a/v2Kh1jTvOMG/nl4pyxDHwr9N+KV+3lTEvzfg88MI4cW/lKRrJt9sx7/VITfDDfjIv+AQqtTsgcq/0LhwICQLzL+J0t7gC5PNv/AWSFD8GM+/rK3YX3ZP0L825QrvchHRv23n+6nx0tG/+n5qvHST0r8z4Zf6eVPTvxcOhGQBE9S/U9DtJY3R1L8eFmpN847Vv1w4EJIFTNa/K97IPPIH178XK2owDcPXv+gwX16Afdi/vJaQD3o22b87x4Ds9e7ZvxGN7iB2ptq/6rKY2Hxc279uowG8BRLcvy7iOzHrxdy/DMhe7/543b97MZQT7Srev7MMcayL296/e2tgqwSL37/Nr+YAwRzgv95Zu+1Cc+C/ms5OBkfJ4L906spneR7hvzS/mgMEc+G/u9Vz0vvG4b9DHOviNhriv7Abti3KbOK/WDm0yHa+4r+PqiaIug/jvxyxFp8CYOO/cvkP6bev478DYDyDhv7jv1sIclDCTOS/C0YldQKa5L+8s3bbhebkv4rIsIo3MuW/lPsdigJ95b9lcJS8Osflv416iEZ3EOa/DRr6J7hY5r+O6QlLPKDmvxDpt68D5+a/BvUtc7os579TliGOdXHnv4TwaOOItee/Rs7Cnnb457/tZHCUvDrov+uQm+EGfOi/XMmOjUC86L8kl/+Qfvvov0T67evAOem/ZY16iEZ36b9Pkq6ZfLPpvzvHgOz17um/t39lpUkp6r9tVn2utmLqv7Swpx3+muq/+zpwzojS6r8NN+Dzwwjrv3XIzXADPuu/Ne84RUdy67++h0uOO6XrvyvZsRGI1+u/Y5y/CYUI7L9HWipvRzjsv0i/fR04Z+y/26fjMQOV7L82AvG6fsHsv5OMnIU97ey/83aE04IX7b/GbTSAt0Dtv9SCF30Fae2/qwmi7gOQ7b/ZJaq3Brbtv9CzWfW52u2/WMUbmUf+7b9U46WbxCDuv/z7jAsHQu6/GCE82jhi7r8bL90kBoHuvzvkZrgBn+6/Xfksz4O77r/Xo3A9Ctfuv3AlOzYC8e6/CtejcD0K77+n6Egu/yHvv/H0SlmGOO+/rg0V4/xN778YITzaOGLvvzAvwD46de+/9DehEAGH77+BsilXeJfvv0lL5e0Ip++/TTJyFva077+LNzKP/MHvv3Y3T3XIze+/KqkT0ETY77+MFTWYhuHvv7bz/dR46e+/cVXZd0Xw77/2KFyPwvXvvyf3OxQF+u+/zNHj9zb9779XlX1XBP/vv1Zl3xXB/++/V5V9VwT/77/M0eP3Nv3vvyf3OxQF+u+/9ihcj8L1779xVdl3RfDvv7bz/dR46e+/jBU1mIbh778qqRPQRNjvv3Y3T3XIze+/izcyj/zB779NMnIW9rTvv0lL5e0Ip++/gbIpV3iX77/0N6EQAYfvvzAvwD46de+/GCE82jhi77+uDRXj/E3vv/H0SlmGOO+/p+hILv8h778K16NwPQrvv3AlOzYC8e6/16NwPQrX7r9d+SzPg7vuvzvkZrgBn+6/Gy/dJAaB7r8YITzaOGLuv/z7jAsHQu6/VOOlm8Qg7r9YxRuZR/7tv9CzWfW52u2/2SWqtwa27b+rCaLuA5Dtv9SCF30Fae2/xm00gLdA7b/zdoTTghftv5OMnIU97ey/NgLxun7B7L/bp+MxA5Xsv0i/fR04Z+y/R1oqb0c47L9jnL8JhQjsvyvZsRGI1+u/vodLjjul67817zhFR3Lrv3XIzXADPuu/DTfg88MI67/7OnDOiNLqv7Swpx3+muq/bVZ9rrZi6r+3f2WlSSnqvzvHgOz17um/T5KumXyz6b9ljXqIRnfpv0T67evAOem/JJf/kH776L9cyY6NQLzov+uQm+EGfOi/7WRwlLw66L9GzsKedvjnv4TwaOOItee/U5YhjnVx578G9S1zuiznvxDpt68D5+a/jukJSzyg5r8NGvonuFjmv416iEZ3EOa/ZXCUvDrH5b+U+x2KAn3lv4rIsIo3MuW/vLN224Xm5L8LRiV1Aprkv1sIclDCTOS/A2A8g4b+479y+Q/pt6/jvxyxFp8CYOO/j6omiLoP479YObTIdr7iv7Abti3KbOK/Qxzr4jYa4r+71XPS+8bhvzS/mgMEc+G/dOrKZ3ke4b+azk4GR8ngv95Zu+1Cc+C/za/mAMEc4L97a2CrBIvfv7MMcayL296/ezGUE+0q3r8MyF7v/njdvy7iOzHrxdy/bqMBvAUS3L/qspjYfFzbvxGN7iB2ptq/O8eA7PXu2b+8lpAPejbZv+gwX16Afdi/FytqMA3D178r3sg88gfXv1w4EJIFTNa/HhZqTfOO1b9T0O0ljdHUvxcOhGQBE9S/M+GX+nlT07/6fmq8dJPSv23n+6nx0tG/NuUK73IR0b+srdhfdk/Qv/AWSFD8GM+/idLe4AuTzb/QuHAgJAvMv+AQqtTsgcq/1SE3ww34yL+UpGsm32zHvzfg88MI4cW/Tfilft5UxL+eXinLEMfCv2Kh1jTvOMG/Zw+0AkNWv79L6gQ0ETa8v5oGRfMAFrm/oMN8eQH2tb+eCrjn+dOyv6Tk1TkGZK+//MdCdAgcqb/4VblQ+deiv59yTBb3H5m/n3JMFvcfib8AAAAAAAAAAJ9yTBb3H4k/RNycSgYA4L9E3JxKBgDgvwvuBzwwAOC/mRHeHoQA4L/AXmHB/QDgv+er5GN3AeC/AvOQKR8C4L/7P4f58gLgv0najT7mA+C/gIC1atcE4L8G8YEd/wXgv1RzucFQB+C/smZkkLsI4L8QWg9fJgrgv+v/HObLC+C/jbeVXpsN4L/7A+W2fQ/gv5c48kBkEeC/mSuDaoMT4L95JF6ezhXgv/fJUYAoGOC/0T/BxYoa4L/MlxdgHx3gvwDGM2joH+C/eNDsurci4L95k9+ikyXgv25Q+62dKOC/ycuaWOAr4L8kRzoDIy/gv2JLj6Z6MuC/UG1wIvo14L+OWfYksDngv8xFfCdmPeC/GqN1VDVB4L8ZHvtZLEXgvyOHiJtTSeC/LPAV3XpN4L90stR6v1Hgv1aeQNgpVuC/K4TVWMJa4L/UgaynVl/gv+jAcoQMZOC/wxGkUuxo4L8gmKPH723gv1A25QrvcuC/MPKyJhZ44L/AywwbZX3gv6bydoTTguC/Rz1EozuI4L/cgTrl0Y3gvwvw3eaNk+C/Ss/0EmOZ4L9G0m70MZ/gv2O3zyozpeC/A9L+B1ir4L9vgQTFj7Hgv65ITFDDt+C/JeZZSSu+4L8fuTXptsTgv7k4KjdRy+C/O8Q/bOnR4L+ySX7Er9jgv/DgJw6g3+C/W2CPiZTm4L8KvJNPj+3gv2k1JO6x9OC/prT+lgD84L/jM9k/TwPhv5J3DmWoCuG/rfwyGCMS4b+7e4Duyxnhv50SEJNwIeG/B2LZzCEp4b/c8pGU9DDhv4+JlGbzOOG/umddo+VA4b/IztvY7Ejhv0J3SZwVUeG/P1WFBmJZ4b+zeofboWHhvzgR/dr6aeG//ACkNnFy4b8rMjogCXvhv6TC2EKQg+G/XKyowTSM4b9S76mc9pThv3CX/brTneG/2J5ZEqCm4b+V88Xei6/hv3mthO6SuOG/QfD49q7B4b9TknU4usrhv+hpwCDp0+G/pKZdTDPd4b/Sp1X0h+bhv3jwEwfQ7+G/oG6gwDv54b/ZXaCkwALiv1YpPdNLDOK/YjB/hcwV4r/ChNGsbB/iv0s+dhcoKeK/0/caguMy4r8A4UOJljziv4MXfQVpRuK/Fr8prFRQ4r9lijkIOlriv55haksdZOK/0LUvoBdu4r9BYyZRL3jivxNkBFQ4guK/+1jBb0OM4r/H1jOEY5biv9Gt1/SgoOK/+PvFbMmq4r9NMnIW9rTiv4Tx07g3v+K/zSGphZLJ4r8F4Qoo1NPiv5dw6C0e3uK/95ScE3vo4r85Qgby7PLivz6WPnRB/eK/y6Kwi6IH478NUBpqFBLjvwaeew+XHOO/k6rtJvgm47/WV1cFajHjv7ix2ZHqO+O/C9C2mnVG478KoYMu4VDjv6geaXBbW+O/+zxGeeZl479PWyOCcXDjv3sUrkfheuO/XW4w1GGF47+wjA3d7I/jv+22C811muO/7IfYYOGk47+g+Zy7Xa/jv90jm6vmueO/kpVfBmPE479Mio9PyM7jv6Yr2EY82eO/Wp2cobjj479Zbmk1JO7jv4uqX+l8+OO/F7fRAN4C5L8WiJ6USQ3kvwTo9/2bF+S/Ups4ud8h5L/lKha/KSzkv+l+TkF+NuS/mIV2TrNA5L+/02TG20rkvxMKEXAIVeS/wxA5fT1f5L/Z7bPKTGnkv5T6srRTc+S/fO9v0F595L972AsFbIfkv8qjG2FRkeS/v56vWS6b5L/ggQGED6XkvwJlU67wruS/GFqdnKG45L8YWwhyUMLkvy9QUmABzOS/GF3eHK7V5L/fh4OEKN/kv5C+SdOg6OS/QfUPIhny5L+WW1oNifvkv+HTnLzIBOW//mMhOgQO5b8EAMeePRflv2vvU1VoIOW/9diWAWcp5b865jxjXzLlv1ILJZNTO+W/h6dXyjJE5b8LJv4o6kzlvzXUKCSZVeW/Gqa21EFe5b/XEvJBz2blvxJKXwg5b+W/3LxxUph35b8zaykg7X/lvzbM0HgiiOW/zOuIQzaQ5b/xRuaRP5jlv6Xd6GM+oOW/kWKARBOo5b8/jubIyq/lv3v18dB3t+W/GLDkKha/5b/BcK5hhsblv1nABG7dzeW/UmNCzCXV5b+rWWd8X9zlv8x5xr5k4+W/8xyR71Lq5b97E0NyMvHlv01p/S0B+OW/ogxVMZX+5b/9MhgjEgXmv8+goX+CC+a/1XlU/N8R5r8axAd2/Bfmv3uFBfcDHua/PZrqyfwj5r8zGvm84inmvzojSnuDL+a/dJfEWRE15r/idmhYjDrmv1XZd0XwP+a/CK2HLxNF5r/X9+EgIUrmv8O5hhkaT+a/Wi4bnfNT5r+K5CuBlFjmv5M16iEaXea/uf3yyYph5r9ckC3L12Xmv7BYw0Xuaea/3LsGfelt5r/3rdaJy3Hmv0yOO6WDdea/lYCYhAt55r+gGcQHdnzmv4NNnUfFf+a/XJNuS+SC5r9A3xYs1YXmv/zFbMmqiOa/Y1+y8WCL5r97LlOT4I3mv+PfZ1w4kOa/Iywq4nSS5r/KTj+oi5Tmv/W+8bVnlua/hQX3Ax6Y5r/v5qkOuZnmv9WSjnIwm+a/5LuUumSc5r9xr8xbdZ3mv79J06Bonua/t5bJcDyf5r9+kGXBxJ/mv8FUM2spoOa/3bOu0XKg5r+kxRnDnKDmv92zrtFyoOa/wVQzaymg5r9QqKePwJ/mv3O6LCY2n+a/TYV4JF6e5r+NJhdjYJ3mv49uhEVFnOa/yqSGNgCb5r8XZMvydZnmv50Rpb3Bl+a/znFuE+6V5r8K2A5G7JPmv5yjjo6rkea/JIEGmzqP5r9WEW4yqozmv2a/7nTniea/+boM/+mG5r+ZvAFmvoPmv4igavRqgOa/VaLsLeV85r+m8QuvJHnmvzAvwD46dea/81oJ3SVx5r8i4BCq1GzmvzCDMSJRaOa/jQjGwaVj5r/Jq3MMyF7mv3Ko34WtWea/+MJkqmBU5r/lszwP7k7mv7HCLR9JSea/pU5AE2FD5r+N7ErLSD3mv91gqMMKN+a/ONvcmJ4w5r8zGvm84inmv2dHqu/8Iua/AkuuYvEb5r+/SGjLuRTmv9gubTgsDea/KgMHtHQF5r/irfNvl/3lv+s6VFOS9eW/C9Ri8DDt5b97T+W0p+Tlvzqt26D22+W/HQWIghnT5b+ILT2a6snlv/9byY6NwOW/r3jqkQa35b9rm+JxUa3lvwtfX+tSo+W/XFg33h2Z5b/9M4P4wI7lv2U5CaUvhOW/I6RuZ1955b9kXHFxVG7lv94CCYofY+W/8uocA7JX5b+KIM7DCUzlv9KL2v0qQOW/Dwnf+xs05b/nx19a1Cflv0HUfQBSG+W/kfKTap8O5b+RRgVOtgHlv/7zNGCQ9OS/G9e/6zPn5L9yqN+FrdnkvzXTvU7qy+S/N2+cFOa95L8XKZSFr6/kvzHRIAVPoeS/5Lop5bWS5L+TOZZ31YPkvx/WG7XCdOS/5WA2AYZl5L+g/UgRGVbkv+RqZFdaRuS/M95Wem025L+8P96rVibkv2ebG9MTFuS/V+vE5XgF5L+AKQMHtPTjv8xh9x3D4+O/OpShKqbS478Er5Y7M8Hjv/DDQUKUr+O//tKiPsmd478Z6NoX0IvjvwCquHGLeeO/xomvdhRn47+uY1xxcVTjv4tPATCeQeO/esTouYUu478abyu9Nhvjv/IHA8+9B+O/ksoUcxD04r+f5uRFJuDiv0ZEMXkDzOK/D5wzorS34r+JKZFEL6Piv5z4akdxjuK/ePF+3H554r9I/Io1XGTiv8k88gcDT+K/5L7VOnE54r8hO29jsyPivw/tYwW/DeK/mODUB5L34b/n/X+cMOHhv4f9nlinyuG/qUpbXOOz4b9P5bSn5Jzhv+qRBre1heG/1SDM7V5u4b+fzarP1Vbhv3kDzHwHP+G/jSeCOA8n4b/aOc0C7Q7hv0pGzsKe9uC/nfNTHAfe4L8qj26ERcXgvwYN/RNcrOC/M23/ykqT4L8Whsjp63ngv0mBBTBlYOC/41KVtrhG4L+2ErpL4izgv4RnQpPEEuC/FVW/0vnw37/wh5//Hrzfvz6XqUnwht+/N3Fyv0NR379HV+nuOhvfv/cBSG3i5N6/R3GOOjqu3r/MY83IIHfevwySPq2iP96/R1UTRN0H3r/IDFTGv8/dvwQAx549l92/Kxcq/1pe3b8f2zLgLCXdvyqr6Xqi69y/TYdOz7ux3L8PKJtyhXfcv+nUlc/yPNy/CHb8FwgC3L+Z84x9ycbbv/cdw2M/i9u/bVSnA1lP278of/eOGhPbv1WGcTeI1tq/qgoNxLKZ2r9FgxQ8hVzav8kfDDz3Htq/GmmpvB3h2b/CFyZTBaPZvwmLijidZNm/DDohdNAl2b/dlV0wuObYvzE/NzRlp9i/rmUyHM9n2L9eDybFxyfYv2Qe+YOB59e/7nppigCn17/NPLmmQGbXvw5qv7UTJde/pPyk2qfj1r++3CdHAaLWv1sKSPsfYNa/tHOaBdod1r9jQswlVdvVv5Zem42VmNW/S8gHPZtV1b9zDp4JTRLVv8TRVbq7ztS/l+Kqsu+K1L8cKVsk7UbUv20csRafAtS/uqRquwm+07/kSj0LQnnTv2VW73A7NNO/aK8+Hvru0r+Uha+vdanSv3GRe7q6Y9K/0erkDMUd0r+0keumlNfRv3VWC+wxkdG/jYAKR5BK0b9U4GQbuAPRv811GmmpvNC/f/lkxXB10L+G4o43+S3Qv34CKEaWzM+/Bkzg1t08z78AcsKE0azOv1wDWyVYHM6/vi8uVWmLzb/uCKcFL/rMv5C+SdOgaMy/SYCaWrbWy79kraHUXkTLv/K20muzscq/pz0l58Qeyr8qcR3jiovJv7M/UG7b98i/ZYuk3ehjyL8/VBoxs8/Hv0GasWg6O8e/ABx79lymxr+MSuoENBHGv/aWcr7Ye8W/5DCYv0LmxL+OBvAWSFDEvxb6YBkbusO/ITtvY7Mjw7+wyRr1EI3Cv2fV52or9sG/Rl7WxAJfwb9e1VktsMfAv1Vq9kArMMC/nplgONcwv7+Y+Q5+4gC+v7vW3qeq0Ly/5E7pYP2fu781RBX+DG+6v5dL9EO2Pbm/xv94ChQMuL/DYKNRJtq2v+FE9Gvrp7W/f/lkxXB1tL9Crnn6rUKzv4Uzrm6rD7K/SwaAKm7csL+Ujs3pDVKvv+kE2VfD6qy/UwoVdxeDqr+HP3kOGxuov+Px/onbsqW/EM6njlVKo7+vhnqwe+Ggv2auwhzz8Jy/idi7mpcemL/Uf9b8+EuTv3RgOUIG8oy/FW6/ncBLg79ikh1dnUpzv9GE8p51TMQ+sBIcLNZPcz88rj4FXU6DP4Mv8eyX9Iw/W2cy0kFNkz9hGRu62R+YP0zjF15J8pw/IiEl0SbioD98blee9kqjP6flrPR/s6U/ooYl1MIbqD8X/sLhu4OqPwVMhR1r66w/AC99+a5Srz+B1leyvtywPxJXhFH/D7I/z9FP3QFDsz+1yTxNwXW0P2vrTEY6qLU/UIR5NHratj9UI0/tZwy4P3lFS3kIPrk/w2fr4GBvuj9xcr9DUaC7P5JZvcPt0Lw/Jh3lYDYBvj8rvTYbKzG/Pxx8YTJVMMA/JefEHtrHwD8NcEG2LF/BPy7nUlxV9sE/d9uF5jqNwj+NfF7x1CPDP90LzApFusM/VRhbCHJQxD9QcodNZObEP72o3a8CfMU/U1xV9l0Rxj9sXWqEfqbGPwisHFpkO8c/q5UJv9TPxz/RzJNrCmTIP3pRu18F+Mg/8YKI1LSLyT8TfxR15h7KP134wfnUsco/0O6QYoBEyz8QkgVM4NbLP/z/OGHCaMw/WkqWk1D6zD+FQZlGk4vNPyMVxhaCHM4/bLOxEvOszj9xjc9k/zzPP0QUkzfAzM8/amtEMA4u0D9ighq+hXXQP7D+z2G+vNA/OGkaFM0D0T9wCcA/pUrRPyv3ArNCkdE/lxqhn6nX0T+Hi9zT1R3SPycyc4HLY9I/Siandoap0j8eUDblCu/SP0jfpGlQNNM/mus00lJ50z9vRWKCGr7TPyO9qN2vAtQ/0clS6/1G1D9Ng6J5AIvUP3pyTYHMztQ/Ka+V0F0S1T8Baf8DrFXVP0z/klSmmNU/GePD7GXb1T9qFJLM6h3WP+PCgZAsYNY/dH0fDhKi1j9anZyhuOPWP8QKt3wkJdc/g92wbVFm1z+kG2FREafXPxq/8EqS59c/FLAdjNgn2D9kBirj32fYP+ffLvt1p9g/kzZV98jm2D+V8loJ3SXZP78rgv+tZNk/eLgdGhaj2T/QCaGDLuHZP1HYRdEDH9o/zTtO0ZFc2j8zw0ZZv5naP94+q8yU1to/sDcxJCcT2z/2DOGYZU/bP4DW/PhLi9s/IazGEtbG2z+QLjatFALcP3GNz2T/PNw/mODUB5J33D/VP4hkyLHcP7JjIxCv69w/p5NsdTkl3T+zz2OUZ17dP424ADRKl90/I93PKcjP3T+iJY+n5QfeP5RKeEKvP94/VBwHXi133j+iQQqeQq7eP4C6gQLv5N4/oidlUkMb3z+/KaxUUFHfP5lnJa34ht8/eUDZlCu83z+dDflnBvHfP8hD393KEuA/4/p3feYs4D8QO1PovEbgP3dpw2FpYOA/RG6GG/B54D9hVb38TpPgPzT1ukVgrOA/V3cstknF4D/L2xFOC97gP3cujPSi9uA/CCKLNPEO4T+7D0BqEyfhP6fria4LP+E/tcGJ6NdW4T8DCYofY27hPxh6xOi5heE/fc1y2eic4T/XMhmO57PhP53xfXGpyuE//vFetTLh4T+u1LMglPfhPybhQh7BDeI/OC9OfLUj4j8Rp5NsdTniP+Aw0SAFT+I/deRIZ2Bk4j+O5V31gHniP7PsSWBzjuI/nx1wXTGj4j8lkBK7trfiP1w4EJIFzOI/ttrDXijg4j+pvvOLEvTiPwn84ee/B+M/MGMK1jgb4z+RuMfShy7jP4tPATCeQeM/xVc7inNU4z/Gia92FGfjPxeel4qNeeM/L9y5MNKL4z8Vx4FXy53jP/DDQUKUr+M/GqN1VDXB4z86lKEqptLjP8xh9x3D4+M/gCkDB7T04z9u36P+egXkP36P+usVFuQ/0zO9xFgm5D9K0jWTbzbkP+RqZFdaRuQ/oP1IERlW5D/lYDYBhmXkPx/WG7XCdOQ/kzmWd9WD5D/kuinltZLkPzHRIAVPoeQ/FymUha+v5D83b5wU5r3kPzXTvU7qy+Q/cqjfha3Z5D8b17/rM+fkP/7zNGCQ9OQ/kUYFTrYB5T+R8pNqnw7lP0HUfQBSG+U/58dfWtQn5T8PCd/7GzTlP9KL2v0qQOU/iiDOwwlM5T/y6hwDslflP94CCYofY+U/ZFxxcVRu5T8jpG5nX3nlP2U5CaUvhOU//TOD+MCO5T9cWDfeHZnlPwtfX+tSo+U/a5vicVGt5T+veOqRBrflP/9byY6NwOU/iC09murJ5T8dBYiCGdPlPzqt26D22+U/e0/ltKfk5T8L1GLwMO3lP+s6VFOS9eU/4q3zb5f95T8qAwe0dAXmP9gubTgsDeY/v0hoy7kU5j8CS65i8RvmP2dHqu/8IuY/Mxr5vOIp5j8429yYnjDmP91gqMMKN+Y/jexKy0g95j+lTkATYUPmP8i2DDhLSeY/5bM8D+5O5j/4wmSqYFTmP3Ko34WtWeY/yatzDMhe5j+NCMbBpWPmPzCDMSJRaOY/OdTvwtZs5j/zWgndJXHmPzAvwD46deY/pvELryR55j9Vouwt5XzmP5+USQ1tgOY/mbwBZr6D5j/5ugz/6YbmP2a/7nTnieY/VhFuMqqM5j8kgQabOo/mP5yjjo6rkeY/CtgORuyT5j/OcW4T7pXmP50Rpb3Bl+Y/F2TL8nWZ5j/hmGVPApvmP49uhEVFnOY/pBr2e2Kd5j9NhXgkXp7mP4quCz84n+Y/Z5yGqMKf5j/BVDNrKaDmP92zrtFyoOY/pMUZw5yg5j/ds67RcqDmP8FUM2spoOY/fpBlwcSf5j/OiqiJPp/mP9U9srlqnuY/ca/MW3Wd5j/7r3PTZpzmP+yGbYsym+Y/7+apDrmZ5j+c+dUcIJjmPwuz0M5pluY/4UIewY2U5j8jLCridJLmP+PfZ1w4kOY/kiIyrOKN5j96U5EKY4vmPxO6S+KsiOY/QN8WLNWF5j9ck25L5ILmP4NNnUfFf+Y/tw2jIHh85j+VgJiEC3nmP2KCGr6FdeY/DqK1os1x5j/cuwZ96W3mP8dMol7waeY/XJAty9dl5j/Q8dHijGHmP6opyTocXeY/odgKmpZY5j9wIvq19VPmP8O5hhkaT+Y/1/fhICFK5j8foWZIFUXmP1XZd0XwP+Y/+WpHcY465j+Li6NyEzXmP1AXKZSFL+Y/Mxr5vOIp5j9Ujsni/iPmP5J55A8GHuY/GsQHdvwX5j/sbTMV4hHmP8+goX+CC+Y/Eyf3OxQF5j+iDFUxlf7lP2Rd3EYD+OU/exNDcjLx5T/zHJHvUurlP+Ntpddm4+U/wk1GlWHc5T9pVyHlJ9XlP1nABG7dzeU/2GSNeojG5T8vpMNDGL/lP5Lp0Ol5t+U/VoLF4cyv5T+oVl9dFajlP6Xd6GM+oOU/CDvFqkGY5T/j32dcOJDlP03Ar5EkiOU/Sl8IOe9/5T/cvHFSmHflPxJKXwg5b+U/7gbRWtFm5T8xmpXtQ17lP0vIBz2bVeU/IhrdQexM5T+dmzbjNETlP2n/A6xVO+U/UdobfGEy5T8MzXUaaSnlP4LjMm5qIOU/G/Sltz8X5T8VWABTBg7lP+HTnLzIBOU/lltaDYn75D9B9Q8iGfLkP6eyKOyi6OQ/34eDhCjf5D8vUb01sNXkPy9QUmABzOQ/L0/nilLC5D8vTny1o7jkPxlZMsfyruQ/4IEBhA+l5D/Vko5yMJvkP8qjG2FRkeQ/kszqHW6H5D9872/QXn3kP6rukc1Vc+Q/7+GS405p5D/DEDl9PV/kPyr+74gKVeQ/1sdD391K5D+veVVntUDkP+l+TkF+NuQ/+x711yss5D9pjxfS4SHkPxrc1haeF+Q/FoielEkN5D8Xt9EA3gLkP4uqX+l8+OM/WW5pNSTu4z9anZyhuOPjP6Yr2EY82eM/Y35uaMrO4z+piT4fZcTjP90jm6vmueM/t+171F+v4z8DfLd546TjP+22C811muM/x4Ds9e6P4z9dbjDUYYXjP5IIjWDjeuM/Zk8Cm3Nw4z/7PEZ55mXjP74SSIldW+M/CqGDLuFQ4z8L0LaadUbjP86luKrsO+M/1ldXBWox4z+qnsw/+ibjPwaeew+XHOM/DVAaahQS4z/LorCLogfjPz6WPnRB/eI/OUIG8uzy4j8NiXssfejiP65kx0Yg3uI/G9XpQNbT4j/NIamFksniP5vlstE5v+I/YyZRL/i04j8P8KSFy6riP9Gt1/SgoOI/3soSnWWW4j8STaCIRYziPypY42w6guI/WFcFajF44j/QtS+gF27iP55haksdZOI/fH4YITxa4j8tswjFVlDiP4MXfQVpRuI/F9Uiopg84j/q6/ma5TLiP2EyVTAqKeI/2XiwxW4f4j9iMH+FzBXiP20dHOxNDOI/8FF/vcIC4j+gbqDAO/nhP4/k8h/S7+E/6Zs0DYrm4T+kpl1MM93hP/9dnznr0+E/aoZUUbzK4T9B8Pj2rsHhP5ChYweVuOE/lfPF3ouv4T/YnlkSoKbhP3CX/brTneE/Uu+pnPaU4T9crKjBNIzhP6TC2EKQg+E/KzI6IAl74T/8AKQ2cXLhPzgR/dr6aeE/s3qH26Fh4T8/VYUGYlnhP0J3SZwVUeE/38K68e5I4T/RWzy850DhP4+JlGbzOOE/3PKRlPQw4T8HYtnMISnhP50SEJNwIeE/0m9fB84Z4T+t/DIYIxLhP5J3DmWoCuE/4zPZP08D4T+mtP6WAPzgP2k1JO6x9OA/CryTT4/t4D9bYI+JlObgP/DgJw6g3+A/skl+xK/Y4D87xD9s6dHgP7k4KjdRy+A/Nq0UArnE4D8l5llJK77gP65ITFDDt+A/b4EExY+x4D8D0v4HWKvgP2O3zyozpeA/RtJu9DGf4D9Kz/QSY5ngPwvw3eaNk+A/3IE65dGN4D9HPUSjO4jgP6bydoTTguA/wMsMG2V94D9H5pE/GHjgP1A25QrvcuA/IJijx+9t4D/DEaRS7GjgP+jAcoQMZOA/1IGsp1Zf4D8rhNVYwlrgP1aeQNgpVuA/dLLUer9R4D8s8BXdek3gPyOHiJtTSeA/GR77WSxF4D8ao3VUNUHgP8xFfCdmPeA/jln2JLA54D9QbXAi+jXgP2JLj6Z6MuA/JEc6AyMv4D/Jy5pY4CvgP25Q+62dKOA/eZPfopMl4D9i3A2itSLgPwDGM2joH+A/zJcXYB8d4D/RP8HFihrgP/fJUYAoGOA/eSRens4V4D+ZK4NqgxPgP5c48kBkEeA/+wPltn0P4D+Nt5Vemw3gP+v/HObLC+A/EFoPXyYK4D+yZmSQuwjgP1RzucFQB+A/BvGBHf8F4D+AgLVq1wTgP0najT7mA+A/+z+H+fIC4D8C85ApHwLgP+er5GN3AeA/wF5hwf0A4D+ZEd4ehADgPwvuBzwwAOA/RNycSgYA4D9E3JxKBgDgPwBBqOECC5EIb7ckB+xSIUDWNsXjoloiQAh2/BcIciNAmpmZmZmZJEDaccPvptMlQEdy+Q/pHydAAAAAAACAKEAcQL/v3/QpQAAAAAAAgCtAqU4Hsp4iLUAAi/z6Id4uQGpOXmQCWjBAb7ckB+xSMUDWNsXjoloyQAh2/BcIcjNAQkC+hAqaNEA6evzeptM1QOhpwCDpHzdAAAAAAACAOEC9N4YA4PQ5QAAAAAAAgDtASkbOwp4iPUAAi/z6Id4+QJrS+lsCWkBAnzvB/utSQUDWNsXjolpCQNjxXyAIckNAcsRafAqaREA6evzeptNFQOhpwCDpH0dAAAAAAACASEC9N4YA4PRJQAAAAAAAgEtASkbOwp4iTUDRBmADIt5OQIKQLGACWlBAnzvB/utSUUDueJPfolpSQNjxXyAIclNAWoKMgAqaVEA6evzeptNVQOhpwCDpH1dAdVq3Qe1/WEC9N4YA4PRZQAAAAAAAgFtAYYicvp4iXUDpSC7/Id5eQIKQLGACWmBAkxraAOxSYUDueJPfolpiQNjxXyAIcmNAWoKMgAqaZEA6evzeptNlQOhpwCDpH2dAgXueP+1/aEC9N4YA4PRpQAAAAAAAgGtAVWe1wJ4ibUDpSC7/Id5uQIKQLGACWnBAGavN/+tScUDueJPfolpyQNjxXyAIcnNA4BKAfwqadEC06QjgptN1QG76sx/pH3dAgXueP+1/eEC9N4YA4PR5QAAAAAAAgHtA2/eov54ifUBjuDoAIt5+QIKQLGACWoBAGavN/+tSgUCrsBngolqCQBu62R8IcoNAnUoGgAqahEC06QjgptOFQCsyOiDpH4dAPrMkQO1/iEAAAAAA4PSJQAAAAAAAgItAmC8vwJ4ijUBjuDoAIt6OQKN06V8CWpBA+MYQAOxSkUCrsBngolqSQPrVHCAIcpNAnUoGgAqalEC06QjgptOVQEwW9x/pH5dAX5fhP+1/mEAAAAAA4PSZQAAAAAAAgJtAuhPsv54inUCEnPf/Id6eQJMCC2ACWqBA+MYQAOxSoUC8IvjfolqiQApI+x8IcqNAnUoGgAqapEC06QjgptOlQEwW9x/pH6dATiUDQO1/qEAAAAAA4PSpQAAAAAAAgKtAhetRuJ4irUCEnPf/Id6uQJs7+l8CWrBAAAAAAOxSsUC8IvjfolqyQApI+x8IcrNAnUoGgAqatEC8IvjfptO1QETdByDpH7dATiUDQO1/uEAAAAAA4PS5QAAAAAAAgLtAstr8v54ivUCEnPf/Id6+QBefAmACWsBAAAAAAOxSwUA4hgDgolrCQIarAyAIcsNAIef9fwqaxEA4hgDgptPFQMh5/x/pH8dATiUDQO1/yEAAAAAA4PTJQE9nZ1N2b3JiaXMAAAAAAAAFAEHE6QILAlkCAEHc6QILCloCAABbAgAAgLsAQfTpAgsBAgBBg+oCCwX//////wBB+OsCCwKsuwBBsOwCCwEFAEG87AILAl8CAEHU7AILDloCAABgAgAA2LsAAAAEAEHs7AILAQEAQfvsAgsFCv////8AQcDtAgsJMLYAAAAAAAAJAEHU7QILAlkCAEHo7QILEmECAAAAAAAAWwIAAOi/AAAABABBlO4CCwT/////APOgCARuYW1lAeqgCKkKABZfZW1iaW5kX3JlZ2lzdGVyX2NsYXNzASJfZW1iaW5kX3JlZ2lzdGVyX2NsYXNzX2NvbnN0cnVjdG9yAiVfZW1iaW5kX3JlZ2lzdGVyX2NsYXNzX2NsYXNzX2Z1bmN0aW9uAx9fZW1iaW5kX3JlZ2lzdGVyX2NsYXNzX3Byb3BlcnR5BB9fZW1iaW5kX3JlZ2lzdGVyX2NsYXNzX2Z1bmN0aW9uBRVfZW1iaW5kX3JlZ2lzdGVyX2VudW0GG19lbWJpbmRfcmVnaXN0ZXJfZW51bV92YWx1ZQcaX2VtYmluZF9yZWdpc3Rlcl9zbWFydF9wdHIIGF9fY3hhX2FsbG9jYXRlX2V4Y2VwdGlvbgkLX19jeGFfdGhyb3cKEV9lbXZhbF90YWtlX3ZhbHVlCw1fZW12YWxfaW5jcmVmDA1fZW12YWxfZGVjcmVmDQtfZW12YWxfY2FsbA4Fcm91bmQPBGV4aXQQDV9fYXNzZXJ0X2ZhaWwRBl9fbG9jaxIIX191bmxvY2sTD19fd2FzaV9mZF9jbG9zZRQKX19zeXNjYWxsNRUMX19zeXNjYWxsMjIxFgtfX3N5c2NhbGw1NBcOX193YXNpX2ZkX3JlYWQYD19fd2FzaV9mZF93cml0ZRkYX193YXNpX2Vudmlyb25fc2l6ZXNfZ2V0GhJfX3dhc2lfZW52aXJvbl9nZXQbCl9fbWFwX2ZpbGUcC19fc3lzY2FsbDkxHQpzdHJmdGltZV9sHgVhYm9ydB8VX2VtYmluZF9yZWdpc3Rlcl92b2lkIBVfZW1iaW5kX3JlZ2lzdGVyX2Jvb2whG19lbWJpbmRfcmVnaXN0ZXJfc3RkX3N0cmluZyIcX2VtYmluZF9yZWdpc3Rlcl9zdGRfd3N0cmluZyMWX2VtYmluZF9yZWdpc3Rlcl9lbXZhbCQYX2VtYmluZF9yZWdpc3Rlcl9pbnRlZ2VyJRZfZW1iaW5kX3JlZ2lzdGVyX2Zsb2F0JhxfZW1iaW5kX3JlZ2lzdGVyX21lbW9yeV92aWV3JxZlbXNjcmlwdGVuX3Jlc2l6ZV9oZWFwKBVlbXNjcmlwdGVuX21lbWNweV9iaWcpC3NldFRlbXBSZXQwKhpsZWdhbGltcG9ydCRfX3dhc2lfZmRfc2VlaysRX193YXNtX2NhbGxfY3RvcnMsUEVtc2NyaXB0ZW5CaW5kaW5nSW5pdGlhbGl6ZXJfbXlfbW9kdWxlOjpFbXNjcmlwdGVuQmluZGluZ0luaXRpYWxpemVyX215X21vZHVsZSgpLZUBZW1zY3JpcHRlbjo6Y2xhc3NfPHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiwgZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok5vQmFzZUNsYXNzPiBlbXNjcmlwdGVuOjpyZWdpc3Rlcl92ZWN0b3I8aW50PihjaGFyIGNvbnN0KikungFlbXNjcmlwdGVuOjpjbGFzc188c3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+LCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Tm9CYXNlQ2xhc3M+IGVtc2NyaXB0ZW46OnJlZ2lzdGVyX3ZlY3Rvcjxkb3VibGU+KGNoYXIgY29uc3QqKS+YAWVtc2NyaXB0ZW46OmNsYXNzXzxzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiwgZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok5vQmFzZUNsYXNzPiBlbXNjcmlwdGVuOjpyZWdpc3Rlcl92ZWN0b3I8Y2hhcj4oY2hhciBjb25zdCopMLMBZW1zY3JpcHRlbjo6Y2xhc3NfPHN0ZDo6X18yOjp2ZWN0b3I8dW5zaWduZWQgY2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjx1bnNpZ25lZCBjaGFyPiA+LCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Tm9CYXNlQ2xhc3M+IGVtc2NyaXB0ZW46OnJlZ2lzdGVyX3ZlY3Rvcjx1bnNpZ25lZCBjaGFyPihjaGFyIGNvbnN0KikxmwFlbXNjcmlwdGVuOjpjbGFzc188c3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiwgZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok5vQmFzZUNsYXNzPiBlbXNjcmlwdGVuOjpyZWdpc3Rlcl92ZWN0b3I8ZmxvYXQ+KGNoYXIgY29uc3QqKTJKdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8dmVjdG9yVG9vbHM+KHZlY3RvclRvb2xzKikzRHZvaWQgZW1zY3JpcHRlbjo6aW50ZXJuYWw6OnJhd19kZXN0cnVjdG9yPHZlY3RvclRvb2xzPih2ZWN0b3JUb29scyopNEdlbXNjcmlwdGVuOjppbnRlcm5hbDo6SW52b2tlcjx2ZWN0b3JUb29scyo+OjppbnZva2UodmVjdG9yVG9vbHMqICgqKSgpKTU+dmVjdG9yVG9vbHMqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8dmVjdG9yVG9vbHM+KCk24AFlbXNjcmlwdGVuOjppbnRlcm5hbDo6SW52b2tlcjx2b2lkLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mPjo6aW52b2tlKHZvaWQgKCopKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYpLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4qKTdUdmVjdG9yVG9vbHM6OmNsZWFyVmVjdG9yRGJsKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYpOEx2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpU2V0dGluZ3M+KG1heGlTZXR0aW5ncyopOWJlbXNjcmlwdGVuOjppbnRlcm5hbDo6SW52b2tlcjx2b2lkLCBpbnQsIGludCwgaW50Pjo6aW52b2tlKHZvaWQgKCopKGludCwgaW50LCBpbnQpLCBpbnQsIGludCwgaW50KToibWF4aVNldHRpbmdzOjpzZXR1cChpbnQsIGludCwgaW50KTsjbWF4aVNldHRpbmdzOjpnZXRTYW1wbGVSYXRlKCkgY29uc3Q8IG1heGlTZXR0aW5nczo6c2V0U2FtcGxlUmF0ZShpbnQpPZMBaW50IGVtc2NyaXB0ZW46OmludGVybmFsOjpHZXR0ZXJQb2xpY3k8aW50IChtYXhpU2V0dGluZ3M6OiopKCkgY29uc3Q+OjpnZXQ8bWF4aVNldHRpbmdzPihpbnQgKG1heGlTZXR0aW5nczo6KiBjb25zdCYpKCkgY29uc3QsIG1heGlTZXR0aW5ncyBjb25zdCYpPo8Bdm9pZCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6U2V0dGVyUG9saWN5PHZvaWQgKG1heGlTZXR0aW5nczo6KikoaW50KT46OnNldDxtYXhpU2V0dGluZ3M+KHZvaWQgKG1heGlTZXR0aW5nczo6KiBjb25zdCYpKGludCksIG1heGlTZXR0aW5ncyYsIGludCk/JG1heGlTZXR0aW5nczo6Z2V0TnVtQ2hhbm5lbHMoKSBjb25zdEAhbWF4aVNldHRpbmdzOjpzZXROdW1DaGFubmVscyhpbnQpQSNtYXhpU2V0dGluZ3M6OmdldEJ1ZmZlclNpemUoKSBjb25zdEIgbWF4aVNldHRpbmdzOjpzZXRCdWZmZXJTaXplKGludClDQnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlPc2M+KG1heGlPc2MqKUQ2bWF4aU9zYyogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpT3NjPigpRZgBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpT3NjOjoqKShkb3VibGUpLCBkb3VibGUsIG1heGlPc2MqLCBkb3VibGU+OjppbnZva2UoZG91YmxlIChtYXhpT3NjOjoqIGNvbnN0JikoZG91YmxlKSwgbWF4aU9zYyosIGRvdWJsZSlG2AFlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlPc2M6OiopKGRvdWJsZSwgZG91YmxlLCBkb3VibGUpLCBkb3VibGUsIG1heGlPc2MqLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlPjo6aW52b2tlKGRvdWJsZSAobWF4aU9zYzo6KiBjb25zdCYpKGRvdWJsZSwgZG91YmxlLCBkb3VibGUpLCBtYXhpT3NjKiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSlHuAFlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlPc2M6OiopKGRvdWJsZSwgZG91YmxlKSwgZG91YmxlLCBtYXhpT3NjKiwgZG91YmxlLCBkb3VibGU+OjppbnZva2UoZG91YmxlIChtYXhpT3NjOjoqIGNvbnN0JikoZG91YmxlLCBkb3VibGUpLCBtYXhpT3NjKiwgZG91YmxlLCBkb3VibGUpSHxlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlPc2M6OiopKCksIGRvdWJsZSwgbWF4aU9zYyo+OjppbnZva2UoZG91YmxlIChtYXhpT3NjOjoqIGNvbnN0JikoKSwgbWF4aU9zYyopSZIBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAobWF4aU9zYzo6KikoZG91YmxlKSwgdm9pZCwgbWF4aU9zYyosIGRvdWJsZT46Omludm9rZSh2b2lkIChtYXhpT3NjOjoqIGNvbnN0JikoZG91YmxlKSwgbWF4aU9zYyosIGRvdWJsZSlKTHZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlFbnZlbG9wZT4obWF4aUVudmVsb3BlKilLQG1heGlFbnZlbG9wZSogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpRW52ZWxvcGU+KClMhANlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlFbnZlbG9wZTo6KikoaW50LCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mKSwgZG91YmxlLCBtYXhpRW52ZWxvcGUqLCBpbnQsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiY+OjppbnZva2UoZG91YmxlIChtYXhpRW52ZWxvcGU6OiogY29uc3QmKShpbnQsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYpLCBtYXhpRW52ZWxvcGUqLCBpbnQsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiopTboBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAobWF4aUVudmVsb3BlOjoqKShpbnQsIGRvdWJsZSksIHZvaWQsIG1heGlFbnZlbG9wZSosIGludCwgZG91YmxlPjo6aW52b2tlKHZvaWQgKG1heGlFbnZlbG9wZTo6KiBjb25zdCYpKGludCwgZG91YmxlKSwgbWF4aUVudmVsb3BlKiwgaW50LCBkb3VibGUpTiJtYXhpRW52ZWxvcGU6OmdldEFtcGxpdHVkZSgpIGNvbnN0TyJtYXhpRW52ZWxvcGU6OnNldEFtcGxpdHVkZShkb3VibGUpUCFtYXhpRW52ZWxvcGU6OmdldFZhbGluZGV4KCkgY29uc3RRHm1heGlFbnZlbG9wZTo6c2V0VmFsaW5kZXgoaW50KVJOdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aURlbGF5bGluZT4obWF4aURlbGF5bGluZSopU0JtYXhpRGVsYXlsaW5lKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlEZWxheWxpbmU+KClU5AFlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlEZWxheWxpbmU6OiopKGRvdWJsZSwgaW50LCBkb3VibGUpLCBkb3VibGUsIG1heGlEZWxheWxpbmUqLCBkb3VibGUsIGludCwgZG91YmxlPjo6aW52b2tlKGRvdWJsZSAobWF4aURlbGF5bGluZTo6KiBjb25zdCYpKGRvdWJsZSwgaW50LCBkb3VibGUpLCBtYXhpRGVsYXlsaW5lKiwgZG91YmxlLCBpbnQsIGRvdWJsZSlV+AFlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlEZWxheWxpbmU6OiopKGRvdWJsZSwgaW50LCBkb3VibGUsIGludCksIGRvdWJsZSwgbWF4aURlbGF5bGluZSosIGRvdWJsZSwgaW50LCBkb3VibGUsIGludD46Omludm9rZShkb3VibGUgKG1heGlEZWxheWxpbmU6OiogY29uc3QmKShkb3VibGUsIGludCwgZG91YmxlLCBpbnQpLCBtYXhpRGVsYXlsaW5lKiwgZG91YmxlLCBpbnQsIGRvdWJsZSwgaW50KVZIdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aUZpbHRlcj4obWF4aUZpbHRlciopVzxtYXhpRmlsdGVyKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlGaWx0ZXI+KClYHW1heGlGaWx0ZXI6OmdldEN1dG9mZigpIGNvbnN0WR1tYXhpRmlsdGVyOjpzZXRDdXRvZmYoZG91YmxlKVogbWF4aUZpbHRlcjo6Z2V0UmVzb25hbmNlKCkgY29uc3RbIG1heGlGaWx0ZXI6OnNldFJlc29uYW5jZShkb3VibGUpXEJ2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpTWl4PihtYXhpTWl4KildNm1heGlNaXgqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aU1peD4oKV6WA2Vtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKG1heGlNaXg6OiopKGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgZG91YmxlKSwgdm9pZCwgbWF4aU1peCosIGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgZG91YmxlPjo6aW52b2tlKHZvaWQgKG1heGlNaXg6OiogY29uc3QmKShkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGRvdWJsZSksIG1heGlNaXgqLCBkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiosIGRvdWJsZSlftgNlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChtYXhpTWl4OjoqKShkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGRvdWJsZSwgZG91YmxlKSwgdm9pZCwgbWF4aU1peCosIGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgZG91YmxlLCBkb3VibGU+OjppbnZva2Uodm9pZCAobWF4aU1peDo6KiBjb25zdCYpKGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgZG91YmxlLCBkb3VibGUpLCBtYXhpTWl4KiwgZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4qLCBkb3VibGUsIGRvdWJsZSlg1gNlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChtYXhpTWl4OjoqKShkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUpLCB2b2lkLCBtYXhpTWl4KiwgZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlPjo6aW52b2tlKHZvaWQgKG1heGlNaXg6OiogY29uc3QmKShkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUpLCBtYXhpTWl4KiwgZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4qLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKWFEdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aUxpbmU+KG1heGlMaW5lKiliOG1heGlMaW5lKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlMaW5lPigpYxZtYXhpTGluZTo6cGxheShkb3VibGUpZC9tYXhpTGluZTo6cHJlcGFyZShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBib29sKWXuAWVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKG1heGlMaW5lOjoqKShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBib29sKSwgdm9pZCwgbWF4aUxpbmUqLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBib29sPjo6aW52b2tlKHZvaWQgKG1heGlMaW5lOjoqIGNvbnN0JikoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgYm9vbCksIG1heGlMaW5lKiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgYm9vbClmH21heGlMaW5lOjp0cmlnZ2VyRW5hYmxlKGRvdWJsZSlnGm1heGlMaW5lOjppc0xpbmVDb21wbGV0ZSgpaEZ2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpWEZhZGU+KG1heGlYRmFkZSopaYcEZW1zY3JpcHRlbjo6aW50ZXJuYWw6Okludm9rZXI8c3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+LCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBkb3VibGU+OjppbnZva2Uoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+ICgqKShzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBkb3VibGUpLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4qLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4qLCBkb3VibGUpaooBbWF4aVhGYWRlOjp4ZmFkZShzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBkb3VibGUpa4EBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Okludm9rZXI8ZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlPjo6aW52b2tlKGRvdWJsZSAoKikoZG91YmxlLCBkb3VibGUsIGRvdWJsZSksIGRvdWJsZSwgZG91YmxlLCBkb3VibGUpbChtYXhpWEZhZGU6OnhmYWRlKGRvdWJsZSwgZG91YmxlLCBkb3VibGUpbVl2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpTGFnRXhwPGRvdWJsZT4gPihtYXhpTGFnRXhwPGRvdWJsZT4qKW5NbWF4aUxhZ0V4cDxkb3VibGU+KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlMYWdFeHA8ZG91YmxlPiA+KClvKG1heGlMYWdFeHA8ZG91YmxlPjo6aW5pdChkb3VibGUsIGRvdWJsZSlw3gFlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChtYXhpTGFnRXhwPGRvdWJsZT46OiopKGRvdWJsZSwgZG91YmxlKSwgdm9pZCwgbWF4aUxhZ0V4cDxkb3VibGU+KiwgZG91YmxlLCBkb3VibGU+OjppbnZva2Uodm9pZCAobWF4aUxhZ0V4cDxkb3VibGU+OjoqIGNvbnN0JikoZG91YmxlLCBkb3VibGUpLCBtYXhpTGFnRXhwPGRvdWJsZT4qLCBkb3VibGUsIGRvdWJsZSlxJW1heGlMYWdFeHA8ZG91YmxlPjo6YWRkU2FtcGxlKGRvdWJsZSlyIW1heGlMYWdFeHA8ZG91YmxlPjo6dmFsdWUoKSBjb25zdHMkbWF4aUxhZ0V4cDxkb3VibGU+OjpnZXRBbHBoYSgpIGNvbnN0dCRtYXhpTGFnRXhwPGRvdWJsZT46OnNldEFscGhhKGRvdWJsZSl1Lm1heGlMYWdFeHA8ZG91YmxlPjo6Z2V0QWxwaGFSZWNpcHJvY2FsKCkgY29uc3R2Lm1heGlMYWdFeHA8ZG91YmxlPjo6c2V0QWxwaGFSZWNpcHJvY2FsKGRvdWJsZSl3Im1heGlMYWdFeHA8ZG91YmxlPjo6c2V0VmFsKGRvdWJsZSl4SHZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlTYW1wbGU+KG1heGlTYW1wbGUqKXlCdm9pZCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6cmF3X2Rlc3RydWN0b3I8bWF4aVNhbXBsZT4obWF4aVNhbXBsZSopejxtYXhpU2FtcGxlKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlTYW1wbGU+KCl7HW1heGlTYW1wbGU6OmdldExlbmd0aCgpIGNvbnN0fPYCZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAobWF4aVNhbXBsZTo6Kikoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgaW50KSwgdm9pZCwgbWF4aVNhbXBsZSosIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGludD46Omludm9rZSh2b2lkIChtYXhpU2FtcGxlOjoqIGNvbnN0Jikoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgaW50KSwgbWF4aVNhbXBsZSosIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiosIGludCl9qwNlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxpbnQgKG1heGlTYW1wbGU6OiopKHN0ZDo6X18yOjp2ZWN0b3I8dW5zaWduZWQgY2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjx1bnNpZ25lZCBjaGFyPiA+JiwgaW50KSwgaW50LCBtYXhpU2FtcGxlKiwgc3RkOjpfXzI6OnZlY3Rvcjx1bnNpZ25lZCBjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHVuc2lnbmVkIGNoYXI+ID4mLCBpbnQ+OjppbnZva2UoaW50IChtYXhpU2FtcGxlOjoqIGNvbnN0Jikoc3RkOjpfXzI6OnZlY3Rvcjx1bnNpZ25lZCBjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHVuc2lnbmVkIGNoYXI+ID4mLCBpbnQpLCBtYXhpU2FtcGxlKiwgc3RkOjpfXzI6OnZlY3Rvcjx1bnNpZ25lZCBjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHVuc2lnbmVkIGNoYXI+ID4qLCBpbnQpfoIBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAobWF4aVNhbXBsZTo6KikoKSwgdm9pZCwgbWF4aVNhbXBsZSo+OjppbnZva2Uodm9pZCAobWF4aVNhbXBsZTo6KiBjb25zdCYpKCksIG1heGlTYW1wbGUqKX8TbWF4aVNhbXBsZTo6Y2xlYXIoKYAB5gFlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChtYXhpU2FtcGxlOjoqKShmbG9hdCwgZmxvYXQsIGJvb2wsIGJvb2wpLCB2b2lkLCBtYXhpU2FtcGxlKiwgZmxvYXQsIGZsb2F0LCBib29sLCBib29sPjo6aW52b2tlKHZvaWQgKG1heGlTYW1wbGU6OiogY29uc3QmKShmbG9hdCwgZmxvYXQsIGJvb2wsIGJvb2wpLCBtYXhpU2FtcGxlKiwgZmxvYXQsIGZsb2F0LCBib29sLCBib29sKYEBowRlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxib29sIChtYXhpU2FtcGxlOjoqKShzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+LCBpbnQpLCBib29sLCBtYXhpU2FtcGxlKiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiwgaW50Pjo6aW52b2tlKGJvb2wgKG1heGlTYW1wbGU6OiogY29uc3QmKShzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+LCBpbnQpLCBtYXhpU2FtcGxlKiwgZW1zY3JpcHRlbjo6aW50ZXJuYWw6OkJpbmRpbmdUeXBlPHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4sIHZvaWQ+OjondW5uYW1lZCcqLCBpbnQpggFCdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aUR5bj4obWF4aUR5biopgwE2bWF4aUR5biogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpRHluPigphAGQAmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aUR5bjo6KikoZG91YmxlLCBkb3VibGUsIGxvbmcsIGRvdWJsZSwgZG91YmxlKSwgZG91YmxlLCBtYXhpRHluKiwgZG91YmxlLCBkb3VibGUsIGxvbmcsIGRvdWJsZSwgZG91YmxlPjo6aW52b2tlKGRvdWJsZSAobWF4aUR5bjo6KiBjb25zdCYpKGRvdWJsZSwgZG91YmxlLCBsb25nLCBkb3VibGUsIGRvdWJsZSksIG1heGlEeW4qLCBkb3VibGUsIGRvdWJsZSwgbG9uZywgZG91YmxlLCBkb3VibGUphQGYAmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aUR5bjo6KikoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUpLCBkb3VibGUsIG1heGlEeW4qLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZT46Omludm9rZShkb3VibGUgKG1heGlEeW46OiogY29uc3QmKShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSksIG1heGlEeW4qLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSmGAUJ2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpRW52PihtYXhpRW52KimHATZtYXhpRW52KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlFbnY+KCmIAYQCZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpRW52OjoqKShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBsb25nLCBpbnQpLCBkb3VibGUsIG1heGlFbnYqLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBsb25nLCBpbnQ+OjppbnZva2UoZG91YmxlIChtYXhpRW52OjoqIGNvbnN0JikoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgbG9uZywgaW50KSwgbWF4aUVudiosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGxvbmcsIGludCmJAcQCZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpRW52OjoqKShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgbG9uZywgaW50KSwgZG91YmxlLCBtYXhpRW52KiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGxvbmcsIGludD46Omludm9rZShkb3VibGUgKG1heGlFbnY6OiogY29uc3QmKShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgbG9uZywgaW50KSwgbWF4aUVudiosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBsb25nLCBpbnQpigGsAWVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aUVudjo6KikoZG91YmxlLCBpbnQpLCBkb3VibGUsIG1heGlFbnYqLCBkb3VibGUsIGludD46Omludm9rZShkb3VibGUgKG1heGlFbnY6OiogY29uc3QmKShkb3VibGUsIGludCksIG1heGlFbnYqLCBkb3VibGUsIGludCmLARttYXhpRW52OjpnZXRUcmlnZ2VyKCkgY29uc3SMARhtYXhpRW52OjpzZXRUcmlnZ2VyKGludCmNAUJ2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxjb252ZXJ0Pihjb252ZXJ0KimOAWJlbXNjcmlwdGVuOjppbnRlcm5hbDo6RnVuY3Rpb25JbnZva2VyPGRvdWJsZSAoKikoaW50KSwgZG91YmxlLCBpbnQ+OjppbnZva2UoZG91YmxlICgqKikoaW50KSwgaW50KY8BSGVtc2NyaXB0ZW46OmludGVybmFsOjpJbnZva2VyPGRvdWJsZSwgaW50Pjo6aW52b2tlKGRvdWJsZSAoKikoaW50KSwgaW50KZABGmNvbnZlcnQ6Om1zVG9TYW1wcyhkb3VibGUpkQFuZW1zY3JpcHRlbjo6aW50ZXJuYWw6OkZ1bmN0aW9uSW52b2tlcjxkb3VibGUgKCopKGRvdWJsZSksIGRvdWJsZSwgZG91YmxlPjo6aW52b2tlKGRvdWJsZSAoKiopKGRvdWJsZSksIGRvdWJsZSmSAVFlbXNjcmlwdGVuOjppbnRlcm5hbDo6SW52b2tlcjxkb3VibGUsIGRvdWJsZT46Omludm9rZShkb3VibGUgKCopKGRvdWJsZSksIGRvdWJsZSmTAVZ2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpU2FtcGxlQW5kSG9sZD4obWF4aVNhbXBsZUFuZEhvbGQqKZQBSm1heGlTYW1wbGVBbmRIb2xkKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlTYW1wbGVBbmRIb2xkPigplQEmbWF4aVNhbXBsZUFuZEhvbGQ6OnNhaChkb3VibGUsIGRvdWJsZSmWAUp2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpRmxhbmdlcj4obWF4aUZsYW5nZXIqKZcBPm1heGlGbGFuZ2VyKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlGbGFuZ2VyPigpmAFBbWF4aUZsYW5nZXI6OmZsYW5nZShkb3VibGUsIHVuc2lnbmVkIGludCwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSmZAcACZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpRmxhbmdlcjo6KikoZG91YmxlLCB1bnNpZ25lZCBpbnQsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUpLCBkb3VibGUsIG1heGlGbGFuZ2VyKiwgZG91YmxlLCB1bnNpZ25lZCBpbnQsIGRvdWJsZSwgZG91YmxlLCBkb3VibGU+OjppbnZva2UoZG91YmxlIChtYXhpRmxhbmdlcjo6KiBjb25zdCYpKGRvdWJsZSwgdW5zaWduZWQgaW50LCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKSwgbWF4aUZsYW5nZXIqLCBkb3VibGUsIHVuc2lnbmVkIGludCwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSmaAUh2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpQ2hvcnVzPihtYXhpQ2hvcnVzKimbATxtYXhpQ2hvcnVzKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlDaG9ydXM+KCmcAUBtYXhpQ2hvcnVzOjpjaG9ydXMoZG91YmxlLCB1bnNpZ25lZCBpbnQsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUpnQFOdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aURDQmxvY2tlcj4obWF4aURDQmxvY2tlciopngFCbWF4aURDQmxvY2tlciogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpRENCbG9ja2VyPigpnwEjbWF4aURDQmxvY2tlcjo6cGxheShkb3VibGUsIGRvdWJsZSmgAUJ2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpU1ZGPihtYXhpU1ZGKimhATZtYXhpU1ZGKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlTVkY+KCmiARptYXhpU1ZGOjpzZXRDdXRvZmYoZG91YmxlKaMBHW1heGlTVkY6OnNldFJlc29uYW5jZShkb3VibGUppAE1bWF4aVNWRjo6cGxheShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSmlAUR2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpTWF0aD4obWF4aU1hdGgqKaYBaWVtc2NyaXB0ZW46OmludGVybmFsOjpJbnZva2VyPGRvdWJsZSwgZG91YmxlLCBkb3VibGU+OjppbnZva2UoZG91YmxlICgqKShkb3VibGUsIGRvdWJsZSksIGRvdWJsZSwgZG91YmxlKacBHW1heGlNYXRoOjphZGQoZG91YmxlLCBkb3VibGUpqAEdbWF4aU1hdGg6OnN1Yihkb3VibGUsIGRvdWJsZSmpAR1tYXhpTWF0aDo6bXVsKGRvdWJsZSwgZG91YmxlKaoBHW1heGlNYXRoOjpkaXYoZG91YmxlLCBkb3VibGUpqwEcbWF4aU1hdGg6Omd0KGRvdWJsZSwgZG91YmxlKawBHG1heGlNYXRoOjpsdChkb3VibGUsIGRvdWJsZSmtAR1tYXhpTWF0aDo6Z3RlKGRvdWJsZSwgZG91YmxlKa4BHW1heGlNYXRoOjpsdGUoZG91YmxlLCBkb3VibGUprwEdbWF4aU1hdGg6Om1vZChkb3VibGUsIGRvdWJsZSmwARVtYXhpTWF0aDo6YWJzKGRvdWJsZSmxAR9tYXhpTWF0aDo6eHBvd3koZG91YmxlLCBkb3VibGUpsgFGdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aUNsb2NrPihtYXhpQ2xvY2sqKbMBOm1heGlDbG9jayogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpQ2xvY2s+KCm0ARltYXhpQ2xvY2s6OmlzVGljaygpIGNvbnN0tQEibWF4aUNsb2NrOjpnZXRDdXJyZW50Q291bnQoKSBjb25zdLYBH21heGlDbG9jazo6c2V0Q3VycmVudENvdW50KGludCm3AR9tYXhpQ2xvY2s6OmdldExhc3RDb3VudCgpIGNvbnN0uAEcbWF4aUNsb2NrOjpzZXRMYXN0Q291bnQoaW50KbkBGW1heGlDbG9jazo6Z2V0QnBzKCkgY29uc3S6ARZtYXhpQ2xvY2s6OnNldEJwcyhpbnQpuwEZbWF4aUNsb2NrOjpnZXRCcG0oKSBjb25zdLwBFm1heGlDbG9jazo6c2V0QnBtKGludCm9ARdtYXhpQ2xvY2s6OnNldFRpY2soaW50Kb4BG21heGlDbG9jazo6Z2V0VGlja3MoKSBjb25zdL8BGG1heGlDbG9jazo6c2V0VGlja3MoaW50KcABYHZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlLdXJhbW90b09zY2lsbGF0b3I+KG1heGlLdXJhbW90b09zY2lsbGF0b3IqKcEBVG1heGlLdXJhbW90b09zY2lsbGF0b3IqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aUt1cmFtb3RvT3NjaWxsYXRvcj4oKcIBZG1heGlLdXJhbW90b09zY2lsbGF0b3I6OnBsYXkoZG91YmxlLCBkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPinDAdYDZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yOjoqKShkb3VibGUsIGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KSwgZG91YmxlLCBtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yKiwgZG91YmxlLCBkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiA+OjppbnZva2UoZG91YmxlIChtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yOjoqIGNvbnN0JikoZG91YmxlLCBkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiksIG1heGlLdXJhbW90b09zY2lsbGF0b3IqLCBkb3VibGUsIGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KinEAWZ2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0PihtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0KinFAWB2b2lkIGVtc2NyaXB0ZW46OmludGVybmFsOjpyYXdfZGVzdHJ1Y3RvcjxtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0PihtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0KinGAZ4BZW1zY3JpcHRlbjo6aW50ZXJuYWw6Okludm9rZXI8bWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldCosIHVuc2lnbmVkIGxvbmcgY29uc3QmJj46Omludm9rZShtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0KiAoKikodW5zaWduZWQgbG9uZyBjb25zdCYmKSwgdW5zaWduZWQgbG9uZynHAYQBbWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0LCB1bnNpZ25lZCBsb25nIGNvbnN0Pih1bnNpZ25lZCBsb25nIGNvbnN0JiYpyAEvbWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldDo6cGxheShkb3VibGUsIGRvdWJsZSnJATptYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0OjpzZXRQaGFzZShkb3VibGUsIHVuc2lnbmVkIGxvbmcpygGWAmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQ6OiopKGRvdWJsZSwgdW5zaWduZWQgbG9uZyksIHZvaWQsIG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQqLCBkb3VibGUsIHVuc2lnbmVkIGxvbmc+OjppbnZva2Uodm9pZCAobWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldDo6KiBjb25zdCYpKGRvdWJsZSwgdW5zaWduZWQgbG9uZyksIG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQqLCBkb3VibGUsIHVuc2lnbmVkIGxvbmcpywFjbWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldDo6c2V0UGhhc2VzKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiBjb25zdCYpzAEybWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldDo6Z2V0UGhhc2UodW5zaWduZWQgbG9uZynNAfwBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0OjoqKSh1bnNpZ25lZCBsb25nKSwgZG91YmxlLCBtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0KiwgdW5zaWduZWQgbG9uZz46Omludm9rZShkb3VibGUgKG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQ6OiogY29uc3QmKSh1bnNpZ25lZCBsb25nKSwgbWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldCosIHVuc2lnbmVkIGxvbmcpzgEhbWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldDo6c2l6ZSgpzwFqdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aUFzeW5jS3VyYW1vdG9Pc2NpbGxhdG9yPihtYXhpQXN5bmNLdXJhbW90b09zY2lsbGF0b3IqKdABrAFtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0KiBlbXNjcmlwdGVuOjpiYXNlPG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQ+Ojpjb252ZXJ0UG9pbnRlcjxtYXhpQXN5bmNLdXJhbW90b09zY2lsbGF0b3IsIG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQ+KG1heGlBc3luY0t1cmFtb3RvT3NjaWxsYXRvciop0QGIAW1heGlBc3luY0t1cmFtb3RvT3NjaWxsYXRvciogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpQXN5bmNLdXJhbW90b09zY2lsbGF0b3IsIHVuc2lnbmVkIGxvbmcgY29uc3Q+KHVuc2lnbmVkIGxvbmcgY29uc3QmJinSATFtYXhpQXN5bmNLdXJhbW90b09zY2lsbGF0b3I6OnBsYXkoZG91YmxlLCBkb3VibGUp0wE8bWF4aUFzeW5jS3VyYW1vdG9Pc2NpbGxhdG9yOjpzZXRQaGFzZShkb3VibGUsIHVuc2lnbmVkIGxvbmcp1AFlbWF4aUFzeW5jS3VyYW1vdG9Pc2NpbGxhdG9yOjpzZXRQaGFzZXMoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+IGNvbnN0JinVAUJ2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpRkZUPihtYXhpRkZUKinWATx2b2lkIGVtc2NyaXB0ZW46OmludGVybmFsOjpyYXdfZGVzdHJ1Y3RvcjxtYXhpRkZUPihtYXhpRkZUKinXATZtYXhpRkZUKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlGRlQ+KCnYAa4BZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAobWF4aUZGVDo6KikoaW50LCBpbnQsIGludCksIHZvaWQsIG1heGlGRlQqLCBpbnQsIGludCwgaW50Pjo6aW52b2tlKHZvaWQgKG1heGlGRlQ6OiogY29uc3QmKShpbnQsIGludCwgaW50KSwgbWF4aUZGVCosIGludCwgaW50LCBpbnQp2QHaAWVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGJvb2wgKG1heGlGRlQ6OiopKGZsb2F0LCBtYXhpRkZUOjpmZnRNb2RlcyksIGJvb2wsIG1heGlGRlQqLCBmbG9hdCwgbWF4aUZGVDo6ZmZ0TW9kZXM+OjppbnZva2UoYm9vbCAobWF4aUZGVDo6KiBjb25zdCYpKGZsb2F0LCBtYXhpRkZUOjpmZnRNb2RlcyksIG1heGlGRlQqLCBmbG9hdCwgbWF4aUZGVDo6ZmZ0TW9kZXMp2gF5ZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZmxvYXQgKG1heGlGRlQ6OiopKCksIGZsb2F0LCBtYXhpRkZUKj46Omludm9rZShmbG9hdCAobWF4aUZGVDo6KiBjb25zdCYpKCksIG1heGlGRlQqKdsBiQJlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+JiAobWF4aUZGVDo6KikoKSwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiYsIG1heGlGRlQqPjo6aW52b2tlKHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mIChtYXhpRkZUOjoqIGNvbnN0JikoKSwgbWF4aUZGVCop3AEabWF4aUZGVDo6Z2V0TWFnbml0dWRlc0RCKCndARRtYXhpRkZUOjpnZXRQaGFzZXMoKd4BFW1heGlGRlQ6OmdldE51bUJpbnMoKd8BFW1heGlGRlQ6OmdldEZGVFNpemUoKeABFW1heGlGRlQ6OmdldEhvcFNpemUoKeEBGG1heGlGRlQ6OmdldFdpbmRvd1NpemUoKeIBRHZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlJRkZUPihtYXhpSUZGVCop4wE+dm9pZCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6cmF3X2Rlc3RydWN0b3I8bWF4aUlGRlQ+KG1heGlJRkZUKinkAThtYXhpSUZGVCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpSUZGVD4oKeUBgQVlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxmbG9hdCAobWF4aUlGRlQ6OiopKHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mLCBzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+JiwgbWF4aUlGRlQ6OmZmdE1vZGVzKSwgZmxvYXQsIG1heGlJRkZUKiwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiYsIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mLCBtYXhpSUZGVDo6ZmZ0TW9kZXM+OjppbnZva2UoZmxvYXQgKG1heGlJRkZUOjoqIGNvbnN0Jikoc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiYsIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mLCBtYXhpSUZGVDo6ZmZ0TW9kZXMpLCBtYXhpSUZGVCosIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4qLCBzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+KiwgbWF4aUlGRlQ6OmZmdE1vZGVzKeYBZXZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPiA+KG1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPiop5wFfdm9pZCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6cmF3X2Rlc3RydWN0b3I8bWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+ID4obWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+KinoAVltYXhpTUZDQ0FuYWx5c2VyPGRvdWJsZT4qIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+ID4oKekBWW1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPjo6c2V0dXAodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgZG91YmxlLCBkb3VibGUp6gGeA2Vtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKG1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPjo6KikodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgZG91YmxlLCBkb3VibGUpLCB2b2lkLCBtYXhpTUZDQ0FuYWx5c2VyPGRvdWJsZT4qLCB1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50LCBkb3VibGUsIGRvdWJsZT46Omludm9rZSh2b2lkIChtYXhpTUZDQ0FuYWx5c2VyPGRvdWJsZT46OiogY29uc3QmKSh1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50LCBkb3VibGUsIGRvdWJsZSksIG1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPiosIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQsIGRvdWJsZSwgZG91YmxlKesBVW1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPjo6bWZjYyhzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+JinsAasEZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8c3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiAobWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+OjoqKShzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+JiksIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIG1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPiosIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mPjo6aW52b2tlKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYgKG1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPjo6KiBjb25zdCYpKHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mKSwgbWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+Kiwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiop7QGVAXZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiA+KHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiop7gGPAXZvaWQgZW1zY3JpcHRlbjo6aW50ZXJuYWw6OnJhd19kZXN0cnVjdG9yPHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiA+KHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiop7wGJAXN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4gPigp8AFHc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+OjpwdXNoX2JhY2soaW50IGNvbnN0JinxAb8CZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAoc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+OjoqKShpbnQgY29uc3QmKSwgdm9pZCwgc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+KiwgaW50IGNvbnN0Jj46Omludm9rZSh2b2lkIChzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID46OiogY29uc3QmKShpbnQgY29uc3QmKSwgc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+KiwgaW50KfIBU3N0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPjo6cmVzaXplKHVuc2lnbmVkIGxvbmcsIGludCBjb25zdCYp8wH7AmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPjo6KikodW5zaWduZWQgbG9uZywgaW50IGNvbnN0JiksIHZvaWQsIHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiosIHVuc2lnbmVkIGxvbmcsIGludCBjb25zdCY+OjppbnZva2Uodm9pZCAoc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+OjoqIGNvbnN0JikodW5zaWduZWQgbG9uZywgaW50IGNvbnN0JiksIHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiosIHVuc2lnbmVkIGxvbmcsIGludCn0AT5zdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID46OnNpemUoKSBjb25zdPUBogFlbXNjcmlwdGVuOjppbnRlcm5hbDo6VmVjdG9yQWNjZXNzPHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiA+OjpnZXQoc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+IGNvbnN0JiwgdW5zaWduZWQgbG9uZyn2AYMDZW1zY3JpcHRlbjo6aW50ZXJuYWw6OkZ1bmN0aW9uSW52b2tlcjxlbXNjcmlwdGVuOjp2YWwgKCopKHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiBjb25zdCYsIHVuc2lnbmVkIGxvbmcpLCBlbXNjcmlwdGVuOjp2YWwsIHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiBjb25zdCYsIHVuc2lnbmVkIGxvbmc+OjppbnZva2UoZW1zY3JpcHRlbjo6dmFsICgqKikoc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+IGNvbnN0JiwgdW5zaWduZWQgbG9uZyksIHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiosIHVuc2lnbmVkIGxvbmcp9wGoAWVtc2NyaXB0ZW46OmludGVybmFsOjpWZWN0b3JBY2Nlc3M8c3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+ID46OnNldChzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4mLCB1bnNpZ25lZCBsb25nLCBpbnQgY29uc3QmKfgB+QJlbXNjcmlwdGVuOjppbnRlcm5hbDo6RnVuY3Rpb25JbnZva2VyPGJvb2wgKCopKHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiYsIHVuc2lnbmVkIGxvbmcsIGludCBjb25zdCYpLCBib29sLCBzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4mLCB1bnNpZ25lZCBsb25nLCBpbnQgY29uc3QmPjo6aW52b2tlKGJvb2wgKCoqKShzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4mLCB1bnNpZ25lZCBsb25nLCBpbnQgY29uc3QmKSwgc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+KiwgdW5zaWduZWQgbG9uZywgaW50KfkBoQF2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4gPihzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4qKfoBUHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPjo6cHVzaF9iYWNrKGRvdWJsZSBjb25zdCYp+wHjAmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPjo6KikoZG91YmxlIGNvbnN0JiksIHZvaWQsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiosIGRvdWJsZSBjb25zdCY+OjppbnZva2Uodm9pZCAoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+OjoqIGNvbnN0JikoZG91YmxlIGNvbnN0JiksIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiosIGRvdWJsZSn8AVxzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID46OnJlc2l6ZSh1bnNpZ25lZCBsb25nLCBkb3VibGUgY29uc3QmKf0BnwNlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID46OiopKHVuc2lnbmVkIGxvbmcsIGRvdWJsZSBjb25zdCYpLCB2b2lkLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4qLCB1bnNpZ25lZCBsb25nLCBkb3VibGUgY29uc3QmPjo6aW52b2tlKHZvaWQgKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPjo6KiBjb25zdCYpKHVuc2lnbmVkIGxvbmcsIGRvdWJsZSBjb25zdCYpLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4qLCB1bnNpZ25lZCBsb25nLCBkb3VibGUp/gFEc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+OjpzaXplKCkgY29uc3T/Aa4BZW1zY3JpcHRlbjo6aW50ZXJuYWw6OlZlY3RvckFjY2VzczxzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4gPjo6Z2V0KHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiBjb25zdCYsIHVuc2lnbmVkIGxvbmcpgAK3AWVtc2NyaXB0ZW46OmludGVybmFsOjpWZWN0b3JBY2Nlc3M8c3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+ID46OnNldChzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCB1bnNpZ25lZCBsb25nLCBkb3VibGUgY29uc3QmKYECnQNlbXNjcmlwdGVuOjppbnRlcm5hbDo6RnVuY3Rpb25JbnZva2VyPGJvb2wgKCopKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIHVuc2lnbmVkIGxvbmcsIGRvdWJsZSBjb25zdCYpLCBib29sLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCB1bnNpZ25lZCBsb25nLCBkb3VibGUgY29uc3QmPjo6aW52b2tlKGJvb2wgKCoqKShzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCB1bnNpZ25lZCBsb25nLCBkb3VibGUgY29uc3QmKSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KiwgdW5zaWduZWQgbG9uZywgZG91YmxlKYICmQF2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiA+KHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+KimDAkpzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6cHVzaF9iYWNrKGNoYXIgY29uc3QmKYQCywJlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6KikoY2hhciBjb25zdCYpLCB2b2lkLCBzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiosIGNoYXIgY29uc3QmPjo6aW52b2tlKHZvaWQgKHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjoqIGNvbnN0JikoY2hhciBjb25zdCYpLCBzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiosIGNoYXIphQJWc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OnJlc2l6ZSh1bnNpZ25lZCBsb25nLCBjaGFyIGNvbnN0JimGAocDZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAoc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OiopKHVuc2lnbmVkIGxvbmcsIGNoYXIgY29uc3QmKSwgdm9pZCwgc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4qLCB1bnNpZ25lZCBsb25nLCBjaGFyIGNvbnN0Jj46Omludm9rZSh2b2lkIChzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6KiBjb25zdCYpKHVuc2lnbmVkIGxvbmcsIGNoYXIgY29uc3QmKSwgc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4qLCB1bnNpZ25lZCBsb25nLCBjaGFyKYcCQHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpzaXplKCkgY29uc3SIAqYBZW1zY3JpcHRlbjo6aW50ZXJuYWw6OlZlY3RvckFjY2VzczxzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiA+OjpnZXQoc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QmLCB1bnNpZ25lZCBsb25nKYkCrQFlbXNjcmlwdGVuOjppbnRlcm5hbDo6VmVjdG9yQWNjZXNzPHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+ID46OnNldChzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiYsIHVuc2lnbmVkIGxvbmcsIGNoYXIgY29uc3QmKYoChQNlbXNjcmlwdGVuOjppbnRlcm5hbDo6RnVuY3Rpb25JbnZva2VyPGJvb2wgKCopKHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+JiwgdW5zaWduZWQgbG9uZywgY2hhciBjb25zdCYpLCBib29sLCBzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiYsIHVuc2lnbmVkIGxvbmcsIGNoYXIgY29uc3QmPjo6aW52b2tlKGJvb2wgKCoqKShzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiYsIHVuc2lnbmVkIGxvbmcsIGNoYXIgY29uc3QmKSwgc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4qLCB1bnNpZ25lZCBsb25nLCBjaGFyKYsCvQF2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxzdGQ6Ol9fMjo6dmVjdG9yPHVuc2lnbmVkIGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8dW5zaWduZWQgY2hhcj4gPiA+KHN0ZDo6X18yOjp2ZWN0b3I8dW5zaWduZWQgY2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjx1bnNpZ25lZCBjaGFyPiA+KimMAsoBZW1zY3JpcHRlbjo6aW50ZXJuYWw6OlZlY3RvckFjY2VzczxzdGQ6Ol9fMjo6dmVjdG9yPHVuc2lnbmVkIGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8dW5zaWduZWQgY2hhcj4gPiA+OjpnZXQoc3RkOjpfXzI6OnZlY3Rvcjx1bnNpZ25lZCBjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHVuc2lnbmVkIGNoYXI+ID4gY29uc3QmLCB1bnNpZ25lZCBsb25nKY0CnQF2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+ID4oc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiopjgLXAmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID46OiopKGZsb2F0IGNvbnN0JiksIHZvaWQsIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4qLCBmbG9hdCBjb25zdCY+OjppbnZva2Uodm9pZCAoc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPjo6KiBjb25zdCYpKGZsb2F0IGNvbnN0JiksIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4qLCBmbG9hdCmPApMDZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAoc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPjo6KikodW5zaWduZWQgbG9uZywgZmxvYXQgY29uc3QmKSwgdm9pZCwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiosIHVuc2lnbmVkIGxvbmcsIGZsb2F0IGNvbnN0Jj46Omludm9rZSh2b2lkIChzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+OjoqIGNvbnN0JikodW5zaWduZWQgbG9uZywgZmxvYXQgY29uc3QmKSwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiosIHVuc2lnbmVkIGxvbmcsIGZsb2F0KZACqgFlbXNjcmlwdGVuOjppbnRlcm5hbDo6VmVjdG9yQWNjZXNzPHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4gPjo6Z2V0KHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4gY29uc3QmLCB1bnNpZ25lZCBsb25nKZECkQNlbXNjcmlwdGVuOjppbnRlcm5hbDo6RnVuY3Rpb25JbnZva2VyPGJvb2wgKCopKHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mLCB1bnNpZ25lZCBsb25nLCBmbG9hdCBjb25zdCYpLCBib29sLCBzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+JiwgdW5zaWduZWQgbG9uZywgZmxvYXQgY29uc3QmPjo6aW52b2tlKGJvb2wgKCoqKShzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+JiwgdW5zaWduZWQgbG9uZywgZmxvYXQgY29uc3QmKSwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiosIHVuc2lnbmVkIGxvbmcsIGZsb2F0KZICXnN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPjo6X19hcHBlbmQodW5zaWduZWQgbG9uZywgZG91YmxlIGNvbnN0JimTAjhtYXhpTUZDQ0FuYWx5c2VyPGRvdWJsZT46OmNhbGNNZWxGaWx0ZXJCYW5rKGRvdWJsZSwgaW50KZQCZkVtc2NyaXB0ZW5CaW5kaW5nSW5pdGlhbGl6ZXJfbXlfbW9kdWxlX21heGlHcmFpbnM6OkVtc2NyaXB0ZW5CaW5kaW5nSW5pdGlhbGl6ZXJfbXlfbW9kdWxlX21heGlHcmFpbnMoKZUCc3ZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPihtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KimWAm12b2lkIGVtc2NyaXB0ZW46OmludGVybmFsOjpyYXdfZGVzdHJ1Y3RvcjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4obWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPioplwKYAWVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6Z2V0KHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiBjb25zdCYpmAJmZW1zY3JpcHRlbjo6c21hcnRfcHRyX3RyYWl0PHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojpjb25zdHJ1Y3RfbnVsbCgpmQKdAWVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6c2hhcmUobWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGVtc2NyaXB0ZW46OmludGVybmFsOjpfRU1fVkFMKimaApsBdm9pZCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6cmF3X2Rlc3RydWN0b3I8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID4oc3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+KimbApwBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Okludm9rZXI8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46Omludm9rZShzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gKCopKCkpnALCAXN0ZDo6X18yOjplbmFibGVfaWY8IShpc19hcnJheTxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID46OnZhbHVlKSwgc3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46OnR5cGUgc3RkOjpfXzI6Om1ha2Vfc2hhcmVkPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPigpnQI3bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6c2V0U2FtcGxlKG1heGlTYW1wbGUqKZ4COG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OmdldE5vcm1hbGlzZWRQb3NpdGlvbigpnwI0bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6c2V0UG9zaXRpb24oZG91YmxlKaACQm1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OnBsYXkoZG91YmxlLCBkb3VibGUsIGludCwgZG91YmxlKaECzAJlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OiopKGRvdWJsZSwgZG91YmxlLCBpbnQsIGRvdWJsZSksIGRvdWJsZSwgbWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGRvdWJsZSwgZG91YmxlLCBpbnQsIGRvdWJsZT46Omludm9rZShkb3VibGUgKG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OiogY29uc3QmKShkb3VibGUsIGRvdWJsZSwgaW50LCBkb3VibGUpLCBtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KiwgZG91YmxlLCBkb3VibGUsIGludCwgZG91YmxlKaICRG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OnBsYXlBdFBvc2l0aW9uKGRvdWJsZSwgZG91YmxlLCBpbnQpowKsAmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6KikoZG91YmxlLCBkb3VibGUsIGludCksIGRvdWJsZSwgbWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGRvdWJsZSwgZG91YmxlLCBpbnQ+OjppbnZva2UoZG91YmxlIChtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+OjoqIGNvbnN0JikoZG91YmxlLCBkb3VibGUsIGludCksIG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qLCBkb3VibGUsIGRvdWJsZSwgaW50KaQCcXZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+KG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPioppQJrdm9pZCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6cmF3X2Rlc3RydWN0b3I8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4obWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+KimmApsBZW1zY3JpcHRlbjo6c21hcnRfcHRyX3RyYWl0PHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+ID46OnNoYXJlKG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiosIGVtc2NyaXB0ZW46OmludGVybmFsOjpfRU1fVkFMKimnAr8Bc3RkOjpfXzI6OmVuYWJsZV9pZjwhKGlzX2FycmF5PG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+Ojp2YWx1ZSksIHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+ID46OnR5cGUgc3RkOjpfXzI6Om1ha2Vfc2hhcmVkPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+KCmoAjZtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj46OnNldFNhbXBsZShtYXhpU2FtcGxlKimpAkFtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj46OnBsYXkoZG91YmxlLCBkb3VibGUsIGludCwgZG91YmxlKaoCa3ZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+KG1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiopqwJfbWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+KCmsAjNtYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OnNldFNhbXBsZShtYXhpU2FtcGxlKimtAjFtYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OnNldExvb3BTdGFydChkb3VibGUprgIvbWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+OjpzZXRMb29wRW5kKGRvdWJsZSmvAiltYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OmdldExvb3BFbmQoKbACRm1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6cGxheShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBpbnQsIGRvdWJsZSmxAtwCZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OiopKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGludCwgZG91YmxlKSwgZG91YmxlLCBtYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBpbnQsIGRvdWJsZT46Omludm9rZShkb3VibGUgKG1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6KiBjb25zdCYpKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGludCwgZG91YmxlKSwgbWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgaW50LCBkb3VibGUpsgJIbWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+OjpwbGF5QXRQb3NpdGlvbihkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBpbnQpswK8AmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+OjoqKShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBpbnQpLCBkb3VibGUsIG1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGludD46Omludm9rZShkb3VibGUgKG1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6KiBjb25zdCYpKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGludCksIG1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGludCm0AnBtYXhpR3JhaW48aGFubldpbkZ1bmN0b3I+OjptYXhpR3JhaW4obWF4aVNhbXBsZSosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIG1heGlHcmFpbldpbmRvd0NhY2hlPGhhbm5XaW5GdW5jdG9yPioptQJiRW1zY3JpcHRlbkJpbmRpbmdJbml0aWFsaXplcl9teV9tb2R1bGVfbWF4aWJpdHM6OkVtc2NyaXB0ZW5CaW5kaW5nSW5pdGlhbGl6ZXJfbXlfbW9kdWxlX21heGliaXRzKCm2AkR2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpQml0cz4obWF4aUJpdHMqKbcCb2Vtc2NyaXB0ZW46OmludGVybmFsOjpJbnZva2VyPHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50Pjo6aW52b2tlKHVuc2lnbmVkIGludCAoKikodW5zaWduZWQgaW50KSwgdW5zaWduZWQgaW50KbgCmQFlbXNjcmlwdGVuOjppbnRlcm5hbDo6SW52b2tlcjx1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50Pjo6aW52b2tlKHVuc2lnbmVkIGludCAoKikodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQpLCB1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCm5AihtYXhpQml0czo6YXQodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQpugIpbWF4aUJpdHM6OnNobCh1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCm7AiltYXhpQml0czo6c2hyKHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KbwCwwFlbXNjcmlwdGVuOjppbnRlcm5hbDo6SW52b2tlcjx1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQ+OjppbnZva2UodW5zaWduZWQgaW50ICgqKSh1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KSwgdW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCm9AjVtYXhpQml0czo6cih1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50Kb4CKm1heGlCaXRzOjpsYW5kKHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50Kb8CKW1heGlCaXRzOjpsb3IodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQpwAIqbWF4aUJpdHM6Omx4b3IodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQpwQIbbWF4aUJpdHM6Om5lZyh1bnNpZ25lZCBpbnQpwgIbbWF4aUJpdHM6OmluYyh1bnNpZ25lZCBpbnQpwwIbbWF4aUJpdHM6OmRlYyh1bnNpZ25lZCBpbnQpxAIpbWF4aUJpdHM6OmFkZCh1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCnFAiltYXhpQml0czo6c3ViKHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KcYCKW1heGlCaXRzOjptdWwodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQpxwIpbWF4aUJpdHM6OmRpdih1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCnIAihtYXhpQml0czo6Z3QodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQpyQIobWF4aUJpdHM6Omx0KHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KcoCKW1heGlCaXRzOjpndGUodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQpywIpbWF4aUJpdHM6Omx0ZSh1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCnMAihtYXhpQml0czo6ZXEodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQpzQIRbWF4aUJpdHM6Om5vaXNlKCnOAiBtYXhpQml0czo6dG9TaWduYWwodW5zaWduZWQgaW50Kc8CJG1heGlCaXRzOjp0b1RyaWdTaWduYWwodW5zaWduZWQgaW50KdACXWVtc2NyaXB0ZW46OmludGVybmFsOjpJbnZva2VyPHVuc2lnbmVkIGludCwgZG91YmxlPjo6aW52b2tlKHVuc2lnbmVkIGludCAoKikoZG91YmxlKSwgZG91YmxlKdECHG1heGlCaXRzOjpmcm9tU2lnbmFsKGRvdWJsZSnSAkp2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpQ291bnRlcj4obWF4aUNvdW50ZXIqKdMCPm1heGlDb3VudGVyKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlDb3VudGVyPigp1AIibWF4aUNvdW50ZXI6OmNvdW50KGRvdWJsZSwgZG91YmxlKdUCRnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlJbmRleD4obWF4aUluZGV4KinWAjptYXhpSW5kZXgqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aUluZGV4Pigp1wJXbWF4aUluZGV4OjpwdWxsKGRvdWJsZSwgZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4p2AJMdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aVJhdGlvU2VxPihtYXhpUmF0aW9TZXEqKdkCQG1heGlSYXRpb1NlcSogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpUmF0aW9TZXE+KCnaAlZtYXhpUmF0aW9TZXE6OnBsYXlUcmlnKGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KdsCjgNlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlSYXRpb1NlcTo6KikoZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4pLCBkb3VibGUsIG1heGlSYXRpb1NlcSosIGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+ID46Omludm9rZShkb3VibGUgKG1heGlSYXRpb1NlcTo6KiBjb25zdCYpKGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KSwgbWF4aVJhdGlvU2VxKiwgZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4qKdwCkAFtYXhpUmF0aW9TZXE6OnBsYXlWYWx1ZXMoZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4sIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPindAu8EZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpUmF0aW9TZXE6OiopKGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+LCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4pLCBkb3VibGUsIG1heGlSYXRpb1NlcSosIGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+LCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4gPjo6aW52b2tlKGRvdWJsZSAobWF4aVJhdGlvU2VxOjoqIGNvbnN0JikoZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4sIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiksIG1heGlSYXRpb1NlcSosIGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+Kiwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KineAk5FbXNjcmlwdGVuQmluZGluZ0luaXRpYWxpemVyX21heGlWZXJiOjpFbXNjcmlwdGVuQmluZGluZ0luaXRpYWxpemVyX21heGlWZXJiKCnfAk52b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpU2F0UmV2ZXJiPihtYXhpU2F0UmV2ZXJiKingAkh2b2lkIGVtc2NyaXB0ZW46OmludGVybmFsOjpyYXdfZGVzdHJ1Y3RvcjxtYXhpU2F0UmV2ZXJiPihtYXhpU2F0UmV2ZXJiKinhAkJtYXhpU2F0UmV2ZXJiKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlTYXRSZXZlcmI+KCniAkx2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpRnJlZVZlcmI+KG1heGlGcmVlVmVyYiop4wJAbWF4aUZyZWVWZXJiKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlGcmVlVmVyYj4oKeQCK3N0ZDo6X18yOjpfX3Rocm93X2xlbmd0aF9lcnJvcihjaGFyIGNvbnN0KinlAmR2b2lkIHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPjo6X19wdXNoX2JhY2tfc2xvd19wYXRoPGludCBjb25zdCY+KGludCBjb25zdCYp5gJVc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+OjpfX2FwcGVuZCh1bnNpZ25lZCBsb25nLCBpbnQgY29uc3QmKecCcHZvaWQgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+OjpfX3B1c2hfYmFja19zbG93X3BhdGg8ZG91YmxlIGNvbnN0Jj4oZG91YmxlIGNvbnN0JinoAlhzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6X19hcHBlbmQodW5zaWduZWQgbG9uZywgY2hhciBjb25zdCYp6QJvc3RkOjpfXzI6OnZlY3RvcjxtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPG1heGlLdXJhbW90b09zY2lsbGF0b3I+ID46Ol9fYXBwZW5kKHVuc2lnbmVkIGxvbmcp6gJPc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+OjpfX2FwcGVuZCh1bnNpZ25lZCBsb25nKesCE21heGlGRlQ6On5tYXhpRkZUKCnsAjNtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+Ojp+bWF4aVRpbWVTdHJldGNoKCntAoAEc3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+OjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4sIGVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6dmFsX2RlbGV0ZXI+KG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qLCBlbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46OnZhbF9kZWxldGVyLCBzdGQ6Ol9fMjo6ZW5hYmxlX2lmPGlzX2NvbnZlcnRpYmxlPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qLCBtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+Kj46OnZhbHVlLCBzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID46Ol9fbmF0Pjo6dHlwZSnuAnplbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46OnZhbF9kZWxldGVyOjpvcGVyYXRvcigpKHZvaWQgY29uc3QqKe8C9AFzdGQ6Ol9fMjo6X19zaGFyZWRfcHRyX3BvaW50ZXI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6dmFsX2RlbGV0ZXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46On5fX3NoYXJlZF9wdHJfcG9pbnRlcigp8AL2AXN0ZDo6X18yOjpfX3NoYXJlZF9wdHJfcG9pbnRlcjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KiwgZW1zY3JpcHRlbjo6c21hcnRfcHRyX3RyYWl0PHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp2YWxfZGVsZXRlciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6fl9fc2hhcmVkX3B0cl9wb2ludGVyKCkuMfEC7wFzdGQ6Ol9fMjo6X19zaGFyZWRfcHRyX3BvaW50ZXI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6dmFsX2RlbGV0ZXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46Ol9fb25femVyb19zaGFyZWQoKfIChwJzdGQ6Ol9fMjo6X19zaGFyZWRfcHRyX3BvaW50ZXI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6dmFsX2RlbGV0ZXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46Ol9fZ2V0X2RlbGV0ZXIoc3RkOjp0eXBlX2luZm8gY29uc3QmKSBjb25zdPMC9AFzdGQ6Ol9fMjo6X19zaGFyZWRfcHRyX3BvaW50ZXI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6dmFsX2RlbGV0ZXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46Ol9fb25femVyb19zaGFyZWRfd2Vhaygp9AKQAXN0ZDo6X18yOjpfX3NoYXJlZF9wdHJfZW1wbGFjZTxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp+X19zaGFyZWRfcHRyX2VtcGxhY2UoKfUCkgFzdGQ6Ol9fMjo6X19zaGFyZWRfcHRyX2VtcGxhY2U8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6fl9fc2hhcmVkX3B0cl9lbXBsYWNlKCkuMfYCiwFzdGQ6Ol9fMjo6X19zaGFyZWRfcHRyX2VtcGxhY2U8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6X19vbl96ZXJvX3NoYXJlZCgp9wIhbWF4aUdyYWluPGhhbm5XaW5GdW5jdG9yPjo6cGxheSgp+AIxbWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+Ojp+bWF4aVBpdGNoU2hpZnQoKfkC+ANzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPjo6c2hhcmVkX3B0cjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4sIGVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp2YWxfZGVsZXRlcj4obWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+KiwgZW1zY3JpcHRlbjo6c21hcnRfcHRyX3RyYWl0PHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+ID46OnZhbF9kZWxldGVyLCBzdGQ6Ol9fMjo6ZW5hYmxlX2lmPGlzX2NvbnZlcnRpYmxlPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiosIG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPio+Ojp2YWx1ZSwgc3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID46Ol9fbmF0Pjo6dHlwZSn6AvEBc3RkOjpfXzI6Ol9fc2hhcmVkX3B0cl9wb2ludGVyPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiosIGVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp2YWxfZGVsZXRlciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp+X19zaGFyZWRfcHRyX3BvaW50ZXIoKfsC8wFzdGQ6Ol9fMjo6X19zaGFyZWRfcHRyX3BvaW50ZXI8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+KiwgZW1zY3JpcHRlbjo6c21hcnRfcHRyX3RyYWl0PHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+ID46OnZhbF9kZWxldGVyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+ID46On5fX3NoYXJlZF9wdHJfcG9pbnRlcigpLjH8AoQCc3RkOjpfXzI6Ol9fc2hhcmVkX3B0cl9wb2ludGVyPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiosIGVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp2YWxfZGVsZXRlciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPiA+OjpfX2dldF9kZWxldGVyKHN0ZDo6dHlwZV9pbmZvIGNvbnN0JikgY29uc3T9Ao4Bc3RkOjpfXzI6Ol9fc2hhcmVkX3B0cl9lbXBsYWNlPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp+X19zaGFyZWRfcHRyX2VtcGxhY2UoKf4CkAFzdGQ6Ol9fMjo6X19zaGFyZWRfcHRyX2VtcGxhY2U8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+ID46On5fX3NoYXJlZF9wdHJfZW1wbGFjZSgpLjH/AokBc3RkOjpfXzI6Ol9fc2hhcmVkX3B0cl9lbXBsYWNlPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPiA+OjpfX29uX3plcm9fc2hhcmVkKCmAAyRfR0xPQkFMX19zdWJfSV9tYXhpbWlsaWFuLmVtYmluZC5jcHCBAxBtYXhpT3NjOjpub2lzZSgpggMZbWF4aU9zYzo6c2luZXdhdmUoZG91YmxlKYMDGW1heGlPc2M6OnNpbmVidWY0KGRvdWJsZSmEAxhtYXhpT3NjOjpzaW5lYnVmKGRvdWJsZSmFAxhtYXhpT3NjOjpjb3N3YXZlKGRvdWJsZSmGAxdtYXhpT3NjOjpwaGFzb3IoZG91YmxlKYcDF21heGlPc2M6OnNxdWFyZShkb3VibGUpiAMebWF4aU9zYzo6cHVsc2UoZG91YmxlLCBkb3VibGUpiQMYbWF4aU9zYzo6aW1wdWxzZShkb3VibGUpigMnbWF4aU9zYzo6cGhhc29yKGRvdWJsZSwgZG91YmxlLCBkb3VibGUpiwMUbWF4aU9zYzo6c2F3KGRvdWJsZSmMAxVtYXhpT3NjOjpzYXduKGRvdWJsZSmNAxltYXhpT3NjOjp0cmlhbmdsZShkb3VibGUpjgNQbWF4aUVudmVsb3BlOjpsaW5lKGludCwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JimPAyJtYXhpRW52ZWxvcGU6OnRyaWdnZXIoaW50LCBkb3VibGUpkAMebWF4aURlbGF5bGluZTo6bWF4aURlbGF5bGluZSgpkQMmbWF4aURlbGF5bGluZTo6ZGwoZG91YmxlLCBpbnQsIGRvdWJsZSmSAyttYXhpRGVsYXlsaW5lOjpkbChkb3VibGUsIGludCwgZG91YmxlLCBpbnQpkwMibWF4aUZpbHRlcjo6bG9wYXNzKGRvdWJsZSwgZG91YmxlKZQDIm1heGlGaWx0ZXI6OmhpcGFzcyhkb3VibGUsIGRvdWJsZSmVAyltYXhpRmlsdGVyOjpsb3Jlcyhkb3VibGUsIGRvdWJsZSwgZG91YmxlKZYDKW1heGlGaWx0ZXI6OmhpcmVzKGRvdWJsZSwgZG91YmxlLCBkb3VibGUplwMsbWF4aUZpbHRlcjo6YmFuZHBhc3MoZG91YmxlLCBkb3VibGUsIGRvdWJsZSmYA1htYXhpTWl4OjpzdGVyZW8oZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBkb3VibGUpmQNebWF4aU1peDo6cXVhZChkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGRvdWJsZSwgZG91YmxlKZoDa21heGlNaXg6OmFtYmlzb25pYyhkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUpmwNsbWF4aVNhbXBsZTo6bG9hZChzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+LCBpbnQpnAMSbWF4aVNhbXBsZTo6cmVhZCgpnQNnc3RkOjpfXzI6OmJhc2ljX2lmc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpiYXNpY19pZnN0cmVhbShjaGFyIGNvbnN0KiwgdW5zaWduZWQgaW50KZ4D3QFzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYgc3RkOjpfXzI6Ol9fcHV0X2NoYXJhY3Rlcl9zZXF1ZW5jZTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPihzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBsb25nKZ8DTXN0ZDo6X18yOjp2ZWN0b3I8c2hvcnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8c2hvcnQ+ID46Ol9fYXBwZW5kKHVuc2lnbmVkIGxvbmcpoANNc3RkOjpfXzI6OmJhc2ljX2ZpbGVidWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19maWxlYnVmKCmhA2xtYXhpU2FtcGxlOjpzZXRTYW1wbGVGcm9tT2dnQmxvYihzdGQ6Ol9fMjo6dmVjdG9yPHVuc2lnbmVkIGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8dW5zaWduZWQgY2hhcj4gPiYsIGludCmiA0xzdGQ6Ol9fMjo6YmFzaWNfZmlsZWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6YmFzaWNfZmlsZWJ1ZigpowNcc3RkOjpfXzI6OmJhc2ljX2ZpbGVidWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46Om9wZW4oY2hhciBjb25zdCosIHVuc2lnbmVkIGludCmkA09zdGQ6Ol9fMjo6YmFzaWNfaWZzdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19pZnN0cmVhbSgppQMVbWF4aVNhbXBsZTo6aXNSZWFkeSgppgNObWF4aVNhbXBsZTo6c2V0U2FtcGxlKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYppwP2AXN0ZDo6X18yOjplbmFibGVfaWY8KF9faXNfZm9yd2FyZF9pdGVyYXRvcjxkb3VibGUqPjo6dmFsdWUpICYmIChpc19jb25zdHJ1Y3RpYmxlPGRvdWJsZSwgc3RkOjpfXzI6Oml0ZXJhdG9yX3RyYWl0czxkb3VibGUqPjo6cmVmZXJlbmNlPjo6dmFsdWUpLCB2b2lkPjo6dHlwZSBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID46OmFzc2lnbjxkb3VibGUqPihkb3VibGUqLCBkb3VibGUqKagDU21heGlTYW1wbGU6OnNldFNhbXBsZShzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBpbnQpqQMVbWF4aVNhbXBsZTo6dHJpZ2dlcigpqgMSbWF4aVNhbXBsZTo6cGxheSgpqwMobWF4aVNhbXBsZTo6cGxheShkb3VibGUsIGRvdWJsZSwgZG91YmxlKawDMW1heGlTYW1wbGU6OnBsYXkoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlJimtAyltYXhpU2FtcGxlOjpwbGF5NChkb3VibGUsIGRvdWJsZSwgZG91YmxlKa4DFm1heGlTYW1wbGU6OnBsYXlPbmNlKCmvAxxtYXhpU2FtcGxlOjpwbGF5T25aWChkb3VibGUpsAMkbWF4aVNhbXBsZTo6cGxheU9uWlgoZG91YmxlLCBkb3VibGUpsQMcbWF4aVNhbXBsZTo6cGxheU9uY2UoZG91YmxlKbIDLG1heGlTYW1wbGU6OnBsYXlPblpYKGRvdWJsZSwgZG91YmxlLCBkb3VibGUpswMqbWF4aVNhbXBsZTo6bG9vcFNldFBvc09uWlgoZG91YmxlLCBkb3VibGUptAMYbWF4aVNhbXBsZTo6cGxheShkb3VibGUptQMdbWF4aVNhbXBsZTo6bm9ybWFsaXNlKGRvdWJsZSm2Ay5tYXhpU2FtcGxlOjphdXRvVHJpbShmbG9hdCwgZmxvYXQsIGJvb2wsIGJvb2wptwMzbWF4aUR5bjo6Z2F0ZShkb3VibGUsIGRvdWJsZSwgbG9uZywgZG91YmxlLCBkb3VibGUpuAM7bWF4aUR5bjo6Y29tcHJlc3Nvcihkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSm5AxltYXhpRHluOjpjb21wcmVzcyhkb3VibGUpugMabWF4aUR5bjo6c2V0QXR0YWNrKGRvdWJsZSm7AxttYXhpRHluOjpzZXRSZWxlYXNlKGRvdWJsZSm8Ax1tYXhpRHluOjpzZXRUaHJlc2hvbGQoZG91YmxlKb0DLm1heGlFbnY6OmFyKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGxvbmcsIGludCm+A0BtYXhpRW52OjphZHNyKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBsb25nLCBpbnQpvwMabWF4aUVudjo6YWRzcihkb3VibGUsIGludCnAAxptYXhpRW52OjpzZXRBdHRhY2soZG91YmxlKcEDG21heGlFbnY6OnNldFN1c3RhaW4oZG91YmxlKcIDGW1heGlFbnY6OnNldERlY2F5KGRvdWJsZSnDAxJjb252ZXJ0OjptdG9mKGludCnEA2B2aXJ0dWFsIHRodW5rIHRvIHN0ZDo6X18yOjpiYXNpY19pZnN0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX2lmc3RyZWFtKCnFA1FzdGQ6Ol9fMjo6YmFzaWNfaWZzdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19pZnN0cmVhbSgpLjHGA2J2aXJ0dWFsIHRodW5rIHRvIHN0ZDo6X18yOjpiYXNpY19pZnN0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX2lmc3RyZWFtKCkuMccDQ3N0ZDo6X18yOjpiYXNpY19maWxlYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpzeW5jKCnIA09zdGQ6Ol9fMjo6YmFzaWNfZmlsZWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX2ZpbGVidWYoKS4xyQNbc3RkOjpfXzI6OmJhc2ljX2ZpbGVidWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OmltYnVlKHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKcoDUHN0ZDo6X18yOjpiYXNpY19maWxlYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpzZXRidWYoY2hhciosIGxvbmcpywN6c3RkOjpfXzI6OmJhc2ljX2ZpbGVidWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnNlZWtvZmYobG9uZyBsb25nLCBzdGQ6Ol9fMjo6aW9zX2Jhc2U6OnNlZWtkaXIsIHVuc2lnbmVkIGludCnMAxxzdGQ6Ol9fMjo6X190aHJvd19iYWRfY2FzdCgpzQNvc3RkOjpfXzI6OmJhc2ljX2ZpbGVidWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnNlZWtwb3Moc3RkOjpfXzI6OmZwb3M8X19tYnN0YXRlX3Q+LCB1bnNpZ25lZCBpbnQpzgNIc3RkOjpfXzI6OmJhc2ljX2ZpbGVidWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnVuZGVyZmxvdygpzwNLc3RkOjpfXzI6OmJhc2ljX2ZpbGVidWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnBiYWNrZmFpbChpbnQp0ANKc3RkOjpfXzI6OmJhc2ljX2ZpbGVidWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46Om92ZXJmbG93KGludCnRA4UCc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gc3RkOjpfXzI6Ol9fcGFkX2FuZF9vdXRwdXQ8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4oc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHN0ZDo6X18yOjppb3NfYmFzZSYsIGNoYXIp0gMbbWF4aUNsb2NrOjpzZXRUZW1wbyhkb3VibGUp0wMTbWF4aUNsb2NrOjp0aWNrZXIoKdQDH21heGlDbG9jazo6c2V0VGlja3NQZXJCZWF0KGludCnVAx1tYXhpRkZUOjpzZXR1cChpbnQsIGludCwgaW50KdYDKm1heGlGRlQ6OnByb2Nlc3MoZmxvYXQsIG1heGlGRlQ6OmZmdE1vZGVzKdcDE21heGlGRlQ6Om1hZ3NUb0RCKCnYAxttYXhpRkZUOjpzcGVjdHJhbEZsYXRuZXNzKCnZAxttYXhpRkZUOjpzcGVjdHJhbENlbnRyb2lkKCnaAx5tYXhpSUZGVDo6c2V0dXAoaW50LCBpbnQsIGludCnbA5MBbWF4aUlGRlQ6OnByb2Nlc3Moc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiYsIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mLCBtYXhpSUZGVDo6ZmZ0TW9kZXMp3AMuRkZUKGludCwgYm9vbCwgZmxvYXQqLCBmbG9hdCosIGZsb2F0KiwgZmxvYXQqKd0DJFJlYWxGRlQoaW50LCBmbG9hdCosIGZsb2F0KiwgZmxvYXQqKd4DIGZmdDo6Z2VuV2luZG93KGludCwgaW50LCBmbG9hdCop3wMPZmZ0OjpzZXR1cChpbnQp4AMLZmZ0Ojp+ZmZ0KCnhAyFmZnQ6OmNhbGNGRlQoaW50LCBmbG9hdCosIGZsb2F0KiniAzdmZnQ6OnBvd2VyU3BlY3RydW0oaW50LCBmbG9hdCosIGZsb2F0KiwgZmxvYXQqLCBmbG9hdCop4wMdZmZ0Ojpjb252VG9EQihmbG9hdCosIGZsb2F0KinkAztmZnQ6OmludmVyc2VGRlRDb21wbGV4KGludCwgZmxvYXQqLCBmbG9hdCosIGZsb2F0KiwgZmxvYXQqKeUDPmZmdDo6aW52ZXJzZVBvd2VyU3BlY3RydW0oaW50LCBmbG9hdCosIGZsb2F0KiwgZmxvYXQqLCBmbG9hdCop5gM3bWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+OjptZWxGaWx0ZXJBbmRMb2dTcXVhcmUoZmxvYXQqKecDJm1heGlSZXZlcmJGaWx0ZXJzOjptYXhpUmV2ZXJiRmlsdGVycygp6AMgbWF4aVJldmVyYkJhc2U6Om1heGlSZXZlcmJCYXNlKCnpAx5tYXhpU2F0UmV2ZXJiOjptYXhpU2F0UmV2ZXJiKCnqAxttYXhpU2F0UmV2ZXJiOjpwbGF5KGRvdWJsZSnrAxxtYXhpRnJlZVZlcmI6Om1heGlGcmVlVmVyYigp7AMqbWF4aUZyZWVWZXJiOjpwbGF5KGRvdWJsZSwgZG91YmxlLCBkb3VibGUp7QMncG9pbnRfY29tcGFyZSh2b2lkIGNvbnN0Kiwgdm9pZCBjb25zdCop7gMadm9yYmlzX2RlaW5pdChzdGJfdm9yYmlzKinvAylpc193aG9sZV9wYWNrZXRfcHJlc2VudChzdGJfdm9yYmlzKiwgaW50KfADM3ZvcmJpc19kZWNvZGVfcGFja2V0KHN0Yl92b3JiaXMqLCBpbnQqLCBpbnQqLCBpbnQqKfEDF3N0YXJ0X3BhZ2Uoc3RiX3ZvcmJpcyop8gMvdm9yYmlzX2ZpbmlzaF9mcmFtZShzdGJfdm9yYmlzKiwgaW50LCBpbnQsIGludCnzA0B2b3JiaXNfZGVjb2RlX2luaXRpYWwoc3RiX3ZvcmJpcyosIGludCosIGludCosIGludCosIGludCosIGludCop9AMaZ2V0X2JpdHMoc3RiX3ZvcmJpcyosIGludCn1AzJjb2RlYm9va19kZWNvZGVfc2NhbGFyX3JhdyhzdGJfdm9yYmlzKiwgQ29kZWJvb2sqKfYDQ2RlY29kZV9yZXNpZHVlKHN0Yl92b3JiaXMqLCBmbG9hdCoqLCBpbnQsIGludCwgaW50LCB1bnNpZ25lZCBjaGFyKin3AytpbnZlcnNlX21kY3QoZmxvYXQqLCBpbnQsIHN0Yl92b3JiaXMqLCBpbnQp+AMZZmx1c2hfcGFja2V0KHN0Yl92b3JiaXMqKfkDGnN0YXJ0X2RlY29kZXIoc3RiX3ZvcmJpcyop+gModWludDMyX2NvbXBhcmUodm9pZCBjb25zdCosIHZvaWQgY29uc3QqKfsDJWluaXRfYmxvY2tzaXplKHN0Yl92b3JiaXMqLCBpbnQsIGludCn8AxZzdGJfdm9yYmlzX29wZW5fbWVtb3J5/QMac3RiX3ZvcmJpc19nZXRfZnJhbWVfc2hvcnT+A0Bjb252ZXJ0X3NhbXBsZXNfc2hvcnQoaW50LCBzaG9ydCoqLCBpbnQsIGludCwgZmxvYXQqKiwgaW50LCBpbnQp/wMmc3RiX3ZvcmJpc19nZXRfZnJhbWVfc2hvcnRfaW50ZXJsZWF2ZWSABEdjb252ZXJ0X2NoYW5uZWxzX3Nob3J0X2ludGVybGVhdmVkKGludCwgc2hvcnQqLCBpbnQsIGZsb2F0KiosIGludCwgaW50KYEEGHN0Yl92b3JiaXNfZGVjb2RlX21lbW9yeYIEH21heWJlX3N0YXJ0X3BhY2tldChzdGJfdm9yYmlzKimDBClzdGFydF9wYWdlX25vX2NhcHR1cmVwYXR0ZXJuKHN0Yl92b3JiaXMqKYQEMmNvZGVib29rX2RlY29kZV9zdGFydChzdGJfdm9yYmlzKiwgQ29kZWJvb2sqLCBpbnQphQRfY29kZWJvb2tfZGVjb2RlX2RlaW50ZXJsZWF2ZV9yZXBlYXQoc3RiX3ZvcmJpcyosIENvZGVib29rKiwgZmxvYXQqKiwgaW50LCBpbnQqLCBpbnQqLCBpbnQsIGludCmGBDVpbWRjdF9zdGVwM19pdGVyMF9sb29wKGludCwgZmxvYXQqLCBpbnQsIGludCwgZmxvYXQqKYcEPGltZGN0X3N0ZXAzX2lubmVyX3JfbG9vcChpbnQsIGZsb2F0KiwgaW50LCBpbnQsIGZsb2F0KiwgaW50KYgEB3NjYWxibmaJBAZsZGV4cGaKBAZtZW1jbXCLBAVxc29ydIwEBHNpZnSNBANzaHKOBAd0cmlua2xljwQDc2hskAQEcG50epEEBWN5Y2xlkgQHYV9jdHpfbJMEDF9fc3RkaW9fc2Vla5QECl9fbG9ja2ZpbGWVBAxfX3VubG9ja2ZpbGWWBAlfX2Z3cml0ZXiXBAZmd3JpdGWYBAdpcHJpbnRmmQQQX19lcnJub19sb2NhdGlvbpoEB3djcnRvbWKbBAZ3Y3RvbWKcBAZtZW1jaHKdBAVmcmV4cJ4EE19fdmZwcmludGZfaW50ZXJuYWyfBAtwcmludGZfY29yZaAEA291dKEEBmdldGludKIEB3BvcF9hcmejBANwYWSkBAVmbXRfb6UEBWZtdF94pgQFZm10X3WnBAh2ZnByaW50ZqgEBmZtdF9mcKkEE3BvcF9hcmdfbG9uZ19kb3VibGWqBAl2ZmlwcmludGarBApfX29mbF9sb2NrrAQJX190b3dyaXRlrQQIZmlwcmludGauBAVmcHV0Y68EEV9fZnRlbGxvX3VubG9ja2VksAQIX19mdGVsbG+xBAVmdGVsbLIECF9fdG9yZWFkswQFZnJlYWS0BBFfX2ZzZWVrb191bmxvY2tlZLUECF9fZnNlZWtvtgQFZnNlZWu3BA1fX3N0ZGlvX2Nsb3NluAQFZmdldGO5BAZzdHJsZW66BAtfX3N0cmNocm51bLsEBnN0cmNocrwEDF9fZm1vZGVmbGFnc70EBWZvcGVuvgQJdnNucHJpbnRmvwQIc25fd3JpdGXABAZmY2xvc2XBBBlfX2Vtc2NyaXB0ZW5fc3Rkb3V0X2Nsb3NlwgQYX19lbXNjcmlwdGVuX3N0ZG91dF9zZWVrwwQMX19zdGRpb19yZWFkxAQIX19mZG9wZW7FBA1fX3N0ZGlvX3dyaXRlxgQKX19vdmVyZmxvd8cEBmZmbHVzaMgEEV9fZmZsdXNoX3VubG9ja2VkyQQHX191Zmxvd8oECV9fb2ZsX2FkZMsECV9fbHNocnRpM8wECV9fYXNobHRpM80EDF9fdHJ1bmN0ZmRmMs4EBV9fY29zzwQQX19yZW1fcGlvMl9sYXJnZdAECl9fcmVtX3BpbzLRBAVfX3NpbtIEA2Nvc9MEB19fY29zZGbUBAdfX3NpbmRm1QQLX19yZW1fcGlvMmbWBARjb3Nm1wQDc2lu2AQEc2luZtkEBV9fdGFu2gQDdGFu2wQFYXRhbmbcBAZhdGFuMmbdBARleHBm3gQDbG9n3wQEbG9nZuAEA3Bvd+EEB3dtZW1jcHniBBlzdGQ6OnVuY2F1Z2h0X2V4Y2VwdGlvbigp4wRFc3RkOjpfXzI6OmJhc2ljX2lvczxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX2lvcygp5AQfc3RkOjpfXzI6Omlvc19iYXNlOjp+aW9zX2Jhc2UoKeUEP3N0ZDo6X18yOjppb3NfYmFzZTo6X19jYWxsX2NhbGxiYWNrcyhzdGQ6Ol9fMjo6aW9zX2Jhc2U6OmV2ZW50KeYER3N0ZDo6X18yOjpiYXNpY19pb3M8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19pb3MoKS4x5wRRc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX3N0cmVhbWJ1Zigp6ARTc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX3N0cmVhbWJ1ZigpLjHpBFBzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpiYXNpY19zdHJlYW1idWYoKeoEXXN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OmltYnVlKHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKesEUnN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnNldGJ1ZihjaGFyKiwgbG9uZynsBHxzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpzZWVrb2ZmKGxvbmcgbG9uZywgc3RkOjpfXzI6Omlvc19iYXNlOjpzZWVrZGlyLCB1bnNpZ25lZCBpbnQp7QRxc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6c2Vla3BvcyhzdGQ6Ol9fMjo6ZnBvczxfX21ic3RhdGVfdD4sIHVuc2lnbmVkIGludCnuBFJzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp4c2dldG4oY2hhciosIGxvbmcp7wREc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+Ojpjb3B5KGNoYXIqLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgbG9uZynwBEpzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp1bmRlcmZsb3coKfEERnN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnVmbG93KCnyBE1zdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpwYmFja2ZhaWwoaW50KfMEWHN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnhzcHV0bihjaGFyIGNvbnN0KiwgbG9uZyn0BFdzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Ojp+YmFzaWNfc3RyZWFtYnVmKCn1BFlzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Ojp+YmFzaWNfc3RyZWFtYnVmKCkuMfYEVnN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46OmJhc2ljX3N0cmVhbWJ1Zigp9wRbc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1Zjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6eHNnZXRuKHdjaGFyX3QqLCBsb25nKfgETXN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Pjo6Y29weSh3Y2hhcl90Kiwgd2NoYXJfdCBjb25zdCosIHVuc2lnbmVkIGxvbmcp+QRMc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1Zjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6dWZsb3coKfoEYXN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46OnhzcHV0bih3Y2hhcl90IGNvbnN0KiwgbG9uZyn7BE9zdGQ6Ol9fMjo6YmFzaWNfaXN0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX2lzdHJlYW0oKS4x/ARedmlydHVhbCB0aHVuayB0byBzdGQ6Ol9fMjo6YmFzaWNfaXN0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX2lzdHJlYW0oKf0ET3N0ZDo6X18yOjpiYXNpY19pc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfaXN0cmVhbSgpLjL+BGB2aXJ0dWFsIHRodW5rIHRvIHN0ZDo6X18yOjpiYXNpY19pc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfaXN0cmVhbSgpLjH/BI8Bc3RkOjpfXzI6OmJhc2ljX2lzdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnNlbnRyeTo6c2VudHJ5KHN0ZDo6X18yOjpiYXNpY19pc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+JiwgYm9vbCmABURzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6Zmx1c2goKYEFYXN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYgc3RkOjpfXzI6OnVzZV9mYWNldDxzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gPihzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JimCBdEBYm9vbCBzdGQ6Ol9fMjo6b3BlcmF0b3IhPTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiBjb25zdCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+IGNvbnN0JimDBVRzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6b3BlcmF0b3IqKCkgY29uc3SEBU9zdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6b3BlcmF0b3IrKygphQXRAWJvb2wgc3RkOjpfXzI6Om9wZXJhdG9yPT08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gY29uc3QmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiBjb25zdCYphgWJAXN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpzZW50cnk6OnNlbnRyeShzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYphwVOc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnNlbnRyeTo6fnNlbnRyeSgpiAWYAXN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjplcXVhbChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiBjb25zdCYpIGNvbnN0iQVHc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6c2J1bXBjKCmKBUpzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpzcHV0YyhjaGFyKYsFTnN0ZDo6X18yOjpiYXNpY19pc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpyZWFkKGNoYXIqLCBsb25nKYwFanN0ZDo6X18yOjpiYXNpY19pc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpzZWVrZyhsb25nIGxvbmcsIHN0ZDo6X18yOjppb3NfYmFzZTo6c2Vla2RpcimNBUpzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6Zmx1c2goKY4FZ3N0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYgc3RkOjpfXzI6OnVzZV9mYWNldDxzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gPihzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JimPBeMBYm9vbCBzdGQ6Ol9fMjo6b3BlcmF0b3IhPTx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiBjb25zdCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+IGNvbnN0JimQBVVzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6b3BlcmF0b3IrKygpkQXjAWJvb2wgc3RkOjpfXzI6Om9wZXJhdG9yPT08d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gY29uc3QmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiBjb25zdCYpkgWVAXN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+OjpzZW50cnk6OnNlbnRyeShzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYpkwWkAXN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+OjplcXVhbChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiBjb25zdCYpIGNvbnN0lAVNc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1Zjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6c2J1bXBjKCmVBVNzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+OjpzcHV0Yyh3Y2hhcl90KZYFT3N0ZDo6X18yOjpiYXNpY19vc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfb3N0cmVhbSgpLjGXBV52aXJ0dWFsIHRodW5rIHRvIHN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfb3N0cmVhbSgpmAVPc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19vc3RyZWFtKCkuMpkFYHZpcnR1YWwgdGh1bmsgdG8gc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19vc3RyZWFtKCkuMZoF7QFzdGQ6Ol9fMjo6bnVtX3B1dDxjaGFyLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+IGNvbnN0JiBzdGQ6Ol9fMjo6dXNlX2ZhY2V0PHN0ZDo6X18yOjpudW1fcHV0PGNoYXIsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID4gPihzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JimbBUVzdGQ6Ol9fMjo6YmFzaWNfaW9zPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpmaWxsKCkgY29uc3ScBUpzdGQ6Ol9fMjo6YmFzaWNfaW9zPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp3aWRlbihjaGFyKSBjb25zdJ0FTnN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpvcGVyYXRvcjw8KHNob3J0KZ4FTHN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpvcGVyYXRvcjw8KGludCmfBVZzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6b3BlcmF0b3I8PCh1bnNpZ25lZCBsb25nKaAFUnN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpvcGVyYXRvcj0oY2hhcimhBUZzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6cHV0KGNoYXIpogVbc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46Om9wZXJhdG9yPSh3Y2hhcl90KaMFcHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OmJhc2ljX3N0cmluZyhjaGFyIGNvbnN0KimkBSFzdGQ6Ol9fMjo6aW9zX2Jhc2U6On5pb3NfYmFzZSgpLjGlBR9zdGQ6Ol9fMjo6aW9zX2Jhc2U6OmluaXQodm9pZCoppgW1AXN0ZDo6X18yOjplbmFibGVfaWY8KGlzX21vdmVfY29uc3RydWN0aWJsZTx1bnNpZ25lZCBpbnQ+Ojp2YWx1ZSkgJiYgKGlzX21vdmVfYXNzaWduYWJsZTx1bnNpZ25lZCBpbnQ+Ojp2YWx1ZSksIHZvaWQ+Ojp0eXBlIHN0ZDo6X18yOjpzd2FwPHVuc2lnbmVkIGludD4odW5zaWduZWQgaW50JiwgdW5zaWduZWQgaW50JimnBVlzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6X190ZXN0X2Zvcl9lb2YoKSBjb25zdKgFX3N0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+OjpfX3Rlc3RfZm9yX2VvZigpIGNvbnN0qQUGdW5nZXRjqgUgc3RkOjpfXzI6Omlvc19iYXNlOjpJbml0OjpJbml0KCmrBRdfX2N4eF9nbG9iYWxfYXJyYXlfZHRvcqwFP3N0ZDo6X18yOjpfX3N0ZGluYnVmPGNoYXI+OjpfX3N0ZGluYnVmKF9JT19GSUxFKiwgX19tYnN0YXRlX3QqKa0FigFzdGQ6Ol9fMjo6YmFzaWNfaXN0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6YmFzaWNfaXN0cmVhbShzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+KimuBUJzdGQ6Ol9fMjo6X19zdGRpbmJ1Zjx3Y2hhcl90Pjo6X19zdGRpbmJ1ZihfSU9fRklMRSosIF9fbWJzdGF0ZV90KimvBZYBc3RkOjpfXzI6OmJhc2ljX2lzdHJlYW08d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46OmJhc2ljX2lzdHJlYW0oc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1Zjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiopsAVBc3RkOjpfXzI6Ol9fc3Rkb3V0YnVmPGNoYXI+OjpfX3N0ZG91dGJ1ZihfSU9fRklMRSosIF9fbWJzdGF0ZV90KimxBYoBc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OmJhc2ljX29zdHJlYW0oc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiopsgVEc3RkOjpfXzI6Ol9fc3Rkb3V0YnVmPHdjaGFyX3Q+OjpfX3N0ZG91dGJ1ZihfSU9fRklMRSosIF9fbWJzdGF0ZV90KimzBZYBc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46OmJhc2ljX29zdHJlYW0oc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1Zjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPioptAV9c3RkOjpfXzI6OmJhc2ljX2lvczxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6aW5pdChzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Kim1BYsBc3RkOjpfXzI6OmNvZGVjdnQ8Y2hhciwgY2hhciwgX19tYnN0YXRlX3Q+IGNvbnN0JiBzdGQ6Ol9fMjo6dXNlX2ZhY2V0PHN0ZDo6X18yOjpjb2RlY3Z0PGNoYXIsIGNoYXIsIF9fbWJzdGF0ZV90PiA+KHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKbYFkQFzdGQ6Ol9fMjo6Y29kZWN2dDx3Y2hhcl90LCBjaGFyLCBfX21ic3RhdGVfdD4gY29uc3QmIHN0ZDo6X18yOjp1c2VfZmFjZXQ8c3RkOjpfXzI6OmNvZGVjdnQ8d2NoYXJfdCwgY2hhciwgX19tYnN0YXRlX3Q+ID4oc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYptwUpc3RkOjpfXzI6Ol9fc3RkaW5idWY8Y2hhcj46On5fX3N0ZGluYnVmKCm4BTpzdGQ6Ol9fMjo6X19zdGRpbmJ1ZjxjaGFyPjo6aW1idWUoc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYpuQUnc3RkOjpfXzI6Ol9fc3RkaW5idWY8Y2hhcj46OnVuZGVyZmxvdygpugUrc3RkOjpfXzI6Ol9fc3RkaW5idWY8Y2hhcj46Ol9fZ2V0Y2hhcihib29sKbsFI3N0ZDo6X18yOjpfX3N0ZGluYnVmPGNoYXI+Ojp1ZmxvdygpvAUqc3RkOjpfXzI6Ol9fc3RkaW5idWY8Y2hhcj46OnBiYWNrZmFpbChpbnQpvQUsc3RkOjpfXzI6Ol9fc3RkaW5idWY8d2NoYXJfdD46On5fX3N0ZGluYnVmKCm+BT1zdGQ6Ol9fMjo6X19zdGRpbmJ1Zjx3Y2hhcl90Pjo6aW1idWUoc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYpvwUqc3RkOjpfXzI6Ol9fc3RkaW5idWY8d2NoYXJfdD46OnVuZGVyZmxvdygpwAUuc3RkOjpfXzI6Ol9fc3RkaW5idWY8d2NoYXJfdD46Ol9fZ2V0Y2hhcihib29sKcEFJnN0ZDo6X18yOjpfX3N0ZGluYnVmPHdjaGFyX3Q+Ojp1ZmxvdygpwgU2c3RkOjpfXzI6Ol9fc3RkaW5idWY8d2NoYXJfdD46OnBiYWNrZmFpbCh1bnNpZ25lZCBpbnQpwwU7c3RkOjpfXzI6Ol9fc3Rkb3V0YnVmPGNoYXI+OjppbWJ1ZShzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JinEBSNzdGQ6Ol9fMjo6X19zdGRvdXRidWY8Y2hhcj46OnN5bmMoKcUFNnN0ZDo6X18yOjpfX3N0ZG91dGJ1ZjxjaGFyPjo6eHNwdXRuKGNoYXIgY29uc3QqLCBsb25nKcYFKnN0ZDo6X18yOjpfX3N0ZG91dGJ1ZjxjaGFyPjo6b3ZlcmZsb3coaW50KccFPnN0ZDo6X18yOjpfX3N0ZG91dGJ1Zjx3Y2hhcl90Pjo6aW1idWUoc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYpyAU8c3RkOjpfXzI6Ol9fc3Rkb3V0YnVmPHdjaGFyX3Q+Ojp4c3B1dG4od2NoYXJfdCBjb25zdCosIGxvbmcpyQU2c3RkOjpfXzI6Ol9fc3Rkb3V0YnVmPHdjaGFyX3Q+OjpvdmVyZmxvdyh1bnNpZ25lZCBpbnQpygUHX19zaGxpbcsFCF9fc2hnZXRjzAUIX19tdWx0aTPNBQlfX2ludHNjYW7OBQdtYnJ0b3djzwUNX19leHRlbmRzZnRmMtAFCF9fbXVsdGYz0QULX19mbG9hdHNpdGbSBQhfX2FkZHRmM9MFDV9fZXh0ZW5kZGZ0ZjLUBQdfX2xldGYy1QUHX19nZXRmMtYFCWNvcHlzaWdubNcFDV9fZmxvYXR1bnNpdGbYBQhfX3N1YnRmM9kFB3NjYWxibmzaBQhfX2RpdnRmM9sFC19fZmxvYXRzY2Fu3AUIaGV4ZmxvYXTdBQhkZWNmbG9hdN4FB3NjYW5leHDfBQxfX3RydW5jdGZzZjLgBQd2ZnNjYW5m4QUFYXJnX27iBQlzdG9yZV9pbnTjBQ1fX3N0cmluZ19yZWFk5AUHdnNzY2FuZuUFB2RvX3JlYWTmBQZzdHJjbXDnBSBfX2Vtc2NyaXB0ZW5fZW52aXJvbl9jb25zdHJ1Y3RvcugFB3N0cm5jbXDpBQZnZXRlbnbqBQhfX211bm1hcOsFDF9fZ2V0X2xvY2FsZewFC19fbmV3bG9jYWxl7QUJdmFzcHJpbnRm7gUGc3NjYW5m7wUIc25wcmludGbwBQpmcmVlbG9jYWxl8QUGd2NzbGVu8gUJd2NzcnRvbWJz8wUKd2NzbnJ0b21ic/QFCW1ic3J0b3djc/UFCm1ic25ydG93Y3P2BQZzdHJ0b3j3BQpzdHJ0b3VsbF9s+AUJc3RydG9sbF9s+QUGc3RydG9m+gUIc3RydG94LjH7BQZzdHJ0b2T8BQdzdHJ0b2xk/QUJc3RydG9sZF9s/gVdc3RkOjpfXzI6OmNvbGxhdGU8Y2hhcj46OmRvX2NvbXBhcmUoY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdCopIGNvbnN0/wVFc3RkOjpfXzI6OmNvbGxhdGU8Y2hhcj46OmRvX3RyYW5zZm9ybShjaGFyIGNvbnN0KiwgY2hhciBjb25zdCopIGNvbnN0gAbPAXN0ZDo6X18yOjplbmFibGVfaWY8X19pc19mb3J3YXJkX2l0ZXJhdG9yPGNoYXIgY29uc3QqPjo6dmFsdWUsIHZvaWQ+Ojp0eXBlIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46Ol9faW5pdDxjaGFyIGNvbnN0Kj4oY2hhciBjb25zdCosIGNoYXIgY29uc3QqKYEGQHN0ZDo6X18yOjpjb2xsYXRlPGNoYXI+Ojpkb19oYXNoKGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KikgY29uc3SCBmxzdGQ6Ol9fMjo6Y29sbGF0ZTx3Y2hhcl90Pjo6ZG9fY29tcGFyZSh3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0KikgY29uc3SDBk5zdGQ6Ol9fMjo6Y29sbGF0ZTx3Y2hhcl90Pjo6ZG9fdHJhbnNmb3JtKHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0KikgY29uc3SEBuQBc3RkOjpfXzI6OmVuYWJsZV9pZjxfX2lzX2ZvcndhcmRfaXRlcmF0b3I8d2NoYXJfdCBjb25zdCo+Ojp2YWx1ZSwgdm9pZD46OnR5cGUgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6X19pbml0PHdjaGFyX3QgY29uc3QqPih3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdCophQZJc3RkOjpfXzI6OmNvbGxhdGU8d2NoYXJfdD46OmRvX2hhc2god2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqKSBjb25zdIYGmgJzdGQ6Ol9fMjo6bnVtX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBib29sJikgY29uc3SHBmdzdGQ6Ol9fMjo6bnVtcHVuY3Q8Y2hhcj4gY29uc3QmIHN0ZDo6X18yOjp1c2VfZmFjZXQ8c3RkOjpfXzI6Om51bXB1bmN0PGNoYXI+ID4oc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYpiAakBXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QqIHN0ZDo6X18yOjpfX3NjYW5fa2V5d29yZDxzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCosIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiA+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QqLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0Kiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JiwgdW5zaWduZWQgaW50JiwgYm9vbCmJBjhzdGQ6Ol9fMjo6bG9jYWxlOjp1c2VfZmFjZXQoc3RkOjpfXzI6OmxvY2FsZTo6aWQmKSBjb25zdIoGzAFzdGQ6Ol9fMjo6dW5pcXVlX3B0cjx1bnNpZ25lZCBjaGFyLCB2b2lkICgqKSh2b2lkKik+Ojp1bmlxdWVfcHRyPHRydWUsIHZvaWQ+KHVuc2lnbmVkIGNoYXIqLCBzdGQ6Ol9fMjo6X19kZXBlbmRlbnRfdHlwZTxzdGQ6Ol9fMjo6X191bmlxdWVfcHRyX2RlbGV0ZXJfc2ZpbmFlPHZvaWQgKCopKHZvaWQqKT4sIHRydWU+OjpfX2dvb2RfcnZhbF9yZWZfdHlwZSmLBpoCc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgbG9uZyYpIGNvbnN0jAbrAnN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+IHN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZG9fZ2V0X3NpZ25lZDxsb25nPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGxvbmcmKSBjb25zdI0GOXN0ZDo6X18yOjpfX251bV9nZXRfYmFzZTo6X19nZXRfYmFzZShzdGQ6Ol9fMjo6aW9zX2Jhc2UmKY4GSHN0ZDo6X18yOjpfX251bV9nZXQ8Y2hhcj46Ol9fc3RhZ2UyX2ludF9wcmVwKHN0ZDo6X18yOjppb3NfYmFzZSYsIGNoYXImKY8GZXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OmJhc2ljX3N0cmluZygpkAZsc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6cmVzaXplKHVuc2lnbmVkIGxvbmcpkQblAXN0ZDo6X18yOjpfX251bV9nZXQ8Y2hhcj46Ol9fc3RhZ2UyX2ludF9sb29wKGNoYXIsIGludCwgY2hhciosIGNoYXIqJiwgdW5zaWduZWQgaW50JiwgY2hhciwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCYsIHVuc2lnbmVkIGludCosIHVuc2lnbmVkIGludComLCBjaGFyIGNvbnN0KimSBlxsb25nIHN0ZDo6X18yOjpfX251bV9nZXRfc2lnbmVkX2ludGVncmFsPGxvbmc+KGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgaW50JiwgaW50KZMGpQFzdGQ6Ol9fMjo6X19jaGVja19ncm91cGluZyhzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0JiwgdW5zaWduZWQgaW50KiwgdW5zaWduZWQgaW50KiwgdW5zaWduZWQgaW50JimUBp8Cc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgbG9uZyBsb25nJikgY29uc3SVBvUCc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19kb19nZXRfc2lnbmVkPGxvbmcgbG9uZz4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBsb25nIGxvbmcmKSBjb25zdJYGZmxvbmcgbG9uZyBzdGQ6Ol9fMjo6X19udW1fZ2V0X3NpZ25lZF9pbnRlZ3JhbDxsb25nIGxvbmc+KGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgaW50JiwgaW50KZcGpAJzdGQ6Ol9fMjo6bnVtX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB1bnNpZ25lZCBzaG9ydCYpIGNvbnN0mAaBA3N0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+IHN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZG9fZ2V0X3Vuc2lnbmVkPHVuc2lnbmVkIHNob3J0PihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHVuc2lnbmVkIHNob3J0JikgY29uc3SZBnJ1bnNpZ25lZCBzaG9ydCBzdGQ6Ol9fMjo6X19udW1fZ2V0X3Vuc2lnbmVkX2ludGVncmFsPHVuc2lnbmVkIHNob3J0PihjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGludCYsIGludCmaBqICc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdW5zaWduZWQgaW50JikgY29uc3SbBv0Cc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19kb19nZXRfdW5zaWduZWQ8dW5zaWduZWQgaW50PihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHVuc2lnbmVkIGludCYpIGNvbnN0nAZudW5zaWduZWQgaW50IHN0ZDo6X18yOjpfX251bV9nZXRfdW5zaWduZWRfaW50ZWdyYWw8dW5zaWduZWQgaW50PihjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGludCYsIGludCmdBqgCc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdW5zaWduZWQgbG9uZyBsb25nJikgY29uc3SeBokDc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19kb19nZXRfdW5zaWduZWQ8dW5zaWduZWQgbG9uZyBsb25nPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHVuc2lnbmVkIGxvbmcgbG9uZyYpIGNvbnN0nwZ6dW5zaWduZWQgbG9uZyBsb25nIHN0ZDo6X18yOjpfX251bV9nZXRfdW5zaWduZWRfaW50ZWdyYWw8dW5zaWduZWQgbG9uZyBsb25nPihjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGludCYsIGludCmgBpsCc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgZmxvYXQmKSBjb25zdKEG9QJzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiBzdGQ6Ol9fMjo6bnVtX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2RvX2dldF9mbG9hdGluZ19wb2ludDxmbG9hdD4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBmbG9hdCYpIGNvbnN0ogZYc3RkOjpfXzI6Ol9fbnVtX2dldDxjaGFyPjo6X19zdGFnZTJfZmxvYXRfcHJlcChzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCBjaGFyKiwgY2hhciYsIGNoYXImKaMG8AFzdGQ6Ol9fMjo6X19udW1fZ2V0PGNoYXI+OjpfX3N0YWdlMl9mbG9hdF9sb29wKGNoYXIsIGJvb2wmLCBjaGFyJiwgY2hhciosIGNoYXIqJiwgY2hhciwgY2hhciwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCYsIHVuc2lnbmVkIGludCosIHVuc2lnbmVkIGludComLCB1bnNpZ25lZCBpbnQmLCBjaGFyKimkBk9mbG9hdCBzdGQ6Ol9fMjo6X19udW1fZ2V0X2Zsb2F0PGZsb2F0PihjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGludCYppQacAnN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGRvdWJsZSYpIGNvbnN0pgb3AnN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+IHN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZG9fZ2V0X2Zsb2F0aW5nX3BvaW50PGRvdWJsZT4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBkb3VibGUmKSBjb25zdKcGUWRvdWJsZSBzdGQ6Ol9fMjo6X19udW1fZ2V0X2Zsb2F0PGRvdWJsZT4oY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBpbnQmKagGoQJzdGQ6Ol9fMjo6bnVtX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBsb25nIGRvdWJsZSYpIGNvbnN0qQaBA3N0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+IHN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZG9fZ2V0X2Zsb2F0aW5nX3BvaW50PGxvbmcgZG91YmxlPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGxvbmcgZG91YmxlJikgY29uc3SqBltsb25nIGRvdWJsZSBzdGQ6Ol9fMjo6X19udW1fZ2V0X2Zsb2F0PGxvbmcgZG91YmxlPihjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGludCYpqwabAnN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHZvaWQqJikgY29uc3SsBhJzdGQ6Ol9fMjo6X19jbG9jKCmtBkxzdGQ6Ol9fMjo6X19saWJjcHBfc3NjYW5mX2woY2hhciBjb25zdCosIF9fbG9jYWxlX3N0cnVjdCosIGNoYXIgY29uc3QqLCAuLi4prgZfc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6X196ZXJvKCmvBlRjaGFyIGNvbnN0KiBzdGQ6Ol9fMjo6ZmluZDxjaGFyIGNvbnN0KiwgY2hhcj4oY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0JimwBklzdGQ6Ol9fMjo6X19saWJjcHBfbG9jYWxlX2d1YXJkOjpfX2xpYmNwcF9sb2NhbGVfZ3VhcmQoX19sb2NhbGVfc3RydWN0KiYpsQavAnN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGJvb2wmKSBjb25zdLIGbXN0ZDo6X18yOjpudW1wdW5jdDx3Y2hhcl90PiBjb25zdCYgc3RkOjpfXzI6OnVzZV9mYWNldDxzdGQ6Ol9fMjo6bnVtcHVuY3Q8d2NoYXJfdD4gPihzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JimzBuAFc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiBjb25zdCogc3RkOjpfXzI6Ol9fc2Nhbl9rZXl3b3JkPHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+IGNvbnN0Kiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+ID4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiBjb25zdCosIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4gY29uc3QqLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmLCB1bnNpZ25lZCBpbnQmLCBib29sKbQGrwJzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBsb25nJikgY29uc3S1BoYDc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19kb19nZXRfc2lnbmVkPGxvbmc+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgbG9uZyYpIGNvbnN0tgZNc3RkOjpfXzI6Ol9fbnVtX2dldDx3Y2hhcl90Pjo6X19kb193aWRlbihzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90KikgY29uc3S3Bk5zdGQ6Ol9fMjo6X19udW1fZ2V0PHdjaGFyX3Q+OjpfX3N0YWdlMl9pbnRfcHJlcChzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90Jim4BvEBc3RkOjpfXzI6Ol9fbnVtX2dldDx3Y2hhcl90Pjo6X19zdGFnZTJfaW50X2xvb3Aod2NoYXJfdCwgaW50LCBjaGFyKiwgY2hhciomLCB1bnNpZ25lZCBpbnQmLCB3Y2hhcl90LCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0JiwgdW5zaWduZWQgaW50KiwgdW5zaWduZWQgaW50KiYsIHdjaGFyX3QgY29uc3QqKbkGtAJzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBsb25nIGxvbmcmKSBjb25zdLoGkANzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiBzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2RvX2dldF9zaWduZWQ8bG9uZyBsb25nPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGxvbmcgbG9uZyYpIGNvbnN0uwa5AnN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHVuc2lnbmVkIHNob3J0JikgY29uc3S8BpwDc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19kb19nZXRfdW5zaWduZWQ8dW5zaWduZWQgc2hvcnQ+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdW5zaWduZWQgc2hvcnQmKSBjb25zdL0GtwJzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB1bnNpZ25lZCBpbnQmKSBjb25zdL4GmANzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiBzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2RvX2dldF91bnNpZ25lZDx1bnNpZ25lZCBpbnQ+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdW5zaWduZWQgaW50JikgY29uc3S/Br0Cc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdW5zaWduZWQgbG9uZyBsb25nJikgY29uc3TABqQDc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19kb19nZXRfdW5zaWduZWQ8dW5zaWduZWQgbG9uZyBsb25nPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHVuc2lnbmVkIGxvbmcgbG9uZyYpIGNvbnN0wQawAnN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGZsb2F0JikgY29uc3TCBpADc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19kb19nZXRfZmxvYXRpbmdfcG9pbnQ8ZmxvYXQ+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgZmxvYXQmKSBjb25zdMMGZHN0ZDo6X18yOjpfX251bV9nZXQ8d2NoYXJfdD46Ol9fc3RhZ2UyX2Zsb2F0X3ByZXAoc3RkOjpfXzI6Omlvc19iYXNlJiwgd2NoYXJfdCosIHdjaGFyX3QmLCB3Y2hhcl90JinEBv8Bc3RkOjpfXzI6Ol9fbnVtX2dldDx3Y2hhcl90Pjo6X19zdGFnZTJfZmxvYXRfbG9vcCh3Y2hhcl90LCBib29sJiwgY2hhciYsIGNoYXIqLCBjaGFyKiYsIHdjaGFyX3QsIHdjaGFyX3QsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QmLCB1bnNpZ25lZCBpbnQqLCB1bnNpZ25lZCBpbnQqJiwgdW5zaWduZWQgaW50Jiwgd2NoYXJfdCopxQaxAnN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGRvdWJsZSYpIGNvbnN0xgaSA3N0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+IHN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZG9fZ2V0X2Zsb2F0aW5nX3BvaW50PGRvdWJsZT4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBkb3VibGUmKSBjb25zdMcGtgJzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBsb25nIGRvdWJsZSYpIGNvbnN0yAacA3N0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+IHN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZG9fZ2V0X2Zsb2F0aW5nX3BvaW50PGxvbmcgZG91YmxlPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGxvbmcgZG91YmxlJikgY29uc3TJBrACc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50Jiwgdm9pZComKSBjb25zdMoGZndjaGFyX3QgY29uc3QqIHN0ZDo6X18yOjpmaW5kPHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90Pih3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QmKcsGZ3djaGFyX3QgY29uc3QqIHN0ZDo6X18yOjpfX251bV9nZXQ8d2NoYXJfdD46Ol9fZG9fd2lkZW5fcDx3Y2hhcl90PihzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90KikgY29uc3TMBs0Bc3RkOjpfXzI6Om51bV9wdXQ8Y2hhciwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCBjaGFyLCBib29sKSBjb25zdM0GXnN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OmJlZ2luKCnOBlxzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjplbmQoKc8GzQFzdGQ6Ol9fMjo6bnVtX3B1dDxjaGFyLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIGNoYXIsIGxvbmcpIGNvbnN00AZOc3RkOjpfXzI6Ol9fbnVtX3B1dF9iYXNlOjpfX2Zvcm1hdF9pbnQoY2hhciosIGNoYXIgY29uc3QqLCBib29sLCB1bnNpZ25lZCBpbnQp0QZXc3RkOjpfXzI6Ol9fbGliY3BwX3NucHJpbnRmX2woY2hhciosIHVuc2lnbmVkIGxvbmcsIF9fbG9jYWxlX3N0cnVjdCosIGNoYXIgY29uc3QqLCAuLi4p0gZVc3RkOjpfXzI6Ol9fbnVtX3B1dF9iYXNlOjpfX2lkZW50aWZ5X3BhZGRpbmcoY2hhciosIGNoYXIqLCBzdGQ6Ol9fMjo6aW9zX2Jhc2UgY29uc3QmKdMGdXN0ZDo6X18yOjpfX251bV9wdXQ8Y2hhcj46Ol9fd2lkZW5fYW5kX2dyb3VwX2ludChjaGFyKiwgY2hhciosIGNoYXIqLCBjaGFyKiwgY2hhciomLCBjaGFyKiYsIHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKdQGK3ZvaWQgc3RkOjpfXzI6OnJldmVyc2U8Y2hhcio+KGNoYXIqLCBjaGFyKinVBiFzdGQ6Ol9fMjo6aW9zX2Jhc2U6OndpZHRoKCkgY29uc3TWBtIBc3RkOjpfXzI6Om51bV9wdXQ8Y2hhciwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCBjaGFyLCBsb25nIGxvbmcpIGNvbnN01wbWAXN0ZDo6X18yOjpudW1fcHV0PGNoYXIsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgY2hhciwgdW5zaWduZWQgbG9uZykgY29uc3TYBtsBc3RkOjpfXzI6Om51bV9wdXQ8Y2hhciwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCBjaGFyLCB1bnNpZ25lZCBsb25nIGxvbmcpIGNvbnN02QbPAXN0ZDo6X18yOjpudW1fcHV0PGNoYXIsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgY2hhciwgZG91YmxlKSBjb25zdNoGSnN0ZDo6X18yOjpfX251bV9wdXRfYmFzZTo6X19mb3JtYXRfZmxvYXQoY2hhciosIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBpbnQp2wYlc3RkOjpfXzI6Omlvc19iYXNlOjpwcmVjaXNpb24oKSBjb25zdNwGSXN0ZDo6X18yOjpfX2xpYmNwcF9hc3ByaW50Zl9sKGNoYXIqKiwgX19sb2NhbGVfc3RydWN0KiwgY2hhciBjb25zdCosIC4uLindBndzdGQ6Ol9fMjo6X19udW1fcHV0PGNoYXI+OjpfX3dpZGVuX2FuZF9ncm91cF9mbG9hdChjaGFyKiwgY2hhciosIGNoYXIqLCBjaGFyKiwgY2hhciomLCBjaGFyKiYsIHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKd4G1AFzdGQ6Ol9fMjo6bnVtX3B1dDxjaGFyLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIGNoYXIsIGxvbmcgZG91YmxlKSBjb25zdN8G1AFzdGQ6Ol9fMjo6bnVtX3B1dDxjaGFyLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIGNoYXIsIHZvaWQgY29uc3QqKSBjb25zdOAG3wFzdGQ6Ol9fMjo6bnVtX3B1dDx3Y2hhcl90LCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHdjaGFyX3QsIGJvb2wpIGNvbnN04QZlc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6ZW5kKCniBt8Bc3RkOjpfXzI6Om51bV9wdXQ8d2NoYXJfdCwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90LCBsb25nKSBjb25zdOMGgQFzdGQ6Ol9fMjo6X19udW1fcHV0PHdjaGFyX3Q+OjpfX3dpZGVuX2FuZF9ncm91cF9pbnQoY2hhciosIGNoYXIqLCBjaGFyKiwgd2NoYXJfdCosIHdjaGFyX3QqJiwgd2NoYXJfdComLCBzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JinkBqMCc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gc3RkOjpfXzI6Ol9fcGFkX2FuZF9vdXRwdXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4oc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdCosIHN0ZDo6X18yOjppb3NfYmFzZSYsIHdjaGFyX3Qp5QY0dm9pZCBzdGQ6Ol9fMjo6cmV2ZXJzZTx3Y2hhcl90Kj4od2NoYXJfdCosIHdjaGFyX3QqKeYGhAFzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+OjpiYXNpY19zdHJpbmcodW5zaWduZWQgbG9uZywgd2NoYXJfdCnnBuQBc3RkOjpfXzI6Om51bV9wdXQ8d2NoYXJfdCwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90LCBsb25nIGxvbmcpIGNvbnN06AboAXN0ZDo6X18yOjpudW1fcHV0PHdjaGFyX3QsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgd2NoYXJfdCwgdW5zaWduZWQgbG9uZykgY29uc3TpBu0Bc3RkOjpfXzI6Om51bV9wdXQ8d2NoYXJfdCwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90LCB1bnNpZ25lZCBsb25nIGxvbmcpIGNvbnN06gbhAXN0ZDo6X18yOjpudW1fcHV0PHdjaGFyX3QsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgd2NoYXJfdCwgZG91YmxlKSBjb25zdOsGgwFzdGQ6Ol9fMjo6X19udW1fcHV0PHdjaGFyX3Q+OjpfX3dpZGVuX2FuZF9ncm91cF9mbG9hdChjaGFyKiwgY2hhciosIGNoYXIqLCB3Y2hhcl90Kiwgd2NoYXJfdComLCB3Y2hhcl90KiYsIHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKewG5gFzdGQ6Ol9fMjo6bnVtX3B1dDx3Y2hhcl90LCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHdjaGFyX3QsIGxvbmcgZG91YmxlKSBjb25zdO0G5gFzdGQ6Ol9fMjo6bnVtX3B1dDx3Y2hhcl90LCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHdjaGFyX3QsIHZvaWQgY29uc3QqKSBjb25zdO4GU3ZvaWQgc3RkOjpfXzI6Ol9fcmV2ZXJzZTxjaGFyKj4oY2hhciosIGNoYXIqLCBzdGQ6Ol9fMjo6cmFuZG9tX2FjY2Vzc19pdGVyYXRvcl90YWcp7wZcdm9pZCBzdGQ6Ol9fMjo6X19yZXZlcnNlPHdjaGFyX3QqPih3Y2hhcl90Kiwgd2NoYXJfdCosIHN0ZDo6X18yOjpyYW5kb21fYWNjZXNzX2l0ZXJhdG9yX3RhZynwBrACc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmdldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHRtKiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqKSBjb25zdPEGc3N0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19kYXRlX29yZGVyKCkgY29uc3TyBp4Cc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldF90aW1lKHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdG0qKSBjb25zdPMGngJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0X2RhdGUoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB0bSopIGNvbnN09AahAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXRfd2Vla2RheShzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHRtKikgY29uc3T1Bq8Cc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0X3dlZWtkYXluYW1lKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYpIGNvbnN09gajAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXRfbW9udGhuYW1lKHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdG0qKSBjb25zdPcGrQJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfbW9udGhuYW1lKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYpIGNvbnN0+AaeAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXRfeWVhcihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHRtKikgY29uc3T5BqgCc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0X3llYXIoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JikgY29uc3T6BqUCaW50IHN0ZDo6X18yOjpfX2dldF91cF90b19uX2RpZ2l0czxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYsIGludCn7BqUCc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHRtKiwgY2hhciwgY2hhcikgY29uc3T8BqUCc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0X3BlcmNlbnQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JikgY29uc3T9BqcCc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0X2RheShpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdP4GqAJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfaG91cihpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdP8GqwJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfMTJfaG91cihpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdIAHsAJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfZGF5X3llYXJfbnVtKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYpIGNvbnN0gQepAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2dldF9tb250aChpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdIIHqgJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfbWludXRlKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYpIGNvbnN0gwepAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2dldF93aGl0ZV9zcGFjZShzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdIQHqQJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfYW1fcG0oaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JikgY29uc3SFB6oCc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0X3NlY29uZChpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdIYHqwJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfd2Vla2RheShpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdIcHqQJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfeWVhcjQoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JikgY29uc3SIB8sCc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmdldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHRtKiwgd2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqKSBjb25zdIkHswJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0X3RpbWUoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB0bSopIGNvbnN0igezAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXRfZGF0ZShzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHRtKikgY29uc3SLB7YCc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldF93ZWVrZGF5KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdG0qKSBjb25zdIwHxwJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfd2Vla2RheW5hbWUoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JikgY29uc3SNB7gCc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldF9tb250aG5hbWUoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB0bSopIGNvbnN0jgfFAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF9tb250aG5hbWUoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JikgY29uc3SPB7MCc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldF95ZWFyKHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdG0qKSBjb25zdJAHwAJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfeWVhcihpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmKSBjb25zdJEHvQJpbnQgc3RkOjpfXzI6Ol9fZ2V0X3VwX3RvX25fZGlnaXRzPHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JiwgaW50KZIHugJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdG0qLCBjaGFyLCBjaGFyKSBjb25zdJMHvQJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfcGVyY2VudChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmKSBjb25zdJQHvwJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfZGF5KGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN0lQfAAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF9ob3VyKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN0lgfDAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF8xMl9ob3VyKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN0lwfIAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF9kYXlfeWVhcl9udW0oaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JikgY29uc3SYB8ECc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZ2V0X21vbnRoKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN0mQfCAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF9taW51dGUoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JikgY29uc3SaB8ECc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZ2V0X3doaXRlX3NwYWNlKHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN0mwfBAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF9hbV9wbShpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmKSBjb25zdJwHwgJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfc2Vjb25kKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN0nQfDAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF93ZWVrZGF5KGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN0ngfBAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF95ZWFyNChpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmKSBjb25zdJ8H3wFzdGQ6Ol9fMjo6dGltZV9wdXQ8Y2hhciwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCBjaGFyLCB0bSBjb25zdCosIGNoYXIsIGNoYXIpIGNvbnN0oAdKc3RkOjpfXzI6Ol9fdGltZV9wdXQ6Ol9fZG9fcHV0KGNoYXIqLCBjaGFyKiYsIHRtIGNvbnN0KiwgY2hhciwgY2hhcikgY29uc3ShB40Bc3RkOjpfXzI6OmVuYWJsZV9pZjwoaXNfbW92ZV9jb25zdHJ1Y3RpYmxlPGNoYXI+Ojp2YWx1ZSkgJiYgKGlzX21vdmVfYXNzaWduYWJsZTxjaGFyPjo6dmFsdWUpLCB2b2lkPjo6dHlwZSBzdGQ6Ol9fMjo6c3dhcDxjaGFyPihjaGFyJiwgY2hhciYpogfuAXN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+IHN0ZDo6X18yOjpfX2NvcHk8Y2hhciosIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID4oY2hhciosIGNoYXIqLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPimjB/EBc3RkOjpfXzI6OnRpbWVfcHV0PHdjaGFyX3QsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgd2NoYXJfdCwgdG0gY29uc3QqLCBjaGFyLCBjaGFyKSBjb25zdKQHUHN0ZDo6X18yOjpfX3RpbWVfcHV0OjpfX2RvX3B1dCh3Y2hhcl90Kiwgd2NoYXJfdComLCB0bSBjb25zdCosIGNoYXIsIGNoYXIpIGNvbnN0pQdlc3RkOjpfXzI6Ol9fbGliY3BwX21ic3J0b3djc19sKHdjaGFyX3QqLCBjaGFyIGNvbnN0KiosIHVuc2lnbmVkIGxvbmcsIF9fbWJzdGF0ZV90KiwgX19sb2NhbGVfc3RydWN0KimmByxzdGQ6Ol9fMjo6X190aHJvd19ydW50aW1lX2Vycm9yKGNoYXIgY29uc3QqKacHiQJzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiBzdGQ6Ol9fMjo6X19jb3B5PHdjaGFyX3QqLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+KHdjaGFyX3QqLCB3Y2hhcl90Kiwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4pqAc7c3RkOjpfXzI6Om1vbmV5cHVuY3Q8Y2hhciwgZmFsc2U+Ojpkb19kZWNpbWFsX3BvaW50KCkgY29uc3SpBzZzdGQ6Ol9fMjo6bW9uZXlwdW5jdDxjaGFyLCBmYWxzZT46OmRvX2dyb3VwaW5nKCkgY29uc3SqBztzdGQ6Ol9fMjo6bW9uZXlwdW5jdDxjaGFyLCBmYWxzZT46OmRvX25lZ2F0aXZlX3NpZ24oKSBjb25zdKsHOHN0ZDo6X18yOjptb25leXB1bmN0PGNoYXIsIGZhbHNlPjo6ZG9fcG9zX2Zvcm1hdCgpIGNvbnN0rAc+c3RkOjpfXzI6Om1vbmV5cHVuY3Q8d2NoYXJfdCwgZmFsc2U+Ojpkb19kZWNpbWFsX3BvaW50KCkgY29uc3StBz5zdGQ6Ol9fMjo6bW9uZXlwdW5jdDx3Y2hhcl90LCBmYWxzZT46OmRvX25lZ2F0aXZlX3NpZ24oKSBjb25zdK4HqQJzdGQ6Ol9fMjo6bW9uZXlfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIGJvb2wsIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGxvbmcgZG91YmxlJikgY29uc3SvB4wDc3RkOjpfXzI6Om1vbmV5X2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2RvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBib29sLCBzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JiwgdW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQmLCBib29sJiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0Jiwgc3RkOjpfXzI6OnVuaXF1ZV9wdHI8Y2hhciwgdm9pZCAoKikodm9pZCopPiYsIGNoYXIqJiwgY2hhciopsAfdA3N0ZDo6X18yOjpfX21vbmV5X2dldDxjaGFyPjo6X19nYXRoZXJfaW5mbyhib29sLCBzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0Jiwgc3RkOjpfXzI6Om1vbmV5X2Jhc2U6OnBhdHRlcm4mLCBjaGFyJiwgY2hhciYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4mLCBpbnQmKbEHUnN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpvcGVyYXRvcisrKGludCmyB2Z2b2lkIHN0ZDo6X18yOjpfX2RvdWJsZV9vcl9ub3RoaW5nPGNoYXI+KHN0ZDo6X18yOjp1bmlxdWVfcHRyPGNoYXIsIHZvaWQgKCopKHZvaWQqKT4mLCBjaGFyKiYsIGNoYXIqJimzB4YBdm9pZCBzdGQ6Ol9fMjo6X19kb3VibGVfb3Jfbm90aGluZzx1bnNpZ25lZCBpbnQ+KHN0ZDo6X18yOjp1bmlxdWVfcHRyPHVuc2lnbmVkIGludCwgdm9pZCAoKikodm9pZCopPiYsIHVuc2lnbmVkIGludComLCB1bnNpZ25lZCBpbnQqJim0B/MCc3RkOjpfXzI6Om1vbmV5X2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBib29sLCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+JikgY29uc3S1B15zdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpjbGVhcigptgfaAXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4mIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46Ol9fYXBwZW5kX2ZvcndhcmRfdW5zYWZlPGNoYXIqPihjaGFyKiwgY2hhcioptwd3c3RkOjpfXzI6Om1vbmV5cHVuY3Q8Y2hhciwgdHJ1ZT4gY29uc3QmIHN0ZDo6X18yOjp1c2VfZmFjZXQ8c3RkOjpfXzI6Om1vbmV5cHVuY3Q8Y2hhciwgdHJ1ZT4gPihzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0Jim4B7kBc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6b3BlcmF0b3I9KHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4mJim5B3lzdGQ6Ol9fMjo6bW9uZXlwdW5jdDxjaGFyLCBmYWxzZT4gY29uc3QmIHN0ZDo6X18yOjp1c2VfZmFjZXQ8c3RkOjpfXzI6Om1vbmV5cHVuY3Q8Y2hhciwgZmFsc2U+ID4oc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYpugfvAWJvb2wgc3RkOjpfXzI6OmVxdWFsPHN0ZDo6X18yOjpfX3dyYXBfaXRlcjxjaGFyKj4sIHN0ZDo6X18yOjpfX3dyYXBfaXRlcjxjaGFyKj4sIHN0ZDo6X18yOjpfX2VxdWFsX3RvPGNoYXIsIGNoYXI+ID4oc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPGNoYXIqPiwgc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPGNoYXIqPiwgc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPGNoYXIqPiwgc3RkOjpfXzI6Ol9fZXF1YWxfdG88Y2hhciwgY2hhcj4puwczc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPGNoYXIqPjo6b3BlcmF0b3IrKGxvbmcpIGNvbnN0vAdlc3RkOjpfXzI6OnVuaXF1ZV9wdHI8Y2hhciwgdm9pZCAoKikodm9pZCopPjo6b3BlcmF0b3I9KHN0ZDo6X18yOjp1bmlxdWVfcHRyPGNoYXIsIHZvaWQgKCopKHZvaWQqKT4mJim9B74Cc3RkOjpfXzI6Om1vbmV5X2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBib29sLCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBsb25nIGRvdWJsZSYpIGNvbnN0vgetA3N0ZDo6X18yOjptb25leV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19kb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgYm9vbCwgc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50JiwgYm9vbCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYsIHN0ZDo6X18yOjp1bmlxdWVfcHRyPHdjaGFyX3QsIHZvaWQgKCopKHZvaWQqKT4mLCB3Y2hhcl90KiYsIHdjaGFyX3QqKb8HgQRzdGQ6Ol9fMjo6X19tb25leV9nZXQ8d2NoYXJfdD46Ol9fZ2F0aGVyX2luZm8oYm9vbCwgc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYsIHN0ZDo6X18yOjptb25leV9iYXNlOjpwYXR0ZXJuJiwgd2NoYXJfdCYsIHdjaGFyX3QmLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+JiwgaW50JinAB1hzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6b3BlcmF0b3IrKyhpbnQpwQeRA3N0ZDo6X18yOjptb25leV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgYm9vbCwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiYpIGNvbnN0wgdnc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6Y2xlYXIoKcMH9QFzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+JiBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+OjpfX2FwcGVuZF9mb3J3YXJkX3Vuc2FmZTx3Y2hhcl90Kj4od2NoYXJfdCosIHdjaGFyX3QqKcQHfXN0ZDo6X18yOjptb25leXB1bmN0PHdjaGFyX3QsIHRydWU+IGNvbnN0JiBzdGQ6Ol9fMjo6dXNlX2ZhY2V0PHN0ZDo6X18yOjptb25leXB1bmN0PHdjaGFyX3QsIHRydWU+ID4oc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYpxQfLAXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID46Om9wZXJhdG9yPShzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+JiYpxgd/c3RkOjpfXzI6Om1vbmV5cHVuY3Q8d2NoYXJfdCwgZmFsc2U+IGNvbnN0JiBzdGQ6Ol9fMjo6dXNlX2ZhY2V0PHN0ZDo6X18yOjptb25leXB1bmN0PHdjaGFyX3QsIGZhbHNlPiA+KHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKccHigJib29sIHN0ZDo6X18yOjplcXVhbDxzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8d2NoYXJfdCo+LCBzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8d2NoYXJfdCo+LCBzdGQ6Ol9fMjo6X19lcXVhbF90bzx3Y2hhcl90LCB3Y2hhcl90PiA+KHN0ZDo6X18yOjpfX3dyYXBfaXRlcjx3Y2hhcl90Kj4sIHN0ZDo6X18yOjpfX3dyYXBfaXRlcjx3Y2hhcl90Kj4sIHN0ZDo6X18yOjpfX3dyYXBfaXRlcjx3Y2hhcl90Kj4sIHN0ZDo6X18yOjpfX2VxdWFsX3RvPHdjaGFyX3QsIHdjaGFyX3Q+KcgHNnN0ZDo6X18yOjpfX3dyYXBfaXRlcjx3Y2hhcl90Kj46Om9wZXJhdG9yKyhsb25nKSBjb25zdMkH3AFzdGQ6Ol9fMjo6bW9uZXlfcHV0PGNoYXIsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgYm9vbCwgc3RkOjpfXzI6Omlvc19iYXNlJiwgY2hhciwgbG9uZyBkb3VibGUpIGNvbnN0ygeLA3N0ZDo6X18yOjpfX21vbmV5X3B1dDxjaGFyPjo6X19nYXRoZXJfaW5mbyhib29sLCBib29sLCBzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0Jiwgc3RkOjpfXzI6Om1vbmV5X2Jhc2U6OnBhdHRlcm4mLCBjaGFyJiwgY2hhciYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiYsIGludCYpywfZA3N0ZDo6X18yOjpfX21vbmV5X3B1dDxjaGFyPjo6X19mb3JtYXQoY2hhciosIGNoYXIqJiwgY2hhciomLCB1bnNpZ25lZCBpbnQsIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0Kiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JiwgYm9vbCwgc3RkOjpfXzI6Om1vbmV5X2Jhc2U6OnBhdHRlcm4gY29uc3QmLCBjaGFyLCBjaGFyLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QmLCBpbnQpzAeOAWNoYXIqIHN0ZDo6X18yOjpjb3B5PHN0ZDo6X18yOjpfX3dyYXBfaXRlcjxjaGFyIGNvbnN0Kj4sIGNoYXIqPihzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8Y2hhciBjb25zdCo+LCBzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8Y2hhciBjb25zdCo+LCBjaGFyKinNB60Cc3RkOjpfXzI6Om1vbmV5X3B1dDxjaGFyLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIGJvb2wsIHN0ZDo6X18yOjppb3NfYmFzZSYsIGNoYXIsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QmKSBjb25zdM4H7gFzdGQ6Ol9fMjo6bW9uZXlfcHV0PHdjaGFyX3QsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgYm9vbCwgc3RkOjpfXzI6Omlvc19iYXNlJiwgd2NoYXJfdCwgbG9uZyBkb3VibGUpIGNvbnN0zwemA3N0ZDo6X18yOjpfX21vbmV5X3B1dDx3Y2hhcl90Pjo6X19nYXRoZXJfaW5mbyhib29sLCBib29sLCBzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0Jiwgc3RkOjpfXzI6Om1vbmV5X2Jhc2U6OnBhdHRlcm4mLCB3Y2hhcl90Jiwgd2NoYXJfdCYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiYsIGludCYp0AeGBHN0ZDo6X18yOjpfX21vbmV5X3B1dDx3Y2hhcl90Pjo6X19mb3JtYXQod2NoYXJfdCosIHdjaGFyX3QqJiwgd2NoYXJfdComLCB1bnNpZ25lZCBpbnQsIHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0Kiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JiwgYm9vbCwgc3RkOjpfXzI6Om1vbmV5X2Jhc2U6OnBhdHRlcm4gY29uc3QmLCB3Y2hhcl90LCB3Y2hhcl90LCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiBjb25zdCYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4gY29uc3QmLCBpbnQp0QegAXdjaGFyX3QqIHN0ZDo6X18yOjpjb3B5PHN0ZDo6X18yOjpfX3dyYXBfaXRlcjx3Y2hhcl90IGNvbnN0Kj4sIHdjaGFyX3QqPihzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8d2NoYXJfdCBjb25zdCo+LCBzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8d2NoYXJfdCBjb25zdCo+LCB3Y2hhcl90KinSB8gCc3RkOjpfXzI6Om1vbmV5X3B1dDx3Y2hhcl90LCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIGJvb2wsIHN0ZDo6X18yOjppb3NfYmFzZSYsIHdjaGFyX3QsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4gY29uc3QmKSBjb25zdNMHkAFjaGFyKiBzdGQ6Ol9fMjo6X19jb3B5PHN0ZDo6X18yOjpfX3dyYXBfaXRlcjxjaGFyIGNvbnN0Kj4sIGNoYXIqPihzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8Y2hhciBjb25zdCo+LCBzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8Y2hhciBjb25zdCo+LCBjaGFyKinUB6IBd2NoYXJfdCogc3RkOjpfXzI6Ol9fY29weTxzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8d2NoYXJfdCBjb25zdCo+LCB3Y2hhcl90Kj4oc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPHdjaGFyX3QgY29uc3QqPiwgc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPHdjaGFyX3QgY29uc3QqPiwgd2NoYXJfdCop1QeeAXN0ZDo6X18yOjptZXNzYWdlczxjaGFyPjo6ZG9fb3BlbihzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0Jiwgc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYpIGNvbnN01geUAXN0ZDo6X18yOjptZXNzYWdlczxjaGFyPjo6ZG9fZ2V0KGxvbmcsIGludCwgaW50LCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0JikgY29uc3TXB7gDc3RkOjpfXzI6OmJhY2tfaW5zZXJ0X2l0ZXJhdG9yPHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gPiBzdGQ6Ol9fMjo6X19uYXJyb3dfdG9fdXRmODw4dWw+OjpvcGVyYXRvcigpPHN0ZDo6X18yOjpiYWNrX2luc2VydF9pdGVyYXRvcjxzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+ID4sIGNoYXI+KHN0ZDo6X18yOjpiYWNrX2luc2VydF9pdGVyYXRvcjxzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+ID4sIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KikgY29uc3TYB44Bc3RkOjpfXzI6OmJhY2tfaW5zZXJ0X2l0ZXJhdG9yPHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gPjo6b3BlcmF0b3I9KGNoYXIgY29uc3QmKdkHoAFzdGQ6Ol9fMjo6bWVzc2FnZXM8d2NoYXJfdD46OmRvX2dldChsb25nLCBpbnQsIGludCwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiBjb25zdCYpIGNvbnN02gfCA3N0ZDo6X18yOjpiYWNrX2luc2VydF9pdGVyYXRvcjxzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+ID4gc3RkOjpfXzI6Ol9fbmFycm93X3RvX3V0Zjg8MzJ1bD46Om9wZXJhdG9yKCk8c3RkOjpfXzI6OmJhY2tfaW5zZXJ0X2l0ZXJhdG9yPHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gPiwgd2NoYXJfdD4oc3RkOjpfXzI6OmJhY2tfaW5zZXJ0X2l0ZXJhdG9yPHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gPiwgd2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqKSBjb25zdNsH0ANzdGQ6Ol9fMjo6YmFja19pbnNlcnRfaXRlcmF0b3I8c3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiA+IHN0ZDo6X18yOjpfX3dpZGVuX2Zyb21fdXRmODwzMnVsPjo6b3BlcmF0b3IoKTxzdGQ6Ol9fMjo6YmFja19pbnNlcnRfaXRlcmF0b3I8c3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiA+ID4oc3RkOjpfXzI6OmJhY2tfaW5zZXJ0X2l0ZXJhdG9yPHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4gPiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqKSBjb25zdNwHOXN0ZDo6X18yOjpjb2RlY3Z0PHdjaGFyX3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6fmNvZGVjdnQoKd0HLXN0ZDo6X18yOjpsb2NhbGU6Ol9faW1wOjpfX2ltcCh1bnNpZ25lZCBsb25nKd4HfnN0ZDo6X18yOjpfX3ZlY3Rvcl9iYXNlPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46Ol9fdmVjdG9yX2Jhc2UoKd8HggFzdGQ6Ol9fMjo6dmVjdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46Ol9fdmFsbG9jYXRlKHVuc2lnbmVkIGxvbmcp4AeJAXN0ZDo6X18yOjp2ZWN0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4gPjo6X19jb25zdHJ1Y3RfYXRfZW5kKHVuc2lnbmVkIGxvbmcp4Qd2c3RkOjpfXzI6Ol9fdmVjdG9yX2Jhc2U8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4gPjo6Y2xlYXIoKeIHjgFzdGQ6Ol9fMjo6dmVjdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46Ol9fYW5ub3RhdGVfc2hyaW5rKHVuc2lnbmVkIGxvbmcpIGNvbnN04wcdc3RkOjpfXzI6OmxvY2FsZTo6aWQ6Ol9fZ2V0KCnkB0BzdGQ6Ol9fMjo6bG9jYWxlOjpfX2ltcDo6aW5zdGFsbChzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIGxvbmcp5QdIc3RkOjpfXzI6OmN0eXBlPGNoYXI+OjpjdHlwZSh1bnNpZ25lZCBzaG9ydCBjb25zdCosIGJvb2wsIHVuc2lnbmVkIGxvbmcp5gcbc3RkOjpfXzI6OmxvY2FsZTo6Y2xhc3NpYygp5wd9c3RkOjpfXzI6OnZlY3RvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiA+OjpyZXNpemUodW5zaWduZWQgbG9uZynoByFzdGQ6Ol9fMjo6bG9jYWxlOjpfX2ltcDo6fl9faW1wKCnpB4EBc3RkOjpfXzI6OnZlY3RvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiA+OjpfX2Fubm90YXRlX2RlbGV0ZSgpIGNvbnN06gcjc3RkOjpfXzI6OmxvY2FsZTo6X19pbXA6On5fX2ltcCgpLjHrB39zdGQ6Ol9fMjo6dmVjdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46Ol9fYXBwZW5kKHVuc2lnbmVkIGxvbmcp7Accc3RkOjpfXzI6OmxvY2FsZTo6X19nbG9iYWwoKe0HGnN0ZDo6X18yOjpsb2NhbGU6OmxvY2FsZSgp7gcuc3RkOjpfXzI6OmxvY2FsZTo6X19pbXA6Omhhc19mYWNldChsb25nKSBjb25zdO8HHnN0ZDo6X18yOjpsb2NhbGU6OmlkOjpfX2luaXQoKfAHjAF2b2lkIHN0ZDo6X18yOjpjYWxsX29uY2U8c3RkOjpfXzI6Oihhbm9ueW1vdXMgbmFtZXNwYWNlKTo6X19mYWtlX2JpbmQ+KHN0ZDo6X18yOjpvbmNlX2ZsYWcmLCBzdGQ6Ol9fMjo6KGFub255bW91cyBuYW1lc3BhY2UpOjpfX2Zha2VfYmluZCYmKfEHK3N0ZDo6X18yOjpsb2NhbGU6OmZhY2V0OjpfX29uX3plcm9fc2hhcmVkKCnyB2l2b2lkIHN0ZDo6X18yOjpfX2NhbGxfb25jZV9wcm94eTxzdGQ6Ol9fMjo6dHVwbGU8c3RkOjpfXzI6Oihhbm9ueW1vdXMgbmFtZXNwYWNlKTo6X19mYWtlX2JpbmQmJj4gPih2b2lkKinzBz5zdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD46OmRvX2lzKHVuc2lnbmVkIHNob3J0LCB3Y2hhcl90KSBjb25zdPQHVnN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90Pjo6ZG9faXMod2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqLCB1bnNpZ25lZCBzaG9ydCopIGNvbnN09Qdac3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+Ojpkb19zY2FuX2lzKHVuc2lnbmVkIHNob3J0LCB3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdCopIGNvbnN09gdbc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+Ojpkb19zY2FuX25vdCh1bnNpZ25lZCBzaG9ydCwgd2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqKSBjb25zdPcHM3N0ZDo6X18yOjpjdHlwZTx3Y2hhcl90Pjo6ZG9fdG91cHBlcih3Y2hhcl90KSBjb25zdPgHRHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90Pjo6ZG9fdG91cHBlcih3Y2hhcl90Kiwgd2NoYXJfdCBjb25zdCopIGNvbnN0+Qczc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+Ojpkb190b2xvd2VyKHdjaGFyX3QpIGNvbnN0+gdEc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+Ojpkb190b2xvd2VyKHdjaGFyX3QqLCB3Y2hhcl90IGNvbnN0KikgY29uc3T7By5zdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD46OmRvX3dpZGVuKGNoYXIpIGNvbnN0/AdMc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+Ojpkb193aWRlbihjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHdjaGFyX3QqKSBjb25zdP0HOHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90Pjo6ZG9fbmFycm93KHdjaGFyX3QsIGNoYXIpIGNvbnN0/gdWc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+Ojpkb19uYXJyb3cod2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqLCBjaGFyLCBjaGFyKikgY29uc3T/Bx9zdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj46On5jdHlwZSgpgAghc3RkOjpfXzI6OmN0eXBlPGNoYXI+Ojp+Y3R5cGUoKS4xgQgtc3RkOjpfXzI6OmN0eXBlPGNoYXI+Ojpkb190b3VwcGVyKGNoYXIpIGNvbnN0ggg7c3RkOjpfXzI6OmN0eXBlPGNoYXI+Ojpkb190b3VwcGVyKGNoYXIqLCBjaGFyIGNvbnN0KikgY29uc3SDCC1zdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj46OmRvX3RvbG93ZXIoY2hhcikgY29uc3SECDtzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj46OmRvX3RvbG93ZXIoY2hhciosIGNoYXIgY29uc3QqKSBjb25zdIUIRnN0ZDo6X18yOjpjdHlwZTxjaGFyPjo6ZG9fd2lkZW4oY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCBjaGFyKikgY29uc3SGCDJzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj46OmRvX25hcnJvdyhjaGFyLCBjaGFyKSBjb25zdIcITXN0ZDo6X18yOjpjdHlwZTxjaGFyPjo6ZG9fbmFycm93KGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgY2hhciwgY2hhciopIGNvbnN0iAiEAXN0ZDo6X18yOjpjb2RlY3Z0PGNoYXIsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9fb3V0KF9fbWJzdGF0ZV90JiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiYsIGNoYXIqLCBjaGFyKiwgY2hhciomKSBjb25zdIkIYHN0ZDo6X18yOjpjb2RlY3Z0PGNoYXIsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9fdW5zaGlmdChfX21ic3RhdGVfdCYsIGNoYXIqLCBjaGFyKiwgY2hhciomKSBjb25zdIoIcnN0ZDo6X18yOjpjb2RlY3Z0PGNoYXIsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9fbGVuZ3RoKF9fbWJzdGF0ZV90JiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBsb25nKSBjb25zdIsIO3N0ZDo6X18yOjpjb2RlY3Z0PHdjaGFyX3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6fmNvZGVjdnQoKS4xjAiQAXN0ZDo6X18yOjpjb2RlY3Z0PHdjaGFyX3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9fb3V0KF9fbWJzdGF0ZV90Jiwgd2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0KiYsIGNoYXIqLCBjaGFyKiwgY2hhciomKSBjb25zdI0IdXN0ZDo6X18yOjpfX2xpYmNwcF93Y3NucnRvbWJzX2woY2hhciosIHdjaGFyX3QgY29uc3QqKiwgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgX19tYnN0YXRlX3QqLCBfX2xvY2FsZV9zdHJ1Y3QqKY4ITHN0ZDo6X18yOjpfX2xpYmNwcF93Y3J0b21iX2woY2hhciosIHdjaGFyX3QsIF9fbWJzdGF0ZV90KiwgX19sb2NhbGVfc3RydWN0KimPCI8Bc3RkOjpfXzI6OmNvZGVjdnQ8d2NoYXJfdCwgY2hhciwgX19tYnN0YXRlX3Q+Ojpkb19pbihfX21ic3RhdGVfdCYsIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdComLCB3Y2hhcl90Kiwgd2NoYXJfdCosIHdjaGFyX3QqJikgY29uc3SQCHVzdGQ6Ol9fMjo6X19saWJjcHBfbWJzbnJ0b3djc19sKHdjaGFyX3QqLCBjaGFyIGNvbnN0KiosIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIF9fbWJzdGF0ZV90KiwgX19sb2NhbGVfc3RydWN0KimRCGJzdGQ6Ol9fMjo6X19saWJjcHBfbWJydG93Y19sKHdjaGFyX3QqLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgbG9uZywgX19tYnN0YXRlX3QqLCBfX2xvY2FsZV9zdHJ1Y3QqKZIIY3N0ZDo6X18yOjpjb2RlY3Z0PHdjaGFyX3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9fdW5zaGlmdChfX21ic3RhdGVfdCYsIGNoYXIqLCBjaGFyKiwgY2hhciomKSBjb25zdJMIQnN0ZDo6X18yOjpjb2RlY3Z0PHdjaGFyX3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9fZW5jb2RpbmcoKSBjb25zdJQIU3N0ZDo6X18yOjpfX2xpYmNwcF9tYnRvd2NfbCh3Y2hhcl90KiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGxvbmcsIF9fbG9jYWxlX3N0cnVjdCoplQgxc3RkOjpfXzI6Ol9fbGliY3BwX21iX2N1cl9tYXhfbChfX2xvY2FsZV9zdHJ1Y3QqKZYIdXN0ZDo6X18yOjpjb2RlY3Z0PHdjaGFyX3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9fbGVuZ3RoKF9fbWJzdGF0ZV90JiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBsb25nKSBjb25zdJcIV3N0ZDo6X18yOjpfX2xpYmNwcF9tYnJsZW5fbChjaGFyIGNvbnN0KiwgdW5zaWduZWQgbG9uZywgX19tYnN0YXRlX3QqLCBfX2xvY2FsZV9zdHJ1Y3QqKZgIRHN0ZDo6X18yOjpjb2RlY3Z0PHdjaGFyX3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9fbWF4X2xlbmd0aCgpIGNvbnN0mQiUAXN0ZDo6X18yOjpjb2RlY3Z0PGNoYXIxNl90LCBjaGFyLCBfX21ic3RhdGVfdD46OmRvX291dChfX21ic3RhdGVfdCYsIGNoYXIxNl90IGNvbnN0KiwgY2hhcjE2X3QgY29uc3QqLCBjaGFyMTZfdCBjb25zdComLCBjaGFyKiwgY2hhciosIGNoYXIqJikgY29uc3SaCLUBc3RkOjpfXzI6OnV0ZjE2X3RvX3V0ZjgodW5zaWduZWQgc2hvcnQgY29uc3QqLCB1bnNpZ25lZCBzaG9ydCBjb25zdCosIHVuc2lnbmVkIHNob3J0IGNvbnN0KiYsIHVuc2lnbmVkIGNoYXIqLCB1bnNpZ25lZCBjaGFyKiwgdW5zaWduZWQgY2hhciomLCB1bnNpZ25lZCBsb25nLCBzdGQ6Ol9fMjo6Y29kZWN2dF9tb2RlKZsIkwFzdGQ6Ol9fMjo6Y29kZWN2dDxjaGFyMTZfdCwgY2hhciwgX19tYnN0YXRlX3Q+Ojpkb19pbihfX21ic3RhdGVfdCYsIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdComLCBjaGFyMTZfdCosIGNoYXIxNl90KiwgY2hhcjE2X3QqJikgY29uc3ScCLUBc3RkOjpfXzI6OnV0ZjhfdG9fdXRmMTYodW5zaWduZWQgY2hhciBjb25zdCosIHVuc2lnbmVkIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBjaGFyIGNvbnN0KiYsIHVuc2lnbmVkIHNob3J0KiwgdW5zaWduZWQgc2hvcnQqLCB1bnNpZ25lZCBzaG9ydComLCB1bnNpZ25lZCBsb25nLCBzdGQ6Ol9fMjo6Y29kZWN2dF9tb2RlKZ0IdnN0ZDo6X18yOjpjb2RlY3Z0PGNoYXIxNl90LCBjaGFyLCBfX21ic3RhdGVfdD46OmRvX2xlbmd0aChfX21ic3RhdGVfdCYsIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgbG9uZykgY29uc3SeCIABc3RkOjpfXzI6OnV0ZjhfdG9fdXRmMTZfbGVuZ3RoKHVuc2lnbmVkIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgc3RkOjpfXzI6OmNvZGVjdnRfbW9kZSmfCEVzdGQ6Ol9fMjo6Y29kZWN2dDxjaGFyMTZfdCwgY2hhciwgX19tYnN0YXRlX3Q+Ojpkb19tYXhfbGVuZ3RoKCkgY29uc3SgCJQBc3RkOjpfXzI6OmNvZGVjdnQ8Y2hhcjMyX3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9fb3V0KF9fbWJzdGF0ZV90JiwgY2hhcjMyX3QgY29uc3QqLCBjaGFyMzJfdCBjb25zdCosIGNoYXIzMl90IGNvbnN0KiYsIGNoYXIqLCBjaGFyKiwgY2hhciomKSBjb25zdKEIrgFzdGQ6Ol9fMjo6dWNzNF90b191dGY4KHVuc2lnbmVkIGludCBjb25zdCosIHVuc2lnbmVkIGludCBjb25zdCosIHVuc2lnbmVkIGludCBjb25zdComLCB1bnNpZ25lZCBjaGFyKiwgdW5zaWduZWQgY2hhciosIHVuc2lnbmVkIGNoYXIqJiwgdW5zaWduZWQgbG9uZywgc3RkOjpfXzI6OmNvZGVjdnRfbW9kZSmiCJMBc3RkOjpfXzI6OmNvZGVjdnQ8Y2hhcjMyX3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9faW4oX19tYnN0YXRlX3QmLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqJiwgY2hhcjMyX3QqLCBjaGFyMzJfdCosIGNoYXIzMl90KiYpIGNvbnN0owiuAXN0ZDo6X18yOjp1dGY4X3RvX3VjczQodW5zaWduZWQgY2hhciBjb25zdCosIHVuc2lnbmVkIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBjaGFyIGNvbnN0KiYsIHVuc2lnbmVkIGludCosIHVuc2lnbmVkIGludCosIHVuc2lnbmVkIGludComLCB1bnNpZ25lZCBsb25nLCBzdGQ6Ol9fMjo6Y29kZWN2dF9tb2RlKaQIdnN0ZDo6X18yOjpjb2RlY3Z0PGNoYXIzMl90LCBjaGFyLCBfX21ic3RhdGVfdD46OmRvX2xlbmd0aChfX21ic3RhdGVfdCYsIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgbG9uZykgY29uc3SlCH9zdGQ6Ol9fMjo6dXRmOF90b191Y3M0X2xlbmd0aCh1bnNpZ25lZCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgY2hhciBjb25zdCosIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIHN0ZDo6X18yOjpjb2RlY3Z0X21vZGUppgglc3RkOjpfXzI6Om51bXB1bmN0PGNoYXI+Ojp+bnVtcHVuY3QoKacIJ3N0ZDo6X18yOjpudW1wdW5jdDxjaGFyPjo6fm51bXB1bmN0KCkuMagIKHN0ZDo6X18yOjpudW1wdW5jdDx3Y2hhcl90Pjo6fm51bXB1bmN0KCmpCCpzdGQ6Ol9fMjo6bnVtcHVuY3Q8d2NoYXJfdD46On5udW1wdW5jdCgpLjGqCDJzdGQ6Ol9fMjo6bnVtcHVuY3Q8Y2hhcj46OmRvX2RlY2ltYWxfcG9pbnQoKSBjb25zdKsIMnN0ZDo6X18yOjpudW1wdW5jdDxjaGFyPjo6ZG9fdGhvdXNhbmRzX3NlcCgpIGNvbnN0rAgtc3RkOjpfXzI6Om51bXB1bmN0PGNoYXI+Ojpkb19ncm91cGluZygpIGNvbnN0rQgwc3RkOjpfXzI6Om51bXB1bmN0PHdjaGFyX3Q+Ojpkb19ncm91cGluZygpIGNvbnN0rggtc3RkOjpfXzI6Om51bXB1bmN0PGNoYXI+Ojpkb190cnVlbmFtZSgpIGNvbnN0rwgwc3RkOjpfXzI6Om51bXB1bmN0PHdjaGFyX3Q+Ojpkb190cnVlbmFtZSgpIGNvbnN0sAh8c3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6YmFzaWNfc3RyaW5nKHdjaGFyX3QgY29uc3QqKbEILnN0ZDo6X18yOjpudW1wdW5jdDxjaGFyPjo6ZG9fZmFsc2VuYW1lKCkgY29uc3SyCDFzdGQ6Ol9fMjo6bnVtcHVuY3Q8d2NoYXJfdD46OmRvX2ZhbHNlbmFtZSgpIGNvbnN0swhtc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6b3BlcmF0b3I9KGNoYXIgY29uc3QqKbQINXN0ZDo6X18yOjpfX3RpbWVfZ2V0X2Nfc3RvcmFnZTxjaGFyPjo6X193ZWVrcygpIGNvbnN0tQgWc3RkOjpfXzI6OmluaXRfd2Vla3MoKbYIGl9fY3h4X2dsb2JhbF9hcnJheV9kdG9yLjU0twg4c3RkOjpfXzI6Ol9fdGltZV9nZXRfY19zdG9yYWdlPHdjaGFyX3Q+OjpfX3dlZWtzKCkgY29uc3S4CBdzdGQ6Ol9fMjo6aW5pdF93d2Vla3MoKbkIGl9fY3h4X2dsb2JhbF9hcnJheV9kdG9yLjY5ugh5c3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6b3BlcmF0b3I9KHdjaGFyX3QgY29uc3QqKbsINnN0ZDo6X18yOjpfX3RpbWVfZ2V0X2Nfc3RvcmFnZTxjaGFyPjo6X19tb250aHMoKSBjb25zdLwIF3N0ZDo6X18yOjppbml0X21vbnRocygpvQgaX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuODS+CDlzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8d2NoYXJfdD46Ol9fbW9udGhzKCkgY29uc3S/CBhzdGQ6Ol9fMjo6aW5pdF93bW9udGhzKCnACBtfX2N4eF9nbG9iYWxfYXJyYXlfZHRvci4xMDjBCDVzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8Y2hhcj46Ol9fYW1fcG0oKSBjb25zdMIIFnN0ZDo6X18yOjppbml0X2FtX3BtKCnDCBtfX2N4eF9nbG9iYWxfYXJyYXlfZHRvci4xMzLECDhzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8d2NoYXJfdD46Ol9fYW1fcG0oKSBjb25zdMUIF3N0ZDo6X18yOjppbml0X3dhbV9wbSgpxggbX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuMTM1xwgxc3RkOjpfXzI6Ol9fdGltZV9nZXRfY19zdG9yYWdlPGNoYXI+OjpfX3goKSBjb25zdMgIGV9fY3h4X2dsb2JhbF9hcnJheV9kdG9yLjHJCDRzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8d2NoYXJfdD46Ol9feCgpIGNvbnN0yggaX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuMzHLCDFzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8Y2hhcj46Ol9fWCgpIGNvbnN0zAgaX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuMzPNCDRzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8d2NoYXJfdD46Ol9fWCgpIGNvbnN0zggaX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuMzXPCDFzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8Y2hhcj46Ol9fYygpIGNvbnN00AgaX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuMzfRCDRzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8d2NoYXJfdD46Ol9fYygpIGNvbnN00ggaX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuMznTCDFzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8Y2hhcj46Ol9fcigpIGNvbnN01AgaX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuNDHVCDRzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8d2NoYXJfdD46Ol9fcigpIGNvbnN01ggaX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuNDPXCGlzdGQ6Ol9fMjo6dGltZV9wdXQ8Y2hhciwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6fnRpbWVfcHV0KCnYCGtzdGQ6Ol9fMjo6dGltZV9wdXQ8Y2hhciwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6fnRpbWVfcHV0KCkuMdkIeHN0ZDo6X18yOjp2ZWN0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4gPjo6bWF4X3NpemUoKSBjb25zdNoIqwFzdGQ6Ol9fMjo6YWxsb2NhdG9yX3RyYWl0czxzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4gPjo6YWxsb2NhdGUoc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+JiwgdW5zaWduZWQgbG9uZynbCIsBc3RkOjpfXzI6OnZlY3RvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiA+OjpfX2Fubm90YXRlX25ldyh1bnNpZ25lZCBsb25nKSBjb25zdNwIX3N0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPjo6YWxsb2NhdGUodW5zaWduZWQgbG9uZywgdm9pZCBjb25zdCop3Qg/c3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPjo6YWxsb2NhdGUodW5zaWduZWQgbG9uZywgdm9pZCBjb25zdCop3gjIAXN0ZDo6X18yOjphbGxvY2F0b3JfdHJhaXRzPHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiA+OjpkZWFsbG9jYXRlKHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiYsIHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiosIHVuc2lnbmVkIGxvbmcp3wibAXN0ZDo6X18yOjpfX3ZlY3Rvcl9iYXNlPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46Ol9fZGVzdHJ1Y3RfYXRfZW5kKHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiop4Agic3RkOjpfXzI6Ol9fdGltZV9wdXQ6Ol9fdGltZV9wdXQoKeEIiAFzdGQ6Ol9fMjo6dmVjdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46Ol9fcmVjb21tZW5kKHVuc2lnbmVkIGxvbmcpIGNvbnN04gjYAXN0ZDo6X18yOjpfX3NwbGl0X2J1ZmZlcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiY+OjpfX3NwbGl0X2J1ZmZlcih1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4mKeMIkQFzdGQ6Ol9fMjo6X19zcGxpdF9idWZmZXI8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4mPjo6X19jb25zdHJ1Y3RfYXRfZW5kKHVuc2lnbmVkIGxvbmcp5AjzAXN0ZDo6X18yOjp2ZWN0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4gPjo6X19zd2FwX291dF9jaXJjdWxhcl9idWZmZXIoc3RkOjpfXzI6Ol9fc3BsaXRfYnVmZmVyPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+Jj4mKeUIxgNzdGQ6Ol9fMjo6ZW5hYmxlX2lmPCgoc3RkOjpfXzI6OmludGVncmFsX2NvbnN0YW50PGJvb2wsIGZhbHNlPjo6dmFsdWUpIHx8ICghKF9faGFzX2NvbnN0cnVjdDxzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4sIGJvb2wqLCBib29sPjo6dmFsdWUpKSkgJiYgKGlzX3RyaXZpYWxseV9tb3ZlX2NvbnN0cnVjdGlibGU8Ym9vbD46OnZhbHVlKSwgdm9pZD46OnR5cGUgc3RkOjpfXzI6OmFsbG9jYXRvcl90cmFpdHM8c3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46Ol9fY29uc3RydWN0X2JhY2t3YXJkPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kj4oc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+JiwgYm9vbCosIGJvb2wqLCBib29sKiYp5gh8c3RkOjpfXzI6Ol9fY29tcHJlc3NlZF9wYWlyPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiY+OjpzZWNvbmQoKecIxgFzdGQ6Ol9fMjo6X19zcGxpdF9idWZmZXI8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4mPjo6X19kZXN0cnVjdF9hdF9lbmQoc3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqKiwgc3RkOjpfXzI6OmludGVncmFsX2NvbnN0YW50PGJvb2wsIGZhbHNlPinoCEBzdGQ6Ol9fMjo6KGFub255bW91cyBuYW1lc3BhY2UpOjpfX2Zha2VfYmluZDo6b3BlcmF0b3IoKSgpIGNvbnN06QhCc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90Pjo6YWxsb2NhdGUodW5zaWduZWQgbG9uZywgdm9pZCBjb25zdCop6ghrc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6X19jbGVhcl9hbmRfc2hyaW5rKCnrCHRzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+OjpfX2NsZWFyX2FuZF9zaHJpbmsoKewIQ2xvbmcgZG91YmxlIHN0ZDo6X18yOjpfX2RvX3N0cnRvZDxsb25nIGRvdWJsZT4oY2hhciBjb25zdCosIGNoYXIqKintCC1zdGQ6Ol9fMjo6X19zaGFyZWRfY291bnQ6On5fX3NoYXJlZF9jb3VudCgpLjHuCC9zdGQ6Ol9fMjo6X19zaGFyZWRfd2Vha19jb3VudDo6X19yZWxlYXNlX3dlYWsoKe8ISXN0ZDo6X18yOjpfX3NoYXJlZF93ZWFrX2NvdW50OjpfX2dldF9kZWxldGVyKHN0ZDo6dHlwZV9pbmZvIGNvbnN0JikgY29uc3TwCEZzdGQ6Ol9fMjo6X19jYWxsX29uY2UodW5zaWduZWQgbG9uZyB2b2xhdGlsZSYsIHZvaWQqLCB2b2lkICgqKSh2b2lkKikp8Qgbb3BlcmF0b3IgbmV3KHVuc2lnbmVkIGxvbmcp8gg9c3RkOjpfXzI6Ol9fbGliY3BwX3JlZnN0cmluZzo6X19saWJjcHBfcmVmc3RyaW5nKGNoYXIgY29uc3QqKfMIB3dtZW1zZXT0CAh3bWVtbW92ZfUIQ3N0ZDo6X18yOjpfX2Jhc2ljX3N0cmluZ19jb21tb248dHJ1ZT46Ol9fdGhyb3dfbGVuZ3RoX2Vycm9yKCkgY29uc3T2CMEBc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6YmFzaWNfc3RyaW5nKHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QmKfcIeXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46Ol9faW5pdChjaGFyIGNvbnN0KiwgdW5zaWduZWQgbG9uZyn4CGZzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+Ojp+YmFzaWNfc3RyaW5nKCn5CHlzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+Ojphc3NpZ24oY2hhciBjb25zdCosIHVuc2lnbmVkIGxvbmcp+gjTAXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46Ol9fZ3Jvd19ieV9hbmRfcmVwbGFjZSh1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCBjaGFyIGNvbnN0Kin7CHJzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpyZXNpemUodW5zaWduZWQgbG9uZywgY2hhcin8CHJzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjphcHBlbmQodW5zaWduZWQgbG9uZywgY2hhcin9CHRzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpfX2VyYXNlX3RvX2VuZCh1bnNpZ25lZCBsb25nKf4IugFzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpfX2dyb3dfYnkodW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZyn/CD9zdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj46OmFzc2lnbihjaGFyKiwgdW5zaWduZWQgbG9uZywgY2hhcimACXlzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjphcHBlbmQoY2hhciBjb25zdCosIHVuc2lnbmVkIGxvbmcpgQlmc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6cHVzaF9iYWNrKGNoYXIpgglyc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6X19pbml0KHVuc2lnbmVkIGxvbmcsIGNoYXIpgwmFAXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID46Ol9faW5pdCh3Y2hhcl90IGNvbnN0KiwgdW5zaWduZWQgbG9uZymECYUBc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6YXNzaWduKHdjaGFyX3QgY29uc3QqLCB1bnNpZ25lZCBsb25nKYUJ3wFzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+OjpfX2dyb3dfYnlfYW5kX3JlcGxhY2UodW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgd2NoYXJfdCBjb25zdCophgnDAXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID46Ol9fZ3Jvd19ieSh1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nKYcJhQFzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+OjphcHBlbmQod2NoYXJfdCBjb25zdCosIHVuc2lnbmVkIGxvbmcpiAlyc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6cHVzaF9iYWNrKHdjaGFyX3QpiQl+c3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6X19pbml0KHVuc2lnbmVkIGxvbmcsIHdjaGFyX3QpiglCc3RkOjpfXzI6Ol9fdmVjdG9yX2Jhc2VfY29tbW9uPHRydWU+OjpfX3Rocm93X2xlbmd0aF9lcnJvcigpIGNvbnN0iwkNYWJvcnRfbWVzc2FnZYwJEl9fY3hhX3B1cmVfdmlydHVhbI0JHHN0ZDo6ZXhjZXB0aW9uOjp3aGF0KCkgY29uc3SOCSBzdGQ6OmxvZ2ljX2Vycm9yOjp+bG9naWNfZXJyb3IoKY8JM3N0ZDo6X18yOjpfX2xpYmNwcF9yZWZzdHJpbmc6On5fX2xpYmNwcF9yZWZzdHJpbmcoKZAJInN0ZDo6bG9naWNfZXJyb3I6On5sb2dpY19lcnJvcigpLjGRCSJzdGQ6Omxlbmd0aF9lcnJvcjo6fmxlbmd0aF9lcnJvcigpkgkbc3RkOjpiYWRfY2FzdDo6d2hhdCgpIGNvbnN0kwlhX19jeHhhYml2MTo6X19mdW5kYW1lbnRhbF90eXBlX2luZm86OmNhbl9jYXRjaChfX2N4eGFiaXYxOjpfX3NoaW1fdHlwZV9pbmZvIGNvbnN0Kiwgdm9pZComKSBjb25zdJQJPGlzX2VxdWFsKHN0ZDo6dHlwZV9pbmZvIGNvbnN0Kiwgc3RkOjp0eXBlX2luZm8gY29uc3QqLCBib29sKZUJW19fY3h4YWJpdjE6Ol9fY2xhc3NfdHlwZV9pbmZvOjpjYW5fY2F0Y2goX19jeHhhYml2MTo6X19zaGltX3R5cGVfaW5mbyBjb25zdCosIHZvaWQqJikgY29uc3SWCQ5fX2R5bmFtaWNfY2FzdJcJa19fY3h4YWJpdjE6Ol9fY2xhc3NfdHlwZV9pbmZvOjpwcm9jZXNzX2ZvdW5kX2Jhc2VfY2xhc3MoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQqLCBpbnQpIGNvbnN0mAluX19jeHhhYml2MTo6X19jbGFzc190eXBlX2luZm86Omhhc191bmFtYmlndW91c19wdWJsaWNfYmFzZShfX2N4eGFiaXYxOjpfX2R5bmFtaWNfY2FzdF9pbmZvKiwgdm9pZCosIGludCkgY29uc3SZCXFfX2N4eGFiaXYxOjpfX3NpX2NsYXNzX3R5cGVfaW5mbzo6aGFzX3VuYW1iaWd1b3VzX3B1YmxpY19iYXNlKF9fY3h4YWJpdjE6Ol9fZHluYW1pY19jYXN0X2luZm8qLCB2b2lkKiwgaW50KSBjb25zdJoJc19fY3h4YWJpdjE6Ol9fYmFzZV9jbGFzc190eXBlX2luZm86Omhhc191bmFtYmlndW91c19wdWJsaWNfYmFzZShfX2N4eGFiaXYxOjpfX2R5bmFtaWNfY2FzdF9pbmZvKiwgdm9pZCosIGludCkgY29uc3SbCXJfX2N4eGFiaXYxOjpfX3ZtaV9jbGFzc190eXBlX2luZm86Omhhc191bmFtYmlndW91c19wdWJsaWNfYmFzZShfX2N4eGFiaXYxOjpfX2R5bmFtaWNfY2FzdF9pbmZvKiwgdm9pZCosIGludCkgY29uc3ScCVtfX2N4eGFiaXYxOjpfX3BiYXNlX3R5cGVfaW5mbzo6Y2FuX2NhdGNoKF9fY3h4YWJpdjE6Ol9fc2hpbV90eXBlX2luZm8gY29uc3QqLCB2b2lkKiYpIGNvbnN0nQldX19jeHhhYml2MTo6X19wb2ludGVyX3R5cGVfaW5mbzo6Y2FuX2NhdGNoKF9fY3h4YWJpdjE6Ol9fc2hpbV90eXBlX2luZm8gY29uc3QqLCB2b2lkKiYpIGNvbnN0nglcX19jeHhhYml2MTo6X19wb2ludGVyX3R5cGVfaW5mbzo6Y2FuX2NhdGNoX25lc3RlZChfX2N4eGFiaXYxOjpfX3NoaW1fdHlwZV9pbmZvIGNvbnN0KikgY29uc3SfCWZfX2N4eGFiaXYxOjpfX3BvaW50ZXJfdG9fbWVtYmVyX3R5cGVfaW5mbzo6Y2FuX2NhdGNoX25lc3RlZChfX2N4eGFiaXYxOjpfX3NoaW1fdHlwZV9pbmZvIGNvbnN0KikgY29uc3SgCYMBX19jeHhhYml2MTo6X19jbGFzc190eXBlX2luZm86OnByb2Nlc3Nfc3RhdGljX3R5cGVfYWJvdmVfZHN0KF9fY3h4YWJpdjE6Ol9fZHluYW1pY19jYXN0X2luZm8qLCB2b2lkIGNvbnN0Kiwgdm9pZCBjb25zdCosIGludCkgY29uc3ShCXNfX2N4eGFiaXYxOjpfX3ZtaV9jbGFzc190eXBlX2luZm86OnNlYXJjaF9iZWxvd19kc3QoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQgY29uc3QqLCBpbnQsIGJvb2wpIGNvbnN0ogmBAV9fY3h4YWJpdjE6Ol9fYmFzZV9jbGFzc190eXBlX2luZm86OnNlYXJjaF9hYm92ZV9kc3QoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQgY29uc3QqLCB2b2lkIGNvbnN0KiwgaW50LCBib29sKSBjb25zdKMJdF9fY3h4YWJpdjE6Ol9fYmFzZV9jbGFzc190eXBlX2luZm86OnNlYXJjaF9iZWxvd19kc3QoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQgY29uc3QqLCBpbnQsIGJvb2wpIGNvbnN0pAlyX19jeHhhYml2MTo6X19zaV9jbGFzc190eXBlX2luZm86OnNlYXJjaF9iZWxvd19kc3QoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQgY29uc3QqLCBpbnQsIGJvb2wpIGNvbnN0pQlvX19jeHhhYml2MTo6X19jbGFzc190eXBlX2luZm86OnNlYXJjaF9iZWxvd19kc3QoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQgY29uc3QqLCBpbnQsIGJvb2wpIGNvbnN0pgmAAV9fY3h4YWJpdjE6Ol9fdm1pX2NsYXNzX3R5cGVfaW5mbzo6c2VhcmNoX2Fib3ZlX2RzdChfX2N4eGFiaXYxOjpfX2R5bmFtaWNfY2FzdF9pbmZvKiwgdm9pZCBjb25zdCosIHZvaWQgY29uc3QqLCBpbnQsIGJvb2wpIGNvbnN0pwl/X19jeHhhYml2MTo6X19zaV9jbGFzc190eXBlX2luZm86OnNlYXJjaF9hYm92ZV9kc3QoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQgY29uc3QqLCB2b2lkIGNvbnN0KiwgaW50LCBib29sKSBjb25zdKgJfF9fY3h4YWJpdjE6Ol9fY2xhc3NfdHlwZV9pbmZvOjpzZWFyY2hfYWJvdmVfZHN0KF9fY3h4YWJpdjE6Ol9fZHluYW1pY19jYXN0X2luZm8qLCB2b2lkIGNvbnN0Kiwgdm9pZCBjb25zdCosIGludCwgYm9vbCkgY29uc3SpCQhfX3N0cmR1cKoJDV9fZ2V0VHlwZU5hbWWrCSpfX2VtYmluZF9yZWdpc3Rlcl9uYXRpdmVfYW5kX2J1aWx0aW5fdHlwZXOsCT92b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfaW50ZWdlcjxjaGFyPihjaGFyIGNvbnN0KimtCUZ2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfaW50ZWdlcjxzaWduZWQgY2hhcj4oY2hhciBjb25zdCoprglIdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX2ludGVnZXI8dW5zaWduZWQgY2hhcj4oY2hhciBjb25zdCoprwlAdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX2ludGVnZXI8c2hvcnQ+KGNoYXIgY29uc3QqKbAJSXZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9pbnRlZ2VyPHVuc2lnbmVkIHNob3J0PihjaGFyIGNvbnN0KimxCT52b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfaW50ZWdlcjxpbnQ+KGNoYXIgY29uc3QqKbIJR3ZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9pbnRlZ2VyPHVuc2lnbmVkIGludD4oY2hhciBjb25zdCopswk/dm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX2ludGVnZXI8bG9uZz4oY2hhciBjb25zdCoptAlIdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX2ludGVnZXI8dW5zaWduZWQgbG9uZz4oY2hhciBjb25zdCoptQk+dm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX2Zsb2F0PGZsb2F0PihjaGFyIGNvbnN0Kim2CT92b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfZmxvYXQ8ZG91YmxlPihjaGFyIGNvbnN0Kim3CUN2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfbWVtb3J5X3ZpZXc8Y2hhcj4oY2hhciBjb25zdCopuAlKdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX21lbW9yeV92aWV3PHNpZ25lZCBjaGFyPihjaGFyIGNvbnN0Kim5CUx2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfbWVtb3J5X3ZpZXc8dW5zaWduZWQgY2hhcj4oY2hhciBjb25zdCopuglEdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX21lbW9yeV92aWV3PHNob3J0PihjaGFyIGNvbnN0Kim7CU12b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfbWVtb3J5X3ZpZXc8dW5zaWduZWQgc2hvcnQ+KGNoYXIgY29uc3QqKbwJQnZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9tZW1vcnlfdmlldzxpbnQ+KGNoYXIgY29uc3QqKb0JS3ZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9tZW1vcnlfdmlldzx1bnNpZ25lZCBpbnQ+KGNoYXIgY29uc3QqKb4JQ3ZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9tZW1vcnlfdmlldzxsb25nPihjaGFyIGNvbnN0Kim/CUx2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfbWVtb3J5X3ZpZXc8dW5zaWduZWQgbG9uZz4oY2hhciBjb25zdCopwAlEdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX21lbW9yeV92aWV3PGZsb2F0PihjaGFyIGNvbnN0KinBCUV2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfbWVtb3J5X3ZpZXc8ZG91YmxlPihjaGFyIGNvbnN0KinCCW5FbXNjcmlwdGVuQmluZGluZ0luaXRpYWxpemVyX25hdGl2ZV9hbmRfYnVpbHRpbl90eXBlczo6RW1zY3JpcHRlbkJpbmRpbmdJbml0aWFsaXplcl9uYXRpdmVfYW5kX2J1aWx0aW5fdHlwZXMoKcMJCGRsbWFsbG9jxAkGZGxmcmVlxQkJZGxyZWFsbG9jxgkRdHJ5X3JlYWxsb2NfY2h1bmvHCQ1kaXNwb3NlX2NodW5ryAkEc2Jya8kJBGZtb2TKCQVmbW9kbMsJBWxvZzEwzAkGbG9nMTBmzQkGc2NhbGJuzgkNX19mcGNsYXNzaWZ5bM8JBm1lbWNwedAJBm1lbXNldNEJB21lbW1vdmXSCQhzZXRUaHJld9MJCXN0YWNrU2F2ZdQJCnN0YWNrQWxsb2PVCQxzdGFja1Jlc3RvcmXWCRBfX2dyb3dXYXNtTWVtb3J51wkLZHluQ2FsbF92aWnYCQ1keW5DYWxsX3ZpaWlp2QkLZHluQ2FsbF9kaWTaCQxkeW5DYWxsX2RpaWTbCQ1keW5DYWxsX2RpZGRk3AkOZHluQ2FsbF9kaWlkZGTdCQxkeW5DYWxsX2RpZGTeCQ1keW5DYWxsX2RpaWRk3wkLZHluQ2FsbF9kaWngCQtkeW5DYWxsX3ZpZOEJDGR5bkNhbGxfdmlpZOIJDGR5bkNhbGxfZGlpaeMJDWR5bkNhbGxfZGlpaWnkCQ1keW5DYWxsX3ZpaWlk5QkNZHluQ2FsbF9kaWRpZOYJDmR5bkNhbGxfZGlpZGlk5wkOZHluQ2FsbF9kaWRpZGnoCQ9keW5DYWxsX2RpaWRpZGnpCQ1keW5DYWxsX3ZpZGlk6gkOZHluQ2FsbF92aWlkaWTrCQ5keW5DYWxsX3ZpZGlkZOwJD2R5bkNhbGxfdmlpZGlkZO0JD2R5bkNhbGxfdmlkaWRkZO4JEGR5bkNhbGxfdmlpZGlkZGTvCQ5keW5DYWxsX3ZpZGRkafAJD2R5bkNhbGxfdmlpZGRkafEJDWR5bkNhbGxfaWlpaWTyCQxkeW5DYWxsX3ZpZGTzCQ1keW5DYWxsX3ZpaWRk9AkNZHluQ2FsbF9paWlpafUJDmR5bkNhbGxfdmlmZmlp9gkPZHluQ2FsbF92aWlmZmlp9wkPZHluQ2FsbF9kaWRkaWRk+AkQZHluQ2FsbF9kaWlkZGlkZPkJD2R5bkNhbGxfZGlkZGRkZPoJEGR5bkNhbGxfZGlpZGRkZGT7CQ9keW5DYWxsX2RpZGRkaWn8CRBkeW5DYWxsX2RpaWRkZGlp/QkRZHluQ2FsbF9kaWRkZGRkaWn+CRJkeW5DYWxsX2RpaWRkZGRkaWn/CQxkeW5DYWxsX2RpZGmACg1keW5DYWxsX2RpaWRpgQoPZHluQ2FsbF9kaWRpZGRkggoQZHluQ2FsbF9kaWlkaWRkZIMKDWR5bkNhbGxfZGlkZGmECg5keW5DYWxsX2RpaWRkaYUKDGR5bkNhbGxfdmlkaYYKDWR5bkNhbGxfdmlpZGmHCg5keW5DYWxsX3ZpaWlpaYgKDGR5bkNhbGxfaWlmaYkKDWR5bkNhbGxfaWlpZmmKCgpkeW5DYWxsX2ZpiwoLZHluQ2FsbF9maWmMCg1keW5DYWxsX2ZpaWlpjQoOZHluQ2FsbF9maWlpaWmOCg9keW5DYWxsX3ZpaWlpZGSPChBkeW5DYWxsX3ZpaWlpaWRkkAoMZHluQ2FsbF92aWlmkQoNZHluQ2FsbF92aWlpZpIKDWR5bkNhbGxfaWlpaWaTCg5keW5DYWxsX2RpZGRpZJQKD2R5bkNhbGxfZGlpZGRpZJUKD2R5bkNhbGxfZGlkZGRpZJYKEGR5bkNhbGxfZGlpZGRkaWSXCg5keW5DYWxsX2RpZGRkaZgKD2R5bkNhbGxfZGlpZGRkaZkKC2R5bkNhbGxfaWlkmgoNZHluQ2FsbF9kaWRpaZsKDmR5bkNhbGxfZGlpZGlpnAoPZHluQ2FsbF9paWRpaWlpnQoOZHluQ2FsbF9paWlpaWmeChFkeW5DYWxsX2lpaWlpaWlpaZ8KD2R5bkNhbGxfaWlpaWlpaaAKDmR5bkNhbGxfaWlpaWlkoQoQZHluQ2FsbF9paWlpaWlpaaIKD2R5bkNhbGxfdmlpaWlpaaMKCWR5bkNhbGxfdqQKGGxlZ2Fsc3R1YiRkeW5DYWxsX3ZpaWppaaUKFmxlZ2Fsc3R1YiRkeW5DYWxsX2ppammmChhsZWdhbHN0dWIkZHluQ2FsbF9paWlpaWqnChlsZWdhbHN0dWIkZHluQ2FsbF9paWlpaWpqqAoabGVnYWxzdHViJGR5bkNhbGxfaWlpaWlpamoAdRBzb3VyY2VNYXBwaW5nVVJMY2h0dHA6Ly9sb2NhbGhvc3Q6OTAwMC9hdWRpby13b3JrbGV0L2J1aWxkL3t7eyBGSUxFTkFNRV9SRVBMQUNFTUVOVF9TVFJJTkdTX1dBU01fQklOQVJZX0ZJTEUgfX19Lm1hcA==';
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




// STATICTOP = STATIC_BASE + 52912;
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
      return 53776;
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
var _$pstr=new Uint8Array([77,97,120,105,109,105,108,105,97,110,32,50,32,45,32,74,97,118,97,115,99,114,105,112,116,32,84,114,97,110,115,112,105,108,101,0]);
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
maxiTrigger.promise=
maxiMap.promise=
maxiNonlinearity.promise=
Promise.resolve();
__Z7webMainv();
//bindings- intended to mix this source in with the emscripten modules
Module.maxiMap = maxiMap;
Module.maxiTrigger = maxiTrigger;
Module.maxiNonlinearity = maxiNonlinearity;

