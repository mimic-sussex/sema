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
    STACK_BASE = 52512,
    STACKTOP = STACK_BASE,
    STACK_MAX = 5295392,
    DYNAMIC_BASE = 5295392,
    DYNAMICTOP_PTR = 52256;




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




var wasmBinaryFile = 'data:application/octet-stream;base64,AGFzbQEAAAABvAqbAWACfHwBfGAAAX9gAn9/AGADf39/AGABfwF/YAN/f38Bf2ABfwBgAn98AXxgBH98fHwBfGADf3x8AXxgAX8BfGACf3wAYAN/f38BfGADf398AGAEf3x/fAF8YAV/fH98fwF8YAR/fH98AGAFf3x/fHwAYAZ/fH98fHwAYAR/fHx8AGAEf39/fABgA3x8fAF8YAN/fHwAYAV/fX1/fwBgBXx8fHx8AXxgBn98fH98fAF8YAZ/fHx8fHwBfGAGf3x8fH9/AXxgCH98fHx8fH9/AXxgA398fwF8YAF8AXxgBn98f3x8fAF8YAJ/fAF/YAR/fHx/AXxgA398fwBgAn9/AXxgBH9/f38AYAN/fX8Bf2ABfwF9YAR/f39/AX1gBH9/f38Bf2AFf3x8f3wBfGAGf3x8fH98AXxgBX98fHx/AXxgAn9/AX9gBX9/f39/AX9gCH9/f39/f39/AX9gBX9/fn9/AGAGf39/f39/AX9gAABgBn9/f39/fwBgBX9/f39/AGADf398AXxgBH9/fHwBfGAFf398fHwBfGAHf398fHx8fAF8YAl/f3x8fHx8f38BfGAGf398fHx/AXxgB39/fHx8f3wBfGAHf398fHx/fwF8YAV/f3x8fwF8YAZ/f3x8f3wBfGAHf398fH98fAF8YAR/f3x/AXxgBX9/fH98AXxgB39/fH98fHwBfGAGf398f3x/AXxgBH9/f38BfGACf38BfWAFf39/f38BfWADf398AX9gBH9/fX8Bf2AEf39/fAF/YAR/f399AX9gBX9/f398AX9gBn9/f39/fAF/YAd/f39/f39/AX9gBX9/f39+AX9gBH9/fHwAYAV/f3x8fABgBH9/fH8AYAV/f3x/fABgBn9/fH98fABgB39/fH98fHwAYAN/f30AYAZ/f319f38AYAR/f399AGANf39/f39/f39/f39/fwBgB39/f39/f38AYAh/f39/f39/fwBgCn9/f39/f39/f38AYAx/f39/f39/f39/f38AYAF9AX1gAn99AGAGf398fHx/AGADf319AGAEf39/fwF+YAN/f38BfmAEf39/fgF+YAN+f38Bf2ACfn8Bf2AGf3x/f39/AX9gAXwBfmACfH8BfGAFf39/f38BfGAGf39/f39/AXxgAn9/AX5gAXwBfWACfH8Bf2ACfX8Bf2ADfHx/AXxgAn1/AX1gA39/fgBgA39/fwF9YAJ9fQF9YAN/fn8Bf2AKf39/f39/f39/fwF/YAx/f39/f39/f39/f38Bf2ALf39/f39/f39/f38Bf2APf39/f39/f39/f39/f39/AGAEf39/fAF8YAV/f398fAF8YAZ/f398fHwBfGAIf39/fHx8fHwBfGAKf39/fHx8fHx/fwF8YAd/f398fHx/AXxgCH9/f3x8fH98AXxgCH9/f3x8fH9/AXxgBn9/f3x8fwF8YAd/f398fH98AXxgCH9/f3x8f3x8AXxgBX9/f3x/AXxgBn9/f3x/fAF8YAh/f398f3x8fAF8YAd/f398f3x/AXxgBn9/f39/fwF9YAV/f399fwF/YAV/f39/fQF/YAd/f39/f398AX9gCX9/f39/f39/fwF/YAZ/f39/f34Bf2AFf39/fHwAYAZ/f398fHwAYAV/f398fwBgBn9/f3x/fABgB39/f3x/fHwAYAh/f398f3x8fABgB39/f319f38AYAV/f39/fABgBX9/f399AGAGf39/fn9/AGAEf398fwF/YAV/f398fwF/YAZ/f3x8f38AYAd/f398fH9/AALMCz0DZW52BWFib3J0AAYDZW52Dl9fX2Fzc2VydF9mYWlsACQDZW52GV9fX2N4YV9hbGxvY2F0ZV9leGNlcHRpb24ABANlbnYTX19fY3hhX3B1cmVfdmlydHVhbAAxA2VudgxfX19jeGFfdGhyb3cAAwNlbnYZX19fY3hhX3VuY2F1Z2h0X2V4Y2VwdGlvbgABA2VudgdfX19sb2NrAAYDZW52C19fX21hcF9maWxlACwDZW52C19fX3NldEVyck5vAAYDZW52DV9fX3N5c2NhbGwxNDAALANlbnYNX19fc3lzY2FsbDE0NQAsA2Vudg1fX19zeXNjYWxsMTQ2ACwDZW52DV9fX3N5c2NhbGwyMjEALANlbnYLX19fc3lzY2FsbDUALANlbnYMX19fc3lzY2FsbDU0ACwDZW52C19fX3N5c2NhbGw2ACwDZW52DF9fX3N5c2NhbGw5MQAsA2VudglfX191bmxvY2sABgNlbnYWX19lbWJpbmRfcmVnaXN0ZXJfYm9vbAAzA2VudhdfX2VtYmluZF9yZWdpc3Rlcl9jbGFzcwBXA2VudiZfX2VtYmluZF9yZWdpc3Rlcl9jbGFzc19jbGFzc19mdW5jdGlvbgBYA2VudiNfX2VtYmluZF9yZWdpc3Rlcl9jbGFzc19jb25zdHJ1Y3RvcgAyA2VudiBfX2VtYmluZF9yZWdpc3Rlcl9jbGFzc19mdW5jdGlvbgBZA2VudiBfX2VtYmluZF9yZWdpc3Rlcl9jbGFzc19wcm9wZXJ0eQBaA2VudhdfX2VtYmluZF9yZWdpc3Rlcl9lbXZhbAACA2VudhZfX2VtYmluZF9yZWdpc3Rlcl9lbnVtACQDZW52HF9fZW1iaW5kX3JlZ2lzdGVyX2VudW1fdmFsdWUAAwNlbnYXX19lbWJpbmRfcmVnaXN0ZXJfZmxvYXQAAwNlbnYZX19lbWJpbmRfcmVnaXN0ZXJfaW50ZWdlcgAzA2Vudh1fX2VtYmluZF9yZWdpc3Rlcl9tZW1vcnlfdmlldwADA2VudhtfX2VtYmluZF9yZWdpc3Rlcl9zbWFydF9wdHIAWwNlbnYcX19lbWJpbmRfcmVnaXN0ZXJfc3RkX3N0cmluZwACA2Vudh1fX2VtYmluZF9yZWdpc3Rlcl9zdGRfd3N0cmluZwADA2VudhZfX2VtYmluZF9yZWdpc3Rlcl92b2lkAAIDZW52DF9fZW12YWxfY2FsbAAoA2Vudg5fX2VtdmFsX2RlY3JlZgAGA2Vudg5fX2VtdmFsX2luY3JlZgAGA2VudhJfX2VtdmFsX3Rha2VfdmFsdWUALANlbnYGX2Fib3J0ADEDZW52GV9lbXNjcmlwdGVuX2dldF9oZWFwX3NpemUAAQNlbnYWX2Vtc2NyaXB0ZW5fbWVtY3B5X2JpZwAFA2VudhdfZW1zY3JpcHRlbl9yZXNpemVfaGVhcAAEA2VudgVfZXhpdAAGA2VudgdfZ2V0ZW52AAQDZW52D19sbHZtX2xvZzEwX2YzMgAeA2VudhJfbGx2bV9zdGFja3Jlc3RvcmUABgNlbnYPX2xsdm1fc3RhY2tzYXZlAAEDZW52Cl9sbHZtX3RyYXAAMQNlbnYSX3B0aHJlYWRfY29uZF93YWl0ACwDZW52FF9wdGhyZWFkX2dldHNwZWNpZmljAAQDZW52E19wdGhyZWFkX2tleV9jcmVhdGUALANlbnYNX3B0aHJlYWRfb25jZQAsA2VudhRfcHRocmVhZF9zZXRzcGVjaWZpYwAsA2Vudgtf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cm5vX2xvY2F0aW9uAKEMDl9fX2dldFR5cGVOYW1lAJwMBV9mcmVlAMAND19sbHZtX2Jzd2FwX2kzMgDNEQ9fbGx2bV9yb3VuZF9mNjQAzhEHX21hbGxvYwC/DQdfbWVtY3B5AM8RCF9tZW1tb3ZlANARB19tZW1zZXQA0REXX3B0aHJlYWRfY29uZF9icm9hZGNhc3QAhgkTX3B0aHJlYWRfbXV0ZXhfbG9jawCGCRVfcHRocmVhZF9tdXRleF91bmxvY2sAhgkFX3NicmsA0hEKZHluQ2FsbF9kZADTEQtkeW5DYWxsX2RkZADUEQxkeW5DYWxsX2RkZGQA1REOZHluQ2FsbF9kZGRkZGQA1hEKZHluQ2FsbF9kaQDXEQtkeW5DYWxsX2RpZADYEQxkeW5DYWxsX2RpZGQA2RENZHluQ2FsbF9kaWRkZADaEQ9keW5DYWxsX2RpZGRkZGQA2xERZHluQ2FsbF9kaWRkZGRkaWkA3BEOZHluQ2FsbF9kaWRkZGkA3REPZHluQ2FsbF9kaWRkZGlkAN4RD2R5bkNhbGxfZGlkZGRpaQDfEQ1keW5DYWxsX2RpZGRpAOARDmR5bkNhbGxfZGlkZGlkAOERD2R5bkNhbGxfZGlkZGlkZADiEQxkeW5DYWxsX2RpZGkA4xENZHluQ2FsbF9kaWRpZADkEQ9keW5DYWxsX2RpZGlkZGQA5REOZHluQ2FsbF9kaWRpZGkA5hELZHluQ2FsbF9kaWkA5xEMZHluQ2FsbF9kaWlkAOgRDWR5bkNhbGxfZGlpZGQA6REOZHluQ2FsbF9kaWlkZGQA6hEQZHluQ2FsbF9kaWlkZGRkZADrERJkeW5DYWxsX2RpaWRkZGRkaWkA7BEPZHluQ2FsbF9kaWlkZGRpAO0REGR5bkNhbGxfZGlpZGRkaWQA7hEQZHluQ2FsbF9kaWlkZGRpaQDvEQ5keW5DYWxsX2RpaWRkaQDwEQ9keW5DYWxsX2RpaWRkaWQA8REQZHluQ2FsbF9kaWlkZGlkZADyEQ1keW5DYWxsX2RpaWRpAPMRDmR5bkNhbGxfZGlpZGlkAPQREGR5bkNhbGxfZGlpZGlkZGQA9REPZHluQ2FsbF9kaWlkaWRpAPYRDGR5bkNhbGxfZGlpaQD3EQ1keW5DYWxsX2RpaWlpAPgRCmR5bkNhbGxfZmkAgRMLZHluQ2FsbF9maWkAghMNZHluQ2FsbF9maWlpaQCDEw5keW5DYWxsX2ZpaWlpaQCEEwlkeW5DYWxsX2kA/REKZHluQ2FsbF9paQD+EQtkeW5DYWxsX2lpZAD/EQxkeW5DYWxsX2lpZmkAhRMLZHluQ2FsbF9paWkAgRIMZHluQ2FsbF9paWlkAIISDWR5bkNhbGxfaWlpZmkAhhMMZHluQ2FsbF9paWlpAIQSDWR5bkNhbGxfaWlpaWQAhRINZHluQ2FsbF9paWlpZgCHEw1keW5DYWxsX2lpaWlpAIcSDmR5bkNhbGxfaWlpaWlkAIgSDmR5bkNhbGxfaWlpaWlpAIkSD2R5bkNhbGxfaWlpaWlpZACKEg9keW5DYWxsX2lpaWlpaWkAixIQZHluQ2FsbF9paWlpaWlpaQCMEhFkeW5DYWxsX2lpaWlpaWlpaQCNEg5keW5DYWxsX2lpaWlpagCIEwlkeW5DYWxsX3YAjxIKZHluQ2FsbF92aQCQEgtkeW5DYWxsX3ZpZACREgxkeW5DYWxsX3ZpZGQAkhINZHluQ2FsbF92aWRkZACTEgxkeW5DYWxsX3ZpZGkAlBINZHluQ2FsbF92aWRpZACVEg5keW5DYWxsX3ZpZGlkZACWEg9keW5DYWxsX3ZpZGlkZGQAlxIOZHluQ2FsbF92aWZmaWkAiRMLZHluQ2FsbF92aWkAmRIMZHluQ2FsbF92aWlkAJoSDWR5bkNhbGxfdmlpZGQAmxIOZHluQ2FsbF92aWlkZGQAnBINZHluQ2FsbF92aWlkaQCdEg5keW5DYWxsX3ZpaWRpZACeEg9keW5DYWxsX3ZpaWRpZGQAnxIQZHluQ2FsbF92aWlkaWRkZACgEgxkeW5DYWxsX3ZpaWYAihMPZHluQ2FsbF92aWlmZmlpAIsTDGR5bkNhbGxfdmlpaQCjEg1keW5DYWxsX3ZpaWlkAKQSDWR5bkNhbGxfdmlpaWYAjBMNZHluQ2FsbF92aWlpaQCmEg5keW5DYWxsX3ZpaWlpaQCnEg9keW5DYWxsX3ZpaWlpaWkAqBIOZHluQ2FsbF92aWlqaWkAjRMTZXN0YWJsaXNoU3RhY2tTcGFjZQA8C2dsb2JhbEN0b3JzADgKc3RhY2tBbGxvYwA5DHN0YWNrUmVzdG9yZQA7CXN0YWNrU2F2ZQA6CccVAQAjAAuE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EGlEAAAAAAAA8L9EAAAAAAAA8D9EAAAAAAAAAABEAAAAAAAA8D8QZiIDoZ8hByADnyEDIAEoAgQgASgCAGtBA3UhBCAFRAAAAAAAAAAAOQMAIAAgBCAFEK8BIABBBGoiBCgCACAAKAIARgRAIAUkBw8LIAEoAgAhASACKAIAIQIgBCgCACAAKAIAIgRrQQN1IQZBACEAA0AgAEEDdCAEaiAHIABBA3QgAWorAwCiIAMgAEEDdCACaisDAKKgOQMAIABBAWoiACAGSQ0ACyAFJAcLqQEBBH8jByEEIwdBMGokByAEQQhqIgMgADkDACAEQSBqIgVBADYCACAFQQA2AgQgBUEANgIIIAVBARCxASAFIAMgA0EIakEBELMBIAQgATkDACADQQA2AgAgA0EANgIEIANBADYCCCADQQEQsQEgAyAEIARBCGpBARCzASAEQRRqIgYgBSADIAIQWiAGKAIAKwMAIQAgBhCwASADELABIAUQsAEgBCQHIAALIQAgACABOQMAIABEAAAAAAAA8D8gAaE5AwggACACOQMQCyIBAX8gAEEQaiICIAArAwAgAaIgACsDCCACKwMAoqA5AwALBwAgACsDEAsHACAAKwMACwkAIAAgATkDAAsHACAAKwMICwkAIAAgATkDCAsJACAAIAE5AxALEAAgACgCcCAAKAJsa0EDdQsMACAAIAAoAmw2AnALKgEBfCAEIAOhIAEgAiAAIAIgAGMbIgUgBSABYxsgAaEgAiABoaOiIAOgCywBAXwgBCADoyABIAIgACACIABjGyIFIAUgAWMbIAGhIAIgAaGjEL4NIAOiCzABAXwgBCADoSABIAIgACACIABjGyIFIAUgAWMbIAGjELwNIAIgAaMQvA2joiADoAsUACACIAEgACAAIAFjGyAAIAJkGwsHACAAKAI4CwkAIAAgATYCOAsXACAARAAAAAAAQI9Ao0GU4gEoAgC3ogtVAQJ8IAIQbCEDIAArAwAiAiADoSEEIAIgA2YEQCAAIAQ5AwAgBCECCyACRAAAAAAAAPA/YwRAIAAgATkDCAsgACACRAAAAAAAAPA/oDkDACAAKwMICx4AIAEgASABokTsUbgehevRP6JEAAAAAAAA8D+gowsaAEQAAAAAAADwPyACELgNoyABIAKiELgNogscAEQAAAAAAADwPyAAIAIQbqMgACAB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ADkDACAHEF8hAiAGJAcgAgsFABCoBAsFAEHACgtwAQN/IwchBSMHQRBqJAcgBSEGIAEQWSEEIAAoAgAhASAEIAAoAgQiAEEBdWohBCAAQQFxBH8gASAEKAIAaigCAAUgAQshACAGIAQgAhCRAiADEJECIABBD3FB3ABqEQkAOQMAIAYQXyECIAUkByACCwUAEKsECwUAQeAKCzQBAn8jByEBIwdBEGokByAAKAIEIQIgASAAKAIANgIAIAEgAjYCBCABENgBIQAgASQHIAALNAECfyMHIQEjB0EQaiQHIAAoAgQhAiABIAAoAgA2AgAgASACNgIEIAEQ2AEhACABJAcgAAsHACAAELIECwUAELMECwUAELQECwUAELUECwYAQYDDAQsGAEGAwwELBgBBiMMBCwYAQZjDAQt4AQF/QfgAEIURIgBCADcDACAAQgA3AwggAEIANwMQIABCADcDGCAAQgA3AyAgAEIANwMoIABCADcDMCAAQgA3AzggAEFAa0IANwMAIABCADcDSCAAQgA3A1AgAEIANwNYIABCADcDYCAAQgA3A2ggAEIANwNwIAALEAAgAEE/cUH0AWoRAQAQWQsFABC5BAsGAEHk3AELUQEBfyABEFkhBSAAKAIAIQEgBSAAKAIEIgVBAXVqIQAgBUEBcQRAIAEgACgCAGooAgAhAQsgACACEJECIAMQWSAEEJECIAFBAXFBkAlqERAACwUAELwECwUAQfAKCwYAQcSbAgtWAQF/IAEQWSEGIAAoAgAhASAGIAAoAgQiBkEBdWohACAGQQFxBEAgASAAKAIAaigCACEBCyAAIAIQkQIgAxBZIAQQkQIgBRCRAiABQQFxQZIJahERAAsFABDABAsFAEGQCwsGAEHLmwILWwEBfyABEFkhByAAKAIAIQEgByAAKAIEIgdBAXVqIQAgB0EBcQRAIAEgACgCAGooAgAhAQsgACACEJECIAMQWSAEEJECIAUQkQIgBhCRAiABQQFxQZQJahESAAsEAEEHCwUAEMUECwUAQbALCwYAQdObAgsHACAAEMsECwUAEMwECwUAEM0ECwUAEM4ECwYAQajDAQsGAEGowwELBgBBsMMBCwYAQcDDAQtJAQF/QcAAEIURIgBCADcDACAAQgA3AwggAEIANwMQIABCADcDGCAAQgA3AyAgAEIANwMoIABCADcD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uQULBQBB4AwLBgBBkZ0CC3EBA38jByEGIwdBEGokByAGIQUgARBZIQQgACgCACEBIAQgACgCBCIAQQF1aiEEIABBAXEEfyABIAQoAgBqKAIABSABCyEAIAUgAhC9BSAEIAUgAxBZIABBP3FBggVqEQUAEFkhACAFEI0RIAYkByAACwUAEMAFCyUBAX8gASgCACECIABCADcCACAAQQA2AgggACABQQRqIAIQixELEwAgAgRAIAAgASACEM8RGgsgAAsMACAAIAEsAAA6AAALBQBBgA0LBwAgABDFBQsFABDGBQsFABDHBQsFABDIBQsGAEHoxAELBgBB6MQBCwYAQfDEAQsGAEGAxQELEAAgAEE/cUH0AWoRAQAQWQsFABDLBQsGAEHs3QELSwEBfyMHIQYjB0EQaiQHIAAoAgAhACAGIAEQkQIgAhCRAiADEJECIAQQkQIgBRCRAiAAQQNxQRhqERgAOQMAIAYQXyEBIAYkByABCwUAEM4FCwUAQZANCwYAQZyeAgtBAQF/IwchBCMHQRBqJAcgACgCACEAIAQgARCRAiACEJECIAMQkQIgAEEDcUEUahEVADkDACAEEF8hASAEJAcgAQtEAQF/IwchBiMHQRBqJAcgBiABEJECIAIQkQIgAxCRAiAEEJECIAUQkQIgAEEDcUEYahEYADkDACAGEF8hASAGJAcgAQsHACAAENYFCwUAENcFCwUAENgFCwUAENkFCwYAQZDFAQsGAEGQxQELBgBBmMUBCwYAQajFAQtcAQF/QdgAEIURIgBCADcDACAAQgA3AwggAEIANwMQIABCADcDGCAAQgA3AyAgAEIANwMoIABCADcDMCAAQgA3AzggAEFAa0IANwMAIABCADcDSCAAQgA3A1AgAAsQACAAQT9xQfQBahEBABBZCwUAEN0FCwYAQfDdAQt+AQN/IwchCCMHQRBqJAcgCCEJIAEQWSEHIAAoAgAhASAHIAAoAgQiAEEBdWohByAAQQFxBH8gASAHKAIAaigCAAUgAQshACAJIAcgAhCRAiADEJECIAQQWSAFEJECIAYQkQIgAEEBcUGUAWoRGQA5AwAgCRBfIQIgCCQHIAILBQAQ4AULBQBBsA0LBgBBwp4CC38BA38jByEIIwdBEGokByAIIQkgARBZIQcgACgCACEBIAcgACgCBCIAQQF1aiEHIABB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CwcAIAAQ3ggLUwEDfyAAQQRqIQEgACgCAEUEQCABKAIAEMANDwtBACECA0AgASgCACACQQJ0aigCACIDBEAgAxDADQsgAkEBaiICIAAoAgBJDQALIAEoAgAQwA0LBwAgABDfCAtnAQN/IABBCGoiAigCAEUEQA8LIAAoAgQiASgCACAAKAIAQQRqIgMoAgA2AgQgAygCACABKAIANgIAIAJBADYCACAAIAFGBEAPCwNAIAEoAgQhAiABEIcRIAAgAkcEQCACIQEMAQsLCwYAQajKAQsGAEGwygELBgBBwMoBCzABAX8jByEBIwdBEGokByABIABB/wFxQegGahEGACABEIwJIQAgARCJCSABJAcgAAsFABCNCQsZAQF/QQgQhREiAEEANgIAIABBADYCBCAAC18BBH8jByECIwdBEGokB0EIEIURIQMgAkEEaiIEIAEQ6gggAkEIaiIBIAQQ6wggAkEANgIAIAJBDGoiBSACKAIANgIAIAMgACABIAUQ7AggARDtCCAEEOoBIAIkByADCxMAIABFBEAPCyAAEIkJIAAQhxELBQAQigkLBABBAgsJACAAIAEQ9AELCQAgACABEO4IC4oBAQJ/IwchAyMHQSBqJAcgACABNgIAQRQQhREhBCADQQhqIgUgAhDyCCAEQQA2AgQgBEEANgIIIARBpOABNgIAIANBEGoiAiABNgIAIAJBBGogBRD8CCAEQQxqIAIQ/gggAhD2CCAAIAQ2AgQgBRDtCCADIAE2AgAgAyABNgIEIAAgAxDzCCADJAcLBwAgABDqAQsoAQF/IwchAiMHQRBqJAcgAiABEO8IIAAQ8AggAhBZECU2AgAgAiQHCykBAX8jByECIwdBEGokByACIAA2AgAgAiABEOkBEPEBIAIQ8gEgAiQHCwUAEPEICwYAQci+AQsJACAAIAEQ9QgLAwABCzYBAX8jByEBIwdBEGokByABIAAQggkgARDqASABQQRqIgIQ7gEgACACEIMJGiACEOoBIAEkBwsUAQF/IAAgASgCACICNgIAIAIQJAsKACAAQQRqEIAJCxgAIABBpOABNgIAIABBDGoQgQkgABDyAQsMACAAEPcIIAAQhxELGAEBfyAAQRBqIgEgACgCDBD0CCABEO0ICxQAIABBEGpBACABKAIEQcGnAkYbCwcAIAAQhxELCQAgACABEP0ICxMAIAAgASgCADYCACABQQA2AgALGQAgACABKAIANgIAIABBBGogAUEEahD/CAsJACAAIAEQ/AgLBwAgABDtCAsHACAAEPYICwsAIAAgAUELEIQJCxwAIAAoAgAQIyAAIAEoAgA2AgAgAUEANgIAIAALQQEBfyMHIQMjB0EQaiQHIAMQhQkgACABKAIAIANBCGoiABCGCSAAEIcJIAMQWSACQQ9xQcgFahEoABD0ASADJAcLHwEBfyMHIQEjB0EQaiQHIAEgADYCACABEPIBIAEkBwsEAEEACwUAEIgJCwYAQcj/AgtKAQJ/IAAoAgQiAEUEQA8LIABBBGoiAigCACEBIAIgAUF/ajYCACABBEAPCyAAKAIAKAIIIQEgACABQf8BcUHoBmoRBgAgABCCEQsGAEHgygELBgBB46gCCzIBAn9BCBCFESIBIAAoAgA2AgAgASAAQQRqIgIoAgA2AgQgAEEANgIAIAJBADYCACABCwYAQbjgAQsHACAAEI8JC1wBA38jByEBIwdBEGokB0E4EIURIgJBADYCBCACQQA2AgggAkHE4AE2AgAgAkEQaiIDEJMJIAAgAzYCACAAIAI2AgQgASADNgIAIAEgAzYCBCAAIAEQ8wggASQHCxgAIABBxOABNgIAIABBEGoQlQkgABDyAQsMACAAEJAJIAAQhxELCgAgAEEQahDbCAstAQF/IABBEGoQlAkgAEQAAAAAAAAAADkDACAAQRhqIgFCADcDACABQgA3AwgLWgECfyAAQZTiASgCALdEAAAAAAAA4D+iqyIBNgIAIABBBGoiAiABQQJ0EL8NNgIAIAFFBEAPC0EAIQADQCACKAIAIABBAnRqQQA2AgAgASAAQQFqIgBHDQALCwcAIAAQ2wgLHgAgACAANgIAIAAgADYCBCAAQQA2AgggACABNgIMC0gBAX8gARBZIQMgACgCACEBIAMgACgCBCIDQQF1aiEAIANBAXEEQCABIAAoAgBqKAIAIQELIAAgAhBZIAFB/wBxQZgJahECAAsFABCZCQsGAEHY4AELZwIDfwF8IwchAyMHQRBqJAcgAyEEIAEQWSECIAAoAgAhASACIAAoAgQiAEEBdWohAiAAQQFxBH8gASACKAIAaigCAAUgAQshACAEIAIgAEEfcUEcahEKADkDACAEEF8hBSADJAcgBQsFABCcCQsG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Sw0ACxChDEEiNgIAIAhBACADQgGDQgBRGyEIIAMhCwsLIAYoAgAEQCAFIAUoAgBBf2o2AgALIAsgA1oEQCAIQQBHIANCAYNCAFJyRQRAEKEMQSI2AgAgA0J/fCEDDAILIAsgA1YEQBChDEEiNgIADAILCyALIAisIgOFIAN9IQMLCyADC9cBAQV/AkACQCAAQegAaiIDKAIAIgIEQCAAKAJsIAJODQELIAAQqwwiAkEASA0AIAAoAgghAQJAAkAgAygCACIEBEAgASEDIAEgACgCBCIFayAEIAAoAmxrIgRIDQEgACAFIARBf2pqNgJkBSABIQMMAQsMAQsgACABNgJkCyAAQQRqIQEgAwRAIABB7ABqIgAgACgCACADQQFqIAEoAgAiAGtqNgIABSABKAIAIQALIAIgAEF/aiIALQAARwRAIAAgAjoAAAsMAQsgAEEANgJkQX8hAgsgAgsQACAAQSBGIABBd2pBBUlyC00BA38jByEBIwdBEGokByABIQIgABCsDAR/QX8FIAAoAiAhAyAAIAJBASADQT9xQYIFahEFAEEBRgR/IAItAAAFQX8LCyEAIAEkByAAC6EBAQN/IABBygBqIgIsAAAhASACIAEgAUH/AWpyOgAAIABBFGoiASgCACAAQRxqIgIoAgBLBEAgACgCJCEDIABBAEEAIANBP3FBggVqEQUAGgsgAEEANgIQIAJBADYCACABQQA2AgAgACgCACIBQQRxBH8gACABQSByNgIAQX8FIAAgACgCLCAAKAIwaiICNgIIIAAgAjYCBCABQRt0QR91CwsLACAAIAEgAhCuDAsWACAAIAEgAkKAgICAgICAgIB/EKYMCyIAIAC9Qv///////////wCDIAG9QoCAgICAgICAgH+DhL8LXAECfyAALAAAIgIgASwAACIDRyACRXIEfyACIQEgAwUDfyAAQQFqIgAsAAAiAiABQQFqIgEsAAAiA0cgAkVyBH8gAiEBIAMFDAELCwshACABQf8BcSAAQf8BcWsLTgECfyACBH8CfwNAIAAsAAAiAyABLAAAIgRGBEAgAEEBaiEAIAFBAWohAUEAIAJBf2oiAkUNAhoMAQsLIANB/wFxIARB/wFxawsFQQALCwoAIABBUGpBCkkLggMBBH8jByEGIwdBgAFqJAcgBkH8AGohBSAGIgRB1OYBKQIANwIAIARB3OYBKQIANwIIIARB5OYBKQIANwIQIARB7OYBKQIANwIYIARB9OYBKQIANwIgIARB/OYBKQIANwIoIARBhOcBKQIANwIwIARBjOcBKQIANwI4IARBQGtBlOcBKQIANwIAIARBnOcBKQIANwJIIARBpOcBKQIANwJQIARBrOcBKQIANwJYIARBtOcBKQIANwJgIARBvOcBKQIANwJoIARBxOcBKQIANwJwIARBzOcBKAIANgJ4AkACQCABQX9qQf7///8HTQ0AIAEEfxChDEHLADYCAEF/BSAFIQBBASEBDAELIQAMAQsgBEF+IABrIgUgASABIAVLGyIHNgIwIARBFGoiASAANgIAIAQgADYCLCAEQRBqIgUgACAHaiIANgIAIAQgADYCHCAEIAIgAxC0DCEAIAcEQCABKAIAIgEgASAFKAIARkEfdEEfdWpBADoAAAsLIAYkByAAC4sDAQx/IwchBCMHQeABaiQHIAQhBSAEQaABaiIDQgA3AwAgA0IANwMIIANCADcDECADQgA3AxggA0IANwMgIARB0AFqIgcgAigCADYCAEEAIAEgByAEQdAAaiICIAMQtQxBAEgEf0F/BSAAKAJMQX9KBH8gABDSAQVBAAshCyAAKAIAIgZBIHEhDCAALABKQQFIBEAgACAGQV9xNgIACyAAQTBqIgYoAgAEQCAAIAEgByACIAMQtQwhAQUgAEEsaiIIKAIAIQkgCCAFNgIAIABBHGoiDSAFNgIAIABBFGoiCiAFNgIAIAZB0AA2AgAgAEEQaiIOIAVB0ABqNgIAIAAgASAHIAIgAxC1DCEBIAkEQCAAKAIkIQIgAEEAQQAgAkE/cUGCBWoRBQAaIAFBfyAKKAIAGyEBIAggCTYCACAGQQA2AgAgDkEANgIAIA1BADYCACAKQQA2AgALC0F/IAEgACgCACICQSBxGyEBIAAgAiAMcjYCACALBEAgABDyAQsgAQshACAEJAcgAAvfEwIWfwF+IwchESMHQUBrJAcgEUEoaiELIBFBPGohFiARQThqIgwgATYCACAAQQBHIRMgEUEoaiIVIRQgEUEnaiEXIBFBMGoiGEEEaiEaQQAhAUEAIQhBACEFAkACQANAAkADQCAIQX9KBEAgAUH/////ByAIa0oEfxChDEHLADYCAEF/BSABIAhqCyEICyAMKAIAIgosAAAi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AANAIAAhAwNAIANBAWohACADLAAABEAgACEDDAELCyACQX9qIgINAAsLIAAgASgCFBDIDAsJACAAIAEQyQwLIgEBfyABBH8gASgCACABKAIEIAAQygwFQQALIgIgACACGwvpAgEKfyAAKAIIIAAoAgBBotrv1wZqIgYQywwhBCAAKAIMIAYQywwhBSAAKAIQIAYQywwhAyAEIAFBAnZJBH8gBSABIARBAnRrIgdJIAMgB0lxBH8gAyAFckEDcQR/QQAFAn8gBUECdiEJIANBAnYhCkEAIQUDQAJAIAkgBSAEQQF2IgdqIgtBAXQiDGoiA0ECdCAAaigCACAGEMsMIQhBACADQQFqQQJ0IABqKAIAIAYQywwiAyABSSAIIAEgA2tJcUUNAhpBACAAIAMgCGpqLAAADQIaIAIgACADahCwDCIDRQ0AIANBAEghA0EAIARBAUYNAhogBSALIAMbIQUgByAEIAdrIAMbIQQMAQsLIAogDGoiAkECdCAAaigCACAGEMsMIQQgAkEBakECdCAAaigCACAGEMsMIgIgAUkgBCABIAJrSXEEf0EAIAAgAmogACACIARqaiwAABsFQQALCwsFQQALBUEACwsMACAAEM0RIAAgARsL/wEBBH8CQAJAIAJBEGoiBCgCACIDDQAgAhDNDAR/QQAFIAQoAgAhAwwBCyECDAELIAJBFGoiBigCACIFIQQgAyAFayABSQRAIAIoAiQhAyACIAAgASADQT9xQYIFahEFACECDAELIAFFIAIsAEtBAEhyBH9BAAUCfyABIQMDQCAAIANBf2oiBWosAABBCkcEQCAFBEAgBSEDDAIFQQAMAwsACwsgAigCJCEEIAIgACADIARBP3FBggVqEQUAIgIgA0kNAiAAIANqIQAgASADayEBIAYoAgAhBCADCwshAiAEIAAgARDPERogBiABIAYoAgBqNgIAIAEgAmohAgsgAgtpAQJ/IABBygBqIgIsAAAhASACIAEgAUH/AWpyOgAAIAAoAgAiAUEIcQR/IAAgAUEgcjYCAEF/BSAAQQA2AgggAEEANgIEIAAgACgCLCIBNgIcIAAgATYCFCAAIAEgACgCMGo2AhBBAAsLOwECfyACIAAoAhAgAEEUaiIAKAIAIgRrIgMgAyACSxshAyAEIAEgAxDPERogACAAKAIAIANqNgIAIAILBgBB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IQILIAMkByACCy4BAn8gABCJDSIBKAIANgI4IAEoAgAiAgRAIAIgADYCNAsgASAANgIAEIoNIAALDABBuIADEAZBwIADCwgAQbiAAxARC8UBAQZ/IAAoAkxBf0oEfyAAENIBBUEACyEEIAAQgg0gACgCAEEBcUEARyIFRQRAEIkNIQIgACgCNCIBIQYgAEE4aiEDIAEEQCABIAMoAgA2AjgLIAMoAgAiASEDIAEEQCABIAY2AjQLIAAgAigCAEYEQCACIAM2AgALEIoNCyAAEIwNIQIgACgCDCEBIAAgAUH/AXFBtAJqEQQAIAJyIQIgACgCXCIBBEAgARDADQsgBQRAIAQEQCAAEPIBCwUgABDADQsgAgurAQECfyAABEACfyAAKAJMQX9MBEAgABCNDQwBCyAAENIBRSECIAAQjQ0hASACBH8gAQUgABDyASABCwshAAVB0OYBKAIABH9B0OYBKAIAEIwNBUEACyEAEIkNKAIAIgEEQANAIAEoAkxBf0oEfyABENIBBUEACyECIAEoAhQgASgCHEsEQCABEI0NIAByIQALIAIEQCABEPIBCyABKAI4IgENAAsLEIoNCyAAC6QBAQd/An8CQCAAQRRqIgIoAgAgAEEcaiIDKAIATQ0AIAAoAiQhASAAQQBBACABQT9xQYIFahEFABogAigCAA0AQX8MAQsgAEEEaiIBKAIAIgQgAEEIaiIFKAIAIgZJBEAgACgCKCEHIAAgBCAGa0EBIAdBP3FBggVqEQUAGgsgAEEANgIQIANBADYCACACQQA2AgAgBUEANgIAIAFBADYCAEEACwsnAQF/IwchAyMHQRBqJAcgAyACNgIAIAAgASADEI8NIQAgAyQHIAALsAEBAX8jByEDIwdBgAFqJAcgA0IANwIAIANCADcCCCADQgA3AhAgA0IANwIYIANCADcCICADQgA3AiggA0IANwIwIANCADcCOCADQUBrQgA3AgAgA0IANwJIIANCADcCUCADQgA3AlggA0IANwJgIANCADcCaCADQgA3AnAgA0EANgJ4IANBKjYCICADIAA2AiwgA0F/NgJMIAMgADYCVCADIAEgAhCRDSEAIAMkByAACwsAIAAgASACEJUNC8MWAxx/AX4BfCMHIRUjB0GgAmokByAVQYgCaiEUIBUiDEGEAmohFyAMQZACaiEYIAAoAkxB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AUH/AXFB6AZqEQYACwtXAQF/An8CQAN/An8gAyAERg0CQX8gASACRg0AGkF/IAEsAAAiACADLAAAIgVIDQAaIAUgAEgEf0EBBSADQQFqIQMgAUEBaiEBDAILCwsMAQsgASACRwsLGQAgAEIANwIAIABBADYCCCAAIAIgAxCYDgs/AQF/QQAhAANAIAEgAkcEQCABLAAAIABBBHRqIgBBgICAgH9xIgMgA0EYdnIgAHMhACABQQFqIQEMAQsLIAALpgEBBn8jByEGIwdBEGokByAGIQcgAiABIgNrIgRBb0sEQCAAENAPCyAEQQtJBEAgACAEOgALBSAAIARBEGpBcHEiCBCFESIFNgIAIAAgCEGAgICAeHI2AgggACAENgIEIAUhAAsgAiADayEFIAAhAwNAIAEgAkcEQCADIAEQvwUgAUEBaiEBIANBAWohAwwBCwsgB0EAOgAAIAAgBWogBxC/BSAGJAcLDAAgABCSDiAAEIcRC1cBAX8CfwJAA38CfyADIARGDQJBfyABIAJGDQAaQX8gASgCACIAIAMoAgAiBUgNABogBSAASAR/QQEFIANBBGohAyABQQRqIQEMAgsLCwwBCyABIAJHCwsZACAAQgA3AgAgAEEANgIIIAAgAiADEJ0OC0EBAX9BACEAA0AgASACRwRAIAEoAgAgAEEEdGoiA0GAgICAf3EhACADIAAgAEEYdnJzIQAgAUEEaiEBDAELCyAAC68BAQV/IwchBSMHQRBqJAcgBSEGIAIgAWtBAnUiBEHv////A0sEQCAAENAPCyAEQQJJBEAgACAEOgALIAAhAwUgBEEEakF8cSIHQf////8DSwRAECYFIAAgB0ECdBCFESIDNgIAIAAgB0GAgICAeHI2AgggACAENgIECwsDQCABIAJHBEAgAyABEJ4OIAFBBGohASADQQRqIQMMAQsLIAZBADYCACADIAYQng4gBSQHCwwAIAAgASgCADYCAAsMACAAEPIBIAAQhxELjQMBCH8jByEIIwdBMGokByAIQShqIQcgCCIGQSBqIQkgBkEkaiELIAZBHGohDCAGQRhqIQ0gAygCBEEBcQRAIAcgAxDsDSAHQdCMAxCrDiEKIAcQrA4gByADEOwNIAdB4IwDEKsOIQMgBxCsDiADKAIAKAIYIQAgBiADIABB/wBxQZgJahECACADKAIAKAIcIQAgBkEMaiADIABB/wBxQZgJahECACANIAIoAgA2AgAgByANKAIANgIAIAUgASAHIAYgBkEYaiIAIAogBEEBEM4OIAZGOgAAIAEoAgAhAQNAIABBdGoiABCNESAAIAZHDQALBSAJQX82AgAgACgCACgCECEKIAsgASgCADYCACAMIAIoAgA2AgAgBiALKAIANgIAIAcgDCgCADYCACABIAAgBiAHIAMgBCAJIApBP3FBhAZqETAANgIAAkACQAJAAkAgCSgCAA4CAAECCyAFQQA6AAAMAgsgBUEBOgAADAELIAVBAToAACAEQQQ2AgALIAEoAgAhAQsgCCQHIAELXQECfyMHIQYjB0EQaiQHIAZBBGoiByABKAIANgIAIAYgAigCADYCACAGQQhqIgEgBygCADYCACAGQQxqIgIgBigCADYCACAAIAEgAiADIAQgBRDMDiEAIAYkByAAC10BAn8jByEGIwdBEGokByAGQQRqIgcgASgCADYCACAGIAIoAgA2AgAgBkEIaiIBIAcoAgA2AgAgBkEMaiICIAYoAgA2AgAgACABIAIgAyAEIAUQyg4hACAGJAcgAAtdAQJ/IwchBiMHQRBqJAcgBkEEaiIHIAEoAgA2AgAgBiACKAIANgIAIAZBCGoiASAHKAIANgIAIAZBDGoiAiAGKAIANgIAIAAgASACIAMgBCAFEMgOIQAgBiQHIAALXQECfyMHIQYjB0EQaiQHIAZBBGoiByABKAIANgIAIAYgAigCADYCACAGQQhqIgEgBygCADYCACAGQQxqIgIgBigCADYCACAAIAEgAiADIAQgBRDHDiEAIAYkByAAC10BAn8jByEGIwdBEGokByAGQQRqIgcgASgCADYCACAGIAIoAgA2AgAgBkEIaiIBIAcoAgA2AgAgBkEMaiICIAYoAgA2AgAgACABIAIgAyAEIAUQxQ4hACAGJAcgAAtdAQJ/IwchBiMHQRBqJAcgBkEEaiIHIAEoAgA2AgAgBiACKAIANgIAIAZBCGoiASAHKAIANgIAIAZBDGoiAiAGKAIANgIAIAAgASACIAMgBCAFEL8OIQAgBiQHIAALXQECfyMHIQYjB0EQaiQHIAZBBGoiByABKAIANgIAIAYgAigCADYCACAGQQhqIgEgBygCADYCACAGQQxqIgIgBigCADYCACAAIAEgAiADIAQg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HCAHQTRqIR0gB0EwaiEeIAdBLGohHyAHQShqISAgB0EkaiEhIAdBIGohIiAHQRxqISMgB0EYaiEkIAdBFGohJSAHQRBqISYgB0EMaiEnIAdBCGohKCAHQQRqISkgByELIARBADYCACAHQYABaiIIIAMQ7A0gCEHQjAMQqw4hCSAIEKwOAn8CQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQCAGQRh0QRh1QSVrDlUWFxcXFxcXFxcXFxcXFxcXFxcXFxcXFxcXFxcXAAEXBBcFFwYHFxcXChcXFxcODxAXFxcTFRcXFxcXFxcAAQIDAxcXARcIFxcJCxcMFw0XCxcXERIUFwsgDCACKAIANgIAIAggDCgCADYCACAAIAVBGGogASAIIAQgCRCUDwwXCyANIAIoAgA2AgAgCCANKAIANgIAIAAgBUEQaiABIAggBCAJEJUPDBYLIABBCGoiBigCACgCDCELIAYgC0H/AXFBtAJqEQQAIQYgDiABKAIANgIAIA8gAigCADYCACAGKAIAIAYgBiwACyICQQBIIgsbIgkgBigCBCACQf8BcSALG2ohAiAKIA4oAgA2AgAgCCAPKAIANgIAIAEgACAKIAggAyAEIAUgCSACEJYPNgIADBULIBAgAigCADYCACAIIBAoAgA2AgAgACAFQQxqIAEgCCAEIAkQlw8MFAsgESABKAIANgIAIBIgAigCADYCACAKIBEoAgA2AgAgCCASKAIANgIAIAEgACAKIAggAyAEIAVBlM0CQZzNAhCWDzYCAAwTCyATIAEoAgA2AgAgFCACKAIANgIAIAogEygCADYCACAIIBQoAgA2AgAgASAAIAogCCADIAQgBUGczQJBpM0CEJYPNgIADBILIBUgAigCADYCACAIIBUoAgA2AgAgACAFQQhqIAEgCCAEIAkQmA8MEQsgFiACKAIANgIAIAggFigCADYCACAAIAVBCGogASAIIAQgCRCZDwwQCyAXIAIoAgA2AgAgCCAXKAIANgIAIAAgBUEcaiABIAggBCAJEJoPDA8LIBggAigCADYCACAIIBgoAgA2AgAgACAFQRBqIAEgCCAEIAkQmw8MDgsgGSACKAIANgIAIAggGSgCADYCACAAIAVBBGogASAIIAQgCRCcDwwNCyAaIAIoAgA2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AgMDFxcBFwgXFwkLFwwXDRcLFxcREhQXCyAMIAIoAgA2AgAgCCAMKAIANgIAIAAgBUEYaiABIAggBCAJELYPDBcLIA0gAigCADYCACAIIA0oAgA2AgAgACAFQRBqIAEgCCAEIAkQtw8MFgsgAEEIaiIGKAIAKAIMIQsgBiALQf8BcUG0AmoRBAAhBiAOIAEoAgA2AgAgDyACKAIANgIAIAYoAgAgBiAGLAALIgtBAEgiCRshAiAGKAIEIAtB/wFxIAkbQQJ0IAJqIQYgCiAOKAIANgIAIAggDygCADYCACABIAAgCiAIIAMgBCAFIAIgBhC4DzYCAAwVCyAQIAIoAgA2AgAgCCAQKAIANgIAIAAgBUEMaiABIAggBCAJELkPDBQLIBEgASgCADYCACASIAIoAgA2AgAgCiARKAIANgIAIAggEigCADYCACABIAAgCiAIIAMgBCAFQaC8AUHAvAEQuA82AgAMEwsgEyABKAIANgIAIBQgAigCADYCACAKIBMoAgA2AgAgCCAUKAIANgIAIAEgACAKIAggAyAEIAVBwLwBQeC8ARC4DzYCAAwSCyAVIAIoAgA2AgAgCCAVKAIANgIAIAAgBUEIaiABIAggBCAJELoPDBELIBYgAigCADYCACAIIBYoAgA2AgAgACAFQQhqIAEgCCAEIAkQuw8MEAsgFyACKAIANgIAIAggFygCADYCACAAIAVBHGogASAIIAQgCRC8DwwPCyAYIAIoAgA2AgAgCCAYKAIANgIAIAAgBUEQaiABIAggBCAJEL0PDA4LIBkgAigCADYCACAIIBkoAgA2AgAgACAFQQRqIAEgCCAEIAkQvg8MDQsgGiACKAIANgIAIAggGigCADYCACAAIAEgCCAEIAkQvw8MDAsgGyACKAIANgIAIAggGygCADYCACAAIAVBCGogASAIIAQgCRDADwwLCyAcIAEoAgA2AgAgHSACKAIANgIAIAogHCgCADYCACAIIB0oAgA2AgAgASAAIAogCCADIAQgBUHgvAFBjL0BELgPNgIADAoLIB4gASgCADYCACAfIAIoAgA2AgAgCiAeKAIANgIAIAggHygCADYCACABIAAgCiAIIAMgBCAFQZC9AUGkvQEQuA82AgAMCQsgICACKAIANgIAIAggICgCADYCACAAIAUgASAIIAQgCRDBDwwICyAhIAEo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IAAgAkkgASAATXEL7wwBA38jByEMIwdBEGokByAMQQxqIQsgDCEKIAkgAAR/IAFBuI4DEKsOIgEoAgAoAiwhACALIAEgAEH/AHFBmAlqEQIAIAIgCygCADYAACABKAIAKAIgIQAgCiABIABB/wBxQZgJahECACAIQQtqIgAsAABBAEgEfyAIKAIAIQAgC0EAOgAAIAAgCxC/BSAIQQA2AgQgCAUgC0EAOgAAIAggCxC/BSAAQQA6AAAgCAshACAIQQAQkhEgACAKKQIANwIAIAAgCigCCDYCCEEAIQADQCAAQQNHBEAgAEECdCAKakEANgIAIABBAWohAAwBCwsgChCNESABKAIAKAIcIQAgCiABIABB/wBxQZgJahECACAHQQtqIgAsAABBAEgEfyAHKAIAIQAgC0EAOgAAIAAgCxC/BSAHQQA2AgQgBwUgC0EAOgAAIAcgCxC/BSAAQQA6AAAgBwshACAHQQAQkhEgACAKKQIANwIAIAAgCigCCDYCCEEAIQADQCAAQQNHBEAgAEECdCAKakEANgIAIABBAWohAAwBCwsgChCNESABKAIAKAIMIQAgAyABIABB/wFxQbQCahEEADoAACABKAIAKAIQIQAgBCABIABB/wFxQbQCahEEADoAACABKAIAKAIUIQAgCiABIABB/wBxQZgJahECACAFQQtqIgAsAABBAEgEfyAFKAIAIQAgC0EAOgAAIAAgCxC/BSAFQQA2AgQgBQUgC0EAOgAAIAUgCxC/BSAAQQA6AAAgBQshACAFQQAQkhEgACAKKQIANwIAIAAgCigCCDYCCEEAIQADQCAAQQNHBEAgAEECdCAKakEANgIAIABBAWohAAwBCwsgChCNESABKAIAKAIYIQAgCiABIABB/wBxQZgJahECACAGQQtqIgAsAABBAEgEfyAGKAIAIQAgC0EAOgAAIAAgCxC/BSAGQQA2AgQgBgUgC0EAOgAAIAYgCxC/BSAAQQA6AAAgBgshACAGQQAQkhEgACAKKQIANwIAIAAgCigCCDYCCEEAIQADQCAAQQNHBEAgAEECdCAKakEANgIAIABBAWohAAwBCwsgChCNESABKAIAKAIkIQAgASAAQf8BcUG0AmoRBAAFIAFBsI4DEKsOIgEoAgAoAiwhACALIAEgAEH/AHFBmAlqEQIAIAIgCygCADYAACABKAIAKAIgIQAgCiABIABB/wBxQZgJahECACAIQQtqIgAsAABBAEgEfyAIKAIAIQAgC0EAOgAAIAAgCxC/BSAIQQA2AgQgCAUgC0EAOgAAIAggCxC/BSAAQQA6AAAgCAshACAIQQAQkhEgACAKKQIANwIAIAAgCigCCDYCCEEAIQADQCAAQQNHBEAgAEECdCAKakEANgIAIABBAWohAAwBCwsgChCNESABKAIAKAIcIQAgCiABIABB/wBxQZgJahECACAHQQtqIgAsAABBAEgEfyAHKAIAIQAgC0EAOgAAIAAgCxC/BSAHQQA2AgQgBwUgC0EAOgAAIAcgCxC/BSAAQQA6AAAgBwshACAHQQAQkhEgACAKKQIANwIAIAAgCigCCDYCCEEAIQADQCAAQQNHBEAgAEECdCAKakEANgIAIABBAWohAAwBCwsgChCNESABKAIAKAIMIQAgAyABIABB/wFxQbQCahEEADoAACABKAIAKAIQIQAgBCABIABB/wFxQbQCahEEADoAACABKAIAKAIUIQAgCiABIABB/wBxQZgJahECACAFQQtqIgAsAABBAEgEfyAFKAIAIQAgC0EAOgAAIAAgCxC/BSAFQQA2AgQgBQUgC0EAOgAAIAUgCxC/BSAAQQA6AAAgBQshACAFQQAQkhEgACAKKQIANwIAIAAgCigCCDYCCEEAIQADQCAAQQNHBEAgAEECdCAKakEANgIAIABBAWohAAwBCwsgChCNESABKAIAKAIYIQAgCiABIABB/wBxQZgJahECACAGQQtqIgAsAABBAEgEfyAGKAIAIQAgC0EAOgAAIAAgCxC/BSAGQQA2AgQgBgUgC0EAOgAAIAYgCxC/BSAAQQA6AAAgBgshACAGQQAQkhEgACAKKQIANwIAIAAgCigCCDYCCEEAIQADQCAAQQNHBEAgAEECdCAKakEANgIAIABBAWohAAwBCwsgChCNESABKAIAKAIkIQAgASAAQf8BcUG0AmoRBAALNgIAIAwkBwu2AQEFfyACKAIAIAAoAgAiBSIGayIEQQF0IgNBASADG0F/IARB/////wdJGyEHIAEoAgAgBmshBiAFQQAgAEEEaiIFKAIAQawBRyIEGyAHEMENIgNFBEAQhBELIAQEQCAAIAM2AgAFIAAoAgAhBCAAIAM2AgAgBARAIAUoAgAhAyAEIANB/wFxQegG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ahECACAHQQtqIgAsAABBAEgEQCAHKAIAIQAgC0EANgIAIAAgCxCeDiAHQQA2AgQFIAtBADYCACAHIAsQng4gAEEAOgAACyAHQQAQnxEgByAKKQIANwIAIAcgCigCCDYCCEEAIQADQCAAQQNHBEAgAEECdCAKakEANgIAIABBAWohAAwBCwsgChCNESABKAIAKAIMIQAgAyABIABB/wFxQbQCahEEADYCACABKAIAKAIQIQAgBCABIABB/wFxQbQCahEEADYCACABKAIAKAIUIQAgCiABIABB/wBxQZgJahECACAFQQtqIgAsAABBAEgEfyAFKAIAIQAgC0EAOgAAIAAgCxC/BSAFQQA2AgQgBQUgC0EAOgAAIAUgCxC/BSAAQQA6AAAgBQshACAFQQAQkhEgACAKKQIANwIAIAAgCigCCDYCCEEAIQADQCAAQQNHBEAgAEECdCAKakEANgIAIABBAWohAAwBCwsgChCNESABKAIAKAIYIQAgCiABIABB/wBxQZgJahECACAGQQtqIgAsAABBAEgEQCAGKAIAIQAgC0EANgIAIAAgCxCeDiAGQQA2AgQFIAtBADYCACAGIAsQng4gAEEAOgAACyAGQQAQnxEgBiAKKQIANwIAIAYgCigCCDYCCEEAIQADQCAAQQNHBEAgAEECdCAKakEANgIAIABBAWohAAwBCwsgChCNESABKAIAKAIkIQAgASAAQf8BcUG0AmoRBAAFIAFBwI4DEKsOIgEoAgAoAiwhACALIAEgAEH/AHFBmAlqEQIAIAIgCygCADYAACABKAIAKAIgIQAgCiABIABB/wBxQZgJahECACAIQQtqIgAsAABBAEgEQCAIKAIAIQAgC0EANgIAIAAgCxCeDiAIQQA2AgQFIAtBADYCACAIIAsQng4gAEEAOgAACyAIQQAQnxEgCCAKKQIANwIAIAggCigCCDYCCEEAIQADQCAAQQNHBEAgAEECdCAKakEANgIAIABBAWohAAwBCwsgChCNESABKAIAKAIcIQAgCiABIABB/wBxQZgJahECACAHQQtqIgAsAABBAEgEQCAHKAIAIQAgC0EANgIAIAAgCxCeDiAHQQA2AgQFIAtBADYCACAHIAsQng4gAEEAOgAACyAHQQAQnxEgByAKKQIANwIAIAcgCigCCDYCCEEAIQADQCAAQQNHBEAgAEEC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ACALKAIINgIIQQAhAANAIABBA0cEQCAAQQJ0IAtqQQA2AgAgAEEBaiEADAELCyALEI0RIAIoAgAoAhghACALIAIgAEH/AHFBmAlqEQIAIAdBC2oiACwAAEEASARAIAcoAgAhACAKQQA2AgAgACAKEJ4OIAdBADYCBAUgCkEANgIAIAcgChCeDiAAQQA6AAALIAdBABCfESAHIAspAgA3AgAgByALKAIINgIIQQAhAANAIABBA0cEQCAAQQJ0IAtqQQA2AgAgAEEBaiEADAELCyALEI0RIAIoAgAoAiQhACACIABB/wFxQbQCahEEAAUgAkHAjgMQqw4hAiABBEAgAigCACgCLCEAIAogAiAAQf8AcUGYCWoRAgAgAyAKKAIANgAAIAIoAgAoAiAhACALIAIgAEH/AHFBmAlqEQIAIAhBC2oiACwAAEEASARAIAgoAgAhACAKQQA2AgAgACAKEJ4OIAhBADYCBAUgCkEANgIAIAggChCeDiAAQQA6AAALIAhBABCfESAIIAspAgA3AgAgCCALKAIINgIIQQAhAANAIABBA0cEQCAAQQJ0IAtqQQA2AgAgAEEBaiEADAELCyALEI0RBSACKAIAKAIoIQAgCiACIABB/wBxQZgJahECACADIAooAgA2AAAgAigCACgCHCEAIAsgAiAAQf8AcUGYCWoRAgAgCEELaiIALAAAQQBIBEAgCCgCACEAIApBADYCACAAIAoQng4gCEEANgIEBSAKQQA2AgAgCCAKEJ4OIABBADoAAAsgCEEAEJ8RIAggCykCADcCACAIIAsoAgg2AghBACEAA0AgAEEDRwRAIABBAnQgC2pBADYCACAAQQFqIQAMAQsLIAsQjRELIAIoAgAoAgwhACAEIAIgAEH/AXFBtAJqEQQANgIAIAIoAgAoAhAhACAFIAIgAEH/AXFBtAJqEQQANgIAIAIoAgAoAhQhACALIAIgAEH/AHFBmAlqEQIAIAZBC2oiACwAAEEASAR/IAYoAgAhACAKQQA6AAAgACAKEL8FIAZBADYCBCAGBSAKQQA6AAAgBiAKEL8FIABBADoAACAGCyEAIAZBABCSESAAIAspAgA3AgAgACALKAIINgIIQQAhAANAIABBA0cEQCAAQQJ0IAtqQQA2AgAgAEEBaiEADAELCyALEI0RIAIoAgAoAhghACALIAIgAEH/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QQJ0aigCAEH/AXEFIAELC0UAA0AgASACRwRAIAEsAAAiAEF/SgRAEJMQIQAgASwAAEECdCAAaigCAEH/AXEhAAsgASAAOgAAIAFBAWohAQwBCwsgAgspACABQRh0QRh1QX9KBH8QkhAgAUEYdEEYdUECdGooAgBB/wFxBSABCwtFAANAIAEgAkcEQCABLAAAIgBBf0oEQBCSECEAIAEsAABBAnQgAGooAgBB/wFxIQALIAEgADoAACABQQFqIQEMAQsLIAILBAAgAQspAANAIAEgAkcEQCADIAEsAAA6AAAgA0EBaiEDIAFBAWohAQwBCwsgAgsSACABIAIgAUEYdEEYdUF/ShsLMwADQCABIAJHBEAgBCABLAAAIgAgAyAAQX9KGzoAACAEQQFqIQQgAUEBaiEBDAELCyACCwgAENEMKAIACwgAENIMKAIACwgAEM8MKAIACxgAIABB4P8BNgIAIABBDGoQjREgABDyAQsMACAAEJUQIAAQhxELBwAgACwACAsHACAALAAJCwwAIAAgAUEMahCKEQsgACAAQgA3AgAgAEEANgIIIABB4tcCQeLXAhCvChCLEQsgACAAQgA3AgAgAEEANgIIIABB3NcCQdzXAhCvChCLEQsYACAAQYiAAjYCACAAQRBqEI0RIAAQ8gELDAAgABCcECAAEIcRCwcAIAAoAggLBwAgACgCDAsMACAAIAFBEGoQihELIAAgAEIANwIAIABBADYCCCAAQcCAAkHAgAIQsg8QmRELIAAgAEIANwIAIABBADYCCCAAQaiAAkGogAIQsg8QmRELJQAgAkGAAUkEfyABEJQQIAJBAXRqLgEAcUH//wNxQQBHBUEACwtGAANAIAEgAkcEQCADIAEoAgBBgAFJBH8QlBAhACABKAIAQQF0IABqLwEABUEACzsBACADQQJqIQMgAUEEaiEBDAELCyACC0oAA0ACQCACIANGBEAgAyECDAELIAIoAgBBgAFJBEAQlBAhACABIAIoAgBBAXQgAGouAQBxQf//A3ENAQsgAkEEaiECDAELCyACC0oAA0ACQCACIANGBEAgAyECDAELIAIoAgBBgAFPDQAQlBAhACABIAIoAgBBAXQgAGouAQBxQf//A3EEQCACQQRqIQIMAgsLCyACCxoAIAFBgAFJBH8QkxAgAUECdGooAgAFIAELC0IAA0Ag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AQECf0FvIAFrIAJJBEAgABDQDwsgACwAC0EASAR/IAAoAgAFIAALIQggAUHn////B0kEf0ELIAFBAXQiByABIAJqIgIgAiAHSRsiAkEQakFwcSACQQtJGwVBbwsiAhCFESEHIAQEQCAHIAggBBC+BRoLIAMgBWsgBGsiAwRAIAYgBCAHamogBSAEIAhqaiADEL4FGgsgAUEKRwRAIAgQhxELIAAgBzYCACAAIAJBgICAgHhyNgIIC8QBAQZ/IwchBSMHQRBqJAcgBSEGIABBC2oiBywAACIDQQBIIggEfyAAKAIEIQMgACgCCEH/////B3FBf2oFIANB/wFxIQNBCgsiBCADayACSQRAIAAgBCACIANqIARrIAMgA0EAIAIgARCREQUgAgRAIAMgCAR/IAAoAgAFIAALIgRqIAEgAhC+BRogAiADaiEBIAcsAABBAEgEQCAAIAE2AgQFIAcgAToAAAsgBkEAOgAAIAEgBGogBhC/BQsLIAUkByAAC8YBAQZ/IwchAyMHQRBqJAcgA0EBaiEEIAMiBiABOgAAIABBC2oiBSwAACIBQQBIIgcEfyAAKAIEIQIgACgCCEH/////B3FBf2oFIAFB/wFxIQJBCgshAQJAAkAgASACRgRAIAAgAUEBIAEgAUEAQQAQlhEgBSwAAEEASA0BBSAHDQELIAUgAkEBajoAAAwBCyAAKAIAIQEgACACQQFqNgIEIAEhAAsgACACaiIAIAYQvwUgBEEAOgAAIABBAWogBBC/BSADJAcLlQEBBH8jByEEIwdBEGokByAEIQUgAkHv////A0sEQCAAENAPCyACQQJJBEAgACACOgALIAAhAwUgAkEEakF8cSIGQf////8DSwRAECYFIAAgBkECdBCFESIDNgIAIAAgBkGAgICAeHI2AgggACACNgIECwsgAyABIAIQ2Q0aIAVBADYCACACQQJ0IANqIAUQng4gBCQHC5UBAQR/IwchBCMHQRBqJAcgBCEFIAFB7////wNLBEAgABDQDwsgAUECSQRAIAAgAToACyAAIQMFIAFBBGpBfHEiBkH/////A0sEQBAmBSAAIAZBAnQQhREiAzYCACAAIAZBgICAgHhyNgIIIAAgATYCBAsLIAMgASACEJsRGiAFQQA2AgAgAUECdCADaiAFEJ4OIAQkBwsWACABBH8gACACIAEQsQ0a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QQFrIgAgAUEBayIBLAAAOgAADAELCyADIQAFIAAgASACEM8RGgsgAAuYAgEEfyAAIAJqIQQgAUH/AXEhASACQcMATgRAA0AgAEEDcQRAIAAgAToAACAAQQFqIQAMAQsLIAFBCHQgAXIgAUEQdHIgAUEYdHIhAyAEQXxxIgVBQGohBgNAIAAgBkwEQCAAIAM2AgAgACADNgIEIAAgAzYCCCAAIAM2AgwgACADNgIQIAAgAzYCFCAAIAM2AhggACADNgIcIAAgAzYCICAAIAM2AiQgACADNgIoIAAgAzYCLCAAIAM2AjAgACADNgI0IAAgAzYCOCAAIAM2AjwgAEFAayEADAELCwNAIAAgBUgEQCAAIAM2AgAgAEEEaiEADAELCwsDQCAAIARIBEAgACABOgAAIABBAWohAAwBCwsgBCACawtKAQJ/IAAjBCgCACICaiIBIAJIIABBAEpxIAFBAEhyBEBBDBAIQX8PCyABECdMBEAjBCABNgIABSABEClFBEBBDBAIQX8PCwsgAgsMACABIABBA3ERHgALEQAgASACIABBD3FBBGoRAAALEwAgASACIAMgAEEDcUEUahEVAAsXACABIAIgAyAEIAUgAEEDcUEYahEYAAsPACABIABBH3FBHGoRCgALEQAgASACIABBH3FBPGoRBwALFAAgASACIAMgAEEPcUHcAGoRCQALFgAgASACIAMgBCAAQQ9xQewAahEIAAsaACABIAIgAyAEIAUgBiAAQQdxQfwAahEaAAseACABIAIgAyAEIAUgBiAHIAggAEEBcUGEAWoRHAALGAAgASACIAMgBCAFIABBAXFBhgFqESsACxoAIAEgAiADIAQgBSAGIABBAXFBiAFqESoACxoAIAEgAiADIAQgBSAGIABBAXFBigFqERsACxYAIAEgAiADIAQgAEEDcUGMAWoRIQALGAAgASACIAMgBCAFIABBA3FBkAFqESkACxoAIAEgAiADIAQgBSAGIABBAXFBlAFqERkACxQAIAEgAiADIABBAXFBlgFqER0ACxYAIAEgAiADIAQgAEEBcUGYAWoRDgALGgAgASACIAMgBCAFIAYgAEEDcUGaAWoRHwALGAAgASACIAMgBCAFIABBAXFBngFqEQ8ACxIAIAEgAiAAQQ9xQaABahEjAAsUACABIAIgAyAAQQdxQbABahE0AAsWACABIAIgAyAEIABBB3FBuAFqETUACxgAIAEgAiADIAQgBSAAQQNxQcABahE2AAscACABIAIgAyAEIAUgBiAHIABBA3FBxAFqETcACyAAIAEgAiADIAQgBSAGIAcgCCAJIABBAXFByAFqETgACxoAIAEgAiADIAQgBSAGIABBAXFBygFqETkACxwAIAEgAiADIAQgBSAGIAcgAEEBcUHMAWoROgALHAAgASACIAMgBCAFIAYgByAAQQFxQc4BahE7AAsYACABIAIgAyAEIAUgAEEDcUHQAWoRPAALGgAgASACIAMgBCAFIAYgAEEDcUHUAWoRPQALHAAgASACIAMgBCAFIAYgByAAQQFxQdgBahE+AAsWACABIAIgAyAEIABBAXFB2gFqET8ACxgAIAEgAiADIAQgBSAAQQFxQdwBahFAAAscACABIAIgAyAEIAUgBiAHIABBA3FB3gFqEUEACxoAIAEgAiADIAQgBSAGIABBAXFB4gFqEUIACxQAIAEgAiADIABBA3FB5AFqEQwACxYAIAEgAiADIAQgAEEBcUHoAWoRQwALEAAgASAAQQNxQeoBahEmAAsSACABIAIgAEEBcUHuAWoRRAALFgAgASACIAMgBCAAQQFxQfABahEnAAsYACABIAIgAyAEIAUgAEEBcUHyAWoRRQALDgAgAEE/cUH0AWoRAQALEQAgASAAQf8BcUG0AmoRBAALEgAgASACIABBA3FBtARqESAACxQAIAEgAiADIABBA3FBuARqESUACxIAIAEgAiAAQT9xQbwEahEsAAsUACABIAIgAyAAQQFxQfwEahFGAAsWACABIAIgAyAEIABBA3FB/gRqEUcACxQAIAEgAiADIABBP3FBggVqEQUACxYAIAEgAiADIAQgAEEDcUHCBWoRSAALFgAgASACIAMgBCAAQQFxQcYFahFJAAsWACABIAIgAyAEIABBD3FByAVqESgACxgAIAEgAiADIAQgBSAAQQdxQdgFahFKAAsYACABIAIgAyAEIAUgAEEfcUHgBWoRLQALGgAgASACIAMgBCAFIAYgAEEDcUGABmoRSwALGgAgASACIAMgBCAFIAYgAEE/cUGEBmoRMAALHAAgASACIAMgBCAFIAYgByAAQQdxQcQGahFMAAseACABIAIgAyAEIAUgBiAHIAggAEEPcUHMBmoRLgALGAAgASACIAMgBCAFIABBB3FB3AZqEU0ACw4AIABBA3FB5AZqETEACxEAIAEgAEH/AXFB6AZqEQYACxIAIAEgAiAAQR9xQegIahELAAsUACABIAIgAyAAQQFxQYgJahEWAAsWACABIAIgAyAEIABBAXFBiglqERMACxQAIAEgAiADIABBA3FBjAlqESIACxYAIAEgAiADIAQgAEEBcUGQCWoREAALGAAgASACIAMgBCAFIABBAXFBkglqEREACxoAIAEgAiADIAQgBSAGIABBAXFBlAlqERIACxgAIAEgAiADIAQgBSAAQQFxQZYJahEXAAsTACABIAIgAEH/AHFBmAlqEQIACxQAIAEgAiADIABBD3FBmApqEQ0ACxYAIAEgAiADIAQgAEEBcUGoCmoRTgALGAAgASACIAMgBCAFIABBAXFBqgpqEU8ACxYAIAEgAiADIAQgAEEDcUGsCmoRUAALGAAgASACIAMgBCAFIABBAXFBsApqEVEACxoAIAEgAiADIAQgBSAGIABBAXFBsgpqEVIACxwAIAEgAiADIAQgBSAGIAcgAEEBcUG0CmoRUwALFAAgASACIAMgAEEBcUG2CmoRVAALGgAgASACIAMgBCAFIAYgAEEBcUG4CmoRVQALFAAgASACIAMgAEEfcUG6CmoRAwALFgAgASACIAMgBCAAQQNxQdoKahEUAAsWACABIAIgAyAEIABBAXFB3gpqEVYACxYAIAEgAiADIAQgAEEPcUHgCmoRJAALGAAgASACIAMgBCAFIABBB3FB8ApqETMACxoAIAEgAiADIAQgBSAGIABBB3FB+ApqETIACxgAIAEgAiADIAQgBSAAQQNxQYALahEvAAsPAEEAEABEAAAAAAAAAAALDwBBARAARAAAAAAAAAAACw8AQQIQAEQAAAAAAAAAAAsPAEEDEABEAAAAAAAAAAALDwBBBBAARAAAAAAAAAAACw8AQQUQAEQAAAAAAAAAAAsPAEEGEABEAAAAAAAAAAALDwBBBxAARAAAAAAAAAAACw8AQQgQAEQAAAAAAAAAAAsPAEEJEABEAAAAAAAAAAALDwBBChAARAAAAAAAAAAACw8AQQsQAEQAAAAAAAAAAAsPAEEMEABEAAAAAAAAAAALDwBBDRAARAAAAAAAAAAACw8AQQ4QAEQAAAAAAAAAAAsPAEEPEABEAAAAAAAA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z3CAPJbJiDw6rZE8wCSbPMU5pTyF9q885WW7PIKTxzy5i9Q8tFviPHkR8Tz7XQA9ibUIPd+XET0CDhs9jSElPbncLz1tSjs9QHZHPZFsVD2FOmI9Iu5wPSpLgD1/oYg9iIKRPUj3mj1YCaU98sKvPfguuz0DWcc9bU3UPVwZ4j3RyvA9WzgAPneNCD4zbRE+kOAaPifxJD4uqS8+hxM7Pso7Rz5NLlQ+N/hhPoSncD6PJYA+c3mIPuJXkT7cyZo++dikPm2Prz4b+Lo+lR7HPjMP1D4X1+E+PYTwPsYSAD9yZQg/k0IRPyuzGj/OwCQ/sXUvP7LcOj9lAUc/HfBTP/u1YT/7YHA/AACAPwABAgIDAwMDBAQEBAQEBAQAQfiBAQsNAQAAAAAAAAACAAAABABBloIBCz4HAAAAAAADBQAAAAADBwUAAAADBQMFAAADBwUDBQADBwUDBQcAAAAAAADeEgSVAAAAAP///////////////wBB4IIBC9EDAgAAwAMAAMAEAADABQAAwAYAAMAHAADACAAAwAkAAMAKAADACwAAwAwAAMANAADADgAAwA8AAMAQAADAEQAAwBIAAMATAADAFAAAwBUAAMAWAADAFwAAwBgAAMAZAADAGgAAwBsAAMAcAADAHQAAwB4AAMAfAADAAAAAswEAAMMCAADDAwAAwwQAAMMFAADDBgAAwwcAAMMIAADDCQAAwwoAAMMLAADDDAAAww0AANMOAADDDwAAwwAADLsBAAzDAgAMwwMADMMEAAzTAAAAAP////////////////////////////////////////////////////////////////8AAQIDBAUGBwgJ/////////woLDA0ODxAREhMUFRYXGBkaGxwdHh8gISIj////////CgsMDQ4PEBESExQVFhcYGRobHB0eHyAhIiP/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////AEHAhgELGBEACgAREREAAAAABQAAAAAAAAkAAAAACwBB4IYBCyERAA8KERERAwoHAAETCQsLAAAJBgsAAAsABhEAAAAREREAQZGHAQsBCwBBmocBCxgRAAoKERERAAoAAAIACQsAAAAJAAsAAAsAQcuHAQsBDABB14cBCxUMAAAAAAwAAAAACQwAAAAAAAwAAAwAQYWIAQsBDgBBkYgBCxUNAAAABA0AAAAACQ4AAAAAAA4AAA4AQb+IAQsBEABBy4gBCx4PAAAAAA8AAAAACRAAAAAAABAAABAAABIAAAASEhIAQYKJAQsOEgAAABISEgAAAAAAAAkAQbOJAQsBCwBBv4kBCxUKAAAAAAoAAAAACQsAAAAAAAsAAAsAQe2JAQsBDABB+YkBC34MAAAAAAwAAAAACQwAAAAAAAwAAAwAADAxMjM0NTY3ODlBQkNERUZUISIZDQECAxFLHAwQBAsdEh4naG5vcHFiIAUGDxMUFRoIFgcoJBcYCQoOGx8lI4OCfSYqKzw9Pj9DR0pNWFlaW1xdXl9gYWNkZWZnaWprbHJzdHl6e3wAQYCLAQuKDklsbGVnYWwgYnl0ZSBzZXF1ZW5jZQBEb21haW4gZXJyb3IAUmVzdWx0IG5vdCByZXByZXNlbnRhYmxlAE5vdCBhIHR0eQBQZXJtaXNzaW9uIGRlbmllZABPcGVyYXRpb24gbm90IHBlcm1pdHRlZABObyBzdWNoIGZpbGUgb3IgZGlyZWN0b3J5AE5vIHN1Y2ggcHJvY2VzcwBGaWxlIGV4aXN0cwBWYWx1ZSB0b28gbGFyZ2UgZm9yIGRhdGEgdHlwZQBObyBzcGFjZSBsZWZ0IG9uIGRldmljZQBPdXQgb2YgbWVtb3J5AFJlc291cmNlIGJ1c3kASW50ZXJydXB0ZWQgc3lzdGVtIGNhbGwAUmVzb3VyY2UgdGVtcG9yYXJpbHkgdW5hdmFpbGFibGUASW52YWxpZCBzZWVrAENyb3NzLWRldmljZSBsaW5rAFJlYWQtb25seSBmaWxlIHN5c3RlbQBEaXJlY3Rvcnkgbm90IGVtcHR5AENvbm5lY3Rpb24gcmVzZXQgYnkgcGVlcgBPcGVyYXRpb24gdGltZWQgb3V0AENvbm5lY3Rpb24gcmVmdXNlZABIb3N0IGlzIGRvd24ASG9zdCBpcyB1bnJlYWNoYWJsZQBBZGRyZXNzIGluIHVzZQBCcm9rZW4gcGlwZQBJL08gZXJyb3IATm8gc3VjaCBkZXZpY2Ugb3IgYWRkcmVzcwBCbG9jayBkZXZpY2UgcmVxdWlyZWQATm8gc3VjaCBkZXZpY2UATm90IGEgZGlyZWN0b3J5AElzIGEgZGlyZWN0b3J5AFRleHQgZmlsZSBidXN5AEV4ZWMgZm9ybWF0IGVycm9yAEludmFsaWQgYXJndW1lbnQAQXJndW1lbnQgbGlzdCB0b28gbG9uZwBTeW1ib2xpYyBsaW5rIGxvb3AARmlsZW5hbWUgdG9vIGxvbmcAVG9vIG1hbnkgb3BlbiBmaWxlcyBpbiBzeXN0ZW0ATm8gZmlsZSBkZXNjcmlwdG9ycyBhdmFpbGFibGUAQmFkIGZpbGUgZGVzY3JpcHRvcgBObyBjaGlsZCBwcm9jZXNzAEJhZCBhZGRyZXNzAEZpbGUgdG9vIGxhcmdlAFRvbyBtYW55IGxpbmtzAE5vIGxvY2tzIGF2YWlsYWJsZQBSZXNvdXJjZSBkZWFkbG9jayB3b3VsZCBvY2N1cgBTdGF0ZSBub3QgcmVjb3ZlcmFibGUAUHJldmlvdXMgb3duZXIgZGllZABPcGVyYXRpb24gY2FuY2VsZWQARnVuY3Rpb24gbm90IGltcGxlbWVudGVkAE5vIG1lc3NhZ2Ugb2YgZGVzaXJlZCB0eXBlAElkZW50aWZpZXIgcmVtb3ZlZABEZXZpY2Ugbm90IGEgc3RyZWFtAE5vIGRhdGEgYXZhaWxhYmxlAERldmljZSB0aW1lb3V0AE91dCBvZiBzdHJlYW1zIHJlc291cmNlcwBMaW5rIGhhcyBiZWVuIHNldmVyZWQAUHJvdG9jb2wgZXJyb3IAQmFkIG1lc3NhZ2UARmlsZSBkZXNjcmlwdG9yIGluIGJhZCBzdGF0ZQBOb3QgYSBzb2NrZXQARGVzdGluYXRpb24gYWRkcmVzcyByZXF1aXJlZABNZXNzYWdlIHRvbyBsYXJnZQBQcm90b2NvbCB3cm9uZyB0eXBlIGZvciBzb2NrZXQAUHJvdG9jb2wgbm90IGF2YWlsYWJsZQBQcm90b2NvbCBub3Qgc3VwcG9ydGVkAFNvY2tldCB0eXBlIG5vdCBzdXBwb3J0ZWQATm90IHN1cHBvcnRlZABQcm90b2NvbCBmYW1pbHkgbm90IHN1cHBvcnRlZABBZGRyZXNzIGZhbWlseSBub3Qgc3VwcG9ydGVkIGJ5IHByb3RvY29sAEFkZHJlc3Mgbm90IGF2YWlsYWJsZQBOZXR3b3JrIGlzIGRvd24ATmV0d29yayB1bnJlYWNoYWJsZQBDb25uZWN0aW9uIHJlc2V0IGJ5IG5ldHdvcmsAQ29ubmVjdGlvbiBhYm9ydGVkAE5vIGJ1ZmZlciBzcGFjZSBhdmFpbGFibGUAU29ja2V0IGlzIGNvbm5lY3RlZABTb2NrZXQgbm90IGNvbm5lY3RlZABDYW5ub3Qgc2VuZCBhZnRlciBzb2NrZXQgc2h1dGRvd24AT3BlcmF0aW9uIGFscmVhZHkgaW4gcHJvZ3Jlc3MAT3BlcmF0aW9uIGluIHByb2dyZXNzAFN0YWxlIGZpbGUgaGFuZGxlAFJlbW90ZSBJL08gZXJyb3IAUXVvdGEgZXhjZWVkZWQATm8gbWVkaXVtIGZvdW5kAFdyb25nIG1lZGl1bSB0eXBlAE5vIGVycm9yIGluZm9ybWF0aW9uAEGQmwEL/wECAAIAAgACAAIAAgACAAIAAgADIAIgAiACIAIgAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAWAEwATABMAEwATABMAEwATABMAEwATABMAEwATABMAI2AjYCNgI2AjYCNgI2AjYCNgI2ATABMAEwATABMAEwATACNUI1QjVCNUI1QjVCMUIxQjFCMUIxQjFCMUIxQjFCMUIxQjFCMUIxQjFCMUIxQjFCMUIxQTABMAEwATABMAEwAjWCNYI1gjWCNYI1gjGCMYIxgjGCMYIxgjGCMYIxgjGCMYIxgjGCMYIxgjGCMYIxgjGCMYEwATABMAEwAIAQZSjAQv5AwEAAAACAAAAAwAAAAQAAAAFAAAABgAAAAcAAAAIAAAACQAAAAoAAAALAAAADAAAAA0AAAAOAAAADwAAABAAAAARAAAAEgAAABMAAAAUAAAAFQAAABYAAAAXAAAAGAAAABkAAAAaAAAAGwAAABwAAAAdAAAAHgAAAB8AAAAgAAAAIQAAACIAAAAjAAAAJAAAACUAAAAmAAAAJwAAACgAAAApAAAAKgAAACsAAAAsAAAALQAAAC4AAAAvAAAAMAAAADEAAAAyAAAAMwAAADQAAAA1AAAANgAAADcAAAA4AAAAOQAAADoAAAA7AAAAPAAAAD0AAAA+AAAAPwAAAEAAAABhAAAAYgAAAGMAAABkAAAAZQAAAGYAAABnAAAAaAAAAGkAAABqAAAAawAAAGwAAABtAAAAbgAAAG8AAABwAAAAcQAAAHIAAABzAAAAdAAAAHUAAAB2AAAAdwAAAHgAAAB5AAAAegAAAFsAAABcAAAAXQAAAF4AAABfAAAAYAAAAGEAAABiAAAAYwAAAGQAAABlAAAAZgAAAGcAAABoAAAAaQAAAGoAAABrAAAAbAAAAG0AAABuAAAAbwAAAHAAAABxAAAAcgAAAHMAAAB0AAAAdQAAAHYAAAB3AAAAeAAAAHkAAAB6AAAAewAAAHwAAAB9AAAAfgAAAH8AQZSvAQv5AwEAAAACAAAAAwAAAAQAAAAFAAAABgAAAAcAAAAIAAAACQAAAAoAAAALAAAADAAAAA0AAAAOAAAADwAAABAAAAARAAAAEgAAABMAAAAUAAAAFQAAABYAAAAXAAAAGAAAABkAAAAaAAAAGwAAABwAAAAdAAAAHgAAAB8AAAAgAAAAIQAAACIAAAAjAAAAJAAAACUAAAAmAAAAJwAAACgAAAApAAAAKgAAACsAAAAsAAAALQAAAC4AAAAvAAAAMAAAADEAAAAyAAAAMwAAADQAAAA1AAAANgAAADcAAAA4AAAAOQAAADoAAAA7AAAAPAAAAD0AAAA+AAAAPwAAAEAAAABBAAAAQgAAAEMAAABEAAAARQAAAEYAAABHAAAASAAAAEkAAABKAAAASwAAAEwAAABNAAAATgAAAE8AAABQAAAAUQAAAFIAAABTAAAAVAAAAFUAAABWAAAAVwAAAFgAAABZAAAAWgAAAFsAAABcAAAAXQAAAF4AAABfAAAAYAAAAEEAAABCAAAAQwAAAEQAAABFAAAARgAAAEcAAABIAAAASQAAAEoAAABLAAAATAAAAE0AAABOAAAATwAAAFAAAABRAAAAUgAAAFMAAABUAAAAVQAAAFYAAABXAAAAWAAAAFkAAABaAAAAewAAAHwAAAB9AAAAfgAAAH8AQZC3AQtnCgAAAGQAAADoAwAAECcAAKCGAQBAQg8AgJaYAADh9QVMQ19DVFlQRQAAAABMQ19OVU1FUklDAABMQ19USU1FAAAAAABMQ19DT0xMQVRFAABMQ19NT05FVEFSWQBMQ19NRVNTQUdFUwBBgLgBC5cCAwAAAAQAAAAEAAAABgAAAIP5ogBETm4A/CkVANFXJwDdNPUAYtvAADyZlQBBkEMAY1H+ALveqwC3YcUAOm4kANJNQgBJBuAACeouAByS0QDrHf4AKbEcAOg+pwD1NYIARLsuAJzphAC0JnAAQX5fANaROQBTgzkAnPQ5AItfhAAo+b0A+B87AN7/lwAPmAUAES/vAApaiwBtH20Az342AAnLJwBGT7cAnmY/AC3qXwC6J3UA5evHAD178QD3OQcAklKKAPtr6gAfsV8ACF2NADADVgB7/EYA8KtrACC8zwA29JoA46kdAF5hkQAIG+YAhZllAKAUXwCNQGgAgNj/ACdzTQAGBjEAylYVAMmocwB74mAAa4zAAEGjugELrQFA+yH5PwAAAAAtRHQ+AAAAgJhG+DwAAABgUcx4OwAAAICDG/A5AAAAQCAlejgAAACAIoLjNgAAAAAd82k1T7thBWes3T8YLURU+yHpP5v2gdILc+8/GC1EVPsh+T/iZS8ifyt6PAdcFDMmpoE8vcvweogHcDwHXBQzJqaRPDhj7T7aD0k/Xph7P9oPyT9pN6wxaCEiM7QPFDNoIaIzAAAAAAAA8D8AAAAAAAD4PwBB2LsBCwgG0M9D6/1MPgBB67sBCyVAA7jiPzAxMjM0NTY3ODlhYmNkZWZBQkNERUZ4WCstcFBpSW5OAEGgvAELgQElAAAAbQAAAC8AAAAlAAAAZAAAAC8AAAAlAAAAeQAAACUAAABZAAAALQAAACUAAABtAAAALQAAACUAAABkAAAAJQAAAEkAAAA6AAAAJQAAAE0AAAA6AAAAJQAAAFMAAAAgAAAAJQAAAHAAAAAAAAAAJQAAAEgAAAA6AAAAJQAAAE0AQbC9AQv7JSUAAABIAAAAOgAAACUAAABNAAAAOgAAACUAAABTAAAAJQAAAEgAAAA6AAAAJQAAAE0AAAA6AAAAJQAAAFMAAACQgQAAPIkAAHCCAAAQiQAAAAAAAAEAAADwXgAAAAAAAHCCAADsiAAAAAAAAAEAAAD4XgAAAAAAADiCAABhiQAAAAAAABBfAAA4ggAAhokAAAEAAAAQXwAAkIEAAMOJAABwggAABYoAAAAAAAABAAAA8F4AAAAAAABwggAA4YkAAAAAAAABAAAAUF8AAAAAAAA4ggAAMYoAAAAAAABoXwAAOIIAAFaKAAABAAAAaF8AAHCCAACxigAAAAAAAAEAAADwXgAAAAAAAHCCAACNigAAAAAAAAEAAACgXwAAAAAAADiCAADdigAAAAAAALhfAAA4ggAAAosAAAEAAAC4XwAAcIIAAEyLAAAAAAAAAQAAAPBeAAAAAAAAcIIAACiLAAAAAAAAAQAAAPBfAAAAAAAAOIIAAHiLAAAAAAAACGAAADiCAACdiwAAAQAAAAhgAABwggAA54sAAAAAAAABAAAA8F4AAAAAAABwggAAw4sAAAAAAAABAAAAQGAAAAAAAAA4ggAAE4wAAAAAAABYYAAAOIIAADiMAAABAAAAWGAAAJCBAABvjAAAOIIAAH2MAAAAAAAAkGAAADiCAACMjAAAAQAAAJBgAACQgQAAoIwAADiCAACvjAAAAAAAALhgAAA4ggAAv4wAAAEAAAC4YAAAkIEAANCMAAA4ggAA2YwAAAAAAADgYAAAOIIAAOOMAAABAAAA4GAAAJCBAAAEjQAAOIIAABONAAAAAAAACGEAADiCAAAjjQAAAQAAAAhhAACQgQAAOo0AADiCAABKjQAAAAAAADBhAAA4ggAAW40AAAEAAAAwYQAAkIEAAHyNAAA4ggAAiY0AAAAAAABYYQAAOIIAAJeNAAABAAAAWGEAAJCBAACmjQAAOIIAAK+NAAAAAAAAgGEAADiCAAC5jQAAAQAAAIBhAACQgQAA3I0AADiCAADmjQAAAAAAAKhhAAA4ggAA8Y0AAAEAAACoYQAAkIEAAASOAAA4ggAAD44AAAAAAADQYQAAOIIAABuOAAABAAAA0GEAAJCBAAAujgAAOIIAAD6OAAAAAAAA+GEAADiCAABPjgAAAQAAAPhhAACQgQAAZ44AADiCAAB0jgAAAAAAACBiAAA4ggAAgo4AAAEAAAAgYgAAkIEAANiOAABwggAAmY4AAAAAAAABAAAASGIAAAAAAACQgQAA/o4AADiCAAAHjwAAAAAAAGhiAAA4ggAAEY8AAAEAAABoYgAAkIEAACSPAAA4ggAALY8AAAAAAACQYgAAOIIAADePAAABAAAAkGIAAJCBAABUjwAAOIIAAF2PAAAAAAAAuGIAADiCAABnjwAAAQAAALhiAACQgQAAjI8AADiCAACVjwAAAAAAAOBiAAA4ggAAn48AAAEAAADgYgAAkIEAAK6PAAA4ggAAwo8AAAAAAAAIYwAAOIIAANePAAABAAAACGMAAJCBAADtjwAAOIIAAP6PAAAAAAAAMGMAADiCAAAQkAAAAQAAADBjAACQgQAAI5AAADiCAAAxkAAAAAAAAFhjAAA4ggAAQJAAAAEAAABYYwAAkIEAAFmQAAA4ggAAZpAAAAAAAACAYwAAOIIAAHSQAAABAAAAgGMAAJCBAACDkAAAOIIAAJOQAAAAAAAAqGMAADiCAACkkAAAAQAAAKhjAACQgQAAtpAAADiCAAC/kAAAAAAAANBjAAA4ggAAyZAAAAEAAADQYwAAkIEAANmQAAA4ggAA45AAAAAAAAD4YwAAOIIAAO6QAAABAAAA+GMAAJCBAAD/kAAAOIIAAAqRAAAAAAAAIGQAADiCAAAWkQAAAQAAACBkAACQgQAAI5EAADiCAAA8kQAAAAAAAEhkAAA4ggAAVpEAAAEAAABIZAAAkIEAAHiRAAA4ggAAlJEAAAAAAABwZAAAOIIAALGRAAABAAAAcGQAALiBAADakQAAcGQAAAAAAAA4ggAA+JEAAAAAAACYZAAAOIIAABeSAAABAAAAmGQAAJCBAAA3kgAAOIIAAECSAAAAAAAAyGQAADiCAABKkgAAAQAAAMhkAABUggAAXJIAAJCBAAB6kgAAOIIAAISSAAAAAAAA+GQAADiCAACPkgAAAQAAAPhkAABUggAAm5IAAJCBAAC3kgAAOIIAANuSAAAAAAAAKGUAADiCAAAAkwAAAQAAAChlAAC4gQAAJpMAACBsAAAAAAAAkIEAACmUAAC4gQAAZZQAACBsAAAAAAAAkIEAANmUAAC4gQAAvJQAAHhlAAAAAAAAkIEAAPGUAAA4ggAAFJUAAAAAAACQZQAAOIIAADiVAAABAAAAkGUAALiBAABdlQAAIGwAAAAAAACQgQAAXpYAALiBAACXlgAAIGwAAAAAAACQgQAA7ZYAADiCAAANlwAAAAAAAOBlAAA4ggAALpcAAAEAAADgZQAAbAAAAAAAAAAYZwAAFAAAABUAAACU////lP///xhnAAAWAAAAFwAAALiBAADflwAACGcAAAAAAAC4gQAAMpgAABhnAAAAAAAAkIEAAByeAACQgQAAW54AAJCBAACZngAAkIEAAN+eAACQgQAAHJ8AAJCBAAA7nwAAkIEAAFqfAACQgQAAeZ8AAJCBAACYnwAAkIEAALefAACQgQAA1p8AAJCBAAAToAAAcIIAADKgAAAAAAAAAQAAAEhiAAAAAAAAcIIAAHGgAAAAAAAAAQAAAEhiAAAAAAAAuIEAAJqhAADwZgAAAAAAAJCBAACIoQAAuIEAAMShAADwZgAAAAAAAJCBAADuoQAAkIEAAB+iAABwggAAUKIAAAAAAAABAAAA4GYAAAP0//9wggAAf6IAAAAAAAABAAAA+GYAAAP0//9wggAArqIAAAAAAAABAAAA4GYAAAP0//9wggAA3aIAAAAAAAABAAAA+GYAAAP0//+4gQAADKMAABBnAAAAAAAAuIEAACWjAAAIZwAAAAAAALiBAABkowAAEGcAAAAAAAC4gQAAfKMAAAhnAAAAAAAAuIEAAJSjAADIZwAAAAAAALiBAACoowAAGGwAAAAAAAC4gQAAvqMAAMhnAAAAAAAAcIIAANejAAAAAAAAAgAAAMhnAAACAAAACGgAAAAAAABwggAAG6QAAAAAAAABAAAAIGgAAAAAAACQgQAAMaQAAHCCAABKpAAAAAAAAAIAAADIZwAAAgAAAEhoAAAAAAAAcIIAAI6kAAAAAAAAAQAAACBoAAAAAAAAcIIAALekAAAAAAAAAgAAAMhnAAACAAAAgGgAAAAAAABwggAA+6QAAAAAAAABAAAAmGgAAAAAAACQgQAAEaUAAHCCAAAqpQAAAAAAAAIAAADIZwAAAgAAAMBoAAAAAAAAcIIAAG6lAAAAAAAAAQAAAJhoAAAAAAAAcIIAAMSmAAAAAAAAAwAAAMhnAAACAAAAAGkAAAIAAAAIaQAAAAgAAJCBAAArpwAAkIEAAAmnAABwggAAPqcAAAAAAAADAAAAyGcAAAIAAAAAaQAAAgAAADhpAAAACAAAkIEAAIOnAABwggAApacAAAAAAAACAAAAyGcAAAIAAABgaQAAAAgAAJCBAADqpwAAcIIAAP+nAAAAAAAAAgAAAMhnAAACAAAAYGkAAAAIAABwggAARKgAAAAAAAACAAAAyGcAAAIAAACoaQAAAgAAAJCBAABgqAAAcIIAAHWoAAAAAAAAAgAAAMhnAAACAAAAqGkAAAIAAABwggAAkagAAAAAAAACAAAAyGcAAAIAAACoaQAAAgAAAHCCAACtqAAAAAAAAAIAAADIZwAAAgAAAKhpAAACAAAAcIIAANioAAAAAAAAAgAAAMhnAAACAAAAMGoAAAAAAACQgQAAHqkAAHCCAABCqQAAAAAAAAIAAADIZwAAAgAAAFhqAAAAAAAAkIEAAIipAABwggAAp6kAAAAAAAACAAAAyGcAAAIAAACAagAAAAAAAJCBAADtqQAAcIIAAAaqAAAAAAAAAgAAAMhnAAACAAAAqGoAAAAAAACQgQAATKoAAHCCAABlqgAAAAAAAAIAAADIZwAAAgAAANBqAAACAAAAkIEAAHqqAABwggAAEasAAAAAAAACAAAAyGcAAAIAAADQagAAAgAAALiBAACSqgAACGsAAAAAAABwggAAtaoAAAAAAAACAAAAyGcAAAIAAAAoawAAAgAAAJCBAADYqgAAuIEAAO+qAAAIawAAAAAAAHCCAAAmqwAAAAAAAAIAAADIZwAAAgAAAChrAAACAAAAcIIAAEirAAAAAAAAAgAAAMhnAAACAAAAKGsAAAIAAABwggAAaqsAAAAAAAACAAAAyGcAAAIAAAAoawAAAgAAALiBAACNqwAAyGcAAAAAAABwggAAo6sAAAAAAAACAAAAyGcAAAIAAADQawAAAgAAAJCBAAC1qwAAcIIAAMqrAAAAAAAAAgAAAMhnAAACAAAA0GsAAAIAAAC4gQAA56sAAMhnAAAAAAAAuIEAAPyrAADIZwAAAAAAAJCBAAARrAAAcIIAACqsAAAAAAAAAQAAABhsAAAAAAAAkIEAANmsAAC4gQAAOa0AAFBsAAAAAAAAuIEAAOasAABgbAAAAAAAAJCBAAAHrQAAuIEAABStAABAbAAAAAAAALiBAAAbrgAAOGwAAAAAAAC4gQAAK64AAHhsAAAAAAAAuIEAAEquAAA4bAAAAAAAALiBAAB6rgAAUGwAAAAAAAC4gQAAVq4AAKhsAAAAAAAAuIEAAJyuAABQbAAAAAAAAByCAADErgAAHIIAAMauAAAcggAAya4AAByCAADLrgAAHIIAAM2uAAAcggAAEJgAAByCAADPrgAAHIIAANGuAAAcggAA064AAByCAADVrgAAHIIAALWkAAAcggAA164AAByCAADZrgAAHIIAANuuAAC4gQAA3a4AAFBsAAAAAAAAuIEAAP6uAABAbAAAAAAAAChfAADYbAAAKF8AABhtAAAwbQAAOF8AAEhfAAAQXwAAMG0AAIBfAADYbAAAgF8AAEBtAAAwbQAAkF8AAEhfAABoXwAAMG0AANBfAADYbAAA0F8AAPBsAAAwbQAA4F8AAEhfAAC4XwAAMG0AACBgAADYbAAAIGAAAPhsAAAwbQAAMGAAAEhfAAAIYAAAMG0AAHBgAADYbAAAcGAAADhtAAAwbQAAgGAAAEhfAABYYAAAMG0AAJhgAADYbAAAaF8AANhsAABYYAAAwGAAAOhgAABAbQAA6GAAAEBtAABAbQAA6GAAANhsAADoYAAAQG0AABBhAAA4YQAAYGEAAIhhAACwYQAAQG0AALBhAABAbQAA2GwAALBhAABAbQAA6GwAALBhAAAAYgAA2GwAAABiAABAbQAAQG0AABBiAAAoYgAAMG0AADhiAADYbAAAKGIAAGhfAADobAAAKGIAAEBtAAAoYgAAQG0AAChiAABAbQAA2GwAAChiAADYbAAAKGIAAEBtAABwYgAAmGIAAEBtAACYYgAAQG0AANhsAACYYgAAQG0AAMBiAADYbAAAwGIAAEBtAADoYgAAQG0AABhtAABAbQAAQG0AABBjAAA4YwAAQG0AADhjAABAbQAAYGMAAIhjAACwYwAA2GMAANBjAADYYwAAQG0AAABkAABAbQAAQG0AAEBtAAAoZAAA2GwAAChkAADYbAAAKGQAAEBtAADYbAAAKGQAABhtAAAYbQAAOGQAAFBkAADYbAAAUGQAAEBtAABAbQAAUGQAAHhkAAAwbQAA2GwAAHhkAABoXwAAQG0AAHhkAAAwbQAAMG0AAHhkAACoZAAAMG0AANhsAACoZAAAaF8AAEBtAACoZAAAMG0AADBtAACoZAAA0GQAADhtAADQZAAAWGAAANBkAAAAZQAAAAAAAFBlAAABAAAAAgAAAAMAAAABAAAABAAAAGBlAAAAAAAAaGUAAAUAAAAGAAAABwAAAAIAAAAIAAAA2GwAADBlAAAoYgAAQG0AADBlAADYbAAAMGUAAEBtAAAAAAAAgGUAAAEAAAAJAAAACgAAAAAAAAB4ZQAAAQAAAAkAAAALAAAAAAAAALhlAAAMAAAADQAAAA4AAAADAAAADwAAAMhlAAAAAAAA0GUAABAAAAARAAAAEgAAAAIAAAATAAAA2GwAAJhlAAAoYgAA6GUAANhsAADoZQAAKGIAAEBtAADoZQAA2GwAAOhlAABAbQAAMG0AAOhlAABErAAAAgAAAAAEAABsAAAAAAAAAEBmAAAYAAAAGQAAAJT///+U////QGYAABoAAAAbAAAALHEAABRmAAAoZgAAQHEAAAAAAAAwZgAAHAAAAB0AAAABAAAAAQAAAAEAAAABAAAAAQAAAAIAAAACAAAAAwAAAAQAAAAEAAAAAwAAAAUAAABPZ2dTQEEAABQAAABDLlVURi04AEG44wELApxxAEHQ4wELBdRxAAAFAEHg4wELAQUAQfjjAQsKBAAAAAUAAAAQyABBkOQBCwECAEGf5AELBf//////AEHQ5AELBVRyAAAJAEHg5AELAQUAQfTkAQsSBgAAAAAAAAAFAAAAOK8AAAAEAEGg5QELBP////8AQdDlAQsF1HIAAAUAQeDlAQsBBQBB+OUBCw4HAAAABQAAAEizAAAABABBkOYBCwEBAEGf5gELBQr/////AEHQ5gELAtRyAEH45gELAQgAQZ/nAQsF//////8AQYzpAQsC9L8AQcTpAQv1EJBNAACQUQAAkFcAAF9wiQD/CS8PAAAAPwAAAL8AAAAA8GYAAB4AAAAfAAAAAAAAAAhnAAAgAAAAIQAAAAIAAAAJAAAAAgAAAAIAAAAGAAAAAgAAAAIAAAAHAAAABAAAAAYAAAADAAAABwAAAAAAAAAQZwAAIgAAACMAAAADAAAACgAAAAMAAAADAAAACAAAAAkAAAALAAAACgAAAAsAAAAIAAAADAAAAAkAAAAIAAAAAAAAABhnAAAUAAAAFQAAAPj////4////GGcAABYAAAAXAAAAfHUAAJB1AAAIAAAAAAAAADBnAAAkAAAAJQAAAPj////4////MGcAACYAAAAnAAAArHUAAMB1AAAEAAAAAAAAAEhnAAAoAAAAKQAAAPz////8////SGcAACoAAAArAAAA3HUAAPB1AAAEAAAAAAAAAGBnAAAsAAAALQAAAPz////8////YGcAAC4AAAAvAAAADHYAACB2AAAAAAAAeGcAACIAAAAwAAAABAAAAAoAAAADAAAAAwAAAAwAAAAJAAAACwAAAAoAAAALAAAACAAAAA0AAAAKAAAAAAAAAIhnAAAgAAAAMQAAAAUAAAAJAAAAAgAAAAIAAAANAAAAAgAAAAIAAAAHAAAABAAAAAYAAAAOAAAACwAAAAAAAACYZwAAIgAAADIAAAAGAAAACgAAAAMAAAADAAAACAAAAAkAAAALAAAADgAAAA8AAAAMAAAADAAAAAkAAAAAAAAAqGcAACAAAAAzAAAABwAAAAkAAAACAAAAAgAAAAYAAAACAAAAAgAAABAAAAARAAAADQAAAAMAAAAHAAAAAAAAALhnAAA0AAAANQAAADYAAAABAAAABAAAAA8AAAAAAAAA2GcAADcAAAA4AAAANgAAAAIAAAAFAAAAEAAAAAAAAADoZwAAOQAAADoAAAA2AAAAAQAAAAIAAAADAAAABAAAAAUAAAAGAAAABwAAAAgAAAAJAAAACgAAAAsAAAAAAAAAKGgAADsAAAA8AAAANgAAAAwAAAANAAAADgAAAA8AAAAQAAAAEQAAABIAAAATAAAAFAAAABUAAAAWAAAAAAAAAGBoAAA9AAAAPgAAADYAAAADAAAABAAAAAEAAAAFAAAAAgAAAAEAAAACAAAABgAAAAAAAACgaAAAPwAAAEAAAAA2AAAABwAAAAgAAAADAAAACQAAAAQAAAADAAAABAAAAAoAAAAAAAAA2GgAAEEAAABCAAAANgAAABIAAAAXAAAAGAAAABkAAAAaAAAAGwAAAAEAAAD4////2GgAABMAAAAUAAAAFQAAABYAAAAXAAAAGAAAABkAAAAAAAAAEGkAAEMAAABEAAAANgAAABoAAAAcAAAAHQAAAB4AAAAfAAAAIAAAAAIAAAD4////EGkAABsAAAAcAAAAHQAAAB4AAAAfAAAAIAAAACEAAAAlAAAASAAAADoAAAAlAAAATQAAADoAAAAlAAAAUwAAAAAAAAAlAAAAbQAAAC8AAAAlAAAAZAAAAC8AAAAlAAAAeQAAAAAAAAAlAAAASQAAADoAAAAlAAAATQAAADoAAAAlAAAAUwAAACAAAAAlAAAAcAAAAAAAAAAlAAAAYQAAACAAAAAlAAAAYgAAACAAAAAlAAAAZAAAACAAAAAlAAAASAAAADoAAAAlAAAATQAAADoAAAAlAAAAUwAAACAAAAAlAAAAWQAAAAAAAABBAAAATQAAAAAAAABQAAAATQAAAAAAAABKAAAAYQAAAG4AAAB1AAAAYQAAAHIAAAB5AAAAAAAAAEYAAABlAAAAYgAAAHIAAAB1AAAAYQAAAHIAAAB5AAAAAAAAAE0AAABhAAAAcgAAAGMAAABoAAAAAAAAAEEAAABwAAAAcgAAAGkAAABsAAAAAAAAAE0AAABhAAAAeQAAAAAAAABKAAAAdQAAAG4AAABlAAAAAAAAAEoAAAB1AAAAbAAAAHkAAAAAAAAAQQAAAHUAAABnAAAAdQAAAHMAAAB0AAAAAAAAAFMAAABlAAAAcAAAAHQAAABlAAAAbQAAAGIAAABlAAAAcgAAAAAAAABPAAAAYwAAAHQAAABvAAAAYgAAAGUAAAByAAAAAAAAAE4AAABvAAAAdgAAAGUAAABtAAAAYgAAAGUAAAByAAAAAAAAAEQAAABlAAAAYwAAAGUAAABtAAAAYgAAAGUAAAByAAAAAAAAAEoAAABhAAAAbgAAAAAAAABGAAAAZQAAAGIAAAAAAAAATQAAAGEAAAByAAAAAAAAAEEAAABwAAAAcgAAAAAAAABKAAAAdQAAAG4AAAAAAAAASgAAAHUAAABsAAAAAAAAAEEAAAB1AAAAZwAAAAAAAABTAAAAZQAAAHAAAAAAAAAATwAAAGMAAAB0AAAAAAAAAE4AAABvAAAAdgAAAAAAAABEAAAAZQAAAGMAAAAAAAAAUwAAAHUAAABuAAAAZAAAAGEAAAB5AAAAAAAAAE0AAABvAAAAbgAAAGQAAABhAAAAeQAAAAAAAABUAAAAdQAAAGUAAABzAAAAZAAAAGEAAAB5AAAAAAAAAFcAAABlAAAAZAAAAG4AAABlAAAAcwAAAGQAAABhAAAAeQAAAAAAAABUAAAAaAAAAHUAAAByAAAAcwAAAGQAAABhAAAAeQAAAAAAAABGAAAAcgAAAGkAAABkAAAAYQAAAHkAAAAAAAAAUwAAAGEAAAB0AAAAdQAAAHIAAABkAAAAYQAAAHkAAAAAAAAAUwAAAHUAAABuAAAAAAAAAE0AAABvAAAAbgAAAAAAAABUAAAAdQAAAGUAAAAAAAAAVwAAAGUAAABkAAAAAAAAAFQAAABoAAAAdQAAAAAAAABGAAAAcgAAAGkAAAAAAAAAUwAAAGEAAAB0AEHE+gELiQZAaQAARQAAAEYAAAA2AAAAAQAAAAAAAABoaQAARwAAAEgAAAA2AAAAAgAAAAAAAACIaQAASQAAAEoAAAA2AAAAIgAAACMAAAAIAAAACQAAAAoAAAALAAAAJAAAAAwAAAANAAAAAAAAALBpAABLAAAATAAAADYAAAAlAAAAJgAAAA4AAAAPAAAAEAAAABEAAAAnAAAAEgAAABMAAAAAAAAA0GkAAE0AAABOAAAANgAAACgAAAApAAAAFAAAABUAAAAWAAAAFwAAACoAAAAYAAAAGQAAAAAAAADwaQAATwAAAFAAAAA2AAAAKwAAACwAAAAaAAAAGwAAABwAAAAdAAAALQAAAB4AAAAfAAAAAAAAABBqAABRAAAAUgAAADYAAAADAAAABAAAAAAAAAA4agAAUwAAAFQAAAA2AAAABQAAAAYAAAAAAAAAYGoAAFUAAABWAAAANgAAAAEAAAAhAAAAAAAAAIhqAABXAAAAWAAAADYAAAACAAAAIgAAAAAAAACwagAAWQAAAFoAAAA2AAAAEQAAAAEAAAAgAAAAAAAAANhqAABbAAAAXAAAADYAAAASAAAAAgAAACEAAAAAAAAAMGsAAF0AAABeAAAANgAAAAMAAAAEAAAACwAAAC4AAAAvAAAADAAAADAAAAAAAAAA+GoAAF0AAABfAAAANgAAAAMAAAAEAAAACwAAAC4AAAAvAAAADAAAADAAAAAAAAAAYGsAAGAAAABhAAAANgAAAAUAAAAGAAAADQAAADEAAAAyAAAADgAAADMAAAAAAAAAoGsAAGIAAABjAAAANgAAAAAAAACwawAAZAAAAGUAAAA2AAAADgAAABMAAAAPAAAAFAAAABAAAAABAAAAFQAAAA8AAAAAAAAA+GsAAGYAAABnAAAANgAAADQAAAA1AAAAIgAAACMAAAAkAAAAAAAAAAhsAABoAAAAaQAAADYAAAA2AAAANwAAACUAAAAmAAAAJwAAAGYAAABhAAAAbAAAAHMAAABlAAAAAAAAAHQAAAByAAAAdQAAAGUAQdiAAgvLXchnAABdAAAAagAAADYAAAAAAAAA2GsAAF0AAABrAAAANgAAABYAAAACAAAAAwAAAAQAAAARAAAAFwAAABIAAAAYAAAAEwAAAAUAAAAZAAAAEAAAAAAAAABAawAAXQAAAGwAAAA2AAAABwAAAAgAAAARAAAAOAAAADkAAAASAAAAOgAAAAAAAACAawAAXQAAAG0AAAA2AAAACQAAAAoAAAATAAAAOwAAADwAAAAUAAAAPQAAAAAAAAAIawAAXQAAAG4AAAA2AAAAAwAAAAQAAAALAAAALgAAAC8AAAAMAAAAMAAAAAAAAAAIaQAAEwAAABQAAAAVAAAAFgAAABcAAAAYAAAAGQAAAAAAAAA4aQAAGwAAABwAAAAdAAAAHgAAAB8AAAAgAAAAIQAAAAIAAAAAAAAAQGwAAG8AAABwAAAAcQAAAHIAAAAaAAAAAwAAAAEAAAAGAAAAAAAAAGhsAABvAAAAcwAAAHEAAAByAAAAGgAAAAQAAAACAAAABwAAAAAAAAB4bAAAdAAAAHUAAAA+AAAAAAAAAIhsAAB0AAAAdgAAAD4AAAAAAAAAmGwAAHcAAAB4AAAAPwAAAAAAAADIbAAAbwAAAHkAAABxAAAAcgAAABsAAAAAAAAAuGwAAG8AAAB6AAAAcQAAAHIAAAAcAAAAAAAAAEhtAABvAAAAewAAAHEAAAByAAAAHQAAAAAAAABYbQAAbwAAAHwAAABxAAAAcgAAABoAAAAFAAAAAwAAAAgAAABWZWN0b3JJbnQAVmVjdG9yRG91YmxlAFZlY3RvckNoYXIAVmVjdG9yVUNoYXIAVmVjdG9yRmxvYXQAdmVjdG9yVG9vbHMAY2xlYXJWZWN0b3JEYmwAY2xlYXJWZWN0b3JGbG9hdABtYXhpU2V0dGluZ3MAc2V0dXAAc2FtcGxlUmF0ZQBjaGFubmVscwBidWZmZXJTaXplAG1heGlPc2MAc2luZXdhdmUAY29zd2F2ZQBwaGFzb3IAc2F3AHRyaWFuZ2xlAHNxdWFyZQBwdWxzZQBpbXB1bHNlAG5vaXNlAHNpbmVidWYAc2luZWJ1ZjQAc2F3bgBwaGFzZVJlc2V0AG1heGlFbnZlbG9wZQBsaW5lAHRyaWdnZXIAYW1wbGl0dWRlAHZhbGluZGV4AG1heGlEZWxheWxpbmUAZGwAbWF4aUZpbHRlcgBsb3JlcwBoaXJlcwBiYW5kcGFzcwBsb3Bhc3MAaGlwYXNzAGN1dG9mZgByZXNvbmFuY2UAbWF4aU1peABzdGVyZW8AcXVhZABhbWJpc29uaWMAbWF4aUxpbmUAcGxheQBwcmVwYXJlAHRyaWdnZXJFbmFibGUAaXNMaW5lQ29tcGxldGUAbWF4aVhGYWRlAHhmYWRlAG1heGlMYWdFeHAAaW5pdABhZGRTYW1wbGUAdmFsdWUAYWxwaGEAYWxwaGFSZWNpcHJvY2FsAHZhbABtYXhpU2FtcGxlAGdldExlbmd0aABzZXRTYW1wbGUAc2V0U2FtcGxlRnJvbU9nZ0Jsb2IAaXNSZWFkeQBwbGF5T25jZQBwbGF5T25aWABwbGF5NABjbGVhcgBub3JtYWxpc2UAYXV0b1RyaW0AbG9hZAByZWFkAG1heGlNYXAAbGlubGluAGxpbmV4cABleHBsaW4AY2xhbXAAbWF4aUR5bgBnYXRlAGNvbXByZXNzb3IAY29tcHJlc3MAc2V0QXR0YWNrAHNldFJlbGVhc2UAc2V0VGhyZXNob2xkAHNldFJhdGlvAG1heGlFbnYAYXIAYWRzcgBzZXREZWNheQBzZXRTdXN0YWluAGNvbnZlcnQAbXRvZgBtc1RvU2FtcHMAbWF4aVNhbXBsZUFuZEhvbGQAc2FoAG1heGlEaXN0b3J0aW9uAGZhc3RBdGFuAGF0YW5EaXN0AGZhc3RBdGFuRGlzdABtYXhpRmxhbmdlcgBmbGFuZ2UAbWF4aUNob3J1cwBjaG9ydXMAbWF4aURDQmxvY2tlcgBtYXhpU1ZGAHNldEN1dG9mZgBzZXRSZXNvbmFuY2UAbWF4aU1hdGgAYWRkAHN1YgBtdWwAZGl2AGd0AGx0AGd0ZQBsdGUAbW9kAGFicwBwb3cAbWF4aUNsb2NrAHRpY2tlcgBzZXRUZW1wbwBzZXRUaWNrc1BlckJlYXQAaXNUaWNrAGN1cnJlbnRDb3VudABwbGF5SGVhZABicHMAYnBtAHRpY2sAdGlja3MAbWF4aUt1cmFtb3RvT3NjaWxsYXRvcgBzZXRQaGFzZQBnZXRQaGFzZQBtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yU2V0AHNldFBoYXNlcwBzaXplAG1heGlBc3luY0t1cmFtb3RvT3NjaWxsYXRvcgBtYXhpRkZUAHByb2Nlc3MAc3BlY3RyYWxGbGF0bmVzcwBzcGVjdHJhbENlbnRyb2lkAGdldE1hZ25pdHVkZXMAZ2V0TWFnbml0dWRlc0RCAG1heGlGRlQuZmZ0TW9kZXMATk9fUE9MQVJfQ09OVkVSU0lPTgBXSVRIX1BPTEFSX0NPTlZFUlNJT04AbWF4aUlGRlQAbWF4aVRpbWVTdHJldGNoAHNoYXJlZF9wdHI8bWF4aVRpbWVzdHJldGNoPGhhbm5XaW5GdW5jdG9yPiA+AGdldE5vcm1hbGlzZWRQb3NpdGlvbgBnZXRQb3NpdGlvbgBzZXRQb3NpdGlvbgBwbGF5QXRQb3NpdGlvbgBtYXhpUGl0Y2hTaGlmdABzaGFyZWRfcHRyPG1heGlQaXRjaFNoaWZ0PGhhbm5XaW5GdW5jdG9yPiA+AG1heGlTdHJldGNoAHNldExvb3BTdGFydABzZXRMb29wRW5kAGdldExvb3BFbmQAcHVzaF9iYWNrAHJlc2l6ZQBnZXQAc2V0AE5TdDNfXzI2dmVjdG9ySWlOU185YWxsb2NhdG9ySWlFRUVFAE5TdDNfXzIxM19fdmVjdG9yX2Jhc2VJaU5TXzlhbGxvY2F0b3JJaUVFRUUATlN0M19fMjIwX192ZWN0b3JfYmFzZV9jb21tb25JTGIxRUVFAFBOU3QzX18yNnZlY3RvcklpTlNfOWFsbG9jYXRvcklpRUVFRQBQS05TdDNfXzI2dmVjdG9ySWlOU185YWxsb2NhdG9ySWlFRUVFAGlpAHYAdmkAdmlpaQB2aWlpaQBpaWkATjEwZW1zY3JpcHRlbjN2YWxFAGlpaWkAaWlpaWkATlN0M19fMjZ2ZWN0b3JJZE5TXzlhbGxvY2F0b3JJZEVFRUUATlN0M19fMjEzX192ZWN0b3JfYmFzZUlkTlNfOWFsbG9jYXRvcklkRUVFRQBQTlN0M19fMjZ2ZWN0b3JJZE5TXzlhbGxvY2F0b3JJZEVFRUUAUEtOU3QzX18yNnZlY3RvcklkTlNfOWFsbG9jYXRvcklkRUVFRQB2aWlkAHZpaWlkAGlpaWlkAE5TdDNfXzI2dmVjdG9ySWNOU185YWxsb2NhdG9ySWNFRUVFAE5TdDNfXzIxM19fdmVjdG9yX2Jhc2VJY05TXzlhbGxvY2F0b3JJY0VFRUUAUE5TdDNfXzI2dmVjdG9ySWNOU185YWxsb2NhdG9ySWNFRUVFAFBLTlN0M19fMjZ2ZWN0b3JJY05TXzlhbGxvY2F0b3JJY0VFRUUATlN0M19fMjZ2ZWN0b3JJaE5TXzlhbGxvY2F0b3JJaEVFRUUATlN0M19fMjEzX192ZWN0b3JfYmFzZUloTlNfOWFsbG9jYXRvckloRUVFRQBQTlN0M19fMjZ2ZWN0b3JJaE5TXzlhbGxvY2F0b3JJaEVFRUUAUEtOU3QzX18yNnZlY3RvckloTlNfOWFsbG9jYXRvckloRUVFRQBOU3QzX18yNnZlY3RvcklmTlNfOWFsbG9jYXRvcklmRUVFRQBOU3QzX18yMTNfX3ZlY3Rvcl9iYXNlSWZOU185YWxsb2NhdG9ySWZFRUVFAFBOU3QzX18yNnZlY3RvcklmTlNfOWFsbG9jYXRvcklmRUVFRQBQS05TdDNfXzI2dmVjdG9ySWZOU185YWxsb2NhdG9ySWZFRUVFAHZpaWYAdmlpaWYAaWlpaWYAMTF2ZWN0b3JUb29scwBQMTF2ZWN0b3JUb29scwBQSzExdmVjdG9yVG9vbHMAdmlpADEybWF4aVNldHRpbmdzAFAxMm1heGlTZXR0aW5ncwBQSzEybWF4aVNldHRpbmdzADdtYXhpT3NjAFA3bWF4aU9zYwBQSzdtYXhpT3NjAGRpaWQAZGlpZGRkAGRpaWRkAGRpaQAxMm1heGlFbnZlbG9wZQBQMTJtYXhpRW52ZWxvcGUAUEsxMm1heGlFbnZlbG9wZQBkaWlpaQAxM21heGlEZWxheWxpbmUAUDEzbWF4aURlbGF5bGluZQBQSzEzbWF4aURlbGF5bGluZQBkaWlkaWQAZGlpZGlkaQAxMG1heGlGaWx0ZXIAUDEwbWF4aUZpbHRlcgBQSzEwbWF4aUZpbHRlcgA3bWF4aU1peABQN21heGlNaXgAUEs3bWF4aU1peAB2aWlkaWQAdmlpZGlkZAB2aWlkaWRkZAA4bWF4aUxpbmUAUDhtYXhpTGluZQBQSzhtYXhpTGluZQB2aWlkZGQAOW1heGlYRmFkZQBQOW1heGlYRmFkZQBQSzltYXhpWEZhZGUAZGlkZGQAMTBtYXhpTGFnRXhwSWRFAFAxMG1heGlMYWdFeHBJZEUAUEsxMG1heGlMYWdFeHBJZEUAdmlpZGQAMTBtYXhpU2FtcGxlAFAxMG1heGlTYW1wbGUAUEsxMG1heGlTYW1wbGUAdmlpZmZpaQBOU3QzX18yMTJiYXNpY19zdHJpbmdJY05TXzExY2hhcl90cmFpdHNJY0VFTlNfOWFsbG9jYXRvckljRUVFRQBOU3QzX18yMjFfX2Jhc2ljX3N0cmluZ19jb21tb25JTGIxRUVFADdtYXhpTWFwAFA3bWF4aU1hcABQSzdtYXhpTWFwAGRpZGRkZGQAN21heGlEeW4AUDdtYXhpRHluAFBLN21heGlEeW4AZGlpZGRpZGQAZGlpZGRkZGQAN21heGlFbnYAUDdtYXhpRW52AFBLN21heGlFbnYAZGlpZGRkaWkAZGlpZGRkZGRpaQBkaWlkaQA3Y29udmVydABQN2NvbnZlcnQAUEs3Y29udmVydABkaWQAMTdtYXhpU2FtcGxlQW5kSG9sZABQMTdtYXhpU2FtcGxlQW5kSG9sZABQSzE3bWF4aVNhbXBsZUFuZEhvbGQAMTRtYXhpRGlzdG9ydGlvbgBQMTRtYXhpRGlzdG9ydGlvbgBQSzE0bWF4aURpc3RvcnRpb24AMTFtYXhpRmxhbmdlcgBQMTFtYXhpRmxhbmdlcgBQSzExbWF4aUZsYW5nZXIAZGlpZGlkZGQAMTBtYXhpQ2hvcnVzAFAxMG1heGlDaG9ydXMAUEsxMG1heGlDaG9ydXMAMTNtYXhpRENCbG9ja2VyAFAxM21heGlEQ0Jsb2NrZXIAUEsxM21heGlEQ0Jsb2NrZXIAN21heGlTVkYAUDdtYXhpU1ZGAFBLN21heGlTVkYAaWlpZAA4bWF4aU1hdGgAUDhtYXhpTWF0aABQSzhtYXhpTWF0aABkaWRkADltYXhpQ2xvY2sAUDltYXhpQ2xvY2sAUEs5bWF4aUNsb2NrADIybWF4aUt1cmFtb3RvT3NjaWxsYXRvcgBQMjJtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yAFBLMjJtYXhpS3VyYW1vdG9Pc2NpbGxhdG9yAGRpaWRkaQAyNW1heGlLdXJhbW90b09zY2lsbGF0b3JTZXQAUDI1bWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldABQSzI1bWF4aUt1cmFtb3RvT3NjaWxsYXRvclNldAB2aWlkaQBkaWlpADI3bWF4aUFzeW5jS3VyYW1vdG9Pc2NpbGxhdG9yAFAyN21heGlBc3luY0t1cmFtb3RvT3NjaWxsYXRvcgBQSzI3bWF4aUFzeW5jS3VyYW1vdG9Pc2NpbGxhdG9yADdtYXhpRkZUAFA3bWF4aUZGVABQSzdtYXhpRkZUAHZpaWlpaQBON21heGlGRlQ4ZmZ0TW9kZXNFAGlpaWZpAGZpaQA4bWF4aUlGRlQAUDhtYXhpSUZGVABQSzhtYXhpSUZGVABOOG1heGlJRkZUOGZmdE1vZGVzRQBmaWlpaWkAMTVtYXhpVGltZVN0cmV0Y2hJMTRoYW5uV2luRnVuY3RvckUAUDE1bWF4aVRpbWVTdHJldGNoSTE0aGFubldpbkZ1bmN0b3JFAFBLMTVtYXhpVGltZVN0cmV0Y2hJMTRoYW5uV2luRnVuY3RvckUATlN0M19fMjIwX19zaGFyZWRfcHRyX3BvaW50ZXJJUDE1bWF4aVRpbWVTdHJldGNoSTE0aGFubldpbkZ1bmN0b3JFTjEwZW1zY3JpcHRlbjE1c21hcnRfcHRyX3RyYWl0SU5TXzEwc2hhcmVkX3B0cklTM19FRUUxMXZhbF9kZWxldGVyRU5TXzlhbGxvY2F0b3JJUzNfRUVFRQBOMTBlbXNjcmlwdGVuMTVzbWFydF9wdHJfdHJhaXRJTlN0M19fMjEwc2hhcmVkX3B0ckkxNW1heGlUaW1lU3RyZXRjaEkxNGhhbm5XaW5GdW5jdG9yRUVFRTExdmFsX2RlbGV0ZXJFAE5TdDNfXzIxMHNoYXJlZF9wdHJJMTVtYXhpVGltZVN0cmV0Y2hJMTRoYW5uV2luRnVuY3RvckVFRQBpAE5TdDNfXzIyMF9fc2hhcmVkX3B0cl9lbXBsYWNlSTE1bWF4aVRpbWVTdHJldGNoSTE0aGFubldpbkZ1bmN0b3JFTlNfOWFsbG9jYXRvcklTM19FRUVFADltYXhpR3JhaW5JMTRoYW5uV2luRnVuY3RvckUAMTNtYXhpR3JhaW5CYXNlAGRpaWRkaWQAMTRtYXhpUGl0Y2hTaGlmdEkxNGhhbm5XaW5GdW5jdG9yRQBQMTRtYXhpUGl0Y2hTaGlmdEkxNGhhbm5XaW5GdW5jdG9yRQBQSzE0bWF4aVBpdGNoU2hpZnRJMTRoYW5uV2luRnVuY3RvckUATlN0M19fMjIwX19zaGFyZWRfcHRyX3BvaW50ZXJJUDE0bWF4aVBpdGNoU2hpZnRJMTRoYW5uV2luRnVuY3RvckVOMTBlbXNjcmlwdGVuMTVzbWFydF9wdHJfdHJhaXRJTlNfMTBzaGFyZWRfcHRySVMzX0VFRTExdmFsX2RlbGV0ZXJFTlNfOWFsbG9jYXRvcklTM19FRUVFAE4xMGVtc2NyaXB0ZW4xNXNtYXJ0X3B0cl90cmFpdElOU3QzX18yMTBzaGFyZWRfcHRySTE0bWF4aVBpdGNoU2hpZnRJMTRoYW5uV2luRnVuY3RvckVFRUUxMXZhbF9kZWxldGVyRQBOU3QzX18yMTBzaGFyZWRfcHRySTE0bWF4aVBpdGNoU2hpZnRJMTRoYW5uV2luRnVuY3RvckVFRQBOU3QzX18yMjBfX3NoYXJlZF9wdHJfZW1wbGFjZUkxNG1heGlQaXRjaFNoaWZ0STE0aGFubldpbkZ1bmN0b3JFTlNfOWFsbG9jYXRvcklTM19FRUVFADExbWF4aVN0cmV0Y2hJMTRoYW5uV2luRnVuY3RvckUAUDExbWF4aVN0cmV0Y2hJMTRoYW5uV2luRnVuY3RvckUAUEsxMW1heGlTdHJldGNoSTE0aGFubldpbkZ1bmN0b3JFAGRpaWRkZGlkAGRpaWRkZGkATG9hZGluZzogAGRhdGEAQ2g6IAAsIGxlbjogAEVSUk9SOiBDb3VsZCBub3QgbG9hZCBzYW1wbGUuAGFsbG9jYXRvcjxUPjo6YWxsb2NhdGUoc2l6ZV90IG4pICduJyBleGNlZWRzIG1heGltdW0gc3VwcG9ydGVkIHNpemUATlN0M19fMjEzYmFzaWNfZmlsZWJ1ZkljTlNfMTFjaGFyX3RyYWl0c0ljRUVFRQB3AGEAcgByKwB3KwBhKwB3YgBhYgByYgByK2IAdytiAGErYgBOU3QzX18yMTRiYXNpY19pZnN0cmVhbUljTlNfMTFjaGFyX3RyYWl0c0ljRUVFRQAKY2hhbm5lbHMgPSAlZApsZW5ndGggPSAlZABBdXRvdHJpbTogc3RhcnQ6IAAsIGVuZDogACVkIGlzIG5vdCBhIHBvd2VyIG9mIHR3bwoARXJyb3I6IEZGVCBjYWxsZWQgd2l0aCBzaXplICVkCgAwAC4uLy4uL3NyYy9saWJzL3N0Yl92b3JiaXMuYwBnZXRfd2luZG93AGYtPmJ5dGVzX2luX3NlZyA+IDAAZ2V0OF9wYWNrZXRfcmF3AGYtPmJ5dGVzX2luX3NlZyA9PSAwAG5leHRfc2VnbWVudABmLT5hbGxvYy5hbGxvY19idWZmZXJfbGVuZ3RoX2luX2J5dGVzID09IGYtPnRlbXBfb2Zmc2V0AHZvcmJpc19kZWNvZGVfcGFja2V0X3Jlc3QAKG4gJiAzKSA9PSAwAGltZGN0X3N0ZXAzX2l0ZXIwX2xvb3AAeiA8IGMtPnNvcnRlZF9lbnRyaWVzAGNvZGVib29rX2RlY29kZV9zdGFydAAhYy0+c3BhcnNlIHx8IHogPCBjLT5zb3J0ZWRfZW50cmllcwBjb2RlYm9va19kZWNvZGVfZGVpbnRlcmxlYXZlX3JlcGVhdABjLT5zb3J0ZWRfY29kZXdvcmRzIHx8IGMtPmNvZGV3b3JkcwBjb2RlYm9va19kZWNvZGVfc2NhbGFyX3JhdwAhYy0+c3BhcnNlAHZvcmJpc19kZWNvZGVfaW5pdGlhbABmLT50ZW1wX29mZnNldCA9PSBmLT5hbGxvYy5hbGxvY19idWZmZXJfbGVuZ3RoX2luX2J5dGVzAHN0YXJ0X2RlY29kZXIAcG93KChmbG9hdCkgcisxLCBkaW0pID4gZW50cmllcwBsb29rdXAxX3ZhbHVlcwAoaW50KSBmbG9vcihwb3coKGZsb2F0KSByLCBkaW0pKSA8PSBlbnRyaWVzAGsgPT0gYy0+c29ydGVkX2VudHJpZXMAY29tcHV0ZV9zb3J0ZWRfaHVmZm1hbgBjLT5zb3J0ZWRfY29kZXdvcmRzW3hdID09IGNvZGUAbGVuICE9IE5PX0NPREUAaW5jbHVkZV9pbl9zb3J0AGMtPnNvcnRlZF9lbnRyaWVzID09IDAAY29tcHV0ZV9jb2Rld29yZHMAYXZhaWxhYmxlW3ldID09IDAAdm9yYmlzYnVmX2MgPT0gMgBjb252ZXJ0X2NoYW5uZWxzX3Nob3J0X2ludGVybGVhdmVkAHZvaWQAYm9vbABzdGQ6OnN0cmluZwBzdGQ6OmJhc2ljX3N0cmluZzx1bnNpZ25lZCBjaGFyPgBzdGQ6OndzdHJpbmcAZW1zY3JpcHRlbjo6dmFsAGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHNpZ25lZCBjaGFyPgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzx1bnNpZ25lZCBjaGFyPgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxzaG9ydD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8dW5zaWduZWQgc2hvcnQ+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PGludD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8dW5zaWduZWQgaW50PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxpbnQ4X3Q+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHVpbnQ4X3Q+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PGludDE2X3Q+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHVpbnQxNl90PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxpbnQzMl90PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzx1aW50MzJfdD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8bG9uZyBkb3VibGU+AE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SWVFRQBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxkb3VibGU+AE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SWRFRQBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxmbG9hdD4ATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJZkVFAGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHVuc2lnbmVkIGxvbmc+AE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SW1FRQBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxsb25nPgBOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0lsRUUATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJakVFAE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SWlFRQBOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0l0RUUATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJc0VFAE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SWhFRQBOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0lhRUUAZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8Y2hhcj4ATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJY0VFAE5TdDNfXzIxMmJhc2ljX3N0cmluZ0l3TlNfMTFjaGFyX3RyYWl0c0l3RUVOU185YWxsb2NhdG9ySXdFRUVFAE5TdDNfXzIxMmJhc2ljX3N0cmluZ0loTlNfMTFjaGFyX3RyYWl0c0loRUVOU185YWxsb2NhdG9ySWhFRUVFAGRvdWJsZQBmbG9hdAB1bnNpZ25lZCBsb25nAGxvbmcAdW5zaWduZWQgaW50AGludAB1bnNpZ25lZCBzaG9ydABzaG9ydAB1bnNpZ25lZCBjaGFyAHNpZ25lZCBjaGFyAGNoYXIAAAECBAcDBgUALSsgICAwWDB4AChudWxsKQAtMFgrMFggMFgtMHgrMHggMHgAaW5mAElORgBOQU4ALgBpbmZpbml0eQBuYW4ATENfQUxMAExBTkcAQy5VVEYtOABQT1NJWABNVVNMX0xPQ1BBVEgAcndhAE5TdDNfXzI4aW9zX2Jhc2VFAE5TdDNfXzI5YmFzaWNfaW9zSWNOU18xMWNoYXJfdHJhaXRzSWNFRUVFAE5TdDNfXzI5YmFzaWNfaW9zSXdOU18xMWNoYXJfdHJhaXRzSXdFRUVFAE5TdDNfXzIxNWJhc2ljX3N0cmVhbWJ1ZkljTlNfMTFjaGFyX3RyYWl0c0ljRUVFRQBOU3QzX18yMTViYXNpY19zdHJlYW1idWZJd05TXzExY2hhcl90cmFpdHNJd0VFRUUATlN0M19fMjEzYmFzaWNfaXN0cmVhbUljTlNfMTFjaGFyX3RyYWl0c0ljRUVFRQBOU3QzX18yMTNiYXNpY19pc3RyZWFtSXdOU18xMWNoYXJfdHJhaXRzSXdFRUVFAE5TdDNfXzIxM2Jhc2ljX29zdHJlYW1JY05TXzExY2hhcl90cmFpdHNJY0VFRUUATlN0M19fMjEzYmFzaWNfb3N0cmVhbUl3TlNfMTFjaGFyX3RyYWl0c0l3RUVFRQBOU3QzX18yMTFfX3N0ZG91dGJ1Zkl3RUUATlN0M19fMjExX19zdGRvdXRidWZJY0VFAHVuc3VwcG9ydGVkIGxvY2FsZSBmb3Igc3RhbmRhcmQgaW5wdXQATlN0M19fMjEwX19zdGRpbmJ1Zkl3RUUATlN0M19fMjEwX19zdGRpbmJ1ZkljRUUATlN0M19fMjdjb2xsYXRlSWNFRQBOU3QzX18yNmxvY2FsZTVmYWNldEUATlN0M19fMjdjb2xsYXRlSXdFRQAlcABDAE5TdDNfXzI3bnVtX2dldEljTlNfMTlpc3RyZWFtYnVmX2l0ZXJhdG9ySWNOU18xMWNoYXJfdHJhaXRzSWNFRUVFRUUATlN0M19fMjlfX251bV9nZXRJY0VFAE5TdDNfXzIxNF9fbnVtX2dldF9iYXNlRQBOU3QzX18yN251bV9nZXRJd05TXzE5aXN0cmVhbWJ1Zl9pdGVyYXRvckl3TlNfMTFjaGFyX3RyYWl0c0l3RUVFRUVFAE5TdDNfXzI5X19udW1fZ2V0SXdFRQAlcAAAAABMAGxsACUAAAAAAGwATlN0M19fMjdudW1fcHV0SWNOU18xOW9zdHJlYW1idWZfaXRlcmF0b3JJY05TXzExY2hhcl90cmFpdHNJY0VFRUVFRQBOU3QzX18yOV9fbnVtX3B1dEljRUUATlN0M19fMjE0X19udW1fcHV0X2Jhc2VFAE5TdDNfXzI3bnVtX3B1dEl3TlNfMTlvc3RyZWFtYnVmX2l0ZXJhdG9ySXdOU18xMWNoYXJfdHJhaXRzSXdFRUVFRUUATlN0M19fMjlfX251bV9wdXRJd0VFACVIOiVNOiVTACVtLyVkLyV5ACVJOiVNOiVTICVwACVhICViICVkICVIOiVNOiVTICVZAEFNAFBNAEphbnVhcnkARmVicnVhcnkATWFyY2gAQXByaWwATWF5AEp1bmUASnVseQBBdWd1c3QAU2VwdGVtYmVyAE9jdG9iZXIATm92ZW1iZXIARGVjZW1iZXIASmFuAEZlYgBNYXIAQXByAEp1bgBKdWwAQXVnAFNlcABPY3QATm92AERlYwBTdW5kYXkATW9uZGF5AFR1ZXNkYXkAV2VkbmVzZGF5AFRodXJzZGF5AEZyaWRheQBTYXR1cmRheQBTdW4ATW9uAFR1ZQBXZWQAVGh1AEZyaQBTYXQAJW0vJWQvJXklWS0lbS0lZCVJOiVNOiVTICVwJUg6JU0lSDolTTolUyVIOiVNOiVTTlN0M19fMjh0aW1lX2dldEljTlNfMTlpc3RyZWFtYnVmX2l0ZXJhdG9ySWNOU18xMWNoYXJfdHJhaXRzSWNFRUVFRUUATlN0M19fMjIwX190aW1lX2dldF9jX3N0b3JhZ2VJY0VFAE5TdDNfXzI5dGltZV9iYXNlRQBOU3QzX18yOHRpbWVfZ2V0SXdOU18xOWlzdHJlYW1idWZfaXRlcmF0b3JJd05TXzExY2hhcl90cmFpdHNJd0VFRUVFRQBOU3QzX18yMjBfX3RpbWVfZ2V0X2Nfc3RvcmFnZUl3RUUATlN0M19fMjh0aW1lX3B1dEljTlNfMTlvc3RyZWFtYnVmX2l0ZXJhdG9ySWNOU18xMWNoYXJfdHJhaXRzSWNFRUVFRUUATlN0M19fMjEwX190aW1lX3B1dEUATlN0M19fMjh0aW1lX3B1dEl3TlNfMTlvc3RyZWFtYnVmX2l0ZXJhdG9ySXdOU18xMWNoYXJfdHJhaXRzSXdFRUVFRUUATlN0M19fMjEwbW9uZXlwdW5jdEljTGIwRUVFAE5TdDNfXzIxMG1vbmV5X2Jhc2VFAE5TdDNfXzIxMG1vbmV5cHVuY3RJY0xiMUVFRQBOU3QzX18yMTBtb25leXB1bmN0SXdMYjBFRUUATlN0M19fMjEwbW9uZXlwdW5jdEl3TGIxRUVFADAxMjM0NTY3ODkAJUxmAE5TdDNfXzI5bW9uZXlfZ2V0SWNOU18xOWlzdHJlYW1idWZfaXRlcmF0b3JJY05TXzExY2hhcl90cmFpdHNJY0VFRUVFRQBOU3QzX18yMTFfX21vbmV5X2dldEljRUUAMDEyMzQ1Njc4OQBOU3QzX18yOW1vbmV5X2dldEl3TlNfMTlpc3RyZWFtYnVmX2l0ZXJhdG9ySXdOU18xMWNoYXJfdHJhaXRzSXdFRUVFRUUATlN0M19fMjExX19tb25leV9nZXRJd0VFACUuMExmAE5TdDNfXzI5bW9uZXlfcHV0SWNOU18xOW9zdHJlYW1idWZfaXRlcmF0b3JJY05TXzExY2hhcl90cmFpdHNJY0VFRUVFRQBOU3QzX18yMTFfX21vbmV5X3B1dEljRUUATlN0M19fMjltb25leV9wdXRJd05TXzE5b3N0cmVhbWJ1Zl9pdGVyYXRvckl3TlNfMTFjaGFyX3RyYWl0c0l3RUVFRUVFAE5TdDNfXzIxMV9fbW9uZXlfcHV0SXdFRQBOU3QzX18yOG1lc3NhZ2VzSWNFRQBOU3QzX18yMTNtZXNzYWdlc19iYXNlRQBOU3QzX18yMTdfX3dpZGVuX2Zyb21fdXRmOElMbTMyRUVFAE5TdDNfXzI3Y29kZWN2dElEaWMxMV9fbWJzdGF0ZV90RUUATlN0M19fMjEyY29kZWN2dF9iYXNlRQBOU3QzX18yMTZfX25hcnJvd190b191dGY4SUxtMzJFRUUATlN0M19fMjhtZXNzYWdlc0l3RUUATlN0M19fMjdjb2RlY3Z0SWNjMTFfX21ic3RhdGVfdEVFAE5TdDNfXzI3Y29kZWN2dEl3YzExX19tYnN0YXRlX3RFRQBOU3QzX18yN2NvZGVjdnRJRHNjMTFfX21ic3RhdGVfdEVFAE5TdDNfXzI2bG9jYWxlNV9faW1wRQBOU3QzX18yNWN0eXBlSWNFRQBOU3QzX18yMTBjdHlwZV9iYXNlRQBOU3QzX18yNWN0eXBlSXdFRQBmYWxzZQB0cnVlAE5TdDNfXzI4bnVtcHVuY3RJY0VFAE5TdDNfXzI4bnVtcHVuY3RJd0VFAE5TdDNfXzIxNF9fc2hhcmVkX2NvdW50RQBOU3QzX18yMTlfX3NoYXJlZF93ZWFrX2NvdW50RQB0ZXJtaW5hdGluZyB3aXRoICVzIGV4Y2VwdGlvbiBvZiB0eXBlICVzOiAlcwB0ZXJtaW5hdGluZyB3aXRoICVzIGV4Y2VwdGlvbiBvZiB0eXBlICVzAHRlcm1pbmF0aW5nIHdpdGggJXMgZm9yZWlnbiBleGNlcHRpb24AdGVybWluYXRpbmcAdW5jYXVnaHQAU3Q5ZXhjZXB0aW9uAE4xMF9fY3h4YWJpdjExNl9fc2hpbV90eXBlX2luZm9FAFN0OXR5cGVfaW5mbwBOMTBfX2N4eGFiaXYxMjBfX3NpX2NsYXNzX3R5cGVfaW5mb0UATjEwX19jeHhhYml2MTE3X19jbGFzc190eXBlX2luZm9FAHB0aHJlYWRfb25jZSBmYWlsdXJlIGluIF9fY3hhX2dldF9nbG9iYWxzX2Zhc3QoKQBjYW5ub3QgY3JlYXRlIHB0aHJlYWQga2V5IGZvciBfX2N4YV9nZXRfZ2xvYmFscygpAGNhbm5vdCB6ZXJvIG91dCB0aHJlYWQgdmFsdWUgZm9yIF9fY3hhX2dldF9nbG9iYWxzKCkAdGVybWluYXRlX2hhbmRsZXIgdW5leHBlY3RlZGx5IHJldHVybmVkAFN0MTFsb2dpY19lcnJvcgBTdDEybGVuZ3RoX2Vycm9yAHN0ZDo6YmFkX2Nhc3QAU3Q4YmFkX2Nhc3QATjEwX19jeHhhYml2MTE5X19wb2ludGVyX3R5cGVfaW5mb0UATjEwX19jeHhhYml2MTE3X19wYmFzZV90eXBlX2luZm9FAE4xMF9fY3h4YWJpdjEyM19fZnVuZGFtZW50YWxfdHlwZV9pbmZvRQB2AERuAGIAYwBoAHMAdABpAGoAbQBmAGQATjEwX19jeHhhYml2MTE2X19lbnVtX3R5cGVfaW5mb0UATjEwX19jeHhhYml2MTIxX192bWlfY2xhc3NfdHlwZV9pbmZvRQ==';
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
    'initial': 1412,
    'maximum': 1412,
    'element': 'anyfunc'
  });
  env['__memory_base'] = 1024; // tell the memory segments where to place themselves
  env['__table_base'] = 0; // table starts at 0 by default (even in dynamic linking, for the main module)

  var exports = createWasm(env);
  return exports;
};

