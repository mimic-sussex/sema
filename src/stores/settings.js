import { writable, readable, get } from "svelte/store";

export let screenSettings = writable(false);
export let environmentSettings = writable(true);
export let engineSettings = writable(false);