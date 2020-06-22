import Maximilian from './maximilian.wasmmodule.js';
import RingBuffer from "./ringbuf.js"; //thanks padenot
import Open303 from './open303.wasmmodule.js';


// import {PostMsgTransducer} from './transducer.js'
// import {
//   MMLLOnsetDetector
// } from '../machineListening/MMLLOnsetDetector.js';
//


//DEPRECATED
class OutputTransducer {
  constructor(port, sampleRate, sendFrequency = 2, transducerType) {
    if (sendFrequency == 0)
      this.sendPeriod = Number.MAX_SAFE_INTEGER;
    else
      this.sendPeriod = 1.0 / sendFrequency * sampleRate;
    this.sendCounter = this.sendPeriod;
    this.transducerType = transducerType;
    this.port = port;
  }

  send(data, channelID) {
    if (this.sendCounter >= this.sendPeriod) {
      // console.log(data);
      this.port.postMessage({
        rq: "send",
        value: data,
        ttype: this.transducerType,
        ch: channelID
      });
      this.sendCounter -= this.sendPeriod;
    } else {
      this.sendCounter++;
    }
    return 0;
  }
}

//DEPRECATED
class InputTransducer {
  constructor(transducerType, channelID) {
    this.transducerType = transducerType;
    this.channelID = channelID;
    this.value = 0;
  }

  setValue(data) {
    this.value = data;
    console.log(data);
  }

  getValue() {
    return this.value;
  }
}




// class pvshift {
//   constructor() {
//     this.fft = new Maximilian.maxiFFT();
//     this.fft.setup(1024, 256, 1024);
//     this.ifft = new Maximilian.maxiIFFT();
//     this.ifft.setup(1024, 256, 1024);
//     this.mags = new Maximilian.VectorFloat();
//     this.phases = new Maximilian.VectorFloat();
//     this.mags.resize(512, 0);
//     this.phases.resize(512, 0);
//   }
//
//   play(sig, shift) {
//     if (this.fft.process(sig, Maximilian.maxiFFTModes.WITH_POLAR_CONVERSION)) {
//       this.mags = this.fft.getMagnitudes();
//       this.phases = this.fft.getPhases();
//       //shift bins up
//       for (let i = 511; i > 0; i--) {
//         if (i > shift) {
//           this.mags.set(i, this.mags.get(i - shift));
//           this.phases.set(i, this.phases.get(i - shift));
//         } else {
//           this.mags.set(i, 0);
//           this.phases.set(i, 0);
//         }
//       }
//     }
//     sig = this.ifft.process(this.mags, this.phases, Maximilian.maxiIFFTModes.SPECTRUM);
//     return sig;
//   }
// }

class fft {
  constructor(bins, hopPercentage) {
    this.fft = new Maximilian.maxiFFTAdaptor();
    this.fft.setup(bins*2, Math.floor(bins*2*hopPercentage), bins*2);
    this.mags = this.fft.getMagnitudesAsJSArray();
    this.phases = this.fft.getPhasesAsJSArray();
  }
  play(sig) {
    let newVal = 0;
    if (this.fft.process(sig, Maximilian.maxiFFTModes.WITH_POLAR_CONVERSION)) {
      newVal = 1;
      this.mags = this.fft.getMagnitudesAsJSArray();
      this.phases = this.fft.getPhasesAsJSArray();
    }
    let res = [newVal, this.mags, this.phases];
    return res;
  }
}

class ifft {
  constructor(bins, hopPercentage) {
    this.ifft = new Maximilian.maxiIFFTAdaptor();
    this.ifft.setup(bins*2, Math.floor(bins*2*hopPercentage), bins*2);
  }
  play(trig, mags, phases) {
    return this.ifft.process(trig, mags, phases, Maximilian.maxiIFFTModes.SPECTRUM);
  }
}

