<script>
  import { onMount} from 'svelte';
	import { metatags } from '@roxi/routify'
  import regl from 'regl';
  import mouse from 'mouse-change';
  // import regl as RGL from 'regl';

	metatags.title = 'Sema'
	metatags.description = 'Description coming soon...'

  onMount(async () => {
    var c = document.getElementById("canvas");
    console.log(c);
    c.width = window.innerWidth;
    c.height = window.innerHeight

    let rgl = regl(c);
    let m = mouse();

    const pixels = rgl.texture()

    const drawFeedback = rgl({
      frag: `
        precision mediump float;
        uniform sampler2D texture;
        uniform vec2 mouse;
        uniform float t;
        varying vec2 uv;
        void main () {
          float dist = length(gl_FragCoord.xy - mouse);
          gl_FragColor = vec4(0.98 * texture2D(texture,
            uv + cos(t) * vec2(0.5 - uv.y, uv.x - 0.5) - sin(2.0 * t) * (uv - 0.5)).rgb, 1) +
            exp(-0.01 * dist) * vec4(
              1.0 + cos(2.0 * t),
              1.0 + cos(2.0 * t + 1.5),
              1.0 + cos(2.0 * t + 3.0),
              0.0);
        }`,

      vert: `
        precision mediump float;
        attribute vec2 position;
        varying vec2 uv;
        void main () {
          uv = position;
          gl_Position = vec4(2.0 * position - 1.0, 0, 1);
        }`,

      attributes: {
        position: [
          -2, 0,
          0, -2,
          2, 2]
      },

      uniforms: {
        texture: pixels,
        mouse: ({ pixelRatio, viewportHeight}) => [
          m.x * pixelRatio,
          viewportHeight - m.y * pixelRatio
        ],
        t: ({tick}) => 0.01 * tick
      },

      count: 3
    })

    rgl.frame(function () {
      rgl.clear({
        color: [0, 0, 0, 1]
      })

      drawFeedback()

      pixels({
        copy: true
      })
    })

  })


</script>

<div class="center-all">
  <canvas id="canvas"
          class='canvas-logo'
          >
  </canvas>
  <!-- bind:this={ canvas } -->
	<!-- <h1>SEMA</h1> -->
	<!-- <div class="card">
		<h5>Notes:</h5>
		<ul>
			<li>Auth0</li>
			<li>Embedded login form on protected pages</li>
			<li>No need to redirect users</li>
			<li>No pointless auth in SSR</li>
			<li>No need to proxy authentication through a server</li>

		<code>https://github.com/mimic-sussex/sema</code>
	</div> -->
</div>


<style>
  .canvas-logo {
    /* opacity:0.1; */
    background-color: rgb(16, 16, 16);
    height: 100% !important;
    width: 100% !important;
    /* display: block; */
    visibility: visible;
    border-radius: 2px;
    /* display: inline-block; 1 */
    /* vertical-align: baseline; 2 */
    /*left: 50%;
    margin: -200px 0 0 -200px;
    position: absolute;
    top: 50%; */
  }

</style>
