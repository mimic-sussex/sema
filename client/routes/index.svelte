<script>

import {
  currentUser
} from '../stores/user.js'

import src from '../../assets/img/sema.svg';

import SignIn from '../components/user/SignIn.svelte';

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
   	width: 210px;
    height: 210px; 
    background-color: white;
    border-radius: 4px;
    padding-top: 5px;
		/* margin: 0 0 0 0; */
	}

	img {
		width: 200px;
    height: 200px;
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
  <div class='login'>
    <SignIn />
  </div>
</div>