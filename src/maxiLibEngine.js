
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
    this.maxiAudio = new maximJs.maxiAudio()

    maxiAudio.init();
    maxiAudio.loadSample("909b.wav", kick);
    maxiAudio.loadSample("909.wav", snare);
    maxiAudio.loadSample("909closed.wav", closedHat);
    maxiAudio.loadSample("909open.wav", openHat);

  }

  // Method
  interpret(lang) {
    console.log(lang);
  }

  play() {
    console.log("play");
  }
}
