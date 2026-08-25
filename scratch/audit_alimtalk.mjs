// 도착했는데 알림톡이 안 나간 건 / 발송 실패한 건 찾기
// 실행: cd C:\Users\PC\OneDrive\Desktop\used-phone-market → node scratch/audit_alimtalk.mjs
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

const since = new Date(Date.now() - 60*24*3600000);
const snap = await getDocs(query(collection(db,'quotes'), where('firebaseTimestamp','>=',Timestamp.fromDate(since))));

const arrived=[], noNotify=[], failNotify=[], pickFail=[];
snap.forEach((doc)=>{
  const q=doc.data(); if(q.isDeleted) return;
  const base={id:doc.id,name:q.customerName??'',phone:q.customerPhone??'',
    model:`${q.brand??''} ${q.model??''}`.trim(),status:q.status??'',
    arrivedAt:K(q.arrivedAt), notified:K(q.arrivedNotifiedAt),
    tries:q.arrivedNotifyTries??0, err:q.arrivedNotifyError??'',
    pTries:q.pickedUpNotifyTries??0, pErr:q.pickedUpNotifyError??'',
    pickedUp:K(q.pickedUpNotifiedAt), gf:q.goodsflowStatus??''};
  if(!q.arrivedAt) { if(q.pickedUpNotifyError) pickFail.push(base); return; }
  arrived.push(base);
  if(!q.arrivedNotifiedAt) noNotify.push(base);
  else if(q.arrivedNotifyError) failNotify.push(base);
  if(q.pickedUpNotifyError) pickFail.push(base);
});

console.log(`최근 60일 · 도착(arrivedAt 있음) 건: ${arrived.length}\n`);
console.log(`① 도착했는데 도착 알림톡 발송 표시 없음 : ${noNotify.length}건`);
noNotify.forEach(r=>console.log(`   ${r.arrivedAt} ${r.name} ${r.phone} ${r.model} [${r.status}] 시도:${r.tries} ${r.err?'오류:'+r.err.slice(0,80):''}`));
console.log(`\n② 도착 알림톡 발송됐으나 오류 기록 남음 : ${failNotify.length}건`);
failNotify.forEach(r=>console.log(`   ${r.arrivedAt} ${r.name} ${r.phone} 시도:${r.tries} ${r.err.slice(0,100)}`));
console.log(`\n③ 집하 알림톡 오류 기록 : ${pickFail.length}건`);
pickFail.slice(0,20).forEach(r=>console.log(`   ${r.name} ${r.phone} 시도:${r.pTries} ${r.pErr.slice(0,100)}`));

fs.writeFileSync('scratch/audit_alimtalk.json',JSON.stringify({noNotify,failNotify,pickFail},null,2),'utf8');
console.log('\n→ scratch/audit_alimtalk.json 저장');
process.exit(0);
