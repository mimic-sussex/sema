<script>
  import {
    onMount,
    onDestroy,
  } from 'svelte';

  import {
    // sidebarGrammarOptions,
    isAddGrammarEditorDisabled,
    isAddAnalyserDisabled,
    // sidebarVisualisationOptions,
    focusedItem,
    focusedItemProperties,
    // editorThemes,
    // selectedModel,
  } from '../../stores/playground.js';

  import { siteMode } from "../../stores/common.js";

  import { PubSub } from "../../utils/pubSub.js";
  const messaging = new PubSub();

  import { createEventDispatcher } from 'svelte';

  import SaveStatus from './SaveStatus.svelte';

	const dispatch = createEventDispatcher();


  // let selectModel;
  let selectedGrammarOption;
  // let selectedModelOption;
  let selectedVisualisationOption;


  const changeVisualyzerChannelID = e => {
    console.log(e.target.value)
  }


  function dispatchAdd(type, selected){
    // console.log(`DEBUG:Sidebar:dispatchAdd: /add/${type}/${selected.id}`);
    // console.log(selected.content);

    switch (type) {
      // case 'live':
      //   messaging.publish("playground-add", { type: 'liveCodeEditor', data: selected.content });
      //   $selectedLiveCodeOption = $sidebarLiveCodeOptions[0];
      //   $isSelectLiveCodeEditorDisabled = true;
      //   break;
      // case 'model':
      //   messaging.publish("playground-add", { type: 'modelEditor', data: selected.content });
      //   $selectedModelOption = $sidebarModelOptions[0];
      //   $isSelectModelEditorDisabled = true;
      //   break;
      case 'grammar':
        messaging.publish("playground-add", {
                            type: 'grammarEditor',
                            data: {
                              grammar: $focusedItemProperties[2].grammar,
                              grammarSource: $focusedItem.data.grammarSource
                            }
        });

        // selectedGrammarOption = sidebarGrammarOptions[0];
        $isAddGrammarEditorDisabled = true;
        break;
      case 'analyser':
        messaging.publish("playground-add", { type: 'analyser' });
        $isAddAnalyserDisabled = true;
        break;
      // case 'debugger':
      //   messaging.publish("playground-add", { type: selected.type });
      //   disableSelectDebuggerOption(selected.type);
      //   $selectedDebuggerOption = $sidebarDebuggerOptions[0];
      //   break;
      default:
        break;
    }
  }

  // Not currently working, need to reload component for it to work.
  function toggleLineNumbers(){
    console.log("DEBUG: Toggle line numbers", $focusedItem.data.lineNumbers, typeof $focusedItem.data.lineNumbers)
    if ($focusedItem.data.lineNumbers == true){
      $focusedItem.data.lineNumbers = false;
    }
    else if ($focusedItem.data.lineNumbers == false){
      $focusedItem.data.lineNumbers = true;
    }
    console.log("DEBUG: Toggle line numbers", $focusedItem.data.lineNumbers, typeof $focusedItem.data.lineNumbers)
    // $items = $items;
  }

  // Props
  // export let lineNumbers;
	// export let hasFocus;
	// export let content;      // liveCode Value that is injected and to which CodeMirror is bound
  // export let grammarSource;
  // export let grammar;

  // export let liveCodeSource;
  // export let component;
  // export let className;

  onMount( async () => {
    // console.log('DEBUG: onMount context bar', $focusedItemProperties);
  });

  onDestroy(() => {
    // console.log('DEBUG: onDestroy context bar', $focusedItemProperties);
  });

</script>

<style>

  .context-bar-container{
    width: 100%;
    height: 1.2em;
    display: flex;
    /* flex-direction: row-reverse; */
    flex-direction: row;
    align-self: flex-end;
    /* justify-content:space-between; */
    /* border-bottom: 1px solid #080808; */
    /* margin-left: 0.5em; */
    background-color:#262a2e;
    border-top: 1px solid #212529;
    /* border-left: 1px solid #212529;
    border-right: 1px solid #212529;
    border-bottom: 1px solid #181a1d; */
    border-top-left-radius: 2px;
    border-top-right-radius: 2px;
  }

  .controls{
    background-color: #262a2e;
		/* border-top-right-radius: 5px;
		border-bottom-right-radius: 5px; */
		/* display:inline-block; */
		/* margin-right: -4px; hacky method of getting them side by side no gap */
		display:inline-flex;
		align-items:center;
		border-radius: 5px;
    font-size:medium;
  }

  .input-dark{
    padding: 0px 20px 0px 20px;
    margin: 0;
    background-color: #262a2e;
    color: #999;
    border: none;
    /* width: 42px; */
    /* height: 42px; */
    /* margin: 8px 8px 8px 8px; */
    border-radius: 5px;
    background-color: #262a2e;
  }

  .button-dark{
    padding: 0px 20px 0px 20px;
    margin: 0;
    color: #999;
    border: none;
    border-radius: 5px;
    background-color: #262a2e;
  }

  .button-dark:hover {
    color: white;
  }

  .button-dark:active{
    color: white;
    background-color: grey;
  }

  .button-dark:disabled {
    color:grey;
    background-color: #181a1d;
    cursor:not-allowed;
  }

  .item-props-container{
    width:100%
  }

  span {
    font-size:medium;
    padding: 0px 20px 0px 20px;
    margin: 0;
    background-color: #262a2e;
    color: #999;
    border: none;
  }

  svg {
    width: 1.5em;
    vertical-align: middle;
    fill:#999;
  }

