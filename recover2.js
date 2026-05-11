const fs = require('fs');
const missingCode = fs.readFileSync('missing.js', 'utf8');
const originalContent = fs.readFileSync('script.js', 'utf8');

const insertMarker = 'if (window.openPresaleModal) window.openPresaleModal();\n            });\n        }\n    }';

const idx = originalContent.indexOf(insertMarker);
if (idx !== -1) {
    const startPart = originalContent.substring(0, idx + insertMarker.length);
    const endPart = originalContent.substring(idx + insertMarker.length);
    const newContent = startPart + "\n" + missingCode + "\n" + endPart;
    fs.writeFileSync('script.js', newContent, 'utf8');
    console.log('Recovery successful. Restored the missing 1186 lines.');
} else {
    // try fallback regex/marker
    const alteredMarker = 'if (window.openPresaleModal) window.openPresaleModal();';
    const idx2 = originalContent.indexOf(alteredMarker);
    if(idx2 !== -1) {
        const postIdx = originalContent.indexOf('}\n    }', idx2);
        if(postIdx !== -1) {
            const startPart = originalContent.substring(0, postIdx + 6);
            const endPart = originalContent.substring(postIdx + 6);
            const newContent = startPart + "\n" + missingCode + "\n" + endPart;
            fs.writeFileSync('script.js', newContent, 'utf8');
            console.log('Recovery successful (fallback marker).');
        } else {
             console.log('Marker step 2 failed');
        }
    } else {
        console.log('Could not find insert marker!');
    }
}
