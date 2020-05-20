import { writable, readable, get } from 'svelte/store';
// import { writable as internal, get } from "svelte/store";

import { id } from "../utils/utils";

import gridHelp from "svelte-grid/build/helper/index.mjs";

import ModelEditor          from "../components/editors/ModelEditor.svelte";
import GrammarEditor        from "../components/editors/GrammarEditor.svelte";
import LiveCodeEditor       from "../components/editors/LiveCodeEditor.svelte";
import LiveCodeParseOutput  from "../components/widgets/LiveCodeParseOutput.svelte";
import GrammarCompileOutput from "../components/widgets/GrammarCompileOutput.svelte";
import Analyser             from "../components/widgets/Analyser.svelte";
import StoreDebugger        from "../components/widgets/StoreDebugger.svelte";

import default_grammar from "../../assets/languages/default/grammar.ne";
// import gabber_grammar  from "../../assets/languages/gabber.ne";
// import nibble_grammar  from "../../assets/languages/nibble.ne";

import default_liveCode from "../../assets/languages/default/liveCode.sem";
// import gabber_liveCode  from "../../assets/languages/gabber.sem";
// import nibble_liveCode  from "../../assets/languages/nibble.sem";

import hello_world_code_example           from "../machineLearning/tfjs/hello-world/hello-world.tf";
import two_layer_non_linear_code_example  from "../machineLearning/tfjs/non-linear/two-layer-non-linear.tf";
import binary_classification_code_example from "../machineLearning/tfjs/non-linear/binary-classification.tf";
import echo_state_network_code_example    from "../machineLearning/tfjs/echo-state/echo-state-network.tf";
import lstm_txt_gen_code_example          from "../machineLearning/tfjs/rnn/lstm-txt-gen.tf";
import music_rnn_example                  from "../machineLearning/magenta/music-rnn.tf";

export const cm_theme_cobalt = writable("");
export const cm_theme_icecoder = writable("");
export const cm_theme_shadowfox = writable("");

// Dashboard Store for Live Code Editor options in Sidebar component
export const sidebarLiveCodeOptions = writable([
	{ id: 0, disabled: false, text: `LiveCode Editor`, content: "" },
	// { id: 1, text: `+ default`, content: default_liveCode },
	// { id: 2, text: `+ nibble`, content: nibble_liveCode },
	// { id: 3, text: `+ gabber`, content: gabber_liveCode },
]);

// Dashboard Store for Grammar Editor options in Sidebar component
export const sidebarGrammarOptions = writable([
	{ id: 1, disabled: false, text: `Grammar Editor`, content: "" },
	// { id: 1, text: `+ default`, content: default_grammar },
	// { id: 2, text: `+ nibble`, content: nibble_grammar },
	// { id: 3, text: `+ gabber`, content: gabber_grammar } 
]);


// Store for TFJS model options in Sidebar component
export const sidebarModelOptions = writable([
	{ id: 0, disabled: false, text: `Model Editor`, content: "" },
	{ id: 1, text: `+ hello-world`, content: hello_world_code_example },
	{
		id: 2,
		text: `+ two-layer-non-linear`,
		content: two_layer_non_linear_code_example
	},
	{
		id: 3,
		text: `+ binary-classification`,
		content: binary_classification_code_example
	},
	{
		id: 4,
		text: `+ echo-state-network`,
		content: echo_state_network_code_example
	},
	{
		id: 5,
		text: `+ lstm-text-gen`,
		content: lstm_txt_gen_code_example
	}
]);

export const selectedModel = writable(sidebarModelOptions[1]);


// Dashboard Store for Live Code Editor options in Sidebar component
export const sidebarDebuggerOptions = [
	{ id: 0, text: `Debuggers`, content: "" },
	{ id: 1, text: `+ Grammar Compile Out`, content: "" },
	{ id: 2, text: `+ Live Code Parse Out`, content: "" },
  { id: 3, text: `+ DSP Code Out`,        content: "" },
	{ id: 4, text: `+ Post-It Panel`,       content: "" },
	{ id: 4, text: `+ Store Inspector`,     content: "" },
]

// Dashboard Store for Live Code Editor options in Sidebar component
export const sidebarVisualisationOptions = [
	{ id: 0, text: `Visualisation`, content: "" },
	{ id: 1, text: `+ Audio Analyser`, content: "" }
]


