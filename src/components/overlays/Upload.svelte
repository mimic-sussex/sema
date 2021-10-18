<script>

  import {
    items,
    focusedItemProperties,
    isUploadOverlayVisible,
    hydrateJSONcomponent,
  } from  "../../stores/playground.js"

	import { onMount, onDestroy } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  
  function closeOverlay(){
    $isUploadOverlayVisible = false;
  }

  function readJSONFileToItems(file){

  }

  function handleDragDrop(e) {
    try {
      e.preventDefault();
      let reader = new FileReader();
      reader.readAsText(e.dataTransfer.files[0]);
      reader.onload = e => $items = JSON.parse(e.target.result).map(item => hydrateJSONcomponent(item));
      $isUploadOverlayVisible = false;
    } catch (error) {

    }
  }

  function handleDragEnter(e){  }

  function handleSelectJSONFile(e){
    try{
      const input = document.querySelector("input[type=file]");
      let reader = new FileReader();
      reader.readAsText(input.files[0]);
      reader.onloadend = e => {
        $items = JSON.parse( reader.result ).map( item => hydrateJSONcomponent(item) );
        input.value = "";
        input.type = 'file';
        input.accept = '.json';
      }
      $isUploadOverlayVisible = false;
    }
    catch(err){

    }
  }

  onMount( async () => {
    // engine = new Engine();
		console.log("upload")
  });

  onDestroy( () => {
    // engine = null;
	});

</script>

<div  in:fly="{{ y: 200, duration: 300 }}" out:fade
      class="upload-overlay-component"
      style='visibility:{ $isUploadOverlayVisible ? "visible": "hidden"}'
      on:drop={ handleDragDrop }
      on:dragenter={ handleDragEnter }
      ondragover="return false"
      >
      <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" fill="currentColor" class="bi bi-upload" viewBox="0 0 16 16">
        <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
        <path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708l3-3z"/>
      </svg>

  <p class="upload-overlay-text">
    <label  class="label-underline"
            for="file-input"
            >Choose your .json file
    </label>
    <input  type="file"
            id="file-input"
            accept=".json"
            on:change={ handleSelectJSONFile }
            > or drag'n'drop it here to upload a new environment!
  </p>

  <div class="upload-overlay-button-container">
    <button class="button-dark"
            on:click={ closeOverlay }
            >Cancel</button>
	</div>
</div>

<style>



  .label-underline{
    text-decoration: underline;
		display: inline-flex;

  }

  #file-input {
    display: none;
  }

  .light-mode {
    fill: rgb(133, 130, 130);
    enable-background:new 0 0 512 512;
    padding-bottom:3px;
    width: 15px;
  }

  .upload-overlay-component {
    width: 100%;
		height:100%;
    display:flex;
    justify-content:center;
    align-items:center;
		flex-direction:column;
    font-size:16px;
  }

  .upload-overlay-text {
    /* top:50%; */

    /* width: 100%; */
    /* position: absolute; */
    color: #FFF;
  }

  .upload-overlay-button-container {
    display: inline-flex;
  }

  .button-dark {
    width: 5.5em;
    height: 2.5em;
    padding: 0.2em 0.2em 0.8em 0.8em;
    display: block;
    /* font-size: 12px; */
    font-family: sans-serif;
    font-weight: 400;
    cursor: pointer;
    color:white;

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

</style>
