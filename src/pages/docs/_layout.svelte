
<script>
  import { url, route, isActive, goto, params, redirect} from "@roxi/routify";
  import { onMount, setContext } from 'svelte';
  import marked from 'marked';
  //import Sidebar from 'https://cdn.skypack.dev/svelte_sidebar';
  import SidebarMenu from './sidebar-menu.svelte'
  import CollapsibleSection from './CollapsibleSection.svelte'

  import { links, chosenDocs } from '../../stores/docs.js'

  //$: populateSidebarProps($links);
  let subHeadings = {};
  let allHeadings = [];
  $: fetchAllSubHeadings($links); //fetch all subheadings for all documentation
  
  $: testHeadings = getSubHeadings($links, subHeadings);

  function getSubHeadings(links, subHeadings){
    console.log("SUB HEADINGS",subHeadings);
    console.log("TEST HEADINGS", testHeadings);
    return subHeadings;
  }

  //Sidebar.svelte properties
  let props = {
    routes: [
    {
        "name": "Welcome",
        "route": "/docs/welcome"
    },
    {
        "name": "Default Language",
        "route": "/docs/default-language"
    },
    {
        "name": "Intermediate Language",
        "route": "/docs/intermediate-language"
    },
    {
        "name": "Load Sound Files",
        "route": "/docs/load-sound-files"
    },
    {
        "name": "JS Editor Utils",
        "route": "/docs/javascript-editor-utils"
    },
    {
        "name": "Maximilian",
        "route": "/docs/maximilian-dsp-api"
    }
], 
  
    open:"false",

    theme:  { "backgroundColor_linkActive": "#151515",
              "backgroundColor_nav": "#999999",
              "color_link": "#ffffff",
              "color_linkHover": "#ffffff",
              "fontSize": "1rem",
              "maxWidth_nav": "20vw",
              "minWidth_nav": "320px",
              "opacity_linkDisabled": "0.5",
              "opacity_linkInactive": 0.7 
            },  

    activeUrl: "/docs"

  //onLinkClick: () => handleClick('./intermediate-language')
  }

  async function fetchAllSubHeadings(links){
    for (let i=0;i<links.length;i++){
      fetchSubHeadings(links[i].file, links[i].path);
    }
  }

  async function fetchSubHeadings(file, path){

    //we use path as the key (ID) for consitency
    if (subHeadings.hasOwnProperty(path)){
      return; //if it already exists just break out of the function already no need to fetch again
    } else {
      subHeadings[path] = [];
    }

    let currentHeadings = [];

    

    if(file != undefined){ // There is a call with undefined value when navigating to Playground
        const res = await fetch(document.location.origin + `/docs/${file}.md`)
        const text = await res.text();
        if (res.ok) {
          //get tokens from the marked lexer
          let tokens = marked.lexer(text);

          

          //loop through them
          for (let i=0; i<tokens.length; i++){
            if (tokens[i].type == "heading" && tokens[i].depth == 1){
              let heading = tokens[i].text;

              currentHeadings.push({heading: heading , route: heading.replace(/\s+/g, '-').toLowerCase(), active:false})

              subHeadings[path].push( {name: heading, route: heading.replace(/\s+/g, '-').toLowerCase(), active:false} );
              subHeadings = subHeadings;

              

            }
          }

          for (let i=0; i<$links.length; i++){
            if ($links[i].path == path){
              $links[i].subs = currentHeadings;
              $links = $links;
            }
          }

          allHeadings.push({name:path, deets:{currentHeadings}})
          allHeadings = allHeadings;

        } else {
          throw new Error(text);
        }
      }
  }
  

  async function populateSidebarProps(links){
    console.log("populating", links);
    for (let i=0;i<links.length;i++){
      
      props.routes.push(
        {"name":links[i].name, "route": $url(links[i].path)}
      );
    }
    console.log(props)
  }

  /*
  $: match = $route.path.match(/\/docs\/([^\/]+)\//);
  $: active = match && match[1];

  let markdown;
  let doc = 'welcome'; //set to default to start with
  $: promise = fetchMarkdown(doc); //reacts to doc changes

  //console.log(document.location.origin + `/docs/`)
  //console.log($url())
  
  
  const links = [
    {path:'./welcome', name:'Welcome', file:'welcome'},
    {path:'./default-language', name:'Default Language', file:'default-livecoding-language'},
    {path:'./intermediate-language', name:'Intermediate Language', file:'sema-intermediate-language'},
    {path:'./load-sound-files', name:'Load Sound Files', file:'sample-loading'},
    {path:'./javascript-editor-utils', name:'JS Editor Utils', file:'javascript-editor-utils'},
    {path:'./maximilian-dsp-api', name:'Maximilian', file:'maximilian-dsp-api'}
  ];
  

  let fetchMarkdown = async (doc) => {
    // console.log('fetching markdown')
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
  */
  onMount( async () => {
    //promise = fetchMarkdown(doc);
    console.log("DEBUG:routes/docs/_layout:onMount");
    //populateSidebarProps();
    console.log('onMount', $chosenDocs)
    $redirect($url($chosenDocs));
    console.log("$links on mount", $links);
  });
  
  /*
  function handleClick(path){
    for (let i = 0; i < links.length; i++) {
      //console.log(links[i]['path'])

      if (links[i]['path'] == (path)){
        // console.log(links[i]['path'])
        console.log(links[i]['path'], path)
        doc = links[i]['file'];
        console.log(doc);
        //$goto(path);
      }
    }
  }
  */

  function handleDropDown(file, path){
    //fetchHeaders(file, path);
    console.log(subHeadings);
    console.log(allHeadings);
    console.log($links);
  }


