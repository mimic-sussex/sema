<script>

  import {
    isSaveOverlayVisible,
  } from  "../../stores/playground.js"

	import { onMount, onDestroy } from 'svelte';

  onMount( async () => {
    // engine = new Engine();
		console.log("save")
  });

  onDestroy( () => {
    // engine = null;
	});


</script>

<div  class="save-overlay-component"
      style='visibility:{ $isSaveOverlayVisible ? "visible": "hidden"}'
      >
  <svg class="box-icon" xmlns="http://www.w3.org/2000/svg" width="50" height="43" viewBox="0 0 50 43">
    <path d="M48.4 26.5c-.9 0-1.7.7-1.7 1.7v11.6h-43.3v-11.6c0-.9-.7-1.7-1.7-1.7s-1.7.7-1.7 1.7v13.2c0 .9.7 1.7 1.7 1.7h46.7c.9 0 1.7-.7 1.7-1.7v-13.2c0-1-.7-1.7-1.7-1.7zm-24.5 6.1c.3.3.8.5 1.2.5.4 0 .9-.2 1.2-.5l10-11.6c.7-.7.7-1.7 0-2.4s-1.7-.7-2.4 0l-7.1 8.3v-25.3c0-.9-.7-1.7-1.7-1.7s-1.7.7-1.7 1.7v25.3l-7.1-8.3c-.7-.7-1.7-.7-2.4 0s-.7 1.7 0 2.4l10 11.6z"></path>
  </svg>
  <p class="save-overlay-text"><span style="font-weight: 1500;">Choose your .json file</span> or <span>drag'n'drop it here to upload a new environment!</span></p>
  <button class="button-dark">Save</button>
  <button class="button-dark">Cancel</button>
</div>

<style>

  .save-overlay-component {
    width: 100%;
		height:100%;
    display:flex;
    justify-content:center;
    align-items:center;
    font-size:16px;
  }


</style>