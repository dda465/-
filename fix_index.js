const fs = require('fs');

let priceContent = fs.readFileSync('price-list.html', 'utf8');
// Put placeholder back if it was garbled, though it looks fine right now
if (priceContent.includes('?��? ?�이?��? 불러?�는')) {
    console.log("Price list table looks standard.");
}

let indexContent = fs.readFileSync('index.html', 'utf8');
// Fix the known broken character in index.html (e.g., '?????�매' in the hero section if broken, or in the title)
indexContent = indexContent.replace(/\?\?\?\?\?�?��/g, '?????�매');
indexContent = indexContent.replace(/以묎???\?/g, '중고??);
indexContent = indexContent.replace(/以묎???/g, '중고??);
indexContent = indexContent.replace(/\?\?\?\?/g, '????);

fs.writeFileSync('index.html', indexContent, 'utf8');
console.log('Fixed tags');
