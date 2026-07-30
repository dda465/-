import gspread

def main():
    gc = gspread.service_account(filename="google-sheets-key.json")
    sheet_id = "1Uhfn4XPjxsTJMhELFIF8bSTY-1B78GtYG6cFeMs_kfc"
    worksheet = gc.open_by_key(sheet_id).sheet1
    
    data = worksheet.get_all_values()
    
    for i in range(1, len(data)):
        row = data[i]
        if len(row) < 3: continue
        model = str(row[2]).upper()
        if model == "갤럭시 FLIP 5G":
            # Reverse 5% and add 10000
            for col_idx in range(3, 8):
                val_str = row[col_idx]
                if not val_str: continue
                try:
                    val = float(str(val_str).replace(',', '').strip())
                    if val > 0:
                        # Find original by dividing by 1.05
                        # Because of floor: 108000 * 1.05 = 113400 -> 113000.
                        # So if val is 113000, old was 108000. 113000 / 1.05 = 107619. ceil -> 108000.
                        # Actually just add 5000 if it's S grade (113000), but we can just use a loop.
                        # Let's just find the original by searching 1000 multiples
                        for orig in range(1000, 2000000, 1000):
                            floored = (int(orig * 1.05) // 1000) * 1000
                            if floored == int(val):
                                # found orig
                                data[i][col_idx] = orig + 10000
                                break
                except Exception as e:
                    pass
    worksheet.update('A1', data)
    print("Fixed FLIP 5G")

if __name__ == "__main__":
    main()
