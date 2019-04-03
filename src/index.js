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
import './maxiLib.wasm';

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

import langSketch from './langSketch';

let audio;
let customNode;
let processorCount = 0;

function maxiEngine() {
  let maxiLib = MaxiLib();
}

function wasmReady(){

  console.log("MaxiLib WASM loaded")
  var maxiAudio = new maxiLib.maxiAudio();
  maxiAudio.init();
  maxiAudio.loadSample("./assets/samples/909b.wav", kick);
  maxiAudio.loadSample("./assets/samples/909.wav", snare);
  maxiAudio.loadSample("./assets/samples/909closed.wav", closedHat);
  maxiAudio.loadSample("./assets/samples/909open.wav", openHat);
  console.log("Samples loaded")
}

// Default editor code example is stored at 'langSketch.js'
const defaultEditorCode1 = langSketch;

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

function customUserCode (expression) {

  let userDefinedFunction;

  switch (expression%2) {
    case 0:
      userDefinedFunction = `Math.random() * 2 - 1`;
      break;
    case 1:
      userDefinedFunction = `Math.sin(i) * 2 + 1`;
      break;
    default:
      userDefinedFunction = `Math.sin(Math.sin(i))`;
  }

  return `
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
          const func = ${userDefinedFunction};
          const gain = parameters.gain[i];
          speakers[0][i] = func * gain;
          speakers[1][i] = func * gain;
        }

        return true;
      }
    }`;
}

// Create and register processor node CODE for injecting in a Worklet, according to pattern.
// Processor name `CustomProcessor` is hardcoded, such as the Custom processor code
function createAndRegisterCustomProcessorCode(userCode, processorName) {

  return `${userCode}

  registerProcessor("${processorName}", CustomProcessor);`;
}

// After Creation and register the CustomProcessor CODE with injected function,
// set CODE in a newly created file and associate it with a CustomNode in the audio context
function runEditorCode(editor) {

  console.log('processorCount: ' + processorCount);
  // const userCode = editor.getDoc().getValue();
  const processorName = `processor-${processorCount++}`;

  const code = createAndRegisterCustomProcessorCode(customUserCode(processorCount), processorName);

  const blob = new Blob([code], { type: "application/javascript" });

  const workletUrl = window.URL.createObjectURL(blob);

  runAudioWorklet(workletUrl, processorName);
}


function runAudioWorklet(workletUrl, processorName) {

  maxiEngine();

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

    createEditor1();

    createEditor2();

    createControls();

    // maxiEngine();


});
