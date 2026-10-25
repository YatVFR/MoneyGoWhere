import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const read=p=>fs.readFileSync(p,'utf8');
const index=read('index.html'),build=index.match(/const BUILD='([^']+)'/)[1],manifest=JSON.parse(read('manifest.json'));
assert.match(build,/^2\.0\.0-dev\.\d+$/);
assert.equal(manifest.name,'MoneyGoWhere DEV');assert.equal(manifest.short_name,'MGW DEV');assert.equal(manifest.theme_color,'#6d28d9');
for(const icon of manifest.icons)assert.ok(icon.src.endsWith('?v='+build));
assert.ok(read('style.css').includes('--brand:#6d28d9;--brand-soft:#ede9fe'));
assert.ok(read('version-badge-authority.js').includes('· DEV'));
assert.ok(read('service-worker.js').includes('moneygowhere-${ENV}-'));
assert.ok(read('app.js').includes('moneygowhere-db-v1'));
for(const [path,sha] of Object.entries({'assets/icons/icon.svg':'1c8840986067f4bf385a256533f56fa79cbb7f61','assets/icons/icon-192.png':'b7dbae3d0afb584f8467a26f69f526b990e6e1e8','assets/icons/icon-512.png':'3ebd1fc42df3b055ca39e116b6efdfa827c58da9','assets/icons/apple-touch-icon.png':'7ca7571a7ace85f5c7909b93febe8f283f63c62c'})){
 const bytes=fs.readFileSync(path);assert.equal(crypto.createHash('sha1').update(Buffer.concat([Buffer.from('blob '+bytes.length+'\0'),bytes])).digest('hex'),sha,path);
}
console.log('DEV identity regression passed: build, manifest, palette, badge, icon hashes and cache namespace preserved.');
