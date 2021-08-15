import { writable } from 'svelte/store';

export const user = writable(null);

export const loggedIn = writable(false);

export const loading = writable(false);
export const userName = writable('');
export const websiteURL = writable('');
export const avatarURL = writable('');
export const avatarSrc = writable(null);

export const records = writable(null);