<script>
  import { onMount, onDestroy, tick } from 'svelte';

  import Grid from "svelte-grid";
  import gridHelp from "svelte-grid/build/helper";

  import Settings from '../../components/settings/Settings.svelte';
  import Loading from '../../components/overlays/Loading.svelte';
  import Mouse from '../../components/widgets/devices/Mouse.svelte';
  import Mic from '../../components/widgets/devices/Mic.svelte';
  // import Dashboard from '../../components/layouts/Dashboard.svelte';
  // import Markdown from "../../components/tutorial/Markdown.svelte";

  import { goto, ready, url, params } from "@roxi/routify";

  // import { hydrateJSONcomponent } from '../../stores/common.js';
  // import { hydrateJSONcomponent } from '../../stores/playground.js';

  import {
    tutorials,
    // selected,
		selectedChapter,
    selectedSection,
    items,
    hydrateJSONcomponent,
    populateStoresWithFetchedProps,
    isLoadingOverlayInTutorialVisible,

  } from '../../stores/tutorial.js';

  import {
    populateCommonStoresWithFetchedProps,
    updateItemPropsWithCommonStoreValues,
    updateItemPropsWithFetchedValues,
    isMouseOverlayVisible,
    siteMode
  } from "../../stores/common.js";

  import Controller from "../../engine/controller";
  let controller = new Controller(); // this will return the previously created Singleton instance

  let container;

  // Tutorial dashboard configuration
  let cols = [
    // [2880, 13]
    [1600, 8],
    [1440, 6],
    [1280, 3],
    // [1024, 2],
    // [800, 1],
    // [500, 1]
  ];
  let rowHeight = 100;
  let gap = [2, 2];


	const setNextTutorial = e => {
		if($tutorials.indexOf($selectedChapter) + 1 < $tutorials.length){ // if 1st chapter //NEW if anything but the last chapter
			// if last section of 1st chapter
			if($selectedChapter.sections.length === $selectedChapter.sections.indexOf($selectedSection) + 1 ){
				// change chapter, set first section
				$selectedChapter = $tutorials[$tutorials.indexOf($selectedChapter) + 1];
				$selectedSection = $selectedChapter.sections[0];
			}
      else // if intermediate section, skip to 1st chapters' next section
        $selectedSection = $selectedChapter.sections[$selectedChapter.sections.indexOf($selectedSection) + 1];
		}
		else { // of last chapter
			if($selectedChapter.sections.length === $selectedChapter.sections.indexOf($selectedSection) + 1){  // if last section of last chapter
				$selectedChapter = $tutorials[0];
				$selectedSection = $selectedChapter.sections[0];
			}
			else
				// if intermediate section, skip to last chapters' next section
				$selectedSection = $selectedChapter.sections[$selectedChapter.sections.indexOf($selectedSection) + 1];
		}
  }
  
  const setPreviousTutorial = e => {
		if($tutorials.indexOf($selectedChapter) > 0 ){ //if anything but first chapter
      //if first section of selected chapter -->change to previous chapter, and last section of that chapter
			if($selectedChapter.sections.indexOf($selectedSection) === 0 ){
				$selectedChapter = $tutorials[$tutorials.indexOf($selectedChapter) - 1];
				$selectedSection = $selectedChapter.sections[$selectedChapter.sections.length - 1];
			}
      else 
        $selectedSection = $selectedChapter.sections[$selectedChapter.sections.indexOf($selectedSection) - 1];
		}
    else { //first chapter
			if($selectedChapter.sections.indexOf($selectedSection) === 0 ){ //if selected section of first chapter is the very first one
				$selectedChapter = $tutorials[$tutorials.length - 1 ]; //set chapter to last
				$selectedSection = $selectedChapter.sections[$selectedChapter.sections.length - 1]; //last section of last chapter
			}
			else
        $selectedSection = $selectedChapter.sections[$selectedChapter.sections.indexOf($selectedSection) - 1];
		}
  }

	const handleButtonClick = e => {
		try {
      // await tick();
      $items = []; // refresh items to call onDestroy on each (learner need to terminate workers)
			e? setNextTutorial(): setPreviousTutorial();
      localStorage.setItem("last-session-tutorial-url", `/tutorial/${$selectedSection.chapter_dir}/${$selectedSection.section_dir}/`);
      localStorage.setItem("last-session-tutorial-section", JSON.stringify($selectedSection));
      localStorage.setItem("last-session-tutorial-chapter", JSON.stringify($selectedChapter));
      $goto(`/tutorial/${$selectedSection.chapter_dir}/${$selectedSection.section_dir}/`);
		} catch (error) {
      console.error("Error navigating tutorial environment", error);
		}
	}

  let handleSelect = e => {
    try{
      // await tick();
      $items = []; // refresh items to call onDestroy on each (learner need to terminate workers)
      localStorage.setItem("last-session-tutorial-url", `/tutorial/${$selectedSection.chapter_dir}/${$selectedSection.section_dir}/`);
      $selectedChapter = $tutorials.filter(chapter => chapter.sections.includes($selectedSection)).shift();
      localStorage.setItem("last-session-tutorial-section", JSON.stringify($selectedSection));
      localStorage.setItem("last-session-tutorial-chapter", JSON.stringify($selectedChapter));
      $goto(`/tutorial/${$selectedSection.chapter_dir}/${$selectedSection.section_dir}/`);
    }
    catch(error){
      console.error("Error Selecting and loading tutorial environment", error);
    }
  }


  const update = (e, dataItem) => {

    try{

      if(e !== undefined && e.detail !== undefined && dataItem !== undefined){
        if(e.detail.prop === "content"){

          // Content update from CodeMirror update with 'content' prop and value
          dataItem.data[e.detail.prop] = e.detail.value;
          // Update item and items collection by filtering out version with old value and concating update version
          $items = [...$items.filter(i => i !== dataItem), ...[dataItem]]
        }
        else if(e.detail.prop === "hasFocus"){
          // Currently, NO focused item feedback on tutorial
          // setFocused(dataItem);
        }
      }
    }
    catch(error){
      console.error("Error updating item", error);
    }

  }

  const onAdjust = e => {
    // console.log("DEBUG:dashboard:onAdjust:", e.detail);
    // $items = $items; // call a re-render
  };

  const onChildMount = e => {
    // console.log("DEBUG:dashboard:onChildMount:"ii, e.detail);
    // $items = $items; // call a re-render
  };

  onMount( async () => {
    console.log("DEBUG:routes/tutorial/_layout:onMount");
    if(!controller.samplesLoaded){
      $isLoadingOverlayInTutorialVisible = true;
      console.warn("samples loaded");
      await controller.init(document.location.origin + '/build/');
      $goto(localStorage.getItem("last-session-tutorial-url"));
      $isLoadingOverlayInTutorialVisible = false;
    }
    console.log(localStorage.getItem("last-session-tutorial-url"));
    if($items.length === 0 && localStorage["last-session-tutorial-url"]){
      let sessionTutorialURL = document.location.origin + localStorage.getItem("last-session-tutorial-url") + 'layout.json'
      let json = await fetch(sessionTutorialURL)
                            .then( r => r.json());

      $items = json.map( item => hydrateJSONcomponent(item) );
    }

    console.log("DEBUG onMount tutorial!!", $selectedSection, selectedChapter, $tutorials);
    // if section and chapter exists in local storage get that otherwise set to first
    // let fetchedSection = localStorage.getItem("last-session-tutorial-section");
    // let fetchedChapter = localStorage.getItem("last-session-tutorial-chapter");
    // if (fetchedSection != null){
    //   $selectedSection = JSON.parse(fetchedSection);
    // } else {
    //   $selectedSection = $selectedChapter.sections[0];
    // }
    // if (fetchedChapter != null){
    //   $selectedChapter = JSON.parse(fetchedChapter);
    // } else {
    //   $selectedChapter = $tutorials[0];
    // }
    // console.log("DEBUG onMount tutorial!!2", $selectedSection, selectedChapter, $tutorials);

    for (const item of $items){
      await updateItemPropsWithFetchedValues(item);
      await populateCommonStoresWithFetchedProps(item);
      updateItemPropsWithCommonStoreValues(item)
    }

    //$goto(localStorage.getItem("last-session-tutorial-url"));
  });

  onDestroy(() => {

    $items = [];

    if(controller){
      controller.stop();
    }
    // console.log("DEBUG:routes/tutorial/_layout:onDestroy")
  });

