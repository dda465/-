const fs = require('fs');

const files = ['index.html', 'quote.html', 'price-list.html', 'reviews.html', 'login.html', 'admin.html', 'mypage.html', 'terms.html', 'privacy.html'];

const gtagSnippet = `
    <!-- Google tag (gtag.js) -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-JWS15NH588"></script>
    <script>
        window.dataLayer = window.dataLayer || [];
        function gtag() { dataLayer.push(arguments); }
        gtag('js', new Date());

        gtag('config', 'G-JWS15NH588');
    </script>
</head>`;

const naverMeta = '<meta name="naver-site-verification" content="88cd5e4f7d21bc69a519a61b2d5c440af0f6b836" />\n    <link rel="canonical"';

for (const file of files) {
    if (fs.existsSync(file)) {
        let content = fs.readFileSync(file, 'utf8');

        // Update CSS version
        content = content.replace(/styles\.css\?v=[0-9]+/g, 'styles.css?v=6');

        // Add gtag if missing
        if (!content.includes('G-JWS15NH588')) {
            content = content.replace('</head>', gtagSnippet);
        }

        // Add naver verification to index.html if missing
        if (file === 'index.html' && !content.includes('naver-site-verification')) {
            content = content.replace('<link rel="canonical"', naverMeta);
        }

        fs.writeFileSync(file, content, 'utf8');
        console.log('Restored tags for ' + file);
    }
}
