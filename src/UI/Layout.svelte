<script>
  import Quadrants from "./Quadrants.svelte";
  import Dashboard from "./Dashboard.svelte";

  export let layoutTemplate = 'quadrants';

</script>


<style>
.layout-template-container {
  height: 100vh;
}

</style>

<div class="layout-template-container">
  <!-- <Quadrants /> -->

  <Dashboard />
</div>
