<script>
  let expanded = false
</script>

<div class="collapsible">

  <button class='button-dark' aria-expanded={expanded} on:click={() => expanded = !expanded}>
    <slot name='icon'></slot>
  </button>
  
  {#if expanded == true}
    <div class='contents' hidden={!expanded}>
        <slot name='content'></slot>
    </div>
  {/if}
  

</div>

<style>

  .icon-container {
    /* width: 10px; */
    /* height: 10px; */
    display:flex;
    justify-content:center;
    align-items:center;
  }

  .button-dark {
    padding: 20;
    background-color: #262a2e;
    color: grey;
    border: none;
    width: 42px;
    /* height: 42px; */
    margin: 8px 8px 8px 8px;
    border-radius: 5px;
    background-color: #262a2e;
  }

  .button-dark:hover {
    /* background-color: blue; */
    color: white;
  }

  .button-dark:active{
    color: white;
    background-color: black;
  }

  .contents{
    position:absolute;
    z-index:1;
    display: inline;
    background-color:black;
  }

  .button-dark[aria-expanded="true"] {
    background-color: black;
    /* border-bottom: 1px solid var(--gray-light, #eee); */
  }

  /* button[aria-expanded="true"] {
    border-bottom: 1px solid var(--gray-light, #eee);
  } */


</style>