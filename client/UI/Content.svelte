<script>
  import Sidebar from './Sidebar.svelte';
  import Layout from './Layout.svelte';
  import { selectedLayout, layoutOptions} from '../store.js';
  // let selectedLayout = 1; 

  let layout;

  function handleMessage(event) {
    // if(event.detail.layout) {
    //   $selectedLayout = event.detail.layout;
    // }
    // else if(event.detail.language) {
      console.log('TODO:handleMessage');
    // }
	}

  function handleAdd(event) {
    // console.log('DEBUG:Content:handleAdd:');
    // console.log(event.detail);
    layout.addToDashboard(event.detail);
	}

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
  	background-color: #6f7262;
 
    overflow: hidden;
  }
  .sidebar-container {
    background-color: blue;
    /* margin-left: 10px; */
    grid-area: sidebar;
    grid-row: 0 / 1;
    height: 100%;
    width: auto; /* width is defined by child */
  }
  .layout-container {
    grid-area: layout;
    grid-row: 0 / 2;
    height: 100%;
    overflow: hidden;
  }

</style>

<div class="container">
  <div class="sidebar-container">
    <Sidebar on:message={handleMessage} 
             on:add={handleAdd}
    />
  </div>
  <div class="layout-container">
    <Layout bind:this={layout} layoutTemplate={selectedLayout} />
  </div>
</div>