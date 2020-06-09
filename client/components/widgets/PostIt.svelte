<script>
import { items } from '../../stores/playground.js'

// export let items;

</script>


<style>
  
  .container {
    position: relative;
    width: 100%;
    height: 100%;
    border: none;
  }

	.scrollable {
		flex: 1 1 auto;
		/* border-top: 1px solid #eee; */
		margin: 0 0 0.5em 0;
		overflow-y: auto;
	}

  .error-state {
    color:red; 
    margin:15px 0px 15px 25px;
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
  }

</style>

<div class='container scrollable'>
  <!-- <textarea class='prewrap'> { JSON.stringify($items, null, 2) } </textarea> -->
  <pre class='prewrap'> { JSON.stringify($items, null, 2) } </pre>
</div>