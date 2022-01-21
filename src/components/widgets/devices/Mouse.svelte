<script>
  import { Engine } from 'sema-engine';
  
    import {
      onMount,
      onDestroy,
      createEventDispatcher
    } from 'svelte'
  
  
    import {
      fullScreen,
      mouseActivated,
      isMouseOverlayVisible,
      siteMode
    } from '../../../stores/common.js';
  
    let engine,
        engineLoaded = false,
        outputText;
  
  
    const id = "mxy",
          ttype = "mouseXY",
          blockSize = 2;
  
    const onMouseMove = e => {
      const x = e.pageX/window.innerWidth;
      const y = e.pageY/window.innerHeight;
      if(outputText){
        outputText.innerText = `X:${parseFloat(x).toFixed(2)} Y:${parseFloat(y).toFixed(2)}`;
      }
      if(engine){
        engine.pushDataToSharedBuffer(id, [ x, y ]);
      }
    }
  
    const onKeyDown = e => {
      if(e.keyCode === 18){
        // $isMouseOverlayVisible = true;
        document.addEventListener( 'mousemove', onMouseMove, true )
      }
    }
  
    const onKeyUp = e => {
      if(e.which === 18){
        if(outputText)
          outputText.innerText = ``;
        // $isMouseOverlayVisible = false;
        document.removeEventListener( 'mousemove', onMouseMove, true );
      }
    }
  
    const deactivateMouse = e => {
      $mouseActivated = false;
      // $isMouseOverlayVisible = false;
      if(outputText)
        outputText.innerText = ``;
      document.removeEventListener( 'mousemove', onMouseMove, true )
      // document.removeEventListener( "keydown", onKeyDown)
      // document.removeEventListener( "keydown", onKeyUp)
    }
  
    const handleClick = () => {
      // if(engine){
        try{
  
          $mouseActivated = !$mouseActivated;
  
          if($mouseActivated){
  
            // if(outputText)
            //   outputText.innerText = `Press ALT \n+ click-drag`;
            // $mouseTrailCaptureActivated = true;
  
            document.addEventListener( 'mousemove', onMouseMove, true )
  
            let sab = engine.createSharedBuffer(id, ttype, blockSize);
  
            // Subscribe Left `Alt`-key down event to subscribe mouse move
            // document.addEventListener("keydown", onKeyDown );
  
            // Subscribe Left `Alt`-key UP event to unsubscribe mouse move
            // document.addEventListener("keyup", onKeyUp);
          }
          else {
            deactivateMouse();
          }
  
        } catch (err) {
          console.error("ERROR: Failed to create new channel for mouse data: ", err);
        }
      // }
      // else throw new Error('ERROR: Engine not initialized. Please press Start Engine first.')
    };
  
    onMount( async () => {
  
  
      if(!engine)
        engine = new Engine();
  
    });
  
    onDestroy( () => {
      deactivateMouse();
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
      color: #999;
      border: none;
      /* width: 42px; */
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

    .button-dark:disabled {
      color:grey;
      /* background-color:grey; */
      cursor:not-allowed;
    }
  
    path {
      transform: translate(-3px, -5px)
    }
  
  
    /* .no-mouse {
      padding-top:3px;
      fill:rgb(80, 80, 80);
      enable-background:new 0 0 512 512;
    } */
  
  
    .mouse-outputText{
      /* padding-top:0.1em; */
      /* width:10em; */
      font-size:medium;
    }
  
    .mouse {
      padding-top:3px;
      enable-background:new 0 0 512 512;
      width:16px;
    }
  
    .mouse-on {
      fill:#0050A0;
    }
  
    .mouse-off {
      fill:rgb(133, 130, 130);
    }

    .button-dark:hover .mouse{
      fill:white;
    }
  
  </style>
  
  
  
  
  <!-- <div style='width:7em; display: flex; {$fullScreen? `visibility:visible;`: `visibility:hidden`}; margin-left:2px' -->
  <div>
    <button class="{ $siteMode === 'dark'? 'button-dark' :'button-light' }"
            title="{$mouseActivated? 'Disable mouse coordinates': 'Display mouse coordinates'}"
            on:click={ handleClick }
            >
      <!-- <div class="icon-container"> -->
        {#if $mouseActivated }
          <svg  version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
                x="0px" y="0px"
                viewBox="5 0 512 512"
                class="mouse { $mouseActivated ? `mouse-on` : `mouse-off` }"
                xml:space="preserve">
            <g>
              <path d="M409.6,0v34.1H221.9c-14.1,0-25.6,11.5-25.6,25.6v42.7h-33.5c-52.2,0.1-94.5,42.3-94.5,94.5v170.6
                c0,79.6,64.8,144.5,144.5,144.5h1.2c79.6,0,144.5-64.8,144.5-144.5V196.9c-0.1-52.2-42.3-94.5-94.5-94.5h-33.5V68.3h187.7
                c14.1,0,25.6-11.5,25.6-25.6V0L409.6,0z M162.8,136.5h33.5v93.9h-93.9v-33.5C102.4,163.6,129.5,136.6,162.8,136.5z M213.9,477.9
                h-1.2c-60.9-0.1-110.3-49.4-110.3-110.3v-103h221.9v103C324.2,428.4,274.8,477.8,213.9,477.9z M324.3,196.9v33.5h-93.9v-93.9h33.5
                C297.2,136.6,324.2,163.6,324.3,196.9z"/>
            </g>
          </svg>
        {:else}
          <svg  version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
                  x="0px" y="0px"
                  viewBox="5 0 512 512"
                  class="mouse { $mouseActivated ? `mouse-on` : `mouse-off` }"
                  xml:space="preserve">
              <g>
                <path d="M409.6,0v34.1H221.9c-14.1,0-25.6,11.5-25.6,25.6v42.7h-33.5c-52.2,0.1-94.5,42.3-94.5,94.5v170.6
                  c0,79.6,64.8,144.5,144.5,144.5h1.2c79.6,0,144.5-64.8,144.5-144.5V196.9c-0.1-52.2-42.3-94.5-94.5-94.5h-33.5V68.3h187.7
                  c14.1,0,25.6-11.5,25.6-25.6V0L409.6,0z M162.8,136.5h33.5v93.9h-93.9v-33.5C102.4,163.6,129.5,136.6,162.8,136.5z M213.9,477.9
                  h-1.2c-60.9-0.1-110.3-49.4-110.3-110.3v-103h221.9v103C324.2,428.4,274.8,477.8,213.9,477.9z M324.3,196.9v33.5h-93.9v-93.9h33.5
                  C297.2,136.6,324.2,163.6,324.3,196.9z"/>
              </g>
            </svg>
          {/if}
    </button>
  
    <span bind:this={outputText}
          class="mouse-outputText">
    </span>
  
  </div>
  
  
  
  
  
  
  
  