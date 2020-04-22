<script>

import {
  currentUser
} from '../stores/user.js'

import src from '../../assets/img/sema.svg';

import SignIn from '../components/user/SignIn.svelte';

</script>

<style>

  .login {
		text-align: center;
		margin: 0 auto;
	}

	h1, figure, p {
		text-align: center;
		margin: 0 auto;
	}

	h1 {
		font-size: 2.8em;
		text-transform: uppercase;
		font-weight: 700;
		margin: 0 0 0.5em 0;
	}

	figure {
		margin: 0 0 1em 0;
	}

	img {
		width: 100%;
		max-width: 400px;
		margin: 0 0 1em 0;
	}

	p {
		margin: 1em auto;
	}

	@media (min-width: 480px) {
		h1 {
			font-size: 4em;
		}
	}
</style>

<!-- <h1>Great success{#if $currentUser }, { $currentUser.displayName } {/if} !</h1> -->

<figure>
	<img alt='sema-logo' {src} >
	<!-- <figcaption>Sema Logo</figcaption> -->
</figure>


<div class='login'>
  <SignIn />
</div>

<p><strong>Try editing this file (src/routes/index.svelte) to test live hot reloading.</strong></p>
