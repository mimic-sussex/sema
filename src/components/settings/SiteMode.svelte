<script>
  // import NoAudio             from '../../assets/img/no-audio.svg';
  // import MuteAudio           from '../../assets/img/mute-audio.svg';
  // import HighVolumeAudio     from '../../assets/img/high-volume-audio.svg';
  // import MediumVolumeAudio   from '../../assets/img/medium-volume-audio.svg';
  // import LowVolumeAudio      from '../../assets/img/low-volume-audio.svg';

  import { audioEngineStatus } from '../../stores/common.js';

  let engineLoaded = false;

  let handleClick = () => {

    // if(!engineLoaded){
    //   $audioEngineStatus = 'no-audio';
    //   engineLoaded = true;
    // }
    // else
     $audioEngineStatus === 'running'?
        $audioEngineStatus = 'paused': $audioEngineStatus = 'running';
  }



</script>

<style>

  .icon-container {
    width: 10px;
    height: 10px;
  }


  .button-dark {
    width: 40px;
    display: block;
    font-size: 12px;
    font-family: sans-serif;
    font-weight: 400;
    cursor: pointer;
    color: red;
    line-height: 1.3;
    padding: 0.3em 1em 0.7em 1em;
    max-width: 100%;
    box-sizing: border-box;
    border: 0 solid #333;
    text-align: left;
    margin-top: 5px;
    margin-right: 5px;
    /* box-shadow: 0 1px 0 0px rgba(4, 4, 4, 0.04); */
    border-radius: .6em;
    /* border-right-color: rgba(34,37,45, 0.1);
    border-right-style: solid;
    border-right-width: 1px;
    border-bottom-color: rgba(34,37,45, 0.1);
    border-bottom-style: solid;
    border-bottom-width: 1px; */
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

  .button-dark:hover {
    width: 40px;
    display: block;
    font-size: 12px;
    font-family: sans-serif;
    font-weight: 500;
    cursor: pointer;
    color: red;
    line-height: 1.3;
    padding: 0.3em 1em 0.7em 1em;
    max-width: 100%;
    box-sizing: border-box;
    border: 0 solid #333;
    text-align: left;
    margin-top: 5px;
    margin-right: 5px;
    /* box-shadow: 0 1px 0 0px rgba(4, 4, 4, 0.04); */
    border-radius: .6em;
    /* border-right-color: rgba(34,37,45, 0.1);
    border-right-style: solid;
    border-right-width: 1px;
    border-bottom-color: rgba(34,37,45, 0.1);
    border-bottom-style: solid;
    border-bottom-width: 1px; */
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
    width: 40px;
    display: block;
    font-size: 12px;
    font-family: sans-serif;
    font-weight: 400;
    cursor: pointer;
    color: red;
    line-height: 1.3;
    padding: 0.3em 1em 0.7em 1em;
    max-width: 100%;
    box-sizing: border-box;
    margin-top: 5px;
    margin-right: 5px;
    /* border: 0 solid #333; */
    text-align: left;
    /* box-shadow: 0 1px 0 0px rgba(4, 4, 4, 0.04); */
    /* border-radius: .6em; */
    /* border-right-color: rgba(34,37,45, 0.1);
    border-right-style: solid;
    border-right-width: 1px;
    border-bottom-color: rgba(34,37,45, 0.1);
    border-bottom-style: solid;
    border-bottom-width: 1px; */
    -moz-appearance: none;
    -webkit-appearance: none;
    appearance: none;
    background-color:  rgba(16, 16, 16, 0.04);
    /* background-image: url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23007CB2%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E'),
      linear-gradient(to bottom, #ffffff 0%,#e5e5e5 100%); */
    background-repeat: no-repeat, repeat;
    /* background-position: right .7em top 50%, 0 0; */
    background-size: .65em auto, 100%;
    /* -webkit-box-shadow: -1px -1px 1px rgb(34, 34, 34), 2px 2px 5px rgba(0,0,0),;
    -moz-box-shadow: -1px -1px 1px rgb(34, 34, 34), 2px 2px 5px rgba(0,0,0), ;
    box-shadow:  -1px -1px 3px #ffffff61, 2px 2px 3px rgb(0, 0, 0); */
    box-shadow:  -1px -1px 3px rgba(16, 16, 16, 0.4), 0.5px 0.5px 0.5px rgba(16, 16, 16, 0.04);
  }




  path {

    transform: translate(-3px, -5px)
  }

  .audio {
    fill: #0050A0;
  }

  .no-audio {
    fill: red;
  }

  .light-mode {
    fill: rgb(133, 130, 130);
    enable-background:new 0 0 512 512;
    padding-bottom:3px;
    width: 16px;
  }

</style>

<button class="button-dark" on:click={ handleClick }>
  <div class="icon-container">
    {#if $audioEngineStatus === 'running' }

      <svg  version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
            x="0px" y="0px"

            viewBox="0 0 512 512"
            class="light-mode"
            xml:space="preserve"
            >
        <g>
          <path d="M256,149.3v21.3c23.6,0,44.8,9.5,60.3,25c15.5,15.5,25,36.7,25,60.3c0,23.6-9.5,44.8-25,60.3c-15.5,15.5-36.7,25-60.3,25
            c-23.6,0-44.8-9.5-60.3-25c-15.5-15.5-25-36.7-25-60.3c0-23.6,9.5-44.8,25-60.3c15.5-15.5,36.7-25,60.3-25V149.3V128
            c-70.7,0-128,57.3-128,128c0,70.7,57.3,128,128,128c70.7,0,128-57.3,128-128c0-70.7-57.3-128-128-128V149.3z"/>
          <path d="M234.7,21.3V64c0,11.8,9.6,21.3,21.3,21.3s21.3-9.6,21.3-21.3V21.3C277.3,9.6,267.8,0,256,0S234.7,9.6,234.7,21.3"/>
          <path d="M234.7,448v42.7c0,11.8,9.6,21.3,21.3,21.3s21.3-9.6,21.3-21.3V448c0-11.8-9.6-21.3-21.3-21.3S234.7,436.2,234.7,448"/>
          <path d="M74.9,105.1l30.3,30.3c8.3,8.3,21.8,8.3,30.2,0c8.3-8.3,8.3-21.8,0-30.2l-30.3-30.3c-8.3-8.3-21.8-8.3-30.2,0
            S66.6,96.8,74.9,105.1"/>
          <path d="M376.6,406.8l30.3,30.3c8.3,8.3,21.8,8.3,30.2,0c8.3-8.3,8.3-21.8,0-30.2l-30.3-30.3c-8.3-8.3-21.8-8.3-30.2,0
            S368.3,398.4,376.6,406.8"/>
          <path d="M21.3,277.3H64c11.8,0,21.3-9.6,21.3-21.3c0-11.8-9.6-21.3-21.3-21.3H21.3C9.6,234.7,0,244.2,0,256
            C0,267.8,9.6,277.3,21.3,277.3"/>
          <path d="M448,277.3h42.7c11.8,0,21.3-9.6,21.3-21.3c0-11.8-9.6-21.3-21.3-21.3H448c-11.8,0-21.3,9.6-21.3,21.3
            C426.7,267.8,436.2,277.3,448,277.3"/>
          <path d="M105.1,437.1l30.3-30.3c8.3-8.3,8.3-21.8,0-30.2s-21.8-8.3-30.2,0l-30.3,30.3c-8.3,8.3-8.3,21.8,0,30.2
            C83.3,445.4,96.8,445.4,105.1,437.1"/>
          <path d="M406.8,135.4l30.3-30.3c8.3-8.3,8.3-21.8,0-30.2s-21.8-8.3-30.2,0l-30.3,30.3c-8.3,8.3-8.3,21.8,0,30.2
            C384.9,143.7,398.4,143.7,406.8,135.4"/>
        </g>
      </svg>
    {:else if $audioEngineStatus === 'no-audio' }
      <svg  version="1.1"
            id="Layer_1"
            xmlns="http://www.w3.org/2000/svg"
            xmlns:xlink="http://www.w3.org/1999/xlink"
            x="0px" y="0px"
            viewBox="0 0 512 512"
            style="enable-background:new 0 0 512 512;width:15px;"
            xml:space="preserve"
            >
        <g>
          <path d="M179,0C75,34.9,0,132.9,0,248.8C0,394.2,117.8,512,263.2,512c115.8,0,213.9-75,248.8-179c-26.3,8.5-54.6,14.5-84.3,14.5
            c-145.4,0-263.2-117.8-263.2-263.2C164.5,54.6,169.8,26.3,179,0z"/>
        </g>
      </svg>
    {/if}
  </div>
</button>

<div style='width: 10px;'></div>








