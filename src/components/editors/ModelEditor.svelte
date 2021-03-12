<script context="module">
  import CodeMirror from "svelte-codemirror";
  if (typeof window !== "undefined") {
    import("../../utils/codeMirrorPlugins.js");
  }
</script>

<script>
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	const dispatch = createEventDispatcher();
  import {copyToPasteBuffer} from '../../utils/pasteBuffer.js';

  import {
    Learner,
    Engine
  } from 'sema-engine/sema-engine';

  import Controller from "../../engine/controller";
  let controller = new Controller(); // this will return the previously created Singleton instance

  var modelEditorValue = window.localStorage.modelEditorValue;

  import { PubSub } from '../../utils/pubSub.js';

  import { addToHistory } from "../../utils/history.js";

  export let id;
  export let name;
	export let type;
	export let lineNumbers;
	export let hasFocus;
	export let theme;
	export let background;
	export let content;
  export let component;
  export let className;
  export { className as class };

  let engine,
      learner,
      codeMirror;

  let messaging = new PubSub();
  let subscriptionTokenMID;
  let subscriptionTokenMIB;

  let log = e => { /* console.log(...e); */ }

  onMount(async () => {

    if(!engine)
      engine = new Engine();

    learner = new Learner();
    await engine.addLearner(id, learner)

    codeMirror.set(content, "js", "material-ocean");

    subscriptionTokenMID = messaging.subscribe("model-input-data", e => postToModel(e) );
    subscriptionTokenMIB = messaging.subscribe("model-input-buffer", e => postToModel(e) );
    // subscriptionTokenMODR = messaging.subscribe("model-output-data-request", e => postToModel(e) );

    // modelWorker = new ModelWorker();  // Creates one ModelWorker per ModelEditor lifetime
    // modelWorker.onmessage = e =>  onModelWorkerMessageHandler(e);

    log( id, name, type, lineNumbers, className, hasFocus, theme, background, content, component );
	});

  onDestroy(async () => {
    // modelWorker.terminate();
    // modelWorker = null; // make sure it is deleted by GC
    // messaging.unsubscribe(subscriptionTokenMID);
    // messaging.unsubscribe(subscriptionTokenMIB);
    // // messaging.unsubscribe(subscriptionTokenMODR);
    // messaging = null;
    // console.log('DEBUG:ModelEditor:onDestroy')
	});

  let nil = (e) => { }

  let onChange = e => {

    try{
      let value = codeMirror.getValue();
      dispatch('change', { prop:'data', value });
    }catch(error){
      console.error("Error Model Editor get value from code Mirror")
    }
  }


  let onFocus = e => {

    hasFocus = true;
    // console.log("onfocus")

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




  let postToModel = e => {
    // console.log(`DEBUG:ModelEditor:postToModel:${e}`);
    // console.log(e)
    modelWorker.postMessage(e);
  }

  let postFromModel = e => {
    // console.log(`DEBUG:ModelEditor:postFromModel:${e}`);
    // console.log(e)
  }

  let evalDomCode = (code) => {
    try {
      // let evalRes = eval(code);
      // if (evalRes != undefined) {
      //   // console.log(evalRes);
      // }
      // else console.log("done");
    }catch(e) {
      // console.log(`DOM Code eval exception: ${e}`);
    }
  }

  const onModelWorkerMessageHandler = m => {

    // console.log('DEBUG:ModelEditor:onModelWorkerMessageHandler:')
    // console.log(m);

    if(m.data.func !== undefined){
      let responders = {
        sab: data => {
          // Publish data to audio engine
          messaging.publish("model-output-data", data)
        },
        // data: data => {
        //   // Publish data to audio engine
        //   messaging.publish("model-output-data", data)
        // },
        save: data => {
          // console.log("save");
          window.localStorage.setItem(data.name, data.val);
        },
        load: data => {
          // console.log("load");
          let msg = {
            name: data.name,
            val: window.localStorage.getItem(data.name)
          };
          modelWorker.postMessage(msg);
        },
        download: data => {
          // console.log("download");
          let downloadData = window.localStorage.getItem(data.name);
          let blob = new Blob([downloadData], {
            type: "text/plain;charset=utf-8"
          });
          saveData(blob, `${data.name}.data`);
        },
        sendcode: data => {
          // console.log(data);
        },
        pbcopy: data => {
          copyToPasteBuffer(data.msg);
          // let copyField=document.getElementById("hiddenCopyField");
          // copyField.value = data.msg;
          // copyField.select();
          // document.execCommand("Copy");
        },
        sendbuf: data => {
          messaging.publish("model-send-buffer", data);
        },
        envsave: data => {
          messaging.publish("env-save", data);
        },
        envload: data => {
          messaging.publish("env-load", data);
        },
        domeval: data => {
          // console.log(data.code);
          evalDOMCode(data.code);
          // document.getElementById('canvas').style.display= "none";
        },
        peerinfo: data => {
          messaging.publish("peerinfo-request", {});
        }
      };
      responders[m.data.func](m.data);
    }
    else if(m.data !== undefined && m.data.length != 0){
      res(m.data);
    }
    // clearTimeout(timeout);
  }

  let postToModelAsync = modelCode => {
    if(window.Worker){
      let modelWorkerAsync = new Promise((res, rej) => {
        // posts model code received from editor to worker
        // console.log('DEBUG:ModelEditor:postToModelAsync:catch')

      })
      .then(outputs => {

      })
      .catch(e => {
        // console.log('DEBUG:ModelEditor:parserWorkerAsync:catch')
        // console.log(e);
      });
    }
  }

  function onModelEditorValueChange(){
    //don't need to save on every key stroke
    // window.localStorage.setItem("modelEditorValue", codeMirror.getValue());
    // addToHistory("model-history-", modelCode);
  }

  function evalModelEditorExpression(){
    let code = codeMirror.getSelection();

    learner.eval(code);
    //console.log("DEBUG:ModelEditor:evalModelEditorExpression: " + code);
    window.localStorage.setItem("modelEditorValue", codeMirror.getValue());
    addToHistory("model-history-", code);
  }

  function evalModelEditorExpressionBlock() {
    let code = codeMirror.getBlock();
    // console.log(modelCode);
    let linebreakPos = code.indexOf('\n');
    let firstLine = code.substr(0,linebreakPos)
    // console.log(firstLine);
    if(firstLine == "//--DOM") {
      code = code.substr(linebreakPos);
      evalDomCode(code);
      addToHistory("dom-history-", code);
    }else{
      learner.eval(code)
      window.localStorage.setItem("modelEditorValue", codeMirror.getValue());
      addToHistory("model-history-", code);
    }
  }


</script>


<style global>
  @import 'codemirror/lib/codemirror.css';
  @import '../../utils/ebnf.css';
  @import '../../utils/sema.css';
  @import '../../utils/icecoder.css';
  @import '../../utils/monokai.css';
  @import '../../utils/shadowfox.css';
  @import "codemirror/addon/dialog/dialog.css";
  @import 'codemirror/theme/material-ocean.css';
  @import "codemirror/theme/monokai.css";
  @import "codemirror/theme/icecoder.css";
  @import "codemirror/theme/shadowfox.css";
  @import 'codemirror/theme/oceanic-next.css';



  /* @import"../../../utils/codeMirrorPlugins"; */
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
    color: var(--base);
  }



  /* .codemirror-container :global(.error-loc) {
    position: relative;
    border-bottom: 2px solid #da106e;
  } */
/*
  .codemirror-container :global(.error-line) {
    background-color: rgba(200, 0, 0, 0.05);
  } */


</style>

<div class="codemirror-container layout-template-container scrollable">
  <CodeMirror bind:this={codeMirror}
              bind:value={content}
              tab={true}
              lineNumbers={true}
              on:change={ e => onChange(e) }
              on:focus={ e => onFocus(e) }
              on:blur={ e => onBlur(e) }
              on:refresh={ e => onRefresh(e) }
              on:gutterClick={ e => onGutterCick(e) }
              on:viewportChange={ e => onViewportChange(e) }
              ctrlEnter={evalModelEditorExpressionBlock}
              cmdEnter={evalModelEditorExpressionBlock}
              shiftEnter={evalModelEditorExpression}
              />
</div>
<textarea aria-hidden="true" id="hiddenCopyField" style="position: absolute; left: -999em;" value=""></textarea>
