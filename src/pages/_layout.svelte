<script>
	import Navigation from './_navigation.svelte'

  import { tick, onMount, onDestroy } from 'svelte'
  import { ready, url, params } from "@roxi/routify";
  import marked from 'marked';

	// import UserObserver from '../components/user/UserObserver.svelte';
	// import SignOut from '../components/user/SignOut.svelte';
	// import AudioEngineStatus from '../components/settings/AudioEngineStatus.svelte';
  // import SiteColor from '../components/settings/SiteColor.svelte';

  import { currentUser } from '../stores/user.js'

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
    loadEnvironmentSnapshotEntries
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
        $selectedChapter = $tutorials[0];
        $selectedSection = $selectedChapter.sections[0];

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

  let persistentParams = { chapter: '01-basics', section: '01-introduction' };
  // update url parameters only when navigating tutorials
  $: if($params.chapter && $params.section) {

    persistentParams = $params
  }

  let fetchAndLoadDocsNavLinks = async () => {
    const res1 = await fetch(document.location.origin + `/docs/docs.json`);
    const json = await res1.json();
    if (res1.ok){
      let tmpLinks = json;
      //let tmpChosenDocs = tmpLinks[0].path;
      let result =  await getSubs(tmpLinks);
      $links = result;
    }
  }

  //get subheadings for a page based on the h1 headers in the .md file.
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

  onMount( async () => {
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
    background-color: #151515;
    color:white;
  }

  .app-light {
    background-color: white;
    color:black;
  }


</style>


<div class= "app { $siteMode === 'dark' ? 'app-dark': 'app-light' }">
  <header>
		<Navigation />
	</header>

	<main>
		<slot />
	</main>

	<footer>
		<!-- <a href="https://github.com/roxiness/routify-starter/tree/auth">Github repo</a>
		| Backgrounds by -->
		<!-- <a href="https://www.svgbackgrounds.com/">svgbackgrounds.com</a> -->
	</footer>
</div>
