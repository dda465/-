import os
import glob

html_files = ["index.html", "mypage.html", "quote.html", "reviews.html", "signup.html", "login.html", "guest.html"]

script_to_inject = """
    <!-- Policy Modal Script -->
    <script>
    window.openPolicyModal = function(url, title) {
        event.preventDefault();
        let modal = document.getElementById('policy-modal');
        if (!modal) {
            document.body.insertAdjacentHTML('beforeend', `
            <div id="policy-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:99999; align-items:center; justify-content:center; padding: 20px; box-sizing: border-box;">
               <div style="background:white; width:100%; max-width:800px; height:85vh; border-radius:12px; overflow:hidden; display:flex; flex-direction:column; box-shadow: 0 10px 30px rgba(0,0,0,0.3);">
                  <div style="padding: 15px 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; background: #f8f9fa;">
                      <h3 id="policy-modal-title" style="margin: 0; font-size: 1.1rem; color: #333; font-weight: bold;">약관</h3>
                      <button onclick="document.getElementById('policy-modal').style.display='none'" style="background:none; border:none; font-size: 28px; line-height:1; cursor:pointer; color: #666;">&times;</button>
                  </div>
                  <iframe id="policy-iframe" src="" style="flex:1; width:100%; border:none; background:white;"></iframe>
               </div>
            </div>
            `);
            modal = document.getElementById('policy-modal');
            modal.addEventListener('click', function(e) {
                if (e.target === modal) modal.style.display = 'none';
            });
        }
        document.getElementById('policy-modal-title').innerText = title;
        document.getElementById('policy-iframe').src = url;
        modal.style.display = 'flex';
    };
    </script>
"""

for f in html_files:
    if not os.path.exists(f): continue
    with open(f, 'r', encoding='utf-8') as file:
        content = file.read()
    
    # Check if we already injected the modal script
    if "openPolicyModal" not in content:
        # Inject script right before </body>
        if "</body>" in content:
            content = content.replace("</body>", f"{script_to_inject}\n</body>", 1)
        
        # Replace the links
        old_terms_link1 = '<a href="terms.html"'
        new_terms_link1 = '<a href="#" onclick="openPolicyModal(\'terms.html\', \'이용약관\')"'
        
        old_privacy_link1 = '<a href="privacy.html"'
        new_privacy_link1 = '<a href="#" onclick="openPolicyModal(\'privacy.html\', \'개인정보처리방침\')"'

        content = content.replace(old_terms_link1, new_terms_link1)
        content = content.replace(old_privacy_link1, new_privacy_link1)
        
        with open(f, 'w', encoding='utf-8') as file:
            file.write(content)
        print(f"Injected modal script and links into {f}")
    else:
        print(f"Modal script already exists in {f}")
