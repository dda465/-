
        import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
        import { getFirestore, collection, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
        
        const firebaseConfig = {
            apiKey: "AIzaSyA0MsBbnOFYGKlYOSGzMB9YsH7VKEpOmoc",
            authDomain: "rejeuphone.firebaseapp.com",
            projectId: "rejeuphone",
            storageBucket: "rejeuphone.firebasestorage.app",
            messagingSenderId: "465aborber",
            appId: "1:465086508475:web:1925d37e3e4f15da831a17"
        };
        const app = initializeApp(firebaseConfig);
        const db = getFirestore(app);
        
        // ─── 다국어 번역 ───
        const T = {
            en: {
                back: "Back", brand_title: "What brand is your phone?", brand_desc: "Select your phone's manufacturer",
                series_title: "Select your series", series_desc: "Choose the model line",
                subseries_title: "Select your model line",
                model_title: "Select your model", model_desc: "Choose the exact model",
                storage_title: "Select storage capacity",
                defect_title: "Check your phone's condition", defect_desc: "Toggle ON for any issues your phone has",
                see_price: "See Estimated Price →",
                result_title: "Your Estimated Price", result_label: "Estimated buyback price",
                apply_now: "Apply Now →",
                result_notice: "💡 This is an estimated price. The final price will be determined after our team inspects your device.",
                apply_title: "📝 Submit Your Application", apply_desc: "This section is coming soon.",
                apply_coming_soon: "The foreigner application form is being prepared.\nFor now, please contact us through the chat button below\nor send us an email.",
                opened: "Opened/Unsealed", opened_d: "Box has been opened",
                crack: "Cracks / Dents", crack_d: "Any physical damage on body",
                lcd: "LCD Damage", lcd_d: "Screen burn, dead pixels, lines",
                back_crack: "Back Glass Crack", back_crack_d: "Rear glass is cracked",
                camera: "Camera Issue", camera_d: "Lens crack, blur, malfunction",
                battery: "Battery Swollen", battery_d: "Battery is expanded/bulging",
                power: "Won't Turn On", power_d: "Device does not power on",
                contact_title: "📋 Your Information", contact_desc: "We'll contact you through the info below",
                contact_name: "Your Name", contact_method: "Contact Method",
                contact_notice: "🔒 Your information is safe. We only use it to contact you about your phone sale.",
                preview_price_label: "Estimated Price",
                result_submitted: "✅ Your application has been received!",
                result_submitted_desc: "We will contact you shortly through your preferred method. Please keep your messenger/phone available.",
                result_summary: "📝 Application Summary", go_home: "← Back to Home",
                contact_address: "Pick-up Address", contact_payment: "Payment Method",
                pay_cash: "Cash (KRW)", pay_bank: "Bank Transfer",
                bank_account: "Bank Account Details", bank_account_ph: "Bank Name, Account Number, Account Holder"
            },
            zh: {
                back: "返回", brand_title: "你的手机是什么品牌？", brand_desc: "选择手机制造商",
                series_title: "选择系列", series_desc: "选择型号系列",
                subseries_title: "选择子系列",
                model_title: "选择型号", model_desc: "选择具体型号",
                storage_title: "选择存储容量",
                defect_title: "检查手机状况", defect_desc: "有问题请打开开关",
                see_price: "查看预估价格 →",
                result_title: "预估回收价格", result_label: "预估回收价",
                apply_now: "立即申请 →",
                result_notice: "💡 这是预估价格。最终价格将在我们检查您的设备后确定。",
                apply_title: "📝 提交申请", apply_desc: "此部分即将推出。",
                apply_coming_soon: "外国人申请表正在准备中。\n请通过下方聊天按钮或电子邮件联系我们。",
                opened: "已拆封", opened_d: "包装已打开",
                crack: "裂纹/凹痕", crack_d: "机身有物理损伤",
                lcd: "LCD损坏", lcd_d: "烧屏、坏点、线条",
                back_crack: "后盖碎裂", back_crack_d: "后玻璃碎裂",
                camera: "摄像头问题", camera_d: "镜头碎、模糊、故障",
                battery: "电池膨胀", battery_d: "电池膨胀/鼓包",
                power: "无法开机", power_d: "设备无法开机",
                contact_title: "📋 您的信息", contact_desc: "我们将通过以下信息联系您",
                contact_name: "您的姓名", contact_method: "联系方式",
                contact_notice: "🔒 您的信息是安全的。我们仅用于联系您进行手机交易。",
                preview_price_label: "预估价格",
                result_submitted: "✅ 您的申请已收到！",
                result_submitted_desc: "我们将尽快通过您选择的方式联系您。请保持联系畅通。",
                result_summary: "📝 申请摘要", go_home: "← 返回首页",
                contact_address: "取件地址", contact_payment: "收款方式",
                pay_cash: "现金 (韩元)", pay_bank: "银行转账",
                bank_account: "银行账户信息", bank_account_ph: "银行名称，账号，开户人"
            },
            vi: {
                back: "Quay lại", brand_title: "Điện thoại của bạn hãng nào?", brand_desc: "Chọn nhà sản xuất",
                series_title: "Chọn dòng sản phẩm", series_desc: "Chọn dòng máy",
                subseries_title: "Chọn dòng phụ",
                model_title: "Chọn model", model_desc: "Chọn model cụ thể",
                storage_title: "Chọn dung lượng",
                defect_title: "Kiểm tra tình trạng điện thoại", defect_desc: "Bật ON nếu có vấn đề",
                see_price: "Xem giá ước tính →",
                result_title: "Giá thu mua ước tính", result_label: "Giá thu mua ước tính",
                apply_now: "Đăng ký ngay →",
                result_notice: "💡 Đây là giá ước tính. Giá cuối cùng sẽ được xác định sau khi kiểm tra thiết bị.",
                apply_title: "📝 Gửi đơn đăng ký", apply_desc: "Phần này sắp ra mắt.",
                apply_coming_soon: "Biểu mẫu đăng ký cho người nước ngoài đang được chuẩn bị.\nVui lòng liên hệ qua chat hoặc email.",
                opened: "Đã mở hộp", opened_d: "Hộp đã được mở",
                crack: "Vết nứt/lõm", crack_d: "Hư hỏng vật lý trên thân máy",
                lcd: "Hỏng LCD", lcd_d: "Cháy màn, điểm chết",
                back_crack: "Nứt mặt lưng", back_crack_d: "Kính sau bị nứt",
                camera: "Lỗi camera", camera_d: "Ống kính nứt, mờ",
                battery: "Pin phồng", battery_d: "Pin bị phồng",
                power: "Không bật được", power_d: "Máy không lên nguồn",
                contact_title: "📋 Thông tin của bạn", contact_desc: "Chúng tôi sẽ liên hệ qua thông tin bên dưới",
                contact_name: "Tên của bạn", contact_method: "Phương thức liên lạc",
                contact_notice: "🔒 Thông tin của bạn được bảo mật. Chúng tôi chỉ dùng để liên hệ về việc bán điện thoại.",
                preview_price_label: "Giá dự kiến",
                result_submitted: "✅ Đơn đăng ký đã được nhận!",
                result_submitted_desc: "Chúng tôi sẽ sớm liên hệ qua phương thức bạn chọn. Vui lòng giữ liên lạc.",
                result_summary: "📝 Tóm tắt đăng ký", go_home: "← Quay về trang chủ",
                contact_address: "Địa chỉ nhận máy", contact_payment: "Phương thức thanh toán",
                pay_cash: "Tiền mặt (KRW)", pay_bank: "Chuyển khoản",
                bank_account: "Thông tin tài khoản ngân hàng", bank_account_ph: "Tên ngân hàng, Số tài khoản, Tên chủ tài khoản"
            },
            ja: {
                back: "戻る", brand_title: "お使いのスマホのブランドは？", brand_desc: "メーカーを選択してください",
                series_title: "シリーズを選択", series_desc: "モデルラインを選択",
                subseries_title: "サブシリーズを選択",
                model_title: "モデルを選択", model_desc: "正確なモデルを選択",
                storage_title: "ストレージ容量を選択",
                defect_title: "端末の状態を確認", defect_desc: "問題がある場合はONにしてください",
                see_price: "見積もり価格を見る →",
                result_title: "見積もり買取価格", result_label: "見積もり買取価格",
                apply_now: "今すぐ申し込む →",
                result_notice: "💡 これは見積もり価格です。最終価格は検品後に決定されます。",
                apply_title: "📝 申請を送信", apply_desc: "このセクションは準備中です。",
                apply_coming_soon: "外国人用の申請フォームを準備中です。\nチャットまたはメールでお問い合わせください。",
                opened: "開封済み", opened_d: "箱が開封されている",
                crack: "ヒビ・へこみ", crack_d: "本体の物理的損傷",
                lcd: "LCD損傷", lcd_d: "焼き付き、ドット抜け",
                back_crack: "背面ガラス割れ", back_crack_d: "背面ガラスにヒビ",
                camera: "カメラ不良", camera_d: "レンズ割れ、ぼやけ",
                battery: "バッテリー膨張", battery_d: "バッテリーが膨らんでいる",
                power: "電源が入らない", power_d: "起動しない",
                contact_title: "📋 お客様の情報", contact_desc: "以下の情報でご連絡いたします",
                contact_name: "お名前", contact_method: "連絡方法",
                contact_notice: "🔒 お客様の情報は安全です。携帯電話の売却に関する連絡にのみ使用します。",
                preview_price_label: "予想買取価格",
                result_submitted: "✅ お申し込みを受け付けました！",
                result_submitted_desc: "ご希望の方法で近日中にご連絡いたします。連絡手段をご確認ください。",
                result_summary: "📝 申請概要", go_home: "← ホームに戻る",
                contact_address: "集荷先住所", contact_payment: "支払方法",
                pay_cash: "現金 (ウォン)", pay_bank: "銀行振込",
                bank_account: "口座情報", bank_account_ph: "銀行名、口座番号、名義人"
            },
            ru: {
                back: "Назад", brand_title: "Какой бренд вашего телефона?", brand_desc: "Выберите производителя",
                series_title: "Выберите серию", series_desc: "Выберите линейку моделей",
                subseries_title: "Выберите подсерию",
                model_title: "Выберите модель", model_desc: "Выберите точную модель",
                storage_title: "Выберите объём памяти",
                defect_title: "Проверьте состояние телефона", defect_desc: "Включите при наличии проблем",
                see_price: "Узнать цену →",
                result_title: "Оценочная цена", result_label: "Оценочная цена выкупа",
                apply_now: "Подать заявку →",
                result_notice: "💡 Это оценочная цена. Окончательная цена определяется после осмотра устройства.",
                apply_title: "📝 Подать заявку", apply_desc: "Этот раздел скоро будет готов.",
                apply_coming_soon: "Форма заявки для иностранцев готовится.\nПожалуйста, свяжитесь с нами через чат или email.",
                opened: "Вскрыта упаковка", opened_d: "Коробка была вскрыта",
                crack: "Трещины/вмятины", crack_d: "Физические повреждения корпуса",
                lcd: "Повреждение LCD", lcd_d: "Выгорание, битые пиксели",
                back_crack: "Трещина задней панели", back_crack_d: "Заднее стекло разбито",
                camera: "Проблема с камерой", camera_d: "Трещина объектива, размытие",
                battery: "Вздутие батареи", battery_d: "Батарея вздулась",
                power: "Не включается", power_d: "Устройство не включается",
                contact_title: "📋 Ваши данные", contact_desc: "Мы свяжемся с вами по указанным данным",
                contact_name: "Ваше имя", contact_method: "Способ связи",
                contact_notice: "🔒 Ваши данные в безопасности. Мы используем их только для связи по продаже телефона.",
                preview_price_label: "Примерная цена",
                result_submitted: "✅ Ваша заявка принята!",
                result_submitted_desc: "Мы свяжемся с вами в ближайшее время через выбранный способ. Будьте на связи.",
                result_summary: "📝 Итог заявки", go_home: "← На главную",
                contact_address: "Адрес забора", contact_payment: "Способ оплаты",
                pay_cash: "Наличные (KRW)", pay_bank: "Банковский перевод",
                bank_account: "Реквизиты банковского счета", bank_account_ph: "Название банка, номер счета, владелец"
            },
            ko: {
                back: "이전", brand_title: "어떤 브랜드의 폰인가요?", brand_desc: "판매하실 제품의 제조사를 선택해주세요",
                series_title: "시리즈를 선택해주세요", series_desc: "모델 라인을 선택해주세요",
                subseries_title: "세부 시리즈를 선택해주세요",
                model_title: "모델을 선택해주세요", model_desc: "정확한 모델을 선택해주세요",
                storage_title: "용량을 선택해주세요",
                defect_title: "폰 상태를 확인해주세요", defect_desc: "해당 사항이 있으면 ON으로 전환해주세요",
                see_price: "예상 매입가 확인 →",
                result_title: "예상 매입가", result_label: "예상 매입 금액",
                apply_now: "매입 신청하기 →",
                result_notice: "💡 이 가격은 예상 금액입니다. 최종 가격은 검수 후 확정됩니다.",
                apply_title: "📝 매입 신청", apply_desc: "이 섹션은 준비 중입니다.",
                apply_coming_soon: "외국인 신청 양식을 준비 중입니다.\n아래 채팅이나 이메일로 문의해주세요.",
                opened: "개봉 여부", opened_d: "박스 개봉 상태",
                crack: "파손/찍힘", crack_d: "외관 물리적 손상",
                lcd: "LCD 손상", lcd_d: "번인, 불량 화소, 줄 생김",
                back_crack: "후면 유리 파손", back_crack_d: "뒷면 유리 깨짐",
                camera: "카메라 불량", camera_d: "렌즈 파손, 흐림, 고장",
                battery: "배터리 부풀음", battery_d: "배터리 팽창",
                power: "전원 불량", power_d: "전원이 켜지지 않음"
            }
        };
        
        let currentLang = 'en';
        let currentStep = 0;
        let phoneData = {};
        let allPrices = [];
        let selectedQuote = { brand: '', series: '', parentCategory: '', model: '', storage: '', defects: {} };
        
        // ─── 언어 적용 ───
        function applyLang(lang) {
            currentLang = lang;
            const t = T[lang] || T['en'];
            document.querySelectorAll('[data-i18n]').forEach(el => {
                const key = el.dataset.i18n;
                if (t[key]) el.textContent = t[key];
            });
            const badge = document.getElementById('current-lang-badge');
            const flags = { en: '🇺🇸', zh: '🇨🇳', vi: '🇻🇳', ja: '🇯🇵', ru: '🇷🇺', ko: '🇰🇷' };
            badge.textContent = `${flags[lang] || '🌍'} ${lang.toUpperCase()}`;
        }
        window.selectLang = function(lang) {
            applyLang(lang);
            // Google Translate 자동 적용 (쿠키 설정 + 리로드)
            if (lang !== 'ko') {
                triggerGoogleTranslate(lang);
                return; // 리로드되므로 여기서 종료
            }
            goToStep(1);
            buildDefectList();
        };
        
        // ─── 페이지 로드 시 lang 파라미터 확인 ───
        function checkUrlLang() {
            const params = new URLSearchParams(window.location.search);
            const lang = params.get('lang');
            if (lang && T[lang]) {
                currentLang = lang;
                applyLang(lang);
                buildDefectList();
                goToStep(1); // 언어 선택 건너뛰고 바로 브랜드 선택으로
            }
        }
        
        // ─── 스텝 이동 ───
        window.goToStep = function(step) {
            document.querySelectorAll('.fg-step').forEach(s => s.classList.remove('active'));
            const stepMap = { 0: 'fg-step-0', 1: 'fg-step-1', 2: 'fg-step-2', '2sub': 'fg-step-2sub', 3: 'fg-step-3', 4: 'fg-step-4', 5: 'fg-step-5', 6: 'fg-step-6', 7: 'fg-step-7' };
            const el = document.getElementById(stepMap[step]);
            if (el) el.classList.add('active');
            currentStep = step;
            window.scrollTo({ top: 0, behavior: 'smooth' });
        };
        
        // ─── Firestore 데이터 로드 ───
        async function loadPhoneData() {
            try {
                const snap = await getDocs(collection(db, 'products'));
                snap.forEach(doc => {
                    allPrices.push({ id: doc.id, ...doc.data() });
                });
                console.log(`Loaded ${allPrices.length} products for foreigner page`);
                // 삼성 카테고리 분류 함수
                function getSamsungParentCategory(seriesName) {
                    if (!seriesName) return 'Others';
                    const s = seriesName.toUpperCase();
                    if (s.includes('폴드') || s.includes('FOLD') || s.includes('Z FOLD')) return 'Fold Series';
                    if (s.includes('플립') || s.includes('FLIP') || s.includes('Z FLIP')) return 'Flip Series';
                    if (s.includes('노트') || s.includes('NOTE')) return 'Note Series';
                    if (s.includes('S') && /[0-9]/.test(s) && !s.includes('플립') && !s.includes('폴드') && !s.includes('노트')) return 'S Series';
                    if ((s.includes('A') && /[0-9]/.test(s)) || s.includes('A 시리즈') || s.includes('A시리즈')) return 'A Series & Others';
                    return 'Others';
                }
                // 브랜드별 시리즈 추출
                phoneData.apple = {};
                phoneData.samsung = {};
                phoneData._samsungCatFn = getSamsungParentCategory;
                allPrices.forEach(p => {
                    const brand = (p.brand || '').toLowerCase();
                    const series = p.series || '';
                    if (brand === 'apple') {
                        if (!phoneData.apple[series]) phoneData.apple[series] = [];
                        phoneData.apple[series].push(p);
                    } else if (brand === 'samsung' || brand === '삼성') {
                        const parentCat = getSamsungParentCategory(series);
                        if (!phoneData.samsung[parentCat]) phoneData.samsung[parentCat] = {};
                        if (!phoneData.samsung[parentCat][series]) phoneData.samsung[parentCat][series] = [];
                        phoneData.samsung[parentCat][series].push(p);
                    }
                });
                console.log('Apple series:', Object.keys(phoneData.apple));
                console.log('Samsung categories:', Object.keys(phoneData.samsung));
            } catch (e) {
                console.error('Failed to load phone data:', e);
            }
        }
        
        // ─── 브랜드 선택 ───
        window.selectBrand = function(brand) {
            selectedQuote.brand = brand;
            renderSeries(brand);
            goToStep(2);
        };
        
        // ─── 시리즈 렌더 ───
        function renderSeries(brand) {
            const grid = document.getElementById('fg-series-grid');
            grid.innerHTML = '';
            if (brand === 'apple') {
                const seriesList = Object.keys(phoneData.apple || {});
                seriesList.forEach(s => {
                    const card = document.createElement('div');
                    card.className = 'selection-card';
                    card.innerHTML = `<div class="card-title">${s}</div>`;
                    card.onclick = () => { selectedQuote.series = s; renderModels(brand, s); goToStep(3); };
                    grid.appendChild(card);
                });
            } else {
                const cats = Object.keys(phoneData.samsung || {}).filter(c => c !== 'Others');
                cats.forEach(cat => {
                    const card = document.createElement('div');
                    card.className = 'selection-card';
                    card.innerHTML = `<div class="card-title">${cat}</div>`;
                    card.onclick = () => { selectedQuote.parentCategory = cat; renderSubSeries(cat); goToStep('2sub'); };
                    grid.appendChild(card);
                });
            }
            // 뒤로가기
            document.getElementById('fg-back-model').onclick = () => {
                if (brand === 'samsung') goToStep('2sub');
                else goToStep(2);
            };
        }
        
        function renderSubSeries(parentCat) {
            const grid = document.getElementById('fg-subseries-grid');
            grid.innerHTML = '';
            const subSeries = Object.keys(phoneData.samsung[parentCat] || {});
            subSeries.forEach(s => {
                const card = document.createElement('div');
                card.className = 'selection-card';
                card.innerHTML = `<div class="card-title">${s}</div>`;
                card.onclick = () => { selectedQuote.series = s; renderModels('samsung', s, parentCat); goToStep(3); };
                grid.appendChild(card);
            });
        }
        
        // ─── 모델 렌더 ───
        function renderModels(brand, series, parentCat) {
            const grid = document.getElementById('fg-model-grid');
            grid.innerHTML = '';
            let items = [];
            if (brand === 'apple') {
                items = phoneData.apple[series] || [];
            } else {
                const cat = parentCat || selectedQuote.parentCategory;
                items = (phoneData.samsung[cat] || {})[series] || [];
            }
            // 모델별 그룹 (같은 모델명이면 하나로)
            const modelMap = {};
            items.forEach(p => {
                const model = p.model || p.name || '';
                if (!modelMap[model]) modelMap[model] = p;
            });
            // 가격순 정렬
            const sorted = Object.entries(modelMap).sort((a, b) => (b[1].basePrice || 0) - (a[1].basePrice || 0));
            sorted.forEach(([model, p]) => {
                const card = document.createElement('div');
                card.className = 'selection-card';
                card.style.flexDirection = 'row';
                card.style.justifyContent = 'space-between';
                card.style.padding = '16px 20px';
                const priceText = p.basePrice ? new Intl.NumberFormat('ko-KR').format(p.basePrice) + '₩~' : '';
                card.innerHTML = `<div><div class="card-title">${model}</div></div>${priceText ? '<div style="font-size:0.8rem;color:#2563eb;font-weight:700;">' + priceText + '</div>' : ''}`;
                card.onclick = () => {
                    selectedQuote.model = model;
                    selectedQuote._modelData = p;
                    const storageOpts = p.storageOptions || [];
                    if (brand === 'samsung' && storageOpts.length === 0) {
                        // 삼성은 용량 옵션 없으면 바로 하자로
                        selectedQuote.storage = '기본';
                        selectedQuote._storageAdj = 0;
                        selectedQuote._priceData = p;
                        goToStep(5);
                    } else if (storageOpts.length === 0) {
                        // 애플도 옵션 없으면 바로 하자로
                        selectedQuote.storage = '기본';
                        selectedQuote._storageAdj = 0;
                        selectedQuote._priceData = p;
                        goToStep(5);
                    } else {
                        renderStorage(p);
                        goToStep(4);
                    }
                };
                grid.appendChild(card);
            });
        }
        
        // ─── 용량 렌더 (storageOptions 기반) ───
        function renderStorage(modelData) {
            const grid = document.getElementById('fg-storage-grid');
            grid.innerHTML = '';
            const options = modelData.storageOptions || [{ size: 'Default', priceAdjustment: 0 }];
            options.forEach(opt => {
                const card = document.createElement('div');
                card.className = 'selection-card';
                const adjText = opt.priceAdjustment > 0 ? `+${new Intl.NumberFormat('ko-KR').format(opt.priceAdjustment)}₩` : 
                               opt.priceAdjustment < 0 ? `${new Intl.NumberFormat('ko-KR').format(opt.priceAdjustment)}₩` : '';
                const totalPrice = (modelData.basePrice || 0) + (opt.priceAdjustment || 0);
                card.innerHTML = `
                    <div class="card-title">${opt.size}</div>
                    ${adjText ? '<div style="font-size:0.75rem;color:#64748b;margin-top:4px;">' + adjText + '</div>' : ''}
                    <div style="font-size:0.85rem;color:#2563eb;font-weight:700;margin-top:6px;">${new Intl.NumberFormat('ko-KR').format(totalPrice)}₩</div>
                `;
                card.onclick = () => {
                    selectedQuote.storage = opt.size;
                    selectedQuote._storageAdj = opt.priceAdjustment || 0;
                    selectedQuote._priceData = modelData;
                    goToStep(5);
                };
                grid.appendChild(card);
            });
        }
        
        // ─── 하자 체크리스트 ───
        function buildDefectList() {
            const t = T[currentLang] || T['en'];
            const defects = [
                { key: 'opened', label: t.opened, desc: t.opened_d },
                { key: 'crack', label: t.crack, desc: t.crack_d },
                { key: 'lcd', label: t.lcd, desc: t.lcd_d },
                { key: 'back_crack', label: t.back_crack, desc: t.back_crack_d },
                { key: 'camera', label: t.camera, desc: t.camera_d },
                { key: 'battery', label: t.battery, desc: t.battery_d },
                { key: 'power', label: t.power, desc: t.power_d }
            ];
            const container = document.getElementById('fg-defect-list');
            container.innerHTML = '';
            selectedQuote.defects = {};
            defects.forEach(d => {
                selectedQuote.defects[d.key] = false;
                const item = document.createElement('div');
                item.className = 'defect-item';
                item.innerHTML = `
                    <div>
                        <div class="defect-label">${d.label}</div>
                        <div class="defect-desc">${d.desc}</div>
                    </div>
                    <div class="defect-toggle"></div>
                `;
                item.onclick = () => {
                    item.classList.toggle('checked');
                    selectedQuote.defects[d.key] = item.classList.contains('checked');
                };
                container.appendChild(item);
            });
        }
        
        // ─── 하자 → 연락처 페이지로 ───
        let selectedMethod = 'phone';
        
        window.showResult = function() {
            // 가격 미리 계산
            const p = selectedQuote._priceData;
            let price = 0;
            if (p) {
                price = (p.basePrice || 0) + (selectedQuote._storageAdj || 0);
                const defectCount = Object.values(selectedQuote.defects).filter(v => v).length;
                if (defectCount > 0) price = Math.round(price * (1 - defectCount * 0.08));
                if (price < 0) price = 0;
            }
            
            document.getElementById('fg-preview-price').textContent = new Intl.NumberFormat('ko-KR').format(price) + ' ₩';
            document.getElementById('fg-preview-model').textContent = `${selectedQuote.brand === 'apple' ? 'Apple' : 'Samsung'} ${selectedQuote.model} ${selectedQuote.storage}`;
            
            goToStep(6);
        };
        
        // ─── 연락 방법 선택 ───
        window.selectContactMethod = function(method) {
            selectedMethod = method;
            const methods = document.querySelectorAll('#fg-contact-methods .contact-method-btn');
            methods.forEach(m => {
                if (m.dataset.method === method) {
                    m.style.borderColor = '#2563eb';
                    m.style.background = '#eff6ff';
                    m.classList.add('selected');
                } else {
                    m.style.borderColor = '#e2e8f0';
                    m.style.background = 'white';
                    m.classList.remove('selected');
                }
            });
            // 라벨 & placeholder 변경
            const label = document.getElementById('fg-contact-label');
            const input = document.getElementById('fg-contact-value');
            const placeholders = {
                phone: { label: 'Phone Number', ph: '+82 010-1234-5678' },
                whatsapp: { label: 'WhatsApp Number', ph: '+82 010-1234-5678' },
                wechat: { label: 'WeChat ID', ph: 'Your WeChat ID' },
                line: { label: 'LINE ID', ph: 'Your LINE ID' },
                kakaotalk: { label: 'KakaoTalk ID', ph: 'Your KakaoTalk ID or phone number' },
                email: { label: 'Email Address', ph: 'your@email.com' }
            };
            const info = placeholders[method] || placeholders.phone;
            label.textContent = info.label;
            input.placeholder = info.ph;
            input.type = method === 'email' ? 'email' : 'text';
        };
        
        // ─── 결제 방법 선택 ───
        let selectedPaymentMethod = 'cash';
        window.selectPaymentMethod = function(method) {
            selectedPaymentMethod = method;
            const methods = document.querySelectorAll('#fg-payment-methods .payment-method-btn');
            methods.forEach(m => {
                if (m.dataset.method === method) {
                    m.style.borderColor = '#2563eb';
                    m.style.background = '#eff6ff';
                    m.classList.add('selected');
                } else {
                    m.style.borderColor = '#e2e8f0';
                    m.style.background = 'white';
                    m.classList.remove('selected');
                }
            });
            
            // 계좌 입력창 보이기/숨기기
            const bankDiv = document.getElementById('fg-bank-account-div');
            const bankInput = document.getElementById('fg-bank-account');
            if (method === 'bank') {
                bankDiv.style.display = 'block';
                const t = T[currentLang] || T['en'];
                bankInput.placeholder = t.bank_account_ph || "Bank Name, Account Number, Account Holder";
            } else {
                bankDiv.style.display = 'none';
                bankInput.value = ''; // 초기화
            }
        };
        
        // ─── 연락처 제출 → 결과 ───
        window.submitContact = async function() {
            const name = document.getElementById('fg-name').value.trim();
            const contact = document.getElementById('fg-contact-value').value.trim();
            const address = document.getElementById('fg-address').value.trim();
            
            if (!name) {
                document.getElementById('fg-name').style.borderColor = '#ef4444';
                document.getElementById('fg-name').focus();
                return;
            }
            if (!contact) {
                document.getElementById('fg-contact-value').style.borderColor = '#ef4444';
                document.getElementById('fg-contact-value').focus();
                return;
            }
            if (!address) {
                document.getElementById('fg-address').style.borderColor = '#ef4444';
                document.getElementById('fg-address').focus();
                return;
            }
            
            // 버튼 상태 변경 (로딩 중)
            const submitBtn = document.querySelector('#fg-step-6 .fg-btn-primary');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Processing...';
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.7';

            // 가격 계산
            const p = selectedQuote._priceData;
            let price = 0;
            if (p) {
                price = (p.basePrice || 0) + (selectedQuote._storageAdj || 0);
                const defectCount = Object.values(selectedQuote.defects).filter(v => v).length;
                if (defectCount > 0) price = Math.round(price * (1 - defectCount * 0.08));
                if (price < 0) price = 0;
            }
            document.getElementById('fg-price').textContent = new Intl.NumberFormat('ko-KR').format(price) + ' ₩';
            document.getElementById('fg-model-summary').textContent = `${selectedQuote.brand === 'apple' ? 'Apple' : 'Samsung'} ${selectedQuote.model} ${selectedQuote.storage}`;
            
            // 요약 정보
            const defectList = Object.entries(selectedQuote.defects).filter(([k,v]) => v).map(([k]) => k);
            const methodIcons = { phone: '📱', whatsapp: '💬', wechat: '🟢', line: '🟩', kakaotalk: '💛', email: '📧' };
            const paymentIcon = selectedPaymentMethod === 'cash' ? '💵' : '🏦';
            let paymentText = selectedPaymentMethod === 'cash' ? 'Cash' : 'Bank Transfer';
            
            const bankAccount = document.getElementById('fg-bank-account').value.trim();
            if (selectedPaymentMethod === 'bank') {
                if (!bankAccount) {
                    document.getElementById('fg-bank-account').style.borderColor = '#ef4444';
                    document.getElementById('fg-bank-account').focus();
                    return;
                }
                paymentText += ` (${bankAccount})`;
            }

            // 버튼 상태 변경 (로딩 중)
            const submitBtn = document.querySelector('#fg-step-6 .fg-btn-primary');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Processing...';
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.7';

            document.getElementById('fg-summary-details').innerHTML = `
                <div>📱 <strong>Device:</strong> ${selectedQuote.brand === 'apple' ? 'Apple' : 'Samsung'} ${selectedQuote.model} ${selectedQuote.storage}</div>
                <div>🔍 <strong>Issues:</strong> ${defectList.length === 0 ? 'None' : defectList.join(', ')}</div>
                <div>👤 <strong>Name:</strong> ${name}</div>
                <div>${methodIcons[selectedMethod] || '📱'} <strong>${selectedMethod.charAt(0).toUpperCase() + selectedMethod.slice(1)}:</strong> ${contact}</div>
                <div>📍 <strong>Address:</strong> ${address}</div>
                <div>${paymentIcon} <strong>Payment:</strong> ${paymentText}</div>
            `;
            
            const payload = {
                brand: selectedQuote.brand === 'apple' ? 'Apple' : 'Samsung',
                model: { model: selectedQuote.model },
                storage: { size: selectedQuote.storage },
                defects: selectedQuote.defects,
                name: name,
                contactMethod: selectedMethod,
                phone: contact, // 통일성을 위해 phone 필드 사용 (실제론 메신저 ID일수도 있음)
                address: address,
                paymentMethod: selectedPaymentMethod,
                bankAccount: bankAccount,
                finalPrice: price,
                language: currentLang,
                status: 'pending',
                isForeigner: true, // 외국인 신청건 구분 플래그
                timestamp: new Date().toISOString()
            };
            
            try {
                // Firestore 저장
                await addDoc(collection(db, 'quotes'), payload);
                
                // Telegram 알림 전송
                const telegramMsg = `
[🌍 외국인 매입 신청]
👤 이름: ${payload.name}
${methodIcons[selectedMethod]} 연락처(${selectedMethod}): ${payload.phone}
📍 주소: ${payload.address}
${paymentIcon} 입금방식: ${paymentText}
🗣️ 언어: ${payload.language.toUpperCase()}

📱 기종: ${payload.brand} ${payload.model.model} (${payload.storage.size})
💰 예상매입가: ${new Intl.NumberFormat('ko-KR').format(price)} 원
🔍 체크된 하자: ${defectList.length === 0 ? '없음' : defectList.join(', ')}
`;
                fetch('https://asia-northeast3-rejeuphone.cloudfunctions.net/telegramApi/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: telegramMsg })
                }).catch(e => console.error('Telegram API Error:', e));

                goToStep(7);
            } catch (error) {
                console.error('Submission failed:', error);
                alert('Submission failed. Please try again or contact us directly.');
            } finally {
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
                submitBtn.style.opacity = '1';
            }
        };
        
        // ─── 초기화 ───
        loadPhoneData().then(() => {
            checkUrlLang();
        });
    