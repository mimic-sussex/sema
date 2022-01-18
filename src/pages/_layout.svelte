<script>
	import Navigation from './_navigation.svelte'

  import { tick, onMount, onDestroy } from 'svelte'
  import { ready, url, params } from "@roxi/routify";
  import marked from 'marked';
  // import { fly } from 'svelte/transition';

	// import UserObserver from '../components/user/UserObserver.svelte';
	// import SignOut from '../components/user/SignOut.svelte';
	// import AudioEngineStatus from '../components/settings/AudioEngineStatus.svelte';
  // import SiteColor from '../components/settings/SiteColor.svelte';
  import {
		supabase,
		getUserProfile
	} from '../db/client'

  import {
		user,
		userName,
		websiteURL,
		avatarURL,
		loggedIn,
		loading
	} from '../stores/user'

  import {
    tutorials,
    selected,
		selectedSection,
		selectedChapter,
    hydrateJSONcomponent,
		items
  } from '../stores/tutorial.js';

  import {
    links,
    chosenDocs
  } from '../stores/docs.js';


  import { Engine } from 'sema-engine';
  import Controller from "../engine/controller";
  let controller = new Controller(); // this will return the previously created Singleton instance
  let engine = controller.engine;

  import {
    sidebarLiveCodeOptions,
    loadEnvironmentSnapshotEntries,
  } from '../stores/playground.js'

  import {
    siteMode,
    fullScreen,
    sideBarVisible,
    populateCommonStoresWithFetchedProps,
    updateItemPropsWithCommonStoreValues,
    updateItemPropsWithFetchedValues,
    engineStatus
  } from '../stores/common.js';

  import {
    hideNavbar
  } from '../stores/navigation.js';

	// $: $user = ( async () => supabase.auth.user() )()
	// $: ( async () => {
	// 	supabase.auth.user()
	// })()
	$: user.set(supabase.auth.user())

	supabase.auth.onAuthStateChange((_, session) => {
		user.set(session.user)
	})

	
  $: loadSidebarLiveCodeOptions();
  $: loadEnvironmentSnapshotEntries();
  $: fetchAndLoadDefaultTutorial();
  $: fetchAndLoadDefaultTutorialItems();
  $: fetchAndLoadDocsNavLinks(); //preload nav links for documentation (reference)


  $: document.addEventListener( "keydown", e => {

    if ( e.code === "Period" && ( e.ctrlKey || e.metaKey ) ){
      if( !engine && !engine.isHushed )
        engine = new Engine();
        engine.hush();
        $engineStatus = 'paused';
    }
  });

  $: getProfile();
  async function getProfile() {
    console.log('getting profile')
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
    } catch (error) {
      alert(error.message)
    } finally {
      $loading = false
			$loggedIn = true
    }
  }
  





  /**
   * Loads language options from language service and set grammar and default code sources
  */
  let loadSidebarLiveCodeOptions = () => {
		fetch(document.location.origin + `/languages/languages.json`)
      .then(r => r.json())
      .then(json => {
        // console.log("DEBUG:_layout:loadPlayground");
        // console.log(json)
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
      }).catch( () => new Error('Fetching languages.json failed'));
      ;
	}

    /**
   * Fetches Tutorial table of contents and sets default tutorial (Basics/Introduction)
  */
  let fetchAndLoadDefaultTutorial = () => {
  
		fetch(document.location.origin + `/tutorial/tutorial.json`)
      .then(r => r.json())
      .then(json => {
        $tutorials = json;
        // $selected = $tutorials[0].sections[0];
        // console.log("DEBUG: fetchAndLoadDefaultTutorial", $selectedSection, $selectedChapter);
        
        // if section and chapter exists in local storage get that otherwise set to first
        let fetchedSection = localStorage.getItem("last-session-tutorial-section");
        let fetchedChapter = localStorage.getItem("last-session-tutorial-chapter");
        
        // try load from url params first
        if( $params.chapter !== undefined && $params.section !== undefined ){
          console.log('debug: params in url', $params.chapter, $params.section)
          
          let found = false;
          for (let i=0; i<$tutorials.length; i++){
            for (let j=0; j<$tutorials[i].sections.length; j++){
              let a = $tutorials[i].sections[j]
              if ($params.chapter == a.chapter_dir && $params.section == a.section_dir){
                $selectedChapter = $tutorials[i];
                $selectedSection = $tutorials[i].sections[j];
                found = true;
                break;
              }
            }
          }
          if (found == false){
            //set to default (params must be faulty)
            $selectedChapter = $tutorials[0];
            $selectedSection = $selectedChapter.sections[0];
            //update URL
            window.history.pushState("", "", `/tutorial/${$selectedChapter.sections[0].chapter_dir}/${$selectedChapter.sections[0].section_dir}`);
          }

        } else if (fetchedChapter != null && fetchedSection != null) {
          console.log('debug: loading from local')
          fetchedChapter = JSON.parse(fetchedChapter);
          fetchedSection = JSON.parse(fetchedSection);
          // have to set selectedChapter and selectedSection from tutorials otherwise
          // values are not equal when comparing values in next and previous buttons
          let i;
          for (i=0; i<$tutorials.length; i++){
            if ($tutorials[i].title == fetchedChapter.title){
              $selectedChapter = $tutorials[i];
              break;
            }
          }
          // console.log("DEBUG:", $tutorials[0], $selectedChapter, ($tutorials[0] == $selectedChapter));
          let j;
          for (j=0; j<$tutorials[i].sections.length; j++){
            if($tutorials[i].sections[j].slug == fetchedSection.slug){
              $selectedSection = $tutorials[i].sections[j];
              break;
            }
          }
      
        } else {
          $selectedChapter = $tutorials[0];
          $selectedSection = $selectedChapter.sections[0];
        }
        // if (fetchedChapter != null){
        //   $selectedChapter = JSON.parse(fetchedChapter);
        //   console.log('parsed chapter')
        // } else {
        //   $selectedChapter = $tutorials[0];
        //   console.log("grabbed chapter from tut")
        // }

        // if (fetchedSection != null){
        //   $selectedSection = JSON.parse(fetchedSection);
        //   console.log('parsed section')
        // } else {
        //   $selectedSection = $selectedChapter.sections[0];
        //   console.log('grabbed section from tut');
        // }

        $ready();
      }).catch( () => new Error('Fetching tutorial.json failed'));
	}

  /**
   * Fetches and sets the contents of the default tutorial (Basics/Introduction)
  */
  let fetchAndLoadDefaultTutorialItems = async () => {
    if($params.chapter_dir !== undefined && params.section_dir !== undefined){
      fetch(document.location.origin + `/tutorial/${$params.chapter_dir}/${$params.section_dir}/layout.json`)
        .then( r => r.json())
        .then(json => {
          $items = json.map( item => hydrateJSONcomponent(item) );
          $ready();
        }).catch( () => new Error('Fetching default tutorial items failed'));
    } else {
      let json  = await fetch(document.location.origin + `/tutorial/01-basics/01-introduction/layout.json`)
                      .then( r => r.json() );

      $items = json.map( item => hydrateJSONcomponent(item) );

      for (const item of $items){
        await updateItemPropsWithFetchedValues(item);
        await populateCommonStoresWithFetchedProps(item);
        updateItemPropsWithCommonStoreValues(item)
      }
    }
  }

  // This doesnt seem to be used anywhere and is rederfined in pages/navigation so commenting out for time being.
  // let persistentParams = { chapter: '01-basics', section: '01-introduction' };
  // // update url parameters only when navigating tutorials
  // $: if($params.chapter && $params.section) {

  //   persistentParams = $params
  // }

  let fetchAndLoadDocsNavLinks = async () => {
    const res1 = await fetch(document.location.origin + `/docs/docs.json`);
    const json = await res1.json();
    if (res1.ok){
      //let tmpLinks = json;
      //let tmpChosenDocs = tmpLinks[0].path;
      $links = json
      //let result =  await getSubs(tmpLinks);
      //$links = result;
    }
  }

  //get subheadings for a page based on the h1 headers in the .md file.
  //redundant, now we just get these when loading the markdown.
  /*
  async function getSubs(list){
    for (let i=0;i<list.length;i++){
        let currentHeadings = [];
        if (list[i].container == true){
          getSubs(list[i].children);
        } else {
          //get headings for that child
          if(list[i].file != undefined){ // There is a call with undefined value when navigating to Playground
            const res = await fetch(document.location.origin + `/docs/${list[i].file}.md`)
            const text = await res.text();
            if (res.ok) {
              //get tokens from the marked lexer
              let tokens = marked.lexer(text);
              //loop through them
              for (let i=0; i<tokens.length; i++){
                if (tokens[i].type == "heading" && tokens[i].depth == 1){
                  let heading = tokens[i].text;
                  currentHeadings.push({heading: heading , route: heading.replace(/\s+/g, '-').toLowerCase(), active:false})
                }
              }
              list[i].subs = currentHeadings;
            } else {
              throw new Error(text);
            }
          }
        }
    }
    return list
  }
  */

  onMount( async () => {
    console.log('DEBUG: onMount! Root layout')
    // console.log("DEBUG:routes/_layout:onMount");

    // console.log($params);

    // If application loads from index page, entry is through here
    // otherwise, it loads first from playground/index or tutorial/_layout
    // so no need to re-initialise controller here
    // if(!controller.initializing && !controller.samplesLoaded)
    //   await controller.init(document.location.origin +'/sema-engine');

  });

