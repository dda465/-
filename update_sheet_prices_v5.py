import gspread

def get_update_rule(brand_raw, series_raw, model_raw):
    brand = str(brand_raw).upper()
    series = str(series_raw).upper()
    model = str(model_raw).upper()
    
    if "애플" in brand or "APPLE" in brand:
        if " 17" in series: return {'type': 'none'}
        if " 16" in series: return {'type': 'mul', 'val': 1.03, 'label': '+3%'}
        for s in [" 11", " 12", " 13", " 14", " 15"]:
            if s in series: return {'type': 'mul', 'val': 1.05, 'label': '+5%'}
            
        for s in [" X", " 8"]:
            if s in series: return {'type': 'add', 'val': 5000, 'label': '+5,000원'}
            
        if "SE" in series:
            if " 3" in model: return {'type': 'add', 'val': 10000, 'label': '+10,000원'}
            return {'type': 'add', 'val': 5000, 'label': '+5,000원'}
            
        if " 7" in series:
            return {'type': 'add', 'val': 3000, 'label': '+3,000원'}
            
        return {'type': 'add', 'val': 5000, 'label': '+5,000원'}
        
    if "삼성" in brand or "SAMSUNG" in brand:
        if " S" in series:
            if "S26" in series: return {'type': 'none'}
            for s in ["S20", "S21", "S22", "S23", "S24", "S25"]:
                if s in series: return {'type': 'mul', 'val': 1.05, 'label': '+5%'}
            for s in ["S8", "S9", "S10"]:
                if s in series: return {'type': 'add', 'val': 5000, 'label': '+5,000원'}
            return {'type': 'add', 'val': 5000, 'label': '+5,000원'}
            
        if "노트" in series or "NOTE" in series:
            return {'type': 'add', 'val': 5000, 'label': '+5,000원'}
            
        if "FOLD" in series or "폴드" in series:
            if "FOLD 7" in model: return {'type': 'none'}
            for s in ["FOLD 4", "FOLD 5", "FOLD 6"]:
                if s in model: return {'type': 'mul', 'val': 1.05, 'label': '+5%'}
            return {'type': 'add', 'val': 10000, 'label': '+10,000원'}
            
        if "FLIP" in series or "플립" in series:
            if "FLIP 7" in model: return {'type': 'none'}
            for s in ["FLIP 4", "FLIP 5", "FLIP 6"]:
                if s in model: return {'type': 'mul', 'val': 1.05, 'label': '+5%'}
            return {'type': 'add', 'val': 10000, 'label': '+10,000원'}
            
        # A, M, 와이드, 점프, 버디, 퀀텀 등
        return {'type': 'add', 'val': 5000, 'label': '+5,000원'}
        
    return {'type': 'none'}

def update_val(val_str, rule):
    if not val_str: return val_str
    if rule['type'] == 'none': return val_str
    try:
        val = float(str(val_str).replace(',', '').strip())
        if val == 0: return val_str
        
        if rule['type'] == 'mul':
            new_val = val * rule['val']
            # floor to 1000s
            new_val = (int(new_val) // 1000) * 1000
            return new_val
        elif rule['type'] == 'add':
            new_val = val + rule['val']
            return int(new_val)
    except ValueError:
        return val_str
    return val_str

def main():
    print("Connecting to Google Sheets...")
    gc = gspread.service_account(filename="google-sheets-key.json")
    sheet_id = "1Uhfn4XPjxsTJMhELFIF8bSTY-1B78GtYG6cFeMs_kfc"
    worksheet = gc.open_by_key(sheet_id).sheet1
    
    data = worksheet.get_all_values()
    if not data:
        print("No data found.")
        return
        
    start_idx = 3 
    end_idx = 8 
    
    counts = {}
    results = {}

    print("Processing data...")
    for i in range(1, len(data)):
        row = data[i]
        if len(row) < 3: continue
            
        brand = row[0]
        series = row[1]
        model = row[2]
        
        if not brand or not model: continue
            
        rule = get_update_rule(brand, series, model)
        
        if rule['type'] != 'none':
            s_grade_old_str = row[4] if len(row) > 4 else ""
            s_grade_old = 0
            try:
                s_grade_old = int(float(s_grade_old_str.replace(',', '')))
            except:
                pass

            limit = min(len(row), end_idx + 1)
            for col_idx in range(start_idx, limit):
                old_val = row[col_idx]
                data[i][col_idx] = update_val(old_val, rule)
                
            label = rule['label']
            counts[label] = counts.get(label, 0) + 1
            
            if s_grade_old > 0:
                s_grade_new = update_val(s_grade_old_str, rule)
                if label not in results:
                    results[label] = {}
                if series not in results[label]:
                    results[label][series] = []
                results[label][series].append({
                    "model": model,
                    "old": s_grade_old,
                    "new": s_grade_new,
                    "diff": s_grade_new - s_grade_old
                })
        else:
            counts['none'] = counts.get('none', 0) + 1

    print(f"Updating Google Sheet... Counts: {counts}")
    worksheet.update('A1', data) 
    print("Done! All targeted prices have been updated in the Google Sheet.")

    with open('price_increase_report_v5.md', 'w', encoding='utf-8') as out:
        out.write("# 📱 5차 단가 대규모 인상 내역 (S급 기준)\n\n")
        out.write("요청하신 **복합 조건(+5,000원, +10,000원, +3%, +5%, 변동없음)**을 적용하여 전체 단가를 업데이트하였습니다.\n")
        out.write("*(용량별 단가 변동 없음)*\n\n")
        
        # We will iterate by label
        for label, series_dict in results.items():
            out.write(f"# 🔹 {label} 인상 그룹\n")
            for series, items in series_dict.items():
                out.write(f"### {series}\n")
                out.write("| 기종명 | 인상 기준 | 변경 전 단가 | 변경 후 단가 | 📈 추가 인상액 |\n")
                out.write("|---|:---:|---:|---:|---:|\n")
                for item in items:
                    out.write(f"| {item['model']} | **{label}** | {item['old']:,}원 | **{item['new']:,}원** | <span style='color:red;'>+{item['diff']:,}원</span> |\n")
                out.write("\n")

if __name__ == "__main__":
    main()
