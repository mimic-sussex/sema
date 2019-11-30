import Module from "./maximilian.wasmmodule.js"; //NOTE:FB We need this import here for webpack to emit maximilian.wasmmodule.js
import CustomProcessor from "./maxi-processor";
import { loadSampleToArray } from "./maximilian.util";

/**
 * The CustomAudioNode is a class that extends AudioWorkletNode
 * to hold an Custom Audio Worklet Processor and connect to Web Audio graph
 * @class CustomAudioNode
 * @extends AudioWorkletNode
 */
class MaxiNode extends AudioWorkletNode {
	constructor(audioContext, processorName) {
		// super(audioContext, processorName);
		let options = {
			numberOfInputs: 1,
			numberOfOutputs: 1,
			outputChannelCount: [2]
		};
		super(audioContext, processorName, options);
	}
}

/**
 * The AudioEngine is a singleton class that encapsulates
 * the AudioContext and all WASM and Maximilian -powered Audio Worklet Processor
 * TODO: Implement Singleton pattern
 * @class AudioEngine
 */

class AudioEngine {
	/**
	 * @constructor
	 */
	// constructor(msgHandler) {
	constructor() {
		// NOTE:FB Untangling the previous msgHandler hack from the audio engine

		// NOTE:FB AudioContext needs lazy loading to counteract the Chrome warning
		// Audio Engine first play() call, triggered by user, prevents the warning
		// by setting this.audioContext = new AudioContext();
		this.audioContext;
		// this.sampleRate; // = this.audioContext.sampleRate;
		// this.processorCount = 0;
		this.audioWorkletProcessorName = "maxi-processor";
		this.audioWorkletUrl = "maxi-processor.js";
		this.audioWorkletNode;

		this.samplesLoaded = false;

		this.analysers = [];

		// this.msgHandler = msgHandler;    	// NOTE:FB Untangling the previous msgHandler hack from the audio engine

		this.onNewDSPLoadValue = x => {};

		this.loadTestIntervals = [];
		const SYNTH_CHANGE_MS = 50;

		this.dspTime = 0;

		this.sequences = [`kc kc k scos`, `kc kc k`, `kc sss kccs skckos`];

		// DEBUG:
		// this.synthDefs = [
		//   `this.mySine.sawn(60) * this.myOtherSine.sinewave(0.4)`,
		//   `this.mySine.sawn(60)`,
		//   `this.myOtherSine.sinewave(400)`,
		//   `this.mySine.sinewave(440) + this.myOtherSine.sinewave(441)`,
		//   `this.mySine.sinewave(440) * this.myOtherSine.sinewave(1)`,
		//   `this.mySine.sinewave(440 + (this.myOtherSine.sinewave(1) * 100))`,
		//   `this.mySine.sinewave(this.myOtherSine.sinewave(30) * 440)`,
		//   `this.mySine.sinewave(this.myOtherSine.sinewave(this.myLastSine.sinewave(0.1) * 30) * 440)`,
		//   `new Module.maxiOsc()`,
		//   `new Module.maxiOsc().sinewave(400)`, // Interesting case of failure, it seems we can't instantiate because of EM heap limits
		// ];

		this.oscThru = msg => {
			//       console.log("DEBUG:AudioEngine:OscThru: " + msg);
		};
	}

	/**
	 * Sets up an AudioIn WAAPI sub-graph
	 * @connectMediaStreamSourceInput
	 */
	async connectMediaStream() {
		const constraints = (window.constraints = {
			audio: true,
			video: false
		});

		function onAudioInputInit(stream) {
			// console.log("DEBUG:AudioEngine: Audio Input init");
			let mediaStreamSource = window.AudioEngine.audioContext.createMediaStreamSource(
				stream
			);
			mediaStreamSource.connect(window.AudioEngine.audioWorkletNode);
		}

		function onAudioInputFail(error) {
			console.log(
				"DEBUG:AudioEngine:AudioInputFail: ",
				error.message,
				error.name
			);
		}

		navigator.mediaDevices
			.getUserMedia(constraints)
			.then(onAudioInputInit)
			.catch(onAudioInputFail);
	}

	async loadWorkletProcessorCode() {
		if (this.audioContext !== undefined) {
			try {
				await this.audioContext.audioWorklet.addModule(this.audioWorkletUrl);

				// Custom node constructor with required parameters
				this.audioWorkletNode = new MaxiNode(
					this.audioContext,
					this.audioWorkletProcessorName
				);

				// All possible error event handlers subscribed
				this.audioWorkletNode.onprocessorerror = event => {
					// Errors from the processor
					console.log(
						`DEBUG:AudioEngine:loadWorkletProcessorCode: MaxiProcessor Error detected`
					);
				};
				this.audioWorkletNode.port.onmessageerror = event => {
					//  error from the processor port
					console.log(
						`DEBUG:AudioEngine:loadWorkletProcessorCode: Error message from port: ` +
							event.data
					);
				};

				// State changes in the audio worklet processor
				this.audioWorkletNode.onprocessorstatechange = event => {
					console.log(
						`DEBUG:AudioEngine:loadWorkletProcessorCode: MaxiProcessor state change detected: ` +
							audioWorkletNode.processorState
					);
				};

				// Worklet Processor message handler
				this.audioWorkletNode.port.onmessage = event => {
					this.messageHandler(event.data);
				};

				// Connect the worklet node to the audio graph
				this.audioWorkletNode.connect(this.audioContext.destination);

				return true;
			} catch (err) {
				console.log(
					"DEBUG:AudioEngine:loadWorkletProcessorCode: AudioWorklet not supported in this browser: ",
					err.message
				);
				return false;
			}
		} else {
			return false;
		}
	}

