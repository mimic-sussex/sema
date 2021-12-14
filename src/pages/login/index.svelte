<script>
	import { user } from "../../stores/user"
	import { supabase } from "../../db/client"
	// import Auth from "../../components/login/Auth.svelte"
	import Auth from 'supabase-ui-svelte'
	// import Profile from "../../components/admin/Profile.svelte"

	// user.set(supabase.auth.user())

	// supabase.auth.onAuthStateChange((_, session) => {
	// 	user.set(session.user)
	// })
</script>

<style>

.container-login {
  width: 100%;
  /* height: 100%; */
  /* z-index: 1000; */
  position: absolute;
  /* top: 50px; */
  display:grid;
  /* grid-template-rows: 65vh 15vh 5vh auto; */
  overflow-y: hidden;
}

.container-supabase-auth {
  /* background-color: darkgrey; */
  margin-left: auto;
  margin-right: auto;
  /* margin-top: 4em; */
  position: relative;
}

input{
	color: white;
}

/* .supabase-auth {



} */

</style>

<div class="container-login"
			>
	{#if $user}
			<!-- <Profile /> -->
	{:else}
		<div class="container-supabase-auth"
					style="padding: 50px 0 100px 0;"
			>
			<Auth supabaseClient={ supabase }
						providers={ ['github', 'discord'] }
						socialButtonSize="large"
						socialLayout='horizontal'
						socialColors='false'
						class='supabase-auth'
						/>
			<!-- <Auth /> -->
		</div>
	{/if}
</div>
