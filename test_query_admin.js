const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function getJoInfo() {
    const snapshot = await db.collection('quotes').orderBy('timestamp', 'desc').get();
    let found = false;
    snapshot.forEach(doc => {
        const data = doc.data();
        if (data.customerName === '조은혜' && !found) {
            console.log(JSON.stringify(data, null, 2));
            found = true;
        }
    });
}
getJoInfo().catch(console.error);
