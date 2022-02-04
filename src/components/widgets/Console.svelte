<script>

  import { onMount, onDestroy, beforeUpdate, afterUpdate } from "svelte/internal";

  import { Logger } from 'sema-engine';
  import { rawConsoleLogs, consoleLogs } from '../../stores/common.js'
  // import beautify from 'js-beautify';
  // import Inspect from 'svelte-inspect';

  export let id;
  export let name;
	export let type;
  export let hasFocus;
  export let background;
	export let lineNumbers;
	export let theme;
  export let component;
  export let className;
  export { className as class };

  let logger = new Logger();

  //filter levels, by default log everything
  let filter = {
    processor: true,
    main: true,
    learner: true,
    "warn": true,
    "log": true,
    "info": true,
    "error": true,
  }

  // to keep track of the total number of logLevel types
  let totals = {
    error: 0,
    info: 0,
    warn: 0,
    log: 0,
  }

  /*
  let beautifyOptions = {
    "indent_size": "2",
    "indent_char": " ",
    "max_preserve_newlines": "1",
    "preserve_newlines": true,
    "keep_array_indentation": true,
    "break_chained_methods": true,
    "indent_scripts": "normal",
    "brace_style": "collapse",
    "space_in_empty_paren": true,
    "space_before_conditional": true,
    "unescape_strings": true,
    "jslint_happy": false,
    "end_with_newline": false,
    "wrap_line_length": "70",
    "indent_inner_html": false,
    "comma_first": true,
    "e4x": false,
    "indent_empty_lines": false
  };
  */

  let something = e => { /* console.log(...e); */ }

  //to make the console scroll when new logs are added
  let textArea;
  let autoscroll;

  beforeUpdate(() => {
    autoscroll = textArea && (textArea.offsetHeight + textArea.scrollTop) > (textArea.scrollHeight - 20);
  });

  afterUpdate(() => {
    if (autoscroll) textArea.scrollTo(0, textArea.scrollHeight);
  });

	function eventListener(log){
    $rawConsoleLogs = logger.rawLog;
    $consoleLogs = logger.log;
    // console.log($consoleLogs);
    countLogLevels(logger.log);
    // console.log(totals)
	}

  function clearLogs(){
    console.log("clear logs getting called");
    logger.clear();
    $rawConsoleLogs = "";
    $consoleLogs = [];
  }

  function countLogLevels(newlog){
    let mr = newlog[newlog.length -1] //most recent event on console
    if (mr.logLevel == "error"){
      totals.error++;
    } else if( mr.t == "info"){
      totals.info++;
    } else if (mr.logLevel == "log"){
      totals.log++;
    } else if (mr.logLevel == "warn"){
      totals.warn++;
    } else{
      return;
    }
  }

  //for processing payloads. deals with if there is an object in the log and flattens it.
  function processPayload(payload) {
    let newLoad = [];
    for (var i = 0; i < payload.length; i++) {
      if (typeof payload[i] === "object"){
        let curStr = JSON.stringify(payload[i]);
        //let curStr = beautify(payload[i], beautifyOptions);
        newLoad.push(curStr);
      } else { newLoad.push(payload[i])}
    }
    return newLoad;
  }

  onMount(async () => {

    if(!logger){
      logger = new Logger();
    }

		logger.addEventListener("onLog", eventListener);
    something( id, name, type, className, lineNumbers, hasFocus, theme, background, component );
  });

  onDestroy( async () => {
    //clear the log on Console mount!
    clearLogs();
	})

</script>


