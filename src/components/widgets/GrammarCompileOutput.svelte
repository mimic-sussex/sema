<script>
	import { onMount, onDestroy } from 'svelte';

  import {
    grammarCompilationErrors
  } from "../../stores/common.js";



  let log = (e) => {  }

  let nil = (e) => { }

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

  onMount(async () => {

    log( id, name, type, className, lineNumbers, hasFocus, theme, background, component );

	});

  onDestroy(async () => {

	});

</script>


<style>

  .grammarCompiler-container {
    position: relative;
    width: 100%;
    height: 100%;
    border: none;

    line-height: 1.4;
    overflow: hidden;
    /* font-family: monospace; */
  }

	.scrollable {
		flex: 1 1 auto;
		/* border-top: 1px solid #eee; */
		margin: 0 0 0.5em 0;
		overflow-y: auto;
	}


  .error-state {
    color:rgb(2200, 0, 0);
  }

  .correct-state {
    color:rgb(0, 160, 0);
    margin:25px 0px 15px 0px;
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

  .headline {
    /* overflow-y: scroll; */
    height:auto;
    margin-left: 5px;
    margin-bottom: 10px;
  }

  span {
    font-family: monospace;
  }

</style>

<div id="grammarOutput" class="grammarCompiler-container flex scrollable">
  {#if $grammarCompilationErrors !== ""}
  <div>
    <div style="margin-left:5px">
    <!-- <div style="overflow-y: scroll; height:auto;"> -->
      <span class="prewrap error-state">{ $grammarCompilationErrors } </span>
    </div>
  </div>
  {:else}
  <div class="headline">
    <span class="correct-state">Grammar validated and parser generated!</span>
  </div>
  {/if}
</div>