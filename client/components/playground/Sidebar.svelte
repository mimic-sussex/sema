<script>

  import { onMount, onDestroy } from "svelte";

  import ItemProps from './ItemProps.svelte';

  import {
    sidebarLiveCodeOptions,
    selectedLiveCodeOption,
    isSelectLiveCodeEditorDisabled,

    sidebarModelOptions,
    selectedModelOption,
    isSelectModelEditorDisabled,


    loadEnvironmentOptions,
    selectedLoadEnvironmentOption,
    isLoadEnvironmentOptionsDisabled,

    // sidebarGrammarOptions,
    isAddGrammarEditorDisabled,

    isAddAnalyserDisabled,

    sidebarDebuggerOptions,
    selectedDebuggerOption,
    isSelectDebuggerDisabled,
    // sidebarVisualisationOptions,

    focusedItemProperties,

    items
    // editorThemes,
    // selectedModel,
  } from '../../stores/playground.js'


  import { id,
           addToHistory
  } from '../../utils/utils.js';

  import { PubSub } from "../../messaging/pubSub.js";
  const messaging = new PubSub();

  let itemDeletionSubscriptionToken;

  // import Markdown from "./Markdown.svelte";

	import { createEventDispatcher } from 'svelte';
	const dispatch = createEventDispatcher();


  // let selectModel;
  let selectedGrammarOption;
  // let selectedModelOption;
  let selectedVisualisationOption;

  function onSelectSnapShot(){


  }


  function onReset(){
    messaging.publish('playground-reset');

    $isSelectLiveCodeEditorDisabled = false;
    $isSelectModelEditorDisabled = false;
    $isAddGrammarEditorDisabled = false;
    $isAddAnalyserDisabled = false;
    $sidebarDebuggerOptions.map( option => option.disabled = false );
  }

  function storeEnvironment(){

    // Add to playground history, e.g.
    // Key – playground-2020-03-02T15:48:31.080Z,
    // Value: [{"2":{"fixed":false,"resizable":true,"draggable":true,"min":{"w":1,"h":1},"max":{}, ...]
	  window.localStorage["playground-" + new Date(Date.now()).toISOString()] = JSON.stringify($items);

    let keys = Object.keys(localStorage).filter(key => key.includes("playground-"));

    $loadEnvironmentOptions = keys.reduce((acc, val, i) =>
      [ ...acc, { id: i+1, disabled: false, text: val.substring(11) } ]
      , [{ id: 0, disabled: false, text: `Load` }]
    )
  }

  function loadEnvironment(){

    messaging.publish('playground-environmentLoad', { type: 'loadEnvironment', data: selected.content });
    $selectedLoadEnvironmentOption = $loadEnvironmentOptions[0];
    $isLoadEnvironmentOptionsDisabled = true;
  }

  function downloadEnvironment(){

    messaging.publish('playground-snapshotDownload');
  }

  function uploadEnvironment(){

    messaging.publish('playground-snapshotUpload');
  }

  function dispatchAdd(type, selected){
    // console.log(`DEBUG:Sidebar:dispatchAdd: /add/${type}/${selected.id}`);
    // console.log(selected.content);

    switch (type) {
      case 'live':
        messaging.publish("playground-add", { type: 'liveCodeEditor', data: selected.content });
        $selectedLiveCodeOption = $sidebarLiveCodeOptions[0];
        $isSelectLiveCodeEditorDisabled = true;
        break;
      case 'model':
        messaging.publish("playground-add", { type: 'modelEditor', data: selected.content });
        $selectedModelOption = $sidebarModelOptions[0];
        $isSelectModelEditorDisabled = true;
        break;
      // case 'grammar':
      //   messaging.publish("playground-add", { type: 'grammarEditor'});
      //   // selectedGrammarOption = sidebarGrammarOptions[0];
      //   $isAddGrammarEditorDisabled = true;
      //   break;
      case 'analyser':
        messaging.publish("playground-add", { type: 'analyser' });
        $isAddAnalyserDisabled = true;
        break;
      case 'debugger':
        messaging.publish("playground-add", { type: selected.type });
        disableSelectDebuggerOption(selected.type);
        $selectedDebuggerOption = $sidebarDebuggerOptions[0];
        break;
      default:
        break;
    }
  }


  function disableSelectDebuggerOption(itemType){

    if(itemType !== undefined)
      if(itemType === 'grammarCompileOutput'){
        $sidebarDebuggerOptions[1].disabled = true;
      }
      else if(itemType === 'liveCodeParseOutput'){
        $sidebarDebuggerOptions[2].disabled = true;
      }
      else if(itemType === 'dspCodeOutput'){
        $sidebarDebuggerOptions[3].disabled = true;
      }
      else if(itemType === 'postIt'){
        $sidebarDebuggerOptions[4].disabled = true;
      }
      else if(itemType === 'storeInspector'){
        $sidebarDebuggerOptions[5].disabled = true;
      }
    else
      throw new Error("Disable Select Debugger Option: itemType undefined")
  }


  function setDisabledOnSelectDebuggerOption(itemType, state){

    if(itemType !== undefined)
      if(itemType === 'grammarCompileOutput'){
        $sidebarDebuggerOptions[1].disabled = state;
      }
      else if(itemType === 'liveCodeParseOutput'){
        $sidebarDebuggerOptions[2].disabled = state;
      }
      else if(itemType === 'dspCodeOutput'){
        $sidebarDebuggerOptions[3].disabled = state;
      }
      else if(itemType === 'postIt'){
        $sidebarDebuggerOptions[4].disabled = state;
      }
      else if(itemType === 'storeInspector'){
        $sidebarDebuggerOptions[5].disabled = state;
      }
    else
      throw new Error("Enable Select Debugger Option On Item Deletion: itemType undefined");
  }


  function activateSelectOnItemDeletion(itemType){
    // console.log("DEBUG:routes/playground:sidebar:activateSelectOnItemDeletion:")

    if(itemType !== null){
      switch (itemType) {
        case 'liveCodeEditor':
          $isSelectLiveCodeEditorDisabled = false;
          break;
        case 'modelEditor':
          $isSelectModelEditorDisabled = false;
          break;
        case 'grammarEditor':
          $isAddGrammarEditorDisabled = false;
          break;
        case 'analyser':
          $isAddAnalyserDisabled = false;
          break;
        case 'grammarCompileOutput':
        case 'liveCodeParseOutput':
        case 'dspCodeOutput':
        case 'postIt':
        case 'storeInspector':
          setDisabledOnSelectDebuggerOption(itemType, false);
          break;
        default:
          break;
      }
    }
    else
      throw new Error("Activate Select On Item Deletion: itemType undefined")
  }


  function setButtonsStateOnLoad(){

    if($items.length > 0){
      for (const item of $items){
        switch (item.type) {
          case 'liveCodeEditor':
            $isSelectLiveCodeEditorDisabled = true;
            break;
          case 'modelEditor':
            $isSelectModelEditorDisabled = true;
            break;
          case 'grammarEditor':
            $isAddGrammarEditorDisabled = true;
            break;
          case 'analyser':
            $isAddAnalyserDisabled = true;
            break;
          case 'grammarCompileOutput':
          case 'liveCodeParseOutput':
          case 'dspCodeOutput':
          case 'postIt':
          case 'storeInspector':
            setDisabledOnSelectDebuggerOption(item.type, true);
            break;
          default:
            break;
        }
      }
    }
  }


  onMount(() => {
    // console.log("DEBUG:routes/playground:sidebar:onMount")

    setButtonsStateOnLoad();
    itemDeletionSubscriptionToken = messaging.subscribe("plaground-item-deletion", activateSelectOnItemDeletion);
  })

  onDestroy(() => {
    // console.log("DEBUG:routes/playground:sidebar:onDestroy")

    messaging.unsubscribe(itemDeletionSubscriptionToken);
  });

