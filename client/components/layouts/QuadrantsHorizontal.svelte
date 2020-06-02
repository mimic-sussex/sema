<script>
  import Editor from '../editors/Editor.svelte';
  import ModelEditor from '../editors/ModelEditor.svelte';
  import GrammarEditor from '../editors/GrammarEditor.svelte';
  import LiveCodeEditor from '../editors/LiveCodeEditor.svelte';
  import LiveCodeParseOutput from '../widgets/LiveCodeParseOutput.svelte';
  import GrammarCompileOutput from '../widgets/GrammarCompileOutput.svelte';


  import {
    // tutorialOptions,
    selectedTutorial,
    selectedTutorialGrammar
  } from "../../stores/store.js"

 
  let container;

  let leftWidth = 250;
  let leftOffsetWidth;

  let leftTopHeight = 250;
  let leftTopOffsetHeight;

  let rightTopHeight = 250;
  let rightTopOffsetHeight;

  let isMouseDownOnHorizontalSlider;
  let isMouseDownOnRightVerticalSlider;
  let isMouseDownOnVerticalSlider;

  let dragX;
  let dragY;

  //#region Mouse events (mouse down and drag on sliders)
	function onMouseMove(e) {

    if(isMouseDownOnVerticalSlider){
      leftTopHeight = leftTopOffsetHeight + e.clientY - dragY + "px";
      dragY = e.clientY;
    }
    
    if(isMouseDownOnHorizontalSlider){
      leftWidth = leftOffsetWidth + e.clientX - dragX + "px";
      dragX = e.clientX;
    }

    if(isMouseDownOnRightVerticalSlider){
      rightTopHeight = rightTopOffsetHeight + e.clientY - dragY + "px";
      dragY = e.clientY;
    }
	}

	function onMouseUp () {
    isMouseDownOnVerticalSlider = isMouseDownOnRightVerticalSlider = isMouseDownOnHorizontalSlider = false;
	}  

  function dragMouseDownOnVerticalSlider(e) {
    isMouseDownOnVerticalSlider = true;
    dragY = e.clientY;
	}

  function dragMouseDownOnHorizontalSlider(e) {
    isMouseDownOnHorizontalSlider = true;
    dragX = e.clientX;
	}

  function dragMouseDownOnRightVerticalSlider(e) {
    isMouseDownOnRightVerticalSlider = true;
    dragY = e.clientY;
	}
  //#endregion

  const unsubscribe = selectedTutorial.subscribe(value => {
    // console.log("DEBUG:QuadrantsHorizontal:selectedTutorial: ", value.id);
    // console.log($selectedTutorialGrammar);
    // $selectedTutorialGrammar = tutorialOptions[value.id-1].content;
   
  })
	// onDestroy(unsubscribe); // Prevent memory leaks by disposing the componen



</script>

<style>
 
  .quadrants {
    display: flex;
    height: 100%;
    flex-direction: row;
  }

  .left {
  	display: flex;
  	flex-direction: column;
    height: 100%;
    width: 50%; 
  }

  .right {
   	flex: 1;
   	min-width: 0; /* adjust automatically  */
  	overflow: hidden; /* allow flexing beyond auto width  */
  }

  .block-live-code-editor {
  	background-color: rgb(39, 39, 39);
    height: 66%;
  }

  .block-live-grammar-editor {
    background-color: rgb(253, 253, 253);
    flex: 1;
  	min-width: 0;
    height: 66%;
  	/* overflow: hidden; */
    /* min-width: 0; adjust automatically  */
  	/* overflow: hidden; */
  }

  .block {
  	height: 100%;
  	width: 100%;
    flex: 1;
  	min-width: 0;
  	overflow: hidden;
  }

  .block-1 {
  	background-color: rgb(179, 179, 179);
  }
  
  .block-2 {
  	background-color: rgb(226, 226, 226);
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
  .horizontal-slider:hover {
  	cursor: ew-resize;
  }
  .vertical-slider {
  	line-height: 10px;
    height: 4px;
  	width: 100%;
  	background-color: #dee2e6;
  	border: none;
  	cursor: ns-resize;
  	user-select: none;
  	/* // disable selection */
  	text-align: center;
  }
  
  .vertical-slider:hover {
  	cursor: ns-resize;
  }

  /* .scrollable {
		flex: 1 1 auto;
		border-top: 1px solid #eee;
		margin: 0 0 0.5em 0;
		overflow-y: auto;
	}
   */
</style>

<div class="quadrants" bind:this={container} on:mousemove={onMouseMove} on:mouseup={onMouseUp}>

	<div class="left" style="width:{leftWidth}" bind:offsetWidth={leftOffsetWidth}>

    <div class="block-live-code-editor" style="height:{leftTopHeight}" bind:offsetHeight={leftTopOffsetHeight}>
      <slot name="liveCodeEditor">
        <em>no content was provided</em>
      </slot>
    </div> 

    <div class="vertical-slider" on:mousedown={dragMouseDownOnVerticalSlider}>  </div>	

 		<div class="block block-1">
  	  <slot name="liveCodeCompilerOutput">
        <em>no content was provided</em>
      </slot>	
 		</div>

   </div>

		<div class="horizontal-slider" on:mousedown={dragMouseDownOnHorizontalSlider}>
			<!-- S<br>l<br>i<br>d<br>e<br>r -->
		</div>

		<div class="right">

     	<div class="block-live-grammar-editor" style="height: {rightTopHeight}" bind:offsetHeight={rightTopOffsetHeight}>
        <slot name="grammarEditor">
          <em>no content was provided</em>
        </slot>
      </div>

      <div class="vertical-slider" on:mousedown={dragMouseDownOnRightVerticalSlider}>  </div>

      <div class="block block-2">
  	    <slot name="grammarOutput">
          <em>no content was provided</em>
        </slot>	
		  </div>

		</div>

</div>

