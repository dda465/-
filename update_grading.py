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

js_replacements = [
    {
        'old': r"            if \(defects\.func_defect\?\.includes\('power'\) \|\| defects\.func_defect\?\.includes\('account'\) \|\| defects\.func_defect\?\.includes\('network'\)\) \{\s*grade = 'd'; // Critical Failure\s*\} else if \(isLcdDamaged\) \{\s*grade = 'c'; // Screen broken\s*\} else if \(hasFuncDefect \|\| hasBurnIn\) \{\s*grade = 'c'; // Functional issue or Burn-in -> C\s*\} else if \(hasBodyDamage\) \{\s*// Physical damage -> B\s*grade = 'b';\s*\} else if \(hasMicroScratch\) \{\s*// Just scratches -> A\s*\} else \{\s*// No defects found -> S\s*grade = 's';\s*\}",
        'new': r'''            // Count C-grade defects
            let cGradeCount = 0;
            if (defects.lcd_damage === 'light' || defects.lcd_damage === 'yes' || defects.lcd_damage === true) cGradeCount++;
            if (defects.burn_in === true || defects.burn_in === 'yes') cGradeCount++;
            
            let hasDGradeFunc = false;
            let funcDefectCount = 0;
            if (defects.func_defect && defects.func_defect.length > 0) {
                const dGradeFuncs = ['power', 'account', 'network', 'touch'];
                for (let f of defects.func_defect) {
                    if (dGradeFuncs.includes(f)) {
                        hasDGradeFunc = true;
                    } else {
                        funcDefectCount++;
                    }
                }
            }
            cGradeCount += funcDefectCount;

            const isHeavyLcd = (defects.lcd_damage === 'heavy');

            if (isHeavyLcd || hasDGradeFunc || cGradeCount >= 2) {
                grade = 'd'; // Critical Failure or Heavy LCD or Multiple C-grade defects
            } else if (cGradeCount === 1) {
                grade = 'c'; // One C-grade defect
            } else if (hasBodyDamage) {
                grade = 'b';
            } else if (hasMicroScratch) {
                grade = 'a';
            } else {
                grade = 's';
            }'''
    }
]

for f in glob.glob('script*.js') + glob.glob('script*.mjs'):
    if update_file(f, js_replacements):
        print(f"Updated JS {f}")
