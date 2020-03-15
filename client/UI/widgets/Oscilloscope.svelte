<script>
	import { onMount } from 'svelte';
  // import NexusUI from "nexusui/dist/NexusUI.js";

  // export let context = null;

  let canvas;
 
  function resize (w,h) {
    canvas.width = w*2;
    canvas.height = h*2;
    canvas.style.width = w+'px';
    canvas.style.height = h+'px';
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


<div class="info">
  <canvas bind:this={canvas}></canvas>
</div>

<style>
	.info {
		position: absolute;
		top: 1em;
		left: 1em;
		background-color: rgba(255,255,255,0.7);
		padding: 1em;
		border-radius: 2px;
	}
</style>