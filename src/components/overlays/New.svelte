<script>

  import { Engine } from 'sema-engine';

  let engine;

  import { user } from "../../stores/user.js";

  import {
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
    checkUser,
    savePlayground
  } from '../../db/client';

  import { onMount, onDestroy } from 'svelte';
  import { fly, fade } from 'svelte/transition';

  import { goto } from "@roxi/routify";

  const closeOverlay = () => {
    $isNewOverlayVisible = false;
  }

  //whether to display need to login button
  let needToLogin = false;

  const resetEnvironment = async () => {

    if(!engine)
      engine = new Engine();

    engine.hush();
    $engineStatus = 'paused';

    let user = await checkUser()

    //save existing playground
    savePlayground($uuid, $name, $items, $allowEdits, user);

    if ( user != null) {
      let data = await createPlayground()

      $uuid = data.id;
      $name = data.name;
      $items = $items.slice($items.length);
      $allowEdits = data.allowEdits;
      $author = data.author;
      window.history.pushState("", "", `/playground/${$uuid}`); //put the new UUID in the URL without reloading

      $isUploadOverlayVisible = false;
      $isSaveOverlayVisible = false;
      $isDeleteOverlayVisible = false;
      $isNewOverlayVisible = false;

      $isSelectLiveCodeEditorDisabled = false;
      $isSelectModelEditorDisabled = false;
      $isAddGrammarEditorDisabled = false;
      $isAddAnalyserDisabled = false;

      $sidebarDebuggerOptions.map( option => option.disabled = false );
    }
    else{
      console.log("you need to login")
      needToLogin = true; //so login information displays
    }
  }

  onMount( async () => {
    // engine = new Engine();
		console.log("New")
  });

  onDestroy( () => {
    // engine = null;
	});

</script>

