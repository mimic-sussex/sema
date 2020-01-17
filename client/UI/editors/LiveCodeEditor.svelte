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
    grammarCompiledParser,
    liveCodeEditorValue,
    liveCodeParseErrors,
    liveCodeParseResults, 
    liveCodeAbstractSyntaxTree
  } from "../../store.js";

  import ParserWorker from "worker-loader!../../../workers/parser.worker.js";

  let codeMirror;
  let parserWorker; 
  
  onMount(async () => {
    codeMirror.set($liveCodeEditorValue, "js");
    parserWorker = new ParserWorker();  // Create one worker per widget lifetime
	});

  onDestroy(async () => {
    parserWorker.terminate();
	});

  let log = (e) => { console.log(e.detail.value); }

  let nil = (e) => { }

  let evalLiveCode = e => {

    if(window.Worker){
      let parserWorkerAsync = new Promise( (res, rej) => {

        parserWorker.postMessage({
          liveCodeSource: $liveCodeEditorValue, 
          parserSource: $grammarCompiledParser, 
          type:'parse'
        });

        parserWorker.onmessage = m => {
          if(m.data.message !== undefined){
            // console.log('DEBUG:LiveCodeEditor:evalLiveCode:onmessage')
            console.log(m.data.message);
            $liveCodeParseErrors = e.data.message;
          }
          else if(m.data !== undefined && m.data.length != 0){
            res(m.data);
          }
        }
      })
      .then(outputs => {
        console.log('DEBUG:Layout:parseLiveCode:then')
        console.log(outputs); 
        const {parserOutputs, parserResults} = outputs;
        $liveCodeParseResults = parserResults;
        $liveCodeAbstractSyntaxTree = parserOutputs;  //Deep clone created in the worker for AST visualization
        $liveCodeParseErrors = "";
      })
      .catch(e => {
        console.log('DEBUG:parserEditor:parserWorkerAsync:catch')
        console.log(e);
      });
    }
  }

  function evalLiveCodeEditorValue() {
    // console.log("DEBUG:parserEditor:evalLiveCodeEditorValue: " + code);
    let code = codeMirror.getBlock();
    if(code) evalLiveCode(code);

    // window.localStorage.setItem("parserEditor+ID", editor.getValue());
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

<div class="codemirror-container layout-template-container scrollable">
  <CodeMirror bind:this={codeMirror}  
              bind:value={$liveCodeEditorValue} 
              tab={true} 
              lineNumbers={true} 
              on:change={nil} 
              cmdEnter={evalLiveCodeEditorValue}
              />
</div>
 