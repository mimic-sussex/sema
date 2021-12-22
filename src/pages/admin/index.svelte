<script>

	import Profile from "../../components/admin/Profile.svelte";
	import Projects from "../../components/admin/Projects.svelte";
	
	//overlays
	import DeleteAccount from "../../components/overlays/DeleteAccount.svelte";
	import EditProfile from "../../components/admin/EditProfile.svelte"
	
	import {
		isDeleteAccountOverlayVisible,
		isEditAccountOverlayVisible
	} from '../../stores/profile.js';

</script>

<style>

	.container-admin {
		height: 100%;
		overflow:auto;
		margin-left: auto;
		margin-right: auto;
		/* padding-top: 2em; */
		padding-bottom: 2em;

    display: grid;
  	grid-template-areas:
      "header header"
      "profile records"
  		"profile info";

		grid-template-columns: 15em 1fr;
    grid-template-rows: auto auto 1fr;
	}

	.container-profile {
		grid-area: profile;
		/* margin-left: 1em; */
		margin-right: 1em;
	}

	.container-records {
		grid-area: records;
		margin-right: 1em;
		/* overflow-y: auto; */
		height: 100%;
		width: 100%;
	}

	.overlay-container {
		position: absolute;
    /* z-index: 1000; */
		visibility: hidden;
    background-color: rgba(16,12,12,0.8);
    
    width: 100%;
		height:100%;

    /* display:flex; */
    /* justify-content:center;
    align-items:center; */
    font-size:16px;
  }

</style>

<div class="overlay-container">
	{#if $isDeleteAccountOverlayVisible}
		<DeleteAccount />
	{:else if $isEditAccountOverlayVisible}
		<EditProfile />
	{/if}
</div>

<div class="container-admin">
	<grid class="container-profile-header">
		<h2>Profile</h2>
	</grid>
	<grid class="container-records-header">
		<h2>Projects</h2>
	</grid>

	<grid class="container-profile">
		<Profile />
	</grid>

	<grid class="container-records">
		<Projects />
	</grid>

</div>