# -*- coding: utf-8 -*-
"""
script.js의 ADMIN_EMAILS.includes() 사용 지점을 Firestore 기반으로 전환
"""
import re

with open("script.js", "r", encoding="utf-8") as f:
    content = f.read()

original = content

# ── 교체 1: 네비바 admin 버튼 (695줄) ──────────────────────────────────────
# "if (ADMIN_EMAILS.includes(userData.email)) {"
old1 = '                if (ADMIN_EMAILS.includes(userData.email)) {'
new1 = '                if (await checkIsAdmin(userData.email)) {'
content = content.replace(old1, new1, 1)

# ── 교체 2: 로그인/소셜 연동 admin check (1267줄) ─────────────────────────
# "                                if (ADMIN_EMAILS.includes(email)) {"
old2 = '                                if (ADMIN_EMAILS.includes(email)) {'
new2 = '                                if (await checkIsAdmin(email)) {'
content = content.replace(old2, new2, 1)

# ── 교체 3: 리뷰 작성 권한 체크 (5157줄) ─────────────────────────────────
# "        if (currentUserEmail && ADMIN_EMAILS.includes(currentUserEmail)) {"
old3 = '        if (currentUserEmail && ADMIN_EMAILS.includes(currentUserEmail)) {'
new3 = '        if (currentUserEmail && await checkIsAdmin(currentUserEmail)) {'
content = content.replace(old3, new3, 1)

# ── 교체 4: 리뷰 렌더 admin check (5593줄) ────────────────────────────────
# "        const isAdmin = currentUser && currentUser.email && ADMIN_EMAILS.includes(currentUser.email);"
old4 = '        const isAdmin = currentUser && currentUser.email && ADMIN_EMAILS.includes(currentUser.email);'
new4 = '        const isAdmin = currentUser && currentUser.email && await checkIsAdmin(currentUser.email);'
content = content.replace(old4, new4, 1)

# 결과 확인
replacements = [
    (old1, new1, "Navbar admin btn"),
    (old2, new2, "Login/social admin check"),
    (old3, new3, "Review write permission"),
    (old4, new4, "Review render admin check"),
]

for old, new, label in replacements:
    if old in original and new in content:
        print(f"[OK] {label}")
    elif new in content:
        print(f"[OK - already done] {label}")
    else:
        print(f"[FAILED] {label}")
        print(f"  Old: {old[:80]}")

if content != original:
    with open("script.js", "w", encoding="utf-8") as f:
        f.write(content)
    print("\nscript.js saved!")
else:
    print("\nNo changes made!")
