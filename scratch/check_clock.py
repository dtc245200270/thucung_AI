import os
import re

clock_tag = re.compile(r'<\s*Clock[\s/>]')

for root, dirs, files in os.walk('src'):
    for f in files:
        if f.endswith(('.jsx', '.js')):
            p = os.path.join(root, f)
            with open(p, 'r', encoding='utf-8') as fp:
                code = fp.read()
            if clock_tag.search(code):
                # check if Clock is in imports
                if not re.search(r'\bClock\b', code.split('export')[0] if 'export' in code else code[:500]):
                    print('CRASH DETECTED: Uses <Clock> without import:', p)
                else:
                    print('OK: Uses <Clock> and imports it:', p)
