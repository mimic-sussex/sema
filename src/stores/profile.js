//profile page admin page

import { writable, readable, get } from "svelte/store";

export const isEditAccountOverlayVisible = writable(false);
export const isDeleteAccountOverlayVisible = writable(false);