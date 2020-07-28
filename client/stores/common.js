import { get, writable } from "svelte/store";

import compile from "../compiler/compiler";

import { id, fetchFrom } from "../utils/utils";

import ModelEditor from "../components/editors/ModelEditor.svelte";
import GrammarEditor from "../components/editors/GrammarEditor.svelte";
import LiveCodeEditor from "../components/editors/LiveCodeEditor.svelte";
import LiveCodeParseOutput from "../components/widgets/LiveCodeParseOutput.svelte";
import GrammarCompileOutput from "../components/widgets/GrammarCompileOutput.svelte";
import Analyser from "../components/widgets/Analyser.svelte";
import StoreInspector from "../components/widgets/StoreInspector.svelte";
import PostIt from "../components/widgets/PostIt.svelte";
import DSPCodeOutput from "../components/widgets/DSPCodeOutput.svelte";

import gridHelp from "svelte-grid/build/helper/index.mjs";


export const audioEngineStatus = writable('stopped');
export const unsupportedBrowser = writable(false);
;
// function persist(key, value) {
// 	sessionStorage.setItem(key, JSON.stringify(value));
// }

// // Use traditional function declaration to prevent Temporal Dead Zone issue
// export function writableSession(key, initialValue) {
// 	const sessionValue = JSON.parse(sessionStorage.getItem(key));

// 	if (!sessionValue) persist(key, initialValue);

// 	const store = writable(sessionValue || initialValue);

// 	const { set: realSet, subscribe, update: realUpdate } = store;

// 	return {
// 		set(value) {
// 			realSet(value);
// 			persist(key, value);
// 		},
// 		subscribe,
// 		update(fn) {
// 			realUpdate(fn);
// 			persist(key, get(store));
// 		},
// 	};
// }


// // [NOTE] Use traditional function declaration to prevent Temporal Dead Zone issue
// export function hydrateJSONcomponent (item){
// 	if (item !== 'undefined' && item.type !== 'undefined') {
// 		switch (item.type) {
// 			case "liveCodeEditor":
// 				item.component = LiveCodeEditor;
// 				break;
// 			case "grammarEditor":
// 				item.component = GrammarEditor;
// 				break;
// 			case "modelEditor":
// 				item.component = ModelEditor;
// 				break;
// 			case "liveCodeParseOutput":
// 				item.component = LiveCodeParseOutput;
// 				break;
// 			case "grammarCompileOutput":
// 				item.component = GrammarCompileOutput;
// 				break;
// 			case "storeInspector":
// 				item.component = StoreInspector;
// 				break;
// 			case "analyser":
// 				item.component = Analyser;
// 				break;
// 			default:
// 				// item.component = StoreInspector;
// 				break;
// 		}
// 		if(item.id !== 'undefined'){
//       item.id = id();
// 		  item.name = item.name + item.id;
//     }
// 		return item;
//   }
//   else
//     throw Error("hydrateJSONcomponent: undefined item");
// 	// } else {
// 	// 	createNewItem();
// 	// }
// };

// /*
//  * Wraps writable store a
//  */
// export function storable(key, initialValue) {
// 	const store = writable(initialValue); // create an underlying store
// 	const { subscribe, set, update } = store;

// 	let json = localStorage.getItem(key); // get the last value from localStorage
// 	if (json) {
// 		// set( JSON.parse(json));
// 		set( JSON.parse(json).map( item => hydrateJSONcomponent(item) ) ); // use the value from localStorage if it exists
// 	}

// 	// return an object with the same interface as Svelte's writable() store interface
// 	return {
// 		set(value) {
// 			localStorage.setItem(key, JSON.stringify(value));
// 			set(value); // capture set and write to localStorage
// 		},

// 		update(cb) {
// 			const value = cb(get(store)); // passes items to callback for invocation e.g items => items.concat(new)
// 			this.set(value); // capture updates and write to localStore
// 		},

// 		get() {
// 			return localStorage.getItem(key);
// 		},

// 		subscribe, // punt subscriptions to underlying store
// 	};
// }

// export const grammarEditorValue = writable(initGrammarEditorValue());
export const grammarEditorValue = writable("");

// export const grammarCompiledParser = writable(compile(default_grammar).output);
export const grammarCompiledParser = writable("");

export const grammarCompilationErrors = writable("");

// export const liveCodeEditorValue = writable(initLiveCodeEditorValue());
export const liveCodeEditorValue = writable("");

