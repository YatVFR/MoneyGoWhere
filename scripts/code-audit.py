#!/usr/bin/env python3
from pathlib import Path
import re
import sys

ROOT=Path(__file__).resolve().parents[1]
TOP_JS=sorted(ROOT.glob('*.js'))
SCAN_FILES=[*TOP_JS,ROOT/'index.html']
texts={p:p.read_text(encoding='utf-8') for p in SCAN_FILES if p.exists()}

ref_re=re.compile(r'(?:src\s*=\s*["\']|["\'](?:\./)?)([A-Za-z0-9_.\-/]+\.js)(?:[?"\'])')
refs=set()
for text in texts.values():
    refs.update(Path(m.group(1)).name for m in ref_re.finditer(text))

entrypoints={'app.js','service-worker.js'}
unreferenced=sorted(p.name for p in TOP_JS if p.name not in refs and p.name not in entrypoints)
missing=sorted(name for name in refs if not (ROOT/name).exists())

index=texts.get(ROOT/'index.html','')
build_match=re.search(r"const\s+BUILD=['\"]([^'\"]+)['\"]",index)
build=build_match.group(1) if build_match else ''
current_release_elsewhere=[]
if build:
    for p,text in texts.items():
        if p.name!='index.html' and build in text:
            current_release_elsewhere.append(p.name)

suspicious_patterns={
    'hard-coded sample merchant/location':re.compile(r'NTUC\s+FairPrice|Tampines\s+Mall',re.I),
    'blocking startup sync dialog':re.compile(r'mgwStartupSyncDialog'),
}
suspicious=[]
for label,pat in suspicious_patterns.items():
    for p,text in texts.items():
        if pat.search(text):suspicious.append((label,p.name))

sw_register=[p.name for p,text in texts.items() if 'navigator.serviceWorker.register' in text]
release_re=re.compile(r'1\.5\.5-dev\.\d+(?:[-.][A-Za-z0-9]+)*')
provenance=[]
for p,text in texts.items():
    vals=sorted(set(release_re.findall(text)))
    if vals:provenance.append((p.name,vals))

print('=== MoneyGoWhere code audit ===')
print(f'Current build: {build or "not detected"}')
print(f'Top-level JS files: {len(TOP_JS)}')
print(f'Referenced JS files: {len(refs)}')
print('Potentially unreferenced top-level JS:', ', '.join(unreferenced) if unreferenced else 'none')
print('Missing referenced JS:', ', '.join(missing) if missing else 'none')
print('Current build hard-coded outside index:', ', '.join(current_release_elsewhere) if current_release_elsewhere else 'none')
print('Suspicious residue:', ', '.join(f'{label} in {path}' for label,path in suspicious) if suspicious else 'none')
print('Service worker registration sites:', ', '.join(sw_register) if sw_register else 'none')
print('Feature provenance release labels:')
for path,vals in provenance:
    if path!='index.html':print(f'  - {path}: {", ".join(vals)}')

errors=[]
if unreferenced:errors.append('unreferenced top-level JavaScript remains')
if missing:errors.append('runtime references missing JavaScript')
if current_release_elsewhere:errors.append('current app version is duplicated outside index.html')
if suspicious:errors.append('hard-coded or blocking startup residue remains')
if sw_register!=['index.html']:errors.append('service worker registration is not owned solely by index.html')
if errors:
    print('AUDIT FAILED:')
    for error in errors:print(f'  - {error}')
    sys.exit(1)
print('AUDIT PASSED')
