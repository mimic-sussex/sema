<script>

  import {
    isShareOverlayVisible,
    isDeleteOverlayVisible,
    isNewOverlayVisible,
    items,
    isSaveOverlayVisible,
    isUploadOverlayVisible,
    isSelectLiveCodeEditorDisabled,
    isSelectModelEditorDisabled,
    isAddGrammarEditorDisabled,
    isAddAnalyserDisabled,
    sidebarDebuggerOptions,
		uuid,
		name
  } from '../../stores/playground.js';

  export let id;

  import { onMount, onDestroy } from 'svelte';
  import { fly, fade } from 'svelte/transition';

  // used to track whether the url has been copied to clipboard yet.
  let copied = false;
  let playgroundURL = `https://dev.sema.codes/playground/${id}`

  const closeOverlay = () => {
    $isShareOverlayVisible = false;
  }

  function makeTweet(){
    window.open(`https://twitter.com/intent/tweet?text=Check out my project on ${playgroundURL}`);
    //return "https://twitter.com/intent/tweet?text="+window.location.href;
  }
  const copyToClipboard = () => {
    // navigator.clipboard.writeText(window.location.href);
    navigator.clipboard.writeText(`${playgroundURL}`);
    console.log('current uuid', id);
    copied = true;
  }
  

  onMount( async () => {
    // engine = new Engine();
		console.log("Share")
  });

  onDestroy( () => {
    // engine = null;
	});

</script>

<div  in:fly="{{ y: 200, duration: 300 }}"
      class="share-overlay-component"
      style='visibility:{ $isShareOverlayVisible ? "visible": "hidden"}'
      >

  {#if !copied}
  <svg version="1.1"
            id="Layer_1"
            xmlns="http://www.w3.org/2000/svg"
            xmlns:xlink="http://www.w3.org/1999/xlink"
            x="0px" y="0px"
            viewBox="0 0 512 512"
            class='dark-mode'
            style="enable-background:new 0 0 512 512;"
            xml:space="preserve"
            width='320'
            height='100'
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

  <p class="share-overlay-text">
    <span style="font-weight: 1500;">Share your project via a unique project URL</span>
  </p>

  {:else if copied}
    <div in:fly="{{ y: -200, duration: 300 }}">
      <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" fill="currentColor" class="bi bi-clipboard-check" viewBox="0 0 16 16">
        <path style="fill:#65d9a5;" fill-rule="evenodd" d="M10.854 7.146a.5.5 0 0 1 0 .708l-3 3a.5.5 0 0 1-.708 0l-1.5-1.5a.5.5 0 1 1 .708-.708L7.5 9.793l2.646-2.647a.5.5 0 0 1 .708 0z"/>
        <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
        <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>
      </svg>
    </div>
    <p class="share-overlay-text">
      <span style="font-weight: 1500;">Link copied to clipboard!</span>
    </p>
  {/if}

  <input  bind:value={playgroundURL}
					type="text"
					id="playground-url"
					name="playground-url"
          size="10"
          placeholder="Playground URL"
          title="Playground URL"
					>

  <div class="share-overlay-button-container">
    <button class="button-dark"
            on:click={ copyToClipboard }
            >Copy Link</button>
    
    <button class="button-dark"
            on:click={ makeTweet }
            >Tweet</button>

    <!-- <a class="twitter-share-button"
            href="https://twitter.com/intent/tweet?text=Checkout my project on "
            data-size="large">
          Tweet</a> -->
    <button class="button-dark"
            on:click={ closeOverlay }
            >Cancel</button>
  </div>
</div>

<style>

  /* the tick path in  the clipboard icon*/
  /* #copied-tick-id {
    transition
  } */

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

  svg {
    fill: white;
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

  .share-overlay-button-container {
    display: inline-flex;
  }

  .share-overlay-component {
    width: 100%;
		height:100%;
    display:flex;
    justify-content:center;
    align-items:center;
		flex-direction:column;
    font-size:16px;
    background-color: rgba(16,12,12,0.8);
  }


  .share-overlay-text {
    /* top:50%; */

    /* width: 100%; */
    /* position: absolute; */
    color: #FFF;
  }
</style>