const originalItems = [
	{
		...gridHelp.item({ x: 0, y: 0, w: 6, h: 7, id: id() }),
		...{
			type: "liveCodeEditor",
			name: "hello-world",
			background: "#151515",
			lineNumbers: true,
			hasFocus: false,
			background: "#151515",
			theme: "icecoder",
			component: LiveCodeEditor,
			data: default_liveCode,
			grammarSource: "/languages/default/grammar.ne",
		},
	},

	{
		...gridHelp.item({ x: 6, y: 0, w: 3, h: 2, id: id() }),
		...{
			name: "hello world",
			type: "analyser",
			lineNumbers: true,
			hasFocus: false,
			theme: "monokai",
			background: "#f0f0f0",
			component: Analyser,
			mode: "both",
		},
	},

	{
		...gridHelp.item({ x: 9, y: 0, w: 18, h: 3, id: id() }),
		...{
			name: "hello world",
			type: "modelEditor",
			lineNumbers: true,
			hasFocus: false,
			theme: "monokai",
			background: "#f0f0f0",
			component: ModelEditor,
			data: hello_world_code_example,
		},
	},

	{
		...gridHelp.item({ x: 6, y: 2, w: 3, h: 5, id: id() }),
		...{
			name: "hello world",
			type: "liveCodeParseOutput",
			lineNumbers: false,
			hasFocus: false,
			theme: "shadowfox",
			background: "#ebdeff",
			component: LiveCodeParseOutput,
			data: "",
		},
	},

	{
		...gridHelp.item({ x: 9, y: 3, w: 15, h: 3, id: id() }),
		...{
			name: "hello world",
			type: "grammarEditor",
			lineNumbers: true,
			hasFocus: false,
			theme: "monokai",
			background: "#AAAAAA",
			component: GrammarEditor,
			data: default_grammar,
		},
	},

	{
		...gridHelp.item({ x: 7, y: 7, w: 4, h: 30, id: id() }),
		...{
			name: "hello world",
			type: "storeDebugger",
			lineNumbers: true,
			hasFocus: false,
			theme: "monokai",
			background: "#f0f0f0",
			component: StoreDebugger,
			data: "",
		},
	},

	{
		...gridHelp.item({ x: 9, y: 6, w: 18, h: 1, id: id() }),
		...{
			name: "hello world",
			type: "grammarCompileOutput",
			lineNumbers: true,
			hasFocus: false,
			theme: "monokai",
			background: "#d1d5ff",
			component: GrammarCompileOutput,
			data: "",
		},
	},
];

const testItems = [
	{
		...gridHelp.item({ x: 7, y: 0, w: 2, h: 1, id: id() }),
		...{
			type: "liveCodeEditor",
			name: "hello-world",
			background: "#151515",
			lineNumbers: true,
			hasFocus: false,
			background: "#151515",
			theme: "icecoder",
			component: LiveCodeEditor,
			data: "#lc-1",
			grammarSource: "/languages/defaultGrammar.ne"
		},
	},

	{
		...gridHelp.item({ x: 10, y: 2, w: 2, h: 1, id: id() }),
		...{
			name: "hello world",
			type: "grammarEditor",
			lineNumbers: true,
			hasFocus: false,
			theme: "monokai",
			background: "#AAAAAA",
			component: GrammarEditor,
			data: "#g-1",
		},
	},

	{
		...gridHelp.item({ x: 0, y: 4, w: 3, h: 1, id: id() }),
		...{
			name: "hello world",
			type: "modelEditor",
			lineNumbers: true,
			hasFocus: false,
			theme: "monokai",
			background: "#f0f0f0",
			component: ModelEditor,
			data: "//m-1\nsema.env.saveLocal('1')",
		},
	},

	{
		...gridHelp.item({ x: 0, y: 8, w: 1, h: 1, id: id() }),
		...{
			name: "hello world",
			type: "analyser",
			lineNumbers: true,
			hasFocus: false,
			theme: "monokai",
			background: "#f0f0f0",
			component: Analyser,
			mode: "spectrogram",
			data: "1",
		},
	},
];


export const editorThemes = [
	{ id: 0, text: `Change Theme...`, content: "" },
	{ id: 1, text: `cobalt`, content: cm_theme_cobalt },
	{ id: 2, text: `icecoder`, content: cm_theme_icecoder },
	{ id: 3, text: `shadowfox`, content: cm_theme_shadowfox },
];



