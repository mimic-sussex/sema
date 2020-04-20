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
  'initial': 985,
  'maximum': 985 + 0,
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
    STACK_BASE = 5297392,
    STACKTOP = STACK_BASE,
    STACK_MAX = 54512,
    DYNAMIC_BASE = 5297392,
    DYNAMICTOP_PTR = 54352;




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




var wasmBinaryFile = 'data:application/octet-stream;base64,AGFzbQEAAAAB9gqjAWABfwF/YAF/AGACf38AYAJ/fwF/YAN/f38Bf2ADf39/AGAFf39/f38Bf2AAAGAEf39/fwF/YAZ/f39/f38Bf2AFf39/f38AYAR/f39/AGAAAX9gBn9/f39/fwBgCH9/f39/f39/AX9gAn98AGABfwF8YAJ/fAF8YAN/fHwBfGACfHwBfGAEf3x8fAF8YAd/f39/f39/AX9gAXwBfGAHf39/f39/fwBgAn9/AXxgBH9/f3wAYAN/f3wAYAV/fn5+fgBgA39+fwF+YAF9AX1gA39/fwF8YAR/fHx/AXxgBn98fHx8fAF8YAp/f39/f39/f39/AGADf3x/AGAFf39/f34Bf2ADf3x/AXxgBXx8fHx8AXxgBX9/fn9/AGAGf398fHx/AGAFf39/f3wBf2AEf39/fwF+YAF/AX1gAn9/AX1gBH9/fH8BfGAFf398fH8BfGAGf3x/fHx8AXxgBX98fH98AXxgBX98fHx/AXxgA3x8fAF8YAh/f39/f39/fwBgB39/f39/fHwAYAZ/f39/fHwAYAR/f399AGAGf399fX9/AGAEf398fwBgBX9/fH98AGAGf398f3x8AGAHf398f3x8fABgBH9/fHwAYAR/fn5/AGAFf319f38AYAR/fH98AGAFf3x/fHwAYAZ/fH98fHwAYAN/fHwAYAV/fHx8fwBgCn9/f39/f39/f38Bf2AHf39/f39+fgF/YAZ/f39/fn4Bf2AEf39/fAF/YAR/f31/AX9gA399fwF/YAZ/fH9/f38Bf2AEf39/fwF9YAV/f39/fwF9YAR/f39/AXxgA39/fAF8YAV/f3x/fwF8YAV/f3x/fAF8YAZ/f3x/fH8BfGAHf398f3x8fAF8YAR/f3x8AXxgBn9/fHx/fAF8YAd/f3x8f3x8AXxgBX9/fHx8AXxgBn9/fHx8fwF8YAd/f3x8fH9/AXxgB39/fHx8f3wBfGAHf398fHx8fAF8YAl/f3x8fHx8f38BfGAEf3x/fwF8YAR/fH98AXxgBX98f3x/AXxgBn98fH98fAF8YAZ/fHx8f38BfGAGf3x8fH98AXxgCH98fHx8fH9/AXxgD39/f39/f39/f39/f39/fwBgA39/fQBgAn9+AGAJf39/f39/f39/AX9gC39/f39/f39/f39/AX9gDH9/f39/f39/f39/fwF/YAR/f399AX9gA39+fwF/YAJ/fAF/YAJ+fwF/YAJ+fgF/YAF8AX9gAX8BfmAEf39/fgF+YAN/f38BfWACfX8BfWABfAF9YAJ8fwF8YAN8fH8BfGAMf39/f39/f39/f39/AGANf39/f39/f39/f39/fwBgCH9/f39/f3x8AGAFf39/f30AYAV/f39/fABgB39/f319f38AYAV/f398fwBgBn9/f3x/fABgB39/f3x/fHwAYAh/f398f3x8fABgBX9/f3x8AGAHf39/fHx8fwBgA39/fgBgA39+fgBgAn99AGAGf39/f398AX9gBX9/f399AX9gBX9/f31/AX9gA39/fAF/YAd/f3x/f39/AX9gA35/fwF/YAR+fn5+AX9gAn1/AX9gAnx/AX9gAn9/AX5gBn9/f39/fwF9YAJ+fgF9YAJ9fQF9YAV/f39/fwF8YAR/f398AXxgBX9/f3x/AXxgBn9/f3x/fwF8YAZ/f398f3wBfGAHf39/fH98fwF8YAh/f398f3x8fAF8YAV/f398fAF8YAZ/f398fH8BfGAHf39/fHx/fAF8YAh/f398fH98fAF8YAZ/f398fHwBfGAHf39/fHx8fwF8YAh/f398fHx/fwF8YAh/f398fHx/fAF8YAh/f398fHx8fAF8YAp/f398fHx8fH9/AXxgAn5+AXwClgktA2VudhZfZW1iaW5kX3JlZ2lzdGVyX2NsYXNzAHYDZW52Il9lbWJpbmRfcmVnaXN0ZXJfY2xhc3NfY29uc3RydWN0b3IADQNlbnYlX2VtYmluZF9yZWdpc3Rlcl9jbGFzc19jbGFzc19mdW5jdGlvbgAXA2Vudh9fZW1iaW5kX3JlZ2lzdGVyX2NsYXNzX3Byb3BlcnR5ACEDZW52H19lbWJpbmRfcmVnaXN0ZXJfY2xhc3NfZnVuY3Rpb24AMgNlbnYVX2VtYmluZF9yZWdpc3Rlcl9lbnVtAAsDZW52G19lbWJpbmRfcmVnaXN0ZXJfZW51bV92YWx1ZQAFA2VudhpfZW1iaW5kX3JlZ2lzdGVyX3NtYXJ0X3B0cgB1A2VudhhfX2N4YV9hbGxvY2F0ZV9leGNlcHRpb24AAANlbnYLX19jeGFfdGhyb3cABQNlbnYRX2VtdmFsX3Rha2VfdmFsdWUAAwNlbnYNX2VtdmFsX2luY3JlZgABA2Vudg1fZW12YWxfZGVjcmVmAAEDZW52C19lbXZhbF9jYWxsAAgDZW52BXJvdW5kABYDZW52BGV4aXQAAQNlbnYNX19hc3NlcnRfZmFpbAALA2VudgZfX2xvY2sAAQNlbnYIX191bmxvY2sAARZ3YXNpX3NuYXBzaG90X3ByZXZpZXcxCGZkX2Nsb3NlAAADZW52Cl9fc3lzY2FsbDUAAwNlbnYMX19zeXNjYWxsMjIxAAMDZW52C19fc3lzY2FsbDU0AAMWd2FzaV9zbmFwc2hvdF9wcmV2aWV3MQdmZF9yZWFkAAgWd2FzaV9zbmFwc2hvdF9wcmV2aWV3MQhmZF93cml0ZQAIFndhc2lfc25hcHNob3RfcHJldmlldzERZW52aXJvbl9zaXplc19nZXQAAxZ3YXNpX3NuYXBzaG90X3ByZXZpZXcxC2Vudmlyb25fZ2V0AAMDZW52Cl9fbWFwX2ZpbGUAAwNlbnYLX19zeXNjYWxsOTEAAwNlbnYKc3RyZnRpbWVfbAAGA2VudgVhYm9ydAAHA2VudhVfZW1iaW5kX3JlZ2lzdGVyX3ZvaWQAAgNlbnYVX2VtYmluZF9yZWdpc3Rlcl9ib29sAAoDZW52G19lbWJpbmRfcmVnaXN0ZXJfc3RkX3N0cmluZwACA2VudhxfZW1iaW5kX3JlZ2lzdGVyX3N0ZF93c3RyaW5nAAUDZW52Fl9lbWJpbmRfcmVnaXN0ZXJfZW12YWwAAgNlbnYYX2VtYmluZF9yZWdpc3Rlcl9pbnRlZ2VyAAoDZW52Fl9lbWJpbmRfcmVnaXN0ZXJfZmxvYXQABQNlbnYcX2VtYmluZF9yZWdpc3Rlcl9tZW1vcnlfdmlldwAFA2VudhZlbXNjcmlwdGVuX3Jlc2l6ZV9oZWFwAAADZW52FWVtc2NyaXB0ZW5fbWVtY3B5X2JpZwAEA2VudgtzZXRUZW1wUmV0MAABFndhc2lfc25hcHNob3RfcHJldmlldzEHZmRfc2VlawAGA2VudgZtZW1vcnkCAIAQA2VudgV0YWJsZQFwANkHA7UKkAoHBwcHBwcHAAEADAIBAAsFAAIDBQACAAIADE1VUhgaAAxMGRAPAAIADE9QAAwQDxAPAAw4OToADBFCJw8AAEYZFDEADEE7DxAQDxAPDwABDAALCAIBNggAJSAlJTEUIAAMVFkADFdaLAACABgY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X2RpZGlkAPcJDmR5bkNhbGxfZGlpZGlkAPgJDmR5bkNhbGxfZGlkaWRpAPkJD2R5bkNhbGxfZGlpZGlkaQD6CQ1keW5DYWxsX3ZpZGlkAPsJDmR5bkNhbGxfdmlpZGlkAPwJDmR5bkNhbGxfdmlkaWRkAP0JD2R5bkNhbGxfdmlpZGlkZAD+CQ9keW5DYWxsX3ZpZGlkZGQA/wkQZHluQ2FsbF92aWlkaWRkZACACg5keW5DYWxsX3ZpZGRkaQCBCg9keW5DYWxsX3ZpaWRkZGkAggoNZHluQ2FsbF9paWlpZACDCgxkeW5DYWxsX2RkZGQAawxkeW5DYWxsX3ZpZGQAhAoNZHluQ2FsbF92aWlkZACFCgxkeW5DYWxsX2lpaWkAywINZHluQ2FsbF9paWlpaQCGCg5keW5DYWxsX3ZpZmZpaQCHCg9keW5DYWxsX3ZpaWZmaWkAiAoOZHluQ2FsbF9kZGRkZGQAiQEPZHluQ2FsbF9kaWRkZGRkAIkKD2R5bkNhbGxfZGlkZGlkZACKChBkeW5DYWxsX2RpaWRkaWRkAIsKEGR5bkNhbGxfZGlpZGRkZGQAjAoPZHluQ2FsbF9kaWRkZGlpAI0KEGR5bkNhbGxfZGlpZGRkaWkAjgoRZHluQ2FsbF9kaWRkZGRkaWkAjwoSZHluQ2FsbF9kaWlkZGRkZGlpAJAKDGR5bkNhbGxfZGlkaQCRCg1keW5DYWxsX2RpaWRpAJIKCmR5bkNhbGxfZGQAmgEPZHluQ2FsbF9kaWRpZGRkAJMKEGR5bkNhbGxfZGlpZGlkZGQAlAoLZHluQ2FsbF9kZGQAtQENZHluQ2FsbF9kaWRkaQCVCg5keW5DYWxsX2RpaWRkaQCWCgxkeW5DYWxsX3ZpZGkAlwoNZHluQ2FsbF92aWlkaQCYCg5keW5DYWxsX3ZpaWlpaQCZCgxkeW5DYWxsX2lpZmkAmgoNZHluQ2FsbF9paWlmaQCbCgpkeW5DYWxsX2ZpAJwKC2R5bkNhbGxfZmlpAJ0KDWR5bkNhbGxfZmlpaWkAngoOZHluQ2FsbF9maWlpaWkAnwoPZHluQ2FsbF92aWlpaWRkAKAKEGR5bkNhbGxfdmlpaWlpZGQAoQoMZHluQ2FsbF92aWlmAKIKDWR5bkNhbGxfdmlpaWYAowoNZHluQ2FsbF9paWlpZgCkCg5k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gICAgICAgPA/NwMAIAALIQAgACACOQMQIAAgATkDACAARAAAAAAAAPA/IAGhOQMICzkBAX8gASAAKAIEIgRBAXVqIQEgACgCACEAIAEgAiADIARBAXEEfyABKAIAIABqKAIABSAACxFBAAsbACAAIAArAwAgAaIgACsDCCAAKwMQoqA5AxALBwAgACsDEAsHACAAKwMACwkAIAAgATkDAAsHACAAKwMICwkAIAAgATkDCAsJACAAIAE5AxALBQBBzDELNwEBfyAABEAgACgCbCIBBEAgACABNgJwIAEQ1gkLIAAsAAtBf0wEQCAAKAIAENYJCyAAENYJCwuJAQECf0GIARCDCSIAQgA3AgAgAEIANwMoIABBATsBYCAAQgA3A1ggAEKAgICAgICA8D83A1AgAEKAgICAgICA8D83A0ggAEEANgIIIABCADcDMEH0hgIoAgAhASAAQQA2AnQgAEEBOgCAASAAQoCAgICAgID4PzcDeCAAQgA3AmwgACABNgJkIAALEAAgACgCcCAAKAJsa0EDdQs5AQF/IAEgACgCBCIEQQF1aiEBIAAoAgAhACABIAIgAyAEQQFxBH8gASgCACAAaigCAAUgAAsRBQALOQEBfyABIAAoAgQiBEEBdWohASAAKAIAIQAgASACIAMgBEEBcQR/IAEoAgAgAGooAgAFIAALEQQACzUBAX8gASAAKAIEIgJBAXVqIQEgACgCACEAIAEgAkEBcQR/IAEoAgAgAGooAgAFIAALEQEACwwAIAAgACgCbDYCcAs9AQF/IAEgACgCBCIGQQF1aiEBIAAoAgAhACABIAIgAyAEIAUgBkEBcQR/IAEoAgAgAGooAgAFIAALET0AC+UBAQR/IwBBEGsiBCQAIAEgACgCBCIGQQF1aiEHIAAoAgAhBSAGQQFxBEAgBygCACAFaigCACEFCyACKAIAIQAgBEEANgIIIARCADcDACAAQXBJBEACQAJAIABBC08EQCAAQRBqQXBxIgYQgwkhASAEIAZBgICAgHhyNgIIIAQgATYCACAEIAA2AgQMAQsgBCAAOgALIAQhASAARQ0BCyABIAJBBGogABDhCRoLIAAgAWpBADoAACAHIAQgAyAFEQQAIQAgBCwAC0F/TARAIAQoAgAQ1gkLIARBEGokACAADwsQhwkACwUAQfQ0CygAIAEgAiAAIAIg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QX8gACgCCCIBIANqQQEgACgCECADayABayAAKAJAEMQEIgJFDQIaIAAgACgCCCADaiIBNgIMIAAgASACajYCECABLQAADAILIAAoAigiAiAAKAIkIgFHBEAgACgCICABIAIgAWsQ4wkgACgCKCECIAAoAiQhAQsgACAAKAIgIgUgAiABa2oiATYCJCAAIABBLGogBUYEf0EIBSAAKAI0CyAFaiICNgIoIAAgACkCSDcCUEF/IAFBASACIAFrIgEgACgCPCADayICIAEgAkkbIAAoAkAQxAQiAkUNARogACgCRCIBRQ0DIAAgACgCJCACaiICNgIoIAEgAEHIAGogACgCICACIABBJGogACgCCCICIANqIAIgACgCPGogBEEIaiABKAIAKAIQEQ4AQQNGBEAgACAAKAIoNgIQIAAgACgCICIBNgIMIAAgATYCCCABLQAADAILQX8gBCgCCCICIAAoAgggA2oiAUYNARogACACNgIQIAAgATYCDCABLQAADAELIAEtAAALIQEgACgCCCAEQQ9qRw0AIABBADYCECAAQgA3AggLIARBEGokACABDwsQ3gMAC20BAn9BfyECAkAgACgCQEUNACAAKAIIIAAoAgwiA08NACABQX9GBEAgACADQX9qNgIMQQAPCyAALQBYQRBxRQRAIANBf2otAAAgAUH/AXFHDQELIAAgA0F/aiIANgIMIAAgAToAACABIQILIAIL2AQBCH8jAEEQayIEJAACQAJAIAAoAkBFDQACQCAALQBcQRBxBEAgACgCFCEFIAAoAhwhBwwBCyAAQQA2AhAgAEIANwIIAkAgACgCNCICQQlPBEAgAC0AYgRAIAAgACgCICIFNgIYIAAgBTYCFCAAIAIgBWpBf2oiBzYCHAwCCyAAIAAoAjgiBTYCGCAAIAU2AhQgACAFIAAoAjxqQX9qIgc2AhwMAQsgAEEANgIcIABCADcCFAsgAEEQNgJcCyAAKAIYIQMgAUF/RgR/IAUFIAMEfyADBSAAIARBEGo2AhwgACAEQQ9qNgIUIAAgBEEPajYCGCAEQQ9qCyABOgAAIAAgACgCGEEBaiIDNgIYIAAoAhQLIQIgAiADRwRAAkAgAC0AYgRAQX8hBiACQQEgAyACayICIAAoAkAQqAQgAkcNBAwBCyAEIAAoAiAiBjYCCAJAIAAoAkQiCEUNACAA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AwAgAEGonwFqQgA3AwAgAEGgnwFqQgA3AwAgAEGYnwFqQgA3AwAgAEGQnwFqQgA3AwAgAEGYoQFqQgA3AwAgAEGQoQFqQgA3AwAgAEGIoQFqQgA3AwAgAEGAoQFqQgA3AwAgAEGIowFqQgA3AwAgAEGAowFqQgA3AwAgAEH4ogFqQgA3AwAgAEHwogFqQgA3AwAgAEH4pAFqQgA3AwAgAEHwpAFqQgA3AwAgAEHopAFqQgA3AwAgAEHgpAFqQgA3AwAgAEHopgFqQgA3AwAgAEHgpgFqQgA3AwAgAEHYpgFqQgA3AwAgAEHQpgFqQgA3AwAgAEHYqAFqQgA3AwAgAEHQqAFqQgA3AwAgAEHIqAFqQgA3AwAgAEHAqAFqQgA3AwAgAEHIqgFqQgA3AwAgAEHAqgFqQgA3AwAgAEG4qgFqQgA3AwAgAEGwqgFqQgA3AwAgAEG4rAFqQgA3AwAgAEGwrAFqQgA3AwAgAEGorAFqQgA3AwAgAEGgrAFqQgA3AwAgAEGorgFqQgA3AwAgAEGgrgFqQgA3AwAgAEGYrgFqQgA3AwAgAEGQrgFqQgA3AwAgAEGYsAFqQgA3AwAgAEGQsAFqQgA3AwAgAEGIsAFqQgA3AwAgAEGAsAFqQgA3AwAgAEGIsgFqQgA3AwAgAEGAsgFqQgA3AwAgAEH4sQFqQgA3AwAgAEHwsQFqQgA3AwAgAEH4swFqQgA3AwAgAEHwswFqQgA3AwAgAEHoswFqQgA3AwAgAEHgswFqQgA3AwAgAEHotQFqQgA3AwAgAEHgtQFqQgA3AwAgAEHYtQFqQgA3AwAgAEHQtQFqQgA3AwAgAEHYtwFqQgA3AwAgAEHQtwFqQgA3AwAgAEHItwFqQgA3AwAgAEHAtwFqQgA3AwAgAEHIuQFqQgA3AwAgAEHAuQFqQgA3AwAgAEG4uQFqQgA3AwAgAEGwuQFqQgA3AwAgAEG4uwFqQgA3AwAgAEGwuwFqQgA3AwAgAEGouwFqQgA3AwAgAEGguwFqQgA3AwAgAEGovQFqQgA3AwAgAEGgvQFqQgA3AwAgAEGYvQFqQgA3AwAgAEGQvQFqQgA3AwAgAEGYvwFqQgA3AwAgAEGQvwFqQgA3AwAgAEGIvwFqQgA3AwAgAEGAvwFqQgA3AwAgAEGIwQFqQgA3AwAgAEGAwQFqQgA3AwAgAEH4wAFqQgA3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BCEBCxC8BCgCACIABEADQCAAKAJMQQBOBH9BAQVBAAsaIAAoAhQgACgCHEsEQCAAENkEIAFyIQELIAAoAjgiAA0ACwtBhPwCEBIgAQtpAQJ/AkAgACgCFCAAKAIcTQ0AIABBAEEAIAAoAiQRBAAaIAAoAhQNAEF/DwsgACgCBCIBIAAoAggiAkkEQCAAIAEgAmusQQEgACgCKBEcABoLIABBADYCHCAAQgA3AxAgAEIANwIEQQALQQECfyMAQRBrIgEkAEF/IQICQCAAEMMEDQAgACABQQ9qQQEgACgCIBEEAEEBRw0AIAEtAA8hAgsgAUEQaiQAIAILMQECfyAAELwEIgEoAgA2AjggASgCACICBEAgAiAANgI0CyABIAA2AgBBhPwCEBIgAAtQAQF+AkAgA0HAAHEEQCACIANBQGqtiCEBQgAhAgwBCyADRQ0AIAJBwAAgA2uthiABIAOtIgSIhCEBIAIgBIghAgsgACABNwMAIAAgAjcDCAtQAQF+AkAgA0HAAHEEQCABIANBQGqthiECQgAhAQwBCyADRQ0AIAIgA60iBIYgAUHAACADa62IhCECIAEgBIYhAQsgACABNwMAIAAgAjcDCAvZAwICfwJ+IwBBIGsiAiQAAkAgAUL///////////8AgyIFQoCAgICAgMD/Q3wgBUKAgICAgIDAgLx/fFQEQCABQgSGIABCPIiEIQQgAEL//////////w+DIgBCgYCAgICAgIAIWgRAIARCgYCAgICAgIDAAHwhBAwCCyAEQoCAgICAgICAQH0hBCAAQoCAgICAgICACIVCAFINASAEQgGDIAR8IQQMAQsgAFAgBUKAgICAgIDA//8AVCAFQoCAgICAgMD//wBRG0UEQCABQgSGIABCPIiEQv////////8Dg0KAgICAgICA/P8AhCEEDAELQoCAgICAgID4/wAhBCAFQv///////7//wwBWDQBCACEEIAVCMIinIgNBkfcASQ0AIAIgACABQv///////z+DQoCAgICAgMAAhCIEQYH4ACADaxDcBCACQRBqIAAgBCADQf+If2oQ3QQgAikDCEIEhiACKQMAIgBCPIiEIQQgAikDECACKQMYhEIAUq0gAEL//////////w+DhCIAQoGAgICAgICACFoEQCAEQgF8IQQMAQsgAEKAgICAgICAgAiFQgBSDQAg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ASAEQaGbAWotAABNDQADQCABAn8gACgCBCICIAAoAmhJBEAgACACQQFqNgIEIAItAAAMAQsgABDdBQtBoZsBai0AAEsNAAtBwPsCQcQANgIAIAZBACADQgGDUBshBiADIQkLIAAoAmgEQCAAIAAoAgRBf2o2AgQLAkAgCSADVA0AAkAgA6dBAXENACAGDQBBwPsCQcQANgIAIANCf3whAwwDCyAJIANYDQBBwPsCQcQANgIADAILIAkgBqwiA4UgA30hAwwBC0IAIQMgAEIAENwFCyAHQRBqJAAgAwvlAgEGfyMAQRBrIgckACADQbSUAyADGyIFKAIAIQMCQAJAAkAgAUUEQCADDQEMAwtBfiEEIAJFDQIgACAHQQxqIAAbIQYCQCADBEAgAiEADAELIAEtAAAiAEEYdEEYdSIDQQBOBEAgBiAANgIAIANBAEchBAwECyABLAAAIQBBuPACKAIAKAIARQRAIAYgAEH/vwNxNgIAQQEhBAwECyAAQf8BcUG+fmoiAEEySw0BIABBAnRBsJ0BaigCACEDIAJBf2oiAEUNAiABQQFqIQELIAEtAAAiCEEDdiIJQXBqIANBGnUgCWpyQQdLDQADQCAAQX9qIQAgCEGAf2ogA0EGdHIiA0EATgRAIAVBADYCACAGIAM2AgAgAiAAayEEDAQLIABFDQIgAUEBaiIBLQAAIghBwAFxQYABRg0ACwsgBUEANgIAQcD7AkEZNgIAQX8hBAwBCyAFIAM2AgALIAdBEGokACAEC8sBAgR/An4jAEEQayIDJAAgAbwiBEGAgICAeHEhBQJ+IARB/////wdxIgJBgICAfGpB////9wdNBEAgAq1CGYZCgICAgICAgMA/fAwBCyACQYCAgPwHTwRAIAStQhmGQoCAgICAgMD//wCEDAELIAJFBEBCAAwBCyADIAKtQgAgAmciAkHRAGoQ3QQgAykDACEGIAMpAwhCgICAgICAwACFQYn/ACACa61CMIaECyEHIAAgBjcDACAAIAcgBa1CIIaENwMIIANBEGokAAueCwIFfw9+IwBB4ABrIgUkACAEQi+GIANCEYiEIQ8gAkIghiABQiCIhCENIARC////////P4MiDkIPhiADQjGIhCEQIAIgBIVCgICAgICAgICAf4MhCiAOQhGIIREgAkL///////8/gyILQiCIIRIgBEIwiKdB//8BcSEHAkACfyACQjCIp0H//wFxIglBf2pB/f8BTQRAQQAgB0F/akH+/wFJDQEaCyABUCACQv///////////wCDIgxCgICAgICAwP//AFQgDEKAgICAgIDA//8AURtFBEAgAkKAgICAgIAghCEKDAILIANQIARC////////////AIMiAkKAgICAgIDA//8AVCACQoCAgICAgMD//wBRG0UEQCAEQoCAgICAgCCEIQogAyEBDAILIAEgDEKAgICAgIDA//8AhYRQBEAgAiADhFAEQEKAgICAgIDg//8AIQpCACEBDAMLIApCgICAgICAwP//AIQhCkIAIQEMAgsgAyACQoCAgICAgMD//wCFhFAEQCABIAyEIQJCACEBIAJQBEBCgICAgICA4P//ACEKDAMLIApCgICAgICAwP//AIQhCgwCCyABIAyEUARAQgAhAQwCCyACIAOEUARAQgAhAQwCCyAMQv///////z9YBEAgBUHQAGogASALIAEgCyALUCIGG3kgBkEGdK18pyIGQXFqEN0EIAUpA1giC0IghiAFKQNQIgFCIIiEIQ0gC0IgiCESQRAgBmshBgsgBiACQv///////z9WDQAaIAVBQGsgAyAOIAMgDiAOUCIIG3kgCEEGdK18pyIIQXFqEN0EIAUpA0giAkIPhiAFKQNAIgNCMYiEIRAgAkIvhiADQhGIhCEPIAJCEYghESAGIAhrQRBqCyEGIA9C/////w+DIgIgAUL/////D4MiAX4iDyADQg+GQoCA/v8PgyIDIA1C/////w+DIgx+fCIEQiCGIg4gASADfnwiDSAOVK0gAiAMfiIVIAMgC0L/////D4MiC358IhMgEEL/////D4MiDiABfnwiECAEIA9UrUIghiAEQiCIhHwiFCACIAt+IhYgAyASQoCABIQiD358IgMgDCAOfnwiEiABIBFC/////weDQoCAgIAIhCIBfnwiEUIghnwiF3whBCAHIAlqIAZqQYGAf2ohBgJAIAsgDn4iGCACIA9+fCICIBhUrSACIAEgDH58IgwgAlStfCAMIBMgFVStIBAgE1StfHwiAiAMVK18IAEgD358IAEgC34iCyAOIA9+fCIBIAtUrUIghiABQiCIhHwgAiABQiCGfCIBIAJUrXwgASARIBJUrSADIBZUrSASIANUrXx8QiCGIBFCIIiEfCIDIAFUrXwgAyAUIBBUrSAXIBRUrXx8IgIgA1StfCIBQoCAgICAgMAAg1BFBEAgBkEBaiEGDAELIA1CP4ghAyABQgGGIAJCP4iEIQEgAkIBhiAEQj+IhCECIA1CAYYhDSADIARCAYaEIQQLIAZB//8BTgRAIApCgICAgICAwP//AIQhCkIAIQEMAQsCfiAGQQBMBEBBASAGayIHQf8ATQRAIAVBEGogDSAEIAcQ3AQgBUEgaiACIAEgBkH/AGoiBhDdBCAFQTBqIA0gBCAGEN0EIAUgAiABIAcQ3AQgBSkDMCAFKQM4hEIAUq0gBSkDICAFKQMQhIQhDSAFKQMoIAUpAxiEIQQgBSkDACECIAUpAwgMAgtCACEBDAILIAFC////////P4MgBq1CMIaECyAKhCEKIA1QIARCf1UgBEKAgICAgICAgIB/URtFBEAgCiACQgF8IgEgAlStfCEKDAELIA0gBEKAgICAgICAgIB/hYRQRQRAIAIhAQwBCyAKIAIgAkIBg3wiASACVK18IQoLIAAgATcDACAAIAo3AwggBUHgAGokAAt/AgJ/AX4jAEEQayIDJAAgAAJ+IAFFBEBCAAwBCyADIAEgAUEfdSICaiACcyICrUIAIAJnIgJB0QBqEN0EIAMpAwhCgICAgICAwACFQZ6AASACa61CMIZ8IAFBgICAgHhxrUIghoQhBCADKQMACzcDACAAIAQ3AwggA0EQaiQAC8gJAgR/BH4jAEHwAGsiBSQAIARC////////////AIMhCgJAAkAgAUJ/fCILQn9RIAJC////////////AIMiCSALIAFUrXxCf3wiC0L///////+///8AViALQv///////7///wBRG0UEQCADQn98IgtCf1IgCiALIANUrXxCf3wiC0L///////+///8AVCALQv///////7///wBRGw0BCyABUCAJQoCAgICAgMD//wBUIAlCgICAgICAwP//AFEbRQRAIAJCgICAgICAIIQhBCABIQMMAgsgA1AgCkKAgICAgIDA//8AVCAKQoCAgICAgMD//wBRG0UEQCAEQoCAgICAgCCEIQQMAgsgASAJQoCAgICAgMD//wCFhFAEQEKAgICAgIDg//8AIAIgASADhSACIASFQoCAgICAgICAgH+FhFAiBhshBEIAIAEgBhshAwwCCyADIApCgICAgICAwP//AIWEUA0BIAEgCYRQBEAgAyAKhEIAUg0CIAEgA4MhAyACIASDIQQMAgsgAyAKhFBFDQAgASEDIAIhBAwBCyADIAEgAyABViAKIAlWIAkgClEbIgcbIQogBCACIAcbIgtC////////P4MhCSACIAQgBxsiAkIwiKdB//8BcSEIIAtCMIinQf//AXEiBkUEQCAFQeAAaiAKIAkgCiAJIAlQIgYbeSAGQQZ0rXynIgZBcWoQ3QQgBSkDaCEJIAUpA2AhCkEQIAZrIQYLIAEgAyAHGyEDIAJC////////P4MhASAIBH4gAQUgBUHQAGogAyABIAMgASABUCIHG3kgB0EGdK18pyIHQXFqEN0EQRAgB2shCCAFKQNQIQMgBSkDWAtCA4YgA0I9iIRCgICAgICAgASEIQQgCUIDhiAKQj2IhCEBIAIgC4UhDAJ+IANCA4YiAyAGIAhrIgdFDQAaIAdB/wBLBEBCACEEQgEMAQsgBUFAayADIARBgAEgB2sQ3QQgBUEwaiADIAQgBxDcBCAFKQM4IQQgBSkDMCAFKQNAIAUpA0iEQgBSrYQLIQMgAUKAgICAgICABIQhCSAKQgOGIQICQCAMQn9XBEAgAiADfSIBIAkgBH0gAiADVK19IgOEUARAQgAhA0IAIQQMAwsgA0L/////////A1YNASAFQSBqIAEgAyABIAMgA1AiBxt5IAdBBnStfKdBdGoiBxDdBCAGIAdrIQYgBSkDKCEDIAUpAyAhAQwBCyACIAN8IgEgA1StIAQgCXx8IgNCgICAgICAgAiDUA0AIAFCAYMgA0I/hiABQgGIhIQhASAGQQFqIQYgA0IBiCEDCyALQoCAgICAgICAgH+DIQIgBkH//wFOBEAgAkKAgICAgIDA//8AhCEEQgAhAwwBC0EAIQcCQCAGQQBKBEAgBiEHDAELIAVBEGogASADIAZB/wBqEN0EIAUgASADQQEgBmsQ3AQgBSkDACAFKQMQIAUpAxiEQgBSrYQhASAFKQMIIQMLIANCPYYgAUIDiIQiBCABp0EHcSIGQQRLrXwiASAEVK0gA0IDiEL///////8/gyAChCAHrUIwhoR8IAEgAUIBg0IAIAZBBEYbIgF8IgMgAVStfCEECyAAIAM3AwAgACAENwMIIAVB8ABqJAALgQICAn8EfiMAQRBrIgIkACABvSIFQoCAgICAgICAgH+DIQcCfiAFQv///////////wCDIgRCgICAgICAgHh8Qv/////////v/wBYBEAgBEI8hiEGIARCBIhCgICAgICAgIA8fAwBCyAEQoCAgICAgID4/wBaBEAgBUI8hiEGIAVCBIhCgICAgICAwP//AIQMAQsgBFAEQEIADAELIAIgBEIAIARCgICAgBBaBH8gBEIgiKdnBSAFp2dBIGoLIgNBMWoQ3QQgAikDACEGIAIpAwhCgICAgICAwACFQYz4ACADa61CMIaECyEEIAAgBjcDACAAIAQgB4Q3AwggAkEQaiQAC9sBAgF/An5BASEEAkAgAEIAUiABQv///////////wCDIgVCgICAgICAwP//AFYgBUKAgICAgIDA//8AURsNACACQgBSIANC////////////AIMiBkKAgICAgIDA//8AViAGQoCAgICAgMD//wBRGw0AIAAgAoQgBSAGhIRQBEBBAA8LIAEgA4NCAFkEQEF/IQQgACACVCABIANTIAEgA1EbDQEgACAChSABIAOFhEIAUg8LQX8hBCAAIAJWIAEgA1UgASADURsNACAAIAKFIAEgA4WEQgBSIQQLIAQL2AECAX8BfkF/IQICQCAAQgBSIAFC////////////AIMiA0KAgICAgIDA//8AViADQoCAgICAgMD//wBRGw0AIAAgA0KAgICAgICA/z+EhFAEQEEADwsgAUKAgICAgICA/z+DQgBZBEAgAEIAVCABQoCAgICAgID/P1MgAUKAgICAgICA/z9RGw0BIAAgAUKAgICAgICA/z+FhEIAUg8LIABCAFYgAUKAgICAgICA/z9VIAFCgICAgICAgP8/URsNACAAIAFCgICAgICAgP8/hYRCAFIhAgsgAgs1ACAAIAE3AwAgACACQv///////z+DIARCMIinQYCAAnEgAkIwiKdB//8BcXKtQjCGhDcDCAtnAgF/AX4jAEEQayICJAAgAAJ+IAFFBEBCAAwBCyACIAGtQgBB8AAgAWdBH3MiAWsQ3QQgAikDCEKAgICAgIDAAIUgAUH//wBqrUIwhnwhAyACKQMACzcDACAAIAM3AwggAkEQaiQAC0UBAX8jAEEQayIFJAAgBSABIAIgAyAEQoCAgICAgICAgH+FEOQFIAUpAwAhASAAIAUpAwg3AwggACABNwMAIAVBEGokAAvEAgEBfyMAQdAAayIEJAACQCADQYCAAU4EQCAEQSBqIAEgAkIAQoCAgICAgID//wAQ4gUgBCkDKCECIAQpAyAhASADQf//AUgEQCADQYGAf2ohAwwCCyAEQRBqIAEgAkIAQoCAgICAgID//wAQ4gUgA0H9/wIgA0H9/wJIG0GCgH5qIQMgBCkDGCECIAQpAxAhAQwBCyADQYGAf0oNACAEQUBrIAEgAkIAQoCAgICAgMAAEOIFIAQpA0ghAiAEKQNAIQEgA0GDgH5KBEAgA0H+/wBqIQMMAQsgBEEwaiABIAJCAEKAgICAgIDAABDiBSADQYaAfSADQYaAfUobQfz/AWohAyAEKQM4IQIgBCkDMCEBCyAEIAEgAkIAIANB//8Aaq1CMIYQ4gUgACAEKQMINwMIIAAgBCkDADcDACAEQdAAaiQAC44RAgV/DH4jAEHAAWsiBSQAIARC////////P4MhEiACQv///////z+DIQwgAiAEhUKAgICAgICAgIB/gyERIARCMIinQf//AXEhBwJAAkACQCACQjCIp0H//wFxIglBf2pB/f8BTQRAIAdBf2pB/v8BSQ0BCyABUCACQv///////////wCDIgpCgICAgICAwP//AFQgCkKAgICAgIDA//8AURtFBEAgAkKAgICAgIAghCERDAILIANQIARC////////////AIMiAkKAgICAgIDA//8AVCACQoCAgICAgMD//wBRG0UEQCAEQoCAgICAgCCEIREgAyEBDAILIAEgCkKAgICAgIDA//8AhYRQBEAgAyACQoCAgICAgMD//wCFhFAEQEIAIQFCgICAgICA4P//ACERDAMLIBFCgICAgICAwP//AIQhEUIAIQEMAgsgAyACQoCAgICAgMD//wCFhFAEQEIAIQEMAgsgASAKhFANAiACIAOEUARAIBFCgICAgICAwP//AIQhEUIAIQEMAgsgCkL///////8/WARAIAVBsAFqIAEgDCABIAwgDFAiBht5IAZBBnStfKciBkFxahDdBEEQIAZrIQYgBSkDuAEhDCAFKQOwASEBCyACQv///////z9WDQAgBUGgAWogAyASIAMgEiASUCIIG3kgCEEGdK18pyIIQXFqEN0EIAYgCGpBcGohBiAFKQOoASESIAUpA6ABIQMLIAVBkAFqIBJCgICAgICAwACEIhRCD4YgA0IxiIQiAkKEyfnOv+a8gvUAIAJ9IgQQ3gUgBUGAAWpCACAFKQOYAX0gBBDeBSAFQfAAaiAFKQOIAUIBhiAFKQOAAUI/iIQiBCACEN4FIAVB4ABqIARCACAFKQN4fRDeBSAFQdAAaiAFKQNoQgGGIAUpA2BCP4iEIgQgAhDeBSAFQUBrIARCACAFKQNYfRDeBSAFQTBqIAUpA0hCAYYgBSkDQEI/iIQiBCACEN4FIAVBIGogBEIAIAUpAzh9EN4FIAVBEGogBSkDKEIBhiAFKQMgQj+IhCIEIAIQ3gUgBSAEQgAgBSkDGH0Q3gUgBiAJIAdraiEGAn5CACAFKQMIQgGGIAUpAwBCP4iEQn98IgpC/////w+DIgQgAkIgiCIOfiIQIApCIIgiCiACQv////8PgyILfnwiAkIghiINIAQgC358IgsgDVStIAogDn4gAiAQVK1CIIYgAkIgiIR8fCALIAQgA0IRiEL/////D4MiDn4iECAKIANCD4ZCgID+/w+DIg1+fCICQiCGIg8gBCANfnwgD1StIAogDn4gAiAQVK1CIIYgAkIgiIR8fHwiAiALVK18IAJCAFKtfH0iC0L/////D4MiDiAEfiIQIAogDn4iDSAEIAtCIIgiD358IgtCIIZ8Ig4gEFStIAogD34gCyANVK1CIIYgC0IgiIR8fCAOQgAgAn0iAkIgiCILIAR+IhAgAkL/////D4MiDSAKfnwiAkIghiIPIAQgDX58IA9UrSAKIAt+IAIgEFStQiCGIAJCIIiEfHx8IgIgDlStfCACQn58IhAgAlStfEJ/fCILQv////8PgyICIAxCAoYgAUI+iIRC/////w+DIgR+Ig4gAUIeiEL/////D4MiCiALQiCIIgt+fCINIA5UrSANIBBCIIgiDiAMQh6IQv//7/8Pg0KAgBCEIgx+fCIPIA1UrXwgCyAMfnwgAiAMfiITIAQgC358Ig0gE1StQiCGIA1CIIiEfCAPIA1CIIZ8Ig0gD1StfCANIAogDn4iEyAQQv////8PgyIQIAR+fCIPIBNUrSAPIAIgAUIChkL8////D4MiE358IhUgD1StfHwiDyANVK18IA8gCyATfiILIAwgEH58IgwgBCAOfnwiBCACIAp+fCICQiCIIAIgBFStIAwgC1StIAQgDFStfHxCIIaEfCIMIA9UrXwgDCAVIA4gE34iBCAKIBB+fCIKQiCIIAogBFStQiCGhHwiBCAVVK0gBCACQiCGfCAEVK18fCIEIAxUrXwiAkL/////////AFgEQCABQjGGIARC/////w+DIgEgA0L/////D4MiCn4iDEIAUq19QgAgDH0iECAEQiCIIgwgCn4iDSABIANCIIgiC358Ig5CIIYiD1StfSACQv////8PgyAKfiABIBJC/////w+DfnwgCyAMfnwgDiANVK1CIIYgDkIgiIR8IAQgFEIgiH4gAyACQiCIfnwgAiALfnwgDCASfnxCIIZ8fSESIAZBf2ohBiAQIA99DAELIARCIYghCyABQjCGIAJCP4YgBEIBiIQiBEL/////D4MiASADQv////8PgyIKfiIMQgBSrX1CACAMfSIOIAEgA0IgiCIMfiIQIAsgAkIfhoQiDUL/////D4MiDyAKfnwiC0IghiITVK19IAwgD34gCiACQgGIIgpC/////w+DfnwgASASQv////8Pg358IAsgEFStQiCGIAtCIIiEfCAEIBRCIIh+IAMgAkIhiH58IAogDH58IA0gEn58QiCGfH0hEiAKIQIgDiATfQshASAGQYCAAU4EQCARQoCAgICAgMD//wCEIRFCACEBDAELIAZB//8AaiEHIAZBgYB/TARAAkAgBw0AIAQgAUIBhiADViASQgGGIAFCP4iEIgEgFFYgASAUURutfCIBIARUrSACQv///////z+DfCICQoCAgICAgMAAg1ANACACIBGEIREMAgtCACEBDAELIAQgAUIBhiADWiASQgGGIAFCP4iEIgEgFFogASAUURutfCIBIARUrSACQv///////z+DIAetQjCGhHwgEYQhEQsgACABNwMAIAAgETcDCCAFQcABaiQADwsgAEIANwMAIAAgEUKAgICAgIDg//8AIAIgA4RCAFIbNwMIIAVBwAFqJAALpQgCBX8CfiMAQTBrIgUkAAJAIAJBAk0EQCACQQJ0IgJBzJ8BaigCACEHIAJBwJ8BaigCACEIA0ACfyABKAIEIgIgASgCaEkEQCABIAJBAWo2AgQgAi0AAAwBCyABEN0FCyICIgRBIEYgBEF3akEFSXINAAsCQCACQVVqIgRBAksEQEEBIQYMAQtBASEGIARBAWtFDQBBf0EBIAJBLUYbIQYgASgCBCICIAEoAmhJBEAg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ARD4BQ0BCyAARQRAQfSfASECIAMtAAFBLkYNAgtBACECDAELQcSUAygCACICBEADQCADIAJBCGoQ+AVFDQIgAigCGCICDQALC0G8lAMQEUHElAMoAgAiAgRAA0AgAyACQQhqEPgFRQRAQbyUAxASDAMLIAIoAhgiAg0ACwtBACEBAkACQAJAQcz7AigCAA0AQauhARD7BSICRQ0AIAItAABFDQAgBEEBaiEIQf4BIARrIQkDQCACQToQywQiByACayAHLQAAIgpBAEdrIgYgCUkEfyAFQRBqIAIgBhDhCRogBUEQaiAGaiICQS86AAAgAkEBaiADIAQQ4QkaIAVBEGogBiAIampBADoAACAFQRBqIAVBDGoQGyIGBEBBHBDVCSICDQQgBiAFKAIMEPwFDAMLIActAAAFIAoLQQBHIAdqIgItAAANAAsLQRwQ1QkiAkUNASACQfSfASkCADcCACACQQhqIgEgAyAEEOEJGiABIARqQQA6AAAgAkHElAMoAgA2AhhBxJQDIAI2AgAgAiEBDAELIAIgBjYCACACIAUoAgw2AgQgAkEIaiIBIAMgBBDhCRogASAEakEAOgAAIAJBxJQDKAIANgIYQcSUAyACNgIAIAIhAQtBvJQDEBIgAUH0nwEgACABchshAgsgBUGQAmokACACC4gBAQR/IwBBIGsiASQAAn8DQCABQQhqIABBAnRqIABB9cEBQbihAUEBIAB0Qf////8HcRsQ/QUiAzYCACACIANBAEdqIQIgAEEBaiIAQQZHDQALAkAgAkEBSw0AQZCgASACQQFrDQEaIAEoAghB9J8BRw0AQaigAQwBC0EACyEAIAFBIGokACAAC2MBAn8jAEEQayIDJAAgAyACNgIMIAMgAjYCCEF/IQQCQEEAQQAgASACEM8EIgJBAEgNACAAIAJBAWoiAhDVCSIANgIAIABFDQAgACACIAEgAygCDBDPBCEECyADQRBqJAAgBAsqAQF/IwBBEGsiAiQAIAIgATYCDCAAQeDBASABEPYFIQAgAkEQaiQAIAALLQEBfyMAQRBrIgIkACACIAE2AgwgAEHkAEHvwQEgARDPBCEAIAJBEGokACAACx8AIABBAEcgAEGQoAFHcSAAQaigAUdxBEAgABDWCQsLIwECfyAAIQEDQCABIgJBBGohASACKAIADQALIAIgAGtBAnUL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IAMoAgBBAnI2AgALIAUoAvgCIQAgARCKCRogBUHYAWoQigkaIAVBgANqJAAgAAuXBQECfyMAQeACayIAJAAgACACNgLQAiAAIAE2AtgCIABB0AFqEKEGIQYgACADKAIcIgE2AhAgASABKAIEQQFqNgIEIABBEGoQoAUiAUHgvwFB+r8BIABB4AFqIAEoAgAoAjARCAAaAn8gACgCECIBIAEoAgRBf2oiAjYCBCACQX9GCwRAIAEgASgCACgCCBEBAAsgAEHAAWoQoQYiAiACLAALQQBIBH8gAigCCEH/////B3FBf2oFQQoLEKIGIAACfyACLAALQQBIBEAgAigCAAwBCyACCyIBNgK8ASAAIABBEGo2AgwgAEEANgIIA0ACQCAAQdgCaiAAQdACahChBUUNACAAKAK8AQJ/IAIsAAtBAEgEQCACKAIEDAELIAItAAsLIAFqRgRAAn8gAiIBLAALQQBIBEAgASgCBAwBCyABLQALCyEDIAECfyABLAALQQBIBEAgASgCBAwBCyABLQALC0EBdBCiBiABIAEsAAtBAEgEfyABKAIIQf////8HcUF/agVBCgsQogYgACADAn8gASwAC0EASARAIAIoAgAMAQsgAgsiAWo2ArwBCwJ/IAAoAtgCIgMoAgwiByADKAIQRgRAIAMgAygCACgCJBEAAAwBCyAHKAIAC0EQIAEgAEG8AWogAEEIakEAIAYgAEEQaiAAQQxqIABB4AFqEMoGDQAgAEHYAmoQogUaDAELCyACIAAoArwBIAFrEKIGAn8gAiwAC0EASARAIAIoAgAMAQsgAgshARC+BiEDIAAgBTYCACABIAMgABC/BkEBRwRAIARBBDYCAAsgAEHYAmogAEHQAmoQowUEQCAEIAQoAgBBAnI2AgALIAAoAtgCIQEgAhCKCRogBhCKCRogAEHgAmokACABCzIAIAIoAgAhAgNAAkAgACABRwR/IAAoAgAgAkcNASAABSABCw8LIABBBGohAAwAAAsAC3sBAn8jAEEQayICJAAgAiAAKAIcIgA2AgggACAAKAIEQQFqNgIEIAJBCGoQoAUiAEHgvwFB+r8BIAEgACgCACgCMBEIABoCfyACKAIIIgAgACgCBEF/aiIDNgIEIANBf0YLBEAgACAAKAIAKAIIEQEACyACQRBqJAAgAQukAgEBfyMAQTBrIgUk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ACADKAIAKAI0EQQAQSVHDQBBAiEBIAAQogUgBEEIahCjBUUNAQsgAiACKAIAIAFyNgIACyAEQRBqJAALPgAgASACIAMgBEECEKMHIQEgAygCACECAkAgAUF/akEeSw0AIAJBBHENACAAIAE2AgAPCyADIAJBBHI2AgALOwAgASACIAMgBEECEKMHIQEgAygCACECAkAgAUEXSg0AIAJBBHENACAAIAE2AgAPCyADIAJBBHI2AgALPgAgASACIAMgBEECEKMHIQEgAygCACECAkAgAUF/akELSw0AIAJBBHENACAAIAE2AgAPCyADIAJBBHI2AgALPAAgASACIAMgBEEDEKMHIQEgAygCACECAkAgAUHtAkoNACACQQRxDQAgACABNgIADwsgAyACQQRyNgIACz4AIAEgAiADIARBAhCjByEBIAMoAgAhAgJAIAFBDEoNACACQQRxDQAgACABQX9qNgIADwsgAyACQQRyNgIACzsAIAEgAiADIARBAhCjByEBIAMoAgAhAgJAIAFBO0oNACACQQRxDQAgACABNgIADwsgAyACQQRyNgIAC5ABAQJ/IwBBEGsiBCQAIAQgATYCCANAAkAgACAEQQhqEKEFRQ0AIANBgMAAAn8gACgCACIBKAIMIgUgASgCEEYEQCABIAEoAgAoAiQRAAAMAQsgBSgCAAsgAygCACgCDBEEAEUNACAAEKIFGgwBCwsgACAEQQhqEKMFBEAgAiACKAIAQQJyNgIACyAEQRBqJAALrgEBAX8CfyAAQQhqIAAoAggoAggRAAAiACIGLAALQQBIBEAgBigCBAwBCyAGLQALC0EAAn8gACwAF0EASARAIAAoAhAMAQsgAC0AFwtrRgRAIAQgBCgCAEEEcjYCAA8LIAIgAyAAIABBGGogBSAEQQAQxQYgAGshAAJAIAEoAgAiAkEMRw0AIAANACABQQA2AgAPCwJAIAJBC0oNACAAQQxHDQAgASACQQxqNgIACws7ACABIAIgAyAEQQIQowchASADKAIAIQICQCABQTxKDQAgAkEEcQ0AIAAgATYCAA8LIAMgAkEEcjYCAAs7ACABIAIgAyAEQQEQowchASADKAIAIQICQCABQQZKDQAgAkEEcQ0AIAAgATYCAA8LIAMgAkEEcjYCAAsoACABIAIgAyAEQQQQowchASADLQAAQQRxRQRA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ADYCGCARIA8oAgAgCygChAEgC0EYahClBiALKAIYBEAgBSAFKAIAQQRyNgIADAELQQEhAAsgEBCKCRogDRCKCRogDBCKCRogDhCKCRogERCKCRogDygCACEBIA9BADYCACABBEAgASAPKAIEEQEACyALQbAEaiQAIAAPCyAKIQQLIAFBAWohAQwAAAsAC6UDAQF/IwBBEGsiCiQAIAkCfyAABEAgCiABEMkHIgAiASABKAIAKAIsEQIAIAIgCigCADYAACAKIAAgACgCACgCIBECACAIIAoQygcgChCKCRogCiAAIAAoAgAoAhwRAgAgByAKEMoHIAoQigkaIAMgACAAKAIAKAIMEQAAOgAAIAQgACAAKAIAKAIQEQAAOgAAIAogACAAKAIAKAIUEQIAIAUgChDKByAKEIoJGiAKIAAgACgCACgCGBECACAGIAoQygcgChCKCRogACAAKAIAKAIkEQAADAELIAogARDLByIAIgEgASgCACgCLBECACACIAooAgA2AAAgCiAAIAAoAgAoAiARAgAgCCAKEMoHIAoQigkaIAogACAAKAIAKAIcEQIAIAcgChDKByAKEIoJGiADIAAgACgCACgCDBEAADoAACAEIAAgACgCACgCEBEAADoAACAKIAAgACgCACgCFBECACAFIAoQygcgChCKCRogCiAAIAAoAgAoAhgRAgAgBiAKEMoHIAoQigkaIAAgACgCACgCJBEAAAs2AgAgCkEQaiQACyUBAX8gASgCABCbBUEYdEEYdSECIAAgASgCADYCBCAAIAI6AAAL5wEBBn8jAEEQayIFJAAgACgCBCEDAn8gAigCACAAKAIAayIEQf////8HSQRAIARBAXQMAQtBfwsiBEEBIAQbIQQgASgCACEGIAAoAgAhByADQcMFRgR/QQAFIAAoAgALIAQQ1wkiCARAIANBwwVHBEAgACgCABogAEEANgIACyAGIAdrIQcgBUHCBTYCBCAAIAVBCGogCCAFQQRqEJwGIgMQzgcgAygCACEGIANBADYCACAGBEAgBiADKAIEEQEACyABIAcgACgCAGo2AgAgAiAEIAAoAgBqNgIAIAVBEGokAA8LELgHAAvwAQEGfyMAQRBrIgUkACAAKAIEIQMCfyACKAIAIAAoAgBrIgRB/////wdJBEAgBEEBdAwBC0F/CyIEQQQgBBshBCABKAIAIQYgACgCACEHIANBwwVGBH9BAAUgACgCAAsgBBDXCSIIBEAgA0HDBUcEQCAAKAIAGiAAQQA2AgALIAYgB2tBAnUhByAFQcIFNgIEIAAgBUEIaiAIIAVBBGoQnAYiAxDOByADKAIAIQYgA0EANgIAIAYEQCAGIAMoAgQRAQALIAEgACgCACAHQQJ0ajYCACACIAAoAgAgBEF8cWo2AgAgBUEQaiQADwsQuAcAC4QDAQF/IwBBoAFrIgAkACAAIAE2ApgBIAAgAjYCkAEgAEHDBTYCFCAAQRhqIABBIGogAEEUahCcBiEBIAAgBCgCHCIHNgIQIAcgBygCBEEBajYCBCAAQRBqEJMFIQcgAEEAOgAPIABBmAFqIAIgAyAAQRBqIAQoAgQgBSAAQQ9qIAcgASAAQRRqIABBhAFqEMEHBEAgBhDHByAALQAPBEAgBiAHQS0gBygCACgCHBEDABCTCQsgB0EwIAcoAgAoAhwRAwAhAiABKAIAIQQgACgCFCIDQX9qIQcgAkH/AXEhAgNAAkAgBCAHTw0AIAQtAAAgAkcNACAEQQFqIQQMAQsLIAYgBCADEMgHCyAAQZgBaiAAQZABahCXBQRAIAUgBSgCAEECcjYCAAsgACgCmAEhAwJ/IAAoAhAiAiACKAIEQX9qIgQ2AgQgBEF/RgsEQCACIAIoAgAoAggRAQALIAEoAgAhAiABQQA2AgAgAgRAIAIgASgCBBEBAAsgAEGgAWokACADC1sBAn8jAEEQayIBJAACQCAALAALQQBIBEAgACgCACECIAFBADoADyACIAEtAA86AAAgAEEANgIEDAELIAFBADoADiAAIAEtAA46AAAgAEEAOgALCyABQRBqJAALrAMBBX8jAEEgayIFJAACfyAALAALQQBIBEAgACgCBAwBCyAALQALCyEDIAAsAAtBAEgEfyAAKAIIQf////8HcUF/agVBCgshBAJAIAIgAWsiBkUNAAJ/An8gACwAC0EASARAIAAoAgAMAQsgAAshByABAn8gACwAC0EASARAIAAoAgAMAQsgAAsCfyAALAALQQBIBEAgACgCBAwBCyAALQALC2pJIAcgAU1xCwRAIAACfwJ/IAVBEGoiACIDQgA3AgAgA0EANgIIIAAgASACEJIGIAAiASwAC0EASAsEQCABKAIADAELIAELAn8gACwAC0EASARAIAAoAgQMAQsgAC0ACwsQkgkgABCKCRoMAQsgBCADayAGSQRAIAAgBCADIAZqIARrIAMgAxCQCQsCfyAALAALQQBIBEAgACgCAAwBCyAACyADaiEEA0AgASACRwRAIAQgAS0AADoAACABQQFqIQEgBEEBaiEEDAELCyAFQQA6AA8gBCAFLQAPOgAAIAMgBmohAQJAIAAsAAtBAEgEQCAAIAE2AgQMAQsgACABOgALCwsgBUEgaiQACwsAIABBpJUDEJsGCyAAIAAQ/AggACABKAIINgIIIAAgASkCADcCACABEMAGCwsAIABBnJUDEJsGC34BAX8jAEEgayIDJAAgAyABNgIQIAMgADYCGCADIAI2AggDQAJAAn9BASADKAIYIAMoAhBGQQFzRQ0AGiADKAIYLQAAIAMoAggtAABGDQFBAAshACADQSBqJAAgAA8LIAMgAygCGEEBajYCGCADIAMoAghBAWo2AggMAAALAAs0AQF/IwBBEGsiAiQAIAIgACgCADYCCCACIAIoAgggAWo2AgggAigCCCEAIAJBEGokACAACz0BAn8gASgCACECIAFBADYCACACIQMgACgCACECIAAgAzYCACACBEAgAiAAKAIEEQEACyAAIAEoAgQ2AgQL+wQBAX8jAEHwBGsiACQAIAAgATYC6AQgACACNgLgBCAAQcMFNgIQIABByAFqIABB0AFqIABBEGoQnAYhByAAIAQoAhwiATYCwAEgASABKAIEQQFqNgIEIABBwAFqEKAFIQEgAEEAOgC/AQJAIABB6ARqIAIgAyAAQcABaiAEKAIEIAUgAEG/AWogASAHIABBxAFqIABB4ARqENAHRQ0AIABB68EBKAAANgC3ASAAQeTBASkAADcDsAEgASAAQbABaiAAQboBaiAAQYABaiABKAIAKAIwEQgAGiAAQcIFNgIQIABBCGpBACAAQRBqEJwGIQEgAEEQaiECAkAgACgCxAEgBygCAGtBiQNOBEAgACgCxAEgBygCAGtBAnVBAmoQ1QkhAyABKAIAIQIgASADNgIAIAIEQCACIAEoAgQRAQALIAEoAgBFDQEgASgCACECCyAALQC/AQRAIAJBLToAACACQQFqIQILIAcoAgAhBANAAkAgBCAAKALEAU8EQCACQQA6AAAgACAGNgIAIABBEGogABCABkEBRw0B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IAQgAxDVBwsgAEG4A2ogAEGwA2oQowUEQCAFIAUoAgBBAnI2AgALIAAoArgDIQMCfyAAKAIQIgIgAigCBEF/aiIENgIEIARBf0YLBEAgAiACKAIAKAIIEQEACyABKAIAIQIgAUEANgIAIAIEQCACIAEoAgQRAQALIABBwANqJAAgAwtbAQJ/IwBBEGsiASQAAkAgACwAC0EASARAIAAoAgAhAiABQQA2AgwgAiABKAIMNgIAIABBADYCBAwBCyABQQA2AgggACABKAIINgIAIABBADoACwsgAUEQaiQAC64DAQV/IwBBEGsiAyQAAn8gACwAC0EASARAIAAoAgQMAQsgAC0ACwshBSAALAALQQBIBH8gACgCCEH/////B3FBf2oFQQELIQQCQCACIAFrQQJ1IgZFDQACfwJ/IAAsAAtBAEgEQCAAKAIADAELIAALIQcgAQJ/IAAsAAtBAEgEQCAAKAIADAELIAALAn8gACwAC0EASARAIAAoAgQMAQsgAC0ACwtBAnRqSSAHIAFNcQsEQCAAAn8CfyADQgA3AgAgA0EANgIIIAMgASACEJYGIAMiACwAC0EASAsEQCAAKAIADAELIAALAn8gAywAC0EASARAIAMoAgQMAQsgAy0ACwsQmQkgAxCKCRoMAQsgBCAFayAGSQRAIAAgBCAFIAZqIARrIAUgBRCYCQsCfyAALAALQQBIBEAgACgCAAwBCyAACyAFQQJ0aiEEA0AgASACRwRAIAQgASgCADYCACABQQRqIQEgBEEEaiEEDAELCyADQQA2AgAgBCADKAIANgIAIAUgBmohAQJAIAAsAAtBAEgEQCAAIAE2AgQMAQsgACABOgALCwsgA0EQaiQACwsAIABBtJUDEJsGCyAAIAAQ/QggACABKAIINgIIIAAgASkCADcCACABEMAGCwsAIABBrJUDEJsGC34BAX8jAEEgayIDJAAgAyABNgIQIAMgADYCGCADIAI2AggDQAJAAn9BASADKAIYIAMoAhBGQQFzRQ0AGiADKAIYKAIAIAMoAggoAgBGDQFBAAshACADQSBqJAAgAA8LIAMgAygCGEEEajYCGCADIAMoAghBBGo2AggMAAALAAs3AQF/IwBBEGsiAiQAIAIgACgCADYCCCACIAIoAgggAUECdGo2AgggAigCCCEAIAJBEGokACAAC/QGAQt/IwBB0ANrIgAkACAAIAU3AxAgACAGNwMYIAAgAEHgAmo2AtwCIABB4AJqIABBEGoQgQYhCSAAQcIFNgLwASAAQegBakEAIABB8AFqEJwGIQsgAEHCBTYC8AEgAEHgAWpBACAAQfABahCcBiEKIABB8AFqIQwCQCAJQeQATwRAEL4GIQcgACAFNwMAIAAgBjcDCCAAQdwCaiAHQe/BASAAEO4GIQkgACgC3AIiCEUNASALKAIAIQcgCyAINgIAIAcEQCAHIAsoAgQRAQALIAkQ1QkhCCAKKAIAIQcgCiAINgIAIAcEQCAHIAooAgQRAQALIAooAgBBAEdBAXMNASAKKAIAIQwLIAAgAygCHCIHNgLYASAHIAcoAgRBAWo2AgQgAEHYAWoQkwUiESIHIAAoAtwCIgggCCAJaiAMIAcoAgAoAiARCAAaIAICfyAJBEAgACgC3AItAABBLUYhDwsgDwsgAEHYAWogAEHQAWogAEHPAWogAEHOAWogAEHAAWoQoQYiECAAQbABahChBiINIABBoAFqEKEGIgcgAEGcAWoQ3AcgAEHCBTYCMCAAQShqQQAgAEEwahCcBiEIAn8gCSAAKAKcASICSgRAAn8gBywAC0EASARAIAcoAgQMAQsgBy0ACwsgCSACa0EBdEEBcmoMAQsCfyAHLAALQQBIBEAgBygCBAwBCyAHLQALC0ECagshDiAAQTBqIQIgACgCnAECfyANLAALQQBIBEAgDSgCBAwBCyANLQALCyAOamoiDkHlAE8EQCAOENUJIQ4gCCgCACECIAggDjYCACACBEAgAiAIKAIEEQEACyAIKAIAIgJFDQELIAIgAEEkaiAAQSBqIAMoAgQgDCAJIAxqIBEgDyAAQdABaiAALADPASAALADOASAQIA0gByAAKAKcARDdByABIAIgACgCJCAAKAIgIAMgBBDjAyECIAgoAgAhASAIQQA2AgAgAQRAIAEgCCgCBBEBAAsgBxCKCRogDRCKCRogEBCKCRoCfyAAKALYASIBIAEoAgRBf2oiAzYCBCADQX9GCwRAIAEgASgCACgCCBEBAAsgCigCACEBIApBADYCACABBEAgASAKKAIEEQEACyALKAIAIQEgC0EANgIAIAEEQCABIAsoAgQRAQALIABB0ANqJAAgAg8LELgHAAvRAwEBfyMAQRBrIgokACAJAn8gAARAIAIQyQchAAJAIAEEQCAKIAAgACgCACgCLBECACADIAooAgA2AAAgCiAAIAAoAgAoAiARAgAMAQsgCiAAIAAoAgAoAigRAgAgAyAKKAIANgAAIAogACAAKAIAKAIcEQIACyAIIAoQygcgChCKCRogBCAAIAAoAgAoAgwRAAA6AAAgBSAAIAAoAgAoAhARAAA6AAAgCiAAIAAoAgAoAhQRAgAgBiAKEMoHIAoQigkaIAogACAAKAIAKAIYEQIAIAcgChDKByAKEIoJGiAAIAAoAgAoAiQRAAAMAQsgAhDLByEAAkAgAQRAIAogACAAKAIAKAIsEQIAIAMgCigCADYAACAKIAAgACgCACgCIBECAAwBCyAKIAAgACgCACgCKBECACADIAooAgA2AAAgCiAAIAAoAgAoAhwRAgALIAggChDKByAKEIoJGiAEIAAgACgCACgCDBEAADoAACAFIAAgACgCACgCEBEAADoAACAKIAAgACgCACgCFBECACAGIAoQygcgChCKCRogCiAAIAAoAgAoAhgRAgAgByAKEMoHIAoQigkaIAAgACgCACgCJBEAAAs2AgAgCkEQaiQAC/AHAQp/IwBBEGsiEyQAIAIgADYCACADQYAEcSEWA0ACQAJAAkACQCAUQQRGBEACfyANLAALQQBIBEAgDSgCBAwBCyANLQALC0EBSwRAIBMgDRDfBjYCCCACIBNBCGpBARDNByANEOAGIAIoAgAQ3gc2AgALIANBsAFxIgNBEEYNAiADQSBHDQEgASACKAIANgIADAILIAggFGosAAAiD0EESw0DAkACQAJAAkACQCAPQQFrDgQBAwIEAAsgASACKAIANgIADAcLIAEgAigCADYCACAGQSAgBigCACgCHBEDACEPIAIgAigCACIQQQFqNgIAIBAgDzoAAAwGCwJ/IA0sAAtBAEgEQCANKAIEDAELIA0tAAsLRQ0FAn8gDSwAC0EASARAIA0oAgAMAQsgDQstAAAhDyACIAIoAgAiEEEBajYCACAQIA86AAAMBQsCfyAMLAALQQBIBEAgDCgCBAwBCyAMLQALC0UhDyAWRQ0EIA8NBCACIAwQ3wYgDBDgBiACKAIAEN4HNgIADAQLIAIoAgAhFyAEQQFqIAQgBxsiBCERA0ACQCARIAVPDQAgESwAACIPQQBOBH8gBigCCCAPQf8BcUEBdGovAQBBgBBxQQBHBUEAC0UNACARQQFqIREMAQsLIA4iD0EBTgRAA0ACQCAPQQFIIhANACARIARNDQAgEUF/aiIRLQAAIRAgAiACKAIAIhJBAWo2AgAgEiAQOgAAIA9Bf2ohDwwBCwsgEAR/QQAFIAZBMCAGKAIAKAIcEQMACyESA0AgAiACKAIAIhBBAWo2AgAgD0EBTgRAIBAgEjoAACAPQX9qIQ8MAQsLIBAgCToAAAsgBCARRgRAIAZBMCAGKAIAKAIcEQMAIQ8gAiACKAIAIhBBAWo2AgAgECAPOgAADAMLAn9BfwJ/IAssAAtBAEgEQCALKAIEDAELIAstAAsLRQ0AGgJ/IAssAAtBAEgEQCALKAIADAELIAsLLAAACyESQQAhD0EAIRADQCAEIBFGDQMCQCAPIBJHBEAgDyEVDAELIAIgAigCACISQQFqNgIAIBIgCjoAAEEAIRUgEEEBaiIQAn8gCywAC0EASARAIAsoAgQMAQsgCy0ACwtPBEAgDyESDAELAn8gCywAC0EASARAIAsoAgAMAQsgCwsgEGotAABB/wBGBEBBfyESDAELAn8gCywAC0EASARAIAsoAgAMAQsgCwsgEGosAAAhEgsgEUF/aiIRLQAAIQ8gAiACKAIAIhhBAWo2AgAgGCAPOgAAIBVBAWohDwwAAAsACyABIAA2AgALIBNBEGokAA8LIBcgAigCABDmBgsgFEEBaiEUDAAACwALCwAgACABIAIQ5QcL0gUBB38jAEHAAWsiACQAIAAgAygCHCIGNgK4ASAGIAYoAgRBAWo2AgQgAEG4AWoQkwUhCiACAn8CfyAFIgIsAAtBAEgEQCACKAIEDAELIAItAAsLBEACfyACLAALQQBIBEAgAigCAAwBCyACCy0AACAKQS0gCigCACgCHBEDAEH/AXFGIQsLIAsLIABBuAFqIABBsAFqIABBrwFqIABBrgFqIABBoAFqEKEGIgwgAEGQAWoQoQYiCSAAQYABahChBiIGIABB/ABqENwHIABBwgU2AhAgAEEIakEAIABBEGoQnAYhBwJ/An8gAiwAC0EASARAIAUoAgQMAQsgBS0ACwsgACgCfEoEQAJ/IAUsAAtBAEgEQCAFKAIEDAELIAUtAAsLIQIgACgCfCEIAn8gBiwAC0EASARAIAYoAgQMAQsgBi0ACwsgAiAIa0EBdGpBAWoMAQsCfyAGLAALQQBIBEAgBigCBAwBCyAGLQALC0ECagshCCAAQRBqIQICQCAAKAJ8An8gCSwAC0EASARAIAkoAgQMAQsgCS0ACwsgCGpqIghB5QBJDQAgCBDVCSEIIAcoAgAhAiAHIAg2AgAgAgRAIAIgBygCBBEBAAsgBygCACICDQAQuAcACyACIABBBGogACADKAIEAn8gBSwAC0EASARAIAUoAgAMAQsgBQsCfyAFLAALQQBIBEAgBSgCAAwBCyAFCwJ/IAUsAAtBAEgEQCAFKAIEDAELIAUtAAsLaiAKIAsgAEGwAWogACwArwEgACwArgEgDCAJIAYgACgCfBDdByABIAIgACgCBCAAKAIAIAMgBBDjAyECIAcoAgAhASAHQQA2AgAgAQRAIAEgBygCBBEBAAsgBhCKCRogCRCKCRogDBCKCRoCfyAAKAK4ASIBIAEoAgRBf2oiAzYCBCADQX9GCwRAIAEgASgCACgCCBEBAAsgAEHAAWokACACC/0GAQt/IwBBsAhrIgAkACAAIAU3AxAgACAGNwMYIAAgAEHAB2o2ArwHIABBwAdqIABBEGoQgQYhCSAAQcIFNgKgBCAAQZgEakEAIABBoARqEJwGIQsgAEHCBTYCoAQgAEGQBGpBACAAQaAEahCcBiEKIABBoARqIQwCQCAJQeQATwRAEL4GIQcgACAFNwMAIAAgBjcDCCAAQbwHaiAHQe/BASAAEO4GIQkgACgCvAciCEUNASALKAIAIQcgCyAINgIAIAcEQCAHIAsoAgQRAQALIAlBAnQQ1QkhCCAKKAIAIQcgCiAINgIAIAcEQCAHIAooAgQRAQALIAooAgBBAEdBAXMNASAKKAIAIQwLIAAgAygCHCIHNgKIBCAHIAcoAgRBAWo2AgQgAEGIBGoQoAUiESIHIAAoArwHIgggCCAJaiAMIAcoAgAoAjARCAAaIAICfyAJBEAgACgCvActAABBLUYhDwsgDwsgAEGIBGogAEGABGogAEH8A2ogAEH4A2ogAEHoA2oQoQYiECAAQdgDahChBiINIABByANqEKEGIgcgAEHEA2oQ4QcgAEHCBTYCMCAAQShqQQAgAEEwahCcBiEIAn8gCSAAKALEAyICSgRAAn8gBywAC0EASARAIAcoAgQMAQsgBy0ACwsgCSACa0EBdEEBcmoMAQsCfyAHLAALQQBIBEAgBygCBAwBCyAHLQALC0ECagshDiAAQTBqIQIgACgCxAMCfyANLAALQQBIBEAgDSgCBAwBCyANLQALCyAOamoiDkHlAE8EQCAOQQJ0ENUJIQ4gCCgCACECIAggDjYCACACBEAgAiAIKAIEEQEACyAIKAIAIgJFDQELIAIgAEEkaiAAQSBqIAMoAgQgDCAMIAlBAnRqIBEgDyAAQYAEaiAAKAL8AyAAKAL4AyAQIA0gByAAKALEAxDiByABIAIgACgCJCAAKAIgIAMgBBD2BiECIAgoAgAhASAIQQA2AgAgAQRAIAEgCCgCBBEBAAsgBxCKCRogDRCKCRogEBCKCRoCfyAAKAKIBCIBIAEoAgRBf2oiAzYCBCADQX9GCwRAIAEgASgCACgCCBEBAAsgCigCACEBIApBADYCACABBEAgASAKKAIEEQEACyALKAIAIQEgC0EANgIAIAEEQCABIAsoAgQRAQALIABBsAhqJAAgAg8LELgHAAvRAwEBfyMAQRBrIgokACAJAn8gAARAIAIQ1gchAAJAIAEEQCAKIAAgACgCACgCLBECACADIAooAgA2AAAgCiAAIAAoAgAoAiARAgAMAQsgCiAAIAAoAgAoAigRAgAgAyAKKAIANgAAIAogACAAKAIAKAIcEQIACyAIIAoQ1wcgChCKCRogBCAAIAAoAgAoAgwRAAA2AgAgBSAAIAAoAgAoAhARAAA2AgAgCiAAIAAoAgAoAhQRAgAgBiAKEMoHIAoQigkaIAogACAAKAIAKAIYEQIAIAcgChDXByAKEIoJGiAAIAAoAgAoAiQRAAAMAQsgAhDYByEAAkAgAQRAIAogACAAKAIAKAIsEQIAIAMgCigCADYAACAKIAAgACgCACgCIBECAAwBCyAKIAAgACgCACgCKBECACADIAooAgA2AAAgCiAAIAAoAgAoAhwRAgALIAggChDXByAKEIoJGiAEIAAgACgCACgCDBEAADYCACAFIAAgACgCACgCEBEAADYCACAKIAAgACgCACgCFBECACAGIAoQygcgChCKCRogCiAAIAAoAgAoAhgRAgAgByAKENcHIAoQigkaIAAgACgCACgCJBEAAAs2AgAgCkEQaiQAC+gHAQp/IwBBEGsiFCQAIAIgADYCACADQYAEcSEWAkADQAJAIBVBBEYEQAJ/IA0sAAtBAEgEQCANKAIEDAELIA0tAAsLQQFLBEAgFCANEN8GNgIIIAIgFEEIakEBENoHIA0Q8wYgAigCABDjBzYCAAsgA0GwAXEiA0EQRg0DIANBIEcNASABIAIoAgA2AgAMAwsCQCAIIBVqLAAAIg9BBEsNAAJAAkACQAJAAkAgD0EBaw4EAQMCBAALIAEgAigCADYCAAwECyABIAIoAgA2AgAgBkEgIAYoAgAoAiwRAwAhDyACIAIoAgAiEEEEajYCACAQIA82AgAMAwsCfyANLAALQQBIBEAgDSgCBAwBCyANLQALC0UNAgJ/IA0sAAtBAEgEQCANKAIADAELIA0LKAIAIQ8gAiACKAIAIhBBBGo2AgAgECAPNgIADAILAn8gDCwAC0EASARAIAwoAgQMAQsgDC0ACwtFIQ8gFkUNASAPDQEgAiAMEN8GIAwQ8wYgAigCABDjBzYCAAwBCyACKAIAIRcgBEEEaiAEIAcbIgQhEQNAAkAgESAFTw0AIAZBgBAgESgCACAGKAIAKAIMEQQARQ0AIBFBBGohEQwBCwsgDiIPQQFOBEADQAJAIA9BAUgiEA0AIBEgBE0NACARQXxqIhEoAgAhECACIAIoAgAiEkEEajYCACASIBA2AgAgD0F/aiEPDAELCyAQBH9BAAUgBkEwIAYoAgAoAiwRAwALIRMgAigCACEQA0AgEEEEaiESIA9BAU4EQCAQIBM2AgAgD0F/aiEPIBIhEAwBCwsgAiASNgIAIBAgCTYCAAsCQCAEIBFGBEAgBkEwIAYoAgAoAiwRAwAhDyACIAIoAgAiEEEEaiIRNgIAIBAgDzYCAAwBCwJ/QX8CfyALLAALQQBIBEAgCygCBAwBCyALLQALC0UNABoCfyALLAALQQBIBEAgCygCAAwBCyALCywAAAshE0EAIQ9BACESA0AgBCARRwRAAkAgDyATRwRAIA8hEAwBCyACIAIoAgAiEEEEajYCACAQIAo2AgBBACEQIBJBAWoiEgJ/IAssAAtBAEgEQCALKAIEDAELIAstAAsLTwRAIA8hEwwBCwJ/IAssAAtBAEgEQCALKAIADAELIAsLIBJqLQAAQf8ARgRAQX8hEwwBCwJ/IAssAAtBAEgEQCALKAIADAELIAsLIBJqLAAAIRMLIBFBfGoiESgCACEPIAIgAigCACIYQQRqNgIAIBggDzYCACAQQQFqIQ8MAQsLIAIoAgAhEQsgFyAREPcGCyAVQQFqIRUMAQsLIAEgADYCAAsgFEEQaiQACwsAIAAgASACEOYHC9gFAQd/IwBB8ANrIgAkACAAIAMoAhwiBjYC6AMgBiAGKAIEQQFqNgIEIABB6ANqEKAFIQogAgJ/An8gBSICLAALQQBIBEAgAigCBAwBCyACLQALCwRAAn8gAiwAC0EASARAIAIoAgAMAQsgAgsoAgAgCkEtIAooAgAoAiwRAwBGIQsLIAsLIABB6ANqIABB4ANqIABB3ANqIABB2ANqIABByANqEKEGIgwgAEG4A2oQoQYiCSAAQagDahChBiIGIABBpANqEOEHIABBwgU2AhAgAEEIakEAIABBEGoQnAYhBwJ/An8gAiwAC0EASARAIAUoAgQMAQsgBS0ACwsgACgCpANKBEACfyAFLAALQQBIBEAgBSgCBAwBCyAFLQALCyECIAAoAqQDIQgCfyAGLAALQQBIBEAgBigCBAwBCyAGLQALCyACIAhrQQF0akEBagwBCwJ/IAYsAAtBAEgEQCAGKAIEDAELIAYtAAsLQQJqCyEIIABBEGohAgJAIAAoAqQDAn8gCSwAC0EASARAIAkoAgQMAQsgCS0ACwsgCGpqIghB5QBJDQAgCEECdBDVCSEIIAcoAgAhAiAHIAg2AgAgAgRAIAIgBygCBBEBAAsgBygCACICDQAQuAcACyACIABBBGogACADKAIEAn8gBSwAC0EASARAIAUoAgAMAQsgBQsCfyAFLAALQQBIBEAgBSgCAAwBCyAFCwJ/IAUsAAtBAEgEQCAFKAIEDAELIAUtAAsLQQJ0aiAKIAsgAEHgA2ogACgC3AMgACgC2AMgDCAJIAYgACgCpAMQ4gcgASACIAAoAgQgACgCACADIAQQ9gYhAiAHKAIAIQEgB0EANgIAIAEEQCABIAcoAgQRAQALIAYQigkaIAkQigkaIAwQigkaAn8gACgC6AMiASABKAIEQX9qIgM2AgQgA0F/RgsEQCABIAEoAgAoAggRAQALIABB8ANqJAAgAgtbAQF/IwBBEGsiAyQAIAMgATYCACADIAA2AggDQCADKAIIIAMoAgBGQQFzBEAgAiADKAIILQAAOgAAIAJBAWohAiADIAMoAghBAWo2AggMAQsLIANBEGokACACC1sBAX8jAEEQayIDJAAgAyABNgIAIAMgADYCCANAIAMoAgggAygCAEZBAXMEQCACIAMoAggoAgA2AgAgAkEEaiECIAMgAygCCEEEajYCCAwBCwsgA0EQaiQAIAILKABBfwJ/An8gASwAC0EASARAIAEoAgAMAQtBAAsaQf////8HC0EBGwvjAQAjAEEgayIBJAACfyABQRBqEKEGIgMhBCMAQRBrIgIkACACIAQ2AgggAigCCCEEIAJBEGokACAECwJ/IAUsAAtBAEgEQCAFKAIADAELIAULAn8gBSwAC0EASARAIAUoAgAMAQsgBQsCfyAFLAALQQBIBEAgBSgCBAwBCyAFLQALC2oQ6QcCfyADLAALQQBIBEAgAygCAAwBCyADCyECAn8gABChBiEEIwBBEGsiACQAIAAgBDYCCCAAKAIIIQQgAEEQaiQAIAQLIAIgAhDKBCACahDpByADEIoJGiABQSBqJAALPwEBfyMAQRBrIgMkACADIAA2AggDQCABIAJJBEAgA0EIaiABEOoHIAFBAWohAQwBCwsgAygCCBogA0EQaiQACw8AIAAoAgAgASwAABCTCQvSAgAjAEEgayIBJAAgAUEQahChBiEEAn8gAUEIaiIDIgJBADYCBCACQbTwATYCACACQYzGATYCACACQeDJATYCACADQdTKATYCACADCwJ/IwBBEGsiAiQAIAIgBDYCCCACKAIIIQMgAkEQaiQAIAMLAn8gBSwAC0EASARAIAUoAgAMAQsgBQsCfyAFLAALQQBIBEAgBSgCAAwBCyAFCwJ/IAUsAAtBAEgEQCAFKAIEDAELIAUtAAsLQQJ0ahDsBwJ/IAQsAAtBAEgEQCAEKAIADAELIAQLIQIgABChBiEFAn8gAUEIaiIDIgBBADYCBCAAQbTwATYCACAAQYzGATYCACAAQeDJATYCACADQbTLATYCACADCwJ/IwBBEGsiACQAIAAgBTYCCCAAKAIIIQMgAEEQaiQAIAMLIAIgAhDKBCACahDtByAEEIoJGiABQSBqJAALtgEBA38jAEFAaiIEJAAgBCABNgI4IARBMGohBQJAA0ACQCAGQQJGDQAgAiADTw0AIAQgAjYCCCAAIARBMGogAiADIARBCGogBEEQaiAFIARBDGogACgCACgCDBEOACIGQQJGDQIgBEEQaiEBIAQoAgggAkYNAgNAIAEgBCgC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9gIACyAAQQJ0EIMJC1ABAX8gABDHByAALAALQQBIBEAgACgCACEBIAAsAAtBAEgEfyAAKAIIQf////8HcUF/agVBCgsaIAEQ1gkgAEGAgICAeDYCCCAAQQA6AAsLC1ABAX8gABDUByAALAALQQBIBEAgACgCACEBIAAsAAtBAEgEfyAAKAIIQf////8HcUF/agVBAQsaIAEQ1gkgAEGAgICAeDYCCCAAQQA6AAsLCzoCAX8BfiMAQRBrIgMkACADIAEgAhC+BhCPBiADKQMAIQQgACADKQMINwMIIAAgBDcDACADQRBqJAALAwAAC0cBAX8gAEEIaiIBKAIARQRAIAAgACgCACgCEBEBAA8LAn8gASABKAIAQX9qIgE2AgAgAUF/RgsEQCAAIAAoAgAoAhARAQALCwQAQQALLgADQCAAKAIAQQFGDQALIAAoAgBFBEAgAEEBNgIAIAFBxQURAQAgAEF/NgIACwsxAQJ/IABBASAAGyEAA0ACQCAAENUJIgENAEHMpAMoAgAiAkUNACACEQcADAELCyABCzoBAn8gARDKBCICQQ1qEIMJIgNBADYCCCADIAI2AgQgAyACNgIAIAAgA0EMaiABIAJBAWoQ4Qk2AgALKQEBfyACBEAgACEDA0AgAyABNgIAIANBBGohAyACQX9qIgINAAsLIAALaQEBfwJAIAAgAWtBAnUgAkkEQANAIAAgAkF/aiICQQJ0IgNqIAEgA2ooAgA2AgAgAg0ADAIACwALIAJFDQAgACEDA0AgAyABKAIANgIAIANBBGohAyABQQRqIQEgAkF/aiICDQALCyAACwoAQZzxARD2AgALWQECfyMAQRBrIgMkACAAQgA3AgAgAEEANgIIIAAhAgJAIAEsAAtBAE4EQCACIAEoAgg2AgggAiABKQIANwIADAELIAAgASgCACABKAIEEIkJCyADQRBqJAALnAEBA38jAEEQayIEJABBbyACTwRAAkAgAkEKTQRAIAAgAjoACyAAIQMMAQsgACACQQtPBH8gAkEQakFwcSIDIANBf2oiAyADQQtGGwVBCgtBAWoiBRDvCCIDNgIAIAAgBUGAgICAeHI2AgggACACNgIECyADIAEgAhCBBSAEQQA6AA8gAiADaiAELQAPOgAAIARBEGokAA8LEIcJAAsdACAALAALQQBIBEAgACgCCBogACgC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AkAgACwAC0EASAR/IAAoAghB/////wdxQX9qBUEBCyIEAn8gACwAC0EASARAIAAoAgQMAQsgAC0ACwsiA2sgAk8EQCACRQ0BAn8gACwAC0EASARAIAAoAgAMAQsgAAsiBCADQQJ0aiABIAIQigUgAiADaiICIQECQCAALAALQQBIBEAgACABNgIEDAELIAAgAToACwsgBUEANgIMIAQgAkECdGogBSgCDDYCAAwBCyAAIAQgAiADaiAEayADIANBACACIAEQlwkLIAVBEGokAAvEAQEDfyMAQRBrIgMkACADIAE2AgwCQAJAAkACQCAALAALQQBIBEAgACgCBCIEIAAoAghB/////wdxQX9qIgJGDQEMAwtBASEEQQEhAiAALQALIgFBAUcNAQsgACACQQEgAiACEJgJIAQhASAALAALQQBIDQELIAAiAiABQQFqOgALDAELIAAoAgAhAiAAIARBAWo2AgQgBCEBCyACIAFBAnRqIgAgAygCDDYCACADQQA2AgggACADKAIINgIEIANBEGokAAusAQEDfyMAQRBrIgQkAEHv////AyABTwRAAkAgAUEBTQRAIAAgAToACyAAIQMMAQsgACABQQJPBH8gAUEEakF8cSIDIANBf2oiAyADQQJGGwVBAQtBAWoiBRD7CCIDNgIAIAAgBUGAgICAeHI2AgggACABNgIECyABBH8gAyACIAEQhQkFIAMLGiAEQQA2AgwgAyABQQJ0aiAEKAIMNgIAIARBEGokAA8LEIcJAAsKAEGp8QEQ9gIACy8BAX8jAEEQayIAJAAgAEEANgIMQZjzACgCACIAQbDxAUEAELgEGiAAEL8EEB4ACwYAEJ0JAAsGAEHO8QELFQAgAEGU8gE2AgAgAEEEahChCSAACywBAX8CQCAAKAIAQXRqIgAiASABKAIIQX9qIgE2AgggAUF/Sg0AIAAQ1gkLCwoAIAAQoAkQ1gkLDQAgABCgCRogABDWCQsGAEGE8wELCwAgACABQQAQpgkLHAAgAkUEQCAAIAFGDwsgACgCBCABKAIEEPgFRQugAQECfyMAQUBqIgMkAEEBIQQCQCAAIAFBABCmCQ0AQQAhBCABRQ0AIAFBlPQBEKgJIgFFDQAgA0F/NgIUIAMgADYCECADQQA2AgwgAyABNgIIIANBGGpBAEEnEOIJGiADQQE2AjggASAD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gICAgID4/wBWDQAgAL0iCEI0iKdB/w9xIgJB/w9HDQELIAAgAaIiACAAow8LIAhCAYYiBSAGVgRAIAdCNIinQf8PcSEDAn4gAkUEQEEAIQIgCEIMhiIFQgBZBEADQCACQX9qIQIgBUIBhiIFQn9VDQALCyAIQQEgAmuthgwBCyAIQv////////8Hg0KAgICAgICACIQLIgUCfiADRQRAQQAhAyAHQgyGIgZCAFkEQANAIANBf2ohAyAGQgGGIgZCf1UNAAsLIAdBASADa62GDAELIAdC/////////weDQoCAgICAgIAIhAsiB30iBkJ/VSEEIAIgA0oEQANAAkAgBEUNACAGIgVCAFINACAARAAAAAAAAAAAog8LIAVCAYYiBSAHfSIGQn9VIQQgAkF/aiICIANKDQALIAMhAgsCQCAERQ0AIAYiBUIAUg0AIABEAAAAAAAAAACiDwsCQCAFQv////////8HVgRAIAUhBgwBCwNAIAJBf2ohAiAFQoCAgICAgIAEVCEDIAVCAYYiBiEFIAMNAAsLIAhCgICAgICAgICAf4MhBSACQQFOBH4gBkKAgICAgICAeHwgAq1CNIaEBSAGQQEgAmutiAsgBYS/DwsgAEQAAAAAAAAAAKIgACAFIAZRGwurBgIFfwR+IwBBgAFrIgUkAAJAAkACQCADIARCAEIAEOYFRQ0AIAMgBBDgCSEHIAJCMIinIglB//8BcSIGQf//AUYNACAHDQELIAVBEGogASACIAMgBBDiBSAFIAUpAxAiAiAFKQMYIgEgAiABEOwFIAUpAwghAiAFKQMAIQQMAQsgASACQv///////z+DIAatQjCGhCIKIAMgBEL///////8/gyAEQjCIp0H//wFxIgetQjCGhCILEOYFQQBMBEAgASAKIAMgCxDmBQRAIAEhBAwCCyAFQfAAaiABIAJCAEIAEOIFIAUpA3ghAiAFKQNwIQQMAQsgBgR+IAEFIAVB4ABqIAEgCkIAQoCAgICAgMC7wAAQ4gUgBSkDaCIKQjCIp0GIf2ohBiAFKQNgCyEEIAdFBEAgBUHQAGogAyALQgBCgICAgICAwLvAABDiBSAFKQNYIgtCMIinQYh/aiEHIAUpA1AhAwsgCkL///////8/g0KAgICAgIDAAIQiCiALQv///////z+DQoCAgICAgMAAhCINfSAEIANU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aiEBIAJBBGoiAiAESQ0ACwwBCyADQQRJBEAgACECDAELIANBfGoiBCAASQRAIAAhAgwBCyAAIQIDQCACIAEtAAA6AAAgAiABLQABOgABIAIgAS0AAjoAAiACIAEtAAM6AAMgAUEEaiEBIAJBBGoiAiAETQ0ACwsgAiADSQRAA0AgAiABLQAAOgAAIAFBAWohASACQQFqIgIgA0cNAAsLIAAL8wICAn8BfgJAIAJFDQAgACACaiIDQX9qIAE6AAAgACABOgAAIAJBA0kNACADQX5qIAE6AAAgACABOgABIANBfWogAToAACAAIAE6AAIgAkEHSQ0AIANBfGogAToAACAAIAE6AAMgAkEJSQ0AIABBACAAa0EDcSIEaiIDIAFB/wFxQYGChAhsIgE2AgAgAyACIARrQXxxIgRqIgJBfGogATYCACAEQQlJDQAgAyABNgIIIAMgATYCBCACQXhqIAE2AgAgAkF0aiABNgIAIARBGUkNACADIAE2AhggAyABNgIUIAMgATYCECADIAE2AgwgAkFwaiABNgIAIAJBbGogATYCACACQWhqIAE2AgAgAkFkaiABNgIAIAQgA0EEcUEYciIEayICQSBJDQAgAa0iBUIghiAFhCEFIAMgBGohAQNAIAEgBTcDGCABIAU3AxAgASAFNwMIIAEgBTcDACABQSBqIQEgAkFgaiICQR9LDQALCyAAC+UCAQJ/AkAgACABRg0AAkAgASACaiAASwRAIAAgAmoiBCABSw0BCyAAIAEgAhDhCRoPCyAAIAFzQQNxIQMCQAJAIAAgAUkEQCADDQIgAEEDcUUNAQNAIAJFDQQgACABLQAAOgAAIAFBAWohASACQX9qIQIgAEEBaiIAQQNxDQALDAELAkAgAw0AIARBA3EEQANAIAJFDQUgACACQX9qIgJqIgMgASACai0AADoAACADQQNxDQALCyACQQNNDQADQCAAIAJBfGoiAmogASACaigCADYCACACQQNLDQALCyACRQ0CA0AgACACQX9qIgJqIAEgAmotAAA6AAAgAg0ACwwCCyACQQNNDQAgAiEDA0AgACABKAIANgIAIAFBBGohASAAQQRqIQAgA0F8aiIDQQNLDQALIAJBA3EhAgsgAkUNAANAIAAgAS0AADoAACAAQQFqIQAgAUEBaiEBIAJBf2oiAg0ACwsLHwBBxKgDKAIARQRAQcioAyABNgIAQcSoAyAANgIACwsEACMACxAAIwAgAGtBcHEiACQAIAALBgAgACQACwYAIABAAAsLACABIAIgABECAAsPACABIAIgAyAEIAARCwALCwAgASACIAAREQALDQAgASACIAMgABFNAAsPACABIAIgAyAEIAARFAALEQAgASACIAMgBCAFIAARVQALDQAgASACIAMgABESAAsPACABIAIgAyAEIAARUgALCwAgASACIAARGAALCwAgASACIAARDwALDQAgASACIAMgABEaAAsNACABIAIgAyAAER4ACw8AIAEgAiADIAQgABFMAAsPACABIAIgAyAEIAARGQALDwAgASACIAMgBCAAEVwACxEAIAEgAiADIAQgBSAAEU8ACxEAIAEgAiADIAQgBSAAEV0ACxMAIAEgAiADIAQgBSAGIAARUAALDwAgASACIAMgBCAAET4ACxEAIAEgAiADIAQgBSAAETgACxEAIAEgAiADIAQgBSAAET8ACxMAIAEgAiADIAQgBSAGIAAROQALEwAgASACIAMgBCAFIAYgABFAAAsVACABIAIgAyAEIAUgBiAHIAAROgALEQAgASACIAMgBCAFIAARQgALEwAgASACIAMgBCAFIAYgABEnAAsPACABIAIgAyAEIAARRgALDQAgASACIAMgABFBAAsPACABIAIgAyAEIAAROwALDwAgASACIAMgBCAAEQgACxEAIAEgAiADIAQgBSAAET0ACxMAIAEgAiADIAQgBSAGIAARNgALEwAgASACIAMgBCAFIAYgABEgAAsTACABIAIgAyAEIAUgBiAAEV4ACxUAIAEgAiADIAQgBSAGIAcgABFUAAsVACABIAIgAyAEIAUgBiAHIAARWQALEwAgASACIAMgBCAFIAYgABFfAAsVACABIAIgAyAEIAUgBiAHIAARVwALFwAgASACIAMgBCAFIAYgByAIIAARYQALGQAgASACIAMgBCAFIAYgByAIIAkgABFaAAsNACABIAIgAyAAESQACw8AIAEgAiADIAQgABEsAAsTACABIAIgAyAEIAUgBiAAES4ACxUAIAEgAiADIAQgBSAGIAcgABFRAAsPACABIAIgAyAEIAARHwALEQAgASACIAMgBCAFIAARLQALDQAgASACIAMgABEiAAsPACABIAIgAyAEIAARNwALEQAgASACIAMgBCAFIAARCgALDQAgASACIAMgABFIAAsPACABIAIgAyAEIAARRwALCQAgASAAESoACwsAIAEgAiAAESsACw8AIAEgAiADIAQgABFKAAsRACABIAIgAyAEIAUgABFLAAsTACABIAIgAyAEIAUgBiAAETQACxUAIAEgAiADIAQgBSAGIAcgABEzAAsNACABIAIgAyAAEWMACw8AIAEgAiADIAQgABE1AAsPACABIAIgAyAEIAARaAALEQAgASACIAMgBCAFIAARLwALEwAgASACIAMgBCAFIAYgABFTAAsTACABIAIgAyAEIAUgBiAAEWAACxUAIAEgAiADIAQgBSAGIAcgABFYAAsRACABIAIgAyAEIAUgABEwAAsTACABIAIgAyAEIAUgBiAAEVYACwsAIAEgAiAAEWoACw8AIAEgAiADIAQgABFbAAsRACABIAIgAyAEIAUgABFOAAsTACABIAIgAyAEIAUgBiAAEUkACxEAIAEgAiADIAQgBSAAEQYACxcAIAEgAiADIAQgBSAGIAcgCCAAEQ4ACxMAIAEgAiADIAQgBSAGIAARCQALEQAgASACIAMgBCAFIAARKAALFQAgASACIAMgBCAFIAYgByAAERUACxMAIAEgAiADIAQgBSAGIAARDQALBwAgABEHAAsZACABIAIgA60gBK1CIIaEIAUgBiAAESYACyIBAX4gASACrSADrUIghoQgBCAAERwAIgVCIIinECkgBacLGQAgASACIAMgBCAFrSAGrUIghoQgABEjAAsjACABIAIgAyAEIAWtIAatQiCGhCAHrSAIrUIghoQgABFFAAslACABIAIgAyAEIAUgBq0gB61CIIaEIAitIAmtQiCGhCAAEUQACwuUzwJWAEGACAuQE1ZlY3RvckludABWZWN0b3JEb3VibGUAVmVjdG9yQ2hhcgBWZWN0b3JVQ2hhcgBWZWN0b3JGbG9hdAB2ZWN0b3JUb29scwBjbGVhclZlY3RvckRibABjbGVhclZlY3RvckZsb2F0AG1heGlTZXR0aW5ncwBzZXR1cABzYW1wbGVSYXRlAGNoYW5uZWxzAGJ1ZmZlclNpemUAbWF4aU9zYwBzaW5ld2F2ZQBjb3N3YXZlAHBoYXNvcgBzYXcAdHJpYW5nbGUAc3F1YXJlAHB1bHNlAGltcHVsc2UAbm9pc2UAc2luZWJ1ZgBzaW5lYnVmNABzYXduAHBoYXNlUmVzZXQAbWF4aUVudmVsb3BlAGxpbmUAdHJpZ2dlcgBhbXBsaXR1ZGUAdmFsaW5kZXgAbWF4aURlbGF5bGluZQBkbABtYXhpRmlsdGVyAGxvcmVzAGhpcmVzAGJhbmRwYXNzAGxvcGFzcwBoaXBhc3MAY3V0b2ZmAHJlc29uYW5jZQBtYXhpTWl4AHN0ZXJlbwBxdWFkAGFtYmlzb25pYwBtYXhpTGluZQBwbGF5AHByZXBhcmUAdHJpZ2dlckVuYWJsZQBpc0xpbmVDb21wbGV0ZQBtYXhpWEZhZGUAeGZhZGUAbWF4aUxhZ0V4cABpbml0AGFkZFNhbXBsZQB2YWx1ZQBhbHBoYQBhbHBoYVJlY2lwcm9jYWwAdmFsAG1heGlTYW1wbGUAZ2V0TGVuZ3RoAHNldFNhbXBsZQBzZXRTYW1wbGVGcm9tT2dnQmxvYgBpc1JlYWR5AHBsYXlPbmNlAHBsYXlPblpYAHBsYXk0AGNsZWFyAG5vcm1hbGlzZQBhdXRvVHJpbQBsb2FkAHJlYWQAbG9vcFNldFBvc09uWlgAbWF4aU1hcABsaW5saW4AbGluZXhwAGV4cGxpbgBjbGFtcABtYXhpRHluAGdhdGUAY29tcHJlc3NvcgBjb21wcmVzcwBzZXRBdHRhY2sAc2V0UmVsZWFzZQBzZXRUaHJlc2hvbGQAc2V0UmF0aW8AbWF4aUVudgBhcgBhZHNyAHNldERlY2F5AHNldFN1c3RhaW4AY29udmVydABtdG9mAG1zVG9TYW1wcwBtYXhpU2FtcGxlQW5kSG9sZABzYWgAbWF4aU5vbmxpbmVhcml0eQBmYXN0QXRhbgBhdGFuRGlzdABmYXN0QXRhbkRpc3QAc29mdGNsaXAAaGFyZGNsaXAAYXN5bWNsaXAAbWF4aUZsYW5nZXIAZmxhbmdlAG1heGlDaG9ydXMAY2hvcnVzAG1heGlEQ0Jsb2NrZXIAbWF4aVNWRgBzZXRDdXRvZmYAc2V0UmVzb25hbmNlAG1heGlNYXRoAGFkZABzdWIAbXVsAGRpdgBndABsdABndGUAbHRlAG1vZABhYnMAcG93AG1heGlDbG9jawB0aWNrZXIAc2V0VGVtcG8Ac2V0VGlja3NQZXJCZWF0AGlzVGljawBjdXJyZW50Q291bnQAcGxheUhlYWQAYnBzAGJwbQB0aWNrAHRpY2tzAG1heGlLdXJhbW90b09zY2lsbGF0b3IAc2V0UGhhc2UAZ2V0UGhhc2UAbWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldABzZXRQaGFzZXMAc2l6ZQBtYXhpQXN5bmNLdXJhbW90b09zY2lsbGF0b3IAbWF4aUZGVABwcm9jZXNzAHNwZWN0cmFsRmxhdG5lc3MAc3BlY3RyYWxDZW50cm9pZABnZXRNYWduaXR1ZGVzAGdldE1hZ25pdHVkZXNEQgBnZXRQaGFzZXMAZ2V0TnVtQmlucwBnZXRGRlRTaXplAGdldEhvcFNpemUAZ2V0V2luZG93U2l6ZQBtYXhpRkZUTW9kZXMAV0lUSF9QT0xBUl9DT05WRVJTSU9OAE5PX1BPTEFSX0NPTlZFUlNJT04AbWF4aUlGRlQAbWF4aUlGRlRNb2RlcwBTUEVDVFJVTQBDT01QTEVYAG1heGlNRkNDAG1mY2MAbWF4aVRpbWVTdHJldGNoAHNoYXJlZF9wdHI8bWF4aVRpbWVzdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+AGdldE5vcm1hbGlzZWRQb3NpdGlvbgBnZXRQb3NpdGlvbgBzZXRQb3NpdGlvbgBwbGF5QXRQb3NpdGlvbgBtYXhpUGl0Y2hTaGlmdABzaGFyZWRfcHRyPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+AG1heGlTdHJldGNoAHNldExvb3BTdGFydABzZXRMb29wRW5kAGdldExvb3BFbmQAbWF4aUJpdHMAc2lnAGF0AHNobABzaHIAcgBsYW5kAGxvcgBseG9yAG5lZwBpbmMAZGVjAGVxAHRvU2lnbmFsAHRvVHJpZ1NpZ25hbABmcm9tU2lnbmFsAG1heGlUcmlnZ2VyAG9uWlgAb25DaGFuZ2VkAG1heGlDb3VudGVyAGNvdW50AG1heGlJbmRleABwdWxsAG1heGlSYXRpb1NlcQBwbGF5VHJpZwBwbGF5VmFsdWVzAG1heGlTYXRSZXZlcmIAbWF4aUZyZWVWZXJiAGFsbG9jYXRvcjxUPjo6YWxsb2NhdGUoc2l6ZV90IG4pICduJyBleGNlZWRzIG1heGltdW0gc3VwcG9ydGVkIHNpemUAcHVzaF9iYWNrAHJlc2l6ZQBnZXQAc2V0AE5TdDNfXzI2dmVjdG9ySWlOU185YWxsb2NhdG9ySWlFRUVFAE5TdDNfXzIxM19fdmVjdG9yX2Jhc2VJaU5TXzlhbGxvY2F0b3JJaUVFRUUATlN0M19fMjIwX192ZWN0b3JfYmFzZV9jb21tb25JTGIxRUVFAAA8fAAATgwAAMB8AAAiDAAAAAAAAAEAAAB0DAAAAAAAAMB8AAD+CwAAAAAAAAEAAAB8DAAAAAAAAFBOU3QzX18yNnZlY3RvcklpTlNfOWFsbG9jYXRvcklpRUVFRQAAAAAcfQAArAwAAAAAAACUDAAAUEtOU3QzX18yNnZlY3RvcklpTlNfOWFsbG9jYXRvcklpRUVFRQAAABx9AADkDAAAAQAAAJQMAABpaQB2AHZpANQMAABEewAA1AwAAKR7AAB2aWlpAAAAAAAAAABEewAA1AwAAMh7AACkewAAdmlpaWkAAADIewAADA0AAGlpaQCEDQAAlAwAAMh7AABOMTBlbXNjcmlwdGVuM3ZhbEUAADx8AABwDQAAaWlpaQBBoBsL5gRcewAAlAwAAMh7AACkewAAaWlpaWkATlN0M19fMjZ2ZWN0b3JJZE5TXzlhbGxvY2F0b3JJZEVFRUUATlN0M19fMjEzX192ZWN0b3JfYmFzZUlkTlNfOWFsbG9jYXRvcklkRUVFRQAAAMB8AADaDQAAAAAAAAEAAAB0DAAAAAAAAMB8AAC2DQAAAAAAAAEAAAAIDgAAAAAAAFBOU3QzX18yNnZlY3RvcklkTlNfOWFsbG9jYXRvcklkRUVFRQAAAAAcfQAAOA4AAAAAAAAgDgAAUEtOU3QzX18yNnZlY3RvcklkTlNfOWFsbG9jYXRvcklkRUVFRQAAABx9AABwDgAAAQAAACAOAABgDgAARHsAAGAOAADgewAAdmlpZAAAAABEewAAYA4AAMh7AADgewAAdmlpaWQAAADIewAAmA4AAIQNAAAgDgAAyHsAAAAAAABcewAAIA4AAMh7AADgewAAaWlpaWQATlN0M19fMjZ2ZWN0b3JJY05TXzlhbGxvY2F0b3JJY0VFRUUATlN0M19fMjEzX192ZWN0b3JfYmFzZUljTlNfOWFsbG9jYXRvckljRUVFRQAAAMB8AAAqDwAAAAAAAAEAAAB0DAAAAAAAAMB8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xCQAAFBLMTZtYXhpTUZDQ0FuYWx5c2VySWRFABx9AAD0JAAAAQAAAMQkAADkJAAARHsAAOQkAACwewAAsHsAALB7AADgewAA4HsAAHZpaWlpaWRkAAAAACAOAADkJAAA+BEAADE1bWF4aVRpbWVTdHJldGNoSTE0aGFubldpbkZ1bmN0b3JFADx8AABUJQAAUDE1bWF4aVRpbWVTdHJldGNoSTE0aGFubldpbkZ1bmN0b3JFAAAAABx9AACAJQAAAAAAAHglAABQSzE1bWF4aVRpbWVTdHJldGNoSTE0aGFubldpbkZ1bmN0b3JFAAAAHH0AALglAAABAAAAeCUAAAAAAACoJgAASgIAAEsCAABMAgAATQIAAE4CAABOU3QzX18yMjBfX3NoYXJlZF9wdHJfcG9pbnRlcklQMTVtYXhpVGltZVN0cmV0Y2hJMTRoYW5uV2luRnVuY3RvckVOMTBlbXNjcmlwdGVuMTVzbWFydF9wdHJfdHJhaXRJTlNfMTBzaGFyZWRfcHRySVMzX0VFRTExdmFsX2RlbGV0ZXJFTlNfOWFsbG9jYXRvcklTM19FRUVFAABkfAAADCYAAIR4AABOMTBlbXNjcmlwdGVuMTVzbWFydF9wdHJfdHJhaXRJTlN0M19fMjEwc2hhcmVkX3B0ckkxNW1heGlUaW1lU3RyZXRjaEkxNGhhbm5XaW5GdW5jdG9yRUVFRTExdmFsX2RlbGV0ZXJFAE5TdDNfXzIxMHNoYXJlZF9wdHJJMTVtYXhpVGltZVN0cmV0Y2hJMTRoYW5uV2luRnVuY3RvckVFRQAAADx8AAAcJwAAaQAAAFgnAAAAAAAA3CcAAE8CAABQAgAAUQIAAFICAABTAgAATlN0M19fMjIwX19zaGFyZWRfcHRyX2VtcGxhY2VJMTVtYXhpVGltZVN0cmV0Y2hJMTRoYW5uV2luRnVuY3RvckVOU185YWxsb2NhdG9ySVMzX0VFRUUAAGR8AACEJwAAhHgAAER7AACoJQAA5BgAAOB7AACoJQAARHsAAKglAADgewAAAAAAAFQoAABUAgAAVQIAAFYCAAA5bWF4aUdyYWluSTE0aGFubldpbkZ1bmN0b3JFADEzbWF4aUdyYWluQmFzZQAAAAA8fAAAOSgAAGR8AAAcKAAATCgAAOB7AACoJQAA4HsAAOB7AACkewAA4HsAAGRpaWRkaWQA4HsAAKglAADgewAA4HsAAKR7AAAxNG1heGlQaXRjaFNoaWZ0STE0aGFubldpbkZ1bmN0b3JFAAA8fAAAlCgAAFAxNG1heGlQaXRjaFNoaWZ0STE0aGFubldpbkZ1bmN0b3JFABx9AADAKAAAAAAAALgoAABQSzE0bWF4aVBpdGNoU2hpZnRJMTRoYW5uV2luRnVuY3RvckUAAAAAHH0AAPQoAAABAAAAuCgAAAAAAADkKQAAVwIAAFgCAABZAgAAWgIAAFsCAABOU3QzX18yMjBfX3NoYXJlZF9wdHJfcG9pbnRlcklQMTRtYXhpUGl0Y2hTaGlmdEkxNGhhbm5XaW5GdW5jdG9yRU4xMGVtc2NyaXB0ZW4xNXNtYXJ0X3B0cl90cmFpdElOU18xMHNoYXJlZF9wdHJJUzNfRUVFMTF2YWxfZGVsZXRlckVOU185YWxsb2NhdG9ySVMzX0VFRUUAAABkfAAASCkAAIR4AABOMTBlbXNjcmlwdGVuMTVzbWFydF9wdHJfdHJhaXRJTlN0M19fMjEwc2hhcmVkX3B0ckkxNG1heGlQaXRjaFNoaWZ0STE0aGFubldpbkZ1bmN0b3JFRUVFMTF2YWxfZGVsZXRlckUATlN0M19fMjEwc2hhcmVkX3B0ckkxNG1heGlQaXRjaFNoaWZ0STE0aGFubldpbkZ1bmN0b3JFRUUAPHwAAFcqAACQKgAAAAAAABArAABcAgAAXQIAAF4CAABSAgAAXwIAAE5TdDNfXzIyMF9fc2hhcmVkX3B0cl9lbXBsYWNlSTE0bWF4aVBpdGNoU2hpZnRJMTRoYW5uV2luRnVuY3RvckVOU185YWxsb2NhdG9ySVMzX0VFRUUAAABkfAAAuCoAAIR4AABEewAA5CgAAOQYAEGw1gAL0gHgewAA5CgAAOB7AADgewAApHsAAOB7AAAxMW1heGlTdHJldGNoSTE0aGFubldpbkZ1bmN0b3JFADx8AABIKwAAUDExbWF4aVN0cmV0Y2hJMTRoYW5uV2luRnVuY3RvckUAAAAAHH0AAHArAAAAAAAAaCsAAFBLMTFtYXhpU3RyZXRjaEkxNGhhbm5XaW5GdW5jdG9yRQAAABx9AACkKwAAAQAAAGgrAACUKwAARHsAAJQrAADkGAAA4HsAAJQrAABEewAAlCsAAOB7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////vEsAAKQCAAClAgAAXEkAAHBJAAAAAAAApEkAAKYCAACnAgAATlN0M19fMjhpb3NfYmFzZUUAAAA8fAAAkEkAAAAAAADoSQAAqAIAAKkCAABOU3QzX18yOWJhc2ljX2lvc0ljTlNfMTFjaGFyX3RyYWl0c0ljRUVFRQAAAGR8AAC8SQAApEkAAAAAAAAwSgAAqgIAAKsCAABOU3QzX18yOWJhc2ljX2lvc0l3TlNfMTFjaGFyX3RyYWl0c0l3RUVFRQAAAGR8AAAESgAApEkAAE5TdDNfXzIxNWJhc2ljX3N0cmVhbWJ1ZkljTlNfMTFjaGFyX3RyYWl0c0ljRUVFRQAAAAA8fAAAPEoAAE5TdDNfXzIxNWJhc2ljX3N0cmVhbWJ1Zkl3TlNfMTFjaGFyX3RyYWl0c0l3RUVFRQAAAAA8fAAAeEoAAE5TdDNfXzIxM2Jhc2ljX2lzdHJlYW1JY05TXzExY2hhcl90cmFpdHNJY0VFRUUAAMB8AAC0SgAAAAAAAAEAAADoSQAAA/T//05TdDNfXzIxM2Jhc2ljX2lzdHJlYW1Jd05TXzExY2hhcl90cmFpdHNJd0VFRUUAAMB8AAD8SgAAAAAAAAEAAAAwSgAAA/T//05TdDNfXzIxM2Jhc2ljX29zdHJlYW1JY05TXzExY2hhcl90cmFpdHNJY0VFRUUAAMB8AABESwAAAAAAAAEAAADoSQAAA/T//05TdDNfXzIxM2Jhc2ljX29zdHJlYW1Jd05TXzExY2hhcl90cmFpdHNJd0VFRUUAAMB8AACMSwAAAAAAAAEAAAAwSgAAA/T//wi5AAAAAAAAMEwAAIICAACtAgAArgIAAIUCAACGAgAAhwIAAIgCAABwAgAAcQIAAK8CAACwAgAAsQIAAHUCAACLAgAATlN0M19fMjEwX19zdGRpbmJ1ZkljRUUAZHwAABhMAABwSgAAdW5zdXBwb3J0ZWQgbG9jYWxlIGZvciBzdGFuZGFyZCBpbnB1dAAAAAAAAAC8TAAAjAIAALICAACzAgAAjwIAAJACAACRAgAAkgIAAJMCAACUAgAAtAIAALUCAAC2AgAAmAIAAJkCAABOU3QzX18yMTBfX3N0ZGluYnVmSXdFRQBkfAAApEwAAKxKAAAAAAAAJE0AAIICAAC3AgAAuAIAAIUCAACGAgAAhwIAALkCAABwAgAAcQIAAIkCAABzAgAAigIAALoCAAC7AgAATlN0M19fMjExX19zdGRvdXRidWZJY0VFAAAAAGR8AAAITQAAcEoAAAAAAACMTQAAjAIAALwCAAC9AgAAjwIAAJACAACRAgAAvgIAAJMCAACUAgAAlQIAAJYCAACXAgAAvwIAAMACAABOU3QzX18yMTFfX3N0ZG91dGJ1Zkl3RUUAAAAAZHwAAHBNAACsSgBBoJsBC+ME/////////////////////////////////////////////////////////////////wABAgMEBQYHCAn/////////CgsMDQ4PEBESExQVFhcYGRobHB0eHyAhIiP///////8KCwwNDg8QERITFBUWFxgZGhscHR4fICEiI/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////8AAQIEBwMGBQAAAAAAAAACAADAAwAAwAQAAMAFAADABgAAwAcAAMAIAADACQAAwAoAAMALAADADAAAwA0AAMAOAADADwAAwBAAAMARAADAEgAAwBMAAMAUAADAFQAAwBYAAMAXAADAGAAAwBkAAMAaAADAGwAAwBwAAMAdAADAHgAAwB8AAMAAAACzAQAAwwIAAMMDAADDBAAAwwUAAMMGAADDBwAAwwgAAMMJAADDCgAAwwsAAMMMAADDDQAA0w4AAMMPAADDAAAMuwEADMMCAAzDAwAMwwQADNNpbmZpbml0eQBuYW4AAAAAAAAAANF0ngBXnb0qgHBSD///PicKAAAAZAAAAOgDAAAQJwAAoIYBAEBCDwCAlpgAAOH1BRgAAAA1AAAAcQAAAGv////O+///kr///wAAAAAAAAAA3hIElQAAAAD////////////////gTwAAFAAAAEMuVVRGLTgAQaigAQsC9E8AQcCgAQsGTENfQUxMAEHQoAELbkxDX0NUWVBFAAAAAExDX05VTUVSSUMAAExDX1RJTUUAAAAAAExDX0NPTExBVEUAAExDX01PTkVUQVJZAExDX01FU1NBR0VTAExBTkcAQy5VVEYt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bmcAc3RkOjp1MzJzdHJpbmcAZW1zY3JpcHRlbjo6dmFsAGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PGNoYXI+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHNpZ25lZCBjaGFyPgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzx1bnNpZ25lZCBjaGFyPgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxzaG9ydD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8dW5zaWduZWQgc2hvcnQ+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PGludD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8dW5zaWduZWQgaW50PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxsb25nPgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzx1bnNpZ25lZCBsb25nPgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxpbnQ4X3Q+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHVpbnQ4X3Q+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PGludDE2X3Q+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHVpbnQxNl90PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxpbnQzMl90PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzx1aW50MzJfdD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8ZmxvYXQ+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PGRvdWJsZT4ATlN0M19fMjEyYmFzaWNfc3RyaW5nSWhOU18xMWNoYXJfdHJhaXRzSWhFRU5TXzlhbGxvY2F0b3JJaEVFRUUAAAAAwHwAAEaAAAAAAAAAAQAAAEgaAAAAAAAATlN0M19fMjEyYmFzaWNfc3RyaW5nSXdOU18xMWNoYXJfdHJhaXRzSXdFRU5TXzlhbGxvY2F0b3JJd0VFRUUAAMB8AACggAAAAAAAAAEAAABIGgAAAAAAAE5TdDNfXzIxMmJhc2ljX3N0cmluZ0lEc05TXzExY2hhcl90cmFpdHNJRHNFRU5TXzlhbGxvY2F0b3JJRHNFRUVFAAAAwHwAAPiAAAAAAAAAAQAAAEgaAAAAAAAATlN0M19fMjEyYmFzaWNfc3RyaW5n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niKtQISc9/8h3q5Amzv6XwJasEAAAAAA7FKxQLwi+N+iWrJACkj7Hwhys0CdSgaACpq0QLwi+N+m07VARN0HIOkft0BOJQNA7X+4QAAAAADg9LlAAAAAAACAu0Cy2vy/niK9QISc9/8h3r5AF58CYAJawEAAAAAA7FLBQDiGAOCiWsJAhqsDIAhyw0Ah5/1/CprEQDiGAOCm08VAyHn/H+kfx0BOJQNA7X/IQAAAAADg9MlAT2dnU3ZvcmJpcwAAAAAAAAUAQYTuAgsCeQIAQZzuAgsKegIAAHsCAADAvQBBtO4CCwECAEHD7gILBf//////AEG48AILAuy9AEHw8AILAQUAQfzwAgsCfwIAQZTxAgsOegIAAIACAAAYvgAAAAQAQazxAgsBAQBBu/ECCwUK/////wBBgPICCwlwuAAAAAAAAAkAQZTyAgsCeQIAQajyAgsSgQIAAAAAAAB7AgAAKMIAAAAEAEHU8gILBP////8AvqsIBG5hbWUBtasIuwoAFl9lbWJpbmRfcmVnaXN0ZXJfY2xhc3MBIl9lbWJpbmRfcmVnaXN0ZXJfY2xhc3NfY29uc3RydWN0b3ICJV9lbWJpbmRfcmVnaXN0ZXJfY2xhc3NfY2xhc3NfZnVuY3Rpb24DH19lbWJpbmRfcmVnaXN0ZXJfY2xhc3NfcHJvcGVydHkEH19lbWJpbmRfcmVnaXN0ZXJfY2xhc3NfZnVuY3Rpb24FFV9lbWJpbmRfcmVnaXN0ZXJfZW51bQYbX2VtYmluZF9yZWdpc3Rlcl9lbnVtX3ZhbHVlBxpfZW1iaW5kX3JlZ2lzdGVyX3NtYXJ0X3B0cggYX19jeGFfYWxsb2NhdGVfZXhjZXB0aW9uCQtfX2N4YV90aHJvdwoRX2VtdmFsX3Rha2VfdmFsdWULDV9lbXZhbF9pbmNyZWYMDV9lbXZhbF9kZWNyZWYNC19lbXZhbF9jYWxsDgVyb3VuZA8EZXhpdBANX19hc3NlcnRfZmFpbBEGX19sb2NrEghfX3VubG9jaxMPX193YXNpX2ZkX2Nsb3NlFApfX3N5c2NhbGw1FQxfX3N5c2NhbGwyMjEWC19fc3lzY2FsbDU0Fw5fX3dhc2lfZmRfcmVhZBgPX193YXNpX2ZkX3dyaXRlGRhfX3dhc2lfZW52aXJvbl9zaXplc19nZXQaEl9fd2FzaV9lbnZpcm9uX2dldBsKX19tYXBfZmlsZRwLX19zeXNjYWxsOTEdCnN0cmZ0aW1lX2weBWFib3J0HxVfZW1iaW5kX3JlZ2lzdGVyX3ZvaWQgFV9lbWJpbmRfcmVnaXN0ZXJfYm9vbCEbX2VtYmluZF9yZWdpc3Rlcl9zdGRfc3RyaW5nIhxfZW1iaW5kX3JlZ2lzdGVyX3N0ZF93c3RyaW5nIxZfZW1iaW5kX3JlZ2lzdGVyX2VtdmFsJBhfZW1iaW5kX3JlZ2lzdGVyX2ludGVnZXIlFl9lbWJpbmRfcmVnaXN0ZXJfZmxvYXQmHF9lbWJpbmRfcmVnaXN0ZXJfbWVtb3J5X3ZpZXcnFmVtc2NyaXB0ZW5fcmVzaXplX2hlYXAoFWVtc2NyaXB0ZW5fbWVtY3B5X2JpZykLc2V0VGVtcFJldDAqGmxlZ2FsaW1wb3J0JF9fd2FzaV9mZF9zZWVrKxFfX3dhc21fY2FsbF9jdG9ycyxQRW1zY3JpcHRlbkJpbmRpbmdJbml0aWFsaXplcl9teV9tb2R1bGU6OkVtc2NyaXB0ZW5CaW5kaW5nSW5pdGlhbGl6ZXJfbXlfbW9kdWxlKCktlQFlbXNjcmlwdGVuOjpjbGFzc188c3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+LCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Tm9CYXNlQ2xhc3M+IGVtc2NyaXB0ZW46OnJlZ2lzdGVyX3ZlY3RvcjxpbnQ+KGNoYXIgY29uc3QqKS6eAWVtc2NyaXB0ZW46OmNsYXNzXzxzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4sIGVtc2NyaXB0ZW46OmludGVybmFsOjpOb0Jhc2VDbGFzcz4gZW1zY3JpcHRlbjo6cmVnaXN0ZXJfdmVjdG9yPGRvdWJsZT4oY2hhciBjb25zdCopL5gBZW1zY3JpcHRlbjo6Y2xhc3NfPHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+LCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Tm9CYXNlQ2xhc3M+IGVtc2NyaXB0ZW46OnJlZ2lzdGVyX3ZlY3RvcjxjaGFyPihjaGFyIGNvbnN0KikwswFlbXNjcmlwdGVuOjpjbGFzc188c3RkOjpfXzI6OnZlY3Rvcjx1bnNpZ25lZCBjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHVuc2lnbmVkIGNoYXI+ID4sIGVtc2NyaXB0ZW46OmludGVybmFsOjpOb0Jhc2VDbGFzcz4gZW1zY3JpcHRlbjo6cmVnaXN0ZXJfdmVjdG9yPHVuc2lnbmVkIGNoYXI+KGNoYXIgY29uc3QqKTGbAWVtc2NyaXB0ZW46OmNsYXNzXzxzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+LCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Tm9CYXNlQ2xhc3M+IGVtc2NyaXB0ZW46OnJlZ2lzdGVyX3ZlY3RvcjxmbG9hdD4oY2hhciBjb25zdCopMkp2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTx2ZWN0b3JUb29scz4odmVjdG9yVG9vbHMqKTNEdm9pZCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6cmF3X2Rlc3RydWN0b3I8dmVjdG9yVG9vbHM+KHZlY3RvclRvb2xzKik0R2Vtc2NyaXB0ZW46OmludGVybmFsOjpJbnZva2VyPHZlY3RvclRvb2xzKj46Omludm9rZSh2ZWN0b3JUb29scyogKCopKCkpNT52ZWN0b3JUb29scyogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzx2ZWN0b3JUb29scz4oKTbgAWVtc2NyaXB0ZW46OmludGVybmFsOjpJbnZva2VyPHZvaWQsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiY+OjppbnZva2Uodm9pZCAoKikoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiksIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiopN1R2ZWN0b3JUb29sczo6Y2xlYXJWZWN0b3JEYmwoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+Jik4THZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlTZXR0aW5ncz4obWF4aVNldHRpbmdzKik5YmVtc2NyaXB0ZW46OmludGVybmFsOjpJbnZva2VyPHZvaWQsIGludCwgaW50LCBpbnQ+OjppbnZva2Uodm9pZCAoKikoaW50LCBpbnQsIGludCksIGludCwgaW50LCBpbnQpOiJtYXhpU2V0dGluZ3M6OnNldHVwKGludCwgaW50LCBpbnQpOyNtYXhpU2V0dGluZ3M6OmdldFNhbXBsZVJhdGUoKSBjb25zdDwgbWF4aVNldHRpbmdzOjpzZXRTYW1wbGVSYXRlKGludCk9kwFpbnQgZW1zY3JpcHRlbjo6aW50ZXJuYWw6OkdldHRlclBvbGljeTxpbnQgKG1heGlTZXR0aW5nczo6KikoKSBjb25zdD46OmdldDxtYXhpU2V0dGluZ3M+KGludCAobWF4aVNldHRpbmdzOjoqIGNvbnN0JikoKSBjb25zdCwgbWF4aVNldHRpbmdzIGNvbnN0Jik+jwF2b2lkIGVtc2NyaXB0ZW46OmludGVybmFsOjpTZXR0ZXJQb2xpY3k8dm9pZCAobWF4aVNldHRpbmdzOjoqKShpbnQpPjo6c2V0PG1heGlTZXR0aW5ncz4odm9pZCAobWF4aVNldHRpbmdzOjoqIGNvbnN0JikoaW50KSwgbWF4aVNldHRpbmdzJiwgaW50KT8kbWF4aVNldHRpbmdzOjpnZXROdW1DaGFubmVscygpIGNvbnN0QCFtYXhpU2V0dGluZ3M6OnNldE51bUNoYW5uZWxzKGludClBI21heGlTZXR0aW5nczo6Z2V0QnVmZmVyU2l6ZSgpIGNvbnN0QiBtYXhpU2V0dGluZ3M6OnNldEJ1ZmZlclNpemUoaW50KUNCdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aU9zYz4obWF4aU9zYyopRDZtYXhpT3NjKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlPc2M+KClFmAFlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlPc2M6OiopKGRvdWJsZSksIGRvdWJsZSwgbWF4aU9zYyosIGRvdWJsZT46Omludm9rZShkb3VibGUgKG1heGlPc2M6OiogY29uc3QmKShkb3VibGUpLCBtYXhpT3NjKiwgZG91YmxlKUbYAWVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aU9zYzo6KikoZG91YmxlLCBkb3VibGUsIGRvdWJsZSksIGRvdWJsZSwgbWF4aU9zYyosIGRvdWJsZSwgZG91YmxlLCBkb3VibGU+OjppbnZva2UoZG91YmxlIChtYXhpT3NjOjoqIGNvbnN0JikoZG91YmxlLCBkb3VibGUsIGRvdWJsZSksIG1heGlPc2MqLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKUe4AWVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aU9zYzo6KikoZG91YmxlLCBkb3VibGUpLCBkb3VibGUsIG1heGlPc2MqLCBkb3VibGUsIGRvdWJsZT46Omludm9rZShkb3VibGUgKG1heGlPc2M6OiogY29uc3QmKShkb3VibGUsIGRvdWJsZSksIG1heGlPc2MqLCBkb3VibGUsIGRvdWJsZSlIfGVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aU9zYzo6KikoKSwgZG91YmxlLCBtYXhpT3NjKj46Omludm9rZShkb3VibGUgKG1heGlPc2M6OiogY29uc3QmKSgpLCBtYXhpT3NjKilJkgFlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChtYXhpT3NjOjoqKShkb3VibGUpLCB2b2lkLCBtYXhpT3NjKiwgZG91YmxlPjo6aW52b2tlKHZvaWQgKG1heGlPc2M6OiogY29uc3QmKShkb3VibGUpLCBtYXhpT3NjKiwgZG91YmxlKUpMdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aUVudmVsb3BlPihtYXhpRW52ZWxvcGUqKUtAbWF4aUVudmVsb3BlKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlFbnZlbG9wZT4oKUyEA2Vtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aUVudmVsb3BlOjoqKShpbnQsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYpLCBkb3VibGUsIG1heGlFbnZlbG9wZSosIGludCwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+Jj46Omludm9rZShkb3VibGUgKG1heGlFbnZlbG9wZTo6KiBjb25zdCYpKGludCwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiksIG1heGlFbnZlbG9wZSosIGludCwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KilNugFlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChtYXhpRW52ZWxvcGU6OiopKGludCwgZG91YmxlKSwgdm9pZCwgbWF4aUVudmVsb3BlKiwgaW50LCBkb3VibGU+OjppbnZva2Uodm9pZCAobWF4aUVudmVsb3BlOjoqIGNvbnN0JikoaW50LCBkb3VibGUpLCBtYXhpRW52ZWxvcGUqLCBpbnQsIGRvdWJsZSlOIm1heGlFbnZlbG9wZTo6Z2V0QW1wbGl0dWRlKCkgY29uc3RPIm1heGlFbnZlbG9wZTo6c2V0QW1wbGl0dWRlKGRvdWJsZSlQIW1heGlFbnZlbG9wZTo6Z2V0VmFsaW5kZXgoKSBjb25zdFEebWF4aUVudmVsb3BlOjpzZXRWYWxpbmRleChpbnQpUk52b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpRGVsYXlsaW5lPihtYXhpRGVsYXlsaW5lKilTQm1heGlEZWxheWxpbmUqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aURlbGF5bGluZT4oKVTkAWVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aURlbGF5bGluZTo6KikoZG91YmxlLCBpbnQsIGRvdWJsZSksIGRvdWJsZSwgbWF4aURlbGF5bGluZSosIGRvdWJsZSwgaW50LCBkb3VibGU+OjppbnZva2UoZG91YmxlIChtYXhpRGVsYXlsaW5lOjoqIGNvbnN0JikoZG91YmxlLCBpbnQsIGRvdWJsZSksIG1heGlEZWxheWxpbmUqLCBkb3VibGUsIGludCwgZG91YmxlKVX4AWVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aURlbGF5bGluZTo6KikoZG91YmxlLCBpbnQsIGRvdWJsZSwgaW50KSwgZG91YmxlLCBtYXhpRGVsYXlsaW5lKiwgZG91YmxlLCBpbnQsIGRvdWJsZSwgaW50Pjo6aW52b2tlKGRvdWJsZSAobWF4aURlbGF5bGluZTo6KiBjb25zdCYpKGRvdWJsZSwgaW50LCBkb3VibGUsIGludCksIG1heGlEZWxheWxpbmUqLCBkb3VibGUsIGludCwgZG91YmxlLCBpbnQpVkh2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpRmlsdGVyPihtYXhpRmlsdGVyKilXPG1heGlGaWx0ZXIqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aUZpbHRlcj4oKVgdbWF4aUZpbHRlcjo6Z2V0Q3V0b2ZmKCkgY29uc3RZHW1heGlGaWx0ZXI6OnNldEN1dG9mZihkb3VibGUpWiBtYXhpRmlsdGVyOjpnZXRSZXNvbmFuY2UoKSBjb25zdFsgbWF4aUZpbHRlcjo6c2V0UmVzb25hbmNlKGRvdWJsZSlcQnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlNaXg+KG1heGlNaXgqKV02bWF4aU1peCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpTWl4PigpXpYDZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAobWF4aU1peDo6KikoZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBkb3VibGUpLCB2b2lkLCBtYXhpTWl4KiwgZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBkb3VibGU+OjppbnZva2Uodm9pZCAobWF4aU1peDo6KiBjb25zdCYpKGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgZG91YmxlKSwgbWF4aU1peCosIGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KiwgZG91YmxlKV+2A2Vtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKG1heGlNaXg6OiopKGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgZG91YmxlLCBkb3VibGUpLCB2b2lkLCBtYXhpTWl4KiwgZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBkb3VibGUsIGRvdWJsZT46Omludm9rZSh2b2lkIChtYXhpTWl4OjoqIGNvbnN0JikoZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBkb3VibGUsIGRvdWJsZSksIG1heGlNaXgqLCBkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiosIGRvdWJsZSwgZG91YmxlKWDWA2Vtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKG1heGlNaXg6OiopKGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSksIHZvaWQsIG1heGlNaXgqLCBkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGRvdWJsZSwgZG91YmxlLCBkb3VibGU+OjppbnZva2Uodm9pZCAobWF4aU1peDo6KiBjb25zdCYpKGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSksIG1heGlNaXgqLCBkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUpYUR2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpTGluZT4obWF4aUxpbmUqKWI4bWF4aUxpbmUqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aUxpbmU+KCljFm1heGlMaW5lOjpwbGF5KGRvdWJsZSlkL21heGlMaW5lOjpwcmVwYXJlKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGJvb2wpZe4BZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAobWF4aUxpbmU6OiopKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGJvb2wpLCB2b2lkLCBtYXhpTGluZSosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGJvb2w+OjppbnZva2Uodm9pZCAobWF4aUxpbmU6OiogY29uc3QmKShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBib29sKSwgbWF4aUxpbmUqLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBib29sKWYfbWF4aUxpbmU6OnRyaWdnZXJFbmFibGUoZG91YmxlKWcabWF4aUxpbmU6OmlzTGluZUNvbXBsZXRlKCloRnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlYRmFkZT4obWF4aVhGYWRlKilphwRlbXNjcmlwdGVuOjppbnRlcm5hbDo6SW52b2tlcjxzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4sIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGRvdWJsZT46Omludm9rZShzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4gKCopKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGRvdWJsZSksIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiosIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiosIGRvdWJsZSlqigFtYXhpWEZhZGU6OnhmYWRlKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGRvdWJsZSlrgQFlbXNjcmlwdGVuOjppbnRlcm5hbDo6SW52b2tlcjxkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGU+OjppbnZva2UoZG91YmxlICgqKShkb3VibGUsIGRvdWJsZSwgZG91YmxlKSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSlsKG1heGlYRmFkZTo6eGZhZGUoZG91YmxlLCBkb3VibGUsIGRvdWJsZSltWXZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlMYWdFeHA8ZG91YmxlPiA+KG1heGlMYWdFeHA8ZG91YmxlPiopbk1tYXhpTGFnRXhwPGRvdWJsZT4qIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aUxhZ0V4cDxkb3VibGU+ID4oKW8obWF4aUxhZ0V4cDxkb3VibGU+Ojppbml0KGRvdWJsZSwgZG91YmxlKXDeAWVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKG1heGlMYWdFeHA8ZG91YmxlPjo6KikoZG91YmxlLCBkb3VibGUpLCB2b2lkLCBtYXhpTGFnRXhwPGRvdWJsZT4qLCBkb3VibGUsIGRvdWJsZT46Omludm9rZSh2b2lkIChtYXhpTGFnRXhwPGRvdWJsZT46OiogY29uc3QmKShkb3VibGUsIGRvdWJsZSksIG1heGlMYWdFeHA8ZG91YmxlPiosIGRvdWJsZSwgZG91YmxlKXElbWF4aUxhZ0V4cDxkb3VibGU+OjphZGRTYW1wbGUoZG91YmxlKXIhbWF4aUxhZ0V4cDxkb3VibGU+Ojp2YWx1ZSgpIGNvbnN0cyRtYXhpTGFnRXhwPGRvdWJsZT46OmdldEFscGhhKCkgY29uc3R0JG1heGlMYWdFeHA8ZG91YmxlPjo6c2V0QWxwaGEoZG91YmxlKXUubWF4aUxhZ0V4cDxkb3VibGU+OjpnZXRBbHBoYVJlY2lwcm9jYWwoKSBjb25zdHYubWF4aUxhZ0V4cDxkb3VibGU+OjpzZXRBbHBoYVJlY2lwcm9jYWwoZG91YmxlKXcibWF4aUxhZ0V4cDxkb3VibGU+OjpzZXRWYWwoZG91YmxlKXhIdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aVNhbXBsZT4obWF4aVNhbXBsZSopeUJ2b2lkIGVtc2NyaXB0ZW46OmludGVybmFsOjpyYXdfZGVzdHJ1Y3RvcjxtYXhpU2FtcGxlPihtYXhpU2FtcGxlKil6PG1heGlTYW1wbGUqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aVNhbXBsZT4oKXsdbWF4aVNhbXBsZTo6Z2V0TGVuZ3RoKCkgY29uc3R89gJlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChtYXhpU2FtcGxlOjoqKShzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBpbnQpLCB2b2lkLCBtYXhpU2FtcGxlKiwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgaW50Pjo6aW52b2tlKHZvaWQgKG1heGlTYW1wbGU6OiogY29uc3QmKShzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mLCBpbnQpLCBtYXhpU2FtcGxlKiwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KiwgaW50KX2rA2Vtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGludCAobWF4aVNhbXBsZTo6Kikoc3RkOjpfXzI6OnZlY3Rvcjx1bnNpZ25lZCBjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHVuc2lnbmVkIGNoYXI+ID4mLCBpbnQpLCBpbnQsIG1heGlTYW1wbGUqLCBzdGQ6Ol9fMjo6dmVjdG9yPHVuc2lnbmVkIGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8dW5zaWduZWQgY2hhcj4gPiYsIGludD46Omludm9rZShpbnQgKG1heGlTYW1wbGU6OiogY29uc3QmKShzdGQ6Ol9fMjo6dmVjdG9yPHVuc2lnbmVkIGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8dW5zaWduZWQgY2hhcj4gPiYsIGludCksIG1heGlTYW1wbGUqLCBzdGQ6Ol9fMjo6dmVjdG9yPHVuc2lnbmVkIGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8dW5zaWduZWQgY2hhcj4gPiosIGludCl+ggFlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChtYXhpU2FtcGxlOjoqKSgpLCB2b2lkLCBtYXhpU2FtcGxlKj46Omludm9rZSh2b2lkIChtYXhpU2FtcGxlOjoqIGNvbnN0JikoKSwgbWF4aVNhbXBsZSopfxNtYXhpU2FtcGxlOjpjbGVhcigpgAHmAWVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKG1heGlTYW1wbGU6OiopKGZsb2F0LCBmbG9hdCwgYm9vbCwgYm9vbCksIHZvaWQsIG1heGlTYW1wbGUqLCBmbG9hdCwgZmxvYXQsIGJvb2wsIGJvb2w+OjppbnZva2Uodm9pZCAobWF4aVNhbXBsZTo6KiBjb25zdCYpKGZsb2F0LCBmbG9hdCwgYm9vbCwgYm9vbCksIG1heGlTYW1wbGUqLCBmbG9hdCwgZmxvYXQsIGJvb2wsIGJvb2wpgQGjBGVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGJvb2wgKG1heGlTYW1wbGU6OiopKHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4sIGludCksIGJvb2wsIG1heGlTYW1wbGUqLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+LCBpbnQ+OjppbnZva2UoYm9vbCAobWF4aVNhbXBsZTo6KiBjb25zdCYpKHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4sIGludCksIG1heGlTYW1wbGUqLCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6QmluZGluZ1R5cGU8c3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiwgdm9pZD46Oid1bm5hbWVkJyosIGludCmCAUJ2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpTWFwPihtYXhpTWFwKimDATdtYXhpTWFwOjpsaW5saW4oZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUphAHuAWVtc2NyaXB0ZW46OmludGVybmFsOjpGdW5jdGlvbkludm9rZXI8ZG91YmxlICgqKShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSksIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGU+OjppbnZva2UoZG91YmxlICgqKikoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUpLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSmFATdtYXhpTWFwOjpsaW5leHAoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUphgE3bWF4aU1hcDo6ZXhwbGluKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKYcBNWRvdWJsZSBtYXhpTWFwOjpjbGFtcDxkb3VibGU+KGRvdWJsZSwgZG91YmxlLCBkb3VibGUpiAGuAWVtc2NyaXB0ZW46OmludGVybmFsOjpGdW5jdGlvbkludm9rZXI8ZG91YmxlICgqKShkb3VibGUsIGRvdWJsZSwgZG91YmxlKSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlPjo6aW52b2tlKGRvdWJsZSAoKiopKGRvdWJsZSwgZG91YmxlLCBkb3VibGUpLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKYkBsQFlbXNjcmlwdGVuOjppbnRlcm5hbDo6SW52b2tlcjxkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlPjo6aW52b2tlKGRvdWJsZSAoKikoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUpLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSmKAUJ2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpRHluPihtYXhpRHluKimLATZtYXhpRHluKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlEeW4+KCmMAZACZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpRHluOjoqKShkb3VibGUsIGRvdWJsZSwgbG9uZywgZG91YmxlLCBkb3VibGUpLCBkb3VibGUsIG1heGlEeW4qLCBkb3VibGUsIGRvdWJsZSwgbG9uZywgZG91YmxlLCBkb3VibGU+OjppbnZva2UoZG91YmxlIChtYXhpRHluOjoqIGNvbnN0JikoZG91YmxlLCBkb3VibGUsIGxvbmcsIGRvdWJsZSwgZG91YmxlKSwgbWF4aUR5biosIGRvdWJsZSwgZG91YmxlLCBsb25nLCBkb3VibGUsIGRvdWJsZSmNAZgCZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpRHluOjoqKShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSksIGRvdWJsZSwgbWF4aUR5biosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlPjo6aW52b2tlKGRvdWJsZSAobWF4aUR5bjo6KiBjb25zdCYpKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKSwgbWF4aUR5biosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKY4BQnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlFbnY+KG1heGlFbnYqKY8BNm1heGlFbnYqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aUVudj4oKZABhAJlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlFbnY6OiopKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGxvbmcsIGludCksIGRvdWJsZSwgbWF4aUVudiosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGxvbmcsIGludD46Omludm9rZShkb3VibGUgKG1heGlFbnY6OiogY29uc3QmKShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBsb25nLCBpbnQpLCBtYXhpRW52KiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgbG9uZywgaW50KZEBxAJlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlFbnY6OiopKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBsb25nLCBpbnQpLCBkb3VibGUsIG1heGlFbnYqLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgbG9uZywgaW50Pjo6aW52b2tlKGRvdWJsZSAobWF4aUVudjo6KiBjb25zdCYpKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBsb25nLCBpbnQpLCBtYXhpRW52KiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGxvbmcsIGludCmSAawBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpRW52OjoqKShkb3VibGUsIGludCksIGRvdWJsZSwgbWF4aUVudiosIGRvdWJsZSwgaW50Pjo6aW52b2tlKGRvdWJsZSAobWF4aUVudjo6KiBjb25zdCYpKGRvdWJsZSwgaW50KSwgbWF4aUVudiosIGRvdWJsZSwgaW50KZMBG21heGlFbnY6OmdldFRyaWdnZXIoKSBjb25zdJQBGG1heGlFbnY6OnNldFRyaWdnZXIoaW50KZUBQnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPGNvbnZlcnQ+KGNvbnZlcnQqKZYBYmVtc2NyaXB0ZW46OmludGVybmFsOjpGdW5jdGlvbkludm9rZXI8ZG91YmxlICgqKShpbnQpLCBkb3VibGUsIGludD46Omludm9rZShkb3VibGUgKCoqKShpbnQpLCBpbnQplwFIZW1zY3JpcHRlbjo6aW50ZXJuYWw6Okludm9rZXI8ZG91YmxlLCBpbnQ+OjppbnZva2UoZG91YmxlICgqKShpbnQpLCBpbnQpmAEaY29udmVydDo6bXNUb1NhbXBzKGRvdWJsZSmZAW5lbXNjcmlwdGVuOjppbnRlcm5hbDo6RnVuY3Rpb25JbnZva2VyPGRvdWJsZSAoKikoZG91YmxlKSwgZG91YmxlLCBkb3VibGU+OjppbnZva2UoZG91YmxlICgqKikoZG91YmxlKSwgZG91YmxlKZoBUWVtc2NyaXB0ZW46OmludGVybmFsOjpJbnZva2VyPGRvdWJsZSwgZG91YmxlPjo6aW52b2tlKGRvdWJsZSAoKikoZG91YmxlKSwgZG91YmxlKZsBVnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlTYW1wbGVBbmRIb2xkPihtYXhpU2FtcGxlQW5kSG9sZCopnAFKbWF4aVNhbXBsZUFuZEhvbGQqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aVNhbXBsZUFuZEhvbGQ+KCmdASZtYXhpU2FtcGxlQW5kSG9sZDo6c2FoKGRvdWJsZSwgZG91YmxlKZ4BVHZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlOb25saW5lYXJpdHk+KG1heGlOb25saW5lYXJpdHkqKZ8BIm1heGlOb25saW5lYXJpdHk6OmZhc3RhdGFuKGRvdWJsZSmgASptYXhpTm9ubGluZWFyaXR5OjphdGFuRGlzdChkb3VibGUsIGRvdWJsZSmhAS5tYXhpTm9ubGluZWFyaXR5OjpmYXN0QXRhbkRpc3QoZG91YmxlLCBkb3VibGUpogEibWF4aU5vbmxpbmVhcml0eTo6c29mdGNsaXAoZG91YmxlKaMBIm1heGlOb25saW5lYXJpdHk6OmhhcmRjbGlwKGRvdWJsZSmkATJtYXhpTm9ubGluZWFyaXR5Ojphc3ltY2xpcChkb3VibGUsIGRvdWJsZSwgZG91YmxlKaUBSnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlGbGFuZ2VyPihtYXhpRmxhbmdlcioppgE+bWF4aUZsYW5nZXIqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aUZsYW5nZXI+KCmnAUFtYXhpRmxhbmdlcjo6ZmxhbmdlKGRvdWJsZSwgdW5zaWduZWQgaW50LCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKagBwAJlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlGbGFuZ2VyOjoqKShkb3VibGUsIHVuc2lnbmVkIGludCwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSksIGRvdWJsZSwgbWF4aUZsYW5nZXIqLCBkb3VibGUsIHVuc2lnbmVkIGludCwgZG91YmxlLCBkb3VibGUsIGRvdWJsZT46Omludm9rZShkb3VibGUgKG1heGlGbGFuZ2VyOjoqIGNvbnN0JikoZG91YmxlLCB1bnNpZ25lZCBpbnQsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUpLCBtYXhpRmxhbmdlciosIGRvdWJsZSwgdW5zaWduZWQgaW50LCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKakBSHZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlDaG9ydXM+KG1heGlDaG9ydXMqKaoBPG1heGlDaG9ydXMqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aUNob3J1cz4oKasBQG1heGlDaG9ydXM6OmNob3J1cyhkb3VibGUsIHVuc2lnbmVkIGludCwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSmsAU52b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpRENCbG9ja2VyPihtYXhpRENCbG9ja2VyKimtAUJtYXhpRENCbG9ja2VyKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlEQ0Jsb2NrZXI+KCmuASNtYXhpRENCbG9ja2VyOjpwbGF5KGRvdWJsZSwgZG91YmxlKa8BQnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlTVkY+KG1heGlTVkYqKbABNm1heGlTVkYqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aVNWRj4oKbEBGm1heGlTVkY6OnNldEN1dG9mZihkb3VibGUpsgEdbWF4aVNWRjo6c2V0UmVzb25hbmNlKGRvdWJsZSmzATVtYXhpU1ZGOjpwbGF5KGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKbQBRHZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlNYXRoPihtYXhpTWF0aCoptQFpZW1zY3JpcHRlbjo6aW50ZXJuYWw6Okludm9rZXI8ZG91YmxlLCBkb3VibGUsIGRvdWJsZT46Omludm9rZShkb3VibGUgKCopKGRvdWJsZSwgZG91YmxlKSwgZG91YmxlLCBkb3VibGUptgEdbWF4aU1hdGg6OmFkZChkb3VibGUsIGRvdWJsZSm3AR1tYXhpTWF0aDo6c3ViKGRvdWJsZSwgZG91YmxlKbgBHW1heGlNYXRoOjptdWwoZG91YmxlLCBkb3VibGUpuQEdbWF4aU1hdGg6OmRpdihkb3VibGUsIGRvdWJsZSm6ARxtYXhpTWF0aDo6Z3QoZG91YmxlLCBkb3VibGUpuwEcbWF4aU1hdGg6Omx0KGRvdWJsZSwgZG91YmxlKbwBHW1heGlNYXRoOjpndGUoZG91YmxlLCBkb3VibGUpvQEdbWF4aU1hdGg6Omx0ZShkb3VibGUsIGRvdWJsZSm+AR1tYXhpTWF0aDo6bW9kKGRvdWJsZSwgZG91YmxlKb8BFW1heGlNYXRoOjphYnMoZG91YmxlKcABH21heGlNYXRoOjp4cG93eShkb3VibGUsIGRvdWJsZSnBAUZ2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpQ2xvY2s+KG1heGlDbG9jayopwgE6bWF4aUNsb2NrKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlDbG9jaz4oKcMBGW1heGlDbG9jazo6aXNUaWNrKCkgY29uc3TEASJtYXhpQ2xvY2s6OmdldEN1cnJlbnRDb3VudCgpIGNvbnN0xQEfbWF4aUNsb2NrOjpzZXRDdXJyZW50Q291bnQoaW50KcYBH21heGlDbG9jazo6Z2V0TGFzdENvdW50KCkgY29uc3THARxtYXhpQ2xvY2s6OnNldExhc3RDb3VudChpbnQpyAEZbWF4aUNsb2NrOjpnZXRCcHMoKSBjb25zdMkBFm1heGlDbG9jazo6c2V0QnBzKGludCnKARltYXhpQ2xvY2s6OmdldEJwbSgpIGNvbnN0ywEWbWF4aUNsb2NrOjpzZXRCcG0oaW50KcwBF21heGlDbG9jazo6c2V0VGljayhpbnQpzQEbbWF4aUNsb2NrOjpnZXRUaWNrcygpIGNvbnN0zgEYbWF4aUNsb2NrOjpzZXRUaWNrcyhpbnQpzwFgdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aUt1cmFtb3RvT3NjaWxsYXRvcj4obWF4aUt1cmFtb3RvT3NjaWxsYXRvciop0AFUbWF4aUt1cmFtb3RvT3NjaWxsYXRvciogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yPigp0QFkbWF4aUt1cmFtb3RvT3NjaWxsYXRvcjo6cGxheShkb3VibGUsIGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KdIB1gNlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlLdXJhbW90b09zY2lsbGF0b3I6OiopKGRvdWJsZSwgZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4pLCBkb3VibGUsIG1heGlLdXJhbW90b09zY2lsbGF0b3IqLCBkb3VibGUsIGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+ID46Omludm9rZShkb3VibGUgKG1heGlLdXJhbW90b09zY2lsbGF0b3I6OiogY29uc3QmKShkb3VibGUsIGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KSwgbWF4aUt1cmFtb3RvT3NjaWxsYXRvciosIGRvdWJsZSwgZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4qKdMBZnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQ+KG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQqKdQBYHZvaWQgZW1zY3JpcHRlbjo6aW50ZXJuYWw6OnJhd19kZXN0cnVjdG9yPG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQ+KG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQqKdUBngFlbXNjcmlwdGVuOjppbnRlcm5hbDo6SW52b2tlcjxtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0KiwgdW5zaWduZWQgbG9uZyBjb25zdCYmPjo6aW52b2tlKG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQqICgqKSh1bnNpZ25lZCBsb25nIGNvbnN0JiYpLCB1bnNpZ25lZCBsb25nKdYBhAFtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQsIHVuc2lnbmVkIGxvbmcgY29uc3Q+KHVuc2lnbmVkIGxvbmcgY29uc3QmJinXAS9tYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0OjpwbGF5KGRvdWJsZSwgZG91YmxlKdgBOm1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQ6OnNldFBoYXNlKGRvdWJsZSwgdW5zaWduZWQgbG9uZynZAZYCZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAobWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldDo6KikoZG91YmxlLCB1bnNpZ25lZCBsb25nKSwgdm9pZCwgbWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldCosIGRvdWJsZSwgdW5zaWduZWQgbG9uZz46Omludm9rZSh2b2lkIChtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0OjoqIGNvbnN0JikoZG91YmxlLCB1bnNpZ25lZCBsb25nKSwgbWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldCosIGRvdWJsZSwgdW5zaWduZWQgbG9uZynaAWNtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0OjpzZXRQaGFzZXMoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+IGNvbnN0JinbATJtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0OjpnZXRQaGFzZSh1bnNpZ25lZCBsb25nKdwB/AFlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQ6OiopKHVuc2lnbmVkIGxvbmcpLCBkb3VibGUsIG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQqLCB1bnNpZ25lZCBsb25nPjo6aW52b2tlKGRvdWJsZSAobWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldDo6KiBjb25zdCYpKHVuc2lnbmVkIGxvbmcpLCBtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0KiwgdW5zaWduZWQgbG9uZyndASFtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0OjpzaXplKCneAWp2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpQXN5bmNLdXJhbW90b09zY2lsbGF0b3I+KG1heGlBc3luY0t1cmFtb3RvT3NjaWxsYXRvciop3wGsAW1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQqIGVtc2NyaXB0ZW46OmJhc2U8bWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldD46OmNvbnZlcnRQb2ludGVyPG1heGlBc3luY0t1cmFtb3RvT3NjaWxsYXRvciwgbWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldD4obWF4aUFzeW5jS3VyYW1vdG9Pc2NpbGxhdG9yKingAYgBbWF4aUFzeW5jS3VyYW1vdG9Pc2NpbGxhdG9yKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlBc3luY0t1cmFtb3RvT3NjaWxsYXRvciwgdW5zaWduZWQgbG9uZyBjb25zdD4odW5zaWduZWQgbG9uZyBjb25zdCYmKeEBMW1heGlBc3luY0t1cmFtb3RvT3NjaWxsYXRvcjo6cGxheShkb3VibGUsIGRvdWJsZSniATxtYXhpQXN5bmNLdXJhbW90b09zY2lsbGF0b3I6OnNldFBoYXNlKGRvdWJsZSwgdW5zaWduZWQgbG9uZynjAWVtYXhpQXN5bmNLdXJhbW90b09zY2lsbGF0b3I6OnNldFBoYXNlcyhzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4gY29uc3QmKeQBQnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlGRlQ+KG1heGlGRlQqKeUBPHZvaWQgZW1zY3JpcHRlbjo6aW50ZXJuYWw6OnJhd19kZXN0cnVjdG9yPG1heGlGRlQ+KG1heGlGRlQqKeYBNm1heGlGRlQqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aUZGVD4oKecBrgFlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChtYXhpRkZUOjoqKShpbnQsIGludCwgaW50KSwgdm9pZCwgbWF4aUZGVCosIGludCwgaW50LCBpbnQ+OjppbnZva2Uodm9pZCAobWF4aUZGVDo6KiBjb25zdCYpKGludCwgaW50LCBpbnQpLCBtYXhpRkZUKiwgaW50LCBpbnQsIGludCnoAdoBZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8Ym9vbCAobWF4aUZGVDo6KikoZmxvYXQsIG1heGlGRlQ6OmZmdE1vZGVzKSwgYm9vbCwgbWF4aUZGVCosIGZsb2F0LCBtYXhpRkZUOjpmZnRNb2Rlcz46Omludm9rZShib29sIChtYXhpRkZUOjoqIGNvbnN0JikoZmxvYXQsIG1heGlGRlQ6OmZmdE1vZGVzKSwgbWF4aUZGVCosIGZsb2F0LCBtYXhpRkZUOjpmZnRNb2RlcynpAXllbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxmbG9hdCAobWF4aUZGVDo6KikoKSwgZmxvYXQsIG1heGlGRlQqPjo6aW52b2tlKGZsb2F0IChtYXhpRkZUOjoqIGNvbnN0JikoKSwgbWF4aUZGVCop6gGJAmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mIChtYXhpRkZUOjoqKSgpLCBzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+JiwgbWF4aUZGVCo+OjppbnZva2Uoc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiYgKG1heGlGRlQ6OiogY29uc3QmKSgpLCBtYXhpRkZUKinrARptYXhpRkZUOjpnZXRNYWduaXR1ZGVzREIoKewBFG1heGlGRlQ6OmdldFBoYXNlcygp7QEVbWF4aUZGVDo6Z2V0TnVtQmlucygp7gEVbWF4aUZGVDo6Z2V0RkZUU2l6ZSgp7wEVbWF4aUZGVDo6Z2V0SG9wU2l6ZSgp8AEYbWF4aUZGVDo6Z2V0V2luZG93U2l6ZSgp8QFEdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aUlGRlQ+KG1heGlJRkZUKinyAT52b2lkIGVtc2NyaXB0ZW46OmludGVybmFsOjpyYXdfZGVzdHJ1Y3RvcjxtYXhpSUZGVD4obWF4aUlGRlQqKfMBOG1heGlJRkZUKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlJRkZUPigp9AGBBWVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGZsb2F0IChtYXhpSUZGVDo6Kikoc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiYsIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mLCBtYXhpSUZGVDo6ZmZ0TW9kZXMpLCBmbG9hdCwgbWF4aUlGRlQqLCBzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+Jiwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiYsIG1heGlJRkZUOjpmZnRNb2Rlcz46Omludm9rZShmbG9hdCAobWF4aUlGRlQ6OiogY29uc3QmKShzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+Jiwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiYsIG1heGlJRkZUOjpmZnRNb2RlcyksIG1heGlJRkZUKiwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiosIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4qLCBtYXhpSUZGVDo6ZmZ0TW9kZXMp9QFldm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+ID4obWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+Kin2AV92b2lkIGVtc2NyaXB0ZW46OmludGVybmFsOjpyYXdfZGVzdHJ1Y3RvcjxtYXhpTUZDQ0FuYWx5c2VyPGRvdWJsZT4gPihtYXhpTUZDQ0FuYWx5c2VyPGRvdWJsZT4qKfcBWW1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPiogZW1zY3JpcHRlbjo6aW50ZXJuYWw6Om9wZXJhdG9yX25ldzxtYXhpTUZDQ0FuYWx5c2VyPGRvdWJsZT4gPigp+AFZbWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+OjpzZXR1cCh1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50LCBkb3VibGUsIGRvdWJsZSn5AZ4DZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAobWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+OjoqKSh1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50LCBkb3VibGUsIGRvdWJsZSksIHZvaWQsIG1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPiosIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQsIGRvdWJsZSwgZG91YmxlPjo6aW52b2tlKHZvaWQgKG1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPjo6KiBjb25zdCYpKHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQsIGRvdWJsZSwgZG91YmxlKSwgbWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+KiwgdW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgZG91YmxlLCBkb3VibGUp+gFVbWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+OjptZmNjKHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mKfsBqwRlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mIChtYXhpTUZDQ0FuYWx5c2VyPGRvdWJsZT46OiopKHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mKSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgbWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+Kiwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiY+OjppbnZva2Uoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiAobWF4aU1GQ0NBbmFseXNlcjxkb3VibGU+OjoqIGNvbnN0Jikoc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiYpLCBtYXhpTUZDQ0FuYWx5c2VyPGRvdWJsZT4qLCBzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+Kin8AZUBdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8c3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+ID4oc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+Kin9AY8Bdm9pZCBlbXNjcmlwdGVuOjppbnRlcm5hbDo6cmF3X2Rlc3RydWN0b3I8c3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+ID4oc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+Kin+AYkBc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiA+KCn/AUdzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID46OnB1c2hfYmFjayhpbnQgY29uc3QmKYACvwJlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID46OiopKGludCBjb25zdCYpLCB2b2lkLCBzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4qLCBpbnQgY29uc3QmPjo6aW52b2tlKHZvaWQgKHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPjo6KiBjb25zdCYpKGludCBjb25zdCYpLCBzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4qLCBpbnQpgQJTc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+OjpyZXNpemUodW5zaWduZWQgbG9uZywgaW50IGNvbnN0JimCAvsCZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAoc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+OjoqKSh1bnNpZ25lZCBsb25nLCBpbnQgY29uc3QmKSwgdm9pZCwgc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+KiwgdW5zaWduZWQgbG9uZywgaW50IGNvbnN0Jj46Omludm9rZSh2b2lkIChzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID46OiogY29uc3QmKSh1bnNpZ25lZCBsb25nLCBpbnQgY29uc3QmKSwgc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+KiwgdW5zaWduZWQgbG9uZywgaW50KYMCPnN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPjo6c2l6ZSgpIGNvbnN0hAKiAWVtc2NyaXB0ZW46OmludGVybmFsOjpWZWN0b3JBY2Nlc3M8c3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+ID46OmdldChzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4gY29uc3QmLCB1bnNpZ25lZCBsb25nKYUCgwNlbXNjcmlwdGVuOjppbnRlcm5hbDo6RnVuY3Rpb25JbnZva2VyPGVtc2NyaXB0ZW46OnZhbCAoKikoc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+IGNvbnN0JiwgdW5zaWduZWQgbG9uZyksIGVtc2NyaXB0ZW46OnZhbCwgc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+IGNvbnN0JiwgdW5zaWduZWQgbG9uZz46Omludm9rZShlbXNjcmlwdGVuOjp2YWwgKCoqKShzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4gY29uc3QmLCB1bnNpZ25lZCBsb25nKSwgc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+KiwgdW5zaWduZWQgbG9uZymGAqgBZW1zY3JpcHRlbjo6aW50ZXJuYWw6OlZlY3RvckFjY2VzczxzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4gPjo6c2V0KHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiYsIHVuc2lnbmVkIGxvbmcsIGludCBjb25zdCYphwL5AmVtc2NyaXB0ZW46OmludGVybmFsOjpGdW5jdGlvbkludm9rZXI8Ym9vbCAoKikoc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+JiwgdW5zaWduZWQgbG9uZywgaW50IGNvbnN0JiksIGJvb2wsIHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiYsIHVuc2lnbmVkIGxvbmcsIGludCBjb25zdCY+OjppbnZva2UoYm9vbCAoKiopKHN0ZDo6X18yOjp2ZWN0b3I8aW50LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGludD4gPiYsIHVuc2lnbmVkIGxvbmcsIGludCBjb25zdCYpLCBzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID4qLCB1bnNpZ25lZCBsb25nLCBpbnQpiAKhAXZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiA+KHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiopiQJQc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+OjpwdXNoX2JhY2soZG91YmxlIGNvbnN0JimKAuMCZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+OjoqKShkb3VibGUgY29uc3QmKSwgdm9pZCwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KiwgZG91YmxlIGNvbnN0Jj46Omludm9rZSh2b2lkIChzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID46OiogY29uc3QmKShkb3VibGUgY29uc3QmKSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KiwgZG91YmxlKYsCXHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPjo6cmVzaXplKHVuc2lnbmVkIGxvbmcsIGRvdWJsZSBjb25zdCYpjAKfA2Vtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPjo6KikodW5zaWduZWQgbG9uZywgZG91YmxlIGNvbnN0JiksIHZvaWQsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiosIHVuc2lnbmVkIGxvbmcsIGRvdWJsZSBjb25zdCY+OjppbnZva2Uodm9pZCAoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+OjoqIGNvbnN0JikodW5zaWduZWQgbG9uZywgZG91YmxlIGNvbnN0JiksIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiosIHVuc2lnbmVkIGxvbmcsIGRvdWJsZSmNAkRzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID46OnNpemUoKSBjb25zdI4CrgFlbXNjcmlwdGVuOjppbnRlcm5hbDo6VmVjdG9yQWNjZXNzPHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiA+OjpnZXQoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+IGNvbnN0JiwgdW5zaWduZWQgbG9uZymPArcBZW1zY3JpcHRlbjo6aW50ZXJuYWw6OlZlY3RvckFjY2VzczxzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4gPjo6c2V0KHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIHVuc2lnbmVkIGxvbmcsIGRvdWJsZSBjb25zdCYpkAKdA2Vtc2NyaXB0ZW46OmludGVybmFsOjpGdW5jdGlvbkludm9rZXI8Ym9vbCAoKikoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgdW5zaWduZWQgbG9uZywgZG91YmxlIGNvbnN0JiksIGJvb2wsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIHVuc2lnbmVkIGxvbmcsIGRvdWJsZSBjb25zdCY+OjppbnZva2UoYm9vbCAoKiopKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIHVuc2lnbmVkIGxvbmcsIGRvdWJsZSBjb25zdCYpLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4qLCB1bnNpZ25lZCBsb25nLCBkb3VibGUpkQKZAXZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+ID4oc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4qKZICSnN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpwdXNoX2JhY2soY2hhciBjb25zdCYpkwLLAmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPHZvaWQgKHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjoqKShjaGFyIGNvbnN0JiksIHZvaWQsIHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+KiwgY2hhciBjb25zdCY+OjppbnZva2Uodm9pZCAoc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OiogY29uc3QmKShjaGFyIGNvbnN0JiksIHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+KiwgY2hhcimUAlZzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6cmVzaXplKHVuc2lnbmVkIGxvbmcsIGNoYXIgY29uc3QmKZUChwNlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6KikodW5zaWduZWQgbG9uZywgY2hhciBjb25zdCYpLCB2b2lkLCBzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiosIHVuc2lnbmVkIGxvbmcsIGNoYXIgY29uc3QmPjo6aW52b2tlKHZvaWQgKHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjoqIGNvbnN0JikodW5zaWduZWQgbG9uZywgY2hhciBjb25zdCYpLCBzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiosIHVuc2lnbmVkIGxvbmcsIGNoYXIplgJAc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OnNpemUoKSBjb25zdJcCpgFlbXNjcmlwdGVuOjppbnRlcm5hbDo6VmVjdG9yQWNjZXNzPHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+ID46OmdldChzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCYsIHVuc2lnbmVkIGxvbmcpmAKtAWVtc2NyaXB0ZW46OmludGVybmFsOjpWZWN0b3JBY2Nlc3M8c3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gPjo6c2V0KHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+JiwgdW5zaWduZWQgbG9uZywgY2hhciBjb25zdCYpmQKFA2Vtc2NyaXB0ZW46OmludGVybmFsOjpGdW5jdGlvbkludm9rZXI8Ym9vbCAoKikoc3RkOjpfXzI6OnZlY3RvcjxjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4mLCB1bnNpZ25lZCBsb25nLCBjaGFyIGNvbnN0JiksIGJvb2wsIHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+JiwgdW5zaWduZWQgbG9uZywgY2hhciBjb25zdCY+OjppbnZva2UoYm9vbCAoKiopKHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+JiwgdW5zaWduZWQgbG9uZywgY2hhciBjb25zdCYpLCBzdGQ6Ol9fMjo6dmVjdG9yPGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiosIHVuc2lnbmVkIGxvbmcsIGNoYXIpmgK9AXZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPHN0ZDo6X18yOjp2ZWN0b3I8dW5zaWduZWQgY2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjx1bnNpZ25lZCBjaGFyPiA+ID4oc3RkOjpfXzI6OnZlY3Rvcjx1bnNpZ25lZCBjaGFyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHVuc2lnbmVkIGNoYXI+ID4qKZsCygFlbXNjcmlwdGVuOjppbnRlcm5hbDo6VmVjdG9yQWNjZXNzPHN0ZDo6X18yOjp2ZWN0b3I8dW5zaWduZWQgY2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjx1bnNpZ25lZCBjaGFyPiA+ID46OmdldChzdGQ6Ol9fMjo6dmVjdG9yPHVuc2lnbmVkIGNoYXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8dW5zaWduZWQgY2hhcj4gPiBjb25zdCYsIHVuc2lnbmVkIGxvbmcpnAKdAXZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4gPihzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+KimdAtcCZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8dm9pZCAoc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPjo6KikoZmxvYXQgY29uc3QmKSwgdm9pZCwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiosIGZsb2F0IGNvbnN0Jj46Omludm9rZSh2b2lkIChzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+OjoqIGNvbnN0JikoZmxvYXQgY29uc3QmKSwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiosIGZsb2F0KZ4CkwNlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjx2b2lkIChzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+OjoqKSh1bnNpZ25lZCBsb25nLCBmbG9hdCBjb25zdCYpLCB2b2lkLCBzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+KiwgdW5zaWduZWQgbG9uZywgZmxvYXQgY29uc3QmPjo6aW52b2tlKHZvaWQgKHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID46OiogY29uc3QmKSh1bnNpZ25lZCBsb25nLCBmbG9hdCBjb25zdCYpLCBzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+KiwgdW5zaWduZWQgbG9uZywgZmxvYXQpnwKqAWVtc2NyaXB0ZW46OmludGVybmFsOjpWZWN0b3JBY2Nlc3M8c3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiA+OjpnZXQoc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiBjb25zdCYsIHVuc2lnbmVkIGxvbmcpoAKRA2Vtc2NyaXB0ZW46OmludGVybmFsOjpGdW5jdGlvbkludm9rZXI8Ym9vbCAoKikoc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiYsIHVuc2lnbmVkIGxvbmcsIGZsb2F0IGNvbnN0JiksIGJvb2wsIHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mLCB1bnNpZ25lZCBsb25nLCBmbG9hdCBjb25zdCY+OjppbnZva2UoYm9vbCAoKiopKHN0ZDo6X18yOjp2ZWN0b3I8ZmxvYXQsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZmxvYXQ+ID4mLCB1bnNpZ25lZCBsb25nLCBmbG9hdCBjb25zdCYpLCBzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+KiwgdW5zaWduZWQgbG9uZywgZmxvYXQpoQJec3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+OjpfX2FwcGVuZCh1bnNpZ25lZCBsb25nLCBkb3VibGUgY29uc3QmKaICOG1heGlNRkNDQW5hbHlzZXI8ZG91YmxlPjo6Y2FsY01lbEZpbHRlckJhbmsoZG91YmxlLCBpbnQpowJmRW1zY3JpcHRlbkJpbmRpbmdJbml0aWFsaXplcl9teV9tb2R1bGVfbWF4aUdyYWluczo6RW1zY3JpcHRlbkJpbmRpbmdJbml0aWFsaXplcl9teV9tb2R1bGVfbWF4aUdyYWlucygppAJzdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+KG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qKaUCbXZvaWQgZW1zY3JpcHRlbjo6aW50ZXJuYWw6OnJhd19kZXN0cnVjdG9yPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPihtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KimmApgBZW1zY3JpcHRlbjo6c21hcnRfcHRyX3RyYWl0PHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+OjpnZXQoc3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+IGNvbnN0JimnAmZlbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46OmNvbnN0cnVjdF9udWxsKCmoAp0BZW1zY3JpcHRlbjo6c21hcnRfcHRyX3RyYWl0PHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+OjpzaGFyZShtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KiwgZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ol9FTV9WQUwqKakCmwF2b2lkIGVtc2NyaXB0ZW46OmludGVybmFsOjpyYXdfZGVzdHJ1Y3RvcjxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPihzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4qKaoCnAFlbXNjcmlwdGVuOjppbnRlcm5hbDo6SW52b2tlcjxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6aW52b2tlKHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiAoKikoKSmrAsIBc3RkOjpfXzI6OmVuYWJsZV9pZjwhKGlzX2FycmF5PG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPjo6dmFsdWUpLCBzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6dHlwZSBzdGQ6Ol9fMjo6bWFrZV9zaGFyZWQ8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+KCmsAjdtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+OjpzZXRTYW1wbGUobWF4aVNhbXBsZSoprQI4bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6Z2V0Tm9ybWFsaXNlZFBvc2l0aW9uKCmuAjRtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+OjpzZXRQb3NpdGlvbihkb3VibGUprwJCbWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6cGxheShkb3VibGUsIGRvdWJsZSwgaW50LCBkb3VibGUpsALMAmVtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6KikoZG91YmxlLCBkb3VibGUsIGludCwgZG91YmxlKSwgZG91YmxlLCBtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KiwgZG91YmxlLCBkb3VibGUsIGludCwgZG91YmxlPjo6aW52b2tlKGRvdWJsZSAobWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6KiBjb25zdCYpKGRvdWJsZSwgZG91YmxlLCBpbnQsIGRvdWJsZSksIG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qLCBkb3VibGUsIGRvdWJsZSwgaW50LCBkb3VibGUpsQJEbWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6cGxheUF0UG9zaXRpb24oZG91YmxlLCBkb3VibGUsIGludCmyAqwCZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+OjoqKShkb3VibGUsIGRvdWJsZSwgaW50KSwgZG91YmxlLCBtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KiwgZG91YmxlLCBkb3VibGUsIGludD46Omludm9rZShkb3VibGUgKG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OiogY29uc3QmKShkb3VibGUsIGRvdWJsZSwgaW50KSwgbWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGRvdWJsZSwgZG91YmxlLCBpbnQpswJxdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4obWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+Kim0Amt2b2lkIGVtc2NyaXB0ZW46OmludGVybmFsOjpyYXdfZGVzdHJ1Y3RvcjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPihtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4qKbUCmwFlbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4gPjo6c2hhcmUobWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+KiwgZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ol9FTV9WQUwqKbYCvwFzdGQ6Ol9fMjo6ZW5hYmxlX2lmPCEoaXNfYXJyYXk8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID46OnZhbHVlKSwgc3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4gPjo6dHlwZSBzdGQ6Ol9fMjo6bWFrZV9zaGFyZWQ8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4oKbcCNm1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPjo6c2V0U2FtcGxlKG1heGlTYW1wbGUqKbgCQW1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPjo6cGxheShkb3VibGUsIGRvdWJsZSwgaW50LCBkb3VibGUpuQJrdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4obWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+Kim6Al9tYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4oKbsCM21heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6c2V0U2FtcGxlKG1heGlTYW1wbGUqKbwCMW1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6c2V0TG9vcFN0YXJ0KGRvdWJsZSm9Ai9tYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OnNldExvb3BFbmQoZG91YmxlKb4CKW1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6Z2V0TG9vcEVuZCgpvwJGbWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+OjpwbGF5KGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGludCwgZG91YmxlKcAC3AJlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPjo6KikoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgaW50LCBkb3VibGUpLCBkb3VibGUsIG1heGlTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGludCwgZG91YmxlPjo6aW52b2tlKGRvdWJsZSAobWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+OjoqIGNvbnN0JikoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgaW50LCBkb3VibGUpLCBtYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBpbnQsIGRvdWJsZSnBAkhtYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OnBsYXlBdFBvc2l0aW9uKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGludCnCArwCZW1zY3JpcHRlbjo6aW50ZXJuYWw6Ok1ldGhvZEludm9rZXI8ZG91YmxlIChtYXhpU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46OiopKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGludCksIGRvdWJsZSwgbWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgaW50Pjo6aW52b2tlKGRvdWJsZSAobWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+OjoqIGNvbnN0JikoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgaW50KSwgbWF4aVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgaW50KcMCcG1heGlHcmFpbjxoYW5uV2luRnVuY3Rvcj46Om1heGlHcmFpbihtYXhpU2FtcGxlKiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgbWF4aUdyYWluV2luZG93Q2FjaGU8aGFubldpbkZ1bmN0b3I+KinEAmJFbXNjcmlwdGVuQmluZGluZ0luaXRpYWxpemVyX215X21vZHVsZV9tYXhpYml0czo6RW1zY3JpcHRlbkJpbmRpbmdJbml0aWFsaXplcl9teV9tb2R1bGVfbWF4aWJpdHMoKcUCRHZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlCaXRzPihtYXhpQml0cyopxgJvZW1zY3JpcHRlbjo6aW50ZXJuYWw6Okludm9rZXI8dW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQ+OjppbnZva2UodW5zaWduZWQgaW50ICgqKSh1bnNpZ25lZCBpbnQpLCB1bnNpZ25lZCBpbnQpxwKZAWVtc2NyaXB0ZW46OmludGVybmFsOjpJbnZva2VyPHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQ+OjppbnZva2UodW5zaWduZWQgaW50ICgqKSh1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCksIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KcgCKG1heGlCaXRzOjphdCh1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCnJAiltYXhpQml0czo6c2hsKHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KcoCKW1heGlCaXRzOjpzaHIodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQpywLDAWVtc2NyaXB0ZW46OmludGVybmFsOjpJbnZva2VyPHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludD46Omludm9rZSh1bnNpZ25lZCBpbnQgKCopKHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQpLCB1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KcwCNW1heGlCaXRzOjpyKHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQpzQIqbWF4aUJpdHM6OmxhbmQodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQpzgIpbWF4aUJpdHM6Omxvcih1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCnPAiptYXhpQml0czo6bHhvcih1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCnQAhttYXhpQml0czo6bmVnKHVuc2lnbmVkIGludCnRAhttYXhpQml0czo6aW5jKHVuc2lnbmVkIGludCnSAhttYXhpQml0czo6ZGVjKHVuc2lnbmVkIGludCnTAiltYXhpQml0czo6YWRkKHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KdQCKW1heGlCaXRzOjpzdWIodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQp1QIpbWF4aUJpdHM6Om11bCh1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCnWAiltYXhpQml0czo6ZGl2KHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KdcCKG1heGlCaXRzOjpndCh1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCnYAihtYXhpQml0czo6bHQodW5zaWduZWQgaW50LCB1bnNpZ25lZCBpbnQp2QIpbWF4aUJpdHM6Omd0ZSh1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCnaAiltYXhpQml0czo6bHRlKHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50KdsCKG1heGlCaXRzOjplcSh1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCncAhFtYXhpQml0czo6bm9pc2UoKd0CIG1heGlCaXRzOjp0b1NpZ25hbCh1bnNpZ25lZCBpbnQp3gIkbWF4aUJpdHM6OnRvVHJpZ1NpZ25hbCh1bnNpZ25lZCBpbnQp3wJdZW1zY3JpcHRlbjo6aW50ZXJuYWw6Okludm9rZXI8dW5zaWduZWQgaW50LCBkb3VibGU+OjppbnZva2UodW5zaWduZWQgaW50ICgqKShkb3VibGUpLCBkb3VibGUp4AIcbWF4aUJpdHM6OmZyb21TaWduYWwoZG91YmxlKeECSnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlUcmlnZ2VyPihtYXhpVHJpZ2dlciop4gI+bWF4aVRyaWdnZXIqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aVRyaWdnZXI+KCnjAhltYXhpVHJpZ2dlcjo6b25aWChkb3VibGUp5AImbWF4aVRyaWdnZXI6Om9uQ2hhbmdlZChkb3VibGUsIGRvdWJsZSnlAkp2b2lkIGNvbnN0KiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6Z2V0QWN0dWFsVHlwZTxtYXhpQ291bnRlcj4obWF4aUNvdW50ZXIqKeYCPm1heGlDb3VudGVyKiBlbXNjcmlwdGVuOjppbnRlcm5hbDo6b3BlcmF0b3JfbmV3PG1heGlDb3VudGVyPigp5wIibWF4aUNvdW50ZXI6OmNvdW50KGRvdWJsZSwgZG91YmxlKegCRnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlJbmRleD4obWF4aUluZGV4KinpAjptYXhpSW5kZXgqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aUluZGV4Pigp6gJXbWF4aUluZGV4OjpwdWxsKGRvdWJsZSwgZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4p6wJMdm9pZCBjb25zdCogZW1zY3JpcHRlbjo6aW50ZXJuYWw6OmdldEFjdHVhbFR5cGU8bWF4aVJhdGlvU2VxPihtYXhpUmF0aW9TZXEqKewCVm1heGlSYXRpb1NlcTo6cGxheVRyaWcoZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4p7QKOA2Vtc2NyaXB0ZW46OmludGVybmFsOjpNZXRob2RJbnZva2VyPGRvdWJsZSAobWF4aVJhdGlvU2VxOjoqKShkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiksIGRvdWJsZSwgbWF4aVJhdGlvU2VxKiwgZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4gPjo6aW52b2tlKGRvdWJsZSAobWF4aVJhdGlvU2VxOjoqIGNvbnN0JikoZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4pLCBtYXhpUmF0aW9TZXEqLCBkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiop7gKQAW1heGlSYXRpb1NlcTo6cGxheVZhbHVlcyhkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+Ke8C7wRlbXNjcmlwdGVuOjppbnRlcm5hbDo6TWV0aG9kSW52b2tlcjxkb3VibGUgKG1heGlSYXRpb1NlcTo6KikoZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4sIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiksIGRvdWJsZSwgbWF4aVJhdGlvU2VxKiwgZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4sIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiA+OjppbnZva2UoZG91YmxlIChtYXhpUmF0aW9TZXE6OiogY29uc3QmKShkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+KSwgbWF4aVJhdGlvU2VxKiwgZG91YmxlLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4qLCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4qKfACTkVtc2NyaXB0ZW5CaW5kaW5nSW5pdGlhbGl6ZXJfbWF4aVZlcmI6OkVtc2NyaXB0ZW5CaW5kaW5nSW5pdGlhbGl6ZXJfbWF4aVZlcmIoKfECTnZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlTYXRSZXZlcmI+KG1heGlTYXRSZXZlcmIqKfICSHZvaWQgZW1zY3JpcHRlbjo6aW50ZXJuYWw6OnJhd19kZXN0cnVjdG9yPG1heGlTYXRSZXZlcmI+KG1heGlTYXRSZXZlcmIqKfMCQm1heGlTYXRSZXZlcmIqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aVNhdFJldmVyYj4oKfQCTHZvaWQgY29uc3QqIGVtc2NyaXB0ZW46OmludGVybmFsOjpnZXRBY3R1YWxUeXBlPG1heGlGcmVlVmVyYj4obWF4aUZyZWVWZXJiKin1AkBtYXhpRnJlZVZlcmIqIGVtc2NyaXB0ZW46OmludGVybmFsOjpvcGVyYXRvcl9uZXc8bWF4aUZyZWVWZXJiPigp9gIrc3RkOjpfXzI6Ol9fdGhyb3dfbGVuZ3RoX2Vycm9yKGNoYXIgY29uc3QqKfcCZHZvaWQgc3RkOjpfXzI6OnZlY3RvcjxpbnQsIHN0ZDo6X18yOjphbGxvY2F0b3I8aW50PiA+OjpfX3B1c2hfYmFja19zbG93X3BhdGg8aW50IGNvbnN0Jj4oaW50IGNvbnN0Jin4AlVzdGQ6Ol9fMjo6dmVjdG9yPGludCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxpbnQ+ID46Ol9fYXBwZW5kKHVuc2lnbmVkIGxvbmcsIGludCBjb25zdCYp+QJwdm9pZCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID46Ol9fcHVzaF9iYWNrX3Nsb3dfcGF0aDxkb3VibGUgY29uc3QmPihkb3VibGUgY29uc3QmKfoCWHN0ZDo6X18yOjp2ZWN0b3I8Y2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpfX2FwcGVuZCh1bnNpZ25lZCBsb25nLCBjaGFyIGNvbnN0Jin7Am9zdGQ6Ol9fMjo6dmVjdG9yPG1heGlLdXJhbW90b09zY2lsbGF0b3IsIHN0ZDo6X18yOjphbGxvY2F0b3I8bWF4aUt1cmFtb3RvT3NjaWxsYXRvcj4gPjo6X19hcHBlbmQodW5zaWduZWQgbG9uZyn8Ak9zdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID46Ol9fYXBwZW5kKHVuc2lnbmVkIGxvbmcp/QITbWF4aUZGVDo6fm1heGlGRlQoKf4CM21heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj46On5tYXhpVGltZVN0cmV0Y2goKf8CgARzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID46OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiwgZW1zY3JpcHRlbjo6c21hcnRfcHRyX3RyYWl0PHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp2YWxfZGVsZXRlcj4obWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIGVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6dmFsX2RlbGV0ZXIsIHN0ZDo6X18yOjplbmFibGVfaWY8aXNfY29udmVydGlibGU8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiosIG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qPjo6dmFsdWUsIHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPjo6X19uYXQ+Ojp0eXBlKYADemVtc2NyaXB0ZW46OnNtYXJ0X3B0cl90cmFpdDxzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6dmFsX2RlbGV0ZXI6Om9wZXJhdG9yKCkodm9pZCBjb25zdCopgQP0AXN0ZDo6X18yOjpfX3NoYXJlZF9wdHJfcG9pbnRlcjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KiwgZW1zY3JpcHRlbjo6c21hcnRfcHRyX3RyYWl0PHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp2YWxfZGVsZXRlciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6fl9fc2hhcmVkX3B0cl9wb2ludGVyKCmCA/YBc3RkOjpfXzI6Ol9fc2hhcmVkX3B0cl9wb2ludGVyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4qLCBlbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46OnZhbF9kZWxldGVyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp+X19zaGFyZWRfcHRyX3BvaW50ZXIoKS4xgwPvAXN0ZDo6X18yOjpfX3NoYXJlZF9wdHJfcG9pbnRlcjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KiwgZW1zY3JpcHRlbjo6c21hcnRfcHRyX3RyYWl0PHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp2YWxfZGVsZXRlciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6X19vbl96ZXJvX3NoYXJlZCgphAOHAnN0ZDo6X18yOjpfX3NoYXJlZF9wdHJfcG9pbnRlcjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KiwgZW1zY3JpcHRlbjo6c21hcnRfcHRyX3RyYWl0PHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp2YWxfZGVsZXRlciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6X19nZXRfZGVsZXRlcihzdGQ6OnR5cGVfaW5mbyBjb25zdCYpIGNvbnN0hQP0AXN0ZDo6X18yOjpfX3NoYXJlZF9wdHJfcG9pbnRlcjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+KiwgZW1zY3JpcHRlbjo6c21hcnRfcHRyX3RyYWl0PHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp2YWxfZGVsZXRlciwgc3RkOjpfXzI6OmFsbG9jYXRvcjxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+ID4gPjo6X19vbl96ZXJvX3NoYXJlZF93ZWFrKCmGA5ABc3RkOjpfXzI6Ol9fc2hhcmVkX3B0cl9lbXBsYWNlPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8bWF4aVRpbWVTdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+ID46On5fX3NoYXJlZF9wdHJfZW1wbGFjZSgphwOSAXN0ZDo6X18yOjpfX3NoYXJlZF9wdHJfZW1wbGFjZTxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+Ojp+X19zaGFyZWRfcHRyX2VtcGxhY2UoKS4xiAOLAXN0ZDo6X18yOjpfX3NoYXJlZF9wdHJfZW1wbGFjZTxtYXhpVGltZVN0cmV0Y2g8aGFubldpbkZ1bmN0b3I+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPG1heGlUaW1lU3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPiA+OjpfX29uX3plcm9fc2hhcmVkKCmJAyFtYXhpR3JhaW48aGFubldpbkZ1bmN0b3I+OjpwbGF5KCmKAzFtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj46On5tYXhpUGl0Y2hTaGlmdCgpiwP4A3N0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+OjpzaGFyZWRfcHRyPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiwgZW1zY3JpcHRlbjo6c21hcnRfcHRyX3RyYWl0PHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+ID46OnZhbF9kZWxldGVyPihtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4qLCBlbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4gPjo6dmFsX2RlbGV0ZXIsIHN0ZDo6X18yOjplbmFibGVfaWY8aXNfY29udmVydGlibGU8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+KiwgbWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+Kj46OnZhbHVlLCBzdGQ6Ol9fMjo6c2hhcmVkX3B0cjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPjo6X19uYXQ+Ojp0eXBlKYwD8QFzdGQ6Ol9fMjo6X19zaGFyZWRfcHRyX3BvaW50ZXI8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+KiwgZW1zY3JpcHRlbjo6c21hcnRfcHRyX3RyYWl0PHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+ID46OnZhbF9kZWxldGVyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+ID46On5fX3NoYXJlZF9wdHJfcG9pbnRlcigpjQPzAXN0ZDo6X18yOjpfX3NoYXJlZF9wdHJfcG9pbnRlcjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4qLCBlbXNjcmlwdGVuOjpzbWFydF9wdHJfdHJhaXQ8c3RkOjpfXzI6OnNoYXJlZF9wdHI8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4gPjo6dmFsX2RlbGV0ZXIsIHN0ZDo6X18yOjphbGxvY2F0b3I8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4gPjo6fl9fc2hhcmVkX3B0cl9wb2ludGVyKCkuMY4DhAJzdGQ6Ol9fMjo6X19zaGFyZWRfcHRyX3BvaW50ZXI8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+KiwgZW1zY3JpcHRlbjo6c21hcnRfcHRyX3RyYWl0PHN0ZDo6X18yOjpzaGFyZWRfcHRyPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+ID46OnZhbF9kZWxldGVyLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+ID46Ol9fZ2V0X2RlbGV0ZXIoc3RkOjp0eXBlX2luZm8gY29uc3QmKSBjb25zdI8DjgFzdGQ6Ol9fMjo6X19zaGFyZWRfcHRyX2VtcGxhY2U8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+ID46On5fX3NoYXJlZF9wdHJfZW1wbGFjZSgpkAOQAXN0ZDo6X18yOjpfX3NoYXJlZF9wdHJfZW1wbGFjZTxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+ID4gPjo6fl9fc2hhcmVkX3B0cl9lbXBsYWNlKCkuMZEDiQFzdGQ6Ol9fMjo6X19zaGFyZWRfcHRyX2VtcGxhY2U8bWF4aVBpdGNoU2hpZnQ8aGFubldpbkZ1bmN0b3I+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+ID46Ol9fb25femVyb19zaGFyZWQoKZIDJF9HTE9CQUxfX3N1Yl9JX21heGltaWxpYW4uZW1iaW5kLmNwcJMDEG1heGlPc2M6Om5vaXNlKCmUAxltYXhpT3NjOjpzaW5ld2F2ZShkb3VibGUplQMZbWF4aU9zYzo6c2luZWJ1ZjQoZG91YmxlKZYDGG1heGlPc2M6OnNpbmVidWYoZG91YmxlKZcDGG1heGlPc2M6OmNvc3dhdmUoZG91YmxlKZgDF21heGlPc2M6OnBoYXNvcihkb3VibGUpmQMXbWF4aU9zYzo6c3F1YXJlKGRvdWJsZSmaAx5tYXhpT3NjOjpwdWxzZShkb3VibGUsIGRvdWJsZSmbAxhtYXhpT3NjOjppbXB1bHNlKGRvdWJsZSmcAydtYXhpT3NjOjpwaGFzb3IoZG91YmxlLCBkb3VibGUsIGRvdWJsZSmdAxRtYXhpT3NjOjpzYXcoZG91YmxlKZ4DFW1heGlPc2M6OnNhd24oZG91YmxlKZ8DGW1heGlPc2M6OnRyaWFuZ2xlKGRvdWJsZSmgA1BtYXhpRW52ZWxvcGU6OmxpbmUoaW50LCBzdGQ6Ol9fMjo6dmVjdG9yPGRvdWJsZSwgc3RkOjpfXzI6OmFsbG9jYXRvcjxkb3VibGU+ID4mKaEDIm1heGlFbnZlbG9wZTo6dHJpZ2dlcihpbnQsIGRvdWJsZSmiAx5tYXhpRGVsYXlsaW5lOjptYXhpRGVsYXlsaW5lKCmjAyZtYXhpRGVsYXlsaW5lOjpkbChkb3VibGUsIGludCwgZG91YmxlKaQDK21heGlEZWxheWxpbmU6OmRsKGRvdWJsZSwgaW50LCBkb3VibGUsIGludCmlAyJtYXhpRmlsdGVyOjpsb3Bhc3MoZG91YmxlLCBkb3VibGUppgMibWF4aUZpbHRlcjo6aGlwYXNzKGRvdWJsZSwgZG91YmxlKacDKW1heGlGaWx0ZXI6OmxvcmVzKGRvdWJsZSwgZG91YmxlLCBkb3VibGUpqAMpbWF4aUZpbHRlcjo6aGlyZXMoZG91YmxlLCBkb3VibGUsIGRvdWJsZSmpAyxtYXhpRmlsdGVyOjpiYW5kcGFzcyhkb3VibGUsIGRvdWJsZSwgZG91YmxlKaoDWG1heGlNaXg6OnN0ZXJlbyhkb3VibGUsIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGRvdWJsZSmrA15tYXhpTWl4OjpxdWFkKGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgZG91YmxlLCBkb3VibGUprANrbWF4aU1peDo6YW1iaXNvbmljKGRvdWJsZSwgc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+JiwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSmtA2xtYXhpU2FtcGxlOjpsb2FkKHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4sIGludCmuAxJtYXhpU2FtcGxlOjpyZWFkKCmvA2dzdGQ6Ol9fMjo6YmFzaWNfaWZzdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OmJhc2ljX2lmc3RyZWFtKGNoYXIgY29uc3QqLCB1bnNpZ25lZCBpbnQpsAPdAXN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+JiBzdGQ6Ol9fMjo6X19wdXRfY2hhcmFjdGVyX3NlcXVlbmNlPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+KHN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+JiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGxvbmcpsQNNc3RkOjpfXzI6OnZlY3RvcjxzaG9ydCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxzaG9ydD4gPjo6X19hcHBlbmQodW5zaWduZWQgbG9uZymyA01zdGQ6Ol9fMjo6YmFzaWNfZmlsZWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX2ZpbGVidWYoKbMDbG1heGlTYW1wbGU6OnNldFNhbXBsZUZyb21PZ2dCbG9iKHN0ZDo6X18yOjp2ZWN0b3I8dW5zaWduZWQgY2hhciwgc3RkOjpfXzI6OmFsbG9jYXRvcjx1bnNpZ25lZCBjaGFyPiA+JiwgaW50KbQDTHN0ZDo6X18yOjpiYXNpY19maWxlYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpiYXNpY19maWxlYnVmKCm1A1xzdGQ6Ol9fMjo6YmFzaWNfZmlsZWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6b3BlbihjaGFyIGNvbnN0KiwgdW5zaWduZWQgaW50KbYDT3N0ZDo6X18yOjpiYXNpY19pZnN0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX2lmc3RyZWFtKCm3AxVtYXhpU2FtcGxlOjppc1JlYWR5KCm4A05tYXhpU2FtcGxlOjpzZXRTYW1wbGUoc3RkOjpfXzI6OnZlY3Rvcjxkb3VibGUsIHN0ZDo6X18yOjphbGxvY2F0b3I8ZG91YmxlPiA+Jim5A/YBc3RkOjpfXzI6OmVuYWJsZV9pZjwoX19pc19mb3J3YXJkX2l0ZXJhdG9yPGRvdWJsZSo+Ojp2YWx1ZSkgJiYgKGlzX2NvbnN0cnVjdGlibGU8ZG91YmxlLCBzdGQ6Ol9fMjo6aXRlcmF0b3JfdHJhaXRzPGRvdWJsZSo+OjpyZWZlcmVuY2U+Ojp2YWx1ZSksIHZvaWQ+Ojp0eXBlIHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPjo6YXNzaWduPGRvdWJsZSo+KGRvdWJsZSosIGRvdWJsZSopugNTbWF4aVNhbXBsZTo6c2V0U2FtcGxlKHN0ZDo6X18yOjp2ZWN0b3I8ZG91YmxlLCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGRvdWJsZT4gPiYsIGludCm7AxVtYXhpU2FtcGxlOjp0cmlnZ2VyKCm8AxJtYXhpU2FtcGxlOjpwbGF5KCm9AyhtYXhpU2FtcGxlOjpwbGF5KGRvdWJsZSwgZG91YmxlLCBkb3VibGUpvgMxbWF4aVNhbXBsZTo6cGxheShkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUmKb8DKW1heGlTYW1wbGU6OnBsYXk0KGRvdWJsZSwgZG91YmxlLCBkb3VibGUpwAMWbWF4aVNhbXBsZTo6cGxheU9uY2UoKcEDHG1heGlTYW1wbGU6OnBsYXlPblpYKGRvdWJsZSnCAyRtYXhpU2FtcGxlOjpwbGF5T25aWChkb3VibGUsIGRvdWJsZSnDAxxtYXhpU2FtcGxlOjpwbGF5T25jZShkb3VibGUpxAMsbWF4aVNhbXBsZTo6cGxheU9uWlgoZG91YmxlLCBkb3VibGUsIGRvdWJsZSnFAyptYXhpU2FtcGxlOjpsb29wU2V0UG9zT25aWChkb3VibGUsIGRvdWJsZSnGAxhtYXhpU2FtcGxlOjpwbGF5KGRvdWJsZSnHAx1tYXhpU2FtcGxlOjpub3JtYWxpc2UoZG91YmxlKcgDLm1heGlTYW1wbGU6OmF1dG9UcmltKGZsb2F0LCBmbG9hdCwgYm9vbCwgYm9vbCnJAzNtYXhpRHluOjpnYXRlKGRvdWJsZSwgZG91YmxlLCBsb25nLCBkb3VibGUsIGRvdWJsZSnKAzttYXhpRHluOjpjb21wcmVzc29yKGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlKcsDGW1heGlEeW46OmNvbXByZXNzKGRvdWJsZSnMAxptYXhpRHluOjpzZXRBdHRhY2soZG91YmxlKc0DG21heGlEeW46OnNldFJlbGVhc2UoZG91YmxlKc4DHW1heGlEeW46OnNldFRocmVzaG9sZChkb3VibGUpzwMubWF4aUVudjo6YXIoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgbG9uZywgaW50KdADQG1heGlFbnY6OmFkc3IoZG91YmxlLCBkb3VibGUsIGRvdWJsZSwgZG91YmxlLCBkb3VibGUsIGxvbmcsIGludCnRAxptYXhpRW52OjphZHNyKGRvdWJsZSwgaW50KdIDGm1heGlFbnY6OnNldEF0dGFjayhkb3VibGUp0wMbbWF4aUVudjo6c2V0U3VzdGFpbihkb3VibGUp1AMZbWF4aUVudjo6c2V0RGVjYXkoZG91YmxlKdUDEmNvbnZlcnQ6Om10b2YoaW50KdYDYHZpcnR1YWwgdGh1bmsgdG8gc3RkOjpfXzI6OmJhc2ljX2lmc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfaWZzdHJlYW0oKdcDUXN0ZDo6X18yOjpiYXNpY19pZnN0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX2lmc3RyZWFtKCkuMdgDYnZpcnR1YWwgdGh1bmsgdG8gc3RkOjpfXzI6OmJhc2ljX2lmc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfaWZzdHJlYW0oKS4x2QNDc3RkOjpfXzI6OmJhc2ljX2ZpbGVidWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnN5bmMoKdoDT3N0ZDo6X18yOjpiYXNpY19maWxlYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfZmlsZWJ1ZigpLjHbA1tzdGQ6Ol9fMjo6YmFzaWNfZmlsZWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6aW1idWUoc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYp3ANQc3RkOjpfXzI6OmJhc2ljX2ZpbGVidWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnNldGJ1ZihjaGFyKiwgbG9uZyndA3pzdGQ6Ol9fMjo6YmFzaWNfZmlsZWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6c2Vla29mZihsb25nIGxvbmcsIHN0ZDo6X18yOjppb3NfYmFzZTo6c2Vla2RpciwgdW5zaWduZWQgaW50Kd4DHHN0ZDo6X18yOjpfX3Rocm93X2JhZF9jYXN0KCnfA29zdGQ6Ol9fMjo6YmFzaWNfZmlsZWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6c2Vla3BvcyhzdGQ6Ol9fMjo6ZnBvczxfX21ic3RhdGVfdD4sIHVuc2lnbmVkIGludCngA0hzdGQ6Ol9fMjo6YmFzaWNfZmlsZWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6dW5kZXJmbG93KCnhA0tzdGQ6Ol9fMjo6YmFzaWNfZmlsZWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6cGJhY2tmYWlsKGludCniA0pzdGQ6Ol9fMjo6YmFzaWNfZmlsZWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6b3ZlcmZsb3coaW50KeMDhQJzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiBzdGQ6Ol9fMjo6X19wYWRfYW5kX291dHB1dDxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPihzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0Kiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgY2hhcinkAxttYXhpQ2xvY2s6OnNldFRlbXBvKGRvdWJsZSnlAxNtYXhpQ2xvY2s6OnRpY2tlcigp5gMfbWF4aUNsb2NrOjpzZXRUaWNrc1BlckJlYXQoaW50KecDHW1heGlGRlQ6OnNldHVwKGludCwgaW50LCBpbnQp6AMqbWF4aUZGVDo6cHJvY2VzcyhmbG9hdCwgbWF4aUZGVDo6ZmZ0TW9kZXMp6QMTbWF4aUZGVDo6bWFnc1RvREIoKeoDG21heGlGRlQ6OnNwZWN0cmFsRmxhdG5lc3MoKesDG21heGlGRlQ6OnNwZWN0cmFsQ2VudHJvaWQoKewDHm1heGlJRkZUOjpzZXR1cChpbnQsIGludCwgaW50Ke0DkwFtYXhpSUZGVDo6cHJvY2VzcyhzdGQ6Ol9fMjo6dmVjdG9yPGZsb2F0LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGZsb2F0PiA+Jiwgc3RkOjpfXzI6OnZlY3RvcjxmbG9hdCwgc3RkOjpfXzI6OmFsbG9jYXRvcjxmbG9hdD4gPiYsIG1heGlJRkZUOjpmZnRNb2RlcynuAy5GRlQoaW50LCBib29sLCBmbG9hdCosIGZsb2F0KiwgZmxvYXQqLCBmbG9hdCop7wMkUmVhbEZGVChpbnQsIGZsb2F0KiwgZmxvYXQqLCBmbG9hdCop8AMgZmZ0OjpnZW5XaW5kb3coaW50LCBpbnQsIGZsb2F0KinxAw9mZnQ6OnNldHVwKGludCnyAwtmZnQ6On5mZnQoKfMDIWZmdDo6Y2FsY0ZGVChpbnQsIGZsb2F0KiwgZmxvYXQqKfQDN2ZmdDo6cG93ZXJTcGVjdHJ1bShpbnQsIGZsb2F0KiwgZmxvYXQqLCBmbG9hdCosIGZsb2F0Kin1Ax1mZnQ6OmNvbnZUb0RCKGZsb2F0KiwgZmxvYXQqKfYDO2ZmdDo6aW52ZXJzZUZGVENvbXBsZXgoaW50LCBmbG9hdCosIGZsb2F0KiwgZmxvYXQqLCBmbG9hdCop9wM+ZmZ0OjppbnZlcnNlUG93ZXJTcGVjdHJ1bShpbnQsIGZsb2F0KiwgZmxvYXQqLCBmbG9hdCosIGZsb2F0Kin4AzdtYXhpTUZDQ0FuYWx5c2VyPGRvdWJsZT46Om1lbEZpbHRlckFuZExvZ1NxdWFyZShmbG9hdCop+QMgbWF4aVJldmVyYkJhc2U6Om1heGlSZXZlcmJCYXNlKCn6Ax5tYXhpU2F0UmV2ZXJiOjptYXhpU2F0UmV2ZXJiKCn7AxttYXhpU2F0UmV2ZXJiOjpwbGF5KGRvdWJsZSn8AxxtYXhpRnJlZVZlcmI6Om1heGlGcmVlVmVyYigp/QMqbWF4aUZyZWVWZXJiOjpwbGF5KGRvdWJsZSwgZG91YmxlLCBkb3VibGUp/gMncG9pbnRfY29tcGFyZSh2b2lkIGNvbnN0Kiwgdm9pZCBjb25zdCop/wMadm9yYmlzX2RlaW5pdChzdGJfdm9yYmlzKimABClpc193aG9sZV9wYWNrZXRfcHJlc2VudChzdGJfdm9yYmlzKiwgaW50KYEEM3ZvcmJpc19kZWNvZGVfcGFja2V0KHN0Yl92b3JiaXMqLCBpbnQqLCBpbnQqLCBpbnQqKYIEF3N0YXJ0X3BhZ2Uoc3RiX3ZvcmJpcyopgwQvdm9yYmlzX2ZpbmlzaF9mcmFtZShzdGJfdm9yYmlzKiwgaW50LCBpbnQsIGludCmEBEB2b3JiaXNfZGVjb2RlX2luaXRpYWwoc3RiX3ZvcmJpcyosIGludCosIGludCosIGludCosIGludCosIGludCophQQaZ2V0X2JpdHMoc3RiX3ZvcmJpcyosIGludCmGBDJjb2RlYm9va19kZWNvZGVfc2NhbGFyX3JhdyhzdGJfdm9yYmlzKiwgQ29kZWJvb2sqKYcEQ2RlY29kZV9yZXNpZHVlKHN0Yl92b3JiaXMqLCBmbG9hdCoqLCBpbnQsIGludCwgaW50LCB1bnNpZ25lZCBjaGFyKimIBCtpbnZlcnNlX21kY3QoZmxvYXQqLCBpbnQsIHN0Yl92b3JiaXMqLCBpbnQpiQQZZmx1c2hfcGFja2V0KHN0Yl92b3JiaXMqKYoEGnN0YXJ0X2RlY29kZXIoc3RiX3ZvcmJpcyopiwQodWludDMyX2NvbXBhcmUodm9pZCBjb25zdCosIHZvaWQgY29uc3QqKYwEJWluaXRfYmxvY2tzaXplKHN0Yl92b3JiaXMqLCBpbnQsIGludCmNBBZzdGJfdm9yYmlzX29wZW5fbWVtb3J5jgQac3RiX3ZvcmJpc19nZXRfZnJhbWVfc2hvcnSPBEBjb252ZXJ0X3NhbXBsZXNfc2hvcnQoaW50LCBzaG9ydCoqLCBpbnQsIGludCwgZmxvYXQqKiwgaW50LCBpbnQpkAQmc3RiX3ZvcmJpc19nZXRfZnJhbWVfc2hvcnRfaW50ZXJsZWF2ZWSRBEdjb252ZXJ0X2NoYW5uZWxzX3Nob3J0X2ludGVybGVhdmVkKGludCwgc2hvcnQqLCBpbnQsIGZsb2F0KiosIGludCwgaW50KZIEGHN0Yl92b3JiaXNfZGVjb2RlX21lbW9yeZMEH21heWJlX3N0YXJ0X3BhY2tldChzdGJfdm9yYmlzKimUBClzdGFydF9wYWdlX25vX2NhcHR1cmVwYXR0ZXJuKHN0Yl92b3JiaXMqKZUEMmNvZGVib29rX2RlY29kZV9zdGFydChzdGJfdm9yYmlzKiwgQ29kZWJvb2sqLCBpbnQplgRfY29kZWJvb2tfZGVjb2RlX2RlaW50ZXJsZWF2ZV9yZXBlYXQoc3RiX3ZvcmJpcyosIENvZGVib29rKiwgZmxvYXQqKiwgaW50LCBpbnQqLCBpbnQqLCBpbnQsIGludCmXBDVpbWRjdF9zdGVwM19pdGVyMF9sb29wKGludCwgZmxvYXQqLCBpbnQsIGludCwgZmxvYXQqKZgEPGltZGN0X3N0ZXAzX2lubmVyX3JfbG9vcChpbnQsIGZsb2F0KiwgaW50LCBpbnQsIGZsb2F0KiwgaW50KZkEB3NjYWxibmaaBAZsZGV4cGabBAZtZW1jbXCcBAVxc29ydJ0EBHNpZnSeBANzaHKfBAd0cmlua2xloAQDc2hsoQQEcG50eqIEBWN5Y2xlowQHYV9jdHpfbKQEDF9fc3RkaW9fc2Vla6UECl9fbG9ja2ZpbGWmBAxfX3VubG9ja2ZpbGWnBAlfX2Z3cml0ZXioBAZmd3JpdGWpBAdpcHJpbnRmqgQQX19lcnJub19sb2NhdGlvbqsEB3djcnRvbWKsBAZ3Y3RvbWKtBAZtZW1jaHKuBAVmcmV4cK8EE19fdmZwcmludGZfaW50ZXJuYWywBAtwcmludGZfY29yZbEEA291dLIEBmdldGludLMEB3BvcF9hcme0BANwYWS1BAVmbXRfb7YEBWZtdF94twQFZm10X3W4BAh2ZnByaW50ZrkEBmZtdF9mcLoEE3BvcF9hcmdfbG9uZ19kb3VibGW7BAl2ZmlwcmludGa8BApfX29mbF9sb2NrvQQJX190b3dyaXRlvgQIZmlwcmludGa/BAVmcHV0Y8AEEV9fZnRlbGxvX3VubG9ja2VkwQQIX19mdGVsbG/CBAVmdGVsbMMECF9fdG9yZWFkxAQFZnJlYWTFBBFfX2ZzZWVrb191bmxvY2tlZMYECF9fZnNlZWtvxwQFZnNlZWvIBA1fX3N0ZGlvX2Nsb3NlyQQFZmdldGPKBAZzdHJsZW7LBAtfX3N0cmNocm51bMwEBnN0cmNocs0EDF9fZm1vZGVmbGFnc84EBWZvcGVuzwQJdnNucHJpbnRm0AQIc25fd3JpdGXRBAZmY2xvc2XSBBlfX2Vtc2NyaXB0ZW5fc3Rkb3V0X2Nsb3Nl0wQYX19lbXNjcmlwdGVuX3N0ZG91dF9zZWVr1AQMX19zdGRpb19yZWFk1QQIX19mZG9wZW7WBA1fX3N0ZGlvX3dyaXRl1wQKX19vdmVyZmxvd9gEBmZmbHVzaNkEEV9fZmZsdXNoX3VubG9ja2Vk2gQHX191Zmxvd9sECV9fb2ZsX2FkZNwECV9fbHNocnRpM90ECV9fYXNobHRpM94EDF9fdHJ1bmN0ZmRmMt8EBV9fY29z4AQQX19yZW1fcGlvMl9sYXJnZeEECl9fcmVtX3BpbzLiBAVfX3NpbuMEA2Nvc+QEB19fY29zZGblBAdfX3NpbmRm5gQLX19yZW1fcGlvMmbnBARjb3Nm6AQDc2lu6QQEc2luZuoEBV9fdGFu6wQDdGFu7AQEYXRhbu0EBWF0YW5m7gQGYXRhbjJm7wQEZXhwZvAEA2xvZ/EEBGxvZ2byBANwb3fzBAd3bWVtY3B59AQZc3RkOjp1bmNhdWdodF9leGNlcHRpb24oKfUERXN0ZDo6X18yOjpiYXNpY19pb3M8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19pb3MoKfYEH3N0ZDo6X18yOjppb3NfYmFzZTo6fmlvc19iYXNlKCn3BD9zdGQ6Ol9fMjo6aW9zX2Jhc2U6Ol9fY2FsbF9jYWxsYmFja3Moc3RkOjpfXzI6Omlvc19iYXNlOjpldmVudCn4BEdzdGQ6Ol9fMjo6YmFzaWNfaW9zPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfaW9zKCkuMfkEUXN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19zdHJlYW1idWYoKfoEU3N0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19zdHJlYW1idWYoKS4x+wRQc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6YmFzaWNfc3RyZWFtYnVmKCn8BF1zdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjppbWJ1ZShzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0Jin9BFJzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpzZXRidWYoY2hhciosIGxvbmcp/gR8c3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6c2Vla29mZihsb25nIGxvbmcsIHN0ZDo6X18yOjppb3NfYmFzZTo6c2Vla2RpciwgdW5zaWduZWQgaW50Kf8EcXN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnNlZWtwb3Moc3RkOjpfXzI6OmZwb3M8X19tYnN0YXRlX3Q+LCB1bnNpZ25lZCBpbnQpgAVSc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6eHNnZXRuKGNoYXIqLCBsb25nKYEFRHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPjo6Y29weShjaGFyKiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGxvbmcpggVKc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6dW5kZXJmbG93KCmDBUZzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp1ZmxvdygphAVNc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6cGJhY2tmYWlsKGludCmFBVhzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp4c3B1dG4oY2hhciBjb25zdCosIGxvbmcphgVXc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1Zjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6fmJhc2ljX3N0cmVhbWJ1ZigphwVZc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1Zjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6fmJhc2ljX3N0cmVhbWJ1ZigpLjGIBVZzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+OjpiYXNpY19zdHJlYW1idWYoKYkFW3N0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46OnhzZ2V0bih3Y2hhcl90KiwgbG9uZymKBU1zdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD46OmNvcHkod2NoYXJfdCosIHdjaGFyX3QgY29uc3QqLCB1bnNpZ25lZCBsb25nKYsFTHN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46OnVmbG93KCmMBWFzdGQ6Ol9fMjo6YmFzaWNfc3RyZWFtYnVmPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Ojp4c3B1dG4od2NoYXJfdCBjb25zdCosIGxvbmcpjQVPc3RkOjpfXzI6OmJhc2ljX2lzdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19pc3RyZWFtKCkuMY4FXnZpcnR1YWwgdGh1bmsgdG8gc3RkOjpfXzI6OmJhc2ljX2lzdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46On5iYXNpY19pc3RyZWFtKCmPBU9zdGQ6Ol9fMjo6YmFzaWNfaXN0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX2lzdHJlYW0oKS4ykAVgdmlydHVhbCB0aHVuayB0byBzdGQ6Ol9fMjo6YmFzaWNfaXN0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX2lzdHJlYW0oKS4xkQWPAXN0ZDo6X18yOjpiYXNpY19pc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpzZW50cnk6OnNlbnRyeShzdGQ6Ol9fMjo6YmFzaWNfaXN0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIGJvb2wpkgVEc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OmZsdXNoKCmTBWFzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmIHN0ZDo6X18yOjp1c2VfZmFjZXQ8c3RkOjpfXzI6OmN0eXBlPGNoYXI+ID4oc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYplAXRAWJvb2wgc3RkOjpfXzI6Om9wZXJhdG9yIT08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gY29uc3QmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiBjb25zdCYplQVUc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46Om9wZXJhdG9yKigpIGNvbnN0lgVPc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46Om9wZXJhdG9yKysoKZcF0QFib29sIHN0ZDo6X18yOjpvcGVyYXRvcj09PGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+IGNvbnN0Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gY29uc3QmKZgFiQFzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6c2VudHJ5OjpzZW50cnkoc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mKZkFTnN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpzZW50cnk6On5zZW50cnkoKZoFmAFzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6ZXF1YWwoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gY29uc3QmKSBjb25zdJsFR3N0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnNidW1wYygpnAVKc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6c3B1dGMoY2hhcimdBU5zdGQ6Ol9fMjo6YmFzaWNfaXN0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6cmVhZChjaGFyKiwgbG9uZymeBWpzdGQ6Ol9fMjo6YmFzaWNfaXN0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6c2Vla2cobG9uZyBsb25nLCBzdGQ6Ol9fMjo6aW9zX2Jhc2U6OnNlZWtkaXIpnwVKc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46OmZsdXNoKCmgBWdzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmIHN0ZDo6X18yOjp1c2VfZmFjZXQ8c3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+ID4oc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYpoQXjAWJvb2wgc3RkOjpfXzI6Om9wZXJhdG9yIT08d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gY29uc3QmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiBjb25zdCYpogVVc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46Om9wZXJhdG9yKysoKaMF4wFib29sIHN0ZDo6X18yOjpvcGVyYXRvcj09PHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+IGNvbnN0Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gY29uc3QmKaQFlQFzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6c2VudHJ5OjpzZW50cnkoc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mKaUFpAFzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6ZXF1YWwoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gY29uc3QmKSBjb25zdKYFTXN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46OnNidW1wYygppwVTc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1Zjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6c3B1dGMod2NoYXJfdCmoBU9zdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX29zdHJlYW0oKS4xqQVedmlydHVhbCB0aHVuayB0byBzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6fmJhc2ljX29zdHJlYW0oKaoFT3N0ZDo6X18yOjpiYXNpY19vc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfb3N0cmVhbSgpLjKrBWB2aXJ0dWFsIHRodW5rIHRvIHN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Ojp+YmFzaWNfb3N0cmVhbSgpLjGsBe0Bc3RkOjpfXzI6Om51bV9wdXQ8Y2hhciwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPiBjb25zdCYgc3RkOjpfXzI6OnVzZV9mYWNldDxzdGQ6Ol9fMjo6bnVtX3B1dDxjaGFyLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+ID4oc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYprQVFc3RkOjpfXzI6OmJhc2ljX2lvczxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6ZmlsbCgpIGNvbnN0rgVKc3RkOjpfXzI6OmJhc2ljX2lvczxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6d2lkZW4oY2hhcikgY29uc3SvBU5zdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6b3BlcmF0b3I8PChzaG9ydCmwBUxzdGQ6Ol9fMjo6YmFzaWNfb3N0cmVhbTxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6b3BlcmF0b3I8PChpbnQpsQVWc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46Om9wZXJhdG9yPDwodW5zaWduZWQgbG9uZymyBVJzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6b3BlcmF0b3I9KGNoYXIpswVGc3RkOjpfXzI6OmJhc2ljX29zdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OnB1dChjaGFyKbQFW3N0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+OjpvcGVyYXRvcj0od2NoYXJfdCm1BXBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpiYXNpY19zdHJpbmcoY2hhciBjb25zdCoptgUhc3RkOjpfXzI6Omlvc19iYXNlOjp+aW9zX2Jhc2UoKS4xtwUfc3RkOjpfXzI6Omlvc19iYXNlOjppbml0KHZvaWQqKbgFtQFzdGQ6Ol9fMjo6ZW5hYmxlX2lmPChpc19tb3ZlX2NvbnN0cnVjdGlibGU8dW5zaWduZWQgaW50Pjo6dmFsdWUpICYmIChpc19tb3ZlX2Fzc2lnbmFibGU8dW5zaWduZWQgaW50Pjo6dmFsdWUpLCB2b2lkPjo6dHlwZSBzdGQ6Ol9fMjo6c3dhcDx1bnNpZ25lZCBpbnQ+KHVuc2lnbmVkIGludCYsIHVuc2lnbmVkIGludCYpuQVZc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46Ol9fdGVzdF9mb3JfZW9mKCkgY29uc3S6BV9zdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPjo6X190ZXN0X2Zvcl9lb2YoKSBjb25zdLsFBnVuZ2V0Y7wFIHN0ZDo6X18yOjppb3NfYmFzZTo6SW5pdDo6SW5pdCgpvQUXX19jeHhfZ2xvYmFsX2FycmF5X2R0b3K+BT9zdGQ6Ol9fMjo6X19zdGRpbmJ1ZjxjaGFyPjo6X19zdGRpbmJ1ZihfSU9fRklMRSosIF9fbWJzdGF0ZV90Kim/BYoBc3RkOjpfXzI6OmJhc2ljX2lzdHJlYW08Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OmJhc2ljX2lzdHJlYW0oc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiopwAVCc3RkOjpfXzI6Ol9fc3RkaW5idWY8d2NoYXJfdD46Ol9fc3RkaW5idWYoX0lPX0ZJTEUqLCBfX21ic3RhdGVfdCopwQWWAXN0ZDo6X18yOjpiYXNpY19pc3RyZWFtPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+OjpiYXNpY19pc3RyZWFtKHN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4qKcIFQXN0ZDo6X18yOjpfX3N0ZG91dGJ1ZjxjaGFyPjo6X19zdGRvdXRidWYoX0lPX0ZJTEUqLCBfX21ic3RhdGVfdCopwwWKAXN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+OjpiYXNpY19vc3RyZWFtKHN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4qKcQFRHN0ZDo6X18yOjpfX3N0ZG91dGJ1Zjx3Y2hhcl90Pjo6X19zdGRvdXRidWYoX0lPX0ZJTEUqLCBfX21ic3RhdGVfdCopxQWWAXN0ZDo6X18yOjpiYXNpY19vc3RyZWFtPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+OjpiYXNpY19vc3RyZWFtKHN0ZDo6X18yOjpiYXNpY19zdHJlYW1idWY8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4qKcYFfXN0ZDo6X18yOjpiYXNpY19pb3M8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID46OmluaXQoc3RkOjpfXzI6OmJhc2ljX3N0cmVhbWJ1ZjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiopxwWLAXN0ZDo6X18yOjpjb2RlY3Z0PGNoYXIsIGNoYXIsIF9fbWJzdGF0ZV90PiBjb25zdCYgc3RkOjpfXzI6OnVzZV9mYWNldDxzdGQ6Ol9fMjo6Y29kZWN2dDxjaGFyLCBjaGFyLCBfX21ic3RhdGVfdD4gPihzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JinIBZEBc3RkOjpfXzI6OmNvZGVjdnQ8d2NoYXJfdCwgY2hhciwgX19tYnN0YXRlX3Q+IGNvbnN0JiBzdGQ6Ol9fMjo6dXNlX2ZhY2V0PHN0ZDo6X18yOjpjb2RlY3Z0PHdjaGFyX3QsIGNoYXIsIF9fbWJzdGF0ZV90PiA+KHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKckFKXN0ZDo6X18yOjpfX3N0ZGluYnVmPGNoYXI+Ojp+X19zdGRpbmJ1ZigpygU6c3RkOjpfXzI6Ol9fc3RkaW5idWY8Y2hhcj46OmltYnVlKHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKcsFJ3N0ZDo6X18yOjpfX3N0ZGluYnVmPGNoYXI+Ojp1bmRlcmZsb3coKcwFK3N0ZDo6X18yOjpfX3N0ZGluYnVmPGNoYXI+OjpfX2dldGNoYXIoYm9vbCnNBSNzdGQ6Ol9fMjo6X19zdGRpbmJ1ZjxjaGFyPjo6dWZsb3coKc4FKnN0ZDo6X18yOjpfX3N0ZGluYnVmPGNoYXI+OjpwYmFja2ZhaWwoaW50Kc8FLHN0ZDo6X18yOjpfX3N0ZGluYnVmPHdjaGFyX3Q+Ojp+X19zdGRpbmJ1Zigp0AU9c3RkOjpfXzI6Ol9fc3RkaW5idWY8d2NoYXJfdD46OmltYnVlKHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKdEFKnN0ZDo6X18yOjpfX3N0ZGluYnVmPHdjaGFyX3Q+Ojp1bmRlcmZsb3coKdIFLnN0ZDo6X18yOjpfX3N0ZGluYnVmPHdjaGFyX3Q+OjpfX2dldGNoYXIoYm9vbCnTBSZzdGQ6Ol9fMjo6X19zdGRpbmJ1Zjx3Y2hhcl90Pjo6dWZsb3coKdQFNnN0ZDo6X18yOjpfX3N0ZGluYnVmPHdjaGFyX3Q+OjpwYmFja2ZhaWwodW5zaWduZWQgaW50KdUFO3N0ZDo6X18yOjpfX3N0ZG91dGJ1ZjxjaGFyPjo6aW1idWUoc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYp1gUjc3RkOjpfXzI6Ol9fc3Rkb3V0YnVmPGNoYXI+OjpzeW5jKCnXBTZzdGQ6Ol9fMjo6X19zdGRvdXRidWY8Y2hhcj46OnhzcHV0bihjaGFyIGNvbnN0KiwgbG9uZynYBSpzdGQ6Ol9fMjo6X19zdGRvdXRidWY8Y2hhcj46Om92ZXJmbG93KGludCnZBT5zdGQ6Ol9fMjo6X19zdGRvdXRidWY8d2NoYXJfdD46OmltYnVlKHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKdoFPHN0ZDo6X18yOjpfX3N0ZG91dGJ1Zjx3Y2hhcl90Pjo6eHNwdXRuKHdjaGFyX3QgY29uc3QqLCBsb25nKdsFNnN0ZDo6X18yOjpfX3N0ZG91dGJ1Zjx3Y2hhcl90Pjo6b3ZlcmZsb3codW5zaWduZWQgaW50KdwFB19fc2hsaW3dBQhfX3NoZ2V0Y94FCF9fbXVsdGkz3wUJX19pbnRzY2Fu4AUHbWJydG93Y+EFDV9fZXh0ZW5kc2Z0ZjLiBQhfX211bHRmM+MFC19fZmxvYXRzaXRm5AUIX19hZGR0ZjPlBQ1fX2V4dGVuZGRmdGYy5gUHX19sZXRmMucFB19fZ2V0ZjLoBQljb3B5c2lnbmzpBQ1fX2Zsb2F0dW5zaXRm6gUIX19zdWJ0ZjPrBQdzY2FsYm5s7AUIX19kaXZ0ZjPtBQtfX2Zsb2F0c2Nhbu4FCGhleGZsb2F07wUIZGVjZmxvYXTwBQdzY2FuZXhw8QUMX190cnVuY3Rmc2Yy8gUHdmZzY2FuZvMFBWFyZ19u9AUJc3RvcmVfaW509QUNX19zdHJpbmdfcmVhZPYFB3Zzc2Nhbmb3BQdkb19yZWFk+AUGc3RyY21w+QUgX19lbXNjcmlwdGVuX2Vudmlyb25fY29uc3RydWN0b3L6BQdzdHJuY21w+wUGZ2V0ZW52/AUIX19tdW5tYXD9BQxfX2dldF9sb2NhbGX+BQtfX25ld2xvY2FsZf8FCXZhc3ByaW50ZoAGBnNzY2FuZoEGCHNucHJpbnRmggYKZnJlZWxvY2FsZYMGBndjc2xlboQGCXdjc3J0b21ic4UGCndjc25ydG9tYnOGBgltYnNydG93Y3OHBgptYnNucnRvd2NziAYGc3RydG94iQYKc3RydG91bGxfbIoGCXN0cnRvbGxfbIsGBnN0cnRvZowGCHN0cnRveC4xjQYGc3RydG9kjgYHc3RydG9sZI8GCXN0cnRvbGRfbJAGXXN0ZDo6X18yOjpjb2xsYXRlPGNoYXI+Ojpkb19jb21wYXJlKGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqKSBjb25zdJEGRXN0ZDo6X18yOjpjb2xsYXRlPGNoYXI+Ojpkb190cmFuc2Zvcm0oY2hhciBjb25zdCosIGNoYXIgY29uc3QqKSBjb25zdJIGzwFzdGQ6Ol9fMjo6ZW5hYmxlX2lmPF9faXNfZm9yd2FyZF9pdGVyYXRvcjxjaGFyIGNvbnN0Kj46OnZhbHVlLCB2b2lkPjo6dHlwZSBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpfX2luaXQ8Y2hhciBjb25zdCo+KGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KimTBkBzdGQ6Ol9fMjo6Y29sbGF0ZTxjaGFyPjo6ZG9faGFzaChjaGFyIGNvbnN0KiwgY2hhciBjb25zdCopIGNvbnN0lAZsc3RkOjpfXzI6OmNvbGxhdGU8d2NoYXJfdD46OmRvX2NvbXBhcmUod2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdCopIGNvbnN0lQZOc3RkOjpfXzI6OmNvbGxhdGU8d2NoYXJfdD46OmRvX3RyYW5zZm9ybSh3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdCopIGNvbnN0lgbkAXN0ZDo6X18yOjplbmFibGVfaWY8X19pc19mb3J3YXJkX2l0ZXJhdG9yPHdjaGFyX3QgY29uc3QqPjo6dmFsdWUsIHZvaWQ+Ojp0eXBlIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID46Ol9faW5pdDx3Y2hhcl90IGNvbnN0Kj4od2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqKZcGSXN0ZDo6X18yOjpjb2xsYXRlPHdjaGFyX3Q+Ojpkb19oYXNoKHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0KikgY29uc3SYBpoCc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgYm9vbCYpIGNvbnN0mQZnc3RkOjpfXzI6Om51bXB1bmN0PGNoYXI+IGNvbnN0JiBzdGQ6Ol9fMjo6dXNlX2ZhY2V0PHN0ZDo6X18yOjpudW1wdW5jdDxjaGFyPiA+KHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKZoGpAVzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0KiBzdGQ6Ol9fMjo6X19zY2FuX2tleXdvcmQ8c3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QqLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0Kiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCosIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYsIHVuc2lnbmVkIGludCYsIGJvb2wpmwY4c3RkOjpfXzI6OmxvY2FsZTo6dXNlX2ZhY2V0KHN0ZDo6X18yOjpsb2NhbGU6OmlkJikgY29uc3ScBswBc3RkOjpfXzI6OnVuaXF1ZV9wdHI8dW5zaWduZWQgY2hhciwgdm9pZCAoKikodm9pZCopPjo6dW5pcXVlX3B0cjx0cnVlLCB2b2lkPih1bnNpZ25lZCBjaGFyKiwgc3RkOjpfXzI6Ol9fZGVwZW5kZW50X3R5cGU8c3RkOjpfXzI6Ol9fdW5pcXVlX3B0cl9kZWxldGVyX3NmaW5hZTx2b2lkICgqKSh2b2lkKik+LCB0cnVlPjo6X19nb29kX3J2YWxfcmVmX3R5cGUpnQaaAnN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGxvbmcmKSBjb25zdJ4G6wJzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiBzdGQ6Ol9fMjo6bnVtX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2RvX2dldF9zaWduZWQ8bG9uZz4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBsb25nJikgY29uc3SfBjlzdGQ6Ol9fMjo6X19udW1fZ2V0X2Jhc2U6Ol9fZ2V0X2Jhc2Uoc3RkOjpfXzI6Omlvc19iYXNlJimgBkhzdGQ6Ol9fMjo6X19udW1fZ2V0PGNoYXI+OjpfX3N0YWdlMl9pbnRfcHJlcChzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCBjaGFyJimhBmVzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpiYXNpY19zdHJpbmcoKaIGbHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OnJlc2l6ZSh1bnNpZ25lZCBsb25nKaMG5QFzdGQ6Ol9fMjo6X19udW1fZ2V0PGNoYXI+OjpfX3N0YWdlMl9pbnRfbG9vcChjaGFyLCBpbnQsIGNoYXIqLCBjaGFyKiYsIHVuc2lnbmVkIGludCYsIGNoYXIsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QmLCB1bnNpZ25lZCBpbnQqLCB1bnNpZ25lZCBpbnQqJiwgY2hhciBjb25zdCoppAZcbG9uZyBzdGQ6Ol9fMjo6X19udW1fZ2V0X3NpZ25lZF9pbnRlZ3JhbDxsb25nPihjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGludCYsIGludCmlBqUBc3RkOjpfXzI6Ol9fY2hlY2tfZ3JvdXBpbmcoc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCYsIHVuc2lnbmVkIGludCosIHVuc2lnbmVkIGludCosIHVuc2lnbmVkIGludCYppgafAnN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGxvbmcgbG9uZyYpIGNvbnN0pwb1AnN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+IHN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZG9fZ2V0X3NpZ25lZDxsb25nIGxvbmc+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgbG9uZyBsb25nJikgY29uc3SoBmZsb25nIGxvbmcgc3RkOjpfXzI6Ol9fbnVtX2dldF9zaWduZWRfaW50ZWdyYWw8bG9uZyBsb25nPihjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGludCYsIGludCmpBqQCc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdW5zaWduZWQgc2hvcnQmKSBjb25zdKoGgQNzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiBzdGQ6Ol9fMjo6bnVtX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2RvX2dldF91bnNpZ25lZDx1bnNpZ25lZCBzaG9ydD4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB1bnNpZ25lZCBzaG9ydCYpIGNvbnN0qwZydW5zaWduZWQgc2hvcnQgc3RkOjpfXzI6Ol9fbnVtX2dldF91bnNpZ25lZF9pbnRlZ3JhbDx1bnNpZ25lZCBzaG9ydD4oY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBpbnQmLCBpbnQprAaiAnN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHVuc2lnbmVkIGludCYpIGNvbnN0rQb9AnN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+IHN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZG9fZ2V0X3Vuc2lnbmVkPHVuc2lnbmVkIGludD4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB1bnNpZ25lZCBpbnQmKSBjb25zdK4GbnVuc2lnbmVkIGludCBzdGQ6Ol9fMjo6X19udW1fZ2V0X3Vuc2lnbmVkX2ludGVncmFsPHVuc2lnbmVkIGludD4oY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBpbnQmLCBpbnQprwaoAnN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHVuc2lnbmVkIGxvbmcgbG9uZyYpIGNvbnN0sAaJA3N0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+IHN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZG9fZ2V0X3Vuc2lnbmVkPHVuc2lnbmVkIGxvbmcgbG9uZz4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB1bnNpZ25lZCBsb25nIGxvbmcmKSBjb25zdLEGenVuc2lnbmVkIGxvbmcgbG9uZyBzdGQ6Ol9fMjo6X19udW1fZ2V0X3Vuc2lnbmVkX2ludGVncmFsPHVuc2lnbmVkIGxvbmcgbG9uZz4oY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBpbnQmLCBpbnQpsgabAnN0ZDo6X18yOjpudW1fZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGZsb2F0JikgY29uc3SzBvUCc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19kb19nZXRfZmxvYXRpbmdfcG9pbnQ8ZmxvYXQ+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgZmxvYXQmKSBjb25zdLQGWHN0ZDo6X18yOjpfX251bV9nZXQ8Y2hhcj46Ol9fc3RhZ2UyX2Zsb2F0X3ByZXAoc3RkOjpfXzI6Omlvc19iYXNlJiwgY2hhciosIGNoYXImLCBjaGFyJim1BvABc3RkOjpfXzI6Ol9fbnVtX2dldDxjaGFyPjo6X19zdGFnZTJfZmxvYXRfbG9vcChjaGFyLCBib29sJiwgY2hhciYsIGNoYXIqLCBjaGFyKiYsIGNoYXIsIGNoYXIsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QmLCB1bnNpZ25lZCBpbnQqLCB1bnNpZ25lZCBpbnQqJiwgdW5zaWduZWQgaW50JiwgY2hhcioptgZPZmxvYXQgc3RkOjpfXzI6Ol9fbnVtX2dldF9mbG9hdDxmbG9hdD4oY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBpbnQmKbcGnAJzdGQ6Ol9fMjo6bnVtX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBkb3VibGUmKSBjb25zdLgG9wJzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiBzdGQ6Ol9fMjo6bnVtX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2RvX2dldF9mbG9hdGluZ19wb2ludDxkb3VibGU+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgZG91YmxlJikgY29uc3S5BlFkb3VibGUgc3RkOjpfXzI6Ol9fbnVtX2dldF9mbG9hdDxkb3VibGU+KGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgaW50Jim6BqECc3RkOjpfXzI6Om51bV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgbG9uZyBkb3VibGUmKSBjb25zdLsGgQNzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiBzdGQ6Ol9fMjo6bnVtX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2RvX2dldF9mbG9hdGluZ19wb2ludDxsb25nIGRvdWJsZT4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBsb25nIGRvdWJsZSYpIGNvbnN0vAZbbG9uZyBkb3VibGUgc3RkOjpfXzI6Ol9fbnVtX2dldF9mbG9hdDxsb25nIGRvdWJsZT4oY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBpbnQmKb0GmwJzdGQ6Ol9fMjo6bnVtX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB2b2lkKiYpIGNvbnN0vgYSc3RkOjpfXzI6Ol9fY2xvYygpvwZMc3RkOjpfXzI6Ol9fbGliY3BwX3NzY2FuZl9sKGNoYXIgY29uc3QqLCBfX2xvY2FsZV9zdHJ1Y3QqLCBjaGFyIGNvbnN0KiwgLi4uKcAGX3N0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46Ol9femVybygpwQZUY2hhciBjb25zdCogc3RkOjpfXzI6OmZpbmQ8Y2hhciBjb25zdCosIGNoYXI+KGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdCYpwgZJc3RkOjpfXzI6Ol9fbGliY3BwX2xvY2FsZV9ndWFyZDo6X19saWJjcHBfbG9jYWxlX2d1YXJkKF9fbG9jYWxlX3N0cnVjdComKcMGrwJzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBib29sJikgY29uc3TEBm1zdGQ6Ol9fMjo6bnVtcHVuY3Q8d2NoYXJfdD4gY29uc3QmIHN0ZDo6X18yOjp1c2VfZmFjZXQ8c3RkOjpfXzI6Om51bXB1bmN0PHdjaGFyX3Q+ID4oc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYpxQbgBXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4gY29uc3QqIHN0ZDo6X18yOjpfX3NjYW5fa2V5d29yZDxzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiBjb25zdCosIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiA+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4gY29uc3QqLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+IGNvbnN0Kiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JiwgdW5zaWduZWQgaW50JiwgYm9vbCnGBq8Cc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgbG9uZyYpIGNvbnN0xwaGA3N0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+IHN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZG9fZ2V0X3NpZ25lZDxsb25nPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGxvbmcmKSBjb25zdMgGTXN0ZDo6X18yOjpfX251bV9nZXQ8d2NoYXJfdD46Ol9fZG9fd2lkZW4oc3RkOjpfXzI6Omlvc19iYXNlJiwgd2NoYXJfdCopIGNvbnN0yQZOc3RkOjpfXzI6Ol9fbnVtX2dldDx3Y2hhcl90Pjo6X19zdGFnZTJfaW50X3ByZXAoc3RkOjpfXzI6Omlvc19iYXNlJiwgd2NoYXJfdCYpygbxAXN0ZDo6X18yOjpfX251bV9nZXQ8d2NoYXJfdD46Ol9fc3RhZ2UyX2ludF9sb29wKHdjaGFyX3QsIGludCwgY2hhciosIGNoYXIqJiwgdW5zaWduZWQgaW50Jiwgd2NoYXJfdCwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCYsIHVuc2lnbmVkIGludCosIHVuc2lnbmVkIGludComLCB3Y2hhcl90IGNvbnN0KinLBrQCc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgbG9uZyBsb25nJikgY29uc3TMBpADc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19kb19nZXRfc2lnbmVkPGxvbmcgbG9uZz4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBsb25nIGxvbmcmKSBjb25zdM0GuQJzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB1bnNpZ25lZCBzaG9ydCYpIGNvbnN0zgacA3N0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+IHN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZG9fZ2V0X3Vuc2lnbmVkPHVuc2lnbmVkIHNob3J0PihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHVuc2lnbmVkIHNob3J0JikgY29uc3TPBrcCc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdW5zaWduZWQgaW50JikgY29uc3TQBpgDc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19kb19nZXRfdW5zaWduZWQ8dW5zaWduZWQgaW50PihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHVuc2lnbmVkIGludCYpIGNvbnN00Qa9AnN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHVuc2lnbmVkIGxvbmcgbG9uZyYpIGNvbnN00gakA3N0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+IHN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZG9fZ2V0X3Vuc2lnbmVkPHVuc2lnbmVkIGxvbmcgbG9uZz4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB1bnNpZ25lZCBsb25nIGxvbmcmKSBjb25zdNMGsAJzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBmbG9hdCYpIGNvbnN01AaQA3N0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+IHN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZG9fZ2V0X2Zsb2F0aW5nX3BvaW50PGZsb2F0PihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIGZsb2F0JikgY29uc3TVBmRzdGQ6Ol9fMjo6X19udW1fZ2V0PHdjaGFyX3Q+OjpfX3N0YWdlMl9mbG9hdF9wcmVwKHN0ZDo6X18yOjppb3NfYmFzZSYsIHdjaGFyX3QqLCB3Y2hhcl90Jiwgd2NoYXJfdCYp1gb/AXN0ZDo6X18yOjpfX251bV9nZXQ8d2NoYXJfdD46Ol9fc3RhZ2UyX2Zsb2F0X2xvb3Aod2NoYXJfdCwgYm9vbCYsIGNoYXImLCBjaGFyKiwgY2hhciomLCB3Y2hhcl90LCB3Y2hhcl90LCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0JiwgdW5zaWduZWQgaW50KiwgdW5zaWduZWQgaW50KiYsIHVuc2lnbmVkIGludCYsIHdjaGFyX3QqKdcGsQJzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBkb3VibGUmKSBjb25zdNgGkgNzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiBzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2RvX2dldF9mbG9hdGluZ19wb2ludDxkb3VibGU+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgZG91YmxlJikgY29uc3TZBrYCc3RkOjpfXzI6Om51bV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgbG9uZyBkb3VibGUmKSBjb25zdNoGnANzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiBzdGQ6Ol9fMjo6bnVtX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2RvX2dldF9mbG9hdGluZ19wb2ludDxsb25nIGRvdWJsZT4oc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBsb25nIGRvdWJsZSYpIGNvbnN02wawAnN0ZDo6X18yOjpudW1fZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHZvaWQqJikgY29uc3TcBmZ3Y2hhcl90IGNvbnN0KiBzdGQ6Ol9fMjo6ZmluZDx3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdD4od2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0JindBmd3Y2hhcl90IGNvbnN0KiBzdGQ6Ol9fMjo6X19udW1fZ2V0PHdjaGFyX3Q+OjpfX2RvX3dpZGVuX3A8d2NoYXJfdD4oc3RkOjpfXzI6Omlvc19iYXNlJiwgd2NoYXJfdCopIGNvbnN03gbNAXN0ZDo6X18yOjpudW1fcHV0PGNoYXIsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgY2hhciwgYm9vbCkgY29uc3TfBl5zdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpiZWdpbigp4AZcc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6ZW5kKCnhBs0Bc3RkOjpfXzI6Om51bV9wdXQ8Y2hhciwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCBjaGFyLCBsb25nKSBjb25zdOIGTnN0ZDo6X18yOjpfX251bV9wdXRfYmFzZTo6X19mb3JtYXRfaW50KGNoYXIqLCBjaGFyIGNvbnN0KiwgYm9vbCwgdW5zaWduZWQgaW50KeMGV3N0ZDo6X18yOjpfX2xpYmNwcF9zbnByaW50Zl9sKGNoYXIqLCB1bnNpZ25lZCBsb25nLCBfX2xvY2FsZV9zdHJ1Y3QqLCBjaGFyIGNvbnN0KiwgLi4uKeQGVXN0ZDo6X18yOjpfX251bV9wdXRfYmFzZTo6X19pZGVudGlmeV9wYWRkaW5nKGNoYXIqLCBjaGFyKiwgc3RkOjpfXzI6Omlvc19iYXNlIGNvbnN0JinlBnVzdGQ6Ol9fMjo6X19udW1fcHV0PGNoYXI+OjpfX3dpZGVuX2FuZF9ncm91cF9pbnQoY2hhciosIGNoYXIqLCBjaGFyKiwgY2hhciosIGNoYXIqJiwgY2hhciomLCBzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JinmBit2b2lkIHN0ZDo6X18yOjpyZXZlcnNlPGNoYXIqPihjaGFyKiwgY2hhciop5wYhc3RkOjpfXzI6Omlvc19iYXNlOjp3aWR0aCgpIGNvbnN06AbSAXN0ZDo6X18yOjpudW1fcHV0PGNoYXIsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgY2hhciwgbG9uZyBsb25nKSBjb25zdOkG1gFzdGQ6Ol9fMjo6bnVtX3B1dDxjaGFyLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIGNoYXIsIHVuc2lnbmVkIGxvbmcpIGNvbnN06gbbAXN0ZDo6X18yOjpudW1fcHV0PGNoYXIsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgY2hhciwgdW5zaWduZWQgbG9uZyBsb25nKSBjb25zdOsGzwFzdGQ6Ol9fMjo6bnVtX3B1dDxjaGFyLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIGNoYXIsIGRvdWJsZSkgY29uc3TsBkpzdGQ6Ol9fMjo6X19udW1fcHV0X2Jhc2U6Ol9fZm9ybWF0X2Zsb2F0KGNoYXIqLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgaW50Ke0GJXN0ZDo6X18yOjppb3NfYmFzZTo6cHJlY2lzaW9uKCkgY29uc3TuBklzdGQ6Ol9fMjo6X19saWJjcHBfYXNwcmludGZfbChjaGFyKiosIF9fbG9jYWxlX3N0cnVjdCosIGNoYXIgY29uc3QqLCAuLi4p7wZ3c3RkOjpfXzI6Ol9fbnVtX3B1dDxjaGFyPjo6X193aWRlbl9hbmRfZ3JvdXBfZmxvYXQoY2hhciosIGNoYXIqLCBjaGFyKiwgY2hhciosIGNoYXIqJiwgY2hhciomLCBzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JinwBtQBc3RkOjpfXzI6Om51bV9wdXQ8Y2hhciwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCBjaGFyLCBsb25nIGRvdWJsZSkgY29uc3TxBtQBc3RkOjpfXzI6Om51bV9wdXQ8Y2hhciwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCBjaGFyLCB2b2lkIGNvbnN0KikgY29uc3TyBt8Bc3RkOjpfXzI6Om51bV9wdXQ8d2NoYXJfdCwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90LCBib29sKSBjb25zdPMGZXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID46OmVuZCgp9AbfAXN0ZDo6X18yOjpudW1fcHV0PHdjaGFyX3QsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgd2NoYXJfdCwgbG9uZykgY29uc3T1BoEBc3RkOjpfXzI6Ol9fbnVtX3B1dDx3Y2hhcl90Pjo6X193aWRlbl9hbmRfZ3JvdXBfaW50KGNoYXIqLCBjaGFyKiwgY2hhciosIHdjaGFyX3QqLCB3Y2hhcl90KiYsIHdjaGFyX3QqJiwgc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYp9gajAnN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+IHN0ZDo6X18yOjpfX3BhZF9hbmRfb3V0cHV0PHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqLCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90KfcGNHZvaWQgc3RkOjpfXzI6OnJldmVyc2U8d2NoYXJfdCo+KHdjaGFyX3QqLCB3Y2hhcl90Kin4BoQBc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6YmFzaWNfc3RyaW5nKHVuc2lnbmVkIGxvbmcsIHdjaGFyX3Qp+QbkAXN0ZDo6X18yOjpudW1fcHV0PHdjaGFyX3QsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgd2NoYXJfdCwgbG9uZyBsb25nKSBjb25zdPoG6AFzdGQ6Ol9fMjo6bnVtX3B1dDx3Y2hhcl90LCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHdjaGFyX3QsIHVuc2lnbmVkIGxvbmcpIGNvbnN0+wbtAXN0ZDo6X18yOjpudW1fcHV0PHdjaGFyX3QsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgd2NoYXJfdCwgdW5zaWduZWQgbG9uZyBsb25nKSBjb25zdPwG4QFzdGQ6Ol9fMjo6bnVtX3B1dDx3Y2hhcl90LCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHdjaGFyX3QsIGRvdWJsZSkgY29uc3T9BoMBc3RkOjpfXzI6Ol9fbnVtX3B1dDx3Y2hhcl90Pjo6X193aWRlbl9hbmRfZ3JvdXBfZmxvYXQoY2hhciosIGNoYXIqLCBjaGFyKiwgd2NoYXJfdCosIHdjaGFyX3QqJiwgd2NoYXJfdComLCBzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0Jin+BuYBc3RkOjpfXzI6Om51bV9wdXQ8d2NoYXJfdCwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90LCBsb25nIGRvdWJsZSkgY29uc3T/BuYBc3RkOjpfXzI6Om51bV9wdXQ8d2NoYXJfdCwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90LCB2b2lkIGNvbnN0KikgY29uc3SAB1N2b2lkIHN0ZDo6X18yOjpfX3JldmVyc2U8Y2hhcio+KGNoYXIqLCBjaGFyKiwgc3RkOjpfXzI6OnJhbmRvbV9hY2Nlc3NfaXRlcmF0b3JfdGFnKYEHXHZvaWQgc3RkOjpfXzI6Ol9fcmV2ZXJzZTx3Y2hhcl90Kj4od2NoYXJfdCosIHdjaGFyX3QqLCBzdGQ6Ol9fMjo6cmFuZG9tX2FjY2Vzc19pdGVyYXRvcl90YWcpggewAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpnZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB0bSosIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KikgY29uc3SDB3NzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZGF0ZV9vcmRlcigpIGNvbnN0hAeeAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXRfdGltZShzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHRtKikgY29uc3SFB54Cc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX2dldF9kYXRlKHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdG0qKSBjb25zdIYHoQJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0X3dlZWtkYXkoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB0bSopIGNvbnN0hwevAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2dldF93ZWVrZGF5bmFtZShpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdIgHowJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0X21vbnRobmFtZShzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHRtKikgY29uc3SJB60Cc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0X21vbnRobmFtZShpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdIoHngJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0X3llYXIoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB0bSopIGNvbnN0iweoAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2dldF95ZWFyKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYpIGNvbnN0jAelAmludCBzdGQ6Ol9fMjo6X19nZXRfdXBfdG9fbl9kaWdpdHM8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmLCBpbnQpjQelAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB0bSosIGNoYXIsIGNoYXIpIGNvbnN0jgelAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2dldF9wZXJjZW50KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYpIGNvbnN0jwenAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2dldF9kYXkoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JikgY29uc3SQB6gCc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0X2hvdXIoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JikgY29uc3SRB6sCc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0XzEyX2hvdXIoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JikgY29uc3SSB7ACc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0X2RheV95ZWFyX251bShpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdJMHqQJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfbW9udGgoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JikgY29uc3SUB6oCc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0X21pbnV0ZShpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj4gY29uc3QmKSBjb25zdJUHqQJzdGQ6Ol9fMjo6dGltZV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19nZXRfd2hpdGVfc3BhY2Uoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JikgY29uc3SWB6kCc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0X2FtX3BtKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYpIGNvbnN0lweqAnN0ZDo6X18yOjp0aW1lX2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+OjpfX2dldF9zZWNvbmQoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JikgY29uc3SYB6sCc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0X3dlZWtkYXkoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPGNoYXI+IGNvbnN0JikgY29uc3SZB6kCc3RkOjpfXzI6OnRpbWVfZ2V0PGNoYXIsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46Ol9fZ2V0X3llYXI0KGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYpIGNvbnN0mgfLAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpnZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB0bSosIHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0KikgY29uc3SbB7MCc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldF90aW1lKHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdG0qKSBjb25zdJwHswJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0X2RhdGUoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCB0bSopIGNvbnN0nQe2AnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXRfd2Vla2RheShzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHRtKikgY29uc3SeB8cCc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZ2V0X3dlZWtkYXluYW1lKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN0nwe4AnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXRfbW9udGhuYW1lKHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgdG0qKSBjb25zdKAHxQJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfbW9udGhuYW1lKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN0oQezAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19nZXRfeWVhcihzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHRtKikgY29uc3SiB8ACc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZ2V0X3llYXIoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JikgY29uc3SjB70CaW50IHN0ZDo6X18yOjpfX2dldF91cF90b19uX2RpZ2l0czx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYsIGludCmkB7oCc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHRtKiwgY2hhciwgY2hhcikgY29uc3SlB70Cc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZ2V0X3BlcmNlbnQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JikgY29uc3SmB78Cc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZ2V0X2RheShpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmKSBjb25zdKcHwAJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfaG91cihpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmKSBjb25zdKgHwwJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfMTJfaG91cihpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmKSBjb25zdKkHyAJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfZGF5X3llYXJfbnVtKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN0qgfBAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF9tb250aChpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmKSBjb25zdKsHwgJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfbWludXRlKGludCYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYpIGNvbnN0rAfBAnN0ZDo6X18yOjp0aW1lX2dldDx3Y2hhcl90LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+OjpfX2dldF93aGl0ZV9zcGFjZShzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmKSBjb25zdK0HwQJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfYW1fcG0oaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JikgY29uc3SuB8ICc3RkOjpfXzI6OnRpbWVfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZ2V0X3NlY29uZChpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmKSBjb25zdK8HwwJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfd2Vla2RheShpbnQmLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCB1bnNpZ25lZCBpbnQmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmKSBjb25zdLAHwQJzdGQ6Ol9fMjo6dGltZV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6X19nZXRfeWVhcjQoaW50Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+IGNvbnN0JikgY29uc3SxB98Bc3RkOjpfXzI6OnRpbWVfcHV0PGNoYXIsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46OmRvX3B1dChzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgc3RkOjpfXzI6Omlvc19iYXNlJiwgY2hhciwgdG0gY29uc3QqLCBjaGFyLCBjaGFyKSBjb25zdLIHSnN0ZDo6X18yOjpfX3RpbWVfcHV0OjpfX2RvX3B1dChjaGFyKiwgY2hhciomLCB0bSBjb25zdCosIGNoYXIsIGNoYXIpIGNvbnN0sweNAXN0ZDo6X18yOjplbmFibGVfaWY8KGlzX21vdmVfY29uc3RydWN0aWJsZTxjaGFyPjo6dmFsdWUpICYmIChpc19tb3ZlX2Fzc2lnbmFibGU8Y2hhcj46OnZhbHVlKSwgdm9pZD46OnR5cGUgc3RkOjpfXzI6OnN3YXA8Y2hhcj4oY2hhciYsIGNoYXImKbQH7gFzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiBzdGQ6Ol9fMjo6X19jb3B5PGNoYXIqLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+KGNoYXIqLCBjaGFyKiwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4ptQfxAXN0ZDo6X18yOjp0aW1lX3B1dDx3Y2hhcl90LCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIHN0ZDo6X18yOjppb3NfYmFzZSYsIHdjaGFyX3QsIHRtIGNvbnN0KiwgY2hhciwgY2hhcikgY29uc3S2B1BzdGQ6Ol9fMjo6X190aW1lX3B1dDo6X19kb19wdXQod2NoYXJfdCosIHdjaGFyX3QqJiwgdG0gY29uc3QqLCBjaGFyLCBjaGFyKSBjb25zdLcHZXN0ZDo6X18yOjpfX2xpYmNwcF9tYnNydG93Y3NfbCh3Y2hhcl90KiwgY2hhciBjb25zdCoqLCB1bnNpZ25lZCBsb25nLCBfX21ic3RhdGVfdCosIF9fbG9jYWxlX3N0cnVjdCopuAcsc3RkOjpfXzI6Ol9fdGhyb3dfcnVudGltZV9lcnJvcihjaGFyIGNvbnN0Kim5B4kCc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gc3RkOjpfXzI6Ol9fY29weTx3Y2hhcl90Kiwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPih3Y2hhcl90Kiwgd2NoYXJfdCosIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+KboHO3N0ZDo6X18yOjptb25leXB1bmN0PGNoYXIsIGZhbHNlPjo6ZG9fZGVjaW1hbF9wb2ludCgpIGNvbnN0uwc2c3RkOjpfXzI6Om1vbmV5cHVuY3Q8Y2hhciwgZmFsc2U+Ojpkb19ncm91cGluZygpIGNvbnN0vAc7c3RkOjpfXzI6Om1vbmV5cHVuY3Q8Y2hhciwgZmFsc2U+Ojpkb19uZWdhdGl2ZV9zaWduKCkgY29uc3S9BzhzdGQ6Ol9fMjo6bW9uZXlwdW5jdDxjaGFyLCBmYWxzZT46OmRvX3Bvc19mb3JtYXQoKSBjb25zdL4HPnN0ZDo6X18yOjptb25leXB1bmN0PHdjaGFyX3QsIGZhbHNlPjo6ZG9fZGVjaW1hbF9wb2ludCgpIGNvbnN0vwc+c3RkOjpfXzI6Om1vbmV5cHVuY3Q8d2NoYXJfdCwgZmFsc2U+Ojpkb19uZWdhdGl2ZV9zaWduKCkgY29uc3TAB6kCc3RkOjpfXzI6Om1vbmV5X2dldDxjaGFyLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBib29sLCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB1bnNpZ25lZCBpbnQmLCBsb25nIGRvdWJsZSYpIGNvbnN0wQeMA3N0ZDo6X18yOjptb25leV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6X19kb19nZXQoc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgYm9vbCwgc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYsIHVuc2lnbmVkIGludCwgdW5zaWduZWQgaW50JiwgYm9vbCYsIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYsIHN0ZDo6X18yOjp1bmlxdWVfcHRyPGNoYXIsIHZvaWQgKCopKHZvaWQqKT4mLCBjaGFyKiYsIGNoYXIqKcIH3QNzdGQ6Ol9fMjo6X19tb25leV9nZXQ8Y2hhcj46Ol9fZ2F0aGVyX2luZm8oYm9vbCwgc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYsIHN0ZDo6X18yOjptb25leV9iYXNlOjpwYXR0ZXJuJiwgY2hhciYsIGNoYXImLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4mLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+JiwgaW50JinDB1JzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPjo6b3BlcmF0b3IrKyhpbnQpxAdmdm9pZCBzdGQ6Ol9fMjo6X19kb3VibGVfb3Jfbm90aGluZzxjaGFyPihzdGQ6Ol9fMjo6dW5pcXVlX3B0cjxjaGFyLCB2b2lkICgqKSh2b2lkKik+JiwgY2hhciomLCBjaGFyKiYpxQeGAXZvaWQgc3RkOjpfXzI6Ol9fZG91YmxlX29yX25vdGhpbmc8dW5zaWduZWQgaW50PihzdGQ6Ol9fMjo6dW5pcXVlX3B0cjx1bnNpZ25lZCBpbnQsIHZvaWQgKCopKHZvaWQqKT4mLCB1bnNpZ25lZCBpbnQqJiwgdW5zaWduZWQgaW50KiYpxgfzAnN0ZDo6X18yOjptb25leV9nZXQ8Y2hhciwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiwgYm9vbCwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiYpIGNvbnN0xwdec3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6Y2xlYXIoKcgH2gFzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+JiBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpfX2FwcGVuZF9mb3J3YXJkX3Vuc2FmZTxjaGFyKj4oY2hhciosIGNoYXIqKckHd3N0ZDo6X18yOjptb25leXB1bmN0PGNoYXIsIHRydWU+IGNvbnN0JiBzdGQ6Ol9fMjo6dXNlX2ZhY2V0PHN0ZDo6X18yOjptb25leXB1bmN0PGNoYXIsIHRydWU+ID4oc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYpyge5AXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46Om9wZXJhdG9yPShzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+JiYpywd5c3RkOjpfXzI6Om1vbmV5cHVuY3Q8Y2hhciwgZmFsc2U+IGNvbnN0JiBzdGQ6Ol9fMjo6dXNlX2ZhY2V0PHN0ZDo6X18yOjptb25leXB1bmN0PGNoYXIsIGZhbHNlPiA+KHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKcwH7wFib29sIHN0ZDo6X18yOjplcXVhbDxzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8Y2hhcio+LCBzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8Y2hhcio+LCBzdGQ6Ol9fMjo6X19lcXVhbF90bzxjaGFyLCBjaGFyPiA+KHN0ZDo6X18yOjpfX3dyYXBfaXRlcjxjaGFyKj4sIHN0ZDo6X18yOjpfX3dyYXBfaXRlcjxjaGFyKj4sIHN0ZDo6X18yOjpfX3dyYXBfaXRlcjxjaGFyKj4sIHN0ZDo6X18yOjpfX2VxdWFsX3RvPGNoYXIsIGNoYXI+Kc0HM3N0ZDo6X18yOjpfX3dyYXBfaXRlcjxjaGFyKj46Om9wZXJhdG9yKyhsb25nKSBjb25zdM4HZXN0ZDo6X18yOjp1bmlxdWVfcHRyPGNoYXIsIHZvaWQgKCopKHZvaWQqKT46Om9wZXJhdG9yPShzdGQ6Ol9fMjo6dW5pcXVlX3B0cjxjaGFyLCB2b2lkICgqKSh2b2lkKik+JiYpzwe+AnN0ZDo6X18yOjptb25leV9nZXQ8d2NoYXJfdCwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgYm9vbCwgc3RkOjpfXzI6Omlvc19iYXNlJiwgdW5zaWduZWQgaW50JiwgbG9uZyBkb3VibGUmKSBjb25zdNAHrQNzdGQ6Ol9fMjo6bW9uZXlfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46Ol9fZG9fZ2V0KHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIGJvb2wsIHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmLCB1bnNpZ25lZCBpbnQsIHVuc2lnbmVkIGludCYsIGJvb2wmLCBzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD4gY29uc3QmLCBzdGQ6Ol9fMjo6dW5pcXVlX3B0cjx3Y2hhcl90LCB2b2lkICgqKSh2b2lkKik+Jiwgd2NoYXJfdComLCB3Y2hhcl90KinRB4EEc3RkOjpfXzI6Ol9fbW9uZXlfZ2V0PHdjaGFyX3Q+OjpfX2dhdGhlcl9pbmZvKGJvb2wsIHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmLCBzdGQ6Ol9fMjo6bW9uZXlfYmFzZTo6cGF0dGVybiYsIHdjaGFyX3QmLCB3Y2hhcl90Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4mLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiYsIGludCYp0gdYc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID46Om9wZXJhdG9yKysoaW50KdMHkQNzdGQ6Ol9fMjo6bW9uZXlfZ2V0PHdjaGFyX3QsIHN0ZDo6X18yOjppc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+ID46OmRvX2dldChzdGQ6Ol9fMjo6aXN0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiwgc3RkOjpfXzI6OmlzdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIGJvb2wsIHN0ZDo6X18yOjppb3NfYmFzZSYsIHVuc2lnbmVkIGludCYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4mKSBjb25zdNQHZ3N0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID46OmNsZWFyKCnVB/UBc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiYgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6X19hcHBlbmRfZm9yd2FyZF91bnNhZmU8d2NoYXJfdCo+KHdjaGFyX3QqLCB3Y2hhcl90KinWB31zdGQ6Ol9fMjo6bW9uZXlwdW5jdDx3Y2hhcl90LCB0cnVlPiBjb25zdCYgc3RkOjpfXzI6OnVzZV9mYWNldDxzdGQ6Ol9fMjo6bW9uZXlwdW5jdDx3Y2hhcl90LCB0cnVlPiA+KHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKdcHywFzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+OjpvcGVyYXRvcj0oc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiYmKdgHf3N0ZDo6X18yOjptb25leXB1bmN0PHdjaGFyX3QsIGZhbHNlPiBjb25zdCYgc3RkOjpfXzI6OnVzZV9mYWNldDxzdGQ6Ol9fMjo6bW9uZXlwdW5jdDx3Y2hhcl90LCBmYWxzZT4gPihzdGQ6Ol9fMjo6bG9jYWxlIGNvbnN0JinZB4oCYm9vbCBzdGQ6Ol9fMjo6ZXF1YWw8c3RkOjpfXzI6Ol9fd3JhcF9pdGVyPHdjaGFyX3QqPiwgc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPHdjaGFyX3QqPiwgc3RkOjpfXzI6Ol9fZXF1YWxfdG88d2NoYXJfdCwgd2NoYXJfdD4gPihzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8d2NoYXJfdCo+LCBzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8d2NoYXJfdCo+LCBzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8d2NoYXJfdCo+LCBzdGQ6Ol9fMjo6X19lcXVhbF90bzx3Y2hhcl90LCB3Y2hhcl90PinaBzZzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8d2NoYXJfdCo+OjpvcGVyYXRvcisobG9uZykgY29uc3TbB9wBc3RkOjpfXzI6Om1vbmV5X3B1dDxjaGFyLCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4sIGJvb2wsIHN0ZDo6X18yOjppb3NfYmFzZSYsIGNoYXIsIGxvbmcgZG91YmxlKSBjb25zdNwHiwNzdGQ6Ol9fMjo6X19tb25leV9wdXQ8Y2hhcj46Ol9fZ2F0aGVyX2luZm8oYm9vbCwgYm9vbCwgc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYsIHN0ZDo6X18yOjptb25leV9iYXNlOjpwYXR0ZXJuJiwgY2hhciYsIGNoYXImLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4mLCBpbnQmKd0H2QNzdGQ6Ol9fMjo6X19tb25leV9wdXQ8Y2hhcj46Ol9fZm9ybWF0KGNoYXIqLCBjaGFyKiYsIGNoYXIqJiwgdW5zaWduZWQgaW50LCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHN0ZDo6X18yOjpjdHlwZTxjaGFyPiBjb25zdCYsIGJvb2wsIHN0ZDo6X18yOjptb25leV9iYXNlOjpwYXR0ZXJuIGNvbnN0JiwgY2hhciwgY2hhciwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID4gY29uc3QmLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0JiwgaW50Kd4HjgFjaGFyKiBzdGQ6Ol9fMjo6Y29weTxzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8Y2hhciBjb25zdCo+LCBjaGFyKj4oc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPGNoYXIgY29uc3QqPiwgc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPGNoYXIgY29uc3QqPiwgY2hhciop3wetAnN0ZDo6X18yOjptb25leV9wdXQ8Y2hhciwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+LCBib29sLCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCBjaGFyLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0JikgY29uc3TgB+4Bc3RkOjpfXzI6Om1vbmV5X3B1dDx3Y2hhcl90LCBzdGQ6Ol9fMjo6b3N0cmVhbWJ1Zl9pdGVyYXRvcjx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4gPiA+Ojpkb19wdXQoc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4sIGJvb2wsIHN0ZDo6X18yOjppb3NfYmFzZSYsIHdjaGFyX3QsIGxvbmcgZG91YmxlKSBjb25zdOEHpgNzdGQ6Ol9fMjo6X19tb25leV9wdXQ8d2NoYXJfdD46Ol9fZ2F0aGVyX2luZm8oYm9vbCwgYm9vbCwgc3RkOjpfXzI6OmxvY2FsZSBjb25zdCYsIHN0ZDo6X18yOjptb25leV9iYXNlOjpwYXR0ZXJuJiwgd2NoYXJfdCYsIHdjaGFyX3QmLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+Jiwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPiYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4mLCBpbnQmKeIHhgRzdGQ6Ol9fMjo6X19tb25leV9wdXQ8d2NoYXJfdD46Ol9fZm9ybWF0KHdjaGFyX3QqLCB3Y2hhcl90KiYsIHdjaGFyX3QqJiwgdW5zaWduZWQgaW50LCB3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdCosIHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90PiBjb25zdCYsIGJvb2wsIHN0ZDo6X18yOjptb25leV9iYXNlOjpwYXR0ZXJuIGNvbnN0Jiwgd2NoYXJfdCwgd2NoYXJfdCwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCYsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4gY29uc3QmLCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+IGNvbnN0JiwgaW50KeMHoAF3Y2hhcl90KiBzdGQ6Ol9fMjo6Y29weTxzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8d2NoYXJfdCBjb25zdCo+LCB3Y2hhcl90Kj4oc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPHdjaGFyX3QgY29uc3QqPiwgc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPHdjaGFyX3QgY29uc3QqPiwgd2NoYXJfdCop5AfIAnN0ZDo6X18yOjptb25leV9wdXQ8d2NoYXJfdCwgc3RkOjpfXzI6Om9zdHJlYW1idWZfaXRlcmF0b3I8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+ID4gPjo6ZG9fcHV0KHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90PiA+LCBib29sLCBzdGQ6Ol9fMjo6aW9zX2Jhc2UmLCB3Y2hhcl90LCBzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+IGNvbnN0JikgY29uc3TlB5ABY2hhciogc3RkOjpfXzI6Ol9fY29weTxzdGQ6Ol9fMjo6X193cmFwX2l0ZXI8Y2hhciBjb25zdCo+LCBjaGFyKj4oc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPGNoYXIgY29uc3QqPiwgc3RkOjpfXzI6Ol9fd3JhcF9pdGVyPGNoYXIgY29uc3QqPiwgY2hhciop5geiAXdjaGFyX3QqIHN0ZDo6X18yOjpfX2NvcHk8c3RkOjpfXzI6Ol9fd3JhcF9pdGVyPHdjaGFyX3QgY29uc3QqPiwgd2NoYXJfdCo+KHN0ZDo6X18yOjpfX3dyYXBfaXRlcjx3Y2hhcl90IGNvbnN0Kj4sIHN0ZDo6X18yOjpfX3dyYXBfaXRlcjx3Y2hhcl90IGNvbnN0Kj4sIHdjaGFyX3QqKecHngFzdGQ6Ol9fMjo6bWVzc2FnZXM8Y2hhcj46OmRvX29wZW4oc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCYsIHN0ZDo6X18yOjpsb2NhbGUgY29uc3QmKSBjb25zdOgHlAFzdGQ6Ol9fMjo6bWVzc2FnZXM8Y2hhcj46OmRvX2dldChsb25nLCBpbnQsIGludCwgc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiBjb25zdCYpIGNvbnN06Qe4A3N0ZDo6X18yOjpiYWNrX2luc2VydF9pdGVyYXRvcjxzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+ID4gc3RkOjpfXzI6Ol9fbmFycm93X3RvX3V0Zjg8OHVsPjo6b3BlcmF0b3IoKTxzdGQ6Ol9fMjo6YmFja19pbnNlcnRfaXRlcmF0b3I8c3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiA+LCBjaGFyPihzdGQ6Ol9fMjo6YmFja19pbnNlcnRfaXRlcmF0b3I8c3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiA+LCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdCopIGNvbnN06geOAXN0ZDo6X18yOjpiYWNrX2luc2VydF9pdGVyYXRvcjxzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+ID46Om9wZXJhdG9yPShjaGFyIGNvbnN0JinrB6ABc3RkOjpfXzI6Om1lc3NhZ2VzPHdjaGFyX3Q+Ojpkb19nZXQobG9uZywgaW50LCBpbnQsIHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4gY29uc3QmKSBjb25zdOwHwgNzdGQ6Ol9fMjo6YmFja19pbnNlcnRfaXRlcmF0b3I8c3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPiA+IHN0ZDo6X18yOjpfX25hcnJvd190b191dGY4PDMydWw+OjpvcGVyYXRvcigpPHN0ZDo6X18yOjpiYWNrX2luc2VydF9pdGVyYXRvcjxzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+ID4sIHdjaGFyX3Q+KHN0ZDo6X18yOjpiYWNrX2luc2VydF9pdGVyYXRvcjxzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+ID4sIHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0KikgY29uc3TtB9ADc3RkOjpfXzI6OmJhY2tfaW5zZXJ0X2l0ZXJhdG9yPHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4gPiBzdGQ6Ol9fMjo6X193aWRlbl9mcm9tX3V0Zjg8MzJ1bD46Om9wZXJhdG9yKCk8c3RkOjpfXzI6OmJhY2tfaW5zZXJ0X2l0ZXJhdG9yPHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID4gPiA+KHN0ZDo6X18yOjpiYWNrX2luc2VydF9pdGVyYXRvcjxzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+ID4sIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KikgY29uc3TuBzlzdGQ6Ol9fMjo6Y29kZWN2dDx3Y2hhcl90LCBjaGFyLCBfX21ic3RhdGVfdD46On5jb2RlY3Z0KCnvBy1zdGQ6Ol9fMjo6bG9jYWxlOjpfX2ltcDo6X19pbXAodW5zaWduZWQgbG9uZynwB35zdGQ6Ol9fMjo6X192ZWN0b3JfYmFzZTxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiA+OjpfX3ZlY3Rvcl9iYXNlKCnxB4IBc3RkOjpfXzI6OnZlY3RvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiA+OjpfX3ZhbGxvY2F0ZSh1bnNpZ25lZCBsb25nKfIHiQFzdGQ6Ol9fMjo6dmVjdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46Ol9fY29uc3RydWN0X2F0X2VuZCh1bnNpZ25lZCBsb25nKfMHdnN0ZDo6X18yOjpfX3ZlY3Rvcl9iYXNlPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46OmNsZWFyKCn0B44Bc3RkOjpfXzI6OnZlY3RvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiA+OjpfX2Fubm90YXRlX3Nocmluayh1bnNpZ25lZCBsb25nKSBjb25zdPUHHXN0ZDo6X18yOjpsb2NhbGU6OmlkOjpfX2dldCgp9gdAc3RkOjpfXzI6OmxvY2FsZTo6X19pbXA6Omluc3RhbGwoc3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBsb25nKfcHSHN0ZDo6X18yOjpjdHlwZTxjaGFyPjo6Y3R5cGUodW5zaWduZWQgc2hvcnQgY29uc3QqLCBib29sLCB1bnNpZ25lZCBsb25nKfgHG3N0ZDo6X18yOjpsb2NhbGU6OmNsYXNzaWMoKfkHfXN0ZDo6X18yOjp2ZWN0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4gPjo6cmVzaXplKHVuc2lnbmVkIGxvbmcp+gchc3RkOjpfXzI6OmxvY2FsZTo6X19pbXA6On5fX2ltcCgp+weBAXN0ZDo6X18yOjp2ZWN0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4gPjo6X19hbm5vdGF0ZV9kZWxldGUoKSBjb25zdPwHI3N0ZDo6X18yOjpsb2NhbGU6Ol9faW1wOjp+X19pbXAoKS4x/Qd/c3RkOjpfXzI6OnZlY3RvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiA+OjpfX2FwcGVuZCh1bnNpZ25lZCBsb25nKf4HHHN0ZDo6X18yOjpsb2NhbGU6Ol9fZ2xvYmFsKCn/BxpzdGQ6Ol9fMjo6bG9jYWxlOjpsb2NhbGUoKYAILnN0ZDo6X18yOjpsb2NhbGU6Ol9faW1wOjpoYXNfZmFjZXQobG9uZykgY29uc3SBCB5zdGQ6Ol9fMjo6bG9jYWxlOjppZDo6X19pbml0KCmCCIwBdm9pZCBzdGQ6Ol9fMjo6Y2FsbF9vbmNlPHN0ZDo6X18yOjooYW5vbnltb3VzIG5hbWVzcGFjZSk6Ol9fZmFrZV9iaW5kPihzdGQ6Ol9fMjo6b25jZV9mbGFnJiwgc3RkOjpfXzI6Oihhbm9ueW1vdXMgbmFtZXNwYWNlKTo6X19mYWtlX2JpbmQmJimDCCtzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldDo6X19vbl96ZXJvX3NoYXJlZCgphAhpdm9pZCBzdGQ6Ol9fMjo6X19jYWxsX29uY2VfcHJveHk8c3RkOjpfXzI6OnR1cGxlPHN0ZDo6X18yOjooYW5vbnltb3VzIG5hbWVzcGFjZSk6Ol9fZmFrZV9iaW5kJiY+ID4odm9pZCophQg+c3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+Ojpkb19pcyh1bnNpZ25lZCBzaG9ydCwgd2NoYXJfdCkgY29uc3SGCFZzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD46OmRvX2lzKHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0KiwgdW5zaWduZWQgc2hvcnQqKSBjb25zdIcIWnN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90Pjo6ZG9fc2Nhbl9pcyh1bnNpZ25lZCBzaG9ydCwgd2NoYXJfdCBjb25zdCosIHdjaGFyX3QgY29uc3QqKSBjb25zdIgIW3N0ZDo6X18yOjpjdHlwZTx3Y2hhcl90Pjo6ZG9fc2Nhbl9ub3QodW5zaWduZWQgc2hvcnQsIHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0KikgY29uc3SJCDNzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD46OmRvX3RvdXBwZXIod2NoYXJfdCkgY29uc3SKCERzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD46OmRvX3RvdXBwZXIod2NoYXJfdCosIHdjaGFyX3QgY29uc3QqKSBjb25zdIsIM3N0ZDo6X18yOjpjdHlwZTx3Y2hhcl90Pjo6ZG9fdG9sb3dlcih3Y2hhcl90KSBjb25zdIwIRHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90Pjo6ZG9fdG9sb3dlcih3Y2hhcl90Kiwgd2NoYXJfdCBjb25zdCopIGNvbnN0jQguc3RkOjpfXzI6OmN0eXBlPHdjaGFyX3Q+Ojpkb193aWRlbihjaGFyKSBjb25zdI4ITHN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90Pjo6ZG9fd2lkZW4oY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCB3Y2hhcl90KikgY29uc3SPCDhzdGQ6Ol9fMjo6Y3R5cGU8d2NoYXJfdD46OmRvX25hcnJvdyh3Y2hhcl90LCBjaGFyKSBjb25zdJAIVnN0ZDo6X18yOjpjdHlwZTx3Y2hhcl90Pjo6ZG9fbmFycm93KHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0KiwgY2hhciwgY2hhciopIGNvbnN0kQgfc3RkOjpfXzI6OmN0eXBlPGNoYXI+Ojp+Y3R5cGUoKZIIIXN0ZDo6X18yOjpjdHlwZTxjaGFyPjo6fmN0eXBlKCkuMZMILXN0ZDo6X18yOjpjdHlwZTxjaGFyPjo6ZG9fdG91cHBlcihjaGFyKSBjb25zdJQIO3N0ZDo6X18yOjpjdHlwZTxjaGFyPjo6ZG9fdG91cHBlcihjaGFyKiwgY2hhciBjb25zdCopIGNvbnN0lQgtc3RkOjpfXzI6OmN0eXBlPGNoYXI+Ojpkb190b2xvd2VyKGNoYXIpIGNvbnN0lgg7c3RkOjpfXzI6OmN0eXBlPGNoYXI+Ojpkb190b2xvd2VyKGNoYXIqLCBjaGFyIGNvbnN0KikgY29uc3SXCEZzdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj46OmRvX3dpZGVuKGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgY2hhciopIGNvbnN0mAgyc3RkOjpfXzI6OmN0eXBlPGNoYXI+Ojpkb19uYXJyb3coY2hhciwgY2hhcikgY29uc3SZCE1zdGQ6Ol9fMjo6Y3R5cGU8Y2hhcj46OmRvX25hcnJvdyhjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIGNoYXIsIGNoYXIqKSBjb25zdJoIhAFzdGQ6Ol9fMjo6Y29kZWN2dDxjaGFyLCBjaGFyLCBfX21ic3RhdGVfdD46OmRvX291dChfX21ic3RhdGVfdCYsIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdComLCBjaGFyKiwgY2hhciosIGNoYXIqJikgY29uc3SbCGBzdGQ6Ol9fMjo6Y29kZWN2dDxjaGFyLCBjaGFyLCBfX21ic3RhdGVfdD46OmRvX3Vuc2hpZnQoX19tYnN0YXRlX3QmLCBjaGFyKiwgY2hhciosIGNoYXIqJikgY29uc3ScCHJzdGQ6Ol9fMjo6Y29kZWN2dDxjaGFyLCBjaGFyLCBfX21ic3RhdGVfdD46OmRvX2xlbmd0aChfX21ic3RhdGVfdCYsIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgbG9uZykgY29uc3SdCDtzdGQ6Ol9fMjo6Y29kZWN2dDx3Y2hhcl90LCBjaGFyLCBfX21ic3RhdGVfdD46On5jb2RlY3Z0KCkuMZ4IkAFzdGQ6Ol9fMjo6Y29kZWN2dDx3Y2hhcl90LCBjaGFyLCBfX21ic3RhdGVfdD46OmRvX291dChfX21ic3RhdGVfdCYsIHdjaGFyX3QgY29uc3QqLCB3Y2hhcl90IGNvbnN0Kiwgd2NoYXJfdCBjb25zdComLCBjaGFyKiwgY2hhciosIGNoYXIqJikgY29uc3SfCHVzdGQ6Ol9fMjo6X19saWJjcHBfd2NzbnJ0b21ic19sKGNoYXIqLCB3Y2hhcl90IGNvbnN0KiosIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIF9fbWJzdGF0ZV90KiwgX19sb2NhbGVfc3RydWN0KimgCExzdGQ6Ol9fMjo6X19saWJjcHBfd2NydG9tYl9sKGNoYXIqLCB3Y2hhcl90LCBfX21ic3RhdGVfdCosIF9fbG9jYWxlX3N0cnVjdCopoQiPAXN0ZDo6X18yOjpjb2RlY3Z0PHdjaGFyX3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9faW4oX19tYnN0YXRlX3QmLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqJiwgd2NoYXJfdCosIHdjaGFyX3QqLCB3Y2hhcl90KiYpIGNvbnN0ogh1c3RkOjpfXzI6Ol9fbGliY3BwX21ic25ydG93Y3NfbCh3Y2hhcl90KiwgY2hhciBjb25zdCoqLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCBfX21ic3RhdGVfdCosIF9fbG9jYWxlX3N0cnVjdCopowhic3RkOjpfXzI6Ol9fbGliY3BwX21icnRvd2NfbCh3Y2hhcl90KiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGxvbmcsIF9fbWJzdGF0ZV90KiwgX19sb2NhbGVfc3RydWN0KimkCGNzdGQ6Ol9fMjo6Y29kZWN2dDx3Y2hhcl90LCBjaGFyLCBfX21ic3RhdGVfdD46OmRvX3Vuc2hpZnQoX19tYnN0YXRlX3QmLCBjaGFyKiwgY2hhciosIGNoYXIqJikgY29uc3SlCEJzdGQ6Ol9fMjo6Y29kZWN2dDx3Y2hhcl90LCBjaGFyLCBfX21ic3RhdGVfdD46OmRvX2VuY29kaW5nKCkgY29uc3SmCFNzdGQ6Ol9fMjo6X19saWJjcHBfbWJ0b3djX2wod2NoYXJfdCosIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBsb25nLCBfX2xvY2FsZV9zdHJ1Y3QqKacIMXN0ZDo6X18yOjpfX2xpYmNwcF9tYl9jdXJfbWF4X2woX19sb2NhbGVfc3RydWN0KimoCHVzdGQ6Ol9fMjo6Y29kZWN2dDx3Y2hhcl90LCBjaGFyLCBfX21ic3RhdGVfdD46OmRvX2xlbmd0aChfX21ic3RhdGVfdCYsIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgbG9uZykgY29uc3SpCFdzdGQ6Ol9fMjo6X19saWJjcHBfbWJybGVuX2woY2hhciBjb25zdCosIHVuc2lnbmVkIGxvbmcsIF9fbWJzdGF0ZV90KiwgX19sb2NhbGVfc3RydWN0KimqCERzdGQ6Ol9fMjo6Y29kZWN2dDx3Y2hhcl90LCBjaGFyLCBfX21ic3RhdGVfdD46OmRvX21heF9sZW5ndGgoKSBjb25zdKsIlAFzdGQ6Ol9fMjo6Y29kZWN2dDxjaGFyMTZfdCwgY2hhciwgX19tYnN0YXRlX3Q+Ojpkb19vdXQoX19tYnN0YXRlX3QmLCBjaGFyMTZfdCBjb25zdCosIGNoYXIxNl90IGNvbnN0KiwgY2hhcjE2X3QgY29uc3QqJiwgY2hhciosIGNoYXIqLCBjaGFyKiYpIGNvbnN0rAi1AXN0ZDo6X18yOjp1dGYxNl90b191dGY4KHVuc2lnbmVkIHNob3J0IGNvbnN0KiwgdW5zaWduZWQgc2hvcnQgY29uc3QqLCB1bnNpZ25lZCBzaG9ydCBjb25zdComLCB1bnNpZ25lZCBjaGFyKiwgdW5zaWduZWQgY2hhciosIHVuc2lnbmVkIGNoYXIqJiwgdW5zaWduZWQgbG9uZywgc3RkOjpfXzI6OmNvZGVjdnRfbW9kZSmtCJMBc3RkOjpfXzI6OmNvZGVjdnQ8Y2hhcjE2X3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9faW4oX19tYnN0YXRlX3QmLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqJiwgY2hhcjE2X3QqLCBjaGFyMTZfdCosIGNoYXIxNl90KiYpIGNvbnN0rgi1AXN0ZDo6X18yOjp1dGY4X3RvX3V0ZjE2KHVuc2lnbmVkIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgY2hhciBjb25zdComLCB1bnNpZ25lZCBzaG9ydCosIHVuc2lnbmVkIHNob3J0KiwgdW5zaWduZWQgc2hvcnQqJiwgdW5zaWduZWQgbG9uZywgc3RkOjpfXzI6OmNvZGVjdnRfbW9kZSmvCHZzdGQ6Ol9fMjo6Y29kZWN2dDxjaGFyMTZfdCwgY2hhciwgX19tYnN0YXRlX3Q+Ojpkb19sZW5ndGgoX19tYnN0YXRlX3QmLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGxvbmcpIGNvbnN0sAiAAXN0ZDo6X18yOjp1dGY4X3RvX3V0ZjE2X2xlbmd0aCh1bnNpZ25lZCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgY2hhciBjb25zdCosIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIHN0ZDo6X18yOjpjb2RlY3Z0X21vZGUpsQhFc3RkOjpfXzI6OmNvZGVjdnQ8Y2hhcjE2X3QsIGNoYXIsIF9fbWJzdGF0ZV90Pjo6ZG9fbWF4X2xlbmd0aCgpIGNvbnN0sgiUAXN0ZDo6X18yOjpjb2RlY3Z0PGNoYXIzMl90LCBjaGFyLCBfX21ic3RhdGVfdD46OmRvX291dChfX21ic3RhdGVfdCYsIGNoYXIzMl90IGNvbnN0KiwgY2hhcjMyX3QgY29uc3QqLCBjaGFyMzJfdCBjb25zdComLCBjaGFyKiwgY2hhciosIGNoYXIqJikgY29uc3SzCK4Bc3RkOjpfXzI6OnVjczRfdG9fdXRmOCh1bnNpZ25lZCBpbnQgY29uc3QqLCB1bnNpZ25lZCBpbnQgY29uc3QqLCB1bnNpZ25lZCBpbnQgY29uc3QqJiwgdW5zaWduZWQgY2hhciosIHVuc2lnbmVkIGNoYXIqLCB1bnNpZ25lZCBjaGFyKiYsIHVuc2lnbmVkIGxvbmcsIHN0ZDo6X18yOjpjb2RlY3Z0X21vZGUptAiTAXN0ZDo6X18yOjpjb2RlY3Z0PGNoYXIzMl90LCBjaGFyLCBfX21ic3RhdGVfdD46OmRvX2luKF9fbWJzdGF0ZV90JiwgY2hhciBjb25zdCosIGNoYXIgY29uc3QqLCBjaGFyIGNvbnN0KiYsIGNoYXIzMl90KiwgY2hhcjMyX3QqLCBjaGFyMzJfdComKSBjb25zdLUIrgFzdGQ6Ol9fMjo6dXRmOF90b191Y3M0KHVuc2lnbmVkIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBjaGFyIGNvbnN0KiwgdW5zaWduZWQgY2hhciBjb25zdComLCB1bnNpZ25lZCBpbnQqLCB1bnNpZ25lZCBpbnQqLCB1bnNpZ25lZCBpbnQqJiwgdW5zaWduZWQgbG9uZywgc3RkOjpfXzI6OmNvZGVjdnRfbW9kZSm2CHZzdGQ6Ol9fMjo6Y29kZWN2dDxjaGFyMzJfdCwgY2hhciwgX19tYnN0YXRlX3Q+Ojpkb19sZW5ndGgoX19tYnN0YXRlX3QmLCBjaGFyIGNvbnN0KiwgY2hhciBjb25zdCosIHVuc2lnbmVkIGxvbmcpIGNvbnN0twh/c3RkOjpfXzI6OnV0ZjhfdG9fdWNzNF9sZW5ndGgodW5zaWduZWQgY2hhciBjb25zdCosIHVuc2lnbmVkIGNoYXIgY29uc3QqLCB1bnNpZ25lZCBsb25nLCB1bnNpZ25lZCBsb25nLCBzdGQ6Ol9fMjo6Y29kZWN2dF9tb2RlKbgIJXN0ZDo6X18yOjpudW1wdW5jdDxjaGFyPjo6fm51bXB1bmN0KCm5CCdzdGQ6Ol9fMjo6bnVtcHVuY3Q8Y2hhcj46On5udW1wdW5jdCgpLjG6CChzdGQ6Ol9fMjo6bnVtcHVuY3Q8d2NoYXJfdD46On5udW1wdW5jdCgpuwgqc3RkOjpfXzI6Om51bXB1bmN0PHdjaGFyX3Q+Ojp+bnVtcHVuY3QoKS4xvAgyc3RkOjpfXzI6Om51bXB1bmN0PGNoYXI+Ojpkb19kZWNpbWFsX3BvaW50KCkgY29uc3S9CDJzdGQ6Ol9fMjo6bnVtcHVuY3Q8Y2hhcj46OmRvX3Rob3VzYW5kc19zZXAoKSBjb25zdL4ILXN0ZDo6X18yOjpudW1wdW5jdDxjaGFyPjo6ZG9fZ3JvdXBpbmcoKSBjb25zdL8IMHN0ZDo6X18yOjpudW1wdW5jdDx3Y2hhcl90Pjo6ZG9fZ3JvdXBpbmcoKSBjb25zdMAILXN0ZDo6X18yOjpudW1wdW5jdDxjaGFyPjo6ZG9fdHJ1ZW5hbWUoKSBjb25zdMEIMHN0ZDo6X18yOjpudW1wdW5jdDx3Y2hhcl90Pjo6ZG9fdHJ1ZW5hbWUoKSBjb25zdMIIfHN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID46OmJhc2ljX3N0cmluZyh3Y2hhcl90IGNvbnN0KinDCC5zdGQ6Ol9fMjo6bnVtcHVuY3Q8Y2hhcj46OmRvX2ZhbHNlbmFtZSgpIGNvbnN0xAgxc3RkOjpfXzI6Om51bXB1bmN0PHdjaGFyX3Q+Ojpkb19mYWxzZW5hbWUoKSBjb25zdMUIbXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46Om9wZXJhdG9yPShjaGFyIGNvbnN0KinGCDVzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8Y2hhcj46Ol9fd2Vla3MoKSBjb25zdMcIFnN0ZDo6X18yOjppbml0X3dlZWtzKCnICBpfX2N4eF9nbG9iYWxfYXJyYXlfZHRvci41NMkIOHN0ZDo6X18yOjpfX3RpbWVfZ2V0X2Nfc3RvcmFnZTx3Y2hhcl90Pjo6X193ZWVrcygpIGNvbnN0yggXc3RkOjpfXzI6OmluaXRfd3dlZWtzKCnLCBpfX2N4eF9nbG9iYWxfYXJyYXlfZHRvci42OcwIeXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID46Om9wZXJhdG9yPSh3Y2hhcl90IGNvbnN0KinNCDZzdGQ6Ol9fMjo6X190aW1lX2dldF9jX3N0b3JhZ2U8Y2hhcj46Ol9fbW9udGhzKCkgY29uc3TOCBdzdGQ6Ol9fMjo6aW5pdF9tb250aHMoKc8IGl9fY3h4X2dsb2JhbF9hcnJheV9kdG9yLjg00Ag5c3RkOjpfXzI6Ol9fdGltZV9nZXRfY19zdG9yYWdlPHdjaGFyX3Q+OjpfX21vbnRocygpIGNvbnN00QgYc3RkOjpfXzI6OmluaXRfd21vbnRocygp0ggbX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuMTA40wg1c3RkOjpfXzI6Ol9fdGltZV9nZXRfY19zdG9yYWdlPGNoYXI+OjpfX2FtX3BtKCkgY29uc3TUCBZzdGQ6Ol9fMjo6aW5pdF9hbV9wbSgp1QgbX19jeHhfZ2xvYmFsX2FycmF5X2R0b3IuMTMy1gg4c3RkOjpfXzI6Ol9fdGltZV9nZXRfY19zdG9yYWdlPHdjaGFyX3Q+OjpfX2FtX3BtKCkgY29uc3TXCBdzdGQ6Ol9fMjo6aW5pdF93YW1fcG0oKdgIG19fY3h4X2dsb2JhbF9hcnJheV9kdG9yLjEzNdkIMXN0ZDo6X18yOjpfX3RpbWVfZ2V0X2Nfc3RvcmFnZTxjaGFyPjo6X194KCkgY29uc3TaCBlfX2N4eF9nbG9iYWxfYXJyYXlfZHRvci4x2wg0c3RkOjpfXzI6Ol9fdGltZV9nZXRfY19zdG9yYWdlPHdjaGFyX3Q+OjpfX3goKSBjb25zdNwIGl9fY3h4X2dsb2JhbF9hcnJheV9kdG9yLjMx3Qgxc3RkOjpfXzI6Ol9fdGltZV9nZXRfY19zdG9yYWdlPGNoYXI+OjpfX1goKSBjb25zdN4IGl9fY3h4X2dsb2JhbF9hcnJheV9kdG9yLjMz3wg0c3RkOjpfXzI6Ol9fdGltZV9nZXRfY19zdG9yYWdlPHdjaGFyX3Q+OjpfX1goKSBjb25zdOAIGl9fY3h4X2dsb2JhbF9hcnJheV9kdG9yLjM14Qgxc3RkOjpfXzI6Ol9fdGltZV9nZXRfY19zdG9yYWdlPGNoYXI+OjpfX2MoKSBjb25zdOIIGl9fY3h4X2dsb2JhbF9hcnJheV9kdG9yLjM34wg0c3RkOjpfXzI6Ol9fdGltZV9nZXRfY19zdG9yYWdlPHdjaGFyX3Q+OjpfX2MoKSBjb25zdOQIGl9fY3h4X2dsb2JhbF9hcnJheV9kdG9yLjM55Qgxc3RkOjpfXzI6Ol9fdGltZV9nZXRfY19zdG9yYWdlPGNoYXI+OjpfX3IoKSBjb25zdOYIGl9fY3h4X2dsb2JhbF9hcnJheV9kdG9yLjQx5wg0c3RkOjpfXzI6Ol9fdGltZV9nZXRfY19zdG9yYWdlPHdjaGFyX3Q+OjpfX3IoKSBjb25zdOgIGl9fY3h4X2dsb2JhbF9hcnJheV9kdG9yLjQz6Qhpc3RkOjpfXzI6OnRpbWVfcHV0PGNoYXIsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46On50aW1lX3B1dCgp6ghrc3RkOjpfXzI6OnRpbWVfcHV0PGNoYXIsIHN0ZDo6X18yOjpvc3RyZWFtYnVmX2l0ZXJhdG9yPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiA+ID46On50aW1lX3B1dCgpLjHrCHhzdGQ6Ol9fMjo6dmVjdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46Om1heF9zaXplKCkgY29uc3TsCKsBc3RkOjpfXzI6OmFsbG9jYXRvcl90cmFpdHM8c3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46OmFsbG9jYXRlKHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiYsIHVuc2lnbmVkIGxvbmcp7QiLAXN0ZDo6X18yOjp2ZWN0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4gPjo6X19hbm5vdGF0ZV9uZXcodW5zaWduZWQgbG9uZykgY29uc3TuCF9zdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD46OmFsbG9jYXRlKHVuc2lnbmVkIGxvbmcsIHZvaWQgY29uc3QqKe8IP3N0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj46OmFsbG9jYXRlKHVuc2lnbmVkIGxvbmcsIHZvaWQgY29uc3QqKfAIyAFzdGQ6Ol9fMjo6YWxsb2NhdG9yX3RyYWl0czxzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4gPjo6ZGVhbGxvY2F0ZShzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4mLCBzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCoqLCB1bnNpZ25lZCBsb25nKfEImwFzdGQ6Ol9fMjo6X192ZWN0b3JfYmFzZTxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiA+OjpfX2Rlc3RydWN0X2F0X2VuZChzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCoqKfIIInN0ZDo6X18yOjpfX3RpbWVfcHV0OjpfX3RpbWVfcHV0KCnzCIgBc3RkOjpfXzI6OnZlY3RvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiA+OjpfX3JlY29tbWVuZCh1bnNpZ25lZCBsb25nKSBjb25zdPQI2AFzdGQ6Ol9fMjo6X19zcGxpdF9idWZmZXI8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4mPjo6X19zcGxpdF9idWZmZXIodW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+Jin1CJEBc3RkOjpfXzI6Ol9fc3BsaXRfYnVmZmVyPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+Jj46Ol9fY29uc3RydWN0X2F0X2VuZCh1bnNpZ25lZCBsb25nKfYI8wFzdGQ6Ol9fMjo6dmVjdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+ID46Ol9fc3dhcF9vdXRfY2lyY3VsYXJfYnVmZmVyKHN0ZDo6X18yOjpfX3NwbGl0X2J1ZmZlcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiY+Jin3CMYDc3RkOjpfXzI6OmVuYWJsZV9pZjwoKHN0ZDo6X18yOjppbnRlZ3JhbF9jb25zdGFudDxib29sLCBmYWxzZT46OnZhbHVlKSB8fCAoIShfX2hhc19jb25zdHJ1Y3Q8c3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+LCBib29sKiwgYm9vbD46OnZhbHVlKSkpICYmIChpc190cml2aWFsbHlfbW92ZV9jb25zdHJ1Y3RpYmxlPGJvb2w+Ojp2YWx1ZSksIHZvaWQ+Ojp0eXBlIHN0ZDo6X18yOjphbGxvY2F0b3JfdHJhaXRzPHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiA+OjpfX2NvbnN0cnVjdF9iYWNrd2FyZDxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCo+KHN0ZDo6X18yOjpfX3Nzb19hbGxvY2F0b3I8c3RkOjpfXzI6OmxvY2FsZTo6ZmFjZXQqLCAyOHVsPiYsIGJvb2wqLCBib29sKiwgYm9vbComKfgIfHN0ZDo6X18yOjpfX2NvbXByZXNzZWRfcGFpcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCoqLCBzdGQ6Ol9fMjo6X19zc29fYWxsb2NhdG9yPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiwgMjh1bD4mPjo6c2Vjb25kKCn5CMYBc3RkOjpfXzI6Ol9fc3BsaXRfYnVmZmVyPHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0Kiwgc3RkOjpfXzI6Ol9fc3NvX2FsbG9jYXRvcjxzdGQ6Ol9fMjo6bG9jYWxlOjpmYWNldCosIDI4dWw+Jj46Ol9fZGVzdHJ1Y3RfYXRfZW5kKHN0ZDo6X18yOjpsb2NhbGU6OmZhY2V0KiosIHN0ZDo6X18yOjppbnRlZ3JhbF9jb25zdGFudDxib29sLCBmYWxzZT4p+ghAc3RkOjpfXzI6Oihhbm9ueW1vdXMgbmFtZXNwYWNlKTo6X19mYWtlX2JpbmQ6Om9wZXJhdG9yKCkoKSBjb25zdPsIQnN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD46OmFsbG9jYXRlKHVuc2lnbmVkIGxvbmcsIHZvaWQgY29uc3QqKfwIa3N0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46Ol9fY2xlYXJfYW5kX3Nocmluaygp/Qh0c3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6X19jbGVhcl9hbmRfc2hyaW5rKCn+CENsb25nIGRvdWJsZSBzdGQ6Ol9fMjo6X19kb19zdHJ0b2Q8bG9uZyBkb3VibGU+KGNoYXIgY29uc3QqLCBjaGFyKiop/wgtc3RkOjpfXzI6Ol9fc2hhcmVkX2NvdW50Ojp+X19zaGFyZWRfY291bnQoKS4xgAkvc3RkOjpfXzI6Ol9fc2hhcmVkX3dlYWtfY291bnQ6Ol9fcmVsZWFzZV93ZWFrKCmBCUlzdGQ6Ol9fMjo6X19zaGFyZWRfd2Vha19jb3VudDo6X19nZXRfZGVsZXRlcihzdGQ6OnR5cGVfaW5mbyBjb25zdCYpIGNvbnN0gglGc3RkOjpfXzI6Ol9fY2FsbF9vbmNlKHVuc2lnbmVkIGxvbmcgdm9sYXRpbGUmLCB2b2lkKiwgdm9pZCAoKikodm9pZCopKYMJG29wZXJhdG9yIG5ldyh1bnNpZ25lZCBsb25nKYQJPXN0ZDo6X18yOjpfX2xpYmNwcF9yZWZzdHJpbmc6Ol9fbGliY3BwX3JlZnN0cmluZyhjaGFyIGNvbnN0KimFCQd3bWVtc2V0hgkId21lbW1vdmWHCUNzdGQ6Ol9fMjo6X19iYXNpY19zdHJpbmdfY29tbW9uPHRydWU+OjpfX3Rocm93X2xlbmd0aF9lcnJvcigpIGNvbnN0iAnBAXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OmJhc2ljX3N0cmluZyhzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+IGNvbnN0JimJCXlzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpfX2luaXQoY2hhciBjb25zdCosIHVuc2lnbmVkIGxvbmcpiglmc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6fmJhc2ljX3N0cmluZygpiwl5c3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6YXNzaWduKGNoYXIgY29uc3QqLCB1bnNpZ25lZCBsb25nKYwJ0wFzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPGNoYXIsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czxjaGFyPiwgc3RkOjpfXzI6OmFsbG9jYXRvcjxjaGFyPiA+OjpfX2dyb3dfYnlfYW5kX3JlcGxhY2UodW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgY2hhciBjb25zdCopjQlyc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6cmVzaXplKHVuc2lnbmVkIGxvbmcsIGNoYXIpjglyc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6YXBwZW5kKHVuc2lnbmVkIGxvbmcsIGNoYXIpjwl0c3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6X19lcmFzZV90b19lbmQodW5zaWduZWQgbG9uZymQCboBc3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6X19ncm93X2J5KHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcpkQk/c3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+Ojphc3NpZ24oY2hhciosIHVuc2lnbmVkIGxvbmcsIGNoYXIpkgl5c3RkOjpfXzI6OmJhc2ljX3N0cmluZzxjaGFyLCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8Y2hhcj4sIHN0ZDo6X18yOjphbGxvY2F0b3I8Y2hhcj4gPjo6YXBwZW5kKGNoYXIgY29uc3QqLCB1bnNpZ25lZCBsb25nKZMJZnN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46OnB1c2hfYmFjayhjaGFyKZQJcnN0ZDo6X18yOjpiYXNpY19zdHJpbmc8Y2hhciwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPGNoYXI+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPGNoYXI+ID46Ol9faW5pdCh1bnNpZ25lZCBsb25nLCBjaGFyKZUJhQFzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+OjpfX2luaXQod2NoYXJfdCBjb25zdCosIHVuc2lnbmVkIGxvbmcplgmFAXN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID46OmFzc2lnbih3Y2hhcl90IGNvbnN0KiwgdW5zaWduZWQgbG9uZymXCd8Bc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6X19ncm93X2J5X2FuZF9yZXBsYWNlKHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIHVuc2lnbmVkIGxvbmcsIHdjaGFyX3QgY29uc3QqKZgJwwFzdGQ6Ol9fMjo6YmFzaWNfc3RyaW5nPHdjaGFyX3QsIHN0ZDo6X18yOjpjaGFyX3RyYWl0czx3Y2hhcl90Piwgc3RkOjpfXzI6OmFsbG9jYXRvcjx3Y2hhcl90PiA+OjpfX2dyb3dfYnkodW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZywgdW5zaWduZWQgbG9uZymZCYUBc3RkOjpfXzI6OmJhc2ljX3N0cmluZzx3Y2hhcl90LCBzdGQ6Ol9fMjo6Y2hhcl90cmFpdHM8d2NoYXJfdD4sIHN0ZDo6X18yOjphbGxvY2F0b3I8d2NoYXJfdD4gPjo6YXBwZW5kKHdjaGFyX3QgY29uc3QqLCB1bnNpZ25lZCBsb25nKZoJcnN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID46OnB1c2hfYmFjayh3Y2hhcl90KZsJfnN0ZDo6X18yOjpiYXNpY19zdHJpbmc8d2NoYXJfdCwgc3RkOjpfXzI6OmNoYXJfdHJhaXRzPHdjaGFyX3Q+LCBzdGQ6Ol9fMjo6YWxsb2NhdG9yPHdjaGFyX3Q+ID46Ol9faW5pdCh1bnNpZ25lZCBsb25nLCB3Y2hhcl90KZwJQnN0ZDo6X18yOjpfX3ZlY3Rvcl9iYXNlX2NvbW1vbjx0cnVlPjo6X190aHJvd19sZW5ndGhfZXJyb3IoKSBjb25zdJ0JDWFib3J0X21lc3NhZ2WeCRJfX2N4YV9wdXJlX3ZpcnR1YWyfCRxzdGQ6OmV4Y2VwdGlvbjo6d2hhdCgpIGNvbnN0oAkgc3RkOjpsb2dpY19lcnJvcjo6fmxvZ2ljX2Vycm9yKCmhCTNzdGQ6Ol9fMjo6X19saWJjcHBfcmVmc3RyaW5nOjp+X19saWJjcHBfcmVmc3RyaW5nKCmiCSJzdGQ6OmxvZ2ljX2Vycm9yOjp+bG9naWNfZXJyb3IoKS4xowkic3RkOjpsZW5ndGhfZXJyb3I6On5sZW5ndGhfZXJyb3IoKaQJG3N0ZDo6YmFkX2Nhc3Q6OndoYXQoKSBjb25zdKUJYV9fY3h4YWJpdjE6Ol9fZnVuZGFtZW50YWxfdHlwZV9pbmZvOjpjYW5fY2F0Y2goX19jeHhhYml2MTo6X19zaGltX3R5cGVfaW5mbyBjb25zdCosIHZvaWQqJikgY29uc3SmCTxpc19lcXVhbChzdGQ6OnR5cGVfaW5mbyBjb25zdCosIHN0ZDo6dHlwZV9pbmZvIGNvbnN0KiwgYm9vbCmnCVtfX2N4eGFiaXYxOjpfX2NsYXNzX3R5cGVfaW5mbzo6Y2FuX2NhdGNoKF9fY3h4YWJpdjE6Ol9fc2hpbV90eXBlX2luZm8gY29uc3QqLCB2b2lkKiYpIGNvbnN0qAkOX19keW5hbWljX2Nhc3SpCWtfX2N4eGFiaXYxOjpfX2NsYXNzX3R5cGVfaW5mbzo6cHJvY2Vzc19mb3VuZF9iYXNlX2NsYXNzKF9fY3h4YWJpdjE6Ol9fZHluYW1pY19jYXN0X2luZm8qLCB2b2lkKiwgaW50KSBjb25zdKoJbl9fY3h4YWJpdjE6Ol9fY2xhc3NfdHlwZV9pbmZvOjpoYXNfdW5hbWJpZ3VvdXNfcHVibGljX2Jhc2UoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQqLCBpbnQpIGNvbnN0qwlxX19jeHhhYml2MTo6X19zaV9jbGFzc190eXBlX2luZm86Omhhc191bmFtYmlndW91c19wdWJsaWNfYmFzZShfX2N4eGFiaXYxOjpfX2R5bmFtaWNfY2FzdF9pbmZvKiwgdm9pZCosIGludCkgY29uc3SsCXNfX2N4eGFiaXYxOjpfX2Jhc2VfY2xhc3NfdHlwZV9pbmZvOjpoYXNfdW5hbWJpZ3VvdXNfcHVibGljX2Jhc2UoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQqLCBpbnQpIGNvbnN0rQlyX19jeHhhYml2MTo6X192bWlfY2xhc3NfdHlwZV9pbmZvOjpoYXNfdW5hbWJpZ3VvdXNfcHVibGljX2Jhc2UoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQqLCBpbnQpIGNvbnN0rglbX19jeHhhYml2MTo6X19wYmFzZV90eXBlX2luZm86OmNhbl9jYXRjaChfX2N4eGFiaXYxOjpfX3NoaW1fdHlwZV9pbmZvIGNvbnN0Kiwgdm9pZComKSBjb25zdK8JXV9fY3h4YWJpdjE6Ol9fcG9pbnRlcl90eXBlX2luZm86OmNhbl9jYXRjaChfX2N4eGFiaXYxOjpfX3NoaW1fdHlwZV9pbmZvIGNvbnN0Kiwgdm9pZComKSBjb25zdLAJXF9fY3h4YWJpdjE6Ol9fcG9pbnRlcl90eXBlX2luZm86OmNhbl9jYXRjaF9uZXN0ZWQoX19jeHhhYml2MTo6X19zaGltX3R5cGVfaW5mbyBjb25zdCopIGNvbnN0sQlmX19jeHhhYml2MTo6X19wb2ludGVyX3RvX21lbWJlcl90eXBlX2luZm86OmNhbl9jYXRjaF9uZXN0ZWQoX19jeHhhYml2MTo6X19zaGltX3R5cGVfaW5mbyBjb25zdCopIGNvbnN0sgmDAV9fY3h4YWJpdjE6Ol9fY2xhc3NfdHlwZV9pbmZvOjpwcm9jZXNzX3N0YXRpY190eXBlX2Fib3ZlX2RzdChfX2N4eGFiaXYxOjpfX2R5bmFtaWNfY2FzdF9pbmZvKiwgdm9pZCBjb25zdCosIHZvaWQgY29uc3QqLCBpbnQpIGNvbnN0swlzX19jeHhhYml2MTo6X192bWlfY2xhc3NfdHlwZV9pbmZvOjpzZWFyY2hfYmVsb3dfZHN0KF9fY3h4YWJpdjE6Ol9fZHluYW1pY19jYXN0X2luZm8qLCB2b2lkIGNvbnN0KiwgaW50LCBib29sKSBjb25zdLQJgQFfX2N4eGFiaXYxOjpfX2Jhc2VfY2xhc3NfdHlwZV9pbmZvOjpzZWFyY2hfYWJvdmVfZHN0KF9fY3h4YWJpdjE6Ol9fZHluYW1pY19jYXN0X2luZm8qLCB2b2lkIGNvbnN0Kiwgdm9pZCBjb25zdCosIGludCwgYm9vbCkgY29uc3S1CXRfX2N4eGFiaXYxOjpfX2Jhc2VfY2xhc3NfdHlwZV9pbmZvOjpzZWFyY2hfYmVsb3dfZHN0KF9fY3h4YWJpdjE6Ol9fZHluYW1pY19jYXN0X2luZm8qLCB2b2lkIGNvbnN0KiwgaW50LCBib29sKSBjb25zdLYJcl9fY3h4YWJpdjE6Ol9fc2lfY2xhc3NfdHlwZV9pbmZvOjpzZWFyY2hfYmVsb3dfZHN0KF9fY3h4YWJpdjE6Ol9fZHluYW1pY19jYXN0X2luZm8qLCB2b2lkIGNvbnN0KiwgaW50LCBib29sKSBjb25zdLcJb19fY3h4YWJpdjE6Ol9fY2xhc3NfdHlwZV9pbmZvOjpzZWFyY2hfYmVsb3dfZHN0KF9fY3h4YWJpdjE6Ol9fZHluYW1pY19jYXN0X2luZm8qLCB2b2lkIGNvbnN0KiwgaW50LCBib29sKSBjb25zdLgJgAFfX2N4eGFiaXYxOjpfX3ZtaV9jbGFzc190eXBlX2luZm86OnNlYXJjaF9hYm92ZV9kc3QoX19jeHhhYml2MTo6X19keW5hbWljX2Nhc3RfaW5mbyosIHZvaWQgY29uc3QqLCB2b2lkIGNvbnN0KiwgaW50LCBib29sKSBjb25zdLkJf19fY3h4YWJpdjE6Ol9fc2lfY2xhc3NfdHlwZV9pbmZvOjpzZWFyY2hfYWJvdmVfZHN0KF9fY3h4YWJpdjE6Ol9fZHluYW1pY19jYXN0X2luZm8qLCB2b2lkIGNvbnN0Kiwgdm9pZCBjb25zdCosIGludCwgYm9vbCkgY29uc3S6CXxfX2N4eGFiaXYxOjpfX2NsYXNzX3R5cGVfaW5mbzo6c2VhcmNoX2Fib3ZlX2RzdChfX2N4eGFiaXYxOjpfX2R5bmFtaWNfY2FzdF9pbmZvKiwgdm9pZCBjb25zdCosIHZvaWQgY29uc3QqLCBpbnQsIGJvb2wpIGNvbnN0uwkIX19zdHJkdXC8CQ1fX2dldFR5cGVOYW1lvQkqX19lbWJpbmRfcmVnaXN0ZXJfbmF0aXZlX2FuZF9idWlsdGluX3R5cGVzvgk/dm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX2ludGVnZXI8Y2hhcj4oY2hhciBjb25zdCopvwlGdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX2ludGVnZXI8c2lnbmVkIGNoYXI+KGNoYXIgY29uc3QqKcAJSHZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9pbnRlZ2VyPHVuc2lnbmVkIGNoYXI+KGNoYXIgY29uc3QqKcEJQHZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9pbnRlZ2VyPHNob3J0PihjaGFyIGNvbnN0KinCCUl2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfaW50ZWdlcjx1bnNpZ25lZCBzaG9ydD4oY2hhciBjb25zdCopwwk+dm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX2ludGVnZXI8aW50PihjaGFyIGNvbnN0KinECUd2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfaW50ZWdlcjx1bnNpZ25lZCBpbnQ+KGNoYXIgY29uc3QqKcUJP3ZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9pbnRlZ2VyPGxvbmc+KGNoYXIgY29uc3QqKcYJSHZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9pbnRlZ2VyPHVuc2lnbmVkIGxvbmc+KGNoYXIgY29uc3QqKccJPnZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9mbG9hdDxmbG9hdD4oY2hhciBjb25zdCopyAk/dm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX2Zsb2F0PGRvdWJsZT4oY2hhciBjb25zdCopyQlDdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX21lbW9yeV92aWV3PGNoYXI+KGNoYXIgY29uc3QqKcoJSnZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9tZW1vcnlfdmlldzxzaWduZWQgY2hhcj4oY2hhciBjb25zdCopywlMdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX21lbW9yeV92aWV3PHVuc2lnbmVkIGNoYXI+KGNoYXIgY29uc3QqKcwJRHZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9tZW1vcnlfdmlldzxzaG9ydD4oY2hhciBjb25zdCopzQlNdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX21lbW9yeV92aWV3PHVuc2lnbmVkIHNob3J0PihjaGFyIGNvbnN0KinOCUJ2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfbWVtb3J5X3ZpZXc8aW50PihjaGFyIGNvbnN0KinPCUt2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfbWVtb3J5X3ZpZXc8dW5zaWduZWQgaW50PihjaGFyIGNvbnN0KinQCUN2b2lkIChhbm9ueW1vdXMgbmFtZXNwYWNlKTo6cmVnaXN0ZXJfbWVtb3J5X3ZpZXc8bG9uZz4oY2hhciBjb25zdCop0QlMdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX21lbW9yeV92aWV3PHVuc2lnbmVkIGxvbmc+KGNoYXIgY29uc3QqKdIJRHZvaWQgKGFub255bW91cyBuYW1lc3BhY2UpOjpyZWdpc3Rlcl9tZW1vcnlfdmlldzxmbG9hdD4oY2hhciBjb25zdCop0wlFdm9pZCAoYW5vbnltb3VzIG5hbWVzcGFjZSk6OnJlZ2lzdGVyX21lbW9yeV92aWV3PGRvdWJsZT4oY2hhciBjb25zdCop1AluRW1zY3JpcHRlbkJpbmRpbmdJbml0aWFsaXplcl9uYXRpdmVfYW5kX2J1aWx0aW5fdHlwZXM6OkVtc2NyaXB0ZW5CaW5kaW5nSW5pdGlhbGl6ZXJfbmF0aXZlX2FuZF9idWlsdGluX3R5cGVzKCnVCQhkbG1hbGxvY9YJBmRsZnJlZdcJCWRscmVhbGxvY9gJEXRyeV9yZWFsbG9jX2NodW5r2QkNZGlzcG9zZV9jaHVua9oJBHNicmvbCQRmbW9k3AkFZm1vZGzdCQVsb2cxMN4JBmxvZzEwZt8JBnNjYWxibuAJDV9fZnBjbGFzc2lmeWzhCQZtZW1jcHniCQZtZW1zZXTjCQdtZW1tb3Zl5AkIc2V0VGhyZXflCQlzdGFja1NhdmXmCQpzdGFja0FsbG9j5wkMc3RhY2tSZXN0b3Jl6AkQX19ncm93V2FzbU1lbW9yeekJC2R5bkNhbGxfdmlp6gkNZHluQ2FsbF92aWlpaesJC2R5bkNhbGxfZGlk7AkMZHluQ2FsbF9kaWlk7QkNZHluQ2FsbF9kaWRkZO4JDmR5bkNhbGxfZGlpZGRk7wkMZHluQ2FsbF9kaWRk8AkNZHluQ2FsbF9kaWlkZPEJC2R5bkNhbGxfZGlp8gkLZHluQ2FsbF92aWTzCQxkeW5DYWxsX3ZpaWT0CQxkeW5DYWxsX2RpaWn1CQ1keW5DYWxsX2RpaWlp9gkNZHluQ2FsbF92aWlpZPcJDWR5bkNhbGxfZGlkaWT4CQ5keW5DYWxsX2RpaWRpZPkJDmR5bkNhbGxfZGlkaWRp+gkPZHluQ2FsbF9kaWlkaWRp+wkNZHluQ2FsbF92aWRpZPwJDmR5bkNhbGxfdmlpZGlk/QkOZHluQ2FsbF92aWRpZGT+CQ9keW5DYWxsX3ZpaWRpZGT/CQ9keW5DYWxsX3ZpZGlkZGSAChBkeW5DYWxsX3ZpaWRpZGRkgQoOZHluQ2FsbF92aWRkZGmCCg9keW5DYWxsX3ZpaWRkZGmDCg1keW5DYWxsX2lpaWlkhAoMZHluQ2FsbF92aWRkhQoNZHluQ2FsbF92aWlkZIYKDWR5bkNhbGxfaWlpaWmHCg5keW5DYWxsX3ZpZmZpaYgKD2R5bkNhbGxfdmlpZmZpaYkKD2R5bkNhbGxfZGlkZGRkZIoKD2R5bkNhbGxfZGlkZGlkZIsKEGR5bkNhbGxfZGlpZGRpZGSMChBkeW5DYWxsX2RpaWRkZGRkjQoPZHluQ2FsbF9kaWRkZGlpjgoQZHluQ2FsbF9kaWlkZGRpaY8KEWR5bkNhbGxfZGlkZGRkZGlpkAoSZHluQ2FsbF9kaWlkZGRkZGlpkQoMZHluQ2FsbF9kaWRpkgoNZHluQ2FsbF9kaWlkaZMKD2R5bkNhbGxfZGlkaWRkZJQKEGR5bkNhbGxfZGlpZGlkZGSVCg1keW5DYWxsX2RpZGRplgoOZHluQ2FsbF9kaWlkZGmXCgxkeW5DYWxsX3ZpZGmYCg1keW5DYWxsX3ZpaWRpmQoOZHluQ2FsbF92aWlpaWmaCgxkeW5DYWxsX2lpZmmbCg1keW5DYWxsX2lpaWZpnAoKZHluQ2FsbF9maZ0KC2R5bkNhbGxfZmlpngoNZHluQ2FsbF9maWlpaZ8KDmR5bkNhbGxfZmlpaWlpoAoPZHluQ2FsbF92aWlpaWRkoQoQZHluQ2FsbF92aWlpaWlkZKIKDGR5bkNhbGxfdmlpZqMKDWR5bkNhbGxfdmlpaWakCg1keW5DYWxsX2lpaWlmpQoOZHluQ2FsbF9kaWRkaWSmCg9keW5DYWxsX2RpaWRkaWSnCg9keW5DYWxsX2RpZGRkaWSoChBkeW5DYWxsX2RpaWRkZGlkqQoOZHluQ2FsbF9kaWRkZGmqCg9keW5DYWxsX2RpaWRkZGmrCgtkeW5DYWxsX2lpZKwKDWR5bkNhbGxfZGlkaWmtCg5keW5DYWxsX2RpaWRpaa4KD2R5bkNhbGxfaWlkaWlpaa8KDmR5bkNhbGxfaWlpaWlpsAoRZHluQ2FsbF9paWlpaWlpaWmxCg9keW5DYWxsX2lpaWlpaWmyCg5keW5DYWxsX2lpaWlpZLMKEGR5bkNhbGxfaWlpaWlpaWm0Cg9keW5DYWxsX3ZpaWlpaWm1CglkeW5DYWxsX3a2ChhsZWdhbHN0dWIkZHluQ2FsbF92aWlqaWm3ChZsZWdhbHN0dWIkZHluQ2FsbF9qaWppuAoYbGVnYWxzdHViJGR5bkNhbGxfaWlpaWlquQoZbGVnYWxzdHViJGR5bkNhbGxfaWlpaWlqaroKGmxlZ2Fsc3R1YiRkeW5DYWxsX2lpaWlpaWpqAHUQc291cmNlTWFwcGluZ1VSTGNodHRwOi8vbG9jYWxob3N0OjkwMDAvYXVkaW8td29ya2xldC9idWlsZC97e3sgRklMRU5BTUVfUkVQTEFDRU1FTlRfU1RSSU5HU19XQVNNX0JJTkFSWV9GSUxFIH19fS5tYXA=';
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




// STATICTOP = STATIC_BASE + 53488;
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
      return 54352;
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


