<script>
  import { url, route, isActive, goto} from "@roxi/routify";
  import { onMount } from 'svelte';
  import marked from 'marked';
  //import SidebarMenu from './sidebar-menu.svelte'

  $: match = $route.path.match(/\/docs\/([^\/]+)\//);
  $: active = match && match[1];

  let markdown;
  let doc = 'default-livecoding-language'; //set to default to start with
  $: promise = fetchMarkdown(doc); //reacts to doc changes

  //console.log(document.location.origin + `/docs/`)
  //console.log($url())

  const links = [
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
      } else {
        throw new Error(text);
      }
    }
  }

  onMount( async () => {

    promise = fetchMarkdown(doc);

  });

  function handleClick(path){
    console.log('this is getting called');
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


</script>


<style>
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
    padding: 0px 20px 0px 10px;
  }

  .sidebar-sub-menu {
    display: flex;
    flex-direction: column;
    padding: 0px 30px 0px 10px;
  }

  .sidebar-item {
    padding: 10px 20px 0px 10px;
  }

  h2 {
    padding: 10px 20px 0px 20px;
    color: #777777;
  }
  .header-docs {
    grid-area: header;
  }

</style>

<div class='container-docs' data-routify="scroll-lock">


  <div class='header-docs'>
    <h2>Reference Documentation</h2>
  </div>

  
  <ul class='sidebar-menu'>
    {#each links as {path, name, file}, i}
      <a  href={$url(path)}
          class:active={$isActive(path)}
          on:click={() => handleClick(path)}
          >
        {name}
      </a><br><br>
    {/each}
  </ul>
  
  

  <!---
  <div class="sidebar-menu">
    <a href={$url('./default-language')}
        class="sidebar-item {active === 'default-language' ? 'default-language' : ''}"
        >
      Default Language
    </a>
    <a href={$url('./intermediate-language')}
        class="sidebar-item {active === 'intermediate-language' ? 'intermediate-language' : ''}"
        >
      Intermediate Language
    </a>
    <a href={$url('./load-sound-files')}
        class="sidebar-item {active === 'load-sound-files' ? 'load-sound-files' : ''}"
        >
      Load sound files
    </a>
    <a href={$url('./editor-utils')}
        class="sidebar-item {active === 'editor-utils' ? 'editor-utils' : ''}"
        >
      Editor utils
    </a>
    <a href={$url('./maximilian-dsp-api')}
        class="sidebar-item {active === 'maximilian-dsp-api' ? 'maximilian-dsp-api' : ''}"
        >
      Load sound files
    </a>
  </div>
  -->

  <div class="markdown-container">
    {#await promise}
      <p>...waiting</p>
    {:then number}
      <div class="markdown-output">{@html markdown}</div>
    {:catch error}
      <p style="color: red">no markdown :(</p>
    {/await}
  </div>

  <div>

    <slot>
      <!-- optional fallback -->
      <!--inject the markdwon here-->
    </slot>
  </div>

</div>