<script>
  import CollapsibleSection from './CollapsibleSection.svelte';
  import HashCollapse from './HashCollapse.svelte';
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
    border-left: 1px solid #eee;
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
<CollapsibleSection headerText={node.title} path="undefined">
<ul>
    {#each children as childNode}
    <li>
      <svelte:self let:node={childNodeInner} bind:node={childNode}>
          <slot node={childNodeInner}></slot>
      </svelte:self>
    </li>
    {/each}
</ul>
</CollapsibleSection>
{:else}

  <HashCollapse headerText={node.title} path={node.path}>
    <div class="dropdown-content">
      <ul>
        {#each node.subs as {heading, route, active}}
          <li>
            <a class='sub-nav-links' href={$url(node.path+'#'+route)} target="_self"
            class:active={$isActive(route)}> <!-- TODO should this be route?-->
              {heading}
            </a>
          </li>
        {/each}
      </ul>
    </div>
  </HashCollapse>
  <!--
  <li>
    <a  class='nav-links-title' href={$url(node.path)} class:active={$isActive(node.path)}>{node.title}</a>
  </li>
  -->
{/if}