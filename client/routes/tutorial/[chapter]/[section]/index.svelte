<!-- <script context="module">
	export async function preload() {
		// '/' absolute URL
		return await fetch(`/tutorial/01-basics/01-introduction/`).then(r => r.json());
	}
</script> -->


<script>
  import { tick, onMount, onDestroy } from 'svelte';
  import { url, params } from "@sveltech/routify";
  import marked from 'marked';
  import {
    hydrateJSONcomponent,
    selected,
    items
  } from '../../../../stores/tutorial.js';

  import {
    populateCommonStoresWithFetchedProps,
    updateItemPropsWithCommonStoreValues,
    resetStores
  } from "../../../../stores/common.js";

  // export let section; // we are grabbing this export variable value from Routify's file structure variable mechanism [chapter]/[section]

  let markdown;

  $: promise = fetchMarkdown($params.chapter, $params.section); // Reactive statement, var 'promise' reacts to 'section' changes

  let fetchMarkdown = async (chapter, section) => {

    let res, text;

    try{
      res = await fetch(`/tutorial/${chapter}/${section}/index.md`)
      text = await res.text();

      let json = await fetch(`/tutorial/${$params.chapter}/${$params.section}/layout.json`)
                        .then( r => r.json());
        
      $items = json.map( item => hydrateJSONcomponent(item) ); 

      for (const item of $items){ 
        await populateCommonStoresWithFetchedProps(item);
        updateItemPropsWithCommonStoreValues(item)   
      }
    }
    catch(error){
      console.error("Error loading tutorial environment", error);
    }
  
    // await tick();    
    if (res.ok) {
      markdown = marked(text);
    } else {
      console.error("Error on markdown conversion", error);;
    } 
  }

  onMount( async () => {
    for (const item of $items) 
      await populateCommonStoresWithFetchedProps(item)

    console.log(`DEBUG:tutorial/${$params.chapter}/${$params.section}/ index`);
    // promise = fetchMarkdown($selected.chapter_dir, $selected.section_dir); // Reactive statement, var 'promise' reacts to 'section' changes
  });  

  onDestroy(() => {
    resetStores();
    // console.log("DEBUG:routes/tutorial/_layout:onDestroy")
  });


</script>

<style>

  .markdown-container {
    overflow: auto;
    margin-left: 10px;
    margin-right: 10px;
    margin-bottom: 10px;
    border: solid 5px #aaaaaa;
    border-radius: 5px;
    height: 85vh;
    background: #aaaaaa;
  }

  .markdown-output {
    /* width: 100%; */
    padding: 0 1em;
  }

</style>

<div class="markdown-container">
{#await promise}
	<p>...waiting</p>
{:then number}
  <div class="markdown-output">{@html markdown}</div>
{:catch error}
	<p style="color: red">{error.message}</p>
{/await}


</div>