
// NOTE:FB We need this imports here for webpack to emit this modules from sema-engine package
import "sema-engine/dist/maximilian.wasmmodule.js";
import "sema-engine/dist/open303.wasmmodule.js";
import "sema-engine/dist/maxi-processor.js";
import "sema-engine/dist/ringbuf.js";

import { PubSub } from "../messaging/pubSub.js";
import { audioEngineStatus } from "../stores/common.js";
/**
 * The Controller is a singleton class that encapsulates signal engine (sema-engine)
 * and implements the dependency inversion principle
 * @class AudioEngine
 */
export default class Controller {
	/**
	 * @constructor
	 */
	constructor(engine) {
		if (Controller.instance) {
			return Controller.instance; // Singleton pattern, only one instance in sema
		}
		Controller.instance = this;



		// Constructor dependency injection of a sema-engine singleton instance
    // TODO make this type abstract on Typescript
		this.engine = engine;

    this.samplesLoaded = false;

		this.messaging = new PubSub();

		this.messaging.subscribe("eval-dsp", async e => {
      this.engine.eval(e); // This also resumes the engine p
    });

		this.messaging.subscribe("stop-audio", e =>
      this.engine.stop()
    );

		this.messaging.subscribe("load-sample", (name, url) =>
			this.engine.loadSample(name, url)
		);

		this.messaging.subscribe("add-engine-analyser", e =>
			this.engine.createAnalyser(e)
		);

		this.messaging.subscribe("remove-engine-analyser", e =>
			this.engine.removeAnalyser(e)
		);

		this.messaging.subscribe("model-output-data", e =>
			this.engine.postAsyncMessageToProcessor(e)
		);
		this.messaging.subscribe("clock-phase", e =>
			this.engine.postAsyncMessageToProcessor(e)
		);
		this.messaging.subscribe("model-send-buffer", e =>
			this.engine.postAsyncMessageToProcessor(e)
		);




		// this.messaging.subscribe("mouse-xy", (e) => {
		// 	if (this.sharedArrayBuffers.mxy) {
		// 		this.sharedArrayBuffers.mxy.rb.push(e);
		// 	}
		// });

		this.messaging.subscribe("osc", e =>
			console.log(`DEBUG:AudioEngine:OSC: ${e}`)
		);

		//the message has incoming data from other peers
		// this.messaging.subscribe("peermsg", (e) => {
		//   e.ttype = 'NET';
		//   e.peermsg = 1;
		//   this.onMessagingEventHandler(e);
		// });

		this.messaging.subscribe("peerinfo-request", (e) => {
			console.log(this.peerNet.peerID);
			copyToPasteBuffer(this.peerNet.peerID);
		});
	}

	/**
	 * Handler of audio worklet processor events
	 * @onProcessorMessageEventHandler
	 */
	onProcessorMessageEventHandler(event) {
		if (event != undefined && event.data != undefined) {
			// console.log("DEBUG:AudioEngine:processorMessageHandler:");
			// console.log(event);
			if (event.data === "giveMeSomeSamples") {
			} else if (event.data.phase != undefined) {
				// console.log('DEBUG:AudioEngine:phase:');
				// console.log(event.data.phase);
				this.kuraClock.broadcastPhase(event.data.phase); // TODO Refactor p to phase
			} else if (event.data.rq != undefined && event.data.rq === "send") {
				switch (event.data.ttype) {
					case "ML":
						// Stream generated by 'toJS' live code instruction — e.g. {10,0,{1}sin}toJS;
						// publishes to model/JS editor, which posts to ml.worker
						this.messaging.publish("model-input-data", {
							type: "model-input-data",
							value: event.data.value,
							ch: event.data.ch,
						});
						break;
					case "NET":
						this.peerNet.send(
							event.data.ch[0],
							event.data.value,
							event.data.ch[1]
						);
						break;
				}
			} else if (event.data.rq && event.data.rq === "buf") {
				console.log("buf", event.data);
				switch (event.data.ttype) {
					case "ML":
						this.messaging.publish("model-input-buffer", {
							type: "model-input-buffer",
							value: event.data.value,
							channelID: event.data.channelID, //channel ID
							blocksize: event.data.blocksize,
						});
						break;
				}
			}
			// else if (event.data.rq != undefined && event.data.rq === "receive") {
			//   switch (event.data.ttype) {
			//     case 'ML':
			//       // Stream generated by 'fromJS' live code instruction – e.g. {{10,1}fromJS}saw
			//       // publishes to model/JS editor, which posts to ml.worker
			//       this.messaging.publish("model-output-data-request", {
			//         type: "model-output-data-request",
			//         value: event.data.value,
			//         channel: event.data.ch
			//       });
			//       break;
			//     case 'NET':
			//       break;
			//   }
			// }
		}
	}

