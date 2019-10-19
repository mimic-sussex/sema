// import * as grammar from './language/eppGrammar.js';
// import * as nearley from 'nearley/lib/nearley.js';
// import * as grammar from './language/eppprocessor.js';
// import IRToJavascript from './IR/IR.js'

// import irWorker from 'worker-loader!./IR/IR.worker.js';
import parserWorker from "worker-loader!./compiler/parser.worker.js";
import tfWorker from "worker-loader!./machineLearning/tfjs.worker.js";

import oscIO from "./input/oscInterface.js";
import fileSaver from "filesaver/src/Filesaver.js";

import { AudioEngine } from "./audioEngine/audioEngine.js";

import hello_world_code_example from "./machineLearning/tfjs/hello-world/hello-world.tf";
import two_layer_non_linear_code_example from "./machineLearning/tfjs/non-linear/two-layer-non-linear.tf";
import binary_classification_code_example from "./machineLearning/tfjs/non-linear/binary-classification.tf";
import echo_state_network_code_example from "./machineLearning/tfjs/echo-state/echo-state-network.tf";
import lstm_txt_gen_code_example from "./machineLearning/tfjs/rnn/lstm-txt-gen.tf";
import music_rnn_example from "./machineLearning/magenta/music-rnn.tf";

import { myo } from "./input/myo.js";
import { leapMotion } from "./input/leapMotion.js";

import sema_png from "../assets/img/sema.png";

import AudioWorkletIndicator from "./UI/components";
// import treeJSON from './dndTree';

import "./style/index.css";
import "./style/tree.css";
import "./style/editors.css";

import * as CodeMirror from "codemirror/lib/codemirror.js";
import "codemirror/mode/javascript/javascript";
import "codemirror/mode/ebnf/ebnf";
import "codemirror/theme/idea.css";
import "codemirror/theme/monokai.css";
import "codemirror/theme/oceanic-next.css";
import "codemirror/addon/edit/matchbrackets.js";
import "codemirror/keymap/vim.js";
import "codemirror/lib/codemirror.css";

import NexusUI from "nexusui/dist/NexusUI.js";

// import langSketch from "./language/langSketch";
import { createSecretKey } from "crypto";
import { visible, hidden } from "ansi-colors";

let audio;

let editor1, editor2, editor3;
let oscilloscope, spectrogram;

let selectedTab = 0;

let compileTS = 0;
let treeTS = 0;
let evalTS = 0;

var saveData = (function() {
	var a = document.createElement("a");
	document.body.appendChild(a);
	a.style = "display: none";
	return function(blob, fileName) {
		var url = window.URL.createObjectURL(blob);
		a.href = url;
		a.download = fileName;
		a.click();
		window.URL.revokeObjectURL(url);
	};
})();

let machineLearningWorker = new tfWorker();
machineLearningWorker.onmessage = e => {
	// console.log("DEBUG:machineLearningWorker:onMsg ");
	// console.log(e.data);
	if (e.data.func) {
		let responders = {
			data: data => {
				window.AudioEngine.postMessage(data);
			},
			save: data => {
				console.log("save");
				window.localStorage.setItem(data.name, data.val);
			},
			load: data => {
				console.log("load");
				let msg = {
					name: data.name,
					val: window.localStorage.getItem(data.name)
				};
				machineLearningWorker.postMessage(msg);
			},
			download: data => {
				console.log("download");
				let downloadData = window.localStorage.getItem(data.name);
				let blob = new Blob([downloadData], {
					type: "text/plain;charset=utf-8"
				});
				saveData(blob, `${data.name}.data`);
			},
			sendcode: data => {
				console.log(data);
			}
		};
		responders[e.data.func](e.data);
	}
};

let languageWorker = new parserWorker();
languageWorker.onmessage = e => {
	console.log("DEBUG:languageWorker:onMsg " + e.data);
	if (e.data["loop"]) {
		let rightNow = window.performance.now();
		evalTS = rightNow;
		testResult[3] = rightNow - treeTS;
		window.AudioEngine.evalSynth(e.data);

		//*** temp disable editor update while sorting out blocks

		//update editor
		// let pms = JSON.parse(e.data.paramMarkers);
		// let cursorInfo = editor1.getCursor();
		// for (let v in pms) {
		//   let fontStyle = 300 - ((pms[v].l) * 50);
		//   editor1.markText({line:cursorInfo.line, ch:pms[v].s.offset}, {line:cursorInfo.line, ch:pms[v].s.offset+1},{"className":`param${fontStyle}`});
		//   editor1.markText({line:cursorInfo.line, ch:pms[v].e.offset}, {line:cursorInfo.line, ch:pms[v].e.offset+1},{"className":`param${fontStyle}`});
		// }
		// console.log(`IR translate time: ${compileTS} ms`)
		// console.log("rcv");
	} else if (e.data["treeTS"]) {
		// TODO:FB Decouple tests from main
		let rightNow = window.performance.now();
		testResult[2] = rightNow - compileTS;
		treeTS = rightNow;
		// console.log(`nearley parse time: ${treeTS - compileTS}`);
	}
};

