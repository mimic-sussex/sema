<script>
	import { onMount, onDestroy } from 'svelte';

  import { PubSub } from '../../messaging/pubSub.js';

  let messaging = new PubSub();

  export let mode;

  let fftSize = 256;   
  let frequencyBinCount = 128;
  let smoothingTimeConstant = 0.8;
  let frequencyDataArray = [];
  let timeDataArray = [];

  let canvas;
  
	let frame;
  let isRendering = true; 

  function randomBytes() {
    for (let i = 0; i < frequencyBinCount; i++) {
      frequencyDataArray[i] = Math.floor(Math.random() * canvas.offsetWidth);
      timeDataArray[i] = Math.floor(Math.random() * canvas.offsetWidth);
    } 
  }

  let updateAnalyserByteData = e => {
    // console.log("updateAnalyserByteData");
    // console.log(e);
    if(e !== undefined){
      smoothingTimeConstant = e.smoothingTimeConstant;
      fftSize = e.fftSize;
      frequencyDataArray = e.frequencyDataArray;
      timeDataArray = e.timeDataArray;
    }
  }

  let getFrequencyValue = function(freq) {
    var nyquist = context.sampleRate/2;
    var index = Math.round(freq/nyquist * this.freqs.length);
    return this.freqs[index];
  }

	const renderLoop = () => {
     
    if (isRendering) {
      frame = requestAnimationFrame(renderLoop);
      // console.log(`canvas w:${canvas.width} h:${canvas.height}`);
    }  
    
    let drawContext = canvas.getContext('2d');
    
    drawContext.canvas.width = canvas.offsetWidth;    // needed for 'automatic' resizing the canvas to current size
    drawContext.canvas.height = canvas.offsetHeight;  // TODO: Optimise by doing this only on canvas resize call
    
    drawContext.fillStyle = 'rgb(16, 16, 16)';        // paint background
    drawContext.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
    // Frequency domain chart
    for (let i = 0; i < frequencyBinCount; i++) {
      let value = frequencyDataArray[i];
      let percent = value / 255;
      let height = canvas.offsetHeight * percent;
      let offset = canvas.offsetHeight - height - 1;
      let barWidth = canvas.offsetWidth/frequencyBinCount;
      let hue = i/frequencyBinCount * 255;
      drawContext.fillStyle = 'hsl(' + hue + ', 100%, 75%)';
      // drawContext.fillStyle = 'hsl(' + hue + ', 100%, 75%)';
      drawContext.fillRect(i * barWidth, offset, barWidth, height);
    }
    // Time domain chart
    for (let i = 0; i < frequencyBinCount; i++) {
      let value = timeDataArray[i];
      let percent = value / 255;
      let height = canvas.offsetHeight * percent;
      let offset = canvas.offsetHeight - height - 2;
      let barWidth = canvas.offsetWidth/frequencyBinCount;
      drawContext.fillStyle = 'white';
      drawContext.fillRect(i * barWidth, offset, 2, 4);
    }
	};

  const toggleRendering = () => {

    console.log('toggleRender')
    if(isRendering){
      cancelAnimationFrame(frame);
    }else{
      frame = requestAnimationFrame(renderLoop);  
    }
    isRendering = !isRendering;
  }


  onMount(async () => {
    canvas.addEventListener('onclick', () => toggleRendering(), false);
    messaging.subscribe('analyser-data', e => updateAnalyserByteData(e) );
    renderLoop();
	});

  onDestroy(async () => {
    isRendering = false;
   	return () => cancelAnimationFrame(frame);
	})

</script>

<style>
  .canvas-container {
    height: 100%;
    width: 100%;
    background: transparent;
    font: 400 14px/1.7 var(--font-mono);
    color: var(--base);

		position: absolute;
		top: 0;
		left: 0;
		background-color: rgba(255,255,255,0.7);
		/* padding: 1em; */
  }

  canvas {
    /* opacity:0.1; */
    /* background-color: rgba(0, 0, 0, 0.1); */
    height: 100%;
    width: 100%;
    /* display: block; */
    visibility: visible;
    border-radius: 2px;
    /* display: inline-block; 1 */
    vertical-align: baseline; /* 2 */
    /*left: 50%;
    margin: -200px 0 0 -200px;
    position: absolute;
    top: 50%; */
  }
  
</style>


<!-- <div class="canvas-container"> -->
  <canvas bind:this={canvas} 
          class="canvas"
          style="background-color:blue;"
          onclick={ () => toggleRendering() } ></canvas>
<!-- </div> -->

