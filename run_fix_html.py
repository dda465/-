import re

file_path = "c:/Users/PC/Desktop/used-phone-market/admin.html"

with open(file_path, "r", encoding="utf-8") as f:
    text = f.read()

replacements = {
    "매입 신청 관리/h2>": "매입 신청 관리</h2>",
    "? ?로고침": "새로고침",
    "좌측 목록?서 고객???택?면 ????용??????습?다.": "좌측 목록에서 고객을 선택하면 채팅 내용이 표시됩니다.",
    "placeholder=\"고객?게 보낼 ?????력?세??(?터??송)\"": "placeholder=\"고객에게 보낼 메시지를 입력하세요 (엔터로 전송)\"",
    "시세 관리/h2>": "시세 관리</h2>",
    "? 구? ?트 ?기??/button>": "단가 구글 시트 동기화</button>",
    "<th>?리?/th>": "<th>시리즈</th>",
    "회원 관리/h2>": "회원 관리</h2>",
    "<th>??정?/th>": "<th>상세정보</th>",
    "<h3>매입 ?청 ?세?보": "<h3>매입 신청 상세정보",
    "<strong>?락?</strong>": "<strong>연락처:</strong>",
    "<strong>모델?</strong>": "<strong>모델명:</strong>",
    "<strong>??공?</strong>": "<strong>저장공간:</strong>",
    "placeholder=\"관리자??메모??력?세??></textarea>": "placeholder=\"관리자용 메모를 입력하세요\"></textarea>",
    "<label>모델?/label>": "<label>모델명</label>",
    "<p style=\"font-size: 0.8rem; color: #666;\">?시:": "<p style=\"font-size: 0.8rem; color: #666;\">예시:",
    "0?/span>": "0건</span>",
    "0건'": "0건</span>",
    "예: 아이폰 15 시리즈, 갤럭시 S24 시리즈": "예: 아이폰 15 시리즈, 갤럭시 S24 시리즈\"",
}

for k, v in replacements.items():
    text = text.replace(k, v)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(text)
