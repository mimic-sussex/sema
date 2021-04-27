<script>
	import { authStore } from '../../auth'
	import { redirect } from '@roxi/routify'
	const { user } = authStore

  import {
    onMount,
    onDestroy
  } from 'svelte';

  import { PubSub } from "../../utils/pubSub.js";


  import { compile } from 'sema-engine/sema-engine';

  import Sidebar from '../../components/playground/Sidebar.svelte';
  import Settings from '../../components/settings/Settings.svelte';
  // import Dashboard from '../components/layouts/Dashboard.svelte';

  import Grid from "svelte-grid";
  import gridHelp from "svelte-grid/build/helper";
  let grid,
      fillFree = true;

  let messaging = new PubSub()

  import {

    // loadEnvironmentOptions
    fastStart,
    createNewItem,
    // setFocused,
    clearFocused,
    hydrateJSONcomponent,
    focusedItem,
    focusedItemProperties,
    isUploadOverlayVisible,
    items
  } from  "../../stores/playground.js"

  import {
    updateItemPropsWithFetchedValues,
    populateCommonStoresWithFetchedProps,
    updateItemPropsWithCommonStoreValues,
    resetStores,
    siteMode,
    sideBarVisible
  } from  "../../stores/common.js"

  import {
    Engine
  } from 'sema-engine/sema-engine'

  import Controller from "../../engine/controller";
  let controller = new Controller(); // this will return the previously created Singleton instance

  let engine;

  // const messaging = new PubSub();

  let overlayContainer;

  // Playground dashboard configuration
  let cols = [
    [2880, 12],
    [1600, 12],
    [1280, 8], // over this rez is failling
    [1024, 6],
    [800, 3],
    [500, 2]
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
        else if(item.data.type === 'visualiser'){
          itemProperties.push( { channelID: item.data.channelID } )
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

  function setLayoutResponsiveness(item){

    if(item && items && cols){
      try{
        return {
          ...item,
          ...cols.reduce(
            (acc, obj) => {
              let col = obj[1]; // for each col config, get number of cols
              let findOutPosition = gridHelp.findSpace(item, $items, col);
              if (!acc[col]) {
                acc[col] = {
                  ...item[col],
                  ...findOutPosition,
                };
              }
              return acc
            }, {})
        }
      }
      catch(err){
        console.error("Error setting layout responsiveness when adding new item");
      }
    }
    else throw new Error("Error setting layout responsiveness when adding new item")
  }

  async function addItem(e){

    if(e.type){
      try {
        let item = await createNewItem(e.type, e.data);

        await updateItemPropsWithFetchedValues(item);

        await populateCommonStoresWithFetchedProps(item);

        updateItemPropsWithCommonStoreValues(item)

        setFocused(item);

        const newItem = setLayoutResponsiveness(item);

        $items = [ ...$items, ...[newItem] ]
        // console.log("DEBUG:playground:addItem:", newItem);
      }
      catch (error){
        console.error("Error on routes/Playground.addItem", error);
      }
    }
    else
      console.error("Error on routes/Playground.addItem: undefined parameters")
  }

  const update = (e, dataItem) => {

    try{
      if(e && e.detail && dataItem ){
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
      console.log(`Erro updating component: ${dataItem}`, error);
    }

  }

  function handleDragDrop(e) {

    e.preventDefault();

    let reader = new FileReader();
    reader.readAsText(e.dataTransfer.files[0]);
    reader.onload = e => $items = JSON.parse(e.target.result).map(item => hydrateJSONcomponent(item));

    $isUploadOverlayVisible = false;
  }

  function handleDragEnter(e){  }

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
    // messaging.publish("plaground-item-deletion", item.type);

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

  let container;

  onMount( async () => {

    // No need to create re-initialise controller again here
    if(!controller.samplesLoaded)
      // controller.init('http://localhost:5000/sema-engine');
      controller.init(document.location.origin +'/sema-engine');
    // Debug dimensions of grid as we resize the window
    // let resizeObs = new ResizeObserver(e => console.log( e[0].contentRect.width ) ).observe(container);

    // Sequentially fetch data from individual items' properties into language design workflow stores
    for (const item of $items)
      await updateItemPropsWithFetchedValues(item);

    for (const item of $items)
      await populateCommonStoresWithFetchedProps(item);

    for (const item of $items)
      updateItemPropsWithCommonStoreValues(item);

    addSubscriptionToken = messaging.subscribe('playground-add', e => addItem(e) );
    unsubscribeItemsChangeCallback = items.subscribe(value => {
      //console.log('Playground items changed: ', value );
    });
  });

  onDestroy(() => {
    if(controller){
      controller.stop();
    }

    messaging.unsubscribe(addSubscriptionToken);
    // messaging.unsubscribe(resetSubscriptionToken);
    // unsubscribeItemsChangeCallback();
    resetStores();
  });

</script>

<slot />


<style>
  .container {
    height: 100%;
    width: 100%;
    display: grid;
    grid-template-columns: auto 1fr;
    grid-template-rows: auto 1fr;

    grid-template-areas:
      "sidebar settings"
      "sidebar layout";
  	/* background-color: #6f7262; */
    background-color: #212121;
    /* overflow: hidden; */
  }
  .sidebar-container {
    /* background: linear-gradient(150deg, rgba(0,18,1,1) 0%, rgba(7,5,17,1) 33%, rgba(16,12,12,1) 67%, rgb(12, 12, 12) 100%); */
    background: #151515;
    grid-area: sidebar;
    height: 100%;
    /* width: auto; width is defined by child */
  }

  .sidebar-container-light {
    /* background: linear-gradient(150deg, rgba(0,18,1,1) 0%, rgba(7,5,17,1) 33%, rgba(16,12,12,1) 67%, rgb(12, 12, 12) 100%); */
    background: white;
    grid-area: sidebar;
    height: 100%;
    /* width: auto; width is defined by child */
  }

  .settings-container {
    /* background: linear-gradient(150deg, rgba(0,18,1,1) 0%, rgba(7,5,17,1) 33%, rgba(16,12,12,1) 67%, rgb(12, 12, 12) 100%); */
    background: #151515;
    grid-area: settings;
    height: 100%;
    width: auto; /* width is defined by child */
  }
  .settings-container-light {
    /* background: linear-gradient(150deg, rgba(0,18,1,1) 0%, rgba(7,5,17,1) 33%, rgba(16,12,12,1) 67%, rgb(12, 12, 12) 100%); */
    background: white;
    grid-area: settings;
    height: 100%;
    width: auto; /* width is defined by child */
  }

  .dashboard-container {
    grid-area: layout;
    /* height: 100%; */
    width: 100%;
    z-index: 0;
    /* height: 100vh;
    width: 100%;
    overflow: hidden; */

    /* grid-row: 0 / 2; */

  }

  .upload-overlay-container {
    grid-area: layout;
    z-index: 1000;
    background-color: rgba(16,12,12,0.8);
    visibility: visible;
    width: 100%;

    display:flex;
    justify-content:center;
    align-items:center;
    font-size:16px;
    visibility: hidden;
  }




  .upload-overlay-text {

    top:50%;

    /* width: 100%; */
    position: absolute;
    color: #FFF;

  }

  :global(*) {
    /* user-select: none; */
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
    background: #151515 !important;
    border: solid 3.5em rgba(#151515, .5);
    /* box-shadow: 10px 10px 10px #151515; */
    border-radius: 4px;
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
  .box-icon {
    margin-bottom: 120px;
  }
  path {
    fill: white;
  }

</style>


<svelte:head>
	<title>Sema – Playground</title>
</svelte:head>

<div class="container">
  <div class="{ $siteMode === 'dark' ? 'sidebar-container': 'sidebar-container-light' }"
    style="{ $sideBarVisible ? 'width: auto; visibility: visible;': 'width: 0px; visibility: hidden;' }"
    >
    <Sidebar />
  </div>

  <div  class="upload-overlay-container" style='visibility:{$isUploadOverlayVisible? "visible": "hidden"}'
        on:drop={handleDragDrop}
        on:dragenter={handleDragEnter}
        ondragover="return false"
        >
    <svg class="box-icon" xmlns="http://www.w3.org/2000/svg" width="50" height="43" viewBox="0 0 50 43">
      <path d="M48.4 26.5c-.9 0-1.7.7-1.7 1.7v11.6h-43.3v-11.6c0-.9-.7-1.7-1.7-1.7s-1.7.7-1.7 1.7v13.2c0 .9.7 1.7 1.7 1.7h46.7c.9 0 1.7-.7 1.7-1.7v-13.2c0-1-.7-1.7-1.7-1.7zm-24.5 6.1c.3.3.8.5 1.2.5.4 0 .9-.2 1.2-.5l10-11.6c.7-.7.7-1.7 0-2.4s-1.7-.7-2.4 0l-7.1 8.3v-25.3c0-.9-.7-1.7-1.7-1.7s-1.7.7-1.7 1.7v25.3l-7.1-8.3c-.7-.7-1.7-.7-2.4 0s-.7 1.7 0 2.4l10 11.6z"></path>
    </svg>
    <p class="upload-overlay-text"><span style="font-weight: 1500;">Choose your .json file</span> or <span>drag'n'drop it here to upload a new environment!</span></p>
  </div>

  <div class="{$siteMode === 'dark' ? 'settings-container' : 'settings-container-light'}">
    <Settings/>
  </div>

  <div class="dashboard-container scrollable"
    bind:this={container}
    >
    <Grid
      bind:items={ $items }
      { cols }
      { rowHeight }
      { gap }
      fastStart={ $fastStart }
      on:adjust={ onAdjust }
      on:mount={ onChildMount }
      let:item
      let:dataItem
      scroller={ container }
      fillSpace={ fillFree }
      >
        <span class='move'>+</span>
<!-- { dataItem.data.hasFocus ? '1px solid rgba(100, 100, 100, 0.5)': '1px solid rgba(25, 25, 25, 0.1)' }; -->
        <div  class="content"
              style="background: { item.fixed ? '#bka' : dataItem.data.background }; border: 1px solid rgba(25, 25, 25, 0.1); border-width: 1px 1px 1px 1px;"
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

