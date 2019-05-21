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

Module['arguments'] = [];
Module['thisProgram'] = './this.program';
Module['quit'] = function(status, toThrow) {
  throw toThrow;
};
Module['preRun'] = [];
Module['postRun'] = [];

// Determine the runtime environment we are in. You can customize this by
// setting the ENVIRONMENT setting at compile time (see settings.js).

var ENVIRONMENT_IS_WEB = false;
var ENVIRONMENT_IS_WORKER = false;
var ENVIRONMENT_IS_NODE = false;
var ENVIRONMENT_IS_SHELL = false;
ENVIRONMENT_IS_WEB = typeof window === 'object';
ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';
ENVIRONMENT_IS_NODE = typeof process === 'object' && typeof require === 'function' && !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_WORKER;
ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;



// Three configurations we can be running in:
// 1) We could be the application main() thread running in the main JS UI thread. (ENVIRONMENT_IS_WORKER == false and ENVIRONMENT_IS_PTHREAD == false)
// 2) We could be the application main() thread proxied to worker. (with Emscripten -s PROXY_TO_WORKER=1) (ENVIRONMENT_IS_WORKER == true, ENVIRONMENT_IS_PTHREAD == false)
// 3) We could be an application pthread running in a worker. (ENVIRONMENT_IS_WORKER == true and ENVIRONMENT_IS_PTHREAD == true)




// `/` should be present at the end if `scriptDirectory` is not empty
var scriptDirectory = '';
function locateFile(path) {
  if (Module['locateFile']) {
    return Module['locateFile'](path, scriptDirectory);
  } else {
    return scriptDirectory + path;
  }
}

