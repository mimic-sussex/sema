<script>
	import { onDestroy } from 'svelte';

  import Header from './Header.svelte';
	import Content from './Content.svelte';

  import SplashScreen from './SplashScreen.svelte';
  import { splashScreenClicked } from '../store.js';

  import { createAudioEngine, setupAudio } from '../audioEngine/audioEngineController.js';

  createAudioEngine();

  const unsubscribe = splashScreenClicked.subscribe( value => {
		if(value === 'hidden') setupAudio();
	});
  onDestroy(unsubscribe);

</script>

<style>
  #app {
  	/* height: 100%; */
  	height: 100vh;
  	background: rgb(0, 0, 0);
    overflow-y: hidden; /* hide vertical */
  }
</style>

<div id="app">
  <Header></Header>
  <Content></Content>
  <SplashScreen></SplashScreen>
</div>
