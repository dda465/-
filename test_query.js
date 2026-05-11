const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, getDocs, orderBy, limit } = require('firebase/firestore');

const firebaseConfig = {
    apiKey: "AIzaSyDa-example-key-just-placeholder-if-needed",
    authDomain: "used-phone.firebaseapp.com",
    projectId: "used-phone",
    storageBucket: "used-phone.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef"
};

// We will extract config from the app
const fs = require('fs');
const content = fs.readFileSync('./firebase-config.js', 'utf8');

// Quick parsing of config from the file
const match = content.match(/const firebaseConfig = ({[\s\S]*?});/);
if (match) {
    const configStr = match[1].replace(/([a-zA-Z0-9_]+):/g, '"$1":').replace(/'/g, '"');
    const realConfig = JSON.parse(configStr);

    const app = initializeApp(realConfig);
    const db = getFirestore(app);

    async function run() {
        const q = query(collection(db, 'quotes'), orderBy('timestamp', 'desc'), limit(5));
        const docs = await getDocs(q);
        docs.forEach(d => {
            const data = d.data();
            if (data.customerName === '조은혜') {
                console.log("Found:", JSON.stringify(data, null, 2));
            }
        });
        process.exit(0);
    }
    run().catch(console.error);
} else {
    console.log("Could not find config");
}
