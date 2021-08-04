import { writable, readable, get } from "svelte/store";

let docsLandingPage = './about'; // when /docs is loaded the welcome page should be displayed.

export let links = writable([]);
export let chosenDocs = writable(docsLandingPage);
export let hashSection = writable("");