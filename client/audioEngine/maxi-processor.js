import Module from './maximilian.wasmmodule.js';
// import {
//   MMLLOnsetDetector
// } from '../machineListening/MMLLOnsetDetector.js';



class PostMsgTransducer {

  constructor(msgPort, sampleRate, sendFrequency = 2, name) {
    if (sendFrequency == 0)
      this.sendPeriod = Number.MAX_SAFE_INTEGER;
    else
      this.sendPeriod = 1.0 / sendFrequency * sampleRate;
    this.sendCounter = this.sendPeriod;
    this.port = msgPort;
    this.val = 0;
    this.name=name;
  }

  // incoming(msg) {
  //   this.val = msg.val;
  // }

  send(id, sendMsg) {
    if (this.sendCounter >= this.sendPeriod) {
      this.port.postMessage({
        rq: "send",
        value: sendMsg,
        id: id

      });
      this.sendCounter -= this.sendPeriod;
    } else {
      this.sendCounter++;
    }
    return 0;
  }

  receive(sendMsg) {
    if (this.sendCounter >= this.sendPeriod) {
      this.port.postMessage({
        rq: "recv",
        value: sendMsg,
        tname: this.name
      });
      this.sendCounter -= this.sendPeriod;
    } else {
      this.sendCounter++;
    }
    return this.val;
  }

  // io(sendMsg) {
  //   if (this.sendCounter >= this.sendPeriod) {
  //     this.port.postMessage({
  //       rq: "dataplease",
  //       value: sendMsg
  //     });
  //     this.sendCounter -= this.sendPeriod;
  //   } else {
  //     this.sendCounter++;
  //   }
  //   return this.val;
  // }
}



/**
 * The main Maxi Audio wrapper with a WASM-powered AudioWorkletProcessor.
 *
 * @class MaxiProcessor
 * @extends AudioWorkletProcessor
 */
class MaxiProcessor extends AudioWorkletProcessor {

  /**
   * @getter
   */
  static get parameterDescriptors() { // TODO: parameters are static? Can we not change this map with a setter?
    return [{
      name: 'gainSyn',
      defaultValue: 2.5
    }, {
      name: 'gainSeq',
      defaultValue: 6.5
    }];
  }

