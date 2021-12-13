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
    width: 5.5em;
    height: 2.5em;
    padding: 0.2em 0.2em 0.8em 0.8em;
    display: block;
    /* font-size: 12px; */
    font-family: sans-serif;
    font-weight: 400;
    cursor: pointer;
    color: white;

    line-height: 1.3;
    max-width: 100%;
    box-sizing: border-box;
    border: 0 solid #333;
    text-align: left;
    /* margin-top: 5px; */
    margin-right: 5px;
    border-radius: .6em;
    -moz-appearance: none;
    -webkit-appearance: none;
    appearance: none;
    background-color:  rgba(16, 16, 16, 0.04);
    /* background-image: url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23007CB2%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E'),
      linear-gradient(to bottom, #ffffff 0%,#e5e5e5 100%); */
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
    /* font-size: 12px; */
    font-family: sans-serif;
    font-weight: 400;
    cursor: pointer;
    color: red;
    line-height: 1.3;
    max-width: 100%;
    box-sizing: border-box;
    /* margin-top: 5px; */
    margin-right: 5px;
    /* border: 0 solid #333; */
    text-align: left;
    -moz-appearance: none;
    -webkit-appearance: none;
    appearance: none;
    background-color:  rgba(16, 16, 16, 0.04);
    background-repeat: no-repeat, repeat;
    /* background-position: right .7em top 50%, 0 0; */
    background-size: .65em auto, 100%;
    /* -webkit-box-shadow: -1px -1px 1px rgb(34, 34, 34), 2px 2px 5px rgba(0,0,0),;
    -moz-box-shadow: -1px -1px 1px rgb(34, 34, 34), 2px 2px 5px rgba(0,0,0), ;
    box-shadow:  -1px -1px 3px #ffffff61, 2px 2px 3px rgb(0, 0, 0); */
    box-shadow:  -1px -1px 3px rgba(16, 16, 16, 0.4), 0.5px 0.5px 0.5px rgba(16, 16, 16, 0.04);
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
