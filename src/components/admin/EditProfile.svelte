<script>

import { redirect } from '@roxi/routify'

  import {
    isEditAccountOverlayVisible,
    isDeleteAccountOverlayVisible
  } from '../../stores/profile.js';

  import {
		user,
		userName,
		websiteURL
  } from '../../stores/user'

  import {
    updateProfile,
    changeEmail
	} from '../../db/client'

  import { onMount, onDestroy } from 'svelte';
  import { fly, fade } from 'svelte/transition';

  // import {
  //   ProfileOld
  // } from './ProfileOld.svelte'

  const closeOverlay = () => {
    $isEditAccountOverlayVisible = false;
  }

  onMount( async () => {
    // engine = new Engine();
		console.log("edit-profile")
  });

  onDestroy( () => {
    // engine = null;
	});

</script>

<div  in:fly="{{ y: 200, duration: 300 }}" out:fade
      class="edit-profile-overlay-component"
      style='visibility:{ $isEditAccountOverlayVisible ? "visible": "hidden"}'
      >
    <h1>Edit Profile</h1>

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

    <button on:click={()=>updateProfile($user, $userName, $websiteURL)}>
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-person-circle" viewBox="0 0 16 16">
        <path d="M11 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"/>
        <path fill-rule="evenodd" d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm8-7a7 7 0 0 0-5.468 11.37C3.242 11.226 4.805 10 8 10s4.757 1.225 5.468 2.37A7 7 0 0 0 8 1z"/>
      </svg>
      Update Profile</button>

    <h1>Account Settings</h1>
    <div>
      <label for="email">Email</label>
    <input 	id="email"
						type="text"
            bind:value={ $user.email }
            disabled
						/>
    </div>

    <button on:click={()=>$redirect('/change-email')}>
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-envelope" viewBox="0 0 16 16">
        <path d="M0 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V4Zm2-1a1 1 0 0 0-1 1v.217l7 4.2 7-4.2V4a1 1 0 0 0-1-1H2Zm13 2.383-4.708 2.825L15 11.105V5.383Zm-.034 6.876-5.64-3.471L8 9.583l-1.326-.795-5.64 3.47A1 1 0 0 0 2 13h12a1 1 0 0 0 .966-.741ZM1 11.105l4.708-2.897L1 5.383v5.722Z"/>
      </svg>
      Change Email</button>
    
    <hr>
    <button style='' on:click={() => $redirect('/change-password')} id='change-pass'>
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-key" viewBox="0 0 16 16">
        <path d="M0 8a4 4 0 0 1 7.465-2H14a.5.5 0 0 1 .354.146l1.5 1.5a.5.5 0 0 1 0 .708l-1.5 1.5a.5.5 0 0 1-.708 0L13 9.207l-.646.647a.5.5 0 0 1-.708 0L11 9.207l-.646.647a.5.5 0 0 1-.708 0L9 9.207l-.646.647A.5.5 0 0 1 8 10h-.535A4 4 0 0 1 0 8zm4-3a3 3 0 1 0 2.712 4.285A.5.5 0 0 1 7.163 9h.63l.853-.854a.5.5 0 0 1 .708 0l.646.647.646-.647a.5.5 0 0 1 .708 0l.646.647.646-.647a.5.5 0 0 1 .708 0l.646.647.793-.793-1-1h-6.63a.5.5 0 0 1-.451-.285A3 3 0 0 0 4 5z"/>
        <path d="M4 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
      </svg>
      Change Password</button>

    <button style='background:red' on:click={() => $isDeleteAccountOverlayVisible = true}>
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash" viewBox="0 0 16 16">
        <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
        <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
      </svg>
      Delete Account</button>
    <hr>
    <button class='button-dark' on:click={()=>$isEditAccountOverlayVisible = false}>Close</button>

    

</div>

