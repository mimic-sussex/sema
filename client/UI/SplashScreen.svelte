<script>
  import { splashScreenClicked } from '../store.js';
  import src from '../../assets/img/sema.png';
  import ico from '../../assets/img/favicon.ico';
  
  let handleClick = () => {
    $splashScreenClicked = "hidden";
  }
</script>

<style>

  .overlay {
    position: fixed;
    /* Sit on top of the page content */
    display: grid;
    /* Hidden by default */
    width: 100%;
    /* Full width (cover the whole page) */
    height: 100%;
    /* Full height (cover the whole page) */
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    justify-self: center;
    align-content: center;
    background-color: rgba(0, 0, 0, 0.85);
    /* Black background with opacity */
    z-index: 4;
    /* Specify a stack order in case you're using a different order for other elements */
    cursor: auto;
    /* Add a pointer on hover */
    visibility: visible;
  }

  .button-start-audio {
    margin:0 auto;
    display:block;
    width: 350px;
    height: 350px;
    align-self: stretch;
    font-size: 200%;
    font-family:monospace;
    cursor: pointer;
    border-radius: .4em;
  }

  .logo-container {
    float: none;
    width: 45%;
    height: 55%;
    margin: 0 auto;
    display: grid;
  }
  
  .sema-logo {
    width: 100%;
    height: auto;
  }

  .sema-type {
    width: 100%;
    height: auto;
    font-size:150%;
    margin: 0px 0px 0px 0px;
    color: rgb(50, 50, 50);
    /* font-family: 'LatoWebBlack';  */
  }
</style>

<div class="overlay" style='visibility:{$splashScreenClicked}'>
  <button class="button-start-audio" on:click={handleClick}>
    <div class="logo-container">
      <img {src} class="sema-logo" alt="sema logo image">
      <span class="sema-type">Sema</span>
      <br>
      <br>
    </div>
  </button>
</div>
