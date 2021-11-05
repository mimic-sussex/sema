<script>
  import {
    siteMode,
    fullScreen
  } from '../../../stores/common.js';

  import { isActive, goto, url } from "@roxi/routify";
	// import { authStore } from '../../../auth'

	import {
    onMount,
    onDestroy
  } from 'svelte';

	import {
		supabase,
		updatePlayground,
    createPlayground,
    forkPlayground
	} from  "../../../db/client";

  import { Engine } from 'sema-engine';

  let engine,
      engineLoaded = false
      ;


	// const { user, signout } = authStore;

  import {
    sidebarLiveCodeOptions,
    selectedLiveCodeOption,
    isSelectLiveCodeEditorDisabled,

    sidebarModelOptions,
    selectedModelOption,
    isSelectModelEditorDisabled,


    loadEnvironmentOptions,
    selectedLoadEnvironmentOption,
    isLoadEnvironmentOptionsDisabled,

    // sidebarGrammarOptions,
    isAddGrammarEditorDisabled,

    isAddAnalyserDisabled,

    sidebarDebuggerOptions,
    selectedDebuggerOption,
    isSelectDebuggerDisabled,

    focusedItemProperties,
    isSaveOverlayVisible,
    isUploadOverlayVisible,
    isDeleteOverlayVisible,
    isNewOverlayVisible,
    isShareOverlayVisible,
    isDoesNotExistOverlayVisible,
    items,
    // assignNewID,
    hydrateJSONcomponent,
    loadEnvironmentSnapshotEntries,
		uuid,
    name,
    allowEdits,
    author
  } from '../../../stores/playground'

  import {
    user,
    loggedIn
  } from '../../../stores/user'

  import * as doNotZip from 'do-not-zip';
	import downloadBlob from '../../../utils/downloadBlob.js';
