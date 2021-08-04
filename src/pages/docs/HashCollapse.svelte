
<script>
  import { url, isActive } from "@roxi/routify";

  //based on https://svelte.dev/repl/a5f4d395b15a44d48a6b2239ef705fc4?version=3.35.0  
  export let headerText;
  export let path;

  let expanded = false
</script>

<div class="hash-collapsible">
  
  
      <button aria-expanded={expanded} on:click={() => expanded = !expanded}>
        
        <a  class='nav-links' href={$url(path)}
              class:active={$isActive(path)}
              >
            {headerText}
          </a>
        
        <svg viewBox="0 0 20 20" fill="none" >
        <path class="vert" d="M10 1V19" stroke="black" stroke-width="2"/>
        <path d="M1 10L19 10" stroke="black" stroke-width="2"/>
        </svg>
      </button>
  
  
  <div class='contents' hidden={!expanded}>
      <slot></slot>
  </div>
</div>

<style>
.hash-collapsible {
  border-bottom: 1px solid var(--gray-light, #eee);
}

h3 {
  margin: 0;
}

button {
  background-color: var(--background, #949090);
  color: var(--gray-darkest, #282828);
  display: flex;
  justify-content: space-between;
  width: 100%;
  border: 5px;
  margin: 0;
  padding: 0.5em 0.5em;
}

button[aria-expanded="true"] {
  border-bottom: 1px solid var(--gray-light, #eee);
  background-color: var(--background, #5b5757);
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
  color:white;
}

</style>