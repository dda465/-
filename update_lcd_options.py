import glob
import re

def update_file(filepath, replacements, encoding='utf-8'):
    try:
        with open(filepath, 'r', encoding=encoding) as f:
            content = f.read()
        
        new_content = content
        for r in replacements:
            new_content = re.sub(r['old'], r['new'], new_content, flags=re.MULTILINE)
            
        if content != new_content:
            with open(filepath, 'w', encoding=encoding) as f:
                f.write(new_content)
            return True
        return False
    except Exception as e:
        return False

# 1. HTML Replacements
html_replacements = [
    {
        'old': r'<div class="selection-grid" style="grid-template-columns: 1fr 1fr; gap: 12px;">\s*<button class="btn-check-opt( active)?" data-group="lcd_damage" data-value="no"\s*onclick="toggleRadioSafe\(this\)">✅ 없음</button>\s*<button class="btn-check-opt" data-group="lcd_damage" data-value="yes"\s*onclick="toggleRadioSafe\(this\)">⚠️ 손상 \(줄/멍/파손\)</button>\s*</div>',
        'new': r'''<div class="selection-grid" style="grid-template-columns: 1fr; gap: 12px;">
                        <button class="btn-check-opt\1" data-group="lcd_damage" data-value="no"
                            onclick="toggleRadioSafe(this)">✅ 없음</button>
                        <button class="btn-check-opt" data-group="lcd_damage" data-value="light"
                            onclick="toggleRadioSafe(this)">⚠️ 액정불량(줄/멍)</button>
                        <button class="btn-check-opt" data-group="lcd_damage" data-value="heavy"
                            onclick="toggleRadioSafe(this)">⚠️ 액정불량(완전안보임)</button>
                    </div>'''
    }
]

for f in glob.glob('*.html'):
    if update_file(f, html_replacements):
        print(f"Updated {f}")

# 2. JS Replacements
js_replacements = [
    {
        'old': r"if \(group === 'lcd_damage'\) defects\.lcd_damage = \(val === 'yes'\);",
        'new': r"if (group === 'lcd_damage') defects.lcd_damage = val;"
    },
    {
        'old': r"const isLcdDamaged = defects\.lcd_damage;",
        'new': r"const isLcdDamaged = (defects.lcd_damage === 'yes' || defects.lcd_damage === 'light' || defects.lcd_damage === 'heavy' || defects.lcd_damage === true);"
    },
    {
        'old': r"if \(payload\.defectsDetails\.lcd_damage\) defectLabels\.push\('LCD파손/불량'\);",
        'new': r'''if (payload.defectsDetails.lcd_damage) {
                                if (payload.defectsDetails.lcd_damage === 'light') defectLabels.push('액정불량(줄/멍)');
                                else if (payload.defectsDetails.lcd_damage === 'heavy') defectLabels.push('액정불량(완전안보임)');
                                else if (payload.defectsDetails.lcd_damage === 'yes' || payload.defectsDetails.lcd_damage === true) defectLabels.push('LCD파손/불량');
                            }'''
    }
]

for f in glob.glob('script*.js') + glob.glob('script*.mjs'):
    if update_file(f, js_replacements):
        print(f"Updated {f}")

# 3. admin.js
admin_js_replacements = [
    {
        'old': r"if \(d\.lcd_damage === true\) \{\s*defectsHtml \+= '<li style=\"color:red;\"><strong>LCD 손상:</strong> 있음 \(줄/멍/파손\)</li>';\s*\}",
        'new': r'''if (d.lcd_damage) {
                    if (d.lcd_damage === 'light') {
                        defectsHtml += '<li style="color:red;"><strong>액정상태 불량:</strong> 액정불량(줄/멍)</li>';
                    } else if (d.lcd_damage === 'heavy') {
                        defectsHtml += '<li style="color:red;"><strong>액정상태 불량:</strong> 액정불량(완전안보임)</li>';
                    } else if (d.lcd_damage === 'yes' || d.lcd_damage === true) {
                        defectsHtml += '<li style="color:red;"><strong>액정상태 불량:</strong> 있음 (줄/멍/파손)</li>';
                    }
                }'''
    }
]
if update_file('admin.js', admin_js_replacements):
    print("Updated admin.js")
