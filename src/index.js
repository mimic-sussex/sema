// import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
// import * as grammar from './language/eppGrammar.js';
// import * as nearley from 'nearley/lib/nearley.js';
// import * as grammar from './language/eppprocessor.js';
// import IRToJavascript from './IR/IR.js'

// import irWorker from 'worker-loader!./IR/IR.worker.js';
import nearleyWorker from 'worker-loader!./language/nearley.worker.js';
import tfWorker from 'worker-loader!./machineLearning/tfjs.worker.js';
import oscIO from './interfaces/oscInterface.js';


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
import 'codemirror/mode/javascript/javascript';
import 'codemirror/theme/idea.css';
import 'codemirror/theme/monokai.css';
// import 'codemirror/theme/abcdef.css';
import 'codemirror/keymap/vim.js';
import 'codemirror/lib/codemirror.css';

import langSketch from './language/langSketch';

let audio;

let editor1, editor2;

let parser;

let compileTS = 0;
let treeTS = 0;
let evalTS = 0;

let tfW = new tfWorker();
tfW.onmessage = (e) => {
  window.AudioEngine.postMessage(e.data);
}

let langWorker = new nearleyWorker();
langWorker.onmessage = (e) => {
  // console.log(e.data);
  if (e.data['loop']) {
    let rightNow = window.performance.now();
    evalTS = rightNow;
    testResult[3] = rightNow - treeTS
    window.AudioEngine.evalSynth(e.data);
    // console.log(`IR translate time: ${compileTS} ms`)
    // console.log("rcv");
  } else if (e.data['treeTS']) {
    let rightNow = window.performance.now();
    testResult[2] = rightNow - compileTS;
    treeTS = rightNow;
    // console.log(`nearley parse time: ${treeTS - compileTS}`);
  }
}

// Default editor code example is stored at 'langSketch.js'
// const defaultEditorCode1 = "langSketch";

