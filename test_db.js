import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query } from "firebase/firestore";

// Mock minimal config that matches client
const firebaseConfig = {
    projectId: "used-phone-market" 
};

// We just read sheet_data.csv to see the names locally since it's exactly what's loaded
const fs = require('fs');
const data = fs.readFileSync('sheet_data.csv', 'utf-8');
const lines = data.split('\n');
const appleLines = lines.filter(l => l.includes('Apple') || l.includes('아이폰'));
for(let i=0; i<15; i++) {
    if(appleLines[i]) console.log(appleLines[i].split(',')[2]);
}
