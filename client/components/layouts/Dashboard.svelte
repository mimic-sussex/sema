<script>
	import { onMount } from 'svelte';
  import { get } from 'svelte/store';

  import Grid from "svelte-grid";
  import gridHelp from "svelte-grid/build/helper";

  import map from "lodash.map";

  import { id, random, randomHexColorCode } from '../../utils/utils.js';

  import { PubSub } from "../../messaging/pubSub.js";

	import { copyToPasteBuffer } from '../../utils/pasteBuffer.js';


  // import { hydrateJSONcomponent } from '../../stores/common.js'


  const messaging = new PubSub();

  // Svelte-grid configuration
  export let items;
  export let cols;
  export let breakpoints;
  export let rowHeight;
  export let gap;

  const types = ['liveCodeEditor', 'modelEditor', 'grammarEditor', 'liveCodeParseOutput', 'grammarCompileOutput', 'analyser'];
  const itype = () => types[Math.floor(Math.random() * types.length)];

  const themes = ['monokai', 'cobalt', 'icecoder', 'shadowfox' ];
  const itheme = () => types[Math.floor(Math.random() * themes.length)];

  function generateLayout(col) {
    return map( new Array(5), function(item, i) {
      const x = Math.ceil(Math.random() * 3) + 2;
      const y = Math.ceil(Math.random() * 4) + 1;
      const iid = id();
      return {
        ...gridHelp.item({
          x: (i * 2) % col,
          y: Math.floor(i / 6) * y,
          w: x,
          h: y,
          id: iid,
          name: iid,
          type: itype()
        }),
        ...{ data: randomHexColorCode() },
      };
    });
  }

  const onAdjust = e => {
    // console.log("DEBUG:dashboard:onAdjust:", e.detail); 
    $items = $items; // call a re-render
  };

  const onChildMount = e => {
    // console.log("DEBUG:dashboard:onChildMount:", e.detail); 
    // $items = $items; // call a re-render
  };

	const update = (item, prop, value) => {
    if( prop !== undefined || value !== undefined ){
      // item[prop] = value;
      // $items = $items; // force an update
      $items = $items.map(i => i === item ? { ...i, [prop]: value } : i);
    }
	}



  const remove = item => {

    if(item.type === 'analyser'){
      messaging.publish('remove-engine-analyser', { id: item.id }); // notify audio engine to remove associated analyser
    }

    messaging.publish("plaground-item-deletion", item.type);

    remove.bind(null, item); // remove dashboard item binding
    delete item.component;
    $items = $items.filter( i => i.id !== item.id);
    
    console.log("DEBUG:dashboard:remove:"); 
    console.log($items); 
  }




	// onMount(() => {
  //   messaging.subscribe('add-editor', e => addItem(e.type, e.id, e.data) );
  //   messaging.subscribe('add-debugger', e => addItem(e.type, e.id) );
  //   messaging.subscribe('add-analyser', e => addItem(e.type, e.id) );
	// 	messaging.subscribe('env-save', e => saveEnvironment(e) );
	// 	messaging.subscribe('env-load', e => loadEnvironment(e) );
  // });

</script>


<div class="layout-template-container scrollable">
  <!-- Notice that were passing items as a store here ($)   -->
  <Grid items={$items}
        {breakpoints}
        {cols}
        {rowHeight}
        {gap}
        useTransform
        let:item
        on:adjust={onAdjust}
        on:mount={onChildMount}
        >

    <span class='move' >+</span>

    <div  class="content"
          style="background: { item.static ? '#bka' : item.background }"
          on:mousedown={ e => e.stopPropagation() } >

      <span class='close'
            on:click={ () => remove(item) } >✕</span>

  		<svelte:component this={item.component}
                        {...item}
                        on:change={ e => update(item, e.detail.prop, e.detail.value) } />

    </div>
  </Grid>
</div>


<style>
  /* .layout-template-container {
    height: 100vh;
  } */


  .layout-template-container {
    /* height: 100vh; */
    	height: 100%;
      width: 100%;
      /* overflow: hidden; */
  }

  .content {
    width: 100%;
    height: 100%;
    border-radius: 6px;
    border-top-left-radius: 0px;
    border-bottom-right-radius: 3px;
    background: black;

  }

  :global(*) {
    user-select: none;
  }

  :global(body) {
    overflow: scroll;
    margin: 0;
  }

  :global(.svlt-grid-resizer) {
    z-index: 1500;
  }

  :global(.svlt-grid-resizer::after) {
    border-color: white !important;
  }

  :global(.svlt-grid-transition > .svlt-grid-item) {
    transition: transform 0.2s;
  }

  :global(.svlt-grid-shadow) {
    background: pink;
    border-radius: 6px;
    border-bottom-right-radius: 3px;
    /*transition: top 0.2s, left 0.2s;*/
    transition: transform 0.2s;
  }

  .close {
    position: absolute;
    top: 0;
    right: 0;
    padding: 5px 10px;
    cursor: pointer;
    z-index: 1500;
  }

  .move {
    font-size: 1.2em;
    position: absolute;
    padding: 1px 5px;
    cursor: move;
    z-index: 1500;
    color: lightgray;
  }

 	.scrollable {
		flex: 1 1 auto;
		margin: 0 0 0.5em 0;
		overflow-y: auto;
	}

</style>