class mfcc {
  constructor(fftsize, hopsize, numCoeffs) {
    this.fft = new Maximilian.maxiFFTAdaptor();
    this.fft.setup(fftsize, hopsize, fftsize);
    this.mfcc = new Maximilian.maxiMFCCAdaptor();
    this.mfcc.setup(fftsize / 2, 40, numCoeffs, 20, 20000);
    this.coeffs = new Float64Array(numCoeffs);
  }

  play(sig) {
    let newVal = 0;
    if (this.fft.process(sig, Maximilian.maxiFFTModes.WITH_POLAR_CONVERSION)) {
      newVal = 1;
      this.coeffs = this.mfcc.mfcc(this.fft.getMagnitudesAsJSArray());
    }
    return [newVal, this.coeffs];
  }
}

var inputSABs = {};
var outputSABs = {};

class SABOutputTransducer {
  constructor(port, bufferType, channel, now, blocksize) {
    this.port = port;
    this.zx = new Maximilian.maxiTrigger();
    this.channel = channel;
    this.blocksize = blocksize;

    //check for existing channels
    if (channel in outputSABs && outputSABs[channel].blocksize == blocksize) {
      //reuse existing
      this.ringbuf = outputSABs[channel].rb;
    }else{
      //create a new SAB and notify the receiver
      this.sab = RingBuffer.getStorageForCapacity(32 * blocksize, Float64Array);
      this.ringbuf = new RingBuffer(this.sab, Float64Array);
      outputSABs[channel] = {rb:this.ringbuf, sab:this.sab, created:now, blocksize:blocksize};

      this.port.postMessage({
        rq: 'buf',
        value: this.sab,
        ttype: bufferType,
        channelID: channel,
        blocksize:blocksize
      });
    }
  }

  send(trig, value) {
    if (this.zx.onZX(trig)) {
      // console.log("tr", this.ringbuf.available_write(), value, this);
      if (this.ringbuf.available_write() > this.blocksize) {
        if (typeof(value) == "number") {
          this.ringbuf.push(new Float64Array([value]));
        }else{
          // console.log("SAB", value.length, this.blocksize);
          if (value.length == this.blocksize) {
            this.ringbuf.push(value);
          }else if (value.length < this.blocksize) {
            let newVal = new Float64Array(this.blocksize);
            for(let i in value) newVal[i] = value[i];
            this.ringbuf.push(newVal);
          }else{
            this.ringbuf.push(value.slice(0,this.blocksize));
          }
        }
        // console.log('val written', value);
      }
    }
  }
}


class poll {
  constructor() {
    this.clock = new Maximilian.maxiOsc();
  }

  play(val) {
    if (this.clock.impulse(0.5)) {
      console.log(val);
    }
  }
};

/**
 * The main Maxi Audio wrapper with a WASM-powered AudioWorkletProcessor.
 *
 * @class MaxiProcessor
 * @extends AudioWorkletProcessor
 */
class MaxiProcessor extends AudioWorkletProcessor {

