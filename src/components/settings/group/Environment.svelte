<script>
  import {
    siteMode,
    fullScreen
  } from '../../../stores/common.js';

  import { isActive } from "@roxi/routify";
	// import { authStore } from '../../../auth'

	import {
    onMount,
    onDestroy
  } from 'svelte';

	import { supabase } from  "../../../db/client";

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
    items,
    // assignNewID,
    hydrateJSONcomponent,
    loadEnvironmentSnapshotEntries,
		uuid,
		name
  } from '../../../stores/playground.js'

  import * as doNotZip from 'do-not-zip';
	import downloadBlob from '../../../utils/downloadBlob.js';
// import { link } from 'fs';

  let handleClick = () => {
    window.localStorage["tutorial-" + new Date(Date.now()).toISOString()] = JSON.stringify($items)
  }

	const onNameChange = async () => {

		let updatedPlayground;
		try {
			updatedPlayground = await supabase
				.from('playgrounds')
				.update({
					name: $name,
					updated : new Date().toISOString()
				})
				.eq('id', $uuid)
		} catch (error) {
			console.error(error);
		}
		finally {

		}
	}


  function resetEnvironment(){
    $isUploadOverlayVisible = false;
    $isSaveOverlayVisible = false;
    $isDeleteOverlayVisible = true;
  }

  async function storeEnvironment(){

    $isUploadOverlayVisible = false;
    $isSaveOverlayVisible = true;
    $isDeleteOverlayVisible = false;
    // Add to playground history, e.g.
    // Key – playground-2020-03-02T15:48:31.080Z,
    // Value: [{"2":{"fixed":false,"resizable":true,"draggable":true,"min":{"w":1,"h":1},"max":{}, ...]

		// const name = "x1234",


		let updatedPlayground;
		try {
			updatedPlayground = await supabase
				.from('playgrounds')
				.update({
					name: $name,
					content: $items,
					updated : new Date().toISOString()
				})
				.eq('id', $uuid)
		} catch (error) {
			console.error(error);
		}
		finally {

		}


		// const isPublic = true,
		// 			created = new Date().toISOString(),
		// 			updated = created
		// 			;

		// const newPlayground = await supabase
		// 												.from('playgrounds')
		// 												.insert({
		// 													name: $name,
		// 													content: $items,
		// 													created,
		// 													updated,
		// 													isPublic
		// 												})

    loadEnvironmentSnapshotEntries();
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
		height: 2.4em;
    padding: 0.7em 1.2em 0.7em 1em;
		margin-top: 0.3em;
		margin-right: 0.3em;
		color: white;
		background:#212121;
		border: 0.5px solid #ffffff61;
	}

</style>

