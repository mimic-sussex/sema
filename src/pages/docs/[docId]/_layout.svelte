<script>

  import { tick, onMount, onDestroy} from 'svelte';
  import { url, params, ready, isActive, route, afterPageLoad, beforeUrlChange, goto} from "@roxi/routify";
  import marked from 'marked';

  import hljs from 'highlight.js/lib/core';
  import javascript from 'highlight.js/lib/languages/javascript';
  hljs.registerLanguage('javascript', javascript);
  import github from "svelte-highlight/src/styles/atom-one-dark";

  import { links, chosenDocs, hashSection, subHeadingsInMenu } from '../../../stores/docs.js'
  import { slide, fly, fade} from 'svelte/transition'

  import {DOMWatcher} from '../watchDOM.js'

  $: setLastVisitedPage($params.docId);
  $: promise = fetchMarkdown($params.docId, $links); //promise is reactive to changes in url docId and links since they load asynchrynously
  let lastLoadedDoc = "";//to keep track of the last loaded page of documentation
  let domWatcher; //for storing the DOMWatcher
  let markdown;
  // sets chosenDocs in store to the current page so that its rememebered for when the user returns
  function setLastVisitedPage(){
    $chosenDocs = './'+$params.docId;
    //console.log("chosen docs:)", $chosenDocs);
  }

  //custom renderer to make headers have anchor links
  const renderer = {
    heading(text, level) {
      const escapedText = text.toLowerCase().replace(/[^\w]+/g, '-');
      if (level == 1){
        return `
                <h${level}>
                  <a name="${escapedText}" class="anchor" href="#${escapedText}" id="#${escapedText}" target="_self" style="color:#333">
                    <span class="header-link"></span>
                  #
                  </a>
                  ${text}
                </h${level}>`;
      } else {
        return ` <h${level}>${text}</h${level}>`;
      }
    }
  };

  //reopen new links in a tab
  renderer.link = function(href, title, text) {
    let link = marked.Renderer.prototype.link.apply(this, arguments);
    return link.replace("<a","<a target='_blank'");
  };


  marked.use({ renderer });  
  marked.setOptions({
    highlight: function(code, lang){
      //const language = hljs.getLanguage('javascript') ? lang : 'plaintext';
      //console.log(hljs.listLanguages());
      //console.log(language);
      //return hljs.highlight(code, {language:"javascript", ignoreIllegals:true}).value;
      return hljs.highlightAuto(code).value;
    }
  });

  let fetchMarkdown = async (docId, links) => {
    if (docId == lastLoadedDoc){ //prevent the markdown being fetched again when someone clicks an anchor
      return;
    }
    lastLoadedDoc = docId;
    //docId is the $params.id, the url slug
    let doc = findFileName(docId, links);

    // console.log('fetching markdown', doc)
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
        
        //get and set subheadings based on the markdown file.
        //for section navigation on the right of screen.
        let currentHeadings = []
        let tokens = marked.lexer(text);
            //loop through them
            for (let i=0; i<tokens.length; i++){
              if (tokens[i].type == "heading" && tokens[i].depth == 1){
                let heading = tokens[i].text;
                currentHeadings.push({heading: heading , route: heading.replace(/\s+/g, '-').toLowerCase(), active:false})
              }
            }
        $subHeadingsInMenu = currentHeadings; //populate store
      }

      } else {
        throw new Error(text);
      }

  }

  function findFileName(path, links){
    //console.log("finding file name for", path, links);
    if (links != undefined){
      for (let i = 0; i < links.length; i++) {
        if (links[i]['container'] == true){
          let children = links[i]['children'];
          for (let j = 0; j < children.length; j++){
            //check if it has children itself TODO make this recursive (but for now we limit to 3 levels so okay)
            if (children[j].container ==  true){
              let grandChildren = children[j].children;
              //findFileName(path, children[j]);
              for (let k = 0; k < grandChildren.length; k++){
                if (grandChildren[k]['path'] == './'+path){
                  return grandChildren[k]['file'];
                }
              }
            } else {
              if (children[j]['path'] == './'+path){
                return children[j]['file'];
              }

            }
          }
        }
      }
    }
  }

  //gets called when markdown-output exists
  function onMarkdownInDOM(){
    jumpToHash();
    //headings = document.querySelectorAll('h1 a[name]');
    //highlightCode();
  }

  function jumpToHash(){
    if ($hashSection){
      //console.log("jumping", $hashSection);
      let elem = document.getElementById($hashSection);
      if (elem){
        elem.scrollIntoView({behavior: 'auto'});
      }
    }
  }

  function highlightCode(){
    //console.log("highlighting code!");
    hljs.highlightAll();
  }

  onMount( async () => {
    console.log("DEBUG:routes/docs/"+$params.docId+"/_layout:onMount");
    $hashSection = location.hash; //get the hash portion of url and stick in store to jump to once markdown is loaded.
    //setupMutator();
    domWatcher = new DOMWatcher("markdown-container", "markdown-output", onMarkdownInDOM);
    domWatcher.start();
  });

  function scrollHandler(){
    if ($subHeadingsInMenu){
      $subHeadingsInMenu.forEach(ha => {
        let elem = document.getElementById("#"+ha.route)
        //if (elem.id == )
        if (elem){
          const rect = elem.getBoundingClientRect();
          if(rect.top > 0 && rect.top < 150) {
            //console.log("scrolled passed", ha.name, "hash Section", $hashSection);
            //console.log($hashSection);
            $hashSection = elem.id;
            //const location = window.location.toString().split('#')[0];
            // history.replaceState(null, null, location + '#' + ha.name);
          }
        }
      });
    }
  }

  onDestroy( async () => {
    domWatcher.stop(); //make sure dom watcher is disconected.
  });

  $afterPageLoad(page => {
    lastLoadedDoc = ""; //reset lastLoadedDocument
  });
</script>


<style>
  .markdown-container {
    height: calc(100vh - 150px); /* this fixed scrolling issue */
    padding: 10px 20px 0px 20px;
    background-color: #3a4147;
    /* background: #aaaaaa; */
    overflow-y: auto;
    /* scrollbar-color: #6969dd #e0e0e0; these scroll bar options work for firefox not for chrome TODO */
    /* scrollbar-width: thin; */
  }

</style>

<svelte:head>
    {@html github}
</svelte:head>

<!-- <button on:click={onLoad}></button> -->
<div id="markdown-container" class="markdown-container" in:slide on:scroll={scrollHandler}>
  {#if $links != []}
    {#await promise}
      <p>...</p>
    {:then number}
      <div class="markdown-output">{@html markdown}</div>
    {:catch error}
      <p style="color: red">no markdown</p>
    {/await}
  {/if}
</div>