	/**
	 * Handler of the Pub/Sub message events
	 * whose topics are subscribed to in the audio engine constructor
	 * @onMessagingEventHandler
	 */
	onMessagingEventHandler(event) {
		if (event !== undefined) {
			// Receive notification from "model-output-data" topic
			console.log("DEBUG:AudioEngine:onMessagingEventHandler:");
			console.log(event);
			this.audioWorkletNode.port.postMessage(event);
		}
	}

	/**
	 * Initialises audio context and sets worklet processor code
	 * @play
	 */
	async init(audioWorkletURL /*numClockPeers*/) {
		if (this.engine !== undefined) {
      try {
				await this.engine.init(audioWorkletURL);

				this.loadImportedSamples();

				// Connect Analysers loaded from the store
				// need to pass callbacks after they load
        // this.engine.connectAnalysers();

				// No need to inject the callback here, messaging is built in KuraClock
				// this.kuraClock = new kuramotoNetClock((phase, idx) => {
				//   // console.log( `DEBUG:AudioEngine:sendPeersMyClockPhase:phase:${phase}:id:${idx}`);
				//   // This requires an initialised audio worklet
				//   this.audioWorkletNode.port.postMessage({ phase: phase, i: idx });
				// });

				//temporarily disabled
				// if (this.kuraClock.connected()) {
				// 	this.kuraClock.queryPeers(async numClockPeers => {
				// 		console.log(`DEBUG:AudioEngine:init:numClockPeers: ${numClockPeers}`);
				// 	});
				// }
			} catch (error) {
        console.error('Error initialising engine')
      }

		}
	}

	onAudioInputFail(error) {
		console.log(
			`DEBUG:AudioEngine:AudioInputFail: ${error.message} ${error.name}`
		);
	}

	/**
	 * Sets up an AudioIn WAAPI sub-graph
	 * @connectMediaStreamSourceInput
	 */
	async connectMediaStream() {
		const constraints = (window.constraints = {
			audio: true,
			video: false,
		});

		navigator.mediaDevices
			.getUserMedia(constraints)
			.then((s) => this.onAudioInputInit(s))
			.catch(this.onAudioInputFail);
	}

	getSamplesNames() {
		const r = require.context("../../assets/samples", false, /\.wav$/);

		// return an array list of filenames (with extension)
		const importAll = r => r.keys().map((file) => file.match(/[^\/]+$/)[0]);

		return importAll(r);
	}

	lazyLoadSample(sampleName) {
		import(/* webpackMode: "lazy" */ `../../assets/samples/${sampleName}`)
			.then( () =>
        this.engine.loadSample(sampleName, `/samples/${sampleName}`))
			.catch( err =>
				console.error(`DEBUG:AudioEngine:lazyLoadSample: ` + err)
			);
	}

	loadImportedSamples() {

    this.getSamplesNames().forEach( sampleName =>
      this.lazyLoadSample(sampleName)
    );

    this.samplesLoaded = true;
	}
}
