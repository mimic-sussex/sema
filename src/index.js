// import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';



import * as nearley from 'nearley';
import * as processor from './eppprocessor';


// import snare from './assets/909.wav';

import {
  MaxiLibEngine1,
  MaxiLibEngine2,
  Monosynth
} from './maxiAudioEngine';

import MaxiLib from './maxiLib';
import treeJSON from './dndTree'
import AudioWorkletIndicator from './components';

import './style/index.css';
import './style/tree.css';
import './style/editors.css';

import * as CodeMirror from 'codemirror/lib/codemirror.js';
import 'codemirror/mode/javascript/javascript.js';
import 'codemirror/theme/ambiance.css';
import 'codemirror/theme/abcdef.css';
import 'codemirror/keymap/vim.js';

// import * as CodeMirror from './codeMirror';

import 'codemirror/lib/codemirror.css';


document.getElementById('audioWorkletIndicator').innerHTML = AudioWorkletIndicator.AudioWorkletIndicator();
// var x = AudioWorkletIndicator;
// console.log(x.AudioWorkletIndicator());

// document.getElementById('audioWorkletIndicator').innerHTML = AudioWorkletIndicator();


var editor1 = CodeMirror(document.getElementById('editor1'), {
  value: "//Synth\nosc(∆, 1.0, 1.34).osc(~, 1.0. 1.04).osc(Ø, osc(∞, 440, 1.04)+osc(≈, 66, 1.30))\n\n\/\/Gandalfsbbeat\n@gandalf <- [.0x.0-x.0-x.-0x-.-]",
  theme: "abcdef",
  lineNumbers: true,
  // mode:  "javascript",
  lineWrapping: true
});
editor1.setSize('100%', '100%');


var editor2 = CodeMirror(document.getElementById('editor2'), {
  value: "osc(∆, 1.0, Ø).osc(~, 1.0. 1.04).osc(osc(∞, 440, 1.04)+osc(≈, 66, 1.30))",
  lineNumbers: true,
  theme: "ambiance",
  lineWrapping: true
});

editor2.setSize('100%', '100%');



// var editor1 = CodeMirror(document.getElementById('editor1'), {
//   value: "[x.o-x.o-xo.xo-]",
//   // mode:  "javascript",
//   // theme: "erlang-dark",
//   // lineNumbers: true,
//   // styleActiveLine: true,
//   // matchBrackets: true
// });

// var editor2 = CodeMirror(document.getElementById('editor2'), {
//   value: "osc tri 1.0",
//   // mode:  "javascript",
//   // theme: "ambiance",
//   // lineNumbers: true,
//   // styleActiveLine: true,
//   // matchBrackets: true
// });




// let $handle = document.querySelector(".handle");
// let $container = document.querySelector(".container");
//
// let cm = CodeMirror($container, { lineNumbers: true, lineWrapping: true });
//
// function height_of($el) {
// 	return parseInt(window.getComputedStyle($el).height.replace(/px$/, ""));
// }
//
// const MIN_HEIGHT = 200;
//
// var start_x;
// var start_y;
// var start_h;
//
// function on_drag(e) {
//   cm.setSize(null, Math.max(MIN_HEIGHT, (start_h + e.y - start_y)) + "px");
// }
//
// function on_release(e) {
//   console.log("end");
//   document.body.removeEventListener("mousemove", on_drag);
//   window.removeEventListener("mouseup", on_release);
// }
//
// $handle.addEventListener("mousedown", function (e) {
//   console.log("start");
//   start_x = e.x;
//   start_y = e.y;
//   start_h = height_of($container);
//
// 	document.body.addEventListener("mousemove", on_drag);
//   window.addEventListener("mouseup", on_release);
// });
//


// console.log("MaxiAudio loading...");
// //Initialization code
//
// let audio = maxiLib.maxiAudio();
// let timer = new maxiLib.maxiOsc(); //this is the metronome
// let currentCount = 0;
// let lastCount = 0; //these values are used to check if we have a new beat this sample
// let mix = 0.0;
// let monosynthLoaded = false;
//
// console.log("MaxiAudio loaded...");
//
// maxiAudio.play = function() {
//
//   this.output =
// };
//
// play();

