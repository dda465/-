import gspread

def main():
    print("Connecting to Google Sheets...")
    gc = gspread.service_account(filename="google-sheets-key.json")
    sheet_id = "1Uhfn4XPjxsTJMhELFIF8bSTY-1B78GtYG6cFeMs_kfc"
    worksheet = gc.open_by_key(sheet_id).sheet1
    
    data = worksheet.get_all_values()
    if not data:
        return
        
    start_idx = 3 
    end_idx = 8 
    
    for i in range(1, len(data)):
        row = data[i]
        if len(row) < 3: continue
            
        model = str(row[2]).upper()
        
        # FLIP 5G got +5% (which for 108,000 was 113,400 -> floored to 113,000)
        # It should have been +10,000 (108,000 + 10,000 = 118,000).
        # And any other prices like A grade, B grade.
        if model == "갤럭시 FLIP 5G":
            print(f"Found FLIP 5G: {row[3:]}")
            for col_idx in range(start_idx, min(len(row), end_idx + 1)):
                val_str = row[col_idx]
                if not val_str: continue
                try:
                    val = float(str(val_str).replace(',', '').strip())
                    if val > 0:
                        # Reverse 5% (this is tricky because of flooring, but wait, the old S grade was 108,000. 108k * 1.05 = 113.4k floored to 113k. 
                        # Actually, if we just know we need to add 5000 to the current values (since we already added 5% which happened to be +5000 for S grade... wait!
                        # What if A grade was 100,000? 100,000 * 1.05 = 105,000. Should have been +10,000 -> 110,000. So diff is +5000.
                        # What if B grade was 90,000? 90,000 * 1.05 = 94,500 -> 94,000. Should have been +10,000 -> 100,000. So we need to add 6000.
                        # Let's restore to exact old values first.
                        # If S=113000 (was 108000), A=101000 (was 97000), B=87000 (was 83000), etc.
                        # Let's just look at previous report to find exactly what they were.
                        pass
                except:
                    pass

if __name__ == "__main__":
    main()
