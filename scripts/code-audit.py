#!/usr/bin/env python3
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
TOP_JS = sorted(ROOT.glob('*.js'))
TEXT_FILES = [p for p in ROOT.rglob('*') if p.is_file() and '.git' not in p.parts and p.suffix.lower() in {'.js','.html','.css','.json','.md','.yml','.yaml'}]

texts = {}
for p in TEXT_FILES:
    try:
        texts[p] = p.read_text(encoding='utf-8')
    except UnicodeDecodeError:
        continue

ref_re = re.compile(r'(?:src\s*=\s*["\']|["\'](?:\./)?)([A-Za-z0-9_.\-/]+\.js)(?:[?"\'])')
refs = set()
for p, text in texts.items():
    for m in ref_re.finditer(text):
        refs.add(Path(m.group(1)).name)

entrypoints = {'app.js','service-worker.js'}
unreferenced = sorted(p.name for p in TOP_JS if p.name not in refs and p.name not in entrypoints)

release_re = re.compile(r'1\.5\.5-dev\.\d+(?:[-.][A-Za-z0-9]+)*')
release_hits = []
for p, text in texts.items():
    if p.name == 'README.md':
        continue
    vals = sorted(set(release_re.findall(text)))
    if vals:
        release_hits.append((str(p.relative_to(ROOT)), vals))

suspicious_patterns = {
    'legacy finance source marker': re.compile(r'legacy_finance_pdf|FINANCES-2022\.pdf|LEGACY-[0-9]{4}-[0-9]{2}-(?:INCOME|SAVINGS|DBS-LOAN|OCBC-LOAN|SC-LOAN)', re.I),
    'hard-coded sample merchant/location': re.compile(r'NTUC\s+FairPrice|Tampines\s+Mall', re.I),
    'blocking startup sync dialog': re.compile(r'mgwStartupSyncDialog'),
}

suspicious = []
for label, pat in suspicious_patterns.items():
    for p, text in texts.items():
        if pat.search(text):
            suspicious.append((label, str(p.relative_to(ROOT))))

sw_register = []
for p, text in texts.items():
    if 'navigator.serviceWorker.register' in text:
        sw_register.append(str(p.relative_to(ROOT)))

print('=== MoneyGoWhere code audit ===')
print(f'Top-level JS files: {len(TOP_JS)}')
print(f'JS files referenced by source/index strings: {len(refs)}')
print('\nPotentially unreferenced top-level JS:')
for name in unreferenced:
    print(f'  - {name}')
print('\nHard-coded release literals:')
for path, vals in release_hits:
    print(f'  - {path}: {", ".join(vals)}')
print('\nSuspicious residue markers:')
if suspicious:
    for label, path in suspicious:
        print(f'  - {label}: {path}')
else:
    print('  - none')
print('\nService worker registration sites:')
for path in sw_register:
    print(f'  - {path}')
print('=== End audit ===')
