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

  import { Engine } from 'sema-engine/sema-engine';

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

  let handleConnectInputStream = () => {

    if(!engine){
      engine = new Engine();
    }
    if( !$inputStreamConnected ) {
      $inputStreamConnected  = engine.connectMediaStream();
    } else {
      $inputStreamConnected  = engine.disconnectMediaStream();
    }
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
    padding: 0.3em 0.25em 0.7em 0.85em;
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
    /* margin-right: 5px; */
    border-radius: .6em;
    -moz-appearance: none;
    -webkit-appearance: none;
    appearance: none;
    background-color:  rgba(16, 16, 16, 0.04);
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
    padding: 0.3em 0.25em 0.7em 0.85em;
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
    /* margin-right: 5px; */
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
    display: block;
    /* font-size: 12px; */
    padding: 0.3em 0.25em 0.7em 0.85em;
    font-family: sans-serif;
    font-weight: 400;
    cursor: pointer;
    color: red;
    line-height: 1.3;
    max-width: 100%;
    box-sizing: border-box;
    /* margin-top: 5px; */
    /* margin-right: 5px; */
    text-align: left;
    -moz-appearance: none;
    -webkit-appearance: none;
    appearance: none;
    background-color:  rgba(16, 16, 16, 0.04);
    background-repeat: no-repeat, repeat;
    background-size: .65em auto, 100%;
    box-shadow:  -1px -1px 3px rgba(16, 16, 16, 0.4), 0.5px 0.5px 0.5px rgba(16, 16, 16, 0.04);
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





  path {
    transform: translate(-3px, -5px)
  }

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
    width: 2em;
    margin: 0em 0.1em 0em 0em;
    display: flex;
    align-items: center;
    align-content: flex-end;
  }

  .engine-sound-level-text {
    /* margin: 0em 0.5em 0em 0.5em; */
    /* padding: 0.6em 0em 0em 0em; */
    user-select: none;
    color: #ccc;
    font-size: medium;
  }


</style>

        <!-- style="{$fullScreen? `visibility:visible;`: `visibility:hidden`}" -->
