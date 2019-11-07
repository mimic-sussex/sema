import { writable } from "svelte/store";

export const defaultState = {
	active: 0,
	compiled_grammar: compile(defaultGrammar).output,
	quadrants: [
		{
			name: "Default Language",
			editor_value: defaultLiveCode,
			errors: "",
			tests: [
				"Charles sleeps while thinking about snakes.",
				"A typical Reddit user sleeps with a hammer.",
				"This test doesn't match :("
			]
		},
		{
			osciloscope: "",
			spectrogram: ""
		},
		{
			name: "Default Grammar",
			editor_value: defaultGrammar,
			errors: "",
			tests: ["1 + 1", "ln(5 + sin(3 + 4*e))"]
		},
		{
			name: "Default Model",
			editor_value: defaultModel,
			errors: "",
			tests: ["1 + 1", "ln(5 + sin(3 + 4*e))"]
		}
	],
	dashboard: [
		{
			name: "Default Language",
			editor_value: defaultGrammar,
			errors: "",
			tests: [
				"Charles sleeps while thinking about snakes.",
				"A typical Reddit user sleeps with a hammer.",
				"This test doesn't match :("
			]
		},
		{
			osciloscope: "",
			spectrogram: ""
		},
		{
			name: "Default Grammar",
			editor_value: defaultGrammar,
			errors: "",
			tests: ["1 + 1", "ln(5 + sin(3 + 4*e))"]
		},
		{}
	]
};
