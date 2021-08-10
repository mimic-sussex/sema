<script>

	let records = [
		{ name: "Rachmaninoff electro", updated: Date.now(), isPublic: true, },
		{ name: "in C", updated: Date.now(), isPublic: true, },
		{ name: "quad modulators", updated: Date.now() },
		{ name: "piano—phase—copy", updated: Date.now() },
		{ name: "loops", updated: Date.now() },
		{ name: "As I awake, I fell into the abyss", updated: Date.now(), isPublic: true, },
		{ name: "ALGORAVE", updated: Date.now() },
		{ name: "semibreve-demos", updated: Date.now() },
		{ name: "record1", updated: Date.now(), isPublic: true, },
		{ name: "record1", updated: Date.now() },
	]

	const getDateStringFormat = d => (new Date(d)).toISOString().slice(0, 19).replace(/-/g, "/").replace("T", " ");


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
	<ul>
		{#each records as record}
			<li class='record'>
				<a href="playground">
					<span class='record-name'
								>{ record.name }
					</span>
				</a>
				last updated: { getDateStringFormat(record.updated) } {( record.isPublic ? " — Public": '' )}
			</li>
	{/each}
	</ul>
</div>