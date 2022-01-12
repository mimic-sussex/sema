
<script>
  import { url, isActive } from "@roxi/routify";
  import { subHeadingsInMenu, hashSection } from '../../stores/docs.js';
  //based on https://svelte.dev/repl/a5f4d395b15a44d48a6b2239ef705fc4?version=3.35.0  
  export let headerText;
  export let path;
  export let expanded = false

</script>

<div class="menu-item">
  
      <a class='nav-links' href={$url(path)} class:active={$isActive($url(path))} aria-current="{ $isActive(path)? 'page' : undefined}">{headerText}</a>
      
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
  background-color: #3a4147;
}


[aria-current] {
  background-color: #181a1d;
  font-weight: bold;
  /* transition-delay:0.1s; */
}

</style>