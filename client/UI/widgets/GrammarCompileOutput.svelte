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
    grammarCompilationErrors
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
		overflow-y: hidden;
	}


</style>

<div id="grammarOutput" class="codemirror-container flex scrollable">
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