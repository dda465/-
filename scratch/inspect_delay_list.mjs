// 검수지연 안내 대상 — ⓐ 택배도착 전체  ⓑ 개인발송(cvs) 8/14 이후 신청건
// 실행: cd C:\Users\PC\OneDrive\Desktop\used-phone-market → node scratch/inspect_delay_list.mjs
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
const D=(v)=>{if(!v)return null;if(typeof v.toDate==='function')return v.toDate();const t=new Date(v);return isNaN(t)?null:t;};
const K=(v)=>{const t=D(v);return t?new Date(t.getTime()+9*3600000).toISOString().slice(0,16).replace('T',' '):'';};
const P=(p)=>String(p||'').replace(/\D/g,'');

// 검수가 이미 끝났거나 종결된 상태 — 검수지연 안내를 보내면 안 되는 건
const DONE = ['검수완료','입금대기','입금완료','취소','반송접수','반송대기'];

const since = new Date(Date.now() - 90*24*3600000);
const snap = await getDocs(query(collection(db,'quotes'), where('firebaseTimestamp','>=',Timestamp.fromDate(since))));

const CUT = new Date('2026-08-14T00:00:00+09:00');
const A=[], B=[], skipDone=[];
snap.forEach((doc)=>{
  const q=doc.data(); if(q.isDeleted) return;
  const sub = D(q.submittedAt) || D(q.firebaseTimestamp);
  const r={id:doc.id, name:q.customerName??'', phone:P(q.customerPhone),
    model:`${q.brand??''} ${q.model??''}`.trim(), status:q.status??'',
    method:q.deliveryMethod??'', submitted:K(q.submittedAt||q.firebaseTimestamp),
    arrivedAt:K(q.arrivedAt), gf:q.goodsflowStatus??''};

  const isArrived = r.status === '택배도착';
  const isCvsRecent = r.method === 'cvs' && sub && sub >= CUT;
  if (!isArrived && !isCvsRecent) return;
  if (DONE.includes(r.status)) { skipDone.push(r); return; }
  r.group = isArrived ? (isCvsRecent ? 'ⓐ+ⓑ' : 'ⓐ 택배도착') : 'ⓑ 개인발송';
  (isArrived ? A : B).push(r);
});

const all=[...A,...B];
all.sort((a,b)=>a.submitted.localeCompare(b.submitted));
const seen=new Set(), uniq=[];
for(const r of all){ if(r.phone.length===11 && !seen.has(r.phone)){seen.add(r.phone); uniq.push(r.phone);} }

console.log(`ⓐ 택배도착 전체        : ${A.length}건`);
console.log(`ⓑ 개인발송 8/14 이후    : ${B.length}건`);
console.log(`합계                   : ${all.length}건`);
console.log(`문자 대상 고유 연락처    : ${uniq.length}명  ← 중복 ${all.length-uniq.length}건 제거`);
console.log(`제외(검수완료·종결)      : ${skipDone.length}건\n`);
console.log('=== ⓑ 개인발송 상태별 ===');
const c={}; B.forEach(r=>c[r.status]=(c[r.status]||0)+1); console.log(c);
console.log('\n=== 전체 목록 ===');
all.forEach((r,i)=>console.log(`${String(i+1).padStart(3)}. ${r.submitted} ${r.name} ${r.phone} ${r.model} [${r.status}] ${r.group}`));

fs.writeFileSync('scratch/inspect_delay.json', JSON.stringify({A,B,uniq,skipDone},null,2),'utf8');
fs.writeFileSync('scratch/inspect_delay_연락처.csv', '\uFEFF연락처\n'+uniq.join('\n')+'\n','utf8');
console.log('\n→ scratch/inspect_delay.json · inspect_delay_연락처.csv 저장');
process.exit(0);