function createEditor1() {
  let defaultEditorCode1 = "//livecode window";
  let editor1code = window.localStorage.getItem("editor1");
  if (editor1code)
    defaultEditorCode1 = editor1code;

  editor1 = CodeMirror(document.getElementById('editor1'), {
    // theme: "abcdef",
    value:defaultEditorCode1,
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


function createEditor2() {
  let defaultEditorCode2 = "//js";
  let editor2code = window.localStorage.getItem("editor2");
  if (editor2code)
    defaultEditorCode2 = editor2code;

  editor2 = CodeMirror(document.getElementById('editor2'), {
    value: defaultEditorCode2,
    lineNumbers: true,
    mode: "javascript",
    theme: "idea",
    lineWrapping: true,
    extraKeys: {
      ["Cmd-Enter"]: () => evalEditor2Expression(),
      ["Shift-Enter"]: () => evalEditor2ExpressionBlock(),
    }

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

  const testButton = document.createElement("button");
  testButton.textContent = `Test`;
  container.appendChild(testButton);
  testButton.addEventListener("click", () => runTest());

}

function evalExpression(expression) {
  compileTS = window.performance.now();
  langWorker.postMessage(expression);

}

function evalEditorExpression() {

  // TODO: for now sample loading is here,
  // but we want to
  if (!window.AudioEngine.samplesLoaded)
    window.AudioEngine.loadSamples();

  let expression = editor1.getSelection();
  let cursorInfo = editor1.getCursor();
  if (expression == "") {
    console.log(cursorInfo);
    expression = editor1.getDoc().getLine(cursorInfo.line);
  }
  console.log(`User expression to eval: ${expression}`);
  try {
    evalExpression(expression);
  } catch (error) {
    console.log(`Error parsing the tree: ${error}`);
  }
  window.localStorage.setItem("editor1", editor1.getValue());
  // editor1.markText({line:cursorInfo.line, ch:0}, {line:cursorInfo.line, ch:1},{"className":"test"});
}

function evalEditor2Expression() {

  let expression = editor2.getSelection();
  if (expression == "") {
    let cursorInfo = editor2.getCursor();
    expression = editor2.getDoc().getLine(cursorInfo.line);
  }
  console.log(`User expression to eval: ${expression}`);
  tfW.postMessage({"eval":expression});
  window.localStorage.setItem("editor2", editor2.getValue());
}

function evalEditor2ExpressionBlock() {
  //find code between dividers
  let divider = "__________";
  let cursorInfo = editor2.getCursor();
  //find post divider
  let line = cursorInfo.line;
  let linePost = editor2.lastLine();
  while (line < linePost) {
    // console.log(editor2.getLine(line));
    if (editor2.getLine(line) == divider) {
      linePost = line-1;
      break;
    }
    line++;
  };
  line = cursorInfo.line;
  let linePre = -1;
  while (line >= 0) {
    // console.log(editor2.getLine(line));
    if (editor2.getLine(line) == divider) {
      linePre = line;
      break;
    }
    line--;
  };
  if (linePre > -1) {
    linePre++;
  }
  let code = editor2.getRange({line:linePre,ch:0}, {line:linePost+1,ch:0});
  console.log(code);
  tfW.postMessage({"eval":code});
  window.localStorage.setItem("editor2", editor2.getValue());
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


document.addEventListener("DOMContentLoaded", () => {

  // document.getElementById('audioWorkletIndicator').innerHTML = AudioWorkletIndicator.AudioWorkletIndicator();

  window.AudioEngine = new AudioEngine((msg) => {
    tfW.postMessage(msg);
  });

  // // document.getElementById("sampleRateIndicatorValue").textContent = window.AudioEngine.sampleRate;
  // // document.getElementById("dspLoadVal").textContent = "0";
  // window.AudioEngine.onNewDSPLoadValue = (x) => {
  //   document.getElementById("dspLoadVal").textContent = `${Math.floor(x)}`;
  // };
  window.AudioEngine.onEvalTimestamp = (x) => {
    let evalTime = x - evalTS;
    // console.log(`Eval time: ${evalTime} ms`)
    testResult[4] = evalTime;
    testResults.push(testResult.slice());
    if (testResults.length % 50 == 0)
      console.log("Test complete: " + testResults.length)
    // console.log(testResults)
    setTimeout(loadTest, 200);
  }

  // setParser();

  createEditor1();

  createEditor2();

  createAnalysers();

  createControls();

  oscIO.OSCResponder((msg) => {
    console.log("OSC in:", msg);
    window.AudioEngine.oscMessage(msg);
  });


});

var testActive = false;
var testTS = 0;

function runTest() {
  if (!testActive) {
    testActive = true;

    console.log("Testing");
    testTS = window.performance.now();
    loadTest();
  } else {
    testActive = false;
    testTS = window.performance.now() - testTS;
    console.log("Testing ended");
    console.log(testResults);
    console.log("Test time: " + (testTS))

  }
}

function genTestCode(objs, depths) {
  function randFreq() {
    return 100 + Math.floor(Math.random() * 1000)
  }

  function genParam() {
    let val = "";
    if (Math.random() < Math.max(0, 0.5 - (depths / 20))) {
      // if (Math.random() < 0.5 - (depths / 100)) {
      let moreCode = genTestCode(0, depths + 1)
      val = `(${moreCode[0]})`;
      if (moreCode[2] > depths) {
        depths = moreCode[2];
      }
      objs += moreCode[1]
    } else {
      val = randFreq()
    }

    return val;
  }
  // let nOscs = Math.floor(Math.random() * 5) + 1
  let nOscs = Math.floor(Math.pow(Math.random(), 2.2) * 30) + 1;
  let code = "";
  for (let i = 0; i < nOscs; i++) {
    objs++;
    code += (i > 0 ? " + " : "") + "osc sin " + genParam()
  }
  return [code, objs, depths];
}
var testResult = [0, 0, 0, 0, 0]
var testResults = []

function loadTest() {
  if (testActive) {
    let test = genTestCode(0, 0)
    evalExpression(test[0])
    testResult[0] = test[1]
    testResult[1] = test[2]
    // console.log(test[1]);
  }

}
