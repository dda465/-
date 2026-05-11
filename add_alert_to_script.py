import codecs

print("Adding alert to script.js...")
with codecs.open('script.js', 'r', 'utf-8', errors='ignore') as f:
    js_content = f.read()

target = r'''                if(typeof window.selectMethod === 'function') {
                    window.selectMethod('simple');
                } else {
                    console.error('window.selectMethod is not defined!');
                }
            }
        }
    };
    handleUrlSearch();'''

replacement = r'''                if(typeof window.selectMethod === 'function') {
                    window.selectMethod('simple');
                } else {
                    console.error('window.selectMethod is not defined!');
                }
            } else {
                alert('검색하신 기종("' + queryValue + '")을(를) 찾을 수 없습니다.\n정확한 모델명으로 다시 검색해주세요.');
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        }
    };
    handleUrlSearch();'''

if "alert('검색하신 기종(" not in js_content:
    if target in js_content:
        js_content = js_content.replace(target, replacement)
        with codecs.open('script.js', 'w', 'utf-8') as f:
            f.write(js_content)
        print("Alert added successfully.")
    else:
        print("Target string not found!")
else:
    print("Alert already exists.")
