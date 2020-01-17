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
    modelEditorValue
  } from "../../store.js";

  import ModelWorker from "worker-loader!../../../workers/ml.worker.js";

  let codeMirror;
  let modelWorker; 
  
  onMount(async () => {
    codeMirror.set($modelEditorValue, "js");
    modelWorker = new ModelWorker();  // Create one worker per widget lifetime
	});

  onDestroy(async () => {
    modelWorker.terminate();
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


  function evalModelEditorExpression(){
    let code = codeMirror.getSelection();
    console.log("DEBUG:ModelEditor:evalModelEditorExpression: " + code);

    evalModelCode(code);

    // window.localStorage.setItem("modelEditor+ID", editor.getValue()); 
  }

  function evalModelEditorExpressionBlock() {
    let code = codeMirror.getBlock();
    console.log("DEBUG:ModelEditor:evalModelEditorExpressionBlock: " + code);

    evalModelCode(code);

    // window.localStorage.setItem("modelEditor+ID", editor.getValue());
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
 