<!-- <script context="module">
	export async function preload() {
		// '/' absolute URL
    
		return await fetch(`/tutorial/tutorial.json`).then(r => r.json());
	}
</script> -->

<script>
	// import Nav from '../components//Nav.svelte';
  import { tick, onMount, onDestroy } from 'svelte';
  import { ready, url, params } from "@sveltech/routify";

	import UserObserver from '../components/user/UserObserver.svelte';
	import SignOut from '../components/user/SignOut.svelte';
	import AudioEngineStatus from '../components/AudioEngineStatus.svelte';

  import { currentUser } from '../stores/user.js'

  import {
    tutorials,
    selected,
    hydrateJSONcomponent,
    items
  } from '../stores/tutorial.js';

  import {
    sidebarLiveCodeOptions
  } from '../stores/playground.js'


  $: loadSidebarLiveCodeOptions();
  $: fetchAndLoadDefaultTutorial();
  $: fetchAndLoadDefaultTutorialItems();

  let loadSidebarLiveCodeOptions = () => {
		fetch(`/languages/languages.json`)
      .then(r => r.json())
      .then(json => {
        console.log("DEBUG:_layout:loadPlayground");
        console.log(json)
        $sidebarLiveCodeOptions = $sidebarLiveCodeOptions.concat(json.map( language => ({ 
            id: 1, 
            disabled: false, 
            text: language.name, 
            content : {
              grammar:  `/languages/${language.name}/grammar.ne`,
              livecode: `/languages/${language.name}/code.sem`
            }
          })
        ));
        $ready();
      });
	}

  let fetchAndLoadDefaultTutorial = () => {

		fetch(`/tutorial/tutorial.json`)
      .then(r => r.json())
      .then(json => {
        $tutorials = json;
        $selected = $tutorials[0].sections[0];
        $ready();
      });
	}

  let fetchAndLoadDefaultTutorialItems = () => {

    fetch(`/tutorial/${$params.chapter_dir}/${$params.section_dir}/layout.json`)
      .then( r => r.json())
      .then(json => {
        $items = json.map( item => hydrateJSONcomponent(item) );
        $ready(); 
      });

  }

  let persistentParams = { chapter: '01-basics', section: '01-introduction' };
  // update url parameters only when navigating tutorials
  $: if($params.chapter && $params.section) persistentParams = $params

  onMount( async () => {

    console.log("DEBUG:routes/_layout:onMount");
    console.log($params);

  });

</script>

<style>

  .main-container {
    display: grid;
    grid-template-rows: 3rem 3rem auto;
    width: 100%;
    height: 100%;
    background: linear-gradient(150deg, rgba(0,18,1,1) 0%, rgba(7,5,17,1) 33%, rgba(16,12,12,1) 67%, rgba(18,16,16,1) 100%);
  }


  .header-container {
    grid-row: 1;
    display: grid;
    grid-template-columns: 40px auto auto;
    width: 100%;
    background: linear-gradient(150deg, rgba(0,18,1,1) 0%, rgba(7,5,17,1) 33%, rgba(16,12,12,1) 67%, rgba(18,16,16,1) 100%);
  }
  

  .nav-container {
    grid-column: 3 / span 2;
    display: flex;
    flex-direction: row;
    justify-content: flex-end;
    width: 100%;
    /* background: linear-gradient(150deg, rgba(0,18,1,1) 0%, rgba(7,5,17,1) 33%, rgba(16,12,12,1) 67%, rgba(18,16,16,1) 100%); */
  }

  .actions-container {
    grid-row: 2;
    /* display: grid; */
    display: flex;
    flex-direction: row;
    justify-content: flex-end;
    background: linear-gradient(150deg, rgba(0,18,1,1) 0%, rgba(7,5,17,1) 33%, rgba(16,12,12,1) 67%, rgba(18,16,16,1) 100%);
  }

  .slot-container {
    grid-row: 3;

  }

	h1 {
    margin-top: 0px;
		margin-left: 10px;
    margin-bottom: 0px;
    color: whitesmoke;
	}

  /* 
  .ul-container{
    margin-top: 0px;
  } */

  ul {
    display: flex;
    list-style-type: none;
    margin-bottom: 0px;
    margin-top: 10px;
  }

  li {
    margin-right: 15px;
  }


  a, a:hover {
    color: whitesmoke;
  }
  a:hover {
    color: rgb(0, 94, 255);
  }

  path:hover {
    fill: rgb(0, 94, 255);
  }

  path {
    fill: #0050A0;
  }

</style>

<svelte:head>
  <link type="text/css" rel="stylesheet" href="https://www.gstatic.com/firebasejs/ui/4.5.0/firebase-ui-auth.css" />
	<title>Sema</title>
</svelte:head>

<UserObserver />

<div class="main-container">

  {#if $currentUser}
  <div>
    <div class="header-container" >
      <h1>sema</h1>
      <div class="nav-container">
        <ul>
        <!-- <li>
          <span style="color:white" on:click={handleCClick}>Canvas</span>
        </li> -->  
          <li><a href="/">Home</a></li>
          <!-- Note: need to keep the slash after tutorial path-->
          <li><a href="/playground/">Playground</a></li>
          <li><a href={ $url('/tutorial/:chapter/:section/', persistentParams ) }>Tutorial</a></li>
          <li><a href='https://github.com/mimic-sussex/sema/tree/master/docs' target="_blank">Docs</a></li>
          <!-- <li><a href="/blog/">Blog</a></li> -->
          <li>
            <a href='https://forum.toplap.org/c/communities/sema' target="_blank">
              <svg class="icon svelte-5yec39" width="25" height="20">
                <use xlink:href="#community"></use>
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
            </a>
          </li>
          <li>
            <a href='https://github.com/mimic-sussex/sema' target="_blank">
              <svg class="icon svelte-5yec89" width="25" height="20">
                <use xlink:href="#github"></use>
                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
              </svg>
            </a>
          </li>
        </ul>
      </div>
    </div>

    <div class="actions-container">

      <AudioEngineStatus />

      <SignOut />
    </div>

  </div>

  {/if}

  <!-- Dashboard {items} -->
  <div class="slot-container">
    <slot></slot>
  </div>

</div>