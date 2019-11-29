import { writable, readable } from 'svelte/store';
import compile from "./compiler/compiler";

import default_grammar from '../assets/language/defaultGrammar.ne';
import default_liveCode from "../assets/language/defaultLiveCode.sem";

import hello_world_code_example from "./machineLearning/tfjs/hello-world/hello-world.tf";
import two_layer_non_linear_code_example from "./machineLearning/tfjs/non-linear/two-layer-non-linear.tf";
import binary_classification_code_example from "./machineLearning/tfjs/non-linear/binary-classification.tf";
import echo_state_network_code_example from "./machineLearning/tfjs/echo-state/echo-state-network.tf";
import lstm_txt_gen_code_example from "./machineLearning/tfjs/rnn/lstm-txt-gen.tf";
import music_rnn_example from "./machineLearning/magenta/music-rnn.tf";

export const helloWorld = writable(hello_world_code_example);
export const twoLayerNonLinear = writable(two_layer_non_linear_code_example);
export const binaryClassification = writable(binary_classification_code_example); 
export const echoStateNetwork = writable(echo_state_network_code_example); 
export const lstmTextGen = writable(lstm_txt_gen_code_example); 
export const musicRNN = writable(music_rnn_example);

export const splashScreenClicked = writable(false);



let initGrammarEditorValue = () => {
  let ret;
  let temp = window.localStorage.grammarEditorValue;
  ( temp && temp !== "") ? ret = temp: ret = default_grammar;
  return ret;

} 

let initLiveCodeEditorValue = () =>  { 
    let ret;
		let temp = window.localStorage.liveCodeEditorValue;
		temp && temp !== "" ? (ret = temp) : (ret = default_liveCode);
		return ret;
}
 
export const grammarEditorValue = writable(initGrammarEditorValue());

export const grammarCompiledParser = writable(compile(default_grammar).output);

export const grammarCompilationErrors = writable("");

export const liveCodeEditorValue = writable(initLiveCodeEditorValue());

export const liveCodeParseResults = writable("");

export const liveCodeParseErrors = writable("");

export const liveCodeAbstractSyntaxTree = writable("");

export const dspCode = writable("");

export const modelEditorValue = helloWorld;



function createSelectedLayout(){
  const { subscribe, set } = writable(2);

  return {
    subscribe,
    reset: (n) => set(n)
  };
} 

// export const selectedLayout = createSelectedLayout(); 
export const selectedLayout = writable(1); 

export const layoutOptions = [
	{ id: 1, text: `Tutorial` },
	{ id: 2, text: `Live` },
	{ id: 3, text: `Dashboard` }
];

export const layoutsData = writable({
  selectedLayout: 1,
  layouts: [{  
    quadrants: {
      topHeight: 600,
      leftTopWidth: 250,
      leftBottomWidth: 250
    }
  },
  {
    dashboard: [
      { x: 0, y: 0, w: 2, h: 2, id: '1' },
      { x: 0, w: 3, h: 2, id: '2', static: true },
      { x: 5, y: 0, w: 3, h: 3, id: '3' }
    ],
  }]
});

// export const mousePosition = readable([0,0], function start(set) {
//   const interval = setInterval(() => {
//     set([]])
//   }, 1000);

//   return function stop() {
// 		clearInterval(interval);
// 	};
// });


// export const defaultState = writable({
// 	active: 0,
// 	compiled_grammar: compile(defaultGrammar).output,
// 	quadrants: [
// 		{
// 			name: 'Default Language',
// 			editor_value: defaultLiveCode,
// 			errors: '',
// 			tests: [
// 				'Charles sleeps while thinking about snakes.',
// 				'A typical Reddit user sleeps with a hammer.',
// 				'This test does not match :('
// 			]
// 		},
// 		{
// 			osciloscope: '',
// 			spectrogram: ''
// 		},
// 		{
// 			name: 'Default Grammar',
// 			editor_value: defaultGrammar,
// 			errors: '',
// 			tests: ['1 + 1', 'ln(5 + sin(3 + 4*e))']
// 		},
// 		{
// 			name: 'Default Model',
// 			editor_value: defaultModel,
// 			errors: '',
// 			tests: ['1 + 1', 'ln(5 + sin(3 + 4*e))']
// 		}
// 	],
// 	dashboard: [
// 		{
// 			name: 'Default Language',
// 			editor_value: defaultGrammar,
// 			errors: '',
// 			tests: [
// 				'Charles sleeps while thinking about snakes.',
// 				'A typical Reddit user sleeps with a hammer.',
// 				'This test does not match :('
// 			]
// 		},
// 		{
// 			osciloscope: '',
// 			spectrogram: ''
// 		},
// 		{
// 			name: 'Default Grammar',
// 			editor_value: defaultGrammar,
// 			errors: '',
// 			tests: ['1 + 1', 'ln(5 + sin(3 + 4*e))']
// 		},
// 		{}
// 	]
// });
