<script>
  import Engine from './Engine.svelte';
  import SiteMode from './SiteMode.svelte';
  import Screen from './Screen.svelte';
  import Share from './Share.svelte';
  import Environment from './Environment.svelte';
  import Mouse from './Mouse.svelte';



</script>

<style>

  .settings-container {
    width: 100%;
    display: flex;
    /* flex-direction: row-reverse; */
    flex-direction: row;
    align-self: flex-end;
    justify-content:space-between;
    border-bottom:1px solid #080808;
  }


</style>


<div class="settings-container">

  <!-- <div style='width: 5px;'></div> -->

  <Mouse />

  <Environment/>

  <div style='width: 5px;'></div>

  <Engine />

  <div style='width: 5px;'></div>

  <SiteMode />

  <Screen />


  <!-- <div style='width: 10px;'></div> -->




</div>