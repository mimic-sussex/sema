// import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import * as nearley from 'nearley/lib/nearley.js';
// import * as grammar from './language/eppGrammar.js';
import * as grammar from './language/eppprocessor.js';

import IRToJavascript from './IR/IR.js'

import testWorker from 'worker-loader!./test.worker.js';
import irWorker from 'worker-loader!./IR/IR.worker.js';



import {
  AudioEngine
} from './audioEngine/audioEngine.js';

// import treeJSON from './dndTree';
import AudioWorkletIndicator from './UI/components';


import '../assets/samples/909.wav';
import '../assets/samples/909b.wav';
import '../assets/samples/909closed.wav';
import '../assets/samples/909open.wav';

import './style/index.css';
import './style/tree.css';
import './style/editors.css';

import * as CodeMirror from 'codemirror/lib/codemirror.js';
import 'codemirror/mode/javascript/javascript.js';
// import 'codemirror/theme/ambiance.css';
import 'codemirror/theme/monokai.css';
// import 'codemirror/theme/abcdef.css';
import 'codemirror/keymap/vim.js';
import 'codemirror/lib/codemirror.css';

import langSketch from './language/langSketch';

let audio;

let editor1, editor2;

let parser;

let irw = new irWorker();
irw.onmessage = (e) => {
  console.log("rcv");
  window.AudioEngine.evalSynth(e.data);
}

// Default editor code example is stored at 'langSketch.js'
const defaultEditorCode1 = langSketch;

function createEditor1() {

  editor1 = CodeMirror(document.getElementById('editor1'), {
    value: defaultEditorCode1,
    // theme: "abcdef",
    theme: "monokai",
    lineNumbers: true,
    // mode:  "javascript",
    lineWrapping: true,
    extraKeys: {
      // [ "Cmd-Enter" ]: () => playAudio(),
      ["Cmd-Enter"]: () => evalEditorExpression(),
      ["Cmd-."]: () => stopAudio(),
      ["Cmd--"]: () => decreaseVolume(),
      ["Cmd-="]: () => increaseVolume(),
      ["Cmd-]"]: () => changeSynth()
    }
  });
  editor1.setSize('100%', '100%');
  editor1.setOption("vimMode", false);
}

const defaultEditorCode2 = "∞(∆, 1.0, 1.5).∞(~, 1.0. 1.04).∞(∞(∞, 440, 1.04)+∞(≈, 66, 1.30))";

function createEditor2() {

  editor2 = CodeMirror(document.getElementById('editor2'), {
    value: defaultEditorCode2,
    lineNumbers: true,
    theme: "ambiance",
    lineWrapping: true
  });
  editor2.setSize('100%', '100%');
}

function createControls() {

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

function evalEditorExpression() {


  // TODO: for now sample loading is here,
  // but we want to
  if (!window.AudioEngine.samplesLoaded)
    window.AudioEngine.loadSamples();

  let expression = editor1.getSelection();
  if (expression == "") {
    let cursorInfo = editor1.getCursor();
    expression = editor1.getDoc().getLine(cursorInfo.line);
  }
  console.log(`User expression to eval: ${expression}`);
  let ASTree;
  try {
    ASTree = parseEditorInput(expression)
    console.log(`Parse tree: ${ASTree}`);
    console.log(JSON.stringify(ASTree));
    // let jscode = IRToJavascript.treeToCode(ASTree);
    // console.log(jscode);
    irw.postMessage(JSON.stringify(ASTree));
    // window.AudioEngine.evalSynth(jscode);
  } catch (error) {
    console.log(`Error parsing the tree: ${error}`);
  }




}


function playAudio() {
  if (window.AudioEngine !== undefined) {
    window.AudioEngine.play();
  }
}

function stopAudio() {
  if (window.AudioEngine !== undefined)
    window.AudioEngine.stop();
}

function increaseVolume() {
  if (window.AudioEngine !== undefined)
    window.AudioEngine.more('gainSyn');
}

function decreaseVolume() {
  if (window.AudioEngine !== undefined)
    window.AudioEngine.less('gainSyn');
}

function changeSynth() {
  if (window.AudioEngine !== undefined)
    window.AudioEngine.changeSynth();
}

function createAnalysers() {

}

var parserStartPoint;
function setParser() {
  let processor = nearley.Grammar.fromCompiled(grammar);
  parser = new nearley.Parser(processor);
  parserStartPoint = parser.save();
  console.log('Nearley parser loaded')
}



function parseEditorInput(input) {
  if (input !== undefined && parser !== undefined) {
    parser.restore(parserStartPoint);
    parser.feed(input);
    return parser.results;
  }
}



document.addEventListener("DOMContentLoaded", () => {

  document.getElementById('audioWorkletIndicator').innerHTML = AudioWorkletIndicator.AudioWorkletIndicator();

  window.AudioEngine = new AudioEngine();

  document.getElementById("sampleRateIndicatorValue").textContent = window.AudioEngine.sampleRate;
  document.getElementById("dspLoadVal").textContent = "0";
  window.AudioEngine.onNewDSPLoadValue = (x) => {document.getElementById("dspLoadVal").textContent = `${Math.floor(x)}`;};

  setParser();

  createEditor1();

  // createEditor2();

  createAnalysers();

  createControls();


});
