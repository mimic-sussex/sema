import { get, writable } from "svelte/store";

function persist(key, value) {
	sessionStorage.setItem(key, JSON.stringify(value));
}

export function writableSession(key, initialValue) {
	const sessionValue = JSON.parse(sessionStorage.getItem(key));

	if (!sessionValue) persist(key, initialValue);

	const store = writable(sessionValue || initialValue);

	const { set: realSet, subscribe, update: realUpdate } = store;

	return {
		set(value) {
			realSet(value);
			persist(key, value);
		},
		subscribe,
		update(fn) {
			realUpdate(fn);
			persist(key, get(store));
		}
	};
}
