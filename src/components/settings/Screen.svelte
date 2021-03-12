<script>
  // import NoAudio             from '../../assets/img/no-audio.svg';
  // import MuteAudio           from '../../assets/img/mute-audio.svg';
  // import HighVolumeAudio     from '../../assets/img/high-volume-audio.svg';
  // import MediumVolumeAudio   from '../../assets/img/medium-volume-audio.svg';
  // import LowVolumeAudio      from '../../assets/img/low-volume-audio.svg';

  import {
    fullScreen,
    sideBarVisible
  } from '../../stores/common.js';

  let engineLoaded = false;

  let handleClick = () => {

  }



</script>

<style>

  .button-dark {
    width: 40px;
    height: 30px;
    display: block;
    font-size: 12px;
    font-family: sans-serif;
    font-weight: 400;
    cursor: pointer;
    color: red;
    line-height: 1.3;
    padding: 0.5em 1em 0.5em 1em;;
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
    padding: 0.5em 1em 0.5em 1em;
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

<button class="button-dark" on:click={ handleClick }>
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

<div style='width: 5px;'></div>

<button class="button-dark" on:click={ handleClick }>
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








