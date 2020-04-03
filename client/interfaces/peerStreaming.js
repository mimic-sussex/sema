import "./libs/peer.min.js";
import {
  PubSub
} from "../messaging/pubSub.js";

class PeerStreaming {

  constructor() {
    this.connections = {};
    this.messaging = new PubSub();
    //use peerJD cloud server for now
    this.peer = new Peer({
      key: 'lwjd5qra8257b9',
      debug: 2
    });
    //open a listener
    this.peer.on('open', function(id) {
      console.log('My peer ID is: ' + id);
    });
    //listenen for connections
    this.peer.on('connection', function(conn) {
      console.log('Connection received', conn);
      console.log(this);
      //on connection, create a handler for incoming data
      conn.on('data', ((e) => {
          console.log('received',e);
          this.messaging.publish("peermsg", {ch:e[0],val:e[1],src:conn.peer});
      }).bind(this));
    }.bind(this));
  }

  send(destination, value, channel) {
    if (!this.connections.destination) {
      this.connections.destination = this.peer.connect(destination);
      this.connections.destination.on('open', () => {
        console.log('connection opened', destination);
      });
    }else{
      // console.log(this.connections.destination);
      if (this.connections.destination.open) {
        console.log('sending', destination, value)
        this.connections.destination.send([channel, value]);
      }
    }
  }

  receive(sender, channel) {
    return 0;
  }

};

export {
  PeerStreaming
}
