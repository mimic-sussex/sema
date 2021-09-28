<script>

  import { isActive, url, params, redirect } from "@roxi/routify";

	import {
		avatarSrc,
		loggedIn,
		user,
		userName,

	 } from '../../stores/user';

  import { siteMode } from "../../stores/common";
  import { supabase } from '../../db/client';

  async function signOut() {
    try {
			let { error } = await supabase.auth.signOut()
			//$redirect('/login')
      if (error) throw error
    } catch (error) {
	  	console.log(error.message, "SINGING OUT");
      alert(error.message);
    } finally {
			$loggedIn = false
			$redirect('/login')
			$user = null;
    }
  }


  // async function fetchProfile() {
  //   try {
  //     // $loading = true

  //     let { username, website, avatar_url } = await getUserProfile()

  //     if ( username && website && avatar_url) {
  //       $userName = username
  //       // $websiteURL = website
  //       // $avatarURL = avatar_url
  //     }
  //   } catch (error) {
  //     alert(error.message)
  //   } finally {
  //     // $loading = false
	// 		$loggedIn = true
  //   }
	// 	console.log('getProfile')
  // }


	// $: profile = fetchProfile();

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

	.profile-icon{
		vertical-align: baseline;
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
				<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" class="profile-icon" viewBox="0 0 16 16">
					<path d="M11 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"/>
					<path fill-rule="evenodd" d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm8-7a7 7 0 0 0-5.468 11.37C3.242 11.226 4.805 10 8 10s4.757 1.225 5.468 2.37A7 7 0 0 0 8 1z"/>
				</svg>
			{ $userName }</a>
			{#if $avatarSrc}
				<div class='container-session-avatar'>
					<!-- {#await profile }
						<img 	class='session-avatar'
								src={ null }
								alt={ null } />
					{:then number } -->
						<img 	class='session-avatar'
								src={ $avatarSrc }
								alt="{ $userName }" />
					<!-- {/await} -->
				</div>
			{/if}
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