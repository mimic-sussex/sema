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
  let playgroundURL = `https://sema.codes/playground/${id}`

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
  <div in:fly="{{ y: -200, duration: 600 }}">
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
    </div>
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
    /* background-color: rgba(16,12,12,0.8); */
  }


  .share-overlay-text {
    /* top:50%; */

    /* width: 100%; */
    /* position: absolute; */
    color: #FFF;
  }
</style>
