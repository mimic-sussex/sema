<script>
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	const dispatch = createEventDispatcher();

  import { PubSub } from '../../messaging/pubSub.js';

  let messaging = new PubSub();

  export let id;
  export let name;
	export let type;
  export let mode;
  export let hasFocus;
  export let background;

	export let lineNumbers;
	export let theme;
	// export let content;
  // export let static; // Error: ParseError: The keyword 'static' is reserved
  // export let responsive;
  // export let resizable;
  // export let resize;
  // export let draggable;
  // export let drag;
  export let min = {};
  export let max = {};
  // export let x;
  // export let y;
  // export let w;
  // export let h;
  export let component;


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

  const drawFrequencyData = drawContext => {
    for (let i = 0; i < frequencyBinCount; i++) {
      let value = frequencyDataArray[i];
      let percent = value / 255;
      let height = canvas.offsetHeight * percent;
      let offset = canvas.offsetHeight - height - 1;
      let barWidth = canvas.offsetWidth/frequencyBinCount;
      let hue = i/frequencyBinCount * 255;
      drawContext.fillStyle = 'hsl(' + hue + ', 100%, 75%)';
      drawContext.fillRect(i * barWidth, offset, barWidth, canvas.offsetHeight);
    }
  }

  const drawTimeData = drawContext => {
    for (let i = 0; i < frequencyBinCount; i++) {
      let value = timeDataArray[i];
      let percent = value / 255;
      let height = canvas.offsetHeight * percent;
      let offset = canvas.offsetHeight - height - 1;
      let barWidth = canvas.offsetWidth/frequencyBinCount;
      drawContext.fillStyle = 'white';
      drawContext.fillRect(i * barWidth, offset, barWidth, 2);
    }
  }

	const renderLoop = () => {

    if (isRendering) {
      frame = requestAnimationFrame(renderLoop);
      // console.log(`canvas w:${canvas.width} h:${canvas.height}`);

      let drawContext = canvas.getContext('2d');
      drawContext.canvas.width = canvas.offsetWidth;    // needed for 'automatic' resizing the canvas to current size
      drawContext.canvas.height = canvas.offsetHeight;  // TODO: Optimise by doing this only on canvas resize call
      drawContext.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);

      if( mode === 'oscilloscope' ) drawTimeData(drawContext);
      else if( mode === 'spectrogram' ) drawFrequencyData(drawContext);
      else {
        drawFrequencyData(drawContext);
        drawTimeData(drawContext);
      }
    }
    else return;
	};

  const toggleRendering = () => {

    console.log('toggleRender')
    if(isRendering){
      cancelAnimationFrame(frame);
    }else{
      frame = requestAnimationFrame(renderLoop);
    }
    isRendering = !isRendering;

    hasFocus = true;
    console.log("click");
    dispatch('change', {
      prop:'hasFocus',
      value: true
    });
  }

  let log = e => { /* console.log(...e); */ }

  onMount(async () => {
    // Request the creation of an WAAPI analyser to the Audio Engine

    messaging.publish("add-engine-analyser", { id } );

    canvas.addEventListener('click', () => toggleRendering(), false);

    messaging.subscribe('analyser-data', e => updateAnalyserByteData(e) );
    log( id, name, type, lineNumbers, hasFocus, theme, background, data, responsive, resizable, resize, draggable, drag, min, max, x, y, w, h, component );
    renderLoop();
	});

  onDestroy(async () => {
    isRendering = false;
   	return () => cancelAnimationFrame(frame);
	})

</script>

<style>
  /* .canvas-container {
    height: 100%;
    width: 100%;
    background: transparent;
    font: 400 14px/1.7 var(--font-mono);
    color: var(--base);

		position: absolute;
		top: 0;
		left: 0;
		background-color: rgba(255,255,255,0.7);
		padding: 1em;
  } */

  canvas {
    /* opacity:0.1; */
    background-color: rgb(16, 16, 16);
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


<canvas bind:this={canvas}
        class="canvas"
        >
        </canvas>

