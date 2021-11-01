<script>

  import {
		supabase,
    getUserProfile,
	} from '../../db/client'

  import {
		user,
		userName,
		websiteURL,
		avatarURL,
		loggedIn,
		loading
  } from '../../stores/user'
  
  import {
    isDeleteAccountOverlayVisible
  } from '../../stores/profile.js'

  import Avatar from '../login/Avatar.svelte'

  // let loading = true
  // let username = null
  // let website = null
  // let avatar_url = null


  async function getProfile() {
    try {
      $loading = true

      let { username, website, avatar_url } = await getUserProfile()
      if (username){
        $userName = username;
      }
      if (website){
        $websiteURL = website;
      }
      if (avatar_url){
        $avatarURL = avatar_url;
      }
      
      
      // if ( username && website && avatar_url) {
      //   $userName = username;
      //   $websiteURL = website;
      //   $avatarURL = avatar_url;
      // }
      
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
        username: $userName,
        website: $websiteURL,
        avatar_url: $avatarURL,
        updated_at: new Date().toISOString(),
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
    /* font-size: 1rem; */
    line-height: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 5px;
    margin-top: 1rem;
  }

  input {
    /* font-size: 0.9rem; */
		/* width: 100%; */
		font-weight: 300;
    background: transparent;
    border-radius: 0.375rem;
    border-style: solid;
    border-width: 1px;
    border-color: #ccc;
    box-sizing: border-box;
    display: block;
    flex: 1;
    /* padding: 5px 3px 8px 35px; */
  }

  button {
    font-weight: 300;
    background: transparent;
    border-radius: 0.375rem;
    border-style: solid;
    border-width: 1px;
    border-color: #ccc;
    box-sizing: border-box;
    display: block;
    flex: 1;
  }

  .icon {
    position: absolute;
    margin: 7px;
    color: #ccc;
  }

  input {
    position: relative;
    font-size: 1rem;
    line-height: 1.25rem;
    display: flex;
  }


</style>

<form use:getProfile class="form-widget"
			on:submit|preventDefault={ updateProfile }
      >
  <!-- {#if $avatarURL != null}    
  <Avatar bind:path={ $avatarURL }
					on:upload={ updateProfile }
          />
  {/if} -->
  {#if $user != null}
  <div>
    <label for="email">Email</label>
    <input 	id="email"
						type="text"
						value={ $user.email }
						disabled
						/>
  </div>
  {/if}

  <div>
    <label for="username">Name</label>
    <input
      id="username"
      type="text"
      bind:value={ $userName }
    	/>
  </div>

  <div>
    <label for="website">Website</label>
    <input
      id="website"
      type="website"
      bind:value={ $websiteURL }
    	/>
  </div>

  <div>
    <input type="submit"
						class="button block primary"
						value={ $loading ? 'Loading ...' : 'Update Profile'}
						disabled={ $loading }
						/>
  </div>

  <div>
    <button on:click={() => $isDeleteAccountOverlayVisible = true}>Delete Account</button>
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