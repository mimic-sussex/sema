<!-- PROFILE component for /user/username -->

<script>

import {
		user,
		userName,
		websiteURL,
		avatarURL,
		loggedIn,
		loading
	} from '../../../stores/user'

  import {
    onMount,
    onDestroy
  } from 'svelte';

  import QRCode from 'qrcode'

  let canvas;
  let width = 200;
  let height = 200;


  export let profileData;
  export let projects;
  // export let username;

  // console.log('projects', projects)

  onMount( async () => {

  drawQR();
  // draw();
  
  });

  function drawQR(){
    QRCode.toCanvas(canvas,
      window.location.href, { toSJISFunc: QRCode.toSJIS }, function (error) {
      if (error) console.error(error)
      console.log('success!')
    })
  }

  function draw() {
    if (canvas.getContext) {
      var ctx = canvas.getContext('2d');

      // ctx.fillRect(25, 25, 100, 100);
      // ctx.clearRect(45, 45, 60, 60);
      // ctx.strokeRect(50, 50, 50, 50);
    }
  }

  function copyCanvas(){

    // var ctx = canvas.getContext('2d');
    // ctx.font = '12px serif';
    // ctx.fillText($userName, 0, 0);

    // canvas.toBlob(function(blob) { 
    //   const item = new ClipboardItem({ "image/png": blob });
    //   navigator.clipboard.write([item]); 
    // });
    
    const link = document.createElement('a');
    link.download = `${$userName}'s sema profile QR.png`;
    link.href = canvas.toDataURL();
    link.click();
    link.delete;
    
  }



</script>

<style>

  .whole-profile-container {
    /* display:flex;
    justify-content:center;
    align-items:center; */

    height: 100%;
		overflow:auto;
		margin-left: auto;
		margin-right: auto;
		/* padding-top: 2em; */
		padding-bottom: 2em;
    padding-top:2em;

    display: grid;
  	grid-template-areas:
      "header header"
      "profile projects-header"
  		"profile projects";

		grid-template-columns: 15em 1fr;
    grid-template-rows: auto auto 1fr;
  }

  .projects-header-container {
    grid-area:projects-header;
    margin-right: 1em;
    margin-left: 1em;
  }
  .profile-info-container {
    grid-area: profile;
    margin-right: 1em;
    margin-left: 1em;
  }

  .projects-container {
    grid-area:projects;
    height: 30em;
    /* overflow-y: scroll; */
    overflow:auto;
    /* position:absolute; */
    margin-right: 1em;
    margin-left: 1em;
  }

  .qr-canvas {
    border-radius:5px;
    border:3px solid #ccc;
  }

  a {
    color: #ccc;
  }

  h2, h3 {
    margin-bottom: 5px;
  }

  h3 {
    margin-top:0px;
  }

  table {
	width:20em;
	border-collapse: collapse;
  border-radius:5px;
}

  th {
    text-align:left;
    color: #ccc;
    font-size:18px;
    padding: 10px;
    position:fixed;
  }

  td {
    padding:5px;
    /* text-align:center; */
  }

tr:nth-child(even) {background: #262a2e;}
tr:nth-child(odd) {background:#212529;}

table tr:last-child td:first-child {
    border-bottom-left-radius: 5px;
    border-bottom-right-radius: 5px;
}

table tr:first-child td:first-child {
    border-top-left-radius: 5px;
    border-top-right-radius: 5px;
}

/* table tr:last-child td:last-child {
    border-bottom-right-radius: 5px;
} */


  .hide {
    display: none;
    margin-top: -50px;
    z-index:1;
    position:absolute;
  }

  canvas:hover + .hide {
    display: block;
    color: red;
  }

  .hide:hover{
    display: block;
  }

  .button-dark {
		padding: 20;
		color: grey;
		border: none;
    /* width: 42px; */
  	/* height: 42px; */
  	margin: 8px 8px 8px 16px;
  	border-radius: 5px;
  	background-color: #262a2e;
	}
  .button-dark:hover {
    /* background-color: blue; */
    color: white;
  }

  .button-dark:active{
    color: white;
    background-color: grey;
  }

</style>

<div class='whole-profile-container'>

  <div class='profile-info-container'>

    <canvas class='qr-canvas'
    bind:this={canvas}
    width={width}
    height={height}
    >
    </canvas>
    <div class="hide">
      <button class='button-dark' on:click={()=>copyCanvas()}>
        
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-download" viewBox="0 0 16 16">
          <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
          <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
        </svg>

        Profile QR
      </button>
    </div>


    <h2>{profileData.username}</h2>
    {#if profileData.website}
      <a href='{'https://'+profileData.website}'>{profileData.website}</a>
    {/if}
    {#if profileData.username == $userName}
      <hr>
      <span>This is your public profile! To edit your profile go <a href='/admin'>here</a>.</span>
    {/if}

  </div>

  <div class='projects-header-container'>
    <h3>Projects</h3>
  </div>
  <div class='projects-container'>
    
    {#if projects}

    <table>

			<!-- <tr>
				<th>Name</th>
			</tr>

      <br><br> -->
      {#each projects as project}
        <tr>
          <td><a href="/playground/{project.id}">{project.name}</td>
        </tr>
      {/each}
    
      <!-- <ul>
        {#each projects as project}
          <li><a href="/playground/{project.id}">{project.name}</li>
            
        {/each}
      </ul> -->
    
    </table>

    {:else}
    No projects yet :(
    {/if}
  </div>

</div>