</style>


<div class="context-bar-container">

    <div class='item-props-container'>
  
    <!-- Widgets icon -->
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-window-stack" viewBox="0 0 16 16">
      <title>Widgets</title>
      <path d="M4.5 6a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1ZM6 6a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1Zm2-.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0Z"/>
      <path d="M12 1a2 2 0 0 1 2 2 2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2 2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h10ZM2 12V5a2 2 0 0 1 2-2h9a1 1 0 0 0-1-1H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1Zm1-4v5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V8H3Zm12-1V5a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v2h12Z"/>
    </svg> 

    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-chevron-right" viewBox="0 0 16 16">
      <path fill-rule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/>
    </svg> 
    
    <!-- Show the name of the focused item -->
    {#if $focusedItem}
      {#if $focusedItem.data}
      
      <span style='font-weight:bold' title='Selected widget: {$focusedItem.data.type}'>{$focusedItem.data.type}</span>
      
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-chevron-right" viewBox="0 0 16 16">
        <path fill-rule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/>
      </svg>
      {:else}
        <span>None</span>
      {/if}
    {:else}
      <span>None</span>
    {/if}
    
    <!-- Loop through and display focused item properties -->
    {#each $focusedItemProperties as itemProp }
      
      {#if itemProp.lineNumbers }

        <div class="controls">
          <label class="input-dark">Line Numbers
            <input  type="checkbox"
                    class="checkbox-input"
                    checked="checked"
                    value={$focusedItem.lineNumbers}
                    title='Toggle line numbers'
                    >
            <span  class="checkbox-span"></span>
          </label>
        </div>
      <!-- {#if itemProp.lineNumbers == true || itemProp.lineNumbers == false }

        <div class="controls">
          <label class="input-dark">Line Numbers
            <input  type="checkbox"
                    class="checkbox-input"
                    checked="checked"
              
                    on:click={toggleLineNumbers}
                    >
            <span  class="checkbox-span"></span>
          </label>
        </div> -->
      {:else if itemProp.channelID }

        <div class="controls">
          <label class="input-dark">Channel
            <input  type="number"
                    class="number-input"
                    name="channel"
                    value={$focusedItem.channelID}
                    on:change={ e => changeVisualyzerChannelID(e) }
                    >
            <!-- <span  class="checkbox-span"></span> -->
          </label>
        </div>

      {:else if itemProp.mode }

        mode
        { itemProp }
        <br>

      {:else if itemProp.restart }

        <div class="controls">
          <button class="{ $siteMode === 'dark'? 'button-dark' :'button-light' }"
                  on:click={ () => messaging.publish('restart-ml') }
                  >
                  Restart JS Worker
          </button>
        </div>

      {:else if itemProp.visor }

        <div class="controls">
          <button class="{ $siteMode === 'dark'? 'button-dark' :'button-light' }"
                  on:click={ () => messaging.publish("playground-add", { type: 'visor' } )}
                  >
                  Visor
          </button>
        </div>


      {:else if itemProp.grammar }

        <div class="controls">
          <button class="{ $siteMode === 'dark'? 'button-dark' :'button-light' }"
                  on:click={ () => dispatchAdd('grammar') }
                  disabled={ $isAddGrammarEditorDisabled }
                  title='{$isAddGrammarEditorDisabled? 'Launch grammar editor (already launched)':'Launch grammar editor'}'
                  >
                  Grammar Editor
          </button>
        </div>
      
      {:else if itemProp.type}
        <span>No properties for {itemProp.type}</span>
        
      {/if}

    {/each}
  </div>

  <SaveStatus />

</div>