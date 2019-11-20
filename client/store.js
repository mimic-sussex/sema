import { writable, readable } from 'svelte/store';

import defaultGrammar from './compiler/defaultGrammar.ne';
import defaultLiveCode from './compiler/defaultLiveCode.sem';
import defaultModel from './compiler/defaultLiveCode.sem';


// export const mousePosition = readable([0,0], function start(set) {
//   const interval = setInterval(() => {
//     set([]])
//   }, 1000);

//   return function stop() {
// 		clearInterval(interval);
// 	};
// });

export const liveCodeEditorValue = writable(defaultLiveCode);
export const grammarEditorValue = writable(defaultGrammar);
export const modelEditorValue = writable(defaultModel); 

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
	{ id: 1, text: `Live` },
	{ id: 2, text: `Horizontal` },
	{ id: 3, text: `Vertical` },
	{ id: 4, text: `Quadrants` },
	{ id: 5, text: `Dashboard` }
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
