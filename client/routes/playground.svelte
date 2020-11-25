<script>

  import { onMount, onDestroy } from 'svelte';

  import { PubSub } from "../messaging/pubSub.js";

  import gridHelp from "svelte-grid/build/helper";

  import compile from '../compiler/compiler';

  import Sidebar from '../components/playground/Sidebar.svelte';
  import Dashboard from '../components/layouts/Dashboard.svelte';

  import {
    fetchFrom
  } from "../utils/utils.js"

  import {
    createNewItem,
    // setFocused,
    clearFocused,
    hydrateJSONcomponent,
    focusedItem,
    focusedItemProperties,
    items
  } from  "../stores/playground.js"

  import {
    updateItemPropsWithFetchedValues,
    populateCommonStoresWithFetchedProps,
    updateItemPropsWithCommonStoreValues,
    resetStores
  } from  "../stores/common.js"

  const messaging = new PubSub();

	const GitHubBase = require('github-base');
	const github = new GitHubBase({ /* options */ });

  // Playground dashboard configuration
  let cols = 12;
  let breakpoints = [
    // [2880, 5]
    // [1287, 3],
    // [700, 1],
  ];
  let rowHeight = 100;
  let gap = 1;

  // Subscription tokens for messaging topic subscriptions
  // must be kept for unsubscribe on each route component onMount/onDestroy
  // (or navigations between tutorial/playground)
  let addSubscriptionToken;
  let envSaveSubscriptionToken;
  let envLoadSubscriptionToken;
  let resetSubscriptionToken;

  let unsubscribeItemsChangeCallback;

  // const unsubscribePlaygroundItemsCallback = items.subscribe(value => {
  //   console.log('Playground items changed');
  //   // await populateStoresWithFetchedProps(newItem);
  // });


  const setFocused = item => {

    if(item){
      try {
        let itemProperties = [];
        if( item.type === "liveCodeEditor" || item.type === "grammarEditor" || item.type === 'modelEditor' ){
          itemProperties = [ { lineNumbers: item.lineNumbers}, { theme: item.theme } ];

          // Order in item properties determines final order in interface
          // if( item.type === "liveCodeEditor" || item.type === "grammarEditor" ){
          //   itemProperties.push({ debug: true });
          // }

          if( item.type === "liveCodeEditor" ){
            itemProperties.push({ grammar: item.grammar });
          }

          if( item.type === "modelEditor" ){
            itemProperties.push({ restart: true });
          }
        }
        else if(item.type === 'analyser'){
          itemProperties.push( { mode: item.mode } )
        }

        item.hasFocus = true;
        $focusedItem = item;
        $focusedItemProperties = itemProperties;
        // set unfocused items through the rest of the list
        $items = $items.map(i => i === item ? ({ ...i, ['hasFocus']: true }) : ({ ...i, ['hasFocus']: false }) );
        // $items = $items.map(i => i === item ? { ...i, [e.detail.prop]: e.detail.value } : i)
        //set focused item

      }
      catch(error){
        console.error("Error Playground.setFocused: setting item focuses" );
      };
    }
    else
      console.error("Error Playground.setFocused: setting item focuses: empty item" );
  }


  const addItem = async (type, value) => {

    if(type !== undefined){
      try {
        let newItem = await createNewItem(type, value);

        await updateItemPropsWithFetchedValues(newItem);

        await populateCommonStoresWithFetchedProps(newItem);

        updateItemPropsWithCommonStoreValues(newItem)

        setFocused(newItem);

        let findOutPosition = gridHelp.findSpace(newItem, $items, cols); // find out where to place
        $items =  [...$items, ...[{ ...newItem, ...findOutPosition }]]; // Append to playground Items stores

      }
      catch (error){
        console.error("Error on routes/Playground.addItem", error);
      }
    }
    else
      console.error("Error on routes/Playground.addItem: undefined parameter")
  }

	const update = e => {

    if( e.detail.item && e.detail.prop ){
      try{
        if( e.detail.prop === 'data' ){
          switch (e.detail.item.type) {
            case "liveCodeEditor":
              localStorage.liveCodeEditorValue = e.detail.value;
              break;
            case "grammarEditor":
              localStorage.grammarEditorValue = e.detail.value;
              break;
            case "modelEditor":
              localStorage.modelEditorValue = e.detail.value;
              break;
            default:
              break;
          }

          $items = $items.map(i => i === e.detail.item ? { ...i, [e.detail.prop]: e.detail.value } : i);
        }
        else {
          setFocused(e.detail.item);
        }

        // if( e.detail.item.type === 'analyser' && e.detail.prop === 'hasFocus' && e.detail.value ){
        //   setFocused(e.detail.item);
        //   // $items = $items;
        // }
        // else{
          // Filter out item, update it and refresh items's list
          // item[prop] = value;
          // $items = $items; // force an update

        // }
      }
      catch(error){
        console.error("Error on routes/Playground.update: updating Playground items", error);
      }
    }
	}



  const clearItems = () => {
    // console.log("DEBUG:dashboard:clearItems:")
    // items.update( items => items.map( item => remove(item) ) );
    $items = $items.slice($items.length);

    clearFocused();
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
		// console.log('DEBUG:playground:loadEnvironment', e);

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


  onMount( async () => {
    // console.log("DEBUG:routes/playground:onMount")

    // Sequentially fetch data from individual items' properties into language design workflow stores
    for (const item of $items)
      await updateItemPropsWithFetchedValues(item);

    for (const item of $items)
      await populateCommonStoresWithFetchedProps(item);

    for (const item of $items)
      updateItemPropsWithCommonStoreValues(item);

    addSubscriptionToken = messaging.subscribe('playground-add', e => addItem(e.type, e.data) );
		envSaveSubscriptionToken = messaging.subscribe('playground-env-save', e => saveEnvironment(e) );
    envLoadSubscriptionToken = messaging.subscribe('playground-env-load', e => loadEnvironment(e) );
		resetSubscriptionToken = messaging.subscribe('playground-reset', e => clearItems() );
    unsubscribeItemsChangeCallback = items.subscribe(value => {
      //console.log('Playground items changed: ', value );
    });
  });

  onDestroy(() => {
    // console.log("DEBUG:routes/playground:onDestroy")
    messaging.unsubscribe(addSubscriptionToken);
    messaging.unsubscribe(envSaveSubscriptionToken);
    messaging.unsubscribe(envLoadSubscriptionToken);
    messaging.unsubscribe(resetSubscriptionToken);

    unsubscribeItemsChangeCallback();

    resetStores();
  });

</script>

<svelte:head>
	<title>Sema – Playground</title>
</svelte:head>

<div class="container">
  <div class="sidebar-container">
    <Sidebar />
  </div>
  <div class="dashboard-container scrollable">
    <Dashboard  {items}
                {breakpoints}
                {cols}
                {rowHeight}
                {gap}
                on:update={ e => update(e) }
                />
  </div>
</div>

<style>
  .container {
    height: 100%;
    width: 100%;
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
    height: 100vh;
    width: 100%;
    overflow: hidden;

  }

</style>
