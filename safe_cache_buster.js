const fs = require('fs');
const path = require('path');
const timestamp = Date.now();
const dir = '.';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let newContent = content.replace(/(\.(?:js|mjs|css))\?v=[a-zA-Z0-9_]+/g, '$1?v=' + timestamp);
  if (content !== newContent) {
    fs.writeFileSync(file, newContent, 'utf8');
    console.log('Updated ' + file);
  }
}
