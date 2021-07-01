
<script>
  import { url, route, isActive, goto, params} from "@roxi/routify";
  import { onMount, setContext } from 'svelte';
  import marked from 'marked';
  import Sidebar from 'https://cdn.skypack.dev/svelte_sidebar';
  //import SidebarMenu from './sidebar-menu.svelte'

  //get links from json file in dist
  let awaitLinks = getLinks();
  let links = {};

  async function getLinks() {
    console.log("get links is being called")
    const res = await fetch(document.location.origin + `/docs/docsnew.json`);
    links = await res.json()
    if (res.ok){
      console.log('this stage', links);
      //setContext('links', links);
    }
    console.log(links)
    //$ready()
  }
  //make accesible
  setContext('links', [
    {path:'./welcome', name:'Welcome', file:'welcome'},
    {path:'./default-language', name:'Default Language', file:'default-livecoding-language'},
    {path:'./intermediate-language', name:'Intermediate Language', file:'sema-intermediate-language'},
    {path:'./load-sound-files', name:'Load Sound Files', file:'sample-loading'},
    {path:'./javascript-editor-utils', name:'JS Editor Utils', file:'javascript-editor-utils'},
    {path:'./maximilian-dsp-api', name:'Maximilian', file:'maximilian-dsp-api'}
  ])

  //Sidebar.svelte properties
  const props = {
    routes: [
    {"name":"Welcome", "route": $url('./welcome')},
    { "name": "Default Language", "route": $url('./default-language') ,"childRoutes":[
      {"name": "Audio Outputs", "route": $url('#audio-outputs')}
    ]},
    { "name": "Intermediate Language", "route": $url('./intermediate-language') ,"childRoutes":[
      {"name": "Audio Outputs", "route": $url('#audio-outputs')}
    ]},
    {"name": "Load Sound Files", "route": $url('./load-sound-files')},
    {"name":"JS Editor Utils", "route":$url('./javascript-editor-utils')},
    {"name":"Maximilian", "route":$url('./maximilian-dsp-api')}
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

  onMount( async () => {

    promise = fetchMarkdown(doc);

  });
  

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

  let dropDownSections = [
    {
			path: './default-language',
			title: "Section 1",
			content: "This is some test content",
			active: false,
		}
  ]


  function handleDropDown(path){
    if (dropDownSections[0].path === path){
      dropDownSections[0] = true;
    }
  }


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
    font-size: 90%;
    background-color: white;
    color: black;
    padding: 5px;
    border: 1px solid #CCCCCC;
    margin: 0px 0px 0px 0px;
  }


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
    overflow: scroll;
  }

  .nav-links {
    color:white
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

  .markdown-container {
    padding: 10px 20px 0px 10px;
    overflow: auto;
  }

  .arrow {
    border: solid black;
    border-width: 0 3px 3px 0;
    display: inline-block;
    padding: 3px;
  }

  .up {
    transform: rotate(-135deg);
    -webkit-transform: rotate(-135deg);
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
  <Sidebar {...props} />
  -->


  
  <ul class='sidebar-menu'>
    {#await awaitLinks}
      <p>...waiting</p>
    {:then number}
      {#each links as {path, name, file}, i}
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