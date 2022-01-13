<!-- USER PROFILE PAGE -->

<script>

  import {
    onMount,
    onDestroy
  } from 'svelte';

  import { redirect, params, goto, beforeUrlChange } from '@roxi/routify'

  import { user } from "../../stores/user"
  
  import { supabase } from "../../db/client.js"

  import Profile from "./views/Profile.svelte";
  import UserList from "./views/UserList.svelte";
  import UserNotFound from "./views/UserNotFound.svelte";

  $: loadProfile($params.userId);

  // let username = '';
  let userExists = false;

  let view = ''// a given profile, user-list or this user-not-found

  let profileData; //object storing profile data
  let projectData;

  let userList;

  async function fetchProfile(username) {
    if (supabase) {
        let { data, error, status } = await supabase
          .from('profiles')
          .select(`id, username, website, avatar_url`)
          .eq('username', username)
          .single()

        // if (error && status !== 406) throw error
        return data
    }
    else
		  throw new Error('Supabase client has not been created') 
}

async function fetchUserList(){
  if (supabase) {
        let { data, error, status } = await supabase
          .from('profiles')
          .select(`id, username, website, avatar_url`)
        // if (error && status !== 406) throw error
        return data
    }
    else
		  throw new Error('Supabase client has not been created') 
}

async function fetchProjects (username) {
  if (supabase) {
        let { data, error, status } = await supabase
          .from('playgrounds')
          .select(`id, name, isPublic, author ( username )`)
          .eq('author', profileData.id)
          .match({"author": profileData.id, 'isPublic': true})
        
        return data
    }
    else
		  throw new Error('Supabase client has not been created') 
}


  async function loadProfile(){
    //lookup username
    if ($params.userId) {

      let username = $params.userId;
      // let profileData;
      try {
        profileData = await fetchProfile(username);
        // console.log(profileData)
        if (profileData !== null){
          userExists = true;
          projectData = await fetchProjects(username);
          // console.log(projectData)
          view = 'profile'
        } else {
          view = 'user-not-found'
          userExists = false;
        }
      } catch(error) {
        console.log(error) 
      }
        
    } else {
      //display list of all users in system with a search bar.
      userList = await fetchUserList()
      // console.log(userList)
      view = 'user-list';
    }
  }

  onMount( async () => {

    // loadProfile();
 
  });

</script>

<svelte:head>
  {#if view == 'profile'}
	  <title>Sema – {$params.userId}'s Profile</title>
  {:else if view == 'user-list'}
    <title>Sema – User List</title>
  {:else if view='user-not-found'}
    <title>Sema – User Not Found</title>
  {/if}
</svelte:head>

{#if view == ''}
  loading...
{:else}

  {#if view == 'user-list'}
      <!-- view: {view} -->
      <UserList userList={userList}/>
  {:else if view == 'profile'}
    
    <a href='/user'>
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-chevron-left" viewBox="0 0 16 16">
        <path fill-rule="evenodd" d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z"/>
      </svg>
      Go to user directory
    </a>

    <Profile username={'blah'} profileData={profileData} projects={projectData}/>
  {:else if view == 'user-not-found'}
    
      <a href='/user'>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-chevron-left" viewBox="0 0 16 16">
          <path fill-rule="evenodd" d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z"/>
        </svg>
        Go to user directory
      </a>

      <UserNotFound />
  {/if}

{/if}