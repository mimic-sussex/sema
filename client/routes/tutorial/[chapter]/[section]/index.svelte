<script context="module">
	export async function preload() {
		// '/' absolute URL
		return await fetch(`/tutorial/01-basics/01-introduction/`).then(r => r.json());
	}
</script>


<script>
  import { tick, onMount } from 'svelte';
  import { url, params } from "@sveltech/routify";
  import marked from 'marked';
  import {
    selected
  } from '../../../../stores/tutorial.js';

  // export let section; // we are grabbing this export variable value from Routify's file structure variable mechanism [chapter]/[section]

  let markdown;

  $: promise = fetchMarkdown($selected.chapter_dir, $selected.section_dir); // Reactive statement, var 'promise' reacts to 'section' changes


  let fetchMarkdown = async (chapter, section) => {
    
    let res, text;
    
    // if(chapter != undefined && section != undefined){ // There is a call with undefined value when navigating to Playground
      res = await fetch(`/tutorial/${chapter}/${section}/index.md`)
      text = await res.text();
    // }
    // else
    // {
    //   res = await fetch(`/tutorial/01-basics/01-introduction/index.md`)
    //   text = await res.text();
    // }

    // console.log(`DEBUG:tutorial/${$params.chapter}/${$params.chapter}/ index`);
    // console.log($selected)
    console.log(`DEBUG:/[${chapter}]/[${section}]:fetchMarkdown: `);

    // await tick();    
    if (res.ok) {
      markdown = marked(text);
    } else {
      throw new Error(text);
    }    
  }

  

  // $: source = `${$params.chapter} ${section}`;
  // $: markdown = source; // Reactive expression, 'markdown' reacts to 'source' changes


  onMount( async () => {

    // console.log(`DEBUG:tutorial/${$params.chapter}/${$params.chapter}/ index`);
    // console.log($selected)
    // promise = fetchMarkdown($selected.chapter_dir, $selected.section_dir); // Reactive statement, var 'promise' reacts to 'section' changes

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