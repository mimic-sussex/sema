
<script>
  import { url, route, isActive, goto, params, redirect} from "@roxi/routify";
  import { onMount, setContext } from 'svelte';
  import marked from 'marked';
  import CollapsibleSection from './CollapsibleSection.svelte';
  import Tree from './Tree.svelte'
  import { links, chosenDocs, hashSection, subHeadingsInMenu } from '../../stores/docs.js';
  import { slide, fly, fade} from 'svelte/transition'
  /*
  $: match = $route.path.match(/\/docs\/([^\/]+)\//);
  $: active = match && match[1];

  let markdown;
  let doc = 'welcome'; //set to default to start with
  $: promise = fetchMarkdown(doc); //reacts to doc changes

  //console.log(document.location.origin + `/docs/`)
  //console.log($url())
  */

  //$: getSubsOnReload($links); //watch for changes in $links as onMount they are empty


  onMount( async () => {
    //promise = fetchMarkdown(doc);
    // console.log("DEBUG:routes/docs/_layout:onMount");
    //console.log('onMount', $chosenDocs)
    $redirect($url($chosenDocs));
    console.log("$chosenDocs", $chosenDocs);
    
    //getSubsOnReload();
    //console.log("get element by id", document.getElementById($hashSection))
    // console.log("$links on mount", $links);
  });

  /*
  function getSubsOnReload(links){
    if ($subHeadingsInMenu != undefined){
      if ($subHeadingsInMenu.length == 0){
        
        if (links != undefined){
          if (links.length != 0){
            console.log("bleh");
            let result = getSubs($chosenDocs, links);
            console.log("results", result);
            $subHeadingsInMenu = result.subs;
          }
        }
        console.log("subheadings now", $subHeadingsInMenu);
      }
    }
  }
  /*
  function getSubs(list){
    //console.log("list", list);
    for (let i=0;i<list.length;i++){
      if (list[i].container == true){
          getSubs(list[i].children);
        } else {
          //loop through children
          children = list[i].children
          for (j=0; j<children.length; j++){
            if(children[j].file != undefined){
              if (children[j].path)
            }
          }
          if(list[i].file != undefined){
            if (list[i].path == $chosenDocs){
              return list[i].subs;
            }
          }
      }
    }
  }
  */
  /*
  function getSubs(path, links){
    console.log("links" ,links);
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
                if (grandChildren[k]['path'] == path){
                  console.log("found1", grandChildren[k]);
                  return grandChildren[k];
                }
              }
            } else {
              if (children[j]['path'] == path){
                //console.log(foundchildren[j])
                console.log("found2", children[j]);
                console.log("found3", links[i]['children'][j]);
                return children[j];
              }

            }
          }
        }
      }
    }
  }
  */

  /*
  async function getSubs(list){
    for (let i=0;i<list.length;i++){
        let currentHeadings = [];
        if (list[i].container == true){
          getSubs(list[i].children);
        } else {
          //get headings for that child
          if(list[i].file != undefined){ // There is a call with undefined value when navigating to Playground
            const res = await fetch(document.location.origin + `/docs/${list[i].file}.md`)
            const text = await res.text();
            if (res.ok) {
              //get tokens from the marked lexer
              let tokens = marked.lexer(text);
              //loop through them
              for (let i=0; i<tokens.length; i++){
                if (tokens[i].type == "heading" && tokens[i].depth == 1){
                  let heading = tokens[i].text;
                  currentHeadings.push({heading: heading , route: heading.replace(/\s+/g, '-').toLowerCase(), active:false})
                }
              }
              list[i].subs = currentHeadings;
            } else {
              throw new Error(text);
            }
          }
        }
    }
    return list
  }
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

  <!--
  <ul class='sidebar-menu'>
    {#each $links as link}
      {#if link.container == true} 
        {#each link.children as childs1}
          {#if childs1.container == true} 
            {#each childs1.children as {container, name, file, path, subs}, i}
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
            {/each}
          {:else}
            <CollapsibleSection headerText={childs1.name} path={childs1.path}>
              <div class="dropdown-content">
                <ul>
                  {#each childs1.subs as {heading, route, active}}
                    <li>
                      <a class='sub-nav-links' href={$url(childs1.path+'#'+route)} target="_self"
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
      {/if}
    {/each}
  </ul>
  -->
    <!--
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
    -->
  



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
  <div class="sub-headings-container">
    <ul class="sub-headings-menu">
      {#each $subHeadingsInMenu as subs}
              <!--the url bit below should have a path tag eg /docs/default-language-->
              <a class='sub-nav-links' href={$url('#'+subs.route)} target="_self"
              class:active={$isActive(subs.route)} in:slide> <!-- TODO should this be route?-->
                {subs.heading}
              </a>
      {/each}
    </ul>
  </div>

</div>