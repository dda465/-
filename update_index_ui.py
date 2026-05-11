import re
import os

filepath = r"c:\Users\PC\Desktop\used-phone-market\index.html"
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove the welcome banner
# The banner is inside a div. We'll use regex to remove it.
# It starts with <div style="background: white; border-radius: 16px; padding: 25px; margin-bottom: 30px; box-shadow: 0 4px 15px rgba(0,0,0,0.03); border: 1px solid #e2e8f0; text-align: center;">
# and contains "안녕하세요, 쉐라폰 검수팀입니다!"

pattern_banner = re.compile(r'<div style="background: white;[^>]+>.*?👋 안녕하세요, 쉐라폰 검수팀입니다!.*?</div>', re.DOTALL)
content = pattern_banner.sub('', content)

# 2. Make sell-action prominent
css_replace_from = '''            .bottom-nav-item.sell-action { position: relative; top: -20px; }

            .bottom-nav-item.sell-action .icon-wrap {

                background: #2563EB; color: white; width: 62px; height: 62px;

                border-radius: 50%; display: flex; align-items: center; justify-content: center;

                box-shadow: 0 10px 25px rgba(37, 99, 235, 0.4); border: 5px solid white;

            }'''

css_replace_to = '''            @keyframes pulseGlow {
                0% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.7); }
                70% { box-shadow: 0 0 0 15px rgba(37, 99, 235, 0); }
                100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0); }
            }
            .bottom-nav-item.sell-action { position: relative; top: -25px; transform: scale(1.1); transition: transform 0.3s; }
            .bottom-nav-item.sell-action:active { transform: scale(0.95); }
            .bottom-nav-item.sell-action .icon-wrap {
                background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
                color: white; width: 68px; height: 68px;
                border-radius: 50%; display: flex; align-items: center; justify-content: center;
                border: 5px solid white;
                animation: pulseGlow 2s infinite;
            }'''

# Because spacing might vary, let's inject the keyframes and rewrite the .sell-action block if exact string replace fails.
# Actually, the exact string replace is risky with blank lines.
# Let's replace using regex.
pattern_sell_css = re.compile(r'\.bottom-nav-item\.sell-action\s*\{[^\}]+\}\s*\.bottom-nav-item\.sell-action\s*\.icon-wrap\s*\{[^\}]+\}')
content = pattern_sell_css.sub(css_replace_to, content)

# Let's double check if we can just append a style block to override it. It's safer.
override_style = '''
    <style>
        @keyframes pulseGlowUI {
            0% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.7); }
            70% { box-shadow: 0 0 0 15px rgba(37, 99, 235, 0); }
            100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0); }
        }
        @media (max-width: 768px) {
            .bottom-nav-item.sell-action { top: -25px !important; z-index: 1001; }
            .bottom-nav-item.sell-action .icon-wrap {
                width: 70px !important; height: 70px !important;
                background: linear-gradient(135deg, #2563EB 0%, #1E3A8A 100%) !important;
                border: 6px solid white !important;
                animation: pulseGlowUI 2s infinite !important;
            }
            .bottom-nav-item.sell-action span {
                font-size: 0.85rem !important;
                font-weight: 800 !important;
                color: #2563EB !important;
            }
        }
    </style>
'''
content = content.replace('</head>', override_style + '\n</head>')

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated index.html UI.")
