<script context="module">
  import CodeMirror from "svelte-codemirror";
  if (typeof window !== "undefined") {
    import("../../utils/codeMirrorPlugins.js");
  }
</script>

<script>
	import {
    onMount,
    onDestroy,
    createEventDispatcher
  } from 'svelte';

  const dispatch = createEventDispatcher();

  import {
    grammarEditorValue,
    grammarCompiledParser,
    grammarCompilationErrors
  } from "../../stores/common.js";

  import { compileGrammar } from '../../../node_modules/sema-engine/sema-engine';

  export let id;
  export let name;
	export let type;
	export let lineNumbers;
	export let hasFocus;
	export let theme;
	export let background;
	export let content;
  export let grammarSource;
  export let component;
  export let className;
  export { className as class };
  let codeMirror,
      modelWorker,
      container,
      resizeObserver;

  let log = e => { /* console.log(...e); */ }





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
    if(e){
      try{
        let value = codeMirror.getValue();
        $grammarEditorValue = value;
        let {errors, output } = compileGrammar(value);
        $grammarCompiledParser = output;
        $grammarCompilationErrors = errors;
        dispatch( 'change', { prop: 'content', value } );
      }catch(error){
        console.error("Error in automatic grammar evaluation and compilation", error)
      }
    }
  }

  let onFocus = e => {
    hasFocus = true;
    dispatch('change', {
      prop:'hasFocus',
      value: true
    });
  }

  let onBlur = e => {
    hasFocus = false;
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
  onMount( async () => {
    try {

      resizeObserver = new ResizeObserver( e => codeMirror.setSize("100%", "100%"));
      resizeObserver.observe(container);
      codeMirror.set(content, "ebnf", "oceanic-next");

      // Using export variables for preventing a warning from Svelte comiler
      log( id, name, type, className, lineNumbers, hasFocus, theme, background, content, grammarSource, component );
    }
    catch(error){
      console.error(error);
    }
  });

  onDestroy(async () => {
    codeMirror = null;
    // console.log('DEBUG:GrammarCodeEditor:onDestroy')
    // console.log(data);
    resizeObserver.disconnect();
    resizeObserver = null;
	});



</script>


<style global>
  @import 'codemirror';
  @import '../../utils/ebnf.css';
  @import '../../utils/sema.css';
  @import '../../utils/icecoder.css';
  @import '../../utils/monokai.css';
  @import '../../utils/shadowfox.css';
  /* @import "codemirror/addon/dialog/dialog.css";
  @import 'codemirror/theme/idea.css';
  @import "codemirror/theme/monokai.css";
  @import "codemirror/theme/icecoder.css";
  @import "codemirror/theme/shadowfox.css";
  @import 'codemirror/theme/oceanic-next.css'; */
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

</style>

<div bind:this={ container }
      class="codemirror-container layout-template-container scrollable">
  <CodeMirror bind:this={ codeMirror }
              bind:value={ content }
              tab={ true }
              lineNumbers={ true }
              on:change={ e => onChange(e) }
              on:focus={ e => onFocus(e) }
              on:blur={ e => onBlur(e) }
              on:refresh={ e => onRefresh(e) }
              on:gutterClick={ e => onGutterCick(e) }
              on:viewportChange={ e => onViewportChange(e) }
              />
</div>
