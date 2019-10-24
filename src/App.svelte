<script>
	export let name;

	export let app = document.querySelector("#app");
	export let slider = document.querySelector(".horizontal-slider");
	export let hslider = document.querySelector(".bottom-horizontal-slider");
	export let vslider = document.querySelector(".vertical-slider");

	hslider.onmousedown = function dragMouseDown(e) {
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

	vslider.onmousedown = function dragMouseDown(e) {
		let dragY = e.clientY;
		vslider.classList.add('resize');
		vslider.parentNode.classList.add('row-resize');
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
</script>

<style>
  #app {
  	height: 250px;
  	background: pink;
  }
  
  /* 
  #app.row-resize {
    cursor: row-resize;
  } */
  
  
  .layout {
  	height: 100%;
  	display: grid;
  	grid-template-columns: 20px 1fr;
  	grid-template-rows: 50% 50%;
  	grid-template-areas:
  		"sidebar layout"
  		"sidebar layout";
  	background-color: purple;
  }
  
  .sidebar {
  	background-color: yellow;
  	grid-area: sidebar;
  	grid-row: 0 / 1;
  	height: 100%;
  }
  
  .quadrants {
  	grid-area: layout;
  	display: flex;
  	flex-direction: column;
  }
  
  /* .quadrants.row-resize {
    cursor: row-resize;
  } */
  
  
  .top {
  	display: flex;
  	flex-direction: row;
  	grid-row: 1;
  }
  
  /* .top.col-resize {
    cursor: col-resize;
  } */
  
  .bottom {
  
  	flex: 1;
  	/* adjust automatically */
  	min-width: 0;
  	/* allow flexing beyond auto width */
  	overflow: hidden;
  	/* hide overflow on small width */
  
  	display: flex;
  	flex-direction: row;
  	grid-row: 2;
  }
  
  .block {
  	height: 100%;
  	/*   grid-row: 1 / 2; */
  	width: 50%;
  	/* 50% would suffice*/
  }
  
  .block-1 {
  	background-color: red;
  }
  
  .block-2 {
  	background-color: green;
  	flex: 1;
  	/* adjust automatically */
  	min-width: 0;
  	/* allow flexing beyond auto width */
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
  
  .horizontal-slider:hover {
  	cursor: ew-resize;
  }
  
  /* .horizontal-slider.col-resize:hover {
    cursor: col-resize;
  } */
  
  .vertical-slider {
  	line-height: 4px;
  	width: 100%;
  	background-color: #dee2e6;
  	border: none;
  	cursor: ns-resize;
  	user-select: none;
  	/* disable selection */
  	text-align: center;
  }
  
  .vertical-slider:hover {
  	cursor: ns-resize;
  }
  
  /* .vertical-slider.row-resize:hover {
    cursor: row-resize;
  } */
  
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
  } */
  
  
</style>

<div id="app">

	<div class="layout">

		<div class="sidebar"></div>

		<div class="quadrants">

			<div class="top">

				<div class="block block-1">
					Block 1
				</div>

				<div class="horizontal-slider">
					S<br>l<br>i<br>d<br>e<br>r
				</div>

				<div class="block block-2">
					Block 2
				</div>
			</div>

			<div class="vertical-slider">Slider</div>

			<div class="bottom">
				<div class="block block-1">
					Block 1
				</div>

				<div class="bottom-horizontal-slider">
					S<br>l<br>i<br>d<br>e<br>r
				</div>

				<div class="block block-2">
					Block 2
				</div>
			</div>
		</div>
	</div>

</div>