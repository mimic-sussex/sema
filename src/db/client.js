import { createClient } from '@supabase/supabase-js'

const supabaseUrl = __api.env.SUPABASE_URL
const supabaseAnonKey = __api.env.SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const updatePlayground = async (uuid, name, content) => {
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