  /**
   * @constructor
   */
  constructor() {
    super();
    this.sampleRate = 44100;

    this.DAC = [0];

    // this.onsetDetector = new MMLLOnsetDetector(this.sampleRate);

    this.tempo = 120.0; // tempo (in beats per minute);
    this.secondsPerBeat = (60.0 / this.tempo);
    this.counterTimeValue = (this.secondsPerBeat / 4); //___16th note

    this.oldClock = 0;
    this.phase = 0;

    // this.maxiAudio = new Module.maxiAudio();
    this.clock = new Module.maxiOsc();
    this.kick = new Module.maxiSample();
    this.snare = new Module.maxiSample();
    this.closed = new Module.maxiSample();
    this.open = new Module.maxiSample();


    this.initialised = false;

    this.newq = () => {return {"vars":{}}};
    this.newmem = () => {return new Float64Array(512)};
    this._q = [this.newq(),this.newq()];
    this._mems =[this.newmem(), this.newmem()];

    this.setvar = (q, name, val) => {
      q.vars[name] = val;
      return val;
    };

    this.getvar = (q, name) => {
      let val = q.vars[name];
      return val ? val : 0.0;
    };

    this.silence = (q, inputs) => {
      return 0.0
    };
    this.signals = [this.silence, this.silence];
    this.currentSignalFunction = 0;
    this.xfadeControl = new Module.maxiLine();

    this.timer = new Date();

    this.OSCMessages = {};

    this.OSCTransducer = function(x, idx = 0) {
      let val = this.OSCMessages[x];
      return val ? idx >= 0 ? val[idx] : val : 0.0;
    };

    this.incoming = {};

    this.sampleBuffers={};

    this.transducers = {};
    
    this.registerTransducer = (name, rate) => {
      let trans = new PostMsgTransducer(this.port, this.sampleRate, rate, name);
      this.transducers[name] = trans;
      console.log(this.transducers);
      return trans;
    };

    this.getSampleBuffer = (bufferName) => {
      // console.log(this.sampleBuffers);
      // console.log(bufferName);
        return this.translateFloat32ArrayToBuffer(this.sampleBuffers[bufferName]);
    };

    this.netClock = new Module.maxiAsyncKuramotoOscillator(2);
    this.kuraPhase = -1;

    this.port.onmessage = event => { // message port async handler
      if ('address' in event.data) {
        //this must be an OSC message
        this.OSCMessages[event.data.address] = event.data.args;
        //console.log(this.OSCMessages);
      } else if ('worker' in event.data) { //from a worker
        //this must be an OSC message
        if (this.transducers[event.data.tname]) {
          // console.log(this.transducers[event.data.tname]);
          this.transducers[event.data.tname].incoming(event.data);
        }
      } else if ('sample' in event.data) { //from a worker
        // console.log("sample received");
        // console.log(event.data);
        let sampleKey = event.data.sample.substr(0,event.data.sample.length - 4)
        this.sampleBuffers[sampleKey] = event.data.buffer;
      }else if ('phase' in event.data) {
        this.kuraPhase = event.data.phase;
      } else if ('eval' in event.data) { // check if new code is being sent for evaluation?

        try {
          console.log("[DEBUG]:MaxiProcessor:Process: ");
          console.log(event.data);

          // let setupFunction = new Function(`return ${event.data['setup']}`);
          let setupFunction = eval(event.data['setup']);
          let loopFunction = eval(event.data['loop']);
          // let loopFunction = new Function(`return ${event.data['loop']}`);



          this.currentSignalFunction = 1 - this.currentSignalFunction;
          this._q[this.currentSignalFunction] = setupFunction();
          this._mems[this.currentSignalFunction] = this.newmem();
          // this._q[this.currentSignalFunction] = setupFunction()();
          this.signals[this.currentSignalFunction] = loopFunction;
          // this.signals[this.currentSignalFunction] = loopFunction();


          let xfadeBegin = Module.maxiMap.linlin(1.0 - this.currentSignalFunction, 0, 1, -1, 1);
          let xfadeEnd = Module.maxiMap.linlin(this.currentSignalFunction, 0, 1, -1, 1);
          this.xfadeControl.prepare(xfadeBegin, xfadeEnd, 5); // short xfade across signals
          this.xfadeControl.triggerEnable(true); //no clock yet, so enable the trigger straight away
          this.port.postMessage("evalEnd")
        } catch (err) {
          if (err instanceof TypeError) {
            console.log("TypeError in worklet evaluation: " + err.name + " – " + err.message);
          } else {
            console.log("Error in worklet evaluation: " + err.name + " – " + err.message);
          }
        }
      }
    };
    this.port.postMessage("giveMeSomeSamples");

    this.clockFreq = 0.8;
    this.clockPhaseSharingInterval=0; //counter for emiting clock phase over the network
    this.clockPhase = (multiples, phase) => {
        return (((this.clockPhasor * multiples) % 1.0) + phase) % 1.0;
    };
    this.clockTrig = (multiples, phase) => {
        return (this.clockPhase(multiples, phase) - (1.0/this.sampleRate * multiples)) <= 0 ? 1 : -1;
    };
    this.setClockFreq = (freq) => {
      this.clockFreq = freq;
      return 0;
    };

  }

