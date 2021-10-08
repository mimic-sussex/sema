<script>

	import { tick, onMount, onDestroy} from 'svelte';

	import { url, params, ready, isActive, route, afterPageLoad, beforeUrlChange, goto} from "@roxi/routify";

  import {
    isSaveOverlayVisible,
    loadEnvironmentSnapshotEntries,
		items,
		name,
		uuid
  } from  "../../../stores/playground";

	// console.log($uuid)
	// console.log($url)
	// console.log($params)
	// console.log($route)
	// console.log($name)
	// console.log($beforeUrlChange)
	// console.log($afterPageLoad)

	// $: promise = logUUID($params.playgroundId);
	
	onMount( async () => {
		console.log("[playground mount]");
    console.log("DEBUG:routes/playground/"+$params.playgroundId+"/_layout:onMount");
  });


	function logUUID(param){
		console.log("logging uuid", param);
	}

</script>

<div>
	<!-- { $params.playgroundId } -->
  <!-- { $name } -->
	<!-- { params }
	{ url }
	{ url }
	{ url } -->
</div>