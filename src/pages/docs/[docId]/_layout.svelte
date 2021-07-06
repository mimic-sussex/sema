<script>

  import { tick, onMount, onDestroy, getContext} from 'svelte';
  import { url, params, ready} from "@roxi/routify";
  import marked from 'marked';

  import { links, chosenDocs } from '../../../stores/docs.js'

  //const links = getContext('links');
  console.log("links inner", $links);

  //custom renderer to make headers have anchor links
  const renderer = {
    heading(text, level) {
      const escapedText = text.toLowerCase().replace(/[^\w]+/g, '-');

      return `
              <h${level}>
                <a name="${escapedText}" class="anchor" href="#${escapedText}">
                  <span class="header-link"></span>
                #
                </a>
                ${text}
              </h${level}>`;
    }
  };

  marked.use({ renderer });

  /*
  //make marked renderer make links open in a new tab
  let renderer = new marked.Renderer();
  renderer.link = function(href, title, text) {
    let link = marked.Renderer.prototype.link.apply(this, arguments);
    return link.replace("<a","<a target='_blank'");
  };

  marked.setOptions({
    renderer: renderer
  });
  */



  //move this to a seperate file
  /*
  const links = [
    {path:'./welcome', name:'Welcome', file:'welcome'},
    {path:'./default-language', name:'Default Language', file:'default-livecoding-language'},
    {path:'./intermediate-language', name:'Intermediate Language', file:'sema-intermediate-language'},
    {path:'./load-sound-files', name:'Load Sound Files', file:'sample-loading'},
    {path:'./javascript-editor-utils', name:'JS Editor Utils', file:'javascript-editor-utils'},
    {path:'./maximilian-dsp-api', name:'Maximilian', file:'maximilian-dsp-api'}
  ];
  */

  //$: docId = $params.docId; //get the doc part of the url

  $: promise = fetchMarkdown($params.docId, $links) //promise is reactive to changes in url docId

  let markdown;

  let fetchMarkdown = async (docId, links) => {
    
    //docId is the $params.id, the url slug
    let doc = findFileName(docId, links);

    console.log('fetching markdown', doc)
    if(doc != undefined){ // There is a call with undefined value when navigating to Playground
      const res = await fetch(document.location.origin + `/docs/${doc}.md`)
      const text = await res.text();
      // console.log(`DEBUG:[/${chapter}]/[${section}]:fetchMarkdown: `, text);
      // await tick();
      if (res.ok) {
        // console.log('markdown processed');
        markdown = marked(text);

        //change code elements to have a copy button
        let codeID=0;
        while(markdown.indexOf("<pre><code>")>-1) {
          markdown = markdown.replace(
            "<pre><code>",
            `<pre style="margin-top:-25px">
              <button style="font-size:70%; text-align: center; float: right; z-index: 1000; top: 30px; position: relative;" type="button" onclick="copyCode('code${codeID}')">copy</button>
              <code style="-moz-user-select: text; -html-user-select: text; -webkit-user-select: text; -ms-user-select: text; user-select: text; white-space: pre-wrap; white-space: -moz-pre-wrap; white-space: -pre-wrap; white-space: -o-pre-wrap; word-wrap: break-word;" id='code${codeID++}'>`
            );
        };

      } else {
        throw new Error(text);
      }
    }
  }
  
  function findFileName(path, links){
    if (links != undefined){
      console.log()
      for (let i = 0; i < links.length; i++) {
        if (links[i]['path'] == ('./'+path)){
          console.log('here ./'+path);
          return links[i]['file'];
        }
      }
    }
  }

  //$: if (docId) fetchMarkdown(docId);
  //console.log("params", $params)
  //console.log("docId:", docId);

  onMount( async () => {
    //promise = fetchMarkdown(doc);
    console.log("DEBUG:routes/docs/"+$params.docId+"/_layout:onMount");
  });

</script>


<style>

  .markdown-container {
    height: calc(100vh - 86px); /* this fixed scrolling issue */
    padding: 10px 20px 0px 10px;
    border-radius: 5px;
    /* background: #aaaaaa; */
    overflow-y: auto;
  }

  .markdown-output {
    /* width: 100%; */
    /*padding: 0em 0.6em 0em 0.5em;*/

  }

</style>


<div class="markdown-container">
  {#if $links != []}
    {#await promise}
      <p>...waiting</p>
    {:then number}
      <div class="markdown-output">{@html markdown}</div>
    {:catch error}
      <p style="color: red">no markdown :(</p>
    {/await}
  {/if}
</div>