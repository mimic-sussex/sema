import Leap from 'leapjs/leap-0.6.4.js';

class leapMotion {

  constructor() {
    
    this.options = {
      host: '127.0.0.1',
      port: 6437,
      enableGestures: false,
      background: false,
      optimizeHMD: false,
      frameEventName: 'animationFrame',
      useAllPlugins: false
    }


    Leap.loop(function(frame){
      console.log(frame.hands.length);
    });

    // this.controller = new Leap.Controller();
    // this.controller = new Leap.Controller(options);
    // controller.connect();
  }

  connect(){
    // this.leapController = Leap.loopController();

     
    // Leap.loop({
    //   // frame callback is run before individual frame components
    //   frame: function(frame){
    //     console.log(frame);
    //   },
    // });


    // Leap.loop({})
    // .use('playback', {
    //   requiredProtocolVersion: 6,
    //   pauseOnHand: true,
    //   loop: true
    // });
    // this.leapController = Leap.loop();

    // this.leapController(options);

    this.leapController.on('deviceAttached', function() {
      console.log('DEBUG:LeapMotion: deviceAttached');
    });
    this.leapController.on('deviceStreaming', function() {
      console.log('DEBUG:LeapMotion: deviceStreaming');
    });
    this.leapController.on('deviceStopped', function() {
      console.log('DEBUG:LeapMotion: deviceStopped');
    });
    this.leapController.on('deviceRemoved', function() {
      console.log('DEBUG:LeapMotion: deviceRemoved');
    });
  
    this.leapController.on('frame', this.onFrame);
  }

  onFrame(frame){
    console.log('DEBUG:LeapMotion: ' + frame);
  }


  OSCResponder(newFunc) {
    this.oscResponderFunction = newFunc;
    this.port.on("message", this.oscResponderFunction);
  }

};

export {
  leapMotion
};