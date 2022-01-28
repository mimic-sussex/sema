import { writable, readable, get } from "svelte/store";

// keep track of the state of these menus launchable from the sidebar. (if they are open or not);
export let liveCodeEditorMenuExpanded = writable(false);
export let modelEditorMenuExpanded = writable(false);
export let debuggersMenuExpanded = writable(false);