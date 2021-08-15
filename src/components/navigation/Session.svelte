<script>

  import { isActive, url, params } from "@roxi/routify";

	import {
		avatarSrc,
		loggedIn,
		user,
		userName
	 } from '../../stores/user';

	import { redirect } from '@roxi/routify'

  import { siteMode } from "../../stores/common";
  import { supabase } from '../../db/client';

  async function signOut() {
    try {
      let { error } = await supabase.auth.signOut()
      if (error) throw error
    } catch (error) {
      alert(error.message)
    } finally {
			$loggedIn = false
			$redirect('/login')
			$user = null;
    }
  }



</script>

<style>
	.container-session-group {
		display: flex;
		flex-direction: row;
		flex-wrap:  wrap;
		align-content: flex-start;
		justify-content: flex-end;
	}

	.session-avatar {
		width: 32px;
		height: 32px;
		/* padding-left: 0.5em; */
		padding-top: 0.4em;
		/* padding-right: 0.5em; */
		/* padding-bottom: 0.2em; */
	}

  a {
    /* padding: 0.5em 0em 0.35em 0em; */
  }

  a:hover {
    text-decoration: none;
  }


</style>

<div class='container-session-group'>
	{#if $user}
		{#if $userName }
			<!-- TODO -->
			<!-- aria-current="{ $isActive(path)? 'page' : undefined}" -->
			<a href="/admin"
				style='color: {$siteMode === 'dark'? 'white': 'black'};'
				>
			{ $userName }</a>
			<div class='container-session-avatar'>
				<img 	class='session-avatar'
							src={ $avatarSrc }
							alt="{ $userName }" />
			</div>
		{:else}
			<a href="/admin"
				style='color: { $siteMode === 'dark'? 'white': 'black' };'
				>
			admin</a>
		{/if}
		<a href="#signout" on:click={ signOut }
			style='color: { $siteMode === 'dark'? 'white': 'black' };'
			>
		signout</a>
	{:else}
		<a href="/login"
			style='color: { $siteMode === 'dark'? 'white': 'black' };'
			>
			login</a>
	{/if}
</div>