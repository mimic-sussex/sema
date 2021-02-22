<script context="module">
  const is_browser = typeof window !== "undefined";

  // import CodeMirror, { set, getValue } from "svelte-codemirror"
  import CodeMirror from "svelte-codemirror";
  // import "codemirror/lib/codemirror.css";

  if (is_browser) {
    import("../../utils/codeMirrorPlugins.js");
  }
</script>

<script>
  // import { set } from "svelte-codemirror";
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	const dispatch = createEventDispatcher();

  import {
    grammarEditorValue,
    grammarCompiledParser,
    grammarCompilationErrors
  } from "../../stores/common.js";

  import * as nearley from 'nearley/lib/nearley.js'
  // import compile from '../../compiler/compiler';
  import { compile } from 'sema-engine/sema-engine';

  // import { set, getValue } from "svelte-codemirror"
  // import ModelWorker from "../../workers/ml.worker.js";

  export let id;
  export let name;
	export let type;
	export let lineNumbers;
	export let hasFocus;
	export let theme;
	export let background;
	export let content;
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
  export let grammarSource;
  export let component;

  let codeMirror;
  let modelWorker;

  let log = e => { /* console.log(...e); */ }

  onMount(async () => {
    // console.log('DEBUG:GrammarCodeEditor:onMount:')
    // console.log(content);
    codeMirror.set(content, "ebnf");

    log( id, name, type, lineNumbers, hasFocus, theme, background, content, grammarSource, component );
	});

  onDestroy(async () => {
    // console.log('DEBUG:GrammarCodeEditor:onDestroy')
    // console.log(data);
	});




  let nil = (e) => { }


  // let evalModelCode = e => {
  //
  //   if(window.Worker){
  //     let modelWorkerAsync = new Promise( (res, rej) => {
  //
  //       modelWorker.postMessage({
  //         eval: e
  //       });
  //
  //       modelWorker.onmessage = m => {
  //         if(m.data.message !== undefined){
  //           // console.log('DEBUG:ModelEditor:evalModelCode:onmessage')
  //           // console.log(e);
  //           console.log(m.data.message);
  //         }
  //         else if(m.data !== undefined && m.data.length != 0){
  //           res(m.data);
  //         }
  //         clearTimeout(timeout);
  //       }
  //     })
  //     .then(outputs => {
  //
  //     })
  //     .catch(e => {
  //       // console.log('DEBUG:ModelEditor:parserWorkerAsync:catch')
  //       // console.log(e);
  //     });
  //   }
  // }
  //
  let onChange = e => {

    // let grammarEditorValue = null;

    // if(e !== undefined && e.detail !== undefined && e.detail.value !== undefined)
    //   grammarEditorValue = e.detail.value;
    if(e !== undefined){

      try{
        let value = codeMirror.getValue();
        $grammarEditorValue = value;

        // window.localStorage.grammarEditorValue = $grammarEditorValue;
        let {errors, output} = compile(value);
        $grammarCompiledParser = output;
        $grammarCompilationErrors = errors;

        dispatch('change', { prop:'content', value });
      }catch(error){
        console.error("Error Live Code Editor get value from code Mirror")
      }

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

    // console.log("onGutterCick")
    // dispatch('change', {
    //   prop:'hasFocus',
    //   value: true
    // });
  }

  let onViewportChange = e => {

    // console.log("onViewportChange")
    // dispatch('change', {
    //   prop:'hasFocus',
    //   value: true
    // });
  }



</script>


<style>


  @import 'codemirror/lib/codemirror.css';
  @import '../../utils/ebnf.css';
  @import '../../utils/sema.css';
  @import '../../utils/icecoder.css';
  @import '../../utils/monokai.css';
  @import '../../utils/shadowfox.css';
  @import "codemirror/addon/dialog/dialog.css";
  @import 'codemirror/theme/idea.css';
  @import "codemirror/theme/monokai.css";
  @import "codemirror/theme/icecoder.css";
  @import "codemirror/theme/shadowfox.css";
  @import 'codemirror/theme/oceanic-next.css';
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
  }

  .codemirror-container :global(.CodeMirror) {
    height: 100%;
    background: transparent;
    font: 400 14px/1.7 var(--font-mono);

  }



  /* .codemirror-container :global(.error-loc) {
    position: relative;
    border-bottom: 2px solid #da106e;
  } */

  /* .codemirror-container :global(.error-line) {
    background-color: rgba(200, 0, 0, 0.05);
  } */



</style>

<!-- <div class="layout-template-container" contenteditable="true" bind:innerHTML={layoutTemplate}>
bind:value={item.value} -->
<div class="codemirror-container layout-template-container scrollable">
  <CodeMirror bind:this={codeMirror}
              bind:value={content}
              tab={true}
              lineNumbers={true}
              on:change={ e => onChange(e)}
              on:focus={ e => onFocus(e) }
              on:blur={ e => onBlur(e) }
              on:refresh={ e => onRefresh(e) }
              on:gutterClick={ e => onGutterCick(e) }
              on:viewportChange={ e => onViewportChange(e) }
              />
</div>
