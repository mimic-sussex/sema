<script>
  import { tick, onMount } from 'svelte';
  import { url, params } from "@sveltech/routify";
  import marked from 'marked';
  import {
    selected
  } from '../../../../stores/tutorial.js';

  export let section; // we are grabbing this export variable value from Routify's file structure variable mechanism [chapter][section]
  
  let markdown;

  let fetchMarkdown = async (chapter, section) => {
  
    const res = await fetch(`/tutorial/${chapter}/${section}/index.md`)
		const text = await res.text();
    // console.log(text);

    await tick();    
  	if (res.ok) {
			markdown = marked(text);
		} else {
			throw new Error(text);
		} 
  }

  $: promise = fetchMarkdown($params.chapter, section); // Reactive statement, var 'promise' reacts to 'section' changes

  // $: source = `${$params.chapter} ${section}`;
  // $: markdown = source; // Reactive expression, 'markdown' reacts to 'source' changes

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