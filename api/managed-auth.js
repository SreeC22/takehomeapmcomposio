const { stripHtml, parseInput } = require('./research-helpers');

// Public Composio toolkit documentation is the authority for managed OAuth.
// No API key is needed for these public docs; never infer availability from
// "most toolkits have managed auth".
const cache = globalThis.__managedAuthCache || (globalThis.__managedAuthCache = new Map());
const TTL = 6 * 60 * 60 * 1000;

module.exports = async (req, res) => {
  const raw = String((req.query && req.query.app) || '').trim().slice(0, 150);
  if (!raw) return res.status(400).json({ error: 'App name required' });
  const parsed = parseInput(raw);
  const slug = String(parsed.slug || '').replace(/[^a-z0-9_-]/g, '').slice(0, 65);
  const catalog = 'https://docs.composio.dev/toolkits/managed-auth';
  if (!slug) return res.status(200).json({ status:'unknown', source:catalog, reason:'Provider identity is unclear.' });
  const url = 'https://docs.composio.dev/toolkits/' + encodeURIComponent(slug);
  const old = cache.get(slug);
  if (old && Date.now() - old.at < TTL) return res.status(200).json({ ...old.result, cached:true });
  let result = { status:'unknown', source:url, catalog, verified:false,
    reason:'Managed OAuth could not be established from a public Composio toolkit page. Check the official directory or authenticated toolkit API.' };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    let response;
    try { response = await fetch(url, { signal:controller.signal, headers:{Accept:'text/html'} }); }
    finally { clearTimeout(timer); }
    if (response.ok) {
      const html = await response.text();
      const clean = stripHtml(html).slice(0, 100000);
      const anchor = clean.search(/\bAuthentication Details\b/i);
      const authBlock = anchor >= 0 ? clean.slice(anchor, anchor + 1600) : '';
      const negative = /\bComposio.managed OAuth (?:is )?not available\b/i.test(authBlock);
      const positive = /\bComposio.managed OAuth (?:is )?available\b/i.test(authBlock);
      if (negative !== positive) {
        result = { status:negative?'bring_your_own':'managed_available', source:url, catalog,
          verified:true, reason:negative
            ? 'Composio toolkit documentation explicitly says managed OAuth is not available.'
            : 'Composio toolkit documentation explicitly identifies managed OAuth as available.',
          checkedAt:new Date().toISOString() };
      }
    } else {
      result.reason = 'The public toolkit page did not return a usable response (' + response.status + '). Do not infer managed availability.';
    }
  } catch (e) {
    result.reason = 'Unable to verify managed OAuth from Composio documentation. Availability remains unknown.';
  }
  cache.set(slug, { at:Date.now(), result });
  return res.status(200).json(result);
};
