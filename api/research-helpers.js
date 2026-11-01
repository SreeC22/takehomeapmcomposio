// Shared helpers for api/research.js, exported so the fixed-document
// regression test can call the actual production logic.
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
  // UPPER_SNAKE scopes, for example EVENT_TYPE_READ, are real OAuth
  // scopes on some providers. They are only accepted from a scope
  // section or a scope page, never from arbitrary page text, because
  // extractScopesFromPages gates the caller. Credential and metadata
  // tokens are never scopes, in any case.
  if (/^[A-Z][A-Z0-9]+(?:_[A-Z0-9]+)+$/.test(s)) {
    const upParts = s.split('_');
    if (upParts.some(p => /^(CLIENT|ACCESS|REFRESH|API|SECRET|TOKEN|KEY|ID|OG|TWITTER|FB)$/.test(p))) return false;
    if (/(ID|SECRET|TOKEN|KEY)$/.test(s)) return false;
    return true;
  }
  // Metadata and social tokens are never OAuth scopes, even when they
  // look like colon tokens, for example og:title or twitter:card.
  const firstPart = s.toLowerCase().split(/[:.]/)[0];
  if (['og', 'twitter', 'fb', 'article', 'meta', 'schema', 'ld', 'jsonld'].includes(firstPart)) return false;
  if (!/^[a-z][a-z0-9_-]+([:.][a-z][a-z0-9_-]+)+$/.test(s)) return false;
  if (s.includes('..') || s.includes('::') || s.includes('._') || s.includes('_.')) return false;
  const parts = s.split(/[:.]/);
  if (parts.some(x => x.length < 3)) return false;
  if (parts.some(x => /^(api|www|http|https|oauth|auth|login|signup|v1|v2|v3|js|ts|tsx|jsx|mjs|cjs|css|png|jpg|svg|json|html|md|com|net|org|token|secret|client|id|code|pem|key|crt|cert|xml|yaml|yml|txt|pdf)$/.test(x))) return false;
  if (parts.some(x => /^\d+$/.test(x))) return false;
  return true;
}

function metadataTokenCount(s) {
  return (String(s || '').toLowerCase().match(/\b(cookie|copyright|all rights reserved|newsletter|subscribe|follow us|sitemap|back to top|terms of use)\b/g) || []).length;
}

