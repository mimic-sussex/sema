<script>
  import { onMount, onDestroy } from 'svelte';
	import { metatags } from '@roxi/routify'
  import ReGL from 'regl';
  import mouse from 'mouse-change';
  // import regl as RGL from 'regl';

	metatags.title = 'Sema'
	metatags.description = 'Description coming soon...'

  let rgl, m, tick;

  const setupReGL = () => {

    var c = document.getElementById("canvas");
    c.width = window.innerWidth;
    c.height = window.innerHeight

    rgl = ReGL(c);
    m = mouse();


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

    tick = rgl.frame(function () {
      rgl.clear({
        color: [0, 0, 0, 1]
      })

      drawFeedback()

      pixels({
        copy: true
      })
    })
  }

  onMount(async () => {

    setupReGL();

  })

  /**
   * TODO delete objects
  */
  onDestroy( async () => {
    tick.cancel();     // unsubscribe by calling cancel on the callback
    regl.destroy()
  })

</script>

<div class="center-all">
  <canvas id="canvas"
          class='canvas-logo'
          >
  </canvas>
</div>


<style>
  .canvas-logo {
    /* opacity:0.1; */
    background-color: rgb(16, 16, 16);
    height: 100% !important;
    width: 100% !important;
    visibility: visible;
    border-radius: 2px;
  }

</style>
