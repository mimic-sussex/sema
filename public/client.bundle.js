/******/ (function(modules) { // webpackBootstrap
/******/ 	// install a JSONP callback for chunk loading
/******/ 	function webpackJsonpCallback(data) {
/******/ 		var chunkIds = data[0];
/******/ 		var moreModules = data[1];
/******/
/******/
/******/ 		// add "moreModules" to the modules object,
/******/ 		// then flag all "chunkIds" as loaded and fire callback
/******/ 		var moduleId, chunkId, i = 0, resolves = [];
/******/ 		for(;i < chunkIds.length; i++) {
/******/ 			chunkId = chunkIds[i];
/******/ 			if(Object.prototype.hasOwnProperty.call(installedChunks, chunkId) && installedChunks[chunkId]) {
/******/ 				resolves.push(installedChunks[chunkId][0]);
/******/ 			}
/******/ 			installedChunks[chunkId] = 0;
/******/ 		}
/******/ 		for(moduleId in moreModules) {
/******/ 			if(Object.prototype.hasOwnProperty.call(moreModules, moduleId)) {
/******/ 				modules[moduleId] = moreModules[moduleId];
/******/ 			}
/******/ 		}
/******/ 		if(parentJsonpFunction) parentJsonpFunction(data);
/******/
/******/ 		while(resolves.length) {
/******/ 			resolves.shift()();
/******/ 		}
/******/
/******/ 	};
/******/
/******/
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// object to store loaded and loading chunks
/******/ 	// undefined = chunk not loaded, null = chunk preloaded/prefetched
/******/ 	// Promise = chunk loading, 0 = chunk loaded
/******/ 	var installedChunks = {
/******/ 		"client": 0
/******/ 	};
/******/
/******/
/******/
/******/ 	// script path function
/******/ 	function jsonpScriptSrc(chunkId) {
/******/ 		return __webpack_require__.p + "" + ({}[chunkId]||chunkId) + ".bundle.js"
/******/ 	}
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/ 	// This file contains only the entry chunk.
/******/ 	// The chunk loading function for additional chunks
/******/ 	__webpack_require__.e = function requireEnsure(chunkId) {
/******/ 		var promises = [];
/******/
/******/
/******/ 		// JSONP chunk loading for javascript
/******/
/******/ 		var installedChunkData = installedChunks[chunkId];
/******/ 		if(installedChunkData !== 0) { // 0 means "already installed".
/******/
/******/ 			// a Promise means "currently loading".
/******/ 			if(installedChunkData) {
/******/ 				promises.push(installedChunkData[2]);
/******/ 			} else {
/******/ 				// setup Promise in chunk cache
/******/ 				var promise = new Promise(function(resolve, reject) {
/******/ 					installedChunkData = installedChunks[chunkId] = [resolve, reject];
/******/ 				});
/******/ 				promises.push(installedChunkData[2] = promise);
/******/
/******/ 				// start chunk loading
/******/ 				var script = document.createElement('script');
/******/ 				var onScriptComplete;
/******/
/******/ 				script.charset = 'utf-8';
/******/ 				script.timeout = 120;
/******/ 				if (__webpack_require__.nc) {
/******/ 					script.setAttribute("nonce", __webpack_require__.nc);
/******/ 				}
/******/ 				script.src = jsonpScriptSrc(chunkId);
/******/
/******/ 				// create error before stack unwound to get useful stacktrace later
/******/ 				var error = new Error();
/******/ 				onScriptComplete = function (event) {
/******/ 					// avoid mem leaks in IE.
/******/ 					script.onerror = script.onload = null;
/******/ 					clearTimeout(timeout);
/******/ 					var chunk = installedChunks[chunkId];
/******/ 					if(chunk !== 0) {
/******/ 						if(chunk) {
/******/ 							var errorType = event && (event.type === 'load' ? 'missing' : event.type);
/******/ 							var realSrc = event && event.target && event.target.src;
/******/ 							error.message = 'Loading chunk ' + chunkId + ' failed.\n(' + errorType + ': ' + realSrc + ')';
/******/ 							error.name = 'ChunkLoadError';
/******/ 							error.type = errorType;
/******/ 							error.request = realSrc;
/******/ 							chunk[1](error);
/******/ 						}
/******/ 						installedChunks[chunkId] = undefined;
/******/ 					}
/******/ 				};
/******/ 				var timeout = setTimeout(function(){
/******/ 					onScriptComplete({ type: 'timeout', target: script });
/******/ 				}, 120000);
/******/ 				script.onerror = script.onload = onScriptComplete;
/******/ 				document.head.appendChild(script);
/******/ 			}
/******/ 		}
/******/ 		return Promise.all(promises);
/******/ 	};
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, { enumerable: true, get: getter });
/******/ 		}
/******/ 	};
/******/
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = function(exports) {
/******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		}
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/
/******/ 	// create a fake namespace object
/******/ 	// mode & 1: value is a module id, require it
/******/ 	// mode & 2: merge all properties of value into the ns
/******/ 	// mode & 4: return value when already ns object
/******/ 	// mode & 8|1: behave like require
/******/ 	__webpack_require__.t = function(value, mode) {
/******/ 		if(mode & 1) value = __webpack_require__(value);
/******/ 		if(mode & 8) return value;
/******/ 		if((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
/******/ 		var ns = Object.create(null);
/******/ 		__webpack_require__.r(ns);
/******/ 		Object.defineProperty(ns, 'default', { enumerable: true, value: value });
/******/ 		if(mode & 2 && typeof value != 'string') for(var key in value) __webpack_require__.d(ns, key, function(key) { return value[key]; }.bind(null, key));
/******/ 		return ns;
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "/public/";
/******/
/******/ 	// on error function for async loading
/******/ 	__webpack_require__.oe = function(err) { console.error(err); throw err; };
/******/
/******/ 	var jsonpArray = (typeof self !== 'undefined' ? self : this)["webpackJsonp"] = (typeof self !== 'undefined' ? self : this)["webpackJsonp"] || [];
/******/ 	var oldJsonpFunction = jsonpArray.push.bind(jsonpArray);
/******/ 	jsonpArray.push = webpackJsonpCallback;
/******/ 	jsonpArray = jsonpArray.slice();
/******/ 	for(var i = 0; i < jsonpArray.length; i++) webpackJsonpCallback(jsonpArray[i]);
/******/ 	var parentJsonpFunction = oldJsonpFunction;
/******/
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 0);
/******/ })
/************************************************************************/
/******/ ({

/***/ "./node_modules/codemirror/lib/codemirror.css":
/*!****************************************************!*\
  !*** ./node_modules/codemirror/lib/codemirror.css ***!
  \****************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

var content = __webpack_require__(/*! !../../css-loader/dist/cjs.js!./codemirror.css */ "./node_modules/css-loader/dist/cjs.js!./node_modules/codemirror/lib/codemirror.css");

if (typeof content === 'string') {
  content = [[module.i, content, '']];
}

var options = {}

options.insert = "head";
options.singleton = false;

var update = __webpack_require__(/*! ../../style-loader/dist/runtime/injectStylesIntoStyleTag.js */ "./node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js")(content, options);

if (content.locals) {
  module.exports = content.locals;
}


/***/ }),

/***/ "./node_modules/css-loader/dist/cjs.js!./node_modules/codemirror/lib/codemirror.css":
/*!******************************************************************************************!*\
  !*** ./node_modules/css-loader/dist/cjs.js!./node_modules/codemirror/lib/codemirror.css ***!
  \******************************************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

exports = module.exports = __webpack_require__(/*! ../../css-loader/dist/runtime/api.js */ "./node_modules/css-loader/dist/runtime/api.js")(false);
// Module
exports.push([module.i, "/* BASICS */\n\n.CodeMirror {\n  /* Set height, width, borders, and global font properties here */\n  font-family: monospace;\n  height: 300px;\n  color: black;\n  direction: ltr;\n}\n\n/* PADDING */\n\n.CodeMirror-lines {\n  padding: 4px 0; /* Vertical padding around content */\n}\n.CodeMirror pre.CodeMirror-line,\n.CodeMirror pre.CodeMirror-line-like {\n  padding: 0 4px; /* Horizontal padding of content */\n}\n\n.CodeMirror-scrollbar-filler, .CodeMirror-gutter-filler {\n  background-color: white; /* The little square between H and V scrollbars */\n}\n\n/* GUTTER */\n\n.CodeMirror-gutters {\n  border-right: 1px solid #ddd;\n  background-color: #f7f7f7;\n  white-space: nowrap;\n}\n.CodeMirror-linenumbers {}\n.CodeMirror-linenumber {\n  padding: 0 3px 0 5px;\n  min-width: 20px;\n  text-align: right;\n  color: #999;\n  white-space: nowrap;\n}\n\n.CodeMirror-guttermarker { color: black; }\n.CodeMirror-guttermarker-subtle { color: #999; }\n\n/* CURSOR */\n\n.CodeMirror-cursor {\n  border-left: 1px solid black;\n  border-right: none;\n  width: 0;\n}\n/* Shown when moving in bi-directional text */\n.CodeMirror div.CodeMirror-secondarycursor {\n  border-left: 1px solid silver;\n}\n.cm-fat-cursor .CodeMirror-cursor {\n  width: auto;\n  border: 0 !important;\n  background: #7e7;\n}\n.cm-fat-cursor div.CodeMirror-cursors {\n  z-index: 1;\n}\n.cm-fat-cursor-mark {\n  background-color: rgba(20, 255, 20, 0.5);\n  -webkit-animation: blink 1.06s steps(1) infinite;\n  -moz-animation: blink 1.06s steps(1) infinite;\n  animation: blink 1.06s steps(1) infinite;\n}\n.cm-animate-fat-cursor {\n  width: auto;\n  border: 0;\n  -webkit-animation: blink 1.06s steps(1) infinite;\n  -moz-animation: blink 1.06s steps(1) infinite;\n  animation: blink 1.06s steps(1) infinite;\n  background-color: #7e7;\n}\n@-moz-keyframes blink {\n  0% {}\n  50% { background-color: transparent; }\n  100% {}\n}\n@-webkit-keyframes blink {\n  0% {}\n  50% { background-color: transparent; }\n  100% {}\n}\n@keyframes blink {\n  0% {}\n  50% { background-color: transparent; }\n  100% {}\n}\n\n/* Can style cursor different in overwrite (non-insert) mode */\n.CodeMirror-overwrite .CodeMirror-cursor {}\n\n.cm-tab { display: inline-block; text-decoration: inherit; }\n\n.CodeMirror-rulers {\n  position: absolute;\n  left: 0; right: 0; top: -50px; bottom: 0;\n  overflow: hidden;\n}\n.CodeMirror-ruler {\n  border-left: 1px solid #ccc;\n  top: 0; bottom: 0;\n  position: absolute;\n}\n\n/* DEFAULT THEME */\n\n.cm-s-default .cm-header {color: blue;}\n.cm-s-default .cm-quote {color: #090;}\n.cm-negative {color: #d44;}\n.cm-positive {color: #292;}\n.cm-header, .cm-strong {font-weight: bold;}\n.cm-em {font-style: italic;}\n.cm-link {text-decoration: underline;}\n.cm-strikethrough {text-decoration: line-through;}\n\n.cm-s-default .cm-keyword {color: #708;}\n.cm-s-default .cm-atom {color: #219;}\n.cm-s-default .cm-number {color: #164;}\n.cm-s-default .cm-def {color: #00f;}\n.cm-s-default .cm-variable,\n.cm-s-default .cm-punctuation,\n.cm-s-default .cm-property,\n.cm-s-default .cm-operator {}\n.cm-s-default .cm-variable-2 {color: #05a;}\n.cm-s-default .cm-variable-3, .cm-s-default .cm-type {color: #085;}\n.cm-s-default .cm-comment {color: #a50;}\n.cm-s-default .cm-string {color: #a11;}\n.cm-s-default .cm-string-2 {color: #f50;}\n.cm-s-default .cm-meta {color: #555;}\n.cm-s-default .cm-qualifier {color: #555;}\n.cm-s-default .cm-builtin {color: #30a;}\n.cm-s-default .cm-bracket {color: #997;}\n.cm-s-default .cm-tag {color: #170;}\n.cm-s-default .cm-attribute {color: #00c;}\n.cm-s-default .cm-hr {color: #999;}\n.cm-s-default .cm-link {color: #00c;}\n\n.cm-s-default .cm-error {color: #f00;}\n.cm-invalidchar {color: #f00;}\n\n.CodeMirror-composing { border-bottom: 2px solid; }\n\n/* Default styles for common addons */\n\ndiv.CodeMirror span.CodeMirror-matchingbracket {color: #0b0;}\ndiv.CodeMirror span.CodeMirror-nonmatchingbracket {color: #a22;}\n.CodeMirror-matchingtag { background: rgba(255, 150, 0, .3); }\n.CodeMirror-activeline-background {background: #e8f2ff;}\n\n/* STOP */\n\n/* The rest of this file contains styles related to the mechanics of\n   the editor. You probably shouldn't touch them. */\n\n.CodeMirror {\n  position: relative;\n  overflow: hidden;\n  background: white;\n}\n\n.CodeMirror-scroll {\n  overflow: scroll !important; /* Things will break if this is overridden */\n  /* 30px is the magic margin used to hide the element's real scrollbars */\n  /* See overflow: hidden in .CodeMirror */\n  margin-bottom: -30px; margin-right: -30px;\n  padding-bottom: 30px;\n  height: 100%;\n  outline: none; /* Prevent dragging from highlighting the element */\n  position: relative;\n}\n.CodeMirror-sizer {\n  position: relative;\n  border-right: 30px solid transparent;\n}\n\n/* The fake, visible scrollbars. Used to force redraw during scrolling\n   before actual scrolling happens, thus preventing shaking and\n   flickering artifacts. */\n.CodeMirror-vscrollbar, .CodeMirror-hscrollbar, .CodeMirror-scrollbar-filler, .CodeMirror-gutter-filler {\n  position: absolute;\n  z-index: 6;\n  display: none;\n}\n.CodeMirror-vscrollbar {\n  right: 0; top: 0;\n  overflow-x: hidden;\n  overflow-y: scroll;\n}\n.CodeMirror-hscrollbar {\n  bottom: 0; left: 0;\n  overflow-y: hidden;\n  overflow-x: scroll;\n}\n.CodeMirror-scrollbar-filler {\n  right: 0; bottom: 0;\n}\n.CodeMirror-gutter-filler {\n  left: 0; bottom: 0;\n}\n\n.CodeMirror-gutters {\n  position: absolute; left: 0; top: 0;\n  min-height: 100%;\n  z-index: 3;\n}\n.CodeMirror-gutter {\n  white-space: normal;\n  height: 100%;\n  display: inline-block;\n  vertical-align: top;\n  margin-bottom: -30px;\n}\n.CodeMirror-gutter-wrapper {\n  position: absolute;\n  z-index: 4;\n  background: none !important;\n  border: none !important;\n}\n.CodeMirror-gutter-background {\n  position: absolute;\n  top: 0; bottom: 0;\n  z-index: 4;\n}\n.CodeMirror-gutter-elt {\n  position: absolute;\n  cursor: default;\n  z-index: 4;\n}\n.CodeMirror-gutter-wrapper ::selection { background-color: transparent }\n.CodeMirror-gutter-wrapper ::-moz-selection { background-color: transparent }\n\n.CodeMirror-lines {\n  cursor: text;\n  min-height: 1px; /* prevents collapsing before first draw */\n}\n.CodeMirror pre.CodeMirror-line,\n.CodeMirror pre.CodeMirror-line-like {\n  /* Reset some styles that the rest of the page might have set */\n  -moz-border-radius: 0; -webkit-border-radius: 0; border-radius: 0;\n  border-width: 0;\n  background: transparent;\n  font-family: inherit;\n  font-size: inherit;\n  margin: 0;\n  white-space: pre;\n  word-wrap: normal;\n  line-height: inherit;\n  color: inherit;\n  z-index: 2;\n  position: relative;\n  overflow: visible;\n  -webkit-tap-highlight-color: transparent;\n  -webkit-font-variant-ligatures: contextual;\n  font-variant-ligatures: contextual;\n}\n.CodeMirror-wrap pre.CodeMirror-line,\n.CodeMirror-wrap pre.CodeMirror-line-like {\n  word-wrap: break-word;\n  white-space: pre-wrap;\n  word-break: normal;\n}\n\n.CodeMirror-linebackground {\n  position: absolute;\n  left: 0; right: 0; top: 0; bottom: 0;\n  z-index: 0;\n}\n\n.CodeMirror-linewidget {\n  position: relative;\n  z-index: 2;\n  padding: 0.1px; /* Force widget margins to stay inside of the container */\n}\n\n.CodeMirror-widget {}\n\n.CodeMirror-rtl pre { direction: rtl; }\n\n.CodeMirror-code {\n  outline: none;\n}\n\n/* Force content-box sizing for the elements where we expect it */\n.CodeMirror-scroll,\n.CodeMirror-sizer,\n.CodeMirror-gutter,\n.CodeMirror-gutters,\n.CodeMirror-linenumber {\n  -moz-box-sizing: content-box;\n  box-sizing: content-box;\n}\n\n.CodeMirror-measure {\n  position: absolute;\n  width: 100%;\n  height: 0;\n  overflow: hidden;\n  visibility: hidden;\n}\n\n.CodeMirror-cursor {\n  position: absolute;\n  pointer-events: none;\n}\n.CodeMirror-measure pre { position: static; }\n\ndiv.CodeMirror-cursors {\n  visibility: hidden;\n  position: relative;\n  z-index: 3;\n}\ndiv.CodeMirror-dragcursors {\n  visibility: visible;\n}\n\n.CodeMirror-focused div.CodeMirror-cursors {\n  visibility: visible;\n}\n\n.CodeMirror-selected { background: #d9d9d9; }\n.CodeMirror-focused .CodeMirror-selected { background: #d7d4f0; }\n.CodeMirror-crosshair { cursor: crosshair; }\n.CodeMirror-line::selection, .CodeMirror-line > span::selection, .CodeMirror-line > span > span::selection { background: #d7d4f0; }\n.CodeMirror-line::-moz-selection, .CodeMirror-line > span::-moz-selection, .CodeMirror-line > span > span::-moz-selection { background: #d7d4f0; }\n\n.cm-searching {\n  background-color: #ffa;\n  background-color: rgba(255, 255, 0, .4);\n}\n\n/* Used to force a border model for a node */\n.cm-force-border { padding-right: .1px; }\n\n@media print {\n  /* Hide the cursor when printing */\n  .CodeMirror div.CodeMirror-cursors {\n    visibility: hidden;\n  }\n}\n\n/* See issue #2901 */\n.cm-tab-wrap-hack:after { content: ''; }\n\n/* Help users use markselection to safely style text background */\nspan.CodeMirror-selectedtext { background: none; }\n", ""]);


/***/ }),

/***/ "./node_modules/css-loader/dist/cjs.js!./node_modules/svelte-codemirror/src/CodeMirror.svelte.css":
/*!********************************************************************************************************!*\
  !*** ./node_modules/css-loader/dist/cjs.js!./node_modules/svelte-codemirror/src/CodeMirror.svelte.css ***!
  \********************************************************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

exports = module.exports = __webpack_require__(/*! ../../css-loader/dist/runtime/api.js */ "./node_modules/css-loader/dist/runtime/api.js")(false);
// Module
exports.push([module.i, "textarea.svelte-1jpkv2x{visibility:hidden}pre.svelte-1jpkv2x{position:absolute;width:100%;height:100%;top:0;left:0;border:none;padding:4px 4px 4px 60px;resize:none;font-family:var(--font-mono);font-size:13px;line-height:1.7;user-select:none;pointer-events:none;color:#ccc;tab-size:2;-moz-tab-size:2}", ""]);


/***/ }),

/***/ "./node_modules/css-loader/dist/cjs.js!./node_modules/svelte-grid/src/index.svelte.css":
/*!*********************************************************************************************!*\
  !*** ./node_modules/css-loader/dist/cjs.js!./node_modules/svelte-grid/src/index.svelte.css ***!
  \*********************************************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

exports = module.exports = __webpack_require__(/*! ../../css-loader/dist/runtime/api.js */ "./node_modules/css-loader/dist/runtime/api.js")(false);
// Module
exports.push([module.i, "body{overflow:scroll}.svlt-grid-container.svelte-14tbpr7{position:relative}.svlt-grid-item.svelte-14tbpr7{touch-action:none;position:absolute}.svlt-grid-shadow.svelte-14tbpr7{position:absolute}.svlt-grid-resizer.svelte-14tbpr7{user-select:none;width:20px;height:20px;position:absolute;right:0;bottom:0;cursor:se-resize}.svlt-grid-resizer.svelte-14tbpr7::after{content:\"\";position:absolute;right:3px;bottom:3px;width:5px;height:5px;border-right:2px solid rgba(0, 0, 0, 0.4);border-bottom:2px solid rgba(0, 0, 0, 0.4)}", ""]);


/***/ }),

/***/ "./node_modules/css-loader/dist/cjs.js!./src/UI/App.svelte.css":
/*!*********************************************************************!*\
  !*** ./node_modules/css-loader/dist/cjs.js!./src/UI/App.svelte.css ***!
  \*********************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

exports = module.exports = __webpack_require__(/*! ../../node_modules/css-loader/dist/runtime/api.js */ "./node_modules/css-loader/dist/runtime/api.js")(false);
// Module
exports.push([module.i, "#app.svelte-q7zahh{height:100vh;background:pink;overflow-y:hidden}", ""]);


/***/ }),

/***/ "./node_modules/css-loader/dist/cjs.js!./src/UI/Content.svelte.css":
/*!*************************************************************************!*\
  !*** ./node_modules/css-loader/dist/cjs.js!./src/UI/Content.svelte.css ***!
  \*************************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

exports = module.exports = __webpack_require__(/*! ../../node_modules/css-loader/dist/runtime/api.js */ "./node_modules/css-loader/dist/runtime/api.js")(false);
// Module
exports.push([module.i, ".container.svelte-145bij{height:100%;display:grid;grid-template-columns:auto 1fr;grid-template-rows:50% 50%;grid-template-areas:\"sidebar layout\"\n  \t\t\"sidebar layout\";background-color:purple}.sidebar-container.svelte-145bij{background-color:blue;margin-left:10px;grid-area:sidebar;grid-row:0 / 1;height:100%;width:auto}.layout-container.svelte-145bij{grid-area:layout;grid-row:0 / 2;height:100%}", ""]);


/***/ }),

/***/ "./node_modules/css-loader/dist/cjs.js!./src/UI/Dashboard.svelte.css":
/*!***************************************************************************!*\
  !*** ./node_modules/css-loader/dist/cjs.js!./src/UI/Dashboard.svelte.css ***!
  \***************************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

exports = module.exports = __webpack_require__(/*! ../../node_modules/css-loader/dist/runtime/api.js */ "./node_modules/css-loader/dist/runtime/api.js")(false);
// Module
exports.push([module.i, ".layout-template-container.svelte-b6qt57{height:100vh}.content.svelte-b6qt57{width:100%;height:100%;border-radius:6px;border-bottom-right-radius:3px}*{user-select:none}body{overflow:scroll;margin:0}.svlt-grid-resizer::after{border-color:white !important}.svlt-grid-transition > .svlt-grid-item{transition:transform 0.2s}.svlt-grid-shadow{background:pink;border-radius:6px;border-bottom-right-radius:3px;transition:transform 0.2s}", ""]);


/***/ }),

/***/ "./node_modules/css-loader/dist/cjs.js!./src/UI/Editor.svelte.css":
/*!************************************************************************!*\
  !*** ./node_modules/css-loader/dist/cjs.js!./src/UI/Editor.svelte.css ***!
  \************************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

exports = module.exports = __webpack_require__(/*! ../../node_modules/css-loader/dist/runtime/api.js */ "./node_modules/css-loader/dist/runtime/api.js")(false);
// Module
exports.push([module.i, ".codemirror-container.svelte-24kubc{position:relative;width:100%;height:100%;border:none;line-height:1.5;overflow:hidden}.codemirror-container.svelte-24kubc .CodeMirror{height:100%;background:transparent;font:400 14px/1.7 var(--font-mono);color:var(--base)}.codemirror-container.flex.svelte-24kubc .CodeMirror{height:auto}.codemirror-container.flex.svelte-24kubc .CodeMirror-lines{padding:0}.codemirror-container.svelte-24kubc .CodeMirror-gutters{padding:0 16px 0 8px;border:none}.codemirror-container.svelte-24kubc .error-loc{position:relative;border-bottom:2px solid #da106e}.codemirror-container.svelte-24kubc .error-line{background-color:rgba(200, 0, 0, 0.05)}.scrollable.svelte-24kubc{flex:1 1 auto;border-top:1px solid #eee;margin:0 0 0.5em 0;overflow-y:auto}", ""]);


/***/ }),

/***/ "./node_modules/css-loader/dist/cjs.js!./src/UI/Header.svelte.css":
/*!************************************************************************!*\
  !*** ./node_modules/css-loader/dist/cjs.js!./src/UI/Header.svelte.css ***!
  \************************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

exports = module.exports = __webpack_require__(/*! ../../node_modules/css-loader/dist/runtime/api.js */ "./node_modules/css-loader/dist/runtime/api.js")(false);
// Module
exports.push([module.i, "div.svelte-1qf0bqb{display:flex;flex-direction:row;width:100%;justify-content:space-between}h1.svelte-1qf0bqb{margin-top:5px;margin-left:10px;margin-bottom:0px}", ""]);


/***/ }),

/***/ "./node_modules/css-loader/dist/cjs.js!./src/UI/Layout.svelte.css":
/*!************************************************************************!*\
  !*** ./node_modules/css-loader/dist/cjs.js!./src/UI/Layout.svelte.css ***!
  \************************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

exports = module.exports = __webpack_require__(/*! ../../node_modules/css-loader/dist/runtime/api.js */ "./node_modules/css-loader/dist/runtime/api.js")(false);
// Module
exports.push([module.i, ".layout-template-container.svelte-q7j13a{height:100vh}.scrollable.svelte-q7j13a{flex:1 1 auto;border-top:1px solid #eee;margin:0 0 0.5em 0;overflow-y:auto}", ""]);


/***/ }),

/***/ "./node_modules/css-loader/dist/cjs.js!./src/UI/Nav.svelte.css":
/*!*********************************************************************!*\
  !*** ./node_modules/css-loader/dist/cjs.js!./src/UI/Nav.svelte.css ***!
  \*********************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

exports = module.exports = __webpack_require__(/*! ../../node_modules/css-loader/dist/runtime/api.js */ "./node_modules/css-loader/dist/runtime/api.js")(false);
// Module
exports.push([module.i, "ul.svelte-yvg0lp{display:flex;list-style-type:none}li.svelte-yvg0lp{margin-right:15px}", ""]);


/***/ }),

/***/ "./node_modules/css-loader/dist/cjs.js!./src/UI/Quadrants.svelte.css":
/*!***************************************************************************!*\
  !*** ./node_modules/css-loader/dist/cjs.js!./src/UI/Quadrants.svelte.css ***!
  \***************************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

exports = module.exports = __webpack_require__(/*! ../../node_modules/css-loader/dist/runtime/api.js */ "./node_modules/css-loader/dist/runtime/api.js")(false);
// Module
exports.push([module.i, ".quadrants.svelte-5bwytb{display:flex;height:100%;flex-direction:column}.top.svelte-5bwytb{display:flex;flex-direction:row;height:50%}.bottom.svelte-5bwytb{flex:1;min-width:0;overflow:hidden;display:flex;flex-direction:row;grid-row:2}.block.svelte-5bwytb{height:100%;width:50%}.block-live-code-editor.svelte-5bwytb{background-color:lightgray}.block-live-grammar-editor.svelte-5bwytb{background-color:gray;flex:1;min-width:0;overflow:hidden}.block-1.svelte-5bwytb{background-color:red}.block-2.svelte-5bwytb{background-color:green;flex:1;min-width:0;overflow:hidden}.horizontal-slider.svelte-5bwytb{line-height:100%;width:4px;background-color:#dee2e6;border:none;cursor:ew-resize;user-select:none;text-align:center}.vertical-slider.svelte-5bwytb{line-height:4px;width:100%;background-color:#dee2e6;border:none;cursor:ns-resize;user-select:none;text-align:center}.bottom-horizontal-slider.svelte-5bwytb{line-height:100%;width:4px;background-color:#dee2e6;border:none;cursor:ew-resize;user-select:none;text-align:center;justify-content:stretch}.bottom-horizontal-slider.svelte-5bwytb:hover{cursor:ew-resize}", ""]);


/***/ }),

/***/ "./node_modules/css-loader/dist/cjs.js!./src/UI/Sidebar.svelte.css":
/*!*************************************************************************!*\
  !*** ./node_modules/css-loader/dist/cjs.js!./src/UI/Sidebar.svelte.css ***!
  \*************************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

exports = module.exports = __webpack_require__(/*! ../../node_modules/css-loader/dist/runtime/api.js */ "./node_modules/css-loader/dist/runtime/api.js")(false);
// Module
exports.push([module.i, ".sidebar.svelte-92lzuu{background-color:yellow;width:140px;height:100%}", ""]);


/***/ }),

/***/ "./node_modules/css-loader/dist/runtime/api.js":
/*!*****************************************************!*\
  !*** ./node_modules/css-loader/dist/runtime/api.js ***!
  \*****************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


/*
  MIT License http://www.opensource.org/licenses/mit-license.php
  Author Tobias Koppers @sokra
*/
// css base code, injected by the css-loader
// eslint-disable-next-line func-names
module.exports = function (useSourceMap) {
  var list = []; // return the list of modules as css string

  list.toString = function toString() {
    return this.map(function (item) {
      var content = cssWithMappingToString(item, useSourceMap);

      if (item[2]) {
        return "@media ".concat(item[2], "{").concat(content, "}");
      }

      return content;
    }).join('');
  }; // import a list of modules into the list
  // eslint-disable-next-line func-names


  list.i = function (modules, mediaQuery) {
    if (typeof modules === 'string') {
      // eslint-disable-next-line no-param-reassign
      modules = [[null, modules, '']];
    }

    var alreadyImportedModules = {};

    for (var i = 0; i < this.length; i++) {
      // eslint-disable-next-line prefer-destructuring
      var id = this[i][0];

      if (id != null) {
        alreadyImportedModules[id] = true;
      }
    }

    for (var _i = 0; _i < modules.length; _i++) {
      var item = modules[_i]; // skip already imported module
      // this implementation is not 100% perfect for weird media query combinations
      // when a module is imported multiple times with different media queries.
      // I hope this will never occur (Hey this way we have smaller bundles)

      if (item[0] == null || !alreadyImportedModules[item[0]]) {
        if (mediaQuery && !item[2]) {
          item[2] = mediaQuery;
        } else if (mediaQuery) {
          item[2] = "(".concat(item[2], ") and (").concat(mediaQuery, ")");
        }

        list.push(item);
      }
    }
  };

  return list;
};

function cssWithMappingToString(item, useSourceMap) {
  var content = item[1] || ''; // eslint-disable-next-line prefer-destructuring

  var cssMapping = item[3];

  if (!cssMapping) {
    return content;
  }

  if (useSourceMap && typeof btoa === 'function') {
    var sourceMapping = toComment(cssMapping);
    var sourceURLs = cssMapping.sources.map(function (source) {
      return "/*# sourceURL=".concat(cssMapping.sourceRoot).concat(source, " */");
    });
    return [content].concat(sourceURLs).concat([sourceMapping]).join('\n');
  }

  return [content].join('\n');
} // Adapted from convert-source-map (MIT)


function toComment(sourceMap) {
  // eslint-disable-next-line no-undef
  var base64 = btoa(unescape(encodeURIComponent(JSON.stringify(sourceMap))));
  var data = "sourceMappingURL=data:application/json;charset=utf-8;base64,".concat(base64);
  return "/*# ".concat(data, " */");
}

/***/ }),

/***/ "./node_modules/lodash.map/index.js":
/*!******************************************!*\
  !*** ./node_modules/lodash.map/index.js ***!
  \******************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

/* WEBPACK VAR INJECTION */(function(global, module) {/**
 * lodash (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright jQuery Foundation and other contributors <https://jquery.org/>
 * Released under MIT license <https://lodash.com/license>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 */

/** Used as the size to enable large array optimizations. */
var LARGE_ARRAY_SIZE = 200;

/** Used as the `TypeError` message for "Functions" methods. */
var FUNC_ERROR_TEXT = 'Expected a function';

/** Used to stand-in for `undefined` hash values. */
var HASH_UNDEFINED = '__lodash_hash_undefined__';

/** Used to compose bitmasks for comparison styles. */
var UNORDERED_COMPARE_FLAG = 1,
    PARTIAL_COMPARE_FLAG = 2;

/** Used as references for various `Number` constants. */
var INFINITY = 1 / 0,
    MAX_SAFE_INTEGER = 9007199254740991;

/** `Object#toString` result references. */
var argsTag = '[object Arguments]',
    arrayTag = '[object Array]',
    boolTag = '[object Boolean]',
    dateTag = '[object Date]',
    errorTag = '[object Error]',
    funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]',
    mapTag = '[object Map]',
    numberTag = '[object Number]',
    objectTag = '[object Object]',
    promiseTag = '[object Promise]',
    regexpTag = '[object RegExp]',
    setTag = '[object Set]',
    stringTag = '[object String]',
    symbolTag = '[object Symbol]',
    weakMapTag = '[object WeakMap]';

var arrayBufferTag = '[object ArrayBuffer]',
    dataViewTag = '[object DataView]',
    float32Tag = '[object Float32Array]',
    float64Tag = '[object Float64Array]',
    int8Tag = '[object Int8Array]',
    int16Tag = '[object Int16Array]',
    int32Tag = '[object Int32Array]',
    uint8Tag = '[object Uint8Array]',
    uint8ClampedTag = '[object Uint8ClampedArray]',
    uint16Tag = '[object Uint16Array]',
    uint32Tag = '[object Uint32Array]';

/** Used to match property names within property paths. */
var reIsDeepProp = /\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\\]|\\.)*?\1)\]/,
    reIsPlainProp = /^\w*$/,
    reLeadingDot = /^\./,
    rePropName = /[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|$))/g;

/**
 * Used to match `RegExp`
 * [syntax characters](http://ecma-international.org/ecma-262/7.0/#sec-patterns).
 */
var reRegExpChar = /[\\^$.*+?()[\]{}|]/g;

/** Used to match backslashes in property paths. */
var reEscapeChar = /\\(\\)?/g;

/** Used to detect host constructors (Safari). */
var reIsHostCtor = /^\[object .+?Constructor\]$/;

/** Used to detect unsigned integer values. */
var reIsUint = /^(?:0|[1-9]\d*)$/;

/** Used to identify `toStringTag` values of typed arrays. */
var typedArrayTags = {};
typedArrayTags[float32Tag] = typedArrayTags[float64Tag] =
typedArrayTags[int8Tag] = typedArrayTags[int16Tag] =
typedArrayTags[int32Tag] = typedArrayTags[uint8Tag] =
typedArrayTags[uint8ClampedTag] = typedArrayTags[uint16Tag] =
typedArrayTags[uint32Tag] = true;
typedArrayTags[argsTag] = typedArrayTags[arrayTag] =
typedArrayTags[arrayBufferTag] = typedArrayTags[boolTag] =
typedArrayTags[dataViewTag] = typedArrayTags[dateTag] =
typedArrayTags[errorTag] = typedArrayTags[funcTag] =
typedArrayTags[mapTag] = typedArrayTags[numberTag] =
typedArrayTags[objectTag] = typedArrayTags[regexpTag] =
typedArrayTags[setTag] = typedArrayTags[stringTag] =
typedArrayTags[weakMapTag] = false;

/** Detect free variable `global` from Node.js. */
var freeGlobal = typeof global == 'object' && global && global.Object === Object && global;

/** Detect free variable `self`. */
var freeSelf = typeof self == 'object' && self && self.Object === Object && self;

/** Used as a reference to the global object. */
var root = freeGlobal || freeSelf || Function('return this')();

/** Detect free variable `exports`. */
var freeExports =  true && exports && !exports.nodeType && exports;

/** Detect free variable `module`. */
var freeModule = freeExports && typeof module == 'object' && module && !module.nodeType && module;

/** Detect the popular CommonJS extension `module.exports`. */
var moduleExports = freeModule && freeModule.exports === freeExports;

/** Detect free variable `process` from Node.js. */
var freeProcess = moduleExports && freeGlobal.process;

/** Used to access faster Node.js helpers. */
var nodeUtil = (function() {
  try {
    return freeProcess && freeProcess.binding('util');
  } catch (e) {}
}());

/* Node.js helper references. */
var nodeIsTypedArray = nodeUtil && nodeUtil.isTypedArray;

/**
 * A specialized version of `_.map` for arrays without support for iteratee
 * shorthands.
 *
 * @private
 * @param {Array} [array] The array to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns the new mapped array.
 */
function arrayMap(array, iteratee) {
  var index = -1,
      length = array ? array.length : 0,
      result = Array(length);

  while (++index < length) {
    result[index] = iteratee(array[index], index, array);
  }
  return result;
}

/**
 * A specialized version of `_.some` for arrays without support for iteratee
 * shorthands.
 *
 * @private
 * @param {Array} [array] The array to iterate over.
 * @param {Function} predicate The function invoked per iteration.
 * @returns {boolean} Returns `true` if any element passes the predicate check,
 *  else `false`.
 */
function arraySome(array, predicate) {
  var index = -1,
      length = array ? array.length : 0;

  while (++index < length) {
    if (predicate(array[index], index, array)) {
      return true;
    }
  }
  return false;
}

/**
 * The base implementation of `_.property` without support for deep paths.
 *
 * @private
 * @param {string} key The key of the property to get.
 * @returns {Function} Returns the new accessor function.
 */
function baseProperty(key) {
  return function(object) {
    return object == null ? undefined : object[key];
  };
}

/**
 * The base implementation of `_.times` without support for iteratee shorthands
 * or max array length checks.
 *
 * @private
 * @param {number} n The number of times to invoke `iteratee`.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns the array of results.
 */
function baseTimes(n, iteratee) {
  var index = -1,
      result = Array(n);

  while (++index < n) {
    result[index] = iteratee(index);
  }
  return result;
}

/**
 * The base implementation of `_.unary` without support for storing metadata.
 *
 * @private
 * @param {Function} func The function to cap arguments for.
 * @returns {Function} Returns the new capped function.
 */
function baseUnary(func) {
  return function(value) {
    return func(value);
  };
}

/**
 * Gets the value at `key` of `object`.
 *
 * @private
 * @param {Object} [object] The object to query.
 * @param {string} key The key of the property to get.
 * @returns {*} Returns the property value.
 */
function getValue(object, key) {
  return object == null ? undefined : object[key];
}

/**
 * Checks if `value` is a host object in IE < 9.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a host object, else `false`.
 */
function isHostObject(value) {
  // Many host objects are `Object` objects that can coerce to strings
  // despite having improperly defined `toString` methods.
  var result = false;
  if (value != null && typeof value.toString != 'function') {
    try {
      result = !!(value + '');
    } catch (e) {}
  }
  return result;
}

/**
 * Converts `map` to its key-value pairs.
 *
 * @private
 * @param {Object} map The map to convert.
 * @returns {Array} Returns the key-value pairs.
 */
function mapToArray(map) {
  var index = -1,
      result = Array(map.size);

  map.forEach(function(value, key) {
    result[++index] = [key, value];
  });
  return result;
}

/**
 * Creates a unary function that invokes `func` with its argument transformed.
 *
 * @private
 * @param {Function} func The function to wrap.
 * @param {Function} transform The argument transform.
 * @returns {Function} Returns the new function.
 */
function overArg(func, transform) {
  return function(arg) {
    return func(transform(arg));
  };
}

/**
 * Converts `set` to an array of its values.
 *
 * @private
 * @param {Object} set The set to convert.
 * @returns {Array} Returns the values.
 */
function setToArray(set) {
  var index = -1,
      result = Array(set.size);

  set.forEach(function(value) {
    result[++index] = value;
  });
  return result;
}

/** Used for built-in method references. */
var arrayProto = Array.prototype,
    funcProto = Function.prototype,
    objectProto = Object.prototype;

/** Used to detect overreaching core-js shims. */
var coreJsData = root['__core-js_shared__'];

/** Used to detect methods masquerading as native. */
var maskSrcKey = (function() {
  var uid = /[^.]+$/.exec(coreJsData && coreJsData.keys && coreJsData.keys.IE_PROTO || '');
  return uid ? ('Symbol(src)_1.' + uid) : '';
}());

/** Used to resolve the decompiled source of functions. */
var funcToString = funcProto.toString;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/** Used to detect if a method is native. */
var reIsNative = RegExp('^' +
  funcToString.call(hasOwnProperty).replace(reRegExpChar, '\\$&')
  .replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$'
);

/** Built-in value references. */
var Symbol = root.Symbol,
    Uint8Array = root.Uint8Array,
    propertyIsEnumerable = objectProto.propertyIsEnumerable,
    splice = arrayProto.splice;

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeKeys = overArg(Object.keys, Object);

/* Built-in method references that are verified to be native. */
var DataView = getNative(root, 'DataView'),
    Map = getNative(root, 'Map'),
    Promise = getNative(root, 'Promise'),
    Set = getNative(root, 'Set'),
    WeakMap = getNative(root, 'WeakMap'),
    nativeCreate = getNative(Object, 'create');

/** Used to detect maps, sets, and weakmaps. */
var dataViewCtorString = toSource(DataView),
    mapCtorString = toSource(Map),
    promiseCtorString = toSource(Promise),
    setCtorString = toSource(Set),
    weakMapCtorString = toSource(WeakMap);

/** Used to convert symbols to primitives and strings. */
var symbolProto = Symbol ? Symbol.prototype : undefined,
    symbolValueOf = symbolProto ? symbolProto.valueOf : undefined,
    symbolToString = symbolProto ? symbolProto.toString : undefined;

/**
 * Creates a hash object.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */
function Hash(entries) {
  var index = -1,
      length = entries ? entries.length : 0;

  this.clear();
  while (++index < length) {
    var entry = entries[index];
    this.set(entry[0], entry[1]);
  }
}

/**
 * Removes all key-value entries from the hash.
 *
 * @private
 * @name clear
 * @memberOf Hash
 */
function hashClear() {
  this.__data__ = nativeCreate ? nativeCreate(null) : {};
}

/**
 * Removes `key` and its value from the hash.
 *
 * @private
 * @name delete
 * @memberOf Hash
 * @param {Object} hash The hash to modify.
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function hashDelete(key) {
  return this.has(key) && delete this.__data__[key];
}

/**
 * Gets the hash value for `key`.
 *
 * @private
 * @name get
 * @memberOf Hash
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function hashGet(key) {
  var data = this.__data__;
  if (nativeCreate) {
    var result = data[key];
    return result === HASH_UNDEFINED ? undefined : result;
  }
  return hasOwnProperty.call(data, key) ? data[key] : undefined;
}

/**
 * Checks if a hash value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf Hash
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function hashHas(key) {
  var data = this.__data__;
  return nativeCreate ? data[key] !== undefined : hasOwnProperty.call(data, key);
}

/**
 * Sets the hash `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf Hash
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the hash instance.
 */
function hashSet(key, value) {
  var data = this.__data__;
  data[key] = (nativeCreate && value === undefined) ? HASH_UNDEFINED : value;
  return this;
}

// Add methods to `Hash`.
Hash.prototype.clear = hashClear;
Hash.prototype['delete'] = hashDelete;
Hash.prototype.get = hashGet;
Hash.prototype.has = hashHas;
Hash.prototype.set = hashSet;

/**
 * Creates an list cache object.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */
function ListCache(entries) {
  var index = -1,
      length = entries ? entries.length : 0;

  this.clear();
  while (++index < length) {
    var entry = entries[index];
    this.set(entry[0], entry[1]);
  }
}

/**
 * Removes all key-value entries from the list cache.
 *
 * @private
 * @name clear
 * @memberOf ListCache
 */
function listCacheClear() {
  this.__data__ = [];
}

/**
 * Removes `key` and its value from the list cache.
 *
 * @private
 * @name delete
 * @memberOf ListCache
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function listCacheDelete(key) {
  var data = this.__data__,
      index = assocIndexOf(data, key);

  if (index < 0) {
    return false;
  }
  var lastIndex = data.length - 1;
  if (index == lastIndex) {
    data.pop();
  } else {
    splice.call(data, index, 1);
  }
  return true;
}

/**
 * Gets the list cache value for `key`.
 *
 * @private
 * @name get
 * @memberOf ListCache
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function listCacheGet(key) {
  var data = this.__data__,
      index = assocIndexOf(data, key);

  return index < 0 ? undefined : data[index][1];
}

/**
 * Checks if a list cache value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf ListCache
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function listCacheHas(key) {
  return assocIndexOf(this.__data__, key) > -1;
}

/**
 * Sets the list cache `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf ListCache
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the list cache instance.
 */
function listCacheSet(key, value) {
  var data = this.__data__,
      index = assocIndexOf(data, key);

  if (index < 0) {
    data.push([key, value]);
  } else {
    data[index][1] = value;
  }
  return this;
}

// Add methods to `ListCache`.
ListCache.prototype.clear = listCacheClear;
ListCache.prototype['delete'] = listCacheDelete;
ListCache.prototype.get = listCacheGet;
ListCache.prototype.has = listCacheHas;
ListCache.prototype.set = listCacheSet;

/**
 * Creates a map cache object to store key-value pairs.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */
function MapCache(entries) {
  var index = -1,
      length = entries ? entries.length : 0;

  this.clear();
  while (++index < length) {
    var entry = entries[index];
    this.set(entry[0], entry[1]);
  }
}

/**
 * Removes all key-value entries from the map.
 *
 * @private
 * @name clear
 * @memberOf MapCache
 */
function mapCacheClear() {
  this.__data__ = {
    'hash': new Hash,
    'map': new (Map || ListCache),
    'string': new Hash
  };
}

/**
 * Removes `key` and its value from the map.
 *
 * @private
 * @name delete
 * @memberOf MapCache
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function mapCacheDelete(key) {
  return getMapData(this, key)['delete'](key);
}

/**
 * Gets the map value for `key`.
 *
 * @private
 * @name get
 * @memberOf MapCache
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function mapCacheGet(key) {
  return getMapData(this, key).get(key);
}

/**
 * Checks if a map value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf MapCache
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function mapCacheHas(key) {
  return getMapData(this, key).has(key);
}

/**
 * Sets the map `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf MapCache
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the map cache instance.
 */
function mapCacheSet(key, value) {
  getMapData(this, key).set(key, value);
  return this;
}

// Add methods to `MapCache`.
MapCache.prototype.clear = mapCacheClear;
MapCache.prototype['delete'] = mapCacheDelete;
MapCache.prototype.get = mapCacheGet;
MapCache.prototype.has = mapCacheHas;
MapCache.prototype.set = mapCacheSet;

/**
 *
 * Creates an array cache object to store unique values.
 *
 * @private
 * @constructor
 * @param {Array} [values] The values to cache.
 */
function SetCache(values) {
  var index = -1,
      length = values ? values.length : 0;

  this.__data__ = new MapCache;
  while (++index < length) {
    this.add(values[index]);
  }
}

/**
 * Adds `value` to the array cache.
 *
 * @private
 * @name add
 * @memberOf SetCache
 * @alias push
 * @param {*} value The value to cache.
 * @returns {Object} Returns the cache instance.
 */
function setCacheAdd(value) {
  this.__data__.set(value, HASH_UNDEFINED);
  return this;
}

/**
 * Checks if `value` is in the array cache.
 *
 * @private
 * @name has
 * @memberOf SetCache
 * @param {*} value The value to search for.
 * @returns {number} Returns `true` if `value` is found, else `false`.
 */
function setCacheHas(value) {
  return this.__data__.has(value);
}

// Add methods to `SetCache`.
SetCache.prototype.add = SetCache.prototype.push = setCacheAdd;
SetCache.prototype.has = setCacheHas;

/**
 * Creates a stack cache object to store key-value pairs.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */
function Stack(entries) {
  this.__data__ = new ListCache(entries);
}

/**
 * Removes all key-value entries from the stack.
 *
 * @private
 * @name clear
 * @memberOf Stack
 */
function stackClear() {
  this.__data__ = new ListCache;
}

/**
 * Removes `key` and its value from the stack.
 *
 * @private
 * @name delete
 * @memberOf Stack
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function stackDelete(key) {
  return this.__data__['delete'](key);
}

/**
 * Gets the stack value for `key`.
 *
 * @private
 * @name get
 * @memberOf Stack
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function stackGet(key) {
  return this.__data__.get(key);
}

/**
 * Checks if a stack value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf Stack
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function stackHas(key) {
  return this.__data__.has(key);
}

/**
 * Sets the stack `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf Stack
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the stack cache instance.
 */
function stackSet(key, value) {
  var cache = this.__data__;
  if (cache instanceof ListCache) {
    var pairs = cache.__data__;
    if (!Map || (pairs.length < LARGE_ARRAY_SIZE - 1)) {
      pairs.push([key, value]);
      return this;
    }
    cache = this.__data__ = new MapCache(pairs);
  }
  cache.set(key, value);
  return this;
}

// Add methods to `Stack`.
Stack.prototype.clear = stackClear;
Stack.prototype['delete'] = stackDelete;
Stack.prototype.get = stackGet;
Stack.prototype.has = stackHas;
Stack.prototype.set = stackSet;

/**
 * Creates an array of the enumerable property names of the array-like `value`.
 *
 * @private
 * @param {*} value The value to query.
 * @param {boolean} inherited Specify returning inherited property names.
 * @returns {Array} Returns the array of property names.
 */
function arrayLikeKeys(value, inherited) {
  // Safari 8.1 makes `arguments.callee` enumerable in strict mode.
  // Safari 9 makes `arguments.length` enumerable in strict mode.
  var result = (isArray(value) || isArguments(value))
    ? baseTimes(value.length, String)
    : [];

  var length = result.length,
      skipIndexes = !!length;

  for (var key in value) {
    if ((inherited || hasOwnProperty.call(value, key)) &&
        !(skipIndexes && (key == 'length' || isIndex(key, length)))) {
      result.push(key);
    }
  }
  return result;
}

/**
 * Gets the index at which the `key` is found in `array` of key-value pairs.
 *
 * @private
 * @param {Array} array The array to inspect.
 * @param {*} key The key to search for.
 * @returns {number} Returns the index of the matched value, else `-1`.
 */
function assocIndexOf(array, key) {
  var length = array.length;
  while (length--) {
    if (eq(array[length][0], key)) {
      return length;
    }
  }
  return -1;
}

/**
 * The base implementation of `_.forEach` without support for iteratee shorthands.
 *
 * @private
 * @param {Array|Object} collection The collection to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array|Object} Returns `collection`.
 */
var baseEach = createBaseEach(baseForOwn);

/**
 * The base implementation of `baseForOwn` which iterates over `object`
 * properties returned by `keysFunc` and invokes `iteratee` for each property.
 * Iteratee functions may exit iteration early by explicitly returning `false`.
 *
 * @private
 * @param {Object} object The object to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @param {Function} keysFunc The function to get the keys of `object`.
 * @returns {Object} Returns `object`.
 */
var baseFor = createBaseFor();

/**
 * The base implementation of `_.forOwn` without support for iteratee shorthands.
 *
 * @private
 * @param {Object} object The object to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Object} Returns `object`.
 */
function baseForOwn(object, iteratee) {
  return object && baseFor(object, iteratee, keys);
}

/**
 * The base implementation of `_.get` without support for default values.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {Array|string} path The path of the property to get.
 * @returns {*} Returns the resolved value.
 */
function baseGet(object, path) {
  path = isKey(path, object) ? [path] : castPath(path);

  var index = 0,
      length = path.length;

  while (object != null && index < length) {
    object = object[toKey(path[index++])];
  }
  return (index && index == length) ? object : undefined;
}

/**
 * The base implementation of `getTag`.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the `toStringTag`.
 */
function baseGetTag(value) {
  return objectToString.call(value);
}

/**
 * The base implementation of `_.hasIn` without support for deep paths.
 *
 * @private
 * @param {Object} [object] The object to query.
 * @param {Array|string} key The key to check.
 * @returns {boolean} Returns `true` if `key` exists, else `false`.
 */
function baseHasIn(object, key) {
  return object != null && key in Object(object);
}

/**
 * The base implementation of `_.isEqual` which supports partial comparisons
 * and tracks traversed objects.
 *
 * @private
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @param {Function} [customizer] The function to customize comparisons.
 * @param {boolean} [bitmask] The bitmask of comparison flags.
 *  The bitmask may be composed of the following flags:
 *     1 - Unordered comparison
 *     2 - Partial comparison
 * @param {Object} [stack] Tracks traversed `value` and `other` objects.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 */
function baseIsEqual(value, other, customizer, bitmask, stack) {
  if (value === other) {
    return true;
  }
  if (value == null || other == null || (!isObject(value) && !isObjectLike(other))) {
    return value !== value && other !== other;
  }
  return baseIsEqualDeep(value, other, baseIsEqual, customizer, bitmask, stack);
}

/**
 * A specialized version of `baseIsEqual` for arrays and objects which performs
 * deep comparisons and tracks traversed objects enabling objects with circular
 * references to be compared.
 *
 * @private
 * @param {Object} object The object to compare.
 * @param {Object} other The other object to compare.
 * @param {Function} equalFunc The function to determine equivalents of values.
 * @param {Function} [customizer] The function to customize comparisons.
 * @param {number} [bitmask] The bitmask of comparison flags. See `baseIsEqual`
 *  for more details.
 * @param {Object} [stack] Tracks traversed `object` and `other` objects.
 * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
 */
function baseIsEqualDeep(object, other, equalFunc, customizer, bitmask, stack) {
  var objIsArr = isArray(object),
      othIsArr = isArray(other),
      objTag = arrayTag,
      othTag = arrayTag;

  if (!objIsArr) {
    objTag = getTag(object);
    objTag = objTag == argsTag ? objectTag : objTag;
  }
  if (!othIsArr) {
    othTag = getTag(other);
    othTag = othTag == argsTag ? objectTag : othTag;
  }
  var objIsObj = objTag == objectTag && !isHostObject(object),
      othIsObj = othTag == objectTag && !isHostObject(other),
      isSameTag = objTag == othTag;

  if (isSameTag && !objIsObj) {
    stack || (stack = new Stack);
    return (objIsArr || isTypedArray(object))
      ? equalArrays(object, other, equalFunc, customizer, bitmask, stack)
      : equalByTag(object, other, objTag, equalFunc, customizer, bitmask, stack);
  }
  if (!(bitmask & PARTIAL_COMPARE_FLAG)) {
    var objIsWrapped = objIsObj && hasOwnProperty.call(object, '__wrapped__'),
        othIsWrapped = othIsObj && hasOwnProperty.call(other, '__wrapped__');

    if (objIsWrapped || othIsWrapped) {
      var objUnwrapped = objIsWrapped ? object.value() : object,
          othUnwrapped = othIsWrapped ? other.value() : other;

      stack || (stack = new Stack);
      return equalFunc(objUnwrapped, othUnwrapped, customizer, bitmask, stack);
    }
  }
  if (!isSameTag) {
    return false;
  }
  stack || (stack = new Stack);
  return equalObjects(object, other, equalFunc, customizer, bitmask, stack);
}

/**
 * The base implementation of `_.isMatch` without support for iteratee shorthands.
 *
 * @private
 * @param {Object} object The object to inspect.
 * @param {Object} source The object of property values to match.
 * @param {Array} matchData The property names, values, and compare flags to match.
 * @param {Function} [customizer] The function to customize comparisons.
 * @returns {boolean} Returns `true` if `object` is a match, else `false`.
 */
function baseIsMatch(object, source, matchData, customizer) {
  var index = matchData.length,
      length = index,
      noCustomizer = !customizer;

  if (object == null) {
    return !length;
  }
  object = Object(object);
  while (index--) {
    var data = matchData[index];
    if ((noCustomizer && data[2])
          ? data[1] !== object[data[0]]
          : !(data[0] in object)
        ) {
      return false;
    }
  }
  while (++index < length) {
    data = matchData[index];
    var key = data[0],
        objValue = object[key],
        srcValue = data[1];

    if (noCustomizer && data[2]) {
      if (objValue === undefined && !(key in object)) {
        return false;
      }
    } else {
      var stack = new Stack;
      if (customizer) {
        var result = customizer(objValue, srcValue, key, object, source, stack);
      }
      if (!(result === undefined
            ? baseIsEqual(srcValue, objValue, customizer, UNORDERED_COMPARE_FLAG | PARTIAL_COMPARE_FLAG, stack)
            : result
          )) {
        return false;
      }
    }
  }
  return true;
}

/**
 * The base implementation of `_.isNative` without bad shim checks.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a native function,
 *  else `false`.
 */
function baseIsNative(value) {
  if (!isObject(value) || isMasked(value)) {
    return false;
  }
  var pattern = (isFunction(value) || isHostObject(value)) ? reIsNative : reIsHostCtor;
  return pattern.test(toSource(value));
}

/**
 * The base implementation of `_.isTypedArray` without Node.js optimizations.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a typed array, else `false`.
 */
function baseIsTypedArray(value) {
  return isObjectLike(value) &&
    isLength(value.length) && !!typedArrayTags[objectToString.call(value)];
}

/**
 * The base implementation of `_.iteratee`.
 *
 * @private
 * @param {*} [value=_.identity] The value to convert to an iteratee.
 * @returns {Function} Returns the iteratee.
 */
function baseIteratee(value) {
  // Don't store the `typeof` result in a variable to avoid a JIT bug in Safari 9.
  // See https://bugs.webkit.org/show_bug.cgi?id=156034 for more details.
  if (typeof value == 'function') {
    return value;
  }
  if (value == null) {
    return identity;
  }
  if (typeof value == 'object') {
    return isArray(value)
      ? baseMatchesProperty(value[0], value[1])
      : baseMatches(value);
  }
  return property(value);
}

/**
 * The base implementation of `_.keys` which doesn't treat sparse arrays as dense.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 */
function baseKeys(object) {
  if (!isPrototype(object)) {
    return nativeKeys(object);
  }
  var result = [];
  for (var key in Object(object)) {
    if (hasOwnProperty.call(object, key) && key != 'constructor') {
      result.push(key);
    }
  }
  return result;
}

/**
 * The base implementation of `_.map` without support for iteratee shorthands.
 *
 * @private
 * @param {Array|Object} collection The collection to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns the new mapped array.
 */
function baseMap(collection, iteratee) {
  var index = -1,
      result = isArrayLike(collection) ? Array(collection.length) : [];

  baseEach(collection, function(value, key, collection) {
    result[++index] = iteratee(value, key, collection);
  });
  return result;
}

/**
 * The base implementation of `_.matches` which doesn't clone `source`.
 *
 * @private
 * @param {Object} source The object of property values to match.
 * @returns {Function} Returns the new spec function.
 */
function baseMatches(source) {
  var matchData = getMatchData(source);
  if (matchData.length == 1 && matchData[0][2]) {
    return matchesStrictComparable(matchData[0][0], matchData[0][1]);
  }
  return function(object) {
    return object === source || baseIsMatch(object, source, matchData);
  };
}

/**
 * The base implementation of `_.matchesProperty` which doesn't clone `srcValue`.
 *
 * @private
 * @param {string} path The path of the property to get.
 * @param {*} srcValue The value to match.
 * @returns {Function} Returns the new spec function.
 */
function baseMatchesProperty(path, srcValue) {
  if (isKey(path) && isStrictComparable(srcValue)) {
    return matchesStrictComparable(toKey(path), srcValue);
  }
  return function(object) {
    var objValue = get(object, path);
    return (objValue === undefined && objValue === srcValue)
      ? hasIn(object, path)
      : baseIsEqual(srcValue, objValue, undefined, UNORDERED_COMPARE_FLAG | PARTIAL_COMPARE_FLAG);
  };
}

/**
 * A specialized version of `baseProperty` which supports deep paths.
 *
 * @private
 * @param {Array|string} path The path of the property to get.
 * @returns {Function} Returns the new accessor function.
 */
function basePropertyDeep(path) {
  return function(object) {
    return baseGet(object, path);
  };
}

/**
 * The base implementation of `_.toString` which doesn't convert nullish
 * values to empty strings.
 *
 * @private
 * @param {*} value The value to process.
 * @returns {string} Returns the string.
 */
function baseToString(value) {
  // Exit early for strings to avoid a performance hit in some environments.
  if (typeof value == 'string') {
    return value;
  }
  if (isSymbol(value)) {
    return symbolToString ? symbolToString.call(value) : '';
  }
  var result = (value + '');
  return (result == '0' && (1 / value) == -INFINITY) ? '-0' : result;
}

/**
 * Casts `value` to a path array if it's not one.
 *
 * @private
 * @param {*} value The value to inspect.
 * @returns {Array} Returns the cast property path array.
 */
function castPath(value) {
  return isArray(value) ? value : stringToPath(value);
}

/**
 * Creates a `baseEach` or `baseEachRight` function.
 *
 * @private
 * @param {Function} eachFunc The function to iterate over a collection.
 * @param {boolean} [fromRight] Specify iterating from right to left.
 * @returns {Function} Returns the new base function.
 */
function createBaseEach(eachFunc, fromRight) {
  return function(collection, iteratee) {
    if (collection == null) {
      return collection;
    }
    if (!isArrayLike(collection)) {
      return eachFunc(collection, iteratee);
    }
    var length = collection.length,
        index = fromRight ? length : -1,
        iterable = Object(collection);

    while ((fromRight ? index-- : ++index < length)) {
      if (iteratee(iterable[index], index, iterable) === false) {
        break;
      }
    }
    return collection;
  };
}

/**
 * Creates a base function for methods like `_.forIn` and `_.forOwn`.
 *
 * @private
 * @param {boolean} [fromRight] Specify iterating from right to left.
 * @returns {Function} Returns the new base function.
 */
function createBaseFor(fromRight) {
  return function(object, iteratee, keysFunc) {
    var index = -1,
        iterable = Object(object),
        props = keysFunc(object),
        length = props.length;

    while (length--) {
      var key = props[fromRight ? length : ++index];
      if (iteratee(iterable[key], key, iterable) === false) {
        break;
      }
    }
    return object;
  };
}

/**
 * A specialized version of `baseIsEqualDeep` for arrays with support for
 * partial deep comparisons.
 *
 * @private
 * @param {Array} array The array to compare.
 * @param {Array} other The other array to compare.
 * @param {Function} equalFunc The function to determine equivalents of values.
 * @param {Function} customizer The function to customize comparisons.
 * @param {number} bitmask The bitmask of comparison flags. See `baseIsEqual`
 *  for more details.
 * @param {Object} stack Tracks traversed `array` and `other` objects.
 * @returns {boolean} Returns `true` if the arrays are equivalent, else `false`.
 */
function equalArrays(array, other, equalFunc, customizer, bitmask, stack) {
  var isPartial = bitmask & PARTIAL_COMPARE_FLAG,
      arrLength = array.length,
      othLength = other.length;

  if (arrLength != othLength && !(isPartial && othLength > arrLength)) {
    return false;
  }
  // Assume cyclic values are equal.
  var stacked = stack.get(array);
  if (stacked && stack.get(other)) {
    return stacked == other;
  }
  var index = -1,
      result = true,
      seen = (bitmask & UNORDERED_COMPARE_FLAG) ? new SetCache : undefined;

  stack.set(array, other);
  stack.set(other, array);

  // Ignore non-index properties.
  while (++index < arrLength) {
    var arrValue = array[index],
        othValue = other[index];

    if (customizer) {
      var compared = isPartial
        ? customizer(othValue, arrValue, index, other, array, stack)
        : customizer(arrValue, othValue, index, array, other, stack);
    }
    if (compared !== undefined) {
      if (compared) {
        continue;
      }
      result = false;
      break;
    }
    // Recursively compare arrays (susceptible to call stack limits).
    if (seen) {
      if (!arraySome(other, function(othValue, othIndex) {
            if (!seen.has(othIndex) &&
                (arrValue === othValue || equalFunc(arrValue, othValue, customizer, bitmask, stack))) {
              return seen.add(othIndex);
            }
          })) {
        result = false;
        break;
      }
    } else if (!(
          arrValue === othValue ||
            equalFunc(arrValue, othValue, customizer, bitmask, stack)
        )) {
      result = false;
      break;
    }
  }
  stack['delete'](array);
  stack['delete'](other);
  return result;
}

/**
 * A specialized version of `baseIsEqualDeep` for comparing objects of
 * the same `toStringTag`.
 *
 * **Note:** This function only supports comparing values with tags of
 * `Boolean`, `Date`, `Error`, `Number`, `RegExp`, or `String`.
 *
 * @private
 * @param {Object} object The object to compare.
 * @param {Object} other The other object to compare.
 * @param {string} tag The `toStringTag` of the objects to compare.
 * @param {Function} equalFunc The function to determine equivalents of values.
 * @param {Function} customizer The function to customize comparisons.
 * @param {number} bitmask The bitmask of comparison flags. See `baseIsEqual`
 *  for more details.
 * @param {Object} stack Tracks traversed `object` and `other` objects.
 * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
 */
function equalByTag(object, other, tag, equalFunc, customizer, bitmask, stack) {
  switch (tag) {
    case dataViewTag:
      if ((object.byteLength != other.byteLength) ||
          (object.byteOffset != other.byteOffset)) {
        return false;
      }
      object = object.buffer;
      other = other.buffer;

    case arrayBufferTag:
      if ((object.byteLength != other.byteLength) ||
          !equalFunc(new Uint8Array(object), new Uint8Array(other))) {
        return false;
      }
      return true;

    case boolTag:
    case dateTag:
    case numberTag:
      // Coerce booleans to `1` or `0` and dates to milliseconds.
      // Invalid dates are coerced to `NaN`.
      return eq(+object, +other);

    case errorTag:
      return object.name == other.name && object.message == other.message;

    case regexpTag:
    case stringTag:
      // Coerce regexes to strings and treat strings, primitives and objects,
      // as equal. See http://www.ecma-international.org/ecma-262/7.0/#sec-regexp.prototype.tostring
      // for more details.
      return object == (other + '');

    case mapTag:
      var convert = mapToArray;

    case setTag:
      var isPartial = bitmask & PARTIAL_COMPARE_FLAG;
      convert || (convert = setToArray);

      if (object.size != other.size && !isPartial) {
        return false;
      }
      // Assume cyclic values are equal.
      var stacked = stack.get(object);
      if (stacked) {
        return stacked == other;
      }
      bitmask |= UNORDERED_COMPARE_FLAG;

      // Recursively compare objects (susceptible to call stack limits).
      stack.set(object, other);
      var result = equalArrays(convert(object), convert(other), equalFunc, customizer, bitmask, stack);
      stack['delete'](object);
      return result;

    case symbolTag:
      if (symbolValueOf) {
        return symbolValueOf.call(object) == symbolValueOf.call(other);
      }
  }
  return false;
}

/**
 * A specialized version of `baseIsEqualDeep` for objects with support for
 * partial deep comparisons.
 *
 * @private
 * @param {Object} object The object to compare.
 * @param {Object} other The other object to compare.
 * @param {Function} equalFunc The function to determine equivalents of values.
 * @param {Function} customizer The function to customize comparisons.
 * @param {number} bitmask The bitmask of comparison flags. See `baseIsEqual`
 *  for more details.
 * @param {Object} stack Tracks traversed `object` and `other` objects.
 * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
 */
function equalObjects(object, other, equalFunc, customizer, bitmask, stack) {
  var isPartial = bitmask & PARTIAL_COMPARE_FLAG,
      objProps = keys(object),
      objLength = objProps.length,
      othProps = keys(other),
      othLength = othProps.length;

  if (objLength != othLength && !isPartial) {
    return false;
  }
  var index = objLength;
  while (index--) {
    var key = objProps[index];
    if (!(isPartial ? key in other : hasOwnProperty.call(other, key))) {
      return false;
    }
  }
  // Assume cyclic values are equal.
  var stacked = stack.get(object);
  if (stacked && stack.get(other)) {
    return stacked == other;
  }
  var result = true;
  stack.set(object, other);
  stack.set(other, object);

  var skipCtor = isPartial;
  while (++index < objLength) {
    key = objProps[index];
    var objValue = object[key],
        othValue = other[key];

    if (customizer) {
      var compared = isPartial
        ? customizer(othValue, objValue, key, other, object, stack)
        : customizer(objValue, othValue, key, object, other, stack);
    }
    // Recursively compare objects (susceptible to call stack limits).
    if (!(compared === undefined
          ? (objValue === othValue || equalFunc(objValue, othValue, customizer, bitmask, stack))
          : compared
        )) {
      result = false;
      break;
    }
    skipCtor || (skipCtor = key == 'constructor');
  }
  if (result && !skipCtor) {
    var objCtor = object.constructor,
        othCtor = other.constructor;

    // Non `Object` object instances with different constructors are not equal.
    if (objCtor != othCtor &&
        ('constructor' in object && 'constructor' in other) &&
        !(typeof objCtor == 'function' && objCtor instanceof objCtor &&
          typeof othCtor == 'function' && othCtor instanceof othCtor)) {
      result = false;
    }
  }
  stack['delete'](object);
  stack['delete'](other);
  return result;
}

/**
 * Gets the data for `map`.
 *
 * @private
 * @param {Object} map The map to query.
 * @param {string} key The reference key.
 * @returns {*} Returns the map data.
 */
function getMapData(map, key) {
  var data = map.__data__;
  return isKeyable(key)
    ? data[typeof key == 'string' ? 'string' : 'hash']
    : data.map;
}

/**
 * Gets the property names, values, and compare flags of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the match data of `object`.
 */
function getMatchData(object) {
  var result = keys(object),
      length = result.length;

  while (length--) {
    var key = result[length],
        value = object[key];

    result[length] = [key, value, isStrictComparable(value)];
  }
  return result;
}

/**
 * Gets the native function at `key` of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {string} key The key of the method to get.
 * @returns {*} Returns the function if it's native, else `undefined`.
 */
function getNative(object, key) {
  var value = getValue(object, key);
  return baseIsNative(value) ? value : undefined;
}

/**
 * Gets the `toStringTag` of `value`.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the `toStringTag`.
 */
var getTag = baseGetTag;

// Fallback for data views, maps, sets, and weak maps in IE 11,
// for data views in Edge < 14, and promises in Node.js.
if ((DataView && getTag(new DataView(new ArrayBuffer(1))) != dataViewTag) ||
    (Map && getTag(new Map) != mapTag) ||
    (Promise && getTag(Promise.resolve()) != promiseTag) ||
    (Set && getTag(new Set) != setTag) ||
    (WeakMap && getTag(new WeakMap) != weakMapTag)) {
  getTag = function(value) {
    var result = objectToString.call(value),
        Ctor = result == objectTag ? value.constructor : undefined,
        ctorString = Ctor ? toSource(Ctor) : undefined;

    if (ctorString) {
      switch (ctorString) {
        case dataViewCtorString: return dataViewTag;
        case mapCtorString: return mapTag;
        case promiseCtorString: return promiseTag;
        case setCtorString: return setTag;
        case weakMapCtorString: return weakMapTag;
      }
    }
    return result;
  };
}

/**
 * Checks if `path` exists on `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {Array|string} path The path to check.
 * @param {Function} hasFunc The function to check properties.
 * @returns {boolean} Returns `true` if `path` exists, else `false`.
 */
function hasPath(object, path, hasFunc) {
  path = isKey(path, object) ? [path] : castPath(path);

  var result,
      index = -1,
      length = path.length;

  while (++index < length) {
    var key = toKey(path[index]);
    if (!(result = object != null && hasFunc(object, key))) {
      break;
    }
    object = object[key];
  }
  if (result) {
    return result;
  }
  var length = object ? object.length : 0;
  return !!length && isLength(length) && isIndex(key, length) &&
    (isArray(object) || isArguments(object));
}

/**
 * Checks if `value` is a valid array-like index.
 *
 * @private
 * @param {*} value The value to check.
 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
 */
function isIndex(value, length) {
  length = length == null ? MAX_SAFE_INTEGER : length;
  return !!length &&
    (typeof value == 'number' || reIsUint.test(value)) &&
    (value > -1 && value % 1 == 0 && value < length);
}

/**
 * Checks if `value` is a property name and not a property path.
 *
 * @private
 * @param {*} value The value to check.
 * @param {Object} [object] The object to query keys on.
 * @returns {boolean} Returns `true` if `value` is a property name, else `false`.
 */
function isKey(value, object) {
  if (isArray(value)) {
    return false;
  }
  var type = typeof value;
  if (type == 'number' || type == 'symbol' || type == 'boolean' ||
      value == null || isSymbol(value)) {
    return true;
  }
  return reIsPlainProp.test(value) || !reIsDeepProp.test(value) ||
    (object != null && value in Object(object));
}

/**
 * Checks if `value` is suitable for use as unique object key.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is suitable, else `false`.
 */
function isKeyable(value) {
  var type = typeof value;
  return (type == 'string' || type == 'number' || type == 'symbol' || type == 'boolean')
    ? (value !== '__proto__')
    : (value === null);
}

/**
 * Checks if `func` has its source masked.
 *
 * @private
 * @param {Function} func The function to check.
 * @returns {boolean} Returns `true` if `func` is masked, else `false`.
 */
function isMasked(func) {
  return !!maskSrcKey && (maskSrcKey in func);
}

/**
 * Checks if `value` is likely a prototype object.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a prototype, else `false`.
 */
function isPrototype(value) {
  var Ctor = value && value.constructor,
      proto = (typeof Ctor == 'function' && Ctor.prototype) || objectProto;

  return value === proto;
}

/**
 * Checks if `value` is suitable for strict equality comparisons, i.e. `===`.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` if suitable for strict
 *  equality comparisons, else `false`.
 */
function isStrictComparable(value) {
  return value === value && !isObject(value);
}

/**
 * A specialized version of `matchesProperty` for source values suitable
 * for strict equality comparisons, i.e. `===`.
 *
 * @private
 * @param {string} key The key of the property to get.
 * @param {*} srcValue The value to match.
 * @returns {Function} Returns the new spec function.
 */
function matchesStrictComparable(key, srcValue) {
  return function(object) {
    if (object == null) {
      return false;
    }
    return object[key] === srcValue &&
      (srcValue !== undefined || (key in Object(object)));
  };
}

/**
 * Converts `string` to a property path array.
 *
 * @private
 * @param {string} string The string to convert.
 * @returns {Array} Returns the property path array.
 */
var stringToPath = memoize(function(string) {
  string = toString(string);

  var result = [];
  if (reLeadingDot.test(string)) {
    result.push('');
  }
  string.replace(rePropName, function(match, number, quote, string) {
    result.push(quote ? string.replace(reEscapeChar, '$1') : (number || match));
  });
  return result;
});

/**
 * Converts `value` to a string key if it's not a string or symbol.
 *
 * @private
 * @param {*} value The value to inspect.
 * @returns {string|symbol} Returns the key.
 */
function toKey(value) {
  if (typeof value == 'string' || isSymbol(value)) {
    return value;
  }
  var result = (value + '');
  return (result == '0' && (1 / value) == -INFINITY) ? '-0' : result;
}

/**
 * Converts `func` to its source code.
 *
 * @private
 * @param {Function} func The function to process.
 * @returns {string} Returns the source code.
 */
function toSource(func) {
  if (func != null) {
    try {
      return funcToString.call(func);
    } catch (e) {}
    try {
      return (func + '');
    } catch (e) {}
  }
  return '';
}

/**
 * Creates an array of values by running each element in `collection` thru
 * `iteratee`. The iteratee is invoked with three arguments:
 * (value, index|key, collection).
 *
 * Many lodash methods are guarded to work as iteratees for methods like
 * `_.every`, `_.filter`, `_.map`, `_.mapValues`, `_.reject`, and `_.some`.
 *
 * The guarded methods are:
 * `ary`, `chunk`, `curry`, `curryRight`, `drop`, `dropRight`, `every`,
 * `fill`, `invert`, `parseInt`, `random`, `range`, `rangeRight`, `repeat`,
 * `sampleSize`, `slice`, `some`, `sortBy`, `split`, `take`, `takeRight`,
 * `template`, `trim`, `trimEnd`, `trimStart`, and `words`
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Collection
 * @param {Array|Object} collection The collection to iterate over.
 * @param {Function} [iteratee=_.identity] The function invoked per iteration.
 * @returns {Array} Returns the new mapped array.
 * @example
 *
 * function square(n) {
 *   return n * n;
 * }
 *
 * _.map([4, 8], square);
 * // => [16, 64]
 *
 * _.map({ 'a': 4, 'b': 8 }, square);
 * // => [16, 64] (iteration order is not guaranteed)
 *
 * var users = [
 *   { 'user': 'barney' },
 *   { 'user': 'fred' }
 * ];
 *
 * // The `_.property` iteratee shorthand.
 * _.map(users, 'user');
 * // => ['barney', 'fred']
 */
function map(collection, iteratee) {
  var func = isArray(collection) ? arrayMap : baseMap;
  return func(collection, baseIteratee(iteratee, 3));
}

/**
 * Creates a function that memoizes the result of `func`. If `resolver` is
 * provided, it determines the cache key for storing the result based on the
 * arguments provided to the memoized function. By default, the first argument
 * provided to the memoized function is used as the map cache key. The `func`
 * is invoked with the `this` binding of the memoized function.
 *
 * **Note:** The cache is exposed as the `cache` property on the memoized
 * function. Its creation may be customized by replacing the `_.memoize.Cache`
 * constructor with one whose instances implement the
 * [`Map`](http://ecma-international.org/ecma-262/7.0/#sec-properties-of-the-map-prototype-object)
 * method interface of `delete`, `get`, `has`, and `set`.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Function
 * @param {Function} func The function to have its output memoized.
 * @param {Function} [resolver] The function to resolve the cache key.
 * @returns {Function} Returns the new memoized function.
 * @example
 *
 * var object = { 'a': 1, 'b': 2 };
 * var other = { 'c': 3, 'd': 4 };
 *
 * var values = _.memoize(_.values);
 * values(object);
 * // => [1, 2]
 *
 * values(other);
 * // => [3, 4]
 *
 * object.a = 2;
 * values(object);
 * // => [1, 2]
 *
 * // Modify the result cache.
 * values.cache.set(object, ['a', 'b']);
 * values(object);
 * // => ['a', 'b']
 *
 * // Replace `_.memoize.Cache`.
 * _.memoize.Cache = WeakMap;
 */
function memoize(func, resolver) {
  if (typeof func != 'function' || (resolver && typeof resolver != 'function')) {
    throw new TypeError(FUNC_ERROR_TEXT);
  }
  var memoized = function() {
    var args = arguments,
        key = resolver ? resolver.apply(this, args) : args[0],
        cache = memoized.cache;

    if (cache.has(key)) {
      return cache.get(key);
    }
    var result = func.apply(this, args);
    memoized.cache = cache.set(key, result);
    return result;
  };
  memoized.cache = new (memoize.Cache || MapCache);
  return memoized;
}

// Assign cache to `_.memoize`.
memoize.Cache = MapCache;

/**
 * Performs a
 * [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
 * comparison between two values to determine if they are equivalent.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 * @example
 *
 * var object = { 'a': 1 };
 * var other = { 'a': 1 };
 *
 * _.eq(object, object);
 * // => true
 *
 * _.eq(object, other);
 * // => false
 *
 * _.eq('a', 'a');
 * // => true
 *
 * _.eq('a', Object('a'));
 * // => false
 *
 * _.eq(NaN, NaN);
 * // => true
 */
function eq(value, other) {
  return value === other || (value !== value && other !== other);
}

/**
 * Checks if `value` is likely an `arguments` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an `arguments` object,
 *  else `false`.
 * @example
 *
 * _.isArguments(function() { return arguments; }());
 * // => true
 *
 * _.isArguments([1, 2, 3]);
 * // => false
 */
function isArguments(value) {
  // Safari 8.1 makes `arguments.callee` enumerable in strict mode.
  return isArrayLikeObject(value) && hasOwnProperty.call(value, 'callee') &&
    (!propertyIsEnumerable.call(value, 'callee') || objectToString.call(value) == argsTag);
}

/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an array, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(document.body.children);
 * // => false
 *
 * _.isArray('abc');
 * // => false
 *
 * _.isArray(_.noop);
 * // => false
 */
var isArray = Array.isArray;

/**
 * Checks if `value` is array-like. A value is considered array-like if it's
 * not a function and has a `value.length` that's an integer greater than or
 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 * @example
 *
 * _.isArrayLike([1, 2, 3]);
 * // => true
 *
 * _.isArrayLike(document.body.children);
 * // => true
 *
 * _.isArrayLike('abc');
 * // => true
 *
 * _.isArrayLike(_.noop);
 * // => false
 */
function isArrayLike(value) {
  return value != null && isLength(value.length) && !isFunction(value);
}

/**
 * This method is like `_.isArrayLike` except that it also checks if `value`
 * is an object.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an array-like object,
 *  else `false`.
 * @example
 *
 * _.isArrayLikeObject([1, 2, 3]);
 * // => true
 *
 * _.isArrayLikeObject(document.body.children);
 * // => true
 *
 * _.isArrayLikeObject('abc');
 * // => false
 *
 * _.isArrayLikeObject(_.noop);
 * // => false
 */
function isArrayLikeObject(value) {
  return isObjectLike(value) && isArrayLike(value);
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a function, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8-9 which returns 'object' for typed array and other constructors.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This method is loosely based on
 * [`ToLength`](http://ecma-international.org/ecma-262/7.0/#sec-tolength).
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 * @example
 *
 * _.isLength(3);
 * // => true
 *
 * _.isLength(Number.MIN_VALUE);
 * // => false
 *
 * _.isLength(Infinity);
 * // => false
 *
 * _.isLength('3');
 * // => false
 */
function isLength(value) {
  return typeof value == 'number' &&
    value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

/**
 * Checks if `value` is the
 * [language type](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
 * of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/**
 * Checks if `value` is classified as a `Symbol` primitive or object.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a symbol, else `false`.
 * @example
 *
 * _.isSymbol(Symbol.iterator);
 * // => true
 *
 * _.isSymbol('abc');
 * // => false
 */
function isSymbol(value) {
  return typeof value == 'symbol' ||
    (isObjectLike(value) && objectToString.call(value) == symbolTag);
}

/**
 * Checks if `value` is classified as a typed array.
 *
 * @static
 * @memberOf _
 * @since 3.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a typed array, else `false`.
 * @example
 *
 * _.isTypedArray(new Uint8Array);
 * // => true
 *
 * _.isTypedArray([]);
 * // => false
 */
var isTypedArray = nodeIsTypedArray ? baseUnary(nodeIsTypedArray) : baseIsTypedArray;

/**
 * Converts `value` to a string. An empty string is returned for `null`
 * and `undefined` values. The sign of `-0` is preserved.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to process.
 * @returns {string} Returns the string.
 * @example
 *
 * _.toString(null);
 * // => ''
 *
 * _.toString(-0);
 * // => '-0'
 *
 * _.toString([1, 2, 3]);
 * // => '1,2,3'
 */
function toString(value) {
  return value == null ? '' : baseToString(value);
}

/**
 * Gets the value at `path` of `object`. If the resolved value is
 * `undefined`, the `defaultValue` is returned in its place.
 *
 * @static
 * @memberOf _
 * @since 3.7.0
 * @category Object
 * @param {Object} object The object to query.
 * @param {Array|string} path The path of the property to get.
 * @param {*} [defaultValue] The value returned for `undefined` resolved values.
 * @returns {*} Returns the resolved value.
 * @example
 *
 * var object = { 'a': [{ 'b': { 'c': 3 } }] };
 *
 * _.get(object, 'a[0].b.c');
 * // => 3
 *
 * _.get(object, ['a', '0', 'b', 'c']);
 * // => 3
 *
 * _.get(object, 'a.b.c', 'default');
 * // => 'default'
 */
function get(object, path, defaultValue) {
  var result = object == null ? undefined : baseGet(object, path);
  return result === undefined ? defaultValue : result;
}

/**
 * Checks if `path` is a direct or inherited property of `object`.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Object
 * @param {Object} object The object to query.
 * @param {Array|string} path The path to check.
 * @returns {boolean} Returns `true` if `path` exists, else `false`.
 * @example
 *
 * var object = _.create({ 'a': _.create({ 'b': 2 }) });
 *
 * _.hasIn(object, 'a');
 * // => true
 *
 * _.hasIn(object, 'a.b');
 * // => true
 *
 * _.hasIn(object, ['a', 'b']);
 * // => true
 *
 * _.hasIn(object, 'b');
 * // => false
 */
function hasIn(object, path) {
  return object != null && hasPath(object, path, baseHasIn);
}

/**
 * Creates an array of the own enumerable property names of `object`.
 *
 * **Note:** Non-object values are coerced to objects. See the
 * [ES spec](http://ecma-international.org/ecma-262/7.0/#sec-object.keys)
 * for more details.
 *
 * @static
 * @since 0.1.0
 * @memberOf _
 * @category Object
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.keys(new Foo);
 * // => ['a', 'b'] (iteration order is not guaranteed)
 *
 * _.keys('hi');
 * // => ['0', '1']
 */
function keys(object) {
  return isArrayLike(object) ? arrayLikeKeys(object) : baseKeys(object);
}

/**
 * This method returns the first argument it receives.
 *
 * @static
 * @since 0.1.0
 * @memberOf _
 * @category Util
 * @param {*} value Any value.
 * @returns {*} Returns `value`.
 * @example
 *
 * var object = { 'a': 1 };
 *
 * console.log(_.identity(object) === object);
 * // => true
 */
function identity(value) {
  return value;
}

/**
 * Creates a function that returns the value at `path` of a given object.
 *
 * @static
 * @memberOf _
 * @since 2.4.0
 * @category Util
 * @param {Array|string} path The path of the property to get.
 * @returns {Function} Returns the new accessor function.
 * @example
 *
 * var objects = [
 *   { 'a': { 'b': 2 } },
 *   { 'a': { 'b': 1 } }
 * ];
 *
 * _.map(objects, _.property('a.b'));
 * // => [2, 1]
 *
 * _.map(_.sortBy(objects, _.property(['a', 'b'])), 'a.b');
 * // => [1, 2]
 */
function property(path) {
  return isKey(path) ? baseProperty(toKey(path)) : basePropertyDeep(path);
}

module.exports = map;

/* WEBPACK VAR INJECTION */}.call(this, __webpack_require__(/*! ./../webpack/buildin/global.js */ "./node_modules/webpack/buildin/global.js"), __webpack_require__(/*! ./../webpack/buildin/module.js */ "./node_modules/webpack/buildin/module.js")(module)))

/***/ }),

/***/ "./node_modules/moo/moo.js":
/*!*********************************!*\
  !*** ./node_modules/moo/moo.js ***!
  \*********************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

var __WEBPACK_AMD_DEFINE_FACTORY__, __WEBPACK_AMD_DEFINE_ARRAY__, __WEBPACK_AMD_DEFINE_RESULT__;(function(root, factory) {
  if (true) {
    !(__WEBPACK_AMD_DEFINE_ARRAY__ = [], __WEBPACK_AMD_DEFINE_FACTORY__ = (factory),
				__WEBPACK_AMD_DEFINE_RESULT__ = (typeof __WEBPACK_AMD_DEFINE_FACTORY__ === 'function' ?
				(__WEBPACK_AMD_DEFINE_FACTORY__.apply(exports, __WEBPACK_AMD_DEFINE_ARRAY__)) : __WEBPACK_AMD_DEFINE_FACTORY__),
				__WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__)) /* global define */
  } else {}
}(this, function() {
  'use strict';

  var hasOwnProperty = Object.prototype.hasOwnProperty

  // polyfill assign(), so we support IE9+
  var assign = typeof Object.assign === 'function' ? Object.assign :
    // https://tc39.github.io/ecma262/#sec-object.assign
    function(target, sources) {
      if (target == null) {
        throw new TypeError('Target cannot be null or undefined');
      }
      target = Object(target)

      for (var i = 1; i < arguments.length; i++) {
        var source = arguments[i]
        if (source == null) continue

        for (var key in source) {
          if (hasOwnProperty.call(source, key)) {
            target[key] = source[key]
          }
        }
      }
      return target
    }

  var hasSticky = typeof new RegExp().sticky === 'boolean'

  /***************************************************************************/

  function isRegExp(o) { return o && o.constructor === RegExp }
  function isObject(o) { return o && typeof o === 'object' && o.constructor !== RegExp && !Array.isArray(o) }

  function reEscape(s) {
    return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
  }
  function reGroups(s) {
    var re = new RegExp('|' + s)
    return re.exec('').length - 1
  }
  function reCapture(s) {
    return '(' + s + ')'
  }
  function reUnion(regexps) {
    var source =  regexps.map(function(s) {
      return "(?:" + s + ")"
    }).join('|')
    return "(?:" + source + ")"
  }

  function regexpOrLiteral(obj) {
    if (typeof obj === 'string') {
      return '(?:' + reEscape(obj) + ')'

    } else if (isRegExp(obj)) {
      // TODO: consider /u support
      if (obj.ignoreCase) { throw new Error('RegExp /i flag not allowed') }
      if (obj.global) { throw new Error('RegExp /g flag is implied') }
      if (obj.sticky) { throw new Error('RegExp /y flag is implied') }
      if (obj.multiline) { throw new Error('RegExp /m flag is implied') }
      return obj.source

    } else {
      throw new Error('not a pattern: ' + obj)
    }
  }

  function objectToRules(object) {
    var keys = Object.getOwnPropertyNames(object)
    var result = []
    for (var i=0; i<keys.length; i++) {
      var key = keys[i]
      var thing = object[key]
      var rules = Array.isArray(thing) ? thing : [thing]
      var match = []
      rules.forEach(function(rule) {
        if (isObject(rule)) {
          if (match.length) result.push(ruleOptions(key, match))
          result.push(ruleOptions(key, rule))
          match = []
        } else {
          match.push(rule)
        }
      })
      if (match.length) result.push(ruleOptions(key, match))
    }
    return result
  }

  function arrayToRules(array) {
    var result = []
    for (var i=0; i<array.length; i++) {
      var obj = array[i]
      if (!obj.name) {
        throw new Error('Rule has no name: ' + JSON.stringify(obj))
      }
      result.push(ruleOptions(obj.name, obj))
    }
    return result
  }

  function ruleOptions(name, obj) {
    if (typeof obj !== 'object' || Array.isArray(obj) || isRegExp(obj)) {
      obj = { match: obj }
    }

    // nb. error implies lineBreaks
    var options = assign({
      tokenType: name,
      lineBreaks: !!obj.error,
      pop: false,
      next: null,
      push: null,
      error: false,
      value: null,
      getType: null,
    }, obj)

    // convert to array
    var match = options.match
    options.match = Array.isArray(match) ? match : match ? [match] : []
    options.match.sort(function(a, b) {
      return isRegExp(a) && isRegExp(b) ? 0
           : isRegExp(b) ? -1 : isRegExp(a) ? +1 : b.length - a.length
    })
    if (options.keywords) {
      options.getType = keywordTransform(options.keywords)
    }
    return options
  }

  function compileRules(rules, hasStates) {
    rules = Array.isArray(rules) ? arrayToRules(rules) : objectToRules(rules)

    var errorRule = null
    var groups = []
    var parts = []
    for (var i=0; i<rules.length; i++) {
      var options = rules[i]

      if (options.error) {
        if (errorRule) {
          throw new Error("Multiple error rules not allowed: (for token '" + options.tokenType + "')")
        }
        errorRule = options
      }

      // skip rules with no match
      if (options.match.length === 0) {
        continue
      }
      groups.push(options)

      // convert to RegExp
      var pat = reUnion(options.match.map(regexpOrLiteral))

      // validate
      var regexp = new RegExp(pat)
      if (regexp.test("")) {
        throw new Error("RegExp matches empty string: " + regexp)
      }
      var groupCount = reGroups(pat)
      if (groupCount > 0) {
        throw new Error("RegExp has capture groups: " + regexp + "\nUse (?: … ) instead")
      }
      if (!hasStates && (options.pop || options.push || options.next)) {
        throw new Error("State-switching options are not allowed in stateless lexers (for token '" + options.tokenType + "')")
      }

      // try and detect rules matching newlines
      if (!options.lineBreaks && regexp.test('\n')) {
        throw new Error('Rule should declare lineBreaks: ' + regexp)
      }

      // store regex
      parts.push(reCapture(pat))
    }

    var suffix = hasSticky ? '' : '|(?:)'
    var flags = hasSticky ? 'ym' : 'gm'
    var combined = new RegExp(reUnion(parts) + suffix, flags)

    return {regexp: combined, groups: groups, error: errorRule}
  }

  function compile(rules) {
    var result = compileRules(rules)
    return new Lexer({start: result}, 'start')
  }

  function compileStates(states, start) {
    var keys = Object.getOwnPropertyNames(states)
    if (!start) start = keys[0]

    var map = Object.create(null)
    for (var i=0; i<keys.length; i++) {
      var key = keys[i]
      map[key] = compileRules(states[key], true)
    }

    for (var i=0; i<keys.length; i++) {
      var groups = map[keys[i]].groups
      for (var j=0; j<groups.length; j++) {
        var g = groups[j]
        var state = g && (g.push || g.next)
        if (state && !map[state]) {
          throw new Error("Missing state '" + state + "' (in token '" + g.tokenType + "' of state '" + keys[i] + "')")
        }
        if (g && g.pop && +g.pop !== 1) {
          throw new Error("pop must be 1 (in token '" + g.tokenType + "' of state '" + keys[i] + "')")
        }
      }
    }

    return new Lexer(map, start)
  }

  function keywordTransform(map) {
    var reverseMap = Object.create(null)
    var byLength = Object.create(null)
    var types = Object.getOwnPropertyNames(map)
    for (var i=0; i<types.length; i++) {
      var tokenType = types[i]
      var item = map[tokenType]
      var keywordList = Array.isArray(item) ? item : [item]
      keywordList.forEach(function(keyword) {
        (byLength[keyword.length] = byLength[keyword.length] || []).push(keyword)
        if (typeof keyword !== 'string') {
          throw new Error("keyword must be string (in keyword '" + tokenType + "')")
        }
        reverseMap[keyword] = tokenType
      })
    }

    // fast string lookup
    // https://jsperf.com/string-lookups
    function str(x) { return JSON.stringify(x) }
    var source = ''
    source += '(function(value) {\n'
    source += 'switch (value.length) {\n'
    for (var length in byLength) {
      var keywords = byLength[length]
      source += 'case ' + length + ':\n'
      source += 'switch (value) {\n'
      keywords.forEach(function(keyword) {
        var tokenType = reverseMap[keyword]
        source += 'case ' + str(keyword) + ': return ' + str(tokenType) + '\n'
      })
      source += '}\n'
    }
    source += '}\n'
    source += '})'
    return eval(source) // getType
  }

  /***************************************************************************/

  var Lexer = function(states, state) {
    this.startState = state
    this.states = states
    this.buffer = ''
    this.stack = []
    this.reset()
  }

  Lexer.prototype.reset = function(data, info) {
    this.buffer = data || ''
    this.index = 0
    this.line = info ? info.line : 1
    this.col = info ? info.col : 1
    this.setState(info ? info.state : this.startState)
    return this
  }

  Lexer.prototype.save = function() {
    return {
      line: this.line,
      col: this.col,
      state: this.state,
    }
  }

  Lexer.prototype.setState = function(state) {
    if (!state || this.state === state) return
    this.state = state
    var info = this.states[state]
    this.groups = info.groups
    this.error = info.error || {lineBreaks: true, shouldThrow: true}
    this.re = info.regexp
  }

  Lexer.prototype.popState = function() {
    this.setState(this.stack.pop())
  }

  Lexer.prototype.pushState = function(state) {
    this.stack.push(this.state)
    this.setState(state)
  }

  Lexer.prototype._eat = hasSticky ? function(re) { // assume re is /y
    return re.exec(this.buffer)
  } : function(re) { // assume re is /g
    var match = re.exec(this.buffer)
    // will always match, since we used the |(?:) trick
    if (match[0].length === 0) {
      return null
    }
    return match
  }

  Lexer.prototype._getGroup = function(match) {
    if (match === null) {
      return -1
    }

    var groupCount = this.groups.length
    for (var i = 0; i < groupCount; i++) {
      if (match[i + 1] !== undefined) {
        return i
      }
    }
    throw new Error('oops')
  }

  function tokenToString() {
    return this.value
  }

  Lexer.prototype.next = function() {
    var re = this.re
    var buffer = this.buffer

    var index = re.lastIndex = this.index
    if (index === buffer.length) {
      return // EOF
    }

    var match = this._eat(re)
    var i = this._getGroup(match)

    var group, text
    if (i === -1) {
      group = this.error

      // consume rest of buffer
      text = buffer.slice(index)

    } else {
      text = match[0]
      group = this.groups[i]
    }

    // count line breaks
    var lineBreaks = 0
    if (group.lineBreaks) {
      var matchNL = /\n/g
      var nl = 1
      if (text === '\n') {
        lineBreaks = 1
      } else {
        while (matchNL.exec(text)) { lineBreaks++; nl = matchNL.lastIndex }
      }
    }

    var token = {
      type: (group.getType && group.getType(text)) || group.tokenType,
      value: group.value ? group.value(text) : text,
      text: text,
      toString: tokenToString,
      offset: index,
      lineBreaks: lineBreaks,
      line: this.line,
      col: this.col,
    }
    // nb. adding more props to token object will make V8 sad!

    var size = text.length
    this.index += size
    this.line += lineBreaks
    if (lineBreaks !== 0) {
      this.col = size - nl + 1
    } else {
      this.col += size
    }
    // throw, if no rule with {error: true}
    if (group.shouldThrow) {
      throw new Error(this.formatError(token, "invalid syntax"))
    }

    if (group.pop) this.popState()
    else if (group.push) this.pushState(group.push)
    else if (group.next) this.setState(group.next)
    return token
  }

  if (typeof Symbol !== 'undefined' && Symbol.iterator) {
    var LexerIterator = function(lexer) {
      this.lexer = lexer
    }

    LexerIterator.prototype.next = function() {
      var token = this.lexer.next()
      return {value: token, done: !token}
    }

    LexerIterator.prototype[Symbol.iterator] = function() {
      return this
    }

    Lexer.prototype[Symbol.iterator] = function() {
      return new LexerIterator(this)
    }
  }

  Lexer.prototype.formatError = function(token, message) {
    var value = token.value
    var index = token.offset
    var eol = token.lineBreaks ? value.indexOf('\n') : value.length
    var start = Math.max(0, index - token.col + 1)
    var firstLine = this.buffer.substring(start, index + eol)
    message += " at line " + token.line + " col " + token.col + ":\n\n"
    message += "  " + firstLine + "\n"
    message += "  " + Array(token.col).join(" ") + "^"
    return message
  }

  Lexer.prototype.clone = function() {
    return new Lexer(this.states, this.state)
  }

  Lexer.prototype.has = function(tokenType) {
    for (var s in this.states) {
      var groups = this.states[s].groups
      for (var i=0; i<groups.length; i++) {
        var group = groups[i]
        if (group.tokenType === tokenType) return true
        if (group.keywords && hasOwnProperty.call(group.keywords, tokenType)) {
          return true
        }
      }
    }
    return false
  }


  return {
    compile: compile,
    states: compileStates,
    error: Object.freeze({error: true}),
  }

}))


/***/ }),

/***/ "./node_modules/nearley/builtin/cow.ne":
/*!*********************************************!*\
  !*** ./node_modules/nearley/builtin/cow.ne ***!
  \*********************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony default export */ __webpack_exports__["default"] = ("# Match a loud moo\ncow -> \"MO\" \"O\":+\n");

/***/ }),

/***/ "./node_modules/nearley/builtin/number.ne":
/*!************************************************!*\
  !*** ./node_modules/nearley/builtin/number.ne ***!
  \************************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony default export */ __webpack_exports__["default"] = ("unsigned_int -> [0-9]:+ {%\n    function(d) {\n        return parseInt(d[0].join(\"\"));\n    }\n%}\n\nint -> (\"-\"|\"+\"):? [0-9]:+ {%\n    function(d) {\n        if (d[0]) {\n            return parseInt(d[0][0]+d[1].join(\"\"));\n        } else {\n            return parseInt(d[1].join(\"\"));\n        }\n    }\n%}\n\nunsigned_decimal -> [0-9]:+ (\".\" [0-9]:+):? {%\n    function(d) {\n        return parseFloat(\n            d[0].join(\"\") +\n            (d[1] ? \".\"+d[1][1].join(\"\") : \"\")\n        );\n    }\n%}\n\ndecimal -> \"-\":? [0-9]:+ (\".\" [0-9]:+):? {%\n    function(d) {\n        return parseFloat(\n            (d[0] || \"\") +\n            d[1].join(\"\") +\n            (d[2] ? \".\"+d[2][1].join(\"\") : \"\")\n        );\n    }\n%}\n\npercentage -> decimal \"%\" {%\n    function(d) {\n        return d[0]/100;\n    }\n%}\n\njsonfloat -> \"-\":? [0-9]:+ (\".\" [0-9]:+):? ([eE] [+-]:? [0-9]:+):? {%\n    function(d) {\n        return parseFloat(\n            (d[0] || \"\") +\n            d[1].join(\"\") +\n            (d[2] ? \".\"+d[2][1].join(\"\") : \"\") +\n            (d[3] ? \"e\" + (d[3][1] || \"+\") + d[3][2].join(\"\") : \"\")\n        );\n    }\n%}\n");

/***/ }),

/***/ "./node_modules/nearley/builtin/postprocessors.ne":
/*!********************************************************!*\
  !*** ./node_modules/nearley/builtin/postprocessors.ne ***!
  \********************************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony default export */ __webpack_exports__["default"] = ("# Simple postprocessors\n\n# Postprocessor generator that lets you select the nth element of the list.\n# `id` is equivalent to nth(0).\n@{%\n// Bypasses TS6133. Allow declared but unused functions.\n// @ts-ignore\nfunction nth(n) {\n    return function(d) {\n        return d[n];\n    };\n}\n%}\n\n# Postprocessor generator that lets you generate an object dynamically.\n@{%\n// Bypasses TS6133. Allow declared but unused functions.\n// @ts-ignore\nfunction $(o) {\n    return function(d) {\n        var ret = {};\n        Object.keys(o).forEach(function(k) {\n            ret[k] = d[o[k]];\n        });\n        return ret;\n    };\n}\n%}\n\n# A separated list of elements.\n\ndelimited[el, delim] -> $el ($delim $el {% nth(1) %}):* {%\n    function(d) {\n        return [d[0]].concat(d[1]);\n    }\n%}\n");

/***/ }),

/***/ "./node_modules/nearley/builtin/string.ne":
/*!************************************************!*\
  !*** ./node_modules/nearley/builtin/string.ne ***!
  \************************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony default export */ __webpack_exports__["default"] = ("# Matches various kinds of string literals\n\n# Double-quoted string\ndqstring -> \"\\\"\" dstrchar:* \"\\\"\" {% function(d) {return d[1].join(\"\"); } %}\nsqstring -> \"'\"  sstrchar:* \"'\"  {% function(d) {return d[1].join(\"\"); } %}\nbtstring -> \"`\"  [^`]:*    \"`\"  {% function(d) {return d[1].join(\"\"); } %}\n\ndstrchar -> [^\\\\\"\\n] {% id %}\n    | \"\\\\\" strescape {%\n    function(d) {\n        return JSON.parse(\"\\\"\"+d.join(\"\")+\"\\\"\");\n    }\n%}\n\nsstrchar -> [^\\\\'\\n] {% id %}\n    | \"\\\\\" strescape\n        {% function(d) { return JSON.parse(\"\\\"\"+d.join(\"\")+\"\\\"\"); } %}\n    | \"\\\\'\"\n        {% function(d) {return \"'\"; } %}\n\nstrescape -> [\"\\\\/bfnrt] {% id %}\n    | \"u\" [a-fA-F0-9] [a-fA-F0-9] [a-fA-F0-9] [a-fA-F0-9] {%\n    function(d) {\n        return d.join(\"\");\n    }\n%}\n");

/***/ }),

/***/ "./node_modules/nearley/builtin/whitespace.ne":
/*!****************************************************!*\
  !*** ./node_modules/nearley/builtin/whitespace.ne ***!
  \****************************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony default export */ __webpack_exports__["default"] = ("# Whitespace: `_` is optional, `__` is mandatory.\n_  -> wschar:* {% function(d) {return null;} %}\n__ -> wschar:+ {% function(d) {return null;} %}\n\nwschar -> [ \\t\\n\\v\\f] {% id %}\n");

/***/ }),

/***/ "./node_modules/nearley/lib/generate.js":
/*!**********************************************!*\
  !*** ./node_modules/nearley/lib/generate.js ***!
  \**********************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

(function(root, factory) {
    if ( true && module.exports) {
        module.exports = factory(__webpack_require__(/*! ./nearley */ "./node_modules/nearley/lib/nearley.js"));
    } else {
        root.generate = factory(root.nearley);
    }
}(this, function(nearley) {

    function serializeRules(rules, builtinPostprocessors, extraIndent) {
        if (extraIndent == null) {
            extraIndent = ''
        }

        return '[\n    ' + rules.map(function(rule) {
            return serializeRule(rule, builtinPostprocessors);
        }).join(',\n    ') + '\n' + extraIndent + ']';
    }

    function dedentFunc(func) {
        var lines = func.toString().split(/\n/);

        if (lines.length === 1) {
            return [lines[0].replace(/^\s+|\s+$/g, '')];
        }

        var indent = null;
        var tail = lines.slice(1);
        for (var i = 0; i < tail.length; i++) {
            var match = /^\s*/.exec(tail[i]);
            if (match && match[0].length !== tail[i].length) {
                if (indent === null ||
                    match[0].length < indent.length) {
                    indent = match[0];
                }
            }
        }

        if (indent === null) {
            return lines;
        }

        return lines.map(function dedent(line) {
            if (line.slice(0, indent.length) === indent) {
                return line.slice(indent.length);
            }
            return line;
        });
    }

    function tabulateString(string, indent, options) {
        var lines;
        if(Array.isArray(string)) {
          lines = string;
        } else {
          lines = string.toString().split('\n');
        }

        options = options || {};
        tabulated = lines.map(function addIndent(line, i) {
            var shouldIndent = true;

            if(i == 0 && !options.indentFirst) {
              shouldIndent = false;
            }

            if(shouldIndent) {
                return indent + line;
            } else {
                return line;
            }
        }).join('\n');

        return tabulated;
    }

    function serializeSymbol(s) {
        if (s instanceof RegExp) {
            return s.toString();
        } else if (s.token) {
            return s.token;
        } else {
            return JSON.stringify(s);
        }
    }

    function serializeRule(rule, builtinPostprocessors) {
        var ret = '{';
        ret += '"name": ' + JSON.stringify(rule.name);
        ret += ', "symbols": [' + rule.symbols.map(serializeSymbol).join(', ') + ']';
        if (rule.postprocess) {
            if(rule.postprocess.builtin) {
                rule.postprocess = builtinPostprocessors[rule.postprocess.builtin];
            }
            ret += ', "postprocess": ' + tabulateString(dedentFunc(rule.postprocess), '        ', {indentFirst: false});
        }
        ret += '}';
        return ret;
    }

    var generate = function (parser, exportName) {
        if(!parser.config.preprocessor) {
            parser.config.preprocessor = "_default";
        }

        if(!generate[parser.config.preprocessor]) {
            throw new Error("No such preprocessor: " + parser.config.preprocessor)
        }

        return generate[parser.config.preprocessor](parser, exportName);
    };

    generate.js = generate._default = generate.javascript = function (parser, exportName) {
        var output = "// Generated automatically by nearley, version " + parser.version + "\n";
        output +=  "// http://github.com/Hardmath123/nearley\n";
        output += "(function () {\n";
        output += "function id(x) { return x[0]; }\n";
        output += parser.body.join('\n');
        output += "var grammar = {\n";
        output += "    Lexer: " + parser.config.lexer + ",\n";
        output += "    ParserRules: " +
            serializeRules(parser.rules, generate.javascript.builtinPostprocessors)
            + "\n";
        output += "  , ParserStart: " + JSON.stringify(parser.start) + "\n";
        output += "}\n";
        output += "if (typeof module !== 'undefined'"
            + "&& typeof module.exports !== 'undefined') {\n";
        output += "   module.exports = grammar;\n";
        output += "} else {\n";
        output += "   window." + exportName + " = grammar;\n";
        output += "}\n";
        output += "})();\n";
        return output;
    };

    generate.javascript.builtinPostprocessors = {
        "joiner": "function joiner(d) {return d.join('');}",
        "arrconcat": "function arrconcat(d) {return [d[0]].concat(d[1]);}",
        "arrpush": "function arrpush(d) {return d[0].concat([d[1]]);}",
        "nuller": "function(d) {return null;}",
        "id": "id"
    }

    generate.module = generate.esmodule = function (parser, exportName) {
        var output = "// Generated automatically by nearley, version " + parser.version + "\n";
        output +=  "// http://github.com/Hardmath123/nearley\n";
        output += "function id(x) { return x[0]; }\n";
        output += parser.body.join('\n');
        output += "let Lexer = " + parser.config.lexer + ";\n";
        output += "let ParserRules = " + serializeRules(parser.rules, generate.javascript.builtinPostprocessors) + ";\n";
        output += "let ParserStart = " + JSON.stringify(parser.start) + ";\n";
        output += "export default { Lexer, ParserRules, ParserStart };\n";
        return output;
    };

    generate.cs = generate.coffee = generate.coffeescript = function (parser, exportName) {
        var output = "# Generated automatically by nearley, version " + parser.version + "\n";
        output +=  "# http://github.com/Hardmath123/nearley\n";
        output += "do ->\n";
        output += "  id = (d) -> d[0]\n";
        output += tabulateString(dedentFunc(parser.body.join('\n')), '  ') + '\n';
        output += "  grammar = {\n";
        output += "    Lexer: " + parser.config.lexer + ",\n";
        output += "    ParserRules: " +
            tabulateString(
                    serializeRules(parser.rules, generate.coffeescript.builtinPostprocessors),
                    '      ',
                    {indentFirst: false})
        + ",\n";
        output += "    ParserStart: " + JSON.stringify(parser.start) + "\n";
        output += "  }\n";
        output += "  if typeof module != 'undefined' "
            + "&& typeof module.exports != 'undefined'\n";
        output += "    module.exports = grammar;\n";
        output += "  else\n";
        output += "    window." + exportName + " = grammar;\n";
        return output;
    };

    generate.coffeescript.builtinPostprocessors = {
        "joiner": "(d) -> d.join('')",
        "arrconcat": "(d) -> [d[0]].concat(d[1])",
        "arrpush": "(d) -> d[0].concat([d[1]])",
        "nuller": "() -> null",
        "id": "id"
    };

    generate.ts = generate.typescript = function (parser, exportName) {
        var output = "// Generated automatically by nearley, version " + parser.version + "\n";
        output +=  "// http://github.com/Hardmath123/nearley\n";
        output +=  "// Bypasses TS6133. Allow declared but unused functions.\n";
        output +=  "// @ts-ignore\n";
        output += "function id(d: any[]): any { return d[0]; }\n";
        output += parser.customTokens.map(function (token) { return "declare var " + token + ": any;\n" }).join("")
        output += parser.body.join('\n');
        output += "\n";
        output += "interface NearleyToken {";
        output += "  value: any;\n";
        output += "  [key: string]: any;\n";
        output += "};\n";
        output += "\n";
        output += "interface NearleyLexer {\n";
        output += "  reset: (chunk: string, info: any) => void;\n";
        output += "  next: () => NearleyToken | undefined;\n";
        output += "  save: () => any;\n";
        output += "  formatError: (token: NearleyToken) => string;\n";
        output += "  has: (tokenType: string) => boolean;\n";
        output += "};\n";
        output += "\n";
        output += "interface NearleyRule {\n";
        output += "  name: string;\n";
        output += "  symbols: NearleySymbol[];\n";
        output += "  postprocess?: (d: any[], loc?: number, reject?: {}) => any;\n";
        output += "};\n";
        output += "\n";
        output += "type NearleySymbol = string | { literal: any } | { test: (token: any) => boolean };\n";
        output += "\n";
        output += "interface Grammar {\n";
        output += "  Lexer: NearleyLexer | undefined;\n";
        output += "  ParserRules: NearleyRule[];\n";
        output += "  ParserStart: string;\n";
        output += "};\n";
        output += "\n";
        output += "const grammar: Grammar = {\n";
        output += "  Lexer: " + parser.config.lexer + ",\n";
        output += "  ParserRules: " + serializeRules(parser.rules, generate.typescript.builtinPostprocessors, "  ") + ",\n";
        output += "  ParserStart: " + JSON.stringify(parser.start) + ",\n";
        output += "};\n";
        output += "\n";
        output += "export default grammar;\n";

        return output;
    };

    generate.typescript.builtinPostprocessors = {
        "joiner": "(d) => d.join('')",
        "arrconcat": "(d) => [d[0]].concat(d[1])",
        "arrpush": "(d) => d[0].concat([d[1]])",
        "nuller": "() => null",
        "id": "id"
    };

    return generate;

}));


/***/ }),

/***/ "./node_modules/nearley/lib/lint.js":
/*!******************************************!*\
  !*** ./node_modules/nearley/lib/lint.js ***!
  \******************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

/* WEBPACK VAR INJECTION */(function(process) {// Node-only
var semver = __webpack_require__(/*! semver */ "./node_modules/semver/semver.js");

var warn = function (opts, str) {
    opts.out.write("WARN"+"\t" + str + "\n");
}

function lintNames(grm, opts) {
    var all = [];
    grm.rules.forEach(function(rule) {
        all.push(rule.name);
    });
    grm.rules.forEach(function(rule) {
        rule.symbols.forEach(function(symbol) {
            if (!symbol.literal && !symbol.token && symbol.constructor !== RegExp) {
                if (all.indexOf(symbol) === -1) {
                    warn(opts,"Undefined symbol `" + symbol + "` used.");
                }
            }
        });
    });
}

function lint(grm, opts) {
    if (!opts.out) opts.out = process.stderr;
    lintNames(grm, opts);
}

module.exports = lint;

/* WEBPACK VAR INJECTION */}.call(this, __webpack_require__(/*! ./../../process/browser.js */ "./node_modules/process/browser.js")))

/***/ }),

/***/ "./node_modules/nearley/lib/nearley-language-bootstrapped.js":
/*!*******************************************************************!*\
  !*** ./node_modules/nearley/lib/nearley-language-bootstrapped.js ***!
  \*******************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

// Generated automatically by nearley, version 2.17.0
// http://github.com/Hardmath123/nearley
(function () {
function id(x) { return x[0]; }

function getValue(d) {
    return d[0].value
}

function literals(list) {
    var rules = {}
    for (var lit of list) {
        rules[lit] = {match: lit, next: 'main'}
    }
    return rules
}

var moo = __webpack_require__(/*! moo */ "./node_modules/moo/moo.js")
var rules = Object.assign({
    ws: {match: /\s+/, lineBreaks: true, next: 'main'},
    comment: /\#.*/,
    arrow: {match: /[=-]+\>/, next: 'main'},
    js: {
        match: /\{\%(?:[^%]|\%[^}])*\%\}/,
        value: x => x.slice(2, -2),
    },
    word: {match: /[\w\?\+]+/, next: 'afterWord'},
    string: {
        match: /"(?:[^\\"\n]|\\["\\/bfnrt]|\\u[a-fA-F0-9]{4})*"/,
        value: x => JSON.parse(x),
        next: 'main',
    },
    btstring: {
        match: /`[^`]*`/,
        value: x => x.slice(1, -1),
        next: 'main',
    },
}, literals([
    ",", "|", "$", "%", "(", ")",
    ":?", ":*", ":+",
    "@include", "@builtin", "@",
    "]",
]))

var lexer = moo.states({
    main: Object.assign({}, rules, {
        charclass: {
            match: /\.|\[(?:\\.|[^\\\n])+?\]/,
            value: x => new RegExp(x),
        },
    }),
    // Both macro arguments and charclasses are both enclosed in [ ].
    // We disambiguate based on whether the previous token was a `word`.
    afterWord: Object.assign({}, rules, {
        "[": {match: "[", next: 'main'},
    }),
})

function insensitive(sl) {
    var s = sl.literal;
    var result = [];
    for (var i=0; i<s.length; i++) {
        var c = s.charAt(i);
        if (c.toUpperCase() !== c || c.toLowerCase() !== c) {
            result.push(new RegExp("[" + c.toLowerCase() + c.toUpperCase() + "]"));
            } else {
            result.push({literal: c});
        }
    }
    return {subexpression: [{tokens: result, postprocess: function(d) {return d.join(""); }}]};
}

var grammar = {
    Lexer: lexer,
    ParserRules: [
    {"name": "final$ebnf$1", "symbols": [(lexer.has("ws") ? {type: "ws"} : ws)], "postprocess": id},
    {"name": "final$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "final", "symbols": ["_", "prog", "_", "final$ebnf$1"], "postprocess": function(d) { return d[1]; }},
    {"name": "prog", "symbols": ["prod"], "postprocess": function(d) { return [d[0]]; }},
    {"name": "prog", "symbols": ["prod", "ws", "prog"], "postprocess": function(d) { return [d[0]].concat(d[2]); }},
    {"name": "prod", "symbols": ["word", "_", (lexer.has("arrow") ? {type: "arrow"} : arrow), "_", "expression+"], "postprocess": function(d) { return {name: d[0], rules: d[4]}; }},
    {"name": "prod", "symbols": ["word", {"literal":"["}, "wordlist", {"literal":"]"}, "_", (lexer.has("arrow") ? {type: "arrow"} : arrow), "_", "expression+"], "postprocess": function(d) {return {macro: d[0], args: d[2], exprs: d[7]}}},
    {"name": "prod", "symbols": [{"literal":"@"}, "_", "js"], "postprocess": function(d) { return {body: d[2]}; }},
    {"name": "prod", "symbols": [{"literal":"@"}, "word", "ws", "word"], "postprocess": function(d) { return {config: d[1], value: d[3]}; }},
    {"name": "prod", "symbols": [{"literal":"@include"}, "_", "string"], "postprocess": function(d) {return {include: d[2].literal, builtin: false}}},
    {"name": "prod", "symbols": [{"literal":"@builtin"}, "_", "string"], "postprocess": function(d) {return {include: d[2].literal, builtin: true }}},
    {"name": "expression+", "symbols": ["completeexpression"]},
    {"name": "expression+", "symbols": ["expression+", "_", {"literal":"|"}, "_", "completeexpression"], "postprocess": function(d) { return d[0].concat([d[4]]); }},
    {"name": "expressionlist", "symbols": ["completeexpression"]},
    {"name": "expressionlist", "symbols": ["expressionlist", "_", {"literal":","}, "_", "completeexpression"], "postprocess": function(d) { return d[0].concat([d[4]]); }},
    {"name": "wordlist", "symbols": ["word"]},
    {"name": "wordlist", "symbols": ["wordlist", "_", {"literal":","}, "_", "word"], "postprocess": function(d) { return d[0].concat([d[4]]); }},
    {"name": "completeexpression", "symbols": ["expr"], "postprocess": function(d) { return {tokens: d[0]}; }},
    {"name": "completeexpression", "symbols": ["expr", "_", "js"], "postprocess": function(d) { return {tokens: d[0], postprocess: d[2]}; }},
    {"name": "expr_member", "symbols": ["word"], "postprocess": id},
    {"name": "expr_member", "symbols": [{"literal":"$"}, "word"], "postprocess": function(d) {return {mixin: d[1]}}},
    {"name": "expr_member", "symbols": ["word", {"literal":"["}, "expressionlist", {"literal":"]"}], "postprocess": function(d) {return {macrocall: d[0], args: d[2]}}},
    {"name": "expr_member$ebnf$1", "symbols": [{"literal":"i"}], "postprocess": id},
    {"name": "expr_member$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "expr_member", "symbols": ["string", "expr_member$ebnf$1"], "postprocess": function(d) { if (d[1]) {return insensitive(d[0]); } else {return d[0]; } }},
    {"name": "expr_member", "symbols": [{"literal":"%"}, "word"], "postprocess": function(d) {return {token: d[1]}}},
    {"name": "expr_member", "symbols": ["charclass"], "postprocess": id},
    {"name": "expr_member", "symbols": [{"literal":"("}, "_", "expression+", "_", {"literal":")"}], "postprocess": function(d) {return {'subexpression': d[2]} ;}},
    {"name": "expr_member", "symbols": ["expr_member", "_", "ebnf_modifier"], "postprocess": function(d) {return {'ebnf': d[0], 'modifier': d[2]}; }},
    {"name": "ebnf_modifier", "symbols": [{"literal":":+"}], "postprocess": getValue},
    {"name": "ebnf_modifier", "symbols": [{"literal":":*"}], "postprocess": getValue},
    {"name": "ebnf_modifier", "symbols": [{"literal":":?"}], "postprocess": getValue},
    {"name": "expr", "symbols": ["expr_member"]},
    {"name": "expr", "symbols": ["expr", "ws", "expr_member"], "postprocess": function(d){ return d[0].concat([d[2]]); }},
    {"name": "word", "symbols": [(lexer.has("word") ? {type: "word"} : word)], "postprocess": getValue},
    {"name": "string", "symbols": [(lexer.has("string") ? {type: "string"} : string)], "postprocess": d => ({literal: d[0].value})},
    {"name": "string", "symbols": [(lexer.has("btstring") ? {type: "btstring"} : btstring)], "postprocess": d => ({literal: d[0].value})},
    {"name": "charclass", "symbols": [(lexer.has("charclass") ? {type: "charclass"} : charclass)], "postprocess": getValue},
    {"name": "js", "symbols": [(lexer.has("js") ? {type: "js"} : js)], "postprocess": getValue},
    {"name": "_$ebnf$1", "symbols": ["ws"], "postprocess": id},
    {"name": "_$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "_", "symbols": ["_$ebnf$1"]},
    {"name": "ws", "symbols": [(lexer.has("ws") ? {type: "ws"} : ws)]},
    {"name": "ws$ebnf$1", "symbols": [(lexer.has("ws") ? {type: "ws"} : ws)], "postprocess": id},
    {"name": "ws$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "ws", "symbols": ["ws$ebnf$1", (lexer.has("comment") ? {type: "comment"} : comment), "_"]}
]
  , ParserStart: "final"
}
if ( true&& typeof module.exports !== 'undefined') {
   module.exports = grammar;
} else {
   window.grammar = grammar;
}
})();


/***/ }),

/***/ "./node_modules/nearley/lib/nearley.js":
/*!*********************************************!*\
  !*** ./node_modules/nearley/lib/nearley.js ***!
  \*********************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

(function(root, factory) {
    if ( true && module.exports) {
        module.exports = factory();
    } else {
        root.nearley = factory();
    }
}(this, function() {

    function Rule(name, symbols, postprocess) {
        this.id = ++Rule.highestId;
        this.name = name;
        this.symbols = symbols;        // a list of literal | regex class | nonterminal
        this.postprocess = postprocess;
        return this;
    }
    Rule.highestId = 0;

    Rule.prototype.toString = function(withCursorAt) {
        function stringifySymbolSequence (e) {
            return e.literal ? JSON.stringify(e.literal) :
                   e.type ? '%' + e.type : e.toString();
        }
        var symbolSequence = (typeof withCursorAt === "undefined")
                             ? this.symbols.map(stringifySymbolSequence).join(' ')
                             : (   this.symbols.slice(0, withCursorAt).map(stringifySymbolSequence).join(' ')
                                 + " ● "
                                 + this.symbols.slice(withCursorAt).map(stringifySymbolSequence).join(' ')     );
        return this.name + " → " + symbolSequence;
    }


    // a State is a rule at a position from a given starting point in the input stream (reference)
    function State(rule, dot, reference, wantedBy) {
        this.rule = rule;
        this.dot = dot;
        this.reference = reference;
        this.data = [];
        this.wantedBy = wantedBy;
        this.isComplete = this.dot === rule.symbols.length;
    }

    State.prototype.toString = function() {
        return "{" + this.rule.toString(this.dot) + "}, from: " + (this.reference || 0);
    };

    State.prototype.nextState = function(child) {
        var state = new State(this.rule, this.dot + 1, this.reference, this.wantedBy);
        state.left = this;
        state.right = child;
        if (state.isComplete) {
            state.data = state.build();
        }
        return state;
    };

    State.prototype.build = function() {
        var children = [];
        var node = this;
        do {
            children.push(node.right.data);
            node = node.left;
        } while (node.left);
        children.reverse();
        return children;
    };

    State.prototype.finish = function() {
        if (this.rule.postprocess) {
            this.data = this.rule.postprocess(this.data, this.reference, Parser.fail);
        }
    };


    function Column(grammar, index) {
        this.grammar = grammar;
        this.index = index;
        this.states = [];
        this.wants = {}; // states indexed by the non-terminal they expect
        this.scannable = []; // list of states that expect a token
        this.completed = {}; // states that are nullable
    }


    Column.prototype.process = function(nextColumn) {
        var states = this.states;
        var wants = this.wants;
        var completed = this.completed;

        for (var w = 0; w < states.length; w++) { // nb. we push() during iteration
            var state = states[w];

            if (state.isComplete) {
                state.finish();
                if (state.data !== Parser.fail) {
                    // complete
                    var wantedBy = state.wantedBy;
                    for (var i = wantedBy.length; i--; ) { // this line is hot
                        var left = wantedBy[i];
                        this.complete(left, state);
                    }

                    // special-case nullables
                    if (state.reference === this.index) {
                        // make sure future predictors of this rule get completed.
                        var exp = state.rule.name;
                        (this.completed[exp] = this.completed[exp] || []).push(state);
                    }
                }

            } else {
                // queue scannable states
                var exp = state.rule.symbols[state.dot];
                if (typeof exp !== 'string') {
                    this.scannable.push(state);
                    continue;
                }

                // predict
                if (wants[exp]) {
                    wants[exp].push(state);

                    if (completed.hasOwnProperty(exp)) {
                        var nulls = completed[exp];
                        for (var i = 0; i < nulls.length; i++) {
                            var right = nulls[i];
                            this.complete(state, right);
                        }
                    }
                } else {
                    wants[exp] = [state];
                    this.predict(exp);
                }
            }
        }
    }

    Column.prototype.predict = function(exp) {
        var rules = this.grammar.byName[exp] || [];

        for (var i = 0; i < rules.length; i++) {
            var r = rules[i];
            var wantedBy = this.wants[exp];
            var s = new State(r, 0, this.index, wantedBy);
            this.states.push(s);
        }
    }

    Column.prototype.complete = function(left, right) {
        var copy = left.nextState(right);
        this.states.push(copy);
    }


    function Grammar(rules, start) {
        this.rules = rules;
        this.start = start || this.rules[0].name;
        var byName = this.byName = {};
        this.rules.forEach(function(rule) {
            if (!byName.hasOwnProperty(rule.name)) {
                byName[rule.name] = [];
            }
            byName[rule.name].push(rule);
        });
    }

    // So we can allow passing (rules, start) directly to Parser for backwards compatibility
    Grammar.fromCompiled = function(rules, start) {
        var lexer = rules.Lexer;
        if (rules.ParserStart) {
          start = rules.ParserStart;
          rules = rules.ParserRules;
        }
        var rules = rules.map(function (r) { return (new Rule(r.name, r.symbols, r.postprocess)); });
        var g = new Grammar(rules, start);
        g.lexer = lexer; // nb. storing lexer on Grammar is iffy, but unavoidable
        return g;
    }


    function StreamLexer() {
      this.reset("");
    }

    StreamLexer.prototype.reset = function(data, state) {
        this.buffer = data;
        this.index = 0;
        this.line = state ? state.line : 1;
        this.lastLineBreak = state ? -state.col : 0;
    }

    StreamLexer.prototype.next = function() {
        if (this.index < this.buffer.length) {
            var ch = this.buffer[this.index++];
            if (ch === '\n') {
              this.line += 1;
              this.lastLineBreak = this.index;
            }
            return {value: ch};
        }
    }

    StreamLexer.prototype.save = function() {
      return {
        line: this.line,
        col: this.index - this.lastLineBreak,
      }
    }

    StreamLexer.prototype.formatError = function(token, message) {
        // nb. this gets called after consuming the offending token,
        // so the culprit is index-1
        var buffer = this.buffer;
        if (typeof buffer === 'string') {
            var nextLineBreak = buffer.indexOf('\n', this.index);
            if (nextLineBreak === -1) nextLineBreak = buffer.length;
            var line = buffer.substring(this.lastLineBreak, nextLineBreak)
            var col = this.index - this.lastLineBreak;
            message += " at line " + this.line + " col " + col + ":\n\n";
            message += "  " + line + "\n"
            message += "  " + Array(col).join(" ") + "^"
            return message;
        } else {
            return message + " at index " + (this.index - 1);
        }
    }


    function Parser(rules, start, options) {
        if (rules instanceof Grammar) {
            var grammar = rules;
            var options = start;
        } else {
            var grammar = Grammar.fromCompiled(rules, start);
        }
        this.grammar = grammar;

        // Read options
        this.options = {
            keepHistory: false,
            lexer: grammar.lexer || new StreamLexer,
        };
        for (var key in (options || {})) {
            this.options[key] = options[key];
        }

        // Setup lexer
        this.lexer = this.options.lexer;
        this.lexerState = undefined;

        // Setup a table
        var column = new Column(grammar, 0);
        var table = this.table = [column];

        // I could be expecting anything.
        column.wants[grammar.start] = [];
        column.predict(grammar.start);
        // TODO what if start rule is nullable?
        column.process();
        this.current = 0; // token index
    }

    // create a reserved token for indicating a parse fail
    Parser.fail = {};

    Parser.prototype.feed = function(chunk) {
        var lexer = this.lexer;
        lexer.reset(chunk, this.lexerState);

        var token;
        while (token = lexer.next()) {
            // We add new states to table[current+1]
            var column = this.table[this.current];

            // GC unused states
            if (!this.options.keepHistory) {
                delete this.table[this.current - 1];
            }

            var n = this.current + 1;
            var nextColumn = new Column(this.grammar, n);
            this.table.push(nextColumn);

            // Advance all tokens that expect the symbol
            var literal = token.text !== undefined ? token.text : token.value;
            var value = lexer.constructor === StreamLexer ? token.value : token;
            var scannable = column.scannable;
            for (var w = scannable.length; w--; ) {
                var state = scannable[w];
                var expect = state.rule.symbols[state.dot];
                // Try to consume the token
                // either regex or literal
                if (expect.test ? expect.test(value) :
                    expect.type ? expect.type === token.type
                                : expect.literal === literal) {
                    // Add it
                    var next = state.nextState({data: value, token: token, isToken: true, reference: n - 1});
                    nextColumn.states.push(next);
                }
            }

            // Next, for each of the rules, we either
            // (a) complete it, and try to see if the reference row expected that
            //     rule
            // (b) predict the next nonterminal it expects by adding that
            //     nonterminal's start state
            // To prevent duplication, we also keep track of rules we have already
            // added

            nextColumn.process();

            // If needed, throw an error:
            if (nextColumn.states.length === 0) {
                // No states at all! This is not good.
                var err = new Error(this.reportError(token));
                err.offset = this.current;
                err.token = token;
                throw err;
            }

            // maybe save lexer state
            if (this.options.keepHistory) {
              column.lexerState = lexer.save()
            }

            this.current++;
        }
        if (column) {
          this.lexerState = lexer.save()
        }

        // Incrementally keep track of results
        this.results = this.finish();

        // Allow chaining, for whatever it's worth
        return this;
    };

    Parser.prototype.reportError = function(token) {
        var lines = [];
        var tokenDisplay = (token.type ? token.type + " token: " : "") + JSON.stringify(token.value !== undefined ? token.value : token);
        lines.push(this.lexer.formatError(token, "Syntax error"));
        lines.push('Unexpected ' + tokenDisplay + '. Instead, I was expecting to see one of the following:\n');
        var lastColumnIndex = this.table.length - 2;
        var lastColumn = this.table[lastColumnIndex];
        var expectantStates = lastColumn.states
            .filter(function(state) {
                var nextSymbol = state.rule.symbols[state.dot];
                return nextSymbol && typeof nextSymbol !== "string";
            });
        
        // Display a "state stack" for each expectant state
        // - which shows you how this state came to be, step by step. 
        // If there is more than one derivation, we only display the first one.
        var stateStacks = expectantStates
            .map(function(state) {
                var stacks = this.buildStateStacks(state, []);
                return stacks[0];
            }, this);
        // Display each state that is expecting a terminal symbol next.
        stateStacks.forEach(function(stateStack) {
            var state = stateStack[0];
            var nextSymbol = state.rule.symbols[state.dot];
            var symbolDisplay = this.getSymbolDisplay(nextSymbol);
            lines.push('A ' + symbolDisplay + ' based on:');
            this.displayStateStack(stateStack, lines);
        }, this);
            
        lines.push("");
        return lines.join("\n");
    };

    Parser.prototype.displayStateStack = function(stateStack, lines) {
        var lastDisplay;
        var sameDisplayCount = 0;
        for (var j = 0; j < stateStack.length; j++) {
            var state = stateStack[j];
            var display = state.rule.toString(state.dot);
            if (display === lastDisplay) {
                sameDisplayCount++;
            } else {
                if (sameDisplayCount > 0) {
                    lines.push('    ⬆ ︎' + sameDisplayCount + ' more lines identical to this');
                }
                sameDisplayCount = 0;
                lines.push('    ' + display);
            }
            lastDisplay = display;
        }
    };

    Parser.prototype.getSymbolDisplay = function(symbol) {
        var type = typeof symbol;
        if (type === "string") {
            return symbol;
        } else if (type === "object" && symbol.literal) {
            return JSON.stringify(symbol.literal);
        } else if (type === "object" && symbol instanceof RegExp) {
            return 'character matching ' + symbol;
        } else if (type === "object" && symbol.type) {
            return symbol.type + ' token';
        } else {
            throw new Error('Unknown symbol type: ' + symbol);
        }
    };

    /*
    Builds a number of "state stacks". You can think of a state stack as the call stack
    of the recursive-descent parser which the Nearley parse algorithm simulates.
    A state stack is represented as an array of state objects. Within a 
    state stack, the first item of the array will be the starting
    state, with each successive item in the array going further back into history.
    
    This function needs to be given a starting state and an empty array representing
    the visited states, and it returns an array of state stacks. 
    
    */
    Parser.prototype.buildStateStacks = function(state, visited) {
        if (visited.indexOf(state) !== -1) {
            // Found cycle, return empty array (meaning no stacks)
            // to eliminate this path from the results, because
            // we don't know how to display it meaningfully
            return [];
        }
        if (state.wantedBy.length === 0) {
            return [[state]];
        }
        var that = this;

        return state.wantedBy.reduce(function(stacks, prevState) {
            return stacks.concat(that.buildStateStacks(
                prevState,
                [state].concat(visited))
                .map(function(stack) {
                    return [state].concat(stack);
                }));
        }, []);
    };

    Parser.prototype.save = function() {
        var column = this.table[this.current];
        column.lexerState = this.lexerState;
        return column;
    };

    Parser.prototype.restore = function(column) {
        var index = column.index;
        this.current = index;
        this.table[index] = column;
        this.table.splice(index + 1);
        this.lexerState = column.lexerState;

        // Incrementally keep track of results
        this.results = this.finish();
    };

    // nb. deprecated: use save/restore instead!
    Parser.prototype.rewind = function(index) {
        if (!this.options.keepHistory) {
            throw new Error('set option `keepHistory` to enable rewinding')
        }
        // nb. recall column (table) indicies fall between token indicies.
        //        col 0   --   token 0   --   col 1
        this.restore(this.table[index]);
    };

    Parser.prototype.finish = function() {
        // Return the possible parsings
        var considerations = [];
        var start = this.grammar.start;
        var column = this.table[this.table.length - 1]
        column.states.forEach(function (t) {
            if (t.rule.name === start
                    && t.dot === t.rule.symbols.length
                    && t.reference === 0
                    && t.data !== Parser.fail) {
                considerations.push(t);
            }
        });
        return considerations.map(function(c) {return c.data; });
    };

    return {
        Parser: Parser,
        Grammar: Grammar,
        Rule: Rule,
    };

}));


/***/ }),

/***/ "./node_modules/path-browserify/index.js":
/*!***********************************************!*\
  !*** ./node_modules/path-browserify/index.js ***!
  \***********************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

/* WEBPACK VAR INJECTION */(function(process) {// .dirname, .basename, and .extname methods are extracted from Node.js v8.11.1,
// backported and transplited with Babel, with backwards-compat fixes

// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
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
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
  var resolvedPath = '',
      resolvedAbsolute = false;

  for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    var path = (i >= 0) ? arguments[i] : process.cwd();

    // Skip empty and invalid entries
    if (typeof path !== 'string') {
      throw new TypeError('Arguments to path.resolve must be strings');
    } else if (!path) {
      continue;
    }

    resolvedPath = path + '/' + resolvedPath;
    resolvedAbsolute = path.charAt(0) === '/';
  }

  // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe (might happen when process.cwd() fails)

  // Normalize the path
  resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
  var isAbsolute = exports.isAbsolute(path),
      trailingSlash = substr(path, -1) === '/';

  // Normalize the path
  path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }

  return (isAbsolute ? '/' : '') + path;
};

// posix version
exports.isAbsolute = function(path) {
  return path.charAt(0) === '/';
};

// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    if (typeof p !== 'string') {
      throw new TypeError('Arguments to path.join must be strings');
    }
    return p;
  }).join('/'));
};


// path.relative(from, to)
// posix version
exports.relative = function(from, to) {
  from = exports.resolve(from).substr(1);
  to = exports.resolve(to).substr(1);

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
};

exports.sep = '/';
exports.delimiter = ':';

exports.dirname = function (path) {
  if (typeof path !== 'string') path = path + '';
  if (path.length === 0) return '.';
  var code = path.charCodeAt(0);
  var hasRoot = code === 47 /*/*/;
  var end = -1;
  var matchedSlash = true;
  for (var i = path.length - 1; i >= 1; --i) {
    code = path.charCodeAt(i);
    if (code === 47 /*/*/) {
        if (!matchedSlash) {
          end = i;
          break;
        }
      } else {
      // We saw the first non-path separator
      matchedSlash = false;
    }
  }

  if (end === -1) return hasRoot ? '/' : '.';
  if (hasRoot && end === 1) {
    // return '//';
    // Backwards-compat fix:
    return '/';
  }
  return path.slice(0, end);
};

function basename(path) {
  if (typeof path !== 'string') path = path + '';

  var start = 0;
  var end = -1;
  var matchedSlash = true;
  var i;

  for (i = path.length - 1; i >= 0; --i) {
    if (path.charCodeAt(i) === 47 /*/*/) {
        // If we reached a path separator that was not part of a set of path
        // separators at the end of the string, stop now
        if (!matchedSlash) {
          start = i + 1;
          break;
        }
      } else if (end === -1) {
      // We saw the first non-path separator, mark this as the end of our
      // path component
      matchedSlash = false;
      end = i + 1;
    }
  }

  if (end === -1) return '';
  return path.slice(start, end);
}

// Uses a mixed approach for backwards-compatibility, as ext behavior changed
// in new Node.js versions, so only basename() above is backported here
exports.basename = function (path, ext) {
  var f = basename(path);
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};

exports.extname = function (path) {
  if (typeof path !== 'string') path = path + '';
  var startDot = -1;
  var startPart = 0;
  var end = -1;
  var matchedSlash = true;
  // Track the state of characters (if any) we see before our first dot and
  // after any path separator we find
  var preDotState = 0;
  for (var i = path.length - 1; i >= 0; --i) {
    var code = path.charCodeAt(i);
    if (code === 47 /*/*/) {
        // If we reached a path separator that was not part of a set of path
        // separators at the end of the string, stop now
        if (!matchedSlash) {
          startPart = i + 1;
          break;
        }
        continue;
      }
    if (end === -1) {
      // We saw the first non-path separator, mark this as the end of our
      // extension
      matchedSlash = false;
      end = i + 1;
    }
    if (code === 46 /*.*/) {
        // If this is our first dot, mark it as the start of our extension
        if (startDot === -1)
          startDot = i;
        else if (preDotState !== 1)
          preDotState = 1;
    } else if (startDot !== -1) {
      // We saw a non-dot and non-path separator before our dot, so we should
      // have a good chance at having a non-empty extension
      preDotState = -1;
    }
  }

  if (startDot === -1 || end === -1 ||
      // We saw a non-dot character immediately before the dot
      preDotState === 0 ||
      // The (right-most) trimmed path component is exactly '..'
      preDotState === 1 && startDot === end - 1 && startDot === startPart + 1) {
    return '';
  }
  return path.slice(startDot, end);
};

function filter (xs, f) {
    if (xs.filter) return xs.filter(f);
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (f(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// String.prototype.substr - negative index don't work in IE8
var substr = 'ab'.substr(-1) === 'b'
    ? function (str, start, len) { return str.substr(start, len) }
    : function (str, start, len) {
        if (start < 0) start = str.length + start;
        return str.substr(start, len);
    }
;

/* WEBPACK VAR INJECTION */}.call(this, __webpack_require__(/*! ./../process/browser.js */ "./node_modules/process/browser.js")))

/***/ }),

/***/ "./node_modules/process/browser.js":
/*!*****************************************!*\
  !*** ./node_modules/process/browser.js ***!
  \*****************************************/
/*! no static exports found */
/***/ (function(module, exports) {

// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };


/***/ }),

/***/ "./node_modules/semver/semver.js":
/*!***************************************!*\
  !*** ./node_modules/semver/semver.js ***!
  \***************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

/* WEBPACK VAR INJECTION */(function(process) {exports = module.exports = SemVer

var debug
/* istanbul ignore next */
if (typeof process === 'object' &&
    process.env &&
    process.env.NODE_DEBUG &&
    /\bsemver\b/i.test(process.env.NODE_DEBUG)) {
  debug = function () {
    var args = Array.prototype.slice.call(arguments, 0)
    args.unshift('SEMVER')
    console.log.apply(console, args)
  }
} else {
  debug = function () {}
}

// Note: this is the semver.org version of the spec that it implements
// Not necessarily the package version of this code.
exports.SEMVER_SPEC_VERSION = '2.0.0'

var MAX_LENGTH = 256
var MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER ||
  /* istanbul ignore next */ 9007199254740991

// Max safe segment length for coercion.
var MAX_SAFE_COMPONENT_LENGTH = 16

// The actual regexps go on exports.re
var re = exports.re = []
var src = exports.src = []
var R = 0

// The following Regular Expressions can be used for tokenizing,
// validating, and parsing SemVer version strings.

// ## Numeric Identifier
// A single `0`, or a non-zero digit followed by zero or more digits.

var NUMERICIDENTIFIER = R++
src[NUMERICIDENTIFIER] = '0|[1-9]\\d*'
var NUMERICIDENTIFIERLOOSE = R++
src[NUMERICIDENTIFIERLOOSE] = '[0-9]+'

// ## Non-numeric Identifier
// Zero or more digits, followed by a letter or hyphen, and then zero or
// more letters, digits, or hyphens.

var NONNUMERICIDENTIFIER = R++
src[NONNUMERICIDENTIFIER] = '\\d*[a-zA-Z-][a-zA-Z0-9-]*'

// ## Main Version
// Three dot-separated numeric identifiers.

var MAINVERSION = R++
src[MAINVERSION] = '(' + src[NUMERICIDENTIFIER] + ')\\.' +
                   '(' + src[NUMERICIDENTIFIER] + ')\\.' +
                   '(' + src[NUMERICIDENTIFIER] + ')'

var MAINVERSIONLOOSE = R++
src[MAINVERSIONLOOSE] = '(' + src[NUMERICIDENTIFIERLOOSE] + ')\\.' +
                        '(' + src[NUMERICIDENTIFIERLOOSE] + ')\\.' +
                        '(' + src[NUMERICIDENTIFIERLOOSE] + ')'

// ## Pre-release Version Identifier
// A numeric identifier, or a non-numeric identifier.

var PRERELEASEIDENTIFIER = R++
src[PRERELEASEIDENTIFIER] = '(?:' + src[NUMERICIDENTIFIER] +
                            '|' + src[NONNUMERICIDENTIFIER] + ')'

var PRERELEASEIDENTIFIERLOOSE = R++
src[PRERELEASEIDENTIFIERLOOSE] = '(?:' + src[NUMERICIDENTIFIERLOOSE] +
                                 '|' + src[NONNUMERICIDENTIFIER] + ')'

// ## Pre-release Version
// Hyphen, followed by one or more dot-separated pre-release version
// identifiers.

var PRERELEASE = R++
src[PRERELEASE] = '(?:-(' + src[PRERELEASEIDENTIFIER] +
                  '(?:\\.' + src[PRERELEASEIDENTIFIER] + ')*))'

var PRERELEASELOOSE = R++
src[PRERELEASELOOSE] = '(?:-?(' + src[PRERELEASEIDENTIFIERLOOSE] +
                       '(?:\\.' + src[PRERELEASEIDENTIFIERLOOSE] + ')*))'

// ## Build Metadata Identifier
// Any combination of digits, letters, or hyphens.

var BUILDIDENTIFIER = R++
src[BUILDIDENTIFIER] = '[0-9A-Za-z-]+'

// ## Build Metadata
// Plus sign, followed by one or more period-separated build metadata
// identifiers.

var BUILD = R++
src[BUILD] = '(?:\\+(' + src[BUILDIDENTIFIER] +
             '(?:\\.' + src[BUILDIDENTIFIER] + ')*))'

// ## Full Version String
// A main version, followed optionally by a pre-release version and
// build metadata.

// Note that the only major, minor, patch, and pre-release sections of
// the version string are capturing groups.  The build metadata is not a
// capturing group, because it should not ever be used in version
// comparison.

var FULL = R++
var FULLPLAIN = 'v?' + src[MAINVERSION] +
                src[PRERELEASE] + '?' +
                src[BUILD] + '?'

src[FULL] = '^' + FULLPLAIN + '$'

// like full, but allows v1.2.3 and =1.2.3, which people do sometimes.
// also, 1.0.0alpha1 (prerelease without the hyphen) which is pretty
// common in the npm registry.
var LOOSEPLAIN = '[v=\\s]*' + src[MAINVERSIONLOOSE] +
                 src[PRERELEASELOOSE] + '?' +
                 src[BUILD] + '?'

var LOOSE = R++
src[LOOSE] = '^' + LOOSEPLAIN + '$'

var GTLT = R++
src[GTLT] = '((?:<|>)?=?)'

// Something like "2.*" or "1.2.x".
// Note that "x.x" is a valid xRange identifer, meaning "any version"
// Only the first item is strictly required.
var XRANGEIDENTIFIERLOOSE = R++
src[XRANGEIDENTIFIERLOOSE] = src[NUMERICIDENTIFIERLOOSE] + '|x|X|\\*'
var XRANGEIDENTIFIER = R++
src[XRANGEIDENTIFIER] = src[NUMERICIDENTIFIER] + '|x|X|\\*'

var XRANGEPLAIN = R++
src[XRANGEPLAIN] = '[v=\\s]*(' + src[XRANGEIDENTIFIER] + ')' +
                   '(?:\\.(' + src[XRANGEIDENTIFIER] + ')' +
                   '(?:\\.(' + src[XRANGEIDENTIFIER] + ')' +
                   '(?:' + src[PRERELEASE] + ')?' +
                   src[BUILD] + '?' +
                   ')?)?'

var XRANGEPLAINLOOSE = R++
src[XRANGEPLAINLOOSE] = '[v=\\s]*(' + src[XRANGEIDENTIFIERLOOSE] + ')' +
                        '(?:\\.(' + src[XRANGEIDENTIFIERLOOSE] + ')' +
                        '(?:\\.(' + src[XRANGEIDENTIFIERLOOSE] + ')' +
                        '(?:' + src[PRERELEASELOOSE] + ')?' +
                        src[BUILD] + '?' +
                        ')?)?'

var XRANGE = R++
src[XRANGE] = '^' + src[GTLT] + '\\s*' + src[XRANGEPLAIN] + '$'
var XRANGELOOSE = R++
src[XRANGELOOSE] = '^' + src[GTLT] + '\\s*' + src[XRANGEPLAINLOOSE] + '$'

// Coercion.
// Extract anything that could conceivably be a part of a valid semver
var COERCE = R++
src[COERCE] = '(?:^|[^\\d])' +
              '(\\d{1,' + MAX_SAFE_COMPONENT_LENGTH + '})' +
              '(?:\\.(\\d{1,' + MAX_SAFE_COMPONENT_LENGTH + '}))?' +
              '(?:\\.(\\d{1,' + MAX_SAFE_COMPONENT_LENGTH + '}))?' +
              '(?:$|[^\\d])'

// Tilde ranges.
// Meaning is "reasonably at or greater than"
var LONETILDE = R++
src[LONETILDE] = '(?:~>?)'

var TILDETRIM = R++
src[TILDETRIM] = '(\\s*)' + src[LONETILDE] + '\\s+'
re[TILDETRIM] = new RegExp(src[TILDETRIM], 'g')
var tildeTrimReplace = '$1~'

var TILDE = R++
src[TILDE] = '^' + src[LONETILDE] + src[XRANGEPLAIN] + '$'
var TILDELOOSE = R++
src[TILDELOOSE] = '^' + src[LONETILDE] + src[XRANGEPLAINLOOSE] + '$'

// Caret ranges.
// Meaning is "at least and backwards compatible with"
var LONECARET = R++
src[LONECARET] = '(?:\\^)'

var CARETTRIM = R++
src[CARETTRIM] = '(\\s*)' + src[LONECARET] + '\\s+'
re[CARETTRIM] = new RegExp(src[CARETTRIM], 'g')
var caretTrimReplace = '$1^'

var CARET = R++
src[CARET] = '^' + src[LONECARET] + src[XRANGEPLAIN] + '$'
var CARETLOOSE = R++
src[CARETLOOSE] = '^' + src[LONECARET] + src[XRANGEPLAINLOOSE] + '$'

// A simple gt/lt/eq thing, or just "" to indicate "any version"
var COMPARATORLOOSE = R++
src[COMPARATORLOOSE] = '^' + src[GTLT] + '\\s*(' + LOOSEPLAIN + ')$|^$'
var COMPARATOR = R++
src[COMPARATOR] = '^' + src[GTLT] + '\\s*(' + FULLPLAIN + ')$|^$'

// An expression to strip any whitespace between the gtlt and the thing
// it modifies, so that `> 1.2.3` ==> `>1.2.3`
var COMPARATORTRIM = R++
src[COMPARATORTRIM] = '(\\s*)' + src[GTLT] +
                      '\\s*(' + LOOSEPLAIN + '|' + src[XRANGEPLAIN] + ')'

// this one has to use the /g flag
re[COMPARATORTRIM] = new RegExp(src[COMPARATORTRIM], 'g')
var comparatorTrimReplace = '$1$2$3'

// Something like `1.2.3 - 1.2.4`
// Note that these all use the loose form, because they'll be
// checked against either the strict or loose comparator form
// later.
var HYPHENRANGE = R++
src[HYPHENRANGE] = '^\\s*(' + src[XRANGEPLAIN] + ')' +
                   '\\s+-\\s+' +
                   '(' + src[XRANGEPLAIN] + ')' +
                   '\\s*$'

var HYPHENRANGELOOSE = R++
src[HYPHENRANGELOOSE] = '^\\s*(' + src[XRANGEPLAINLOOSE] + ')' +
                        '\\s+-\\s+' +
                        '(' + src[XRANGEPLAINLOOSE] + ')' +
                        '\\s*$'

// Star ranges basically just allow anything at all.
var STAR = R++
src[STAR] = '(<|>)?=?\\s*\\*'

// Compile to actual regexp objects.
// All are flag-free, unless they were created above with a flag.
for (var i = 0; i < R; i++) {
  debug(i, src[i])
  if (!re[i]) {
    re[i] = new RegExp(src[i])
  }
}

exports.parse = parse
function parse (version, options) {
  if (!options || typeof options !== 'object') {
    options = {
      loose: !!options,
      includePrerelease: false
    }
  }

  if (version instanceof SemVer) {
    return version
  }

  if (typeof version !== 'string') {
    return null
  }

  if (version.length > MAX_LENGTH) {
    return null
  }

  var r = options.loose ? re[LOOSE] : re[FULL]
  if (!r.test(version)) {
    return null
  }

  try {
    return new SemVer(version, options)
  } catch (er) {
    return null
  }
}

exports.valid = valid
function valid (version, options) {
  var v = parse(version, options)
  return v ? v.version : null
}

exports.clean = clean
function clean (version, options) {
  var s = parse(version.trim().replace(/^[=v]+/, ''), options)
  return s ? s.version : null
}

exports.SemVer = SemVer

function SemVer (version, options) {
  if (!options || typeof options !== 'object') {
    options = {
      loose: !!options,
      includePrerelease: false
    }
  }
  if (version instanceof SemVer) {
    if (version.loose === options.loose) {
      return version
    } else {
      version = version.version
    }
  } else if (typeof version !== 'string') {
    throw new TypeError('Invalid Version: ' + version)
  }

  if (version.length > MAX_LENGTH) {
    throw new TypeError('version is longer than ' + MAX_LENGTH + ' characters')
  }

  if (!(this instanceof SemVer)) {
    return new SemVer(version, options)
  }

  debug('SemVer', version, options)
  this.options = options
  this.loose = !!options.loose

  var m = version.trim().match(options.loose ? re[LOOSE] : re[FULL])

  if (!m) {
    throw new TypeError('Invalid Version: ' + version)
  }

  this.raw = version

  // these are actually numbers
  this.major = +m[1]
  this.minor = +m[2]
  this.patch = +m[3]

  if (this.major > MAX_SAFE_INTEGER || this.major < 0) {
    throw new TypeError('Invalid major version')
  }

  if (this.minor > MAX_SAFE_INTEGER || this.minor < 0) {
    throw new TypeError('Invalid minor version')
  }

  if (this.patch > MAX_SAFE_INTEGER || this.patch < 0) {
    throw new TypeError('Invalid patch version')
  }

  // numberify any prerelease numeric ids
  if (!m[4]) {
    this.prerelease = []
  } else {
    this.prerelease = m[4].split('.').map(function (id) {
      if (/^[0-9]+$/.test(id)) {
        var num = +id
        if (num >= 0 && num < MAX_SAFE_INTEGER) {
          return num
        }
      }
      return id
    })
  }

  this.build = m[5] ? m[5].split('.') : []
  this.format()
}

SemVer.prototype.format = function () {
  this.version = this.major + '.' + this.minor + '.' + this.patch
  if (this.prerelease.length) {
    this.version += '-' + this.prerelease.join('.')
  }
  return this.version
}

SemVer.prototype.toString = function () {
  return this.version
}

SemVer.prototype.compare = function (other) {
  debug('SemVer.compare', this.version, this.options, other)
  if (!(other instanceof SemVer)) {
    other = new SemVer(other, this.options)
  }

  return this.compareMain(other) || this.comparePre(other)
}

SemVer.prototype.compareMain = function (other) {
  if (!(other instanceof SemVer)) {
    other = new SemVer(other, this.options)
  }

  return compareIdentifiers(this.major, other.major) ||
         compareIdentifiers(this.minor, other.minor) ||
         compareIdentifiers(this.patch, other.patch)
}

SemVer.prototype.comparePre = function (other) {
  if (!(other instanceof SemVer)) {
    other = new SemVer(other, this.options)
  }

  // NOT having a prerelease is > having one
  if (this.prerelease.length && !other.prerelease.length) {
    return -1
  } else if (!this.prerelease.length && other.prerelease.length) {
    return 1
  } else if (!this.prerelease.length && !other.prerelease.length) {
    return 0
  }

  var i = 0
  do {
    var a = this.prerelease[i]
    var b = other.prerelease[i]
    debug('prerelease compare', i, a, b)
    if (a === undefined && b === undefined) {
      return 0
    } else if (b === undefined) {
      return 1
    } else if (a === undefined) {
      return -1
    } else if (a === b) {
      continue
    } else {
      return compareIdentifiers(a, b)
    }
  } while (++i)
}

// preminor will bump the version up to the next minor release, and immediately
// down to pre-release. premajor and prepatch work the same way.
SemVer.prototype.inc = function (release, identifier) {
  switch (release) {
    case 'premajor':
      this.prerelease.length = 0
      this.patch = 0
      this.minor = 0
      this.major++
      this.inc('pre', identifier)
      break
    case 'preminor':
      this.prerelease.length = 0
      this.patch = 0
      this.minor++
      this.inc('pre', identifier)
      break
    case 'prepatch':
      // If this is already a prerelease, it will bump to the next version
      // drop any prereleases that might already exist, since they are not
      // relevant at this point.
      this.prerelease.length = 0
      this.inc('patch', identifier)
      this.inc('pre', identifier)
      break
    // If the input is a non-prerelease version, this acts the same as
    // prepatch.
    case 'prerelease':
      if (this.prerelease.length === 0) {
        this.inc('patch', identifier)
      }
      this.inc('pre', identifier)
      break

    case 'major':
      // If this is a pre-major version, bump up to the same major version.
      // Otherwise increment major.
      // 1.0.0-5 bumps to 1.0.0
      // 1.1.0 bumps to 2.0.0
      if (this.minor !== 0 ||
          this.patch !== 0 ||
          this.prerelease.length === 0) {
        this.major++
      }
      this.minor = 0
      this.patch = 0
      this.prerelease = []
      break
    case 'minor':
      // If this is a pre-minor version, bump up to the same minor version.
      // Otherwise increment minor.
      // 1.2.0-5 bumps to 1.2.0
      // 1.2.1 bumps to 1.3.0
      if (this.patch !== 0 || this.prerelease.length === 0) {
        this.minor++
      }
      this.patch = 0
      this.prerelease = []
      break
    case 'patch':
      // If this is not a pre-release version, it will increment the patch.
      // If it is a pre-release it will bump up to the same patch version.
      // 1.2.0-5 patches to 1.2.0
      // 1.2.0 patches to 1.2.1
      if (this.prerelease.length === 0) {
        this.patch++
      }
      this.prerelease = []
      break
    // This probably shouldn't be used publicly.
    // 1.0.0 "pre" would become 1.0.0-0 which is the wrong direction.
    case 'pre':
      if (this.prerelease.length === 0) {
        this.prerelease = [0]
      } else {
        var i = this.prerelease.length
        while (--i >= 0) {
          if (typeof this.prerelease[i] === 'number') {
            this.prerelease[i]++
            i = -2
          }
        }
        if (i === -1) {
          // didn't increment anything
          this.prerelease.push(0)
        }
      }
      if (identifier) {
        // 1.2.0-beta.1 bumps to 1.2.0-beta.2,
        // 1.2.0-beta.fooblz or 1.2.0-beta bumps to 1.2.0-beta.0
        if (this.prerelease[0] === identifier) {
          if (isNaN(this.prerelease[1])) {
            this.prerelease = [identifier, 0]
          }
        } else {
          this.prerelease = [identifier, 0]
        }
      }
      break

    default:
      throw new Error('invalid increment argument: ' + release)
  }
  this.format()
  this.raw = this.version
  return this
}

exports.inc = inc
function inc (version, release, loose, identifier) {
  if (typeof (loose) === 'string') {
    identifier = loose
    loose = undefined
  }

  try {
    return new SemVer(version, loose).inc(release, identifier).version
  } catch (er) {
    return null
  }
}

exports.diff = diff
function diff (version1, version2) {
  if (eq(version1, version2)) {
    return null
  } else {
    var v1 = parse(version1)
    var v2 = parse(version2)
    var prefix = ''
    if (v1.prerelease.length || v2.prerelease.length) {
      prefix = 'pre'
      var defaultResult = 'prerelease'
    }
    for (var key in v1) {
      if (key === 'major' || key === 'minor' || key === 'patch') {
        if (v1[key] !== v2[key]) {
          return prefix + key
        }
      }
    }
    return defaultResult // may be undefined
  }
}

exports.compareIdentifiers = compareIdentifiers

var numeric = /^[0-9]+$/
function compareIdentifiers (a, b) {
  var anum = numeric.test(a)
  var bnum = numeric.test(b)

  if (anum && bnum) {
    a = +a
    b = +b
  }

  return a === b ? 0
    : (anum && !bnum) ? -1
    : (bnum && !anum) ? 1
    : a < b ? -1
    : 1
}

exports.rcompareIdentifiers = rcompareIdentifiers
function rcompareIdentifiers (a, b) {
  return compareIdentifiers(b, a)
}

exports.major = major
function major (a, loose) {
  return new SemVer(a, loose).major
}

exports.minor = minor
function minor (a, loose) {
  return new SemVer(a, loose).minor
}

exports.patch = patch
function patch (a, loose) {
  return new SemVer(a, loose).patch
}

exports.compare = compare
function compare (a, b, loose) {
  return new SemVer(a, loose).compare(new SemVer(b, loose))
}

exports.compareLoose = compareLoose
function compareLoose (a, b) {
  return compare(a, b, true)
}

exports.rcompare = rcompare
function rcompare (a, b, loose) {
  return compare(b, a, loose)
}

exports.sort = sort
function sort (list, loose) {
  return list.sort(function (a, b) {
    return exports.compare(a, b, loose)
  })
}

exports.rsort = rsort
function rsort (list, loose) {
  return list.sort(function (a, b) {
    return exports.rcompare(a, b, loose)
  })
}

exports.gt = gt
function gt (a, b, loose) {
  return compare(a, b, loose) > 0
}

exports.lt = lt
function lt (a, b, loose) {
  return compare(a, b, loose) < 0
}

exports.eq = eq
function eq (a, b, loose) {
  return compare(a, b, loose) === 0
}

exports.neq = neq
function neq (a, b, loose) {
  return compare(a, b, loose) !== 0
}

exports.gte = gte
function gte (a, b, loose) {
  return compare(a, b, loose) >= 0
}

exports.lte = lte
function lte (a, b, loose) {
  return compare(a, b, loose) <= 0
}

exports.cmp = cmp
function cmp (a, op, b, loose) {
  switch (op) {
    case '===':
      if (typeof a === 'object')
        a = a.version
      if (typeof b === 'object')
        b = b.version
      return a === b

    case '!==':
      if (typeof a === 'object')
        a = a.version
      if (typeof b === 'object')
        b = b.version
      return a !== b

    case '':
    case '=':
    case '==':
      return eq(a, b, loose)

    case '!=':
      return neq(a, b, loose)

    case '>':
      return gt(a, b, loose)

    case '>=':
      return gte(a, b, loose)

    case '<':
      return lt(a, b, loose)

    case '<=':
      return lte(a, b, loose)

    default:
      throw new TypeError('Invalid operator: ' + op)
  }
}

exports.Comparator = Comparator
function Comparator (comp, options) {
  if (!options || typeof options !== 'object') {
    options = {
      loose: !!options,
      includePrerelease: false
    }
  }

  if (comp instanceof Comparator) {
    if (comp.loose === !!options.loose) {
      return comp
    } else {
      comp = comp.value
    }
  }

  if (!(this instanceof Comparator)) {
    return new Comparator(comp, options)
  }

  debug('comparator', comp, options)
  this.options = options
  this.loose = !!options.loose
  this.parse(comp)

  if (this.semver === ANY) {
    this.value = ''
  } else {
    this.value = this.operator + this.semver.version
  }

  debug('comp', this)
}

var ANY = {}
Comparator.prototype.parse = function (comp) {
  var r = this.options.loose ? re[COMPARATORLOOSE] : re[COMPARATOR]
  var m = comp.match(r)

  if (!m) {
    throw new TypeError('Invalid comparator: ' + comp)
  }

  this.operator = m[1]
  if (this.operator === '=') {
    this.operator = ''
  }

  // if it literally is just '>' or '' then allow anything.
  if (!m[2]) {
    this.semver = ANY
  } else {
    this.semver = new SemVer(m[2], this.options.loose)
  }
}

Comparator.prototype.toString = function () {
  return this.value
}

Comparator.prototype.test = function (version) {
  debug('Comparator.test', version, this.options.loose)

  if (this.semver === ANY) {
    return true
  }

  if (typeof version === 'string') {
    version = new SemVer(version, this.options)
  }

  return cmp(version, this.operator, this.semver, this.options)
}

Comparator.prototype.intersects = function (comp, options) {
  if (!(comp instanceof Comparator)) {
    throw new TypeError('a Comparator is required')
  }

  if (!options || typeof options !== 'object') {
    options = {
      loose: !!options,
      includePrerelease: false
    }
  }

  var rangeTmp

  if (this.operator === '') {
    rangeTmp = new Range(comp.value, options)
    return satisfies(this.value, rangeTmp, options)
  } else if (comp.operator === '') {
    rangeTmp = new Range(this.value, options)
    return satisfies(comp.semver, rangeTmp, options)
  }

  var sameDirectionIncreasing =
    (this.operator === '>=' || this.operator === '>') &&
    (comp.operator === '>=' || comp.operator === '>')
  var sameDirectionDecreasing =
    (this.operator === '<=' || this.operator === '<') &&
    (comp.operator === '<=' || comp.operator === '<')
  var sameSemVer = this.semver.version === comp.semver.version
  var differentDirectionsInclusive =
    (this.operator === '>=' || this.operator === '<=') &&
    (comp.operator === '>=' || comp.operator === '<=')
  var oppositeDirectionsLessThan =
    cmp(this.semver, '<', comp.semver, options) &&
    ((this.operator === '>=' || this.operator === '>') &&
    (comp.operator === '<=' || comp.operator === '<'))
  var oppositeDirectionsGreaterThan =
    cmp(this.semver, '>', comp.semver, options) &&
    ((this.operator === '<=' || this.operator === '<') &&
    (comp.operator === '>=' || comp.operator === '>'))

  return sameDirectionIncreasing || sameDirectionDecreasing ||
    (sameSemVer && differentDirectionsInclusive) ||
    oppositeDirectionsLessThan || oppositeDirectionsGreaterThan
}

exports.Range = Range
function Range (range, options) {
  if (!options || typeof options !== 'object') {
    options = {
      loose: !!options,
      includePrerelease: false
    }
  }

  if (range instanceof Range) {
    if (range.loose === !!options.loose &&
        range.includePrerelease === !!options.includePrerelease) {
      return range
    } else {
      return new Range(range.raw, options)
    }
  }

  if (range instanceof Comparator) {
    return new Range(range.value, options)
  }

  if (!(this instanceof Range)) {
    return new Range(range, options)
  }

  this.options = options
  this.loose = !!options.loose
  this.includePrerelease = !!options.includePrerelease

  // First, split based on boolean or ||
  this.raw = range
  this.set = range.split(/\s*\|\|\s*/).map(function (range) {
    return this.parseRange(range.trim())
  }, this).filter(function (c) {
    // throw out any that are not relevant for whatever reason
    return c.length
  })

  if (!this.set.length) {
    throw new TypeError('Invalid SemVer Range: ' + range)
  }

  this.format()
}

Range.prototype.format = function () {
  this.range = this.set.map(function (comps) {
    return comps.join(' ').trim()
  }).join('||').trim()
  return this.range
}

Range.prototype.toString = function () {
  return this.range
}

Range.prototype.parseRange = function (range) {
  var loose = this.options.loose
  range = range.trim()
  // `1.2.3 - 1.2.4` => `>=1.2.3 <=1.2.4`
  var hr = loose ? re[HYPHENRANGELOOSE] : re[HYPHENRANGE]
  range = range.replace(hr, hyphenReplace)
  debug('hyphen replace', range)
  // `> 1.2.3 < 1.2.5` => `>1.2.3 <1.2.5`
  range = range.replace(re[COMPARATORTRIM], comparatorTrimReplace)
  debug('comparator trim', range, re[COMPARATORTRIM])

  // `~ 1.2.3` => `~1.2.3`
  range = range.replace(re[TILDETRIM], tildeTrimReplace)

  // `^ 1.2.3` => `^1.2.3`
  range = range.replace(re[CARETTRIM], caretTrimReplace)

  // normalize spaces
  range = range.split(/\s+/).join(' ')

  // At this point, the range is completely trimmed and
  // ready to be split into comparators.

  var compRe = loose ? re[COMPARATORLOOSE] : re[COMPARATOR]
  var set = range.split(' ').map(function (comp) {
    return parseComparator(comp, this.options)
  }, this).join(' ').split(/\s+/)
  if (this.options.loose) {
    // in loose mode, throw out any that are not valid comparators
    set = set.filter(function (comp) {
      return !!comp.match(compRe)
    })
  }
  set = set.map(function (comp) {
    return new Comparator(comp, this.options)
  }, this)

  return set
}

Range.prototype.intersects = function (range, options) {
  if (!(range instanceof Range)) {
    throw new TypeError('a Range is required')
  }

  return this.set.some(function (thisComparators) {
    return thisComparators.every(function (thisComparator) {
      return range.set.some(function (rangeComparators) {
        return rangeComparators.every(function (rangeComparator) {
          return thisComparator.intersects(rangeComparator, options)
        })
      })
    })
  })
}

// Mostly just for testing and legacy API reasons
exports.toComparators = toComparators
function toComparators (range, options) {
  return new Range(range, options).set.map(function (comp) {
    return comp.map(function (c) {
      return c.value
    }).join(' ').trim().split(' ')
  })
}

// comprised of xranges, tildes, stars, and gtlt's at this point.
// already replaced the hyphen ranges
// turn into a set of JUST comparators.
function parseComparator (comp, options) {
  debug('comp', comp, options)
  comp = replaceCarets(comp, options)
  debug('caret', comp)
  comp = replaceTildes(comp, options)
  debug('tildes', comp)
  comp = replaceXRanges(comp, options)
  debug('xrange', comp)
  comp = replaceStars(comp, options)
  debug('stars', comp)
  return comp
}

function isX (id) {
  return !id || id.toLowerCase() === 'x' || id === '*'
}

// ~, ~> --> * (any, kinda silly)
// ~2, ~2.x, ~2.x.x, ~>2, ~>2.x ~>2.x.x --> >=2.0.0 <3.0.0
// ~2.0, ~2.0.x, ~>2.0, ~>2.0.x --> >=2.0.0 <2.1.0
// ~1.2, ~1.2.x, ~>1.2, ~>1.2.x --> >=1.2.0 <1.3.0
// ~1.2.3, ~>1.2.3 --> >=1.2.3 <1.3.0
// ~1.2.0, ~>1.2.0 --> >=1.2.0 <1.3.0
function replaceTildes (comp, options) {
  return comp.trim().split(/\s+/).map(function (comp) {
    return replaceTilde(comp, options)
  }).join(' ')
}

function replaceTilde (comp, options) {
  var r = options.loose ? re[TILDELOOSE] : re[TILDE]
  return comp.replace(r, function (_, M, m, p, pr) {
    debug('tilde', comp, _, M, m, p, pr)
    var ret

    if (isX(M)) {
      ret = ''
    } else if (isX(m)) {
      ret = '>=' + M + '.0.0 <' + (+M + 1) + '.0.0'
    } else if (isX(p)) {
      // ~1.2 == >=1.2.0 <1.3.0
      ret = '>=' + M + '.' + m + '.0 <' + M + '.' + (+m + 1) + '.0'
    } else if (pr) {
      debug('replaceTilde pr', pr)
      ret = '>=' + M + '.' + m + '.' + p + '-' + pr +
            ' <' + M + '.' + (+m + 1) + '.0'
    } else {
      // ~1.2.3 == >=1.2.3 <1.3.0
      ret = '>=' + M + '.' + m + '.' + p +
            ' <' + M + '.' + (+m + 1) + '.0'
    }

    debug('tilde return', ret)
    return ret
  })
}

// ^ --> * (any, kinda silly)
// ^2, ^2.x, ^2.x.x --> >=2.0.0 <3.0.0
// ^2.0, ^2.0.x --> >=2.0.0 <3.0.0
// ^1.2, ^1.2.x --> >=1.2.0 <2.0.0
// ^1.2.3 --> >=1.2.3 <2.0.0
// ^1.2.0 --> >=1.2.0 <2.0.0
function replaceCarets (comp, options) {
  return comp.trim().split(/\s+/).map(function (comp) {
    return replaceCaret(comp, options)
  }).join(' ')
}

function replaceCaret (comp, options) {
  debug('caret', comp, options)
  var r = options.loose ? re[CARETLOOSE] : re[CARET]
  return comp.replace(r, function (_, M, m, p, pr) {
    debug('caret', comp, _, M, m, p, pr)
    var ret

    if (isX(M)) {
      ret = ''
    } else if (isX(m)) {
      ret = '>=' + M + '.0.0 <' + (+M + 1) + '.0.0'
    } else if (isX(p)) {
      if (M === '0') {
        ret = '>=' + M + '.' + m + '.0 <' + M + '.' + (+m + 1) + '.0'
      } else {
        ret = '>=' + M + '.' + m + '.0 <' + (+M + 1) + '.0.0'
      }
    } else if (pr) {
      debug('replaceCaret pr', pr)
      if (M === '0') {
        if (m === '0') {
          ret = '>=' + M + '.' + m + '.' + p + '-' + pr +
                ' <' + M + '.' + m + '.' + (+p + 1)
        } else {
          ret = '>=' + M + '.' + m + '.' + p + '-' + pr +
                ' <' + M + '.' + (+m + 1) + '.0'
        }
      } else {
        ret = '>=' + M + '.' + m + '.' + p + '-' + pr +
              ' <' + (+M + 1) + '.0.0'
      }
    } else {
      debug('no pr')
      if (M === '0') {
        if (m === '0') {
          ret = '>=' + M + '.' + m + '.' + p +
                ' <' + M + '.' + m + '.' + (+p + 1)
        } else {
          ret = '>=' + M + '.' + m + '.' + p +
                ' <' + M + '.' + (+m + 1) + '.0'
        }
      } else {
        ret = '>=' + M + '.' + m + '.' + p +
              ' <' + (+M + 1) + '.0.0'
      }
    }

    debug('caret return', ret)
    return ret
  })
}

function replaceXRanges (comp, options) {
  debug('replaceXRanges', comp, options)
  return comp.split(/\s+/).map(function (comp) {
    return replaceXRange(comp, options)
  }).join(' ')
}

function replaceXRange (comp, options) {
  comp = comp.trim()
  var r = options.loose ? re[XRANGELOOSE] : re[XRANGE]
  return comp.replace(r, function (ret, gtlt, M, m, p, pr) {
    debug('xRange', comp, ret, gtlt, M, m, p, pr)
    var xM = isX(M)
    var xm = xM || isX(m)
    var xp = xm || isX(p)
    var anyX = xp

    if (gtlt === '=' && anyX) {
      gtlt = ''
    }

    if (xM) {
      if (gtlt === '>' || gtlt === '<') {
        // nothing is allowed
        ret = '<0.0.0'
      } else {
        // nothing is forbidden
        ret = '*'
      }
    } else if (gtlt && anyX) {
      // we know patch is an x, because we have any x at all.
      // replace X with 0
      if (xm) {
        m = 0
      }
      p = 0

      if (gtlt === '>') {
        // >1 => >=2.0.0
        // >1.2 => >=1.3.0
        // >1.2.3 => >= 1.2.4
        gtlt = '>='
        if (xm) {
          M = +M + 1
          m = 0
          p = 0
        } else {
          m = +m + 1
          p = 0
        }
      } else if (gtlt === '<=') {
        // <=0.7.x is actually <0.8.0, since any 0.7.x should
        // pass.  Similarly, <=7.x is actually <8.0.0, etc.
        gtlt = '<'
        if (xm) {
          M = +M + 1
        } else {
          m = +m + 1
        }
      }

      ret = gtlt + M + '.' + m + '.' + p
    } else if (xm) {
      ret = '>=' + M + '.0.0 <' + (+M + 1) + '.0.0'
    } else if (xp) {
      ret = '>=' + M + '.' + m + '.0 <' + M + '.' + (+m + 1) + '.0'
    }

    debug('xRange return', ret)

    return ret
  })
}

// Because * is AND-ed with everything else in the comparator,
// and '' means "any version", just remove the *s entirely.
function replaceStars (comp, options) {
  debug('replaceStars', comp, options)
  // Looseness is ignored here.  star is always as loose as it gets!
  return comp.trim().replace(re[STAR], '')
}

// This function is passed to string.replace(re[HYPHENRANGE])
// M, m, patch, prerelease, build
// 1.2 - 3.4.5 => >=1.2.0 <=3.4.5
// 1.2.3 - 3.4 => >=1.2.0 <3.5.0 Any 3.4.x will do
// 1.2 - 3.4 => >=1.2.0 <3.5.0
function hyphenReplace ($0,
  from, fM, fm, fp, fpr, fb,
  to, tM, tm, tp, tpr, tb) {
  if (isX(fM)) {
    from = ''
  } else if (isX(fm)) {
    from = '>=' + fM + '.0.0'
  } else if (isX(fp)) {
    from = '>=' + fM + '.' + fm + '.0'
  } else {
    from = '>=' + from
  }

  if (isX(tM)) {
    to = ''
  } else if (isX(tm)) {
    to = '<' + (+tM + 1) + '.0.0'
  } else if (isX(tp)) {
    to = '<' + tM + '.' + (+tm + 1) + '.0'
  } else if (tpr) {
    to = '<=' + tM + '.' + tm + '.' + tp + '-' + tpr
  } else {
    to = '<=' + to
  }

  return (from + ' ' + to).trim()
}

// if ANY of the sets match ALL of its comparators, then pass
Range.prototype.test = function (version) {
  if (!version) {
    return false
  }

  if (typeof version === 'string') {
    version = new SemVer(version, this.options)
  }

  for (var i = 0; i < this.set.length; i++) {
    if (testSet(this.set[i], version, this.options)) {
      return true
    }
  }
  return false
}

function testSet (set, version, options) {
  for (var i = 0; i < set.length; i++) {
    if (!set[i].test(version)) {
      return false
    }
  }

  if (version.prerelease.length && !options.includePrerelease) {
    // Find the set of versions that are allowed to have prereleases
    // For example, ^1.2.3-pr.1 desugars to >=1.2.3-pr.1 <2.0.0
    // That should allow `1.2.3-pr.2` to pass.
    // However, `1.2.4-alpha.notready` should NOT be allowed,
    // even though it's within the range set by the comparators.
    for (i = 0; i < set.length; i++) {
      debug(set[i].semver)
      if (set[i].semver === ANY) {
        continue
      }

      if (set[i].semver.prerelease.length > 0) {
        var allowed = set[i].semver
        if (allowed.major === version.major &&
            allowed.minor === version.minor &&
            allowed.patch === version.patch) {
          return true
        }
      }
    }

    // Version has a -pre, but it's not one of the ones we like.
    return false
  }

  return true
}

exports.satisfies = satisfies
function satisfies (version, range, options) {
  try {
    range = new Range(range, options)
  } catch (er) {
    return false
  }
  return range.test(version)
}

exports.maxSatisfying = maxSatisfying
function maxSatisfying (versions, range, options) {
  var max = null
  var maxSV = null
  try {
    var rangeObj = new Range(range, options)
  } catch (er) {
    return null
  }
  versions.forEach(function (v) {
    if (rangeObj.test(v)) {
      // satisfies(v, range, options)
      if (!max || maxSV.compare(v) === -1) {
        // compare(max, v, true)
        max = v
        maxSV = new SemVer(max, options)
      }
    }
  })
  return max
}

exports.minSatisfying = minSatisfying
function minSatisfying (versions, range, options) {
  var min = null
  var minSV = null
  try {
    var rangeObj = new Range(range, options)
  } catch (er) {
    return null
  }
  versions.forEach(function (v) {
    if (rangeObj.test(v)) {
      // satisfies(v, range, options)
      if (!min || minSV.compare(v) === 1) {
        // compare(min, v, true)
        min = v
        minSV = new SemVer(min, options)
      }
    }
  })
  return min
}

exports.minVersion = minVersion
function minVersion (range, loose) {
  range = new Range(range, loose)

  var minver = new SemVer('0.0.0')
  if (range.test(minver)) {
    return minver
  }

  minver = new SemVer('0.0.0-0')
  if (range.test(minver)) {
    return minver
  }

  minver = null
  for (var i = 0; i < range.set.length; ++i) {
    var comparators = range.set[i]

    comparators.forEach(function (comparator) {
      // Clone to avoid manipulating the comparator's semver object.
      var compver = new SemVer(comparator.semver.version)
      switch (comparator.operator) {
        case '>':
          if (compver.prerelease.length === 0) {
            compver.patch++
          } else {
            compver.prerelease.push(0)
          }
          compver.raw = compver.format()
          /* fallthrough */
        case '':
        case '>=':
          if (!minver || gt(minver, compver)) {
            minver = compver
          }
          break
        case '<':
        case '<=':
          /* Ignore maximum versions */
          break
        /* istanbul ignore next */
        default:
          throw new Error('Unexpected operation: ' + comparator.operator)
      }
    })
  }

  if (minver && range.test(minver)) {
    return minver
  }

  return null
}

exports.validRange = validRange
function validRange (range, options) {
  try {
    // Return '*' instead of '' so that truthiness works.
    // This will throw if it's invalid anyway
    return new Range(range, options).range || '*'
  } catch (er) {
    return null
  }
}

// Determine if version is less than all the versions possible in the range
exports.ltr = ltr
function ltr (version, range, options) {
  return outside(version, range, '<', options)
}

// Determine if version is greater than all the versions possible in the range.
exports.gtr = gtr
function gtr (version, range, options) {
  return outside(version, range, '>', options)
}

exports.outside = outside
function outside (version, range, hilo, options) {
  version = new SemVer(version, options)
  range = new Range(range, options)

  var gtfn, ltefn, ltfn, comp, ecomp
  switch (hilo) {
    case '>':
      gtfn = gt
      ltefn = lte
      ltfn = lt
      comp = '>'
      ecomp = '>='
      break
    case '<':
      gtfn = lt
      ltefn = gte
      ltfn = gt
      comp = '<'
      ecomp = '<='
      break
    default:
      throw new TypeError('Must provide a hilo val of "<" or ">"')
  }

  // If it satisifes the range it is not outside
  if (satisfies(version, range, options)) {
    return false
  }

  // From now on, variable terms are as if we're in "gtr" mode.
  // but note that everything is flipped for the "ltr" function.

  for (var i = 0; i < range.set.length; ++i) {
    var comparators = range.set[i]

    var high = null
    var low = null

    comparators.forEach(function (comparator) {
      if (comparator.semver === ANY) {
        comparator = new Comparator('>=0.0.0')
      }
      high = high || comparator
      low = low || comparator
      if (gtfn(comparator.semver, high.semver, options)) {
        high = comparator
      } else if (ltfn(comparator.semver, low.semver, options)) {
        low = comparator
      }
    })

    // If the edge version comparator has a operator then our version
    // isn't outside it
    if (high.operator === comp || high.operator === ecomp) {
      return false
    }

    // If the lowest version comparator has an operator and our version
    // is less than it then it isn't higher than the range
    if ((!low.operator || low.operator === comp) &&
        ltefn(version, low.semver)) {
      return false
    } else if (low.operator === ecomp && ltfn(version, low.semver)) {
      return false
    }
  }
  return true
}

exports.prerelease = prerelease
function prerelease (version, options) {
  var parsed = parse(version, options)
  return (parsed && parsed.prerelease.length) ? parsed.prerelease : null
}

exports.intersects = intersects
function intersects (r1, r2, options) {
  r1 = new Range(r1, options)
  r2 = new Range(r2, options)
  return r1.intersects(r2)
}

exports.coerce = coerce
function coerce (version) {
  if (version instanceof SemVer) {
    return version
  }

  if (typeof version !== 'string') {
    return null
  }

  var match = version.match(re[COERCE])

  if (match == null) {
    return null
  }

  return parse(match[1] +
    '.' + (match[2] || '0') +
    '.' + (match[3] || '0'))
}

/* WEBPACK VAR INJECTION */}.call(this, __webpack_require__(/*! ./../process/browser.js */ "./node_modules/process/browser.js")))

/***/ }),

/***/ "./node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js":
/*!****************************************************************************!*\
  !*** ./node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js ***!
  \****************************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var stylesInDom = {};

var isOldIE = function isOldIE() {
  var memo;
  return function memorize() {
    if (typeof memo === 'undefined') {
      // Test for IE <= 9 as proposed by Browserhacks
      // @see http://browserhacks.com/#hack-e71d8692f65334173fee715c222cb805
      // Tests for existence of standard globals is to allow style-loader
      // to operate correctly into non-standard environments
      // @see https://github.com/webpack-contrib/style-loader/issues/177
      memo = Boolean(window && document && document.all && !window.atob);
    }

    return memo;
  };
}();

var getTarget = function getTarget() {
  var memo = {};
  return function memorize(target) {
    if (typeof memo[target] === 'undefined') {
      var styleTarget = document.querySelector(target); // Special case to return head of iframe instead of iframe itself

      if (window.HTMLIFrameElement && styleTarget instanceof window.HTMLIFrameElement) {
        try {
          // This will throw an exception if access to iframe is blocked
          // due to cross-origin restrictions
          styleTarget = styleTarget.contentDocument.head;
        } catch (e) {
          // istanbul ignore next
          styleTarget = null;
        }
      }

      memo[target] = styleTarget;
    }

    return memo[target];
  };
}();

function listToStyles(list, options) {
  var styles = [];
  var newStyles = {};

  for (var i = 0; i < list.length; i++) {
    var item = list[i];
    var id = options.base ? item[0] + options.base : item[0];
    var css = item[1];
    var media = item[2];
    var sourceMap = item[3];
    var part = {
      css: css,
      media: media,
      sourceMap: sourceMap
    };

    if (!newStyles[id]) {
      styles.push(newStyles[id] = {
        id: id,
        parts: [part]
      });
    } else {
      newStyles[id].parts.push(part);
    }
  }

  return styles;
}

function addStylesToDom(styles, options) {
  for (var i = 0; i < styles.length; i++) {
    var item = styles[i];
    var domStyle = stylesInDom[item.id];
    var j = 0;

    if (domStyle) {
      domStyle.refs++;

      for (; j < domStyle.parts.length; j++) {
        domStyle.parts[j](item.parts[j]);
      }

      for (; j < item.parts.length; j++) {
        domStyle.parts.push(addStyle(item.parts[j], options));
      }
    } else {
      var parts = [];

      for (; j < item.parts.length; j++) {
        parts.push(addStyle(item.parts[j], options));
      }

      stylesInDom[item.id] = {
        id: item.id,
        refs: 1,
        parts: parts
      };
    }
  }
}

function insertStyleElement(options) {
  var style = document.createElement('style');

  if (typeof options.attributes.nonce === 'undefined') {
    var nonce =  true ? __webpack_require__.nc : undefined;

    if (nonce) {
      options.attributes.nonce = nonce;
    }
  }

  Object.keys(options.attributes).forEach(function (key) {
    style.setAttribute(key, options.attributes[key]);
  });

  if (typeof options.insert === 'function') {
    options.insert(style);
  } else {
    var target = getTarget(options.insert || 'head');

    if (!target) {
      throw new Error("Couldn't find a style target. This probably means that the value for the 'insert' parameter is invalid.");
    }

    target.appendChild(style);
  }

  return style;
}

function removeStyleElement(style) {
  // istanbul ignore if
  if (style.parentNode === null) {
    return false;
  }

  style.parentNode.removeChild(style);
}
/* istanbul ignore next  */


var replaceText = function replaceText() {
  var textStore = [];
  return function replace(index, replacement) {
    textStore[index] = replacement;
    return textStore.filter(Boolean).join('\n');
  };
}();

function applyToSingletonTag(style, index, remove, obj) {
  var css = remove ? '' : obj.css; // For old IE

  /* istanbul ignore if  */

  if (style.styleSheet) {
    style.styleSheet.cssText = replaceText(index, css);
  } else {
    var cssNode = document.createTextNode(css);
    var childNodes = style.childNodes;

    if (childNodes[index]) {
      style.removeChild(childNodes[index]);
    }

    if (childNodes.length) {
      style.insertBefore(cssNode, childNodes[index]);
    } else {
      style.appendChild(cssNode);
    }
  }
}

function applyToTag(style, options, obj) {
  var css = obj.css;
  var media = obj.media;
  var sourceMap = obj.sourceMap;

  if (media) {
    style.setAttribute('media', media);
  }

  if (sourceMap && btoa) {
    css += "\n/*# sourceMappingURL=data:application/json;base64,".concat(btoa(unescape(encodeURIComponent(JSON.stringify(sourceMap)))), " */");
  } // For old IE

  /* istanbul ignore if  */


  if (style.styleSheet) {
    style.styleSheet.cssText = css;
  } else {
    while (style.firstChild) {
      style.removeChild(style.firstChild);
    }

    style.appendChild(document.createTextNode(css));
  }
}

var singleton = null;
var singletonCounter = 0;

function addStyle(obj, options) {
  var style;
  var update;
  var remove;

  if (options.singleton) {
    var styleIndex = singletonCounter++;
    style = singleton || (singleton = insertStyleElement(options));
    update = applyToSingletonTag.bind(null, style, styleIndex, false);
    remove = applyToSingletonTag.bind(null, style, styleIndex, true);
  } else {
    style = insertStyleElement(options);
    update = applyToTag.bind(null, style, options);

    remove = function remove() {
      removeStyleElement(style);
    };
  }

  update(obj);
  return function updateStyle(newObj) {
    if (newObj) {
      if (newObj.css === obj.css && newObj.media === obj.media && newObj.sourceMap === obj.sourceMap) {
        return;
      }

      update(obj = newObj);
    } else {
      remove();
    }
  };
}

module.exports = function (list, options) {
  options = options || {};
  options.attributes = typeof options.attributes === 'object' ? options.attributes : {}; // Force single-tag solution on IE6-9, which has a hard limit on the # of <style>
  // tags it will allow on a page

  if (!options.singleton && typeof options.singleton !== 'boolean') {
    options.singleton = isOldIE();
  }

  var styles = listToStyles(list, options);
  addStylesToDom(styles, options);
  return function update(newList) {
    var mayRemove = [];

    for (var i = 0; i < styles.length; i++) {
      var item = styles[i];
      var domStyle = stylesInDom[item.id];

      if (domStyle) {
        domStyle.refs--;
        mayRemove.push(domStyle);
      }
    }

    if (newList) {
      var newStyles = listToStyles(newList, options);
      addStylesToDom(newStyles, options);
    }

    for (var _i = 0; _i < mayRemove.length; _i++) {
      var _domStyle = mayRemove[_i];

      if (_domStyle.refs === 0) {
        for (var j = 0; j < _domStyle.parts.length; j++) {
          _domStyle.parts[j]();
        }

        delete stylesInDom[_domStyle.id];
      }
    }
  };
};

/***/ }),

/***/ "./node_modules/svelte-codemirror/src/CodeMirror.svelte":
/*!**************************************************************!*\
  !*** ./node_modules/svelte-codemirror/src/CodeMirror.svelte ***!
  \**************************************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var svelte_internal__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! svelte/internal */ "./node_modules/svelte/internal/index.mjs");
/* harmony import */ var svelte__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! svelte */ "./node_modules/svelte/index.mjs");
/* harmony import */ var _Users_francisco_Documents_dev_MIMIC_svelte_webpack_css_grid_flex_layout_node_modules_svelte_codemirror_src_CodeMirror_svelte_css__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./node_modules/svelte-codemirror/src/CodeMirror.svelte.css */ "./node_modules/svelte-codemirror/src/CodeMirror.svelte.css");
/* harmony import */ var _Users_francisco_Documents_dev_MIMIC_svelte_webpack_css_grid_flex_layout_node_modules_svelte_codemirror_src_CodeMirror_svelte_css__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(_Users_francisco_Documents_dev_MIMIC_svelte_webpack_css_grid_flex_layout_node_modules_svelte_codemirror_src_CodeMirror_svelte_css__WEBPACK_IMPORTED_MODULE_2__);
/* node_modules/svelte-codemirror/src/CodeMirror.svelte generated by Svelte v3.12.1 */



// (225:0) {#if !CodeMirror}
function create_if_block(ctx) {
	var pre, t;

	return {
		c() {
			pre = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["element"])("pre");
			t = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["text"])(ctx.value);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["attr"])(pre, "class", "svelte-1jpkv2x");
		},

		m(target, anchor) {
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["insert"])(target, pre, anchor);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["append"])(pre, t);
		},

		p(changed, ctx) {
			if (changed.value) {
				Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["set_data"])(t, ctx.value);
			}
		},

		d(detaching) {
			if (detaching) {
				Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["detach"])(pre);
			}
		}
	};
}

function create_fragment(ctx) {
	var textarea, t, if_block_anchor;

	var if_block = (!ctx.CodeMirror) && create_if_block(ctx);

	return {
		c() {
			textarea = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["element"])("textarea");
			t = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["space"])();
			if (if_block) if_block.c();
			if_block_anchor = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["empty"])();
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["attr"])(textarea, "tabindex", "0");
			textarea.readOnly = true;
			textarea.value = ctx.value;
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["attr"])(textarea, "class", "svelte-1jpkv2x");
		},

		m(target, anchor) {
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["insert"])(target, textarea, anchor);
			ctx.textarea_binding(textarea);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["insert"])(target, t, anchor);
			if (if_block) if_block.m(target, anchor);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["insert"])(target, if_block_anchor, anchor);
		},

		p(changed, ctx) {
			if (changed.value) {
				textarea.value = ctx.value;
			}

			if (!ctx.CodeMirror) {
				if (if_block) {
					if_block.p(changed, ctx);
				} else {
					if_block = create_if_block(ctx);
					if_block.c();
					if_block.m(if_block_anchor.parentNode, if_block_anchor);
				}
			} else if (if_block) {
				if_block.d(1);
				if_block = null;
			}
		},

		i: svelte_internal__WEBPACK_IMPORTED_MODULE_0__["noop"],
		o: svelte_internal__WEBPACK_IMPORTED_MODULE_0__["noop"],

		d(detaching) {
			if (detaching) {
				Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["detach"])(textarea);
			}

			ctx.textarea_binding(null);

			if (detaching) {
				Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["detach"])(t);
			}

			if (if_block) if_block.d(detaching);

			if (detaching) {
				Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["detach"])(if_block_anchor);
			}
		}
	};
}

const is_browser = typeof window !== "undefined";

let codemirror_promise;
let _CodeMirror;

if (is_browser) {
  codemirror_promise = __webpack_require__.e(/*! import() */ 0).then(__webpack_require__.t.bind(null, /*! codemirror */ "./node_modules/codemirror/lib/codemirror.js", 7));

  codemirror_promise.then(mod => {
    _CodeMirror = mod.default;
  });
}

function sleep(ms) {
  return new Promise(fulfil => setTimeout(fulfil, ms));
}

function instance($$self, $$props, $$invalidate) {
	const dispatch = Object(svelte__WEBPACK_IMPORTED_MODULE_1__["createEventDispatcher"])();

  let { value = "", readonly = false, errorLoc = null, flex = false, lineNumbers = true, tab = true } = $$props;

  let w;
  let h;
  let mode;

  // We have to expose set and update methods, rather
  // than making this state-driven through props,
  // because it's difficult to update an editor
  // without resetting scroll otherwise
  async function set(new_value, new_mode) {
    if (new_mode !== mode) {
      await createEditor((mode = new_mode));
    }

    $$invalidate('value', value = new_value);
    updating_externally = true;
    if (editor) editor.setValue(value);
    updating_externally = false;
  }

  function update(new_value) {
    $$invalidate('value', value = new_value);

    if (editor) {
      const { left, top } = editor.getScrollInfo();
      editor.setValue(($$invalidate('value', value = new_value)));
      editor.scrollTo(left, top);
    }
  }

  function resize() {
    editor.refresh();
  }

  function focus() {
    editor.focus();
  }

  const modes = {
    js: {
      name: "javascript",
      json: false
    },
    json: {
      name: "javascript",
      json: true
    },
    svelte: {
      name: "handlebars",
      base: "text/html"
    }
  };

  const refs = {};
  let editor;
  let updating_externally = false;
  let marker;
  let error_line;
  let destroyed = false;
  let CodeMirror;

  let previous_error_line;

  Object(svelte__WEBPACK_IMPORTED_MODULE_1__["onMount"])(() => {
    if (_CodeMirror) {
      $$invalidate('CodeMirror', CodeMirror = _CodeMirror);
      createEditor(mode || "svelte").then(() => {
        if (editor) editor.setValue(value || "");
      });
    } else {
      codemirror_promise.then(async mod => {
        $$invalidate('CodeMirror', CodeMirror = mod.default);
        await createEditor(mode || "svelte");
        if (editor) editor.setValue(value || "");
      });
    }

    return () => {
      destroyed = true;
      if (editor) editor.toTextArea();
    };
  });

  let first = true;

  async function createEditor(mode) {
    if (destroyed || !CodeMirror) return;

    if (editor) editor.toTextArea();

    const opts = {
      lineNumbers,
      lineWrapping: true,
      indentWithTabs: true,
      indentUnit: 2,
      tabSize: 2,
      value: "",
      mode: modes[mode] || {
        name: mode
      },
      readOnly: readonly,
      autoCloseBrackets: true,
      autoCloseTags: true
    };

    if (!tab)
      opts.extraKeys = {
        Tab: tab,
        "Shift-Tab": tab
      };

    // Creating a text editor is a lot of work, so we yield
    // the main thread for a moment. This helps reduce jank
    if (first) await sleep(50);

    if (destroyed) return;

    $$invalidate('editor', editor = CodeMirror.fromTextArea(refs.editor, opts));

    editor.on("change", instance => {
      if (!updating_externally) {
        const value = instance.getValue();
        dispatch("change", { value });
      }
    });

    if (first) await sleep(50);
    editor.refresh();

    first = false;
  }

	function textarea_binding($$value) {
		svelte_internal__WEBPACK_IMPORTED_MODULE_0__["binding_callbacks"][$$value ? 'unshift' : 'push'](() => {
			refs.editor = $$value;
			$$invalidate('refs', refs);
		});
	}

	$$self.$set = $$props => {
		if ('value' in $$props) $$invalidate('value', value = $$props.value);
		if ('readonly' in $$props) $$invalidate('readonly', readonly = $$props.readonly);
		if ('errorLoc' in $$props) $$invalidate('errorLoc', errorLoc = $$props.errorLoc);
		if ('flex' in $$props) $$invalidate('flex', flex = $$props.flex);
		if ('lineNumbers' in $$props) $$invalidate('lineNumbers', lineNumbers = $$props.lineNumbers);
		if ('tab' in $$props) $$invalidate('tab', tab = $$props.tab);
	};

	$$self.$$.update = ($$dirty = { editor: 1, w: 1, h: 1, marker: 1, errorLoc: 1, previous_error_line: 1, error_line: 1 }) => {
		if ($$dirty.editor || $$dirty.w || $$dirty.h) { if (editor && w && h) {
        editor.refresh();
      } }
		if ($$dirty.marker || $$dirty.errorLoc || $$dirty.editor) { {
        if (marker) marker.clear();
    
        if (errorLoc) {
          const line = errorLoc.line - 1;
          const ch = errorLoc.column;
    
          $$invalidate('marker', marker = editor.markText(
            { line, ch },
            { line, ch: ch + 1 },
            {
              className: "error-loc"
            }
          ));
    
          $$invalidate('error_line', error_line = line);
        } else {
          $$invalidate('error_line', error_line = null);
        }
      } }
		if ($$dirty.editor || $$dirty.previous_error_line || $$dirty.error_line) { if (editor) {
        if (previous_error_line != null) {
          editor.removeLineClass(previous_error_line, "wrap", "error-line");
        }
    
        if (error_line && error_line !== previous_error_line) {
          editor.addLineClass(error_line, "wrap", "error-line");
          $$invalidate('previous_error_line', previous_error_line = error_line);
        }
      } }
	};

	return {
		value,
		readonly,
		errorLoc,
		flex,
		lineNumbers,
		tab,
		set,
		update,
		resize,
		focus,
		refs,
		CodeMirror,
		textarea_binding
	};
}

class CodeMirror_1 extends svelte_internal__WEBPACK_IMPORTED_MODULE_0__["SvelteComponent"] {
	constructor(options) {
		super();
		Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["init"])(this, options, instance, create_fragment, svelte_internal__WEBPACK_IMPORTED_MODULE_0__["safe_not_equal"], ["value", "readonly", "errorLoc", "flex", "lineNumbers", "tab", "set", "update", "resize", "focus"]);
	}

	get set() {
		return this.$$.ctx.set;
	}

	get update() {
		return this.$$.ctx.update;
	}

	get resize() {
		return this.$$.ctx.resize;
	}

	get focus() {
		return this.$$.ctx.focus;
	}
}


if (false) {}

/* harmony default export */ __webpack_exports__["default"] = (CodeMirror_1);




/***/ }),

/***/ "./node_modules/svelte-codemirror/src/CodeMirror.svelte.css":
/*!******************************************************************!*\
  !*** ./node_modules/svelte-codemirror/src/CodeMirror.svelte.css ***!
  \******************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

var content = __webpack_require__(/*! !../../css-loader/dist/cjs.js!./CodeMirror.svelte.css */ "./node_modules/css-loader/dist/cjs.js!./node_modules/svelte-codemirror/src/CodeMirror.svelte.css");

if (typeof content === 'string') {
  content = [[module.i, content, '']];
}

var options = {}

options.insert = "head";
options.singleton = false;

var update = __webpack_require__(/*! ../../style-loader/dist/runtime/injectStylesIntoStyleTag.js */ "./node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js")(content, options);

if (content.locals) {
  module.exports = content.locals;
}


/***/ }),

/***/ "./node_modules/svelte-grid/build/helper/index.mjs":
/*!*********************************************************!*\
  !*** ./node_modules/svelte-grid/build/helper/index.mjs ***!
  \*********************************************************/
/*! exports provided: default */
/***/ (function(__webpack_module__, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
function getRowsCount(items) {
  return Math.max(...items.map(val => val.y + val.h), 1);
}

const makeMatrix = (rows, cols) => Array.from(Array(rows), () => new Array(cols)); // make 2d array

function makeMatrixFromItems(items, _row = getRowsCount(items), _col) {
  let matrix = makeMatrix(_row, _col);
  for (var i = 0; i < items.length; i++) {
    const value = items[i];
    const {
      x,
      y,
      w,
      h,
      responsive: { valueW },
    } = value;

    for (var j = y; j < y + h; j++) {
      const row = matrix[j];
      for (var k = x; k < x + (w - valueW); k++) {
        row[k] = value;
      }
    }
  }
  return matrix;
}

function findCloseBlocks(items, matrix, curObject) {
  const {
    w,
    h,
    x,
    y,
    responsive: { valueW },
  } = curObject;
  const tempR = matrix.slice(y, y + h);
  let result = []; // new Set()
  for (var i = 0; i < tempR.length; i++) {
    let tempA = tempR[i].slice(x, x + (w - valueW));
    result = [...result, ...tempA.map(val => val && val.id).filter(val => val)];
  }
  return [...result.filter((item, pos) => result.indexOf(item) == pos)];
  // return [...new Set(result)];
}

function makeMatrixFromItemsIgnore(
  items,
  ignoreList,
  _row, //= getRowsCount(items)
  _col,
) {
  let matrix = makeMatrix(_row, _col);
  for (var i = 0; i < items.length; i++) {
    const value = items[i];
    const {
      x,
      y,
      w,
      h,
      id,
      responsive: { valueW },
    } = value;

    if (ignoreList.indexOf(id) === -1) {
      for (var j = y; j < y + h; j++) {
        const row = matrix[j];
        if (row) {
          for (var k = x; k < x + (w - valueW); k++) {
            row[k] = value;
          }
        }
      }
    }
  }
  return matrix;
}

function findItemsById(closeBlocks, items) {
  return items.filter(value => closeBlocks.indexOf(value.id) !== -1);
}

function adjustItem(matrix, item, items = [], cols) {
  const { w: width } = item;

  let valueW = item.responsive.valueW;
  for (var i = 0; i < matrix.length; i++) {
    const row = matrix[i];
    for (var j = 0; j < row.length; j++) {
      const empty = row.findIndex(val => val === undefined); // super dirty to check (empty for undefined)
      if (empty !== -1) {
        var z = row.slice(empty);
        var n = z.length;
        for (var x = 0; x < z.length; x++) {
          if (z[x] !== undefined) {
            n = x;
            break;
          }
        } // super dirty to check (empty for undefined)

        valueW = Math.max(width - n, 0);

        return {
          y: i,
          x: empty,
          responsive: { valueW },
        };
      }
    }
  }

  valueW = Math.max(width - cols, 0);
  return {
    y: getRowsCount(items),
    x: 0,
    responsive: { valueW },
  };
}

function resizeItems(items, col, rows = getRowsCount(items)) {
  let matrix = makeMatrix(rows, col);
  items.forEach((item, index) => {
    let ignore = items.slice(index + 1).map(val => val.id);
    let position = adjustItem(matrix, item, items, col);

    items = items.map(value => (value.id === item.id ? { ...item, ...position } : value));

    matrix = makeMatrixFromItemsIgnore(items, ignore, getRowsCount(items), col);
  });

  return items;
}

function findFreeSpaceForItem(matrix, item, items = []) {
  const cols = matrix[0].length;
  let xNtime = cols - (item.w - item.responsive.valueW);

  for (var i = 0; i < matrix.length; i++) {
    const row = matrix[i];
    for (var j = 0; j < xNtime + 1; j++) {
      const sliceA = row.slice(j, j + (item.w - item.responsive.valueW));
      const empty = sliceA.every(val => val === undefined);
      if (empty) {
        const isEmpty = matrix.slice(i, i + item.h).every(a => a.slice(j, j + (item.w - item.responsive.valueW)).every(n => n === undefined));

        if (isEmpty) {
          return { y: i, x: j };
        }
      }
    }
  }

  return {
    y: getRowsCount(items),
    x: 0,
  };
}

function assignPosition(item, position, value) {
  return value.id === item.id ? { ...item, ...position } : value;
}

const replaceItem = (item, cachedItem, value) => (value.id === item.id ? cachedItem : value);

function moveItem($item, items, cols, originalItem) {
  let matrix = makeMatrixFromItemsIgnore(items, [$item.id], getRowsCount(items), cols);

  const closeBlocks = findCloseBlocks(items, matrix, $item);
  let closeObj = findItemsById(closeBlocks, items);

  const statics = closeObj.find(value => value.static);

  if (statics) {
    if (originalItem) {
      return items.map(replaceItem.bind(null, $item, originalItem));
    }
  }

  matrix = makeMatrixFromItemsIgnore(items, closeBlocks, getRowsCount(items), cols);

  let tempItems = items;

  let tempCloseBlocks = closeBlocks;

  let exclude = [];

  closeObj.forEach(item => {
    let position = findFreeSpaceForItem(matrix, item, tempItems);

    exclude.push(item.id);

    if (position) {
      tempItems = tempItems.map(assignPosition.bind(null, item, position));
      let getIgnoreItems = tempCloseBlocks.filter(value => exclude.indexOf(value) === -1);

      matrix = makeMatrixFromItemsIgnore(tempItems, getIgnoreItems, getRowsCount(items), cols);
    }
  });

  return tempItems;
}

function makeItem(item) {
  return {
    drag: {
      top: null,
      left: null,
      dragging: false,
    },
    resize: {
      width: null,
      height: null,
      resizing: false,
    },
    responsive: {
      valueW: 0,
    },
    static: false,
    resizable: !item.static,
    draggable: !item.static,
    min: { ...item.min },
    max: { ...item.max },
    ...item,
  };
}

const gridHelp = {
  findSpaceForItem(item, items, cols) {
    let matrix = makeMatrixFromItems(items, getRowsCount(items), cols);

    let position = findFreeSpaceForItem(matrix, item, items);
    return position;
  },

  appendItem(item, items, cols) {
    return moveItem(item, [...items, ...[item]], cols);
  },

  resizeItems(items, col, rows) {
    return resizeItems(items, col, rows);
  },

  item(obj) {
    return makeItem(obj);
  },
};

/* harmony default export */ __webpack_exports__["default"] = (gridHelp);


/***/ }),

/***/ "./node_modules/svelte-grid/src/index.svelte":
/*!***************************************************!*\
  !*** ./node_modules/svelte-grid/src/index.svelte ***!
  \***************************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var svelte_internal__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! svelte/internal */ "./node_modules/svelte/internal/index.mjs");
/* harmony import */ var svelte__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! svelte */ "./node_modules/svelte/index.mjs");
/* harmony import */ var _utils_item_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./utils/item.js */ "./node_modules/svelte-grid/src/utils/item.js");
/* harmony import */ var _utils_container_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./utils/container.js */ "./node_modules/svelte-grid/src/utils/container.js");
/* harmony import */ var _utils_other_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./utils/other.js */ "./node_modules/svelte-grid/src/utils/other.js");
/* harmony import */ var _utils_matrix_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./utils/matrix.js */ "./node_modules/svelte-grid/src/utils/matrix.js");
/* harmony import */ var _Users_francisco_Documents_dev_MIMIC_svelte_webpack_css_grid_flex_layout_node_modules_svelte_grid_src_index_svelte_css__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./node_modules/svelte-grid/src/index.svelte.css */ "./node_modules/svelte-grid/src/index.svelte.css");
/* harmony import */ var _Users_francisco_Documents_dev_MIMIC_svelte_webpack_css_grid_flex_layout_node_modules_svelte_grid_src_index_svelte_css__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(_Users_francisco_Documents_dev_MIMIC_svelte_webpack_css_grid_flex_layout_node_modules_svelte_grid_src_index_svelte_css__WEBPACK_IMPORTED_MODULE_6__);
/* node_modules/svelte-grid/src/index.svelte generated by Svelte v3.12.1 */

const { window: window_1 } = svelte_internal__WEBPACK_IMPORTED_MODULE_0__["globals"];






const get_default_slot_changes = ({ item, items, i }) => ({ item: items, index: items });
const get_default_slot_context = ({ item, items, i }) => ({
	item: item,
	index: i
});

function get_each_context(ctx, list, i) {
	const child_ctx = Object.create(ctx);
	child_ctx.item = list[i];
	child_ctx.i = i;
	return child_ctx;
}

// (58:10) {#if item.resizable}
function create_if_block_1(ctx) {
	var div, dispose;

	return {
		c() {
			div = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["element"])("div");
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["attr"])(div, "class", "svlt-grid-resizer svelte-14tbpr7");

			dispose = [
				Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["listen"])(div, "touchstart", ctx.resizeOnMouseDown.bind(this,ctx.item.id)),
				Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["listen"])(div, "mousedown", ctx.resizeOnMouseDown.bind(this,ctx.item.id))
			];
		},

		m(target, anchor) {
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["insert"])(target, div, anchor);
		},

		p(changed, new_ctx) {
			ctx = new_ctx;
		},

		d(detaching) {
			if (detaching) {
				Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["detach"])(div);
			}

			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["run_all"])(dispose);
		}
	};
}

// (45:2) {#each items as item, i (item.id)}
function create_each_block(key_1, ctx) {
	var div, t, div_style_value, current, dispose;

	const default_slot_template = ctx.$$slots.default;
	const default_slot = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["create_slot"])(default_slot_template, ctx, get_default_slot_context);

	var if_block = (ctx.item.resizable) && create_if_block_1(ctx);

	return {
		key: key_1,

		first: null,

		c() {
			div = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["element"])("div");

			if (default_slot) default_slot.c();
			t = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["space"])();
			if (if_block) if_block.c();

			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["attr"])(div, "class", "svlt-grid-item svelte-14tbpr7");
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["attr"])(div, "style", div_style_value = "" + (ctx.useTransform ? `transform: translate(${ctx.item.drag.dragging ? ctx.item.drag.left : (ctx.item.x * ctx.xPerPx) + ctx.gap}px, ${ctx.item.drag.dragging ? ctx.item.drag.top : (ctx.item.y * ctx.yPerPx + ctx.gap)}px);` : '') + ";\n        " + (!ctx.useTransform ? `top: ${ctx.item.drag.dragging ? ctx.item.drag.top : (ctx.item.y * ctx.yPerPx) + ctx.gap}px` : '') + ";\n        " + (!ctx.useTransform ? `left: ${ctx.item.drag.dragging ? ctx.item.drag.left : (ctx.item.x * ctx.xPerPx) + ctx.gap}px` : '') + ";\n        width: " + (ctx.item.resize.resizing ? ctx.item.resize.width : ((ctx.item.w * ctx.xPerPx) - ctx.gap * 2) - (ctx.item.responsive.valueW*ctx.xPerPx)) + "px;\n        height: " + (ctx.item.resize.resizing ? ctx.item.resize.height : (ctx.item.h * ctx.yPerPx) - ctx.gap * 2) + "px;\n        z-index: " + (ctx.item.drag.dragging || ctx.item.resize.resizing ? 3 : 1) + ";\n        opacity: " + (ctx.item.resize.resizing ? 0.5 : 1));

			dispose = [
				Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["listen"])(div, "mousedown", ctx.item.draggable ? ctx.dragOnMouseDown.bind(this, ctx.item.id) : null),
				Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["listen"])(div, "touchstart", ctx.item.draggable ? ctx.dragOnMouseDown.bind(this, ctx.item.id) : null)
			];

			this.first = div;
		},

		l(nodes) {
			if (default_slot) default_slot.l(div_nodes);
		},

		m(target, anchor) {
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["insert"])(target, div, anchor);

			if (default_slot) {
				default_slot.m(div, null);
			}

			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["append"])(div, t);
			if (if_block) if_block.m(div, null);
			current = true;
		},

		p(changed, new_ctx) {
			ctx = new_ctx;

			if (default_slot && default_slot.p && (changed.$$scope || changed.items)) {
				default_slot.p(
					Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["get_slot_changes"])(default_slot_template, ctx, changed, get_default_slot_changes),
					Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["get_slot_context"])(default_slot_template, ctx, get_default_slot_context)
				);
			}

			if (ctx.item.resizable) {
				if (!if_block) {
					if_block = create_if_block_1(ctx);
					if_block.c();
					if_block.m(div, null);
				}
			} else if (if_block) {
				if_block.d(1);
				if_block = null;
			}

			if ((!current || changed.useTransform || changed.items || changed.xPerPx || changed.gap) && div_style_value !== (div_style_value = "" + (ctx.useTransform ? `transform: translate(${ctx.item.drag.dragging ? ctx.item.drag.left : (ctx.item.x * ctx.xPerPx) + ctx.gap}px, ${ctx.item.drag.dragging ? ctx.item.drag.top : (ctx.item.y * ctx.yPerPx + ctx.gap)}px);` : '') + ";\n        " + (!ctx.useTransform ? `top: ${ctx.item.drag.dragging ? ctx.item.drag.top : (ctx.item.y * ctx.yPerPx) + ctx.gap}px` : '') + ";\n        " + (!ctx.useTransform ? `left: ${ctx.item.drag.dragging ? ctx.item.drag.left : (ctx.item.x * ctx.xPerPx) + ctx.gap}px` : '') + ";\n        width: " + (ctx.item.resize.resizing ? ctx.item.resize.width : ((ctx.item.w * ctx.xPerPx) - ctx.gap * 2) - (ctx.item.responsive.valueW*ctx.xPerPx)) + "px;\n        height: " + (ctx.item.resize.resizing ? ctx.item.resize.height : (ctx.item.h * ctx.yPerPx) - ctx.gap * 2) + "px;\n        z-index: " + (ctx.item.drag.dragging || ctx.item.resize.resizing ? 3 : 1) + ";\n        opacity: " + (ctx.item.resize.resizing ? 0.5 : 1))) {
				Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["attr"])(div, "style", div_style_value);
			}
		},

		i(local) {
			if (current) return;
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["transition_in"])(default_slot, local);
			current = true;
		},

		o(local) {
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["transition_out"])(default_slot, local);
			current = false;
		},

		d(detaching) {
			if (detaching) {
				Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["detach"])(div);
			}

			if (default_slot) default_slot.d(detaching);
			if (if_block) if_block.d();
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["run_all"])(dispose);
		}
	};
}

// (69:2) {#if shadow.active}
function create_if_block(ctx) {
	var div, div_style_value;

	return {
		c() {
			div = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["element"])("div");
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["attr"])(div, "class", "svlt-grid-shadow svelte-14tbpr7");
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["attr"])(div, "style", div_style_value = "" + (ctx.useTransform ? `transform: translate(${ctx.shadow.drag.dragging ? ctx.shadow.drag.left : (ctx.shadow.x * ctx.xPerPx) + ctx.gap}px, ${ctx.shadow.drag.dragging ? ctx.shadow.drag.top : (ctx.shadow.y * ctx.yPerPx + ctx.gap)}px);` : '') + ";\n        " + (!ctx.useTransform ? `top: ${ctx.shadow.drag.dragging ? ctx.shadow.drag.top : (ctx.shadow.y * ctx.yPerPx) + ctx.gap}px` : '') + ";\n        " + (!ctx.useTransform ? `left: ${ctx.shadow.drag.dragging ? ctx.shadow.drag.left : (ctx.shadow.x * ctx.xPerPx) + ctx.gap}px` : '') + ";\n    width:" + (((ctx.shadow.w * ctx.xPerPx) - ctx.gap * 2) - (ctx.shadow.responsive.valueW*ctx.xPerPx)) + "px;\n    height:" + ((ctx.shadow.h * ctx.yPerPx) - ctx.gap * 2) + "px;");
		},

		m(target, anchor) {
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["insert"])(target, div, anchor);
		},

		p(changed, ctx) {
			if ((changed.useTransform || changed.shadow || changed.xPerPx || changed.gap) && div_style_value !== (div_style_value = "" + (ctx.useTransform ? `transform: translate(${ctx.shadow.drag.dragging ? ctx.shadow.drag.left : (ctx.shadow.x * ctx.xPerPx) + ctx.gap}px, ${ctx.shadow.drag.dragging ? ctx.shadow.drag.top : (ctx.shadow.y * ctx.yPerPx + ctx.gap)}px);` : '') + ";\n        " + (!ctx.useTransform ? `top: ${ctx.shadow.drag.dragging ? ctx.shadow.drag.top : (ctx.shadow.y * ctx.yPerPx) + ctx.gap}px` : '') + ";\n        " + (!ctx.useTransform ? `left: ${ctx.shadow.drag.dragging ? ctx.shadow.drag.left : (ctx.shadow.x * ctx.xPerPx) + ctx.gap}px` : '') + ";\n    width:" + (((ctx.shadow.w * ctx.xPerPx) - ctx.gap * 2) - (ctx.shadow.responsive.valueW*ctx.xPerPx)) + "px;\n    height:" + ((ctx.shadow.h * ctx.yPerPx) - ctx.gap * 2) + "px;")) {
				Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["attr"])(div, "style", div_style_value);
			}
		},

		d(detaching) {
			if (detaching) {
				Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["detach"])(div);
			}
		}
	};
}

function create_fragment(ctx) {
	var div, each_blocks = [], each_1_lookup = new Map(), t, current, dispose;

	let each_value = ctx.items;

	const get_key = ctx => ctx.item.id;

	for (let i = 0; i < each_value.length; i += 1) {
		let child_ctx = get_each_context(ctx, each_value, i);
		let key = get_key(child_ctx);
		each_1_lookup.set(key, each_blocks[i] = create_each_block(key, child_ctx));
	}

	var if_block = (ctx.shadow.active) && create_if_block(ctx);

	return {
		c() {
			div = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["element"])("div");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			t = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["space"])();
			if (if_block) if_block.c();
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["attr"])(div, "class", "svlt-grid-container svelte-14tbpr7");
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["set_style"])(div, "height", "" + ctx.ch + "px");
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["toggle_class"])(div, "svlt-grid-transition", !ctx.focuesdItem);
			dispose = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["listen"])(window_1, "resize", Object(_utils_other_js__WEBPACK_IMPORTED_MODULE_4__["debounce"])(ctx.onResize,300));
		},

		m(target, anchor) {
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["insert"])(target, div, anchor);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(div, null);
			}

			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["append"])(div, t);
			if (if_block) if_block.m(div, null);
			ctx.div_binding(div);
			current = true;
		},

		p(changed, ctx) {
			const each_value = ctx.items;

			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["group_outros"])();
			each_blocks = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["update_keyed_each"])(each_blocks, changed, get_key, 1, ctx, each_value, each_1_lookup, div, svelte_internal__WEBPACK_IMPORTED_MODULE_0__["outro_and_destroy_block"], create_each_block, t, get_each_context);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["check_outros"])();

			if (ctx.shadow.active) {
				if (if_block) {
					if_block.p(changed, ctx);
				} else {
					if_block = create_if_block(ctx);
					if_block.c();
					if_block.m(div, null);
				}
			} else if (if_block) {
				if_block.d(1);
				if_block = null;
			}

			if (!current || changed.ch) {
				Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["set_style"])(div, "height", "" + ctx.ch + "px");
			}

			if (changed.focuesdItem) {
				Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["toggle_class"])(div, "svlt-grid-transition", !ctx.focuesdItem);
			}
		},

		i(local) {
			if (current) return;
			for (let i = 0; i < each_value.length; i += 1) {
				Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["transition_in"])(each_blocks[i]);
			}

			current = true;
		},

		o(local) {
			for (let i = 0; i < each_blocks.length; i += 1) {
				Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["transition_out"])(each_blocks[i]);
			}

			current = false;
		},

		d(detaching) {
			if (detaching) {
				Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["detach"])(div);
			}

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].d();
			}

			if (if_block) if_block.d();
			ctx.div_binding(null);
			dispose();
		}
	};
}

function instance($$self, $$props, $$invalidate) {
	

let { useTransform = false, items = [], cols = 0, dragDebounceMs = 350, gap = 0, rowHeight = 150, breakpoints, fillEmpty = true } = $$props;

let container,
  focuesdItem,
  bound,
  xPerPx,
  currentItemIndex,
  getComputedCols,
  documentWidth,
  resizeNoDynamicCalc,
  yPerPx = rowHeight,
  initCols = cols,
  shadow = {
    w: 0,
    h: 0,
    x: 0,
    y: 0,
    active: false,
    id: null,
    responsive: { valueW: 0 },
    min: {},
    max: {}
  },
  ch = Object(_utils_container_js__WEBPACK_IMPORTED_MODULE_3__["getContainerHeight"])(items, yPerPx);

const dispatch = Object(svelte__WEBPACK_IMPORTED_MODULE_1__["createEventDispatcher"])();

const getDocWidth = () => document.documentElement.clientWidth

function onResize() {

  let w = document.documentElement.clientWidth

  if(w !== documentWidth) {
    documentWidth = w;
    
    bound = container.getBoundingClientRect();

    let getCols = Object(_utils_other_js__WEBPACK_IMPORTED_MODULE_4__["getColumnFromBreakpoints"])(breakpoints,w,cols,initCols)
    
    getComputedCols = getCols

    $$invalidate('xPerPx', xPerPx = bound.width / getCols)

    dispatch('resize', {
      cols:getCols,
      xPerPx,
      yPerPx // same as rowHeight
    });

    if(breakpoints) {
    	$$invalidate('items', items = Object(_utils_item_js__WEBPACK_IMPORTED_MODULE_2__["resizeItems"])(items, getCols));
    }

  } 

}


Object(svelte__WEBPACK_IMPORTED_MODULE_1__["onMount"])(() => {
  bound = container.getBoundingClientRect();

  let getCols = Object(_utils_other_js__WEBPACK_IMPORTED_MODULE_4__["getColumnFromBreakpoints"])(breakpoints, getDocWidth(), cols, initCols)
  
  getComputedCols = getCols

  documentWidth = document.documentElement.clientWidth

  if(breakpoints) {
    $$invalidate('items', items = Object(_utils_item_js__WEBPACK_IMPORTED_MODULE_2__["resizeItems"])(items, getCols))
  }

  $$invalidate('xPerPx', xPerPx = bound.width / getCols)

  dispatch('mount', {
    cols: getCols,
    xPerPx,
    yPerPx // same as rowHeight
  })

});

// resize

let resizeStartX, resizeStartY, resizeStartWidth, resizeStartHeight;

function resizeOnMouseDown(id, e) {
  e.stopPropagation();

  let {pageX,pageY} = Object(_utils_other_js__WEBPACK_IMPORTED_MODULE_4__["getCordinates"])(e)

  const { item, index } = Object(_utils_item_js__WEBPACK_IMPORTED_MODULE_2__["getItemById"])(id, items);

  currentItemIndex = index;

  $$invalidate('focuesdItem', focuesdItem = item);

  cacheItem = {...item}

  resizeNoDynamicCalc = item.h + item.y === Object(_utils_other_js__WEBPACK_IMPORTED_MODULE_4__["getRowsCount"])(items);

  $$invalidate('shadow', shadow = {...shadow,...focuesdItem,...{active:true}})

  resizeStartX = pageX - bound.x;
  resizeStartY = pageY - bound.y;

  resizeStartWidth = (item.w * xPerPx) - (gap * 2) - (focuesdItem.responsive.valueW * xPerPx);

  resizeStartHeight = (item.h * yPerPx) - (gap * 2);

  getComputedCols = Object(_utils_other_js__WEBPACK_IMPORTED_MODULE_4__["getColumnFromBreakpoints"])(breakpoints, getDocWidth(), cols, initCols)

  window.addEventListener("mousemove", resizeOnMouseMove, false);
  window.addEventListener("touchmove", resizeOnMouseMove, false);

  window.addEventListener("mouseup", resizeOnMouseUp, false);
  window.addEventListener("touchend", resizeOnMouseUp, false);
}

function resizeOnMouseMove(e) {

  let {pageX,pageY}=Object(_utils_other_js__WEBPACK_IMPORTED_MODULE_4__["getCordinates"])(e);

  pageX = pageX - bound.x;
  pageY = pageY - bound.y;

  const height = resizeStartHeight + pageY - resizeStartY;
  const width = resizeStartWidth + (pageX - resizeStartX)

  const {responsive:{valueW} } = focuesdItem;

  let wRes = Math.round(width / xPerPx) + valueW

  const {h:minHeight=1,w:minWidth=1} = focuesdItem.min
  const {h:maxHeight,w:maxWidth = ((getComputedCols - focuesdItem.x)+valueW)} = focuesdItem.max

  wRes = Math.min(Math.max(wRes,minWidth),maxWidth)/* min max*/

  let hRes = Math.round(height/yPerPx)
  if(maxHeight) {
    hRes = Math.min(hRes,maxHeight)
  }
  hRes = Math.max(hRes,minHeight)

  $$invalidate('shadow', shadow = {...shadow, ...{w:wRes, h:hRes}}) 

  let assignItem = items[currentItemIndex]
  $$invalidate('items', items[currentItemIndex] = {
    ...assignItem,
    resize: {
      resizing:true,
      width,
      height
    },
    w:wRes,
    h:hRes
  }, items)

  if (!resizeNoDynamicCalc) {
    debounceRecalculateGridPosition();
  }
}

function resizeOnMouseUp(e) {
  e.stopPropagation();

  let assignItem = items[currentItemIndex]
  $$invalidate('items', items[currentItemIndex] = {
    ...assignItem,
    resize:{
      resizing:false,
      width:0,
      height:0
    }
  }, items)

  window.removeEventListener("mousemove", resizeOnMouseMove, false);
  window.removeEventListener("touchmove", resizeOnMouseMove, false);

  window.removeEventListener("mouseup", resizeOnMouseUp, false);
  window.removeEventListener("touchend", resizeOnMouseUp, false);

  $$invalidate('shadow', shadow = {...shadow, ... {w:0,h:0,x:0,y:0,active:false,id:null,responsive:{valueW:0}}, min:{},max:{} }) 

  recalculateGridPosition("up");

  $$invalidate('focuesdItem', focuesdItem = undefined);
  resizeNoDynamicCalc = false;
}

// drag
let dragX = 0,
  dragY = 0;

const debounceRecalculateGridPosition = Object(_utils_other_js__WEBPACK_IMPORTED_MODULE_4__["debounce"])(recalculateGridPosition, dragDebounceMs);

let cacheItem = {};

function dragOnMouseDown(id, e) {
  e.stopPropagation()
  let {pageX,pageY} = Object(_utils_other_js__WEBPACK_IMPORTED_MODULE_4__["getCordinates"])(e)

  const { item, index } = Object(_utils_item_js__WEBPACK_IMPORTED_MODULE_2__["getItemById"])(id, items);
  
  currentItemIndex = index;


  $$invalidate('focuesdItem', focuesdItem = item);
  cacheItem = {...item}
  
  $$invalidate('shadow', shadow = { ...shadow, ...item, active: true }); 

  

  let { currentTarget } = e;

  let offsetLeft, offsetTop;

  if(useTransform) {
    const { x, y } = Object(_utils_other_js__WEBPACK_IMPORTED_MODULE_4__["getTranslate"])(currentTarget.style.transform)
    offsetLeft = x
    offsetTop = y
  } else {
    offsetLeft = currentTarget.offsetLeft
    offsetTop = currentTarget.offsetTop
  }

  pageX = pageX - bound.x;
  pageY = pageY - bound.y;

  dragX = pageX - offsetLeft;

  dragY = pageY - offsetTop;

  getComputedCols = Object(_utils_other_js__WEBPACK_IMPORTED_MODULE_4__["getColumnFromBreakpoints"])(breakpoints, getDocWidth(), cols, initCols)


  if (item) {
    window.addEventListener("mousemove", dragOnMove, false);
    window.addEventListener("touchmove", dragOnMove, false);

    window.addEventListener("mouseup", dragOnMouseUp, false);
    window.addEventListener("touchend", dragOnMouseUp, false);
  } else {
    console.warn("Can not get item");
  }
}


function dragOnMove(e) {
  e.stopPropagation()

  let {pageX,pageY} = Object(_utils_other_js__WEBPACK_IMPORTED_MODULE_4__["getCordinates"])(e)

  const y = pageY - bound.y;
  const x = pageX - bound.x;

  let xRes = Math.round((x - dragX) / xPerPx);
  let yRes = Math.round((y - dragY) / yPerPx);

  xRes = Math.max(Math.min(xRes,getComputedCols-(focuesdItem.w- focuesdItem.responsive.valueW)),0)

  yRes = Math.max(yRes, 0);

  let assignItem = items[currentItemIndex];

  $$invalidate('items', items[currentItemIndex] = {
    ...assignItem,
    drag:{
      dragging:true,
      top:y - dragY,
      left:x - dragX
    },
    x:xRes,
    y:yRes
  }, items)

  $$invalidate('shadow', shadow = {...shadow, ...{x:xRes,y:yRes}})

  debounceRecalculateGridPosition();
}

function dragOnMouseUp(e) {
  window.removeEventListener("mousemove", dragOnMove, false);
  window.removeEventListener("touchmove", dragOnMove, false);

  window.removeEventListener("mouseup", dragOnMouseUp, false);
  window.removeEventListener("touchend", dragOnMouseUp, false);

  let assignItem = items[currentItemIndex]
  $$invalidate('items', items[currentItemIndex] = {
    ...assignItem,
    drag: {
      dragging: false,
      top: 0,
      left: 0
    },
  }, items)

  dragX = 0;
  dragY = 0;

  $$invalidate('shadow', shadow = {...shadow, ...{w:0,h:0,x:0,y:0,active:false,id:null}}) 
  
  recalculateGridPosition("up");

  $$invalidate('focuesdItem', focuesdItem = undefined);
}


// Will work on this, need to make code cleaner
function recalculateGridPosition(action) {
  const dragItem = items[currentItemIndex];

  let getCols = Object(_utils_other_js__WEBPACK_IMPORTED_MODULE_4__["getColumnFromBreakpoints"])(breakpoints, getDocWidth(), cols, initCols)
  let result = Object(_utils_item_js__WEBPACK_IMPORTED_MODULE_2__["moveItem"])(dragItem, items, getCols, cacheItem);

  if(fillEmpty) {

    result.forEach(value => {
      if (value.id !== dragItem.id) {
        result = result.map($val =>
          $val.id === value.id
            ? {
                ...$val,
                ...Object(_utils_item_js__WEBPACK_IMPORTED_MODULE_2__["findFreeSpaceForItem"])(
                  Object(_utils_matrix_js__WEBPACK_IMPORTED_MODULE_5__["makeMatrixFromItemsIgnore"])(result, [value.id], Object(_utils_other_js__WEBPACK_IMPORTED_MODULE_4__["getRowsCount"])(result), getCols),
                  value,
                  result
                )
              }
            : $val
        );
      }
    });
  }

  $$invalidate('items', items = result)

  dispatch('adjust', {
    focuesdItem: dragItem
  });

}

Object(svelte__WEBPACK_IMPORTED_MODULE_1__["beforeUpdate"])(() => {
  if (!focuesdItem) {
    $$invalidate('ch', ch = Object(_utils_container_js__WEBPACK_IMPORTED_MODULE_3__["getContainerHeight"])(items, yPerPx));
    if(cols !== initCols) {
      if(bound) {
        $$invalidate('xPerPx', xPerPx = bound.width/cols)
        initCols = cols
      }
    }
  }
});

	let { $$slots = {}, $$scope } = $$props;

	function div_binding($$value) {
		svelte_internal__WEBPACK_IMPORTED_MODULE_0__["binding_callbacks"][$$value ? 'unshift' : 'push'](() => {
			$$invalidate('container', container = $$value);
		});
	}

	$$self.$set = $$props => {
		if ('useTransform' in $$props) $$invalidate('useTransform', useTransform = $$props.useTransform);
		if ('items' in $$props) $$invalidate('items', items = $$props.items);
		if ('cols' in $$props) $$invalidate('cols', cols = $$props.cols);
		if ('dragDebounceMs' in $$props) $$invalidate('dragDebounceMs', dragDebounceMs = $$props.dragDebounceMs);
		if ('gap' in $$props) $$invalidate('gap', gap = $$props.gap);
		if ('rowHeight' in $$props) $$invalidate('rowHeight', rowHeight = $$props.rowHeight);
		if ('breakpoints' in $$props) $$invalidate('breakpoints', breakpoints = $$props.breakpoints);
		if ('fillEmpty' in $$props) $$invalidate('fillEmpty', fillEmpty = $$props.fillEmpty);
		if ('$$scope' in $$props) $$invalidate('$$scope', $$scope = $$props.$$scope);
	};

	return {
		useTransform,
		items,
		cols,
		dragDebounceMs,
		gap,
		rowHeight,
		breakpoints,
		fillEmpty,
		container,
		focuesdItem,
		xPerPx,
		yPerPx,
		shadow,
		ch,
		onResize,
		resizeOnMouseDown,
		dragOnMouseDown,
		div_binding,
		$$slots,
		$$scope
	};
}

class Src extends svelte_internal__WEBPACK_IMPORTED_MODULE_0__["SvelteComponent"] {
	constructor(options) {
		super();
		Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["init"])(this, options, instance, create_fragment, svelte_internal__WEBPACK_IMPORTED_MODULE_0__["safe_not_equal"], ["useTransform", "items", "cols", "dragDebounceMs", "gap", "rowHeight", "breakpoints", "fillEmpty"]);
	}
}


if (false) {}

/* harmony default export */ __webpack_exports__["default"] = (Src);




/***/ }),

/***/ "./node_modules/svelte-grid/src/index.svelte.css":
/*!*******************************************************!*\
  !*** ./node_modules/svelte-grid/src/index.svelte.css ***!
  \*******************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

var content = __webpack_require__(/*! !../../css-loader/dist/cjs.js!./index.svelte.css */ "./node_modules/css-loader/dist/cjs.js!./node_modules/svelte-grid/src/index.svelte.css");

if (typeof content === 'string') {
  content = [[module.i, content, '']];
}

var options = {}

options.insert = "head";
options.singleton = false;

var update = __webpack_require__(/*! ../../style-loader/dist/runtime/injectStylesIntoStyleTag.js */ "./node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js")(content, options);

if (content.locals) {
  module.exports = content.locals;
}


/***/ }),

/***/ "./node_modules/svelte-grid/src/utils/container.js":
/*!*********************************************************!*\
  !*** ./node_modules/svelte-grid/src/utils/container.js ***!
  \*********************************************************/
/*! exports provided: getContainerHeight */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "getContainerHeight", function() { return getContainerHeight; });
/* harmony import */ var _other_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./other.js */ "./node_modules/svelte-grid/src/utils/other.js");


function getContainerHeight(items, yPerPx) {
  return Math.max(Object(_other_js__WEBPACK_IMPORTED_MODULE_0__["getRowsCount"])(items), 2) * yPerPx;
}


/***/ }),

/***/ "./node_modules/svelte-grid/src/utils/item.js":
/*!****************************************************!*\
  !*** ./node_modules/svelte-grid/src/utils/item.js ***!
  \****************************************************/
/*! exports provided: filterStatics, adjustItem, resizeItems, getItemById, findFreeSpaceForItem, moveItem */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "filterStatics", function() { return filterStatics; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "adjustItem", function() { return adjustItem; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "resizeItems", function() { return resizeItems; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "getItemById", function() { return getItemById; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "findFreeSpaceForItem", function() { return findFreeSpaceForItem; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "moveItem", function() { return moveItem; });
/* harmony import */ var _matrix_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./matrix.js */ "./node_modules/svelte-grid/src/utils/matrix.js");
/* harmony import */ var _other_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./other.js */ "./node_modules/svelte-grid/src/utils/other.js");



function filterStatics(items) {
  return items.filter(value => !value.static);
}

function adjustItem(matrix, item, items = [], cols) {
  const { w: width } = item;

  let valueW = item.responsive.valueW;
  for (var i = 0; i < matrix.length; i++) {
    const row = matrix[i];
    for (var j = 0; j < row.length; j++) {
      const empty = row.findIndex(val => val === undefined); // super dirty to check (empty for undefined)
      if (empty !== -1) {
        var z = row.slice(empty);
        var n = z.length;
        for (var x = 0; x < z.length; x++) {
          if (z[x] !== undefined) {
            n = x;
            break;
          }
        } // super dirty to check (empty for undefined)

        valueW = Math.max(width - n, 0);

        return {
          y: i,
          x: empty,
          responsive: { valueW },
        };
      }
    }
  }

  valueW = Math.max(width - cols, 0);
  return {
    y: Object(_other_js__WEBPACK_IMPORTED_MODULE_1__["getRowsCount"])(items),
    x: 0,
    responsive: { valueW },
  };
}

function resizeItems(items, col, rows = Object(_other_js__WEBPACK_IMPORTED_MODULE_1__["getRowsCount"])(items)) {
  let matrix = Object(_matrix_js__WEBPACK_IMPORTED_MODULE_0__["makeMatrix"])(rows, col);
  items.forEach((item, index) => {
    let ignore = items.slice(index + 1).map(val => val.id);
    let position = adjustItem(matrix, item, items, col);

    items = items.map(value => (value.id === item.id ? { ...item, ...position } : value));

    matrix = Object(_matrix_js__WEBPACK_IMPORTED_MODULE_0__["makeMatrixFromItemsIgnore"])(items, ignore, Object(_other_js__WEBPACK_IMPORTED_MODULE_1__["getRowsCount"])(items), col);
  });

  return items;
}

function getItemById(id, items) {
  const index = items.findIndex(value => value.id === id);

  return {
    index,
    item: items[index],
  };
}

function findFreeSpaceForItem(matrix, item, items = []) {
  const cols = matrix[0].length;
  let xNtime = cols - (item.w - item.responsive.valueW);

  for (var i = 0; i < matrix.length; i++) {
    const row = matrix[i];
    for (var j = 0; j < xNtime + 1; j++) {
      const sliceA = row.slice(j, j + (item.w - item.responsive.valueW));
      const empty = sliceA.every(val => val === undefined);
      if (empty) {
        const isEmpty = matrix.slice(i, i + item.h).every(a => a.slice(j, j + (item.w - item.responsive.valueW)).every(n => n === undefined));

        if (isEmpty) {
          return { y: i, x: j };
        }
      }
    }
  }

  return {
    y: Object(_other_js__WEBPACK_IMPORTED_MODULE_1__["getRowsCount"])(items),
    x: 0,
  };
}

function assignPosition(item, position, value) {
  return value.id === item.id ? { ...item, ...position } : value;
}

const replaceItem = (item, cachedItem, value) => (value.id === item.id ? cachedItem : value);

function moveItem($item, items, cols, originalItem) {
  let matrix = Object(_matrix_js__WEBPACK_IMPORTED_MODULE_0__["makeMatrixFromItemsIgnore"])(items, [$item.id], Object(_other_js__WEBPACK_IMPORTED_MODULE_1__["getRowsCount"])(items), cols);

  const closeBlocks = Object(_matrix_js__WEBPACK_IMPORTED_MODULE_0__["findCloseBlocks"])(items, matrix, $item);
  let closeObj = Object(_matrix_js__WEBPACK_IMPORTED_MODULE_0__["findItemsById"])(closeBlocks, items);

  const statics = closeObj.find(value => value.static);

  if (statics) {
    if (originalItem) {
      return items.map(replaceItem.bind(null, $item, originalItem));
    }
  }

  matrix = Object(_matrix_js__WEBPACK_IMPORTED_MODULE_0__["makeMatrixFromItemsIgnore"])(items, closeBlocks, Object(_other_js__WEBPACK_IMPORTED_MODULE_1__["getRowsCount"])(items), cols);

  let tempItems = items;

  let tempCloseBlocks = closeBlocks;

  let exclude = [];

  closeObj.forEach(item => {
    let position = findFreeSpaceForItem(matrix, item, tempItems);

    exclude.push(item.id);

    if (position) {
      tempItems = tempItems.map(assignPosition.bind(null, item, position));
      let getIgnoreItems = tempCloseBlocks.filter(value => exclude.indexOf(value) === -1);

      matrix = Object(_matrix_js__WEBPACK_IMPORTED_MODULE_0__["makeMatrixFromItemsIgnore"])(tempItems, getIgnoreItems, Object(_other_js__WEBPACK_IMPORTED_MODULE_1__["getRowsCount"])(items), cols);
    }
  });

  return tempItems;
}


/***/ }),

/***/ "./node_modules/svelte-grid/src/utils/matrix.js":
/*!******************************************************!*\
  !*** ./node_modules/svelte-grid/src/utils/matrix.js ***!
  \******************************************************/
/*! exports provided: makeMatrix, makeMatrixFromItems, findCloseBlocks, makeMatrixFromItemsIgnore, findItemsById */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "makeMatrix", function() { return makeMatrix; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "makeMatrixFromItems", function() { return makeMatrixFromItems; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "findCloseBlocks", function() { return findCloseBlocks; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "makeMatrixFromItemsIgnore", function() { return makeMatrixFromItemsIgnore; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "findItemsById", function() { return findItemsById; });
/* harmony import */ var _other_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./other.js */ "./node_modules/svelte-grid/src/utils/other.js");


const makeMatrix = (rows, cols) => Array.from(Array(rows), () => new Array(cols)); // make 2d array

function makeMatrixFromItems(items, _row = Object(_other_js__WEBPACK_IMPORTED_MODULE_0__["getRowsCount"])(items), _col) {
  let matrix = makeMatrix(_row, _col);
  for (var i = 0; i < items.length; i++) {
    const value = items[i];
    const {
      x,
      y,
      w,
      h,
      responsive: { valueW },
    } = value;

    for (var j = y; j < y + h; j++) {
      const row = matrix[j];
      for (var k = x; k < x + (w - valueW); k++) {
        row[k] = value;
      }
    }
  }
  return matrix;
}

function findCloseBlocks(items, matrix, curObject) {
  const {
    w,
    h,
    x,
    y,
    responsive: { valueW },
  } = curObject;
  const tempR = matrix.slice(y, y + h);
  let result = []; // new Set()
  for (var i = 0; i < tempR.length; i++) {
    let tempA = tempR[i].slice(x, x + (w - valueW));
    result = [...result, ...tempA.map(val => val && val.id).filter(val => val)];
  }
  return [...result.filter((item, pos) => result.indexOf(item) == pos)];
  // return [...new Set(result)];
}

function makeMatrixFromItemsIgnore(
  items,
  ignoreList,
  _row, //= getRowsCount(items)
  _col,
) {
  let matrix = makeMatrix(_row, _col);
  for (var i = 0; i < items.length; i++) {
    const value = items[i];
    const {
      x,
      y,
      w,
      h,
      id,
      responsive: { valueW },
    } = value;

    if (ignoreList.indexOf(id) === -1) {
      for (var j = y; j < y + h; j++) {
        const row = matrix[j];
        if (row) {
          for (var k = x; k < x + (w - valueW); k++) {
            row[k] = value;
          }
        }
      }
    }
  }
  return matrix;
}

function findItemsById(closeBlocks, items) {
  return items.filter(value => closeBlocks.indexOf(value.id) !== -1);
}


/***/ }),

/***/ "./node_modules/svelte-grid/src/utils/other.js":
/*!*****************************************************!*\
  !*** ./node_modules/svelte-grid/src/utils/other.js ***!
  \*****************************************************/
/*! exports provided: debounce, getTranslate, getCordinates, getRowsCount, getColumnFromBreakpoints */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "debounce", function() { return debounce; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "getTranslate", function() { return getTranslate; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "getCordinates", function() { return getCordinates; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "getRowsCount", function() { return getRowsCount; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "getColumnFromBreakpoints", function() { return getColumnFromBreakpoints; });
const debounce = (fn, ms = 0) => {
  let timeoutId;
  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), ms);
  };
};

function getTranslate(str) {
  str = str.slice(10, -3);

  var getIndex = str.indexOf("px, ");

  var x = +str.slice(0, getIndex);

  var y = +str.slice(getIndex + 4);
  return { x, y };
}

function getCordinates(event) {
  const pageX = event.changedTouches ? event.changedTouches[0].pageX : event.pageX;
  const pageY = event.changedTouches ? event.changedTouches[0].pageY : event.pageY;
  return { pageX, pageY };
}

function getRowsCount(items) {
  return Math.max(...items.map(val => val.y + val.h), 1);
}

const getColumnFromBreakpoints = (breakpoints, windowWidth, cols, initCols) => {
  var found = false,
    tempCols = cols;
  if (breakpoints) {
    for (var i = breakpoints.length - 1; i >= 0; i--) {
      const [resolution, cols] = breakpoints[i];

      if (windowWidth <= resolution) {
        found = true;
        tempCols = cols;
        break;
      }
    }
  }

  if (!found) {
    tempCols = initCols;
  }

  return tempCols;
};


/***/ }),

/***/ "./node_modules/svelte/index.mjs":
/*!***************************************!*\
  !*** ./node_modules/svelte/index.mjs ***!
  \***************************************/
/*! exports provided: afterUpdate, beforeUpdate, createEventDispatcher, getContext, onDestroy, onMount, setContext, tick */
/***/ (function(__webpack_module__, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _internal__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./internal */ "./node_modules/svelte/internal/index.mjs");
/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "afterUpdate", function() { return _internal__WEBPACK_IMPORTED_MODULE_0__["afterUpdate"]; });

/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "beforeUpdate", function() { return _internal__WEBPACK_IMPORTED_MODULE_0__["beforeUpdate"]; });

/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "createEventDispatcher", function() { return _internal__WEBPACK_IMPORTED_MODULE_0__["createEventDispatcher"]; });

/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "getContext", function() { return _internal__WEBPACK_IMPORTED_MODULE_0__["getContext"]; });

/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "onDestroy", function() { return _internal__WEBPACK_IMPORTED_MODULE_0__["onDestroy"]; });

/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "onMount", function() { return _internal__WEBPACK_IMPORTED_MODULE_0__["onMount"]; });

/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "setContext", function() { return _internal__WEBPACK_IMPORTED_MODULE_0__["setContext"]; });

/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "tick", function() { return _internal__WEBPACK_IMPORTED_MODULE_0__["tick"]; });




/***/ }),

/***/ "./node_modules/svelte/internal/index.mjs":
/*!************************************************!*\
  !*** ./node_modules/svelte/internal/index.mjs ***!
  \************************************************/
/*! exports provided: HtmlTag, SvelteComponent, SvelteComponentDev, SvelteElement, add_attribute, add_classes, add_flush_callback, add_location, add_render_callback, add_resize_listener, add_transform, afterUpdate, append, append_dev, assign, attr, attr_dev, beforeUpdate, bind, binding_callbacks, blank_object, bubble, check_outros, children, claim_element, claim_space, claim_text, clear_loops, component_subscribe, createEventDispatcher, create_animation, create_bidirectional_transition, create_in_transition, create_out_transition, create_slot, create_ssr_component, current_component, custom_event, dataset_dev, debug, destroy_block, destroy_component, destroy_each, detach, detach_after_dev, detach_before_dev, detach_between_dev, detach_dev, dirty_components, dispatch_dev, each, element, element_is, empty, escape, escaped, exclude_internal_props, fix_and_destroy_block, fix_and_outro_and_destroy_block, fix_position, flush, getContext, get_binding_group_value, get_current_component, get_slot_changes, get_slot_context, get_spread_object, get_spread_update, get_store_value, globals, group_outros, handle_promise, identity, init, insert, insert_dev, intros, invalid_attribute_name_character, is_client, is_function, is_promise, listen, listen_dev, loop, measure, missing_component, mount_component, noop, not_equal, now, null_to_empty, object_without_properties, onDestroy, onMount, once, outro_and_destroy_block, prevent_default, prop_dev, raf, run, run_all, safe_not_equal, schedule_update, select_multiple_value, select_option, select_options, select_value, self, setContext, set_attributes, set_current_component, set_custom_element_data, set_data, set_data_dev, set_input_type, set_input_value, set_now, set_raf, set_store_value, set_style, set_svg_attributes, space, spread, stop_propagation, subscribe, svg_element, text, tick, time_ranges_to_array, to_number, toggle_class, transition_in, transition_out, update_keyed_each, validate_component, validate_store, xlink_attr */
/***/ (function(__webpack_module__, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "HtmlTag", function() { return HtmlTag; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "SvelteComponent", function() { return SvelteComponent; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "SvelteComponentDev", function() { return SvelteComponentDev; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "SvelteElement", function() { return SvelteElement; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "add_attribute", function() { return add_attribute; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "add_classes", function() { return add_classes; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "add_flush_callback", function() { return add_flush_callback; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "add_location", function() { return add_location; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "add_render_callback", function() { return add_render_callback; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "add_resize_listener", function() { return add_resize_listener; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "add_transform", function() { return add_transform; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "afterUpdate", function() { return afterUpdate; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "append", function() { return append; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "append_dev", function() { return append_dev; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "assign", function() { return assign; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "attr", function() { return attr; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "attr_dev", function() { return attr_dev; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "beforeUpdate", function() { return beforeUpdate; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "bind", function() { return bind; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "binding_callbacks", function() { return binding_callbacks; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "blank_object", function() { return blank_object; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "bubble", function() { return bubble; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "check_outros", function() { return check_outros; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "children", function() { return children; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "claim_element", function() { return claim_element; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "claim_space", function() { return claim_space; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "claim_text", function() { return claim_text; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "clear_loops", function() { return clear_loops; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "component_subscribe", function() { return component_subscribe; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "createEventDispatcher", function() { return createEventDispatcher; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "create_animation", function() { return create_animation; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "create_bidirectional_transition", function() { return create_bidirectional_transition; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "create_in_transition", function() { return create_in_transition; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "create_out_transition", function() { return create_out_transition; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "create_slot", function() { return create_slot; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "create_ssr_component", function() { return create_ssr_component; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "current_component", function() { return current_component; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "custom_event", function() { return custom_event; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "dataset_dev", function() { return dataset_dev; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "debug", function() { return debug; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "destroy_block", function() { return destroy_block; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "destroy_component", function() { return destroy_component; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "destroy_each", function() { return destroy_each; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "detach", function() { return detach; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "detach_after_dev", function() { return detach_after_dev; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "detach_before_dev", function() { return detach_before_dev; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "detach_between_dev", function() { return detach_between_dev; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "detach_dev", function() { return detach_dev; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "dirty_components", function() { return dirty_components; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "dispatch_dev", function() { return dispatch_dev; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "each", function() { return each; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "element", function() { return element; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "element_is", function() { return element_is; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "empty", function() { return empty; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "escape", function() { return escape; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "escaped", function() { return escaped; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "exclude_internal_props", function() { return exclude_internal_props; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "fix_and_destroy_block", function() { return fix_and_destroy_block; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "fix_and_outro_and_destroy_block", function() { return fix_and_outro_and_destroy_block; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "fix_position", function() { return fix_position; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "flush", function() { return flush; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "getContext", function() { return getContext; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "get_binding_group_value", function() { return get_binding_group_value; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "get_current_component", function() { return get_current_component; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "get_slot_changes", function() { return get_slot_changes; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "get_slot_context", function() { return get_slot_context; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "get_spread_object", function() { return get_spread_object; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "get_spread_update", function() { return get_spread_update; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "get_store_value", function() { return get_store_value; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "globals", function() { return globals; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "group_outros", function() { return group_outros; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "handle_promise", function() { return handle_promise; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "identity", function() { return identity; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "init", function() { return init; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "insert", function() { return insert; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "insert_dev", function() { return insert_dev; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "intros", function() { return intros; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "invalid_attribute_name_character", function() { return invalid_attribute_name_character; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "is_client", function() { return is_client; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "is_function", function() { return is_function; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "is_promise", function() { return is_promise; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "listen", function() { return listen; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "listen_dev", function() { return listen_dev; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "loop", function() { return loop; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "measure", function() { return measure; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "missing_component", function() { return missing_component; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "mount_component", function() { return mount_component; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "noop", function() { return noop; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "not_equal", function() { return not_equal; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "now", function() { return now; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "null_to_empty", function() { return null_to_empty; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "object_without_properties", function() { return object_without_properties; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "onDestroy", function() { return onDestroy; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "onMount", function() { return onMount; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "once", function() { return once; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "outro_and_destroy_block", function() { return outro_and_destroy_block; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "prevent_default", function() { return prevent_default; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "prop_dev", function() { return prop_dev; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "raf", function() { return raf; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "run", function() { return run; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "run_all", function() { return run_all; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "safe_not_equal", function() { return safe_not_equal; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "schedule_update", function() { return schedule_update; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "select_multiple_value", function() { return select_multiple_value; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "select_option", function() { return select_option; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "select_options", function() { return select_options; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "select_value", function() { return select_value; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "self", function() { return self; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "setContext", function() { return setContext; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "set_attributes", function() { return set_attributes; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "set_current_component", function() { return set_current_component; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "set_custom_element_data", function() { return set_custom_element_data; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "set_data", function() { return set_data; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "set_data_dev", function() { return set_data_dev; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "set_input_type", function() { return set_input_type; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "set_input_value", function() { return set_input_value; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "set_now", function() { return set_now; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "set_raf", function() { return set_raf; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "set_store_value", function() { return set_store_value; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "set_style", function() { return set_style; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "set_svg_attributes", function() { return set_svg_attributes; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "space", function() { return space; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "spread", function() { return spread; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "stop_propagation", function() { return stop_propagation; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "subscribe", function() { return subscribe; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "svg_element", function() { return svg_element; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "text", function() { return text; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "tick", function() { return tick; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "time_ranges_to_array", function() { return time_ranges_to_array; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "to_number", function() { return to_number; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "toggle_class", function() { return toggle_class; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "transition_in", function() { return transition_in; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "transition_out", function() { return transition_out; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "update_keyed_each", function() { return update_keyed_each; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "validate_component", function() { return validate_component; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "validate_store", function() { return validate_store; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "xlink_attr", function() { return xlink_attr; });
function noop() { }
const identity = x => x;
function assign(tar, src) {
    // @ts-ignore
    for (const k in src)
        tar[k] = src[k];
    return tar;
}
function is_promise(value) {
    return value && typeof value === 'object' && typeof value.then === 'function';
}
function add_location(element, file, line, column, char) {
    element.__svelte_meta = {
        loc: { file, line, column, char }
    };
}
function run(fn) {
    return fn();
}
function blank_object() {
    return Object.create(null);
}
function run_all(fns) {
    fns.forEach(run);
}
function is_function(thing) {
    return typeof thing === 'function';
}
function safe_not_equal(a, b) {
    return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
}
function not_equal(a, b) {
    return a != a ? b == b : a !== b;
}
function validate_store(store, name) {
    if (!store || typeof store.subscribe !== 'function') {
        throw new Error(`'${name}' is not a store with a 'subscribe' method`);
    }
}
function subscribe(store, callback) {
    const unsub = store.subscribe(callback);
    return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
}
function get_store_value(store) {
    let value;
    subscribe(store, _ => value = _)();
    return value;
}
function component_subscribe(component, store, callback) {
    component.$$.on_destroy.push(subscribe(store, callback));
}
function create_slot(definition, ctx, fn) {
    if (definition) {
        const slot_ctx = get_slot_context(definition, ctx, fn);
        return definition[0](slot_ctx);
    }
}
function get_slot_context(definition, ctx, fn) {
    return definition[1]
        ? assign({}, assign(ctx.$$scope.ctx, definition[1](fn ? fn(ctx) : {})))
        : ctx.$$scope.ctx;
}
function get_slot_changes(definition, ctx, changed, fn) {
    return definition[1]
        ? assign({}, assign(ctx.$$scope.changed || {}, definition[1](fn ? fn(changed) : {})))
        : ctx.$$scope.changed || {};
}
function exclude_internal_props(props) {
    const result = {};
    for (const k in props)
        if (k[0] !== '$')
            result[k] = props[k];
    return result;
}
function once(fn) {
    let ran = false;
    return function (...args) {
        if (ran)
            return;
        ran = true;
        fn.call(this, ...args);
    };
}
function null_to_empty(value) {
    return value == null ? '' : value;
}
function set_store_value(store, ret, value = ret) {
    store.set(value);
    return ret;
}

const is_client = typeof window !== 'undefined';
let now = is_client
    ? () => window.performance.now()
    : () => Date.now();
let raf = is_client ? cb => requestAnimationFrame(cb) : noop;
// used internally for testing
function set_now(fn) {
    now = fn;
}
function set_raf(fn) {
    raf = fn;
}

const tasks = new Set();
let running = false;
function run_tasks() {
    tasks.forEach(task => {
        if (!task[0](now())) {
            tasks.delete(task);
            task[1]();
        }
    });
    running = tasks.size > 0;
    if (running)
        raf(run_tasks);
}
function clear_loops() {
    // for testing...
    tasks.forEach(task => tasks.delete(task));
    running = false;
}
function loop(fn) {
    let task;
    if (!running) {
        running = true;
        raf(run_tasks);
    }
    return {
        promise: new Promise(fulfil => {
            tasks.add(task = [fn, fulfil]);
        }),
        abort() {
            tasks.delete(task);
        }
    };
}

function append(target, node) {
    target.appendChild(node);
}
function insert(target, node, anchor) {
    target.insertBefore(node, anchor || null);
}
function detach(node) {
    node.parentNode.removeChild(node);
}
function destroy_each(iterations, detaching) {
    for (let i = 0; i < iterations.length; i += 1) {
        if (iterations[i])
            iterations[i].d(detaching);
    }
}
function element(name) {
    return document.createElement(name);
}
function element_is(name, is) {
    return document.createElement(name, { is });
}
function object_without_properties(obj, exclude) {
    // eslint-disable-next-line @typescript-eslint/no-object-literal-type-assertion
    const target = {};
    for (const k in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, k)
            // @ts-ignore
            && exclude.indexOf(k) === -1) {
            // @ts-ignore
            target[k] = obj[k];
        }
    }
    return target;
}
function svg_element(name) {
    return document.createElementNS('http://www.w3.org/2000/svg', name);
}
function text(data) {
    return document.createTextNode(data);
}
function space() {
    return text(' ');
}
function empty() {
    return text('');
}
function listen(node, event, handler, options) {
    node.addEventListener(event, handler, options);
    return () => node.removeEventListener(event, handler, options);
}
function prevent_default(fn) {
    return function (event) {
        event.preventDefault();
        // @ts-ignore
        return fn.call(this, event);
    };
}
function stop_propagation(fn) {
    return function (event) {
        event.stopPropagation();
        // @ts-ignore
        return fn.call(this, event);
    };
}
function self(fn) {
    return function (event) {
        // @ts-ignore
        if (event.target === this)
            fn.call(this, event);
    };
}
function attr(node, attribute, value) {
    if (value == null)
        node.removeAttribute(attribute);
    else
        node.setAttribute(attribute, value);
}
function set_attributes(node, attributes) {
    for (const key in attributes) {
        if (key === 'style') {
            node.style.cssText = attributes[key];
        }
        else if (key in node) {
            node[key] = attributes[key];
        }
        else {
            attr(node, key, attributes[key]);
        }
    }
}
function set_svg_attributes(node, attributes) {
    for (const key in attributes) {
        attr(node, key, attributes[key]);
    }
}
function set_custom_element_data(node, prop, value) {
    if (prop in node) {
        node[prop] = value;
    }
    else {
        attr(node, prop, value);
    }
}
function xlink_attr(node, attribute, value) {
    node.setAttributeNS('http://www.w3.org/1999/xlink', attribute, value);
}
function get_binding_group_value(group) {
    const value = [];
    for (let i = 0; i < group.length; i += 1) {
        if (group[i].checked)
            value.push(group[i].__value);
    }
    return value;
}
function to_number(value) {
    return value === '' ? undefined : +value;
}
function time_ranges_to_array(ranges) {
    const array = [];
    for (let i = 0; i < ranges.length; i += 1) {
        array.push({ start: ranges.start(i), end: ranges.end(i) });
    }
    return array;
}
function children(element) {
    return Array.from(element.childNodes);
}
function claim_element(nodes, name, attributes, svg) {
    for (let i = 0; i < nodes.length; i += 1) {
        const node = nodes[i];
        if (node.nodeName === name) {
            for (let j = 0; j < node.attributes.length; j += 1) {
                const attribute = node.attributes[j];
                if (!attributes[attribute.name])
                    node.removeAttribute(attribute.name);
            }
            return nodes.splice(i, 1)[0]; // TODO strip unwanted attributes
        }
    }
    return svg ? svg_element(name) : element(name);
}
function claim_text(nodes, data) {
    for (let i = 0; i < nodes.length; i += 1) {
        const node = nodes[i];
        if (node.nodeType === 3) {
            node.data = '' + data;
            return nodes.splice(i, 1)[0];
        }
    }
    return text(data);
}
function claim_space(nodes) {
    return claim_text(nodes, ' ');
}
function set_data(text, data) {
    data = '' + data;
    if (text.data !== data)
        text.data = data;
}
function set_input_value(input, value) {
    if (value != null || input.value) {
        input.value = value;
    }
}
function set_input_type(input, type) {
    try {
        input.type = type;
    }
    catch (e) {
        // do nothing
    }
}
function set_style(node, key, value, important) {
    node.style.setProperty(key, value, important ? 'important' : '');
}
function select_option(select, value) {
    for (let i = 0; i < select.options.length; i += 1) {
        const option = select.options[i];
        if (option.__value === value) {
            option.selected = true;
            return;
        }
    }
}
function select_options(select, value) {
    for (let i = 0; i < select.options.length; i += 1) {
        const option = select.options[i];
        option.selected = ~value.indexOf(option.__value);
    }
}
function select_value(select) {
    const selected_option = select.querySelector(':checked') || select.options[0];
    return selected_option && selected_option.__value;
}
function select_multiple_value(select) {
    return [].map.call(select.querySelectorAll(':checked'), option => option.__value);
}
function add_resize_listener(element, fn) {
    if (getComputedStyle(element).position === 'static') {
        element.style.position = 'relative';
    }
    const object = document.createElement('object');
    object.setAttribute('style', 'display: block; position: absolute; top: 0; left: 0; height: 100%; width: 100%; overflow: hidden; pointer-events: none; z-index: -1;');
    object.type = 'text/html';
    object.tabIndex = -1;
    let win;
    object.onload = () => {
        win = object.contentDocument.defaultView;
        win.addEventListener('resize', fn);
    };
    if (/Trident/.test(navigator.userAgent)) {
        element.appendChild(object);
        object.data = 'about:blank';
    }
    else {
        object.data = 'about:blank';
        element.appendChild(object);
    }
    return {
        cancel: () => {
            win && win.removeEventListener && win.removeEventListener('resize', fn);
            element.removeChild(object);
        }
    };
}
function toggle_class(element, name, toggle) {
    element.classList[toggle ? 'add' : 'remove'](name);
}
function custom_event(type, detail) {
    const e = document.createEvent('CustomEvent');
    e.initCustomEvent(type, false, false, detail);
    return e;
}
class HtmlTag {
    constructor(html, anchor = null) {
        this.e = element('div');
        this.a = anchor;
        this.u(html);
    }
    m(target, anchor = null) {
        for (let i = 0; i < this.n.length; i += 1) {
            insert(target, this.n[i], anchor);
        }
        this.t = target;
    }
    u(html) {
        this.e.innerHTML = html;
        this.n = Array.from(this.e.childNodes);
    }
    p(html) {
        this.d();
        this.u(html);
        this.m(this.t, this.a);
    }
    d() {
        this.n.forEach(detach);
    }
}

let stylesheet;
let active = 0;
let current_rules = {};
// https://github.com/darkskyapp/string-hash/blob/master/index.js
function hash(str) {
    let hash = 5381;
    let i = str.length;
    while (i--)
        hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
    return hash >>> 0;
}
function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
    const step = 16.666 / duration;
    let keyframes = '{\n';
    for (let p = 0; p <= 1; p += step) {
        const t = a + (b - a) * ease(p);
        keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
    }
    const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
    const name = `__svelte_${hash(rule)}_${uid}`;
    if (!current_rules[name]) {
        if (!stylesheet) {
            const style = element('style');
            document.head.appendChild(style);
            stylesheet = style.sheet;
        }
        current_rules[name] = true;
        stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
    }
    const animation = node.style.animation || '';
    node.style.animation = `${animation ? `${animation}, ` : ``}${name} ${duration}ms linear ${delay}ms 1 both`;
    active += 1;
    return name;
}
function delete_rule(node, name) {
    node.style.animation = (node.style.animation || '')
        .split(', ')
        .filter(name
        ? anim => anim.indexOf(name) < 0 // remove specific animation
        : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
    )
        .join(', ');
    if (name && !--active)
        clear_rules();
}
function clear_rules() {
    raf(() => {
        if (active)
            return;
        let i = stylesheet.cssRules.length;
        while (i--)
            stylesheet.deleteRule(i);
        current_rules = {};
    });
}

function create_animation(node, from, fn, params) {
    if (!from)
        return noop;
    const to = node.getBoundingClientRect();
    if (from.left === to.left && from.right === to.right && from.top === to.top && from.bottom === to.bottom)
        return noop;
    const { delay = 0, duration = 300, easing = identity, 
    // @ts-ignore todo: should this be separated from destructuring? Or start/end added to public api and documentation?
    start: start_time = now() + delay, 
    // @ts-ignore todo:
    end = start_time + duration, tick = noop, css } = fn(node, { from, to }, params);
    let running = true;
    let started = false;
    let name;
    function start() {
        if (css) {
            name = create_rule(node, 0, 1, duration, delay, easing, css);
        }
        if (!delay) {
            started = true;
        }
    }
    function stop() {
        if (css)
            delete_rule(node, name);
        running = false;
    }
    loop(now => {
        if (!started && now >= start_time) {
            started = true;
        }
        if (started && now >= end) {
            tick(1, 0);
            stop();
        }
        if (!running) {
            return false;
        }
        if (started) {
            const p = now - start_time;
            const t = 0 + 1 * easing(p / duration);
            tick(t, 1 - t);
        }
        return true;
    });
    start();
    tick(0, 1);
    return stop;
}
function fix_position(node) {
    const style = getComputedStyle(node);
    if (style.position !== 'absolute' && style.position !== 'fixed') {
        const { width, height } = style;
        const a = node.getBoundingClientRect();
        node.style.position = 'absolute';
        node.style.width = width;
        node.style.height = height;
        add_transform(node, a);
    }
}
function add_transform(node, a) {
    const b = node.getBoundingClientRect();
    if (a.left !== b.left || a.top !== b.top) {
        const style = getComputedStyle(node);
        const transform = style.transform === 'none' ? '' : style.transform;
        node.style.transform = `${transform} translate(${a.left - b.left}px, ${a.top - b.top}px)`;
    }
}

let current_component;
function set_current_component(component) {
    current_component = component;
}
function get_current_component() {
    if (!current_component)
        throw new Error(`Function called outside component initialization`);
    return current_component;
}
function beforeUpdate(fn) {
    get_current_component().$$.before_update.push(fn);
}
function onMount(fn) {
    get_current_component().$$.on_mount.push(fn);
}
function afterUpdate(fn) {
    get_current_component().$$.after_update.push(fn);
}
function onDestroy(fn) {
    get_current_component().$$.on_destroy.push(fn);
}
function createEventDispatcher() {
    const component = current_component;
    return (type, detail) => {
        const callbacks = component.$$.callbacks[type];
        if (callbacks) {
            // TODO are there situations where events could be dispatched
            // in a server (non-DOM) environment?
            const event = custom_event(type, detail);
            callbacks.slice().forEach(fn => {
                fn.call(component, event);
            });
        }
    };
}
function setContext(key, context) {
    get_current_component().$$.context.set(key, context);
}
function getContext(key) {
    return get_current_component().$$.context.get(key);
}
// TODO figure out if we still want to support
// shorthand events, or if we want to implement
// a real bubbling mechanism
function bubble(component, event) {
    const callbacks = component.$$.callbacks[event.type];
    if (callbacks) {
        callbacks.slice().forEach(fn => fn(event));
    }
}

const dirty_components = [];
const intros = { enabled: false };
const binding_callbacks = [];
const render_callbacks = [];
const flush_callbacks = [];
const resolved_promise = Promise.resolve();
let update_scheduled = false;
function schedule_update() {
    if (!update_scheduled) {
        update_scheduled = true;
        resolved_promise.then(flush);
    }
}
function tick() {
    schedule_update();
    return resolved_promise;
}
function add_render_callback(fn) {
    render_callbacks.push(fn);
}
function add_flush_callback(fn) {
    flush_callbacks.push(fn);
}
function flush() {
    const seen_callbacks = new Set();
    do {
        // first, call beforeUpdate functions
        // and update components
        while (dirty_components.length) {
            const component = dirty_components.shift();
            set_current_component(component);
            update(component.$$);
        }
        while (binding_callbacks.length)
            binding_callbacks.pop()();
        // then, once components are updated, call
        // afterUpdate functions. This may cause
        // subsequent updates...
        for (let i = 0; i < render_callbacks.length; i += 1) {
            const callback = render_callbacks[i];
            if (!seen_callbacks.has(callback)) {
                callback();
                // ...so guard against infinite loops
                seen_callbacks.add(callback);
            }
        }
        render_callbacks.length = 0;
    } while (dirty_components.length);
    while (flush_callbacks.length) {
        flush_callbacks.pop()();
    }
    update_scheduled = false;
}
function update($$) {
    if ($$.fragment) {
        $$.update($$.dirty);
        run_all($$.before_update);
        $$.fragment.p($$.dirty, $$.ctx);
        $$.dirty = null;
        $$.after_update.forEach(add_render_callback);
    }
}

let promise;
function wait() {
    if (!promise) {
        promise = Promise.resolve();
        promise.then(() => {
            promise = null;
        });
    }
    return promise;
}
function dispatch(node, direction, kind) {
    node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
}
const outroing = new Set();
let outros;
function group_outros() {
    outros = {
        r: 0,
        c: [],
        p: outros // parent group
    };
}
function check_outros() {
    if (!outros.r) {
        run_all(outros.c);
    }
    outros = outros.p;
}
function transition_in(block, local) {
    if (block && block.i) {
        outroing.delete(block);
        block.i(local);
    }
}
function transition_out(block, local, detach, callback) {
    if (block && block.o) {
        if (outroing.has(block))
            return;
        outroing.add(block);
        outros.c.push(() => {
            outroing.delete(block);
            if (callback) {
                if (detach)
                    block.d(1);
                callback();
            }
        });
        block.o(local);
    }
}
const null_transition = { duration: 0 };
function create_in_transition(node, fn, params) {
    let config = fn(node, params);
    let running = false;
    let animation_name;
    let task;
    let uid = 0;
    function cleanup() {
        if (animation_name)
            delete_rule(node, animation_name);
    }
    function go() {
        const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
        if (css)
            animation_name = create_rule(node, 0, 1, duration, delay, easing, css, uid++);
        tick(0, 1);
        const start_time = now() + delay;
        const end_time = start_time + duration;
        if (task)
            task.abort();
        running = true;
        add_render_callback(() => dispatch(node, true, 'start'));
        task = loop(now => {
            if (running) {
                if (now >= end_time) {
                    tick(1, 0);
                    dispatch(node, true, 'end');
                    cleanup();
                    return running = false;
                }
                if (now >= start_time) {
                    const t = easing((now - start_time) / duration);
                    tick(t, 1 - t);
                }
            }
            return running;
        });
    }
    let started = false;
    return {
        start() {
            if (started)
                return;
            delete_rule(node);
            if (is_function(config)) {
                config = config();
                wait().then(go);
            }
            else {
                go();
            }
        },
        invalidate() {
            started = false;
        },
        end() {
            if (running) {
                cleanup();
                running = false;
            }
        }
    };
}
function create_out_transition(node, fn, params) {
    let config = fn(node, params);
    let running = true;
    let animation_name;
    const group = outros;
    group.r += 1;
    function go() {
        const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
        if (css)
            animation_name = create_rule(node, 1, 0, duration, delay, easing, css);
        const start_time = now() + delay;
        const end_time = start_time + duration;
        add_render_callback(() => dispatch(node, false, 'start'));
        loop(now => {
            if (running) {
                if (now >= end_time) {
                    tick(0, 1);
                    dispatch(node, false, 'end');
                    if (!--group.r) {
                        // this will result in `end()` being called,
                        // so we don't need to clean up here
                        run_all(group.c);
                    }
                    return false;
                }
                if (now >= start_time) {
                    const t = easing((now - start_time) / duration);
                    tick(1 - t, t);
                }
            }
            return running;
        });
    }
    if (is_function(config)) {
        wait().then(() => {
            // @ts-ignore
            config = config();
            go();
        });
    }
    else {
        go();
    }
    return {
        end(reset) {
            if (reset && config.tick) {
                config.tick(1, 0);
            }
            if (running) {
                if (animation_name)
                    delete_rule(node, animation_name);
                running = false;
            }
        }
    };
}
function create_bidirectional_transition(node, fn, params, intro) {
    let config = fn(node, params);
    let t = intro ? 0 : 1;
    let running_program = null;
    let pending_program = null;
    let animation_name = null;
    function clear_animation() {
        if (animation_name)
            delete_rule(node, animation_name);
    }
    function init(program, duration) {
        const d = program.b - t;
        duration *= Math.abs(d);
        return {
            a: t,
            b: program.b,
            d,
            duration,
            start: program.start,
            end: program.start + duration,
            group: program.group
        };
    }
    function go(b) {
        const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
        const program = {
            start: now() + delay,
            b
        };
        if (!b) {
            // @ts-ignore todo: improve typings
            program.group = outros;
            outros.r += 1;
        }
        if (running_program) {
            pending_program = program;
        }
        else {
            // if this is an intro, and there's a delay, we need to do
            // an initial tick and/or apply CSS animation immediately
            if (css) {
                clear_animation();
                animation_name = create_rule(node, t, b, duration, delay, easing, css);
            }
            if (b)
                tick(0, 1);
            running_program = init(program, duration);
            add_render_callback(() => dispatch(node, b, 'start'));
            loop(now => {
                if (pending_program && now > pending_program.start) {
                    running_program = init(pending_program, duration);
                    pending_program = null;
                    dispatch(node, running_program.b, 'start');
                    if (css) {
                        clear_animation();
                        animation_name = create_rule(node, t, running_program.b, running_program.duration, 0, easing, config.css);
                    }
                }
                if (running_program) {
                    if (now >= running_program.end) {
                        tick(t = running_program.b, 1 - t);
                        dispatch(node, running_program.b, 'end');
                        if (!pending_program) {
                            // we're done
                            if (running_program.b) {
                                // intro — we can tidy up immediately
                                clear_animation();
                            }
                            else {
                                // outro — needs to be coordinated
                                if (!--running_program.group.r)
                                    run_all(running_program.group.c);
                            }
                        }
                        running_program = null;
                    }
                    else if (now >= running_program.start) {
                        const p = now - running_program.start;
                        t = running_program.a + running_program.d * easing(p / running_program.duration);
                        tick(t, 1 - t);
                    }
                }
                return !!(running_program || pending_program);
            });
        }
    }
    return {
        run(b) {
            if (is_function(config)) {
                wait().then(() => {
                    // @ts-ignore
                    config = config();
                    go(b);
                });
            }
            else {
                go(b);
            }
        },
        end() {
            clear_animation();
            running_program = pending_program = null;
        }
    };
}

function handle_promise(promise, info) {
    const token = info.token = {};
    function update(type, index, key, value) {
        if (info.token !== token)
            return;
        info.resolved = key && { [key]: value };
        const child_ctx = assign(assign({}, info.ctx), info.resolved);
        const block = type && (info.current = type)(child_ctx);
        if (info.block) {
            if (info.blocks) {
                info.blocks.forEach((block, i) => {
                    if (i !== index && block) {
                        group_outros();
                        transition_out(block, 1, 1, () => {
                            info.blocks[i] = null;
                        });
                        check_outros();
                    }
                });
            }
            else {
                info.block.d(1);
            }
            block.c();
            transition_in(block, 1);
            block.m(info.mount(), info.anchor);
            flush();
        }
        info.block = block;
        if (info.blocks)
            info.blocks[index] = block;
    }
    if (is_promise(promise)) {
        const current_component = get_current_component();
        promise.then(value => {
            set_current_component(current_component);
            update(info.then, 1, info.value, value);
            set_current_component(null);
        }, error => {
            set_current_component(current_component);
            update(info.catch, 2, info.error, error);
            set_current_component(null);
        });
        // if we previously had a then/catch block, destroy it
        if (info.current !== info.pending) {
            update(info.pending, 0);
            return true;
        }
    }
    else {
        if (info.current !== info.then) {
            update(info.then, 1, info.value, promise);
            return true;
        }
        info.resolved = { [info.value]: promise };
    }
}

const globals = (typeof window !== 'undefined' ? window : global);

function destroy_block(block, lookup) {
    block.d(1);
    lookup.delete(block.key);
}
function outro_and_destroy_block(block, lookup) {
    transition_out(block, 1, 1, () => {
        lookup.delete(block.key);
    });
}
function fix_and_destroy_block(block, lookup) {
    block.f();
    destroy_block(block, lookup);
}
function fix_and_outro_and_destroy_block(block, lookup) {
    block.f();
    outro_and_destroy_block(block, lookup);
}
function update_keyed_each(old_blocks, changed, get_key, dynamic, ctx, list, lookup, node, destroy, create_each_block, next, get_context) {
    let o = old_blocks.length;
    let n = list.length;
    let i = o;
    const old_indexes = {};
    while (i--)
        old_indexes[old_blocks[i].key] = i;
    const new_blocks = [];
    const new_lookup = new Map();
    const deltas = new Map();
    i = n;
    while (i--) {
        const child_ctx = get_context(ctx, list, i);
        const key = get_key(child_ctx);
        let block = lookup.get(key);
        if (!block) {
            block = create_each_block(key, child_ctx);
            block.c();
        }
        else if (dynamic) {
            block.p(changed, child_ctx);
        }
        new_lookup.set(key, new_blocks[i] = block);
        if (key in old_indexes)
            deltas.set(key, Math.abs(i - old_indexes[key]));
    }
    const will_move = new Set();
    const did_move = new Set();
    function insert(block) {
        transition_in(block, 1);
        block.m(node, next);
        lookup.set(block.key, block);
        next = block.first;
        n--;
    }
    while (o && n) {
        const new_block = new_blocks[n - 1];
        const old_block = old_blocks[o - 1];
        const new_key = new_block.key;
        const old_key = old_block.key;
        if (new_block === old_block) {
            // do nothing
            next = new_block.first;
            o--;
            n--;
        }
        else if (!new_lookup.has(old_key)) {
            // remove old block
            destroy(old_block, lookup);
            o--;
        }
        else if (!lookup.has(new_key) || will_move.has(new_key)) {
            insert(new_block);
        }
        else if (did_move.has(old_key)) {
            o--;
        }
        else if (deltas.get(new_key) > deltas.get(old_key)) {
            did_move.add(new_key);
            insert(new_block);
        }
        else {
            will_move.add(old_key);
            o--;
        }
    }
    while (o--) {
        const old_block = old_blocks[o];
        if (!new_lookup.has(old_block.key))
            destroy(old_block, lookup);
    }
    while (n)
        insert(new_blocks[n - 1]);
    return new_blocks;
}
function measure(blocks) {
    const rects = {};
    let i = blocks.length;
    while (i--)
        rects[blocks[i].key] = blocks[i].node.getBoundingClientRect();
    return rects;
}

function get_spread_update(levels, updates) {
    const update = {};
    const to_null_out = {};
    const accounted_for = { $$scope: 1 };
    let i = levels.length;
    while (i--) {
        const o = levels[i];
        const n = updates[i];
        if (n) {
            for (const key in o) {
                if (!(key in n))
                    to_null_out[key] = 1;
            }
            for (const key in n) {
                if (!accounted_for[key]) {
                    update[key] = n[key];
                    accounted_for[key] = 1;
                }
            }
            levels[i] = n;
        }
        else {
            for (const key in o) {
                accounted_for[key] = 1;
            }
        }
    }
    for (const key in to_null_out) {
        if (!(key in update))
            update[key] = undefined;
    }
    return update;
}
function get_spread_object(spread_props) {
    return typeof spread_props === 'object' && spread_props !== null ? spread_props : {};
}

const invalid_attribute_name_character = /[\s'">/=\u{FDD0}-\u{FDEF}\u{FFFE}\u{FFFF}\u{1FFFE}\u{1FFFF}\u{2FFFE}\u{2FFFF}\u{3FFFE}\u{3FFFF}\u{4FFFE}\u{4FFFF}\u{5FFFE}\u{5FFFF}\u{6FFFE}\u{6FFFF}\u{7FFFE}\u{7FFFF}\u{8FFFE}\u{8FFFF}\u{9FFFE}\u{9FFFF}\u{AFFFE}\u{AFFFF}\u{BFFFE}\u{BFFFF}\u{CFFFE}\u{CFFFF}\u{DFFFE}\u{DFFFF}\u{EFFFE}\u{EFFFF}\u{FFFFE}\u{FFFFF}\u{10FFFE}\u{10FFFF}]/u;
// https://html.spec.whatwg.org/multipage/syntax.html#attributes-2
// https://infra.spec.whatwg.org/#noncharacter
function spread(args) {
    const attributes = Object.assign({}, ...args);
    let str = '';
    Object.keys(attributes).forEach(name => {
        if (invalid_attribute_name_character.test(name))
            return;
        const value = attributes[name];
        if (value === undefined)
            return;
        if (value === true)
            str += " " + name;
        const escaped = String(value)
            .replace(/"/g, '&#34;')
            .replace(/'/g, '&#39;');
        str += " " + name + "=" + JSON.stringify(escaped);
    });
    return str;
}
const escaped = {
    '"': '&quot;',
    "'": '&#39;',
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;'
};
function escape(html) {
    return String(html).replace(/["'&<>]/g, match => escaped[match]);
}
function each(items, fn) {
    let str = '';
    for (let i = 0; i < items.length; i += 1) {
        str += fn(items[i], i);
    }
    return str;
}
const missing_component = {
    $$render: () => ''
};
function validate_component(component, name) {
    if (!component || !component.$$render) {
        if (name === 'svelte:component')
            name += ' this={...}';
        throw new Error(`<${name}> is not a valid SSR component. You may need to review your build config to ensure that dependencies are compiled, rather than imported as pre-compiled modules`);
    }
    return component;
}
function debug(file, line, column, values) {
    console.log(`{@debug} ${file ? file + ' ' : ''}(${line}:${column})`); // eslint-disable-line no-console
    console.log(values); // eslint-disable-line no-console
    return '';
}
let on_destroy;
function create_ssr_component(fn) {
    function $$render(result, props, bindings, slots) {
        const parent_component = current_component;
        const $$ = {
            on_destroy,
            context: new Map(parent_component ? parent_component.$$.context : []),
            // these will be immediately discarded
            on_mount: [],
            before_update: [],
            after_update: [],
            callbacks: blank_object()
        };
        set_current_component({ $$ });
        const html = fn(result, props, bindings, slots);
        set_current_component(parent_component);
        return html;
    }
    return {
        render: (props = {}, options = {}) => {
            on_destroy = [];
            const result = { head: '', css: new Set() };
            const html = $$render(result, props, {}, options);
            run_all(on_destroy);
            return {
                html,
                css: {
                    code: Array.from(result.css).map(css => css.code).join('\n'),
                    map: null // TODO
                },
                head: result.head
            };
        },
        $$render
    };
}
function add_attribute(name, value, boolean) {
    if (value == null || (boolean && !value))
        return '';
    return ` ${name}${value === true ? '' : `=${typeof value === 'string' ? JSON.stringify(escape(value)) : `"${value}"`}`}`;
}
function add_classes(classes) {
    return classes ? ` class="${classes}"` : ``;
}

function bind(component, name, callback) {
    if (component.$$.props.indexOf(name) === -1)
        return;
    component.$$.bound[name] = callback;
    callback(component.$$.ctx[name]);
}
function mount_component(component, target, anchor) {
    const { fragment, on_mount, on_destroy, after_update } = component.$$;
    fragment.m(target, anchor);
    // onMount happens before the initial afterUpdate
    add_render_callback(() => {
        const new_on_destroy = on_mount.map(run).filter(is_function);
        if (on_destroy) {
            on_destroy.push(...new_on_destroy);
        }
        else {
            // Edge case - component was destroyed immediately,
            // most likely as a result of a binding initialising
            run_all(new_on_destroy);
        }
        component.$$.on_mount = [];
    });
    after_update.forEach(add_render_callback);
}
function destroy_component(component, detaching) {
    if (component.$$.fragment) {
        run_all(component.$$.on_destroy);
        component.$$.fragment.d(detaching);
        // TODO null out other refs, including component.$$ (but need to
        // preserve final state?)
        component.$$.on_destroy = component.$$.fragment = null;
        component.$$.ctx = {};
    }
}
function make_dirty(component, key) {
    if (!component.$$.dirty) {
        dirty_components.push(component);
        schedule_update();
        component.$$.dirty = blank_object();
    }
    component.$$.dirty[key] = true;
}
function init(component, options, instance, create_fragment, not_equal, prop_names) {
    const parent_component = current_component;
    set_current_component(component);
    const props = options.props || {};
    const $$ = component.$$ = {
        fragment: null,
        ctx: null,
        // state
        props: prop_names,
        update: noop,
        not_equal,
        bound: blank_object(),
        // lifecycle
        on_mount: [],
        on_destroy: [],
        before_update: [],
        after_update: [],
        context: new Map(parent_component ? parent_component.$$.context : []),
        // everything else
        callbacks: blank_object(),
        dirty: null
    };
    let ready = false;
    $$.ctx = instance
        ? instance(component, props, (key, ret, value = ret) => {
            if ($$.ctx && not_equal($$.ctx[key], $$.ctx[key] = value)) {
                if ($$.bound[key])
                    $$.bound[key](value);
                if (ready)
                    make_dirty(component, key);
            }
            return ret;
        })
        : props;
    $$.update();
    ready = true;
    run_all($$.before_update);
    $$.fragment = create_fragment($$.ctx);
    if (options.target) {
        if (options.hydrate) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment.l(children(options.target));
        }
        else {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment.c();
        }
        if (options.intro)
            transition_in(component.$$.fragment);
        mount_component(component, options.target, options.anchor);
        flush();
    }
    set_current_component(parent_component);
}
let SvelteElement;
if (typeof HTMLElement !== 'undefined') {
    SvelteElement = class extends HTMLElement {
        constructor() {
            super();
            this.attachShadow({ mode: 'open' });
        }
        connectedCallback() {
            // @ts-ignore todo: improve typings
            for (const key in this.$$.slotted) {
                // @ts-ignore todo: improve typings
                this.appendChild(this.$$.slotted[key]);
            }
        }
        attributeChangedCallback(attr, _oldValue, newValue) {
            this[attr] = newValue;
        }
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            // TODO should this delegate to addEventListener?
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set() {
            // overridden by instance, if it has props
        }
    };
}
class SvelteComponent {
    $destroy() {
        destroy_component(this, 1);
        this.$destroy = noop;
    }
    $on(type, callback) {
        const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
        callbacks.push(callback);
        return () => {
            const index = callbacks.indexOf(callback);
            if (index !== -1)
                callbacks.splice(index, 1);
        };
    }
    $set() {
        // overridden by instance, if it has props
    }
}

function dispatch_dev(type, detail) {
    document.dispatchEvent(custom_event(type, detail));
}
function append_dev(target, node) {
    dispatch_dev("SvelteDOMInsert", { target, node });
    append(target, node);
}
function insert_dev(target, node, anchor) {
    dispatch_dev("SvelteDOMInsert", { target, node, anchor });
    insert(target, node, anchor);
}
function detach_dev(node) {
    dispatch_dev("SvelteDOMRemove", { node });
    detach(node);
}
function detach_between_dev(before, after) {
    while (before.nextSibling && before.nextSibling !== after) {
        detach_dev(before.nextSibling);
    }
}
function detach_before_dev(after) {
    while (after.previousSibling) {
        detach_dev(after.previousSibling);
    }
}
function detach_after_dev(before) {
    while (before.nextSibling) {
        detach_dev(before.nextSibling);
    }
}
function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
    const modifiers = options === true ? ["capture"] : options ? Array.from(Object.keys(options)) : [];
    if (has_prevent_default)
        modifiers.push('preventDefault');
    if (has_stop_propagation)
        modifiers.push('stopPropagation');
    dispatch_dev("SvelteDOMAddEventListener", { node, event, handler, modifiers });
    const dispose = listen(node, event, handler, options);
    return () => {
        dispatch_dev("SvelteDOMRemoveEventListener", { node, event, handler, modifiers });
        dispose();
    };
}
function attr_dev(node, attribute, value) {
    attr(node, attribute, value);
    if (value == null)
        dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
    else
        dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
}
function prop_dev(node, property, value) {
    node[property] = value;
    dispatch_dev("SvelteDOMSetProperty", { node, property, value });
}
function dataset_dev(node, property, value) {
    node.dataset[property] = value;
    dispatch_dev("SvelteDOMSetDataset", { node, property, value });
}
function set_data_dev(text, data) {
    data = '' + data;
    if (text.data === data)
        return;
    dispatch_dev("SvelteDOMSetData", { node: text, data });
    text.data = data;
}
class SvelteComponentDev extends SvelteComponent {
    constructor(options) {
        if (!options || (!options.target && !options.$$inline)) {
            throw new Error(`'target' is a required option`);
        }
        super();
    }
    $destroy() {
        super.$destroy();
        this.$destroy = () => {
            console.warn(`Component was already destroyed`); // eslint-disable-line no-console
        };
    }
}




/***/ }),

/***/ "./node_modules/webpack/buildin/global.js":
/*!***********************************!*\
  !*** (webpack)/buildin/global.js ***!
  \***********************************/
/*! no static exports found */
/***/ (function(module, exports) {

var g;

// This works in non-strict mode
g = (function() {
	return this;
})();

try {
	// This works if eval is allowed (see CSP)
	g = g || new Function("return this")();
} catch (e) {
	// This works if the window reference is available
	if (typeof window === "object") g = window;
}

// g can still be undefined, but nothing to do about it...
// We return undefined, instead of nothing here, so it's
// easier to handle this case. if(!global) { ...}

module.exports = g;


/***/ }),

/***/ "./node_modules/webpack/buildin/module.js":
/*!***********************************!*\
  !*** (webpack)/buildin/module.js ***!
  \***********************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = function(module) {
	if (!module.webpackPolyfill) {
		module.deprecate = function() {};
		module.paths = [];
		// module.parent = undefined by default
		if (!module.children) module.children = [];
		Object.defineProperty(module, "loaded", {
			enumerable: true,
			get: function() {
				return module.l;
			}
		});
		Object.defineProperty(module, "id", {
			enumerable: true,
			get: function() {
				return module.i;
			}
		});
		module.webpackPolyfill = 1;
	}
	return module;
};


/***/ }),

/***/ "./src/UI/App.svelte":
/*!***************************!*\
  !*** ./src/UI/App.svelte ***!
  \***************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var svelte_internal__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! svelte/internal */ "./node_modules/svelte/internal/index.mjs");
/* harmony import */ var _Header_svelte__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./Header.svelte */ "./src/UI/Header.svelte");
/* harmony import */ var _Content_svelte__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./Content.svelte */ "./src/UI/Content.svelte");
/* harmony import */ var _interpreter_compiler__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../interpreter/compiler */ "./src/interpreter/compiler.js");
/* harmony import */ var _interpreter_defaultGrammar_ne__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../interpreter/defaultGrammar.ne */ "./src/interpreter/defaultGrammar.ne");
/* harmony import */ var _interpreter_defaultLiveCode_sem__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../interpreter/defaultLiveCode.sem */ "./src/interpreter/defaultLiveCode.sem");
/* harmony import */ var moo__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! moo */ "./node_modules/moo/moo.js");
/* harmony import */ var moo__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(moo__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var _Users_francisco_Documents_dev_MIMIC_svelte_webpack_css_grid_flex_layout_src_UI_App_svelte_css__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./src/UI/App.svelte.css */ "./src/UI/App.svelte.css");
/* harmony import */ var _Users_francisco_Documents_dev_MIMIC_svelte_webpack_css_grid_flex_layout_src_UI_App_svelte_css__WEBPACK_IMPORTED_MODULE_7___default = /*#__PURE__*/__webpack_require__.n(_Users_francisco_Documents_dev_MIMIC_svelte_webpack_css_grid_flex_layout_src_UI_App_svelte_css__WEBPACK_IMPORTED_MODULE_7__);
/* src/UI/App.svelte generated by Svelte v3.12.1 */









function create_fragment(ctx) {
	var div, t, current;

	var header = new _Header_svelte__WEBPACK_IMPORTED_MODULE_1__["default"]({});

	var content = new _Content_svelte__WEBPACK_IMPORTED_MODULE_2__["default"]({});

	return {
		c() {
			div = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["element"])("div");
			header.$$.fragment.c();
			t = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["space"])();
			content.$$.fragment.c();
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["attr"])(div, "id", "app");
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["attr"])(div, "class", "svelte-q7zahh");
		},

		m(target, anchor) {
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["insert"])(target, div, anchor);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["mount_component"])(header, div, null);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["append"])(div, t);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["mount_component"])(content, div, null);
			current = true;
		},

		p: svelte_internal__WEBPACK_IMPORTED_MODULE_0__["noop"],

		i(local) {
			if (current) return;
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["transition_in"])(header.$$.fragment, local);

			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["transition_in"])(content.$$.fragment, local);

			current = true;
		},

		o(local) {
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["transition_out"])(header.$$.fragment, local);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["transition_out"])(content.$$.fragment, local);
			current = false;
		},

		d(detaching) {
			if (detaching) {
				Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["detach"])(div);
			}

			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["destroy_component"])(header);

			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["destroy_component"])(content);
		}
	};
}

function instance($$self, $$props, $$invalidate) {
	

  let { name } = $$props;

  let compileOutput = Object(_interpreter_compiler__WEBPACK_IMPORTED_MODULE_3__["default"])(_interpreter_defaultGrammar_ne__WEBPACK_IMPORTED_MODULE_4__["default"]).output;

  let worker = new Worker('../../public/worker.bundle.js');

  let p = new Promise((res, rej) => {
            worker.postMessage({test: _interpreter_defaultLiveCode_sem__WEBPACK_IMPORTED_MODULE_5__["default"], source: _interpreter_defaultGrammar_ne__WEBPACK_IMPORTED_MODULE_4__["default"]})
            
            let timeout = setTimeout(() => {
                worker.terminate()
                worker = new Worker('../../public/worker.bundle.js')
                // rej('Possible infinite loop detected! Check your grammar for infinite recursion.')
            }, 5000);
            worker.onmessage = e => {
                res(e.data)
                clearTimeout(timeout)
            }
        })
        .then(outputs => console.log(outputs))
        .catch(e => { console.log(e); });

  console.log(compileOutput);

  let defaultState = {
      active: 0,
      compiled_grammar: Object(_interpreter_compiler__WEBPACK_IMPORTED_MODULE_3__["default"])(_interpreter_defaultGrammar_ne__WEBPACK_IMPORTED_MODULE_4__["default"]).output,
      quadrants: [
          {
              name: 'Default Language',
              editor_value: _interpreter_defaultLiveCode_sem__WEBPACK_IMPORTED_MODULE_5__["default"],
              errors: '',
              tests: [
                  'Charles sleeps while thinking about snakes.',
                  'A typical Reddit user sleeps with a hammer.',
                  'This test doesn\'t match :('
              ]
          },
          {
            osciloscope: '',
            spectrogram: ''
          },
          {
              name: 'Default Grammar',
              editor_value: _interpreter_defaultGrammar_ne__WEBPACK_IMPORTED_MODULE_4__["default"],
              errors: '',
              tests: ['1 + 1', 'ln(5 + sin(3 + 4*e))']
          },
          {
              name: 'Default Model',
              editor_value: _interpreter_defaultLiveCode_sem__WEBPACK_IMPORTED_MODULE_5__["default"],
              errors: '',
              tests: ['1 + 1', 'ln(5 + sin(3 + 4*e))']



          }
      ],
      dashboard: [
          {
              name: 'Default Language',
              editor_value: _interpreter_defaultGrammar_ne__WEBPACK_IMPORTED_MODULE_4__["default"],
              errors: '',
              tests: [
                  'Charles sleeps while thinking about snakes.',
                  'A typical Reddit user sleeps with a hammer.',
                  'This test doesn\'t match :('
              ]
          },
          {
            osciloscope: '',
            spectrogram: ''
          },
          {
              name: 'Default Grammar',
              editor_value: _interpreter_defaultGrammar_ne__WEBPACK_IMPORTED_MODULE_4__["default"],
              errors: '',
              tests: ['1 + 1', 'ln(5 + sin(3 + 4*e))']
          },
          {




          }
      ],
  }

	$$self.$set = $$props => {
		if ('name' in $$props) $$invalidate('name', name = $$props.name);
	};

	return { name };
}

class App extends svelte_internal__WEBPACK_IMPORTED_MODULE_0__["SvelteComponent"] {
	constructor(options) {
		super();
		Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["init"])(this, options, instance, create_fragment, svelte_internal__WEBPACK_IMPORTED_MODULE_0__["safe_not_equal"], ["name"]);
	}
}


if (false) {}

/* harmony default export */ __webpack_exports__["default"] = (App);




/***/ }),

/***/ "./src/UI/App.svelte.css":
/*!*******************************!*\
  !*** ./src/UI/App.svelte.css ***!
  \*******************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

var content = __webpack_require__(/*! !../../node_modules/css-loader/dist/cjs.js!./App.svelte.css */ "./node_modules/css-loader/dist/cjs.js!./src/UI/App.svelte.css");

if (typeof content === 'string') {
  content = [[module.i, content, '']];
}

var options = {}

options.insert = "head";
options.singleton = false;

var update = __webpack_require__(/*! ../../node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js */ "./node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js")(content, options);

if (content.locals) {
  module.exports = content.locals;
}


/***/ }),

/***/ "./src/UI/Content.svelte":
/*!*******************************!*\
  !*** ./src/UI/Content.svelte ***!
  \*******************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var svelte_internal__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! svelte/internal */ "./node_modules/svelte/internal/index.mjs");
/* harmony import */ var _Sidebar_svelte__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./Sidebar.svelte */ "./src/UI/Sidebar.svelte");
/* harmony import */ var _Layout_svelte__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./Layout.svelte */ "./src/UI/Layout.svelte");
/* harmony import */ var _Users_francisco_Documents_dev_MIMIC_svelte_webpack_css_grid_flex_layout_src_UI_Content_svelte_css__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./src/UI/Content.svelte.css */ "./src/UI/Content.svelte.css");
/* harmony import */ var _Users_francisco_Documents_dev_MIMIC_svelte_webpack_css_grid_flex_layout_src_UI_Content_svelte_css__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(_Users_francisco_Documents_dev_MIMIC_svelte_webpack_css_grid_flex_layout_src_UI_Content_svelte_css__WEBPACK_IMPORTED_MODULE_3__);
/* src/UI/Content.svelte generated by Svelte v3.12.1 */




function create_fragment(ctx) {
	var div2, div0, t, div1, current;

	var sidebar = new _Sidebar_svelte__WEBPACK_IMPORTED_MODULE_1__["default"]({});
	sidebar.$on("message", ctx.handleMessage);

	var layout = new _Layout_svelte__WEBPACK_IMPORTED_MODULE_2__["default"]({ props: { layoutTemplate: ctx.selectedLayout } });

	return {
		c() {
			div2 = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["element"])("div");
			div0 = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["element"])("div");
			sidebar.$$.fragment.c();
			t = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["space"])();
			div1 = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["element"])("div");
			layout.$$.fragment.c();
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["attr"])(div0, "class", "sidebar-container svelte-145bij");
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["attr"])(div1, "class", "layout-container svelte-145bij");
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["attr"])(div2, "class", "container svelte-145bij");
		},

		m(target, anchor) {
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["insert"])(target, div2, anchor);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["append"])(div2, div0);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["mount_component"])(sidebar, div0, null);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["append"])(div2, t);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["append"])(div2, div1);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["mount_component"])(layout, div1, null);
			current = true;
		},

		p(changed, ctx) {
			var layout_changes = {};
			if (changed.selectedLayout) layout_changes.layoutTemplate = ctx.selectedLayout;
			layout.$set(layout_changes);
		},

		i(local) {
			if (current) return;
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["transition_in"])(sidebar.$$.fragment, local);

			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["transition_in"])(layout.$$.fragment, local);

			current = true;
		},

		o(local) {
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["transition_out"])(sidebar.$$.fragment, local);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["transition_out"])(layout.$$.fragment, local);
			current = false;
		},

		d(detaching) {
			if (detaching) {
				Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["detach"])(div2);
			}

			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["destroy_component"])(sidebar);

			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["destroy_component"])(layout);
		}
	};
}

function instance($$self, $$props, $$invalidate) {
	

  let selectedLayout = 1; 

  function handleMessage(event) { 
    $$invalidate('selectedLayout', selectedLayout = event.detail.layout);
	}

	return { selectedLayout, handleMessage };
}

class Content extends svelte_internal__WEBPACK_IMPORTED_MODULE_0__["SvelteComponent"] {
	constructor(options) {
		super();
		Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["init"])(this, options, instance, create_fragment, svelte_internal__WEBPACK_IMPORTED_MODULE_0__["safe_not_equal"], []);
	}
}


if (false) {}

/* harmony default export */ __webpack_exports__["default"] = (Content);




/***/ }),

/***/ "./src/UI/Content.svelte.css":
/*!***********************************!*\
  !*** ./src/UI/Content.svelte.css ***!
  \***********************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

var content = __webpack_require__(/*! !../../node_modules/css-loader/dist/cjs.js!./Content.svelte.css */ "./node_modules/css-loader/dist/cjs.js!./src/UI/Content.svelte.css");

if (typeof content === 'string') {
  content = [[module.i, content, '']];
}

var options = {}

options.insert = "head";
options.singleton = false;

var update = __webpack_require__(/*! ../../node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js */ "./node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js")(content, options);

if (content.locals) {
  module.exports = content.locals;
}


/***/ }),

/***/ "./src/UI/Dashboard.svelte":
/*!*********************************!*\
  !*** ./src/UI/Dashboard.svelte ***!
  \*********************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var svelte_internal__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! svelte/internal */ "./node_modules/svelte/internal/index.mjs");
/* harmony import */ var svelte_grid__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! svelte-grid */ "./node_modules/svelte-grid/src/index.svelte");
/* harmony import */ var svelte_grid_build_helper__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! svelte-grid/build/helper */ "./node_modules/svelte-grid/build/helper/index.mjs");
/* harmony import */ var lodash_map__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! lodash.map */ "./node_modules/lodash.map/index.js");
/* harmony import */ var lodash_map__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(lodash_map__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var _Editor_svelte__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./Editor.svelte */ "./src/UI/Editor.svelte");
/* harmony import */ var _Users_francisco_Documents_dev_MIMIC_svelte_webpack_css_grid_flex_layout_src_UI_Dashboard_svelte_css__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./src/UI/Dashboard.svelte.css */ "./src/UI/Dashboard.svelte.css");
/* harmony import */ var _Users_francisco_Documents_dev_MIMIC_svelte_webpack_css_grid_flex_layout_src_UI_Dashboard_svelte_css__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(_Users_francisco_Documents_dev_MIMIC_svelte_webpack_css_grid_flex_layout_src_UI_Dashboard_svelte_css__WEBPACK_IMPORTED_MODULE_5__);
/* src/UI/Dashboard.svelte generated by Svelte v3.12.1 */






// (88:2) <Grid useTransform {breakpoints} gap={10} {items} bind:items {cols} rowHeight={100} let:item>
function create_default_slot(ctx) {
	var div, updating_value, current;

	function editor_value_binding(value_1) {
		ctx.editor_value_binding.call(null, value_1);
		updating_value = true;
		Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["add_flush_callback"])(() => updating_value = false);
	}

	let editor_props = {};
	if (ctx.value !== void 0) {
		editor_props.value = ctx.value;
	}
	var editor = new _Editor_svelte__WEBPACK_IMPORTED_MODULE_4__["default"]({ props: editor_props });

	svelte_internal__WEBPACK_IMPORTED_MODULE_0__["binding_callbacks"].push(() => Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["bind"])(editor, 'value', editor_value_binding));

	return {
		c() {
			div = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["element"])("div");
			editor.$$.fragment.c();
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["attr"])(div, "class", "content svelte-b6qt57");
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["set_style"])(div, "background", (ctx.item.static ? '#ccccee' : ctx.item.data));
		},

		m(target, anchor) {
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["insert"])(target, div, anchor);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["mount_component"])(editor, div, null);
			current = true;
		},

		p(changed, ctx) {
			var editor_changes = {};
			if (!updating_value && changed.value) {
				editor_changes.value = ctx.value;
			}
			editor.$set(editor_changes);

			if (!current || changed.item) {
				Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["set_style"])(div, "background", (ctx.item.static ? '#ccccee' : ctx.item.data));
			}
		},

		i(local) {
			if (current) return;
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["transition_in"])(editor.$$.fragment, local);

			current = true;
		},

		o(local) {
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["transition_out"])(editor.$$.fragment, local);
			current = false;
		},

		d(detaching) {
			if (detaching) {
				Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["detach"])(div);
			}

			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["destroy_component"])(editor);
		}
	};
}

function create_fragment(ctx) {
	var div, updating_items, current;

	function grid_items_binding(value_1) {
		ctx.grid_items_binding.call(null, value_1);
		updating_items = true;
		Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["add_flush_callback"])(() => updating_items = false);
	}

	let grid_props = {
		useTransform: true,
		breakpoints: ctx.breakpoints,
		gap: 10,
		items: ctx.items,
		cols: cols,
		rowHeight: 100,
		$$slots: {
		default: [create_default_slot, ({ item }) => ({ item })]
	},
		$$scope: { ctx }
	};
	if (ctx.items !== void 0) {
		grid_props.items = ctx.items;
	}
	var grid = new svelte_grid__WEBPACK_IMPORTED_MODULE_1__["default"]({ props: grid_props });

	svelte_internal__WEBPACK_IMPORTED_MODULE_0__["binding_callbacks"].push(() => Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["bind"])(grid, 'items', grid_items_binding));

	return {
		c() {
			div = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["element"])("div");
			grid.$$.fragment.c();
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["attr"])(div, "class", "layout-template-container svelte-b6qt57");
		},

		m(target, anchor) {
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["insert"])(target, div, anchor);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["mount_component"])(grid, div, null);
			current = true;
		},

		p(changed, ctx) {
			var grid_changes = {};
			if (changed.items) grid_changes.items = ctx.items;
			if (changed.$$scope || changed.value) grid_changes.$$scope = { changed, ctx };
			if (!updating_items && changed.items) {
				grid_changes.items = ctx.items;
			}
			grid.$set(grid_changes);
		},

		i(local) {
			if (current) return;
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["transition_in"])(grid.$$.fragment, local);

			current = true;
		},

		o(local) {
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["transition_out"])(grid.$$.fragment, local);
			current = false;
		},

		d(detaching) {
			if (detaching) {
				Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["detach"])(div);
			}

			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["destroy_component"])(grid);
		}
	};
}

var cols = 15;

function instance($$self, $$props, $$invalidate) {
	

  let { value = '' } = $$props;

  const id = () =>
    "_" +
    Math.random()
      .toString(36)
      .substr(2, 9);

  const random = (min, max) => Math.random() * (max - min) + min;

  const randomHexColorCode = () => {
    let n = (Math.random() * 0xfffff * 1000000).toString(16);
    return "#" + n.slice(0, 6);
  };
  let items = [];

  function generateLayout(col) {
    return lodash_map__WEBPACK_IMPORTED_MODULE_3___default()(new Array(20), function(item, i) {
      const y = Math.ceil(Math.random() * 4) + 1;
      return {
        ...svelte_grid_build_helper__WEBPACK_IMPORTED_MODULE_2__["default"].item({
          x: (i * 2) % col,
          y: Math.floor(i / 6) * y,
          w: 2,
          h: y,
          id: id(),
        }),
        ...{ data: randomHexColorCode() },
      };
    });
  }

  $$invalidate('items', items = generateLayout(cols));
  $$invalidate('items', items = svelte_grid_build_helper__WEBPACK_IMPORTED_MODULE_2__["default"].resizeItems(items, cols));

  let breakpoints = [[1000, 10], [700, 5], [500, 3], [400, 1]];

	function editor_value_binding(value_1) {
		value = value_1;
		$$invalidate('value', value);
	}

	function grid_items_binding(value_1) {
		items = value_1;
		$$invalidate('items', items);
	}

	$$self.$set = $$props => {
		if ('value' in $$props) $$invalidate('value', value = $$props.value);
	};

	return {
		value,
		items,
		breakpoints,
		editor_value_binding,
		grid_items_binding
	};
}

class Dashboard extends svelte_internal__WEBPACK_IMPORTED_MODULE_0__["SvelteComponent"] {
	constructor(options) {
		super();
		Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["init"])(this, options, instance, create_fragment, svelte_internal__WEBPACK_IMPORTED_MODULE_0__["safe_not_equal"], ["value"]);
	}
}


if (false) {}

/* harmony default export */ __webpack_exports__["default"] = (Dashboard);




/***/ }),

/***/ "./src/UI/Dashboard.svelte.css":
/*!*************************************!*\
  !*** ./src/UI/Dashboard.svelte.css ***!
  \*************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

var content = __webpack_require__(/*! !../../node_modules/css-loader/dist/cjs.js!./Dashboard.svelte.css */ "./node_modules/css-loader/dist/cjs.js!./src/UI/Dashboard.svelte.css");

if (typeof content === 'string') {
  content = [[module.i, content, '']];
}

var options = {}

options.insert = "head";
options.singleton = false;

var update = __webpack_require__(/*! ../../node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js */ "./node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js")(content, options);

if (content.locals) {
  module.exports = content.locals;
}


/***/ }),

/***/ "./src/UI/Editor.svelte":
/*!******************************!*\
  !*** ./src/UI/Editor.svelte ***!
  \******************************/
/*! exports provided: default, value */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "value", function() { return value; });
/* harmony import */ var svelte_internal__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! svelte/internal */ "./node_modules/svelte/internal/index.mjs");
/* harmony import */ var svelte_codemirror__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! svelte-codemirror */ "./node_modules/svelte-codemirror/src/CodeMirror.svelte");
/* harmony import */ var codemirror_lib_codemirror_css__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! codemirror/lib/codemirror.css */ "./node_modules/codemirror/lib/codemirror.css");
/* harmony import */ var codemirror_lib_codemirror_css__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(codemirror_lib_codemirror_css__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _Users_francisco_Documents_dev_MIMIC_svelte_webpack_css_grid_flex_layout_src_UI_Editor_svelte_css__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./src/UI/Editor.svelte.css */ "./src/UI/Editor.svelte.css");
/* harmony import */ var _Users_francisco_Documents_dev_MIMIC_svelte_webpack_css_grid_flex_layout_src_UI_Editor_svelte_css__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(_Users_francisco_Documents_dev_MIMIC_svelte_webpack_css_grid_flex_layout_src_UI_Editor_svelte_css__WEBPACK_IMPORTED_MODULE_3__);
/* src/UI/Editor.svelte generated by Svelte v3.12.1 */




function create_fragment(ctx) {
	var div, current;

	var codemirror = new svelte_codemirror__WEBPACK_IMPORTED_MODULE_1__["default"]({ props: { value: value } });

	return {
		c() {
			div = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["element"])("div");
			codemirror.$$.fragment.c();
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["attr"])(div, "class", "codemirror-container flex scrollable svelte-24kubc");
		},

		m(target, anchor) {
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["insert"])(target, div, anchor);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["mount_component"])(codemirror, div, null);
			current = true;
		},

		p: svelte_internal__WEBPACK_IMPORTED_MODULE_0__["noop"],

		i(local) {
			if (current) return;
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["transition_in"])(codemirror.$$.fragment, local);

			current = true;
		},

		o(local) {
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["transition_out"])(codemirror.$$.fragment, local);
			current = false;
		},

		d(detaching) {
			if (detaching) {
				Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["detach"])(div);
			}

			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["destroy_component"])(codemirror);
		}
	};
}



const is_browser = typeof window !== "undefined";
if (is_browser) {
  Promise.all(/*! import() */[__webpack_require__.e(0), __webpack_require__.e(1), __webpack_require__.e(2)]).then(__webpack_require__.bind(null, /*! ./codeMirrorPlugins */ "./src/UI/codeMirrorPlugins.js"));
}

let value = 'sdfg';
// export let value = `dfsd`;


// let value = encodeURIComponent(`:b:{{1,0.25}imp}\909b;`);
// let decodedValue = decodeURIComponent(value);
// export let value = `:b:{{1,0.25}imp}\\909b;`;


// let liveCode = `:b:{{1,0.25}imp}\909b; \n \\\ 
//                 :s:{{1,0.5}imp}\909;   \\\
//                 :c:{{{1,0.66}imp,{1,0.8}imp}add}\909closed; \\\
//                 :o:{{0.25,0.75}imp}\909open; \\\
//                 :tri:{30}tri;  \\\
//                 :sin:{200}sin; \\\
//                 :saw:{4}saw; \\\
//                 {:tri:,:saw:,{:sin:,0.4}mul, :o:, :s:, :b:, :c:}mix`;

class Editor extends svelte_internal__WEBPACK_IMPORTED_MODULE_0__["SvelteComponent"] {
	constructor(options) {
		super();
		Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["init"])(this, options, null, create_fragment, svelte_internal__WEBPACK_IMPORTED_MODULE_0__["safe_not_equal"], []);
	}
}


if (false) {}

/* harmony default export */ __webpack_exports__["default"] = (Editor);





/***/ }),

/***/ "./src/UI/Editor.svelte.css":
/*!**********************************!*\
  !*** ./src/UI/Editor.svelte.css ***!
  \**********************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

var content = __webpack_require__(/*! !../../node_modules/css-loader/dist/cjs.js!./Editor.svelte.css */ "./node_modules/css-loader/dist/cjs.js!./src/UI/Editor.svelte.css");

if (typeof content === 'string') {
  content = [[module.i, content, '']];
}

var options = {}

options.insert = "head";
options.singleton = false;

var update = __webpack_require__(/*! ../../node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js */ "./node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js")(content, options);

if (content.locals) {
  module.exports = content.locals;
}


/***/ }),

/***/ "./src/UI/Header.svelte":
/*!******************************!*\
  !*** ./src/UI/Header.svelte ***!
  \******************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var svelte_internal__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! svelte/internal */ "./node_modules/svelte/internal/index.mjs");
/* harmony import */ var _Nav_svelte__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./Nav.svelte */ "./src/UI/Nav.svelte");
/* harmony import */ var _Users_francisco_Documents_dev_MIMIC_svelte_webpack_css_grid_flex_layout_src_UI_Header_svelte_css__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./src/UI/Header.svelte.css */ "./src/UI/Header.svelte.css");
/* harmony import */ var _Users_francisco_Documents_dev_MIMIC_svelte_webpack_css_grid_flex_layout_src_UI_Header_svelte_css__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(_Users_francisco_Documents_dev_MIMIC_svelte_webpack_css_grid_flex_layout_src_UI_Header_svelte_css__WEBPACK_IMPORTED_MODULE_2__);
/* src/UI/Header.svelte generated by Svelte v3.12.1 */



function create_fragment(ctx) {
	var div, h1, t_1, current;

	var nav = new _Nav_svelte__WEBPACK_IMPORTED_MODULE_1__["default"]({});

	return {
		c() {
			div = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["element"])("div");
			h1 = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["element"])("h1");
			h1.textContent = "S(velt)ema";
			t_1 = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["space"])();
			nav.$$.fragment.c();
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["attr"])(h1, "class", "svelte-1qf0bqb");
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["attr"])(div, "class", "svelte-1qf0bqb");
		},

		m(target, anchor) {
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["insert"])(target, div, anchor);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["append"])(div, h1);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["append"])(div, t_1);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["mount_component"])(nav, div, null);
			current = true;
		},

		p: svelte_internal__WEBPACK_IMPORTED_MODULE_0__["noop"],

		i(local) {
			if (current) return;
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["transition_in"])(nav.$$.fragment, local);

			current = true;
		},

		o(local) {
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["transition_out"])(nav.$$.fragment, local);
			current = false;
		},

		d(detaching) {
			if (detaching) {
				Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["detach"])(div);
			}

			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["destroy_component"])(nav);
		}
	};
}

class Header extends svelte_internal__WEBPACK_IMPORTED_MODULE_0__["SvelteComponent"] {
	constructor(options) {
		super();
		Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["init"])(this, options, null, create_fragment, svelte_internal__WEBPACK_IMPORTED_MODULE_0__["safe_not_equal"], []);
	}
}


if (false) {}

/* harmony default export */ __webpack_exports__["default"] = (Header);




/***/ }),

/***/ "./src/UI/Header.svelte.css":
/*!**********************************!*\
  !*** ./src/UI/Header.svelte.css ***!
  \**********************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

var content = __webpack_require__(/*! !../../node_modules/css-loader/dist/cjs.js!./Header.svelte.css */ "./node_modules/css-loader/dist/cjs.js!./src/UI/Header.svelte.css");

if (typeof content === 'string') {
  content = [[module.i, content, '']];
}

var options = {}

options.insert = "head";
options.singleton = false;

var update = __webpack_require__(/*! ../../node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js */ "./node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js")(content, options);

if (content.locals) {
  module.exports = content.locals;
}


/***/ }),

/***/ "./src/UI/Layout.svelte":
/*!******************************!*\
  !*** ./src/UI/Layout.svelte ***!
  \******************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var svelte_internal__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! svelte/internal */ "./node_modules/svelte/internal/index.mjs");
/* harmony import */ var _Quadrants_svelte__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./Quadrants.svelte */ "./src/UI/Quadrants.svelte");
/* harmony import */ var _Dashboard_svelte__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./Dashboard.svelte */ "./src/UI/Dashboard.svelte");
/* harmony import */ var _Users_francisco_Documents_dev_MIMIC_svelte_webpack_css_grid_flex_layout_src_UI_Layout_svelte_css__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./src/UI/Layout.svelte.css */ "./src/UI/Layout.svelte.css");
/* harmony import */ var _Users_francisco_Documents_dev_MIMIC_svelte_webpack_css_grid_flex_layout_src_UI_Layout_svelte_css__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(_Users_francisco_Documents_dev_MIMIC_svelte_webpack_css_grid_flex_layout_src_UI_Layout_svelte_css__WEBPACK_IMPORTED_MODULE_3__);
/* src/UI/Layout.svelte generated by Svelte v3.12.1 */




function create_fragment(ctx) {
	var div2, div0, t, div1, current;

	var dashboard = new _Dashboard_svelte__WEBPACK_IMPORTED_MODULE_2__["default"]({});

	var quadrants = new _Quadrants_svelte__WEBPACK_IMPORTED_MODULE_1__["default"]({
		props: {
		liveCodeEditorValue: ctx.value,
		grammarEditorValue: ctx.value,
		modelEditorValue: ctx.value
	}
	});

	return {
		c() {
			div2 = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["element"])("div");
			div0 = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["element"])("div");
			dashboard.$$.fragment.c();
			t = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["space"])();
			div1 = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["element"])("div");
			quadrants.$$.fragment.c();
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["attr"])(div0, "class", "dashboard-container");
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["set_style"])(div0, "display", ctx.dashboardContainerDisplay);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["attr"])(div1, "class", "quadrants-container");
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["set_style"])(div1, "display", ctx.quadrantsContainerDisplay);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["attr"])(div2, "class", "layout-template-container scrollable svelte-q7j13a");
		},

		m(target, anchor) {
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["insert"])(target, div2, anchor);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["append"])(div2, div0);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["mount_component"])(dashboard, div0, null);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["append"])(div2, t);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["append"])(div2, div1);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["mount_component"])(quadrants, div1, null);
			current = true;
		},

		p(changed, ctx) {
			if (!current || changed.dashboardContainerDisplay) {
				Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["set_style"])(div0, "display", ctx.dashboardContainerDisplay);
			}

			var quadrants_changes = {};
			if (changed.value) quadrants_changes.liveCodeEditorValue = ctx.value;
			if (changed.value) quadrants_changes.grammarEditorValue = ctx.value;
			if (changed.value) quadrants_changes.modelEditorValue = ctx.value;
			quadrants.$set(quadrants_changes);

			if (!current || changed.quadrantsContainerDisplay) {
				Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["set_style"])(div1, "display", ctx.quadrantsContainerDisplay);
			}
		},

		i(local) {
			if (current) return;
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["transition_in"])(dashboard.$$.fragment, local);

			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["transition_in"])(quadrants.$$.fragment, local);

			current = true;
		},

		o(local) {
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["transition_out"])(dashboard.$$.fragment, local);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["transition_out"])(quadrants.$$.fragment, local);
			current = false;
		},

		d(detaching) {
			if (detaching) {
				Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["detach"])(div2);
			}

			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["destroy_component"])(dashboard);

			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["destroy_component"])(quadrants);
		}
	};
}

function instance($$self, $$props, $$invalidate) {
	

  let { layoutTemplate = 1, value = `:b:{{1,0.25}imp}\\909b;` } = $$props;

  let dashboardContainerDisplay = "initial";
  let quadrantsContainerDisplay = "initial";

  function changeLayout (layoutIndex) {
    switch (layoutIndex) {
      case 2:
        $$invalidate('dashboardContainerDisplay', dashboardContainerDisplay = "none");
        $$invalidate('quadrantsContainerDisplay', quadrantsContainerDisplay = "initial"); 
        break;
      case 5:
        $$invalidate('dashboardContainerDisplay', dashboardContainerDisplay = "initial"); 
        $$invalidate('quadrantsContainerDisplay', quadrantsContainerDisplay = "none");  
        break;
      default:
        $$invalidate('dashboardContainerDisplay', dashboardContainerDisplay = "initial");
        $$invalidate('quadrantsContainerDisplay', quadrantsContainerDisplay = "initial");  
        break;
    }
  }

	$$self.$set = $$props => {
		if ('layoutTemplate' in $$props) $$invalidate('layoutTemplate', layoutTemplate = $$props.layoutTemplate);
		if ('value' in $$props) $$invalidate('value', value = $$props.value);
	};

	let doubled;

	$$self.$$.update = ($$dirty = { layoutTemplate: 1 }) => {
		if ($$dirty.layoutTemplate) { doubled = changeLayout(layoutTemplate); }
	};

	return {
		layoutTemplate,
		value,
		dashboardContainerDisplay,
		quadrantsContainerDisplay
	};
}

class Layout extends svelte_internal__WEBPACK_IMPORTED_MODULE_0__["SvelteComponent"] {
	constructor(options) {
		super();
		Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["init"])(this, options, instance, create_fragment, svelte_internal__WEBPACK_IMPORTED_MODULE_0__["safe_not_equal"], ["layoutTemplate", "value"]);
	}
}


if (false) {}

/* harmony default export */ __webpack_exports__["default"] = (Layout);




/***/ }),

/***/ "./src/UI/Layout.svelte.css":
/*!**********************************!*\
  !*** ./src/UI/Layout.svelte.css ***!
  \**********************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

var content = __webpack_require__(/*! !../../node_modules/css-loader/dist/cjs.js!./Layout.svelte.css */ "./node_modules/css-loader/dist/cjs.js!./src/UI/Layout.svelte.css");

if (typeof content === 'string') {
  content = [[module.i, content, '']];
}

var options = {}

options.insert = "head";
options.singleton = false;

var update = __webpack_require__(/*! ../../node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js */ "./node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js")(content, options);

if (content.locals) {
  module.exports = content.locals;
}


/***/ }),

/***/ "./src/UI/Nav.svelte":
/*!***************************!*\
  !*** ./src/UI/Nav.svelte ***!
  \***************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var svelte_internal__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! svelte/internal */ "./node_modules/svelte/internal/index.mjs");
/* harmony import */ var _Users_francisco_Documents_dev_MIMIC_svelte_webpack_css_grid_flex_layout_src_UI_Nav_svelte_css__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./src/UI/Nav.svelte.css */ "./src/UI/Nav.svelte.css");
/* harmony import */ var _Users_francisco_Documents_dev_MIMIC_svelte_webpack_css_grid_flex_layout_src_UI_Nav_svelte_css__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_Users_francisco_Documents_dev_MIMIC_svelte_webpack_css_grid_flex_layout_src_UI_Nav_svelte_css__WEBPACK_IMPORTED_MODULE_1__);
/* src/UI/Nav.svelte generated by Svelte v3.12.1 */


function create_fragment(ctx) {
	var div;

	return {
		c() {
			div = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["element"])("div");
			div.innerHTML = `<ul class="svelte-yvg0lp"><li class="svelte-yvg0lp">Playground</li> <li class="svelte-yvg0lp">Tutorials</li> <li class="svelte-yvg0lp">API</li> <li class="svelte-yvg0lp"><a href="https://forum.toplap.org/c/communities"><svg class="icon svelte-5yec39" width="25" height="20"><use xlink:href="#community"></use><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg></a></li> <li class="svelte-yvg0lp"><a href="https://github.com/mimic-sussex/sema"><svg class="icon svelte-5yec89" width="25" height="20"><use xlink:href="#github"></use><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg></a></li></ul>`;
		},

		m(target, anchor) {
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["insert"])(target, div, anchor);
		},

		p: svelte_internal__WEBPACK_IMPORTED_MODULE_0__["noop"],
		i: svelte_internal__WEBPACK_IMPORTED_MODULE_0__["noop"],
		o: svelte_internal__WEBPACK_IMPORTED_MODULE_0__["noop"],

		d(detaching) {
			if (detaching) {
				Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["detach"])(div);
			}
		}
	};
}

class Nav extends svelte_internal__WEBPACK_IMPORTED_MODULE_0__["SvelteComponent"] {
	constructor(options) {
		super();
		Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["init"])(this, options, null, create_fragment, svelte_internal__WEBPACK_IMPORTED_MODULE_0__["safe_not_equal"], []);
	}
}


if (false) {}

/* harmony default export */ __webpack_exports__["default"] = (Nav);




/***/ }),

/***/ "./src/UI/Nav.svelte.css":
/*!*******************************!*\
  !*** ./src/UI/Nav.svelte.css ***!
  \*******************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

var content = __webpack_require__(/*! !../../node_modules/css-loader/dist/cjs.js!./Nav.svelte.css */ "./node_modules/css-loader/dist/cjs.js!./src/UI/Nav.svelte.css");

if (typeof content === 'string') {
  content = [[module.i, content, '']];
}

var options = {}

options.insert = "head";
options.singleton = false;

var update = __webpack_require__(/*! ../../node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js */ "./node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js")(content, options);

if (content.locals) {
  module.exports = content.locals;
}


/***/ }),

/***/ "./src/UI/Quadrants.svelte":
/*!*********************************!*\
  !*** ./src/UI/Quadrants.svelte ***!
  \*********************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var svelte_internal__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! svelte/internal */ "./node_modules/svelte/internal/index.mjs");
/* harmony import */ var _Editor_svelte__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./Editor.svelte */ "./src/UI/Editor.svelte");
/* harmony import */ var _Users_francisco_Documents_dev_MIMIC_svelte_webpack_css_grid_flex_layout_src_UI_Quadrants_svelte_css__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./src/UI/Quadrants.svelte.css */ "./src/UI/Quadrants.svelte.css");
/* harmony import */ var _Users_francisco_Documents_dev_MIMIC_svelte_webpack_css_grid_flex_layout_src_UI_Quadrants_svelte_css__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(_Users_francisco_Documents_dev_MIMIC_svelte_webpack_css_grid_flex_layout_src_UI_Quadrants_svelte_css__WEBPACK_IMPORTED_MODULE_2__);
/* src/UI/Quadrants.svelte generated by Svelte v3.12.1 */



function create_fragment(ctx) {
	var div9, div3, div0, div0_resize_listener, t0, div1, t7, div2, div3_resize_listener, t9, div4, t11, div8, div5, div5_resize_listener, t12, div6, t19, div7, current, dispose;

	var editor0 = new _Editor_svelte__WEBPACK_IMPORTED_MODULE_1__["default"]({ props: { value: ctx.liveCodeEditorValue } });

	var editor1 = new _Editor_svelte__WEBPACK_IMPORTED_MODULE_1__["default"]({ props: { value: ctx.grammarEditorValue } });

	var editor2 = new _Editor_svelte__WEBPACK_IMPORTED_MODULE_1__["default"]({ props: { value: ctx.modelEditorValue } });

	return {
		c() {
			div9 = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["element"])("div");
			div3 = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["element"])("div");
			div0 = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["element"])("div");
			editor0.$$.fragment.c();
			t0 = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["space"])();
			div1 = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["element"])("div");
			div1.innerHTML = `
						S<br>l<br>i<br>d<br>e<br>r
					`;
			t7 = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["space"])();
			div2 = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["element"])("div");
			div2.textContent = "Block 2";
			t9 = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["space"])();
			div4 = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["element"])("div");
			div4.textContent = "Slider";
			t11 = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["space"])();
			div8 = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["element"])("div");
			div5 = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["element"])("div");
			editor1.$$.fragment.c();
			t12 = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["space"])();
			div6 = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["element"])("div");
			div6.innerHTML = `
						S<br>l<br>i<br>d<br>e<br>r
					`;
			t19 = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["space"])();
			div7 = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["element"])("div");
			editor2.$$.fragment.c();
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["add_render_callback"])(() => ctx.div0_resize_handler.call(div0));
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["attr"])(div0, "class", "block block-live-code-editor svelte-5bwytb");
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["set_style"])(div0, "width", ctx.leftTopBlockWidth);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["attr"])(div1, "class", "horizontal-slider svelte-5bwytb");
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["attr"])(div2, "class", "block block-2 svelte-5bwytb");
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["add_render_callback"])(() => ctx.div3_resize_handler.call(div3));
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["attr"])(div3, "class", "top svelte-5bwytb");
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["set_style"])(div3, "height", ctx.topHeight);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["attr"])(div4, "class", "vertical-slider svelte-5bwytb");
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["add_render_callback"])(() => ctx.div5_resize_handler.call(div5));
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["attr"])(div5, "class", "block block-1 svelte-5bwytb");
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["set_style"])(div5, "width", ctx.leftBottomBlockWidth);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["attr"])(div6, "class", "bottom-horizontal-slider svelte-5bwytb");
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["attr"])(div7, "class", "block-live-grammar-editor svelte-5bwytb");
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["attr"])(div8, "class", "bottom svelte-5bwytb");
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["attr"])(div9, "class", "quadrants svelte-5bwytb");

			dispose = [
				Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["listen"])(div1, "mousedown", ctx.dragMouseDownOnHorizontalSlider),
				Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["listen"])(div4, "mousedown", ctx.dragMouseDownOnVerticalSlider),
				Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["listen"])(div6, "mousedown", ctx.dragMouseDownOnBottomHorizontalSlider),
				Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["listen"])(div9, "mousemove", ctx.onMouseMove),
				Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["listen"])(div9, "mouseup", ctx.onMouseUp)
			];
		},

		m(target, anchor) {
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["insert"])(target, div9, anchor);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["append"])(div9, div3);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["append"])(div3, div0);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["mount_component"])(editor0, div0, null);
			div0_resize_listener = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["add_resize_listener"])(div0, ctx.div0_resize_handler.bind(div0));
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["append"])(div3, t0);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["append"])(div3, div1);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["append"])(div3, t7);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["append"])(div3, div2);
			div3_resize_listener = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["add_resize_listener"])(div3, ctx.div3_resize_handler.bind(div3));
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["append"])(div9, t9);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["append"])(div9, div4);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["append"])(div9, t11);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["append"])(div9, div8);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["append"])(div8, div5);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["mount_component"])(editor1, div5, null);
			div5_resize_listener = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["add_resize_listener"])(div5, ctx.div5_resize_handler.bind(div5));
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["append"])(div8, t12);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["append"])(div8, div6);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["append"])(div8, t19);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["append"])(div8, div7);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["mount_component"])(editor2, div7, null);
			ctx.div9_binding(div9);
			current = true;
		},

		p(changed, ctx) {
			var editor0_changes = {};
			if (changed.liveCodeEditorValue) editor0_changes.value = ctx.liveCodeEditorValue;
			editor0.$set(editor0_changes);

			if (!current || changed.leftTopBlockWidth) {
				Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["set_style"])(div0, "width", ctx.leftTopBlockWidth);
			}

			if (!current || changed.topHeight) {
				Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["set_style"])(div3, "height", ctx.topHeight);
			}

			var editor1_changes = {};
			if (changed.grammarEditorValue) editor1_changes.value = ctx.grammarEditorValue;
			editor1.$set(editor1_changes);

			if (!current || changed.leftBottomBlockWidth) {
				Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["set_style"])(div5, "width", ctx.leftBottomBlockWidth);
			}

			var editor2_changes = {};
			if (changed.modelEditorValue) editor2_changes.value = ctx.modelEditorValue;
			editor2.$set(editor2_changes);
		},

		i(local) {
			if (current) return;
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["transition_in"])(editor0.$$.fragment, local);

			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["transition_in"])(editor1.$$.fragment, local);

			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["transition_in"])(editor2.$$.fragment, local);

			current = true;
		},

		o(local) {
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["transition_out"])(editor0.$$.fragment, local);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["transition_out"])(editor1.$$.fragment, local);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["transition_out"])(editor2.$$.fragment, local);
			current = false;
		},

		d(detaching) {
			if (detaching) {
				Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["detach"])(div9);
			}

			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["destroy_component"])(editor0);

			div0_resize_listener.cancel();
			div3_resize_listener.cancel();

			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["destroy_component"])(editor1);

			div5_resize_listener.cancel();

			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["destroy_component"])(editor2);

			ctx.div9_binding(null);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["run_all"])(dispose);
		}
	};
}

function instance($$self, $$props, $$invalidate) {
	let { liveCodeEditorValue = "asdfasdf", grammarEditorValue = "qwerqwer", modelEditorValue = "zxcvxcvzxcv" } = $$props;

  let container;

  let leftTopBlockWidth = 250;
  let leftTopBlockOffsetWidth;
  
  let leftBottomBlockWidth = 250;
  let leftBottomBlockOffsetWidth;
  // let dragX;
  // let isMouseDownOnHorizontalSlider;

  let isMouseDownOnHorizontalSlider;
  let isMouseDownOnBottomHorizontalSlider
  let dragX;

  let topHeight = 600;
  let topOffsetHeight;
  let dragY;
  let isMouseDownOnVerticalSlider;
  
	function onMouseMove(e) {
		// let top = vslider.previousElementSibling;
    if(isMouseDownOnVerticalSlider){
      $$invalidate('topHeight', topHeight = topOffsetHeight + e.clientY - dragY + "px");
      dragY = e.clientY;
      // console.log(topHeight)
    }
    
    if(isMouseDownOnHorizontalSlider){
      $$invalidate('leftTopBlockWidth', leftTopBlockWidth = leftTopBlockOffsetWidth + e.clientX - dragX + "px");
      dragX = e.clientX;
      // console.log(topWidth)
    }

    if(isMouseDownOnBottomHorizontalSlider){
      $$invalidate('leftBottomBlockWidth', leftBottomBlockWidth = leftBottomBlockOffsetWidth + e.clientX - dragX + "px");
      dragX = e.clientX;
      // console.log(topWidth)
    }
	}

	function onMouseUp () {
    isMouseDownOnVerticalSlider = isMouseDownOnBottomHorizontalSlider = isMouseDownOnHorizontalSlider = false;
    // console.log("mouseUp", dragY);
	}  

  function dragMouseDownOnVerticalSlider(e) {
    isMouseDownOnVerticalSlider = true;
    dragY = e.clientY;
    // console.log("mouseOnVSlider: ", dragY );
	}

  function dragMouseDownOnHorizontalSlider(e) {
    isMouseDownOnHorizontalSlider = true;
    dragX = e.clientX;
    // console.log("mouseOnVSlider: ", dragY );
	}

  function dragMouseDownOnBottomHorizontalSlider(e) {
    isMouseDownOnBottomHorizontalSlider = true;
    dragX = e.clientX;
    // console.log("mouseOnVSlider: ", dragY );
	}

	function div0_resize_handler() {
		leftTopBlockOffsetWidth = this.offsetWidth;
		$$invalidate('leftTopBlockOffsetWidth', leftTopBlockOffsetWidth);
	}

	function div3_resize_handler() {
		topOffsetHeight = this.offsetHeight;
		$$invalidate('topOffsetHeight', topOffsetHeight);
	}

	function div5_resize_handler() {
		leftBottomBlockOffsetWidth = this.offsetWidth;
		$$invalidate('leftBottomBlockOffsetWidth', leftBottomBlockOffsetWidth);
	}

	function div9_binding($$value) {
		svelte_internal__WEBPACK_IMPORTED_MODULE_0__["binding_callbacks"][$$value ? 'unshift' : 'push'](() => {
			$$invalidate('container', container = $$value);
		});
	}

	$$self.$set = $$props => {
		if ('liveCodeEditorValue' in $$props) $$invalidate('liveCodeEditorValue', liveCodeEditorValue = $$props.liveCodeEditorValue);
		if ('grammarEditorValue' in $$props) $$invalidate('grammarEditorValue', grammarEditorValue = $$props.grammarEditorValue);
		if ('modelEditorValue' in $$props) $$invalidate('modelEditorValue', modelEditorValue = $$props.modelEditorValue);
	};

	return {
		liveCodeEditorValue,
		grammarEditorValue,
		modelEditorValue,
		container,
		leftTopBlockWidth,
		leftTopBlockOffsetWidth,
		leftBottomBlockWidth,
		leftBottomBlockOffsetWidth,
		topHeight,
		topOffsetHeight,
		onMouseMove,
		onMouseUp,
		dragMouseDownOnVerticalSlider,
		dragMouseDownOnHorizontalSlider,
		dragMouseDownOnBottomHorizontalSlider,
		div0_resize_handler,
		div3_resize_handler,
		div5_resize_handler,
		div9_binding
	};
}

class Quadrants extends svelte_internal__WEBPACK_IMPORTED_MODULE_0__["SvelteComponent"] {
	constructor(options) {
		super();
		Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["init"])(this, options, instance, create_fragment, svelte_internal__WEBPACK_IMPORTED_MODULE_0__["safe_not_equal"], ["liveCodeEditorValue", "grammarEditorValue", "modelEditorValue"]);
	}
}


if (false) {}

/* harmony default export */ __webpack_exports__["default"] = (Quadrants);




/***/ }),

/***/ "./src/UI/Quadrants.svelte.css":
/*!*************************************!*\
  !*** ./src/UI/Quadrants.svelte.css ***!
  \*************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

var content = __webpack_require__(/*! !../../node_modules/css-loader/dist/cjs.js!./Quadrants.svelte.css */ "./node_modules/css-loader/dist/cjs.js!./src/UI/Quadrants.svelte.css");

if (typeof content === 'string') {
  content = [[module.i, content, '']];
}

var options = {}

options.insert = "head";
options.singleton = false;

var update = __webpack_require__(/*! ../../node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js */ "./node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js")(content, options);

if (content.locals) {
  module.exports = content.locals;
}


/***/ }),

/***/ "./src/UI/Sidebar.svelte":
/*!*******************************!*\
  !*** ./src/UI/Sidebar.svelte ***!
  \*******************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var svelte_internal__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! svelte/internal */ "./node_modules/svelte/internal/index.mjs");
/* harmony import */ var svelte__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! svelte */ "./node_modules/svelte/index.mjs");
/* harmony import */ var _Users_francisco_Documents_dev_MIMIC_svelte_webpack_css_grid_flex_layout_src_UI_Sidebar_svelte_css__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./src/UI/Sidebar.svelte.css */ "./src/UI/Sidebar.svelte.css");
/* harmony import */ var _Users_francisco_Documents_dev_MIMIC_svelte_webpack_css_grid_flex_layout_src_UI_Sidebar_svelte_css__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(_Users_francisco_Documents_dev_MIMIC_svelte_webpack_css_grid_flex_layout_src_UI_Sidebar_svelte_css__WEBPACK_IMPORTED_MODULE_2__);
/* src/UI/Sidebar.svelte generated by Svelte v3.12.1 */



function get_each_context(ctx, list, i) {
	const child_ctx = Object.create(ctx);
	child_ctx.languageOption = list[i];
	return child_ctx;
}

function get_each_context_1(ctx, list, i) {
	const child_ctx = Object.create(ctx);
	child_ctx.layoutOption = list[i];
	return child_ctx;
}

// (63:4) {#each layoutOptions as layoutOption}
function create_each_block_1(ctx) {
	var option, t0_value = ctx.layoutOption.text + "", t0, t1;

	return {
		c() {
			option = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["element"])("option");
			t0 = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["text"])(t0_value);
			t1 = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["space"])();
			option.__value = ctx.layoutOption;
			option.value = option.__value;
		},

		m(target, anchor) {
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["insert"])(target, option, anchor);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["append"])(option, t0);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["append"])(option, t1);
		},

		p: svelte_internal__WEBPACK_IMPORTED_MODULE_0__["noop"],

		d(detaching) {
			if (detaching) {
				Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["detach"])(option);
			}
		}
	};
}

// (76:4) {#each languageOptions as languageOption}
function create_each_block(ctx) {
	var option, t0_value = ctx.languageOption.text + "", t0, t1;

	return {
		c() {
			option = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["element"])("option");
			t0 = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["text"])(t0_value);
			t1 = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["space"])();
			option.__value = ctx.languageOption;
			option.value = option.__value;
		},

		m(target, anchor) {
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["insert"])(target, option, anchor);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["append"])(option, t0);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["append"])(option, t1);
		},

		p: svelte_internal__WEBPACK_IMPORTED_MODULE_0__["noop"],

		d(detaching) {
			if (detaching) {
				Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["detach"])(option);
			}
		}
	};
}

function create_fragment(ctx) {
	var div5, div0, t1, br0, t2, div2, div1, t4, select0, t5, br1, t6, div4, div3, t8, select1, dispose;

	let each_value_1 = ctx.layoutOptions;

	let each_blocks_1 = [];

	for (let i = 0; i < each_value_1.length; i += 1) {
		each_blocks_1[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
	}

	let each_value = ctx.languageOptions;

	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
	}

	return {
		c() {
			div5 = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["element"])("div");
			div0 = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["element"])("div");
			div0.innerHTML = `<span>Sidebar</span>`;
			t1 = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["space"])();
			br0 = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["element"])("br");
			t2 = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["space"])();
			div2 = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["element"])("div");
			div1 = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["element"])("div");
			div1.innerHTML = `<span>Layout</span>`;
			t4 = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["space"])();
			select0 = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["element"])("select");

			for (let i = 0; i < each_blocks_1.length; i += 1) {
				each_blocks_1[i].c();
			}

			t5 = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["space"])();
			br1 = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["element"])("br");
			t6 = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["space"])();
			div4 = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["element"])("div");
			div3 = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["element"])("div");
			div3.innerHTML = `<span>Language</span>`;
			t8 = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["space"])();
			select1 = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["element"])("select");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}
			if (ctx.selectedLayout === void 0) Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["add_render_callback"])(() => ctx.select0_change_handler.call(select0));
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["attr"])(div2, "class", "layout-combobox-container");
			if (ctx.selectedLanguage === void 0) Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["add_render_callback"])(() => ctx.select1_change_handler.call(select1));
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["attr"])(div4, "class", "language-combobox-container");
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["attr"])(div5, "class", "sidebar svelte-92lzuu");

			dispose = [
				Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["listen"])(select0, "change", ctx.select0_change_handler),
				Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["listen"])(select0, "change", ctx.change_handler),
				Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["listen"])(select1, "change", ctx.select1_change_handler),
				Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["listen"])(select1, "change", ctx.change_handler_1)
			];
		},

		m(target, anchor) {
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["insert"])(target, div5, anchor);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["append"])(div5, div0);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["append"])(div5, t1);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["append"])(div5, br0);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["append"])(div5, t2);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["append"])(div5, div2);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["append"])(div2, div1);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["append"])(div2, t4);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["append"])(div2, select0);

			for (let i = 0; i < each_blocks_1.length; i += 1) {
				each_blocks_1[i].m(select0, null);
			}

			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["select_option"])(select0, ctx.selectedLayout)

			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["append"])(div5, t5);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["append"])(div5, br1);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["append"])(div5, t6);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["append"])(div5, div4);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["append"])(div4, div3);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["append"])(div4, t8);
			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["append"])(div4, select1);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(select1, null);
			}

			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["select_option"])(select1, ctx.selectedLanguage)
		},

		p(changed, ctx) {
			if (changed.layoutOptions) {
				each_value_1 = ctx.layoutOptions;

				let i;
				for (i = 0; i < each_value_1.length; i += 1) {
					const child_ctx = get_each_context_1(ctx, each_value_1, i);

					if (each_blocks_1[i]) {
						each_blocks_1[i].p(changed, child_ctx);
					} else {
						each_blocks_1[i] = create_each_block_1(child_ctx);
						each_blocks_1[i].c();
						each_blocks_1[i].m(select0, null);
					}
				}

				for (; i < each_blocks_1.length; i += 1) {
					each_blocks_1[i].d(1);
				}
				each_blocks_1.length = each_value_1.length;
			}

			if (changed.selectedLayout) Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["select_option"])(select0, ctx.selectedLayout)

			if (changed.languageOptions) {
				each_value = ctx.languageOptions;

				let i;
				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(changed, child_ctx);
					} else {
						each_blocks[i] = create_each_block(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(select1, null);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}
				each_blocks.length = each_value.length;
			}

			if (changed.selectedLanguage) Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["select_option"])(select1, ctx.selectedLanguage)
		},

		i: svelte_internal__WEBPACK_IMPORTED_MODULE_0__["noop"],
		o: svelte_internal__WEBPACK_IMPORTED_MODULE_0__["noop"],

		d(detaching) {
			if (detaching) {
				Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["detach"])(div5);
			}

			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["destroy_each"])(each_blocks_1, detaching);

			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["destroy_each"])(each_blocks, detaching);

			Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["run_all"])(dispose);
		}
	};
}

function instance($$self, $$props, $$invalidate) {
	const dispatch = Object(svelte__WEBPACK_IMPORTED_MODULE_1__["createEventDispatcher"])();

  let selectedLayout = 2;

  let layoutOptions = [
		{ id: 1, text: `Live` },
		{ id: 2, text: `Quadrants` },
		{ id: 3, text: `Vertical` },
		{ id: 4, text: `Horizontal` },
		{ id: 5, text: `Dashboard` }
	];

	function sendLayoutSelect() {
    // console.log("layout: ", selectedLayout);
    dispatch('message', {
			layout: selectedLayout.id
		});
	}

 let selectedLanguage = 1;

  let languageOptions = [
		{ id: 1, text: `Default` },
		{ id: 2, text: `Bits` },
		{ id: 3, text: `IXI` },
		{ id: 4, text: `Maya` },
	];

	function sendLanguageSelect() {
    console.log("selectedLanguage: ", selectedLanguage);
    dispatch('message', {
			language: selectedLanguage.id
		});
	}

	function select0_change_handler() {
		selectedLayout = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["select_value"])(this);
		$$invalidate('selectedLayout', selectedLayout);
		$$invalidate('layoutOptions', layoutOptions);
	}

	const change_handler = () => sendLayoutSelect();

	function select1_change_handler() {
		selectedLanguage = Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["select_value"])(this);
		$$invalidate('selectedLanguage', selectedLanguage);
		$$invalidate('languageOptions', languageOptions);
	}

	const change_handler_1 = () => sendLanguageSelect();

	return {
		selectedLayout,
		layoutOptions,
		sendLayoutSelect,
		selectedLanguage,
		languageOptions,
		sendLanguageSelect,
		select0_change_handler,
		change_handler,
		select1_change_handler,
		change_handler_1
	};
}

class Sidebar extends svelte_internal__WEBPACK_IMPORTED_MODULE_0__["SvelteComponent"] {
	constructor(options) {
		super();
		Object(svelte_internal__WEBPACK_IMPORTED_MODULE_0__["init"])(this, options, instance, create_fragment, svelte_internal__WEBPACK_IMPORTED_MODULE_0__["safe_not_equal"], []);
	}
}


if (false) {}

/* harmony default export */ __webpack_exports__["default"] = (Sidebar);




/***/ }),

/***/ "./src/UI/Sidebar.svelte.css":
/*!***********************************!*\
  !*** ./src/UI/Sidebar.svelte.css ***!
  \***********************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

var content = __webpack_require__(/*! !../../node_modules/css-loader/dist/cjs.js!./Sidebar.svelte.css */ "./node_modules/css-loader/dist/cjs.js!./src/UI/Sidebar.svelte.css");

if (typeof content === 'string') {
  content = [[module.i, content, '']];
}

var options = {}

options.insert = "head";
options.singleton = false;

var update = __webpack_require__(/*! ../../node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js */ "./node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js")(content, options);

if (content.locals) {
  module.exports = content.locals;
}


/***/ }),

/***/ "./src/interpreter/compiler-low-level.js":
/*!***********************************************!*\
  !*** ./src/interpreter/compiler-low-level.js ***!
  \***********************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* WEBPACK VAR INJECTION */(function(process) {/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "default", function() { return compileLowLevel; });
/* harmony import */ var nearley__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! nearley */ "./node_modules/nearley/lib/nearley.js");
/* harmony import */ var nearley__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(nearley__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var nearley_lib_nearley_language_bootstrapped__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! nearley/lib/nearley-language-bootstrapped */ "./node_modules/nearley/lib/nearley-language-bootstrapped.js");
/* harmony import */ var nearley_lib_nearley_language_bootstrapped__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(nearley_lib_nearley_language_bootstrapped__WEBPACK_IMPORTED_MODULE_1__);
/*
  MIT License
  Copyright (c) 2019 Guillermo Webster
  Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
  The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/  




function compileLowLevel(structure, opts) {
	var unique = uniquer();
	if (!opts.alreadycompiled) {
		opts.alreadycompiled = [];
	}

	var result = {
		rules: [],
		body: [], // @directives list
		config: {}, // @config value
		customTokens: [], // %tokens
		macros: {},
		start: ""
	};

	for (var i = 0; i < structure.length; i++) {
		var productionRule = structure[i];
		markRange(
			productionRule.name,
			productionRule.pos,
			productionRule.name && productionRule.name.length
		);

		if (productionRule.body) {
			// This isn't a rule, it's an @directive.
			if (!opts.nojs) {
				result.body.push(productionRule.body);
			}
		} else if (productionRule.include) {
			// Include file
			var path;
			if (!productionRule.builtin) {
				path = __webpack_require__(/*! path */ "./node_modules/path-browserify/index.js").resolve(
					opts.file ? __webpack_require__(/*! path */ "./node_modules/path-browserify/index.js").dirname(opts.file) : process.cwd(),
					productionRule.include
				);
			} else {
				path = productionRule.include;
			}
			if (opts.alreadycompiled.indexOf(path) === -1) {
				opts.alreadycompiled.push(path);
				if (path === "postprocessors.ne") {
					var f = __webpack_require__(/*! nearley/builtin/postprocessors.ne */ "./node_modules/nearley/builtin/postprocessors.ne");
				} else if (path === "whitespace.ne") {
					var f = __webpack_require__(/*! nearley/builtin/whitespace.ne */ "./node_modules/nearley/builtin/whitespace.ne");
				} else if (path === "string.ne") {
					var f = __webpack_require__(/*! nearley/builtin/string.ne */ "./node_modules/nearley/builtin/string.ne");
				} else if (path === "number.ne") {
					var f = __webpack_require__(/*! nearley/builtin/number.ne */ "./node_modules/nearley/builtin/number.ne");
				} else if (path === "cow.ne") {
					var f = __webpack_require__(/*! nearley/builtin/cow.ne */ "./node_modules/nearley/builtin/cow.ne");
				}

				var parserGrammar = nearley__WEBPACK_IMPORTED_MODULE_0___default.a.Grammar.fromCompiled(nearley_lib_nearley_language_bootstrapped__WEBPACK_IMPORTED_MODULE_1___default.a);
				var parser = new nearley__WEBPACK_IMPORTED_MODULE_0___default.a.Parser(parserGrammar);
				parser.feed(f);
				var c = Compile(parser.results[0], {
					file: path,
					__proto__: opts
				});

				result.rules = result.rules.concat(c.rules);
				result.body = result.body.concat(c.body);
				// result.customTokens = result.customTokens.concat(c.customTokens);
				Object.keys(c.config).forEach(function(k) {
					result.config[k] = c.config[k];
				});
				Object.keys(c.macros).forEach(function(k) {
					result.macros[k] = c.macros[k];
				});
			}
		} else if (productionRule.macro) {
			result.macros[productionRule.macro] = {
				args: productionRule.args,
				exprs: productionRule.exprs
			};
		} else if (productionRule.config) {
			// This isn't a rule, it's an @config.
			result.config[productionRule.config] = productionRule.value;
		} else {
			produceRules(productionRule.name, productionRule.rules, {});
			if (!result.start) {
				result.start = productionRule.name;
			}
		}
	}

	return result;

	function markRange(name, start, length) {
		// console.log(name, [start, start + length])
		if (opts.rangeCallback) {
			opts.rangeCallback(name, start, start + length);
		}
	}

	function produceRules(name, rules, env) {
		for (var i = 0; i < rules.length; i++) {
			var rule = buildRule(name, rules[i], env);
			if (opts.nojs) {
				rule.postprocess = null;
			}
			result.rules.push(rule);
		}
	}

	function buildRule(ruleName, rule, env) {
		var tokens = [];
		for (var i = 0; i < rule.tokens.length; i++) {
			var token = buildToken(ruleName, rule.tokens[i], env);
			if (token !== null) {
				tokens.push(token);
			}
		}
		return new nearley__WEBPACK_IMPORTED_MODULE_0___default.a.Rule(ruleName, tokens, rule.postprocess);
	}

	function buildToken(ruleName, token, env) {
		if (typeof token === "string") {
			if (token === "null") {
				return null;
			}
			return token;
		}

		if (token instanceof RegExp) {
			return token;
		}

		if (token.literal) {
			if (!token.literal.length) {
				return null;
			}
			if (token.literal.length === 1 || result.config.lexer) {
				return token;
			}
			return buildStringToken(ruleName, token, env);
		}
		if (token.token) {
			if (result.config.lexer) {
				var name = token.token;
				if (result.customTokens.indexOf(name) === -1) {
					result.customTokens.push(name);
				}
				var expr =
					result.config.lexer +
					".has(" +
					JSON.stringify(name) +
					") ? {type: " +
					JSON.stringify(name) +
					"} : " +
					name;
				return { token: "(" + expr + ")" };
			}

			return token;
		}

		if (token.subexpression) {
			return buildSubExpressionToken(ruleName, token, env);
		}

		if (token.ebnf) {
			return buildEBNFToken(ruleName, token, env);
		}

		if (token.macrocall) {
			return buildMacroCallToken(ruleName, token, env);
		}

		if (token.mixin) {
			if (env[token.mixin]) {
				return buildToken(ruleName, env[token.mixin], env);
			} else {
				throw new Error("Unbound variable: " + token.mixin);
			}
		}

		throw new Error("unrecognized token: " + JSON.stringify(token));
	}

	function buildStringToken(ruleName, token, env) {
		var newname = unique(ruleName + "$string");
		markRange(newname, token.pos, JSON.stringify(token.literal).length);

		produceRules(
			newname,
			[
				{
					tokens: token.literal.split("").map(function charLiteral(d) {
						return {
							literal: d
						};
					}),
					postprocess: { builtin: "joiner" }
				}
			],
			env
		);
		return newname;
	}

	function buildSubExpressionToken(ruleName, token, env) {
		var data = token.subexpression;
		var name = unique(ruleName + "$subexpression");
		//structure.push({"name": name, "rules": data});
		produceRules(name, data, env);
		return name;
	}

	function buildEBNFToken(ruleName, token, env) {
		switch (token.modifier) {
			case ":+":
				return buildEBNFPlus(ruleName, token, env);
			case ":*":
				return buildEBNFStar(ruleName, token, env);
			case ":?":
				return buildEBNFOpt(ruleName, token, env);
		}
	}

	function buildEBNFPlus(ruleName, token, env) {
		var name = unique(ruleName + "$ebnf");
		/*
        structure.push({
            name: name,
            rules: [{
                tokens: [token.ebnf],
            }, {
                tokens: [token.ebnf, name],
                postprocess: {builtin: "arrconcat"}
            }]
        });
        */
		produceRules(
			name,
			[
				{
					tokens: [token.ebnf]
				},
				{
					tokens: [token.ebnf, name],
					postprocess: { builtin: "arrconcat" }
				}
			],
			env
		);
		return name;
	}

	function buildEBNFStar(ruleName, token, env) {
		var name = unique(ruleName + "$ebnf");
		/*
        structure.push({
            name: name,
            rules: [{
                tokens: [],
            }, {
                tokens: [token.ebnf, name],
                postprocess: {builtin: "arrconcat"}
            }]
        });
        */
		produceRules(
			name,
			[
				{
					tokens: []
				},
				{
					tokens: [token.ebnf, name],
					postprocess: { builtin: "arrconcat" }
				}
			],
			env
		);
		return name;
	}

	function buildEBNFOpt(ruleName, token, env) {
		var name = unique(ruleName + "$ebnf");
		/*
        structure.push({
            name: name,
            rules: [{
                tokens: [token.ebnf],
                postprocess: {builtin: "id"}
            }, {
                tokens: [],
                postprocess: {builtin: "nuller"}
            }]
        });
        */
		produceRules(
			name,
			[
				{
					tokens: [token.ebnf],
					postprocess: { builtin: "id" }
				},
				{
					tokens: [],
					postprocess: { builtin: "nuller" }
				}
			],
			env
		);
		return name;
	}

	function buildMacroCallToken(ruleName, token, env) {
		var name = unique(ruleName + "$macrocall");
		var macro = result.macros[token.macrocall];
		if (!macro) {
			throw new Error("Unkown macro: " + token.macrocall);
		}
		if (macro.args.length !== token.args.length) {
			throw new Error("Argument count mismatch.");
		}
		var newenv = { __proto__: env };
		for (var i = 0; i < macro.args.length; i++) {
			var argrulename = unique(ruleName + "$macrocall");
			newenv[macro.args[i]] = argrulename;
			produceRules(argrulename, [token.args[i]], env);
			//structure.push({"name": argrulename, "rules":[token.args[i]]});
			//buildRule(name, token.args[i], env);
		}
		produceRules(name, macro.exprs, newenv);
		return name;
	}
}

function uniquer() {
	var uns = {};
	return unique;
	function unique(name) {
		var un = (uns[name] = (uns[name] || 0) + 1);
		return name + "$" + un;
	}
}

/* WEBPACK VAR INJECTION */}.call(this, __webpack_require__(/*! ./../../node_modules/process/browser.js */ "./node_modules/process/browser.js")))

/***/ }),

/***/ "./src/interpreter/compiler.js":
/*!*************************************!*\
  !*** ./src/interpreter/compiler.js ***!
  \*************************************/
/*! exports provided: default, get_exports */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "default", function() { return compile; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "get_exports", function() { return get_exports; });
/* harmony import */ var nearley__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! nearley */ "./node_modules/nearley/lib/nearley.js");
/* harmony import */ var nearley__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(nearley__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _compiler_low_level__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./compiler-low-level */ "./src/interpreter/compiler-low-level.js");
/* harmony import */ var nearley_lib_nearley_language_bootstrapped__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! nearley/lib/nearley-language-bootstrapped */ "./node_modules/nearley/lib/nearley-language-bootstrapped.js");
/* harmony import */ var nearley_lib_nearley_language_bootstrapped__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(nearley_lib_nearley_language_bootstrapped__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var nearley_lib_generate_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! nearley/lib/generate.js */ "./node_modules/nearley/lib/generate.js");
/* harmony import */ var nearley_lib_generate_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(nearley_lib_generate_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var nearley_lib_lint_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! nearley/lib/lint.js */ "./node_modules/nearley/lib/lint.js");
/* harmony import */ var nearley_lib_lint_js__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(nearley_lib_lint_js__WEBPACK_IMPORTED_MODULE_4__);
/*
  MIT License
  Copyright (c) 2019 Guillermo Webster
  Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
  The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/











function stream() {
	let out = "";
	return {
		write(str) {
			out += str;
		},
		dump() {
			return out;
		}
	};
}

function AnnotatePositions(rules) {
	return rules.map(
		rule =>
			new nearley__WEBPACK_IMPORTED_MODULE_0___default.a.Rule(
				rule.name,
				rule.symbols,
				rule.postprocess &&
					((data, ref, reject) => {
						var orig = rule.postprocess(data, ref, reject);
						if (orig === null) return null;
						if (typeof orig == "object" && !orig.slice) {
							orig.pos = ref;
						}
						return orig;
					})
			)
	);
}

function compile(grammar) {
	
	let parser = new nearley__WEBPACK_IMPORTED_MODULE_0___default.a.Parser( AnnotatePositions(nearley_lib_nearley_language_bootstrapped__WEBPACK_IMPORTED_MODULE_2__["ParserRules"]), nearley_lib_nearley_language_bootstrapped__WEBPACK_IMPORTED_MODULE_2__["ParserStart"], { lexer: nearley_lib_nearley_language_bootstrapped__WEBPACK_IMPORTED_MODULE_2__["Lexer"] } );

	let errors = stream();
	let output = "";
	let positions = {};

	try {
		parser.feed(grammar);
		if (parser.results[0]) {
			function rangeCallback(name, start, end) {
				positions[name] = [start, end];
			}
			var c = Object(_compiler_low_level__WEBPACK_IMPORTED_MODULE_1__["default"])(parser.results[0], {
				rangeCallback: rangeCallback
			});
			nearley_lib_lint_js__WEBPACK_IMPORTED_MODULE_4___default()(c, { out: errors });

			output = nearley_lib_generate_js__WEBPACK_IMPORTED_MODULE_3___default()(c, "grammar");
		}
	} catch (e) {
		errors.write(e);
	}

	return {
		errors: errors.dump(),
		positions,
		output
	};
}

function get_exports(source) {
	let module = { exports: "" };
	eval(source);
	return module.exports;
}


/***/ }),

/***/ "./src/interpreter/defaultGrammar.ne":
/*!*******************************************!*\
  !*** ./src/interpreter/defaultGrammar.ne ***!
  \*******************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony default export */ __webpack_exports__["default"] = ("@{%\nconst moo = require(\"moo\"); // this 'require' creates a node dependency\n\nconst lexer = moo.compile({\n  separator:    /,/,\n  paramEnd:     /}/,\n  paramBegin:   /{/,\n  variable:     /:[a-zA-Z0-9]+:/,\n  sample:       { match: /\\\\[a-zA-Z0-9]+/, lineBreaks: true, value: x => x.slice(1, x.length)},\n  oscAddress:   /(?:\\/[a-zA-Z0-9]+)+/,\n  number:       /-?(?:[0-9]|[1-9][0-9]+)(?:\\.[0-9]+)?(?:[eE][-+]?[0-9]+)?\\b/,\n  semicolon:    /;/,\n  funcName:     /[a-zA-Z][a-zA-Z0-9]*/,\n  comment:      /\\#[^\\n]:*/, \n  ws:           {match: /\\s+/, lineBreaks: true},\n});\n%}\n\n\n\n# Pass your lexer object using the @lexer option\n@lexer lexer\n\nmain -> _ Statement _                                         {% d => ({ \"@lang\" : d[1] })  %}\n\nStatement ->\n      Expression _ %semicolon _ Statement            {% d => [{ \"@spawn\": d[0] }].concat(d[4]) %}\n      |\n      Expression                                      {% d => [{\"@sigOut\": { \"@spawn\": d[0] }}] %}\n      # | %hash . \"\\n\"                                          {% d => ({ \"@comment\": d[3] }) %}\n\nExpression ->\n  ParameterList _ %funcName\n  {% d => ({ \"@synth\": Object.assign(d[0],{\"@jsfunc\":d[2]})}) %}\n  |\n  ParameterList _ %sample\n  {% d => {d[0][\"@params\"] = d[0][\"@params\"].concat([{\"@string\":d[2].value}]);\n  return { \"@synth\": Object.assign(d[0],{\"@jsfunc\":{value:\"sampler\"}})}} %}\n  |\n  %oscAddress\n  {% d => ({ \"@synth\": {\"@params\":[{\"@string\":d[0].value},{\"@num\":{value:-1}}], \"@jsfunc\":{value:\"oscin\"}}} ) %}\n  |\n  ParameterList _ %oscAddress\n  {% d => ({ \"@synth\": {\"@params\":[{\"@string\":d[2].value},d[0][\"@params\"][0]], \"@jsfunc\":{value:\"oscin\"}}} ) %}\n  |\n  %variable _ Expression\n  {% d => ({\"@setvar\": {\"@varname\":d[0],\"@varvalue\":d[2]}} ) %}\n  |\n  %comment {% id %}\n\nParameterList ->\n  %paramBegin Params  %paramEnd\n  {% d => ({\"paramBegin\":d[0], \"@params\":d[1], \"paramEnd\":d[2]} ) %}\n\n\nParams ->\n  ParamElement                                                   {% (d) => ([d[0]]) %}\n  |\n  ParamElement _ %separator _ Params                             {% d => [d[0]].concat(d[4]) %}\n\nParamElement ->\n  %number                                                     {% (d) => ({\"@num\":d[0]}) %}\n  |\n  Expression                                                  {% id %}\n  |\n  %variable                                                   {% (d) => ({\"@getvar\":d[0]}) %}\n  |\n  %paramBegin Params  %paramEnd                               {%(d) => ({\"@list\":d[1]})%}\n\n\n\n\n# Whitespace\n\n_  -> wschar:*                                                {% function(d) {return null;} %}\n__ -> wschar:+                                                {% function(d) {return null;} %}\n\nwschar -> %ws                                                 {% id %}\n");

/***/ }),

/***/ "./src/interpreter/defaultLiveCode.sem":
/*!*********************************************!*\
  !*** ./src/interpreter/defaultLiveCode.sem ***!
  \*********************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony default export */ __webpack_exports__["default"] = (":b:{{1,0.25}imp}\\909b; \n:s:{{1,0.5}imp}\\909; \n:c:{{{1,0.66}imp,{1,0.8}imp}add}\\909closed; \n:o:{{0.25,0.75}imp}\\909open; \n\n:tri:{30}tri; \n:sin:{200}sin; \n:saw:{4}saw; \n\n{:tri:,:saw:,{:sin:,0.4}mul, :o:, :s:, :b:, :c:}mix");

/***/ }),

/***/ "./src/main.js":
/*!*********************!*\
  !*** ./src/main.js ***!
  \*********************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _UI_App_svelte__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./UI/App.svelte */ "./src/UI/App.svelte");
/* harmony import */ var _interpreter_compiler__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./interpreter/compiler */ "./src/interpreter/compiler.js");


const app = new _UI_App_svelte__WEBPACK_IMPORTED_MODULE_0__["default"]({
	target: document.body,
	props: {
		name: "world",
		liveCode: `:b:{{1,0.25}imp}\\909b; :s:{{1,0.5}imp}\909; :c:{{{1,0.66}imp,{1,0.8}imp}add}\\909closed; :o:{{0.25,0.75}imp}\\909open; :tri:{30}tri; :sin:{200}sin; :saw:{4}saw; {:tri:,:saw:,{:sin:,0.4}mul, :o:, :s:, :b:, :c:}mix`,
		grammarCode: `//js //create the model var model = tf.sequential(); model.add(tf.layers.dense({ units: 1, inputShape: [1] })); model.compile({ loss: 'meanSquaredError', optimizer: 'sgd' }); //set up the training data set var xs = tf.tensor2d([0, 1, 2, 3, 4, 5], [6, 1]); var ys = tf.tensor2d([0, 50, 100, 150, 200, 250], [6, 1]); //train the model on the data set model.fit(xs, ys, { epochs: 50 }).then(result => {console.log(\`Model trained\`); console.log(result)}); //defining the callback for testing the model on new data var test = (x) => { return model.predict(tf.tensor2d([x], [1, 1])).dataSync()[0]; } __________ //route the test data into the model var w = 0; input = (id,x) => {console.log(">toModel: "+[id,x]); w=x}; __________ //route the model predictions back to the live coding environment output = (x) => {p = test(w);console.log(">fromModel: "+p); return p;}`
	}
});

window.app = app;

/* harmony default export */ __webpack_exports__["default"] = (app);

/***/ }),

/***/ 0:
/*!***************************!*\
  !*** multi ./src/main.js ***!
  \***************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(/*! ./src/main.js */"./src/main.js");


/***/ })

/******/ });
//# sourceMappingURL=client.bundle.js.map