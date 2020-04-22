<script>
	import { onDestroy } from 'svelte';

  import SplashScreen from './SplashScreen.svelte';
  import { splashScreenClicked } from '../store.js';

  import { AudioEngine } from '../audioEngine/audioEngine.js';

	import { environment } from "../utils/history.js";

	import CanvasOverlay from './CanvasOverlay.svelte';

  import { Router } from "@sveltech/routify";
  import { routes } from "@sveltech/routify/tmp/routes";


  let audioEngine = new AudioEngine();

  const unsubscribe = splashScreenClicked.subscribe( value => {
    if(value === 'hidden') audioEngine.init(1);
	});
  onDestroy(unsubscribe);

</script>

<style>
  #app {
  	/* height: 100%; */
  	height: 100vh;
  	background: linear-gradient(150deg, rgba(0,18,1,1) 0%, rgba(7,5,17,1) 33%, rgba(16,12,12,1) 67%, rgba(18,16,16,1) 100%);
    overflow-y: hidden; /* hide vertical */
  }
</style>

<Router {routes} />


<!-- <div id="app">
  <Header></Header>
  <Content></Content>
  <SplashScreen></SplashScreen>
	<CanvasOverlay></CanvasOverlay>

</div> -->
