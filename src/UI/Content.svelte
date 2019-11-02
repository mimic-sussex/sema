<script>
  import Sidebar from './Sidebar.svelte';
  import Layout from './Layout.svelte';

  let selectedLayout = 1; 

  function handleMessage(event) { 
    selectedLayout = event.detail.layout;
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
  	background-color: purple;
  }
  .sidebar-container {
    background-color: blue;
    margin-left: 10px;
    grid-area: sidebar;
    grid-row: 0 / 1;
    height: 100%;
    width: auto; /* width is defined by child */
  }
  .layout-container {
    grid-area: layout;
    grid-row: 0 / 2;
    height: 100%;
  }

</style>

<div class="container">
  <div class="sidebar-container">
    <Sidebar on:message={handleMessage}/>
  </div>
  <div class="layout-container">
    <Layout layoutTemplate={selectedLayout} />
  </div>
</div>