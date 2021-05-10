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

    focusedItemProperties,

    items,
    isUploadOverlayVisible,
    hydrateJSONcomponent,
    loadEnvironmentSnapshotEntries
  } from '../../stores/playground.js'

  import * as doNotZip from 'do-not-zip';
	import downloadBlob from '../../utils/downloadBlob.js'

  import { PubSub } from "../../utils/pubSub.js";
  const messaging = new PubSub();

  let itemDeletionSubscriptionToken;


	import { createEventDispatcher } from 'svelte';
import { siteMode } from "../../stores/common";
	const dispatch = createEventDispatcher();


  // let selectModel;
  let selectedGrammarOption;
  // let selectedModelOption;
  let selectedVisualisationOption;


  function resetEnvironment(){

    $items = $items.slice($items.length);

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

    loadEnvironmentSnapshotEntries();
  }

  function loadEnvironment(){

    // Retrieve item, hydrate JSON into grid-items
    let json = window.localStorage.getItem($selectedLoadEnvironmentOption.content);
    $items = JSON.parse(json).map(item => hydrateJSONcomponent(item))

    // Reset UI
    $selectedLoadEnvironmentOption = $loadEnvironmentOptions[0];
    $isLoadEnvironmentOptionsDisabled = true;
  }

  function downloadEnvironment(){

    let timestamp = new Date(Date.now()).toISOString();

    // Create blob from current playround state and filtered content from editor widgets
    const blob = doNotZip.toBlob($items
      .reduce(
        (acc, val) => {
          if (val.data && val.data.content) // if 'val' is an editor type (liveCode, grammar or model), `data.content` if defined
            acc.push({ path: `${val.data.type}`+`.txt`, data: val.data.content });
          return acc
        }, [{ path: `playground.json`, data: localStorage.getItem("playground") }]
      )
    );
    // Trigger a browser file download
		downloadBlob(blob, 'sema-' + `${timestamp}` + '.zip');
  }

  function uploadEnvironment(){

    $isUploadOverlayVisible = true;
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
      case 'visualiser':
        messaging.publish("playground-add", { type: 'visualiser' });
        // $isAddAnalyserDisabled = true;
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
      else if(itemType === 'console'){
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
      else if(itemType === 'console'){
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
        case 'console':
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
          case 'console':
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
    setButtonsStateOnLoad();
    itemDeletionSubscriptionToken = messaging.subscribe("plaground-item-deletion", activateSelectOnItemDeletion);
  })

  onDestroy(() => {
    messaging.unsubscribe(itemDeletionSubscriptionToken);
  });

</script>

<style>

  .sidebar {
    /* width: 160px; */
    /* height: calc(100vh - 43px); */
    height: 100%;
    margin-top: 0px;
    display: flex;
    flex-direction: column;
    /* justify-content: flex-start; */
    justify-content: flex-start;
  }

  .controls {
    margin-bottom: 10px;
    margin-left: 3px;
    margin-right: 5px;
  }


  .layout-sidebar-group-widgets-container {
    /* height: 100%; */
    padding-top: 15px;
    margin-left:3px;
    margin-right:2px;
  }

  .layout-sidebar-group-properties-container {
    /* height: 100%; */
    padding-top: 3px;
    margin-left:3px;
    margin-right:2px;
  }

  .combobox-light {
    display: block;
    font-size: medium;
    font-family: sans-serif;
    font-weight: 400;
    cursor: pointer;
    /* color: #000; */
    line-height: 1.3;
    padding: 0.7em 1em 0.7em 1em;
    width: 8em;
    box-sizing: border-box;
    margin: 0;
    border: 0 solid #333;
    text-align: left;
    border-radius: .6em;
    -moz-appearance: none;
    -webkit-appearance: none;
    appearance: none;
    background-color: rgba(16, 16, 16, 0.04);
    background-repeat: no-repeat, repeat;
    background-position: right .7em top 50%, 0 0;
    background-size: .65em auto, 100%;
    box-shadow:   2px 2px 3px #ffffff61, -1px -1px 3px  rgb(0, 0, 0);
    -moz-box-shadow:   2px 2px 3px #ffffff61, -1px -1px 3px  rgb(0, 0, 0);
    -webkit-box-shadow:  2px 2px 3px #ffffff61, -1px -1px 3px  rgb(0, 0, 0);
  }



  .combobox-dark {
    display: block;
    font-size: medium;
    font-family: sans-serif;
    font-weight: 400;
    cursor: pointer;
    color: white;
    line-height: 1.3;
    padding: 0.7em 1em 0.7em 1em;
    width: 8em;
    box-sizing: border-box;
    margin: 0;
    border: 0 solid #333;
    text-align: left;
    border-radius: .6em;
    -moz-appearance: none;
    -webkit-appearance: none;
    appearance: none;
    background-color: rgba(16, 16, 16, 0.04);
    background-repeat: no-repeat, repeat;
    background-position: right .7em top 50%, 0 0;
    background-size: .65em auto, 100%;
    -webkit-box-shadow: 2px 2px 3px rgb(0, 0, 0), -0.5px -0.5px 3px #ffffff61;
    -moz-box-shadow: 2px 2px 3px rgb(0, 0, 0), -0.5px -0.5px 3px #ffffff61;
    box-shadow: 2px 2px 3px rgb(0, 0, 0), -0.5px -0.5px 3px #ffffff61;
  }


  .combobox-dark:hover {
    display: block;
    font-size: medium;
    font-family: sans-serif;
    font-weight: 500;
    cursor: pointer;
    color: white;
    line-height: 1.3;
    padding: 0.7em 1em 0.7em 1em;
    width: 8em;
    box-sizing: border-box;
    margin: 0;
    border: 0 solid #333;
    text-align: left;
    border-radius: .6em;
    -moz-appearance: none;
    -webkit-appearance: none;
    appearance: none;
    background-color: linear-gradient(rgba(16, 16, 16, 1), rgba(16, 16, 16, 0.2));
    background-repeat: no-repeat, repeat;
    background-position: right .7em top 50%, 0 0;
    background-size: .65em auto, 100%;
    -webkit-box-shadow: 5px 5px 20px -5px rgba(0,0,0,0.75), -5px -5px 20px rgba(255, 255, 255, 0.954);
    -moz-box-shadow: 5px 5px 20px -5px rgba(0,0,0,0.75), -5px -5px 20px rgba(255, 255, 255, 0.954);
    box-shadow: 2px 2px 3px rgb(0, 0, 0), -1px -1px 3px #ffffff61;
  }

  .combobox-dark:focus {
    display: block;
    font-size: medium;
    font-family: sans-serif;
    font-weight: 500;
    cursor: pointer;
    color: #fff;
    line-height: 1.3;
    padding: 0.7em 1em 0.7em 1em;
    width: 8em;
    box-sizing: border-box;
    margin: 0;
    border: 0 solid #333;
    text-align: left;
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
    font-size: medium;
    font-family: sans-serif;
    font-weight: 400;
    cursor: pointer;
    color: white;
    line-height: 1.3;
    padding: 0.7em 1em 0.7em 1em;
    width: 8em;
    max-width: 100%;
    box-sizing: border-box;
    border: 0 solid #333;
    text-align: left;
    border-radius: .6em;
    -moz-appearance: none;
    -webkit-appearance: none;
    appearance: none;
    background-color:  rgba(16, 16, 16, 0.04);
    background-repeat: no-repeat, repeat;
    background-position: right .7em top 50%, 0 0;
    background-size: .65em auto, 100%;
    -webkit-box-shadow: 2px 2px 3px rgb(0, 0, 0), -0.5px -0.5px 3px #ffffff61;
    -moz-box-shadow: 2px 2px 3px rgb(0, 0, 0), -0.5px -0.5px 3px #ffffff61;
    box-shadow: 2px 2px 3px rgb(0, 0, 0), -0.5px -0.5px 3px #ffffff61;
  }

  .button-dark:hover {
    display: block;
    font-size: medium;
    font-family: sans-serif;
    font-weight: 500;
    cursor: pointer;
    color: white;
    line-height: 1.3;
    padding: 0.7em 1em 0.7em 1em;
    width: 8em;
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
    background-color:  linear-gradient(rgba(16, 16, 16, 0.8), rgba(16, 16, 16, 0.08));
    /* background-image: url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23007CB2%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E'),
      linear-gradient(to bottom, #ffffff 0%,#e5e5e5 100%); */
    background-repeat: no-repeat, repeat;
    background-position: right .7em top 50%, 0 0;
    background-size: .65em auto, 100%;
    -webkit-box-shadow: 2px 2px 5px rgba(0,0,0),-0.5px -0.5px 3px rgb(34, 34, 34);
    -moz-box-shadow: 2px 2px 5px rgba(0,0,0), -0.5px -0.5px 3px rgb(34, 34, 34);;
    box-shadow: 2px 2px 3px rgb(0, 0, 0), -1px -1px 3px #ffffff61;

  }

  .button-dark:active {
    display: block;
    font-size: medium;
    font-family: sans-serif;
    font-weight: 400;
    cursor: pointer;
    color: white;
    line-height: 1.3;
    /* padding: 0.7em 1em 0.7em 1em; */
    width: 8em;
    max-width: 100%;
    box-sizing: border-box;
    /* border: 0 solid #333; */
    text-align: left;
    /* box-shadow: 0 1px 0 0px rgba(4, 4, 4, 0.04); */
    /* border-radius: .6em; */
    /* border-right-color: rgba(34,37,45, 0.1);
    border-right-style: solid;
    border-right-width: 1px;
    border-bottom-color: rgba(34,37,45, 0.1);
    border-bottom-style: solid;
    border-bottom-width: 1px; */
    -moz-appearance: none;
    -webkit-appearance: none;
    appearance: none;
    background-color:  rgba(16, 16, 16, 0.04);;
    /* background-image: url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23007CB2%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E'),
      linear-gradient(to bottom, #ffffff 0%,#e5e5e5 100%); */
    background-repeat: no-repeat, repeat;
    /* background-position: right .7em top 50%, 0 0; */
    background-size: .65em auto, 100%;
    /* -webkit-box-shadow: -1px -1px 1px rgb(34, 34, 34), 2px 2px 5px rgba(0,0,0),;
    -moz-box-shadow: -1px -1px 1px rgb(34, 34, 34), 2px 2px 5px rgba(0,0,0), ;
    box-shadow:  -1px -1px 3px #ffffff61, 2px 2px 3px rgb(0, 0, 0); */
    box-shadow:  -1px -1px 3px rgba(16, 16, 16, 0.4), 0.5px 0.5px 0.5px rgba(16, 16, 16, 0.04);
  }

  .group-labels {
    padding-left:5px;
    margin-bottom: 10px;
  }

  .group-label {
    /* color: #666; */
    font-size: medium;
    font-family: sans-serif;
    font-weight: 400
  }

  .button-dark:disabled {
    display: block;
    font-size: medium;
    font-family: sans-serif;
    font-weight: 400;
    cursor: pointer;
    color: #888;
    line-height: 1.3;
    padding: 0.7em 1em 0.7em 1em;
    width: 8em;
    max-width: 100%;
    box-sizing: border-box;
    border: 0 solid #333;
    text-align: left;
    border-radius: .6em;
    -moz-appearance: none;
    -webkit-appearance: none;
    appearance: none;
    background-color:  rgba(16, 16, 16, 0.04);
    background-repeat: no-repeat, repeat;
    background-position: right .7em top 50%, 0 0;
    background-size: .65em auto, 100%;
    box-shadow: 2px 2px 3px rgb(0, 0, 0), -1px -1px 3px #ffffff61;
    -moz-box-shadow: 2px 2px 3px rgb(0, 0, 0), -1px -1px 3px #ffffff61;
    -webkit-box-shadow: 2px 2px 3px rgb(0, 0, 0), -1px -1px 3px #ffffff61;
  }

  .button-light {
    display: block;
    font-size: medium;
    font-family: sans-serif;
    font-weight: 400;
    cursor: pointer;
    color: black;
    line-height: 1.3;
    padding: 0.7em 1em 0.7em 1em;
    width: 8em;
    max-width: 100%;
    box-sizing: border-box;
    border: 0 solid #333;
    text-align: left;
    border-radius: .6em;
    -moz-appearance: none;
    -webkit-appearance: none;
    appearance: none;
    background-color:  rgba(16, 16, 16, 0.04);
    background-repeat: no-repeat, repeat;
    background-position: right .7em top 50%, 0 0;
    background-size: .65em auto, 100%;
    box-shadow:   2px 2px 3px #ffffff61, -1px -1px 3px  rgb(0, 0, 0);
    -moz-box-shadow:   2px 2px 3px #ffffff61, -1px -1px 3px  rgb(0, 0, 0);
    -webkit-box-shadow:  2px 2px 3px #ffffff61, -1px -1px 3px  rgb(0, 0, 0);
  }

  .button-light:active {
    display: block;
    font-size: medium;
    font-family: sans-serif;
    font-weight: 400;
    cursor: pointer;
    color: black;
    line-height: 1.3;
    padding: 0.7em 1em 0.7em 1em;
    width: 8em;
    max-width: 100%;
    box-sizing: border-box;
    border: 0 solid #333;
    text-align: left;
    border-radius: .6em;
    -moz-appearance: none;
    -webkit-appearance: none;
    appearance: none;
    background-color:  rgba(16, 16, 16, 0.04);
    background-repeat: no-repeat, repeat;
    background-position: right .7em top 50%, 0 0;
    background-size: .65em auto, 100%;
    box-shadow:   2px 2px 3px #ffffff61, -1px -1px 3px  rgb(0, 0, 0);
    -moz-box-shadow:   2px 2px 3px #ffffff61, -1px -1px 3px  rgb(0, 0, 0);
    -webkit-box-shadow:  2px 2px 3px #ffffff61, -1px -1px 3px  rgb(0, 0, 0)
  }
  .button-light:disabled {
    display: block;
    font-size: medium;
    font-family: sans-serif;
    font-weight: 400;
    cursor: pointer;
    color: #888;
    line-height: 1.3;
    padding: 0.7em 1em 0.7em 1em;
    width: 8em;
    max-width: 100%;
    box-sizing: border-box;
    border: 0 solid #333;
    text-align: left;
    border-radius: .6em;
    -moz-appearance: none;
    -webkit-appearance: none;
    appearance: none;
    background-color:  rgba(16, 16, 16, 0.04);
    background-repeat: no-repeat, repeat;
    background-position: right .7em top 50%, 0 0;
    background-size: .65em auto, 100%;
    box-shadow:   2px 2px 3px #ffffff61, -1px -1px 3px  rgb(0, 0, 0);
    -moz-box-shadow:   2px 2px 3px #ffffff61, -1px -1px 3px  rgb(0, 0, 0);
    -webkit-box-shadow:  2px 2px 3px #ffffff61, -1px -1px 3px  rgb(0, 0, 0)
  }



</style>


<div class="sidebar">

  <div class="layout-sidebar-group-widgets-container">

    <div class="group-labels" >
      <span class="group-label">Windows</span>
    </div>
    <!-- Live Code Combobox Selector -->
    <div class="controls">
      <!-- on:click={ () => $sidebarLiveCodeOptions[0].disabled = true }  -->
      <!-- svelte-ignore a11y-no-onchange -->
      <select class="{ $siteMode === 'dark'? 'combobox-dark' :'combobox-light'}"
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
      <select class="{ $siteMode === 'dark'? 'combobox-dark' :'combobox-light'}"
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


    <!-- Debuggers Combobox Selector -->
    <div class="controls">
      <!-- svelte-ignore a11y-no-onchange -->
      <select class="{ $siteMode === 'dark'? 'combobox-dark' :'combobox-light' }"
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
      <button class="{ $siteMode === 'dark'? 'button-dark' :'button-light' } controls"
              on:click={ () => dispatchAdd('analyser') }
              disabled={ $isAddAnalyserDisabled }
              >
        analyser
      </button>
    </div>

    <div>
      <button class="{ $siteMode === 'dark'? 'button-dark' :'button-light' } controls"
              on:click={ () => dispatchAdd('visualiser') }
              >
        visualiser
      </button>
    </div>

    <br>

  </div>


  <div class="layout-sidebar-group-properties-container">

    <div class="group-labels" >
      <span class="group-label">Window Settings</span>
    </div>
    <div>
      <ItemProps></ItemProps>
    </div>

    <br>


  </div>



  <!-- <div class="layout-combobox-container">


    <div class="group-labels">
      <span class="group-label">Environment</span>
    </div>
    <div class="controls">
      <button class="button-dark"
              on:click={ () => resetEnvironment() }
              >
        reset
      </button>
    </div>
    <div class="controls">
      <button class="button-dark"
              on:click={ () => storeEnvironment() }
              >
        store
      </button>
    </div>

    <div class="controls">
      svelte-ignore a11y-no-onchange
      <select class="combobox-dark"
              bind:value={ $selectedLoadEnvironmentOption }
              on:change={ () => loadEnvironment() }
              on:click={ () => $loadEnvironmentOptions[0].disabled = true }
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
        upload
      </button>
    </div>

    <div class="controls">
      <button class="button-dark"
              on:click={ () => downloadEnvironment() }
              >
        download
      </button>
    </div>

    <br>
  </div> -->

</div>
