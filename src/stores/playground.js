import { writable, readable, get } from "svelte/store";

import { id, fetchFrom } from "../utils/utils";

/**
 * These methods should be extracted in the future to common.js
 * However there is more to understand about how Webpack builds JS modules
 * there was a runtime error at hydrateJSONcomponent which I couldn't
 * figure out in time for the user study, so I rolled it back.
 * hence there is duplicate code in tutorial and playground stores
 * [FB20200527]
 */
// import { hydrateJSONcomponent, storable } from "../stores/common";

import gridHelp from "svelte-grid/build/helper/index.mjs";

import ModelEditor from "../components/editors/ModelEditor.svelte";
import GrammarEditor from "../components/editors/GrammarEditor.svelte";
import LiveCodeEditor from "../components/editors/LiveCodeEditor.svelte";
import LiveCodeParseOutput from "../components/widgets/LiveCodeParseOutput.svelte";
import GrammarCompileOutput from "../components/widgets/GrammarCompileOutput.svelte";
import Analyser from "../components/widgets/Analyser.svelte";
import Visualiser from "../components/widgets/Visualiser.svelte";
import StoreInspector from "../components/widgets/StoreInspector.svelte";
import DSPCodeOutput from "../components/widgets/DSPCodeOutput.svelte";
import Console from "../components/widgets/Console.svelte";

import default_grammar from "../../static/languages/default/grammar.ne";
// import gabber_grammar from "../../assets/languages/gabber/grammar.ne";
// import nibble_grammar from "../../assets/languages/nibble/grammar.ne";

import default_liveCode from "../../static/languages/default/code.sem";


import default_playground_layout from '../../static/layouts/default-stormzy-vossi-bop.json';

import hello_world_code_example           from "../../static/learners/hello-world/hello-world.tf";
import two_layer_non_linear_code_example  from "../../static/learners/non-linear/two-layer-non-linear.tf";
import binary_classification_code_example from "../../static/learners/non-linear/binary-classification.tf";
import echo_state_network_code_example    from "../../static/learners/echo-state/echo-state-network.tf";
import lstm_txt_gen_code_example          from "../../static/learners/rnn/lstm-txt-gen.tf";
// import music_rnn_example                  from "../machineLearning/magenta/music-rnn.tf";



export const isUploadOverlayVisible = writable(false);

export const cm_theme_cobalt = writable("");
export const cm_theme_icecoder = writable("");
export const cm_theme_shadowfox = writable("");

// Dashboard Store for Live Code Editor options in Sidebar component
export const sidebarLiveCodeOptions = writable([
	{ id: 0, disabled: false, text: `livecode`, content: "" },
  // { id: 1, disabled: false, text: `new`, content: {
  //     grammar:  `/languages/default/grammar.ne`,
  //     livecode: undefined
  //   }
  // },
	// { id: 0, disabled: true, text: `LiveCode Editor`, content: "" },
	// { id: 1, disabled: false, text: `+ default`, content: default_liveCode },
	// { id: 2, disabled: false, text: `+ nibble`, content: nibble_liveCode },
	// { id: 3, disabled: false, text: `+ gabber`, content: gabber_liveCode }
]);

export const selectedLiveCodeOption = writable(sidebarLiveCodeOptions[1]);
export const isSelectLiveCodeEditorDisabled = writable(false);


// Store for TFJS model options in Sidebar component
// export const sidebarModelOptions = writable([]);
export const sidebarModelOptions = writable([
	{ id: 0, disabled: false, text: `learner`, content: "" },
	{ id: 1, disabled: false, text: `+ hello-world`, content: hello_world_code_example },
	{
		id: 2,
    disabled: false,
		text: `+ two-layer-non-linear`,
		content: two_layer_non_linear_code_example,
	},
	{
		id: 3,
    disabled: false,
		text: `+ binary-classification`,
		content: binary_classification_code_example,
	},
	{
		id: 4,
    disabled: false,
		text: `+ echo-state-network`,
		content: echo_state_network_code_example,
	},
	{
		id: 5,
    disabled: false,
		text: `+ lstm-text-gen`,
		content: lstm_txt_gen_code_example,
	},
]);


