import { writable, readable, get } from "svelte/store";

import compile from "../compiler/compiler";

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
import StoreInspector from "../components/widgets/StoreInspector.svelte";
import DSPCodeOutput from "../components/widgets/DSPCodeOutput.svelte";
import PostIt from "../components/widgets/PostIt.svelte";

import default_grammar from "../../assets/languages/default/grammar.ne";
import gabber_grammar from "../../assets/languages/gabber/grammar.ne";
import nibble_grammar from "../../assets/languages/nibble/grammar.ne";

import default_liveCode from "../../assets/languages/default/code.sem";
import gabber_liveCode from "../../assets/languages/gabber/code.sem";
import nibble_liveCode from "../../assets/languages/nibble/code.sem";

import hello_world_code_example from "../machineLearning/tfjs/hello-world/hello-world.tf";
import two_layer_non_linear_code_example from "../machineLearning/tfjs/non-linear/two-layer-non-linear.tf";
import binary_classification_code_example from "../machineLearning/tfjs/non-linear/binary-classification.tf";
import echo_state_network_code_example from "../machineLearning/tfjs/echo-state/echo-state-network.tf";
import lstm_txt_gen_code_example from "../machineLearning/tfjs/rnn/lstm-txt-gen.tf";
import music_rnn_example from "../machineLearning/magenta/music-rnn.tf";

export const cm_theme_cobalt = writable("");
export const cm_theme_icecoder = writable("");
export const cm_theme_shadowfox = writable("");

