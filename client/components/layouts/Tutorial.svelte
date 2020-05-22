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

  import {  grammarEditorValue,
            modelEditorValue,
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
  } from "../stores/store.js";

  import {
    playAudio,
    stopAudio,
    evalDSP
  } from '../audioEngine/audioEngineController.js';

  import IRToJavascript from "../intermediateLanguage/IR.js";
  
  import * as nearley from 'nearley/lib/nearley.js'
  import compile from '../compiler/compiler';

  import Quadrants from './layouts/Quadrants.svelte';
  import Tutorial from './layouts/Tutorial.svelte';
  import Dashboard from './layouts/Dashboard.svelte';
  import Live from './layouts/Live.svelte';
  import Editor from '../editors/Editor.svelte';

  import ParserWorker from "worker-loader!../../workers/parser.worker.js";
  import ILWorker from "worker-loader!../../workers/il.worker.js"


  let codeMirror1, codeMirror2; // Live layout [Hidden]

  let codeMirror3, codeMirror4, codeMirror5; // []

  let codeMirror6, codeMirror7;

  export let layoutTemplate = 1;

  let liveContainerDisplay = "initial";
  let dashboardContainerDisplay = "initial";
  let quadrantsContainerDisplay = "initial";
  let tutorialContainerDisplay = "initial";

  $: doubled = changeLayout(layoutTemplate);

  function changeLayout (layoutIndex) {
    switch (layoutIndex) {
      case 1:
        liveContainerDisplay =      "none";
        quadrantsContainerDisplay = "none";
        dashboardContainerDisplay = "none";
        tutorialContainerDisplay = "initial";
        break;
      case 2:
        liveContainerDisplay =      "none";
        quadrantsContainerDisplay = "initial";
        dashboardContainerDisplay = "none";
        tutorialContainerDisplay = "none";
        break;
      case 3:
        liveContainerDisplay =      "none";
        quadrantsContainerDisplay = "none";
        dashboardContainerDisplay = "initial";
        tutorialContainerDisplay = "none";
        break;
      case 4:
        liveContainerDisplay =      "initial";
        quadrantsContainerDisplay = "none";
        dashboardContainerDisplay = "none";
        tutorialContainerDisplay = "none";
        break;
      default:
        liveContainerDisplay =      "initial";
        quadrantsContainerDisplay = "initial";
        dashboardContainerDisplay = "initial";
        tutorialContainerDisplay = "initial";
        break;
    }
  }

  const unsubscribe = selectedLayout.subscribe(value => {
    // console.log("DEBUG:Layout:selectedlayout: ", value.id);
    changeLayout(value.id);
  })
	// onDestroy(unsubscribe); // Prevent memory leaks by disposing the component

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
    codeMirror1.set($grammarEditorValue, "ebnf");
    codeMirror2.set($liveCodeEditorValue, "sema");
    codeMirror3.set($liveCodeEditorValue, "sema");
    codeMirror4.set($grammarEditorValue, "ebnf");
    codeMirror5.set($modelEditorValue, "js");
    // codeMirror6.set($grammarEditorValue, "ebnf");
    // codeMirror7.set($modelEditorValue, "js");

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


  /* .codemirror-cursor :global(.CodeMirror-cursor) {
    border-left: 2px solid rgb(255, 136, 0);
    border-right: none;
    width: 0;
  } */

  /* .codemirror-linenumber :global(.CodeMirror-linenumbers) {
    width: 15px;
  } */
/* 
  .codemirror-linenumber :global(.CodeMirror-linenumber) {
    left: 2px; width: 21px;
    width: 15px;
  } */
/* 
  .codemirror-gutter :global(.CodeMirror-gutters) {
    width: 20px;
  } */
  
  /* .CodeMirror-linenumbers :global(.Codemirror-linenumber){

  } */
/* 
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
  } */







</style>


