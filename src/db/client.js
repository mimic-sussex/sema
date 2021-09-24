import { createClient } from '@supabase/supabase-js'

const supabaseUrl = __api.env.SUPABASE_URL
const supabaseAnonKey = __api.env.SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
console.log("supabase!", supabase);

export async function getUserProfile() {
  try {
	const user = supabase.auth.user()
	console.log("Current User: " ,user);
	if (user == null){
		console.warn("no user data available, no one is logged in probably.");
		return null;
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

export const createPlayground = async () => {
	if(supabase){
		const timestamp = new Date().toISOString()
		let newPlayground;
		try {
			newPlayground = await supabase
				.from('playgrounds')
				.insert({
					name: 'new playground',
					content: [],
					created: timestamp,
					updated: timestamp,
					isPublic: true,
				})
				.single()

				console.log('newPlayground')
				console.log(newPlayground)
				return newPlayground.data;
		} catch (error) {
			console.error(error)
		}
	}
	else
		throw new Error('Supabase client has not been created')
}

export const updatePlayground = async (uuid, name, content) => {
	console.log("updating playground", supabase);
	console.log("name",name);
	console.log("content", content);
	if(supabase && name && content){
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
	else
		throw new Error('Supabase client has not been created')
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