</script>

<style>

  .sidebar {
    /* width: 160px; */
    height: 100%;
    margin-top: 0px;
  }

  .controls {
    margin-bottom: 10px;
    margin-left: 3px;
    margin-right: 5px;
  }

  /* .checkbox-span {
    color: whitesmoke;
    margin-left: 20px;
  } */
  /* .checkbox-input {
    margin-left: 5px;
  } */

  /* The checkbox container */
  /* .checkbox-container {
    display: block;
    position: relative;
    color: whitesmoke;
    margin-bottom: 10px;
    cursor: pointer;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
    font-size: 12px;
  } */

  .layout-combobox-container{
    padding-top: 3px;
    margin-left:3px;
    margin-right:2px;
  }




  .combobox-dark {
    display: block;
    font-size: 12px;
    font-family: sans-serif;
    font-weight: 400;
    cursor: pointer;
    color: #fff;
    line-height: 1.3;
    padding: 0.7em 1em 0.7em 1em;
    width: 10em;
    box-sizing: border-box;
    margin: 0;
    border: 0 solid #333;
    text-align: left;
    /*border-right-color: rgba(34,37,45, 0.4);;
    border-right-style: solid;
    border-right-width: 1px;
    border-bottom-color: rgba(34,37,45, 0.4);
    border-bottom-style: solid;
    border-bottom-width: 1px; */
    /* box-shadow: 0 1px 0 0px rgba(4, 4, 4, 0.04); */
    border-radius: .6em;
    -moz-appearance: none;
    -webkit-appearance: none;
    appearance: none;
    background-color: rgba(16, 16, 16, 0.04);
    background-repeat: no-repeat, repeat;
    background-position: right .7em top 50%, 0 0;
    background-size: .65em auto, 100%;
    -webkit-box-shadow: 5px 5px 20px -5px rgba(0,0,0,0.75), -5px -5px 20px rgba(255, 255, 255, 0.954);
    -moz-box-shadow: 5px 5px 20px -5px rgba(0,0,0,0.75), -5px -5px 20px rgba(255, 255, 255, 0.954);
    box-shadow: 2px 2px 3px rgb(0, 0, 0), -1px -1px 3px #ffffff61;
  }


  .button-dark {
    display: block;
    font-size: 12px;
    font-family: sans-serif;
    font-weight: 400;
    cursor: pointer;
    color: #fff;
    line-height: 1.3;
    padding: 0.7em 1em 0.7em 1em;
    width: 10em;
    max-width: 100%;
    box-sizing: border-box;
    border: 0 solid #333;
    text-align: left;
    /* box-shadow: 0 1px 0 0px rgba(4, 4, 4, 0.04); */
    border-radius: .6em;
    /* border-right-color: rgba(34,37,45, 0.1);
    border-right-style: solid;
    border-right-width: 1px;
    border-bottom-color: rgba(34,37,45, 0.1);
    border-bottom-style: solid;
    border-bottom-width: 1px; */
    -moz-appearance: none;
    -webkit-appearance: none;
    appearance: none;
    background-color:  rgba(16, 16, 16, 0.04);
    /* background-image: url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23007CB2%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E'),
      linear-gradient(to bottom, #ffffff 0%,#e5e5e5 100%); */
    background-repeat: no-repeat, repeat;
    background-position: right .7em top 50%, 0 0;
    background-size: .65em auto, 100%;
    -webkit-box-shadow: 2px 2px 5px rgba(0,0,0),-1px -1px 1px rgb(34, 34, 34);
    -moz-box-shadow: 2px 2px 5px rgba(0,0,0), -1px -1px 1px rgb(34, 34, 34);;
    box-shadow: 2px 2px 3px rgb(0, 0, 0), -1px -1px 3px #ffffff61;

  }

  .group-labels {

    padding-left:5px;
    margin-bottom: 10px;
  }


  .group-label {
    color: #666;
    font-size: 14px;
    font-family: sans-serif;
    font-weight: 400
  }


  .button-dark:disabled {
    display: block;
    font-size: 12px;
    font-family: sans-serif;
    font-weight: 400;
    cursor: pointer;
    color: #999;
    line-height: 1.3;
    padding: 0.7em 1em 0.7em 1em;
    /* width: 100%; */
    width: 10em;
    max-width: 100%;
    box-sizing: border-box;
    border: 0 solid #333;
    text-align: left;
    /* box-shadow: 0 1px 0 0px rgba(4, 4, 4, 0.04); */
    border-radius: .6em;
    /* border-right-color: rgba(34,37,45, 0.1);
    border-right-style: solid;
    border-right-width: 1px;
    border-bottom-color: rgba(34,37,45, 0.1);
    border-bottom-style: solid;
    border-bottom-width: 1px; */
    -moz-appearance: none;
    -webkit-appearance: none;
    appearance: none;
    background-color:  rgba(16, 16, 16, 0.04);
    /* background-image: url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23007CB2%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E'),
      linear-gradient(to bottom, #ffffff 0%,#e5e5e5 100%); */
    background-repeat: no-repeat, repeat;
    background-position: right .7em top 50%, 0 0;
    background-size: .65em auto, 100%;
    -webkit-box-shadow: 2px 2px 5px rgba(0,0,0),-1px -1px 1px rgb(34, 34, 34);
    -moz-box-shadow: 2px 2px 5px rgba(0,0,0), -1px -1px 1px rgb(34, 34, 34);;
    box-shadow: 2px 2px 3px rgb(0, 0, 0), -1px -1px 3px #ffffff61;

  }



