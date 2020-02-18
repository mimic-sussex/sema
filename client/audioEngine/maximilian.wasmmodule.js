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
  'initial': 951,
  'maximum': 951 + 0,
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
    STACK_BASE = 5296560,
    STACKTOP = STACK_BASE,
    STACK_MAX = 53680,
    DYNAMIC_BASE = 5296560,
    DYNAMICTOP_PTR = 53520;




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




var wasmBinaryFile = 'data:application/octet-stream;base64,AGFzbQEAAAABnQuqAWABfwF/YAABf2ACf38AYAJ/fwF/YAF/AGADf39/AX9gA39/fwBgBn9/f39/fwF/YAR/f39/AX9gAABgBn9/f39/fwBgBX9/f39/AX9gBH9/f38AYAJ/fABgCH9/f39/f39/AX9gBX9/f39/AGABfwF8YAJ/fAF8YAF9AX1gA398fAF8YAJ8fAF8YAd/f39/f39/AX9gAXwBfGAHf39/f39/fwBgAn9/AXxgBH98fHwBfGADf39/AXxgA39/fABgBX9+fn5+AGABfwF9YAZ/fHx8fHwBfGAEf39/fABgAAF+YAN/fn8BfmAEf3x8fwF8YAV8fHx8fAF8YAp/f39/f39/f39/AGAFf39+f38AYAV/f39/fgF/YAJ/fwF9YAN8fHwBfGADf3x/AGADf3x8AGAHf39/f39+fgF/YAV/f39/fAF/YAR/f39/AX5gBX9/fHx/AXxgBn98f3x8fAF8YAV/fHx/fAF8YAV/fHx8fwF8YAh/f39/f39/fwBgBH9/f30AYAZ/f319f38AYAR/f3x/AGAFf398f3wAYAZ/f3x/fHwAYAd/f3x/fHx8AGAEf398fABgBX9/fHx8AGAEf35+fwBgAn99AGAFf319f38AYAR/fH98AGAFf3x/fHwAYAZ/fH98fHwAYAR/fHx8AGAKf39/f39/f39/fwF/YAZ/f39/fn4Bf2AEf39/fAF/YAR/f31/AX9gA39+fwF/YAN/fX8Bf2ACf3wBf2AGf3x/f39/AX9gAXwBf2ABfwF+YAN/f38BfWAEf39/fwF9YAV/f39/fwF9YAJ9fwF9YAR/f39/AXxgA39/fAF8YAR/f3x/AXxgBX9/fH98AXxgBn9/fH98fwF8YAd/f3x/fHx8AXxgBH9/fHwBfGAGf398fH98AXxgB39/fHx/fHwBfGAFf398fHwBfGAGf398fHx/AXxgB39/fHx8f38BfGAHf398fHx/fAF8YAd/f3x8fHx8AXxgCX9/fHx8fHx/fwF8YAN/fH8BfGAEf3x/fAF8YAV/fH98fwF8YAZ/fHx/fHwBfGAGf3x8fH9/AXxgBn98fHx/fAF8YAh/fHx8fHx/fwF8YAJ8fwF8YA9/f39/f39/f39/f39/f38AYAN/f30AYAl/f39/f39/f38Bf2ALf39/f39/f39/f38Bf2AMf39/f39/f39/f39/AX9gBH9/f30Bf2ACfn8Bf2AEfn5+fgF/YAN/f38BfmAEf39/fgF+YAJ9fQF9YAF8AX1gA3x8fwF8YAx/f39/f39/f39/f38AYA1/f39/f39/f39/f39/AGAFf39/f30AYAV/f39/fABgBn9/f35/fwBgB39/f319f38AYAV/f398fwBgBn9/f3x/fABgB39/f3x/fHwAYAh/f398f3x8fABgBX9/f3x8AGAGf39/fHx8AGADf39+AGACf34AYAN/fX0AYAh/f39/f39+fgF/YAZ/f39/f34Bf2AGf39/f398AX9gBX9/f399AX9gBX9/f31/AX9gA39/fAF/YAd/f3x/f39/AX9gBn9/fHx8fwF/YAJ/fgF/YAR/fn9/AX9gA399fQF/YAN/fHwBf2ADfn9/AX9gAn5+AX9gAn1/AX9gAnx/AX9gAn9/AX5gBH9/fn8BfmABfAF+YAZ/f39/f38BfWACfn4BfWAFf39/f38BfGAEf39/fAF8YAV/f398fwF8YAZ/f398f3wBfGAHf39/fH98fwF8YAh/f398f3x8fAF8YAV/f398fAF8YAZ/f398fH8BfGAHf39/fHx/fAF8YAh/f398fH98fAF8YAZ/f398fHwBfGAHf39/fHx8fwF8YAh/f398fHx/fwF8YAh/f398fHx/fAF8YAh/f398fHx8fAF8YAp/f398fHx8fH9/AXxgAn5+AXxgAn1/AXwClgktA2VudhZfZW1iaW5kX3JlZ2lzdGVyX2NsYXNzAHUDZW52JV9lbWJpbmRfcmVnaXN0ZXJfY2xhc3NfY2xhc3NfZnVuY3Rpb24AFwNlbnYfX2VtYmluZF9yZWdpc3Rlcl9jbGFzc19wcm9wZXJ0eQAkA2VudhVfZW1iaW5kX3JlZ2lzdGVyX2VudW0ADANlbnYbX2VtYmluZF9yZWdpc3Rlcl9lbnVtX3ZhbHVlAAYDZW52Gl9lbWJpbmRfcmVnaXN0ZXJfc21hcnRfcHRyAHQDZW52Il9lbWJpbmRfcmVnaXN0ZXJfY2xhc3NfY29uc3RydWN0b3IACgNlbnYYX19jeGFfYWxsb2NhdGVfZXhjZXB0aW9uAAADZW52C19fY3hhX3Rocm93AAYDZW52H19lbWJpbmRfcmVnaXN0ZXJfY2xhc3NfZnVuY3Rpb24AMgNlbnYNX2VtdmFsX2luY3JlZgAEA2Vudg1fZW12YWxfZGVjcmVmAAQDZW52EV9lbXZhbF90YWtlX3ZhbHVlAAMDZW52C19lbXZhbF9jYWxsAAgDZW52BXJvdW5kABYDZW52BGV4aXQABANlbnYNX19hc3NlcnRfZmFpbAAMA2VudgpfX3N5c2NhbGw1AAMWd2FzaV9zbmFwc2hvdF9wcmV2aWV3MQhmZF9jbG9zZQAAA2VudgxfX3N5c2NhbGwyMjEAAwNlbnYLX19zeXNjYWxsNTQAAxZ3YXNpX3NuYXBzaG90X3ByZXZpZXcxCGZkX3dyaXRlAAgDZW52Bl9fbG9jawAEA2VudghfX3VubG9jawAEFndhc2lfc25hcHNob3RfcHJldmlldzEHZmRfcmVhZAAIFndhc2lfc25hcHNob3RfcHJldmlldzERZW52aXJvbl9zaXplc19nZXQAAxZ3YXNpX3NuYXBzaG90X3ByZXZpZXcxC2Vudmlyb25fZ2V0AAMDZW52Cl9fbWFwX2ZpbGUAAwNlbnYLX19zeXNjYWxsOTEAAwNlbnYKc3RyZnRpbWVfbAALA2VudgVhYm9ydAAJA2VudhVfZW1iaW5kX3JlZ2lzdGVyX3ZvaWQAAgNlbnYVX2VtYmluZF9yZWdpc3Rlcl9ib29sAA8DZW52G19lbWJpbmRfcmVnaXN0ZXJfc3RkX3N0cmluZwACA2VudhxfZW1iaW5kX3JlZ2lzdGVyX3N0ZF93c3RyaW5nAAYDZW52Fl9lbWJpbmRfcmVnaXN0ZXJfZW12YWwAAgNlbnYYX2VtYmluZF9yZWdpc3Rlcl9pbnRlZ2VyAA8DZW52Fl9lbWJpbmRfcmVnaXN0ZXJfZmxvYXQABgNlbnYcX2VtYmluZF9yZWdpc3Rlcl9tZW1vcnlfdmlldwAGA2VudhZlbXNjcmlwdGVuX3Jlc2l6ZV9oZWFwAAADZW52FWVtc2NyaXB0ZW5fbWVtY3B5X2JpZwAFA2VudgtzZXRUZW1wUmV0MAAEFndhc2lfc25hcHNob3RfcHJldmlldzEHZmRfc2VlawALA2VudgZtZW1vcnkCAIAQA2VudgV0YWJsZQFwALcHA+cauxoBCQkABAQEBAQJAQEBAQEAAQEEAQQAAAECBAAEAQEBAAQAAAEMBgEBAAABAgMGAAIAAgEBAQABBAICAgICAgEBAQABBAICAQEQAQ0YGwACAQEBAAEEAgIBAQEAAQQCAhANEA0BAQEAAQQCAgIBAQEAAQQRAkECDQIAAgEBAQAfAAABRCgAARkBAQEAAQQqAg0CEAIQDRANDQEBAQAEAQQAAgICAgICAgICBAICAgIBAQEABCMCIyMoAgAAAR4BAQEAAQQCAgICAQEBAAEEAgICAgACAQEBAAQCABgWAgABEQEBAQABBBMCAQEBAAQRAhMCEwEBAQABBC8CAQEBAAEELwIBAQEAAQQTAgEBAQABBA0CDR4CAQEBAAQAAAETFBQUFBQUFBQUFhQBAQEAAQQCAgIAAgACAAIQAhACAQIDAAIBAQEAAQQiAgICAQEBAAQABBMCKQICAhgCAAIBAQEBAQEABAAEEwIpAgICGAIAAgEBAQAEAQQCAgICAAADBQEBAQAEAQQCAgMFAQEBAAQBBAICBgIAAgYCBQIBAQEABAEEAgIGAgACBgIFAgEBAQAEAQQCAgYCAAIGAgUCAQEBAAQBBAICBgICBgICAQEBAAQBBAICBgICBgICBAQFAwMAAwMqAAADAAADAAADAwAAAAMAAQEJAAEBAQAEAQEAAQEDBAAAAAQCAhACDQIwAiICAQEBAAQBAwAABAICMAIBAQEAAQQCAgICDQ0AAmQCMQIAA4oBAhARCQABAQEAAAMAAQUDAwMAAQgFAwMDAAAAAwMDAwMDAwMDAAABABAQAAFISgABCQABAQEAAQQRAhMCCQABAQEAAQQTAgkAAQEBAAEEIgIEAgQCAAAPAAICAAIAAAQCAgAAAgAAAAIGBAADAAMAAgUGBgMAAAABAwUDAAEFAAQDAwYGBgYGAgQAAAwMAwMFAwMDBAMFAwEAAAYCBgIDAwQGAwgCAAYAAAMFAAMABAwCAgQABgAAAAMAAAADBQACBgACAgYGAgIAAAEBAQAEAAAAAQADAAYAAQAMAQADAQAFAAAAAQMCAQAIAQIGAgMDCAIABQAABAACAAIGAAEBAQAAAQAbFgEAAR8BAAEAAQMNAQBEAQAABgIGAgMDBgMIAgAGAAAFAAMABAIEAAYAAAAAAAAFAgYAAgIGBgICAAABAQEABAAAAQADAAYBAAwBAAEAAQMBAAEACAEAAAYCBgIDBgMIAgAAAAUAAwAEAgQAAAAAAAIAAgIGBgICAAABAQEABAAAAQADAAEAAQABAAEDAQAB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X19ncm93V2FzbU1lbW9yeQCFGgpkeW5DYWxsX2lpAIYaCmR5bkNhbGxfdmkAhxoJZHluQ2FsbF9pAIgaC2R5bkNhbGxfdmlpAIkaDWR5bkNhbGxfdmlpaWkAihoMZHluQ2FsbF92aWlpAIsaC2R5bkNhbGxfaWlpAIwaC2R5bkNhbGxfZGlkAI0aDWR5bkNhbGxfZGlkZGQAjhoMZHluQ2FsbF9kaWRkAI8aCmR5bkNhbGxfZGkAkBoLZHluQ2FsbF92aWQAkRoMZHluQ2FsbF9kaWlpAJIaDGR5bkNhbGxfdmlpZACTGgtkeW5DYWxsX2RpaQCUGg1keW5DYWxsX2RpZGlkAJUaDmR5bkNhbGxfZGlkaWRpAJYaDWR5bkNhbGxfdmlkaWQAlxoOZHluQ2FsbF92aWRpZGQAmBoPZHluQ2FsbF92aWRpZGRkAJkaDWR5bkNhbGxfdmlkZGQAmhoNZHluQ2FsbF92aWlpZACbGg1keW5DYWxsX2lpaWlkAJwaDGR5bkNhbGxfZGRkZACdGgxkeW5DYWxsX3ZpZGQAnhoMZHluQ2FsbF9paWlpAJ8aDmR5bkNhbGxfdmlmZmlpAKAaDmR5bkNhbGxfZGRkZGRkAKEaD2R5bkNhbGxfZGlkZGRkZACiGg9keW5DYWxsX2RpZGRpZGQAoxoPZHluQ2FsbF9kaWRkZGlpAKQaEWR5bkNhbGxfZGlkZGRkZGlpAKUaDGR5bkNhbGxfZGlkaQCmGgpkeW5DYWxsX2RkAKcaD2R5bkNhbGxfZGlkaWRkZACoGgtkeW5DYWxsX2RkZACpGg1keW5DYWxsX2RpZGRpAKoaDGR5bkNhbGxfdmlkaQCrGgxkeW5DYWxsX2lpZmkArBoKZHluQ2FsbF9maQCtGg1keW5DYWxsX2ZpaWlpAK4aDGR5bkNhbGxfZGlpZACvGg5keW5DYWxsX2RpaWRkZACwGg1keW5DYWxsX2RpaWRkALEaDWR5bkNhbGxfZGlpaWkAshoOZHluQ2FsbF9kaWlkaWQAsxoPZHluQ2FsbF9kaWlkaWRpALQaDmR5bkNhbGxfdmlpZGlkALUaD2R5bkNhbGxfdmlpZGlkZAC2GhBkeW5DYWxsX3ZpaWRpZGRkALcaDmR5bkNhbGxfdmlpZGRkALgaDWR5bkNhbGxfdmlpZGQAuRoNZHluQ2FsbF9paWlpaQC6Gg9keW5DYWxsX3ZpaWZmaWkAuxoQZHluQ2FsbF9kaWlkZGlkZAC8GhBkeW5DYWxsX2RpaWRkZGRkAL0aEGR5bkNhbGxfZGlpZGRkaWkAvhoSZHluQ2FsbF9kaWlkZGRkZGlpAL8aDWR5bkNhbGxfZGlpZGkAwBoQZHluQ2FsbF9kaWlkaWRkZADBGg5keW5DYWxsX2RpaWRkaQDCGg1keW5DYWxsX3ZpaWRpAMMaDmR5bkNhbGxfdmlpaWlpAMQaDWR5bkNhbGxfaWlpZmkAxRoLZHluQ2FsbF9maWkAxhoOZHluQ2FsbF9maWlpaWkAxxoMZHluQ2FsbF92aWlmAMgaDWR5bkNhbGxfdmlpaWYAyRoNZHluQ2FsbF9paWlpZgDKGg5keW5DYWxsX2RpZGRpZADLGg9keW5DYWxsX2RpZGRkaWQAzBoOZHluQ2FsbF9kaWRkZGkAzRoPZHluQ2FsbF9kaWlkZGlkAM4aEGR5bkNhbGxfZGlpZGRkaWQAzxoPZHluQ2FsbF9kaWlkZGRpANAaC2R5bkNhbGxfaWlkANEaCmR5bkNhbGxfaWQA0hoJZHluQ2FsbF92ANMaDmR5bkNhbGxfdmlpamlpAOAaDGR5bkNhbGxfamlqaQDhGg9keW5DYWxsX2lpZGlpaWkA1hoOZHluQ2FsbF9paWlpaWkA1xoRZHluQ2FsbF9paWlpaWlpaWkA2BoPZHluQ2FsbF9paWlpaWlpANkaDmR5bkNhbGxfaWlpaWlqAOIaDmR5bkNhbGxfaWlpaWlkANsaD2R5bkNhbGxfaWlpaWlqagDjGhBkeW5DYWxsX2lpaWlpaWlpAN0aEGR5bkNhbGxfaWlpaWlpamoA5BoPZHluQ2FsbF92aWlpaWlpAN8aCaYOAQBBAQu2Bzo9PkNEQ0ZKPT5PUFNWV1hZWltcYD1hmQ6cDp0OoQ6iDqQOng6fDqAOmA6bDpoOow7BAWw9baUOpg5zdXZ3eHlXWH09fqgOqQ6FAT2GAawOrQ6uDqoOqw6KAYsBdneMAY0BkQE9kgGwDrEOsg6aAT2bAZ0BnwGhAaMBqAE9qQGtAa4BsQG1AT22AbgBugG8Ab4BvwF2d8ABwQHCAcYBxwHIAcoB0Q7UDsYO0A7tDvAO7g7kDvEO6g7sDtUO1AHyDvMOsw60Du8O3AE9Pt4B4AHhAeIB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IAFBsAVqENABIAFBADYClAogAUHvADYCkAogASABKQOQCjcDqAUgAUGYCmogAUGoBWoQZCABKAKYCiECIAEgASgCnAo2ApwLIAEgAjYCmAsgASABKQOYCzcDoAVB1QwgAUGgBWoQ0QEgAUEANgKcCyABQfAANgKYCyABIAEpA5gLNwOYBUHeDCABQZgFahDRASABQQA2AoQKIAFB8QA2AoAKIAEgASkDgAo3A5AFIAFBiApqIAFBkAVqEGQgASgCiAohAiABIAEoAowKNgKcCyABIAI2ApgLIAEgASkDmAs3A4gFQaULIAFBiAVqENABIAFBADYC9AkgAUHyADYC8AkgASABKQPwCTcDgAUgAUH4CWogAUGABWoQZCABKAL4CSECIAEgASgC/Ak2ApwLIAEgAjYCmAsgASABKQOYCzcD+ARBpQsgAUH4BGoQ0QEgAUEANgLkCSABQfMANgLgCSABIAEpA+AJNwPwBCABQegJaiABQfAEahBkIAEoAugJIQIgASABKALsCTYCnAsgASACNgKYCyABIAEpA5gLNwPoBEGlCyABQegEahDSASABQQA2ApwLIAFB9AA2ApgLIAEgASkDmAs3A+AEQecMIAFB4ARqENIBIAFBADYCnAsgAUH1ADYCmAsgASABKQOYCzcD2ARBkwogAUHYBGoQ0wEgAUEANgKcCyABQfYANgKYCyABIAEpA5gLNwPQBEHtDCABQdAEahDTASABQQA2ApwLIAFB9wA2ApgLIAEgASkDmAs3A8gEQfMMIAFByARqENUBIAFBADYCnAsgAUH4ADYCmAsgASABKQOYCzcDwARB/QwgAUHABGoQ1gEgAUEANgKcCyABQfkANgKYCyABIAEpA5gLNwO4BEGGDSABQbgEahDXASABQQA2ApwLIAFB+gA2ApgLIAEgASkDmAs3A7AEQYsNIAFBsARqEM8BIAFBADYCnAsgAUH7ADYCmAsgASABKQOYCzcDqARBkA0gAUGoBGoQ2AEQNBA1IQIQNSEDENkBENoBENsBEDUQOUH8ABA7IAIQOyADQZ8NEDxB/QAQAEH+ABDdAUGnDUH/ABDfAUGuDUGAARDfAUG1DUGBARDfAUG8DUGCARDjARDZAUGnDSABQZgLahDkASABQZgLahDlARDmAUGDAUH/ABABENkBQa4NIAFBmAtqEOQBIAFBmAtq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AUHHAzYCiAEgASABKQOIATcDaEHyEyABQegAahC3BCABQQA2AowBIAFByAM2AogBIAEgASkDiAE3A2BBpQsgAUHgAGoQuQQgAUEANgKMASABQckDNgKIASABIAEpA4gBNwNYQf4TIAFB2ABqELsEEDQQNSECEDUhAxC8BBC9BBC+BBA1EDlBygMQOyACEDsgA0GNFBA8QcsDEAAQwQQQvARBnBQQqAQQOUHMAxCqBEHNAxBSQc4DEDxBzwMQBRC8BCABQYgBahCuBCABQYgBahDDBBA5QdADQdEDEAYgAUEANgKMASABQdIDNgKIASABIAEpA4gBNwNQQa4MIAFB0ABqEMcEIAFBADYCjAEgAUHTAzYCiAEgASABKQOIATcDSEGlCyABQcgAahDJBBA0EDUhAhA1IQMQygQQywQQzAQQNRA5QdQDEDsgAhA7IANByBQQPEHVAxAAQdYDEM8EIAFBADYCjAEgAUHXAzYCiAEgASABKQOIATcDQEGuDCABQUBrENEEIAFBADYCjAEgAUHYAzYCiAEgASABKQOIATcDOEHQEyABQThqENIEIAFBADYCjAEgAUHZAzYCiAEgASABKQOIATcDMEHmEyABQTBqENIEIAFBADYCjAEgAUHaAzYCiAEgASABKQOIATcDKEHyEyABQShqENMEIAFBADYCjAEgAUHbAzYCiAEgASABKQOIATcDIEHUFCABQSBqENMEIAFBADYCjAEgAUHcAzYCiAEgASABKQOIATcDGEHhFCABQRhqENMEIAFBADYCjAEgAUHdAzYCiAEgASABKQOIATcDEEHsFCABQRBqENcEIAFBADYCjAEgAUHeAzYCiAEgASABKQOIATcDCEGlCyABQQhqENkEIAFBADYCjAEgAUHfAzYCiAEgASABKQOIATcDAEH+EyABENsEIAFBkAFqJAAgAAsFABChDAsFABCiDAsFABCjDAsHACAAEJ8MCw8AIAAEQCAAEKAMEM8YCwsFABC5DAsEAEECCwcAIAAQkgQLBgBBkMwACwoAQQgQzRgQtAwLRwECfyMAQRBrIgIkAEEIEM0YIQMgAiABELUMIAMgACACQQhqIAIQtgwiAUEAELcMIQAgARC4DBogAhDCBhogAkEQaiQAIAALDwAgAARAIAAQsgwQzxgLCwQAQQELBQAQswwLMwEBfyMAQRBrIgEk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BUEDdGoQtQULIwAgACgCAARAIAAQrwUgABC2BSAAKAIAIAAQuwUQ0QULIAALFQAgACABEKoBENIFGiAAENMFGiAACz0BAX8jAEEQayIBJAAgASAAENQFENUFNgIMIAEQ1gU2AgggAUEMaiABQQhqENcFKAIAIQAgAUEQaiQAIAALCwAgACABQQAQ2AULCgAgAEEIahC5BQszACAAIAAQswUgABCzBSAAELQFQQN0aiAAELMFIAAQtAVBA3RqIAAQswUgAUEDdGoQtQULBAAgAAsOACAAIAEgAhCqARDhBQsLACAAIAEgAhDjBQsRACABEKoBGiAAQQA2AgAgAAsKACAAEKoBGiAACwoAIABBCGoQuQULBwAgABDaBQsFABDbBQsJACAAIAEQ2QULHgAgABDdBSABSQRAQYsWEN4FAAsgAUEDdEEIEN8FCykBAn8jAEEQayICJAAgAkEIaiABIAAQ3AUhAyACQRBqJAAgASAAIAMbCwcAIAAQ3QULCABB/////wcLDQAgASgCACACKAIASQsIAEH/////AQscAQF/QQgQByIBIAAQ4AUaIAFB8O0BQaIEEAgACwcAIAAQzRgLFQAgACABENIYGiAAQdDtATYCACAACw4AIAAgASACEKoBEOIFCw8AIAEgAhCqASkDADcDAAsOACABIAJBA3RBCBDkBQsLACAAIAEgAhDlBQsJACAAIAEQ5gULBwAgABDnBQsHACAAEM8YCwcAIAAoAgQLEAAgACgCACAAKAIEQQN0ags8AQJ/IwBBEGsiBCQAIAAQtgUhBSAEQQhqIAAgAxDPBSEDIAUgASACIABBBGoQ6wUgAxCxBSAEQRBqJAALKQAgAiABayICQQFOBEAgAygCACABIAIQ/hkaIAMgAygCACACajYCAAsLKQECfyMAQRBrIgIkACACQQhqIAAgARDuBSEDIAJBEGokACABIAAgAxsLKQECfyMAQRBrIgIkACACQQhqIAEgABDuBSEDIAJBEGokACABIAAgAxsLDQAgASsDACACKwMAYwsjACMAQRBrIgAkACAAQQhqIAEQ8QUoAgAhASAAQRBqJAAgAQsNACAAEJIEIAEQkgRGCwsAIAAgATYCACAACwcAIAAQsQULPQEBfyMAQRBrIgIkACAAEKoBGiAAQgA3AgAgAkEANgIMIABBCGogAkEMaiABEKoBEPQFGiACQRBqJAAgAAsaACAAIAEQqgEQ0gUaIAAgAhCqARD1BRogAAsKACABEKoBGiAACwQAQX8LCgAgAEEIahC5BQsKACAAQQhqELkFCw4AIAAgASACEKoBEIAGC2EBAn8jAEEgayIDJAAgABD4BSICIANBCGogACAAEMADQQFqEIEGIAAQwAMgAhCCBiICKAIIEKoBIAEQqgEQ+QUgAiACKAIIQQRqNgIIIAAgAhCDBiACEIQGGiADQSBqJAALcgECfyMAQSBrIgQkAAJAIAAQ9wUoAgAgACgCBGtBAnUgAU8EQCAAIAEgAhCjBgwBCyAAEPgFIQMgBEEIaiAAIAAQwAMgAWoQgQYgABDAAyADEIIGIgMgASACEKQGIAAgAxCDBiADEIQGGgsgBEEgaiQACyABAX8gACABELoFIAAQwAMhAiAAIAEQpQYgACACEKYGCw0AIAAoAgAgAUECdGoLMwEBfyMAQRBrIgIkACACQQhqIAEQqgEQxAYhASAAEFEgARC5BRAMNgIAIAJBEGokACAACwoAIABBARDxBRoLDgAgACABIAIQqgEQhQYLYgEBfyMAQRBrIgIkACACIAE2AgwgABCGBiEBIAIoAgwgAU0EQCAAEIcGIgAgAUEBdkkEQCACIABBAXQ2AgggAkEIaiACQQxqEIgGKAIAIQELIAJBEGokACABDwsgABDxGAALbwECfyMAQRBrIgUkAEEAIQQgBUEANgIMIABBDGogBUEMaiADEIkGGiABBEAgABCKBiABEIsGIQQLIAAgBDYCACAAIAQgAkECdGoiAjYCCCAAIAI2AgQgABCMBiAEIAFBAnRqNgIAIAVBEGokACAAC1wBAX8gABCNBiAAEPgFIAAoAgAgACgCBCABQQRqIgIQjgYgACACEI8GIABBBGogAUEIahCPBiAAEPcFIAEQjAYQjwYgASABKAIENgIAIAAgABDAAxCQBiAAELEFCyMAIAAQkQYgACgCAARAIAAQigYgACgCACAAEJIGEJMGCyAACw8AIAEgAhCqASgCADYCAAs9AQF/IwBBEGsiASQAIAEgABCUBhCVBjYCDCABENYFNgIIIAFBDGogAUEIahDXBSgCACEAIAFBEGokACAACwcAIAAQlgYLCQAgACABEJcGCx0AIAAgARCqARDSBRogAEEEaiACEKoBEJsGGiAACwoAIABBDGoQnQYLCwAgACABQQAQnAYLCgAgAEEMahC5BQs2ACAAIAAQswUgABCzBSAAEIcGQQJ0aiAAELMFIAAQwANBAnRqIAAQswUgABCHBkECdGoQtQULKAAgAyADKAIAIAIgAWsiAmsiADYCACACQQFOBEAgACABIAIQ/hkaCws+AQF/IwBBEGsiAiQAIAIgABCqASgCADYCDCAAIAEQqgEoAgA2AgAgASACQQxqEKoBKAIANgIAIAJBEGokAAszACAAIAAQswUgABCzBSAAEIcGQQJ0aiAAELMFIAAQhwZBAnRqIAAQswUgAUECdGoQtQULDAAgACAAKAIEEJ4GCxMAIAAQoAYoAgAgACgCAGtBAnULCwAgACABIAIQnwYLCgAgAEEIahC5BQsHACAAEJgGCxMAIAAQmgYoAgAgACgCAGtBAnULKQECfyMAQRBrIgIkACACQQhqIAAgARDcBSEDIAJBEGokACABIAAgAxsLBwAgABCZBgsIAEH/////AwsKACAAQQhqELkFCw4AIAAgARCqATYCACAACx4AIAAQmQYgAUkEQEGLFhDeBQALIAFBAnRBBBDfBQsKACAAQQRqEJIECwkAIAAgARChBgsOACABIAJBAnRBBBDkBQsKACAAQQxqELkFCzUBAn8DQCAAKAIIIAFGRQRAIAAQigYhAiAAIAAoAghBfGoiAzYCCCACIAMQqgEQogYMAQsLCwkAIAAgARC4BQtWAQN/IwBBEGsiAyQAIAAQ+AUhBANAIANBCGogAEEBEM8FIQUgBCAAKAIEEKoBIAIQ+QUgACAAKAIEQQRqNgIEIAUQsQUgAUF/aiIBDQALIANBEGokAAszAQF/IAAQigYhAwNAIAMgACgCCBCqASACEPkFIAAgACgCCEEEajYCCCABQX9qIgENAAsLMgEBfyAAKAIEIQIDQCABIAJGRQRAIAAQ+AUgAkF8aiICEKoBEKIGDAELCyAAIAE2AgQLMwAgACAAELMFIAAQswUgABCHBkECdGogABCzBSABQQJ0aiAAELMFIAAQwANBAnRqELUFCwUAQYAYCw8AIAAQjQYgABCsBhogAAsFAEGAGAsFAEHAGAsFAEH4GAsjACAAKAIABEAgABCtBiAAEPgFIAAoAgAgABCWBhCTBgsgAAsMACAAIAAoAgAQpQYLCgAgABCyBhogAAsFABCxBgsKACAAEQEAEKoBCwUAQZAZCzgBAX8jAEEQayIBJAAgABCqARogAEIANwIAIAFBADYCDCAAQQhqIAFBDGoQswYaIAFBEGokACAACxUAIAAgARCqARDSBRogABDTBRogAAsFABC3BgtYAQJ/IwBBEGsiAyQAIAEQqgEgACgCBCIEQQF1aiEBIAAoAgAhACAEQQFxBEAgASgCACAAaigCACEACyADIAIQqgE2AgwgASADQQxqIAARAgAgA0EQaiQACxUBAX9BCBDNGCIBIAApAgA3AwAgAQsFAEGUGQsFABC6BgthAQJ/IwBBEGsiBCQAIAEQqgEgACgCBCIFQQF1aiEBIAAoAgAhACAFQQFxBEAgASgCACAAaigCACEACyACEKoBIQIgBCADEKoBNgIMIAEgAiAEQQxqIAARBgAgBEEQaiQACwUAQbAZCwUAEL0GC1kBAn8jAEEQayICJAAgARCqASAAKAIEIgNBAXVqIQEgACgCACEAIAIgASADQQFxBH8gASgCACAAaigCAAUgAAsRAAA2AgwgAkEMahCSBCEAIAJBEGokACAACwUAQcgZCwUAEMMGC0QBAX8jAEEQayIDJAAgACgCACEAIANBCGogARCqASACEKoBIAARBgAgA0EIahDBBiECIANBCGoQwgYaIANBEGokACACCxUBAX9BBBDNGCIBIAAoAgA2AgAgAQsOACAAKAIAEAogACgCAAsLACAAKAIAEAsgAAsFAEHUGQs7AQF/IwBBEGsiAiQAIAIgABCqATYCDCACQQxqIAEQqgEQqgEQkgQQxQYgAkEMahCxBSACQRBqJAAgAAsZACAAKAIAIAE2AgAgACAAKAIAQQhqNgIACwYAQbDyAQsFABDJBgtIAQF/IwBBEGsiBCQAIAAoAgAhACABEKoBIQEgAhCqASECIAQgAxCqATYCDCABIAIgBEEMaiAAEQUAEKoBIQMgBEEQaiQAIAMLBQBBkBoLYQECfyMAQSBrIgMkACAAELYFIgIgA0EIaiAAIAAQ0QNBAWoQzgYgABDRAyACEM8GIgIoAggQqgEgARCqARDQBSACIAIoAghBCGo2AgggACACENAGIAIQ0QYaIANBIGokAAtyAQJ/IwBBIGsiBCQAAkAgABDNBSgCACAAKAIEa0EDdSABTwRAIAAgASACEMcFDAELIAAQtgUhAyAEQQhqIAAgABDRAyABahDOBiAAENEDIAMQzwYiAyABIAIQ2gYgACADENAGIAMQ0QYaCyAEQSBqJAALIAEBfyAAIAEQugUgABDRAyECIAAgARCyBSAAIAIQsAULMwEBfyMAQRBrIgIkACACQQhqIAEQqgEQ7gYhASAAEHEgARC5BRAMNgIAIAJBEGokACAAC2IBAX8jAEEQayICJAAgAiABNgIMIAAQywUhASACKAIMIAFNBEAgABC0BSIAIAFBAXZJBEAgAiAAQQF0NgIIIAJBCGogAkEMahCIBigCACEBCyACQRBqJAAgAQ8LIAAQ8RgAC28BAn8jAEEQayIFJABBACEEIAVBADYCDCAAQQxqIAVBDGogAxDSBhogAQRAIAAQ0wYgARDMBSEECyAAIAQ2AgAgACAEIAJBA3RqIgI2AgggACACNgIEIAAQ1AYgBCABQQN0ajYCACAFQRBqJAAgAAtcAQF/IAAQyAUgABC2BSAAKAIAIAAoAgQgAUEEaiICEI4GIAAgAhCPBiAAQQRqIAFBCGoQjwYgABDNBSABENQGEI8GIAEgASgCBDYCACAAIAAQ0QMQzgUgABCxBQsjACAAENUGIAAoAgAEQCAAENMGIAAoAgAgABDWBhDRBQsgAAsdACAAIAEQqgEQ0gUaIABBBGogAhCqARCbBhogAAsKACAAQQxqEJ0GCwoAIABBDGoQuQULDAAgACAAKAIEENcGCxMAIAAQ2AYoAgAgACgCAGtBA3ULCQAgACABENkGCwoAIABBDGoQuQULNQECfwNAIAAoAgggAUZFBEAgABDTBiECIAAgACgCCEF4aiIDNgIIIAIgAxCqARC3BQwBCwsLMwEBfyAAENMGIQMDQCADIAAoAggQqgEgAhDQBSAAIAAoAghBCGo2AgggAUF/aiIBDQALCwUAQZAbCwUAQZAbCwUAQdAbCwUAQYgcCwoAIAAQxQUaIAALBQAQ4QYLBQBBmBwLBQAQ5QYLWAECfyMAQRBrIgMkACABEKoBIAAoAgQiBEEBdWohASAAKAIAIQAgBEEBcQRAIAEoAgAgAGooAgAhAAsgAyACEOQGOQMIIAEgA0EIaiAAEQIAIANBEGokAAsEACAACwUAQZwcCwUAEOkGCwUAQcAcC2EBAn8jAEEQayIEJAAgARCqASAAKAIEIgVBAXVqIQEgACgCACEAIAVBAXEEQCABKAIAIABqKAIAIQALIAIQqgEhAiAEIAMQ5AY5AwggASACIARBCGogABEGACAEQRBqJAALBQBBsBwLBQAQ6wYLBQBByBwLBQAQ7QYLBQBB0BwLOwEBfyMAQRBrIgIkACACIAAQqgE2AgwgAkEMaiABEKoBEKoBEL4BEO8GIAJBDGoQsQUgAkEQaiQAIAALGQAgACgCACABOQMAIAAgACgCAEEIajYCAAsGAEHs8gELBQAQ8wYLSAEBfyMAQRBrIgQkACAAKAIAIQAgARCqASEBIAIQqgEhAiAEIAMQ5AY5AwggASACIARBCGogABEFABCqASECIARBEGokACACCwUAQeAcCwoAIABBCGoQuQULCgAgAEEIahC5BQsOACAAIAEgAhCqARD8BgthAQJ/IwBBIGsiAyQAIAAQ9QYiAiADQQhqIAAgABDiA0EBahD9BiAAEOIDIAIQ/gYiAigCCBCqASABEKoBEPYGIAIgAigCCEEBajYCCCAAIAIQ/wYgAhCABxogA0EgaiQAC28BAn8jAEEgayIEJAACQCAAEPQGKAIAIAAoAgRrIAFPBEAgACABIAIQmQcMAQsgABD1BiEDIARBCGogACAAEOIDIAFqEP0GIAAQ4gMgAxD+BiIDIAEgAhCaByAAIAMQ/wYgAxCABxoLIARBIGokAAsgAQF/IAAgARC6BSAAEOIDIQIgACABEJsHIAAgAhCcBwsKACAAKAIAIAFqCzQBAX8jAEEQayICJAAgAkEIaiABEKoBELMHIQEgABC0ByABELkFEAw2AgAgAkEQaiQAIAALDgAgACABIAIQqgEQgQcLYgEBfyMAQRBrIgIkACACIAE2AgwgABCCByEBIAIoAgwgAU0EQCAAEIMHIgAgAUEBdkkEQCACIABBAXQ2AgggAkEIaiACQQxqEIgGKAIAIQELIAJBEGokACABDwsgABDxGAALaQECfyMAQRBrIgUkAEEAIQQgBUEANgIMIABBDGogBUEMaiADEIQHGiABBEAgABCFByABEIYHIQQLIAAgBDYCACAAIAIgBGoiAjYCCCAAIAI2AgQgABCHByABIARqNgIAIAVBEGokACAAC1wBAX8gABCIByAAEPUGIAAoAgAgACgCBCABQQRqIgIQjgYgACACEI8GIABBBGogAUEIahCPBiAAEPQGIAEQhwcQjwYgASABKAIE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ABCSCBogAAsGAEGcxQALBgBBsMUACwYAQczFAAs4ACAAEJcIGiAAQQxqEJcIGiAAQRhqEJcIGiAAQSRqEJcIGiAAQTBqEJcIGiAAQcgAahD5CxogAAsFABD4CwsGAEHcxQALKAAgAEEIahCXCBogAEEUahCXCBogAEEgahCXCBogAEEsahCXCBogAAsFABD9CwsGAEH0xQALSAEBfyABEKoBIAAoAgQiBUEBdWohASAAKAIAIQAgBUEBcQRAIAEoAgAgAGooAgAhAAsgASACEKoBIAMQqgEgBBCqASAAEQwACwYAQeDFAAsFABCBDAsGAEGsxgALRgEBfyABEKoBIAAoAgQiBEEBdWohASAAKAIAIQAgBEEBcQRAIAEoAgAgAGooAgAhAAsgASACEJ8IIAMQqgEgABFHABCqAQsGAEGAxgALBQAQhQwLBgBBvMYAC1sCAn8BfSMAQRBrIgIkACABEKoBIAAoAgQiA0EBdWohASAAKAIAIQAgAiABIANBAXEEfyABKAIAIABqKAIABSAACxEdADgCDCACQQxqEKsIIQQgAkEQaiQAIAQLBgBBtMYACwUAEIkMCzsBAX8gARCqASAAKAIEIgJBAXVqIQEgACgCACEAIAEgAkEBcQR/IAEoAgAgAGooAgAFIAALEQAAEIgMCwwAQQwQzRggABCKDAsGAEHAxgALSwECfyMAQRBrIgIkACABEIoIEPIFIAAgAkEIahCLDBogARDAAyIDBEAgACADEIwMIAAgASgCACABKAIEIAMQjQwLIAJBEGokACAACz0BAX8jAEEQayICJAAgABCqARogAEIANwIAIAJBADYCDCAAQQhqIAJBDGogARCqARCODBogAkEQaiQAIAALRAEBfyAAEIEIIAFJBEAgABDxGAALIAAgABDBBSABEIQIIgI2AgAgACACNgIEIAAQ9gcgAiABQQJ0ajYCACAAQQAQhwgLPAECfyMAQRBrIgQkACAAEMEFIQUgBEEIaiAAIAMQzwUhAyAFIAEgAiAAQQRqEOsFIAMQsQUgBEEQaiQACxoAIAAgARCqARDSBRogACACEKoBEPUFGiAACwYAQaTGAAsGAEHUxgALJQAgAEE8ahCXEBogAEEYahCSCBogAEEMahCSCBogABCSCBogAAsGAEHUxgALBgBB6MYACwYAQYTHAAslACAAEJcIGiAAQQxqEJcIGiAAQRhqEJcIGiAAQTxqEPkLGiAACwUAEJcMCwYAQZTHAAsFABCZDAsGAEGgxwALBQAQnQwLBgBB9McAC2sCAn8BfSMAQRBrIgUkACABEKoBIAAoAgQiBkEBdWohASAAKAIAIQAgBkEBcQRAIAEoAgAgAGooAgAhAAsgBSABIAIQqgEgAxCqASAEEKoBIAARTQA4AgwgBUEMahCrCCEHIAVBEGokACAHCwYAQcDHAAsGAEHsxwALBgBBoMgACyEBAX8gACgCDCIBBEAgARDcBBDPGAsgAEEQahCkDBogAAsGAEGgyAALBgBB0MgACwYAQYjJAAtEAQJ/IAAoAgAEQEEAIQEDQCAAKAIEIAFBAnRqKAIAIgIEQCACEPQZCyABQQFqIgEgACgCAEkNAAsLIAAoAgQQ9BkgAAsJACAAEKYMIAALbQEEfyAAEKcMRQRAIAAQqAwhAiAAKAIEIgEgABCpDCIDKAIAEKoMIAAQqwxBADYCACABIANHBEADQCABEKwMIQQgASgCBCEBIAIgBEEIahCqARC4BSACIARBARCtDCABIANHDQALCyAAELEFCwsLACAAEK4MKAIARQsKACAAQQhqELkFCwoAIAAQrwwQqgELHAAgACgCACABKAIENgIEIAEoAgQgACgCADYCAAsKACAAQQhqELkFCwcAIAAQrwwLCwAgACABIAIQsAwLCgAgAEEIahC5BQsHACAAELkFCw4AIAEgAkEMbEEEEOQFCw8AQQgQzRggABCqARDjDAsVAQF/IAAoAgQiAQRAIAEQ4AwLIAALBgBBlMwACwsAIABCADcCACAACwoAIAAgARDxBRoLDAAgACABELoMGiAAC2UBAX8jAEEgayIDJAAgACABNgIAQRQQzRghBCADQRhqIAIQuwwhAiADQRBqEKoBGiAEIAEgAhC8DBogACAENgIEIAIQuAwaIAMgATYCBCADIAE2AgAgACADELoFIANBIGokACAACwoAIAAQwgYaIAALBgBBiMwACzQBAX8jAEEQayICJAAgAkEIaiABEKoBEL0MIQEgABC+DCABELkFEAw2AgAgAkEQaiQAIAALDAAgACABEMAMGiAAC1kBAX8jAEEgayIDJAAgAyABNgIUIABBABDBDBogAEGgyQA2AgAgAEEMaiADQQhqIANBFGogAhCqARDCDCICIANBGGoQqgEQwwwaIAIQxAwaIANBIGokACAACzsBAX8jAEEQayICJAAgAiAAEKoBNgIMIAJBDGogARCqARCqARDBBhDFBiACQQxqELEFIAJBEGokACAACwUAEL8MCwUAQfQZCxQAIAAgASgCACIBNgIAIAEQCiAACxwAIAAgARDIDBogACABNgIIIABB3OsBNgIAIAALHQAgACABEKoBEMkMGiAAQQRqIAIQqgEQygwaIAALGgAgACABEKoBEMsMGiAAIAIQqgEQ9QUaIAALDQAgAEEEahDMDBogAAs4ACMAQRBrIgEkACABQQhqIAAQxgwgAUEIahDCBhogARD/BSAAIAEQxwwaIAEQwgYaIAFBEGokAAsMACAAIAFBowQQ2wwLHAAgACgCABALIAAgASgCADYCACABQQA2AgAgAAsUACAAIAE2AgQgAEGk6wE2AgAgAAsRACAAIAEQqgEoAgA2AgAgAAsPACAAIAEQqgEQ1wwaIAALDwAgACABEKoBENkMGiAACwoAIAAQuAwaIAALHAAgAEGgyQA2AgAgAEEMahDODBogABCqARogAAsKACAAEMQMGiAACwoAIAAQzQwQzxgLKQAgAEEMaiIAELkFENEMIAAQuQUQuQUoAgAQxQwgABC5BRDRDBC4DBoLCgAgAEEEahCqAQslAQF/QQAhAiABQcTLABDTDAR/IABBDGoQuQUQ0QwQqgEFIAILCw0AIAAoAgQgASgCBEYLOgEDfyMAQRBrIgEkACABQQhqIABBDGoiAhC5BRDVDCEDIAIQuQUaIAMgABC5BUEBENYMIAFBEGokAAsEACAACw4AIAEgAkEUbEEEEOQFCwwAIAAgARDYDBogAAsVACAAIAEoAgA2AgAgAUEANgIAIAALHAAgACABKAIANgIAIABBBGogAUEEahDaDBogAAsMACAAIAEQ1wwaIAALQAECfyMAQRBrIgMkACADENwMIQQgACABKAIAIANBCGoQ3QwgA0EIahDeDCAEELkFIAIRCAAQ8QUaIANBEGokAAsoAQF/IwBBEGsiASQAIAEgABCqATYCDCABQQxqELEFIAFBEGokACAACwQAQQALBQAQ3wwLBgBBzMsACw8AIAAQ4QwEQCAAEMQYCwsoAQF/QQAhASAAQQRqEOIMQX9GBH8gACAAKAIAKAIIEQQAQQEFIAELCxMAIAAgACgC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IAMgATYCBCADIAE2AgAgACADELoFIANBIGokACAACwYAQezSAAtZAQF/IwBBIGsiAyQAIAMgATYCFCAAQQAQwQwaIABBhNAANgIAIABBDGogA0EIaiADQRRqIAIQqgEQtw0iAiADQRhqEKoBELgNGiACELkNGiADQSBqJAAgAAsdACAAIAEQqgEQyQwaIABBBGogAhCqARDKDBogAAsaACAAIAEQqgEQug0aIAAgAhCqARD1BRogAAsNACAAQQRqEMwMGiAACw8AIAAgARCqARDBDRogAAscACAAQYTQADYCACAAQQxqELwNGiAAEKoBGiAACwoAIAAQuQ0aIAALCgAgABC7DRDPGAspACAAQQxqIgAQuQUQ0QwgABC5BRC5BSgCABDFDCAAELkFENEMELgMGgslAQF/QQAhAiABQajSABDTDAR/IABBDGoQuQUQ0QwQqgEFIAILCzoBA38jAEEQayIBJAAgAUEIaiAAQQxqIgIQuQUQ1QwhAyACELkFGiADIAAQuQVBARDWDCABQRBqJAALHAAgACABKAIANgIAIABBBGogAUEEahDaDBogAAuNAQEEfyMAQTBrIgEkACABQRhqIAFBKGoQqgEiAkEBQQAQ5QwgAUEQaiACQQEQ5gwQww0iAxDEDSEEIAFBCGogAhDVDBogBBDFDRogABC0DCICIAMQxA0Qxg02AgAgAiADEMcNNgIEIAEgAigCACIANgIEIAEgADYCACACIAEQugUgAxDIDRogAUEwaiQACy0BAX8jAEEQayIDJAAgAyABNgIMIAAgA0EMaiACEKoBEMkNGiADQRBqJAAgAAsKACAAELkFKAIACzgBAX8jAEEQayIBJAAgAEEAEMEMGiAAQYDTADYCACAAQRBqIAFBCGoQqgEQyg0aIAFBEGokACAACw0AIABBEGoQuQUQqgELGgEBfyAAELkFKAIAIQEgABC5BUEANgIAIAELCwAgAEEAEMsNIAALHQAgACABEKoBEMkMGiAAQQRqIAIQqgEQ8QwaIAALFQAgACABEKoBEPUFGiAAEMwNGiAACycBAX8gABC5BSgCACECIAAQuQUgATYCACACBEAgABDRDCACENMNCwsKACAAENINGiAACxwAIABBgNMANgIAIABBEGoQzg0aIAAQqgEaIAALCgAgABCvDRogAAsKACAAEM0NEM8YCw4A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QQFqIAsgAUobIQsMBQsgC0EIIAtBCEsbIQsgCEEIciEIQfgAIQELIAcpA0AgEiABQSBxEJYRIQxBACENQYDuACEQIAhBCHFFDQMgBykDQFANAyABQQR2QYDuAGohEEECIQ0MAwtBACEBIApB/wFxIghBB0sNBQJAAkACQAJAAkACQAJAIAhBAWsOBwECAwQMBQYACyAHKAJAIA82AgAMCwsgBygCQCAPNgIADAoLIAcoAkAgD6w3AwAMCQsgBygCQCAPOwEADAgLIAcoAkAgDzoAAAwHCyAHKAJAIA82AgAMBgsgBygCQCAPrDcDAAwFC0EAIQ0gBykDQCEWQYDuAAshECAWIBIQlxEhDAsgCEH//3txIAggC0F/ShshCCAHKQNAIRYCfwJAIAsNACAWUEUNACASIQxBAAwBCyALIBZQIBIgDGtqIgEgCyABShsLIQsgEiEJCyAAQSAgDSAJIAxrIgogCyALIApIGyIRaiIJIA4gDiAJSBsiASAJIAgQlBEgACAQIA0QkREgAEEwIAEgCSAIQYCABHMQlBEgAEEwIBEgCkEAEJQRIAAgDCAKEJERIABBICABIAkgCEGAwABzEJQRDAELC0EAIQ0LIAdB0ABqJAAgDQsYACAALQAAQSBxRQRAIAEgAiAAEP8QGgsLSAEDf0EAIQEgACgCACwAABCqEQRAA0AgACgCACICLAAAIQMgACACQQFqNgIAIAMgAUEKbGpBUGohASACLAABEKoRDQALCyABC8YCAAJAIAFBFEsNACABQXdqIgFBCUsNAAJAAkACQAJAAkACQAJAAkACQAJAIAFBAWsOCQECAwQFBgcICQALIAIgAigCACIBQQRqNgIAIAAgASgCADYCAA8LIAIgAigCACIBQQRqNgIAIAAgATQCADcDAA8LIAIgAigCACIBQQRqNgIAIAAgATUCADcDAA8LIAIgAigCAEEHakF4cSIBQQhqNgIAIAAgASkDADcDAA8LIAIgAigCACIBQQRqNgIAIAAgATIBADcDAA8LIAIgAigCACIBQQRqNgIAIAAgATMBADcDAA8LIAIgAigCACIBQQRqNgIAIAAgATAAADcDAA8LIAIgAigCACIBQQRqNgIAIAAgATEAADcDAA8LIAIgAigCAEEHakF4cSIBQQhqNgIAIAAgASkDADcDAA8LIAAgAiADEQIACwt7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QX9zIAJB//37d2pxQYCBgoR4cQ0BIAAoAgQhAiAAQQRqIQAgAkH//ft3aiACQX9zcUGAgYKEeHFFDQALCwNAIAAiAi0AACIDBEAgAkEBaiEAIAMgAUH/AXFHDQELCyACDwsgABC9ESAAag8LIAALGgAgACABEL4RIgBBACAALQAAIAFB/wFxRhsLiQIBBH8gAkEARyEDAkACQAJAAkAgAkUNACAAQQNxRQ0AIAFB/wFxIQQDQCAALQAAIARGDQIgAEEBaiEAIAJBf2oiAkEARyEDIAJFDQEgAEEDcQ0ACwsgA0UNAQsgAC0AACABQf8BcUYNAQJAIAJBBE8EQCABQf8BcUGBgoQIbCEEIAJBfGoiA0EDcSEFIANBfHEgAGpBBGohBgNAIAAoAgAgBHMiA0F/cyADQf/9+3dqcUGAgYKEeHENAiAAQQRqIQAgAkF8aiICQQNLDQALIAUhAiAGIQALIAJFDQELIAFB/wFxIQMDQCAALQAAIANGDQIgAEEBaiEAIAJBf2oiAg0ACwtBAA8LIAALGwAgAEGBYE8EfxCpEUEAIABrNgIAQX8FIAALCxUAIABFBEBBAA8LEKkRIAA2AgBBfwtgAQF+AkACfiADQcAAcQRAIAIgA0FAaq2IIQFCACECQgAMAQsgA0UNASACQcAAIANrrYYgASADrSIEiIQhASACIASIIQJCAAshBCABIASEIQELIAAgATcDACAAIAI3AwgLUAEBfgJAIANBwABxBEAgASADQUBqrYYhAkIAIQEMAQsgA0UNACACIAOtIgSGIAFBwAAgA2utiIQhAiABIASGIQELIAAgATcDACAAIAI3AwgL2QMCAn8CfiMAQSBrIgIkAAJAIAFC////////////AIMiBEKAgICAgIDA/0N8IARCgICAgICAwIC8f3xUBEAgAUIEhiAAQjyIhCEEIABC//////////8PgyIAQoGAgICAgICACFoEQCAEQoGAgICAgICAwAB8IQUMAgsgBEKAgICAgICAgEB9IQUgAEKAgICAgICAgAiFQgBSDQEgBUIBgyAFfCEFDAELIABQIARCgICAgICAwP//AFQgBEKAgICAgIDA//8AURtFBEAgAUIEhiAAQjyIhEL/////////A4NCgICAgICAgPz/AIQhBQwBC0KAgICAgICA+P8AIQUgBEL///////+//8MAVg0AQgAhBSAEQjCIpyIDQZH3AEkNACACIAAgAUL///////8/g0KAgICAgIDAAIQiBEGB+AAgA2sQwxEgAkEQaiAAIAQgA0H/iH9qEMQRIAIpAwhCBIYgAikDACIEQjyIhCEFIAIpAxAgAikDGIRCAFKtIARC//////////8Pg4QiBEKBgICAgICAgAhaBEAgBUIBfCEFDAELIARCgICAgICAgIAIhUIAUg0AIAVCAYMgBXwhBQsgAkEgaiQAIAUgAUKAgICAgICAgIB/g4S/C5IBAQN8RAAAAAAAAPA/IAAgAKIiAkQAAAAAAADgP6IiA6EiBEQAAAAAAADwPyAEoSADoSACIAIgAiACRJAVyxmgAfo+okR3UcEWbMFWv6CiRExVVVVVVaU/oKIgAiACoiIDIAOiIAIgAkTUOIi+6fqovaJExLG0vZ7uIT6gokStUpyAT36SvqCioKIgACABoqGgoAsFACAAnAuNEgMQfwF+A3wjAEGwBGsiBiQAIAIgAkF9akEYbSIHQQAgB0EAShsiEEFobGohDCAEQQJ0QdDzAGooAgAiCyADQX9qIg1qQQBOBEAgAyALaiEFIBAgDWshAkEAIQcDQCAGQcACaiAHQQN0aiACQQBIBHxEAAAAAAAAAAAFIAJBAnRB4PMAaigCALcLOQMAIAJBAWohAiAHQQFqIgcgBUcNAAsLIAxBaGohCEEAIQUgA0EBSCEJA0ACQCAJBEBEAAAAAAAAAAAhFgwBCyAFIA1qIQdBACECRAAAAAAAAAAAIRYDQCAWIAAgAkEDdGorAwAgBkHAAmogByACa0EDdGorAwCioCEWIAJBAWoiAiADRw0ACwsgBiAFQQN0aiAWOQMAIAUgC0ghAiAFQQFqIQUgAg0AC0EXIAhrIRJBGCAIayERIAshBQJAA0AgBiAFQQN0aisDACEWQQAhAiAFIQcgBUEBSCITRQRAA0AgBkHgA2ogAkECdGoCfyAWAn8gFkQAAAAAAABwPqIiF5lEAAAAAAAA4EFjBEAgF6oMAQtBgICAgHgLtyIXRAAAAAAAAHDBoqAiFplEAAAAAAAA4EFjBEAgFqoMAQtBgICAgHgLNgIAIAYgB0F/aiIJQQN0aisDACAXoCEWIAJBAWohAiAHQQFKIQ0gCSEHIA0NAAsLAn8gFiAIEPwZIhYgFkQAAAAAAADAP6IQxxFEAAAAAAAAIMCioCIWmUQAAAAAAADgQWMEQCAWqgwBC0GAgICAeAshDiAWIA63oSEWAkACQAJAAn8gCEEBSCIURQRAIAVBAnQgBmpB3ANqIgIgAigCACICIAIgEXUiAiARdGsiBzYCACACIA5qIQ4gByASdQwBCyAIDQEgBUECdCAGaigC3ANBF3ULIgpBAUgNAgwBC0ECIQogFkQAAAAAAADgP2ZBAXNFDQBBACEKDAELQQAhAkEAIQ8gE0UEQANAIAZB4ANqIAJBAnRqIg0oAgAhB0H///8HIQkCQAJAIA0gDwR/IAkFIAdFDQFBASEPQYCAgAgLIAdrNgIADAELQQAhDwsgAkEBaiICIAVHDQALCwJAIBQNACAIQX9qIgJBAUsNACACQQFrBEAgBUECdCAGakHcA2oiAiACKAIAQf///wNxNgIADAELIAVBAnQgBmpB3ANqIgIgAigCAEH///8BcTYCAAsgDkEBaiEOIApBAkcNAEQAAAAAAADwPyAWoSEWQQIhCiAPRQ0AIBZEAAAAAAAA8D8gCBD8GaEhFgsgFkQAAAAAAAAAAGEEQEEAIQcCQCAFIgIgC0wNAANAIAZB4ANqIAJBf2oiAkECdGooAgAgB3IhByACIAtKDQALIAdFDQAgCCEMA0AgDEFoaiEMIAZB4ANqIAVBf2oiBUECdGooAgBFDQALDAMLQQEhAgNAIAIiB0EBaiECIAZB4ANqIAsgB2tBAnRqKAIARQ0ACyAFIAdqIQkDQCAGQcACaiADIAVqIgdBA3RqIAVBAWoiBSAQakECdEHg8wBqKAIAtzkDAEEAIQJEAAAAAAAAAAAhFiADQQFOBEADQCAWIAAgAkEDdGorAwAgBkHAAmogByACa0EDdGorAwCioCEWIAJBAWoiAiADRw0ACwsgBiAFQQN0aiAWOQMAIAUgCUgNAAsgCSEFDAELCwJAIBZBACAIaxD8GSIWRAAAAAAAAHBBZkEBc0UEQCAGQeADaiAFQQJ0agJ/IBYCfyAWRAAAAAAAAHA+oiIXmUQAAAAAAADgQWMEQCAXqgwBC0GAgICAeAsiArdEAAAAAAAAcMGioCIWmUQAAAAAAADgQWMEQCAWqgwBC0GAgICAeAs2AgAgBUEBaiEFDAELAn8gFplEAAAAAAAA4EFjBEAgFqoMAQtBgICAgHgLIQIgCCEMCyAGQeADaiAFQQJ0aiACNgIAC0QAAAAAAADwPyAMEPwZIRYCQCAFQX9MDQAgBSECA0AgBiACQQN0aiAWIAZB4ANqIAJBAnRqKAIAt6I5AwAgFkQAAAAAAABwPqIhFiACQQBKIQMgAkF/aiECIAMNAAsgBUF/TA0AIAUhAgNAIAUgAiIHayEARAAAAAAAAAAAIRZBACECA0ACQCAWIAJBA3RBsIkBaisDACAGIAIgB2pBA3RqKwMAoqAhFiACIAtODQAgAiAASSEDIAJBAWohAiADDQELCyAGQaABaiAAQQN0aiAWOQMAIAdBf2ohAiAHQQBKDQALCwJAIARBA0sNAAJAAkACQAJAIARBAWsOAwICAAELRAAAAAAAAAAAIRgCQCAFQQFIDQAgBkGgAWogBUEDdGorAwAhFiAFIQIDQCAGQaABaiACQQN0aiAWIAZBoAFqIAJBf2oiA0EDdGoiBysDACIXIBcgFqAiF6GgOQMAIAcgFzkDACACQQFKIQcgFyEWIAMhAiAHDQALIAVBAkgNACAGQaABaiAFQQN0aisDACEWIAUhAgNAIAZBoAFqIAJBA3RqIBYgBkGgAWogAkF/aiIDQQN0aiIHKwMAIhcgFyAWoCIXoaA5AwAgByAXOQMAIAJBAkohByAXIRYgAyECIAcNAAtEAAAAAAAAAAAhGCAFQQFMDQADQCAYIAZBoAFqIAVBA3RqKwMAoCEYIAVBAkohAiAFQX9qIQUgAg0ACwsgBisDoAEhFiAKDQIgASAWOQMAIAYpA6gBIRUgASAYOQMQIAEgFTcDCAwDC0QAAAAAAAAAACEWIAVBAE4EQANAIBYgBkGgAWogBUEDdGorAwCgIRYgBUEASiECIAVBf2ohBSACDQALCyABIBaaIBYgChs5AwAMAgtEAAAAAAAAAAAhFiAFQQBOBEAgBSECA0AgFiAGQaABaiACQQN0aisDAKAhFiACQQBKIQMgAkF/aiECIAMNAAsLIAEgFpogFiAKGzkDACAGKwOgASAWoSEWQQEhAiAFQQFOBEADQCAWIAZBoAFqIAJBA3RqKwMAoCEWIAIgBUchAyACQQFqIQIgAw0ACwsgASAWmiAWIAobOQMIDAELIAEgFpo5AwAgBisDqAEhFiABIBiaOQMQIAEgFpo5AwgLIAZBsARqJAAgDkEHcQvCCQMEfwF+BHwjAEEwayIEJAACQAJAAkAgAL0iBkIgiKciA0H/////B3EiAkH61L2ABE0EQCADQf//P3FB+8MkRg0BIAJB/LKLgARNBEAgBkIAWQRAIAEgAEQAAEBU+yH5v6AiAEQxY2IaYbTQvaAiBzkDACABIAAgB6FEMWNiGmG00L2gOQMIQQEhAgwFCyABIABEAABAVPsh+T+gIgBEMWNiGmG00D2gIgc5AwAgASAAIAehRDFjYhphtNA9oDkDCEF/IQIMBAsgBkIAWQRAIAEgAEQAAEBU+yEJwKAiAEQxY2IaYbTgvaAiBzkDACABIAAgB6FEMWNiGmG04L2gOQMIQQIhAgwECyABIABEAABAVPshCUCgIgBEMWNiGmG04D2gIgc5AwAgASAAIAehRDFjYhphtOA9oDkDCEF+IQIMAwsgAkG7jPGABE0EQCACQbz714AETQRAIAJB/LLLgARGDQIgBkIAWQRAIAEgAEQAADB/fNkSwKAiAETKlJOnkQ7pvaAiBzkDACABIAAgB6FEypSTp5EO6b2gOQMIQQMhAgwFCyABIABEAAAwf3zZEkCgIgBEypSTp5EO6T2gIgc5AwAgASAAIAehRMqUk6eRDuk9oDkDCEF9IQIMBAsgAkH7w+SABEYNASAGQgBZBEAgASAARAAAQFT7IRnAoCIARDFjYhphtPC9oCIHOQMAIAEgACAHoUQxY2IaYbTwvaA5AwhBBCECDAQLIAEgAEQAAEBU+yEZQKAiAEQxY2IaYbTwPaAiBzkDACABIAAgB6FEMWNiGmG08D2gOQMIQXwhAgwDCyACQfrD5IkESw0BCyABIAAgAESDyMltMF/kP6JEAAAAAAAAOEOgRAAAAAAAADjDoCIHRAAAQFT7Ifm/oqAiCCAHRDFjYhphtNA9oiIKoSIAOQMAIAJBFHYiBSAAvUI0iKdB/w9xa0ERSCEDAn8gB5lEAAAAAAAA4EFjBEAgB6oMAQtBgICAgHgLIQICQCADDQAgASAIIAdEAABgGmG00D2iIgChIgkgB0RzcAMuihmjO6IgCCAJoSAAoaEiCqEiADkDACAFIAC9QjSIp0H/D3FrQTJIBEAgCSEIDAELIAEgCSAHRAAAAC6KGaM7oiIAoSIIIAdEwUkgJZqDezmiIAkgCKEgAKGhIgqhIgA5AwALIAEgCCAAoSAKoTkDCAwBCyACQYCAwP8HTwRAIAEgACAAoSIAOQMAIAEgADkDCEEAIQIMAQsgBkL/////////B4NCgICAgICAgLDBAIS/IQBBACEDA0AgBEEQaiADIgVBA3RqAn8gAJlEAAAAAAAA4EFjBEAgAKoMAQtBgICAgHgLtyIHOQMAIAAgB6FEAAAAAAAAcEGiIQBBASEDIAVFDQALIAQgADkDIAJAIABEAAAAAAAAAABiBEBBAiEDDAELQQEhBQNAIAUiA0F/aiEFIARBEGogA0EDdGorAwBEAAAAAAAAAABhDQALCyAEQRBqIAQgAkEUdkHqd2ogA0EBakEBEMgRIQIgBCsDACEAIAZCf1cEQCABIACaOQMAIAEgBCsDCJo5AwhBACACayECDAELIAEgADkDACABIAQpAwg3AwgLIARBMGokACACC5kBAQN8IAAgAKIiAyADIAOioiADRHzVz1o62eU9okTrnCuK5uVavqCiIAMgA0R9/rFX4x3HPqJE1WHBGaABKr+gokSm+BARERGBP6CgIQUgAyAAoiEEIAJFBEAgBCADIAWiRElVVVVVVcW/oKIgAKAPCyAAIAMgAUQAAAAAAADgP6IgBCAFoqGiIAGhIARESVVVVVVVxT+ioKEL0AEBAn8jAEEQayIBJAACfCAAvUIgiKdB/////wdxIgJB+8Ok/wNNBEBEAAAAAAAA8D8gAkGewZryA0kNARogAEQAAAAAAAAAABDGEQwBCyAAIAChIAJBgIDA/wdPDQAaIAAgARDJEUEDcSICQQJNBEACQAJAAkAgAkEBaw4CAQIACyABKwMAIAErAwgQxhEMAwsgASsDACABKwMIQQEQyhGaDAILIAErAwAgASsDCBDGEZoMAQsgASsDACABKwMIQQEQyhELIQAgAUEQaiQAIAALTwEBfCAAIACiIgBEgV4M/f//37+iRAAAAAAAAPA/oCAAIACiIgFEQjoF4VNVpT+ioCAAIAGiIABEaVDu4EKT+T6iRCceD+iHwFa/oKKgtgtLAQJ8IAAgAKIiASAAoiICIAEgAaKiIAFEp0Y7jIfNxj6iRHTnyuL5ACq/oKIgAiABRLL7bokQEYE/okR3rMtUVVXFv6CiIACgoLYLhgICA38BfCMAQRBrIgMkAAJAIAC8IgRB/////wdxIgJB2p+k7gRNBEAgASAAuyIFIAVEg8jJbTBf5D+iRAAAAAAAADhDoEQAAAAAAAA4w6AiBUQAAABQ+yH5v6KgIAVEY2IaYbQQUb6ioDkDACAFmUQAAAAAAADgQWMEQCAFqiECDAILQYCAgIB4IQIMAQsgAkGAgID8B08EQCABIAAgAJO7OQMAQQAhAgwBCyADIAIgAkEXdkHqfmoiAkEXdGu+uzkDCCADQQhqIAMgAkEBQQAQyBEhAiADKwMAIQUgBEF/TARAIAEgBZo5AwBBACACayECDAELIAEgBTkDAAsgA0EQaiQAIAIL/AICA38BfCMAQRBrIgIkAAJ9IAC8IgNB/////wdxIgFB2p+k+gNNBEBDAACAPyABQYCAgMwDSQ0BGiAAuxDMEQwBCyABQdGn7YMETQRAIAC7IQQgAUHkl9uABE8EQEQYLURU+yEJQEQYLURU+yEJwCADQQBIGyAEoBDMEYwMAgsgA0F/TARAIAREGC1EVPsh+T+gEM0RDAILRBgtRFT7Ifk/IAShEM0RDAELIAFB1eOIhwRNBEAgAUHg27+FBE8EQEQYLURU+yEZQEQYLURU+yEZwCADQQBIGyAAu6AQzBEMAgsgA0F/TARARNIhM3982RLAIAC7oRDNEQwCCyAAu0TSITN/fNkSwKAQzREMAQsgACAAkyABQYCAgPwHTw0AGiAAIAJBCGoQzhFBA3EiAUECTQRAAkACQAJAIAFBAWsOAgECAAsgAisDCBDMEQwDCyACKwMImhDNEQwCCyACKwMIEMwRjAwBCyACKwMIEM0RCyEAIAJBEGokACAAC9QBAQJ/IwBBEGsiASQAAkAgAL1CIIinQf////8HcSICQfvDpP8DTQRAIAJBgIDA8gNJDQEgAEQAAAAAAAAAAEEAEMoRIQAMAQsgAkGAgMD/B08EQCAAIAChIQAMAQsgACABEMkRQQNxIgJBAk0EQAJAAkACQCACQQFrDgIBAgALIAErAwAgASsDCEEBEMoRIQAMAwsgASsDACABKwMIEMYRIQAMAgsgASsDACABKwMIQQEQyhGaIQAMAQsgASsDACABKwMIEMYRmiEACyABQRBqJAAgAAuSAwIDfwF8IwBBEGsiAiQAAkAgALwiA0H/////B3EiAUHan6T6A00EQCABQYCAgMwDSQ0BIAC7EM0RIQAMAQsgAUHRp+2DBE0EQCAAuyEEIAFB45fbgARNBEAgA0F/TARAIAREGC1EVPsh+T+gEMwRjCEADAMLIAREGC1EVPsh+b+gEMwRIQAMAgtEGC1EVPshCUBEGC1EVPshCcAgA0EASBsgBKCaEM0RIQAMAQsgAUHV44iHBE0EQCAAuyEEIAFB39u/hQRNBEAgA0F/TARAIARE0iEzf3zZEkCgEMwRIQAMAwsgBETSITN/fNkSwKAQzBGMIQAMAgtEGC1EVPshGUBEGC1EVPshGcAgA0EASBsgBKAQzREhAAwBCyABQYCAgPwHTwRAIAAgAJMhAAwBCyAAIAJBCGoQzhFBA3EiAUECTQRAAkACQAJAIAFBAWsOAgECAAsgAisDCBDNESEADAMLIAIrAwgQzBEhAAwCCyACKwMImhDNESEADAELIAIrAwgQzBGMIQALIAJBEGokACAAC6wDAwJ/AX4DfCAAvSIFQoCAgICA/////wCDQoGAgIDwhOXyP1QiBEUEQEQYLURU+yHpPyAAmiAAIAVCAFMiAxuhRAdcFDMmpoE8IAGaIAEgAxuhoCEAIAVCP4inIQNEAAAAAAAAAAAhAQsgACAAIAAgAKIiB6IiCERjVVVVVVXVP6IgASAHIAEgCCAHIAeiIgYgBiAGIAYgBkRzU2Dby3XzvqJEppI3oIh+FD+gokQBZfLy2ERDP6CiRCgDVskibW0/oKJEN9YGhPRklj+gokR6/hARERHBP6AgByAGIAYgBiAGIAZE1Hq/dHAq+z6iROmn8DIPuBI/oKJEaBCNGvcmMD+gokQVg+D+yNtXP6CiRJOEbunjJoI/oKJE/kGzG7qhqz+goqCioKKgoCIHoCEGIARFBEBBASACQQF0a7ciASAAIAcgBiAGoiAGIAGgo6GgIgYgBqChIgaaIAYgAxsPCyACBHxEAAAAAAAA8L8gBqMiASAGvUKAgICAcIO/IgggAb1CgICAgHCDvyIGokQAAAAAAADwP6AgByAIIAChoSAGoqCiIAagBSAGCwuEAQECfyMAQRBrIgEkAAJAIAC9QiCIp0H/////B3EiAkH7w6T/A00EQCACQYCAgPIDSQ0BIABEAAAAAAAAAABBABDSESEADAELIAJBgIDA/wdPBEAgACAAoSEADAELIAAgARDJESECIAErAwAgASsDCCACQQFxENIRIQALIAFBEGokACAAC4YEAwF/AX4DfAJAIAC9IgJCIIinQf////8HcSIBQYCAwKAETwRAIAJC////////////AINCgICAgICAgPj/AFYNAUQYLURU+yH5v0QYLURU+yH5PyACQgBTGw8LAn8gAUH//+/+A00EQEF/IAFBgICA8gNPDQEaDAILIAAQ0gIhACABQf//y/8DTQRAIAFB//+X/wNNBEAgACAAoEQAAAAAAADwv6AgAEQAAAAAAAAAQKCjIQBBAAwCCyAARAAAAAAAAPC/oCAARAAAAAAAAPA/oKMhAEEBDAELIAFB//+NgARNBEAgAEQAAAAAAAD4v6AgAEQAAAAAAAD4P6JEAAAAAAAA8D+goyEAQQIMAQtEAAAAAAAA8L8gAKMhAEEDCyEBIAAgAKIiBCAEoiIDIAMgAyADIANEL2xqLES0or+iRJr93lIt3q2/oKJEbZp0r/Kws7+gokRxFiP+xnG8v6CiRMTrmJmZmcm/oKIhBSAEIAMgAyADIAMgA0QR2iLjOq2QP6JE6w12JEt7qT+gokRRPdCgZg2xP6CiRG4gTMXNRbc/oKJE/4MAkiRJwj+gokQNVVVVVVXVP6CiIQMgAUF/TARAIAAgACAFIAOgoqEPCyABQQN0IgFB8IkBaisDACAAIAUgA6CiIAFBkIoBaisDAKEgAKGhIgCaIAAgAkIAUxshAAsgAAvlAgICfwN9AkAgALwiAkH/////B3EiAUGAgIDkBE8EQCABQYCAgPwHSw0BQ9oPyb9D2g/JPyACQQBIGw8LAn8gAUH////2A00EQEF/IAFBgICAzANPDQEaDAILIAAQghAhACABQf//3/wDTQRAIAFB//+/+QNNBEAgACAAkkMAAIC/kiAAQwAAAECSlSEAQQAMAgsgAEMAAIC/kiAAQwAAgD+SlSEAQQEMAQsgAUH//++ABE0EQCAAQwAAwL+SIABDAADAP5RDAACAP5KVIQBBAgwBC0MAAIC/IACVIQBBAwshASAAIACUIgQgBJQiAyADQ0cS2r2UQ5jKTL6SlCEFIAQgAyADQyWsfD2UQw31ET6SlEOpqqo+kpQhAyABQX9MBEAgACAAIAUgA5KUkw8LIAFBAnQiAUGwigFqKgIAIAAgBSADkpQgAUHAigFqKgIAkyAAk5MiAIwgACACQQBIGyEACyAAC+kCAQV/AkAgAbwiAkH/////B3EiBEGAgID8B00EQCAAvCIFQf////8HcSIDQYGAgPwHSQ0BCyAAIAGSDwsgAkGAgID8A0YEQCAAENURDwsgAkEedkECcSIGIAVBH3ZyIQICQAJAAkAgA0UEQAJAIAJBAmsOAgIAAwtD2w9JwA8LIARBgICA/AdHBEAgBEUEQEPbD8m/Q9sPyT8gBUEASBsPCyADQYCAgPwHR0EAIARBgICA6ABqIANPG0UEQEPbD8m/Q9sPyT8gBUEASBsPCwJ9IANBgICA6ABqIARJBEBDAAAAACAGDQEaCyAAIAGVEIIQENURCyEBIAJBAk0EQCABIQACQAJAIAJBAWsOAgABBQsgAYwPC0PbD0lAIAFDLr27M5KTDwsgAUMuvbszkkPbD0nAkg8LIANBgICA/AdGDQIgAkECdEHgigFqKgIADwtD2w9JQCEACyAADwsgAkECdEHQigFqKgIAC9QCAgN/An0gALwiAkEfdiEDAkACQAJ9AkAgAAJ/AkACQCACQf////8HcSIBQdDYupUETwRAIAFBgICA/AdLBEAgAA8LAkAgAkEASA0AIAFBmOTFlQRJDQAgAEMAAAB/lA8LIAJBf0oNAUMAAAAAIQQgAUG047+WBE0NAQwGCyABQZnkxfUDSQ0DIAFBk6uU/ANJDQELIABDO6q4P5QgA0ECdEHwigFqKgIAkiIEi0MAAABPXQRAIASoDAILQYCAgIB4DAELIANBAXMgA2sLIgGyIgRDAHIxv5SSIgAgBEOOvr81lCIFkwwBCyABQYCAgMgDTQ0CQQAhAUMAAAAAIQUgAAshBCAAIAQgBCAEIASUIgAgAEMVUjW7lEOPqio+kpSTIgCUQwAAAEAgAJOVIAWTkkMAAIA/kiEEIAFFDQAgBCABELIRIQQLIAQPCyAAQwAAgD+SC50DAwN/AX4CfAJAAkACQAJAIAC9IgRCAFkEQCAEQiCIpyIBQf//P0sNAQsgBEL///////////8Ag1AEQEQAAAAAAADwvyAAIACiow8LIARCf1UNASAAIAChRAAAAAAAAAAAow8LIAFB//+//wdLDQJBgIDA/wMhAkGBeCEDIAFBgIDA/wNHBEAgASECDAILIASnDQFEAAAAAAAAAAAPCyAARAAAAAAAAFBDor0iBEIgiKchAkHLdyEDCyADIAJB4r4laiIBQRR2arciBUQAAOD+Qi7mP6IgBEL/////D4MgAUH//z9xQZ7Bmv8Daq1CIIaEv0QAAAAAAADwv6AiACAFRHY8eTXvOeo9oiAAIABEAAAAAAAAAECgoyIFIAAgAEQAAAAAAADgP6KiIgYgBSAFoiIFIAWiIgAgACAARJ/GeNAJmsM/okSveI4dxXHMP6CiRAT6l5mZmdk/oKIgBSAAIAAgAEREUj7fEvHCP6JE3gPLlmRGxz+gokRZkyKUJEnSP6CiRJNVVVVVVeU/oKKgoKKgIAahoKAhAAsgAAuQAgICfwJ9AkACQCAAvCIBQYCAgARPQQAgAUF/ShtFBEAgAUH/////B3FFBEBDAACAvyAAIACUlQ8LIAFBf0wEQCAAIACTQwAAAACVDwsgAEMAAABMlLwhAUHofiECDAELIAFB////+wdLDQFBgX8hAkMAAAAAIQAgAUGAgID8A0YNAQsgAiABQY32qwJqIgFBF3ZqsiIDQ4BxMT+UIAFB////A3FB84nU+QNqvkMAAIC/kiIAIAND0fcXN5QgACAAQwAAAECSlSIDIAAgAEMAAAA/lJQiBCADIAOUIgAgACAAlCIAQ+7pkT6UQ6qqKj+SlCAAIABDJp54PpRDE87MPpKUkpKUkiAEk5KSIQALIAALBQAgAJ8LjRADCH8Cfgh8RAAAAAAAAPA/IQwCQCABvSIKQiCIpyIEQf////8HcSICIAqnIgVyRQ0AIAC9IgtCIIinIQMgC6ciCUVBACADQYCAwP8DRhsNAAJAAkAgA0H/////B3EiBkGAgMD/B0sNACAGQYCAwP8HRiAJQQBHcQ0AIAJBgIDA/wdLDQAgBUUNASACQYCAwP8HRw0BCyAAIAGgDwsCQAJ/AkACf0EAIANBf0oNABpBAiACQf///5kESw0AGkEAIAJBgIDA/wNJDQAaIAJBFHYhCCACQYCAgIoESQ0BQQAgBUGzCCAIayIIdiIHIAh0IAVHDQAaQQIgB0EBcWsLIgcgBUUNARoMAgtBACEHIAUNAUEAIAJBkwggCGsiBXYiCCAFdCACRw0AGkECIAhBAXFrCyEHIAJBgIDA/wdGBEAgBkGAgMCAfGogCXJFDQIgBkGAgMD/A08EQCABRAAAAAAAAAAAIARBf0obDwtEAAAAAAAAAAAgAZogBEF/ShsPCyACQYCAwP8DRgRAIARBf0oEQCAADwtEAAAAAAAA8D8gAKMPCyAEQYCAgIAERgRAIAAgAKIPCyADQQBIDQAgBEGAgID/A0cNACAAENoRDwsgABDSAiEMAkAgCQ0AIAZBACAGQYCAgIAEckGAgMD/B0cbDQBEAAAAAAAA8D8gDKMgDCAEQQBIGyEMIANBf0oNASAHIAZBgIDAgHxqckUEQCAMIAyhIgEgAaMPCyAMmiAMIAdBAUYbDwtEAAAAAAAA8D8hDQJAIANBf0oNACAHQQFLDQAgB0EBawRAIAAgAKEiASABow8LRAAAAAAAAPC/IQ0LAnwgAkGBgICPBE8EQCACQYGAwJ8ETwRAIAZB//+//wNNBEBEAAAAAAAA8H9EAAAAAAAAAAAgBEEASBsPC0QAAAAAAADwf0QAAAAAAAAAACAEQQBKGw8LIAZB/v+//wNNBEAgDUScdQCIPOQ3fqJEnHUAiDzkN36iIA1EWfP4wh9upQGiRFnz+MIfbqUBoiAEQQBIGw8LIAZBgYDA/wNPBEAgDUScdQCIPOQ3fqJEnHUAiDzkN36iIA1EWfP4wh9upQGiRFnz+MIfbqUBoiAEQQBKGw8LIAxEAAAAAAAA8L+gIgBEAAAAYEcV9z+iIgwgAERE3134C65UPqIgACAAokQAAAAAAADgPyAAIABEAAAAAAAA0L+iRFVVVVVVVdU/oKKhokT+gitlRxX3v6KgIg+gvUKAgICAcIO/IgAgDKEMAQsgDEQAAAAAAABAQ6IiACAMIAZBgIDAAEkiAhshDCAAvUIgiKcgBiACGyIEQf//P3EiBUGAgMD/A3IhAyAEQRR1Qcx3QYF4IAIbaiEEQQAhAgJAIAVBj7EOSQ0AIAVB+uwuSQRAQQEhAgwBCyADQYCAQGohAyAEQQFqIQQLIAJBA3QiBUGgiwFqKwMAIhEgDL1C/////w+DIAOtQiCGhL8iDiAFQYCLAWorAwAiD6EiEEQAAAAAAADwPyAPIA6goyISoiIMvUKAgICAcIO/IgAgACAAoiITRAAAAAAAAAhAoCAMIACgIBIgECAAIANBAXVBgICAgAJyIAJBEnRqQYCAIGqtQiCGvyIQoqEgACAOIBAgD6GhoqGiIg6iIAwgDKIiACAAoiAAIAAgACAAIABE705FSih+yj+iRGXbyZNKhs0/oKJEAUEdqWB00T+gokRNJo9RVVXVP6CiRP+rb9u2bds/oKJEAzMzMzMz4z+goqAiD6C9QoCAgIBwg78iAKIiECAOIACiIAwgDyAARAAAAAAAAAjAoCAToaGioCIMoL1CgICAgHCDvyIARAAAAOAJx+4/oiIOIAVBkIsBaisDACAMIAAgEKGhRP0DOtwJx+4/oiAARPUBWxTgLz6+oqCgIg+goCAEtyIMoL1CgICAgHCDvyIAIAyhIBGhIA6hCyERIAAgCkKAgICAcIO/Ig6iIgwgDyARoSABoiABIA6hIACioCIBoCIAvSIKpyECAkAgCkIgiKciA0GAgMCEBE4EQCADQYCAwPt7aiACcgRAIA1EnHUAiDzkN36iRJx1AIg85Dd+og8LIAFE/oIrZUcVlzygIAAgDKFkQQFzDQEgDUScdQCIPOQ3fqJEnHUAiDzkN36iDwsgA0GA+P//B3FBgJjDhARJDQAgA0GA6Lz7A2ogAnIEQCANRFnz+MIfbqUBokRZ8/jCH26lAaIPCyABIAAgDKFlQQFzDQAgDURZ8/jCH26lAaJEWfP4wh9upQGiDwtBACECIA0CfCADQf////8HcSIFQYGAgP8DTwR+QQBBgIDAACAFQRR2QYJ4anYgA2oiBUH//z9xQYCAwAByQZMIIAVBFHZB/w9xIgRrdiICayACIANBAEgbIQIgASAMQYCAQCAEQYF4anUgBXGtQiCGv6EiDKC9BSAKC0KAgICAcIO/IgBEAAAAAEMu5j+iIg4gASAAIAyhoUTvOfr+Qi7mP6IgAEQ5bKgMYVwgvqKgIgygIgEgASABIAEgAaIiACAAIAAgACAARNCkvnJpN2Y+okTxa9LFQb27vqCiRCzeJa9qVhE/oKJEk72+FmzBZr+gokQ+VVVVVVXFP6CioSIAoiAARAAAAAAAAADAoKMgDCABIA6hoSIAIAEgAKKgoaFEAAAAAAAA8D+gIgG9IgpCIIinIAJBFHRqIgNB//8/TARAIAEgAhD8GQwBCyAKQv////8PgyADrUIghoS/C6IhDAsgDAszAQF/IAIEQCAAIQMDQCADIAEoAgA2AgAgA0EEaiEDIAFBBGohASACQX9qIgINAAsLIAALCAAQ3hFBAEoLBAAQNQsKACAAEOARGiAACz0AIABB+I0BNgIAIABBABDhESAAQRxqELMTGiAAKAIgEPQZIAAoAiQQ9BkgACgCMBD0GSAAKAI8EPQZIAALPAECfyAAKAIoIQIDQCACBEAgASAAIAJBf2oiAkECdCIDIAAoAiRqKAIAIAAoAiAgA2ooAgARBgAMAQsLCwoAIAAQ3xEQzxgLFgAgAEG4iwE2AgAgAEEEahCzExogAAsKACAAEOMREM8YCysAIABBuIsBNgIAIABBBGoQ7RYaIABCADcCGCAAQgA3AhAgAEIANwIIIAALCgAgAEJ/EOgOGgsKACAAQn8Q6A4aC78BAQR/IwBBEGsiBCQAQQAhBQNAAkAgBSACTg0AAkAgACgCDCIDIAAoAhAiBkkEQCAEQf////8HNgIMIAQgBiADazYCCCAEIAIgBWs2AgQgBEEMaiAEQQhqIARBBGoQ6REQ6REhAyABIAAoAgwgAygCACIDEPYJGiAAIAMQqg8MAQsgACAAKAIAKAIoEQAAIgNBf0YNASABIAMQrA86AABBASEDCyABIANqIQEgAyAFaiEFDAELCyAEQRBqJAAgBQsJACAAIAEQ6hELKQECfyMAQRBrIgIkACACQQhqIAEgABC1DyEDIAJBEGokACABIAAgAxsLBQAQ9gULMQAgACAAKAIAKAIkEQAAEPYFRgRAEPYFDwsgACAAKAIMIgBBAWo2AgwgACwAABCnDwsFABD2BQu8AQEFfyMAQRBrIgUkAEEAIQMQ9gUhBgNAAkAgAyACTg0AIAAoAhgiBCAAKAIcIgdPBEAgACABLAAAEKcPIAAoAgAoAjQRAwAgBkYNASADQQFqIQMgAUEBaiEBDAIFIAUgByAEazYCDCAFIAIgA2s2AgggBUEMaiAFQQhqEOkRIQQgACgCGCABIAQoAgAiBBD2CRogACAEIAAoAhhqNgIYIAMgBGohAyABIARqIQEMAgsACwsgBUEQaiQAIAMLFgAgAEH4iwE2AgAgAEEEahCzExogAAsKACAAEO8REM8YCysAIABB+IsBNgIAIABBBGoQ7RYaIABCADcCGCAAQgA3AhAgAEIANwIIIAALygEBBH8jAEEQayIEJABBACEFA0ACQCAFIAJODQACfyAAKAIMIgMgACgCECIGSQRAIARB/////wc2AgwgBCAGIANrQQJ1NgIIIAQgAiAFazYCBCAEQQxqIARBCGogBEEEahDpERDpESEDIAEgACgCDCADKAIAIgMQ8xEaIAAgAxD0ESABIANBAnRqDAELIAAgACgCACgCKBEAACIDQX9GDQEgASADEKoBNgIAQQEhAyABQQRqCyEBIAMgBWohBQwBCwsgBEEQaiQAIAULEwAgAgR/IAAgASACENwRBSAACwsSACAAIAAoAgwgAUECdGo2AgwLMQAgACAAKAIAKAIkEQAAEPYFRgRAEPYFDwsgACAAKAIMIgBBBGo2AgwgACgCABCqAQvEAQEFfyMAQRBrIgUkAEEAIQMQ9gUhBwNAAkAgAyACTg0AIAAoAhgiBCAAKAIcIgZPBEAgACABKAIAEKoBIAAoAgAoAjQRAwAgB0YNASADQQFqIQMgAUEEaiEBDAIFIAUgBiAEa0ECdTYCDCAFIAIgA2s2AgggBUEMaiAFQQhqEOkRIQQgACgCGCABIAQoAgAiBBDzERogACAEQQJ0IgYgACgCGGo2AhggAyAEaiEDIAEgBmohAQwCCwALCyAFQRBqJAAgAwsWACAAQdiMARDVDCIAQQhqEN8RGiAACxMAIAAgACgCAEF0aigCAGoQ9xELCgAgABD3ERDPGAsTACAAIAAoAgBBdGooAgBqEPkRC6gCAQN/IwBBIGsiAyQAIABBADoAACABIAEoAgBBdGooAgBqEPwRIQQgASABKAIAQXRqKAIAaiEFAkAgBARAIAUQ/REEQCABIAEoAgBBdGooAgBqEP0REP4RGgsCQCACDQAgASABKAIAQXRqKAIAahDoBUGAIHFFDQAgA0EYaiABIAEoAgBBdGooAgBqEP8RIANBGGoQ0Q8hAiADQRhqELMTGiADQRBqIAEQxA4hBCADQQhqEMUOIQUDQAJAIAQgBRDMDkUNACACQYDAACAEEM0OEIASRQ0AIAQQzg4aDAELCyAEIAUQgRJFDQAgASABKAIAQXRqKAIAakEGEMoOCyAAIAEgASgCAEF0aigCAGoQ/BE6AAAMAQsgBUEEEMoOCyADQSBqJAAgAAsHACAAEIISCwcAIAAoAkgLcQECfyMAQRBrIgEkACAAIAAoAgBBdGooAgBqEMsOBEACQCABQQhqIAAQgxIiAhDyB0UNACAAIAAoAgBBdGooAgBqEMsOEJcPQX9HDQAgACAAKAIAQXRqKAIAakEBEMoOCyACEIQSGgsgAUEQaiQAIAALDQAgACABQRxqEOsWGgsrAQF/QQAhAyACQQBOBH8gACgCCCACQf8BcUEBdGovAQAgAXFBAEcFIAMLCwkAIAAgARDGDwsIACAAKAIQRQtWACAAIAE2AgQgAEEAOgAAIAEgASgCAEF0aigCAGoQ/BEEQCABIAEoAgBBdGooAgBqEP0RBEAgASABKAIAQXRqKAIAahD9ERD+ERoLIABBAToAAAsgAAuUAQEBfwJAIAAoAgQiASABKAIAQXRqKAIAahDLDkUNACAAKAIEIgEgASgCAEF0aigCAGoQ/BFFDQAgACgCBCIBIAEoAgBBdGooAgBqEOgFQYDAAHFFDQAQ3RENACAAKAIEIgEgASgCAEF0aigCAGoQyw4Qlw9Bf0cNACAAKAIEIgEgASgCAEF0aigCAGpBARDKDgsgAAs9AQF/IAAoAhgiAiAAKAIcRgRAIAAgARCnDyAAKAIAKAI0EQMADwsgACACQQFqNgIYIAIgAToAACABEKcPCwUAELMSCwUAELQSCwUAELUSC3wBA38jAEEQayIEJAAgAEEANgIEIARBCGogAEEBEPsREPIHIQMgACAAKAIAQXRqKAIAaiEFAkAgAwRAIAAgBRDLDiABIAIQihIiAzYCBCACIANGDQEgACAAKAIAQXRqKAIAakEGEMoODAELIAVBBBDKDgsgBEEQaiQAIAALEwAgACABIAIgACgCACgCIBEFAAsHACAAEKEPCwkAIAAgARCNEgsQACAAIAAoAhhFIAFyNgIQC40BAQJ/IwBBMGsiAyQAIAAgACgCAEF0aigCAGoiBCAEEIsSQX1xEIwSAkAgA0EoaiAAQQEQ+xEQ8gdFDQAgA0EYaiAAIAAoAgBBdGooAgBqEMsOIAEgAkEIEOcOIANBGGogA0EIakJ/EOgOEOkORQ0AIAAgACgCAEF0aigCAGpBBBDKDgsgA0EwaiQAIAALFgAgAEGIjQEQ1QwiAEEIahDfERogAAsTACAAIAAoAgBBdGooAgBqEI8SCwoAIAAQjxIQzxgLEwAgACAAKAIAQXRqKAIAahCREgtxAQJ/IwBBEGsiASQAIAAgACgCAEF0aigCAGoQyw4EQAJAIAFBCGogABCaEiICEPIHRQ0AIAAgACgCAEF0aigCAGoQyw4Qlw9Bf0cNACAAIAAoAgBBdGooAgBqQQEQyg4LIAIQhBIaCyABQRBqJAAgAAsLACAAQdCPAxC4EwsMACAAIAEQmxJBAXMLCgAgACgCABCcEgsTACAAIAEgAiAAKAIAKAIMEQUACw0AIAAoAgAQnRIaIAALCQAgACABEJsSC1YAIAAgATYCBCAAQQA6AAAgASABKAIAQXRqKAIAahD8EQRAIAEgASgCAEF0aigCAGoQ/REEQCABIAEoAgBBdGooAgBqEP0REJMSGgsgAEEBOgAACyAACxAAIAAQthIgARC2EnNBAXMLKgEBfyAAKAIMIgEgACgCEEYEQCAAIAAoAgAoAiQRAAAPCyABKAIAEKoBCzQBAX8gACgCDCIBIAAoAhBGBEAgACAAKAIAKAIoEQAADwsgACABQQRqNgIMIAEoAgAQqgELPQEBfyAAKAIYIgIgACgCHEYEQCAAIAEQqgEgACgCACgCNBEDAA8LIAAgAkEEajYCGCACIAE2AgAgARCqAQsWACAAQbiNARDVDCIAQQRqEN8RGiAACxMAIAAgACgCAEF0aigCAGoQnxILCgAgABCfEhDPGAsTACAAIAAoAgBBdGooAgBqEKESCwsAIABBrI4DELgTC98BAQd/IwBBIGsiAiQAAkAgAkEYaiAAEIMSIgUQ8gdFDQAgACAAKAIAQXRqKAIAahDoBSEDIAJBEGogACAAKAIAQXRqKAIAahD/ESACQRBqEKMSIQYgAkEQahCzExogAkEIaiAAEMQOIQQgACAAKAIAQXRqKAIAaiIHEMoPIQggAiAGIAQoAgAgByAIIAFB//8DcSIEIAQgASADQcoAcSIDQQhGGyADQcAARhsQpRI2AhAgAkEQahDMD0UNACAAIAAoAgBBdGooAgBqQQUQyg4LIAUQhBIaIAJBIGokACAACxcAIAAgASACIAMgBCAAKAIAKAIQEQsACxcAIAAgASACIAMgBCAAKAIAKAIYEQsAC8ABAQZ/IwBBIGsiAiQAAkAgAkEYaiAAEIMSIgMQ8gdFDQAgACAAKAIAQXRqKAIAahDoBRogAkEQaiAAIAAoAgBBdGooAgBqEP8RIAJBEGoQoxIhBCACQRBqELMTGiACQQhqIAAQxA4hBSAAIAAoAgBBdGooAgBqIgYQyg8hByACIAQgBSgCACAGIAcgARClEjYCECACQRBqEMwPRQ0AIAAgACgCAEF0aigCAGpBBRDKDgsgAxCEEhogAkEgaiQAIAALrgEBBn8jAEEgayICJAACQCACQRhqIAAQgxIiAxDyB0UNACACQRBqIAAgACgCAEF0aigCAGoQ/xEgAkEQahCjEiEEIAJBEGoQsxMaIAJBCGogABDEDiEFIAAgACgCAEF0aigCAGoiBhDKDyEHIAIgBCAFKAIAIAYgByABEKYSNgIQIAJBEGoQzA9FDQAgACAAKAIAQXRqKAIAakEFEMoOCyADEIQSGiACQSBqJAAgAAsqAQF/AkAgACgCACICRQ0AIAIgARCFEhD2BRCCBUUNACAAQQA2AgALIAALXgEDfyMAQRBrIgIkAAJAIAJBCGogABCDEiIDEPIHRQ0AIAIgABDEDiIEEKoBIAEQqRIaIAQQzA9FDQAgACAAKAIAQXRqKAIAakEBEMoOCyADEIQSGiACQRBqJAAgAAsWACAAQeiNARDVDCIAQQRqEN8RGiAACxMAIAAgACgCAEF0aigCAGoQqxILCgAgABCrEhDPGAsTACAAIAAoAgBBdGooAgBqEK0SCyoBAX8CQCAAKAIAIgJFDQAgAiABEJ4SEPYFEIIFRQ0AIABBADYCAAsgAAsWACAAEMkJGiAAIAEgARDaDhDYGCAACwoAIAAQ4BEQzxgLQQAgAEEANgIUIAAgATYCGCAAQQA2AgwgAEKCoICA4AA3AgQgACABRTYCECAAQSBqQQBBKBD/GRogAEEcahDtFhoLBgBBgIB+CwYAQf//AQsIAEGAgICAeAstAQF/IAAoAgAiAQRAIAEQnBIQ9gUQggVFBEAgACgCAEUPCyAAQQA2AgALQQELEQAgACABIAAoAgAoAiwRAwALkwEBA39BfyECAkAgAEF/Rg0AQQAhAyABKAJMQQBOBEAgARCuBCEDCwJAAkAgASgCBCIERQRAIAEQnREaIAEoAgQiBEUNAQsgBCABKAIsQXhqSw0BCyADRQ0BIAEQsQVBfw8LIAEgBEF/aiICNgIEIAIgADoAACABIAEoAgBBb3E2AgAgAwRAIAEQsQULIAAhAgsgAgsKAEGQiwMQuhIaC4UDAQF/QZSLA0HEkgEoAgAiAUHMiwMQvRIaQeiFA0GUiwMQvhIaQdSLAyABQYyMAxC/EhpBwIYDQdSLAxDAEhpBlIwDQcDzACgCACIBQcSMAxDBEhpBmIcDQZSMAxDCEhpBzIwDIAFB/IwDEMMSGkHshwNBzIwDEMQSGkGEjQNBqPIAKAIAIgFBtI0DEMESGkHAiANBhI0DEMISGkHoiQNBwIgDKAIAQXRqKAIAQcCIA2oQyw4QwhIaQbyNAyABQeyNAxDDEhpBlIkDQbyNAxDEEhpBvIoDQZSJAygCAEF0aigCAEGUiQNqEMsOEMQSGkHohQMoAgBBdGooAgBB6IUDakGYhwMQxRIaQcCGAygCAEF0aigCAEHAhgNqQeyHAxDFEhpBwIgDKAIAQXRqKAIAQcCIA2oQxhIaQZSJAygCAEF0aigCAEGUiQNqEMYSGkHAiAMoAgBBdGooAgBBwIgDakGYhwMQxRIaQZSJAygCAEF0aigCAEGUiQNqQeyHAxDFEhogAAsKAEGQiwMQvBIaCyQAQZiHAxD+ERpB7IcDEJMSGkHoiQMQ/hEaQbyKAxCTEhogAAtsAQJ/IwBBEGsiAyQAIAAQ5REhBCAAIAI2AiggACABNgIgIABB0JIBNgIAEPYFIQEgAEEAOgA0IAAgATYCMCADQQhqIAQQwg8gACADQQhqIAAoAgAoAggRAgAgA0EIahCzExogA0EQaiQAIAALOAEBfyAAQQhqEMcOIQIgAEG8jAE2AgAgAkHQjAE2AgAgAEEANgIEIABBsIwBKAIAaiABEMEPIAALbAECfyMAQRBrIgMkACAAEPERIQQgACACNgIoIAAgATYCICAAQdyTATYCABD2BSEBIABBADoANCAAIAE2AjAgA0EIaiAEEMIPIAAgA0EIaiAAKAIAKAIIEQIAIANBCGoQsxMaIANBEGokACAACzgBAX8gAEEIahDHEiECIABB7IwBNgIAIAJBgI0BNgIAIABBADYCBCAAQeCMASgCAGogARDBDyAAC2IBAn8jAEEQayIDJAAgABDlESEEIAAgATYCICAAQcCUATYCACADQQhqIAQQwg8gA0EIahCQDyEBIANBCGoQsxMaIAAgAjYCKCAAIAE2AiQgACABEJEPOgAsIANBEGokACAACzEBAX8gAEEEahDHDiECIABBnI0BNgIAIAJBsI0BNgIAIABBkI0BKAIAaiABEMEPIAALYgECfyMAQRBrIgMkACAAEPERIQQgACABNgIgIABBqJUBNgIAIANBCGogBBDCDyADQQhqEMgSIQEgA0EIahCzExogACACNgIoIAAgATYCJCAAIAEQkQ86ACwgA0EQaiQAIAALMQEBfyAAQQRqEMcSIQIgAEHMjQE2AgAgAkHgjQE2AgAgAEHAjQEoAgBqIAEQwQ8gAAsUAQF/IAAoAkghAiAAIAE2AkggAgsOACAAQYDAABDJEhogAAsTACAAEMAPGiAAQeyOATYCACAACwsAIABB6I8DELgTCxMAIAAgACgCBCIAIAFyNgIEIAALDQAgABDjERogABDPGAs4ACAAIAEQkA8iATYCJCAAIAEQlw82AiwgACAAKAIkEJEPOgA1IAAoAixBCU4EQEGskwEQgxUACwsJACAAQQAQzRILkQMCBX8BfiMAQSBrIgIkAAJAIAAtADQEQCAAKAIwIQMgAUUNARD2BSEEIABBADoANCAAIAQ2AjAMAQsgAkEBNgIYIAJBGGogAEEsahDQEigCACEEQQAhAwJAAkACQANAIAMgBEgEQCAAKAIgEKIRIgVBf0YNAiACQRhqIANqIAU6AAAgA0EBaiEDDAELCwJAIAAtADUEQCACIAItABg6ABcMAQsgAkEYaiEGA0AgACgCKCIDKQIAIQcgACgCJCADIAJBGGogAkEYaiAEaiIFIAJBEGogAkEXaiAGIAJBDGoQqA9Bf2oiA0ECSw0BAkACQCADQQFrDgIEAQALIAAoAiggBzcCACAEQQhGDQMgACgCIBCiESIDQX9GDQMgBSADOgAAIARBAWohBAwBCwsgAiACLQAYOgAXCyABDQEDQCAEQQFIDQMgBEF/aiIEIAJBGGpqLAAAEKcPIAAoAiAQuBJBf0cNAAsLEPYFIQMMAgsgACACLAAXEKcPNgIwCyACLAAXEKcPIQMLIAJBIGokACADCwkAIABBARDNEguKAgEDfyMAQSBrIgIkACABEPYFEIIFIQMgAC0ANCEEAkAgAwRAIAEhAyAEDQEgACAAKAIwIgMQ9gUQggVBAXM6ADQMAQsgBARAIAIgACgCMBCsDzoAEwJ/AkAgACgCJCAAKAIoIAJBE2ogAkEUaiACQQxqIAJBGGogAkEgaiACQRRqELEPQX9qIgNBAk0EQCADQQJrDQEgACgCMCEDIAIgAkEZajYCFCACIAM6ABgLA0BBASACKAIUIgMgAkEYak0NAhogAiADQX9qIgM2AhQgAywAACAAKAIgELgSQX9HDQALCxD2BSEDQQALRQ0BCyAAQQE6ADQgACABNgIwIAEhAwsgAkEgaiQAIAMLCQAgACABELQPCw0AIAAQ7xEaIAAQzxgLOAAgACABEMgSIgE2AiQgACABEJcPNgIsIAAgACgCJBCRDzoANSAAKAIsQQlOBEBBrJMBEIMVAAsLCQAgAEEAENQSC5EDAgV/AX4jAEEgayICJAACQCAALQA0BEAgACgCMCEDIAFFDQEQ9gUhBCAAQQA6ADQgACAENgIwDAELIAJBATYCGCACQRhqIABBLGoQ0BIoAgAhBEEAIQMCQAJAAkADQCADIARIBEAgACgCIBCiESIFQX9GDQIgAkEYaiADaiAFOgAAIANBAWohAwwBCwsCQCAALQA1BEAgAiACLAAYNgIUDAELIAJBGGohBgNAIAAoAigiAykCACEHIAAoAiQgAyACQRhqIAJBGGogBGoiBSACQRBqIAJBFGogBiACQQxqEKgPQX9qIgNBAksNAQJAAkAgA0EBaw4CBAEACyAAKAIoIAc3AgAgBEEIRg0DIAAoAiAQohEiA0F/Rg0DIAUgAzoAACAEQQFqIQQMAQsLIAIgAiwAGDYCFAsgAQ0BA0AgBEEBSA0DIARBf2oiBCACQRhqaiwAABCqASAAKAIgELgSQX9HDQALCxD2BSEDDAILIAAgAigCFBCqATYCMAsgAigCFBCqASEDCyACQSBqJAAgAwsJACAAQQEQ1BILigIBA38jAEEgayICJAAgARD2BRCCBSEDIAAtADQhBAJAIAMEQCABIQMgBA0BIAAgACgCMCIDEPYFEIIFQQFzOgA0DAELIAQEQCACIAAoAjAQqgE2AhACfwJAIAAoAiQgACgCKCACQRBqIAJBFGogAkEMaiACQRhqIAJBIGogAkEUahCxD0F/aiIDQQJNBEAgA0ECaw0BIAAoAjAhAyACIAJBGWo2AhQgAiADOgAYCwNAQQEgAigCFCIDIAJBGGpNDQIaIAIgA0F/aiIDNgIUIAMsAAAgACgCIBC4EkF/Rw0ACwsQ9gUhA0EAC0UNAQsgAEEBOgA0IAAgATYCMCABIQMLIAJBIGokACADCyYAIAAgACgCACgCGBEAABogACABEJAPIgE2AiQgACABEJEPOgAsC4gBAQV/IwBBEGsiASQAIAFBEGohBAJAA0AgACgCJCAAKAIoIAFBCGogBCABQQRqEKAPIQVBfyEDIAFBCGpBASABKAIEIAFBCGprIgIgACgCIBCAESACRw0BIAVBf2oiAkEBTQRAIAJBAWsNAQwCCwtBf0EAIAAoAiAQhhEbIQMLIAFBEGokACADC10BAX8CQCAALQAsRQRAQQAhAwNAIAMgAk4NAiAAIAEsAAAQpw8gACgCACgCNBEDABD2BUYNAiABQQFqIQEgA0EBaiEDDAAACwALIAFBASACIAAoAiAQgBEhAwsgAwuCAgEFfyMAQSBrIgIkAAJ/AkACQCABEPYFEIIFDQAgAiABEKwPOgAXIAAtACwEQCACQRdqQQFBASAAKAIgEIARQQFGDQEMAgsgAiACQRhqNgIQIAJBIGohBSACQRhqIQYgAkEXaiEDA0AgACgCJCAAKAIoIAMgBiACQQxqIAJBGGogBSACQRBqELEPIQQgAigCDCADRg0CIARBA0YEQCADQQFBASAAKAIgEIARQQFHDQMMAgsgBEEBSw0CIAJBGGpBASACKAIQIAJBGGprIgMgACgCIBCAESADRw0CIAIoAgwhAyAEQQFGDQALCyABEKsPDAELEPYFCyEAIAJBIGokACAACyYAIAAgACgCACgCGBEAABogACABEMgSIgE2AiQgACABEJEPOgAsC10BAX8CQCAALQAsRQRAQQAhAwNAIAMgAk4NAiAAIAEoAgAQqgEgACgCACgCNBEDABD2BUYNAiABQQRqIQEgA0EBaiEDDAAACwALIAFBBCACIAAoAiAQgBEhAwsgAwuCAgEFfyMAQSBrIgIkAAJ/AkACQCABEPYFEIIFDQAgAiABEKoBNgIUIAAtACwEQCACQRRqQQRBASAAKAIgEIARQQFGDQEMAgsgAiACQRhqNgIQIAJBIGohBSACQRhqIQYgAkEUaiEDA0AgACgCJCAAKAIoIAMgBiACQQxqIAJBGGogBSACQRBqELEPIQQgAigCDCADRg0CIARBA0YEQCADQQFBASAAKAIgEIARQQFHDQMMAgsgBEEBSw0CIAJBGGpBASACKAIQIAJBGGprIgMgACgCIBCAESADRw0CIAIoAgwhAyAEQQFGDQALCyABEKsPDAELEPYFCyEAIAJBIGokACAACwUAELkSCxAAIABBIEYgAEF3akEFSXILRgICfwF+IAAgATcDcCAAIAAoAggiAiAAKAIEIgNrrCIENwN4AkAgAVANACAEIAFXDQAgACADIAGnajYCaA8LIAAgAjYCaAvCAQIDfwF+AkACQCAAKQNwIgRQRQRAIAApA3ggBFkNAQsgABChESIDQX9KDQELIABBADYCaEF/DwsgACgCCCEBAkACQCAAKQNwIgRQDQAgBCAAKQN4Qn+FfCIEIAEgACgCBCICa6xZDQAgACACIASnajYCaAwBCyAAIAE2AmgLAkAgAUUEQCAAKAIEIQIMAQsgACAAKQN4IAEgACgCBCICa0EBaqx8NwN4CyACQX9qIgAtAAAgA0cEQCAAIAM6AAALIAMLdQEBfiAAIAEgBH4gAiADfnwgA0IgiCIEIAFCIIgiAn58IANC/////w+DIgMgAUL/////D4MiAX4iBUIgiCACIAN+fCIDQiCIfCABIAR+IANC/////w+DfCIDQiCIfDcDCCAAIAVC/////w+DIANCIIaENwMAC+4KAgV/BH4jAEEQayIHJAACQAJAAkACQAJAIAFBJE0EQANAAn8gACgCBCIEIAAoAmhJBEAgACAEQQFqNgIEIAQtAAAMAQsgABDhEgsiBBDfEg0AC0EAIQYCQCAEQVVqIgVBAksNACAFQQFrRQ0AQX9BACAEQS1GGyEGIAAoAgQiBCAAKAJoSQRAIAAgBEEBajYCBCAELQAAIQQMAQsgABDhEiEECwJAAkAgAUFvcQ0AIARBMEcNAAJ/IAAoAgQiBCAAKAJoSQRAIAAgBEEBajYCBCAELQAADAELIAAQ4RILIgRBIHJB+ABGBEBBECEBAn8gACgCBCIEIAAoAmhJBEAgACAEQQFqNgIEIAQtAAAMAQsgABDhEgsiBEGRlgFqLQAAQRBJDQUgACgCaCIEBEAgACAAKAIEQX9qNgIECyACBEBCACEDIARFDQkgACAAKAIEQX9qNgIEDAkLQgAhAyAAQgAQ4BIMCAsgAQ0BQQghAQwECyABQQogARsiASAEQZGWAWotAABLDQAgACgCaARAIAAgACgCBEF/ajYCBAtCACEDIABCABDgEhCpEUEcNgIADAYLIAFBCkcNAkIAIQkgBEFQaiICQQlNBEBBACEBA0AgAiABQQpsaiEBAn8gACgCBCIEIAAoAmhJBEAgACAEQQFqNgIEIAQtAAAMAQsgABDhEgsiBEFQaiICQQlNQQAgAUGZs+bMAUkbDQALIAGtIQkLIAJBCUsNASAJQgp+IQogAq0hCwNAIAogC3whCQJ/IAAoAgQiBCAAKAJoSQRAIAAgBEEBajYCBCAELQAADAELIAAQ4RILIgRBUGoiAkEJSw0CIAlCmrPmzJmz5swZWg0CIAlCCn4iCiACrSILQn+FWA0AC0EKIQEMAwsQqRFBHDYCAEIAIQMMBAtBCiEBIAJBCU0NAQwCCyABIAFBf2pxBEBCACEJIAEgBEGRlgFqLQAAIgJLBEBBACEFA0AgAiABIAVsaiIFQcbj8ThNQQAgAQJ/IAAoAgQiBCAAKAJoSQRAIAAgBEEBajYCBCAELQAADAELIAAQ4RILIgRBkZYBai0AACICSxsNAAsgBa0hCQsgASACTQ0BIAGtIQoDQCAJIAp+IgsgAq1C/wGDIgxCf4VWDQIgCyAMfCEJIAECfyAAKAIEIgQgACgCaEkEQCAAIARBAWo2AgQgBC0AAAwBCyAAEOESCyIEQZGWAWotAAAiAk0NAiAHIApCACAJQgAQ4hIgBykDCFANAAsMAQtCACEJQn8gAUEXbEEFdkEHcUGRmAFqLAAAIgitIgqIIgsCfiABIARBkZYBai0AACICSwRAQQAhBQNAIAIgBSAIdHIiBUH///8/TUEAIAECfyAAKAIEIgQgACgCaEkEQCAAIARBAWo2AgQgBC0AAAwBCyAAEOESCyIEQZGWAWotAAAiAksbDQALIAWtIQkLIAkLVA0AIAEgAk0NAANAIAKtQv8BgyAJIAqGhCEJAn8gACgCBCIEIAAoAmhJBEAgACAEQQFqNgIEIAQtAAAMAQsgABDhEgshBCAJIAtWDQEgASAEQZGWAWotAAAiAksNAAsLIAEgBEGRlgFqLQAATQ0AA0AgAQJ/IAAoAgQiBCAAKAJoSQRAIAAgBEEBajYCBCAELQAADAELIAAQ4RILQZGWAWotAABLDQALEKkRQcQANgIAIAZBACADQgGDUBshBiADIQkLIAAoAmgEQCAAIAAoAgRBf2o2AgQLAkAgCSADVA0AAkAgA6dBAXENACAGDQAQqRFBxAA2AgAgA0J/fCEDDAILIAkgA1gNABCpEUHEADYCAAwBCyAJIAasIgOFIAN9IQMLIAdBEGokACADC+wCAQZ/IwBBEGsiByQAIANB9I0DIAMbIgUoAgAhAwJAAkACQCABRQRAIAMNAUEAIQQMAwtBfiEEIAJFDQIgACAHQQxqIAAbIQYCQCADBEAgAiEADAELIAEtAAAiA0EYdEEYdSIAQQBOBEAgBiADNgIAIABBAEchBAwECxCwESgCsAEoAgAhAyABLAAAIQAgA0UEQCAGIABB/78DcTYCAEEBIQQMBAsgAEH/AXFBvn5qIgNBMksNASADQQJ0QaCYAWooAgAhAyACQX9qIgBFDQIgAUEBaiEBCyABLQAAIghBA3YiCUFwaiADQRp1IAlqckEHSw0AA0AgAEF/aiEAIAhBgH9qIANBBnRyIgNBAE4EQCAFQQA2AgAgBiADNgIAIAIgAGshBAwECyAARQ0CIAFBAWoiAS0AACIIQcABcUGAAUYNAAsLIAVBADYCABCpEUEZNgIAQX8hBAwBCyAFIAM2AgALIAdBEGokACAECxEAIABFBEBBAQ8LIAAoAgBFC9cBAgR/An4jAEEQayIDJAAgAbwiBEGAgICAeHEhBQJ+IARB/////wdxIgJBgICAfGpB////9wdNBEBCACEGIAKtQhmGQoCAgICAgIDAP3wMAQsgAkGAgID8B08EQEIAIQYgBK1CGYZCgICAgICAwP//AIQMAQsgAkUEQEIAIQZCAAwBCyADIAKtQgAgAmciAkHRAGoQxBEgAykDACEGIAMpAwhCgICAgICAwACFQYn/ACACa61CMIaECyEHIAAgBjcDACAAIAcgBa1CIIaENwMIIANBEGokAAuiCwIFfw9+IwBB4ABrIgUkACAEQi+GIANCEYiEIQ4gAkIghiABQiCIhCELIARC////////P4MiDEIPhiADQjGIhCEQIAIgBIVCgICAgICAgICAf4MhCiAMQhGIIREgAkL///////8/gyINQiCIIRIgBEIwiKdB//8BcSEGAkACfyACQjCIp0H//wFxIghBf2pB/f8BTQRAQQAgBkF/akH+/wFJDQEaCyABUCACQv///////////wCDIg9CgICAgICAwP//AFQgD0KAgICAgIDA//8AURtFBEAgAkKAgICAgIAghCEKDAILIANQIARC////////////AIMiAkKAgICAgIDA//8AVCACQoCAgICAgMD//wBRG0UEQCAEQoCAgICAgCCEIQogAyEBDAILIAEgD0KAgICAgIDA//8AhYRQBEAgAiADhFAEQEKAgICAgIDg//8AIQpCACEBDAMLIApCgICAgICAwP//AIQhCkIAIQEMAgsgAyACQoCAgICAgMD//wCFhFAEQCABIA+EIQJCACEBIAJQBEBCgICAgICA4P//ACEKDAMLIApCgICAgICAwP//AIQhCgwCCyABIA+EUARAQgAhAQwCCyACIAOEUARAQgAhAQwCC0EAIQcgD0L///////8/WARAIAVB0ABqIAEgDSABIA0gDVAiBxt5IAdBBnStfKciB0FxahDEESAFKQNYIg1CIIYgBSkDUCIBQiCIhCELIA1CIIghEkEQIAdrIQcLIAcgAkL///////8/Vg0AGiAFQUBrIAMgDCADIAwgDFAiCRt5IAlBBnStfKciCUFxahDEESAFKQNIIgJCD4YgBSkDQCIDQjGIhCEQIAJCL4YgA0IRiIQhDiACQhGIIREgByAJa0EQagshByAOQv////8PgyICIAFC/////w+DIgR+IhMgA0IPhkKAgP7/D4MiASALQv////8PgyIDfnwiDkIghiIMIAEgBH58IgsgDFStIAIgA34iFSABIA1C/////w+DIgx+fCIPIBBC/////w+DIg0gBH58IhAgDiATVK1CIIYgDkIgiIR8IhMgAiAMfiIWIAEgEkKAgASEIg5+fCISIAMgDX58IhQgEUL/////B4NCgICAgAiEIgEgBH58IhFCIIZ8Ihd8IQQgBiAIaiAHakGBgH9qIQYCQCAMIA1+IhggAiAOfnwiAiAYVK0gAiABIAN+fCIDIAJUrXwgAyAPIBVUrSAQIA9UrXx8IgIgA1StfCABIA5+fCABIAx+IgMgDSAOfnwiASADVK1CIIYgAUIgiIR8IAIgAUIghnwiASACVK18IAEgESAUVK0gEiAWVK0gFCASVK18fEIghiARQiCIhHwiAyABVK18IAMgEyAQVK0gFyATVK18fCICIANUrXwiAUKAgICAgIDAAINQRQRAIAZBAWohBgwBCyALQj+IIQMgAUIBhiACQj+IhCEBIAJCAYYgBEI/iIQhAiALQgGGIQsgAyAEQgGGhCEECyAGQf//AU4EQCAKQoCAgICAgMD//wCEIQpCACEBDAELAn4gBkEATARAQQEgBmsiCEH/AE0EQCAFQRBqIAsgBCAIEMMRIAVBIGogAiABIAZB/wBqIgYQxBEgBUEwaiALIAQgBhDEESAFIAIgASAIEMMRIAUpAzAgBSkDOIRCAFKtIAUpAyAgBSkDEISEIQsgBSkDKCAFKQMYhCEEIAUpAwAhAiAFKQMIDAILQgAhAQwCCyABQv///////z+DIAatQjCGhAsgCoQhCiALUCAEQn9VIARCgICAgICAgICAf1EbRQRAIAogAkIBfCIBIAJUrXwhCgwBCyALIARCgICAgICAgICAf4WEUEUEQCACIQEMAQsgCiACIAJCAYN8IgEgAlStfCEKCyAAIAE3AwAgACAKNwMIIAVB4ABqJAALgwECAn8BfiMAQRBrIgMkACAAAn4gAUUEQEIAIQRCAAwBCyADIAEgAUEfdSICaiACcyICrUIAIAJnIgJB0QBqEMQRIAMpAwhCgICAgICAwACFQZ6AASACa61CMIZ8IAFBgICAgHhxrUIghoQhBCADKQMACzcDACAAIAQ3AwggA0EQaiQAC8gJAgR/BH4jAEHwAGsiBSQAIARC////////////AIMhCgJAAkAgAUJ/fCIJQn9RIAJC////////////AIMiCyAJIAFUrXxCf3wiCUL///////+///8AViAJQv///////7///wBRG0UEQCADQn98IglCf1IgCiAJIANUrXxCf3wiCUL///////+///8AVCAJQv///////7///wBRGw0BCyABUCALQoCAgICAgMD//wBUIAtCgICAgICAwP//AFEbRQRAIAJCgICAgICAIIQhBCABIQMMAgsgA1AgCkKAgICAgIDA//8AVCAKQoCAgICAgMD//wBRG0UEQCAEQoCAgICAgCCEIQQMAgsgASALQoCAgICAgMD//wCFhFAEQEKAgICAgIDg//8AIAIgASADhSACIASFQoCAgICAgICAgH+FhFAiBhshBEIAIAEgBhshAwwCCyADIApCgICAgICAwP//AIWEUA0BIAEgC4RQBEAgAyAKhEIAUg0CIAEgA4MhAyACIASDIQQMAgsgAyAKhFBFDQAgASEDIAIhBAwBCyADIAEgAyABViAKIAtWIAogC1EbIgcbIQogBCACIAcbIgtC////////P4MhCSACIAQgBxsiAkIwiKdB//8BcSEIIAtCMIinQf//AXEiBkUEQCAFQeAAaiAKIAkgCiAJIAlQIgYbeSAGQQZ0rXynIgZBcWoQxBEgBSkDaCEJIAUpA2AhCkEQIAZrIQYLIAEgAyAHGyEDIAJC////////P4MhASAIBH4gAQUgBUHQAGogAyABIAMgASABUCIHG3kgB0EGdK18pyIHQXFqEMQRQRAgB2shCCAFKQNQIQMgBSkDWAtCA4YgA0I9iIRCgICAgICAgASEIQQgCUIDhiAKQj2IhCEBIAIgC4UhCQJ+IANCA4YiAyAGIAhrIgdFDQAaIAdB/wBLBEBCACEEQgEMAQsgBUFAayADIARBgAEgB2sQxBEgBUEwaiADIAQgBxDDESAFKQM4IQQgBSkDMCAFKQNAIAUpA0iEQgBSrYQLIQMgAUKAgICAgICABIQhDCAKQgOGIQICQCAJQn9XBEAgAiADfSIBIAwgBH0gAiADVK19IgOEUARAQgAhA0IAIQQMAwsgA0L/////////A1YNASAFQSBqIAEgAyABIAMgA1AiBxt5IAdBBnStfKdBdGoiBxDEESAGIAdrIQYgBSkDKCEDIAUpAyAhAQwBCyACIAN8IgEgA1StIAQgDHx8IgNCgICAgICAgAiDUA0AIAFCAYMgA0I/hiABQgGIhIQhASAGQQFqIQYgA0IBiCEDCyALQoCAgICAgICAgH+DIQQgBkH//wFOBEAgBEKAgICAgIDA//8AhCEEQgAhAwwBC0EAIQcCQCAGQQBKBEAgBiEHDAELIAVBEGogASADIAZB/wBqEMQRIAUgASADQQEgBmsQwxEgBSkDACAFKQMQIAUpAxiEQgBSrYQhASAFKQMIIQMLIANCA4hC////////P4MgBIQgB61CMIaEIANCPYYgAUIDiIQiBCABp0EHcSIGQQRLrXwiAyAEVK18IANCAYNCACAGQQRGGyIBIAN8IgMgAVStfCEECyAAIAM3AwAgACAENwMIIAVB8ABqJAALhQICAn8EfiMAQRBrIgIkACABvSIFQoCAgICAgICAgH+DIQcCfiAFQv///////////wCDIgRCgICAgICAgHh8Qv/////////v/wBYBEAgBEI8hiEGIARCBIhCgICAgICAgIA8fAwBCyAEQoCAgICAgID4/wBaBEAgBUI8hiEGIAVCBIhCgICAgICAwP//AIQMAQsgBFAEQEIAIQZCAAwBCyACIARCACAEQoCAgIAQWgR/IARCIIinZwUgBadnQSBqCyIDQTFqEMQRIAIpAwAhBiACKQMIQoCAgICAgMAAhUGM+AAgA2utQjCGhAshBCAAIAY3AwAgACAEIAeENwMIIAJBEGokAAvbAQIBfwJ+QQEhBAJAIABCAFIgAUL///////////8AgyIFQoCAgICAgMD//wBWIAVCgICAgICAwP//AFEbDQAgAkIAUiADQv///////////wCDIgZCgICAgICAwP//AFYgBkKAgICAgIDA//8AURsNACAAIAKEIAUgBoSEUARAQQAPCyABIAODQgBZBEBBfyEEIAAgAlQgASADUyABIANRGw0BIAAgAoUgASADhYRCAFIPC0F/IQQgACACViABIANVIAEgA1EbDQAgACAChSABIAOFhEIAUiEECyAEC9MBAgF/An5BfyEEAkAgAEIAUiABQv///////////wCDIgVCgICAgICAwP//AFYgBUKAgICAgIDA//8AURsNACACQgBSIANC////////////AIMiBkKAgICAgIDA//8AViAGQoCAgICAgMD//wBRGw0AIAAgAoQgBSAGhIRQBEBBAA8LIAEgA4NCAFkEQCAAIAJUIAEgA1MgASADURsNASAAIAKFIAEgA4WEQgBSDwsgACACViABIANVIAEgA1EbDQAgACAChSABIAOFhEIAUiEECyAECzUAIAAgATcDACAAIAJC////////P4MgBEIwiKdBgIACcSACQjCIp0H//wFxcq1CMIaENwMIC2sCAX8BfiMAQRBrIgIkACAAAn4gAUUEQEIAIQNCAAwBCyACIAGtQgBB8AAgAWdBH3MiAWsQxBEgAikDCEKAgICAgIDAAIUgAUH//wBqrUIwhnwhAyACKQMACzcDACAAIAM3AwggAkEQaiQAC0UBAX8jAEEQayIFJAAgBSABIAIgAyAEQoCAgICAgICAgH+FEOkSIAUpAwAhASAAIAUpAwg3AwggACABNwMAIAVBEGokAAvEAgEBfyMAQdAAayIEJAACQCADQYCAAU4EQCAEQSBqIAEgAkIAQoCAgICAgID//wAQ5xIgBCkDKCECIAQpAyAhASADQf//AUgEQCADQYGAf2ohAwwCCyAEQRBqIAEgAkIAQoCAgICAgID//wAQ5xIgA0H9/wIgA0H9/wJIG0GCgH5qIQMgBCkDGCECIAQpAxAhAQwBCyADQYGAf0oNACAEQUBrIAEgAkIAQoCAgICAgMAAEOcSIAQpA0ghAiAEKQNAIQEgA0GDgH5KBEAgA0H+/wBqIQMMAQsgBEEwaiABIAJCAEKAgICAgIDAABDnEiADQYaAfSADQYaAfUobQfz/AWohAyAEKQM4IQIgBCkDMCEBCyAEIAEgAkIAIANB//8Aaq1CMIYQ5xIgACAEKQMINwMIIAAgBCkDADcDACAEQdAAaiQAC+cQAgV/DH4jAEHAAWsiBSQAIARC////////P4MhEiACQv///////z+DIQ4gAiAEhUKAgICAgICAgIB/gyERIARCMIinQf//AXEhBwJAAkACQCACQjCIp0H//wFxIglBf2pB/f8BTQRAQQAhBiAHQX9qQf7/AUkNAQsgAVAgAkL///////////8AgyILQoCAgICAgMD//wBUIAtCgICAgICAwP//AFEbRQRAIAJCgICAgICAIIQhEQwCCyADUCAEQv///////////wCDIgJCgICAgICAwP//AFQgAkKAgICAgIDA//8AURtFBEAgBEKAgICAgIAghCERIAMhAQwCCyABIAtCgICAgICAwP//AIWEUARAIAMgAkKAgICAgIDA//8AhYRQBEBCACEBQoCAgICAgOD//wAhEQwDCyARQoCAgICAgMD//wCEIRFCACEBDAILIAMgAkKAgICAgIDA//8AhYRQBEBCACEBDAILIAEgC4RQDQIgAiADhFAEQCARQoCAgICAgMD//wCEIRFCACEBDAILQQAhBiALQv///////z9YBEAgBUGwAWogASAOIAEgDiAOUCIGG3kgBkEGdK18pyIGQXFqEMQRQRAgBmshBiAFKQO4ASEOIAUpA7ABIQELIAJC////////P1YNACAFQaABaiADIBIgAyASIBJQIggbeSAIQQZ0rXynIghBcWoQxBEgBiAIakFwaiEGIAUpA6gBIRIgBSkDoAEhAwsgBUGQAWogEkKAgICAgIDAAIQiFEIPhiADQjGIhCICQgBChMn5zr/mvIL1ACACfSIEQgAQ4hIgBUGAAWpCACAFKQOYAX1CACAEQgAQ4hIgBUHwAGogBSkDiAFCAYYgBSkDgAFCP4iEIgRCACACQgAQ4hIgBUHgAGogBEIAQgAgBSkDeH1CABDiEiAFQdAAaiAFKQNoQgGGIAUpA2BCP4iEIgRCACACQgAQ4hIgBUFAayAEQgBCACAFKQNYfUIAEOISIAVBMGogBSkDSEIBhiAFKQNAQj+IhCIEQgAgAkIAEOISIAVBIGogBEIAQgAgBSkDOH1CABDiEiAFQRBqIAUpAyhCAYYgBSkDIEI/iIQiBEIAIAJCABDiEiAFIARCAEIAIAUpAxh9QgAQ4hIgBiAJIAdraiEHAn5CACAFKQMIQgGGIAUpAwBCP4iEQn98IgtC/////w+DIgQgAkIgiCIMfiIQIAtCIIgiCyACQv////8PgyIKfnwiAkIghiINIAQgCn58IgogDVStIAsgDH4gAiAQVK1CIIYgAkIgiIR8fCAKIAQgA0IRiEL/////D4MiDH4iECALIANCD4ZCgID+/w+DIg1+fCICQiCGIg8gBCANfnwgD1StIAsgDH4gAiAQVK1CIIYgAkIgiIR8fHwiAiAKVK18IAJCAFKtfH0iCkL/////D4MiDCAEfiIQIAsgDH4iDSAEIApCIIgiD358IgpCIIZ8IgwgEFStIAsgD34gCiANVK1CIIYgCkIgiIR8fCAMQgAgAn0iAkIgiCIKIAR+IhAgAkL/////D4MiDSALfnwiAkIghiIPIAQgDX58IA9UrSAKIAt+IAIgEFStQiCGIAJCIIiEfHx8IgIgDFStfCACQn58IhAgAlStfEJ/fCIKQv////8PgyICIA5CAoYgAUI+iIRC/////w+DIgR+IgwgAUIeiEL/////D4MiCyAKQiCIIgp+fCINIAxUrSANIBBCIIgiDCAOQh6IQv//7/8Pg0KAgBCEIg5+fCIPIA1UrXwgCiAOfnwgAiAOfiITIAQgCn58Ig0gE1StQiCGIA1CIIiEfCAPIA1CIIZ8Ig0gD1StfCANIAsgDH4iEyAQQv////8PgyIQIAR+fCIPIBNUrSAPIAIgAUIChkL8////D4MiE358IhUgD1StfHwiDyANVK18IA8gCiATfiINIA4gEH58IgogBCAMfnwiBCACIAt+fCICQiCIIAIgBFStIAogDVStIAQgClStfHxCIIaEfCIKIA9UrXwgCiAVIAwgE34iBCALIBB+fCILQiCIIAsgBFStQiCGhHwiBCAVVK0gBCACQiCGfCAEVK18fCIEIApUrXwiAkL/////////AFgEQCABQjGGIARC/////w+DIgEgA0L/////D4MiC34iCkIAUq19QgAgCn0iECAEQiCIIgogC34iDSABIANCIIgiDH58Ig5CIIYiD1StfSACQv////8PgyALfiABIBJC/////w+DfnwgCiAMfnwgDiANVK1CIIYgDkIgiIR8IAQgFEIgiH4gAyACQiCIfnwgAiAMfnwgCiASfnxCIIZ8fSELIAdBf2ohByAQIA99DAELIARCIYghDCABQjCGIAJCP4YgBEIBiIQiBEL/////D4MiASADQv////8PgyILfiIKQgBSrX1CACAKfSIQIAEgA0IgiCIKfiINIAwgAkIfhoQiD0L/////D4MiDiALfnwiDEIghiITVK19IAogDn4gAkIB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AgQgAi0AAAwBCyAAEOESC0FQakEKSQ0ACwsgACgCaARAIAAgACgCBEF/ajYCBAtCACAGfSAGIAUbIQYMAQtCgICAgICAgICAfyEGIAAoAmhFDQAgACAAKAIEQX9qNgIEQoCAgICAgICAgH8PCyAGC7YDAgN/AX4jAEEgayIDJAACQCABQv///////////wCDIgVCgICAgICAwL9AfCAFQoCAgICAgMDAv398VARAIAFCGYinIQIgAFAgAUL///8PgyIFQoCAgAhUIAVCgICACFEbRQRAIAJBgYCAgARqIQIMAgsgAkGAgICABGohAiAAIAVCgICACIWEQgBSDQEgAkEBcSACaiECDAELIABQIAVCgICAgICAwP//AFQgBUKAgICAgIDA//8AURtFBEAgAUIZiKdB////AXFBgICA/gdyIQIMAQtBgICA/AchAiAFQv///////7+/wABWDQBBACECIAVCMIinIgRBkf4ASQ0AIAMgACABQv///////z+DQoCAgICAgMAAhCIFQYH/ACAEaxDDESADQRBqIAAgBSAEQf+Bf2oQxBEgAykDCCIFQhmIpyECIAMpAwAgAykDECADKQMYhEIAUq2EIgBQIAVC////D4MiBUKAgIAIVCAFQoCAgAhRG0UEQCACQQFqIQIMAQsgACAFQoCAgAiFhEIAUg0AIAJBAXEgAmohAgsgA0EgaiQAIAIgAUIgiKdBgICAgHhxcr4LzRMCD38DfiMAQbACayIGJABBACENQQAhECAAKAJMQQBOBEAgABCuBCEQCwJAIAEtAAAiBEUNACAAQQRqIQdCACESQQAhDQJAA0ACQAJAIARB/wFxEN8SBEADQCABIgRBAWohASAELQABEN8SDQALIABCABDgEgNAAn8gACgCBCIBIAAoAmhJBEAgByABQQFqNgIAIAEtAAAMAQsgABDhEgsQ3xINAAsCQCAAKAJoRQRAIAcoAgAhAQwBCyAHIAcoAgBBf2oiATYCAAsgASAAKAIIa6wgACkDeCASfHwhEgwBCwJ/AkACQCABLQAAIgRBJUYEQCABLQABIgNBKkYNASADQSVHDQILIABCABDgEiABIARBJUZqIQQCfyAAKAIEIgEgACgCaEkEQCAHIAFBAWo2AgAgAS0AAAwBCyAAEOESCyIBIAQtAABHBEAgACgCaARAIAcgBygCAEF/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AUoNACAKKAIAIQEgCSAAQQRqNgIAIAAgATYCAAsgBCAEKAIAIgBBAWo2AgAgACAFOgAAQQAhACALQdQASg0BIAogCigCAEEBajYCAAwBC0F/IQALIAxBEGokACAACxEAIAAgASACIAMgBCAFEIcUC84DACMAQfACayIAJAAgACACNgLgAiAAIAE2AugCIABByAFqIAMgAEHgAWogAEHcAWogAEHYAWoQhBQgAEG4AWoQyAkiAyADEMUTEMYTIAAgA0EAEMcTIgE2ArQBIAAgAEEQajYCDCAAQQA2AgggAEEBOgAHIABBxQA6AAYDQAJAIABB6AJqIABB4AJqEJUSRQ0AIAAoArQBIAMQ2A4gAWpGBEAgAxDYDiECIAMgAxDYDkEBdBDGEyADIAMQxRMQxhMgACACIANBABDHEyIBajYCtAELIABB6AJqEJYSIABBB2ogAEEGaiABIABBtAFqIAAoAtwBIAAoAtgBIABByAFqIABBEGogAEEMaiAAQQhqIABB4AFqEIUUDQAgAEHoAmoQmBIaDAELCwJAIABByAFqENgORQ0AIAAtAAdFDQAgACgCDCICIABBEGprQZ8BSg0AIAAgAkEEajYCDCACIAAoAgg2AgALIAUgASAAKAK0ASAEEOETOQMAIABByAFqIABBEGogACgCDCAEEMoTIABB6AJqIABB4AJqEJkSBEAgBCAEKAIAQQJyNgIACyAAKALoAiEBIAMQ2RgaIABByAFqENkYGiAAQfACaiQAIAELEQAgACABIAIgAyAEIAUQiRQL5QMBAX4jAEGAA2siACQAIAAgAjYC8AIgACABNgL4AiAAQdgBaiADIABB8AFqIABB7AFqIABB6AFqEIQUIABByAFqEMgJIgMgAxDFExDGEyAAIANBABDHEyIBNgLEASAAIABBIGo2AhwgAEEANgIYIABBAToAFyAAQcUAOgAWA0ACQCAAQfgCaiAAQfACahCVEkUNACAAKALEASADENgOIAFqRgRAIAMQ2A4hAiADIAMQ2A5BAXQQxhMgAyADEMUTEMYTIAAgAiADQQAQxxMiAWo2AsQBCyAAQfgCahCWEiAAQRdqIABBFmogASAAQcQBaiAAKALsASAAKALoASAAQdgBaiAAQSBqIABBHGogAEEYaiAAQfABahCFFA0AIABB+AJqEJgSGgwBCwsCQCAAQdgBahDYDkUNACAALQAXRQ0AIAAoAhwiAiAAQSBqa0GfAUoNACAAIAJBBGo2AhwgAiAAKAIYNgIACyAAIAEgACgCxAEgBBDkEyAAKQMAIQYgBSAAKQMINwMIIAUgBjcDACAAQdgBaiAAQSBqIAAoAhwgBBDKEyAAQfgCaiAAQfACahCZEgRAIAQgBCgCAEECcjYCAAsgACgC+AIhASADENkYGiAAQdgBahDZGBogAEGAA2okACABC5gDAQF/IwBB4AJrIgAkACAAIAI2AtACIAAgATYC2AIgAEHQAWoQyAkhAiAAQRBqIAMQ/xEgAEEQahCUEkHQugFB6roBIABB4AFqEIsUGiAAQRBqELMTGiAAQcABahDICSIDIAMQxRMQxhMgACADQQAQxxMiATYCvAEgACAAQRBqNgIMIABBADYCCANAAkAgAEHYAmogAEHQAmoQlRJFDQAgACgCvAEgAxDYDiABakYEQCADENgOIQYgAyADENgOQQF0EMYTIAMgAxDFExDGEyAAIAYgA0EAEMcTIgFqNgK8AQsgAEHYAmoQlhJBECABIABBvAFqIABBCGpBACACIABBEGogAEEMaiAAQeABahD3Ew0AIABB2AJqEJgSGgwBCwsgAyAAKAK8ASABaxDGEyADELUOIQEQ5xMhBiAAIAU2AgAgASAGQfG6ASAAEOgTQQFHBEAgBEEENgIACyAAQdgCaiAAQdACahCZEgRAIAQgBCgCAEECcjYCAAsgACgC2AIhASADENkYGiACENkYGiAAQeACaiQAIAELFQAgACABIAIgAyAAKAIAKAIwEQgACzIAIAIoAgAhAgNAAkAgACABRwR/IAAoAgAgAkcNASAABSABCw8LIABBBGohAAwAAAsACw8AIAAgACgCACgCDBEAAAsPACAAIAAoAgAoAhARAAALEQAgACABIAEoAgAoAhQRAgALBgBB0LoBCz0AIwBBEGsiACQAIABBCGogARD/ESAAQQhqEJQSQdC6AUHqugEgAhCLFBogAEEIahCzExogAEEQaiQAIAIL7QEBAX8jAEEwayIFJAAgBSABNgIoAkAgAhDoBUEBcUUEQCAAIAEgAiADIAQgACgCACgCGBELACECDAELIAVBGGogAhD/ESAFQRhqELQTIQIgBUEYahCzExoCQCAEBEAgBUEYaiACELUTDAELIAVBGGogAhC2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ABAAoiEAIAFBhmggAUGGaEobQfwPaiEBCyAAIAFB/wdqrUI0hr+iC0QCAX8BfiABQv///////z+DIQMCfyABQjCIp0H//wFxIgJB//8BRwRAQQQgAg0BGkECQQMgACADhFAbDwsgACADhFALC4MEAQN/IAJBgMAATwRAIAAgASACECgaIAAPCyAAIAJqIQMCQCAAIAFzQQNxRQRAAkAgAkEBSARAIAAhAgwBCyAAQQNxRQRAIAAhAgwBCyAAIQIDQCACIAEtAAA6AAAgAUEBaiEBIAJBAWoiAiADTw0BIAJBA3ENAAsLAkAgA0F8cSIEQcAASQ0AIAIgBEFAaiIFSw0AA0AgAiABKAIANgIAIAIgASgCBDYCBCACIAEoAgg2AgggAiABKAIMNgIMIAIgASgCEDYCECACIAEoAhQ2AhQgAiABKAIYNgIYIAIgASgCHDYCHCACIAEoAiA2AiAgAiABKAIkNgIkIAIgASgCKDYCKCACIAEoAiw2AiwgAiABKAIwNgIwIAIgASgCNDYCNCACIAEoAjg2AjggAiABKAI8NgI8IAFBQGshASACQUBrIgIgBU0NAAsLIAIgBE8NAQNAIAIgASgCADYCACABQQRqIQEgAkEEaiICIARJDQALDAELIANBBEkEQCAAIQIMAQsgA0F8aiIEIABJBEAgACECDAELIAAhAgNAIAIgAS0AADoAACACIAEtAAE6AAEgAiABLQACOgACIAIgAS0AAzoAAyABQQRqIQEgAkEEaiICIARNDQALCyACIANJBEADQCACIAEtAAA6AAAgAUEBaiEBIAJBAWoiAiADRw0ACwsgAAvzAgICfwF+AkAgAkUNACAAIAJqIgNBf2ogAToAACAAIAE6AAAgAkEDSQ0AIANBfmogAToAACAAIAE6AAEgA0F9aiABOgAAIAAgAToAAiACQQdJDQAgA0F8aiABOgAAIAAgAToAAyACQQlJDQAgAEEAIABrQQNxIgRqIgMgAUH/AXFBgYKECGwiATYCACADIAIgBGtBfHEiBGoiAkF8aiABNgIAIARBCUkNACADIAE2AgggAyABNgIEIAJBeGogATYCACACQXRqIAE2AgAgBEEZSQ0AIAMgATYCGCADIAE2AhQgAyABNgIQIAMgATYCDCACQXBqIAE2AgAgAkFsaiABNgIAIAJBaGogATYCACACQWRqIAE2AgAgBCADQQRxQRhyIgRrIgJBIEkNACABrSIFQiCGIAWEIQUgAyAEaiEBA0AgASAFNwMYIAEgBTcDECABIAU3AwggASAFNwMAIAFBIGohASACQWBqIgJBH0sNAAsLIAAL+AIBAn8CQCAAIAFGDQACQCABIAJqIABLBEAgACACaiIEIAFLDQELIAAgASACEP4ZDwsgACABc0EDcSEDAkACQCAAIAFJBEAgAwRAIAAhAwwDCyAAQQNxRQRAIAAhAwwCCyAAIQMDQCACRQ0EIAMgAS0AADoAACABQQFqIQEgAkF/aiECIANBAWoiA0EDcQ0ACwwBCwJAIAMNACAEQQNxBEADQCACRQ0FIAAgAkF/aiICaiIDIAEgAmotAAA6AAAgA0EDcQ0ACwsgAkEDTQ0AA0AgACACQXxqIgJqIAEgAmooAgA2AgAgAkEDSw0ACwsgAkUNAgNAIAAgAkF/aiICaiABIAJqLQAAOgAAIAINAAsMAgsgAkEDTQ0AIAIhBANAIAMgASgCADYCACABQQRqIQEgA0EEaiEDIARBfGoiBEEDSw0ACyACQQNxIQILIAJFDQADQCADIAEtAAA6AAAgA0EBaiEDIAFBAWohASACQX9qIgINAAsLIAALHwBBhKIDKAIARQRAQYiiAyABNgIAQYSiAyAANgIACwsEACMACxAAIwAgAGtBcHEiACQAIAALBgAgACQACwYAIABAAAsJACABIAARAAALCQAgASAAEQQACwcAIAARAQALCwAgASACIAARAgALDwAgASACIAMgBCAAEQwACw0AIAEgAiADIAARBgALCwAgASACIAARAwALCwAgASACIAAREQALDwAgASACIAMgBCAAERkACw0AIAEgAiADIAAREwALCQAgASAAERAACwsAIAEgAiAAEQ0ACw0AIAEgAiADIAARGgALDQAgASACIAMgABEbAAsLACABIAIgABEYAAsPACABIAIgAyAEIAARYAALEQAgASACIAMgBCAFIAARYQALDwAgASACIAMgBCAAET4ACxEAIAEgAiADIAQgBSAAET8ACxMAIAEgAiADIAQgBSAGIAARQAALDwAgASACIAMgBCAAEUEACw8AIAEgAiADIAQgABEfAAsPACABIAIgAyAEIAARRAALDQAgASACIAMgABEoAAsNACABIAIgAyAAESoACw0AIAEgAiADIAARBQALEQAgASACIAMgBCAFIAARPQALEQAgASACIAMgBCAFIAARIwALEwAgASACIAMgBCAFIAYgABEeAAsTACABIAIgAyAEIAUgBiAAEWIACxMAIAEgAiADIAQgBSAGIAARYwALFwAgASACIAMgBCAFIAYgByAIIAARZQALDQAgASACIAMgABFfAAsJACABIAARFgALEwAgASACIAMgBCAFIAYgABEvAAsLACABIAIgABEUAAsPACABIAIgAyAEIAARIgALDQAgASACIAMgABEpAAsNACABIAIgAyAAEUcACwkAIAEgABEdAAsPACABIAIgAyAEIAARTQALDQAgASACIAMgABFRAAsRACABIAIgAyAEIAUgABFZAAsPACABIAIgAyAEIAARVgALDwAgASACIAMgBCAAEVAACxEAIAEgAiADIAQgBSAAEVMACxMAIAEgAiADIAQgBSAGIAARVAALEQAgASACIAMgBCAFIAARNgALEwAgASACIAMgBCAFIAYgABE3AAsVACABIAIgAyAEIAUgBiAHIAAROAALEQAgASACIAMgBCAFIAAROgALDwAgASACIAMgBCAAETkACw8AIAEgAiADIAQgABEIAAsTACABIAIgAyAEIAUgBiAAETQACxUAIAEgAiADIAQgBSAGIAcgABFYAAsVACABIAIgAyAEIAUgBiAHIAARXQALFQAgASACIAMgBCAFIAYgByAAEVsACxkAIAEgAiADIAQgBSAGIAcgCCAJIAARXgALDwAgASACIAMgBCAAEVIACxUAIAEgAiADIAQgBSAGIAcgABFVAAsRACABIAIgAyAEIAUgABEuAAsPACABIAIgAyAEIAARNQALEQAgASACIAMgBCAFIAARDwALDwAgASACIAMgBCAAEUUACwsAIAEgAiAAEScACxEAIAEgAiADIAQgBSAAEU4ACw0AIAEgAiADIAARaAALDwAgASACIAMgBCAAETMACw8AIAEgAiADIAQgABFsAAsRACABIAIgAyAEIAUgABEwAAsTACABIAIgAyAEIAUgBiAAEWQACxEAIAEgAiADIAQgBSAAETEACxMAIAEgAiADIAQgBSAGIAARVwALFQAgASACIAMgBCAFIAYgByAAEVwACxMAIAEgAiADIAQgBSAGIAARWgALCwAgASACIAARSAALCQAgASAAEUoACwcAIAARCQALEQAgASACIAMgBCAFIAARJQALDQAgASACIAMgABEhAAsTACABIAIgAyAEIAUgBiAAEUkACxEAIAEgAiADIAQgBSAAEQsACxcAIAEgAiADIAQgBSAGIAcgCCAAEQ4ACxMAIAEgAiADIAQgBSAGIAARBwALEQAgASACIAMgBCAFIAARJgALEQAgASACIAMgBCAFIAARLAALEwAgASACIAMgBCAFIAYgABFDAAsVACABIAIgAyAEIAUgBiAHIAARFQALFQAgASACIAMgBCAFIAYgByAAESsACxMAIAEgAiADIAQgBSAGIAARCgALGQAgACABIAIgA60gBK1CIIaEIAUgBhDUGgsiAQF+IAAgASACrSADrUIghoQgBBDVGiIFQiCIpxApIAWnCxkAIAAgASACIAMgBCAFrSAGrUIghoQQ2hoLIwAgACABIAIgAyAEIAWtIAatQiCGhCAHrSAIrUIghoQQ3BoLJQAgACABIAIgAyAEIAUgBq0gB61CIIaEIAitIAmtQiCGhBDeGgsTACAAIAGnIAFCIIinIAIgAxAqCwuwyAJhAEGACAukEVZlY3RvckludABWZWN0b3JEb3VibGUAVmVjdG9yQ2hhcgBWZWN0b3JVQ2hhcgBWZWN0b3JGbG9hdAB2ZWN0b3JUb29scwBjbGVhclZlY3RvckRibABjbGVhclZlY3RvckZsb2F0AG1heGlTZXR0aW5ncwBzZXR1cABzYW1wbGVSYXRlAGNoYW5uZWxzAGJ1ZmZlclNpemUAbWF4aU9zYwBzaW5ld2F2ZQBjb3N3YXZlAHBoYXNvcgBzYXcAdHJpYW5nbGUAc3F1YXJlAHB1bHNlAGltcHVsc2UAbm9pc2UAc2luZWJ1ZgBzaW5lYnVmNABzYXduAHBoYXNlUmVzZXQAbWF4aUVudmVsb3BlAGxpbmUAdHJpZ2dlcgBhbXBsaXR1ZGUAdmFsaW5kZXgAbWF4aURlbGF5bGluZQBkbABtYXhpRmlsdGVyAGxvcmVzAGhpcmVzAGJhbmRwYXNzAGxvcGFzcwBoaXBhc3MAY3V0b2ZmAHJlc29uYW5jZQBtYXhpTWl4AHN0ZXJlbwBxdWFkAGFtYmlzb25pYwBtYXhpTGluZQBwbGF5AHByZXBhcmUAdHJpZ2dlckVuYWJsZQBpc0xpbmVDb21wbGV0ZQBtYXhpWEZhZGUAeGZhZGUAbWF4aUxhZ0V4cABpbml0AGFkZFNhbXBsZQB2YWx1ZQBhbHBoYQBhbHBoYVJlY2lwcm9jYWwAdmFsAG1heGlTYW1wbGUAZ2V0TGVuZ3RoAHNldFNhbXBsZQBzZXRTYW1wbGVGcm9tT2dnQmxvYgBpc1JlYWR5AHBsYXlPbmNlAHBsYXlPblpYAHBsYXk0AGNsZWFyAG5vcm1hbGlzZQBhdXRvVHJpbQBsb2FkAHJlYWQAbG9vcFNldFBvc09uWlgAbWF4aU1hcABsaW5saW4AbGluZXhwAGV4cGxpbgBjbGFtcABtYXhpRHluAGdhdGUAY29tcHJlc3NvcgBjb21wcmVzcwBzZXRBdHRhY2sAc2V0UmVsZWFzZQBzZXRUaHJlc2hvbGQAc2V0UmF0aW8AbWF4aUVudgBhcgBhZHNyAHNldERlY2F5AHNldFN1c3RhaW4AY29udmVydABtdG9mAG1zVG9TYW1wcwBtYXhpU2FtcGxlQW5kSG9sZABzYWgAbWF4aURpc3RvcnRpb24AZmFzdEF0YW4AYXRhbkRpc3QAZmFzdEF0YW5EaXN0AG1heGlGbGFuZ2VyAGZsYW5nZQBtYXhpQ2hvcnVzAGNob3J1cwBtYXhpRENCbG9ja2VyAG1heGlTVkYAc2V0Q3V0b2ZmAHNldFJlc29uYW5jZQBtYXhpTWF0aABhZGQAc3ViAG11bABkaXYAZ3QAbHQAZ3RlAGx0ZQBtb2QAYWJzAHBvdwBtYXhpQ2xvY2sAdGlja2VyAHNldFRlbXBvAHNldFRpY2tzUGVyQmVhdABpc1RpY2sAY3VycmVudENvdW50AHBsYXlIZWFkAGJwcwBicG0AdGljawB0aWNrcwBtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yAHNldFBoYXNlAGdldFBoYXNlAG1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQAc2V0UGhhc2VzAHNpemUAbWF4aUFzeW5jS3VyYW1vdG9Pc2NpbGxhdG9yAG1heGlGRlQAcHJvY2VzcwBzcGVjdHJhbEZsYXRuZXNzAHNwZWN0cmFsQ2VudHJvaWQAZ2V0TWFnbml0dWRlcwBnZXRNYWduaXR1ZGVzREIAZ2V0UGhhc2VzAG1heGlGRlRNb2RlcwBOT19QT0xBUl9DT05WRVJTSU9OAFdJVEhfUE9MQVJfQ09OVkVSU0lPTgBtYXhpSUZGVABtYXhpSUZGVE1vZGVzAFNQRUNUUlVNAENPTVBMRVgAbWF4aVRpbWVTdHJldGNoAHNoYXJlZF9wdHI8bWF4aVRpbWVzdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+AGdldE5vcm1hbGlzZWRQb3NpdGlvbgBnZXRQb3NpdGlvbgBzZXRQb3NpdGlvbgBwbGF5QXRQb3NpdGlvbgBtYXhpUGl0Y2hTaGlmdABzaGFyZWRfcHRyPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+AG1heGlTdHJldGNoAHNldExvb3BTdGFydABzZXRMb29wRW5kAGdldExvb3BFbmQAbWF4aUJpdHMAc2lnAGF0AHNobABzaHIAcgBsYW5kAGxvcgBseG9yAG5lZwBpbmMAZGVjAGVxAHRvU2lnbmFsAHRvVHJpZ1NpZ25hbABmcm9tU2lnbmFsAG1heGlUcmlnZ2VyAG9uWlgAb25DaGFuZ2VkAG1heGlDb3VudGVyAGNvdW50AG1heGlJbmRleABwdWxsAGFsbG9jYXRvcjxUPjo6YWxsb2NhdGUoc2l6ZV90IG4pICduJyBleGNlZWRzIG1heGltdW0gc3VwcG9ydGVkIHNpemUAcHVzaF9iYWNrAHJlc2l6ZQBnZXQAc2V0AE5TdDNfXzI2dmVjdG9ySWlOU185YWxsb2NhdG9ySWlFRUVFAE5TdDNfXzIxM19fdmVjdG9yX2Jhc2VJaU5TXzlhbGxvY2F0b3JJaUVFRUUATlN0M19fMjIwX192ZWN0b3JfYmFzZV9jb21tb25JTGIxRUVFAAAAAMh5AAC4CwAATHoAAIwLAAAAAAAAAQAAAOALAAAAAAAATHoAAGgLAAAAAAAAAQAAAOgLAAAAAAAAUE5TdDNfXzI2dmVjdG9ySWlOU185YWxsb2NhdG9ySWlFRUVFAAAAAKh6AAAYDAAAAAAAAAAMAABQS05TdDNfXzI2dmVjdG9ySWlOU185YWxsb2NhdG9ySWlFRUVFAAAAqHoAAFAMAAABAAAAAAwAAGlpAHYAdmkAQAwAANB4AABADAAAMHkAAHZpaWkAQbAZC1DQeAAAQAwAAFR5AAAweQAAdmlpaWkAAABUeQAAeAwAAGlpaQD0DAAAAAwAAFR5AABOMTBlbXNjcmlwdGVuM3ZhbEUAAMh5AADgDAAAaWlpaQBBkBoL5gToeAAAAAwAAFR5AAAweQAAaWlpaWkATlN0M19fMjZ2ZWN0b3JJZE5TXzlhbGxvY2F0b3JJZEVFRUUATlN0M19fMjEzX192ZWN0b3JfYmFzZUlkTlNfOWFsbG9jYXRvcklkRUVFRQAAAEx6AABKDQAAAAAAAAEAAADgCwAAAAAAAEx6AAAmDQAAAAAAAAEAAAB4DQAAAAAAAFBOU3QzX18yNnZlY3RvcklkTlNfOWFsbG9jYXRvcklkRUVFRQAAAACoegAAqA0AAAAAAACQDQAAUEtOU3QzX18yNnZlY3RvcklkTlNfOWFsbG9jYXRvcklkRUVFRQAAAKh6AADgDQAAAQAAAJANAADQDQAA0HgAANANAABseQAAdmlpZAAAAADQeAAA0A0AAFR5AABseQAAdmlpaWQAAABUeQAACA4AAPQMAACQDQAAVHkAAAAAAADoeAAAkA0AAFR5AABseQAAaWlpaWQATlN0M19fMjZ2ZWN0b3JJY05TXzlhbGxvY2F0b3JJY0VFRUUATlN0M19fMjEzX192ZWN0b3JfYmFzZUljTlNfOWFsbG9jYXRvckljRUVFRQAAAEx6AACaDgAAAAAAAAEAAADgCwAAAAAAAEx6AAB2DgAAAAAAAAEAAADIDgAAAAAAAFBOU3QzX18yNnZlY3RvckljTlNfOWFsbG9jYXRvckljRUVFRQAAAACoegAA+A4AAAAAAADgDgAAUEtOU3QzX18yNnZlY3RvckljTlNfOWFsbG9jYXRvckljRUVFRQAAAKh6AAAwDwAAAQAAAOAOAAAgDwAA0HgAACAPAAD0eABBgB8LItB4AAAgDwAAVHkAAPR4AABUeQAAWA8AAPQMAADgDgAAVHkAQbAfC7IC6HgAAOAOAABUeQAA9HgAAE5TdDNfXzI2dmVjdG9ySWhOU185YWxsb2NhdG9ySWhFRUVFAE5TdDNfXzIxM19fdmVjdG9yX2Jhc2VJaE5TXzlhbGxvY2F0b3JJaEVFRUUATHoAAOQPAAAAAAAAAQAAAOALAAAAAAAATHoAAMAPAAAAAAAAAQAAABAQAAAAAAAAUE5TdDNfXzI2dmVjdG9ySWhOU185YWxsb2NhdG9ySWhFRUVFAAAAAKh6AABAEAAAAAAAACgQ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0HgAAPwhAABseQAAVHkAANB4AAD8IQAAkA0AAGx5AAD8IQAAVHkAAFR5AAD8IQAAN21heGlGRlQAAAAAyHkAAJAiAABQN21heGlGRlQAAACoegAApCIAAAAAAACcIgAAUEs3bWF4aUZGVAAAqHoAAMAiAAABAAAAnCIAALAiAADQeAAAsCIAADB5AAAweQAAMHkAAHZpaWlpaQAAAAAAAOh4AACwIgAAYHkAACQjAABON21heGlGRlQ4ZmZ0TW9kZXNFAHx5AAAQIwAAaWlpZmkAAABgeQAAsCIAAGZpaQBoEQAAsCIAADhtYXhpSUZGVAAAAMh5AABIIwAAUDhtYXhpSUZGVAAAqHoAAFwjAAAAAAAAVCMAAFBLOG1heGlJRkZUAKh6AAB4IwAAAQAAAFQjAABoIwBBoMcACxLQeAAAaCMAADB5AAAweQAAMHkAQcDHAAviBmB5AABoIwAAaBEAAGgRAADsIwAATjhtYXhpSUZGVDhmZnRNb2Rlc0UAAAAAfHkAANQjAABmaWlpaWkAMTVtYXhpVGltZVN0cmV0Y2hJMTRoYW5uV2luRnVuY3RvckUAAMh5AAD7IwAAUDE1bWF4aVRpbWVTdHJldGNoSTE0aGFubldpbkZ1bmN0b3JFAAAAAKh6AAAoJAAAAAAAACAkAABQSzE1bWF4aVRpbWVTdHJldGNoSTE0aGFubldpbkZ1bmN0b3JFAAAAqHoAAGAkAAABAAAAICQAAAAAAABQJQAAJAIAACUCAAAmAgAAJwIAACgCAABOU3QzX18yMjBfX3NoYXJlZF9wdHJfcG9pbnRlcklQMTVtYXhpVGltZVN0cmV0Y2hJMTRoYW5uV2luRnVuY3RvckVOMTBlbXNjcmlwdGVuMTVzbWFydF9wdHJfdHJhaXRJTlNfMTBzaGFyZWRfcHRySVMzX0VFRTExdmFsX2RlbGV0ZXJFTlNfOWFsbG9jYXRvcklTM19FRUVFAADweQAAtCQAABB2AABOMTBlbXNjcmlwdGVuMTVzbWFydF9wdHJfdHJhaXRJTlN0M19fMjEwc2hhcmVkX3B0ckkxNW1heGlUaW1lU3RyZXRjaEkxNGhhbm5XaW5GdW5jdG9yRUVFRTExdmFsX2RlbGV0ZXJFAMh5AABcJQAATlN0M19fMjEwc2hhcmVkX3B0ckkxNW1heGlUaW1lU3RyZXRjaEkxNGhhbm5XaW5GdW5jdG9yRUVFAAAAyHkAAMwlAABpAAAACCYAAAAAAACMJgAAKQIAACoCAAArAgAALAIAAC0CAABOU3QzX18yMjBfX3NoYXJlZF9wdHJfZW1wbGFjZUkxNW1heGlUaW1lU3RyZXRjaEkxNGhhbm5XaW5GdW5jdG9yRU5TXzlhbGxvY2F0b3JJUzNfRUVFRQAA8HkAADQmAAAQdgAA0HgAAFAkAABEGAAAbHkAAFAkAADQeAAAUCQAAGx5AAAAAAAABCcAAC4CAAAvAgAAMAIAADltYXhpR3JhaW5JMTRoYW5uV2luRnVuY3RvckUAMTNtYXhpR3JhaW5CYXNlAAAAAMh5AADpJgAA8HkAAMwmAAD8JgAAAAAAAPwmAAAxAgAALwIAADICAEGwzgAL0gVseQAAUCQAAGx5AABseQAAMHkAAGx5AABkaWlkZGlkAGx5AABQJAAAbHkAAGx5AAAweQAAMTRtYXhpUGl0Y2hTaGlmdEkxNGhhbm5XaW5GdW5jdG9yRQAAyHkAAGQnAABQMTRtYXhpUGl0Y2hTaGlmdEkxNGhhbm5XaW5GdW5jdG9yRQCoegAAkCcAAAAAAACIJwAAUEsxNG1heGlQaXRjaFNoaWZ0STE0aGFubldpbkZ1bmN0b3JFAAAAAKh6AADEJwAAAQAAAIgnAAAAAAAAtCgAADMCAAA0AgAANQIAADYCAAA3AgAATlN0M19fMjIwX19zaGFyZWRfcHRyX3BvaW50ZXJJUDE0bWF4aVBpdGNoU2hpZnRJMTRoYW5uV2luRnVuY3RvckVOMTBlbXNjcmlwdGVuMTVzbWFydF9wdHJfdHJhaXRJTlNfMTBzaGFyZWRfcHRySVMzX0VFRTExdmFsX2RlbGV0ZXJFTlNfOWFsbG9jYXRvcklTM19FRUVFAAAA8HkAABgoAAAQdgAATjEwZW1zY3JpcHRlbjE1c21hcnRfcHRyX3RyYWl0SU5TdDNfXzIxMHNoYXJlZF9wdHJJMTRtYXhpUGl0Y2hTaGlmdEkxNGhhbm5XaW5GdW5jdG9yRUVFRTExdmFsX2RlbGV0ZXJFAADIeQAAwCgAAE5TdDNfXzIxMHNoYXJlZF9wdHJJMTRtYXhpUGl0Y2hTaGlmdEkxNGhhbm5XaW5GdW5jdG9yRUVFAAAAAMh5AAAwKQAAbCkAAAAAAADsKQAAOAIAADkCAAA6AgAALAIAADsCAABOU3QzX18yMjBfX3NoYXJlZF9wdHJfZW1wbGFjZUkxNG1heGlQaXRjaFNoaWZ0STE0aGFubldpbkZ1bmN0b3JFTlNfOWFsbG9jYXRvcklTM19FRUVFAAAA8HkAAJQpAAAQdgAA0HgAALQnAABEGABBkNQAC9IBbHkAALQnAABseQAAbHkAADB5AABseQAAMTFtYXhpU3RyZXRjaEkxNGhhbm5XaW5GdW5jdG9yRQDIeQAAKCoAAFAxMW1heGlTdHJldGNoSTE0aGFubldpbkZ1bmN0b3JFAAAAAKh6AABQKgAAAAAAAEgqAABQSzExbWF4aVN0cmV0Y2hJMTRoYW5uV2luRnVuY3RvckUAAACoegAAhCoAAAEAAABIKgAAdCoAANB4AAB0KgAARBgAAGx5AAB0KgAA0HgAAHQqAABseQAAVHkAAHQqAEHw1QALJGx5AAB0KgAAbHkAAGx5AABseQAAMHkAAGx5AABkaWlkZGRpZABBoNYAC+IDbHkAAHQqAABseQAAbHkAAGx5AAAweQAAZGlpZGRkaQA4bWF4aUJpdHMAAADIeQAAQCsAAFA4bWF4aUJpdHMAAKh6AABUKwAAAAAAAEwrAABQSzhtYXhpQml0cwCoegAAcCsAAAEAAABMKwAAPHkAADx5AAA8eQAAPHkAADx5AAA8eQAAPHkAADx5AAA8eQAAPHkAAGx5AAA8eQAAPHkAAGx5AABpaWQAMTFtYXhpVHJpZ2dlcgAAAMh5AADIKwAAUDExbWF4aVRyaWdnZXIAAKh6AADgKwAAAAAAANgrAABQSzExbWF4aVRyaWdnZXIAqHoAAAAsAAABAAAA2CsAAPArAABseQAA8CsAAGx5AABseQAA8CsAAGx5AABseQAAMTFtYXhpQ291bnRlcgAAAMh5AABALAAAUDExbWF4aUNvdW50ZXIAAKh6AABYLAAAAAAAAFAsAABQSzExbWF4aUNvdW50ZXIAqHoAAHgsAAABAAAAUCwAAGgsAAAAAAAAbHkAAGgsAABseQAAbHkAADltYXhpSW5kZXgAAMh5AACwLAAAUDltYXhpSW5kZXgAqHoAAMQsAAAAAAAAvCwAAFBLOW1heGlJbmRleAAAAACoegAA4CwAAAEAAAC8LAAA0CwAQZDaAAvnB2x5AADQLAAAbHkAAGx5AACQDQAACmNoYW5uZWxzID0gJWQKbGVuZ3RoID0gJWQATG9hZGluZzogAGRhdGEAQ2g6IAAsIGxlbjogAEVSUk9SOiBDb3VsZCBub3QgbG9hZCBzYW1wbGUuAEF1dG90cmltOiBzdGFydDogACwgZW5kOiAAAGwAAAAAAAAAJC4AAD8CAABAAgAAlP///5T///8kLgAAQQIAAEICAACgLQAA2C0AAOwtAAC0LQAAbAAAAAAAAABUSAAAQwIAAEQCAACU////lP///1RIAABFAgAARgIAAE5TdDNfXzIxNGJhc2ljX2lmc3RyZWFtSWNOU18xMWNoYXJfdHJhaXRzSWNFRUVFAPB5AAD0LQAAVEgAAAAAAACgLgAARwIAAEgCAABJAgAASgIAAEsCAABMAgAATQIAAE4CAABPAgAAUAIAAFECAABSAgAAUwIAAFQCAABOU3QzX18yMTNiYXNpY19maWxlYnVmSWNOU18xMWNoYXJfdHJhaXRzSWNFRUVFAADweQAAcC4AAOBHAABhbGxvY2F0b3I8VD46OmFsbG9jYXRlKHNpemVfdCBuKSAnbicgZXhjZWVkcyBtYXhpbXVtIHN1cHBvcnRlZCBzaXplAHcAYQByAHIrAHcrAGErAHdiAGFiAHJiAHIrYgB3K2IAYStiACVkIGlzIG5vdCBhIHBvd2VyIG9mIHR3bwoARXJyb3I6IEZGVCBjYWxsZWQgd2l0aCBzaXplICVkCgBmLT5hbGxvYy5hbGxvY19idWZmZXJfbGVuZ3RoX2luX2J5dGVzID09IGYtPnRlbXBfb2Zmc2V0AC4uLy4uL3NyYy9saWJzL3N0Yl92b3JiaXMuYwB2b3JiaXNfZGVjb2RlX2luaXRpYWwAZi0+Ynl0ZXNfaW5fc2VnID4gMABnZXQ4X3BhY2tldF9yYXcAZi0+Ynl0ZXNfaW5fc2VnID09IDAAbmV4dF9zZWdtZW50AAAAAAECAgMDAwMEBAQEBAQEBAABAACAAAAAVgAAAEAAAAB2b3JiaXNfZGVjb2RlX3BhY2tldF9yZXN0AGMtPnNvcnRlZF9jb2Rld29yZHMgfHwgYy0+Y29kZXdvcmRzAGNvZGVib29rX2RlY29kZV9zY2FsYXJfcmF3ACFjLT5zcGFyc2UAIWMtPnNwYXJzZSB8fCB6IDwg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AAAAAAAURwAAhAIAAIUCAABOU3QzX18yOGlvc19iYXNlRQAAAMh5AAAARwAAAAAAAFhHAACGAgAAhwIAAE5TdDNfXzI5YmFzaWNfaW9zSWNOU18xMWNoYXJfdHJhaXRzSWNFRUVFAAAA8HkAACxHAAAURwAAAAAAAKBHAACIAgAAiQIAAE5TdDNfXzI5YmFzaWNfaW9zSXdOU18xMWNoYXJfdHJhaXRzSXdFRUVFAAAA8HkAAHRHAAAURwAATlN0M19fMjE1YmFzaWNfc3RyZWFtYnVmSWNOU18xMWNoYXJfdHJhaXRzSWNFRUVFAAAAAMh5AACsRwAATlN0M19fMjE1YmFzaWNfc3RyZWFtYnVmSXdOU18xMWNoYXJfdHJhaXRzSXdFRUVFAAAAAMh5AADoRwAATlN0M19fMjEzYmFzaWNfaXN0cmVhbUljTlNfMTFjaGFyX3RyYWl0c0ljRUVFRQAATHoAACRIAAAAAAAAAQAAAFhHAAAD9P//TlN0M19fMjEzYmFzaWNfaXN0cmVhbUl3TlNfMTFjaGFyX3RyYWl0c0l3RUVFRQAATHoAAGxIAAAAAAAAAQAAAKBHAAAD9P//TlN0M19fMjEzYmFzaWNfb3N0cmVhbUljTlNfMTFjaGFyX3RyYWl0c0ljRUVFRQAATHoAALRIAAAAAAAAAQAAAFhHAAAD9P//TlN0M19fMjEzYmFzaWNfb3N0cmVhbUl3TlNfMTFjaGFyX3RyYWl0c0l3RUVFRQAATHoAAPxIAAAAAAAAAQAAAKBHAAAD9P//uLUAAAAAAACgSQAAYAIAAIsCAACMAgAAYwIAAGQCAABlAgAAZgIAAE4CAABPAgAAjQIAAI4CAACPAgAAUwIAAGkCAABOU3QzX18yMTBfX3N0ZGluYnVmSWNFRQDweQAAiEkAAOBHAAB1bnN1cHBvcnRlZCBsb2NhbGUgZm9yIHN0YW5kYXJkIGlucHV0AAAAAAAAACxKAABqAgAAkAIAAJECAABtAgAAbgIAAG8CAABwAgAAcQIAAHICAACSAgAAkwIAAJQCAAB2AgAAdwIAAE5TdDNfXzIxMF9fc3RkaW5idWZJd0VFAPB5AAAUSgAAHEgAAAAAAACUSgAAYAIAAJUCAACWAgAAYwIAAGQCAABlAgAAlwIAAE4CAABPAgAAZwIAAFECAABoAgAAmAIAAJkCAABOU3QzX18yMTFfX3N0ZG91dGJ1ZkljRUUAAAAA8HkAAHhKAADgRwAAAAAAAPxKAABqAgAAmgIAAJsCAABtAgAAbgIAAG8CAACcAgAAcQIAAHICAABzAgAAdAIAAHUCAACdAgAAngIAAE5TdDNfXzIxMV9fc3Rkb3V0YnVmSXdFRQAAAADweQAA4EoAABxIAEGQlgEL6AP/////////////////////////////////////////////////////////////////AAECAwQFBgcICf////////8KCwwNDg8QERITFBUWFxgZGhscHR4fICEiI////////woLDA0ODxAREhMUFRYXGBkaGxwdHh8gISIj/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////wABAgQHAwYFAAAAAAAAAAIAAMADAADABAAAwAUAAMAGAADABwAAwAgAAMAJAADACgAAwAsAAMAMAADADQAAwA4AAMAPAADAEAAAwBEAAMASAADAEwAAwBQAAMAVAADAFgAAwBcAAMAYAADAGQAAwBoAAMAbAADAHAAAwB0AAMAeAADAHwAAwAAAALMBAADDAgAAwwMAAMMEAADDBQAAwwYAAMMHAADDCAAAwwkAAMMKAADDCwAAwwwAAMMNAADTDgAAww8AAMMAAAy7AQAMwwIADMMDAAzDBAAM02luZmluaXR5AG5hbgBBgJoBC0jRdJ4AV529KoBwUg///z4nCgAAAGQAAADoAwAAECcAAKCGAQBAQg8AgJaYAADh9QUYAAAANQAAAHEAAABr////zvv//5K///8AQdCaAQsj3hIElQAAAAD///////////////9QTQAAFAAAAEMuVVRGLTgAQZibAQsCZE0AQbCbAQsGTENfQUxMAEHAmwELbkxDX0NUWVBFAAAAAExDX05VTUVSSUMAAExDX1RJTUUAAAAAAExDX0NPTExBVEUAAExDX01PTkVUQVJZAExDX01FU1NBR0VTAExBTkcAQy5VVEYtOABQT1NJWABNVVNMX0xPQ1BBVEgAAAAA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AAAAAAAAANxtAADWAgAAgQMAALQCAACCAwAAgwMAAE5TdDNfXzI5bW9uZXlfZ2V0SWNOU18xOWlzdHJlYW1idWZfaXRlcmF0b3JJY05TXzExY2hhcl90cmFpdHNJY0VFRUVFRQBOU3QzX18yMTFfX21vbmV5X2dldEljRUUAAMh5AAC6bQAATHoAAHRtAAAAAAAAAgAAAKBgAAACAAAA1G0AQYDcAQuaAYBuAADWAgAAhAMAALQCAACFAwAAhgMAAE5TdDNfXzI5bW9uZXlfZ2V0SXdOU18xOWlzdHJlYW1idWZfaXRlcmF0b3JJd05TXzExY2hhcl90cmFpdHNJd0VFRUVFRQBOU3QzX18yMTFfX21vbmV5X2dldEl3RUUAAMh5AABebgAATHoAABhuAAAAAAAAAgAAAKBgAAACAAAAeG4AQaTdAQuaASRvAADWAgAAhwMAALQCAACIAwAAiQMAAE5TdDNfXzI5bW9uZXlfcHV0SWNOU18xOW9zdHJlYW1idWZfaXRlcmF0b3JJY05TXzExY2hhcl90cmFpdHNJY0VFRUVFRQBOU3QzX18yMTFfX21vbmV5X3B1dEljRUUAAMh5AAACbwAATHoAALxuAAAAAAAAAgAAAKBgAAACAAAAHG8AQcjeAQuaAchvAADWAgAAigMAALQCAACLAwAAjAMAAE5TdDNfXzI5bW9uZXlfcHV0SXdOU18xOW9zdHJlYW1idWZfaXRlcmF0b3JJd05TXzExY2hhcl90cmFpdHNJd0VFRUVFRQBOU3QzX18yMTFfX21vbmV5X3B1dEl3RUUAAMh5AACmbwAATHoAAGBvAAAAAAAAAgAAAKBgAAACAAAAwG8AQezfAQv8DEBwAADWAgAAjQMAALQCAACOAwAAjwMAAJADAABOU3QzX18yOG1lc3NhZ2VzSWNFRQBOU3QzX18yMTNtZXNzYWdlc19iYXNlRQAAAADIeQAAHXAAAEx6AAAIcAAAAAAAAAIAAACgYAAAAgAAADhwAAACAAAAAAAAAJhwAADWAgAAkQMAALQCAACSAwAAkwMAAJQDAABOU3QzX18yOG1lc3NhZ2VzSXdFRQAAAABMegAAgHAAAAAAAAACAAAAoGAAAAIAAAA4cAAAAgAAAFN1bmRheQBNb25kYXkAVHVlc2RheQBXZWRuZXNkYXkAVGh1cnNkYXkA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ZW46OnZhbABlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxjaGFyPgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxzaWduZWQgY2hhcj4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8dW5zaWduZWQgY2hhcj4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8c2hvcnQ+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHVuc2lnbmVkIHNob3J0PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxpbnQ+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHVuc2lnbmVkIGludD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8bG9uZz4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8dW5zaWduZWQgbG9uZz4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8aW50OF90PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzx1aW50OF90PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxpbnQxNl90PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzx1aW50MTZfdD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8aW50MzJfdD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8dWludDMyX3Q+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PGZsb2F0PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxkb3VibGU+AE5TdDNfXzIxMmJhc2ljX3N0cmluZ0loTlNfMTFjaGFyX3RyYWl0c0loRUVOU185YWxsb2NhdG9ySWhFRUVFAABMegAAtH0AAAAAAAABAAAAmBkAAAAAAABOU3QzX18yMTJiYXNpY19zdHJpbmdJd05TXzExY2hhcl90cmFpdHNJd0VFTlNfOWFsbG9jYXRvckl3RUVFRQAATHoAAAx+AAAAAAAAAQAAAJgZAAAAAAAATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJY0VFAADIeQAAZH4AAE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SWFFRQAAyHkAAIx+AABOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0loRUUAAMh5AAC0fgAATjEwZW1zY3JpcHRlbjExbWVtb3J5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';
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




// STATICTOP = STATIC_BASE + 52656;
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
      return 53520;
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
var _free = Module["_free"] = asm["free"];
var _malloc = Module["_malloc"] = asm["malloc"];
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

