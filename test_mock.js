const fs = require('fs');
let html = fs.readFileSync('quote-foreigner.html', 'utf8');
let js = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];

// Mock Firebase imports
js = js.replace(/import { initializeApp } from ".*?";/, 'const initializeApp = () => {};');
js = js.replace(/import { getFirestore, collection, getDocs, addDoc } from ".*?";/, 'const getFirestore = () => {}; const collection = () => {}; const getDocs = async () => ({forEach:()=>[]}); const addDoc = async () => {};');
js = js.replace(/import { getAuth, signInAnonymously } from ".*?";/, 'const getAuth = () => ({}); const signInAnonymously = async () => {};');

// Mock DOM
global.window = {};
global.document = {
  getElementById: () => ({ style: {}, classList: { add:()=>{}, remove:()=>{} }, innerHTML: '', value: '', appendChild: () => {}, addEventListener: () => {} }),
  createElement: () => ({ style: {}, classList: { add:()=>{}, remove:()=>{} }, appendChild: () => {} }),
  querySelectorAll: () => ([]),
};
global.location = { hostname: 'localhost', href: 'http://localhost:8080/quote-foreigner.html' };
global.URL = require('url').URL;
global.URLSearchParams = require('url').URLSearchParams;

try {
  eval(js);
  console.log("EXECUTION SUCCESS");
} catch(e) {
  console.error("EXECUTION ERROR:", e);
}
