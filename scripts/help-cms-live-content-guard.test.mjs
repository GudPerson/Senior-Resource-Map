import test from 'node:test';import assert from 'node:assert/strict';
import { assertCmsContentNotReverted } from './help-cms-live-content-guard.mjs';
test('ordinary deploy cannot restore old build-time content after CMS publication',()=>{
 const live={version:'2026-10-03.help-cms.1',contentDigest:'a'};
 assert.throws(()=>assertCmsContentNotReverted({version:'.6',contentDigest:'b'},live),/newer CMS content/);
 assert.throws(()=>assertCmsContentNotReverted({...live,contentDigest:'b'},live),/newer CMS content/);
 assert.doesNotThrow(()=>assertCmsContentNotReverted(live,live));
 assert.doesNotThrow(()=>assertCmsContentNotReverted({}, {version:'2026-10-02.help-centre.6'}));
 assert.throws(()=>assertCmsContentNotReverted({},null),/could not be verified/);
});
