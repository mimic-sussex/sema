<script>

	let records = [
		{ name: "record1", updated: Date.now(), isPublic: true, },
		{ name: "record1", updated: Date.now(), isPublic: true, },
		{ name: "record1", updated: Date.now() },
		{ name: "record1", updated: Date.now() },
		{ name: "record1", updated: Date.now() },
		{ name: "record1", updated: Date.now(), isPublic: true, },
		{ name: "record1", updated: Date.now() },
		{ name: "record1", updated: Date.now() },
		{ name: "record1", updated: Date.now(), isPublic: true, },
		{ name: "record1", updated: Date.now() },
	]

	const getDateStringFormat = d => (new Date(d)).toISOString().slice(0, 19).replace(/-/g, "/").replace("T", " ");


</script>

<style>


</style>

<div class='container-records'>
	<ul>
		{#each records as record}
			<li>
				<a href="playground"> <p><strong>{ record.name } </strong></p></a>
				last updated: { getDateStringFormat(record.updated) } {( record.isPublic ? " — Public": '' )}
			</li>
	{/each}
	</ul>
</div>