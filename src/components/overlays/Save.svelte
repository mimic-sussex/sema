<script>

  import {
    isSaveOverlayVisible,
    loadEnvironmentSnapshotEntries,
		items,
		uuid,
    name,
    allowEdits
  } from  "../../stores/playground.js";

  import {
    user
  } from "../../stores/user.js";

	import {
		updatePlayground
	} from '../../db/client';

	import { onMount, onDestroy } from 'svelte';
  import { fly, fade } from 'svelte/transition';

	// let filename, input;
	let input;

  const closeOverlay = () => {
    $isSaveOverlayVisible = false;
  }

  const saveEnvironment = () => {

		let localStorageEntry =	"playground-" + new Date(Date.now()).toISOString()+'-'+ $name

		updatePlayground($uuid, $name, $items, $allowEdits, $user);



		if($name && !window.localStorage[localStorageEntry]){
			window.localStorage[localStorageEntry] = JSON.stringify($items);
			loadEnvironmentSnapshotEntries();
			$isSaveOverlayVisible = false;
		}
		else if (window.localStorage[$name]){


		}
	}

  onMount( async () => {
    // engine = new Engine();
		console.log("save")
  });

  onDestroy( () => {
    // engine = null;
	});


</script>

<div  in:fly="{{ y: 200, duration: 300 }}" out:fade
      class="save-overlay-component"
      style='visibility:{ $isSaveOverlayVisible ? "visible": "hidden"}'
      >
  <!-- <svg class="box-icon" xmlns="http://www.w3.org/2000/svg" width="320" height="100" viewBox="0 0 50 43" fill="white">
    <path d="M48.4 26.5c-.9 0-1.7.7-1.7 1.7v11.6h-43.3v-11.6c0-.9-.7-1.7-1.7-1.7s-1.7.7-1.7 1.7v13.2c0 .9.7 1.7 1.7 1.7h46.7c.9 0 1.7-.7 1.7-1.7v-13.2c0-1-.7-1.7-1.7-1.7zm-24.5 6.1c.3.3.8.5 1.2.5.4 0 .9-.2 1.2-.5l10-11.6c.7-.7.7-1.7 0-2.4s-1.7-.7-2.4 0l-7.1 8.3v-25.3c0-.9-.7-1.7-1.7-1.7s-1.7.7-1.7 1.7v25.3l-7.1-8.3c-.7-.7-1.7-.7-2.4 0s-.7 1.7 0 2.4l10 11.6z"></path>
  </svg> -->
  <!-- <p class="save-overlay-text"><span style="font-weight: 1500;">Enter the name for the record</span></p> -->
	<!-- <label for="name">(Project names should contain 8 to 15 alphanumeric characters)</label> -->

  <svg version="1.1"
        id="Layer_1"
        xmlns="http://www.w3.org/2000/svg"
        xmlns:xlink="http://www.w3.org/1999/xlink"
        x="0px" y="0px"
        viewBox="0 0 512 512"
        style="enable-background:new 0 0 512 512;width:100px;"
        class="light-mode"
        xml:space="preserve"
        fill="white"
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

	<input 	bind:this={ input }
					bind:value={ $name }
					type="text"
					id="name"
					name="name"
					required
					minlength="8"
					maxlength="15"
          size="10"
          placeholder="Enter a Project Name"
          title="Project names should contain 8 to 15 alphanumeric characters"
					>
  <div class="save-overlay-button-container">
		<button class="button-dark"
            on:click={ saveEnvironment }
            >Save</button>
    <button class="button-dark"
            on:click={ closeOverlay }
            >Cancel</button>
	</div>

</div>

<style>

	input[type=text] {
		width: 33%;
		padding: 12px 20px;
		margin: 8px 0;
		box-sizing: border-box;
		border: 1px solid #aaa;
		-webkit-transition: 0.5s;
		transition: 0.5s;
		outline: none;
		color:white;
		background-color: rgba(16, 16, 16, 0.04);
	}

	input[type=text]:focus {
		border: 1px solid #555;
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


  .save-overlay-component {
    width: 100%;
		height:100%;
    display:flex;
    justify-content:center;
    align-items:center;
		flex-direction:column;
    font-size:16px;
  }

  .save-overlay-button-container {
    display: inline-flex;
  }

  .box-icon {
    padding: 20px 20px 20px 20px;
  }

	input:invalid {
  	border: 2px dashed red;
	}



</style>