export const selectedModelOption = writable(sidebarModelOptions[1]);
export const isSelectModelEditorDisabled = writable(false);

export const isAddGrammarEditorDisabled = writable(false);


// Dashboard Store for Live Code Editor options in Sidebar component
export const sidebarDebuggerOptions = writable([
	{ id: 0, disabled: false, type: ``, text: `debug`, content: "" },
	{
		id: 1,
		disabled: false,
		type: `console`,
		text: `Console`,
		content: "",
	},
	{
		id: 2,
		disabled: false,
		type: `liveCodeParseOutput`,
		text: `Live Code Parser`,
		content: "",
	},
	{
		id: 3,
		disabled: false,
		type: `dspCodeOutput`,
		text: `DSP Code Generator`,
		content: "",
	},
	{
		id: 4,
		disabled: false,
		type: `grammarCompileOutput`,
		text: `Grammar Compiler`,
		content: "",
	},
	{
		id: 5,
		disabled: false,
		type: `storeInspector`,
		text: `Store Inspector`,
		content: "",
	},
]);

export let selectedDebuggerOption = writable({});
export let isSelectDebuggerDisabled = writable(false);


export const loadEnvironmentOptions  = writable([
	{ id: 0, disabled: false, text: `load`, content: "" },
	// { id: 0, disabled: false, text: `Load`, content: "" },
	// { id: 0, disabled: false, text: `Load`, content: "" },
	// { id: 1, disabled: false, text: `new`, content: {
	//     grammar:  `/languages/default/grammar.ne`,
	//     livecode: undefined
	//   }
	// },
]);

export const selectedLoadEnvironmentOption = writable(loadEnvironmentOptions[1]);
export const isLoadEnvironmentOptionsDisabled = writable(false);





// Dashboard Store for Live Code Editor options in Sidebar component
export const sidebarVisualisationOptions = [
	{ id: 0, text: `Visualisation`, content: "" },
	{ id: 1, text: `+ Audio Analyser`, content: "" },
];

export const isAddAnalyserDisabled = writable(false);


export const editorThemes = [
	{ id: 0, text: `Change Theme...`, content: "" },
	{ id: 1, text: `cobalt`, content: cm_theme_cobalt },
	{ id: 2, text: `icecoder`, content: cm_theme_icecoder },
	{ id: 3, text: `shadowfox`, content: cm_theme_shadowfox },
];

/*******                                        ********/
/*******       Playground Sidebar Stores        ********/
/*******                                        ********/
/*******                                        ********/
/*******                                        ********/
/*******                                        ********/
/*******                                        ********/
/*******                                        ********/
/*******                                        ********/
/*******   Playground Language Design Stores    ********/
/*******                                        ********/

// // export const grammarEditorValue = writable(initGrammarEditorValue());
// export const grammarEditorValue = writable("");

// // export const grammarCompiledParser = writable(compile(default_grammar).output);
// export const grammarCompiledParser = writable("");

// export const grammarCompilationErrors = writable("");

// // export const liveCodeEditorValue = writable(initLiveCodeEditorValue());
// export const liveCodeEditorValue = writable("");

// export const liveCodeParseResults = writable("");

// export const liveCodeParseErrors = writable("");

// export const liveCodeAbstractSyntaxTree = writable("");

// export const dspCode = writable("");

// // export const modelEditorValue = writable(initModelEditorValue());
// export const modelEditorValue = writable("");

/*******                                        ********/
/*******   Playground Language Design Stores    ********/
/*******                                        ********/
/*******                                        ********/
/*******                                        ********/
/*******                                        ********/
/*******                                        ********/
/*******                                        ********/
/*******                                        ********/
/*******                                        ********/
/*******                                        ********/
/*******   Playground Dashboard Items Stores    ********/
/*******                                        ********/



