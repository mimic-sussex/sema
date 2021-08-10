
<script>
  import { url, route, isActive, goto, params, redirect} from "@roxi/routify";
  import { onMount, setContext } from 'svelte';
  import marked from 'marked';
  import CollapsibleSection from './CollapsibleSection.svelte';
  import Tree from './Tree.svelte'
  import { links, chosenDocs, hashSection, subHeadingsInMenu } from '../../stores/docs.js';
  import { slide, fly, fade} from 'svelte/transition'

  onMount( async () => {
    console.log("DEBUG:routes/docs/_layout:onMount");
    $redirect($url($chosenDocs+$hashSection)); //jump back to the page and section that user was last on
  });

  function updateHash(hash){
    $hashSection = "#"+hash;
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
    background-color: #212121;
    display: grid;
  	grid-template-areas:
  		"header header header"
      "sidebar-menu markdown-container sub-headings-menu"
  		"sidebar-menu markdown-container sub-headings-menu";
    grid-template-columns: 260px 1fr;
    grid-template-rows: auto 1fr;
    /* color: #999999; */
  }

  .sidebar-menu {
    display: flex;
    flex-direction: column;
    padding: 20px 2px 0px 2px;
    background-color: #212121;/*#999;*/
    /* border-radius: 5px; */
    border-right: 1px solid white;
    overflow-y: auto;
    height: calc(100vh - 58px);
    bottom:0;
    margin: 0px 0px 0px 0px;
  }

  .nav-links-title {
    text-align: center;
    width: 100%;
    justify-content: center;
    color:white;
  }


  .sidebar-item {
    padding: 5px 5px 0px 5px;
  }

  h2 {
    text-align: center;
    color: #777777;
    text-decoration: underline;
  }
  .header-docs {
    grid-area: header;
  }

  .sub-headings-container {
    background-color: #212121;
    color: white;
    width: 200px;
    height: calc(100vh - 58px);
    border-left: 1px solid white;
  }

  .sub-headings-menu {
    display: flex;
    flex-direction: column;
    overflow-y: auto;
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
    background-color: #333;
  }

  [aria-current] {
    background-color: #333;
  }


</style>

<svelte:head>
	<title>Sema – Documentation</title>
</svelte:head>

<div class='container-docs' data-routify="scroll-lock">
  
  <ul class='sidebar-menu'>
    {#each $links as link}
      <Tree node={link} let:node></Tree>
    {/each}
  </ul>
  
  <div>
    <slot>
      <!-- optional fallback -->
      <!--inject the markdown here-->
    </slot>
  </div>
  <div class="sub-headings-container">
    <ul class="sub-headings-menu">
      {#each $subHeadingsInMenu as subs}
              <!--the url bit below should have a path tag eg /docs/default-language-->
              <a class='sub-nav-links' href={$url('#'+subs.route)} target="_self"
              class:active={$isActive(subs.route)} on:click={() => updateHash(subs.route)} in:slide> <!-- TODO should this be route?-->
                {subs.heading}
              </a>
      {/each}
    </ul>
  </div>

</div>