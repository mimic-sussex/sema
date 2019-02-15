import MaxiLib from './maxiLib';

// export default const MaxiLibEngine = function () {
//     "use strict";
//     if (MaxiLibEngine._instance) {
//         //this allows the constructor to be called multiple times
//         //and refer to the same instance. Another option is to
//         //throw an error.
//         return MaxiLibEngine._instance;
//     }
//     MaxiLibEngine._instance = this;
//     //Foo initialization code
//
//     var maxiLib = window.MaxiLib();
//     var audio = new maxiLib.maxiAudio();
//     var timer = new maximJs.maxiOsc(); //this is the metronome
//     var currentCount, lastCount; //these values are used to check if we have a new beat this sample
//     var mix;
//     var monosynthLoaded;
//
//     audio.init();
//
//
//     loadSamples();
// };

// MaxiLibEngine.getInstance = function () {
//     "use strict";
//     return MaxiLibEngine._instance || new MaxiLibEngine();
// }


export default class MaxiLibEngine {

  constructor() {

    var maxiLib = window.MaxiLib();
    var audio = new maxiLib.maxiAudio();

    var timer = new maximJs.maxiOsc(); //this is the metronome
    var currentCount, lastCount; //these values are used to check if we have a new beat this sample

    var mix;

    var monosynthLoaded;

    audio.init();

    loadSamples();
  }

  function loadSamples() {
    audio.loadSample("909b.wav", kick);
    audio.loadSample("909.wav", snare);
    audio.loadSample("909closed.wav", closedHat);
    audio.loadSample("909open.wav", openHat);
  }

  // Method
  function interpret(lang) {
    console.log(lang);
  }


  function play() {

    audio.play = function() {
      //so this first bit is just a basic metronome so we can hear what we're doing.
      now = Math.round(timer.phasor(8)); //this sets up a metronome that ticks every 2 seconds

      if (oldClock != now) { //if we have a new timer int this sample, play the sound

        Monosynth.trigger(); //trigger the envelope from the start

        // console.log("tick\n");//the clock ticks

        oldClock = 0; //set lastCount to 0
      }

      mix = 0.0;

      //and this is where we build the synth

      if (monosynthLoaded)
        mix+=Monosynth.play();

      this.output = mix;
    }
  }

  function Monosynth(a = 1000, d = 1, s = 1, r = 1000) {

    this.VCO1 = new maximJs.maxiOsc();
    this.VCO2 = new maximJs.maxiOsc();
    this.LFO1 = new maximJs.maxiOsc();
    this.LFO2 = new maximJs.maxiOsc();
    this.VCF = new maximJs.maxiFilter();
    this.ADSR = new maximJs.maxiEnv();

    this.VCO1out = null;
    this.VCO2out = null;
    this.LFO1out = null;
    this.LFO2out = null;
    this.VCFout = null;
    this.ADSRout = null;

    this.ADSR.setAttack(a);
    this.ADSR.setDecay(d);
    this.ADSR.setSustain(s);
    this.ADSR.setRelease(r);
  }

  Monosynth.prototype.trigger = function (){
    this.ADSR.trigger = 1;
  }

  Monosynth.prototype.play = function () {
    this.ADSRout = this.ADSR.adsr(1.0, this.ADSR.trigger);
    this.LFO1out = this.LFO1.sinebuf(0.2); //this lfo is a sinewave at 0.2 hz
    this.VCO1out = this.VCO1.pulse(55, 0.6); //here's VCO1. it's a pulse wave at 55 hz, with a pulse width of 0.6
    this.VCO2out = this.VCO2.pulse(110 + this.LFO1out, 0.2); //here's VCO2. it's a pulse wave at 110hz with LFO modulation on the frequency, and width of 0.2
    this.VCFout = this.VCF.lores((this.VCO1out + this.VCO2out) * 0.5, this.ADSRout * 10000, 10); //now we stick the VCO's into the VCF, using the ADSR as the filter cutoff
    return this.VCFout * this.ADSRout; //finally we add the ADSR as an amplitude modulator
  }
}