</script>


<style>

  /* code {
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
    font-size: 90%;
    background-color: white;
    color: black;
    padding: 5px;
    border: 1px solid #CCCCCC;
    margin: 0px 0px 0px 0px;
  } */


  * :global(.cards) {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-evenly;
    padding: 0;
  }

  * :global(.card) {
    border-radius: 0.25rem;
    border-width: 1px;
    border: 1px solid #e2e8f0;
    margin-bottom: 3rem;
    padding: 2rem;
    background: white;
    list-style: none;
    width: 25%;
    position: relative;
    cursor: pointer;
  }

  * :global(.container) {
    position: fixed;
    left: 0;
    top: 0;
    right: 0;
    bottom: 0;
    padding-top: 5rem;
    background: rgba(0, 0, 0, 0.2);
  }

  * :global(.modal) {
    margin: auto;
    background: white;
    font-size: 5rem;
    border: 1px solid #e2e8f0;
    width: 30%;
    padding-top: 3rem;
    padding-bottom: 3rem;
    text-align: center;
  }

  .active {
    font-weight: bold;
  }

  .container-docs {
    display: grid;
  	grid-template-areas:
  		"header header"
      "sidebar settings"
  		"sidebar layout";
    grid-template-columns: 200px 1fr;
    grid-template-rows: auto 1fr;
    /* color: #999999; */
  }

  .sidebar-menu {
    display: flex;
    flex-direction: column;
    padding: 20px 20px 0px 10px;
    background-color: #999;
    border-radius: 5px;
    overflow-y: auto;
    height: calc(100vh - 86px);
    bottom:0;
  }

  .nav-links {
    color:white;
  }

  .sub-nav-links {
    color:black;
  }

  .sidebar-item {
    padding: 10px 20px 0px 10px;
  }

  h2 {
    padding: 0px 0px 0px 0px;
    color: #777777;
    text-decoration: underline;
  }
  .header-docs {
    grid-area: header;
  }

  .arrow {
    border: solid grey;
    border-width: 0 3px 3px 0;
    display: inline-block;
    padding: 3px;
  }

  .up {
    transform: rotate(-45deg);
    -webkit-transform: rotate(-45deg);
  }

  .down {
    transform: rotate(45deg);
    -webkit-transform: rotate(45deg);
  }

</style>

<svelte:head>
	<title>Sema – Documentation</title>
</svelte:head>

<div class='container-docs' data-routify="scroll-lock">

  <!--
  <div class='header-docs'>
    <h2>Reference Documentation</h2>
  </div>
  -->

  <!--<h2 class='sidebar-menu'>Reference</h2><br>-->

  
  <!--
  <ul class='sidebar-menu'>
    {#await awaitLinks}
      <p>...waiting</p>
    {:then number}
      {#each $links as {path, name, file}, i}
        <li>

          {#if name != 'Welcome'}<p style="display: inline" on:click={() => handleDropDown(path)}><i class="arrow up"></i></p>{/if}
          
          <a  class='nav-links' href={$url(path)}
              class:active={$isActive(path)}
              >
            {name}
          </a>

        </li><br>
      {/each}
    {:catch error}
      <p style="color: red">{error.message}</p>
    {/await}
  </ul>
  -->
  


  <ul class='sidebar-menu'>
    {#each $links as {path, name, file, subs}, i}
      {#if name == 'Welcome'}
        <a  class='nav-links' href={$url(path)} class:active={$isActive(path)}>{name}</a>
      {:else if name != 'Welcome'}
        <CollapsibleSection headerText={name} path={path}>
            <div class="content">
              <ul>
                {#each subs as {heading, route, active}}
                  <li>
                    <a class='sub-nav-links' href={$url(route)} 
                    class:active={$isActive(route)}>
                      {heading}
                    </a>
                </li>
                {/each}
              </ul>
            </div>
        </CollapsibleSection>
      {/if}
    {/each}
  </ul>
  

  <!--
  <ul class='sidebar-menu'>
    
      {#each $links as {path, name, file, subs}, i}
        
        <li>

          {#if name != 'Welcome'}<p style="display: inline" on:click={() => handleDropDown(file, path)}><i class="arrow up"></i></p>{/if}
          
          <a  class='nav-links' href={$url(path)}
              class:active={$isActive(path)}
              >
            {name}
          </a>
          

          {#each subs as {heading, route, active}}
            <a class='sub-nav-links' href={$url(route)} 
            class:active={$isActive(route)}>
              {heading}
            </a>
            <br>
          {/each}
          
        </li><br>

      {/each}
    
  </ul>
  -->
  
  
  <!--
  <div class="markdown-container">
    {#await promise}
      <p>...waiting</p>
    {:then number}
      <div class="markdown-output">{@html markdown}</div>
    {:catch error}
      <p style="color: red">no markdown :(</p>
    {/await}
  </div>
  -->

  <div>

    <slot>
      <!-- optional fallback -->
      <!--inject the markdown here-->
    </slot>
  </div>

</div>