<script>
import { items } from '../../stores/playground.js'

// export let items;

</script>


<style>

  .console-container {
    /* position: relative; */
    width: 100%;
    height: 100%;
    border: none;
  }

	.scrollable-textarea {
		/* flex: 1 1 auto; */
		/* border-top: 1px solid #eee; */
		/* margin: 0 0 0.5em 0; */
		/* overflow-y: auto; */
	}

  /* .error-state {
    color:red;
    margin:15px 0px 15px 25px;
  } */

  .prewrap {
    display: inline-flexbox;
    width: 100%;
    height: 100%;
    overflow-x: auto;
    white-space: pre-wrap;
    white-space: -moz-pre-wrap;
    white-space: -pre-wrap;
    white-space: -o-pre-wrap;
    word-wrap: break-word;
  }

  .console-textarea {
    /* display: inline-flexbox; */
    width: 100%;
    height: 100%;
    /* overflow-x: scroll; */
    resize: none;
    /* white-space: pre-wrap;
    white-space: -moz-pre-wrap;
    white-space: -pre-wrap;
    white-space: -o-pre-wrap;
    word-wrap: break-word; */
  }

</style>

<div class='console-container scrollable-textarea'>
  <textarea class='console-textarea'>
    running Maximilian v2.3.0 (Wasm)
    running Maximilian v2.3.0 (PureJS)
    running Open303 (Wasm)
    Sample rate: 44100
    buffer received
    DAC: 2 channels
    loading sample '909.wav'
    loading sample 'patterndrone3.wav'
    loading sample 'phoo-old1.wav'
    loading sample 'pork.wav'
    loading sample 'revbell.wav'
    loading sample 'rocks.wav'
    loading sample 'skake2Ed.wav'
    loading sample 'snork.wav'
    loading sample 'spade.wav'
    loading sample 'spark.wav'
    loading sample 'stretch.wav'
    loading sample '909b.wav'
    loading sample '909closed.wav'
    loading sample '909open.wav'
    loading sample 'sweetmachine-old1.wav'
    loading sample 'swipe-old1.wav'
    loading sample 'auboom.wav'
    loading sample 'triplet.wav'
    loading sample 'auclick.wav'
    loading sample 'audoubelclick2.wav'
    loading sample 'audoubleclick.wav'
    loading sample 'auhiclick.wav'
    loading sample 'vindvabd.wav'
    loading sample 'ausiclick.wav'
    loading sample 'backswing-old1.wav'
    loading sample 'bee.wav'
    loading sample 'bellrip.wav'
    loading sample 'bellrip2.wav'
    loading sample 'bellrip3.wav'
    loading sample 'blade-old1.wav'
    loading sample 'boom.wav'
    loading sample 'vindvahat.wav'
    loading sample 'camclick-old1.wav'
    loading sample 'camina1.wav'
    loading sample 'camina2.wav'
    loading sample 'camina3.wav'
    loading sample 'chain.wav'
    loading sample 'click-old1.wav'
    loading sample 'woodsamp.wav'
    loading sample 'wooo-old1.wav'
    loading sample 'dalispark.wav'
    loading sample 'digaa.wav'
    loading sample 'dorje.wav'
    loading sample 'drr.wav'
    loading sample 'firecrack.wav'
    loading sample 'firespark.wav'
    loading sample 'firespark2.wav'
    loading sample 'glitch-old1.wav'
    loading sample 'harshi-old1.wav'
    loading sample 'harshlow-old1.wav'
    loading sample 'heart.wav'
    loading sample 'ice.wav'
    loading sample 'insec.wav'
    loading sample 'insec2.wav'
    loading sample 'iron.wav'
    loading sample 'ironrip.wav'
    loading sample 'jump.wav'
    loading sample 'kernel.wav'
    loading sample 'kernel2.wav'
    loading sample 'kerneldrone.wav'
    loading sample 'kicic2.wav'
    loading sample 'kicicboom.wav'
    loading sample 'knock.wav'
    loading sample 'laekur.wav'
    loading sample 'machine.wav'
    loading sample 'magnetclock-old1.wav'
    loading sample 'noinoi.wav'
    loading sample 'noise-old1.wav'
    loading sample 'patterndrone2.wav'
    loading sample 'rotatingIron.wav'
    loading sample 'sbq.wav'
    loading sample 'snow.wav'
    loading sample 'auboom2.wav'
    loading sample 'vindva.wav'
    loading sample 'vindvaclick.wav'
    loading sample 'bello.wav'
    loading sample 'vindvadbase.wav'
    loading sample 'boom2.wav'
    loading sample 'boomwag.wav'
    loading sample 'viromachine-old1.wav'
    loading sample 'camina4.wav'
    loading sample 'click.wav'
    loading sample 'clicko-old1.wav'
    loading sample 'clicko.wav'
    loading sample 'clicks1.wav'
    loading sample 'convol2.wav'
    loading sample 'convol3.wav'
    loading sample 'crackle3.wav'
    loading sample 'dentist-old1.wav'
    loading sample 'zhish.wav'
    loading sample 'zzzz.wav'
    loading sample 'electro.wav'
    loading sample 'elstatic-old1.wav'
    loading sample 'flash-old1.wav'
    loading sample 'hapsi.wav'
    loading sample 'insec3.wav'
    loading sample 'kernelmix.wav'
    loading sample 'kicic.wav'
    loading sample 'noise2.wav'
    loading sample 'paper.wav'
    loading sample 'pattern10.wav'
    loading sample 'pattern11.wav'
    loading sample 'pattern8.wav'
    loading sample 'pattern9.wav'
    loading sample 'patterndrone.wav'
    loading sample 'birta.wav'
    loading sample 'chainSpade.wav'
    loading sample 'convol1.wav'
    loading sample 'xylophone.wav'
    loading sample 'convol4.wav'
    loading sample 'convol5.wav'
    loading sample 'noise1.wav'
    loading sample 'InsectBee2.wav'
    loading sample 'Macrosemia.wav'
    loading sample 'MacrosemiaTonk.wav'
    loading sample 'MeimunaNau.wav'
    loading sample 'drone2.wav'
    loading sample 'Cryptotympana.wav'
    loading sample 'Dundunia.wav'
    loading sample 'InsectFly.wav'
    loading sample 'CARinsect.wav'
    loading sample 'InsecticideZG.wav'
    loading sample 'rain_ravi.wav'
    loading sample 'InsectBee.wav'
    loading sample 'crickBee.wav'
    loading sample 'holeMONO.wav'
    loading sample 'ravi.wav'
    loading sample 'drone1.wav'
    loading sample 'lookout.wav'
    loading sample 'insectzapZG.wav'
    >toModel: -0.9954648526077098,0
    >toModel: -0.9954648526077098,0
    >toModel: -0.9954648526077098,0
    >toModel: -0.9954648526077098,0
    >toModel: -0.9954648526077098,0
    >toModel: -0.9954648526077098,0
    >toModel: -0.9954648526077098,0
    >toModel: -0.3424036281178866,0
    >toModel: 0.34240362811777336,0
    >toModel: -0.3424036281176468,0
    >toModel: 0.34240362811753355,0
    >toModel: -0.342403628117407,0
    >toModel: 0.34240362811729375,0
    >toModel: -0.3424036281171672,0
    >toModel: 0.34240362811705394,0
    >toModel: -0.34240362811692737,0
    >toModel: 0.34240362811681413,0
    >toModel: -0.34240362811668756,0
    >toModel: 0.3424036281165743,0
    >toModel: -0.34240362811644776,0
    >toModel: 0.3378684807240442,0
    >toModel: 0.3378684807240442,0
    >toModel: 0.3378684807240442,0
    >toModel: 0.3378684807240442,0
    >toModel: 0.3378684807240442,0
    >toModel: 0.3378684807240442,0
    >toModel: 0.3378684807240442,0
    >toModel: -0.32426303855038374,0
    >toModel: 0.32426303855048566,0
    >toModel: -0.32426303855062355,0
    >toModel: 0.32426303855072547,0
    >toModel: -0.32426303855086336,0
    >toModel: 0.3242630385509653,0
    >toModel: -0.32426303855110317,0
    >toModel: -0.9909297052178178,0
    >toModel: -0.9909297052178178,0
    >toModel: -0.9909297052178178,0
    >toModel: -0.9909297052178178,0
    >toModel: -0.9909297052178178,0
    >toModel: -0.9909297052178178,0
    >toModel: -0.9909297052178178,0
    >toModel: 0.9909297052178987,0
    >toModel: -0.9909297052180576,0
    >toModel: 0.9909297052181385,0
    >toModel: -0.9909297052182974,0
    >toModel: 0.9909297052183783,0
    >toModel: -0.9909297052185372,0
    >toModel: 0.9909297052186181,0
    >toModel: -0.990929705218777,0
    >toModel: 0.9909297052188579,0
    >toModel: -0.9909297052190168,0
    >toModel: 0.9909297052190977,0
    >toModel: -0.9909297052192566,0
    >toModel: 0.9909297052193375,0
    >toModel: 0.3378684807216461,0
    >toModel: 0.3378684807216461,0
    >toModel: 0.3378684807216461,0
    >toModel: 0.3378684807216461,0
    >toModel: 0.3378684807216461,0
    >toModel: 0.3378684807216461,0
    >toModel: 0.3378684807216461,0
  </textarea>
  <!-- <pre class='prewrap'> { JSON.stringify($items, null, 2) } </pre> -->
</div>