// Default editor code example is stored at 'langSketch.js'
// const defaultEditorCode1 = "langSketch";

function initMainCodeEditor() {
	// let defaultEditorCode1 = "//livecode window";
	let defaultEditorCode1 = "";
	let editor1code = window.localStorage.getItem("editor1");
	if (editor1code) defaultEditorCode1 = editor1code;

  if (editor1 instanceof CodeMirror) {
		editor1.refresh();
	} 
	else {
		editor1 = CodeMirror(document.getElementById("editor1"), {
			value: defaultEditorCode1,
			theme: "monokai",
			lineNumbers: true,
			lineWrapping: true,
			matchBrackets: true,
			extraKeys: {
				// [ "Cmd-Enter" ]: () => playAudio(),
				["Cmd-Enter"]: () => evalLiveCodeEditorExpression(),
				["Ctrl-Enter"]: () => evalLiveCodeEditorExpression(),
				["Shift-Enter"]: () => evalLiveCodeEditorExpression(),
				["Cmd-."]: () => stopAudio()
				// ["Cmd--"]: () => decreaseVolume(),
				// ["Cmd-="]: () => increaseVolume(),
				// ["Cmd-]"]: () => changeSynth()
			}
		});
		editor1.setSize("100%", "100%");
		editor1.setOption("vimMode", false);
	}
}

function initJavascriptEditor() { 

	let defaultEditorCode2 = "//JS";
	let editor2code = window.localStorage.getItem("javascript");
	if (editor2code) defaultEditorCode2 = editor2code;

  if (editor2 instanceof CodeMirror) {
		editor2.refresh();
	} 
	else {
		editor2 = CodeMirror(document.getElementById("editor2"), {
			value: defaultEditorCode2,
			lineNumbers: true,
			mode: "javascript",
			theme: "idea",
			lineWrapping: true,
			extraKeys: {
				["Cmd-Enter"]: () => evalModelEditorExpressionBlock(),
				["Shift-Enter"]: () => evalModelEditorExpression(),
				["Ctrl-Enter"]: () => evalModelEditorExpressionBlock()
			}
		});
		editor2.setSize("100%", "100%");
		// document.getElementById("editor2").style.visibility = "block";
	}
	
}

function initGrammarEditor() {
	let defaultEditorCode3 = "//EBNF grammar";
	let editor3code = window.localStorage.getItem("grammar");
	if (editor3code) defaultEditorCode3 = editor3code;

  if (editor3 instanceof CodeMirror) {
		editor3.refresh();
	}
	else{
				editor3 = CodeMirror(document.getElementById("editor3"), {
					value: defaultEditorCode3,
					lineNumbers: true,
					mode: "ebnf",
					theme: "oceanic-next",
					lineWrapping: true,
					extraKeys: {
						// ["Cmd-Enter"]: () => evalEditor3Expression(),
						// ["Ctrl-Enter"]: () => evalEditor3Expression(),
						["Shift-Enter"]: () => evalEditor3ExpressionBlock()
					}
				});
				editor3.setSize("100%", "100%");
				// document.getElementById("editor3").style.visibility = "block";
			}
	
}

function initSecondaryEditors() {
	initGrammarEditor();
	initJavascriptEditor();
}

function switchSecondaryEditor(evt, editorName) {

	var i, tablinks;
	
	tablinks = document.getElementsByClassName("tablinks");
	for (i = 0; i < tablinks.length; i++) {
		tablinks[i].className = tablinks[i].className.replace(" active", "");
	}
	evt.currentTarget.className += " active";
	
	if (editorName === "Grammar") {
		window.localStorage.setItem("javascript", editor2.getValue());
		document.getElementById("editor2").style.display = "none";
		document.getElementById("editor3").style.display = "block";
		initGrammarEditor();
	} else {
		window.localStorage.setItem("grammar", editor3.getValue());
		document.getElementById("editor2").style.display = "block";
		document.getElementById("editor3").style.display = "none";
		initJavascriptEditor();
	}
}

