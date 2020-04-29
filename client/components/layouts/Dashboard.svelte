<script>
	import { onMount } from 'svelte';
  import { get } from 'svelte/store';

  import Grid from "svelte-grid";
  import gridHelp from "svelte-grid/build/helper";

  import map from "lodash.map";

  import { id, random, randomHexColorCode } from '../../utils/utils.js';
  import { PubSub } from "../../messaging/pubSub.js";
	import { copyToPasteBuffer } from '../../utils/pasteBuffer.js';

  import {
    // items,
    createNewItem,
    hydrateJSONcomponent
  } from "../../stores/playground.js"

	const GitHubBase = require('github-base');
	const github = new GitHubBase({ /* options */ });


  export let items;

  const messaging = new PubSub();

  var cols = 15;

  let breakpoints = [[1000, 10], [700, 5], [500, 3], [400, 1]];

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
    console.log("DEBUG:dashboard:onAdjust:", e.detail); 
    $items = $items; // call a re-render
  };

  const onChildMount = e => {

    console.log("DEBUG:dashboard:onChildMount:", e.detail); 
    // $items = $items; // call a re-render
  };






	const update = (item, prop, value) => {
    if( prop !== undefined || value !== undefined ){
      // item[prop] = value;
      // $items = $items; // force an update
      $items = $items.map(i => i === item ? { ...i, [prop]: value } : i);
    }
	}

  const addItem = (type, id, value) => {
    let newItem = createNewItem(type, id, value);
    $items = gridHelp.appendItem(newItem, $items, cols);
  }

  const remove = item => {

    if(item.type === 'analyser'){
      messaging.publish('remove-engine-analyser', { id: item.id }); // notify audio engine to remove associated analyser
    }

    remove.bind(null, item); // remove dashboard item binding
    delete item.component;
    $items = $items.filter( i => i.id !== item.id);
    
    console.log("DEBUG:dashboard:remove:"); 
    console.log($items); 
  }

  const clearItems = () => {
    // console.log("DEBUG:dashboard:clearItems:")
    // items.update( items => items.map( item => remove(item) ) );
    items.update( items => items.slice(items.length) );
    // items.set([]);
  }

  const saveEnvironment = e => {
   	// console.log('DEBUG:saveEnvironment', e);
		if (e.storage=='local') {
			localStorage.setItem(`env--${e.name}`, items.get() );
		}else{
			copyToPasteBuffer(items.get());
			console.log("DEBUG:saveEnvironment: Environment copied to the paste buffer")
		}
  }

  const loadEnvironment = e => {
		// console.log('DEBUG:dashboard:loadEnvironment', e);
		
    clearItems();
    
		if (e.storage === 'local') {
			let json = localStorage.getItem(`env--${e.name}`);
			if (json) { 
        let envItems = JSON.parse(json).map( item => hydrateJSONcomponent(item) );
        items.set( envItems ); 
        items.update( items => gridHelp.resizeItems(items, 4, 100) ); // Align items
        // items.update( items => items.concat(envItems));
			}
<<<<<<< HEAD:client/components/layouts/Dashboard.svelte
		}else{
			github.get(`/gists/${e.name}`)
			.then(res => {
				// console.log("git gist", res.body.files[Object.keys(res.body.files)[0]].content)
				let envdataStr = res.body.files[Object.keys(res.body.files)[0]].content;
=======
		});
		messaging.subscribe("env-load", e => {
			console.log('env load', e);
			let envdataStr = 0;
			if (e.storage=='local') {

				envdataStr = localStorage.getItem(`env--${e.name}`);


>>>>>>> origin/multiblocks:client/UI/layouts/Dashboard.svelte
				if (envdataStr) {
					//fill in soon
				}
<<<<<<< HEAD:client/components/layouts/Dashboard.svelte
			})
			.catch(console.error);
		}
  }
=======


			}else{
				github.get(`/gists/${e.name}`)
				.then(res => {
					// console.log("git gist", res.body.files[Object.keys(res.body.files)[0]].content)
					let envdataStr = res.body.files[Object.keys(res.body.files)[0]].content;
					if (envdataStr) {
						//fill in soon
					}
				})
				.catch(console.error);
			}
		});


>>>>>>> origin/multiblocks:client/UI/layouts/Dashboard.svelte

	onMount(() => {
    messaging.subscribe('add-editor', e => addItem(e.type, e.id, e.data) );
    messaging.subscribe('add-debugger', e => addItem(e.type, e.id) );
    messaging.subscribe('add-analyser', e => addItem(e.type, e.id) );
		messaging.subscribe('env-save', e => saveEnvironment(e) );
		messaging.subscribe('env-load', e => loadEnvironment(e) );
  });

</script>


<style>
  /* .layout-template-container {
    height: 100vh;
  } */


  .layout-template-container {
    /* height: 100vh; */
    	height: 100%;
      /* overflow: hidden; */
  }

  .content {
    width: 100%;
    height: 100%;
    border-radius: 6px;
    border-top-left-radius: 0px;
    border-bottom-right-radius: 3px;

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

<div class="layout-template-container scrollable">
 <!--   -->
  <Grid items={$items}
        {breakpoints}
        {cols}
        useTransform
        rowHeight={100}
        gap={1}
        bind:items={$items}
        let:item
        on:adjust={onAdjust}
        on:mount={onChildMount}
        >

    <span class='move' >+</span>

    <div  class="content"
          style="background: { item.static ? '#ccccee' : item.background }"
          on:mousedown={ e => e.stopPropagation() } >

      <span class='close'
            on:click={ () => remove(item) } >✕</span>

  		<svelte:component this={item.component}
                        {...item}
                        on:change={ e => update(item, e.detail.prop, e.detail.value) } />

    </div>
  </Grid>
</div>