<button class="{ $siteMode === 'dark'? 'button-dark' :'button-light' }"
        title="audio status"
        style='padding: 0.22em 0.05em 0.8em 0.95em;'
        on:click={ handleAudioOnOff }
        >
  <div class="icon-container">
    {#if $engineStatus === 'running' }
    <svg xmlns="http://www.w3.org/2000/svg"
          class="path audio-active"
          width="24"
          viewBox="0 0 32 32"
          >
        <path   style="text-indent:0;text-align:start;line-height:normal;text-transform:none;block-progression:tb;-inkscape-font-specification:Bitstream Vera Sans"
                d="M 15 4.59375 L 13.28125 6.28125 L 8.5625 11 L 5 11 L 4 11 L 4 12 L 4 20 L 4 21 L 5 21 L 8.5625 21 L 13.28125 25.71875 L 15 27.40625 L 15 25 L 15 7 L 15 4.59375 z M 13 9.4375 L 13 22.5625 L 9.71875 19.28125 L 9.40625 19 L 9 19 L 6 19 L 6 13 L 9 13 L 9.40625 13 L 9.71875 12.71875 L 13 9.4375 z M 20.21875 11.78125 L 18.78125 13.21875  z"
                overflow="visible"
              />
    </svg>
    {:else if $engineStatus === 'no-audio' }
    <svg xmlns="http://www.w3.org/2000/svg"
          class="path no-audio"
          width="24"
          viewBox="0 0 32 32"
          >
      <path   style="text-indent:0;text-align:start;line-height:normal;text-transform:none;block-progression:tb;-inkscape-font-specification:Bitstream Vera Sans"
            d="M 15 4.59375 L 13.28125 6.28125 L 8.5625 11 L 5 11 L 4 11 L 4 12 L 4 20 L 4 21 L 5 21 L 8.5625 21 L 13.28125 25.71875 L 15 27.40625 L 15 25 L 15 7 L 15 4.59375 z M 13 9.4375 L 13 22.5625 L 9.71875 19.28125 L 9.40625 19 L 9 19 L 6 19 L 6 13 L 9 13 L 9.40625 13 L 9.71875 12.71875 L 13 9.4375 z M 20.21875 11.78125 L 18.78125 13.21875 L 21.5625 16 L 18.78125 18.78125 L 20.21875 20.21875 L 23 17.4375 L 25.78125 20.21875 L 27.21875 18.78125 L 24.4375 16 L 27.21875 13.21875 L 25.78125 11.78125 L 23 14.5625 L 20.21875 11.78125 z"
            overflow="visible" font-family="Bitstream Vera Sans"/>
    </svg>
    {:else if $engineStatus === 'high-audio' }
    <svg xmlns="http://www.w3.org/2000/svg"
          class="path audio"
          width="20" height="20"
          viewBox="0 0 32 32"
          >
      <path   style="text-indent:0;text-align:start;line-height:normal;text-transform:none;block-progression:tb;-inkscape-font-specification:Bitstream Vera Sans" d="M 15 4.59375 L 13.28125 6.28125 L 8.5625 11 L 5 11 L 4 11 L 4 12 L 4 20 L 4 21 L 5 21 L 8.5625 21 L 13.28125 25.71875 L 15 27.40625 L 15 25 L 15 7 L 15 4.59375 z M 13 9.4375 L 13 22.5625 L 9.71875 19.28125 L 9.40625 19 L 9 19 L 6 19 L 6 13 L 9 13 L 9.40625 13 L 9.71875 12.71875 L 13 9.4375 z M 20.21875 11.78125 L 18.78125 13.21875 L 21.5625 16 L 18.78125 18.78125 L 20.21875 20.21875 L 23 17.4375 L 25.78125 20.21875 L 27.21875 18.78125 L 24.4375 16 L 27.21875 13.21875 L 25.78125 11.78125 L 23 14.5625 L 20.21875 11.78125 z" overflow="visible" font-family="Bitstream Vera Sans"/>
    </svg>
    {:else if $engineStatus === 'medium-audio' }
    <svg xmlns="http://www.w3.org/2000/svg"
          class="path audio"
          width="20" height="20"
          viewBox="0 0 32 32"
          >
      <path   style="text-indent:0;text-align:start;line-height:normal;text-transform:none;block-progression:tb;-inkscape-font-specification:Bitstream Vera Sans" d="M 15 4.59375 L 13.28125 6.28125 L 8.5625 11 L 5 11 L 4 11 L 4 12 L 4 20 L 4 21 L 5 21 L 8.5625 21 L 13.28125 25.71875 L 15 27.40625 L 15 25 L 15 7 L 15 4.59375 z M 13 9.4375 L 13 22.5625 L 9.71875 19.28125 L 9.40625 19 L 9 19 L 6 19 L 6 13 L 9 13 L 9.40625 13 L 9.71875 12.71875 L 13 9.4375 z M 20.21875 11.78125 L 18.78125 13.21875 L 21.5625 16 L 18.78125 18.78125 L 20.21875 20.21875 L 23 17.4375 L 25.78125 20.21875 L 27.21875 18.78125 L 24.4375 16 L 27.21875 13.21875 L 25.78125 11.78125 L 23 14.5625 L 20.21875 11.78125 z" overflow="visible" font-family="Bitstream Vera Sans"/>
    </svg>
    {:else if $engineStatus === 'low-audio' }
    <svg xmlns="http://www.w3.org/2000/svg"
          class="path audio"
          width="20" height="20"
          viewBox="0 0 32 32"
          >
      <path   style="text-indent:0;text-align:start;line-height:normal;text-transform:none;block-progression:tb;-inkscape-font-specification:Bitstream Vera Sans" d="M 15 4.59375 L 13.28125 6.28125 L 8.5625 11 L 5 11 L 4 11 L 4 12 L 4 20 L 4 21 L 5 21 L 8.5625 21 L 13.28125 25.71875 L 15 27.40625 L 15 25 L 15 7 L 15 4.59375 z M 13 9.4375 L 13 22.5625 L 9.71875 19.28125 L 9.40625 19 L 9 19 L 6 19 L 6 13 L 9 13 L 9.40625 13 L 9.71875 12.71875 L 13 9.4375 z M 20.21875 11.78125 L 18.78125 13.21875 L 21.5625 16 L 18.78125 18.78125 L 20.21875 20.21875 L 23 17.4375 L 25.78125 20.21875 L 27.21875 18.78125 L 24.4375 16 L 27.21875 13.21875 L 25.78125 11.78125 L 23 14.5625 L 20.21875 11.78125 z" overflow="visible" font-family="Bitstream Vera Sans"/>
    </svg>
    {:else if $engineStatus === 'paused' }
    <svg xmlns="http://www.w3.org/2000/svg"
          class="path mute-audio"
          width="20" height="20"
          viewBox="0 0 32 32"
          >
      <path  style="text-indent:0;text-align:start;line-height:normal;text-transform:none;block-progression:tb;-inkscape-font-specification:Bitstream Vera Sans"
            d="M 15 4.59375 L 13.28125 6.28125 L 8.5625 11 L 5 11 L 4 11 L 4 12 L 4 20 L 4 21 L 5 21 L 8.5625 21 L 13.28125 25.71875 L 15 27.40625 L 15 25 L 15 7 L 15 4.59375 z M 13 9.4375 L 13 22.5625 L 9.71875 19.28125 L 9.40625 19 L 9 19 L 6 19 L 6 13 L 9 13 L 9.40625 13 L 9.71875 12.71875 L 13 9.4375 z M 20.21875 11.78125 L 18.78125 13.21875 L 21.5625 16 L 18.78125 18.78125 L 20.21875 20.21875 L 23 17.4375 L 25.78125 20.21875 L 27.21875 18.78125 L 24.4375 16 L 27.21875 13.21875 L 25.78125 11.78125 L 23 14.5625 L 20.21875 11.78125 z" overflow="visible" font-family="Bitstream Vera Sans"/>
    </svg>
    {/if}
  </div>
</button>

        <!-- style="{$fullScreen? `visibility:visible;`: `visibility:hidden`}" -->
<button class="{ $siteMode === 'dark'? 'button-dark' :'button-light' }"
        title="quieter"
        style='padding: 0.3em 0.05em 0.7em 0.95em;'
        on:click={ handleLessAudio }
        >
  <div class="icon-container">
    <svg xmlns="http://www.w3.org/2000/svg" class="path { $engineStatus !== 'paused'? 'audio-active':'audio-inactive' }" width="20" height="20" viewBox="0 0 32 32">
      <path style="text-indent:0;text-align:start;line-height:normal;text-transform:none;block-progression:tb;-inkscape-font-specification:Bitstream Vera Sans" d="M 15 4.59375 L 13.28125 6.28125 L 8.5625 11 L 5 11 L 4 11 L 4 12 L 4 20 L 4 21 L 5 21 L 8.5625 21 L 13.28125 25.71875 L 15 27.40625 L 15 25 L 15 7 L 15 4.59375 z M 13 9.4375 L 13 22.5625 L 9.71875 19.28125 L 9.40625 19 L 9 19 L 6 19 L 6 13 L 9 13 L 9.40625 13 L 9.71875 12.71875 L 13 9.4375 z M 18.5 12.03125 L 17.0625 13.46875 C 17.6405 14.16275 18 15.028 18 16 C 18 16.972 17.6405 17.83725 17.0625 18.53125 L 18.5 19.96875 C 19.439 18.90975 20 17.523 20 16 C 20 14.477 19.439 13.09025 18.5 12.03125 z" overflow="visible" font-family="Bitstream Vera Sans"/>
    </svg>
  </div>
</button>

<div class="engine-sound-level-text-container">
  <span class="engine-sound-level-text">{ parseInt($engineSoundLevel*100) }%</span>
</div>
        <!-- style="{$fullScreen? `visibility:visible;`: `visibility:hidden`}" -->
<button class="{ $siteMode === 'dark'? 'button-dark' :'button-light' }"
        title="louder"
        style='padding: 0.3em 0.15em 0.7em 0.85em;'
        on:click={ handleMoreAudio }>
  <div class="icon-container">
    <svg xmlns="http://www.w3.org/2000/svg" class="path { $engineStatus !== 'paused'? 'audio-active':'audio-inactive' }" width="20" height="20" viewBox="0 0 32 32">
      <path style="text-indent:0;text-align:start;line-height:normal;text-transform:none;block-progression:tb;-inkscape-font-specification:Bitstream Vera Sans" d="M 15 4.59375 L 13.28125 6.28125 L 8.5625 11 L 5 11 L 4 11 L 4 12 L 4 20 L 4 21 L 5 21 L 8.5625 21 L 13.28125 25.71875 L 15 27.40625 L 15 25 L 15 7 L 15 4.59375 z M 24.125 6.375 L 22.71875 7.78125 C 24.74275 9.92925 26 12.822 26 16 C 26 19.178 24.74275 22.06975 22.71875 24.21875 L 24.125 25.625 C 26.51 23.113 28 19.729 28 16 C 28 12.271 26.51 8.886 24.125 6.375 z M 21.3125 9.1875 L 19.90625 10.625 C 21.20625 12.048 22 13.925 22 16 C 22 18.075 21.20625 19.951 19.90625 21.375 L 21.3125 22.8125 C 22.9735 21.0255 24 18.626 24 16 C 24 13.374 22.9735 10.9735 21.3125 9.1875 z M 13 9.4375 L 13 22.5625 L 9.71875 19.28125 L 9.40625 19 L 9 19 L 6 19 L 6 13 L 9 13 L 9.40625 13 L 9.71875 12.71875 L 13 9.4375 z M 18.5 12.03125 L 17.0625 13.46875 C 17.6405 14.16275 18 15.028 18 16 C 18 16.972 17.6405 17.83725 17.0625 18.53125 L 18.5 19.96875 C 19.439 18.90975 20 17.523 20 16 C 20 14.477 19.439 13.09025 18.5 12.03125 z" overflow="visible" font-family="Bitstream Vera Sans"/>
    </svg>
  </div>
</button>

<button class="{ $siteMode === 'dark'? 'button-dark' :'button-light' }"
        title="microphone"
        style='padding: 0.1em 0.4em 0.9em 0.6em;'
        on:click={ handleConnectInputStream }>
  <div class="icon-container">
    <!-- <svg xmlns="http://www.w3.org/2000/svg" class="path { $engineStatus !== 'paused'? 'audio-active':'audio-inactive' }" width="20" height="20" viewBox="0 0 32 32"> -->

    <svg version="1.1"
          id="Layer_1"
          xmlns="http://www.w3.org/2000/svg"
          xmlns:xlink="http://www.w3.org/1999/xlink"
          x="0px" y="0px"
          width="20" height="20"
          class="path { $engineStatus !== 'paused'? 'audio-active':'audio-inactive' }"
          viewBox="0 0 512 512" style="enable-background:new 0 0 512 512;" xml:space="preserve">
    <g>
      <path d="M170.7,234.7h-21.3c0,18.1,2.7,34.1,8.2,48.1c8.1,21,23.1,36.9,40.9,46c17.7,9.2,37.6,12.5,57.6,12.6
        c26.6,0,53.3-5.9,74.3-23.9c10.4-8.9,18.8-20.7,24.2-34.7c5.5-14,8.2-30,8.2-48.1v-128c0-18.1-2.7-34.1-8.2-48.1
        c-8.1-21-23.1-36.9-40.9-46C295.9,3.3,276,0,256,0c-26.6,0-53.3,5.9-74.3,23.9c-10.4,8.9-18.8,20.7-24.2,34.7
        c-5.5,14-8.2,30-8.2,48.1v128H170.7H192v-128c0-13.9,2.1-24.5,5.2-32.5c4.8-12,11.4-18.6,20.9-23.8c9.5-5,22.5-7.7,37.8-7.7
        c20.5,0,36.4,4.8,46.4,13.5c5.1,4.4,9.2,10,12.4,18c3.1,8,5.2,18.6,5.2,32.5v128c0,13.9-2.1,24.5-5.2,32.5
        c-4.8,12-11.4,18.6-20.9,23.8c-9.5,5-22.5,7.7-37.8,7.7c-20.5,0-36.4-4.8-46.4-13.5c-5.1-4.4-9.2-10-12.4-18
        c-3.1-8-5.2-18.6-5.2-32.5H170.7z M64,192v42.7c-0.1,58.4,21.3,107.4,56.6,140.8c35.2,33.5,83.5,51.2,135.4,51.2
        c51.9,0,100.1-17.7,135.4-51.2c35.3-33.4,56.7-82.4,56.6-140.8V192h-42.7v42.7c-0.1,48.3-16.9,84.6-43.3,109.9
        c-26.5,25.2-63.6,39.4-106,39.5c-42.4,0-79.5-14.3-106-39.5c-26.5-25.3-43.2-61.6-43.3-109.9l0-42.7H64z M277.3,512V405.3h-42.7
        V512H277.3z"/>
    </g>
    </svg>
      <!-- <path style="text-indent:0;text-align:start;line-height:normal;text-transform:none;block-progression:tb;-inkscape-font-specification:Bitstream Vera Sans"
            d="M 15 4.59375 L 13.28125 6.28125 L 8.5625 11 L 5 11 L 4 11 L 4 12 L 4 20 L 4 21 L 5 21 L 8.5625 21 L 13.28125 25.71875 L 15 27.40625 L 15 25 L 15 7 L 15 4.59375 z M 24.125 6.375 L 22.71875 7.78125 C 24.74275 9.92925 26 12.822 26 16 C 26 19.178 24.74275 22.06975 22.71875 24.21875 L 24.125 25.625 C 26.51 23.113 28 19.729 28 16 C 28 12.271 26.51 8.886 24.125 6.375 z M 21.3125 9.1875 L 19.90625 10.625 C 21.20625 12.048 22 13.925 22 16 C 22 18.075 21.20625 19.951 19.90625 21.375 L 21.3125 22.8125 C 22.9735 21.0255 24 18.626 24 16 C 24 13.374 22.9735 10.9735 21.3125 9.1875 z M 13 9.4375 L 13 22.5625 L 9.71875 19.28125 L 9.40625 19 L 9 19 L 6 19 L 6 13 L 9 13 L 9.40625 13 L 9.71875 12.71875 L 13 9.4375 z M 18.5 12.03125 L 17.0625 13.46875 C 17.6405 14.16275 18 15.028 18 16 C 18 16.972 17.6405 17.83725 17.0625 18.53125 L 18.5 19.96875 C 19.439 18.90975 20 17.523 20 16 C 20 14.477 19.439 13.09025 18.5 12.03125 z"
            overflow="visible"
            font-family="Bitstream Vera Sans"/> -->
    <!-- </svg> -->
  </div>
</button>