function createControls() {

	// document.getElementById('audioWorkletIndicator').innerHTML = AudioWorkletIndicator.AudioWorkletIndicator();

	document.getElementById("semaLogo").src = sema_png;

	const isMac = CodeMirror.keyMap.default === CodeMirror.keyMap.macDefault;
	const runKeys = isMac ? "Cmd-Enter" : "Ctrl-Enter";
	const container = document.getElementById("containerButtons");

	const startAudioButton = document.getElementById("buttonStartAudio");
	startAudioButton.addEventListener("click", () => start());

	const runButton = document.createElement("button");
	runButton.textContent = `Play: ${runKeys.replace("-", " ")}`;

	const stopKeys = isMac ? "Cmd-." : "Ctrl-.";
	const stopButton = document.createElement("button");
	stopButton.textContent = `Stop: ${stopKeys.replace("-", " ")}`;

	container.appendChild(runButton);
	runButton.addEventListener("click", () => playAudio(editor1));

	container.appendChild(stopButton);
	stopButton.addEventListener("click", () => stopAudio());

	const downloadButton = document.createElement("button");
	downloadButton.textContent = `Download JS Code`;
	container.appendChild(downloadButton);
	downloadButton.addEventListener("click", () => {
		let downloadData = window.localStorage.getItem("editor2");
		let blob = new Blob([downloadData], { type: "text/plain;charset=utf-8" });
		saveData(blob, `semaCode.js`);
	});

	const downloadButtonLC = document.createElement("button");
	downloadButtonLC.textContent = `Download Live Code`;
	container.appendChild(downloadButtonLC);
	downloadButtonLC.addEventListener("click", () => {
		let downloadData = window.localStorage.getItem("editor1");
		let blob = new Blob([downloadData], { type: "text/plain;charset=utf-8" });
		saveData(blob, `liveCode.sema`);
	});

	createModelSelector();

	createTabs();


}


function createModelSelector() {
	const container = document.getElementById("containerButtons");
	const modelSelect = document.createElement("SELECT");

	const injectModelExampleInModelEditor = e => {
		// console.log("DEBUG:Main:injectModelExampleInModelEditor: " +e );
		switch (e) {
			case "hello-world":
				editor2.setValue(hello_world_code_example);
				break;
			case "two-layer-non-linear":
				editor2.setValue(two_layer_non_linear_code_example);
				break;
			case "binary-classification":
				editor2.setValue(binary_classification_code_example);
				break;
			case "echo-state-network":
				editor2.setValue(echo_state_network_code_example);
				break;
			case "lstm-txt-generator":
				editor2.setValue(lstm_txt_gen_code_example);
				break;
			case "music-rnn":
				editor2.setValue(music_rnn_example);
				break;
			default:
				editor2.setValue("// js - select a model from the dropdown");
				break;
		}
	};

	modelSelect.addEventListener("change", () => {
		injectModelExampleInModelEditor(modelSelect.value);
	});

	const createModelSelectOptions = (optionTextEntry, selectElement) => {
		let option = document.createElement("option");
		option.text = optionTextEntry;
		selectElement.add(option);
	};

	createModelSelectOptions("Open model example:", modelSelect);
	createModelSelectOptions("hello-world", modelSelect);
	createModelSelectOptions("two-layer-non-linear", modelSelect);
	createModelSelectOptions("binary-classification", modelSelect);
	createModelSelectOptions("lstm-txt-generator", modelSelect);
	createModelSelectOptions("echo-state-network", modelSelect);
	createModelSelectOptions("music-rnn", modelSelect);

	container.appendChild(modelSelect);
}

function createTabs(){

	const tab = document.getElementById("tab");

	const javascriptTabButton = document.createElement("button");
	javascriptTabButton.id = `Javascript`;
	javascriptTabButton.className = `tablinks active`;
	javascriptTabButton.textContent = `Javascript`;
	javascriptTabButton.addEventListener("click", event =>
		switchSecondaryEditor(event, javascriptTabButton.id)
	);
	tab.appendChild(javascriptTabButton);

	const grammarTabButton = document.createElement("button");
	grammarTabButton.id = `Grammar`;
	grammarTabButton.className = `tablinks`;
	grammarTabButton.textContent = `Grammar`;
	grammarTabButton.addEventListener("click", event =>
		switchSecondaryEditor(event, grammarTabButton.id)
	);
	tab.appendChild(grammarTabButton);
}

