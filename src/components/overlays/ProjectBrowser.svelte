<script>

  import {
    isProjectBrowserOverlayVisible,
    items,
		uuid,
		name
  } from '../../stores/playground.js';

  import Projects from "../admin/Projects.svelte";

  import {clickOutside} from '../../utils/clickOutside.js';

  export let id;

  import { onMount, onDestroy } from 'svelte';
  import { fly, fade } from 'svelte/transition';

  // used to track whether the url has been copied to clipboard yet.
  let copied = false;
  let playgroundURL = `https://sema.codes/playground/${id}`

  const closeOverlay = () => {
    $isProjectBrowserOverlayVisible = false;
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
		console.log("Project browser")
  });

  onDestroy( () => {
    // engine = null;
	});

  // function handleClick(event){
  //   console.log('click outside event:',event, event.explicitOriginalTarget)
  //   if (event.explicitOriginalTarget.id != 'project-browser-launcher-button'){
  //     $isProjectBrowserOverlayVisible = false
  //   }
  // }
  // event=>handleClick(event)

</script>

<div  in:fly="{{ y: -50, duration: 300 }}"
      class="projectBrowser-overlay-component"
      style='visibility:{ $isProjectBrowserOverlayVisible ? "visible": "hidden"}'
      use:clickOutside={['project-browser-launcher-button']} on:click_outside={()=> $isProjectBrowserOverlayVisible = false}
      >

      <Projects />

  <!-- <div class="projectBrowser-overlay-button-container">
   
    <button class="button-dark"
            on:click={ closeOverlay }
            >Close</button>
  </div> -->
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

  .projectBrowser-overlay-button-container {
    display: inline-flex;
  }

  .projectBrowser-overlay-component {
    width: 60%;
		/* height:100%; */
    display:flex;
    justify-content:center;
    align-items:center;
		flex-direction:column;
    font-size:16px;
    /* background-color: rgba(16,12,12,0.8); */
    background-color: #181a1d;
    margin-left:auto;
    margin-right:auto;
    margin-top:auto;
    border-radius:5px;
    box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.2);
    /* box-shadow: 2px 2px 3px rgb(0, 0, 0), -0.5px -0.5px 3px #ffffff61; */
  }


  .projectBrowser-overlay-text {
    /* top:50%; */

    /* width: 100%; */
    /* position: absolute; */
    color: #FFF;
  }
</style>
