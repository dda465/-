import gspread

def get_multiplier(series_raw):
    series = str(series_raw).upper()
    if "노트" in series or "NOTE" in series:
        return 1.10
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
        
    start_idx = 3 
    end_idx = 8 
    
    updated_count = 0
    results = {}

    print("Processing data...")
    for i in range(1, len(data)):
        row = data[i]
        if len(row) < 3:
            continue
            
        series = row[1]
        model = row[2]
        s_grade_old_str = row[4]
        
        multiplier = get_multiplier(series)
        if multiplier == 1.10:
            s_grade_old = 0
            try:
                s_grade_old = int(float(s_grade_old_str.replace(',', '')))
            except:
                pass
                
            limit = min(len(row), end_idx + 1)
            for col_idx in range(start_idx, limit):
                old_val = row[col_idx]
                data[i][col_idx] = update_val(old_val, multiplier)
                
            updated_count += 1
            
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

    print(f"Updating Google Sheet... ({updated_count} Note models updated)")
    if updated_count > 0:
        worksheet.update('A1', data) 
        print("Done! Note series prices updated.")
        
        # Write report
        with open('price_increase_report_note.md', 'w', encoding='utf-8') as out:
            out.write("# 📱 갤럭시 노트 시리즈 10% 추가 인상 내역 (S급 기준)\n\n")
            out.write("요청하신 대로 **갤럭시 노트 시리즈**에 한하여 단가를 10% 인상(백원 단위 절사)하였습니다.\n\n")
            for series in sorted(results.keys()):
                out.write(f"## {series}\n")
                out.write("| 기종명 | 인상률 | 변경 전 단가 | 변경 후 단가 | 📈 추가 인상액 |\n")
                out.write("|---|:---:|---:|---:|---:|\n")
                for item in results[series]:
                    out.write(f"| {item['model']} | **10%** | {item['old']:,}원 | **{item['new']:,}원** | <span style='color:red;'>+{item['diff']:,}원</span> |\n")
                out.write("\n")
    else:
        print("No Note series found to update.")

if __name__ == "__main__":
    main()
