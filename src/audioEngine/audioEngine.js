// import Module from './maximilian.wasmmodule.js';

import CustomProcessor from './maxi-processor'
import {
  loadSampleToArray
} from './maximilian.util';
/**
 * The CustomAudioNode is a class that extends AudioWorkletNode
 * to hold an Custom Audio Worklet Processor and connect to Web Audio graph
 * @class CustomAudioNode
 * @extends AudioWorkletNode
 */
class MaxiNode extends AudioWorkletNode {
  constructor(audioContext, processorName) {
    // super(audioContext, processorName);
    let options = {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2]
    };
    super(audioContext, processorName, options);
  }
}

/**
 * The AudioEngine is a singleton class that encapsulates
 * the AudioContext and all WASM and Maximilian -powered Audio Worklet Processor
 * TODO: Implement Singleton pattern
 * @class AudioEngine
 */
class AudioEngine {

  /**
   * @constructor
   */
  constructor(audioContext) {

    // NOTE: We want AudioContext lazy loading (first Audio Engine play triggered by user) to prevent the warning
    this.audioContext; // = new AudioContext();
    this.sampleRate; // = this.audioContext.sampleRate;
    this.processorCount = 0;
    this.il2pCode = "";

    this.audioWorkletProcessorName = 'maxi-processor';
    this.audioWorkletUrl = 'maxi-processor.js';
    this.audioWorkletNode;

    this.loadTestIntervals = []
    const SYNTH_CHANGE_MS = 50;

    this.sequences = [
      `kc kc k scos`,
      `kc kc k`,
      `kc sss kccs skckos`,
    ];

    // DEBUG:
    this.synthDefs = [
      `this.mySine.sawn(60) * this.myOtherSine.sinewave(0.4)`,
      `this.mySine.sawn(60)`,
      `this.myOtherSine.sinewave(400)`,
      `this.mySine.sinewave(440) + this.myOtherSine.sinewave(441)`,
      `this.mySine.sinewave(440) * this.myOtherSine.sinewave(1)`,
      `this.mySine.sinewave(440 + (this.myOtherSine.sinewave(1) * 100))`,
      `this.mySine.sinewave(this.myOtherSine.sinewave(30) * 440)`,
      `this.mySine.sinewave(this.myOtherSine.sinewave(this.myLastSine.sinewave(0.1) * 30) * 440)`,
      `new Module.maxiOsc()`,
      `new Module.maxiOsc().sinewave(400)`, // Interesting case of failure, it seems we can't instantiate because of EM heap limits
    ];

    console.log("Audio engine loaded")
  }


  /**
   * @translateIntermediateToLanguageProcessorCode
   */
  translateIntermediateLanguageToProcessorCode(expression) {

  }

  loadProcessorCode() {
    if (this.audioContext !== undefined) {
      try {
        // TODO: Might be worthwile to change this to await/async pattern instead of promise
        this.audioContext.audioWorklet.addModule(this.audioWorkletUrl).then(() => {

          // Custom node constructor with required parameters          
          this.audioWorkletNode = new MaxiNode(this.audioContext, this.audioWorkletProcessorName);

          // All possible error event handlers subscribed 
          this.audioWorkletNode.onprocessorerror = (event) => { //  error from the processor
            console.log(`MaxiProcessor Error detected`);
          }
          this.audioWorkletNode.onprocessorstatechange = event => {
            console.log(`MaxiProcessor state change detected: ` + audioWorkletNode.processorState);
          }
          this.audioWorkletNode.port.onmessage = (event) => {
            console.log(`Message from processor: ` + event.data);
          };
          this.audioWorkletNode.port.onmessageerror = (event) => { //  error from the processor port
            console.log(`Error message from port: ` + event.data);
          };

          // Connect the worklet node to the audio graph
          this.audioWorkletNode.connect(this.audioContext.destination);
          return true;

        }).catch((e => console.log("Error on loading worklet: ", e)));
      } catch (err) {
        console.log("AudioWorklet not supported in this browser: ", err.message);
        return false;
      }
    } else {
      return false;
    }
  }

  /**
   * Re-starts audio playback by stopping and running the latest Audio Worklet Processor code
   * @changeSynth
   */
  changeSynth() {
    if (this.audioWorkletNode !== undefined) {
      let userDefinedFunction = this.fs[Math.floor(Math.random() * this.fs.length)];
      this.audioWorkletNode.port.postMessage(`() => { return ${userDefinedFunction} }`);
      // DEBUG:
      console.log("Change synth: " + userDefinedFunction);
    }
  }


  /**
   * Re-starts audio playback by stopping and running the latest Audio Worklet Processor code
   * @play
   */
  play() {
    if (this.audioContext === undefined) {
      this.audioContext = new AudioContext();
      let workletIsLoaded = this.loadProcessorCode()
      return workletIsLoaded;
    } else {
      if (this.audioContext.state !== "suspended") {
        this.stop();
        return false;
      } else {
        this.audioContext.resume();
        return true;
      }
    }
  }

  /**
   * Stops audio by disconnecting Audio None with Audio Worklet Processor code
   * from Web Audio graph
   * TODO: Investigate when it is best to just STOP the graph exectution
   * @stop
   */
  stop() {
    if (this.audioWorkletNode !== undefined) {
      this.audioContext.suspend();
    }
  }

  stopAndRelease() {
    if (this.audioWorkletNode !== undefined) {
      this.audioWorkletNode.disconnect(this.audioContext.destination);
      this.audioWorkletNode = undefined;
    }
  }


  increaseVolume() {
    if (this.audioWorkletNode !== undefined) {
      const gainParam = this.audioWorkletNode.parameters.get('gain');
      gainParam.value += 0.1;
    }
  }

  decreaseVolume() {
    if (this.audioWorkletNode !== undefined) {
      const gainParam = this.audioWorkletNode.parameters.get('gain');
      gainParam.value -= 0.1;
    }
  }



  more(gain) {
    if (audioWorkletNode !== undefined) {
      const gainParam = audioWorkletNode.parameters.get(gain);
      gainParam.value += 0.5;
      console.log(gain + ": " + gainParam.value); // DEBUG
      return true;
    } else return false;
  }

  less(gain) {
    if (audioWorkletNode !== undefined) {
      const gainParam = audioWorkletNode.parameters.get(gain);
      gainParam.value -= 0.5;
      console.log(gain + ": " + gainParam.value); // DEBUG
      return true;
    } else return false;
  }






}

export {
  AudioEngine
};