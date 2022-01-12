
<script>
  import { url, isActive } from "@roxi/routify";
  import { chosenDocs } from '../../stores/docs.js';;
  import { onMount } from 'svelte';
  //based on https://svelte.dev/repl/a5f4d395b15a44d48a6b2239ef705fc4?version=3.35.0  
  export let headerText;
  //export let path;
  export let children;
  export let expanded = false;

  //check if child is the loaded page, if so expand the container.
  function checkIfChildLoaded () {
    for (let i =0; i< children.length; i++){
      if (children[i].children){
        let grandChildren = children[i].children;
        for (let j =0; j< grandChildren.length; j++){
          
          if (grandChildren[j].path == $chosenDocs){
            expanded = true;
          }
        }
      }
      if (children[i].path == $chosenDocs){
        expanded = true;
      }
    }
  }

  onMount( async () => {
    checkIfChildLoaded();
  });

</script>

<div class="collapsible">
  
  
      <button aria-expanded={expanded} on:click={() => expanded = !expanded}>
        
        <!--
        <a  class='nav-links' href={$url(path)}
              class:active={$isActive(path)}
              >
            {headerText}
          </a>
        -->
        <h3>{headerText}</h3>

        <svg viewBox="0 0 20 20" fill="none" >
        <path class="vert" d="M10 1V19" stroke="white" stroke-width="3"/>
        <path d="M1 10L19 10" stroke="white" stroke-width="3"/>
        </svg>
      </button>
  
  
  <div class='contents' hidden={!expanded}>
      <slot></slot>
  </div>
</div>

<style>
.collapsible {
  border-bottom: 1px solid var(--gray-light, #eee);
}

h3 {
  color: #f5f6f7;
  margin: 0;
}

button {
  background-color: var(--background, #212529);
  color: var(--gray-darkest, #282828);
  display: flex;
  justify-content: space-between;
  width: 100%;
  border: 5px;
  margin: 0;
  padding: 0.5em 0.5em;
}

button:hover {
  background-color: #3a4147;
}

button[aria-expanded="true"] {
  border-bottom: 1px solid var(--gray-light, #eee);
  background-color: var(--background, #181a1d);
}

button[aria-expanded="true"] .vert {
    display: none;
}

button:focus svg{
    outline: 2px solid;
}



button [aria-expanded="true"] rect {
    fill: currentColor;
}

svg {
    height: 0.6em;
    width: 0.6em;
    justify-content: flex-end;
}

.nav-links {
  text-align: left;
  justify-content: flex-start;
  color: #f5f6f7;
}



</style>