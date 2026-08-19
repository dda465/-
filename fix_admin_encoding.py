import os

file_path = "c:/Users/PC/Desktop/used-phone-market/admin.html"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

replacements = {
    "관리자 ?\ufffd이지": "관리자 페이지",
    "관리자 ?\ufffd속": "관리자 접속",
    "관리자 계정?\ufffd로 로그?\ufffd해주세??": "관리자 계정으로 로그인해주세요",
    "로그???\ufffd태\ufffd??\ufffd인 중입?\ufffd다...": "로그인 상태를 확인 중입니다...",
    "로그??\n                ?\ufffd이지\ufffd??\ufffd동</button>": "로그인 페이지로 이동</button>",
    "?\ufffd라??": "쉐라폰",
    "매입 ?\ufffd청 관\ufffd?": "매입 신청 관리",
    "?\ufffd세 관\ufffd?": "시세 관리",
    "?\ufffd원 관\ufffd?": "회원 관리",
    "?\ufffd금 ?\ufffd\ufffd?(?\ufffd금 ?\ufffd요)": "입금 대기(입금 필요)",
    "?\ufffd달??매입 ?\ufffd료": "이번달 매입 완료",
    "?\ufffd청 목록": "신청 목록",
    "<th>?\ufffd청?\ufffd시</th>": "<th>신청일시</th>",
    "<th>고객\ufffd?</th>": "<th>고객명</th>",
    "<th>모델\ufffd?</th>": "<th>모델명</th>",
    "<th>?\ufffd태/?\ufffd급</th>": "<th>상태/등급</th>",
    "<th>?\ufffd상매입가</th>": "<th>예상매입가</th>",
    "<th>진행?\ufffd태</th>": "<th>진행상태</th>",
    "<th>관\ufffd?</th>": "<th>관리</th>",
    "로딩 \ufffd?..": "로딩 중...",
    "?\ufffd? ?\ufffd로고침": "새로고침",
    "채팅 ?\ufffd역??불러?\ufffd는 \ufffd?..": "채팅 내역을 불러오는 중...",
    "채팅???\ufffd택?\ufffd주?\ufffd요": "채팅방을 선택해주세요",
    "좌측 목록?\ufffd서 고객???\ufffd택?\ufffd면 ?\ufffd??\ufffd용??\ufffd????\ufffd습?\ufffd다.": "좌측 목록에서 고객을 선택하면 채팅 내용이 표시됩니다.",
    "placeholder=\"고객?\ufffd게 보낼 ?\ufffd???\ufffd력?\ufffd세??(?\ufffd터??\ufffd송)\"": "placeholder=\"고객에게 보낼 메시지를 입력하세요 (엔터로 전송)\"",
    "?\ufffd송</button>": "전송</button>",
    "로그?\ufffd웃": "로그아웃",
    "?\ufffd\ufffd 구\ufffd? ?\ufffd트 ?\ufffd기\ufffd?": "단가 구글 시트 동기화",
    "+ ?\ufffd규 모델 추\ufffd?": "+ 신규 모델 추가",
    "placeholder=\"모델\ufffd?검??..\"": "placeholder=\"모델명 검색...\"",
    "<th>?\ufffd조??/th>": "<th>제조사</th>",
    "<th>?\ufffd리\ufffd?</th>": "<th>시리즈</th>",
    "<th>기본 매입가 (S\ufffd?</th>": "<th>기본 매입가 (S급)</th>",
    "<th>?\ufffd량 ?\ufffd션</th>": "<th>용량 옵션</th>",
    "<th>가?\ufffd일??/th>": "<th>가입일시</th>",
    "<th>?\ufffd메??/th>": "<th>이메일</th>",
    "<th>?\ufffd름</th>": "<th>이름</th>",
    "<th>?\ufffd화번호</th>": "<th>전화번호</th>",
    "<th>??\ufffd정\ufffd?</th>": "<th>상세정보</th>",
    "<h3>매입 ?\ufffd청 ?\ufffd세?\ufffd보": "<h3>매입 신청 상세정보",
    "?\ufffd청???\ufffd보": "신청자 정보",
    "<strong>?\ufffd름:</strong>": "<strong>이름:</strong>",
    "<strong>?\ufffd락?</strong>": "<strong>연락처:</strong>",
    "<strong>?\ufffd거방식:</strong>": "<strong>수거방식:</strong>",
    "<strong>?\ufffd청?\ufffd시:</strong>": "<strong>신청일시:</strong>",
    "<strong>모델?</strong>": "<strong>모델명:</strong>",
    "<strong>??\ufffd공\ufffd?</strong>": "<strong>저장공간:</strong>",
    "<strong>?\ufffd태:</strong>": "<strong>상태:</strong>",
    "<strong>?\ufffd상매입가:</strong>": "<strong>예상매입가:</strong>",
    "?\ufffd세 ?\ufffd태 / 차감 ?\ufffd역": "상세 상태 / 차감 내역",
    "고객 ?\ufffd청?\ufffd항 / 메모": "고객 요청사항 / 메모",
    "placeholder=\"관리자??메모??\ufffd력?\ufffd세??></textarea>": "placeholder=\"관리자용 메모를 입력하세요\"></textarea>",
    "메모<br>?\ufffd??/button>": "메모<br>저장</button>",
    "class=\"action-btn\">?\ufffd기</button>": "class=\"action-btn\">닫기</button>",
    "모델 추\ufffd?/?\ufffd정": "모델 추가/수정",
    "<label>?\ufffd조??/label>": "<label>제조사</label>",
    "<label>?\ufffd리\ufffd?(Grouping)</label>": "<label>시리즈(Grouping)</label>",
    "placeholder=\"?? ?\ufffd이??15 ?\ufffd리\ufffd? 갤럭??S24 ?\ufffd리\ufffd?": "placeholder=\"예: 아이폰 15 시리즈, 갤럭시 S24 시리즈",
    "<label>모델?</label>": "<label>모델명</label>",
    "placeholder=\"?? ?\ufffd이??15 ?\ufffd로\"": "placeholder=\"예: 아이폰 15 프로\"",
    "<label>?\ufffd량 ?\ufffd션 (JSON ?\ufffd식)</label>": "<label>용량 옵션 (JSON 형식)</label>",
    "style=\"background: var(--primary-color); color: white; border: none;\">?\ufffd??/button>": "style=\"background: var(--primary-color); color: white; border: none;\">저장</button>",
    "기기 ?\ufffd보": "기기 정보",
    "매입 ?\ufffd청 관\ufffd?/h2>": "매입 신청 관리</h2>",
    "?\ufffd세 관\ufffd?/h2>": "시세 관리</h2>",
    "?\ufffd원 관\ufffd?/h2>": "회원 관리</h2>",
    "<th>고객\ufffd?/th>": "<th>고객명</th>",
    "<th>모델\ufffd?/th>": "<th>모델명</th>",
    "<th>관\ufffd?/th>": "<th>관리</th>",
    "?\ufffd청 목록": "신청 목록"
}

for old_str, new_str in replacements.items():
    content = content.replace(old_str, new_str)
    
# Manual fallback with regex just in case
import re

# Match things like "관리자 ?\ufffd이지" where \ufffd is the literal unicode char
content = re.sub(r'관리자 \?\ufffd이지', '관리자 페이지', content)
content = re.sub(r'관리자 \?\ufffd속', '관리자 접속', content)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print(content[:500])
print("Fix completed round 4.")
