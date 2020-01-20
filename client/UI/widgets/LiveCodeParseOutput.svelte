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
	import Inspect from 'svelte-inspect';

  import { 
    grammarCompilationErrors, 
    liveCodeParseErrors,
    liveCodeAbstractSyntaxTree  
  } from "../../store.js";
  
  onMount(async () => {
    
	});

  onDestroy(async () => {

	});
  

  let log = (e) => { console.log(e.detail.value); }

  let nil = (e) => { }


</script>


<style>

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


<div id="liveCodeCompilerOutput" class="codemirror-container flex scrollable">
  {#if $grammarCompilationErrors != ""}
  <div style="overflow-y: scroll; height:auto;">
    <strong style="color:red; margin:15px 0 15px 5px">Go work on your grammar!</strong>
  </div>
  {:else if $liveCodeParseErrors !=='' }
  <div style="overflow-y: scroll; height:auto;">
    <strong style="color: red; margin:15px 0 10px 5px">Live Code Syntax Error</strong>
    <br>
    <div style="margin-left:5px">
    <!-- <div style="overflow-y: scroll; height:auto;"> -->
      <span style="white-space: pre-wrap">{ $liveCodeParseErrors } </span>
    </div>
  </div>
  {:else}
  <div style="overflow-y: scroll; height:auto;">
    <strong style="color:green; margin:15px 0 15px 5px">Abstract Syntax Tree:</strong>
    <br>
    <div style="margin-left:5px">
    <!-- <div style="overflow-y: scroll; height:auto;"> -->
      <Inspect.Value value={ $liveCodeAbstractSyntaxTree } depth={7} />
      <!-- Expression below causes error when AST is empty -->
      <!-- <Inspect.Value value={ $liveCodeAbstractSyntaxTree[0]['@lang'] } depth={7} /> -->
    </div>
  </div>
  {/if}
</div>
