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
  } from '../../../stores/playground.js';

  import { siteMode } from "../../../stores/common.js";

  import { PubSub } from "../../../utils/pubSub.js";
  const messaging = new PubSub();

  import { createEventDispatcher } from 'svelte';

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

</script>

<style>
  .item-props-container{
    
    width: 100%;
    display: flex;
    /* flex-direction: row-reverse; */
    flex-direction: row;
    align-self: flex-end;
    /* justify-content:space-between; */
    /* border-bottom: 1px solid #080808; */
    /* margin-left: 0.5em; */
    background-color:#3a4147;

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
  }
</style>


<!-- 
<div>
  <button>Language</button>
  <button>Grammar</button>

</div> -->

<div class="item-props-container">

  <div>
    {#each $focusedItemProperties as itemProp }
      {#if itemProp.lineNumbers }

        <div class="controls">
          <label class="input-dark">numbers
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
          <label class="input-dark">channel
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
                  restart
          </button>
        </div>

      {:else if itemProp.visor }

        <div class="controls">
          <button class="{ $siteMode === 'dark'? 'button-dark' :'button-light' }"
                  on:click={ () => messaging.publish("playground-add", { type: 'visor' } )}
                  >
                  visor
          </button>
        </div>


      {:else if itemProp.grammar }

        <div class="controls">
          <button class="{ $siteMode === 'dark'? 'button-dark' :'button-light' }"
                  on:click={ () => dispatchAdd('grammar') }
                  disabled={ $isAddGrammarEditorDisabled }
                  >
                  grammar
          </button>
        </div>

      {/if}

    {/each}
  </div>

</div>