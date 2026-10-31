let guides = [];
let allGuides = [];
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
    <h3>${g.name}</h3>
    <p><span class="badge">${g.difficulty}</span><span class="badge ${g.guideType}">${g.guideType}</span></p>
    <p class="meta"><strong>Setup:</strong> ${g.setupTime}</p>
    <p class="meta"><strong>Approval wait:</strong> ${g.approvalWait}</p>
    <p>${g.difficultyWhy}</p>
    <p class="meta">${g.category}</p>
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
  return g.steps.map((s, i) => `<div class="step"><h3>Step ${i + 1}: ${s.title}</h3><p>${s.detail}</p><p class="meta">Who: ${s.who} | Time: ${s.time}</p><p><strong>Watch out:</strong> ${s.blockerTip}</p></div>`).join('');
}
function showDetail(g) {
  location.hash = 'guide=' + g.id;
  const el = document.getElementById('detail');
  el.classList.remove('hidden');
  el.innerHTML = `
    <p><a href="#grid">Back to all platforms</a> | <button id="shareBtn" type="button">Copy share link</button> | <button id="jsonBtn" type="button">Copy guide JSON</button></p>
    <h2>${g.name} <span class="badge">${g.difficulty}</span> <span class="badge ${g.guideType}">${g.guideType}</span></h2>
    <p>${g.difficultyWhy}</p>
    <div class="step"><h3>At a glance</h3>
      <p><strong>Setup time:</strong> ${g.setupTime}</p>
      <p><strong>Approval wait:</strong> ${g.approvalWait}</p>
      <p><strong>Account needed:</strong> ${g.accountNeeded}</p>
      <p><strong>Cost to register:</strong> ${g.cost}</p>
      <p><strong>Console:</strong> ${g.consoleName} - ${g.consoleUrl}</p>
      <p><strong>Managed app note:</strong> ${g.managedAppNote}</p>
    </div>
    <h3>Card-by-card setup</h3>
    ${stepsHtml(g)}
    <h3>Review timeline card</h3>
    ${g.timeline.map(t => `<div class="timeline-item"><h3>${t.stage}</h3><p><strong>Wait:</strong> ${t.wait}</p><p>${t.note}</p></div>`).join('')}
    <h3>Approval checklist card</h3>
    <div class="checklist">
      ${g.checklist.map(c => `<label><input type="checkbox"> <span><strong>${c.item}</strong> - ${c.status} - ${c.who}</span></label>`).join('')}
    </div>
    <p class="small">Check items as you complete them. This checklist is a local browser check only, it does not submit anything to the provider.</p>
    <h3>Blockers and fixes</h3>
    ${g.blockers.map(b => `<div class="blocker"><h3>${b.blocker}</h3><p>${b.fix}</p></div>`).join('')}
    <h3>What an agent can do, and where you take over</h3>
    <p><strong>Agent can:</strong> ${g.agentCan.join(', ')}.</p>
    <p><strong>You must:</strong> ${g.humanMust.join(', ')}.</p>
    <h3>Evidence and uncertainty</h3>
    <p><strong>Confidence:</strong> ${g.confidence}</p>
    <p><strong>Tested:</strong> ${g.tested}</p>
    <p><strong>Not verified:</strong> ${g.notVerified.join('; ')}</p>
    <p><strong>Sources:</strong> ${g.sources.length ? g.sources.map(s => `<a href="${s}">${s}</a>`).join('<br>') : 'None listed for this summary card. Use live generation and official docs before use.'}</p>
    <h3>Next step</h3>
    <p><strong>${g.nextStep}</strong></p>
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