function extractScopes(text) {
  const blocked = new Set(['client', 'client_id', 'client_secret', 'access_token', 'refresh_token', 'token', 'secret', 'id', 'code', 'authorization', 'grant', 'redirect_uri', 'urn', 'params', 'type', 'response', 'grant_type', 'device_code', 'display', 'src', 'style', 'width', 'transition', 'button', 'root', 'items', 'decoration', 'font', 'background', 'color', 'margin', 'padding', 'border', 'position', 'overflow', 'flex', 'grid', 'text', 'line', 'content', 'cursor', 'opacity', 'visibility', 'height', 'max', 'min']);
  const blockedSecond = new Set(['hover', 'not', 'last', 'first', 'focus', 'active', 'visited', 'checked', 'disabled', 'enabled', 'before', 'after', 'nth', 'only', 'empty']);
  const blockedFirst = new Set(['www', 'api', 'oauth', 'auth', 'login', 'signup', 'http', 'https', 'og', 'twitter', 'fb', 'article', 'meta', 'schema', 'ld', 'jsonld']);
  const dotAllowedLast = new Set(['read', 'write', 'info', 'metadata', 'content', 'member', 'delete', 'create', 'update']);
  function collect(onlyNearScope) {
    const found = new Set();
    const patterns = [/\b[a-z][a-z0-9_]*:[a-z][a-z0-9_]*\b/g, /\b[a-z][a-z0-9_]*\.[a-z][a-z0-9_]+(?:\.[a-z][a-z0-9_]+)?\b/g];
    for (const re of patterns) {
      let m;
      while ((m = re.exec(text)) !== null) {
        const s = m[0].toLowerCase();
        if (onlyNearScope) { const ctx = text.slice(Math.max(0, m.index - 200), Math.min(text.length, m.index + 200)).toLowerCase(); if (!ctx.includes('scope')) continue; }
        const after = text.slice(m.index + m[0].length, m.index + m[0].length + 10);
        if (after.trimStart().startsWith('{')) continue;
        if (text.slice(Math.max(0, m.index - 100), m.index).includes('!important')) continue;
        if (s.includes('http') || s.length > 60) continue;
        if (s.endsWith('.com') || s.endsWith('.json') || s.endsWith('.md') || s.endsWith('.html') || s.endsWith('.txt') || s.endsWith('.pdf') || s.endsWith('.tsx') || s.endsWith('.jsx') || s.endsWith('.ts') || s.endsWith('.js')) continue;
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
    // Split Markdown links and reject encoded template fragments, rather
    // than allowing broken docs markup to become a credential endpoint.
    let u = m[0].split(/\]\(|[<>{}`\s]/)[0];
    while (/[\\.,):;`]$/.test(u)) u = u.slice(0, -1);
    if (/%(?:60|7b|7d|5b|5d)|\]\(|\bfunction\b/i.test(u)) continue;
    if (u.includes('&#')) u = u.split('&#')[0];
    u = u.replace(/\):$/, '');
    if (u.length >= 100) continue;
    try {
      const pp = new URL(u); const path = pp.pathname.toLowerCase(); const host = pp.hostname.toLowerCase();
      if (/yourdomain|your-domain|yourcompany|localhost|127\.0\.0\.1|\{/.test(u)) continue;
      if (domainGuess && baseDomain(host) !== baseDomain(String(domainGuess))) continue;
      if (path.includes('/docs/') || path.includes('/reference/') || path.endsWith('.md') || path.endsWith('.png') || path.endsWith('.jpg') || path.endsWith('.jpeg') || path.endsWith('.svg') || path.endsWith('.gif') || path.includes('/attachments') || host.includes('attachments')) continue;
      if (path.includes('token') && !path.includes('oauth') && !path.includes('authorize')) continue;
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
      // Negated "need to start/begin/use/install/download" is about a
      // different action than the requirement. It must not mark the
      // requirement not_applicable, and its negated "need" must not
      // count as a modal requirement either, so the outcome is unknown.
      const diffVerb = between.find(w => ['start', 'begin', 'use', 'install', 'download'].includes(w));
      if (diffVerb && !between.includes('register') && !between.includes('submit')) {
        return { status: 'unknown', condition: '' };
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
    const modalLinked = (() => { for (let i = Math.max(0, actionIdx - 6); i < Math.min(words.length, actionIdx + 6); i++) { if (modalWords.includes(words[i]) && !['not', 'no', 'never'].includes(words[i - 1] || '') && !['not', 'no'].includes(words[i - 2] || '')) return true; } return false; })();
    if (modalLinked || /^\s*(create|register|add|set|configure|provide|enter|submit|request|generate|include|list)\b/.test(hit.trim().toLowerCase())) return { status: 'required', condition: '' };
    return { status: 'unknown', condition: '' };
  }

  function consoleScore(u) {
    try {
      const uu = new URL(u); const host = uu.hostname.toLowerCase(); const path = uu.pathname.toLowerCase();
      if (path.includes('/api-reference/') || path.includes('/api/')) return -10;
      const segments = path.split('/').filter(Boolean);
      if (segments.some(s => /events|pricing|blog|community|support|changelog|status/.test(s))) return -10;
      // A documentation article is not an account-management console, even
      // when it describes registration. Only a page whose path or host is
      // apps, console, dashboard, settings, or account can score as a portal.
      const hasPortalSegment = segments.some(s => ['apps', 'console', 'dashboard', 'settings', 'account'].includes(s));
      const hasPortalHost = host.startsWith('console.') || host.startsWith('app.') || host.startsWith('dashboard.') || host.startsWith('portal.') || host.startsWith('build.');
      // An app homepage is not evidence of developer app registration.
      if (host.startsWith('app.') && (path === '/' || path === '')) return -10;
      if (path.includes('/docs/') && !hasPortalSegment && !hasPortalHost) return -10;
      if (path.includes('/reference/') && !hasPortalSegment) return -10;
      let s = 0;
      if (host.startsWith('developers.') || host.startsWith('developer.')) s += 1;
      if (hasPortalHost) s += 2;
      if (path === '/' || path === '') s += 3;
      if (hasPortalSegment) s += 3;
      if (segments.length && ['developers', 'developer'].includes(segments[0])) s += 1;
      return s;
    } catch (e) { return -10; }
  }
  function productPath(u) {
    try {
      const segs = new URL(u).pathname.toLowerCase().split('/').filter(Boolean);
      const generic = new Set(['docs','doc','developer','developers','api','apis','oauth','auth','authentication','authorization','developer-tools','partner','partner-api','partners','integration','integrations','getting-started','reference','guides','guide','cloud','platform','scopes','scope','permissions','permission','v1','v2','v3','latest','en','us']);
      for (const seg of segs) { if (!generic.has(seg) && !/^v\d+$/.test(seg) && !/(oauth|partner|developer|auth|api|scope|permission)/.test(seg)) return seg; }
      return 'main';
    } catch (e) { return ''; }
  }
  function extractUpperSnakeScopes(sectionText) {
    const out = [];
    const re = /\b[A-Z][A-Z0-9]+(?:_[A-Z0-9]+)+\b/g;
    let m;
    while ((m = re.exec(sectionText)) !== null) {
      const s = m[0];
      if (validateScope(s) && !out.includes(s)) out.push(s);
      if (out.length >= 100) break;
    }
    return out;
  }
  function extractScopesFromScopeText(sectionText) {
    const out = [];
    for (const sc of extractScopes(sectionText)) if (!out.includes(sc)) out.push(sc);
    for (const sc of extractUpperSnakeScopes(sectionText)) if (!out.includes(sc)) out.push(sc);
    return out.filter(validateScope);
  }
  // Only API permission names with explicit permission-like syntax are safe
  // to show. A token found in a docs theme is NOT an OAuth scope.
  function isPermissionToken(value) {
    if (!validateScope(value)) return false;
    if (/^[A-Z][A-Z0-9]+(?:_[A-Z0-9]+)+$/.test(value))
      return /_(?:READ|WRITE|CREATE|DELETE|UPDATE|LIST|VIEW|MANAGE|ADMIN)$/.test(value);
    return /(?:[:.](?:read|write|create|delete|update|list|view|manage|admin|readonly|read_only)|^(?:read|write|delete|manage):[a-z0-9_-]+)$/.test(value);
  }
  function extractScopesFromPages(pages) {
    const out = [];
    const unrelatedAuthPaths = /\/(?:admin|workers|mcp|sdk|sso|single-sign-on)(?:\/|$)/i;
    for (const pg of pages) {
      const path = (() => { try { return new URL(pg.url).pathname.toLowerCase(); } catch (e) { return ''; } })();
      // Separate administrative, MCP, SDK and sign-in permission systems
      // cannot supply scopes for a customer-facing third-party OAuth app.
      if (unrelatedAuthPaths.test(path)) continue;
      const sections = String(pg.text || '').split(/(?=SECTION: )/);
      for (const sec of sections) {
        const heading = (sec.match(/^SECTION: ([^\n]*)/) || [,''])[1];
        if (!/\b(?:scopes?|permissions?)\b/i.test(heading) &&
            !/\/(?:scopes|permissions)(?:[./]|$)/i.test(path)) continue;
        const lines = sec.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line || /^SECTION:/.test(line)) continue;
          // Embedded navigation, theme configuration and asset names
          // are never machine-readable API permissions.
          if (/[{}]/.test(line) || /(?:\.mdx?|\.tsx?|\.ico|\.css|\.js|\.com\b|\.mintlify\.)/i.test(line)) continue;
          const candidates = extractScopesFromScopeText(line).filter(isPermissionToken);
          if (!candidates.length) continue;
          const near = [lines[i-1] || '', line, lines[i+1] || ''].join(' ');
          if (!/\b(?:scope|permission|access|authorize|allow|read|write|create|update|delete|manage|list|view|grant)\b|(?:_READ|_WRITE|_CREATE|_DELETE|_UPDATE|_MANAGE)\b/i.test(near)) continue;
          for (const candidate of candidates) if (!out.includes(candidate)) out.push(candidate);
        }
      }
    }
    return out.slice(0, 60);
  }

function extractNextDataText(body) {
  try {
    const m = String(body || '').match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!m) return '';
    const data = JSON.parse(m[1]);
    const out = [];
    const walk = (x) => {
      if (typeof x === 'string') { if (x.length > 80 && /oauth|scope|client|api|token/i.test(x)) out.push(x); }
      else if (Array.isArray(x)) x.forEach(walk);
      else if (x && typeof x === 'object') Object.values(x).forEach(walk);
    };
    walk(data);
    const txt = out.join('\n');
    return /oauth|scope|client/i.test(txt) ? txt : '';
  } catch (e) { return ''; }
}
module.exports = { stripHtml, sectionFor, isProviderHost, parseInput, canonicalUrl, baseDomain, validateScope, metadataTokenCount, extractScopes, extractEndpoints, extractRelativeEndpoints, findSnippet, cleanSnippet, timePhrase, classifyPassage, consoleScore, productPath, extractScopesFromPages, extractScopesFromScopeText, extractUpperSnakeScopes, extractNextDataText, fetchText, fetchOnce };
