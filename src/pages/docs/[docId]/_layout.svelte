<script>

  import { tick, onMount, onDestroy} from 'svelte';
  import { url, params, ready, isActive, route, afterPageLoad} from "@roxi/routify";
  import marked from 'marked';

  import { links, chosenDocs } from '../../../stores/docs.js'


  $: setLastVisitedPage($params.docId);
  $: promise = fetchMarkdown($params.docId, $links); //promise is reactive to changes in url docId and links since they load asynchrynously
  let lastLoadedDoc = "";//$chosenDocs;
  /*
  $: promise.then(value => {
      jumpToHash();
    }, reason => {
      console.log("no hash sad");
    }).catch(e => {
      console.log(e);
    });
  */

    ;
  //$: jumpToHash(promise);

  function jumpToHash(){
    let regex = /(?<=\#).*/g;
    let section = window.location.href.match(regex);

    window.onload = (event) => {
      //console.log("window LOADED");
      document.getElementById(location.hash).scrollIntoView({behavior: 'auto'});
    }

    //console.log(document.getElementById(window.location.hash));
    //if (window.location.hash != null){
    //  document.getElementById(window.location.hash).scrollIntoView({behavior: 'auto'});
    //}
  }



  let markdown;
  // sets chosenDocs in store to the current page so that its rememebered for when the user returns
  function setLastVisitedPage(){
    $chosenDocs = './'+$params.docId;
    //console.log("chosen docs:)", $chosenDocs);
  }

  //const links = getContext('links');
  //console.log("links inner", $links);

  //custom renderer to make headers have anchor links
  const renderer = {
    heading(text, level) {
      const escapedText = text.toLowerCase().replace(/[^\w]+/g, '-');

      return `
              <h${level}>
                <a name="${escapedText}" class="anchor" href="#${escapedText}" id="#${escapedText}" target="_self">
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

  //$: docId = $params.docId; //get the doc part of the url



  let fetchMarkdown = async (docId, links) => {
    // console.log("HERE last loaded doc", lastLoadedDoc);
    // console.log("HERE docId", docId);
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

      }

      } else {
        throw new Error(text);
      }

  }

  function findFileName(path, links){
    if (links != undefined){
      for (let i = 0; i < links.length; i++) {
        if (links[i]['path'] == ('./'+path)){
          //console.log('here ./'+path);
          return links[i]['file'];
        }
      }
    }
  }

  //$: if (docId) fetchMarkdown(docId);

  //console.log("docId:", docId);

  onMount( async () => {
    //promise = fetchMarkdown(doc);
    console.log("DEBUG:routes/docs/"+$params.docId+"/_layout:onMount");

  });


  $afterPageLoad(page => {
    console.log('loaded ' + page.title)
    lastLoadedDoc = ""; //reset lastLoadedDocument
    /*
    console.log("HERE location.hash before if", location.hash);
    if (location.hash != null || location.hash == ""){
      console.log("HERE location.hash on page load", location.hash);
      document.getElementById(location.hash).scrollIntoView({behavior: 'auto'});
    }
    */
  })


</script>


<style>
  .markdown-container {
    height: calc(100vh - 86px); /* this fixed scrolling issue */
    padding: 10px 20px 0px 10px;
    /* background: #aaaaaa; */
    overflow-y: auto;
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