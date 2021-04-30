<script>
	import { Router } from '@roxi/routify'
	import { routes } from '../.routify/routes'
	import { authStore } from './auth.js'

  import Controller from "./engine/controller";
  import { PubSub } from './utils/pubSub.js';
  let messaging = new PubSub();

	// we need to queue our init till after Routify has been initialized
	setTimeout(() => window.routify.inBrowser && authStore.init())

  // $unsupportedBrowser
  let unsupportedBrowser,
      controller,
      engine;

  /**
   * This async IIFE tests the browser in which Sema is loading
   * for for WAAPI Audio Worklet support
   * It either succeeds and dynamically imports the sema-engine,
   * or fails graciously
   * * This is invoked even if load happens through Playground or Tutorial via client side routing
   * */
  ( async () => {
    // Detect Firefox early otherwise audio engine needs to be initialised for a fail to be detected [Firefox fix]
    if (/firefox/i.test(navigator.userAgent)) unsupportedBrowser = true;
    else {
      // Need a dynamic import to prevent the AudioWorkletNode inside the audioEngine module from loading [Safari fix]
      import("sema-engine/sema-engine.mjs")
        .then((module) => {
          // Apply in Inversion of Control with constructor injection
          engine = new module.Engine();
          controller = new Controller(engine); // Init need to be deferred to Playground or tutorial after User Action
        })
        .catch((err) => (unsupportedBrowser = true));
    }
  })();



  // const unsubscribe = audioEngineStatus.subscribe( value => {
  //   if(controller){
  //     if(value === 'running' && !controller.samplesLoaded){
  //       controller.init(document.location.origin + '/maxi-processor.js');
  //     }
  //     // else if (value === 'running')
  //     // {
  //     //   messaging.publish("play-audio");
  //     // }
  //     // else if (value === 'paused'){
  //     //   messaging.publish("stop-audio");
  //     // }
	//   }
  // });
  // onDestroy(unsubscribe);

	function onMouseMove(e) {
		messaging.publish("mouse-xy", [e.clientX / window.innerWidth, e.clientY / window.innerHeight]);
	}
	document.addEventListener('mousemove', onMouseMove);

  const bindCallback = (elemId, event, callback) =>
    document.getElementById(elemId).addEventListener(event, callback);



</script>

<style global>
	@import "../static/app.css";
	@import "../static/global.css";
</style>

<Router { routes } />
