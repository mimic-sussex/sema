
  /**
  * @buildWorkletStringForBlob
  */
  buildWorkletStringForBlob() {
    let userDefinedFunction = "";
    switch (expression % 2) {
      case 0:
        userDefinedFunction = `Math.random() * 2`;
        break;
      case 1:
        userDefinedFunction = `(Math.sin(400) + 0.4)`;
        break;
      default:
        userDefinedFunction = `(Math.sin(440) + 0.4)`;
    }

    // We get an "Error on loading worklet:  DOMException" with the following import:
    // import Module from './maximilian.wasmmodule.js';
    return `
      import Module from './maximilian.wasmmodule.js';
      cwlass CustomProcessor extends AudioWorkletProcessor {
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
  * @buildWorkletStringForBlob
  */
  buildWorkletFromBlob() {
    console.log('processorCount: ' + this.processorCount);
    // const userCode = editor.getDoc().getValue();
    const processorName = `processor-${this.processorCount}`;

    this.il2pCode = this.translateIntermediateLanguageToProcessorCode(this.processorCount);

    const code = this.createAndRegisterCustomProcessorCode(this.il2pCode, processorName);

    console.log(code);

    const blob = new Blob([code], {
      type: "application/javascript; charset=utf-8",
    });

    return blob;
  }

  /**
   * TODO: Check for memory leaks
   * @runProcessorCode
   */
  runProcessorCode() {

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
    }).catch(e => console.log("Error on loading worklet: ", e));
  }
