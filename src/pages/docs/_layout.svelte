<script>
  import { url, route } from "@roxi/routify";

  $: match = $route.path.match(/\/modal\/([^\/]+)\//);
  $: active = match && match[1];
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

  .center {
    /* text-align: center; */
  }
  .active {
    font-weight: bold;
  }

  .container {
    display: grid;
    grid-template-areas:

      "sidebar slot";
  }

  .menu {


  }


</style>

<div data-routify="scroll-lock">

  <div class="center container">

    <div class="menu">
      <a href={$url('./default-language')} class={active === 'basic' ? 'active' : ''}>
        Default Language
      </a>
      <a href={$url('./intermediate-language')} class={active === 'animated' ? 'active' : ''}>
        Intermediate Language
      </a>
      <a href={$url('./intermediate-language')} class={active === 'animated' ? 'active' : ''}>
        Intermediate Language
      </a>
    </div>

    <div>

      <slot>
        <!-- optional fallback -->
      </slot>

    </div>
  </div>

  <br />

</div>
