<script>

  import { tick, onMount, onDestroy} from 'svelte';
  import { url, params, ready, isActive, route, afterPageLoad, beforeUrlChange, goto} from "@roxi/routify";
  import marked from 'marked';
  import hljs from 'highlight.js';

  import { links, chosenDocs, hashSection, subHeadingsInMenu } from '../../../stores/docs.js'
  import { slide, fly, fade} from 'svelte/transition'

  $: setLastVisitedPage($params.docId);
  $: promise = fetchMarkdown($params.docId, $links); //promise is reactive to changes in url docId and links since they load asynchrynously
  let lastLoadedDoc = "";//$chosenDocs;
  $: setLastVisitedSection(location.hash);
  $: console.log("hash change", location.hash);

  let markdown;
  // sets chosenDocs in store to the current page so that its rememebered for when the user returns
  function setLastVisitedPage(){
    $chosenDocs = './'+$params.docId;
    //console.log("chosen docs:)", $chosenDocs);
  }

  function setLastVisitedSection(){
    console.log("hash is changing", location.hash);
    $hashSection = location.hash;
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


  let fetchMarkdown = async (docId, links) => {
    if (docId == lastLoadedDoc){
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


  onMount( async () => {
    console.log("DEBUG:routes/docs/"+$params.docId+"/_layout:onMount");
    $hashSection = location.hash; //get the hash portion of url and stick in store to jump to once markdown is loaded.
    setupMutator();
  });



  $afterPageLoad(page => {
    lastLoadedDoc = ""; //reset lastLoadedDocument
  });


  // monitors changes in markdown-container
  //waits till markdown is rendered as html then jumps to hash location
  function setupMutator() {
    // Select the node that will be observed for mutations
    const targetNode = document.getElementById('markdown-container');
    // Options for the observer (which mutations to observe)
    const config = { attributes: false, childList: true, subtree: true };

    // Callback function to execute when mutations are observed
    const callback = function(mutationsList, observer) {
        // Use traditional 'for loops' for IE 11
        for(const mutation of mutationsList) {
            if (mutation.type === 'childList') {
                if (mutation.target.className == "markdown-output" && $hashSection != ""){
                  jumpToHash();
                  endMutator(observer);
                }
            }
        }
    };

    // Create an observer instance linked to the callback function
    const observer = new MutationObserver(callback);
    // Start observing the target node for configured mutations
    observer.observe(targetNode, config);
  }

  function endMutator(observer){
    console.log("disconecting observer");
    observer.disconnect();
  }

  function jumpToHash(){
    document.getElementById($hashSection).scrollIntoView({behavior: 'smooth'});
  }

  function highlightCode(){
    // document.querySelectorAll('a').forEach((el) => {
      // console.log("elements in DOM", el);
      // hljs.highlightElement(el);
    // });
  }

</script>


<style>
  .markdown-container {
    height: calc(100vh - 48px); /* this fixed scrolling issue */
    padding: 10px 20px 0px 10px;
    background-color: #151515;
    /* background: #aaaaaa; */
    overflow-y: auto;
    /* scrollbar-color: #6969dd #e0e0e0; these scroll bar options work for firefox not for chrome TODO */
    /* scrollbar-width: thin; */
  }
  

</style>

<!-- <button on:click={onLoad}></button> -->
<div id="markdown-container" class="markdown-container" in:slide>
  {#if $links != []}
    {#await promise}
      <p>...waiting</p>
    {:then number}
      <div class="markdown-output">{@html markdown}</div>
    {:catch error}
      <p style="color: red">no markdown</p>
    {/await}
  {/if}
</div>