// import { link } from 'fs';

  $: permission = checkPermissions($loggedIn, $allowEdits, $user, $author);

  let handleClick = () => {
    window.localStorage["tutorial-" + new Date(Date.now()).toISOString()] = JSON.stringify($items)
  }

  let shareProjectLink = () => {
    $isUploadOverlayVisible = false;
    $isSaveOverlayVisible = false;
		$isNewOverlayVisible = false;
    $isDeleteOverlayVisible = false;
    $isDoesNotExistOverlayVisible = false;
    $isShareOverlayVisible = true;
  }

	const onNameChange = async () => {
		try {
			updatePlayground($uuid, $name, $items, $allowEdits, $user)
		} catch (error) {
			console.error(error);
		}
  }
  
  //give option to fork project when it is read only (allowEdits false)
  const forkProject = async () => {
    console.log("DEBUG: Forking playground as is readOnly")
    if ($uuid){
      
      let fork = await forkPlayground($uuid);
      $uuid = fork.id;
      $name = fork.name;
      $items = fork.content.map(item => hydrateJSONcomponent(item));
      //$goto($url(`/playground/${$uuid}`));
      window.history.pushState("", "", `/playground/${$uuid}`); //changes the url without realoading;
    }
    else
      throw new Error ('Cant find UUID for project')
  }


  function resetEnvironment(){
    $isUploadOverlayVisible = false;
    $isSaveOverlayVisible = false;
    $isNewOverlayVisible = false;
    $isShareOverlayVisible = false;
    $isDoesNotExistOverlayVisible = false;
    $isDeleteOverlayVisible = true;
  }

  async function newEnvironment(){
		try {
			$isUploadOverlayVisible = false;
			$isSaveOverlayVisible = false;
      $isDeleteOverlayVisible = false;
      $isShareOverlayVisible = false;
      $isDoesNotExistOverlayVisible =false;
			$isNewOverlayVisible = true;

			// $items = data.content.map(item => hydrateJSONcomponent(item))
			// loadEnvironmentSnapshotEntries();
		} catch (error) {
			console.error(error);
		}
  }
  function storeEnvironment(){
		try {
			$isUploadOverlayVisible = false;
			$isSaveOverlayVisible = true;
      $isDeleteOverlayVisible = false;
      $isShareOverlayVisible = false;
      $isDoesNotExistOverlayVisible = false;
			$isNewOverlayVisible = false;

			loadEnvironmentSnapshotEntries();
		} catch (error) {
			console.error(error);
		}
  }

  function loadEnvironment(){

    // Retrieve item, hydrate JSON into grid-items
    let json = window.localStorage.getItem($selectedLoadEnvironmentOption.content);
    $items = JSON.parse(json)
    		.map(item => hydrateJSONcomponent(item))
		// .map(item => assignNewID(item))

    // Reset UI
    $selectedLoadEnvironmentOption = $loadEnvironmentOptions[0];
    $isLoadEnvironmentOptionsDisabled = true;
  }

  function uploadEnvironment(){

    $isUploadOverlayVisible = true;
    $isSaveOverlayVisible = false;
    $isDeleteOverlayVisible = false;
    $isShareOverlayVisible = false;
    $isDoesNotExistOverlayVisible = false;
		$isNewOverlayVisible = false;
  }

  function downloadEnvironment(){

    let timestamp = new Date().toISOString();

    // Create blob from current playround state and filtered content from editor widgets
    const blob = doNotZip.toBlob($items
      .reduce(
        (acc, val) => {
          if (val.data && val.data.content) // if 'val' is an editor type (liveCode, grammar or model), `data.content` if defined
            acc.push({ path: `${val.data.type}`+`.txt`, data: val.data.content });
          return acc
        }, [{ path: `playground.json`, data: localStorage.getItem("playground") }]
      )
    );
    // Trigger a browser file download
		downloadBlob(blob, 'sema-' + `${timestamp}` + '.zip');
  }

  onMount( async () => {
    engine = new Engine();

  });

  onDestroy( () => {
    engine = null;
	});

  function checkPermissions(loggedIn, allowEdits, user, author){
    console.log("DEBUG: checkPermissions");
    
    if (allowEdits){
      return true //anyone can edit
    } 
    else if (!allowEdits){
      if (user != null){ 
        
        if (user.id == author){
          return true
        } else {
          return false
        }
      }  else {
        return false
      } 
    }
  }


</script>

