import { writable, readable } from "svelte/store";
// import { writable as internal, get } from "svelte/store";

// import gridHelp from "svelte-grid/build/helper/index.mjs";

// import ModelEditor from "../UI/editors/ModelEditor.svelte";
// import GrammarEditor from "../UI/editors/GrammarEditor.svelte";
// import LiveCodeEditor from "../UI/editors/LiveCodeEditor.svelte";
// import LiveCodeParseOutput from "../UI/widgets/LiveCodeParseOutput.svelte";
// import GrammarCompileOutput from "../UI/widgets/GrammarCompileOutput.svelte";
// import Analyser from "../UI/widgets/Analyser.svelte";
// import Spectrogram from "../UI/widgets/Spectrogram.svelte";
// import StoreDebugger from "../UI/widgets/StoreDebugger.svelte";

// import default_grammar from "../../assets/language/defaultGrammar.ne";
// import gabber_grammar from "../../assets/language/gabber.ne";
// import nibble_grammar from "../../assets/language/nibble.ne";

// import default_liveCode from "../../assets/language/defaultLiveCode.sem";
// import gabber_liveCode from "../../assets/language/gabber.sem";
// import nibble_liveCode from "../../assets/language/nibble.sem";

// import hello_world_code_example from "../machineLearning/tfjs/hello-world/hello-world.tf";
// import two_layer_non_linear_code_example from "../machineLearning/tfjs/non-linear/two-layer-non-linear.tf";
// import binary_classification_code_example from "../machineLearning/tfjs/non-linear/binary-classification.tf";
// import echo_state_network_code_example from "../machineLearning/tfjs/echo-state/echo-state-network.tf";
// import lstm_txt_gen_code_example from "../machineLearning/tfjs/rnn/lstm-txt-gen.tf";
// import music_rnn_example from "../machineLearning/magenta/music-rnn.tf";

 
// Load tutorials from .ne files  
// import tutorial_1_grammar from "../tutorials/tutorial1.ne";
// import tutorial_2_grammar from "../tutorials/tutorial2.ne";
// import tutorial_3_grammar from "../tutorials/tutorial3.ne";
// import tutorial_4_grammar from "../tutorials/tutorial4.ne";


// Stores for the two main layouts
export const playgroundActive = writable(true);
export const tutorialsActive = writable(false);


// Store for tutorial options in Sidebar component
export const tutorialOptions = [
	{ id: 0, text: `Select Tutorial`, content: "" },
	{ id: 1, text: `Tutorial 1`, content: '' },
	{ id: 2, text: `Tutorial 2`, content: '' },
	{ id: 3, text: `Tutorial 3`, content: '' },
	{ id: 4, text: `Tutorial 4`, content: '' },
	{ id: 5, text: `Tutorial 5`, content: '' }
];

// Store for SELECTED tutorial options in Sidebar component
export const selectedTutorial = writable(tutorialOptions[0]);

// Store for SELECTED tutorial GRAMMAR in Grammar Editor
// export const selectedTutorialGrammar = writable(tutorialOptions[1].content);


// Load TFJS code from tf files 


// SplashScreen visibility

// Grammar and LiveCode Editors previous sessions' Values, store in LocalStorage

let initGrammarEditorValue = () => {
  let ret;
  let temp = window.localStorage.grammarEditorValue;
  (temp && temp !== "") ? ret = temp: ret = default_grammar;
  return ret;
} 

let initLiveCodeEditorValue = () =>  { 
    let ret;
		let temp = window.localStorage.liveCodeEditorValue;
   	(temp && temp !== "") ? ret = temp : ret = default_liveCode;
		return ret;
}

let initModelEditorValue = () => {
	let ret;
	let temp = window.localStorage.modelEditorValue;
	temp && temp !== "" ? (ret = temp) : (ret = hello_world_code_example);
	return ret;
};


// Grammar and LiveCode Editors CURRENT TUTORIAL session's Values and dependencies, reactive

// export const grammarEditorValue = writable(initGrammarEditorValue());

// export const grammarCompiledParser = writable(compile(default_grammar).output);

// export const grammarCompilationErrors = writable("");

// export const liveCodeEditorValue = writable(initLiveCodeEditorValue());

// export const liveCodeParseResults = writable("");

// export const liveCodeParseErrors = writable("");

// export const liveCodeAbstractSyntaxTree = writable("");

// export const dspCode = writable("");

// TFJS Model editor value, and IO channels' values

// export const modelEditorValue = writable(initModelEditorValue());

// // Dashboard Store for Live Code Editor options in Sidebar component
// export const sidebarLiveCodeOptions = [
// 	{ id: 0, text: `Add LiveCode Editor...`, content: "" },
// 	{ id: 1, text: `+ default`, content: default_liveCode },
// 	{ id: 2, text: `+ nibble`, content: nibble_liveCode },
// 	{ id: 3, text: `+ gabber`, content: gabber_liveCode },
// ];

// // Dashboard Store for Grammar Editor options in Sidebar component
// export const sidebarGrammarOptions = [
// 	{ id: 1, text: `Add Grammar Editor...`, content: "" },
// 	{ id: 1, text: `+ default`, content: default_grammar },
// 	{ id: 2, text: `+ nibble`, content: nibble_grammar },
// 	{ id: 3, text: `+ gabber`, content: gabber_grammar },
// ];


// Store for TFJS model options in Sidebar component
// export const sidebarModelOptions = [
// 	{ id: 0, text: `Add Model Editor...`, content: "" },
// 	{ id: 1, text: `+ hello-world`, content: hello_world_code_example },
// 	{
// 		id: 2,
// 		text: `+ two-layer-non-linear`,
// 		content: two_layer_non_linear_code_example
// 	},
// 	{
// 		id: 3,
// 		text: `+ binary-classification`,
// 		content: binary_classification_code_example
// 	},
// 	{
// 		id: 4,
// 		text: `+ echo-state-network`,
// 		content: echo_state_network_code_example
// 	},
// 	{
// 		id: 5,
// 		text: `+ lstm-text-gen`,
// 		content: lstm_txt_gen_code_example
// 	}
// ];

// export const selectedModel = writable(sidebarModelOptions[1]);





// function createSelectedLayout(){
//   const { subscribe, set } = writable(2);

//   return {
//     subscribe,
//     reset: (n) => set(n)
//   };
// } 

// // Sidebar layout selection export const selectedLayout = createSelectedLayout(); 
// export const selectedLayout = writable(3); 


// export const layoutOptions = [
// 	{ id: 1, text: `Tutorial` },
// 	{ id: 2, text: `Live` },
// 	{ id: 3, text: `Dashboard` },
// 	{ id: 4, text: `Model` }
// ];

// Dashboard layout in items list
// export const dashboardItems = writable([]);

// // Dashboard layout SELECTED item which receives focus and has item controls loaded
// export const selectedItem = writable({});

// // Dashboard layout SELECTED item which receives focus and has item controls loaded
// export const selectedItemControls = writable([]);


// // Dashboard Store for Grammar Editor options in Sidebar component
// export const editorThemes = [
// 	{ id: 0, text: `Change Theme...`, content: "" },
// 	{ id: 1, text: `cobalt`, content: cm_theme_cobalt },
// 	{ id: 2, text: `icecoder`, content: cm_theme_icecoder },
// 	{ id: 3, text: `shadowfox`, content: cm_theme_shadowfox },
// ];



// export const mousePosition = readable([0,0], function start(set) {
//   const interval = setInterval(() => {
//     set([]])
//   }, 1000);

//   return function stop() {
// 		clearInterval(interval);
// 	};
// });
