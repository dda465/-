// ① 굿스플로 COMPLETED 인데 택배도착으로 안 넘어간 건
// ② 폴러 사각지대(예약 7일 초과 → skipOld) 로 상태를 모르는 건
// ③ 같은 고객이 여러 건 신청했는데 일부만 굿스플로 예약이 들어간 건
// 실행: cd C:\Users\PC\OneDrive\Desktop\used-phone-market → node scratch/audit_stuck_and_dupes.mjs
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import fs from 'fs';

const app = initializeApp({
  apiKey: "AIzaSyCMYsqtZzHnXjMGvdum4l3SVn_MG78m0Nc",
  authDomain: "rejeuphone.firebaseapp.com", projectId: "rejeuphone",
  storageBucket: "rejeuphone.firebasestorage.app",
  messagingSenderId: "1401756577", appId: "1:1401756577:web:d07a5f0e304ab048e749e0",
});
const db = getFirestore(app);

const D = (v) => { if (!v) return null; if (typeof v.toDate === 'function') return v.toDate(); const t = new Date(v); return isNaN(t) ? null : t; };
const K = (v) => { const t = D(v); return t ? new Date(t.getTime() + 9 * 3600000).toISOString().slice(0, 16).replace('T', ' ') : ''; };
const P = (p) => String(p || '').replace(/\D/g, '');

const since = new Date(Date.now() - 60 * 24 * 3600000);
const snap = await getDocs(query(collection(db, 'quotes'), where('firebaseTimestamp', '>=', Timestamp.fromDate(since))));

const TERMINAL = ['입금완료', '취소', '반송접수'];
const rows = [];
snap.forEach((doc) => {
  const q = doc.data();
  if (q.isDeleted) return;
  rows.push({
    id: doc.id, name: q.customerName ?? '', phone: P(q.customerPhone),
    model: `${q.brand ?? ''} ${q.model ?? ''}`.trim(),
    status: q.status ?? '', gfStatus: q.goodsflowStatus ?? '',
    order: q.goodsflowOrderNo ?? '', alert: q.goodsflowAlert ?? '',
    booked: D(q.goodsflowBookedAt), bookedS: K(q.goodsflowBookedAt),
    arrived: K(q.arrivedAt), checked: K(q.goodsflowStatusCheckedAt),
    submitted: K(q.submittedAt || q.firebaseTimestamp),
    deliveryMethod: q.deliveryMethod ?? '', pickupDate: q.pickupDate ?? '',
  });
});
console.log(`최근 60일 신청건(삭제 제외): ${rows.length}건\n`);

// ── ① COMPLETED 인데 도착 처리 안 된 건 ──
const stuck = rows.filter(r => r.gfStatus === 'COMPLETED' && !r.arrived);
console.log(`① 굿스플로 COMPLETED 인데 arrivedAt 없음 : ${stuck.length}건`);
stuck.forEach(r => console.log(`   ${r.submitted} ${r.name} ${r.phone} ${r.model} [${r.status}] 폴링:${r.checked || '없음'}`));

// ── ② 폴러 사각지대: 진행중 + 예약있음 + 예약 7일 초과 ──
const AGE = 7 * 24 * 3600000;
const blind = rows.filter(r => ['신청접수', '수거중'].includes(r.status) && r.order
  && r.booked && (Date.now() - r.booked.getTime()) > AGE);
console.log(`\n② 폴러가 손 뗀 건 (예약 7일 초과, 실제 상태 모름) : ${blind.length}건`);
blind.forEach(r => console.log(`   예약 ${r.bookedS} ${r.name} ${r.phone} ${r.model} [${r.status}] gf:${r.gfStatus || '-'} ${r.alert ? '⚠' + r.alert : ''}`));

// ── ③ 같은 고객 여러 건 중 일부만 예약됨 ──
const byPhone = new Map();
rows.filter(r => !TERMINAL.includes(r.status) && r.deliveryMethod === 'courier')
    .forEach(r => { if (!r.phone) return; (byPhone.get(r.phone) || byPhone.set(r.phone, []).get(r.phone)).push(r); });
const partial = [];
for (const [ph, list] of byPhone) {
  if (list.length < 2) continue;
  const withO = list.filter(x => x.order), without = list.filter(x => !x.order);
  if (withO.length && without.length) partial.push({ ph, list });
}
console.log(`\n③ 같은 연락처로 여러 건인데 일부만 굿스플로 예약됨 : ${partial.length}명`);
partial.forEach(g => {
  console.log(`   ── ${g.list[0].name} ${g.ph}`);
  g.list.forEach(r => console.log(`      ${r.submitted} ${r.model} [${r.status}] 예약:${r.order ? 'O ' + r.order : '❌ 없음'} 수거일:${r.pickupDate}`));
});

fs.writeFileSync('scratch/audit_result.json', JSON.stringify({ stuck, blind, partial }, null, 2), 'utf8');
console.log('\n→ scratch/audit_result.json 저장');
process.exit(0);
