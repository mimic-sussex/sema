<script>
  import {
    onMount,
    onDestroy,
  } from 'svelte';


  import {
    sidebarLiveCodeOptions,
    selectedLiveCodeOption,
    isSelectLiveCodeEditorDisabled,

    sidebarModelOptions,
    selectedModelOption,
    isSelectModelEditorDisabled,

    // sidebarGrammarOptions,
    isAddGrammarEditorDisabled,

    isAddAnalyserDisabled,

    sidebarDebuggerOptions,
    selectedDebuggerOption,
    isSelectDebuggerDisabled,
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
  
    console.log('onMount context bar', $focusedItemProperties);
  });

  function logFocused(){
    console.log($focusedItem.data.type);
  }

</script>

<style>
  .context-bar-container{
    
    width: 100%;
    display: flex;
    /* flex-direction: row-reverse; */
    flex-direction: row;
    align-self: flex-end;
    /* justify-content:space-between; */
    /* border-bottom: 1px solid #080808; */
    /* margin-left: 0.5em; */
    background-color:#262a2e;

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

  /* .button-dark{
    
    margin: 0;
    background-color: #262a2e;
    color:white;
    border: 0;
  } */

  .button-dark{
    /* padding: 20; */
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
    background-color: black;
    cursor:not-allowed;
  }

  .item-props-container{
    width:100%
  }
</style>


<!-- 
<div>
  <button>Language</button>
  <button>Grammar</button>

</div> -->

<div class="context-bar-container">

  <div class='item-props-container'>

    <!-- {#if $focusedItem}
      {$focusedItem.data.type}
    {/if} -->
    
    <!-- {#if $focusedItem}
      {#if focusedItem.data}
        <button>{$focusedItem.data.type}<>
      {/if}
    {/if}
     -->
    <!-- <button on:click={ logFocused }>test</button> -->
    {#each $focusedItemProperties as itemProp }
       <!-- {#if itemProp.type}
        <div class="controls">
        </div>
        
      {/if} -->
      {#if itemProp.type}
        {itemProp.type}
        
      {:else if itemProp.lineNumbers }

        <div class="controls">
          <label class="input-dark">Line Numbers
            <input  type="checkbox"
                    class="checkbox-input"
                    checked="checked"
                    value={$focusedItem.lineNumbers}
                    >
            <span  class="checkbox-span"></span>
          </label>
        </div>

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
                  >
                  Grammar Editor
          </button>
        </div>

      {/if}

    {/each}
  </div>

  <SaveStatus />

</div>