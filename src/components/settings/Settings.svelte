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
    border-bottom: 1px solid #080808;
    margin-left: 0.5em;
  }

  .screen-container {
    width: 7.5em;
    display:inline-flex;
    justify-content:space-between;
  }

  .environment-container {
    width: 22.5em;
    display:inline-flex;
    justify-content:space-between;
  }

  .engine-container {
    width: 10em;
    display:inline-flex;
    justify-content:space-between;
  }

</style>


<div class="settings-container">


  <div class='screen-container'>
    <Screen />

    <SiteMode />
  </div>

  <div style='width: 5px;'></div>

  <div class='environment-container'>
    <Environment/>
  </div>



  <div style='width: 5px;'></div>

  <div class='engine-container'>
    <Engine />
  </div>

  <div style='width: 5px;'></div>



  <Mouse />

  <!-- <div style='width: 10px;'></div> -->




</div>