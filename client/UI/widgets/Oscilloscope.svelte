<script>
	import { onMount } from 'svelte';
  // import NexusUI from "nexusui/dist/NexusUI.js";

  // export let context = null;

  const SMOOTHING = 0.8;
  const FFT_SIZE = 2048;

  export let mode;
  export let frequencies;
  export let times;


  let canvas;
 
  function resize (w,h) {
    canvas.width = w*2;
    canvas.height = h*2;
    canvas.style.width = w+'px';
    canvas.style.height = h+'px';
  }

  

  let draw = () => {
    // this.analyser.smoothingTimeConstant = SMOOTHING;
    // this.analyser.fftSize = FFT_SIZE;

    // // Get the frequency data from the currently playing music
    // this.analyser.getByteFrequencyData(this.freqs);
    // this.analyser.getByteTimeDomainData(this.times);

    var width = Math.floor(1/this.freqs.length, 10);

    var canvas = document.querySelector('canvas');
    var drawContext = canvas.getContext('2d');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    // Draw the frequency domain chart.
    for (var i = 0; i < this.analyser.frequencyBinCount; i++) {
      var value = this.freqs[i];
      var percent = value / 256;
      var height = HEIGHT * percent;
      var offset = HEIGHT - height - 1;
      var barWidth = WIDTH/this.analyser.frequencyBinCount;
      var hue = i/this.analyser.frequencyBinCount * 360;
      drawContext.fillStyle = 'hsl(' + hue + ', 100%, 50%)';
      drawContext.fillRect(i * barWidth, offset, barWidth, height);
    }

    // Draw the time domain chart.
    for (var i = 0; i < this.analyser.frequencyBinCount; i++) {
      var value = this.times[i];
      var percent = value / 256;
      var height = HEIGHT * percent;
      var offset = HEIGHT - height - 1;
      var barWidth = WIDTH/this.analyser.frequencyBinCount;
      drawContext.fillStyle = 'white';
      drawContext.fillRect(i * barWidth, offset, 1, 2);
    }

    if (this.isPlaying) {
      requestAnimFrame(this.draw.bind(this));
    }
  }

  let getFrequencyValue = function(freq) {
    var nyquist = context.sampleRate/2;
    var index = Math.round(freq/nyquist * this.freqs.length);
    return this.freqs[index];
  }


	onMount(() => {

		let frame;
 
    // NexusUI.context = window.AudioEngine.audioContext;
    // NexusUI.context = context;
    // oscilloscope = new NexusUI.Oscilloscope("oscilloscope", {
    //   'size': [300,150] 
    // });
    // oscilloscope.colorize("fill", "#000");
    // oscilloscope.colorize("accent", "#FFF");
 
 
    // window.AudioEngine.addAnalyser(oscilloscope); // Inject oscilloscope analyser, keep encapsulation for worklet node
    // oscilloscope.connect(window.AudioEngine.audioWorkletNode);

    // spectrogram = new NexusUI.Spectrogram("spectrogram", {
    //   // size: [100, 50]
    // });
    // spectrogram.colorize("fill", "#000");
    // spectrogram.colorize("accent", "#FFF");
    // // window.AudioEngine.addAnalyser(spectrogram); // Inject oscilloscope analyser, keep encapsulation for worklet node
    // spectrogram.connect(window.AudioEngine.audioWorkletNode);

    // window.addEventListener("resize", function(event) {
    // // oscilloscope.resize(100, 120);
    // // spectrogram.resize(100, 150);
    // // console.log(analysers);
    // });

		const loop = () => {
			frame = requestAnimationFrame(loop);
		};

		loop();

		return () => cancelAnimationFrame(frame);
	});



</script>

<style>
	.info {
		position: absolute;
		top: 1em;
		left: 1em;
		background-color: rgba(255,255,255,0.7);
		padding: 1em;
		border-radius: 2px;
	}

  canvas {
    opacity:0.1;
    background-color: rgba(0, 0, 0, 0.1);

    display: block;
    visibility: hidden;
    /*left: 50%;
    margin: -200px 0 0 -200px;
    position: absolute;
    top: 50%; */
  }
  
</style>


<div class="info">
  <canvas bind:this={canvas}></canvas>
</div>

