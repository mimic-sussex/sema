<script>
	import { user } from "../../stores/user"
	import { supabase } from "../../db/client"
	import Auth from "../../components/login/Auth.svelte"
	import Profile from "../../components/login/Profile.svelte"

	user.set(supabase.auth.user())

	supabase.auth.onAuthStateChange((_, session) => {
		user.set(session.user)
	})
</script>

<div class="container" style="padding: 50px 0 100px 0;">
	{#if $user}
			<Profile />
	{:else}
			<Auth />
	{/if}
</div>
