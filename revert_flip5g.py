import gspread

def get_multiplier(model_raw):
    model = str(model_raw).upper()
    if model == "갤럭시 FLIP 5G" or model == "FLIP 5G":
        return 0.9523809523809523  # Roughly 1 / 1.05 to revert
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
        
        # We know FLIP 5G was 103000 before, and became 108000
        # Wait, let's just do the exact math if we know the old values:
        # Actually, if we just multiply by 1/1.05 we get 102857.
        # So we can just hardcode or round nicely. Let's just do division and round to nearest 1000.
        new_val = val / 1.05
        # Since it was 103000 before (it might be different for A/B/C/D grades)
        # We round to nearest 1000.
        new_val = round(new_val / 1000) * 1000
        return int(new_val)
    except ValueError:
        return val_str

def main():
    print("Connecting to Google Sheets...")
    gc = gspread.service_account(filename="google-sheets-key.json")
    sheet_id = "1Uhfn4XPjxsTJMhELFIF8bSTY-1B78GtYG6cFeMs_kfc"
    worksheet = gc.open_by_key(sheet_id).sheet1
    
    data = worksheet.get_all_values()
    
    start_idx = 3 
    end_idx = 8 
    
    updated_count = 0

    print("Processing data to revert FLIP 5G...")
    for i in range(1, len(data)):
        row = data[i]
        if len(row) < 3:
            continue
            
        model = row[2].strip()
        
        if model == "갤럭시 FLIP 5G" or model == "FLIP 5G":
            limit = min(len(row), end_idx + 1)
            for col_idx in range(start_idx, limit):
                old_val = row[col_idx]
                data[i][col_idx] = update_val(old_val, 0.95238)
            updated_count += 1

    print(f"Updating Google Sheet... ({updated_count} models reverted)")
    if updated_count > 0:
        worksheet.update('A1', data) 
        print("Done! FLIP 5G reverted.")

if __name__ == "__main__":
    main()