// let createItemNestedStore = () => {
//   return	{
// 		...gridHelp.item({ x: 7, y: 0, w: 7, h: 3, id: id() }),
// 		...{
// 			type: "liveCodeEditor",
// 			name: "hello-world",
// 			background: "#151515",
// 			lineNumbers: true,
// 			hasFocus: false,
// 			background: "#151515",
// 			theme: "icecoder",
// 			component: LiveCodeEditor,
// 			data: writable(default_liveCode)
// 		}
// 	}
// };

// let nestedStoresItems = [
// 	writable(createItemNestedStore()),
// 	writable(createItemNestedStore()),
// 	writable(createItemNestedStore()),
// 	writable(createItemNestedStore()),
// ];

export const reset = () => {
  items.set(layoutOriginal);
};

export let createRandomItem = (type) => {
  const i = 2;
	const col = 2;
	const x = Math.ceil(Math.random() * 3) + 2;
	const y = Math.ceil(Math.random() * 4) + 1;


  let item = {
		...gridHelp.item({
			x: (i * 2) % col,
			y: Math.floor(i / 6) * y,
			w: x,
			h: y,
			id: id,
			name: type + id,
			type: type,
			lineNumbers: true,
			hasFocus: false,
			theme: "monokai",
			data: "value"
		})
	};

  return item;
}

export let hydrateJSONcomponent = item => {

  if(item != undefined){
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
  }else{
    createNewItem()
  }
}

export let createNewItem = (type, id, content) => {
  console.log("DEBUG:playgroundStore:createNewItem:");
  console.log(content);
  let component;

  switch (type) {
		case "liveCodeEditor":
			component = {
				component: LiveCodeEditor,
				background: "#151515",
				theme: "icecoder",
				grammarSource: content.grammar,
				liveCodeSource: content.livecode,
				data: "",
			};
			break;
		case "grammarEditor":
			component = {
				component: GrammarEditor,
				background: "#AAAAAA",
				theme: "monokai"
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
				background: "#ebdeff"
			};
			break;
		case "grammarCompileOutput":
			component = {
				component: GrammarCompileOutput,
				background: "#d1d5ff"
			};
			break;
		case "storeDebugger":
			component = {
				component: StoreDebugger,
				background: "#d1d5ff"
			};
			break;
		case "analyser":
			component = {
				component: Analyser,
				background: "#ffffff",
				mode: "spectrogram"
			};
			break;
		default:
			break;
	}

  // return component template
  return {
		...gridHelp.item({ x: 0, y: 0, w: 2, h: 2, id: id }),
		...{
			type: type,
			name: type + id,
			lineNumbers: true,
			hasFocus: true
		},
		...component
	};
};

/**
 * Populates dashboard on application load,
 * checks local Storage for items from previous session and loads
 * or otherwise, loads hardcoded layout configuration
 */
// export const loadPlaygroundItems = () => {

// 	if (typeof window !== "undefined") {

// 		const playgroundItems = window.localStorage.getItem("items");

// 		return ( playgroundItems === null ||
// 			playgroundItems === undefined ||
// 			playgroundItems === ""
// 		) ? originalItems : JSON.parse(playgroundItems)

// 	} else
//     return originalItems;
// };


/*
 * Wraps writable store a
 */
export function storable(key, initialValue) {

	const store = writable(initialValue); // create an underlying store
	const { subscribe, set, update } = store;

	const json = localStorage.getItem(key); // get the last value from localStorage
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

		// hydrate(newItems) {
		// 	set( newItems.map( item => hydrateJSONcomponent(item) ) ); 
		// },

		subscribe // punt subscriptions to underlying store
	};
}


// Dashboard layout in items list
// export const items = writable(testItems); // base svelteStore
// export const items = storable("items", testItems); // localStorageWrapper
export const items = storable("items", originalItems); // localStorageWrapper
// export const items = writable(nestedStoresItems);
// export const items = writable([ hydrateJSONcomponent(createRandomItem('liveCodeEditor'))]);

// Dashboard SELECTED item which receives focus and has item controls loaded
export const focusedItem = writable({});

export const focusedItemProperties = writable({});

// Dashboard SELECTED item which receives focus and has item controls loaded
export const focusedItemControls = writable([]);
