import os

def update_prototype():
    filepath = 'prototype_natural.html'
    if not os.path.exists(filepath):
        print(f"File {filepath} not found.")
        return

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    style_block = """
    <!-- Gmarket Sans Web Font -->
    <style>
        @font-face {
            font-family: 'GmarketSans';
            font-weight: 500;
            font-style: normal;
            src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2001@1.1/GmarketSansMedium.woff') format('woff');
        }
        @font-face {
            font-family: 'GmarketSans';
            font-weight: 700;
            font-style: normal;
            src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2001@1.1/GmarketSansBold.woff') format('woff');
        }

        /* Apply Gmarket Sans to key promotional titles */
        .hero-text-area h1,
        .usc-header h2,
        .section-title,
        .stat-value,
        .chip-price {
            font-family: 'GmarketSans', var(--font-main);
            letter-spacing: -0.5px;
        }

        /* Tweak for h1 specifically in the slider */
        .hero-text-area h1 {
            font-weight: 700 !important;
        }
    </style>
    """

    # Inject the style block before the closing </head>
    content = content.replace('</head>', style_block + '\n</head>')

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    update_prototype()
    print("Added Gmarket Sans styles to prototype_natural.html")