  /**
   * @process
   */
  process(inputs, outputs, parameters) {
    // this.port.postMessage("dspStart");


    // let ts = this.timer.getTime();

    // DEBUG:
    // console.log(`gain: ` + parameters.gain[0]);
    const outputsLength = outputs.length;

    for (let outputId = 0; outputId < outputsLength; ++outputId) {
      let output = outputs[outputId];
      let channelCount = output.length;

      for (let i = 0; i < output[0].length; ++i) {
        //net clocks
        if (this.kuraPhase != -1) {
          this.netClock.setPhase(this.kuraPhase, 1);
          this.kuraPhase = -1;
        }
        this.netClock.play(this.clockFreq, 100);
        this.clockPhasor = this.netClock.getPhase(0) / (2 * Math.PI);
        //share the clock if networked
        if (this.netClock.size() > 1 && this.clockPhaseSharingInterval++ == 2000) {
          this.clockPhaseSharingInterval=0;
          let phase = this.netClock.getPhase(0);
          // console.log(`phase: ${phase}`);
          this.port.postMessage({ p: phase, c: "phase" });
        }


        //xfade between old and new algorhythms
        let sig0 = this.signals[0](this._q[0], inputs[0][0][i], this._mems[0]);
        let sig1 = this.signals[1](this._q[1], inputs[0][0][i], this._mems[1]);
        let xf = this.xfadeControl.play(i == 0 ? 1 : 0);
        let w = Module.maxiXFade.xfade(sig0, sig1, xf);
        //mono->stereo
        for (let channel = 0; channel < channelCount; channel++) {
          output[channel][i] = w;
        }

      }

      //remove old algo and data?
      if (this.xfadeControl.isLineComplete()) {
        let oldIdx = 1.0 - this.currentSignalFunction;
        this.signals[oldIdx] = this.silence;
        this._q[oldIdx] = this.newq();
      }

      // this.port.postMessage("dspEnd");


      // ts = this.timer.getTime() - ts;
      // console.log(ts + ", " + 128/44100*1000);



      // for (let channel = 0; channel < output.length; ++channel) {
      //   let outputChannel;
      //
      //   if (this.DAC === undefined || this.DAC.length === 0) {
      //     outputChannel = output[channel];
      //   } else { // If the user specified a channel configuration for DAC
      //     if (this.DAC[channel] === undefined) // If user-specified channel configuration is invalid (e.g. channel 7 in a 5.1 layout)
      //       break;
      //     else {
      //       if (output[this.DAC[channel]] !== undefined) { // If user-specified channel configuration is valid
      //         outputChannel = output[this.DAC[channel]];
      //       } else { // If user-specified channel configuration is a subset of the total number of channel skip loop iterations until total number
      //         continue;
      //       }
      //     }
      //   }

      // for (let i = 0; i < 128; ++i) {
      //   outputChannel[i] = this.signals[this.currentSignalFunction]();
      // }

      // if (parameters.gainSyn.length === 1 && parameters.gainSeq.length === 1) { // if gain is constant, lenght === 1, gain[0]
      //   for (let i = 0; i < 128; ++i) {
      //     outputChannel[i] = this.signals[this.currentSignalFunction]() * this.logGain(parameters.gainSyn[0]) + this.loopPlayer() * this.logGain(parameters.gainSeq[0]);
      //   }
      // } else { // if gain is varying, lenght === 128, gain[i] for each sample of the render quantum
      //   for (let i = 0; i < 128; ++i) {
      //     outputChannel[i] = this.signals[this.currentSignalFunction]() * this.logGain(parameters.gainSyn[i]) + this.loopPlayer() * this.logGain(parameters.gainSeq[i]);
      //   }
      // }
      // DEBUG:
      // console.log(`inputs ${inputs.length}, outputsLen ${outputs.length}, outputLen ${output.length}, outputChannelLen ${outputChannel.length}`);
      // }
    }
    return true;
  }

  //Deprecated
  generateNoiseBuffer(length) {
    var bufferData = new Module.VectorDouble();
    for (var n = 0; n < length; n++) {
      bufferData.push_back(Math.random(1));
    }
    return bufferData;
  }

  //Deprecated
  translateBlobToBuffer(blob) {

    let arrayBuffer = null;
    let float32Array = null;
    var fileReader = new FileReader();
    fileReader.onload = function(event) {
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

  translateFloat32ArrayToBuffer(audioFloat32ArrayBuffer) {

    var maxiSampleBufferData = new Module.VectorDouble();
    for (var i = 0; i < audioFloat32ArrayBuffer.length; i++) {
      maxiSampleBufferData.push_back(audioFloat32ArrayBuffer[i]);
    }
    return maxiSampleBufferData;
  }

  logGain(gain) {
    // return 0.095 * Math.exp(this.gain * 0.465);
    return 0.0375 * Math.exp(gain * 0.465);
  }


};

registerProcessor("maxi-processor", MaxiProcessor);
