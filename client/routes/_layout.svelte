<script context="module">
	export async function preload() {
		// '/' absolute URL
    
		return await fetch(`/tutorial/tutorial.json`).then(r => r.json());
	}
</script>

<script>
	// import Nav from '../components//Nav.svelte';
  import { tick, onMount } from 'svelte';
	import UserObserver from '../components/user/UserObserver.svelte';
	import SignOut from '../components/user/SignOut.svelte';
	import AudioEngineStatus from '../components/AudioEngineStatus.svelte';
  import { currentUser } from '../stores/user.js'
  import { url } from "@sveltech/routify";
  import {
    tutorials,
    selected
  } from '../stores/tutorial.js';
	// export let segment;

  $selected =	{
		slug: "basics",
		title: "Basics",
		chapter_dir: "01-basics",
		section_dir: "01-introduction"
	};
  // $: chapter_dir = "01-basics";
  // $: section_dir = "01-introduction";

  $: chapter_dir = $selected.chapter_dir;
  $: section_dir = $selected.section_dir;



  onMount( async () => {
   
    console.log(`DEBUG:routes:_layout:onMount: `); 
    console.log(`DEBUG:routes:_layout: ${chapter_dir}`); 
    console.log(`DEBUG:routes:_layout: ${section_dir}`); 
    $tutorials = await preload();
    $selected = $tutorials[0];
    console.log($tutorials); 
    console.log($selected); 
  });  
</script>

<style>




  
  .header-container {
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
    display: grid;
    display: flex;
    flex-direction: row;
    justify-content: flex-end;
    background: linear-gradient(150deg, rgba(0,18,1,1) 0%, rgba(7,5,17,1) 33%, rgba(16,12,12,1) 67%, rgba(18,16,16,1) 100%);
  }

	h1 {
    margin-top: 0px;
		margin-left: 10px;
    margin-bottom: 0px;
    color: whitesmoke;
	}


  .ul-container{
    margin-top: 0px;
  }

  ul {
    display: flex;
    list-style-type: none;
    margin-bottom: 0px;
    margin-top: 10px;
  }

  li {
    margin-right: 15px;
  }


  .button-dark {
    display: block;
    font-size: 12px;
    font-family: sans-serif;
    font-weight: 400;
    cursor: pointer;
    color: #fff;
    line-height: 1.3;
    padding: 0.7em 1em 0.7em 1em;
    /* width: 100%; */
    max-width: 100%; 
    box-sizing: border-box;
    border: 0 solid #333;
    /* box-shadow: 0 1px 0 0px rgba(4, 4, 4, 0.04); */
    border-radius: .6em;
    margin: 5px;
    /* border-right-color: rgba(34,37,45, 0.1);
    border-right-style: solid;
    border-right-width: 1px;
    border-bottom-color: rgba(34,37,45, 0.1);
    border-bottom-style: solid;
    border-bottom-width: 1px; */
    -moz-appearance: none;
    -webkit-appearance: none;
    appearance: none;
    background-color:  rgba(16, 16, 16, 0.04);
    /* background-image: url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23007CB2%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E'),
      linear-gradient(to bottom, #ffffff 0%,#e5e5e5 100%); */
    background-repeat: no-repeat, repeat;
    background-position: right .7em top 50%, 0 0;
    background-size: .65em auto, 100%;
    -webkit-box-shadow: 2px 2px 5px rgba(0,0,0),-1px -1px 1px rgb(34, 34, 34);
    -moz-box-shadow: 2px 2px 5px rgba(0,0,0), -1px -1px 1px rgb(34, 34, 34);;
    box-shadow: 2px 2px 3px rgb(0, 0, 0), -1px -1px 3px #ffffff61;
    
  }

  /* .sign-out {
    grid-column: 3 / span 2; 
  } */

  /* unvisited link */
  /* span:link {
    color: white;
  } */

  /* visited link */
  /* span:visited {
    color: white;
  }

  span:hover {
    color: rgb(0, 94, 255);
    text-decoration: none;
    cursor: pointer;
  }

  span:active {
    color: rgb(0, 94, 255);
  }

  .whiteText {
    color: whitesmoke;
    
  } */

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

{#if $currentUser}
<div>
  <div class="header-container" >
    
    <h1>sema</h1>

    <!-- <AudioEngineStatus /> -->

    <div class="nav-container">
      <ul>
      <!-- <li>
        <span style="color:white" on:click={handleCClick}>Canvas</span>
      </li> -->  
        <li><a href="/">Home</a></li>

        <li><a href="/playground/">Playground</a></li>

        <!-- Note: need to keep the slash after tutorial path-->
        <!-- <li><a href="/tutorial/">Tutorial</a></li> -->
        <!-- <li><a href="/tutorial/{chapter_dir}/{section_dir}/">Tutorial</a></li> -->
        <!-- <li><a href={$url('/tutorial/:chapter/:section/', {chapter: '01-basics', section: '01-introduction'})}>Tutorial</a></li> -->
        
        <li><a href={$url('/tutorial/:chapter/:section/', {chapter: chapter_dir, section: section_dir})}>Tutorial</a></li>
        <!-- <li><a href="/tutorial/[chapter]/[section]/">Tutorial</a></li> -->
        <!-- <li><a href="/tutorial/01-basics/01-introduction/">Tutorial</a></li> -->


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

    <!-- <SignOut class='sign-out' /> -->

  </div>

  <div class="actions-container">
    <!-- <Dashboard {items} /> -->

    <AudioEngineStatus />

    <SignOut />
  </div>
</div>

{/if}



<slot></slot>
