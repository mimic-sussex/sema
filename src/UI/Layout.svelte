<script>
  import Quadrants from "./Quadrants.svelte";
  import Dashboard from "./Dashboard.svelte";

  export let layoutTemplate = 1;

  export let value = `:b:{{1,0.25}imp}\\909b;`;

  let dashboardContainerDisplay = "initial";
  let quadrantsContainerDisplay = "initial";


  $: doubled = changeLayout(layoutTemplate);

  function changeLayout (layoutIndex) {
    switch (layoutIndex) {
      case 2:
        dashboardContainerDisplay = "none";
        quadrantsContainerDisplay = "initial"; 
        break;
      case 5:
        dashboardContainerDisplay = "initial"; 
        quadrantsContainerDisplay = "none";  
        break;
      default:
        dashboardContainerDisplay = "initial";
        quadrantsContainerDisplay = "initial";  
        break;
    }
  }

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
    <Dashboard />
  </div>
  <div class="quadrants-container" style="display:{quadrantsContainerDisplay}">
    <Quadrants liveCodeEditorValue={value} grammarEditorValue={value} modelEditorValue={value}  />
  </div>
</div>
