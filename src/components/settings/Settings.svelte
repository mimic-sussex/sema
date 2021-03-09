<script>
  import EngineStatus from './EngineStatus.svelte';
  // import SignOut from './user/SignOut';
  // import SiteColor from './SiteColor.svelte';
  import SiteMode from './SiteMode.svelte';
  import Screen from './Screen.svelte';
  import Mouse from './Mouse.svelte';

</script>

<style>

  .settings-container {
    width: 100%;
    display: flex;
    flex-direction: row-reverse;
    align-self: flex-end;
    justify-content:end;
    border-bottom:1px solid #080808;
  }

</style>


<div class="settings-container">

  <div style='width: 5px;'></div>

  <Mouse />
  <div style='width: 5px;'></div>

  <EngineStatus />

  <div style='width: 10px;'></div>

  <SiteMode />

  <div style='width: 10px;'></div>

  <Screen />
  <!-- <SignOut /> -->

</div>