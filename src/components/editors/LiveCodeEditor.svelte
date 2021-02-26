<script context="module">
  import CodeMirror from "svelte-codemirror";
  if (typeof window !== "undefined") {
    import("../../utils/codeMirrorPlugins.js");
  }
</script>

<script>

	import { onMount, onDestroy, createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  import * as nearley from 'nearley/lib/nearley.js'

  import { compile, Engine } from 'sema-engine/sema-engine';

  import { addToHistory } from "../../utils/history.js";
  import {
    nil,
    log
  } from "../../utils/utils.js";

  import { PubSub } from '../../utils/pubSub.js';

  // import IRToJavascript from "../../intermediateLanguage/IR.js";

  // import ParserWorker from "worker-loader!Workers/parser.worker.js"; // Worker is resolved in webpack.config.js in alias

  // import ParserWorker from "worker-loader!../../workers/parser.worker.js"; // Worker is resolved in webpack.config.js in alias

  import { blockTracker, blockData } from './liveCodeEditor.blockTracker.js';

  import {
    grammarCompiledParser,
    liveCodeEditorValue,
    liveCodeParseErrors,
    liveCodeParseResults,
    liveCodeAbstractSyntaxTree,
    dspCode,
    audioEngineStatus
  } from "../../stores/common.js";
// import { editorThemes } from "../../../../sema/client/stores/playground.js";
// import grammar from "nearley/lib/nearley-language-bootstrapped";



  // export let grammarSource = "/languages/defaultGrammar.ne";
  // let grammarSourceSubscriptionToken;
  // let grammarCompiledParser;

  // export let liveCodeEditorValue;
  // export
  // let liveCodeParseErrors;
  // // export
  // let liveCodeParseResults;
  // // export
  // let liveCodeAbstractSyntaxTree;
  // // export
  // let dspCode; // code generated from the liveCode AST traversal

  // console.log("grammarCompiledParser");
  // console.log($grammarCompiledParser);

  export let tab = true;

  export let id;   // unused
  export let name; // unused
	export let type; // unused
	export let lineNumbers;
	export let hasFocus;
	export let theme; // unused
	export let background; // unused
	export let content;      // liveCode Value that is injected and to which CodeMirror is bound
  export let grammarSource;
  // export let fixed;
  // export let responsive;
  // export let resizable;
  // export let resize;
  // export let draggable;
  // export let drag;
  // export let min = {};
  // export let max = {};
  // export let breakpoints = {};
  // export let x;
  // export let y;
  // export let w;
  // export let h;
  export let component;

  let engine;

  let codeMirror;
  let parserWorker;
  let messaging = new PubSub();

  let btrack;



  let onChange = e => {
    // console.log('DEBUG:LiveCodeEditor:onchange:');
    // console.log(e);
    btrack.onEditChange(e.detail.changeObj);

    // this event notifies the parent (Dashboard) to update this items on the items collection, because of the 'data' property change
    // CHECK <svelte:component on:change={ e => update(item, e.detail.prop, e.detail.value) }

    try{
      // let value = codeMirror.getValue();
      dispatch('change', {
        prop:'content',
        // value: value
        value: content
      });
    }catch(error){
      console.error("Error Live Code Editor get value from code Mirror")
    }
  }

  let onFocus = e => {

    // console.log("onfocus")
    hasFocus = true;
    dispatch('change', {
      prop:'hasFocus',
      value: true
    });

  }

  let onBlur = e => {

    hasFocus = false;
    // console.log("onBlur")
    dispatch('change', {
      prop:'hasFocus',
      value: false
    });

  }


  let onRefresh = e =>  {

    // console.log("onRefresh")
    // dispatch('change', {
    //   prop:'hasFocus',
    //   value: true
    // });
  }

  let onGutterCick = e => {
    dispatch('change', {
      prop:'hasFocus',
      value: true
    });
    // console.log("onGutterCick")
  }

  let onViewportChange = e => {

    dispatch('change', {
      prop:'hasFocus',
      value: true
    });
    // console.log("onViewportChange")
  }

/*
  let parseLiveCodeAsync = async e => {
    // console.log('DEBUG:LiveCodeEditor:parseLiveCode:');
    // console.log(e);
    // addToHistory("live-code-history-", e); // TODO: Needs refactoring to move up the chain (e.g. tutorial/playground, multiple editors)

    if(window.Worker){
      let parserWorkerAsync = new Promise( (res, rej) => {
        parserWorker.postMessage({ // Post code to worker for parsing
          liveCodeSource: e,
          parserSource:  $grammarCompiledParser,
          type:'parse'
        });

        parserWorker.onmessage = m => {  // Receive code from worker, pass it to then
          // console.log('DEBUG:LiveCodeEditor:parseLiveCode:onmessage');
          // console.log(m);
          if(m.data !== undefined){
            res(m.data);
          }
        }

      })
      .then(outputs => {
        // // console.log('DEBUG:LiveCodeEditor:parseLiveCode:then1');
        // console.log(outputs);
        const { parserOutputs, parserResults } = outputs;
        if( parserOutputs && parserResults ){
          $liveCodeParseResults = parserResults;
          $liveCodeAbstractSyntaxTree = parserOutputs;  //Deep clone created in the worker for AST visualization
          $liveCodeParseErrors = "";
          // liveCodeParseResults = parserResults;
          // liveCodeAbstractSyntaxTree = parserOutputs;  //Deep clone created in the worker for AST visualization
          // liveCodeParseErrors = "";
          // Tree traversal in the main tree.
          $dspCode = IRToJavascript.treeToCode($liveCodeParseResults, 0);
          // let dspCode = IRToJavascript.treeToCode(liveCodeParseResults, 0);
          // console.log("code generated");

          // publish eval message with code to audio engine
          messaging.publish("eval-dsp", $dspCode);
        }
        else {
          // console.log('DEBUG:LiveCodeEditor:parseLiveCode:then2');
          // console.dir(outputs);

          $liveCodeParseErrors = outputs;
          $liveCodeAbstractSyntaxTree = $liveCodeParseResults = '';
          // liveCodeParseErrors = outputs;
          // liveCodeAbstractSyntaxTree = liveCodeParseResults = '';
        }
      })
      .catch(e => {
        console.log('DEBUG:parserEditor:parseLiveCode:catch')
        console.log(e);

        $liveCodeParseErrors = e;
        // liveCodeParseErrors = e;
      });
    }
  }
*/
  /**
	 * Delegates the translation of the Intermediate Language to DSP to a worker created on demand
	 * NOT IN USE currently but can be an optimisation when our language translation becomes more expensive
	 */

  /*
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
        // console.log('DEBUG:Layout:translateILtoDSPasync');
        // console.log($dspCode);
      })
      .catch(e => {
        // console.log('DEBUG:Layout:translateILtoDSPasync:catch')
        // console.log(e);
      });
    }
  }
*/


// const evalLiveCodeOnEditorCommand = async () => {
//   if(!engine)
//     engine = new Engine();

//   // engine.play();
//   try{
//     let patch = {
//       setup: `() => {
//           let q = this.newq();
//           q.b0u2 = new Maximilian.maxiOsc();
//           q.b0u2.phaseReset(0);
//           return q;
//       }`,
//       loop: `(q, inputs, mem) => {
//         this.dacOutAll(q.b0u2.sinewave(440));
//       }`,
//       paramMarkers: []
//     };
//       // const { errors, dspCode } = compile( content,  );
//     console.info(content);
//     engine.eval(patch);
//   } catch (err) {
//     console.error("ERROR: Failed to compile and eval: ", err);
//   }
//   // else throw new Error('ERROR: Engine not initialized. Please press Start Engine first.')
// }

  const evalLiveCodeOnEditorCommand = async () => {
    if(!engine)
      engine = new Engine();

    // engine.play();
    try{
      let patch = {
        setup: `() => {
            let q = this.newq();
            q.b0u2 = new Maximilian.maxiOsc();
            q.b0u2.phaseReset(0);
            return q;
        }`,
        loop: `(q, inputs, mem) => {
          this.dacOutAll(q.b0u2.sinewave(440));
        }`,
        paramMarkers: []
      };
      // const { errors, dspCode } = compile( content, grammarSource );
      console.info(codeMirror.getBlock());
      console.info(grammarSource);
      engine.eval(patch);
    } catch (err) {
      console.error("ERROR: Failed to compile and eval: ", err);
    }
    // else throw new Error('ERROR: Engine not initialized. Please press Start Engine first.')
  }


  // const evalLiveCodeOnEditorCommand = async () => {

  //   try {

  //     if($audioEngineStatus === 'paused')
  //       $audioEngineStatus = 'running';

  //     console.log("parsing");
  //     console.log(codeMirror.getCursorPosition());

  //     await parseLiveCodeAsync(codeMirror.getBlock()); // Code block parsed by parser.worker

  //     // if($grammarCompiledParser && $liveCodeEditorValue && $liveCodeAbstractSyntaxTree){
  //     // let dspCode = IRToJavascript.treeToCode($liveCodeParseResults, 0); // Tree traversal in the main tree. TODO defer to worker thread
  //     // messaging.publish("eval-dsp", dspCode); // publish eval message with code to audio engine
  //   } catch (error) {
  //     console.log('DEBUG:LiveCodeEditor:evalLiveCodeOnEditorCommand:')
  //     // console.log($liveCodeAbstractSyntaxTree);
  //   }
  // }

  const stopAudioOnEditorCommand = () => {

    engine.stop();
    // publish eval message with code to audio engine
    // messaging.publish("stop-audio");

    // set audio engine status on store to change audioEngineStatus indicator/button
    // $audioEngineStatus = 'paused';

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
    // codeMirror.set(content, "js", 'monokai');
    // codeMirror.set("asdfasdfasdfasdfasdf", "js", 'monokai');

    // parserWorker = new ParserWorker();  // Create one worker per widget lifetime

    // controller = new Controller();


    btrack = new blockTracker(codeMirror);

    // if(isRelativeURL(grammarSource)){
    //   let grammar = await fetchGrammarFrom(grammarSource);
    //   $grammarCompiledParser = compileParser(grammar);
    //   // console.log('DEBUG:LiveCodeEditor:onMount:grammarCompiledParser')
    //   // console.log(grammarCompiledParser)
    // }
    // else{
    //   // TODO: Dynamic subscription to messaging from sibling widgets
    //   // Where grammar source will be an UUID
    //   // subscribeTo(grammarSource);
    // }
    log( id, name, type, lineNumbers, hasFocus, theme, background, component );
    // log( grammarSource, $grammarCompiledParser );

    // console.log( grammarSource, grammarCompiledParser );
	});


  onDestroy( () => {
    // console.log('DEBUG:LiveCodeEditor:onDestroy:')
    // parserWorker.terminate();
    // parserWorker = null; // cannot delete in strict mode
	});


