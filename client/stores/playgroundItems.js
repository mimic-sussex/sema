import { writable, readable } from 'svelte/store';

import gridHelp from "svelte-grid/build/helper/index.mjs";

import ModelEditor          from "../UI/editors/ModelEditor.svelte";
import GrammarEditor        from "../UI/editors/GrammarEditor.svelte";
import LiveCodeEditor       from "../UI/editors/LiveCodeEditor.svelte";
import LiveCodeParseOutput  from "../UI/widgets/LiveCodeParseOutput.svelte";
import GrammarCompileOutput from "../UI/widgets/GrammarCompileOutput.svelte";
import Oscilloscope         from "../UI/widgets/Oscilloscope.svelte";
import Spectrogram          from "../UI/widgets/Spectrogram.svelte";

const id = () =>
	"_" +
	Math.random()
		.toString(36)
		.substr(2, 9);

const originalItems = [
	{
		...gridHelp.item({ x: 7, y: 0, w: 7, h: 3, id: id() }),
		...{
			type: "liveCodeEditor",
			name: "hello-world",
			background: "#151515",
			lineNumbers: true,
			hasFocus: false,
			background: "#151515",
			theme: "icecoder",
			component: LiveCodeEditor,
			data: ""
		}
	},

	{
		...gridHelp.item({ x: 7, y: 0, w: 3, h: 7, id: id() }),
		...{
			name: "hello world",
			type: "liveCodeParseOutput",
			lineNumbers: false,
			hasFocus: false,
			theme: "shadowfox",
			background: "#ebdeff",
			component: LiveCodeParseOutput,
			data: ""
		}
	},

	{
		...gridHelp.item({ x: 10, y: 0, w: 8, h: 2, id: id() }),
		...{
			name: "hello world",
			type: "grammarCompileOutput",
			lineNumbers: true,
			hasFocus: false,
			theme: "monokai",
			background: "#d1d5ff",
			component: GrammarCompileOutput,
			data: ""
		}
	},

	{
		...gridHelp.item({ x: 10, y: 2, w: 5, h: 5, id: id() }),
		...{
			name: "hello world",
			type: "grammarEditor",
			lineNumbers: true,
			hasFocus: false,
			theme: "monokai",
			background: "#AAAAAA",
			component: GrammarEditor,
			data: ""
		}
	},

	{
		...gridHelp.item({ x: 0, y: 4, w: 7, h: 4, id: id() }),
		...{
			name: "hello world",
			type: "modelEditor",
			lineNumbers: true,
			hasFocus: false,
			theme: "monokai",
			background: "#f0f0f0",
			component: ModelEditor,
			data: ""
		}
	},

	{
		...gridHelp.item({ x: 0, y: 8, w: 7, h: 4, id: id() }),
		...{
			name: "hello world",
			type: "oscilloscope",
			lineNumbers: true,
			hasFocus: false,
			theme: "monokai",
			background: "#f0f0f0",
			component: Oscilloscope,
			data: ""
		}
	},

	{
		...gridHelp.item({ x: 7, y: 8, w: 7, h: 4, id: id() }),
		...{
			name: "hello world",
			type: "spectrogram",
			lineNumbers: true,
			hasFocus: false,
			theme: "monokai",
			background: "#f0f0f0",
			component: Spectrogram,
			data: ""
		}
	}
];


// Dashboard layout in items list
export const items = writable(originalItems);

// Dashboard layout SELECTED item which receives focus and has item controls loaded
export const focusedItem = writable({});

// Dashboard layout SELECTED item which receives focus and has item controls loaded
export const focusedItemControls = writable([]);
