
<script>
  import { url, route, isActive, goto, params, redirect} from "@roxi/routify";
  import { onMount, setContext } from 'svelte';
  import marked from 'marked';
  // import MenuContainer from './MenuContainer.svelte';
  import MenuTree from './MenuTree.svelte';
  import Search from './Search.svelte';
  import { links, chosenDocs, hashSection, subHeadingsInMenu } from '../../stores/docs.js';
  import { slide, fly, fade} from 'svelte/transition';
  
  // import docsearch from '@docsearch/js';

  //import docsearch from 'docsearch.js'
  // import docsearch from '../../../node_modules/docsearch/js';

  onMount( async () => {
    console.log("DEBUG:routes/docs/_layout:onMount");
    $redirect($url($chosenDocs+$hashSection)); //jump back to the page and section that user was last on
    console.log("hash section on mount",$hashSection);
  });

  function updateHash(hash){
    $hashSection = "#"+hash;
  }

  /*
  docsearch({
    inputSelector: '#search',
    indexName: 'docsearch',
    apiKey: '25626fae796133dc1e734c6bcaaeac3c',
  });
  */
  

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
    background-color: #262a2e;
    display: grid;
  	grid-template-areas:
  		"header header header"
      "sidebar-menu markdown-container sub-headings-menu"
  		"sidebar-menu markdown-container sub-headings-menu";
    grid-template-columns: 260px 1fr;
    grid-template-rows: auto 1fr;
    /* color: #999999; */
  }


  .sidebar-menu-container {
    grid-area: sidebar-menu;
    overflow-y: auto;
    height: calc(100vh - 46px);
    border-right: 1px solid white;
  }
  .sidebar-menu-item {
    /* grid-area: sidebar-menu; */
    display: flex;
    flex-direction: column;
    padding: 20px 2px 0px 2px;
    background-color: #262a2e;/*#999;*/
    /* border-radius: 5px; */
    /* overflow-y: auto; */
    /* height: calc(100vh - 58px); */
    bottom:0;
    margin: 0px 0px 0px 0px;
  }

  .nav-links-title {
    text-align: center;
    width: 100%;
    justify-content: center;
    color:white;
  }


  /* .sidebar-item {
    padding: 5px 5px 0px 5px;
  } */

  h2 {
    text-align: center;
    color: #777777;
    text-decoration: underline;
  }
  .header-docs {
    grid-area: header;
  }

  .sub-headings-container {
    grid-area: sub-headings-menu;
    background-color: #262a2e;
    color: white;
    width: 200px;
    border-left: 1px solid white;
    overflow-y: auto;
    height: calc(100vh - 46px);
  }

  .sub-headings-menu {
    display: flex;
    flex-direction: column;
    /* overflow-y: auto; */
  }

  .sub-nav-links {
    color:white;
    font-size: 14px;
    padding: 4px 4px 4px 4px;
    width: 80%;
    display:inline-block;
    padding: 4px 4px 4px 4px;
  }

  .sub-nav-links:hover {
    background-color: #3a4147;
    /* transition-delay:1s; */
  }

  [aria-current] {
    background-color: #181a1d;
  }

  .markdown-slot {
    grid-area: markdown-container;
  }

</style>

<svelte:head>
	<title>Sema – Documentation</title>
</svelte:head>



<div class='container-docs' data-routify="scroll-lock">
  
  <div class='sidebar-menu-container'>
    <ul class='sidebar-menu-item'>
      <!-- Commenting out search box until we have completed algolia search application -->
      <!-- <Search></Search> -->
      {#each $links as link}
        <MenuTree node={link} let:node></MenuTree>
      {/each}
    </ul>
  </div>
  
  <div class='markdown-slot'>
    <slot>
      <!-- optional fallback -->
      <!--inject the markdown here-->
    </slot>
  </div>

  <div class="sub-headings-container">
    <ul class="sub-headings-menu">
      {#each $subHeadingsInMenu as subs}
              <!--the url bit below should have a path tag eg /docs/default-language-->
              <a class='sub-nav-links' 
              href={$url('#'+subs.route)} 
              target="_self"
              class:active={$isActive(subs.route)}
              aria-current={ '#'+subs.route==$hashSection ? true : undefined} 
              on:click={() => updateHash(subs.route)} 
              in:slide> <!-- TODO should this be route?-->
                {subs.heading}
              </a>
      {/each}
    </ul>
  </div>

</div>