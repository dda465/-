// 8/22 방문수거 예정인데 굿스플로 접수가 안 된 건 찾기
// 실행: cd C:\Users\PC\OneDrive\Desktop\used-phone-market → node scratch/find_0822_unbooked.mjs
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import fs from 'fs';

const app = initializeApp({
  apiKey: "AIzaSyCMYsqtZzHnXjMGvdum4l3SVn_MG78m0Nc",
  authDomain: "rejeuphone.firebaseapp.com",
  projectId: "rejeuphone",
  storageBucket: "rejeuphone.firebasestorage.app",
  messagingSenderId: "1401756577",
  appId: "1:1401756577:web:d07a5f0e304ab048e749e0",
});
const db = getFirestore(app);

// ⚠️ pickupDate 는 'MM/DD' 문자열이다 (연도 없음). 문자열 그대로 비교한다.
const TARGET = '08/22';
const snap = await getDocs(query(collection(db, 'quotes'), where('pickupDate', '==', TARGET)));

const d = (v) => { if (!v) return null; if (typeof v.toDate === 'function') return v.toDate(); const t = new Date(v); return isNaN(t) ? null : t; };
const kst = (v) => { const t = d(v); return t ? new Date(t.getTime() + 9 * 3600000).toISOString().slice(0, 16).replace('T', ' ') : ''; };

const all = [], booked = [], unbooked = [], excluded = [];
snap.forEach((doc) => {
  const q = doc.data();
  const row = {
    id: doc.id,
    name: q.customerName ?? '',
    phone: q.customerPhone ?? '',
    model: `${q.brand ?? ''} ${q.model ?? ''}`.trim(),
    status: q.status ?? '',
    deliveryMethod: q.deliveryMethod ?? '',
    pickupDate: q.pickupDate ?? '',
    gfOrder: q.goodsflowOrderNo ?? '',
    gfStatus: q.goodsflowStatus ?? '',
    submitted: kst(q.submittedAt || q.firebaseTimestamp),
    address: q.address ?? '',
    isDeleted: q.isDeleted === true,
  };
  all.push(row);
  if (row.isDeleted || row.status === '취소') { excluded.push(row); return; }
  if (row.deliveryMethod !== 'courier') { excluded.push(row); return; }
  if (row.gfOrder) booked.push(row); else unbooked.push(row);
});

unbooked.sort((a, b) => a.submitted.localeCompare(b.submitted));

console.log(`pickupDate='${TARGET}' 전체: ${all.length}건`);
console.log(`  굿스플로 접수됨   : ${booked.length}`);
console.log(`  ⚠ 접수 안 됨      : ${unbooked.length}   ← 안내 대상`);
console.log(`  제외(취소·삭제·방문수거아님): ${excluded.length}\n`);
console.log('── 접수 안 된 건 ──');
unbooked.forEach((r, i) => console.log(`${String(i + 1).padStart(2)}. ${r.submitted}  ${r.name}  ${r.phone}  ${r.model}  [${r.status}]`));

fs.writeFileSync('scratch/unbooked_0822.json', JSON.stringify({ unbooked, booked, excluded }, null, 2), 'utf8');
console.log(`\n→ scratch/unbooked_0822.json 저장 완료`);
process.exit(0);
