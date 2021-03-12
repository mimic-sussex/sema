import { get, writable } from "svelte/store";

// import compile from "../compiler/compiler";
import { compile } from "sema-engine/sema-engine";


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



export const siteMode = writable('dark');

export const engineStatus = writable('no-audio');
export const unsupportedBrowser = writable(false);
;


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

  if (item !== undefined && item.data !== undefined) {
		if (
			item.data.liveCodeSource
      && item.data.liveCodeSource !== ``
      && !item.data.content
		) {
			// liveCodeEditor with language source, FIRST load
			try {
				item.data.content = await fetchFrom(item.data.liveCodeSource)
				item.data.liveCodeSource = `` // set RELOAD from local storage;
    	} catch (error) {
				console.error('Error fetching props for Live Code Editor item')
			}
		} else if (item.data.liveCodeSource === ``) {
			// if liveCodeSource is empty string "", reload fetch data from localStorage
			if (
				localStorage.liveCodeEditorValue
        && localStorage.liveCodeEditorValue !== ``
			) {
				item.data.content = localStorage.liveCodeEditorValue
			} else
				console.error(
					'Error fetching props for Live Code Editor item: Local store empty'
				)
		} else if (!item.data.liveCodeSource) {
			// if liveCodeSource is undefined, it is a 'new' live code editor, set data empty
			item.data.content = ''
		}
		// else if(item.data !== undefined && item.liveCodeSource) return; // first load, hardcoded defaults

		if (item.data.grammarSource !== ``) {
			try {
				// liveCodeEditor with language source
				const fetchedGrammar = await fetchFrom(item.data.grammarSource)
				item.data.grammar = fetchedGrammar;
				// item.data.grammarSource = ``; // CAN'T USE THIS TO signal next LOAD from local storage, ITEM PROPS will send event with these props
				// localStorage.grammarEditorValue = fetchedGrammar;
			} catch (error) {
				console.error("Error fetching props for Live Code Editor item");
			}
		}
    else if(item.data.grammarSource === ''
            && localStorage.grammarEditorValue
            && localStorage.grammarEditorValue !== ``
    ){
			try {
        // if liveCodeSource is empty string "", reload fetch data from localStorage
        item.data.grammar = localStorage.grammarEditorValue
			} catch (error) {
				console.error('Error fetching props for Live Code Editor item')
			}
    }
	}
}

async function updateGrammarEditorPropsWithFetchedValues(item) {
	if (item && item.data) {
    if (item.data.content && item.data.content !== ``)
    {
      return;
    }
		else if (item.data.grammarSource && item.data.grammarSource !== ``) {
			try {
				// liveCodeEditor with language source
				item.data.content = await fetchFrom(item.data.grammarSource)
				item.data.grammarSource = `` // set next RELOAD from local storage;
			} catch (error) {
				console.error('Error fetching props for Grammar Editor item', error)
			}
		} else if (!item.data.grammarSource || item.data.grammarSource === ``) {
			// fetch data from localStorage
			// liveCodeEditor with language source
			item.data.content = localStorage.grammarEditorValue
		}
	}
  // else if(item.data !== undefined && item.grammarSource) return; // first load, hardcoded defaults
}


export async function updateItemPropsWithFetchedValues(item){

  if(item && item !== undefined ){
    try{
      switch (item.data.type) {
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
      switch (item.data.type) {
				case "liveCodeEditor":
					liveCodeEditorValue.set(item.data.content);
					grammarEditorValue.set(item.data.grammar);
					grammarCompiledParser.set(compile(item.data.grammar).output);
					break;
				case "grammarEditor":
          grammarEditorValue.set(item.data.content)
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

  if(item){
    try{
      switch (item.data.type) {
				case "liveCodeEditor":
					item.data.content = get(liveCodeEditorValue);
					break;
				case "grammarEditor":
					item.data.content = get(grammarEditorValue);
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
