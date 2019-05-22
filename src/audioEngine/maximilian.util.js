export const getArrayAsVectorDbl = (arrayIn) => {
  var vecOut = new exports.VectorDouble();
  for (var i = 0; i < arrayIn.length; i++) {
    vecOut.push_back(arrayIn[i]);
  }
  return vecOut;
};

export const getBase64 = (str) => {
  //check if the string is a data URI
  if (str.indexOf(';base64,') !== -1) {
    //see where the actual data begins
    var dataStart = str.indexOf(';base64,') + 8;
    //check if the data is base64-encoded, if yes, return it
    // taken from
    // http://stackoverflow.com/a/8571649
    return str.slice(dataStart).match(/^([A-Za-z0-9+\/]{4})*([A-Za-z0-9+\/]{4}|[A-Za-z0-9+\/]{3}=|[A-Za-z0-9+\/]{2}==)$/) ? str.slice(dataStart) : false;
  } else return false;
};

export const _keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

export const removePaddingFromBase64 = (input) => {
  var lkey = Module.maxiTools._keyStr.indexOf(input.charAt(input.length - 1));
  if (lkey === 64) {
    return input.substring(0, input.length - 1);
  }
  return input;
};


export const loadSampleToArray = (audioContext, sampleObjectName, url, audioWorkletNode) => {
  var data = [];

  var context = audioContext;

  //check if url is actually a base64-encoded string
  var b64 = getBase64(url);
  if (b64) {
    //convert to arraybuffer
    //modified version of this:
    // https://github.com/danguer/blog-examples/blob/master/js/base64-binary.js
    var ab_bytes = (b64.length / 4) * 3;
    var arrayBuffer = new ArrayBuffer(ab_bytes);

    b64 = removePaddingFromBase64(removePaddingFromBase64(b64));

    var bytes = parseInt((b64.length / 4) * 3, 10);

    var uarray;
    var chr1, chr2, chr3;
    var enc1, enc2, enc3, enc4;
    var i = 0;
    var j = 0;

    uarray = new Uint8Array(arrayBuffer);

    b64 = b64.replace(/[^A-Za-z0-9\+\/\=]/g, "");

    for (i = 0; i < bytes; i += 3) {
      //get the 3 octects in 4 ascii chars
      enc1 = _keyStr.indexOf(b64.charAt(j++));
      enc2 = _keyStr.indexOf(b64.charAt(j++));
      enc3 = _keyStr.indexOf(b64.charAt(j++));
      enc4 = _keyStr.indexOf(b64.charAt(j++));

      chr1 = (enc1 << 2) | (enc2 >> 4);
      chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
      chr3 = ((enc3 & 3) << 6) | enc4;

      uarray[i] = chr1;
      if (enc3 !== 64) {
        uarray[i + 1] = chr2;
      }
      if (enc4 !== 64) {
        uarray[i + 2] = chr3;
      }
    }

    // https://webaudio.github.io/web-audio-api/#dom-baseaudiocontext-decodeaudiodata
    // Asynchronously decodes the audio file data contained in the ArrayBuffer.
    audioContext.decodeAudioData(
      arrayBuffer, // has its content-type determined by sniffing
      function (buffer) { // successCallback, argument is an AudioBuffer representing the decoded PCM audio data.
        // source.buffer = buffer;
        // source.loop = true;
        // source.start(0);
        let float32Array = buffer.getChannelData(0);
        if (data !== undefined && audioWorkletNode !== undefined) {
          // console.log('f32array: ' + float32Array);
          audioWorkletNode.port.postMessage({
            [sampleObjectName]: float32Array,
          });
        }
      },
      function (buffer) { // errorCallback
        console.log("Error decoding source!");
      }
    );
  } else {
    // Load asynchronously
    // NOTE: This is giving me an error
    // Uncaught ReferenceError: XMLHttpRequest is not defined (index):97 MaxiProcessor Error detected: undefined
    // NOTE: followed the trail to the wasmmodule.js
    // when loading on if (typeof XMLHttpRequest !== 'undefined') {
    // throw new Error("Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. 
    // Use --embed-file or --preload-file in emcc on the main thread.");
    var request = new XMLHttpRequest();
    request.addEventListener("load", () => console.log("The transfer is complete."));
    request.open("GET", url, true);
    request.responseType = "arraybuffer";
    request.onload = function () {
      audioContext.decodeAudioData(
        request.response,
        function (buffer) {
          let float32Array = buffer.getChannelData(0);
          if (data !== undefined && audioWorkletNode !== undefined) {
            // console.log('f32array: ' + float32Array);
            audioWorkletNode.port.postMessage({
              [sampleObjectName]: float32Array,
            });
          }
        },
        function (buffer) {
          console.log("Error decoding source!");
        }
      );
    };
    request.send();
  }
  return "Loading module";
};

/**
 * @buildWorkletStringForBlob
 */
export const buildWorkletStringForBlob = () => {
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
export const createAndRegisterCustomProcessorCode = (il2pCode, processorName) => {

  return `${il2pCode}

    registerProcessor("${processorName}", CustomProcessor);`;
}

/**
 * @buildWorkletStringForBlob
 */
export const buildWorkletFromBlob = () => {
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
export const runProcessorCode = () => {
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


export const generateNoiseBuffer = (length) => {
  var bufferData = new Module.VectorDouble();
  for (var n = 0; n < length; n++) {
    bufferData.push_back(Math.random(1));
  }
  return bufferData;
}


export const translateBlobToBuffer = (blob) => {

  let arrayBuffer = null;
  let float32Array = null;
  var fileReader = new FileReader();
  fileReader.onload = function (event) {
    arrayBuffer = event.target.result;
    float32Array = new Float32Array(arrayBuffer);
  };
  fileReader.readAsArrayBuffer(blob);
  let audioFloat32Array = fileReader.result;
  var maxiSampleBufferData = new Module.VectorDouble();
  for (var i = 0; i < audioFloat32Array.length; i++) {
    maxiSampleBufferData.push_back(audioFloat32Array[i]);
  }
  return maxiSampleBufferData;
}