<script>
  import { onMount, onDestroy, tick } from 'svelte';

  // import Dashboard from '../../components/layouts/Dashboard.svelte';
  import Markdown from "../../components/tutorial/Markdown.svelte";

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
  let cols = 15;
  let breakpoints = [[1000, 10], [700, 5], [500, 3], [400, 1]];
  let rowHeight = 100;
  let gap = 1;


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
    <div class="sidebar">

      <div class="tutorial-navigator">
        <button class="button-dark left">
          ◄
        </button>

        <div class="combobox-dark middle">
        <select
                bind:value={ $selected }
                on:blur={ e => handleSelect(e) }
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

      <!-- <Markdown /> -->
      <slot scoped={ $selected }>
      </slot>

    </div>
  </div>
  <div class="dashboard-container">
    <!-- <Dashboard  {items}
                {breakpoints}
                {cols}
                {rowHeight}
                {gap}
                /> -->
  </div>
</div>

<style>
  .container {
  	height: 100vh;
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
    /* margin-left: 10px; */
    grid-area: sidebar;
    grid-row: 0 / 1;
    height: 100vh;
    /* width: auto; width is defined by child */
    width: 26em;
    /* position: absolute; */
    margin-left: 3px;
    margin-right: 2px;
  }

  .dashboard-container {
    grid-area: layout;
    /* grid-row: 0 / 2; */
    height: 100vh;
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


  .tutorial-navigator {
    display: grid;
    grid-template-columns: 2em auto 2em;
    width: 100%;
    /* max-width: 25em; */
    margin-top: 3px;
    /* margin-bottom: 5px; */
    margin-left: 3px;
    /* margin-right: 20px; */
  }

  .left {
    grid-column: 1;
  }

  .middle {
    grid-column: 2;
  }

  .right {
    grid-column: 3;
  }

</style>
