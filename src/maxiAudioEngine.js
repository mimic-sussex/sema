import MaxiLib from './maxiLib';


class MaxiLibEngine1 {

  constructor(type){
    // DEBUG:
    console.log("MaxiLibEngine1 loading...");


    //Initialization code
    this.maxiLib = MaxiLib();

    console.log("MaxiLibEngine1 loaded");

    this.audio = new this.maxiLib.maxiAudio();
    this.timer = new this.maxiLib.maxiOsc(); //this is the metronome
    let currentCount = 0;
    let lastCount = 0; //these values are used to check if we have a new beat this sample
    let mix = 0.0;
    let monosynthLoaded = false;
    this.mySine = new this.maxiLib.maxiOsc();

    // audio.init();
    // console.log("MaxiLibEngine loaded");
    //
    // audio.play = function() {
    //   // direct value to output
    //   this.output = mySine.sinewave(440);
    // }
    // DEBUG:

  }

  init() {
    this.audio.init();
    this.audio.play = function() {
      // direct value to output
      this.output = this.mySine.sinewave(440);
    }
  }

  loadSamples() {
    //TODO:1 – bundle files with webpack and load them
    //TODO:2 – refactor to receive json descrition and load files dynamically
    // audio.loadSample("./assets/909b.wav", kick);
    // audio.loadSample("./assets/909.wav", snare);
    // audio.loadSample("./assets/909closed.wav", closedHat);
    // audio.loadSample("./assets/909open.wav", openHat);
  }

}



var MaxiLibEngine2 = function() {

  // "use strict";
  // if (MaxiLibEngine._instance) {
  //   //this allows the constructor to be called multiple times
  //   //and refer to the same instance. Another option is to
  //   //throw an error.
  //   return MaxiLibEngine._instance;
  // }
  // MaxiLibEngine._instance = this;
  console.log("MaxiLibEngine loading...");
  //Initialization code
  let maxiLib = MaxiLib();
  let audio = new maxiLib.maxiAudio();
  let timer = new maxiLib.maxiOsc(); //this is the metronome
  let currentCount = 0;
  let lastCount = 0; //these values are used to check if we have a new beat this sample
  let mix = 0.0;
  let monosynthLoaded = false;

  let mySine = new maxiLib.maxiOsc();

  console.log("MaxiLibEngine loaded");

  init = function(){
    audio.init();
    audio.play = function() {
      // direct value to output
      this.output = mySine.sinewave(440);
    }
  }

  loadSamples = function() {
    //TODO:1 – bundle files with webpack and load them
    //TODO:2 – refactor to receive json descrition and load files dynamically
    // audio.loadSample("./assets/909b.wav", kick);
    // audio.loadSample("./assets/909.wav", snare);
    // audio.loadSample("./assets/909closed.wav", closedHat);
    // audio.loadSample("./assets/909open.wav", openHat);
  };


};

// MaxiLibEngine.getInstance = function() {
//   "use strict";
//   return MaxiLibEngine._instance || new MaxiLibEngine();
// }


MaxiLibEngine2.prototype.helloMaxi = function () {
  let maxiLib = MaxiLib();
  let audio = new maxiLib.maxiAudio();
  // initialise audio
  audio.init();

  // create oscillator
  var mySine = new maxiLib.maxiOsc();

  audio.play = function() {
    // direct value to output
    this.output = mySine.sinewave(440);

  }
};

// MaxiLibEngine.prototype.init = function() {
//   // audio.init();
//   console.log("audio initialised");
//   // loadSamples();
//   console.log("samples loaded");
// };


// MaxiLibEngine.prototype.loadSamples = function() {
//   //TODO refactor to receive json descrition and load files dynamically
//   audio.loadSample("./assets/909b.wav", kick);
//   audio.loadSample("./assets/909.wav", snare);
//   audio.loadSample("./assets/909closed.wav", closedHat);
//   audio.loadSample("./assets/909open.wav", openHat);
// };

MaxiLibEngine2.prototype.interpret = function(lang) {
  console.log("lang: " + lang);
};

MaxiLibEngine2.prototype.play = function() {

  audio.play = function() {
    //so this first bit is just a basic metronome so we can hear what we're doing.
    now = Math.round(timer.phasor(0.5)); //this sets up a metronome that ticks every 2 seconds

    if (oldClock != now) { //if we have a new timer int this sample, play the sound

      Monosynth.trigger(); //trigger the envelope from the start

      // console.log("tick\n");//the clock ticks

      oldClock = 0; //set lastCount to 0
    }

    mix = 0.0;

    //and this is where we build the synth

    if (monosynthLoaded)
      mix += Monosynth.play();

    this.output = mix;
  }
};






function Monosynth(a = 1000, d = 1, s = 1, r = 1000) {

  this.VCO1 = new maxiLib.maxiOsc();
  this.VCO2 = new maxiLib.maxiOsc();
  this.LFO1 = new maxiLib.maxiOsc();
  this.LFO2 = new maxiLib.maxiOsc();
  this.VCF = new maxiLib.maxiFilter();
  this.ADSR = new maxiLib.maxiEnv();

  this.VCO1out = this.VCO2out = this.LFO1out = this.LFO2out = this.VCFout = this.ADSRout = null;

  this.ADSR.setAttack(a);
  this.ADSR.setDecay(d);
  this.ADSR.setSustain(s);
  this.ADSR.setRelease(r);
};

Monosynth.prototype.trigger = function() {
  this.ADSR.trigger = 1;
};

Monosynth.prototype.play = function() {
  this.ADSRout = this.ADSR.adsr(1.0, this.ADSR.trigger);
  this.LFO1out = this.LFO1.sinebuf(0.2); //this lfo is a sinewave at 0.2 hz
  this.VCO1out = this.VCO1.pulse(55, 0.6); //here's VCO1. it's a pulse wave at 55 hz, with a pulse width of 0.6
  this.VCO2out = this.VCO2.pulse(110 + this.LFO1out, 0.2); //here's VCO2. it's a pulse wave at 110hz with LFO modulation on the frequency, and width of 0.2
  this.VCFout = this.VCF.lores((this.VCO1out + this.VCO2out) * 0.5, this.ADSRout * 10000, 10); //now we stick the VCO's into the VCF, using the ADSR as the filter cutoff
  return this.VCFout * this.ADSRout; //finally we add the ADSR as an amplitude modulator
};


export {
  MaxiLibEngine1,
  MaxiLibEngine2,
  Monosynth
};