  /**
   * @constructor
   */
  constructor() {
    super();
    // console.log("TEST", Maximilian.maxiMap.linlin(0.5,0,1,10,50));
    // let temp = new Maximilian.maxiNonlinearity();
    // console.log("TEST2", temp.asymclip(0.9,3,3));


    let q1 = Maximilian.maxiBits.sig(63);

    // this.sampleRate = 44100;
    console.log("SAMPLERATE", sampleRate);
    //indicate audio settings in WASM and JS domains
    // console.log();
    Maximilian.maxiSettings.setup(sampleRate, 1, 512);
    Maximilian.maxiJSSettings.setup(sampleRate, 1, 512);

    //we don't know the number of channels at this stage, so reserve lots for the DAC
    this.DAC = [];
    this.DACChannelsInitalised = false;

    this.tempo = 120.0; // tempo (in beats per minute);
    this.secondsPerBeat = (60.0 / this.tempo);
    this.counterTimeValue = (this.secondsPerBeat / 4); //___16th note

    // this.oldClock = 0;
    // this.phase = 0;

    this.numPeers = 1;

    // this.maxiAudio = new Maximilian.maxiAudio();
    this.clock = new Maximilian.maxiOsc();
    // this.kick = new Maximilian.maxiSample();
    // this.snare = new Maximilian.maxiSample();
    // this.closed = new Maximilian.maxiSample();
    // this.open = new Maximilian.maxiSample();
    this.currentSample = 0;


    this.initialised = false;

    this.newq = () => {
      return {
        "vars": {}
      }
    };
    this.newmem = () => {
      return new Array(512)
    };
    this._q = [this.newq(), this.newq()];
    this._mems = [this.newmem(), this.newmem()];
    this._cleanup = [0, 0];

    // this.setvar = (q, name, val) => {
    //   q.vars[name] = val;
    //   return val;
    // };
    //
    // this.getvar = (q, name) => {
    //   let val = q.vars[name];
    //   return val ? val : 0.0;
    // };

    this.silence = (q, inputs) => {
      return 0.0
    };
    this.signals = [this.silence, this.silence];
    this.currentSignalFunction = 0;
    this.xfadeControl = new Maximilian.maxiLine();

    // this.timer = new Date();

    this.OSCMessages = {};

    this.OSCTransducer = function(x, idx = 0) {
      let val = this.OSCMessages[x];
      return val ? idx >= 0 ? val[idx] : val : 0.0;
    };

    this.incoming = {};

    this.sampleBuffers = {};
    this.sampleVectorBuffers = {};
    this.sampleVectorBuffers['defaultEmptyBuffer'] = new Float32Array(1);

    this.transducers = [];

    this.matchTransducers = (ttype, channel) => {
      return this.transducers.filter(x => {
        let testEqChannels = (chID, channel) => {
          let eq = true;
          let keys = Object.keys(channel);
          if (keys.length == 0) {
            eq = channel == chID;
          } else {
            for (let v in keys) {
              if (chID[v] != undefined) {
                if (chID[v] != channel[v]) {
                  eq = false;
                  break;
                }
              } else {
                eq = false;
                break;
              }
            }
          }
          return eq;
        }
        return x.transducerType == ttype && testEqChannels(x.channelID, channel);
      });
    }

    this.registerInputTransducer = (ttype, channelID) => {
      let transducer = new InputTransducer(ttype, channelID);
      let existingTransducers = this.matchTransducers(ttype, channelID);
      if (existingTransducers.length > 0) {
        transducer.setValue(existingTransducers[0].getValue());
      }
      this.transducers.push(transducer);
      // console.log(this.transducers);
      return transducer;
    };

    this.getSampleBuffer = (bufferName) => {
      let sample = this.sampleVectorBuffers['defaultEmptyBuffer']; //defailt - silence
      if (bufferName in this.sampleVectorBuffers) {
        sample = this.sampleVectorBuffers[bufferName];
      } else {
        console.warn(`${bufferName} doesn't exist yet`);
      }
      return sample;
    };

    this.netClock = new Maximilian.maxiAsyncKuramotoOscillator(3); //TODO: this should be the same as numpeers
    this.kuraPhase = -1;
    this.kuraPhaseIdx = 1;

    let addSampleBuffer = (name, buf) => {
      this.sampleVectorBuffers[name] = this.translateFloat32ArrayToBuffer(buf);
    };

    this.codeSwapStates = {
      QUEUD: 0,
      XFADING: 1,
      NONE: 2
    };
    this.codeSwapState = this.codeSwapStates.NONE;

    this.port.onmessage = event => { // message port async handler
      // console.log(event);
      if ('address' in event.data) {
        //this must be an OSC message
        this.OSCMessages[event.data.address] = event.data.args;
        //console.log(this.OSCMessages);
      } else if ('func' in event.data && 'sendbuf' == event.data.func) {
        console.log("aesendbuf", event.data);
        addSampleBuffer(event.data.name, event.data.data);
      } else if ('func' in event.data && 'data' == event.data.func) {
        // console.log('ML', event.data);
        //this is from the ML window, map it on to any listening transducers
        let targetTransducers = this.matchTransducers('ML', event.data.ch);
        for (let idx in targetTransducers) {
          targetTransducers[idx].setValue(event.data.val);
        }
      } else if ('func' in event.data && 'sab' == event.data.func) {
        console.log("buf received", event.data);
        let sab = event.data.value;
        let rb =  new RingBuffer(sab, Float64Array);
        inputSABs[event.data.channelID] = {sab:sab, rb:rb, blocksize: event.data.blocksize, value: event.data.blocksize > 1 ? new Float64Array(event.data.blocksize) : 0};
      } else if ('peermsg' in event.data) {
        console.log('peer', event);
        //this is from peer streaming, map it on to any listening transducers
        let targetTransducers = this.matchTransducers('NET', [event.data.src, event.data.ch]);
        // console.log(targetTransducers.length);
        for (let idx in targetTransducers) {
          targetTransducers[idx].setValue(event.data.val);
        }
      } else if ('sample' in event.data) { //from a worker
        // console.log("sample received");
        // console.log(event.data);
        let sampleKey = event.data.sample.substr(0, event.data.sample.length - 4)
        // this.sampleBuffers[sampleKey] = event.data.buffer;
        addSampleBuffer(sampleKey, event.data.buffer);
        // this.sampleVectorBuffers[sampleKey] = this.translateFloat32ArrayToBuffer(event.data.buffer);
      } else if ('phase' in event.data) {
        // console.log(this.kuraPhaseIdx);
        // console.log(event);
        this.netClock.setPhase(event.data.phase, event.data.i);
        // this.kuraPhase = event.data.phase;
        // this.kuraPhaseIdx = event.data.i;
      } else if ('eval' in event.data) { // check if new code is being sent for evaluation?

        let setupFunction;
        let loopFunction;
        try {
          setupFunction = eval(event.data['setup']);
          loopFunction = eval(event.data['loop']);

          this.nextSignalFunction = 1 - this.currentSignalFunction;
          this._q[this.nextSignalFunction] = setupFunction();
          //allow feedback between evals
          this._mems[this.nextSignalFunction] = this._mems[this.currentSignalFunction];
          // output[SPECTROGAMCHANNEL][i] = specgramValue;
          // then use channelsplitter
          this.signals[this.nextSignalFunction] = loopFunction;
          this._cleanup[this.nextSignalFunction] = 0;

          let xfadeBegin = Maximilian.maxiMap.linlin(1.0 - this.nextSignalFunction, 0, 1, -1, 1);
          let xfadeEnd = Maximilian.maxiMap.linlin(this.nextSignalFunction, 0, 1, -1, 1);
          this.xfadeControl.prepare(xfadeBegin, xfadeEnd, 2, true); // short xfade across signals
          this.xfadeControl.triggerEnable(true); //enable the trigger straight away
          this.codeSwapState = this.codeSwapStates.QUEUD;
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

    // this.clockFreq = 0.7 / 4;
    this.clockPhaseSharingInterval = 0; //counter for emiting clock phase over the network
    // this.barFrequency = 4;
    // this.setBarFrequency = (freq) => {this.barFrequency = freq; return 0;};

    this.bpm = 120;
    this.beatsPerBar = 4;
    this.maxTimeLength = sampleRate * 60 * 60 * 24; //24 hours

    this.clockUpdate = () => {
      this.beatLengthInSamples = 60 / this.bpm * sampleRate;
      this.barPhaseMultiplier = this.maxTimeLength / this.beatLengthInSamples / this.beatsPerBar;
      console.log("CLOCK: ", this.barPhaseMultiplier, this.maxTimeLength);
    };

    this.setBPM = (bpm) => {
      if (this.bpm != bpm) {
        this.bpm = bpm;
        this.clockUpdate();
      }
      return 0;
    };

    this.setBeatsPerBar = (bpb) => {
      if (this.bearsPerBar != bpb) {
        this.bearsPerBar = bpb;
        this.clockUpdate();
      }
      return 0;
    };

    this.clockUpdate();

    //@CLP
    //phasor over one bar length
    this.clockPhase = (multiples, phase) => {
      return (((this.clockPhasor * this.barPhaseMultiplier * multiples) % 1.0) + phase) % 1.0;
    };

    //@CLT
    this.clockTrig = (multiples, phase) => {
      return (this.clockPhase(multiples, phase) - (1.0 / sampleRate * multiples)) <= 0 ? 1 : 0;
    };

    this.bitTime = Maximilian.maxiBits.sig(0); //this needs to be decoupled from the audio engine? or not... maybe a 'permenant block' with each grammar?
    this.dt = 0;

    this.createMLOutputTransducer = (sendFrequency) => {
      return new OutputTransducer(this.port, sampleRate, sendFrequency, 'ML');
    }

    this.createNetOutputTransducer = (sendFrequency) => {
      return new OutputTransducer(this.port, sampleRate, sendFrequency, 'NET');
    }

    this.dacOut = (x, ch) => {
      if (ch >= this.DAC.length) {
        ch = this.DAC.length - 1;
      } else if (ch < 0) {
        ch = 0;
      }
      this.DAC[ch] = x;
      return x;
    }

    this.dacOutAll = (x) => {
      for (let i = 0; i < this.DAC.length; i++) {
        this.DAC[i] = x;
      }
      return x;
    }

    this.updateSABInputs = (id) => {
      for (let v in inputSABs) {
        let avail = inputSABs[v].rb.available_read();
        // console.log(avail, SABs[v].rb.capacity);
        if (avail != inputSABs[v].rb.capacity && avail > 0) {
            for (let i=0; i < avail; i+=inputSABs[v].blocksize) {
              let val = new Float64Array(inputSABs[v].blocksize);
              inputSABs[v].rb.pop(val);
              inputSABs[v].value = val.length ==1 ? val[0] : val;
            }
        }
      }
    }

    this.getSABValue = (id) => {
      let res=0;
      let sab= inputSABs[id];
      if (sab) {
        res = sab.value;
      }
      return res;
    }


  }

  /**
   * @process
   */
  process(inputs, outputs, parameters) {
    if (!this.DACChannelsInitalised) {
      //first run - set up the output array
      for (let i = 0; i < outputs[0].length; i++) this.DAC[i] = 0.0;
      console.log('init DAC', outputs[0].length);
      Maximilian.maxiJSSettings.setup(sampleRate, outputs[0].length, 512);
      Maximilian.maxiSettings.setup(sampleRate, outputs[0].length, 512);

      this.DACChannelsInitalised = true;
    }

    const outputsLength = outputs.length;
    // console.log(outputsLength);
    for (let outputId = 0; outputId < outputsLength; ++outputId) {
      let output = outputs[outputId];
      let channelCount = output.length;

      for (let i = 0; i < output[0].length; ++i) {
        this.updateSABInputs();

        for (let channel = 0; channel < channelCount; channel++) {
          this.DAC[channel] = 0.0;
        }

        //this needs decoupling?
        this.bitTime = Maximilian.maxiBits.inc(this.bitTime);

        //leave this here - we'll bring it back in one day?
        //net clocks
        // if (this.kuraPhase != -1) {
        //   // this.netClock.setPhase(this.kuraPhase, this.kuraPhaseIdx);
        //   console.log(this.kuraPhaseIdx);
        //testing
        // this.netClock.setPhase(this.netClock.getPhase(0), 1);
        // this.netClock.setPhase(this.netClock.getPhase(0), 2);
        //   this.kuraPhase = -1;
        // }

        // this.netClock.play(this.clockFreq, 100);

        //this.clockPhasor = this.netClock.getPhase(0) / (2 * Math.PI);
        this.clockPhasor = (this.currentSample % this.maxTimeLength) / this.maxTimeLength;
        this.currentSample++;

        //share the clock if networked
        // if (this.netClock.size() > 1 && this.clockPhaseSharingInterval++ == 2000) {
        //   this.clockPhaseSharingInterval=0;
        //   let phase = this.netClock.getPhase(0);
        //   // console.log(`DEBUG:MaxiProcessor:phase: ${phase}`);
        //   this.port.postMessage({ phase: phase, c: "phase" });
        // }

        this.bitclock = Maximilian.maxiBits.sig(Math.floor(this.clockPhase(1, 0) * 1023.999999999));

        let w = 0;
        //new code waiting?
        let barTrig = this.clockTrig(1, 0);
        if (this.codeSwapState == this.codeSwapStates.QUEUD) {
          //fade in when a new bar happens
          if (barTrig) {
            this.codeSwapState = this.codeSwapStates.XFADING;
            this.currentSignalFunction = 1 - this.currentSignalFunction;
            console.log("xfade start", this.currentSignalFunction);
          }
        }
        if (this.codeSwapState == this.codeSwapStates.XFADING) {
          // let sig0 = this.signals[0](this._q[0], inputs[0][0][i], this._mems[0]);
          // let sig1 = this.signals[1](this._q[1], inputs[0][0][i], this._mems[1]);
          // // let xf = this.xfadeControl.play(i == 0 ? 1 : 0);
          // let xf = this.xfadeControl.play(barTrig);
          // // if (i==0) console.log(xf);
          // w = Maximilian.maxiXFade.xfade(sig0, sig1, xf);
          // if (this.xfadeControl.isLineComplete()) {
          //   this.codeSwapState = this.codeSwapStates.NONE;
          //   console.log("xfade complete", xf);
          // }
          try {
            this.signals[0](this._q[0], inputs[0][0][i], this._mems[0]);
            this.signals[1](this._q[1], inputs[0][0][i], this._mems[1]);
          } catch (err) {
            console.log("EVAL ERROR", err);
            console.log(this.currentSignalFunction);
            console.log(this._q[this.currentSignalFunction]);
            this.signals[this.currentSignalFunction] = (x,y,z) => {return 0};
          }
          // let xf = this.xfadeControl.play(i == 0 ? 1 : 0);
          // let xf = this.xfadeControl.play(barTrig);
          // if (i==0) console.log(xf);
          // w = Maximilian.maxiXFade.xfade(sig0, sig1, xf);
          // if (this.xfadeControl.isLineComplete()) {
          this.codeSwapState = this.codeSwapStates.NONE;
          // console.log("xfade complete", xf);
          // }
        } else {
          //no xfading - play as normal
          // w = this.signals[this.currentSignalFunction](this._q[this.currentSignalFunction], inputs[0][0][i], this._mems[this.currentSignalFunction]);
          try {

            this.signals[this.currentSignalFunction](this._q[this.currentSignalFunction], inputs[0][0][i], this._mems[this.currentSignalFunction]);
          } catch (err) {
            console.log("EVAL ERROR", err);
            console.log(this.currentSignalFunction);
            console.log(this._q[this.currentSignalFunction]);
            this.signals[this.currentSignalFunction] = (x,y,z) => {return 0};
          }
        }

        // let scope = this._mems[this.currentSignalFunction][":show"];
        // let scopeValue = scope !== undefined ? scope : output[channel][0];
        // output[1][i] = specgramValue;

        for (let channel = 0; channel < channelCount; channel++) {
          output[channel][i] = this.DAC[channel];
        }
      }

      //remove old algo and data?
      let oldIdx = 1.0 - this.currentSignalFunction;
      if (this.xfadeControl.isLineComplete() && this._cleanup[oldIdx] == 0) {
        this.signals[oldIdx] = this.silence;
        //clean up object heap - we must do this because emscripten objects need manual memory management
        for (let obj in this._q[oldIdx]) {
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

    }
    return true;
  }

  translateFloat32ArrayToBuffer(audioFloat32ArrayBuffer) {

    var maxiSampleBufferData = new Maximilian.VectorDouble();
    for (var i = 0; i < audioFloat32ArrayBuffer.length; i++) {
      maxiSampleBufferData.push_back(audioFloat32ArrayBuffer[i]);
    }
    return maxiSampleBufferData;
  }

};

registerProcessor("maxi-processor", MaxiProcessor);
