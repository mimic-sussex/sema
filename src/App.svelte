
<script>
	import { Router } from '@roxi/routify'
	import { routes } from '../.routify/routes'
	// import { authStore } from './auth.js'
	import { supabase } from './db/client'
	import { user } from "./stores/user"

  import Controller from "./engine/controller";
  import Logger from './utils/logger.js';
  import { PubSub } from './utils/pubSub.js';
  let messaging = new PubSub();

	const init = () => {
    console.log(".user in init", user);
		user.set(supabase.auth.user())
		supabase.auth.onAuthStateChange((_, session) => {
			user.set(session.user)
		})
	}



	// we need to queue our init till after Routify has been initialized
	// setTimeout(() => window.routify.inBrowser && authStore.init())
	// setTimeout(() => window.routify.inBrowser && init())
	setTimeout(() => window.routify.inBrowser )

  // $unsupportedBrowser
  let unsupportedBrowser,
      controller,
      engine,
      logger;

	// console.log('init');

  /**
   * This async IIFE tests the browser in which Sema is loading for WAAPI Audio Worklet support
   * It either succeeds and dynamically imports the sema-engine OR fails graciously
   * * This is invoked even if load happens through Playground or Tutorial via client side routing
   * */
  ( async () => {
    // [DEPRECATED]: Detect Firefox early otherwise audio engine needs to be initialised for a fail to be detected [Firefox fix]
    // if (/firefox/i.test(navigator.userAgent)){
    //   console.error('Firefox detected: unsupported browser')
    //   unsupportedBrowser = true;
    // }
    // else {
      // Need a dynamic import to prevent the AudioWorkletNode inside the audioEngine module from loading [Safari fix]
      import("sema-engine")
        .then((module) => {
          // Apply in Inversion of Control with constructor injection
          engine = new module.Engine();
          controller = new Controller(engine); // Init need to be deferred to Playground or tutorial after User Action
        })
        .catch((err) => (unsupportedBrowser = true));
    // }
  })();


	function onMouseMove(e) {
		// messaging.publish("mouse-xy", [e.clientX / window.innerWidth, e.clientY / window.innerHeight]);
	}
	document.addEventListener('mousemove', onMouseMove);

  const bindCallback = (elemId, event, callback) =>
    document.getElementById(elemId).addEventListener(event, callback);



</script>

<style global>
	@import "../assets/app.css";
	@import "../assets/global.css";
</style>

<Router { routes } />
