<script>

	import { onMount } from 'svelte';

	import {
		records
	} from '../../stores/user'

  import { supabase } from '../../db/client'

  import {
    isSaveOverlayVisible,
		hydrateJSONcomponent,
    loadEnvironmentSnapshotEntries,
		items,
		name,
		uuid
  } from "../../stores/playground.js"

	const getDateStringFormat = d => (new Date(d)).toISOString().slice(0, 19).replace(/-/g, "/").replace("T", " ");

	const setPlaygroundFromRecord = record => {
		try {
			$name = record.name;
			$uuid = record.id;
			$items = record.content.map(item => hydrateJSONcomponent(item));
		} catch (error) {
			console.error(error)
		}
	}

	const fetchRecords = async () => {
		try {
			const playgrounds = await supabase
				.from('playgrounds')
				.select(`
					id,
					name,
					content,
					created,
					updated,
					isPublic
				`)
			return playgrounds.data
		} catch (error) {
			console.error(error)
		}
	}

	$: $records = fetchRecords(); //promise is reactive to changes in url docId and links since they load asynchrynously
	
	onMount ( async () => {

	})
	
	const getMyProjects = async () => {

		try {
			const user = supabase.auth.user()
			
			const playgrounds = await supabase
			.from('playgrounds')
			.select(`
					id,
					name,
					content,
					created,
					updated,
					isPublic
				`)
			.eq('author', user.id)
			.order('updated', {ascending:true})

			$records = playgrounds.data;
		} catch(error){
			console.error(error)
		}
		
	}


	const getAllProjects = async () => {
		try {
			const user = supabase.auth.user()
			
			const playgrounds = await supabase
			.from('playgrounds')
			.select(`
					id,
					name,
					content,
					created,
					updated,
					isPublic
				`)
			.eq('isPublic', true)
			.order('updated', {ascending:true})

			$records = playgrounds.data;
		} catch(error){
			console.error(error)
		}
	}


</script>

<style>

.container-records {
	overflow: auto;
	width: 100%;
}

.record-name {
	display: inline-block;
	/* font-style: italic; */
	/* font-weight: bold; */
	font-size: 18px;
	padding-right: 0.5em;
	min-width: 20rem;
	max-width: 20rem;
}

.record {
	margin-bottom: 0.5em;


}
</style>

<button on:click={getMyProjects} >My Projects</button>
<button on:click={getAllProjects}>Browse Projects</button>

<div class='container-records'>
	
		
	{#await $records }
		<p>...waiting</p>
	{:then $records }
		{#if $records != null}
			<ul>
				{#each $records as record }
					<li class='record'>
						<a href="playground/{ record.id }"
								on:click={ setPlaygroundFromRecord(record) }
								>
							<span class='record-name'
										>{ record.name }
							</span>
						</a>
						last updated: { getDateStringFormat(record.updated) }
						{( record.isPublic ? " — Public": 'Private' )}
					</li>
			{/each}
			</ul>
		{:else}
			<p style="color: red">No projects yet! Navigate to the playground to make one.</p>
		{/if}
	{:catch error}
		<p style="color: red">promise not fulfilled</p>
	{/await}

</div>