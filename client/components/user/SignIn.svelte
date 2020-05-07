<script>

  import { currentUser } from '../../stores/user.js'
  import { onMount, tick } from 'svelte';
  import * as firebaseui from 'firebaseui'
  import firebase, { app } from '../../firebase/firebase.js';

  import { goto } from "@sveltech/routify";

  import { splashScreenClicked } from '../../store.js';

  let handleClick = () => {
    $splashScreenClicked = "hidden";
  }



  const createLoginButton = () => {
    // FirebaseUI config – We might want users to provide a Google Account 
    // or fetch the email address associated to GitHub account 
    // Configuration code extracted from:
    // https://github.com/firebase/firebaseui-web#using-firebaseui-for-authentication
    var uiConfig = {
      // signInSuccessUrl: '<url-to-redirect-to-on-success>',
      signInOptions: [
        // # Leave the lines as is for the providers you want to offer your users.
        firebase.auth.GoogleAuthProvider.PROVIDER_ID,
        // firebase.auth.FacebookAuthProvider.PROVIDER_ID,
        // firebase.auth.TwitterAuthProvider.PROVIDER_ID,
        firebase.auth.GithubAuthProvider.PROVIDER_ID,
        // firebase.auth.EmailAuthProvider.PROVIDER_ID,
        // firebase.auth.PhoneAuthProvider.PROVIDER_ID,
        firebaseui.auth.AnonymousAuthProvider.PROVIDER_ID
      ],
      callbacks: {
        signInSuccessWithAuthResult: function(authResult, redirectUrl) {
          // If a user signed in with email link, ?showPromo=1234 can be obtained from
          // window.location.href.
          // ...

          // trigger 'Sign In as Guest' to change button visibility and kickstart Audio Engine
          handleClick();          

          return false;
        }  
      }
      // # tosUrl and privacyPolicyUrl accept either url string or a callback
      // # function.
      // # Terms of service url/callback.
      // tosUrl: '<your-tos-url>',
      // # Privacy policy url/callback.
      // privacyPolicyUrl: function() {
      //   window.location.assign('<your-privacy-policy-url>');
      // }
    };
    // # Initialize the FirebaseUI Widget using Firebase, 
    // var ui = new firebaseui.auth.AuthUI(firebase.auth());
    // # or if already logged in, get the existing instance
    var ui = firebaseui.auth.AuthUI.getInstance() || new firebaseui.auth.AuthUI(firebase.auth());
    // The start method below will wait until the DOM is loaded.

     

    ui.start('#firebaseui-auth-container', uiConfig);  


  }

  // const signOut = () => {
  //   // Handler needs to be async and use tick for Firebase widget to be injected
  //   firebase.auth().signOut().then(async function() {
  //     // Sign-out successful.
  //     console.log('DEBUG:Login: Logged out');
      
  //     await tick();
  //     createLoginButton(); 

  //   }).catch(function(error) {
  //     // An error happened.
  //     console.log('DEBUG:Login:', error);
    
  //   }).finally(() => {
  //     $goto(`/`); // Request Routify client-side router navigation to Home `/`
  //   });

    
  // }     

  onMount(() => {
    if(!$currentUser){
      createLoginButton();
    }
  });

</script>

<style>
/* 
  .sign-in-guest-button {
    height: 40px;
    width: 187px;
    font-size: 14px;
    font-family: Arial, Helvetica, sans-serif;
  } */

</style>

<!-- <button class='button' on:click={ () => login() }> Login </button> -->
{#if !$currentUser}
<!-- <button on:click={ () => signOut() }>SignOut</button> -->
<!-- {:else} -->
<!-- 
<button class='sign-in-guest-button' 
        on:click={ handleClick } 
        > Sign in as Guest </button>  -->

  <div id='firebaseui-auth-container'></div>
{/if}
