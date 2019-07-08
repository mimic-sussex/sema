import Module from './maximilian.wasmmodule.js'; //NOTE: We need this import here for webpack to emit maximilian.wasmmodule.js
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
  constructor(msgHandler) {

    // NOTE: We want AudioContext lazy loading (first Audio Engine play triggered by user) to prevent the warning
    this.audioContext; // = new AudioContext();
    this.sampleRate; // = this.audioContext.sampleRate;
    this.processorCount = 0;
    this.il2pCode = "";

    this.msgHandler = msgHandler;

    this.audioWorkletProcessorName = 'maxi-processor';
    this.audioWorkletUrl = 'maxi-processor.js';
    this.audioWorkletNode;

    this.samplesLoaded = false;

    this.onNewDSPLoadValue = (x) => {};

    this.loadTestIntervals = []
    const SYNTH_CHANGE_MS = 50;

    this.dspTime = 0;

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

    this.oscThru = (msg) => {
      console.log(msg);
    };

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
            this.messageHandler(event.data);
          };
          this.audioWorkletNode.port.onmessageerror = (event) => { //  error from the processor port
            console.log(`Error message from port: ` + event.data);
          };

          // Connect the worklet node to the audio graph
          this.audioWorkletNode.connect(this.audioContext.destination);
          return true;

        }).catch(e => console.log("Error on loading worklet: ", e.message));
      } catch (err) {
        console.log("AudioWorklet not supported in this browser: ", err.message);
        return false;
      }
    } else {
      return false;
    }
  }


  messageHandler(data) {
    if (data == "dspStart") {
      this.ts = window.performance.now();
    } else
    if (data == "dspEnd") {
      this.ts = window.performance.now() - this.ts;
      this.dspTime = ((this.dspTime * 0.9) + (this.ts * 0.1)); //time for 128 sample buffer
      this.onNewDSPLoadValue(this.dspTime / 2.90249433106576 * 100);
    } else
    if (data == 'evalEnd') {
      let evalts = window.performance.now();
      this.onEvalTimestamp(evalts);
    } else {
      this.msgHandler(data);
    }
  }

  postMessage(msg) {
    this.audioWorkletNode.port.postMessage(msg);
  }

  loadSample(objectName, url) {

    if (this.audioContext !== undefined) {
      loadSampleToArray(this.audioContext, objectName, url, this.audioWorkletNode);
    } else throw "Audio Context is not initialised!";
  }

  loadSamples() {
    if (this.audioContext !== undefined) {
      loadSampleToArray(this.audioContext, "snare", "samples/909.wav", this.audioWorkletNode);
      loadSampleToArray(this.audioContext, "kick", "samples/909b.wav", this.audioWorkletNode);
      loadSampleToArray(this.audioContext, "closed", "samples/909closed.wav", this.audioWorkletNode);
      loadSampleToArray(this.audioContext, "open", "samples/909open.wav", this.audioWorkletNode);

      this.samplesLoaded = true;
    } else throw "Audio Context is not initialised!";
  }



  /**
   * Re-starts audio playback by stopping and running the latest Audio Worklet Processor code
   * @play
   */
  play() {
    if (this.audioContext === undefined) {
      this.audioContext = new AudioContext();
      this.loadProcessorCode();
      this.oscThru = (msg) => {
        this.audioWorkletNode.port.postMessage(msg)
      };
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

  more(gain) {
    if (this.audioWorkletNode !== undefined) {
      const gainParam = this.audioWorkletNode.parameters.get(gain);
      gainParam.value += 0.5;
      console.log(gain + ": " + gainParam.value); // DEBUG
      return true;
    } else return false;
  }

  less(gain) {
    if (this.audioWorkletNode !== undefined) {
      const gainParam = this.audioWorkletNode.parameters.get(gain);
      gainParam.value -= 0.5;
      console.log(gain + ": " + gainParam.value); // DEBUG
      return true;
    } else return false;
  }


  evalSequence() {
    if (this.audioWorkletNode !== undefined) {
      let sequence;
      if (arguments.length == 0) {
        sequence = this.sequences[Math.floor(Math.random() * this.sequences.length)]; // Choose random entry
        this.audioWorkletNode.port.postMessage({
          sequence: `${sequence}`
        }); // Send JSON object with eval prop for evaluation in processor
      } else {
        sequence = arguments[0];
        this.audioWorkletNode.port.postMessage({
          sequence: `${sequence}`
        }); // Send JSON object with eval prop for evaluation in processor
      }
      return true;
      // DEBUG:
      // console.log("Change Sequence: " + sequence);
    }
    return false;
  }


  evalSynth() {
    if (this.audioWorkletNode !== undefined) {
      let userDefinedFunction;
      if (arguments.length == 0) {
        userDefinedFunction = this.synthDefs[Math.floor(Math.random() * this.synthDefs.length)];
      } else {
        userDefinedFunction = arguments[0];
      }
      // DEBUG:
      this.audioWorkletNode.port.postMessage({
        // eval: `() => { return ${userDefinedFunction} }`
        eval: 1,
        setup: userDefinedFunction.setup,
        loop: userDefinedFunction.loop
      });
      // console.log("eval sent: " + userDefinedFunction); //DEBUG
      return true;
    } else return false;
  }

  oscMessage(msg) {
    this.oscThru(msg);
  }

  loadTest() {
    if (audioContext.state === "suspended")
      this.playAudio();
    this.loadTestIntervals.push(setInterval('changeSynth()', this.SYNTH_CHANGE_MS));
  }

  stopLoadTest() {
    this.loadTestIntervals.forEach(interval => {
      clearInterval(interval);
    });
  }



}

export {
  AudioEngine
};
