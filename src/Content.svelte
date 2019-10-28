<script>
  import Sidebar from './Sidebar.svelte';
  import Layout from './Layout.svelte';


</script>

<style>
  .container {
  	height: 100%;
  	display: grid;
  	grid-template-columns: 100px 1fr;
  	grid-template-rows: 50% 50%;
  	grid-template-areas:
  		"sidebar layout"
  		"sidebar layout";
  	background-color: purple;
  }
  .sidebar {
    background-color: yellow;
    grid-area: sidebar;
    grid-row: 0 / 1;
    height: 100%;
    width: auto;
  }
  .layout {
    grid-area: layout;
    grid-row: 0 / 1;
    /* display: flex; */
    height: 100%;
    /* flex-direction: column; */
  }

</style>

<div class="container">
  <div class="sidebar">
    <Sidebar />
  </div>
  <div class="layout">
    <Layout />
  </div>
</div>