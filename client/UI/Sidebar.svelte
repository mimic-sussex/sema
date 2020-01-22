<script>
	import { createEventDispatcher } from 'svelte';
  import { selectedLayout, layoutOptions, selectedTutorial, tutorialOptions } from '../store.js';

	const dispatch = createEventDispatcher();

  let selectedLanguage = 1;

  let languageOptions = [
		{ id: 1, text: `Default` },
		{ id: 2, text: `Bits` },
		{ id: 3, text: `IXI` },
		{ id: 4, text: `Maya` },
	];

	function sendLanguageSelect() {
    console.log("selectedLanguage: ", selectedLanguage);
    dispatch('message', {
			language: selectedLanguage.id
		});
	}

</script>

<style>
  
  .sidebar {
    background-color: rgb(3, 3, 3);
    width: 140px;
    height: 100%;
  }

  .controls {
    margin-left: 10px;
  }

  .combobox{
    margin-top: 4px;
  }

  .whiteText {
    color: whitesmoke;
  }
</style>


<div class="sidebar">
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

</div>