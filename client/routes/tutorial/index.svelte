<script>
  import Sidebar from '../../components/tutorial/Sidebar.svelte';
  import Dashboard from '../../components/layouts/Dashboard.svelte';
  import { items } from "../../stores/tutorial.js"
</script>

<svelte:head>
	<title>Sema – Tutorial</title>
</svelte:head>

<div class="container scrollable">
  <!-- <div class="sidebar-container">
    <Sidebar />
  </div>
  <div class="dashboard-container">
    <Dashboard {items} />
  </div> -->
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
</style>