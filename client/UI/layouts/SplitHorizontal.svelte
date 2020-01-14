<script>
  import Editor from '../Editor.svelte';

  // export let liveCodeEditor; 
  // export let grammarEditor; 

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
  let isMouseDownOnVerticalSlider
  
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
    height: 100%; /* Live layout stretches height all the way */
  }

  .block {
  	height: 100%;
  	width: 50%;
  }

  .block-live-code-editor {
  	background-color: lightgray;
  }

  .block-2 {
  	background-color: rgb(203, 190, 215);
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
      <slot name="grammarEditor">
        <em>no content was provided</em>
      </slot>
		</div>
	</div>
</div>