<script>
  import Header from './Header.svelte';
	import Content from './Content.svelte';

  import compile from '../interpreter/compiler';
  import defaultGrammar from '../interpreter/defaultGrammar.ne';
  import defaultLiveCode from '../interpreter/defaultLiveCode.sem';
  import defaultModel from '../interpreter/defaultLiveCode.sem';
  import mooo from 'moo';

  export let name;

  let compileOutput = compile(defaultGrammar).output;

  let worker = new Worker('../../public/worker.bundle.js');

  let p = new Promise((res, rej) => {
            worker.postMessage({test: defaultLiveCode, source: defaultGrammar})
            
            let timeout = setTimeout(() => {
                worker.terminate()
                worker = new Worker('../../public/worker.bundle.js')
                // rej('Possible infinite loop detected! Check your grammar for infinite recursion.')
            }, 5000);
            worker.onmessage = e => {
                res(e.data);
                console.log(e.data);
                clearTimeout(timeout)
            }
        })
        .then(outputs => console.log(outputs))
        .catch(e => { console.log(e); });

  // console.log(compileOutput);

  let defaultState = {
      active: 0,
      compiled_grammar: compile(defaultGrammar).output,
      quadrants: [
          {
              name: 'Default Language',
              editor_value: defaultLiveCode,
              errors: '',
              tests: [
                  'Charles sleeps while thinking about snakes.',
                  'A typical Reddit user sleeps with a hammer.',
                  'This test doesn\'t match :('
              ]
          },
          {
            osciloscope: '',
            spectrogram: ''
          },
          {
              name: 'Default Grammar',
              editor_value: defaultGrammar,
              errors: '',
              tests: ['1 + 1', 'ln(5 + sin(3 + 4*e))']
          },
          {
              name: 'Default Model',
              editor_value: defaultModel,
              errors: '',
              tests: ['1 + 1', 'ln(5 + sin(3 + 4*e))']



          }
      ],
      dashboard: [
          {
              name: 'Default Language',
              editor_value: defaultGrammar,
              errors: '',
              tests: [
                  'Charles sleeps while thinking about snakes.',
                  'A typical Reddit user sleeps with a hammer.',
                  'This test doesn\'t match :('
              ]
          },
          {
            osciloscope: '',
            spectrogram: ''
          },
          {
              name: 'Default Grammar',
              editor_value: defaultGrammar,
              errors: '',
              tests: ['1 + 1', 'ln(5 + sin(3 + 4*e))']
          },
          {




          }
      ],
  }


</script>

<style>
  #app {
  	/* height: 100%; */
  	height: 100vh;
  	background: pink;
    overflow-y: hidden; /* hide vertical */
  }
</style>

<div id="app">
  <Header></Header>
  <Content></Content>
</div>