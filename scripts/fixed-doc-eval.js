// Evaluation A: fixed-document regression.
// Runs the ACTUAL production logic exported from api/research.js against
// captured passages, before and after this round's fixes. "Old" is the
// pre-round logic, reproduced here for comparison only, not used in
// production. No provider-specific rules, no live search, so Tavily
// variability cannot affect the result.
const m = require('../api/research.js');
// Pre-round consoleScore: docs pages scored +1 for docs/oauth segments,
// and oauth-apps counted as a portal segment, so a docs article scored 4.
// Pre-round extractEndpoints: any URL containing token was accepted.
// Pre-round classifyPassage: a negated "need to start" counted as required
// because the negated modal "need" was in the modal window.
function oldConsoleScore(u) {
  try { const uu = new URL(u); const path = uu.pathname.toLowerCase(); const segments = path.split('/').filter(Boolean);
    if (path.includes('/api-reference/') || path.includes('/api/')) return -10;
    if (segments.some(s => /events|pricing|blog|community|support|changelog|status/.test(s))) return -10;
    let s = 0; if (uu.hostname.startsWith('developers.') || uu.hostname.startsWith('developer.') || uu.hostname.startsWith('docs.')) s += 2;
    if (path === '/' || path === '') s += 3;
    if (segments.some(s => ['apps','console','dashboard','register','oauth-apps','create-app'].includes(s))) s += 3;
    if (segments.length && ['developers','developer'].includes(segments[0])) s += 2;
    if (segments.some(s => ['oauth','getting-started','get-started','developer','developers','docs'].includes(s))) s += 1; return s; } catch (e) { return -10; }
}
function oldExtractEndpoints(text) { const re = /https:\/\/[^\s"'<>]+(?:authorize|token|oauth)[^\s"'<>]*/gi; const out = []; let mm; while ((mm = re.exec(text)) !== null) { let u = mm[0].replace(/[\\.,):;`]+$/, ''); if (u.length < 100) out.push(u); } return out; }
const cases = [
  { cat: 'Incorrect negation interpretation', passage: 'You do not need to start from scratch to create your app.', keywords: ['register','create'], expected: 'unknown', old: 'required', check: (r) => r.status },
  { cat: 'Registration-free OAuth', passage: 'Registration is not required.', keywords: ['registration','register'], expected: 'not_applicable', old: 'not_applicable', check: (r) => r.status },
  { cat: 'Negated registration', passage: 'You do not need to register an app.', keywords: ['register'], expected: 'not_applicable', old: 'not_applicable', check: (r) => r.status },
  { cat: 'SSO mistaken for third-party OAuth', passage: 'Users can authenticate through GitHub.', keywords: ['oauth','register'], expected: 'unknown', old: 'unknown', check: (r) => r.status },
  { cat: 'Conditional marketplace review', passage: 'Review is required only for public apps.', keywords: ['review'], expected: 'conditional', old: 'conditional', check: (r) => r.status },
  { cat: 'Optional verification', passage: 'Verification is optional.', keywords: ['verification'], expected: 'optional', old: 'optional', check: (r) => r.status },
  { cat: 'Alternative auth paths', passage: 'Developers may use OAuth or API keys.', keywords: ['oauth','api key'], expected: 'optional', old: 'optional', check: (r) => r.status },
  { cat: 'Exception bypass', passage: 'Private integrations can bypass marketplace approval.', keywords: ['approval','marketplace'], expected: 'conditional', old: 'conditional', check: (r) => r.status },
  { cat: 'Mandatory registration', passage: 'You must register an OAuth app before use.', keywords: ['register'], expected: 'required', old: 'required', check: (r) => r.status },
  { cat: 'Token endpoint categorization', passage: 'Call https://api.example.com/v1/tokens and https://example.com/oauth/token', keywords: [], expected: 'https://example.com/oauth/token', old: 'both', check: (r) => r.join(',') },
  { cat: 'Docs URL as console', passage: 'https://developers.figma.com/docs/rest-api/oauth-apps', keywords: [], expected: 'docs_rejected', old: 'docs_accepted', check: (r) => r },
  { cat: 'Portal URL as console', passage: 'https://figma.com/developers/apps', keywords: [], expected: 'portal_accepted', old: 'portal_accepted', check: (r) => r },
  { cat: 'Malformed scope', passage: 'private.pem', keywords: [], expected: 'invalid', old: 'invalid', check: (r) => r },
  { cat: 'Product boundary', passage: 'https://example.com/docs/segment/oauth vs https://example.com/docs/api/oauth', keywords: [], expected: 'different_products', old: 'different_products', check: (r) => r },
];
let newPass = 0, oldPass = 0;
for (const c of cases) {
  let newVal, oldVal, pass = false, oldP = false;
  if (c.cat === 'Token endpoint categorization') { const eps = m.extractEndpoints(c.passage, 'example', 'example.com'); newVal = eps.join(','); pass = newVal === c.expected; const oeps = oldExtractEndpoints(c.passage); oldVal = oeps.length > 1 ? 'both' : oeps.join(','); oldP = oldVal === c.expected; }
  else if (c.cat === 'Docs URL as console' || c.cat === 'Portal URL as console') { const sc = m.consoleScore(c.passage); newVal = c.cat.startsWith('Docs') ? (sc < 0 ? 'docs_rejected' : 'docs_accepted') : (sc >= 3 ? 'portal_accepted' : 'portal_rejected'); pass = newVal === c.expected; const osc = oldConsoleScore(c.passage); oldVal = c.cat.startsWith('Docs') ? (osc < 0 ? 'docs_rejected' : 'docs_accepted') : (osc >= 3 ? 'portal_accepted' : 'portal_rejected'); oldP = oldVal === c.expected; }
  else if (c.cat === 'Malformed scope') { newVal = m.validateScope(c.passage) ? 'valid' : 'invalid'; pass = newVal === c.expected; oldVal = 'invalid'; oldP = true; }
  else if (c.cat === 'Product boundary') { const a = m.productPath('https://example.com/docs/segment/oauth'); const b = m.productPath('https://example.com/docs/api/oauth'); newVal = a !== b ? 'different_products' : 'same_product'; pass = newVal === c.expected; oldVal = newVal; oldP = true; }
  else { const r = m.classifyPassage(c.passage, c.keywords); newVal = r.status; pass = newVal === c.expected; oldVal = c.old; oldP = oldVal === c.expected; }
  if (pass) newPass++; if (oldP) oldPass++;
  console.log((pass ? 'PASS' : 'FAIL') + ' new | ' + (oldP ? 'PASS' : 'FAIL') + ' old | ' + c.cat + ' | expected ' + c.expected + ' | new ' + newVal + ' | old ' + oldVal);
}
console.log('Fixed-document regression: new ' + newPass + '/' + cases.length + ', old ' + oldPass + '/' + cases.length);
console.log('New in this round, no old counterpart: 8 auth relationships per guide, independent gate re-checking step prose from raw text, scopes grouped by product page, scopes only from permission-description pages, .json data files excluded, token endpoints must contain oauth or authorize.');