if (ENVIRONMENT_IS_NODE) {
  scriptDirectory = __dirname + '/';

  // Expose functionality in the same simple way that the shells work
  // Note that we pollute the global namespace here, otherwise we break in node
  var nodeFS;
  var nodePath;

  Module['read'] = function shell_read(filename, binary) {
    var ret;
    ret = tryParseAsDataURI(filename);
    if (!ret) {
      if (!nodeFS) nodeFS = require('fs');
      if (!nodePath) nodePath = require('path');
      filename = nodePath['normalize'](filename);
      ret = nodeFS['readFileSync'](filename);
    }
    return binary ? ret : ret.toString();
  };

  Module['readBinary'] = function readBinary(filename) {
    var ret = Module['read'](filename, true);
    if (!ret.buffer) {
      ret = new Uint8Array(ret);
    }
    assert(ret.buffer);
    return ret;
  };

  if (process['argv'].length > 1) {
    Module['thisProgram'] = process['argv'][1].replace(/\\/g, '/');
  }

  Module['arguments'] = process['argv'].slice(2);

  if (typeof module !== 'undefined') {
    module['exports'] = Module;
  }

  process['on']('uncaughtException', function(ex) {
    // suppress ExitStatus exceptions from showing an error
    if (!(ex instanceof ExitStatus)) {
      throw ex;
    }
  });
  // Currently node will swallow unhandled rejections, but this behavior is
  // deprecated, and in the future it will exit with error status.
  process['on']('unhandledRejection', abort);

  Module['quit'] = function(status) {
    process['exit'](status);
  };

  Module['inspect'] = function () { return '[Emscripten Module object]'; };
} else
if (ENVIRONMENT_IS_SHELL) {


  if (typeof read != 'undefined') {
    Module['read'] = function shell_read(f) {
      var data = tryParseAsDataURI(f);
      if (data) {
        return intArrayToString(data);
      }
      return read(f);
    };
  }

  Module['readBinary'] = function readBinary(f) {
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
    Module['arguments'] = scriptArgs;
  } else if (typeof arguments != 'undefined') {
    Module['arguments'] = arguments;
  }

  if (typeof quit === 'function') {
    Module['quit'] = function(status) {
      quit(status);
    }
  }
} else
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


  Module['read'] = function shell_read(url) {
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
    Module['readBinary'] = function readBinary(url) {
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

  Module['readAsync'] = function readAsync(url, onload, onerror) {
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

  Module['setWindowTitle'] = function(title) { document.title = title };
} else
{
}

// Set up the out() and err() hooks, which are how we can print to stdout or
// stderr, respectively.
// If the user provided Module.print or printErr, use that. Otherwise,
// console.log is checked first, as 'print' on the web will open a print dialogue
// printErr is preferable to console.warn (works better in shells)
// bind(console) is necessary to fix IE/Edge closed dev tools panel behavior.
var out = Module['print'] || (typeof console !== 'undefined' ? console.log.bind(console) : (typeof print !== 'undefined' ? print : null));
var err = Module['printErr'] || (typeof printErr !== 'undefined' ? printErr : ((typeof console !== 'undefined' && console.warn.bind(console)) || out));

// Merge back in the overrides
for (key in moduleOverrides) {
  if (moduleOverrides.hasOwnProperty(key)) {
    Module[key] = moduleOverrides[key];
  }
}
// Free the object hierarchy contained in the overrides, this lets the GC
// reclaim data used e.g. in memoryInitializerRequest, which is a large typed array.
moduleOverrides = undefined;

// perform assertions in shell.js after we set up out() and err(), as otherwise if an assertion fails it cannot print the message



// Copyright 2017 The Emscripten Authors.  All rights reserved.
// Emscripten is available under two separate licenses, the MIT license and the
// University of Illinois/NCSA Open Source License.  Both these licenses can be
// found in the LICENSE file.

// {{PREAMBLE_ADDITIONS}}

var STACK_ALIGN = 16;


function dynamicAlloc(size) {
  var ret = HEAP32[DYNAMICTOP_PTR>>2];
  var end = (ret + size + 15) & -16;
  if (end <= _emscripten_get_heap_size()) {
    HEAP32[DYNAMICTOP_PTR>>2] = end;
  } else {
    var success = _emscripten_resize_heap(end);
    if (!success) return 0;
  }
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

var asm2wasmImports = { // special asm2wasm imports
    "f64-rem": function(x, y) {
        return x % y;
    },
    "debugger": function() {
        debugger;
    }
};



var jsCallStartIndex = 1;
var functionPointers = new Array(0);

// Add a wasm function to the table.
// Attempting to call this with JS function will cause of table.set() to fail
function addWasmFunction(func) {
  var table = wasmTable;
  var ret = table.length;
  table.grow(1);
  table.set(ret, func);
  return ret;
}

// 'sig' parameter is currently only used for LLVM backend under certain
// circumstance: RESERVED_FUNCTION_POINTERS=1, EMULATED_FUNCTION_POINTERS=0.
function addFunction(func, sig) {

  var base = 0;
  for (var i = base; i < base + 0; i++) {
    if (!functionPointers[i]) {
      functionPointers[i] = func;
      return jsCallStartIndex + i;
    }
  }
  throw 'Finished up all reserved function pointers. Use a higher value for RESERVED_FUNCTION_POINTERS.';

}

function removeFunction(index) {
  functionPointers[index-jsCallStartIndex] = null;
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
}

var getTempRet0 = function() {
  return tempRet0;
}


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


if (typeof WebAssembly !== 'object') {
  err('no native wasm support detected');
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

// Potentially used for direct table calls.
var wasmTable;


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




/** @type {function(number, number=)} */
function Pointer_stringify(ptr, length) {
  abort("this function has been removed - you should use UTF8ToString(ptr, maxBytesToRead) instead!");
}

// Given a pointer 'ptr' to a null-terminated ASCII-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function AsciiToString(ptr) {
  var str = '';
  while (1) {
    var ch = HEAP8[((ptr++)>>0)];
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





function demangle(func) {
  return func;
}

function demangleAll(text) {
  var regex =
    /__Z[\w\d_]+/g;
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

function updateGlobalBuffer(buf) {
  Module['buffer'] = buffer = buf;
}

function updateGlobalBufferViews() {
  Module['HEAP8'] = HEAP8 = new Int8Array(buffer);
  Module['HEAP16'] = HEAP16 = new Int16Array(buffer);
  Module['HEAP32'] = HEAP32 = new Int32Array(buffer);
  Module['HEAPU8'] = HEAPU8 = new Uint8Array(buffer);
  Module['HEAPU16'] = HEAPU16 = new Uint16Array(buffer);
  Module['HEAPU32'] = HEAPU32 = new Uint32Array(buffer);
  Module['HEAPF32'] = HEAPF32 = new Float32Array(buffer);
  Module['HEAPF64'] = HEAPF64 = new Float64Array(buffer);
}


var STATIC_BASE = 1024,
    STACK_BASE = 51456,
    STACKTOP = STACK_BASE,
    STACK_MAX = 5294336,
    DYNAMIC_BASE = 5294336,
    DYNAMICTOP_PTR = 51200;




var TOTAL_STACK = 5242880;

var TOTAL_MEMORY = Module['TOTAL_MEMORY'] || 134217728;
if (TOTAL_MEMORY < TOTAL_STACK) err('TOTAL_MEMORY should be larger than TOTAL_STACK, was ' + TOTAL_MEMORY + '! (TOTAL_STACK=' + TOTAL_STACK + ')');

// Initialize the runtime's memory







// Use a provided buffer, if there is one, or else allocate a new one
if (Module['buffer']) {
  buffer = Module['buffer'];
} else {
  // Use a WebAssembly memory where available
  if (typeof WebAssembly === 'object' && typeof WebAssembly.Memory === 'function') {
    wasmMemory = new WebAssembly.Memory({ 'initial': TOTAL_MEMORY / WASM_PAGE_SIZE });
    buffer = wasmMemory.buffer;
  } else
  {
    buffer = new ArrayBuffer(TOTAL_MEMORY);
  }
  Module['buffer'] = buffer;
}
updateGlobalBufferViews();


HEAP32[DYNAMICTOP_PTR>>2] = DYNAMIC_BASE;






// Endianness check (note: assumes compiler arch was little-endian)

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
  // compatibility - merge in anything from Module['preRun'] at this time
  if (Module['preRun']) {
    if (typeof Module['preRun'] == 'function') Module['preRun'] = [Module['preRun']];
    while (Module['preRun'].length) {
      addOnPreRun(Module['preRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPRERUN__);
}

function ensureInitRuntime() {
  if (runtimeInitialized) return;
  runtimeInitialized = true;
  callRuntimeCallbacks(__ATINIT__);
}

function preMain() {
  callRuntimeCallbacks(__ATMAIN__);
}

function exitRuntime() {
  callRuntimeCallbacks(__ATEXIT__);
  runtimeExited = true;
}

function postRun() {
  // compatibility - merge in anything from Module['postRun'] at this time
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
  __ATEXIT__.unshift(cb);
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




var wasmBinaryFile = 'data:application/octet-stream;base64,AGFzbQEAAAABuwh9YAABf2ACf38AYAN/f38AYAF/AX9gA39/fwF/YAF/AGACf3wBfGAEf3x8fAF8YAN/fHwBfGABfwF8YAJ/fABgBH9/f38Bf2ADf39/AXxgA39/fABgBH98f3wBfGAFf3x/fH8BfGAEf3x/fABgBX98f3x8AGAGf3x/fHx8AGADf3x8AGAFf319f38AYAV8fHx8fAF8YAN8fHwBfGAGf3x8f3x8AXxgBn98fHx8fAF8YAZ/fHx8f38BfGAIf3x8fHx8f38BfGADf3x/AXxgAn9/AXxgBn98f3x8fAF8YAJ/fAF/YAJ/fwF/YAV/f39/fwF/YAh/f39/f39/fwF/YAV/f35/fwBgBn9/f39/fwF/YAAAYAR/f39/AGAGf39/f39/AGAFf39/f38AYAN/f3wBfGAEf398fAF8YAV/f3x8fAF8YAd/f3x8fHx8AXxgCX9/fHx8fHx/fwF8YAd/f3x8fH9/AXxgB39/fHx/fHwBfGAEf398fwF8YAV/f3x/fAF8YAd/f3x/fHx8AXxgBn9/fH98fwF8YAR/f39/AXxgA39/fAF/YAR/f398AX9gBH9/f30Bf2AFf39/f3wBf2AGf39/f398AX9gB39/f39/f38Bf2AFf39/f34Bf2AEf398fABgBX9/fH98AGAGf398f3x8AGAHf398f3x8fABgA39/fQBgBn9/fX1/fwBgBH9/f3wAYAR/f399AGANf39/f39/f39/f39/fwBgB39/f39/f38AYAh/f39/f39/fwBgCn9/f39/f39/f38AYAx/f39/f39/f39/f38AYAF8AXxgAX0BfWACf30AYAF/AX1gBX98fHx/AXxgA399fQBgA39/fgBgBH9/f34BfmAFf39/f38BfGAGf39/f39/AXxgAn9/AX5gAnx/AXxgAnx8AXxgAXwBfmADfn9/AX9gAn5/AX9gBn98f39/fwF/YAN/f38BfmAEf39/fwF+YAN8fH8BfGACfH8Bf2ACf38BfWADf39/AX1gA39+fwF/YAp/f39/f39/f39/AX9gDH9/f39/f39/f39/fwF/YAt/f39/f39/f39/fwF/YA9/f39/f39/f39/f39/f38AYAR/f398AXxgBX9/f3x8AXxgBn9/f3x8fAF8YAh/f398fHx8fAF8YAp/f398fHx8fH9/AXxgCH9/f3x8fH9/AXxgCH9/f3x8f3x8AXxgBX9/f3x/AXxgBn9/f3x/fAF8YAh/f398f3x8fAF8YAd/f398f3x/AXxgBX9/f399AX9gB39/f39/f3wBf2AJf39/f39/f39/AX9gBn9/f39/fgF/YAV/f398fABgBn9/f3x/fABgB39/f3x/fHwAYAh/f398f3x8fABgB39/f319f38AYAV/f39/fABgBX9/f399AGAGf39/fn9/AGAGf398fH9/AGAHf39/fHx/fwAClwo1A2VudgVhYm9ydAAFA2VudhlfX19jeGFfYWxsb2NhdGVfZXhjZXB0aW9uAAMDZW52DF9fX2N4YV90aHJvdwACA2VudhlfX19jeGFfdW5jYXVnaHRfZXhjZXB0aW9uAAADZW52B19fX2xvY2sABQNlbnYLX19fbWFwX2ZpbGUAHwNlbnYLX19fc2V0RXJyTm8ABQNlbnYNX19fc3lzY2FsbDE0MAAfA2Vudg1fX19zeXNjYWxsMTQ1AB8DZW52DV9fX3N5c2NhbGwxNDYAHwNlbnYNX19fc3lzY2FsbDIyMQAfA2VudgtfX19zeXNjYWxsNQAfA2VudgxfX19zeXNjYWxsNTQAHwNlbnYLX19fc3lzY2FsbDYAHwNlbnYMX19fc3lzY2FsbDkxAB8DZW52CV9fX3VubG9jawAFA2VudhZfX2VtYmluZF9yZWdpc3Rlcl9ib29sACcDZW52F19fZW1iaW5kX3JlZ2lzdGVyX2NsYXNzAEMDZW52Jl9fZW1iaW5kX3JlZ2lzdGVyX2NsYXNzX2NsYXNzX2Z1bmN0aW9uAEQDZW52I19fZW1iaW5kX3JlZ2lzdGVyX2NsYXNzX2NvbnN0cnVjdG9yACYDZW52IF9fZW1iaW5kX3JlZ2lzdGVyX2NsYXNzX2Z1bmN0aW9uAEUDZW52IF9fZW1iaW5kX3JlZ2lzdGVyX2NsYXNzX3Byb3BlcnR5AEYDZW52F19fZW1iaW5kX3JlZ2lzdGVyX2VtdmFsAAEDZW52F19fZW1iaW5kX3JlZ2lzdGVyX2Zsb2F0AAIDZW52GV9fZW1iaW5kX3JlZ2lzdGVyX2ludGVnZXIAJwNlbnYdX19lbWJpbmRfcmVnaXN0ZXJfbWVtb3J5X3ZpZXcAAgNlbnYbX19lbWJpbmRfcmVnaXN0ZXJfc21hcnRfcHRyAEcD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d2FwX2kzMgCODg9fbGx2bV9yb3VuZF9mNjQAjw4HX21hbGxvYwD/CQdfbWVtY3B5AJAOCF9tZW1tb3ZlAJEOB19tZW1zZXQAkg4XX3B0aHJlYWRfY29uZF9icm9hZGNhc3QApAMTX3B0aHJlYWRfbXV0ZXhfbG9jawCkAxVfcHRocmVhZF9tdXRleF91bmxvY2sApAMFX3NicmsAkw4MZHluQ2FsbF9kZGRkAJQODmR5bkNhbGxfZGRkZGRkAJUOCmR5bkNhbGxfZGkAlg4LZHluQ2FsbF9kaWQAlw4MZHluQ2FsbF9kaWRkAJgODWR5bkNhbGxfZGlkZGQAmQ4PZHluQ2FsbF9kaWRkZGRkAJoOEWR5bkNhbGxfZGlkZGRkZGlpAJsOD2R5bkNhbGxfZGlkZGRpaQCcDg9keW5DYWxsX2RpZGRpZGQAnQ4MZHluQ2FsbF9kaWRpAJ4ODWR5bkNhbGxfZGlkaWQAnw4PZHluQ2FsbF9kaWRpZGRkAKAODmR5bkNhbGxfZGlkaWRpAKEOC2R5bkNhbGxfZGlpAKIODGR5bkNhbGxfZGlpZACjDg1keW5DYWxsX2RpaWRkAKQODmR5bkNhbGxfZGlpZGRkAKUOEGR5bkNhbGxfZGlpZGRkZGQApg4SZHluQ2FsbF9kaWlkZGRkZGlpAKcOEGR5bkNhbGxfZGlpZGRkaWkAqA4QZHluQ2FsbF9kaWlkZGlkZACpDg1keW5DYWxsX2RpaWRpAKoODmR5bkNhbGxfZGlpZGlkAKsOEGR5bkNhbGxfZGlpZGlkZGQArA4PZHluQ2FsbF9kaWlkaWRpAK0ODGR5bkNhbGxfZGlpaQCuDg1keW5DYWxsX2RpaWlpAK8OCWR5bkNhbGxfaQCwDgpkeW5DYWxsX2lpALEOC2R5bkNhbGxfaWlkALIOC2R5bkNhbGxfaWlpALMODGR5bkNhbGxfaWlpZAC0DgxkeW5DYWxsX2lpaWkAtQ4NZHluQ2FsbF9paWlpZAC2Dg1keW5DYWxsX2lpaWlmAJoPDWR5bkNhbGxfaWlpaWkAuA4OZHluQ2FsbF9paWlpaWQAuQ4OZHluQ2FsbF9paWlpaWkAug4PZHluQ2FsbF9paWlpaWlkALsOD2R5bkNhbGxfaWlpaWlpaQC8DhBkeW5DYWxsX2lpaWlpaWlpAL0OEWR5bkNhbGxfaWlpaWlpaWlpAL4ODmR5bkNhbGxfaWlpaWlqAJsPCWR5bkNhbGxfdgDADgpkeW5DYWxsX3ZpAMEOC2R5bkNhbGxfdmlkAMIODGR5bkNhbGxfdmlkZADDDg1keW5DYWxsX3ZpZGlkAMQODmR5bkNhbGxfdmlkaWRkAMUOD2R5bkNhbGxfdmlkaWRkZADGDg5keW5DYWxsX3ZpZmZpaQCcDwtkeW5DYWxsX3ZpaQDIDgxkeW5DYWxsX3ZpaWQAyQ4NZHluQ2FsbF92aWlkZADKDg5keW5DYWxsX3ZpaWRpZADLDg9keW5DYWxsX3ZpaWRpZGQAzA4QZHluQ2FsbF92aWlkaWRkZADNDgxkeW5DYWxsX3ZpaWYAnQ8PZHluQ2FsbF92aWlmZmlpAJ4PDGR5bkNhbGxfdmlpaQDQDg1keW5DYWxsX3ZpaWlkANEODWR5bkNhbGxfdmlpaWYAnw8NZHluQ2FsbF92aWlpaQDTDg5keW5DYWxsX3ZpaWlpaQDUDg9keW5DYWxsX3ZpaWlpaWkA1Q4OZHluQ2FsbF92aWlqaWkAoA8TZXN0YWJsaXNoU3RhY2tTcGFjZQA0C2dsb2JhbEN0b3JzADAKc3RhY2tBbGxvYwAxDHN0YWNrUmVzdG9yZQAzCXN0YWNrU2F2ZQAyCfwRAQAjAAuWCdcOWdgOVldY2Q68B0RISk5PUY4IigjZDtkO2Q7ZDtkO2Q7aDr0HwAfBB8UHyAfCB78HvgfGB48IkAibCFzaDtoO2w7DB8cHzgfPB11eYdwOxAfQB9EH0geLCI0IrAXdDqgFmghk3g6gCN8OnwjgDpkI4Q6hCOIOzAfjDl9g4w7kDs0H5Q7yArYDtgPBBLYD9ASlCOYO5QL3BNMFsgbmDuYO5g7nDu4C8QO1BpMH5w7nDucO6A7pAu4D+gTpDs8FtwfpDuoO6gXrDuYF7A7LBe0O7wXuDtgD7w7UBvQG7w7wDtwD8Q7JB5MG8Q7yDq8D8w67ArsC4QKDA4MD6QODA4MDgwODA4MD4QWDA4MDgwODA4MDgwOCAYIBggGCAfMO8w7zDvMO8w7zDvMO8w7zDvQO9wekA/gHjwr0CKQDjgqkA6QDlQqWCsEKwQrJCsoKzgrPCpQBygvLC8wLzQvOC88L0AuUAesL7AvtC+4L7wvwC/ELkQyRDKQDkQyRDKQD5AHkAaQD5AHkAaQDpAOkA48BugykA7wM1wzYDN4M3wyEAYQBhAGkA6QDjwH7Df8NsgK8AsYCzgI9P0HZAuIC+QKWAYEDRr0DlgHFA+ED6gP2A5YB/gOeBJYBpgTGBJYB0ARUggjXB40FlgGVBbAFlgG4BdkF4gVa+AWWAYAGlwaWAZ8GuAaWAcAG2AaWAeAG9waWAf8GlgeWAZ4HdIMBZrcBwAFl5wHwAd0BjQKWAmb0DvQO9A70DvQO9A70DvQO9A70DvQO9A70DvQO9A70DvQO9A70DvQO9A70DvQO9A70DvQO9A70DvQO9A70DvQO9A70DvQO9A70DvQO9A70DvQO9A70DvQO9A70DvQO9A70DvQO9A70DvQO9A70DvQO9A70DvQO9A70DvQO9A70DvQO9A70DvQO9A70DvQO9A70DvQO9A70DvQO9A70DvQO9A70DvQO9A70DvQO9A70DvQO9A70DvQO9A70DvQO9A70DvQO9A70DvQO9A70DvQO9A70DvQO9A70DvQO9A70DvQO9A70DvQO9A70DvQO9A70DvQO9A71DmJj9Q72DpgDwQ3PA4gEsATaBJ8FwgWKBqkGygbqBokHqAf5B/oHkAqQCpcKlwrDCscKywrQCsoMzAzODOcM6QzrDNQChAPUAscDgASoBNIE6ATxBJcFugXUAoIGoQbCBuIGgQegB5MBzAH5AaIC9g72DvYO9g72DvYO9g72DvYO9g72DvcOsgf4DvQHjQqRCvUI9gj5CPoIywmKCooKlAqYCsIKxgrXCtwKqwyrDMsMzQzQDOMM6AzqDO0M6w2ADoEO1geZAWvPAa8B/AHfAaUCa50J+A74DvgO+A74DvgO+A74DvgO+A74DvgO+A74DvgO+A74DvgO+A74DvgO+A74DvgO+A75DtcB+g6uAvsOzwzkDOUM5gzsDIcFqAGFAh77DvsO+w77DvsO+w78Dq8LsAu+C78L/A78DvwO/Q7VCtoKqgurC60LsQu5C7oLvAvAC7AMsQy5DLsM0QzuDLAMtgywDMEM/Q79Dv0O/Q79Dv0O/Q79Dv0O/Q79Dv4OowynDP4O/w7gCuEK4grjCuQK5QrmCucK6ArpCuoKjwuQC5ELkguTC5QLlQuWC5cLmAuZC8QLxQvGC8cLyAvlC+YL5wvoC+kLpAyoDP8O/w7/Dv8O/w7/Dv8O/w7/Dv8O/w7/Dv8O/w7/Dv8O/w7/Dv8O/w7/Dv8O/w7/Dv8O/w7/Dv8O/w6AD4kMjQyWDJcMngyfDIAPgQ/JC+oLrgyvDLcMuAy1DLUMvwzADIEPgQ+BD4EPgQ+CD6wLrgu7C70Lgg+CD4IPgw/nDfcNgw+ED5UDlgOXA5kDpQGuA6UBmQPMA80DzgOZA64DpQGZA4UEhgSHBJkDrgOlAZkDrQSuBK8EmQOuA6UBmQPXBNgE2QSZA+ME5ATlBJkDnAWdBZ4FmQOuA6UBmQO/BcAFwQWZA64DpQGZA4cGiAaJBpkDrgOlAZkDpganBqgGmQOuA6UBmQPHBsgGyQaZA64DpQGZA+cG6AbpBpkDrgOlAZkDhgeHB4gHmQOuA6UBmQOlB6YHpweZA64DpQGZA5oKmwqcCp0K4Qf/B4AIgQjbB/IHhQqHCogKiQqSCpMKngqfCqAKoQqiCqMKpAqlCqYKpwqoCqkKkwqJCpMKiQrSCtMK1ArSCtkK0grfCtIK3wrSCt8K0grfCtIK3wrSCt8KhwyIDIcMiAzSCt8K0grfCtIK3wrSCt8K0grfCtIK3wrSCt8K0grfCtIK3wrSCt8KpQHfCt8KvQy+DMUMxgzIDMkM1QzWDNwM3QzfCt8K3wrfCt8KpQHqDaUBpQHqDfkN+g36DaUB/g3qDeoN6g2zAjs7swKzArMChQOsA7MCyAPWA7MCswKBBI8EswKpBLcExwTTBOEEiQhVswKYBaYFswK7BckFswKzAoMGkQazAqIGsAazAsMG0QazAuMG8QazAoIHkAezAqEHrwd2uAHoAY4C8gr0CqUBgAr4DYQPhQ9SRUlLTVBSU5EInAidCJ4IUqIInAikCKMIhQ+FD4UPhQ+FD4UPhQ+FD4UPhQ+FD4UPhQ+FD4YPTIcP0weID9QHiQ/VB4oPkgiLD/MHkQORA8AKxQrICs0KkgySDJIMkwyUDJQMkgySDJIMkwyUDJQMkgySDJIMlQyUDJQMkgySDJIMlQyUDJQMkQORA9kM2gzbDOAM4QziDL8CwwI+QEJHgwj9BFtorAHbAYgCiw+LD4sPiw+LD4sPiw+LD4sPiw+LD4wP9gLKB7cDtwO+BLcDgAXWBfMFwwGMD4wPjA+MD4wPjQ+6BI4PkQSPD5UEkA+ZBJEPmQKSD4MFkw881QLVAusEiAjVAogBaWqtAa4B8wHcAd4BiQKKApMPkw+T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aQEDfyMHIQMjB0EQaiQHIAMhBCABEIYBIQIgACgCACEBIAIgACgCBCIAQQF1aiECIABBAXEEfyABIAIoAgBqKAIABSABCyEAIAQgAiAAQf8BcUGgAWoRAwA2AgAgBBCWASEAIAMkByAACwUAEKQCCwYAQYTNAQtAAQF/IwchAyMHQRBqJAcgACgCACEAIAMgARCGASACEIYBIABBH3FB0AhqEQIAIAMQnAEhACADEJ0BIAMkByAACwUAEKcCCwYAQYzNAQspAQF/IwchAiMHQRBqJAcgAiABEKkCIAAQqgIgAhCGARAhNgIAIAIkBwspAQF/IwchAiMHQRBqJAcgAiAANgIAIAIgARCsAhCrAiACEKUBIAIkBwsFABCtAgsZACAAKAIAIAE4AgAgACAAKAIAQQhqNgIACwcAIAAqAgALBgBB6MsBC0sBAX8jByEEIwdBEGokByAAKAIAIQAgARCGASEBIAIQhgEhAiAEIAMQmwI4AgAgASACIAQgAEE/cUHmA2oRBAAQhgEhACAEJAcgAAsFABCwAgsFAEHwCAsGAEHShgILBwAgABC3AgsOACAARQRADwsgABDHDQsFABC4AgsFABC5AgsFABC6AgsGAEHAswELBgBBwLMBCwYAQcizAQsGAEHYswELBwBBARDFDQsRACAAQR9xQYABahEAABCGAQsFABC+AgsGAEGYzQELFAAgARCGASAAQf8BcUHKBWoRBQALBQAQwQILBgBBnM0BCwYAQYWHAgsUACABEIYBIABB/wFxQcoFahEFAAsFABDFAgsGAEGkzQELBwAgABDKAgsFABDLAgsFABDMAgsFABDNAgsGAEHoswELBgBB6LMBCwYAQfCzAQsGAEGAtAELEQAgAEEfcUGAAWoRAAAQhgELBQAQ0AILBgBBrM0BCx0AIAEQhgEgAhCGASADEIYBIABBH3FB0AhqEQIACwUAENMCCwUAQYAJC18BA38jByEDIwdBEGokByADIQQgACgCACECIAEgACgCBCIBQQF1aiEAIAFBAXEEQCACIAAoAgBqKAIAIQILIAQgACACQf8BcUGgAWoRAwA2AgAgBBCWASEAIAMkByAAC0IBAX8gACgCACEDIAEgACgCBCIBQQF1aiEAIAFBAXEEQCADIAAoAgBqKAIAIQMLIAAgAhCGASADQT9xQfQHahEBAAsFABCm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IAMLEwAgAEUEQA8LIAAQpwMgABDHDQsFABC1BAuKAQECfyMHIQMjB0EgaiQHIAAgATYCAEEUEMUNIQQgA0EIaiIFIAIQkAMgBEEANgIEIARBADYCCCAEQZTPATYCACADQRBqIgIgATYCACACQQRqIAUQmgMgBEEMaiACELEEIAIQrAQgACAENgIEIAUQiwMgAyABNgIAIAMgATYCBCAAIAMQkQMgAyQHCwoAIABBBGoQswQLGAAgAEGUzwE2AgAgAEEMahC0BCAAEKUBCwwAIAAQrQQgABDHDQsYAQF/IABBEGoiASAAKAIMEJIDIAEQiwMLFAAgAEEQakEAIAEoAgRBrZICRhsLGQAgACABKAIANgIAIABBBGogAUEEahCyBAsJACAAIAEQmgMLBwAgABCLAwsHACAAEKwECwYAQYi3AQsGAEGozwELBwAgABC4BAtcAQN/IwchASMHQRBqJAdBKBDFDSICQQA2AgQgAkEANgIIIAJBtM8BNgIAIAJBEGoiAxC5BCAAIAM2AgAgACACNgIEIAEgAzYCACABIAM2AgQgACABEJEDIAEkBwsYACAARAAAAAAAAOA/RAAAAAAAAAAAEEwLTgEBfyABEIYBIQQgACgCACEBIAQgACgCBCIEQQF1aiEAIARBAXEEQCABIAAoAgBqKAIAIQELIAAgAhDFASADEMUBIAFBAXFB6gdqERMACwUAELwECwUAQbALCwYAQeqTAgtJAQF/IAEQhgEhAyAAKAIAIQEgAyAAKAIEIgNBAXVqIQAgA0EBcQRAIAEgACgCAGooAgAhAQsgACACEMUBIAFBH3FBygdqEQoACwUAEMAECwYAQcjPAQtoAgN/AXwjByEDIwdBEGokByADIQQgARCGASECIAAoAgAhASACIAAoAgQiAEEBdWohAiAAQQFxBH8gASACKAIAaigCAAUgAQshACAEIAIgAEEPcUEGahEJADkDACAEEE8hBSADJAcgBQsFABDDBAsGAEHUzwELNAECfyMHIQEjB0EQaiQHIAAoAgQhAiABIAAoAgA2AgAgASACNgIEIAEQiwEhACABJAcgAAs0AQJ/IwchASMHQRBqJAcgACgCBCECIAEgACgCADYCACABIAI2AgQgARCLASEAIAEkByAACwcAIAAQywQLEwAgAEUEQA8LIAAQzAQgABDHDQsFABDNBAsF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IwdBEGokByABIABB/wFxQcoFahEFACABEKoDIQAgARCnAyABJAcgAAsFABCuBwtfAQR/IwchAiMHQRBqJAdBCBDFDSEDIAJBBGoiBCABEIgDIAJBCGoiASAEEIkDIAJBADYCACACQQxqIgUgAigCADYCACADIAAgASAFEKMHIAEQiwMgBBCdASACJAcgAwsTACAARQRADwsgABCnAyAAEMcNCwUAEK0HC4oBAQJ/IwchAyMHQSBqJAcgACABNgIAQRQQxQ0hBCADQQhqIgUgAhCQAyAEQQA2AgQgBEEANgIIIARByNQBNgIAIANBEGoiAiABNgIAIAJBBGogBRCaAyAEQQxqIAIQqQcgAhCkByAAIAQ2AgQgBRCLAyADIAE2AgAgAyABNgIEIAAgAxCRAyADJAcLCgAgAEEEahCrBwsYACAAQcjUATYCACAAQQxqEKwHIAAQpQELDAAgABClByAAEMcNCxgBAX8gAEEQaiIBIAAoAgwQkgMgARCLAwsUACAAQRBqQQAgASgCBEHVrAJGGwsZACAAIAEoAgA2AgAgAEEEaiABQQRqEKoHCwkAIAAgARCaAwsHACAAEIsDCwcAIAAQpAcLBgBBoL0BCwYAQdzUAQsHACAAELAHC10BA38jByEBIwdBEGokB0H4ABDFDSICQQA2AgQgAkEANgIIIAJB6NQBNgIAIAJBEGoiAxCxByAAIAM2AgAgACACNgIEIAEgAzYCACABIAM2AgQgACABEJEDIAEkBwstACAAQgA3AwAgAEIANwMIIABCADcDECAARAAAAAAAQI9ARAAAAAAAAPA/EGcLTAEBfyABEIYBIQMgACgCACEBIAMgACgCBCIDQQF1aiEAIANBAXEEQCABIAAoAgBqKAIAIQELIAAgAhDFASABQQNxQaADahEeABC0BwsFABC1BwuUAQEBf0HoABDFDSIBIAApAwA3AwAgASAAKQMINwMIIAEgACkDEDcDECABIAApAxg3AxggASAAKQMgNwMgIAEgACkDKDcDKCABIAApAzA3AzAgASAAKQM4NwM4IAFBQGsgAEFAaykDADcDACABIAApA0g3A0ggASAAKQNQNwNQIAEgACkDWDcDWCABIAApA2A3A2AgAQsGAEH81AELBgBB/a0CC38BA38jByEIIwdBEGokByAIIQkgARCGASEHIAAoAgAhASAH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AigCACICIABBLGoiBCgCACIDQQFqQQN0aisDAEQvbqMBvAVyP6KjIgc5AwAgACADQQJqIgVBA3QgAmorAwA5AyAgACADQQN0IAJqKwMAIgY5AxggAyABSCAGIABBMGoiAisDACIIoSIJREivvJry13o+ZHEEQCACIAggBiAAKwMQoUGI1QEoAgC3IAejo6A5AwAFAkAgAyABSCAJREivvJry13q+Y3EEQCACIAggBiAAKwMQoZpBiNUBKAIAtyAHo6OhOQMADAELIAMgAUgEQCAEIAU2AgAgACAGOQMQBSAEIAFBfmo2AgALCwsgACACKwMAIgY5AwggBgsXACAAQQE2AiggACABNgIsIAAgAjkDMAsRACAAQShqQQBBwIgrEJIOGgtmAQJ/IABBCGoiBCgCACACTgRAIARBADYCAAsgAEEgaiICIABBKGogBCgCACIFQQN0aiIAKwMAOQMAIAAgASADokQAAAAAAADgP6IgACsDACADoqA5AwAgBCAFQQFqNgIAIAIrAwALbQECfyAAQQhqIgUoAgAgAk4EQCAFQQA2AgALIABBIGoiBiAAQShqIARBACAEIAJIG0EDdGorAwA5AwAgAEEoaiAFKAIAIgBBA3RqIgIgAisDACADoiABIAOioDkDACAFIABBAWo2AgAgBisDAAsqAQF8IAAgAEHoAGoiACsDACIDIAEgA6EgAqKgIgE5AxAgACABOQMAIAELLQEBfCAAIAEgAEHoAGoiACsDACIDIAEgA6EgAqKgoSIBOQMQIAAgATkDACABC4YCAgJ/AXwgAEHgAWoiBEQAAAAAAAAkQCACIAJEAAAAAAAAJEBjGyICOQMAIAJBiNUBKAIAtyICZARAIAQgAjkDAAsgACAEKwMARBgtRFT7IRlAoiACoxD5CSICOQPQASAARAAAAAAAAABAIAJEAAAAAAAAAECioSIGOQPYAUQAAAAAAADwPyADIANEAAAAAAAA8D9jGyACRAAAAAAAAPC/oCICoiIDIAJEAAAAAAAACEAQ/gman0TNO39mnqD2P6KgIAOjIQMgAEHAAWoiBCsDACABIABByAFqIgUrAwAiAqEgBqKgIQEgBSACIAGgIgI5AwAgBCABIAOiOQMAIAAgAjkDECACC4sCAgJ/AXwgAEHgAWoiBEQAAAAAAAAkQCACIAJEAAAAAAAAJEBjGyICOQMAIAJBiNUBKAIAtyICZARAIAQgAjkDAAsgACAEKwMARBgtRFT7IRlAoiACoxD5CSICOQPQASAARAAAAAAAAABAIAJEAAAAAAAAAECioSIGOQPYAUQAAAAAAADwPyADIANEAAAAAAAA8D9jGyACRAAAAAAAAPC/oCIDoiICIANEAAAAAAAACEAQ/gman0TNO39mnqD2P6KgIAKjIQMgAEHAAWoiBSsDACABIABByAFqIgQrAwAiAqEgBqKgIQYgBCACIAagIgI5AwAgBSAGIAOiOQMAIAAgASACoSIBOQMQIAELhwICAX8CfCAAQeABaiIEIAI5AwBBiNUBKAIAtyIFRAAAAAAAAOA/oiIGIAJjBEAgBCAGOQMACyAAIAQrAwBEGC1EVPshGUCiIAWjEPkJIgU5A9ABIABEAAAAAAAA8D9E6Qsh5/3/7z8gAyADRAAAAAAAAPA/ZhsiAqEgAiACIAUgBaJEAAAAAAAAEECioUQAAAAAAAAAQKCiRAAAAAAAAPA/oJ+iIgM5AxggACACIAVEAAAAAAAAAECioiIFOQMgIAAgAiACoiICOQMoIAAgAiAAQfgAaiIEKwMAoiAFIABB8ABqIgArAwAiAqIgAyABoqCgIgE5AxAgBCACOQMAIAAgATkDACABC1cAIAIoAgAiAEQAAAAAAADwP0QAAAAAAAAAAEQAAAAAAADwPyADIANEAAAAAAAA8D9kGyIDIANEAAAAAAAAAABjGyIDoZ8gAaI5AwAgACADnyABojkDCAu5AQEBfCACKAIAIgBEAAAAAAAA8D9EAAAAAAAAAABEAAAAAAAA8D8gAyADRAAAAAAAAPA/ZBsiAyADRAAAAAAAAAAAYxsiA6EiBUQAAAAAAAAAAEQAAAAAAADwPyAEIAREAAAAAAAA8D9kGyIEIAREAAAAAAAAAABjGyIEop8gAaI5AwAgACAFRAAAAAAAAPA/IAShIgWinyABojkDCCAAIAMgBKKfIAGiOQMQIAAgAyAFop8gAaI5AxgLrwIBA3wgAigCACIARAAAAAAAAPA/RAAAAAAAAAAARAAAAAAAAPA/IAMgA0QAAAAAAADwP2QbIgMgA0QAAAAAAAAAAGMbIgOhIgZEAAAAAAAAAABEAAAAAAAA8D9EAAAAAAAAAABEAAAAAAAA8D8gBCAERAAAAAAAAPA/ZBsiBCAERAAAAAAAAAAAYxsgBUQAAAAAAADwP2QbIAVEAAAAAAAAAABjGyIEop8iByAFoSABojkDACAAIAZEAAAAAAAA8D8gBKEiBqKfIgggBaEgAaI5AwggACADIASiIgSfIAWhIAGiOQMQIAAgAyAGoiIDnyAFoSABojkDGCAAIAcgBaIgAaI5AyAgACAIIAWiIAGiOQMoIAAgBCAFop8gAaI5AzAgACADIAWinyABojkDOAsWACAAIAEQzw0aIAAgAjYCFCAAENcHC7EIAQt/IwchCyMHQeABaiQHIAsiA0HQAWohCSADQRRqIQEgA0EQaiEEIANB1AFqIQUgA0EEaiEGIAAsAAtBAEgEfyAAKAIABSAACyECIAFBxL0BNgIAIAFB7ABqIgdB2L0BNgIAIAFBADYCBCABQewAaiABQQhqIggQqwogAUEANgK0ASABENgHNgK4ASABQaDVATYCACAHQbTVATYCACAIENkHIAggAkEMENoHRQRAIAEgASgCAEF0aigCAGoiAiACKAIQQQRyEKoKCyAJQdT9AkGCrgIQ3AcgABDdByICIAIoAgBBdGooAgBqEKwKIAlBvIQDEOsKIgcoAgAoAhwhCiAHQQogCkE/cUGkA2oRHwAhByAJEOwKIAIgBxC4ChogAhCwChogASgCSEEARyIKRQRAQZ6uAiADEOUJGiABEOEHIAskByAKDwsgAUIEQQAQtAoaIAEgAEEMakEEELMKGiABQhBBABC0ChogASAAQRBqIgJBBBCzChogASAAQRhqQQIQswoaIAEgAEHgAGoiB0ECELMKGiABIABB5ABqQQQQswoaIAEgAEEcakEEELMKGiABIABBIGpBAhCzChogASAAQegAakECELMKGiAFQQA2AAAgBUEAOgAEIAIoAgBBFGohAgNAIAEgASgCAEF0aigCAGooAhBBAnFFBEAgASACrEEAELQKGiABIAVBBBCzChogASACQQRqrEEAELQKGiABIARBBBCzChogBUGMrgIQgwlFIQMgAkEIakEAIAQoAgAgAxtqIQIgA0UNAQsLIAZBADYCACAGQQRqIgVBADYCACAGQQA2AgggBiAEKAIAQQJtEN4HIAEgAqxBABC0ChogASAGKAIAIAQoAgAQswoaIAgQ3wdFBEAgASABKAIAQXRqKAIAaiICIAIoAhBBBHIQqgoLIAcuAQBBAUoE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ciAAQeUAEJEJRRsiACAAQcAAciACQfIARhsiAEGABHIgACACQfcARhsiAEGACHIgACACQeEARhsLogMBB38jByEDIwdBQGskByADQShqIQUgA0EYaiEGIANBEGohByADIQQgA0E4aiEIQay6AiABLAAAEJEJBEBBhAkQ/wkiAgRAIAJBAEH8ABCSDhogAUErEJEJRQRAIAJBCEEEIAEsAABB8gBGGzYCAAsgAUHlABCRCQRAIAQgADYCACAEQQI2AgQgBEEBNgIIQd0BIAQQChoLIAEsAABB4QBGBEAgByAANgIAIAdBAzYCBEHdASAHEAoiAUGACHFFBEAgBiAANgIAIAZBBDYCBCAGIAFBgAhyNgIIQd0BIAYQChoLIAIgAigCAEGAAXIiATYCAAUgAigCACEBCyACIAA2AjwgAiACQYQBajYCLCACQYAINgIwIAJBywBqIgRBfzoAACABQQhxRQRAIAUgADYCACAFQZOoATYCBCAFIAg2AghBNiAFEAxFBEAgBEEKOgAACwsgAkEGNgIgIAJBBDYCJCACQQU2AiggAkEFNgIMQdT3AigCAEUEQCACQX82AkwLIAIQlAkaBUEAIQILBRD4CEEWNgIAQQAhAgsgAyQHIAILLgECfyAAEJUJIgEoAgA2AjggASgCACICBEAgAiAANgI0CyABIAA2AgAQlgkgAAsMAEGU+AIQBEGc+AILCABBlPgCEA8L/AEBA38gAUH/AXEiAgRAAkAgAEEDcQRAIAFB/wFxIQMDQCAALAAAIgRFIANBGHRBGHUgBEZyDQIgAEEBaiIAQQNxDQALCyACQYGChAhsIQMgACgCACICQf/9+3dqIAJBgIGChHhxQYCBgoR4c3FFBEADQCACIANzIgJB//37d2ogAkGAgYKEeHFBgIGChHhzcUUEQAEgAEEEaiIAKAIAIgJB//37d2ogAkGAgYKEeHFBgIGChHhzcUUNAQsLCyABQf8BcSECA0AgAEEBaiEBIAAsAAAiA0UgAkEYdEEYdSADRnJFBEAgASEADAELCwsFIAAQhgkgAGohAAsgAAvFAQEGfyAAKAJMQX9KBH8gABCEAQVBAAshBCAAEIkJIAAoAgBBAXFBAEciBUUEQBCVCSECIAAoAjQiASEGIABBOGohAyABBEAgASADKAIANgI4CyADKAIAIgEhAyABBEAgASAGNgI0CyAAIAIoAgBGBEAgAiADNgIACxCWCQsgABCZCSECIAAoAgwhASAAIAFB/wFxQaABahEDACACciECIAAoAlwiAQRAIAEQgAoLIAUEQCAEBEAgABClAQsFIAAQgAoLIAILqwEBAn8gAARAAn8gACgCTEF/TARAIAAQmgkMAQsgABCEAUUhAiAAEJoJIQEgAgR/IAEFIAAQpQEgAQsLIQAFQcDZASgCAAR/QcDZASgCABCZCQVBAAshABCVCSgCACIBBEADQCABKAJMQX9KBH8gARCEAQVBAAshAiABKAIUIAEoAhxLBEAgARCaCSAAciEACyACBEAgARClAQsgASgCOCIBDQALCxCWCQsgAAukAQEHfwJ/AkAgAEEUaiICKAIAIABBHGoiAygCAE0NACAAKAIkIQEgAEEAQQAgAUE/cUHmA2oRBAAaIAIoAgANAEF/DAELIABBBGoiASgCACIEIABBCGoiBSgCACIGSQRAIAAoAighByAAIAQgBmtBASAHQT9xQeYDahEEABoLIABBADYCECADQQA2AgAgAkEANgIAIAVBADYCACABQQA2AgBBAAsLJwEBfyMHIQMjB0EQaiQHIAMgAjYCACAAIAEgAxCcCSEAIAMkByAAC7ABAQF/IwchAyMHQYABaiQHIANCADcCACADQgA3AgggA0IANwIQIANCADcCGCADQgA3AiAgA0IANwIoIANCADcCMCADQgA3AjggA0FAa0IANwIAIANCADcCSCADQgA3AlAgA0IANwJYIANCADcCYCADQgA3AmggA0IANwJwIANBADYCeCADQSY2AiAgAyAANgIsIANBfzYCTCADIAA2AlQgAyABIAIQngkhACADJAcgAAsLACAAIAEgAhCzCQvDFgMcfwF+AXwjByEVIwdBoAJqJAcgFUGIAmohFCAVIgxBhAJqIRcgDEGQAmohGCAAKAJMQX9KBH8gABCEAQVBAAshGiABLAAAIggEQAJAIABBBGohBSAAQeQAaiENIABB7ABqIREgAEEIaiESIAxBCmohGSAMQSFqIRsgDEEuaiEcIAxB3gBqIR0gFEEEaiEeQQAhA0EAIQ9BACEGQQAhCQJAAkACQAJAA0ACQCAIQf8BcRCECQRAA0AgAUEBaiIILQAAEIQJBEAgCCEBDAELCyAAQQAQnwkDQCAFKAIAIgggDSgCAEkE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/wCDQoCAgICAgID4/wBWcg0BIAZCAYYiCSAFWARAIABEAAAAAAAAAACiIAAgBSAJURsPCyACBH4gBkL/////////B4NCgICAgICAgAiEBSAGQgyGIgVCf1UEQEEAIQIDQCACQX9qIQIgBUIBhiIFQn9VDQALBUEAIQILIAZBASACa62GCyIGIAQEfiAHQv////////8Hg0KAgICAgICACIQFIAdCDIYiBUJ/VQRAQQAhAwNAIANBf2ohAyAFQgGGIgVCf1UNAAsFQQAhAwsgB0EBIAMiBGuthgsiB30iBUJ/VSEDIAIgBEoEQAJAA0ACQCADBEAgBUIAUQ0BBSAGIQULIAVCAYYiBiAHfSIFQn9VIQMgAkF/aiICIARKDQEMAgsLIABEAAAAAAAAAACiDAILCyADBEAgAEQAAAAAAAAAAKIgBUIAUQ0BGgUgBiEFCyAFQoCAgICAgIAIVARAA0AgAkF/aiECIAVCAYYiBUKAgICAgICACFQNAAsLIAJBAEoEfiAFQoCAgICAgIB4fCACrUI0hoQFIAVBASACa62ICyAIhL8LDAELIAAgAaIiACAAowsLBQAgAL0LIgAgAL1C////////////AIMgAb1CgICAgICAgICAf4OEvwtNAQN/IwchASMHQRBqJAcgASECIAAQsgkEf0F/BSAAKAIgIQMgACACQQEgA0E/cUHmA2oRBABBAUYEfyACLQAABUF/CwshACABJAcgAAuhAQEDfyAAQcoAaiICLAAAIQEgAiABIAFB/wFqcjoAACAAQRRqIgEoAgAgAEEcaiICKAIASwRAIAAoAiQhAyAAQQBBACADQT9xQeYDahEEABoLIABBADYCECACQQA2AgAgAUEANgIAIAAoAgAiAUEEcQR/IAAgAUEgcjYCAEF/BSAAIAAoAiwgACgCMGoiAjYCCCAAIAI2AgQgAUEbdEEfdQsLXQEEfyAAQdQAaiIFKAIAIgNBACACQYACaiIGELQJIQQgASADIAQgA2sgBiAEGyIBIAIgASACSRsiAhCQDhogACACIANqNgIEIAAgASADaiIANgIIIAUgADYCACACC/kBAQN/IAFB/wFxIQQCQAJAAkAgAkEARyIDIABBA3FBAEdxBEAgAUH/AXEhBQNAIAUgAC0AAEYNAiACQX9qIgJBAEciAyAAQQFqIgBBA3FBAEdxDQAL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AWohACAGQX9qIgZBAEcgAiAIayICQQBHcQ0BDAILCwJAAkACQCAIQX9rDgIAAQILIAghAAwCCyAHQQA2AgAMAQsgBEEANgIACwsLIAsEQCABIAcoAgA2AgALIAkkByAAC2ABAX8gACgCKCEBIABBACAAKAIAQYABcQR/QQJBASAAKAIUIAAoAhxLGwVBAQsgAUE/cUHmA2oRBAAiAUEATgRAIAAoAhQgACgCBCABIAAoAghramogACgCHGshAQsgAQszAQJ/IAAoAkxBf0oEQCAAEIQBRSECIAAQ7AkhASACRQRAIAAQpQELBSAAEOwJIQELIAELDAAgACABQQAQ7wm2C+wBAgR/AXwjByEEIwdBgAFqJAcgBCIDQgA3AgAgA0IANwIIIANCADcCECADQgA3AhggA0IANwIgIANCADcCKCADQgA3AjAgA0IANwI4IANBQGtCADcCACADQgA3AkggA0IANwJQIANCADcCWCADQgA3AmAgA0IANwJoIANCADcCcCADQQA2AnggA0EEaiIFIAA2AgAgA0EIaiIGQX82AgAgAyAANgIsIANBfzYCTCADQQAQnwkgAyACQQEQpgkhByADKAJsIAUoAgAgBigCAGtqIQIgAQRAIAEgACACaiAAIAIbNgIACyAEJAcgBwsLACAAIAFBARDvCQsLACAAIAFBAhDvCQsJACAAIAEQ7gkLCQAgACABEPAJCwkAIAAgARDxCQswAQJ/IAIEQCAAIQMDQCADQQRqIQQgAyABNgIAIAJBf2oiAgRAIAQhAwwBCwsLIAALbwEDfyAAIAFrQQJ1IAJJBEADQCACQX9qIgJBAnQgAGogAkECdCABaigCADYCACACDQALBSACBEAgACEDA0AgAUEEaiEEIANBBGohBSADIAEoAgA2AgAgAkF/aiICBEAgBCEBIAUhAwwBCwsLCyAACxQAQQAgACABIAJBsPgCIAIbEKMJC98CAQZ/IwchCCMHQZACaiQHIAhBgAJqIgYgASgCACIFNgIAIANBgAIgAEEARyIKGyEEIAAgCCIHIAobIQMgBEEARyAFQQBHcQRAAkBBACEAA0ACQCACIARPIgkgAkEgS3JFDQIgAiAEIAIgCRsiBWshAiADIAYgBUEAEOkJIgVBf0YNACAEQQAgBSADIAdGIgkbayEEIAMgAyAFaiAJGyEDIAAgBWoh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IBAoAgA2AgAgACAFQQxqIAEgCCAEIAkQ1wsMFAsgESABKAIANgIAIBIgAigCADYCACAKIBEoAgA2AgAgCCASKAIANgIAIAEgACAKIAggAyAEIAVBq8UCQbPFAhDWCzYCAAwTCyATIAEoAgA2AgAgFCACKAIANgIAIAogEygCADYCACAIIBQoAgA2AgAgASAAIAogCCADIAQgBUGzxQJBu8UCENYLNgIADBILIBUgAigCADYCACAIIBUoAgA2AgAgACAFQQhqIAEgCCAEIAkQ2AsMEQsgFiACKAIANgIAIAggFigCADYCACAAIAVBCGogASAIIAQgCRDZCwwQCyAXIAIoAgA2AgAgCCAXKAIANgIAIAAgBUEcaiABIAggBCAJENoLDA8LIBggAigCADYCACAIIBgoAgA2AgAgACAFQRBqIAEgCCAEIAkQ2wsMDgsgGSACKAIANgIAIAggGSgCADYCACAAIAVBBGogASAIIAQgCRDcCwwNCyAaIAIoAgA2AgAgCCAaKAIANgIAIAAgASAIIAQgCRDdCwwMCyAbIAIoAgA2AgAgCCAbKAIANgIAIAAgBUEIaiABIAggBCAJEN4LDAsLIBwgASgCADYCACAdIAIoAgA2AgAgCiAcKAIANgIAIAggHSgCADYCACABIAAgCiAIIAMgBCAFQbvFAkHGxQIQ1gs2AgAMCgsgHiABKAIANgIAIB8gAigCADYCACAKIB4oAgA2AgAgCCAfKAIANgIAIAEgACAKIAggAyAEIAVBxsUCQcvFAhDWCzYCAAwJCyAgIAIoAgA2AgAgCCAgKAIANgIAIAAgBSABIAggBCAJEN8LDAgLICEgASgCADYCACAiIAIoAgA2AgAgCiAhKAIANgIAIAggIigCADYCACABIAAgCiAIIAMgBCAFQcvFAkHTxQIQ1gs2AgAMBwsgIyACKAIANgIAIAggIygCADYCACAAIAVBGGogASAIIAQgCRDgCwwGCyAAKAIAKAIUIQYgJCABKAIANgIAICUgAigCADYCACAKICQoAgA2AgAgCCAlKAIANgIAIAAgCiAIIAMgBCAFIAZBP3FB5gRqESMADAYLIABBCGoiBigCACgCGCELIAYgC0H/AXFBoAFqEQMAIQYgJiABKAIANgIAICcgAigCADYCACAGKAIAIAYgBiwACyICQQBIIgsbIgkgBigC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FyACKAIANgIAIAggFygCADYCACAAIAVBHGogASAIIAQgCRD8CwwPCyAYIAIoAgA2AgAgCCAYKAIANgIAIAAgBUEQaiABIAggBCAJEP0LDA4LIBkgAigCADYCACAIIBkoAgA2AgAgACAFQQRqIAEgCCAEIAkQ/gsMDQsgGiACKAIANgIAIAggGigCADYCACAAIAEgCCAEIAkQ/wsMDAsgGyACKAIANgIAIAggGygCADYCACAAIAVBCGogASAIIAQgCRCADAwLCyAcIAEoAgA2AgAgHSACKAIANgIAIAogHCgCADYCACAIIB0oAgA2AgAgASAAIAogCCADIAQgBUHgrwFBjLABEPgLNgIADAoLIB4gASgCADYCACAfIAIoAgA2AgAgCiAeKAIANgIAIAggHygCADYCACABIAAgCiAIIAMgBCAFQZCwAUGksAEQ+As2AgAMCQsgICACKAIANgIAIAggICgCADYCACAAIAUgASAIIAQgCRCBDAwICyAhIAEoAgA2AgAgIiACKAIANgIAIAogISgCADYCACAIICIoAgA2AgAgASAAIAogCCADIAQgBUGwsAFB0LABEPgLNgIADAcLICMgAigCADYCACAIICMoAgA2AgAgACAFQRhqIAEgCCAEIAkQggwMBgsgACgCACgCFCEGICQgASgCADYCACAlIAIoAgA2AgAgCiAkKAIANgIAIAggJSgCADYCACAAIAogCCADIAQgBSAGQT9xQeYEahEjAAwGCyAAQQhqIgYoAgAoAhghCyAGIAtB/wFxQaABahEDACEGICYgASgCADYCACAnIAIoAgA2AgAgBigCACAGIAYsAAsiC0EASCIJGyECIAYoAgQgC0H/AXEgCRtBAnQgAmohBiAKICYoAgA2AgAgCCAnKAIANgIAIAEgACAKIAggAyAEIAUgAiAGEPgLNgIADAQLICggAigCADYCACAIICgoAgA2AgAgACAFQRRqIAEgCCAEIAkQgwwMAwsgKSACKAIANgIAIAggKSgCADYCACAAIAVBFGogASAIIAQgCRCEDAwCCyALIAIoAgA2AgAgCCALKAIANgIAIAAgASAIIAQgCRCFDAwBCyAEIAQoAgBBBHI2AgALIAEoAgALIQAgByQHIAALLABBwPMCLAAARQRAQcDzAhCKDgRAEPULQYCGA0Hw8AI2AgALC0GAhgMo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AAAgASgCACgCFCEAIAogASAAQT9xQfQHahEBACAFQQtqIgAsAABBAEgEfyAFKAIAIQAgC0EAOgAAIAAgCxCLBSAFQQA2AgQgBQUgC0EAOgAAIAUgCxCLBSAAQQA6AAAgBQshACAFQQAQ0w0gACAKKQIANwIAIAAgCigCCDYCCEEAIQADQCAAQQNHBEAgAEECdCAKakEANgIAIABBAWohAAwBCwsgChDODSABKAIAKAIYIQAgCiABIABBP3FB9AdqEQEAIAZBC2oiACwAAEEASAR/IAYoAgAhACALQQA6AAAgACALEIsFIAZBADYCBCAGBSALQQA6AAAgBiALEIsFIABBADoAACAGCyEAIAZBABDTDSAAIAopAgA3AgAgACAKKAIINgIIQQAhAANAIABBA0cEQCAAQQJ0IApqQQA2AgAgAEEBaiEADAELCyAKEM4NIAEoAgAoAiQhACABIABB/wFxQaABahEDAAUgAUGchgMQ6woiASgCACgCLCEAIAsgASAAQT9xQfQHahEBACACIAsoAgA2AAAgASgCACgCICEAIAogASAAQT9xQfQHahEBACAIQQtqIgAsAABBAEgEfyAIKAIAIQAgC0EAOgAAIAAgCxCLBSAIQQA2AgQgCAUgC0EAOgAAIAggCxCLBSAAQQA6AAAgCAshACAIQQAQ0w0gACAKKQIANwIAIAAgCigCCDYCCEEAIQADQCAAQQNHBEAgAEECdCAKakEANgIAIABBAWohAAwBCwsgChDODSABKAIAKAIcIQAgCiABIABBP3FB9AdqEQEAIAdBC2oiACwAAEEASAR/IAcoAgAhACALQQA6AAAgACALEIsFIAdBADYCBCAHBSALQQA6AAAgByALEIsFIABBADoAACAHCyEAIAdBABDTDSAAIAopAgA3AgAgACAKKAIINgIIQQAhAANAIABBA0cEQCAAQQJ0IApqQQA2AgAgAEEBaiEADAELCyAKEM4NIAEoAgAoAgwhACADIAEgAEH/AXFBoAFqEQMAOgAAIAEoAgAoAhAhACAEIAEgAEH/AXFBoAFqEQMAOgAAIAEoAgAoAhQhACAKIAEgAEE/cUH0B2oRAQAgBUELaiIALAAAQQBIBH8gBSgCACEAIAtBADoAACAAIAsQiwUgBUEANgIEIAUFIAtBADoAACAFIAsQiwUgAEEAOgAAIAULIQAg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AUEASCICGyADKAIEIAFB/wFxIAIbEOMNGiADEM4NDAELIAcgBWsgCUkEQCAAIAcgBSAJaiAHayAFIAVBAEEAEOINCyAILAAAQQBIBH8gACgCAAUgAAsgBUECdGohBANAIAEgAkcEQCAEIAEQ3gogBEEEaiEEIAFBBGohAQwBCwsgA0EANgIAIAQgAxDeCiAFIAlqIQEgCCwAAEEASARAIAAgATYCBAUgCCABOgAACwsLIAokByAAC8EMAQN/IwchDCMHQRBqJAcgDEEMaiELIAwhCiAJIAAEfyABQbSGAxDrCiIBKAIAKAIsIQAgCyABIABBP3FB9AdqEQEAIAIgCygCADYAACABKAIAKAIgIQAgCiABIABBP3FB9AdqEQEAIAhBC2oiACwAAEEASARAIAgoAgAhACALQQA2AgAgACALEN4KIAhBADYCBAUgC0EANgIAIAggCxDeCiAAQQA6AAALIAhBABDgDSAIIAopAgA3AgAgCCAKKAIINgIIQQAhAANAIABBA0cEQCAAQQJ0IApqQQA2AgAgAEEBaiEADAELCyAKEM4NIAEoAgAoAhwhACAKIAEgAEE/cUH0B2oRAQAgB0ELaiIALAAAQQBIBEAgBygCACEAIAtBADYCACAAIAsQ3gogB0EANgIEBSALQQA2AgAgByALEN4KIABBADoAAAsgB0EAEOANIAcgCikCADcCACAHIAooAgg2AghBACEAA0AgAEEDRwRAIABBAnQgCmpBADYCACAAQQFqIQAMAQsLIAoQzg0gASgCACgCDCEAIAMgASAAQf8BcUGgAWoRAwA2AgAgASgCACgCECEAIAQgASAAQf8BcUGgAWoRAwA2AgAgASgCACgCFCEAIAogASAAQT9xQfQHahEBACAFQQtqIgAsAABBAEgEfyAFKAIAIQAgC0EAOgAAIAAgCxCLBSAFQQA2AgQgBQUgC0EAOgAAIAUgCxCLBSAAQQA6AAAgBQshACAFQQAQ0w0gACAKKQIANwIAIAAgCigCCDYCCEEAIQADQCAAQQNHBEAgAEECdCAKakEANgIAIABBAWohAAwBCwsgChDODSABKAIAKAIYIQAgCiABIABBP3FB9AdqEQEAIAZBC2oiACwAAEEASARAIAYoAgAhACALQQA2AgAgACALEN4KIAZBADYCBAUgC0EANgIAIAYgCxDeCiAAQQA6AAALIAZBABDgDSAGIAopAgA3AgAgBiAKKAIINgIIQQAhAANAIABBA0cEQCAAQQJ0IApqQQA2AgAgAEEBaiEADAELCyAKEM4NIAEoAgAoAiQhACABIABB/wFxQaABahEDAAUgAUGshgMQ6woiASgCACgCLCEAIAsgASAAQT9xQfQHahEBACACIAsoAgA2AAAgASgCACgCICEAIAogASAAQT9xQfQHahEBACAIQQtqIgAsAABBAEgEQCAIKAIAIQAgC0EANgIAIAAgCxDeCiAIQQA2AgQFIAtBADYCACAIIAsQ3gogAEEAOgAACyAIQQAQ4A0gCCAKKQIANwIAIAggCigCCDYCCEEAIQADQCAAQQNHBEAgAEECdCAKakEANgIAIABBAWohAAwBCwsgChDODSABKAIAKAIcIQAgCiABIABBP3FB9AdqEQEAIAdBC2oiACwAAEEASARAIAcoAgAhACALQQA2AgAgACALEN4KIAdBADYCBAUgC0EANgIAIAcgCxDeCiAAQQA6AAALIAdBABDgDSAHIAopAgA3AgAgByAKKAIINgIIQQAhAANAIABBA0cEQCAAQQJ0IApqQQA2AgAgAEEBaiEADAELCyAKEM4NIAEoAgAoAgwhACADIAEgAEH/AXFBoAFqEQMANgIAIAEoAgAoAhAhACAEIAEgAEH/AXFBoAFqEQMANgIAIAEoAgAoAhQhACAKIAEgAEE/cUH0B2oRAQAgBUELaiIALAAAQQBIBH8gBSgCACEAIAtBADoAACAAIAsQiwUgBUEANgIEIAUFIAtBADoAACAFIAsQiwUgAEEAOgAAIAULIQAgBUEAENMNIAAgCikCADcCACAAIAooAgg2AghBACEAA0AgAEEDRwRAIABBAnQgCmpBADYCACAAQQFqIQAMAQsLIAoQzg0gASgCACgCGCEAIAogASAAQT9xQfQHahEBACAGQQtqIgAsAABBAEgEQCAGKAIAIQAgC0EANgIAIAAgCxDeCiAGQQA2AgQFIAtBADYCACAGIAsQ3gogAEEAOgAACyAGQQAQ4A0gBiAKKQIANwIAIAYgCigCCDYCCEEAIQADQCAAQQNHBEAgAEECdCAKakEANgIAIABBAWohAAwBCwsgChDODSABKAIAKAIkIQAgASAAQf8BcUGgAWoRAwALNgIAIAwkBwvaBgEYfyMHIQYjB0Gg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CygCCDYCCEEAIQEDQCABQQNHBEAgAUECdCALakEANgIAIAFBAWohAQwBCwsgCxDODSAABSAAKAIAKAIoIQEgCiAAIAFBP3FB9AdqEQEAIAMgCigCADYAACAAKAIAKAIcIQEgCyAAIAFBP3FB9AdqEQEAIAhBC2oiASwAAEEASAR/IAgoAgAhASAKQQA6AAAgASAKEIsFIAhBADYCBCAIBSAKQQA6AAAgCCAKEIsFIAFBADoAACAICyEBIAhBABDTDSABIAspAgA3AgAgASALKAIINgIIQQAhAQNAIAFBA0cEQCABQQJ0IAtqQQA2AgAgAUEBaiEBDAELCyALEM4NIAALIQEgACgCACgCDCECIAQgACACQf8BcUGgAWoRAwA6AAAgACgCACgCECECIAUgACACQf8BcUGgAWoRAwA6AAAgASgCACgCFCECIAsgACACQT9xQfQHahEBACAGQQtqIgIsAABBAEgEfyAGKAIAIQIgCkEAOgAAIAIgChCLBSAGQQA2AgQgBgUgCkEAOgAAIAYgChCLBSACQQA6AAAgBgshAiAGQQAQ0w0gAiALKQIANwIAIAIgCygCCDYCCEEAIQIDQCACQQNHBEAgAkECdCALakEANgIAIAJBAWohAgwBCwsgCxDODSABKAIAKAIYIQEgCyAAIAFBP3FB9AdqEQEAIAdBC2oiASwAAEEASAR/IAcoAgAhASAKQQA6AAAgASAKEIsFIAdBADYCBCAHBSAKQQA6AAAgByAKEIsFIAFBADoAACAHCyEBIAdBABDTDSABIAspAgA3AgAgASALKAIINgIIQQAhAQNAIAFBA0cEQCABQQJ0IAtqQQA2AgAgAUEBaiEBDAELCyALEM4NIAAoAgAoAiQhASAAIAFB/wFxQaABahEDAAUgAkGchgMQ6wohACABBH8gACgCACgCLCEBIAogACABQT9xQfQHahEBACADIAooAgA2AAAgACgCACgCICEBIAsgACABQT9xQfQHahEBACAIQQtqIgEsAABBAEgEfyAIKAIAIQEgCkEAOgAAIAEgChCLBSAIQQA2AgQgCAUgCkEAOgAAIAggChCLBSABQQA6AAAgCAshASAIQQAQ0w0gASALKQIANwIAIAEgCygCCDYCCEEAIQEDQCABQQNHBEAgAUECdCALakEANgIAIAFBAWohAQwBCwsgCxDODSAA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CDYCCEEAIQADQCAAQQNHBEAgAEECdCALakEANgIAIABBAWohAAwBCwsgCxDODQUgAigCACgCKCEAIAogAiAAQT9xQfQHahEBACADIAooAgA2AAAgAigCACgCHCEAIAsgAiAAQT9xQfQHahEBACAIQQtqIgAsAABBAEgEQCAIKAIAIQAgCkEANgIAIAAgChDeCiAIQQA2AgQFIApBADYCACAIIAoQ3gogAEEAOgAACyAIQQAQ4A0gCCALKQIANwIAIAggCygCCDYCCEEAIQADQCAAQQNHBEAgAEECdCALakEANgIAIABBAWohAAwBCwsgCxDODQsgAigCACgCDCEAIAQgAiAAQf8BcUGgAWoRAwA2AgAgAigCACgCECEAIAUgAiAAQf8BcUGgAWoRAwA2AgAgAigCACgCFCEAIAsgAiAAQT9xQfQHahEBACAGQQtqIgAsAABBAEgEfyAGKAIAIQAgCkEAOgAAIAAgChCLBSAGQQA2AgQgBgUgCkEAOgAAIAYgChCLBSAAQQA6AAAgBgshACAGQQAQ0w0gACALKQIANwIAIAAgCygCCDYCCEEAIQADQCAAQQNHBEAgAEECdCALakEANgIAIABBAWohAAwBCwsgCxDODSACKAIAKAIYIQAgCyACIABBP3FB9AdqEQEAIAdBC2oiACwAAEEASARAIAcoAgAhACAKQQA2AgAgACAKEN4KIAdBADYCBAUgCkEANgIAIAcgChDeCiAAQQA6AAALIAdBABDgDSAHIAspAgA3AgAgByALKAIINgIIQQAhAANAIABBA0cEQCAAQQJ0IAtqQQA2AgAgAEEBaiEADAELCyALEM4NIAIoAgAoAiQhACACIABB/wFxQaABahEDAAUgAkGshgMQ6wohAiABBEAgAigCACgCLCEAIAogAiAAQT9xQfQHahEBACADIAooAgA2AAAgAigCACgCICEAIAsgAiAAQT9xQfQHahEBACAIQQtqIgAsAABBAEgEQCAIKAIAIQAgCkEANgIAIAAgChDeCiAIQQA2AgQFIApBADYCACAIIAoQ3gogAEEAOgAACyAIQQAQ4A0gCCALKQIANwIAIAggCygCCDYCCEEAIQADQCAAQQNHBEAgAEECdCALakEANgIAIABBAWohAAwBCwsgCxDODQUgAigCACgCKCEAIAogAiAAQT9xQfQHahEBACADIAooAgA2AAAgAigCACgCHCEAIAsgAiAAQT9xQfQHahEBACAIQQtqIgAsAABBAEgEQCAIKAIAIQAgCkEANgIAIAAgChDeCiAIQQA2AgQFIApBADYCACAIIAoQ3gogAEEAOgAACyAIQQAQ4A0gCCALKQIANwIAIAggCygCCDYCCEEAIQADQCAAQQNHBEAgAEECdCALakEANgIAIABBAWohAAwBCwsgCxDODQsgAigCACgCDCEAIAQgAiAAQf8BcUGgAWoRAwA2AgAgAigCACgCECEAIAUgAiAAQf8BcUGgAWoRAwA2AgAgAigCACgCFCEAIAsgAiAAQT9xQfQHahEBACAGQQtqIgAsAABBAEgEfyAGKAIAIQAgCkEAOgAAIAAgChCLBSAGQQA2AgQgBgUgCkEAOgAAIAYgChCLBSAAQQA6AAAgBgshACAGQQAQ0w0gACALKQIANwIAIAAgCygCCDYCCEEAIQADQCAAQQNHBEAgAEECdCALakEANgIAIABBAWohAAwBCwsgCxDODSACKAIAKAIYIQAgCyACIABBP3FB9AdqEQEAIAdBC2oiACwAAEEASARAIAcoAgAhACAKQQA2AgAgACAKEN4KIAdBADYCBAUgCkEANgIAIAcgChDeCiAAQQA6AAALIAdBABDgDSAHIAspAgA3AgAgByALKAIINgIIQQAhAANAIABBA0cEQCAAQQJ0IAtqQQA2AgAgAEEBaiEADAELCyALEM4NIAIoAgAoAiQhACACIABB/wFxQaABahEDAAs2AgAgDCQHC7gJARF/IAIgADYCACANQQtqIRkgDUEEaiEYIAxBC2ohHCAMQQRqIR0gA0GABHFFIR4gDkEASiEfIAtBC2ohGiALQQRqIRtBACEXA0AgF0EERwRAAkACQAJAAkACQAJAIAggF2osAAAOBQABAwIEBQsgASACKAIANgIADAQLIAEgAigCADYCACAGKAIAKAIsIQ8gBkEgIA9BP3FBpANqER8AIRAgAiACKAIAIg9BBGo2AgAgDyAQNgIADAMLIBksAAAiD0EASCEQIBgoAgAgD0H/AXEgEBsEQCANKAIAIA0gEBsoAgAhECACIAIoAgAiD0EEajYCACAPIBA2AgALDAILIBwsAAAiD0EASCEQIB4gHSgCACAPQf8BcSAQGyITRXJFBEAgDCgCACAMIBAbIg8gE0EC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gICAeHI2AgAgACADIAZqIgA2AgQgC0EANgIAIABBAnQgAmogCxDeCiAKJAcLyQIBCH8gAUHv////A0sEQCAAEJAMCyAAQQhqIgdBA2oiCSwAACIGQQBIIgMEfyAAKAIEIQQgBygCAEH/////B3FBf2oFIAZB/wFxIQRBAQshAiAEIAEgBCABSxsiAUECSSEFQQEgAUEEakF8cUF/aiAFGyIIIAJHBEACQAJAAkAgBQRAIAAoAgAhAiADBH9BACEDIAAFIAAgAiAGQf8BcUEBahCZChogAhDHDQwDCyEBBSAIQQFqIgJB/////wNLBEAQIgsgAkECdBDFDSEBIAMEf0EBIQMgACgCAAUgASAAIAZB/wFxQQFqEJkKGiAAQQRqIQUMAgshAgsgASACIABBBGoiBSgCAEEBahCZChogAhDHDSADRQ0BIAhBAWohAgsgByACQYCAgIB4cjYCACAFIAQ2AgAgACABNgIADAELIAkgBDoAAAsLCw4AIAAgASABEPILEN0NC+gBAQR/Qe////8DIAFrIAJJBEAgABCQDAsgAEEIaiIJLAADQQBIBH8gACgCAAUgAAshByABQef///8BSQRAQQIgAUEBdCIKIAEgAmoiAiACIApJGyICQQRqQXxxIAJBAkkbIgJB/////wNLBEAQIgUgAiEICwVB7////wMhCAsgCEECdBDFDSECIAQEQCACIAcgBBCZChoLIAMgBWsgBGsiAwRAIARBAnQgAmogBkECdGogBEECdCAHaiAFQQJ0aiADEJkKGgsgAUEBRwRAIAcQxw0LIAAgAjYCACAJIAhBgICAgHhyNgIAC88BAQZ/IwchBSMHQRBqJAcgBSEGIABBCGoiBEEDaiIHLAAAIgNBAEgiCAR/IAAoAgQhAyAEKAIAQf////8HcUF/agUgA0H/AXEhA0EBCyIEIANrIAJJBEAgACAEIAIgA2ogBGsgAyADQQAgAiABEN8NBSACBEAgCAR/IAAoAgAFIAALIgQgA0ECdGogASACEJkKGiACIANqIQEgBywAAEEASARAIAAgATYCBAUgByABOgAACyAGQQA2AgAgAUECdCAEaiAGEN4KCwsgBSQHIAALzgEBBn8jByEDIwdBEGokByADQQRqIQQgAyIGIAE2AgAgAEEIaiIBQQNqIgUsAAAiAkEASCIHBH8gACgCBCECIAEoAgBB/////wdxQX9qBSACQf8BcSECQQELIQECQAJAIAEgAkYEQCAAIAFBASABIAFBAEEAEOINIAUsAABBAEgNAQUgBw0BCyAFIAJBAWo6AAAMAQsgACgCACEBIAAgAkEBajYCBCABIQALIAJBAnQgAGoiACAGEN4KIARBADYCACAAQQRqIAQQ3gogAyQHCwgAEOYNQQBKCwcAEANBAXELqAICB38BfiMHIQAjB0EwaiQHIABBIGohBiAAQRhqIQMgAEEQaiECIAAhBCAAQSRqIQUQ6A0iAARAIAAoAgAiAQRAIAFB0ABqIQAgASkDMCIHQoB+g0KA1qyZ9MiTpsMAUgRAIANB59ECNgIAQbXRAiADEOkNCyAHQoHWrJn0yJOmwwBRBEAgASgCLCEACyAFIAA2AgAgASgCACIBKAIEIQBB6MkBKAIAKAIQIQNB6MkBIAEgBSADQT9xQeYDahEEAARAIAUoAgAiASgCACgCCCECIAEgAkH/AXFBoAFqEQMAIQEgBEHn0QI2AgAgBCAANgIEIAQgATYCCEHf0AIgBBDpDQUgAkHn0QI2AgAgAiAANgIEQYzRAiACEOkNCwsLQdvRAiAGEOkNCzwBAn8jByEBIwdBEGokByABIQBB6IcDQQIQLARAQfLSAiAAEOkNBUHshwMoAgAQKiEAIAEkByAADwtBAAsxAQF/IwchAiMHQRBqJAcgAiABNgIAQcDWASgCACIBIAAgAhC2CRpBCiABEOoJGhAiCwwAIAAQpQEgABDHDQvWAQEDfyMHIQUjB0FAayQHIAUhAyAAIAFBABDvDQR/QQEFIAEEfyABQYDKAUHwyQFBABDzDSIBBH8gA0EEaiIEQgA3AgAgBEIANwIIIARCADcCECAEQgA3AhggBEIANwIgIARCADcCKCAEQQA2AjAgAyABNgIAIAMgADYCCCADQX82AgwgA0EBNgIwIAEoAgAoAhwhACABIAMgAigCAEEBIABBD3FB9ghqESUAIAMoAhhBAUYEfyACIAMoAhA2AgBBAQVBAAsFQQALBUEACwshACAFJAcgAAseACAAIAEoAgggBRDvDQRAQQAgASACIAMgBBDyDQsLnwEAIAAgASgCCCAEEO8NBEBBACABIAIgAxDxDQUgACABKAIAIAQQ7w0EQAJAIAEoAhAgAkcEQCABQRRqIgAoAgAgAkcEQCABIAM2AiAgACACNgIAIAFBKGoiACAAKAIAQQFqNgIAIAEoAiRBAUYEQCABKAIYQQJGBEAgAUEBOgA2CwsgAUEENgIsDAILCyADQQFGBEAgAUEBNgIgCwsLCwscACAAIAEoAghBABDvDQRAQQAgASACIAMQ8A0LCwcAIAAgAUYLbQEBfyABQRBqIgAoAgAiBARAAkAgAiAERwRAIAFBJGoiACAAKAIAQQFqNgIAIAFBAjYCGCABQQE6ADYMAQsgAUEYaiIAKAIAQQJGBEAgACADNgIACwsFIAAgAjYCACABIAM2AhggAUEBNgIkCwsmAQF/IAIgASgCBEYEQCABQRxqIgQoAgBBAUcEQCAEIAM2AgALCwu2AQAgAUEBOgA1IAMgASgCBEYEQAJAIAFBAToANCABQRBqIgAoAgAiA0UEQCAAIAI2AgAgASAENgIYIAFBATYCJCABKAIwQQFGIARBAUZxRQ0BIAFBAToANgwBCyACIANHBEAgAUEkaiIAIAAoAgBBAWo2AgAgAUEBOgA2DAELIAFBGGoiAigCACIAQQJGBEAgAiAENgIABSAAIQQLIAEoAjBBAUYgBEEBRnEEQCABQQE6ADYLCwsL+QIBCH8jByEIIwdBQGskByAAIAAoAgAiBEF4aigCAGohByAEQXxqKAIAIQYgCCIEIAI2AgAgBCAANgIEIAQgATYCCCAEIAM2AgwgBEEUaiEBIARBGGohCSAEQRxqIQogBEEgaiELIARBKGohAyAEQRBqIgVCADcCACAFQgA3AgggBUIANwIQIAVCADcCGCAFQQA2AiAgBUEAOwEkIAVBADoAJiAGIAJBABDvDQR/IARBATYCMCAGKAIAKAIUIQAgBiAEIAcgB0EBQQAgAEEHcUGKCWoRJgAgB0EAIAkoAgBBAUYbBQJ/IAYoAgAoAhghACAGIAQgB0EBQQAgAEEDcUGGCWoRJwACQAJAAkAgBCgCJA4CAAIBCyABKAIAQQAgAygCAEEBRiAKKAIAQQFGcSALKAIAQQFGcRsMAgtBAAwBCyAJKAIAQQFHBEBBACADKAIARSAKKAIAQQFGcSALKAIAQQFGcUUNARoLIAUoAgALCyEAIAgkByAAC0gBAX8gACABKAIIIAUQ7w0EQEEAIAEgAiADIAQQ8g0FIAAoAggiACgCACgCFCEGIAAgASACIAMgBCAFIAZBB3FBiglqESYACwvDAgEEfyAAIAEoAgggBBDvDQRAQQAgASACIAMQ8Q0FAkAgACABKAIAIAQQ7w1FBEAgACgCCCIAKAIAKAIYIQUgACABIAIgAyAEIAVBA3FBhglqEScADAELIAEoAhAgAkcEQCABQRRqIgUoAgAgAkcEQCABIAM2AiAgAUEsaiIDKAIAQQRGDQIgAUE0aiIGQQA6AAAgAUE1aiIHQQA6AAAgACgCCCIAKAIAKAIUIQggACABIAIgAkEBIAQgCEEHcUGKCWoRJgAgAwJ/AkAgBywAAAR/IAYsAAANAUEBBUEACyEAIAUgAjYCACABQShqIgIgAigCAEEBajYCACABKAIkQQFGBEAgASgCGEECRgRAIAFBAToANiAADQJBBAwDCwsgAA0AQQQMAQtBAws2AgAMAgsLIANBAUYEQCABQQE2AiALCwsLQgEBfyAAIAEoAghBABDvDQRAQQAgASACIAMQ8A0FIAAoAggiACgCACgCHCEEIAAgASACIAMgBEEPcUH2CGoRJQALCy0BAn8jByEAIwdBEGokByAAIQFB7IcDQf4BECsEQEGj0wIgARDpDQUgACQHCws0AQJ/IwchASMHQRBqJAcgASECIAAQgApB7IcDKAIAQQAQLQRAQdXTAiACEOkNBSABJAcLCxMAIABByPYBNgIAIABBBGoQ/A0LDAAgABD5DSAAEMcNCwoAIABBBGoQlgELOgECfyAAEIQBBEAgACgCABD9DSIBQQhqIgIoAgAhACACIABBf2o2AgAgAEF/akEASARAIAEQxw0LCwsHACAAQXRqCwwAIAAQpQEgABDHDQsGAEHT1AILCwAgACABQQAQ7w0L8gIBA38jByEEIwdBQGskByAEIQMgAiACKAIAKAIANgIAIAAgAUEAEIIOBH9BAQUgAQR/IAFBgMoBQejKAUEAEPMNIgEEfyABKAIIIAAoAghBf3NxBH9BAAUgAEEMaiIAKAIAIAFBDGoiASgCAEEAEO8NBH9BAQUgACgCAEGIywFBABDvDQR/QQEFIAAoAgAiAAR/IABBgMoBQfDJAUEAEPMNIgUEfyABKAIAIgAEfyAAQYDKAUHwyQFBABDzDSIBBH8gA0EEaiIAQgA3AgAgAEIANwIIIABCADcCECAAQgA3AhggAEIANwIgIABCADcCKCAAQQA2AjAgAyABNgIAIAMgBTYCCCADQX82AgwgA0EBNgIwIAEoAgAoAhwhACABIAMgAigCAEEBIABBD3FB9ghqESUAIAMoAhhBAUYEfyACIAMoAhA2AgBBAQVBAAsFQQALBUEACwVBAAsFQQALCwsLBUEACwVBAAsLIQAgBCQHIAALHAAgACABQQAQ7w0Ef0EBBSABQZDLAUEAEO8NCwuEAgEIfyAAIAEoAgggBRDvDQRAQQAgASACIAMgBBDyDQUgAUE0aiIGLAAAIQkgAUE1aiIHLAAAIQogAEEQaiAAKAIMIghBA3RqIQsgBkEAOgAAIAdBADoAACAAQRBqIAEgAiADIAQgBRCHDiAIQQFKBEACQCABQRhqIQwgAEEIaiEIIAFBNmohDSAAQRhqIQADQCANLAAADQEgBiwAAARAIAwoAgBBAUYNAiAIKAIAQQJxRQ0CBSAHLAAABEAgCCgCAEEBcUUNAwsLIAZBADoAACAHQQA6AAAgACABIAIgAyAEIAUQhw4gAEEIaiIAIAtJDQALCwsgBiAJOgAAIAcgCjoAAAsLkgUBCX8gACABKAIIIAQQ7w0EQEEAIAEgAiADEPENBQJAIAAgASgCACAEEO8NRQRAIABBEGogACgCDCIGQQN0aiEHIABBEGogASACIAMgBBCIDiAAQRhqIQUgBkEBTA0BIAAoAggiBkECcUUEQCABQSRqIgAoAgBBAUcEQCAGQQFxRQRAIAFBNmohBgNAIAYsAAANBSAAKAIAQQFGDQUgBSABIAIgAyAEEIgOIAVBCGoiBSAHSQ0ACwwECyABQRhqIQYgAUE2aiEIA0AgCCwAAA0EIAAoAgBBAUYEQCAGKAIAQQFGDQULIAUgASACIAMgBBCIDiAFQQhqIgUgB0kNAAsMAwsLIAFBNmohAANAIAAsAAANAiAFIAEgAiADIAQQiA4gBUEIaiIFIAdJDQALDAELIAEoAhAgAkcEQCABQRRqIgsoAgAgAkcEQCABIAM2AiAgAUEsaiIMKAIAQQRGDQIgAEEQaiAAKAIMQQN0aiENIAFBNGohByABQTVqIQYgAUE2aiEIIABBCGohCSABQRhqIQpBACEDIABBEGohBUEAIQAgDAJ/AkADQAJAIAUgDU8NACAHQQA6AAAgBkEAOgAAIAUgASACIAJBASAEEIcOIAgsAAANACAGLAAABEACfyAHLAAARQRAIAkoAgBBAXEEQEEBDAIFQQEhAwwECwALIAooAgBBAUYNBCAJKAIAQQJxRQ0EQQEhAEEBCyEDCyAFQQhqIQUMAQsLIABFBEAgCyACNgIAIAFBKGoiACAAKAIAQQFqNgIAIAEoAiRBAUYEQCAKKAIAQQJGBEAgCEEBOgAAIAMNA0EEDAQLCwsgAw0AQQQMAQtBAws2AgAMAgsLIANBAUYEQCABQQE2AiALCwsLeQECfyAAIAEoAghBABDvDQRAQQAgASACIAMQ8A0FAkAgAEEQaiAAKAIMIgRBA3RqIQUgAEEQaiABIAIgAxCGDiAEQQFKBEAgAUE2aiEEIABBGGohAANAIAAgASACIAMQhg4gBCwAAA0CIABBCGoiACAFSQ0ACwsLCwtTAQN/IAAoAgQiBUEIdSEEIAVBAXEEQCAEIAIoAgBqKAIAIQQLIAAoAgAiACgCACgCHCEGIAAgASACIARqIANBAiAFQQJxGyAGQQ9xQfYIahElAAtXAQN/IAAoAgQiB0EIdSEGIAdBAXEEQCADKAIAIAZqKAIAIQYLIAAoAgAiACgCACgCFCEIIAAgASACIAMgBmogBEECIAdBAnEbIAUgCEEHcUGKCWoRJgALVQEDfyAAKAIEIgZBCHUhBSAGQQFxBEAgAigCACAFaigCACEFCyAAKAIAIgAoAgAoAhghByAAIAEgAiAFaiADQQIgBkECcRsgBCAHQQNxQYYJahEnAAsLACAAQfD2ATYCAAsZACAALAAAQQFGBH9BAAUgAEEBOgAAQQELCxYBAX9B8IcDQfCHAygCACIANgIAIAALUwEDfyMHIQMjB0EQaiQHIAMiBCACKAIANgIAIAAoAgAoAhAhBSAAIAEgAyAFQT9xQeYDahEEACIBQQFxIQAgAQRAIAIgBCgCADYCAAsgAyQHIAALHAAgAAR/IABBgMoBQejKAUEAEPMNQQBHBUEACwsrACAAQf8BcUEYdCAAQQh1Qf8BcUEQdHIgAEEQdUH/AXFBCHRyIABBGHZyCykAIABEAAAAAAAA4D+gnCAARAAAAAAAAOA/oZsgAEQAAAAAAAAAAGYbC8YDAQN/IAJBgMAATgRAIAAgASACECQaIAAPCyAAIQQgACACaiEDIABBA3EgAUEDcUYEQANAIABBA3EEQCACRQRAIAQPCyAAIAEsAAA6AAAgAEEBaiEAIAFBAWohASACQQFrIQIMAQsLIANBfHEiAkFAaiEFA0AgACAFTARAIAAgASgCADYCACAAIAEoAgQ2AgQgACABKAIINgIIIAAgASgCDDYCDCAAIAEoAhA2AhAgACABKAIUNgIUIAAgASgCGDYCGCAAIAEoAhw2AhwgACABKAIgNgIgIAAgASgCJDYCJCAAIAEoAig2AiggACABKAIsNgIsIAAgASgCMDYCMCAAIAEoAjQ2AjQgACABKAI4NgI4IAAgASgCPDYCPCAAQUBrIQAgAUFAayEBDAELCwNAIAAgAkgEQCAAIAEoAgA2AgAgAEEEaiEAIAFBBGohAQwBCwsFIANBBGshAgNAIAAgAkgEQCAAIAEsAAA6AAAgACABLAABOgABIAAgASwAAjoAAiAAIAEsAAM6AAMgAEEEaiEAIAFBBGohAQwBCwsLA0AgACADSARAIAAgASwAADoAACAAQQFqIQAgAUEBaiEBDAELCyAEC2ABAX8gASAASCAAIAEgAmpIcQRAIAAhAyABIAJqIQEgACACaiEAA0AgAkEASgRAIAJBAWshAiAAQQFrIgAgAUEBayIBLAAAOgAADAELCyADIQAFIAAgASACEJAOGgsgAAuYAgEEfyAAIAJqIQQgAUH/AXEhASACQcMATgRAA0AgAEEDcQRAIAAgAToAACAAQQFqIQAMAQsLIAFBCHQgAXIgAUEQdHIgAUEYdHIhAyAEQXxxIgVBQGohBgNAIAAgBkwEQCAAIAM2AgAgACADNgIEIAAgAzYCCCAAIAM2AgwgACADNgIQIAAgAzYCFCAAIAM2AhggACADNgIcIAAgAzYCICAAIAM2AiQgACADNgIoIAAgAzYCLCAAIAM2AjAgACADNgI0IAAgAzYCOCAAIAM2AjwgAEFAayEADAELCwNAIAAgBUgEQCAAIAM2AgAgAEEEaiEADAELCwsDQCAAIARIBEAgACABOgAAIABBAWohAAwBCwsgBCACawtKAQJ/IAAjBCgCACICaiIBIAJIIABBAEpxIAFBAEhyBEBBDBAGQX8PCyABECNMBEAjBCABNgIABSABECVFBEBBDBAGQX8PCwsgAgsQACABIAIgAyAAQQFxERYACxcAIAEgAiADIAQgBSAAQQNxQQJqERUACw8AIAEgAEEPcUEGahEJAAsRACABIAIgAEEPcUEWahEGAAsTACABIAIgAyAAQQdxQSZqEQgACxUAIAEgAiADIAQgAEEHcUEuahEHAAsZACABIAIgAyAEIAUgBiAAQQNxQTZqERgACx0AIAEgAiADIAQgBSAGIAcgCCAAQQFxQTpqERoACxkAIAEgAiADIAQgBSAGIABBAXFBPGoRGQALGQAgASACIAMgBCAFIAYgAEEBcUE+ahEXAAsTACABIAIgAyAAQQFxQUBrERsACxYAIAEgAiADIAQgAEEBcUHCAGoRDgALGgAgASACIAMgBCAFIAYgAEEDcUHEAGoRHQALGAAgASACIAMgBCAFIABBAXFByABqEQ8ACxIAIAEgAiAAQQdxQcoAahEcAAsUACABIAIgAyAAQQdxQdIAahEoAAsWACABIAIgAyAEIABBB3FB2gBqESkACxgAIAEgAiADIAQgBSAAQQNxQeIAahEqAAscACABIAIgAyAEIAUgBiAHIABBA3FB5gBqESsACyAAIAEgAiADIAQgBSAGIAcgCCAJIABBAXFB6gBqESwACxwAIAEgAiADIAQgBSAGIAcgAEEBcUHsAGoRLQALHAAgASACIAMgBCAFIAYgByAAQQFxQe4AahEuAAsWACABIAIgAyAEIABBAXFB8ABqES8ACxgAIAEgAiADIAQgBSAAQQFxQfIAahEwAAscACABIAIgAyAEIAUgBiAHIABBA3FB9ABqETEACxoAIAEgAiADIAQgBSAGIABBAXFB+ABqETIACxQAIAEgAiADIABBA3FB+gBqEQwACxYAIAEgAiADIAQgAEEBcUH+AGoRMwALDgAgAEEfcUGAAWoRAAALEQAgASAAQf8BcUGgAWoRAwALEgAgASACIABBA3FBoANqER4ACxIAIAEgAiAAQT9xQaQDahEfAAsUACABIAIgAyAAQQFxQeQDahE0AAsUACABIAIgAyAAQT9xQeYDahEEAAsWACABIAIgAyAEIABBAXFBpgRqETUACxYAIAEgAiADIAQgAEEBcUGoBGoRNgALFgAgASACIAMgBCAAQQ9xQaoEahELAAsYACABIAIgAyAEIAUgAEEHcUG6BGoRNwALGAAgASACIAMgBCAFIABBH3FBwgRqESAACxoAIAEgAiADIAQgBSAGIABBA3FB4gRqETgACxoAIAEgAiADIAQgBSAGIABBP3FB5gRqESMACxwAIAEgAiADIAQgBSAGIAcgAEEHcUGmBWoROQALHgAgASACIAMgBCAFIAYgByAIIABBD3FBrgVqESEACxgAIAEgAiADIAQgBSAAQQdxQb4FahE6AAsOACAAQQNxQcYFahEkAAsRACABIABB/wFxQcoFahEFAAsSACABIAIgAEEfcUHKB2oRCgALFAAgASACIAMgAEEBcUHqB2oREwALFgAgASACIAMgBCAAQQFxQewHahEQAAsYACABIAIgAyAEIAUgAEEBcUHuB2oREQALGgAgASACIAMgBCAFIAYgAEEBcUHwB2oREgALGAAgASACIAMgBCAFIABBAXFB8gdqERQACxIAIAEgAiAAQT9xQfQHahEBAAsUACABIAIgAyAAQQ9xQbQIahENAAsWACABIAIgAyAEIABBAXFBxAhqETsACxgAIAEgAiADIAQgBSAAQQFxQcYIahE8AAsaACABIAIgAyAEIAUgBiAAQQFxQcgIahE9AAscACABIAIgAyAEIAUgBiAHIABBAXFByghqET4ACxQAIAEgAiADIABBAXFBzAhqET8ACxoAIAEgAiADIAQgBSAGIABBAXFBzghqEUAACxQAIAEgAiADIABBH3FB0AhqEQIACxYAIAEgAiADIAQgAEEDcUHwCGoRQQALFgAgASACIAMgBCAAQQFxQfQIahFCAAsWACABIAIgAyAEIABBD3FB9ghqESUACxgAIAEgAiADIAQgBSAAQQNxQYYJahEnAAsaACABIAIgAyAEIAUgBiAAQQdxQYoJahEmAAsYACABIAIgAyAEIAUgAEEDcUGSCWoRIgALDwBBABAARAAAAAAAAAAACw8AQQEQAEQAAAAAAAAAAAsPAEECEABEAAAAAAAAAAALDwBBAxAARAAAAAAAAAAACw8AQQQQAEQAAAAAAAAAAAsPAEEFEABEAAAAAAAAAAALDwBBBhAARAAAAAAAAAAACw8AQQcQAEQAAAAAAAAAAAsPAEEIEABEAAAAAAAAAAALDwBBCRAARAAAAAAAAAAACw8AQQoQAEQAAAAAAAAAAAsPAEELEABEAAAAAAAAAAALDwBBDBAARAAAAAAAAAAACw8AQQ0QAEQAAAAAAAAAAAsPAEEOEABEAAAAAAAAAAALDwBBDxAARAAAAAAAAAAACw8AQRAQAEQAAAAAAAAAAAsPAEEREABEAAAAAAAAAAALDwBBEhAARAAAAAAAAAAA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egAAAHsAAAB8AAAAfQAAAH4AAAB/AEHQhQEL/wECAAIAAgACAAIAAgACAAIAAgADIAIgAiACIAIgAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAWAEwATABMAEwATABMAEwATABMAEwATABMAEwATABMAI2AjYCNgI2AjYCNgI2AjYCNgI2ATABMAEwATABMAEwATACNUI1QjVCNUI1QjVCMUIxQjFCMUIxQjFCMUIxQjFCMUIxQjFCMUIxQjFCMUIxQjFCMUIxQTABMAEwATABMAEwAjWCNYI1gjWCNYI1gjGCMYIxgjGCMYIxgjGCMYIxgjGCMYIxgjGCMYIxgjGCMYIxgjGCMYEwATABMAEwAIAQdSNAQv5AwEAAAACAAAAAwAAAAQAAAAFAAAABgAAAAcAAAAIAAAACQAAAAoAAAALAAAADAAAAA0AAAAOAAAADwAAABAAAAARAAAAEgAAABMAAAAUAAAAFQAAABYAAAAXAAAAGAAAABkAAAAaAAAAGwAAABwAAAAdAAAAHgAAAB8AAAAgAAAAIQAAACIAAAAjAAAAJAAAACUAAAAmAAAAJwAAACgAAAApAAAAKgAAACsAAAAsAAAALQAAAC4AAAAvAAAAMAAAADEAAAAyAAAAMwAAADQAAAA1AAAANgAAADcAAAA4AAAAOQAAADoAAAA7AAAAPAAAAD0AAAA+AAAAPwAAAEAAAABBAAAAQgAAAEMAAABEAAAARQAAAEYAAABHAAAASAAAAEkAAABKAAAASwAAAEwAAABNAAAATgAAAE8AAABQAAAAUQAAAFIAAABTAAAAVAAAAFUAAABWAAAAVwAAAFgAAABZAAAAWgAAAFsAAABcAAAAXQAAAF4AAABfAAAAYAAAAEEAAABCAAAAQwAAAEQAAABFAAAARgAAAEcAAABIAAAASQAAAEoAAABLAAAATAAAAE0AAABOAAAATwAAAFAAAABRAAAAUgAAAFMAAABUAAAAVQAAAFYAAABXAAAAWAAAAFkAAABaAAAAewAAAHwAAAB9AAAAfgAAAH8AQdCVAQuhAgoAAABkAAAA6AMAABAnAACghgEAQEIPAICWmAAA4fUF/////////////////////////////////////////////////////////////////wABAgMEBQYHCAn/////////CgsMDQ4PEBESExQVFhcYGRobHB0eHyAhIiP///////8KCwwNDg8QERITFBUWFxgZGhscHR4fICEiI/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////8AQYCYAQsYEQAKABEREQAAAAAFAAAAAAAACQAAAAALAEGgmAELIREADwoREREDCgcAARMJCwsAAAkGCwAACwAGEQAAABEREQBB0ZgBCwELAEHamAELGBEACgoREREACgAAAgAJCwAAAAkACwAACwBBi5kBCwEMAEGXmQELFQwAAAAADAAAAAAJDAAAAAAADAAADABBxZkBCwEOAEHRmQELFQ0AAAAEDQAAAAAJDgAAAAAADgAADgBB/5kBCwEQAEGLmgELHg8AAAAADwAAAAAJEAAAAAAAEAAAEAAAEgAAABISEgBBwpoBCw4SAAAAEhISAAAAAAAACQBB85oBCwELAEH/mgELFQoAAAAACgAAAAAJCwAAAAAACwAACwBBrZsBCwEMAEG5mwELfgwAAAAADAAAAAAJDAAAAAAADAAADAAAMDEyMzQ1Njc4OUFCQ0RFRlQhIhkNAQIDEUscDBAECx0SHidobm9wcWIgBQYPExQVGggWBygkFxgJCg4bHyUjg4J9JiorPD0+P0NHSk1YWVpbXF1eX2BhY2RlZmdpamtscnN0eXp7fABBwJwBC9cOSWxsZWdhbCBieXRlIHNlcXVlbmNlAERvbWFpbiBlcnJvcgBSZXN1bHQgbm90IHJlcHJlc2VudGFibGUATm90IGEgdHR5AFBlcm1pc3Npb24gZGVuaWVkAE9wZXJhdGlvbiBub3QgcGVybWl0dGVkAE5vIHN1Y2ggZmlsZSBvciBkaXJlY3RvcnkATm8gc3VjaCBwcm9jZXNzAEZpbGUgZXhpc3RzAFZhbHVlIHRvbyBsYXJnZSBmb3IgZGF0YSB0eXBlAE5vIHNwYWNlIGxlZnQgb24gZGV2aWNlAE91dCBvZiBtZW1vcnkAUmVzb3VyY2UgYnVzeQBJbnRlcnJ1cHRlZCBzeXN0ZW0gY2FsbABSZXNvdXJjZSB0ZW1wb3JhcmlseSB1bmF2YWlsYWJsZQBJbnZhbGlkIHNlZWsAQ3Jvc3MtZGV2aWNlIGxpbmsAUmVhZC1vbmx5IGZpbGUgc3lzdGVtAERpcmVjdG9yeSBub3QgZW1wdHkAQ29ubmVjdGlvbiByZXNldCBieSBwZWVyAE9wZXJhdGlvbiB0aW1lZCBvdXQAQ29ubmVjdGlvbiByZWZ1c2VkAEhvc3QgaXMgZG93bgBIb3N0IGlzIHVucmVhY2hhYmxlAEFkZHJlc3MgaW4gdXNlAEJyb2tlbiBwaXBlAEkvTyBlcnJvcgBObyBzdWNoIGRldmljZSBvciBhZGRyZXNzAEJsb2NrIGRldmljZSByZXF1aXJlZABObyBzdWNoIGRldmljZQBOb3QgYSBkaXJlY3RvcnkASXMgYSBkaXJlY3RvcnkAVGV4dCBmaWxlIGJ1c3kARXhlYyBmb3JtYXQgZXJyb3IASW52YWxpZCBhcmd1bWVudABBcmd1bWVudCBsaXN0IHRvbyBsb25nAFN5bWJvbGljIGxpbmsgbG9vcABGaWxlbmFtZSB0b28gbG9uZwBUb28gbWFueSBvcGVuIGZpbGVzIGluIHN5c3RlbQBObyBmaWxlIGRlc2NyaXB0b3JzIGF2YWlsYWJsZQBCYWQgZmlsZSBkZXNjcmlwdG9yAE5vIGNoaWxkIHByb2Nlc3MAQmFkIGFkZHJlc3MARmlsZSB0b28gbGFyZ2UAVG9vIG1hbnkgbGlua3MATm8gbG9ja3MgYXZhaWxhYmxlAFJlc291cmNlIGRlYWRsb2NrIHdvdWxkIG9jY3VyAFN0YXRlIG5vdCByZWNvdmVyYWJsZQBQcmV2aW91cyBvd25lciBkaWVkAE9wZXJhdGlvbiBjYW5jZWxlZABGdW5jdGlvbiBub3QgaW1wbGVtZW50ZWQATm8gbWVzc2FnZSBvZiBkZXNpcmVkIHR5cGUASWRlbnRpZmllciByZW1vdmVkAERldmljZSBub3QgYSBzdHJlYW0ATm8gZGF0YSBhdmFpbGFibGUARGV2aWNlIHRpbWVvdXQAT3V0IG9mIHN0cmVhbXMgcmVzb3VyY2VzAExpbmsgaGFzIGJlZW4gc2V2ZXJlZABQcm90b2NvbCBlcnJvcgBCYWQgbWVzc2FnZQBGaWxlIGRlc2NyaXB0b3IgaW4gYmFkIHN0YXRlAE5vdCBhIHNvY2tldABEZXN0aW5hdGlvbiBhZGRyZXNzIHJlcXVpcmVkAE1lc3NhZ2UgdG9vIGxhcmdlAFByb3RvY29sIHdyb25nIHR5cGUgZm9yIHNvY2tldABQcm90b2NvbCBub3QgYXZhaWxhYmxlAFByb3RvY29sIG5vdCBzdXBwb3J0ZWQAU29ja2V0IHR5cGUgbm90IHN1cHBvcnRlZABOb3Qgc3VwcG9ydGVkAFByb3RvY29sIGZhbWlseSBub3Qgc3VwcG9ydGVkAEFkZHJlc3MgZmFtaWx5IG5vdCBzdXBwb3J0ZWQgYnkgcHJvdG9jb2wAQWRkcmVzcyBub3QgYXZhaWxhYmxlAE5ldHdvcmsgaXMgZG93bgBOZXR3b3JrIHVucmVhY2hhYmxlAENvbm5lY3Rpb24gcmVzZXQgYnkgbmV0d29yawBDb25uZWN0aW9uIGFib3J0ZWQATm8gYnVmZmVyIHNwYWNlIGF2YWlsYWJsZQBTb2NrZXQgaXMgY29ubmVjdGVkAFNvY2tldCBub3QgY29ubmVjdGVkAENhbm5vdCBzZW5kIGFmdGVyIHNvY2tldCBzaHV0ZG93bgBPcGVyYXRpb24gYWxyZWFkeSBpbiBwcm9ncmVzcwBPcGVyYXRpb24gaW4gcHJvZ3Jlc3MAU3RhbGUgZmlsZSBoYW5kbGUAUmVtb3RlIEkvTyBlcnJvcgBRdW90YSBleGNlZWRlZABObyBtZWRpdW0gZm91bmQAV3JvbmcgbWVkaXVtIHR5cGUATm8gZXJyb3IgaW5mb3JtYXRpb24AAAAAAABMQ19DVFlQRQAAAABMQ19OVU1FUklDAABMQ19USU1FAAAAAABMQ19DT0xMQVRFAABMQ19NT05FVEFSWQBMQ19NRVNTQUdFUwBBoKsBC5cCAwAAAAQAAAAEAAAABgAAAIP5ogBETm4A/CkVANFXJwDdNPUAYtvAADyZlQBBkEMAY1H+ALveqwC3YcUAOm4kANJNQgBJBuAACeouAByS0QDrHf4AKbEcAOg+pwD1NYIARLsuAJzphAC0JnAAQX5fANaROQBTgzkAnPQ5AItfhAAo+b0A+B87AN7/lwAPmAUAES/vAApaiwBtH20Az342AAnLJwBGT7cAnmY/AC3qXwC6J3UA5evHAD17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AAAAAwAAAAgAAABWZWN0b3JJbnQAVmVjdG9yRG91YmxlAFZlY3RvckNoYXIAVmVjdG9yRmxvYXQAdmVjdG9yVG9vbHMAY2xlYXJWZWN0b3JEYmwAY2xlYXJWZWN0b3JGbG9hdABtYXhpU2V0dGluZ3MAc2V0dXAAc2FtcGxlUmF0ZQBjaGFubmVscwBidWZmZXJTaXplAG1heGlPc2MAc2luZXdhdmUAY29zd2F2ZQBwaGFzb3IAc2F3AHRyaWFuZ2xlAHNxdWFyZQBwdWxzZQBub2lzZQBzaW5lYnVmAHNpbmVidWY0AHNhd24AcmVjdABwaGFzZVJlc2V0AG1heGlFbnZlbG9wZQBzaGFyZWRfcHRyPG1heGlFbnZlbG9wZT4AbGluZQB0cmlnZ2VyAGFtcGxpdHVkZQB2YWxpbmRleABtYXhpRGVsYXlsaW5lAHNoYXJlZF9wdHI8bWF4aURlbGF5bGluZT4AZGwAbWF4aUZpbHRlcgBsb3JlcwBoaXJlcwBiYW5kcGFzcwBsb3Bhc3MAaGlwYXNzAGN1dG9mZgByZXNvbmFuY2UAbWF4aU1peABzaGFyZWRfcHRyPG1heGlNaXg+AHN0ZXJlbwBxdWFkAGFtYmlzb25pYwBtYXhpTGFnRXhwAHNoYXJlZF9wdHI8bWF4aUxhZ0V4cDxkb3VibGU+PgBpbml0AGFkZFNhbXBsZQB2YWx1ZQBhbHBoYQBhbHBoYVJlY2lwcm9jYWwAdmFsAG1heGlTYW1wbGUAc2hhcmVkX3B0cjxtYXhpU2FtcGxlPgBnZXRMZW5ndGgAc2V0U2FtcGxlAGlzUmVhZHkAcGxheU9uY2UAcGxheQBwbGF5NABjbGVhcgBub3JtYWxpc2UAYXV0b1RyaW0AbG9hZAByZWFkAG1heGlNYXAAc2hhcmVkX3B0cjxtYXhpTWFwPgBsaW5saW4AbGluZXhwAGV4cGxpbgBjbGFtcABtYXhpRHluAHNoYXJlZF9wdHI8bWF4aUR5bj4AZ2F0ZQBjb21wcmVzc29yAGNvbXByZXNzAHNldEF0dGFjawBzZXRSZWxlYXNlAHNldFRocmVzaG9sZABzZXRSYXRpbwBtYXhpRW52AGFyAGFkc3IAc2V0RGVjYXkAc2V0U3VzdGFpbgBjb252ZXJ0AHNoYXJlZF9wdHI8Y29udmVydD4AbXRvZgBtYXhpRGlzdG9ydGlvbgBzaGFyZWRfcHRyPG1heGlEaXN0b3J0aW9uPgBmYXN0QXRhbgBhdGFuRGlzdABmYXN0QXRhbkRpc3QAbWF4aUZsYW5nZXIAc2hhcmVkX3B0cjxtYXhpRmxhbmdlcj4AZmxhbmdlAG1heGlDaG9ydXMAc2hhcmVkX3B0cjxtYXhpQ2hvcnVzPgBjaG9ydXMAbWF4aURDQmxvY2tlcgBzaGFyZWRfcHRyPG1heGlEQ0Jsb2NrZXI+AG1heGlTVkYAc2hhcmVkX3B0cjxtYXhpU1ZGPgBzZXRDdXRvZmYAc2V0UmVzb25hbmNlAHB1c2hfYmFjawByZXNpemUAc2l6ZQBnZXQAc2V0AE5TdDNfXzI2dmVjdG9ySWlOU185YWxsb2NhdG9ySWlFRUVFAE5TdDNfXzIxM19fdmVjdG9yX2Jhc2VJaU5TXzlhbGxvY2F0b3JJaUVFRUUATlN0M19fMjIwX192ZWN0b3JfYmFzZV9jb21tb25JTGIxRUVFAFBOU3QzX18yNnZlY3RvcklpTlNfOWFsbG9jYXRvcklpRUVFRQBQS05TdDNfXzI2dmVjdG9ySWlOU185YWxsb2NhdG9ySWlFRUVFAGlpAHYAdmkAdmlpaQB2aWlpaQBpaWkATjEwZW1zY3JpcHRlbjN2YWxFAGlpaWkAaWlpaWkATlN0M19fMjZ2ZWN0b3JJZE5TXzlhbGxvY2F0b3JJZEVFRUUATlN0M19fMjEzX192ZWN0b3JfYmFzZUlkTlNfOWFsbG9jYXRvcklkRUVFRQBQTlN0M19fMjZ2ZWN0b3JJZE5TXzlhbGxvY2F0b3JJZEVFRUUAUEtOU3QzX18yNnZlY3RvcklkTlNfOWFsbG9jYXRvcklkRUVFRQB2aWlkAHZpaWlkAGlpaWlkAE5TdDNfXzI2dmVjdG9ySWNOU185YWxsb2NhdG9ySWNFRUVFAE5TdDNfXzIxM19fdmVjdG9yX2Jhc2VJY05TXzlhbGxvY2F0b3JJY0VFRUUAUE5TdDNfXzI2dmVjdG9ySWNOU185YWxsb2NhdG9ySWNFRUVFAFBLTlN0M19fMjZ2ZWN0b3JJY05TXzlhbGxvY2F0b3JJY0VFRUUATlN0M19fMjZ2ZWN0b3JJZk5TXzlhbGxvY2F0b3JJZkVFRUUATlN0M19fMjEzX192ZWN0b3JfYmFzZUlmTlNfOWFsbG9jYXRvcklmRUVFRQBQTlN0M19fMjZ2ZWN0b3JJZk5TXzlhbGxvY2F0b3JJZkVFRUUAUEtOU3QzX18yNnZlY3RvcklmTlNfOWFsbG9jYXRvcklmRUVFRQB2aWlmAHZpaWlmAGlpaWlmADExdmVjdG9yVG9vbHMAUDExdmVjdG9yVG9vbHMAUEsxMXZlY3RvclRvb2xzAHZpaQAxMm1heGlTZXR0aW5ncwBQMTJtYXhpU2V0dGluZ3MAUEsxMm1heGlTZXR0aW5ncwA3bWF4aU9zYwBQN21heGlPc2MAUEs3bWF4aU9zYwBkaWlkAGRpaWRkZABkaWlkZABkaWkAMTJtYXhpRW52ZWxvcGUAUDEybWF4aUVudmVsb3BlAFBLMTJtYXhpRW52ZWxvcGUATlN0M19fMjIwX19zaGFyZWRfcHRyX3BvaW50ZXJJUDEybWF4aUVudmVsb3BlTjEwZW1zY3JpcHRlbjE1c21hcnRfcHRyX3RyYWl0SU5TXzEwc2hhcmVkX3B0cklTMV9FRUUxMXZhbF9kZWxldGVyRU5TXzlhbGxvY2F0b3JJUzFfRUVFRQBOMTBlbXNjcmlwdGVuMTVzbWFydF9wdHJfdHJhaXRJTlN0M19fMjEwc2hhcmVkX3B0ckkxMm1heGlFbnZlbG9wZUVFRTExdmFsX2RlbGV0ZXJFAE5TdDNfXzIxMHNoYXJlZF9wdHJJMTJtYXhpRW52ZWxvcGVFRQBpAE5TdDNfXzIyMF9fc2hhcmVkX3B0cl9lbXBsYWNlSTEybWF4aUVudmVsb3BlTlNfOWFsbG9jYXRvcklTMV9FRUVFAGRpaWlpADEzbWF4aURlbGF5bGluZQBQMTNtYXhpRGVsYXlsaW5lAFBLMTNtYXhpRGVsYXlsaW5lAE5TdDNfXzIyMF9fc2hhcmVkX3B0cl9wb2ludGVySVAxM21heGlEZWxheWxpbmVOMTBlbXNjcmlwdGVuMTVzbWFydF9wdHJfdHJhaXRJTlNfMTBzaGFyZWRfcHRySVMxX0VFRTExdmFsX2RlbGV0ZXJFTlNfOWFsbG9jYXRvcklTMV9FRUVFAE4xMGVtc2NyaXB0ZW4xNXNtYXJ0X3B0cl90cmFpdElOU3QzX18yMTBzaGFyZWRfcHRySTEzbWF4aURlbGF5bGluZUVFRTExdmFsX2RlbGV0ZXJFAE5TdDNfXzIxMHNoYXJlZF9wdHJJMTNtYXhpRGVsYXlsaW5lRUUATlN0M19fMjIwX19zaGFyZWRfcHRyX2VtcGxhY2VJMTNtYXhpRGVsYXlsaW5lTlNfOWFsbG9jYXRvcklTMV9FRUVFAGRpaWRpZABkaWlkaWRpADEwbWF4aUZpbHRlcgBQMTBtYXhpRmlsdGVyAFBLMTBtYXhpRmlsdGVyADdtYXhpTWl4AFA3bWF4aU1peABQSzdtYXhpTWl4AE5TdDNfXzIyMF9fc2hhcmVkX3B0cl9wb2ludGVySVA3bWF4aU1peE4xMGVtc2NyaXB0ZW4xNXNtYXJ0X3B0cl90cmFpdElOU18xMHNoYXJlZF9wdHJJUzFfRUVFMTF2YWxfZGVsZXRlckVOU185YWxsb2NhdG9ySVMxX0VFRUUATjEwZW1zY3JpcHRlbjE1c21hcnRfcHRyX3RyYWl0SU5TdDNfXzIxMHNoYXJlZF9wdHJJN21heGlNaXhFRUUxMXZhbF9kZWxldGVyRQBOU3QzX18yMTBzaGFyZWRfcHRySTdtYXhpTWl4RUUATlN0M19fMjIwX19zaGFyZWRfcHRyX2VtcGxhY2VJN21heGlNaXhOU185YWxsb2NhdG9ySVMxX0VFRUUAdmlpZGlkAHZpaWRpZGQAdmlpZGlkZGQAMTBtYXhpTGFnRXhwSWRFAFAxMG1heGlMYWdFeHBJZEUAUEsxMG1heGlMYWdFeHBJZEUATlN0M19fMjIwX19zaGFyZWRfcHRyX3BvaW50ZXJJUDEwbWF4aUxhZ0V4cElkRU4xMGVtc2NyaXB0ZW4xNXNtYXJ0X3B0cl90cmFpdElOU18xMHNoYXJlZF9wdHJJUzJfRUVFMTF2YWxfZGVsZXRlckVOU185YWxsb2NhdG9ySVMyX0VFRUUATjEwZW1zY3JpcHRlbjE1c21hcnRfcHRyX3RyYWl0SU5TdDNfXzIxMHNoYXJlZF9wdHJJMTBtYXhpTGFnRXhwSWRFRUVFMTF2YWxfZGVsZXRlckUATlN0M19fMjEwc2hhcmVkX3B0ckkxMG1heGlMYWdFeHBJZEVFRQBOU3QzX18yMjBfX3NoYXJlZF9wdHJfZW1wbGFjZUkxMG1heGlMYWdFeHBJZEVOU185YWxsb2NhdG9ySVMyX0VFRUUAdmlpZGQAMTBtYXhpU2FtcGxlAFAxMG1heGlTYW1wbGUAUEsxMG1heGlTYW1wbGUATlN0M19fMjIwX19zaGFyZWRfcHRyX3BvaW50ZXJJUDEwbWF4aVNhbXBsZU4xMGVtc2NyaXB0ZW4xNXNtYXJ0X3B0cl90cmFpdElOU18xMHNoYXJlZF9wdHJJUzFfRUVFMTF2YWxfZGVsZXRlckVOU185YWxsb2NhdG9ySVMxX0VFRUUATjEwZW1zY3JpcHRlbjE1c21hcnRfcHRyX3RyYWl0SU5TdDNfXzIxMHNoYXJlZF9wdHJJMTBtYXhpU2FtcGxlRUVFMTF2YWxfZGVsZXRlckUATlN0M19fMjEwc2hhcmVkX3B0ckkxMG1heGlTYW1wbGVFRQBOU3QzX18yMjBfX3NoYXJlZF9wdHJfZW1wbGFjZUkxMG1heGlTYW1wbGVOU185YWxsb2NhdG9ySVMxX0VFRUUAdmlpZmZpaQBOU3QzX18yMTJiYXNpY19zdHJpbmdJY05TXzExY2hhcl90cmFpdHNJY0VFTlNfOWFsbG9jYXRvckljRUVFRQBOU3QzX18yMjFfX2Jhc2ljX3N0cmluZ19jb21tb25JTGIxRUVFADdtYXhpTWFwAFA3bWF4aU1hcABQSzdtYXhpTWFwAE5TdDNfXzIyMF9fc2hhcmVkX3B0cl9wb2ludGVySVA3bWF4aU1hcE4xMGVtc2NyaXB0ZW4xNXNtYXJ0X3B0cl90cmFpdElOU18xMHNoYXJlZF9wdHJJUzFfRUVFMTF2YWxfZGVsZXRlckVOU185YWxsb2NhdG9ySVMxX0VFRUUATjEwZW1zY3JpcHRlbjE1c21hcnRfcHRyX3RyYWl0SU5TdDNfXzIxMHNoYXJlZF9wdHJJN21heGlNYXBFRUUxMXZhbF9kZWxldGVyRQBOU3QzX18yMTBzaGFyZWRfcHRySTdtYXhpTWFwRUUATlN0M19fMjIwX19zaGFyZWRfcHRyX2VtcGxhY2VJN21heGlNYXBOU185YWxsb2NhdG9ySVMxX0VFRUUAZGlkZGRkZABkaWRkZAA3bWF4aUR5bgBQN21heGlEeW4AUEs3bWF4aUR5bgBOU3QzX18yMjBfX3NoYXJlZF9wdHJfcG9pbnRlcklQN21heGlEeW5OMTBlbXNjcmlwdGVuMTVzbWFydF9wdHJfdHJhaXRJTlNfMTBzaGFyZWRfcHRySVMxX0VFRTExdmFsX2RlbGV0ZXJFTlNfOWFsbG9jYXRvcklTMV9FRUVFAE4xMGVtc2NyaXB0ZW4xNXNtYXJ0X3B0cl90cmFpdElOU3QzX18yMTBzaGFyZWRfcHRySTdtYXhpRHluRUVFMTF2YWxfZGVsZXRlckUATlN0M19fMjEwc2hhcmVkX3B0ckk3bWF4aUR5bkVFAE5TdDNfXzIyMF9fc2hhcmVkX3B0cl9lbXBsYWNlSTdtYXhpRHluTlNfOWFsbG9jYXRvcklTMV9FRUVFAGRpaWRkaWRkAGRpaWRkZGRkADdtYXhpRW52AFA3bWF4aUVudgBQSzdtYXhpRW52AGRpaWRkZGlpAGRpaWRkZGRkaWkAZGlpZGkAN2NvbnZlcnQAUDdjb252ZXJ0AFBLN2NvbnZlcnQATlN0M19fMjIwX19zaGFyZWRfcHRyX3BvaW50ZXJJUDdjb252ZXJ0TjEwZW1zY3JpcHRlbjE1c21hcnRfcHRyX3RyYWl0SU5TXzEwc2hhcmVkX3B0cklTMV9FRUUxMXZhbF9kZWxldGVyRU5TXzlhbGxvY2F0b3JJUzFfRUVFRQBOMTBlbXNjcmlwdGVuMTVzbWFydF9wdHJfdHJhaXRJTlN0M19fMjEwc2hhcmVkX3B0ckk3Y29udmVydEVFRTExdmFsX2RlbGV0ZXJFAE5TdDNfXzIxMHNoYXJlZF9wdHJJN2NvbnZlcnRFRQBOU3QzX18yMjBfX3NoYXJlZF9wdHJfZW1wbGFjZUk3Y29udmVydE5TXzlhbGxvY2F0b3JJUzFfRUVFRQBkaWlpADE0bWF4aURpc3RvcnRpb24AUDE0bWF4aURpc3RvcnRpb24AUEsxNG1heGlEaXN0b3J0aW9uAE5TdDNfXzIyMF9fc2hhcmVkX3B0cl9wb2ludGVySVAxNG1heGlEaXN0b3J0aW9uTjEwZW1zY3JpcHRlbjE1c21hcnRfcHRyX3RyYWl0SU5TXzEwc2hhcmVkX3B0cklTMV9FRUUxMXZhbF9kZWxldGVyRU5TXzlhbGxvY2F0b3JJUzFfRUVFRQBOMTBlbXNjcmlwdGVuMTVzbWFydF9wdHJfdHJhaXRJTlN0M19fMjEwc2hhcmVkX3B0ckkxNG1heGlEaXN0b3J0aW9uRUVFMTF2YWxfZGVsZXRlckUATlN0M19fMjEwc2hhcmVkX3B0ckkxNG1heGlEaXN0b3J0aW9uRUUATlN0M19fMjIwX19zaGFyZWRfcHRyX2VtcGxhY2VJMTRtYXhpRGlzdG9ydGlvbk5TXzlhbGxvY2F0b3JJUzFfRUVFRQAxMW1heGlGbGFuZ2VyAFAxMW1heGlGbGFuZ2VyAFBLMTFtYXhpRmxhbmdlcgBOU3QzX18yMjBfX3NoYXJlZF9wdHJfcG9pbnRlcklQMTFtYXhpRmxhbmdlck4xMGVtc2NyaXB0ZW4xNXNtYXJ0X3B0cl90cmFpdElOU18xMHNoYXJlZF9wdHJJUzFfRUVFMTF2YWxfZGVsZXRlckVOU185YWxsb2NhdG9ySVMxX0VFRUUATjEwZW1zY3JpcHRlbjE1c21hcnRfcHRyX3RyYWl0SU5TdDNfXzIxMHNoYXJlZF9wdHJJMTFtYXhpRmxhbmdlckVFRTExdmFsX2RlbGV0ZXJFAE5TdDNfXzIxMHNoYXJlZF9wdHJJMTFtYXhpRmxhbmdlckVFAE5TdDNfXzIyMF9fc2hhcmVkX3B0cl9lbXBsYWNlSTExbWF4aUZsYW5nZXJOU185YWxsb2NhdG9ySVMxX0VFRUUAZGlpZGlkZGQAMTBtYXhpQ2hvcnVzAFAxMG1heGlDaG9ydXMAUEsxMG1heGlDaG9ydXMATlN0M19fMjIwX19zaGFyZWRfcHRyX3BvaW50ZXJJUDEwbWF4aUNob3J1c04xMGVtc2NyaXB0ZW4xNXNtYXJ0X3B0cl90cmFpdElOU18xMHNoYXJlZF9wdHJJUzFfRUVFMTF2YWxfZGVsZXRlckVOU185YWxsb2NhdG9ySVMxX0VFRUUATjEwZW1zY3JpcHRlbjE1c21hcnRfcHRyX3RyYWl0SU5TdDNfXzIxMHNoYXJlZF9wdHJJMTBtYXhpQ2hvcnVzRUVFMTF2YWxfZGVsZXRlckUATlN0M19fMjEwc2hhcmVkX3B0ckkxMG1heGlDaG9ydXNFRQBOU3QzX18yMjBfX3NoYXJlZF9wdHJfZW1wbGFjZUkxMG1heGlDaG9ydXNOU185YWxsb2NhdG9ySVMxX0VFRUUAMTNtYXhpRENCbG9ja2VyAFAxM21heGlEQ0Jsb2NrZXIAUEsxM21heGlEQ0Jsb2NrZXIATlN0M19fMjIwX19zaGFyZWRfcHRyX3BvaW50ZXJJUDEzbWF4aURDQmxvY2tlck4xMGVtc2NyaXB0ZW4xNXNtYXJ0X3B0cl90cmFpdElOU18xMHNoYXJlZF9wdHJJUzFfRUVFMTF2YWxfZGVsZXRlckVOU185YWxsb2NhdG9ySVMxX0VFRUUATjEwZW1zY3JpcHRlbjE1c21hcnRfcHRyX3RyYWl0SU5TdDNfXzIxMHNoYXJlZF9wdHJJMTNtYXhpRENCbG9ja2VyRUVFMTF2YWxfZGVsZXRlckUATlN0M19fMjEwc2hhcmVkX3B0ckkxM21heGlEQ0Jsb2NrZXJFRQBOU3QzX18yMjBfX3NoYXJlZF9wdHJfZW1wbGFjZUkxM21heGlEQ0Jsb2NrZXJOU185YWxsb2NhdG9ySVMxX0VFRUUAN21heGlTVkYAUDdtYXhpU1ZGAFBLN21heGlTVkYATlN0M19fMjIwX19zaGFyZWRfcHRyX3BvaW50ZXJJUDdtYXhpU1ZGTjEwZW1zY3JpcHRlbjE1c21hcnRfcHRyX3RyYWl0SU5TXzEwc2hhcmVkX3B0cklTMV9FRUUxMXZhbF9kZWxldGVyRU5TXzlhbGxvY2F0b3JJUzFfRUVFRQBOMTBlbXNjcmlwdGVuMTVzbWFydF9wdHJfdHJhaXRJTlN0M19fMjEwc2hhcmVkX3B0ckk3bWF4aVNWRkVFRTExdmFsX2RlbGV0ZXJFAE5TdDNfXzIxMHNoYXJlZF9wdHJJN21heGlTVkZFRQBOU3QzX18yMjBfX3NoYXJlZF9wdHJfZW1wbGFjZUk3bWF4aVNWRk5TXzlhbGxvY2F0b3JJUzFfRUVFRQBpaWlkAExvYWRpbmc6IABkYXRhAENoOiAALCBsZW46IABFUlJPUjogQ291bGQgbm90IGxvYWQgc2FtcGxlLgBhbGxvY2F0b3I8VD46OmFsbG9jYXRlKHNpemVfdCBuKSAnbicgZXhjZWVkcyBtYXhpbXVtIHN1cHBvcnRlZCBzaXplAE5TdDNfXzIxM2Jhc2ljX2ZpbGVidWZJY05TXzExY2hhcl90cmFpdHNJY0VFRUUAdwBhAHIAcisAdysAYSsAd2IAYWIAcmIAcitiAHcrYgBhK2IATlN0M19fMjE0YmFzaWNfaWZzdHJlYW1JY05TXzExY2hhcl90cmFpdHNJY0VFRUUAQXV0b3RyaW06IHN0YXJ0OiAALCBlbmQ6IAB2b2lkAGJvb2wAc3RkOjpzdHJpbmcAc3RkOjpiYXNpY19zdHJpbmc8dW5zaWduZWQgY2hhcj4Ac3RkOjp3c3RyaW5nAGVtc2NyaXB0ZW46OnZhbABlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxzaWduZWQgY2hhcj4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8dW5zaWduZWQgY2hhcj4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8c2hvcnQ+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHVuc2lnbmVkIHNob3J0PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxpbnQ+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHVuc2lnbmVkIGludD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8aW50OF90PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzx1aW50OF90PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxpbnQxNl90PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzx1aW50MTZfdD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8aW50MzJfdD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8dWludDMyX3Q+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PGxvbmcgZG91YmxlPgBOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0llRUUAZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8ZG91YmxlPgBOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0lkRUUAZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8ZmxvYXQ+AE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SWZFRQBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzx1bnNpZ25lZCBsb25nPgBOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0ltRUUAZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8bG9uZz4ATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJbEVFAE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SWpFRQBOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0lpRUUATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJdEVFAE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SXNFRQBOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0loRUUATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJYUVFAGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PGNoYXI+AE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SWNFRQBOU3QzX18yMTJiYXNpY19zdHJpbmdJd05TXzExY2hhcl90cmFpdHNJd0VFTlNfOWFsbG9jYXRvckl3RUVFRQBOU3QzX18yMTJiYXNpY19zdHJpbmdJaE5TXzExY2hhcl90cmFpdHNJaEVFTlNfOWFsbG9jYXRvckloRUVFRQBkb3VibGUAZmxvYXQAdW5zaWduZWQgbG9uZwBsb25nAHVuc2lnbmVkIGludABpbnQAdW5zaWduZWQgc2hvcnQAc2hvcnQAdW5zaWduZWQgY2hhcgBzaWduZWQgY2hhcgBjaGFyAHJ3YQBpbmZpbml0eQAAAQIEBwMGBQAtKyAgIDBYMHgAKG51bGwpAC0wWCswWCAwWC0weCsweCAweABpbmYASU5GAG5hbgBOQU4ALgBMQ19BTEwATEFORwBDLlVURi04AFBPU0lYAE1VU0xfTE9DUEFUSABOU3QzX18yOGlvc19iYXNlRQBOU3QzX18yOWJhc2ljX2lvc0ljTlNfMTFjaGFyX3RyYWl0c0ljRUVFRQBOU3QzX18yOWJhc2ljX2lvc0l3TlNfMTFjaGFyX3RyYWl0c0l3RUVFRQBOU3QzX18yMTViYXNpY19zdHJlYW1idWZJY05TXzExY2hhcl90cmFpdHNJY0VFRUUATlN0M19fMjE1YmFzaWNfc3RyZWFtYnVmSXdOU18xMWNoYXJfdHJhaXRzSXdFRUVFAE5TdDNfXzIxM2Jhc2ljX2lzdHJlYW1JY05TXzExY2hhcl90cmFpdHNJY0VFRUUATlN0M19fMjEzYmFzaWNfaXN0cmVhbUl3TlNfMTFjaGFyX3RyYWl0c0l3RUVFRQBOU3QzX18yMTNiYXNpY19vc3RyZWFtSWNOU18xMWNoYXJfdHJhaXRzSWNFRUVFAE5TdDNfXzIxM2Jhc2ljX29zdHJlYW1Jd05TXzExY2hhcl90cmFpdHNJd0VFRUUATlN0M19fMjExX19zdGRvdXRidWZJd0VFAE5TdDNfXzIxMV9fc3Rkb3V0YnVmSWNFRQB1bnN1cHBvcnRlZCBsb2NhbGUgZm9yIHN0YW5kYXJkIGlucHV0AE5TdDNfXzIxMF9fc3RkaW5idWZJd0VFAE5TdDNfXzIxMF9fc3RkaW5idWZJY0VFAE5TdDNfXzI3Y29sbGF0ZUljRUUATlN0M19fMjZsb2NhbGU1ZmFjZXRFAE5TdDNfXzI3Y29sbGF0ZUl3RUUAJXAAQwBOU3QzX18yN251bV9nZXRJY05TXzE5aXN0cmVhbWJ1Zl9pdGVyYXRvckljTlNfMTFjaGFyX3RyYWl0c0ljRUVFRUVFAE5TdDNfXzI5X19udW1fZ2V0SWNFRQBOU3QzX18yMTRfX251bV9nZXRfYmFzZUUATlN0M19fMjdudW1fZ2V0SXdOU18xOWlzdHJlYW1idWZfaXRlcmF0b3JJd05TXzExY2hhcl90cmFpdHNJd0VFRUVFRQBOU3QzX18yOV9fbnVtX2dldEl3RUUAJXAAAAAATABsbAAlAAAAAABsAE5TdDNfXzI3bnVtX3B1dEljTlNfMTlvc3RyZWFtYnVmX2l0ZXJhdG9ySWNOU18xMWNoYXJfdHJhaXRzSWNFRUVFRUUATlN0M19fMjlfX251bV9wdXRJY0VFAE5TdDNfXzIxNF9fbnVtX3B1dF9iYXNlRQBOU3QzX18yN251bV9wdXRJd05TXzE5b3N0cmVhbWJ1Zl9pdGVyYXRvckl3TlNfMTFjaGFyX3RyYWl0c0l3RUVFRUVFAE5TdDNfXzI5X19udW1fcHV0SXdFRQAlSDolTTolUwAlbS8lZC8leQAlSTolTTolUyAlcAAlYSAlYiAlZCAlSDolTTolUyAlWQBBTQBQTQBKYW51YXJ5AEZlYnJ1YXJ5AE1hcmNoAEFwcmlsAE1heQBKdW5lAEp1bHkAQXVndXN0AFNlcHRlbWJlcgBPY3RvYmVyAE5vdmVtYmVyAERlY2VtYmVyAEphbgBGZWIATWFyAEFwcgBKdW4ASnVsAEF1ZwBTZXAAT2N0AE5vdgBEZWMAU3VuZGF5AE1vbmRheQBUdWVzZGF5AFdlZG5lc2RheQBUaHVyc2RheQBGcmlkYXkAU2F0dXJkYXkAU3VuAE1vbgBUdWUAV2VkAFRodQBGcmkAU2F0ACVtLyVkLyV5JVktJW0tJWQlSTolTTolUyAlcCVIOiVNJUg6JU06JVMlSDolTTolU05TdDNfXzI4dGltZV9nZXRJY05TXzE5aXN0cmVhbWJ1Zl9pdGVyYXRvckljTlNfMTFjaGFyX3RyYWl0c0ljRUVFRUVFAE5TdDNfXzIyMF9fdGltZV9nZXRfY19zdG9yYWdlSWNFRQBOU3QzX18yOXRpbWVfYmFzZUUATlN0M19fMjh0aW1lX2dldEl3TlNfMTlpc3RyZWFtYnVmX2l0ZXJhdG9ySXdOU18xMWNoYXJfdHJhaXRzSXdFRUVFRUUATlN0M19fMjIwX190aW1lX2dldF9jX3N0b3JhZ2VJd0VFAE5TdDNfXzI4dGltZV9wdXRJY05TXzE5b3N0cmVhbWJ1Zl9pdGVyYXRvckljTlNfMTFjaGFyX3RyYWl0c0ljRUVFRUVFAE5TdDNfXzIxMF9fdGltZV9wdXRFAE5TdDNfXzI4dGltZV9wdXRJd05TXzE5b3N0cmVhbWJ1Zl9pdGVyYXRvckl3TlNfMTFjaGFyX3RyYWl0c0l3RUVFRUVFAE5TdDNfXzIxMG1vbmV5cHVuY3RJY0xiMEVFRQBOU3QzX18yMTBtb25leV9iYXNlRQBOU3QzX18yMTBtb25leXB1bmN0SWNMYjFFRUUATlN0M19fMjEwbW9uZXlwdW5jdEl3TGIwRUVFAE5TdDNfXzIxMG1vbmV5cHVuY3RJd0xiMUVFRQAwMTIzNDU2Nzg5ACVMZgBOU3QzX18yOW1vbmV5X2dldEljTlNfMTlpc3RyZWFtYnVmX2l0ZXJhdG9ySWNOU18xMWNoYXJfdHJhaXRzSWNFRUVFRUUATlN0M19fMjExX19tb25leV9nZXRJY0VFADAxMjM0NTY3ODkATlN0M19fMjltb25leV9nZXRJd05TXzE5aXN0cmVhbWJ1Zl9pdGVyYXRvckl3TlNfMTFjaGFyX3RyYWl0c0l3RUVFRUVFAE5TdDNfXzIxMV9fbW9uZXlfZ2V0SXdFRQAlLjBMZgBOU3QzX18yOW1vbmV5X3B1dEljTlNfMTlvc3RyZWFtYnVmX2l0ZXJhdG9ySWNOU18xMWNoYXJfdHJhaXRzSWNFRUVFRUUATlN0M19fMjExX19tb25leV9wdXRJY0VFAE5TdDNfXzI5bW9uZXlfcHV0SXdOU18xOW9zdHJlYW1idWZfaXRlcmF0b3JJd05TXzExY2hhcl90cmFpdHNJd0VFRUVFRQBOU3QzX18yMTFfX21vbmV5X3B1dEl3RUUATlN0M19fMjhtZXNzYWdlc0ljRUUATlN0M19fMjEzbWVzc2FnZXNfYmFzZUUATlN0M19fMjE3X193aWRlbl9mcm9tX3V0ZjhJTG0zMkVFRQBOU3QzX18yN2NvZGVjdnRJRGljMTFfX21ic3RhdGVfdEVFAE5TdDNfXzIxMmNvZGVjdnRfYmFzZUUATlN0M19fMjE2X19uYXJyb3dfdG9fdXRmOElMbTMyRUVFAE5TdDNfXzI4bWVzc2FnZXNJd0VFAE5TdDNfXzI3Y29kZWN2dEljYzExX19tYnN0YXRlX3RFRQBOU3QzX18yN2NvZGVjdnRJd2MxMV9fbWJzdGF0ZV90RUUATlN0M19fMjdjb2RlY3Z0SURzYzExX19tYnN0YXRlX3RFRQBOU3QzX18yNmxvY2FsZTVfX2ltcEUATlN0M19fMjVjdHlwZUljRUUATlN0M19fMjEwY3R5cGVfYmFzZUUATlN0M19fMjVjdHlwZUl3RUUAZmFsc2UAdHJ1ZQBOU3QzX18yOG51bXB1bmN0SWNFRQBOU3QzX18yOG51bXB1bmN0SXdFRQBOU3QzX18yMTRfX3NoYXJlZF9jb3VudEUATlN0M19fMjE5X19zaGFyZWRfd2Vha19jb3VudEUAdGVybWluYXRpbmcgd2l0aCAlcyBleGNlcHRpb24gb2YgdHlwZSAlczogJXMAdGVybWluYXRpbmcgd2l0aCAlcyBleGNlcHRpb24gb2YgdHlwZSAlcwB0ZXJtaW5hdGluZyB3aXRoICVzIGZvcmVpZ24gZXhjZXB0aW9uAHRlcm1pbmF0aW5nAHVuY2F1Z2h0AFN0OWV4Y2VwdGlvbgBOMTBfX2N4eGFiaXYxMTZfX3NoaW1fdHlwZV9pbmZvRQBTdDl0eXBlX2luZm8ATjEwX19jeHhhYml2MTIwX19zaV9jbGFzc190eXBlX2luZm9FAE4xMF9fY3h4YWJpdjExN19fY2xhc3NfdHlwZV9pbmZvRQBwdGhyZWFkX29uY2UgZmFpbHVyZSBpbiBfX2N4YV9nZXRfZ2xvYmFsc19mYXN0KCkAY2Fubm90IGNyZWF0ZSBwdGhyZWFkIGtleSBmb3IgX19jeGFfZ2V0X2dsb2JhbHMoKQBjYW5ub3QgemVybyBvdXQgdGhyZWFkIHZhbHVlIGZvciBfX2N4YV9nZXRfZ2xvYmFscygpAHRlcm1pbmF0ZV9oYW5kbGVyIHVuZXhwZWN0ZWRseSByZXR1cm5lZABTdDExbG9naWNfZXJyb3IAU3QxMmxlbmd0aF9lcnJvcgBzdGQ6OmJhZF9jYXN0AFN0OGJhZF9jYXN0AE4xMF9fY3h4YWJpdjExOV9fcG9pbnRlcl90eXBlX2luZm9FAE4xMF9fY3h4YWJpdjExN19fcGJhc2VfdHlwZV9pbmZvRQBOMTBfX2N4eGFiaXYxMjNfX2Z1bmRhbWVudGFsX3R5cGVfaW5mb0UAdgBEbgBiAGMAaABzAHQAaQBqAG0AZgBkAE4xMF9fY3h4YWJpdjEyMV9fdm1pX2NsYXNzX3R5cGVfaW5mb0U=';
if (!isDataURI(wasmBinaryFile)) {
  wasmBinaryFile = locateFile(wasmBinaryFile);
}

function getBinary() {
  try {
    if (Module['wasmBinary']) {
      return new Uint8Array(Module['wasmBinary']);
    }
    var binary = tryParseAsDataURI(wasmBinaryFile);
    if (binary) {
      return binary;
    }
    if (Module['readBinary']) {
      return Module['readBinary'](wasmBinaryFile);
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
  if (!Module['wasmBinary'] && (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) && typeof fetch === 'function') {
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
function createWasm(env) {
  // prepare imports
  var info = {
    'env': env
    ,
    'global': {
      'NaN': NaN,
      'Infinity': Infinity
    },
    'global.Math': Math,
    'asm2wasm': asm2wasmImports
  };
  // Load the wasm module and create an instance of using native support in the JS engine.
  // handle a generated wasm instance, receiving its exports and
  // performing other necessary setup
  function receiveInstance(instance, module) {
    var exports = instance.exports;
    Module['asm'] = exports;
    removeRunDependency('wasm-instantiate');
  }
  addRunDependency('wasm-instantiate');

  // User shell pages can write their own Module.instantiateWasm = function(imports, successCallback) callback
  // to manually instantiate the Wasm module themselves. This allows pages to run the instantiation parallel
  // to any other async startup actions they are performing.
  if (Module['instantiateWasm']) {
    try {
      return Module['instantiateWasm'](info, receiveInstance);
    } catch(e) {
      err('Module.instantiateWasm callback failed with error: ' + e);
      return false;
    }
  }

  var instance;
  var module;
  try {
    module = new WebAssembly.Module(getBinary());
    instance = new WebAssembly.Instance(module, info)
  } catch (e) {
    err('failed to compile wasm module: ' + e);
    if (e.toString().indexOf('imported Memory with incompatible size') >= 0) {
      err('Memory size incompatibility issues may be due to changing TOTAL_MEMORY at runtime to something too large. Use ALLOW_MEMORY_GROWTH to allow any size memory (and also make sure not to set TOTAL_MEMORY at runtime to something smaller than it was at compile time).');
    }
    return false;
  }
  receiveInstance(instance, module);
  return Module['asm']; // exports were assigned here
}

// Provide an "asm.js function" for the application, called to "link" the asm.js module. We instantiate
// the wasm module at that time, and it receives imports and provides exports and so forth, the app
// doesn't need to care that it is wasm or asm.js.

Module['asm'] = function(global, env, providedBuffer) {
  // memory was already allocated (so js could use the buffer)
  env['memory'] = wasmMemory
  ;
  // import table
  env['table'] = wasmTable = new WebAssembly.Table({
    'initial': 1174,
    'maximum': 1174,
    'element': 'anyfunc'
  });
  env['__memory_base'] = 1024; // tell the memory segments where to place themselves
  env['__table_base'] = 0; // table starts at 0 by default (even in dynamic linking, for the main module)

  var exports = createWasm(env);
  return exports;
};

// === Body ===

var ASM_CONSTS = [];





// STATICTOP = STATIC_BASE + 50432;
/* global initializers */  __ATINIT__.push({ func: function() { globalCtors() } });








/* no memory initializer */
var tempDoublePtr = 51440

function copyTempFloat(ptr) { // functions, because inlining this code increases code size too much
  HEAP8[tempDoublePtr] = HEAP8[ptr];
  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];
  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];
  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];
}

function copyTempDouble(ptr) {
  HEAP8[tempDoublePtr] = HEAP8[ptr];
  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];
  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];
  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];
  HEAP8[tempDoublePtr+4] = HEAP8[ptr+4];
  HEAP8[tempDoublePtr+5] = HEAP8[ptr+5];
  HEAP8[tempDoublePtr+6] = HEAP8[ptr+6];
  HEAP8[tempDoublePtr+7] = HEAP8[ptr+7];
}

// {{PRE_LIBRARY}}


  function ___cxa_allocate_exception(size) {
      return _malloc(size);
    }

  
  
  function ___cxa_free_exception(ptr) {
      try {
        return _free(ptr);
      } catch(e) { // XXX FIXME
      }
    }var EXCEPTIONS={last:0,caught:[],infos:{},deAdjust:function (adjusted) {
        if (!adjusted || EXCEPTIONS.infos[adjusted]) return adjusted;
        for (var key in EXCEPTIONS.infos) {
          var ptr = +key; // the iteration key is a string, and if we throw this, it must be an integer as that is what we look for
          var adj = EXCEPTIONS.infos[ptr].adjusted;
          var len = adj.length;
          for (var i = 0; i < len; i++) {
            if (adj[i] === adjusted) {
              return ptr;
            }
          }
        }
        return adjusted;
      },addRef:function (ptr) {
        if (!ptr) return;
        var info = EXCEPTIONS.infos[ptr];
        info.refcount++;
      },decRef:function (ptr) {
        if (!ptr) return;
        var info = EXCEPTIONS.infos[ptr];
        assert(info.refcount > 0);
        info.refcount--;
        // A rethrown exception can reach refcount 0; it must not be discarded
        // Its next handler will clear the rethrown flag and addRef it, prior to
        // final decRef and destruction here
        if (info.refcount === 0 && !info.rethrown) {
          if (info.destructor) {
            Module['dynCall_vi'](info.destructor, ptr);
          }
          delete EXCEPTIONS.infos[ptr];
          ___cxa_free_exception(ptr);
        }
      },clearRef:function (ptr) {
        if (!ptr) return;
        var info = EXCEPTIONS.infos[ptr];
        info.refcount = 0;
      }};function ___cxa_begin_catch(ptr) {
      var info = EXCEPTIONS.infos[ptr];
      if (info && !info.caught) {
        info.caught = true;
        __ZSt18uncaught_exceptionv.uncaught_exception--;
      }
      if (info) info.rethrown = false;
      EXCEPTIONS.caught.push(ptr);
      EXCEPTIONS.addRef(EXCEPTIONS.deAdjust(ptr));
      return ptr;
    }

  
  
  function ___resumeException(ptr) {
      if (!EXCEPTIONS.last) { EXCEPTIONS.last = ptr; }
      throw ptr;
    }function ___cxa_find_matching_catch() {
      var thrown = EXCEPTIONS.last;
      if (!thrown) {
        // just pass through the null ptr
        return ((setTempRet0(0),0)|0);
      }
      var info = EXCEPTIONS.infos[thrown];
      var throwntype = info.type;
      if (!throwntype) {
        // just pass through the thrown ptr
        return ((setTempRet0(0),thrown)|0);
      }
      var typeArray = Array.prototype.slice.call(arguments);
  
      var pointer = Module['___cxa_is_pointer_type'](throwntype);
      // can_catch receives a **, add indirection
      if (!___cxa_find_matching_catch.buffer) ___cxa_find_matching_catch.buffer = _malloc(4);
      HEAP32[((___cxa_find_matching_catch.buffer)>>2)]=thrown;
      thrown = ___cxa_find_matching_catch.buffer;
      // The different catch blocks are denoted by different types.
      // Due to inheritance, those types may not precisely match the
      // type of the thrown object. Find one which matches, and
      // return the type of the catch block which should be called.
      for (var i = 0; i < typeArray.length; i++) {
        if (typeArray[i] && Module['___cxa_can_catch'](typeArray[i], throwntype, thrown)) {
          thrown = HEAP32[((thrown)>>2)]; // undo indirection
          info.adjusted.push(thrown);
          return ((setTempRet0(typeArray[i]),thrown)|0);
        }
      }
      // Shouldn't happen unless we have bogus data in typeArray
      // or encounter a type for which emscripten doesn't have suitable
      // typeinfo defined. Best-efforts match just in case.
      thrown = HEAP32[((thrown)>>2)]; // undo indirection
      return ((setTempRet0(throwntype),thrown)|0);
    }function ___cxa_throw(ptr, type, destructor) {
      EXCEPTIONS.infos[ptr] = {
        ptr: ptr,
        adjusted: [ptr],
        type: type,
        destructor: destructor,
        refcount: 0,
        caught: false,
        rethrown: false
      };
      EXCEPTIONS.last = ptr;
      if (!("uncaught_exception" in __ZSt18uncaught_exceptionv)) {
        __ZSt18uncaught_exceptionv.uncaught_exception = 1;
      } else {
        __ZSt18uncaught_exceptionv.uncaught_exception++;
      }
      throw ptr;
    }

  function ___cxa_uncaught_exception() {
      return !!__ZSt18uncaught_exceptionv.uncaught_exception;
    }

  function ___gxx_personality_v0() {
    }

  function ___lock() {}

  
  function ___setErrNo(value) {
      if (Module['___errno_location']) HEAP32[((Module['___errno_location']())>>2)]=value;
      return value;
    }function ___map_file(pathname, size) {
      ___setErrNo(1);
      return -1;
    }

  
  
  
  var PATH={splitPath:function (filename) {
        var splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
        return splitPathRe.exec(filename).slice(1);
      },normalizeArray:function (parts, allowAboveRoot) {
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
      },normalize:function (path) {
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
      },dirname:function (path) {
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
      },basename:function (path) {
        // EMSCRIPTEN return '/'' for '/', not an empty string
        if (path === '/') return '/';
        var lastSlash = path.lastIndexOf('/');
        if (lastSlash === -1) return path;
        return path.substr(lastSlash+1);
      },extname:function (path) {
        return PATH.splitPath(path)[3];
      },join:function () {
        var paths = Array.prototype.slice.call(arguments, 0);
        return PATH.normalize(paths.join('/'));
      },join2:function (l, r) {
        return PATH.normalize(l + '/' + r);
      },resolve:function () {
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
      },relative:function (from, to) {
        from = PATH.resolve(from).substr(1);
        to = PATH.resolve(to).substr(1);
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
      },shutdown:function () {
        // https://github.com/emscripten-core/emscripten/pull/1555
        // if (ENVIRONMENT_IS_NODE) {
        //   // inolen: any idea as to why node -e 'process.stdin.read()' wouldn't exit immediately (with process.stdin being a tty)?
        //   // isaacs: because now it's reading from the stream, you've expressed interest in it, so that read() kicks off a _read() which creates a ReadReq operation
        //   // inolen: I thought read() in that case was a synchronous operation that just grabbed some amount of buffered data if it exists?
        //   // isaacs: it is. but it also triggers a _read() call, which calls readStart() on the handle
        //   // isaacs: do process.stdin.pause() and i'd think it'd probably close the pending call
        //   process['stdin']['pause']();
        // }
      },register:function (dev, ops) {
        TTY.ttys[dev] = { input: [], output: [], ops: ops };
        FS.registerDevice(dev, TTY.stream_ops);
      },stream_ops:{open:function (stream) {
          var tty = TTY.ttys[stream.node.rdev];
          if (!tty) {
            throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
          }
          stream.tty = tty;
          stream.seekable = false;
        },close:function (stream) {
          // flush any pending line data
          stream.tty.ops.flush(stream.tty);
        },flush:function (stream) {
          stream.tty.ops.flush(stream.tty);
        },read:function (stream, buffer, offset, length, pos /* ignored */) {
          if (!stream.tty || !stream.tty.ops.get_char) {
            throw new FS.ErrnoError(ERRNO_CODES.ENXIO);
          }
          var bytesRead = 0;
          for (var i = 0; i < length; i++) {
            var result;
            try {
              result = stream.tty.ops.get_char(stream.tty);
            } catch (e) {
              throw new FS.ErrnoError(ERRNO_CODES.EIO);
            }
            if (result === undefined && bytesRead === 0) {
              throw new FS.ErrnoError(ERRNO_CODES.EAGAIN);
            }
            if (result === null || result === undefined) break;
            bytesRead++;
            buffer[offset+i] = result;
          }
          if (bytesRead) {
            stream.node.timestamp = Date.now();
          }
          return bytesRead;
        },write:function (stream, buffer, offset, length, pos) {
          if (!stream.tty || !stream.tty.ops.put_char) {
            throw new FS.ErrnoError(ERRNO_CODES.ENXIO);
          }
          try {
            for (var i = 0; i < length; i++) {
              stream.tty.ops.put_char(stream.tty, buffer[offset+i]);
            }
          } catch (e) {
            throw new FS.ErrnoError(ERRNO_CODES.EIO);
          }
          if (length) {
            stream.node.timestamp = Date.now();
          }
          return i;
        }},default_tty_ops:{get_char:function (tty) {
          if (!tty.input.length) {
            var result = null;
            if (ENVIRONMENT_IS_NODE) {
              // we will read data by chunks of BUFSIZE
              var BUFSIZE = 256;
              var buf = new Buffer(BUFSIZE);
              var bytesRead = 0;
  
              var isPosixPlatform = (process.platform != 'win32'); // Node doesn't offer a direct check, so test by exclusion
  
              var fd = process.stdin.fd;
              if (isPosixPlatform) {
                // Linux and Mac cannot use process.stdin.fd (which isn't set up as sync)
                var usingDevice = false;
                try {
                  fd = fs.openSync('/dev/stdin', 'r');
                  usingDevice = true;
                } catch (e) {}
              }
  
              try {
                bytesRead = fs.readSync(fd, buf, 0, BUFSIZE, null);
              } catch(e) {
                // Cross-platform differences: on Windows, reading EOF throws an exception, but on other OSes,
                // reading EOF returns 0. Uniformize behavior by treating the EOF exception to return 0.
                if (e.toString().indexOf('EOF') != -1) bytesRead = 0;
                else throw e;
              }
  
              if (usingDevice) { fs.closeSync(fd); }
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
        },put_char:function (tty, val) {
          if (val === null || val === 10) {
            out(UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          } else {
            if (val != 0) tty.output.push(val); // val == 0 would cut text output off in the middle.
          }
        },flush:function (tty) {
          if (tty.output && tty.output.length > 0) {
            out(UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          }
        }},default_tty1_ops:{put_char:function (tty, val) {
          if (val === null || val === 10) {
            err(UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          } else {
            if (val != 0) tty.output.push(val);
          }
        },flush:function (tty) {
          if (tty.output && tty.output.length > 0) {
            err(UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          }
        }}};
  
  var MEMFS={ops_table:null,mount:function (mount) {
        return MEMFS.createNode(null, '/', 16384 | 511 /* 0777 */, 0);
      },createNode:function (parent, name, mode, dev) {
        if (FS.isBlkdev(mode) || FS.isFIFO(mode)) {
          // no supported
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
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
      },getFileDataAsRegularArray:function (node) {
        if (node.contents && node.contents.subarray) {
          var arr = [];
          for (var i = 0; i < node.usedBytes; ++i) arr.push(node.contents[i]);
          return arr; // Returns a copy of the original data.
        }
        return node.contents; // No-op, the file contents are already in a JS array. Return as-is.
      },getFileDataAsTypedArray:function (node) {
        if (!node.contents) return new Uint8Array;
        if (node.contents.subarray) return node.contents.subarray(0, node.usedBytes); // Make sure to not return excess unused bytes.
        return new Uint8Array(node.contents);
      },expandFileStorage:function (node, newCapacity) {
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
      },resizeFileStorage:function (node, newSize) {
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
      },node_ops:{getattr:function (node) {
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
        },setattr:function (node, attr) {
          if (attr.mode !== undefined) {
            node.mode = attr.mode;
          }
          if (attr.timestamp !== undefined) {
            node.timestamp = attr.timestamp;
          }
          if (attr.size !== undefined) {
            MEMFS.resizeFileStorage(node, attr.size);
          }
        },lookup:function (parent, name) {
          throw FS.genericErrors[ERRNO_CODES.ENOENT];
        },mknod:function (parent, name, mode, dev) {
          return MEMFS.createNode(parent, name, mode, dev);
        },rename:function (old_node, new_dir, new_name) {
          // if we're overwriting a directory at new_name, make sure it's empty.
          if (FS.isDir(old_node.mode)) {
            var new_node;
            try {
              new_node = FS.lookupNode(new_dir, new_name);
            } catch (e) {
            }
            if (new_node) {
              for (var i in new_node.contents) {
                throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY);
              }
            }
          }
          // do the internal rewiring
          delete old_node.parent.contents[old_node.name];
          old_node.name = new_name;
          new_dir.contents[new_name] = old_node;
          old_node.parent = new_dir;
        },unlink:function (parent, name) {
          delete parent.contents[name];
        },rmdir:function (parent, name) {
          var node = FS.lookupNode(parent, name);
          for (var i in node.contents) {
            throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY);
          }
          delete parent.contents[name];
        },readdir:function (node) {
          var entries = ['.', '..']
          for (var key in node.contents) {
            if (!node.contents.hasOwnProperty(key)) {
              continue;
            }
            entries.push(key);
          }
          return entries;
        },symlink:function (parent, newname, oldpath) {
          var node = MEMFS.createNode(parent, newname, 511 /* 0777 */ | 40960, 0);
          node.link = oldpath;
          return node;
        },readlink:function (node) {
          if (!FS.isLink(node.mode)) {
            throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
          }
          return node.link;
        }},stream_ops:{read:function (stream, buffer, offset, length, position) {
          var contents = stream.node.contents;
          if (position >= stream.node.usedBytes) return 0;
          var size = Math.min(stream.node.usedBytes - position, length);
          assert(size >= 0);
          if (size > 8 && contents.subarray) { // non-trivial, and typed array
            buffer.set(contents.subarray(position, position + size), offset);
          } else {
            for (var i = 0; i < size; i++) buffer[offset + i] = contents[position + i];
          }
          return size;
        },write:function (stream, buffer, offset, length, position, canOwn) {
          // If memory can grow, we don't want to hold on to references of
          // the memory Buffer, as they may get invalidated. That means
          // we need to do a copy here.
          canOwn = false;
  
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
        },llseek:function (stream, offset, whence) {
          var position = offset;
          if (whence === 1) {  // SEEK_CUR.
            position += stream.position;
          } else if (whence === 2) {  // SEEK_END.
            if (FS.isFile(stream.node.mode)) {
              position += stream.node.usedBytes;
            }
          }
          if (position < 0) {
            throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
          }
          return position;
        },allocate:function (stream, offset, length) {
          MEMFS.expandFileStorage(stream.node, offset + length);
          stream.node.usedBytes = Math.max(stream.node.usedBytes, offset + length);
        },mmap:function (stream, buffer, offset, length, position, prot, flags) {
          if (!FS.isFile(stream.node.mode)) {
            throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
          }
          var ptr;
          var allocated;
          var contents = stream.node.contents;
          // Only make a new copy when MAP_PRIVATE is specified.
          if ( !(flags & 2) &&
                (contents.buffer === buffer || contents.buffer === buffer.buffer) ) {
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
            ptr = _malloc(length);
            if (!ptr) {
              throw new FS.ErrnoError(ERRNO_CODES.ENOMEM);
            }
            buffer.set(contents, ptr);
          }
          return { ptr: ptr, allocated: allocated };
        },msync:function (stream, buffer, offset, length, mmapFlags) {
          if (!FS.isFile(stream.node.mode)) {
            throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
          }
          if (mmapFlags & 2) {
            // MAP_PRIVATE calls need not to be synced back to underlying fs
            return 0;
          }
  
          var bytesWritten = MEMFS.stream_ops.write(stream, buffer, 0, length, offset, false);
          // should we check if bytesWritten and length are the same?
          return 0;
        }}};
  
  var IDBFS={dbs:{},indexedDB:function () {
        if (typeof indexedDB !== 'undefined') return indexedDB;
        var ret = null;
        if (typeof window === 'object') ret = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
        assert(ret, 'IDBFS used, but indexedDB not supported');
        return ret;
      },DB_VERSION:21,DB_STORE_NAME:"FILE_DATA",mount:function (mount) {
        // reuse all of the core MEMFS functionality
        return MEMFS.mount.apply(null, arguments);
      },syncfs:function (mount, populate, callback) {
        IDBFS.getLocalSet(mount, function(err, local) {
          if (err) return callback(err);
  
          IDBFS.getRemoteSet(mount, function(err, remote) {
            if (err) return callback(err);
  
            var src = populate ? remote : local;
            var dst = populate ? local : remote;
  
            IDBFS.reconcile(src, dst, callback);
          });
        });
      },getDB:function (name, callback) {
        // check the cache first
        var db = IDBFS.dbs[name];
        if (db) {
          return callback(null, db);
        }
  
        var req;
        try {
          req = IDBFS.indexedDB().open(name, IDBFS.DB_VERSION);
        } catch (e) {
          return callback(e);
        }
        if (!req) {
          return callback("Unable to connect to IndexedDB");
        }
        req.onupgradeneeded = function(e) {
          var db = e.target.result;
          var transaction = e.target.transaction;
  
          var fileStore;
  
          if (db.objectStoreNames.contains(IDBFS.DB_STORE_NAME)) {
            fileStore = transaction.objectStore(IDBFS.DB_STORE_NAME);
          } else {
            fileStore = db.createObjectStore(IDBFS.DB_STORE_NAME);
          }
  
          if (!fileStore.indexNames.contains('timestamp')) {
            fileStore.createIndex('timestamp', 'timestamp', { unique: false });
          }
        };
        req.onsuccess = function() {
          db = req.result;
  
          // add to the cache
          IDBFS.dbs[name] = db;
          callback(null, db);
        };
        req.onerror = function(e) {
          callback(this.error);
          e.preventDefault();
        };
      },getLocalSet:function (mount, callback) {
        var entries = {};
  
        function isRealDir(p) {
          return p !== '.' && p !== '..';
        };
        function toAbsolute(root) {
          return function(p) {
            return PATH.join2(root, p);
          }
        };
  
        var check = FS.readdir(mount.mountpoint).filter(isRealDir).map(toAbsolute(mount.mountpoint));
  
        while (check.length) {
          var path = check.pop();
          var stat;
  
          try {
            stat = FS.stat(path);
          } catch (e) {
            return callback(e);
          }
  
          if (FS.isDir(stat.mode)) {
            check.push.apply(check, FS.readdir(path).filter(isRealDir).map(toAbsolute(path)));
          }
  
          entries[path] = { timestamp: stat.mtime };
        }
  
        return callback(null, { type: 'local', entries: entries });
      },getRemoteSet:function (mount, callback) {
        var entries = {};
  
        IDBFS.getDB(mount.mountpoint, function(err, db) {
          if (err) return callback(err);
  
          try {
            var transaction = db.transaction([IDBFS.DB_STORE_NAME], 'readonly');
            transaction.onerror = function(e) {
              callback(this.error);
              e.preventDefault();
            };
  
            var store = transaction.objectStore(IDBFS.DB_STORE_NAME);
            var index = store.index('timestamp');
  
            index.openKeyCursor().onsuccess = function(event) {
              var cursor = event.target.result;
  
              if (!cursor) {
                return callback(null, { type: 'remote', db: db, entries: entries });
              }
  
              entries[cursor.primaryKey] = { timestamp: cursor.key };
  
              cursor.continue();
            };
          } catch (e) {
            return callback(e);
          }
        });
      },loadLocalEntry:function (path, callback) {
        var stat, node;
  
        try {
          var lookup = FS.lookupPath(path);
          node = lookup.node;
          stat = FS.stat(path);
        } catch (e) {
          return callback(e);
        }
  
        if (FS.isDir(stat.mode)) {
          return callback(null, { timestamp: stat.mtime, mode: stat.mode });
        } else if (FS.isFile(stat.mode)) {
          // Performance consideration: storing a normal JavaScript array to a IndexedDB is much slower than storing a typed array.
          // Therefore always convert the file contents to a typed array first before writing the data to IndexedDB.
          node.contents = MEMFS.getFileDataAsTypedArray(node);
          return callback(null, { timestamp: stat.mtime, mode: stat.mode, contents: node.contents });
        } else {
          return callback(new Error('node type not supported'));
        }
      },storeLocalEntry:function (path, entry, callback) {
        try {
          if (FS.isDir(entry.mode)) {
            FS.mkdir(path, entry.mode);
          } else if (FS.isFile(entry.mode)) {
            FS.writeFile(path, entry.contents, { canOwn: true });
          } else {
            return callback(new Error('node type not supported'));
          }
  
          FS.chmod(path, entry.mode);
          FS.utime(path, entry.timestamp, entry.timestamp);
        } catch (e) {
          return callback(e);
        }
  
        callback(null);
      },removeLocalEntry:function (path, callback) {
        try {
          var lookup = FS.lookupPath(path);
          var stat = FS.stat(path);
  
          if (FS.isDir(stat.mode)) {
            FS.rmdir(path);
          } else if (FS.isFile(stat.mode)) {
            FS.unlink(path);
          }
        } catch (e) {
          return callback(e);
        }
  
        callback(null);
      },loadRemoteEntry:function (store, path, callback) {
        var req = store.get(path);
        req.onsuccess = function(event) { callback(null, event.target.result); };
        req.onerror = function(e) {
          callback(this.error);
          e.preventDefault();
        };
      },storeRemoteEntry:function (store, path, entry, callback) {
        var req = store.put(entry, path);
        req.onsuccess = function() { callback(null); };
        req.onerror = function(e) {
          callback(this.error);
          e.preventDefault();
        };
      },removeRemoteEntry:function (store, path, callback) {
        var req = store.delete(path);
        req.onsuccess = function() { callback(null); };
        req.onerror = function(e) {
          callback(this.error);
          e.preventDefault();
        };
      },reconcile:function (src, dst, callback) {
        var total = 0;
  
        var create = [];
        Object.keys(src.entries).forEach(function (key) {
          var e = src.entries[key];
          var e2 = dst.entries[key];
          if (!e2 || e.timestamp > e2.timestamp) {
            create.push(key);
            total++;
          }
        });
  
        var remove = [];
        Object.keys(dst.entries).forEach(function (key) {
          var e = dst.entries[key];
          var e2 = src.entries[key];
          if (!e2) {
            remove.push(key);
            total++;
          }
        });
  
        if (!total) {
          return callback(null);
        }
  
        var errored = false;
        var completed = 0;
        var db = src.type === 'remote' ? src.db : dst.db;
        var transaction = db.transaction([IDBFS.DB_STORE_NAME], 'readwrite');
        var store = transaction.objectStore(IDBFS.DB_STORE_NAME);
  
        function done(err) {
          if (err) {
            if (!done.errored) {
              done.errored = true;
              return callback(err);
            }
            return;
          }
          if (++completed >= total) {
            return callback(null);
          }
        };
  
        transaction.onerror = function(e) {
          done(this.error);
          e.preventDefault();
        };
  
        // sort paths in ascending order so directory entries are created
        // before the files inside them
        create.sort().forEach(function (path) {
          if (dst.type === 'local') {
            IDBFS.loadRemoteEntry(store, path, function (err, entry) {
              if (err) return done(err);
              IDBFS.storeLocalEntry(path, entry, done);
            });
          } else {
            IDBFS.loadLocalEntry(path, function (err, entry) {
              if (err) return done(err);
              IDBFS.storeRemoteEntry(store, path, entry, done);
            });
          }
        });
  
        // sort paths in descending order so files are deleted before their
        // parent directories
        remove.sort().reverse().forEach(function(path) {
          if (dst.type === 'local') {
            IDBFS.removeLocalEntry(path, done);
          } else {
            IDBFS.removeRemoteEntry(store, path, done);
          }
        });
      }};
  
  var NODEFS={isWindows:false,staticInit:function () {
        NODEFS.isWindows = !!process.platform.match(/^win/);
        var flags = process["binding"]("constants");
        // Node.js 4 compatibility: it has no namespaces for constants
        if (flags["fs"]) {
          flags = flags["fs"];
        }
        NODEFS.flagsForNodeMap = {
          "1024": flags["O_APPEND"],
          "64": flags["O_CREAT"],
          "128": flags["O_EXCL"],
          "0": flags["O_RDONLY"],
          "2": flags["O_RDWR"],
          "4096": flags["O_SYNC"],
          "512": flags["O_TRUNC"],
          "1": flags["O_WRONLY"]
        };
      },bufferFrom:function (arrayBuffer) {
        // Node.js < 4.5 compatibility: Buffer.from does not support ArrayBuffer
        // Buffer.from before 4.5 was just a method inherited from Uint8Array
        // Buffer.alloc has been added with Buffer.from together, so check it instead
        return Buffer.alloc ? Buffer.from(arrayBuffer) : new Buffer(arrayBuffer);
      },mount:function (mount) {
        assert(ENVIRONMENT_IS_NODE);
        return NODEFS.createNode(null, '/', NODEFS.getMode(mount.opts.root), 0);
      },createNode:function (parent, name, mode, dev) {
        if (!FS.isDir(mode) && !FS.isFile(mode) && !FS.isLink(mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        var node = FS.createNode(parent, name, mode);
        node.node_ops = NODEFS.node_ops;
        node.stream_ops = NODEFS.stream_ops;
        return node;
      },getMode:function (path) {
        var stat;
        try {
          stat = fs.lstatSync(path);
          if (NODEFS.isWindows) {
            // Node.js on Windows never represents permission bit 'x', so
            // propagate read bits to execute bits
            stat.mode = stat.mode | ((stat.mode & 292) >> 2);
          }
        } catch (e) {
          if (!e.code) throw e;
          throw new FS.ErrnoError(ERRNO_CODES[e.code]);
        }
        return stat.mode;
      },realPath:function (node) {
        var parts = [];
        while (node.parent !== node) {
          parts.push(node.name);
          node = node.parent;
        }
        parts.push(node.mount.opts.root);
        parts.reverse();
        return PATH.join.apply(null, parts);
      },flagsForNode:function (flags) {
        flags &= ~0x200000 /*O_PATH*/; // Ignore this flag from musl, otherwise node.js fails to open the file.
        flags &= ~0x800 /*O_NONBLOCK*/; // Ignore this flag from musl, otherwise node.js fails to open the file.
        flags &= ~0x8000 /*O_LARGEFILE*/; // Ignore this flag from musl, otherwise node.js fails to open the file.
        flags &= ~0x80000 /*O_CLOEXEC*/; // Some applications may pass it; it makes no sense for a single process.
        var newFlags = 0;
        for (var k in NODEFS.flagsForNodeMap) {
          if (flags & k) {
            newFlags |= NODEFS.flagsForNodeMap[k];
            flags ^= k;
          }
        }
  
        if (!flags) {
          return newFlags;
        } else {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
      },node_ops:{getattr:function (node) {
          var path = NODEFS.realPath(node);
          var stat;
          try {
            stat = fs.lstatSync(path);
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
          // node.js v0.10.20 doesn't report blksize and blocks on Windows. Fake them with default blksize of 4096.
          // See http://support.microsoft.com/kb/140365
          if (NODEFS.isWindows && !stat.blksize) {
            stat.blksize = 4096;
          }
          if (NODEFS.isWindows && !stat.blocks) {
            stat.blocks = (stat.size+stat.blksize-1)/stat.blksize|0;
          }
          return {
            dev: stat.dev,
            ino: stat.ino,
            mode: stat.mode,
            nlink: stat.nlink,
            uid: stat.uid,
            gid: stat.gid,
            rdev: stat.rdev,
            size: stat.size,
            atime: stat.atime,
            mtime: stat.mtime,
            ctime: stat.ctime,
            blksize: stat.blksize,
            blocks: stat.blocks
          };
        },setattr:function (node, attr) {
          var path = NODEFS.realPath(node);
          try {
            if (attr.mode !== undefined) {
              fs.chmodSync(path, attr.mode);
              // update the common node structure mode as well
              node.mode = attr.mode;
            }
            if (attr.timestamp !== undefined) {
              var date = new Date(attr.timestamp);
              fs.utimesSync(path, date, date);
            }
            if (attr.size !== undefined) {
              fs.truncateSync(path, attr.size);
            }
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },lookup:function (parent, name) {
          var path = PATH.join2(NODEFS.realPath(parent), name);
          var mode = NODEFS.getMode(path);
          return NODEFS.createNode(parent, name, mode);
        },mknod:function (parent, name, mode, dev) {
          var node = NODEFS.createNode(parent, name, mode, dev);
          // create the backing node for this in the fs root as well
          var path = NODEFS.realPath(node);
          try {
            if (FS.isDir(node.mode)) {
              fs.mkdirSync(path, node.mode);
            } else {
              fs.writeFileSync(path, '', { mode: node.mode });
            }
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
          return node;
        },rename:function (oldNode, newDir, newName) {
          var oldPath = NODEFS.realPath(oldNode);
          var newPath = PATH.join2(NODEFS.realPath(newDir), newName);
          try {
            fs.renameSync(oldPath, newPath);
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },unlink:function (parent, name) {
          var path = PATH.join2(NODEFS.realPath(parent), name);
          try {
            fs.unlinkSync(path);
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },rmdir:function (parent, name) {
          var path = PATH.join2(NODEFS.realPath(parent), name);
          try {
            fs.rmdirSync(path);
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },readdir:function (node) {
          var path = NODEFS.realPath(node);
          try {
            return fs.readdirSync(path);
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },symlink:function (parent, newName, oldPath) {
          var newPath = PATH.join2(NODEFS.realPath(parent), newName);
          try {
            fs.symlinkSync(oldPath, newPath);
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },readlink:function (node) {
          var path = NODEFS.realPath(node);
          try {
            path = fs.readlinkSync(path);
            path = NODEJS_PATH.relative(NODEJS_PATH.resolve(node.mount.opts.root), path);
            return path;
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        }},stream_ops:{open:function (stream) {
          var path = NODEFS.realPath(stream.node);
          try {
            if (FS.isFile(stream.node.mode)) {
              stream.nfd = fs.openSync(path, NODEFS.flagsForNode(stream.flags));
            }
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },close:function (stream) {
          try {
            if (FS.isFile(stream.node.mode) && stream.nfd) {
              fs.closeSync(stream.nfd);
            }
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },read:function (stream, buffer, offset, length, position) {
          // Node.js < 6 compatibility: node errors on 0 length reads
          if (length === 0) return 0;
          try {
            return fs.readSync(stream.nfd, NODEFS.bufferFrom(buffer.buffer), offset, length, position);
          } catch (e) {
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },write:function (stream, buffer, offset, length, position) {
          try {
            return fs.writeSync(stream.nfd, NODEFS.bufferFrom(buffer.buffer), offset, length, position);
          } catch (e) {
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },llseek:function (stream, offset, whence) {
          var position = offset;
          if (whence === 1) {  // SEEK_CUR.
            position += stream.position;
          } else if (whence === 2) {  // SEEK_END.
            if (FS.isFile(stream.node.mode)) {
              try {
                var stat = fs.fstatSync(stream.nfd);
                position += stat.size;
              } catch (e) {
                throw new FS.ErrnoError(ERRNO_CODES[e.code]);
              }
            }
          }
  
          if (position < 0) {
            throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
          }
  
          return position;
        }}};
  
  var WORKERFS={DIR_MODE:16895,FILE_MODE:33279,reader:null,mount:function (mount) {
        assert(ENVIRONMENT_IS_WORKER);
        if (!WORKERFS.reader) WORKERFS.reader = new FileReaderSync();
        var root = WORKERFS.createNode(null, '/', WORKERFS.DIR_MODE, 0);
        var createdParents = {};
        function ensureParent(path) {
          // return the parent node, creating subdirs as necessary
          var parts = path.split('/');
          var parent = root;
          for (var i = 0; i < parts.length-1; i++) {
            var curr = parts.slice(0, i+1).join('/');
            // Issue 4254: Using curr as a node name will prevent the node
            // from being found in FS.nameTable when FS.open is called on
            // a path which holds a child of this node,
            // given that all FS functions assume node names
            // are just their corresponding parts within their given path,
            // rather than incremental aggregates which include their parent's
            // directories.
            if (!createdParents[curr]) {
              createdParents[curr] = WORKERFS.createNode(parent, parts[i], WORKERFS.DIR_MODE, 0);
            }
            parent = createdParents[curr];
          }
          return parent;
        }
        function base(path) {
          var parts = path.split('/');
          return parts[parts.length-1];
        }
        // We also accept FileList here, by using Array.prototype
        Array.prototype.forEach.call(mount.opts["files"] || [], function(file) {
          WORKERFS.createNode(ensureParent(file.name), base(file.name), WORKERFS.FILE_MODE, 0, file, file.lastModifiedDate);
        });
        (mount.opts["blobs"] || []).forEach(function(obj) {
          WORKERFS.createNode(ensureParent(obj["name"]), base(obj["name"]), WORKERFS.FILE_MODE, 0, obj["data"]);
        });
        (mount.opts["packages"] || []).forEach(function(pack) {
          pack['metadata'].files.forEach(function(file) {
            var name = file.filename.substr(1); // remove initial slash
            WORKERFS.createNode(ensureParent(name), base(name), WORKERFS.FILE_MODE, 0, pack['blob'].slice(file.start, file.end));
          });
        });
        return root;
      },createNode:function (parent, name, mode, dev, contents, mtime) {
        var node = FS.createNode(parent, name, mode);
        node.mode = mode;
        node.node_ops = WORKERFS.node_ops;
        node.stream_ops = WORKERFS.stream_ops;
        node.timestamp = (mtime || new Date).getTime();
        assert(WORKERFS.FILE_MODE !== WORKERFS.DIR_MODE);
        if (mode === WORKERFS.FILE_MODE) {
          node.size = contents.size;
          node.contents = contents;
        } else {
          node.size = 4096;
          node.contents = {};
        }
        if (parent) {
          parent.contents[name] = node;
        }
        return node;
      },node_ops:{getattr:function (node) {
          return {
            dev: 1,
            ino: undefined,
            mode: node.mode,
            nlink: 1,
            uid: 0,
            gid: 0,
            rdev: undefined,
            size: node.size,
            atime: new Date(node.timestamp),
            mtime: new Date(node.timestamp),
            ctime: new Date(node.timestamp),
            blksize: 4096,
            blocks: Math.ceil(node.size / 4096),
          };
        },setattr:function (node, attr) {
          if (attr.mode !== undefined) {
            node.mode = attr.mode;
          }
          if (attr.timestamp !== undefined) {
            node.timestamp = attr.timestamp;
          }
        },lookup:function (parent, name) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
        },mknod:function (parent, name, mode, dev) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        },rename:function (oldNode, newDir, newName) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        },unlink:function (parent, name) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        },rmdir:function (parent, name) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        },readdir:function (node) {
          var entries = ['.', '..'];
          for (var key in node.contents) {
            if (!node.contents.hasOwnProperty(key)) {
              continue;
            }
            entries.push(key);
          }
          return entries;
        },symlink:function (parent, newName, oldPath) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        },readlink:function (node) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }},stream_ops:{read:function (stream, buffer, offset, length, position) {
          if (position >= stream.node.size) return 0;
          var chunk = stream.node.contents.slice(position, position + length);
          var ab = WORKERFS.reader.readAsArrayBuffer(chunk);
          buffer.set(new Uint8Array(ab), offset);
          return chunk.size;
        },write:function (stream, buffer, offset, length, position) {
          throw new FS.ErrnoError(ERRNO_CODES.EIO);
        },llseek:function (stream, offset, whence) {
          var position = offset;
          if (whence === 1) {  // SEEK_CUR.
            position += stream.position;
          } else if (whence === 2) {  // SEEK_END.
            if (FS.isFile(stream.node.mode)) {
              position += stream.node.size;
            }
          }
          if (position < 0) {
            throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
          }
          return position;
        }}};
  
  var _stdin=51216;
  
  var _stdout=51232;
  
  var _stderr=51248;var FS={root:null,mounts:[],devices:{},streams:[],nextInode:1,nameTable:null,currentPath:"/",initialized:false,ignorePermissions:true,trackingDelegate:{},tracking:{openFlags:{READ:1,WRITE:2}},ErrnoError:null,genericErrors:{},filesystems:null,syncFSRequests:0,handleFSError:function (e) {
        if (!(e instanceof FS.ErrnoError)) throw e + ' : ' + stackTrace();
        return ___setErrNo(e.errno);
      },lookupPath:function (path, opts) {
        path = PATH.resolve(FS.cwd(), path);
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
          throw new FS.ErrnoError(40);
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
              current_path = PATH.resolve(PATH.dirname(current_path), link);
  
              var lookup = FS.lookupPath(current_path, { recurse_count: opts.recurse_count });
              current = lookup.node;
  
              if (count++ > 40) {  // limit max consecutive symlinks to 40 (SYMLOOP_MAX).
                throw new FS.ErrnoError(40);
              }
            }
          }
        }
  
        return { path: current_path, node: current };
      },getPath:function (node) {
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
      },hashName:function (parentid, name) {
        var hash = 0;
  
  
        for (var i = 0; i < name.length; i++) {
          hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
        }
        return ((parentid + hash) >>> 0) % FS.nameTable.length;
      },hashAddNode:function (node) {
        var hash = FS.hashName(node.parent.id, node.name);
        node.name_next = FS.nameTable[hash];
        FS.nameTable[hash] = node;
      },hashRemoveNode:function (node) {
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
      },lookupNode:function (parent, name) {
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
      },createNode:function (parent, name, mode, rdev) {
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
      },destroyNode:function (node) {
        FS.hashRemoveNode(node);
      },isRoot:function (node) {
        return node === node.parent;
      },isMountpoint:function (node) {
        return !!node.mounted;
      },isFile:function (mode) {
        return (mode & 61440) === 32768;
      },isDir:function (mode) {
        return (mode & 61440) === 16384;
      },isLink:function (mode) {
        return (mode & 61440) === 40960;
      },isChrdev:function (mode) {
        return (mode & 61440) === 8192;
      },isBlkdev:function (mode) {
        return (mode & 61440) === 24576;
      },isFIFO:function (mode) {
        return (mode & 61440) === 4096;
      },isSocket:function (mode) {
        return (mode & 49152) === 49152;
      },flagModes:{"r":0,"rs":1052672,"r+":2,"w":577,"wx":705,"xw":705,"w+":578,"wx+":706,"xw+":706,"a":1089,"ax":1217,"xa":1217,"a+":1090,"ax+":1218,"xa+":1218},modeStringToFlags:function (str) {
        var flags = FS.flagModes[str];
        if (typeof flags === 'undefined') {
          throw new Error('Unknown file open mode: ' + str);
        }
        return flags;
      },flagsToPermissionString:function (flag) {
        var perms = ['r', 'w', 'rw'][flag & 3];
        if ((flag & 512)) {
          perms += 'w';
        }
        return perms;
      },nodePermissions:function (node, perms) {
        if (FS.ignorePermissions) {
          return 0;
        }
        // return 0 if any user, group or owner bits are set.
        if (perms.indexOf('r') !== -1 && !(node.mode & 292)) {
          return 13;
        } else if (perms.indexOf('w') !== -1 && !(node.mode & 146)) {
          return 13;
        } else if (perms.indexOf('x') !== -1 && !(node.mode & 73)) {
          return 13;
        }
        return 0;
      },mayLookup:function (dir) {
        var err = FS.nodePermissions(dir, 'x');
        if (err) return err;
        if (!dir.node_ops.lookup) return 13;
        return 0;
      },mayCreate:function (dir, name) {
        try {
          var node = FS.lookupNode(dir, name);
          return 17;
        } catch (e) {
        }
        return FS.nodePermissions(dir, 'wx');
      },mayDelete:function (dir, name, isdir) {
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
            return 20;
          }
          if (FS.isRoot(node) || FS.getPath(node) === FS.cwd()) {
            return 16;
          }
        } else {
          if (FS.isDir(node.mode)) {
            return 21;
          }
        }
        return 0;
      },mayOpen:function (node, flags) {
        if (!node) {
          return 2;
        }
        if (FS.isLink(node.mode)) {
          return 40;
        } else if (FS.isDir(node.mode)) {
          if (FS.flagsToPermissionString(flags) !== 'r' || // opening for write
              (flags & 512)) { // TODO: check for O_SEARCH? (== search for dir only)
            return 21;
          }
        }
        return FS.nodePermissions(node, FS.flagsToPermissionString(flags));
      },MAX_OPEN_FDS:4096,nextfd:function (fd_start, fd_end) {
        fd_start = fd_start || 0;
        fd_end = fd_end || FS.MAX_OPEN_FDS;
        for (var fd = fd_start; fd <= fd_end; fd++) {
          if (!FS.streams[fd]) {
            return fd;
          }
        }
        throw new FS.ErrnoError(24);
      },getStream:function (fd) {
        return FS.streams[fd];
      },createStream:function (stream, fd_start, fd_end) {
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
      },closeStream:function (fd) {
        FS.streams[fd] = null;
      },chrdev_stream_ops:{open:function (stream) {
          var device = FS.getDevice(stream.node.rdev);
          // override node's stream ops with the device's
          stream.stream_ops = device.stream_ops;
          // forward the open call
          if (stream.stream_ops.open) {
            stream.stream_ops.open(stream);
          }
        },llseek:function () {
          throw new FS.ErrnoError(29);
        }},major:function (dev) {
        return ((dev) >> 8);
      },minor:function (dev) {
        return ((dev) & 0xff);
      },makedev:function (ma, mi) {
        return ((ma) << 8 | (mi));
      },registerDevice:function (dev, ops) {
        FS.devices[dev] = { stream_ops: ops };
      },getDevice:function (dev) {
        return FS.devices[dev];
      },getMounts:function (mount) {
        var mounts = [];
        var check = [mount];
  
        while (check.length) {
          var m = check.pop();
  
          mounts.push(m);
  
          check.push.apply(check, m.mounts);
        }
  
        return mounts;
      },syncfs:function (populate, callback) {
        if (typeof(populate) === 'function') {
          callback = populate;
          populate = false;
        }
  
        FS.syncFSRequests++;
  
        if (FS.syncFSRequests > 1) {
          console.log('warning: ' + FS.syncFSRequests + ' FS.syncfs operations in flight at once, probably just doing extra work');
        }
  
        var mounts = FS.getMounts(FS.root.mount);
        var completed = 0;
  
        function doCallback(err) {
          assert(FS.syncFSRequests > 0);
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
      },mount:function (type, opts, mountpoint) {
        var root = mountpoint === '/';
        var pseudo = !mountpoint;
        var node;
  
        if (root && FS.root) {
          throw new FS.ErrnoError(16);
        } else if (!root && !pseudo) {
          var lookup = FS.lookupPath(mountpoint, { follow_mount: false });
  
          mountpoint = lookup.path;  // use the absolute path
          node = lookup.node;
  
          if (FS.isMountpoint(node)) {
            throw new FS.ErrnoError(16);
          }
  
          if (!FS.isDir(node.mode)) {
            throw new FS.ErrnoError(20);
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
          throw new FS.ErrnoError(22);
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
        assert(idx !== -1);
        node.mount.mounts.splice(idx, 1);
      },lookup:function (parent, name) {
        return parent.node_ops.lookup(parent, name);
      },mknod:function (path, mode, dev) {
        var lookup = FS.lookupPath(path, { parent: true });
        var parent = lookup.node;
        var name = PATH.basename(path);
        if (!name || name === '.' || name === '..') {
          throw new FS.ErrnoError(22);
        }
        var err = FS.mayCreate(parent, name);
        if (err) {
          throw new FS.ErrnoError(err);
        }
        if (!parent.node_ops.mknod) {
          throw new FS.ErrnoError(1);
        }
        return parent.node_ops.mknod(parent, name, mode, dev);
      },create:function (path, mode) {
        mode = mode !== undefined ? mode : 438 /* 0666 */;
        mode &= 4095;
        mode |= 32768;
        return FS.mknod(path, mode, 0);
      },mkdir:function (path, mode) {
        mode = mode !== undefined ? mode : 511 /* 0777 */;
        mode &= 511 | 512;
        mode |= 16384;
        return FS.mknod(path, mode, 0);
      },mkdirTree:function (path, mode) {
        var dirs = path.split('/');
        var d = '';
        for (var i = 0; i < dirs.length; ++i) {
          if (!dirs[i]) continue;
          d += '/' + dirs[i];
          try {
            FS.mkdir(d, mode);
          } catch(e) {
            if (e.errno != 17) throw e;
          }
        }
      },mkdev:function (path, mode, dev) {
        if (typeof(dev) === 'undefined') {
          dev = mode;
          mode = 438 /* 0666 */;
        }
        mode |= 8192;
        return FS.mknod(path, mode, dev);
      },symlink:function (oldpath, newpath) {
        if (!PATH.resolve(oldpath)) {
          throw new FS.ErrnoError(2);
        }
        var lookup = FS.lookupPath(newpath, { parent: true });
        var parent = lookup.node;
        if (!parent) {
          throw new FS.ErrnoError(2);
        }
        var newname = PATH.basename(newpath);
        var err = FS.mayCreate(parent, newname);
        if (err) {
          throw new FS.ErrnoError(err);
        }
        if (!parent.node_ops.symlink) {
          throw new FS.ErrnoError(1);
        }
        return parent.node_ops.symlink(parent, newname, oldpath);
      },rename:function (old_path, new_path) {
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
          throw new FS.ErrnoError(16);
        }
        if (!old_dir || !new_dir) throw new FS.ErrnoError(2);
        // need to be part of the same mount
        if (old_dir.mount !== new_dir.mount) {
          throw new FS.ErrnoError(18);
        }
        // source must exist
        var old_node = FS.lookupNode(old_dir, old_name);
        // old path should not be an ancestor of the new path
        var relative = PATH.relative(old_path, new_dirname);
        if (relative.charAt(0) !== '.') {
          throw new FS.ErrnoError(22);
        }
        // new path should not be an ancestor of the old path
        relative = PATH.relative(new_path, old_dirname);
        if (relative.charAt(0) !== '.') {
          throw new FS.ErrnoError(39);
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
          throw new FS.ErrnoError(1);
        }
        if (FS.isMountpoint(old_node) || (new_node && FS.isMountpoint(new_node))) {
          throw new FS.ErrnoError(16);
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
          console.log("FS.trackingDelegate['willMovePath']('"+old_path+"', '"+new_path+"') threw an exception: " + e.message);
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
          console.log("FS.trackingDelegate['onMovePath']('"+old_path+"', '"+new_path+"') threw an exception: " + e.message);
        }
      },rmdir:function (path) {
        var lookup = FS.lookupPath(path, { parent: true });
        var parent = lookup.node;
        var name = PATH.basename(path);
        var node = FS.lookupNode(parent, name);
        var err = FS.mayDelete(parent, name, true);
        if (err) {
          throw new FS.ErrnoError(err);
        }
        if (!parent.node_ops.rmdir) {
          throw new FS.ErrnoError(1);
        }
        if (FS.isMountpoint(node)) {
          throw new FS.ErrnoError(16);
        }
        try {
          if (FS.trackingDelegate['willDeletePath']) {
            FS.trackingDelegate['willDeletePath'](path);
          }
        } catch(e) {
          console.log("FS.trackingDelegate['willDeletePath']('"+path+"') threw an exception: " + e.message);
        }
        parent.node_ops.rmdir(parent, name);
        FS.destroyNode(node);
        try {
          if (FS.trackingDelegate['onDeletePath']) FS.trackingDelegate['onDeletePath'](path);
        } catch(e) {
          console.log("FS.trackingDelegate['onDeletePath']('"+path+"') threw an exception: " + e.message);
        }
      },readdir:function (path) {
        var lookup = FS.lookupPath(path, { follow: true });
        var node = lookup.node;
        if (!node.node_ops.readdir) {
          throw new FS.ErrnoError(20);
        }
        return node.node_ops.readdir(node);
      },unlink:function (path) {
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
          throw new FS.ErrnoError(1);
        }
        if (FS.isMountpoint(node)) {
          throw new FS.ErrnoError(16);
        }
        try {
          if (FS.trackingDelegate['willDeletePath']) {
            FS.trackingDelegate['willDeletePath'](path);
          }
        } catch(e) {
          console.log("FS.trackingDelegate['willDeletePath']('"+path+"') threw an exception: " + e.message);
        }
        parent.node_ops.unlink(parent, name);
        FS.destroyNode(node);
        try {
          if (FS.trackingDelegate['onDeletePath']) FS.trackingDelegate['onDeletePath'](path);
        } catch(e) {
          console.log("FS.trackingDelegate['onDeletePath']('"+path+"') threw an exception: " + e.message);
        }
      },readlink:function (path) {
        var lookup = FS.lookupPath(path);
        var link = lookup.node;
        if (!link) {
          throw new FS.ErrnoError(2);
        }
        if (!link.node_ops.readlink) {
          throw new FS.ErrnoError(22);
        }
        return PATH.resolve(FS.getPath(link.parent), link.node_ops.readlink(link));
      },stat:function (path, dontFollow) {
        var lookup = FS.lookupPath(path, { follow: !dontFollow });
        var node = lookup.node;
        if (!node) {
          throw new FS.ErrnoError(2);
        }
        if (!node.node_ops.getattr) {
          throw new FS.ErrnoError(1);
        }
        return node.node_ops.getattr(node);
      },lstat:function (path) {
        return FS.stat(path, true);
      },chmod:function (path, mode, dontFollow) {
        var node;
        if (typeof path === 'string') {
          var lookup = FS.lookupPath(path, { follow: !dontFollow });
          node = lookup.node;
        } else {
          node = path;
        }
        if (!node.node_ops.setattr) {
          throw new FS.ErrnoError(1);
        }
        node.node_ops.setattr(node, {
          mode: (mode & 4095) | (node.mode & ~4095),
          timestamp: Date.now()
        });
      },lchmod:function (path, mode) {
        FS.chmod(path, mode, true);
      },fchmod:function (fd, mode) {
        var stream = FS.getStream(fd);
        if (!stream) {
          throw new FS.ErrnoError(9);
        }
        FS.chmod(stream.node, mode);
      },chown:function (path, uid, gid, dontFollow) {
        var node;
        if (typeof path === 'string') {
          var lookup = FS.lookupPath(path, { follow: !dontFollow });
          node = lookup.node;
        } else {
          node = path;
        }
        if (!node.node_ops.setattr) {
          throw new FS.ErrnoError(1);
        }
        node.node_ops.setattr(node, {
          timestamp: Date.now()
          // we ignore the uid / gid for now
        });
      },lchown:function (path, uid, gid) {
        FS.chown(path, uid, gid, true);
      },fchown:function (fd, uid, gid) {
        var stream = FS.getStream(fd);
        if (!stream) {
          throw new FS.ErrnoError(9);
        }
        FS.chown(stream.node, uid, gid);
      },truncate:function (path, len) {
        if (len < 0) {
          throw new FS.ErrnoError(22);
        }
        var node;
        if (typeof path === 'string') {
          var lookup = FS.lookupPath(path, { follow: true });
          node = lookup.node;
        } else {
          node = path;
        }
        if (!node.node_ops.setattr) {
          throw new FS.ErrnoError(1);
        }
        if (FS.isDir(node.mode)) {
          throw new FS.ErrnoError(21);
        }
        if (!FS.isFile(node.mode)) {
          throw new FS.ErrnoError(22);
        }
        var err = FS.nodePermissions(node, 'w');
        if (err) {
          throw new FS.ErrnoError(err);
        }
        node.node_ops.setattr(node, {
          size: len,
          timestamp: Date.now()
        });
      },ftruncate:function (fd, len) {
        var stream = FS.getStream(fd);
        if (!stream) {
          throw new FS.ErrnoError(9);
        }
        if ((stream.flags & 2097155) === 0) {
          throw new FS.ErrnoError(22);
        }
        FS.truncate(stream.node, len);
      },utime:function (path, atime, mtime) {
        var lookup = FS.lookupPath(path, { follow: true });
        var node = lookup.node;
        node.node_ops.setattr(node, {
          timestamp: Math.max(atime, mtime)
        });
      },open:function (path, flags, mode, fd_start, fd_end) {
        if (path === "") {
          throw new FS.ErrnoError(2);
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
              throw new FS.ErrnoError(17);
            }
          } else {
            // node doesn't exist, try to create it
            node = FS.mknod(path, mode, 0);
            created = true;
          }
        }
        if (!node) {
          throw new FS.ErrnoError(2);
        }
        // can't truncate a device
        if (FS.isChrdev(node.mode)) {
          flags &= ~512;
        }
        // if asked only for a directory, then this must be one
        if ((flags & 65536) && !FS.isDir(node.mode)) {
          throw new FS.ErrnoError(20);
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
            console.log("FS.trackingDelegate error on read file: " + path);
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
          console.log("FS.trackingDelegate['onOpenFile']('"+path+"', flags) threw an exception: " + e.message);
        }
        return stream;
      },close:function (stream) {
        if (FS.isClosed(stream)) {
          throw new FS.ErrnoError(9);
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
      },isClosed:function (stream) {
        return stream.fd === null;
      },llseek:function (stream, offset, whence) {
        if (FS.isClosed(stream)) {
          throw new FS.ErrnoError(9);
        }
        if (!stream.seekable || !stream.stream_ops.llseek) {
          throw new FS.ErrnoError(29);
        }
        if (whence != 0 /* SEEK_SET */ && whence != 1 /* SEEK_CUR */ && whence != 2 /* SEEK_END */) {
          throw new FS.ErrnoError(22);
        }
        stream.position = stream.stream_ops.llseek(stream, offset, whence);
        stream.ungotten = [];
        return stream.position;
      },read:function (stream, buffer, offset, length, position) {
        if (length < 0 || position < 0) {
          throw new FS.ErrnoError(22);
        }
        if (FS.isClosed(stream)) {
          throw new FS.ErrnoError(9);
        }
        if ((stream.flags & 2097155) === 1) {
          throw new FS.ErrnoError(9);
        }
        if (FS.isDir(stream.node.mode)) {
          throw new FS.ErrnoError(21);
        }
        if (!stream.stream_ops.read) {
          throw new FS.ErrnoError(22);
        }
        var seeking = typeof position !== 'undefined';
        if (!seeking) {
          position = stream.position;
        } else if (!stream.seekable) {
          throw new FS.ErrnoError(29);
        }
        var bytesRead = stream.stream_ops.read(stream, buffer, offset, length, position);
        if (!seeking) stream.position += bytesRead;
        return bytesRead;
      },write:function (stream, buffer, offset, length, position, canOwn) {
        if (length < 0 || position < 0) {
          throw new FS.ErrnoError(22);
        }
        if (FS.isClosed(stream)) {
          throw new FS.ErrnoError(9);
        }
        if ((stream.flags & 2097155) === 0) {
          throw new FS.ErrnoError(9);
        }
        if (FS.isDir(stream.node.mode)) {
          throw new FS.ErrnoError(21);
        }
        if (!stream.stream_ops.write) {
          throw new FS.ErrnoError(22);
        }
        if (stream.flags & 1024) {
          // seek to the end before writing in append mode
          FS.llseek(stream, 0, 2);
        }
        var seeking = typeof position !== 'undefined';
        if (!seeking) {
          position = stream.position;
        } else if (!stream.seekable) {
          throw new FS.ErrnoError(29);
        }
        var bytesWritten = stream.stream_ops.write(stream, buffer, offset, length, position, canOwn);
        if (!seeking) stream.position += bytesWritten;
        try {
          if (stream.path && FS.trackingDelegate['onWriteToFile']) FS.trackingDelegate['onWriteToFile'](stream.path);
        } catch(e) {
          console.log("FS.trackingDelegate['onWriteToFile']('"+stream.path+"') threw an exception: " + e.message);
        }
        return bytesWritten;
      },allocate:function (stream, offset, length) {
        if (FS.isClosed(stream)) {
          throw new FS.ErrnoError(9);
        }
        if (offset < 0 || length <= 0) {
          throw new FS.ErrnoError(22);
        }
        if ((stream.flags & 2097155) === 0) {
          throw new FS.ErrnoError(9);
        }
        if (!FS.isFile(stream.node.mode) && !FS.isDir(stream.node.mode)) {
          throw new FS.ErrnoError(19);
        }
        if (!stream.stream_ops.allocate) {
          throw new FS.ErrnoError(95);
        }
        stream.stream_ops.allocate(stream, offset, length);
      },mmap:function (stream, buffer, offset, length, position, prot, flags) {
        // TODO if PROT is PROT_WRITE, make sure we have write access
        if ((stream.flags & 2097155) === 1) {
          throw new FS.ErrnoError(13);
        }
        if (!stream.stream_ops.mmap) {
          throw new FS.ErrnoError(19);
        }
        return stream.stream_ops.mmap(stream, buffer, offset, length, position, prot, flags);
      },msync:function (stream, buffer, offset, length, mmapFlags) {
        if (!stream || !stream.stream_ops.msync) {
          return 0;
        }
        return stream.stream_ops.msync(stream, buffer, offset, length, mmapFlags);
      },munmap:function (stream) {
        return 0;
      },ioctl:function (stream, cmd, arg) {
        if (!stream.stream_ops.ioctl) {
          throw new FS.ErrnoError(25);
        }
        return stream.stream_ops.ioctl(stream, cmd, arg);
      },readFile:function (path, opts) {
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
      },writeFile:function (path, data, opts) {
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
      },cwd:function () {
        return FS.currentPath;
      },chdir:function (path) {
        var lookup = FS.lookupPath(path, { follow: true });
        if (lookup.node === null) {
          throw new FS.ErrnoError(2);
        }
        if (!FS.isDir(lookup.node.mode)) {
          throw new FS.ErrnoError(20);
        }
        var err = FS.nodePermissions(lookup.node, 'x');
        if (err) {
          throw new FS.ErrnoError(err);
        }
        FS.currentPath = lookup.path;
      },createDefaultDirectories:function () {
        FS.mkdir('/tmp');
        FS.mkdir('/home');
        FS.mkdir('/home/web_user');
      },createDefaultDevices:function () {
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
        } else if (ENVIRONMENT_IS_NODE) {
          // for nodejs with or without crypto support included
          try {
              var crypto_module = require('crypto');
              // nodejs has crypto support
              random_device = function() { return crypto_module['randomBytes'](1)[0]; };
          } catch (e) {
              // nodejs doesn't have crypto support so fallback to Math.random
              random_device = function() { return (Math.random()*256)|0; };
          }
        } else {
          // default for ES5 platforms
          random_device = function() { abort("random_device"); /*Math.random() is not safe for random number generation, so this fallback random_device implementation aborts... see emscripten-core/emscripten/pull/7096 */ };
        }
        FS.createDevice('/dev', 'random', random_device);
        FS.createDevice('/dev', 'urandom', random_device);
        // we're not going to emulate the actual shm device,
        // just create the tmp dirs that reside in it commonly
        FS.mkdir('/dev/shm');
        FS.mkdir('/dev/shm/tmp');
      },createSpecialDirectories:function () {
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
                if (!stream) throw new FS.ErrnoError(9);
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
      },createStandardStreams:function () {
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
        assert(stdin.fd === 0, 'invalid handle for stdin (' + stdin.fd + ')');
  
        var stdout = FS.open('/dev/stdout', 'w');
        assert(stdout.fd === 1, 'invalid handle for stdout (' + stdout.fd + ')');
  
        var stderr = FS.open('/dev/stderr', 'w');
        assert(stderr.fd === 2, 'invalid handle for stderr (' + stderr.fd + ')');
      },ensureErrnoError:function () {
        if (FS.ErrnoError) return;
        FS.ErrnoError = function ErrnoError(errno, node) {
          this.node = node;
          this.setErrno = function(errno) {
            this.errno = errno;
          };
          this.setErrno(errno);
          this.message = 'FS error';
          // Node.js compatibility: assigning on this.stack fails on Node 4 (but fixed on Node 8)
          if (this.stack) Object.defineProperty(this, "stack", { value: (new Error).stack, writable: true });
        };
        FS.ErrnoError.prototype = new Error();
        FS.ErrnoError.prototype.constructor = FS.ErrnoError;
        // Some errors may happen quite a bit, to avoid overhead we reuse them (and suffer a lack of stack info)
        [2].forEach(function(code) {
          FS.genericErrors[code] = new FS.ErrnoError(code);
          FS.genericErrors[code].stack = '<generic error, no stack>';
        });
      },staticInit:function () {
        FS.ensureErrnoError();
  
        FS.nameTable = new Array(4096);
  
        FS.mount(MEMFS, {}, '/');
  
        FS.createDefaultDirectories();
        FS.createDefaultDevices();
        FS.createSpecialDirectories();
  
        FS.filesystems = {
          'MEMFS': MEMFS,
          'IDBFS': IDBFS,
          'NODEFS': NODEFS,
          'WORKERFS': WORKERFS,
        };
      },init:function (input, output, error) {
        assert(!FS.init.initialized, 'FS.init was previously called. If you want to initialize later with custom parameters, remove any earlier calls (note that one is automatically added to the generated code)');
        FS.init.initialized = true;
  
        FS.ensureErrnoError();
  
        // Allow Module.stdin etc. to provide defaults, if none explicitly passed to us here
        Module['stdin'] = input || Module['stdin'];
        Module['stdout'] = output || Module['stdout'];
        Module['stderr'] = error || Module['stderr'];
  
        FS.createStandardStreams();
      },quit:function () {
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
      },getMode:function (canRead, canWrite) {
        var mode = 0;
        if (canRead) mode |= 292 | 73;
        if (canWrite) mode |= 146;
        return mode;
      },joinPath:function (parts, forceRelative) {
        var path = PATH.join.apply(null, parts);
        if (forceRelative && path[0] == '/') path = path.substr(1);
        return path;
      },absolutePath:function (relative, base) {
        return PATH.resolve(base, relative);
      },standardizePath:function (path) {
        return PATH.normalize(path);
      },findObject:function (path, dontResolveLastLink) {
        var ret = FS.analyzePath(path, dontResolveLastLink);
        if (ret.exists) {
          return ret.object;
        } else {
          ___setErrNo(ret.error);
          return null;
        }
      },analyzePath:function (path, dontResolveLastLink) {
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
      },createFolder:function (parent, name, canRead, canWrite) {
        var path = PATH.join2(typeof parent === 'string' ? parent : FS.getPath(parent), name);
        var mode = FS.getMode(canRead, canWrite);
        return FS.mkdir(path, mode);
      },createPath:function (parent, path, canRead, canWrite) {
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
      },createFile:function (parent, name, properties, canRead, canWrite) {
        var path = PATH.join2(typeof parent === 'string' ? parent : FS.getPath(parent), name);
        var mode = FS.getMode(canRead, canWrite);
        return FS.create(path, mode);
      },createDataFile:function (parent, name, data, canRead, canWrite, canOwn) {
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
      },createDevice:function (parent, name, input, output) {
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
                throw new FS.ErrnoError(5);
              }
              if (result === undefined && bytesRead === 0) {
                throw new FS.ErrnoError(11);
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
                throw new FS.ErrnoError(5);
              }
            }
            if (length) {
              stream.node.timestamp = Date.now();
            }
            return i;
          }
        });
        return FS.mkdev(path, mode, dev);
      },createLink:function (parent, name, target, canRead, canWrite) {
        var path = PATH.join2(typeof parent === 'string' ? parent : FS.getPath(parent), name);
        return FS.symlink(target, path);
      },forceLoadFile:function (obj) {
        if (obj.isDevice || obj.isFolder || obj.link || obj.contents) return true;
        var success = true;
        if (typeof XMLHttpRequest !== 'undefined') {
          throw new Error("Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.");
        } else if (Module['read']) {
          // Command-line.
          try {
            // WARNING: Can't read binary files in V8's d8 or tracemonkey's js, as
            //          read() will try to parse UTF8.
            obj.contents = intArrayFromString(Module['read'](obj.url), true);
            obj.usedBytes = obj.contents.length;
          } catch (e) {
            success = false;
          }
        } else {
          throw new Error('Cannot load without read() or XMLHttpRequest.');
        }
        if (!success) ___setErrNo(5);
        return success;
      },createLazyFile:function (parent, name, url, canRead, canWrite) {
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
        }
        LazyUint8Array.prototype.setDataGetter = function LazyUint8Array_setDataGetter(getter) {
          this.getter = getter;
        }
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
            console.log("LazyFiles on gzip forces download of the whole file when length is accessed");
          }
  
          this._length = datalength;
          this._chunkSize = chunkSize;
          this.lengthKnown = true;
        }
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
              throw new FS.ErrnoError(5);
            }
            return fn.apply(null, arguments);
          };
        });
        // use a custom read function
        stream_ops.read = function stream_ops_read(stream, buffer, offset, length, position) {
          if (!FS.forceLoadFile(node)) {
            throw new FS.ErrnoError(5);
          }
          var contents = stream.node.contents;
          if (position >= contents.length)
            return 0;
          var size = Math.min(contents.length - position, length);
          assert(size >= 0);
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
      },createPreloadedFile:function (parent, name, url, canRead, canWrite, onload, onerror, dontCreateFile, canOwn, preFinish) {
        Browser.init(); // XXX perhaps this method should move onto Browser?
        // TODO we should allow people to just pass in a complete filename instead
        // of parent and name being that we just join them anyways
        var fullname = name ? PATH.resolve(PATH.join2(parent, name)) : parent;
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
      },indexedDB:function () {
        return window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
      },DB_NAME:function () {
        return 'EM_FS_' + window.location.pathname;
      },DB_VERSION:20,DB_STORE_NAME:"FILE_DATA",saveFilesToDB:function (paths, onload, onerror) {
        onload = onload || function(){};
        onerror = onerror || function(){};
        var indexedDB = FS.indexedDB();
        try {
          var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION);
        } catch (e) {
          return onerror(e);
        }
        openRequest.onupgradeneeded = function openRequest_onupgradeneeded() {
          console.log('creating db');
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
      },loadFilesFromDB:function (paths, onload, onerror) {
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
      }};
  
  var ERRNO_CODES={EPERM:1,ENOENT:2,ESRCH:3,EINTR:4,EIO:5,ENXIO:6,E2BIG:7,ENOEXEC:8,EBADF:9,ECHILD:10,EAGAIN:11,EWOULDBLOCK:11,ENOMEM:12,EACCES:13,EFAULT:14,ENOTBLK:15,EBUSY:16,EEXIST:17,EXDEV:18,ENODEV:19,ENOTDIR:20,EISDIR:21,EINVAL:22,ENFILE:23,EMFILE:24,ENOTTY:25,ETXTBSY:26,EFBIG:27,ENOSPC:28,ESPIPE:29,EROFS:30,EMLINK:31,EPIPE:32,EDOM:33,ERANGE:34,ENOMSG:42,EIDRM:43,ECHRNG:44,EL2NSYNC:45,EL3HLT:46,EL3RST:47,ELNRNG:48,EUNATCH:49,ENOCSI:50,EL2HLT:51,EDEADLK:35,ENOLCK:37,EBADE:52,EBADR:53,EXFULL:54,ENOANO:55,EBADRQC:56,EBADSLT:57,EDEADLOCK:35,EBFONT:59,ENOSTR:60,ENODATA:61,ETIME:62,ENOSR:63,ENONET:64,ENOPKG:65,EREMOTE:66,ENOLINK:67,EADV:68,ESRMNT:69,ECOMM:70,EPROTO:71,EMULTIHOP:72,EDOTDOT:73,EBADMSG:74,ENOTUNIQ:76,EBADFD:77,EREMCHG:78,ELIBACC:79,ELIBBAD:80,ELIBSCN:81,ELIBMAX:82,ELIBEXEC:83,ENOSYS:38,ENOTEMPTY:39,ENAMETOOLONG:36,ELOOP:40,EOPNOTSUPP:95,EPFNOSUPPORT:96,ECONNRESET:104,ENOBUFS:105,EAFNOSUPPORT:97,EPROTOTYPE:91,ENOTSOCK:88,ENOPROTOOPT:92,ESHUTDOWN:108,ECONNREFUSED:111,EADDRINUSE:98,ECONNABORTED:103,ENETUNREACH:101,ENETDOWN:100,ETIMEDOUT:110,EHOSTDOWN:112,EHOSTUNREACH:113,EINPROGRESS:115,EALREADY:114,EDESTADDRREQ:89,EMSGSIZE:90,EPROTONOSUPPORT:93,ESOCKTNOSUPPORT:94,EADDRNOTAVAIL:99,ENETRESET:102,EISCONN:106,ENOTCONN:107,ETOOMANYREFS:109,EUSERS:87,EDQUOT:122,ESTALE:116,ENOTSUP:95,ENOMEDIUM:123,EILSEQ:84,EOVERFLOW:75,ECANCELED:125,ENOTRECOVERABLE:131,EOWNERDEAD:130,ESTRPIPE:86};var SYSCALLS={DEFAULT_POLLMASK:5,mappings:{},umask:511,calculateAt:function (dirfd, path) {
        if (path[0] !== '/') {
          // relative path
          var dir;
          if (dirfd === -100) {
            dir = FS.cwd();
          } else {
            var dirstream = FS.getStream(dirfd);
            if (!dirstream) throw new FS.ErrnoError(ERRNO_CODES.EBADF);
            dir = dirstream.path;
          }
          path = PATH.join2(dir, path);
        }
        return path;
      },doStat:function (func, path, buf) {
        try {
          var stat = func(path);
        } catch (e) {
          if (e && e.node && PATH.normalize(path) !== PATH.normalize(FS.getPath(e.node))) {
            // an error occurred while trying to look up the path; we should just report ENOTDIR
            return -ERRNO_CODES.ENOTDIR;
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
        HEAP32[(((buf)+(36))>>2)]=stat.size;
        HEAP32[(((buf)+(40))>>2)]=4096;
        HEAP32[(((buf)+(44))>>2)]=stat.blocks;
        HEAP32[(((buf)+(48))>>2)]=(stat.atime.getTime() / 1000)|0;
        HEAP32[(((buf)+(52))>>2)]=0;
        HEAP32[(((buf)+(56))>>2)]=(stat.mtime.getTime() / 1000)|0;
        HEAP32[(((buf)+(60))>>2)]=0;
        HEAP32[(((buf)+(64))>>2)]=(stat.ctime.getTime() / 1000)|0;
        HEAP32[(((buf)+(68))>>2)]=0;
        HEAP32[(((buf)+(72))>>2)]=stat.ino;
        return 0;
      },doMsync:function (addr, stream, len, flags) {
        var buffer = new Uint8Array(HEAPU8.subarray(addr, addr + len));
        FS.msync(stream, buffer, 0, len, flags);
      },doMkdir:function (path, mode) {
        // remove a trailing slash, if one - /a/b/ has basename of '', but
        // we want to create b in the context of this function
        path = PATH.normalize(path);
        if (path[path.length-1] === '/') path = path.substr(0, path.length-1);
        FS.mkdir(path, mode, 0);
        return 0;
      },doMknod:function (path, mode, dev) {
        // we don't want this in the JS API as it uses mknod to create all nodes.
        switch (mode & 61440) {
          case 32768:
          case 8192:
          case 24576:
          case 4096:
          case 49152:
            break;
          default: return -ERRNO_CODES.EINVAL;
        }
        FS.mknod(path, mode, dev);
        return 0;
      },doReadlink:function (path, buf, bufsize) {
        if (bufsize <= 0) return -ERRNO_CODES.EINVAL;
        var ret = FS.readlink(path);
  
        var len = Math.min(bufsize, lengthBytesUTF8(ret));
        var endChar = HEAP8[buf+len];
        stringToUTF8(ret, buf, bufsize+1);
        // readlink is one of the rare functions that write out a C string, but does never append a null to the output buffer(!)
        // stringToUTF8() always appends a null byte, so restore the character under the null byte after the write.
        HEAP8[buf+len] = endChar;
  
        return len;
      },doAccess:function (path, amode) {
        if (amode & ~7) {
          // need a valid mode
          return -ERRNO_CODES.EINVAL;
        }
        var node;
        var lookup = FS.lookupPath(path, { follow: true });
        node = lookup.node;
        var perms = '';
        if (amode & 4) perms += 'r';
        if (amode & 2) perms += 'w';
        if (amode & 1) perms += 'x';
        if (perms /* otherwise, they've just passed F_OK */ && FS.nodePermissions(node, perms)) {
          return -ERRNO_CODES.EACCES;
        }
        return 0;
      },doDup:function (path, flags, suggestFD) {
        var suggest = FS.getStream(suggestFD);
        if (suggest) FS.close(suggest);
        return FS.open(path, flags, 0, suggestFD, suggestFD).fd;
      },doReadv:function (stream, iov, iovcnt, offset) {
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
      },doWritev:function (stream, iov, iovcnt, offset) {
        var ret = 0;
        for (var i = 0; i < iovcnt; i++) {
          var ptr = HEAP32[(((iov)+(i*8))>>2)];
          var len = HEAP32[(((iov)+(i*8 + 4))>>2)];
          var curr = FS.write(stream, HEAP8,ptr, len, offset);
          if (curr < 0) return -1;
          ret += curr;
        }
        return ret;
      },varargs:0,get:function (varargs) {
        SYSCALLS.varargs += 4;
        var ret = HEAP32[(((SYSCALLS.varargs)-(4))>>2)];
        return ret;
      },getStr:function () {
        var ret = UTF8ToString(SYSCALLS.get());
        return ret;
      },getStreamFromFD:function () {
        var stream = FS.getStream(SYSCALLS.get());
        if (!stream) throw new FS.ErrnoError(ERRNO_CODES.EBADF);
        return stream;
      },getSocketFromFD:function () {
        var socket = SOCKFS.getSocket(SYSCALLS.get());
        if (!socket) throw new FS.ErrnoError(ERRNO_CODES.EBADF);
        return socket;
      },getSocketAddress:function (allowNull) {
        var addrp = SYSCALLS.get(), addrlen = SYSCALLS.get();
        if (allowNull && addrp === 0) return null;
        var info = __read_sockaddr(addrp, addrlen);
        if (info.errno) throw new FS.ErrnoError(info.errno);
        info.addr = DNS.lookup_addr(info.addr) || info.addr;
        return info;
      },get64:function () {
        var low = SYSCALLS.get(), high = SYSCALLS.get();
        return low;
      },getZero:function () {
        SYSCALLS.get();
      }};function ___syscall140(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // llseek
      var stream = SYSCALLS.getStreamFromFD(), offset_high = SYSCALLS.get(), offset_low = SYSCALLS.get(), result = SYSCALLS.get(), whence = SYSCALLS.get();
      // NOTE: offset_high is unused - Emscripten's off_t is 32-bit
      var offset = offset_low;
      FS.llseek(stream, offset, whence);
      HEAP32[((result)>>2)]=stream.position;
      if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null; // reset readdir state
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall145(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // readv
      var stream = SYSCALLS.getStreamFromFD(), iov = SYSCALLS.get(), iovcnt = SYSCALLS.get();
      return SYSCALLS.doReadv(stream, iov, iovcnt);
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall146(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // writev
      var stream = SYSCALLS.getStreamFromFD(), iov = SYSCALLS.get(), iovcnt = SYSCALLS.get();
      return SYSCALLS.doWritev(stream, iov, iovcnt);
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall221(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // fcntl64
      var stream = SYSCALLS.getStreamFromFD(), cmd = SYSCALLS.get();
      switch (cmd) {
        case 0: {
          var arg = SYSCALLS.get();
          if (arg < 0) {
            return -ERRNO_CODES.EINVAL;
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
          return -ERRNO_CODES.EINVAL; // These are for sockets. We don't have them fully implemented yet.
        case 9:
          // musl trusts getown return values, due to a bug where they must be, as they overlap with errors. just return -1 here, so fnctl() returns that, and we set errno ourselves.
          ___setErrNo(ERRNO_CODES.EINVAL);
          return -1;
        default: {
          return -ERRNO_CODES.EINVAL;
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
      var pathname = SYSCALLS.getStr(), flags = SYSCALLS.get(), mode = SYSCALLS.get() // optional TODO
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
          if (!stream.tty) return -ERRNO_CODES.ENOTTY;
          return 0;
        }
        case 21510:
        case 21511:
        case 21512:
        case 21506:
        case 21507:
        case 21508: {
          if (!stream.tty) return -ERRNO_CODES.ENOTTY;
          return 0; // no-op, not actually adjusting terminal settings
        }
        case 21519: {
          if (!stream.tty) return -ERRNO_CODES.ENOTTY;
          var argp = SYSCALLS.get();
          HEAP32[((argp)>>2)]=0;
          return 0;
        }
        case 21520: {
          if (!stream.tty) return -ERRNO_CODES.ENOTTY;
          return -ERRNO_CODES.EINVAL; // not supported
        }
        case 21531: {
          var argp = SYSCALLS.get();
          return FS.ioctl(stream, op, argp);
        }
        case 21523: {
          // TODO: in theory we should write to the winsize struct that gets
          // passed in, but for now musl doesn't read anything on it
          if (!stream.tty) return -ERRNO_CODES.ENOTTY;
          return 0;
        }
        case 21524: {
          // TODO: technically, this ioctl call should change the window size.
          // but, since emscripten doesn't have any concept of a terminal window
          // yet, we'll just silently throw it away as we do TIOCGWINSZ
          if (!stream.tty) return -ERRNO_CODES.ENOTTY;
          return 0;
        }
        default: abort('bad ioctl syscall ' + op);
      }
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall6(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // close
      var stream = SYSCALLS.getStreamFromFD();
      FS.close(stream);
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall91(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // munmap
      var addr = SYSCALLS.get(), len = SYSCALLS.get();
      // TODO: support unmmap'ing parts of allocations
      var info = SYSCALLS.mappings[addr];
      if (!info) return 0;
      if (len === info.len) {
        var stream = FS.getStream(info.fd);
        SYSCALLS.doMsync(addr, stream, len, info.flags)
        FS.munmap(stream);
        SYSCALLS.mappings[addr] = null;
        if (info.allocated) {
          _free(info.malloc);
        }
      }
      return 0;
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
    }function ClassHandle_clone() {
      if (!this.$$.ptr) {
          throwInstanceAlreadyDeleted(this);
      }
  
      if (this.$$.preservePointerOnDelete) {
          this.$$.count.value += 1;
          return this;
      } else {
          var clone = Object.create(Object.getPrototypeOf(this), {
              $$: {
                  value: shallowCopyInternalPointer(this.$$),
              }
          });
  
          clone.$$.count.value += 1;
          clone.$$.deleteScheduled = false;
          return clone;
      }
    }
  
  
  function runDestructor(handle) {
      var $$ = handle.$$;
      if ($$.smartPtr) {
          $$.smartPtrType.rawDestructor($$.smartPtr);
      } else {
          $$.ptrType.registeredClass.rawDestructor($$.ptr);
      }
    }function ClassHandle_delete() {
      if (!this.$$.ptr) {
          throwInstanceAlreadyDeleted(this);
      }
  
      if (this.$$.deleteScheduled && !this.$$.preservePointerOnDelete) {
          throwBindingError('Object already scheduled for deletion');
      }
  
      this.$$.count.value -= 1;
      var toDelete = 0 === this.$$.count.value;
      if (toDelete) {
          runDestructor(this);
      }
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
      return Object.create(prototype, {
          $$: {
              value: record,
          },
      });
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
      var rawArgTypes = heap32VectorToArray(argCount, rawArgTypesAddr);
      invoker = embind__requireFunction(invokerSignature, invoker);
  
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
                  var destructors = [];
                  var args = new Array(argCount);
                  args[0] = rawConstructor;
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
              var HEAP = getHeap();
              var length = value.length;
              var ptr = _malloc(4 + length * charSize);
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

  
  
  function requireRegisteredType(rawType, humanName) {
      var impl = registeredTypes[rawType];
      if (undefined === impl) {
          throwBindingError(humanName + " has unknown type " + getTypeName(rawType));
      }
      return impl;
    }function __emval_lookupTypes(argCount, argTypes, argWireTypes) {
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
      Module['abort']();
    }

  function _emscripten_get_heap_size() {
      return TOTAL_MEMORY;
    }

  
  function abortOnCannotGrowMemory(requestedSize) {
      abort('Cannot enlarge memory arrays to size ' + requestedSize + ' bytes. Either (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value ' + TOTAL_MEMORY + ', (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which allows increasing the size at runtime, or (3) if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 ');
    }
  
  function emscripten_realloc_buffer(size) {
      var PAGE_MULTIPLE = 65536;
      size = alignUp(size, PAGE_MULTIPLE); // round up to wasm page size
      var old = Module['buffer'];
      var oldSize = old.byteLength;
      // native wasm support
      try {
        var result = wasmMemory.grow((size - oldSize) / 65536); // .grow() takes a delta compared to the previous size
        if (result !== (-1 | 0)) {
          // success in native wasm memory growth, get the buffer from the memory
          return Module['buffer'] = wasmMemory.buffer;
        } else {
          return null;
        }
      } catch(e) {
        return null;
      }
    }function _emscripten_resize_heap(requestedSize) {
      var oldSize = _emscripten_get_heap_size();
      // TOTAL_MEMORY is the current size of the actual array, and DYNAMICTOP is the new top.
  
  
      var PAGE_MULTIPLE = 65536;
      var LIMIT = 2147483648 - PAGE_MULTIPLE; // We can do one page short of 2GB as theoretical maximum.
  
      if (requestedSize > LIMIT) {
        return false;
      }
  
      var MIN_TOTAL_MEMORY = 16777216;
      var newSize = Math.max(oldSize, MIN_TOTAL_MEMORY); // So the loop below will not be infinite, and minimum asm.js memory size is 16MB.
  
      while (newSize < requestedSize) { // Keep incrementing the heap size as long as it's less than what is requested.
        if (newSize <= 536870912) {
          newSize = alignUp(2 * newSize, PAGE_MULTIPLE); // Simple heuristic: double until 1GB...
        } else {
          // ..., but after that, add smaller increments towards 2GB, which we cannot reach
          newSize = Math.min(alignUp((3 * newSize + 2147483648) / 4, PAGE_MULTIPLE), LIMIT);
        }
      }
  
  
  
      var replacement = emscripten_realloc_buffer(newSize);
      if (!replacement || replacement.byteLength != newSize) {
        return false;
      }
  
      // everything worked
      updateGlobalBuffer(replacement);
      updateGlobalBufferViews();
  
      TOTAL_MEMORY = newSize;
      HEAPU32[DYNAMICTOP_PTR>>2] = requestedSize;
  
  
  
      return true;
    }

  
  var ENV={};function _getenv(name) {
      // char *getenv(const char *name);
      // http://pubs.opengroup.org/onlinepubs/009695399/functions/getenv.html
      if (name === 0) return 0;
      name = UTF8ToString(name);
      if (!ENV.hasOwnProperty(name)) return 0;
  
      if (_getenv.ret) _free(_getenv.ret);
      _getenv.ret = allocateUTF8(ENV[name]);
      return _getenv.ret;
    }

   

  
  var _Math_floor=undefined;
  
  var _Math_ceil=undefined; 

  function _llvm_stackrestore(p) {
      var self = _llvm_stacksave;
      var ret = self.LLVM_SAVEDSTACKS[p];
      self.LLVM_SAVEDSTACKS.splice(p, 1);
      stackRestore(ret);
    }

  function _llvm_stacksave() {
      var self = _llvm_stacksave;
      if (!self.LLVM_SAVEDSTACKS) {
        self.LLVM_SAVEDSTACKS = [];
      }
      self.LLVM_SAVEDSTACKS.push(stackSave());
      return self.LLVM_SAVEDSTACKS.length-1;
    }

  
  function _emscripten_memcpy_big(dest, src, num) {
      HEAPU8.set(HEAPU8.subarray(src, src+num), dest);
    }
  
  var _Int8Array=undefined;
  
  var _Int32Array=undefined; 

   

   

   

  function _pthread_cond_wait() { return 0; }

  
  var PTHREAD_SPECIFIC={};function _pthread_getspecific(key) {
      return PTHREAD_SPECIFIC[key] || 0;
    }

  
  var PTHREAD_SPECIFIC_NEXT_KEY=1;function _pthread_key_create(key, destructor) {
      if (key == 0) {
        return ERRNO_CODES.EINVAL;
      }
      HEAP32[((key)>>2)]=PTHREAD_SPECIFIC_NEXT_KEY;
      // values start at 0
      PTHREAD_SPECIFIC[PTHREAD_SPECIFIC_NEXT_KEY] = 0;
      PTHREAD_SPECIFIC_NEXT_KEY++;
      return 0;
    }

   

   

  function _pthread_once(ptr, func) {
      if (!_pthread_once.seen) _pthread_once.seen = {};
      if (ptr in _pthread_once.seen) return;
      dynCall_v(func);
      _pthread_once.seen[ptr] = 1;
    }

  function _pthread_setspecific(key, value) {
      if (!(key in PTHREAD_SPECIFIC)) {
        return ERRNO_CODES.EINVAL;
      }
      PTHREAD_SPECIFIC[key] = value;
      return 0;
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
        '%X': '%H:%M:%S'                  // Replaced by the locale's appropriate date representation
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
      };
  
      function leadingNulls(value, digits) {
        return leadingSomething(value, digits, '0');
      };
  
      function compareByDay(date1, date2) {
        function sgn(value) {
          return value < 0 ? -1 : (value > 0 ? 1 : 0);
        };
  
        var compare;
        if ((compare = sgn(date1.getFullYear()-date2.getFullYear())) === 0) {
          if ((compare = sgn(date1.getMonth()-date2.getMonth())) === 0) {
            compare = sgn(date1.getDate()-date2.getDate());
          }
        }
        return compare;
      };
  
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
      };
  
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
      };
  
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
          var day = new Date(date.tm_year+1900, date.tm_mon+1, date.tm_mday, 0, 0, 0, 0);
          return day.getDay() || 7;
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
          var day = new Date(date.tm_year+1900, date.tm_mon+1, date.tm_mday, 0, 0, 0, 0);
          return day.getDay();
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
FS.staticInit();__ATINIT__.unshift(function() { if (!Module["noFSInit"] && !FS.init.initialized) FS.init() });__ATMAIN__.push(function() { FS.ignorePermissions = false });__ATEXIT__.push(function() { FS.quit() });;
__ATINIT__.unshift(function() { TTY.init() });__ATEXIT__.push(function() { TTY.shutdown() });;
if (ENVIRONMENT_IS_NODE) { var fs = require("fs"); var NODEJS_PATH = require("path"); NODEFS.staticInit(); };
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


// ASM_LIBRARY EXTERN PRIMITIVES: Math_floor,Math_ceil,Int8Array,Int32Array


var asmGlobalArg = {}

var asmLibraryArg = { "abort": abort, "setTempRet0": setTempRet0, "getTempRet0": getTempRet0, "ClassHandle": ClassHandle, "ClassHandle_clone": ClassHandle_clone, "ClassHandle_delete": ClassHandle_delete, "ClassHandle_deleteLater": ClassHandle_deleteLater, "ClassHandle_isAliasOf": ClassHandle_isAliasOf, "ClassHandle_isDeleted": ClassHandle_isDeleted, "RegisteredClass": RegisteredClass, "RegisteredPointer": RegisteredPointer, "RegisteredPointer_deleteObject": RegisteredPointer_deleteObject, "RegisteredPointer_destructor": RegisteredPointer_destructor, "RegisteredPointer_fromWireType": RegisteredPointer_fromWireType, "RegisteredPointer_getPointee": RegisteredPointer_getPointee, "___cxa_allocate_exception": ___cxa_allocate_exception, "___cxa_begin_catch": ___cxa_begin_catch, "___cxa_find_matching_catch": ___cxa_find_matching_catch, "___cxa_free_exception": ___cxa_free_exception, "___cxa_throw": ___cxa_throw, "___cxa_uncaught_exception": ___cxa_uncaught_exception, "___gxx_personality_v0": ___gxx_personality_v0, "___lock": ___lock, "___map_file": ___map_file, "___resumeException": ___resumeException, "___setErrNo": ___setErrNo, "___syscall140": ___syscall140, "___syscall145": ___syscall145, "___syscall146": ___syscall146, "___syscall221": ___syscall221, "___syscall5": ___syscall5, "___syscall54": ___syscall54, "___syscall6": ___syscall6, "___syscall91": ___syscall91, "___unlock": ___unlock, "__addDays": __addDays, "__arraySum": __arraySum, "__embind_register_bool": __embind_register_bool, "__embind_register_class": __embind_register_class, "__embind_register_class_class_function": __embind_register_class_class_function, "__embind_register_class_constructor": __embind_register_class_constructor, "__embind_register_class_function": __embind_register_class_function, "__embind_register_class_property": __embind_register_class_property, "__embind_register_emval": __embind_register_emval, "__embind_register_float": __embind_register_float, "__embind_register_integer": __embind_register_integer, "__embind_register_memory_view": __embind_register_memory_view, "__embind_register_smart_ptr": __embind_register_smart_ptr, "__embind_register_std_string": __embind_register_std_string, "__embind_register_std_wstring": __embind_register_std_wstring, "__embind_register_void": __embind_register_void, "__emval_call": __emval_call, "__emval_decref": __emval_decref, "__emval_incref": __emval_incref, "__emval_lookupTypes": __emval_lookupTypes, "__emval_register": __emval_register, "__emval_take_value": __emval_take_value, "__isLeapYear": __isLeapYear, "_abort": _abort, "_embind_repr": _embind_repr, "_emscripten_get_heap_size": _emscripten_get_heap_size, "_emscripten_memcpy_big": _emscripten_memcpy_big, "_emscripten_resize_heap": _emscripten_resize_heap, "_getenv": _getenv, "_llvm_stackrestore": _llvm_stackrestore, "_llvm_stacksave": _llvm_stacksave, "_pthread_cond_wait": _pthread_cond_wait, "_pthread_getspecific": _pthread_getspecific, "_pthread_key_create": _pthread_key_create, "_pthread_once": _pthread_once, "_pthread_setspecific": _pthread_setspecific, "_strftime": _strftime, "_strftime_l": _strftime_l, "abortOnCannotGrowMemory": abortOnCannotGrowMemory, "constNoSmartPtrRawPointerToWireType": constNoSmartPtrRawPointerToWireType, "count_emval_handles": count_emval_handles, "craftInvokerFunction": craftInvokerFunction, "createNamedFunction": createNamedFunction, "downcastPointer": downcastPointer, "embind__requireFunction": embind__requireFunction, "embind_init_charCodes": embind_init_charCodes, "emscripten_realloc_buffer": emscripten_realloc_buffer, "ensureOverloadTable": ensureOverloadTable, "exposePublicSymbol": exposePublicSymbol, "extendError": extendError, "floatReadValueFromPointer": floatReadValueFromPointer, "flushPendingDeletes": flushPendingDeletes, "genericPointerToWireType": genericPointerToWireType, "getBasestPointer": getBasestPointer, "getInheritedInstance": getInheritedInstance, "getInheritedInstanceCount": getInheritedInstanceCount, "getLiveInheritedInstances": getLiveInheritedInstances, "getShiftFromSize": getShiftFromSize, "getTypeName": getTypeName, "get_first_emval": get_first_emval, "heap32VectorToArray": heap32VectorToArray, "init_ClassHandle": init_ClassHandle, "init_RegisteredPointer": init_RegisteredPointer, "init_embind": init_embind, "init_emval": init_emval, "integerReadValueFromPointer": integerReadValueFromPointer, "makeClassHandle": makeClassHandle, "makeLegalFunctionName": makeLegalFunctionName, "new_": new_, "nonConstNoSmartPtrRawPointerToWireType": nonConstNoSmartPtrRawPointerToWireType, "readLatin1String": readLatin1String, "registerType": registerType, "replacePublicSymbol": replacePublicSymbol, "requireHandle": requireHandle, "requireRegisteredType": requireRegisteredType, "runDestructor": runDestructor, "runDestructors": runDestructors, "setDelayFunction": setDelayFunction, "shallowCopyInternalPointer": shallowCopyInternalPointer, "simpleReadValueFromPointer": simpleReadValueFromPointer, "throwBindingError": throwBindingError, "throwInstanceAlreadyDeleted": throwInstanceAlreadyDeleted, "throwInternalError": throwInternalError, "throwUnboundTypeError": throwUnboundTypeError, "upcastPointer": upcastPointer, "validateThis": validateThis, "whenDependentTypesAreResolved": whenDependentTypesAreResolved, "tempDoublePtr": tempDoublePtr, "DYNAMICTOP_PTR": DYNAMICTOP_PTR }
// EMSCRIPTEN_START_ASM
var asm =Module["asm"]// EMSCRIPTEN_END_ASM
(asmGlobalArg, asmLibraryArg, buffer);

var __ZSt18uncaught_exceptionv = Module["__ZSt18uncaught_exceptionv"] = asm["__ZSt18uncaught_exceptionv"];
var ___cxa_can_catch = Module["___cxa_can_catch"] = asm["___cxa_can_catch"];
var ___cxa_is_pointer_type = Module["___cxa_is_pointer_type"] = asm["___cxa_is_pointer_type"];
var ___errno_location = Module["___errno_location"] = asm["___errno_location"];
var ___getTypeName = Module["___getTypeName"] = asm["___getTypeName"];
var _emscripten_replace_memory = Module["_emscripten_replace_memory"] = asm["_emscripten_replace_memory"];
var _free = Module["_free"] = asm["_free"];
var _llvm_bswap_i32 = Module["_llvm_bswap_i32"] = asm["_llvm_bswap_i32"];
var _llvm_round_f64 = Module["_llvm_round_f64"] = asm["_llvm_round_f64"];
var _malloc = Module["_malloc"] = asm["_malloc"];
var _memcpy = Module["_memcpy"] = asm["_memcpy"];
var _memmove = Module["_memmove"] = asm["_memmove"];
var _memset = Module["_memset"] = asm["_memset"];
var _pthread_cond_broadcast = Module["_pthread_cond_broadcast"] = asm["_pthread_cond_broadcast"];
var _pthread_mutex_lock = Module["_pthread_mutex_lock"] = asm["_pthread_mutex_lock"];
var _pthread_mutex_unlock = Module["_pthread_mutex_unlock"] = asm["_pthread_mutex_unlock"];
var _sbrk = Module["_sbrk"] = asm["_sbrk"];
var establishStackSpace = Module["establishStackSpace"] = asm["establishStackSpace"];
var globalCtors = Module["globalCtors"] = asm["globalCtors"];
var stackAlloc = Module["stackAlloc"] = asm["stackAlloc"];
var stackRestore = Module["stackRestore"] = asm["stackRestore"];
var stackSave = Module["stackSave"] = asm["stackSave"];
var dynCall_dddd = Module["dynCall_dddd"] = asm["dynCall_dddd"];
var dynCall_dddddd = Module["dynCall_dddddd"] = asm["dynCall_dddddd"];
var dynCall_di = Module["dynCall_di"] = asm["dynCall_di"];
var dynCall_did = Module["dynCall_did"] = asm["dynCall_did"];
var dynCall_didd = Module["dynCall_didd"] = asm["dynCall_didd"];
var dynCall_diddd = Module["dynCall_diddd"] = asm["dynCall_diddd"];
var dynCall_diddddd = Module["dynCall_diddddd"] = asm["dynCall_diddddd"];
var dynCall_didddddii = Module["dynCall_didddddii"] = asm["dynCall_didddddii"];
var dynCall_didddii = Module["dynCall_didddii"] = asm["dynCall_didddii"];
var dynCall_diddidd = Module["dynCall_diddidd"] = asm["dynCall_diddidd"];
var dynCall_didi = Module["dynCall_didi"] = asm["dynCall_didi"];
var dynCall_didid = Module["dynCall_didid"] = asm["dynCall_didid"];
var dynCall_dididdd = Module["dynCall_dididdd"] = asm["dynCall_dididdd"];
var dynCall_dididi = Module["dynCall_dididi"] = asm["dynCall_dididi"];
var dynCall_dii = Module["dynCall_dii"] = asm["dynCall_dii"];
var dynCall_diid = Module["dynCall_diid"] = asm["dynCall_diid"];
var dynCall_diidd = Module["dynCall_diidd"] = asm["dynCall_diidd"];
var dynCall_diiddd = Module["dynCall_diiddd"] = asm["dynCall_diiddd"];
var dynCall_diiddddd = Module["dynCall_diiddddd"] = asm["dynCall_diiddddd"];
var dynCall_diidddddii = Module["dynCall_diidddddii"] = asm["dynCall_diidddddii"];
var dynCall_diidddii = Module["dynCall_diidddii"] = asm["dynCall_diidddii"];
var dynCall_diiddidd = Module["dynCall_diiddidd"] = asm["dynCall_diiddidd"];
var dynCall_diidi = Module["dynCall_diidi"] = asm["dynCall_diidi"];
var dynCall_diidid = Module["dynCall_diidid"] = asm["dynCall_diidid"];
var dynCall_diididdd = Module["dynCall_diididdd"] = asm["dynCall_diididdd"];
var dynCall_diididi = Module["dynCall_diididi"] = asm["dynCall_diididi"];
var dynCall_diii = Module["dynCall_diii"] = asm["dynCall_diii"];
var dynCall_diiii = Module["dynCall_diiii"] = asm["dynCall_diiii"];
var dynCall_i = Module["dynCall_i"] = asm["dynCall_i"];
var dynCall_ii = Module["dynCall_ii"] = asm["dynCall_ii"];
var dynCall_iid = Module["dynCall_iid"] = asm["dynCall_iid"];
var dynCall_iii = Module["dynCall_iii"] = asm["dynCall_iii"];
var dynCall_iiid = Module["dynCall_iiid"] = asm["dynCall_iiid"];
var dynCall_iiii = Module["dynCall_iiii"] = asm["dynCall_iiii"];
var dynCall_iiiid = Module["dynCall_iiiid"] = asm["dynCall_iiiid"];
var dynCall_iiiif = Module["dynCall_iiiif"] = asm["dynCall_iiiif"];
var dynCall_iiiii = Module["dynCall_iiiii"] = asm["dynCall_iiiii"];
var dynCall_iiiiid = Module["dynCall_iiiiid"] = asm["dynCall_iiiiid"];
var dynCall_iiiiii = Module["dynCall_iiiiii"] = asm["dynCall_iiiiii"];
var dynCall_iiiiiid = Module["dynCall_iiiiiid"] = asm["dynCall_iiiiiid"];
var dynCall_iiiiiii = Module["dynCall_iiiiiii"] = asm["dynCall_iiiiiii"];
var dynCall_iiiiiiii = Module["dynCall_iiiiiiii"] = asm["dynCall_iiiiiiii"];
var dynCall_iiiiiiiii = Module["dynCall_iiiiiiiii"] = asm["dynCall_iiiiiiiii"];
var dynCall_iiiiij = Module["dynCall_iiiiij"] = asm["dynCall_iiiiij"];
var dynCall_v = Module["dynCall_v"] = asm["dynCall_v"];
var dynCall_vi = Module["dynCall_vi"] = asm["dynCall_vi"];
var dynCall_vid = Module["dynCall_vid"] = asm["dynCall_vid"];
var dynCall_vidd = Module["dynCall_vidd"] = asm["dynCall_vidd"];
var dynCall_vidid = Module["dynCall_vidid"] = asm["dynCall_vidid"];
var dynCall_vididd = Module["dynCall_vididd"] = asm["dynCall_vididd"];
var dynCall_vididdd = Module["dynCall_vididdd"] = asm["dynCall_vididdd"];
var dynCall_viffii = Module["dynCall_viffii"] = asm["dynCall_viffii"];
var dynCall_vii = Module["dynCall_vii"] = asm["dynCall_vii"];
var dynCall_viid = Module["dynCall_viid"] = asm["dynCall_viid"];
var dynCall_viidd = Module["dynCall_viidd"] = asm["dynCall_viidd"];
var dynCall_viidid = Module["dynCall_viidid"] = asm["dynCall_viidid"];
var dynCall_viididd = Module["dynCall_viididd"] = asm["dynCall_viididd"];
var dynCall_viididdd = Module["dynCall_viididdd"] = asm["dynCall_viididdd"];
var dynCall_viif = Module["dynCall_viif"] = asm["dynCall_viif"];
var dynCall_viiffii = Module["dynCall_viiffii"] = asm["dynCall_viiffii"];
var dynCall_viii = Module["dynCall_viii"] = asm["dynCall_viii"];
var dynCall_viiid = Module["dynCall_viiid"] = asm["dynCall_viiid"];
var dynCall_viiif = Module["dynCall_viiif"] = asm["dynCall_viiif"];
var dynCall_viiii = Module["dynCall_viiii"] = asm["dynCall_viiii"];
var dynCall_viiiii = Module["dynCall_viiiii"] = asm["dynCall_viiiii"];
var dynCall_viiiiii = Module["dynCall_viiiiii"] = asm["dynCall_viiiiii"];
var dynCall_viijii = Module["dynCall_viijii"] = asm["dynCall_viijii"];
;



// === Auto-generated postamble setup entry stuff ===

Module['asm'] = asm;














































































/**
 * @constructor
 * @extends {Error}
 * @this {ExitStatus}
 */
function ExitStatus(status) {
  this.name = "ExitStatus";
  this.message = "Program terminated with exit(" + status + ")";
  this.status = status;
};
ExitStatus.prototype = new Error();
ExitStatus.prototype.constructor = ExitStatus;

var calledMain = false;

dependenciesFulfilled = function runCaller() {
  // If run has never been called, and we should call run (INVOKE_RUN is true, and Module.noInitialRun is not false)
  if (!Module['calledRun']) run();
  if (!Module['calledRun']) dependenciesFulfilled = runCaller; // try this again later, after new deps are fulfilled
}





/** @type {function(Array=)} */
function run(args) {
  args = args || Module['arguments'];

  if (runDependencies > 0) {
    return;
  }


  preRun();

  if (runDependencies > 0) return; // a preRun added a dependency, run will be called later
  if (Module['calledRun']) return; // run may have just been called through dependencies being fulfilled just in this very frame

  function doRun() {
    if (Module['calledRun']) return; // run may have just been called while the async setStatus time below was happening
    Module['calledRun'] = true;

    if (ABORT) return;

    ensureInitRuntime();

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
  } else {
    doRun();
  }
}
Module['run'] = run;


function exit(status, implicit) {

  // if this is just main exit-ing implicitly, and the status is 0, then we
  // don't need to do anything here and can just leave. if the status is
  // non-zero, though, then we need to report it.
  // (we may have warned about this earlier, if a situation justifies doing so)
  if (implicit && Module['noExitRuntime'] && status === 0) {
    return;
  }

  if (Module['noExitRuntime']) {
  } else {

    ABORT = true;
    EXITSTATUS = status;

    exitRuntime();

    if (Module['onExit']) Module['onExit'](status);
  }

  Module['quit'](status, new ExitStatus(status));
}

var abortDecorators = [];

function abort(what) {
  if (Module['onAbort']) {
    Module['onAbort'](what);
  }

  if (what !== undefined) {
    out(what);
    err(what);
    what = JSON.stringify(what)
  } else {
    what = '';
  }

  ABORT = true;
  EXITSTATUS = 1;

  throw 'abort(' + what + '). Build with -s ASSERTIONS=1 for more info.';
}
Module['abort'] = abort;

if (Module['preInit']) {
  if (typeof Module['preInit'] == 'function') Module['preInit'] = [Module['preInit']];
  while (Module['preInit'].length > 0) {
    Module['preInit'].pop()();
  }
}


  Module["noExitRuntime"] = true;

run();





// {{MODULE_ADDITIONS}}




/* global Module */

"use strict";

console.log("maximilian v2.0.0: " + Date());

//NOTE: This is the main thing that post.js adds to Maximilian setup, an Module export definition
export default Module;
