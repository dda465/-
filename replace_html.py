import os
import re

file_path = "c:/Users/PC/Desktop/used-phone-market/admin.html"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

replacements = {
    "愿€由ъ옄 ?섏씠吏€ - Sharaphone": "관리자 페이지 - Sharaphone",
    "愿€由ъ옄 ?묒냽": "관리자 접속",
    "愿€由ъ옄 怨꾩젙?쇰줈 濡쒓렇?명빐二쇱꽭??/p>": "관리자 계정으로 로그인해주세요</p>",
    "濡쒓렇???곹깭瑜??뺤씤 以묒엯?덈떎...": "로그인 상태를 확인 중입니다...",
    "濡쒓렇??\n                ?섏씠吏€濡??대룞": "로그인 페이지로 이동",
    "SR 濡쒓퀬": "SR 로고",
    "?먮씪??": "쉐라폰",
    "愿€由ъ옄 紐⑤뱶": "관리자 모드",
    "濡쒓렇?꾩썐": "로그아웃",
    "留ㅼ엯 ?좎껌 愿€由?": "매입 신청 관리",
    "?쒖꽭 愿€由?": "시세 관리",
    "?뚯썝 愿€由?": "회원 관리",
    "?댁???": "휴지통",
    "?낃툑 ?€湲??낃툑 ?꾩슂)": "입금 대기(입금 필요)",
    "?대쾲??留ㅼ엯 ?꾨즺": "이번달 매입 완료",
    "0嫄?": "0건",
    "0??": "0원",
    "?좎껌 紐⑸줉": "신청 목록",
    "<th>?좎껌?쇱떆</th>": "<th>신청일시</th>",
    "<th>怨좉컼紐?</th>": "<th>고객명</th>",
    "<th>紐⑤뜽紐?</th>": "<th>모델명</th>",
    "<th>?곹깭/?깃툒</th>": "<th>상태/등급</th>",
    "<th>?덉긽留ㅼ엯媛€</th>": "<th>예상매입가</th>",
    "<th>吏꾪뻾?곹깭</th>": "<th>진행상태</th>",
    "<th>愿€由?</th>": "<th>관리</th>",
    "濡쒕뵫 以?..": "로딩 중...",
    "援ш? ?쒗듃 ?숆린??": "구글 시트 동기화",
    "+ ?좉퇋 紐⑤뜽 異붽?": "+ 신규 모델 추가",
    "紐⑤뜽紐?寃€??..": "모델명 검색...",
    "<th>?쒖“??/th>": "<th>제조사</th>",
    "<th>?쒕━利?</th>": "<th>시리즈</th>",
    "<th>湲곕낯 留ㅼ엯媛€ (S湲?</th>": "<th>기본 매입가 (S급)</th>",
    "<th>?⑸웾 ?듭뀡</th>": "<th>용량 옵션</th>",
    "<th>媛€?낆씪??/th>": "<th>가입일시</th>",
    "<th>?대찓??/th>": "<th>이메일</th>",
    "<th>?대쫫</th>": "<th>이름</th>",
    "<th>?꾪솕踰덊샇</th>": "<th>전화번호</th>",
    "<th>媛€?낃꼍濡?</th>": "<th>가입경로</th>",
    "<th>?댁???(??젣???댁뿭)</th>": "<th>휴지통 (삭제된 내역)</th>",
    "<th>愿€由?蹂듦뎄/?꾩쟾??젣)</th>": "<th>관리 (복구/완전삭제)</th>",
    "留ㅼ엯 ?좎껌 ?곸꽭?뺣낫": "매입 신청 상세정보",
    "<h4>?좎껌???뺣낫</h4>": "<h4>신청자 정보</h4>",
    "<strong>?대쫫:</strong>": "<strong>이름:</strong>",
    "<strong>?곕씫泥?</strong>": "<strong>연락처:</strong>",
    "<strong>?섍굅諛⑹떇:</strong>": "<strong>수거방식:</strong>",
    "<strong>二쇱냼:</strong>": "<strong>주소:</strong>",
    "<strong>怨꾩쥖踰덊샇:</strong>": "<strong>계좌번호:</strong>",
    "<strong>?좎껌?쇱떆:</strong>": "<strong>신청일시:</strong>",
    "<h4>湲곌린 ?뺣낫</h4>": "<h4>기기 정보</h4>",
    "<strong>紐⑤뜽紐?</strong>": "<strong>모델명:</strong>",
    "<strong>?€?κ났媛?</strong>": "<strong>저장공간:</strong>",
    "<strong>?곹깭:</strong>": "<strong>상태:</strong>",
    "<strong>?덉긽留ㅼ엯媛€:</strong>": "<strong>예상매입가:</strong>",
    "<h4>?곸꽭 ?곹깭 / 李④컧 ?댁뿭</h4>": "<h4>상세 상태 / 차감 내역</h4>",
    "<h4>怨좉컼 ?붿껌?ы빆 / 硫붾え</h4>": "<h4>고객 요청사항 / 메모</h4>",
    "<h4>愿€由ъ옄 硫붾え</h4>": "<h4>관리자 메모</h4>",
    "placeholder=\"愿€由ъ옄??硫붾え瑜??낅젰?섏꽭??>": "placeholder=\"관리자용 메모를 입력하세요\">",
    "硫붾え<br>?€??/button>": "메모<br>저장</button>",
    ">?リ린</button>": ">닫기</button>",
    "<h3>紐⑤뜽 異붽?/?섏젙</h3>": "<h3>모델 추가/수정</h3>",
    "<label>?쒖“??/label>": "<label>제조사</label>",
    "<label>?쒕━利?Grouping)</label>": "<label>시리즈(Grouping)</label>",
    "placeholder=\"?? ?꾩씠??15 ?쒕━利? 媛ㅻ윮??S24 ?쒕━利?": "placeholder=\"예: 아이폰 15 시리즈, 갤럭시 S24 시리즈",
    "<label>紐⑤뜽紐?</label>": "<label>모델명</label>",
    "placeholder=\"?? ?꾩씠??15 ?꾨줈\"": "placeholder=\"예: 아이폰 15 프로\"",
    "<label>湲곕낯 留ㅼ엯媛€ (KRW)</label>": "<label>기본 매입가 (KRW)</label>",
    "<label>?⑸웾 ?듭뀡 (JSON ?뺤떇)</label>": "<label>용량 옵션 (JSON 형식)</label>",
    "?덉떆: [{\"size\": \"128GB\", \"priceAdjustment\":": "예시: [{\"size\": \"128GB\", \"priceAdjustment\":",
    ">痍⑥냼</button>": ">취소</button>",
    ">?€??/button>": ">저장</button>",
    "愿€由ъ옄": "관리자",
    "?섏씠吏€": "페이지",
    "留ㅼ엯": "매입",
    "?좎껌": "신청",
    "愿€由?": "관리",
    "?대쾲??": "이번달",
    "紐⑸줉": "목록"
}

