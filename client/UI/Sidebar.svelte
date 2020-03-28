<script>
  import { 
    tutorialsActive,
    playgroundActive,
    sidebarLiveCodeOptions,
    sidebarGrammarOptions,
    sidebarModelOptions,
    selectedModel,
    selectedLayout, 
    layoutOptions, 
    selectedTutorial, 
    tutorialOptions,
    editorThemes
  }  from '../store.js';

  import { id } from '../utils/utils.js';

  import { PubSub } from "../messaging/pubSub.js";
  const messaging = new PubSub();

	import { createEventDispatcher } from 'svelte';
	const dispatch = createEventDispatcher();

  let selectedLanguage = 1;

  let languageOptions = [
		{ id: 1, text: `Default` },
		{ id: 2, text: `Bits` },
		{ id: 3, text: `IXI` },
		{ id: 4, text: `Maya` },
	];

  // let selectModel;
  let selectedLiveCodeOption;
  let selectedGrammarOption;
  let selectedModelOption;

  

	function sendLanguageSelect() {
    console.log("selectedLanguage: ", selectedLanguage);
    dispatch('message', {
			language: selectedLanguage.id
		});
	}

  function dispatchAdd(type, selected){
    // console.log(`DEBUG:Sidebar:dispatchAdd: /add/${type}/${selected.id}`);
    // console.log(selected.content);

    switch (type) {
      case 'live':
        messaging.publish("add-editor", { id: id(), type: 'liveCodeEditor', data: selected.content });
        selectedLiveCodeOption = sidebarLiveCodeOptions[0];        
        break;
      case 'grammar':
        messaging.publish("add-editor", { id: id(), type: 'grammarEditor', data: selected.content });
        selectedGrammarOption = sidebarGrammarOptions[0];        
        break;
      case 'model':
        messaging.publish("add-editor", { id: id(), type: 'modelEditor', data: selected.content });
        selectedModelOption = sidebarModelOptions[0];        
        break;
      case 'oscilloscope':
        messaging.publish("add-analyser", { id: id(), type: 'oscilloscope' });
        break;
      case 'spectrogram':
        messaging.publish("add-analyser", { id: id(), type: 'spectrogram'}); 
        break;
      default:
        break;
    }
  }


</script>

<style>
  
  .sidebar {
    /* background-color: rgb(17, 16, 18); */
    background: linear-gradient(150deg, rgba(0,18,1,1) 0%, rgba(7,5,17,1) 33%, rgba(16,12,12,1) 67%, rgb(12, 12, 12) 100%);
    /* width: 160px; */
    height: 100%;
  }

  .controls {
    margin-bottom: 20px;
    margin-left: 10px;
    margin-right: 20px;
  }

/* 
  .combobox{
    margin-top: 4px;

  }

  .whiteText {
    color: whitesmoke;
  } */

  .checkbox-span {
    color: whitesmoke;
    margin-left: 20px; 
  }
  .checkbox-input {
    margin-left: 5px; 
  }

  /* The checkbox container */
  .checkbox-container {
    display: block;
    position: relative;
    color: whitesmoke;
    /* padding-left: 25px; */
    margin-bottom: 10px;
    cursor: pointer;
    /* font-size: 22px; */
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
    font-size: 12px;
  }



  .combobox-dark {
    display: block;
    font-size: 12px;
    font-family: sans-serif;
    font-weight: 400;
    cursor: pointer;
    color: #fff;
    line-height: 1.3;
    padding: .5em .5em .5em .6em;
    width: 100%;
    max-width: 100%; 
    box-sizing: border-box;
    margin: 0;
    border: 1px solid #333;
    border-right-color: rgba(34,37,45, 0.4);;
    border-right-style: solid;
    border-right-width: 1px;
    border-bottom-color: rgba(34,37,45, 0.4);
    border-bottom-style: solid;
    border-bottom-width: 1px;
    /* box-shadow: 0 1px 0 0px rgba(4, 4, 4, 0.04); */
    border-radius: .4em;
    -moz-appearance: none;
    -webkit-appearance: none;
    appearance: none;
    background-color: rgba(16, 16, 16, 0.04);
    background-repeat: no-repeat, repeat;
    background-position: right .7em top 50%, 0 0;
    background-size: .65em auto, 100%;
    -webkit-box-shadow: 5px 5px 20px -5px rgba(0,0,0,0.75);
    -moz-box-shadow: 5px 5px 20px -5px rgba(0,0,0,0.75);
    box-shadow: 5px 5px 20px -5px rgba(0,0,0,0.75);
  }

  /* .combobox {
    display: block;
    font-size: 12px;
    font-family: sans-serif;
    font-weight: 400;
    color: #444;
    line-height: 1.3;
    padding: .5em .5em .5em .6em;
    width: 100%;
    max-width: 100%; 
    box-sizing: border-box;
    margin: 0;
    border: 1px solid #aaa;
    box-shadow: 0 1px 0 1px rgba(0,0,0,.04);
    border-radius: .4em;
    -moz-appearance: none;
    -webkit-appearance: none;
    appearance: none;
    background-color: #fff;
    background-position: right .7em top 50%, 0 0;
    background-size: .65em auto, 100%;
  } */
  /* .combobox-dark::-ms-expand {
      display: none;
  } */
  /* .combobox:hover {
      border-color: #888;
  } */
  /* .combobox:focus {
      border-color: #aaa;
      box-shadow: 0 0 1px 3px rgba(59, 153, 252, .7);
      box-shadow: 0 0 0 3px -moz-mac-focusring;
      color: #222; 
      outline: none;
      border-radius: .4em;
  } */
  /* .combobox option {
      font-weight:normal;
  } */

  .button-dark {
    display: block;
    font-size: 12px;
    font-family: sans-serif;
    font-weight: 400;
    cursor: pointer;
    color: #fff;
    line-height: 1.3;
    padding: .5em .5em .5em .6em;
    /* width: 100%; */
    max-width: 100%; 
    box-sizing: border-box;
    margin-left: 10px;
    border: 1px solid #333;
    box-shadow: 0 1px 0 0px rgba(4, 4, 4, 0.04);
    border-radius: .4em;
    border-right-color: rgba(34,37,45, 0.1);
    border-right-style: solid;
    border-right-width: 1px;
    border-bottom-color: rgba(34,37,45, 0.1);
    border-bottom-style: solid;
    border-bottom-width: 1px;
    -moz-appearance: none;
    -webkit-appearance: none;
    appearance: none;
    background-color:  rgba(16, 16, 16, 0.04);
    /* background-image: url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23007CB2%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E'),
      linear-gradient(to bottom, #ffffff 0%,#e5e5e5 100%); */
    background-repeat: no-repeat, repeat;
    background-position: right .7em top 50%, 0 0;
    background-size: .65em auto, 100%;
    -webkit-box-shadow: 5px 5px 10px -5px rgba(0,0,0,0.75);
    -moz-box-shadow: 5px 5px 10px -5px rgba(0,0,0,0.75);
    box-shadow: 5px 5px 10px -5px rgba(0,0,0,0.75);
  }

