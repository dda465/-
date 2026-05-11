import urllib.request
import os
import ssl

ssl._create_default_https_context = ssl._create_unverified_context

project_id = "rejeuphone"
base_url = f"https://{project_id}.web.app"
files = {
    'index.html': '/',
    'privacy.html': '/privacy.html',
    'admin.html': '/admin.html',
    'mypage.html': '/mypage.html',
    'quote.html': '/quote.html'
}

cwd = r"c:\Users\PC\Desktop\used-phone-market"

for local_file, path in files.items():
    url = f"{base_url}{path}"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            html = response.read()
            # Assuming utf-8 for saving
            with open(os.path.join(cwd, local_file), 'wb') as f:
                f.write(html)
        print(f"Successfully recovered {local_file} from {url}")
    except Exception as e:
        print(f"Failed to recover {local_file} from {url}: {e}")
