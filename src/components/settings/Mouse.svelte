<script>
import { Engine } from 'sema-engine/sema-engine';

	import {
    onMount,
    onDestroy,
    createEventDispatcher
  } from 'svelte'


  import {
    fullScreen,
  } from '../../stores/common.js';

  let engine,
      engineLoaded = false,
      outputText;

  const handleClick = () => {
    // if(engine){
      try{
        const id = "mxy",
              ttype = "mouseXY",
              blockSize = 2;

        // let sab = engine.createSharedBuffer(id, ttype, blockSize);

        const onMouseMove = e => {
          const x = e.offsetX/window.innerWidth;
          const y = e.offsetY/window.innerHeight;
          outputText.innerText = `X:${parseFloat(x).toFixed(5)} Y:${parseFloat(y).toFixed(5)}`;
          // engine.pushDataToSharedBuffer(id, [ x, y ]);
        }

        // Subscribe Left `Alt`-key down event to subscribe mouse move
        document.addEventListener("keydown", e => {
          if(e.keyCode === 18){
            document.addEventListener( 'mousemove', onMouseMove, true )
          }
        });
        // Subscribe Left `Alt`-key UP event to unsubscribe mouse move
        document.addEventListener("keyup", e => {
          if(e.which === 18){
            outputText.innerText = ``;
            document.removeEventListener( 'mousemove', onMouseMove, true );
          }
        });
      } catch (err) {
        console.error("ERROR: Failed to create new channel for mouse data: ", err);
      }
    // }
    // else throw new Error('ERROR: Engine not initialized. Please press Start Engine first.')
  };

  onMount( async () => {
    engine = new Engine();
  });

  onDestroy( () => {
    engine = null;
	});


</script>

<style>


  .button-dark {
    width: 35px;
    height: 30px;
    display: block;
    font-size: 12px;
    font-family: sans-serif;
    font-weight: 400;
    cursor: pointer;
    color: red;
    line-height: 1.3;
    padding: 0.25em 1em 0.75em 0.8em;
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
    display: block;
    font-size: 12px;
    font-family: sans-serif;
    font-weight: 500;
    cursor: pointer;
    color: red;
    line-height: 1.3;
    padding: 0.25em 1em 0.75em 0.8em;
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
    width: 35px;
    display: block;
    font-size: 12px;
    font-family: sans-serif;
    font-weight: 400;
    cursor: pointer;
    color: red;
    line-height: 1.3;
    padding: 0.25em 1em 0.75em 0.8em;
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


  /* .no-mouse {
    padding-top:3px;
    fill:rgb(80, 80, 80);
    enable-background:new 0 0 512 512;
  } */

  .mouse {
    padding-top:3px;
    fill:rgb(133, 130, 130);
    enable-background:new 0 0 512 512;
    width:16px;
  }

</style>



<div style='width: 5px;'></div>

<div style='width:7em; display: flex; {$fullScreen? `visibility:visible;`: `visibility:hidden`}'

      >


  <button class="button-dark" on:click={ handleClick }>
    <svg  version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
          x="0px" y="0px"
          viewBox="5 0 512 512"
          class="mouse"
          xml:space="preserve">
      <g>
        <path d="M409.6,0v34.1H221.9c-14.1,0-25.6,11.5-25.6,25.6v42.7h-33.5c-52.2,0.1-94.5,42.3-94.5,94.5v170.6
          c0,79.6,64.8,144.5,144.5,144.5h1.2c79.6,0,144.5-64.8,144.5-144.5V196.9c-0.1-52.2-42.3-94.5-94.5-94.5h-33.5V68.3h187.7
          c14.1,0,25.6-11.5,25.6-25.6V0L409.6,0z M162.8,136.5h33.5v93.9h-93.9v-33.5C102.4,163.6,129.5,136.6,162.8,136.5z M213.9,477.9
          h-1.2c-60.9-0.1-110.3-49.4-110.3-110.3v-103h221.9v103C324.2,428.4,274.8,477.8,213.9,477.9z M324.3,196.9v33.5h-93.9v-93.9h33.5
          C297.2,136.6,324.2,163.6,324.3,196.9z"/>
      </g>
    </svg>
  </button>

  <span bind:this={outputText}
        class="mouse-outputText">
  </span>

</div>







