// import Module from './maximilian.wasmmodule.js';

import CustomProcessor from './maxi-processor'

/**
 * The CustomAudioNode is a class that extends AudioWorkletNode
 * to hold an Custom Audio Worklet Processor and connect to Web Audio graph
 * @class CustomAudioNode
 * @extends AudioWorkletNode
 */
class CustomAudioNode extends AudioWorkletNode {
  constructor(audioContext, processorName) {
    // super(audioContext, processorName);
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

    this.customProcessorName = 'maxi-processor';
    this.maxiWorkletUrl = 'maxi-processor.js';

    console.log("AudioEngine loaded")
  }

  /**
   * @translateIntermediateToLanguageProcessorCode
   */
  translateIntermediateLanguageToProcessorCode (expression) {
    let userDefinedFunction = "";
    switch (expression % 2) {
      case 0:
        userDefinedFunction = `Math.random() * 2`;
        break;
      case 1:
        userDefinedFunction = `(Math.sin(i) + 0.4)`;
        break;
      default:
        userDefinedFunction = `(Math.sin(440) + 0.4)`;
    }

    //import Module from './maximilian.wasmmodule.js';
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
          this.sampleRate = 44100;

          this.port.onmessage = (event) => {
            console.log(event.data);
          };

        }
        process(inputs, outputs, parameters) {

          const outputsLength = outputs.length;
          for (let outputId = 0; outputId < outputsLength; ++outputId) {
            let output = outputs[outputId];
            const channelLenght = output.length;

            for (let channelId = 0; channelId < channelLenght; ++channelId) {
              const gain = parameters.gain;
              const isConstant = gain.length === 1
              let outputChannel = output[channelId];

              for (let i = 0; i < outputChannel.length; ++i) {
                const amp = isConstant ? gain[0] : gain[i]
                outputChannel[i] = ${userDefinedFunction} * amp;
              }
            }
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
   * TODO: Check for memory leaks
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

    // TODO: Check for memory leaks
    // URL.revokeObjectURL()
    const workletUrl = window.URL.createObjectURL(blob);

    // Set custom processor in audio worklet
    this.audioContext.audioWorklet.addModule(workletUrl).then(() => {
      this.stop();
      this.customNode = new CustomAudioNode(this.audioContext, processorName);
      this.customNode.port.onmessage = (event) => {
        //  data from the processor.
        console.log("from processor: " + event.data);
      };
      this.customNode.connect(this.audioContext.destination);
    }).catch( e => console.log("Error on loading worklet: ", e) );
  }

  runMaxiProcessorCode() {

    console.log('processorCount: ' + this.processorCount);

    this.audioContext.audioWorklet.addModule(CustomProcessor).then(() => {

      this.stop();
      this.customNode = new CustomAudioNode(this.audioContext, this.customProcessorName);
      this.customNode.port.onmessage = (event) => {
        // data from the processor.
        console.log("from processor: " + event.data);
      };
      this.customNode.connect(this.audioContext.destination);

    }).catch( e => console.log("Error on loading worklet: ", e) );
  }

  /**
  * Re-starts audio playback by stopping and running the latest Audio Worklet Processor code
  * @play
  */
  play() {
    this.stop();

    if(this.processorCount % 3)
      this.runProcessorCode();
    else
      this.runMaxiProcessorCode();

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

}

export { AudioEngine };
