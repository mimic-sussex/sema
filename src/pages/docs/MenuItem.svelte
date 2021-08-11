
<script>
  import { url, isActive } from "@roxi/routify";
  import { subHeadingsInMenu, hashSection } from '../../stores/docs.js';
  //based on https://svelte.dev/repl/a5f4d395b15a44d48a6b2239ef705fc4?version=3.35.0  
  export let headerText;
  export let path;
  export let subs;

  export let expanded = false

  function handleClick(){
    //expanded = !expanded;
    //$subHeadingsInMenu = subs.subs;
    //console.log("path on click", path, $isActive($url(path)), $url(path), $url())
    //console.log("handleclick for hash collapse being called", subs);
  }

</script>

<div class="menu-item">


      <a class='nav-links' href={$url(path)} class:active={$isActive($url(path))} on:click={handleClick} aria-current="{ $isActive(path)? 'page' : undefined}">{headerText}</a>
      <!--
      <button aria-expanded={expanded} on:click={() => handleClick()}>
        
        <li><a  class='nav-links' href={$url(path)}
              class:active={$isActive(path)}
              >
            {headerText}
          </a>
        </li>
        
        <!--
        <svg viewBox="0 0 20 20" fill="none" >
        <path class="vert" d="M10 1V19" stroke="black" stroke-width="2"/>
        <path d="M1 10L19 10" stroke="black" stroke-width="2"/>
        </svg>
        
      </button>
      -->
  
  
  <div class='contents' hidden={!expanded}>
      <slot></slot>
  </div>
</div>

<style>
  
.menu-item {
  /* border-bottom: 1px solid var(--gray-light, #eee); */
}

a.button {
  -webkit-appearance: button;
  -moz-appearance: button;
  appearance: button;

  text-decoration: none;
  color: initial;
}

.nav-links {
  -webkit-appearance: button;
  -moz-appearance: button;
  appearance: button;

  text-decoration: none;
  color: initial;
  text-align: left;
  justify-content: flex-start;
  color:white;
  width: 100%;
  display:inline-block;
  padding: 4px 4px 4px 4px;
}

.nav-links:hover {
  background-color: #333;
}


[aria-current] {
  background-color: #333;
}

</style>