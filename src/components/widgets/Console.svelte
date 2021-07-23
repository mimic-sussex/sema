<script>

  import { onMount, onDestroy } from "svelte/internal";
  //import Logger from "../../utils/logger";

  import { Logger } from 'sema-engine';
  import { rawConsoleLogs } from '../../stores/common.js'


  let logger = new Logger();
  //logger.setStore($rawConsoleLogs); //store is set to logger log property so that it updates with it.

  let textArea;


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

	function eventListener(log){
		console.log(log);
    $rawConsoleLogs = logger.rawLog;
	}

  function clearLogs(){
    logger.clear();
    $rawConsoleLogs = "";
  }

  onMount(async () => {

    if(!logger){
      logger = new Logger();
    }

		logger.addEventListener("onLog", eventListener)

    //clear the log on Console mount!
    clearLogs();

    //append = append + logger.log
    something( id, name, type, className, lineNumbers, hasFocus, theme, background, component );
  });

  onDestroy( async () => {

	})

</script>


<style>

  .console-container {
    /* position: relative; */
    width: 100%;
    height: 100%;
    border: none;
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
    color: red;
    overflow-y: scroll;
    overflow-x: scroll;
  }

  .console-logs {

  }

  .console-warns {

  }

</style>

<div class='console-container scrollable-textarea'>

  <pre readonly
      bind:this={ textArea }

      class='console-textarea'
      >{ $rawConsoleLogs }</pre>
  <!-- <textarea readonly
      bind:this={ textArea }
      bind:value
      class='console-textarea'
      ></textarea> -->
</div>