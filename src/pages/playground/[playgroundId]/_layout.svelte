<script>

  import {
    isSaveOverlayVisible,
    loadEnvironmentSnapshotEntries,
		items,
		name,
		uuid
  } from  "../../../stores/playground.js"

  import { url, params, ready, isActive, route, afterPageLoad, beforeUrlChange, goto} from "@roxi/routify";

	console.log($uuid)
	console.log($url)
	console.log($params)
	// console.log($route)
	console.log($name)
	// console.log($beforeUrlChange)
	// console.log($afterPageLoad)

</script>

<div>
	{ $params.playgroundId }
  { $name }
	<!-- { params }
	{ url }
	{ url }
	{ url } -->
</div>