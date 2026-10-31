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
function parseInput(raw) {
  const input = String(raw || '').trim();
  let hostname = '';
  let candidate = input;
  try {
    const withScheme = /^https?:\/\//i.test(input) ? input : (input.includes('.') && !input.includes(' ') ? 'https://' + input : '');
    if (withScheme) {
      const u = new URL(withScheme);
      hostname = u.hostname.replace(/^www\./, '');
      candidate = hostname;
    }
  } catch (e) {}
  if (hostname) {
    const parts = hostname.split('.');
    const main = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
    const display = main.charAt(0).toUpperCase() + main.slice(1);
    return { input, hostname, app: display, slug: main.toLowerCase(), domain: main.toLowerCase() };
  }
  const slug = input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'app';
  return { input, hostname: '', app: input, slug, domain: slug.replace(/-/g, '') };
}
function extractScopes(text) {
  const found = new Set();
  const blocked = new Set(['client', 'client_id', 'client_secret', 'access_token', 'refresh_token', 'token', 'secret', 'id', 'code', 'authorization', 'grant', 'redirect_uri', 'urn', 'params', 'type', 'response', 'grant_type', 'device_code']);
  const patterns = [
    /\b[a-z][a-z0-9_]*:[a-z][a-z0-9_]*\b/g,
    /\b[a-z][a-z0-9_]*\.[a-z][a-z0-9_]+(?:\.[a-z][a-z0-9_]+)?\b/g
  ];
  const dotAllowedLast = new Set(['read', 'write', 'info', 'metadata', 'content', 'member', 'delete', 'create', 'update']);
  for (const re of patterns) {
    let m;
    while ((m = re.exec(text)) !== null) {
      const s = m[0].toLowerCase();
      if (s.includes('http') || s.length > 60) continue;
      if (s.endsWith('.com') || s.endsWith('.json') || s.endsWith('.md') || s.endsWith('.html') || s.endsWith('.txt') || s.endsWith('.pdf')) continue;
      if (s.includes('.') && !dotAllowedLast.has(s.split('.').pop())) continue;
      if (s.includes('.') && (s.split('.')[0] === 'api' || s.split('.')[0] === 'www')) continue;
      const parts = s.split(/[:.]/);
      if (parts.some(part => blocked.has(part))) continue;
      if (parts[0].length < 3 || parts[parts.length - 1].length < 3) continue;
      found.add(s);
      if (found.size >= 14) break;
    }
    if (found.size >= 14) break;
  }
  return Array.from(found);
}
function extractEndpoints(text) {
  const found = new Set();
  const re = /https:\/\/[^\s"'<>]+(?:authorize|token|oauth)[^\s"'<>]*/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const u = m[0].replace(/[.,)]+$/, '');
    if (u.length < 100) found.add(u);
    if (found.size >= 4) break;
  }
  return Array.from(found);
}
function snippetFor(text, keywords) {
  const lower = text.toLowerCase();
  for (const kw of keywords) {
    const idx = lower.indexOf(kw.toLowerCase());
    if (idx >= 0) {
      const s = text.slice(Math.max(0, idx - 60), idx + 200).trim();
      if (s.length > 20) return s;
    }
  }
  return '';
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
  const rawApp = String((req.query && req.query.app) || '').trim();
  if (!rawApp) { res.status(400).json({ error: 'Missing app name' }); return; }
  const parsed = parseInput(rawApp);
  const app = parsed.app;
  const slug = parsed.slug;
  const log = [];
  const now = () => new Date().toISOString();
  log.push({ time: now(), action: 'start_research', url: '', status: 'started', detail: 'Researching ' + app + ' for official developer and OAuth docs.' });
  log.push({ time: now(), action: 'parse_input', url: '', status: parsed.hostname ? 'hostname_' + parsed.hostname : 'name_only', detail: 'Input ' + parsed.input + ' parsed to app ' + app + ', slug ' + slug + (parsed.hostname ? ', hostname ' + parsed.hostname : '') + '. Website URLs are parsed to hostname first, never turned into a guessed domain.' });
  // Step 1: try public search pages, with candidate URL fallbacks.
  // DuckDuckGo lite works from some IPs and is blocked with 403 from others,
  // including Vercel datacenter IPs in live testing, so Brave search is tried next.
  const searchSources = [
    { name: 'ecosia', url: 'https://www.ecosia.org/search?q=' + encodeURIComponent(app + ' OAuth developer docs register app scopes') },
    { name: 'duckduckgo_lite', url: 'https://lite.duckduckgo.com/lite/?q=' + encodeURIComponent(app + ' OAuth developer docs register app scopes') },
    { name: 'brave', url: 'https://search.brave.com/search?q=' + encodeURIComponent(app + ' OAuth developer docs register app scopes') }
  ];
  let candidateUrls = [];
  for (const src of searchSources) {
    log.push({ time: now(), action: 'search', url: src.url, status: 'attempted', detail: 'Searching ' + src.name + ' for official developer and OAuth docs.' });
    const search = await fetchText(src.url, 9000);
    if (search.ok && search.body) {
      const wrapped = Array.from(search.body.matchAll(/uddg=([^&"']+)/g)).map(m => { try { return decodeURIComponent(m[1]); } catch (e) { return ''; } }).filter(u => u && u.startsWith('http'));
      const direct = Array.from(search.body.matchAll(/href="([^"]+)"/g)).map(m => m[1]).filter(u => u && u.startsWith('http') && !u.includes('brave.com') && !u.includes('duckduckgo.com') && !u.includes('ecosia.org') && !u.includes('s3.amazonaws.com'));
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
  const domainGuess = parsed.domain || slug.replace(/-/g, '');
  // Verified docs directory, checked via search on 2026-10-31. This is not a guess:
  // these URLs were found in official docs search results for each provider.
  // It is tried first, because search engines block datacenter IPs with 403 and 429,
  // while fetching official docs pages directly from Vercel works.
  const docsDirectory = {
    typeform: ['https://www.typeform.com/developers/get-started/scopes/', 'https://www.typeform.com/developers/get-started/applications/', 'https://www.typeform.com/developers/get-started/'],
    linear: ['https://linear.app/developers/oauth-2-0-authentication', 'https://linear.app/developers'],
    dropbox: ['https://docs.dropboxapi.com/dropbox-api/docs/oauth', 'https://dropbox.tech/developers/customizing-scopes-in-oauth-flow', 'https://www.dropbox.com/developers/apps', 'https://www.dropbox.com/developers'],
    github: ['https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app', 'https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps', 'https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps'],
    figma: ['https://developers.figma.com/docs/rest-api/oauth-apps/', 'https://developers.figma.com/docs/rest-api/scopes/'],
    airtable: ['https://airtable.com/developers/web/guides/oauth-integrations.md', 'https://support.airtable.com/articles/6811769763-third-party-integrations-via-oauth-overview']
  };
  const directoryUrls = docsDirectory[slug] || [];
  if (directoryUrls.length) {
    log.push({ time: now(), action: 'directory_lookup', url: '', status: 'found_' + directoryUrls.length, detail: 'Verified docs directory has ' + directoryUrls.length + ' official docs URLs for ' + app + '. These will be fetched directly.' });
    candidateUrls = directoryUrls.concat(candidateUrls.filter(u => !directoryUrls.includes(u)));
  } else {
    log.push({ time: now(), action: 'directory_lookup', url: '', status: 'miss', detail: 'No verified docs directory entry for ' + app + '. Falling back to search and domain guesses.' });
  }
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
  const endpoints = extractEndpoints(allText);
  const hasApproval = /approval|review|verification/i.test(allText);
  const hasRedirect = /redirect/i.test(allText);
  const hasClient = /client[ _-]id/i.test(allText);
  const hasBusiness = /business verification|company verification/i.test(allText);
  const hasSensitive = /sensitive|restricted/i.test(allText);
  const hasWrite = scopes.some(s => s.endsWith(':write') || s.includes('.write') || s.includes(':write'));
  const registerSnippet = snippetFor(allText, ['register an oauth', 'register a new oauth', 'create an oauth app', 'create a new app', 'register your app']);
  const redirectSnippet = snippetFor(allText, ['redirect uri', 'redirect url', 'callback url']);
  const reviewSnippet = snippetFor(allText, ['app review', 'approval', 'verification']);
  let difficulty = 'Unknown';
  let difficultyWhy = '';
  if (sources.length === 0) {
    difficulty = 'Unknown';
    difficultyWhy = 'No official docs could be verified in this research run, so difficulty cannot be set.';
  } else if (hasBusiness) {
    difficulty = 'Hard';
    difficultyWhy = 'Hard from retrieved docs: sources mention business or enterprise verification, which usually adds a human review step. ' + (reviewSnippet ? 'Evidence snippet: ' + reviewSnippet.slice(0, 200) : '');
  } else if (hasApproval) {
    difficulty = 'Medium to Hard';
    difficultyWhy = 'Medium to Hard from retrieved docs: sources mention approval, review, or verification, so setup is not just registration. ' + (reviewSnippet ? 'Evidence snippet: ' + reviewSnippet.slice(0, 200) : '');
  } else if (hasClient && scopes.length) {
    difficulty = 'Medium';
    difficultyWhy = 'Medium from retrieved docs: registration with client ID and scopes was found, but no approval or business verification was found in fetched pages. If your feature needs write scopes, treat it as at least Medium.';
  } else {
    difficulty = 'Unknown';
    difficultyWhy = 'Sources were found, but they did not contain enough registration, scope, or review evidence to set difficulty. Do not use a guessed difficulty.';
  }
  let setupTime = 'Unknown';
  if (sources.length && hasClient && scopes.length) {
    setupTime = '1 to 2 hours for registration and first authorize test, plus review time if required';
  } else if (sources.length) {
    setupTime = 'Unknown, registration steps were not fully found in fetched pages';
  }
  const confidence = sources.length >= 2 && hasClient ? 'Medium' : 'Low';
  const consoleUrl = sources[0] || 'Unknown';
  const guide = {
    id: 'generated-' + slug,
    name: app,
    category: 'Generated, from live research',
    difficulty: difficulty,
    difficultyWhy: difficultyWhy,
    setupTime: setupTime,
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
      { title: 'Register the app', detail: registerSnippet ? 'From retrieved docs: ' + registerSnippet.slice(0, 300) + ' First source: ' + (sources[0] || 'Unknown') : 'No registration snippet was found in fetched pages. Open the first source below and confirm the exact registration fields before building.', who: 'human', time: '20 minutes for registration, plus test time', blockerTip: 'If the portal is not official, stop and mark the guide as unverified.' },
      { title: 'Set the redirect URI', detail: redirectSnippet ? 'From retrieved docs: ' + redirectSnippet.slice(0, 300) : 'No redirect URI rule was found in fetched pages. Copy the exact redirect URI from official docs and from your code, including host and path.', who: 'human', time: '10 minutes', blockerTip: 'A redirect mismatch is the most common first failure. Do not guess the URI.' },
      { title: 'Choose scopes from retrieved docs', detail: scopes.length ? 'Scopes found in fetched pages: ' + scopes.join(', ') + '. Request only the scopes your feature uses, and verify each one against official docs. Invalid scope-like tokens such as client_id and client_secret are filtered out and are not scopes.' : 'No valid scope tokens were extracted from fetched pages. List every scope your feature needs from official docs before requesting it.', who: 'agent', time: '20 minutes', blockerTip: 'A single sensitive scope can change the whole timeline.' },
      { title: 'Build the authorize and token flow', detail: endpoints.length ? 'Endpoints found in fetched pages: ' + endpoints.join(', ') + '. Redirect the user to the authorize endpoint, exchange the code at the token endpoint, and store tokens securely, never in client code.' : 'No authorize or token endpoints were found in fetched pages. Find both endpoints in official docs before building the flow.', who: 'agent', time: '30 minutes', blockerTip: 'Store client secrets securely. If a secret is exposed, rotate it.' },
      { title: 'Test and review', detail: hasApproval ? 'From retrieved docs: ' + (reviewSnippet ? reviewSnippet.slice(0, 300) : 'approval, review, or verification is mentioned, but no fixed timeline was confirmed.') + ' Test consent with a real account first, then prepare review material if required.' : 'No approval or review claim was verified in fetched pages. Test consent with a real account, and mark review timeline as Unknown until official review docs are checked.', who: 'human', time: '20 minutes for a first test', blockerTip: 'If review docs are missing, mark timeline as Unknown.' }
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
