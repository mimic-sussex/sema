import { writable } from 'svelte/store';

export const currentUser = writable(null);

export const loggedIn = writable(false);