<script>
	import {
		username,
		website,
		loading,
		avatar_url,
		updateProfile,
		getProfile,
		signOut
	} from '../../stores/auth.js'

	import { redirect } from '@roxi/routify'

	/**
	 *  We don't want the login page to visible to logged in user, so we redirect them
	 **/
	$: if ($username) $redirect('/')




</script>

<slot />


<form use:getProfile
			class="form-widget"
			on:submit|preventDefault={updateProfile}
			>
  <div>
    <label for="email">Email</label>
    <input id="email" type="text" value={$username.email} disabled />
  </div>
  <div>
    <label for="username">Name</label>
    <input
      id="username"
      type="text"
      bind:value={$username}
    />
  </div>
  <div>
    <label for="website">Website</label>
    <input
      id="website"
      type="website"
      bind:value={$website}
    />
  </div>

  <div>
    <input type="submit"
						class="button block primary"
						value={loading ? 'Loading ...' : 'Update'}
						disabled={loading}/>
  </div>

  <div>
    <button class="button block"
						on:click={signOut}
						disabled={loading}>
      Sign Out
    </button>
  </div>
</form>