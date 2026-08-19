
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const firebaseConfig = { projectId: 'used-phone' }; // if it uses admin, I should just copy test_query.js
