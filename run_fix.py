import re

with open("c:/Users/PC/Desktop/used-phone-market/admin.js", "r", encoding="utf-8") as f:
    text = f.read()

# Replace corrupted phrases
replacements = {
    # Quotes tab
    r"원\)이삭제로딩 원\)패": "데이터 로딩 실패",
    r"원\)청원\)접수": "신청접수",
    r"원\)접수삭제원\)청삭제원\)습원\)다": "접수된 신청이 없습니다",
    r"원\)금원\)원\)": "입금대기",
    r"원\)금원\)료": "입금완료",
    r"원\)거원\)": "수거중",
    r"검원\)중": "검수중",
    r"원\)태변원\)": "상태변경",
    r"원\)세보기": "상세보기",
    r"원\)말 삭제원\)청원\)역삭제삭제원\)시겠습원\)까원\) \(삭제원\)업원\) 원\)돌삭제삭제습원\)다\)": "정말 신청내역을 삭제하시겠습니까? (삭제 작업은 되돌릴 수 없습니다)",
    r"원\)청원\)역삭제삭제원\)었원\)니삭제": "신청내역이 삭제되었습니다",
    # Users tab
    r"가원\)된 원\)원삭제원\)습원\)다": "가입된 회원이 없습니다",
    r"원\)원 목록 로딩 원\)패": "회원 목록 로딩 실패",
    r"원\)말 삭제원\)원삭제삭제원\)시겠습원\)까원\) \(DB급서삭제원\)원\)니삭제\)": "정말 이 회원을 삭제하시겠습니까? (DB에서 삭제됩니다)",
    r"삭제원\)었원\)니삭제": "삭제되었습니다",
    # Delete failure
    r"삭제 원\)패": "삭제 실패",
    # Prices sync
    r"구원\) 원\)트삭제원\)삭제삭제이원\)원\) 가원\)원\) 원\)데원\)트 원\)시겠습원\)까원\)\\n삭제원\)업원\) 원\)간삭제조금 걸릴 삭제원\)으원\) 원\)료 삭제원\)세가 변경됩원\)다\.": "구글 시트에서 데이터를 가져와 시세를 업데이트 하시겠습니까?\\n동기화 작업은 시간이 조금 걸릴 수 있으며 완료 시 시세가 변경됩니다.",
    r"구원\) 원\)트원\)서 원\)이원\)원\) 불러원\) 원\)데원\)트 중입원\)다\.\.\. 원\)시원\)기다원\)주원\)요\.": "구글 시트에서 데이터를 불러와 업데이트 중입니다... 잠시만 기다려주세요.",
    r"구원\) 원\)트 원\)근삭제원\)패원\)습원\)다\. \(공유 원\)태 원\)인 원\)요\)": "구글 시트 접근에 실패했습니다. (공유 상태 확인 필요)",
    r"원\)이삭제원\)싱 원\)류": "데이터 파싱 오류",
    r"기존 원\)이원\)원\) 삭제원\)는 삭제류가 발생원\)습원\)다\.": "기존 데이터를 삭제하는 중 오류가 발생했습니다.",
    r"원\)기삭제원\)료!\\n원\)": "동기화 완료!\\n총",
    r"개의 모델 원\)보가 원\)트원\)서 원\)공원\)으삭제데원\)트원\)었원\)니삭제": "개의 모델 정보가 시트에서 성공적으로 업데이트 되었습니다.",
    r"원\)기삭제삭제류가 발생원\)습원\)다\.\\n": "동기화 중 오류가 발생했습니다.\\n",
    # Prices tab
    r"원\)록삭제원\)세 원\)이원\)원\) 원\)습원\)다\. 마이그레원\)션삭제진행원\)주원\)요\.": "등록된 시세 데이터가 없습니다. 마이그레이션을 진행해주세요.",
    r"원\)세 로딩 원\)패": "시세 로딩 실패",
    # Model Modal
    r"원\)정": "수정",
    r"모델 원\)정": "모델 수정",
    r"원\)규 모델 추원\)": "신규 모델 추가",
    r"원\)량 원\)션 JSON 원\)식삭제원\)바르원\) 원\)습원\)다\.": "용량 옵션 JSON 형식이 올바르지 않습니다.",
    r"모든 원\)접수 삭제삭제원\)력원\)주원\)요\.": "모든 필수 항목을 입력해주세요.",
    r"원\)원\)되원\)습원\)다\.": "저장되었습니다.",
    r"원\)삭제원\)패": "저장 실패",
    r"원\)말 삭제모델삭제삭제원\)시겠습원\)까원\)": "정말 이 모델을 삭제하시겠습니까?",
    # Quotes detail format
    r"원\)의삭제원\)배 \(착불\)": "편의점 택배 (착불)",
    r"방문 원\)거 \(원\)배\)": "방문 수거 (택배)",
    r"원\)음": "없음",
    r"미개원\)\(원\)상삭제": "미개봉(새상품)",
    r"원\)이원\)항 원\)음 \(미개삭제상삭제": "특이사항 없음 (미개봉 새상품)",
    r"S원\)\(원\)용삭제음\)": "S급(사용감 없음)",
    r"원\)이원\)항 원\)음 \(S원\)": "특이사항 없음 (S급)",
    r"원\)면 기스/원\)상": "화면 기스/손상",
    r"원\)원\) 찍힘/기스": "테두리 찍힘/기스",
    r"기능 원\)상": "기능 이상",
    r"삭제원\)거삭제존재원\)원\) 원\)는 원\)청원\)니삭제": "삭제되거나 존재하지 않는 신청입니다",
    r"원\)세 원\)보원\)불러원\)는 삭제류가 발생원\)습원\)다\.": "상세 정보를 불러오는 중 오류가 발생했습니다.",
    # Memo
    r"메모가 원\)원\)되원\)습원\)다\.": "메모가 저장되었습니다.",
    r"메모 원\)삭제원\)패": "메모 저장 실패",
    # Status
    r"원\)당 원\)접수건의 원\)태원\)": "해당 접수건의 상태를 ",
    r"\(삭제원\)변경하원\)겠원\)니원\)": "(으)로 변경하시겠습니까?",
    r"원\)태가 변경되원\)습원\)다\.": "상태가 변경되었습니다.",
    r"원\)태 변삭제패": "상태 변경 실패",
    # Chat Tab
    r"채팅 원\)역삭제원\)습원\)다\.": "채팅 내역이 없습니다.",
    r"비회삭제": "비회원",
    r"원\)로삭제원\)삭제": "새로운 메시지",
    r"원\)과삭제원\)삭제": "님과의 대화",
    r"메시지가 원\)습원\)다\.": "메시지가 없습니다.",
    r"원\)": "확인",
    # Units
    r"건": "건",
    r"삭제;": "원';",
    r"원\)'": "원'",
    # Template literals
    r"원\) (\w+\.timestamp.*?)": r"? \1",
    r"원\) new Date": r"? new Date",
    r"\(data\.timestamp 원\)": r"(data.timestamp ?",
    r"\${status === '(.*?)' 원\) 'selected' : ''\}": r"${status === '\1' ? 'selected' : ''}",
}