/**
 * * Test items to study responsive system
 *
 *
 *
 */
const testItems = [
	{
		id: id(),
		12: gridHelp.item({ x: 2, y: 0, w: 2, h: 2 }),
		8: gridHelp.item({ x: 0, y: 0, w: 2, h: 2 }),
		6: gridHelp.item({ x: 0, y: 0, w: 2, h: 2 }),
		3: gridHelp.item({ x: 0, y: 0, w: 1, h: 2 }),
		2: gridHelp.item({
			x: 0,
			y: 0,
			w: 1,
			h: 2,
		}),
		data: {
			type: "liveCodeEditor",
			name: "hello-world",
			background: "#151515",
			lineNumbers: true,
			hasFocus: false,
			background: "#151515",
			theme: "icecoder",
			component: LiveCodeEditor,
			content: "#lc-1",
			grammarSource: "/languages/default/grammar.ne",
		},
	},
	{
		id: id(),
		12: gridHelp.item({ x: 2, y: 0, w: 2, h: 2 }),
		8: gridHelp.item({ x: 2, y: 0, w: 2, h: 2 }),
		6: gridHelp.item({ x: 2, y: 0, w: 2, h: 2 }),
		3: gridHelp.item({ x: 2, y: 0, w: 1, h: 2 }),
		2: gridHelp.item({
			x: 0,
			y: 0,
			w: 1,
			h: 2,
		}),
		data: {
			type: "grammarEditor",
			name: "hello-world",
			background: "#151515",
			lineNumbers: true,
			hasFocus: false,
			background: "#151515",
			theme: "icecoder",
			component: GrammarEditor,
			content: "#ge-1",
			grammarSource: "/languages/default/grammar.ne",
		},
	},

	// {
	// 	6: gridHelp.item({
	// 		x: 0,
	// 		y: 0,
	// 		w: 2,
	// 		h: 2,
	// 	}),
	// 	id: id(),
	// },

	/*
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
		...{
			breakpoints: {
				10: { x: 0, y: 0, w: 2, h: 2 },
				2: { x: 0, y: 0, w: 1, h: 2 },
				1: { x: 0, y: 0, w: 1, h: 2 },
			},
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
		...{
			breakpoints: {
				10: { x: 0, y: 0, w: 2, h: 2 },
				2: { x: 0, y: 0, w: 1, h: 2 },
				1: { x: 0, y: 0, w: 1, h: 2 },
			},
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
		...{
			breakpoints: {
				10: { x: 0, y: 0, w: 2, h: 2 },
				2: { x: 0, y: 0, w: 2, h: 2 },
				1: { x: 0, y: 0, w: 2, h: 2 },
			},
		},
	}
  */
];

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
			data: "value",
		}),
		...{
			breakpoints: {
				10: { x: 0, y: 0, w: 2, h: 2 },
				// 2: { x: 0, y: 0, w: 1, h: 2 },
			},
		},
	};

	return item;
};


// export const populateStoresWithFetchedProps = async (newItem) => {

//   if(newItem.type === 'liveCodeEditor')
//     try{
//       newItem.data = await fetchFrom(newItem.liveCodeSource);
//       liveCodeEditorValue.set(newItem.data);
//       let grammar = await fetchFrom(newItem.grammarSource);
//       grammarEditorValue.set(grammar);
//       let compileOutput = compile(grammar).output;
//       grammarCompiledParser.set(compileOutput);
//     }
//     catch(error){
//       console.error("Error Populating stores with fetched liveCode props")
//     }
//   else if (newItem.type === 'grammarEditor')
//     grammarEditorValue.set(item.data);
// }

/**
 * @createNewItem creates a new widget as new grid item object with properties that will be (de)serialized to the layout
 * wraps up components (e.g. LiveCodeEditor) which may have considerable load time and needs to be asynchronous
 * ! NEED TO use traditional function declaration to prevent Temporal Dead Zone issue
 * TODO: Refactor to TS to apply inheritance and define parameter types
 * @param widget type (e.g 'liveCodeEditor')
 * @param content data hold held by the widget (e.g. liveCodeSource)
 */
