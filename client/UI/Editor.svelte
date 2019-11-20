<script context="module">
	import { onDestroy } from 'svelte';
  import CodeMirror, { set, update }  from "svelte-codemirror";
  import "codemirror/lib/codemirror.css";
  import { liveCodeEditorValue, modelEditorValue, grammarEditorValue } from "../store.js";

  const is_browser = typeof window !== "undefined";
  if (is_browser) {
    import("../utils/codeMirrorPlugins");
  }

  // export let codeMirrorValue = 'sdfg';

  let codeMirror;

  // let value = encodeURIComponent(`:b:{{1,0.25}imp}\909b;`);
  // let decodedValue = decodeURIComponent(value);
  // export let value = `:b:{{1,0.25}imp}\\909b;`;


  // let liveCode = `:b:{{1,0.25}imp}\909b; \n \\\ 
  //                 :s:{{1,0.5}imp}\909;   \\\
  //                 :c:{{{1,0.66}imp,{1,0.8}imp}add}\909closed; \\\
  //                 :o:{{0.25,0.75}imp}\909open; \\\
  //                 :tri:{30}tri;  \\\
  //                 :sin:{200}sin; \\\
  //                 :saw:{4}saw; \\\
  //                 {:tri:,:saw:,{:sin:,0.4}mul, :o:, :s:, :b:, :c:}mix`;

  // function handleChange(event) {
  //   if(event) {
  //     console.log('DEBUG:CodeMirrorChange');
  //     console.log(event);
  //   }
	// }


  const unsubscribe = liveCodeEditorValue.subscribe(value => {
    console.log("DEBUG:Editor:liveCodeEditorValue: ", value);


    // changeLayout(value.id);
  })  
	// onDestroy(unsubscribe); // Prevent memory leaks by disposing the component
</script>

<style>
  .codemirror-container {
    position: relative;
    width: 100%;
    height: 100%;
    border: none;
    line-height: 1.5;
    overflow: hidden;
  }

  .codemirror-container :global(.CodeMirror) {
    height: 100%;
    background: transparent;
    font: 400 14px/1.7 var(--font-mono);
    color: var(--base);
  }

  .codemirror-container.flex :global(.CodeMirror) {
    height: auto;
  }

  .codemirror-container.flex :global(.CodeMirror-lines) {
    padding: 0;
  }

  .codemirror-container :global(.CodeMirror-gutters) {
    padding: 0 16px 0 8px;
    border: none;
  }

  .codemirror-container :global(.error-loc) {
    position: relative;
    border-bottom: 2px solid #da106e;
  }

  .codemirror-container :global(.error-line) {
    background-color: rgba(200, 0, 0, 0.05);
  }

	.scrollable {
		flex: 1 1 auto;
		border-top: 1px solid #eee;
		margin: 0 0 0.5em 0;
		overflow-y: auto;
	}

</style>

  <!-- export let value = "";
  export let readonly = false;
  export let errorLoc = null;
  export let flex = false;
  export let lineNumbers = true;
  export let tab = true; -->

<div class="codemirror-container flex scrollable">
  <!-- <CodeMirror bind:this={codeMirror} bind:value={value} lineNumbers={false} on:message={handleMessage} on:change={handleChange}/> -->
  <CodeMirror bind:this={codeMirror}  bind:value={$grammarEditorValue} lineNumbers={true} flex={true} />
  <!-- <CodeMirror bind:this={codeMirror}  bind:value={codeMirrorValue} lineNumbers={true} /> -->
</div>
