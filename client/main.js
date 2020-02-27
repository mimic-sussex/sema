import App from './UI/App.svelte';

// import { createAudioEngine } from './audioEngine/audioEngineController.js';
import { PubSub } from './messaging/pubSub';

const app = new App({
	target: document.body,
	props: {
		name: "world"
	}
});

// window.messaging = new PubSub();

// createAudioEngine();

window.app = app;

export default app;