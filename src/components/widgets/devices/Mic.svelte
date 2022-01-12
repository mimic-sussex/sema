<!-- Microphone -->
<script>
  import { Engine } from 'sema-engine';

  import {
    inputStreamConnected,
    siteMode
  } from '../../../stores/common.js';

  let engine,
      engineLoaded = false
      ;

    let handleConnectInputStream = async () => {

  if(!engine){
    engine = new Engine();
  }
  if( !$inputStreamConnected ) {
    $inputStreamConnected = await engine.connectMediaStream();
  } else {
    $inputStreamConnected = await engine.disconnectMediaStream();
  }
  }
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

  .audio-active {
    fill: #0050A0;
  }

  .audio-inactive {
    fill: rgb(133, 130, 130);
  }
  
</style>


<button class="{ $siteMode === 'dark'? 'button-dark' :'button-light' }"
        title="{$inputStreamConnected? 'Disable microphone' : 'Enable microphone'}"
        style=''
        on:click={ handleConnectInputStream }>
    <div class="icon-container">
        <!-- <svg version="1.1"
              id="Layer_1"
              xmlns="http://www.w3.org/2000/svg"
              xmlns:xlink="http://www.w3.org/1999/xlink"
              x="0px" y="0px"
              width="16" height="16"

              class="path { $inputStreamConnected? 'audio-active':'audio-inactive' }"
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
      </svg> -->
        
      <svg xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        fill="currentColor"
         class="{ $inputStreamConnected? 'audio-active':'audio-inactive' }"
         viewBox="0 0 16 16">
        <path d="M3.5 6.5A.5.5 0 0 1 4 7v1a4 4 0 0 0 8 0V7a.5.5 0 0 1 1 0v1a5 5 0 0 1-4.5 4.975V15h3a.5.5 0 0 1 0 1h-7a.5.5 0 0 1 0-1h3v-2.025A5 5 0 0 1 3 8V7a.5.5 0 0 1 .5-.5z"/>
        <path d="M10 8a2 2 0 1 1-4 0V3a2 2 0 1 1 4 0v5zM8 0a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V3a3 3 0 0 0-3-3z"/>
      </svg>



    </div>
  </button>