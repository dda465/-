const https = require('https');
const fs = require('fs');

const url = "https://docs.google.com/spreadsheets/d/1Uhfn4XPjxsTJMhELFIF8bSTY-1B78GtYG6cFeMs_kfc/export?format=csv&id=1Uhfn4XPjxsTJMhELFIF8bSTY-1B78GtYG6cFeMs_kfc&gid=0";

function get(url) {
    https.get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            get(res.headers.location);
            return;
        }
        let rawData = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
            console.log(rawData.split('\n').slice(0, 5).join('\n'));
        });
    });
}
get(url);
