import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, getDocs } from "firebase/firestore";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkDeletedQuotes() {
    console.log("Checking for quotes by '조은혜' or '김민서'...");

    try {
        const q1 = query(collection(db, "quotes"), where("customerName", "==", "조은혜"));
        const snapshot1 = await getDocs(q1);
        console.log(`Found ${snapshot1.size} records for '조은혜'`);
        snapshot1.forEach(doc => console.log(doc.id, doc.data()));

        const q2 = query(collection(db, "quotes"), where("customerName", "==", "김민서"));
        const snapshot2 = await getDocs(q2);
        console.log(`Found ${snapshot2.size} records for '김민서'`);
        snapshot2.forEach(doc => console.log(doc.id, doc.data()));

    } catch (error) {
        console.error("Error querying Firestore:", error);
    }
}

checkDeletedQuotes();
