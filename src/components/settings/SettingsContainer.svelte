<script>
	

	// import ButtonContainer from './SettingsContainer.svelte';
	// import Button from './Button.svelte'
	
	let open = false;
  
  function openMe(){
		if (open == true){
			open = false
		} else {
			open =true;
		}
		console.log("open me is ", open);
	}
</script>

<style>
	
	.settingsContainer-container{
		margin: 0.5em 0px 0.5em 0em;
	}

	.container {
		background-color: #3a4147;
		border-radius: 5px;
		width:100%;
		height:100%;
	}
	
	.side-by-side {
		background-color: #262a2e;
		/* border-top-right-radius: 5px;
		border-bottom-right-radius: 5px; */
		/* display:inline-block; */
		/* margin-right: -4px; hacky method of getting them side by side no gap */
		display:flex;
		align-items:center;
		border-radius: 5px;
	}
	
	.button-launcher {
		padding: 20;
		background-color: #262a2e;
		color: white;
		border: none;
		width: 42px;
  	height: 42px;
  	margin: 8px 8px 8px 8px;
  	/* padding: 7px 10px 8px 8px; */
  	border-radius: 5px;
  	background-color: #262a2e;
	}
	
	svg{
		fill: #999999;
	}
	
</style>

<div class="settingsContainer-container">

	<div class="side-by-side">
		
			<button class="button-launcher" on:click={openMe}>

					<slot name="icon"></slot>

					<!-- Dots icon -->
					<!-- <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-three-dots" viewBox="0 0 16 16">
						<path d="M3 9.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/>
					</svg> -->
					
			</button>
		
		<div class='side-by-side'>

			<!-- <SettingsContainer open={open}> -->
				
			<!-- </SettingsContainer> -->
			
			{#if open}
				<div>
					<slot name="section1"></slot>
					<slot name="section2"></slot>
				</div>
			{/if}

		</div>

	</div>

</div>