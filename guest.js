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
                    const getMs = (item) => {
                        if (item.firebaseTimestamp && typeof item.firebaseTimestamp.toMillis === 'function') {
                            return item.firebaseTimestamp.toMillis();
                        }
                        if (item.timestamp) {
                            const parsed = new Date(item.timestamp).getTime();
                            if (!isNaN(parsed)) return parsed;
                        }
                        return 0;
                    };
                    return getMs(b) - getMs(a);
                });
                
                renderResults(results);
                
            } catch (error) {
                console.error("조회 오류:", error);
                alert("조회 중 오류가 발생했습니다.\n" + error.name + ": " + error.message);
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
        
        // Handle both English (old) and Korean (new) statuses
        if (currentStatus === 'receipt' || currentStatus === '신청접수') { statusBadgeClass = 'receipt'; statusText = '접수 완료'; }
        else if (currentStatus === 'pickup' || currentStatus === '수거중') { statusBadgeClass = 'pickup'; statusText = '기기 수거중'; }
        else if (currentStatus === '택배도착') { statusBadgeClass = 'arrived'; statusText = '기기 도착 완료'; }
        else if (currentStatus === 'assessing' || currentStatus === '검수중' || currentStatus === '검수완료') { statusBadgeClass = 'assessing'; statusText = '검수 진행중'; }
        else if (currentStatus === 'complete' || currentStatus === '입금완료') { statusBadgeClass = 'complete'; statusText = '입금 완료'; }
        else if (currentStatus === '입금대기') { statusBadgeClass = 'complete'; statusText = '입금 대기 (송금예정)'; }
        else if (currentStatus === 'cancel' || currentStatus === '취소') { statusBadgeClass = 'cancel'; statusText = '취소됨'; }
        else { statusBadgeClass = 'receipt'; statusText = '접수 완료'; }
        
        // Setup stepper
        const steps = [
            { id: 'receipt', label: '접수', idx: 1 },
            { id: 'pickup', label: '발송', idx: 2 },
            { id: 'arrived', label: '도착', idx: 3 },
            { id: 'assessing', label: '검수', idx: 4 },
            { id: 'complete', label: '입금', idx: 5 }
        ];

        let currentIdx = 1;
        if (statusBadgeClass === 'pickup') currentIdx = 2;
        if (statusBadgeClass === 'arrived') currentIdx = 3;
        if (statusBadgeClass === 'assessing') currentIdx = 4;
        if (statusBadgeClass === 'complete') currentIdx = 5;
        
        let stepperHtml = '';
        if (statusBadgeClass !== 'cancel') {
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
                // 모바일 한 줄에 들어가도록 압축: 2026-07-20 16:58 (초 제외)
                const _d = new Date(data.firebaseTimestamp.toMillis());
                const _p2 = (n) => String(n).padStart(2, '0');
                dateStr = `${_d.getFullYear()}-${_p2(_d.getMonth() + 1)}-${_p2(_d.getDate())} ${_p2(_d.getHours())}:${_p2(_d.getMinutes())}`;
            } catch(e) {}
        } else if (data.timestamp) {
            dateStr = data.timestamp;
        }
        
        // Format Price
        const price = data.expectedPrice || data.price || 0;
        const priceStr = new Intl.NumberFormat('ko-KR').format(price) + '원';
        
        let deliveryInfo = '';
        if (data.deliveryMethod === 'cvs') {
            deliveryInfo = '<br><span style="font-size: 0.8rem; color: #ff9800; margin-top: 4px; display: inline-block;">[직접발송]</span>';
            if (data.shippingFeePaid) {
                deliveryInfo += `<br><span style="font-size: 0.8rem; color: #2E7D32; font-weight: 600; margin-top: 4px; display: inline-block;">✅ 배송비 입금 완료</span>`;
            }
        } else if (data.deliveryMethod === 'courier') {
            deliveryInfo = `<br><span style="font-size: 0.8rem; color: #4CAF50; margin-top: 4px; display: inline-block;">[방문수거] (희망일: ${data.pickupDate || '미정'})</span>`;
        } else if (data.deliveryMethod === 'pending') {
            deliveryInfo = `<br><span style="font-size: 0.85rem; color: #e11d48; font-weight: 700; margin-top: 4px; display: inline-block;">[배송 방법 미입력]</span>`;
        }
        if (data.trackingNumber) {
            if (data.trackingNumber === '미입력') {
                deliveryInfo += ` <span style="font-size: 0.8rem; color: #64748b; display: inline-block;">(송장없이 발송완료)</span>`;
            } else {
                deliveryInfo += ` <span style="font-size: 0.8rem; color: #2196F3; display: inline-block;">(운송장: ${data.trackingCarrier || ''} ${data.trackingNumber})</span>`;
            }
        }

        // Dispatch Button for self-shipping
        let dispatchBtnHtml = '';
        if (data.deliveryMethod === 'pending') {
            dispatchBtnHtml = `
                <div style="margin-top: 15px; text-align: center;">
                    <a href="quote.html?resume_doc_id=${data.id}" style="width: 100%; padding: 12px; background: #e11d48; color: #fff; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; text-decoration: none; box-shadow: 0 4px 6px rgba(225, 29, 72, 0.2);">
                        <span class="material-symbols-outlined" style="font-size: 1.1rem;">local_shipping</span>
                        기기 발송 방법 확정하기
                    </a>
                </div>
            `;
        } else if (data.deliveryMethod === 'cvs' && currentStatus === 'receipt') {
            dispatchBtnHtml = `
                <div style="margin-top: 15px; text-align: center;">
                    <button onclick="window.notifyDispatch('${data.id}')" style="width: 100%; padding: 12px; background: #fff; color: #2563EB; border: 1px solid #2563EB; border-radius: 8px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
                        <span class="material-symbols-outlined" style="font-size: 1.1rem;">local_shipping</span>
                        택배 보냈어요!
                    </button>
                </div>
            `;
        }

        // Contract Button
        let contractBtnHtml = '';
        if (data.inspectionData) {
            const encData = encodeURIComponent(JSON.stringify({...data.inspectionData, brand: data.brand, model: data.model, name: data.customerName, phone: data.customerPhone, expected: price, docId: data.id, status: data.status})).replace(/'/g, "%27");
            contractBtnHtml = `
                <div style="margin-top: 15px; text-align: center;">
                    <button onclick="openContractViewer('${encData}')" style="width: 100%; padding: 12px; background: #1d1d1f; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
                        <span class="material-symbols-outlined" style="font-size: 1.1rem;">receipt_long</span>
                        전자매매계약서(견적서) 확인
                    </button>
                </div>
            `;
        }

        const card = document.createElement('div');
        card.className = 'quote-card';
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <div class="qc-info">
                    <h3>${data.brand || ''} ${data.model || ''} <span style="font-size:0.8rem; color:#888;">${data.storage || ''}</span></h3>
                    <p>예상 매입가: <strong style="color: #2563EB;">${priceStr}</strong></p>
                    <p style="font-size: 0.8rem; margin-top: 4px; color: #666;">신청일: ${dateStr}</p>
                    ${deliveryInfo}
                </div>
                <div style="text-align: right;">
                     <span class="status-badge ${statusBadgeClass}">${statusText}</span>
                </div>
            </div>
            ${stepperHtml}
            ${dispatchBtnHtml}
            ${contractBtnHtml}
        `;
        
        container.appendChild(card);
    });
}

// Global function to open the contract modal
window.openContractViewer = function(encData) {
    try {
        const data = JSON.parse(decodeURIComponent(encData));
        
        let modal = document.getElementById('contract-modal');
        if (!modal) {
            const modalHtml = `
            <div id="contract-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:99999; align-items:center; justify-content:center; padding: 20px; box-sizing: border-box;">
               <div style="background:white; width:100%; max-width:500px; max-height:90vh; border-radius:16px; overflow-y:auto; display:flex; flex-direction:column; box-shadow: 0 10px 40px rgba(0,0,0,0.2);">
                  
                  <div style="padding: 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; background: #f8f9fa; position: sticky; top: 0; z-index: 10;">
                      <h3 style="margin: 0; font-size: 1.2rem; color: #1d1d1f; font-weight: 700; display: flex; align-items: center; gap: 8px;">
                          <span class="material-symbols-outlined" style="color: #2563EB;">verified_user</span> 전자매매계약서
                      </h3>
                      <button onclick="document.getElementById('contract-modal').style.display='none'" style="background:none; border:none; font-size: 24px; line-height:1; cursor:pointer; color: #666;">&times;</button>
                  </div>
                  
                  <div style="padding: 24px;">
                       
                       <!-- Greeting Box -->
                       <div style="background: #F8FAFC; border-radius: 12px; padding: 16px; margin-bottom: 24px; display: flex; align-items: flex-start; gap: 12px; border: 1px solid #E2E8F0;">
                           <div style="width: 40px; height: 40px; border-radius: 50%; background: #DBEAFE; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                               <span class="material-symbols-outlined" style="color: #2563EB; font-size: 1.5rem;">support_agent</span>
                           </div>
                           <div>
                               <h4 style="margin: 0 0 4px 0; font-size: 0.95rem; color: #1E293B;">안녕하세요, 쉐라폰 검수센터입니다.</h4>
                               <p style="margin: 0; font-size: 0.85rem; color: #475569; line-height: 1.5;">고객님께서 보내주신 소중한 기기의 검수가 완료되었습니다. 아래 검수 결과와 매매계약서를 확인하신 후 서명(동의)해 주시면 신속하게 입금을 진행해 드리겠습니다.</p>
                           </div>
                       </div>
                      
                      <h4 style="font-size: 1.05rem; margin: 0 0 10px 0; border-bottom: 2px solid #1d1d1f; padding-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                          검수 차감 내역
                      </h4>
                      <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 24px;">
                          <div id="cv-faults" style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px;"></div>
                          <div id="cv-details" style="font-size: 0.9rem; color: #555; white-space: pre-wrap; line-height: 1.5; padding-top: 12px; border-top: 1px dashed #ddd;"></div>
                      </div>

                      <h4 style="font-size: 1.05rem; margin: 0 0 10px 0; border-bottom: 2px solid #1d1d1f; padding-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                          검수자 종합 소견
                      </h4>
                      <div id="cv-comment" style="font-size: 0.95rem; color: #333; background: #E3F2FD; padding: 15px; border-radius: 8px; line-height: 1.6; margin-bottom: 24px;"></div>

                      <!-- Attachment Section -->
                      <div id="cv-attachment-container" style="display: none; background: #F0FDF4; border: 1px solid #BBF7D0; padding: 15px; border-radius: 8px; margin-bottom: 24px; display: flex; align-items: center; gap: 10px;">
                          <span class="material-symbols-outlined" style="color: #16A34A;">description</span>
                          <div style="flex: 1;">
                              <div style="font-size: 0.85rem; color: #166534; font-weight: 600;">M360 검수완료서 / 첨부파일</div>
                              <div style="font-size: 0.75rem; color: #166534; opacity: 0.9;">개인정보 삭제처리결과 및 상세 진단 보고서</div>
                          </div>
                          <a id="cv-attachment-link" href="#" target="_blank" style="padding: 6px 12px; background: #16A34A; color: white; text-decoration: none; border-radius: 6px; font-size: 0.8rem; font-weight: 600; display: flex; align-items: center; gap: 4px; box-shadow: 0 2px 4px rgba(22,163,74,0.2);">
                              <span class="material-symbols-outlined" style="font-size: 1rem;">download</span> 보기
                          </a>
                      </div>

                      <!-- 차감 사유와 소견을 먼저 읽은 뒤 금액을 보도록 배치 (금액부터 보면 방어적으로 읽게 됨) -->
                      <div style="background: linear-gradient(135deg, #1d1d1f, #434345); padding: 20px; border-radius: 12px; color: white; text-align: center; margin-bottom: 24px;">
                          <div style="font-size: 0.9rem; opacity: 0.8; margin-bottom: 5px;">최종 매입 결정 금액</div>
                          <div style="font-size: 2rem; font-weight: 800; letter-spacing: -0.5px;" id="cv-final-price">0원</div>
                      </div>

                      <h4 style="font-size: 1.05rem; margin: 0 0 10px 0; border-bottom: 2px solid #1d1d1f; padding-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                          거래 정보
                      </h4>
                      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 0.95rem;">
                          <tr>
                              <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666; width: 35%;">계약 번호</td>
                              <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right; font-family: monospace; color: #888;" id="cv-contract-no"></td>
                          </tr>
                          <tr>
                              <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;">매도인 (고객명)</td>
                              <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: 600;" id="cv-name"></td>
                          </tr>
                          <tr>
                              <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;">연락처</td>
                              <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right;" id="cv-phone"></td>
                          </tr>
                          <tr>
                              <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;">매매 대상 기기</td>
                              <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: 600;" id="cv-model"></td>
                          </tr>
                          <tr>
                              <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;">매수 업체</td>
                              <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: 600;">쉐라폰</td>
                          </tr>
                      </table>

                      <div style="border: 1px solid #eee; padding: 15px; border-radius: 8px; font-size: 0.8rem; color: #666; line-height: 1.6; margin-bottom: 10px; background: #fafafa;">
                          <strong style="color: #333; display: block; margin-bottom: 8px; font-size: 0.85rem;">전자매매계약 약관 동의</strong>
                          <div style="margin-bottom: 6px;"><strong>제 1조 (목적)</strong> 본 계약서는 쉐라폰과 고객 간의 중고 기기 매매에 대한 최종 합의서입니다.</div>
                          <div style="margin-bottom: 6px;"><strong>제 2조 (소유권 이전)</strong> 명시된 최종 금액이 고객이 지정한 계좌로 입금된 시점에 단말기의 소유권은 쉐라폰으로 완전 이전됩니다.</div>
                          <div style="margin-bottom: 6px;"><strong>제 3조 (기기 상태 보증)</strong> 매도인은 본 기기가 도난, 분실, 임대 등 불법적인 기기가 아님을 보증하며, 추후 문제 발생 시 모든 민/형사상 책임을 집니다.</div>
                          <div><strong>제 4조 (반환 불가)</strong> 대금 송금이 완료된 이후에는 단순 변심으로 인한 거래 취소 및 기기 반환이 절대 불가함을 확인합니다.</div>
                          
                          <div style="text-align: center; margin-top: 24px; font-weight: 600; color: #333;">
                              위와 같이 확인하고 전자매매계약에 동의함<br>
                              <span style="font-size: 0.85rem; color: #888; margin-top: 5px; display: inline-block;" id="cv-date"></span>
                          </div>
                          
                          <div style="display: flex; justify-content: space-around; margin-top: 20px; font-weight: 600; color: #444; border-top: 1px dashed #ddd; padding-top: 15px;">
                              <span>판매자 : <span id="cv-sign-name" style="color: #2563EB;"></span></span>
                              <span>구매자 : 쉐라폰</span>
                          </div>
                      </div>
                      
                      <div id="cv-action-container" style="margin-top: 24px; text-align: center;">
                          <!-- Action button injected here -->
                      </div>

                      <div style="text-align: right; margin-top: 20px;">
                          <img src="sr_logo.webp" style="height: 24px; opacity: 0.5;" alt="쉐라폰">
                      </div>

                  </div>
               </div>
            </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            modal = document.getElementById('contract-modal');
            modal.addEventListener('click', function(e) {
                if (e.target === modal) modal.style.display = 'none';
            });
            
            // Need material icons if not present
            if (!document.querySelector('link[href*="Material+Symbols+Outlined"]')) {
                document.head.insertAdjacentHTML('beforeend', '<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined" rel="stylesheet" />');
            }
        }
        
        document.getElementById('cv-final-price').innerText = new Intl.NumberFormat('ko-KR').format(data.finalPrice) + "원";
        document.getElementById('cv-contract-no').innerText = data.docId ? data.docId.substring(0,8).toUpperCase() : '-';
        document.getElementById('cv-phone').innerText = data.phone || '-';
        document.getElementById('cv-name').innerText = data.name;
        document.getElementById('cv-sign-name').innerText = data.name;
        document.getElementById('cv-date').innerText = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
        document.getElementById('cv-model').innerText = `${data.brand} ${data.model}`;
        
        const faultsDiv = document.getElementById('cv-faults');
        faultsDiv.innerHTML = '';
        if (data.faults && data.faults.length > 0) {
            data.faults.forEach(f => {
                faultsDiv.innerHTML += `<span style="background: #FFEbee; color: #c62828; padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: 600;">${f}</span>`;
            });
        } else {
            faultsDiv.innerHTML = '<span style="color: #666; font-size: 0.9rem;">해당사항 없음 (정상 기기)</span>';
        }
        
        document.getElementById('cv-details').innerText = data.details || "세부 차감 내역 없음";
        
        const commentDiv = document.getElementById('cv-comment');
        if (data.comment) {
            commentDiv.innerText = data.comment;
            commentDiv.style.display = 'block';
        } else {
            commentDiv.style.display = 'none';
        }
        
        const attachmentContainer = document.getElementById('cv-attachment-container');
        const attachmentLink = document.getElementById('cv-attachment-link');
        if (data.attachmentUrl) {
            attachmentLink.href = data.attachmentUrl;
            attachmentContainer.style.setProperty('display', 'flex', 'important');
        } else {
            attachmentContainer.style.setProperty('display', 'none', 'important');
        }
        
        const actionContainer = document.getElementById('cv-action-container');
        if (data.status === '검수완료') {
            actionContainer.innerHTML = `
                <button onclick="agreeToContract('${data.docId}')" style="width: 100%; padding: 16px; background: #2563EB; color: white; border: none; border-radius: 12px; font-size: 1.1rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 12px rgba(37,99,235,0.3); transition: transform 0.2s;">
                    <span class="material-symbols-outlined">task_alt</span>
                    위 매입가에 동의합니다 (입금 진행)
                </button>
            `;
        } else if (data.status === '입금대기' || data.status === '입금완료' || data.status === 'complete') {
            actionContainer.innerHTML = `
                <div style="width: 100%; padding: 16px; background: #e2e8f0; color: #475569; border-radius: 12px; font-size: 1.05rem; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <span class="material-symbols-outlined">check_circle</span>
                    매입가 동의 완료 (${data.status === '입금대기' ? '입금 진행 중' : '입금 완료'})
                </div>
            `;
        } else {
            actionContainer.innerHTML = '';
        }
        
        modal.style.display = 'flex';
        
    } catch(e) {
        console.error(e);
        alert("계약서를 불러오는 중 오류가 발생했습니다.");
    }
};

import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

window.agreeToContract = async function(docId) {
    if (!docId) return;
    
    if (!confirm("최종 매입가에 동의하십니까?\n동의하시면 취소가 불가하며, 곧바로 입금이 진행됩니다.")) {
        return;
    }
    
    try {
        const docRef = doc(db, "quotes", docId);
        await updateDoc(docRef, {
            status: "입금대기",
            customerAgreedAt: new Date().toISOString()
        });
        
        alert("매입가 동의가 완료되었습니다! 신속하게 입금을 진행하겠습니다.");
        document.getElementById('contract-modal').style.display = 'none';
        
        // Refresh guest search or mypage
        if (window.resetSearch) {
            // Guest mode
            document.getElementById('search-btn').click();
        } else {
            // Mypage mode
            window.location.reload();
        }
    } catch(e) {
        console.error("Agreement error:", e);
        alert("처리 중 오류가 발생했습니다. 다시 시도해주세요.");
    }
};
