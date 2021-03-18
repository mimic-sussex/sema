<script>
	import { onDestroy } from 'svelte';

  import Controller from '../audioEngine/controller'
  import SplashScreen from './SplashScreen.svelte';
  import {
    unsupportedBrowser,
    audioEngineStatus
  } from '../stores/common.js';

  let controller;

  /**
   * This async IIFE tests the browser Sema is loading in for WAAPI Audio Worklet support
   * It either succeeds or graciously fails
   * */
  ( async () => {

    // Detect Firefox early otherwise audio engine needs to be initialised for a fail to be detected [Firefox fix]
    if( /firefox/i.test(navigator.userAgent) ) $unsupportedBrowser = true
    else{
      // Need a dynamic import to prevent the AudioWorkletNode inside the audioEngine module from loading [Safari fix]
      import('sema-engine/sema-engine.mjs')
        .then( module => {
          // Apply in Inversion of Control with constructor injection
          controller = new Controller(new module.Engine());
        })
        .catch( err => $unsupportedBrowser = true );
    }
  })();

	// import CanvasOverlay from './CanvasOverlay.svelte';

  import { Router } from "@sveltech/routify";
  import { routes } from "@sveltech/routify/tmp/routes";

  import { PubSub } from '../messaging/pubSub.js';

  let messaging = new PubSub();

  const unsubscribe = audioEngineStatus.subscribe( value => {
    if(controller){
      if(value === 'running' && !controller.samplesLoaded){
        controller.init(document.location.origin + '/maxi-processor.js');
      }
      // else if (value === 'running')
      // {
      //   messaging.publish("play-audio");
      // }
      // else if (value === 'paused'){
      //   messaging.publish("stop-audio");
      // }
	  }
  });
  onDestroy(unsubscribe);

	function onMouseMove(e) {
		messaging.publish("mouse-xy", [e.clientX / window.innerWidth, e.clientY / window.innerHeight]);
	}
	document.addEventListener('mousemove', onMouseMove);

</script>

<style>
  /*
  #app {
  	height: 100vh;
  	background: linear-gradient(150deg, rgba(0,18,1,1) 0%, rgba(7,5,17,1) 33%, rgba(16,12,12,1) 67%, rgba(18,16,16,1) 100%);
    overflow-y: hidden; hide vertical
  }
  */
</style>

<Router {routes} />


<!-- <div id="app">
  <Header></Header>
  <Content></Content>
  <SplashScreen></SplashScreen>
	<CanvasOverlay></CanvasOverlay>

</div> -->
