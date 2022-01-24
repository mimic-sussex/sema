<script>

  import { Engine } from 'sema-engine';

  let engine;

  import {
    isDeleteOverlayVisible,
    isClearOverlayVisible,
    items,
    isSaveOverlayVisible,
    isUploadOverlayVisible,
    isSelectLiveCodeEditorDisabled,
    isSelectModelEditorDisabled,
    isAddGrammarEditorDisabled,
    isAddAnalyserDisabled,
    sidebarDebuggerOptions,
    saveRequired
  } from '../../stores/playground.js';
  

  import { resetStores, engineStatus } from '../../stores/common.js'

  import { onMount, onDestroy } from 'svelte';
  import { fly, fade } from 'svelte/transition';

  const closeOverlay = () => {
    $isClearOverlayVisible = false;
  }

  const clearEnvironment = () => {

    if(!engine)
      engine = new Engine();
    engine.hush();
    $engineStatus = 'paused';

    $items = $items.slice($items.length);

    $isUploadOverlayVisible = false;
    $isSaveOverlayVisible = false;
    $isClearOverlayVisible = false;

    $isSelectLiveCodeEditorDisabled = false;
    $isSelectModelEditorDisabled = false;
    $isAddGrammarEditorDisabled = false;
    $isAddAnalyserDisabled = false;
    $sidebarDebuggerOptions.map( option => option.disabled = false );

    //make sure save is required after content is cleared.
    $saveRequired = true;

    resetStores();
    // engine.play()
    // $engineStatus = 'running';
  }

  onMount( async () => {
    // engine = new Engine();
		// console.log("clear")
  });

  onDestroy( () => {
    // engine = null;
	});

</script>

<div  in:fly="{{ y: 200, duration: 300 }}" out:fade
      class="clear-overlay-component"
      style='visibility:{ $isClearOverlayVisible ? "visible": "hidden"}'
      >

  <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" fill="currentColor" class="bi bi-x-lg" viewBox="0 0 16 16">
    <path fill-rule="evenodd" d="M13.854 2.146a.5.5 0 0 1 0 .708l-11 11a.5.5 0 0 1-.708-.708l11-11a.5.5 0 0 1 .708 0Z"/>
    <path fill-rule="evenodd" d="M2.146 2.146a.5.5 0 0 0 0 .708l11 11a.5.5 0 0 0 .708-.708l-11-11a.5.5 0 0 0-.708 0Z"/>
  </svg>

  <p class="clear-overlay-text">
    <span style="font-weight: 1500;">Are you sure you want to clear your content?</span>
  </p>
  <div class="clear-overlay-button-container">
    <button class="button-dark"
            on:click={ clearEnvironment }
            >Clear</button>
    <button class="button-dark"
            on:click={ closeOverlay }
            >Cancel</button>
  </div>
</div>

<style>
  .button-dark {
		padding: 20;
		background-color: #262a2e;
		color: white;
		border: none;
  	margin: 8px 8px 8px 8px;
  	border-radius: 5px;
  	background-color: #201f1f;
    padding-top: 0.5rem;
    padding-bottom: 0.5rem;
    padding-left: 1rem;
    padding-right: 1rem;
	}

  .button-dark:hover {
    /* background-color: blue; */
    color: white;
  }

  .button-dark:active{
    color: white;
    background-color: #212529;
    border-radius:5px;
    box-shadow: inset 0.25px 0.25px 0.1px 0 #201f1f, inset -0.25px -0.25px 0.1px 0 rgba(255, 255, 255, 0.05);
  }

  .clear-overlay-button-container {
    display: inline-flex;
  }

  .clear-overlay-component {
    width: 100%;
		height:100%;
    display:flex;
    justify-content:center;
    align-items:center;
		flex-direction:column;
    font-size:16px;
  }


  .clear-overlay-text {
    /* top:50%; */

    /* width: 100%; */
    /* position: absolute; */
    color: #FFF;
  }
</style>
