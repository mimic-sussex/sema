import { writable } from 'svelte/store';

export const user = writable(null);

export const loggedIn = writable(false);

export const loading = writable(false);
export const username = writable('');
export const website = writable('');
export const avatar_url = writable('');
export const avatarSrc = writable(null);