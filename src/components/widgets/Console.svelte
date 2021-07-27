<script>

  import { onMount, onDestroy, beforeUpdate, afterUpdate } from "svelte/internal";
  //import Logger from "../../utils/logger";

  import { Logger } from 'sema-engine';
  import { rawConsoleLogs, consoleLogs } from '../../stores/common.js'


  let logger = new Logger();
  //logger.setStore($rawConsoleLogs); //store is set to logger log property so that it updates with it.

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

  let totals = {
    error: 0,
    info: 0,
    warn: 0,
    log: 0,
  }



  // export let append = '';

  //let value = ``;
  //let localLogs = '';

  //$: value = appendLog($rawConsoleLogs);//append;

  // append
  let something = e => { /* console.log(...e); */ }

  /*
  function appendLog(rawlogs){
    localLogs = localLogs + rawlogs;
    localLogs = localLogs;
  }
  */

  // addEventListener("onConsoleLogsUpdate", (e) => {
  //   console.log("recieved event!!");
  //   $rawConsoleLogs = logger.rawLog;
  // }
  // );
  
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
    console.log($consoleLogs);
    countTypes(logger.log);
    console.log(totals)
	}

  function clearLogs(){
    console.log("clear logs getting called");
    logger.clear();
    $rawConsoleLogs = "";
    $consoleLogs = [];
  }

  function countTypes(newlog){
    let mr = newlog[newlog.length -1] //most recent event on console
    if (mr.type == "error"){
      totals.error++;
    } else if( mr.type == "info"){
      totals.info++;
    } else if (mr.type == "log"){
      totals.log++;
    } else if (mr.type == "warn"){
      totals.warn++;
    } else{
      return;
    }
  }

  onMount(async () => {

    if(!logger){
      logger = new Logger();
    }

		logger.addEventListener("onLog", eventListener);
    console.log("TYPES", logger.types);
    //append = append + logger.log
    something( id, name, type, className, lineNumbers, hasFocus, theme, background, component );
  });

  onDestroy( async () => {
    //clear the log on Console mount!
    clearLogs();
	})

</script>


<style>

  .console-container {
    /* position: relative; */
    width: 100%;
    height: 100%;
    border: none;
    overflow-y: scroll;
  }

	.scrollable-textarea {
		/* flex: 1 1 auto; */
		/* border-top: 1px solid #eee; */
		/* margin: 0 0 0.5em 0; */
		/* overflow-y: auto; */
	}

  .console-textarea {
    width: 100%;
    height: 100%;
    resize: none;
    color: white;
    overflow-y: scroll;
  }

  .console-PROCESSOR {
    color: green;
  }

  .console-LEARNER {
    color: red;
  }

  .console-MAIN{
    color: white;
  }

  .button {
    background: none;
    margin-top: 5px;
    padding: 0px 0px;
    border: 0px solid white;
    padding: 4px 6px;
    align-items: left;
  }

  .button:hover {
    background-color: grey;
  }

  .button:active {
    background-color: white;
  }

  .console-settings{
    overflow: hidden;
    background-color: #1d1d1d;
    position: fixed; /* Set the navbar to fixed position */
    width: 80%; /* Full width */
    height: 5%;
    display: flex;
    flex-direction: wrap;
    justify-content: space-between;
    align-items: center;
    padding: 10px 10%;
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
  }

  form {
    padding: 10px 10px;
    align: right;
  }


</style>

<div class='console-container scrollable-textarea' bind:this={textArea}>
 
  
  
  <div class="console-settings">

    
    <form>
      <p class="section-header">Filter Source: </p>

      <input type="checkbox" id="PROCESSOR" name="PROCESSOR" bind:checked={filter.processor}>
      <label for="PROCESSOR">Processor</label>

      <input type="checkbox" id="MAIN" name="MAIN" bind:checked={filter.main}>
      <label for="MAIN">Main</label>

      <input type="checkbox" id="LEARNER" name="LEARNER" bind:checked={filter.learner}>
    <label for="LEARNER">Learner</label>
    </form>

    <form>
    <p class="section-header">Filter Type: </p>

    <input type="checkbox" id="level-log" name="level-log" bind:checked={filter["log"]}>
      <label for="level-log">logs</label>

      <input type="checkbox" id="level-error" name="level-error" bind:checked={filter["error"]}>
      <label for="level-error">errors</label>

      <input type="checkbox" id="level-warn" name="level-warn" bind:checked={filter["warn"]}>
      <label for="level-warn">warns</label>
      
      <input type="checkbox" id="level-info" name="level-info" bind:checked={filter["info"]}>
      <label for="level-info">info</label>
    </form>

    <p class="totals-text">⚠️{totals.warn}</p>
    <p class="totals-text">❗{totals.error}</p>
    <button type="button" class="button" on:click={clearLogs}>🚫</button>

  </div>

  {#each $consoleLogs as {func, payload, source, type}, i}
    {#if source == logger.types.processor && filter.processor != false && filter[type] != false}
      <pre readonly class='console-PROCESSOR'>{source}{payload}</pre>
    {:else if source == logger.types.learner && filter.learner != false && filter[type] != false}
      <pre readonly class='console-LEARNER'>{source}{payload}</pre>
    {:else if source == logger.types.main && filter.main != false && filter[type] != false}
      <pre readonly class='console-MAIN'>{source}{payload}</pre>
    {/if}

    <!-- <pre readonly bind:this={ textArea } class='console-textarea'>{ type }</pre> -->
  {/each}
  <!-- <pre readonly bind:this={ textArea } class='console-textarea'>{ $rawConsoleLogs }</pre> -->

</div>


<!--
<div class='console-container scrollable-textarea'>
  
  <pre readonly
      bind:this={ textArea }

      
      class='console-textarea'
      >{ $rawConsoleLogs }</pre>

</div>
-->