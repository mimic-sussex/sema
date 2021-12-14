<script>

  import {
    fullScreen,
    engineStatus,
    engineSoundLevel,
    inputStreamConnected,
    siteMode
  } from '../../../stores/common.js';

	import {
    onMount,
    onDestroy
  } from 'svelte'

  import { Engine } from 'sema-engine';

  let engine,
      engineLoaded = false
      ;

  let handleAudioOnOff = () => {

    if($engineStatus === 'running'){
      $engineStatus = 'paused';
      engine.hush();
    }
    else {
      $engineStatus = 'running';
      engine.play();
    }

  }

  let handleLessAudio = () => {

    if($engineStatus === 'paused') return;
    else {
      if(!engine){
        engine = new Engine();
      }
      $engineSoundLevel = engine.less();

    }
  }

  let handleMoreAudio = () => {

    if($engineStatus === 'paused') return;
    else {
      if(!engine){
        engine = new Engine();
      }
      $engineSoundLevel = engine.more();
    }
  }

  // let handleConnectInputStream = async () => {

  //   if(!engine){
  //     engine = new Engine();
  //   }
  //   if( !$inputStreamConnected ) {
  //     $inputStreamConnected = await engine.connectMediaStream();
  //   } else {
  //     $inputStreamConnected = await engine.disconnectMediaStream();
  //   }
  // }


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
    display:flex;
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
    background-color: grey;
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



/* DO WE NEED THIS? */
/* 
  path {
    transform: translate(-3px, -5px)
  } */

  .audio-active {
    fill: #0050A0;
  }

  .audio-inactive {
    fill: rgb(133, 130, 130);
  }


  .no-audio {
    fill: red;

  }

  .mute-audio {
    padding: 0.1em 0px 0em 0.1em;
    fill: rgb(133, 130, 130);
  }

  .engine-sound-level-text-container {
    /* width: 2em; */
    /* margin: 0em 0.1em 0em 0em; */
    /* display: flex;
    align-items: center;
    align-content: flex-end; */
    width: 42px;
    display: inline-block;
  	/* height: 42px; */
  	margin: 8px 8px 8px 8px;
  	border-radius: 5px;
  	background-color: #262a2e;
  }

  .engine-sound-level-text {
    /* margin: 0em 0.5em 0em 0.5em; */
    /* padding: 0.6em 0em 0em 0em; */
    user-select: none;
    color: #ccc;
    font-size: medium;
  }


</style>

