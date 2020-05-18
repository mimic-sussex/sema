<script>
  import NoAudio             from '../../assets/img/no-audio.svg';
  import MuteAudio           from '../../assets/img/mute-audio.svg';
  import HighVolumeAudio     from '../../assets/img/high-volume-audio.svg';
  import MediumVolumeAudio   from '../../assets/img/medium-volume-audio.svg';
  import LowVolumeAudio      from '../../assets/img/low-volume-audio.svg';

  import { splashScreenClicked } from '../store.js';


  let handleClick = () => {
    $splashScreenClicked = "hidden";
  }

  let audioContextState = 'no-audio'

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
    color: #fff;
    line-height: 1.3;
    padding: 0.3em 1em 0.7em 1em;
    /* width: 100%; */
    max-width: 100%; 
    box-sizing: border-box;
    border: 0 solid #333;
    /* box-shadow: 0 1px 0 0px rgba(4, 4, 4, 0.04); */
    border-radius: .6em;
    margin-top: 5px;
    margin-right: 5px;
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
    -webkit-box-shadow: 2px 2px 5px rgba(0,0,0),-1px -1px 1px rgb(34, 34, 34);
    -moz-box-shadow: 2px 2px 5px rgba(0,0,0), -1px -1px 1px rgb(34, 34, 34);;
    box-shadow: 2px 2px 3px rgb(0, 0, 0), -1px -1px 3px #ffffff61;
    
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

  .mute-audio {
    fill: rgb(133, 130, 130);
  }

</style>

