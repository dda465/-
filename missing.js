    // New Function: Render Grade Price List (Read-Only)
    window.renderGradePriceList = () => {
        const container = document.getElementById('grade-price-list-target');
        if (!container || !currentQuote.model) return;

        if (currentQuote.model.model === '기타 기종') {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #eee;">
                    <div style="font-size: 3rem; margin-bottom: 15px;">🔍</div>
                    <h3 style="color: #333; margin-bottom: 10px; font-weight: 700;">기타 기종 상태확인 안내</h3>
                    <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
                        목록에 없는 기타 기종은 기기 상태 검수 후 정확한 견적이 산출됩니다.<br>
                        대략적인 단가가 궁금하시다면 고객센터로 문의해 주세요!
                    </p>
                    <button onclick="if(window.ChannelIO){ChannelIO('showMessenger')}else{alert('채팅 상담 연결 중 문제가 발생했습니다.')}" class="btn btn-secondary" style="background: #2563EB; color: white; border: none; font-weight: 600;">채팅으로 단가 문의하기</button>
                </div>
            `;
            return;
        }

        const prices = currentQuote.model.prices || {};
        const basePrice = currentQuote.model.basePrice || 0;

        // Define Grades to show
        const grades = ['s', 'a', 'b', 'c', 'd'];

        let html = '';
        grades.forEach(g => {
            let price = prices[g];
            if (price === undefined) {
                if (g === 's') price = basePrice;
                else if (g === 'a') price = basePrice * 0.9;
                else if (g === 'b') price = basePrice * 0.8;
                else if (g === 'c') price = basePrice * 0.6;
                else if (g === 'd') price = basePrice * 0.2;
            }
            price = Math.floor(price / 1000) * 1000;

            const gradeLabels = {
                s: { title: "S급 (미사용/최고)", desc: "기스 없는 최고 상태" },
                a: { title: "A급 (깨끗)", desc: "미세 기스 1~2곳" },
                b: { title: "B급 (사용감)", desc: "찍힘/기스 다수" },
                c: { title: "C급 (파손)", desc: "화면 파손/기능 불량" },
                d: { title: "D급 (심한 파손)", desc: "심한 파손/기능 불량" }
            };

            // Read-Only List Item
            html += `
            <div class="grade-list-card" style="cursor: default; pointer-events: none;">
                <div class="grade-row" style="padding: 15px 20px;">
                    <div class="grade-info">
                        <h4 style="margin:0; font-size:1rem;">${gradeLabels[g].title}</h4>
                        <p style="margin:2px 0 0; font-size:0.8rem; color:#888;">${gradeLabels[g].desc}</p>
                    </div>
                    <div class="grade-price" style="font-size:1.1rem;">${formatCurrency(price)}</div>
                </div>
            </div>`;
        });
        container.innerHTML = html;
    };

    window.setGradeAndGo = (grade) => {
        currentQuote.grade = grade;
        // Calculate price
        let price = 0;
        if (currentQuote.model.prices && currentQuote.model.prices[grade]) {
            price = currentQuote.model.prices[grade];
        } else {
            // Fallback
            const base = currentQuote.model.basePrice || 0;
            const rates = { s: 1, a: 0.9, b: 0.8, c: 0.6, d: 0.2 };
            price = base * (rates[grade] || 0);
        }

        // Add storage
        if (currentQuote.storage) price += (currentQuote.storage.priceAdjustment || 0);

        currentQuote.finalPrice = Math.floor(price / 1000) * 1000;

        calculateAndShowResult(true); // Render Step 6
        goToStep(6);
    };

    window.selectMethod = (method) => {
        currentQuote.method = method; // 'simple' or 'self'
        if (method === 'simple') {
            console.log("Simple Mode: Showing Grade List");

            // Set default / placeholder values for Simple Quote
            currentQuote.grade = 's'; // Default to S Grade
            // Calculate S Grade Price
            let sPrice = 0;
            if (currentQuote.model.prices && currentQuote.model.prices['s']) {
                sPrice = currentQuote.model.prices['s'];
            } else {
                sPrice = currentQuote.model.basePrice || 0;
            }

            if (currentQuote.storage) sPrice += (currentQuote.storage.priceAdjustment || 0);

            // Round
            currentQuote.finalPrice = Math.floor(sPrice / 1000) * 1000;

            renderGradePriceList();
            goToStep('grade-list');
        } else {
            goToStep('defects');
        }
    };

    // Helper for Samsung Series Grouping
    function getSamsungParentCategory(seriesName) {
        if (!seriesName) return '기타 기종';
        const s = seriesName.toUpperCase();
        if (s.includes('폴드') || s.includes('FOLD') || s.includes('Z FOLD')) return '폴드 시리즈';
        if (s.includes('플립') || s.includes('FLIP') || s.includes('Z FLIP')) return '플립 시리즈';
        if (s.includes('노트') || s.includes('NOTE')) return '노트 시리즈';
        if (s.includes('S') && /[0-9]/.test(s) && !s.includes('플립') && !s.includes('폴드') && !s.includes('노트')) return 'S 시리즈';
        if (s.includes('A') && /[0-9]/.test(s)) return 'A 시리즈';
        return '기타 기종';
    }

    // Step 2: Series
    function renderSeries(brand) {
        const container = document.getElementById('series-list');
        container.innerHTML = '';

        const products = allProducts.filter(p => p.brand === brand);
        
        let seriesSet;
        if (brand === 'samsung') {
            seriesSet = new Set();
            products.forEach(p => seriesSet.add(getSamsungParentCategory(p.series)));
        } else {
            seriesSet = new Set(products.map(p => p.series || '기타'));
        }
        
        // Advanced sorting
        let seriesList;
        if (brand === 'samsung') {
            const order = ['S 시리즈', '폴드 시리즈', '플립 시리즈', '노트 시리즈', 'A 시리즈', '기타 기종'];
            seriesList = Array.from(seriesSet).sort((a, b) => {
                let idxA = order.indexOf(a);
                let idxB = order.indexOf(b);
                if (idxA === -1) idxA = 99;
                if (idxB === -1) idxB = 99;
                return idxA - idxB;
            });
        } else {
            seriesList = Array.from(seriesSet).sort((a, b) => {
                if (a === '기타') return 1;
                if (b === '기타') return -1;
                const numA = parseInt(a.replace(/[^0-9]/g, ''), 10) || 0;
                const numB = parseInt(b.replace(/[^0-9]/g, ''), 10) || 0;
                if (numA !== numB) return numB - numA;
                return b.localeCompare(a); 
            });
        }

        if (seriesList.length === 0) {
            container.innerHTML = '<div>해당 브랜드의 모델이 없습니다.</div>';
            return;
        }

        seriesList.forEach((series, index) => {
            if (series === '기타' || series === '기타 기종') return; // Handled below

            const card = document.createElement('div');
            card.className = 'selection-card';
            card.style.position = 'relative'; // absolute badge positioning
            card.style.transition = '0.2s';
            card.style.display = 'flex';
            card.style.flexDirection = 'column';
            card.style.alignItems = 'center';
            card.style.justifyContent = 'center';
            card.style.padding = '15px';
            
            let extraHtml = '';
            
            // Show badges mainly for Apple as before
            if (brand === 'apple') {
                if (index === 0) {
                    card.style.borderColor = '#ef4444';
                    extraHtml = '<span style="position: absolute; top: -12px; right: -5px; background: #ef4444; color: white; padding: 4px 10px; border-radius: 20px; font-size: 0.70rem; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.1); z-index: 10;">NEW</span>';
                } 
                else if (index === 1) {
                    card.style.borderColor = '#f59e0b';
                    extraHtml = '<span style="position: absolute; top: -12px; right: -5px; background: #f59e0b; color: white; padding: 4px 10px; border-radius: 20px; font-size: 0.70rem; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.1); z-index: 10;">HOT</span>';
                }
            }

            // Optional Image for Categories
            let imgHtml = '';
            if (brand === 'samsung') {
                let imgSrc = '';
                if (series === 'S 시리즈') imgSrc = 'assets/series/samsung/s시리즈.png';
                else if (series === '폴드 시리즈') imgSrc = 'assets/series/samsung/폴드 시리즈.png';
                else if (series === '플립 시리즈') imgSrc = 'assets/series/samsung/플립 시리즈.png';
                else if (series === '노트 시리즈') imgSrc = 'assets/series/samsung/갤럭시노트.png';
                
                if (imgSrc) {
                    imgHtml = `<img src="${imgSrc}" style="height: 80px; object-fit: contain; margin-bottom: 8px;" alt="${series}">`;
                }
            } else if (brand === 'apple') {
                const baseName = series.replace('시리즈', '').replace(/\s+/g, '').toLowerCase();
                const imgSrc = `assets/series/apple/${baseName}.png`;
                
                // Set fallback to avoid broken image icons if image isn't uploaded yet
                imgHtml = `<img src="${imgSrc}" style="height: 80px; object-fit: contain; margin-bottom: 8px;" alt="${series}" onerror="this.style.display='none'">`;
            }

            card.innerHTML = `${imgHtml}<div class="card-title">${series}</div>${extraHtml}`;
            card.onclick = () => {
                if (brand === 'samsung') {
                    currentQuote.parentCategory = series;
                    renderSubSeries(brand, series);
                    goToStep('2-sub');
                } else {
                    currentQuote.series = series;
                    renderModels(brand, series);
                    goToStep(3);
                }
            };
            container.appendChild(card);
        });

        // Add "Other" Option
        const otherCard = document.createElement('div');
        otherCard.className = 'selection-card';
        otherCard.style.borderColor = '#ccc';
        otherCard.style.backgroundColor = '#f8f9fa';
        otherCard.style.display = 'flex';
        otherCard.style.alignItems = 'center';
        otherCard.style.justifyContent = 'center';
        otherCard.innerHTML = `<div class="card-title" style="color: #555;">기타 기종 (목록에 없음)</div>`;
        otherCard.onclick = () => {
            currentQuote.series = '기타';
            currentQuote.model = {
                brand: brand,
                series: '기타',
                model: '기타 기종',
                basePrice: 0,
                prices: {},
                storageOptions: [{ size: '해당없음', priceAdjustment: 0 }]
            };
            currentQuote.storage = currentQuote.model.storageOptions[0];
            goToStep('method'); 
            selectMethod('simple');
        };
        container.appendChild(otherCard);

        // Add "Not Found" Option
        const notFoundCard = document.createElement('div');
        notFoundCard.className = 'selection-card';
        notFoundCard.style.borderColor = '#2563EB';
        notFoundCard.style.backgroundColor = '#EFF6FF';
        notFoundCard.innerHTML = `<div class="card-title" style="color: #1E3A8A;">찾는 시리즈가 없나요?</div><div class="card-sub" style="color:#2563EB;">채팅상담 문의하기</div>`;
        notFoundCard.onclick = () => {
            if (window.ChannelIO) {
                ChannelIO('showMessenger');
            } else {
                alert('채팅 상담 플러그인을 불러올 수 없습니다.');
            }
        };
        // container.appendChild(notFoundCard); // Temporarily hidden
    }

    // Step 2-Sub: Detailed Series (For Samsung)
    function renderSubSeries(brand, parentCategory) {
        const container = document.getElementById('sub-series-list');
        container.innerHTML = '';

        // Filter products that belong to the selected parent category
        const productsInParent = allProducts.filter(p => p.brand === brand && getSamsungParentCategory(p.series) === parentCategory);
        
        // Extract unique specific series (e.g., 'S24', 'S23')
        const specificSeriesSet = new Set();
        productsInParent.forEach(p => {
            if (p.series) specificSeriesSet.add(p.series);
        });

        // Sort descending (S25 -> S24 -> S23)
        const specificSeriesList = Array.from(specificSeriesSet).sort((a, b) => {
            // simple string sort in descending order works for S24 vs S23
            return b.localeCompare(a);
        });

        if (specificSeriesList.length === 0) {
            container.innerHTML = '<div>해당 카테고리의 모델이 없습니다.</div>';
            return;
        }

        specificSeriesList.forEach(seriesName => {
            const card = document.createElement('div');
            card.className = 'selection-card';
            card.style.display = 'flex';
            card.style.flexDirection = 'column';
            card.style.alignItems = 'center';
            card.style.justifyContent = 'center';
            card.style.padding = '15px';
            
            // Clean up name for display if needed
            const displayName = seriesName; 
            
            let subtext = '';
            const match = seriesName.match(/[0-9]+/);
            if(match) subtext = `<div style="font-size:0.75rem; color:#888; margin-top:4px;">${match[0]} Series</div>`;

            card.innerHTML = `<div class="card-title">${displayName}</div>${subtext}`;
            card.onclick = () => {
                currentQuote.specificSeries = seriesName;
                renderModels(brand, seriesName);
                goToStep(3);
            };
            container.appendChild(card);
        });
    }

    // Step 3: Model
    function renderModels(brand, specificSeriesOrParent) {
        const container = document.getElementById('model-list');
        container.innerHTML = '';

        let models;
        if (brand === 'samsung') {
            // For Samsung, we now pass exact specific series (e.g., 'S24') instead of parent category
            models = allProducts.filter(p => p.brand === brand && p.series === specificSeriesOrParent);
            models.sort((a, b) => {
                return (b.basePrice || 0) - (a.basePrice || 0);
            });
        } else {
            models = allProducts.filter(p => p.brand === brand && (p.series || '기타') === specificSeriesOrParent);
            models.sort((a, b) => b.basePrice - a.basePrice);
        }

        models.forEach(item => {
            const card = document.createElement('div');
            card.className = 'selection-card';
            
            let subtext = '';
            if (brand === 'samsung' && item.series) {
                const cleanSeriesName = item.series.replace('갤럭시 ', '').replace(' 시리즈', '');
                subtext = `<div style="font-size:0.75rem; color:#888; margin-top:4px;">${cleanSeriesName}</div>`;
            }
            
            card.innerHTML = `<div class="card-title">${item.model}</div>${subtext}`;
            card.onclick = () => {
                currentQuote.model = item;
                renderStorage(item);
                goToStep(4);
            };
            container.appendChild(card);
        });
    }

    // Step 4: Storage
    function renderStorage(modelData) {
        const container = document.getElementById('storage-list');
        container.innerHTML = '';

        const options = modelData.storageOptions || [
            { size: "Default", priceAdjustment: 0 }
        ];

        options.forEach(opt => {
            const card = document.createElement('div');
            card.className = 'selection-card';
            card.innerHTML = `
    <div class="card-title">${opt.size}</div>
        <div class="card-sub">${opt.priceAdjustment > 0 ? '+' : ''}${opt.priceAdjustment / 10000}만</div>
`;
            card.onclick = () => {
                currentQuote.storage = opt;
                goToStep('method'); // Go to Method Selection
            };
            container.appendChild(card);
        });
        
        // Add custom option
        const customCard = document.createElement('div');
        customCard.className = 'selection-card';
        customCard.innerHTML = `
            <div class="card-title" style="font-size: 1.1rem;">찾는 용량이 없어요</div>
            <div class="card-sub" style="font-weight: 500; color: #2563EB; margin-top: 10px;">직접 입력하기</div>
        `;
        customCard.onclick = () => {
            const inputVal = prompt("해당 기기의 저장공간 용량을 직접 입력해주세요 (예: 64GB, 256GB 등)");
            if (inputVal && inputVal.trim() !== "") {
                currentQuote.storage = { size: inputVal.trim() + " (직접입력)", priceAdjustment: 0 };
                goToStep('method'); // Go to Method Selection
            }
        };
        container.appendChild(customCard);
    }

    function calculateFinalPrice() {
        if (!currentQuote.model || !currentQuote.grade) return;

        // Get the price for the specific grade
        // prices obj: { sealed: 100, s: 90, ... }
        let baseGradePrice = currentQuote.model.prices[currentQuote.grade] || 0;

        // Add Storage Adjustment
        let storageAdj = currentQuote.storage.priceAdjustment || 0;

        let finalPrice = baseGradePrice + storageAdj;

        if (finalPrice < 0) finalPrice = 0;

        // Grade Name Mapping
        const gradeNames = {
            sealed: "미개봉 (새상품)",
            s: "S급 (최고)",
            a: "A급 (깨끗)",
            b: "B급 (사용감)",
            c: "C급 (파손)",
            d: "D급 (폐폰)"
        };

        const gradeName = gradeNames[currentQuote.grade] || currentQuote.grade;

        let breakdownHtml = `
    <p><strong>선택하신 등급:</strong> <span style="color:var(--primary-color)">${gradeName}</span></p>
            <p>등급 기본가: <strong>${formatCurrency(baseGradePrice)}</strong></p>
            <p>용량 옵션 (${currentQuote.storage.size}): ${storageAdj > 0 ? '+' : ''}${formatCurrency(storageAdj)}</p>
            <hr style="margin: 10px 0; border: 0; border-top: 1px solid #eee;">
        `;

        finalPrice = Math.floor(finalPrice / 1000) * 1000;
        if (finalPrice < 0) finalPrice = 0;

        currentQuote.finalPrice = finalPrice;
        document.getElementById('result-model-name').textContent = `${currentQuote.model.model} (${currentQuote.storage.size})`;
        document.getElementById('final-price-display').textContent = formatCurrency(finalPrice);
        document.getElementById('price-breakdown').innerHTML = breakdownHtml;
    }

    async function handleFinalSubmit() {
        const btnSubmit = document.getElementById('btn-submit-final');
        const name = document.getElementById('auth-name').value;
        const phone = document.getElementById('auth-phone').value;
        const address = document.getElementById('customer-address').value;
        const account = document.getElementById('customer-account').value;
        const memo = document.getElementById('customer-memo') ? document.getElementById('customer-memo').value : '';

        // Default to 'pickup' (Visiting Pickup old default) or 'courier' (new default)
        // If not set, check active btn
        let deliveryMethod = currentQuote.deliveryMethod;
        if (!deliveryMethod) {
            const activeBtn = document.querySelector('.method-btn.active');
            if (activeBtn) deliveryMethod = activeBtn.dataset.method;
            else deliveryMethod = 'courier';
        }

        if (!name || !phone) {
            alert("이름과 연락처를 입력해주세요.");
            return;
        }

        // Validation: Address required for visiting services
        // pickup_samil (Same day), courier (Visiting), pickup (Legacy)
        const needsAddress = ['courier', 'pickup'].includes(deliveryMethod);

        if (needsAddress && !address) {
            alert("수거를 위해 주소를 입력해주세요.");
            return;
        }

        if (!account) {
            alert("정산을 위해 계좌번호를 입력해주세요.");
            return;
        }

        btnSubmit.textContent = '처리 중...';
        btnSubmit.disabled = true;

        const payload = {
            timestamp: new Date().toLocaleString(),
            brand: currentQuote.brand,
            model: currentQuote.model.model,
            series: currentQuote.model.series || currentQuote.series,
            storage: currentQuote.storage.size,
            grade: currentQuote.grade,
            conditionType: currentQuote.grade === 'sealed' ? 'sealed' : 'used',
            price: currentQuote.finalPrice,
            customerName: name,
            customerPhone: phone,
            customerAddress: needsAddress ? address : '편의점/직접 택배 발송',
            deliveryMethod: deliveryMethod,
            customerAccount: account,
            customerMemo: memo,
            userId: auth.currentUser ? auth.currentUser.uid : 'anonymous',
            firebaseTimestamp: serverTimestamp(),
            method: currentQuote.method || 'simple',
            defectsDetails: currentQuote.defectsDetails || {}
        };

        try {
            if (!auth.currentUser) {
                await signInAnonymously(auth);
            }
            await addDoc(collection(db, "quotes"), payload);
            
            // --- GA4 Event Tracking: Quote Completed ---
            if (typeof gtag !== 'undefined') {
                gtag('event', 'quote_completed', {
                    'event_category': 'quote',
                    'event_label': payload.modelName || 'Unknown Model',
                    'value': payload.expectedPrice || 0
                });
            }

            fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify(payload)
            }).catch(e => console.log("GAS Error ignored:", e));

            // --- Send Telegram Notification ---
            const tgMessage = `
🔔 *새로운 매입 신청 알림*
━━━━━━━━━━━━━━
👤 *신청자*: ${payload.customerName}
📞 *연락처*: ${payload.customerPhone}
📱 *모델*: ${payload.brand} ${payload.model} (${payload.storage})
💎 *등급*: ${payload.grade}
💰 *예상가*: ${new Intl.NumberFormat('ko-KR').format(payload.price)}원
🚚 *방식*: ${payload.deliveryMethod === 'courier' ? '택배 방문수거' : '편의점 택배'}
📝 *메모*: ${payload.customerMemo || '없음'}
━━━━━━━━━━━━━━
            `.trim();

            fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: TELEGRAM_CHAT_ID,
                    text: tgMessage,
                    parse_mode: 'Markdown'
                })
            }).catch(e => console.error("Telegram Notification Error:", e));

            // Update Success Message
            const successDiv = document.getElementById('success-instruction');
            let msgTitle = "";
            let msgDesc = "";

            if (deliveryMethod === 'courier' || deliveryMethod === 'pickup') {
                msgTitle = "📦 택배 방문수거 접수 완료";
                msgDesc = "문 앞에 박스를 두시면 기사님이 수거해 갈 예정입니다. (1~2일 내)";
            } else if (deliveryMethod === 'cvs') {
                msgTitle = "🏪 편의점/직접 택배 안내";
                msgDesc = "아래 주소로 기기를 <strong>착불</strong>로 보내주세요.";
            }

            successDiv.innerHTML = `
                <h4 style="color: #2196F3; margin-bottom: 10px;">${msgTitle}</h4>
                <p>${msgDesc}</p>
                <div style="background: white; padding: 15px; border: 1px solid #ddd; border-radius: 6px; margin: 10px 0;">
                    <strong>부산광역시 남구 남동천로 128 BIFC2 716호</strong><br>
                    <span style="font-size: 0.9rem; color: #666;">Tel: 010-5173-5382</span>
                </div>
                <p style="font-size: 0.9rem; color: #666;">* 마이페이지에서 진행 상황을 확인하실 수 있습니다.</p>
            `;

            if (typeof gtag !== 'undefined') {
                gtag('event', 'generate_lead', {
                    'event_category': 'Quote',
                    'event_label': `${payload.brand} ${payload.model}`,
                    'value': payload.price,
                    'currency': 'KRW'
                });
            }

            goToStep(8); // Success Step

        } catch (e) {
            console.error("Submit Error:", e);
            alert("제출 실패: " + e.message);
            btnSubmit.textContent = '신청 완료하기';
            btnSubmit.disabled = false;
        }
    }
