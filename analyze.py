import pandas as pd

# Load Naver Ads Keyword List
try:
    df = pd.read_excel('키워드 목록 20260318 1916.xlsx')
    
    # Let's find the header row by searching for "키워드"
    if not df.columns.str.contains('키워드').any():
        header_row = df[df.apply(lambda row: row.astype(str).str.contains('키워드').any(), axis=1)].index[0]
        df = pd.read_excel('키워드 목록 20260318 1916.xlsx', header=header_row+1)

    # Find exact column names dynamically
    cost_col = [c for c in df.columns if '총비용' in c.replace(' ', '')][0]
    cpc_col = [c for c in df.columns if '평균클릭비용' in c.replace(' ', '')][0]
    ctr_col = [c for c in df.columns if '클릭률' in c.replace(' ', '')][0]
    kw_col = [c for c in df.columns if '키워드' in c and 'ID' not in c][0]
    imp_col = [c for c in df.columns if '노출수' in c.replace(' ', '')][0]
    clk_col = [c for c in df.columns if '클릭수' in c.replace(' ', '')][0]

    # Convert numeric columns
    for col in [imp_col, clk_col, ctr_col, cpc_col, cost_col]:
        df[col] = pd.to_numeric(df[col].astype(str).str.replace(',', '').str.replace('원', ''), errors='coerce').fillna(0)

    with open('analysis_report.txt', 'w', encoding='utf-8') as f:
        f.write("=== TOP 20 SPENDING KEYWORDS ===\n")
        f.write(df.sort_values(by=cost_col, ascending=False)[[kw_col, imp_col, clk_col, ctr_col, cpc_col, cost_col]].head(20).to_string())
        
        f.write("\n\n=== TOP 20 CLICKED KEYWORDS ===\n")
        f.write(df.sort_values(by=clk_col, ascending=False)[[kw_col, imp_col, clk_col, ctr_col, cpc_col, cost_col]].head(20).to_string())

        f.write("\n\n=== HIGHEST CTR (min 10 impressions) ===\n")
        f.write(df[df[imp_col] >= 10].sort_values(by=ctr_col, ascending=False)[[kw_col, imp_col, clk_col, ctr_col, cost_col]].head(20).to_string())

        f.write("\n\n=== ZERO CLICKS, HIGH SPEND/IMPRESSION ===\n")
        f.write(df[df[clk_col] == 0].sort_values(by=imp_col, ascending=False)[[kw_col, imp_col, clk_col, ctr_col, cost_col]].head(20).to_string())

except Exception as e:
    import traceback
    with open('analysis_report.txt', 'w', encoding='utf-8') as f:
        f.write(str(e) + "\n" + traceback.format_exc())
