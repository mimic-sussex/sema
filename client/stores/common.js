import { get, writable } from "svelte/store";

import { id } from "../utils/utils";

import ModelEditor from "../components/editors/ModelEditor.svelte";
import GrammarEditor from "../components/editors/GrammarEditor.svelte";
import LiveCodeEditor from "../components/editors/LiveCodeEditor.svelte";
import LiveCodeParseOutput from "../components/widgets/LiveCodeParseOutput.svelte";
import GrammarCompileOutput from "../components/widgets/GrammarCompileOutput.svelte";
import Analyser from "../components/widgets/Analyser.svelte";
import StoreDebugger from "../components/widgets/StoreDebugger.svelte";

import gridHelp from "svelte-grid/build/helper/index.mjs";

function persist(key, value) {
	sessionStorage.setItem(key, JSON.stringify(value));
}


// Use traditional function declaration to prevent Temporal Dead Zone issue
export function writableSession(key, initialValue) {
	const sessionValue = JSON.parse(sessionStorage.getItem(key));

	if (!sessionValue) persist(key, initialValue);

	const store = writable(sessionValue || initialValue);

	const { set: realSet, subscribe, update: realUpdate } = store;

	return {
		set(value) {
			realSet(value);
			persist(key, value);
		},
		subscribe,
		update(fn) {
			realUpdate(fn);
			persist(key, get(store));
		},
	};
}

// Use traditional function declaration to prevent Temporal Dead Zone issue
export function createNewItem (type, id, content){
	// console.log("DEBUG:stores/common:createNewItem:");
	// console.log(content);
	let component;

	switch (type) {
		case "liveCodeEditor":
			component = {
				component: LiveCodeEditor,
				background: "#151515",
				theme: "icecoder",
				grammarSource: content.grammar,
				// liveCodeSource: content.livecode,
				data: ""
			};
			break;
		case "grammarEditor":
			component = {
				component: GrammarEditor,
				background: "#AAAAAA",
				theme: "monokai",
			};
			break;
		case "modelEditor":
			component = {
				component: ModelEditor,
				background: "#f0f0f0",
				theme: "monokai",
				data: content,
			};
			break;
		case "liveCodeParseOutput":
			component = {
				component: LiveCodeParseOutput,
				background: "#ebdeff",
			};
			break;
		case "grammarCompileOutput":
			component = {
				component: GrammarCompileOutput,
				background: "#d1d5ff",
			};
			break;
		case "storeDebugger":
			component = {
				component: StoreDebugger,
				background: "#d1d5ff",
			};
			break;
		case "analyser":
			component = {
				component: Analyser,
				background: "#ffffff",
				mode: "spectrogram",
			};
			break;
		default:
			break;
	}

	// return component template
	return {
		...gridHelp.item({ x: 0, y: 0, w: 7, h: 3, id: id }),
		...{
			type: type,
			name: type + id,
			lineNumbers: true,
			hasFocus: true,
		},
		...component,
	};
};

// Use traditional function declaration to prevent Temporal Dead Zone issue
export function hydrateJSONcomponent (item){
	if (item != undefined) {
		switch (item.type) {
			case "liveCodeEditor":
				item.component = LiveCodeEditor;
				break;
			case "grammarEditor":
				item.component = GrammarEditor;
				break;
			case "modelEditor":
				item.component = ModelEditor;
				break;
			case "liveCodeParseOutput":
				item.component = LiveCodeParseOutput;
				break;
			case "grammarCompileOutput":
				item.component = GrammarCompileOutput;
				break;
			case "storeDebugger":
				item.component = StoreDebugger;
				break;
			case "analyser":
				item.component = Analyser;
				break;
			default:
				item.component = StoreDebugger;
				break;
		}
		item.id = id();
		item.name = item.name + item.id;
		return item;
  }
  else
    throw Error("hydrateJSONcomponent: undefined item");
	// } else {
	// 	createNewItem();
	// }
};

/*
 * Wraps writable store a
 */
export function storable(key, initialValue) {
	const store = writable(initialValue); // create an underlying store
	const { subscribe, set, update } = store;

	let json = localStorage.getItem(key); // get the last value from localStorage
	if (json) {
		// set( JSON.parse(json));
		set( JSON.parse(json).map( item => hydrateJSONcomponent(item) ) ); // use the value from localStorage if it exists
	}

	// return an object with the same interface as Svelte's writable() store interface
	return {
		set(value) {
			localStorage.setItem(key, JSON.stringify(value));
			set(value); // capture set and write to localStorage
		},

		update(cb) {
			const value = cb(get(store)); // passes items to callback for invocation e.g items => items.concat(new)
			this.set(value); // capture updates and write to localStore
		},

		get() {
			return localStorage.getItem(key);
		},

		subscribe, // punt subscriptions to underlying store
	};
}
