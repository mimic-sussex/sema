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

</style>
