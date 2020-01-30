<script>
  import Grid from "svelte-grid";
  import gridHelp from "svelte-grid/build/helper";
  import map from "lodash.map";
  import Editor from '../editors/Editor.svelte';
  import ModelEditor from '../editors/ModelEditor.svelte';
  import GrammarEditor from '../editors/GrammarEditor.svelte';
  import LiveCodeEditor from '../editors/LiveCodeEditor.svelte';
  import LiveCodeParseOutput from '../widgets/LiveCodeParseOutput.svelte';
  import GrammarCompileOutput from '../widgets/GrammarCompileOutput.svelte';
  
  import {
    dashboardItems,
    selectedItem,
    selectedItemControls
  } from "../../store.js"


  export function addNewLiveCodeEditor(){

    
    
  }

  export let value = '';

  const id = () =>
    "_" +
    Math.random()
      .toString(36)
      .substr(2, 9);

  const types = ['live', 'model', 'grammar', 'liveCodeParseOutput', 'grammarCompileOutput' ];
  const itype = () => types[Math.floor(Math.random() * types.length)];

  const random = (min, max) => Math.random() * (max - min) + min;

  const randomHexColorCode = () => {
    let n = (Math.random() * 0xfffff * 1000000).toString(16);
    return "#" + n.slice(0, 6);
  };

  function generateLayout(col) {
    return map(new Array(5), function(item, i) {
      const x = Math.ceil(Math.random() * 3) + 2;
      const y = Math.ceil(Math.random() * 4) + 1;
      const iid = id();
      return {
        ...gridHelp.item({
          x: (i * 2) % col,
          y: Math.floor(i / 6) * y,
          w: x,
          h: y,
          id: iid,
          name: iid,
          type: itype()
        }),
        ...{ data: randomHexColorCode() },
      };
    });
  }

  let layoutOriginal = [
    gridHelp.item({ x: 0, y: 0, w: 7, h: 3, id: id(), name:'default', type:'live', data: '#AA8000' }), 
    gridHelp.item({ x: 7, y: 0, w: 8, h: 7, id: id(), name:'default', type:'grammar', data: '#00FFFF' }),
    gridHelp.item({ x: 0, y: 3, w: 7, h: 4, id: id(), name:'hello world', type:'model', data: '#008080' }),
    gridHelp.item({ x: 0, y: 7, w: 4, h: 4, id: id(), name:'hello world', type:'liveCodeParseOutput', data: '#F0AA80' }),
    gridHelp.item({ x: 0, y: 11, w: 4, h: 4, id: id(), name:'hello world', type:'grammarCompileOutput', data: '#F0AA80' })
  ];
  
  let layout;

  let items = [];

  if (typeof window !== "undefined") {
    if (!localStorage.getItem("layout")) {
      localStorage.setItem("layout", JSON.stringify(layoutOriginal));
      items = layoutOriginal; 
    } else {
      items = JSON.parse(localStorage.getItem("layout"));
    }
  }
  
  // let items = layout;
  // console.log('DEBUG:Dashboard:items:');
  // console.log(items);


  const onAdjust = () => {
    localStorage.setItem("layout", JSON.stringify(items));
  };
  
  const reset = () => {
    items = layoutOriginal;
    localStorage.setItem("layout", JSON.stringify(layoutOriginal));
  };

  export const addItem = (itemType) => {
    const i = 2;
    const col = 2;
    const x = Math.ceil(Math.random() * 3) + 2;
    const y = Math.ceil(Math.random() * 4) + 1;
    const iid = id();
    items = [
      ...items, 
      { ...gridHelp.item({
              x: (i * 2) % col,
              y: Math.floor(i / 6) * y,
              w: x,
              h: y,
              id: iid,
              name: iid,
              type: itype()
            }),
        ...{ data: randomHexColorCode() }
      }
    ]
     
    $dashboardItems = gridHelp.resizeItems(items, cols);
  }

  var cols = 15;

  // items = generateLayout(cols);
  $dashboardItems = gridHelp.resizeItems(items, cols);

  let breakpoints = [[1000, 10], [700, 5], [500, 3], [400, 1]];
</script>


<style>
  .layout-template-container {
    height: 100vh;
  }

  .content {
    width: 100%;
    height: 100%;
    border-radius: 6px;
    border-bottom-right-radius: 3px;
  }

  :global(*) {
    user-select: none;
  }

  :global(body) {
    overflow: scroll;
    margin: 0;
  }

  :global(.svlt-grid-resizer) {
    z-index: 1500;
  }

  :global(.svlt-grid-resizer::after) {
    border-color: white !important;
  }

  :global(.svlt-grid-transition > .svlt-grid-item) {
    transition: transform 0.2s;
  }

  :global(.svlt-grid-shadow) {
    background: pink;
    border-radius: 6px;
    border-bottom-right-radius: 3px;
    /*transition: top 0.2s, left 0.2s;*/
    transition: transform 0.2s;
  }

</style>

<div class="layout-template-container">
  <Grid useTransform {breakpoints} on:adjust={onAdjust} gap={1} {$dashboardItems} bind:items {cols} rowHeight={100} let:item>
    <div class="content" style="background: {item.static ? '#ccccee' : item.data}" >
      {#if item.type === 'model' }
      <ModelEditor bind:value={value}/>
      {:else if item.type === 'grammar' }
      <GrammarEditor bind:value={value}/>
      {:else if item.type === 'live' }
      <LiveCodeEditor bind:value={value}/>
      {:else if item.type === 'liveCodeParseOutput' }
      <LiveCodeParseOutput/>
      {:else if item.type === 'grammarCompileOutput' }
      <GrammarCompileOutput/>
      {:else}
      <Editor bind:value={value}/>
      {/if}
    </div>
  </Grid>
</div>
