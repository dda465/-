// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCMYsqtZzHnXjMGvdum4l3SVn_MG78m0Nc",
    authDomain: "rejeuphone.firebaseapp.com",
    projectId: "rejeuphone",
    storageBucket: "rejeuphone.firebasestorage.app",
    messagingSenderId: "1401756577",
    appId: "1:1401756577:web:d07a5f0e304ab048e749e0",
    measurementId: "G-JWS15NH588"
};

// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
let analytics = null;
if (typeof window !== 'undefined') {
    analytics = getAnalytics(app);
}

export { auth, db, storage, analytics };