<input type="text"
				bind:value={ $name }
				on:change={ onNameChange }
        style="{( $isActive('/playground') )? `visibility:visible;`: `visibility:collapse`}; margin-left: 2px;"
				/>



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
        title="save environment"
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
        title="clear environment"
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
        title="download environment"
        style="padding: 0.2em 0.4em 0.8em 0.6em ! important;"
        on:click={ () => downloadEnvironment() }
        >
  <div class="icon-container">
    {#if $siteMode === 'dark' }
      <svg version="1.1"
            id="Capa_1"
            xmlns="http://www.w3.org/2000/svg"
            xmlns:xlink="http://www.w3.org/1999/xlink"
            x="0px" y="0px"
            viewBox="0 0 512 512"
            class="light-mode"
            style="enable-background:new 0 0 512 512; width: 24px; "
            xml:space="preserve"
            >
      <g>
        <path d="M266.052,350.322c-5.167-4.324-12.869-3.655-17.198,1.507l-8.104,9.654v-151.01
          c0-6.739-5.461-12.205-12.205-12.205c-6.744,0-12.205,5.466-12.205,12.205v151.016l-8.099-9.654
          c-4.329-5.156-12.02-5.842-17.198-1.507c-5.162,4.335-5.836,12.037-1.501,17.198l29.659,35.343
          c0.098,0.114,0.223,0.196,0.326,0.31c0.354,0.397,0.745,0.767,1.153,1.104c0.239,0.207,0.468,0.413,0.718,0.598
          c0.451,0.326,0.93,0.604,1.43,0.865c0.245,0.136,0.479,0.283,0.734,0.402c0.571,0.256,1.175,0.441,1.784,0.604
          c0.212,0.054,0.408,0.141,0.626,0.19c0.832,0.179,1.692,0.283,2.573,0.283c0.887,0,1.746-0.103,2.578-0.283
          c0.218-0.049,0.413-0.136,0.626-0.19c0.609-0.169,1.213-0.348,1.784-0.604c0.256-0.12,0.49-0.267,0.734-0.402
          c0.495-0.261,0.979-0.544,1.43-0.865c0.25-0.185,0.479-0.392,0.718-0.598c0.408-0.343,0.794-0.707,1.153-1.104
          c0.103-0.114,0.228-0.19,0.326-0.31l29.659-35.343C271.888,362.364,271.214,354.662,266.052,350.322z"/>
        <path d="M339.36,105.412c-4.525,0-9.051,0.337-13.538,0.984c-17.497-18.275-39.52-31.128-64.23-37.388
          c-0.326-0.087-0.653-0.158-0.979-0.218l-15.936-3.013c-19.499-24.383-49.011-38.71-80.52-38.71
          c-54.179,0-98.735,42.006-102.798,95.167C24.661,136.083,0,171.018,0,211.196c0,52.503,42.724,95.227,95.238,95.227
          c13.549,0,26.809-2.861,38.987-8.349c14.99,14.462,33.026,25.031,52.607,31.275v-34.696c-13.957-6.113-26.575-15.219-36.937-27.38
          c-3.193-3.747-7.762-5.722-12.396-5.722c-3.013,0-6.059,0.832-8.757,2.567c-9.975,6.38-21.566,9.747-33.51,9.747
          c-34.565,0-62.685-28.115-62.685-62.674c0-28.881,20.456-54.538,48.636-61.026c7.68-1.762,12.994-8.779,12.608-16.654
          l-0.109-1.741c-0.038-0.533-0.087-1.071-0.087-1.61c0-38.9,31.65-70.545,70.55-70.545c23.524,0,45.422,11.672,58.579,31.22
          c3.024,4.498,8.088,7.19,13.5,7.19c0.022,0,0.049,0,0.076,0l3.671-0.016l14.082,2.654c20.989,5.428,39.406,17.133,53.27,33.88
          c4.03,4.873,10.497,6.967,16.6,5.379c5.069-1.311,10.258-1.969,15.42-1.969c34.402,0,62.392,27.989,62.392,62.392
          s-27.989,62.381-62.392,62.381c-5.162,0-10.351-0.658-15.414-1.969c-6.113-1.588-12.581,0.517-16.6,5.374
          c-10.182,12.287-22.969,21.593-37.089,27.94v35.055c20.93-6.842,40.042-18.634,55.565-34.832
          c4.493,0.653,9.018,0.984,13.543,0.984c52.351,0,94.944-42.588,94.944-94.933C434.304,148,391.711,105.412,339.36,105.412z"/>
      </g>
      </svg>
    {:else if $siteMode === 'light' }
      <svg version="1.1"
            id="Capa_1"
            xmlns="http://www.w3.org/2000/svg"
            xmlns:xlink="http://www.w3.org/1999/xlink"
            x="0px" y="0px"
            viewBox="0 0 512 512"
            class="light-mode"
            style="enable-background:new 0 0 512 512; width: 24px;"
            xml:space="preserve"
            >
        <g>
          <path d="M266.052,350.322c-5.167-4.324-12.869-3.655-17.198,1.507l-8.104,9.654v-151.01
            c0-6.739-5.461-12.205-12.205-12.205c-6.744,0-12.205,5.466-12.205,12.205v151.016l-8.099-9.654
            c-4.329-5.156-12.02-5.842-17.198-1.507c-5.162,4.335-5.836,12.037-1.501,17.198l29.659,35.343
            c0.098,0.114,0.223,0.196,0.326,0.31c0.354,0.397,0.745,0.767,1.153,1.104c0.239,0.207,0.468,0.413,0.718,0.598
            c0.451,0.326,0.93,0.604,1.43,0.865c0.245,0.136,0.479,0.283,0.734,0.402c0.571,0.256,1.175,0.441,1.784,0.604
            c0.212,0.054,0.408,0.141,0.626,0.19c0.832,0.179,1.692,0.283,2.573,0.283c0.887,0,1.746-0.103,2.578-0.283
            c0.218-0.049,0.413-0.136,0.626-0.19c0.609-0.169,1.213-0.348,1.784-0.604c0.256-0.12,0.49-0.267,0.734-0.402
            c0.495-0.261,0.979-0.544,1.43-0.865c0.25-0.185,0.479-0.392,0.718-0.598c0.408-0.343,0.794-0.707,1.153-1.104
            c0.103-0.114,0.228-0.19,0.326-0.31l29.659-35.343C271.888,362.364,271.214,354.662,266.052,350.322z"/>
          <path d="M339.36,105.412c-4.525,0-9.051,0.337-13.538,0.984c-17.497-18.275-39.52-31.128-64.23-37.388
            c-0.326-0.087-0.653-0.158-0.979-0.218l-15.936-3.013c-19.499-24.383-49.011-38.71-80.52-38.71
            c-54.179,0-98.735,42.006-102.798,95.167C24.661,136.083,0,171.018,0,211.196c0,52.503,42.724,95.227,95.238,95.227
            c13.549,0,26.809-2.861,38.987-8.349c14.99,14.462,33.026,25.031,52.607,31.275v-34.696c-13.957-6.113-26.575-15.219-36.937-27.38
            c-3.193-3.747-7.762-5.722-12.396-5.722c-3.013,0-6.059,0.832-8.757,2.567c-9.975,6.38-21.566,9.747-33.51,9.747
            c-34.565,0-62.685-28.115-62.685-62.674c0-28.881,20.456-54.538,48.636-61.026c7.68-1.762,12.994-8.779,12.608-16.654
            l-0.109-1.741c-0.038-0.533-0.087-1.071-0.087-1.61c0-38.9,31.65-70.545,70.55-70.545c23.524,0,45.422,11.672,58.579,31.22
            c3.024,4.498,8.088,7.19,13.5,7.19c0.022,0,0.049,0,0.076,0l3.671-0.016l14.082,2.654c20.989,5.428,39.406,17.133,53.27,33.88
            c4.03,4.873,10.497,6.967,16.6,5.379c5.069-1.311,10.258-1.969,15.42-1.969c34.402,0,62.392,27.989,62.392,62.392
            s-27.989,62.381-62.392,62.381c-5.162,0-10.351-0.658-15.414-1.969c-6.113-1.588-12.581,0.517-16.6,5.374
            c-10.182,12.287-22.969,21.593-37.089,27.94v35.055c20.93-6.842,40.042-18.634,55.565-34.832
            c4.493,0.653,9.018,0.984,13.543,0.984c52.351,0,94.944-42.588,94.944-94.933C434.304,148,391.711,105.412,339.36,105.412z"/>
        </g>
      </svg>
    {/if}
  </div>
</button>


<button class="{ $siteMode === 'dark'? 'button-dark' :'button-light' }"
        title="upload environment"
        style="{( $isActive('/playground') ) ? `visibility:visible;`: `visibility:collapse`}; padding: 0.2em 0.4em 0.8em 0.6em ! important;"
        on:click={ () => uploadEnvironment() }
        >
  <div class="icon-container">
    {#if $siteMode === 'dark' }
      <svg version="1.1"
            id="Capa_1"
            xmlns="http://www.w3.org/2000/svg"
            xmlns:xlink="http://www.w3.org/1999/xlink"
            x="0px" y="0px"
            viewBox="0 0 512 512"
            class="light-mode"
            style="enable-background:new 0 0 512 512; width: 130px"
            xml:space="preserve"
            >
        <g>
          <path d="M50.283,44.999l-5.453-6.498c-0.016-0.019-0.038-0.032-0.055-0.051c-0.086-0.095-0.178-0.18-0.278-0.259
            c-0.012-0.01-0.022-0.021-0.036-0.029c-0.377-0.286-0.841-0.463-1.351-0.463c-0.511,0-0.974,0.177-1.351,0.463
            c-0.013,0.009-0.023,0.019-0.037,0.029c-0.099,0.079-0.192,0.164-0.276,0.259c-0.017,0.019-0.039,0.032-0.056,0.051l-5.453,6.498
            c-0.797,0.948-0.673,2.364,0.276,3.162c0.95,0.795,2.366,0.672,3.162-0.277l1.49-1.774v27.765c0,1.239,1.004,2.244,2.244,2.244
            c1.239,0,2.243-1.005,2.243-2.244V46.108l1.49,1.775c0.443,0.528,1.08,0.801,1.721,0.801c0.508,0,1.021-0.172,1.44-0.523
            C50.956,47.362,51.08,45.947,50.283,44.999z"/>
          <path d="M62.393,18.133c-0.832,0-1.664,0.062-2.489,0.181c-3.216-3.36-7.267-5.723-11.81-6.874
            c-0.059-0.016-0.119-0.029-0.18-0.04l-2.93-0.554c-3.584-4.482-9.01-7.117-14.803-7.117c-9.962,0-18.153,7.723-18.9,17.496
            C4.534,23.771,0,30.194,0,37.582c0,9.653,7.854,17.507,17.509,17.507c2.491,0,4.93-0.525,7.169-1.535
            c3.032,2.925,6.745,4.978,10.766,6.062v-6.255c-3.007-1.095-5.712-2.921-7.884-5.47c-0.587-0.69-1.427-1.053-2.279-1.053
            c-0.554,0-1.114,0.153-1.611,0.473c-1.834,1.173-3.964,1.792-6.161,1.792c-6.355,0-11.525-5.169-11.525-11.523
            c0-5.31,3.761-10.027,8.943-11.219c1.412-0.325,2.389-1.615,2.318-3.063l-0.02-0.32c-0.006-0.098-0.015-0.197-0.015-0.297
            c0-7.152,5.819-12.97,12.971-12.97c4.325,0,8.351,2.146,10.77,5.74c0.557,0.827,1.486,1.322,2.482,1.322c0.004,0,0.008,0,0.014,0
            l0.675-0.003l2.589,0.488c3.858,0.998,7.245,3.15,9.794,6.229c0.741,0.896,1.931,1.281,3.052,0.989
            c0.933-0.241,1.887-0.362,2.836-0.362c6.324,0,11.471,5.146,11.471,11.471c0,6.325-5.146,11.468-11.471,11.468
            c-0.949,0-1.903-0.121-2.834-0.361c-1.125-0.292-2.313,0.095-3.053,0.988c-1.605,1.938-3.564,3.474-5.726,4.613v6.59
            c3.419-1.297,6.542-3.332,9.123-6.025c0.825,0.12,1.657,0.182,2.489,0.182c9.625,0,17.455-7.83,17.455-17.455
            C79.848,25.963,72.016,18.133,62.393,18.133z"
            />
        </g>
      </svg>
    {:else if $siteMode === 'light' }
      <svg version="1.1"
            id="Capa_1"
            xmlns="http://www.w3.org/2000/svg"
            xmlns:xlink="http://www.w3.org/1999/xlink"
            x="0px" y="0px"
            viewBox="0 0 512 512"
            style="enable-background:new 0 0 512 512; width:130px"
            xml:space="preserve"
            >
        <g>
          <g>
            <path d="M50.283,44.999l-5.453-6.498c-0.016-0.019-0.038-0.032-0.055-0.051c-0.086-0.095-0.178-0.18-0.278-0.259
              c-0.012-0.01-0.022-0.021-0.036-0.029c-0.377-0.286-0.841-0.463-1.351-0.463c-0.511,0-0.974,0.177-1.351,0.463
              c-0.013,0.009-0.023,0.019-0.037,0.029c-0.099,0.079-0.192,0.164-0.276,0.259c-0.017,0.019-0.039,0.032-0.056,0.051l-5.453,6.498
              c-0.797,0.948-0.673,2.364,0.276,3.162c0.95,0.795,2.366,0.672,3.162-0.277l1.49-1.774v27.765c0,1.239,1.004,2.244,2.244,2.244
              c1.239,0,2.243-1.005,2.243-2.244V46.108l1.49,1.775c0.443,0.528,1.08,0.801,1.721,0.801c0.508,0,1.021-0.172,1.44-0.523
              C50.956,47.362,51.08,45.947,50.283,44.999z"/>
            <path d="M62.393,18.133c-0.832,0-1.664,0.062-2.489,0.181c-3.216-3.36-7.267-5.723-11.81-6.874
              c-0.059-0.016-0.119-0.029-0.18-0.04l-2.93-0.554c-3.584-4.482-9.01-7.117-14.803-7.117c-9.962,0-18.153,7.723-18.9,17.496
              C4.534,23.771,0,30.194,0,37.582c0,9.653,7.854,17.507,17.509,17.507c2.491,0,4.93-0.525,7.169-1.535
              c3.032,2.925,6.745,4.978,10.766,6.062v-6.255c-3.007-1.095-5.712-2.921-7.884-5.47c-0.587-0.69-1.427-1.053-2.279-1.053
              c-0.554,0-1.114,0.153-1.611,0.473c-1.834,1.173-3.964,1.792-6.161,1.792c-6.355,0-11.525-5.169-11.525-11.523
              c0-5.31,3.761-10.027,8.943-11.219c1.412-0.325,2.389-1.615,2.318-3.063l-0.02-0.32c-0.006-0.098-0.015-0.197-0.015-0.297
              c0-7.152,5.819-12.97,12.971-12.97c4.325,0,8.351,2.146,10.77,5.74c0.557,0.827,1.486,1.322,2.482,1.322c0.004,0,0.008,0,0.014,0
              l0.675-0.003l2.589,0.488c3.858,0.998,7.245,3.15,9.794,6.229c0.741,0.896,1.931,1.281,3.052,0.989
              c0.933-0.241,1.887-0.362,2.836-0.362c6.324,0,11.471,5.146,11.471,11.471c0,6.325-5.146,11.468-11.471,11.468
              c-0.949,0-1.903-0.121-2.834-0.361c-1.125-0.292-2.313,0.095-3.053,0.988c-1.605,1.938-3.564,3.474-5.726,4.613v6.59
              c3.419-1.297,6.542-3.332,9.123-6.025c0.825,0.12,1.657,0.182,2.489,0.182c9.625,0,17.455-7.83,17.455-17.455
              C79.848,25.963,72.016,18.133,62.393,18.133z"/>
          </g>
        </g>
      </svg>
    {/if}
  </div>
</button>


        <!-- style="{ $fullScreen? `visibility:visible;`: `visibility:hidden`}; padding: 0.25em 0.3em 0.75em 0.7em;" -->
<!-- SHARE -->
<button class="{ $siteMode === 'dark'? 'button-dark' :'button-light' }"
        title="share environment"
        style="padding: 0.25em 0.3em 0.75em 0.7em;"
        on:click={ handleClick }>
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








