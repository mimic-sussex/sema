<!-- <script context="module">
	export async function preload() {
		// '/' absolute URL
		return await fetch(`/tutorial/01-basics/01-introduction/`).then(r => r.json());
	}
</script> -->


<script>
  import { tick, onMount, onDestroy } from 'svelte';
  import { url, params } from "@roxi/routify";
  import marked from 'marked';
  import {
    hydrateJSONcomponent,
    selected,
    items
  } from '../../../../stores/tutorial.js';

  import {
    updateItemPropsWithFetchedValues,
    populateCommonStoresWithFetchedProps,
    updateItemPropsWithCommonStoreValues,
    resetStores
  } from "../../../../stores/common.js";

  export let section; // we are grabbing this export variable value from Routify's file structure variable mechanism [chapter]/[section]


  let renderer = new marked.Renderer();
  renderer.link = function(href, title, text) {
    let link = marked.Renderer.prototype.link.apply(this, arguments);
    return link.replace("<a","<a target='_blank'");
  };

  marked.setOptions({
    renderer: renderer
  });



  let markdown;

  $: promise = fetchMarkdown($params.chapter, $params.section); // Reactive statement, var 'promise' reacts to 'section' changes

  let fetchMarkdown = async (chapter, section) => {

    if(chapter !== undefined &&  section !== undefined ){
      let res, text;

      try{
        res = await fetch(document.location.origin + `/tutorial/${chapter}/${section}/index.md`)
        text = await res.text();

        let json = await fetch(document.location.origin + `/tutorial/${$params.chapter}/${$params.section}/layout.json`)
                          .then( r => r.json());

        $items = json.map( item => hydrateJSONcomponent(item) );

        for (const item of $items){
          await updateItemPropsWithFetchedValues(item);
          await populateCommonStoresWithFetchedProps(item);
          updateItemPropsWithCommonStoreValues(item)
        }
      }
      catch(error){
        console.error("Error loading tutorial environment", error);
      }

      // await tick();
      if (res.ok) {
        let tag = 'script';
        markdown = marked(text);
        // console.log(markdown);
        let codeID=0;
        while(markdown.indexOf("<pre><code>")>-1) {
          markdown = markdown.replace(
            "<pre><code>",
            `<pre style="margin-top:-25px">
              <button style="font-size:70%; text-align: center; float: right; z-index: 1000; top: 30px; position: relative;" type="button" onclick="copyCode('code${codeID}')">copy</button>
              <code style="-moz-user-select: text; -html-user-select: text; -webkit-user-select: text; -ms-user-select: text; user-select: text; white-space: pre-wrap; white-space: -moz-pre-wrap; white-space: -pre-wrap; white-space: -o-pre-wrap; word-wrap: break-word;" id='code${codeID++}'>`
            );

          // markdown = markdown.replace(
          //   "<pre><code>",
          //   `<pre><code style="-moz-user-select: text; -khtml-user-select: text; -webkit-user-select: text; -ms-user-select: text; user-select: text; white-space: pre-wrap; white-space: -moz-pre-wrap; white-space: -pre-wrap; white-space: -o-pre-wrap; word-wrap: break-word;" id='code${codeID++}'>`
          // );

        };
              // markdown="test";
      } else {
        console.error("Error on markdown conversion", error);;
      }
    }
  }

  let log = () => {}

  onMount( async () => {
    for (const item of $items)
      await populateCommonStoresWithFetchedProps(item)

    log(section);
    console.log(`DEBUG:tutorial/${$params.chapter}/${$params.section}/ index`);
    // promise = fetchMarkdown($selected.chapter_dir, $selected.section_dir); // Reactive statement, var 'promise' reacts to 'section' changes
  });

  onDestroy(() => {
    $items = [];
    resetStores();
    // console.log("DEBUG:routes/tutorial/_layout:onDestroy")
  });


</script>

<style global>

  code {
    border-radius: 4px;
    font-size: 100%;
    background-color: white;
    color: black;
    padding: 2px 4px 2px 4px;
    border: 1px solid #CCCCCC;

  }

  pre code {
    display: block;
    border-radius: 4px;
    font-size: 110%;
    background-color: white;
    color: black;
    padding: 5px;
    border: 1px solid #CCCCCC;
    margin: 0px 0px 0px 0px;
  }

  .markdown-container {
    overflow: auto;
    margin-left: 1px;
    /* margin-right: 2px;
    margin-bottom: 2px; */
    /* border: solid 5px #aaaaaa; */
    border-radius: 5px;
    /* height: 85vh; */
    background: #aaaaaa;
		-webkit-user-select: all;  /* Chrome 49+ */
	  -moz-user-select: all;     /* Firefox 43+ */
	  -ms-user-select: all;      /* No support yet */
	  user-select: all;          /* Likely future */
  }

  .markdown-output {
    /* width: 100%; */
    padding: 0em 0.9em 0em 0.9em;
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
