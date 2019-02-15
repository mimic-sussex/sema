
// var MaxiLibEngine = function () {
//
//   if (arguments.callee._singletonInstance) {
//     return arguments.callee._singletonInstance;
//   }
//
//   arguments.callee._singletonInstance = this;
//
//   this.Interpret = function (line) {
//     console.log(line);
//   };
// }
//
// if (typeof module === "object" && module.exports) {
//   module.exports = MaxiLibEngine;
// };

import MaxiLib from './maxiLib';

export default class MaxiLibEngine {

  constructor() {

    var maxiLib = window.MaxiLib();
    var audio = new maxiLib.maxiAudio();

    var timer = new maximJs.maxiOsc(); //this is the metronome
    var currentCount, lastCount; //these values are used to check if we have a new beat this sample

    var
    var monosynthLoaded;

    var mix;

    audio.init();

    loadSamples();

  }



  function loadSamples(){
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

    audio.play = function(){
    	//so this first bit is just a basic metronome so we can hear what we're doing.
    	currentCount=Math.round(timer.phasor(8));//this sets up a metronome that ticks every 2 seconds

    	if (lastCount!=currentCount) {//if we have a new timer int this sample, play the sound

    		ADSR.trigger = 1;//trigger the envelope from the start

    		// console.log("tick\n");//the clock ticks

    		lastCount=0;//set lastCount to 0
    	}

    	 //and this is where we build the synth

        if(monosynthLoaded)
          playMonosynth();

        this.output = mix;
    }
  }

  function loadMonosynth(a=1000, d=1 , s=1, r=1000){

    var VCO1 = new maximJs.maxiOsc();
    var VCO2 = new maximJs.maxiOsc();
    var LFO1 = new maximJs.maxiOsc();
    var LFO2 = new maximJs.maxiOsc();

    var VCF = new maximJs.maxiFilter();
    var ADSR = new maximJs.maxiEnv();

    var VCO1out, VCO2out, LFO1out, LFO2out, VCFout, ADSRout;

    ADSR.setAttack(a);
    ADSR.setDecay(d);
    ADSR.setSustain(s);
    ADSR.setRelease(r);

    monosynthLoaded = true;
  }

  function playMonosynth(){

    ADSR.trigger=1;
    ADSRout=ADSR.adsr(1.0,ADSR.trigger);

    LFO1out=LFO1.sinebuf(0.2);//this lfo is a sinewave at 0.2 hz

    VCO1out=VCO1.pulse(55,0.6);//here's VCO1. it's a pulse wave at 55 hz, with a pulse width of 0.6
    VCO2out=VCO2.pulse(110+LFO1out,0.2);//here's VCO2. it's a pulse wave at 110hz with LFO modulation on the frequency, and width of 0.2

    VCFout=VCF.lores((VCO1out+VCO2out)*0.5, ADSRout*10000, 10);//now we stick the VCO's into the VCF, using the ADSR as the filter cutoff

    mix=VCFout*ADSRout;//finally we add the ADSR as an amplitude modulator

    // ADSR.trigger=0;
  }



}
