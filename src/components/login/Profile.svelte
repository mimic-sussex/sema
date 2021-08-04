<script>
  import { supabase } from '../../db/client'
  import { user } from '../../stores/user'
  import Avatar from './Avatar.svelte'

  let loading = true
  let username = null
  let website = null
  let avatar_url = null

  async function getProfile() {
    try {
      loading = true
      const user = supabase.auth.user()

      let { data, error, status } = await supabase
        .from('profiles')
        .select(`username, website, avatar_url`)
        .eq('id', user.id)
        .single()

      if (error && status !== 406) throw error

      if (data) {
        username = data.username
        website = data.website
        avatar_url = data.avatar_url
      }
    } catch (error) {
      alert(error.message)
    } finally {
      loading = false
    }
  }

  async function updateProfile() {
    try {
      loading = true
      const user = supabase.auth.user()

      const updates = {
        id: user.id,
        username,
        website,
        avatar_url,
        updated_at: new Date(),
      }

      let { error } = await supabase.from('profiles').upsert(updates, {
        returning: 'minimal', // Don't return the value after inserting
      })

      if (error) throw error
    } catch (error) {
      alert(error.message)
    } finally {
      loading = false
    }
  }

  async function signOut() {
    try {
      loading = true
      let { error } = await supabase.auth.signOut()
      if (error) throw error
    } catch (error) {
      alert(error.message)
    } finally {
      loading = false
    }

  }
</script>

<form use:getProfile class="form-widget" on:submit|preventDefault={updateProfile}>
  <Avatar bind:path={avatar_url} on:upload={updateProfile} />

  <div>
    <label for="email">Email</label>
    <input id="email" type="text" value={$user.email} disabled />
  </div>
  <div>
    <label for="username">Name</label>
    <input
      id="username"
      type="text"
      bind:value={username}
    />
  </div>
  <div>
    <label for="website">Website</label>
    <input
      id="website"
      type="website"
      bind:value={website}
    />
  </div>

  <div>
    <input type="submit" class="button block primary" value={loading ? 'Loading ...' : 'Update'} disabled={loading}/>
  </div>

  <div>
    <button class="button block" on:click={signOut} disabled={loading}>
      Sign Out
    </button>
  </div>
</form>