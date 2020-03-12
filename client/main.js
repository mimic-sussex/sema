import App from './UI/App.svelte';

import { exportHistory, clearHistory } from "./utils/history.js";

const app = new App({
	target: document.body,
	props: {
		name: "world"
	}
});


//exportHistory();
clearHistory();

window.app = app;

export default app;