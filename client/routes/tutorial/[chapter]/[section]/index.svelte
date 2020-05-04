<script context="module">
	export async function preload() {
		return await fetch(`text.md`).then();
	}
</script>

<script>
  import { onMount } from 'svelte';
  import { url, params } from "@sveltech/routify";
  import marked from 'marked';
  import {
    selected
  } from '../../../../stores/tutorial.js';

  export let scoped;
  export let chapter; // we are grabbing this export variable value from Routify's file structure variable mechanism [chapter][section]
  export let section; // we are grabbing this export variable value from Routify's file structure variable mechanism [chapter][section]
  export let source; 

  console.log('chapter');
  console.log($params);
  console.log($url);
  console.log(scoped);


  // console.log(x);
  // let { selected } = scoped
  // let source = `${$params.chapter} ${$params.section} ${selected} ${scoped}  ${section} ${chapter}`;


  $: markdown = marked(section); // Reactive expression, 'markdown' reacts to 'source' changes

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