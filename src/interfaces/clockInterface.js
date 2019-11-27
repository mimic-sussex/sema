export class kuramotoNetClock {
  constructor(onPhaseUpdate) {
    this.isConnected = false;
    this.id = -1;

    this.socket = new WebSocket('ws://localhost:8089');

    this.socket.addEventListener('open', function(event) {
      console.log("Kura Clock websocket open");
      this.clock.isConnected = true;
      this.clock.socket.send("hello from sema");
      //get an id number
      // this.clock.socket.send(JSON.stringify({
      //   "c": "i"
      // }));
    }.bind({
      clock: this
    }));

    this.socket.addEventListener('close', function(event) {
      console.log("Kura Clock websocket closed");
      this.clock.isConnected = false;
    }.bind({
      clock: this
    }));

    this.peerQueryResponseFunction = null;
    this.socket.addEventListener('message', function(event) {
      console.log('Message from server ', event.data);
      try {
        let response = JSON.parse(event.data);
        switch (response.r) {
          // case "i":
          //   this.clock.id = response.n;
          //   console.log("Clock id: " + this.clock.id)
          //   //have an id, now start pinging
          //   this.clock.ping(this.clock);
          //   break;
          case "p":
            this.clock.peerQueryResponseFunction(response.n);
            break;
          case "o":
            // console.log("received phase data")
            onPhaseUpdate(response.v, response.i);
            break;
        }
      } catch (e) {
        console.log("Clock message error: " + e);
      }
    }.bind({
      clock: this
    }));

  };

  queryPeers(responseFunction) {
    this.peerQueryResponseFunction = responseFunction;
    this.socket.send(JSON.stringify({
      "c": "q"
    }));
  }

  connected() {
    return this.isConnected;
  }

  // ping() {
  //   //ping every second
  //   if (this.isConnected) {
  //     this.socket.send(JSON.stringify({
  //       "c": "h",
  //       "i": this.id
  //     }));
  //     console.log("ping");
  //     setTimeout(this.ping.bind({
  //       isConnected: this.isConnected,
  //       ping: this.ping,
  //       socket: this.socket,
  //       id: this.id
  //     }), 1000);
  //   }
  // }

  broadcastPhase(phase) {
    if (this.isConnected) {
      this.socket.send(JSON.stringify({
        "c": "o",
        "p": phase,
        "i": this.id
      }));
    }
  }

};
