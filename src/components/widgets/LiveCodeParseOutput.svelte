<script>
	import { onMount, onDestroy } from 'svelte';

  import {
    grammarCompilationErrors,
    liveCodeParseErrors,
    liveCodeAbstractSyntaxTree,
    siteMode,
    dspCode
  } from "../../stores/common.js";

  import JSONTree from 'svelte-json-tree-auto';

  export let id;
  export let name;
	export let type;
  export let hasFocus;
  export let background;
	export let lineNumbers;
	export let theme;
  export let component;
  export let className;
  export { className as class };



 	let log = e => { /* console.log(...e); */ }

  let nil = (e) => { }

	let showAST = false;

  $: getAST(showAST)
  let value = {};
  function getAST(showAST){
    if (showAST){
      value = $liveCodeAbstractSyntaxTree[0];
    }
  }

  onMount(async () => {
    log( id, name, type, className, lineNumbers, hasFocus, theme, background, component );

	});

  onDestroy(async () => {

  });

  //update the background depending on the state of errors
  $:backgroundColour = updateBackground($grammarCompilationErrors, $liveCodeParseErrors, $dspCode)
  
  function updateBackground(){
    if ($grammarCompilationErrors !== ""){
      return "background-color:rgb(20, 0, 0)";
    } else if ($liveCodeParseErrors !== "") {
      return "background-color:rgb(20, 0, 0)";
    } else if ($dspCode){
      if ($dspCode.errorMessage !== "") {
        return "background-color:rgb(20, 0, 0)";
      } else {
        return "background-color:rgb(0, 20, 0)";
      }
    }
  }

</script>


<style>

  .liveCodeParse-container {
    position: relative;
    width: 100%;
    height: 100%;
    border: none;
    line-height: 1.4;
    overflow: hidden;
    margin-top: 20px;
		/*  */
  }

	.scrollable {
		flex: 1 1 auto;
		/* border-top: 1px solid #eee; */
		margin: 0 0 0.5em 0;
		overflow-y: auto;

	}

  .error-state {
    color:rgb(220, 0, 0);
    margin-top: 3px;
    margin-left: 5px;
    margin-bottom: 10px;
  }

  .correct-state {
    color:var(--color-gray);
    margin:25px 0px 15px 0px;
    color:rgb(0, 220, 0);
  }


  .headline {
    /* overflow-y: scroll; */
    height:auto;
    margin-left: 5px;
    margin-bottom: 10px;
  }

  .prewrap {
    display: inline-flexbox;
    width: 100%;
    overflow-x: auto;
    white-space: pre-wrap;
    white-space: -moz-pre-wrap;
    white-space: -pre-wrap;
    white-space: -o-pre-wrap;
    word-wrap: break-word;
    /* margin:5px 0px 15px 5px; */
    font-family: monospace;
    font-size:1em;
    font-weight:800;
    -moz-user-select: text;
    -khtml-user-select: text;
    -webkit-user-select: text;
    -ms-user-select: text;
    user-select: text;
  }

  span {
    font-family: monospace;
  }

  /* .inspect {
    font-family: Menlo, Consolas, Lucida Console, Courier New, Dejavu Sans Mono, monospace;
    font-size: 16px;
    line-height: 1.35;
    color: var(--color-white);
    --color-red: darkred;
    --color-blue: darkblue;
    --color-green: darkgreen;
    --color-purple: purple;
    --color-orange: darkorange;
    --color-yellow: gold;
    --color-brown: darkgoldenrod;
    --color-pink: hotpink;
    --color-gray: #a0a0a0;
    --color-black: #202020;
    --color-white: #f0f0f0;
    --color-selection: lightskyblue;
  } */

</style>


<div 	id="liveCodeCompilerOutput"
			class="liveCodeParse-container flex scrollable"
			style="{ backgroundColour }"
			>
  {#if $grammarCompilationErrors != ""}
    <div>
      <span class="error-state">Go work on your grammar!</span>
    </div>
  {:else if $liveCodeParseErrors !== ""}  
      <div style="margin-left:5px">
        <span class="prewrap  error-state">{ $liveCodeParseErrors } </span>
      </div>
  {:else}
    {#if $dspCode}
      {#if $dspCode.errorMessage !== ""}
      <div style="margin-left:5px">
          <span class="prewrap error-state">Error: <br> {$dspCode.errorMessage}</span>
      </div>
      {:else}
      
        {#if showAST }
          <div class="headline">
            <span class="correct-state">Abstract Syntax Tree </span>(
            <span style="cursor:pointer;text-decoration:underline;" on:click="{() => { showAST = false; }}"> show less detail </span>)
            <br>
            <!-- <div style="margin-left:5px"> -->
            {#if $siteMode === 'dark' }
              <div style="height:auto;"
                    class='inspect'
                    >
                    <JSONTree { value } />
              </div>
            {:else}
              <div style="height:auto;"
                    class='inspect'
                    >
                    <JSONTree { value } />
              </div>
            {/if}
          </div>
        {:else}
          <div class="headline">
            <span class="correct-state">Live Code correct </span>(
            <span style="cursor:pointer;text-decoration:underline;" on:click="{() => { showAST = true; }}"> show Abstract Syntax Tree </span>)
          </div>
        {/if}
      {/if}

    {:else}
      <span>No code run yet. <br> Go to the live code editor and press cmd-Enter [Mac] OR ctrl-Enter [Win/Linux] to evaluate some code.</span>
    {/if}
  
  {/if}
</div>
