import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('release version matches deployment tags and has a logo-side badge',async()=>{
 const version=JSON.parse(await read('package.json')).version;
 assert.match(version,/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
 for(const path of ['docs/compose.secure.yml.example','docs/compose.secure.yml.unraid.example']){
  const image=(await read(path)).match(/^\s*image:\s*bci-operations:([^\s]+)\s*$/m);
  assert.equal(image?.[1],version,path+' must match package.json');
 }
 const header=(await read('public/index.html')).match(/<div class="brand">([\s\S]*?)<\/div>/)?.[1];
 assert.match(header,/<img src="\/logo\.png"/);
 assert.match(header,/id="appRelease">v\{\{BCI_RELEASE\}\}<\/span>/);
});
