# -*- coding: utf-8 -*-
"""
script.js에 남아 있는 미사용 ADMIN_EMAILS 배열 선언 제거
(이미 checkIsAdmin()으로 교체됐지만 배열 선언이 orphan으로 남아있는 경우)
"""
import re

with open("script.js", "r", encoding="utf-8") as f:
    content = f.read()

original = content

# 사용되지 않는 ADMIN_EMAILS 배열 선언 패턴 제거
# 패턴: (whitespace) const ADMIN_EMAILS = [ ... ];  (바로 다음에 이미 checkIsAdmin을 씀)
pattern = r'\s*const ADMIN_EMAILS = \[\s*["\s\w@.,\n\r]+\];\s*\n'

matches = re.findall(pattern, content)
print(f"발견된 패턴 수: {len(matches)}")
for m in matches:
    print(f"  => {m[:80].strip()}")

content = re.sub(pattern, '\n', content)

if content != original:
    with open("script.js", "w", encoding="utf-8") as f:
        f.write(content)
    print("\nscript.js 저장 완료! 미사용 ADMIN_EMAILS 배열 제거됨.")
else:
    print("\n변경 없음.")