// Dashboard Store for Live Code Editor options in Sidebar component
export const sidebarLiveCodeOptions = writable([
	{ id: 0, disabled: false, text: `LiveCode Editor`, content: "" },
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
export const sidebarModelOptions = writable([
	{ id: 0, disabled: false, text: `Model Editor`, content: "" },
	// { id: 0, disabled: true, text: `Model Editor`, content: "" },
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
	{ id: 0, disabled: false, type: ``, text: `Debuggers`, content: "" },
	{
		id: 1,
		disabled: false,
		type: `grammarCompileOutput`,
		text: `Grammar Compiler Output`,
		content: "",
	},
	{
		id: 2,
		disabled: false,
		type: `liveCodeParseOutput`,
		text: `Live Code Parser Output`,
		content: "",
	},
	{
		id: 3,
		disabled: false,
		type: `dspCodeOutput`,
		text: `DSP Code Generated`,
		content: "",
	},
	{
		id: 4,
		disabled: false,
		type: `postIt`,
		text: `Post-It Panel`,
		content: "",
	},
	{
		id: 4,
		disabled: false,
		type: `storeInspector`,
		text: `Store Inspector`,
		content: "",
	},
]);

export let selectedDebuggerOption = writable({});
export let isSelectDebuggerDisabled = writable(false);

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


const originalItems = [
	{
		...gridHelp.item({ x: 0, y: 0, w: 6, h: 7, id: id() }),
		...{
			type: "liveCodeEditor",
			name: "hello-world",
			background: "#151515",
			lineNumbers: true,
			hasFocus: false,
			theme: "icecoder",
			component: LiveCodeEditor,
			data: default_liveCode,
			grammarSource: "/languages/default/grammar.ne",
			liveCodeSource: "/languages/default/code.sem",
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
		...{
			breakpoints: {
				10: { x: 0, y: 0, w: 2, h: 2 },
				2: { x: 0, y: 0, w: 1, h: 2 },
				1: { x: 0, y: 0, w: 1, h: 2 },
			},
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
		...{
			breakpoints: {
				10: { x: 0, y: 0, w: 2, h: 2 },
				2: { x: 0, y: 0, w: 1, h: 2 },
				1: { x: 0, y: 0, w: 1, h: 2 },
			},
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
		...{
			breakpoints: {
				10: { x: 0, y: 0, w: 2, h: 2 },
				2: { x: 0, y: 0, w: 1, h: 2 },
				1: { x: 0, y: 0, w: 1, h: 2 },
			},
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
			// data: "",
			grammarSource: "/languages/default/grammar.ne",
		},
		...{
			breakpoints: {
				10: { x: 0, y: 0, w: 2, h: 2 },
				2: { x: 0, y: 0, w: 1, h: 2 },
				1: { x: 0, y: 0, w: 1, h: 2 },
			},
		},
	},

	// {
	// 	...gridHelp.item({ x: 7, y: 7, w: 4, h: 30, id: id() }),
	// 	...{
	// 		name: "hello world",
	// 		type: "storeInspector",
	// 		lineNumbers: true,
	// 		hasFocus: false,
	// 		theme: "monokai",
	// 		background: "#f0f0f0",
	// 		component: StoreInspector,
	// 		data: "",
	// 	},
	// },

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
		...{
			breakpoints: {
				10: { x: 0, y: 0, w: 2, h: 2 },
				2: { x: 0, y: 0, w: 2, h: 2 },
				1: { x: 0, y: 0, w: 2, h: 2 },
			},
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
			grammarSource: "/languages/defaultGrammar.ne",
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
				1: { x: 0, y: 0, w: 1, h: 2 }
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
	},
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


// Use traditional function declaration to prevent Temporal Dead Zone issue
export async function createNewItem (type, content){
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
				liveCodeSource: content.livecode,
				data: content.code,
			};
      // await populateStoresWithFetchedProps(component); 
			break;
		case "grammarEditor":
			component = {
				component: GrammarEditor,
				background: "#AAAAAA",
				theme: "monokai",
				grammarSource: content.grammarSource,
			};
      component.data = content.grammar; // Get the store value with Svelte's get
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
		case "storeInspector":
			component = {
				component: StoreInspector,
				background: "#d1d5ff",
			};
			break;
		case "analyser":
			component = {
				component: Analyser,
				background: "#ffffff",
				mode: "",
			};
			break;
		case "postIt":
			component = {
				component: PostIt,
				background: "#ffffff",
			};
			break;
		case "dspCodeOutput":
			component = {
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
		...gridHelp.item({ x: 0, y: 0, w: 7, h: 3, id: itemId }),
		...{
			type: type,
			name: type + itemId,
			lineNumbers: true,
			hasFocus: true,
		},
		// ...{
		// 	breakpoints: {
		// 		10: { x: 0, y: 0, w: 2, h: 2 },
		// 		5: { x: 0, y: 0, w: 1, h: 2 },
		// 		3: { x: 0, y: 0, w: 1, h: 2 },
		// 		1: { x: 0, y: 0, w: 1, h: 2 },
		// 	},
		// },
		...component,
	};
};

export function hydrateJSONcomponent (item){
	if (item !== 'undefined' && item.type !== 'undefined') {
		switch (item.type) {
			case "liveCodeEditor":
				item.component = LiveCodeEditor;
				// await populateStoresWithFetchedProps(item);
				break;
			case "grammarEditor":
				item.component = GrammarEditor;
				// grammarEditorValue.set(item.data); // Set the store value with grammar value deserialised from data
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
			case "storeInspector":
				item.component = StoreInspector;
				break;
			case "analyser":
				item.component = Analyser;
				break;
			case "postIt":
				item.component = PostIt;
				break;
			case "dspCodeOutput":
				item.component = DSPCodeOutput;
				break;
			default:
				// item.component = StoreInspector;
				break;
		}
		if(item.id === 'undefined'){
      item.id = id();
		  item.name = item.type + item.id;
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



/*
 * Wraps writable store a
 */
export function storable(key, initialValue) {
	const store = writable(initialValue); // create an underlying store
	const { subscribe, set, update } = store;

	let json = localStorage.getItem(key); // get the last value from localStorage
	if (json) {
		// set( JSON.parse(json));
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
export const items = storable("playground", originalItems); // localStorageWrapper

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




