import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
const source = new URL('../', import.meta.url);
const read = (name) => readFile(new URL(name, source), 'utf8');

test('app starts from Server and Docker copies the complete modular source', async () => {
  const pkg = JSON.parse(await read('package.json'));
  assert.equal(pkg.scripts.start, 'node Server/server.js');
  const docker = await read('Dockerfile');
  for (const folder of ['Models','Server','public','scripts','sql']) {
    assert.match(docker, new RegExp('^COPY '+folder+' \\./'+folder+'$', 'm'));
    await access(new URL(folder+'/', source));
  }
  assert.match(docker, /^CMD \["node", "Server\/server\.js"\]$/m);
  const server = await read('Server/server.js');
  assert.match(server, /\.\.\/Models\/pricing-profiles\.js/);
  assert.match(server, /new URL\('\.\.\/',import\.meta\.url\)/);
  const root = await readdir(source);
  assert.ok(!root.includes('source'), 'No old nested source tree');
  assert.deepEqual(root.filter(name => name.endsWith('.js')), []);
});
