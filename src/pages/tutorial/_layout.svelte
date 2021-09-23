<script>
  import { onMount, onDestroy, tick } from 'svelte';

  import Grid from "svelte-grid";
  import gridHelp from "svelte-grid/build/helper";

  import Settings from '../../components/settings/Settings.svelte';
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
    populateStoresWithFetchedProps

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
		if($tutorials.indexOf($selectedChapter) === 0){ // if 1st chapter
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
    $goto(`/tutorial/${$selectedSection.chapter_dir}/${$selectedSection.section_dir}/`);
	}

	const setPreviousTutorial = e => {
		if($tutorials.indexOf($selectedChapter) === 0){ // if 1st chapter
			// if last section of 1st chapter
			if($selectedChapter.sections.indexOf($selectedSection) === 0 ){
				$selectedChapter = $tutorials[$tutorials.length - 1];
				$selectedSection = $selectedChapter.sections[$selectedChapter.sections.length - 1];
			}
			else // if intermediate section, skip to 1st chapters' next section
				$selectedSection = $selectedChapter.sections[$selectedChapter.sections.indexOf($selectedSection) - 1];
		}
		else { // of last chapter
			if(0 === $selectedChapter.sections.indexOf($selectedSection)){  // if last section of last chapter
				$selectedChapter = $tutorials[$tutorials.indexOf($selectedChapter) - 1];
				$selectedSection = $selectedChapter.sections[$selectedChapter.sections.length - 1];
			}
			else
				// if intermediate section, skip to last chapters' next section
				$selectedSection = $selectedChapter.sections[$selectedChapter.sections.indexOf($selectedSection) - 1];
		}
    $goto(`/tutorial/${$selectedSection.chapter_dir}/${$selectedSection.section_dir}/`);

	}

	const handleButtonClick = e => {
		try {
      // await tick();
      $items = []; // refresh items to call onDestroy on each (learner need to terminate workers)
			e? setNextTutorial(): setPreviousTutorial();
			localStorage.setItem("last-session-tutorial-url", `/tutorial/${$selectedSection.chapter_dir}/${$selectedSection.section_dir}/`);
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
      console.warn("samples loaded");
      controller.init(document.location.origin + '/build/');
      $goto(localStorage.getItem("last-session-tutorial-url"));
    }
    console.log(localStorage.getItem("last-session-tutorial-url"));
    if($items.length === 0 && localStorage["last-session-tutorial-url"]){
      let sessionTutorialURL = document.location.origin + localStorage.getItem("last-session-tutorial-url") + 'layout.json'
      let json = await fetch(sessionTutorialURL)
                            .then( r => r.json());

      $items = json.map( item => hydrateJSONcomponent(item) );
    }

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

  <div class="tutorial-sidebar-container"
    bind:this={ container }
    >

    <div class="tutorial-navigator">

      <button class="button-dark left"
							on:click={ e => handleButtonClick(0) }
							>
        ◄
      </button>

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
                    <!-- <option value={section}>{String.fromCharCode(i + 97)}. {section.title}</option> -->
                    <option value={section} >{i + 1}. {section.title}</option>
                  {/each}
                {/if}
              </optgroup>
            {/each}
          {/if}
        </select>
      </div>

      <button class="button-dark right"
							on:click={ e => handleButtonClick(1) }
							>
        ►
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
          style="background: rgba(25, 25, 25, 0.6);"
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
  		"sidebar settings"
  		"sidebar layout";
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
    padding: 0.2em 0.1em 0.1em 0.1em;
    z-index: 1500;
  }

  .item-header-type {
    grid-column: 2/2;
    /* padding-top: 0.2em; */

  }

  .content {
    grid-row: 2/2;
    grid-column: 1/3;
    width: 100%;
    height: 100%;
    border-radius: 0px;
    border-top-left-radius: 0px;
    border-bottom-right-radius: 0px;
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

  .combobox-dark {
    border: 0;
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
    width: 100%;
    height: 2.5em;
    display: block;
    font-size: medium;
    /* font-size: 12px; */
    font-family: sans-serif;
    font-weight: 400;
    cursor: pointer;
    color: #fff;
    line-height: 1.3;
    padding: 0.7em 1em 0.7em 1em;
    max-width: 100%;
    box-sizing: border-box;
    /* margin: 0; */
    border: 0 solid #333;
    border-radius: .6em;
    -moz-appearance: none;
    -webkit-appearance: none;
    appearance: none;
    background-color: rgba(16, 16, 16, 0.04);
    background-repeat: no-repeat, repeat;
    background-position: right .7em top 50%, 0 0;
    background-size: .65em auto, 100%;
    -webkit-box-shadow: 5px 5px 20px -5px rgba(0,0,0,0.75), -5px -5px 20px rgba(255, 255, 255, 0.954);
    -moz-box-shadow: 5px 5px 20px -5px rgba(0,0,0,0.75), -5px -5px 20px rgba(255, 255, 255, 0.954);
    box-shadow: -1px -1px 3px #ffffff61, 2px 2px 3px rgb(0, 0, 0) ;
  }

  .combobox-dark select optgroup{
    color:black;
  }

  .button-dark {
    width: 2.5em;
    height: 2.5em;
    padding: 0.7em 1em 0.7em 1em;
    display: block;
    /* font-size: 12px; */
    font-size: medium;
    font-family: sans-serif;
    font-weight: 400;
    cursor: pointer;
    color: #fff;
    line-height: 1.3;
    max-width: 100%;
    box-sizing: border-box;
    border: 0 solid #333;
    border-radius: .6em;
    -moz-appearance: none;
    -webkit-appearance: none;
    appearance: none;
    background-color:  rgba(16, 16, 16, 0.04);
    background-repeat: no-repeat, repeat;
    background-position: right .7em top 50%, 0 0;
    background-size: .65em auto, 100%;
    -webkit-box-shadow: 2px 2px 5px rgba(0,0,0),-1px -1px 1px rgb(34, 34, 34);
    -moz-box-shadow: 2px 2px 5px rgba(0,0,0), -1px -1px 1px rgb(34, 34, 34);;
    box-shadow: 2px 2px 3px rgb(0, 0, 0), -1px -1px 3px #ffffff61;
  }





  .left {
    grid-column: 1;
  }

  .middle {
    margin-left: 4px;
    margin-right: 4px;
    grid-column: 2;
  }

  .right {
    grid-column: 3;
  }

</style>
