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

// Import only essential modules synchronously (App + Auth + Firestore)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Initialize Firebase (core only)
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Analytics: lazy-load after page load to avoid blocking render ---
let analytics = null;
if (typeof window !== 'undefined') {
    window.addEventListener('load', async () => {
        try {
            const { getAnalytics } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js");
            analytics = getAnalytics(app);
        } catch (e) {
            console.warn('Analytics lazy-load failed:', e);
        }
    });
}

// --- Storage: lazy-load on demand (only used for review image uploads) ---
let _storage = null;
async function getStorageLazy() {
    if (!_storage) {
        const { getStorage } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js");
        _storage = getStorage(app);
    }
    return _storage;
}
// Keep backward-compatible `storage` export as a proxy getter
const storage = new Proxy({}, {
    get(target, prop) {
        console.warn('Direct storage access detected. Use getStorageLazy() instead for better performance.');
        return undefined;
    }
});

export { auth, db, storage, analytics, getStorageLazy };