<style>

  .parent-container {
    width: 100%;
    height: 100%;
    overflow:hidden;
  }
  
  .console-container {
    /* position: relative; */
    width: 100%;
    height: 90%;
    background-color: #181a1d;
    /* padding-top: 5%; */
    /* padding-bottom: 5%; */
    /* column-count: 2; */
    border: none;
    overflow-y: scroll;
    
  }
  
  .console-settings-container {
    overflow: hidden;
    background-color: #212529;
    height: 5%;
    display: flex;
    align-items: center;
    padding: 9px 2%;
  }
  .clear-container {
    white-space:nowrap;
  }

  .totals-container {
    white-space: nowrap;
  }

  .origin-container {
    white-space: nowrap;
  }

  .log-level-container {
    white-space: nowrap;
  }

	.scrollable-textarea {
		/* flex: 1 1 auto; */
		/* border-top: 1px solid #eee; */
		/* margin: 0 0 0.5em 0; */
		/* overflow-y: auto; */
	}

  .console-textarea {
    vertical-align: bottom;
    width: 100%;
    height: 100%;
    resize: none;
    color: white;
    border: none;
    overflow-y: scroll;
  }

  .console-PROCESSOR {
    /* color: green; */
    color: #859900;
    
  }

  .console-LEARNER {
    /* color: red; */
    color: #cb4b16;
  }

  .console-MAIN{
    /* color: white; */
    color: #6c71c4;
  }

  /* .clear-button {
    background: none;
    margin-top: 5px;
    padding: 0px 0px;
    border: 0px solid white;
    padding: 4px 6px;
    align-items: left;
    font-family: monospace;
  } */

  .clear-svg {
    fill: white;
  }

  .warns-svg {
    fill: yellow;
  }

  .errors-svg {
    fill: red;
  }

  

  label {
    display: inline-block;
    font-family: monospace
  }

  .section-header {
    display: inline-block;
    font-family: monospace;
    text-decoration: underline;
    font-weight: bold;
  }

  .totals-text {
    display: inline-block;
    font-weight: bold;
    font-family: monospace;
    color:#ccc;
  }

  form {
    padding: 10px 10px;
    align: right;
  }
  
  /* toggle buttons */
  .active {
    background-color:#181a1d;
  }

  button {
    font-family: monospace;
    padding: 1px 2px 1px 2px;
    border: none;
    background-color: #212529;
    color: #ccc;
    border-radius: 5px;
  }

  button:active{
    color: white;
    background-color: #212529;
    border-radius:5px;
    box-shadow: inset 0.25px 0.25px 0.1px 0 #201f1f, inset -0.25px -0.25px 0.1px 0 rgba(255, 255, 255, 0.05);
  }

  .clear-button {
    font-family: monospace;
    padding: 1px 2px 1px 2px;
    border: none;
    background: none;
  }

  .clear-button:hover {
    background-color: grey;
  }

  .clear-button:active {
    background-color: transparent;
  }

  .divider {
    height: 20px;
    width: 4px;
    /* height: 50px; */
    /* margin: 1px 11px 1px 17px; */
    border-radius: 2px;
    /* box-shadow: inset 1px 1px 4px 0 #070709, inset -1px -1px 4px 0 rgba(255, 255, 255, 0.05); */
    /* margin: 0.5em 0px 0.5em 0em; */
    margin: 0.5em 5px 0.5em 5px;
    box-shadow:inset 1px 1px 1px 0 #201f1f, inset -1px -1px 1px 0 rgba(255, 255, 255, 0.05);
  }

</style>


