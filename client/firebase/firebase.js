import "firebase/auth";
import "firebase/firestore";

import firebase from "firebase/app";
// import { authState } from "rxfire/auth";
// import { collectionData } from "rxfire/firestore";
// import { filter } from "rxjs/operators";

// Sema's Firebase configuration
var firebaseConfig = {
	apiKey: "AIzaSyBzllZ93Y_VIXLByg-V2djcsJcokum6ySw",
	authDomain: "sema-4c354.firebaseapp.com",
	databaseURL: "https://sema-4c354.firebaseio.com",
	projectId: "sema-4c354",
	storageBucket: "sema-4c354.appspot.com",
	messagingSenderId: "217754460414",
	appId: "1:217754460414:web:591194d7611f4319fa45af",
	measurementId: "G-B8Q59X8D6Y",
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
// firebase.analytics();

const firestore = firebase.firestore(app); // Initialize firestore
const auth = firebase.auth(app); // Initialize firebase auth
// const loggedIn$ = authState(auth).pipe(filter((user) => !!user)); // Observable only return when user is logged in.
// collectionData, loggedIn$
export { app, auth, firestore, };

export default firebase;



