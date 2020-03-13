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
var Module = typeof Module !== 'undefined' ? Module : {};

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
var ENVIRONMENT_HAS_NODE = false;
var ENVIRONMENT_IS_SHELL = false;
ENVIRONMENT_IS_WEB = typeof window === 'object';
ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';
// A web environment like Electron.js can have Node enabled, so we must
// distinguish between Node-enabled environments and Node environments per se.
// This will allow the former to do things like mount NODEFS.
// Extended check using process.versions fixes issue #8816.
// (Also makes redundant the original check that 'require' is a function.)
ENVIRONMENT_HAS_NODE = typeof process === 'object' && typeof process.versions === 'object' && typeof process.versions.node === 'string';
ENVIRONMENT_IS_NODE = ENVIRONMENT_HAS_NODE && !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_WORKER;
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
  scriptDirectory = __dirname + '/';


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
// ENVIRONMENT_HAS_NODE.
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
  'initial': 964,
  'maximum': 964 + 0,
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
    STACK_BASE = 5296784,
    STACKTOP = STACK_BASE,
    STACK_MAX = 53904,
    DYNAMIC_BASE = 5296784,
    DYNAMICTOP_PTR = 53744;




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




var wasmBinaryFile = 'data:application/octet-stream;base64,AGFzbQEAAAABuwutAWABfwF/YAABf2ACf38AYAJ/fwF/YAF/AGADf39/AX9gA39/fwBgBn9/f39/fwF/YAR/f39/AX9gAABgBn9/f39/fwBgBX9/f39/AX9gBH9/f38AYAJ/fABgCH9/f39/f39/AX9gBX9/f39/AGABfwF8YAJ/fAF8YAF8AXxgAX0BfWADf3x8AXxgAnx8AXxgB39/f39/f38Bf2AHf39/f39/fwBgAn9/AXxgBH98fHwBfGADf39/AXxgA39/fABgBX9+fn5+AGABfwF9YAZ/fHx8fHwBfGAEf39/fABgAAF+YAN/fn8BfmAEf3x8fwF8YAV8fHx8fAF8YAp/f39/f39/f39/AGAFf39+f38AYAN/fH8AYAV/f39/fgF/YAJ/fwF9YAN8fHwBfGADf3x8AGAHf39/f39+fgF/YAV/f39/fAF/YAR/f39/AX5gBX9/fHx/AXxgBn98f3x8fAF8YAV/fHx/fAF8YAV/fHx8fwF8YAh/f39/f39/fwBgB39/f39/fHwAYAZ/f39/fHwAYAR/f399AGAGf399fX9/AGAEf398fwBgBX9/fH98AGAGf398f3x8AGAHf398f3x8fABgBH9/fHwAYAV/f3x8fABgBH9+fn8AYAJ/fQBgBX99fX9/AGAEf3x/fABgBX98f3x8AGAGf3x/fHx8AGAEf3x8fABgCn9/f39/f39/f38Bf2AGf39/f35+AX9gBH9/f3wBf2AEf399fwF/YAN/fn8Bf2ADf31/AX9gAn98AX9gBn98f39/fwF/YAF8AX9gAX8BfmADf39/AX1gBH9/f38BfWAFf39/f38BfWACfX8BfWAEf39/fwF8YAN/f3wBfGAEf398fwF8YAV/f3x/fAF8YAZ/f3x/fH8BfGAHf398f3x8fAF8YAR/f3x8AXxgBn9/fHx/fAF8YAd/f3x8f3x8AXxgBX9/fHx8AXxgBn9/fHx8fwF8YAd/f3x8fH9/AXxgB39/fHx8f3wBfGAHf398fHx8fAF8YAl/f3x8fHx8f38BfGADf3x/AXxgBH98f3wBfGAFf3x/fH8BfGAGf3x8f3x8AXxgBn98fHx/fwF8YAZ/fHx8f3wBfGAIf3x8fHx8f38BfGACfH8BfGAPf39/f39/f39/f39/f39/AGADf399AGAJf39/f39/f39/AX9gC39/f39/f39/f39/AX9gDH9/f39/f39/f39/fwF/YAR/f399AX9gAn5/AX9gBH5+fn4Bf2ADf39/AX5gBH9/f34BfmACfX0BfWABfAF9YAN8fH8BfGAMf39/f39/f39/f39/AGANf39/f39/f39/f39/fwBgCH9/f39/f3x8AGAFf39/f30AYAV/f39/fABgBn9/f35/fwBgB39/f319f38AYAV/f398fwBgBn9/f3x/fABgB39/f3x/fHwAYAh/f398f3x8fABgBX9/f3x8AGAGf39/fHx8AGADf39+AGACf34AYAN/fX0AYAh/f39/f39+fgF/YAZ/f39/f34Bf2AGf39/f398AX9gBX9/f399AX9gBX9/f31/AX9gA39/fAF/YAd/f3x/f39/AX9gBn9/fHx8fwF/YAJ/fgF/YAR/fn9/AX9gA399fQF/YAN/fHwBf2ADfn9/AX9gAn5+AX9gAn1/AX9gAnx/AX9gAn9/AX5gBH9/fn8BfmABfAF+YAZ/f39/f38BfWACfn4BfWAFf39/f38BfGAEf39/fAF8YAV/f398fwF8YAZ/f398f3wBfGAHf39/fH98fwF8YAh/f398f3x8fAF8YAV/f398fAF8YAZ/f398fH8BfGAHf39/fHx/fAF8YAh/f398fH98fAF8YAZ/f398fHwBfGAHf39/fHx8fwF8YAh/f398fHx/fwF8YAh/f398fHx/fAF8YAh/f398fHx8fAF8YAp/f398fHx8fH9/AXxgAn5+AXxgAn1/AXwClgktA2VudhZfZW1iaW5kX3JlZ2lzdGVyX2NsYXNzAHcDZW52JV9lbWJpbmRfcmVnaXN0ZXJfY2xhc3NfY2xhc3NfZnVuY3Rpb24AFwNlbnYfX2VtYmluZF9yZWdpc3Rlcl9jbGFzc19wcm9wZXJ0eQAkA2VudhVfZW1iaW5kX3JlZ2lzdGVyX2VudW0ADANlbnYbX2VtYmluZF9yZWdpc3Rlcl9lbnVtX3ZhbHVlAAYDZW52Gl9lbWJpbmRfcmVnaXN0ZXJfc21hcnRfcHRyAHYDZW52Il9lbWJpbmRfcmVnaXN0ZXJfY2xhc3NfY29uc3RydWN0b3IACgNlbnYYX19jeGFfYWxsb2NhdGVfZXhjZXB0aW9uAAADZW52C19fY3hhX3Rocm93AAYDZW52H19lbWJpbmRfcmVnaXN0ZXJfY2xhc3NfZnVuY3Rpb24AMgNlbnYNX2VtdmFsX2luY3JlZgAEA2Vudg1fZW12YWxfZGVjcmVmAAQDZW52EV9lbXZhbF90YWtlX3ZhbHVlAAMDZW52C19lbXZhbF9jYWxsAAgDZW52BXJvdW5kABIDZW52BGV4aXQABANlbnYNX19hc3NlcnRfZmFpbAAMA2VudgpfX3N5c2NhbGw1AAMWd2FzaV9zbmFwc2hvdF9wcmV2aWV3MQhmZF9jbG9zZQAAA2VudgxfX3N5c2NhbGwyMjEAAwNlbnYLX19zeXNjYWxsNTQAAxZ3YXNpX3NuYXBzaG90X3ByZXZpZXcxCGZkX3dyaXRlAAgDZW52Bl9fbG9jawAEA2VudghfX3VubG9jawAEFndhc2lfc25hcHNob3RfcHJldmlldzEHZmRfcmVhZAAIFndhc2lfc25hcHNob3RfcHJldmlldzERZW52aXJvbl9zaXplc19nZXQAAxZ3YXNpX3NuYXBzaG90X3ByZXZpZXcxC2Vudmlyb25fZ2V0AAMDZW52Cl9fbWFwX2ZpbGUAAwNlbnYLX19zeXNjYWxsOTEAAwNlbnYKc3RyZnRpbWVfbAALA2VudgVhYm9ydAAJA2VudhVfZW1iaW5kX3JlZ2lzdGVyX3ZvaWQAAgNlbnYVX2VtYmluZF9yZWdpc3Rlcl9ib29sAA8DZW52G19lbWJpbmRfcmVnaXN0ZXJfc3RkX3N0cmluZwACA2VudhxfZW1iaW5kX3JlZ2lzdGVyX3N0ZF93c3RyaW5nAAYDZW52Fl9lbWJpbmRfcmVnaXN0ZXJfZW12YWwAAgNlbnYYX2VtYmluZF9yZWdpc3Rlcl9pbnRlZ2VyAA8DZW52Fl9lbWJpbmRfcmVnaXN0ZXJfZmxvYXQABgNlbnYcX2VtYmluZF9yZWdpc3Rlcl9tZW1vcnlfdmlldwAGA2VudhZlbXNjcmlwdGVuX3Jlc2l6ZV9oZWFwAAADZW52FWVtc2NyaXB0ZW5fbWVtY3B5X2JpZwAFA2VudgtzZXRUZW1wUmV0MAAEFndhc2lfc25hcHNob3RfcHJldmlldzEHZmRfc2VlawALA2VudgZtZW1vcnkCAIAQA2VudgV0YWJsZQFwAMQHA5gb6RoBCQkABAQEBAQJAQEBAQEAAQEEAQQAAAECBAAEAQEBAAQAAAEMBgEBAAABAgMGAAIAAgEBAQABBAICAgICAgEBAQABBAICAQEQAQ0YGwACAQEBAAEEAgIBAQEAAQQCAhANEA0BAQEAAQQCAgIBAQEAAQQRAkMCDQIAAgEBAQAfAAABRikAARkBAQEAAQQqAg0CEAIQDRANDQEBAQAEAQQAAgICAgICAgICBAICAgIBAQEABCMCIyMpAgAAAR4BAQEAAQQCAgICAQEBAAEEAgICAgACAQEBAAQCABgSAgABEQEBAQABBBQCAQEBAAQRAhQCFAEBAQABBC8CAQEBAAEELwIBAQEAAQQUAgEBAQABBA0CDR4CAQEBAAQAAAEUFRUVFRUVFRUVEhUBAQEAAQQCAgIAAgACAAIQAhACAQIDAAIBAQEAAQQiAgICAQEBAAQABBQCJgICAhgCAAIBAQEBAQEABAAEFAImAgICGAIAAgEBAQAEAQQCAgICAAAAAgAAAAMFAQEBAAQBBAICAwUBAQEABAEENAIDAgEBAQAEAQQCAgYCAAIGAgUCAQEBAAQBBAICBgIAAgYCBQIBAQEABAEEAgIGAgACBgIFAgEBAQAEAQQCAgYCAgYCAgEBAQAEAQQCAgYCAgYCAgQEBQMDAAMDKgAAAwAAAwAAAwMAAAADAAEBJgQAAgkAAQEBAAQBAQABAQMEAAAABAICEAINAjACIgIBAQEABAEDAAAEAgIwAgEBAQABBAICAgINDQACZgIxAgADjQECEBEJAAEBAQAAAwABBQMDAwABCAUDAwMAAAADAwMDAwMDAwMAAAEAEBAAAUpMAAEJAAEBAQABBBECFAIJAAEBAQABBBQCCQABAQEAAQQiAgQCBAIADwACAgACAAAEAgIAAAIAAAACBgQAAwADAAIFBgYDAAAAAQMFAwABBQAEAwMGBgYGBgIEAAAMDAMDBQMDAwQDBQMBAAAGAgYCAwMEBgMIAgAGAAADBQADAAQMAgIEAAYAAAADAAAAAwUAAgYAAgIGBgICAAABAQEABAAAAAEAAwAGAAEADAEAAwEABQAAAAEDAgEACAECBgIDAwgCAAUAAAQAAgACBgABAQEAAAEAGxIBAAEfAQABAAEDDQEARgEAAAYCBgIDAwYDCAIABgAABQADAAQCBAAGAAAAAAAABQIGAAICBgYCAgAAAQEBAAQAAAEAAwAGAQAMAQABAAEDAQABAAgBAAAGAgYCAwYDCAIAAAAFAAMABAIEAAAAAAACAAICBgYCAgAAAQEBAAQAAAEAAwABAAEAAQABAwEAAQABAAYCBgIDBgMIAgAABQADAAQCBAAAAAIAAgYGAAABAQEAAAABAAMAAWoTAQABNQEAAQABAwEdPgEAAW4BAAEBAQABAQEAAQEBAAEBAAEBAQABAAFTAQAAAVsBAAFYAQAYAQAbAQABAQEAAQABUgEAHwEAAQEBAAEAAVUBAAFWAQABAQEAAAEAAQABAAEBAQABAAE4AQABOQEAAAE6AQABAQEAAAEAAQABPAEAAQADAQABAQEAAQMBAAEBAQAAAQABOwEAAQABAAABAQEAAAAAAAABAAAEAAABAAYBAAwBAAgBAAEAAQABAAEAAgEAAQABNgEACAIBBQAAAgAAAAICAgUCAAEAAQEBAAEeARkAAQEBAAEAAVoBAAFfAQABAAEAAQEBAAABAAFdAQAAAWABAAFUAQABAAEBAQABGAERAQABAQEAAAEAAQABAQEAAQABAAEAAQEBAAABAAFXAQABAQEAAAEAAQABAQEAAAEAAQABAQEAAAEAAQABAAEBAQABAQABAQEAAQABAAEAAQABAQABAQEAAAEAAS4BAAEAAQAAAQEBAAQAAAQAAAYAAgYCAwADAQACAgACAgIDAAIDCAICAAICAAUAAwACBAACAgAAAAAFAgACAgICAgIAAQABNwEAAQABGgEAAQABAQEDAAEAAQABAAEAAQABAAABAQEAAAEAAAEPAQABRwEAASgBAAMAAQMDAgwFAAEBAAABAQEAAAEAAQABUAEBAAABAQEAAAESEhARAAEzAQAFAAEAAAEBAQAABAAAAAIAAAYAAAYAAAEAAgMIAAEDAwUDAQEDAwUFAAICAwMDAwMAAAAEBAADAwQDBgMDAwMGAAAAAQQAAAMEBQUFAAAAAAAABQMCAwAAAAQEBAYAAAIGAAAAAwABAAEAAQADAgAAAwADAwMaEAQEBgAGBgAAAwUGAgUFAAIAAwAAAAFZAQAuAQAAAQEBAQgBBQUFAAMAAAQEAwQDBAUAAAAAAAUDAgAAAAQEBAACAAEAAQABAQEAAAEAAQABAAEAAQABXgEAAVwBAAEBAQEBAQEBAQABAQEAAAEAAQABAAEBAQAAAQABAAEBAQAAAQABCQAQERERERERFBEZERERGhsAYmMUFBkZGWhA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ZV9hbmRfYnVpbHRpbl90eXBlcwDHGQpfX2RhdGFfZW5kAwEJc3RhY2tTYXZlAK4aCnN0YWNrQWxsb2MArxoMc3RhY2tSZXN0b3JlALAaEF9fZ3Jvd1dhc21NZW1vcnkAsRoKZHluQ2FsbF9paQCyGgpkeW5DYWxsX3ZpALMaCWR5bkNhbGxfaQC0GgtkeW5DYWxsX3ZpaQC1Gg1keW5DYWxsX3ZpaWlpALYaDGR5bkNhbGxfdmlpaQC3GgtkeW5DYWxsX2lpaQC4GgtkeW5DYWxsX2RpZAC5Gg1keW5DYWxsX2RpZGRkALoaDGR5bkNhbGxfZGlkZAC7GgpkeW5DYWxsX2RpALwaC2R5bkNhbGxfdmlkAL0aDGR5bkNhbGxfZGlpaQC+GgxkeW5DYWxsX3ZpaWQAvxoLZHluQ2FsbF9kaWkAwBoNZHluQ2FsbF9kaWRpZADBGg5keW5DYWxsX2RpZGlkaQDCGg1keW5DYWxsX3ZpZGlkAMMaDmR5bkNhbGxfdmlkaWRkAMQaD2R5bkNhbGxfdmlkaWRkZADFGg1keW5DYWxsX3ZpZGRkAMYaDWR5bkNhbGxfdmlpaWQAxxoNZHluQ2FsbF9paWlpZADIGgxkeW5DYWxsX2RkZGQAyRoMZHluQ2FsbF92aWRkAMoaDGR5bkNhbGxfaWlpaQDLGg5keW5DYWxsX3ZpZmZpaQDMGg5keW5DYWxsX2RkZGRkZADNGg9keW5DYWxsX2RpZGRkZGQAzhoPZHluQ2FsbF9kaWRkaWRkAM8aD2R5bkNhbGxfZGlkZGRpaQDQGhFkeW5DYWxsX2RpZGRkZGRpaQDRGgxkeW5DYWxsX2RpZGkA0hoKZHluQ2FsbF9kZADTGg9keW5DYWxsX2RpZGlkZGQA1BoLZHluQ2FsbF9kZGQA1RoNZHluQ2FsbF9kaWRkaQDWGgxkeW5DYWxsX3ZpZGkA1xoMZHluQ2FsbF9paWZpANgaCmR5bkNhbGxfZmkA2RoNZHluQ2FsbF9maWlpaQDaGg9keW5DYWxsX3ZpaWlpZGQA2xoMZHluQ2FsbF9kaWlkANwaDmR5bkNhbGxfZGlpZGRkAN0aDWR5bkNhbGxfZGlpZGQA3hoNZHluQ2FsbF9kaWlpaQDfGg5keW5DYWxsX2RpaWRpZADgGg9keW5DYWxsX2RpaWRpZGkA4RoOZHluQ2FsbF92aWlkaWQA4hoPZHluQ2FsbF92aWlkaWRkAOMaEGR5bkNhbGxfdmlpZGlkZGQA5BoOZHluQ2FsbF92aWlkZGQA5RoNZHluQ2FsbF92aWlkZADmGg1keW5DYWxsX2lpaWlpAOcaD2R5bkNhbGxfdmlpZmZpaQDoGhBkeW5DYWxsX2RpaWRkaWRkAOkaEGR5bkNhbGxfZGlpZGRkZGQA6hoQZHluQ2FsbF9kaWlkZGRpaQDrGhJkeW5DYWxsX2RpaWRkZGRkaWkA7BoNZHluQ2FsbF9kaWlkaQDtGhBkeW5DYWxsX2RpaWRpZGRkAO4aDmR5bkNhbGxfZGlpZGRpAO8aDWR5bkNhbGxfdmlpZGkA8BoOZHluQ2FsbF92aWlpaWkA8RoNZHluQ2FsbF9paWlmaQDyGgtkeW5DYWxsX2ZpaQDzGg5keW5DYWxsX2ZpaWlpaQD0GhBkeW5DYWxsX3ZpaWlpaWRkAPUaDGR5bkNhbGxfdmlpZgD2Gg1keW5DYWxsX3ZpaWlmAPcaDWR5bkNhbGxfaWlpaWYA+BoOZHluQ2FsbF9kaWRkaWQA+RoPZHluQ2FsbF9kaWRkZGlkAPoaDmR5bkNhbGxfZGlkZGRpAPsaD2R5bkNhbGxfZGlpZGRpZAD8GhBkeW5DYWxsX2RpaWRkZGlkAP0aD2R5bkNhbGxfZGlpZGRkaQD+GgtkeW5DYWxsX2lpZAD/GgpkeW5DYWxsX2lkAIAbCWR5bkNhbGxfdgCBGw5keW5DYWxsX3ZpaWppaQCOGwxkeW5DYWxsX2ppamkAjxsPZHluQ2FsbF9paWRpaWlpAIQbDmR5bkNhbGxfaWlpaWlpAIUbEWR5bkNhbGxfaWlpaWlpaWlpAIYbD2R5bkNhbGxfaWlpaWlpaQCHGw5keW5DYWxsX2lpaWlpagCQGw5keW5DYWxsX2lpaWlpZACJGw9keW5DYWxsX2lpaWlpamoAkRsQZHluQ2FsbF9paWlpaWlpaQCLGxBkeW5DYWxsX2lpaWlpaWpqAJIbD2R5bkNhbGxfdmlpaWlpaQCNGwnADgEAQQELwwc6PT5DRENGSj0+T1BTVldYWVpbXGA9YcIOxQ7GDsoOyw7NDscOyA7JDsEOxA7DDswOwQFsPW3ODs8Oc3V2d3h5V1h9PX7RDtIOhQE9hgHVDtYO1w7TDtQOigGLAXZ3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QTkQAEE6EIcBIAFBADYCzAsgAUE7NgLICyABIAEpA8gLNwPoB0HKCiABQegHahCIASABQQA2AswLIAFBPDYCyAsgASABKQPICzcD4AdB0AogAUHgB2oQiAEgAUEANgLMCyABQT02AsgLIAEgASkDyAs3A9gHQdYKIAFB2AdqEIgBIAFBADYCzAsgAUE+NgLICyABIAEpA8gLNwPQB0HfCiABQdAHahCJASABQQA2AswLIAFBPzYCyAsgASABKQPICzcDyAdB5gogAUHIB2oQiQEQggEhAhBxIQMQciEEIAFBADYCzAsgAUHAADYCyAsgASABKQPICzcDwAcgAUHAB2oQVCEFEHEhBhB0IQcgAUEANgLECyABQcEANgLACyABIAEpA8ALNwO4ByACQe0KIAMgBEHCACAFIAYgB0HDACABQbgHahBUEAIQggEhAhBxIQMQciEEIAFBADYCzAsgAUHEADYCyAsgASABKQPICzcDsAcgAUGwB2oQVCEFEHEhBhB0IQcgAUEANgLECyABQcUANgLACyABIAEpA8ALNwOoByACQfQKIAMgBEHCACAFIAYgB0HDACABQagHahBUEAIQNBA1IQIQNSEDEI4BEI8BEJABEDUQOUHGABA7IAIQOyADQf4KEDxBxwAQAEHIABCTASABQQA2AswLIAFByQA2AsgLIAEgASkDyAs3A6AHQYYLIAFBoAdqEJQBIAFBADYCzAsgAUHKADYCyAsgASABKQPICzcDmAdBjQsgAUGYB2oQlQEgAUEANgLMCyABQcsANgLICyABIAEpA8gLNwOQB0GSCyABQZAHahCWARA0EDUhAhA1IQMQlwEQmAEQmQEQNRA5QcwAEDsgAhA7IANBnAsQPEHNABAAQc4AEJwBIAFBADYCzAsgAUHPADYCyAsgASABKQPICzcDiAdBpQsgAUGIB2oQngEgAUEANgLMCyABQdAANgLICyABIAEpA8gLNwOAB0GqCyABQYAHahCgASABQQA2AswLIAFB0QA2AsgLIAEgASkDyAs3A/gGQbILIAFB+AZqEKIBIAFBADYCzAsgAUHSADYCyAsgASABKQPICzcD8AZBwAsgAUHwBmoQpAEQNBA1IQIQNSEDEKUBEKYBEKcBEDUQOUHTABA7IAIQOyADQc8LEDxB1AAQAEHVABCqASECEKUBQdkLIAFByAtqEEwgAUHIC2oQqwEQrAFB1gAgAhABQdcAEKoBIQIQpQFB2QsgAUHIC2oQTCABQcgLahCvARCwAUHYACACEAEQNBA1IQIQNSEDELIBELMBELQBEDUQOUHZABA7IAIQOyADQd8LEDxB2gAQAEHbABC3ASABQQA2AswLIAFB3AA2AsgLIAEgASkDyAs3A+gGQeoLIAFB6AZqELkBIAFBADYCzAsgAUHdADYCyAsgASABKQPICzcD4AZB7wsgAUHgBmoQuwEgAUEANgLMCyABQd4ANgLICyABIAEpA8gLNwPYBkH5CyABQdgGahC9ARCyASECEHEhAxByIQQgAUEANgLMCyABQd8ANgLICyABIAEpA8gLNwPQBiABQdAGahBUIQUQcSEGEHQhByABQQA2AsQLIAFB4AA2AsALIAEgASkDwAs3A8gGIAJB/wsgAyAEQeEAIAUgBiAHQeIAIAFByAZqEFQQAhCyASECEHEhAxByIQQgAUEANgLMCyABQeMANgLICyABIAEpA8gLNwPABiABQcAGahBUIQUQcSEGEHQhByABQQA2AsQLIAFB5AA2AsALIAEgASkDwAs3A7gGIAJBhQwgAyAEQeEAIAUgBiAHQeIAIAFBuAZqEFQQAhCyASECEHEhAxByIQQgAUEANgLMCyABQd4ANgLICyABIAEpA8gLNwOwBiABQbAGahBUIQUQcSEGEHQhByABQQA2AsQLIAFB5QA2AsALIAEgASkDwAs3A6gGIAJBlQwgAyAEQeEAIAUgBiAHQeIAIAFBqAZqEFQQAhA0EDUhAhA1IQMQwwEQxAEQxQEQNRA5QeYAEDsgAhA7IANBmQwQPEHnABAAQegAEMkBIAFBADYCzAsgAUHpADYCyAsgASABKQPICzcDoAZBpAwgAUGgBmoQywEgAUEANgL0CiABQeoANgLwCiABIAEpA/AKNwOYBiABQfgKaiABQZgGahBkIAEoAvgKIQIgASABKAL8CjYCzAsgASACNgLICyABIAEpA8gLNwOQBkGuDCABQZAGahDMASABQQA2AuQKIAFB6wA2AuAKIAEgASkD4Ao3A4gGIAFB6ApqIAFBiAZqEGQgASgC6AohAiABIAEoAuwKNgLMCyABIAI2AsgLIAEgASkDyAs3A4AGQa4MIAFBgAZqEM0BIAFBADYCzAsgAUHsADYCyAsgASABKQPICzcD+AVBuAwgAUH4BWoQzgEgAUEANgLMCyABQe0ANgLICyABIAEpA8gLNwPwBUHNDCABQfAFahDPASABQQA2AtQKIAFB7gA2AtAKIAEgASkD0Ao3A+gFIAFB2ApqIAFB6AVqEGQgASgC2AohAiABIAEoAtwKNgLMCyABIAI2AsgLIAEgASkDyAs3A+AFQdUMIAFB4AVqENABIAFBADYCxAogAUHvADYCwAogASABKQPACjcD2AUgAUHICmogAUHYBWoQZCABKALICiECIAEgASgCzAo2AswLIAEgAjYCyAsgASABKQPICzcD0AVB1QwgAUHQBWoQ0QEgAUEANgLMCyABQfAANgLICyABIAEpA8gLNwPIBUHeDCABQcgFahDRASABQQA2ArQKIAFB8QA2ArAKIAEgASkDsAo3A8AFIAFBuApqIAFBwAVqEGQgASgCuAohAiABIAEoArwKNgLMCyABIAI2AsgLIAEgASkDyAs3A7gFQaULIAFBuAVqENABIAFBADYCpAogAUHyADYCoAogASABKQOgCjcDsAUgAUGoCmogAUGwBWoQZCABKAKoCiECIAEgASgCrAo2AswLIAEgAjYCyAsgASABKQPICzcDqAVBpQsgAUGoBWoQ0QEgAUEANgKUCiABQfMANgKQCiABIAEpA5AKNwOgBSABQZgKaiABQaAFahBkIAEoApgKIQIgASABKAKcCjYCzAsgASACNgLICyABIAEpA8gLNwOYBUGlCyABQZgFahDSASABQQA2AswLIAFB9AA2AsgLIAEgASkDyAs3A5AFQecMIAFBkAVqENIBIAFBADYCzAsgAUH1ADYCyAsgASABKQPICzcDiAVBkwogAUGIBWoQ0wEgAUEANgLMCyABQfYANgLICyABIAEpA8gLNwOABUHtDCABQYAFahDTASABQQA2AswLIAFB9wA2AsgLIAEgASkDyAs3A/gEQfMMIAFB+ARqENUBIAFBADYCzAsgAUH4ADYCyAsgASABKQPICzcD8ARB/QwgAUHwBGoQ1gEgAUEANgLMCyABQfkANgLICyABIAEpA8gLNwPoBEGGDSABQegEahDXASABQQA2AswLIAFB+gA2AsgLIAEgASkDyAs3A+AEQYsNIAFB4ARqEM8BIAFBADYCzAsgAUH7ADYCyAsgASABKQPICzcD2ARBkA0gAUHYBGoQ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ABDOBRDkBQsgAAsVACAAIAEQqgEQ5QUaIAAQ5gUaIAALPQEBfyMAQRBrIgEkACABIAAQ5wUQ6AU2AgwgARDpBTYCCCABQQxqIAFBCGoQ6gUoAgAhACABQRBqJAAgAAsLACAAIAFBABDrBQsKACAAQQhqEMwFCzMAIAAgABCyBCAAELIEIAAQxwVBA3RqIAAQsgQgABDHBUEDdGogABCyBCABQQN0ahDIBQsEACAACw4AIAAgASACEKoBEPQFCwsAIAAgASACEPYFCxEAIAEQqgEaIABBADYCACAACwoAIAAQqgEaIAALCgAgAEEIahDMBQsHACAAEO0FCwUAEO4FCwkAIAAgARDsBQseACAAEPAFIAFJBEBByBYQ8QUACyABQQN0QQgQ8gULKQECfyMAQRBrIgIkACACQQhqIAEgABDvBSEDIAJBEGokACABIAAgAxsLBwAgABDwBQsIAEH/////BwsNACABKAIAIAIoAgBJCwgAQf////8BCxwBAX9BCBAHIgEgABDzBRogAUHQ7wFBrwQQCAALBwAgABD4GAsVACAAIAEQ/RgaIABBsO8BNgIAIAALDgAgACABIAIQqgEQ9QULDwAgASACEKoBKQMANwMACw4AIAEgAkEDdEEIEPcFCwsAIAAgASACEPgFCwkAIAAgARD5BQsHACAAEPoFCwcAIAAQ+hgLBwAgACgCBAsQACAAKAIAIAAoAgRBA3RqCzwBAn8jAEEQayIEJAAgABDJBSEFIARBCGogACADEOIFIQMgBSABIAIgAEEEahD+BSADEMUFIARBEGokAAspACACIAFrIgJBAU4EQCADKAIAIAEgAhCqGhogAyADKAIAIAJqNgIACwspAQJ/IwBBEGsiAiQAIAJBCGogACABEIEGIQMgAkEQaiQAIAEgACADGwspAQJ/IwBBEGsiAiQAIAJBCGogASAAEIEGIQMgAkEQaiQAIAEgACADGwsNACABKwMAIAIrAwBjCyMAIwBBEGsiACQAIABBCGogARCEBigCACEBIABBEGokACABCw0AIAAQogQgARCiBEYLCwAgACABNgIAIAALBwAgABDFBQs9AQF/IwBBEGsiAiQAIAAQqgEaIABCADcCACACQQA2AgwgAEEIaiACQQxqIAEQqgEQhwYaIAJBEGokACAACxoAIAAgARCqARDlBRogACACEKoB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ACAAEKoIGiAAQQxqEKoIGiAAQRhqEKoIGiAAQSRqEKoIGiAAQTBqEKoIGiAAQcgAahCMDBogAAsFABCLDAsGAEGcxgALKAAgAEEIahCqCBogAEEUahCqCBogAEEgahCqCBogAEEsahCqCBogAAsFABCQDAsGAEG0xgALSAEBfyABEKoBIAAoAgQiBUEBdWohASAAKAIAIQAgBUEBcQRAIAEoAgAgAGooAgAhAAsgASACEKoBIAMQqgEgBBCqASAAEQwACwYAQaDGAAsFABCUDAsGAEHsxgALRgEBfyABEKoBIAAoAgQiBEEBdWohASAAKAIAIQAgBEEBcQRAIAEoAgAgAGooAgAhAAsgASACELIIIAMQqgEgABFJABCqAQsGAEHAxgALBQAQmAwLBgBB/MYAC1sCAn8BfSMAQRBrIgIkACABEKoBIAAoAgQiA0EBdWohASAAKAIAIQAgAiABIANBAXEEfyABKAIAIABqKAIABSAACxEdADgCDCACQQxqEL4IIQQgAkEQaiQAIAQLBgBB9MYACwUAEJwMCzsBAX8gARCqASAAKAIEIgJBAXVqIQEgACgCACEAIAEgAkEBcQR/IAEoAgAgAGooAgAFIAALEQAAEJsMCwwAQQwQ+BggABCdDAsGAEGAxwALSwECfyMAQRBrIgIkACABEJ0IEIUGIAAgAkEIahCeDBogARDQAyIDBEAgACADEJ8MIAAgASgCACABKAIEIAMQoAwLIAJBEGokACAACz0BAX8jAEEQayICJAAgABCqARogAEIANwIAIAJBADYCDCAAQQhqIAJBDGogARCqARChDBogAkEQaiQAIAALRAEBfyAAEJQIIAFJBEAgABCcGQALIAAgABDUBSABEJcIIgI2AgAgACACNgIEIAAQiQggAiABQQJ0ajYCACAAQQAQmggLPAECfyMAQRBrIgQkACAAENQFIQUgBEEIaiAAIAMQ4gUhAyAFIAEgAiAAQQRqEP4FIAMQxQUgBEEQaiQACxoAIAAgARCqARDlBRogACACEKoBEIgGGiAACwUAEKMMCwYAQYjHAAsGAEHkxgALBgBBnMcACyUAIABBPGoQwBAaIABBGGoQpQgaIABBDGoQpQgaIAAQpQgaIAALBgBBnMcACwYAQbDHAAsGAEHMxwALJQAgABCqCBogAEEMahCqCBogAEEYahCqCBog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IAAQyw8gABDKD0YNABogACgCRCACIAAoAiAgACgCJCAAEMsPIAAQzA9rEM0PIQEgACgCJCABayAAKAIga6wgBnwhBkEBCyEBIAAoAkBCACAGfUEBEKcRDQIgAQRAIAAgAikDADcCSAsgACAAKAIgIgE2AiggACABNgIkIABBAEEAQQAQuw8gAEEANgJcC0EAIQMMAgsQwg8AC0F/IQMLIAJBEGokACADCwcAIAAoAhgLBwAgACgCFAsXACAAIAEgAiADIAQgACgCACgCFBELAAsHACAAKAIQCwcAIAAoAgwLBwAgACgCCAsXACAAIAEgAiADIAQgACgCACgCIBELAAuBBQEFfyMAQRBrIgIkAAJAAkAgACgCQEUEQBCJBiEEDAELIAAQzw8hBCAAEMsPRQRAIAAgAkEPaiACQRBqIgEgARC7DwtBACEBIARFBEAgABDKDyEEIAAQzA8hASACQQQ2AgQgAiAEIAFrQQJtNgIIIAJBCGogAkEEahDqBSgCACEBCxCJBiEEAkAgABDLDyAAEMoPRgRAIAAQzA8gABDKDyABayABEKwaGiAALQBiBEAgABDKDyEDIAAQzA8hBSAAEMwPIAFqQQEgAyABayAFayAAKAJAEMkRIgNFDQIgACAAEMwPIAAQzA8gAWogABDMDyABaiADahC7DyAAEMsPLAAAENAPIQQMAgsgACgCKCIFIAAoAiQiA0cEQCAAKAIgIAMgBSADaxCsGhoLIAAgACgCICIDIAAoAiggACgCJGtqNgIkIAAgAEEsaiADRgR/QQgFIAAoAjQLIANqNgIoIAIgACgCPCABazYCCCACIAAoAiggACgCJGs2AgQgAkEIaiACQQRqEOoFKAIAIQMgACAAKQJINwJQIAAoAiRBASADIAAoAkAQyREiA0UNASAAKAJEIgVFDQMgACAAKAIkIANqIgM2AigCQCAFIABByABqIAAoAiAgAyAAQSRqIAAQzA8gAWogABDMDyAAKAI8aiACQQhqENEPQQNGBEAgACAAKAIgIgQgBCAAKAIoELsPDAELIAIoAgggABDMDyABakYNAiAAIAAQzA8gABDMDyABaiACKAIIELsPCyAAEMsPLAAAENAPIQQMAQsgABDLDywAABDQDyEECyAAEMwPIAJBD2pHDQAgAEEAQQBBABC7DwsgAkEQaiQAIAQPCxDCDwAL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DzYCTAsgACwATAvEAQEEfyMAQRBrIggkAAJAIABFBEBBACEGDAELIAQQyw8hB0EAIQYgAiABayIJQQFOBEAgACABIAkQ9g8gCUcNAQsgByADIAFrIgZrQQAgByAGShsiAUEBTgRAIAAgCCABIAUQ9w8iBhD/DiABEPYPIQcgBhCEGRpBACEGIAEgB0cNASAAQQAgASAHRhshAAsgAyACayIBQQFOBEBBACEGIAAgAiABEPYPIAFHDQELIARBABD4DxogACEGCyAIQRBqJAAgBgsIACAAKAIARQsTACAAIAEgAiAAKAIAKAIwEQUACxMAIAAQ3AkaIAAgASACEJAZIAALFAEBfyAAKAIMIQIgACABNgIMIAILFgAgAQRAIAAgAhDQDyABEKsaGgsgAAsLACAAQbiRAxDjEwsRACAAIAEgACgCACgCHBEDAAsKACAAEMwFKAIECwoAIAAQzAUtAAsLFQAgACABEKoBEOUFGiAAEOYFGiAACwcAIAAQghALDAAgACAAKAIAEIUQCwoAIABBCGoQzAULEwAgABCEECgCACAAKAIAa0EBdQsLACAAIAEgAhCGEAsKACAAQQhqEMwFCzIBAX8gACgCBCECA0AgASACRkUEQCAAEIEQIAJBfmoiAhCqARCHEAwBCwsgACABNgIECw4AIAEgAkEBdEECEPcFCwkAIAAgARDLBQsKACAAQQhqEMwFC2IBAX8jAEEQayICJAAgAiABNgIMIAAQkBAhASACKAIMIAFNBEAgABD/DyIAIAFBAXZJBEAgAiAAQQF0NgIIIAJBCGogAkEMahCbBigCACEBCyACQRBqJAAgAQ8LIAAQnBkAC28BAn8jAEEQayIFJABBACEEIAVBADYCDCAAQQxqIAVBDGogAxCREBogAQRAIAAQkhAgARCTECEECyAAIAQ2AgAgACAEIAJBAXRqIgI2AgggACACNgIEIAAQlBAgBCABQQF0ajYCACAFQRBqJAAgAAsxAQF/IAAQkhAhAgNAIAIgACgCCBCqARCPECAAIAAoAghBAmo2AgggAUF/aiIBDQALC1wBAX8gABCLDyAAEIEQIAAoAgAgACgCBCABQQRqIgIQoQYgACACEKIGIABBBGogAUEIahCiBiAAEIgQIAEQlBAQogYgASABKAIENgIAIAAgABDqDhCVECAAEMUFCyMAIAAQlhAg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AUH/AXFGDQECQCACQQRPBEAgAUH/AXFBgYKECGwhBCACQXxqIgNBA3EhBSADQXxxIABqQQRqIQYDQCAAKAIAIARzIgNBf3MgA0H//ft3anFBgIGChHhxDQIgAEEEaiEAIAJBfGoiAkEDSw0ACyAFIQIgBiEACyACRQ0BCyABQf8BcSEDA0AgAC0AACADRg0CIABBAWohACACQX9qIgINAAsLQQAPCyAACxsAIABBgWBPBH8Q1BFBACAAazYCAEF/BSAACwsVACAARQRAQQAPCxDUESAANgIAQX8LYAEBfgJAAn4gA0HAAHEEQCACIANBQGqtiCEBQgAhAkIADAELIANFDQEgAkHAACADa62GIAEgA60iBIiEIQEgAiAEiCECQgALIQQgASAEhCEBCyAAIAE3AwAgACACNwMIC1ABAX4CQCADQcAAcQRAIAEgA0FAaq2GIQJCACEBDAELIANFDQAgAiADrSIEhiABQcAAIANrrYiEIQIgASAEhiEBCyAAIAE3AwAgACACNwMIC9kDAgJ/An4jAEEgayICJAACQCABQv///////////wCDIgRCgICAgICAwP9DfCAEQoCAgICAgMCAvH98VARAIAFCBIYgAEI8iIQhBCAAQv//////////D4MiAEKBgICAgICAgAhaBEAgBEKBgICAgICAgMAAfCEFDAILIARCgICAgICAgIBAfSEFIABCgICAgICAgIAIhUIAUg0BIAVCAYMgBXwhBQwBCyAAUCAEQoCAgICAgMD//wBUIARCgICAgICAwP//AFEbRQRAIAFCBIYgAEI8iIRC/////////wODQoCAgICAgID8/wCEIQUMAQtCgICAgICAgPj/ACEFIARC////////v//DAFYNAEIAIQUgBEIwiKciA0GR9wBJDQAgAiAAIAFC////////P4NCgICAgICAwACEIgRBgfgAIANrEO4RIAJBEGogACAEIANB/4h/ahDvESACKQMIQgSGIAIpAwAiBEI8iIQhBSACKQMQIAIpAxiEQgBSrSAEQv//////////D4OEIgRCgYCAgICAgIAIWgRAIAVCAXwhBQwBCyAEQoCAgICAgICACIVCAFINACAFQgGDIAV8IQULIAJBIGokACAFIAFCgICAgICAgICAf4OEvwuSAQEDfEQAAAAAAADwPyAAIACiIgJEAAAAAAAA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ACAGQn9XBEAgASAAmjkDACABIAQrAwiaOQMIQQAgAmshAgwBCyABIAA5AwAgASAEKQMINwMICyAEQTBqJAAgAguZAQEDfCAAIACiIgMgAyADoqIgA0R81c9aOtnlPaJE65wriublWr6goiADIANEff6xV+Mdxz6iRNVhwRmgASq/oKJEpvgQERERgT+goCEFIAMgAKIhBCACRQRAIAQgAyAFokRJVVVVVVXFv6CiIACgDwsgACADIAFEAAAAAAAA4D+iIAQgBaKhoiABoSAERElVVVVVVcU/oqChC9ABAQJ/IwBBEGsiASQAAnwgAL1CIIinQf////8HcSICQfvDpP8DTQRARAAAAAAAAPA/IAJBnsGa8gNJDQEaIABEAAAAAAAAAAAQ8REMAQsgACAAoSACQYCAwP8HTw0AGiAAIAEQ9BFBA3EiAkECTQRAAkACQAJAIAJBAWsOAgECAAsgASsDACABKwMIEPERDAMLIAErAwAgASsDCEEBEPURmgwCCyABKwMAIAErAwgQ8RGaDAELIAErAwAgASsDCEEBEPURCyEAIAFBEGokACAAC08BAXwgACAAoiIARIFeDP3//9+/okQAAAAAAADwP6AgACAAoiIBREI6BeFTVaU/oqAgACABoiAARGlQ7uBCk/k+okQnHg/oh8BWv6CioLYLSwECfCAAIACiIgEgAKIiAiABIAGioiABRKdGO4yHzcY+okR058ri+QAqv6CiIAIgAUSy+26JEBGBP6JEd6zLVFVVxb+goiAAoKC2C4YCAgN/AXwjAEEQayIDJAACQCAAvCIEQf////8HcSICQdqfpO4ETQRAIAEgALsiBSAFRIPIyW0wX+Q/okQAAAAAAAA4Q6BEAAAAAAAAOMOgIgVEAAAAUPsh+b+ioCAFRGNiGmG0EFG+oqA5AwAgBZlEAAAAAAAA4EFjBEAgBaohAgwCC0GAgICAeCECDAELIAJBgICA/AdPBEAgASAAIACTuzkDAEEAIQIMAQsgAyACIAJBF3ZB6n5qIgJBF3Rrvrs5AwggA0EIaiADIAJBAUEAEPMRIQIgAysDACEFIARBf0wEQCABIAWaOQMAQQAgAmshAgwBCyABIAU5AwALIANBEGokACACC/wCAgN/AXwjAEEQayICJAACfSAAvCIDQf////8HcSIBQdqfpPoDTQRAQwAAgD8gAUGAgIDMA0kNARogALsQ9xEMAQsgAUHRp+2DBE0EQCAAuyEEIAFB5JfbgARPBEBEGC1EVPshCUBEGC1EVPshCcAgA0EASBsgBKAQ9xGMDAILIANBf0wEQCAERBgtRFT7Ifk/oBD4EQwCC0QYLURU+yH5PyAEoRD4EQwBCyABQdXjiIcETQRAIAFB4Nu/hQRPBEBEGC1EVPshGUBEGC1EVPshGcAgA0EASBsgALugEPcRDAILIANBf0wEQETSITN/fNkSwCAAu6EQ+BEMAgsgALtE0iEzf3zZEsCgEPgRDAELIAAgAJMgAUGAgID8B08NABogACACQQhqEPkRQQNxIgFBAk0EQAJAAkACQCABQQFrDgIBAgALIAIrAwgQ9xEMAwsgAisDCJoQ+BEMAgsgAisDCBD3EYwMAQsgAisDCBD4EQshACACQRBqJAAgAAvUAQECfyMAQRBrIgEkAAJAIAC9QiCIp0H/////B3EiAkH7w6T/A00EQCACQYCAwPIDSQ0BIABEAAAAAAAAAABBABD1ESEADAELIAJBgIDA/wdPBEAgACAAoSEADAELIAAgARD0EUEDcSICQQJNBEACQAJAAkAgAkEBaw4CAQIACyABKwMAIAErAwhBARD1ESEADAMLIAErAwAgASsDCBDxESEADAILIAErAwAgASsDCEEBEPURmiEADAELIAErAwAgASsDCBDxEZohAAsgAUEQaiQAIAALkgMCA38BfCMAQRBrIgIkAAJAIAC8IgNB/////wdxIgFB2p+k+gNNBEAgAUGAgIDMA0kNASAAuxD4ESEADAELIAFB0aftgwRNBEAgALshBCABQeOX24AETQRAIANBf0wEQCAERBgtRFT7Ifk/oBD3EYwhAAwDCyAERBgtRFT7Ifm/oBD3ESEADAILRBgtRFT7IQlARBgtRFT7IQnAIANBAEgbIASgmhD4ESEADAELIAFB1eOIhwRNBEAgALshBCABQd/bv4UETQRAIANBf0wEQCAERNIhM3982RJAoBD3ESEADAMLIARE0iEzf3zZEsCgEPcRjCEADAILRBgtRFT7IRlARBgtRFT7IRnAIANBAEgbIASgEPgRIQAMAQsgAUGAgID8B08EQCAAIACTIQAMAQsgACACQQhqEPkRQQNxIgFBAk0EQAJAAkACQCABQQFrDgIBAgALIAIrAwgQ+BEhAAwD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/AdPBEBCACEGIAStQhmGQoCAgICAgMD//wCEDAELIAJFBEBCACEGQgAMAQsgAyACrUIAIAJnIgJB0QBqEO8RIAMpAwAhBiADKQMIQoCAgICAgMAAhUGJ/wAgAmutQjCGhAshByAAIAY3AwAgACAHIAWtQiCGhDcDCCADQRBqJAALogsCBX8PfiMAQeAAayIFJAAgBEIvhiADQhGIhCEOIAJCIIYgAUIgiIQhCyAEQv///////z+DIgxCD4YgA0IxiIQhECACIASFQoCAgICAgICAgH+DIQogDEIRiCERIAJC////////P4MiDUIgiCESIARCMIinQf//AXEhBgJAAn8gAkIwiKdB//8BcSIIQX9qQf3/AU0EQEEAIAZBf2pB/v8BSQ0BGgsgAVAgAkL///////////8AgyIPQoCAgICAgMD//wBUIA9CgICAgICAwP//AFEbRQRAIAJCgICAgICAIIQhCgwCCyADUCAEQv///////////wCDIgJCgICAgICAwP//AFQgAkKAgICAgIDA//8AURtFBEAgBEKAgICAgIAghCEKIAMhAQwCCyABIA9CgICAgICAwP//AIWEUARAIAIgA4RQBEBCgICAgICA4P//ACEKQgAhAQwDCyAKQoCAgICAgMD//wCEIQpCACEBDAILIAMgAkKAgICAgIDA//8AhYRQBEAgASAPhCECQgAhASACUARAQoCAgICAgOD//wAhCgwDCyAKQoCAgICAgMD//wCEIQoMAgsgASAPhFAEQEIAIQEMAgsgAiADhFAEQEIAIQEMAgtBACEHIA9C////////P1gEQCAFQdAAaiABIA0gASANIA1QIgcbeSAHQQZ0rXynIgdBcWoQ7xEgBSkDWCINQiCGIAUpA1AiAUIgiIQhCyANQiCIIRJBECAHayEHCyAHIAJC////////P1YNABogBUFAayADIAwgAyAMIAxQIgkbeSAJQQZ0rXynIglBcWoQ7xEgBSkDSCICQg+GIAUpA0AiA0IxiIQhECACQi+GIANCEYiEIQ4gAkIRiCERIAcgCWtBEGoLIQcgDkL/////D4MiAiABQv////8PgyIEfiITIANCD4ZCgID+/w+DIgEgC0L/////D4MiA358Ig5CIIYiDCABIAR+fCILIAxUrSACIAN+IhUgASANQv////8PgyIMfnwiDyAQQv////8PgyINIAR+fCIQIA4gE1StQiCGIA5CIIiEfCITIAIgDH4iFiABIBJCgIAEhCIOfnwiEiADIA1+fCIUIBFC/////weDQoCAgIAIhCIBIAR+fCIRQiCGfCIXfCEEIAYgCGogB2pBgYB/aiEGAkAgDCANfiIYIAIgDn58IgIgGFStIAIgASADfnwiAyACVK18IAMgDyAVVK0gECAPVK18fCICIANUrXwgASAOfnwgASAMfiIDIA0gDn58IgEgA1StQiCGIAFCIIiEfCACIAFCIIZ8IgEgAlStfCABIBEgFFStIBIgFlStIBQgElStfHxCIIYgEUIgiIR8IgMgAVStfCADIBMgEFStIBcgE1StfHwiAiADVK18IgFCgICAgICAwACDUEUEQCAGQQFqIQYMAQsgC0I/iCEDIAFCAYYgAkI/iIQhASACQgGGIARCP4iEIQIgC0IBhiELIAMgBEIBhoQhBAsgBkH//wFOBEAgCkKAgICAgIDA//8AhCEKQgAhAQwBCwJ+IAZBAEwEQEEBIAZrIghB/wBNBEAgBUEQaiALIAQgCBDuESAFQSBqIAIgASAGQf8AaiIGEO8RIAVBMGogCyAEIAYQ7xEgBSACIAEgCBDuESAFKQMwIAUpAziEQgBSrSAFKQMgIAUpAxCEhCELIAUpAyggBSkDGIQhBCAFKQMAIQIgBSkDCAwCC0IAIQEMAgsgAUL///////8/gyAGrUIwhoQLIAqEIQogC1AgBEJ/VSAEQoCAgICAgICAgH9RG0UEQCAKIAJCAXwiASACVK18IQoMAQsgCyAEQoCAgICAgICAgH+FhFBFBEAgAiEBDAELIAogAiACQgGDfCIBIAJUrXwhCgsgACABNwMAIAAgCjcDCCAFQeAAaiQAC4MBAgJ/AX4jAEEQayIDJAAgAAJ+IAFFBEBCACEEQgAMAQsgAyABIAFBH3UiAmogAnMiAq1CACACZyICQdEAahDvESADKQMIQoCAgICAgMAAhUGegAEgAmutQjCGfCABQYCAgIB4ca1CIIaEIQQgAykDAAs3AwAgACAENwMIIANBEGokAAvICQIEfwR+IwBB8ABrIgUkACAEQv///////////wCDIQoCQAJAIAFCf3wiCUJ/USACQv///////////wCDIgsgCSABVK18Qn98IglC////////v///AFYgCUL///////+///8AURtFBEAgA0J/fCIJQn9SIAogCSADVK18Qn98IglC////////v///AFQgCUL///////+///8AURsNAQsgAVAgC0KAgICAgIDA//8AVCALQoCAgICAgMD//wBRG0UEQCACQoCAgICAgCCEIQQgASEDDAILIANQIApCgICAgICAwP//AFQgCkKAgICAgIDA//8AURtFBEAgBEKAgICAgIAghCEEDAILIAEgC0KAgICAgIDA//8AhYRQBEBCgICAgICA4P//ACACIAEgA4UgAiAEhUKAgICAgICAgIB/hYRQIgYbIQRCACABIAYbIQMMAgsgAyAKQoCAgICAgMD//wCFhFANASABIAuEUARAIAMgCoRCAFINAiABIAODIQMgAiAEgyEEDAILIAMgCoRQRQ0AIAEhAyACIQQMAQsgAyABIAMgAVYgCiALViAKIAtRGyIHGyEKIAQgAiAHGyILQv///////z+DIQkgAiAEIAcbIgJCMIinQf//AXEhCCALQjCIp0H//wFxIgZFBEAgBUHgAGogCiAJIAogCSAJUCIGG3kgBkEGdK18pyIGQXFqEO8RIAUpA2ghCSAFKQNgIQpBECAGayEGCyABIAMgBxshAyACQv///////z+DIQEgCAR+IAEFIAVB0ABqIAMgASADIAEgAVAiBxt5IAdBBnStfKciB0FxahDvEUEQIAdrIQggBSkDUCEDIAUpA1gLQgOGIANCPYiEQoCAgICAgIAEhCEEIAlCA4YgCkI9iIQhASACIAuFIQkCfiADQgOGIgMgBiAIayIHRQ0AGiAHQf8ASwRAQgAhBEIBDAELIAVBQGsgAyAEQYABIAdrEO8RIAVBMGogAyAEIAcQ7hEgBSkDOCEEIAUpAzAgBSkDQCAFKQNIhEIAUq2ECyEDIAFCgICAgICAgASEIQwgCkIDhiECAkAgCUJ/VwRAIAIgA30iASAMIAR9IAIgA1StfSIDhFAEQEIAIQNCACEEDAMLIANC/////////wNWDQEgBUEgaiABIAMgASADIANQIgcbeSAHQQZ0rXynQXRqIgcQ7xEgBiAHayEGIAUpAyghAyAFKQMgIQEMAQsgAiADfCIBIANUrSAEIAx8fCIDQoCAgICAgIAIg1ANACABQgGDIANCP4YgAUIBiISEIQEgBkEBaiEGIANCAYghAwsgC0KAgICAgICAgIB/gyEEIAZB//8BTgRAIARCgICAgICAwP//AIQhBEIAIQMMAQtBACEHAkAgBkEASgRAIAYhBwwBCyAFQRBqIAEgAyAGQf8AahDvESAFIAEgA0EBIAZrEO4RIAUpAwAgBSkDECAFKQMYhEIAUq2EIQEgBSkDCCEDCyADQgOIQv///////z+DIASEIAetQjCGhCADQj2GIAFCA4iEIgQgAadBB3EiBkEES618IgMgBFStfCADQgGDQgAgBkEERhsiASADfCIDIAFUrXwhBAsgACADNwMAIAAgBDcDCCAFQfAAaiQAC4UCAgJ/BH4jAEEQayICJAAgAb0iBUKAgICAgICAgIB/gyEHAn4gBUL///////////8AgyIEQoCAgICAgIB4fEL/////////7/8AWARAIARCPIYhBiAEQgSIQoCAgICAgICAPHwMAQsgBEKAgICAgICA+P8AWgRAIAVCPIYhBiAFQgSIQoCAgICAgMD//wCEDAELIARQBEBCACEGQgAMAQsgAiAEQgAgBEKAgICAEFoEfyAEQiCIp2cFIAWnZ0EgagsiA0ExahDvESACKQMAIQYgAikDCEKAgICAgIDAAIVBjPgAIANrrUIwhoQLIQQgACAGNwMAIAAgBCAHhDcDCCACQRBqJAAL2wECAX8CfkEBIQQCQCAAQgBSIAFC////////////AIMiBUKAgICAgIDA//8AViAFQoCAgICAgMD//wBRGw0AIAJCAFIgA0L///////////8AgyIGQoCAgICAgMD//wBWIAZCgICAgICAwP//AFEbDQAgACAChCAFIAaEhFAEQEEADwsgASADg0IAWQRAQX8hBCAAIAJUIAEgA1MgASADURsNASAAIAKFIAEgA4WEQgBSDwtBfyEEIAAgAlYgASADVSABIANRGw0AIAAgAoUgASADhYRCAFIhBAsgBAvTAQIBfwJ+QX8hBAJAIABCAFIgAUL///////////8AgyIFQoCAgICAgMD//wBWIAVCgICAgICAwP//AFEbDQAgAkIAUiADQv///////////wCDIgZCgICAgICAwP//AFYgBkKAgICAgIDA//8AURsNACAAIAKEIAUgBoSEUARAQQAPCyABIAODQgBZBEAgACACVCABIANTIAEgA1EbDQEgACAChSABIAOFhEIAUg8LIAAgAlYgASADVSABIANRGw0AIAAgAoUgASADhYRCAFIhBAsgBAs1ACAAIAE3AwAgACACQv///////z+DIARCMIinQYCAAnEgAkIwiKdB//8BcXKtQjCGhDcDCAtrAgF/AX4jAEEQayICJAAgAAJ+IAFFBEBCACEDQgAMAQsgAiABrUIAQfAAIAFnQR9zIgFrEO8RIAIpAwhCgICAgICAwACFIAFB//8Aaq1CMIZ8IQMgAikDAAs3AwAgACADNwMIIAJBEGokAAtFAQF/IwBBEGsiBSQAIAUgASACIAMgBEKAgICAgICAgIB/hRCUEyAFKQMAIQEgACAFKQMINwMIIAAgATcDACAFQRBqJAALxAIBAX8jAEHQAGsiBCQAAkAgA0GAgAFOBEAgBEEgaiABIAJCAEKAgICAgICA//8AEJITIAQpAyghAiAEKQMgIQEgA0H//wFIBEAgA0GBgH9qIQMMAgsgBEEQaiABIAJCAEKAgICAgICA//8AEJITIANB/f8CIANB/f8CSBtBgoB+aiEDIAQpAxghAiAEKQMQIQEMAQsgA0GBgH9KDQAgBEFAayABIAJCAEKAgICAgIDAABCSEyAEKQNIIQIgBCkDQCEBIANBg4B+SgRAIANB/v8AaiEDDAELIARBMGogASACQgBCgICAgICAwAAQkhMgA0GGgH0gA0GGgH1KG0H8/wFqIQMgBCkDOCECIAQpAzAhAQsgBCABIAJCACADQf//AGqtQjCGEJITIAAgBCkDCDcDCCAAIAQpAwA3AwAgBEHQAGokAAvnEAIFfwx+IwBBwAFrIgUkACAEQv///////z+DIRIgAkL///////8/gyEOIAIgBIVCgICAgICAgICAf4MhESAEQjCIp0H//wFxIQcCQAJAAkAgAkIwiKdB//8BcSIJQX9qQf3/AU0EQEEAIQYgB0F/akH+/wFJDQELIAFQIAJC////////////AIMiC0KAgICAgIDA//8AVCALQoCAgICAgMD//wBRG0UEQCACQoCAgICAgCCEIREMAgsgA1AgBEL///////////8AgyICQoCAgICAgMD//wBUIAJCgICAgICAwP//AFEbRQRAIARCgICAgICAIIQhESADIQEMAgsgASALQoCAgICAgMD//wCFhFAEQCADIAJCgICAgICAwP//AIWEUARAQgAhAUKAgICAgIDg//8AIREMAwsgEUKAgICAgIDA//8AhCERQgAhAQwCCyADIAJCgICAgICAwP//AIWEUARAQgAhAQwCCyABIAuEUA0CIAIgA4RQBEAgEUKAgICAgIDA//8AhCERQgAhAQwCC0EAIQYgC0L///////8/WARAIAVBsAFqIAEgDiABIA4gDlAiBht5IAZBBnStfKciBkFxahDvEUEQIAZrIQYgBSkDuAEhDiAFKQOwASEBCyACQv///////z9WDQAgBUGgAWogAyASIAMgEiASUCIIG3kgCEEGdK18pyIIQXFqEO8RIAYgCGpBcGohBiAFKQOoASESIAUpA6ABIQMLIAVBkAFqIBJCgICAgICAwACEIhRCD4YgA0IxiIQiAkIAQoTJ+c6/5ryC9QAgAn0iBEIAEI0TIAVBgAFqQgAgBSkDmAF9QgAgBEIAEI0TIAVB8ABqIAUpA4gBQgGGIAUpA4ABQj+IhCIEQgAgAkIAEI0TIAVB4ABqIARCAEIAIAUpA3h9QgAQjRMgBUHQAGogBSkDaEIBhiAFKQNgQj+IhCIEQgAgAkIAEI0TIAVBQGsgBEIAQgAgBSkDWH1CABCNEyAFQTBqIAUpA0hCAYYgBSkDQEI/iIQiBEIAIAJCABCNEyAFQSBqIARCAEIAIAUpAzh9QgAQjRMgBUEQaiAFKQMoQgGGIAUpAyBCP4iEIgRCACACQgAQjRMgBSAEQgBCACAFKQMYfUIAEI0TIAYgCSAHa2ohBwJ+QgAgBSkDCEIBhiAFKQMAQj+IhEJ/fCILQv////8PgyIEIAJCIIgiDH4iECALQiCIIgsgAkL/////D4MiCn58IgJCIIYiDSAEIAp+fCIKIA1UrSALIAx+IAIgEFStQiCGIAJCIIiEfHwgCiAEIANCEYhC/////w+DIgx+IhAgCyADQg+GQoCA/v8PgyINfnwiAkIghiIPIAQgDX58IA9UrSALIAx+IAIgEFStQiCGIAJCIIiEfHx8IgIgClStfCACQgBSrXx9IgpC/////w+DIgwgBH4iECALIAx+Ig0gBCAKQiCIIg9+fCIKQiCGfCIMIBBUrSALIA9+IAogDVStQiCGIApCIIiEfHwgDEIAIAJ9IgJCIIgiCiAEfiIQIAJC/////w+DIg0gC358IgJCIIYiDyAEIA1+fCAPVK0gCiALfiACIBBUrUIghiACQiCIhHx8fCICIAxUrXwgAkJ+fCIQIAJUrXxCf3wiCkL/////D4MiAiAOQgKGIAFCPoiEQv////8PgyIEfiIMIAFCHohC/////w+DIgsgCkIgiCIKfnwiDSAMVK0gDSAQQiCIIgwgDkIeiEL//+//D4NCgIAQhCIOfnwiDyANVK18IAogDn58IAIgDn4iEyAEIAp+fCINIBNUrUIghiANQiCIhHwgDyANQiCGfCINIA9UrXwgDSALIAx+IhMgEEL/////D4MiECAEfnwiDyATVK0gDyACIAFCAoZC/P///w+DIhN+fCIVIA9UrXx8Ig8gDVStfCAPIAogE34iDSAOIBB+fCIKIAQgDH58IgQgAiALfnwiAkIgiCACIARUrSAKIA1UrSAEIApUrXx8QiCGhHwiCiAPVK18IAogFSAMIBN+IgQgCyAQfnwiC0IgiCALIARUrUIghoR8IgQgFVStIAQgAkIghnwgBFStfHwiBCAKVK18IgJC/////////wBYBEAgAUIxhiAEQv////8PgyIBIANC/////w+DIgt+IgpCAFKtfUIAIAp9IhAgBEIgiCIKIAt+Ig0gASADQiCIIgx+fCIOQiCGIg9UrX0gAkL/////D4MgC34gASASQv////8Pg358IAogDH58IA4gDVStQiCGIA5CIIiEfCAEIBRCIIh+IAMgAkIgiH58IAIgDH58IAogEn58QiCGfH0hCyAHQX9qIQcgECAPfQwBCyAEQiGIIQwgAUIwhiACQj+GIARCAYiEIgRC/////w+DIgEgA0L/////D4MiC34iCkIAUq19QgAgCn0iECABIANCIIgiCn4iDSAMIAJCH4aEIg9C/////w+DIg4gC358IgxCIIYiE1StfSAKIA5+IAJCAYgiDkL/////D4MgC358IAEgEkL/////D4N+fCAMIA1UrUIghiAMQiCIhHwgBCAUQiCIfiADIAJCIYh+fCAKIA5+fCAPIBJ+fEIghnx9IQsgDiECIBAgE30LIQEgB0GAgAFOBEAgEUKAgICAgIDA//8AhCERQgAhAQwBCyAHQYGAf0wEQEIAIQEMAQsgBCABQgGGIANaIAtCAYYgAUI/iIQiASAUWiABIBRRG618IgEgBFStIAJC////////P4MgB0H//wBqrUIwhoR8IBGEIRELIAAgATcDACAAIBE3AwggBUHAAWokAA8LIABC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IQIgACAFQoCAgAiFhEIAUg0BIAJBAXEgAmohAgwBCyAAUCAFQoCAgICAgMD//wBUIAVCgICAgICAwP//AFEbRQRAIAFCGYinQf///wFxQYCAgP4HciECDAELQYCAgPwHIQIgBUL///////+/v8AAVg0AQQAhAiAFQjCIpyIEQZH+AEkNACADIAAgAUL///////8/g0KAgICAgIDAAIQiBUGB/wAgBGsQ7hEgA0EQaiAAIAUgBEH/gX9qEO8RIAMpAwgiBUIZiKchAiADKQMAIAMpAxAgAykDGIRCAFKthCIAUCAFQv///w+DIgVCgICACFQgBUKAgIAIURtFBEAgAkEBaiECDAELIAAgBUKAgIAIhYRCAFINACACQQFxIAJqIQILIANBIGokACACIAFCIIinQYCAgIB4cXK+C80TAg9/A34jAEGwAmsiBiQAQQAhDUEAIRAgACgCTEEATgRAIAAQwgQhEAsCQCABLQAAIgRFDQAgAEEEaiEHQgAhEkEAIQ0CQANAAkACQCAEQf8BcRCKEwRAA0AgASIEQQFqIQEgBC0AARCKEw0ACyAAQgAQixMDQAJ/IAAoAgQiASAAKAJoSQRAIAcgAUEBajYCACABLQAADAELIAAQjBMLEIoTDQALAkAgACgCaEUEQCAHKAIAIQEMAQsgByAHKAIAQX9qIgE2AgALIAEgACgCCGusIAApA3ggEnx8IRIMAQsCfwJAAkAgAS0AACIEQSVGBEAgAS0AASIDQSpGDQEgA0ElRw0CCyAAQgAQixMgASAEQSVGaiEEAn8gACgCBCIBIAAoAmhJBEAgByABQQFqNgIAIAEtAAAMAQsgABCMEwsiASAELQAARwRAIAAoAmgEQCAHIAcoAgBBf2o2AgALQQAhDiABQQBODQgMBQsgEkIBfCESDAMLQQAhCCABQQJqDAELAkAgAxDVEUUNACABLQACQSRHDQAgAiABLQABQVBqEKMTIQggAUEDagwBCyACKAIAIQggAkEEaiECIAFBAWoLIQRBACEOQQAhASAELQAAENURBEADQCAELQAAIAFBCmxqQVBqIQEgBC0AASEDIARBAWohBCADENURDQALCwJ/IAQgBC0AACIFQe0ARw0AGkEAIQkgCEEARyEOIAQtAAEhBUEAIQogBEEBagshAyAFQf8BcUG/f2oiC0E5Sw0BIANBAWoh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EKoBEJ0YIAAgACgCBEEEajYCBCAEEMUFIAFBf2oiAQ0ACyACQRBqJAALDAAgACAAKAIAEKkYCzMAIAAgABCyBCAAELIEIAAQpBhBAnRqIAAQsgQgAUECdGogABCyBCAAENADQQJ0ahDIBQtKAQF/IwBBIGsiASQAIAFBADYCDCABQa8FNgIIIAEgASkDCDcDACAAIAFBEGogASAAEJwXEJ0XIAAoAgQhACABQSBqJAAgAEF/agtzAQJ/IwBBEGsiAyQAIAEQgxcgA0EIaiABEIcXIQQgAEEQaiIBENADIAJNBEAgASACQQFqEIoXCyABIAIQkAYoAgAEQCABIAIQkAYoAgAQig0aCyAEEIsXIQAgASACEJAGIAA2AgAgBBCIFxogA0EQaiQACxUAIAAgARClFhogAEGIywE2AgAgAAsVACAAIAEQpRYaIABBqMsBNgIAIAALNwAgACADEKUWGiAAEKoBGiAAIAI6AAwgACABNgIIIABB5L4BNgIAIAFFBEAgABClFzYCCAsgAAsbACAAIAEQpRYaIAAQqgEaIABBlMMBNgIAIAALGwAgACABEKUWGiAAEKoBGiAAQajEATYCACAACyMAIAAgARClFhogABCqARogAEGYvwE2AgAgABCSFDYCCCAACxsAIAAgARClFhogABCqARogAEG8xQE2AgAgAAsnACAAIAEQpRYaIABBrtgAOwEIIABByL8BNgIAIABBDGoQ2wkaIAALKgAgACABEKUWGiAAQq6AgIDABTcCCCAAQfC/ATYCACAAQRBqENsJGiAACxUAIAAgARClFhogAEHIywE2AgAgAAsVACAAIAEQpRYaIABBvM0BNgIAIAALFQAgACABEKUWGiAAQZDPATYCACAACxUAIAAgARClFhogAEH40AE2AgAgAAsbACAAIAEQpRYaIAAQqgEaIABB0NgBNgIAIAALGwAgACABEKUWGiAAEKoBGiAAQeTZATYCACAACxsAIAAgARClFhogABCqARogAEHY2gE2AgAgAAsbACAAIAEQpRYaIAAQqgEaIABBzNsBNgIAIAALGwAgACABEKUWGiAAEKoBGiAAQcDcATYCACAACxsAIAAgARClFhogABCqARogAEHk3QE2AgAgAAsbACAAIAEQpRYaIAAQqgEaIABBiN8BNgIAIAALGwAgACABEKUWGiAAEKoB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AQJ/IAAQtRghAyAAKAIIIQIDQCADIAIQqgEQnRggACAAKAIIQQRqIgI2AgggAUF/aiIBDQALC1wBAX8gABCPFyAAEJkYIAAoAgAgACgCBCABQQRqIgIQoQYgACACEKIGIABBBGogAUEIahCiBiAAEJsYIAEQthgQogYgASABKAIENgIAIAAgABDQAxCcGCAAEMUFCyMAIAAQtxggACgCAARAIAAQtRggACgCACAAELgYEKgYCyAACx0AIAAgARCqARDlBRogAEEEaiACEKoBEK4GGiAACwoAIABBDGoQsAYLCgAgAEEMahDMBQsMACAAIAAoAgQQuRgLEwAgABC6GCgCACAAKAIAa0ECdQsJACAAIAEQuxgLCgAgAEEMahDMBQs1AQJ/A0AgACgCCCABRkUEQCAAELUYIQIgACAAKAIIQXxqIgM2AgggAiADEKoBEMsFDAELCwsPACAAIAEQqgEQrgYaIAALBwAgABC+GAsQACAAKAIAEKoBEL0EEL8YCwoAIAAQqgEQwBgLOAECfyAAKAIAIAAoAggiAkEBdWohASAAKAIEIQAgASACQQFxBH8gASgCACAAaigCAAUgAAsRBAALCQAgACABEKcVCw0AIAAQxxgQyBhBcGoLKgEBf0EBIQEgAEECTwR/IABBAWoQyRgiACAAQX9qIgAgAEECRhsFIAELCwsAIAAgAUEAEMoYCwwAIAAQzAUgATYCAAsTACAAEMwFIAFBgICAgHhyNgIICwcAIAAQzAULBwAgABCrBgsKACAAQQNqQXxxCx8AIAAQrAYgAUkEQEHw6wEQ8QUACyABQQJ0QQQQ8gULCQAgACABEKIGCx0AIAAgARCqARDyDBogAEEEaiACEKoBEPIMGiAACzIAIAAQzBUgABDUCQRAIAAQ1QkgABDWCSAAEPATQQFqEJ8HIABBABCHCiAAQQAQggoLCwkAIAAgARDPGAsRACABENUJEKoBGiAAENUJGgsyACAAEOwVIAAQjBUEQCAAEJUYIAAQ7hUgABCNGEEBahCmBiAAQQAQxhggAEEAEPIVCwsJACAAIAEQ0hgLEQAgARCVGBCqARogABCVGBoLCgAgASAAa0EMbQsFABDWGAsFABDXGAsNAEKAgICAgICAgIB/Cw0AQv///////////wALBQAQ2RgLBgBB//8DCwUAENsYCwQAQn8LDAAg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DAELQYigA0EANgIAQfyfA0EANgIAIAEgAEEDcjYCBCAAIAFqIgAgACgCBEEBcjYCBAsgAUEIaiEADAoLQYCgAygCACICIARLBEBBgKADIAIgBGsiATYCAEGMoANBjKADKAIAIgAgBGoiAzYCACADIAFBAXI2AgQgACAEQQNyNgIEIABBCGohAAwKC0EAIQAgBEEvaiIIAn9BzKMDKAIABEBB1KMDKAIADAELQdijA0J/NwIAQdCjA0KAoICAgIAENwIAQcyjAyALQQxqQXBxQdiq1aoFczYCAEHgowNBADYCAEGwowNBADYCAEGAIAsiAWoiBkEAIAFrIgdxIgUgBE0NCUEAIQBBrKMDKAIAIgEEQEGkowMoAgAiAyAFaiIJIANNDQogCSABSw0KC0GwowMtAABBBHENBAJAAkBBjKADKAIAIgEEQEG0owMhAANAIAAoAgAiAyABTQRAIAMgACgCBGogAUsNAwsgACgCCCIADQALC0EAEKMaIgJBf0YNBSAFIQZB0KMDKAIAIgBBf2oiASACcQRAIAUgAmsgASACakEAIABrcWohBgsgBiAETQ0FIAZB/v///wdLDQVBrKMDKAIAIgAEQEGkowMoAgAiASAGaiIDIAFNDQYgAyAASw0GCyAGEKMaIgAgAkcNAQwHCyAGIAJrIAdxIgZB/v///wdLDQQgBhCjGiICIAAoAgAgACgCBGpGDQMgAiEACyAAIQICQCAEQTBqIAZNDQAgBkH+////B0sNACACQX9GDQBB1KMDKAIAIgAgCCAGa2pBACAAa3EiAEH+////B0sNBiAAEKMaQX9HBEAgACAGaiEGDAcLQQAgBmsQoxoaDAQLIAJBf0cNBQwDC0EAIQUMBwtBACECDAULIAJBf0cNAgtBsKMDQbCjAygCAEEEcjYCAAsgBUH+////B0sNASAFEKMaIgJBABCjGiIATw0BIAJBf0YNASAAQX9GDQEgACACayIGIARBKGpNDQELQaSjA0GkowMoAgAgBmoiADYCACAAQaijAygCAEsEQEGoowMgADYCAAsCQAJAAkBBjKADKAIAIgEEQEG0owMhAANAIAIgACgCACIDIAAoAgQiBWpGDQIgACgCCCIADQALDAILQYSgAygCACIAQQAgAiAATxtFBEBBhKADIAI2AgALQQAhAEG4owMgBjYCAEG0owMgAjYC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QX9qIQMgBkIBhiIGQn9VDQALCyAHQQEgA2uthgwBCyAHQv////////8Hg0KAgICAgICACIQLIgd9IgZCf1UhBCACIANKBEADQAJAIARFDQAgBiIFQgBSDQAgAEQAAAAAAAAAAKIPCyAFQgGGIgUgB30iBkJ/VSEEIAJBf2oiAiADSg0ACyADIQILAkAgBEUNACAGIgVCAFINACAARAAAAAAAAAAAog8LAkAgBUL/////////B1YEQCAFIQYMAQsDQCACQX9qIQIgBUKAgICAgICABFQhAyAFQgGGIgYhBSADDQALCyACQQFOBH4gBkKAgICAgICAeHwgAq1CNIaEBSAGQQEgAmutiAsgCEKAgICAgICAgIB/g4S/DwsgAEQAAAAAAAAAAKIgACAFIAZRGwuqBgIFfwR+IwBBgAFrIgUkAAJAAkACQCADIARCAEIAEJYTRQ0AIAMgBBCpGiEHIAJCMIinIglB//8BcSIGQf//AUYNACAHDQELIAVBEGogASACIAMgBBCSEyAFIAUpAxAiBCAFKQMYIgMgBCADEJwTIAUpAwghAiAFKQMAIQQMAQsgASACQv///////z+DIAatQjCGhCIKIAMgBEL///////8/gyAEQjCIp0H//wFxIgitQjCGhCILEJYTQQBMBEAgASAKIAMgCxCWEwRAIAEhBAwCCyAFQfAAaiABIAJCAEIAEJITIAUpA3ghAiAFKQNwIQQMAQsgBgR+IAEFIAVB4ABqIAEgCkIAQoCAgICAgMC7wAAQkhMgBSkDaCIKQjCIp0GIf2ohBiAFKQNgCyEEIAhFBEAgBUHQAGogAyALQgBCgICAgICAwLvAABCSEyAFKQNYIgtCMIinQYh/aiEIIAUpA1AhAwsgCkL///////8/g0KAgICAgIDAAIQiCiALQv///////z+DQoCAgICAgMAAhCINfSAEIANUrX0iDEJ/VSEHIAQgA30hCyAGIAhKBEADQAJ+IAdBAXEEQCALIAyEUARAIAVBIGogASACQgBCABCSEyAFKQMoIQIgBSkDICEEDAULIAxCAYYhDCALQj+IDAELIARCP4ghDCAEIQsgCkIBhgsgDIQiCiANfSALQgGGIgQgA1StfSIMQn9VIQcgBCADfSELIAZBf2oiBiAISg0ACyAIIQYLAkAgB0UNACALIgQgDCIKhEIAUg0AIAVBMGogASACQgBCABCSEyAFKQM4IQIgBSkDMCEEDAELIApC////////P1gEQANAIARCP4ghAyAGQX9qIQYgBEIBhiEEIAMgCkIBhoQiCkKAgICAgIDAAFQNAAsLIAlBgIACcSEHIAZBAEwEQCAFQUBrIAQgCkL///////8/gyAGQfgAaiAHcq1CMIaEQgBCgICAgICAwMM/EJITIAUpA0ghAiAFKQNAIQQMAQsgCkL///////8/gyAGIAdyrUIwhoQhAgsgACAENwMAIAAgAjcDCCAFQYABaiQAC+YDAwN/AX4GfAJAAkACQAJAIAC9IgRCAFkEQCAEQiCIpyIBQf//P0sNAQsgBEL///////////8Ag1AEQEQAAAAAAADwvyAAIACiow8LIARCf1UNASAAIAChRAAAAAAAAAAAow8LIAFB//+//wdLDQJBgIDA/wMhAkGBeCEDIAFBgIDA/wNHBEAgASECDAILIASnDQFEAAAAAAAAAAAPCyAARAAAAAAAAFBDor0iBEIgiKchAkHLdyEDCyADIAJB4r4laiIBQRR2arciCEQAYJ9QE0TTP6IiBSAEQv////8PgyABQf//P3FBnsGa/wNqrUIghoS/RAAAAAAAAPC/oCIAIAAgAEQAAAAAAADgP6KiIgahvUKAgICAcIO/IgdEAAAgFXvL2z+iIgmgIgogCSAFIAqhoCAAIAehIAahIAAgAEQAAAAAAAAAQKCjIgAgBiAAIACiIgUgBaIiACAAIABEn8Z40Amawz+iRK94jh3Fccw/oKJEBPqXmZmZ2T+goiAFIAAgACAARERSPt8S8cI/okTeA8uWZEbHP6CiRFmTIpQkSdI/oKJEk1VVVVVV5T+goqCgoqAiAEQAACAVe8vbP6IgCEQ2K/ER8/5ZPaIgACAHoETVrZrKOJS7PaKgoKCgIQALIAALuwICAn8DfQJAAkAgALwiAUGAgIAET0EAIAFBf0obRQRAIAFB/////wdxRQRAQwAAgL8gACAAlJUPCyABQX9MBEAgACAAk0MAAAAAlQ8LIABDAAAATJS8IQFB6H4hAgwBCyABQf////sHSw0BQYF/IQJDAAAAACEAIAFBgICA/ANGDQELIAIgAUGN9qsCaiIBQRd2arIiBUOAIJo+lCABQf///wNxQfOJ1PkDar5DAACAv5IiACAAIABDAAAAP5SUIgOTvEGAYHG+IgRDAGDePpQgACAEkyADkyAAIABDAAAAQJKVIgAgAyAAIACUIgAgACAAlCIAQ+7pkT6UQ6qqKj+SlCAAIABDJp54PpRDE87MPpKUkpKUkiIAQwBg3j6UIAVD2ydUNZQgACAEkkPZ6gS4lJKSkpIhAAsgAAuoAQACQCABQYAITgRAIABEAAAAAAAA4H+iIQAgAUH/D0gEQCABQYF4aiEBDAILIABEAAAAAAAA4H+iIQAgAUH9FyABQf0XSBtBgnBqIQEMAQsgAUGBeEoNACAARAAAAAAAABAAoiEAIAFBg3BKBEAgAUH+B2ohAQwBCyAARAAAAAAAABAAoiEAIAFBhmggAUGGaEobQfwPaiEBCyAAIAFB/wdqrUI0hr+iC0QCAX8BfiABQv///////z+DIQMCfyABQjCIp0H//wFxIgJB//8BRwRAQQQgAg0BGkECQQMgACADhFAbDwsgACADhFALC4MEAQN/IAJBgMAATwRAIAAgASACECgaIAAPCyAAIAJqIQMCQCAAIAFzQQNxRQRAAkAgAkEBSARAIAAhAgwBCyAAQQNxRQRAIAAhAgwBCyAAIQIDQCACIAEtAAA6AAAgAUEBaiEBIAJBAWoiAiADTw0BIAJBA3ENAAsLAkAgA0F8cSIEQcAASQ0AIAIgBEFAaiIFSw0AA0AgAiABKAIANgIAIAIgASgCBDYCBCACIAEoAgg2AgggAiABKAIMNgIMIAIgASgCEDYCECACIAEoAhQ2AhQgAiABKAIYNgIYIAIgASgCHDYCHCACIAEoAiA2AiAgAiABKAIkNgIkIAIgASgCKDYCKCACIAEoAiw2AiwgAiABKAIwNgIwIAIgASgCNDYCNCACIAEoAjg2AjggAiABKAI8NgI8IAFBQGshASACQUBrIgIgBU0NAAsLIAIgBE8NAQNAIAIgASgCADYCACABQQRqIQEgAkEEaiICIARJDQALDAELIANBBEkEQCAAIQIMAQsgA0F8aiIEIABJBEAgACECDAELIAAhAgNAIAIgAS0AADoAACACIAEtAAE6AAEgAiABLQACOgACIAIgAS0AAzoAAyABQQRqIQEgAkEEaiICIARNDQALCyACIANJBEADQCACIAEtAAA6AAAgAUEBaiEBIAJBAWoiAiADRw0ACwsgAAvzAgICfwF+AkAgAkUNACAAIAJqIgNBf2ogAToAACAAIAE6AAAgAkEDSQ0AIANBfmogAToAACAAIAE6AAEgA0F9aiABOgAAIAAgAToAAiACQQdJDQAgA0F8aiABOgAAIAAgAToAAyACQQlJDQAgAEEAIABrQQNxIgRqIgMgAUH/AXFBgYKECGwiATYCACADIAIgBGtBfHEiBGoiAkF8aiABNgIAIARBCUkNACADIAE2AgggAyABNgIEIAJBeGogATYCACACQXRqIAE2AgAgBEEZSQ0AIAMgATYCGCADIAE2AhQgAyABNgIQIAMgATYCDCACQXBqIAE2AgAgAkFsaiABNgIAIAJBaGogATYCACACQWRqIAE2AgAgBCADQQRxQRhyIgRrIgJBIEkNACABrSIFQiCGIAWEIQUgAyAEaiEBA0AgASAFNwMYIAEgBTcDECABIAU3AwggASAFNwMAIAFBIGohASACQWBqIgJBH0sNAAsLIAAL+AIBAn8CQCAAIAFGDQACQCABIAJqIABLBEAgACACaiIEIAFLDQELIAAgASACEKoaDwsgACABc0EDcSEDAkACQCAAIAFJBEAgAwRAIAAhAwwDCyAAQQNxRQRAIAAhAwwCCyAAIQMDQCACRQ0EIAMgAS0AADoAACABQQFqIQEgAkF/aiECIANBAWoiA0EDcQ0ACwwBCwJAIAMNACAEQQNxBEADQCACRQ0FIAAgAkF/aiICaiIDIAEgAmotAAA6AAAgA0EDcQ0ACwsgAkEDTQ0AA0AgACACQXxqIgJqIAEgAmooAgA2AgAgAkEDSw0ACwsgAkUNAgNAIAAgAkF/aiICaiABIAJqLQAAOgAAIAINAAsMAgsgAkEDTQ0AIAIhBANAIAMgASgCADYCACABQQRqIQEgA0EEaiEDIARBfGoiBEEDSw0ACyACQQNxIQILIAJFDQADQCADIAEtAAA6AAAgA0EBaiEDIAFBAWohASACQX9qIgINAAsLIAALHwBB5KMDKAIARQRAQeijAyABNgIAQeSjAyAANgIACwsEACMACxAAIwAgAGtBcHEiACQAIAALBgAgACQACwYAIABAAAsJACABIAARAAALCQAgASAAEQQACwcAIAARAQALCwAgASACIAARAgALDwAgASACIAMgBCAAEQwACw0AIAEgAiADIAARBgALCwAgASACIAARAwALCwAgASACIAAREQALDwAgASACIAMgBCAAERkACw0AIAEgAiADIAARFAALCQAgASAAERAACwsAIAEgAiAAEQ0ACw0AIAEgAiADIAARGgALDQAgASACIAMgABEbAAsLACABIAIgABEYAAsPACABIAIgAyAEIAARYgALEQAgASACIAMgBCAFIAARYwALDwAgASACIAMgBCAAEUAACxEAIAEgAiADIAQgBSAAEUEACxMAIAEgAiADIAQgBSAGIAARQgALDwAgASACIAMgBCAAEUMACw8AIAEgAiADIAQgABEfAAsPACABIAIgAyAEIAARRgALDQAgASACIAMgABEpAAsNACABIAIgAyAAESoACw0AIAEgAiADIAARBQALEQAgASACIAMgBCAFIAARPwALEQAgASACIAMgBCAFIAARIwALEwAgASACIAMgBCAFIAYgABEeAAsTACABIAIgAyAEIAUgBiAAEWQACxMAIAEgAiADIAQgBSAGIAARZQALFwAgASACIAMgBCAFIAYgByAIIAARZwALDQAgASACIAMgABFhAAsJACABIAAREgALEwAgASACIAMgBCAFIAYgABEvAAsLACABIAIgABEVAAsPACABIAIgAyAEIAARIgALDQAgASACIAMgABEmAAsNACABIAIgAyAAEUkACwkAIAEgABEdAAsPACABIAIgAyAEIAARTwALEwAgASACIAMgBCAFIAYgABE0AAsNACABIAIgAyAAEVMACxEAIAEgAiADIAQgBSAAEVsACw8AIAEgAiADIAQgABFYAAsPACABIAIgAyAEIAARUgALEQAgASACIAMgBCAFIAARVQALEwAgASACIAMgBCAFIAYgABFWAAsRACABIAIgAyAEIAUgABE4AAsTACABIAIgAyAEIAUgBiAAETkACxUAIAEgAiADIAQgBSAGIAcgABE6AAsRACABIAIgAyAEIAUgABE8AAsPACABIAIgAyAEIAAROwALDwAgASACIAMgBCAAEQgACxMAIAEgAiADIAQgBSAGIAARNgALFQAgASACIAMgBCAFIAYgByAAEVoACxUAIAEgAiADIAQgBSAGIAcgABFfAAsVACABIAIgAyAEIAUgBiAHIAARXQALGQAgASACIAMgBCAFIAYgByAIIAkgABFgAAsPACABIAIgAyAEIAARVAALFQAgASACIAMgBCAFIAYgByAAEVcACxEAIAEgAiADIAQgBSAAES4ACw8AIAEgAiADIAQgABE3AAsRACABIAIgAyAEIAUgABEPAAsPACABIAIgAyAEIAARRwALCwAgASACIAARKAALEQAgASACIAMgBCAFIAARUAALFQAgASACIAMgBCAFIAYgByAAETMACw0AIAEgAiADIAARagALDwAgASACIAMgBCAAETUACw8AIAEgAiADIAQgABFuAAsRACABIAIgAyAEIAUgABEwAAsTACABIAIgAyAEIAUgBiAAEWYACxEAIAEgAiADIAQgBSAAETEACxMAIAEgAiADIAQgBSAGIAARWQALFQAgASACIAMgBCAFIAYgByAAEV4ACxMAIAEgAiADIAQgBSAGIAARXAALCwAgASACIAARSgALCQAgASAAEUwACwcAIAARCQALEQAgASACIAMgBCAFIAARJQALDQAgASACIAMgABEhAAsTACABIAIgAyAEIAUgBiAAEUsACxEAIAEgAiADIAQgBSAAEQsACxcAIAEgAiADIAQgBSAGIAcgCCAAEQ4ACxMAIAEgAiADIAQgBSAGIAARBwALEQAgASACIAMgBCAFIAARJwALEQAgASACIAMgBCAFIAARLAALEwAgASACIAMgBCAFIAYgABFFAAsVACABIAIgAyAEIAUgBiAHIAARFgALFQAgASACIAMgBCAFIAYgByAAESsACxMAIAEgAiADIAQgBSAGIAARCgALGQAgACABIAIgA60gBK1CIIaEIAUgBhCCGwsiAQF+IAAgASACrSADrUIghoQgBBCDGyIFQiCIpxApIAWnCxkAIAAgASACIAMgBCAFrSAGrUIghoQQiBsLIwAgACABIAIgAyAEIAWtIAatQiCGhCAHrSAIrUIghoQQihsLJQAgACABIAIgAyAEIAUgBq0gB61CIIaEIAitIAmtQiCGhBCMGwsTACAAIAGnIAFCIIinIAIgAxAqCwuVygJfAEGACAvgEVZlY3RvckludABWZWN0b3JEb3VibGUAVmVjdG9yQ2hhcgBWZWN0b3JVQ2hhcgBWZWN0b3JGbG9hdAB2ZWN0b3JUb29scwBjbGVhclZlY3RvckRibABjbGVhclZlY3RvckZsb2F0AG1heGlTZXR0aW5ncwBzZXR1cABzYW1wbGVSYXRlAGNoYW5uZWxzAGJ1ZmZlclNpemUAbWF4aU9zYwBzaW5ld2F2ZQBjb3N3YXZlAHBoYXNvcgBzYXcAdHJpYW5nbGUAc3F1YXJlAHB1bHNlAGltcHVsc2UAbm9pc2UAc2luZWJ1ZgBzaW5lYnVmNABzYXduAHBoYXNlUmVzZXQAbWF4aUVudmVsb3BlAGxpbmUAdHJpZ2dlcgBhbXBsaXR1ZGUAdmFsaW5kZXgAbWF4aURlbGF5bGluZQBkbABtYXhpRmlsdGVyAGxvcmVzAGhpcmVzAGJhbmRwYXNzAGxvcGFzcwBoaXBhc3MAY3V0b2ZmAHJlc29uYW5jZQBtYXhpTWl4AHN0ZXJlbwBxdWFkAGFtYmlzb25pYwBtYXhpTGluZQBwbGF5AHByZXBhcmUAdHJpZ2dlckVuYWJsZQBpc0xpbmVDb21wbGV0ZQBtYXhpWEZhZGUAeGZhZGUAbWF4aUxhZ0V4cABpbml0AGFkZFNhbXBsZQB2YWx1ZQBhbHBoYQBhbHBoYVJlY2lwcm9jYWwAdmFsAG1heGlTYW1wbGUAZ2V0TGVuZ3RoAHNldFNhbXBsZQBzZXRTYW1wbGVGcm9tT2dnQmxvYgBpc1JlYWR5AHBsYXlPbmNlAHBsYXlPblpYAHBsYXk0AGNsZWFyAG5vcm1hbGlzZQBhdXRvVHJpbQBsb2FkAHJlYWQAbG9vcFNldFBvc09uWlgAbWF4aU1hcABsaW5saW4AbGluZXhwAGV4cGxpbgBjbGFtcABtYXhpRHluAGdhdGUAY29tcHJlc3NvcgBjb21wcmVzcwBzZXRBdHRhY2sAc2V0UmVsZWFzZQBzZXRUaHJlc2hvbGQAc2V0UmF0aW8AbWF4aUVudgBhcgBhZHNyAHNldERlY2F5AHNldFN1c3RhaW4AY29udmVydABtdG9mAG1zVG9TYW1wcwBtYXhpU2FtcGxlQW5kSG9sZABzYWgAbWF4aURpc3RvcnRpb24AZmFzdEF0YW4AYXRhbkRpc3QAZmFzdEF0YW5EaXN0AG1heGlGbGFuZ2VyAGZsYW5nZQBtYXhpQ2hvcnVzAGNob3J1cwBtYXhpRENCbG9ja2VyAG1heGlTVkYAc2V0Q3V0b2ZmAHNldFJlc29uYW5jZQBtYXhpTWF0aABhZGQAc3ViAG11bABkaXYAZ3QAbHQAZ3RlAGx0ZQBtb2QAYWJzAHBvdwBtYXhpQ2xvY2sAdGlja2VyAHNldFRlbXBvAHNldFRpY2tzUGVyQmVhdABpc1RpY2sAY3VycmVudENvdW50AHBsYXlIZWFkAGJwcwBicG0AdGljawB0aWNrcwBtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yAHNldFBoYXNlAGdldFBoYXNlAG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQAc2V0UGhhc2VzAHNpemUAbWF4aUFzeW5jS3VyYW1vdG9Pc2NpbGxhdG9yAG1heGlGRlQAcHJvY2VzcwBzcGVjdHJhbEZsYXRuZXNzAHNwZWN0cmFsQ2VudHJvaWQAZ2V0TWFnbml0dWRlcwBnZXRNYWduaXR1ZGVzREIAZ2V0UGhhc2VzAGdldE51bUJpbnMAZ2V0RkZUU2l6ZQBnZXRIb3BTaXplAGdldFdpbmRvd1NpemUAbWF4aUZGVE1vZGVzAFdJVEhfUE9MQVJfQ09OVkVSU0lPTgBOT19QT0xBUl9DT05WRVJTSU9OAG1heGlJRkZUAG1heGlJRkZUTW9kZXMAU1BFQ1RSVU0AQ09NUExFWABtYXhpTUZDQwBtZmNjAG1heGlUaW1lU3RyZXRjaABzaGFyZWRfcHRyPG1heGlUaW1lc3RyZXRjaDxoYW5uV2luRnVuY3Rvcj4gPgBnZXROb3JtYWxpc2VkUG9zaXRpb24AZ2V0UG9zaXRpb24Ac2V0UG9zaXRpb24AcGxheUF0UG9zaXRpb24AbWF4aVBpdGNoU2hpZnQAc2hhcmVkX3B0cjxtYXhpUGl0Y2hTaGlmdDxoYW5uV2luRnVuY3Rvcj4gPgBtYXhpU3RyZXRjaABzZXRMb29wU3RhcnQAc2V0TG9vcEVuZABnZXRMb29wRW5kAG1heGlCaXRzAHNpZwBhdABzaGwAc2hyAHIAbGFuZABsb3IAbHhvcgBuZWcAaW5jAGRlYwBlcQB0b1NpZ25hbAB0b1RyaWdTaWduYWwAZnJvbVNpZ25hbABtYXhpVHJpZ2dlcgBvblpYAG9uQ2hhbmdlZABtYXhpQ291bnRlcgBjb3VudABtYXhpSW5kZXgAcHVsbABhbGxvY2F0b3I8VD46OmFsbG9jYXRlKHNpemVfdCBuKSAnbicgZXhjZWVkcyBtYXhpbXVtIHN1cHBvcnRlZCBzaXplAHB1c2hfYmFjawByZXNpemUAZ2V0AHNldABOU3QzX18yNnZlY3RvcklpTlNfOWFsbG9jYXRvcklpRUVFRQBOU3QzX18yMTNfX3ZlY3Rvcl9iYXNlSWlOU185YWxsb2NhdG9ySWlFRUVFAE5TdDNfXzIyMF9fdmVjdG9yX2Jhc2VfY29tbW9uSUxiMUVFRQAAAKh6AAD1CwAALHsAAMkLAAAAAAAAAQAAABwMAAAAAAAALHsAAKULAAAAAAAAAQAAACQMAAAAAAAAUE5TdDNfXzI2dmVjdG9ySWlOU185YWxsb2NhdG9ySWlFRUVFAAAAAIh7AABUDAAAAAAAADwMAABQS05TdDNfXzI2dmVjdG9ySWlOU185YWxsb2NhdG9ySWlFRUVFAAAAiHsAAIwMAAABAAAAPAwAAGlpAHYAdmkAfAwAALB5AAB8DAAAEHoAAHZpaWkAQfAZC1CweQAAfAwAADR6AAAQegAAdmlpaWkAAAA0egAAtAwAAGlpaQA0DQAAPAwAADR6AABOMTBlbXNjcmlwdGVuM3ZhbEUAAKh6AAAgDQAAaWlpaQBB0BoL5gTIeQAAPAwAADR6AAAQegAAaWlpaWkATlN0M19fMjZ2ZWN0b3JJZE5TXzlhbGxvY2F0b3JJZEVFRUUATlN0M19fMjEzX192ZWN0b3JfYmFzZUlkTlNfOWFsbG9jYXRvcklkRUVFRQAAACx7AACKDQAAAAAAAAEAAAAcDAAAAAAAACx7AABmDQAAAAAAAAEAAAC4DQAAAAAAAFBOU3QzX18yNnZlY3RvcklkTlNfOWFsbG9jYXRvcklkRUVFRQAAAACIewAA6A0AAAAAAADQDQAAUEtOU3QzX18yNnZlY3RvcklkTlNfOWFsbG9jYXRvcklkRUVFRQAAAIh7AAAgDgAAAQAAANANAAAQDgAAsHkAABAOAABMegAAdmlpZAAAAACweQAAEA4AADR6AABMegAAdmlpaWQAAAA0egAASA4AADQNAADQDQAANHoAAAAAAADIeQAA0A0AADR6AABMegAAaWlpaWQATlN0M19fMjZ2ZWN0b3JJY05TXzlhbGxvY2F0b3JJY0VFRUUATlN0M19fMjEzX192ZWN0b3JfYmFzZUljTlNfOWFsbG9jYXRvckljRUVFRQAAACx7AADaDgAAAAAAAAEAAAAcDAAAAAAAACx7AAC2DgAAAAAAAAEAAAAIDwAAAAAAAFBOU3QzX18yNnZlY3Rvcklj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THoAAHZpaWlpaWRkAAAAANANAAB0JAAAqBEAADE1bWF4aVRpbWVTdHJldGNoSTE0aGFubldpbkZ1bmN0b3JFAKh6AADkJAAAUDE1bWF4aVRpbWVTdHJldGNoSTE0aGFubldpbkZ1bmN0b3JFAAAAAIh7AAAQJQAAAAAAAAglAABQSzE1bWF4aVRpbWVTdHJldGNoSTE0aGFubldpbkZ1bmN0b3JFAAAAiHsAAEglAAABAAAACCUAAAAAAAA4JgAAMQIAADICAAAzAgAANAIAADUCAABOU3QzX18yMjBfX3NoYXJlZF9wdHJfcG9pbnRlcklQMTVtYXhpVGltZVN0cmV0Y2hJMTRoYW5uV2luRnVuY3RvckVOMTBlbXNjcmlwdGVuMTVzbWFydF9wdHJfdHJhaXRJTlNfMTBzaGFyZWRfcHRySVMzX0VFRTExdmFsX2RlbGV0ZXJFTlNfOWFsbG9jYXRvcklTM19FRUVFAADQegAAnCUAAPB2AABOMTBlbXNjcmlwdGVuMTVzbWFydF9wdHJfdHJhaXRJTlN0M19fMjEwc2hhcmVkX3B0ckkxNW1heGlUaW1lU3RyZXRjaEkxNGhhbm5XaW5GdW5jdG9yRUVFRTExdmFsX2RlbGV0ZXJFAKh6AABEJgAATlN0M19fMjEwc2hhcmVkX3B0ckkxNW1heGlUaW1lU3RyZXRjaEkxNGhhbm5XaW5GdW5jdG9yRUVFAAAAqHoAALQmAABpAAAA8CYAAAAAAAB0JwAANgIAADcCAAA4AgAAOQIAADoCAABOU3QzX18yMjBfX3NoYXJlZF9wdHJfZW1wbGFjZUkxNW1heGlUaW1lU3RyZXRjaEkxNGhhbm5XaW5GdW5jdG9yRU5TXzlhbGxvY2F0b3JJUzNfRUVFRQAA0HoAABwnAADwdgAAsHkAADglAACEGAAATHoAADglAACweQAAOCUAAEx6AAAAAAAA7CcAADsCAAA8AgAAPQIAADltYXhpR3JhaW5JMTRoYW5uV2luRnVuY3RvckUAMTNtYXhpR3JhaW5CYXNlAAAAAKh6AADRJwAA0HoAALQnAADkJwAAAAAAAOQnAAA+AgAAPAIAAD8CAAAAAAAATHoAADglAABMegAATHoAABB6AABMegAAZGlpZGRpZABMegAAOCUAAEx6AABMegAAEHoAADE0bWF4aVBpdGNoU2hpZnRJMTRoYW5uV2luRnVuY3RvckUAAKh6AABEKAAAUDE0bWF4aVBpdGNoU2hpZnRJMTRoYW5uV2luRnVuY3RvckUAiHsAAHAoAAAAAAAAaCgAAFBLMTRtYXhpUGl0Y2hTaGlmdEkxNGhhbm5XaW5GdW5jdG9yRQAAAACIewAApCgAAAEAAABoKAAAAAAAAJQpAABAAgAAQQIAAEICAABDAgAARAIAAE5TdDNfXzIyMF9fc2hhcmVkX3B0cl9wb2ludGVySVAxNG1heGlQaXRjaFNoaWZ0STE0aGFubldpbkZ1bmN0b3JFTjEwZW1zY3JpcHRlbjE1c21hcnRfcHRyX3RyYWl0SU5TXzEwc2hhcmVkX3B0cklTM19FRUUxMXZhbF9kZWxldGVyRU5TXzlhbGxvY2F0b3JJUzNfRUVFRQAAANB6AAD4KAAA8HYAAE4xMGVtc2NyaXB0ZW4xNXNtYXJ0X3B0cl90cmFpdElOU3QzX18yMTBzaGFyZWRfcHRySTE0bWF4aVBpdGNoU2hpZnRJMTRoYW5uV2luRnVuY3RvckVFRUUxMXZhbF9kZWxldGVyRQAAqHoAAKApAABOU3QzX18yMTBzaGFyZWRfcHRySTE0bWF4aVBpdGNoU2hpZnRJMTRoYW5uV2luRnVuY3RvckVFRQAAAACoegAAECoAAEwqAAAAAAAAzCoAAEUCAABGAgAARwIAADkCAABIAgAATlN0M19fMjIwX19zaGFyZWRfcHRyX2VtcGxhY2VJMTRtYXhpUGl0Y2hTaGlmdEkxNGhhbm5XaW5GdW5jdG9yRU5TXzlhbGxvY2F0b3JJUzNfRUVFRQAAANB6AAB0KgAA8HYAALB5AACUKAAAhBgAQfDVAAvSAUx6AACUKAAATHoAAEx6AAAQegAATHoAADExbWF4aVN0cmV0Y2hJMTRoYW5uV2luRnVuY3RvckUAqHoAAAgrAABQMTFtYXhpU3RyZXRjaEkxNGhhbm5XaW5GdW5jdG9yRQAAAACIewAAMCsAAAAAAAAoKwAAUEsxMW1heGlTdHJldGNoSTE0aGFubldpbkZ1bmN0b3JFAAAAiHsAAGQrAAABAAAAKCsAAFQrAACweQAAVCsAAIQYAABMegAAVCsAALB5AABUKwAATHoAADR6AABUKwBB0NcACyRMegAAVCsAAEx6AABMegAATHoAABB6AABMegAAZGlpZGRkaWQAQYDYAAviA0x6AABUKwAATHoAAEx6AABMegAAEHoAAGRpaWRkZGkAOG1heGlCaXRzAAAAqHoAACAsAABQOG1heGlCaXRzAACIewAANCwAAAAAAAAsLAAAUEs4bWF4aUJpdHMAiHsAAFAsAAABAAAALCwAABx6AAAcegAAHHoAABx6AAAcegAAHHoAABx6AAAcegAAHHoAABx6AABMegAAHHoAABx6AABMegAAaWlkADExbWF4aVRyaWdnZXIAAACoegAAqCwAAFAxMW1heGlUcmlnZ2VyAACIewAAwCwAAAAAAAC4LAAAUEsxMW1heGlUcmlnZ2VyAIh7AADgLAAAAQAAALgsAADQLAAATHoAANAsAABMegAATHoAANAsAABMegAATHoAADExbWF4aUNvdW50ZXIAAACoegAAIC0AAFAxMW1heGlDb3VudGVyAACIewAAOC0AAAAAAAAwLQAAUEsxMW1heGlDb3VudGVyAIh7AABYLQAAAQAAADAtAABILQAAAAAAAEx6AABILQAATHoAAEx6AAA5bWF4aUluZGV4AACoegAAkC0AAFA5bWF4aUluZGV4AIh7AACkLQAAAAAAAJwtAABQSzltYXhpSW5kZXgAAAAAiHsAAMAtAAABAAAAnC0AALAtAEHw2wAL5wdMegAAsC0AAEx6AABMegAA0A0AAApjaGFubmVscyA9ICVkCmxlbmd0aCA9ICVkAExvYWRpbmc6IABkYXRhAENoOiAALCBsZW46IABFUlJPUjogQ291bGQgbm90IGxvYWQgc2FtcGxlLgBBdXRvdHJpbTogc3RhcnQ6IAAsIGVuZDogAABsAAAAAAAAAAQvAABMAgAATQIAAJT///+U////BC8AAE4CAABPAgAAgC4AALguAADMLgAAlC4AAGwAAAAAAAAANEkAAFACAABRAgAAlP///5T///80SQAAUgIAAFMCAABOU3QzX18yMTRiYXNpY19pZnN0cmVhbUljTlNfMTFjaGFyX3RyYWl0c0ljRUVFRQDQegAA1C4AADRJAAAAAAAAgC8AAFQCAABVAgAAVgIAAFcCAABYAgAAWQIAAFoCAABbAgAAXAIAAF0CAABeAgAAXwIAAGACAABhAgAATlN0M19fMjEzYmFzaWNfZmlsZWJ1ZkljTlNf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A/T//05TdDNfXzIxM2Jhc2ljX2lzdHJlYW1Jd05TXzExY2hhcl90cmFpdHNJd0VFRUUAACx7AABMSQAAAAAAAAEAAACASAAAA/T//05TdDNfXzIxM2Jhc2ljX29zdHJlYW1JY05TXzExY2hhcl90cmFpdHNJY0VFRUUAACx7AACUSQAAAAAAAAEAAAA4SAAAA/T//05TdDNfXzIxM2Jhc2ljX29zdHJlYW1Jd05TXzExY2hhcl90cmFpdHNJd0VFRUUAACx7AADcSQAAAAAAAAEAAACASAAAA/T//5i2AAAAAAAAgEoAAG0CAACYAgAAmQIAAHACAABxAgAAcgIAAHMCAABbAgAAXAIAAJoCAACbAgAAnAIAAGACAAB2AgAATlN0M19fMjEwX19zdGRpbmJ1ZkljRUUA0HoAAGhKAADASAAAdW5zdXBwb3J0ZWQgbG9jYWxlIGZvciBzdGFuZGFyZCBpbnB1dAAAAAAAAAAMSwAAdwIAAJ0CAACeAgAAegIAAHsCAAB8AgAAfQIAAH4CAAB/AgAAnwIAAKACAAChAgAAgwIAAIQCAABOU3QzX18yMTBfX3N0ZGluYnVmSXdFRQDQegAA9EoAAPxIAAAAAAAAdEsAAG0CAACiAgAAowIAAHACAABxAgAAcgIAAKQCAABbAgAAXAIAAHQCAABeAgAAdQIAAKUCAACmAgAATlN0M19fMjExX19zdGRvdXRidWZJY0VFAAAAANB6AABYSwAAwEgAAAAAAADcSwAAdwIAAKcCAACoAgAAegIAAHsCAAB8AgAAqQIAAH4CAAB/AgAAgAIAAIECAACCAgAAqgIAAKsCAABOU3QzX18yMTFfX3N0ZG91dGJ1Zkl3RUUAAAAA0HoAAMBLAAD8SABB8JcBC+gD/////////////////////////////////////////////////////////////////wABAgMEBQYHCAn/////////CgsMDQ4PEBESExQVFhcYGRobHB0eHyAhIiP///////8KCwwNDg8QERITFBUWFxgZGhscHR4fICEiI/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////8AAQIEBwMGBQAAAAAAAAACAADAAwAAwAQAAMAFAADABgAAwAcAAMAIAADACQAAwAoAAMALAADADAAAwA0AAMAOAADADwAAwBAAAMARAADAEgAAwBMAAMAUAADAFQAAwBYAAMAXAADAGAAAwBkAAMAaAADAGwAAwBwAAMAdAADAHgAAwB8AAMAAAACzAQAAwwIAAMMDAADDBAAAwwUAAMMGAADDBwAAwwgAAMMJAADDCgAAwwsAAMMMAADDDQAA0w4AAMMPAADDAAAMuwEADMMCAAzDAwAMwwQADNNpbmZpbml0eQBuYW4AQeCbAQtI0XSeAFedvSqAcFIP//8+JwoAAABkAAAA6AMAABAnAACghgEAQEIPAICWmAAA4fUFGAAAADUAAABxAAAAa////877//+Sv///AEGwnAELI94SBJUAAAAA////////////////ME4AABQAAABDLlVURi04AEH4nAELAkROAEGQnQELBkxDX0FMTABBoJ0BC25MQ19DVFlQRQAAAABMQ19OVU1FUklDAABMQ19USU1FAAAAAABMQ19DT0xMQVRFAABMQ19NT05FVEFSWQBMQ19NRVNTQUdFUwBMQU5HAEMuVVRGLTgAUE9TSVgATVVTTF9MT0NQQVRIAAAAAAAQUABBkKABC/8BAgACAAIAAgACAAIAAgACAAIAAyACIAIgAiACIAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAFgBMAEwATABMAEwATABMAEwATABMAEwATABMAEwATACNgI2AjYCNgI2AjYCNgI2AjYCNgEwATABMAEwATABMAEwAjVCNUI1QjVCNUI1QjFCMUIxQjFCMUIxQjFCMUIxQjFCMUIxQjFCMUIxQjFCMUIxQjFCMUEwATABMAEwATABMAI1gjWCNYI1gjWCNYIxgjGCMYIxgjGCMYIxgjGCMYIxgjGCMYIxgjGCMYIxgjGCMYIxgjGBMAEwATABMACAEGQpAELAiBUAEGkqAEL+QMBAAAAAgAAAAMAAAAEAAAABQAAAAYAAAAHAAAACAAAAAkAAAAKAAAACwAAAAwAAAANAAAADgAAAA8AAAAQAAAAEQAAABIAAAATAAAAFAAAABUAAAAWAAAAFwAAABgAAAAZAAAAGgAAABsAAAAcAAAAHQAAAB4AAAAfAAAAIAAAACEAAAAiAAAAIwAAACQAAAAlAAAAJgAAACcAAAAoAAAAKQAAACoAAAArAAAALAAAAC0AAAAuAAAALwAAADAAAAAxAAAAMgAAADMAAAA0AAAANQAAADYAAAA3AAAAOAAAADkAAAA6AAAAOwAAADwAAAA9AAAAPgAAAD8AAABAAAAAQQAAAEIAAABDAAAARAAAAEUAAABGAAAARwAAAEgAAABJAAAASgAAAEsAAABMAAAATQAAAE4AAABPAAAAUAAAAFEAAABSAAAAUwAAAFQAAABVAAAAVgAAAFcAAABYAAAAWQAAAFoAAABbAAAAXAAAAF0AAABeAAAAXwAAAGAAAABBAAAAQgAAAEMAAABEAAAARQAAAEYAAABHAAAASAAAAEkAAABKAAAASwAAAEwAAABNAAAATgAAAE8AAABQAAAAUQAAAFIAAABTAAAAVAAAAFUAAABWAAAAVwAAAFgAAABZAAAAWgAAAHsAAAB8AAAAfQAAAH4AAAB/AEGgsAELAjBaAEG0tAEL+QMBAAAAAgAAAAMAAAAEAAAABQAAAAYAAAAHAAAACAAAAAkAAAAKAAAACwAAAAwAAAANAAAADgAAAA8AAAAQAAAAEQAAABIAAAATAAAAFAAAABUAAAAWAAAAFwAAABgAAAAZAAAAGgAAABsAAAAcAAAAHQAAAB4AAAAfAAAAIAAAACEAAAAiAAAAIwAAACQAAAAlAAAAJgAAACcAAAAoAAAAKQAAACoAAAArAAAALAAAAC0AAAAuAAAALwAAADAAAAAxAAAAMgAAADMAAAA0AAAANQAAADYAAAA3AAAAOAAAADkAAAA6AAAAOwAAADwAAAA9AAAAPgAAAD8AAABAAAAAYQAAAGIAAABjAAAAZAAAAGUAAABmAAAAZwAAAGgAAABpAAAAagAAAGsAAABsAAAAbQAAAG4AAABvAAAAcAAAAHEAAAByAAAAcwAAAHQAAAB1AAAAdgAAAHcAAAB4AAAAeQAAAHoAAABbAAAAXAAAAF0AAABeAAAAXwAAAGAAAABhAAAAYgAAAGMAAABkAAAAZQAAAGYAAABnAAAAaAAAAGkAAABqAAAAawAAAGwAAABtAAAAbgAAAG8AAABwAAAAcQAAAHIAAABzAAAAdAAAAHUAAAB2AAAAdwAAAHgAAAB5AAAAegAAAHsAAAB8AAAAfQAAAH4AAAB/AEGwvAELSDAxMjM0NTY3ODlhYmNkZWZBQkNERUZ4WCstcFBpSW5OACVwAGwAbGwAAEwAJQAAAAAAJXAAAAAAJUk6JU06JVMgJXAlSDolTQBBgL0BC4EBJQAAAG0AAAAvAAAAJQAAAGQAAAAvAAAAJQAAAHkAAAAlAAAAWQAAAC0AAAAlAAAAbQAAAC0AAAAlAAAAZAAAACUAAABJAAAAOgAAACUAAABNAAAAOgAAACUAAABTAAAAIAAAACUAAABwAAAAAAAAACUAAABIAAAAOgAAACUAAABNAEGQvgELvQQlAAAASAAAADoAAAAlAAAATQAAADoAAAAlAAAAUwAAACVMZgAwMTIzNDU2Nzg5ACUuMExmAEMAAAAAAAC4ZAAAvwIAAMACAADBAgAAAAAAABhlAADCAgAAwwIAAMECAADEAgAAxQIAAMYCAADHAgAAyAIAAMkCAADKAgAAywIAAAAAAACAZAAAzAIAAM0CAADBAgAAzgIAAM8CAADQAgAA0QIAANICAADTAgAA1AIAAAAAAABQZQAA1QIAANYCAADBAgAA1wIAANgCAADZAgAA2gIAANsCAAAAAAAAdGUAANwCAADdAgAAwQIAAN4CAADfAgAA4AIAAOECAADiAgAAdHJ1ZQAAAAB0AAAAcgAAAHUAAABlAAAAAAAAAGZhbHNlAAAAZgAAAGEAAABsAAAAcwAAAGUAAAAAAAAAJW0vJWQvJXkAAAAAJQAAAG0AAAAvAAAAJQAAAGQAAAAvAAAAJQAAAHkAAAAAAAAAJUg6JU06JVMAAAAAJQAAAEgAAAA6AAAAJQAAAE0AAAA6AAAAJQAAAFMAAAAAAAAAJWEgJWIgJWQgJUg6JU06JVMgJVkAAAAAJQAAAGEAAAAgAAAAJQAAAGIAAAAgAAAAJQAAAGQAAAAgAAAAJQAAAEgAAAA6AAAAJQAAAE0AAAA6AAAAJQAAAFMAAAAgAAAAJQAAAFkAAAAAAAAAJUk6JU06JVMgJXAAJQAAAEkAAAA6AAAAJQAAAE0AAAA6AAAAJQAAAFMAAAAgAAAAJQAAAHAAQdjCAQvWCoBhAADjAgAA5AIAAMECAABOU3QzX18yNmxvY2FsZTVmYWNldEUAAADQegAAaGEAAKx2AAAAAAAAAGIAAOMCAADlAgAAwQIAAOYCAADnAgAA6AIAAOkCAADqAgAA6wIAAOwCAADtAgAA7gIAAO8CAADwAgAA8QIAAE5TdDNfXzI1Y3R5cGVJd0VFAE5TdDNfXzIxMGN0eXBlX2Jhc2VFAACoegAA4mEAACx7AADQYQAAAAAAAAIAAACAYQAAAgAAAPhhAAACAAAAAAAAAJRiAADjAgAA8gIAAMECAADzAgAA9AIAAPUCAAD2AgAA9wIAAPgCAAD5AgAATlN0M19fMjdjb2RlY3Z0SWNjMTFfX21ic3RhdGVfdEVFAE5TdDNfXzIxMmNvZGVjdnRfYmFzZUUAAAAAqHoAAHJiAAAsewAAUGIAAAAAAAACAAAAgGEAAAIAAACMYgAAAgAAAAAAAAAIYwAA4wIAAPoCAADBAgAA+wIAAPwCAAD9AgAA/gIAAP8CAAAAAwAAAQMAAE5TdDNfXzI3Y29kZWN2dElEc2MxMV9fbWJzdGF0ZV90RUUAACx7AADkYgAAAAAAAAIAAACAYQAAAgAAAIxiAAACAAAAAAAAAHxjAADjAgAAAgMAAMECAAADAwAABAMAAAUDAAAGAwAABwMAAAgDAAAJAwAATlN0M19fMjdjb2RlY3Z0SURpYzExX19tYnN0YXRlX3RFRQAALHsAAFhjAAAAAAAAAgAAAIBhAAACAAAAjGIAAAIAAAAAAAAA8GMAAOMCAAAKAwAAwQIAAAMDAAAEAwAABQMAAAYDAAAHAwAACAMAAAkDAABOU3QzX18yMTZfX25hcnJvd190b191dGY4SUxtMzJFRUUAAADQegAAzGMAAHxjAAAAAAAAUGQAAOMCAAALAwAAwQIAAAMDAAAEAwAABQMAAAYDAAAHAwAACAMAAAkDAABOU3QzX18yMTdfX3dpZGVuX2Zyb21fdXRmOElMbTMyRUVFAADQegAALGQAAHxjAABOU3QzX18yN2NvZGVjdnRJd2MxMV9fbWJzdGF0ZV90RUUAAAAsewAAXGQAAAAAAAACAAAAgGEAAAIAAACMYgAAAgAAAE5TdDNfXzI2bG9jYWxlNV9faW1wRQAAANB6AACgZAAAgGEAAE5TdDNfXzI3Y29sbGF0ZUljRUUA0HoAAMRkAACAYQAATlN0M19fMjdjb2xsYXRlSXdFRQDQegAA5GQAAIBhAABOU3QzX18yNWN0eXBlSWNFRQAAACx7AAAEZQAAAAAAAAIAAACAYQAAAgAAAPhhAAACAAAATlN0M19fMjhudW1wdW5jdEljRUUAAAAA0HoAADhlAACAYQAATlN0M19fMjhudW1wdW5jdEl3RUUAAAAA0HoAAFxlAACAYQAAAAAAANhkAAAMAwAADQMAAMECAAAOAwAADwMAABADAAAAAAAA+GQAABEDAAASAwAAwQIAABMDAAAUAwAAFQMAAAAAAACUZgAA4wIAABYDAADBAgAAFwMAABgDAAAZAwAAGgMAABsDAAAcAwAAHQMAAB4DAAAfAwAAIAMAACEDAABOU3QzX18yN251bV9nZXRJY05TXzE5aXN0cmVhbWJ1Zl9pdGVyYXRvckljTlNfMTFjaGFyX3RyYWl0c0ljRUVFRUVFAE5TdDNfXzI5X19udW1fZ2V0SWNFRQBOU3QzX18yMTRfX251bV9nZXRfYmFzZUUAAKh6AABaZgAALHsAAERmAAAAAAAAAQAAAHRmAAAAAAAALHsAAABmAAAAAAAAAgAAAIBhAAACAAAAfGYAQbjNAQvKAWhnAADjAgAAIgMAAMECAAAjAwAAJAMAACUDAAAmAwAAJwMAACgDAAApAwAAKgMAACsDAAAsAwAALQMAAE5TdDNfXzI3bnVtX2dldEl3TlNfMTlpc3RyZWFtYnVmX2l0ZXJhdG9ySXdOU18xMWNoYXJfdHJhaXRzSXdFRUVFRUUATlN0M19fMjlfX251bV9nZXRJd0VFAAAALHsAADhnAAAAAAAAAQAAAHRmAAAAAAAALHsAAPRmAAAAAAAAAgAAAIBhAAACAAAAUGcAQYzPAQveAVBoAADjAgAALgMAAMECAAAvAwAAMAMAADEDAAAyAwAAMwMAADQDAAA1AwAANgMAAE5TdDNfXzI3bnVtX3B1dEljTlNfMTlvc3RyZWFtYnVmX2l0ZXJhdG9ySWNOU18xMWNoYXJfdHJhaXRzSWNFRUVFRUUATlN0M19fMjlfX251bV9wdXRJY0VFAE5TdDNfXzIxNF9fbnVtX3B1dF9iYXNlRQAAqHoAABZoAAAsewAAAGgAAAAAAAABAAAAMGgAAAAAAAAsewAAvGcAAAAAAAACAAAAgGEAAAIAAAA4aABB9NABC74BGGkAAOMCAAA3AwAAwQIAADgDAAA5AwAAOgMAADsDAAA8AwAAPQMAAD4DAAA/AwAATlN0M19fMjdudW1fcHV0SXdOU18xOW9zdHJlYW1idWZfaXRlcmF0b3JJd05TXzExY2hhcl90cmFpdHNJd0VFRUVFRQBOU3QzX18yOV9fbnVtX3B1dEl3RUUAAAAsewAA6GgAAAAAAAABAAAAMGgAAAAAAAAsewAApGgAAAAAAAACAAAAgGEAAAIAAAAAaQBBvNIBC5oLGGoAAEADAABBAwAAwQIAAEIDAABDAwAARAMAAEUDAABGAwAARwMAAEgDAAD4////GGoAAEkDAABKAwAASwMAAEwDAABNAwAATgMAAE8DAABOU3QzX18yOHRpbWVfZ2V0SWNOU18xOWlzdHJlYW1idWZfaXRlcmF0b3JJY05TXzExY2hhcl90cmFpdHNJY0VFRUVFRQBOU3QzX18yOXRpbWVfYmFzZUUAqHoAANFpAABOU3QzX18yMjBfX3RpbWVfZ2V0X2Nfc3RvcmFnZUljRUUAAACoegAA7GkAACx7AACMaQAAAAAAAAMAAACAYQAAAgAAAORpAAACAAAAEGoAAAAIAAAAAAAABGsAAFADAABRAwAAwQIAAFIDAABTAwAAVAMAAFUDAABWAwAAVwMAAFgDAAD4////BGsAAFkDAABaAwAAWwMAAFwDAABdAwAAXgMAAF8DAABOU3QzX18yOHRpbWVfZ2V0SXdOU18xOWlzdHJlYW1idWZfaXRlcmF0b3JJd05TXzExY2hhcl90cmFpdHNJd0VFRUVFRQBOU3QzX18yMjBfX3RpbWVfZ2V0X2Nfc3RvcmFnZUl3RUUAAKh6AADZagAALHsAAJRqAAAAAAAAAwAAAIBhAAACAAAA5GkAAAIAAAD8agAAAAgAAAAAAACoawAAYAMAAGEDAADBAgAAYgMAAE5TdDNfXzI4dGltZV9wdXRJY05TXzE5b3N0cmVhbWJ1Zl9pdGVyYXRvckljTlNfMTFjaGFyX3RyYWl0c0ljRUVFRUVFAE5TdDNfXzIxMF9fdGltZV9wdXRFAAAAqHoAAIlrAAAsewAARGsAAAAAAAACAAAAgGEAAAIAAACgawAAAAgAAAAAAAAobAAAYwMAAGQDAADBAgAAZQMAAE5TdDNfXzI4dGltZV9wdXRJd05TXzE5b3N0cmVhbWJ1Zl9pdGVyYXRvckl3TlNfMTFjaGFyX3RyYWl0c0l3RUVFRUVFAAAAACx7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AAA8egAAZAAAAGR5AABIegAAAAAAAJR6AACtAwAAsgMAAK8DAACwAwAAswMAAE4xMF9fY3h4YWJpdjExNl9fZW51bV90eXBlX2luZm9FAAAAANB6AABwegAAUHgAAAAAAACAeAAArQMAALQDAACvAwAAsAMAALUDAAC2AwAAtwMAALgDAAAAAAAAGHsAAK0DAAC5AwAArwMAALADAAC1AwAAugMAALsDAAC8AwAATjEwX19jeHhhYml2MTIwX19zaV9jbGFzc190eXBlX2luZm9FAAAAANB6AADwegAAgHgAAAAAAAB0ewAArQMAAL0DAACvAwAAsAMAALUDAAC+AwAAvwMAAMADAABOMTBfX2N4eGFiaXYxMjFfX3ZtaV9jbGFzc190eXBlX2luZm9FAAAA0HoAAEx7AACAeAAAAAAAAOB4AACtAwAAwQMAAK8DAACwAwAAwgMAAHZvaWQAYm9vbABjaGFyAHNpZ25lZCBjaGFyAHVuc2lnbmVkIGNoYXIAc2hvcnQAdW5zaWduZWQgc2hvcnQAaW50AHVuc2lnbmVkIGludABsb25nAHVuc2lnbmVkIGxvbmcAZmxvYXQAZG91YmxlAHN0ZDo6c3RyaW5nAHN0ZDo6YmFzaWNfc3RyaW5nPHVuc2lnbmVkIGNoYXI+AHN0ZDo6d3N0cmluZwBlbXNjcmlwdGVuOjp2YWwAZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8Y2hhcj4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8c2lnbmVkIGNoYXI+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHVuc2lnbmVkIGNoYXI+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHNob3J0PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzx1bnNpZ25lZCBzaG9ydD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8aW50PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzx1bnNpZ25lZCBpbnQ+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PGxvbmc+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHVuc2lnbmVkIGxvbmc+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PGludDhfdD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8dWludDhfdD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8aW50MTZfdD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8dWludDE2X3Q+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PGludDMyX3Q+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHVpbnQzMl90PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxmbG9hdD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8ZG91YmxlPgBOU3QzX18yMTJiYXNpY19zdHJpbmdJaE5TXzExY2hhcl90cmFpdHNJaEVFTlNfOWFsbG9jYXRvckloRUVFRQAALHsAAJR+AAAAAAAAAQAAANgZAAAAAAAATlN0M19fMjEyYmFzaWNfc3RyaW5nSXdOU18xMWNoYXJfdHJhaXRzSXdFRU5TXzlhbGxvY2F0b3JJd0VFRUUAACx7AADsfgAAAAAAAAEAAADYGQAAAAAAAE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SWNFRQAAqHoAAER/AABOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0lhRUUAAKh6AABsfwAATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJaEVFAACoegAAlH8AAE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SXNFRQAAqHoAALx/AABOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0l0RUUAAKh6AADkfwAATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJaUVFAACoegAADIAAAE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SWpFRQAAqHoAADSAAABOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0lsRUUAAKh6AABcgAAATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJbUVFAACoegAAhIAAAE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SWZFRQAAqHoAAKyAAABOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0lkRUUAAKh6AADUgABBgoICCwyAP0SsAAACAAAAAAQAQZiCAgv4D59yTBb3H4k/n3JMFvcfmT/4VblQ+deiP/zHQnQIHKk/pOTVOQZkrz+eCrjn+dOyP6DDfHkB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';
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




