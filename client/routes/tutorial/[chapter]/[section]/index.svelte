<script>
  import { onMount } from 'svelte';
  import { url, params } from "@sveltech/routify";
  import marked from 'marked';
  import {
    selected
  } from '../../../../stores/tutorial.js';

  export let section; // we are grabbing this export variable value from Routify's file structure variable mechanism [chapter][section]
  
  // console.log(x);
  // let { selected } = scoped

  let fetchMarkdown = async (chapter, section) => {
    // $: source = `${$params.chapter} ${$params.section} ${$url} ${section}`;
    let content = await fetch(`/tutorial/${chapter}/${section}/index.md`).then( x => console.log(x) )
    

    return content;
    // return await fetch(`/tutorial/${chapter}/${section}/index.md`).then();
  }

   fetchMarkdown($params.chapter, section); 
  // $: markdown = marked(source); // Reactive expression, 'markdown' reacts to 'source' changes

  $: source = `${$params.chapter} ${$params.section} ${$url} ${section}`;
  $: markdown = marked(source); // Reactive expression, 'markdown' reacts to 'source' changes

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
  <div class="markdown-output">{@html markdown}</div>
</div>