import os
import glob

og_tags = """
    <!-- OpenGraph SEO Tags -->
    <meta property="og:title" content="쉐라폰 - 최고가 중고폰 매입 플랫폼">
    <meta property="og:description" content="사용하시던 중고폰, 집에서 편하게 최고가로 판매하세요. 1분만에 예상 매입가를 확인하고 당일 입금 받으세요!">
    <meta property="og:image" content="https://rejeuphone.web.app/sr_logo.png">
    <meta property="og:url" content="https://rejeuphone.web.app">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="쉐라폰">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="쉐라폰 - 최고가 중고폰 매입 플랫폼">
    <meta name="twitter:description" content="사용하시던 중고폰, 집에서 편하게 최고가로 판매하세요. 1분만에 예상 매입가를 확인하고 당일 입금 받으세요!">
    <meta name="twitter:image" content="https://rejeuphone.web.app/sr_logo.png">
"""

html_files = glob.glob("*.html")
for f in html_files:
    if "prototype" in f or "seed" in f or "backup" in f or f in ["google5428cdeecef480cb.html"]:
        continue
        
    with open(f, 'r', encoding='utf-8') as file:
        content = file.read()
        
    if 'property="og:title"' in content:
        print(f"Skipping {f}, already has OG tags.")
        continue
        
    # Inject before </head>
    if "</head>" in content:
        content = content.replace("</head>", f"{og_tags}\n</head>", 1)
        with open(f, 'w', encoding='utf-8') as file:
            file.write(content)
        print(f"Injected OG tags into {f}")
    else:
        print(f"Could not find </head> in {f}")

