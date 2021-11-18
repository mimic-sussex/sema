import { writable, readable, get } from "svelte/store";


// persist the playground ID for the naviagtion bar
export let persistentUUID = writable({playgroundId: ''});