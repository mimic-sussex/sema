<script context="module">
  const is_browser = typeof window !== "undefined";

  import CodeMirror, { set, update } from "svelte-codemirror";
  import "codemirror/lib/codemirror.css";

  if (is_browser) {
    import("../utils/codeMirrorPlugins");
  }
</script>

<script>
	import { onMount, onDestroy } from 'svelte';
	import Inspect from 'svelte-inspect';

  import {  modelEditorValue,
            grammarCompiledParser,
            grammarCompilationErrors,
            liveCodeEditorValue,
            liveCodeParseResults,
            liveCodeParseErrors,
            liveCodeAbstractSyntaxTree,
            dspCode,
            selectedLayout,
            layoutOptions,
            helloWorld
  } from "../store.js";

  import {
    playAudio,
    stopAudio,
    evalDSP
  } from '../audioEngine/audioEngineController.js';

  import IRToJavascript from "../intermediateLanguage/IR.js";

  import ModelWorker from "worker-loader!../../workers/ml.worker.js";

  let codeMirror;


  const unsubscribe2 = grammarEditorValue.subscribe(value => {
    // console.log("DEBUG:Layout:grammarEditorValue: ", value);
    //  grammarCompiledParser
    // let liveParser = new nearley.Parser(nearley.Grammar.fromCompiled(grammarCompiled));
    // let c = compile(value)
    // let {errors, output} = c;
    // console.log("DEBUG:Layout:grammarEditorValue: ", errors);
    // changeLayout(value.id);
  })

  onMount(async () => {

    codeMirror.set($modelEditorValue, "js");

    changeLayout(1); // [NOTE:FB] Need this call to clean up pre-loaded panels and trigger a re-render
	});

  let log = (e) => { console.log(e.detail.value); }

  let nil = (e) => { }


  let parseLiveCode = e => {

    if(window.Worker){

      // let parserWorker = new Worker('../../parser.worker.js');
      let parserWorker = new ParserWorker();
      // let parserWorker = new Worker('./parser.worker.js', { type: 'module' });

      let parserWorkerAsync = new Promise( (res, rej) => {

        parserWorker.postMessage({liveCodeSource: $liveCodeEditorValue, parserSource: $grammarCompiledParser, type:'parse'});

        let timeout = setTimeout(() => {
            parserWorker.terminate()
            // parserWorker = new Worker('../../parser.worker.js');
            parserWorker = new ParserWorker();
            // parserWorker = new Worker('./parser.worker.js', { type: 'module' });
            // rej('Possible infinite loop detected! Check your grammar for infinite recursion.')
        }, 5000);

        parserWorker.onmessage = e => {
          if(e.data.message !== undefined){
            // console.log('DEBUG:Layout:parseLiveCode:onmessage')
            // console.log(e);
            $liveCodeParseErrors = e.data.message;
          }
          else if(e.data !== undefined && e.data.length != 0){
            res(e.data);
          }
          clearTimeout(timeout);
        }

      })
      .then(outputs => {

        // console.log('DEBUG:Layout:parseLiveCode:then')
        // console.log(outputs); 
        const {parserOutputs, parserResults} = outputs;

        // $liveCodeParseResults = outputs;
        $liveCodeParseResults = parserResults;

        // console.log(outputs); 
        $liveCodeAbstractSyntaxTree = parserOutputs;


        // $liveCodeAbstractSyntaxTree = JSON.parse(JSON.stringify(parserOutputs));

        $liveCodeParseErrors = "";
        // console.log('DEBUG:Layout:parserWorkerAsync');
      })
      .catch(e => {
        // console.log('DEBUG:Layout:parserWorkerAsync:catch')
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

      // console.log('DEBUG:Layout:compileGrammarOnChange');
      // console.log($grammarCompiledParser); 

      if($grammarCompiledParser && ( $liveCodeEditorValue && $liveCodeEditorValue !== "") ){
        $liveCodeEditorValue = e.detail.value;

        // console.log('DEBUG:Layout:compileGrammarOnChange');
        // console.log($liveCodeEditorValue); 

        parseLiveCode();
  
      }
    }
    catch (e) {


    }

    // console.log('DEBUG:Layout:compileGrammarOnChange');
    // console.log(e);
  }


  let parseLiveCodeOnChange = e => {
    // console.log('DEBUG:Layout:parseLiveCodeOnChange');
    // console.log($liveCodeEditorValue); 
    if($grammarCompiledParser){
      $liveCodeEditorValue = e.detail.value;
      window.localStorage.liveCodeEditorValue = e.detail.value;
      e.detail.value
      parseLiveCode();
    }
  }

  let translateILtoDSP = e => {
    
    $dspCode = IRToJavascript.treeToCode($liveCodeParseResults);
    
    evalDSP($dspCode); 
  }
 
  let translateILtoDSPasync = e => {  // [NOTE:FB] Note the 'async'

    if(window.Worker){

      // let iLWorker = new Worker('../../il.worker.js');
      let iLWorker = new ILWorker();
      let iLWorkerAsync = new Promise( (res, rej) => {

        iLWorker.postMessage({ liveCodeAbstractSyntaxTree: $liveCodeParseResults, type:'ASTtoDSP'});

        let timeout = setTimeout(() => {
            iLWorker.terminate();
            // iLWorker = new Worker('../../il.worker.js');
            // iLWorker = new Worker('./il.worker.js', { type: 'module' });
            iLWorker = new ILWorker();
            // rej('Possible infinite loop detected or worse! Check bugs in ILtoTree.')
        }, 5000);

        iLWorker.onmessage = e => {
          if(e.data !== undefined){
            // console.log('DEBUG:Layout:translateILtoDSP:onmessage')
            // console.log(e);
            // $dspCode = e.data.message;
            res(e.data);
          }
          else if(e.data !== undefined && e.data.length != 0){
            res(e.data);
          }
          clearTimeout(timeout);
        }
      })
      .then(outputs => {
        $dspCode = outputs;
        evalDSP($dspCode);

        // $liveCodeParseErrors = "";
        // console.log('DEBUG:Layout:translateILtoDSPasync');
        // console.log($dspCode);
      })
      .catch(e => {
        // console.log('DEBUG:Layout:translateILtoDSPasync:catch')
        // console.log(e);
      });
    }
  }

  let cmdEnter = () => {
    // console.log('DEBUG:Layout:cmdEnter')
    // console.log($liveCodeAbstractSyntaxTree);
    if($grammarCompiledParser && $liveCodeEditorValue && $liveCodeAbstractSyntaxTree){
      
      translateILtoDSPasync();
      
      // translateILtoDSP();
    }
  }

  let ctrlEnter = () => {

    translateILtoDSP();
  }



  let cmdPeriod = () => playAudio();




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
    line-height: 1.5;
    overflow: hidden;
    font-family: monospace;
  }

  .codemirror-container :global(.CodeMirror) {
    height: 100%;
    background: transparent;
    font: 400 14px/1.7 var(--font-mono);
    color: var(--base);
    /* color: antiquewhite; */
  }


  .codemirror-container-live-code {
    height: 100%;
    background: transparent;
    font: 400 14px/1.7 var(--font-mono);
    /* color: var(--base); */
    color: antiquewhite;
    font-family: monospace;
  }


  .codemirror-cursor :global(.CodeMirror-cursor) {
    border-left: 2px solid rgb(255, 136, 0);
    border-right: none;
    width: 0;
  }

  /* .codemirror-linenumber :global(.CodeMirror-linenumbers) {
    width: 15px;
  } */

  .codemirror-linenumber :global(.CodeMirror-linenumber) {
    left: 2px; width: 21px;
    width: 15px;
  }

  .codemirror-gutter :global(.CodeMirror-gutters) {
    width: 20px;
  }
  
  /* .CodeMirror-linenumbers :global(.Codemirror-linenumber){

  } */

  .codemirror-container.flex :global(.CodeMirror) {
    height: auto;
  }

  .codemirror-container.flex :global(.CodeMirror-lines) {
    padding: 0;
  }

  .codemirror-container :global(.CodeMirror-gutters) {
    padding: 0 16px 0 8px;
    border: none;
  }

  .codemirror-container :global(.error-loc) {
    position: relative;
    border-bottom: 2px solid #da106e;
  }

  .codemirror-container :global(.error-line) {
    background-color: rgba(200, 0, 0, 0.05);
  }

	.scrollable {
		flex: 1 1 auto;
		/* border-top: 1px solid #eee; */
		margin: 0 0 0.5em 0;
		overflow-y: auto;
	}





</style>


<!-- <div class="layout-template-container" contenteditable="true" bind:innerHTML={layoutTemplate}> -->
<div class="layout-template-container scrollable">

  <div class="live-container" style="display:{liveContainerDisplay}">
    <div slot="liveCodeEditor" class="codemirror-container flex scrollable">
      <CodeMirror bind:this={codeMirror}  bind:value={$liveCodeEditorValue} lineNumbers={true}  on:change={nil} />
    </div>
  </div>

</div>
