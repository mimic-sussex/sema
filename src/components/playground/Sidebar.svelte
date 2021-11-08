<script>

  import { onMount, onDestroy } from "svelte";

  import ItemProps from './ItemProps.svelte';
  import Mouse from '../widgets/devices/Mouse.svelte';
  import Mic from '../widgets/devices/Mic.svelte';
  import SidebarDropdown from './SidebarDropdown.svelte';

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
    console.log('DEBUG: dispatchAdd', type, selected);

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
      case 'MIDI':
        messaging.publish("playground-add", { type: 'MIDI' });
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
      else if(itemType === 'dspCode'){
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
      else if(itemType === 'dspCode'){
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
        case 'dspCode':
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
        switch (item.data.type) {
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
          case 'dspCode':
          case 'console':
          case 'storeInspector':
            setDisabledOnSelectDebuggerOption(item.data.type, true);
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
    width: 64px;
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
    background-color: #262a2e;
    border-radius: 5px;
  }

  .layout-sidebar-group-properties-container {
    /* height: 100%; */
    padding-top: 3px;
    margin-left:3px;
    margin-right:2px;
  }

  .combobox-dark{
    padding: 20;
		background-color: #262a2e;
		color: grey;
		border: none;
    width: 42px;
  	/* height: 42px; */
  	margin: 8px 8px 8px 8px;
  	border-radius: 5px;
  	background-color: #262a2e;
  }

  .button-dark{
    padding: 20;
		background-color: #262a2e;
		color: grey;
		border: none;
    width: 42px;
  	/* height: 42px; */
  	margin: 8px 8px 8px 8px;
  	border-radius: 5px;
  	background-color: #262a2e;
  }

  .button-dark:hover {
    /* background-color: blue; */
    color: white;
  }

  .button-dark:active{
    color: white;
    background-color: grey;
  }

  /* .combobox-light {
    display: block;
    font-size: medium;
    font-family: sans-serif;
    font-weight: 400;
    cursor: pointer;
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

  .combobox-light:disabled {
    display: block;
    font-size: medium;
    font-family: sans-serif;
    font-weight: 400;
    cursor: not-allowed;
    color: #888;
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

  .combobox-dark:disabled {
    display: block;
    font-size: medium;
    font-family: sans-serif;
    font-weight: 400;
    cursor: not-allowed;
    color: #888;
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
    border-radius: .6em;
    -moz-appearance: none;
    -webkit-appearance: none;
    appearance: none;
    background-color:  linear-gradient(rgba(16, 16, 16, 0.8), rgba(16, 16, 16, 0.08));
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
    width: 8em;
    max-width: 100%;
    box-sizing: border-box;
    text-align: left;
    -moz-appearance: none;
    -webkit-appearance: none;
    appearance: none;
    background-color:  rgba(16, 16, 16, 0.04);;
    background-repeat: no-repeat, repeat;
    background-size: .65em auto, 100%;
    box-shadow:  -1px -1px 3px rgba(16, 16, 16, 0.4), 0.5px 0.5px 0.5px rgba(16, 16, 16, 0.04);
  }

  .button-dark:disabled {
    display: block;
    font-size: medium;
    font-family: sans-serif;
    font-weight: 400;
    cursor: not-allowed;
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
  } */

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

  /*for the dropdown menu of the comboboxes, we set the color to fix css issue on linux
  and windows*/
  /* .dropdown-content {
    color: black;
  } */

  /* .dropdown-content {
    display: none;
    position: absolute;
    background-color: #282828;
    min-width: 160px;
    box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.2);
    z-index: 1;
  } */

  .dropdown {
    float: left;
    overflow: hidden;
  }
  .dropdown .dropbtn {
    font-size: 16px;  
    border: none;
    outline: none;
    color: white;
    padding: 14px 16px;
    background-color: inherit;
    font-family: inherit;
    margin: 0;
  }
  .dropdown-content {
    display: none;
    position: absolute;
    background-color: #282828;
    min-width: 160px;
    box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.2);
    z-index: 1;
  }

  .dropdown-content a {
    float: none;
    color: #f9f9f9;
    padding: 12px 16px;
    text-decoration: none;
    display: block;
    text-align: left;
  }

  .dropdown-content a:hover {
    background-color: #404040;
  }

  .dropdown:focus .dropdown-content {
    display: block;
  }

  .dropdown:hover .dropbtn {
    background-color: #282828;
  }


</style>


<div class="sidebar">

  <div class="layout-sidebar-group-widgets-container">
    <!-- Widgets title -->
    <!-- <div class="group-labels" >
      <span class="group-label">Widgets</span>
    </div> -->


    <SidebarDropdown>
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width="16" 
        height="16" 
        fill="currentColor" 
        class="bi bi-plus-lg" 
        viewBox="0 0 16 16" 
        slot='icon'>
        <path fill-rule="evenodd" d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2Z"/>
      </svg>

      <div slot='content'>
        {#each $sidebarLiveCodeOptions as liveCodeOption}
          <p on:click={ () => dispatchAdd('live', liveCodeOption)}>{liveCodeOption.text}</p>
        {/each}
      </div>

    </SidebarDropdown>

    <SidebarDropdown 
    >
      <svg xmlns="http://www.w3.org/2000/svg" 
        width="16" 
        height="16" 
        fill="currentColor" 
        class="bi bi-tools" 
        viewBox="0 0 16 16" 
        slot='icon'>
        <path d="M1 0 0 1l2.2 3.081a1 1 0 0 0 .815.419h.07a1 1 0 0 1 .708.293l2.675 2.675-2.617 2.654A3.003 3.003 0 0 0 0 13a3 3 0 1 0 5.878-.851l2.654-2.617.968.968-.305.914a1 1 0 0 0 .242 1.023l3.356 3.356a1 1 0 0 0 1.414 0l1.586-1.586a1 1 0 0 0 0-1.414l-3.356-3.356a1 1 0 0 0-1.023-.242L10.5 9.5l-.96-.96 2.68-2.643A3.005 3.005 0 0 0 16 3c0-.269-.035-.53-.102-.777l-2.14 2.141L12 4l-.364-1.757L13.777.102a3 3 0 0 0-3.675 3.68L7.462 6.46 4.793 3.793a1 1 0 0 1-.293-.707v-.071a1 1 0 0 0-.419-.814L1 0zm9.646 10.646a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708l-3-3a.5.5 0 0 1 0-.708zM3 11l.471.242.529.026.287.445.445.287.026.529L5 13l-.242.471-.026.529-.445.287-.287.445-.529.026L3 15l-.471-.242L2 14.732l-.287-.445L1.268 14l-.026-.529L1 13l.242-.471.026-.529.445-.287.287-.445.529-.026L3 11z"/>
      </svg>

      <div slot='content'>
        {#each $sidebarDebuggerOptions as debuggerOption}
          <p on:click={ () => dispatchAdd('live', debuggerOption)}>{debuggerOption.text}</p>
        {/each}
      </div>

    </SidebarDropdown>


    
    <!-- <div class="dropdown">
      <button class="dropbtn">

        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-plus-lg" viewBox="0 0 16 16">
          <path fill-rule="evenodd" d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2Z"/>
        </svg>

      </button>
      <div class="dropdown-content">
        {#each $sidebarLiveCodeOptions as liveCodeOption}
          <p>{liveCodeOption.text}</p>
        {/each}
      </div>
    </div>  -->


    <!-- Live Code Combobox Selector -->
    <!-- <div class="controls">
      <select class="{ $siteMode === 'dark'? 'combobox-dark' :'combobox-light'}"
              bind:value={ $selectedLiveCodeOption }
              on:change={ () => dispatchAdd('live', $selectedLiveCodeOption) }
              on:click={ () => $sidebarLiveCodeOptions[0].disabled = true }
              disabled={ $isSelectLiveCodeEditorDisabled }
              cursor={ () => ( $isSelectLiveCodeEditorDisabled ? 'not-allowed' : 'pointer') }
              >
        {#each $sidebarLiveCodeOptions as liveCodeOption}
          <option class="dropdown-content" disabled={ liveCodeOption.disabled }
                  value={liveCodeOption}
                  >
            {liveCodeOption.text}
          </option>
        {/each}
      </select>
    </div> -->

    <!-- Model Combobox Selector -->
    <!-- <div class="controls">
      <select class="{ $siteMode === 'dark'? 'combobox-dark' :'combobox-light'}"
              bind:value={ $selectedModelOption }
              on:change={ () => dispatchAdd('model', $selectedModelOption) }
              on:click={ () => $sidebarModelOptions[0].disabled = true }
              disabled={ $isSelectModelEditorDisabled }
              cursor={ () => ( $isSelectModelEditorDisabled ? 'not-allowed' : 'pointer' )}
              >
        {#each $sidebarModelOptions as modelOption}
          <option class="dropdown-content" disabled={modelOption.disabled}
                  value={modelOption}
                  >
            { modelOption.text }
          </option>
        {/each}
      </select>
    </div> -->


    <!-- Debuggers Combobox Selector -->
    <!-- <div class="controls">
      <select class="{ $siteMode === 'dark'? 'combobox-dark' :'combobox-light' }"
              bind:value={ $selectedDebuggerOption }
              on:change={ () => dispatchAdd('debugger', $selectedDebuggerOption) }
              on:click={ () => $sidebarDebuggerOptions[0].disabled = true  }
              >
        {#each $sidebarDebuggerOptions as debuggerOption}
          <option class="dropdown-content" disabled={ debuggerOption.disabled }
                  value={ debuggerOption }>
            { debuggerOption.text }
          </option>
        {/each}
      </select>
    </div> -->

    <div>
      <button class="{ $siteMode === 'dark'? 'button-dark' :'button-light' } controls"
              on:click={ () => dispatchAdd('analyser') }
              disabled={ $isAddAnalyserDisabled }
              >
              <div class='icon-container'>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-activity" viewBox="0 0 16 16">
                  <path fill-rule="evenodd" d="M6 2a.5.5 0 0 1 .47.33L10 12.036l1.53-4.208A.5.5 0 0 1 12 7.5h3.5a.5.5 0 0 1 0 1h-3.15l-1.88 5.17a.5.5 0 0 1-.94 0L6 3.964 4.47 8.171A.5.5 0 0 1 4 8.5H.5a.5.5 0 0 1 0-1h3.15l1.88-5.17A.5.5 0 0 1 6 2Z"/>
                </svg>
              </div>
      </button>
    </div>

    <div>
      <Mouse />
    </div>

    <div>
      <Mic />
    </div>

    <!--
    <div>
      <button class="{ $siteMode === 'dark'? 'button-dark' :'button-light' } controls"
              on:click={ () => dispatchAdd('visualiser') }
              >
        visualiser
      </button>
    </div>

    <div>
      <button class="{ $siteMode === 'dark'? 'button-dark' :'button-light' } controls"
              on:click={ () => dispatchAdd('MIDI') }
              >
        MIDI
      </button>
    </div>
    -->

    <br>

  </div>


  <!-- <div class="layout-sidebar-group-properties-container">

    <div class="group-labels" >
      <span class="group-label">Widget Settings</span>
    </div>
    <div>
      <ItemProps></ItemProps>
    </div>

    <br>


  </div> -->



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