</style>


<div class="sidebar">
  {#if $tutorialsActive }
    <div class="layout-combobox-container controls">
      <!-- <div>
        <span class="whiteText">Tutorials</span>
      </div> -->
      <select class="combobox-dark" bind:value={$selectedTutorial} >
        {#each tutorialOptions as tutorialOption}
          <option value={tutorialOption}>
            {tutorialOption.text}
          </option>
        {/each}
      </select>    
    </div>
    <br/>
    <!-- <div class="language-combobox-container controls">
      <div>
        <span class="whiteText">Language</span>
      </div>
      <select class="combobox" bind:value={selectedLanguage} on:change="{ () => sendLanguageSelect() }">
        {#each languageOptions as languageOption}
          <option value={languageOption}>
            {languageOption.text}
          </option>
        {/each}
      </select>    
    </div> -->

  {:else if $playgroundActive }

    <!-- Live Code Combobox Selector -->
    <div class="layout-combobox-container controls">
      <!-- <div>
        <span class="whiteText">Add Live Code </span>
      </div> -->
      <select class="combobox-dark" 
              bind:this={$selectedModel} 
              bind:value={selectedLiveCodeOption} 
              on:change={() => dispatchAdd('live', selectedLiveCodeOption)} >
        {#each sidebarLiveCodeOptions as liveCodeOption}
          <option value={liveCodeOption}>
            {liveCodeOption.text}
          </option>
        {/each}
      </select>    
    </div>

    <!-- Grammar Combobox Selector -->
    <div class="layout-combobox-container controls">
      <select class="combobox-dark" 
              bind:value={selectedGrammarOption} 
              on:change={ () => dispatchAdd('grammar', selectedGrammarOption) } >
        {#each sidebarGrammarOptions as grammarOption}
          <option value={grammarOption}>
            { grammarOption.text }
          </option>
        {/each}
      </select>    
    </div>

    <!-- Model Combobox Selector -->
    <div class="layout-combobox-container controls">
      <!-- <select class="combobox" bind:value={$selectedTutorial} > -->
      <select class="combobox-dark"
              bind:value={selectedModelOption} 
              on:change={ () => dispatchAdd('model', selectedModelOption) } >
        {#each sidebarModelOptions as modelOption}
          <option value={modelOption}>
            { modelOption.text }
          </option>
        {/each}
      </select>    
    </div>

    <div>
      <button class="button-dark controls"
              on:click={ () => dispatchAdd('grammarCompileOutput', selectedModelOption) }> 
        + Grammar Compile Out
      </button>
    </div>

    <div>
      <button class="button-dark controls"
              on:click={ () => dispatchAdd('liveCodeParseOutput', selectedModelOption) }> 
        + Live Code Parse Out
      </button>
    </div>

    <div>
      <button class="button-dark controls"
              on:click={ () => dispatchAdd('oscilloscope') }> 
        + Oscilloscope
      </button>
    </div>

    <div>
      <button class="button-dark controls"
              on:click={ () => dispatchAdd('spectrogram') }> 
        + Spectrogram
      </button>
    </div>

    <div class="controls">

      <div>
        <label class="checkbox-container">Line Numbers
          <input type="checkbox" checked="checked" class="checkbox-input">
          <span  class="checkbox-span"></span>
        </label>
      </div>

      <div class="layout-combobox-container">
        <!-- <div>
          <span class="whiteText">Select Theme</span>
        </div> -->
        <!-- <select class="combobox" bind:value={$selectedTutorial} > -->
        <select class="combobox-dark" >
          {#each editorThemes as modelOption}
            <option value={ modelOption }>
              {modelOption.text}
            </option>
          {/each}
        </select>    
      </div>

    </div>

  {/if}
</div>