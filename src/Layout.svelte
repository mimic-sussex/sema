<script>
	import { onMount } from 'svelte';

  let container;

  let blockWidth = 250;
  
  let topHeight = 300;
  let topOffsetHeight;
  let dragY;
  let isMouseDownOnVerticalSlider;
  

  function dragMouseDownOnHorizontalSlider(e) {
		let dragX = e.clientX;
		hslider.classList.add('resize');
		hslider.parentNode.classList.add('col-resize');
		//app.classList.add('col-resize');
		document.onmousemove = function onMouseMove(e) {
			blockWidth = 
			block.style.width = block.offsetWidth + e.clientX - dragX + "px";
			dragX = e.clientX;
		}
		// remove mouse-move listener on mouse-up
		document.onmouseup = () => {
			hslider.parentNode.classList.remove('col-resize');
			hslider.classList.remove('resize');
			document.onmousemove = document.onmouseup = null;
		}
	}

	function onMouseMove(e) {
		// let top = vslider.previousElementSibling;
    if(isMouseDownOnVerticalSlider){
      topHeight = topOffsetHeight + e.clientY - dragY + "px";
      dragY = e.clientY;
      // console.log(topHeight)
    }
	}

	function onMouseUp () {
    isMouseDownOnVerticalSlider = false;
    // console.log("mouseUp", dragY);
	}  

  function dragMouseDownOnVerticalSlider(e) {
    isMouseDownOnVerticalSlider = true;
    dragY = e.clientY;
    // console.log("mouseOnVSlider: ", dragY );
	}
	
  onMount(() => {
  
  
  
  })

  /*
  function dragMouseDownOnVerticalSlider(e) {
		let dragY = e.clientY;
		vslider.classList.add('resize');
		// vslider.parentNode.classList.add('row-resize');
		document.onmousemove = function onMouseMove(e) {
			let top = vslider.previousElementSibling;
			top.style.height = top.offsetHeight + e.clientY - dragY + "px";
			dragY = e.clientY;
		}
		// remove mouse-move listener on mouse-up
		document.onmouseup = () => {
			vslider.classList.remove('resize');
			vslider.parentNode.classList.remove('row-resize');
			document.onmousemove = document.onmouseup = null;
		}
	}

  function dragMouseDownOnHorizontalSlider(e) {
		let dragX = e.clientX;
		hslider.classList.add('resize');
		hslider.parentNode.classList.add('col-resize');
		//app.classList.add('col-resize');
		document.onmousemove = function onMouseMove(e) {
			let block = hslider.previousElementSibling;
			block.style.width = block.offsetWidth + e.clientX - dragX + "px";
			dragX = e.clientX;
		}
		// remove mouse-move listener on mouse-up
		document.onmouseup = () => {
			hslider.parentNode.classList.remove('col-resize');
			hslider.classList.remove('resize');
			document.onmousemove = document.onmouseup = null;
		}
	}

	bhslider.onmousedown = function dragMouseDown(e) {
		let dragX = e.clientX;
		bhslider.classList.add('resize');
		bhslider.parentNode.classList.add('col-resize');
		document.onmousemove = function onMouseMove(e) {
			let block = bhslider.previousElementSibling;
			block.style.width = block.offsetWidth + e.clientX - dragX + "px";

			dragX = e.clientX;
		}
		// remove mouse-move listener on mouse-up
		document.onmouseup = () => {
			bhslider.parentNode.classList.remove('col-resize');
			bhslider.classList.remove('resize');
			document.onmousemove = document.onmouseup = null;
		}
	}

  */	 
</script>

<style>
 
  .layout {
    display: flex;
    height: 100%;
    flex-direction: column;
  }

  .top {
  	display: flex;
  	flex-direction: row;
  	grid-row: 1;
  }

	/*
  .top.col-resize {
    cursor: col-resize;
  }
   */

  .bottom {
 
  	flex: 1;
   	min-width: 0; /* adjust automatically  */
  	overflow: hidden; /* allow flexing beyond auto width  */
  	display: flex; /* hide overflow on small width  */
  	flex-direction: row;
  	grid-row: 2;
  }
  
  .block {
  	height: 100%;
  	/* grid-row: 1 / 2;  */
  	width: 50%;
  	/* 50% would suffice */
  }
  
  .block-1 {
  	background-color: red;
  }
  
  .block-2 {
  	background-color: green;
  	flex: 1;
  	/* adjust automatically  */
  	min-width: 0;
  	/* allow flexing beyond auto width // */
  	overflow: hidden;
  	/* hide overflow on small width */
  }
  
  .horizontal-slider {
  	line-height: 100%;
  	width: 4px;
  	background-color: #dee2e6;
  	border: none;
  	cursor: ew-resize;
  	user-select: none;
  	/* disable selection */
  	text-align: center;
  }
  
	/*
  .horizontal-slider:hover {
  	cursor: ew-resize;
  }
  
  .horizontal-slider.col-resize:hover {
    cursor: col-resize;
  }

 */ 
  .vertical-slider {
  	line-height: 4px;
  	width: 100%;
  	background-color: #dee2e6;
  	border: none;
  	cursor: ns-resize;
  	user-select: none;
  	/* // disable selection */
  	text-align: center;
  }
  
	/*
  .vertical-slider:hover {
  	cursor: ns-resize;
  }
  
  .vertical-slider.row-resize:hover {
    cursor: row-resize;
  }

 */ 
  .bottom-horizontal-slider {
  	line-height: 100%;
  	width: 4px;
  	background-color: #dee2e6;
  	border: none;
  	cursor: ew-resize;
  	user-select: none;
  	/* disable selection */
  	text-align: center;
  }
  
  .bottom-horizontal-slider:hover {
  	cursor: ew-resize;
  }
  
	/*
  .bottom-horizontal-slider.col-resize:hover {
    cursor: col-resize;
  }
	*/
</style>

<div class="layout" bind:this={container} on:mousemove={onMouseMove} on:mouseup={onMouseUp}>
	<div class="top" style="height: {topHeight}" bind:offsetHeight={topOffsetHeight}>
		<div class="block block-1">
			Block 1
		</div>
		<div class="horizontal-slider" on:mousedown={dragMouseDownOnHorizontalSlider}>
			S<br>l<br>i<br>d<br>e<br>r
		</div>
		<div class="block block-2">
			Block 2
		</div>
	</div>
	<div class="vertical-slider" on:mousedown={dragMouseDownOnVerticalSlider}>Slider</div>
	<div class="bottom">
		<div class="block block-1">
			Block 1
		</div>
		<div class="bottom-horizontal-slider" on:mousedown={dragMouseDownOnHorizontalSlider}>
			S<br>l<br>i<br>d<br>e<br>r
		</div>
		<div class="block block-2">
			Block 2
		</div>
	</div>
</div>