// var editor1 = monaco.editor.create(document.getElementById('editor1'), {
//   value: [
//     'function x() {',
//     '\tconsole.log("Language editor!");',
//     '}'
//   ].join('\n'),
//   language: 'javascript',
//   lineNumbers: "on",
//   roundedSelection: false,
//   scrollBeyondLastLine: false,
//   readOnly: false,
//   theme: "vs-dark",
//   wordWrap: 'on'
// });

// var editor2 = monaco.editor.create(document.getElementById('editor2'), {
//   value: [
//     '\tconsole.log("MaxiLib Output");'
//   ].join('\n'),
//   language: 'javascript',
//   wordWrap: 'on'
// });



// var myCondition1 = editor1.createContextKey( /*key name*/ 'myCondition1', /*default value*/ false);
// var myCondition2 = editor1.createContextKey( /*key name*/ 'myCondition2', /*default value*/ false);

// function execMaxi(){
//   var maxiLib = MaxiLib();
//   var audio = new maxiLib.maxiAudio();
//   audio.init();
//   var mySine = new maxiLib.maxiOsc();
//   audio.play = function(){
//   	this.output = mySine.sinewave(440);
//   }
// }
// execMaxi();

// MaxiLibEngine2.prototype.helloMaxi();

// let engine1 = new MaxiLibEngine1();
// engine1.init();
// console.log("engine loaded");
// console.log("M: " + MaxiLibEngine1);
// console.log("engine: " + Object.keys(MaxiLibEngine1));
// console.log("instance: " + Object.keys(MaxiLibEngine1._instance));
// console.log("prototype: " + Object.keys(MaxiLibEngine1.prototype));

// console.log("p_init: " + Object.keys(MaxiLibEngine.prototype.init()));
// console.log(MaxiLibEngine.prototype.init);
// Object.keys("enging prototype: " + maxiLibEngine.prototype);
// maxiLibEngine.interpret( "JSON.stringify(AST)" );
// maxiLibEngine.play();

// function maxiEngine(f) {
//   maximjs = MaxiLib;
//   this.maxiAudio = new maximJs.maxiAudio()
//
//   maxiAudio.init();
//   maxiAudio.loadSample("909b.wav", kick);
//   maxiAudio.loadSample("909.wav", snare);
//   maxiAudio.loadSample("909closed.wav", closedHat);
//   maxiAudio.loadSample("909open.wav", openHat);
//   maxiAudio.play = f;
// }

//
// editor1.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Enter, function() {
//   // services available in `ctx`
//
//   var text = editor1.getValue();
//
//   var selection = editor1.getSelection(); //[2,1 -> 2,34]
//   var valueInSelection = editor1.getModel().getValueInRange(selection); //[2,1 -> 2,34]
//
//   const parser = new nearley.Parser(nearley.Grammar.fromCompiled(processor));
//   //
//   parser.feed(valueInSelection);
//   //
//
//   alert("Text: " + text + '\n\n' +
//     "Selection: " + selection + '\n\n' +
//     "Text in Selection: " + valueInSelection + '\n\n' +
//     "Parse Results: " + parser.results[0]
//   );
//
//   var AST = parser.results[0];
//
//   // console.log( JSON.stringify(AST) );
//   editor2.getModel().setValue(JSON.stringify(AST));
//   // maxiLibEngine.interpret( JSON.stringify(AST) );
//   // maxiLibEngine.play();
//
//
//
// }, 'myCondition1 && myCondition2')

// myCondition1.set(true);
//
// setTimeout(function() {
//   alert('Press Shift+Enter to evaluate expression');
//   myCondition2.set(true);
//   // you can use myCondition2.reset() to go back to the default
// }, 2000);
//
// var statusNode = document.getElementById('container');
// var vimMode = MonacoVim.initVimMode(editor1, statusNode);
// remove vim mode by calling
// vimMode.dispose();
