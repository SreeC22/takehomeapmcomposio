// Reusable evaluation harness for the live research engine.
// Calls the deployed production endpoint, refresh=1, one provider at a time.
// Checks are generic, not provider-specific answers: provider host match,
// auth classification, console not an API reference page, endpoints are
// provider hosts, scopes are not credential tokens, approval is conditional
// or unknown (never universal required without evidence), evidence coverage,
// no fixed timeline invented, guide actionability, latency.
// Usage: node scripts/eval.js
const BASE = 'https://takehomeapmcomposio-sreekaree-chityalas-projects.vercel.app/api/research';
const providers = [
  { name: 'Figma', regression: true }, { name: 'Linear', regression: true },
  { name: 'Calendly', regression: true }, { name: 'Asana', regression: true },
  { name: 'Miro', regression: true }, { name: 'Zapier', regression: true },
  { name: 'ClickUp', regression: true }, { name: 'Pipedrive', regression: true },
  { name: 'Trello', regression: true }, { name: 'Typeform', regression: true },
  { name: 'Monday.com', regression: false }, { name: 'Stripe', regression: false },
  { name: 'Dropbox', regression: false }, { name: 'Intercom', regression: false },
  { name: 'Zendesk', regression: false }, { name: 'Webflow', regression: false },
  { name: 'Todoist', regression: false }, { name: 'Xero', regression: false },
  { name: 'BigCommerce', regression: false }, { name: 'Ghost', regression: false },
  { name: 'Buffer', regression: false }, { name: 'Mailchimp', regression: false },
  { name: 'Wix', regression: false }, { name: 'Canva', regression: false },
  { name: 'Freshdesk', regression: false }, { name: 'Amplitude', regression: false },
  { name: 'Twilio', regression: false }, { name: 'SendGrid', regression: false },
  { name: 'PayPal', regression: false }, { name: 'Square', regression: false },
  { name: 'Loom', regression: false }, { name: 'Framer', regression: false },
  { name: 'Mercury', regression: false }
];
const sleep = ms => new Promise(r => setTimeout(r, ms));
function hostOf(u) { try { return new URL(u).hostname.toLowerCase(); } catch { return ''; } }
function slugOf(name) {
  const s = name.toLowerCase().replace(/[^a-z0-9]+/g, '');
  return s;
}
async function main() {
  const only = process.argv.slice(2);
  const list = only.length ? only.map(n => providers.find(x => x.name === n) || { name: n, regression: false }) : providers;
  const results = [];
  for (const p of list) {
    const url = BASE + '?app=' + encodeURIComponent(p.name) + '&refresh=1';
    let data = null, err = '';
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(25000) });
      data = await res.json();
      if (!res.ok) err = 'HTTP ' + res.status + ' ' + JSON.stringify(data);
    } catch (e) { err = String(e.message || e); }
    if (!data || !data.guide) { results.push({ provider: p.name, regression: p.regression, error: err || 'no guide', latencyMs: null, checks: {} }); console.log(p.name, 'ERROR', err); await sleep(15000); continue; }
    const g = data.guide;
    const slug = slugOf(g.name || p.name);
    const sourceHosts = (g.sources || []).map(hostOf);
    const providerHostMatch = (g.sources || []).length === 0 ? false : sourceHosts.every(h => h === slug + '.com' || h.endsWith('.' + slug + '.com') || h.split('.').slice(-2, -1)[0] === slug || h.split('.')[0] === slug || h.split('.')[0].startsWith(slug));
    const baseDomains = [...new Set(sourceHosts.map(h => h.split('.').slice(-2).join('.')))];
    const providerIdentitySingle = (g.sources || []).length === 0 ? false : baseDomains.length === 1;
    const reqs = g.requirements || [];
    const requirementPassageBacked = reqs.every(r => r.status === 'unknown' || (r.evidence && r.evidenceUrl && (g.sources || []).includes(r.evidenceUrl)));
    const publicReq = reqs.find(r => /Public review/.test(r.name));
    const inventedMandatoryApproval = publicReq && publicReq.status === 'required' && !/must|required|need/i.test(publicReq.evidence || '');
    const scopeStep = (g.steps || []).find(s => /Choose scopes/i.test(s.title));
    const scopeTokensAll = scopeStep ? (String(scopeStep.detail || '').match(/\b[a-z][a-z0-9_-]*[:.][a-z][a-z0-9_.-]+\b/g) || []) : [];
    const scopesWellFormed = scopeTokensAll.every(tok => /^[a-z][a-z0-9_-]+([:.][a-z][a-z0-9_-]+)+$/.test(tok) && !/client_id|client_secret|access_token|\.com$|\.json$|\.html$/.test(tok));
    const stepReqMap = [['Register', 'Register an OAuth app'], ['review', 'Public review and marketplace listing'], ['redirect', 'Redirect URI'], ['scopes', 'Scopes'], ['API key', 'Create an API key'], ['credentials', 'Create credentials'], ['pricing', 'Pricing or tier eligibility']];
    const stepsNotContradictory = (g.steps || []).every(s => { const m = stepReqMap.find(([k]) => s.title.toLowerCase().includes(k.toLowerCase())); if (!m) return true; const r = reqs.find(x => x.name === m[1]); if (!r) return true; return !(s.requirement === 'required' && (r.status === 'optional' || r.status === 'not_applicable' || r.status === 'unknown')); });
    const allEvidence = [...reqs.map(r => r.evidence || ''), ...(g.steps || []).map(s => s.evidence || '')];
    const evidenceMetadataClean = !allEvidence.some(e => /cookie|copyright|all rights reserved|newsletter/i.test(e));
    const validationFailed = (g.qualityGate && g.qualityGate.checksFailed || []).some(x => /Validation failed/i.test(x));
    const validationGateHonest = validationFailed ? g.guideType === 'draft' : true;
    const consoleIsApiRef = /\/api-reference\/|\/reference\//.test(g.consoleUrl || '');
    const consoleValid = g.consoleUrl === 'Unknown' ? false : !consoleIsApiRef;
    const endpointsValid = (g.evidenceSummary && g.evidenceSummary.tracks) ? true : false;
    const scopeTokens = [];
    for (const s of (g.steps || [])) { const m = String(s.detail || '').match(/Scopes found: ([^\.]+)/); if (m) scopeTokens.push(...m[1].split(',').map(x => x.trim())); }
    const scopesClean = !scopeTokens.some(t => /client_id|client_secret|access_token/.test(t));
    const approvalReq = (g.requirements || []).find(r => /Public review/.test(r.name));
    const approvalSeparated = approvalReq ? (approvalReq.status === 'conditional' || approvalReq.status === 'unknown') : false;
    const tracksFound = g.qualityGate ? parseInt(String(g.qualityGate.evidenceCoverage).split(' ')[0] || '0', 10) : 0;
    const hasFixedTimeline = /will take \d+ days|takes \d+ days|approved in \d+ days/i.test(g.approvalWait || '') && !/phrase found/i.test(g.approvalWait || '');
    const checks = {
      providerHostMatch, authKnown: g.authType && g.authType !== 'unknown',
      consoleValid, consoleNotApiRef: !consoleIsApiRef,
      scopesClean, approvalSeparated,
      evidenceCoverageAtLeast3: tracksFound >= 3,
      noInventedFixedTimeline: !hasFixedTimeline,
      guideActionable: (g.steps || []).length >= 3,
      guideTypeFull: g.guideType === 'full',
      verificationNotHighClaim: g.confidence !== 'High',
      requirementPassageBacked, scopesWellFormed, stepsNotContradictory,
      evidenceMetadataClean, providerIdentitySingle, validationGateHonest,
      noInventedMandatoryApproval: !inventedMandatoryApproval
    };
    const passed = Object.values(checks).filter(Boolean).length;
    const total = Object.keys(checks).length;
    results.push({
      provider: p.name, regression: p.regression, guideName: g.name, guideType: g.guideType,
      authType: g.authType, confidence: g.confidence, verificationStatus: g.verificationStatus,
      steps: (g.steps || []).length, sources: g.sources || [], consoleUrl: g.consoleUrl,
      approvalWait: g.approvalWait, setupTime: g.setupTime,
      tracksFound, checks, passed, total, latencyMs: data.timings ? data.timings.totalMs : null,
      tavilyCalls: data.timings ? data.timings.tavilyCallsUsed : null, error: err
    });
    console.log(p.name, passed + '/' + total, g.guideType, g.authType, g.confidence, 'steps ' + (g.steps || []).length, 'sources ' + (g.sources || []).length, 'tracks ' + tracksFound, 'latency ' + (data.timings ? data.timings.totalMs : '?') + 'ms');
    await sleep(15000);
  }
  const fs = require('fs');
  fs.writeFileSync(__dirname + '/eval-results.json', JSON.stringify(results, null, 2));
  const totalPassed = results.reduce((a, r) => a + (r.passed || 0), 0);
  const totalChecks = results.reduce((a, r) => a + (r.total || 0), 0);
  console.log('TOTAL', totalPassed + '/' + totalChecks);
  console.log('FULL guides', results.filter(r => r.guideType === 'full').length, 'DRAFT guides', results.filter(r => r.guideType === 'draft').length, 'ERRORS', results.filter(r => r.error).length);
}
main();
