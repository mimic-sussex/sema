<script>
	import { Router } from '@roxi/routify'
	import { routes } from '../.routify/routes'
	import { authStore } from './auth.js'

  import Controller from "./engine/controller";
  import { Engine } from "sema-engine/sema-engine.mjs";

  import { PubSub } from './utils/pubSub.js';
  let messaging = new PubSub();

	// we need to queue our init till after Routify has been initialized
	setTimeout(() => window.routify.inBrowser && authStore.init())

  // $unsupportedBrowser
  let unsupportedBrowser,
      controller;

  /**
   * This async IIFE tests the browser Sema is loading in for WAAPI Audio Worklet support
   * It either succeeds and dynamically imports the sema-engine, or graciously fails
   * */
  (async () => {
    // Detect Firefox early otherwise audio engine needs to be initialised for a fail to be detected [Firefox fix]
    if (/firefox/i.test(navigator.userAgent)) unsupportedBrowser = true;
    else {
      // controller = new Controller(new Engine());

      // Need a dynamic import to prevent the AudioWorkletNode inside the audioEngine module from loading [Safari fix]
      // import('sema-engine/dist/sema-engine.mjs')
      import("sema-engine/sema-engine.mjs")
        .then((module) => {
          // Apply in Inversion of Control with constructor injection
          controller = new Controller(new module.Engine());
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


</script>

<style global>
	@import "../static/app.css";
	@import "../static/global.css";
  </style>

<Router {routes} />
