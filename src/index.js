import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

import * as nearley from 'nearley';
import * as processor from './eppprocessor';


// import snare from './assets/909.wav';

import {
  MaxiLibEngine1,
  MaxiLibEngine2,
  Monosynth
} from './maxiAudioEngine';

import MaxiLib from './maxiLib';
import treeJSON from './dndTree';
import css from './style/tree.css';


//

console.log("MaxiAudio loading...");
//Initialization code
let maxiLib = MaxiLib();
let audio = new maxiLib.maxiAudio();
let timer = new maxiLib.maxiOsc(); //this is the metronome
let currentCount = 0;
let lastCount = 0; //these values are used to check if we have a new beat this sample
let mix = 0.0;
let monosynthLoaded = false;

console.log("MaxiAudio loaded...");

maxiAudio.play = function() {

  this.output = mixer();

};




play();



var editor1 = monaco.editor.create(document.getElementById('editor1'), {
  value: [
    'function x() {',
    '\tconsole.log("Language editor!");',
    '}'
  ].join('\n'),
  language: 'javascript',
  lineNumbers: "on",
  roundedSelection: false,
  scrollBeyondLastLine: false,
  readOnly: false,
  theme: "vs-dark",
  wordWrap: 'on'
});

var editor2 = monaco.editor.create(document.getElementById('editor2'), {
  value: [
    '\tconsole.log("MaxiLib Output");'
  ].join('\n'),
  language: 'javascript',
  wordWrap: 'on'

});

var myCondition1 = editor1.createContextKey( /*key name*/ 'myCondition1', /*default value*/ false);
var myCondition2 = editor1.createContextKey( /*key name*/ 'myCondition2', /*default value*/ false);

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

let engine1 = new MaxiLibEngine1();
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


editor1.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Enter, function() {
  // services available in `ctx`

  var text = editor1.getValue();

  var selection = editor1.getSelection(); //[2,1 -> 2,34]
  var valueInSelection = editor1.getModel().getValueInRange(selection); //[2,1 -> 2,34]

  const parser = new nearley.Parser(nearley.Grammar.fromCompiled(processor));
  //
  parser.feed(valueInSelection);
  //

  alert("Text: " + text + '\n\n' +
    "Selection: " + selection + '\n\n' +
    "Text in Selection: " + valueInSelection + '\n\n' +
    "Parse Results: " + parser.results[0]
  );

  var AST = parser.results[0];

  // console.log( JSON.stringify(AST) );
  editor2.getModel().setValue(JSON.stringify(AST));
  // maxiLibEngine.interpret( JSON.stringify(AST) );
  // maxiLibEngine.play();

}, 'myCondition1 && myCondition2')

myCondition1.set(true);

setTimeout(function() {
  alert('Press Shift+Enter to evaluate expression');
  myCondition2.set(true);
  // you can use myCondition2.reset() to go back to the default
}, 2000);

var statusNode = document.getElementById('container');
var vimMode = MonacoVim.initVimMode(editor1, statusNode);
// remove vim mode by calling
// vimMode.dispose();
