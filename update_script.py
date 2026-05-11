import os

with open("c:/Users/PC/Desktop/used-phone-market/script.js", "r", encoding="utf-8") as f:
    text = f.read()

insertion = """// --- Global Site Settings ---
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const docRef = doc(db, "settings", "general");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            
            const fill = (id, text) => { 
                const els = document.querySelectorAll(id);
                els.forEach(el => el.innerText = text);
            };

            if (data.heroTitle) fill('#dyn-hero-title', data.heroTitle);
            if (data.heroSubtitle) fill('#dyn-hero-subtitle', data.heroSubtitle);
            if (data.siteName) { fill('.dyn-company-name', data.siteName); fill('#dyn-company-name', data.siteName); }
            if (data.siteCeo) { fill('.dyn-ceo-name', data.siteCeo); fill('#dyn-ceo-name', data.siteCeo); }
            if (data.siteAddress) fill('.dyn-address', data.siteAddress);
            if (data.sitePhone) { fill('.dyn-phone', data.sitePhone); fill('#dyn-phone', data.sitePhone); }
            if (data.siteEmail) fill('.dyn-email', data.siteEmail);
            if (data.siteBizNumber) fill('.dyn-biz-number', data.siteBizNumber);
        }
    } catch (e) {
        console.error("Failed to fetch global site settings:", e);
    }
});

// --- Global Popup Logic ---"""

text = text.replace("// --- Global Popup Logic ---", insertion)

with open("c:/Users/PC/Desktop/used-phone-market/script.js", "w", encoding="utf-8") as f:
    f.write(text)
