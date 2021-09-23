import { writable } from 'svelte/store';

export const user = writable(null);

export const loggedIn = writable(false);

export const loading = writable(false); // store value used when loading profile, used in html to log Loading... if true or display content if false.
export const userName = writable('');
export const websiteURL = writable('');
export const avatarURL = writable('');
export const avatarSrc = writable(null);

export const records = writable(null);