const fs = require('fs');
const data = fs.readFileSync('sheet_data.csv', 'utf-8');
const lines = data.split('\n');
const items = lines.filter(l => l.includes('Apple') || l.includes('아이폰'));
for (let i = 0; i < Math.min(10, items.length); i++) {
    const cols = items[i].split(',');
    if (cols.length > 2) console.log(cols[2]);
}
