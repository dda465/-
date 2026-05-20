import pandas as pd
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
os.chdir('c:/Users/PC/Desktop/used-phone-market/광고현황')

report_md = ""

try:
    df_group = pd.read_csv("광고그룹 보고서,2416927.csv", encoding='utf-8', skiprows=1)
    for col in ['총비용', '클릭수', '노출수']:
        if col in df_group.columns:
            df_group[col] = pd.to_numeric(df_group[col].astype(str).str.replace(',', ''), errors='coerce').fillna(0)
    
    if 'PC/모바일 매체' in df_group.columns:
        device_perf = df_group.groupby('PC/모바일 매체')[['노출수', '클릭수', '총비용']].sum()
        device_perf['CTR(%)'] = (device_perf['클릭수'] / device_perf['노출수'] * 100).round(2)
        device_perf['CPC(원)'] = (device_perf['총비용'] / device_perf['클릭수']).fillna(0).round(0)
        report_md += "\n--- 매체별 ---\n"
        report_md += device_perf.to_string()
        
    if '상세지역' in df_group.columns:
        region_perf = df_group.groupby('상세지역')[['노출수', '클릭수', '총비용']].sum().sort_values('노출수', ascending=False).head(5)
        report_md += "\n\n--- 지역별 ---\n"
        report_md += region_perf.to_string()

except Exception as e:
    report_md += f"Error: {e}"

print(report_md)
