<script>

  import { onMount } from 'svelte';

  import { PubSub } from "../messaging/pubSub.js";
  
  import gridHelp from "svelte-grid/build/helper";


  import Sidebar from '../components/playground/Sidebar.svelte';
  import Dashboard from '../components/layouts/Dashboard.svelte';
  
  import { 
    createNewItem,
    hydrateJSONcomponent
  } from  "../stores/common.js"
  
  import { 
    items 
  } from  "../stores/playground.js"

  const messaging = new PubSub();

	const GitHubBase = require('github-base');
	const github = new GitHubBase({ /* options */ });

  // Playground dashboard configuration
  let cols = 15;
  let breakpoints = [[1000, 10], [700, 5], [500, 3], [400, 1]];
  let rowHeight = 100;
  let gap = 1;



  const addItem = (type, id, value) => {
    let newItem = createNewItem(type, id, value);
    // $items = gridHelp.appendItem(newItem, $items, cols);

    let findOutPosition = gridHelp.findSpaceForItem(newItem, $items, cols); // find out where to place
    $items = [...$items, ...[{ ...newItem, ...findOutPosition }]];
  }


  const clearItems = () => {
    // console.log("DEBUG:dashboard:clearItems:")
    // items.update( items => items.map( item => remove(item) ) );
    $items = $items.slice($items.length);
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
  }


  onMount(() => {
    messaging.subscribe('playground-add-editor', e => addItem(e.type, e.id, e.data) );
    messaging.subscribe('playground-add-debugger', e => addItem(e.type, e.id) );
    messaging.subscribe('playground-add-analyser', e => addItem(e.type, e.id) );
		messaging.subscribe('playground-env-save', e => saveEnvironment(e) );
    messaging.subscribe('playground-env-load', e => loadEnvironment(e) );
		messaging.subscribe('playground-reset', e => clearItems() );
  });


</script>

<svelte:head>
	<title>Sema – Playground</title>
</svelte:head>

<div class="container scrollable">
  <div class="sidebar-container">
    <Sidebar />
  </div>
  <div class="dashboard-container">
    <Dashboard  {items}
                {breakpoints}
                {cols}
                {rowHeight}
                {gap}
                />
  </div>
</div>

<style>
  .container {
  	height: 100%;
  	display: grid;
  	grid-template-columns: auto 1fr;
  	grid-template-rows: 50% 50%;
  	grid-template-areas:
  		"sidebar layout"
  		"sidebar layout";
  	/* background-color: #6f7262; */
	  background-color: #212121; 
    overflow: hidden;
  }
  .sidebar-container {
    background: linear-gradient(150deg, rgba(0,18,1,1) 0%, rgba(7,5,17,1) 33%, rgba(16,12,12,1) 67%, rgb(12, 12, 12) 100%);
    /* margin-left: 10px; */
    grid-area: sidebar;
    grid-row: 0 / 1;
    height: 100%;
    width: auto; /* width is defined by child */
  }

  .dashboard-container {
    grid-area: layout;
    grid-row: 0 / 2;
    height: 100%;
    overflow: hidden;
  }

</style>