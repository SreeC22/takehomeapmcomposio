let guides = [];
let allGuides = [];
function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function safeUrl(u) {
  const s = String(u || '');
  return s.startsWith('https://') ? s : '#';
}
function encodeGuide(g) {
  try {
    const json = JSON.stringify(g);
    const b64 = btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return b64;
  } catch (e) { return ''; }
}
function decodeGuide(b64) {
  try {
    const norm = b64.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(escape(atob(norm)));
    return JSON.parse(json);
  } catch (e) { return null; }
}
function loadStoredGuides() {
  try {
    const raw = localStorage.getItem('generatedGuides');
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}
function findGuideForInput(raw) {
  const input = String(raw || '').trim().toLowerCase();
  if (!input) return null;
  let host = input.replace(/^https?:\/\//, '').split('/')[0].split('?')[0].replace(/^www\./, '');
  const parts = host.split('.');
  const main = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
  const slug = main.replace(/[^a-z0-9]+/g, '-');
  const nameSlug = input.replace(/[^a-z0-9]+/g, '-');
  return guides.find(g => {
    const gn = String(g.name || '').toLowerCase();
    const gid = String(g.id || '').toLowerCase();
    return gn === input || gn === main || gid === slug || gid === nameSlug || gid === 'generated-' + slug || gid === 'generated-' + nameSlug;
  }) || null;
}
function saveStoredGuide(g) {
  try {
    const arr = loadStoredGuides().filter(x => x.id !== g.id);
    arr.push(g);
    localStorage.setItem('generatedGuides', JSON.stringify(arr.slice(-20)));
  } catch (e) {}
}
async function load() {
  const res = await fetch('guides.json');
  const data = await res.json();
  guides = data.guides.slice();
  allGuides = guides;
  const stored = loadStoredGuides();
  stored.forEach(g => { if (!guides.find(x => x.id === g.id)) guides.push(g); });
  render();
  const hash = location.hash || '';
  if (hash.startsWith('#generated=')) {
    const g = decodeGuide(hash.replace('#generated=', ''));
    if (g) {
      if (!guides.find(x => x.id === g.id)) guides.push(g);
      render();
      showDetail(g, true);
      return;
    }
  }
  const gid = hash.replace('#guide=', '');
  if (gid && hash.startsWith('#guide=')) {
    const g = guides.find(x => x.id === gid);
    if (g) showDetail(g);
  }
}
function card(g) {
  return `<article class="card" tabindex="0" data-id="${esc(g.id)}">
    <h3>${esc(g.name)}</h3>
    <p><span class="badge">${esc(g.difficulty)}</span><span class="badge ${esc(g.guideType)}">${esc(g.guideType)}</span></p>
    <p class="meta"><strong>Setup:</strong> ${esc(g.setupTime)}</p>
    <p class="meta"><strong>Approval wait:</strong> ${esc(g.approvalWait)}</p>
    <p><span class="badge category">${esc(g.category)}</span></p>
    <p class="small">Verification: ${esc(g.verificationStatus || ('Confidence ' + g.confidence + ', verification status not set'))}</p>
    <p class="card-cta">View guide</p>
  </article>`;
}
function render() {
  const q = (document.getElementById('search').value || '').toLowerCase();
  const list = guides.filter(g => !q || (g.name + ' ' + g.category).toLowerCase().includes(q));
  document.getElementById('grid').innerHTML = list.map(card).join('');
  document.getElementById('empty').classList.toggle('hidden', list.length > 0);
  updateSearchStatus();
  document.querySelectorAll('.card').forEach(el => {
    const open = () => {
      const g = guides.find(x => x.id === el.dataset.id);
      if (g) showDetail(g);
    };
    el.addEventListener('click', open);
    el.addEventListener('keydown', e => { if (e.key === 'Enter') open(); });
  });
}
function linkify(text) {
  const parts = String(text || '').split(/(https?:\/\/[^\s)]+)/g);
  return parts.map(p => {
    if (!/^https?:\/\//.test(p)) return esc(p);
    let url = p;
    let trail = '';
    while (url && /[.,;:!?)\]}'"]$/.test(url)) { trail = url.slice(-1) + trail; url = url.slice(0, -1); }
    const label = /token_info|\/oauth_token|\/token(\/|$|\?)/.test(url) ? 'token endpoint' : /authorize/.test(url) ? 'authorize endpoint' : 'official docs';
    return `<a href="${esc(safeUrl(url))}">${label}</a>${esc(trail)}`;
  }).join('');
}
function evidenceHtml(g) {
  if (!g.evidenceSummary && !g.requirements && !g.qualityGate) return '';
  const tracks = g.evidenceSummary && g.evidenceSummary.tracks ? Object.values(g.evidenceSummary.tracks).map(t => `<li><strong>${esc(t.name)}:</strong> ${esc(t.status)}, confidence ${esc(t.confidence)}${t.evidence ? ` - ${esc(t.evidence)}` : ''}${t.missing && t.missing.length ? ` Missing: ${esc(t.missing.join('; '))}` : ''}</li>`).join('') : '';
  const reqs = (g.requirements || []).map(r => `<li><strong>${esc(r.name)}:</strong> ${esc(r.status)}${r.condition ? ` - ${esc(r.condition)}` : ''}${r.evidence ? ` Evidence: ${esc(r.evidence)}` : ''}</li>`).join('');
  const gate = g.qualityGate ? `<p><strong>Quality gate:</strong> completeness ${esc(g.qualityGate.completeness)}, evidence ${esc(g.qualityGate.evidenceCoverage)}, source authority ${esc(g.qualityGate.sourceAuthority)}, factual confidence ${esc(g.qualityGate.factualConfidence)}</p>${g.qualityGate.checksPassed && g.qualityGate.checksPassed.length ? `<p>Checks passed: ${esc(g.qualityGate.checksPassed.join('; '))}</p>` : ''}${g.qualityGate.checksFailed && g.qualityGate.checksFailed.length ? `<p>Checks failed: ${esc(g.qualityGate.checksFailed.join('; '))}</p>` : ''}${g.qualityGate.notes && g.qualityGate.notes.length ? `<p>Notes, not failures: ${esc(g.qualityGate.notes.join('; '))}</p>` : ''}` : '';
  const decisions = (g.decisions || []).map(d => `<li><strong>${esc(d.claim)}:</strong> ${esc(d.status)}${d.condition ? ` - ${esc(d.condition)}` : ''}${d.evidence ? ` Evidence: ${esc(d.evidence)}` : ''}${d.justification ? ` Why: ${esc(d.justification)}` : ''}</li>`).join('');
  const rels = (g.evidenceSummary && g.evidenceSummary.authRelationships ? g.evidenceSummary.authRelationships.filter(r => r.evidence || r.method === 'external_idp_for_signin') : []).map(r => `<li><strong>${esc(r.method)}:</strong> ${esc(r.direction)} - client: ${esc(r.client)}, resource owner: ${esc(r.resourceOwner)}, identity provider: ${esc(r.identityProvider)}, authorized: ${esc(r.authorizationTarget)}${r.evidence ? ` Evidence: ${esc(r.evidence)}` : ''}</li>`).join('');
  const scopeSrc = (g.evidenceSummary && g.evidenceSummary.scopeSources ? g.evidenceSummary.scopeSources : []).map(x => `<li>${esc(x.url)} (${esc(x.product)}): ${esc(x.scopes.join(', '))}</li>`).join('');
  return `<h3>Evidence by track, and requirements</h3><p class="small">Each track is reported separately. A missing track is a real gap, not a guessed step.</p>${tracks ? `<ul>${tracks}</ul>` : ''}${reqs ? `<p><strong>Requirements:</strong></p><ul>${reqs}</ul>` : ''}${rels ? `<p><strong>Authentication relationships, not interchangeable:</strong></p><ul>${rels}</ul>` : ''}${scopeSrc ? `<p><strong>Scopes by product page, not merged:</strong></p><ul>${scopeSrc}</ul>` : ''}${decisions ? `<p><strong>Approval and path decisions, each with its passage:</strong></p><ul>${decisions}</ul>` : ''}${gate}`;
}
function stepsHtml(g) {
  return '<ol class="steps">' + g.steps.map((s, i) => {
    const split = String(s.detail || '').split(/Evidence from docs:/i);
    const action = split[0].replace(/^Action:\s*/i, '').trim();
    const evidence = split.slice(1).join('Evidence from docs:').trim() || (s.evidence || '');
    const chips = [s.who ? `Who: ${s.who}` : '', s.time ? `Time: ${s.time}` : '', s.requirement ? `Requirement: ${s.requirement}` : ''].filter(Boolean).map(c => `<span class="badge">${esc(c)}</span>`).join(' ');
    return `<li class="step-card"><span class="step-num">${i + 1}</span><div class="step-body"><strong>${esc(s.title)}</strong><p>${linkify(action)}</p>${chips ? `<p>${chips}</p>` : ''}${s.blockerTip ? `<p class="small">Watch out: ${esc(s.blockerTip)}</p>` : ''}${evidence ? `<details><summary>Evidence from docs</summary><p class="small">${esc(evidence)}</p></details>` : ''}</div></li>`;
  }).join('') + '</ol>';
}
function executionHtml(g) {
  const sources = (g.sources || []).map(s => `<li><a href="${esc(safeUrl(s))}">${esc(s)}</a></li>`).join('');
  const log = (g.executionLog || []).map(l => `<li>${esc(l.time || '')} - ${esc(l.action || '')} - ${esc(l.url || '')} - ${esc(l.status || '')} - ${esc(l.detail || '')}</li>`).join('');
  return `<h3>Execution record</h3>
    <p><strong>Confidence:</strong> ${esc(g.confidence)}</p>
    <p><strong>Tested:</strong> ${esc(g.tested)}</p>
    <p><strong>Not verified:</strong> ${esc((g.notVerified || []).join('; '))}</p>
    <p><strong>Sources checked:</strong></p>
    <ul>${sources || '<li>None listed. Use live research and official docs before use.</li>'}</ul>
    ${log ? `<p><strong>Research log:</strong></p><ul>${log}</ul>` : '<p>No step-by-step research log was recorded for this guide. See the verification report on the home page for the sampled checks.</p>'}`;
}
function showDetail(g, isGenerated) {
  try { document.getElementById('empty').classList.add('hidden'); } catch (e) {}
  if (isGenerated || String(g.id || '').startsWith('generated-') || String(g.id || '').startsWith('draft-')) {
    const enc = encodeGuide(g);
    if (enc) location.hash = 'generated=' + enc;
  } else {
    location.hash = 'guide=' + g.id;
  }
  const el = document.getElementById('detail');
  el.classList.remove('hidden');
  el.innerHTML = `
    <p><a href="#grid">Back to all platforms</a> | <button id="shareBtn" type="button">Copy share link</button> | <button id="jsonBtn" type="button">Copy guide JSON</button>${(isGenerated || String(g.id || '').startsWith('generated-') || String(g.id || '').startsWith('draft-')) ? ' | <button id="refreshBtn" type="button">Refresh live research</button>' : ''}</p>
    <h2>${esc(g.name)} <span class="badge">${esc(g.difficulty)}</span> <span class="badge ${esc(g.guideType)}">${esc(g.guideType)}</span>${g.category ? ` <span class="badge category">${esc(g.category)}</span>` : ''}</h2>
    <p class="small">${esc(g.difficultyWhy)}</p>
    <p class="small"><strong>Verification, separate from completeness:</strong> ${esc(g.verificationStatus || ('Confidence ' + g.confidence + ', verification status not set'))}. Full means a verified path, partial means partially verified, draft means unsupported or ambiguous. None means it was tested with a sign-in.</p>
    <div class="step"><h3>At a glance</h3>
      <ul>
        <li><strong>Verification:</strong> ${esc(g.verificationStatus || 'Not set')}</li>
        <li><strong>Confidence:</strong> ${esc(g.confidence)}</li>
        <li><strong>Setup time:</strong> ${esc(g.setupTime)}</li>
        ${g.implementationTime ? `<li><strong>Engineering implementation time:</strong> ${esc(g.implementationTime)}</li>` : ''}
        ${g.startNow ? `<li><strong>Can I start building now?</strong> ${esc(g.startNow)}</li>` : ''}
        <li><strong>Approval wait:</strong> ${esc(g.approvalWait)}</li>
        <li><strong>Account needed:</strong> ${esc(g.accountNeeded)}</li>
        <li><strong>Cost to register:</strong> ${esc(g.cost)}</li>
        <li><strong>Console:</strong> ${esc(g.consoleName)} - ${esc(g.consoleUrl)}</li>
        ${g.authType ? `<li><strong>Authentication type:</strong> ${esc(g.authType)}</li>` : ''}
        <li><strong>Managed app note:</strong> ${esc(g.managedAppNote)}</li>
      </ul>
    </div>
    <p class="small">Managed or custom? Check managed first. Go custom only for own branding, custom scopes, dedicated quota, or a custom instance.</p>
    ${evidenceHtml(g)}
    <h3>Step by step guide</h3>
    ${g.steps && g.steps.some(s => s.evidence || String(s.detail || '').toLowerCase().includes('evidence from docs:')) ? '<p class="small">Quick view. Tap Evidence from docs on a step to see the docs quote behind it.</p>' : '<p class="small">Quick view. Library steps have no per-step docs quote in this view, see sources below.</p>'}
    ${stepsHtml(g)}
    <h3>Review timeline card</h3>
    <ul>${g.timeline.map(t => `<li><strong>${esc(t.stage)}:</strong> ${esc(t.wait)} - ${esc(t.note)}</li>`).join('')}</ul>
    <h3>Approval checklist card</h3>
    <div class="checklist">
      ${g.checklist.map((c, i) => `<label><input type="checkbox" data-check-idx="${i}"> <span><strong>${esc(c.item)}</strong> - ${esc(c.status)} - ${esc(c.who)}</span></label>`).join('')}
    </div>
    <p class="small">Check items as you complete them. This checklist is saved in this browser only, it does not submit anything to the provider.</p>
    <h3>Blockers and fixes</h3>
    <ul>${g.blockers.map(b => `<li><strong>${esc(b.blocker)}:</strong> ${esc(b.fix)}</li>`).join('')}</ul>
    <h3>What an agent can do, and where you take over</h3>
    <p><strong>Agent can:</strong></p><ul>${g.agentCan.map(a => `<li>${esc(a)}</li>`).join('')}</ul>
    <p><strong>You must:</strong></p><ul>${g.humanMust.map(a => `<li>${esc(a)}</li>`).join('')}</ul>
    ${executionHtml(g)}
    <h3>Next step</h3>
    <ul><li><strong>${esc(g.nextStep)}</strong></li></ul>
  `;
  try {
    const key = 'checklist-' + String(g.id || 'guide');
    const saved = JSON.parse(localStorage.getItem(key) || '[]');
    el.querySelectorAll('input[data-check-idx]').forEach(cb => {
      const idx = Number(cb.getAttribute('data-check-idx'));
      if (saved.includes(idx)) cb.checked = true;
      cb.addEventListener('change', () => {
        try {
          const cur = JSON.parse(localStorage.getItem(key) || '[]');
          const next = cb.checked ? Array.from(new Set([...cur, idx])) : cur.filter(x => x !== idx);
          localStorage.setItem(key, JSON.stringify(next));
        } catch (e) {}
      });
    });
  } catch (e) {}
  document.getElementById('shareBtn').addEventListener('click', async () => {
    const btn = document.getElementById('shareBtn');
    try { await navigator.clipboard.writeText(location.href); if (btn) { btn.textContent = 'Link copied'; setTimeout(() => { btn.textContent = 'Copy share link'; }, 2000); } } catch (e) { alert(location.href); }
  });
  document.getElementById('jsonBtn').addEventListener('click', async () => {
    const json = JSON.stringify(g, null, 2);
    try { await navigator.clipboard.writeText(json); alert('Guide JSON copied.'); } catch (e) { alert('Copy failed, use guides.json instead.'); }
  });
  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) refreshBtn.addEventListener('click', async () => { await runResearch(g.name, true); });
  el.scrollIntoView({behavior: 'smooth'});
}
document.getElementById('search').addEventListener('input', render);
function updateSearchStatus() {
  const el = document.getElementById('searchStatus');
  if (!el) return;
  const name = document.getElementById('search').value.trim();
  if (!name) { el.textContent = ''; return; }
  const match = findGuideForInput(name);
  if (match) {
    const kind = String(match.id || '').startsWith('generated-') ? 'saved generated guide' : 'library guide';
    el.textContent = 'Found: ' + match.name + ' (' + kind + '). Press Get guide to open it.';
  } else {
    el.textContent = 'Not in the library yet. Get guide will research it live, once.';
  }
}
async function runResearch(name, forceRefresh) {
  const statusEl = document.getElementById('searchStatus');
  const timers = [];
  if (statusEl) statusEl.textContent = 'Searching for official docs for ' + name + '...';
  timers.push(setTimeout(() => { if (statusEl) statusEl.textContent = 'Reading documentation for ' + name + '...'; }, 2000));
  timers.push(setTimeout(() => { if (statusEl) statusEl.textContent = 'Generating guide for ' + name + '...'; }, 6000));
  try {
    const url = '/api/research?app=' + encodeURIComponent(name) + (forceRefresh ? '&refresh=1' : '');
    const res = await fetch(url);
    if (!res.ok) throw new Error('Research endpoint returned ' + res.status);
    const data = await res.json();
    const g = data.guide;
    g.executionLog = data.log || [];
    if (data.timings) g.timings = data.timings;
    const existing = guides.findIndex(x => x.id === g.id);
    if (existing >= 0) guides[existing] = g; else guides.push(g);
    saveStoredGuide(g);
    render();
    timers.forEach(t => clearTimeout(t));
    if (statusEl) {
      const t = data.timings;
      const timeText = t ? ' in ' + (t.totalMs / 1000).toFixed(1) + 's (search ' + (t.searchMs / 1000).toFixed(1) + 's, docs ' + (t.retrievalMs / 1000).toFixed(1) + 's)' + (data.cached ? ', cached guide, returned instantly' : '') + '.' : '.';
      statusEl.textContent = 'Live research complete for ' + name + timeText + ' Confidence: ' + g.confidence + '. Check it against official docs before use.';
    }
    showDetail(g, true);
  } catch (err) {
    timers.forEach(t => clearTimeout(t));
    if (statusEl) statusEl.textContent = 'Live research could not run for ' + name + '. The guide below is Low confidence and Unknown, with no provider-specific claims.';
    const id = 'generated-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'generated-app';
    const g = { id: id, name: name, category: 'Generated, research endpoint unavailable', difficulty: 'Unknown', difficultyWhy: 'Live research endpoint was unavailable, so no provider-specific claims could be verified.', setupTime: 'Unknown', approvalWait: 'Unknown, do not promise a date until review docs are checked', accountNeeded: 'Unknown, check the provider developer docs', cost: 'Unknown', consoleName: 'Unknown, find the official developer console first', consoleUrl: 'Unknown', guideType: 'draft', verificationStatus: 'Unverified, research failed, no official source fetched', confidence: 'Low', managedAppNote: 'Check first whether a managed app already covers this platform.', nextStep: 'This is a draft, not a full guide. Find the official developer console and registration docs for ' + name + ', then list scopes and review triggers before building.', steps: [{title: 'Research failed, retry live research', detail: 'The live research endpoint could not be reached. No official docs were fetched in this attempt. Retry, or research the official docs manually before building.', who: 'human', time: 'Unknown', blockerTip: 'Do not use this guide as verified. No provider claims were fetched.'}, {title: 'Register the app', detail: 'Unknown. Find the official developer console first, then confirm registration fields.', who: 'human', time: 'Unknown', blockerTip: 'Do not guess registration fields.'}, {title: 'Set the redirect URI', detail: 'Unknown. Use the exact redirect URI from your code, and check it against official docs.', who: 'human', time: 'Unknown', blockerTip: 'A redirect mismatch is the most common first failure.'}, {title: 'Choose scopes', detail: 'Unknown. List scopes from official docs only, minimum only, do not guess a scope list.', who: 'agent', time: 'Unknown', blockerTip: 'A single sensitive scope can change the timeline.'}, {title: 'Test and submit for review', detail: 'Unknown. Test one real consent flow, then prepare a review submission with a privacy policy URL and scope justifications.', who: 'human', time: 'Unknown', blockerTip: 'Do not promise a review date until review docs are checked.'}], timeline: [{stage: 'Registration', wait: 'Unknown', note: 'Research endpoint unavailable.'}, {stage: 'Redirect and scopes', wait: 'Unknown', note: 'No official docs fetched in this attempt.'}, {stage: 'Authorize and token test', wait: 'Unknown', note: 'No test was completed.'}, {stage: 'Provider review and publishing', wait: 'Unknown', note: 'Do not promise a date until review docs are checked.'}], checklist: [{item: 'Official developer console identified', status: 'required', who: 'agent'}, {item: 'Registration fields and redirect URI listed from official docs', status: 'required', who: 'agent'}, {item: 'Scopes verified against official docs, minimum only', status: 'required', who: 'agent'}, {item: 'Client secret stored server side', status: 'required', who: 'human'}, {item: 'One real consent flow tested', status: 'required', who: 'agent'}, {item: 'Review submission prepared by a human', status: 'required', who: 'human'}], blockers: [{blocker: 'Research endpoint unavailable', fix: 'Retry, or research official docs manually.'}, {blocker: 'Redirect URL mismatch', fix: 'Use the exact redirect URI from your code and official docs.'}, {blocker: 'Scope not verified', fix: 'Do not guess scopes. List them from official docs only.'}], agentCan: ['Research official docs'], humanMust: ['Sign in to the provider console', 'Submit for review'], sources: [], tested: 'Live research attempt failed in the browser.', notVerified: ['All details in this guide'], executionLog: [{time: new Date().toISOString(), action: 'live_research', url: '/api/research', status: 'failed', detail: String(err && err.message ? err.message : err)}] };
    if (!guides.find(x => x.id === g.id)) guides.push(g);
    saveStoredGuide(g);
    render();
    showDetail(g, true);
  }
}
document.getElementById('searchForm').addEventListener('submit', async e => {
  e.preventDefault();
  const name = document.getElementById('search').value.trim();
  if (!name) return;
  const cached = findGuideForInput(name);
  if (cached) { showDetail(cached, String(cached.id || '').startsWith('generated-')); return; }
  await runResearch(name);
});
load();
