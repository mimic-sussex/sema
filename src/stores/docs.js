import { writable, readable, get } from "svelte/store";


export let links = writable([]);
export let chosenDocs = writable();