export async function createNewItem (type, content){
	let data;
	switch (type) {
		case "storeInspector":
			data = {
				component: StoreInspector,
				background: "#d1d5ff",
			};
			break;
		case "liveCodeEditor":
			data = {
				component: LiveCodeEditor,
				background: "#151515",
				theme: "icecoder",
				grammarSource: content.grammar,
				liveCodeSource: content.livecode,
				content: content.code, // changed from `data`
			};
			// await populateStoresWithFetchedProps(component);
			break;
		case "grammarEditor":
			data = {
				component: GrammarEditor,
				background: '#151515',
				theme: 'monokai',
				grammarSource: content.grammarSource,
				content: content.grammar, // Get the store value with Svelte's get
			}
			// data.data = content.grammar; // Get the store value with Svelte's get
			break;
		case "modelEditor":
			data = {
				component: ModelEditor,
				background: '#151515',
				theme: 'monokai',
				content: content,
			}
			break;
		case "liveCodeParseOutput":
			data = {
				component: LiveCodeParseOutput,
				background: "#ebdeff",
			};
			break;
		case "grammarCompileOutput":
			data = {
				component: GrammarCompileOutput,
				background: "#d1d5ff",
			};
			break;
		case "analyser":
			data = {
				component: Analyser,
				background: '#191919',
				mode: '',
			}
			break;
		case "visualiser":
			data = {
				component: Visualiser,
				background: '#191919',
				mode: '',
				channelID: '0',
			}
			break;
		case "postIt":
			data = {
				component: Console,
				background: "#ffffff",
			};
			break;
		case "dspCodeOutput":
			data = {
				component: DSPCodeOutput,
				background: "#fdbd9a",
			};
			break;
		default:
			break;
	}

  let itemId = id();

	// return component template
	return {
    id: itemId,
		12: gridHelp.item({ x: 0, y: 0, w: 9, h: 5 }),
		8: gridHelp.item({ x: 0, y: 0, w: 7, h: 5 }),
		6: gridHelp.item({ x: 0, y: 0, w: 5, h: 3 }),
		3: gridHelp.item({ x: 0, y: 0, w: 3, h: 2 }),
		2: gridHelp.item({
			x: 0,
			y: 0,
			w: 2,
			h: 2,
		}),
		data: {
      id: itemId,
			type: type,
			name: type + itemId,
			background: "#151515",
			lineNumbers: true,
			hasFocus: true,
			background: "#151515",
			theme: "icecoder",
    	...data
		},
	};
};

/**
 * @hydrateJSONcomponent receives a JSON description for a grid item and creates a 'live' Svelte component for the grid as new grid item object
 * TODO: Refactor to TS to apply inheritance and define parameter types
 * @param item JSON grid item component description
 */
export function hydrateJSONcomponent (item){
	if ( item && item.data && item.data.type ) {
		switch (item.data.type) {
			case "liveCodeEditor":
				item.data.component = LiveCodeEditor;
				break;
			case "grammarEditor":
				item.data.component = GrammarEditor;
				break;
			case "modelEditor":
				item.data.component = ModelEditor;
				break;
			case "liveCodeParseOutput":
				item.data.component = LiveCodeParseOutput;
				break;
			case "grammarCompileOutput":
				item.data.component = GrammarCompileOutput;
				break;
			case "storeInspector":
				item.data.component = StoreInspector;
				break;
			case "analyser":
				item.data.component = Analyser;
				break;
			case "visualiser":
				item.data.component = Visualiser;
				break;
			case "console":
				item.data.component = Console;
				break;
			case "dspCodeOutput":
				item.data.component = DSPCodeOutput;
				break;
			default:
				// item.component = StoreInspector;
				break;
		}
		if(!item.id){
      item.id = id();
		  item.data.name = item.data.type + item.id;
    }
		return item;
  }
  else
    throw Error("hydrateJSONcomponent: undefined item");
	// } else {
	// 	createNewItem();
	// }
};

