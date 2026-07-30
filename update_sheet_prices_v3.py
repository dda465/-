import gspread

def get_multiplier(brand_raw, series_raw, model_raw):
    brand = str(brand_raw).upper()
    series = str(series_raw).upper()
    model = str(model_raw).upper()
    
    # iPhone logic
    if "애플" in brand or "APPLE" in brand:
        iphone_5_list = [" 11", " 12", " 13", " 14", " 15", " X", " XR", " XS"]
        for i in iphone_5_list:
            if i in series:
                return 1.05
        return 1.00
        
    # Samsung logic
    if "삼성" in brand or "SAMSUNG" in brand:
        if " S" in series:
            s_5_list = ["S20", "S21", "S22", "S23", "S24"]
            for s in s_5_list:
                if s in series:
                    return 1.05
            return 1.00
            
        if "FOLD" in series or "폴드" in series:
            fold_5_list = ["FOLD 3", "FOLD 4", "FOLD 5", "FOLD 6"]
            for f in fold_5_list:
                if f in model:
                    return 1.05
            return 1.00
            
        return 1.00
        
    return 1.00

def update_val(val_str, multiplier):
    if not val_str:
        return val_str
    if multiplier == 1.00:
        return val_str
        
    try:
        val = float(str(val_str).replace(',', '').strip())
        if val == 0:
            return val_str
        new_val = val * multiplier
        new_val = (int(new_val) // 1000) * 1000
        return new_val
    except ValueError:
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
        
    # Target columns: 신품, S급, A급, B급, C급, D급 (Indices 3 to 8)
    start_idx = 3 
    end_idx = 8 
    
    updated_5_count = 0
    updated_0_count = 0
    results = {}

    print("Processing data...")
    for i in range(1, len(data)):
        row = data[i]
        if len(row) < 3:
            continue
            
        brand = row[0]
        series = row[1]
        model = row[2]
        
        if not brand or not model:
            continue
            
        multiplier = get_multiplier(brand, series, model)
        if multiplier == 1.05:
            s_grade_old_str = ""
            if len(row) > 4:
                s_grade_old_str = row[4]
                
            s_grade_old = 0
            try:
                s_grade_old = int(float(s_grade_old_str.replace(',', '')))
            except:
                pass

            limit = min(len(row), end_idx + 1)
            for col_idx in range(start_idx, limit):
                old_val = row[col_idx]
                data[i][col_idx] = update_val(old_val, multiplier)
                
            updated_5_count += 1
            
            # for report
            if s_grade_old > 0:
                s_grade_new = update_val(s_grade_old_str, multiplier)
                if series not in results:
                    results[series] = []
                results[series].append({
                    "model": model,
                    "old": s_grade_old,
                    "new": s_grade_new,
                    "diff": s_grade_new - s_grade_old
                })
        else:
            updated_0_count += 1

    print(f"Updating Google Sheet... (5% up: {updated_5_count} models, No change: {updated_0_count} models)")
    worksheet.update('A1', data) 
    print("Done! All targeted prices have been updated in the Google Sheet.")

    # Write report
    with open('price_increase_report_v3.md', 'w', encoding='utf-8') as out:
        out.write("# 📱 3차 단가 5% 추가 인상 내역 (S급 기준)\n\n")
        out.write("요청하신 **아이폰 11~15 및 X 시리즈, 갤럭시 S20~S24 시리즈, 폴드 3~6**에 한하여 단가를 5% 추가 인상(백원 단위 절사)하였습니다.\n")
        out.write("*(용량별 단가 변동 없음, 제외기종 변동 없음)*\n\n")
        for series in sorted(results.keys()):
            out.write(f"## {series}\n")
            out.write("| 기종명 | 인상률 | 변경 전 단가 | 변경 후 단가 | 📈 추가 인상액 |\n")
            out.write("|---|:---:|---:|---:|---:|\n")
            for item in results[series]:
                out.write(f"| {item['model']} | **5%** | {item['old']:,}원 | **{item['new']:,}원** | <span style='color:red;'>+{item['diff']:,}원</span> |\n")
            out.write("\n")

if __name__ == "__main__":
    main()
