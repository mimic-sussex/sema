<script>

	import { onMount } from 'svelte';
	import { slide } from 'svelte/transition';

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


	const forkProject = async (id) => {
		console.log("Forking project", id);
		//grab row to copy
		try {

			const user = supabase.auth.user() //get user to set new author id for fork

			const playground = await supabase
			.from('playgrounds')
			.select(`
					id,
					name,
					content,
					created,
					updated,
					isPublic,
					author
				`)
			.eq('id', id) //check if project id matches
			.single()


				const forkground = await supabase
					.from('playgrounds')
					.insert([
						{ 
							name: "Fork of " + playground.data.name, 
							content:playground.data.content, 
							created: playground.data.created,
							updated: playground.data.updated,
							isPublic: playground.data.isPublic,
							author:user.id
						}
					])
		} 
		catch(error){
			console.error(error)
		}
	}

	const shareProject = async (id) => {
		console.log(id);
		navigator.clipboard.writeText(id);
		window.alert("Project ID copied");
	}

	const deleteProject = async (id) => {
		console.log("deleting project with id", id);

		try {
			const user = supabase.auth.user()
			
			const playgrounds = await supabase
			.from('playgrounds')
			.delete()
			.match({'author': user.id, 'id': id})
		} catch(error){
			console.error(error)
		}
		//need to grab currently selected project list again
	}

	const toggleVisibility = async (id, state) => {

		try {
		const user = supabase.auth.user()

		const playground = await supabase
			.from('playgrounds')
			.update({isPublic: state})
			.match({id: id, author: user.id})
		}
		catch(error){
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

th {
	text-align:left
}

input[type=radio] {
  float: left;
  clear: none;
  margin: 2px 0 0 2px;
}

/* .container-project-filter {
	display: inline-block;
	width:100%;
} */

label {
	float: left;
	clear: none;
	display: block;
	padding: 0px 1em 0px 8px;
}
    
.dropdown {
  float: left;
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
}
.dropdown-content {
  display: none;
  position: absolute;
  background-color: #f9f9f9;
  min-width: 160px;
  box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.2);
  z-index: 1;
}

.dropdown-content a {
  float: none;
  color: black;
  padding: 12px 16px;
  text-decoration: none;
  display: block;
  text-align: left;
}

.dropdown-content a:hover {
  background-color: #ddd;
}

.dropdown:hover .dropdown-content {
  display: block;
}

.dropdown:hover .dropbtn {
	background-color: #282828;
}

.visibility-icon:hover {
	cursor:pointer;
}

</style>
<!-- 
<button on:click={getMyProjects} >My Projects</button>
<button on:click={getAllProjects}>Browse Projects</button> -->
<div class="container-project-filter">
	<input type="radio" id="my-projects-radio" name="project-filter" value="my-projects" on:click={getMyProjects}>
	<label for="my-projects-radio">My Projects</label>
	<input type="radio" id="all-projects-radio" name="project-filter" value="all-projects" checked on:click={getAllProjects}>
	<label for="my-projects-radio">Browse All Projects</label>
</div>

<div class='container-records' in:slide>
	
		
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
						<!-- {( record.isPublic ? "Public": 'Private' )} -->
						{#if record.isPublic}
							<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="visibility-icon" viewBox="0 0 16 16" on:click={toggleVisibility(record.id, false)}>
								<path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm7.5-6.923c-.67.204-1.335.82-1.887 1.855A7.97 7.97 0 0 0 5.145 4H7.5V1.077zM4.09 4a9.267 9.267 0 0 1 .64-1.539 6.7 6.7 0 0 1 .597-.933A7.025 7.025 0 0 0 2.255 4H4.09zm-.582 3.5c.03-.877.138-1.718.312-2.5H1.674a6.958 6.958 0 0 0-.656 2.5h2.49zM4.847 5a12.5 12.5 0 0 0-.338 2.5H7.5V5H4.847zM8.5 5v2.5h2.99a12.495 12.495 0 0 0-.337-2.5H8.5zM4.51 8.5a12.5 12.5 0 0 0 .337 2.5H7.5V8.5H4.51zm3.99 0V11h2.653c.187-.765.306-1.608.338-2.5H8.5zM5.145 12c.138.386.295.744.468 1.068.552 1.035 1.218 1.65 1.887 1.855V12H5.145zm.182 2.472a6.696 6.696 0 0 1-.597-.933A9.268 9.268 0 0 1 4.09 12H2.255a7.024 7.024 0 0 0 3.072 2.472zM3.82 11a13.652 13.652 0 0 1-.312-2.5h-2.49c.062.89.291 1.733.656 2.5H3.82zm6.853 3.472A7.024 7.024 0 0 0 13.745 12H11.91a9.27 9.27 0 0 1-.64 1.539 6.688 6.688 0 0 1-.597.933zM8.5 12v2.923c.67-.204 1.335-.82 1.887-1.855.173-.324.33-.682.468-1.068H8.5zm3.68-1h2.146c.365-.767.594-1.61.656-2.5h-2.49a13.65 13.65 0 0 1-.312 2.5zm2.802-3.5a6.959 6.959 0 0 0-.656-2.5H12.18c.174.782.282 1.623.312 2.5h2.49zM11.27 2.461c.247.464.462.98.64 1.539h1.835a7.024 7.024 0 0 0-3.072-2.472c.218.284.418.598.597.933zM10.855 4a7.966 7.966 0 0 0-.468-1.068C9.835 1.897 9.17 1.282 8.5 1.077V4h2.355z"/>
							</svg>
						{:else}
							<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="visibility-icon" viewBox="0 0 16 16" on:click={toggleVisibility(record.id, true)}>
								<path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM5 8h6a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/>
							</svg>
						{/if}
					</td>

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
								<a href="#" on:click={forkProject(record.id)}>Fork</a>
								<a href="#" on:click={shareProject(record.id)}>Share</a>
								<a href="#" on:click={deleteProject(record.id)}>Delete</a>
							</div>
						</div> 


					</td>

				</tr>

					
				{/each}
			</table>

			<button>New Project</button>

		{:else}
			<p style="color: red">No projects yet. Go to the playground and make one!</p>
		{/if}
	{:catch error}
		<p style="color: red">promise not fulfilled</p>
	{/await}

</div>