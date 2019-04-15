// import Module from './maximilian.wasmmodule.js';

import CustomProcessor from './maxi-processor'

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

    this.maxiWorkletProcessorName = 'maxi-processor';
    this.maxiWorkletUrl = 'maxi-processor.js';

    // DEBUG:
    this.fs = [
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
    if(this.audioContext === undefined) {
      try {
        this.audioContext = new AudioContext();
        this.audioContext.audioWorklet.addModule(this.maxiWorkletUrl).then(() => {
          this.customNode = new MaxiNode(this.audioContext, this.maxiWorkletProcessorName);
          this.customNode.onprocessorerror = (event) => { console.log(`MaxiProcessor Error detected`); }
          this.customNode.port.onmessage = (event) => { console.log(`Message from processor: ` + event.data); }; //  data from the processor.
          this.customNode.port.onmessageerror = (event) => { console.log(`Error message from port: ` + event.data); }; //  data from the processor.
          this.customNode.connect(this.audioContext.destination);
        }).catch((e => console.log("Error on loading worklet: ", e)));
      } catch (err) {
        console.log("AudioWorklet not supported in this browser: ", err.message);
      }
    }
  }

  /**
   * Re-starts audio playback by stopping and running the latest Audio Worklet Processor code
   * @play
   */
  play() {
    if (this.audioContext === undefined)
      this.loadProcessorCode();
    else
      if (this.customNode !== undefined) {
        this.audioContext.resume();
      }
  }

  /**
   * Stops audio by disconnecting Audio None with Audio Worklet Processor code
   * from Web Audio graph
   * TODO: Investigate when it is best to just STOP the graph exectution
   * @stop
   */
  stop() {
    if (this.customNode !== undefined) {
      this.audioContext.suspend();
    }
  }

  stopAndRelease() {
    if (this.customNode !== undefined) {
      this.customNode.disconnect(this.audioContext.destination);
      this.customNode = undefined;
    }
  }


  increaseVolume() {
    if (this.customNode !== undefined) {
      const gainParam = this.customNode.parameters.get('gain');
      gainParam.value += 0.1;
    }
  }

  decreaseVolume() {
    if (this.customNode !== undefined) {
      const gainParam = this.customNode.parameters.get('gain');
      gainParam.value -= 0.1;
    }
  }

  changeSynth() {
    if (this.customNode !== undefined) {
      let userDefinedFunction = this.fs[Math.floor(Math.random() * this.fs.length)];
      this.customNode.port.postMessage(`() => { return ${userDefinedFunction} }`);
        // DEBUG:
      console.log("Change synth: " + userDefinedFunction);
    }
  }

}

export { AudioEngine };
