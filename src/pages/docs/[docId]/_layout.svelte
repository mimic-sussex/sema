<script>

  import { tick, onMount, onDestroy} from 'svelte';
  import { url, params, ready, isActive, route, afterPageLoad, beforeUrlChange, goto} from "@roxi/routify";
  import marked from 'marked';
  import hljs from 'highlight.js';

  import { links, chosenDocs, hashSection} from '../../../stores/docs.js'


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
      if (level == 1){
        return `
                <h${level}>
                  <a name="${escapedText}" class="anchor" href="#${escapedText}" id="#${escapedText}" target="_self">
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


  /*
  marked.setOptions({
    highlight: function (code, lang, _callback) {
      if (hljs.getLanguage(lang)) {
        return hljs.highlight(lang, code).value
      } else {
        return hljs.highlightAuto(code).value
      }
    },
  })
  */

  marked.use({ renderer });

  /*
  marked.setOptions({
    renderer: renderer,
    highlight: function(code, lang) {
      const hljs = hljs;
      const language = hljs.getLanguage(lang) ? lang : 'plaintext';
      return hljs.highlight(code, { language }).value;
    },
    pedantic: false,
    gfm: true,
    breaks: false,
    sanitize: false,
    smartLists: true,
    smartypants: false,
    xhtml: false
  });
  */

  //$: docId = $params.docId; //get the doc part of the url



  let fetchMarkdown = async (docId, links) => {
    // console.log("HERE last loaded doc", lastLoadedDoc);
    // console.log("HERE docId", docId);
    //console.log("hash on fetching markdown", location.hash, $hashSection, links);
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
    console.log("finding file name for", path, links);

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

    /*
        if (links[i]['container'] == true){
          
          contents = links[i]['children'];

          for (let i = 0; i < contents.length; i++){
            
            if (contents[i].container == true){
              return 'test';
            } 
            else {
              console.log("path here", path);
              if (contents[i]['path'] == ('./'+path)) {
                return contents[i]['file'];
              }
            }
          }
        } else {
          console.log("no container")
        }

      }
    } else {
      return "getting-started/about";
    }

  }
  */
          

/*
        if (links[i]['path'] == ('./'+path)){
          //console.log('here ./'+path);
          return links[i]['file'];
        }
      }
    }
  }
  */

  //$: if (docId) fetchMarkdown(docId);

  //console.log("docId:", docId);

  onMount( async () => {
    //promise = fetchMarkdown(doc);
    console.log("DEBUG:routes/docs/"+$params.docId+"/_layout:onMount");
    // console.log(location.hash);
    $hashSection = location.hash;
    //console.log("get element by id", document.getElementById(location.hash))
    //document.getElementById($hashSection).scrollIntoView({behavior: 'auto'});
    // document.querySelectorAll('a').forEach((el) => {
      // console.log("elements in DOM", el);
      // hljs.highlightElement(el);
    // });
  });


  $afterPageLoad(page => {
    //console.log('loaded ' + page.title)
    console.log(window.location.href);
    lastLoadedDoc = ""; //reset lastLoadedDocument
    // console.log("hash log on page load", $hashSection);
    
    // $goto($hashSection);
    
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
    height: calc(100vh - 48px); /* this fixed scrolling issue */
    padding: 10px 20px 0px 10px;
    /* background: #aaaaaa; */
    overflow-y: auto;
    /* scrollbar-color: #6969dd #e0e0e0; these scroll bar options work for firefox not for chrome TODO */
    /* scrollbar-width: thin; */
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