	/**
	 * Handles events
	 * @play
	 */
	messageHandler(data) {

    if(data != undefined && data.p != undefined)
    {
      const { p, c } = data;
      this.sendPeersMyClockPhase(p);
      // console.log("DEBGUG:AudioEngine:messageHandler:");
			// console.log(data);
    }


  }

	// NOTE:FB Test code should be segregated from production code into its own fixture.
	// Otherwise, it becomes bloated, difficult to read and reason about.

	// messageHandler(data) {
	// 	if (data == "dspStart") {
	// 		this.ts = window.performance.now();
	// 	}
	// 	if (data == "dspEnd") {
	// 		this.ts = window.performance.now() - this.ts;
	// 		this.dspTime = this.dspTime * 0.9 + this.ts * 0.1; //time for 128 sample buffer
	// 		this.onNewDSPLoadValue((this.dspTime / 2.90249433106576) * 100);
	// 	}
	// 	if (data == "evalEnd") {
	// 		let evalts = window.performance.now();
	// 		this.onEvalTimestamp(evalts);
	// 	} else if (data == "evalEnd") {
	// 		let evalts = window.performance.now();
	// 		this.onEvalTimestamp(evalts);
	// 	} else if (data == "giveMeSomeSamples") {
	// 		// this.msgHandler("giveMeSomeSamples");    	// NOTE:FB Untangling the previous msgHandler hack from the audio engine
	// 	} else {
	// 		this.msgHandler(data);
	// 	}
	// }

	loadSample(objectName, url) {
		if (this.audioContext !== undefined) {
			loadSampleToArray(
				this.audioContext,
				objectName,
				url,
				this.audioWorkletNode
			);
		} else throw "Audio Context is not initialised!";
	}

	/**
	 * Initialises audio context and sets worklet processor code
	 * @play
	 */
	async init(numPeers) {
		if (this.audioContext === undefined) {
			this.audioContext = new AudioContext();

			await this.loadWorkletProcessorCode();
			this.connectMediaStream();
			// TODO:FB Remove this to somewhere where it makes sense
			this.oscThru = msg => {
				this.audioWorkletNode.port.postMessage(msg);
			};
		}
	}

	/**
	 * Initialises audio context and sets worklet processor code
	 * or re-starts audio playback by stopping and running the latest Audio Worklet Processor code
	 * @play
	 */
	play() {
		if (this.audioContext !== undefined) {
			if (this.audioContext.state !== "suspended") {
				this.stop();
				return false;
			} else {
				this.audioContext.resume();
				return true;
			}
		}
	}

	/**
	 * Stops audio by disconnecting Audio None with Audio Worklet Processor code
	 * from Web Audio graph
	 * TODO: Investigate when it is best to just STOP the graph exectution
	 * @stop
	 */
	stop() {
		if (this.audioWorkletNode !== undefined) {
			this.audioContext.suspend();
		}
	}

	stopAndRelease() {
		if (this.audioWorkletNode !== undefined) {
			this.audioWorkletNode.disconnect(this.audioContext.destination);
			this.audioWorkletNode = undefined;
		}
	}

	more(gain) {
		if (this.audioWorkletNode !== undefined) {
			const gainParam = this.audioWorkletNode.parameters.get(gain);
			gainParam.value += 0.5;
			console.log(gain + ": " + gainParam.value); // DEBUG
			return true;
		} else return false;
	}

	less(gain) {
		if (this.audioWorkletNode !== undefined) {
			const gainParam = this.audioWorkletNode.parameters.get(gain);
			gainParam.value -= 0.5;
			console.log(gain + ": " + gainParam.value); // DEBUG
			return true;
		} else return false;
	}

	// evalSequence() {
	// 	if (this.audioWorkletNode !== undefined) {
	// 		let sequence;
	// 		if (arguments.length == 0) {
	// 			sequence = this.sequences[
	// 				Math.floor(Math.random() * this.sequences.length)
	// 			]; // Choose random entry
	// 			this.audioWorkletNode.port.postMessage({
	// 				sequence: `${sequence}`
	// 			}); // Send JSON object with eval prop for evaluation in processor
	// 		} else {
	// 			sequence = arguments[0];
	// 			this.audioWorkletNode.port.postMessage({
	// 				sequence: `${sequence}`
	// 			}); // Send JSON object with eval prop for evaluation in processor
	// 		}
	// 		return true;
	// 		// DEBUG:
	// 		// console.log("Change Sequence: " + sequence);
	// 	}
	// 	return false;
	// }

	evalDSP(dspFunction) {
		if (this.audioWorkletNode !== undefined) {
			this.audioWorkletNode.port.postMessage({
				eval: 1,
				setup: dspFunction.setup,
				loop: dspFunction.loop
			});
			console.log("DEBUG:evalDSP:");
			console.log(dspFunction);
			return true;
		} else
      return false;
	}

  sendClockPhase(phase, idx) {
  	if (this.audioWorkletNode !== undefined) {
  		this.audioWorkletNode.port.postMessage({phase:phase, i:idx});
  	}
  }


	// loadTest() {
	// 	if (audioContext.state === "suspended") this.playAudio();
	// 	this.loadTestIntervals.push(
	// 		setInterval("changeSynth()", this.SYNTH_CHANGE_MS)
	// 	);
	// }

	// stopLoadTest() {
	// 	this.loadTestIntervals.forEach(interval => {
	// 		clearInterval(interval);
	// 	});
	// }
}

export { AudioEngine };