<style>


  .icon-container {
    /* width: 10px; */
    /* height: 10px; */
    display:flex;
    justify-content:center;
    align-items:center;
  }

  .button-dark {
		padding: 20;
		background-color: #262a2e;
		color: grey;
		border: none;
    width: 42px;
  	/* height: 42px; */
  	margin: 8px 8px 8px 8px;
  	border-radius: 5px;
  	background-color: #262a2e;
	}

  .button-dark:hover {
    /* background-color: blue; */
    color: white;
  }

  .button-dark:active{
    color: white;
    background-color: grey;
  }

  /* .button-dark {
    width: 2.5em;
    height: 2.5em;
    padding: 0.2em 0.2em 0.8em 0.8em;
    display: block;
    font-family: sans-serif;
    font-weight: 400;
    cursor: pointer;
    color: red;
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
  } */

  /* .button-dark:hover {
    width: 2.5em;
    height: 2.5em;
    padding: 0.2em 0.2em 0.8em 0.8em;
    font-family: sans-serif;
    font-weight: 500;
    cursor: pointer;
    color: red;
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
    background-color:  linear-gradient(rgba(16, 16, 16, 1), rgba(16, 16, 16, 0.08));
    background-repeat: no-repeat, repeat;
    background-position: right .7em top 50%, 0 0;
    background-size: .65em auto, 100%;
    -webkit-box-shadow: 2px 2px 5px rgba(0,0,0),-0.5px -0.5px 3px rgb(34, 34, 34);
    -moz-box-shadow: 2px 2px 5px rgba(0,0,0), -0.5px -0.5px 3px rgb(34, 34, 34);;
    box-shadow: 2px 2px 3px rgb(0, 0, 0), -1px -1px 3px #ffffff61;
  } */
  /* .button-dark:active {
    width: 2.5em;
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


  .light-mode {
    fill: rgb(133, 130, 130);
    enable-background:new 0 0 512 512;
    padding-bottom:3px;
    width: 15px;
  }

  .dark-mode {
    fill: rgb(133, 130, 130);
    enable-background:new 0 0 512 512;
    padding-bottom:3px;
    width: 15px;
  }


  /* .button-light {
    width: 2.5em;
    height: 2.5em;
    display: block;
    font-size: medium;
    font-family: sans-serif;
    font-weight: 400;
    cursor: pointer;
    color: black;
    line-height: 1.3;
    padding: 0.7em 1em 0.7em 1em;
    max-width: 100%;
    box-sizing: border-box;
    border: 0 solid #333;
    text-align: left;
    border-radius: .6em;
    -moz-appearance: none;
    -webkit-appearance: none;
    appearance: none;
    background-color:  rgba(16, 16, 16, 0.04);
    background-repeat: no-repeat, repeat;
    background-position: right .7em top 50%, 0 0;
    background-size: .65em auto, 100%;
    box-shadow:   2px 2px 3px #ffffff61, -1px -1px 3px  rgb(0, 0, 0);
    -moz-box-shadow:   2px 2px 3px #ffffff61, -1px -1px 3px  rgb(0, 0, 0);
    -webkit-box-shadow:  2px 2px 3px #ffffff61, -1px -1px 3px  rgb(0, 0, 0);
  }

  .button-light:active {
    width: 2.5em;
    height: 2.5em;
    display: block;
    font-size: medium;
    font-family: sans-serif;
    font-weight: 400;
    cursor: pointer;
    color: black;
    line-height: 1.3;
    padding: 0.7em 1em 0.7em 1em;
    max-width: 100%;
    box-sizing: border-box;
    border: 0 solid #333;
    text-align: left;
    border-radius: .6em;
    -moz-appearance: none;
    -webkit-appearance: none;
    appearance: none;
    background-color:  rgba(16, 16, 16, 0.04);
    background-repeat: no-repeat, repeat;
    background-position: right .7em top 50%, 0 0;
    background-size: .65em auto, 100%;
    box-shadow:   2px 2px 3px #ffffff61, -1px -1px 3px  rgb(0, 0, 0);
    -moz-box-shadow:   2px 2px 3px #ffffff61, -1px -1px 3px  rgb(0, 0, 0);
    -webkit-box-shadow:  2px 2px 3px #ffffff61, -1px -1px 3px  rgb(0, 0, 0)
  }
  .button-light:disabled {
    width: 2.5em;
    height: 2.5em;
    display: block;
    font-size: medium;
    font-family: sans-serif;
    font-weight: 400;
    cursor: pointer;
    color: #888;
    line-height: 1.3;
    padding: 0.7em 1em 0.7em 1em;
    width: 8em;
    max-width: 100%;
    box-sizing: border-box;
    border: 0 solid #333;
    text-align: left;
    border-radius: .6em;
    -moz-appearance: none;
    -webkit-appearance: none;
    appearance: none;
    background-color:  rgba(16, 16, 16, 0.04);
    background-repeat: no-repeat, repeat;
    background-position: right .7em top 50%, 0 0;
    background-size: .65em auto, 100%;
    box-shadow:   2px 2px 3px #ffffff61, -1px -1px 3px  rgb(0, 0, 0);
    -moz-box-shadow:   2px 2px 3px #ffffff61, -1px -1px 3px  rgb(0, 0, 0);
    -webkit-box-shadow:  2px 2px 3px #ffffff61, -1px -1px 3px  rgb(0, 0, 0)
  } */


	input {
		resize: none;
		white-space: nowrap;
		overflow-x: scroll;
		height: 2.3em;
    padding: 0.7em 1.2em 0.7em 1em;
		margin-top: 0.3em;
		margin-right: 0.3em;
		color: white;
		background:#262a2e;
		border: 0;/*0.5px solid #ffffff61; */
  }
  
  .no-changes-link {
    color: grey;
    text-decoration: underline;
  }