</script>


<style global>
  @import '../../../node_modules/codemirror/lib/codemirror.css';
  @import '../../../node_modules/codemirror/theme/idea.css';
  @import "../../../node_modules/codemirror/theme/monokai.css";
  @import "../../../node_modules/codemirror/theme/icecoder.css";
  @import "../../../node_modules/codemirror/theme/shadowfox.css";
  @import '../../../node_modules/codemirror/theme/oceanic-next.css';
  @import "../../../node_modules/codemirror/addon/dialog/dialog.css";

  @import '../../utils/sema.css';
  @import '../../utils/icecoder.css';
  @import '../../utils/monokai.css';
  @import '../../utils/shadowfox.css';
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
              bind:value={content}
              on:change={ e => onChange(e) }
              on:focus={ e => onFocus(e) }
              on:blur={ e => onBlur(e) }
              on:refresh={ e => onRefresh(e) }
              on:gutterClick={ e => onGutterCick(e) }
              on:viewportChange={ e => onViewportChange(e) }
              {tab}
              {lineNumbers}
              cmdForwardSlash={nil}
              cmdEnter={ evalLiveCodeOnEditorCommand }
              ctrlEnter={ evalLiveCodeOnEditorCommand }
              cmdPeriod={stopAudioOnEditorCommand}
              ctrlPeriod={stopAudioOnEditorCommand}
              />
</div>