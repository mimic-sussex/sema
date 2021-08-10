<script>
  import { supabase } from '../../db/client'
  import {
		user,
		username,
		website,
		avatar_url,
		loggedIn,
		loading
	} from '../../stores/user'

  import Avatar from '../login/Avatar.svelte'

  // let loading = true
  // let username = null
  // let website = null
  // let avatar_url = null

  async function getProfile() {
    try {
      $loading = true
      const user = supabase.auth.user()

      let { data, error, status } = await supabase
        .from('profiles')
        .select(`username, website, avatar_url`)
        .eq('id', user.id)
        .single()

      if (error && status !== 406) throw error

      if (data) {
        $username = data.username
        $website = data.website
        $avatar_url = data.avatar_url
      }
    } catch (error) {
      alert(error.message)
    } finally {
      $loading = false
			$loggedIn = true
    }
		console.log('getProfile')
  }

  async function updateProfile() {
    try {
      $loading = true
      const user = supabase.auth.user()

      const updates = {
        id: user.id,
        username: $username,
        website: $website,
        avatar_url: $avatar_url,
        updated_at: new Date(),
      }

      let { error } = await supabase.from('profiles').upsert(updates, {
        returning: 'minimal', // Don't return the value after inserting
      })

      if (error) throw error
    } catch (error) {
      alert(error.message)
    } finally {
      $loading = false
    }
		console.log('UpdateProfile')
  }

  async function signOut() {
    try {
      $loading = true
      let { error } = await supabase.auth.signOut()
      if (error) throw error
    } catch (error) {
      alert(error.message)
    } finally {
      $loading = false
			$loggedIn = false
    }
		console.log('Signout')
  }

</script>

<style>

  label {
    font-weight: 500;
    font-size: 0.875rem;
    line-height: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 5px;
    margin-bottom: 1rem;
  }

  input {
    font-size: 0.9rem;
    font-weight: 300;
    background: transparent;
    border-radius: 0.375rem;
    border-style: solid;
    border-width: 1px;
    border-color: #ccc;
    box-sizing: border-box;
    display: block;
    flex: 1;
    padding: 5px 3px 8px 35px;
  }

  .icon {
    position: absolute;
    margin: 7px;
    color: #ccc;
  }

  input {
    position: relative;
    font-size: 0.875rem;
    line-height: 1.25rem;
    display: flex;
  }


</style>

<form use:getProfile class="form-widget"
			on:submit|preventDefault={ updateProfile }
			>
  <Avatar bind:path={ $avatar_url }
					on:upload={ updateProfile }
					/>
  <div>
    <label for="email">Email</label>
    <input 	id="email"
						type="text"
						value={ $user.email }
						disabled
						/>
  </div>
  <div>
    <label for="username">Name</label>
    <input
      id="username"
      type="text"
      bind:value={ $username }
    	/>
  </div>
  <div>
    <label for="website">Website</label>
    <input
      id="website"
      type="website"
      bind:value={ $website }
    	/>
  </div>

  <div>
    <input type="submit"
						class="button block primary"
						value={ $loading ? 'Loading ...' : 'Update'}
						disabled={ $loading }
						/>
  </div>

  <!-- <div>
    <button class="button block"
						on:click={ signOut }
						disabled={ loading }
						>
      Sign Out
    </button>
  </div> -->
</form>