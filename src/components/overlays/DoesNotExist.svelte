<script>
  import { Engine } from 'sema-engine';

  let engine;

  import {
    isDoesNotExistOverlayVisible,
    isShareOverlayVisible,
    isDeleteOverlayVisible,
    isNewOverlayVisible,
    items,
    isSaveOverlayVisible,
    isUploadOverlayVisible,
    isSelectLiveCodeEditorDisabled,
    isSelectModelEditorDisabled,
    isAddGrammarEditorDisabled,
    isAddAnalyserDisabled,
    sidebarDebuggerOptions,
		uuid,
    name,
    allowEdits,
    author
  } from '../../stores/playground.js';

  import { engineStatus } from '../../stores/common.js'

	import {
    createPlayground,
    checkUser
	} from '../../db/client';


  import { onMount, onDestroy } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  
  import { goto } from "@roxi/routify";

  import { PubSub } from "../../utils/pubSub.js";
  const messaging = new PubSub();

  const closeOverlay = () => {
    $isDoesNotExistOverlayVisible = false;
  }

  //whether to display need to login button
  let needToLogin = false;

  const resetEnvironment = async () => {

    if(!engine)
      engine = new Engine();

    engine.hush();
    $engineStatus = 'paused';

    let user = await checkUser()

    if ( user != null) {
      let data = await createPlayground()

      console.log('data')
      console.log(data)
      $uuid = data.id;
      $name = data.name;
      $items = $items.slice($items.length);
      $allowEdits = data.allowEdits;
      $author = data.author;

      $isUploadOverlayVisible = false;
      $isSaveOverlayVisible = false;
      $isDeleteOverlayVisible = false;
      $isNewOverlayVisible = false;

      $isSelectLiveCodeEditorDisabled = false;
      $isSelectModelEditorDisabled = false;
      $isAddGrammarEditorDisabled = false;
      $isAddAnalyserDisabled = false;
      $isDoesNotExistOverlayVisible = false;

      $sidebarDebuggerOptions.map( option => option.disabled = false );
      window.history.pushState("", "", `/playground/${$uuid}`);
    }
    else{
      console.log("you need to login")
      needToLogin = true; //so login information displays
    }
  }

  onMount( async () => {
    // engine = new Engine();
    messaging.publish("disable-sidebar"); //so people cant spawn stuff while the overlay is up
		console.log("Project does not exist.")
  });

  onDestroy( () => {
    // engine = null;
	});

</script>

<div  in:fly="{{ y: 200, duration: 300 }}" out:fade
      class="doesnotexist-overlay-component"
      style='visibility:{ $isDoesNotExistOverlayVisible ? "visible": "hidden"}'
      >

  <!-- <svg class="box-icon" xmlns="http://www.w3.org/2000/svg" width="50" height="43" viewBox="0 0 50 43"> -->
    <!-- <path d="M48.4 26.5c-.9 0-1.7.7-1.7 1.7v11.6h-43.3v-11.6c0-.9-.7-1.7-1.7-1.7s-1.7.7-1.7 1.7v13.2c0 .9.7 1.7 1.7 1.7h46.7c.9 0 1.7-.7 1.7-1.7v-13.2c0-1-.7-1.7-1.7-1.7zm-24.5 6.1c.3.3.8.5 1.2.5.4 0 .9-.2 1.2-.5l10-11.6c.7-.7.7-1.7 0-2.4s-1.7-.7-2.4 0l-7.1 8.3v-25.3c0-.9-.7-1.7-1.7-1.7s-1.7.7-1.7 1.7v25.3l-7.1-8.3c-.7-.7-1.7-.7-2.4 0s-.7 1.7 0 2.4l10 11.6z"></path> -->
  <!-- </svg> -->

  {#if !needToLogin}
    <svg xmlns="http://www.w3.org/2000/svg" width="320" height="100" fill="currentColor" class="bi bi-exclamation-diamond" viewBox="0 0 16 16">
      <path d="M6.95.435c.58-.58 1.52-.58 2.1 0l6.515 6.516c.58.58.58 1.519 0 2.098L9.05 15.565c-.58.58-1.519.58-2.098 0L.435 9.05a1.482 1.482 0 0 1 0-2.098L6.95.435zm1.4.7a.495.495 0 0 0-.7 0L1.134 7.65a.495.495 0 0 0 0 .7l6.516 6.516a.495.495 0 0 0 .7 0l6.516-6.516a.495.495 0 0 0 0-.7L8.35 1.134z"/>
      <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z"/>
    </svg>

    <p class="doesnotexist-overlay-text">
      <span style="font-weight: 1500;">Project could not be found. Are you sure the URL is correct?</span>
    </p>
    <div class="doesnotexist-overlay-button-container">
      <button class="button-dark"
              on:click={ resetEnvironment }
              >New</button>
      <!-- <button class="button-dark"
              on:click={ closeOverlay }
              >Cancel</button> -->
    </div>
  {:else}
    <svg xmlns="http://www.w3.org/2000/svg" width="320" height="100" fill="currentColor" class="bi bi-door-open" viewBox="0 0 16 16">
      <path d="M8.5 10c-.276 0-.5-.448-.5-1s.224-1 .5-1 .5.448.5 1-.224 1-.5 1z"/>
      <path d="M10.828.122A.5.5 0 0 1 11 .5V1h.5A1.5 1.5 0 0 1 13 2.5V15h1.5a.5.5 0 0 1 0 1h-13a.5.5 0 0 1 0-1H3V1.5a.5.5 0 0 1 .43-.495l7-1a.5.5 0 0 1 .398.117zM11.5 2H11v13h1V2.5a.5.5 0 0 0-.5-.5zM4 1.934V15h6V1.077l-6 .857z"/>
    </svg>

    <p class="doesnotexist-overlay-text">
      <span style="font-weight: 1500;">You need to login to make a new playground. </span>
    </p>
    <div class="doesnotexist-overlay-button-container">
      <button class="button-dark"
              on:click={ $goto('/login') }
              >Login</button>
      <button class="button-dark"
      on:click={ closeOverlay }
      >Cancel</button>
    </div>
  {/if}
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

  .doesnotexist-overlay-button-container {
    display: inline-flex;
  }

  .doesnotexist-overlay-component {
    width: 100%;
		height:100%;
    display:flex;
    justify-content:center;
    align-items:center;
		flex-direction:column;
    font-size:16px;
  }


  .doesnotexist-overlay-text {
    /* top:50%; */

    /* width: 100%; */
    /* position: absolute; */
    color: #FFF;
  }
</style>
