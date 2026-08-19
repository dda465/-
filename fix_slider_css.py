import re

with open('styles.css', 'r', encoding='utf-8') as f:
    css = f.read()

new_css = """
/* Hero Custom Slider styling */
.hero-slider-wrapper {
    width: 100%;
    position: relative;
    overflow: hidden;
    background: var(--bg-primary);
}

#hero-slider {
    display: flex;
    width: 200%;
    transition: transform 0.5s ease-in-out;
}

.hero-slide {
    width: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 500px;
}

.hero-slide .hero-container {
    width: 100%;
}
"""

if "hero-slider-wrapper" not in css:
    with open('styles.css', 'a', encoding='utf-8') as f:
        f.write(new_css)
    print("styles.css updated successfully!")
else:
    print("styles.css already contains slider specific rules.")
