// import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import * as nearley from 'nearley';
import * as processor from './eppprocessor';

// import snare from './assets/909.wav';

import {
  AudioEngine,
  MaxiLibEngine1,
  MaxiLibEngine2,
  Monosynth
} from './audioEngine';

import MaxiLib from './maxiLib';
// import treeJSON from './dndTree';
import AudioWorkletIndicator from './components';


import './assets/samples/909.wav';
import './assets/samples/909b.wav';
import './assets/samples/909closed.wav';
import './assets/samples/909open.wav';

import './style/index.css';
import './style/tree.css';
import './style/editors.css';

import * as CodeMirror from 'codemirror/lib/codemirror.js';
import 'codemirror/mode/javascript/javascript.js';
import 'codemirror/theme/ambiance.css';
import 'codemirror/theme/abcdef.css';
import 'codemirror/keymap/vim.js';
import 'codemirror/lib/codemirror.css';

let audio;
let customNode;
let processorCount = 0;

const defaultEditorCode1 = `//Synth
☺sauron <- osc(∆, 1.0, 1.34).osc(~, 1.0, 1.04).osc(Ø, osc(∞, 440, 1.04)+osc(≈, 66, 1.30))

//Gandalfs'beat
☻gandalf <- [.0x.0-x.0-x.-0x-.-]

☺sauron << ☻gandalf
'🎹' << '🎙️' << '🎧' << '🎚️' << '🎛️'`;


function createEditor1() {

  var editor1 = CodeMirror(document.getElementById('editor1'), {
    value: defaultEditorCode1,
    theme: "abcdef",
    lineNumbers: true,
    // mode:  "javascript",
    lineWrapping: true,
    extraKeys: {
      [ "Cmd-Enter" ]: () => playAudio(editor1),
      [ "Cmd-."]: () => stopAudio(),
    }

  });
  editor1.setSize('100%', '100%');
  editor1.setOption("vimMode", true);
}

const defaultEditorCode2 = "∞(∆, 1.0, 1.5).∞(~, 1.0. 1.04).∞(∞(∞, 440, 1.04)+∞(≈, 66, 1.30))";

function createEditor2() {

  var editor2 = CodeMirror(document.getElementById('editor2'), {
    value: defaultEditorCode2,
    lineNumbers: true,
    theme: "ambiance",
    lineWrapping: true
  });
  editor2.setSize('100%', '100%');
}


function createControls(){

  const isMac = CodeMirror.keyMap.default === CodeMirror.keyMap.macDefault;
  const runKeys = isMac ? "Cmd-Enter" : "Ctrl-Enter";
  const container = document.getElementById("containerButtons");

  const runButton = document.createElement("button");
  runButton.textContent = `Play: ${runKeys.replace("-", " ")}`;

  const stopKeys = isMac ? "Cmd-." : "Ctrl-.";
  const stopButton = document.createElement("button");
  stopButton.textContent = `Stop: ${stopKeys.replace("-", " ")}`;

  container.appendChild(runButton);
  runButton.addEventListener("click", () => playAudio(editor1));

  container.appendChild(stopButton);
  stopButton.addEventListener("click", () => stopAudio());

}


// Create and registor processor node according to pattern. NOTE: Custom processor is hardcoded
function createCustomProcessorCode(userCode, processorName) {

  return `${userCode} registerProcessor("${processorName}", CustomProcessor);`;
}

const defaultUserCode = `// WARNING: Must be named CustomProcessor
class CustomProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{
      name: 'gain',
      defaultValue: 0.1
    }];
  }

  constructor() {
    super();

    // can't actually query this until this.getContextInfo() is implemented
    // update manually if you need it
    this.sampleRate = 44100;
  }

  process(inputs, outputs, parameters) {
    const speakers = outputs[0];

    for (let i = 0; i < speakers[0].length; i++) {
      const noise = Math.random() * 2 - 1;
      const gain = parameters.gain[i];
      speakers[0][i] = noise * gain;
      speakers[1][i] = noise * gain;
    }

    return true;
  }
}`;

function playAudio(editor) {

  stopAudio();

  runEditorCode(editor);
}

function stopAudio() {
  if (customNode !== undefined) {
    customNode.disconnect(audio.destination);
    customNode = undefined;
  }
}

function runEditorCode(editor) {

  // const userCode = editor.getDoc().getValue();
  const processorName = `processor-${processorCount++}`;

  const code = createCustomProcessorCode(defaultUserCode, processorName);

  const blob = new Blob([code], { type: "application/javascript" });

  const url = window.URL.createObjectURL(blob);

  runAudioWorklet(url, processorName);
}









function runAudioWorklet(workletUrl, processorName) {

  audio.audioWorklet.addModule(workletUrl).then(() => {
    stopAudio();
    customNode = new CustomAudioNode(audio, processorName);
    customNode.connect(audio.destination);
  });
}



document.addEventListener("DOMContentLoaded", () => {

    document.getElementById('audioWorkletIndicator').innerHTML = AudioWorkletIndicator.AudioWorkletIndicator();

    audio = new AudioContext();

    try {
      // have to use class Expression if inside a try
      // doing this to catch unsupported browsers
      window.CustomAudioNode = class CustomAudioNode extends AudioWorkletNode {
        constructor(audioContext, processorName) {
          super(audioContext, processorName, {
            numberOfInputs: 0,
            numberOfOutputs: 1,
            outputChannelCount: [2]
          });
        }
      };
    } catch (e) {
      // unsupported
    }

    document.getElementById("sampleRateIndicatorValue").textContent = audio.sampleRate;

    // resumeContextOnInteraction(audio);

    createEditor1();

    createEditor2();

    createControls();

});



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
