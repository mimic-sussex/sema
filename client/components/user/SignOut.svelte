<script>

  import { currentUser } from '../../stores/user.js'
  import { onMount, tick } from 'svelte';
  import { goto } from "@sveltech/routify";
  import * as firebaseui from 'firebaseui'
  import firebase, { auth, app } from '../../firebase/firebase.js';

  import { audioEngineStatus } from '../../store.js';

  let handleClick = () => {
    $audioEngineStatus = "hidden";
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
    // The start method will wait until the DOM is loaded.
    ui.start('#firebaseui-auth-container', uiConfig);  
  }

  const signOut = () => {
    // Handler needs to be async and use tick for Firebase widget to be injected
    auth.signOut().then(async function() {
      // Sign-out successful.
      console.log('DEBUG:Login: Logged out');
      
      await tick();
      createLoginButton(); 

    }).catch( error => {

      console.log('DEBUG:Login:', error);       // An error happened.

    }).finally( () => {

      $goto(`/`);       // Request Routify client-side router navigation to Home `/`
    
    });
  }     

  onMount(() => {
    if(!$currentUser){
      createLoginButton();
    }
  });

</script>

<style>

/* 
  .sign-out-button {
    height: auto;
    width: auto;
    font-size: 14px;
    padding-top: 0.2em; 
    padding-bottom: 0.2em;
    margin-right: 20px;
   
  } */

  .button-dark {
    display: block;
    font-size: 12px;
    font-family: sans-serif;
    font-weight: 400;
    cursor: pointer;
    color: #fff;
    line-height: 1.3;
    padding: 0.7em 1em 0.7em 1em;
    /* width: 100%; */
    max-width: 100%; 
    box-sizing: border-box;
    border: 0 solid #333;
    /* box-shadow: 0 1px 0 0px rgba(4, 4, 4, 0.04); */
    border-radius: .6em;
    margin-top: 5px;
    
    /* border-right-color: rgba(34,37,45, 0.1);
    border-right-style: solid;
    border-right-width: 1px;
    border-bottom-color: rgba(34,37,45, 0.1);
    border-bottom-style: solid;
    border-bottom-width: 1px; */
    -moz-appearance: none;
    -webkit-appearance: none;
    appearance: none;
    background-color:  rgba(16, 16, 16, 0.04);
    /* background-image: url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23007CB2%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E'),
      linear-gradient(to bottom, #ffffff 0%,#e5e5e5 100%); */
    background-repeat: no-repeat, repeat;
    background-position: right .7em top 50%, 0 0;
    background-size: .65em auto, 100%;
    -webkit-box-shadow: 2px 2px 5px rgba(0,0,0),-1px -1px 1px rgb(34, 34, 34);
    -moz-box-shadow: 2px 2px 5px rgba(0,0,0), -1px -1px 1px rgb(34, 34, 34);;
    box-shadow: 2px 2px 3px rgb(0, 0, 0), -1px -1px 3px #ffffff61;
    
  }


</style>

<!-- <button class='button' on:click={ () => login() }> Login </button> -->
{#if $currentUser}
  <button class='button-dark' on:click={ () => signOut() }>SignOut</button>
{/if}
