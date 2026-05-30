import gspread

def get_multiplier(brand_raw, series_raw, model_raw):
    brand = str(brand_raw).upper()
    series = str(series_raw).upper()
    model = str(model_raw).upper()
    
    # iPhone logic
    if "애플" in brand or "APPLE" in brand:
        iphone_no_change = [" 16", " 17"]
        for i in iphone_no_change:
            if i in series:
                return 1.00
        iphone_5_list = ["SE", " 7", " 8", " X", " 11", " 12", " 13", " 14", " 15"]
        for i in iphone_5_list:
            if i in series:
                return 1.05
        return 1.00
        
    # Samsung logic
    if "삼성" in brand or "SAMSUNG" in brand:
        if " S" in series:
            s_5_list = ["S8", "S9", "S10", "S20", "S21", "S22", "S23", "S24"]
            for s in s_5_list:
                if s in series:
                    return 1.05
            return 1.00
            
        if "FOLD" in series or "폴드" in series:
            fold_no_change = ["FOLD 6", "FOLD 7"]
            for f in fold_no_change:
                if f in model:
                    return 1.00
            return 1.05
            
        if "FLIP" in series or "플립" in series:
            flip_no_change = ["FLIP 6", "FLIP 7"]
            for f in flip_no_change:
                if f in model:
                    return 1.00
            return 1.05
            
        if "노트" in series or "NOTE" in series:
            return 1.00
            
        return 1.05
        
    return 1.00

def format_krw(val):
    if not val or val == '0':
        return "-"
    try:
        return f"{int(float(str(val).replace(',', ''))):,}원"
    except:
        return str(val)

def main():
    gc = gspread.service_account(filename="google-sheets-key.json")
    sheet_id = "1Uhfn4XPjxsTJMhELFIF8bSTY-1B78GtYG6cFeMs_kfc"
    worksheet = gc.open_by_key(sheet_id).sheet1
    
    data = worksheet.get_all_values()
    
    results = {}
    
    # 0:브랜드, 1:시리즈, 2:모델명, 4:S급
    for i in range(1, len(data)):
        row = data[i]
        if len(row) < 5:
            continue
        brand = row[0].strip()
        series = row[1].strip()
        model = row[2].strip()
        s_grade_new_str = row[4].strip()
        
        if not brand or not model:
            continue
            
        multiplier = get_multiplier(brand, series, model)
        if multiplier == 1.00:
            continue
            
        s_grade_new = 0
        try:
            s_grade_new = int(float(s_grade_new_str.replace(',', '')))
        except:
            pass
            
        if s_grade_new == 0:
            continue
            
        s_grade_old_approx = round((s_grade_new / multiplier) / 1000) * 1000
        diff = s_grade_new - s_grade_old_approx
        percent_str = "5%"
        
        if series not in results:
            results[series] = []
            
        results[series].append({
            "model": model,
            "old": s_grade_old_approx,
            "new": s_grade_new,
            "diff": diff,
            "percent": percent_str
        })

    # Write to a markdown artifact
    with open('price_increase_report_v2.md', 'w', encoding='utf-8') as out:
        out.write("# 📱 기종별 단가 추가 인상 내역 보고서 (S급 기준)\n\n")
        out.write("이번 2차 업데이트를 통해 조건에 맞는 특정 모델에만 추가 인상된 **S급 단가** 기준 정리 내역입니다.\n")
        out.write("*(용량별 단가 변동 없음, 백원 단위 절사, S25/폴드6/플립6 등 제외기종은 리스트에 나타나지 않습니다)*\n\n")
        
        for series in sorted(results.keys()):
            out.write(f"## {series}\n")
            out.write("| 기종명 | 인상률 | 변경 전 단가 | 변경 후 단가 | 📈 추가 인상액 |\n")
            out.write("|---|:---:|---:|---:|---:|\n")
            for item in results[series]:
                out.write(f"| {item['model']} | **{item['percent']}** | {format_krw(item['old'])} | **{format_krw(item['new'])}** | <span style='color:red;'>+{format_krw(item['diff'])}</span> |\n")
            out.write("\n")

if __name__ == "__main__":
    main()
