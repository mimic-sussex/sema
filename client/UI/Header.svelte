<script>
  import Nav from './Nav.svelte';

  import src from '../../assets/img/sema.svg'
</script>


<style>
  
  div {
    display: flex;
    flex-direction: row;
    width: 100%;
    justify-content: space-between;
  }

	h1 {
    margin-top: 5px;
		margin-left: 10px;
    margin-bottom: 0px;
    color: whitesmoke;
	}

  /* .logo-container {
    float: none;
    width: 60%;
    height: 60%;
    margin: 0 auto;
    display: grid;
  }
  
  .sema-logo {
    width: 5%;
    height: auto;
  } */

</style>

<div>
  <h1>sema</h1>
  <!-- <div class="logo-container">
    <img {src} class="sema-logo" alt="sema logo image">
  </div> -->
  <Nav />
</div>