// === Body ===

var ASM_CONSTS = [];





// STATICTOP = STATIC_BASE + 51488;
/* global initializers */  __ATINIT__.push({ func: function() { globalCtors() } });








/* no memory initializer */
var tempDoublePtr = 52496

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


  function ___assert_fail(condition, filename, line, func) {
      abort('Assertion failed: ' + UTF8ToString(condition) + ', at: ' + [filename ? UTF8ToString(filename) : 'unknown filename', line, func ? UTF8ToString(func) : 'unknown function']);
    }

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

  function ___cxa_pure_virtual() {
      ABORT = true;
      throw 'Pure virtual function called!';
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
  
  var _stdin=52272;
  
  var _stdout=52288;
  
  var _stderr=52304;var FS={root:null,mounts:[],devices:{},streams:[],nextInode:1,nameTable:null,currentPath:"/",initialized:false,ignorePermissions:true,trackingDelegate:{},tracking:{openFlags:{READ:1,WRITE:2}},ErrnoError:null,genericErrors:{},filesystems:null,syncFSRequests:0,handleFSError:function (e) {
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

  function _exit(status) {
      // void _exit(int status);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/exit.html
      exit(status);
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

   

  function _llvm_log10_f32(x) {
      return Math.log(x) / Math.LN10; // TODO: Math.log10, when browser support is there
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

  function _llvm_trap() {
      abort('trap!');
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

var asmLibraryArg = { "abort": abort, "setTempRet0": setTempRet0, "getTempRet0": getTempRet0, "ClassHandle": ClassHandle, "ClassHandle_clone": ClassHandle_clone, "ClassHandle_delete": ClassHandle_delete, "ClassHandle_deleteLater": ClassHandle_deleteLater, "ClassHandle_isAliasOf": ClassHandle_isAliasOf, "ClassHandle_isDeleted": ClassHandle_isDeleted, "RegisteredClass": RegisteredClass, "RegisteredPointer": RegisteredPointer, "RegisteredPointer_deleteObject": RegisteredPointer_deleteObject, "RegisteredPointer_destructor": RegisteredPointer_destructor, "RegisteredPointer_fromWireType": RegisteredPointer_fromWireType, "RegisteredPointer_getPointee": RegisteredPointer_getPointee, "___assert_fail": ___assert_fail, "___cxa_allocate_exception": ___cxa_allocate_exception, "___cxa_begin_catch": ___cxa_begin_catch, "___cxa_find_matching_catch": ___cxa_find_matching_catch, "___cxa_free_exception": ___cxa_free_exception, "___cxa_pure_virtual": ___cxa_pure_virtual, "___cxa_throw": ___cxa_throw, "___cxa_uncaught_exception": ___cxa_uncaught_exception, "___gxx_personality_v0": ___gxx_personality_v0, "___lock": ___lock, "___map_file": ___map_file, "___resumeException": ___resumeException, "___setErrNo": ___setErrNo, "___syscall140": ___syscall140, "___syscall145": ___syscall145, "___syscall146": ___syscall146, "___syscall221": ___syscall221, "___syscall5": ___syscall5, "___syscall54": ___syscall54, "___syscall6": ___syscall6, "___syscall91": ___syscall91, "___unlock": ___unlock, "__addDays": __addDays, "__arraySum": __arraySum, "__embind_register_bool": __embind_register_bool, "__embind_register_class": __embind_register_class, "__embind_register_class_class_function": __embind_register_class_class_function, "__embind_register_class_constructor": __embind_register_class_constructor, "__embind_register_class_function": __embind_register_class_function, "__embind_register_class_property": __embind_register_class_property, "__embind_register_emval": __embind_register_emval, "__embind_register_enum": __embind_register_enum, "__embind_register_enum_value": __embind_register_enum_value, "__embind_register_float": __embind_register_float, "__embind_register_integer": __embind_register_integer, "__embind_register_memory_view": __embind_register_memory_view, "__embind_register_smart_ptr": __embind_register_smart_ptr, "__embind_register_std_string": __embind_register_std_string, "__embind_register_std_wstring": __embind_register_std_wstring, "__embind_register_void": __embind_register_void, "__emval_call": __emval_call, "__emval_decref": __emval_decref, "__emval_incref": __emval_incref, "__emval_lookupTypes": __emval_lookupTypes, "__emval_register": __emval_register, "__emval_take_value": __emval_take_value, "__isLeapYear": __isLeapYear, "_abort": _abort, "_embind_repr": _embind_repr, "_emscripten_get_heap_size": _emscripten_get_heap_size, "_emscripten_memcpy_big": _emscripten_memcpy_big, "_emscripten_resize_heap": _emscripten_resize_heap, "_exit": _exit, "_getenv": _getenv, "_llvm_log10_f32": _llvm_log10_f32, "_llvm_stackrestore": _llvm_stackrestore, "_llvm_stacksave": _llvm_stacksave, "_llvm_trap": _llvm_trap, "_pthread_cond_wait": _pthread_cond_wait, "_pthread_getspecific": _pthread_getspecific, "_pthread_key_create": _pthread_key_create, "_pthread_once": _pthread_once, "_pthread_setspecific": _pthread_setspecific, "_strftime": _strftime, "_strftime_l": _strftime_l, "abortOnCannotGrowMemory": abortOnCannotGrowMemory, "constNoSmartPtrRawPointerToWireType": constNoSmartPtrRawPointerToWireType, "count_emval_handles": count_emval_handles, "craftInvokerFunction": craftInvokerFunction, "createNamedFunction": createNamedFunction, "downcastPointer": downcastPointer, "embind__requireFunction": embind__requireFunction, "embind_init_charCodes": embind_init_charCodes, "emscripten_realloc_buffer": emscripten_realloc_buffer, "ensureOverloadTable": ensureOverloadTable, "enumReadValueFromPointer": enumReadValueFromPointer, "exposePublicSymbol": exposePublicSymbol, "extendError": extendError, "floatReadValueFromPointer": floatReadValueFromPointer, "flushPendingDeletes": flushPendingDeletes, "genericPointerToWireType": genericPointerToWireType, "getBasestPointer": getBasestPointer, "getInheritedInstance": getInheritedInstance, "getInheritedInstanceCount": getInheritedInstanceCount, "getLiveInheritedInstances": getLiveInheritedInstances, "getShiftFromSize": getShiftFromSize, "getTypeName": getTypeName, "get_first_emval": get_first_emval, "heap32VectorToArray": heap32VectorToArray, "init_ClassHandle": init_ClassHandle, "init_RegisteredPointer": init_RegisteredPointer, "init_embind": init_embind, "init_emval": init_emval, "integerReadValueFromPointer": integerReadValueFromPointer, "makeClassHandle": makeClassHandle, "makeLegalFunctionName": makeLegalFunctionName, "new_": new_, "nonConstNoSmartPtrRawPointerToWireType": nonConstNoSmartPtrRawPointerToWireType, "readLatin1String": readLatin1String, "registerType": registerType, "replacePublicSymbol": replacePublicSymbol, "requireHandle": requireHandle, "requireRegisteredType": requireRegisteredType, "runDestructor": runDestructor, "runDestructors": runDestructors, "setDelayFunction": setDelayFunction, "shallowCopyInternalPointer": shallowCopyInternalPointer, "simpleReadValueFromPointer": simpleReadValueFromPointer, "throwBindingError": throwBindingError, "throwInstanceAlreadyDeleted": throwInstanceAlreadyDeleted, "throwInternalError": throwInternalError, "throwUnboundTypeError": throwUnboundTypeError, "upcastPointer": upcastPointer, "validateThis": validateThis, "whenDependentTypesAreResolved": whenDependentTypesAreResolved, "tempDoublePtr": tempDoublePtr, "DYNAMICTOP_PTR": DYNAMICTOP_PTR }
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
var dynCall_dd = Module["dynCall_dd"] = asm["dynCall_dd"];
var dynCall_ddd = Module["dynCall_ddd"] = asm["dynCall_ddd"];
var dynCall_dddd = Module["dynCall_dddd"] = asm["dynCall_dddd"];
var dynCall_dddddd = Module["dynCall_dddddd"] = asm["dynCall_dddddd"];
var dynCall_di = Module["dynCall_di"] = asm["dynCall_di"];
var dynCall_did = Module["dynCall_did"] = asm["dynCall_did"];
var dynCall_didd = Module["dynCall_didd"] = asm["dynCall_didd"];
var dynCall_diddd = Module["dynCall_diddd"] = asm["dynCall_diddd"];
var dynCall_diddddd = Module["dynCall_diddddd"] = asm["dynCall_diddddd"];
var dynCall_didddddii = Module["dynCall_didddddii"] = asm["dynCall_didddddii"];
var dynCall_didddi = Module["dynCall_didddi"] = asm["dynCall_didddi"];
var dynCall_didddid = Module["dynCall_didddid"] = asm["dynCall_didddid"];
var dynCall_didddii = Module["dynCall_didddii"] = asm["dynCall_didddii"];
var dynCall_diddi = Module["dynCall_diddi"] = asm["dynCall_diddi"];
var dynCall_diddid = Module["dynCall_diddid"] = asm["dynCall_diddid"];
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
var dynCall_diidddi = Module["dynCall_diidddi"] = asm["dynCall_diidddi"];
var dynCall_diidddid = Module["dynCall_diidddid"] = asm["dynCall_diidddid"];
var dynCall_diidddii = Module["dynCall_diidddii"] = asm["dynCall_diidddii"];
var dynCall_diiddi = Module["dynCall_diiddi"] = asm["dynCall_diiddi"];
var dynCall_diiddid = Module["dynCall_diiddid"] = asm["dynCall_diiddid"];
var dynCall_diiddidd = Module["dynCall_diiddidd"] = asm["dynCall_diiddidd"];
var dynCall_diidi = Module["dynCall_diidi"] = asm["dynCall_diidi"];
var dynCall_diidid = Module["dynCall_diidid"] = asm["dynCall_diidid"];
var dynCall_diididdd = Module["dynCall_diididdd"] = asm["dynCall_diididdd"];
var dynCall_diididi = Module["dynCall_diididi"] = asm["dynCall_diididi"];
var dynCall_diii = Module["dynCall_diii"] = asm["dynCall_diii"];
var dynCall_diiii = Module["dynCall_diiii"] = asm["dynCall_diiii"];
var dynCall_fi = Module["dynCall_fi"] = asm["dynCall_fi"];
var dynCall_fii = Module["dynCall_fii"] = asm["dynCall_fii"];
var dynCall_fiiii = Module["dynCall_fiiii"] = asm["dynCall_fiiii"];
var dynCall_fiiiii = Module["dynCall_fiiiii"] = asm["dynCall_fiiiii"];
var dynCall_i = Module["dynCall_i"] = asm["dynCall_i"];
var dynCall_ii = Module["dynCall_ii"] = asm["dynCall_ii"];
var dynCall_iid = Module["dynCall_iid"] = asm["dynCall_iid"];
var dynCall_iifi = Module["dynCall_iifi"] = asm["dynCall_iifi"];
var dynCall_iii = Module["dynCall_iii"] = asm["dynCall_iii"];
var dynCall_iiid = Module["dynCall_iiid"] = asm["dynCall_iiid"];
var dynCall_iiifi = Module["dynCall_iiifi"] = asm["dynCall_iiifi"];
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
var dynCall_viddd = Module["dynCall_viddd"] = asm["dynCall_viddd"];
var dynCall_vidi = Module["dynCall_vidi"] = asm["dynCall_vidi"];
var dynCall_vidid = Module["dynCall_vidid"] = asm["dynCall_vidid"];
var dynCall_vididd = Module["dynCall_vididd"] = asm["dynCall_vididd"];
var dynCall_vididdd = Module["dynCall_vididdd"] = asm["dynCall_vididdd"];
var dynCall_viffii = Module["dynCall_viffii"] = asm["dynCall_viffii"];
var dynCall_vii = Module["dynCall_vii"] = asm["dynCall_vii"];
var dynCall_viid = Module["dynCall_viid"] = asm["dynCall_viid"];
var dynCall_viidd = Module["dynCall_viidd"] = asm["dynCall_viidd"];
var dynCall_viiddd = Module["dynCall_viiddd"] = asm["dynCall_viiddd"];
var dynCall_viidi = Module["dynCall_viidi"] = asm["dynCall_viidi"];
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

console.log(
	"running%c Maximilian v2.0.2 (Wasm)",
	"font-weight: bold; background: #222; color: #bada55"
);



//NOTE: This is the main thing that post.js adds to Maximilian setup, a Module export definition which is required for the WASM design pattern
export default Module;

