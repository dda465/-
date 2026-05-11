import re
import sys

def fix_admin_js():
    try:
        with open('admin.js', 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"Error reading file: {e}")
        return

    # Fix the broken window.closeModelModal and window.saveModel
    pattern1 = re.compile(
        r"window\.closeModelModal = \(\) => \{\s*document\.getElementById\('model-modal'\)\.style\.display = 'none';\s*\};\s*\};\s*try\s*\{\s*if\s*\(id\)\s*\{\s*await updateDoc\(doc\(db,\s*\"products\",\s*id\),\s*payload\);",
        re.MULTILINE | re.DOTALL
    )
    
    replacement1 = """window.closeModelModal = () => {
    document.getElementById('model-modal').style.display = 'none';
};

window.saveModel = async () => {
    const id = document.getElementById('edit-doc-id').value;
    const brand = document.getElementById('edit-brand').value;
    const series = document.getElementById('edit-series').value;
    const model = document.getElementById('edit-model').value;
    const basePrice = parseInt(document.getElementById('edit-price').value) || 0;
    
    let storageOptions = [];
    try {
        storageOptions = JSON.parse(document.getElementById('edit-storage').value);
    } catch (e) {
        alert('용량 옵션의 JSON 형식이 잘못되었습니다.');
        return;
    }

    const payload = {
        brand,
        series,
        model,
        basePrice,
        storageOptions,
        lastUpdated: new Date()
    };

    try {
        if (id) {
            await updateDoc(doc(db, "products", id), payload);"""

    if pattern1.search(content):
        content = pattern1.sub(replacement1, content)
        print("Fixed pattern 1")
    else:
        print("Pattern 1 not found!")

    # Fix the stray JSON migration snippet
    pattern2 = re.compile(
        r"// --- Smart Migration Logic ---\s*\"갤럭시S22 울트라\": 650000, \"갤럭시S22\+\": 500000, \"갤럭시S22\": 400000,\s*\"갤럭시S21 울트라\": 450000, \"갤럭시S21\+\": 350000, \"갤럭시S21\": 300000,\s*\"갤럭시Z 폴드7\": 1900000, \"갤럭시Z 플립7\": 1300000,\s*\"갤럭시Z 폴드6\": 1500000, \"갤럭시Z 플립6\": 950000,\s*\"갤럭시Z 폴드5\": 1100000, \"갤럭시Z 플립5\": 700000,\s*\"갤럭시Z 폴드4\": 800000, \"갤럭시Z 플립4\": 450000\s*\}\s*\}\;",
        re.MULTILINE | re.DOTALL
    )

    replacement2 = "// --- Smart Migration Logic ---\n// Leftover code removed"
    
    if pattern2.search(content):
        content = pattern2.sub(replacement2, content)
        print("Fixed pattern 2")
    else:
        print("Pattern 2 not found!")

    # Fix one more thing: inside the replaced saveModel, there is `closeModelModal();` at line 629 which I should probably change to `window.closeModelModal();`
    # Let's just do a simple string replace for that within saveModel context
    content = content.replace('closeModelModal();\n        loadPrices();', 'window.closeModelModal();\n        loadPrices();')

    try:
        with open('admin.js', 'w', encoding='utf-8') as f:
            f.write(content)
        print("Successfully wrote admin.js")
    except Exception as e:
        print(f"Error writing file: {e}")

if __name__ == '__main__':
    fix_admin_js()