</style>

<!--NAME PROJECT TEXT BOX-->
<input type="text"
				bind:value={ $name }
        on:change={ onNameChange }
        placeholder='Project Name'
        style="{( $isActive(`/playground`) )? `visibility:visible;`: `visibility:collapse`}; margin-left: 2px;" 
        />

<!--if playground loaded is readonly say that user doesnt have permission to save-->
{#if !permission && $user != null}
  <a href={'#'} class="no-changes-link" 
  on:click={forkProject} 
  title="You do not have permission to save this playground. To save your changes, click to make a copy."
  style="{( $isActive('/playground') )? `visibility:visible;`: `visibility:collapse`}; margin-left: 2px;"
  >Changes will not be saved</a>
{:else if (!$user) }
  <!-- <p> {$loggedIn} {$user} {permission}</p> -->
  <a href={'/login'} class="no-changes-link" 
  title="Your changes will not be saved since you are not logged in. Click here to Login/Sign up."
  style="{( $isActive('/playground') )? `visibility:visible;`: `visibility:collapse`}; margin-left: 2px;"
  >Changes will not be saved</a>
{/if}

<!-- SAVE -->
<button class="{ $siteMode === 'dark'? 'button-dark' :'button-light' }"
        title="new project"
        style="{( $isActive('/playground') )? `visibility:visible;`: `visibility:collapse`}; margin-left: 2px;"
        on:click={ () => newEnvironment() }
        >
  <div class="icon-container">
    {#if $siteMode === 'dark' }
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-cloud-plus" viewBox="0 0 16 16">
        <path fill-rule="evenodd" d="M8 5.5a.5.5 0 0 1 .5.5v1.5H10a.5.5 0 0 1 0 1H8.5V10a.5.5 0 0 1-1 0V8.5H6a.5.5 0 0 1 0-1h1.5V6a.5.5 0 0 1 .5-.5z"/>
        <path d="M4.406 3.342A5.53 5.53 0 0 1 8 2c2.69 0 4.923 2 5.166 4.579C14.758 6.804 16 8.137 16 9.773 16 11.569 14.502 13 12.687 13H3.781C1.708 13 0 11.366 0 9.318c0-1.763 1.266-3.223 2.942-3.593.143-.863.698-1.723 1.464-2.383zm.653.757c-.757.653-1.153 1.44-1.153 2.056v.448l-.445.049C2.064 6.805 1 7.952 1 9.318 1 10.785 2.23 12 3.781 12h8.906C13.98 12 15 10.988 15 9.773c0-1.216-1.02-2.228-2.313-2.228h-.5v-.5C12.188 4.825 10.328 3 8 3a4.53 4.53 0 0 0-2.941 1.1z"/>
      </svg>
    {:else if $siteMode === 'light' }
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-cloud-plus" viewBox="0 0 16 16">
        <path fill-rule="evenodd" d="M8 5.5a.5.5 0 0 1 .5.5v1.5H10a.5.5 0 0 1 0 1H8.5V10a.5.5 0 0 1-1 0V8.5H6a.5.5 0 0 1 0-1h1.5V6a.5.5 0 0 1 .5-.5z"/>
        <path d="M4.406 3.342A5.53 5.53 0 0 1 8 2c2.69 0 4.923 2 5.166 4.579C14.758 6.804 16 8.137 16 9.773 16 11.569 14.502 13 12.687 13H3.781C1.708 13 0 11.366 0 9.318c0-1.763 1.266-3.223 2.942-3.593.143-.863.698-1.723 1.464-2.383zm.653.757c-.757.653-1.153 1.44-1.153 2.056v.448l-.445.049C2.064 6.805 1 7.952 1 9.318 1 10.785 2.23 12 3.781 12h8.906C13.98 12 15 10.988 15 9.773c0-1.216-1.02-2.228-2.313-2.228h-.5v-.5C12.188 4.825 10.328 3 8 3a4.53 4.53 0 0 0-2.941 1.1z"/>
      </svg>
    {/if}
  </div>
</button>



<button class="{ $siteMode === 'dark'? 'button-dark' :'button-light' }"
        title="save project"
        style="{( $isActive('/playground') )? `visibility:visible;`: `visibility:collapse`}; margin-left: 2px;"
        on:click={ () => storeEnvironment() }
        >
  <div class="icon-container">
    {#if $siteMode === 'dark' }
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-cloud-arrow-up" viewBox="0 0 16 16">
        <path fill-rule="evenodd" d="M7.646 5.146a.5.5 0 0 1 .708 0l2 2a.5.5 0 0 1-.708.708L8.5 6.707V10.5a.5.5 0 0 1-1 0V6.707L6.354 7.854a.5.5 0 1 1-.708-.708l2-2z"/>
        <path d="M4.406 3.342A5.53 5.53 0 0 1 8 2c2.69 0 4.923 2 5.166 4.579C14.758 6.804 16 8.137 16 9.773 16 11.569 14.502 13 12.687 13H3.781C1.708 13 0 11.366 0 9.318c0-1.763 1.266-3.223 2.942-3.593.143-.863.698-1.723 1.464-2.383zm.653.757c-.757.653-1.153 1.44-1.153 2.056v.448l-.445.049C2.064 6.805 1 7.952 1 9.318 1 10.785 2.23 12 3.781 12h8.906C13.98 12 15 10.988 15 9.773c0-1.216-1.02-2.228-2.313-2.228h-.5v-.5C12.188 4.825 10.328 3 8 3a4.53 4.53 0 0 0-2.941 1.1z"/>
      </svg>
    {:else if $siteMode === 'light' }
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-cloud-arrow-up" viewBox="0 0 16 16">
        <path fill-rule="evenodd" d="M7.646 5.146a.5.5 0 0 1 .708 0l2 2a.5.5 0 0 1-.708.708L8.5 6.707V10.5a.5.5 0 0 1-1 0V6.707L6.354 7.854a.5.5 0 1 1-.708-.708l2-2z"/>
        <path d="M4.406 3.342A5.53 5.53 0 0 1 8 2c2.69 0 4.923 2 5.166 4.579C14.758 6.804 16 8.137 16 9.773 16 11.569 14.502 13 12.687 13H3.781C1.708 13 0 11.366 0 9.318c0-1.763 1.266-3.223 2.942-3.593.143-.863.698-1.723 1.464-2.383zm.653.757c-.757.653-1.153 1.44-1.153 2.056v.448l-.445.049C2.064 6.805 1 7.952 1 9.318 1 10.785 2.23 12 3.781 12h8.906C13.98 12 15 10.988 15 9.773c0-1.216-1.02-2.228-2.313-2.228h-.5v-.5C12.188 4.825 10.328 3 8 3a4.53 4.53 0 0 0-2.941 1.1z"/>
      </svg>
    {/if}
  </div>
</button>


        <!-- style="{ ( $fullScreen && $isActive('/playground') ) ? `visibility:visible;`: `visibility:hidden`}" -->
<!-- DELETE -->
<button class="{ $siteMode === 'dark'? 'button-dark' :'button-light' }"
        title="clear project"
        style="{ ( $isActive('/playground') ) ? `visibility:visible;`: `visibility:collapse`}"
        on:click={ () => resetEnvironment() }
        >
  <div class="icon-container">
    {#if $siteMode === 'dark' }
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-file-x" viewBox="0 0 16 16">
        <path d="M6.146 6.146a.5.5 0 0 1 .708 0L8 7.293l1.146-1.147a.5.5 0 1 1 .708.708L8.707 8l1.147 1.146a.5.5 0 0 1-.708.708L8 8.707 6.854 9.854a.5.5 0 0 1-.708-.708L7.293 8 6.146 6.854a.5.5 0 0 1 0-.708z"/>
        <path d="M4 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H4zm0 1h8a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z"/>
      </svg>
    {:else if $siteMode === 'light' }
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-file-x" viewBox="0 0 16 16">
        <path d="M6.146 6.146a.5.5 0 0 1 .708 0L8 7.293l1.146-1.147a.5.5 0 1 1 .708.708L8.707 8l1.147 1.146a.5.5 0 0 1-.708.708L8 8.707 6.854 9.854a.5.5 0 0 1-.708-.708L7.293 8 6.146 6.854a.5.5 0 0 1 0-.708z"/>
        <path d="M4 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H4zm0 1h8a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z"/>
      </svg>
    {/if}
  </div>
</button>

<button class="{ $siteMode === 'dark'? 'button-dark' :'button-light' }"
        title="download project"
        style="{( $isActive('/playground') ) ? `visibility:visible;`: `visibility:collapse`}; padding: 0.2em 0.4em 0.8em 0.6em ! important;"
        on:click={ () => downloadEnvironment() }
        >
  <div class="icon-container">
    {#if $siteMode === 'dark' }
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-download" viewBox="0 0 16 16">
        <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
        <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
      </svg>
    {:else if $siteMode === 'light' }
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-upload" viewBox="0 0 16 16">
        <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
        <path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708l3-3z"/>
      </svg>
    {/if}
  </div>
</button>


<button class="{ $siteMode === 'dark'? 'button-dark' :'button-light' }"
        title="upload project"
        style="{( $isActive('/playground') ) ? `visibility:visible;`: `visibility:collapse`}; padding: 0.2em 0.4em 0.8em 0.6em ! important;"
        on:click={ () => uploadEnvironment() }
        >
  <div class="icon-container">
    {#if $siteMode === 'dark' }
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-upload" viewBox="0 0 16 16">
        <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
        <path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708l3-3z"/>
      </svg>
    {:else if $siteMode === 'light' }
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-upload" viewBox="0 0 16 16">
        <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
        <path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708l3-3z"/>
      </svg> 
    {/if}
  </div>
</button>


        <!-- style="{ $fullScreen? `visibility:visible;`: `visibility:hidden`}; padding: 0.25em 0.3em 0.75em 0.7em;" -->
<!-- SHARE -->
<button class="{ $siteMode === 'dark'? 'button-dark' :'button-light' }"
        title="share project"
        style="{( $isActive('/playground') ) ? `visibility:visible;`: `visibility:collapse`}; padding: 0.2em 0.4em 0.8em 0.6em ! important;"
        on:click={ shareProjectLink }>
  <div class="icon-container">
    {#if $siteMode === 'dark' }
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-share" viewBox="0 0 16 16">
        <path d="M13.5 1a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM11 2.5a2.5 2.5 0 1 1 .603 1.628l-6.718 3.12a2.499 2.499 0 0 1 0 1.504l6.718 3.12a2.5 2.5 0 1 1-.488.876l-6.718-3.12a2.5 2.5 0 1 1 0-3.256l6.718-3.12A2.5 2.5 0 0 1 11 2.5zm-8.5 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm11 5.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/>
      </svg>
    {:else if $siteMode === 'light' }
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-share" viewBox="0 0 16 16">
        <path d="M13.5 1a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM11 2.5a2.5 2.5 0 1 1 .603 1.628l-6.718 3.12a2.499 2.499 0 0 1 0 1.504l6.718 3.12a2.5 2.5 0 1 1-.488.876l-6.718-3.12a2.5 2.5 0 1 1 0-3.256l6.718-3.12A2.5 2.5 0 0 1 11 2.5zm-8.5 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm11 5.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/>
      </svg>
    {/if}
  </div>
</button>






<!-- <div style='width: 2px;'></div> -->








