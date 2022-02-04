<script>

  import {
    isDeleteAccountOverlayVisible,
  } from '../../stores/profile.js';

  import {
    deleteAccount
	} from '../../db/client';

  import { onMount, onDestroy } from 'svelte';
  import { fly, fade } from 'svelte/transition';

  const closeOverlay = () => {
    $isDeleteAccountOverlayVisible = false;
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
      style='visibility:{ $isDeleteAccountOverlayVisible ? "visible": "hidden"}'
      >

  <!-- <svg class="box-icon" xmlns="http://www.w3.org/2000/svg" width="50" height="43" viewBox="0 0 50 43"> -->
    <!-- <path d="M48.4 26.5c-.9 0-1.7.7-1.7 1.7v11.6h-43.3v-11.6c0-.9-.7-1.7-1.7-1.7s-1.7.7-1.7 1.7v13.2c0 .9.7 1.7 1.7 1.7h46.7c.9 0 1.7-.7 1.7-1.7v-13.2c0-1-.7-1.7-1.7-1.7zm-24.5 6.1c.3.3.8.5 1.2.5.4 0 .9-.2 1.2-.5l10-11.6c.7-.7.7-1.7 0-2.4s-1.7-.7-2.4 0l-7.1 8.3v-25.3c0-.9-.7-1.7-1.7-1.7s-1.7.7-1.7 1.7v25.3l-7.1-8.3c-.7-.7-1.7-.7-2.4 0s-.7 1.7 0 2.4l10 11.6z"></path> -->
  <!-- </svg> -->

  <svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" fill="currentColor" class="bi bi-person-x" viewBox="0 0 16 16">
    <path d="M6 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm4 8c0 1-1 1-1 1H1s-1 0-1-1 1-4 6-4 6 3 6 4zm-1-.004c-.001-.246-.154-.986-.832-1.664C9.516 10.68 8.289 10 6 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10z"/>
    <path fill-rule="evenodd" d="M12.146 5.146a.5.5 0 0 1 .708 0L14 6.293l1.146-1.147a.5.5 0 0 1 .708.708L14.707 7l1.147 1.146a.5.5 0 0 1-.708.708L14 7.707l-1.146 1.147a.5.5 0 0 1-.708-.708L13.293 7l-1.147-1.146a.5.5 0 0 1 0-.708z"/>
  </svg>

  <p class="delete-overlay-text">
    <span style="font-weight: 1500;">Are you sure you want to delete your account?</span>
  </p>
  <div class="delete-overlay-button-container">
    <button class="button-dark"
            on:click={ deleteAccount }
            >Delete</button>
    <button class="button-dark"
            on:click={ closeOverlay }
            >Cancel</button>
  </div>
</div>

<style>
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

  .delete-overlay-button-container {
    display: inline-flex;
  }

  .delete-overlay-component {
    background-color: rgba(16,12,12,0.8);
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