</script>

<svelte:head>
	<title>Sema – Tutorial</title>
</svelte:head>

<div class="container">

  <div class="overlay-container"
  style='visibility:{ ( $isLoadingOverlayInTutorialVisible ) ? "visible" : "hidden"}'
  >
    {#if $isLoadingOverlayInTutorialVisible}
      <Loading/>
    {/if}
  </div>

  <div class="tutorial-sidebar-container"
    bind:this={ container }
    >

    <div class="tutorial-navigator">

      <button class="button-dark left"
							on:click={ e => handleButtonClick(0) }
							>
        <!-- ◄ -->
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-caret-left" viewBox="0 0 16 16">
          <path d="M10 12.796V3.204L4.519 8 10 12.796zm-.659.753-5.48-4.796a1 1 0 0 1 0-1.506l5.48-4.796A1 1 0 0 1 11 3.204v9.592a1 1 0 0 1-1.659.753z"/>
        </svg>
      </button>

      <!-- <div class="divider-left"></div> -->

      <div class="combobox-dark middle">
        <!-- svelte-ignore a11y-no-onchange -->
        <select
                bind:value={ $selectedSection }
                on:change={ e => handleSelect(e) }
                >
          {#if $tutorials !== undefined}
            {#each $tutorials as chapter, i}
              <optgroup label="{i + 1}. {chapter.title}">
                {#if chapter.sections !== undefined}
                  {#each chapter.sections as section, i}
                    {#if $selectedSection}
                      {#if section.title == $selectedSection.title}
                        <option value={section} selected=true>{i + 1}. {section.title}</option>
                      {:else}
                        <option value={section} >{i + 1}. {section.title}</option>
                      {/if}
                    {/if}
                    <!-- <option value={section}>{String.fromCharCode(i + 97)}. {section.title}</option> -->                    
                  {/each}
                {/if}
              </optgroup>
            {/each}
          {/if}
        </select>
      </div>

      <!-- <div class="divider-right"></div> -->

      <button class="button-dark right"
							on:click={ e => handleButtonClick(1) }
							>
        <!-- ► -->
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-caret-right" viewBox="0 0 16 16">
          <path d="M6 12.796V3.204L11.481 8 6 12.796zm.659.753 5.48-4.796a1 1 0 0 0 0-1.506L6.66 2.451C6.011 1.885 5 2.345 5 3.204v9.592a1 1 0 0 0 1.659.753z"/>
        </svg>
      </button>

    </div>

    <div class="markdown-container">
      <slot scoped={ $selectedSection } />
    </div>
  </div>

  <div class="{$siteMode === 'dark' ? 'settings-container' : 'settings-container-light'}">
    <Settings/>
  </div>
<!--
      on:adjust={onAdjust}
      on:mount={onChildMount} -->

  <div class='devices-container'>
    <div class='' style=''>
      <Mouse />
    </div>

    <div class='' style=''>
      <Mic />
    </div>
  </div>

  <div  class="mouse-overlay-container" style='visibility:{$isMouseOverlayVisible? "visible": "hidden"}'
        >
  </div>


  <div class="tutorial-dashboard-container">
    <Grid
      bind:items={ $items }
      { cols }
      { rowHeight }
      { gap }
      fastStart={ false }
      on:adjust={ onAdjust }
      on:mount={ onChildMount }
      let:item
      let:dataItem
      scroller={ container }
    >

      <div class='chrome'
          style="background: #262a2e;"
          >
          <div class='item-header-type'>
            <span>{ dataItem.data.type }</span>
          </div>
        </div>

      <div  class="content"
            style="background: { item.fixed ? '#bka' : dataItem.data.background };"
            on:pointerdown={ e => e.stopPropagation() }
            >
        <svelte:component class='component'
                          this={ dataItem.data.component }
                          { ...dataItem.data }
                          on:change={ e => update(e, dataItem) }
                          />
      </div>
    </Grid>
  </div>
</div>

<style global>
  .container {
  	width: 100%;
  	height: 100%;
  	display: grid;
  	grid-template-columns: auto 1fr;
    grid-template-rows: auto 1fr;
  	grid-template-areas:
  		"sidebar settings devices"
  		"sidebar layout layout";
    overflow: hidden;
    /* background: linear-gradient(150deg, rgba(0,18,1,1) 0%, rgba(7,5,17,1) 33%, rgba(16,12,12,1) 67%, rgb(12, 12, 12) 100%); */
  }

  .container-dark {
    background: #151515;

  }

  .container-light {
    background: #151515;

  }

  .tutorial-sidebar-container {
    /* background: linear-gradient(150deg, rgba(0,18,1,1) 0%, rgba(7,5,17,1) 33%, rgba(16,12,12,1) 67%, rgb(12, 12, 12) 100%); */
    grid-area: sidebar;
    /* grid-row: 0 / 1; */
    height: 100%;
    /* width: auto; width is defined by child */
    min-width: 15em;
    max-width: 22em;
    /* position: absolute; */
    padding-left: 0.1em;
    padding-right: 0.2em;
  }

  .settings-container {
    /* background: linear-gradient(150deg, rgba(0,18,1,1) 0%, rgba(7,5,17,1) 33%, rgba(16,12,12,1) 67%, rgb(12, 12, 12) 100%); */
    /* background: #151515; */
    grid-area: settings;
    height: 100%;
    width: auto; /* width is defined by child */
  }

  .settings-container-light {
    /* background: linear-gradient(150deg, rgba(0,18,1,1) 0%, rgba(7,5,17,1) 33%, rgba(16,12,12,1) 67%, rgb(12, 12, 12) 100%); */
    background: white;
    grid-area: settings;
    height: 100%;
    width: auto; /* width is defined by child */
  }
  
  .devices-container {
    width: 100%;
    grid-area:devices;
    display: flex;
    flex-direction: row;
    align-self: flex-end;
    background-color: #262a2e;
    border-radius: 5px;
    height: 50px;
    margin: 0.5em 0px 0.5em 0em;
  }

  .tutorial-navigator {
    display: grid;
    grid-template-columns: auto auto auto;
    width: 100%;

    /* padding-left: 0.2em; */
    padding-right: 0.3em;
    margin-bottom: 0.05em;
    /* margin-left: 3px; */
    /* margin-right: 0.4em; */
  }

  .chrome {
    grid-row: 1/1;
    grid-column: 1/3;
    display: grid;
    /* grid-template-columns: auto 1fr auto; */
    position: relative;
    /* background: rgba(25, 25, 25, 0.6); */
    /* border-width: 1px 1px 1px 1px; */
    /* top: 1.4em; */
    border-radius: 5px 5px 0px 0px;
    padding: 0.2em 0.1em 0.1em 0.1em;
    z-index: 1500;
  }

  .item-header-type {
    grid-column: 2/2;
    /* padding-top: 0.2em; */
  }

  .content {
    /* grid-row: 2/2;
    grid-column: 1/3;
    width: 100%;
    height: 100%;
    border-radius: 0px;
    border-top-left-radius: 0px;
    border-bottom-right-radius: 0px;
    overflow-y:hidden; */

    grid-row: 2/2;
    grid-column: 1/3;
    width: 100%;
    height: 100%;
    /* border-radius: 0px; */
    border-radius: 0px 0px 5px 5px;
    overflow-y:hidden;

  }


  .markdown-container {
    height: calc(100vh - 86px);
    padding-left: 0.1em;
    padding-right: 0.1em;
    /* margin-bottom: 2px; */
    /* border: solid 2px #aaaaaa; */
    border-radius: 5px;
    /* background: #aaaaaa; */
    overflow-y: scroll;
  }

  .tutorial-dashboard-container {
    grid-area: layout;
    /* grid-row: 0 / 2; */
    height: 100%;
    /* position: absolute; */
    overflow: hidden;
    margin-left: 0.2em;
  }


  .mouse-overlay-container {
    grid-area: layout;
    z-index: 1000;
    background-color: rgba(16,12,12,0.8);
    visibility: visible;
    width: 100%;

    display:flex;
    justify-content:center;
    align-items:center;
    font-size:16px;
    visibility: hidden;
  }


  .combobox-dark select {
    width:100%;
    height: 50px;
    background-color: #262a2e;
    color: white;
    border: none;
    border-radius: 5px;
    margin: 8px 0px 8px 0px;
    padding:0px;
  }

  .button-dark {
		padding: 20;
		color: grey;
		border: none;
  	margin: 8px 8px 8px 8px;
  	border-radius: 5px;
  	background-color: #262a2e;
	}

  .button-dark:hover {
    color: white;
  }

  .button-dark:active{
    color: white;
    background-color: grey;
  }

  .left {
    grid-column: 1;
    height: 50px; /*to match the size of the settings bar*/
  }

  .divider-left {
    width: 4px;
    /* height: 50px; */
    /* margin: 1px 11px 1px 17px; */
    border-radius: 2px;
    box-shadow: inset 1px 1px 4px 0 #070709, inset -1px -1px 4px 0 rgba(255, 255, 255, 0.05);
    margin: 0.5em 0px 0.5em 0em;
    grid-column:2;
  }


  .middle {
    /* margin-left: 4px; */
    /* margin-right: 4px; */
    grid-column: 3;
  }

  .divider-right {
    width: 4px;
    /* height: 50px; */
    /* margin: 1px 11px 1px 17px; */
    border-radius: 2px;
    box-shadow: inset 1px 1px 4px 0 #070709, inset -1px -1px 4px 0 rgba(255, 255, 255, 0.05);
    margin: 0.5em 0px 0.5em 0em;
    grid-column: 4;
  }


  .right {
    grid-column: 5;
    height: 50px; /*to match the size of the settings bar*/
  }

  .overlay-container {
    grid-area: layout;
    z-index: 1000;
    background-color: rgba(16,12,12,0.8);
    visibility: hidden;
    width: 100%;
    font-size:16px;
  }

</style>
