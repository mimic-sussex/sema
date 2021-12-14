<script>
  import { Engine } from 'sema-engine';

  let engine;

  import ContentLoader from 'svelte-content-loader';

  import {
    isDoesNotExistOverlayVisible,
    isLoadingOverlayVisible,
    isLoadingPlaygroundOverlayVisible,
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

  import Icon from "../icons/Icon.svelte";

  import { onMount, onDestroy } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  
  import { goto } from "@roxi/routify";

  import { PubSub } from "../../utils/pubSub.js";
  const messaging = new PubSub();


  const closeOverlay = () => {
    $isLoadingPlaygroundOverlayVisible = false;
  }

  onMount( async () => {
    // engine = new Engine();
    messaging.publish("disable-sidebar"); //so people cant spawn stuff while the overlay is up
		console.log("Loading")
  });

  onDestroy( () => {
    // engine = null;
	});

</script>

<div  in:fly="{{ y: 200, duration: 300 }}" out:fade
      class="loading-overlay-component"
      style='visibility:{ $isLoadingPlaygroundOverlayVisible ? "visible": "hidden"}'
      >

    <div in:fly="{{ y: -200, duration: 300 }}">
      <svg xmlns="http://www.w3.org/2000/svg" style='fill:#FFF' width="200" height="200" fill="currentColor" class="bi bi-columns-gap" viewBox="0 0 16 16">
        <path d="M6 1v3H1V1h5zM1 0a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1V1a1 1 0 0 0-1-1H1zm14 12v3h-5v-3h5zm-5-1a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1h-5zM6 8v7H1V8h5zM1 7a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1H1zm14-6v7h-5V1h5zm-5-1a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1V1a1 1 0 0 0-1-1h-5z"/>
      </svg>
    </div>

    <div class='loading-bar'>
        <ContentLoader primaryColor='#404040' secondaryColor='#ccc' speed='1' width="200" height="16">
          <rect x="0" y="0" rx="3" ry="3" width="200" height="16" />
        </ContentLoader>
    </div>

    <p class="loading-overlay-text">
      <span style="font-weight: bold; ">Loading Playground..</span>
    </p>
</div>

<style>

  .loading-overlay-button-container {
    display: inline-flex;
  }

  .loading-overlay-component {
    width: 100%;
		height:100%;
    display:flex;
    justify-content:center;
    align-items:center;
		flex-direction:column;
    font-size:16px;
  }


  .loading-overlay-text {
    /* top:50%; */

    /* width: 100%; */
    /* position: absolute; */
    color: #FFF;
  }

  .container-logo {
    width: 100%;
    /* height: 100%; */
    z-index: 1000;
    position: absolute;
    /* top: 50px; */
    display:grid;
    grid-template-rows: 65vh 15vh 5vh auto;
    overflow-y: hidden;
  }

  .container-svg{
    width: 40vw;
    height: 40vh;
    padding: 0em 0em 1em 2em;
    margin-left: auto;
    margin-right: auto;
    margin-top: 4em;
    position: relative;
    bottom: 0;
    fill:white;
    /* left: 0; */
  }

  .canvas-logo {

    /* opacity:0.1; */
    background-color: rgb(16, 16, 16);
    height: 100% !important;
    width: 100% !important;
    visibility: visible;
    border-radius: 2px;
  }

  .loading-bar {
	  padding: 16px 16px;
  }
</style>
