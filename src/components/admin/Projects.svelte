<script>

	import { onMount } from 'svelte';
	import { slide } from 'svelte/transition';
	import { isActive, url, goto } from "@roxi/routify";
	import ContentLoader from 'svelte-content-loader';

	import {
		records,
		user
	} from '../../stores/user'

  import { supabase, forkPlayground, deletePlayground } from '../../db/client'

	import Share from '../../components/overlays/Share.svelte';

  import {
		isSaveOverlayVisible,
		isShareOverlayVisible,
		isProjectBrowserOverlayVisible,
		hydrateJSONcomponent,
    loadEnvironmentSnapshotEntries,
		items,
		name,
		uuid,
		allowEdits,
		author
	} from "../../stores/playground.js"

	let loading = true;
	let projectPage = 'my-projects';
	if (!$user) projectPage = 'example-projects';

	let orderBy = {col:'updated', ascending:false}; //column to order by, by default when it was updated.
	let projectLoadStep = 8;
	let projectLoadRange = {start:0, end:projectLoadStep};
	let totalProjectNum = 0;

	//ID of project that user clicks to share
	let shareID = $uuid; //set it to $uuid by default;

	const getDateStringFormat = d => (new Date(d)).toISOString().slice(0, 19).replace(/-/g, "/").replace("T", " ");

	// $: $records = getAllProjects();//fetchRecords();
	$: updateProjectPage(projectPage, orderBy); //reactive statement reacts to changes in projectPage variable
	$: getTotalNumProjects(projectPage);


	onMount ( async () => {
		
	});

		//updates which list of projects is on display (my projects or all projects)
		const updateProjectPage = async (projectPage, orderBy) => {
		loading = true;
		console.log("Updating project page", projectPage, "ordering by", orderBy);
		if (projectPage == 'my-projects'){
			// console.log('refreshing my-projects page', projectPage)
			await getMyProjects();
		} else if (projectPage == 'all-projects'){
			// console.log('refreshing all-projects page', projectPage)
			await getAllProjects();
		} else if (projectPage == 'example-projects'){
			console.log('getting example projects')
			await getExampleProjects();
		}
		loading = false;
	}


	//get all the projects of the current user from the database
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
						username,
						id
					),
					allowEdits
				`)
			.eq('author', user.id)
			.range(projectLoadRange.start, projectLoadRange.end)
			.order(orderBy.col, {ascending:orderBy.ascending})
			
			$records = playgrounds.data;
			console.log('$records', $records);
		} catch(error){
			console.error(error)
		}
		
	}


	//get all public projects in the database
	const getAllProjects = async () => {
		try {

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
						username,
						id
					),
					allowEdits
				`)
			.eq('isPublic', true)
			.range(projectLoadRange.start, projectLoadRange.end)
			.order(orderBy.col, {ascending:orderBy.ascending})
			
			$records = playgrounds.data;
		} catch(error){
			console.error(error)
		}
	}

	const getExampleProjects = async () => {
		try {

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
						username,
						id
					),
					allowEdits,
					example
				`)
			.match({"isPublic": true, example: true})
			.range(projectLoadRange.start, projectLoadRange.end)
			.order(orderBy.col, {ascending:orderBy.ascending})
			
			$records = playgrounds.data;
		} catch(error){
			console.error(error)
		}
	}


	const forkProject = async (id) => {
		console.log("Forking project", id);
		let fork = await forkPlayground(id);
		console.log("new fork id", fork.id);
		$goto(`/playground/${fork.id}`);
		// updateProjectPage(projectPage);
	}

	const shareProject = async (id) => {
		console.log(id);
		// navigator.clipboard.writeText(`https://dev.sema.codes/playground/${id}`);
		shareID = id;
		$isShareOverlayVisible = true;
		// window.alert("Project ID copied");
	}

	const deleteProject = async (id) => {
		await deletePlayground(id);
		updateProjectPage(projectPage);
	}

	const toggleVisibility = async (id, state) => {

		try {
			const user = supabase.auth.user()

			const playground = await supabase
				.from('playgrounds')
				.update({isPublic: state})
				.match({id: id, author: user.id})
			

			updateProjectPage(projectPage);
		
		}
		catch(error){
			console.error(error)
		}
	}

	// Not allowing users to toggle allow edits until Realtime is set up
	// const toggleAllowEdits = async (id, state) => {
	// 	try {
	// 		const user = supabase.auth.user()

	// 		const playground = await supabase
	// 			.from('playgrounds')
	// 			.update({allowEdits: state})
	// 			.match({id: id, author: user.id})
			
	// 		updateProjectPage(projectPage);
	// 	}
	// 	catch(error){
	// 		console.error(error)
	// 	}
	// }

	//calculate the next range of 
	const getNextProjects = async () => {

		totalProjectNum = await getTotalNumProjects(projectPage);

		console.log("DEBUG: get next projects");
		// projectLoadRange.start += 8;
		// projectLoadRange.end += 8;

		let step = projectLoadStep;

		let newStart = projectLoadRange.start + step
		// if ( newStart > totalProjectNum - step ){
		// 	newStart = totalProjectNum - step;
		// }
		projectLoadRange.start = newStart;
		
		let newEnd = projectLoadRange.end + step;
		let currentPageNum =+ 1
		let newPageNum = currentPageNum + 1
		if (newEnd > totalProjectNum){
			newEnd = totalProjectNum;
			newPageNum = currentPageNum; //dont change page num
		}
		projectLoadRange.end = newEnd
		currentPageNum = newPageNum

		console.log(projectLoadRange)
		
		console.log("totalProjects", totalProjectNum)
		updateProjectPage(projectPage);
	}

	const getPreviousProjects = async () => {
		console.log("DEBUG: get previous projects")
		let step = projectLoadStep;

		let newStart = projectLoadRange.start - step
		if ( newStart < 0 ){
			newStart = 0; //hard limit is 0
		}
		projectLoadRange.start = newStart

		let newEnd = projectLoadRange.end - step;
		if (newEnd < projectLoadRange.start + step){
			newEnd = projectLoadRange.start + step;
		}
		projectLoadRange.end = newEnd

		console.log(projectLoadRange)
		totalProjectNum = await getTotalNumProjects(projectPage);
		
		updateProjectPage(projectPage);
	}

	const getTotalNumProjects = async (projectPage) => {

		if (projectPage == 'my-projects'){
			const user = supabase.auth.user()

			const { data, count } = await supabase
				.from('playgrounds')
				.select('*', { count: 'exact' })
				.eq('author', user.id)
				// console.log('data my-projects', data);
				// console.log(data.length, count);
				totalProjectNum = count;
				return count;
		}
		else if (projectPage == 'all-projects') {
			const { data, count } = await supabase
				.from('playgrounds')
				.select('*', { count: 'exact' })
				.eq('isPublic', true);
				// console.log(data.length, count);
				// console.log('data all-projects', data);

				totalProjectNum = count;
				return count;
		} else if (projectPage == 'example-projects'){
			const { data, count } = await supabase
				.from('playgrounds')
				.select('*', { count: 'exact' })
				.match({"isPublic": true, example: true})
				totalProjectNum = count;
				return count;
		}
	}

