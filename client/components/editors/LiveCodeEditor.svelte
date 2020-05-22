<script context="module">
  const is_browser = typeof window !== "undefined";

  import CodeMirror, { set, update } from "svelte-codemirror";
  import "codemirror/lib/codemirror.css";

  if (is_browser) {
    import("../../utils/codeMirrorPlugins");
  }
</script> 

<script>

	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	
  const dispatch = createEventDispatcher();

  import * as nearley from 'nearley/lib/nearley.js'
  import compile from '../../compiler/compiler';

  import { addToHistory } from "../../utils/history.js";

  import { PubSub } from '../../messaging/pubSub.js';

  import IRToJavascript from "../../intermediateLanguage/IR.js";

  // import ParserWorker from "worker-loader!Workers/parser.worker.js"; // Worker is resolved in webpack.config.js in alias
  import ParserWorker from "worker-loader!../../workers/parser.worker.js"; // Worker is resolved in webpack.config.js in alias

  import { blockTracker, blockData } from './liveCodeEditor.blockTracker.js';

  import {
  //   grammarCompiledParser,
  //   liveCodeEditorValue,
  //   liveCodeParseErrors,
  //   liveCodeParseResults,
  //   liveCodeAbstractSyntaxTree,
  //   dspCode
      audioEngineStatus
  } from "../../stores/store.js";
  
  // export let grammarSource = "/languages/defaultGrammar.ne";
  export let grammarSource; 
  let grammarSourceSubscriptionToken; 
  let grammarCompiledParser;

  // export let liveCodeEditorValue;
  export let liveCodeParseErrors;
  export let liveCodeParseResults;
  export let liveCodeAbstractSyntaxTree; 
  export let dspCode; // code generated from the liveCode AST traversal

  // console.log("grammarCompiledParser");
  // console.log($grammarCompiledParser);

  export let tab = true;

  export let id;
  export let name;
	export let type;
	export let lineNumbers;
	export let hasFocus;
	export let theme;
	export let background;
	export let data;      // liveCode Value that is injected and to which CodeMirror is bound
  // export let static; // Error: ParseError: The keyword 'static' is reserved
  export let responsive;
  export let resizable;
  export let resize;
  export let draggable;
  export let drag;
  export let min = {};
  export let max = {};
  export let x;
  export let y;
  export let w;
  export let h;
  export let component;

  let codeMirror;
  let parserWorker;
  let messaging = new PubSub();

  let btrack;

  let log = e => { /* console.log(...e); */ }

  let nil = (e) => { }

  let isEmpty = str => {
    return (!str || 0 === str.length);
  }

  let isRelativeURL = str => {
    if(!isEmpty(str)){
      let re = /^[^\/]+\/[^\/].*$|^\/[^\/].*$/;
      return re.exec(str)[0]===re.exec(str).input;
    }
    else
      throw Error("Empty URL"); 
  }

  let onChange = e => {
    // console.log('DEBUG:LiveCodeEditor:onchange:');
    // console.log(e);
    btrack.onEditChange(e.detail.changeObj);

    // this event notifies the parent (Dashboard) to update this items on the items collection, because of the 'data' property change 
    // CHECK <svelte:component on:change={ e => update(item, e.detail.prop, e.detail.value) }
    dispatch('change', { 
      prop:'data', 
      value: codeMirror.getValue() 
    });
  }

  let parseLiveCodeAsync = async e => {
    // console.log('DEBUG:LiveCodeEditor:parseLiveCode:');
    // console.log(e);
    addToHistory("live-code-history-", e); // TODO: Needs refactoring to move up the chain (e.g. tutorial/playground, multiple editors)

    if(window.Worker){
      let parserWorkerAsync = new Promise( (res, rej) => {

        parserWorker.postMessage({ // Post code to worker for parsing
          liveCodeSource: e,
          // parserSource: $grammarCompiledParser,
          parserSource:  grammarCompiledParser,
          type:'parse'
        });

        parserWorker.onmessage = m => {  // Receive code from worker, pass it to then
          console.log('DEBUG:LiveCodeEditor:parseLiveCode:onmessage');
          console.log(m);
          if(m.data !== undefined){
            res(m.data);
          }
        }

      })
      .then(outputs => {
        console.log('DEBUG:LiveCodeEditor:parseLiveCode:then1');
        console.log(outputs);
        const { parserOutputs, parserResults } = outputs;
        if( parserOutputs && parserResults ){
          // $liveCodeParseResults = parserResults;
          // $liveCodeAbstractSyntaxTree = parserOutputs;  //Deep clone created in the worker for AST visualization
          // $liveCodeParseErrors = "";
          liveCodeParseResults = parserResults;
          liveCodeAbstractSyntaxTree = parserOutputs;  //Deep clone created in the worker for AST visualization
          liveCodeParseErrors = "";
          // Tree traversal in the main tree.
          // let dspCode = IRToJavascript.treeToCode($liveCodeParseResults, 0);
          let dspCode = IRToJavascript.treeToCode(liveCodeParseResults, 0);
          console.log("code generated");

          // publish eval message with code to audio engine
          messaging.publish("eval-dsp", dspCode);
        }
        else {
          // console.log('DEBUG:LiveCodeEditor:parseLiveCode:then2');
          // console.dir(outputs);
         
          // $liveCodeParseErrors = outputs;
          // $liveCodeAbstractSyntaxTree = $liveCodeParseResults = '';
          liveCodeParseErrors = outputs;
          liveCodeAbstractSyntaxTree = liveCodeParseResults = '';
        }
      })
      .catch(e => {
        // console.log('DEBUG:parserEditor:parseLiveCode:catch')
        // console.log(e);

        // $liveCodeParseErrors = e;
        liveCodeParseErrors = e;
      });
    }
  }

  /**
	 * Delegates the translation of the Intermediate Language to DSP to a worker created on demand
	 * NOT IN USE currently but can be an optimisation when our language translation becomes more expensive
	 */
  let translateILtoDSPasync = async e => { // [NOTE:FB] Note the 'async'

    if(window.Worker){
      // let iLWorker = new Worker('../../il.worker.js');
      let iLWorker = new ILWorker();
      let iLWorkerAsync = new Promise( (res, rej) => {

        // iLWorker.postMessage({ liveCodeAbstractSyntaxTree: $liveCodeParseResults, type:'ASTtoDSP'});
        iLWorker.postMessage({ liveCodeAbstractSyntaxTree: liveCodeParseResults, type:'ASTtoDSP'});

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
        // $dspCode = outputs;
        dspCode = outputs;

        // $liveCodeParseErrors = "";
        console.log('DEBUG:Layout:translateILtoDSPasync');
        // console.log($dspCode);
      })
      .catch(e => {
        console.log('DEBUG:Layout:translateILtoDSPasync:catch')
        console.log(e);
      });
    }
  }

  const evalLiveCodeOnEditorCommand = async () => {

    try {

      if($audioEngineStatus === 'paused')
        $audioEngineStatus = 'running';

      console.log("parsing");
      console.log(codeMirror.getCursorPosition());

      await parseLiveCodeAsync(codeMirror.getBlock()); // Code block parsed by parser.worker

      // if($grammarCompiledParser && $liveCodeEditorValue && $liveCodeAbstractSyntaxTree){
      // let dspCode = IRToJavascript.treeToCode($liveCodeParseResults, 0); // Tree traversal in the main tree. TODO defer to worker thread
      // messaging.publish("eval-dsp", dspCode); // publish eval message with code to audio engine
    } catch (error) {
      console.log('DEBUG:LiveCodeEditor:evalLiveCodeOnEditorCommand:')
      // console.log($liveCodeAbstractSyntaxTree);
    }
  }

  const stopAudioOnEditorCommand = () => {
    // publish eval message with code to audio engine
    messaging.publish("stop-audio");
    
    // set audio engine status on store to change audioEngineStatus indicator/button
    $audioEngineStatus = 'paused';

  }

  let fetchGrammarFrom = async url => {
    if(!isEmpty(url)){  
      const res = await fetch(grammarSource);
      return await res.text();
    }
    else
      throw Error("Empty URL");    
  }

  let compileParser = grammar => {
    if(!isEmpty(grammar)){
      let { errors, output } = compile(grammar);
      if ( errors != null ) 
        return output;
      else 
        throw Error("Grammar Malformed");
    }
    else
      throw Error("Empty grammar");
  }


  let subscribeTo = grammarSource => {

		grammarSourceSubscriptionToken = this.messaging.subscribe(grammarSource, e => {
      if (event !== undefined) {
        // Receive notification from "model-output-data" topic
        console.log("DEBUG:LiveCodeEditor:subscribeTo:");
        console.log(event);
        // grammarCompiledParser =     
			}
		});
  }


  onMount( async () => {
    // console.log('DEBUG:LiveCodeEditor:onMount:')
    // console.log(data);
    codeMirror.set(data, "js", 'monokai');

    parserWorker = new ParserWorker();  // Create one worker per widget lifetime

    btrack = new blockTracker(codeMirror);

    if(isRelativeURL(grammarSource)){
      let grammar = await fetchGrammarFrom(grammarSource);
      grammarCompiledParser = compileParser(grammar);
      // console.log('DEBUG:LiveCodeEditor:onMount:grammarCompiledParser')
      // console.log(grammarCompiledParser) 
    }
    else{
      subscribeTo(grammarSource);
      // console.log('DEBUG:LiveCodeEditor:onMount:grammarSource')
      // console.log(grammarSource)
    }
    log( id, name, type, lineNumbers, hasFocus, theme, background, data, responsive, resizable, resize, draggable, drag, min, max, x, y, w, h, component );
    log( grammarSource, grammarCompiledParser );

    // console.log( grammarSource, grammarCompiledParser );
	});


  onDestroy( () => {
    // console.log('DEBUG:LiveCodeEditor:onDestroy:')
    parserWorker.terminate();
    parserWorker = null; // cannot delete in strict mode
	});


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
    line-height: 1.4;
    overflow: hidden;
    font-family: monospace;
    color:white;
  }


  .codemirror-container :global(.CodeMirror) {
    height: 100%;
    background: transparent;
    font: 400 14px/1.7 var(--font-mono);
    color: var(--base);
  }

/*
  .codemirror-container :global(.error-loc) {
    position: relative;
    border-bottom: 2px solid #da106e;
  }

  .codemirror-container :global(.error-line) {
    background-color: rgba(200, 0, 0, 0.05);
  } */


</style>

<div class="codemirror-container layout-template-container scrollable">

  <CodeMirror bind:this={codeMirror}
              bind:value={data}
              on:change={ e => onChange(e) }
              {tab}
              {lineNumbers}
              ctrlEnter={evalLiveCodeOnEditorCommand}
              cmdEnter={evalLiveCodeOnEditorCommand}
              cmdPeriod={stopAudioOnEditorCommand}
              cmdForwardSlash={nil}
              />
</div>
