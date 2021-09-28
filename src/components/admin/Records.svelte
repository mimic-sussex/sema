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

	$: $records = getAllProjects();//fetchRecords(); //promise is reactive to changes in url docId and links since they load asynchrynously

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
					isPublic,
					author (
						username
					)
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
					isPublic,
					author (
						username
					)
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

table {
	width:100%;
}

</style>

<button on:click={getMyProjects} >My Projects</button>
<button on:click={getAllProjects}>Browse Projects</button>

<div class='container-records'>
	
		
	{#await $records }
		<p>...waiting</p>
	{:then $records }
		{#if $records != null}
			<table>
				<tr>
					<th>Name</th>
					<th>Visibility</th>
					<th>Author</th>
					<th>Updated</th>
					<th>Options</th> <!--Fork or delete (depending on permissions)-->
				</tr>

				{#each $records as record }
					<tr>

						<td>
						<a href="playground/{ record.id }"
								on:click={ setPlaygroundFromRecord(record) }
								>
								<span class='record-name'
								>{ record.name }
								</span>
						</td>
					
					
					<td>
						{( record.isPublic ? "Public": 'Private' )}
					</td>

					<td>
						{#if record.author}
							{#if record.author.username}
								{record.author.username}
							{/if}
						{/if}
					</td>

					<td>
						{ getDateStringFormat(record.updated) }
					</td>

					<td>
						<button>Fork</button>
					</td>

				</tr>

					
				{/each}
			</table>

		{:else}
			<p style="color: red">No projects yet. Go to the playground and make one!</p>
		{/if}
	{:catch error}
		<p style="color: red">promise not fulfilled</p>
	{/await}

</div>