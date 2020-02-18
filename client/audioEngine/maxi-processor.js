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

  incoming(msg) {
    this.val = msg.value;
  }

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
        rq: "receive",
        value: sendMsg,
        transducerName: this.name
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

class pvshift {
  constructor() {
    this.fft = new Module.maxiFFT();
		this.fft.setup(1024,512,1024);
		this.ifft = new Module.maxiIFFT();
		this.ifft.setup(1024,512,1024);
		this.mags = new Module.VectorFloat();
		this.phases = new Module.VectorFloat();
		this.mags.resize(512,0);
		this.phases.resize(512,0);
  }

  play(sig, shift) {
    if (this.fft.process(sig, Module.maxiFFTModes.WITH_POLAR_CONVERSION)) {
      this.mags = this.fft.getMagnitudes();
      this.phases = this.fft.getPhases();
      //shift bins up
      for(let i=511; i > 0; i--) {
        if (i > shift) {
          this.mags.set(i, this.mags.get(i-shift));
        }else{
          this.mags.set(i,0);
        }
      }
      // console.log(mags.get(10));
    }
    sig = this.ifft.process(this.mags, this.phases, Module.maxiIFFTModes.SPECTRUM);
    return sig;
  }
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
    },
    {
      name: 'numClockPeers',
      defaultValue: 1
    }];
  }


  /**
   * @constructor
   */
  constructor() {
    super();

    let q1 = Module.maxiBits.sig(63);
    // for(let i=0; i < 123; i++) q1 = Module.maxiBits.inc(q1);
    // let q2 = Module.maxiBits.sig(255);
    // let q3 = Module.maxiBits.land(q1,q2);
    // let q4 = Module.maxiBits.shl(q3, 22);
    // console.log("res: " + q1);

    this.sampleRate = 44100;

    this.DAC = [0];

    // this.onsetDetector = new MMLLOnsetDetector(this.sampleRate);

    this.tempo = 120.0; // tempo (in beats per minute);
    this.secondsPerBeat = (60.0 / this.tempo);
    this.counterTimeValue = (this.secondsPerBeat / 4); //___16th note

    this.oldClock = 0;
    this.phase = 0;

    this.numPeers = 1;

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
    this._cleanup = [0,0];

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
    this.sampleVectorBuffers = {};

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
        // return this.translateFloat32ArrayToBuffer(this.sampleBuffers[bufferName]);
        return this.sampleVectorBuffers[bufferName];
    };

    this.netClock = new Module.maxiAsyncKuramotoOscillator(3);  //TODO: this should be the same as numpeers
    this.kuraPhase = -1;
    this.kuraPhaseIdx = 1;

    this.port.onmessage = event => { // message port async handler
      if ('address' in event.data) {
        //this must be an OSC message
        this.OSCMessages[event.data.address] = event.data.args;
        //console.log(this.OSCMessages);
      } else if ('worker' in event.data) { //from a worker
        //this must be an OSC message
        if (this.transducers[event.data.transducerName]) {
          // console.log(this.transducers[event.data.tname]);
          this.transducers[event.data.transducerName].incoming(event.data);
        }
      } else if ('sample' in event.data) { //from a worker
        // console.log("sample received");
        // console.log(event.data);
        let sampleKey = event.data.sample.substr(0,event.data.sample.length - 4)
        // this.sampleBuffers[sampleKey] = event.data.buffer;
        this.sampleVectorBuffers[sampleKey] = this.translateFloat32ArrayToBuffer(event.data.buffer);
      }else if ('phase' in event.data) {
        // console.log(this.kuraPhaseIdx);
        console.log(event);
        this.netClock.setPhase(event.data.phase, event.data.i);
        // this.kuraPhase = event.data.phase;
        // this.kuraPhaseIdx = event.data.i;
      } else if ('eval' in event.data) { // check if new code is being sent for evaluation?

        let setupFunction;
        let loopFunction;
        try {
          // console.log("[DEBUG]:MaxiProcessor:Process: ");
          // console.log(event.data);

          // let setupFunction = new Function(`return ${event.data['setup']}`);
          setupFunction = eval(event.data['setup']);
          loopFunction = eval(event.data['loop']);
          // let loopFunction = new Function(`return ${event.data['loop']}`);



          let oldSignalFunction = this.currentSignalFunction;
          this.currentSignalFunction = 1 - this.currentSignalFunction;
          this._q[this.currentSignalFunction] = setupFunction();
          //allow feedback between evals
          this._mems[this.currentSignalFunction] = this._mems[oldSignalFunction];
//          this._mems[this.currentSignalFunction] = this.newmem();
          // this._q[this.currentSignalFunction] = setupFunction()();
          this.signals[this.currentSignalFunction] = loopFunction;
          this._cleanup[this.currentSignalFunction] = 0;
          // this.signals[this.currentSignalFunction] = loopFunction();


          let xfadeBegin = Module.maxiMap.linlin(1.0 - this.currentSignalFunction, 0, 1, -1, 1);
          let xfadeEnd = Module.maxiMap.linlin(this.currentSignalFunction, 0, 1, -1, 1);
          this.xfadeControl.prepare(xfadeBegin, xfadeEnd, 18); // short xfade across signals
          this.xfadeControl.triggerEnable(true); //no clock yet, so enable the trigger straight away
        } catch (err) {
          if (err instanceof TypeError) {
            console.log("TypeError in worklet evaluation: " + err.name + " – " + err.message);
          } else {
            console.log("Error in worklet evaluation: " + err.name + " – " + err.message);
            console.log(setupFunction);
            console.log(loopFunction);
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

    this.bitTime = Module.maxiBits.sig(0);  //this needs to be decoupled from the audio engine? or not... maybe a 'permenant block' with each grammar?
    this.dt = 0;


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
        this.bitTime = Module.maxiBits.inc(this.bitTime);
        //net clocks
        // if (this.kuraPhase != -1) {
        //   // this.netClock.setPhase(this.kuraPhase, this.kuraPhaseIdx);
        //   console.log(this.kuraPhaseIdx);
        //testing
        // this.netClock.setPhase(this.netClock.getPhase(0), 1);
        // this.netClock.setPhase(this.netClock.getPhase(0), 2);
        //   this.kuraPhase = -1;
        // }
        this.netClock.play(this.clockFreq, 100);
        this.clockPhasor = this.netClock.getPhase(0) / (2 * Math.PI);
        //share the clock if networked
        // if (this.clockPhaseSharingInterval++ == 2000) {
        if (this.netClock.size() > 1 && this.clockPhaseSharingInterval++ == 2000) {
          this.clockPhaseSharingInterval=0;
          let phase = this.netClock.getPhase(0);
          // console.log(`DEBUG:MaxiProcessor:phase: ${phase}`);
          this.port.postMessage({ phase: phase, c: "phase" });
        }

        this.bitclock = Module.maxiBits.sig(Math.floor(this.clockPhase(1,0) * 1023.999999999));

        //xfade between old and new algorhythms
        let sig0 = this.signals[0](this._q[0], inputs[0][0][i], this._mems[0]);
        let sig1 = this.signals[1](this._q[1], inputs[0][0][i], this._mems[1]);
        let xf = this.xfadeControl.play(i == 0 ? 1 : 0);
        let w = Module.maxiXFade.xfade(sig0, sig1, xf);


        //mono->stereo
        for (let channel = 0; channel < channelCount; channel++) {
          output[channel][i] = w;
        }

        //todo: deleteme
        // Module.maxiBits.toSignal(Module.maxiBits.fromSignal(-1));
        Module.maxiBits.fromSignal(-0.5);

      }


      // if (this.dt++ % 30 == 0) {
      //   console.log(this.bitclock);
      // }

      //remove old algo and data?
      let oldIdx = 1.0 - this.currentSignalFunction;
      if (this.xfadeControl.isLineComplete() && this._cleanup[oldIdx] == 0) {
        this.signals[oldIdx] = this.silence;
        //clean up object heap - we must do this because emscripten objects need manual memory management
        for(let obj in this._q[oldIdx]) {
          //if there a delete() function
          if (this._q[oldIdx][obj].delete != undefined) {
            //delete the emscripten object manually
            this._q[oldIdx][obj].delete();
          }
        }
        //create a blank new heap for the next livecode evaluation
        this._q[oldIdx] = this.newq();
        //signal that the cleanup is complete
        this._cleanup[oldIdx] = 1;

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
