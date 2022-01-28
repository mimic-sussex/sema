<script>
  import MenuContainer from './MenuContainer.svelte';
  import MenuItem from './MenuItem.svelte';
  import { url, isActive } from "@roxi/routify";
  export let node;
  let children = node.children;
</script>

<style>
  ul {
    --indent: 10px;
    padding: 0 0 0 var(--indent);
    margin: 0 0 0 var(--indent);
    list-style: none;
    /* border-left: 1px solid #eee; */
  }
  li {
    padding: 0;
  }

  a {
    color: white;
  }
</style>

<slot node={node}></slot>

{#if children}
<MenuContainer headerText={node.title} children={node.children}>
<ul>
    {#each children as childNode}
    <li>
      <svelte:self let:node={childNodeInner} bind:node={childNode}>
          <slot node={childNodeInner}></slot>
      </svelte:self>
    </li>
    {/each}
</ul>
</MenuContainer>
{:else}

  <MenuItem headerText={node.title} path={node.path}>
    
  </MenuItem>
  <!--
  <li>
    <a  class='nav-links-title' href={$url(node.path)} class:active={$isActive(node.path)}>{node.title}</a>
  </li>
  -->
{/if}