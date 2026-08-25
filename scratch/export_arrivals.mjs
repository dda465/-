// 금일 택배도착 건 추출 — arrivedAt 기준 (admin.js 1131줄과 같은 기준)
// 실행: cd C:\Users\PC\OneDrive\Desktop\used-phone-market  →  node scratch/export_arrivals.mjs
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

// KST 기준 오늘 00:00 ~ 내일 00:00
const now = new Date();
const kst = new Date(now.getTime() + 9 * 3600 * 1000);
const y = kst.getUTCFullYear(), m = kst.getUTCMonth(), d = kst.getUTCDate();
const start = new Date(Date.UTC(y, m, d) - 9 * 3600 * 1000);
const end = new Date(start.getTime() + 24 * 3600 * 1000);
console.log(`조회 범위(KST): ${new Date(start.getTime()+9*3600*1000).toISOString().slice(0,16)} ~ ${new Date(end.getTime()+9*3600*1000).toISOString().slice(0,16)}`);

const snap = await getDocs(query(
  collection(db, 'quotes'),
  where('arrivedAt', '>=', Timestamp.fromDate(start)),
  where('arrivedAt', '<', Timestamp.fromDate(end)),
));

const toIso = (v) => {
  if (!v) return null;
  if (typeof v.toDate === 'function') return v.toDate().toISOString();
  const dt = new Date(v);
  return isNaN(dt) ? String(v) : dt.toISOString();
};

const rows = snap.docs.map((doc) => {
  const q = doc.data();
  return {
    id: doc.id,
    arrivedAt: toIso(q.arrivedAt),
    status: q.status ?? '',
    customerName: q.customerName ?? '',
    customerPhone: q.customerPhone ?? '',
    brand: q.brand ?? '',
    model: q.model ?? '',
    storage: q.storage ?? '',
    color: q.color ?? '',
    grade: q.grade ?? '',
    method: q.method ?? '',
    deliveryMethod: q.deliveryMethod ?? '',
    price: q.price ?? null,
    finalPrice: q.inspectionData?.finalPrice ?? null,
    trackingNumber: q.trackingNumber ?? '',
    relayInvoice: q.goodsflowRelayInvoiceNo ?? '',
    isDeleted: q.isDeleted === true,
  };
});

fs.writeFileSync('scratch/arrivals_today.json', JSON.stringify(rows, null, 2), 'utf8');
console.log(`총 ${rows.length}건 → scratch/arrivals_today.json 저장 완료`);
process.exit(0);
