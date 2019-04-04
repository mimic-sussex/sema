import './maximilian.wasmmodule.js';

/**
 * The CustomAudioNode is a class that extends AudioWorkletNode
 * to hold an Custom Audio Worklet Processor and connect to Web Audio graph
 * @class CustomAudioNode
 * @extends AudioWorkletNode
 */
class CustomAudioNode extends AudioWorkletNode {
  constructor(audioContext, processorName) {
    let options = { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2] };
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
  constructor(audioContext){

    this.audioContext = new AudioContext();
    this.sampleRate = this.audioContext.sampleRate;
    this.processorCount = 0;
    this.il2pCode = "";
  }

  /**
  * Re-starts audio playback by stopping and running the latest Audio Worklet Processor code
  * @play
  */
  play() {
    this.stop();
    this.runProcessorCode();
    this.processorCount++;
  }

  /**
  * Stops audio by disconnecting Audio None with Audio Worklet Processor code
  * from Web Audio graph
  * TODO: Investigate when it is best to just STOP the graph exectution
  * @stop
  */
  stop() {
    if (this.customNode !== undefined) {
      this.customNode.disconnect(this.audioContext.destination);
      this.customNode = undefined;
    }
  }

  /**
   * @translateIntermediateToLanguageProcessorCode
   */
  translateIntermediateLanguageToProcessorCode (expression) {
    let userDefinedFunction = "";
    switch (expression%2) {
      case 0:
        userDefinedFunction = `Math.random() * 2 - 1`;
        break;
      case 1:
        userDefinedFunction = `Math.sin(400) * 2 + 1`;
        break;
      default:
        userDefinedFunction = `Math.sin(Math.sin(400))`;
    }

    // import Module from './maximilian.wasmmodule.js';
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

  /**
   * @createAndRegisterCustomProcessorCode
   */
  createAndRegisterCustomProcessorCode(il2pCode, processorName) {

    return `${il2pCode}

    registerProcessor("${processorName}", CustomProcessor);`;
  }

  /**
   * @runProcessorCode
   */
  runProcessorCode() {

    console.log('processorCount: ' + this.processorCount);
    // const userCode = editor.getDoc().getValue();
    const processorName = `processor-${this.processorCount}`;

    this.il2pCode = this.translateIntermediateLanguageToProcessorCode(this.processorCount);

    const code = this.createAndRegisterCustomProcessorCode(this.il2pCode, processorName);

    console.log(code);

    const blob = new Blob([code], { type: "application/javascript" });

    const workletUrl = window.URL.createObjectURL(blob);

    this.audioContext.audioWorklet.addModule(workletUrl).then(() => {
      this.stop();
      this.customNode = new CustomAudioNode(this.audioContext, processorName);
      this.customNode.connect(this.audioContext.destination);
    });
  }

}

export {
  AudioEngine
};
