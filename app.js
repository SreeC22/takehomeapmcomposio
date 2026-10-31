let guides = [];
let allGuides = [];
let difficultyFilter = '';
let guideTypeFilter = '';
const logos = {github: 'github', slack: 'slack', google: 'google', meta: 'meta', microsoft: 'microsoft', notion: 'notion', salesforce: 'salesforce', hubspot: 'hubspot', shopify: 'shopify', zoom: 'zoom', discord: 'discord', linkedin: 'linkedin'};
function logoHtml(g, size) {
  const slug = logos[g.id];
  if (!slug) return '';
  return `<img class="logo" src="https://cdn.simpleicons.org/${slug}/111827" alt="${g.name} logo" onerror="this.remove()">`;
}
function setPills(containerId, value) {
  document.querySelectorAll('#' + containerId + ' .pill').forEach(b => {
    const active = b.dataset.value === value;
    b.classList.toggle('active', active);
    b.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}
async function load() {
  const res = await fetch('guides.json');
  const data = await res.json();
  guides = data.guides;
  allGuides = guides;
  render();
  const hash = location.hash.replace('#guide=', '');
  if (hash) {
    const g = guides.find(x => x.id === hash);
    if (g) showDetail(g);
  }
}
function card(g) {
  return `<article class="card" tabindex="0" data-id="${g.id}">
    <div class="card-head">${logoHtml(g)}<h3>${g.name}</h3></div>
    <p><span class="badge">${g.difficulty}</span><span class="badge ${g.guideType}">${g.guideType}</span></p>
    <p class="meta"><strong>Setup:</strong> ${g.setupTime}</p>
    <p class="meta"><strong>Approval wait:</strong> ${g.approvalWait}</p>
    <p class="meta">${g.category}</p>
    <p class="view">View guide</p>
  </article>`;
}
function render() {
  const q = (document.getElementById('search').value || '').toLowerCase();
  const d = difficultyFilter;
  const t = guideTypeFilter;
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
  return g.steps.map((s, i) => `<div class="step"><div class="step-num">${i + 1}</div><div><h3>${s.title}</h3><p>${s.detail}</p><p class="meta">${s.who} - ${s.time}</p><p class="watch"><strong>Watch out:</strong> ${s.blockerTip}</p></div></div>`).join('');
}
function showDetail(g) {
  location.hash = 'guide=' + g.id;
  const el = document.getElementById('detail');
  el.classList.remove('hidden');
  el.innerHTML = `
    <div class="detail-actions"><button id="backBtn" type="button" class="secondary">Back to all platforms</button><button id="shareBtn" type="button" class="secondary">Copy share link</button><button id="jsonBtn" type="button" class="secondary">Copy guide JSON</button></div>
    <div class="detail-head">${logoHtml(g)}<div><h2>${g.name}</h2><p><span class="badge">${g.difficulty}</span> <span class="badge ${g.guideType}">${g.guideType}</span></p></div></div>
    <p>${g.difficultyWhy}</p>
    <h3>At a glance</h3>
    <dl class="glance">
      <div><dt>Setup time</dt><dd>${g.setupTime}</dd></div>
      <div><dt>Approval wait</dt><dd>${g.approvalWait}</dd></div>
      <div><dt>Account needed</dt><dd>${g.accountNeeded}</dd></div>
      <div><dt>Cost</dt><dd>${g.cost}</dd></div>
      <div><dt>Console</dt><dd>${g.consoleName} - ${g.consoleUrl}</dd></div>
      <div><dt>Managed app note</dt><dd>${g.managedAppNote}</dd></div>
    </dl>
    <h3>Setup</h3>
    ${stepsHtml(g)}
    <h3>Review timeline</h3>
    ${g.timeline.map(t => `<div class="timeline-item"><h3>${t.stage} <span class="badge">${t.wait}</span></h3><p>${t.note}</p></div>`).join('')}
    <h3>Approval checklist</h3>
    <div class="checklist">
      ${g.checklist.map(c => `<label><input type="checkbox"> <span><strong>${c.item}</strong> - ${c.status} - ${c.who}</span></label>`).join('')}
    </div>
    <p class="small">Local browser checks only. Checking an item does not submit anything to the provider.</p>
    <h3>Blockers and fixes</h3>
    ${g.blockers.map(b => `<div class="timeline-item"><h3>${b.blocker}</h3><p>${b.fix}</p></div>`).join('')}
    <h3>Agent vs human</h3>
    <div class="two-col"><div><h3>Agent can</h3><ul>${g.agentCan.map(x => `<li>${x}</li>`).join('')}</ul></div><div><h3>You must</h3><ul>${g.humanMust.map(x => `<li>${x}</li>`).join('')}</ul></div></div>
    <h3>Evidence and uncertainty</h3>
    <p><strong>Confidence:</strong> ${g.confidence}</p>
    <p><strong>Tested:</strong> ${g.tested}</p>
    <p><strong>Not verified:</strong> ${g.notVerified.join('; ')}</p>
    <p><strong>Sources:</strong> ${g.sources.length ? g.sources.map(s => `<a href="${s}">${s}</a>`).join('<br>') : 'None listed for this summary card. Use live generation and official docs before use.'}</p>
    <h3>Next step</h3>
    <p><strong>${g.nextStep}</strong></p>
  `;
  document.getElementById('backBtn').addEventListener('click', () => {
    history.pushState(null, '', location.pathname);
    el.classList.add('hidden');
    document.getElementById('grid').scrollIntoView({behavior: 'smooth'});
  });
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
document.querySelectorAll('#difficultyPills .pill').forEach(b => b.addEventListener('click', () => {
  difficultyFilter = b.dataset.value;
  setPills('difficultyPills', difficultyFilter);
  render();
}));
document.querySelectorAll('#typePills .pill').forEach(b => b.addEventListener('click', () => {
  guideTypeFilter = b.dataset.value;
  setPills('typePills', guideTypeFilter);
  render();
}));
window.addEventListener('hashchange', () => {
  const hash = location.hash.replace('#guide=', '');
  if (!hash) return;
  const g = guides.find(x => x.id === hash);
  if (g) showDetail(g);
});
document.getElementById('copyJson').addEventListener('click', async () => {
  const url = location.origin + location.pathname.replace(/index\.html$/, '') + 'guides.json';
  try { await navigator.clipboard.writeText(url); document.getElementById('copyMsg').textContent = 'Copied: ' + url; } catch (e) { document.getElementById('copyMsg').textContent = url; }
});
document.getElementById('liveForm').addEventListener('submit', e => {
  e.preventDefault();
  const name = document.getElementById('liveApp').value.trim();
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'draft-app';
  const draft = {
    id: 'draft-' + id, name: name, category: 'Draft, from live generation', difficulty: 'Unknown, check scope tiers',
    difficultyWhy: 'Draft only. Difficulty cannot be known until scope tiers and review docs are checked.',
    setupTime: 'Unknown', approvalWait: 'Unknown, do not promise a date until review docs are checked',
    accountNeeded: 'Unknown, check the provider developer docs', cost: 'Unknown',
    consoleName: 'Unknown, find the official developer console first', consoleUrl: 'Unknown',
    guideType: 'draft', confidence: 'Low',
    managedAppNote: 'Check first whether a managed app already covers this platform. If it does, you may not need your own app.',
    nextStep: 'Find the official developer console and registration docs for ' + name + ', then list scopes and review triggers before building.',
    steps: [
      {title: 'Identify the provider and developer console', detail: 'Find the official developer console, not a blog summary. Note the exact console name and URL.', who: 'agent', time: '10 minutes', blockerTip: 'If you cannot find an official console, stop and mark the guide as unverified.'},
      {title: 'Find registration docs', detail: 'Read how to create an app, what fields are required, and what redirect URIs are needed.', who: 'agent', time: '20 minutes', blockerTip: 'Do not guess redirect URI rules. Copy them from official docs.'},
      {title: 'List scopes and scope tiers', detail: 'List every scope your feature needs, then check whether each scope is non-sensitive, sensitive, or restricted, or the provider equivalent.', who: 'agent', time: '20 minutes', blockerTip: 'A single sensitive scope can change the whole timeline. Do not hide it in a broad scope list.'},
      {title: 'Read review and verification docs', detail: 'Check what triggers review, what documents are needed, and whether a demo, test account, or business verification is required.', who: 'agent', time: '20 minutes', blockerTip: 'If review docs are missing, mark timeline as Unknown.'},
      {title: 'Draft the approval checklist and timeline', detail: 'Turn the docs into a checklist and a timeline with stages and ranges, with sources for each claim.', who: 'agent', time: '20 minutes', blockerTip: 'A checklist without sources is not ready to submit.'}
    ],
    timeline: [{stage: 'Investigation', wait: 'Unknown', note: 'Draft only.'}, {stage: 'Provider review, if required', wait: 'Unknown', note: 'Check official review docs before promising a date.'}],
    checklist: [
      {item: 'Official developer console identified', status: 'required', who: 'agent'},
      {item: 'Registration fields and redirect URIs listed from official docs', status: 'required', who: 'agent'},
      {item: 'Scopes classified and justified', status: 'required', who: 'agent'},
      {item: 'Privacy policy URL live', status: 'required', who: 'human'},
      {item: 'Review submission prepared by a human', status: 'required', who: 'human'}
    ],
    blockers: [{blocker: 'Official docs not found', fix: 'Mark the guide as unverified and do not use it for a launch decision.'}],
    agentCan: ['Research official docs', 'List scopes and review triggers', 'Draft checklists and timelines'],
    humanMust: ['Sign in to the provider console', 'Verify domain or business if required', 'Submit for review and reply to reviewers'],
    sources: [], tested: 'Draft generated in the browser demo only. No provider docs were verified for this draft yet.', notVerified: ['All details in this draft', 'Console URL', 'Scopes', 'Timeline', 'Approval requirements']
  };
  guides.push(draft);
  document.getElementById('liveResult').innerHTML = '<p><strong>Draft created for ' + name + '.</strong> This is an Agent draft, not a verified guide. Click it below to open it, then check it against official docs before use.</p>';
  showDetail(draft);
});
load();
