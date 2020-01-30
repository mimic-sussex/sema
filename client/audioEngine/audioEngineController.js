
import { AudioEngine } from "./audioEngine.js";
import { loadImportedSamples } from "./sampleLoader.js";
// import { PubSub } from "../messaging/pubSub.js";
import { kuramotoNetClock } from "../interfaces/clockInterface.js";

let kuraClock;
let subscriptionToken;


const testSubscriber1 = (data) => {
  console.log("DEBUG:AudioEngine:Controller:testSubscriber1:");
  console.log(data);
};



let createAudioEngine = () => {

  window.AudioEngine = new AudioEngine();

  const subscriptionToken = window.messaging.subscribe("evalDSP", evalDSP);

	// const testSubscription1 = window.messaging.subscribe("evalDSP", testSubscriber1);


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
    console.log("DEBUG:AudioEngineController:eval:");
    console.log(dspFunction);
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
