const admin = require('firebase-admin');

// Ensure you have a service account key or are authenticated via ADC
// For this local check, assuming ADC is configured or testing exists
try {
    admin.initializeApp();
} catch (e) {
    console.log("Error initializing, trying firebase-config?", e.message);
}

const db = admin.firestore();

async function checkDeletedQuotes() {
    console.log("Checking for quotes by '조은혜' or '김민서'...");

    try {
        const q1 = await db.collection("quotes").where("customerName", "==", "조은혜").get();
        console.log(`Found ${q1.size} records for '조은혜'`);
        q1.forEach(doc => console.log(doc.id, doc.data()));

        const q2 = await db.collection("quotes").where("customerName", "==", "김민서").get();
        console.log(`Found ${q2.size} records for '김민서'`);
        q2.forEach(doc => console.log(doc.id, doc.data()));

    } catch (error) {
        console.error("Error querying Firestore:", error.message);
        console.log("Since firebase-admin might not have credentials here, we might need another approach.");
    }
}

checkDeletedQuotes();
