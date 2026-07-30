const DEFECT_KO = {
    keys: {
        is_sealed: "미개봉",
        body_damage: "파손찍힘",
        micro_scratch: "기스",
        lcd_damage: "액정불량",
        burn_in: "잔상",
        func_defect: "기능불량"
    },
    values: {
        "true": "예",
        "false": "아니오",
        front: "전면",
        bezel: "테두리",
        rear: "후면",
        light: "줄/멍",
        heavy: "완전파손",
        yes: "있음",
        camera_lens: "카메라기스",
        camera_fail: "카메라작동불가",
        faceid: "페이스ID/지문",
        wifi: "와이파이/블루투스",
        compass: "나침반/GPS",
        unknown_part: "알수없는부품",
        sound: "스피커/마이크",
        vibration: "진동불량",
        touch: "터치불량",
        battery: "배터리불량",
        power: "전원불량",
        account: "계정잠김"
    }
};

function formatDefects(defectsDetails) {
    if (!defectsDetails || Object.keys(defectsDetails).length === 0) return '없음';
    
    const arr = [];
    for (const [k, v] of Object.entries(defectsDetails)) {
        if (v === 'none' || v === 'no' || v === 'false' || (Array.isArray(v) && v.length === 0) || v === '') continue;
        
        const kName = DEFECT_KO.keys[k] || k;
        
        if (v === true || v === 'true') {
            if (k === 'is_sealed') arr.push('미개봉');
            else arr.push(kName);
        } else if (Array.isArray(v)) {
            const vals = v.map(val => DEFECT_KO.values[val] || val);
            arr.push(`${kName}(${vals.join(', ')})`);
        } else if (typeof v === 'string') {
            const vName = DEFECT_KO.values[v] || v;
            if (vName === '있음' || vName === '예') {
                arr.push(kName);
            } else {
                arr.push(`${kName}(${vName})`);
            }
        }
    }
    
    return arr.length > 0 ? arr.join(', ') : '없음';
}

console.log(formatDefects({ micro_scratch: ['front', 'rear'], burn_in: 'yes', func_defect: ['camera_lens'] }));
console.log(formatDefects({ body_damage: ['front'], lcd_damage: 'light', burn_in: 'yes', func_defect: ['touch'] }));
console.log(formatDefects({ is_sealed: 'true' }));
console.log(formatDefects({ micro_scratch: 'none', body_damage: 'none' }));
