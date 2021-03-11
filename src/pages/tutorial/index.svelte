<script context="module">
  export async function preload() {
		// '/' absolute URL
		return await fetch(document.location.origin + `/tutorial/01-basics/01-introduction/`).then(r => r.json());
	}
</script>

<script>
  import { tick, onMount } from 'svelte';
  import { url, params } from '@roxi/routify';
  import marked from 'marked';
  import {
    tutorials,
    selected
  } from '../../stores/tutorial.js';

  // export let section; // we are grabbing this export variable value from Routify's file structure variable mechanism [chapter]/[section]

  let markdown;

  let fetchMarkdown = async (chapter, section) => {

    if(chapter != undefined && section != undefined){ // There is a call with undefined value when navigating to Playground
      const res = await fetch(document.location.origin + `/tutorial/${chapter}/${section}/index.md`)
      const text = await res.text();
      // console.log(`DEBUG:[/${chapter}]/[${section}]:fetchMarkdown: `, text);

      // await tick();
      if (res.ok) {
        markdown = marked(text);
      } else {
        throw new Error(text);
      }
    }
  }

  let promise;

  onMount( async () => {
    console.log(`DEBUG:tutorial:index`);
    promise = fetchMarkdown($selected.chapter_dir, $selected.section_dir); // Reactive statement, var 'promise' reacts to 'section' changes
  });
</script>

<style global>

  .markdown-index-container {
    overflow: auto;
    margin-left: 10px;
    margin-right: 10px;
    margin-bottom: 10px;
    border: solid 5px #aaaaaa;
    border-radius: 5px;
    /* height: 85vh; */
    background: #aaaaaa;
  }

  .markdown-output {
    /* width: 100%; */
    padding: 0 0.2em;

  }

</style>

<div class="markdown-index-container">
{#await promise}
	<p>...waiting</p>
{:then number}
  <div class="markdown-output">{@html markdown}</div>
{:catch error}
	<p style="color: red">{error.message}</p>
{/await}
</div>