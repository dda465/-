// 굿스플로 자동 도착전환·도착알림톡 진단 (주소 변경 2026-08-18 전후 비교)
// 실행: cd C:\Users\PC\OneDrive\Desktop\used-phone-market → node scratch/diag_goodsflow.mjs
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
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

const d = (v) => { if (!v) return null; if (typeof v.toDate === 'function') return v.toDate(); const t = new Date(v); return isNaN(t) ? null : t; };
const kst = (v) => { const t = d(v); return t ? new Date(t.getTime() + 9 * 3600000).toISOString().slice(0, 16).replace('T', ' ') : null; };

// 최근 14일 접수건
const since = new Date(Date.now() - 14 * 24 * 3600000);
const snap = await getDocs(query(collection(db, 'quotes'), where('firebaseTimestamp', '>=', Timestamp.fromDate(since))));

const MOVE = new Date('2026-08-18T00:00:00+09:00');  // 주소 변경일

const rows = [];
snap.forEach((doc) => {
  const q = doc.data();
  if (q.isDeleted) return;
  if (!q.goodsflowOrderNo) return;            // 굿스플로 예약 건만
  const booked = d(q.goodsflowBookedAt);
  rows.push({
    id: doc.id,
    name: q.customerName ?? '',
    booked: kst(q.goodsflowBookedAt),
    era: booked ? (booked >= MOVE ? '신주소(남동천로128)' : '구주소(동천로116)') : '예약시각없음',
    status: q.status ?? '',
    gfStatus: q.goodsflowStatus ?? '',
    gfCheckedAt: kst(q.goodsflowStatusCheckedAt),
    gfAlert: q.goodsflowAlert ?? '',
    arrivedAt: kst(q.arrivedAt),
    arrivedNotifiedAt: kst(q.arrivedNotifiedAt),
    arrivedNotifyTries: q.arrivedNotifyTries ?? 0,
    arrivedNotifyError: q.arrivedNotifyError ?? '',
    pickedUpNotifiedAt: kst(q.pickedUpNotifiedAt),
    pickedUpNotifyError: q.pickedUpNotifyError ?? '',
  });
});

rows.sort((a, b) => String(a.booked).localeCompare(String(b.booked)));

const g = (f) => rows.reduce((m, r) => { const k = r[f] || '(없음)'; m[k] = (m[k] || 0) + 1; return m; }, {});
const by = (era) => rows.filter((r) => r.era === era);

console.log(`굿스플로 예약 건 (최근 14일): ${rows.length}건\n`);
for (const era of ['구주소(동천로116)', '신주소(남동천로128)', '예약시각없음']) {
  const list = by(era);
  if (!list.length) continue;
  const arrived = list.filter((r) => r.arrivedAt).length;
  const notified = list.filter((r) => r.arrivedNotifiedAt).length;
  const gfDone = list.filter((r) => r.gfStatus === 'COMPLETED').length;
  const stuck = list.filter((r) => r.gfStatus === 'COMPLETED' && !r.arrivedAt).length;
  console.log(`■ ${era} — ${list.length}건`);
  console.log(`   굿스플로 COMPLETED : ${gfDone}`);
  console.log(`   택배도착 전환(arrivedAt) : ${arrived}`);
  console.log(`   도착 알림톡 발송 : ${notified}`);
  console.log(`   ⚠ COMPLETED인데 전환 안 됨 : ${stuck}`);
  const st = list.reduce((m, r) => { const k = r.gfStatus || '(빈값)'; m[k] = (m[k] || 0) + 1; return m; }, {});
  console.log(`   굿스플로 상태 분포 :`, st);
  const errs = list.filter((r) => r.arrivedNotifyError || r.pickedUpNotifyError);
  if (errs.length) {
    console.log(`   ⚠ 알림톡 오류 ${errs.length}건:`);
    errs.slice(0, 5).forEach((r) => console.log(`      ${r.name} — 도착:${r.arrivedNotifyError} / 집하:${r.pickedUpNotifyError}`));
  }
  console.log();
}
console.log('신청건 상태 분포:', g('status'));
console.log('마지막 폴링 시각(최신 5):', rows.map(r => r.gfCheckedAt).filter(Boolean).sort().slice(-5));

fs.writeFileSync('scratch/diag_goodsflow.json', JSON.stringify(rows, null, 2), 'utf8');
console.log('\n→ scratch/diag_goodsflow.json 저장 완료');
process.exit(0);
