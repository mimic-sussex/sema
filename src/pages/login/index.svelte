<!-- <script>
	import { authStore } from '../../auth'
	const { signin } = authStore
</script>

<div class="center-all">
	<div class="card">
		<h3>We're super lazy about our login form</h3>
		<p>So we leave it to auth0</p>
		<button class="button" on:click={signin}>sign in</button>
	</div>
</div> -->

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

<!--
<script>
  import { supabase } from "../../db/client"

  let loading = false
  let email;

  const handleLogin = async () => {
    try {
      loading = true
      const { error } = await supabase.auth.signIn({ email })
      if (error) throw error
      alert('Check your email for the login link!')
    } catch (error) {
      alert(error.error_description || error.message)
    } finally {
      loading = false
    }
  }
</script>

<style>

/* Auth */

.authContainer {
  display: flex;
  /* flex-direction: column; */
  align-items: center;
  justify-items: center;
}

.authContainer > .authTitle {
  width: 22rem;
  margin-right: 40px;
}

.authContainer > .authTitle > .header {
  font-weight: 400;
}

.authContainer > .authTitle > .description {
  opacity: 50%;
  font-weight: 300;
  line-height: 1.6em;
}

.authWidget {
  background-color: #181818;
  border: 1px solid #2a2a2a;
  padding: 30px 30px;
  border-radius: 5px;
  width: 28rem;
}

.authWidget > .description {
  margin: 0;
  font-size: 0.9rem;
}

.authWidget > .inputField {
  border: none;
  padding: 10px 10px;
}

.authWidget > .button {
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background-color: #444444;
  text-transform: none !important;
  transition: all 0.2s ease;
}

.authWidget > .button:hover {
  background-color: #2a2a2a;
}

.authWidget > .button > .loader {
  width: 17px;
  animation: spin 1s linear infinite;
  filter: invert(1);
}



.col-6 {
  width: 46%;
}

.flex {
  display: flex;
}
.flex.column {
  flex-direction: column;
}
.flex.row {
  flex-direction: row;
}
.flex.flex-1 {
  flex: 1 1 0;
}
.flex-end {
  justify-content: flex-end;
}
.flex-center {
  justify-content: center;
}
.items-center {
  align-items: center;
}
.text-sm {
  font-size: 0.8rem;
  font-weight: 300;
}
.text-right {
  text-align: right;
}
.font-light {
  font-weight: 300;
}
.opacity-half {
  opacity: 50%;
}

.row [class^='col'] {
  float: left;
  margin: 0.5rem 2%;
  min-height: 0.125rem;
}

.flex-center {
  justify-content: center;
}

.form-widget {
  display: flex;
  flex-direction: column;
  gap: 20px;
}


</style>

<form class="row flex flex-center" on:submit|preventDefault={handleLogin}>
  <div class="col-6 form-widget">
    <p class="description">Sign in via magic link with your email below</p>
    <div>
      <input
        class="inputField"
        type="email"
        placeholder="Your email"
        bind:value={email}
      />
    </div>
    <div>
      <input type="submit" class='button block' value={loading ? "Loading" : "Send magic link"} disabled={loading} />
    </div>
  </div>
</form> -->