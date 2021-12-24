<script>
  import Engine from './group/Engine.svelte';
  import SiteMode from './group/SiteMode.svelte';
  import Screen from './group/Screen.svelte';
  // import Share from './group/Share.svelte';
  import Environment from './group/Environment.svelte';
  import Mouse from './group/Mouse.svelte';

  import SettingsContainer from './SettingsContainer.svelte';
  import Icon from "../icons/Icon.svelte";

  import {
    screenSettings,
    environmentSettings,
    engineSettings
  } from '../../stores/settings';


</script>

<style>

  .settings-container {
    width: 100%;
    display: flex;
    /* flex-direction: row-reverse; */
    flex-direction: row;
    align-self: flex-end;
    /* justify-content:space-between; */
    /* border-bottom: 1px solid #080808; */
    margin-left: 0.5em;
    background-color:#3a4147;
  }

  .screen-container {
    /* width: 7.5em; */
    /* width: 10.0em;*/
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
    /* width: 12.5em; */
    display:inline-flex;
    justify-content:space-between;
  }

  .mouse-container {
    width: 10em;
    /* display:inline-flex; */
    /* justify-content:space-between; */
  }

  .side-by-side {
		background-color: #262a2e;
		/* border-top-right-radius: 5px;
		border-bottom-right-radius: 5px; */
		/* display:inline-block; */
		/* margin-right: -4px; hacky method of getting them side by side no gap */
		display:flex;
		align-items:center;
		border-radius: 5px;
	}
	
	.button-launcher {
		padding: 20;
		background-color: #262a2e;
		color: white;
		border: none;
		/* width: 42px; */
  	/* height: 42px; */
  	margin: 8px 8px 8px 8px;
  	/* padding: 7px 10px 8px 8px; */
  	border-radius: 5px;
  	background-color: #262a2e;
	}
	
	svg{
		fill: #999999;
	}

  .sub-settings-container {
    /* background-color: #262a2e; */
		/* border-radius: 5px; */
		/* width:100%; */
		/* height:100%; */
    height: 50px;
    margin: 0.5em 0px 0.5em 0em;
  }

  .outer-settings-container{
    display: flex;
    /* flex-direction: row-reverse; */
    flex-direction: row;
    align-self: flex-end;
    background-color: #262a2e;
		border-radius: 5px;
    height:50px;
    margin: 0.5em 0px 0.5em 0em;
    /* box-shadow: -4px -2px 16px 0 rgba(195, 200, 205, 0.26), 4px 4px 18px 0 rgba(0, 0, 0, 0.8);
    background-image: linear-gradient(162deg, #262b30 14%, #23262a 101%); */
  }

  .divider {
    width: 4px;
    /* height: 50px; */
    /* margin: 1px 11px 1px 17px; */
    border-radius: 2px;
    box-shadow: inset 1px 1px 4px 0 #070709, inset -1px -1px 4px 0 rgba(255, 255, 255, 0.05);
    margin: 0.5em 0px 0.5em 0em;
  }
</style>


