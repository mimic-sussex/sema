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
    compile,
    parse,
    ASTreeToJavascript,
    ASTreeToDSPcode,
    Engine
  } from 'sema-engine';
  // } from '../../../n sema-engine/sema-engine';

  import {
    nil,
    log
  } from "../../utils/utils.js";

  import {
    functionDefinitions
  } from "../../utils/hints/functionDefinitions.js"

  import { PubSub } from '../../utils/pubSub.js';

  import {
    blockTracker,
    blockData
  } from './liveCodeEditor.blockTracker.js';

  import {
    grammarCompiledParser,
    liveCodeEditorValue,
    liveCodeParseErrors,
    liveCodeParseResults,
    liveCodeAbstractSyntaxTree,
    dspCode as DSP,
    engineStatus,
    grammarEditorValue
  } from "../../stores/common.js";
import { edit } from "marked/src/helpers";

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
  export let grammar;
  export let liveCodeSource;
  export let component;
  export let className;
  export { className as class };

  // messaging = new PubSub(),

  let engine,
      codeMirror,
      btrack,
      container,
      resizeObserver;

  let onChange = e => {
    btrack.onEditChange(e.detail.changeObj);
    // this event notifies the parent (Dashboard) to update this items on the items collection, because of the 'data' property change
    // CHECK <svelte:component on:change={ e => update(item, e.detail.prop, e.detail.value) }
    try{
      let value = codeMirror.getValue();
      dispatch('change', {
        prop: 'content',
        value: value
      });
    }catch(error){
      console.error("Error Live Code Editor get value from code Mirror")
    }
  }

  let onFocus = e => {
    hasFocus = true;
    dispatch('change', {
      prop:'hasFocus',
      value: true
    });
  }

	/**
	 * editor blink, non-blocking, defers execution for M milliseconds
	 * @param editor
	 * @param milliseconds
	 */
	const blinkEditorSelectionForMilliseconds = async (editor, milliseconds) => {
		if(editor){
			  let pos = editor.getCursor();
        editor.selectAll();
        await new Promise(r => setTimeout(r, milliseconds));
        editor.setCursor(pos);
		}
	}


  const evalLiveCodeOnEditorCommand = async e => {
    if(e){
      try{
        if(!engine)
          engine = new Engine();

        $liveCodeEditorValue = codeMirror.getValue();
        // console.log("DEBUG: liveCodeEditorValue", $liveCodeEditorValue);
        // console.log('DEBUG: ',$grammarEditorValue)
        // const { errors, dspCode } = compile( $grammarEditorValue, $liveCodeEditorValue );
        const { errors, livecodeParseTree } = parse( $grammarEditorValue, $liveCodeEditorValue );
        // console.log('DEBUG: liveCodeParsetree', livecodeParseTree);
        // console.log('DEBUG: parse errors', errors);
        if( livecodeParseTree ){
          $liveCodeAbstractSyntaxTree = livecodeParseTree;
          const { dspCode } = ASTreeToDSPcode(livecodeParseTree[0]);
          if( dspCode ){
            $DSP = dspCode;
            engine.eval(dspCode);
            //engineStatus.set('running');
            $engineStatus = 'running';
            $liveCodeParseErrors = '';
          };
        }
        if(errors)
          $liveCodeParseErrors = errors;

				await blinkEditorSelectionForMilliseconds(codeMirror, 20);

      } catch (err) {
        console.error("ERROR: Failed to compile and eval: ", err);
      }
    }
  }

  const stopAudioOnEditorCommand = e => {
    if(e){
      if(!engine){
        engine = new Engine();
      }
      engine.hush();
      // engine.stop();
      // engineStatus.set('paused');
      $engineStatus = 'paused';
    }
  }

  onMount( async () => {
    codeMirror.set(content, "js", 'sema');

    resizeObserver = new ResizeObserver( e => codeMirror.setSize("100%", "100%"));
    resizeObserver.observe(container);

    btrack = new blockTracker(codeMirror);
    log( id, name, type, className, grammar, liveCodeSource, lineNumbers, hasFocus, theme, grammarSource, background, component );
	});

  onDestroy( () => {
    codeMirror = null;
    resizeObserver.disconnect();
    resizeObserver = null;
	});

</script>


<style global>
  @import '../../../node_modules/codemirror/lib/codemirror.css';
  @import '../../../node_modules/codemirror/theme/idea.css';
  @import "../../../node_modules/codemirror/theme/monokai.css";
  @import "../../../node_modules/codemirror/theme/icecoder.css";
  @import "../../../node_modules/codemirror/theme/shadowfox.css";
  @import '../../../node_modules/codemirror/theme/oceanic-next.css';
  @import '../../../node_modules/codemirror/theme/railscasts.css';
  @import '../../../node_modules/codemirror/theme/seti.css';
  @import '../../../node_modules/codemirror/theme/isotope.css';
  @import '../../../node_modules/codemirror/theme/liquibyte.css';
  @import "../../../node_modules/codemirror/addon/dialog/dialog.css";
  @import '../../utils/sema.css';
  @import '../../utils/hints/hint.css';
  .layout-template-container {
    height: 100vh;
  }
	.scrollable {
		flex: 1 1 auto;
		/* border-top: 1px solid #eee; */
		margin: 0 0 0.5em 0;
		/* overflow-y: auto; */
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
    /* resize: both; */
    overflow: hidden !important;
    /* overflow: auto !important; */
  }
  .codemirror-container :global(.CodeMirror) {
    height: 100%;
    background: transparent;
    font: 400 14px/1.7 var(--font-mono);
    color: var(--base);
  }



</style>

<div  bind:this={ container }
      class="codemirror-container layout-template-container scrollable"
      >
  <CodeMirror bind:this={ codeMirror }
              bind:value={ content }
              on:change={ e => onChange(e) }
              on:focus={ e => onFocus(e) }
              on:blur={ e => onFocus(e) }
              on:refresh={ e => onFocus(e) }
              on:gutterClick={ e => onFocus(e) }
              on:viewportChange={ e => onFocus(e) }
              { tab }
              { lineNumbers }
              cmdForwardSlash={ nil }
              cmdEnter={ evalLiveCodeOnEditorCommand }
              ctrlEnter={ evalLiveCodeOnEditorCommand }
              snippets={functionDefinitions}
              useAutocomplete={true}
              />
              <!-- cmdPeriod={ stopAudioOnEditorCommand }
              ctrlPeriod={ stopAudioOnEditorCommand } -->
</div>