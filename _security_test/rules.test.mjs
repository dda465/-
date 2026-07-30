// 쉐라폰 보안 규칙(1단계 v2) 자동 검증
// 바로 위 폴더의 실제 firestore.rules 를 그대로 테스트합니다.
// 실행: npm install  →  npm test
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc, updateDoc, addDoc, collection } from 'firebase/firestore';

let pass = 0, fail = 0;
async function ok(name, p){ try{ await p; console.log('  ✅', name); pass++; }catch(e){ console.log('  ❌ 실패:', name); fail++; } }

const testEnv = await initializeTestEnvironment({
  projectId: 'demo-sharaphone',
  firestore: { rules: readFileSync('../firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
});

await testEnv.withSecurityRulesDisabled(async (ctx) => {
  const d = ctx.firestore();
  await setDoc(doc(d, 'products', 'p1'), { model: '아이폰 15', basePrice: 700000 });
  await setDoc(doc(d, 'quotes', 'q1'), { userId: 'u1', customerName: '홍길동', customerPhone: '010', status: '신청접수' });
  await setDoc(doc(d, 'blacklist', 'b1'), { phone: '010', reason: '위약금' });
  await setDoc(doc(d, 'admins', 'a1'), { email: 'dda465@hanmail.net', isAdmin: true });
});

const guest = testEnv.unauthenticatedContext().firestore();           // 외부인/비회원
const member = testEnv.authenticatedContext('u1').firestore();        // 로그인 사용자
const admin = testEnv.authenticatedContext('adm', { email: 'dda465@hanmail.net' }).firestore();

console.log('\n[1] 외부인(비로그인) — 위험행위는 막혀야 정상');
await ok('시세 읽기 허용(공개)',        assertSucceeds(getDoc(doc(guest, 'products', 'p1'))));
await ok('신청 읽기 허용(조회기능 유지)', assertSucceeds(getDoc(doc(guest, 'quotes', 'q1'))));
await ok('★ 신청 삭제 차단',           assertFails(deleteDoc(doc(guest, 'quotes', 'q1'))));
await ok('★ 시세 변조 차단',           assertFails(setDoc(doc(guest, 'products', 'p1'), { basePrice: 1 })));
await ok('★ 블랙리스트 열람 차단',      assertFails(getDoc(doc(guest, 'blacklist', 'b1'))));
await ok('★ 관리자명단 열람 차단',      assertFails(getDoc(doc(guest, 'admins', 'a1'))));
await ok('★ 블랙리스트 등록 차단',      assertFails(setDoc(doc(guest, 'blacklist', 'bx'), { x: 1 })));

console.log('\n[2] 고객 — 신청 작성·저장은 되고, 삭제는 막혀야 정상');
await ok('신청 작성 허용',             assertSucceeds(addDoc(collection(member, 'quotes'), { customerName: '김' })));
await ok('★ 신청 2차 저장(배송·계좌) 허용', assertSucceeds(updateDoc(doc(member, 'quotes', 'q1'), { deliveryMethod: '택배', account: '하나' })));
await ok('비회원도 신청 2차 저장 허용',  assertSucceeds(updateDoc(doc(guest, 'quotes', 'q1'), { deliveryMethod: 'cvs' })));
await ok('신청 삭제 차단(관리자만)',     assertFails(deleteDoc(doc(member, 'quotes', 'q1'))));
await ok('후기 작성 허용',             assertSucceeds(addDoc(collection(member, 'reviews'), { text: '좋아요' })));
await ok('회원 탈퇴(본인문서 삭제) 허용', assertSucceeds(deleteDoc(doc(member, 'users', 'u1'))));

console.log('\n[3] 관리자(이메일) — 전체 가능해야 정상');
await ok('신청 삭제 허용',             assertSucceeds(deleteDoc(doc(admin, 'quotes', 'q1'))));
await ok('시세 수정 허용',             assertSucceeds(setDoc(doc(admin, 'products', 'p1'), { basePrice: 690000 })));
await ok('블랙리스트 등록 허용',        assertSucceeds(setDoc(doc(admin, 'blacklist', 'b2'), { phone: '010' })));
await ok('블랙리스트 열람 허용',        assertSucceeds(getDoc(doc(admin, 'blacklist', 'b1'))));

await testEnv.cleanup();
console.log(`\n==== 결과: ${pass} 통과 / ${fail} 실패 ====`);
process.exit(fail ? 1 : 0);
