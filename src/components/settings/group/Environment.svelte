<script>
  import {
    siteMode
  } from '../../../stores/common.js';

  import { isActive, goto, url, params } from "@roxi/routify";

	import {
    onMount,
    onDestroy
  } from 'svelte';

	import {
		updatePlayground,
    forkPlayground,
    savePlayground
  } from  "../../../db/client";
  

  import { Engine } from 'sema-engine';

  let engine,
      engineLoaded = false
      ;


  import {
    loadEnvironmentOptions,
    selectedLoadEnvironmentOption,
    isLoadEnvironmentOptionsDisabled,
    isSaveOverlayVisible,
    isUploadOverlayVisible,
    isDeleteOverlayVisible,
    isClearOverlayVisible,
    isNewOverlayVisible,
    isShareOverlayVisible,
    isDoesNotExistOverlayVisible,
    isProjectBrowserOverlayVisible,
    items,
    hydrateJSONcomponent,
    loadEnvironmentSnapshotEntries,
		uuid,
    name,
    allowEdits,
    isPublic,
  } from '../../../stores/playground'

  import {
    user,
    loggedIn
  } from '../../../stores/user'

  import * as doNotZip from 'do-not-zip';
	import downloadBlob from '../../../utils/downloadBlob.js';

  let handleClick = () => {
    window.localStorage["tutorial-" + new Date(Date.now()).toISOString()] = JSON.stringify($items)
  }

  // Toggles given overlay switch all others off.
  function toggleOverlay(overlay){
    // //set all to false
    $isSaveOverlayVisible = false;
    $isUploadOverlayVisible = false;
    $isDeleteOverlayVisible = false;
    $isClearOverlayVisible = false;
    $isNewOverlayVisible = false;
    $isShareOverlayVisible = false;
    $isDoesNotExistOverlayVisible = false;
    $isProjectBrowserOverlayVisible = false

    //set given overlay to true
    if (overlay == 'save'){
      $isSaveOverlayVisible = true;
    } else if (overlay == 'upload'){
      $isUploadOverlayVisible = true;
    } else if (overlay == 'delete'){
      $isDeleteOverlayVisible = true;
    } else if (overlay == 'clear'){
      $isClearOverlayVisible = true;
    } else if (overlay == 'new'){
      $isNewOverlayVisible = true;
    } else if (overlay == 'share'){
      $isShareOverlayVisible = !$isShareOverlayVisible;
    } else if (overlay == 'doesNotExist'){
      $isDoesNotExistOverlayVisible = true;
    } else if (overlay == 'projectBrowser'){
      $isProjectBrowserOverlayVisible = true;
    } else {
      console.error('cant launch overlay', overlay);
    }
    // console.log('overlay states', overlayStates);
  }

  //Project browser seperate from toggleOverlay since project browser must be able to open and close from the launch button.
  function toggleProjectBrowser () {
    $isSaveOverlayVisible = false;
    $isUploadOverlayVisible = false;
    $isDeleteOverlayVisible = false;
    $isClearOverlayVisible = false;
    $isNewOverlayVisible = false;
    $isShareOverlayVisible = false;
    // $isDoesNotExistOverlayVisible = false;
    if($isProjectBrowserOverlayVisible == true){
      $isProjectBrowserOverlayVisible = false;
    } else {
      $isProjectBrowserOverlayVisible = true;
    }
  }

  // On project name change, update the database
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

    //make sure playground is saved
    await savePlayground($uuid, $name, $items, $allowEdits, $user)

    if ($uuid){
      
      let fork = await forkPlayground($uuid);
      $uuid = fork.id;
      $name = fork.name;
      $items = fork.content.map(item => hydrateJSONcomponent(item));
      $goto($url(`/playground/${$uuid}`)); // reload page because otherwise the no changes allowed link is still there.
      // window.history.pushState("", "", `/playground/${$uuid}`); //changes the url without realoading;
    }
    else
      throw new Error ('Cant find UUID for project')
  }


  // for loading local environments.
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

  

  //Download environment as .zip
  function downloadEnvironmentAsZip(){

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

  // Download environment as .json
  function downloadEnvironment(){
    let filename;
    if ($name != null) {
      filename = $name;
    } else {
      filename = "playground";
    }

    let timestamp = new Date().toISOString();

    const blob = new Blob(
      [ JSON.stringify($items) ], 
      { type: 'text/json;charset=utf-8' }
    );   
    downloadBlob(blob, `${filename}` + '-' + `${timestamp}` + '.json')
  }

  onMount( async () => {
    engine = new Engine();

  });

  onDestroy( () => {
    engine = null;
	});

</script>

<style>

.icon-container {
    /* width: 10px; */
    /* height: 10px; */
    /* display:flex; */

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
    background-color: #212529;
    border-radius:5px;
    box-shadow: inset 0.25px 0.25px 0.1px 0 #201f1f, inset -0.25px -0.25px 0.1px 0 rgba(255, 255, 255, 0.05);
  }

  .button-light {
		padding: 20;
		color: grey;
		border: none;
    width: 42px;
  	margin: 8px 8px 8px 8px;
  	border-radius: 5px;
  	background-color: #fdf6e3;
	}

  .button-light:hover {
    color: black;
  }

  .button-light:active{
    color: black;
    background-color: grey;
  }

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

	input {
		resize: none;
		white-space: nowrap;
		overflow-x: scroll;
		height: 2.0em;
    padding: 0.7em 1.2em 0.7em 1.5em;
		margin-top: 0.55em;
		margin-right: 0.3em;
    margin: 8px 8px 8px 8px;
		color: #ccc;
		background:#262a2e;
		/* border: 0.1px solid #999; */
    border:0.1px solid transparent;
    font-size: medium;
    border-radius:5px;
    /* box-shadow: inset 0.25px 0.25px 0.1px 0 #201f1f, inset -0.25px -0.25px 0.1px 0 rgba(255, 255, 255, 0.05); */
    box-shadow: inset 1px 1px 1px 0 #201f1f, inset -1px -1px 1px 0 rgba(255, 255, 255, 0.05);
    /* border:none; */
    /* box-shadow: 2px 2px 3px rgb(0 0 0), -0.5px -0.5px 3px #ffffff61; */
  }

  input:hover{
    color:white;
    border: 0.1px solid #999;
  }

  input:hover + .dropdown-button-dark {
    /* border-left: 0.1px solid #999; */
    border-right: 0.1px solid #999;
    border-top: 0.1px solid #999;
    border-bottom: 0.1px solid #999;
  }

  input:active{
    color:white;
  }

  input:focus {
    background-color: #181a1d;
  }

  input:disabled {
    cursor:not-allowed;
    border:none;
  }
  

  .dropdown-button-dark {
    width: 42px;
    height: 1.75em;
    font-family: sans-serif;
    font-weight: 400;
    cursor: pointer;
    color: #ccc;
    line-height: 1.3;
    max-width: 100%;
    box-sizing: border-box;
    /* border: 0.1px solid #999; */
    border:0.1px solid transparent;
    /* text-align: left; */
    /* margin-top:0.50em;
    margin-right: 5px; */
    margin: 8px 8px 8px 8px;
    padding:0;
    background-color:  #262a2e;
    z-index:1;
    border-radius: 0px 5px 5px 0px;
    box-shadow: inset 1px 1px 1px 0 #201f1f, inset -1px -1px 1px 0 rgba(255, 255, 255, 0.05);
  }

  .dropdown-button-dark:active{
    color: white;
    background-color: #212529;
    border-radius: 0px 5px 5px 0px;
    box-shadow: inset 0.25px 0.25px 0.1px 0 #201f1f, inset -0.25px -0.25px 0.1px 0 rgba(255, 255, 255, 0.05);
  }

  .dropdown-button-dark:hover{
    color:white;
    border: 0.1px solid #999;
  }

  .playground-visibility-icon {
    height: 2.3em;
    margin-right: -24px;
    z-index: 1;
    padding-top:4px;
    color: #ccc;
    /* position:absolute; */
  }
  

</style>



<!-- LOCAL SAVE DROPDOWN SELECTOR -->
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

<!-- NEW -->
{#if !$isDoesNotExistOverlayVisible} <!--If project doesnt exist don't show these buttons-->
  {#if $user}
  <button class="{ $siteMode === 'dark'? 'button-dark' :'button-light' }"
          title="new project"
          style="{( $isActive('/playground') )? `visibility:visible;`: `visibility:collapse`}; margin-left: 2px;"
          on:click={ () => toggleOverlay('new') }
          >
    <div class="icon-container">
      {#if $siteMode === 'dark' }
        <!-- CLOUD PLUS ICON -->
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-cloud-plus" viewBox="0 0 16 16">
          <path fill-rule="evenodd" d="M8 5.5a.5.5 0 0 1 .5.5v1.5H10a.5.5 0 0 1 0 1H8.5V10a.5.5 0 0 1-1 0V8.5H6a.5.5 0 0 1 0-1h1.5V6a.5.5 0 0 1 .5-.5z"/>
          <path d="M4.406 3.342A5.53 5.53 0 0 1 8 2c2.69 0 4.923 2 5.166 4.579C14.758 6.804 16 8.137 16 9.773 16 11.569 14.502 13 12.687 13H3.781C1.708 13 0 11.366 0 9.318c0-1.763 1.266-3.223 2.942-3.593.143-.863.698-1.723 1.464-2.383zm.653.757c-.757.653-1.153 1.44-1.153 2.056v.448l-.445.049C2.064 6.805 1 7.952 1 9.318 1 10.785 2.23 12 3.781 12h8.906C13.98 12 15 10.988 15 9.773c0-1.216-1.02-2.228-2.313-2.228h-.5v-.5C12.188 4.825 10.328 3 8 3a4.53 4.53 0 0 0-2.941 1.1z"/>
        </svg>
      {:else if $siteMode === 'light' }
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-cloud-plus" viewBox="0 0 16 16">
          <path fill-rule="evenodd" d="M8 5.5a.5.5 0 0 1 .5.5v1.5H10a.5.5 0 0 1 0 1H8.5V10a.5.5 0 0 1-1 0V8.5H6a.5.5 0 0 1 0-1h1.5V6a.5.5 0 0 1 .5-.5z"/>
          <path d="M4.406 3.342A5.53 5.53 0 0 1 8 2c2.69 0 4.923 2 5.166 4.579C14.758 6.804 16 8.137 16 9.773 16 11.569 14.502 13 12.687 13H3.781C1.708 13 0 11.366 0 9.318c0-1.763 1.266-3.223 2.942-3.593.143-.863.698-1.723 1.464-2.383zm.653.757c-.757.653-1.153 1.44-1.153 2.056v.448l-.445.049C2.064 6.805 1 7.952 1 9.318 1 10.785 2.23 12 3.781 12h8.906C13.98 12 15 10.988 15 9.773c0-1.216-1.02-2.228-2.313-2.228h-.5v-.5C12.188 4.825 10.328 3 8 3a4.53 4.53 0 0 0-2.941 1.1z"/>
        </svg>
      {/if}
    </div>
  </button>
  {/if}

  <!-- CLEAR -->
  <button class="{ $siteMode === 'dark'? 'button-dark' :'button-light' }"
          title="clear project"
          style="{ ( $isActive('/playground') ) ? `visibility:visible;`: `visibility:collapse`}"
          on:click={ () => toggleOverlay('clear') }
          >
    <div class="icon-container">
      {#if $siteMode === 'dark' }
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-x-lg" viewBox="0 0 16 16">
          <path fill-rule="evenodd" d="M13.854 2.146a.5.5 0 0 1 0 .708l-11 11a.5.5 0 0 1-.708-.708l11-11a.5.5 0 0 1 .708 0Z"/>
          <path fill-rule="evenodd" d="M2.146 2.146a.5.5 0 0 0 0 .708l11 11a.5.5 0 0 0 .708-.708l-11-11a.5.5 0 0 0-.708 0Z"/>
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

  <!-- DOWNLOAD BUTTON -->
  <button class="{ $siteMode === 'dark'? 'button-dark' :'button-light' }"
          title="download project"
          style="{( $isActive('/playground') ) ? `visibility:visible;`: `visibility:collapse`};"
          on:click={ () => downloadEnvironment() }
          >
    <div class="icon-container">
      {#if $siteMode === 'dark' }
        <svg xmlns="http://www.w3.org/2000/svg" 
        width="18" 
        height="18" 
        fill="currentColor" 
        class="bi bi-download" 
        viewBox="0 0 16 16">
          <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
          <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
        </svg>
      {:else if $siteMode === 'light' }
        <svg xmlns="http://www.w3.org/2000/svg" 
        width="18" 
        height="18" 
        fill="currentColor" 
        class="bi bi-download" 
        viewBox="0 0 16 16">
          <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
          <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
        </svg>
      {/if}
    </div>
  </button>

  <!-- UPLOAD -->
  <button class="{ $siteMode === 'dark'? 'button-dark' :'button-light' }"
          title="upload project"
          style="{( $isActive('/playground') ) ? `visibility:visible;`: `visibility:collapse`};"
          on:click={ () => toggleOverlay('upload') }
          >
    <div class="icon-container">
      {#if $siteMode === 'dark' }
        <svg xmlns="http://www.w3.org/2000/svg" 
        width="16" 
        height="16" 
        fill="currentColor" 
        class="bi bi-upload" 
        viewBox="0 0 16 16">
          <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
          <path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708l3-3z"/>
        </svg>  
      {:else if $siteMode === 'light' }
        <svg xmlns="http://www.w3.org/2000/svg" 
        width="16" 
        height="16" 
        fill="currentColor" 
        class="bi bi-upload" 
        viewBox="0 0 16 16">
          <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
          <path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708l3-3z"/>
        </svg>  
      {/if}
    </div>
  </button>

  <!-- FORK -->
  {#if $user} <!--if there is a user logged in-->
    <button id='fork-button' class="{ $siteMode === 'dark'? 'button-dark' :'button-light' }"
            title="fork project (make a copy)"
            style="{( $isActive('/playground') ) ? `visibility:visible;`: `visibility:collapse`};"
            on:click={ () => forkProject() }
            >
      <div class="icon-container">
        {#if $siteMode === 'dark' }
          <svg aria-hidden="true" 
          height="16" 
          viewBox="0 0 16 16" 
          version="1.1"
          width="16"
          fill="currentColor" 
          data-view-component="true" 
          class="fork-icon"
          >
            <path fill-rule="evenodd" d="M5 3.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm0 2.122a2.25 2.25 0 10-1.5 0v.878A2.25 2.25 0 005.75 8.5h1.5v2.128a2.251 2.251 0 101.5 0V8.5h1.5a2.25 2.25 0 002.25-2.25v-.878a2.25 2.25 0 10-1.5 0v.878a.75.75 0 01-.75.75h-4.5A.75.75 0 015 6.25v-.878zm3.75 7.378a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm3-8.75a.75.75 0 100-1.5.75.75 0 000 1.5z"></path>
          </svg>
        
        {:else if $siteMode === 'light' }
          <svg aria-hidden="true" 
          height="16" 
          viewBox="0 0 16 16" 
          version="1.1"
          width="16"
          fill="currentColor" 
          data-view-component="true" 
          class="fork-icon"
          >
            <path fill-rule="evenodd" d="M5 3.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm0 2.122a2.25 2.25 0 10-1.5 0v.878A2.25 2.25 0 005.75 8.5h1.5v2.128a2.251 2.251 0 101.5 0V8.5h1.5a2.25 2.25 0 002.25-2.25v-.878a2.25 2.25 0 10-1.5 0v.878a.75.75 0 01-.75.75h-4.5A.75.75 0 015 6.25v-.878zm3.75 7.378a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm3-8.75a.75.75 0 100-1.5.75.75 0 000 1.5z"></path>
          </svg>

        {/if}
      </div>
    </button>
  {/if}

  <!-- SHARE -->
  {#if $params.playgroundId} <!-- if there is a playground uuid in the adress.-->
    <button class="{ $siteMode === 'dark'? 'button-dark' :'button-light' }"
            title="share project"
            style="{( $isActive('/playground') ) ? `visibility:visible;`: `visibility:collapse`};"
            on:click={ () => toggleOverlay('share') }>
      <div class="icon-container">
        {#if $siteMode === 'dark' }
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-share" viewBox="0 0 16 16">
          <path d="M13.5 1a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM11 2.5a2.5 2.5 0 1 1 .603 1.628l-6.718 3.12a2.499 2.499 0 0 1 0 1.504l6.718 3.12a2.5 2.5 0 1 1-.488.876l-6.718-3.12a2.5 2.5 0 1 1 0-3.256l6.718-3.12A2.5 2.5 0 0 1 11 2.5zm-8.5 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm11 5.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/>
        </svg>
        {:else if $siteMode === 'light' }
          <svg  version="1.1"
                id="Layer_1"
                xmlns="http://www.w3.org/2000/svg"
                xmlns:xlink="http://www.w3.org/1999/xlink"
                x="0px" y="0px"
                viewBox="0 0 512 512"
                style="enable-background:new 0 0 512 512;width:15px;"
                fill="currentColor"
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
  {/if}
{/if}

<!--NAME PROJECT TEXT BOX-->
{#if $isPublic && $isActive(`/playground`)}
  <svg xmlns="http://www.w3.org/2000/svg" 
    width="16" 
    height="16" 
    fill="currentColor" 
    class="playground-visibility-icon" 
    style=""
    viewBox="0 0 16 16" 
    >
      <title>Public. This project will appear in the 'All Projects' tab.</title>
      <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm7.5-6.923c-.67.204-1.335.82-1.887 1.855A7.97 7.97 0 0 0 5.145 4H7.5V1.077zM4.09 4a9.267 9.267 0 0 1 .64-1.539 6.7 6.7 0 0 1 .597-.933A7.025 7.025 0 0 0 2.255 4H4.09zm-.582 3.5c.03-.877.138-1.718.312-2.5H1.674a6.958 6.958 0 0 0-.656 2.5h2.49zM4.847 5a12.5 12.5 0 0 0-.338 2.5H7.5V5H4.847zM8.5 5v2.5h2.99a12.495 12.495 0 0 0-.337-2.5H8.5zM4.51 8.5a12.5 12.5 0 0 0 .337 2.5H7.5V8.5H4.51zm3.99 0V11h2.653c.187-.765.306-1.608.338-2.5H8.5zM5.145 12c.138.386.295.744.468 1.068.552 1.035 1.218 1.65 1.887 1.855V12H5.145zm.182 2.472a6.696 6.696 0 0 1-.597-.933A9.268 9.268 0 0 1 4.09 12H2.255a7.024 7.024 0 0 0 3.072 2.472zM3.82 11a13.652 13.652 0 0 1-.312-2.5h-2.49c.062.89.291 1.733.656 2.5H3.82zm6.853 3.472A7.024 7.024 0 0 0 13.745 12H11.91a9.27 9.27 0 0 1-.64 1.539 6.688 6.688 0 0 1-.597.933zM8.5 12v2.923c.67-.204 1.335-.82 1.887-1.855.173-.324.33-.682.468-1.068H8.5zm3.68-1h2.146c.365-.767.594-1.61.656-2.5h-2.49a13.65 13.65 0 0 1-.312 2.5zm2.802-3.5a6.959 6.959 0 0 0-.656-2.5H12.18c.174.782.282 1.623.312 2.5h2.49zM11.27 2.461c.247.464.462.98.64 1.539h1.835a7.024 7.024 0 0 0-3.072-2.472c.218.284.418.598.597.933zM10.855 4a7.966 7.966 0 0 0-.468-1.068C9.835 1.897 9.17 1.282 8.5 1.077V4h2.355z"/>
  </svg>
{:else if !$isPublic && $isActive(`/playground`)}
  <svg xmlns="http://www.w3.org/2000/svg" 
    width="16" 
    height="16" 
    fill="currentColor" 
    class="playground-visibility-icon" 
    style=""
    viewBox="0 0 16 16" 
    >
      <title>Private. This project will only appear in the 'My Projects' tab.</title>
      <path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM5 8h6a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/>
  </svg>
{/if}

{#if $params.playgroundId} 
  <input type="text"
          bind:value={ $name }
          on:change={ onNameChange }
          placeholder='Choose a project!'
          style="{( $isActive(`/playground`) )? `visibility:visible;`: `visibility:collapse`}; margin-left: 2px;"
          disabled={!$user}
          />

  <!-- Project browser launcher -->
  <button 
  id = 'project-browser-launcher-button'
  class="{ $siteMode === 'dark'? 'dropdown-button-dark' :'button-light' }"
  title="project browser"
  style="{( $isActive('/playground') )? `visibility:visible;`: `visibility:collapse`};
  {($isProjectBrowserOverlayVisible)? 'background-color: #181a1d;' :''}
  margin-left: -50px;"
  on:click={ () => toggleProjectBrowser()}>

    <div id='project-browser-launcher-button' class='icon-container' style='margin-top:5px;'>
      <svg xmlns="http://www.w3.org/2000/svg" 
      width="16" 
      height="16" 
      fill="currentColor" 
      class="bi bi-chevron-down" 
      id = 'project-browser-launcher-button'
      viewBox="0 0 16 16"
      style='{ ($isProjectBrowserOverlayVisible)? 'transform: rotate(180deg); transition: 0.3s;' :'transform: rotate(0deg); transition: 0.1s;'}'
      >
        <path fill-rule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/>
      </svg>
    </div>
  </button>
{/if}
