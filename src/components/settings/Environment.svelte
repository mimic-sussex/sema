<script>
  import {
    siteMode,
    fullScreen
  } from '../../stores/common.js';

  import {
    items,
  } from '../../stores/tutorial.js';

  let engineLoaded = false;

  let handleClick = () => {
    window.localStorage["tutorial-" + new Date(Date.now()).toISOString()] = JSON.stringify($items)
  }


</script>

<style>

  .icon-container {
    width: 10px;
    height: 10px;
  }


  .button-dark {
    width: 35px;
    height: 30px;
    padding: 0.2em 0.2em 0.8em 0.8em;
    display: block;
    font-size: 12px;
    font-family: sans-serif;
    font-weight: 400;
    cursor: pointer;
    color: red;
    line-height: 1.3;
    max-width: 100%;
    box-sizing: border-box;
    border: 0 solid #333;
    text-align: left;
    margin-top: 5px;
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

  .button-dark:hover {
    width: 35px;
    height: 30px;
    padding: 0.2em 0.2em 0.8em 0.8em;
    display: block;
    font-size: 12px;
    font-family: sans-serif;
    font-weight: 500;
    cursor: pointer;
    color: red;
    line-height: 1.3;
    max-width: 100%;
    box-sizing: border-box;
    border: 0 solid #333;
    text-align: left;
    margin-top: 5px;
    margin-right: 5px;
    /* box-shadow: 0 1px 0 0px rgba(4, 4, 4, 0.04); */
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
    width: 35px;
    height: 30px;
    padding: 0.2em 0.2em 0.8em 0.8em;
    display: block;
    font-size: 12px;
    font-family: sans-serif;
    font-weight: 400;
    cursor: pointer;
    color: red;
    line-height: 1.3;
    max-width: 100%;
    box-sizing: border-box;
    margin-top: 5px;
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





  .light-mode {
    fill: rgb(133, 130, 130);
    enable-background:new 0 0 512 512;
    padding-bottom:3px;
    width: 15px;
  }

</style>

<button class="button-dark"
        style="{$fullScreen? `visibility:visible;`: `visibility:hidden`}"
        on:click={ handleClick }>
  <div class="icon-container">
    {#if $siteMode === 'dark' }
      <svg version="1.1"
        id="Layer_1"
        xmlns="http://www.w3.org/2000/svg"
        xmlns:xlink="http://www.w3.org/1999/xlink"
        x="0px" y="0px"
        viewBox="0 0 512 512"
        style="enable-background:new 0 0 512 512;width:15px;"
        class="light-mode"
        xml:space="preserve"
        >
        <g id="XMLID_1_">
          <path id="XMLID_9_" d="M466.5,0h-381L0,83.6v382.8C0,491.6,20.4,512,45.5,512h420.9c25.1,0,45.5-20.4,45.5-45.5V45.5
            C512,20.4,491.6,0,466.5,0z M392.1,29.7v60.4H151.5V29.7H392.1z M91.1,481.3v-30.7h330.8v29.7H91.1V481.3z M482.3,465.5
            c0,8.4-6.5,14.9-14.9,14.9h-15.8V420H61.3v60.4H46.5c-8.4,0-14.9-6.5-14.9-14.9V95.7l67.8-66h22.3v90.1h301.1V29.7h45.5
            c8.4,0,14.9,6.5,14.9,14.9v420.9H482.3z M256.5,150.5c-57.6,0-105,47.4-105,105s47.4,105,105,105s105-47.4,105-105
            S314.1,150.5,256.5,150.5z M256.5,330.8c-41.8,0-75.3-33.5-75.3-75.3s33.5-75.3,75.3-75.3s75.3,33.5,75.3,75.3
            S298.3,330.8,256.5,330.8z"/>
        </g>
      </svg>
    {:else if $siteMode === 'light' }
      <svg  version="1.1"
            id="Layer_1"
            xmlns="http://www.w3.org/2000/svg"
            xmlns:xlink="http://www.w3.org/1999/xlink"
            x="0px" y="0px"
            style="enable-background:new 0 0 512 512;width:15px;"
            viewBox="0 0 512 512"
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








