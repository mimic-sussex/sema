import { AudioEngine } from "./audioEngine.js";
import { loadImportedSamples } from "./sampleLoader.js";

let createAudioEngine = () => {
	window.AudioEngine = new AudioEngine();
};

async function setupAudio() {
	if (window.AudioEngine !== undefined) {
		await window.AudioEngine.init(); // Start AudioContext and connect WAAPI graph elements, asynchronously
    loadImportedSamples();
	}
}

function playAudio() {
	if (window.AudioEngine !== undefined) {
		window.AudioEngine.play();
	}
}

function stopAudio() {
	if (window.AudioEngine !== undefined) {
    window.AudioEngine.stop();
  }
}

function evalDSP(dspFunction) {
	if (window.AudioEngine !== undefined) {
		window.AudioEngine.evalDSP(dspFunction);
	}
}

export { createAudioEngine, setupAudio, playAudio, stopAudio, evalDSP };

