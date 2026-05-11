const fs = require('fs');

const fallbackReplacements = [
    {regex: /중고/g, replace: '�߰���'},
    {regex: /��/g, replace: '��'},
    {regex: /��/g, replace: '��'},
    {regex: /��/g, replace: ''},
    {regex: /\?/g, replace: ''}
];

const filesToFix = ['index.html', 'quote.html', 'price-list.html', 'reviews.html', 'login.html', 'admin.html', 'mypage.html', 'terms.html', 'privacy.html'];

for (const file of filesToFix) {
    if (fs.existsSync(file)) {
        let content = fs.readFileSync(file, 'utf8');
        let changed = false;
        for (const item of fallbackReplacements) {
            if (item.regex.test(content)) {
                content = content.replace(item.regex, item.replace);
                changed = true;
            }
        }
        if (changed) {
            fs.writeFileSync(file, content, 'utf8');
            console.log('Cleaned residual corrupted marks in: ' + file);
        }
    }
}
