import re

with open('c:/Users/PC/Desktop/used-phone-market/admin.js', 'r', encoding='utf-8') as f:
    text = f.read()

# Fix updateStats
text = text.replace("pCountEl.innerText = `${pCount}건';", "pCountEl.innerText = `${pCount}건`;")
text = text.replace("pAmountEl.innerText = `${ new Intl.NumberFormat('ko-KR').format(pAmount) }원';", "pAmountEl.innerText = `${ new Intl.NumberFormat('ko-KR').format(pAmount) }원`;")
text = text.replace("mCountEl.innerText = `${mCount}건';", "mCountEl.innerText = `${mCount}건`;")
text = text.replace("mAmountEl.innerText = `${ new Intl.NumberFormat('ko-KR').format(mAmount) }원';", "mAmountEl.innerText = `${ new Intl.NumberFormat('ko-KR').format(mAmount) }원`;")

# Fix deleteQuote
text = text.replace('confirm("확인말 삭제확인청확인역삭제삭제확인시겠습확인까확인 (삭제확인업확인 확인돌삭제삭제습확인다)")', 'confirm("정말 삭제하시겠습니까? (삭제된 작업은 되돌릴 수 없습니다)")')
text = text.replace('alert("확인청확인역삭제삭제확인었확인니삭제");', 'alert("삭제되었습니다");')

# Fix loadUsers
text = text.replace('tableBody.innerHTML = \'<tr><td colspan="6" class="text-center">가확인된 확인원삭제확인습확인다.</td></tr>\';', 'tableBody.innerHTML = \'<tr><td colspan="6" class="text-center">가입된 회원이 없습니다.</td></tr>\';')
text = text.replace('data.createdAt 확인 new Date', 'data.createdAt ? new Date')
text = text.replace('title.textContent = \'확인규 모델 추확인\';', 'title.textContent = \'신규 모델 추가\';')

# Fix syncPricesFromSheet & loadPrices
text = text.replace('row[\'브랜삭제]', 'row[\'브랜드\']')
text = text.replace('row[\'확인리확인]', 'row[\'시리즈\']')
text = text.replace('row[\'모델확인]', 'row[\'모델명\']')

text = text.replace('row[\'확인품\']', 'row[\'미개봉\']')
text = text.replace('row[\'S확인]', 'row[\'S급\']')
text = text.replace('row[\'A확인]', 'row[\'A급\']')
text = text.replace('row[\'B확인]', 'row[\'B급\']')
text = text.replace('row[\'C확인]', 'row[\'C급\']')
text = text.replace('row[\'D확인]', 'row[\'D급\']')

text = text.replace('row[\'32기확인]', 'row[\'32기가\']')
text = text.replace('row[\'64기확인]', 'row[\'64기가\']')
text = text.replace('row[\'128기확인]', 'row[\'128기가\']')
text = text.replace('row[\'256기확인]', 'row[\'256기가\']')
text = text.replace('row[\'512기확인]', 'row[\'512기가\']')
text = text.replace('row[\'1확인라]', 'row[\'1테라\']')

text = text.replace('throw new Error("기존 확인이확인확인 삭제확인는 삭제류가 발생확인습확인다.");', 'throw new Error("기존 데이터를 삭제하는 중 오류가 발생했습니다.");')

text = text.replace('pricesTableBody.innerHTML = \'<tr><td colspan="6" class="text-center">확인록삭제확인세 확인이확인확인 확인습확인다. 마이그레확인션삭제진행확인주확인요.</td></tr>\';', 'pricesTableBody.innerHTML = \'<tr><td colspan="6" class="text-center">등록된 시세 데이터가 없습니다.</td></tr>\';')

# Fix formatting
text = text.replace('data.storageOptions 확인 data.storageOptions', 'data.storageOptions ? data.storageOptions')
text = text.replace('${s.size} (${s.priceAdjustment > 0 확인 \'+\' : \'\'', '${s.size} (${s.priceAdjustment > 0 ? \'+\' : \'\'')
text = text.replace('}${ s.priceAdjustment / 10000 }확인`', '}${ s.priceAdjustment / 10000 }만`')

text = text.replace('openModelModal(${JSON.stringify({ id, ...data })})\'>확인정</button>', 'openModelModal(${JSON.stringify({ id, ...data })})\'>수정</button>')

# Fix more stuff from lint
text = text.replace('let chatSessionId = null;', 'let chatSessionId = null;')
text = text.replace('chat.lastUpdated.toDate 확인 new Date', 'chat.lastUpdated.toDate ? new Date')

with open('c:/Users/PC/Desktop/used-phone-market/admin.js', 'w', encoding='utf-8') as f:
    f.write(text)
