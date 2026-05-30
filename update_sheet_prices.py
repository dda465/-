import gspread
import time

def get_multiplier(brand_raw, series_raw, model_raw):
    brand = str(brand_raw).upper()
    series = str(series_raw).upper()
    model = str(model_raw).upper()
    
    # iPhone logic
    if "애플" in brand or "APPLE" in brand:
        iphone_10_list = ["SE", " 7", " 8", " X", " 11", " 12", " 13", " 14"]
        for i in iphone_10_list:
            if i in series:
                return 1.10
        return 1.05 # iPhone 15, 16, 17, etc
        
    # Samsung logic
    if "삼성" in brand or "SAMSUNG" in brand:
        # Galaxy S series
        if " S" in series:
            s_10_list = ["S8", "S9", "S10", "S20", "S21", "S22", "S23"]
            for s in s_10_list:
                if s in series:
                    return 1.10
            return 1.05 # S24, S25, etc
            
        # Fold series
        if "FOLD" in series or "폴드" in series:
            fold_5_plus = ["FOLD 5", "FOLD 6", "FOLD 7"]
            for f in fold_5_plus:
                if f in model:
                    return 1.05
            return 1.10 # Fold 1~4
            
        # Flip series
        if "FLIP" in series or "플립" in series:
            flip_5_plus = ["FLIP 5", "FLIP 6", "FLIP 7"]
            for f in flip_5_plus:
                if f in model:
                    return 1.05
            return 1.10 # Flip 1~4
            
        # Note series
        if "노트" in series or "NOTE" in series:
            return 1.05
            
        # A series and everything else (기타기종)
        return 1.10
        
    return 1.05

def update_val(val_str, multiplier):
    if not val_str:
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
        
    headers = data[0]
    
    # Target columns: 신품, S급, A급, B급, C급, D급 (Indices 3 to 8)
    start_idx = 3 
    end_idx = 8 
    
    updated_10_count = 0
    updated_5_count = 0

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
        if multiplier == 1.10:
            updated_10_count += 1
        else:
            updated_5_count += 1
            
        # Update only grade columns (D급 is index 8)
        # Avoid out of bounds if row is short
        limit = min(len(row), end_idx + 1)
        for col_idx in range(start_idx, limit):
            old_val = row[col_idx]
            new_val = update_val(old_val, multiplier)
            data[i][col_idx] = new_val

    print(f"Updating Google Sheet... (10% up: {updated_10_count} models, 5% up: {updated_5_count} models)")
    
    # To avoid API issues where `gspread` might complain about empty cells or int conversions,
    # we convert everything back to strings before writing, or let gspread handle it.
    # gspread handles integers well, but just in case, we write back exactly the shape.
    
    # A common gspread warning is updating ranges with varying lengths if we don't pad them.
    # get_all_values() returns rectangular data usually.
    
    worksheet.update('A1', data) 
    print("Done! All prices have been updated in the Google Sheet.")

if __name__ == "__main__":
    main()
