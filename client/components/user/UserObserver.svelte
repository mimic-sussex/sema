<script>

  import { onMount } from 'svelte';
  import { currentUser } from '../../stores/user.js';



  onMount(() => {
    firebase.auth().onAuthStateChanged(function(user) {
      if (user) {
        // User is signed in.
        var displayName = user.displayName;
        var email = user.email;
        var emailVerified = user.emailVerified;
        var photoURL = user.photoURL;
        var isAnonymous = user.isAnonymous;
        var uid = user.uid;
        var providerData = user.providerData;

        console.log(`User ${user.displayName} signed in`)
        currentUser.set(user);

      } else {
        // User is signed out.
        currentUser.set(null);
        console.log('user signed out')
      }
    });
  });


</script>

