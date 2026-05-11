const fs = require('fs');
let code = fs.readFileSync('admin.js', 'utf8');

// Replace the problematic strings
code = code.replace(/confirm\(['"][^'"]*삭제확인청[^'"]*['"]\)/g, 'confirm("정말 신청 내역을 삭제하시겠습니까? (삭제된 정보는 되돌릴 수 없습니다)")');
code = code.replace(/가확인된 확인원삭제확인습확인다\./g, '가입된 회원이 없습니다.');
code = code.replace(/삭제 확인패/g, '삭제 실패');
code = code.replace(/확인원 목록 로딩 확인패/g, '회원 목록 로딩 실패');
code = code.replace(/메시지확인송 확인패/g, '메시지 전송 실패');

fs.writeFileSync('admin.js', code, 'utf8');
console.log('Fixed admin.js strings');
