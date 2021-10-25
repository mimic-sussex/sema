<script>
  import {
    fullScreen,
    sideBarVisible,
    siteMode
  } from '../../../stores/common.js';

  let engineLoaded = false;

  let handleClickSideBar = () => {
    $sideBarVisible = !$sideBarVisible;
  }

  const isFullScreen = () => {
    return (( document.fullscreenElement && document.fullscreenElement !== null) ||
      ( document.webkitFullscreenElement && document.webkitFullscreenElement !== null) ||
      ( document.mozFullScreenElement && document.mozFullScreenElement !== null) ||
      ( document.msFullscreenElement && document.msFullscreenElement !== null)) !== undefined;
  }

  const exitHandler = () => {
    if (!document.fullscreenElement && !document.webkitIsFullScreen && !document.mozFullScreen && !document.msFullscreenElement) {
     $fullScreen = $sideBarVisible = !isFullScreen();
    }
  }

  const setFullScreenMode = (el, mode) => {

    if(!mode){
      if(el.requestFullscreen){
        el.requestFullscreen().catch(() => { });
        document.addEventListener('fullscreenchange', exitHandler, false);
      } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
        document.addEventListener('webkitfullscreenchange', exitHandler, false);
      } else if (el.mozRequestFullScreen) {
        el.mozRequestFullScreen();
        document.addEventListener('mozfullscreenchange', exitHandler, false);
      } else if (root.msRequestFullscreen) {
        el.msRequestFullscreen();
        document.addEventListener('MSFullscreenChange', exitHandler, false);
      }
    }
    else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => { });
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    }
    $sideBarVisible = $fullScreen = mode;
  }


  const handleClickFullScreen = () => {
    setFullScreenMode(document.querySelector("#sema"), isFullScreen());
  }

</script>

<style>

  .button-dark {
    padding: 20;
		background-color: #262a2e;
/* 		margin: 0,0,0,0; */
		color: white;
		border: none;
		width: 49px;
  	height: 49px;
/*   	margin: 12px 0px 12px 12px; */
  	padding: 7px 10px 8px 8px;
  	border-radius: 5px;
  	background-color: #262a2e;
  }

  .button-dark:hover {
    background-color: blue;
  }

  /* .button-dark {
    width: 2.5em;
    height: 2.5em;
    display: block;
    font-size: medium;
    font-family: sans-serif;
    font-weight: 400;
    cursor: pointer;
    color: red;
    line-height: 1.3;
    padding: 0.6em 1em 0.5em 0.8em;
    max-width: 100%;
    box-sizing: border-box;
    border: 0 solid #333;
    text-align: left;
    margin-right: 5px;
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
    display: block;
    font-size: medium;
    font-family: sans-serif;
    font-weight: 500;
    cursor: pointer;
    color: red;
    line-height: 1.3;
    padding: 0.6em 1em 0.5em 0.8em;
    max-width: 100%;
    box-sizing: border-box;
    border: 0 solid #333;
    text-align: left;
    margin-right: 5px;
    border-radius: .6em;
    -moz-appearance: none;
    -webkit-appearance: none;
    appearance: none;
    background-color:  linear-gradient(rgba(16, 16, 16, 1), rgba(16, 16, 16, 0.08));
    background-repeat: no-repeat, repeat;
    background-position: right .7em top 50%, 0 0;
    background-size: .65em auto, 100%;
    -webkit-box-shadow: 2px 2px 5px rgba(0,0,0),-0.5px -0.5px 3px rgb(34, 34, 34);
    -moz-box-shadow: 2px 2px 5px rgba(0,0,0), -0.5px -0.5px 3px rgb(34, 34, 34);;
    box-shadow: 2px 2px 3px rgb(0, 0, 0), -1px -1px 3px #ffffff61;
  } */
  .button-dark:active {
    width: 2.5em;
    height: 2.5em;
    display: block;
    font-size: medium;
    /* font-size: 12px; */
    font-family: sans-serif;
    font-weight: 400;
    cursor: pointer;
    color: red;
    line-height: 1.3;
    padding: 0.6em 1em 0.5em 0.8em;
    max-width: 100%;
    box-sizing: border-box;
    /* margin-top: 5px; */
    margin-right: 5px;
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
    padding: 0.6em 1em 0.5em 0.8em;
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
    padding: 0.6em 1em 0.5em 0.8em;;
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
    padding: 0.6em 1em 0.5em 0.8em;
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

  .fullscreen {
    fill: rgb(133, 130, 130);
    enable-background:new 0 0 512 512;
    width: 16px;
  }
  .sidebar {
    fill: rgb(133, 130, 130);
    enable-background:new 0 0 512 512;
    width: 16px;

  }

  .st0{fill-rule:evenodd;clip-rule:evenodd;}

</style>

        <!-- style="{ $fullScreen? `visibility:visible;`: `visibility:hidden` }" -->
<button class="{ $siteMode === 'dark'? 'button-dark' :'button-light' }"
        title="sidebar visibility"
        on:click={ handleClickSideBar }
        >
  <svg  version="1.1"
        id="Layer_1"
        xmlns="http://www.w3.org/2000/svg"
        xmlns:xlink="http://www.w3.org/1999/xlink"
        x="0px" y="0px"
        viewBox="0 0 512 512"
        class="sidebar"
        xml:space="preserve"
        >
    <style type="text/css">

    </style>
    <g>
      <path class="st0"
            d="M448,64H64c-17.7,0-32,14.3-32,32v320c0,17.7,14.3,32,32,32h384c17.7,0,32-14.3,32-32V96
            C480,78.3,465.7,64,448,64z M64,32C28.6,32,0,60.6,0,96v320c0,35.4,28.6,64,64,64h384c35.4,0,64-28.6,64-64V96
            c0-35.4-28.6-64-64-64H64z"
            />
      <rect x="128" y="64"
            class="st0"
            width="32" height="384"/>
    </g>
  </svg>
</button>

<button class="{ $siteMode === 'dark'? 'button-dark' :'button-light' }"
        title="fullscreen mode"
        on:click={ handleClickFullScreen }
        >
  <svg version="1.1"
        id="Layer_1"
        xmlns="http://www.w3.org/2000/svg"
        xmlns:xlink="http://www.w3.org/1999/xlink"
        x="0px" y="20px"
        viewBox="0 0 512 512"
        class="fullscreen"
        xml:space="preserve"
        >

    <g>
      <path class="st0"
        d="M48,32c-8.8,0-16,7.2-16,16v128c0,8.8-7.2,16-16,16s-16-7.2-16-16V48C0,21.5,21.5,0,48,0h128
        c8.8,0,16,7.2,16,16s-7.2,16-16,16H48z M320,16c0-8.8,7.2-16,16-16h128c26.5,0,48,21.5,48,48v128c0,8.8-7.2,16-16,16s-16-7.2-16-16
        V48c0-8.8-7.2-16-16-16H336C327.2,32,320,24.8,320,16z M16,320c8.8,0,16,7.2,16,16v128c0,8.8,7.2,16,16,16h128c8.8,0,16,7.2,16,16
        s-7.2,16-16,16H48c-26.5,0-48-21.5-48-48V336C0,327.2,7.2,320,16,320z M496,320c8.8,0,16,7.2,16,16v128c0,26.5-21.5,48-48,48H336
        c-8.8,0-16-7.2-16-16s7.2-16,16-16h128c8.8,0,16-7.2,16-16V336C480,327.2,487.2,320,496,320z"/>
    </g>
  </svg>
</button>

<!-- <div style='width: 5px;'></div> -->










