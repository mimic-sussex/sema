<script>

	import Profile from "../../components/admin/Profile.svelte"
	import Records from "../../components/admin/Records.svelte"

</script>

<style>

	.container-admin {

    display: grid;
  	grid-template-areas:
      "profile records"
  		"profile info";

		grid-template-columns: auto 1fr;
    grid-template-rows: auto 1fr;
	}

	.container-profile {
		grid-area: profile;
	}

	.container-records {
		grid-area: records;
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