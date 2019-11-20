<script>
  import { selectedLayout, layoutOptions } from '../store.js';

  import Quadrants from './layouts/Quadrants.svelte';
  import Dashboard from './layouts/Dashboard.svelte';
  import Live from './layouts/Live.svelte'

 
  export let layoutTemplate = 1;

  export let value = `:b:{{1,0.25}imp}\\909b;`;


  let liveContainerDisplay = "initial";
  let dashboardContainerDisplay = "initial";
  let quadrantsContainerDisplay = "initial";


  $: doubled = changeLayout(layoutTemplate);

  function changeLayout (layoutIndex) {
    switch (layoutIndex) {
      case 1:
        liveContainerDisplay =      "initial";
        quadrantsContainerDisplay = "none"; 
        dashboardContainerDisplay = "none"; 
        break;
      case 2:
        liveContainerDisplay =      "none";
        quadrantsContainerDisplay = "initial"; 
        dashboardContainerDisplay = "none"; 
        break;
      case 5:
        liveContainerDisplay =      "none"; 
        quadrantsContainerDisplay = "none";  
        dashboardContainerDisplay = "initial";  
        break;
      default:
        liveContainerDisplay =      "initial";
        quadrantsContainerDisplay = "initial";  
        dashboardContainerDisplay = "initial";  
        break;
    }
  }

  const unsubscribe = selectedLayout.subscribe(value => {
    // console.log("DEBUG:Layout:selectedlayout: ", value.id);
    changeLayout(value.id);
  })  

  

</script>


<style>
/* [contenteditable] {
  height: 100vh;
} */
  .layout-template-container {
    height: 100vh;
  }

	.scrollable {
		flex: 1 1 auto;
		border-top: 1px solid #eee;
		margin: 0 0 0.5em 0;
		overflow-y: auto;
	}

</style>
<!-- <div class="layout-template-container" contenteditable="true" bind:innerHTML={layoutTemplate}> -->
<div class="layout-template-container scrollable">
  <div class="dashboard-container" style="display:{dashboardContainerDisplay}" >
    <Dashboard liveCodeEditorValue={value} grammarEditorValue={value} modelEditorValue={value} />
  </div>
  <div class="quadrants-container" style="display:{quadrantsContainerDisplay}">
    <Quadrants liveCodeEditorValue={value} grammarEditorValue={value} modelEditorValue={value}  />
  </div>
  <div class="live-container" style="display:{liveContainerDisplay}">
    <Live liveCodeEditorValue={value} grammarEditorValue={value} modelEditorValue={value}  />
  </div>
</div>
