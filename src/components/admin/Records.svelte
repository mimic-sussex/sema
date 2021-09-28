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

								<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-sliders" viewBox="0 0 16 16">
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

		{:else}
			<p style="color: red">No projects yet. Go to the playground and make one!</p>
		{/if}
	{:catch error}
		<p style="color: red">promise not fulfilled</p>
	{/await}

</div>