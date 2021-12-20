<script>
  import Engine from './group/Engine.svelte';
  import SiteMode from './group/SiteMode.svelte';
  import Screen from './group/Screen.svelte';
  // import Share from './group/Share.svelte';
  import Environment from './group/Environment.svelte';
  import Mouse from './group/Mouse.svelte';



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
    /* width: 7.5em; */
    width: 10.0em;
    display:inline-flex;
    justify-content:space-between;
  }

  .environment-container {
    /* width: 22.5em; */
    width: auto;
    display:inline-flex;
    justify-content:space-between;
  }

  .engine-container {
    width: 12.5em;
    display:inline-flex;
    justify-content:space-between;
  }

  .mouse-container {
    width: 10em;
    /* display:inline-flex; */
    /* justify-content:space-between; */
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


  <div class='mouse-container'>
    <Mouse />
  </div>


  <div style='width: 5px;'></div>




</div>