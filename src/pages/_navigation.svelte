<script>
  import { ready, url, params } from "@roxi/routify";
	import { authStore } from '../auth'
	const { user, signout } = authStore
	const links = [
		['/index', 'home'],
		['/playground', 'playground'],
		['/tutorial', 'tutorial'],
		['/docs', 'docs'],
		['/about', 'about'],
		// ['/admin', 'admin'],
	]


  let persistentParams = { chapter: '01-basics', section: '01-introduction' };
  // update url parameters only when navigating tutorials
  $: if($params.chapter && $params.section) persistentParams = $params
</script>

      <!-- {#if links.path.contains('/tutorial')} -->
<nav>
	<div />
	<div>
		{#each links as [path, name]}
      {#if path==`tutorial`}
        <a href={ $url('/tutorial/:chapter/:section/', persistentParams ) }>Tutorial</a>
      {:else}
  			<a href={path}>{name}</a>
      {/if}
		{/each}
	</div>

	<div>
		{#if $user}
			<a href="/admin">admin</a>
			<img src={$user.picture} alt="profile - {$user.nickname}" />
			<a href="#signout" on:click={signout}>signout</a>
		{:else}
			<a href="/login">login</a>
		{/if}
	</div>
</nav>
