<script>

	import { onMount } from 'svelte';


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

	let records = [];
	// records = [
	// 	{ uuid: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', name: "Rachmaninoff electro", updated: Date.now(), isPublic: true, },
	// 	{ uuid: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', name: "in C", updated: Date.now(), isPublic: true, },
	// 	{ uuid: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', name: "quad modulators", updated: Date.now() },
	// 	{ uuid: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', name: "piano—phase—copy", updated: Date.now() },
	// 	{ uuid: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15', name: "loops", updated: Date.now() },
	// 	{ uuid: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a16', name: "As I awake, I fell into the abyss", updated: Date.now(), isPublic: true, },
	// 	{ uuid: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a17', name: "ALGORAVE", updated: Date.now() },
	// 	{ uuid: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a18', name: "semibreve-demos", updated: Date.now() },
	// 	{ uuid: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a19', name: "record1", updated: Date.now(), isPublic: true, },
	// 	{ uuid: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a10', name: "record1", updated: Date.now() },
	// ]

	const setPlaygroundFromRecord = record => {

		try {
			$name = record.name;
			$uuid = record.id;
			console.log(record.content);
			// console.log(JSON.parse(record.content));
			$items = record.content.map(item => hydrateJSONcomponent(item));
			// console.log(record.content);
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

	$: records = fetchRecords(); //promise is reactive to changes in url docId and links since they load asynchrynously

	onMount ( async () => {

	})

</script>

<style>

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


<div class='container-records'>
	{#await records}
    <p>...waiting</p>
  {:then records}
		<ul>
			{#each records as record}
				<li class='record'>
					<a href="playground/{record.id}"
							on:click={ setPlaygroundFromRecord(record) }
							>
						<span class='record-name'
									>{ record.name }
						</span>
					</a>
					last updated: { getDateStringFormat(record.updated) } {( record.isPublic ? " — Public": '' )}
				</li>
		{/each}
		</ul>
	{:catch error}
    <p style="color: red">no records</p>
  {/await}
</div>