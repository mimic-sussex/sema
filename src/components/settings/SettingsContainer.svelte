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
	
	.container {
		background-color: #3a4147;
		width:100%;
		height:100%;
	}
	
	.side-by-side {
		background-color: #262a2e;
		/* border-top-right-radius: 5px;
		border-bottom-right-radius: 5px; */
		display:inline-block;
		margin-right: -4px; /*hacky method of getting them side by side no gap*/
	}
	
	button {
		padding: 20;
		background-color: #262a2e;
/* 		margin: 0,0,0,0; */
		color: white;
		border: none;
		width: 49px;
  	height: 49px;
  	margin: 12px 0px 12px 12px;
  	padding: 7px 10px 8px 8px;
  	border-radius: 5px;
  	background-color: #262a2e;
		/* box-shadow: -4px -2px 16px 0 rgba(195, 200, 205, 0.26), 4px 4px 18px 0 rgba(0, 0, 0, 0.8);
    background-image: linear-gradient(112deg, #24272b 80%, #222529 124%); */
	}
	
	svg{
		fill: #999999;
	}
	
</style>

<div class="container">
	
		<button class="side-by-side" on:click={openMe}>

				<slot name="icon"></slot>
				
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