<div  in:fly="{{ y: 200, duration: 300 }}" out:fade
      class="new-overlay-component"
      style='visibility:{ $isNewOverlayVisible ? "visible": "hidden"}'
      >

  <!-- <svg class="box-icon" xmlns="http://www.w3.org/2000/svg" width="50" height="43" viewBox="0 0 50 43"> -->
    <!-- <path d="M48.4 26.5c-.9 0-1.7.7-1.7 1.7v11.6h-43.3v-11.6c0-.9-.7-1.7-1.7-1.7s-1.7.7-1.7 1.7v13.2c0 .9.7 1.7 1.7 1.7h46.7c.9 0 1.7-.7 1.7-1.7v-13.2c0-1-.7-1.7-1.7-1.7zm-24.5 6.1c.3.3.8.5 1.2.5.4 0 .9-.2 1.2-.5l10-11.6c.7-.7.7-1.7 0-2.4s-1.7-.7-2.4 0l-7.1 8.3v-25.3c0-.9-.7-1.7-1.7-1.7s-1.7.7-1.7 1.7v25.3l-7.1-8.3c-.7-.7-1.7-.7-2.4 0s-.7 1.7 0 2.4l10 11.6z"></path> -->
  <!-- </svg> -->

  <!-- <div class='middle-container'> -->
    {#if !needToLogin}
    <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" fill="currentColor" class="bi bi-cloud-plus" viewBox="0 0 16 16">
      <path fill-rule="evenodd" d="M8 5.5a.5.5 0 0 1 .5.5v1.5H10a.5.5 0 0 1 0 1H8.5V10a.5.5 0 0 1-1 0V8.5H6a.5.5 0 0 1 0-1h1.5V6a.5.5 0 0 1 .5-.5z"/>
      <path d="M4.406 3.342A5.53 5.53 0 0 1 8 2c2.69 0 4.923 2 5.166 4.579C14.758 6.804 16 8.137 16 9.773 16 11.569 14.502 13 12.687 13H3.781C1.708 13 0 11.366 0 9.318c0-1.763 1.266-3.223 2.942-3.593.143-.863.698-1.723 1.464-2.383zm.653.757c-.757.653-1.153 1.44-1.153 2.056v.448l-.445.049C2.064 6.805 1 7.952 1 9.318 1 10.785 2.23 12 3.781 12h8.906C13.98 12 15 10.988 15 9.773c0-1.216-1.02-2.228-2.313-2.228h-.5v-.5C12.188 4.825 10.328 3 8 3a4.53 4.53 0 0 0-2.941 1.1z"/>
    </svg>

    <p class="new-overlay-text">
      <span style="font-weight: 1500;">Are you sure you want to make a new playground?</span>
    </p>
    <div class="new-overlay-button-container">
      <button class="button-dark"
              on:click={ resetEnvironment }
              >New</button>
      
      <button class="button-dark"
      on:click={ closeOverlay }
      >Cancel</button>
    </div>
    {:else}
      <svg xmlns="http://www.w3.org/2000/svg" width="320" height="100" fill="currentColor" class="bi bi-door-open" viewBox="0 0 16 16">
        <path d="M8.5 10c-.276 0-.5-.448-.5-1s.224-1 .5-1 .5.448.5 1-.224 1-.5 1z"/>
        <path d="M10.828.122A.5.5 0 0 1 11 .5V1h.5A1.5 1.5 0 0 1 13 2.5V15h1.5a.5.5 0 0 1 0 1h-13a.5.5 0 0 1 0-1H3V1.5a.5.5 0 0 1 .43-.495l7-1a.5.5 0 0 1 .398.117zM11.5 2H11v13h1V2.5a.5.5 0 0 0-.5-.5zM4 1.934V15h6V1.077l-6 .857z"/>
      </svg>

      <p class="new-overlay-text">
        <span style="font-weight: 1500;">You need to login to make a new playground. </span>
      </p>
      <div class="new-overlay-button-container">
        <button class="button-dark"
                on:click={ $goto('/login') }
                >Login</button>
        <button class="button-dark"
        on:click={ closeOverlay }
        >Cancel</button>
      </div>
    {/if}
  <!-- </div> -->
    
  
</div>

<style>
  /* .button-dark {
    width: 5.5em;
    height: 2.5em;
    padding: 0.2em 0.2em 0.8em 0.8em;
    display: block;
    font-family: sans-serif;
    font-weight: 400;
    cursor: pointer;
    color: white;
    line-height: 1.3;
    max-width: 100%;
    box-sizing: border-box;
    border: 0 solid #333;
    text-align: left;
    margin-right: 5px;
    border-radius: .6em;
    -moz-appearance: none;
    -webkit-appearance: none;
    appearance: none;
    background-color:  rgba(16, 16, 16, 0.04);
    background-repeat: no-repeat, repeat;
    background-position: right .7em top 50%, 0 0;
    background-size: .65em auto, 100%;
    -webkit-box-shadow: 2px 2px 3px rgb(0, 0, 0), -0.5px -0.5px 3px #ffffff61;
    -moz-box-shadow: 2px 2px 3px rgb(0, 0, 0), -0.5px -0.5px 3px #ffffff61;
    box-shadow: 2px 2px 3px rgb(0, 0, 0), -0.5px -0.5px 3px #ffffff61;

  }

  .button-dark:active {
    width: 10.5em;
    height: 2.5em;
    padding: 0.2em 0.2em 0.8em 0.8em;
    display: block;
    font-size: medium;
    font-family: sans-serif;
    font-weight: 400;
    cursor: pointer;
    color: red;
    line-height: 1.3;
    max-width: 100%;
    box-sizing: border-box;
    margin-right: 5px;
    text-align: left;
    -moz-appearance: none;
    -webkit-appearance: none;
    appearance: none;
    background-color:  rgba(16, 16, 16, 0.04);
    background-repeat: no-repeat, repeat;
    background-size: .65em auto, 100%;
    box-shadow:  -1px -1px 3px rgba(16, 16, 16, 0.4), 0.5px 0.5px 0.5px rgba(16, 16, 16, 0.04);
  } */

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

  .new-overlay-button-container {
    display: inline-flex;
  }

  .new-overlay-component {
    width: 100%;
		height:100%;
    display:flex;
    justify-content:center;
    align-items:center;
		flex-direction:column;
    font-size:16px;
  }


  .new-overlay-text {
    /* top:50%; */

    /* width: 100%; */
    /* position: absolute; */
    color: #FFF;
  }

  .middle-container {
    justify-content:center;
    align-items:center;
		flex-direction:column;
    background-color: #201f1f;
    border-radius: 5px;
  }
</style>
