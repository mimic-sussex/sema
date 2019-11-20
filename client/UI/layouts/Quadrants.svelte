<script>

  import Editor from '../Editor.svelte';
  let container;

  let leftTopBlockWidth = 250;
  let leftTopBlockOffsetWidth;
  
  let leftBottomBlockWidth = 250;
  let leftBottomBlockOffsetWidth;
  // let dragX;
  // let isMouseDownOnHorizontalSlider;

  let isMouseDownOnHorizontalSlider;
  let isMouseDownOnBottomHorizontalSlider
  let dragX;

  let topHeight = 600;
  let topOffsetHeight;
  let dragY;
  let isMouseDownOnVerticalSlider;
  
	function onMouseMove(e) {
		// let top = vslider.previousElementSibling;
    if(isMouseDownOnVerticalSlider){
      topHeight = topOffsetHeight + e.clientY - dragY + "px";
      dragY = e.clientY;
      // console.log(topHeight)
    }
    
    if(isMouseDownOnHorizontalSlider){
      leftTopBlockWidth = leftTopBlockOffsetWidth + e.clientX - dragX + "px";
      dragX = e.clientX;
      // console.log(topWidth)
    }

    if(isMouseDownOnBottomHorizontalSlider){
      leftBottomBlockWidth = leftBottomBlockOffsetWidth + e.clientX - dragX + "px";
      dragX = e.clientX;
      // console.log(topWidth)
    }
	}

	function onMouseUp () {
    isMouseDownOnVerticalSlider = isMouseDownOnBottomHorizontalSlider = isMouseDownOnHorizontalSlider = false;
    // console.log("mouseUp", dragY);
	}  

  function dragMouseDownOnVerticalSlider(e) {
    isMouseDownOnVerticalSlider = true;
    dragY = e.clientY;
    // console.log("mouseOnVSlider: ", dragY );
	}

  function dragMouseDownOnHorizontalSlider(e) {
    isMouseDownOnHorizontalSlider = true;
    dragX = e.clientX;
    // console.log("mouseOnVSlider: ", dragY );
	}

  function dragMouseDownOnBottomHorizontalSlider(e) {
    isMouseDownOnBottomHorizontalSlider = true;
    dragX = e.clientX;
    // console.log("mouseOnVSlider: ", dragY );
	}


</script>

<style>
 
  .quadrants {
    display: flex;
    height: 100%;
    flex-direction: column;
  }

  .top {
  	display: flex;
  	flex-direction: row;
    height: 50%;
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
  	width: 50%;
  }

  .block-live-code-editor {
  	background-color: lightgray;
  }

  .block-live-grammar-editor {
    background-color: gray;
    flex: 1;
  	min-width: 0;
  	overflow: hidden;
    /* min-width: 0; adjust automatically  */
  	/* overflow: hidden; */
  }

  .block-1 {
  	background-color: red;
  }
  
  .block-2 {
  	background-color: green;
  	flex: 1;
  	min-width: 0;
  	overflow: hidden;
  }
  
  .horizontal-slider {
  	line-height: 100%;
  	width: 4px;
  	background-color: #dee2e6;
  	border: none;
  	cursor: ew-resize;
  	user-select: none;
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
    justify-content: stretch;   
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

<div class="quadrants" bind:this={container} on:mousemove={onMouseMove} on:mouseup={onMouseUp}>
	<div class="top" style="height: {topHeight}" bind:offsetHeight={topOffsetHeight}>
		<div class="block block-live-code-editor" style="width: {leftTopBlockWidth}" bind:offsetWidth={leftTopBlockOffsetWidth} >
	    <slot name="liveCodeEditor">
        <em>no content was provided</em>
      </slot>
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
		<div class="block block-1" style="width: {leftBottomBlockWidth}" bind:offsetWidth={leftBottomBlockOffsetWidth}>
	    <slot name="grammarEditor">
        <em>no content was provided</em>
      </slot>	
		</div>
		<div class="bottom-horizontal-slider" on:mousedown={dragMouseDownOnBottomHorizontalSlider}>
			S<br>l<br>i<br>d<br>e<br>r
		</div>
		<div class="block-live-grammar-editor">
	    <slot name="modelEditor">
        <em>no content was provided</em>
      </slot>	
    </div>
	</div>
</div>