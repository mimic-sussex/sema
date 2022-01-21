<script>

  import { onMount, onDestroy } from "svelte";

  import Mouse from '../widgets/devices/Mouse.svelte';
  import Mic from '../widgets/devices/Mic.svelte';
 
  import {
    sidebarLiveCodeOptions,
    selectedLiveCodeOption,
    isSelectLiveCodeEditorDisabled,

    sidebarModelOptions,
    selectedModelOption,
    isSelectModelEditorDisabled,

    isAddGrammarEditorDisabled,

    isAddAnalyserDisabled,

    sidebarDebuggerOptions,
    selectedDebuggerOption,
    isSelectDebuggerDisabled,

    items
  } from '../../stores/playground.js'

  import {
    liveCodeEditorMenuExpanded,
    modelEditorMenuExpanded,
    debuggersMenuExpanded,
  } from '../../stores/sidebar.js';

  import {clickOutside} from '../../utils/clickOutside.js';

  import { PubSub } from "../../utils/pubSub.js";
  const messaging = new PubSub();

	import { createEventDispatcher } from 'svelte';
  import { siteMode } from "../../stores/common";
	const dispatch = createEventDispatcher();

  let itemDeletionSubscriptionToken;
  let changingPlaygroundSubscriptionToken;
  let disableSidebarSubscriptionToken;


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

  onMount(() => {
    setButtonsStateOnLoad();
    itemDeletionSubscriptionToken = messaging.subscribe("plaground-item-deletion", activateSelectOnItemDeletion);

    //when a new playground is loaded make sure sidebar is updated
    changingPlaygroundSubscriptionToken = messaging.subscribe("changing-playground", setButtonsStateOnChange);
    
    disableSidebarSubscriptionToken = messaging.subscribe("disable-sidebar", disableAllButtons);
  })

  onDestroy(() => {
    messaging.unsubscribe(itemDeletionSubscriptionToken);
    messaging.unsubscribe(changingPlaygroundSubscriptionToken);
    messaging.unsubscribe(disableSidebarSubscriptionToken);
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
    justify-content: flex-start;
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
    color: #999;
    border: none;
    margin: 8px 8px 8px 8px;
    border-radius: 5px;
    height: 35px; /* we set the heigth explicitly in this case since we need it to be constant for the menu connector*/
  }

  .button-dark:hover {
    color: white;
  }
  
  .button-dark:active{
    color: white;
    background-color: #212529;
    border-radius: 5px;
    box-shadow: inset 0.25px 0.25px 0.1px 0 #201f1f, inset -0.25px -0.25px 0.1px 0 rgba(255, 255, 255, 0.05);
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
    /* float:right; */
  }

  .menu-contents-button {
    display: block;
    background-color: #212529;
    font-size: medium;
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
    /* float:left; */
  }

  .menu-connector-inside {
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

  .collapsible-menu-container {
    display: ruby-base-container;
  }

  .dropdown-menu-corner-icon {
    visibility:hidden;
    /* display:none; */
  }

  .button-dark:hover .dropdown-menu-corner-icon {
    visibility:visible;
    color:grey;
  }

  .button-dark[aria-expanded="true"] .dropdown-menu-corner-icon {
    visibility: visible;
    color:white;
  }
  

</style>


<div class="sidebar">
  <div class="layout-sidebar-group-widgets-container">

    <!-- LIVE CODE EDITOR LAUNCHER -->
    <div class='collapsible-menu-container' use:clickOutside on:click_outside={()=>$liveCodeEditorMenuExpanded = false}>
    <button class='button-dark'
      aria-expanded={$liveCodeEditorMenuExpanded} 
      on:click={launchLiveCodeEditorMenu}
      disabled={$isSelectLiveCodeEditorDisabled}
      title="{$isSelectLiveCodeEditorDisabled ? 'Launch live code editor (already launched)' : 'Launch live code editor'}"
      >
      <!-- <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="18" 
      height="18" 
      fill="currentColor" 
      class="bi bi-plus-lg" 
      viewBox="0 0 16 16" >
      <path fill-rule="evenodd" d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2Z"/>
    </svg> -->
    <svg width="16px" height="15px" viewBox="0 0 17 16" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" fill="currentColor">
      <!-- <title>Plus</title> -->
      <g>
          <g id="1.1.0__code-editors-w/-sub-widgets-copy-2" transform="translate(-33.000000, -114.000000)">
              <g id="Plus" transform="translate(33.000000, 114.000000)">
                  <path d="M8.28915663,0.476190476 C8.71501475,0.476190476 9.06024096,0.821416693 9.06024096,1.24727481 L9.05992771,7.42819048 L15.3344808,7.42857143 C15.7552692,7.42857143 16.0963855,7.76968781 16.0963855,8.19047619 C16.0963855,8.61126457 15.7552692,8.95238095 15.3344808,8.95238095 L9.05992771,8.95219048 L9.06024096,15.1336776 C9.06024096,15.5595357 8.71501475,15.9047619 8.28915663,15.9047619 C7.86329851,15.9047619 7.51807229,15.5595357 7.51807229,15.1336776 L7.51792771,8.95219048 L1.24383247,8.95238095 C0.823044092,8.95238095 0.481927711,8.61126457 0.481927711,8.19047619 C0.481927711,7.76968781 0.823044092,7.42857143 1.24383247,7.42857143 L7.51792771,7.42819048 L7.51807229,1.24727481 C7.51807229,0.821416693 7.86329851,0.476190476 8.28915663,0.476190476 Z" id="Combined-Shape"></path>
              </g>
          </g>
      </g>
      <g class='dropdown-menu-corner-icon'>
        <g id="1.1.0__code-editors-w/-sub-widgets-copy-2" transform="translate(-47.000000, -128.000000)" >
            <g id="Rectangle" transform="translate(47.000000, 128.000000)">
                <polygon transform="translate(14.000000, 15.000000) rotate(90.000000) translate(-2.000000, -2.000000) " points="0 -4.54525306e-13 4 0 4 4"></polygon>
            </g>
        </g>
      </g>
    </svg>
    </button>
    {#if $liveCodeEditorMenuExpanded == true}
      <div class='menu-connector'>
        <div class='menu-connector-inside'></div>
      </div>
      <div class='menu-contents' hidden={!$liveCodeEditorMenuExpanded}>
        <!-- <div class='menu-connector'></div> -->
        {#each $sidebarLiveCodeOptions as liveCodeOption}
          {#if liveCodeOption.text != 'livecode'}
          <button disabled={$isSelectLiveCodeEditorDisabled} 
                  title='{`Launch live code editor with ${liveCodeOption.text} language`}'
                  on:click={ () => launchLiveCodeEditor(liveCodeOption)} 
                  class='button-dark menu-contents-button'>{liveCodeOption.text}
                </button>
          <!-- <p on:click={ () => dispatchAdd('live', liveCodeOption)}>{liveCodeOption.text}</p> -->
          {/if}
        {/each}
      </div>
    {/if}
    </div>

    <!-- MODEL EDITOR LAUNCHER -->
    <div class='collapsible-menu-container'  use:clickOutside on:click_outside={()=>$modelEditorMenuExpanded = false}>
      <button class='button-dark'
        aria-expanded={$modelEditorMenuExpanded} 
        on:click={launchModelEditorMenu}
        disabled={$isSelectModelEditorDisabled}
        title="{$isSelectModelEditorDisabled ? 'Launch JavaScript editor (already launched)' : 'Launch JavaScript editor'}"
        >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-braces" viewBox="0 0 16 16">
          <path d="M2.114 8.063V7.9c1.005-.102 1.497-.615 1.497-1.6V4.503c0-1.094.39-1.538 1.354-1.538h.273V2h-.376C3.25 2 2.49 2.759 2.49 4.352v1.524c0 1.094-.376 1.456-1.49 1.456v1.299c1.114 0 1.49.362 1.49 1.456v1.524c0 1.593.759 2.352 2.372 2.352h.376v-.964h-.273c-.964 0-1.354-.444-1.354-1.538V9.663c0-.984-.492-1.497-1.497-1.6zM13.886 7.9v.163c-1.005.103-1.497.616-1.497 1.6v1.798c0 1.094-.39 1.538-1.354 1.538h-.273v.964h.376c1.613 0 2.372-.759 2.372-2.352v-1.524c0-1.094.376-1.456 1.49-1.456V7.332c-1.114 0-1.49-.362-1.49-1.456V4.352C13.51 2.759 12.75 2 11.138 2h-.376v.964h.273c.964 0 1.354.444 1.354 1.538V6.3c0 .984.492 1.497 1.497 1.6z"/>
          
          <g class='dropdown-menu-corner-icon'>
            <g id="1.1.0__code-editors-w/-sub-widgets-copy-2" transform="translate(-47.000000, -128.000000)" >
                <g id="Rectangle" transform="translate(47.000000, 128.000000)">
                    <polygon transform="translate(14.000000, 15.000000) rotate(90.000000) translate(-2.000000, -2.000000) " points="0 -4.54525306e-13 4 0 4 4"></polygon>
                </g>
            </g>
          </g>
        
        </svg>
      </button>


      {#if $modelEditorMenuExpanded == true}
      <div class='menu-connector'>
        <div class='menu-connector-inside'></div>
      </div>
        <div class='menu-contents' hidden={!$modelEditorMenuExpanded}>
          <!-- <div class='menu-connector' style='right:99%'></div> -->
          {#each $sidebarModelOptions as modelOption}
            {#if modelOption.text != 'javascript'}
            <button disabled={$isSelectModelEditorDisabled} 
                    title='{ modelOption.text == '* new *'? 'Launch empty JavaScript editor': `Launch ${modelOption.text} example`}'
                    on:click={ () => launchModelEditor(modelOption)} 
                    class='button-dark menu-contents-button'>{modelOption.text}
                  </button>
            <!-- <p on:click={ () => dispatchAdd('model', modelOption)}>{modelOption.text}</p> -->
            {/if}
          {/each}
        </div>
      {/if}
    </div>

    <!-- DEBUGGER LAUNCHER -->
    <div class='collapsible-menu-container'  use:clickOutside on:click_outside={()=>$debuggersMenuExpanded = false}>
      <button class='button-dark'
        aria-expanded={$debuggersMenuExpanded} 
        on:click={launchDebuggersMenu}
        disabled={$isSelectDebuggerDisabled}
        title="{$isSelectDebuggerDisabled ? 'Launch a debugger widget (all already launched)' : 'Launch a debugger widget'}"
        >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-nut" viewBox="0 0 16 16">
          <path d="m11.42 2 3.428 6-3.428 6H4.58L1.152 8 4.58 2h6.84zM4.58 1a1 1 0 0 0-.868.504l-3.428 6a1 1 0 0 0 0 .992l3.428 6A1 1 0 0 0 4.58 15h6.84a1 1 0 0 0 .868-.504l3.429-6a1 1 0 0 0 0-.992l-3.429-6A1 1 0 0 0 11.42 1H4.58z"/>
          <path d="M6.848 5.933a2.5 2.5 0 1 0 2.5 4.33 2.5 2.5 0 0 0-2.5-4.33zm-1.78 3.915a3.5 3.5 0 1 1 6.061-3.5 3.5 3.5 0 0 1-6.062 3.5z"/>
          
          <g class='dropdown-menu-corner-icon'>
            <g id="1.1.0__code-editors-w/-sub-widgets-copy-2" transform="translate(-47.000000, -128.000000)" >
                <g id="Rectangle" transform="translate(47.000000, 128.000000)">
                    <polygon transform="translate(14.000000, 15.000000) rotate(90.000000) translate(-2.000000, -2.000000) " points="0 -4.54525306e-13 4 0 4 4"></polygon>
                </g>
            </g>
          </g>
        
        </svg>
      </button>
      {#if $debuggersMenuExpanded == true}
      <div class='menu-connector'>
        <div class='menu-connector-inside'></div>
      </div>
        <div class='menu-contents' hidden={!$debuggersMenuExpanded}>
          {#each $sidebarDebuggerOptions as debuggerOption}
            {#if debuggerOption.text != 'debug'}
            <button disabled={debuggerOption.disabled}
                    title='{debuggerOption.disabled? `Launch ${debuggerOption.text} (already launched)`: `Launch ${debuggerOption.text}`}'
                    on:click={ () => launchDebugger(debuggerOption)} 
                    class='button-dark menu-contents-button'>{debuggerOption.text}
                  </button>
            <!-- <p on:click={ () => dispatchAdd('model', modelOption)}>{modelOption.text}</p> -->
            {/if}
          {/each}
        </div>
      {/if}
    </div>

    <!-- ANALYSER LAUNCHER -->
    <div>
      <button class="button-dark"
              on:click={ () => dispatchAdd('analyser') }
              disabled={ $isAddAnalyserDisabled }
              title='{$isAddAnalyserDisabled? 'Launch audio analyser (already launched)': 'Launch audio analyser' }'
              >
              <div class='icon-container'>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-activity" viewBox="0 0 16 16">
                  <path fill-rule="evenodd" d="M6 2a.5.5 0 0 1 .47.33L10 12.036l1.53-4.208A.5.5 0 0 1 12 7.5h3.5a.5.5 0 0 1 0 1h-3.15l-1.88 5.17a.5.5 0 0 1-.94 0L6 3.964 4.47 8.171A.5.5 0 0 1 4 8.5H.5a.5.5 0 0 1 0-1h3.15l1.88-5.17A.5.5 0 0 1 6 2Z"/>
                </svg>
              </div>
      </button>
    </div>

    <!-- MOUSE LAUNCHER -->
    <div>
      <Mouse />
    </div>


    <!-- MIC LAUNCHER -->
    <div>
      <Mic />
    </div>

    <!-- Currently commented out as not implemented fully -->
    <!-- <div>
      <button class="{ $siteMode === 'dark'? 'button-dark' :'button-light' }"
              on:click={ () => dispatchAdd('visualiser') }
              >
        visualiser
      </button>
    </div>
    -->

    <!-- MIDI -->
    <!-- <button class="{ $siteMode === 'dark'? 'button-dark' :'button-light' }"
            on:click={ () => dispatchAdd('MIDI') }
            >
            <svg width="17px" height="17px" viewBox="0 0 17 17" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
              <title>midi</title>
              <g id="Neu-4" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
                  <g id="1.1.0__code-editors-w/-sub-widgets-copy-2" transform="translate(-32.000000, -264.000000)">
                      <g id="Group" transform="translate(32.000000, 264.000000)">
                          <path d="M10.0003357,2 L10.0003357,3.47919592 L6.99966426,3.47919592 L6.99966426,2 C4.13347742,2.68664114 2,5.29521378 2,8.41067858 C2,12.0499043 4.91010576,15 8.5,15 C12.0898942,15 15,12.0499043 15,8.41067858 C14.9997272,5.29521378 12.8665226,2.68664114 10.0003357,2 Z M3.96189882,9.1927472 L3.89337812,9.23155317 L2.88566012,9.8 L2.61904762,9.14514925 L3.62676561,8.57670243 L3.69528631,8.53789646 L3.69966545,8.44846082 C3.71615164,8.11163713 3.88410464,7.81331623 4.1383525,7.67021922 C4.24319433,7.61110075 4.35473367,7.58108675 4.46987936,7.58108675 C4.63165004,7.58108675 4.7947087,7.64293377 4.92865895,7.75541045 L4.99048214,7.8072528 L5.05900284,7.76844683 L6.06672083,7.2 L6.33333333,7.85454757 L5.32561534,8.4229944 L5.25709464,8.46180037 L5.2527155,8.55123601 C5.23622931,8.8880597 5.06827632,9.1863806 4.81402845,9.32947761 C4.70918662,9.38859608 4.59764728,9.41861007 4.48250159,9.41861007 C4.32073091,9.41861007 4.15767225,9.35676306 4.02372201,9.24428638 L3.96189882,9.1927472 Z M6.18326628,10.7491867 C6.30519226,11.052721 6.26342911,11.399829 6.07423362,11.6550467 C5.91390797,11.871137 5.67117717,11.9950407 5.40798524,11.9950407 C5.36145716,11.9950407 5.31436851,11.9911872 5.26840101,11.9831839 L5.18683674,11.9692521 L5.13582403,12.0380216 L4.38548876,13.05 L3.85714286,12.6121874 L4.60747813,11.600209 L4.65849083,11.5314395 L4.62625753,11.4508133 C4.50433155,11.147279 4.5460947,10.800171 4.73529019,10.5449533 C4.89561584,10.328863 5.13834664,10.2049593 5.40153857,10.2049593 C5.44806665,10.2049593 5.4951553,10.2088128 5.5411228,10.2168161 L5.62268707,10.2307479 L5.67369978,10.1619784 L6.42403505,9.15 L6.95238095,9.58810899 L6.20204568,10.6000874 L6.15103297,10.6688569 L6.18326628,10.7491867 Z M8.94538992,13.0950209 L8.86644069,13.1325967 L8.86644069,13.2101132 L8.86644069,14.35 L8.13355931,14.35 L8.13355931,13.2101132 L8.13355931,13.1325967 L8.05461008,13.0950209 C7.75656145,12.9536518 7.57142857,12.687468 7.57142857,12.4 C7.57142857,12.112532 7.75656145,11.8463482 8.05461008,11.7049791 L8.13355931,11.6674033 L8.13355931,11.5898868 L8.13355931,10.45 L8.86644069,10.45 L8.86644069,11.5898868 L8.86644069,11.6674033 L8.94538992,11.7049791 C9.24343855,11.8463482 9.42857143,12.112532 9.42857143,12.4 C9.42857143,12.687468 9.24343855,12.9536518 8.94538992,13.0950209 Z M12.6145112,13.05 L11.864176,12.0380985 L11.8131633,11.9693342 L11.731599,11.9832649 C11.6856315,11.9912677 11.6385428,11.9951208 11.5920148,11.9951208 C11.3288228,11.9951208 11.086092,11.8712266 10.9257664,11.6551528 C10.7365709,11.3999544 10.6948077,11.0528728 10.8167337,10.7493616 L10.848967,10.6687415 L10.7979543,10.5999772 L10.047619,9.5880757 L10.575965,9.15 L11.3263002,10.1619015 L11.3773129,10.2306658 L11.4588772,10.2167351 C11.5048447,10.2087323 11.5519334,10.2048792 11.5984614,10.2048792 C11.8616534,10.2048792 12.1043842,10.3287734 12.2647098,10.5448472 C12.4539053,10.8000456 12.4956684,11.1471272 12.3737425,11.4506384 L12.3415092,11.5312585 L12.3925219,11.6000228 L13.1428571,12.6119243 L12.6145112,13.05 Z M13.1066219,9.23125 L13.0381012,9.19244403 L12.976278,9.24428638 C12.8423277,9.35676306 12.6795267,9.41861007 12.5174984,9.41861007 C12.4023527,9.41861007 12.2908134,9.38859608 12.1859716,9.32947761 C11.9319813,9.18607743 11.7637707,8.8880597 11.7472845,8.55123601 L11.7429054,8.46180037 L11.6743847,8.4229944 L10.6666667,7.85454757 L10.9332792,7.2 L11.9409972,7.76844683 L12.0095179,7.8072528 L12.0713411,7.75541045 C12.2052913,7.64293377 12.3680924,7.58108675 12.5301206,7.58108675 C12.6452663,7.58108675 12.7568057,7.61110075 12.8616475,7.67021922 C13.1156378,7.8136194 13.2838484,8.11163713 13.3003345,8.44846082 L13.3047137,8.53789646 L13.3732344,8.57670243 L14.3809524,9.14514925 L14.1143399,9.8 L13.1066219,9.23125 Z" id="Shape" fill="#999999" fill-rule="nonzero"></path>
                          <circle id="Oval" stroke="#979797" cx="8.5" cy="8.5" r="8"></circle>
                      </g>
                  </g>
              </g>
          </svg>
    </button> -->

  </div>

</div>
