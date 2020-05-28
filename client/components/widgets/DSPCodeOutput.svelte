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

</style>

<div class='container scrollable'>
  <pre> { JSON.stringify($items, null, 2) } </pre>
</div>