# Apply major replacements first
for old_str, new_str in replacements.items():
    content = content.replace(old_str, new_str)
    
# Manual cleanup of any stray characters
content = content.replace("?묒냽", "접속")
content = content.replace("怨꾩젙?쇰줈", "계정으로")
content = content.replace("濡쒓렇?명빐二쇱꽭??/p>", "로그인해주세요</p>")
content = content.replace("濡쒓렇???곹깭瑜??뺤씤", "로그인 상태를 확인")
content = content.replace("以묒엯?덈떎...", "중입니다...")
content = content.replace("濡쒓렇??\n                ?섏씠吏€濡??대룞", "로그인\n                페이지로 이동")
content = content.replace("濡쒓퀬", "로고")
content = content.replace("?먮씪??", "쉐라폰")
content = content.replace("紐⑤뱶", "모드")
content = content.replace("濡쒓렇?꾩썐", "로그아웃")
content = content.replace("?쒖꽭", "시세")
content = content.replace("?뚯썝", "회원")
content = content.replace("?댁???", "휴지통")
content = content.replace("?낃툑", "입금")
content = content.replace("?€湲??낃툑", "대기(입금")
content = content.replace("?꾩슂)", "필요)")
content = content.replace("?꾨즺", "완료")
content = content.replace("?떆", "일시")
content = content.replace("怨좉컼紐?", "고객명")
content = content.replace("紐⑤뜽紐?", "모델명")
content = content.replace("?곹깭/?깃툒", "상태/등급")
content = content.replace("?덉긽", "예상")
content = content.replace("媛€", "가")
content = content.replace("吏꾪뻾?곹깭", "진행상태")
content = content.replace("濡쒕뵫", "로딩")
content = content.replace("以?..", "중...")
content = content.replace("援ш?", "구글")
content = content.replace("?쒗듃", "시트")
content = content.replace("?숆린??", "동기화")
content = content.replace("?좉퇋", "신규")
content = content.replace("異붽?", "추가")
content = content.replace("寃€??..", "검색...")
content = content.replace("?쒖“??", "제조사")
content = content.replace("?쒕━利?", "시리즈")
content = content.replace("湲곕낯", "기본")
content = content.replace("S湲?", "S급")
content = content.replace("?⑸웾", "용량")
content = content.replace("?듭뀡", "옵션")
content = content.replace("媛€?낆씪??", "가입일시")
content = content.replace("?대찓??", "이메일")
content = content.replace("?대쫫", "이름")
content = content.replace("?꾪솕踰덊샇", "전화번호")
content = content.replace("媛€?낃꼍濡?", "가입경로")
content = content.replace("??젣???댁뿭)", "삭제된 내역)")
content = content.replace("蹂듦뎄/?꾩쟾??젣)", "복구/완전삭제)")
content = content.replace("?곸꽭?뺣낫", "상세정보")
content = content.replace("?뺣낫", "정보")
content = content.replace("?곕씫泥?", "연락처")
content = content.replace("?섍굅諛⑹떇", "수거방식")
content = content.replace("二쇱냼", "주소")
content = content.replace("怨꾩쥖踰덊샇", "계좌번호")
content = content.replace("湲곌린", "기기")
content = content.replace("?€?κ났媛?", "저장공간")
content = content.replace("?곹깭", "상태")
content = content.replace("李④컧", "차감")
content = content.replace("怨컼", "고객") # there was 怨ꢉ컼 actually
content = content.replace("怨ꢉ컼", "고객")
content = content.replace("?붿껌?ы빆", "요청사항")
content = content.replace("硫붾え", "메모")
content = content.replace("?낅젰?섏꽭??>", "입력하세요\">")
content = content.replace("?€??/button>", "저장</button>")
content = content.replace("?リ린", "닫기")
content = content.replace("?섏젙", "수정")
content = content.replace("??", "예")
content = content.replace("?꾩씠??15", "아이폰 15")
content = content.replace("媛ㅻ윮??S24", "갤럭시 S24")
content = content.replace("?꾨줈", "프로")
content = content.replace("?뺤떇", "형식")
content = content.replace("?덉떆", "예시")
content = content.replace("痍⑥냼", "취소")
content = content.replace("?€??", "저장")