for k, v in replacements.items():
    text = re.sub(k, v, text)

# Fix ternary specifically
text = text.replace("?'selected' : ''}", "? 'selected' : ''}")

# Fix status conditions manually
text = text.replace("if (status === '수거중') statusClass = 'status - pickup';", "if (status === '수거중') statusClass = 'status-pickup';")
text = text.replace("if (status === '입금대기') statusClass = 'status - pickup';", "if (status === '입금대기') statusClass = 'status-pickup';")
text = text.replace("const date = (data.timestamp && typeof data.timestamp.toDate === 'function')\n                ? data.timestamp.toDate()\n                : (data.timestamp ? new Date(data.timestamp) : new Date());", "const date = (data.timestamp && typeof data.timestamp.toDate === 'function') ? data.timestamp.toDate() : (data.timestamp ? new Date(data.timestamp) : new Date());")

# Final literal replace for remaining `원)` as `?` in code
text = text.replace("data.storageOptions 원)", "data.storageOptions ?")
text = text.replace("s.priceAdjustment > 0 원)", "s.priceAdjustment > 0 ?")
text = text.replace("data.createdAt 원)", "data.createdAt ?")
text = text.replace("chat.lastUpdated.toDate 원)", "chat.lastUpdated.toDate ?")
text = text.replace("data.timestamp.toDate 원)", "data.timestamp.toDate ?")
text = text.replace("data.deliveryMethod === 'visit') 원)", "data.deliveryMethod === 'visit') ?")

with open("c:/Users/PC/Desktop/used-phone-market/admin.js", "w", encoding="utf-8") as f:
    f.write(text)
