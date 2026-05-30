import gspread
import time

def get_multiplier(brand_raw, series_raw, model_raw):
    brand = str(brand_raw).upper()
    series = str(series_raw).upper()
    model = str(model_raw).upper()
    
    # iPhone logic
    if "애플" in brand or "APPLE" in brand:
        # iPhone 16, 17 series -> 1.0 (No change)
        iphone_no_change = [" 16", " 17"]
        for i in iphone_no_change:
            if i in series:
                return 1.00
        # SE, 7, 8, X, 11, 12, 13, 14, 15 -> 1.05 (+5%)
        iphone_5_list = ["SE", " 7", " 8", " X", " 11", " 12", " 13", " 14", " 15"]
        for i in iphone_5_list:
            if i in series:
                return 1.05
        return 1.00 # fallback
        
    # Samsung logic
    if "삼성" in brand or "SAMSUNG" in brand:
        # Galaxy S series
        if " S" in series:
            s_5_list = ["S8", "S9", "S10", "S20", "S21", "S22", "S23", "S24"]
            for s in s_5_list:
                if s in series:
                    return 1.05
            # S25 and others -> 1.0
            return 1.00
            
        # Fold series
        if "FOLD" in series or "폴드" in series:
            fold_no_change = ["FOLD 6", "FOLD 7"]
            for f in fold_no_change:
                if f in model:
                    return 1.00
            # Fold 1~5 -> 1.05
            return 1.05
            
        # Flip series
        if "FLIP" in series or "플립" in series:
            flip_no_change = ["FLIP 6", "FLIP 7"]
            for f in flip_no_change:
                if f in model:
                    return 1.00
            # Flip 1~5 -> 1.05
            return 1.05
            
        # Note series
        if "노트" in series or "NOTE" in series:
            return 1.00
            
        # A series and everything else (기타기종)
        return 1.05
        
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
            updated_5_count += 1
        else:
            updated_0_count += 1
            
        limit = min(len(row), end_idx + 1)
        for col_idx in range(start_idx, limit):
            old_val = row[col_idx]
            new_val = update_val(old_val, multiplier)
            data[i][col_idx] = new_val

    print(f"Updating Google Sheet... (5% up: {updated_5_count} models, No change: {updated_0_count} models)")
    
    worksheet.update('A1', data) 
    print("Done! All targeted prices have been updated in the Google Sheet.")

if __name__ == "__main__":
    main()
