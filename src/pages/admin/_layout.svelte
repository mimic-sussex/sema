<script>
	import { ready } from '@roxi/routify'
	// import { authStore } from '../../auth.js'

  import {
		user,
		username,
		website,
		avatar_url,
		loggedIn,
		loading
	} from '../../stores/user'

	// import Profile fro../../components/admin/Profile.sveltelte"

	import Login from '../login/index.svelte'
	// const { user, authenticated, loading } = authStore

	/**
	 * since SSR normally won't render till all components have been loaded
	 * and our <slot /> will never load, we will have to let SSR do its job
	 * right away by calling $ready()
	 **/
	$ready()
</script>

<svelte:head>
	<title>Sema – Admin</title>
</svelte:head>

<div class="admin-module" class:not-authed={!$user}>
	{#if !window.routify.inBrowser}
		Hello bot. This page is only available to humans.
	{:else if $user}
		<slot />
	{:else if $loading}
		<div class="center-all">
			<h1>Loading...</h1>
		</div>
	{/if}
</div>
