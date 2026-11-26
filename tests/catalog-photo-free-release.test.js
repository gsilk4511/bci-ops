import assert from 'node:assert/strict';
import test from 'node:test';
import {existsSync,readFileSync} from 'node:fs';
import {seed} from '../Models/lib.js';
import {planCatalogPack,importCatalogPack} from '../Models/catalog-pack.js';

test('the release omits bundled photos but can import parts from older packs with valid photo references',()=>{
 assert.equal(existsSync(new URL('../Server/CatalogPhotos',import.meta.url)),false);
 assert.match(readFileSync(new URL('../.dockerignore',import.meta.url),'utf8'),/^Server\/CatalogPhotos$/m);
 const state=seed(), before=structuredClone(state.inventory);
 const pack={format:'bci-catalog-pack-v1',items:[{brand:'Fixture',mpn:'P-101',name:'Windowed faceplate',system:'Copper',partType:'Faceplate',
  photoId:'a'.repeat(64),photoStatus:'Exact'}],fitReferences:[]};
 const assets=new Set(), policy={omitUnavailablePhotos:true};
 const {summary}=planCatalogPack(state,pack,assets,policy);
 assert.equal(summary.new,1);
 assert.equal(summary.skipped,0);
 assert.equal(summary.photoCount,0);
 assert.equal(summary.omittedPhotoCount,1);
 importCatalogPack(state,{pack,fingerprint:summary.fingerprint},{role:'admin',email:'owner@example.invalid'},assets,policy);
 assert.equal(state.catalog.at(-1).name,'Windowed faceplate');
 assert.equal(state.catalog.at(-1).catalogInfo.photoId,undefined);
 assert.deepEqual(state.inventory,before);
});
