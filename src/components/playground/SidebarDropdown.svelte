<script>
  let expanded = false
  let disabled = false;
</script>

<div class="collapsible">

  <button class='button-dark'
   aria-expanded={expanded} 
   on:click={() => expanded = !expanded}
   disabled={disabled}>
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
    color: #999;
    border: none;
    /* width: 42px; */
    /* height: 42px; */
    margin: 8px 8px 8px 8px;
    border-radius: 5px;
  }

  .button-dark:hover {
    /* background-color: blue; */
    color: white;
  }

  .button-dark:active{
    color: white;
    background-color: #363b40;
  }

  .contents{
    position:absolute;
    z-index:1;
    display: inline;
    background-color: #212529;
    border-radius: 0px 5px 5px 0px;
  }

  .button-dark[aria-expanded="true"] {
    background-color: #363b40;
    color:white;
    /* border-bottom: 1px solid var(--gray-light, #eee); */
  }

  /* button[aria-expanded="true"] {
    border-bottom: 1px solid var(--gray-light, #eee);
  } */


</style>