function createNexusUI() {

  // window.AudioEngine.initWithAudioContext(NexusUI.context);	
	let analysers = document.getElementsByClassName("panel-analysers");
	
	NexusUI.context = window.AudioEngine.audioContext; 
	oscilloscope = new NexusUI.Oscilloscope("oscilloscope", {
		// size: default
	});
	oscilloscope.colorize("fill", "#000");
	oscilloscope.colorize("accent", "#FFF");
	// window.AudioEngine.addAnalyser(oscilloscope); // Inject oscilloscope analyser, keep encapsulation for worklet node
	oscilloscope.connect(window.AudioEngine.audioWorkletNode);

	spectrogram = new NexusUI.Spectrogram("spectrogram", {
		// size: [100, 50]
	});
	spectrogram.colorize("fill", "#000");
	spectrogram.colorize("accent", "#FFF");
	// window.AudioEngine.addAnalyser(spectrogram); // Inject oscilloscope analyser, keep encapsulation for worklet node
	spectrogram.connect(window.AudioEngine.audioWorkletNode);

	window.addEventListener("resize", function(event) {
		oscilloscope.resize(100, 120);
		spectrogram.resize(100, 150);
		console.log(analysers);
	});

	// window.AudioEngine.connectAnalysers();
}




function connectMyo() {
	let myoInterface = new myo();
}

function connectLeap() {
	let leapInterface = new leapMotion();
}

function evalExpression(expression) {
	compileTS = window.performance.now();
	languageWorker.postMessage(expression);
}

function getBlock(editor) {
	//find code between dividers
	// const divider = "__________";
	let cursorInfo = editor.getCursor();
	//find post divider
	let line = cursorInfo.line;
	let linePost = editor.lastLine();
	while (line < linePost) {
		// console.log(editor2.getLine(line));
		if (/___+/.test(editor.getLine(line))) {
			//at least 3 underscores
			linePost = line - 1;
			break;
		}
		line++;
	}
	line = cursorInfo.line;
	let linePre = -1;
	while (line >= 0) {
		// console.log(editor2.getLine(line));
		if (/___+/.test(editor.getLine(line))) {
			linePre = line;
			break;
		}
		line--;
	}
	if (linePre > -1) {
		linePre++;
	}
	let code = editor.getRange(
		{
			line: linePre,
			ch: 0
		},
		{
			line: linePost + 1,
			ch: 0
		}
	);

	return code;
}

function evalLiveCodeEditorExpression() {
	let expression = getBlock(editor1);

	// let expression = editor1.getSelection();
	// let cursorInfo = editor1.getCursor();
	// if (expression == "") {
	//   // console.log(cursorInfo);
	//   expression = editor1.getDoc().getLine(cursorInfo.line);
	// }
	console.log(`DEBUG:Main:evalLiveEditorExpression: ${expression}`);
	try {
		evalExpression(expression);
	} catch (error) {
		console.log(`Error parsing the tree: ${error}`);
	}
	window.localStorage.setItem("editor1", editor1.getValue());
	// editor1.markText({line:cursorInfo.line, ch:0}, {line:cursorInfo.line, ch:1},{"className":"test"});
}

function evalModelEditorExpression() {
	let expression = editor2.getSelection();
	if (expression == "") {
		let cursorInfo = editor2.getCursor();
		expression = editor2.getDoc().getLine(cursorInfo.line);
	}
	console.log(`DEBUG:Main:evalModelEditorExpression: ${expression}`);
	machineLearningWorker.postMessage({
		eval: expression
	});
	window.localStorage.setItem("editor2", editor2.getValue());
}

function evalModelEditorExpressionBlock() {
	// console.log("DEBUG:Main:evalModelEditorExpressionBlock: " + code);
	let code = getBlock(editor2);
	machineLearningWorker.postMessage({
		eval: code
	});
	window.localStorage.setItem("editor2", editor2.getValue());
}

async function start() {
	let overlay = document.getElementById("overlay");
	overlay.style.visibility = "hidden";

	await setupAudio();
	// Create Osciloscope and spectrogram
	createNexusUI();
}


/*
 *
  Audio engine wrappers
 *
 */
async function setupAudio() {
	if (window.AudioEngine !== undefined) {
		// Start Audio Context and connect WAAPI graph elements
		await window.AudioEngine.init();

	}
}

