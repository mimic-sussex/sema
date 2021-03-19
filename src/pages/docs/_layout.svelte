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

  .active {
    font-weight: bold;
  }

  .container-docs {
    display: grid;
  	grid-template-areas:
  		"sidebar settings"
  		"sidebar layout";
    grid-template-columns: 200px 1fr;
    grid-template-rows: auto 1fr;

  }

  .sidebar-item {
    padding: 10px 10px 0px 10px;
  }

  .menu {
    display: flex;
    flex-direction: column;
  }

</style>

<div data-routify="scroll-lock">

  <h2>reference documentation</h2>
  <div class="container-docs">

    <div class="menu">

      <a href={$url('./default-language')}
          class="sidebar-item {active === 'default-language' ? 'default-language' : ''}"
          >
        Default Language
      </a>

      <a href={$url('./intermediate-language')}
          class="sidebar-item {active === 'intermediate-language' ? 'intermediate-language' : ''}"
          >
        Intermediate Language
      </a>

      <a href={$url('./load-sound-files')}
          class="sidebar-item {active === 'load-sound-files' ? 'load-sound-files' : ''}"
          >
        Load sound files
      </a>

      <a href={$url('./editor-utils')}
          class="sidebar-item {active === 'editor-utils' ? 'editor-utils' : ''}"
          >
        Editor utils
      </a>

      <a href={$url('./maximilian-dsp-api')}
          class="sidebar-item {active === 'maximilian-dsp-api' ? 'maximilian-dsp-api' : ''}"
          >
        Load sound files
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