</style>


<div class="sidebar">

  <div class="layout-combobox-container">

    <div class="group-labels" >
      <span class="group-label">Widgets</span>
    </div>
    <!-- Live Code Combobox Selector -->
    <div class="controls">
      <!-- on:click={ () => $sidebarLiveCodeOptions[0].disabled = true }  -->
      <!-- svelte-ignore a11y-no-onchange -->
      <select class="combobox-dark"
              bind:value={ $selectedLiveCodeOption }
              on:change={ () => dispatchAdd('live', $selectedLiveCodeOption) }
              on:click={ () => $sidebarLiveCodeOptions[0].disabled = true }
              disabled={ $isSelectLiveCodeEditorDisabled }
              cursor={ () => ( $isSelectLiveCodeEditorDisabled ? 'not-allowed' : 'pointer') }
              >
        {#each $sidebarLiveCodeOptions as liveCodeOption}
          <option disabled={ liveCodeOption.disabled }
                  value={liveCodeOption}
                  >
            {liveCodeOption.text}
          </option>
        {/each}
      </select>
    </div>

    <!-- Model Combobox Selector -->
    <div class="controls">
      <!-- <select class="combobox" bind:value={$selectedTutorial} > -->
      <!-- on:click={ () => $sidebarModelOptions[0].disabled = true }   -->
      <!-- svelte-ignore a11y-no-onchange -->
      <select class="combobox-dark"
              bind:value={ $selectedModelOption }
              on:change={ () => dispatchAdd('model', $selectedModelOption) }
              on:click={ () => $sidebarModelOptions[0].disabled = true }
              disabled={ $isSelectModelEditorDisabled }
              cursor={ () => ( $isSelectModelEditorDisabled ? 'not-allowed' : 'pointer' )}
              >
        {#each $sidebarModelOptions as modelOption}
          <option disabled={modelOption.disabled}
                  value={modelOption}
                  >
            { modelOption.text }
          </option>
        {/each}
      </select>
    </div>

    <!-- Grammar Combobox Selector -->
    <!-- <div class="controls">
      <select class="combobox-dark"
              bind:value={selectedGrammarOption}
              on:change={ () => dispatchAdd('grammar', selectedGrammarOption) } >
        {#each sidebarGrammarOptions as grammarOption}
          <option value={grammarOption}>
            { grammarOption.text }
          </option>
        {/each}
      </select>
    </div> -->

    <!-- <div>
      <button class="button-dark controls"
              on:click={ () => dispatchAdd('grammar') }
              disabled={ $isAddGrammarEditorDisabled }
              >
        Grammar Editor
      </button>
    </div> -->

    <!-- Debuggers Combobox Selector -->
    <div class="controls">
      <!-- svelte-ignore a11y-no-onchange -->
      <select class="combobox-dark"
              bind:value={ $selectedDebuggerOption }
              on:change={ () => dispatchAdd('debugger', $selectedDebuggerOption) }
              on:click={ () => $sidebarDebuggerOptions[0].disabled = true  }
              >
        {#each $sidebarDebuggerOptions as debuggerOption}
          <option disabled={ debuggerOption.disabled }
                  value={ debuggerOption }>
            { debuggerOption.text }
          </option>
        {/each}
      </select>
    </div>

    <div>
      <button class="button-dark controls"
              on:click={ () => dispatchAdd('analyser') }
              disabled={ $isAddAnalyserDisabled }
              >
        Audio Analyser
      </button>
    </div>



    <!-- <div>
      <label class="checkbox-container">Line Numbers
        <input type="checkbox" checked="checked" class="checkbox-input">
        <span  class="checkbox-span"></span>
      </label>
    </div> -->
  </div>

  <hr style="width: 85%; border-bottom: 1px solid black;">

  <div class="layout-combobox-container">

    <div class="group-labels" >
      <span class="group-label">Properties</span>
    </div>
    <div>
      <ItemProps></ItemProps>
    </div>

      <!-- <div class="">
        <select class="combobox-dark" >
          {#each editorThemes as modelOption}
            <option value={ modelOption }>
              { modelOption.text }
            </option>
          {/each}
        </select>
      </div> -->
  </div>
  <hr style="width: 85%; border-bottom: 1px solid black;">
  <div class="layout-combobox-container">

    <div class="group-labels">
      <span class="group-label">Environment</span>
    </div>
    <div class="controls">
      <button class="button-dark"
              on:click={ onReset }
              >
        Reset
      </button>
    </div>
    <div class="controls">
      <button class="button-dark"
              on:click={ () => storeEnvironment() }
              >
        Store
      </button>
    </div>

    <div class="controls">
      <!-- svelte-ignore a11y-no-onchange -->
      <select class="combobox-dark"
              bind:value={ $selectedLoadEnvironmentOption }
              on:change={ () => loadEnvironment() }
              on:click={ () => $loadEnvironmentOptions[0].disabled = true }
              disabled={ $isLoadEnvironmentOptionsDisabled }
              cursor={ () => ( $isLoadEnvironmentOptionsDisabled ? 'not-allowed' : 'pointer') }
              >
        {#each $loadEnvironmentOptions as loadEnvironmentOption }
          <option disabled={ loadEnvironmentOption.disabled }
                  value={loadEnvironmentOption}
                  >
            { loadEnvironmentOption.text }
          </option>
        {/each}
      </select>
    </div>

    <div class="controls">
      <button class="button-dark"
              on:click={ () => uploadEnvironment() }
              >
        Upload
      </button>
    </div>

    <div class="controls">
      <button class="button-dark"
              on:click={ () => downloadEnvironment() }
              >
        Download
      </button>
    </div>

  </div>
</div>
