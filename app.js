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
    <p>${esc(g.difficultyWhy)}</p>
    <p class="meta">${esc(g.category)}</p>
  </article>`;
}
function render() {
  const q = (document.getElementById('search').value || '').toLowerCase();
  const d = document.getElementById('difficulty').value;
  const t = document.getElementById('guideType').value;
  const list = guides.filter(g => {
    return (!q || (g.name + ' ' + g.category).toLowerCase().includes(q)) &&
      (!d || g.difficulty === d) &&
      (!t || g.guideType === t);
  });
  document.getElementById('grid').innerHTML = list.map(card).join('');
  document.getElementById('empty').classList.toggle('hidden', list.length > 0);
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
  return g.steps.map((s, i) => `<div class="step"><h3>Step ${i + 1}: ${esc(s.title)}</h3><p>${esc(s.detail)}</p><p class="meta">Who: ${esc(s.who)} | Time: ${esc(s.time)}</p><p><strong>Watch out:</strong> ${esc(s.blockerTip)}</p></div>`).join('');
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
      <p><strong>Setup time:</strong> ${esc(g.setupTime)}</p>
      <p><strong>Approval wait:</strong> ${esc(g.approvalWait)}</p>
      <p><strong>Account needed:</strong> ${esc(g.accountNeeded)}</p>
      <p><strong>Cost to register:</strong> ${esc(g.cost)}</p>
      <p><strong>Console:</strong> ${esc(g.consoleName)} - ${esc(g.consoleUrl)}</p>
      <p><strong>Managed app note:</strong> ${esc(g.managedAppNote)}</p>
    </div>
    <div class="step"><h3>Managed or custom, first decision</h3>
      <p>Check Composio managed apps first. Stay managed if default scopes cover your needs and Composio branding fits. Go custom if you need your own branding, custom scopes, dedicated quota, faster polling, a custom instance, or enterprise end-to-end branding. You can mix approaches by toolkit.</p>
      <p><strong>If you use Composio:</strong> Create an auth config in the Composio dashboard, take the redirect URI it shows, add that URI in the provider portal, copy the Client ID and Client Secret back into Composio, save and copy the auth config ID, then pass that ID in the session for that toolkit. Toolkits left out keep using managed auth.</p>
    </div>
    <h3>Card-by-card setup</h3>
    ${stepsHtml(g)}
    <h3>Review timeline card</h3>
    ${g.timeline.map(t => `<div class="timeline-item"><h3>${esc(t.stage)}</h3><p><strong>Wait:</strong> ${esc(t.wait)}</p><p>${esc(t.note)}</p></div>`).join('')}
    <h3>Approval checklist card</h3>
    <div class="checklist">
      ${g.checklist.map(c => `<label><input type="checkbox"> <span><strong>${esc(c.item)}</strong> - ${esc(c.status)} - ${esc(c.who)}</span></label>`).join('')}
    </div>
    <p class="small">Check items as you complete them. This checklist is a local browser check only, it does not submit anything to the provider.</p>
    <h3>Blockers and fixes</h3>
    ${g.blockers.map(b => `<div class="blocker"><h3>${esc(b.blocker)}</h3><p>${esc(b.fix)}</p></div>`).join('')}
    <h3>What an agent can do, and where you take over</h3>
    <p><strong>Agent can:</strong> ${esc(g.agentCan.join(', '))}.</p>
    <p><strong>You must:</strong> ${esc(g.humanMust.join(', '))}.</p>
    ${executionHtml(g)}
    <h3>Next step</h3>
    <p><strong>${esc(g.nextStep)}</strong></p>
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
document.getElementById('difficulty').addEventListener('change', render);
document.getElementById('guideType').addEventListener('change', render);
document.getElementById('copyJson').addEventListener('click', async () => {
  const url = location.origin + location.pathname.replace(/index\.html$/, '') + 'guides.json';
  try { await navigator.clipboard.writeText(url); document.getElementById('copyMsg').textContent = 'Copied: ' + url; } catch (e) { document.getElementById('copyMsg').textContent = url; }
});
document.getElementById('liveForm').addEventListener('submit', async e => {
  e.preventDefault();
  const name = document.getElementById('liveApp').value.trim();
  const resultEl = document.getElementById('liveResult');
  resultEl.innerHTML = '<p>Researching ' + esc(name) + ' now. The research endpoint searches for official developer and OAuth docs, fetches candidate pages, and extracts registration, scope, and review claims with sources. This takes a few seconds.</p>';
  try {
    const res = await fetch('/api/research?app=' + encodeURIComponent(name));
    if (!res.ok) throw new Error('Research endpoint returned ' + res.status);
    const data = await res.json();
    const g = data.guide;
    const log = data.log || [];
    g.executionLog = log;
    if (!guides.find(x => x.id === g.id)) guides.push(g);
    saveStoredGuide(g);
    render();
    const logHtml = log.map(l => `<li>${esc(l.time || '')} - ${esc(l.action || '')} - ${esc(l.url || '')} - ${esc(l.status || '')} - ${esc(l.detail || '')}</li>`).join('');
    resultEl.innerHTML = '<p><strong>Live research complete for ' + esc(name) + '.</strong> Confidence: ' + esc(g.confidence) + '. This guide is generated from the research log below, not from a static template. Check it against official docs before use.</p><p><strong>Research log:</strong></p><ul>' + logHtml + '</ul><p>Share link: copy it from the guide detail below. It survives refresh and sharing, because the guide data is encoded in the link and also saved in this browser.</p>';
    showDetail(g, true);
  } catch (err) {
    const id = 'generated-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'generated-app';
    const g = {
      id: id, name: name, category: 'Generated, research endpoint unavailable', difficulty: 'Unknown',
      difficultyWhy: 'Live research endpoint was unavailable, so no provider-specific claims could be verified. Do not use this as a verified guide.',
      setupTime: 'Unknown', approvalWait: 'Unknown, do not promise a date until review docs are checked',
      accountNeeded: 'Unknown, check the provider developer docs', cost: 'Unknown',
      consoleName: 'Unknown, find the official developer console first', consoleUrl: 'Unknown',
      guideType: 'draft', confidence: 'Low',
      managedAppNote: 'Check first whether a managed app already covers this platform. If it does, you may not need your own app.',
      nextStep: 'Find the official developer console and registration docs for ' + name + ', then list scopes and review triggers before building.',
      steps: [{title: 'Research failed, do not use as a verified guide', detail: 'The live research endpoint could not be reached. No official docs were fetched in this attempt, so no provider-specific steps are claimed here.', who: 'human', time: 'Unknown', blockerTip: 'Retry live research, or research the official docs manually before building.'}],
      timeline: [{stage: 'Investigation', wait: 'Unknown', note: 'Research endpoint unavailable.'}],
      checklist: [{item: 'Official developer console identified', status: 'required', who: 'agent'}],
      blockers: [{blocker: 'Research endpoint unavailable', fix: 'Retry, or research official docs manually and do not treat this draft as verified.'}],
      agentCan: ['Research official docs', 'List scopes and review triggers'],
      humanMust: ['Sign in to the provider console', 'Submit for review and reply to reviewers'],
      sources: [], tested: 'Live research attempt failed in the browser. No provider docs were verified for this draft.',
      notVerified: ['All details in this draft', 'Console URL', 'Scopes', 'Timeline', 'Approval requirements'],
      executionLog: [{time: new Date().toISOString(), action: 'live_research', url: '/api/research', status: 'failed', detail: String(err && err.message ? err.message : err)}]
    };
    if (!guides.find(x => x.id === g.id)) guides.push(g);
    saveStoredGuide(g);
    render();
    resultEl.innerHTML = '<p><strong>Live research could not run for ' + esc(name) + '.</strong> The guide below is marked Low confidence and Unknown, with no provider-specific claims. This is a failure, not a verified guide.</p>';
    showDetail(g, true);
  }
});
load();
