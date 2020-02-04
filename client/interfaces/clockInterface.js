import { PubSub } from "../messaging/pubSub.js";

export class kuramotoNetClock {
  constructor(onPhaseUpdate) {
    this.isConnected = false;
    this.id = -1;
    this.messaging = new PubSub();


    try {
      this.socket = new WebSocket('ws://localhost:8089');
    } catch (e) {
      console.log("No sema_ticks, running without netclock.")
    }

    this.socket.addEventListener('open', function(event) {
      console.log("Kura Clock websocket open");
      this.clock.isConnected = true;
      this.clock.socket.send("hello from sema");
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
            // console.log("received phase: " + response.v);
            // onPhaseUpdate(response.v, response.i);
            this.messaging("clock-phase", { phase: response.v, i: response.i } );
            break;
        }
      } catch (e) {
        console.log("Clock message error: " + e);
      }
    }.bind({
      clock: this
    }));

  };

  /*
  * What does 'c' and 'q' mean
  */
  queryPeers(responseFunction) {
    if (this.isConnected) {
      this.peerQueryResponseFunction = responseFunction;
      this.socket.send(JSON.stringify({
        "c": "q"
      }));
    }else{
      responseFunction(1);
    }
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


  /*
  * What does 'o' mean
  */
  broadcastPhase(phase) {
    if (this.isConnected) {
      // console.log(phase);
      this.socket.send(JSON.stringify({
        "c": "o",
        "phase": phase,
        // "i": this.id
      }));
    }
  }

};
