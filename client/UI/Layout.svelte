<script>
	import { onMount, onDestroy } from 'svelte';
  import CodeMirror, { set, update }  from "svelte-codemirror";
  import "codemirror/lib/codemirror.css";

  import { liveCodeEditorValue, grammarEditorValue, modelEditorValue } from "../store.js";
  import { grammarCompiledParser, grammarCompilationErrors } from "../store.js";
  import { selectedLayout, layoutOptions } from '../store.js';
  import { helloWorld } from "../store.js";
  
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

  let log = (e) => { /* console.log(e.detail.value); */ }

  let log2 = (e) => { 

    

    let {errors, output} = compile(e.detail.value);
    $grammarCompiledParser = output; 
    $grammarCompilationErrors = errors; 


    console.log("DEBUG:Layout:grammarEditorValue: ", errors);
    // console.log(e.detail.value);
    // console.log("DEBUG:Layout:grammarEditorValue: ", compile(value).output);
    // console.log("DEBUG:Layout:grammarEditorValue: ", compile(e.detail.value).output);
    // console.log("DEBUG:Layout:grammarEditorValue: ", compile(e.detail.value).errors);
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
        <CodeMirror bind:this={codeMirror3}  bind:value={$liveCodeEditorValue} lineNumbers={true} flex={false} on:change={log} /> 
      </div>
      <div slot="grammarEditor" class="codemirror-container flex scrollable">
        <CodeMirror bind:this={codeMirror4}  bind:value={$grammarEditorValue} lineNumbers={true} flex={false} on:change={log} /> 
      </div> 
      <div slot="modelEditor" class="codemirror-container flex scrollable">
        <CodeMirror bind:this={codeMirror5}  bind:value={$modelEditorValue} lineNumbers={true} flex={false} on:change={log} /> 
      </div> 
    </Quadrants>
  </div>

  <div class="tutorial-container" style="display:{tutorialContainerDisplay}">
    
    <Tutorial>
      <div slot="grammarEditor" class="codemirror-container flex scrollable">
        <CodeMirror bind:this={codeMirror4}  bind:value={$grammarEditorValue} lineNumbers={true} flex={false} on:change={log2} /> 
      </div>
      
      <div slot="liveCodeEditor" class="codemirror-container flex scrollable">
        <CodeMirror bind:this={codeMirror3}  bind:value={$liveCodeEditorValue} lineNumbers={true} flex={false} on:change={log} /> 
      </div>

      <div slot="liveCodeCompilerOutput">
      </div>
      <div slot="grammarOutput">
        <h5>Grammar compilation errors:</h5>
        <span style="white-space: pre-wrap">{ $grammarCompilationErrors } </span>
        
      </div>
    </Tutorial>
  </div>


  <div class="live-container" style="display:{liveContainerDisplay}">
    <Live>
      <div slot="liveCodeEditor" class="codemirror-container flex scrollable">
        <CodeMirror bind:this={codeMirror1}  bind:value={$liveCodeEditorValue} lineNumbers={true} flex={false} on:change={log} /> 
      </div>
      <div slot="grammarEditor" class="codemirror-container flex scrollable">
        <CodeMirror bind:this={codeMirror2}  bind:value={$grammarEditorValue} lineNumbers={true} flex={false} on:change={log} /> 
      </div>
    </Live>
  </div>


</div>
