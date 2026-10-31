// Live research endpoint for the OAuth guides site.
// No LLM and no paid API key. It searches for official developer and OAuth
// docs, fetches candidate pages, extracts registration, scope, and review
// claims, and returns a structured guide plus a step-by-step execution log.
// Claims that cannot be verified from a fetched page are marked Unknown.
// This file runs as a Vercel serverless function when deployed under /api.
function stripHtml(html) {
  return String(html || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
}
function snippet(text, keyword) {
  const idx = text.toLowerCase().indexOf(keyword.toLowerCase());
  if (idx < 0) return '';
  return text.slice(Math.max(0, idx - 80), idx + 180).trim();
}
function extractScopes(text) {
  const found = new Set();
  const re = /\b[a-z][a-z0-9._-]*:[a-z][a-z0-9._-]*\b/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const s = m[0];
    if (s.includes('http') || s.length > 60) continue;
    found.add(s);
    if (found.size >= 12) break;
  }
  return Array.from(found);
}
async function fetchText(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'OAuth-Guides-Research/1.0', Accept: 'text/html,application/json' } });
    const body = await res.text();
    return { status: res.status, body, ok: res.ok };
  } catch (e) {
    return { status: 0, body: '', ok: false, error: String(e && e.message ? e.message : e) };
  } finally { clearTimeout(timer); }
}
module.exports = async (req, res) => {
  const app = String((req.query && req.query.app) || '').trim();
  if (!app) { res.status(400).json({ error: 'Missing app name' }); return; }
  const slug = app.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'app';
  const log = [];
  const now = () => new Date().toISOString();
  log.push({ time: now(), action: 'start_research', url: '', status: 'started', detail: 'Researching ' + app + ' for official developer and OAuth docs.' });
  // Step 1: try public search pages, with candidate URL fallbacks.
  // DuckDuckGo lite works from some IPs and is blocked with 403 from others,
  // including Vercel datacenter IPs in live testing, so Brave search is tried next.
  const searchSources = [
    { name: 'duckduckgo_lite', url: 'https://lite.duckduckgo.com/lite/?q=' + encodeURIComponent(app + ' OAuth developer docs register app scopes') },
    { name: 'brave', url: 'https://search.brave.com/search?q=' + encodeURIComponent(app + ' OAuth developer docs register app scopes') }
  ];
  let candidateUrls = [];
  for (const src of searchSources) {
    log.push({ time: now(), action: 'search', url: src.url, status: 'attempted', detail: 'Searching ' + src.name + ' for official developer and OAuth docs.' });
    const search = await fetchText(src.url, 9000);
    if (search.ok && search.body) {
      const wrapped = Array.from(search.body.matchAll(/uddg=([^&"']+)/g)).map(m => { try { return decodeURIComponent(m[1]); } catch (e) { return ''; } }).filter(u => u && u.startsWith('http'));
      const direct = Array.from(search.body.matchAll(/href="([^"]+)"/g)).map(m => m[1]).filter(u => u && u.startsWith('http') && !u.includes('brave.com') && !u.includes('duckduckgo.com'));
      const found = wrapped.concat(direct).filter((u, i, a) => a.indexOf(u) === i).slice(0, 8);
      candidateUrls = candidateUrls.concat(found.filter(u => !candidateUrls.includes(u)));
      log.push({ time: now(), action: 'search', url: src.url, status: 'found_' + found.length, detail: 'Search ' + src.name + ' returned ' + found.length + ' direct candidate links.' });
      if (candidateUrls.length >= 4) break;
    } else {
      log.push({ time: now(), action: 'search', url: src.url, status: 'failed_' + search.status, detail: 'Search page could not be fetched. ' + (search.error || '') });
    }
  }
  const mdCandidates = candidateUrls.filter(u => u.includes('/developers/') || u.includes('/docs/')).map(u => u.endsWith('.md') ? u : u + '.md');
  candidateUrls = candidateUrls.concat(mdCandidates.filter(u => !candidateUrls.includes(u))).slice(0, 10);
  const domainGuess = slug.replace(/-/g, '');
  const fallbacks = [
    'https://' + domainGuess + '.com/developers',
    'https://developers.' + domainGuess + '.com',
    'https://docs.' + domainGuess + '.com',
    'https://developers.' + domainGuess + '.com/docs/rest-api/oauth-apps/',
    'https://developers.' + domainGuess + '.com/docs/rest-api/scopes/',
    'https://developers.' + domainGuess + '.com/docs/oauth/',
    'https://' + domainGuess + '.com/developers/web/api/oauth-reference',
    'https://' + domainGuess + '.com/developers/web/guides/oauth-integrations',
    'https://' + domainGuess + '.com/create/oauth'
  ];
  const fallbackExpanded = [];
  for (const u of fallbacks) {
    fallbackExpanded.push(u);
    if (u.includes('/developers/') || u.includes('/docs/')) fallbackExpanded.push(u + '.md');
  }
  candidateUrls = candidateUrls.concat(fallbackExpanded.filter(u => !candidateUrls.includes(u))).slice(0, 12);
  const sources = [];
  const pages = [];
  for (const url of candidateUrls.slice(0, 12)) {
    const page = await fetchText(url, 8000);
    if (page.ok && page.body) {
      const text = stripHtml(page.body);
      const hasOAuth = /oauth/i.test(text);
      const hasClient = /client[ _-]id/i.test(text);
      const hasRedirect = /redirect/i.test(text);
      const hasScope = /scope/i.test(text);
      log.push({ time: now(), action: 'fetch_page', url: url, status: 'ok_' + page.status, detail: 'Fetched. OAuth mention: ' + hasOAuth + ', client ID mention: ' + hasClient + ', redirect mention: ' + hasRedirect + ', scope mention: ' + hasScope + '. Text length: ' + text.length + '.' });
      if (hasOAuth || hasClient || hasScope) {
        sources.push(url);
        pages.push({ url, text });
      } else {
        log.push({ time: now(), action: 'fetch_page', url: url, status: 'skipped', detail: 'Page fetched but contained no OAuth, client ID, or scope claims, so it was not used as a source.' });
      }
    } else {
      log.push({ time: now(), action: 'fetch_page', url: url, status: 'failed_' + page.status, detail: 'Could not fetch page. ' + (page.error || '') });
    }
    if (sources.length >= 3) break;
  }
  const allText = pages.map(p => p.text).join(' ');
  const scopes = extractScopes(allText);
  const hasApproval = /approval|review|verification/i.test(allText);
  const hasRedirect = /redirect/i.test(allText);
  const hasClient = /client[ _-]id/i.test(allText);
  const confidence = sources.length >= 2 && hasClient ? 'Medium' : 'Low';
  const consoleUrl = sources[0] || 'Unknown';
  const guide = {
    id: 'generated-' + slug,
    name: app,
    category: 'Generated, from live research',
    difficulty: sources.length ? 'Unknown, check scope tiers' : 'Unknown',
    difficultyWhy: sources.length ? 'Generated from live research on ' + new Date().toISOString().slice(0, 10) + '. Difficulty cannot be fixed until scope tiers and review docs are confirmed from official pages.' : 'No official docs could be verified in this research run, so difficulty cannot be set.',
    setupTime: 'Unknown',
    approvalWait: hasApproval ? 'Varies, see sources. No fixed timeline was confirmed in this research run.' : 'Unknown, do not promise a date until review docs are checked',
    accountNeeded: 'Unknown, check the provider developer docs',
    cost: 'Unknown',
    consoleName: sources.length ? 'Official developer portal, see sources' : 'Unknown, find the official developer console first',
    consoleUrl: consoleUrl,
    guideType: 'draft',
    confidence: confidence,
    managedAppNote: 'Check first whether a managed app already covers this platform. If it does, you may not need your own app.',
    nextStep: sources.length ? 'Open the first source below, confirm the registration fields and redirect URL, then list scopes before building.' : 'Find the official developer console and registration docs for ' + app + ', then list scopes and review triggers before building.',
    steps: [
      { title: 'Portal found in research', detail: sources.length ? 'Research found ' + sources.length + ' candidate source pages that mention OAuth, client ID, or scopes. First source: ' + sources[0] : 'Research found no verified official portal in this run. Do not guess a portal URL.', who: 'agent', time: 'Research run', blockerTip: 'If the first source is not official, stop and mark the guide as unverified.' },
      { title: 'Registration fields to confirm', detail: hasClient ? 'Fetched pages mention client ID, which suggests a registered app flow. Confirm the exact name, homepage, and redirect URL fields on the official portal.' : 'No client ID claim was verified in fetched pages. Confirm registration fields on the official portal before building.', who: 'agent', time: 'Unknown', blockerTip: 'Do not guess redirect URI rules. Copy them from official docs.' },
      { title: 'Scopes found in research', detail: scopes.length ? 'Scope-like tokens found in fetched pages: ' + scopes.join(', ') + '. Verify each scope against official docs before requesting it.' : 'No scope tokens were extracted from fetched pages. List every scope your feature needs from official docs.', who: 'agent', time: 'Unknown', blockerTip: 'A single sensitive scope can change the whole timeline.' },
      { title: 'Review and approval to confirm', detail: hasApproval ? 'Fetched pages mention approval, review, or verification, but no fixed timeline was confirmed. Treat timeline as varies until the official review page is checked.' : 'No approval or review claim was verified in fetched pages. Mark timeline as Unknown.', who: 'human', time: 'Unknown', blockerTip: 'If review docs are missing, mark timeline as Unknown.' }
    ],
    timeline: [
      { stage: 'Live research', wait: 'Completed in this run', note: 'See research log for sources fetched and failures.' },
      { stage: 'Provider review, if required', wait: 'Unknown', note: 'Check official review docs before promising a date.' }
    ],
    checklist: [
      { item: 'Official developer console identified from a fetched source', status: sources.length ? 'required' : 'required', who: 'agent' },
      { item: 'Registration fields and redirect URIs listed from official docs', status: 'required', who: 'agent' },
      { item: 'Scopes verified against official docs', status: 'required', who: 'agent' },
      { item: 'Privacy policy URL live', status: 'required', who: 'human' },
      { item: 'Review submission prepared by a human', status: 'required', who: 'human' }
    ],
    blockers: [
      { blocker: 'Redirect URL mismatch', fix: 'Copy the exact redirect URL from official docs and from your code, including host and path.' },
      { blocker: 'Scope not available or not verified', fix: 'Check product and scope access on the official portal before building on that API.' },
      { blocker: 'Research source was not official', fix: 'Mark the guide as unverified and do not use it for a launch decision.' }
    ],
    agentCan: ['Search for official docs', 'Fetch candidate pages', 'Extract scope-like tokens and OAuth mentions', 'Draft checklists and timelines with sources'],
    humanMust: ['Confirm the official portal', 'Sign in to the provider console', 'Verify scopes and review requirements', 'Submit for review and reply to reviewers'],
    sources: sources,
    tested: 'Live research run on ' + new Date().toISOString() + '. Search attempted, candidate pages fetched, claims extracted only where pages mentioned OAuth, client ID, or scopes. No account sign-in, app creation, or provider approval was completed.',
    notVerified: ['All provider-specific details not extracted from a fetched official page', 'Exact console layout', 'Exact scope list for your feature', 'Approval timeline', 'Distribution requirements'],
    executionLog: log
  };
  log.push({ time: now(), action: 'generate_guide', url: '', status: 'complete', detail: 'Generated guide with ' + sources.length + ' sources, ' + scopes.length + ' scope-like tokens, confidence ' + confidence + '.' });
  guide.executionLog = log;
  res.status(200).json({ guide: guide, log: log });
};
