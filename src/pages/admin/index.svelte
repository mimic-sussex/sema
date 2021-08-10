<script>

	import Profile from "../../components/admin/Profile.svelte"
	import Records from "../../components/admin/Records.svelte"

</script>

<style>

	.container-admin {

		margin-left: auto;
		margin-right: auto;
		padding-top: 2em;
		padding-bottom: 2em;

    display: grid;
  	grid-template-areas:
      "profile records"
  		"profile info";

		grid-template-columns: auto 1fr;
    grid-template-rows: auto 1fr;
	}

	.container-profile {
		grid-area: profile;
		margin-left: 1em;
		margin-right: 1em;
	}

	.container-records {
		grid-area: records;
		margin-right: 1em;
	}

</style>

<div class="container-admin">
	<grid class="container-profile">
		<Profile />
	</grid>

	<grid class="container-records">
		<Records />
	</grid>

</div>