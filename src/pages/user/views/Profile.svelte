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
  export let username;

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
    height: 30%;
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

</style>

<div class='whole-profile-container'>

  <div class='profile-info-container'>

    <canvas class='qr-canvas'
    bind:this={canvas}
    width={width}
    height={height}
    >

    </canvas>

    <h2>{profileData.username}</h2>
    Website: <span>{profileData.website}</span>

    {#if profileData.username == $userName}
      <hr>
      <span>This is your public profile! To edit your profile go <a href='/admin'>here</a>.</span>
    {/if}

  </div>

  <div class='projects-header-container'>
    <h2>Projects:</h2>
  </div>
  <div class='projects-container'>
    
    {#if projects}

    
      <ul>
        {#each projects as project}
          <li><a href="/playground/{project.id}">{project.name}</li>
            
        {/each}
      </ul>
    


    {:else}
    No projects yet :(
    {/if}
  </div>

</div>
