<script>
  import { onMount, onDestroy, tick } from 'svelte';

  import Grid from "svelte-grid";
  import gridHelp from "svelte-grid/build/helper";


  // import Dashboard from '../../components/layouts/Dashboard.svelte';
  // import Markdown from "../../components/tutorial/Markdown.svelte";

  import { goto, ready, url, params } from "@sveltech/routify";

  // import { hydrateJSONcomponent } from '../../stores/common.js';
  // import { hydrateJSONcomponent } from '../../stores/playground.js';

  import {
    tutorials,
    selected,
    items,
    hydrateJSONcomponent,
    populateStoresWithFetchedProps
  } from '../../stores/tutorial.js';

  import {
    populateCommonStoresWithFetchedProps,
    updateItemPropsWithCommonStoreValues,
    resetStores
  } from "../../stores/common.js";

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

  let handleSelect = e => {

    try{

      // await tick();
      // console.log(`DEBUG:tutorial:_layout[/${$params.chapter}]/[${$params.section}]:`);
      // console.log(`DEBUG:tutorial:_layout[/${$selected.chapter_dir}]/[${$selected.section_dir}]:`);

      $goto(`/tutorial/${$selected.chapter_dir}/${$selected.section_dir}/`);
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
          setFocused(dataItem);
        }
      }
    }
    catch(error){
      console.log("DEBUG:playground:component-update", dataItem );
    }

  }


  onMount( async () => {
    // console.log("DEBUG:routes/tutorial/_layout:onMount")
  });

  onDestroy(() => {
    // console.log("DEBUG:routes/tutorial/_layout:onDestroy")
  });

</script>

<svelte:head>
	<title>Sema – Tutorial</title>
</svelte:head>

<div class="container">

  <div class="sidebar-container">

    <div class="tutorial-navigator">
      <button class="button-dark left">
        ◄
      </button>
      <div class="combobox-dark middle">
        <!-- svelte-ignore a11y-no-onchange -->
        <select
                bind:value={ $selected }
                on:change={ e => handleSelect(e) }
                >
          {#if $tutorials !== undefined}
            {#each $tutorials as chapter, i}
              <optgroup label="{i + 1}. {chapter.title}">
                {#if chapter.sections !== undefined}
                  {#each chapter.sections as section, i}
                    <!-- <option value={section}>{String.fromCharCode(i + 97)}. {section.title}</option> -->
                    <option value={section}>{section.title}</option>
                  {/each}
                {/if}
              </optgroup>
            {/each}
          {/if}
        </select>
      </div>
      <button class="button-dark right">
        ►
      </button>
    </div>

    <div class="markdown-container">
      <slot scoped={ $selected } />
    </div>
  </div>
<!--
      on:adjust={onAdjust}
      on:mount={onChildMount} -->
  <div class="dashboard-container">
    <Grid
      bind:items={$items}
      {cols}
      {rowHeight}
      {gap}

      let:item
      let:dataItem
    >
      <div  class="content"
            style="background: { item.fixed ? '#bka' : dataItem.data.background }; border: { dataItem.data.hasFocus ? '1px solid rgba(100, 100, 100, 0.5)': '1px solid rgba(25, 25, 25, 1)' }; border-width: 1px 0px 0px 1px;"
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

<style>
  .container {
  	height: 100%;
  	display: grid;
  	grid-template-columns: auto 1fr;
  	/* grid-template-rows: 100%; */
  	grid-template-areas:
  		"sidebar layout";
  		/* "sidebar layout"; */
  	/* background-color: #6f7262; */
	  background-color: #212121;
    overflow: hidden;
    /* position: absolute; */
    background: linear-gradient(150deg, rgba(0,18,1,1) 0%, rgba(7,5,17,1) 33%, rgba(16,12,12,1) 67%, rgb(12, 12, 12) 100%);
  }

  .sidebar-container {
    background: linear-gradient(150deg, rgba(0,18,1,1) 0%, rgba(7,5,17,1) 33%, rgba(16,12,12,1) 67%, rgb(12, 12, 12) 100%);
    grid-area: sidebar;
    /* grid-row: 0 / 1; */
    height: 100%;
    /* width: auto; width is defined by child */
    width: 26em;
    /* position: absolute; */
    margin-left: 3px;
    margin-right: 2px;
  }


  .tutorial-navigator {
    display: grid;
    grid-template-columns: 2em auto 2em;
    width: 100%;
    /* max-width: 25em; */
    padding-top: 3px;
    /* margin-bottom: 5px; */
    margin-left: 3px;
    /* margin-right: 20px; */
  }

  .content {
    width: 100%;
    height: 100%;
    border-radius: 0px;
    border-top-left-radius: 0px;
    border-bottom-right-radius: 0px;
    /* padding: 10px; */
    /* background: #FFF; */

  }


  .markdown-container {
    height: calc(100vh - 86px);
    margin-left: 2px;
    margin-right: 2px;
    /* margin-bottom: 2px; */
    /* border: solid 2px #aaaaaa; */
    border-radius: 5px;
    /* background: #aaaaaa; */
    overflow-y: scroll;



  }
  .dashboard-container {
    grid-area: layout;
    /* grid-row: 0 / 2; */
    height: 100%;
    /* position: absolute; */
    overflow: hidden;
  }

  .combobox-dark {
    border: 0;
  }

  .combobox-dark select {
    display: block;
    font-size: 12px;
    font-family: sans-serif;
    font-weight: 400;
    cursor: pointer;
    color: #fff;
    line-height: 1.3;
    padding: 0.7em 1em 0.7em 1em;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    margin: 0;
    /* border: 1px solid #333; */
    border: 0 solid #333;
    /*border-right-color: rgba(34,37,45, 0.4);;
    border-right-style: solid;
    border-right-width: 1px;
    border-bottom-color: rgba(34,37,45, 0.4);
    border-bottom-style: solid;
    border-bottom-width: 1px; */
    /* box-shadow: 0 1px 0 0px rgba(4, 4, 4, 0.04); */
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
    box-shadow: 2px 2px 3px rgb(0, 0, 0), -1px -1px 3px #ffffff61;
  }

  .combobox-dark select optgroup{
    color:black;
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
