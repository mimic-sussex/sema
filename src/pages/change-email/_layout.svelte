<script>
  import { user, loggedIn } from "../../stores/user"
  import { redirect } from '@roxi/routify'
  import { changeEmail, supabase } from "../../db/client"
  import { persistentUUID } from "../../stores/navigation.js";

  // import Button from './Button.svelte';

  $: if (!$user) $redirect('/login')

  let newEmail;
  let confirmNewEmail;
  let error;

  let loading = false;

  async function checkAndSend(){
    if (newEmail != null && confirmNewEmail != null){
      if (newEmail == confirmNewEmail){
        await changeEmail(newEmail);
        // signOut();
        // $user = null;
        // $redirect('/login');
      } else {
        error = 'Emails do not match!';
      }
    } else {
      error = 'Please enter your new email (in both fields)'
    }
  }

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
			// localStorage.removeItem("last-session-playground-uuid"); // remove the last session from storage so this cant be accessed by any other user on machine
			$persistentUUID = {playgroundId: ''}; //reset persistentUUID for playground (used by navigation)
			// $params.playgroundId = '';
			// console.log($params.playgroundId, $persistentUUID)
    }
  }


</script>



<div class='container-change-password'>

  
  <div class='container-change-password-form'>
    <h1>Change Email</h1>

    
    <label for="email">Current Email</label>
    <input 	id="email"
            type="email"
            value={ $user.email }
            disabled
            />
    
    <br>
    <!-- NEW PASSWORD -->
    <label for="new-email">New Email:
      <div class=input>
        <input type="email" id="new-email" name="new-email"
              minlength="5" required bind:value={newEmail}>
      </div>
    </label>

    

    <!-- CONFIRM PASSWORD -->
    <label for="confirm-email">Confirm new email:
      <div class=input>
        <input type="email" id="confirm-email" name="new-email"
              minlength="5" required bind:value={confirmNewEmail}>
      </div>
    </label>
    

    <input style="" type="submit" value="Submit" alt='Clicking submit will update your password, <br> then redirect you to the login page.'on:click={() => checkAndSend()}>

    <!-- <br><span></span> -->
          
          {#if error!=null}
          <p style='color: rgba(245, 101, 101);
          text-align: center;'>{error}</p>
          {/if}
  
  </div>


</div>


<style>

  .container-change-password {
    display:flex;
    justify-content:center;
    align-items:center;
  }

  .container-change-password-form {
    padding: 50px 0 100px 0;
  }

  input[type=submit] {
    color: #444;
    text-shadow: 0px 0px 4px rgb(38 111 78 / 50%);
    background: none;

    border-color: rgba(224, 224, 224);
    border-style: solid;
    border-width: 1px;
    cursor: pointer;
    /* display: inline-flex; */
    gap: 0.5rem;
    align-items: center;
    position: relative;
    text-align: center;
    transition-property: background-color, border-color, color, fill, stroke, opacity, box-shadow, transform;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    transition-duration: 150ms;
    border-radius: 0.25rem;
    font-family: inherit;
    font-weight: inherit;

    background: rgb(18, 162, 97);
    border-color: transparent;
    color: white;

    font-size: 1rem;
    line-height: 1.5rem;
    padding-top: 0.5rem;
    padding-bottom: 0.5rem;
    padding-left: 1rem;
    padding-right: 1rem;
    width:100%;
  }

  label {
    font-weight: 500;
    font-size: 0.875rem;
    line-height: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 5px;
    margin-bottom: 1rem;
  }
  input[type=email] {
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
    color:white;
  }

  .input {
    position: relative;
    font-size: 0.875rem;
    line-height: 1.25rem;
    display: flex;
  }
</style>



<!-- <Button block primary size="large" {loading} icon="inbox">Reset Password!!!</Button> -->
<!-- const { error, data } = await supabase.auth.api
      .updateUser(access_token, { password : new_password }) -->

