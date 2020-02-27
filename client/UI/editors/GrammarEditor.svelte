<script context="module">
  const is_browser = typeof window !== "undefined";

  import CodeMirror, { set, update } from "svelte-codemirror";
  import "codemirror/lib/codemirror.css";

  if (is_browser) {
    import("../../utils/codeMirrorPlugins");
  }
</script>

<script>
	import { onMount, onDestroy } from 'svelte';

  import {  
    grammarEditorValue,
    grammarCompiledParser, 
    grammarCompilationErrors
  } from "../../store.js";

  import * as nearley from 'nearley/lib/nearley.js'
  import compile from '../../compiler/compiler';

  import ModelWorker from "worker-loader!../../workers/ml.worker.js";

  let codeMirror;
  let modelWorker; 
  export let value;

  onMount(async () => {
    codeMirror.set(value, "ebnf");
    // modelWorker = new ModelWorker();  // Create one worker per widget lifetime
	});

  onDestroy(async () => {
    // modelWorker.terminate();
	});
  

  let log = (e) => { console.log(e.detail.value); }

  let nil = (e) => { }

  let evalModelCode = e => {

    if(window.Worker){
      let modelWorkerAsync = new Promise( (res, rej) => {

        modelWorker.postMessage({
          eval: e
        });

        modelWorker.onmessage = m => {
          if(m.data.message !== undefined){
            // console.log('DEBUG:ModelEditor:evalModelCode:onmessage')
            // console.log(e);
            console.log(m.data.message);
          }
          else if(m.data !== undefined && m.data.length != 0){
            res(m.data);
          }
          clearTimeout(timeout);
        }
      })
      .then(outputs => {

      })
      .catch(e => {
        // console.log('DEBUG:ModelEditor:parserWorkerAsync:catch')
        // console.log(e);
      });
    }
  }

  let compileGrammarOnChange = e => { 

    let grammarEditorValue = null; 

    if(e !== undefined && e.detail !== undefined && e.detail.value !== undefined)
      grammarEditorValue = e.detail.value; 
    else 
      grammarEditorValue = $grammarEditorValue; 

    try {
      window.localStorage.grammarEditorValue = grammarEditorValue;
      let {errors, output} = compile(grammarEditorValue);
      $grammarCompiledParser = output; 
      $grammarCompilationErrors = errors;

      // console.log('DEBUG:GrammarEditor:compileGrammarOnChange');
      // console.log($grammarCompiledParser);
      // console.log($grammarCompilationErrors); 
    }
    catch (e) {


    }
  }



</script>


<style>

  .layout-template-container {
    height: 100vh;
  }

	.scrollable {
		flex: 1 1 auto;
		/* border-top: 1px solid #eee; */
		margin: 0 0 0.5em 0;
		overflow-y: auto;
	}

  .codemirror-container {
    position: relative;
    width: 100%;
    height: 100%;
    border: none;
    line-height: 1.4;
    overflow: hidden;
    font-family: monospace;
  }

  .codemirror-container :global(.CodeMirror) {
    height: 100%;
    background: transparent;
    font: 400 14px/1.7 var(--font-mono);

  }



  /* .codemirror-container :global(.error-loc) {
    position: relative;
    border-bottom: 2px solid #da106e;
  } */

  /* .codemirror-container :global(.error-line) {
    background-color: rgba(200, 0, 0, 0.05);
  } */



</style>

<!-- <div class="layout-template-container" contenteditable="true" bind:innerHTML={layoutTemplate}> -->
<div class="codemirror-container layout-template-container scrollable">
  <CodeMirror bind:this={codeMirror}  
              bind:value={value} 
              tab={true} 
              lineNumbers={true}  
              on:change={compileGrammarOnChange}  /> 
</div>
 