function playAudio() {
	if (window.AudioEngine !== undefined) {
		window.AudioEngine.play();

		// createNexusUI();
	}
}

function stopAudio() {
	if (window.AudioEngine !== undefined) 
		window.AudioEngine.stop();
}

/*
 *
  Dynamic sample loading
 *
 */
const getSamplesNames = () => {
	const r = require.context("../assets/samples", false, /\.wav$/);

	// return an array list of filenames (with extension)
	const importAll = r => r.keys().map(file => file.match(/[^\/]+$/)[0]);

	return importAll(r);
};

/* 
 * Webpack Magic Comments 
    webpackMode: "lazy" // Generates a single lazy-loadable chunk that can satisfy all calls to import(). 
    (default): Generates a lazy-loadable chunk for each import()ed module.
 *
 * webpackMode: "lazy-once" 
 */
const lazyLoadSample = (sampleName, sample) => {
	import(
		/* webpackMode: "lazy" */
		`../assets/samples/${sampleName}`
	)
		.then(sample =>
			window.AudioEngine.loadSample(sampleName, `samples/${sampleName}`)
		)
		.catch(err => console.error(`ERROR:Main:lazyLoadImage: ` + err));
};

const loadImportedSamples = () => {
	let samplesNames = getSamplesNames();
	// console.log("DEBUG:Main:getSamplesNames: " + samplesNames);
	samplesNames.forEach(sampleName => {
		lazyLoadSample(sampleName);
	});
};

/*
 *
  Application Entry Point – DOMContentLoaded
 *
 */
document.addEventListener("DOMContentLoaded", () => {

  // NOTE:FB 
	// Injecting a function in the ctor of the audio engine that is defined in this context and that posts
	// messages to the ML worker makes this code extremely convoluted and hard to reason about. 
	// Please don't change code that was good, just for a hack sake.
	window.AudioEngine = new AudioEngine(msg => {
		if (msg == "giveMeSomeSamples") {
			// Load Samples
			if (!window.AudioEngine.samplesLoaded) loadImportedSamples();
		} else {
			machineLearningWorker.postMessage(msg);
		}
	});



	// // document.getElementById("sampleRateIndicatorValue").textContent = window.AudioEngine.sampleRate;
	// // document.getElementById("dspLoadVal").textContent = "0";
	// window.AudioEngine.onNewDSPLoadValue = (x) => {
	//   document.getElementById("dspLoadVal").textContent = `${Math.floor(x)}`;
	// };
	window.AudioEngine.onEvalTimestamp = x => {
		let evalTime = x - evalTS;
		// console.log(`Eval time: ${evalTime} ms`)
		testResult[4] = evalTime;
		testResults.push(testResult.slice());
		if (testResults.length % 50 == 0)
			console.log("Test complete: " + testResults.length);
		// console.log(testResults)
		setTimeout(loadTest, 200);
	};

	// setParser();

	initMainCodeEditor();

	initSecondaryEditors();

	createControls();

	oscIO.OSCResponder(msg => {
		// console.log("OSC in:", msg);
		window.AudioEngine.oscMessage(msg);
	});
});

var testActive = false;
var testTS = 0;

/*
 *
  Performance tests
 *
 */

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
		console.log("Test time: " + testTS);
	}
}

function genTestCode(objs, depths) {
	function randFreq() {
		return 100 + Math.floor(Math.random() * 1000);
	}

	function genParam() {
		let val = "";
		if (Math.random() < Math.max(0, 0.5 - depths / 20)) {
			// if (Math.random() < 0.5 - (depths / 100)) {
			let moreCode = genTestCode(0, depths + 1);
			val = `(${moreCode[0]})`;
			if (moreCode[2] > depths) {
				depths = moreCode[2];
			}
			objs += moreCode[1];
		} else {
			val = randFreq();
		}

		return val;
	}
	// let nOscs = Math.floor(Math.random() * 5) + 1
	let nOscs = Math.floor(Math.pow(Math.random(), 2.2) * 30) + 1;
	let code = "";
	for (let i = 0; i < nOscs; i++) {
		objs++;
		code += (i > 0 ? " + " : "") + "osc sin " + genParam();
	}
	return [code, objs, depths];
}
var testResult = [0, 0, 0, 0, 0];
var testResults = [];

function loadTest() {
	if (testActive) {
		let test = genTestCode(0, 0);
		evalExpression(test[0]);
		testResult[0] = test[1];
		testResult[1] = test[2];
		// console.log(test[1]);
	}
}