# extra
content = content.replace('?섏씠吏€', '페이지')
content = content.replace('?대룞', '이동')
content = content.replace('濡쒓렇??', '로그인')
content = content.replace('?곹깭瑜', '상태를')
content = content.replace('?뺤씤', '확인')
content = content.replace('以묒엯?덈떎', '중입니다')
content = content.replace('?낃툑', '입금')
content = content.replace('李④컧', '차감')
content = content.replace('<span class="logo-text-wrapper"\n                    style="font-family: \'Pretendard\', sans-serif; font-weight: 700; font-size: 20px; color: #2563EB; margin-left: 8px;">\n                    쉐라폰\n                </span>', '<span class="logo-text-wrapper"\n                    style="font-family: \'Pretendard\', sans-serif; font-weight: 700; font-size: 20px; color: #2563EB; margin-left: 8px;">\n                    쉐라폰\n                </span>')

# Clean duplicate Stats Dashboard
lines = content.split("\n")
cleaned_lines = []
skip = False
for i, line in enumerate(lines):
    # Duplicate stats dashboard occurs directly after `<h3 class="mb-2" style="font-size: 1.1rem; color: var(--text-secondary);">신청 목록</h3>`
    # Let's count how many times we see `신청 목록</h3>`
    cleaned_lines.append(line)

content = "\n".join(cleaned_lines)
# Remove duplicate dashboard block if it exists
import re
match = re.search(r'(<h3 class="mb-2" style="font-size: 1.1rem; color: var(--text-secondary);">신청 목록</h3>.*?)<h3 class="mb-2" style="font-size: 1.1rem; color: var(--text-secondary);">신청 목록</h3>', content, flags=re.DOTALL)
if match:
    content = content.replace(match.group(1), "")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print(content[:500])
print("\n--- Done ---")
