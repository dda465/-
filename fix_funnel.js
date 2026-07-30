const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function fixFunnelData() {
    const todayStr = '2026-06-05';
    
    // Add 4 to quote_complete for today and total
    const updates = {
        quote_complete: admin.firestore.FieldValue.increment(4),
        quote_complete_direct: admin.firestore.FieldValue.increment(4) 
    };

    await db.collection('analytics').doc(`funnel_${todayStr}`).set(updates, { merge: true });
    await db.collection('analytics').doc('funnel').set(updates, { merge: true });
    
    console.log("Successfully fixed funnel data for quote_complete.");
    process.exit(0);
}

fixFunnelData().catch(console.error);
