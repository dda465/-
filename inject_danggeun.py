import glob

pixel_code = """
<!-- Danggeun Market Code -->
<script src="https://karrot-pixel.business.daangn.com/karrot-pixel.js"></script>
<script>
  window.karrotPixel.init('1778656966686481001');
  window.karrotPixel.track('ViewPage');
</script>
<!-- End Danggeun Market Code -->
"""

count = 0
for file_path in glob.glob('*.html'):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    if 'Danggeun Market Code' not in content and '</head>' in content:
        content = content.replace('</head>', pixel_code + '\n</head>')
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        count += 1
        
print(f"Injected Danggeun pixel into {count} HTML files.")
