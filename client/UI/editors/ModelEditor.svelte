<script context="module">
  const is_browser = typeof window !== "undefined";

  import CodeMirror, { set, update, getValue } from "svelte-codemirror";
  import "codemirror/lib/codemirror.css";

  if (is_browser) {
    import("../../utils/codeMirrorPlugins");
  }
</script>

<script>
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	const dispatch = createEventDispatcher();;
  import {copyToPasteBuffer} from '../../utils/pasteBuffer.js';

  // import {
  //   modelEditorValue
  // } from "../../store.js";

  var modelEditorValue = window.localStorage.modelEditorValue;

  console.log(modelEditorValue);
  import { PubSub } from '../../messaging/pubSub.js';

  import ModelWorker from "worker-loader!../../workers/ml.worker.js";

  import { addToHistory } from "../../utils/history.js";
  import "../../machineLearning/lalolib.js";

  export let name;
	export let type;
	export let lineNumbers;
	export let hasFocus;
	export let theme;
	export let background;
	export let data;

  let codeMirror;
  let modelWorker;

  let messaging = new PubSub();
  let subscriptionTokenMID;
  let subscriptionTokenMODR;

  onMount(async () => {
    codeMirror.set(data, "js");

    subscriptionTokenMID = messaging.subscribe("model-input-data", e => postToModel(e) );
    subscriptionTokenMODR = messaging.subscribe("model-output-data-request", e => postToModel(e) );

    modelWorker = new ModelWorker();  // Creates one ModelWorker per ModelEditor lifetime
    modelWorker.onmessage = e =>  onModelWorkerMessageHandler(e);


    console.log('DEBUG:ModelEditor:onMount:');
    console.log(data);    // console.log(name + ' ' + type + ' ' + lineNumbers +' ' + hasFocus +' ' + theme + ' ' + background /*+  ' ' + data */ );
	});

  onDestroy(async () => {
    modelWorker.terminate();
    modelWorker = null; // make sure it is deleted by GC
    messaging.unsubscribe(subscriptionTokenMID);
    messaging.unsubscribe(subscriptionTokenMODR);
    messaging = null;
    console.log('DEBUG:ModelEditor:onDestroy')
	});

  let log = e => console.log(e.detail.value);

  let nil = (e) => { }

  let onChange = e => {
    dispatch('change', { prop:'data', value: codeMirror.getValue() });
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
      let evalRes = eval(code);
      if (evalRes != undefined) {
        console.log(evalRes);
      }
      else console.log("done");
    }catch(e) {
      console.log(`DOM Code eval exception: ${e}`);
    }
  }

  const onModelWorkerMessageHandler = m => {

    // console.log('DEBUG:ModelEditor:onModelWorkerMessageHandler:')
    // console.log(m);

    if(m.data.func !== undefined){
      let responders = {
        data: data => {
          // Publish data to audio engine
          messaging.publish("model-output-data", data)
        },
        save: data => {
          console.log("save");
          window.localStorage.setItem(data.name, data.val);
        },
        load: data => {
          console.log("load");
          let msg = {
            name: data.name,
            val: window.localStorage.getItem(data.name)
          };
          modelWorker.postMessage(msg);
        },
        download: data => {
          console.log("download");
          let downloadData = window.localStorage.getItem(data.name);
          let blob = new Blob([downloadData], {
            type: "text/plain;charset=utf-8"
          });
          saveData(blob, `${data.name}.data`);
        },
        sendcode: data => {
          console.log(data);
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
          console.log(data.code);
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
    let modelCode = codeMirror.getSelection();
    modelWorker.postMessage({ eval: modelCode });
    //console.log("DEBUG:ModelEditor:evalModelEditorExpression: " + code);
    window.localStorage.setItem("modelEditorValue", codeMirror.getValue());
    addToHistory("model-history-", modelCode);
  }

  function evalModelEditorExpressionBlock() {
    let modelCode = codeMirror.getBlock();
    console.log(modelCode);
    let linebreakPos = modelCode.indexOf('\n');
    let firstLine = modelCode.substr(0,linebreakPos)
    console.log(firstLine);
    if(firstLine == "//--DOM") {
      modelCode = modelCode.substr(linebreakPos);
      evalDomCode(modelCode);
      addToHistory("dom-history-", modelCode);
    }else{
      modelWorker.postMessage({ eval: modelCode });
      // console.log("DEBUG:ModelEditor:evalModelEditorExpressionBlock: " + code);
      window.localStorage.setItem("modelEditorValue", codeMirror.getValue());
      addToHistory("model-history-", modelCode);
    }
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

<!-- <div class="layout-template-container" contenteditable="true" bind:value={item.value}  bind:innerHTML={layoutTemplate}> -->
<div class="codemirror-container layout-template-container scrollable">
  <CodeMirror bind:this={codeMirror}
              bind:value={data}
              tab={true}
              lineNumbers={true}
              on:change={onChange}
              ctrlEnter={evalModelEditorExpressionBlock}
              cmdEnter={evalModelEditorExpressionBlock}
              shiftEnter={evalModelEditorExpression}
              />
    <!-- </div> -->
  <!-- </div> -->
</div>
<input aria-hidden="true" id="hiddenCopyField" style="position: absolute; left: -999em;" value="">
