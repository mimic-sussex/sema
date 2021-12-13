<script>
	// import { authStore } from '../../auth'
	import { redirect, params, goto, beforeUrlChange } from '@roxi/routify'
	// const { user } = authStore
	import { user } from "../../stores/user"

  import {
    onMount,
    onDestroy
  } from 'svelte';

  import { PubSub } from "../../utils/pubSub.js";

  // import { compile } from '../node_modules/sema-engine/sema-engines';

  import Delete from '../../components/overlays/Delete.svelte';
  import Clear from '../../components/overlays/Clear.svelte';
  import New from '../../components/overlays/New.svelte';
  import Save from '../../components/overlays/Save.svelte';
  import Upload from '../../components/overlays/Upload.svelte';
  import Share from '../../components/overlays/Share.svelte';
  import DoesNotExist from '../../components/overlays/DoesNotExist.svelte';
  import ProjectBrowser from '../../components/overlays/ProjectBrowser.svelte';
  import Private from '../../components/overlays/Private.svelte';
  import Loading from '../../components/overlays/Loading.svelte';
  import LoadingPlayground from '../../components/overlays/LoadingPlayground.svelte';
  import Sidebar from '../../components/playground/Sidebar.svelte';
  import Settings from '../../components/settings/Settings.svelte';
  // import Dashboard from '../components/layouts/Dashboard.svelte';

	import {
		supabase,
    updatePlayground,
    fetchPlayground,
    savePlayground,
    createPlayground,
    getExamplePlaygrounds
  } from '../../db/client';

  import Grid from "svelte-grid";
  import gridHelp from "svelte-grid/build/helper";

  let grid,
      fillFree = true;

  let messaging = new PubSub();

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
    isDeleteOverlayVisible,
    isClearOverlayVisible,
    isNewOverlayVisible,
    isSaveOverlayVisible,
    isShareOverlayVisible,
    isDoesNotExistOverlayVisible,
    isProjectBrowserOverlayVisible,
    isPrivateOverlayVisible,
    isLoadingOverlayVisible,
    isLoadingPlaygroundOverlayVisible,
		name,
		uuid,
    items,
    allowEdits,
    isPublic,
    author,
    saveRequired
  } from  "../../stores/playground.js"

  import {
    updateItemPropsWithFetchedValues,
    populateCommonStoresWithFetchedProps,
    updateItemPropsWithCommonStoreValues,
    isMouseOverlayVisible,
    resetStores,
    siteMode,
    sideBarVisible
  } from  "../../stores/common.js"

  import {
    Engine
  } from 'sema-engine'

  import Controller from "../../engine/controller";
  let controller = new Controller(); // this will return the previously created Singleton instance
  let engine = controller.engine;

  $: loadPlayground($params.playgroundId)

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

  // let unsubscribeItemsChangeCallback;

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
        // console.log("DEBUG: focusedItem in setFocused, lineNumbers:", $focusedItem.data.lineNumbers);
        $focusedItemProperties = itemProperties;
        // set unfocused items through the rest of the list
        $items = $items.map(i => i === item ? ({ ...i, ['hasFocus']: true }) : ({ ...i, ['hasFocus']: false }) );
        //USED
        $saveRequired = true;
				//updatePlayground($uuid, $name, $items, $allowEdits, $user);
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
        //USED
        $saveRequired = true;
				//updatePlayground($uuid, $name, $items, $allowEdits, $user);
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
          //USED
          $saveRequired = true;
          //updatePlayground($uuid, $name, $items, $allowEdits, $user);
        }
        else if(e.detail.prop === "hasFocus"){
          setFocused(dataItem);
        }
      }
    }
    catch(error){
      console.log(`Error updating component: ${dataItem}`, error);
    }

  }



  const clearItems = () => {
    // console.log("DEBUG:dashboard:clearItems:")
    // items.update( items => items.map( item => remove(item) ) );

    clearFocused();
    // items.set([]);
  }


  const remove = item => {

    if(!engine)
      engine = new Engine();

    if(item.data.type === 'analyser'){
      engine.removeAnalyser({ id: item.id });
      // messaging.publish('remove-engine-analyser', { id: item.id }); // notify audio engine to remove associated analyser
    }
    // console.log("DEBUG:dashboard:remove:", item);
    messaging.publish("plaground-item-deletion", item.data.type);

    remove.bind(null, item); // remove dashboard item binding
    delete item.component;


    $items = $items.filter( i => i.id !== item.id);
    //USED
    $saveRequired = true;
    //updatePlayground($uuid, $name, $items, $allowEdits, $user);
    // console.log("DEBUG:dashboard:remove:");
    // console.log($items);
  }

  const onClickCloseOverlay = () => {
    $isNewOverlayVisible = $isUploadOverlayVisible = $isSaveOverlayVisible = $isDeleteOverlayVisible = $isClearOverlayVisible= $isShareOverlayVisible = $isDoesNotExistOverlayVisible = false;
  }

  const onAdjust = e => {
    console.log("DEBUG:dashboard:onAdjust:", e.detail);
    $items = $items; // call a re-render
		// updatePlayground($uuid, $name, $items);
  };

  const onChildMount = e => {
    console.log("DEBUG:dashboard:onChildMount:", e.detail);
    $items = $items; // call a re-render
		// updatePlayground($uuid, $name, $items);
  };



  let container;

  const loadPlayground = async () => {
    $isLoadingPlaygroundOverlayVisible = true;
    if ($params.playgroundId){
      let playground;
      try {
        playground = await fetchPlayground($params.playgroundId);
        setPlayground(playground);
        updateSidebar();
        $isDoesNotExistOverlayVisible = false;
      } catch (error) {
        if (playground == null){ //cant find playground with that ID.
          $isDoesNotExistOverlayVisible = true; //trigger overlay DoesNotExist
        } else {
          console.error(error)
        }
      } finally {
        console.log('finally update sidebar');
        // updateSidebar();
      }
    } else if ($user) {
      let playground;
      try {
        playground = await getMostRecentEditedPlayground($user);
        console.log('most recent ', playground);
        if (playground.length == 0){
          let newPlayground;
          newPlayground = await createPlayground();
          setPlayground(newPlayground);
          window.history.pushState("", "", `/playground/${$uuid}`);
          // $goto(`/playground/${$uuid}`)
        } else {
          setPlayground(playground[0])
          window.history.pushState("", "", `/playground/${$uuid}`);
          // $goto(`/playground/${$uuid}`)
        }
      } catch (error){
        console.log(error);
      } finally {
          updateSidebar();
      }
    } else { 
      //choose random playground from examples
      let playgrounds;
      try {
        playgrounds = await getExamplePlaygrounds()
        let randomExample = playgrounds[Math.floor(Math.random() * playgrounds.length)]
        setPlayground(randomExample);
        window.history.pushState("", "", `/playground/${$uuid}`);
        // $goto(`/playground/${$uuid}`)
      } catch (error){
        console.log(error)
      } finally {
        updateSidebar();
      }
    }
    $isLoadingPlaygroundOverlayVisible=false;
  }

  const checkPermissionsForPlayground = (playground) => {
    if (playground.isPublic){
      return true; // public project everyone can view
    } else if (playground.author == $user){
      return true; // private project user is author
    } else {
      return false; // private project and $user is not author
    }
  }

  const getMostRecentEditedPlayground = async (user) => {
    let orderBy = {col:'updated', ascending:false};

    try {
			//const user = supabase.auth.user()
			
			const playgrounds = await supabase
			.from('playgrounds')
			.select(`
					id,
					name,
					content,
					created,
					updated,
					isPublic,
					author (
						username
					),
					allowEdits
				`)
			.eq('author', user.id)
			.range(0, 0)
      .order(orderBy.col, {ascending:orderBy.ascending})
			
			return playgrounds.data;
		} catch(error){
			console.error(error)
		}
  }

  // set fetched playground row in svelte stores.
  function setPlayground(playground) {
    $uuid = playground.id;
    $name = playground.name;
    $items = playground.content.map(item => hydrateJSONcomponent(item));
    $allowEdits = playground.allowEdits;
    $isPublic = playground.isPublic;
    $author = playground.author;
    updateStoresWithProps();
  }

  const updateStoresWithProps = async () =>{
    for (const item of $items)
      await updateItemPropsWithFetchedValues(item);

    for (const item of $items)
      await populateCommonStoresWithFetchedProps(item);

    for (const item of $items)
      updateItemPropsWithCommonStoreValues(item);
  }

  function updateSidebar(){
    messaging.publish("changing-playground");
  }

  // //loads playground from url params if they exist and if not from local storage.
  // const loadPlaygroundOld = async () => {
  //   //if there is a playground/SOMETHINg in the url try look it up in the DB
  //   if ($params.playgroundId){
  //     let playground;
  //     try {
  //       playground = await fetchPlayground($params.playgroundId);

  //       //check its not private
  //       if (!playground.isPublic && playground.author != $user){
  //         $isPrivateOverlayVisible = true;
  //       } else {
  //         setPlayground(playground);
  //         //write url to local storage
  //         localStorage.setItem("last-session-playground-uuid", `${$uuid}`);
  //       }
        
  //     } catch (error) {
  //       if (playground == null){ //cant find playground with that ID.
  //         $isDoesNotExistOverlayVisible = true; //trigger overlay DoesNotExist
  //       } else {
  //         console.error(error)
  //       }
  //     }
  //   } else if (localStorage.getItem("last-session-playground-uuid") && $user) {
  //     let playground
  //     try {
  //       // console.log("going to url in local storage", localStorage.getItem("last-session-playground-uuid"))
  //       // $goto('/playground/'+localStorage.getItem("last-session-playground-uuid"));
  //       playground = await fetchPlayground(localStorage.getItem("last-session-playground-uuid"));

  //       //check its not private
  //       if (!playground.isPublic && playground.author != $user){
  //         $isPrivateOverlayVisible = true;
  //       } else {
  //         setPlayground(playground);
  //       }

  //       window.history.pushState("", "", `/playground/${$uuid}`); //put the new UUID in the URL without reloading
  //     } catch (error) {
  //       if (playground == null){ //cant find playground with that ID.
  //         $isDoesNotExistOverlayVisible = true; //trigger overlay DoesNotExist
  //       } else {
  //         console.error(error)
  //       }
  //     }
  //   } else if (!params.playgroundId && !localStorage.getItem("last-session-playground-uuid") && $user){
  //     //create a new playground
  //     let playground;
  //     try{
  //       playground = await createPlayground();
  //       // setPlayground(playground)
  //       console.log("new playground ", playground)
  //       $uuid = playground.id;
  //       $name = playground.name;
  //       $items = $items //make with the existing data in items (they might have made changes) //$items.slice($items.length);
  //       $allowEdits = playground.allowEdits;
  //       $author = playground.author;
  //       window.history.pushState("", "", `/playground/${$uuid}`); //put the new UUID in the URL without reloading
  //     } catch (error){
  //       console.log(error)
  //     }
  //   } else if (!params.playgroundId && !localStorage.getItem("last-session-playground-uuid") && !$user){
      
  //     //choose random playground from examples
  //     let playgrounds
  //     try {
  //       playgrounds = await getExamplePlaygrounds()
  //       let randomExample = playgrounds[Math.floor(Math.random() * playgrounds.length)]
  //       setPlayground(randomExample);
  //       window.history.pushState("", "", `/playground/${$uuid}`);
  //     } catch (error){
  //       console.log(error)
  //     }

  //   }
  // }

  const autoSaveCycle = async () => {
      const interval = setInterval(async function() {
        await savePlayground($uuid, $name, $items, $allowEdits, $user)
      }, 15000); //save every 15 seconds
  }

  // export const savePlayground = async () => {
  //   if ($saveRequired){
  //     await updatePlayground($uuid, $name, $items, $allowEdits, $user);
  //     $saveRequired = false;
  //   }
  // }


  onMount( async () => {

    // No need to create re-initialise controller again here
    if(!controller.initializing && !controller.samplesLoaded){
      // controller.init('http://localhost:5000/sema-engine');
      $isLoadingOverlayVisible = true;
      await controller.init(document.location.origin + '/build/');
      $isLoadingOverlayVisible = false;
    }
    // console.log('Playground index: onMount ');

    loadPlayground();
    autoSaveCycle();

    // Sequentially fetch data from individual items' properties into language design workflow stores
    for (const item of $items)
      await updateItemPropsWithFetchedValues(item);

    for (const item of $items)
      await populateCommonStoresWithFetchedProps(item);

    for (const item of $items)
      updateItemPropsWithCommonStoreValues(item);

    addSubscriptionToken = messaging.subscribe('playground-add', e => addItem(e) );
    // unsubscribeItemsChangeCallback = items.subscribe(value => {
    //   console.log('Playground items changed: ', value );
		// 	// updatePlayground($uuid, $name, $items);
    // });

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

  $beforeUrlChange( async (event, route) => {
    await savePlayground($uuid, $name, $items, $allowEdits, $user)
    return true;
  // if($saveRequired){
  //   // alert('Please save your changes before leaving.')
  //   await updatePlayground($uuid, $name, $items, $allowEdits, $user);
  //   $saveRequired = false;
  //   return true
  // }
  })

  const beforeUnloadListener = async (event) => {
    event.preventDefault();
    await savePlayground($uuid, $name, $items, $allowEdits, $user);
    return true;
  };

  $: addAndRemoveUnloadListener($saveRequired)
  function addAndRemoveUnloadListener($saveRequired){
    if ($saveRequired){
      addEventListener("beforeunload", beforeUnloadListener, {capture: true});
    } else {
      removeEventListener("beforeunload", beforeUnloadListener, {capture: true});
    }
  }
</script>


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
    /* background-color: #212121; */
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
  }

  .dashboard-container-dark {
    background: #212121;
  }

  .dashboard-container-light {
    background: #d1d1d1;
  }


  .overlay-container {
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

  .upload-overlay-container {
    grid-area: layout;
    z-index: 1000;
    background-color: rgba(16,12,12,0.8);
    visibility: hidden;
    width: 100%;

    /* display:flex; */
    /* justify-content:center;
    align-items:center; */
    font-size:16px;
  }

  .project-browser-overlay-container{
    grid-area: layout;
    z-index: 1001;
    background-color: rgba(16,12,12,0.8);
    visibility: hidden;
    width: 100%;
    font-size:16px;
  }

  .mouse-overlay-container {
    grid-area: layout;
    z-index: 1000;
    background-color: rgba(16,12,12,0.8);
    visibility: visible;
    width: 100%;

    /* display:flex; */
    /* justify-content:center;
    align-items:center; */
    font-size:16px;
    visibility: hidden;
  }




  :global(body) {
    /* overflow: scroll; */
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
    background: rgba(25, 25, 25, 0.6) !important;
    border: solid 3.5em rgba(#151515, .5);
    /* box-shadow: 10px 10px 10px #151515; */
    border-radius: 4px;
    border-bottom-right-radius: 3px;
    transition: transform 0.2s;
  }

  :global(.svlt-grid-item) {
    display: grid;
    grid-template-columns: auto 1fr auto;
    grid-template-rows: auto 1fr;
  }



  .chrome {
    grid-row: 1/1;
    grid-column: 1/3;
    display: grid;
    /* grid-template-columns: auto 1fr auto; */
    position: relative;
    /* background: rgba(25, 25, 25, 0.6); */
    /* border-width: 1px 1px 1px 1px; */
    /* top: 1.4em; */
    padding: 0.2em 0.1em 0.1em 0.1em;
    z-index: 1500;
  }

  .move {
    text-shadow: 1px 1px 1px #000000;
    font-size: 1.2em;
    position: absolute;
    padding: 0em 0.3em ;
    cursor: move;
    color: lightgray;
    /* margin-left: 0.2em; */
    grid-column: 1/1;
  }

  .item-header-type {
    grid-column: 2/2;
    /* padding-top: 0.2em; */

  }

  .close {
    grid-column: 3/2;
    position: absolute;
    top: 0;
    right: 0;
    padding:  0.1em 0.3em 0.1em 0.1em;
    cursor: pointer;
    /* z-index: 1500; */
    text-shadow: 1px 1px 1px #000000;
  }

  .close-overlay {
    /* grid-column: 3/2; */
    position: absolute;
    /* top: 0; */
    right: 0;
    padding:  0.1em 0.3em 0.1em 0.1em;
    cursor: pointer;
    /* z-index: 1500; */
    text-shadow: 1px 1px 1px #000000;
  }

  .content {
    grid-row: 2/2;
    grid-column: 1/3;
    /* top: -1.4em; */
    width: 100%;
    /* height: calc(100%-2.5em); */
    height: 100%;
    border-radius: 0px;
    border-top-left-radius: 0px;
    border-bottom-right-radius: 0px;
    /* padding: 10px; */
    /* padding: 10px; */
    /* background: #FFF; */
    overflow-y:hidden;
  }

  /* .component {
    height: calc(100%-2.5em);
  } */

 	.scrollable {
		flex: 1 1 auto;
		margin: 0 0 0.5em 0;
		overflow-y: auto;
	}

  /* .box-icon {
    margin-bottom: 120px;
  } */

  path {
    fill: white;
  }

</style>


<svelte:head>
	<title>Sema – Playground</title>
</svelte:head>

<div class="container">
  <div  class="{ $siteMode === 'dark' ? 'sidebar-container': 'sidebar-container-light' }"
        style="{ $sideBarVisible ? 'width: auto; visibility: visible;': 'width: 0px; visibility: hidden;' }"
        >
    <Sidebar />
  </div>

  <div  class="upload-overlay-container"
        style='visibility:{ ( $isNewOverlayVisible || $isUploadOverlayVisible || $isDeleteOverlayVisible || $isClearOverlayVisible || $isSaveOverlayVisible || $isShareOverlayVisible || $isPrivateOverlayVisible || $isLoadingOverlayVisible || $isLoadingPlaygroundOverlayVisible ) ? "visible" : "hidden"}'
        >
    <span class='close-overlay'
          on:click={ () => onClickCloseOverlay() }
          >✕
    </span>

		{#if $isUploadOverlayVisible }
      <Upload />
		{:else if $isDeleteOverlayVisible }
      <Delete />
    {:else if $isClearOverlayVisible}
      <Clear />
		{:else if $isSaveOverlayVisible }
      <Save />
		{:else if $isNewOverlayVisible }
      <New />
    {:else if $isShareOverlayVisible}
      <Share id={$uuid}/>
    {:else if $isDoesNotExistOverlayVisible}
      <DoesNotExist/>
    <!-- {:else if $isProjectBrowserOverlayVisible}
      <ProjectBrowser/> -->
    {:else if $isPrivateOverlayVisible}
      <Private/>
    {:else if $isLoadingOverlayVisible}
      <Loading/>
    {:else if $isLoadingPlaygroundOverlayVisible}
      <LoadingPlayground/>
		{/if}

  </div>

  <div class='project-browser-overlay-container'>
    {#if $isProjectBrowserOverlayVisible}
      <ProjectBrowser/>
    {/if}
  </div>

  <!-- <div  class="mouse-overlay-container" style='visibility:visible' -->
  <div  class="mouse-overlay-container" style='visibility:{ $isMouseOverlayVisible? "visible" : "hidden" }'
        >
  </div>


  <div class="{$siteMode === 'dark' ? 'settings-container' : 'settings-container-light'}">
    <Settings/>
  </div>

  <div class="dashboard-container { $siteMode === 'dark'? 'dashboard-container-dark' : 'dashboard-container-light'}  scrollable"
    bind:this={ container }
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
        <!-- <span class='move'>+</span> -->


      <div class='chrome'
        style="background: #1c1c1c;"
        >
        <div class='move'>
          <svg version="1.1"
            id="Capa_1"
            xmlns="http://www.w3.org/2000/svg"
            xmlns:xlink="http://www.w3.org/1999/xlink"
            x="0px" y="0px"
            viewBox="0 0 489.9 489.9"
            style="enable-background:new 0 0 489.9 489.9;"
            xml:space="preserve"
            width='16px'
            >
            <g>
              <g>
                <path d="M406.2,173.55c-4.8,4.8-4.8,12.5,0,17.3l41.8,41.8H333.3v-63.9c0-6.8-5.5-12.3-12.3-12.3h-63.9V41.85l41.8,41.8
                  c2.4,2.4,5.5,3.6,8.7,3.6s6.3-1.2,8.7-3.6c4.8-4.8,4.8-12.5,0-17.3l-62.7-62.7c-2.3-2.3-5.4-3.6-8.7-3.6s-6.4,1.3-8.7,3.6
                  l-62.7,62.7c-4.8,4.8-4.8,12.5,0,17.3s12.5,4.8,17.3,0l41.8-41.8v114.7h-63.9c-6.8,0-12.3,5.5-12.3,12.3v63.9H41.8l41.8-41.8
                  c4.8-4.8,4.8-12.5,0-17.3s-12.5-4.8-17.3,0l-62.7,62.7c-4.8,4.8-4.8,12.5,0,17.3l62.7,62.7c2.4,2.4,5.5,3.6,8.7,3.6
                  s6.3-1.2,8.7-3.6c4.8-4.8,4.8-12.5,0-17.3l-41.8-41.8h114.7v63.9c0,6.8,5.5,12.3,12.3,12.3h63.9v114.7l-41.9-41.9
                  c-4.8-4.8-12.5-4.8-17.3,0s-4.8,12.5,0,17.3l62.7,62.7c2.3,2.3,5.4,3.6,8.7,3.6s6.4-1.3,8.7-3.6l62.7-62.7
                  c4.8-4.8,4.8-12.5,0-17.3s-12.5-4.8-17.3,0l-41.8,41.8v-114.7h63.9c6.8,0,12.3-5.5,12.3-12.3v-63.9h114.7l-42,41.8
                  c-4.8,4.8-4.8,12.5,0,17.3c2.4,2.4,5.5,3.6,8.7,3.6s6.3-1.2,8.7-3.6l62.7-62.7c2.3-2.3,3.6-5.4,3.6-8.7s-1.3-6.4-3.6-8.7
                  l-62.7-62.7C418.7,168.75,411,168.75,406.2,173.55z M308.8,308.85H181v-127.8h127.8L308.8,308.85L308.8,308.85z"/>
              </g>
            </g>
          </svg>
        </div>
        <div class='item-header-type'>
          <span>{ dataItem.data.type }</span>
        </div>
        <span class='close'
              on:click={ () => remove(dataItem) }
              >✕
        </span>
      </div>

<!-- { dataItem.data.hasFocus ? '1px solid rgba(100, 100, 100, 0.5)': '1px solid rgba(25, 25, 25, 0.1)' }; -->
      <div  class="content"
            style="background: { item.fixed ? '#bka' : dataItem.data.background };"
            on:pointerdown={ e => e.stopPropagation() }
            >
        <svelte:component class='component'
                          this={ dataItem.data.component }
                          { ...dataItem.data }
                          on:change={ e => update(e, dataItem) }
                          />
      </div>
    </Grid>
  </div>
</div>

