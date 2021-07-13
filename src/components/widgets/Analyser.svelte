<script>
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	const dispatch = createEventDispatcher();

  import { PubSub } from '../../utils/pubSub.js';

  import {
    Engine
  } from 'sema-engine'

  let engine;

  let messaging = new PubSub();

  export let id;
  export let name;
	export let type;
  export let mode;
  export let hasFocus;
  export let background;
	export let lineNumbers;
	export let theme;
  export let component;
  export let channelID = 1;
  export let className;
  export { className as class };

  let fftSize = 256,
      frequencyBinCount = 128,
      frequencyBinCounter = 128,
      smoothingTimeConstant = 0.8,
      frequencyDataArray = [],
      timeDataArray = [],
      shift = false;

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
      let percent = value ;
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


      let drawContext = canvas.getContext('2d');
      drawContext.canvas.width = canvas.offsetWidth;    // needed for 'automatic' resizing the canvas to current size
      drawContext.canvas.height = canvas.offsetHeight;  // TODO: Optimise by doing this only on canvas resize call
      drawContext.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);

      sabRender();

      if( mode === 'oscilloscope' ) {
        drawTimeData(drawContext);
      }
      else if( mode === 'spectrogram' ) drawFrequencyData(drawContext);
      else {
        drawFrequencyData(drawContext);
        drawTimeData(drawContext);
      }
    }
    else return;
	};

  function sabRender() {
    try {

      // for (let v in engine.sharedArrayBuffers) {
        if(engine
            && engine.sharedArrayBuffers
            && engine.sharedArrayBuffers[channelID]
            && engine.sharedArrayBuffers[channelID].ttype === 'scope'){

          let avail = engine.sharedArrayBuffers[channelID].rb.available_read();

          if ( avail > 0 && avail != engine.sharedArrayBuffers[channelID].rb.capacity ) {

            for (let i = 0; i < avail; i += engine.sharedArrayBuffers[channelID].blocksize) {

              let val = new Float64Array(engine.sharedArrayBuffers[channelID].blocksize);
              // ( !shift && 0 === frequencyBinCounter-- ) ? ( shift = true ) : undefined;
              // shift ? timeDataArray.shift() : undefined;
              // timeDataArray.push(val);
              engine.sharedArrayBuffers[channelID].rb.pop(val);
            }
          }
        }

    } catch (error) {
      console.error(error);
    }
  }
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

    if(!engine){
      engine = new Engine();
    }
    // console.log('analyser')
    // sabRender()

    // Request the creation of an WAAPI analyser to the Audio Engine

    // messaging.publish("add-engine-analyser", { id } );

    engine.createAnalyser(id, e => updateAnalyserByteData(e) )

    canvas.addEventListener('click', () => toggleRendering(), false);

    // engine.

    // messaging.subscribe(`${id}-analyser-data`, e => updateAnalyserByteData(e) );
    log( id, name, type, className, lineNumbers, hasFocus, theme, background, component );

    renderLoop();
  });

  onDestroy(async () => {
    isRendering = false;
    engine.removeAnalyser( { id } );
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
    border-radius: 1px;
    /* display: inline-block; 1 */
    vertical-align: baseline; /* 2 */
    /*left: 50%;
    margin: -200px 0 0 -200px;
    position: absolute;
    top: 50%; */
  }

</style>


<canvas bind:this={ canvas }
        class="canvas"
        >
</canvas>

