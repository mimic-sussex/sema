import { writable, readable, get } from "svelte/store";

export let screenSettings = writable(false);
export let environmentSettings = writable(false);
export let engineSettings = writable(false);