</script>

<style>
  .app-dark {
    background-color: #3a4147; /*#262a2e;*/ /*#151515; */
    color:white;
  }

  .app-light {
    background-color: white;
    color:black;
  }


</style>


<div class= "app { $siteMode === 'dark' ? 'app-dark': 'app-light' }">
  
  <header>
    {#if !$hideNavbar}
      <Navigation />
    {/if}
	</header>
  
  <!-- {#if !$loading}
    {#if $userName && $user}
      <div style='width:100%;'>
        <div style='float:right'>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-bell" viewBox="0 0 16 16">
            <path d="M8 16a2 2 0 0 0 2-2H6a2 2 0 0 0 2 2zM8 1.918l-.797.161A4.002 4.002 0 0 0 4 6c0 .628-.134 2.197-.459 3.742-.16.767-.376 1.566-.663 2.258h10.244c-.287-.692-.502-1.49-.663-2.258C12.134 8.197 12 6.628 12 6a4.002 4.002 0 0 0-3.203-3.92L8 1.917zM14.22 12c.223.447.481.801.78 1H1c.299-.199.557-.553.78-1C2.68 10.2 3 6.88 3 6c0-2.42 1.72-4.44 4.005-4.901a1 1 0 1 1 1.99 0A5.002 5.002 0 0 1 13 6c0 .88.32 4.2 1.22 6z"/>
          </svg>
        </div>
        <div transition:fly="{{ x: 200, duration: 500 }}">
        <span style='
        float:right; 
        border: solid white 1px; 
        padding: 5px 5px 5px 5px;
        background: #212121;
        border-radius: 5px;
        box-shadow: 2px 2px 3px rgb(0, 0, 0), -0.5px -0.5px 3px #ffffff61;
        '>
        Welcome to Sema! <br> You are now logged in. <br> Set a username at the admin page above</span>
        </div>
      </div>
    {/if}
  {/if} -->

	<main>
		<slot />
	</main>

	<footer>
		<!-- <a href="https://github.com/roxiness/routify-starter/tree/auth">Github repo</a>
		| Backgrounds by -->
		<!-- <a href="https://www.svgbackgrounds.com/">svgbackgrounds.com</a> -->
	</footer>
</div>
