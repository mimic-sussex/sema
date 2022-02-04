<script>

  import { Engine } from 'sema-engine';

  let engine;

  import {
    isDeleteOverlayVisible,
    items,
    isSaveOverlayVisible,
    isUploadOverlayVisible,
    isSelectLiveCodeEditorDisabled,
    isSelectModelEditorDisabled,
    isAddGrammarEditorDisabled,
    isAddAnalyserDisabled,
    sidebarDebuggerOptions
  } from '../../stores/playground.js';

  import {
    deletePlayground,
    checkUser
	} from '../../db/client';

  import { onMount, onDestroy } from 'svelte';
  import { fly, fade } from 'svelte/transition';

  const closeOverlay = () => {
    $isDeleteOverlayVisible = false;
  }

  const resetEnvironment = () => {

    if(!engine)
      engine = new Engine();

    engine.hush();

    $items = $items.slice($items.length);

    $isUploadOverlayVisible = false;
    $isSaveOverlayVisible = false;
    $isDeleteOverlayVisible = false;

    $isSelectLiveCodeEditorDisabled = false;
    $isSelectModelEditorDisabled = false;
    $isAddGrammarEditorDisabled = false;
    $isAddAnalyserDisabled = false;
    $sidebarDebuggerOptions.map( option => option.disabled = false );
  }

  onMount( async () => {
    // engine = new Engine();
		console.log("delete")
  });

  onDestroy( () => {
    // engine = null;
	});

</script>

<div  in:fly="{{ y: 200, duration: 300 }}" out:fade
      class="delete-overlay-component"
      style='visibility:{ $isDeleteOverlayVisible ? "visible": "hidden"}'
      >

  <!-- <svg class="box-icon" xmlns="http://www.w3.org/2000/svg" width="50" height="43" viewBox="0 0 50 43"> -->
    <!-- <path d="M48.4 26.5c-.9 0-1.7.7-1.7 1.7v11.6h-43.3v-11.6c0-.9-.7-1.7-1.7-1.7s-1.7.7-1.7 1.7v13.2c0 .9.7 1.7 1.7 1.7h46.7c.9 0 1.7-.7 1.7-1.7v-13.2c0-1-.7-1.7-1.7-1.7zm-24.5 6.1c.3.3.8.5 1.2.5.4 0 .9-.2 1.2-.5l10-11.6c.7-.7.7-1.7 0-2.4s-1.7-.7-2.4 0l-7.1 8.3v-25.3c0-.9-.7-1.7-1.7-1.7s-1.7.7-1.7 1.7v25.3l-7.1-8.3c-.7-.7-1.7-.7-2.4 0s-.7 1.7 0 2.4l10 11.6z"></path> -->
  <!-- </svg> -->

  <svg xmlns="http://www.w3.org/2000/svg" width="320" height="100" fill="currentColor" class="bi bi-trash" viewBox="0 0 16 16" >
    <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
    <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
  </svg>

  <p class="delete-overlay-text">
    <span style="font-weight: 1500;">Are you sure you want to delete your content?</span>
  </p>
  <div class="delete-overlay-button-container">
    <button class="button-dark"
            on:click={ resetEnvironment }
            >Delete</button>
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

  .delete-overlay-button-container {
    display: inline-flex;
  }

  .delete-overlay-component {
    width: 100%;
		height:100%;
    display:flex;
    justify-content:center;
    align-items:center;
		flex-direction:column;
    font-size:16px;
  }


  .delete-overlay-text {
    /* top:50%; */

    /* width: 100%; */
    /* position: absolute; */
    color: #FFF;
  }
</style>
