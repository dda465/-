import { db } from './firebase-config.js';
import { collection, query, where, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('guest-search-form');
    
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const nameInput = document.getElementById('g-name').value.trim();
            const phoneInput = document.getElementById('g-phone').value.trim();
            
            if (!nameInput || !phoneInput) {
                alert('이름과 연락처를 정확히 입력해 주세요.');
                return;
            }
            
            const btn = document.getElementById('search-btn');
            btn.disabled = true;
            btn.innerText = '조회 중...';
            
            try {
                // 연락처로 먼저 1차 필터링
                const q = query(
                    collection(db, "quotes"),
                    where("customerPhone", "==", phoneInput)
                );
                
                const querySnapshot = await getDocs(q);
                
                // 이름으로 2차 필터링 (클라이언트 단 필터링 - 복합 인덱스 오류 방지)
                const results = [];
                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    if (data.customerName === nameInput) {
                        results.push({ id: doc.id, ...data });
                    }
                });
                
                // 시간 역순 정렬 (최신순)
                results.sort((a, b) => {
                    const timeA = a.timestamp || a.firebaseTimestamp?.toMillis() || 0;
                    const timeB = b.timestamp || b.firebaseTimestamp?.toMillis() || 0;
                    return timeB - timeA;
                });
                
                renderResults(results);
                
            } catch (error) {
                console.error("조회 오류:", error);
                alert("조회 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
            } finally {
                btn.disabled = false;
                btn.innerText = '내역 조회하기';
            }
        });
    }
});

window.resetSearch = function() {
    document.getElementById('result-area').style.display = 'none';
    document.getElementById('cards-container').innerHTML = '';
    document.getElementById('g-name').value = '';
    document.getElementById('g-phone').value = '';
}

function renderResults(quotes) {
    const resultArea = document.getElementById('result-area');
    const container = document.getElementById('cards-container');
    const countHeader = document.getElementById('result-count');
    
    container.innerHTML = '';
    resultArea.style.display = 'block';
    
    if (quotes.length === 0) {
        countHeader.innerText = "조회 결과 (0건)";
        container.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; background: #fff; border-radius: 16px; border: 1px solid #eee;">
                <p style="color: #666; margin: 0; font-size: 1rem;">일치하는 신청 내역이 없습니다.<br>이름과 연락처가 정확한지 확인해 주세요.</p>
            </div>
        `;
        return;
    }
    
    countHeader.innerText = `조회 결과 (${quotes.length}건)`;
    
    quotes.forEach(data => {
        let statusBadgeClass = '';
        let statusText = '';
        const currentStatus = data.status || 'receipt';
        
        switch (currentStatus) {
            case 'receipt': statusBadgeClass = 'receipt'; statusText = '접수 완료'; break;
            case 'pickup': statusBadgeClass = 'pickup'; statusText = '기기 수거중'; break;
            case 'assessing': statusBadgeClass = 'assessing'; statusText = '검수 진행중'; break;
            case 'complete': statusBadgeClass = 'complete'; statusText = '입금 완료'; break;
            case 'cancel': statusBadgeClass = 'cancel'; statusText = '취소됨'; break;
            default: statusBadgeClass = 'receipt'; statusText = '접수 완료';
        }
        
        // Setup stepper
        const steps = [
            { id: 'receipt', label: '접수완료', idx: 1 },
            { id: 'pickup', label: '수거중', idx: 2 },
            { id: 'assessing', label: '검수중', idx: 3 },
            { id: 'complete', label: '입금완료', idx: 4 }
        ];

        let currentIdx = 1;
        if (currentStatus === 'pickup') currentIdx = 2;
        if (currentStatus === 'assessing') currentIdx = 3;
        if (currentStatus === 'complete') currentIdx = 4;
        
        let stepperHtml = '';
        if (currentStatus !== 'cancel') {
            stepperHtml = '<div class="stepper-container"><div class="stepper">';
            steps.forEach(step => {
                let stepClass = 'step';
                let iconContent = step.idx;
                
                if (step.idx < currentIdx) {
                    stepClass += ' completed';
                    iconContent = '✓';
                } else if (step.idx === currentIdx) {
                    stepClass += ' active';
                    iconContent = '✓';
                }
                
                stepperHtml += `
                    <div class="${stepClass}">
                        <div class="step-icon">${iconContent}</div>
                        <div class="step-text">${step.label}</div>
                    </div>
                `;
            });
            stepperHtml += '</div></div>';
        } else {
            stepperHtml = '<div class="stepper-container" style="text-align:center; color:#C62828; font-weight:bold; padding:10px;">🚫 취소된 신청입니다.</div>';
        }
        
        // Format Date
        let dateStr = '알 수 없음';
        if (data.firebaseTimestamp) {
            try {
                dateStr = new Date(data.firebaseTimestamp.toMillis()).toLocaleDateString();
            } catch(e) {}
        } else if (data.timestamp) {
            const d = new Date(data.timestamp);
            if (!isNaN(d.getTime())) {
                dateStr = d.toLocaleDateString();
            } else if (typeof data.timestamp === 'string') {
                dateStr = data.timestamp.split('오')[0].trim(); // "2026. 5. 13."
            }
        }
        
        // Format Price
        const price = data.expectedPrice || data.price || 0;
        const priceStr = new Intl.NumberFormat('ko-KR').format(price) + '원';
        
        const card = document.createElement('div');
        card.className = 'quote-card';
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <div class="qc-info">
                    <h3>${data.brand || ''} ${data.model || ''} <span style="font-size:0.8rem; color:#888;">${data.storage || ''}</span></h3>
                    <p>예상 매입가: <strong style="color: #2563EB;">${priceStr}</strong></p>
                    <p style="font-size: 0.8rem; margin-top: 4px;">신청일: ${dateStr}</p>
                </div>
                <div class="status-badge ${statusBadgeClass}">${statusText}</div>
            </div>
            ${stepperHtml}
        `;
        
        container.appendChild(card);
    });
}
