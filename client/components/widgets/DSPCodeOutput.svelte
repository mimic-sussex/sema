<script>
import { dspCode } from '../../stores/common.js'

// export let items;

</script>


<style>
  
  .container {
    position: relative;
    width: 100%;
    height: 100%;
    border: none;
    font-family: monospace;
  }

	.scrollable {
		flex: 1 1 auto;
		/* border-top: 1px solid #eee; */
		margin: 0 0 0.5em 0;
		overflow-y: auto;
	}


  .prewrap {
    display: inline-flexbox;
    width: 100%;
    overflow-x: auto;
    white-space: pre-wrap;
    white-space: -moz-pre-wrap;
    white-space: -pre-wrap;
    white-space: -o-pre-wrap;
    word-wrap: break-word;
    margin:5px 0px 15px 5px;

    -moz-user-select: text;
    -khtml-user-select: text;
    -webkit-user-select: text;
    -ms-user-select: text;
    user-select: text;
  }
  .error-state {
    color:red; 
    margin:15px 10px 5px 5px;
  }

</style>

<div class='container scrollable'>
  {#if $dspCode}
  <strong class="error-state">Setup:</strong>
  <pre class='prewrap'> { JSON.stringify($dspCode.setup, null, 2) } </pre>
  <strong class="error-state">Loop:</strong>
  <pre class='prewrap'> { JSON.stringify($dspCode.loop, null, 2) } </pre>
  <!-- <pre> { JSON.stringify($dspCode.loop, null, 2) } </pre> -->
  {/if}
</div>