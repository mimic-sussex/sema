import * as osc from "osc/dist/osc-browser";

// set up OSC

class oscInterface {
	constructor() {
		// this.oscResponderFunction = (msg)=>{
		//   console.log("OSC message:", msg);
		// };

		this.port = new osc.WebSocketPort({
			url: "ws://localhost:8081"
		});
		// this.port.on("message", this.oscResponderFunction);
	}

	connect() {
		this.port.open();
	}

	OSCResponder(newFunc) {
		this.oscResponderFunction = newFunc;
		this.port.on("message", this.oscResponderFunction);
	}
}

const oscIO = new oscInterface();
// oscIO.connect();
// var sayHello = function () {
//     port.send({
//         address: "/hello",
//         args: ["world"]
//     });
// };
// sayHello();

export default oscIO;