<div class="settings-container">

  <div class='outer-settings-container'>
  <!-- <div class='sub-settings-container'> -->
    <div class='screen-container'>
      
      

      <button class="button-launcher" on:click={() => $screenSettings = !$screenSettings}>
        
        <!-- <Icon name='buttonHorizontal'/> -->
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" class="bi bi-eye" viewBox="0 0 18 18"
        style='{ $screenSettings? 'fill:white' : ''}'>
          
          <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z"/>
          <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z"/>
          <path d="M3 18.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/>
          
        </svg>
        
      </button>
      

      

    </div>

    <div class='environment-container'>
      
      <button class="button-launcher" on:click={() => $environmentSettings = !$environmentSettings}>
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" class="bi bi-cloud" viewBox="0 0 18 18"
        style='{ $environmentSettings? 'fill:white' : ''}'
        >
          <path d="M4.406 3.342A5.53 5.53 0 0 1 8 2c2.69 0 4.923 2 5.166 4.579C14.758 6.804 16 8.137 16 9.773 16 11.569 14.502 13 12.687 13H3.781C1.708 13 0 11.366 0 9.318c0-1.763 1.266-3.223 2.942-3.593.143-.863.698-1.723 1.464-2.383zm.653.757c-.757.653-1.153 1.44-1.153 2.056v.448l-.445.049C2.064 6.805 1 7.952 1 9.318 1 10.785 2.23 12 3.781 12h8.906C13.98 12 15 10.988 15 9.773c0-1.216-1.02-2.228-2.313-2.228h-.5v-.5C12.188 4.825 10.328 3 8 3a4.53 4.53 0 0 0-2.941 1.1z"/>
          <path d="M3 18.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/>
        </svg>
      </button>

    </div>

    <div class='engine-container'>
      
      <button class="button-launcher" on:click={() => $engineSettings = !$engineSettings}>
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" class="bi bi-speaker" viewBox="0 0 18 18"
        style='{ $engineSettings? 'fill:white' : ''}'>
          <path d="M12 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h8zM4 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H4z"/>
          <path d="M8 4.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5zM8 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 3a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm-3.5 1.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z"/>
          <path d="M3 18.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/>
        </svg>
      </button>

    </div>

  <!-- </div> -->

  
  {#if $screenSettings}
    <div class="divider"></div>
    <!-- <div class='sub-settings-container'> -->
    <Screen />
    <!-- </div> -->
  {/if}

  {#if $environmentSettings}
  <div class="divider"></div>
  <!-- <div class='sub-settings-container'> -->
    <!-- <div class="divider"></div> -->
    <Environment />
  <!-- </div> -->
  
  {/if}

  {#if $engineSettings}
  <div class="divider"></div>
  <!-- <div class='sub-settings-container'> -->
    <!-- <div class="divider"></div> -->
    <Engine />
  <!-- </div> -->
  {/if}

  </div>

<!-- 
  <div class='screen-container'>
    <SettingsContainer>
      
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" class="bi bi-eye" viewBox="0 0 18 18" slot="icon">
        <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z"/>
        <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z"/>
        <path d="M3 18.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/>
      </svg>
      
      <Screen slot="section1"/>
    </SettingsContainer>
  </div> -->

  <!-- <div class='environment-container'>
    <SettingsContainer>

      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" class="bi bi-cloud" viewBox="0 0 18 18" slot="icon">
        <path d="M4.406 3.342A5.53 5.53 0 0 1 8 2c2.69 0 4.923 2 5.166 4.579C14.758 6.804 16 8.137 16 9.773 16 11.569 14.502 13 12.687 13H3.781C1.708 13 0 11.366 0 9.318c0-1.763 1.266-3.223 2.942-3.593.143-.863.698-1.723 1.464-2.383zm.653.757c-.757.653-1.153 1.44-1.153 2.056v.448l-.445.049C2.064 6.805 1 7.952 1 9.318 1 10.785 2.23 12 3.781 12h8.906C13.98 12 15 10.988 15 9.773c0-1.216-1.02-2.228-2.313-2.228h-.5v-.5C12.188 4.825 10.328 3 8 3a4.53 4.53 0 0 0-2.941 1.1z"/>
        <path d="M3 18.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/>
      </svg>

      <Environment slot="section1"/>
    </SettingsContainer>
  </div> -->

<!-- 
  <div class='engine-container'>
    <SettingsContainer>
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" class="bi bi-speaker" viewBox="0 0 18 18" slot="icon">
        <path d="M12 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h8zM4 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H4z"/>
        <path d="M8 4.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5zM8 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 3a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm-3.5 1.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z"/>
        <path d="M3 18.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/>
      </svg>
      
      <Engine slot="section1"/>
    </SettingsContainer>
  </div> -->

  <!-- <div style='width: 5px;'></div> -->


  <!-- <div class='mouse-container'>
    <Mouse />
  </div> -->


  <!-- <div style='width: 5px;'></div> -->




</div>