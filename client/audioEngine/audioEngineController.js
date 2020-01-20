
import { AudioEngine } from "./audioEngine.js";
import { loadImportedSamples } from "./sampleLoader.js";
import { kuramotoNetClock } from "../interfaces/clockInterface.js";

import { 
   
} from "../store.js";

let kuraClock;

let createAudioEngine = () => {
  window.AudioEngine = new AudioEngine();

  kuraClock = new kuramotoNetClock((phase, idx) => {
    // console.log("phase: " + phase + ", " + idx);
    if (window.AudioEngine !== undefined) {
      window.AudioEngine.sendClockPhase(phase, idx);
    }
  });

  window.AudioEngine.sendPeersMyClockPhase = (e) => {
    if (e != undefined) {
      kuraClock.broadcastPhase(e);
      // console.log("DEBUG:AudioEngineController:sendPeersMyClockPhase:");
      // console.log(e);
    }
  };

};


async function initAudio(numPeers) {
  await window.AudioEngine.init(numPeers); // Start AudioContext and connect WAAPI graph elements, asynchronously
  loadImportedSamples();
}

async function setupAudio() {
  if (window.AudioEngine !== undefined) {
    if (kuraClock.connected()) {
      kuraClock.queryPeers(async (numPeers) => {
        console.log("Clock Peers: " + numPeers)
        initAudio(numPeers);
      });
    } else {
      initAudio(1);
    }
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

function sendClockPhase(phase, idx) {
  if (window.AudioEngine !== undefined) {
    window.AudioEngine.sendClockPhase(phase, idx);
  }
}


export {
  createAudioEngine,
  setupAudio,
  playAudio,
  stopAudio,
  evalDSP
};
