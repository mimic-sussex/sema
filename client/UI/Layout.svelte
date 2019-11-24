<script>
	import { onMount, onDestroy } from 'svelte';
  import CodeMirror, { set, update }  from "svelte-codemirror";
  import "codemirror/lib/codemirror.css";
	import Inspect from 'svelte-inspect';

  import {  grammarEditorValue, 
            modelEditorValue, 
            grammarCompiledParser, 
            grammarCompilationErrors, 
            liveCodeEditorValue,
            liveCodeAbstractSyntaxTree,
            liveCodeParseErrors,
            selectedLayout, 
            layoutOptions,
            helloWorld
  } from "../store.js";
  
  const is_browser = typeof window !== "undefined";
  if (is_browser) {
    import("../utils/codeMirrorPlugins");
  }
    
  import * as nearley from 'nearley/lib/nearley.js'
  import compile from '../compiler/compiler';

  import Quadrants from './layouts/Quadrants.svelte';
  import Tutorial from './layouts/Tutorial.svelte';
  import Dashboard from './layouts/Dashboard.svelte';
  import Live from './layouts/Live.svelte';
  import Editor from './Editor.svelte';




  let codeMirror1, codeMirror2;
  let codeMirror3, codeMirror4, codeMirror5;

  export let layoutTemplate = 1;

  // export let value = `:b:{{1,0.25}imp}\\909b;`;


  let liveContainerDisplay = "initial";
  let dashboardContainerDisplay = "initial";
  let quadrantsContainerDisplay = "initial";
  let tutorialContainerDisplay = "initial";

  $: doubled = changeLayout(layoutTemplate);

  function changeLayout (layoutIndex) {
    switch (layoutIndex) {
      case 1:
        liveContainerDisplay =      "initial";
        quadrantsContainerDisplay = "none"; 
        dashboardContainerDisplay = "none";
        tutorialContainerDisplay = "none";
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
      case 5:
        liveContainerDisplay =      "none"; 
        quadrantsContainerDisplay = "none";  
        dashboardContainerDisplay = "none";  
        tutorialContainerDisplay = "initial";
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
    // codeMirror2.set("", "ebnf");
    // codeMirror4.set("", "ebnf");
    // codeMirror1.set("", "js");
    // codeMirror3.set("", "js");
    // codeMirror5.set("", "js");
	});

  let log = (e) => { console.log(e.detail.value); }
  
  let nil = (e) => { }

  // let workerParser = new Worker('../../workerParser.js');

  let parseLiveCode = (e) => { 
  
    if(window.Worker){

      let workerParser = new Worker('../../workerParser.js');

      let workerParserAsync = new Promise( (res, rej) => {

        workerParser.postMessage({liveCodeSource: $liveCodeEditorValue, parserSource: $grammarCompiledParser});

        let timeout = setTimeout(() => {
            workerParser.terminate()
            workerParser = new Worker('../../workerParser.js')
            // rej('Possible infinite loop detected! Check your grammar for infinite recursion.')
        }, 5000);

        workerParser.onmessage = e => {
          if(e.data.message !== undefined){
            // console.log('DEBUG:Layout:workerParserAsync:onmessage')
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
        $liveCodeAbstractSyntaxTree = outputs;
        $liveCodeParseErrors = "";
        console.log('DEBUG:Layout:workerParserAsync') 
      })
      .catch(e => { 
        console.log('DEBUG:Layout:workerParserAsync:catch') 
        console.log(e); 
      });
    }
  }

  let compileGrammarOnChange = (e) => { 
    let {errors, output} = compile(e.detail.value);
    $grammarCompiledParser = output; 
    $grammarCompilationErrors = errors;
    if($grammarCompiledParser && $liveCodeEditorValue){
      $liveCodeEditorValue = e.detail.value;
      parseLiveCode(); 
    }

    console.log('DEBUG:Layout:compileGrammarOnChange');
    console.log(e); 
  }


  let parseLiveCodeOnChange = (e) => {
    if($grammarCompiledParser){
      $liveCodeEditorValue = e.detail.value;
      parseLiveCode(); 
    }
    
    console.log('DEBUG:Layout:parseLiveCodeOnChange');
    console.log(e); 
  }


</script>


<style>

  .layout-template-container {
    height: 100vh;
  }

	.scrollable {
		flex: 1 1 auto;
		border-top: 1px solid #eee;
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
  }

  .codemirror-container :global(.CodeMirror) {
    height: 100%;
    background: transparent;
    font: 400 14px/1.7 var(--font-mono);
    color: var(--base);
  }

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
		border-top: 1px solid #eee;
		margin: 0 0 0.5em 0;
		overflow-y: auto;
	}
</style>


<!-- <div class="layout-template-container" contenteditable="true" bind:innerHTML={layoutTemplate}> -->
<div class="layout-template-container scrollable">

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
      <div slot="liveCodeEditor" class="codemirror-container flex scrollable">
        <CodeMirror bind:this={codeMirror3}  bind:value={$liveCodeEditorValue} lineNumbers={true} flex={false} on:change={nil} /> 
      </div>
      <div slot="grammarEditor" class="codemirror-container flex scrollable">
        <CodeMirror bind:this={codeMirror4}  bind:value={$grammarEditorValue} lineNumbers={true} flex={false} on:change={nil} /> 
      </div> 
      <div slot="modelEditor" class="codemirror-container flex scrollable">
        <CodeMirror bind:this={codeMirror5}  bind:value={$modelEditorValue} lineNumbers={true} flex={false} on:change={nil} /> 
      </div> 
    </Quadrants>
  </div>

  <div class="tutorial-container" style="display:{tutorialContainerDisplay}">
    
    <Tutorial>
      <div slot="grammarEditor" class="codemirror-container flex scrollable">
        <CodeMirror bind:this={codeMirror4}  bind:value={$grammarEditorValue} lineNumbers={true} flex={false} on:change={compileGrammarOnChange} /> 
      </div>
      
      <div slot="liveCodeEditor" class="codemirror-container flex scrollable">
        <CodeMirror bind:this={codeMirror3}  bind:value={$liveCodeEditorValue} lineNumbers={true} flex={false} on:change={parseLiveCodeOnChange} /> 
      </div>

      <div slot="liveCodeCompilerOutput">
      {#if $grammarCompilationErrors !== ""}
        <div style="overflow-y: scroll; height:auto;">
          <strong style="color:red; margin:15px 0 15px 5px">Go work on your grammar!</strong>
        </div>
      {:else if $liveCodeAbstractSyntaxTree && $liveCodeAbstractSyntaxTree.length && $liveCodeParseErrors === ""}
        <div style="overflow-y: scroll; height:auto;">
          <strong style="color:green; margin:15px 0 15px 5px">Abstract Syntax Tree:</strong>
          <br>
          <div style="margin-left:5px">
          <!-- <div style="overflow-y: scroll; height:auto;"> -->
            <Inspect.Value value={$liveCodeAbstractSyntaxTree[0]['@lang']} depth={1} />
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


      <div slot="grammarOutput">
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


  <div class="live-container" style="display:{liveContainerDisplay}">
    <Live>
      <div slot="liveCodeEditor" class="codemirror-container flex scrollable">
        <CodeMirror bind:this={codeMirror1}  bind:value={$liveCodeEditorValue} lineNumbers={true} flex={false} on:change={nil} /> 
      </div>
      <div slot="grammarEditor" class="codemirror-container flex scrollable">
        <CodeMirror bind:this={codeMirror2}  bind:value={$grammarEditorValue} lineNumbers={true} flex={false} on:change={nil} /> 
      </div>
    </Live>
  </div>


</div>
