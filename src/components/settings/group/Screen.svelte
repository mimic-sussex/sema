<script>
  import {
    fullScreen,
    sideBarVisible,
    siteMode
  } from '../../../stores/common.js';

  import {
    hideNavbar
  } from '../../../stores/navigation.js';

  import { isActive } from "@roxi/routify";

  let engineLoaded = false;

  let handleClickSideBar = () => {
    $sideBarVisible = !$sideBarVisible;
  }

  let handleClickNavbar = () => {
    $hideNavbar = !$hideNavbar
  }

  const isFullScreen = () => {
    return (( document.fullscreenElement && document.fullscreenElement !== null) ||
      ( document.webkitFullscreenElement && document.webkitFullscreenElement !== null) ||
      ( document.mozFullScreenElement && document.mozFullScreenElement !== null) ||
      ( document.msFullscreenElement && document.msFullscreenElement !== null)) !== undefined;
  }

  const exitHandler = () => {
    if (!document.fullscreenElement && !document.webkitIsFullScreen && !document.mozFullScreen && !document.msFullscreenElement) {
     $fullScreen = !isFullScreen();
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
    $fullScreen = mode;
  }


  const handleClickFullScreen = () => {
    setFullScreenMode(document.querySelector("#sema"), isFullScreen());
  }

</script>

<style>

.button-dark {
		padding: 20;
		color: grey;
		border: none;
    width: 42px;
  	margin: 8px 8px 8px 8px;
  	border-radius: 5px;
  	background-color: #262a2e;
	}

  .button-dark:hover {
    color: white;
  }

  .button-dark:active{
    color: white;
    background-color: #212529;
    border-radius:5px;
    box-shadow: inset 0.25px 0.25px 0.1px 0 #201f1f, inset -0.25px -0.25px 0.1px 0 rgba(255, 255, 255, 0.05);
  }

  .button-light {
		padding: 20;
		color: grey;
		border: none;
    width: 42px;
  	margin: 8px 8px 8px 8px;
  	border-radius: 5px;
  	background-color: #fdf6e3;
	}

  .button-light:hover {
    color: black;
  }

  .button-light:active{
    color: black;
    background-color: grey;
  }

  path {
    transform: translate(-3px, -5px)
  }

  .fullscreen {
    fill: currentColor;
    enable-background:new 0 0 512 512;
    width: 16px;
  }
  .sidebar {
    fill: currentColor;/*rgb(133, 130, 130);*/
    enable-background:new 0 0 512 512;
    width: 16px;

  }

  .navbar-toggle {
    fill: currentColor;/*rgb(133, 130, 130);*/
    enable-background:new 0 0 512 512;
    width: 16px;
  }

  .st0{fill-rule:evenodd;clip-rule:evenodd;}

</style>

{#if $isActive('/playground') }
  <button class="{ $siteMode === 'dark'? 'button-dark' :'button-light' }"
          title="Toggle sidebar visibility"
          style="{( $isActive('/playground') )? `visibility:visible;`: `visibility:collapse`};
                 {$sideBarVisible? '': 'color:red'};"
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
{/if}

<button class="{ $siteMode === 'dark'? 'button-dark' :'button-light' }"
        title="Toggle navbar visibility"
        style="{$hideNavbar? 'color:red': ''};"
        on:click={ handleClickNavbar }
        >
  <svg  version="1.1"
        id="Layer_1"
        xmlns="http://www.w3.org/2000/svg"
        xmlns:xlink="http://www.w3.org/1999/xlink"
        x="0px" y="0px"
        viewBox="0 0 512 512"
        class="navbar-toggle"
        xml:space="preserve"
        style='transform: rotate(90deg);'
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
        title="Toggle fullscreen mode"
        style="{$fullScreen? '' : 'color: #0050A0'};"
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