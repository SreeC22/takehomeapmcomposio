// Universal live research engine, deterministic, no LLM, no paid model.
// Multi-stage, evidence-driven: discovery, independent tracks, structured
// facts, requirement engine, evidence-built guides, quality gate.
// Every claim needs a provider source and a passage. Unknown is a result,
// not a gap to fill with a guessed step. No hardcoded provider directory.
// Runs as a Vercel serverless function under /api.
function stripHtml(html) {
  let s = String(html || '');
  // Remove navigation, headers, footers, scripts, styles, tracking, svg.
  s = s.replace(/<nav[\s\S]*?<\/nav>/gi, ' ').replace(/<header[\s\S]*?<\/header>/gi, ' ').replace(/<footer[\s\S]*?<\/footer>/gi, ' ').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ').replace(/<svg[\s\S]*?<\/svg>/gi, ' ');
  // Drop code examples that are not about auth. A code block about an
  // unrelated product feature must not supply scopes or endpoints.
  s = s.replace(/<pre[\s\S]*?<\/pre>/gi, (m) => /oauth|authorize|token|scope|client[ _-]id|api[ _-]key/i.test(m) ? m : ' ');
  // Preserve structure, so a passage keeps its section context.
  s = s.replace(/<h[1-6][^>]*>/gi, '\nSECTION: ').replace(/<\/h[1-6]>/gi, '\n');
  s = s.replace(/<li[^>]*>/gi, '\n- ').replace(/<\/li>/gi, '\n');
  s = s.replace(/<tr[^>]*>/gi, '\n').replace(/<t[dh][^>]*>/gi, ' | ');
  s = s.replace(/<p[^>]*>/gi, '\n').replace(/<\/p>/gi, '\n');
  s = s.replace(/<[^>]+>/g, ' ');
  s = s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/gi, "'").replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  // Collapse spaces on a line, keep newlines as section boundaries.
  s = s.split('\n').map(line => line.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
  return s;
}
function sectionFor(text, idx) {
  const before = String(text || '').slice(0, idx);
  const pos = before.lastIndexOf('SECTION: ');
  if (pos < 0) return '';
  const end = before.indexOf('\n', pos);
  return before.slice(pos + 9, end < 0 ? before.length : end).trim();
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
  try {
    const withScheme = /^https?:\/\//i.test(input) ? input : (input.includes('.') && !input.includes(' ') ? 'https://' + input : '');
    if (withScheme) { const u = new URL(withScheme); hostname = u.hostname.replace(/^www\./, ''); }
  } catch (e) {}
  if (hostname) {
    if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return { input, hostname, baseDomain: hostname, app: hostname, slug: 'ip', domain: hostname, isIp: true };
    const clean = hostname.replace(/^(developers|docs|developer|api|help)\./, '');
    const cp = clean.split('.');
    const main = cp.length >= 2 ? cp[cp.length - 2] : cp[0];
    return { input, hostname, baseDomain: clean, app: main.charAt(0).toUpperCase() + main.slice(1), slug: main.toLowerCase(), domain: clean.toLowerCase() };
  }
  const slug = input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'app';
  return { input, hostname: '', baseDomain: '', app: input, slug, domain: slug.replace(/-/g, '') };
}
function canonicalUrl(u) {
  try {
    const uu = new URL(u.split('#')[0]);
    uu.hostname = uu.hostname.toLowerCase();
    if (uu.pathname.length > 1 && uu.pathname.endsWith('/')) uu.pathname = uu.pathname.slice(0, -1);
    for (const k of Array.from(uu.searchParams.keys())) { if (/^utm_|^fbclid$|^gclid$/.test(k)) uu.searchParams.delete(k); }
    return uu.toString();
  } catch (e) { return u; }
}
function baseDomain(host) {
  const clean = String(host || '').toLowerCase().replace(/^www\./, '');
  const parts = clean.split('.');
  return parts.length >= 2 ? parts.slice(-2).join('.') : clean;
}
function validateScope(s) {
  if (!s || typeof s !== 'string') return false;
  if (s.length > 50 || s.length < 5) return false;
  if (!/^[a-z][a-z0-9_-]+([:.][a-z][a-z0-9_-]+)+$/.test(s)) return false;
  if (s.includes('..') || s.includes('::') || s.includes('._') || s.includes('_.')) return false;
  const parts = s.split(/[:.]/);
  if (parts.some(x => x.length < 3)) return false;
  if (parts.some(x => /^(api|www|http|https|oauth|auth|login|signup|v1|v2|v3|js|css|png|jpg|svg|json|html|md|com|net|org|token|secret|client|id|code|pem|key|crt|cert|xml|yaml|yml|txt|pdf)$/.test(x))) return false;
  if (parts.some(x => /^\d+$/.test(x))) return false;
  return true;
}
function metadataTokenCount(s) {
  return (String(s || '').toLowerCase().match(/\b(cookie|copyright|all rights reserved|newsletter|subscribe|follow us|sitemap|back to top|terms of use)\b/g) || []).length;
}
function extractScopes(text) {
  const blocked = new Set(['client', 'client_id', 'client_secret', 'access_token', 'refresh_token', 'token', 'secret', 'id', 'code', 'authorization', 'grant', 'redirect_uri', 'urn', 'params', 'type', 'response', 'grant_type', 'device_code', 'display', 'src', 'style', 'width', 'transition', 'button', 'root', 'items', 'decoration', 'font', 'background', 'color', 'margin', 'padding', 'border', 'position', 'overflow', 'flex', 'grid', 'text', 'line', 'content', 'cursor', 'opacity', 'visibility', 'height', 'max', 'min']);
  const blockedSecond = new Set(['hover', 'not', 'last', 'first', 'focus', 'active', 'visited', 'checked', 'disabled', 'enabled', 'before', 'after', 'nth', 'only', 'empty']);
  const blockedFirst = new Set(['www', 'api', 'oauth', 'auth', 'login', 'signup', 'http', 'https']);
  const dotAllowedLast = new Set(['read', 'write', 'info', 'metadata', 'content', 'member', 'delete', 'create', 'update']);
  function collect(onlyNearScope) {
    const found = new Set();
    const patterns = [/\b[a-z][a-z0-9_]*:[a-z][a-z0-9_]*\b/g, /\b[a-z][a-z0-9_]*\.[a-z][a-z0-9_]+(?:\.[a-z][a-z0-9_]+)?\b/g];
    for (const re of patterns) {
      let m;
      while ((m = re.exec(text)) !== null) {
        const s = m[0].toLowerCase();
        if (onlyNearScope) { const ctx = text.slice(Math.max(0, m.index - 500), Math.min(text.length, m.index + 500)).toLowerCase(); if (!ctx.includes('scope')) continue; }
        const after = text.slice(m.index + m[0].length, m.index + m[0].length + 10);
        if (after.trimStart().startsWith('{')) continue;
        if (text.slice(Math.max(0, m.index - 100), m.index).includes('!important')) continue;
        if (s.includes('http') || s.length > 60) continue;
        if (s.endsWith('.com') || s.endsWith('.json') || s.endsWith('.md') || s.endsWith('.html') || s.endsWith('.txt') || s.endsWith('.pdf')) continue;
        if (s.includes('.') && !onlyNearScope && !dotAllowedLast.has(s.split('.').pop())) continue;
        if (s.includes('.') && (s.split('.')[0] === 'api' || s.split('.')[0] === 'www')) continue;
        const parts = s.split(/[:.]/);
        if (blockedFirst.has(parts[0])) continue;
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
  const near = collect(true).filter(validateScope);
  if (near.length) return near;
  return collect(false).filter(validateScope);
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
    try {
      const pp = new URL(u); const path = pp.pathname.toLowerCase(); const host = pp.hostname.toLowerCase();
      if (path.includes('/docs/') || path.includes('/reference/') || path.endsWith('.md') || path.endsWith('.png') || path.endsWith('.jpg') || path.endsWith('.jpeg') || path.endsWith('.svg') || path.endsWith('.gif') || path.includes('/attachments') || host.includes('attachments')) continue;
      if (!isProviderHost(host, slug, domainGuess)) continue;
      // Strip query parameters, an endpoint with a sample query is not a clean endpoint.
      pp.search = ''; pp.hash = '';
      found.add(pp.toString());
    } catch (e) { continue; }
    if (found.size >= 6) break;
  }
  return Array.from(found);
}
function extractRelativeEndpoints(pageUrl, text, slug, domainGuess) {
  const found = new Set();
  const re = /(?:^|[\s"'`(])\/([a-z0-9_\-\/]*?(?:authorize|token)[a-z0-9_\-\/]*)/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const rel = '/' + m[1];
    if (rel.includes('/docs/') || rel.includes('/reference/') || rel.endsWith('.md')) continue;
    // A relative path is evidence that an authorize or token path exists.
    // It is NOT a full URL. Resolving it against a docs host would invent
    // an endpoint on the wrong host, so it is stored as a path only.
    found.add(rel);
    if (found.size >= 4) break;
  }
  return Array.from(found);
}
function findSnippet(text, keywords) {
  const lower = text.toLowerCase();
  for (const kw of keywords) {
    let from = 0;
    while (true) {
      const idx = lower.indexOf(kw.toLowerCase(), from);
      if (idx < 0) break;
      // Word boundary after the phrase: "app review" must not match
      // "app reviewer". A modal word attached to a different noun is
      // not evidence for that requirement.
      if (/[a-z]/i.test(text[idx + kw.length] || '')) { from = idx + 1; continue; }
      let start = Math.max(0, idx - 60);
      const lastNl = text.lastIndexOf('\n', idx - 1);
      if (lastNl >= start) start = lastNl + 1;
      else { const ns = text.indexOf(' ', start); if (ns >= 0 && ns < idx) start = ns + 1; }
      let end = Math.min(text.length, idx + 180);
      const period = text.indexOf('.', idx + 30);
      if (period >= 0 && period < end) end = period + 1;
      const ps = text.lastIndexOf(' ', end);
      if (ps > idx) end = ps;
      const rawSnippet = text.slice(start, end).trim();
      if (!/\b(create|register|add|set|configure|submit|request|generate|include|must|required|optional|need|needs|use|log|sign|open|navigate|choose|select|provide|enter|review|approval|verification|publish|list)\b/i.test(rawSnippet)) { from = idx + kw.length; continue; }
      const sec = sectionFor(text, idx);
      const s = sec ? '[Section: ' + sec + '] ' + rawSnippet : rawSnippet;
      if (metadataTokenCount(s) >= 1) { from = idx + kw.length; continue; }
      const navTokens = (s.match(/\b(home|pricing|blog|careers|login|sign up|menu|support|about us)\b/gi) || []).length;
      const hasActionVerb = /\b(create|register|add|configure|submit|set up|build|publish|request)\b/i.test(s);
      const isNavOnly = navTokens >= 3 && !hasActionVerb;
      const isUnrelatedVerification = /\b(email verification|phone verification|two-factor|domain verification)\b/i.test(s) && !/\b(app review|app approval|publish)\b/i.test(s);
      if (s.length > 20 && !/try-it|api key to use|api key for/i.test(s) && !isNavOnly && !isUnrelatedVerification) return s;
      from = idx + kw.length;
    }
  }
  return '';
}
function cleanSnippet(s) {
  if (!s) return '';
  const cut = s.slice(0, 280); const lp = cut.lastIndexOf('.');
  return (lp > 80 ? cut.slice(0, lp + 1) : cut).trim();
}
function timePhrase(snippetText) {
  const m = String(snippetText || '').match(/(\d+\s*(?:business\s+)?days?|\d+\s*weeks?|several\s+weeks|up to\s+\d+\s+\w+)/i);
  return m ? m[0] : '';
}
async function fetchOnce(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'OAuth-Guides-Research/1.0', Accept: 'text/html,application/json' } });
    const body = await res.text();
    return { status: res.status, body, ok: res.ok };
  } catch (e) { return { status: 0, body: '', ok: false, error: String(e && e.message ? e.message : e) }; } finally { clearTimeout(timer); }
}
async function fetchText(url, timeoutMs, allowProxy) {
  const direct = await fetchOnce(url, timeoutMs);
  if (direct.ok && direct.body && direct.body.length > 200) return direct;
  if (direct.status === 404) return direct;
  if (!allowProxy) return direct;
  try {
    const proxy = await fetchOnce('https://api.allorigins.win/raw?url=' + encodeURIComponent(url), 5000);
    if (proxy.ok && proxy.body && proxy.body.length > 200) return { status: 200, body: proxy.body, ok: true, viaProxy: true, directStatus: direct.status };
  } catch (e) {}
  return direct;
}
const rateStore = globalThis.__researchRateStore || (globalThis.__researchRateStore = new Map());
function rateCheck(ip) {
  const now = Date.now();
  const arr = (rateStore.get(ip) || []).filter(ts => now - ts < 3600000);
  if (arr.filter(ts => now - ts < 60000).length >= 5) return 'Too many searches in the last minute. Wait a minute and try again.';
  if (arr.length >= 20) return 'Too many searches in the last hour. Wait and try again later.';
  arr.push(now); rateStore.set(ip, arr); return '';
}
let tavilyCallsToday = globalThis.__tavilyCallsToday || { day: new Date().toISOString().slice(0, 10), count: 0 };
globalThis.__tavilyCallsToday = tavilyCallsToday;
const guideCache = globalThis.__researchGuideCache || (globalThis.__researchGuideCache = new Map());
const docCache = globalThis.__researchDocCache || (globalThis.__researchDocCache = new Map());
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
module.exports = async (req, res) => {
  const t0 = Date.now();
  // Query parsing is robust to Vercel routing variants: req.query first,
  // then the request URL itself. A missing query must not be guessed.
  let queryParams = (req.query || {});
  try {
    if (req.url && String(req.url).includes('?')) {
      const urlParams = new URL(String(req.url), 'https://localhost').searchParams;
      const fromUrl = {};
      urlParams.forEach((v, k) => { fromUrl[k] = v; });
      queryParams = Object.assign({}, fromUrl, queryParams);
    }
  } catch (e) {}
  const rawApp = String(queryParams.app || '').trim();
  if (!rawApp) { res.status(400).json({ error: 'Missing app name' }); return; }
  const forceRefresh = String(queryParams.refresh || queryParams.force || '') === '1';
  const parsed = parseInput(rawApp);
  const app = parsed.app; const slug = parsed.slug;
  let domainGuess = parsed.hostname ? parsed.baseDomain : '';
  if (!forceRefresh) {
    const cached = guideCache.get(slug);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      res.status(200).json({ guide: cached.guide, log: cached.log, timings: { searchMs: 0, retrievalMs: 0, extractionMs: 0, totalMs: Date.now() - t0, cached: true }, cached: true });
      return;
    }
  }
  const clientIp = String((req.headers && (req.headers['x-forwarded-for'] || '')) || '').split(',')[0].trim() || 'unknown';
  const rateError = rateCheck(clientIp);
  if (rateError) { res.status(429).json({ error: rateError }); return; }
  const log = []; const now = () => new Date().toISOString();
  const logPush = (action, url, status, detail) => log.push({ time: now(), action, url, status, detail });
  logPush('start_research', '', 'started', 'Researching ' + app + ' as a multi-stage investigation, not a single keyword search.');
  logPush('parse_input', '', parsed.hostname ? 'hostname_' + parsed.hostname : 'name_only', 'Input ' + parsed.input + ' parsed to app ' + app + ', slug ' + slug + (parsed.hostname ? ', hostname ' + parsed.hostname : '') + '. TLD is preserved, .com is never assumed.');
  if (parsed.isIp) {
    logPush('provider_discovery', '', 'failed_ip', 'Input is an IP address, not a provider. No provider host can be validated, so no fetch is attempted.');
  }
  // Stage A: provider discovery, parallel targeted Tavily searches, budget 3.
  const tSearch0 = Date.now();
  let tavilyCallsUsed = 0;
  async function tavilySearch(query) {
    if (!process.env.TAVILY_API_KEY) return [];
    if (tavilyCallsToday.day !== new Date().toISOString().slice(0, 10)) { tavilyCallsToday.day = new Date().toISOString().slice(0, 10); tavilyCallsToday.count = 0; }
    if (tavilyCallsToday.count >= 200) { logPush('search', 'https://api.tavily.com/search', 'skipped_rate_limit', 'Per-instance Tavily daily cap reached.'); return []; }
    tavilyCallsToday.count += 1; tavilyCallsUsed += 1;
    try {
      const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 5000);
      let tavRes, tavJson;
      try {
        tavRes = await fetch('https://api.tavily.com/search', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + process.env.TAVILY_API_KEY }, body: JSON.stringify({ query, search_depth: 'basic', max_results: 8 }), signal: controller.signal });
        tavJson = await tavRes.json().catch(() => ({}));
      } finally { clearTimeout(timer); }
      const allWithTitle = (tavJson.results || []).map(r => ({ url: r.url, title: r.title || '' })).filter(x => typeof x.url === 'string' && x.url.startsWith('http'));
      const all = allWithTitle.map(x => x.url);
      const provider = allWithTitle.filter(x => { try { const h = new URL(x.url).hostname.toLowerCase(); const firstLabel = h.split('.')[0]; const secondLast = h.split('.').slice(-2, -1)[0] || ''; return isProviderHost(h, slug, domainGuess) || firstLabel.startsWith(slug) || secondLast.startsWith(slug); } catch (e) { return false; } }).map(x => x.url);
      const rank = (u) => { try { const uu = new URL(u); const host = uu.hostname.toLowerCase(); const path = uu.pathname.toLowerCase(); if (host.startsWith('community.') || host.startsWith('forum.') || path.includes('/blog/') || path.includes('/forums/') || path.includes('/forum/') || path.includes('/community/')) return 100; if (host.startsWith('developers.') || host.startsWith('developer.') || host.startsWith('docs.')) return 0; if (path.includes('/oauth') || path.includes('/docs/') || path.includes('/developer')) return 1; return 2; } catch (e) { return 3; } };
      const out = provider.filter(u => rank(u) < 100).sort((a, b) => rank(a) - rank(b)).slice(0, 8);
      logPush('search', 'https://api.tavily.com/search', tavRes && tavRes.ok ? 'found_' + out.length : 'failed_' + (tavRes ? tavRes.status : 0), 'Query "' + query + '" returned ' + all.length + ' URLs, ' + out.length + ' provider-specific, community and blog excluded from primary list.');
      return out;
    } catch (e) { logPush('search', 'https://api.tavily.com/search', 'failed', 'Tavily search failed: ' + String(e && e.message ? e.message : e)); return []; }
  }
  let searchUrls = [];
  if (!parsed.isIp) {
    if (!process.env.TAVILY_API_KEY) logPush('search', 'https://api.tavily.com/search', 'skipped_no_key', 'No TAVILY_API_KEY set, using site navigation fallback.');
    else {
      const results = await Promise.all([
        tavilySearch(app + ' OAuth developer docs register app scopes'),
        tavilySearch(app + ' developer app review approval distribution marketplace')
      ]);
      searchUrls = results.flat();
      // Canonical provider domain from search consensus, not a guessed
      // TLD. This is what later host checks use, so squareup.com can be
      // the provider for Square, and ghost.org for Ghost, without a
      // hardcoded exception. A guessed .com is never authoritative.
      const domainCounts = {};
      for (const u of searchUrls) { try { const h = new URL(u).hostname.toLowerCase().replace(/^www\./, ''); const firstLabel = h.split('.')[0]; const secondLast = h.split('.').slice(-2, -1)[0] || ''; if (!(firstLabel.startsWith(slug) || secondLast.startsWith(slug))) continue; domainCounts[h] = (domainCounts[h] || 0) + 1; } catch (e) {} }
      const rankedDomains = Object.entries(domainCounts).sort((a, b) => b[1] - a[1]);
      if (rankedDomains.length) { domainGuess = rankedDomains[0][0]; logPush('provider_discovery', '', 'canonical_' + domainGuess, 'Search consensus provider domain: ' + domainGuess + ' from ' + rankedDomains[0][1] + ' provider URLs. Other domains in results: ' + rankedDomains.slice(1).map(x => x[0] + '(' + x[1] + ')').join(', ')); }
    }
  }
  const searchMs = Date.now() - tSearch0;
  // Retrieval, parallel batches, document cache, provider-host only, SSRF guard.
  const tRetrieval0 = Date.now();
  const sources = []; const pages = []; const visited = new Set();
  function addSource(u) { const c = canonicalUrl(u); if (!sources.map(canonicalUrl).includes(c)) sources.push(u.split('#')[0]); }
  function pageText() { return pages.map(p => p.text).join(' '); }
  async function fetchBatch(urls, allowProxy) {
    const batch = [];
    for (const u of urls) { const c = canonicalUrl(u); if (!visited.has(c) && batch.length < 4) { visited.add(c); batch.push(u); } }
    if (!batch.length) return [];
    const results = await Promise.allSettled(batch.map(async (url) => {
      try {
        const uu = new URL(url);
        if (!isProviderHost(uu.hostname.toLowerCase(), slug, domainGuess)) return null;
        const path = uu.pathname.toLowerCase();
        if (url.includes('#content') || /\.(ico|png|jpg|jpeg|svg|css|js|webmanifest|pdf)(\?|$)/.test(path) || path.startsWith('/apps/')) return null;
        if (uu.hostname.startsWith('community.') || uu.hostname.startsWith('forum.') || path.includes('/blog/') || path.includes('/forums/') || path.includes('/forum/') || path.includes('/community/')) return null;
      } catch (e) { return null; }
      const cachedDoc = docCache.get(canonicalUrl(url) + '|v2');
      if (cachedDoc && Date.now() - cachedDoc.at < CACHE_TTL_MS && cachedDoc.text && (/oauth/i.test(cachedDoc.text) || /client[ _-]id/i.test(cachedDoc.text) || /scope/i.test(cachedDoc.text))) {
        logPush('fetch_page', url, 'cached', 'Document cache hit, no refetch.');
        addSource(url); return { url, text: cachedDoc.text };
      }
      // A non-qualifying cache entry is not evidence. Fall through to a
      // fresh fetch, so a short JS shell cached earlier cannot poison later runs.
      const page = await fetchText(url, 3000, allowProxy);
      if (page.ok && page.body) {
        const text = stripHtml(page.body);
        if (/oauth/i.test(text) || /client[ _-]id/i.test(text) || /scope/i.test(text)) docCache.set(canonicalUrl(url) + '|v2', { text, at: Date.now() });
        const hasOAuth = /oauth/i.test(text); const hasClient = /client[ _-]id/i.test(text); const hasScope = /scope/i.test(text);
        logPush('fetch_page', url, 'ok_' + page.status + (page.viaProxy ? '_via_proxy' : ''), 'Fetched. OAuth: ' + hasOAuth + ', client ID: ' + hasClient + ', scope: ' + hasScope + '. Text length: ' + text.length + '.');
        if (hasOAuth || hasClient || hasScope) { addSource(url); return { url, text, html: page.body }; }
        if (text.length < 2000 && (url.includes('/docs/') || url.includes('/developer')) && !url.endsWith('.md')) return { url, text, mdCandidate: url.replace(/\/$/, '') + '.md' };
        return null;
      }
      logPush('fetch_page', url, 'failed_' + page.status, 'Could not fetch page. ' + (page.error || ''));
      return null;
    }));
    const out = [];
    const mdCandidates = [];
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) {
        if (r.value.mdCandidate) mdCandidates.push(r.value.mdCandidate);
        else out.push(r.value);
      }
    }
    pages.push(...out);
    // Short JS shell fallback, generic, not provider-specific: a docs page
    // under 2000 characters is a shell, not content. Try its .md variant
    // once, in parallel, and log any redirect it follows.
    if (mdCandidates.length) {
      const mdResults = await Promise.allSettled(mdCandidates.slice(0, 3).map(async (url) => {
        try {
          const uu = new URL(url);
          if (!isProviderHost(uu.hostname.toLowerCase(), slug, domainGuess)) return null;
        } catch (e) { return null; }
        const page = await fetchText(url, 3000, false);
        if (page.ok && page.body) {
          const text = stripHtml(page.body);
          const hasOAuth = /oauth/i.test(text); const hasClient = /client[ _-]id/i.test(text); const hasScope = /scope/i.test(text);
          logPush('fetch_page', url, 'ok_' + page.status + '_md_variant', 'Fetched .md variant for a short JS shell. OAuth: ' + hasOAuth + ', client ID: ' + hasClient + ', scope: ' + hasScope + '. Text length: ' + text.length + '.');
          if (hasOAuth || hasClient || hasScope) { addSource(url); return { url, text }; }
        }
        return null;
      }));
      for (const r of mdResults) if (r.status === 'fulfilled' && r.value) { out.push(r.value); pages.push(r.value); }
    }
    return out;
  }
  function trackState() {
    const text = pageText();
    const perPageEndpoints = [];
    for (const pg of pages) { for (const e of extractRelativeEndpoints(pg.url, pg.text, slug, domainGuess)) if (!perPageEndpoints.includes(e)) perPageEndpoints.push(e); }
    return {
      text,
      scopes: extractScopes(text),
      endpoints: extractEndpoints(text, slug, domainGuess),
      endpointPaths: perPageEndpoints,
      hasClient: /client[ _-]id/i.test(text),
      hasRedirect: /redirect/i.test(text),
      hasOAuth: /oauth/i.test(text),
      hasApiKey: /api key/i.test(text),
      hasServiceAccount: /service account/i.test(text),
      hasPersonalToken: /personal access token/i.test(text),
      hasApproval: /app review|app approval|submit for review|marketplace review|security review|admin consent|business verification|publisher verification/i.test(text),
      hasAdminConsent: /admin consent/i.test(text),
      hasPublic: /public app|public distribution|marketplace|publish.*app|listing/i.test(text),
      hasPrivate: /private app|internal|private integration|test.*workspace|development app/i.test(text),
      hasPricing: /pricing|paid plan|enterprise|free plan/i.test(text)
    };
  }
  function tracksSufficient(tr) {
    return sources.length >= 2 && tr.hasClient && tr.hasRedirect && tr.scopes.length > 0 && tr.endpoints.length > 0;
  }
  // Batch 1: combined targeted search results, parallel.
  await fetchBatch(searchUrls.slice(0, 8), true);
  // Adaptive follow-up: only for missing tracks, one extra targeted search.
  let tr = trackState();
  if (!parsed.isIp && !tracksSufficient(tr) && tavilyCallsUsed < 3) {
    const missing = [];
    if (!tr.scopes.length) missing.push('scopes');
    if (!tr.hasApproval) missing.push('approval');
    if (!tr.endpoints.length) missing.push('endpoints');
    if (missing.length) {
      const follow = await tavilySearch(app + ' developer ' + missing.join(' ') + ' official docs');
      await fetchBatch(follow.slice(0, 4), true);
      tr = trackState();
    }
  }
  // Follow links inside official docs, only for missing tracks, top 3.
  if (!parsed.isIp && !tracksSufficient(trackState())) {
    const linkUrls = [];
    for (const p of pages) {
      if (!p.html) continue;
      const hrefs = Array.from(String(p.html).matchAll(/href=["']([^"']+)["']/g)).map(m => m[1]);
      for (const href of hrefs) {
        try {
          const absUrl = new URL(href, p.url); const abs = absUrl.toString(); const path = absUrl.pathname.toLowerCase();
          if (!abs.startsWith('https://') || !isProviderHost(absUrl.hostname.toLowerCase(), slug, domainGuess)) continue;
          if (/\.(ico|png|jpg|jpeg|svg|css|js|webmanifest|xml|pdf)(\?|$)/.test(path)) continue;
          if (absUrl.hostname.startsWith('community.') || absUrl.hostname.startsWith('forum.') || path.includes('/blog/')) continue;
          if (path.includes('/oauth') || path.includes('/scopes') || path.includes('/review') || path.includes('/marketplace') || path.includes('/publish') || path.includes('/verification') || path.includes('/authentication')) linkUrls.push(abs);
        } catch (e) {}
      }
    }
    const rankLink = (u) => { try { const path = new URL(u).pathname.toLowerCase(); if (path.includes('/oauth')) return 0; if (path.includes('/scopes') || path.includes('/authentication')) return 1; return 2; } catch (e) { return 3; } };
    const uniqueLinks = linkUrls.filter((u, i, a) => a.map(canonicalUrl).indexOf(canonicalUrl(u)) === i).sort((a, b) => rankLink(a) - rankLink(b)).slice(0, 3);
    if (uniqueLinks.length) { logPush('follow_links', '', 'found_' + uniqueLinks.length, 'Following ' + uniqueLinks.length + ' links found inside official docs, for missing tracks only.'); await fetchBatch(uniqueLinks, false); tr = trackState(); }
  }
  // Site navigation fallback, only if evidence is still incomplete.
  if (!parsed.isIp && !tracksSufficient(trackState()) && domainGuess) {
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
            const absUrl = new URL(href, baseUrl); const abs = absUrl.toString(); const path = absUrl.pathname.toLowerCase();
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
            const uu = new URL(u); const path = uu.pathname.toLowerCase();
            if (!isProviderHost(uu.hostname.toLowerCase(), slug, domainGuess)) continue;
            if (uu.hostname.startsWith('community.') || uu.hostname.startsWith('forum.') || path.includes('/blog/')) continue;
            if (path.includes('/oauth') || path.includes('/developer') || path.includes('/docs/oauth') || path.includes('/docs/auth') || path.includes('/docs/scopes') || path.includes('/api/oauth')) navUrls.push(u);
          } catch (e) {}
        }
      }
    }
    logPush('site_navigation', 'https://' + domainGuess + '/', 'found_' + navUrls.length, 'Homepages and sitemaps found ' + navUrls.length + ' developer, docs, or API links.');
    const rankNav = (u) => { try { const path = new URL(u).pathname.toLowerCase(); if (path.includes('/oauth')) return 0; if (path.includes('/docs/') || path.includes('/developer')) return 1; return 2; } catch (e) { return 3; } };
    const uniqueNav = navUrls.filter((u, i, a) => a.map(canonicalUrl).indexOf(canonicalUrl(u)) === i).sort((a, b) => rankNav(a) - rankNav(b)).slice(0, 4);
    if (uniqueNav.length) await fetchBatch(uniqueNav, false);
    tr = trackState();
  }
  // Generic OAuth patterns, parallel, no proxy, only if still incomplete.
  if (!parsed.isIp && !tracksSufficient(trackState()) && domainGuess) {
    await fetchBatch([
      'https://developers.' + domainGuess + '/docs/oauth',
      'https://developer.' + domainGuess + '/docs/oauth',
      'https://developers.' + domainGuess + '/docs/authentication',
      'https://developer.' + domainGuess + '/docs/authentication'
    ], false);
    tr = trackState();
  }
  // One backup search, direct only, only if still incomplete and Tavily gave few results.
  if (!parsed.isIp && !tracksSufficient(trackState()) && searchUrls.length < 3) {
    const searchUrl = 'https://lite.duckduckgo.com/lite/?q=' + encodeURIComponent(app + ' OAuth developer docs register app scopes');
    logPush('search', searchUrl, 'attempted', 'Backup search, direct only, no proxy.');
    const search = await fetchText(searchUrl, 3000, false);
    if (search.ok && search.body) {
      const direct = Array.from(search.body.matchAll(/href="([^"]+)"/g)).map(m => m[1]).filter(u => u && u.startsWith('http') && !u.includes('duckduckgo.com'));
      const found = direct.filter(u => { try { return isProviderHost(new URL(u).hostname.toLowerCase(), slug, domainGuess); } catch (e) { return false; } }).slice(0, 3);
      logPush('search', searchUrl, 'found_' + found.length, 'Backup search returned ' + found.length + ' provider-specific links.');
      if (found.length) await fetchBatch(found, false);
    } else logPush('search', searchUrl, 'failed_' + search.status, 'Backup search page could not be fetched.');
  }
  const retrievalMs = Date.now() - tRetrieval0;
  // Provider identity separation: never merge unrelated providers that
  // share a name. Group fetched pages by base domain, keep only the
  // dominant evidence cluster, discard the rest, and record them.
  // A tie for first place, with no canonical domain winner, is ambiguous.
  let providerIdentityAmbiguous = false;
  let discardedProviderDomains = [];
  let canonicalProviderDomain = domainGuess || '';
  if (pages.length) {
    const clusters = {};
    for (const pg of pages) { try { const host = new URL(pg.url).hostname.toLowerCase().replace(/^www\./, ''); (clusters[host] = clusters[host] || []).push(pg); } catch (e) {} }
    const scored = Object.entries(clusters).map(([bd, plist]) => ({ bd, plist, evidence: plist.filter(x => /oauth/i.test(x.text) || /client[ _-]id/i.test(x.text) || /scope/i.test(x.text)).length, canonical: bd === domainGuess ? 1 : 0 })).sort((a, b) => (b.evidence - a.evidence) || (b.plist.length - a.plist.length) || (b.canonical - a.canonical));
    const dominantSlugOk = scored.length && scored[0].bd.split('.').some(label => label === slug || label.startsWith(slug));
    if (scored.length && !dominantSlugOk) {
      providerIdentityAmbiguous = true;
      logPush('provider_identity', '', 'ambiguous', 'Dominant fetched domain ' + scored[0].bd + ' does not contain provider name ' + slug + '. Identity not verified, guides must not merge unrelated providers.');
    } else if (scored.length > 1 && scored[0].evidence === scored[1].evidence && scored[0].plist.length === scored[1].plist.length && scored[0].canonical === scored[1].canonical) {
      providerIdentityAmbiguous = true;
      logPush('provider_identity', '', 'ambiguous', 'Same-name providers found on multiple domains with equal evidence: ' + scored.map(x => x.bd).join(', ') + '. No dominant provider, guides must not merge them.');
    } else if (scored.length > 1) {
      const keep = scored[0];
      canonicalProviderDomain = keep.bd;
      discardedProviderDomains = scored.slice(1).map(x => x.bd);
      const keepSet = new Set(keep.plist);
      const removedPages = pages.filter(x => !keepSet.has(x));
      pages.splice(0, pages.length, ...keep.plist);
      for (let i = sources.length - 1; i >= 0; i--) { try { const host = new URL(sources[i]).hostname.toLowerCase().replace(/^www\./, ''); if (host !== keep.bd) sources.splice(i, 1); } catch (e) {} }
      logPush('provider_identity', '', 'separated_' + keep.bd, 'Kept provider domain ' + keep.bd + ', discarded ' + discardedProviderDomains.join(', ') + ' (' + removedPages.length + ' pages), not merged.');
    } else if (scored.length === 1) {
      canonicalProviderDomain = scored[0].bd;
    }
  }
  // Extraction: structured facts, per track, with source and passage.
  const tExtraction0 = Date.now();
  const finalTr = trackState();
  const allText = finalTr.text;
  const scopes = finalTr.scopes;
  const endpoints = finalTr.endpoints;
  const authorizeEndpoints = endpoints.filter(u => /authorize/i.test(u));
  const tokenEndpoints = endpoints.filter(u => /token/i.test(u));
  function sourceFor(snippetText) {
    if (!snippetText) return '';
    const clean = String(snippetText).replace(/^\[Section: [^\]]+\]\s*/, '');
    if (!clean) return '';
    for (const p of pages) if (p.text.includes(clean.slice(0, 40))) return p.url;
    return '';
  }
  const registerSnippet = findSnippet(allText, ['register an oauth', 'register a new oauth', 'create an oauth app', 'create a new app', 'register your app', 'register an application', 'create your app', 'create a developer app', 'create an application']);
  const redirectSnippet = findSnippet(allText, ['redirect uri', 'redirect url', 'callback url']);
  const approvalSnippet = findSnippet(allText, ['app review', 'app approval', 'submit for review', 'marketplace review', 'security review', 'admin consent', 'business verification', 'publisher verification']);
  const apiKeySnippet = findSnippet(allText, ['api key', 'personal access token']);
  const pricingSnippet = findSnippet(allText, ['pricing', 'enterprise plan', 'invitation only', 'paid plan']);
  const distributionSnippet = findSnippet(allText, ['public app', 'public distribution', 'marketplace', 'private app', 'internal']);
  const accountSnippet = findSnippet(allText, ['create a developer account', 'developer account', 'sign up for a developer']);
  const scopeSnippet = findSnippet(allText, ['scopes are required', 'request scopes', 'include scopes', 'scopes']);
  const secretSnippet = findSnippet(allText, ['client secret', 'keep your secret', 'store your secret']);
  const noOAuthSnippet = findSnippet(allText, ['does not support oauth', 'no oauth', 'not support oauth', 'api key only', 'instead of oauth', 'oauth is not supported']);
  const signInSnippet = findSnippet(allText, ['sign in with', 'sign-in with', 'openid connect', 'id token']);
  const mcpSnippet = findSnippet(allText, ['model context protocol', 'mcp server', 'mcp authentication']);
  const ssoSnippet = findSnippet(allText, ['single sign-on', 'sso', 'saml']);
  const regFreeSnippet = findSnippet(allText, ['dynamic client registration', 'no registration required', 'registration-free']);
  const adminConsentSnippet = findSnippet(allText, ['admin consent']);
  const privateSnippet = findSnippet(allText, ['private app', 'private integration', 'internal app', 'do not need review', 'no review required']);
  const privacySnippet = findSnippet(allText, ['privacy policy']);
  // Final reasoning layer: passage meaning, not keyword presence.
  // A requirement is mandatory only if its passage says so, in context.
  // Optional, conditional, and unnecessary language overrides a generic
  // template. This is the last check before requirements and steps are built.
  function classifyPassage(snippetText, keywords) {
    const raw = String(snippetText || '').replace(/^\[Section: [^\]]+\]\s*/, '');
    if (!raw) return { status: 'unknown', condition: '' };
    const sentences = raw.match(/[^.!?]+[.!?]/g) || [raw];
    const kws = (keywords || []).map(k => k.toLowerCase());
    // Find the sentence that mentions the requirement as a phrase, not
    // a different noun that happens to contain a keyword substring.
    let hit = '';
    for (const sen of sentences) {
      const low = sen.toLowerCase();
      for (const kw of kws) {
        let pos = low.indexOf(kw);
        while (pos >= 0) {
          if (!/[a-z]/.test(low[pos + kw.length] || '')) { hit = sen; break; }
          pos = low.indexOf(kw, pos + 1);
        }
        if (hit) break;
      }
      if (hit) break;
    }
    if (!hit) return { status: 'unknown', condition: '' };
    const s = hit.toLowerCase();
    const words = s.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
    // Action position: first keyword word in the sentence.
    let actionIdx = -1;
    for (const kw of kws) {
      const kwWords = kw.split(/\s+/);
      for (let i = 0; i <= words.length - kwWords.length; i++) {
        if (kwWords.every((w, j) => words[i + j] === w)) { actionIdx = i; break; }
      }
      if (actionIdx >= 0) break;
    }
    if (actionIdx < 0) return { status: 'unknown', condition: '' };
    const window = (from, to) => words.slice(Math.max(0, from), Math.min(words.length, to));
    const hasInWindow = (list, from, to) => window(from, to).some(w => list.includes(w));
    const negWords = ['not', 'no', 'never', 'without'];
    const modalWords = ['must', 'required', 'need', 'needs', 'necessary', 'required'];
    // Example or suggestion sentences do not establish a requirement.
    if (/for example|e\.g\.|such as/i.test(hit) && !hasInWindow(modalWords, actionIdx - 6, actionIdx + 6)) return { status: 'unknown', condition: '' };
    // Linked negation: negation within 6 words before the action, or
    // action followed by "not required/necessary/needed", or "no" + action.
    const negLinked = hasInWindow(negWords, actionIdx - 6, actionIdx) || /\b(not|no)\s+(required|necessary|needed)\b/.test(s.slice(s.indexOf(kws[0]) >= 0 ? s.indexOf(kws[0]) : 0, s.indexOf(kws[0]) >= 0 ? s.indexOf(kws[0]) + 60 : s.length)) || words[actionIdx - 1] === 'no' || /\bdoes not (support|use|require)\b|\bnot supported\b|\bdo not (register|submit|create)\b|\bmust not\b/.test(s);
    // The classic false negation: "you don't need to start from scratch
    // to create your app" - negation modifies "start", not "create app".
    // If the negation word is followed by a different verb before the
    // action, and that verb is not the action itself, do not apply it.
    const negPos = words.findIndex((w, i) => i < actionIdx && negWords.includes(w));
    if (negPos >= 0) {
      const between = words.slice(negPos + 1, actionIdx);
      if (between.length && ['start', 'begin', 'use', 'install', 'download'].includes(between[0]) && !between.includes('register') && !between.includes('submit')) {
        // Negation is about a different action, ignore it for this claim.
      } else if (negLinked) {
        return { status: 'not_applicable', condition: 'Docs say this is not required, in the sentence about this action: ' + cleanSnippet(hit) };
      }
    } else if (negLinked && /\b(not required|not necessary|not needed|no .* required)\b/.test(s)) {
      return { status: 'not_applicable', condition: 'Docs say this is not required, in the sentence about this action: ' + cleanSnippet(hit) };
    }
    if (/required only for|only required for|only if|only when|only for|required before|required for (public|marketplace|enterprise|restricted|paid|pro|team|business)/.test(s) && hasInWindow(['required', 'only'], actionIdx - 6, actionIdx + 6)) return { status: 'conditional', condition: 'Docs say this is required only in a specific case: ' + cleanSnippet(hit) };
    if (/can (bypass|skip)|bypass|without (review|approval|verification)|exception|exempt/.test(s)) return { status: 'conditional', condition: 'Docs describe an exception or bypass: ' + cleanSnippet(hit) };
    if (/\boptional\b|recommended but not (mandatory|required)|not mandatory|may (use|choose)|either|or (api key|oauth)/.test(s)) return { status: 'optional', condition: 'Docs say this is optional or an alternative: ' + cleanSnippet(hit) };
    if (/you can|you may|recommended|consider/.test(s) && !hasInWindow(modalWords, actionIdx - 6, actionIdx + 6)) return { status: 'optional', condition: 'Docs present this as a suggestion, not a mandatory step: ' + cleanSnippet(hit) };
    if (hasInWindow(modalWords, actionIdx - 6, actionIdx + 6) || /^\s*(create|register|add|set|configure|provide|enter|submit|request|generate|include|list)\b/.test(hit.trim().toLowerCase())) return { status: 'required', condition: '' };
    return { status: 'unknown', condition: '' };
  }
  let registerMeaning = classifyPassage(registerSnippet, ['register', 'create', 'oauth app', 'application']);
  const approvalMeaning = classifyPassage(approvalSnippet, ['app review', 'app approval', 'submit for review', 'marketplace review', 'security review', 'publisher verification', 'business verification', 'verification']);
  const redirectMeaning = classifyPassage(redirectSnippet, ['redirect', 'callback']);
  const accountMeaning = classifyPassage(accountSnippet, ['developer account', 'account']);
  const scopeMeaning = classifyPassage(scopeSnippet, ['scope']);
  const secretMeaning = classifyPassage(secretSnippet, ['secret']);
  const apiKeyMeaning = classifyPassage(apiKeySnippet, ['api key', 'personal access token']);
  const noOAuthMeaning = classifyPassage(noOAuthSnippet, ['oauth', 'api key']);
  const adminMeaning = classifyPassage(adminConsentSnippet, ['admin consent']);
  const privateMeaning = classifyPassage(privateSnippet, ['private', 'internal', 'review']);
  const privacyMeaning = classifyPassage(privacySnippet, ['privacy policy']);
  const pricingMeaning = classifyPassage(pricingSnippet, ['pricing', 'plan', 'tier', 'enterprise']);
  // Authentication classification, with contradiction detection.
  let authType = 'unknown';
  const oauthStrong = finalTr.hasOAuth && ((authorizeEndpoints.length > 0 || tokenEndpoints.length > 0) || (finalTr.hasClient && scopes.length > 0));
  const apiKeyStrong = finalTr.hasApiKey && !oauthStrong;
  const keyTokenStrong = !oauthStrong && finalTr.endpointPaths && finalTr.endpointPaths.some(x => x.includes('authorize')) && /key/i.test(allText) && /token/i.test(allText);
  if (oauthStrong) authType = 'oauth';
  else if (keyTokenStrong) authType = 'key_token';
  else if (apiKeyStrong) authType = 'api_key';
  else if (finalTr.hasServiceAccount && !finalTr.hasOAuth) authType = 'service_account';
  else if (finalTr.hasPersonalToken && !finalTr.hasOAuth) authType = 'personal_access_token';
  // Auth systems, distinguished, not conflated. A sign-in page, an SSO
  // page, an MCP page, and a third-party API OAuth page are different
  // systems, even when they share words like OAuth or token.
  const apiScopes = scopes.filter(s => !['openid', 'profile', 'email'].includes(s));
  const authSystems = [];
  function authSystem(system, found, evidenceText) {
    const ev = evidenceText ? cleanSnippet(evidenceText) : '';
    authSystems.push({ system, found, evidence: ev, evidenceUrl: sourceFor(evidenceText), verified: !!(found && ev && sourceFor(evidenceText)) });
  }
  authSystem('third_party_oauth', oauthStrong && (authorizeEndpoints.length > 0 || tokenEndpoints.length > 0 || apiScopes.length > 0), registerSnippet || '');
  authSystem('sign_in_oauth', !!signInSnippet, signInSnippet);
  authSystem('registration_free_oauth', !!regFreeSnippet, regFreeSnippet);
  authSystem('api_key', finalTr.hasApiKey, apiKeySnippet);
  authSystem('personal_access_token', finalTr.hasPersonalToken, apiKeySnippet);
  authSystem('service_account', finalTr.hasServiceAccount, '');
  authSystem('mcp_authentication', !!mcpSnippet, mcpSnippet);
  authSystem('sso_enterprise', !!ssoSnippet, ssoSnippet);
  if (authType === 'oauth' && authorizeEndpoints.length === 0 && tokenEndpoints.length === 0 && apiScopes.length === 0) {
    authType = 'sign_in_oauth';
  }
  if (regFreeSnippet) {
    registerMeaning = { status: 'not_applicable', condition: 'Docs say registration is not required or dynamic registration is used: ' + cleanSnippet(regFreeSnippet) };
  }
  const contradictions = [];
  if (oauthStrong && finalTr.hasApiKey) contradictions.push('Docs mention both OAuth and API keys. This guide treats OAuth as the main path only if OAuth endpoints or scopes were found, and lists API keys as a separate check, not as the same flow.');
  if (oauthStrong && noOAuthSnippet) contradictions.push('HARD: Source says OAuth is not supported or API key only, but OAuth endpoints or scopes were also found. Authentication cannot be trusted as OAuth alone.');
  if (finalTr.hasApiKey && finalTr.hasOAuth && !oauthStrong) contradictions.push('Docs mention both OAuth and API keys, but neither path is strong. The simplest supported path cannot be chosen from fetched pages alone.');
  if (/no review required|no approval required/i.test(allText) && finalTr.hasApproval) contradictions.push('Docs contain both review language and no review language. Approval is therefore treated as conditional, not as a universal requirement.');
  // Console selection: score, never use an API reference page as the registration URL.
  function consoleScore(u) {
    try {
      const uu = new URL(u); const host = uu.hostname.toLowerCase(); const path = uu.pathname.toLowerCase();
      if (path.includes('/api-reference/') || path.includes('/api/')) return -10;
      const segments = path.split('/').filter(Boolean);
      if (segments.some(s => /events|pricing|blog|community|support|changelog|status/.test(s))) return -10;
      let s = 0;
      if (host.startsWith('developers.') || host.startsWith('developer.') || host.startsWith('docs.')) s += 2;
      if (path === '/' || path === '') s += 3;
      if (segments.some(s => ['apps', 'console', 'dashboard', 'register', 'oauth-apps', 'create-app'].includes(s))) s += 3;
      if (segments.length && ['developers', 'developer'].includes(segments[0])) s += 2;
      if (segments.some(s => ['oauth', 'getting-started', 'get-started', 'developer', 'developers', 'docs'].includes(s))) s += 1;
      return s;
    } catch (e) { return -10; }
  }
  const consoleCandidates = sources.map(u => ({ url: u, score: consoleScore(u) })).sort((a, b) => b.score - a.score);
  const consolePick = consoleCandidates.length && consoleCandidates[0].score >= 3 ? consoleCandidates[0].url : '';
  let consoleUrl = consolePick || 'Unknown';
  // Tracks, each with status, confidence, sources, evidence, missing.
  function track(name, found, conf, evidenceText, missing) {
    return { name, status: found ? 'found' : 'missing', confidence: found ? conf : 'Low', sources: sources.slice(0, 6), evidence: evidenceText ? cleanSnippet(evidenceText) : '', evidenceUrl: sourceFor(evidenceText), missing: missing || [] };
  }
  const tracks = {
    authentication: track('authentication', authType !== 'unknown', authType === 'oauth' ? 'Medium' : 'Low', registerSnippet || apiKeySnippet, authType === 'unknown' ? ['Authentication method not found in fetched official pages'] : []),
    registration: track('registration', !!(registerSnippet || finalTr.hasClient), 'Medium', registerSnippet, registerSnippet ? [] : ['Registration fields not found in fetched pages']),
    permissions: track('permissions', scopes.length > 0, scopes.length >= 3 ? 'Medium' : 'Low', scopes.length ? 'Scopes found: ' + scopes.join(', ') : '', scopes.length ? [] : ['Scope list not found in fetched pages']),
    distribution: track('distribution', !!(finalTr.hasPublic || finalTr.hasPrivate), 'Low', distributionSnippet, (finalTr.hasPublic || finalTr.hasPrivate) ? [] : ['Private versus public distribution not found in fetched pages']),
    approval: track('approval', !!approvalSnippet, 'Low', approvalSnippet, approvalSnippet ? [] : ['Review or approval documentation not found in fetched pages']),
    blockers: track('blockers', !!pricingSnippet, 'Low', pricingSnippet, pricingSnippet ? [] : ['Pricing, tier, or enterprise blocker not found in fetched pages'])
  };
  const evidenceSummary = {
    authType,
    passageMeaning: { registration: registerMeaning, approval: approvalMeaning, redirect: redirectMeaning },
    providerDomain: domainGuess,
    providerHostMatch: sources.length === 0 || sources.every(u => { try { return isProviderHost(new URL(u).hostname.toLowerCase(), slug, domainGuess); } catch (e) { return false; } }),
    tracks,
    contradictions,
    providerIdentity: { canonicalDomain: canonicalProviderDomain, discardedDomains: discardedProviderDomains, ambiguous: providerIdentityAmbiguous },
    semanticMethod: 'deterministic sentence semantics, no paid model, no local model in this serverless function. See README for the model evaluation. Model claims, if ever added, must pass the same passage validation or the guide becomes a draft.'
  };
  // Requirement engine.
  function makeReq(name, status, condition, evidenceText) {
    return { name, status, condition: condition || '', evidence: evidenceText ? cleanSnippet(evidenceText) : '', evidenceUrl: sourceFor(evidenceText) };
  }
  const requirements = [];
  // Strict rule, final upgrade: a status other than unknown is allowed
  // only when its cited passage, in the sentence that mentions the
  // requirement, explicitly supports it. Mentioning a word is not
  // evidence. A fallback to required, conditional, optional, or
  // not_applicable from mere presence is forbidden here.
  requirements.push(makeReq('Developer account', accountMeaning.status, accountMeaning.condition, accountSnippet));
  if (authType === 'oauth') {
    requirements.push(makeReq('Register an OAuth app', registerMeaning.status, registerMeaning.condition, registerSnippet));
    requirements.push(makeReq('Redirect URI', redirectMeaning.status, redirectMeaning.condition, redirectSnippet));
    requirements.push(makeReq('Scopes', scopeMeaning.status, scopeMeaning.condition, scopeSnippet));
    requirements.push(makeReq('Client secret storage', secretMeaning.status, secretMeaning.condition, secretSnippet));
  } else if (authType === 'api_key') {
    requirements.push(makeReq('Register an OAuth app', noOAuthMeaning.status === 'not_applicable' ? 'not_applicable' : 'unknown', noOAuthMeaning.condition, noOAuthSnippet));
    requirements.push(makeReq('Create an API key', apiKeyMeaning.status, apiKeyMeaning.condition, apiKeySnippet));
    requirements.push(makeReq('Redirect URI', 'unknown', '', ''));
  } else if (authType === 'key_token') {
    requirements.push(makeReq('Register an OAuth app', 'unknown', '', ''));
    requirements.push(makeReq('Create credentials', apiKeyMeaning.status, apiKeyMeaning.condition, apiKeySnippet));
  } else if (authType === 'service_account' || authType === 'personal_access_token') {
    requirements.push(makeReq('Register an OAuth app', noOAuthMeaning.status === 'not_applicable' ? 'not_applicable' : 'unknown', noOAuthMeaning.condition, noOAuthSnippet));
    requirements.push(makeReq('Create credentials', apiKeyMeaning.status, apiKeyMeaning.condition, apiKeySnippet));
  } else {
    requirements.push(makeReq('Register an OAuth app', 'unknown', '', ''));
  }
  requirements.push(makeReq('Admin consent', adminMeaning.status === 'conditional' ? 'conditional' : 'unknown', adminMeaning.condition, adminConsentSnippet));
  requirements.push(makeReq('Public review and marketplace listing', approvalMeaning.status, approvalMeaning.condition, approvalSnippet));
  requirements.push(makeReq('Private testing approval', approvalMeaning.status === 'not_applicable' ? 'not_applicable' : (privateMeaning.status === 'not_applicable' ? 'not_applicable' : 'unknown'), approvalMeaning.status === 'not_applicable' ? approvalMeaning.condition : privateMeaning.condition, approvalMeaning.status === 'not_applicable' ? approvalSnippet : privateSnippet));
  requirements.push(makeReq('Privacy policy and review documents', privacyMeaning.status, privacyMeaning.condition, privacySnippet));
  if (pricingSnippet) requirements.push(makeReq('Pricing or tier eligibility', (pricingMeaning.status === 'conditional' || pricingMeaning.status === 'required') ? 'conditional' : (pricingMeaning.status === 'optional' ? 'optional' : 'unknown'), pricingMeaning.condition, pricingSnippet));
  // Evidence-to-decision records, approval as a distinct problem.
  // Each decision is a claim, a passage, a section, a status, a
  // condition, contradictions, and confidence, not a template row.
  const testSnippet = findSnippet(allText, ['test account', 'sandbox', 'development app', 'test mode', 'developer sandbox']);
  const testMeaning = classifyPassage(testSnippet, ['test', 'sandbox', 'development']);
  const altSnippet = findSnippet(allText, ['either', 'alternatively', 'you can also use', 'or api key']);
  const altMeaning = classifyPassage(altSnippet, ['either', 'alternatively', 'also', 'api key', 'oauth']);
  const docSnippet = findSnippet(allText, ['test account', 'app description', 'screenshots', 'privacy policy']);
  function decision(claim, status, condition, evidenceText, justification) {
    const ev = evidenceText ? cleanSnippet(evidenceText) : '';
    const url = sourceFor(evidenceText);
    return { claim, status, condition: condition || '', evidence: ev, evidenceUrl: url, section: evidenceText && evidenceText.startsWith('[Section: ') ? evidenceText.slice(10, evidenceText.indexOf(']')) : '', sourceSupported: !!(ev && url), contradicts: contradictions.length ? contradictions.slice(0, 3) : [], confidence: status === 'unknown' ? 'Low' : (ev && url ? 'Medium' : 'Low'), justification: justification || (status === 'unknown' ? 'No passage in fetched pages explicitly supports this claim, so it is marked Unknown, not assumed.' : 'Status comes from the cited passage in its sentence, not from keyword presence.') };
  }
  const decisions = [
    decision('Can a developer create and test immediately', testMeaning.status, testMeaning.condition, testSnippet, 'Immediate testing needs a passage about a test account, sandbox, or development app, not just a console link.'),
    decision('Is OAuth application registration required', registerMeaning.status, registerMeaning.condition, registerSnippet, 'Registration is required only if its passage says must, required, need, or gives an imperative registration step.'),
    decision('Can the application be used privately', privateMeaning.status, privateMeaning.condition, privateSnippet, 'Private use needs a passage about private, internal, or development use, and whether review applies to it.'),
    decision('Does public distribution require approval', approvalMeaning.status, approvalMeaning.condition, approvalSnippet, 'Public approval needs a review or approval passage with modal or conditional language, not the word approval alone.'),
    decision('Is marketplace listing optional or mandatory', (() => { const ms = findSnippet(allText, ['marketplace listing', 'list in the marketplace', 'marketplace app']); const mm = classifyPassage(ms, ['marketplace']); return mm.status; })(), (() => { const ms = findSnippet(allText, ['marketplace listing', 'list in the marketplace', 'marketplace app']); const mm = classifyPassage(ms, ['marketplace']); return mm.condition; })(), findSnippet(allText, ['marketplace listing', 'list in the marketplace', 'marketplace app']), 'Listing status needs its own marketplace passage. If docs do not say mandatory, it is not marked mandatory.'),
    decision('Is verification tied to particular scopes', scopeMeaning.status, scopeMeaning.condition, scopeSnippet, 'Scope-tied verification needs a passage linking verification to a scope, plan, or restricted scope.'),
    decision('Does enterprise administrator consent apply', adminMeaning.status === 'conditional' ? 'conditional' : 'unknown', adminMeaning.condition, adminConsentSnippet, 'Admin consent is conditional by nature. It is marked conditional only when its passage gives a condition.'),
    decision('Are there eligibility thresholds', pricingMeaning.status, pricingMeaning.condition, pricingSnippet, 'Eligibility needs a passage about a plan, tier, installs, or revenue threshold, not a pricing page mention alone.'),
    decision('What documents are required for submission', privacyMeaning.status, privacyMeaning.condition, privacySnippet, 'Documents are required only when a passage says a document is required for submission.'),
    decision('Is an official review timeline available', approvalSnippet && timePhrase(approvalSnippet) ? 'conditional' : 'unknown', approvalSnippet && timePhrase(approvalSnippet) ? 'Published phrase found: ' + timePhrase(approvalSnippet) + ', see evidence, not a guarantee' : '', approvalSnippet, 'A timeline is available only when a passage gives a time phrase. Varies and Unknown are not timelines.'),
    decision('Are there alternative authentication paths that avoid creating an app', (finalTr.hasApiKey || finalTr.hasServiceAccount || finalTr.hasPersonalToken) ? (altMeaning.status !== 'unknown' ? altMeaning.status : 'conditional') : 'unknown', altMeaning.condition, altSnippet || apiKeySnippet, 'An alternative path needs evidence of a second auth method, not just a mention of API keys in an OAuth guide.')
  ];
  evidenceSummary.decisions = decisions;
  evidenceSummary.authSystems = authSystems;
  // Atomic claims: one proposition per claim, verified only when its
  // passage logically entails it, not when a word merely appears.
  const claims = [];
  for (const r of requirements) {
    const verified = r.status !== 'unknown' && !!(r.evidence && r.evidenceUrl && sources.includes(r.evidenceUrl));
    claims.push({ proposition: r.name + ' is ' + r.status, provider: canonicalProviderDomain || domainGuess || app, product: '', authContext: authType, sourceUrl: r.evidenceUrl || '', passage: r.evidence || '', section: r.evidence && r.evidence.startsWith('[Section: ') ? r.evidence.slice(10, r.evidence.indexOf(']')) : '', classification: r.status, condition: r.condition || '', confidence: verified ? 'Medium' : 'Low', verified, contradictoryEvidence: contradictions.slice(0, 2) });
  }
  for (const sys of authSystems) {
    claims.push({ proposition: 'Authentication system ' + sys.system + ' is ' + (sys.found ? 'supported' : 'not found in fetched pages'), provider: canonicalProviderDomain || domainGuess || app, product: '', authContext: sys.system, sourceUrl: sys.evidenceUrl || '', passage: sys.evidence || '', section: '', classification: sys.found ? 'supported' : 'unknown', condition: '', confidence: sys.verified ? 'Medium' : 'Low', verified: sys.verified, contradictoryEvidence: [] });
  }
  for (const ep of endpoints) {
    let epSource = '';
    for (const pg of pages) if (pg.text.includes(ep)) { epSource = pg.url; break; }
    const malformed = !/^https:\/\/[^\/]+\/[^\s]*$/.test(ep) || ep.includes('/docs/') || ep.includes('/reference/');
    claims.push({ proposition: 'OAuth endpoint is ' + ep, provider: canonicalProviderDomain || domainGuess || app, product: '', authContext: 'oauth', sourceUrl: epSource, passage: ep, section: '', classification: malformed ? 'invalid' : 'supported', condition: '', confidence: (!malformed && epSource) ? 'Medium' : 'Low', verified: (!malformed && !!epSource), contradictoryEvidence: malformed ? ['Endpoint is malformed or is a docs page, not an endpoint.'] : [] });
  }
  evidenceSummary.claims = claims;
  // Quality gate.
  const checksPassed = []; const checksFailed = [];
  if (evidenceSummary.providerHostMatch) checksPassed.push('Provider identity matches sources'); else checksFailed.push('Provider identity does not match sources');
  if (consolePick) checksPassed.push('Registration URL is a developer portal candidate, not an API reference page'); else checksFailed.push('No developer portal candidate scored high enough, console URL set to Unknown');
  if (authType !== 'unknown') checksPassed.push('Authentication type classified from evidence'); else checksFailed.push('Authentication type unknown');
  if (endpoints.length) checksPassed.push('OAuth endpoints validated as provider hosts, authorize and token categorized'); else if (authType === 'oauth') checksFailed.push('OAuth claimed but no valid endpoints found');
  if (scopes.length) checksPassed.push('Scopes extracted near scope mentions, credential tokens filtered'); else checksFailed.push('No scopes found');
  if (approvalSnippet) checksPassed.push('Approval statements backed by review evidence, not a single generic word'); else checksFailed.push('No approval evidence found, approval set to Unknown');
  if (contradictions.length) checksFailed.push('Contradictions found, see evidence summary');
  const evidenceCoverage = Object.values(tracks).filter(t => t.status === 'found').length;
  const sourceAuthority = sources.length ? sources.filter(u => { try { const h = new URL(u).hostname.toLowerCase(); return h.startsWith('developers.') || h.startsWith('developer.') || h.startsWith('docs.') || h === domainGuess; } catch (e) { return false; } }).length / sources.length : 0;
  let confidence = 'Low';
  if (authType !== 'unknown' && sources.length >= 2 && (scopes.length > 0 || endpoints.length > 0) && contradictions.length === 0) confidence = 'Medium';
  // Guide completeness is separate from factual confidence. A guide is
  // full structure only if it has usable evidence; otherwise it is a draft.
  const researchFailed = sources.length === 0 || authType === 'unknown' || providerIdentityAmbiguous;
  let guideType = researchFailed ? 'draft' : 'full';
  let verificationStatus = sources.length >= 2 ? 'Docs checked, 2 or more sources, no sign-in test' : sources.length === 1 ? 'Partially verified, single source, no sign-in test' : 'Unverified, no official source fetched, no sign-in test';
  const qualityGate = {
    completeness: guideType,
    evidenceCoverage: evidenceCoverage + ' of 6 tracks found',
    sourceAuthority: Math.round(sourceAuthority * 100) + '% of sources are developer or docs hosts',
    factualConfidence: confidence,
    contradictions,
    checksPassed,
    checksFailed
  };
  // Evidence-built steps, variable length, no fixed template.
  const steps = [];
  function addStep(title, detail, who, time, blockerTip, requirement, evidenceText, condition) {
    const evUrl = sourceFor(evidenceText);
    steps.push({ title, detail, who, time, blockerTip, requirement, condition: condition || '', destinationUrl: evUrl || (consolePick || ''), evidence: evidenceText ? cleanSnippet(evidenceText) : '', evidenceUrl: evUrl });
  }
  const reqStatus = (name) => { const r = requirements.find(x => x.name === name); return r ? r.status : 'unknown'; };
  const reqCondition = (name) => { const r = requirements.find(x => x.name === name); return r ? r.condition : ''; };
  addStep('Confirm the authentication model', 'What: confirm ' + app + ' uses ' + authType + (authType === 'oauth' ? ' before building an OAuth flow.' : authType === 'unknown' ? ' before building, because no authentication method was confirmed in fetched pages.' : ' before building, because this is not a standard OAuth flow.') + ' Where: official docs in sources below. Why: building the wrong auth model wastes the whole integration.' + (registerSnippet || apiKeySnippet ? ' Evidence from docs: ' + cleanSnippet(registerSnippet || apiKeySnippet) : ''), 'agent', '15 minutes', 'If the auth model is unknown, stop and research official docs, do not guess OAuth.', 'unknown', registerSnippet || apiKeySnippet);
  if (authType === 'oauth') {
    if (registerMeaning.status !== 'not_applicable') addStep('Register the app', consolePick ? 'What: create a new OAuth app in the developer portal at ' + consolePick + '. Where: that portal, sign in as a developer. Why: registration creates the client ID and secret used for OAuth.' + (registerSnippet ? ' Evidence from docs: ' + cleanSnippet(registerSnippet) : '') : 'What: find the official developer portal in sources below and create a new OAuth app there. Where: official portal, not an API reference page. Why: no registration URL scored high enough to be used as the portal link, so do not use an API reference page as the registration URL.', 'human', '20 minutes', 'If the portal is not official, stop and mark the guide as unverified.', reqStatus('Register an OAuth app'), registerSnippet, reqCondition('Register an OAuth app'));
    else addStep('Registration is not required, per docs', 'What: do not register an OAuth app, because fetched docs say registration is not required for this path. Where: official docs in sources below. Why: ' + registerMeaning.condition, 'human', 'Unknown', 'Do not create an app that docs say is not required.', 'not_applicable', registerSnippet, registerMeaning.condition);
    addStep('Set the redirect URI', 'What: add the exact redirect URI from your code, including host, path, and https, in app settings. Where: app settings in the portal. Why: the provider only redirects to registered URIs.' + (redirectSnippet ? ' Evidence from docs: ' + cleanSnippet(redirectSnippet) : ' No redirect rule was found in fetched pages, so copy it from your code and check it against official docs.'), 'human', '10 minutes', 'A redirect mismatch is the most common first failure.', reqStatus('Redirect URI'), redirectSnippet, reqCondition('Redirect URI'));
    if (scopes.length) addStep('Choose scopes, minimum only', 'What: request only these scopes, and only the ones your feature uses: ' + scopes.join(', ') + '. Where: app settings and authorize request. Why: broad scopes can trigger extra review and risk. Do not request a broad scope without a stated use case for that scope.', 'agent', '20 minutes', 'A single sensitive scope can change the whole timeline.', reqStatus('Scopes'), scopeSnippet, reqCondition('Scopes'));
    else addStep('Find the scope list', 'What: open the first source below, find its scopes or permissions page, and list every scope your feature needs. Where: official docs. Why: no valid scope tokens were extracted in this run, so do not guess a scope list.', 'agent', '20 minutes', 'Do not guess scopes.', 'unknown', '');
    if (endpoints.length) addStep('Build the authorize and token flow', 'What: send the user to the authorize endpoint' + (authorizeEndpoints.length ? ': ' + authorizeEndpoints.join(', ') : '') + ', then exchange the code at the token endpoint' + (tokenEndpoints.length ? ': ' + tokenEndpoints.join(', ') : '') + '. Where: your backend. Why: this is how a user token is issued. Store tokens securely, never in client code.', 'agent', '30 minutes', 'Store client secrets securely. If a secret is exposed, rotate it.', 'unknown', '');
    else addStep('Find the authorize and token endpoints', 'What: find the authorize endpoint and the token endpoint in official docs first, then build the flow. Where: official docs. Why: no authorize or token endpoints were found in fetched pages.', 'agent', '30 minutes', 'Do not guess endpoints.', 'unknown', '');
  } else if (authType === 'api_key') {
    addStep('Create an API key', 'What: create an API key in the provider console or account settings. Where: official console in sources below. Why: this key, not OAuth, is how this provider authenticates in fetched docs.' + (apiKeySnippet ? ' Evidence from docs: ' + cleanSnippet(apiKeySnippet) : ''), 'human', '10 minutes', 'Never put the key in client code or a public repo.', reqStatus('Create an API key'), apiKeySnippet, reqCondition('Create an API key'));
    addStep('Store the key and test one call', 'What: store the key in a secrets manager, send it as documented, and test one read call. Where: your backend. Why: a working read call proves the key and permissions, without building OAuth.', 'agent', '20 minutes', 'If the call fails, check key scope and account permissions first.', 'unknown', '');
  } else if (authType === 'service_account' || authType === 'personal_access_token') {
    addStep('Create credentials with minimum permissions', 'What: create a ' + authType + ' in the provider console, with minimum permissions for the feature. Where: official console in sources below. Why: this provider uses ' + authType + ' in fetched docs, not a standard OAuth app.', 'human', '20 minutes', 'Never put credentials in client code or a public repo.', reqStatus('Create credentials'), apiKeySnippet, reqCondition('Create credentials'));
    addStep('Test one call with those credentials', 'What: test one read call with the new credentials, server side. Where: your backend. Why: a working read call proves permissions before building more.', 'agent', '20 minutes', 'If the call fails, check permissions and account tier first.', 'unknown', '');
  } else if (authType === 'key_token') {
    addStep('Get your key', 'What: get your key from the provider console or account settings. Where: official console in sources below. Why: the key identifies your app, it is not a standard OAuth client ID.', 'human', '10 minutes', 'Never put the key in client code or a public repo.', reqStatus('Create credentials'), apiKeySnippet, reqCondition('Create credentials'));
    addStep('Authorize a token', 'What: send the user through the authorize path found in docs, ' + (finalTr.endpointPaths.length ? finalTr.endpointPaths.join(', ') : 'see sources below') + ', with your key, and store the token returned. Where: your backend. Why: the token, not the key alone, is what API calls use. Do not present a full authorize URL here, because docs gave a path, not a confirmed full URL on the app host, verify it in official docs first.', 'agent', '20 minutes', 'If authorization fails, check key, token scope, and the exact authorize path in official docs.', 'unknown', '');
    addStep('Test one call with the token', 'What: test one call with the stored token, server side. Where: your backend. Why: a working read call proves the key and token, before building more.', 'agent', '20 minutes', 'If the call fails, check token permissions first.', 'unknown', '');
  } else {
    addStep('Find the official developer portal', 'What: find the official developer console and registration docs for ' + app + ', then list scopes and review triggers before building. Where: official docs, not a tutorial site. Why: no authentication method was confirmed, so no flow can be recommended yet.', 'human', 'Unknown', 'Do not build on an unverified portal.', 'unknown', '');
  }
  if (oauthStrong && finalTr.hasApiKey) addStep('Choose the simplest auth path', 'What: choose by use case. For your own account only, an API key is the simplest path if docs support it. For other users, OAuth is the path, because an API key cannot represent another user. Where: official docs in sources below. Why: docs mention both OAuth and API keys, and they are not the same flow. Do not present API key access as OAuth.', 'agent', '15 minutes', 'If you need other users, do not use your own API key for them.', 'conditional', altSnippet || apiKeySnippet, 'Use case decides: own account versus other users.');
  addStep('Test with a real account', 'What: test consent or credential access with a real account, confirm the token or key works for one read call. Where: your test account. Why: a test proves the flow, not just the code.', 'human', '20 minutes', 'Test in a private or test account first, not production.', 'unknown', '');
  if (approvalMeaning.status === 'not_applicable') {
    addStep('No provider review required, per docs', 'What: no provider review submission is required, per fetched docs. Where: official docs in sources below. Why: ' + approvalMeaning.condition, 'human', 'Unknown', 'Do not submit a review that docs say is not required.', 'not_applicable', approvalSnippet);
  } else if (approvalSnippet) {
    addStep('Decide private versus public, then submit for review if required', 'What: decide private testing versus public distribution. If public, prepare a privacy policy URL, a clear app description, a test account, and a justification for every scope, then submit for review only if docs say public distribution requires it. If docs say review is optional, you can skip it for private use, and the condition below states when. Where: provider review portal in sources below. Why: authentication is not app review, publishing needs its own submission.' + ' Evidence from docs: ' + cleanSnippet(approvalSnippet), 'human', 'Unknown, review wait varies', 'An incomplete submission is the most common review delay.', reqStatus('Public review and marketplace listing'), approvalSnippet, reqCondition('Public review and marketplace listing'));
  } else {
    addStep('Check whether review is required', 'What: check official review docs for whether private testing, public distribution, or admin consent needs a separate review. Where: official docs in sources below. Why: no approval evidence was found in fetched pages, so review cannot be claimed or ruled out yet.', 'human', 'Unknown', 'Do not promise a launch date until review docs are checked.', 'unknown', '');
  }
  if (pricingSnippet) addStep('Check pricing, tier, and enterprise limits', 'What: check pricing, account tier, and enterprise restrictions before building. Where: official pricing and docs in sources below. Why: a tier limit can block the feature even if auth works.' + ' Evidence from docs: ' + cleanSnippet(pricingSnippet), 'human', '15 minutes', 'Do not assume a free tier covers the feature.', reqStatus('Pricing or tier eligibility'), pricingSnippet, reqCondition('Pricing or tier eligibility'));
  // Template override validation pass: no step may stay marked required
  // when its requirement is not applicable or optional in docs. If it does,
  // the step is downgraded and its detail says so, rather than letting a
  // generic template override the provider's documented process.
  const reqByName = {};
  for (const r of requirements) reqByName[r.name] = r;
  let templateViolations = 0;
  for (const s of steps) {
    let matched = null;
    if (/Register/i.test(s.title)) matched = reqByName['Register an OAuth app'];
    else if (/review/i.test(s.title)) matched = reqByName['Public review and marketplace listing'];
    else if (/redirect/i.test(s.title)) matched = reqByName['Redirect URI'];
    else if (/scopes/i.test(s.title)) matched = reqByName['Scopes'];
    else if (/API key/i.test(s.title)) matched = reqByName['Create an API key'];
    else if (/credentials/i.test(s.title)) matched = reqByName['Create credentials'];
    else if (/pricing/i.test(s.title)) matched = reqByName['Pricing or tier eligibility'];
    if (matched && s.requirement === 'required' && (matched.status === 'not_applicable' || matched.status === 'optional')) {
      s.requirement = matched.status;
      s.detail = 'Per docs, this step is ' + matched.status + ', not required. ' + s.detail;
      templateViolations += 1;
    }
  }
  if (templateViolations === 0) qualityGate.checksPassed.push('Template override check: no step is marked required when its requirement is not applicable or optional');
  else qualityGate.checksFailed.push('Template override check: ' + templateViolations + ' step(s) were downgraded to match docs, see step details');
  // Final factual consistency checker. This is not a downgrade pass.
  // A critical contradiction makes the guide a draft, not a full guide,
  // even if the rest of the guide looks complete.
  const validationFailures = [];
  let broadScopeWarning = false;
  if (providerIdentityAmbiguous) validationFailures.push('Provider identity ambiguous: multiple same-name providers with equal evidence, not merged, so no full guide can be trusted.');
  if (noOAuthSnippet && authType === 'oauth') validationFailures.push('Source says OAuth is not supported or API key only, but the guide classified auth as OAuth.');
  if (consoleUrl !== 'Unknown' && (/\/api-reference\//.test(consoleUrl) || /\/api\//.test(consoleUrl) || /\/reference\//.test(consoleUrl))) { validationFailures.push('Console URL is an API documentation page, not a developer portal.'); consoleUrl = 'Unknown'; }
  for (const r of requirements) {
    if (r.status !== 'unknown' && (!r.evidence || !r.evidenceUrl || !sources.includes(r.evidenceUrl))) {
      validationFailures.push('Requirement ' + r.name + ' is marked ' + r.status + ' without a cited official passage and source URL.');
      r.status = 'unknown';
    }
    if (r.evidence && metadataTokenCount(r.evidence) >= 1) validationFailures.push('Requirement ' + r.name + ' evidence contains page metadata, not a docs passage.');
  }
  for (const s of steps) {
    if (s.evidence && metadataTokenCount(s.evidence) >= 1) validationFailures.push('Step ' + s.title + ' evidence contains page metadata.');
    if (s.requirement === 'required' && (!s.evidence || !/\b(create|register|add|set|configure|submit|request|generate|include|must|required|optional|need|needs|use|log|sign|open|navigate|choose|select|provide|enter|review|approval)\b/i.test(s.evidence))) validationFailures.push('Step ' + s.title + ' is marked required without a verb-bearing passage that supports it.');
    const mainDetail = String(s.detail || '').split('Evidence from docs:')[0];
    const urlsInDetail = mainDetail.match(/https:\/\/[^\s,;]+/g) || [];
    for (const u of urlsInDetail) { const cleanU = u.replace(/[\.,)\]]+$/, ''); if (cleanU.includes('{') || cleanU.includes('}')) continue; if (authType === 'oauth' && !endpoints.includes(cleanU) && !sources.includes(cleanU) && cleanU !== consolePick) validationFailures.push('Step ' + s.title + ' cites a URL not in endpoints or sources: ' + cleanU); }
    if (authType !== 'oauth' && /authorize endpoint/i.test(s.detail) && !/do not present/i.test(s.detail)) validationFailures.push('Step ' + s.title + ' recommends an OAuth authorize endpoint while auth is ' + authType + '.');
    if (approvalMeaning.status === 'not_applicable' && /submit for review/i.test(s.detail) && !/only if/i.test(s.detail)) validationFailures.push('Step ' + s.title + ' tells the developer to submit for review while docs say review is not required.');
    if (/Register/i.test(s.title) && registerMeaning.status === 'not_applicable' && !/not required/i.test(s.detail)) validationFailures.push('Step ' + s.title + ' tells the developer to register while docs say registration is not required.');
  }
  for (const sc of scopes) { if (!validateScope(sc)) validationFailures.push('Malformed scope token: ' + sc); if (/^(admin|all|full)$/.test(sc.split(/[:.]/).pop()) || sc.split(/[:.]/).includes('admin')) broadScopeWarning = true; }
  if (scopes.some(sc => sc.split(/[:.]/).includes('admin') || sc.split(/[:.]/).includes('all'))) broadScopeWarning = true;
  const keyDecisionsUnknown = decisions.filter(d => ['Is OAuth application registration required', 'Does public distribution require approval'].includes(d.claim) && d.status === 'unknown').length;
  if (keyDecisionsUnknown >= 2) { confidence = 'Low'; qualityGate.checksFailed.push('Key requirements unknown: registration and approval are both Unknown, confidence capped Low, not verified.'); }
  if (validationFailures.length) {
    guideType = 'draft';
    confidence = 'Low';
    verificationStatus = 'Unverified, validation failed, see quality gate';
    qualityGate.completeness = 'draft';
    for (const f of validationFailures) qualityGate.checksFailed.push('Validation failed: ' + f);
    qualityGate.validationFailures = validationFailures;
    qualityGate.broadScopeWarning = broadScopeWarning;
  } else {
    qualityGate.checksPassed.push('Final consistency check: no critical contradiction, no metadata scope, no API page as console, no unsupported mandatory requirement');
    qualityGate.broadScopeWarning = broadScopeWarning;
  }
  qualityGate.factualConfidence = confidence;
  qualityGate.factualVerification = validationFailures.length ? 'unverified' : (keyDecisionsUnknown >= 2 ? 'partial' : 'docs checked, not sign-in tested');
  qualityGate.claimsVerified = claims.filter(c => c.verified).length + ' of ' + claims.length + ' claims verified by a passage';
  // Timeline, checklist, blockers built from requirements and steps.
  const timeline = [
    { stage: 'Registration and credentials', wait: 'Estimate: 30 minutes to 1 hour for a first app, not a published provider time', note: 'Create the app or credentials, record client ID or key, store secrets server side.' },
    { stage: 'Auth test', wait: 'Estimate: 30 minutes, not a published provider time', note: 'One real consent or credential flow and one API call with a stored token or key.' },
    { stage: 'Provider review and publishing', wait: approvalMeaning.status === 'not_applicable' ? 'No provider review required, per fetched docs' : (approvalSnippet ? (timePhrase(approvalSnippet) ? 'Published phrase found: ' + timePhrase(approvalSnippet) + ', see evidence, not a guarantee' : 'Varies, see sources. No fixed timeline was confirmed in this research run.') : 'Unknown, do not promise a date until review docs are checked'), note: approvalMeaning.status === 'not_applicable' ? 'No provider review submission is required, per fetched docs.' : 'Authentication is not app review. Publishing or listing needs its own submission, if required.' }
  ];
  const checklist = requirements.map(r => ({ item: r.name + ' (' + r.status + (r.condition ? ', ' + r.condition : '') + ')', status: r.status, who: r.name.includes('Admin') || r.name.includes('Public') || r.name.includes('Privacy') ? 'human' : 'agent' }));
  checklist.push({ item: 'One real auth test completed', status: 'unknown', who: 'agent' });
  const blockers = [];
  if (authType === 'oauth') {
    blockers.push({ blocker: 'Redirect URL mismatch', fix: 'Copy the exact redirect URL from official docs and from your code, including host and path.' });
    blockers.push({ blocker: 'Scope not available or not verified', fix: 'Check product and scope access on the official portal before building on that API.' });
    blockers.push({ blocker: 'Client secret exposed', fix: 'Rotate the secret at once, remove it from code, logs, and repos, and store the new secret server side.' });
  }
  if (approvalSnippet && approvalMeaning.status !== 'not_applicable') blockers.push({ blocker: 'Review submission incomplete', fix: 'Add a live privacy policy URL, a test account, and a justification for every scope before resubmitting.' });
  if (pricingSnippet) blockers.push({ blocker: 'Pricing or tier limit', fix: 'Check official pricing and tier docs, and confirm the feature is included in your plan before building.' });
  blockers.push({ blocker: 'Research source was not official', fix: 'Mark the guide as unverified and do not use it for a launch decision.' });
  if (authType === 'api_key') blockers.push({ blocker: 'Platform may use API keys instead of OAuth', fix: 'Fetched docs support API keys. Do not present API key access as OAuth, and do not build an OAuth flow for this provider.' });
  if (broadScopeWarning) blockers.push({ blocker: 'Broad scope in extracted list', fix: 'A broad scope such as admin or all was found. Do not request it without a stated use case for that scope, and check official docs for a narrower scope first.' });
  if (validationFailures.length) blockers.push({ blocker: 'Validation failed', fix: 'See quality gate validation failures. Do not use this guide as a full guide until those contradictions are resolved in official docs.' });
  // Difficulty, honest, from evidence, not a fixed rule.
  let difficulty = 'Unknown'; let difficultyWhy = '';
  if (sources.length === 0) { difficulty = 'Unknown'; difficultyWhy = 'No official docs could be verified in this research run, so difficulty cannot be set.'; }
  else if (/business verification|company verification/i.test(allText)) { difficulty = 'Hard'; difficultyWhy = 'Hard from retrieved docs: sources mention business or enterprise verification, which usually adds a human review step.'; }
  else if (approvalSnippet && approvalMeaning.status !== 'not_applicable' && approvalMeaning.status !== 'optional') { difficulty = 'Medium to Hard'; difficultyWhy = 'Medium to Hard from retrieved docs: sources mention approval, review, or verification, so setup is not just registration.'; }
  else if (authType === 'api_key') { difficulty = 'Easy'; difficultyWhy = 'Easy from retrieved docs: API key authentication was found, with no OAuth app or review evidence in fetched pages.'; }
  else if (finalTr.hasClient && scopes.length) { difficulty = 'Medium'; difficultyWhy = 'Medium from retrieved docs: registration with client ID and scopes was found, but no approval or business verification was found in fetched pages.'; }
  else { difficulty = 'Unknown'; difficultyWhy = 'Sources were found, but they did not contain enough registration, scope, or review evidence to set difficulty. Do not use a guessed difficulty.'; }
  const setupTime = sources.length && (finalTr.hasClient || authType !== 'unknown') ? 'Estimate: 1 to 2 hours for a first test, not a published provider time, based on steps found in sources, plus review time if required' : 'Unknown, registration steps were not fully found in fetched pages';
  const approvalWait = approvalMeaning.status === 'not_applicable' ? 'No provider review required, per fetched docs' : (approvalSnippet ? (timePhrase(approvalSnippet) ? 'Published phrase found: ' + timePhrase(approvalSnippet) + ', see evidence, not a guarantee' : 'Varies, see sources. No fixed timeline was confirmed in this research run.') : 'Unknown, do not promise a date until review docs are checked');
  const guide = {
    id: 'generated-' + slug,
    name: app,
    category: 'Generated, from live research',
    difficulty, difficultyWhy, setupTime, approvalWait,
    accountNeeded: sources.length ? 'Provider developer account, see first source' : 'Unknown, check the provider developer docs',
    cost: pricingSnippet ? 'Check pricing in official docs, see evidence in blockers' : 'Unknown, check provider pricing in official docs',
    consoleName: consolePick ? 'Official developer portal, see sources' : 'Unknown, find the official developer console first',
    consoleUrl,
    guideType, verificationStatus, confidence,
    authType,
    decisions,
    claims,
    semanticVerification: { method: 'deterministic sentence semantics with linked negation and modal proximity, no model', modelUsed: false, reason: 'No free or local model is available in this Vercel serverless function without a paid dependency, slow inference, or an unreliable external API. See notes for the evaluation.', validatedAgainstPassages: true, limitation: 'This rule engine is not semantic understanding. Complex negation, exceptions, and conditional requirements that do not follow linked patterns are marked Unknown, not guessed.' },
    evidenceSummary,
    requirements,
    qualityGate,
    managedAppNote: 'Check first whether a managed app already covers this platform. If it does, you may not need your own app. Managed support for this specific provider was not confirmed in this research run, check the Composio toolkit list before building.',
    nextStep: validationFailures.length ? 'Validation failed: ' + validationFailures.join(' ') + ' Do not use this as a full guide. Check official docs manually.' : researchFailed ? (sources.length === 0 ? 'Provider could not be identified from search results, and no official docs were fetched. Do not guess a domain. Provide the official website or developer docs URL, then research again, and do not use this draft as a verified guide.' : 'Research did not find usable official docs. Use the findings below, check the official portal manually, and do not use this draft as a verified guide.') : (consolePick ? 'Open the developer portal, confirm the authentication model, then follow the steps in order.' : 'Open the first source below, confirm the authentication model and registration portal, then follow the steps in order.'),
    steps, timeline, checklist, blockers,
    agentCan: ['Search for official docs', 'Fetch candidate pages', 'Extract scopes, endpoints, and review evidence with sources', 'Draft checklists and timelines from evidence'],
    humanMust: approvalMeaning.status === 'not_applicable' ? ['Confirm the official portal', 'Sign in to the provider console', 'Verify scopes and review requirements', 'Confirm no review is required in official docs'] : ['Confirm the official portal', 'Sign in to the provider console', 'Verify scopes and review requirements', 'Submit for review and reply to reviewers only if docs say public distribution requires it'],
    sources,
    tested: 'Live research run on ' + new Date().toISOString() + '. Multi-stage investigation: provider discovery, authentication, registration, permissions, distribution, approval, and blockers, each with sources and passages where found. No account sign-in, app creation, or provider approval was completed. This is deterministic evidence extraction with linked negation and modal checks, not a language model reasoning step, and not semantic understanding. Uncertain claims are marked Unknown.',
    notVerified: ['All provider-specific details not extracted from a fetched official page', ...(validationFailures.length ? ['Validation failed, see quality gate'] : []), ...(keyDecisionsUnknown >= 2 ? ['Key requirements unknown: registration and approval'] : []), ...(sources.length === 0 ? ['Provider identification, no provider host could be validated from search results'] : []), 'Exact console layout', 'Exact scope list for your feature', 'Approval timeline', 'Distribution requirements', 'Managed authentication support for this provider', ...(contradictions.length ? ['Contradictions found, see evidence summary'] : []), ...(consolePick ? [] : ['Registration URL, no developer portal candidate scored high enough'])],
    executionLog: log
  };
  const extractionMs = Date.now() - tExtraction0;
  const totalMs = Date.now() - t0;
  const timings = { searchMs, retrievalMs, extractionMs, totalMs, cached: false, tavilyCallsUsed, pagesFetched: pages.length, sourcesFound: sources.length, tracksFound: evidenceCoverage };
  logPush('generate_guide', '', 'complete', 'Generated ' + guideType + ' guide with ' + sources.length + ' sources, ' + scopes.length + ' scopes, auth ' + authType + ', confidence ' + confidence + ', tracks ' + evidenceCoverage + ' of 6. Timings: search ' + searchMs + 'ms, retrieval ' + retrievalMs + 'ms, extraction ' + extractionMs + 'ms, total ' + totalMs + 'ms. Tavily calls: ' + tavilyCallsUsed + '.');
  guide.executionLog = log; guide.timings = timings;
  if (guideType === 'full' && confidence === 'Medium' && sources.length >= 2) guideCache.set(slug, { guide, log, at: Date.now() });
  res.status(200).json({ guide, log, timings, cached: false });
};