// STATICTOP = STATIC_BASE + 52880;
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
          throw new Error(0);
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
          node.contents = new Uint8Array(new ArrayBuffer(newSize)); // Allocate new storage.
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
              node.contents = new Uint8Array(buffer.subarray(offset, offset + length));
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
        var err = FS.mayLookup(parent);
        if (err) {
          throw new FS.ErrnoError(err, parent);
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
        var err = FS.nodePermissions(dir, 'x');
        if (err) return err;
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
        var err = FS.nodePermissions(dir, 'wx');
        if (err) {
          return err;
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
  
        function doCallback(err) {
          FS.syncFSRequests--;
          return callback(err);
        }
  
        function done(err) {
          if (err) {
            if (!done.errored) {
              done.errored = true;
              return doCallback(err);
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
        var err = FS.mayCreate(parent, name);
        if (err) {
          throw new FS.ErrnoError(err);
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
        var err = FS.mayCreate(parent, newname);
        if (err) {
          throw new FS.ErrnoError(err);
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
        var err = FS.mayDelete(old_dir, old_name, isdir);
        if (err) {
          throw new FS.ErrnoError(err);
        }
        // need delete permissions if we'll be overwriting.
        // need create permissions if new doesn't already exist.
        err = new_node ?
          FS.mayDelete(new_dir, new_name, isdir) :
          FS.mayCreate(new_dir, new_name);
        if (err) {
          throw new FS.ErrnoError(err);
        }
        if (!old_dir.node_ops.rename) {
          throw new FS.ErrnoError(63);
        }
        if (FS.isMountpoint(old_node) || (new_node && FS.isMountpoint(new_node))) {
          throw new FS.ErrnoError(10);
        }
        // if we are going to change the parent, check write permissions
        if (new_dir !== old_dir) {
          err = FS.nodePermissions(old_dir, 'w');
          if (err) {
            throw new FS.ErrnoError(err);
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
        var err = FS.mayDelete(parent, name, true);
        if (err) {
          throw new FS.ErrnoError(err);
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
        var err = FS.mayDelete(parent, name, false);
        if (err) {
          // According to POSIX, we should map EISDIR to EPERM, but
          // we instead do what Linux does (and we must, as we use
          // the musl linux libc).
          throw new FS.ErrnoError(err);
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
        var err = FS.nodePermissions(node, 'w');
        if (err) {
          throw new FS.ErrnoError(err);
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
          var err = FS.mayOpen(node, flags);
          if (err) {
            throw new FS.ErrnoError(err);
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
        var err = FS.nodePermissions(lookup.node, 'x');
        if (err) {
          throw new FS.ErrnoError(err);
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
        var buffer = new Uint8Array(HEAPU8.subarray(addr, addr + len));
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
      // nb. do not cache HEAPU16 and HEAPU32, they may be destroyed by emscripten_resize_heap().
      name = readLatin1String(name);
      var getHeap, shift;
      if (charSize === 2) {
          getHeap = function() { return HEAPU16; };
          shift = 1;
      } else if (charSize === 4) {
          getHeap = function() { return HEAPU32; };
          shift = 2;
      }
      registerType(rawType, {
          name: name,
          'fromWireType': function(value) {
              var HEAP = getHeap();
              var length = HEAPU32[value >> 2];
              var a = new Array(length);
              var start = (value + 4) >> shift;
              for (var i = 0; i < length; ++i) {
                  a[i] = String.fromCharCode(HEAP[start + i]);
              }
              _free(value);
              return a.join('');
          },
          'toWireType': function(destructors, value) {
              // assumes 4-byte alignment
              var length = value.length;
              var ptr = _malloc(4 + length * charSize);
              var HEAP = getHeap();
              HEAPU32[ptr >> 2] = length;
              var start = (ptr + 4) >> shift;
              for (var i = 0; i < length; ++i) {
                  HEAP[start + i] = value.charCodeAt(i);
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
      return HEAP8.length;
    }

  function _emscripten_get_sbrk_ptr() {
      return 53744;
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

  
  
  var ENV={};function _emscripten_get_environ() {
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
          '_': thisProgram
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
var dynCall_diddd = Module["dynCall_diddd"] = asm["dynCall_diddd"];
var dynCall_didd = Module["dynCall_didd"] = asm["dynCall_didd"];
var dynCall_di = Module["dynCall_di"] = asm["dynCall_di"];
var dynCall_vid = Module["dynCall_vid"] = asm["dynCall_vid"];
var dynCall_diii = Module["dynCall_diii"] = asm["dynCall_diii"];
var dynCall_viid = Module["dynCall_viid"] = asm["dynCall_viid"];
var dynCall_dii = Module["dynCall_dii"] = asm["dynCall_dii"];
var dynCall_didid = Module["dynCall_didid"] = asm["dynCall_didid"];
var dynCall_dididi = Module["dynCall_dididi"] = asm["dynCall_dididi"];
var dynCall_vidid = Module["dynCall_vidid"] = asm["dynCall_vidid"];
var dynCall_vididd = Module["dynCall_vididd"] = asm["dynCall_vididd"];
var dynCall_vididdd = Module["dynCall_vididdd"] = asm["dynCall_vididdd"];
var dynCall_viddd = Module["dynCall_viddd"] = asm["dynCall_viddd"];
var dynCall_viiid = Module["dynCall_viiid"] = asm["dynCall_viiid"];
var dynCall_iiiid = Module["dynCall_iiiid"] = asm["dynCall_iiiid"];
var dynCall_dddd = Module["dynCall_dddd"] = asm["dynCall_dddd"];
var dynCall_vidd = Module["dynCall_vidd"] = asm["dynCall_vidd"];
var dynCall_iiii = Module["dynCall_iiii"] = asm["dynCall_iiii"];
var dynCall_viffii = Module["dynCall_viffii"] = asm["dynCall_viffii"];
var dynCall_dddddd = Module["dynCall_dddddd"] = asm["dynCall_dddddd"];
var dynCall_diddddd = Module["dynCall_diddddd"] = asm["dynCall_diddddd"];
var dynCall_diddidd = Module["dynCall_diddidd"] = asm["dynCall_diddidd"];
var dynCall_didddii = Module["dynCall_didddii"] = asm["dynCall_didddii"];
var dynCall_didddddii = Module["dynCall_didddddii"] = asm["dynCall_didddddii"];
var dynCall_didi = Module["dynCall_didi"] = asm["dynCall_didi"];
var dynCall_dd = Module["dynCall_dd"] = asm["dynCall_dd"];
var dynCall_dididdd = Module["dynCall_dididdd"] = asm["dynCall_dididdd"];
var dynCall_ddd = Module["dynCall_ddd"] = asm["dynCall_ddd"];
var dynCall_diddi = Module["dynCall_diddi"] = asm["dynCall_diddi"];
var dynCall_vidi = Module["dynCall_vidi"] = asm["dynCall_vidi"];
var dynCall_iifi = Module["dynCall_iifi"] = asm["dynCall_iifi"];
var dynCall_fi = Module["dynCall_fi"] = asm["dynCall_fi"];
var dynCall_fiiii = Module["dynCall_fiiii"] = asm["dynCall_fiiii"];
var dynCall_viiiidd = Module["dynCall_viiiidd"] = asm["dynCall_viiiidd"];
var dynCall_diid = Module["dynCall_diid"] = asm["dynCall_diid"];
var dynCall_diiddd = Module["dynCall_diiddd"] = asm["dynCall_diiddd"];
var dynCall_diidd = Module["dynCall_diidd"] = asm["dynCall_diidd"];
var dynCall_diiii = Module["dynCall_diiii"] = asm["dynCall_diiii"];
var dynCall_diidid = Module["dynCall_diidid"] = asm["dynCall_diidid"];
var dynCall_diididi = Module["dynCall_diididi"] = asm["dynCall_diididi"];
var dynCall_viidid = Module["dynCall_viidid"] = asm["dynCall_viidid"];
var dynCall_viididd = Module["dynCall_viididd"] = asm["dynCall_viididd"];
var dynCall_viididdd = Module["dynCall_viididdd"] = asm["dynCall_viididdd"];
var dynCall_viiddd = Module["dynCall_viiddd"] = asm["dynCall_viiddd"];
var dynCall_viidd = Module["dynCall_viidd"] = asm["dynCall_viidd"];
var dynCall_iiiii = Module["dynCall_iiiii"] = asm["dynCall_iiiii"];
var dynCall_viiffii = Module["dynCall_viiffii"] = asm["dynCall_viiffii"];
var dynCall_diiddidd = Module["dynCall_diiddidd"] = asm["dynCall_diiddidd"];
var dynCall_diiddddd = Module["dynCall_diiddddd"] = asm["dynCall_diiddddd"];
var dynCall_diidddii = Module["dynCall_diidddii"] = asm["dynCall_diidddii"];
var dynCall_diidddddii = Module["dynCall_diidddddii"] = asm["dynCall_diidddddii"];
var dynCall_diidi = Module["dynCall_diidi"] = asm["dynCall_diidi"];
var dynCall_diididdd = Module["dynCall_diididdd"] = asm["dynCall_diididdd"];
var dynCall_diiddi = Module["dynCall_diiddi"] = asm["dynCall_diiddi"];
var dynCall_viidi = Module["dynCall_viidi"] = asm["dynCall_viidi"];
var dynCall_viiiii = Module["dynCall_viiiii"] = asm["dynCall_viiiii"];
var dynCall_iiifi = Module["dynCall_iiifi"] = asm["dynCall_iiifi"];
var dynCall_fii = Module["dynCall_fii"] = asm["dynCall_fii"];
var dynCall_fiiiii = Module["dynCall_fiiiii"] = asm["dynCall_fiiiii"];
var dynCall_viiiiidd = Module["dynCall_viiiiidd"] = asm["dynCall_viiiiidd"];
var dynCall_viif = Module["dynCall_viif"] = asm["dynCall_viif"];
var dynCall_viiif = Module["dynCall_viiif"] = asm["dynCall_viiif"];
var dynCall_iiiif = Module["dynCall_iiiif"] = asm["dynCall_iiiif"];
var dynCall_diddid = Module["dynCall_diddid"] = asm["dynCall_diddid"];
var dynCall_didddid = Module["dynCall_didddid"] = asm["dynCall_didddid"];
var dynCall_didddi = Module["dynCall_didddi"] = asm["dynCall_didddi"];
var dynCall_diiddid = Module["dynCall_diiddid"] = asm["dynCall_diiddid"];
var dynCall_diidddid = Module["dynCall_diidddid"] = asm["dynCall_diidddid"];
var dynCall_diidddi = Module["dynCall_diidddi"] = asm["dynCall_diidddi"];
var dynCall_iid = Module["dynCall_iid"] = asm["dynCall_iid"];
var dynCall_id = Module["dynCall_id"] = asm["dynCall_id"];
var dynCall_v = Module["dynCall_v"] = asm["dynCall_v"];
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
	"running%c Maximilian v2.0.2 (Wasm)",
	"font-weight: bold; background: #222; color: #bada55"
);



//NOTE: This is the main thing that post.js adds to Maximilian setup, a Module export definition which is required for the WASM design pattern
export default Module;

