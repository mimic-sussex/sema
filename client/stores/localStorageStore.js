import { writable as internal, get } from "svelte/store";

/* 
 * Wrap writable store
 */
export function writable(key, initialValue) { 
	
	const store = internal(initialValue);  // create an underlying store

	const { subscribe, set, update } = store;
	
	const json = localStorage.getItem(key); // get the last value from localStorage

	if (json) {
    console.log(JSON.parse(json));
		set(JSON.parse(json)); // use the value from localStorage if it exists    
	}

	// return an object with the same interface as svelte's writable()
	return {
		set(value) {
			localStorage.setItem(key, JSON.stringify(value));
			set(value); // capture set and write to localStorage
		},

		update(cb) {
			const value = cb(get(store));
			this.set(value); // capture updates and write to localStore
		},

		subscribe // punt subscriptions to underlying store
	};
}
