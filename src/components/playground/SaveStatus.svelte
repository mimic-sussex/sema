<script>

  import {
      onMount,
      onDestroy
  } from 'svelte';

  import { isActive, url, goto } from "@roxi/routify";

  import {
    items,
    uuid,
    name,
    allowEdits,
    author,
    saving,
    saveRequired
  } from '../../stores/playground'

  import {
    user,
    loggedIn
  } from '../../stores/user'

  import {
    savePlayground,
    forkPlayground
  } from  "../../db/client";

  $: permission = checkPermissions($loggedIn, $allowEdits, $user, $author);

  function checkPermissions(loggedIn, allowEdits, user, author){
    if (allowEdits){
      return true //anyone can edit
    } 
    else if (!allowEdits){
      if (user != null){ 
        
        if (user.id == author){
          return true
        } else {
          return false
        }
      }  else {
        return false
      } 
    }
  }

  //give option to fork project when it is read only (allowEdits false)
  const forkProject = async () => {
    console.log("DEBUG: Forking playground as is readOnly")

    //make sure playground is saved
    await savePlayground($uuid, $name, $items, $allowEdits, $user)

    if ($uuid){
      
      let fork = await forkPlayground($uuid);
      $uuid = fork.id;
      $name = fork.name;
      $items = fork.content.map(item => hydrateJSONcomponent(item));
      $goto($url(`/playground/${$uuid}`)); // reload page cos otherwise the no changes allowed link is still there.
      // window.history.pushState("", "", `/playground/${$uuid}`); //changes the url without realoading;
    }
    else
      throw new Error ('Cant find UUID for project')
  }

</script>

<style>
  .no-changes-link {
    color: grey;
    text-decoration: underline;
    margin:0;
  }

  .login-to-save-link {
    color: grey;
    text-decoration: underline;
    margin:0;
  }

  /* when no changes link is hovered make fork icon turn green to indicate the user
  can fork the project to save their changes. */
  .no-changes-link:hover ~ .button-dark >.icon-container > .fork-icon{
    transition-duration: 0.8s;
    fill: green;
    /* background-color: red; */
  }

  .no-changes-link:hover ~ .button-light >.icon-container > .fork-icon{
    transition-duration: 0.8s;
    fill: green;
    /* background-color: red; */
  }

  /* when no changes allowed link has been click make the background colour of fork button change
  to show the project has been forked visually */
  .no-changes-link:active ~ #fork-button {
    transition-duration: 0.1s;
    background-color: grey;
  }

  .save-status-container {
    width: 250px;
    /* height: 100%; */
    position: relative;
    font-size:medium;
  }

  .save-status-text {
    /* width: 80%; */
    /* text-align:left; */
    color: grey;
    margin: 0;
    text-align: right;
  }

  svg {
    width: 1.5em;
    vertical-align: middle;
  }
</style>

<div class='save-status-container' title='All changes are saved automatically'>
  <!--if playground loaded is readonly say that user doesnt have permission to save-->
  {#if !permission && $user != null}
    <!-- <div class="no-changes-link-container"> -->
      <a href={'#'} class="no-changes-link" 
      on:click={forkProject} 
      title="You do not have permission to save this playground. To save your changes, click to make a copy."
      style="{( $isActive('/playground') )? `visibility:visible;`: `visibility:collapse`}; margin-left: 2px;"
      >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-exclamation-circle" viewBox="0 0 16 16">
        <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
        <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z"/>
      </svg>
      No permission to save</a>
    <!-- </div> -->
  {:else if (!$user) }
    <!-- <p> {$loggedIn} {$user} {permission}</p> -->
    <a href={'/login'} class="login-to-save-link" 
    title="Your changes will not be saved since you are not logged in. Click here to Login/Sign up."
    style="{( $isActive('/playground') )? `visibility:visible;`: `visibility:collapse`}; margin-left: 2px;"
    >
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-exclamation-circle" viewBox="0 0 16 16">
      <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
      <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z"/>
    </svg>
    Login to enable saving</a>
  {/if}

  <!-- <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-clock" viewBox="0 0 16 16">
    <path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5z"/>
    <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z"/>
  </svg> -->
  {#if $user && permission}
    {#if $saving && saveRequired}
          <!-- <div style='display:inline-block;'>
            <Icon name='spinner' size=20/>
          </div> -->
          <p class='save-status-text'
            style='{( $isActive('/playground') )? `visibility:visible;`: `visibility:collapse`};'
            >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-cloud-upload" viewBox="0 0 16 16">
              <path fill-rule="evenodd" d="M4.406 1.342A5.53 5.53 0 0 1 8 0c2.69 0 4.923 2 5.166 4.579C14.758 4.804 16 6.137 16 7.773 16 9.569 14.502 11 12.687 11H10a.5.5 0 0 1 0-1h2.688C13.979 10 15 8.988 15 7.773c0-1.216-1.02-2.228-2.313-2.228h-.5v-.5C12.188 2.825 10.328 1 8 1a4.53 4.53 0 0 0-2.941 1.1c-.757.652-1.153 1.438-1.153 2.055v.448l-.445.049C2.064 4.805 1 5.952 1 7.318 1 8.785 2.23 10 3.781 10H6a.5.5 0 0 1 0 1H3.781C1.708 11 0 9.366 0 7.318c0-1.763 1.266-3.223 2.942-3.593.143-.863.698-1.723 1.464-2.383z"/>
              <path fill-rule="evenodd" d="M7.646 4.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 5.707V14.5a.5.5 0 0 1-1 0V5.707L5.354 7.854a.5.5 0 1 1-.708-.708l3-3z"/>
            </svg>
            Saving...       </p>
    {:else if !$saving && $saveRequired}
        
          <p class='save-status-text'
            style='{( $isActive('/playground') )? `visibility:visible;`: `visibility:collapse`};'
            >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-clock" viewBox="0 0 16 16">
              <path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5z"/>
              <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z"/>
            </svg>
            Not yet saved.</p>
    {:else if !$saving && !$saveRequired}
          
          <p class='save-status-text'
            style='{( $isActive('/playground') )? `visibility:visible;`: `visibility:collapse`};'
            >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-check-circle" viewBox="0 0 16 16">
              <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
              <path d="M10.97 4.97a.235.235 0 0 0-.02.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-1.071-1.05z"/>
            </svg>
            Saved.          </p>
    {/if}
  {/if}
</div>