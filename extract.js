const fs = require('fs');
const html = fs.readFileSync('quote-foreigner.html', 'utf8');
const match = html.match(/<script type="module">([\s\S]*?)<\/script>/);
if (match) {
    fs.writeFileSync('test.js', match[1]);
    console.log("Extracted to test.js");
} else {
    console.log("No match");
}
