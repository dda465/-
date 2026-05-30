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
        'old': r"            // Count C-grade defects\s*let cGradeCount = 0;\s*if \(defects\.lcd_damage === 'light' \|\| defects\.lcd_damage === 'yes' \|\| defects\.lcd_damage === true\) cGradeCount\+\+;\s*if \(defects\.burn_in === true \|\| defects\.burn_in === 'yes'\) cGradeCount\+\+;\s*let hasDGradeFunc = false;\s*let funcDefectCount = 0;\s*if \(defects\.func_defect && defects\.func_defect\.length > 0\) \{\s*const dGradeFuncs = \['power', 'account', 'network', 'touch'\];\s*for \(let f of defects\.func_defect\) \{\s*if \(dGradeFuncs\.includes\(f\)\) \{\s*hasDGradeFunc = true;\s*\} else \{\s*funcDefectCount\+\+;\s*\}\s*\}\s*\}\s*cGradeCount \+= funcDefectCount;\s*const isHeavyLcd = \(defects\.lcd_damage === 'heavy'\);\s*if \(isHeavyLcd \|\| hasDGradeFunc \|\| cGradeCount >= 2\) \{\s*grade = 'd'; // Critical Failure or Heavy LCD or Multiple C-grade defects\s*\} else if \(cGradeCount === 1\) \{\s*grade = 'c'; // One C-grade defect\s*\} else if \(hasBodyDamage\) \{\s*grade = 'b';\s*\} else if \(hasMicroScratch\) \{\s*grade = 'a';\s*\} else \{\s*grade = 's';\s*\}",
        'new': r'''            let bGradeCount = 0;
            let cGradeCount = 0;
            let hasDGrade = false;

            // 1. LCD Damage
            if (defects.lcd_damage === 'heavy') {
                hasDGrade = true;
            } else if (defects.lcd_damage === 'light' || defects.lcd_damage === 'yes' || defects.lcd_damage === true) {
                cGradeCount++;
            }

            // 2. Burn-in -> B grade
            if (defects.burn_in === true || defects.burn_in === 'yes') {
                bGradeCount++;
            }

            // 3. Body Damage (1=A, 2+=B)
            let bodyCount = 0;
            if (defects.body_damage && Array.isArray(defects.body_damage)) {
                bodyCount = defects.body_damage.filter(x => x !== 'none').length;
            }
            if (bodyCount >= 2) {
                bGradeCount++;
            }

            // 4. Micro Scratch (1~2=A, 3+=B)
            let scratchCount = 0;
            if (defects.micro_scratch && Array.isArray(defects.micro_scratch)) {
                scratchCount = defects.micro_scratch.filter(x => x !== 'none').length;
            }
            if (scratchCount >= 3) {
                bGradeCount++;
            }

            // 5. Functional Defects
            if (defects.func_defect && Array.isArray(defects.func_defect)) {
                const validFuncs = defects.func_defect.filter(x => x !== 'none');
                const dFuncs = ['power']; // D급
                const cFuncs = ['camera_fail', 'faceid', 'wifi', 'compass', 'unknown_part', 'touch', 'account', 'network']; // C급
                const bFuncs = ['camera_lens', 'vibration', 'sound', 'battery']; // B급
                
                for (let f of validFuncs) {
                    if (dFuncs.includes(f)) hasDGrade = true;
                    else if (cFuncs.includes(f)) cGradeCount++;
                    else if (bFuncs.includes(f)) bGradeCount++;
                }
            }

            // 6. Calculate Final Grade
            grade = 's';
            if (hasDGrade || cGradeCount >= 2) {
                grade = 'd';
            } else if (cGradeCount === 1 || bGradeCount >= 3) {
                grade = 'c';
            } else if (bGradeCount > 0) {
                grade = 'b';
            } else if (bodyCount === 1 || (scratchCount > 0 && scratchCount <= 2)) {
                grade = 'a';
            }'''
    }
]

for f in glob.glob('script*.js') + glob.glob('script*.mjs'):
    if update_file(f, js_replacements):
        print(f"Updated JS {f}")
