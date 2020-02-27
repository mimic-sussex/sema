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

  .codemirror-container {
    position: relative;
    width: 100%;
    height: 100%;
    border: none;
    line-height: 1.4;
    overflow: hidden;
    font-family: monospace;
    margin-top: 20px;
  }

	.scrollable {
		flex: 1 1 auto;
		/* border-top: 1px solid #eee; */
		margin: 0 0 0.5em 0;
		overflow-y: auto;
	}

  .headline {
    overflow-y: scroll; height:auto; margin-top:6px 
  }

  .error-state {
    color:red; 
    margin:15px 0px 15px 25px;
  }

  .correct-state {
    color:green; 
    margin:15px 0px 15px 25px;

  }

</style>


<div id="liveCodeCompilerOutput" class="codemirror-container flex scrollable">
  {#if $grammarCompilationErrors != ""}
  <div class="headline">
    <strong class="error-state">Go work on your grammar!</strong>
  </div>
  {:else if $liveCodeParseErrors !=='' }
  <div class="headline">
    <strong class="error-state">Live Code Syntax Error</strong>
    <br>
    <div style="margin-left:5px">
    <!-- <div style="overflow-y: scroll; height:auto;"> -->
      <span style="white-space: pre-wrap">{ $liveCodeParseErrors } </span>
    </div>
  </div>
  {:else}
  <div class="headline">
    <strong class="correct-state">Abstract Syntax Tree:</strong>
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