<button class="button-dark" on:click={handleClick}>
  <div class="icon-container">
    {#if audioContextState == 'running' }
    <svg xmlns="http://www.w3.org/2000/svg" class="path audio" width="20" height="20" viewBox="0 0 32 32">
        <path style="text-indent:0;text-align:start;line-height:normal;text-transform:none;block-progression:tb;-inkscape-font-specification:Bitstream Vera Sans" d="M 15 4.59375 L 13.28125 6.28125 L 8.5625 11 L 5 11 L 4 11 L 4 12 L 4 20 L 4 21 L 5 21 L 8.5625 21 L 13.28125 25.71875 L 15 27.40625 L 15 25 L 15 7 L 15 4.59375 z M 24.125 6.375 L 22.71875 7.78125 C 24.74275 9.92925 26 12.822 26 16 C 26 19.178 24.74275 22.06975 22.71875 24.21875 L 24.125 25.625 C 26.51 23.113 28 19.729 28 16 C 28 12.271 26.51 8.886 24.125 6.375 z M 21.3125 9.1875 L 19.90625 10.625 C 21.20625 12.048 22 13.925 22 16 C 22 18.075 21.20625 19.951 19.90625 21.375 L 21.3125 22.8125 C 22.9735 21.0255 24 18.626 24 16 C 24 13.374 22.9735 10.9735 21.3125 9.1875 z M 13 9.4375 L 13 22.5625 L 9.71875 19.28125 L 9.40625 19 L 9 19 L 6 19 L 6 13 L 9 13 L 9.40625 13 L 9.71875 12.71875 L 13 9.4375 z M 18.5 12.03125 L 17.0625 13.46875 C 17.6405 14.16275 18 15.028 18 16 C 18 16.972 17.6405 17.83725 17.0625 18.53125 L 18.5 19.96875 C 19.439 18.90975 20 17.523 20 16 C 20 14.477 19.439 13.09025 18.5 12.03125 z" overflow="visible" font-family="Bitstream Vera Sans"/>
    </svg>
    {:else if audioContextState == 'no-audio' } 
    <svg xmlns="http://www.w3.org/2000/svg" class="path no-audio" width="20" height="20" viewBox="0 0 32 32">
      <path style="text-indent:0;text-align:start;line-height:normal;text-transform:none;block-progression:tb;-inkscape-font-specification:Bitstream Vera Sans" d="M 15 4.59375 L 13.28125 6.28125 L 8.5625 11 L 5 11 L 4 11 L 4 12 L 4 20 L 4 21 L 5 21 L 8.5625 21 L 13.28125 25.71875 L 15 27.40625 L 15 25 L 15 7 L 15 4.59375 z M 13 9.4375 L 13 22.5625 L 9.71875 19.28125 L 9.40625 19 L 9 19 L 6 19 L 6 13 L 9 13 L 9.40625 13 L 9.71875 12.71875 L 13 9.4375 z M 20.21875 11.78125 L 18.78125 13.21875 L 21.5625 16 L 18.78125 18.78125 L 20.21875 20.21875 L 23 17.4375 L 25.78125 20.21875 L 27.21875 18.78125 L 24.4375 16 L 27.21875 13.21875 L 25.78125 11.78125 L 23 14.5625 L 20.21875 11.78125 z" overflow="visible" font-family="Bitstream Vera Sans"/>
    </svg>
    {:else if audioContextState == 'high-audio' } 
    <svg xmlns="http://www.w3.org/2000/svg" class="path path" width="20" height="20" viewBox="0 0 32 32">
      <path style="text-indent:0;text-align:start;line-height:normal;text-transform:none;block-progression:tb;-inkscape-font-specification:Bitstream Vera Sans" d="M 15 4.59375 L 13.28125 6.28125 L 8.5625 11 L 5 11 L 4 11 L 4 12 L 4 20 L 4 21 L 5 21 L 8.5625 21 L 13.28125 25.71875 L 15 27.40625 L 15 25 L 15 7 L 15 4.59375 z M 13 9.4375 L 13 22.5625 L 9.71875 19.28125 L 9.40625 19 L 9 19 L 6 19 L 6 13 L 9 13 L 9.40625 13 L 9.71875 12.71875 L 13 9.4375 z M 20.21875 11.78125 L 18.78125 13.21875 L 21.5625 16 L 18.78125 18.78125 L 20.21875 20.21875 L 23 17.4375 L 25.78125 20.21875 L 27.21875 18.78125 L 24.4375 16 L 27.21875 13.21875 L 25.78125 11.78125 L 23 14.5625 L 20.21875 11.78125 z" overflow="visible" font-family="Bitstream Vera Sans"/>
    </svg>
    {:else if audioContextState == 'medium-audio' } 
    <svg xmlns="http://www.w3.org/2000/svg" class="path audio" width="20" height="20" viewBox="0 0 32 32">
      <path style="text-indent:0;text-align:start;line-height:normal;text-transform:none;block-progression:tb;-inkscape-font-specification:Bitstream Vera Sans" d="M 15 4.59375 L 13.28125 6.28125 L 8.5625 11 L 5 11 L 4 11 L 4 12 L 4 20 L 4 21 L 5 21 L 8.5625 21 L 13.28125 25.71875 L 15 27.40625 L 15 25 L 15 7 L 15 4.59375 z M 13 9.4375 L 13 22.5625 L 9.71875 19.28125 L 9.40625 19 L 9 19 L 6 19 L 6 13 L 9 13 L 9.40625 13 L 9.71875 12.71875 L 13 9.4375 z M 20.21875 11.78125 L 18.78125 13.21875 L 21.5625 16 L 18.78125 18.78125 L 20.21875 20.21875 L 23 17.4375 L 25.78125 20.21875 L 27.21875 18.78125 L 24.4375 16 L 27.21875 13.21875 L 25.78125 11.78125 L 23 14.5625 L 20.21875 11.78125 z" overflow="visible" font-family="Bitstream Vera Sans"/>
    </svg>
    {:else if audioContextState == 'low-audio' } 
    <svg xmlns="http://www.w3.org/2000/svg" class="path audio" width="20" height="20" viewBox="0 0 32 32">
      <path style="text-indent:0;text-align:start;line-height:normal;text-transform:none;block-progression:tb;-inkscape-font-specification:Bitstream Vera Sans" d="M 15 4.59375 L 13.28125 6.28125 L 8.5625 11 L 5 11 L 4 11 L 4 12 L 4 20 L 4 21 L 5 21 L 8.5625 21 L 13.28125 25.71875 L 15 27.40625 L 15 25 L 15 7 L 15 4.59375 z M 13 9.4375 L 13 22.5625 L 9.71875 19.28125 L 9.40625 19 L 9 19 L 6 19 L 6 13 L 9 13 L 9.40625 13 L 9.71875 12.71875 L 13 9.4375 z M 20.21875 11.78125 L 18.78125 13.21875 L 21.5625 16 L 18.78125 18.78125 L 20.21875 20.21875 L 23 17.4375 L 25.78125 20.21875 L 27.21875 18.78125 L 24.4375 16 L 27.21875 13.21875 L 25.78125 11.78125 L 23 14.5625 L 20.21875 11.78125 z" overflow="visible" font-family="Bitstream Vera Sans"/>
    </svg>
    {:else if audioContextState == 'mute-audio' } 
    <svg xmlns="http://www.w3.org/2000/svg" class="path mute-audio" width="20" height="20" viewBox="0 0 32 32">
      <path style="text-indent:0;text-align:start;line-height:normal;text-transform:none;block-progression:tb;-inkscape-font-specification:Bitstream Vera Sans" d="M 15 4.59375 L 13.28125 6.28125 L 8.5625 11 L 5 11 L 4 11 L 4 12 L 4 20 L 4 21 L 5 21 L 8.5625 21 L 13.28125 25.71875 L 15 27.40625 L 15 25 L 15 7 L 15 4.59375 z M 13 9.4375 L 13 22.5625 L 9.71875 19.28125 L 9.40625 19 L 9 19 L 6 19 L 6 13 L 9 13 L 9.40625 13 L 9.71875 12.71875 L 13 9.4375 z M 20.21875 11.78125 L 18.78125 13.21875 L 21.5625 16 L 18.78125 18.78125 L 20.21875 20.21875 L 23 17.4375 L 25.78125 20.21875 L 27.21875 18.78125 L 24.4375 16 L 27.21875 13.21875 L 25.78125 11.78125 L 23 14.5625 L 20.21875 11.78125 z" overflow="visible" font-family="Bitstream Vera Sans"/>
    </svg>
    {/if}
  </div>
</button>