<button class="{ $siteMode === 'dark'? 'button-dark' :'button-light' }"
        title="audio status"
        on:click={ handleAudioOnOff }
        >
  <div class="icon-container">
    <!-- Engine RUNNING -->
    {#if $engineStatus === 'running' }
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="audio-active" viewBox="0 0 16 16">
        <path d="M10.717 3.55A.5.5 0 0 1 11 4v8a.5.5 0 0 1-.812.39L7.825 10.5H5.5A.5.5 0 0 1 5 10V6a.5.5 0 0 1 .5-.5h2.325l2.363-1.89a.5.5 0 0 1 .529-.06zM10 5.04 8.312 6.39A.5.5 0 0 1 8 6.5H6v3h2a.5.5 0 0 1 .312.11L10 10.96V5.04z"/>
      </svg>
    <!-- Engine NO-AUDIO -->
    {:else if $engineStatus === 'no-audio' }
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="no-audio" viewBox="0 0 16 16">
        <path d="M6.717 3.55A.5.5 0 0 1 7 4v8a.5.5 0 0 1-.812.39L3.825 10.5H1.5A.5.5 0 0 1 1 10V6a.5.5 0 0 1 .5-.5h2.325l2.363-1.89a.5.5 0 0 1 .529-.06zM6 5.04 4.312 6.39A.5.5 0 0 1 4 6.5H2v3h2a.5.5 0 0 1 .312.11L6 10.96V5.04zm7.854.606a.5.5 0 0 1 0 .708L12.207 8l1.647 1.646a.5.5 0 0 1-.708.708L11.5 8.707l-1.646 1.647a.5.5 0 0 1-.708-.708L10.793 8 9.146 6.354a.5.5 0 1 1 .708-.708L11.5 7.293l1.646-1.647a.5.5 0 0 1 .708 0z"/>
      </svg>
    <!-- Engine high audio -->
    {:else if $engineStatus === 'high-audio' }
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="audio" viewBox="0 0 16 16">
        <path d="M6.717 3.55A.5.5 0 0 1 7 4v8a.5.5 0 0 1-.812.39L3.825 10.5H1.5A.5.5 0 0 1 1 10V6a.5.5 0 0 1 .5-.5h2.325l2.363-1.89a.5.5 0 0 1 .529-.06zM6 5.04 4.312 6.39A.5.5 0 0 1 4 6.5H2v3h2a.5.5 0 0 1 .312.11L6 10.96V5.04zm7.854.606a.5.5 0 0 1 0 .708L12.207 8l1.647 1.646a.5.5 0 0 1-.708.708L11.5 8.707l-1.646 1.647a.5.5 0 0 1-.708-.708L10.793 8 9.146 6.354a.5.5 0 1 1 .708-.708L11.5 7.293l1.646-1.647a.5.5 0 0 1 .708 0z"/>
      </svg>
    <!-- Engine medium audio -->
    {:else if $engineStatus === 'medium-audio' }
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="audio" viewBox="0 0 16 16">
        <path d="M6.717 3.55A.5.5 0 0 1 7 4v8a.5.5 0 0 1-.812.39L3.825 10.5H1.5A.5.5 0 0 1 1 10V6a.5.5 0 0 1 .5-.5h2.325l2.363-1.89a.5.5 0 0 1 .529-.06zM6 5.04 4.312 6.39A.5.5 0 0 1 4 6.5H2v3h2a.5.5 0 0 1 .312.11L6 10.96V5.04zm7.854.606a.5.5 0 0 1 0 .708L12.207 8l1.647 1.646a.5.5 0 0 1-.708.708L11.5 8.707l-1.646 1.647a.5.5 0 0 1-.708-.708L10.793 8 9.146 6.354a.5.5 0 1 1 .708-.708L11.5 7.293l1.646-1.647a.5.5 0 0 1 .708 0z"/>
      </svg>
    <!-- engine low audio -->
    {:else if $engineStatus === 'low-audio' }
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="audio" viewBox="0 0 16 16">
        <path d="M6.717 3.55A.5.5 0 0 1 7 4v8a.5.5 0 0 1-.812.39L3.825 10.5H1.5A.5.5 0 0 1 1 10V6a.5.5 0 0 1 .5-.5h2.325l2.363-1.89a.5.5 0 0 1 .529-.06zM6 5.04 4.312 6.39A.5.5 0 0 1 4 6.5H2v3h2a.5.5 0 0 1 .312.11L6 10.96V5.04zm7.854.606a.5.5 0 0 1 0 .708L12.207 8l1.647 1.646a.5.5 0 0 1-.708.708L11.5 8.707l-1.646 1.647a.5.5 0 0 1-.708-.708L10.793 8 9.146 6.354a.5.5 0 1 1 .708-.708L11.5 7.293l1.646-1.647a.5.5 0 0 1 .708 0z"/>
      </svg>
    <!-- engine paused -->
    {:else if $engineStatus === 'paused' }
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="mute-audio" viewBox="0 0 16 16">
        <path d="M6.717 3.55A.5.5 0 0 1 7 4v8a.5.5 0 0 1-.812.39L3.825 10.5H1.5A.5.5 0 0 1 1 10V6a.5.5 0 0 1 .5-.5h2.325l2.363-1.89a.5.5 0 0 1 .529-.06zM6 5.04 4.312 6.39A.5.5 0 0 1 4 6.5H2v3h2a.5.5 0 0 1 .312.11L6 10.96V5.04zm7.854.606a.5.5 0 0 1 0 .708L12.207 8l1.647 1.646a.5.5 0 0 1-.708.708L11.5 8.707l-1.646 1.647a.5.5 0 0 1-.708-.708L10.793 8 9.146 6.354a.5.5 0 1 1 .708-.708L11.5 7.293l1.646-1.647a.5.5 0 0 1 .708 0z"/>
      </svg>
    {/if}
  </div>
</button>

<button class="{ $siteMode === 'dark'? 'button-dark' :'button-light' }"
        title="quieter"
        on:click={ handleLessAudio }
        >
  <div class="icon-container">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="{ $engineStatus !== 'paused'? 'audio-active':'audio-inactive' }" viewBox="0 0 16 16">
      <path d="M9 4a.5.5 0 0 0-.812-.39L5.825 5.5H3.5A.5.5 0 0 0 3 6v4a.5.5 0 0 0 .5.5h2.325l2.363 1.89A.5.5 0 0 0 9 12V4zM6.312 6.39 8 5.04v5.92L6.312 9.61A.5.5 0 0 0 6 9.5H4v-3h2a.5.5 0 0 0 .312-.11zM12.025 8a4.486 4.486 0 0 1-1.318 3.182L10 10.475A3.489 3.489 0 0 0 11.025 8 3.49 3.49 0 0 0 10 5.525l.707-.707A4.486 4.486 0 0 1 12.025 8z"/>
    </svg>
  </div>
</button>

<!-- Volume Text -->
<div class="engine-sound-level-text-container">
  <span class="engine-sound-level-text">{ parseInt($engineSoundLevel*100) }%</span>
</div>


<button class="{ $siteMode === 'dark'? 'button-dark' :'button-light' }"
        title="louder"
        on:click={ handleMoreAudio }>
  <div class="icon-container">

    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="{ $engineStatus !== 'paused'? 'audio-active':'audio-inactive' }" viewBox="0 0 16 16">
      <path d="M11.536 14.01A8.473 8.473 0 0 0 14.026 8a8.473 8.473 0 0 0-2.49-6.01l-.708.707A7.476 7.476 0 0 1 13.025 8c0 2.071-.84 3.946-2.197 5.303l.708.707z"/>
      <path d="M10.121 12.596A6.48 6.48 0 0 0 12.025 8a6.48 6.48 0 0 0-1.904-4.596l-.707.707A5.483 5.483 0 0 1 11.025 8a5.483 5.483 0 0 1-1.61 3.89l.706.706z"/>
      <path d="M10.025 8a4.486 4.486 0 0 1-1.318 3.182L8 10.475A3.489 3.489 0 0 0 9.025 8c0-.966-.392-1.841-1.025-2.475l.707-.707A4.486 4.486 0 0 1 10.025 8zM7 4a.5.5 0 0 0-.812-.39L3.825 5.5H1.5A.5.5 0 0 0 1 6v4a.5.5 0 0 0 .5.5h2.325l2.363 1.89A.5.5 0 0 0 7 12V4zM4.312 6.39 6 5.04v5.92L4.312 9.61A.5.5 0 0 0 4 9.5H2v-3h2a.5.5 0 0 0 .312-.11z"/>
    </svg>

  </div>
</button>







