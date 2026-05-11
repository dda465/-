const fs = require('fs');
const appendage = `
// --- Pre-sale Modal Controllers ---
window.openPresaleModal = () => {
    document.getElementById('presale-modal').style.display = 'flex';
    window.presaleShowStep(1);
};
window.closePresaleModal = () => {
    document.getElementById('presale-modal').style.display = 'none';
    setTimeout(() => window.presaleShowStep(1), 300);
};
window.presaleShowStep = (step) => {
    const brand = currentQuote && currentQuote.brand ? currentQuote.brand : 'apple';
    const isApple = brand !== 'samsung';
    
    const step1Apple = document.getElementById('presale-step-1-apple');
    const step1Samsung = document.getElementById('presale-step-1-samsung');
    const step2 = document.getElementById('presale-step-2');
    const btnPrev = document.getElementById('p-btn-prev');
    const btnNext = document.getElementById('p-btn-next');
    const dot1 = document.getElementById('p-dot-1');
    const dot2 = document.getElementById('p-dot-2');

    if(step === 1) {
        if(step1Apple) step1Apple.style.display = isApple ? 'block' : 'none';
        if(step1Samsung) step1Samsung.style.display = isApple ? 'none' : 'block';
        if(step2) step2.style.display = 'none';
        if(btnPrev) btnPrev.style.display = 'none';
        if(btnNext) btnNext.textContent = '동의 후 다음';
        
        if(dot1) dot1.classList.add('active');
        if(dot2) dot2.classList.remove('active');
    } else {
        if(step1Apple) step1Apple.style.display = 'none';
        if(step1Samsung) step1Samsung.style.display = 'none';
        if(step2) step2.style.display = 'block';
        if(btnPrev) btnPrev.style.display = 'block';
        if(btnNext) btnNext.textContent = '동의 및 최종 신청완료';
        
        if(dot1) dot1.classList.remove('active');
        if(dot2) dot2.classList.add('active');
    }
};
window.presaleGoNext = () => {
    const step2 = document.getElementById('presale-step-2');
    if(step2 && step2.style.display === 'none') {
        window.presaleShowStep(2);
    } else {
        window.closePresaleModal();
        if (typeof handleFinalSubmit === 'function') {
            handleFinalSubmit(); 
        } else if (typeof window.handleFinalSubmit === 'function') {
            window.handleFinalSubmit();
        } else {
            console.error('handleFinalSubmit is not defined globally.');
            alert('제출 함수를 찾을 수 없습니다.');
        }
    }
};
window.presaleGoPrev = () => {
    window.presaleShowStep(1);
};
`;

fs.appendFileSync('script.js', '\n' + appendage + '\n', 'utf8');
console.log('Appended modal functions to script.js');