<div class=parent-container>
  <div class="console-settings-container">

    <div class = clear-container>

      <button type="clear-button" class="clear-button" on:click={clearLogs}>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="clear-svg" viewBox="0 0 16 16">
          <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
          <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
        </svg>
      </button>

    </div>

    <!-- <hr style="height: 20px; display: inline-block;"> -->

    <div class="divider" style='display:inline-block;'></div>


    <div class=origin-container>

      <button  class:active={filter.processor} on:click="{() => filter.processor = !filter.processor}">Processor</button>
      <button  class:active={filter.main} on:click="{() => filter.main = !filter.main}">Main</button>
      <button  class:active={filter.learner} on:click="{() => filter.learner = !filter.learner}">Learner</button>

    </div>

    <!-- <hr style="height: 20px; display: inline-block;"> -->
    <div class="divider" style='display:inline-block;'></div>

    <div class=log-level-container>

      <button  class:active={filter["log"]} on:click="{() => filter["log"] = !filter["log"]}">logs</button>
      <button  class:active={filter["error"]} on:click="{() => filter["error"] = !filter["error"]}">errors</button>
      <button  class:active={filter["warn"]} on:click="{() => filter["warn"] = !filter["warn"]}">warns</button>
      <button  class:active={filter["info"]} on:click="{() => filter["info"] = !filter["info"]}">info</button>

    </div>

    <!-- <hr style="height: 20px; display: inline-block;"> -->
    <div class="divider" style='display:inline-block;'></div>

    <div class = totals-container>
      <p class="totals-text">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="warns-svg" viewBox="0 0 16 16">
          <path d="M5.338 1.59a61.44 61.44 0 0 0-2.837.856.481.481 0 0 0-.328.39c-.554 4.157.726 7.19 2.253 9.188a10.725 10.725 0 0 0 2.287 2.233c.346.244.652.42.893.533.12.057.218.095.293.118a.55.55 0 0 0 .101.025.615.615 0 0 0 .1-.025c.076-.023.174-.061.294-.118.24-.113.547-.29.893-.533a10.726 10.726 0 0 0 2.287-2.233c1.527-1.997 2.807-5.031 2.253-9.188a.48.48 0 0 0-.328-.39c-.651-.213-1.75-.56-2.837-.855C9.552 1.29 8.531 1.067 8 1.067c-.53 0-1.552.223-2.662.524zM5.072.56C6.157.265 7.31 0 8 0s1.843.265 2.928.56c1.11.3 2.229.655 2.887.87a1.54 1.54 0 0 1 1.044 1.262c.596 4.477-.787 7.795-2.465 9.99a11.775 11.775 0 0 1-2.517 2.453 7.159 7.159 0 0 1-1.048.625c-.28.132-.581.24-.829.24s-.548-.108-.829-.24a7.158 7.158 0 0 1-1.048-.625 11.777 11.777 0 0 1-2.517-2.453C1.928 10.487.545 7.169 1.141 2.692A1.54 1.54 0 0 1 2.185 1.43 62.456 62.456 0 0 1 5.072.56z"/>
          <path d="M7.001 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.553.553 0 0 1-1.1 0L7.1 4.995z"/>
        </svg>
        {totals.warn}</p>

      <p class="totals-text">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="errors-svg" viewBox="0 0 16 16">
          <path d="M6.95.435c.58-.58 1.52-.58 2.1 0l6.515 6.516c.58.58.58 1.519 0 2.098L9.05 15.565c-.58.58-1.519.58-2.098 0L.435 9.05a1.482 1.482 0 0 1 0-2.098L6.95.435zm1.4.7a.495.495 0 0 0-.7 0L1.134 7.65a.495.495 0 0 0 0 .7l6.516 6.516a.495.495 0 0 0 .7 0l6.516-6.516a.495.495 0 0 0 0-.7L8.35 1.134z"/>
          <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z"/>
        </svg>
        {totals.error}</p>
      
    </div>

  </div>

  <div class='console-container scrollable-textarea' bind:this={textArea}>

    {#each $consoleLogs as {func, payload, origin, logLevel}, i}
      {#if origin == logger.originTypes.processor && filter.processor != false && filter[logLevel] != false}
          <pre readonly class='console-PROCESSOR'>{origin}{`[${logLevel}]`}{processPayload(payload)}</pre>
      {:else if origin == logger.originTypes.learner && filter.learner != false && filter[logLevel] != false}
        <pre readonly class='console-LEARNER'>{origin}{`[${logLevel}]`}{processPayload(payload)}</pre>
      {:else if origin == logger.originTypes.main && filter.main != false && filter[logLevel] != false}
        <pre readonly class='console-MAIN'>{origin}{`[${logLevel}]`}{processPayload(payload)}</pre>
      {/if}
    {/each}

  </div>
</div>


<!--
<div class='console-container scrollable-textarea'>

  <pre readonly
      bind:this={ textArea }


      class='console-textarea'
      >{ $rawConsoleLogs }</pre>

</div>
-->