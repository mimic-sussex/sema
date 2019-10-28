<script>
  import Header from './Header.svelte';
	import Content from './Content.svelte';

  export let name;
</script>

<style>
  #app {
  	height: 100%;
  	background: pink;
    overflow-y: hidden; /* hide vertical */
  }
</style>

<div id="app">

  <Header></Header>

  <Content></Content>

</div>