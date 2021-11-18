import { createClient } from '@supabase/supabase-js'

import { get } from "svelte/store";
import { items, saving, saveRequired } from "../stores/playground.js";

export function add() {
    var counterRef = get(counter);
    counter.set(counterRef + 1);
}

const supabaseUrl = __api.env.SUPABASE_URL
const supabaseAnonKey = __api.env.SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function getUserProfile() {
  try {
	const user = supabase.auth.user()
	// console.log("Current User: " ,user);
	if (user == null){
		console.warn("no user data available, no one is logged in probably.");
		return {username: null, website: null, avatar_url: null};
	}
	
    let { data, error, status } = await supabase
      .from('profiles')
      .select(`username, website, avatar_url`)
      .eq('id', user.id)
      .single()

    if (error && status !== 406) throw error
		return data
	}
	catch(error){
		console.error(error);
	}
}

export const checkUser = async () => {
	if (supabase){
		try {
			const user = supabase.auth.user() 
			return user;
		} catch (error) {
			console.error(error);
		}		
	}
}

export const createPlayground = async () => {
	if(supabase){
		const timestamp = new Date().toISOString()
		let newPlayground;

		try {
			const user = supabase.auth.user()
			try {
				newPlayground = await supabase
					.from('playgrounds')
					.insert({
						name: 'new playground',
						content: [],
						created: timestamp,
						updated: timestamp,
						isPublic: false,
						allowEdits: false,
						author: user.id
					})
					.single()
	
					console.log('newPlayground')
					console.log(newPlayground)
					return newPlayground.data;
			} catch (error) {
				console.error(error)
			}
		}
		catch(error){
			if (user == null){
				console.log('DEBUG: No user cant make playground');
			}else{
				console.error(error)
			}
		}
		
	}
	else
		throw new Error('Supabase client has not been created')
}

export const savePlayground = async (uuid, name, content, allowEdits, user) => {
	if (get(saveRequired)){
		await updatePlayground(uuid, name, content, allowEdits, user);
		// $saveRequired = false;
		saveRequired.set(false);
	}
}

// This can now be simplified since RLS and policies implemented on the playgrounds table
export const updatePlayground = async (uuid, name, content, allowEdits, user) => {
	// console.log("DEBUG: updatePlayground", uuid, name, content, allowEdits, user);
	if (supabase) {

		//check user exists. if it doesnt grab the current user
		if (!user){
			user = supabase.auth.user();
		}

		//if allow edits is true anyone can update.
		if (allowEdits){
			if(uuid && name && content){

				let savingRef = get(saving);
				saving.set(!savingRef);
				 
				let updatedPlayground
				try {
					updatedPlayground = await supabase
						.from('playgrounds')
						.update({
							name,
							content,
							updated: new Date().toISOString(),
						})
						.eq('id', uuid)
				} catch (error) {
					console.error(error)
				}
			}
		} 
		// only allow if the user is also the author of the project
		else if (allowEdits == false) {
			if(uuid && name && content){

				let savingRef = get(saving);
				saving.set(!savingRef);

				let updatedPlayground
				try {
					updatedPlayground = await supabase
						.from('playgrounds')
						.update({
							name,
							content,
							updated: new Date().toISOString(),
						})
						.match({'id': uuid, author: user.id});
						// .eq('author', user); //if author matches the user
				} catch (error) {
					if (user == null){
						//user doesnt exist (probably not logged in). dont update playground.
					} else { // might be some other error. log it.
						console.error(error)
					}
				}
			}
		}

		//setting svelte store
		let savingRef = get(saving);
		saving.set(false);
		 
	}
	else
		throw new Error('Supabase client has not been created')
}

//fetch playground data for a given uuid
export const fetchPlayground = async (uuid) => {

	if (supabase){
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
					author,
					allowEdits
				`)
				.eq('id', uuid)
				.single()

				return playgrounds.data;
	
		} catch (error) {
			console.error(error);
		}
	}	
	else
		throw new Error('Supabase client has not been created')


}

export const deletePlayground = async (id) => {
	console.log("Deleting project with id", id);
	try {
		const user = supabase.auth.user()
		
		const playgrounds = await supabase
		.from('playgrounds')
		.delete()
		.match({'author': user.id, 'id': id})

	} catch(error){
		console.error(error)
	}
}

export const forkPlayground = async (id) => {
	console.log("Forking project", id);
	
	if (supabase){
		const timestamp = new Date().toISOString()
		let forkground;

		try {
			const user = supabase.auth.user() //get user to set new author id for fork
			try {
				//get project to fork
				const playground = await supabase
				.from('playgrounds')
				.select(`
						id,
						name,
						content,
						created,
						updated,
						isPublic,
						author,
						allowEdits
					`)
				.eq('id', id) //check if project id matches
				.single()

				//make fork
				forkground = await supabase
					.from('playgrounds')
					.insert([
						{ 
							name: "Fork of " + playground.data.name, 
							content:playground.data.content, 
							created: timestamp,
							updated: timestamp,
							isPublic: playground.data.isPublic,
							author:user.id,
							allowEdits:playground.data.allowEdits
						}
					])
					.single();

					console.log("new fork");
					console.log(forkground);
					return forkground.data;
				} catch (error) {
					console.error(error);
				}
		} 
		catch(error){
			console.error(error);
		}
	} else
		throw new Error('Supabase client has not been created')
}

export const getExamplePlaygrounds = async () => {
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
				author,
				allowEdits,
				example
			`)
		.match({"isPublic": true, example: true})
		
		return playgrounds.data;
	} catch(error){
		console.error(error)
	}
}

export const updateSession = async (uuid, name, content) => {
	if(supabase && name && content){
		let updatedPlayground
		try {
			updatedPlayground = await supabase
				.from('sessions')
				.update({
					name,
					content,
					updated: new Date().toISOString(),
				})
				.eq('id', uuid)
		} catch (error) {
			console.error(error)
		}
	}
	else
		throw new Error('Supabase client has not been created')
}

export const deleteAccount = async() => {
	try {
		const user = supabase.auth.user()
		await supabase.rpc('delete_user', {useruuid: user.id})
		//then signout the user
		await supabase.auth.signOut()
	} catch (error){
		console.log(error)
	}
}