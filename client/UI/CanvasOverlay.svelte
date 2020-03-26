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

  .logo-container {
    float: none;
    width: 60%;
    height: 70%;
    margin: 0 auto;
    display: grid;
  }

  .sema-logo {
    width: 100%;
    height: auto;
  }

  .sema-type {
    width: 100%;
    height: auto;
    font-size:150%;
    margin: 0px 0px 0px 0px;
    color: rgb(50, 50, 50);
    /* font-family: 'LatoWebBlack';  */
  }

  canvas {
    opacity:0.1;
    background-color: rgba(0, 0, 0, 0.1);

   display: block;
   visibility: visible;
  /*left: 50%;
  margin: -200px 0 0 -200px;
  position: absolute;
  top: 50%; */
  }
</style>



<!-- <div class="overlay" style='visibility:{$splashScreenClicked}'>
  <button class="button-start-audio" on:click={handleClick}>
    <div class="logo-container">
      <img {src} class="sema-logo" alt="sema logo image">
      <span class="sema-type">Sema</span>
      <br>
      <br>
    </div>
  </button>
</div> -->
<div class="overlay">
<canvas id="canvas" width="100%" height="100%"></canvas>
</div>

<script>

import { onMount, onDestroy } from 'svelte';

var ctx;
var size = 500;
var center = {x: size / 2, y: 20};
var minSegmentHeight = 5;
var groundHeight = size - 20;
var color = "hsl(180, 80%, 80%)";
var roughness = 2;
var maxDifference = size / 5;


function render() {
  ctx.shadowBlur = 0;
  ctx.globalCompositeOperation = "source-over";
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = "lighter";
  ctx.shadowBlur = 15;
  var lightning = createLightning();
  ctx.beginPath();
  for (var i = 0; i < lightning.length; i++) {
    ctx.lineTo(lightning[i].x, lightning[i].y);
  }
  ctx.stroke();
  console.log(ctx)
  requestAnimationFrame(render);
}

function createLightning() {
  var segmentHeight = groundHeight - center.y;
  var lightning = [];
  lightning.push({x: center.x, y: center.y});
  lightning.push({x: Math.random() * (size - 100) + 50, y: groundHeight + (Math.random() - 0.9) * 50});
  var currDiff = maxDifference;
  while (segmentHeight > minSegmentHeight) {
    var newSegments = [];
    for (var i = 0; i < lightning.length - 1; i++) {
      var start = lightning[i];
      var end = lightning[i + 1];
      var midX = (start.x + end.x) / 2;
      var newX = midX + (Math.random() * 2 - 1) * currDiff;
      newSegments.push(start, {x: newX, y: (start.y + end.y) / 2});
    }

    newSegments.push(lightning.pop());
    lightning = newSegments;

    currDiff /= roughness;
    segmentHeight /= 2;
  }
  return lightning;
}

onMount(async () => {
  var c = document.getElementById("canvas");
  console.log(c);
  c.width = 500;
  c.height = 500;
  ctx = c.getContext("2d");

  ctx.globalCompositeOperation = "lighter";

  ctx.strokeStyle = color;
  ctx.shadowColor = color;

  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "hsla(0, 0%, 10%, 0.2)";

  render();
});

</script>
