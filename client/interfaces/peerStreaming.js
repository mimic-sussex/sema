import "./libs/peer.min.js";

class PeerStreaming {
  constructor() {
    this.connections = {};
    this.peer = new Peer({
      key: 'lwjd5qra8257b9'
    });
    this.peer.on('open', function(id) {
      console.log('My peer ID is: ' + id);
    });
  }

  send(destination, value) {
    console.log(value);
    if (!this.connections.destination) {
      this.connections.destination = this.peer.connect(destination);
    }else{
      this.connections.destination.send(value);
    }
  }

};

export {
  PeerStreaming
}