export const liveCodeParseResults = writable("");

export const liveCodeParseErrors = writable("");

export const liveCodeAbstractSyntaxTree = writable("");

export const dspCode = writable("");

// export const modelEditorValue = writable(initModelEditorValue());
export const modelEditorValue = writable("");


// export const populateStoresWithFetchedProps = async (newItem) => {


async function updateLiveCodeEditorPropsWithFetchedValues(item){
  
  if(item !== undefined){
    if(item.data === undefined && item.liveCodeSource && item.liveCodeSource !== ``){ // liveCodeEditor with language source, FIRST load 
      try{
        item.data = await fetchFrom(item.liveCodeSource); 
        item.liveCodeSource = ``; // set RELOAD from local storage;
      }
      catch(error){
        console.error("Error fetching props for Live Code Editor item");
      }
    }
    else if (item.liveCodeSource === ``){ // if liveCodeSource is empty string "", reload fetch data from localStorage
      if (localStorage.liveCodeEditorValue && localStorage.liveCodeEditorValue !== ``){
				item.data = localStorage.liveCodeEditorValue;
      }
      else
        console.error("Error fetching props for Live Code Editor item: Local store empty");
    }
    else if (!item.liveCodeSource){ // if liveCodeSource is undefined, it is a 'new' live code editor, set data empty
				item.data = "";
    }
    // else if(item.data !== undefined && item.liveCodeSource) return; // first load, hardcoded defaults 

    if (item.grammarSource !== ``) {
      try {
     		// liveCodeEditor with language source
  			item.grammar = await fetchFrom(item.grammarSource);
			} catch (error) {
				console.error("Error fetching props for Live Code Editor item");
			}
		}
  }
}  

async function updateGrammarEditorPropsWithFetchedValues(item) {
	if (item !== undefined) {
		if (item.data === "" && item.grammarSource !== ``) {
      try {
			  // liveCodeEditor with language source
        item.data = await fetchFrom(item.grammarSource);
        item.grammarSource = ``; // set next RELOAD from local storage;
		  } catch (error) {
		    console.error("Error fetching props for Grammar Editor item", error);
      }
    }
    else if (item.grammarSource == ``) { // reloads fetch data from localStorage
			// liveCodeEditor with language source
			item.grammar = localStorage.grammarEditorValue;
		}
	}
  // else if(item.data !== undefined && item.grammarSource) return; // first load, hardcoded defaults  
}


export async function updateItemPropsWithFetchedValues(item){

  if(item && item !== undefined ){  
    try{
      switch (item.type) {
        case "liveCodeEditor":
          await updateLiveCodeEditorPropsWithFetchedValues(item);
          break;
        case "grammarEditor":
          await updateGrammarEditorPropsWithFetchedValues(item);
          break;
        default:
          break;
      }
    }
    catch(error){
      console.error("Error updating item's props with fetched values.", error);
    } 
  }
  else
    console.error("Error updating item's props with fetched values: item null."); 
}
        

export const populateCommonStoresWithFetchedProps = async (item) => {

  if(item !== null){  
    try{
      switch (item.type) {
				case "liveCodeEditor":
					liveCodeEditorValue.set(item.data);
					grammarEditorValue.set(item.grammar);
					grammarCompiledParser.set(compile(item.grammar).output);
					break;
				case "grammarEditor":
					

					break;
				default:
					break;
			}
    }
    catch(error){
      console.error("Error Populating stores from fetched LiveCode props", error);
    }
  }
  else
    console.error("Error Populating stores from fetched LiveCode props: item null");
}


export const updateItemPropsWithCommonStoreValues = (item) => {

  if(item !== null){  
    try{
      switch (item.type) {
				case "liveCodeEditor":
					item.data = get(liveCodeEditorValue);
					break;
				case "grammarEditor":
					// item.data = get(grammarEditorValue);
					break;
				default:
					break;
			}
    }
    catch(error){
      console.error("Error updating item's props with common store values.", error);
    } 
  }
  else
    console.error(
			"Error updating item's props with common store values: item null."
		); 
}

export const resetStores = () => {
  grammarEditorValue.set("");
  grammarCompiledParser.set("");
  grammarCompilationErrors.set("");
  liveCodeEditorValue.set("");
  liveCodeParseResults.set("");
  liveCodeParseErrors.set("");
  liveCodeAbstractSyntaxTree.set("");
  dspCode.set("");
  modelEditorValue.set("");
}
