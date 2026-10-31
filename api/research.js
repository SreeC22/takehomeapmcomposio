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
  const blocked = new Set(['client', 'client_id', 'client_secret', 'access_token', 'refresh_token', 'token', 'secret', 'id', 'code', 'authorization', 'grant', 'redirect_uri', 'urn', 'params', 'type', 'response', 'grant_type', 'device_code', 'twitter', 'og', 'fb', 'eip155', 'display', 'src', 'style', 'width', 'transition', 'button', 'root', 'items', 'decoration', 'font', 'background', 'color', 'margin', 'padding', 'border', 'position', 'overflow', 'flex', 'grid', 'text', 'line', 'content', 'cursor', 'opacity', 'visibility', 'height', 'max', 'min']);
  const blockedSecond = new Set(['hover', 'not', 'last', 'first', 'focus', 'active', 'visited', 'checked', 'disabled', 'enabled', 'before', 'after', 'nth', 'only', 'empty']);
  const dotAllowedLast = new Set(['read', 'write', 'info', 'metadata', 'content', 'member', 'delete', 'create', 'update']);
  function collect(onlyNearScope) {
    const found = new Set();
    const patterns = [
      /\b[a-z][a-z0-9_]*:[a-z][a-z0-9_]*\b/g,
      /\b[a-z][a-z0-9_]*\.[a-z][a-z0-9_]+(?:\.[a-z][a-z0-9_]+)?\b/g
    ];
    for (const re of patterns) {
      let m;
      while ((m = re.exec(text)) !== null) {
        const s = m[0].toLowerCase();
        if (onlyNearScope) {
          const ctx = text.slice(Math.max(0, m.index - 500), Math.min(text.length, m.index + 500)).toLowerCase();
          if (!ctx.includes('scope')) continue;
        }
        // Skip CSS selectors and declarations: a token followed by a
        // rule brace, a CSS pseudo-class, or an !important nearby is
        // style, not an OAuth scope.
        const after = text.slice(m.index + m[0].length, m.index + m[0].length + 10);
        if (after.trimStart().startsWith('{')) continue;
        const before100 = text.slice(Math.max(0, m.index - 100), m.index);
        if (before100.includes('!important')) continue;
        if (s.includes('http') || s.length > 60) continue;
        if (s.endsWith('.com') || s.endsWith('.json') || s.endsWith('.md') || s.endsWith('.html') || s.endsWith('.txt') || s.endsWith('.pdf')) continue;
        if (s.includes('.') && !dotAllowedLast.has(s.split('.').pop())) continue;
        if (s.includes('.') && (s.split('.')[0] === 'api' || s.split('.')[0] === 'www')) continue;
        const parts = s.split(/[:.]/);
        if (parts.some(part => blocked.has(part))) continue;
        if (parts.length > 1 && blockedSecond.has(parts[parts.length - 1])) continue;
        if (parts[0].length < 3 || parts[parts.length - 1].length < 3) continue;
        found.add(s);
        if (found.size >= 14) break;
      }
      if (found.size >= 14) break;
    }
    return Array.from(found);
  }
  // Prefer tokens near a scope mention, which is where real OAuth scopes
  // live in lists, tables, and JSON scope fields. This avoids the CSS
  // tokens that fill the first 14 slots on styled docs pages like Zapier,
  // while still capturing Miro boards:write, which sits in a JSON scope
  // field. Fall back to a whole-text scan only if no near-scope token
  // was found at all.
  const near = collect(true);
  if (near.length) return near;
  return collect(false);
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
async function fetchText(url, timeoutMs, allowProxy) {
  const direct = await fetchOnce(url, timeoutMs);
  if (direct.ok && direct.body && direct.body.length > 200) return direct;
  if (direct.status === 404) return direct;
  if (!allowProxy) return direct;
  // Proxy retry: search engines and some docs sites block datacenter IPs with 403 or 429.
  // AllOrigins is a public proxy whose IP is not the Vercel server IP, so it can
  // fetch pages that direct fetch cannot. The source URL is still the original URL,
  // the proxy is only transport, and the retry is logged by the caller via status.
  try {
    const proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url);
    const proxy = await fetchOnce(proxyUrl, 5000);
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
// Cache, per instance, 24 hours, successful guides only. Vercel serverless
// functions are stateless across instances, so this is a per-instance cache,
// not a global guarantee. It still makes repeat requests on a warm instance
// near instant, and it costs no Tavily credits on a cache hit.
const guideCache = globalThis.__researchGuideCache || (globalThis.__researchGuideCache = new Map());
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
module.exports = async (req, res) => {
  const t0 = Date.now();
  const rawApp = String((req.query && req.query.app) || '').trim();
  if (!rawApp) { res.status(400).json({ error: 'Missing app name' }); return; }
  const forceRefresh = String((req.query && (req.query.refresh || req.query.force)) || '') === '1';
  const parsed = parseInput(rawApp);
  const app = parsed.app;
  const slug = parsed.slug;
  const domainGuess = parsed.baseDomain || (parsed.domain + '.com');
  const domainGuessForSearch = domainGuess;
  // Cache first, before rate limiting and before any Tavily call.
  if (!forceRefresh) {
    const cached = guideCache.get(slug);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      const timings = { searchMs: 0, retrievalMs: 0, extractionMs: 0, totalMs: Date.now() - t0, cached: true };
      res.status(200).json({ guide: cached.guide, log: cached.log, timings, cached: true });
      return;
    }
  }
  const clientIp = String((req.headers && (req.headers['x-forwarded-for'] || '')) || '').split(',')[0].trim() || 'unknown';
  const rateError = rateCheck(clientIp);
  if (rateError) { res.status(429).json({ error: rateError }); return; }
  const log = [];
  const now = () => new Date().toISOString();
  log.push({ time: now(), action: 'start_research', url: '', status: 'started', detail: 'Researching ' + app + ' for official developer and OAuth docs.' });
  log.push({ time: now(), action: 'parse_input', url: '', status: parsed.hostname ? 'hostname_' + parsed.hostname : 'name_only', detail: 'Input ' + parsed.input + ' parsed to app ' + app + ', slug ' + slug + (parsed.hostname ? ', hostname ' + parsed.hostname : '') + '. Website URLs are parsed to hostname first, never turned into a guessed domain.' });
  // Search stage, timed. Tavily first, and only Tavily when it returns enough.
  const tSearch0 = Date.now();
  let tavilyUrls = [];
  let tavilyOk = false;
  if (process.env.TAVILY_API_KEY && !(tavilyCallsToday.day === new Date().toISOString().slice(0, 10) && tavilyCallsToday.count >= 200)) {
    if (tavilyCallsToday.day !== new Date().toISOString().slice(0, 10)) { tavilyCallsToday.day = new Date().toISOString().slice(0, 10); tavilyCallsToday.count = 0; }
    tavilyCallsToday.count += 1;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      let tavRes, tavJson;
      try {
        tavRes = await fetch('https://api.tavily.com/search', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + process.env.TAVILY_API_KEY }, body: JSON.stringify({ query: app + ' OAuth developer docs register app scopes', search_depth: 'basic', max_results: 8 }), signal: controller.signal });
        tavJson = await tavRes.json().catch(() => ({}));
      } finally { clearTimeout(timer); }
      const allUrls = (tavJson.results || []).map(r => r.url).filter(u => typeof u === 'string' && u.startsWith('http'));
      const providerUrls = allUrls.filter(u => { try { return isProviderHost(new URL(u).hostname.toLowerCase(), slug, domainGuessForSearch); } catch (e) { return false; } });
      const rankUrl = (u) => {
        try {
          const uu = new URL(u);
          const host = uu.hostname.toLowerCase();
          const path = uu.pathname.toLowerCase();
          if (host.startsWith('community.') || host.startsWith('forum.') || path.includes('/blog/')) return 100;
          if (host.startsWith('developers.') || host.startsWith('developer.') || host.startsWith('docs.')) return 0;
          if (path.includes('/oauth') || path.includes('/docs/') || path.includes('/developer')) return 1;
          return 2;
        } catch (e) { return 3; }
      };
      const officialUrls = providerUrls.filter(u => rankUrl(u) < 100).sort((a, b) => rankUrl(a) - rankUrl(b));
      tavilyUrls = (officialUrls.length ? officialUrls : providerUrls.sort((a, b) => rankUrl(a) - rankUrl(b))).slice(0, 8);
      tavilyOk = !!(tavRes && tavRes.ok);
      log.push({ time: now(), action: 'search', url: 'https://api.tavily.com/search', status: tavilyOk ? 'found_' + tavilyUrls.length : 'failed_' + (tavRes ? tavRes.status : 0), detail: 'Tavily search returned ' + allUrls.length + ' URLs, ' + tavilyUrls.length + ' provider-specific.' });
    } catch (e) {
      log.push({ time: now(), action: 'search', url: 'https://api.tavily.com/search', status: 'failed', detail: 'Tavily search failed, falling back to site navigation. ' + String(e && e.message ? e.message : e) });
    }
  } else if (process.env.TAVILY_API_KEY) {
    log.push({ time: now(), action: 'search', url: 'https://api.tavily.com/search', status: 'skipped_rate_limit', detail: 'Per-instance Tavily daily cap reached, using site navigation fallback instead, so the key is not burned.' });
  } else {
    log.push({ time: now(), action: 'search', url: 'https://api.tavily.com/search', status: 'skipped_no_key', detail: 'No TAVILY_API_KEY set, skipping Tavily and using site navigation fallback.' });
  }
  const searchMs = Date.now() - tSearch0;
  // Retrieval stage, timed. Parallel batches, early stopping, no speculative waste.
  const tRetrieval0 = Date.now();
  const docsDirectory = {
    typeform: ['https://www.typeform.com/developers/get-started/scopes/', 'https://www.typeform.com/developers/get-started/applications/'],
    linear: ['https://linear.app/developers/oauth-2-0-authentication'],
    dropbox: ['https://docs.dropboxapi.com/dropbox-api/docs/oauth', 'https://dropbox.tech/developers/customizing-scopes-in-oauth-flow'],
    github: ['https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app', 'https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps'],
    figma: ['https://developers.figma.com/docs/rest-api/oauth-apps/'],
    airtable: ['https://airtable.com/developers/web/guides/oauth-integrations.md']
  };
  const directoryUrls = docsDirectory[slug] || [];
  const sources = [];
  const pages = [];
  const visited = new Set();
  function evidenceSoFar() {
    const text = pages.map(p => p.text).join(' ');
    return {
      text,
      scopes: extractScopes(text),
      endpoints: extractEndpoints(text, slug, domainGuess),
      hasClient: /client[ _-]id/i.test(text),
      hasRedirect: /redirect/i.test(text),
      hasApproval: /app review|app approval|submit for review|review process|approval process|publish.*app|public app|distribution/i.test(text)
    };
  }
  function sufficient(ev) {
    return sources.length >= 2 && ev.hasClient && ev.hasRedirect && ev.scopes.length > 0 && ev.endpoints.length > 0;
  }
  async function fetchBatch(urls, allowProxy) {
    const batch = urls.filter(u => !visited.has(u)).slice(0, 4);
    batch.forEach(u => visited.add(u));
    if (!batch.length) return [];
    const results = await Promise.allSettled(batch.map(async (url) => {
      try {
        const pp = new URL(url).pathname.toLowerCase();
        if (url.includes('#content') || /\.(ico|png|jpg|jpeg|svg|css|js|webmanifest|pdf)(\?|$)/.test(pp) || pp.startsWith('/apps/')) return null;
        try { const hu = new URL(url); if (hu.hostname.startsWith('community.') || hu.hostname.startsWith('forum.') || hu.pathname.toLowerCase().includes('/blog/')) return null; } catch (e) { return null; }
      } catch (e) { return null; }
      const page = await fetchText(url, 3000, allowProxy);
      if (page.ok && page.body) {
        const text = stripHtml(page.body);
        const hasOAuth = /oauth/i.test(text);
        const hasClient = /client[ _-]id/i.test(text);
        const hasScope = /scope/i.test(text);
        log.push({ time: now(), action: 'fetch_page', url: url, status: 'ok_' + page.status + (page.viaProxy ? '_via_proxy' : ''), detail: 'Fetched. OAuth mention: ' + hasOAuth + ', client ID mention: ' + hasClient + ', scope mention: ' + hasScope + '. Text length: ' + text.length + '.' });
        if (hasOAuth || hasClient || hasScope) {
          const cleanUrl = url.split('#')[0];
          if (!sources.includes(cleanUrl)) sources.push(cleanUrl);
          return { url, text };
        }
        // Short JS shell only: try the .md variant once, in the next batch, not speculatively for every URL.
        if (text.length < 2000 && (url.includes('/docs/') || url.includes('/developer')) && !url.endsWith('.md')) {
          return { url, text, mdCandidate: url + '.md' };
        }
        return null;
      }
      log.push({ time: now(), action: 'fetch_page', url: url, status: 'failed_' + page.status, detail: 'Could not fetch page. ' + (page.error || '') });
      return null;
    }));
    const out = [];
    const mdNext = [];
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) {
        if (r.value.mdCandidate) mdNext.push(r.value.mdCandidate);
        else out.push(r.value);
      }
    }
    pages.push(...out);
    return mdNext;
  }
  // Batch 1: Tavily top 4, plus directory URLs if any, in parallel.
  let mdCandidates = await fetchBatch(tavilyUrls.slice(0, 4).concat(directoryUrls).slice(0, 4), true);
  // Batch 2: remaining Tavily URLs, if evidence is not yet sufficient.
  if (!sufficient(evidenceSoFar())) {
    mdCandidates = mdCandidates.concat(await fetchBatch(tavilyUrls.slice(4), true));
  }
  // Batch 3: .md variants only for short JS shells found above, parallel, no proxy.
  if (!sufficient(evidenceSoFar()) && mdCandidates.length) {
    await fetchBatch(mdCandidates.slice(0, 3), false);
  }
  // Batch 4: site navigation fallback, only if evidence is still incomplete.
  // Homepages for base, developers, developer, and docs hosts in parallel,
  // plus sitemaps for base and developers hosts in parallel, then top 4
  // nav links in parallel. This restores providers like Trello, whose
  // docs live on developers.trello.com, not on trello.com itself.
  if (!sufficient(evidenceSoFar()) && domainGuess) {
    const homeUrl = 'https://' + domainGuess + '/';
    const navHosts = [domainGuess, 'developers.' + domainGuess, 'developer.' + domainGuess, 'docs.' + domainGuess];
    const navFetches = navHosts.map(h => fetchText('https://' + h + '/', 3000, false));
    navFetches.push(fetchText('https://' + domainGuess + '/sitemap.xml', 3000, false));
    navFetches.push(fetchText('https://developers.' + domainGuess + '/sitemap.xml', 3000, false));
    const navResults = await Promise.allSettled(navFetches);
    const navUrls = [];
    for (let hi = 0; hi < navHosts.length; hi++) {
      const home = navResults[hi];
      if (home.status === 'fulfilled' && home.value.ok && home.value.body) {
        const baseUrl = 'https://' + navHosts[hi] + '/';
        const hrefs = Array.from(home.value.body.matchAll(/href=["']([^"']+)["']/g)).map(m => m[1]);
        for (const href of hrefs) {
          try {
            const absUrl = new URL(href, baseUrl);
            const abs = absUrl.toString();
            const path = absUrl.pathname.toLowerCase();
            if (abs.startsWith('https://') && isProviderHost(absUrl.hostname.toLowerCase(), slug, domainGuess)) {
              if (/\.(ico|png|jpg|jpeg|svg|css|js|webmanifest|xml|pdf)(\?|$)/.test(path)) continue;
              if (path.startsWith('/apps/') || path.includes('/login') || path.includes('/signup') || path.includes('/pricing') || path.includes('/blog/')) continue;
              if (absUrl.hostname.startsWith('community.') || absUrl.hostname.startsWith('forum.')) continue;
              if (path.includes('/oauth') || path.includes('/developer') || path.includes('/docs/') || path.includes('/api/')) navUrls.push(abs);
            }
          } catch (e) {}
        }
      }
    }
    for (let si = navHosts.length; si < navResults.length; si++) {
      const sm = navResults[si];
      if (sm.status === 'fulfilled' && sm.value.ok && sm.value.body) {
        const locs = Array.from(sm.value.body.matchAll(/<loc>([^<]+)<\/loc>/g)).map(m => m[1].trim());
        for (const u of locs) {
          try {
            const uu = new URL(u);
            const path = uu.pathname.toLowerCase();
            if (!isProviderHost(uu.hostname.toLowerCase(), slug, domainGuess)) continue;
            if (uu.hostname.startsWith('community.') || uu.hostname.startsWith('forum.') || path.includes('/blog/')) continue;
            if (path.includes('/oauth') || path.includes('/developer') || path.includes('/docs/oauth') || path.includes('/docs/auth') || path.includes('/docs/scopes') || path.includes('/api/oauth')) navUrls.push(u);
          } catch (e) {}
        }
      }
    }
    log.push({ time: now(), action: 'site_navigation', url: homeUrl, status: 'found_' + navUrls.length, detail: 'Homepages and sitemaps for base, developers, developer, and docs hosts found ' + navUrls.length + ' developer, docs, or API links.' });
    const rankNav = (u) => {
      try {
        const uu = new URL(u);
        const path = uu.pathname.toLowerCase();
        if (path.includes('/oauth')) return 0;
        if (path.includes('/docs/') || path.includes('/developer')) return 1;
        return 2;
      } catch (e) { return 3; }
    };
    const uniqueNav = navUrls.filter((u, i, a) => a.indexOf(u) === i).sort((a, b) => rankNav(a) - rankNav(b)).slice(0, 4);
    if (uniqueNav.length) await fetchBatch(uniqueNav, false);
  }
  // Batch 4b: generic OAuth docs patterns, parallel, no proxy, only if
  // evidence is still incomplete. This restores the Asana oauth page,
  // which navigation links may not surface directly.
  if (!sufficient(evidenceSoFar()) && domainGuess) {
    const patternUrls = [
      'https://developers.' + domainGuess + '/docs/oauth',
      'https://developer.' + domainGuess + '/docs/oauth',
      'https://developers.' + domainGuess + '/docs/authentication',
      'https://developer.' + domainGuess + '/docs/authentication'
    ];
    await fetchBatch(patternUrls, false);
  }
  // Batch 5: one backup search engine, direct only, no proxy, only if still incomplete.
  if (!sufficient(evidenceSoFar()) && tavilyUrls.length < 3) {
    const searchUrl = 'https://lite.duckduckgo.com/lite/?q=' + encodeURIComponent(app + ' OAuth developer docs register app scopes');
    log.push({ time: now(), action: 'search', url: searchUrl, status: 'attempted', detail: 'Searching duckduckgo_lite as a last resort, direct only, no proxy.' });
    const search = await fetchText(searchUrl, 3000, false);
    if (search.ok && search.body) {
      const direct = Array.from(search.body.matchAll(/href="([^"]+)"/g)).map(m => m[1]).filter(u => u && u.startsWith('http') && !u.includes('duckduckgo.com'));
      const found = direct.filter(u => { try { return isProviderHost(new URL(u).hostname.toLowerCase(), slug, domainGuessForSearch); } catch (e) { return false; } }).slice(0, 3);
      log.push({ time: now(), action: 'search', url: searchUrl, status: 'found_' + found.length, detail: 'Backup search returned ' + found.length + ' provider-specific links.' });
      if (found.length) await fetchBatch(found, false);
    } else {
      log.push({ time: now(), action: 'search', url: searchUrl, status: 'failed_' + search.status, detail: 'Backup search page could not be fetched.' });
    }
  }
  const retrievalMs = Date.now() - tRetrieval0;
  // Extraction stage, timed.
  const tExtraction0 = Date.now();
  const ev = evidenceSoFar();
  const allText = ev.text;
  const scopes = ev.scopes;
  const endpoints = ev.endpoints;
  const hasApproval = ev.hasApproval;
  const hasRedirect = ev.hasRedirect;
  const hasClient = ev.hasClient;
  const hasBusiness = /business verification|company verification/i.test(allText);
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
  const cleanSnippet = s => { if (!s) return ''; const cut = s.slice(0, 280); const lastPeriod = cut.lastIndexOf('.'); return (lastPeriod > 80 ? cut.slice(0, lastPeriod + 1) : cut).trim(); };
  const authorizeEndpoints = endpoints.filter(u => /authorize/i.test(u));
  const tokenEndpoints = endpoints.filter(u => /token/i.test(u));
  const guide = {
    id: 'generated-' + slug,
    name: app,
    category: 'Generated, from live research',
    difficulty: difficulty,
    difficultyWhy: difficultyWhy,
    setupTime: setupTime,
    approvalWait: hasApproval ? 'Varies, see sources. No fixed timeline was confirmed in this research run.' : 'Unknown, do not promise a date until review docs are checked',
    accountNeeded: sources.length ? 'Provider developer account, see first source' : 'Unknown, check the provider developer docs',
    cost: 'Unknown, check provider pricing in official docs',
    consoleName: sources.length ? 'Official developer portal, see sources' : 'Unknown, find the official developer console first',
    consoleUrl: consoleUrl,
    guideType: 'full',
    verificationStatus: sources.length >= 2 ? 'Docs checked, 2 or more sources, no sign-in test' : sources.length === 1 ? 'Partially verified, single source, no sign-in test' : 'Unverified, no official source fetched, no sign-in test',
    confidence: confidence,
    managedAppNote: 'Check first whether a managed app already covers this platform. If it does, you may not need your own app.',
    nextStep: sources.length ? 'Open the first source below, confirm the registration fields and redirect URL, then list scopes before building.' : 'Find the official developer console and registration docs for ' + app + ', then list scopes and review triggers before building.',
    steps: [
      { title: 'Register the app', detail: sources.length ? 'Action: open ' + (sources[0] || 'the official developer portal') + ', sign in, create a new OAuth app, give it a name, and save the Client ID it shows you. Do not share the Client Secret, store it securely.' + (registerSnippet ? ' Evidence from docs: ' + cleanSnippet(registerSnippet) : '') : 'No registration snippet was found in fetched pages. Action: open the official developer portal from the sources below, sign in, create a new OAuth app, and confirm the exact registration fields before building.', who: 'human', time: '20 minutes for registration, plus test time', blockerTip: 'If the portal is not official, stop and mark the guide as unverified.' },
      { title: 'Set the redirect URI', detail: 'Action: in your new app settings, add the exact redirect URI from your code, including host, path, and https, then save it. It must match your code character for character.' + (redirectSnippet ? ' Evidence from docs: ' + cleanSnippet(redirectSnippet) : ' No redirect rule was found in fetched pages, so copy it from your code and check it against official docs.'), who: 'human', time: '10 minutes', blockerTip: 'A redirect mismatch is the most common first failure. Do not guess the URI.' },
      { title: 'Choose scopes from retrieved docs', detail: scopes.length ? 'Action: request only these scopes, and only the ones your feature uses: ' + scopes.join(', ') + '. Verify each one against official docs before you request it. Invalid tokens such as client_id and client_secret are filtered out and are not scopes.' : 'Action: open the first source below, find its scopes or permissions page, list every scope your feature needs, and request only those. No valid scope tokens were extracted in this run, so do not guess a scope list.', who: 'agent', time: '20 minutes', blockerTip: 'A single sensitive scope can change the whole timeline.' },
      { title: 'Build the authorize and token flow', detail: endpoints.length ? 'Action: send the user to the authorize endpoint' + (authorizeEndpoints.length ? ': ' + authorizeEndpoints.join(', ') : '') + ', then exchange the code they return at the token endpoint' + (tokenEndpoints.length ? ': ' + tokenEndpoints.join(', ') : '') + '. Store tokens securely, never in client code.' : 'Action: find the authorize endpoint and the token endpoint in official docs first, then build the flow. No authorize or token endpoints were found in fetched pages.', who: 'agent', time: '30 minutes', blockerTip: 'Store client secrets securely. If a secret is exposed, rotate it.' },
      { title: 'Test and review', detail: 'Action: test consent with a real account, confirm the token works for one read call, then check whether publishing or listing needs a separate review.' + (hasApproval ? ' ' + (cleanSnippet(reviewSnippet) ? 'Evidence from docs: ' + cleanSnippet(reviewSnippet) + ' ' : '') + 'Note: authentication and app review are different. Authentication gives a user token. App review is publishing or listing your app, with its own approval checklist, and it does not replace authentication.' : ' No approval or review claim was verified in fetched pages, so mark review timeline as Unknown until official review docs are checked.'), who: 'human', time: '20 minutes for a first test', blockerTip: 'If review docs are missing, mark timeline as Unknown.' },
      { title: 'Submit for review and handle feedback', detail: 'Action: prepare a privacy policy URL, a clear app description, a test account, and a justification for every scope, then submit for review. Reply to reviewer questions with the same scope list and test steps. Do not promise a launch date until review is done.', who: 'human', time: 'Unknown, review wait varies', blockerTip: 'An incomplete submission is the most common review delay. Check every checklist item before submitting.' }
    ],
    timeline: [
      { stage: 'Registration', wait: 'Immediate to 1 hour for a first app', note: 'Create the app, record client ID, and store the secret server side.' },
      { stage: 'Redirect and scopes', wait: '30 minutes', note: 'Exact redirect URI and minimum scopes, verified against official docs.' },
      { stage: 'Authorize and token test', wait: '30 minutes', note: 'One real consent flow and one API call with a stored token.' },
      { stage: 'Provider review and publishing', wait: hasApproval ? 'Varies, see sources. No fixed timeline was confirmed in this research run.' : 'Unknown, do not promise a date until review docs are checked', note: 'Authentication is not app review. Publishing or listing needs its own submission.' }
    ],
    checklist: [
      { item: 'Official developer console identified from a fetched source', status: 'required', who: 'agent' },
      { item: 'Registration fields and redirect URIs listed from official docs', status: 'required', who: 'agent' },
      { item: 'Redirect URI matches code exactly', status: 'required', who: 'agent' },
      { item: 'Scopes verified against official docs, minimum only', status: 'required', who: 'agent' },
      { item: 'Client secret stored server side, never in client code', status: 'required', who: 'human' },
      { item: 'One real consent flow and one API call tested', status: 'required', who: 'agent' },
      { item: 'Privacy policy URL live', status: 'required', who: 'human' },
      { item: 'Review submission prepared by a human, with scope justifications', status: 'required', who: 'human' }
    ],
    blockers: [
      { blocker: 'Redirect URL mismatch', fix: 'Copy the exact redirect URL from official docs and from your code, including host and path.' },
      { blocker: 'Scope not available or not verified', fix: 'Check product and scope access on the official portal before building on that API.' },
      { blocker: 'Client secret exposed', fix: 'Rotate the secret at once, remove it from code, logs, and repos, and store the new secret server side.' },
      { blocker: 'Review submission incomplete', fix: 'Add a live privacy policy URL, a test account, and a justification for every scope before resubmitting.' },
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
  const extractionMs = Date.now() - tExtraction0;
  const totalMs = Date.now() - t0;
  const timings = { searchMs, retrievalMs, extractionMs, totalMs, cached: false };
  log.push({ time: now(), action: 'generate_guide', url: '', status: 'complete', detail: 'Generated guide with ' + sources.length + ' sources, ' + scopes.length + ' scope-like tokens, confidence ' + confidence + '. Timings: search ' + searchMs + 'ms, retrieval ' + retrievalMs + 'ms, extraction ' + extractionMs + 'ms, total ' + totalMs + 'ms.' });
  guide.executionLog = log;
  guide.timings = timings;
  if (confidence === 'Medium' && sources.length >= 2) {
    guideCache.set(slug, { guide, log, at: Date.now() });
  }
  res.status(200).json({ guide: guide, log: log, timings, cached: false });
};
