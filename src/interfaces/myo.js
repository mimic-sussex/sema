class myo {

  constructor() {
    // this.oscResponderFunction = (msg)=>{
    //   console.log("OSC message:", msg);
    // };

    this.port = new osc.WebSocketPort({
        url: "ws://localhost:8081"
    });
    // this.port.on("message", this.oscResponderFunction);
    this.port.open();
  }

  OSCResponder(newFunc) {
    this.oscResponderFunction = newFunc;
    this.port.on("message", this.oscResponderFunction);
  }


};