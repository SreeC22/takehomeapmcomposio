// Run: node scripts/assignment-readiness-regression.js
// Zero external dependencies. Tests share-link portability and code syntax.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
for (const file of ['app.js', 'api/research.js', 'api/research-helpers.js', 'api/managed-auth.js']) {
  new vm.Script(fs.readFileSync(path.join(root, file), 'utf8'), {filename:file});
}
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const prefix = app.slice(0, app.indexOf("document.getElementById('search').addEventListener"));
assert(prefix.includes('compactGuideForShare'), 'Share helper must remain available');
const browserGlobals = {
  TextEncoder, TextDecoder, CompressionStream, DecompressionStream, Response, Blob,
  Uint8Array, btoa, atob,
};
const {compactGuideForShare, encodeSharedGuide, decodeSharedGuide, agentHandoff} = vm.runInNewContext(
  prefix + '\n({compactGuideForShare,encodeSharedGuide,decodeSharedGuide,agentHandoff})',
  browserGlobals, {timeout:2000}
);
(async () => {
  const guide = {
    id:'generated-example', name:'Example Provider',guideType:'partial',authType:'oauth',
    verificationStatus:'Partially verified, not sign-in tested',
    nextStep:'Open the official registration instructions',
    sources:['https://docs.example.org/oauth'],
    steps:[{title:'Register app',detail:'Open verified docs and configure only confirmed OAuth fields.',who:'human',
      requirement:'unknown',evidence:'Documentation only; setup not attempted'}],
    agentOutput:{attempted:['searched documentation'],notAttempted:['provider login']},
    claims:Array.from({length:100},(_,i)=>({claim:i,evidence:'Long duplicated statement '.repeat(30)})),
    executionLog:Array.from({length:40},(_,i)=>({action:'fetch_page',status:'ok',detail:'Read official documentation '+i})),
    timeline:[],checklist:[],blockers:[],requirements:[]
  };
  const compact = compactGuideForShare(guide);
  assert(!Object.hasOwn(compact, 'claims'), 'Raw claim dump must not inflate the share URL');
  assert.equal(compact.executionLog.length,12);
  assert.deepEqual(JSON.parse(JSON.stringify(compact.agentOutput)),guide.agentOutput);
  const code = await encodeSharedGuide(guide);
  assert(code.startsWith('gz.'), 'Supported browser should compress shared guide');
  const decoded = await decodeSharedGuide(code);
  assert.equal(decoded.name,guide.name);
  assert.equal(decoded.steps[0].title,guide.steps[0].title);
  assert.equal(decoded.sources[0],guide.sources[0]);
  assert(code.length < JSON.stringify(guide).length/3, 'URL snapshot should be substantially smaller than untrimmed JSON');
  const handoff = agentHandoff(guide);
  assert(handoff.includes('HUMAN TAKEOVER:'));
  assert(handoff.includes('https://docs.example.org/oauth'));
  console.log('Assignment readiness regression: PASS; compressed share characters='+code.length);
})().catch(error=>{console.error(error); process.exitCode=1;});
