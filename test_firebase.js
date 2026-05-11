const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query } = require('firebase/firestore');

const firebaseConfig = {
    apiKey: "AIzaSyCMYsqtZzHnXjMGvdum4l3SVn_MG78m0Nc",
    projectId: "rejeuphone"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
    const q = query(collection(db, "models"));
    const querySnapshot = await getDocs(q);
    const models = [];
    querySnapshot.forEach(doc => {
        const d = doc.data();
        models.push(d.modelName || 'undefined');
    });

    console.log("--- Apple Models ---");
    models.filter(m => m.includes('아이폰') || m.includes('Apple')).forEach(m => console.log(m));
    console.log("--- Samsung S25 Models ---");
    models.filter(m => m.toLowerCase().includes('s25')).forEach(m => console.log(m));
    process.exit(0);
}
run();
