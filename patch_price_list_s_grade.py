import os

files_to_patch = ["script.js", "script_live.js"]

target_old = """
        // Deduplicate and calculate average
        const modelMap = {};
        filtered.forEach(p => {
            if (!modelMap[p.model]) {
                modelMap[p.model] = {
                    ...p,
                    allPrices: []
                };
            }
            // Collect all valid prices for this model across all duplicated docs
            const prices = p.prices || {};
            const priceS = prices.s || p.basePrice || 0;
            const priceA = prices.a || 0;
            const priceB = prices.b || 0;
            const priceC = prices.c || prices.d || 0;
            
            [priceS, priceA, priceB, priceC].forEach(v => {
                if (v > 0) modelMap[p.model].allPrices.push(v);
            });
        });

        const uniqueModels = Object.values(modelMap);

        uniqueModels.forEach(p => {
            const sum = p.allPrices.reduce((a, b) => a + b, 0);
            const avg = p.allPrices.length > 0 ? Math.floor(sum / p.allPrices.length / 1000) * 1000 : 0;
            
            let priceText = '-';
            if (avg > 0) {
                priceText = `${avg.toLocaleString()}원`;
            }
"""

replacement_new = """
        // Deduplicate and calculate S grade
        const modelMap = {};
        filtered.forEach(p => {
            if (!modelMap[p.model]) {
                modelMap[p.model] = {
                    ...p,
                    maxS: 0
                };
            }
            // Collect S grade price for this model
            const prices = p.prices || {};
            const priceS = prices.s || p.basePrice || 0;
            
            if (priceS > modelMap[p.model].maxS) {
                modelMap[p.model].maxS = priceS;
            }
        });

        const uniqueModels = Object.values(modelMap);

        uniqueModels.forEach(p => {
            const displayPrice = p.maxS;
            
            let priceText = '-';
            if (displayPrice > 0) {
                priceText = `${displayPrice.toLocaleString()}원`;
            }
"""

print("Patching JS files...")
for fn in files_to_patch:
    if not os.path.exists(fn):
        continue
    with open(fn, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if target_old.strip() in content:
        content = content.replace(target_old.strip(), replacement_new.strip())
        with open(fn, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Patched {fn}")
    else:
        print(f"Target block not found in {fn}")

# Now patch price-list.html
html_file = "price-list.html"
if os.path.exists(html_file):
    with open(html_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 1. Change description text
    old_text1 = "단가표의 기준은 기본용량 A등급에 해당하는 단가입니다."
    new_text1 = "단가표의 기준은 기본용량 S등급에 해당하는 단가입니다."
    
    # 2. Change table header
    old_text2 = "평균 매입가</th>"
    new_text2 = "S급 매입가</th>"
    
    if old_text1 in content:
        content = content.replace(old_text1, new_text1)
        print(f"Replaced text 1 in {html_file}")
    
    if old_text2 in content:
        content = content.replace(old_text2, new_text2)
        print(f"Replaced text 2 in {html_file}")
        
    with open(html_file, 'w', encoding='utf-8') as f:
        f.write(content)

print("Done")
