import codecs

print("Fixing script.js...")
with codecs.open('script.js', 'r', 'utf-8', errors='ignore') as f:
    js_content = f.read()

# 1. Remove the old injected block
old_inject = r'''
    // Auto-Search URL Parameters Logic (Fast Search Integration)
    const handleUrlSearch = () => {
        if(allProducts.length === 0) {
            setTimeout(handleUrlSearch, 100);
            return;
        }

        const urlParams = new URLSearchParams(window.location.search);
        const searchQuery = urlParams.get('search');
        let modelQuery = urlParams.get('model');

        if(!searchQuery && !modelQuery) return;

        // Normalize some common explicit mismatches from chips
        if(modelQuery === 'iphone15pro') modelQuery = '아이폰 15 pro';
        if(modelQuery === 's24ultra') modelQuery = 's24 ultra';
        if(modelQuery === 'zflip5') modelQuery = '플립 5';

        const queryValue = searchQuery || modelQuery;

        if (queryValue) {
            const queryRaw = queryValue.toLowerCase().replace(/\s/g, '');
            let bestMatch = null;
            
            // First try ID exact match
            bestMatch = allProducts.find(p => p.id === modelQuery);
            
            // Then try name contains
            if (!bestMatch) {
                bestMatch = allProducts.find(p => p.modelName && p.modelName.toLowerCase().replace(/\s/g, '').includes(queryRaw));
            }

            if (bestMatch) {
                console.log("Auto-Search matched:", bestMatch.modelName);
                currentQuote.brand = bestMatch.brand;
                currentQuote.series = bestMatch.series;
                currentQuote.model = bestMatch;
                
                // Select Lowest Storage
                if(bestMatch.capacities && Object.keys(bestMatch.capacities).length > 0) {
                    const sortedCaps = Object.keys(bestMatch.capacities).sort((a,b) => parseInt(a) - parseInt(b));
                    const lowestCap = sortedCaps[0];
                    currentQuote.storage = { size: lowestCap, priceAdjustment: bestMatch.capacities[lowestCap] || 0 };
                } else {
                    currentQuote.storage = { size: '기본', priceAdjustment: 0 };
                }
                
                // Hide loading if any
                const loadingOverlay = document.getElementById('wizard-loading');
                if(loadingOverlay) loadingOverlay.style.display = 'none';
                
                // Proceed directly to the Grade Estimates List
                window.selectMethod('simple');
            }
        }
    };
    handleUrlSearch();
'''

if '// Auto-Search URL Parameters Logic (Fast Search Integration)' in js_content:
    js_content = js_content.replace(old_inject, '')
    print("Old injection removed successfully.")

# 2. Inject it at the right place (after initDeepWizard(); )
new_inject = r'''
        initDeepWizard();
        
        // Auto-Search URL Parameters Logic (Fast Search Integration)
        const handleUrlSearch = () => {
            if(allProducts.length === 0) {
                setTimeout(handleUrlSearch, 100);
                return;
            }

            const urlParams = new URLSearchParams(window.location.search);
            const searchQuery = urlParams.get('search');
            let modelQuery = urlParams.get('model');

            if(!searchQuery && !modelQuery) return;

            // Normalize some common explicit mismatches from chips
            if(modelQuery === 'iphone15pro') modelQuery = '아이폰 15 pro';
            if(modelQuery === 's24ultra') modelQuery = 's24 ultra';
            if(modelQuery === 'zflip5') modelQuery = '플립 5';

            const queryValue = searchQuery || modelQuery;

            if (queryValue) {
                const queryRaw = queryValue.toLowerCase().replace(/\s/g, '');
                let bestMatch = null;
                
                // First try ID exact match
                bestMatch = allProducts.find(p => p.id === modelQuery);
                
                // Then try name contains
                if (!bestMatch) {
                    bestMatch = allProducts.find(p => p.modelName && p.modelName.toLowerCase().replace(/\s/g, '').includes(queryRaw));
                }

                if (bestMatch) {
                    console.log("Auto-Search matched:", bestMatch.modelName);
                    currentQuote.brand = bestMatch.brand;
                    currentQuote.series = bestMatch.series;
                    currentQuote.model = bestMatch;
                    
                    // Select Lowest Storage
                    if(bestMatch.capacities && Object.keys(bestMatch.capacities).length > 0) {
                        const sortedCaps = Object.keys(bestMatch.capacities).sort((a,b) => parseInt(a) - parseInt(b));
                        const lowestCap = sortedCaps[0];
                        currentQuote.storage = { size: lowestCap, priceAdjustment: bestMatch.capacities[lowestCap] || 0 };
                    } else {
                        currentQuote.storage = { size: '기본', priceAdjustment: 0 };
                    }
                    
                    // Hide loading if any
                    const loadingOverlay = document.getElementById('wizard-loading');
                    if(loadingOverlay) loadingOverlay.style.display = 'none';
                    
                    // Proceed directly to the Grade Estimates List
                    if(typeof window.selectMethod === 'function') {
                        window.selectMethod('simple');
                    } else {
                        console.error('window.selectMethod is not defined!');
                    }
                }
            }
        };
        handleUrlSearch();
'''

target = 'initDeepWizard();'
if target in js_content and '// Auto-Search URL Parameters Logic' not in js_content:
    js_content = js_content.replace(target, new_inject, 1) # Replace only the first occurrence which is in DOMContentLoaded
    with codecs.open('script.js', 'w', 'utf-8') as f:
        f.write(js_content)
    print("New injection added successfully.")
else:
    print("Failed to add new injection.")
