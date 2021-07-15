import { writable } from 'svelte/store'
// import createAuth0Client from "@auth0/auth0-spa-js"

// const AUTH_CONFIG = {
// 	domain: 'sema-codes.eu.auth0.com',
// 	client_id: 'zExT5OxP0t8IGirIUHaXcMDCTlNpGGbN',
// 	cacheLocation: 'localstorage',
// }

// export const authStore = createAuthStore()

function createAuthStore() {
    const loading = writable(true)
    const authenticated = writable(false)
    const user = writable(null)
    let auth0 = null


    async function init(){
        auth0 = await createAuth0Client(AUTH_CONFIG)

        // update store
        user.set(await auth0.getUser())
        loading.set(false)
        authenticated.set(true)
    }

    async function signin() {
        //display popup
        await auth0.loginWithPopup()

        //update store
        user.set(await auth0.getUser())
        authenticated.set(true)
    }

    async function signout() {
        // logout
        await auth0.logout()

        // update store
        user.set(await auth0.getUser())
        authenticated.set(false)
    }

    return { loading, authenticated, user, auth0, signin, signout, init }
}



import { supabase } from '../db/client.js'
// import { user } from '../../stores/auth.js'

export let loading = writable('')
export let username = writable('')
export let website = writable('')
export let avatar_url = writable('')


export async function init() {
	// auth0 = await createAuth0Client(AUTH_CONFIG)
	// // update store
	// user.set(await auth0.getUser())
	// loading.set(false)
	// authenticated.set(true)
}


export async function getProfile() {
	try {
		loading = true
		const user = supabase.auth.user()
		let { data, error, status } = await supabase
			.from('profiles')
			.select(`username, website, avatar_url`)
			.eq('id', user.id)
			.single()
		if (error && status !== 406) throw error
		if (data) {
			username = data.username
			website = data.website
			avatar_url = data.avatar_url
		}
	} catch (error) {
		alert(error.message)
	} finally {
		loading = false
	}
}

export async function updateProfile() {
	try {
		loading = true
		const user = supabase.auth.user()
		const updates = {
			id: user.id,
			username,
			website,
			avatar_url,
			updated_at: new Date(),
		}
		let { error } = await supabase.from('profiles').upsert(updates, {
			returning: 'minimal', // Don't return the value after inserting
		})
		if (error) throw error
	} catch (error) {
		alert(error.message)
	} finally {
		loading = false
	}
}

export async function signOut() {
	try {
		loading = true
		let { error } = await supabase.auth.signOut()
		if (error) throw error
	} catch (error) {
		alert(error.message)
	} finally {
		loading = false
	}
}

export async function signIn() {
	const { user, session, error } = await supabase.auth.signIn({
		provider: 'google',
	})
	const { user1, session1, error1 } = await supabase.auth.signIn({
		provider: 'github',
	})
	const { user2, session2, error2 } = await supabase.auth.signIn({
		provider: 'github',
	})
}