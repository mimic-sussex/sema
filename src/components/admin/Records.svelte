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

</script>

<style>


</style>

<div class='container-records'>
	<ul>
		{#each records as record}
			<li>
				<a href="playground">
				{record.name} – {record.updated} — {( record.isPublic ? "Public": '' )}
				</a>
			</li>
	{/each}
	</ul>
</div>