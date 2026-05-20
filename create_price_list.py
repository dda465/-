import sys
with open('index.html', 'r', encoding='utf-8', errors='ignore') as f:
    lines = f.readlines()

start_nav = next(i for i, l in enumerate(lines) if '<nav class="navbar">' in l)
end_nav = next(i for i, l in enumerate(lines) if '</nav>' in l)
start_foot = next(i for i, l in enumerate(lines) if '<footer' in l)
end_foot = next(i for i, l in enumerate(lines) if '</footer>' in l)

content = ''.join(lines[:end_nav+1]) + '''
<main class="container" style="max-width: 800px; margin: 40px auto; min-height: 50vh; padding: 0 20px;">
  <h2 style="text-align:center; margin-bottom:30px; font-family: 'GmarketSans', sans-serif;">매입 단가표</h2>
  
  <div class="search-bar" style="display:flex; justify-content:center; margin-bottom:20px;">
    <input type="text" id="model-search" placeholder="모델명 검색" style="padding:12px; width:100%; max-width:400px; border:1px solid #ccc; border-radius:12px; font-size: 1rem;">
  </div>
  
  <div class="filter-tabs" style="display:flex; gap:10px; justify-content:center; margin-bottom:30px;">
    <button class="filter-btn active btn btn-primary" data-brand="all" style="padding:10px 20px; border-radius: 20px;">전체</button>
    <button class="filter-btn btn btn-outline" data-brand="apple" style="padding:10px 20px; border-radius: 20px;">애플</button>
    <button class="filter-btn btn btn-outline" data-brand="samsung" style="padding:10px 20px; border-radius: 20px;">삼성</button>
  </div>
  
  <div class="table-responsive" style="overflow-x:auto; background: white; border-radius: 16px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid #f1f5f9;">
    <table style="width:100%; border-collapse:collapse; text-align:center;">
      <thead>
        <tr style="background:#f8fafc; border-bottom:2px solid #e2e8f0;">
            <th style="padding:16px; width: 40%;">기종</th>
            <th style="padding:16px; width: 60%;">예상 매입가 (하자~S급)</th>
        </tr>
      </thead>
      <tbody id="price-table-body">
        <tr><td colspan="2" style="padding: 30px;">데이터를 불러오는 중입니다...</td></tr>
      </tbody>
    </table>
  </div>
</main>
''' + ''.join(lines[start_foot:end_foot+1]) + '''
<script type="module" src="script.js?v=''' + str(hash("cache")) + '''"></script>
<script>
    document.addEventListener('DOMContentLoaded', () => {
        // Expose initPriceList and call it
        setTimeout(() => {
            if (typeof window.initPriceList === 'function') {
                window.initPriceList();
            } else {
                console.error("initPriceList function not found!");
            }
        }, 500);
    });
</script>
</body>
</html>
'''

with open('price-list.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("price-list.html created successfully.")
