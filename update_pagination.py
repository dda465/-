import os

file_path = "script.js"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

start_marker = "async function loadReviews() {"
end_marker = "window.goToReviewPage = (page) => {\n    currentReviewPage = page;\n    renderReviews(page);\n}"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx != -1 and end_idx != -1:
    end_idx += len(end_marker)
    
    new_logic = """async function loadReviews() {
    const listContainer = document.getElementById('reviews-list');
    const loadMoreContainer = document.getElementById('load-more-container');
    const btnLoadMore = document.getElementById('btn-load-more');

    try {
        const q = query(collection(db, "reviews"), orderBy("createdAt", "desc"), limit(reviewsPerPage));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            listContainer.innerHTML = '<div class="text-center" style="grid-column: 1/-1; padding: 40px;">첫 번째 후기의 주인공이 되어보세요!</div>';
            if (loadMoreContainer) loadMoreContainer.style.display = 'none';
            return;
        }

        // Get the last visible document
        lastVisibleReview = querySnapshot.docs[querySnapshot.docs.length - 1];
        if (querySnapshot.docs.length < reviewsPerPage) {
            hasMoreReviews = false;
        }

        listContainer.innerHTML = '';
        const docs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(d => d.isApproved !== false);
        renderReviews(docs, false);

        // Show Load More button if there might be more
        if (loadMoreContainer) {
            if (hasMoreReviews) {
                loadMoreContainer.style.display = 'block';
                btnLoadMore.onclick = loadMoreReviews;
                btnLoadMore.textContent = '더보기 ▼';
            } else {
                loadMoreContainer.style.display = 'none';
            }
        }
    } catch (e) {
        console.error("Error loading reviews:", e);
        listContainer.innerHTML = `<div class="text-center" style="color:red;">후기를 불러오지 못했습니다.<br>${e.message}</div>`;
    }
}

async function loadMoreReviews() {
    if (!hasMoreReviews || !lastVisibleReview) return;
    
    const btnLoadMore = document.getElementById('btn-load-more');
    const loadMoreContainer = document.getElementById('load-more-container');
    
    btnLoadMore.textContent = '불러오는 중...';
    btnLoadMore.disabled = true;

    try {
        const q = query(collection(db, "reviews"), orderBy("createdAt", "desc"), startAfter(lastVisibleReview), limit(reviewsPerPage));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            hasMoreReviews = false;
            loadMoreContainer.style.display = 'none';
            return;
        }

        lastVisibleReview = querySnapshot.docs[querySnapshot.docs.length - 1];
        if (querySnapshot.docs.length < reviewsPerPage) {
            hasMoreReviews = false;
        }

        const docs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(d => d.isApproved !== false);
        renderReviews(docs, true);
        
        if (hasMoreReviews) {
            btnLoadMore.textContent = '더보기 ▼';
            btnLoadMore.disabled = false;
        } else {
            loadMoreContainer.style.display = 'none';
        }

    } catch (e) {
        console.error("Error loading more reviews:", e);
        btnLoadMore.textContent = '더보기 ▼';
        btnLoadMore.disabled = false;
    }
}

async function renderReviews(paginatedReviews, append = false) {
    const listContainer = document.getElementById('reviews-list');
    const currentUser = auth.currentUser;

    if (!append) {
        listContainer.innerHTML = '';
    }

    const isAdmin = currentUser && currentUser.email && await checkIsAdmin(currentUser.email);

    paginatedReviews.forEach((data) => {
        const docId = data.id;
        const dateStr = data.createdAt ? data.createdAt.toDate().toLocaleDateString() : '날짜 없음';
        const rating = data.rating || 5;
        const stars = '⭐'.repeat(rating);
        let safeText = data.text || '';
        const safeName = data.userName || '익명';
        let displayTitle = safeName;

        if (data.deviceModel || data.deviceStorage || data.transactionPrice) {
            const parts = [];
            if (data.deviceModel) parts.push(data.deviceModel);
            if (data.deviceStorage) parts.push(`(${data.deviceStorage})`);
            const deviceStr = parts.join(' ');
            
            if (data.transactionPrice) {
                displayTitle = `${safeName} <span style="font-weight: normal; font-size: 0.85rem; color: #666;">| ${deviceStr} - ${data.transactionPrice}</span>`;
            } else {
                displayTitle = `${safeName} <span style="font-weight: normal; font-size: 0.85rem; color: #666;">| ${deviceStr}</span>`;
            }
        }

        const imageHtml = data.imageUrl ? `
            <div class="review-image-container">
                <img src="${data.imageUrl}" class="review-image" alt="Review Image">
            </div>` : '';

        let actionBtns = '';

        if (isAdmin && typeof safeText === 'string' && safeText.includes('번개톡')) {
            const updatedText = safeText.replace(/번개톡/g, '상담');
            updateDoc(doc(db, "reviews", docId), { text: updatedText }).then(() => {
                const el = document.getElementById(`review-text-${docId}`);
                if (el) el.innerText = updatedText;
            }).catch(e => console.error("Auto fix failed:", e));
            safeText = updatedText;
        }

        if (isAdmin) {
            actionBtns = `
                <div style="margin-top:15px; border-top: 1px solid #f0f0f0; padding-top:10px; display:flex; gap:10px;">
                    <button class="btn btn-secondary btn-sm" onclick="editReview('${docId}')" style="font-size:0.8rem; padding: 4px 10px;">수정 (관리자)</button>
                    <button class="btn btn-primary btn-sm" onclick="deleteReview('${docId}')" style="font-size:0.8rem; padding: 4px 10px; background-color:#ef4444;">삭제 (관리자)</button>
                </div>
            `;
        } else if (currentUser && currentUser.uid === data.userId) {
            actionBtns = `
                <div style="margin-top:15px; border-top: 1px solid #f0f0f0; padding-top:10px; display:flex; gap:10px;">
                    <button class="btn btn-secondary btn-sm" onclick="editReview('${docId}')" style="font-size:0.8rem; padding: 4px 10px;">수정</button>
                    <button class="btn btn-primary btn-sm" onclick="deleteReview('${docId}')" style="font-size:0.8rem; padding: 4px 10px; background-color:#ef4444;">삭제</button>
                </div>
            `;
        }

        const reviewCard = document.createElement('div');
        reviewCard.className = 'review-card';
        reviewCard.style.cssText = 'background: white; border-radius: 16px; padding: 24px; border: 1px solid #f0f0f0; display: flex; flex-direction: column; gap: 15px;';
        reviewCard.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 15px;">
                <div style="flex: 1;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <h4 style="margin: 0; font-size: 1.1rem; color: #1e293b;">${displayTitle}</h4>
                        <div style="font-size: 0.9rem; color: #fbbf24; letter-spacing: 2px;">${stars}</div>
                    </div>
                    <div style="font-size: 0.85rem; color: #94a3b8; margin-bottom: 12px;">${dateStr}</div>
                    <p id="review-text-${docId}" style="margin: 0; color: #475569; font-size: 0.95rem; line-height: 1.6; white-space: pre-wrap;">${safeText}</p>
                    ${actionBtns}
                </div>
                ${data.imageUrl ? `
                <div style="width: 100px; height: 100px; flex-shrink: 0; border-radius: 10px; overflow: hidden; border: 1px solid #f1f5f9; cursor: pointer;" onclick="openImageModal('${data.imageUrl}')">
                    <img src="${data.imageUrl}" style="width: 100%; height: 100%; object-fit: cover;">
                </div>
                ` : ''}
            </div>
        `;
        listContainer.appendChild(reviewCard);
    });
}"""
    
    new_content = content[:start_idx] + new_logic + content[end_idx:]
    
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(new_content)
    print("Script updated successfully.")
else:
    print(f"Could not find markers. start={start_idx}, end={end_idx}")
