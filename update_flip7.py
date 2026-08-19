import gspread

def get_update_rule(model_raw):
    model = str(model_raw).upper()
    if "FLIP 7" in model or "플립 7" in model or "플립7" in model or "FLIP7" in model:
        return {'type': 'mul', 'val': 1.05, 'label': '+5%'}
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
            
        model = row[2]
        
        if not model: continue
            
        rule = get_update_rule(model)
        
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
                results[label][model] = {
                    "old": s_grade_old,
                    "new": s_grade_new,
                    "diff": s_grade_new - s_grade_old
                }
        else:
            counts['none'] = counts.get('none', 0) + 1

    print(f"Updating Google Sheet... Counts: {counts}")
    try:
        worksheet.update(values=data, range_name='A1')
    except TypeError:
        worksheet.update('A1', data) 
        
    print("Done! All targeted prices have been updated in the Google Sheet.")

    with open('price_update_flip7.md', 'w', encoding='utf-8') as out:
        out.write("# 📱 단가 수정 내역 (플립 7 상향)\n\n")
        out.write("요청하신 대로 **갤럭시 플립 7 기종만 5% 상향**을 적용하였습니다.\n")
        out.write("*(용량별 단가 변동 없음, 백원 단위 절사 처리됨)*\n\n")
        
        for label, models in results.items():
            out.write("| 기종명 | 변동 기준 | 변경 전 단가 | 변경 후 단가 | 📈 변동액 |\n")
            out.write("|---|:---:|---:|---:|---:|\n")
            for model, item in models.items():
                out.write(f"| {model} | **{label}** | {item['old']:,}원 | **{item['new']:,}원** | <span style='color:red;'>+{item['diff']:,}원</span> |\n")
            out.write("\n")

if __name__ == "__main__":
    main()
