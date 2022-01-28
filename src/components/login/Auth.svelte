<!-- no longer used supabase-ui-svelte is now used -->

<!-- <script>
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

<form class="row flex flex-center"
			on:submit|preventDefault={ handleLogin }
			>
  <div class="col-6 form-widget">
    <p class="description">
			Sign in via magic link with your email below
		</p>
    <div>
      <input
        class="inputField"
        type="email"
        placeholder="Your email"
        bind:value={ email }
      />
    </div>
    <div>
      <input type="submit"
							class='button block'
							value={ loading ? "Loading" : "Send magic link" }
							disabled={ loading } />
    </div>
  </div>
</form> -->