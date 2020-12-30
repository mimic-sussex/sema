
<style>
  .container {
    height: 100%;
    width: 100%;
    display: grid;
    grid-template-columns: auto 1fr;
    /* grid-template-rows: 50% 50%; */
       /* "sidebar layout" */
    grid-template-areas:
      "sidebar layout";
  	/* background-color: #6f7262; */
    background-color: #212121;
    /* overflow: hidden; */
  }
  .sidebar-container {
    background: linear-gradient(150deg, rgba(0,18,1,1) 0%, rgba(7,5,17,1) 33%, rgba(16,12,12,1) 67%, rgb(12, 12, 12) 100%);
    grid-area: sidebar;
    height: 100%;
    width: auto; /* width is defined by child */
  }

  .dashboard-container {
    grid-area: layout;

    /* height: 100%; */
    width: 100%;
    /* height: 100vh;
    width: 100%;
    overflow: hidden; */

    /* grid-row: 0 / 2; */
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

  :global(.svlt-grid-container) {
    /* Container color */

    height: auto !important;
    /* overflow-y: visible;
    /* background: #eee; */
  }

  :global(.svlt-grid-transition > .svlt-grid-item) {
    transition: transform 0.2s;
  }

  :global(.svlt-grid-shadow) {
    background: pink;
    border-radius: 6px;
    border-bottom-right-radius: 3px;
    transition: transform 0.2s;
  }

  .close {
    position: absolute;
    top: 0;
    right: 0;
    padding: 5px 10px;
    cursor: pointer;
    z-index: 1500;
    text-shadow: 1px 1px 1px #000000;
  }

  .move {
    text-shadow: 1px 1px 1px #000000;
    font-size: 1.2em;
    position: absolute;
    padding: 1px 5px;
    cursor: move;
    z-index: 1500;
    color: lightgray;
  }


  .content {
    width: 100%;
    height: 100%;
    border-radius: 0px;
    border-top-left-radius: 0px;
    border-bottom-right-radius: 0px;
    /* padding: 10px; */
    /* background: #FFF; */

  }

 	.scrollable {
		flex: 1 1 auto;
		margin: 0 0 0.5em 0;
		overflow-y: auto;
	}

</style>


<svelte:head>
	<title>Sema – Playground</title>
</svelte:head>

<div class="container">
  <div class="sidebar-container">
    <Sidebar />
  </div>
  <!-- {breakpoints}
  on:update={ e => update(e) }
   -->
  <div class="dashboard-container scrollable">
    <Grid
      bind:items={$items}
      {cols}
      {rowHeight}
      {gap}
      fastStart={$fastStart}
      on:adjust={onAdjust}
      on:mount={onChildMount}
      let:item
      let:dataItem
      >
        <span class='move'>+</span>

        <div  class="content"
              style="background: { item.fixed ? '#bka' : dataItem.data.background }; border: { dataItem.data.hasFocus ? '1px solid rgba(100, 100, 100, 0.5)': '1px solid rgba(25, 25, 25, 1)' }; border-width: 1px 0px 0px 1px;"
              on:pointerdown={ e => e.stopPropagation() }
              >

          <span class='close'
                on:click={ () => remove(dataItem) }
                >✕
          </span>

          <svelte:component class='component'
                            this={ dataItem.data.component }
                            { ...dataItem.data }
                            on:change={ e => update(e, dataItem) }
                            />
      </div>
    </Grid>

  </div>
</div>




<script>

  import { onMount, onDestroy } from 'svelte';

  import { PubSub } from "../messaging/pubSub.js";


  import compile from '../compiler/compiler';

  import Sidebar from '../components/playground/Sidebar.svelte';
  // import Dashboard from '../components/layouts/Dashboard.svelte';

  import Grid from "svelte-grid";
  import gridHelp from "svelte-grid/build/helper";

  import {
    fetchFrom

  } from "../utils/utils.js"

  import { addToHistory } from "../utils/history.js";

  import {

    // loadEnvironmentOptions
    fastStart,
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
import { stringify } from 'querystring';

  // import { removeUnderscoredDirs } from '@sveltech/routify/lib/middleware/misc';

  const messaging = new PubSub();

	const GitHubBase = require('github-base');
	const github = new GitHubBase({ /* options */ });

  // Playground dashboard configuration
  // let cols = 12;
  // let breakpoints
  let cols = [
    // [2880, 13]
    [1600, 8],
    [1440, 12],
    [1280, 3],
    // [1024, 2],
    // [800, 1],
    // [500, 1]
  ];
  let rowHeight = 100;
  let gap = [2, 2];

  // Subscription tokens for messaging topic subscriptions
  // must be kept for unsubscribe on each route component onMount/onDestroy
  // (or navigations between tutorial/playground)
  let addSubscriptionToken;
  let storeEnvironmentSubscriptionToken;
  let loadEnvironmentSubscriptionToken;
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
        if( item.data.type === "liveCodeEditor" || item.data.type === "grammarEditor" || item.data.type === 'modelEditor' ){
          itemProperties = [ { lineNumbers: item.data.lineNumbers}, { theme: item.data.theme } ];

          // Order in item properties determines final order in interface
          // if( item.type === "liveCodeEditor" || item.type === "grammarEditor" ){
          //   itemProperties.push({ debug: true });
          // }

          if( item.data.type === "liveCodeEditor" ){
            itemProperties.push({ grammar: item.data.grammar });
          }

          if( item.data.type === "modelEditor" ){
            itemProperties.push({ restart: true });
            itemProperties.push({ visor: true });
          }
        }
        else if(item.data.type === 'analyser'){
          itemProperties.push( { mode: item.data.mode } )
        }

        item.data.hasFocus = true;
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


  async function addItem(e){

    let COLS = 12;

    if(e.type !== undefined){
      try {
        let newItem = await createNewItem(e.type, e.data);
        console.log("DEBUG:playground:addItem:", newItem);

        await updateItemPropsWithFetchedValues(newItem);

        await populateCommonStoresWithFetchedProps(newItem);

        updateItemPropsWithCommonStoreValues(newItem)

        setFocused(newItem);

        let findOutPosition = gridHelp.findSpace(newItem, $items, COLS);

        newItem = {
          ...newItem,
          [COLS]: {
            ...newItem[COLS],
            ...findOutPosition,
          },
        };

        // Add to store
        $items = [...$items, ...[newItem]]
      }
      catch (error){
        console.error("Error on routes/Playground.addItem", error);
      }
    }
    else
      console.error("Error on routes/Playground.addItem: undefined parameter")
  }


  const update = (e, dataItem) => {

    try{

      if(e !== undefined && e.detail !== undefined && dataItem !== undefined){
        if(e.detail.prop === "content"){
          switch (dataItem.data.type) {
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

          // Content update from CodeMirror update with 'content' prop and value
          dataItem.data[e.detail.prop] = e.detail.value;
          // Update item and items collection by filtering out version with old value and concating update version
          $items = [...$items.filter(i => i !== dataItem), ...[dataItem]]
        }
        else if(e.detail.prop === "hasFocus"){
          setFocused(dataItem);
        }
      }
    }
    catch(error){
      console.log("DEBUG:playground:component-update", dataItem );
    }

  }



	// const update = e => {

  //   if( e.detail.item && e.detail.prop ){
  //   }


    // if( e.data && e.data.type ){
    //   try{

    //       switch (e.data.type) {
    //         case "liveCodeEditor":
    //           localStorage.liveCodeEditorValue = e.data.content;
    //           break;
    //         case "grammarEditor":
    //           localStorage.grammarEditorValue = e.data.content;
    //           break;
    //         case "modelEditor":
    //           localStorage.modelEditorValue = e.data.content;
    //           break;
    //         default:
    //           break;
    //       }
    //     }

    //   }
    //     else {
    //       setFocused(e);
    //     }

    //   catch(error){
    //     console.error("Error on routes/Playground.update: updating Playground items", error);
    //   }
    // }
  // }

    // if( e.detail.item && e.detail.prop ){
    //   try{
    //     if( e.detail.prop === 'data' ){
    //       switch (e.detail.item.type) {
    //         case "liveCodeEditor":
    //           localStorage.liveCodeEditorValue = e.detail.value;
    //           break;
    //         case "grammarEditor":
    //           localStorage.grammarEditorValue = e.detail.value;
    //           break;
    //         case "modelEditor":
    //           localStorage.modelEditorValue = e.detail.value;
    //           break;
    //         default:
    //           break;
    //       }

    //       $items = $items.map(i => i === e.detail.item ? { ...i, [e.detail.prop]: e.detail.value } : i);
    //     }
    //     else {
    //       setFocused(e.detail.item);
    //     }

        // if( e.detail.item.type === 'analyser' && e.detail.prop === 'hasFocus' && e.detail.value ){
        //   setFocused(e.detail.item);
        //   // $items = $items;
        // }
        // else{
          // Filter out item, update it and refresh items's list
          // item[prop] = value;
          // $items = $items; // force an update

        // }
  //     }
  //     catch(error){
  //       console.error("Error on routes/Playground.update: updating Playground items", error);
  //     }
  //   }
	// }



  const clearItems = () => {
    // console.log("DEBUG:dashboard:clearItems:")
    // items.update( items => items.map( item => remove(item) ) );


    clearFocused();
    // items.set([]);
  }


  const remove = item => {

    if(item.type === 'analyser'){
      messaging.publish('remove-engine-analyser', { id: item.id }); // notify audio engine to remove associated analyser
    }
    // console.log("DEBUG:dashboard:remove:", item);
    messaging.publish("plaground-item-deletion", item.type);

    remove.bind(null, item); // remove dashboard item binding
    delete item.component;
    $items = $items.filter( i => i.id !== item.id);

    // console.log("DEBUG:dashboard:remove:");
    // console.log($items);
  }

  const onAdjust = e => {
    // console.log("DEBUG:dashboard:onAdjust:", e.detail);
    $items = $items; // call a re-render
  };

  const onChildMount = e => {
    // console.log("DEBUG:dashboard:onChildMount:", e.detail);
    $items = $items; // call a re-render
  };



  onMount( async () => {
    // console.log("DEBUG:routes/playground:onMount")

    // Sequentially fetch data from individual items' properties into language design workflow stores
    for (const item of $items)
      await updateItemPropsWithFetchedValues(item);

    for (const item of $items)
      await populateCommonStoresWithFetchedProps(item);

    for (const item of $items)
      updateItemPropsWithCommonStoreValues(item);

    addSubscriptionToken = messaging.subscribe('playground-add', e => addItem(e) );
		// storeEnvironmentSubscriptionToken = messaging.subscribe('playground-store-environment', e => storeEnvironment(e) );
    // loadEnvironmentSubscriptionToken = messaging.subscribe('playground-load-environment', e => loadEnvironment(e) );
		// // resetSubscriptionToken = messaging.subscribe('playground-reset', e => clearItems() );

    unsubscribeItemsChangeCallback = items.subscribe(value => {
      //console.log('Playground items changed: ', value );
    });
  });

  onDestroy(() => {
    // console.log("DEBUG:routes/playground:onDestroy")
    messaging.unsubscribe(addSubscriptionToken);
    // messaging.unsubscribe(storeEnvironmentSubscriptionToken);
    // messaging.unsubscribe(loadEnvironmentSubscriptionToken);
    messaging.unsubscribe(resetSubscriptionToken);

    unsubscribeItemsChangeCallback();

    resetStores();
  });

</script>