<style>
  .button-dark {
    width: 5.5em;
    height: 2.5em;
    /* padding: 0.2em 0.2em 0.8em 0.8em; */
    display: block;
    /* font-size: 12px; */
    font-family: sans-serif;
    font-weight: 400;
    cursor: pointer;
    color: white;

    line-height: 1.3;
    max-width: 100%;
    box-sizing: border-box;
    border: 0 solid #333;
    text-align: center;
    /* margin-top: 5px; */
    margin-right: 5px;
    border-radius: .6em;
    -moz-appearance: none;
    -webkit-appearance: none;
    appearance: none;
    background-color:  rgba(16, 16, 16, 0.04);
    /* background-image: url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23007CB2%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E'),
      linear-gradient(to bottom, #ffffff 0%,#e5e5e5 100%); */
    background-repeat: no-repeat, repeat;
    background-position: right .7em top 50%, 0 0;
    background-size: .65em auto, 100%;
    -webkit-box-shadow: 2px 2px 3px rgb(0, 0, 0), -0.5px -0.5px 3px #ffffff61;
    -moz-box-shadow: 2px 2px 3px rgb(0, 0, 0), -0.5px -0.5px 3px #ffffff61;
    box-shadow: 2px 2px 3px rgb(0, 0, 0), -0.5px -0.5px 3px #ffffff61;

  }

  .button-dark:active {
    width: 10.5em;
    height: 2.5em;
    padding: 0.2em 0.2em 0.8em 0.8em;
    display: block;
    font-size: medium;
    /* font-size: 12px; */
    font-family: sans-serif;
    font-weight: 400;
    cursor: pointer;
    color: red;
    line-height: 1.3;
    max-width: 100%;
    box-sizing: border-box;
    /* margin-top: 5px; */
    margin-right: 5px;
    /* border: 0 solid #333; */
    text-align: left;
    -moz-appearance: none;
    -webkit-appearance: none;
    appearance: none;
    background-color:  rgba(16, 16, 16, 0.04);
    background-repeat: no-repeat, repeat;
    /* background-position: right .7em top 50%, 0 0; */
    background-size: .65em auto, 100%;
    /* -webkit-box-shadow: -1px -1px 1px rgb(34, 34, 34), 2px 2px 5px rgba(0,0,0),;
    -moz-box-shadow: -1px -1px 1px rgb(34, 34, 34), 2px 2px 5px rgba(0,0,0), ;
    box-shadow:  -1px -1px 3px #ffffff61, 2px 2px 3px rgb(0, 0, 0); */
    box-shadow:  -1px -1px 3px rgba(16, 16, 16, 0.4), 0.5px 0.5px 0.5px rgba(16, 16, 16, 0.04);
  }

  .edit-profile-overlay-button-container {
    display: inline-flex;
  }

  .edit-profile-overlay-component {
    background-color: rgba(16,12,12,0.8);
    width: 100%;
		height:100%;
    display:flex;
    /* justify-content:center; */
    align-items:center;
		flex-direction:column;
    font-size:16px;
  }


  .edit-profile-overlay-text {
    /* top:50%; */

    /* width: 100%; */
    /* position: absolute; */
    color: #FFF;
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
    color:white;
  }

  button {
    color: #444;
    text-shadow: 0px 0px 4px rgb(38 111 78 / 50%);
    background: none;

    border-color: rgba(224, 224, 224);
    border-style: solid;
    border-width: 1px;
    cursor: pointer;
    
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

    background: #212121;
    border-color: transparent;
    color: white;

    font-size: 1rem;
    line-height: 1.5rem;
    padding-top: 0.5rem;
    padding-bottom: 0.5rem;
    padding-left: 1rem;
    padding-right: 1rem;
    width:200px;


    /* font-size: 0.9rem;
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
    color:white; */
  }

  button.secondary {
    background: rgb(18, 162, 97);
  }
  button:disabled{
    color:grey;
  }

  svg {
    position: relative;
    top: 0.15em;
  }
</style>
