<script>

  import { onMount } from 'svelte';
  import { currentUser } from '../../stores/user.js';
  // import firebase, { app, firestore } from '../../firebase/firebase.js';
  import { app, auth, firestore } from '../../firebase/firebase.js';
  
  onMount(() => {
    auth.onAuthStateChanged(function(user) {
      if (user) {
        // User is signed in.
        let displayName = user.displayName;
        let email = user.email;
        let emailVerified = user.emailVerified;
        let photoURL = user.photoURL;
        let isAnonymous = user.isAnonymous;
        let uid = user.uid;
        let providerData = user.providerData;

        console.log(`DEBUG:UserObserver: User ${user.displayName} signed in`)
        currentUser.set(user);

        firestore.collection('Users').onSnapshot(data => {
          let users = data.docs;
          // check if current user persists in db
          if( users.filter( u => u.data().uid === uid ).length === 0 )
            // if not, add it to db
            firestore.collection('Users').add({ 
              displayName, 
              email, 
              emailVerified, 
              photoURL, 
              isAnonymous, 
              uid, 
              providerData
            });
        });
      } else {
        // User is signed out.
        console.log(`DEBUG:UserObserver: User signed out`)
        currentUser.set(null);
      }
    });
  });


</script>

