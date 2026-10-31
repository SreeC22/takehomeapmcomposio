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
    <p class="meta">${esc(g.category)}</p>
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
function stepsHtml(g) {
  return '<ul>' + g.steps.map((s, i) => `<li><strong>Step ${i + 1}: ${esc(s.title)}</strong> - ${esc(s.detail)}<br><span class="meta">Who: ${esc(s.who)} | Time: ${esc(s.time)} | Watch out: ${esc(s.blockerTip)}</span></li>`).join('') + '</ul>';
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
  if (isGenerated || String(g.id || '').startsWith('generated-') || String(g.id || '').startsWith('draft-')) {
    const enc = encodeGuide(g);
    if (enc) location.hash = 'generated=' + enc;
  } else {
    location.hash = 'guide=' + g.id;
  }
  const el = document.getElementById('detail');
  el.classList.remove('hidden');
  el.innerHTML = `
    <p><a href="#grid">Back to all platforms</a> | <button id="shareBtn" type="button">Copy share link</button> | <button id="jsonBtn" type="button">Copy guide JSON</button></p>
    <h2>${esc(g.name)} <span class="badge">${esc(g.difficulty)}</span> <span class="badge ${esc(g.guideType)}">${esc(g.guideType)}</span></h2>
    <p>${esc(g.difficultyWhy)}</p>
    <div class="step"><h3>At a glance</h3>
      <ul>
        <li><strong>Setup time:</strong> ${esc(g.setupTime)}</li>
        <li><strong>Approval wait:</strong> ${esc(g.approvalWait)}</li>
        <li><strong>Account needed:</strong> ${esc(g.accountNeeded)}</li>
        <li><strong>Cost to register:</strong> ${esc(g.cost)}</li>
        <li><strong>Console:</strong> ${esc(g.consoleName)} - ${esc(g.consoleUrl)}</li>
        <li><strong>Managed app note:</strong> ${esc(g.managedAppNote)}</li>
      </ul>
    </div>
    <p class="small">Managed or custom? Check managed first. Go custom only for own branding, custom scopes, dedicated quota, or a custom instance.</p>
    <h3>Step by step guide</h3>
    ${stepsHtml(g)}
    <h3>Review timeline card</h3>
    <ul>${g.timeline.map(t => `<li><strong>${esc(t.stage)}:</strong> ${esc(t.wait)} - ${esc(t.note)}</li>`).join('')}</ul>
    <h3>Approval checklist card</h3>
    <div class="checklist">
      ${g.checklist.map(c => `<label><input type="checkbox"> <span><strong>${esc(c.item)}</strong> - ${esc(c.status)} - ${esc(c.who)}</span></label>`).join('')}
    </div>
    <p class="small">Check items as you complete them. This checklist is a local browser check only, it does not submit anything to the provider.</p>
    <h3>Blockers and fixes</h3>
    <ul>${g.blockers.map(b => `<li><strong>${esc(b.blocker)}:</strong> ${esc(b.fix)}</li>`).join('')}</ul>
    <h3>What an agent can do, and where you take over</h3>
    <p><strong>Agent can:</strong></p><ul>${g.agentCan.map(a => `<li>${esc(a)}</li>`).join('')}</ul>
    <p><strong>You must:</strong></p><ul>${g.humanMust.map(a => `<li>${esc(a)}</li>`).join('')}</ul>
    ${executionHtml(g)}
    <h3>Next step</h3>
    <ul><li><strong>${esc(g.nextStep)}</strong></li></ul>
  `;
  document.getElementById('shareBtn').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(location.href); alert('Share link copied.'); } catch (e) { alert(location.href); }
  });
  document.getElementById('jsonBtn').addEventListener('click', async () => {
    const json = JSON.stringify(g, null, 2);
    try { await navigator.clipboard.writeText(json); alert('Guide JSON copied.'); } catch (e) { alert('Copy failed, use guides.json instead.'); }
  });
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
async function runResearch(name) {
  const statusEl = document.getElementById('searchStatus');
  if (statusEl) statusEl.textContent = 'Researching ' + name + ' now. This can take up to about a minute for an unfamiliar app.';
  try {
    const res = await fetch('/api/research?app=' + encodeURIComponent(name));
    if (!res.ok) throw new Error('Research endpoint returned ' + res.status);
    const data = await res.json();
    const g = data.guide;
    g.executionLog = data.log || [];
    if (!guides.find(x => x.id === g.id)) guides.push(g);
    saveStoredGuide(g);
    render();
    if (statusEl) statusEl.textContent = 'Live research complete for ' + name + '. Confidence: ' + g.confidence + '. Check it against official docs before use.';
    showDetail(g, true);
  } catch (err) {
    if (statusEl) statusEl.textContent = 'Live research could not run for ' + name + '. The guide below is Low confidence and Unknown, with no provider-specific claims.';
    const id = 'generated-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'generated-app';
    const g = { id: id, name: name, category: 'Generated, research endpoint unavailable', difficulty: 'Unknown', difficultyWhy: 'Live research endpoint was unavailable, so no provider-specific claims could be verified.', setupTime: 'Unknown', approvalWait: 'Unknown, do not promise a date until review docs are checked', accountNeeded: 'Unknown, check the provider developer docs', cost: 'Unknown', consoleName: 'Unknown, find the official developer console first', consoleUrl: 'Unknown', guideType: 'draft', confidence: 'Low', managedAppNote: 'Check first whether a managed app already covers this platform.', nextStep: 'Find the official developer console and registration docs for ' + name + ', then list scopes and review triggers before building.', steps: [{title: 'Research failed, do not use as a verified guide', detail: 'The live research endpoint could not be reached. No official docs were fetched in this attempt.', who: 'human', time: 'Unknown', blockerTip: 'Retry, or research the official docs manually before building.'}], timeline: [{stage: 'Investigation', wait: 'Unknown', note: 'Research endpoint unavailable.'}], checklist: [{item: 'Official developer console identified', status: 'required', who: 'agent'}], blockers: [{blocker: 'Research endpoint unavailable', fix: 'Retry, or research official docs manually.'}], agentCan: ['Research official docs'], humanMust: ['Sign in to the provider console', 'Submit for review'], sources: [], tested: 'Live research attempt failed in the browser.', notVerified: ['All details in this draft'], executionLog: [{time: new Date().toISOString(), action: 'live_research', url: '/api/research', status: 'failed', detail: String(err && err.message ? err.message : err)}] };
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
