// Live research endpoint for the OAuth guides site.
// Tavily is optional, only if TAVILY_API_KEY is set in Vercel. It searches for official developer and OAuth
// docs, fetches candidate pages, extracts registration, scope, and review
// claims, and returns a structured guide plus a step-by-step execution log.
// Claims that cannot be verified from a fetched page are marked Unknown.
// This file runs as a Vercel serverless function when deployed under /api.
function stripHtml(html) {
  return String(html || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/gi, "'").replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
}
function snippet(text, keyword) {
  const idx = text.toLowerCase().indexOf(keyword.toLowerCase());
  if (idx < 0) return '';
  return text.slice(Math.max(0, idx - 80), idx + 180).trim();
}
function isProviderHost(host, slug, domainGuess) {
  const h = String(host || '').toLowerCase();
  if (domainGuess && (h === domainGuess || h.endsWith('.' + domainGuess))) return true;
  const parts = h.split('.');
  if (parts.length >= 2 && parts[parts.length - 2] === slug) return true;
  if (parts[0] === slug) return true;
  return false;
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
    // Preserve the full hostname, including its TLD, for example tally.so, not tally.com.
    // The main name is the second last part, unless the hostname is a docs subdomain.
    const clean = hostname.replace(/^(developers|docs|developer|api|help)\./, '');
    const cleanParts = clean.split('.');
    const main = cleanParts.length >= 2 ? cleanParts[cleanParts.length - 2] : cleanParts[0];
    const display = main.charAt(0).toUpperCase() + main.slice(1);
    return { input, hostname, baseDomain: clean, app: display, slug: main.toLowerCase(), domain: clean.toLowerCase() };
  }
  const slug = input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'app';
  return { input, hostname: '', baseDomain: '', app: input, slug, domain: slug.replace(/-/g, '') };
}
function extractScopes(text) {
  const found = new Set();
  const blocked = new Set(['client', 'client_id', 'client_secret', 'access_token', 'refresh_token', 'token', 'secret', 'id', 'code', 'authorization', 'grant', 'redirect_uri', 'urn', 'params', 'type', 'response', 'grant_type', 'device_code', 'twitter', 'og', 'fb', 'eip155']);
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
function extractEndpoints(text, slug, domainGuess) {
  const found = new Set();
  const re = /https:\/\/[^\s"'<>]+(?:authorize|token|oauth)[^\s"'<>]*/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    let u = m[0];
    while (/[\\.,):;`]$/.test(u)) u = u.slice(0, -1);
    if (u.includes('&#')) u = u.split('&#')[0];
    u = u.replace(/\):$/, '');
    if (u.length >= 100) continue;
    try { const pp = new URL(u).pathname.toLowerCase(); const hh = new URL(u).hostname.toLowerCase(); if (pp.includes('/docs/') || pp.includes('/reference/') || pp.endsWith('.md') || pp.endsWith('.png') || pp.endsWith('.jpg') || pp.endsWith('.jpeg') || pp.endsWith('.svg') || pp.endsWith('.gif') || pp.includes('/attachments') || hh.includes('attachments')) continue; } catch (e) { continue; }
    try {
      const host = new URL(u).hostname.toLowerCase();
      if (!isProviderHost(host, slug, domainGuess)) continue;
    } catch (e) { continue; }
    found.add(u);
    if (found.size >= 4) break;
  }
  return Array.from(found);
}
function snippetFor(text, keywords) {
  const lower = text.toLowerCase();
  for (const kw of keywords) {
    let searchFrom = 0;
    while (true) {
      const idx = lower.indexOf(kw.toLowerCase(), searchFrom);
      if (idx < 0) break;
      let start = Math.max(0, idx - 60);
      const nextSpace = text.indexOf(' ', start);
      if (nextSpace >= 0 && nextSpace < idx) start = nextSpace + 1;
      let end = Math.min(text.length, idx + 160);
      const period = text.indexOf('.', idx + 30);
      if (period >= 0 && period < end) end = period + 1;
      const prevSpace = text.lastIndexOf(' ', end);
      if (prevSpace > idx) end = prevSpace;
      const s = text.slice(start, end).trim();
      if (s.length > 20 && !/try-it|api key to use|api key for/i.test(s)) return s;
      searchFrom = idx + kw.length;
    }
  }
  return '';
}
async function fetchOnce(url, timeoutMs) {
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
async function fetchText(url, timeoutMs) {
  const direct = await fetchOnce(url, timeoutMs);
  if (direct.ok && direct.body && direct.body.length > 200) return direct;
  if (direct.status === 404) return direct;
  // Proxy retry: search engines and some docs sites block datacenter IPs with 403 or 429.
  // AllOrigins is a public proxy whose IP is not the Vercel server IP, so it can
  // fetch pages that direct fetch cannot. The source URL is still the original URL,
  // the proxy is only transport, and the retry is logged by the caller via status.
  try {
    const proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url);
    const proxy = await fetchOnce(proxyUrl, Math.max(timeoutMs, 8000));
    if (proxy.ok && proxy.body && proxy.body.length > 200) {
      return { status: 200, body: proxy.body, ok: true, viaProxy: true, directStatus: direct.status };
    }
  } catch (e) {}
  return direct;
}
// Simple rate limiting, so the Tavily key cannot be burned by abuse.
// Vercel serverless functions are stateless across instances, so this is a
// per-instance in-memory limit, not a hard global guarantee. It still stops
// a single client hammering one warm instance, and it stops Tavily calls
// entirely once the per-IP limits are hit, because the check runs first.
// Limits are generous for a reviewer: 5 searches per minute per IP, 20 per
// hour per IP, and a per-instance Tavily cap of 200 calls per day.
const rateStore = globalThis.__researchRateStore || (globalThis.__researchRateStore = new Map());
function rateCheck(ip) {
  const now = Date.now();
  const arr = (rateStore.get(ip) || []).filter(ts => now - ts < 3600000);
  const perMinute = arr.filter(ts => now - ts < 60000).length;
  if (perMinute >= 5) return 'Too many searches in the last minute. Wait a minute and try again.';
  if (arr.length >= 20) return 'Too many searches in the last hour. Wait and try again later.';
  arr.push(now);
  rateStore.set(ip, arr);
  return '';
}
let tavilyCallsToday = globalThis.__tavilyCallsToday || { day: new Date().toISOString().slice(0, 10), count: 0 };
globalThis.__tavilyCallsToday = tavilyCallsToday;
module.exports = async (req, res) => {
  const rawApp = String((req.query && req.query.app) || '').trim();
  if (!rawApp) { res.status(400).json({ error: 'Missing app name' }); return; }
  const clientIp = String((req.headers && (req.headers['x-forwarded-for'] || '')) || '').split(',')[0].trim() || 'unknown';
  const rateError = rateCheck(clientIp);
  if (rateError) { res.status(429).json({ error: rateError }); return; }
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
  const domainGuessForSearch = parsed.baseDomain || (slug + '.com');
  const searchSources = [
    { name: 'ecosia', url: 'https://www.ecosia.org/search?q=' + encodeURIComponent(app + ' OAuth developer docs register app scopes') },
    { name: 'duckduckgo_lite', url: 'https://lite.duckduckgo.com/lite/?q=' + encodeURIComponent(app + ' OAuth developer docs register app scopes') },
    { name: 'brave', url: 'https://search.brave.com/search?q=' + encodeURIComponent(app + ' OAuth developer docs register app scopes') }
  ];
  let candidateUrls = [];
  // Tavily, single simple search source, if a key is set in Vercel.
  // One official API call replaces scraping 3 search pages, which Vercel IPs get blocked from.
  // If no key is set, this step is skipped and the existing navigation fallback runs.
  if (process.env.TAVILY_API_KEY && tavilyCallsToday.day === new Date().toISOString().slice(0, 10) && tavilyCallsToday.count >= 200) {
    log.push({ time: now(), action: 'search', url: 'https://api.tavily.com/search', status: 'skipped_rate_limit', detail: 'Per-instance Tavily daily cap reached, using site navigation fallback instead, so the key is not burned.' });
  } else if (process.env.TAVILY_API_KEY) {
    if (tavilyCallsToday.day !== new Date().toISOString().slice(0, 10)) { tavilyCallsToday.day = new Date().toISOString().slice(0, 10); tavilyCallsToday.count = 0; }
    tavilyCallsToday.count += 1;
    try {
      const tavRes = await fetch('https://api.tavily.com/search', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + process.env.TAVILY_API_KEY }, body: JSON.stringify({ query: app + ' OAuth developer docs register app scopes', search_depth: 'basic', max_results: 8 }) });
      const tavJson = await tavRes.json().catch(() => ({}));
      const tavUrls = (tavJson.results || []).map(r => r.url).filter(u => typeof u === 'string' && u.startsWith('http'));
      const tavFound = tavUrls.filter(u => { try { return isProviderHost(new URL(u).hostname.toLowerCase(), slug, domainGuessForSearch); } catch (e) { return false; } }).slice(0, 8);
      log.push({ time: now(), action: 'search', url: 'https://api.tavily.com/search', status: tavRes.ok ? 'found_' + tavFound.length : 'failed_' + tavRes.status, detail: 'Tavily search returned ' + tavUrls.length + ' URLs, ' + tavFound.length + ' provider-specific.' });
      candidateUrls = candidateUrls.concat(tavFound.filter(u => !candidateUrls.includes(u)));
    } catch (e) {
      log.push({ time: now(), action: 'search', url: 'https://api.tavily.com/search', status: 'failed', detail: 'Tavily search failed, falling back to site navigation. ' + String(e && e.message ? e.message : e) });
    }
  } else {
    log.push({ time: now(), action: 'search', url: 'https://api.tavily.com/search', status: 'skipped_no_key', detail: 'No TAVILY_API_KEY set, skipping Tavily and using site navigation fallback.' });
  }
  for (const src of searchSources) {
    log.push({ time: now(), action: 'search', url: src.url, status: 'attempted', detail: 'Searching ' + src.name + ' for official developer and OAuth docs.' });
    const search = await fetchText(src.url, 4000);
    if (search.ok && search.body) {
      const wrapped = Array.from(search.body.matchAll(/uddg=([^&"']+)/g)).map(m => { try { return decodeURIComponent(m[1]); } catch (e) { return ''; } }).filter(u => u && u.startsWith('http'));
      const direct = Array.from(search.body.matchAll(/href="([^"]+)"/g)).map(m => m[1]).filter(u => u && u.startsWith('http') && !u.includes('brave.com') && !u.includes('duckduckgo.com') && !u.includes('ecosia.org') && !u.includes('s3.amazonaws.com'));
      const foundAll = wrapped.concat(direct).filter((u, i, a) => a.indexOf(u) === i);
      const found = foundAll.filter(u => {
        try {
          const host = new URL(u).hostname.toLowerCase();
          return isProviderHost(host, slug, domainGuessForSearch);
        } catch (e) { return false; }
      }).slice(0, 8);
      if (found.length < foundAll.length) {
        log.push({ time: now(), action: 'search', url: src.url, status: 'filtered_' + (foundAll.length - found.length), detail: 'Filtered out ' + (foundAll.length - found.length) + ' generic OAuth pages that are not specific to ' + app + '.' });
      }
      candidateUrls = candidateUrls.concat(found.filter(u => !candidateUrls.includes(u)));
      log.push({ time: now(), action: 'search', url: src.url, status: 'found_' + found.length, detail: 'Search ' + src.name + ' returned ' + found.length + ' direct candidate links.' });
      if (candidateUrls.length >= 4) break;
    } else {
      log.push({ time: now(), action: 'search', url: src.url, status: 'failed_' + search.status, detail: 'Search page could not be fetched. ' + (search.error || '') });
    }
  }
  const mdCandidates = candidateUrls.filter(u => u.includes('/developers/') || u.includes('/docs/')).map(u => u.endsWith('.md') ? u : u + '.md');
  candidateUrls = candidateUrls.concat(mdCandidates.filter(u => !candidateUrls.includes(u))).slice(0, 10);
  const domainGuess = parsed.baseDomain || (parsed.domain + '.com');
  // Site navigation discovery, for genuinely unfamiliar providers.
  // This does not use a hardcoded provider directory. It goes to the provider's
  // own site, follows developer and docs links from the homepage, and reads
  // sitemap and robots files, then filters for OAuth, developer, and API pages.
  // This is the step that must work when search engines block the server.
  const siteHosts = [];
  if (domainGuess) {
    siteHosts.push(domainGuess);
    if (!domainGuess.startsWith('developers.') && !domainGuess.startsWith('docs.')) {
      siteHosts.push('developers.' + domainGuess);
      siteHosts.push('developer.' + domainGuess);
      siteHosts.push('docs.' + domainGuess);
    }
  }
  const navUrls = [];
  for (const host of siteHosts.slice(0, 3)) {
    const homeUrl = 'https://' + host + '/';
    const home = await fetchText(homeUrl, 4000);
    if (home.ok && home.body) {
      const hrefs = Array.from(home.body.matchAll(/href=["']([^"']+)["']/g)).map(m => m[1]);
      const links = [];
      for (const href of hrefs) {
        try {
          const absUrl = new URL(href, homeUrl);
          const abs = absUrl.toString();
          const path = absUrl.pathname.toLowerCase();
          if (abs.startsWith('https://') && (absUrl.hostname.includes(host) || absUrl.hostname.includes(domainGuess))) {
            if (/\.(ico|png|jpg|jpeg|svg|css|js|webmanifest|xml|pdf)(\?|$)/.test(path)) continue;
            if (path.startsWith('/apps/') || path.includes('/capabilities/') || path.includes('/login') || path.includes('/signup') || path.includes('/pricing') || path.includes('/blog/')) continue;
            const isDoc = path.includes('/oauth') || path.includes('/developer') || path.includes('/docs/') || path === '/docs' || path.includes('/api/');
            if (isDoc && !links.includes(abs)) links.push(abs);
          }
        } catch (e) {}
      }
      links.sort((a, b) => {
        const score = u => u.toLowerCase().includes('/oauth') ? 0 : u.toLowerCase().includes('/docs/') ? 1 : u.toLowerCase().includes('/developer') ? 2 : 3;
        return score(a) - score(b);
      });
      log.push({ time: now(), action: 'site_navigation', url: homeUrl, status: 'found_' + links.length, detail: 'Homepage navigation found ' + links.length + ' developer, docs, or API links.' });
      navUrls.push(...links.slice(0, 6));
    } else {
      log.push({ time: now(), action: 'site_navigation', url: homeUrl, status: 'failed_' + home.status, detail: 'Homepage could not be fetched. ' + (home.error || '') });
    }
    // Sitemap and robots, for each host, limited to one sitemap per host to save time.
    for (const path of ['/sitemap.xml']) {
      const smUrl = 'https://' + host + path;
      const sm = await fetchText(smUrl, 4000);
      if (sm.ok && sm.body) {
        const locs = Array.from(sm.body.matchAll(/<loc>([^<]+)<\/loc>/g)).map(m => m[1].trim());
        const filtered = locs.filter(u => {
          try {
            const path = new URL(u).pathname.toLowerCase();
            if (/\.(ico|png|jpg|jpeg|svg|css|js|webmanifest|pdf)(\?|$)/.test(path)) return false;
            if (path.startsWith('/apps/')) return false;
            return path.includes('/oauth') || path.includes('/developer') || path.includes('/docs/oauth') || path.includes('/docs/auth') || path.includes('/docs/scopes') || path.includes('/api/oauth') || path.includes('/getting-started-with-oauth');
          } catch (e) { return false; }
        });
        if (filtered.length) {
          log.push({ time: now(), action: 'sitemap', url: smUrl, status: 'found_' + filtered.length, detail: 'Sitemap or robots file listed ' + filtered.length + ' OAuth, developer, or API pages.' });
          navUrls.push(...filtered.slice(0, 6));
        }
      }
    }
    if (navUrls.length >= 4) break;
  }
  candidateUrls = navUrls.concat(candidateUrls.filter(u => !navUrls.includes(u)));

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
  const fallbacks = [];
  const fallbackExpanded = [];
  for (const u of fallbacks) {
    fallbackExpanded.push(u);
    if (u.includes('/developers/') || u.includes('/docs/')) fallbackExpanded.push(u + '.md');
  }
  candidateUrls = candidateUrls.concat(fallbackExpanded.filter(u => !candidateUrls.includes(u)));
  // Generic OAuth docs patterns, not provider-specific hardcoded entries.
  // Most developer docs sites use one of these structures, so trying them
  // gives a deterministic discovery path that does not depend on search
  // results or homepage link order.
  const hosts = ['developers.' + domainGuess, 'developer.' + domainGuess];
  const paths = ['/docs/getting-started-with-oauth', '/docs/oauth', '/docs/oauth-2-0-authentication', '/docs/authentication', '/docs/authorization', '/docs/oauth-scopes', '/docs/scopes', '/reference/scopes', '/docs/add-permission-scopes-to-your-app', '/api/oauth'];
  for (const h of hosts) {
    for (const pa of paths) {
      const u = 'https://' + h + pa;
      if (!candidateUrls.includes(u)) candidateUrls.push(u);
    }
  }
  const sources = [];
  const pages = [];
  const directorySet = new Set(Object.values(docsDirectory).flat());
  candidateUrls = candidateUrls.filter((u, i, a) => a.indexOf(u) === i);
  candidateUrls.sort((a, b) => {
    const score = u => {
      const low = u.toLowerCase();
      let s = 0;
      if (low.includes('oauth')) s = 0;
      else if (low.includes('scopes') || low.includes('permissions')) s = 1;
      else if (low.includes('authentication') || low.includes('authorization')) s = 2;
      else if (low.includes('/developer') || low.includes('/docs/')) s = 3;
      else s = 4;
      if (low.includes('community.') || low.includes('/forum') || low.includes('reddit.com') || low.includes('/blog/')) s += 10;
      return s;
    };
    return score(a) - score(b);
  });
  // Readme.io docs, used by Miro, Pipedrive, and others, publish a full markdown version
  // at the same URL plus .md, which contains the real guide text that the JS page hides.
  // Try the .md variant right after the original docs page.
  const expanded = candidateUrls.slice();
  for (const u of candidateUrls) {
    if ((u.includes('/docs/') || u.includes('/developer')) && !u.endsWith('.md')) {
      const md = u + '.md';
      if (!candidateUrls.includes(md)) expanded.push(md);
    }
  }
  candidateUrls = expanded;
  const fetchQueue = candidateUrls.slice(0, 20);
  const visited = new Set();
  for (let qi = 0; qi < fetchQueue.length && qi < 20; qi++) {
    const url = fetchQueue[qi];
    if (visited.has(url)) continue;
    visited.add(url);
    try { const pp = new URL(url).pathname.toLowerCase(); if (url.includes('#content') || /\.(ico|png|jpg|jpeg|svg|css|js|webmanifest|pdf)(\?|$)/.test(pp) || pp.startsWith('/apps/')) continue; } catch (e) {}
    if (!directorySet.has(url)) {
      try {
        const host = new URL(url).hostname.toLowerCase();
        const isProvider = isProviderHost(host, slug, domainGuess);
        if (!isProvider) { log.push({ time: now(), action: 'fetch_page', url: url, status: 'skipped_not_provider', detail: 'Skipped generic page, not specific to ' + app + '.' }); continue; }
      } catch (e) {}
    }
    const page = await fetchText(url, 4000);
    if (page.ok && page.body) {
      const text = stripHtml(page.body);
      const hasOAuth = /oauth/i.test(text);
      const hasClient = /client[ _-]id/i.test(text);
      const hasRedirect = /redirect/i.test(text);
      const hasScope = /scope/i.test(text);
      log.push({ time: now(), action: 'fetch_page', url: url, status: 'ok_' + page.status + (page.viaProxy ? '_via_proxy' : ''), detail: 'Fetched' + (page.viaProxy ? ' via AllOrigins proxy after direct fetch failed with ' + page.directStatus : '') + '. OAuth mention: ' + hasOAuth + ', client ID mention: ' + hasClient + ', redirect mention: ' + hasRedirect + ', scope mention: ' + hasScope + '. Text length: ' + text.length + '.' });
      if (hasOAuth || hasClient || hasScope) {
        const cleanUrl = url.split('#')[0];
        if (!sources.includes(cleanUrl)) sources.push(cleanUrl); else { log.push({ time: now(), action: 'fetch_page', url: url, status: 'skipped_duplicate', detail: 'Duplicate source without fragment, already counted.' }); }
        pages.push({ url, text });
        // Follow scopes and OAuth links from this docs page, for example Miro's
        // scopes page links to its scopes reference page, which lists the actual tokens.
        try {
          const hrefs = Array.from(page.body.matchAll(/href=["']([^"']+)["']/g)).map(m => m[1]).concat(Array.from(page.body.matchAll(/\[[^\]]+\]\((https:[^)]+)\)/g)).map(m => m[1]));
          for (const href of hrefs) {
            try {
              const abs = new URL(href, url).toString();
              const path = new URL(abs).pathname.toLowerCase();
              if ((path.includes('scope') || path.includes('oauth')) && !visited.has(abs) && !fetchQueue.includes(abs) && fetchQueue.length < 25) {
                const host = new URL(abs).hostname.toLowerCase();
                if (isProviderHost(host, slug, domainGuess)) fetchQueue.push(abs);
              }
            } catch (e) {}
          }
        } catch (e) {}
      } else {
        log.push({ time: now(), action: 'fetch_page', url: url, status: 'skipped', detail: 'Page fetched but contained no OAuth, client ID, or scope claims, so it was not used as a source.' });
      }
    } else {
      log.push({ time: now(), action: 'fetch_page', url: url, status: 'failed_' + page.status, detail: 'Could not fetch page. ' + (page.error || '') });
    }
    if (sources.length >= 5) break;
    if (sources.length >= 3) {
      const soFar = pages.map(p => p.text).join(' ');
      const hasScopeSoFar = /[a-z][a-z0-9_]*:[a-z][a-z0-9_]*/.test(soFar);
      const hasEndpointSoFar = /https:\/\/[^\s"'<>]+(?:authorize|token)/i.test(soFar);
      if (hasScopeSoFar && hasEndpointSoFar) break;
    }
  }
  const allText = pages.map(p => p.text).join(' ');
  const scopes = extractScopes(allText);
  const endpoints = extractEndpoints(allText, slug, domainGuess);
  const authorizeEndpoints = endpoints.filter(u => /authorize/i.test(u));
  const tokenEndpoints = endpoints.filter(u => /token/i.test(u));
  const cleanSnippet = s => { if (!s) return ''; const cut = s.slice(0, 280); const lastPeriod = cut.lastIndexOf('.'); return (lastPeriod > 80 ? cut.slice(0, lastPeriod + 1) : cut).trim(); };
  const hasApproval = /app review|app approval|submit for review|review process|approval process|publish.*app|public app|distribution/i.test(allText);
  const hasRedirect = /redirect/i.test(allText);
  const hasClient = /client[ _-]id/i.test(allText);
  const hasBusiness = /business verification|company verification/i.test(allText);
  const hasSensitive = /sensitive scope|restricted scope/i.test(allText);
  const hasWrite = scopes.some(s => s.endsWith(':write') || s.includes('.write') || s.includes(':write'));
  const registerSnippet = snippetFor(allText, ['register an oauth', 'register a new oauth', 'create an oauth app', 'create a new app', 'register your app', 'register an application', 'create your app', 'created your app', 'create a developer team', 'created a developer team']);
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
    setupTime = 'Estimate: 1 to 2 hours for a first test (not a published provider time, based on registration, redirect, and scope steps found in sources, plus review time if required)';
  } else if (sources.length) {
    setupTime = 'Unknown, registration steps were not fully found in fetched pages';
  }
  const confidence = (sources.length >= 2 && hasClient && (scopes.length > 0 || endpoints.length > 0)) || (sources.length >= 1 && hasClient && endpoints.length > 0) ? 'Medium' : 'Low';
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
      { title: 'Register the app', detail: sources.length ? 'Action: open ' + (sources[0] || 'the official developer portal') + ', sign in, create a new OAuth app, give it a name, and save the Client ID it shows you. Do not share the Client Secret, store it securely.' + (registerSnippet ? ' Evidence from docs: ' + cleanSnippet(registerSnippet) : '') : 'No registration snippet was found in fetched pages. Action: open the official developer portal from the sources below, sign in, create a new OAuth app, and confirm the exact registration fields before building.', who: 'human', time: '20 minutes for registration, plus test time', blockerTip: 'If the portal is not official, stop and mark the guide as unverified.' },
      { title: 'Set the redirect URI', detail: 'Action: in your new app settings, add the exact redirect URI from your code, including host, path, and https, then save it. It must match your code character for character.' + (redirectSnippet ? ' Evidence from docs: ' + cleanSnippet(redirectSnippet) : ' No redirect rule was found in fetched pages, so copy it from your code and check it against official docs.'), who: 'human', time: '10 minutes', blockerTip: 'A redirect mismatch is the most common first failure. Do not guess the URI.' },
      { title: 'Choose scopes from retrieved docs', detail: scopes.length ? 'Action: request only these scopes, and only the ones your feature uses: ' + scopes.join(', ') + '. Verify each one against official docs before you request it. Invalid tokens such as client_id and client_secret are filtered out and are not scopes.' : 'Action: open the first source below, find its scopes or permissions page, list every scope your feature needs, and request only those. No valid scope tokens were extracted in this run, so do not guess a scope list.', who: 'agent', time: '20 minutes', blockerTip: 'A single sensitive scope can change the whole timeline.' },
      { title: 'Build the authorize and token flow', detail: endpoints.length ? 'Action: send the user to the authorize endpoint' + (authorizeEndpoints.length ? ': ' + authorizeEndpoints.join(', ') : '') + ', then exchange the code they return at the token endpoint' + (tokenEndpoints.length ? ': ' + tokenEndpoints.join(', ') : '') + '. Store tokens securely, never in client code.' : 'Action: find the authorize endpoint and the token endpoint in official docs first, then build the flow. No authorize or token endpoints were found in fetched pages.', who: 'agent', time: '30 minutes', blockerTip: 'Store client secrets securely. If a secret is exposed, rotate it.' },
      { title: 'Test and review', detail: 'Action: test consent with a real account, confirm the token works for one read call, then check whether publishing or listing needs a separate review.' + (hasApproval ? ' ' + (cleanSnippet(reviewSnippet) ? 'Evidence from docs: ' + cleanSnippet(reviewSnippet) + ' ' : '') + 'Note: authentication and app review are different. Authentication gives a user token. App review is publishing or listing your app, with its own approval checklist, and it does not replace authentication.' : ' No approval or review claim was verified in fetched pages, so mark review timeline as Unknown until official review docs are checked.'), who: 'human', time: '20 minutes for a first test', blockerTip: 'If review docs are missing, mark timeline as Unknown.' }
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
  if (/api key/i.test(allText) && scopes.length === 0 && endpoints.length === 0 && !registerSnippet) {
    guide.blockers.push({ blocker: 'Platform may use API keys instead of OAuth', fix: 'Fetched docs mention API keys and no valid OAuth scopes were found. Confirm OAuth support on official docs before building an OAuth flow, and do not present API key access as OAuth.' });
    guide.nextStep = 'Confirm whether ' + app + ' supports OAuth at all. Fetched docs mention API keys, and no valid OAuth scopes were found in this run.';
  }
  log.push({ time: now(), action: 'generate_guide', url: '', status: 'complete', detail: 'Generated guide with ' + sources.length + ' sources, ' + scopes.length + ' scope-like tokens, confidence ' + confidence + '.' });
  guide.executionLog = log;
  res.status(200).json({ guide: guide, log: log });
};
