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

  import {
    liveCodeEditorMenuExpanded,
    modelEditorMenuExpanded,
    debuggersMenuExpanded,
  } from '../../stores/sidebar.js';

  import * as doNotZip from 'do-not-zip';
	import downloadBlob from '../../utils/downloadBlob.js'

  import { PubSub } from "../../utils/pubSub.js";
  const messaging = new PubSub();

  let itemDeletionSubscriptionToken;
  let changingPlaygroundSubscriptionToken;
  let disableSidebarSubscriptionToken;

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
        $selectedDebuggerOption = $sidebarDebuggerOptions[0];
        disableSelectDebuggerOption(selected.type);
        break;
      default:
        break;
    }
  }


  function disableSelectDebuggerOption(itemType){

    if(itemType !== undefined)
      if(itemType === 'console'){
        $sidebarDebuggerOptions[1].disabled = true;
      }
      else if(itemType === 'liveCodeParseOutput'){
        $sidebarDebuggerOptions[2].disabled = true;
      }
      else if(itemType === 'dspCode'){
        $sidebarDebuggerOptions[3].disabled = true;
      }
      else if(itemType === 'grammarCompileOutput'){
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
      if(itemType === 'console'){
        $sidebarDebuggerOptions[1].disabled = state;
      }
      else if(itemType === 'liveCodeParseOutput'){
        $sidebarDebuggerOptions[2].disabled = state;
      }
      else if(itemType === 'dspCode'){
        $sidebarDebuggerOptions[3].disabled = state;
      }
      else if(itemType === 'grammarCompileOutput'){
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
    console.log('set button state on load');
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

  function setButtonsStateOnChange(){
    //set all to enabled first
    $isSelectLiveCodeEditorDisabled = false;
    $isSelectModelEditorDisabled = false;
    $isAddGrammarEditorDisabled = false;
    $isAddAnalyserDisabled = false;
    $sidebarDebuggerOptions.map( option => option.disabled = false );
    //then disable those which need disabling
    setButtonsStateOnLoad()
  }

  //disable all buttons
  //we use this when the DoesNotExist overlay is triggered to make sure
  //the user cant spawn any widgets
  function disableAllButtons(){
    //set all to enabled first
    $isSelectLiveCodeEditorDisabled = true;
    $isSelectModelEditorDisabled = true;
    $isAddGrammarEditorDisabled = true;
    $isAddAnalyserDisabled = true;
    $sidebarDebuggerOptions.map( option => option.disabled = true );
  }


  onMount(() => {
    setButtonsStateOnLoad();
    itemDeletionSubscriptionToken = messaging.subscribe("plaground-item-deletion", activateSelectOnItemDeletion);
    changingPlaygroundSubscriptionToken = messaging.subscribe("changing-playground", setButtonsStateOnChange);
    disableSidebarSubscriptionToken = messaging.subscribe("disable-sidebar", disableAllButtons);
  })

  onDestroy(() => {
    messaging.unsubscribe(itemDeletionSubscriptionToken);
  });


  function launchLiveCodeEditorMenu(){
    //open livecode editor menu, close the others
    $liveCodeEditorMenuExpanded = !$liveCodeEditorMenuExpanded;
    $modelEditorMenuExpanded = false;
    $debuggersMenuExpanded = false;
  }

  function launchModelEditorMenu(){
    $liveCodeEditorMenuExpanded = false;
    $modelEditorMenuExpanded = !$modelEditorMenuExpanded;
    $debuggersMenuExpanded = false;
  }

  function launchDebuggersMenu(){
    $liveCodeEditorMenuExpanded = false;
    $modelEditorMenuExpanded = false;
    $debuggersMenuExpanded = !$debuggersMenuExpanded;
  }

  function closeAllMenus(){
    $liveCodeEditorMenuExpanded = $modelEditorMenuExpanded = $debuggersMenuExpanded = false;
  }

  function launchLiveCodeEditor (liveCodeOption) {
    $selectedLiveCodeOption = liveCodeOption;
    dispatchAdd('live', $selectedLiveCodeOption)
    $isSelectLiveCodeEditorDisabled = true;
    $liveCodeEditorMenuExpanded = false; //close menu
  }

  function launchModelEditor(modelOption) {
    $selectedModelOption = modelOption;
    dispatchAdd('model', $selectedModelOption);
    $isSelectModelEditorDisabled = true;
    $modelEditorMenuExpanded = false; // close menu
  }

  function launchDebugger(debuggerOption) {
    $selectedDebuggerOption = debuggerOption;
    dispatchAdd('debugger', $selectedDebuggerOption);
    $selectedDebuggerOption.disabled = true;
    $debuggersMenuExpanded = false;
  }
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
    /* padding-top: 15px; */
    margin-left: 0.5em;
    margin-right:2px;
    background-color: #262a2e;
    border-radius: 5px;
    width: 50px;
    text-align:center;
  }

  .button-dark{
    padding: 20;
    background-color: #262a2e;
    /* background-color: #22262b; */
    color: #999;
    border: none;
    /* width: 42px; */
    /* height: 42px; */
    margin: 8px 8px 8px 8px;
    border-radius: 5px;
    /* display: block; */
    height: 35px; /* we set the heigth explicitly in this case since we need it to be constant for the menu connector*/
  }

  .button-dark:hover {
    /* background-color: blue; */
    color: white;
  }

  .button-dark:active{
    color: white;
    background-color: grey;
  }

  .button-dark:disabled {
    color:grey;
    /* background-color:grey; */
    cursor:not-allowed;
  }

  .button-dark[aria-expanded="true"] {
    background-color: #212529;
    color:white;
    border-radius: 5px 0px 0px 5px;
  }

  .menu-contents{
    position:absolute;
    z-index:1;
    display: inline;
    background-color: #212529;
    border-radius: 0px 5px 5px 5px;
    margin-top: 8px;
    margin-left: 8px;
  }

  .menu-contents-button {
    display: block;
    background-color: #212529;
  }

  .menu-connector {
    background-color:#212529;
    width:18px;
    height:35px;
    position:absolute;
    z-index:1;
    display: inline;
    margin-top: 8px;
    /* right:150px; */
  }

  .menu-connector-relative {
    background-color: #212529;
    width: 25px;
    height: 35px;
    position: absolute;
    z-index: 1;
    display: inline;
    /* margin-top: 8px; */
    /* padding-right: 30px; */
    right: 5px;
  }

</style>


<div class="sidebar">
  <div class="layout-sidebar-group-widgets-container">

    <div class='collapsible'>
    <button class='button-dark'
      aria-expanded={$liveCodeEditorMenuExpanded} 
      on:click={launchLiveCodeEditorMenu}
      disabled={$isSelectLiveCodeEditorDisabled}>
      <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="18" 
      height="18" 
      fill="currentColor" 
      class="bi bi-plus-lg" 
      viewBox="0 0 16 16" >
      <path fill-rule="evenodd" d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2Z"/>
    </svg>
    </button>
    {#if $liveCodeEditorMenuExpanded == true}
    <div class='menu-connector'>
      <div class='menu-connector-relative'></div>
    </div>
      <div class='menu-contents' hidden={!$liveCodeEditorMenuExpanded}>
        <!-- <div class='menu-connector'></div> -->
        {#each $sidebarLiveCodeOptions as liveCodeOption}
          {#if liveCodeOption.text != 'livecode'}
          <button disabled={$isSelectLiveCodeEditorDisabled} on:click={ () => launchLiveCodeEditor(liveCodeOption)} class='button-dark menu-contents-button'>{liveCodeOption.text}</button>
          <!-- <p on:click={ () => dispatchAdd('live', liveCodeOption)}>{liveCodeOption.text}</p> -->
          {/if}
        {/each}
      </div>
    {/if}
    </div>


    <!-- <SidebarDropdown disabled={$isSelectLiveCodeEditorDisabled}>
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width="18" 
        height="18" 
        fill="currentColor" 
        class="bi bi-plus-lg" 
        viewBox="0 0 16 16" 
        slot='icon'>
        <path fill-rule="evenodd" d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2Z"/>
      </svg>

      <div slot='content'>
        {#each $sidebarLiveCodeOptions as liveCodeOption}
          {#if liveCodeOption.text != 'livecode'}
          <button disabled={$isSelectLiveCodeEditorDisabled} on:click={ () => launchLiveCodeEditor(liveCodeOption)} class='button-dark'>{liveCodeOption.text}</button>
          {/if}
        {/each}
      </div>

    </SidebarDropdown> -->
<!-- 
    <SidebarDropdown>
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-braces" viewBox="0 0 16 16" slot="icon">
        <path d="M2.114 8.063V7.9c1.005-.102 1.497-.615 1.497-1.6V4.503c0-1.094.39-1.538 1.354-1.538h.273V2h-.376C3.25 2 2.49 2.759 2.49 4.352v1.524c0 1.094-.376 1.456-1.49 1.456v1.299c1.114 0 1.49.362 1.49 1.456v1.524c0 1.593.759 2.352 2.372 2.352h.376v-.964h-.273c-.964 0-1.354-.444-1.354-1.538V9.663c0-.984-.492-1.497-1.497-1.6zM13.886 7.9v.163c-1.005.103-1.497.616-1.497 1.6v1.798c0 1.094-.39 1.538-1.354 1.538h-.273v.964h.376c1.613 0 2.372-.759 2.372-2.352v-1.524c0-1.094.376-1.456 1.49-1.456V7.332c-1.114 0-1.49-.362-1.49-1.456V4.352C13.51 2.759 12.75 2 11.138 2h-.376v.964h.273c.964 0 1.354.444 1.354 1.538V6.3c0 .984.492 1.497 1.497 1.6z"/>
      </svg>

      <div slot='content'>
        {#each $sidebarModelOptions as modelOption}
          {#if modelOption.text != 'javascript'}
          <button disabled={$isSelectModelEditorDisabled} on:click={ () => launchModelEditor(modelOption)} class='button-dark'>{modelOption.text}</button>
          {/if}
        {/each}
      </div>

    </SidebarDropdown> -->

    <!-- MODEL EDITOR LAUNCHER -->
    <div class='collapsible'>
      <button class='button-dark'
        aria-expanded={$modelEditorMenuExpanded} 
        on:click={launchModelEditorMenu}
        disabled={$isSelectModelEditorDisabled}>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-braces" viewBox="0 0 16 16">
          <path d="M2.114 8.063V7.9c1.005-.102 1.497-.615 1.497-1.6V4.503c0-1.094.39-1.538 1.354-1.538h.273V2h-.376C3.25 2 2.49 2.759 2.49 4.352v1.524c0 1.094-.376 1.456-1.49 1.456v1.299c1.114 0 1.49.362 1.49 1.456v1.524c0 1.593.759 2.352 2.372 2.352h.376v-.964h-.273c-.964 0-1.354-.444-1.354-1.538V9.663c0-.984-.492-1.497-1.497-1.6zM13.886 7.9v.163c-1.005.103-1.497.616-1.497 1.6v1.798c0 1.094-.39 1.538-1.354 1.538h-.273v.964h.376c1.613 0 2.372-.759 2.372-2.352v-1.524c0-1.094.376-1.456 1.49-1.456V7.332c-1.114 0-1.49-.362-1.49-1.456V4.352C13.51 2.759 12.75 2 11.138 2h-.376v.964h.273c.964 0 1.354.444 1.354 1.538V6.3c0 .984.492 1.497 1.497 1.6z"/>
        </svg>
      </button>


      {#if $modelEditorMenuExpanded == true}
      <div class='menu-connector'>
        <div class='menu-connector-relative'></div>
      </div>
        <div class='menu-contents' hidden={!$modelEditorMenuExpanded}>
          <!-- <div class='menu-connector' style='right:99%'></div> -->
          {#each $sidebarModelOptions as modelOption}
            {#if modelOption.text != 'javascript'}
            <button disabled={$isSelectModelEditorDisabled} on:click={ () => launchModelEditor(modelOption)} class='button-dark menu-contents-button'>{modelOption.text}</button>
            <!-- <p on:click={ () => dispatchAdd('model', modelOption)}>{modelOption.text}</p> -->
            {/if}
          {/each}
        </div>
      {/if}
    </div>

    <!-- DEBUGGER LAUNCHER -->
    <div class='collapsible'>
      <button class='button-dark'
        aria-expanded={$debuggersMenuExpanded} 
        on:click={launchDebuggersMenu}
        disabled={$isSelectDebuggerDisabled}>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-nut" viewBox="0 0 16 16">
          <path d="m11.42 2 3.428 6-3.428 6H4.58L1.152 8 4.58 2h6.84zM4.58 1a1 1 0 0 0-.868.504l-3.428 6a1 1 0 0 0 0 .992l3.428 6A1 1 0 0 0 4.58 15h6.84a1 1 0 0 0 .868-.504l3.429-6a1 1 0 0 0 0-.992l-3.429-6A1 1 0 0 0 11.42 1H4.58z"/>
          <path d="M6.848 5.933a2.5 2.5 0 1 0 2.5 4.33 2.5 2.5 0 0 0-2.5-4.33zm-1.78 3.915a3.5 3.5 0 1 1 6.061-3.5 3.5 3.5 0 0 1-6.062 3.5z"/>
        </svg>
      </button>
      {#if $debuggersMenuExpanded == true}
      <div class='menu-connector'>
        <div class='menu-connector-relative'></div>
      </div>
        <div class='menu-contents' hidden={!$debuggersMenuExpanded}>
          {#each $sidebarDebuggerOptions as debuggerOption}
            {#if debuggerOption.text != 'debug'}
            <button disabled={debuggerOption.disabled} on:click={ () => launchDebugger(debuggerOption)} class='button-dark menu-contents-button'>{debuggerOption.text}</button>
            <!-- <p on:click={ () => dispatchAdd('model', modelOption)}>{modelOption.text}</p> -->
            {/if}
          {/each}
        </div>
      {/if}
    </div>

    <div>
      <button class="button-dark"
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


</div>
