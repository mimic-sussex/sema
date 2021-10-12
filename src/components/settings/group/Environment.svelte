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
    width: 10px;
    height: 10px;
  }


  .button-dark {
    width: 2.5em;
    height: 2.5em;
    padding: 0.2em 0.2em 0.8em 0.8em;
    display: block;
    /* font-size: 12px; */
    font-family: sans-serif;
    font-weight: 400;
    cursor: pointer;
    color: red;
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

  .button-dark:hover {
    width: 2.5em;
    height: 2.5em;
    padding: 0.2em 0.2em 0.8em 0.8em;
    display: block;
    /* font-size: 12px; */
    font-family: sans-serif;
    font-weight: 500;
    cursor: pointer;
    color: red;
    line-height: 1.3;
    max-width: 100%;
    box-sizing: border-box;
    border: 0 solid #333;
    text-align: left;
    /* margin-top: 5px; */
    margin-right: 5px;
    /* box-shadow: 0 1px 0 0px rgba(4, 4, 4, 0.04); */
    border-radius: .6em;
    -moz-appearance: none;
    -webkit-appearance: none;
    appearance: none;
    background-color:  linear-gradient(rgba(16, 16, 16, 1), rgba(16, 16, 16, 0.08));
    /* background-image: url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23007CB2%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E'),
      linear-gradient(to bottom, #ffffff 0%,#e5e5e5 100%); */
    background-repeat: no-repeat, repeat;
    background-position: right .7em top 50%, 0 0;
    background-size: .65em auto, 100%;
    -webkit-box-shadow: 2px 2px 5px rgba(0,0,0),-0.5px -0.5px 3px rgb(34, 34, 34);
    -moz-box-shadow: 2px 2px 5px rgba(0,0,0), -0.5px -0.5px 3px rgb(34, 34, 34);;
    box-shadow: 2px 2px 3px rgb(0, 0, 0), -1px -1px 3px #ffffff61;
  }
  .button-dark:active {
    width: 2.5em;
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

  .combobox-dark {
    width: 10em;
    height: 2.5em;
    padding: 0.2em 0.2em 0.8em 0.8em;
    /* margin-top: 5px; */
    margin-right: 5px;
    font-size: medium;
    font-family: sans-serif;
    font-weight: 400;
    cursor: pointer;
    color: #ccc;
    line-height: 1.3;
    padding: 0.7em 1em 0.7em 1em;
    box-sizing: border-box;
    border: 0 solid #333;
    text-align: left;
    border-radius: .6em;
    -moz-appearance: none;
    -webkit-appearance: none;
    appearance: none;
    background-color: rgba(16, 16, 16, 0.04);
    background-repeat: no-repeat, repeat;
    background-position: right .7em top 50%, 0 0;
    background-size: .65em auto, 100%;
    -webkit-box-shadow: 2px 2px 3px rgb(0, 0, 0), -0.5px -0.5px 3px #ffffff61;
    -moz-box-shadow: 2px 2px 3px rgb(0, 0, 0), -0.5px -0.5px 3px #ffffff61;
    box-shadow: 2px 2px 3px rgb(0, 0, 0), -0.5px -0.5px 3px #ffffff61;
  }


  .combobox-dark:hover {
    width: 10em;
    height: 2.5em;
    padding: 0.2em 0.2em 0.8em 0.8em;
    /* margin-top: 5px; */
    margin-right: 5px;
    font-family: sans-serif;
    font-weight: 500;
    cursor: pointer;
    color: #fff;
    line-height: 1.3;
    padding: 0.7em 1em 0.7em 1em;
    box-sizing: border-box;
    border: 0 solid #333;
    text-align: left;
    border-radius: .6em;
    -moz-appearance: none;
    -webkit-appearance: none;
    appearance: none;
    background-color: linear-gradient(rgba(16, 16, 16, 1), rgba(16, 16, 16, 0.2));
    background-repeat: no-repeat, repeat;
    background-position: right .7em top 50%, 0 0;
    background-size: .65em auto, 100%;
    -webkit-box-shadow: 5px 5px 20px -5px rgba(0,0,0,0.75), -5px -5px 20px rgba(255, 255, 255, 0.954);
    -moz-box-shadow: 5px 5px 20px -5px rgba(0,0,0,0.75), -5px -5px 20px rgba(255, 255, 255, 0.954);
    box-shadow: 2px 2px 3px rgb(0, 0, 0), -1px -1px 3px #ffffff61;
  }

  .combobox-dark:focus {
    width: 10em;
    height: 2.5em;
    padding: 0.2em 0.2em 0.8em 0.8em;
    /* margin-top: 5px; */
    margin-right: 5px;
    font-size: medium;
    font-family: sans-serif;
    font-weight: 500;
    cursor: pointer;
    /* color: #fff; */
    line-height: 1.3;
    padding: 0.7em 1em 0.7em 1em;
    box-sizing: border-box;
    border: 0 solid #333;
    text-align: left;
    border-radius: .6em;
    -moz-appearance: none;
    -webkit-appearance: none;
    appearance: none;
    background-color: rgba(16, 16, 16, 0.04);
    background-repeat: no-repeat, repeat;
    background-position: right .7em top 50%, 0 0;
    background-size: .65em auto, 100%;
    -webkit-box-shadow: 5px 5px 20px -5px rgba(0,0,0,0.75), -5px -5px 20px rgba(255, 255, 255, 0.954);
    -moz-box-shadow: 5px 5px 20px -5px rgba(0,0,0,0.75), -5px -5px 20px rgba(255, 255, 255, 0.954);
    box-shadow: 2px 2px 3px rgb(0, 0, 0), -1px -1px 3px #ffffff61;
  }

/* select {
    padding: 15px;
    border-radius: 3px !important;
    height: 50px !important;
    color: #ffffff !important;
    padding-right: 30px !important;
    font-size: 14px !important;
    border-color: blue !important;
    position: relative;
    -moz-appearance: none;
    -webkit-appearance: none;
    appearance: none;
    border: none;
    background: white url('data:image/svg+xml;utf8,<svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 512 512" style="enable-background:new 0 0 512 512;width:15px;" class="light-mode" xml:space="preserve"><g id="XMLID_1_"><path id="XMLID_9_" d="M466.5,0h-381L0,83.6v382.8C0,491.6,20.4,512,45.5,512h420.9c25.1,0,45.5-20.4,45.5-45.5V45.5 C512,20.4,491.6,0,466.5,0z M392.1,29.7v60.4H151.5V29.7H392.1z M91.1,481.3v-30.7h330.8v29.7H91.1V481.3z M482.3,465.5 c0,8.4-6.5,14.9-14.9,14.9h-15.8V420H61.3v60.4H46.5c-8.4,0-14.9-6.5-14.9-14.9V95.7l67.8-66h22.3v90.1h301.1V29.7h45.5 c8.4,0,14.9,6.5,14.9,14.9v420.9H482.3z M256.5,150.5c-57.6,0-105,47.4-105,105s47.4,105,105,105s105-47.4,105-105 S314.1,150.5,256.5,150.5z M256.5,330.8c-41.8,0-75.3-33.5-75.3-75.3s33.5-75.3,75.3-75.3s75.3,33.5,75.3,75.3 S298.3,330.8,256.5,330.8z"/></g></svg>") no-repeat !important; background-position-x: 100%; background-position-y: 5px;')
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


  .button-light {
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
  }


	input {
		resize: none;
		white-space: nowrap;
		overflow-x: scroll;
		height: 2.3em;
    padding: 0.7em 1.2em 0.7em 1em;
		margin-top: 0.3em;
		margin-right: 0.3em;
		color: white;
		background:#212121;
		border: 0.5px solid #ffffff61;
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

        <!-- style="{( $fullScreen && $isActive('/playground') )? `visibility:visible;`: `visibility:hidden`}; ! important;" -->
<!-- svelte-ignore a11y-no-onchange -->
<!-- <select class="combobox-dark"
        title="load environment"
        bind:value={ $selectedLoadEnvironmentOption }
        on:change={ () => loadEnvironment() }
        style="{( $isActive('/playground') )? `visibility:visible;`: `visibility:collapse`}; ! important;"
        on:click={ () => $loadEnvironmentOptions[0].disabled = true }
        cursor={ () => ( $isLoadEnvironmentOptionsDisabled ? 'not-allowed' : 'pointer') }
        >
  <div class="icon-container" style="z-index:1000;">
    {#if $siteMode === 'dark' }
      <svg version="1.1"
            id="Artwork"
            xmlns="http://www.w3.org/2000/svg"
            xmlns:xlink="http://www.w3.org/1999/xlink"
            x="0px" y="0px"
            viewBox="0 0 512 512"
            style="enable-background:new 0 0 512 512; width: 20px;"
            class="light-mode"
            enable-background="new 0 0 512 512"
            xml:space="preserve"
            >
      <g>
        <path d="M23.3,94.7v280.5c0,46.8,77.5,82.1,180.3,82.1c9.8,0,19.6-0.3,29.1-1c6.7-0.5,11.8-6.3,11.4-13.1
          c-0.5-6.7-6.3-11.7-13.1-11.4c-9,0.6-18.2,1-27.4,1c-91.8,0-155.8-30.4-155.8-57.6v-51c30.7,24.1,87.7,39.6,155.8,39.6
          c6.2,0,12.5-0.1,18.6-0.4c6.8-0.3,12-6,11.7-12.8c-0.3-6.8-6-12-12.8-11.7c-5.8,0.3-11.7,0.4-17.5,0.4
          c-91.8,0-155.8-30.4-155.8-57.6v-50.9c30.7,24.1,87.7,39.6,155.8,39.6c102.8,0,180.3-35.3,180.3-82.1V94.7
          c0-46.8-77.5-82.1-180.3-82.1C100.8,12.5,23.3,47.9,23.3,94.7z M203.6,245.8c-91.8,0-155.8-30.4-155.8-57.6v-51
          c30.7,24.1,87.7,39.6,155.8,39.6c68.1,0,125.1-15.5,155.8-39.6v51C359.5,215.5,295.5,245.8,203.6,245.8z M359.5,94.7
          c0,27.3-64,57.6-155.8,57.6S47.8,121.9,47.8,94.7S111.8,37,203.6,37S359.5,67.4,359.5,94.7z"/>
        <path d="M371.7,265.5c-64.5,0-117,52.5-117,117s52.5,117,117,117c64.5,0,117-52.5,117-117S436.2,265.5,371.7,265.5z M371.7,475
          c-51,0-92.5-41.5-92.5-92.5s41.5-92.5,92.5-92.5s92.5,41.5,92.5,92.5S422.7,475,371.7,475z"/>
        <path d="M380,327c-4.7-4.3-11.8-4.3-16.5,0l-32.6,29.8c-5,4.6-5.4,12.3-0.8,17.3c4.6,5,12.3,5.4,17.3,0.8l12.1-11.1V427
          c0,6.8,5.5,12.3,12.3,12.3S384,433.8,384,427v-63.2l12.1,11.1c2.3,2.1,5.3,3.2,8.3,3.2c3.3,0,6.6-1.3,9.1-4
          c4.6-5,4.2-12.7-0.8-17.3L380,327z"/>
      </g>
      </svg>
    {:else if $siteMode === 'light' }
      <svg version="1.1"
            id="Artwork"
            xmlns="http://www.w3.org/2000/svg"
            xmlns:xlink="http://www.w3.org/1999/xlink"
            x="0px" y="0px"
            viewBox="0 0 512 512"
            style="enable-background:new 0 0 512 512; width: 20px; margin-left: 5px; margin-right: 5px"
            enable-background="new 0 0 512 512"
            xml:space="preserve"
            >
      <g>
        <path d="M23.3,94.7v280.5c0,46.8,77.5,82.1,180.3,82.1c9.8,0,19.6-0.3,29.1-1c6.7-0.5,11.8-6.3,11.4-13.1
          c-0.5-6.7-6.3-11.7-13.1-11.4c-9,0.6-18.2,1-27.4,1c-91.8,0-155.8-30.4-155.8-57.6v-51c30.7,24.1,87.7,39.6,155.8,39.6
          c6.2,0,12.5-0.1,18.6-0.4c6.8-0.3,12-6,11.7-12.8c-0.3-6.8-6-12-12.8-11.7c-5.8,0.3-11.7,0.4-17.5,0.4
          c-91.8,0-155.8-30.4-155.8-57.6v-50.9c30.7,24.1,87.7,39.6,155.8,39.6c102.8,0,180.3-35.3,180.3-82.1V94.7
          c0-46.8-77.5-82.1-180.3-82.1C100.8,12.5,23.3,47.9,23.3,94.7z M203.6,245.8c-91.8,0-155.8-30.4-155.8-57.6v-51
          c30.7,24.1,87.7,39.6,155.8,39.6c68.1,0,125.1-15.5,155.8-39.6v51C359.5,215.5,295.5,245.8,203.6,245.8z M359.5,94.7
          c0,27.3-64,57.6-155.8,57.6S47.8,121.9,47.8,94.7S111.8,37,203.6,37S359.5,67.4,359.5,94.7z"/>
        <path d="M371.7,265.5c-64.5,0-117,52.5-117,117s52.5,117,117,117c64.5,0,117-52.5,117-117S436.2,265.5,371.7,265.5z M371.7,475
          c-51,0-92.5-41.5-92.5-92.5s41.5-92.5,92.5-92.5s92.5,41.5,92.5,92.5S422.7,475,371.7,475z"/>
        <path d="M380,327c-4.7-4.3-11.8-4.3-16.5,0l-32.6,29.8c-5,4.6-5.4,12.3-0.8,17.3c4.6,5,12.3,5.4,17.3,0.8l12.1-11.1V427
          c0,6.8,5.5,12.3,12.3,12.3S384,433.8,384,427v-63.2l12.1,11.1c2.3,2.1,5.3,3.2,8.3,3.2c3.3,0,6.6-1.3,9.1-4
          c4.6-5,4.2-12.7-0.8-17.3L380,327z"/>
      </g>
      </svg>
    {/if}
  </div>
  {#each $loadEnvironmentOptions as loadEnvironmentOption }
    <option disabled={ loadEnvironmentOption.disabled }
            value={loadEnvironmentOption}
            >
      { loadEnvironmentOption.text }
    </option>
  {/each}
</select> -->

        <!-- style="{( $fullScreen && $isActive('/playground') )? `visibility:visible;`: `visibility:hidden`}; margin-left: 2px;" -->
<!-- SAVE -->
<button class="{ $siteMode === 'dark'? 'button-dark' :'button-light' }"
        title="new project"
        style="{( $isActive('/playground') )? `visibility:visible;`: `visibility:collapse`}; margin-left: 2px;"
        on:click={ () => newEnvironment() }
        >
  <div class="icon-container">
    {#if $siteMode === 'dark' }
      <svg version="1.1"
        id="Layer_1"
        xmlns="http://www.w3.org/2000/svg"
        xmlns:xlink="http://www.w3.org/1999/xlink"
        x="0px" y="0px"
        viewBox="0 0 512 512"
        style="enable-background:new 0 0 512 512;width:15px;"
        class="light-mode"
        xml:space="preserve"
        >
        <g id="XMLID_1_">
          <path id="XMLID_9_" d="M466.5,0h-381L0,83.6v382.8C0,491.6,20.4,512,45.5,512h420.9c25.1,0,45.5-20.4,45.5-45.5V45.5
            C512,20.4,491.6,0,466.5,0z M256.5,150.5c-57.6,0-105,47.4-105,105s47.4,105,105,105s105-47.4,105-105
            S314.1,150.5,256.5,150.5z M256.5,330.8c-41.8,0-75.3-33.5-75.3-75.3s33.5-75.3,75.3-75.3s75.3,33.5,75.3,75.3
            S298.3,330.8,256.5,330.8z"/>
        </g>
      </svg>
    {:else if $siteMode === 'light' }
      <svg  version="1.1"
            id="Layer_1"
            xmlns="http://www.w3.org/2000/svg"
            xmlns:xlink="http://www.w3.org/1999/xlink"
            x="0px" y="0px"
            style="enable-background:new 0 0 512 512; width:15px;"
            viewBox="0 0 512 512"
            xml:space="preserve"
            >
        <g>
          <path id="XMLID_9_" d="M466.5,0h-381L0,83.6v382.8C0,491.6,20.4,512,45.5,512h420.9c25.1,0,45.5-20.4,45.5-45.5V45.5
            C512,20.4,491.6,0,466.5,0z M392.1,29.7v60.4H151.5V29.7H392.1z M91.1,481.3v-30.7h330.8v29.7H91.1V481.3z M482.3,465.5
            c0,8.4-6.5,14.9-14.9,14.9h-15.8V420H61.3v60.4H46.5c-8.4,0-14.9-6.5-14.9-14.9V95.7l67.8-66h22.3v90.1h301.1V29.7h45.5
            c8.4,0,14.9,6.5,14.9,14.9v420.9H482.3z M256.5,150.5c-57.6,0-105,47.4-105,105s47.4,105,105,105s105-47.4,105-105
            S314.1,150.5,256.5,150.5z M256.5,330.8c-41.8,0-75.3-33.5-75.3-75.3s33.5-75.3,75.3-75.3s75.3,33.5,75.3,75.3
            S298.3,330.8,256.5,330.8z"/>
        </g>
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
      <svg version="1.1"
        id="Layer_1"
        xmlns="http://www.w3.org/2000/svg"
        xmlns:xlink="http://www.w3.org/1999/xlink"
        x="0px" y="0px"
        viewBox="0 0 512 512"
        style="enable-background:new 0 0 512 512;width:15px;"
        class="light-mode"
        xml:space="preserve"
        >
        <g id="XMLID_1_">
          <path id="XMLID_9_" d="M466.5,0h-381L0,83.6v382.8C0,491.6,20.4,512,45.5,512h420.9c25.1,0,45.5-20.4,45.5-45.5V45.5
            C512,20.4,491.6,0,466.5,0z M392.1,29.7v60.4H151.5V29.7H392.1z M91.1,481.3v-30.7h330.8v29.7H91.1V481.3z M482.3,465.5
            c0,8.4-6.5,14.9-14.9,14.9h-15.8V420H61.3v60.4H46.5c-8.4,0-14.9-6.5-14.9-14.9V95.7l67.8-66h22.3v90.1h301.1V29.7h45.5
            c8.4,0,14.9,6.5,14.9,14.9v420.9H482.3z M256.5,150.5c-57.6,0-105,47.4-105,105s47.4,105,105,105s105-47.4,105-105
            S314.1,150.5,256.5,150.5z M256.5,330.8c-41.8,0-75.3-33.5-75.3-75.3s33.5-75.3,75.3-75.3s75.3,33.5,75.3,75.3
            S298.3,330.8,256.5,330.8z"/>
        </g>
      </svg>
    {:else if $siteMode === 'light' }
      <svg  version="1.1"
            id="Layer_1"
            xmlns="http://www.w3.org/2000/svg"
            xmlns:xlink="http://www.w3.org/1999/xlink"
            x="0px" y="0px"
            style="enable-background:new 0 0 512 512; width:15px;"
            viewBox="0 0 512 512"
            xml:space="preserve"
            >
        <g>
          <path id="XMLID_9_" d="M466.5,0h-381L0,83.6v382.8C0,491.6,20.4,512,45.5,512h420.9c25.1,0,45.5-20.4,45.5-45.5V45.5
            C512,20.4,491.6,0,466.5,0z M392.1,29.7v60.4H151.5V29.7H392.1z M91.1,481.3v-30.7h330.8v29.7H91.1V481.3z M482.3,465.5
            c0,8.4-6.5,14.9-14.9,14.9h-15.8V420H61.3v60.4H46.5c-8.4,0-14.9-6.5-14.9-14.9V95.7l67.8-66h22.3v90.1h301.1V29.7h45.5
            c8.4,0,14.9,6.5,14.9,14.9v420.9H482.3z M256.5,150.5c-57.6,0-105,47.4-105,105s47.4,105,105,105s105-47.4,105-105
            S314.1,150.5,256.5,150.5z M256.5,330.8c-41.8,0-75.3-33.5-75.3-75.3s33.5-75.3,75.3-75.3s75.3,33.5,75.3,75.3
            S298.3,330.8,256.5,330.8z"/>
        </g>
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
      <svg version="1.1"
            id="Layer_1"
            xmlns="http://www.w3.org/2000/svg"
            xmlns:xlink="http://www.w3.org/1999/xlink"
            x="0px" y="0px"
            viewBox="0 0 512 512"
            class="light-mode"
            style="enable-background:new 0 0 512 512;width:19px;"
            xml:space="preserve"
            >
        <g>
          <path d="M317.667,214.42l5.667-86.42h20.951V38h-98.384V0H132.669v38H34.285v90h20.951l20,305h140.571
            c23.578,24.635,56.766,40,93.478,40c71.368,0,129.43-58.062,129.43-129.43C438.715,275.019,385.143,218.755,317.667,214.42z
            M162.669,30h53.232v8h-53.232V30z M64.285,68h250v30h-250V68z M103.334,403L85.301,128H293.27l-5.77,87.985
            c-61.031,10.388-107.645,63.642-107.645,127.586c0,21.411,5.231,41.622,14.475,59.43H103.334z M309.285,443
            c-54.826,0-99.43-44.604-99.43-99.43s44.604-99.429,99.43-99.429s99.43,44.604,99.43,99.429S364.111,443,309.285,443z"/>
          <polygon points="342.248,289.395 309.285,322.358 276.322,289.395 255.109,310.608 288.072,343.571 255.109,376.533
            276.322,397.746 309.285,364.783 342.248,397.746 363.461,376.533 330.498,343.571 363.461,310.608 	"/>
        </g>
      </svg>
    {:else if $siteMode === 'light' }
      <svg version="1.1"
            id="Layer_1"
            xmlns="http://www.w3.org/2000/svg"
            xmlns:xlink="http://www.w3.org/1999/xlink"
            x="0px" y="0px"
            viewBox="0 0 512 512"
            style="enable-background:new 0 0 512 512;width:19px;"
            xml:space="preserve"
            >
        <g>
          <path d="M317.667,214.42l5.667-86.42h20.951V38h-98.384V0H132.669v38H34.285v90h20.951l20,305h140.571
            c23.578,24.635,56.766,40,93.478,40c71.368,0,129.43-58.062,129.43-129.43C438.715,275.019,385.143,218.755,317.667,214.42z
            M162.669,30h53.232v8h-53.232V30z M64.285,68h250v30h-250V68z M103.334,403L85.301,128H293.27l-5.77,87.985
            c-61.031,10.388-107.645,63.642-107.645,127.586c0,21.411,5.231,41.622,14.475,59.43H103.334z M309.285,443
            c-54.826,0-99.43-44.604-99.43-99.43s44.604-99.429,99.43-99.429s99.43,44.604,99.43,99.429S364.111,443,309.285,443z"/>
          <polygon points="342.248,289.395 309.285,322.358 276.322,289.395 255.109,310.608 288.072,343.571 255.109,376.533
            276.322,397.746 309.285,364.783 342.248,397.746 363.461,376.533 330.498,343.571 363.461,310.608 	"/>
        </g>
      </svg>
    {/if}
  </div>
</button>

<button class="{ $siteMode === 'dark'? 'button-dark' :'button-light' }"
        title="download project"
        style="padding: 0.2em 0.4em 0.8em 0.6em ! important;"
        on:click={ () => downloadEnvironment() }
        >
  <div class="icon-container">
    {#if $siteMode === 'dark' }
      <svg xmlns="http://www.w3.org/2000/svg" 
      width="18" 
      height="18" 
      fill="rgb(133, 130, 130)" 
      class="bi bi-download" 
      viewBox="0 0 16 16">
        <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
        <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
      </svg>
    {:else if $siteMode === 'light' }
      <svg xmlns="http://www.w3.org/2000/svg" 
      width="18" 
      height="18" 
      fill="rgb(133, 130, 130)" 
      class="bi bi-download" 
      viewBox="0 0 16 16">
        <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
        <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
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
      <svg xmlns="http://www.w3.org/2000/svg" 
      width="16" 
      height="16" 
      fill="rgb(133, 130, 130)" 
      class="bi bi-upload" 
      viewBox="0 0 16 16">
        <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
        <path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708l3-3z"/>
      </svg>  
    {:else if $siteMode === 'light' }
      <svg xmlns="http://www.w3.org/2000/svg" 
      width="16" 
      height="16" 
      fill="rgb(133, 130, 130)" 
      class="bi bi-upload" 
      viewBox="0 0 16 16">
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
        style="padding: 0.25em 0.3em 0.75em 0.7em;"
        on:click={ shareProjectLink }>
  <div class="icon-container">
    {#if $siteMode === 'dark' }

      <svg version="1.1"
            id="Layer_1"
            xmlns="http://www.w3.org/2000/svg"
            xmlns:xlink="http://www.w3.org/1999/xlink"
            x="0px" y="0px"
            viewBox="0 0 512 512"
            class='dark-mode'
            style="enable-background:new 0 0 512 512;"
            xml:space="preserve"

            >
        <g>
          <path class="st0"
            d="M404.9,0c45.1,0,81.5,37.1,81.5,82.8c0,45.7-36.5,82.8-81.5,82.8c-24.2,0-46-10.7-60.9-27.7l-160.9,88.1
            c3.6,9.3,5.5,19.5,5.5,30.1c0,13.9-3.3,26.9-9.3,38.4l153.8,95.4c13.8-25.8,40.7-43.4,71.7-43.4c45.1,0,81.5,37.1,81.5,82.8
            c0,45.7-36.5,82.8-81.5,82.8s-81.5-37.1-81.5-82.8l0.1-3.5L156.3,322.1c-13.7,10.5-30.7,16.7-49.1,16.7
            c-45.1,0-81.5-37.1-81.5-82.8s36.5-82.8,81.5-82.8c21.8,0,41.6,8.7,56.3,22.9l163.4-89.4c-2.2-7.5-3.4-15.5-3.4-23.8
            C323.4,37.1,359.8,0,404.9,0z M404.9,382.1c-25.4,0-46.1,21-46.1,47.1c0,26,20.7,47.1,46.1,47.1s46.1-21,46.1-47.1
            C451,403.1,430.3,382.1,404.9,382.1z M107.1,208.9c-25.4,0-46.1,21-46.1,47.1s20.7,47.1,46.1,47.1s46.1-21,46.1-47.1
            S132.5,208.9,107.1,208.9z M404.9,35.7c-25.4,0-46.1,21-46.1,47.1c0,26,20.7,47.1,46.1,47.1s46.1-21,46.1-47.1
            C451,56.8,430.3,35.7,404.9,35.7z"/>
        </g>
      </svg>
    {:else if $siteMode === 'light' }
      <svg  version="1.1"
            id="Layer_1"
            xmlns="http://www.w3.org/2000/svg"
            xmlns:xlink="http://www.w3.org/1999/xlink"
            x="0px" y="0px"
            viewBox="0 0 512 512"
            style="enable-background:new 0 0 512 512;width:15px;"
            class='light-mode'
            xml:space="preserve"
            >
        <g>
          <path d="M404.9,0c45.1,0,81.5,37.1,81.5,82.8c0,45.7-36.5,82.8-81.5,82.8c-24.2,0-46-10.7-60.9-27.7l-160.9,88.1
            c3.6,9.3,5.5,19.5,5.5,30.1c0,13.9-3.3,26.9-9.3,38.4l153.8,95.4c13.8-25.8,40.7-43.4,71.7-43.4c45.1,0,81.5,37.1,81.5,82.8
            c0,45.7-36.5,82.8-81.5,82.8s-81.5-37.1-81.5-82.8l0.1-3.5L156.3,322.1c-13.7,10.5-30.7,16.7-49.1,16.7
            c-45.1,0-81.5-37.1-81.5-82.8s36.5-82.8,81.5-82.8c21.8,0,41.6,8.7,56.3,22.9l163.4-89.4c-2.2-7.5-3.4-15.5-3.4-23.8
            C323.4,37.1,359.8,0,404.9,0z M404.9,382.1c-25.4,0-46.1,21-46.1,47.1c0,26,20.7,47.1,46.1,47.1s46.1-21,46.1-47.1
            C451,403.1,430.3,382.1,404.9,382.1z M107.1,208.9c-25.4,0-46.1,21-46.1,47.1s20.7,47.1,46.1,47.1s46.1-21,46.1-47.1
            S132.5,208.9,107.1,208.9z M404.9,35.7c-25.4,0-46.1,21-46.1,47.1c0,26,20.7,47.1,46.1,47.1s46.1-21,46.1-47.1
            C451,56.8,430.3,35.7,404.9,35.7z"/>
        </g>
      </svg>
    {/if}
  </div>
</button>






<!-- <div style='width: 2px;'></div> -->








