<script>
  import Sidebar from './Sidebar.svelte';
  import Layout from './Layout.svelte';
  import { selectedLayout, layoutOptions} from '../store.js';
  import Dashboard from './layouts/Dashboard.svelte'

  let layout;
  let dashboard;

  function handleMessage(event) {
    // if(event.detail.layout) {
    //   $selectedLayout = event.detail.layout;
    // }
    // else if(event.detail.language) {
      console.log('TODO:handleMessage');
    // }
	}

  // function handleAdd(event) {
  //   // console.log('DEBUG:Content:handleAdd:');
  //   // console.log(event.detail);
  //   layout.addToDashboard(event.detail);
	// }

</script>

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
  /* .layout-container {
    grid-area: layout;
    grid-row: 0 / 2;
    height: 100%;
    overflow: hidden;
  } */

  .scrollable {
		flex: 1 1 auto;
		margin: 0 0 0.5em 0;
		overflow-y: auto;
	}
</style>

<div class="container scrollable">
  
  <div class="sidebar-container">
    <Sidebar />
    <!-- <Sidebar on:message={handleMessage} 
             on:add={handleAdd} /> -->
  </div>
  
  <!-- <div class="layout-container">
    <Layout bind:this={layout} layoutTemplate={selectedLayout} />
  </div> -->

  <div class="dashboard-container">
    <Dashboard bind:this={dashboard} />
  </div>

</div>