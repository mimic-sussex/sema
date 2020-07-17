<!-- <script context="module">
	export async function preload() {
		// '/' absolute URL
    
		return await fetch(`/tutorial/tutorial.json`).then(r => r.json());
	}
</script> -->

<script>

  import { tick, onMount, onDestroy } from 'svelte';
  import {
    tutorials,
    selected
  } from '../stores/tutorial.js'

  import {
    unsupportedBrowser
  } from '../stores/common.js';


  import {
    currentUser
  } from '../stores/user.js'

  import src from '../../assets/img/sema.svg';

  import SignIn from '../components/user/SignIn.svelte';

  // $tutorials = preload();
  // $selected = $tutorials[0]

  // onMount( async () => {
   
  //   console.log(`DEBUG:routes:index:onMount: `); 
  //   // console.log(`DEBUG:routes:_layout: ${chapter_dir}`); 
  //   // console.log(`DEBUG:routes:_layout: ${section_dir}`); 
  //   $tutorials = await preload();
  //   $selected = $tutorials[0]; 
  // }); 


</script>

<style>

  .container {
    display: grid;
    width: 100%;
    height: 100%;
    /* justify-content: space-between; */
    background: linear-gradient(150deg, rgba(0,18,1,1) 0%, rgba(7,5,17,1) 33%, rgba(16,12,12,1) 67%, rgba(18,16,16,1) 100%);
  }

  .logo-container {
    /* width: 50%; */
    height: 50%;
    text-align: center;
		margin: auto;
    /* margin: 0 auto; */
    /* float: none; */
    display: grid
  }

  
  .login {
		text-align: center;
		margin: 0 auto;
	}

	/* h1, figure, p {
		text-align: center;
		margin: 0 auto;
	} */

	/* h1 {
		font-size: 2.8em;
		text-transform: uppercase;
		font-weight: 700;
		margin: 0 0 0.5em 0;
	} */

	figure {
   	width: 187px;
    height: 187px; 
    background-color: white;
    border-radius: 2px;
    padding-top: 5px;
		/* margin: 0 0 0 0; */
	}

	img {
		width: 177px;
    height: 177px;
		/* max-width: 400px; */
		/* margin: 0 0 1em 0; */
	}

	/* p {
		margin: 1em auto;
	} */

	/* @media (min-width: 480px) {
		h1 {
			font-size: 4em;
		}
	} */



</style>

<!-- <h1>Great success{#if $currentUser }, { $currentUser.displayName } {/if} !</h1> -->

<svelte:head>
  <!-- <link type="text/css" rel="stylesheet" href="https://www.gstatic.com/firebasejs/ui/4.5.0/firebase-ui-auth.css" /> -->
	<title>Sema</title>
</svelte:head>

<div class='container'>
  <div class='logo-container'>
    <figure>
      <img alt='sema-logo' {src} >
      <!-- <figcaption>Sema Logo</figcaption> -->
    </figure>
  </div>

  {#if !$unsupportedBrowser}
  <div class='login'>
    <SignIn />
  </div>
  {:else}
  <div class='login'>
    <p><strong style="font-size:150%; color: red; margin:15px 0 10px 5px">Unsupported browser!</strong></p>
    <p><strong style="color: red; margin:15px 0 10px 5px">Sema requires a Chromium-based browser to load successfully</strong></p>
    <p><strong style="color: red; margin:15px 0 10px 5px">(e.g. Chrome, Brave, Microsoft Edge, Opera)</strong></p>
    
  </div>
  {/if}
</div>