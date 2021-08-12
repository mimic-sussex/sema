<script>

  import { onMount } from "svelte";

  const docSearchJSVersion = "2.6.3";
  const docSearchInputSelector = "search-doc-input";

  let docSearchScriptLoaded = false;
  // let docSearchScript: HTMLScriptElement;
  let docSearchScript;
  let docSearchInput;

  const processDocSearchScriptLoadEvent = () => {
    docSearchScriptLoaded = true;
  };

  $: if (docSearchInput && (docSearchScript || docSearchScriptLoaded)) {
    window.docsearch &&
      window.docsearch({
        apiKey: "25626fae796133dc1e734c6bcaaeac3c",
        indexName: "docsearch",
        inputSelector: `#${docSearchInputSelector}`,
        // Set debug to true to inspect the dropdown
        debug: false,
      });
  }

</script>


<style>
    .docsearch {
    display: flex;
    flex-direction: column;
  }
</style>

<svelte:head>
  <link
    rel="stylesheet"
    href="https://cdn.jsdelivr.net/npm/docsearch.js@{docSearchJSVersion}/dist/cdn/docsearch.min.css"
  />
  <script
    on:load={processDocSearchScriptLoadEvent}
    bind:this={docSearchScript}
    src="https://cdn.jsdelivr.net/npm/docsearch.js@{docSearchJSVersion}/dist/cdn/docsearch.min.js"></script>
</svelte:head>

<input bind:this={docSearchInput} type=text class='docsearch' id='search-doc-input' placeholder="Search">