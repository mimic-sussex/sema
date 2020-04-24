<script>

  import Sidebar from '../components/playground/Sidebar.svelte';
  import Dashboard from '../components/layouts/Dashboard.svelte';

</script>

<svelte:head>
	<title>Sema – Playground</title>
</svelte:head>

<div class="container scrollable">
  <div class="sidebar-container">
    <Sidebar />
  </div>
  <div class="dashboard-container">
    <Dashboard />
  </div>
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
    height: 100%;
    overflow: hidden;
  }

</style>