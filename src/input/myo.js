
import Myo from 'myo/myo.js';

class myo {

  constructor() {
    this.myMyos = [];
    this.myoCount = 0;
    Myo.on('connected', myo => this.setupMyo(myo));
    Myo.on('emg', (myo, data) => this.onEMG(myo, data));
    // Myo.on('orientation', data => console.log(`quaternion W:${data.w} X:${data.x} Y:${data.y} Z:${data.z}`));
    Myo.onError = () => console.log("Couldn't connect to Myo Connect");
    
    Myo.connect('io.github.sema'); // NOTE:FB: Required format, otherwise connection error!
  }

  setupMyo (myo) {
    this.myMyos.push(myo);
    this.myoCount++; 
    Myo.methods.streamEMG(true);
  } 

  onEMG (myo, data) {
    console.log(`emg: ${data}`);
  }
};

export {
  myo
};