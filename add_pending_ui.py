import re

def update_delivery_info(file_path, is_guest=False):
    with open(file_path, 'r', encoding='utf-8') as f:
        js = f.read()

    # Find where deliveryInfo is set
    target = """        if (data.deliveryMethod === 'cvs') {
            deliveryInfo = '<br><span style="font-size: 0.8rem; color: #ff9800; margin-top: 4px; display: inline-block;">[직접발송]</span>';
            if (data.shippingFeePaid) {
                deliveryInfo += `<br><span style="font-size: 0.8rem; color: #2E7D32; font-weight: 600; margin-top: 4px; display: inline-block;">✅ 배송비 입금 완료</span>`;
            }
        } else if (data.deliveryMethod === 'courier') {
            deliveryInfo = `<br><span style="font-size: 0.8rem; color: #4CAF50; margin-top: 4px; display: inline-block;">[방문수거] (희망일: ${data.pickupDate || '미정'})</span>`;
        }"""
        
    replacement = """        if (data.deliveryMethod === 'cvs') {
            deliveryInfo = '<br><span style="font-size: 0.8rem; color: #ff9800; margin-top: 4px; display: inline-block;">[직접발송]</span>';
            if (data.shippingFeePaid) {
                deliveryInfo += `<br><span style="font-size: 0.8rem; color: #2E7D32; font-weight: 600; margin-top: 4px; display: inline-block;">✅ 배송비 입금 완료</span>`;
            }
        } else if (data.deliveryMethod === 'courier') {
            deliveryInfo = `<br><span style="font-size: 0.8rem; color: #4CAF50; margin-top: 4px; display: inline-block;">[방문수거] (희망일: ${data.pickupDate || '미정'})</span>`;
        } else if (data.deliveryMethod === 'pending') {
            deliveryInfo = `<br><span style="font-size: 0.85rem; color: #e11d48; font-weight: 700; margin-top: 4px; display: inline-block;">[배송 방법 미입력]</span>`;
        }"""
        
    js = js.replace(target, replacement)
    
    # In mypage.html, dispatchBtnHtml is at line 1717.
    # In guest.js, it's at line 181.
    if is_guest:
        doc_id_var = "data.id"
    else:
        doc_id_var = "doc.id"
        
    target2 = """        let dispatchBtnHtml = '';
        if (data.deliveryMethod === 'cvs' && currentStatus === 'receipt') {"""
        
    replacement2 = f"""        let dispatchBtnHtml = '';
        if (data.deliveryMethod === 'pending') {{
            dispatchBtnHtml = `
                <div style="margin-top: 15px; text-align: center;">
                    <a href="quote.html?resume_doc_id=${{{doc_id_var}}}" style="width: 100%; padding: 12px; background: #e11d48; color: #fff; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; text-decoration: none; box-shadow: 0 4px 6px rgba(225, 29, 72, 0.2);">
                        <span class="material-symbols-outlined" style="font-size: 1.1rem;">local_shipping</span>
                        기기 발송 방법 확정하기
                    </a>
                </div>
            `;
        }} else if (data.deliveryMethod === 'cvs' && currentStatus === 'receipt') {{"""
        
    js = js.replace(target2, replacement2)
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(js)
    print(f"Updated {file_path}")

update_delivery_info('mypage.html', is_guest=False)
update_delivery_info('guest.js', is_guest=True)

