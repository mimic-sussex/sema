<script>
	// import Nav from '../components//Nav.svelte';
	import UserObserver from '../components/user/UserObserver.svelte';

	export let segment;
</script>

<style>

  div {
    display: flex;
    flex-direction: row;
    width: 100%;
    justify-content: space-between;
    background: linear-gradient(150deg, rgba(0,18,1,1) 0%, rgba(7,5,17,1) 33%, rgba(16,12,12,1) 67%, rgba(18,16,16,1) 100%);
  }
  
	h1 {
    margin-top: 5px;
		margin-left: 10px;
    margin-bottom: 0px;
    color: whitesmoke;
	}

  ul {
    display: flex;
    list-style-type: none;
  }

  li {
    margin-right: 15px;
  }


  /* unvisited link */
  /* span:link {
    color: white;
  } */

  /* visited link */
  /* span:visited {
    color: white;
  }

  span:hover {
    color: rgb(0, 94, 255);
    text-decoration: none;
    cursor: pointer;
  }

  span:active {
    color: rgb(0, 94, 255);
  }

  .whiteText {
    color: whitesmoke;
    
  } */

  a, a:hover {
    color: whitesmoke;
  }
  a:hover {
    color: rgb(0, 94, 255);
  }

  path:hover {
    fill: rgb(0, 94, 255);
  }

  path {
    fill: #0050A0;
  }

</style>

<svelte:head>
  <link type="text/css" rel="stylesheet" href="https://www.gstatic.com/firebasejs/ui/4.5.0/firebase-ui-auth.css" />
	<title>Sema</title>
</svelte:head>

<UserObserver />


<div>
  <h1>sema</h1>

  <ul>
  <!-- <li>
    <span style="color:white" on:click={handleCClick}>Canvas</span>
  </li> -->  
    <li><a href="/">Home</a></li>

    <li><a href="/playground">Playground</a></li>

    <li><a href="/tutorial">Tutorial</a></li>

    <!-- <li><a href="/docs">Docs</a></li> -->
    <li><a href='https://github.com/mimic-sussex/sema/tree/master/docs' target="_blank">Docs</a></li>

    <li><a href="/blog/">Blog</a></li>

    <li>
      <a href='https://forum.toplap.org/c/communities/sema' target="_blank">
        <svg class="icon svelte-5yec39" width="25" height="20">
          <use xlink:href="#community"></use>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
      </a>
    </li>

    <li>
      <a href='https://github.com/mimic-sussex/sema' target="_blank">
        <svg class="icon svelte-5yec89" width="25" height="20">
          <use xlink:href="#github"></use>
          <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
        </svg>
      </a>
    </li>

  </ul>
</div>
<slot></slot>
