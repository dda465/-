import { JSDOM } from 'jsdom';
import fs from 'fs';

const html = fs.readFileSync('quote-foreigner.html', 'utf8');
const match = html.match(/<script type="module">([\s\S]*?)<\/script>/);
const jsCode = match ? match[1] : '';

const dom = new JSDOM(html, {
  url: 'http://localhost:8080/quote-foreigner.html',
  runScripts: "dangerously"
});

// Since the script is type="module", jsdom might not execute it if it lacks some support or fails on import.
// We can manually evaluate it after replacing imports if necessary, or just let JSDOM try.
dom.window.addEventListener('error', (event) => {
  console.error("DOM Error:", event.error);
});
