import { get, writable } from "svelte/store";

import ModelEditor from "../components/editors/ModelEditor.svelte";
import GrammarEditor from "../components/editors/GrammarEditor.svelte";
import LiveCodeEditor from "../components/editors/LiveCodeEditor.svelte";
import LiveCodeParseOutput from "../components/widgets/LiveCodeParseOutput.svelte";
import GrammarCompileOutput from "../components/widgets/GrammarCompileOutput.svelte";
import Analyser from "../components/widgets/Analyser.svelte";
import StoreDebugger from "../components/widgets/StoreDebugger.svelte";


function persist(key, value) {
	sessionStorage.setItem(key, JSON.stringify(value));
}

export function writableSession(key, initialValue) {
	const sessionValue = JSON.parse(sessionStorage.getItem(key));

	if (!sessionValue) persist(key, initialValue);

	const store = writable(sessionValue || initialValue);

	const { set: realSet, subscribe, update: realUpdate } = store;

	return {
		set(value) {
			realSet(value);
			persist(key, value);
		},
		subscribe,
		update(fn) {
			realUpdate(fn);
			persist(key, get(store));
		}
	};
}
