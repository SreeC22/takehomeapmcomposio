const { stripHtml, sectionFor, isProviderHost, parseInput, canonicalUrl, baseDomain, validateScope, metadataTokenCount, extractScopes, extractEndpoints, extractRelativeEndpoints, findSnippet, cleanSnippet, timePhrase, classifyPassage, consoleScore, productPath, extractScopesFromPages, extractScopesFromScopeText, extractNextDataText , fetchText, fetchOnce } = require('./research-helpers');
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
  
async function researchHandler(req, res) {
  const t0 = Date.now();
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
      const provider = allWithTitle.filter(x => { try { const h = new URL(x.url).hostname.toLowerCase(); const firstLabel = h.split('.')[0]; const secondLast = h.split('.').slice(-2, -1)[0] || ''; const titleNorm = String(x.title || '').toLowerCase().replace(/[^a-z0-9]/g, ''); const slugNorm = String(slug || '').replace(/[^a-z0-9]/g, ''); const appNorm = String(app || '').toLowerCase().replace(/[^a-z0-9]/g, ''); const titleMatch = (slugNorm && titleNorm.includes(slugNorm)) || (appNorm.length >= 3 && titleNorm.includes(appNorm)); return isProviderHost(h, slug, domainGuess) || firstLabel.startsWith(slug) || secondLast.startsWith(slug) || titleMatch; } catch (e) { return false; } }).map(x => x.url);
      const rank = (u) => { try { const uu = new URL(u); const host = uu.hostname.toLowerCase(); const path = uu.pathname.toLowerCase(); if (host.startsWith('community.') || host.startsWith('forum.') || path.includes('/blog/') || path.includes('/forums/') || path.includes('/forum/') || path.includes('/community/')) return 100; if (host.startsWith('developers.') || host.startsWith('developer.') || host.startsWith('docs.')) return 0; if (path.includes('/oauth') || path.includes('/docs/') || path.includes('/developer')) return 1; return 2; } catch (e) { return 3; } };
      const out = provider.filter(u => rank(u) < 100).sort((a, b) => rank(a) - rank(b)).slice(0, 8);
      for (const u of out) { try { candidateHosts.add(new URL(u).hostname.toLowerCase()); } catch (e) {} }
      logPush('search', 'https://api.tavily.com/search', tavRes && tavRes.ok ? 'found_' + out.length : 'failed_' + (tavRes ? tavRes.status : 0), 'Query "' + query + '" returned ' + all.length + ' URLs, ' + out.length + ' provider-specific, community and blog excluded from primary list.');
      return out;
    } catch (e) { logPush('search', 'https://api.tavily.com/search', 'failed', 'Tavily search failed: ' + String(e && e.message ? e.message : e)); return []; }
  }
  let searchUrls = [];
  const candidateHosts = new Set();
  if (!parsed.isIp) {
    if (!process.env.TAVILY_API_KEY) logPush('search', 'https://api.tavily.com/search', 'skipped_no_key', 'No TAVILY_API_KEY set, using site navigation fallback.');
    else {
      const results = await Promise.all([
        tavilySearch(app + ' OAuth developer docs register app scopes'),
        tavilySearch(app + ' developer app review approval distribution marketplace')
      ]);
      searchUrls = results.flat();
      const domainCounts = {};
      for (const u of searchUrls) { try { const h = new URL(u).hostname.toLowerCase().replace(/^www\./, ''); const firstLabel = h.split('.')[0]; const secondLast = h.split('.').slice(-2, -1)[0] || ''; if (!(firstLabel.startsWith(slug) || secondLast.startsWith(slug))) continue; domainCounts[h] = (domainCounts[h] || 0) + 1; } catch (e) {} }
      const rankedDomains = Object.entries(domainCounts).sort((a, b) => b[1] - a[1]);
      if (rankedDomains.length) { domainGuess = rankedDomains[0][0]; logPush('provider_discovery', '', 'canonical_' + domainGuess, 'Search consensus provider domain: ' + domainGuess + ' from ' + rankedDomains[0][1] + ' provider URLs. Other domains in results: ' + rankedDomains.slice(1).map(x => x[0] + '(' + x[1] + ')').join(', ')); }
    }
  }
  const searchMs = Date.now() - tSearch0;
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
        if (!isProviderHost(uu.hostname.toLowerCase(), slug, domainGuess) && !candidateHosts.has(uu.hostname.toLowerCase())) return null;
        const path = uu.pathname.toLowerCase();
        if (url.includes('#content') || /\.(ico|png|jpg|jpeg|svg|css|js|json|webmanifest|pdf)(\?|$)/.test(path) || path.startsWith('/apps/')) return null;
        if (uu.hostname.startsWith('community.') || uu.hostname.startsWith('forum.') || path.includes('/blog/') || path.includes('/forums/') || path.includes('/forum/') || path.includes('/community/')) return null;
      } catch (e) { return null; }
      const cachedDoc = docCache.get(canonicalUrl(url) + '|v2');
      if (cachedDoc && Date.now() - cachedDoc.at < CACHE_TTL_MS && cachedDoc.text && (/oauth/i.test(cachedDoc.text) || /client[ _-]id/i.test(cachedDoc.text) || /scope/i.test(cachedDoc.text))) {
        logPush('fetch_page', url, 'cached', 'Document cache hit, no refetch.');
        addSource(url); return { url, text: cachedDoc.text };
      }
      const page = await fetchText(url, 3000, allowProxy);
      if (page.ok && page.body) {
        const strippedFull = stripHtml(page.body);
        const text = strippedFull.length > 500000 ? strippedFull.slice(0, 500000) : strippedFull;
        if (strippedFull.length > 500000) logPush('fetch_page', url, 'truncated', 'Cleaned page text over 500KB, truncated to first 500KB to avoid memory failure.');
        if (/oauth/i.test(text) || /client[ _-]id/i.test(text) || /scope/i.test(text)) docCache.set(canonicalUrl(url) + '|v2', { text, at: Date.now() });
        let text2 = text;
        if (text.length < 2000) { const nd = extractNextDataText(page.body); if (nd) { text2 = nd; logPush('fetch_page', url, 'next_data', 'Short JS shell, extracted article text from embedded page data.'); } }
        const hasOAuth = /oauth/i.test(text2); const hasClient = /client[ _-]id/i.test(text2); const hasScope = /scope/i.test(text2);
        logPush('fetch_page', url, 'ok_' + page.status + (page.viaProxy ? '_via_proxy' : ''), 'Fetched. OAuth: ' + hasOAuth + ', client ID: ' + hasClient + ', scope: ' + hasScope + '. Text length: ' + text2.length + '.');
        if (hasOAuth || hasClient || hasScope) { addSource(url); return { url, text: text2, html: page.body }; }
        if (text2.length < 2000 && !url.endsWith('.md')) return { url, text: text2, mdCandidate: url.replace(/\/$/, '') + '.md' };
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
    if (mdCandidates.length) {
      const mdResults = await Promise.allSettled(mdCandidates.slice(0, 3).map(async (url) => {
        try {
          const uu = new URL(url);
          if (!isProviderHost(uu.hostname.toLowerCase(), slug, domainGuess) && !candidateHosts.has(uu.hostname.toLowerCase())) return null;
        } catch (e) { return null; }
        const page = await fetchText(url, 3000, false);
        if (page.ok && page.body) {
          const strippedFull = stripHtml(page.body);
          const text = strippedFull.length > 500000 ? strippedFull.slice(0, 500000) : strippedFull;
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
      scopes: extractScopesFromPages(pages),
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
  if (!parsed.isIp && parsed.hostname) {
    let suppliedUrl = '';
    try { suppliedUrl = /^https?:\/\//i.test(rawApp) ? rawApp : (rawApp.includes('/') ? 'https://' + rawApp : ''); } catch (e) {}
    if (suppliedUrl) {
      try {
        const su = new URL(suppliedUrl);
        if (su.pathname && su.pathname !== '/' && isProviderHost(su.hostname.toLowerCase(), slug, domainGuess)) {
          logPush('supplied_url', suppliedUrl, 'direct_fetch', 'Reviewer supplied a website URL, fetching it directly in addition to search results.');
          await fetchBatch([suppliedUrl], true);
        }
      } catch (e) {}
    }
  }
  await fetchBatch(searchUrls.slice(0, 8), true);
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
  if (!parsed.isIp && !tracksSufficient(trackState())) {
    const linkUrls = [];
    for (const p of pages) {
      if (!p.html) continue;
      const hrefs = Array.from(String(p.html).matchAll(/href=["']([^"']+)["']/g)).map(m => m[1]);
      for (const href of hrefs) {
        try {
          const absUrl = new URL(href, p.url); const abs = absUrl.toString(); const path = absUrl.pathname.toLowerCase();
          if (!abs.startsWith('https://') || !isProviderHost(absUrl.hostname.toLowerCase(), slug, domainGuess)) continue;
          if (/\.(ico|png|jpg|jpeg|svg|css|js|json|webmanifest|xml|pdf)(\?|$)/.test(path)) continue;
          if (absUrl.hostname.startsWith('community.') || absUrl.hostname.startsWith('forum.') || path.includes('/blog/')) continue;
          if (path.includes('/oauth') || path.includes('/scopes') || path.includes('/review') || path.includes('/marketplace') || path.includes('/publish') || path.includes('/verification') || path.includes('/authentication')) linkUrls.push(abs);
        } catch (e) {}
      }
    }
    const rankLink = (u) => { try { const path = new URL(u).pathname.toLowerCase(); if (path.includes('/oauth')) return 0; if (path.includes('/scopes') || path.includes('/authentication')) return 1; return 2; } catch (e) { return 3; } };
    const uniqueLinks = linkUrls.filter((u, i, a) => a.map(canonicalUrl).indexOf(canonicalUrl(u)) === i).sort((a, b) => rankLink(a) - rankLink(b)).slice(0, 3);
    if (uniqueLinks.length) { logPush('follow_links', '', 'found_' + uniqueLinks.length, 'Following ' + uniqueLinks.length + ' links found inside official docs, for missing tracks only.'); await fetchBatch(uniqueLinks, false); tr = trackState(); }
  }
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
              if (/\.(ico|png|jpg|jpeg|svg|css|js|json|webmanifest|xml|pdf)(\?|$)/.test(path)) continue;
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
  if (!parsed.isIp && !tracksSufficient(trackState()) && domainGuess) {
    try {
      const llmsResults = await Promise.allSettled([fetchText('https://' + domainGuess + '/docs/llms.txt', 3000, false), fetchText('https://' + domainGuess + '/llms.txt', 3000, false)]);
      const llmsUrls = [];
      for (const lr of llmsResults) {
        if (lr.status === 'fulfilled' && lr.value.ok && lr.value.body) {
          for (const line of String(lr.value.body).split('\n')) {
            const m = line.match(/https?:\/\/[^\s)]+/);
            if (!m) continue;
            try {
              const uu = new URL(m[0]); const pth = uu.pathname.toLowerCase();
              if (isProviderHost(uu.hostname.toLowerCase(), slug, domainGuess) && (pth.includes('/oauth') || pth.includes('/scope') || pth.includes('/auth'))) llmsUrls.push(m[0]);
            } catch (e) {}
          }
        }
      }
      const uniqLlms = llmsUrls.filter((u, i, a) => a.map(canonicalUrl).indexOf(canonicalUrl(u)) === i).slice(0, 3);
      if (uniqLlms.length) { logPush('llms_txt', '', 'found_' + uniqLlms.length, 'Following ' + uniqLlms.length + ' oauth, scope, or auth links from llms.txt.'); await fetchBatch(uniqLlms, false); tr = trackState(); }
    } catch (e) {}
  }
  if (!parsed.isIp && !tracksSufficient(trackState()) && domainGuess) {
    await fetchBatch([
      'https://developers.' + domainGuess + '/docs/oauth',
      'https://developer.' + domainGuess + '/docs/oauth',
      'https://developers.' + domainGuess + '/docs/authentication',
      'https://developer.' + domainGuess + '/docs/authentication'
    ], false);
    tr = trackState();
  }
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
  let providerIdentityAmbiguous = false;
  let discardedProviderDomains = [];
  let keptParentDomains = [];
  let canonicalProviderDomain = domainGuess || '';
  if (pages.length) {
    const clusters = {};
    for (const pg of pages) { try { const host = new URL(pg.url).hostname.toLowerCase().replace(/^www\./, ''); (clusters[host] = clusters[host] || []).push(pg); } catch (e) {} }
    const appRe = (() => { try { return new RegExp(String(app || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); } catch (e) { return null; } })();
    const productMention = (pg) => !!(appRe && appRe.test(pg.text) && /oauth|api|scope|client/i.test(pg.text));
    const scored = Object.entries(clusters).map(([bd, plist]) => ({ bd, plist, evidence: plist.filter(x => /oauth/i.test(x.text) || /client[ _-]id/i.test(x.text) || /scope/i.test(x.text)).length, canonical: bd === domainGuess ? 1 : 0, mentions: plist.filter(productMention).length })).sort((a, b) => (b.mentions - a.mentions) || (b.evidence - a.evidence) || (b.plist.length - a.plist.length) || (b.canonical - a.canonical));
    const dominantSlugOk = scored.length && scored[0].bd.split('.').some(label => label === slug || label.startsWith(slug));
    if (scored.length && !dominantSlugOk) {
      providerIdentityAmbiguous = true;
      logPush('provider_identity', '', 'ambiguous', 'Dominant fetched domain ' + scored[0].bd + ' does not contain provider name ' + slug + '. Identity not verified, guides must not merge unrelated providers.');
    } else if (scored.length > 1 && baseDomain(scored[0].bd) !== baseDomain(scored[1].bd) && isProviderHost(scored[0].bd, slug, domainGuess) && isProviderHost(scored[1].bd, slug, domainGuess) && Math.abs(scored[0].evidence - scored[1].evidence) <= 1 && Math.abs(scored[0].plist.length - scored[1].plist.length) <= 1 && scored[0].mentions > 0 && scored[1].mentions > 0) {
      providerIdentityAmbiguous = true;
      logPush('provider_identity', '', 'ambiguous', 'Same-name providers found on multiple domains with equal evidence: ' + scored.map(x => x.bd).join(', ') + '. No dominant provider, guides must not merge them.');
    } else if (scored.length > 1) {
      const keep = scored[0];
      canonicalProviderDomain = keep.bd;
      const parentPages = [];
      for (const cl of scored.slice(1)) for (const pg of cl.plist) { try { if (baseDomain(new URL(pg.url).hostname) === baseDomain(keep.bd) || (productMention(pg) && candidateHosts.has(new URL(pg.url).hostname.toLowerCase()))) parentPages.push(pg); } catch (e) {} }
      const keepPages = [...keep.plist, ...parentPages];
      const parentDomains = Array.from(new Set(parentPages.map(pg => { try { return new URL(pg.url).hostname.toLowerCase().replace(/^www\./, ''); } catch (e) { return ''; } }).filter(Boolean)));
      discardedProviderDomains = scored.slice(1).map(x => x.bd).filter(bd => !parentDomains.includes(bd));
      const keepSet = new Set(keepPages);
      const removedPages = pages.filter(x => !keepSet.has(x));
      pages.splice(0, pages.length, ...keepPages);
      for (let i = sources.length - 1; i >= 0; i--) { try { const host = new URL(sources[i]).hostname.toLowerCase().replace(/^www\./, ''); if (host !== keep.bd && !parentDomains.includes(host)) sources.splice(i, 1); } catch (e) {} }
      logPush('provider_identity', '', 'separated_' + keep.bd, 'Kept provider domain ' + keep.bd + (parentDomains.length ? ', plus parent-domain product pages from ' + parentDomains.join(', ') : '') + ', discarded ' + discardedProviderDomains.join(', ') + ' (' + removedPages.length + ' pages), not merged.');
      keptParentDomains = parentDomains;
    } else if (scored.length === 1) {
      canonicalProviderDomain = scored[0].bd;
    }
  }
  // If we have genuine provider-domain documentation, third-party setup
  // tutorials and GitHub issue threads cannot corroborate the provider's
  // API requirements or trigger false same-name/provider conflicts.
  const firstPartyPages = pages.filter(p => {
    try { return isProviderHost(new URL(p.url).hostname.toLowerCase(), slug, domainGuess); }
    catch (e) { return false; }
  });
  if (firstPartyPages.length) {
    const dropped = pages.length - firstPartyPages.length;
    if (dropped) {
      pages.splice(0, pages.length, ...firstPartyPages);
      const retained = new Set(firstPartyPages.map(p => canonicalUrl(p.url)));
      for (let i = sources.length - 1; i >= 0; i--)
        if (!retained.has(canonicalUrl(sources[i]))) sources.splice(i, 1);
      keptParentDomains = [];
      logPush('source_authority', '', 'official_only',
        'Excluded ' + dropped + ' third-party page(s) from factual claims because first-party documentation was available.');
    }
  }
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
  // Classify the developer's use case (connecting their users), not any
  // occurrence of OAuth in a provider's site. SSO, admin tokens, Workers,
  // and unrelated identity-provider instructions cannot establish OAuth
  // access to the provider API.
  const customerOAuthPages = pages.filter(pg => {
    let path = '';
    let host = '';
    try { const u = new URL(pg.url); path = u.pathname.toLowerCase(); host = u.hostname.toLowerCase(); } catch (e) { return false; }
    if (!isProviderHost(host, slug, domainGuess) && !keptParentDomains.includes(host)) return false;
    if (/(?:sso|single.sign.on|sign.in.with|identity.provider|workers|\/admin\/|\/mcp\/|\/sdk\/)/i.test(path)) return false;
    if (!/(?:oauth|authorization|authentication|public.connections?)/.test(path)) return false;
    const txt = String(pg.text || '');
    if (!/\boauth\b|oauth2|oauth 2\.0|authorization code/i.test(txt)) return false;
    return /(?:public\s+(?:apps?|connections?|integrations?)|third.party\s+(?:apps?|integrations?|developers?)|on behalf of|users?\s+(?:can\s+)?authoriz|authoriz\w*\s+(?:the\s+)?users?|connect\s+(?:an?\s+)?app\s+through\s+oauth|oauth\s+(?:client|application|flow)|client\s+id.{0,100}redirect)/i.test(txt);
  });
  const customerOAuthText = customerOAuthPages.map(p => p.text).join('\n');
  const customerOAuthEvidence = findSnippet(customerOAuthText, [
    'public app', 'public connection', 'connect an app through oauth',
    'on behalf of', 'oauth client', 'authorization code', 'setting up oauth'
  ]);
  let registerSnippet = findSnippet(customerOAuthText, ['create a public connection', 'create a new public connection', 'register an oauth', 'register a new oauth', 'create an oauth app', 'create an oauth client', 'create a new app', 'register your app', 'register an application', 'create your app', 'create a developer app', 'create an application', 'registration is not required']) || findSnippet(allText, ['register an oauth', 'create an oauth app', 'create an oauth client', 'create a new app', 'register your app']);
  const redirectSnippet = findSnippet(allText, ['redirect uri', 'redirect url', 'callback url']);
  const relevantApprovalText = pages.filter(p => { try { return /(?:oauth|authorization|authentication|marketplace|app.listing|app.review|approval|verification|distribution|public.connections|getting.started|overview)/i.test(new URL(p.url).pathname) && !/(?:shipping.updates|changelog|release.notes|feature.update)/i.test(new URL(p.url).pathname); } catch (e) { return false; } }).map(p => p.text).join('\n');
  let approvalSnippet = findSnippet(relevantApprovalText, ['app review', 'app approval', 'submit for review', 'marketplace review', 'security review', 'admin consent', 'business verification', 'publisher verification']);
  const reviewGateSnippet = findSnippet(customerOAuthText, ['review your oauth client', 'oauth client will be reviewed', 'oauth app is pending', 'client is pending approval', 'pending oauth client']);
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
  const oauth21Snippet = findSnippet(allText, ['oauth 2.1', 'oauth2.1']);
  const regFreeSnippet = findSnippet(customerOAuthText, ['dynamic client registration', 'no registration required', 'registration-free', 'client id metadata', 'metadata document', 'do not need to pre-register', 'without pre-registering', 'do not need to register']);
  const adminConsentSnippet = findSnippet(allText, ['admin consent']);
  const privateSnippet = findSnippet(allText, ['private app', 'private integration', 'internal app', 'do not need review', 'no review required']);
  const privacySnippet = findSnippet(allText, ['privacy policy']);
  let registerSnippetRaw = registerSnippet;
  let externalIdpName = '';
  {
    const idpMatch = allText.match(/(?:authenticate through|sign in with|configure)\s+([A-Z][A-Za-z]+)\s+(?:as|for)\s+(?:an?\s+)?(?:identity provider|idp)/i) || allText.match(/([A-Z][A-Za-z]+)\s+(?:as|for)\s+(?:an?\s+)?identity provider/i);
    if (idpMatch) {
      const cand = (idpMatch[1] || '').toLowerCase();
      if (cand && cand !== slug && cand !== (app || '').toLowerCase() && cand.length >= 3) externalIdpName = cand;
    }
    if (externalIdpName && registerSnippet && /identity provider/i.test(registerSnippet) && registerSnippet.toLowerCase().includes(externalIdpName)) {
      registerSnippet = '';
    }
    if (registerSnippet && ssoSnippet && sourceFor(registerSnippet) && sourceFor(registerSnippet) === sourceFor(ssoSnippet)) {
      registerSnippet = '';
    }
    if (registerSnippet) {
      const regSection = registerSnippet.startsWith('[Section: ') ? registerSnippet.slice(10, registerSnippet.indexOf(']')) : '';
      const regSource = sourceFor(registerSnippet);
      const devCtx = /oauth|developer|client/i.test(registerSnippet.replace(/^\[Section: [^\]]+\]\s*/, '')) || /oauth|developer/i.test(regSection) || /developer|oauth/i.test(regSource || '');
      if (!devCtx) registerSnippet = '';
    }
  }
  const contradictions = [];
  const scopeSources = [];
  for (const pg of pages) {
    const pgPath = (() => { try { return new URL(pg.url).pathname.toLowerCase(); } catch (e) { return ''; } })();
    const pgSectionScope = /SECTION: [^\n]*scope/i.test(pg.text);
    if (!(pgPath.includes('scope') || pgSectionScope)) continue;
    const pgScopes = extractScopesFromScopeText(pg.text).filter(x => scopes.includes(x));
    if (pgScopes.length) scopeSources.push({ url: pg.url, product: productPath(pg.url), scopes: pgScopes });
  }
  const scopeProductPaths = Array.from(new Set(scopeSources.map(x => x.product).filter(x => x && x !== 'main')));
  const scopesFromMultipleProducts = scopeProductPaths.length > 1;
  if (scopesFromMultipleProducts) contradictions.push('Scopes were found on multiple product pages (' + scopeProductPaths.join(', ') + '), not one product. They are listed per source below and must not be requested together without checking which product the feature uses.');

  let registerMeaning = classifyPassage(registerSnippet, ['register', 'registration', 'create', 'oauth app', 'application']);
  if (!approvalSnippet && reviewGateSnippet) approvalSnippet = reviewGateSnippet;
  let approvalMeaning = classifyPassage(approvalSnippet, ['app review', 'app approval', 'submit for review', 'marketplace review', 'security review', 'publisher verification', 'business verification', 'verification', 'review']);
  // "Review before marketplace listing" is conditional on choosing to list.
  // It must not be displayed as universal approval for user OAuth.
  if (approvalMeaning.status === 'required' && /(?:marketplace|app store)/i.test(approvalSnippet || '') &&
      /(?:before being listed|to be listed|for listing|marketplace listing|listed on|listing in)/i.test(approvalSnippet || '')) {
    approvalMeaning = { status: 'conditional',
      condition: 'Marketplace listing requires a provider review; whether public OAuth connections can be used without a listing is a separate decision.' };
  }
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
  let authType = 'unknown';
  const oauthStrong = customerOAuthPages.length > 0 && !!customerOAuthEvidence;
  const apiKeyStrong = finalTr.hasApiKey && !oauthStrong;
  const keyTokenStrong = !oauthStrong && finalTr.endpointPaths && finalTr.endpointPaths.some(x => x.includes('authorize')) && /key/i.test(allText) && /token/i.test(allText);
  if (oauthStrong) authType = 'oauth';
  else if (keyTokenStrong) authType = 'key_token';
  else if (apiKeyStrong) authType = 'api_key';
  else if (finalTr.hasServiceAccount && !finalTr.hasOAuth) authType = 'service_account';
  else if (finalTr.hasPersonalToken && !finalTr.hasOAuth) authType = 'personal_access_token';
  else if (mcpSnippet && (() => { try { const u = new URL(sourceFor(mcpSnippet) || ''); const pth = u.pathname.toLowerCase(); return pth.includes('mcp') || pth.includes('/docs/') || pth.includes('/developer/'); } catch (e) { return false; } })()) authType = 'mcp_authentication';
  const apiScopes = scopes.filter(s => !['openid', 'profile', 'email'].includes(s));
  const authSystems = [];
  function authSystem(system, found, evidenceText) {
    const ev = evidenceText ? cleanSnippet(evidenceText) : '';
    authSystems.push({ system, found, evidence: ev, evidenceUrl: sourceFor(evidenceText), verified: !!(found && ev && sourceFor(evidenceText)) });
  }
  authSystem('third_party_oauth', oauthStrong, customerOAuthEvidence || '');
  authSystem('sign_in_oauth', !!signInSnippet, signInSnippet);
  authSystem('registration_free_oauth', !!regFreeSnippet, regFreeSnippet);
  authSystem('api_key', finalTr.hasApiKey, apiKeySnippet);
  authSystem('personal_access_token', finalTr.hasPersonalToken, apiKeySnippet);
  authSystem('service_account', finalTr.hasServiceAccount, '');
  authSystem('mcp_authentication', !!mcpSnippet, mcpSnippet);
  authSystem('sso_enterprise', !!ssoSnippet, ssoSnippet);
  authSystem('oauth_2_1', !!oauth21Snippet && oauthStrong, oauth21Snippet);
  const authRelationships = [];
  function relFor(system, client, resourceOwner, idp, target, actionEnabled, direction, evidenceText) {
    const ev = evidenceText ? cleanSnippet(evidenceText) : '';
    authRelationships.push({ method: system, client, resourceOwner, identityProvider: idp, authorizationTarget: target, actionEnabled, direction, useCase: direction, evidence: ev, evidenceUrl: sourceFor(evidenceText) });
  }
  relFor('third_party_oauth', 'developer application', 'end user', app, 'provider API', 'access end user data through the provider API', 'third-party API access', customerOAuthEvidence);
  relFor('sign_in_oauth', 'developer application', 'end user', app, 'user identity', 'let a user sign in to the developer application', 'sign-in to developer app, not API access', signInSnippet);
  relFor('registration_free_oauth', 'developer application', 'end user', app, 'provider API', 'access provider API without pre-registering an app', 'third-party API access without pre-registration', regFreeSnippet);
  relFor('api_key', 'developer application or own account', 'developer or account owner', 'none, key based', 'provider API', 'access provider API as the key owner', 'own-account API access', apiKeySnippet);
  relFor('personal_access_token', 'developer application', 'token owner', 'none, token based', 'provider API', 'access provider API as the token owner', 'own-account API access', apiKeySnippet);
  relFor('service_account', 'server service', 'organization or service account', app, 'provider API', 'server to server API access', 'server-to-server API access', '');
  relFor('mcp_authentication', 'AI agent or MCP client', 'end user or developer', app, 'MCP tools', 'let an agent call provider tools', 'MCP connection', mcpSnippet);
  relFor('sso_enterprise', 'organization users', 'organization', 'enterprise identity provider', 'provider product login and administration', 'sign users into the provider product and administer the organization', 'enterprise sign-in and administration, not API OAuth', ssoSnippet);
  relFor('oauth_2_1', 'developer application', 'end user', app, 'provider API', 'access end user data through the provider API under OAuth 2.1', 'third-party API access, OAuth 2.1 where documented', oauth21Snippet);
  if (externalIdpName) authRelationships.push({ method: 'external_idp_for_signin', client: 'provider product', resourceOwner: 'end user', identityProvider: externalIdpName, authorizationTarget: 'provider product login', actionEnabled: 'sign users into the provider product using ' + externalIdpName, direction: 'sign-in to provider product using an external identity provider, NOT third-party API access to this provider', useCase: 'sign-in to provider product using an external identity provider, NOT third-party API access to this provider', evidence: '', evidenceUrl: '' });
  if (authType === 'oauth' && !oauthStrong && (signInSnippet || ssoSnippet)) authType = 'sign_in_oauth';

  if (authType === 'oauth' && !oauthStrong && authorizeEndpoints.length === 0 && tokenEndpoints.length === 0 && apiScopes.length === 0) {
    authType = 'sign_in_oauth';
  }
  if (regFreeSnippet) {
    registerMeaning = { status: 'not_applicable', condition: 'Docs say registration is not required or dynamic registration is used: ' + cleanSnippet(regFreeSnippet) };
    if (!registerSnippet) registerSnippet = regFreeSnippet;
  }
  if (oauthStrong && finalTr.hasApiKey) contradictions.push('Docs mention both OAuth and API keys. This guide treats OAuth as the main path only if OAuth endpoints or scopes were found, and lists API keys as a separate check, not as the same flow.');
  if (oauthStrong && noOAuthSnippet) contradictions.push('HARD: Source says OAuth is not supported or API key only, but OAuth endpoints or scopes were also found. Authentication cannot be trusted as OAuth alone.');
  if (finalTr.hasApiKey && finalTr.hasOAuth && !oauthStrong) contradictions.push('Docs mention both OAuth and API keys, but neither path is strong. The simplest supported path cannot be chosen from fetched pages alone.');
  if (/no review required|no approval required/i.test(allText) && finalTr.hasApproval) contradictions.push('Docs contain both review language and no review language. Approval is therefore treated as conditional, not as a universal requirement.');
  const consoleCandidates = sources.map(u => ({ url: u, score: consoleScore(u) })).sort((a, b) => b.score - a.score);
  const bodyUrls = Array.from(String(allText || '').matchAll(/https:\/\/[^\s"'<>]+/g)).map(m => m[0].split(/[`;,\\)\]}]/)[0].replace(/[.,:!?)\]}'"]+$/, ''));
  for (const bu of bodyUrls) {
    try {
      const buu = new URL(bu);
      const buHost = buu.hostname.toLowerCase();
      if (!isProviderHost(buHost, slug, domainGuess)) continue;
      if (baseDomain(buHost) !== baseDomain(domainGuess || canonicalProviderDomain || '')) continue;
      if (/yourdomain|example\.(com|org|net)|your-domain|yourcompany|localhost|127\.0\.0\.1|\{/.test(bu)) continue;
      const buSegs = buu.pathname.toLowerCase().split('/').filter(Boolean);
      const buPortal = buSegs.some(s => ['apps', 'console', 'dashboard', 'settings', 'account', 'developers', 'developer', 'developer-hub'].includes(s)) || buHost.startsWith('console.') || buHost.startsWith('dashboard.') || buHost.startsWith('portal.') || buHost.startsWith('build.');
      if (!buPortal) continue;
      const sc = consoleScore(bu);
      if (sc >= 3 && !consoleCandidates.some(c => canonicalUrl(c.url) === canonicalUrl(bu))) consoleCandidates.push({ url: bu, score: sc });
    } catch (e) {}
  }
  consoleCandidates.sort((a, b) => b.score - a.score);
  const consolePick = consoleCandidates.length && consoleCandidates[0].score >= 3 ? consoleCandidates[0].url : '';
  let consoleUrl = consolePick || 'Unknown';
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
    authRelationships,
    scopeSources,
    scopesFromMultipleProducts,
    externalIdp: externalIdpName || '',
    semanticMethod: 'deterministic sentence semantics, no paid model, no local model in this serverless function. See README for the model evaluation. Model claims, if ever added, must pass the same passage validation or the guide becomes a draft.'
  };
  function makeReq(name, status, condition, evidenceText) {
    return { name, status, condition: condition || '', evidence: evidenceText ? cleanSnippet(evidenceText) : '', evidenceUrl: sourceFor(evidenceText) };
  }
  const requirements = [];
  requirements.push(makeReq('Developer account', accountMeaning.status, accountMeaning.condition, accountSnippet));
  if (authType === 'oauth') {
    requirements.push(makeReq('Register an OAuth app', registerMeaning.status, registerMeaning.condition, registerSnippet));
    requirements.push(makeReq('Redirect URI', redirectMeaning.status, redirectMeaning.condition, redirectSnippet));
    const scopeReqStatus = scopes.length > 0 && scopeMeaning.status === 'unknown' ? 'conditional' : scopeMeaning.status;
  const scopeReqCondition = scopeReqStatus === 'conditional' && scopeMeaning.status === 'unknown' ? 'Scopes were found in official docs scope sections, see scope list. The exact scopes your feature needs were not stated in a single passage, so choose minimum only.' : scopeMeaning.condition;
  const scopeReqEvidence = scopeSnippet || (scopes.length ? 'Scopes found: ' + scopes.join(', ') : '');
  requirements.push(makeReq('Scopes', scopeReqStatus, scopeReqCondition, scopeReqEvidence));
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
  const claims = [];
  for (const r of requirements) {
    const verified = r.status !== 'unknown' && !!(r.evidence && r.evidenceUrl && sources.includes(r.evidenceUrl));
    claims.push({ proposition: r.name + ' is ' + r.status, subject: app, action: r.name, object: r.name, provider: canonicalProviderDomain || domainGuess || app, product: r.evidenceUrl ? productPath(r.evidenceUrl) : '', authContext: authType, sourceUrl: r.evidenceUrl || '', passage: r.evidence || '', section: r.evidence && r.evidence.startsWith('[Section: ') ? r.evidence.slice(10, r.evidence.indexOf(']')) : '', classification: r.status, condition: r.condition || '', confidence: verified ? 'Medium' : 'Low', verified, verificationOutcome: verified ? 'verified' : (contradictions.length ? 'contradicted' : 'unsupported'), contradictoryPassage: contradictions.length ? contradictions[0] : '', contradictoryEvidence: contradictions.slice(0, 2) });
  }
  for (const sys of authSystems) {
    claims.push({ proposition: 'Authentication system ' + sys.system + ' is ' + (sys.found ? 'supported' : 'not found in fetched pages'), subject: app, action: sys.system, object: sys.system, provider: canonicalProviderDomain || domainGuess || app, product: sys.evidenceUrl ? productPath(sys.evidenceUrl) : '', authContext: sys.system, sourceUrl: sys.evidenceUrl || '', passage: sys.evidence || '', section: '', classification: sys.found ? 'supported' : 'unknown', condition: '', confidence: sys.verified ? 'Medium' : 'Low', verified: sys.verified, verificationOutcome: sys.verified ? 'verified' : 'unsupported', contradictoryPassage: '', contradictoryEvidence: [] });
  }
  for (const ep of endpoints) {
    let epSource = '';
    for (const pg of pages) if (pg.text.includes(ep)) { epSource = pg.url; break; }
    const malformed = !/^https:\/\/[^\/]+\/[^\s]*$/.test(ep) || ep.includes('/docs/') || ep.includes('/reference/');
    claims.push({ proposition: 'OAuth endpoint is ' + ep, provider: canonicalProviderDomain || domainGuess || app, product: '', authContext: 'oauth', sourceUrl: epSource, passage: ep, section: '', classification: malformed ? 'invalid' : 'supported', condition: '', confidence: (!malformed && epSource) ? 'Medium' : 'Low', verified: (!malformed && !!epSource), contradictoryEvidence: malformed ? ['Endpoint is malformed or is a docs page, not an endpoint.'] : [] });
  }
  evidenceSummary.claims = claims;
  const checksPassed = []; const checksFailed = [];
  if (evidenceSummary.providerHostMatch) checksPassed.push('Provider identity matches sources'); else checksFailed.push('Provider identity does not match sources');
  if (consolePick) checksPassed.push('Registration URL is a developer portal candidate, not an API reference page'); else checksFailed.push('No developer portal candidate scored high enough, console URL set to Unknown');
  if (authType !== 'unknown') checksPassed.push('Authentication type classified from evidence'); else checksFailed.push('Authentication type unknown');
  if (endpoints.length) checksPassed.push('OAuth endpoints validated as provider hosts, authorize and token categorized'); else if (authType === 'oauth') checksFailed.push('OAuth claimed but no valid endpoints found');
  if (scopes.length) checksPassed.push('Scopes extracted near scope mentions, credential tokens filtered'); else checksFailed.push('No scopes found');
  if (approvalSnippet) checksPassed.push('Approval statements backed by review evidence, not a single generic word'); else checksFailed.push('No approval evidence found, approval set to Unknown');
  const criticalContradictions = contradictions.filter(c => String(c).startsWith('HARD:'));
  const contradictionNotes = contradictions.filter(c => !String(c).startsWith('HARD:'));
  if (criticalContradictions.length) checksFailed.push('Critical contradictions found, see evidence summary');
  if (contradictionNotes.length) checksPassed.push('Non-critical notes recorded in evidence summary, not treated as failures');
  const evidenceCoverage = Object.values(tracks).filter(t => t.status === 'found').length;
  const sourceAuthority = sources.length ? sources.filter(u => { try { const h = new URL(u).hostname.toLowerCase(); return h.startsWith('developers.') || h.startsWith('developer.') || h.startsWith('docs.') || h === domainGuess; } catch (e) { return false; } }).length / sources.length : 0;
  let confidence = 'Low';
  if (authType !== 'unknown' && sources.length >= 2 && (scopes.length > 0 || endpoints.length > 0) && contradictions.length === 0) confidence = 'Medium';
  const researchFailed = sources.length === 0 || authType === 'unknown' || providerIdentityAmbiguous;
  let guideType = researchFailed ? 'draft' : 'full';
  let verificationStatus = sources.length >= 2 ? 'Docs checked, 2 or more sources, no sign-in test' : sources.length === 1 ? 'Partially verified, single source, no sign-in test' : 'Unverified, no official source fetched, no sign-in test';
  const qualityGate = {
    notes: contradictionNotes,
    completeness: guideType,
    evidenceCoverage: evidenceCoverage + ' of 6 tracks found',
    sourceAuthority: Math.round(sourceAuthority * 100) + '% of sources are developer or docs hosts',
    factualConfidence: confidence,
    contradictions,
    checksPassed,
    checksFailed
  };
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
    if (reviewGateSnippet && /admin|review/i.test(reviewGateSnippet)) addStep('Wait for provider review before use', 'What: wait for the provider to review the client before using it, because docs say it starts pending and is not ready until reviewed. Where: provider review, see evidence below. Why: using a pending client before approval wastes the integration attempt.' + ' Evidence from docs: ' + cleanSnippet(reviewGateSnippet), 'human', 'Unknown, review wait varies', 'Do not launch on a pending client.', 'conditional', reviewGateSnippet, 'Provider review is required before the client can be used.');
    const redirectDetail = registerMeaning.status === 'not_applicable'
      ? 'What: add the exact redirect URI from your code to the client registration method documented in sources, because this path does not use a portal app registration. Where: the registration method in official docs, for example a hosted metadata document. Why: the provider only redirects to URIs declared in that registration.' + (redirectSnippet ? ' Evidence from docs: ' + cleanSnippet(redirectSnippet) : ' No redirect rule was found in fetched pages, so copy it from your code and check it against official docs.')
      : 'What: add the exact redirect URI from your code, including host, path, and https, in app settings. Where: app settings in the portal. Why: the provider only redirects to registered URIs.' + (redirectSnippet ? ' Evidence from docs: ' + cleanSnippet(redirectSnippet) : ' No redirect rule was found in fetched pages, so copy it from your code and check it against official docs.');
    addStep('Set the redirect URI', redirectDetail, 'human', '10 minutes', 'A redirect mismatch is the most common first failure.', reqStatus('Redirect URI'), redirectSnippet, reqCondition('Redirect URI'));
    if (scopes.length) addStep('Choose scopes, minimum only', 'What: documented scope examples found in official docs, not a required list for your use case: ' + (scopes.length > 8 ? scopes.slice(0, 8).join(', ') + ', plus ' + (scopes.length - 8) + ' more documented examples, see sources' : scopes.join(', ')) + '. Request only the scopes your feature actually uses, and check the official scopes page for your feature first. Where: app settings and authorize request. Why: broad scopes can trigger extra review and risk. Do not request a broad scope without a stated use case for that scope, and do not request every discovered scope as a default.', 'agent', '20 minutes', 'A single sensitive scope can change the whole timeline.', reqStatus('Scopes'), scopeSnippet, reqCondition('Scopes'));
    else addStep('Confirm permissions or capabilities', 'What: open the provider authorization documentation and confirm how permissions are configured. Some platforms use portal capabilities rather than OAuth scope parameters. Where: official docs. Why: no valid permissions for this exact integration flow were extracted, so do not request guessed scopes.', 'agent', '20 minutes', 'Do not guess scopes.', 'unknown', '');
    if (authorizeEndpoints.length && tokenEndpoints.length) addStep('Build the authorize and token flow', 'What: send the user to the authorize endpoint' + (authorizeEndpoints.length ? ': ' + authorizeEndpoints.join(', ') : '') + ', then exchange the code at the token endpoint' + (tokenEndpoints.length ? ': ' + tokenEndpoints.join(', ') : '') + '. Where: your backend. Why: this is how a user token is issued. Store tokens securely, never in client code.', 'agent', '30 minutes', 'Store client secrets securely. If a secret is exposed, rotate it.', 'unknown', '');
    else addStep('Find the remaining authorize and token endpoints', 'What: confirm both OAuth endpoints before building the flow.' + (authorizeEndpoints.length ? ' Confirmed authorize endpoint: ' + authorizeEndpoints.join(', ') + '.' : ' Authorization endpoint not confirmed.') + (tokenEndpoints.length ? ' Confirmed token endpoint: ' + tokenEndpoints.join(', ') + '.' : ' Token endpoint not confirmed.') + ' Where: official docs. Why: an incomplete endpoint pair is not a runnable OAuth flow.', 'agent', '30 minutes', 'Do not guess endpoints.', 'unknown', '');
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
  } else if (authType === 'mcp_authentication') {
    addStep('Find the MCP server docs', 'What: find the provider MCP server docs in sources below, and confirm which tools it exposes. Where: official MCP docs. Why: this provider authenticates through MCP in fetched docs, not through a standard OAuth app.' + (mcpSnippet ? ' Evidence from docs: ' + cleanSnippet(mcpSnippet) : ''), 'agent', '20 minutes', 'Do not present MCP access as OAuth.', 'unknown', mcpSnippet);
    addStep('Configure the MCP client', 'What: configure the MCP client with the credentials documented for that server, server side only. Where: your MCP client configuration. Why: credentials in client code or a public repo are exposed.', 'human', '20 minutes', 'Never put credentials in client code.', 'unknown', '');
    addStep('Test one MCP tool call', 'What: test one read-only tool call through the MCP server, and confirm it returns expected data. Where: your test account. Why: a working tool call proves the MCP path before building more.', 'agent', '20 minutes', 'If the call fails, check server URL, credentials, and tool permissions first.', 'unknown', '');
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
  const independentRemovals = [];
  const independentCorrections = [];
  {
    const thirdPartySys = authSystems.find(x => x.system === 'third_party_oauth');
    const signInSys = authSystems.find(x => x.system === 'sign_in_oauth');
    const ssoSys = authSystems.find(x => x.system === 'sso_enterprise');
    const freshRegNeg = findSnippet(allText, ['no registration required', 'registration is not required', 'registration not required', 'do not need to register']);
    const freshApprovalOpt = findSnippet(allText, ['verification is optional', 'review is not required', 'approval is not required', 'no approval required', 'no review required']);
    for (let i = steps.length - 1; i >= 0; i--) {
      const st = steps[i];
      if (/^Register the app/i.test(st.title) && freshRegNeg) {
        independentRemovals.push('Independent gate removed Register step: fresh source text says registration is not required, but the generator built a registration step.');
        steps.splice(i, 1); continue;
      }
      if (/submit for review/i.test(st.title) && freshApprovalOpt && !/only if/i.test(st.detail || '')) {
        independentRemovals.push('Independent gate removed review step: fresh source text says review is optional or not required, but the step told the developer to submit for review.');
        steps.splice(i, 1); continue;
      }
      if ((/^Register the app/i.test(st.title) || /authorize and token flow/i.test(st.title)) && thirdPartySys && !thirdPartySys.found && (signInSys && signInSys.found || ssoSys && ssoSys.found)) {
        independentRemovals.push('Independent gate removed OAuth step "' + st.title + '": only sign-in or SSO evidence was found, not third-party API OAuth, so an OAuth step would send the developer down the wrong path.');
        steps.splice(i, 1); continue;
      }
    }
    for (const st of steps) {
      const mainD = String(st.detail || '').split('Evidence from docs:')[0];
      const urls = mainD.match(/https:\/\/[^\s,;]+/g) || [];
      for (const u of urls) {
        const cu = u.replace(/[.,;:!?)\]}'\"]+$/, '');
        if (cu.includes('token') && !cu.includes('oauth') && !cu.includes('authorize')) {
          st.detail = st.detail.replace(cu, '[token endpoint removed, it was not an OAuth token endpoint]');
          independentCorrections.push('Independent gate removed a non-OAuth token URL from step "' + st.title + '".');
        }
      }
      if (/^Register the app/i.test(st.title) && consolePick && /\/docs\//.test(consolePick) && !/apps|console|dashboard|settings|account/.test(consolePick)) {
        st.detail = st.detail.replace(consolePick, 'the official developer portal in sources below');
        consoleUrl = 'Unknown';
        independentCorrections.push('Independent gate removed a documentation URL presented as a registration console.');
      }
    }
    if (scopesFromMultipleProducts) {
      const scopeStep = steps.find(x => /^Choose scopes/i.test(x.title));
      if (scopeStep) {
        scopeStep.detail = 'What: do NOT request all scopes below together. Scopes found, grouped by product page, are: ' + scopeSources.map(x => x.url + ': ' + x.scopes.join(', ')).join(' ; ') + '. Where: official docs in sources below. Why: these scopes come from different product pages on the same company domain, and a scope for one product is not necessarily valid for another. Check which product your feature uses, then request only its scopes.';
        scopeStep.requirement = 'unknown';
        independentCorrections.push('Independent gate replaced a merged scope list with a per-product scope list, because scopes came from multiple product pages.');
      }
    }
  }
  if (independentCorrections.length) qualityGate.notes = [...(qualityGate.notes || []), ...independentCorrections.map(c => 'Independent gate: ' + c)];
  const validationFailures = [];
  for (const f of independentRemovals) validationFailures.push(f);
  let broadScopeWarning = false;
  if (providerIdentityAmbiguous) validationFailures.push('Provider identity ambiguous: multiple same-name providers with equal evidence, not merged, so no full guide can be trusted.');
  if (noOAuthSnippet && authType === 'oauth') validationFailures.push('Source says OAuth is not supported or API key only, but the guide classified auth as OAuth.');
  if (authType === 'oauth' && authSystems.find(x => x.system === 'third_party_oauth') && !authSystems.find(x => x.system === 'third_party_oauth').found) validationFailures.push('Auth classified as third-party OAuth, but no third-party OAuth system was found in evidence, only sign-in, SSO, or token evidence, so the guide cannot stay full.');
  if (authType === 'unknown') validationFailures.push('Auth type is unknown, so no full guide can be trusted, even if research tracks are complete.');
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
    for (const u of urlsInDetail) { const cleanU = u.replace(/[.,;:!?)\]}'\"]+$/, ''); if (cleanU.includes('{') || cleanU.includes('}')) continue; if (authType === 'oauth' && !endpoints.includes(cleanU) && !sources.includes(cleanU) && cleanU !== consolePick) validationFailures.push('Step ' + s.title + ' cites a URL not in endpoints or sources: ' + cleanU); }
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
  {
    const criticalValidation = validationFailures.some(f => /Auth classified|Provider identity|Source says OAuth|Auth type is unknown/i.test(f));
    if (researchFailed) { guideType = 'draft'; }
    else if (validationFailures.length) {
      guideType = (criticalValidation || sources.length === 0) ? 'draft' : 'partial';
      if (guideType === 'partial') verificationStatus = 'Partially verified, validation issues, see quality gate, no sign-in test';
      else verificationStatus = 'Unverified, validation failed, see quality gate';
    } else if (authType === 'unknown' || sources.length < 2 || confidence !== 'Medium' || keyDecisionsUnknown >= 2) {
      guideType = sources.length > 0 ? 'partial' : 'draft';
      if (guideType === 'partial') verificationStatus = 'Partially verified, some details confirmed, key information missing, no sign-in test';
      else verificationStatus = 'Unverified, no official source fetched, no sign-in test';
    } else { guideType = 'full'; }
    qualityGate.completeness = guideType;
  }
  const timeline = [
    { stage: 'Registration and credentials', wait: registerMeaning.status === 'not_applicable' ? 'Unknown, depends on registration method, not a published provider time' : 'Estimate: 30 minutes to 1 hour for a first app, not a published provider time', note: registerMeaning.status === 'not_applicable' ? 'No portal app registration for this path. Publish the client registration method documented in sources, and declare redirect URIs there.' : 'Create the app or credentials, record client ID or key, store secrets server side.' },
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
    implementationTime: sources.length && authType !== 'unknown' ? 'Estimate: 2 to 4 hours for a first working integration, not a published provider time, based on steps found in sources, plus review time if required' : 'Unknown, implementation steps were not fully found in fetched pages',
    startNow: guideType === 'full' ? 'Yes, with a developer account, follow the steps in order.' : guideType === 'partial' ? 'Yes, for the confirmed steps, but check the missing items and blockers first.' : 'No, not from this guide alone. Use the next research action below, then start.',

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
    nextStep: providerIdentityAmbiguous ? 'Provider identity is ambiguous: multiple providers match this name, including ' + [canonicalProviderDomain, ...discardedProviderDomains].filter(Boolean).join(', ') + '. Enter the official website URL for the provider you mean, then research again, and do not use this draft as a verified guide.' : validationFailures.length ? 'Validation failed: ' + validationFailures.join(' ') + ' Do not use this as a full guide. Check official docs manually.' + (sources.length ? ' Start here: ' + sources[0] : '') : researchFailed ? (sources.length === 0 ? 'No usable official docs were fetched in this run, after ' + tavilyCallsUsed + ' searches and ' + pages.length + ' pages fetched' + (domainGuess ? ', with search results pointing to ' + domainGuess : '') + '. This is a retrieval failure, not proof that no public docs exist. Open the provider official docs directly, search for OAuth or API authentication, paste the official docs URL into the search box to research that page, and do not use this draft as a verified guide.' : 'Research did not find usable official docs. Use the findings below, check the official portal manually, and do not use this draft as a verified guide. Start here: ' + sources[0]) : (registerMeaning.status === 'not_applicable' ? 'Open ' + (sources.length ? sources[0] : 'official docs') + ', confirm the registration-free method and how redirect URIs are declared, then follow the steps in order.' : (consolePick ? 'Open the developer portal at ' + consolePick + ', confirm the authentication model, then follow the steps in order.' : (sources.length ? 'Open ' + sources[0] + ', confirm the authentication model and registration portal, then follow the steps in order.' : 'Open the first source below, confirm the authentication model and registration portal, then follow the steps in order.'))),
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
module.exports = async (req, res) => {
  try {
    await researchHandler(req, res);
  } catch (e) {
    try {
      if (res.headersSent) return;
      const appName = String((req.query && req.query.app) || '').trim() || 'Unknown provider';
      const errMsg = String(e && e.message ? e.message : e).slice(0, 200);
      res.status(200).json({ guide: { id: 'generated-' + appName.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name: appName, category: 'Generated, from live research', difficulty: 'Unknown', difficultyWhy: 'Research failed, so difficulty cannot be set.', setupTime: 'Unknown', approvalWait: 'Unknown', accountNeeded: 'Unknown', cost: 'Unknown', consoleName: 'Unknown', consoleUrl: 'Unknown', guideType: 'draft', verificationStatus: 'Unverified, research failed, see quality gate', confidence: 'Low', authType: 'unknown', decisions: [], claims: [], evidenceSummary: {}, requirements: [], qualityGate: { completeness: 'draft', factualVerification: 'unverified', validationFailures: ['Research handler failed: ' + errMsg] }, nextStep: 'Research failed for this provider. Do not use this draft as a verified guide. Check official docs manually, then research again.', steps: [{ title: 'Find the official developer portal', detail: 'What: find the official developer console and registration docs, then list scopes and review triggers before building. Where: official docs, not a tutorial site. Why: research failed, so no flow can be recommended yet.', who: 'human', time: 'Unknown', blockerTip: 'Do not build on an unverified portal.', requirement: 'unknown', condition: '', destinationUrl: '', evidence: '', evidenceUrl: '' }], timeline: [], checklist: [], blockers: [{ blocker: 'Research failed', fix: 'See quality gate. Check official docs manually.' }], agentCan: [], humanMust: ['Confirm the official portal', 'Sign in to the provider console'], sources: [], tested: 'Live research failed with an uncaught error: ' + errMsg + '. No account sign-in, app creation, or provider approval was completed.', notVerified: ['All provider-specific details', 'Research handler failed, see quality gate'], executionLog: [] }, log: [], timings: { cached: false }, cached: false });
    } catch (e2) {
      try { res.status(200).json({ error: 'Research failed, draft guide could not be built.' }); } catch (e3) {}
    }
  }
};

module.exports.classifyPassage = classifyPassage;
module.exports.consoleScore = consoleScore;
module.exports.validateScope = validateScope;
module.exports.extractEndpoints = extractEndpoints;
module.exports.extractScopes = extractScopes;
module.exports.productPath = productPath;
module.exports.extractScopesFromPages = extractScopesFromPages;