</script>

<style>

.container-records {
	/* overflow: auto; */
	width: 100%;
	height: 80%;
	margin-bottom: 20px;
	/* background-color: #333; */
}

.page-controls-container{
	display:flex;
	/* position:fixed;
	bottom: 0; */
	width: 100%;
	border-top: 1px solid #ccc;
	justify-content: space-between;
}

.record-name {
	display: inline-block;
	/* font-style: italic; */
	/* font-weight: bold; */
	font-size: medium;
	padding-right: 0.5em;
	min-width: 20rem;
	max-width: 20rem;
}

.record {
	margin-bottom: 0.5em;
}


table {
	width:100%;
	border-collapse: collapse;
}

th {
	text-align:left;
	color: #ccc;
	font-size:18px;
	padding: 10px;
	text-align:center;
}

td {
	text-align:center;
}

tr:nth-child(even) {background: #212121}
tr:nth-child(odd) {background: #151515}

.table-header:hover {
	cursor: pointer;
}

.record-entry:hover {
	background-color: #333;
}

input[type=radio] {
  float: left;
  clear: none;
  margin: 2px 0 0 2px;
}

label {
	float: left;
	clear: none;
	display: block;
	padding: 0px 1em 0px 8px;
}

.file-name {
 color: white;
}

.dropdown {
  float: center;
  overflow: hidden;
}
.dropdown .dropbtn {
  font-size: 16px;  
  border: none;
  outline: none;
  color: white;
  padding: 14px 16px;
  background-color: inherit;
  font-family: inherit;
  margin: 0;
	/* display: block;
	margin: auto; */
}
.dropdown-content {
  display: none;
  position: absolute;
  background-color: #282828;
  min-width: 160px;
  box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.2);
  z-index: 1;
}

.dropdown-content a {
  float: none;
  color: #f9f9f9;
  padding: 12px 16px;
  text-decoration: none;
  display: block;
  text-align: left;
}

.dropdown-content a:hover {
  background-color: #404040;
}

.dropdown:hover .dropdown-content {
  display: block;
}

.dropdown:hover .dropbtn {
	background-color: #282828;
}

.toggle-icon:hover {
	cursor:pointer;
	fill: #282828;
}

.container-project-filter {
	/* display: inline-block; */
	width:100%;
	border-bottom: 1px solid #ccc;
	font-size:18px;
}

.project-tab {

}

button {
	background: none;
	border: none;
	/* border-bottom: 1px solid white; */
	border-radius: 0;
	margin: 0;
	color: #ccc;
}

.project-tab-selected {
	border-bottom: 3px solid #ccc;
	color: white;
	/* background-color: red; */
}

.svg-icon-div {
	
	/* white-space:nowrap;
	overflow: hidden; */
	/* display: flex; */
	float: right;
	display: inline-flex;
  align-self: center;
	/* text-align: right; */
}

.fork-icon {
	fill: grey;
}

.share-icon {
	fill: grey;
}

.delete-icon {
	fill: grey;
}

.overlay-container {
	z-index: 1000;
	background-color: rgba(16,12,12,0.8);
	visibility: hidden;
	width: 100%;

	/* display:flex; */
	/* justify-content:center;
	align-items:center; */
	font-size:16px;
}

.loading-bar {
	padding: 14px 16px;
}

</style>
<!-- 
<button on:click={getMyProjects} >My Projects</button>
<button on:click={getAllProjects}>Browse Projects</button> -->

<!-- <p>{projectPage} selected</p> -->

<div class="container-project-filter">
	<!-- <input type="radio" id="my-projects-radio" name="project-filter" value="my-projects" bind:group={projectPage}>
	<label for="my-projects-radio">My Projects</label>
	<input type="radio" id="all-projects-radio" name="project-filter" value="all-projects" bind:group={projectPage}>
	<label for="my-projects-radio">Browse All Projects</label> -->
	
	{#if $user}
		<button class:project-tab-selected={projectPage == "my-projects"} on:click={() => {projectPage = "my-projects"; projectLoadRange = {start:0, end:projectLoadStep};}}>My Playgrounds</button>
	{/if}
	<button class:project-tab-selected={projectPage == "all-projects"} on:click={() => {projectPage = "all-projects"; projectLoadRange = {start:0, end:projectLoadStep};}}>All Playgrounds</button>
	<button class:project-tab-selected={projectPage == "example-projects"} on:click={() => {projectPage = "example-projects"; projectLoadRange = {start:0, end:projectLoadStep};}}>Examples</button>

</div>


<div class='container-records'>	
	{#if loading}
		<table>

			<tr>
				<th>Name</th>
				
				<th>Visibility</th>

				<th>Author</th>

				<th>Updated</th>

				<th>Options</th>
			</tr>
			
			{#each Array(projectLoadStep) as _, i}
				<tr class="record-entry">
					<td>
						<div class='loading-bar'>
						<ContentLoader primaryColor='#404040' secondaryColor='#ccc' speed={0.4} width="350" height="16">
							<rect x="0" y="0" rx="3" ry="3" width="342" height="16" />
						</ContentLoader>
					</div>
					</td>
					<td>
						<div class='loading-bar'>
						<ContentLoader primaryColor='#404040' secondaryColor='#ccc' speed={0.4} width="16" height="16">
							<rect x="0" y="0" rx="3" ry="3" width="16" height="16" />
						</ContentLoader>
					</div>
					</td>
					<td>
						<div class='loading-bar'>
						<ContentLoader primaryColor='#404040' secondaryColor='#ccc' speed={0.4} width="50" height="16">
							<rect x="0" y="0" rx="3" ry="3" width="50" height="16" />
						</ContentLoader>
					</div>
					</td>
					<td>
						<div class='loading-bar'>
						<ContentLoader primaryColor='#404040' secondaryColor='#ccc' speed={0.4} width="90" height="16">
							<rect x="0" y="0" rx="3" ry="3" width="90" height="16" />
						</ContentLoader>
					</div>
					</td>
					<td>
						<div class='loading-bar'>
						<ContentLoader primaryColor='#404040' secondaryColor='#ccc' speed={0.4} width="16" height="16">
							<rect x="0" y="0" rx="3" ry="3" width="16" height="16" />
						</ContentLoader>
					</div>
					</td>
				</tr>
			{/each}

		</table>
	{:else }

		<div class="overlay-container">
			{#if $isShareOverlayVisible}
				<Share id={shareID}/>
			{/if}
		</div>
			
		{#await $records }
			<p>...waiting</p>
		{:then $records }
			{#if $records != null}
				<table>

					<tr>
						<th 
						class="table-header" 
						on:click={() => {orderBy = {col:'name', ascending:true }} }
						>Name</th>
						
						<th 
						class="table-header" 
						on:click={()=>{orderBy = {col:'isPublic', ascending:true }}} 
						>Visibility</th>
						
						<!-- <th 
						class="table-header" 
						on:click={()=>{orderBy = {col:'allowEdits', ascending:true }}} 
						>Allow edits</th> -->

						<th 
						class="table-header" 
						on:click={()=>{orderBy = {col:'author', ascending:true }}}
						>Author</th>

						<th class="table-header" 
						on:click={()=>{orderBy = {col:'updated', ascending:false }}}
						>Updated</th>

						<th>Options</th> <!--Fork or delete (depending on permissions)-->
					</tr>

					{#each $records as record }
						<tr class="record-entry">
							<td>
							<a class="file-name" 
							href="{( $isActive(`/playground`) )? `${record.id}` : `playground/${record.id}`}"
							on:click={() => {$isProjectBrowserOverlayVisible = false} }
									>
									<span class='record-name' style='text-align:left;'
									>{ record.name }
									</span>
							</td>

							<td>
								<!-- {( record.isPublic ? "Public": 'Private' )} -->
								{#if record.isPublic }
									<svg xmlns="http://www.w3.org/2000/svg" 
									width="16" 
									height="16" 
									fill="currentColor" 
									class="toggle-icon" 
									viewBox="0 0 16 16" 
									on:click={toggleVisibility(record.id, false)}>
										<title>Public. This project will appear in the 'All Projects' tab.</title>
										<path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm7.5-6.923c-.67.204-1.335.82-1.887 1.855A7.97 7.97 0 0 0 5.145 4H7.5V1.077zM4.09 4a9.267 9.267 0 0 1 .64-1.539 6.7 6.7 0 0 1 .597-.933A7.025 7.025 0 0 0 2.255 4H4.09zm-.582 3.5c.03-.877.138-1.718.312-2.5H1.674a6.958 6.958 0 0 0-.656 2.5h2.49zM4.847 5a12.5 12.5 0 0 0-.338 2.5H7.5V5H4.847zM8.5 5v2.5h2.99a12.495 12.495 0 0 0-.337-2.5H8.5zM4.51 8.5a12.5 12.5 0 0 0 .337 2.5H7.5V8.5H4.51zm3.99 0V11h2.653c.187-.765.306-1.608.338-2.5H8.5zM5.145 12c.138.386.295.744.468 1.068.552 1.035 1.218 1.65 1.887 1.855V12H5.145zm.182 2.472a6.696 6.696 0 0 1-.597-.933A9.268 9.268 0 0 1 4.09 12H2.255a7.024 7.024 0 0 0 3.072 2.472zM3.82 11a13.652 13.652 0 0 1-.312-2.5h-2.49c.062.89.291 1.733.656 2.5H3.82zm6.853 3.472A7.024 7.024 0 0 0 13.745 12H11.91a9.27 9.27 0 0 1-.64 1.539 6.688 6.688 0 0 1-.597.933zM8.5 12v2.923c.67-.204 1.335-.82 1.887-1.855.173-.324.33-.682.468-1.068H8.5zm3.68-1h2.146c.365-.767.594-1.61.656-2.5h-2.49a13.65 13.65 0 0 1-.312 2.5zm2.802-3.5a6.959 6.959 0 0 0-.656-2.5H12.18c.174.782.282 1.623.312 2.5h2.49zM11.27 2.461c.247.464.462.98.64 1.539h1.835a7.024 7.024 0 0 0-3.072-2.472c.218.284.418.598.597.933zM10.855 4a7.966 7.966 0 0 0-.468-1.068C9.835 1.897 9.17 1.282 8.5 1.077V4h2.355z"/>
									</svg>
								{:else}
									<svg xmlns="http://www.w3.org/2000/svg" 
									width="16" 
									height="16" 
									fill="currentColor" 
									class="toggle-icon" 
									viewBox="0 0 16 16" 
									on:click={toggleVisibility(record.id, true)}>
										<title>Private. This project will only appear in the 'My Projects' tab.</title>
										<path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM5 8h6a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/>
									</svg>
								{/if}
							</td>

							<!-- <td>
								{#if record.allowEdits}
									<svg xmlns="http://www.w3.org/2000/svg" 
									width="16" 
									height="16" 
									fill="currentColor" 
									class="toggle-icon" 
									viewBox="0 0 16 16"
									on:click={toggleAllowEdits(record.id, false)}
									>
										<title>True. Anyone with the link can edit this project.</title>
										<path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
										<path d="M10.97 4.97a.235.235 0 0 0-.02.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-1.071-1.05z"/>
									</svg>
								{:else}
									<svg xmlns="http://www.w3.org/2000/svg" 
									width="16" 
									height="16" 
									fill="currentColor" 
									class="toggle-icon" 
									viewBox="0 0 16 16"
									on:click={toggleAllowEdits(record.id, true)}
									>
										<title>False. Only the author may edit this project.</title>
										<path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
										<path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
									</svg>
								{/if}
							</td> -->

							<td>
								{#if record.author}
									{#if record.author.username}
										{record.author.username}
									{:else}
										No Username
									{/if}
								{/if}
							</td>

							<td>
								{ getDateStringFormat(record.updated) }
							</td>

							<td>
								<!-- <button>Fork</button> -->
								
								<div class="dropdown">
									<button class="dropbtn">

										<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="settings-icon" viewBox="0 0 16 16">
											<path fill-rule="evenodd" d="M11.5 2a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM9.05 3a2.5 2.5 0 0 1 4.9 0H16v1h-2.05a2.5 2.5 0 0 1-4.9 0H0V3h9.05zM4.5 7a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM2.05 8a2.5 2.5 0 0 1 4.9 0H16v1H6.95a2.5 2.5 0 0 1-4.9 0H0V8h2.05zm9.45 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm-2.45 1a2.5 2.5 0 0 1 4.9 0H16v1h-2.05a2.5 2.5 0 0 1-4.9 0H0v-1h9.05z"/>
										</svg>

									</button>
									<div class="dropdown-content">

										<!-- only show fork button if the user is logged in -->
										{#if $user}
											<a href={'#'} on:click={forkProject(record.id)}>Fork
												<div class="svg-icon-div">
													<svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="fork-icon">
														<path fill-rule="evenodd" d="M5 3.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm0 2.122a2.25 2.25 0 10-1.5 0v.878A2.25 2.25 0 005.75 8.5h1.5v2.128a2.251 2.251 0 101.5 0V8.5h1.5a2.25 2.25 0 002.25-2.25v-.878a2.25 2.25 0 10-1.5 0v.878a.75.75 0 01-.75.75h-4.5A.75.75 0 015 6.25v-.878zm3.75 7.378a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm3-8.75a.75.75 0 100-1.5.75.75 0 000 1.5z"></path>
													</svg>
												</div>
											</a>
										{/if}
										
										<a href={'#'} on:click={shareProject(record.id)}>Share
											<div class="svg-icon-div">
												<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="share-icon" viewBox="0 0 16 16">
													<path d="M13.5 1a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM11 2.5a2.5 2.5 0 1 1 .603 1.628l-6.718 3.12a2.499 2.499 0 0 1 0 1.504l6.718 3.12a2.5 2.5 0 1 1-.488.876l-6.718-3.12a2.5 2.5 0 1 1 0-3.256l6.718-3.12A2.5 2.5 0 0 1 11 2.5zm-8.5 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm11 5.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/>
												</svg>
											</div>
										</a>
										<!-- Only show delete button if the logged in user is the author-->
										{#if $user}
											{#if record.author.id == $user.id}
												<a href={'#'} on:click={deleteProject(record.id)}>Delete
													<div class="svg-icon-div">
														<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="delete-icon" viewBox="0 0 16 16">
															<path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
															<path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
														</svg>
													</div>
												</a>
											{/if}
										{/if}
									</div>
								</div> 


							</td>

					</tr>

						
					{/each}
				</table>

				<div class='page-controls-container'>
					<a href={'#'} on:click={getPreviousProjects} 
					style="{( projectLoadRange.start <= 0 )? `visibility:collapse;`: `visibility:visible`}; color:#ccc;">Previous</a>

					<span style='float:center; color:#ccc'>
						Page { Math.ceil(projectLoadRange.end / projectLoadStep) } of { Math.ceil(totalProjectNum / projectLoadStep)} | Total number of projects: {totalProjectNum} 
					</span>
					<a href={'#'} on:click={getNextProjects}
					style="{( projectLoadRange.end >= totalProjectNum )? `visibility:collapse;`: `visibility:visible`}; color:#ccc;">Next</a>
				</div>
				<!-- <button on:click={() => blah}>Previous Page</button> -->
				<!-- <button on:click={() => getNextProjects}>Next Page</button> -->

			{:else}
				<p style="color: red">No projects yet. Go to the playground and make one!</p>
			{/if}
		{:catch error}
			<p style="color: red">promise not fulfilled</p>
		{/await}

	{/if}
</div>