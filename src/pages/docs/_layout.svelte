
<script>
  import { url, route, isActive, goto, params, redirect} from "@roxi/routify";
  import { onMount, setContext } from 'svelte';
  import marked from 'marked';
  import CollapsibleSection from './CollapsibleSection.svelte';

  import { links, chosenDocs } from '../../stores/docs.js';

  /*
  $: match = $route.path.match(/\/docs\/([^\/]+)\//);
  $: active = match && match[1];

  let markdown;
  let doc = 'welcome'; //set to default to start with
  $: promise = fetchMarkdown(doc); //reacts to doc changes

  //console.log(document.location.origin + `/docs/`)
  //console.log($url())
  */

  
  onMount( async () => {
    //promise = fetchMarkdown(doc);
    console.log("DEBUG:routes/docs/_layout:onMount");
    //console.log('onMount', $chosenDocs)
    $redirect($url($chosenDocs));
    console.log("$links on mount", $links);
  });


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
    grid-template-columns: 260px 1fr;
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

  .nav-links-title {
    text-align: center;
    width: 100%;
    justify-content: center;
    color:white;
  }

  .sub-nav-links {
    color:black;
    font-size: 14px;
  }

  .sidebar-item {
    padding: 10px 20px 0px 10px;
  }

  h2 {
    text-align: center;
    color: #777777;
    text-decoration: underline;
  }
  .header-docs {
    grid-area: header;
  }


</style>

<svelte:head>
	<title>Sema – Documentation</title>
</svelte:head>

<div class='container-docs' data-routify="scroll-lock">

  
  <ul class='sidebar-menu'>
    {#each $links as {path, name, file, subs}, i}
      {#if name == 'Welcome'}
        <h2>
        <a  class='nav-links-title' href={$url(path)} class:active={$isActive(path)}>{name}</a>
        </h2>
        <br>
      {:else if name != 'Welcome'}
        <CollapsibleSection headerText={name} path={path}>
            <div class="dropdown-content">
              <ul>
                {#each subs as {heading, route, active}}
                  <li>
                    <a class='sub-nav-links' href={$url(path+'#'+route)} target="_self" 
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