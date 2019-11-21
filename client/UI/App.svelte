<script>
  import Header from './Header.svelte';
	import Content from './Content.svelte';

  import compile from '../compiler/compiler';
  import defaultGrammar from '../compiler/defaultGrammar.ne';
  import defaultLiveCode from '../compiler/defaultLiveCode.sem';
  import defaultModel from '../compiler/defaultLiveCode.sem';
  
  import layout from '../store.js';

  let compileOutput = compile(defaultGrammar).output;

  let workerParser = new Worker('../../public/workerParser.bundle.js'); 
  
  let p = new Promise( (res, rej) => {
                                        workerParser.postMessage({test: defaultLiveCode, source: compileOutput})

                                        let timeout = setTimeout(() => {
                                            workerParser.terminate()
                                            workerParser = new Worker('../../public/workerParser.bundle.js')
                                            // rej('Possible infinite loop detected! Check your grammar for infinite recursion.')
                                        }, 5000);

                                        workerParser.onmessage = e => {
                                            res(e.data);
                                            clearTimeout(timeout)
                                        }
        })
        .then(outputs => {
          // console.log('DEBUG:App:workerParserOutputs') 
          // console.log(outputs)
        })
        .catch(e => { 
          // console.log('DEBUG:App:workerParserOutputs:CATCH') 
          // console.log(e); 
        });


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