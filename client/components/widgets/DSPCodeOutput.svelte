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
  }

	.scrollable {
		flex: 1 1 auto;
		/* border-top: 1px solid #eee; */
		margin: 0 0 0.5em 0;
		overflow-y: auto;
	}

  pre {
    /* position: relative;
    width: 100%;
    height: auto;
    overflow-y: auto; */
  }

</style>

<div class='container scrollable'>
  {#if $dspCode}
  <pre> { JSON.stringify($dspCode.setup, null, 2) } </pre>
  <!-- <pre> { JSON.stringify($dspCode.loop, null, 2) } </pre> -->
  {/if}
</div>