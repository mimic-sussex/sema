import App from './components/App.svelte';
import ico from "../assets/img/favicon.ico";
import globalCss from "./global.css";

import { exportHistory, clearHistory } from "./utils/history.js";

const app = new App({
	target: document.body 
	// props: {
	// 	name: "world"
	// }
});


//exportHistory();
// clearHistory();

window.app = app;

export default app;