export const reset = () => {
	items.set(layoutOriginal);
};

export const fastStart = writable(true);


/**
 * @storable wraps the Svelte "writable store" pattern to automatically synchronize a store with local storage
 * * synchronize here is bidirectional which means both serializing the store value
 * * to a corresponding local storage item
 * * and reading from a local storage item and hydrating the JSON descriptors
 * ! HANDLE WITH CARE requires a good understading of the Svelte store mechanism,
 * ! the concepts of serialisation and hydration
 * ! and local storage
 * @key text descriptor for the store in the local storage
 * @initialValue initial default value for store
 */
export function storable(key, initialValue) {
	const store = writable(initialValue); // create an underlying store
	const { subscribe, set, update } = store;

	let json = localStorage.getItem(key); // get the last value from localStorage
	if (json) {
		set(JSON.parse(json).map(item => hydrateJSONcomponent(item))); // use the value from localStorage if it exists
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
			// return get(store);
		},

		subscribe, // punt subscriptions to underlying store
	};
}

// Dashboard layout in items list
// export const items = storable('playground', testItems) // localStorageWrapper
export const items = storable(
	'playground',
	default_playground_layout.map((item) => hydrateJSONcomponent(item))
) // localStorageWrapper
// export const items = storable("playground", originalItems); // localStorageWrapper

// Dashboard SELECTED item which receives focus and has item controls loaded
export const focusedItem = writable({});


export const focusedItemProperties = writable([]);

// Dashboard SELECTED item which receives focus and has item controls loaded
export const focusedItemControls = writable([]);


export function setFocused(item){
  try {
    let itemProperties = [];
    if( item.type === "liveCodeEditor" || item.type === "grammarEditor" || item.type === 'modelEditor' ){
      itemProperties = [ item.lineNumbers, item.theme ];

      if( item.type === "liveCodeEditor" ){
        // itemProperties.push(item.grammar);
      }
    }
    else if(item.type === 'analyser'){
      itemProperties.push(item.mode)
    }
    else if(item.type === 'visualiser'){
      itemProperties.push(item.channelID)
    }
    focusedItemProperties.set(itemProperties);

    items.update(
			(itemsToUpdate) => {
        itemsToUpdate.map(
          itemToUnfocus => ({
            ...itemToUnfocus,
            ...{ hasFocus: false }
          })
        )
      }
		);

    console.log(get(items));

    //set unfocused items through the rest of the list
    // let itemsUnfocused = get(items);

    // itemsUnfocused = itemsUnfocused.map( itemToUnfocus => itemToUnfocus.hasFocus = false );

    // items.set(itemsUnfocused);
    // items = itemsUnfocused);

    //set focused item
    item.hasFocus = true;
  	focusedItem.set(item);
  }
  catch(error){
    console.error("Error Playground.setFocused: setting item focusesd" );
  };
}


export function clearFocused(){

  focusedItem.set({});
  focusedItemProperties.set([]);

}

export function loadEnvironmentSnapshotEntries() {

  let localStorageItemPrefix = "playground-"
	// Load local storage items filtered by "playground-" prefix
	let keys = Object.keys(localStorage)
		.filter((key) => key.includes(localStorageItemPrefix))
		.sort(
			(a, b) =>
				Date.parse(b.substring(localStorageItemPrefix.length)) -
				Date.parse(a.substring(localStorageItemPrefix.length))
		);

	// Create a list of sidebar Load combox items with local storage substring, including the default "load"
	loadEnvironmentOptions.set(
		keys.reduce(
			(acc, val, i) => [
				...acc,
				{
					id: i + 1, // item starts with 0 when reducer is passed a first item (see below)
					disabled: false,
					text: val.substring(localStorageItemPrefix.length),
					content: val,
				},
			],
			[{ id: 0, disabled: false, text: `load` }]
		)
	);
}