<!-- <div class="layout-template-container" contenteditable="true" bind:innerHTML={layoutTemplate}> -->
<div class="layout-template-container scrollable">

  <div class="tutorial-container" style="display:{tutorialContainerDisplay}">

    <Tutorial>
      <div slot="grammarEditor" class="codemirror-container flex scrollable codemirror-gutter codemirror-linenumber">
        <CodeMirror bind:this={codeMirror1}  
                    bind:value={$grammarEditorValue} 
                    tab={true} 
                    lineNumbers={true}  
                    on:change={compileGrammarOnChange}  /> 
      </div>
      
      <div slot="liveCodeEditor" class="codemirror-container flex scrollable codemirror-container-live-code codemirror-cursor codemirror-linenumber codemirror-gutter">
        <CodeMirror bind:this={codeMirror2}  
                    bind:value={$liveCodeEditorValue} 
                    tab={true} 
                    lineNumbers={true} 
                    on:change={parseLiveCodeOnChange} 
                    cmdEnter={cmdEnter} 
                    ctrlEnter={ctrlEnter} 
                    cmdPeriod={cmdPeriod} /> 
      </div>

      <div slot="liveCodeCompilerOutput" class="codemirror-container flex scrollable">
      {#if $grammarCompilationErrors !== ""}
        <div style="overflow-y: scroll; height:auto;">
          <strong style="color:red; margin:15px 0 15px 5px">Go work on your grammar!</strong>
        </div>
      {:else if $liveCodeAbstractSyntaxTree && $liveCodeAbstractSyntaxTree.length && !$liveCodeParseErrors}
        <div style="overflow-y: scroll; height:auto;">
          <strong style="color:green; margin:15px 0 15px 5px">Abstract Syntax Tree:</strong>
          <br>
          <div style="margin-left:5px">
          <!-- <div style="overflow-y: scroll; height:auto;"> -->
            <Inspect.Value value={ $liveCodeAbstractSyntaxTree[0]['@lang'] } depth={7} />
          </div>
        </div>
      {:else}
        <div style="overflow-y: scroll; height:auto;">
          <strong style="color: red; margin:15px 0 10px 5px">SyntaxError: Invalid or unexpected token!</strong>
          <br>
          <div style="margin-left:5px">
          <!-- <div style="overflow-y: scroll; height:auto;"> -->
            <span style="white-space: pre-wrap">{ $liveCodeParseErrors } </span>
          </div>
        </div>
      {/if}
      </div>


      <div slot="grammarOutput" class="codemirror-container flex scrollable">
      {#if $grammarCompilationErrors !== ""}
        <div style="overflow-y: scroll; height:auto;">
          <strong style="color:red; margin:15px 0 15px 5px">Grammar compilation errors:</strong>
          <br>
          <div style="margin-left:5px">
          <!-- <div style="overflow-y: scroll; height:auto;"> -->
            <span style="white-space: pre-wrap">{ $grammarCompilationErrors } </span>
          </div>
        </div>
      {:else}
        <div style="overflow-y: scroll; height:auto;">
          <strong style="color: green; margin:15px 0 10px 5px">Grammar validated and parser generated!</strong>
        </div>
      {/if}
      </div>


    </Tutorial>
  </div>

  <div class="dashboard-container" style="display:{dashboardContainerDisplay}" >
    <!-- <Dashboard liveCodeEditorValue={value} grammarEditorValue={value} modelEditorValue={value} /> -->
    <Dashboard>
    </Dashboard>
  </div>

  <div class="quadrants-container" style="display:{quadrantsContainerDisplay}">
    <!-- <Quadrants liveCodeEditorValue={value} grammarEditorValue={value} modelEditorValue={value}  /> -->
    <Quadrants>
      <div slot="viz">
        <!-- <Oscilloscope></Oscilloscope>
        <Spectrogram></Spectrogram> -->
      </div>
      <div slot="liveCodeEditor" class="codemirror-container flex scrollable codemirror-gutter codemirror-linenumber">
        <CodeMirror bind:this={codeMirror3}  bind:value={$liveCodeEditorValue} lineNumbers={true} on:change={nil} />
      </div>
      <div slot="grammarEditor" class="codemirror-container flex scrollable codemirror-gutter codemirror-linenumber">
        <CodeMirror bind:this={codeMirror4}  bind:value={$grammarEditorValue} lineNumbers={true} on:change={nil} />
      </div>
      <div slot="modelEditor" class="codemirror-container flex scrollable codemirror-gutter codemirror-linenumber">
        <CodeMirror bind:this={codeMirror5}  bind:value={$modelEditorValue} lineNumbers={true}  on:change={nil} />
      </div>
    </Quadrants>
  </div>

  <div class="live-container" style="display:{liveContainerDisplay}">
    <Live>
      <div slot="liveCodeEditor" class="codemirror-container flex scrollable">
        <CodeMirror bind:this={codeMirror6}  bind:value={$liveCodeEditorValue} lineNumbers={true}  on:change={nil} />
      </div>
      <div slot="grammarEditor" class="codemirror-container flex scrollable">
        <CodeMirror bind:this={codeMirror7}  bind:value={$grammarEditorValue} lineNumbers={true}  on:change={nil} />
      </div>
    </Live>
  </div>

</div>
