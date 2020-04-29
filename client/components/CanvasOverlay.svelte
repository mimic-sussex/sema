<!-- <script>

  // import { splashScreenClicked } from '../store.js';
  // import src from '../../assets/img/sema.svg';

  // let handleClick = () => {
  //   $splashScreenClicked = "hidden";
  // }

</script>
 -->
<style>

  .overlay {
    position: fixed;
    /* Sit on top of the page content */
    display: grid;
    /* Hidden by default */
    width: 100%;
    /* Full width (cover the whole page) */
    height: 100%;
    /* Full height (cover the whole page) */
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    justify-self: center;
    align-content: center;
    background-color: rgba(0, 0, 0, 0.1);
    /* Black background with opacity */
    z-index: 4;
    /* Specify a stack order in case you're using a different order for other elements */
    cursor: auto;
    pointer-events:none;
    /* Add a pointer on hover */
    visibility: visible;
  }

  .button-start-audio {
    margin:0 auto;
    display:block;
    width: 350px;
    height: 350px;
    align-self: stretch;
    font-size: 200%;
    font-family:monospace;
    cursor: pointer;
    border-radius: .4em;
  }


  canvas {
    background-color: rgba(0, 0, 0, 0.0);

   display: block;
   visibility: hidden;
  }
</style>



<div class="overlay">
<canvas id="canvas" width="100%" height="100%" style="opacity:0.0"></canvas>
</div>

<script>

import { onMount} from 'svelte';

var ctx;
var sizex = window.innerWidth;
var sizey = window.innerHeight;

onMount(async () => {
  var c = document.getElementById("canvas");
  console.log(c);
  c.width = window.innerWidth;
  c.height = window.innerHeight;
  // ctx = c.getContext("2d");
  //
  // ctx.globalCompositeOperation = "lighter";
  //
  // ctx.strokeStyle = color;
  // ctx.shadowColor = color;
  //
  // ctx.fillStyle = color;
  // ctx.fillRect(0, 0, sizex, sizey);
  // ctx.fillStyle = "hsla(0, 0%, 10%, 0.2)";

//  render();
});

</script>
