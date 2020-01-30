<script>
  import { 
    tutorialsActive,
    playgroundActive,
    sidebarLiveCodeOptions,
    sidebarGrammarOptions,
    editorThemes,
    modelOptions,
    selectedModel,
    selectedLayout, 
    layoutOptions, 
    selectedTutorial, 
    tutorialOptions
  }  from '../store.js';

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
  let selectedValue;

	function sendLanguageSelect() {
    console.log("selectedLanguage: ", selectedLanguage);
    dispatch('message', {
			language: selectedLanguage.id
		});
	}

  function onChangeAddLiveCode(e){    
    console.log("addLiveCode: ", selectedValue.id );
    dispatch("addLiveCode", selectedValue.id);
    selectedValue = sidebarLiveCodeOptions[0];
  }


</script>

<style>
  
  .sidebar {
    background-color: rgb(3, 3, 3);
    /* width: 160px; */
    height: 100%;
  }

  .controls {
    margin-bottom: 20px;
    margin-left: 10px;
    margin-right: 20px;
  }


  .subcontrols {
    margin-top: 20px;
    margin-left: 20px;
  }

  .combobox{
    margin-top: 4px;
  }

  .whiteText {
    color: whitesmoke;
  }

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
  }

</style>


<div class="sidebar">

  {#if $tutorialsActive }
    <div>
      <!-- <span>Sidebar</span> -->
      <span></span>
    </div>
    <br/>
    <div class="layout-combobox-container controls">
      <div>
        <span class="whiteText">Tutorials</span>
      </div>
      <select class="combobox" bind:value={$selectedTutorial} >
        {#each tutorialOptions as tutorialOption}
          <option value={tutorialOption}>
            {tutorialOption.text}
          </option>
        {/each}
      </select>    
    </div>
    <br/>
    <div class="language-combobox-container controls">
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
    </div>

  {:else if $playgroundActive }

    <div class="layout-combobox-container controls">
      <!-- <div>
        <span class="whiteText">Add Live Code </span>
      </div> -->
      <select class="combobox" bind:this={$selectedModel} bind:value={selectedValue} on:change={ onChangeAddLiveCode } >
        {#each sidebarLiveCodeOptions as modelOption}
          <option value={modelOption}>
            {modelOption.text}
          </option>
        {/each}
      </select>    
    </div>

    <div class="layout-combobox-container controls">
      <!-- <div>
        <span class="whiteText">Add Grammar Editor</span>
      </div> -->
      <select class="combobox" bind:this={$selectedModel} on:change={ () => dispatch('addGrammar') } >
        {#each sidebarGrammarOptions as modelOption}
          <option value={modelOption}>
            {modelOption.text}
          </option>
        {/each}
      </select>    
    </div>


    <div class="layout-combobox-container controls">
      <!-- <div>
        <span class="whiteText">Add Model Editor</span>
      </div> -->
      <!-- <select class="combobox" bind:value={$selectedTutorial} > -->
      <select class="combobox" bind:value={selectedValue} on:change={ () => dispatch('addModel') } >
        {#each modelOptions as modelOption}
          <option value={modelOption}>
            {modelOption.text}
          </option>
        {/each}
      </select>    
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
        <select class="combobox" >
          {#each editorThemes as modelOption}
            <option value={modelOption}>
              {modelOption.text}
            </option>
          {/each}
        </select>    
      </div>

    </div>

  {/if}
</div>