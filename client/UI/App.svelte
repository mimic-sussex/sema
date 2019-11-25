<script>
	import { onDestroy } from 'svelte';

  import Header from './Header.svelte';
	import Content from './Content.svelte';
	import SplashScreen from './SplashScreen.svelte';

  import compile from '../compiler/compiler';
  import defaultGrammar from '../compiler/defaultGrammar.ne';
  import defaultLiveCode from '../compiler/defaultLiveCode.sem';
  import defaultModel from '../compiler/defaultLiveCode.sem';
  import { 
    createAudioEngine,
    setupAudio,
    playAudio,
    stopAudio
  } from '../audioEngine/audioEngineController.js';

  import {
    layout,
    splashScreenClicked 
  } from '../store.js';

  createAudioEngine();
  


  const unsubscribe = splashScreenClicked.subscribe(value => {
		if(value === 'hidden'){
      setupAudio();
    }
	});
  onDestroy(unsubscribe);

</script>

<style>
  #app {
  	/* height: 100%; */
  	height: 100vh;
  	background: pink;
    overflow-y: hidden; /* hide vertical */
  }
</style>

<div id="app">
  <Header></Header>
  <Content></Content>
  <SplashScreen></SplashScreen>
</div>