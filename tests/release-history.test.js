import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {releases} from '../Models/release-history.js';

test('release history has unique readable records and starts with the package version', async()=>{
 const {version}=JSON.parse(await readFile(new URL('../package.json',import.meta.url)));
 assert.equal(releases[0].version,version);
 assert.equal(new Set(releases.map(item=>item.version)).size,releases.length);
 for(const release of releases){
  assert.ok(release.version&&release.title&&release.summary&&release.sections.length,release.version);
  for(const section of release.sections){
   assert.ok(section.title&&section.items.length,release.version);
   assert.ok(section.items.every(item=>typeof item==='string'&&item.trim()),release.version);
  }
 }
 assert.match(releases.find(item=>item.version==='0.6.9').title,/separate staging/);
 assert.match(releases.find(item=>item.version==='0.8.5.1').summary,/display-only/);
});
