const $ = id => document.getElementById(id);
let project = null;
let view = 'Requirement';
let samples = [];
let chatConversationId = null;
let chatAbortController = null;
let voiceRecognition = null;
let voiceTarget = null;
let voiceStartedAt = 0;
let voiceTimer = null;
let libraryScreen = 'workflows';
let pendingReview = null;
let activeWorkspaceId = localStorage.getItem('flowpilot.active-workspace') || '';
let workspaces = [];
let editingWorkspaceId = null;
let requirementIntelligence = null;

const tabs = ['Requirement', 'Analysis', 'BRD', 'Backlog', 'Tests', 'Traceability', 'QA Handoff'];
const stages = [
  ['Requirement', 'input'], ['Analysis', 'agent'], ['BRD', 'agent'], ['BRD approval', 'approval'],
  ['Backlog', 'agent'], ['Backlog approval', 'approval'], ['Tests', 'agent'], ['Traceability', 'agent'], ['QA Handoff', 'agent']
];
const esc = x => String(x ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

async function api(url, body) {
  if (activeWorkspaceId && (/^\/api\/projects$|^\/api\/workspace\/overview$|^\/api\/reviews$|^\/api\/dashboard$/).test(url)) url += `${url.includes('?') ? '&' : '?'}workspace_id=${encodeURIComponent(activeWorkspaceId)}`;
  const response = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: body ? {'Content-Type':'application/json'} : {},
    body: body ? JSON.stringify(body) : undefined
  });
  let json;
  try { json = await response.json(); } catch (_) { throw Error('The server returned an invalid response. Try again.'); }
  if (!json.success) throw Error(json.error?.message || 'Request failed');
  return json.data;
}

function status(text) {
  $('status').hidden = !text;
  $('status').textContent = text;
}

function toast(message, type = 'info') {
  const item = document.createElement('div');
  item.className = `toast ${type}`; item.textContent = message;
  $('toasts').append(item);
  window.setTimeout(() => item.remove(), 3600);
}


function voiceSupported() { return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition); }
function stopVoiceInput() { if (voiceRecognition) voiceRecognition.stop(); }
function resetVoiceUi() {
  clearInterval(voiceTimer); voiceTimer = null;
  ['requirementVoice', 'chatVoice'].forEach(id => $(id)?.classList.remove('recording'));
  ['requirementVoiceStatus', 'chatVoiceStatus'].forEach(id => { if ($(id)) $(id).hidden = true; });
  voiceRecognition = null; voiceTarget = null;
}
function startVoiceInput(target) {
  if (!voiceSupported()) { toast('Voice input is not available in this browser. Try a Chromium-based browser with microphone permission.', 'error'); return; }
  if (voiceRecognition) { stopVoiceInput(); return; }
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new Recognition(); const button = $(`${target}Voice`); const statusEl = $(`${target}VoiceStatus`);
  voiceTarget = target; voiceRecognition = recognition;
  recognition.lang = navigator.language || 'en-US'; recognition.continuous = false; recognition.interimResults = true;
  recognition.onstart = () => {
    voiceStartedAt = Date.now(); button.classList.add('recording'); statusEl.hidden = false;
    const updateStatus = () => { statusEl.textContent = `Listening… ${Math.floor((Date.now() - voiceStartedAt) / 1000)}s`; };
    updateStatus(); voiceTimer = setInterval(updateStatus, 250);
  };
  recognition.onresult = event => {
    const transcript = Array.from(event.results).map(result => result[0].transcript).join(' ').trim();
    if (transcript) {
      const input = $(target === 'requirement' ? 'requirement' : 'chatInput');
      input.value = `${input.value.trim()}${input.value.trim() ? ' ' : ''}${transcript}`; input.focus();
      if (target === 'requirement') updateRequirementCount();
      statusEl.textContent = event.results[event.results.length - 1].isFinal ? 'Transcript added. Review it before sending.' : 'Transcribing…';
    }
  };
  recognition.onerror = event => { if (event.error !== 'aborted') toast(event.error === 'not-allowed' ? 'Microphone permission was not granted.' : 'Voice input could not start.', 'error'); };
  recognition.onend = resetVoiceUi;
  try { recognition.start(); } catch (_) { resetVoiceUi(); }
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('flowpilot.theme', theme);
  $('themeToggle').textContent = theme === 'dark' ? '☀' : '◐';
}

function updateRequirementCount() {
  $('requirementCount').textContent = `${$('requirement').value.length.toLocaleString()} / 10,000`;
  const text = $('requirement').value.toLowerCase();
  const clarity = text.length > 160 ? 30 : text.length > 80 ? 22 : text.length > 20 ? 12 : 0;
  const rules = /rule|must|only|cannot/.test(text) ? 25 : 0;
  const acceptance = /given|when|then|acceptance/.test(text) ? 25 : 0;
  const constraints = /constraint|limit|within|permission|secure/.test(text) ? 20 : 0;
  const score = clarity + rules + acceptance + constraints;
  $('qualityScore').textContent = score;
  $('qualityMeter').style.width = `${score}%`;
  $('qualityClarity').textContent = clarity >= 22 ? 'Strong' : 'Needs detail';
  $('qualityRules').textContent = /rule|must|only|cannot/.test(text) ? 'Present' : 'Missing';
  $('qualityAcceptance').textContent = /given|when|then|acceptance/.test(text) ? 'Good' : 'Missing';
  $('qualityConstraints').textContent = /constraint|limit|within|permission|secure/.test(text) ? 'Present' : 'Missing';
  $('qualityTip').textContent = acceptance ? (constraints ? 'Your brief is ready to be reviewed before agent handoff.' : 'Add validation constraints to make the generated tests more reliable.') : 'Acceptance criteria are missing. Add a success and failure path before continuing.';
  $('qualityTipAction').textContent = acceptance ? 'Add constraints' : 'Add acceptance criteria';
}

function workspaceIdentity() { return JSON.parse(localStorage.getItem('flowpilot.workspace') || '{}'); }
async function loadActiveWorkspace() { workspaces = await api('/api/workspaces'); const current = workspaces.find(space => space.public_id === activeWorkspaceId) || workspaces[0]; if (current) { activeWorkspaceId = current.public_id; localStorage.setItem('flowpilot.active-workspace', activeWorkspaceId); localStorage.setItem('flowpilot.workspace', JSON.stringify({name:current.name, owner:current.owner})); applyWorkspaceIdentity(); } }
function renderWorkspaces() { $('workspaceList').innerHTML = workspaces.map(space => `<div class="workspace-row ${space.public_id === activeWorkspaceId ? 'selected' : ''}"><button type="button" data-workspace-select="${esc(space.public_id)}"><strong>${esc(space.name)}</strong><span>${space.workflow_count} workflow${space.workflow_count === 1 ? '' : 's'}</span></button><div><button type="button" data-workspace-edit="${esc(space.public_id)}">Edit</button><button type="button" data-workspace-delete="${esc(space.public_id)}" ${space.workflow_count ? 'disabled title="Delete workflows first"' : ''}>Delete</button></div></div>`).join(''); document.querySelectorAll('[data-workspace-select]').forEach(button => button.onclick = () => { activeWorkspaceId = button.dataset.workspaceSelect; localStorage.setItem('flowpilot.active-workspace', activeWorkspaceId); loadActiveWorkspace().then(() => { $('workspaceDialog').close(); reset(); }); }); document.querySelectorAll('[data-workspace-edit]').forEach(button => button.onclick = () => { editingWorkspaceId = button.dataset.workspaceEdit; $('workspaceNameInput').value = workspaces.find(space => space.public_id === editingWorkspaceId).name; }); document.querySelectorAll('[data-workspace-delete]').forEach(button => button.onclick = async () => { if (!confirm('Delete this empty workspace?')) return; try { await api(`/api/workspaces/${button.dataset.workspaceDelete}/delete`, {}); await loadActiveWorkspace(); renderWorkspaces(); toast('Workspace deleted', 'success'); } catch (error) { toast(error.message, 'error'); } }); }
function applyWorkspaceIdentity() { const identity = workspaceIdentity(); const owner = identity.owner || $('accountName').textContent || 'Your workspace'; const label = identity.name || 'FlowPilot'; $('workspaceBrand').textContent = label; $('ownerName').textContent = owner; $('ownerAvatar').textContent = owner.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase() || 'FP'; }

function chatReply(question) {
  const q = question.toLowerCase();
  if (/^(hi|hello|hey|good morning|good afternoon)\b/.test(q)) return 'Hi! I’m ready to help you understand the workflow or guide your next action.';
  if (/\b(thanks|thank you|great|good|cool|nice|okay|ok)\b/.test(q)) return 'Glad that helped. Ask me anything else about the workflow, or create a scenario when you want project-specific guidance.';
  if (/\b(sorry|apolog)/.test(q)) return 'No problem at all. Tell me what you want to change or ask, and I’ll help from there.';
  if (!project) {
    if (q.includes('next') || q.includes('do') || q.includes('start')) return 'Start by entering a requirement or loading a sample scenario. Once it is captured, the first available action is Run analysis.';
    if (q.includes('coverage') || q.includes('test')) return 'Coverage is calculated after the workflow creates analysis, backlog stories, acceptance criteria, and tests. Load a scenario to see live counts here.';
    if (q.includes('approval') || q.includes('review')) return 'There are two mandatory approval gates: the BRD review and the backlog review. Automation deliberately pauses at each gate so a person can approve or request changes.';
    if (q.includes('workflow') || q.includes('explain') || q.includes('help')) return 'FlowPilot converts a requirement into QA-ready evidence: Analysis → BRD → approval → Backlog → approval → Tests → Traceability → QA handoff.';
    if (q.includes('handoff') || q.includes('download')) return 'The QA handoff becomes available after traceability is validated. It packages the approved requirement, stories, tests, and links for QA review.';
    return 'I can explain the workflow, approval gates, coverage, or QA handoff. Create a workflow when you are ready for project-specific guidance.';
  }
  const vm = buildViewModel(project);
  if (q.includes('next') || q.includes('do') || q.includes('status')) return `You are at ${vm.currentStage}. ${vm.nextAction.detail} Your next action is: ${vm.nextAction.label}.`;
  if (q.includes('approval') || q.includes('review')) return 'BRD and backlog approvals are the two human gates. You can approve to continue, or use Request changes to record a reason and regenerate the artifact.';
  if (q.includes('coverage') || q.includes('test')) return `Current coverage: ${vm.coverage.requirements ?? 0} requirements, ${vm.coverage.stories ?? 0} stories, ${vm.coverage.criteria ?? 0} acceptance criteria, and ${vm.coverage.tests ?? 0} tests. Traceability is ${vm.coverage.traceability ?? 'not validated yet'}.`;
  if (q.includes('workflow') || q.includes('explain') || q.includes('help')) return 'FlowPilot turns a requirement into governed QA artifacts: Analysis → BRD → approval → Backlog → approval → Tests → Traceability → QA handoff. Use Run until approval to automate every safe step.';
  if (q.includes('handoff') || q.includes('download')) return vm.qaReadiness === 'Ready' ? 'The QA handoff is ready. Open the QA Handoff tab to download a JSON package or copy its summary.' : `The handoff is not ready yet. ${vm.nextAction.detail}`;
  return `I can help with the next action, approvals, test coverage, traceability, or QA handoff. Right now, ${vm.nextAction.detail}`;
}

function addChatMessage(text, role = 'assistant') {
  const message = document.createElement('div');
  message.className = `chat-message ${role}`;
  message.textContent = text;
  if (role === 'assistant') {
    const copy = document.createElement('button');
    copy.className = 'chat-copy'; copy.type = 'button'; copy.textContent = 'Copy'; copy.setAttribute('aria-label', 'Copy assistant response');
    copy.onclick = () => navigator.clipboard?.writeText(text).then(() => { copy.textContent = 'Copied'; window.setTimeout(() => { copy.textContent = 'Copy'; }, 1200); });
    message.append(copy);
  }
  $('chatMessages').append(message);
  $('chatMessages').scrollTop = $('chatMessages').scrollHeight;
}

async function askChat(question) {
  const cleaned = question.trim();
  if (!cleaned || chatAbortController) return;
  addChatMessage(cleaned, 'user');
  const typing = document.createElement('div');
  typing.className = 'chat-message assistant typing';
  typing.innerHTML = '<i></i><i></i><i></i>';
  $('chatMessages').append(typing);
  $('chatMessages').scrollTop = $('chatMessages').scrollHeight;
  try {
    chatAbortController = new AbortController();
    const endpoint = project ? `/api/projects/${project.public_id}/assistant` : '/api/assistant';
    const response = await fetch(endpoint, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({message:cleaned, conversation_id:chatConversationId}), signal:chatAbortController.signal});
    const json = await response.json();
    if (!response.ok || !json.success || !json.data?.reply) throw Error(json.error?.message || 'The assistant did not return a response.');
    chatConversationId = json.data.conversation_id;
    typing.remove();
    addChatMessage(json.data.reply);
  } catch (error) {
    typing.remove();
    const message = error.name === 'AbortError' ? 'Response stopped.' : 'I could not respond right now. Please retry your message.';
    addChatMessage(message); if (error.name !== 'AbortError') toast(message, 'error');
  } finally {
    chatAbortController = null;
  }
}

function toggleChat(open) {
  $('chatPanel').hidden = !open;
  $('chatToggle').setAttribute('aria-expanded', String(open));
  if (open) $('chatInput').focus();
}

function time(value) {
  if (!value) return 'Unknown';
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.max(0, Math.round(diff / 60000));
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return new Date(value).toLocaleDateString();
}

function stateRank(s) {
  return {
    REQUIREMENT_CAPTURED:0, ANALYSIS_COMPLETED:1, BRD_AWAITING_APPROVAL:2, BRD_REJECTED:2,
    BRD_APPROVED:3, BACKLOG_AWAITING_APPROVAL:4, BACKLOG_REJECTED:4, BACKLOG_APPROVED:5,
    TESTS_GENERATED:6, TRACEABILITY_VALIDATED:7, QA_HANDOFF_READY:8, COMPLETED:8, FAILED:-1
  }[s] ?? -1;
}

function buildViewModel(p, requested = view) {
  const a = p.artifacts || {};
  const state = p.state;
  const rank = stateRank(state);
  const failed = state === 'FAILED';
  const qaReady = Boolean(a.qa_handoff && a.qa_handoff.status === 'ready');
  let current = failed ? 'Requirement' : stages[Math.max(0, rank)][0];
  let next = {label:'Start a new workflow', reset:true, detail:'This workflow needs a corrected requirement.'};
  let blocking = [];

  if (state === 'REQUIREMENT_CAPTURED') {
    next = {label:'Run analysis', path:'analysis/generate', detail:'Generate structured analysis before creating the BRD.'};
    blocking = ['Run analysis', 'Approve BRD', 'Approve backlog', 'Generate tests', 'Validate traceability'];
  } else if (state === 'ANALYSIS_COMPLETED' || state === 'BRD_REJECTED') {
    next = {label:'Generate BRD', path:'brd/generate', detail:'Create a business requirements document from the analysis.'};
    blocking = ['Generate BRD', 'Approve BRD', 'Approve backlog', 'Generate tests', 'Validate traceability'];
  } else if (state === 'BRD_AWAITING_APPROVAL') {
    current = 'BRD approval';
    next = {label:'Review BRD', approve:'brd', detail:'Human approval is required before the backlog can start.'};
    blocking = ['Approve BRD', 'Approve backlog', 'Generate tests', 'Validate traceability'];
  } else if (state === 'BRD_APPROVED' || state === 'BACKLOG_REJECTED') {
    next = {label:'Generate backlog', path:'backlog/generate', detail:'Create delivery stories from the approved BRD.'};
    blocking = ['Generate backlog', 'Approve backlog', 'Generate tests', 'Validate traceability'];
  } else if (state === 'BACKLOG_AWAITING_APPROVAL') {
    current = 'Backlog approval';
    next = {label:'Review backlog', approve:'backlog', detail:'Human approval is required before test generation.'};
    blocking = ['Approve backlog', 'Generate tests', 'Validate traceability'];
  } else if (state === 'BACKLOG_APPROVED') {
    next = {label:'Generate tests', path:'tests/generate', detail:'Generate test coverage from the approved backlog.'};
    blocking = ['Generate tests', 'Validate traceability'];
  } else if (state === 'TESTS_GENERATED') {
    next = {label:'Validate traceability', path:'traceability/generate', detail:'Link requirements, stories, and tests before QA handoff.'};
    blocking = ['Validate traceability'];
  } else if (state === 'TRACEABILITY_VALIDATED') {
    next = {label:'Create QA handoff', path:'qa-handoff/generate', detail:'Create the final QA package from validated traceability.'};
    blocking = ['Create QA handoff'];
  } else if (qaReady) {
    current = 'QA Handoff';
    next = {label:'Start next scenario', nextScenario:true, detail:'The QA package is complete and ready to share.'};
  }

  const available = {
    Requirement:true, Analysis:Boolean(a.analysis), BRD:Boolean(a.brd), Backlog:Boolean(a.backlog),
    Tests:Boolean(a.tests), Traceability:Boolean(a.traceability), 'QA Handoff':qaReady
  };
  const selected = available[requested]
    ? requested
    : (available[current] && tabs.includes(current) ? current : tabs.filter(x => available[x]).at(-1) || 'Requirement');
  const coverage = {
    requirements:a.analysis?.functional_requirements?.length ?? null,
    stories:a.backlog?.stories?.length ?? null,
    criteria:(a.backlog?.stories || []).reduce((n, s) => n + (s.acceptance_criteria?.length || 0), 0) || null,
    tests:a.tests?.test_cases?.length ?? null,
    traceability:a.traceability?.coverage ?? null
  };
  const statusFor = i => failed ? 'failed' : i < rank ? 'complete' : i === rank ? (state.includes('AWAITING') ? 'review' : 'active') : 'blocked';

  return {
    workflowState:state,
    currentStage:current,
    selectedArtifact:selected,
    qaReadiness:qaReady ? 'Ready' : state === 'TRACEABILITY_VALIDATED' ? 'Requires review' : 'Not ready',
    nextAction:next,
    stageStatuses:stages.map((x, i) => ({label:x[0], type:x[1], status:statusFor(i)})),
    coverage,
    blockingIssues:blocking,
    available,
    completion:qaReady ? 100 : Math.max(0, Math.round((rank + 1) / 9 * 100))
  };
}

function remember(p) {
  const key = 'flowpilot.recent';
  const item = {
    id:p.public_id,
    title:(p.artifacts?.analysis?.title || p.description || p.name || 'Untitled workflow').slice(0, 58),
    state:p.state,
    updatedAt:new Date().toISOString()
  };
  const all = JSON.parse(localStorage.getItem(key) || '[]').filter(x => x.id !== item.id);
  localStorage.setItem(key, JSON.stringify([item, ...all].slice(0, 4)));
}

function sidebar(vm) {
  const recent = JSON.parse(localStorage.getItem('flowpilot.recent') || '[]');
  $('sidebarWorkflows').innerHTML = project ? `
    <section class="current-workflow">
      <p>CURRENT WORKFLOW</p>
      <strong title="${esc(project.name)}">${esc(project.name)}</strong>
      <span>${esc(project.public_id)}</span>
      <dl>
        <div><dt>Current stage</dt><dd>${esc(vm.currentStage)}</dd></div>
        <div><dt>${vm.completion}% complete</dt><dd>Updated ${time(project.updated_at || project.created_at)}</dd></div>
      </dl>
      <div class="progress" aria-label="${vm.completion}% complete"><i style="width:${vm.completion}%"></i></div>
    </section>
    ${recent.length ? `<section class="recent"><p>RECENT WORKFLOWS</p>${recent.map(x => `
      <button data-project="${esc(x.id)}" class="${x.id === project.public_id ? 'active' : ''}" title="${esc(x.title)}">
        <strong>${esc(x.title)}</strong><span>${esc(x.state.replaceAll('_', ' ').toLowerCase())} · ${time(x.updatedAt)}</span>
      </button>`).join('')}</section>` : ''}` : '';

  document.querySelectorAll('[data-project]').forEach(button => {
    button.onclick = async () => {
      try {
        project = await api(`/api/projects/${button.dataset.project}`);
        view = 'Requirement';
        render();
      } catch (error) { status(error.message); }
    };
  });
}

function sourceCard(id, title, text, meta = '') {
  return `<article class="content-card reveal-card">
    <div class="content-card-top"><span class="artifact-id">${esc(id)}</span>${meta ? `<span class="micro-badge">${esc(meta)}</span>` : ''}</div>
    <h3>${esc(title)}</h3><p>${esc(text || 'No content available.')}</p>
  </article>`;
}

function qaArtifact(vm) {
  const a = project.artifacts || {};
  const approvals = [
    {name:'BRD approval', state:a.brd?.approval_state || 'Approved'},
    {name:'Backlog approval', state:a.backlog?.approval_state || 'Approved'},
    {name:'Traceability', state:a.traceability?.coverage || 'Validated'}
  ];
  return `
    <section class="completion-hero motion-surface" data-pointer-glow>
      <div class="completion-copy">
        <p>WORKFLOW COMPLETE</p><h2>QA-ready handoff generated</h2>
        <span>Approved requirements, stories, tests and traceability are packaged for QA review.</span>
        <div class="completion-actions">
          <button class="primary" data-download>Download handoff <i>↓</i></button>
          <button class="secondary" data-copy-summary>Copy summary</button>
          <button class="secondary" data-next-scenario>Start next scenario <i>→</i></button>
        </div>
      </div>
      <div class="completion-orbit" aria-hidden="true"><span></span><span></span><span></span><b>100%</b></div>
    </section>
    <div class="handoff-grid">
      <section class="handoff-panel">
        <div class="section-heading"><div><p>PACKAGE CONTENTS</p><h2>Delivery artifacts</h2></div><span class="ready-pill">Ready</span></div>
        <div class="package-list">
          ${['Requirement','BRD','Backlog','Tests','Traceability'].map(name => `<button data-open-artifact="${name}"><span>${name}</span><small>View artifact</small><i>→</i></button>`).join('')}
        </div>
      </section>
      <section class="handoff-panel">
        <div class="section-heading"><div><p>APPROVAL EVIDENCE</p><h2>Governance passed</h2></div></div>
        <div class="approval-list">${approvals.map(x => `<div><b>✓</b><span><strong>${esc(x.name)}</strong><small>${esc(x.state)}</small></span></div>`).join('')}</div>
      </section>
    </div>`;
}

function artifactStatus(artifact) {
  const approval = artifact?.approval_state;
  if (approval === 'APPROVED') return 'Approved';
  if (approval === 'REJECTED') return 'Needs changes';
  return artifact ? 'AI generated' : 'Waiting';
}

function artifactControls(kind, copyText) {
  const awaiting = project.state === `${kind.toUpperCase()}_AWAITING_APPROVAL`;
  const rejected = project.state === `${kind.toUpperCase()}_REJECTED`;
  return `${copyText ? `<button class="copy" data-copy="${esc(copyText)}">Copy</button>` : ''}<button class="secondary" data-edit-artifact>Edit review</button>${awaiting ? `<button class="primary" data-approve="${kind}">Accept</button><button class="secondary" data-reject="${kind}">Reject</button>` : ''}${rejected ? `<button class="secondary" data-run="${kind}/generate">Regenerate</button>` : ''}`;
}

function artifactHeader(label, title, artifact, copyText = '', kind = '') {
  return `<header class="artifact-head structured-artifact-head"><div><p>${esc(label)} · ${esc(artifactStatus(artifact))}</p><h1>${esc(title)}</h1><span>v${esc(artifact?.version || 1)} · ${artifact?.created_at ? esc(time(artifact.created_at)) : 'Current output'}</span></div><div class="artifact-actions">${kind ? artifactControls(kind, copyText) : copyText ? `<button class="copy" data-copy="${esc(copyText)}">Copy</button>` : '<button class="secondary" data-edit-artifact>Edit review</button>'}</div></header>`;
}

function riskResults() {
  return (project.orchestration_runs || []).filter(run => run.agent === 'risk' && run.status === 'completed').flatMap(run => run.result?.risks || []);
}

function reviewFindingsPanel(review) {
  if (!review) return `<section class="review-findings"><div><p>REVIEW AGENT</p><h2>Inspect generated outputs</h2><span>Check coverage, duplicate scenarios, expected results, negative paths, security signals, and traceability links.</span></div><button class="primary" data-run-artifact-review>Run review</button></section>`;
  const findings = review.findings || [];
  return `<section class="review-findings"><div class="review-findings-head"><div><p>REVIEW AGENT · ${esc(review.status || 'Reviewed')}</p><h2>${findings.length ? `${findings.length} finding${findings.length === 1 ? '' : 's'} need attention` : 'Generated outputs reviewed'}</h2><span>v${esc(review.version || 1)} · ${esc(review.generated_by || 'Review Agent')}</span></div><button class="secondary" data-run-artifact-review>Run review again</button></div>${findings.length ? `<div class="finding-list">${findings.map(finding => `<article><b class="severity-${esc(String(finding.severity || '').toLowerCase())}">${esc(finding.severity)}</b><div><strong>${esc(finding.category)}</strong><h3>${esc(finding.title)}</h3><span>${esc(finding.detail)}</span></div>${['Generate missing negative test', 'Improve expected result'].includes(finding.remediation) ? `<button class="secondary" data-remediate-finding="${esc(finding.id)}">${esc(finding.remediation)}</button>` : `<small>${esc(finding.remediation)}</small>`}</article>`).join('')}</div>` : '<p class="empty-copy">No deterministic coverage or traceability issues were detected in the reviewed artifacts.</p>'}</section>`;
}

function traceabilityTree(artifacts) {
  const trace = artifacts.traceability || {};
  const fallback = (artifacts.backlog?.stories || []).map((story, index) => ({
    requirement_id: artifacts.analysis?.functional_requirements?.[index]?.id || `REQ-${index + 1}`,
    requirement_text: artifacts.analysis?.functional_requirements?.[index]?.text || story.title || 'Requirement',
    business_rule_id: `BR-${String(index + 1).padStart(3, '0')}`,
    business_rule: artifacts.analysis?.functional_requirements?.[index]?.text || story.title || 'Business rule',
    acceptance_criteria: (story.acceptance_criteria || []).map(criterion => ({id:criterion.id, test_cases:(artifacts.tests?.test_cases || []).filter(test => (test.source_acceptance_criterion || test.criterion_id) === criterion.id).map(test => test.id), status:'Covered'})), artifact:'BACKLOG-001'
  }));
  const relationships = trace.relationships || fallback;
  const duplicateTargets = new Set((artifacts.ai_review?.findings || []).filter(finding => finding.category === 'Duplicate scenario').map(finding => finding.target));
  const missing = relationships.flatMap(item => item.acceptance_criteria.filter(criterion => !criterion.test_cases.length));
  return `<section class="traceability-summary"><div><p>TRACEABILITY COVERAGE</p><h2>${esc(trace.coverage || 'Pending validation')}</h2><span>${relationships.length} requirement relationship${relationships.length === 1 ? '' : 's'} · ${trace.test_count ?? 0} linked test cases</span></div><div class="traceability-actions"><button class="secondary" data-trace-explain>Explain relationship</button>${missing.length ? '<button class="primary" data-trace-review>Review gaps</button>' : ''}</div></section><section class="trace-tree">${relationships.map(item => `<article class="trace-requirement"><button data-trace-open="Requirement"><strong>${esc(item.requirement_id)}</strong><span>${esc(item.requirement_text)}</span></button><div class="trace-branch"><button data-trace-open="BRD"><b>${esc(item.business_rule_id)}</b><span>${esc(item.business_rule)}</span></button>${item.acceptance_criteria.map(criterion => { const linked = criterion.test_cases || []; const duplicate = linked.some(id => duplicateTargets.has(id)); const status = !linked.length ? 'missing' : duplicate ? 'duplicate' : 'covered'; return `<div class="trace-criterion ${status}"><button data-trace-open="Backlog"><strong>${esc(criterion.id)}</strong><span>${!linked.length ? 'No test linked' : `${linked.join(', ')} linked`}</span></button><em>${status === 'covered' ? 'Covered' : status === 'duplicate' ? 'Duplicate coverage' : 'Missing coverage'}</em>${!linked.length ? '<button class="secondary" data-trace-review>Review gap</button>' : `<button class="trace-test-link" data-trace-open="Tests">${linked.map(id => esc(id)).join(', ')}</button>`}</div>`; }).join('')}</div></article>`).join('') || '<p class="empty-copy">No persisted requirement-to-test relationships are available yet.</p>'}${trace.unlinked_test_cases?.length ? `<section class="unlinked-artifacts"><strong>Unlinked artifact</strong><span>${esc(trace.unlinked_test_cases.join(', '))} ${trace.unlinked_test_cases.length === 1 ? 'does' : 'do'} not map to a current acceptance criterion.</span><button class="secondary" data-trace-open="Tests">Inspect tests</button></section>` : ''}</section>`;
}

function artifact(vm) {
  const a = project.artifacts || {};
  const source = project.description || '';

  if (vm.selectedArtifact === 'Requirement') {
    return `<header class="artifact-head"><div><p>SOURCE REQUIREMENT</p><h1>Captured requirement</h1></div><button class="copy" data-copy="${esc(source)}">Copy</button></header>
      <div class="source-block rich-source">${esc(source || 'No source requirement is available.')}</div>`;
  }
  if (vm.selectedArtifact === 'Analysis') {
    const items = a.analysis?.functional_requirements || [];
    const sourceText = project.description || '';
    const groups = [
      ['Actors', /\b(users?|customers?|admins?|system)\b/i, 'No actor was explicitly identified.'],
      ['Business rules', /\b(must|only|cannot|unless|rule|within)\b/i, 'No explicit business rule was identified.'],
      ['Acceptance criteria', /\b(given|when|then|acceptance)\b/i, 'No explicit acceptance criterion was identified.'],
      ['Dependencies', /\b(api|integration|service|database|dependency)\b/i, 'No dependency was explicitly identified.'],
      ['Ambiguities', /\b(tbd|maybe|somehow|etc\.)\b/i, 'No ambiguity signal was detected.']
    ];
    const details = groups.map(([name, pattern, fallback]) => `<article><strong>${name}</strong><span>${pattern.test(sourceText) ? items.filter(item => pattern.test(item.text)).map(item => item.text).join(' · ') || 'Relevant detail detected in the source requirement.' : fallback}</span></article>`).join('');
    const questions = (project.orchestration_runs || []).filter(run => run.agent === 'requirement' && run.status === 'completed').flatMap(run => run.result?.questions || []);
    const risks = riskResults();
    return `${artifactHeader('REQUIREMENT ANALYSIS', 'Structured requirement analysis', a.analysis, sourceText)}<section class="analysis-record"><div class="structured-grid">${details}</div><section class="open-questions"><strong>Open questions</strong>${questions.length ? `<ul>${questions.map(question => `<li>${esc(question.question)}</li>`).join('')}</ul>` : '<span>No persisted open questions were recorded.</span>'}</section>${risks.length ? `<section class="risk-record"><strong>Risk findings</strong>${risks.map(risk => `<article><b>${esc(risk.severity)}</b><div><h3>${esc(risk.risk)}</h3><span><em>Reason</em> Detected from the captured requirement.</span><span><em>Affected requirement</em> ${esc(project.public_id)}</span><span><em>Suggested mitigation</em> ${esc(risk.mitigation)}</span></div></article>`).join('')}</section>` : ''}</section>`;
  }
  if (vm.selectedArtifact === 'BRD') {
    const scope = a.brd?.scope_in || [];
    return `${artifactHeader('BRD', 'Business requirements', a.brd, scope.join('\n'), 'brd')}<div class="card-grid">${scope.map((text, i) => sourceCard(`REQ-${String(i + 1).padStart(3, '0')}`, `Business requirement ${i + 1}`, text, artifactStatus(a.brd))).join('') || '<p class="empty-copy">No BRD scope is available.</p>'}</div>`;
  }
  if (vm.selectedArtifact === 'Backlog') {
    const stories = a.backlog?.stories || [];
    return `${artifactHeader('BACKLOG', 'Delivery backlog', a.backlog, JSON.stringify(stories, null, 2), 'backlog')}<div class="card-grid">${stories.map(x => sourceCard(x.id, x.title || 'User story', (x.acceptance_criteria || []).map(c => c.then || c.id).join(' • '), `${(x.acceptance_criteria || []).length} criteria · ${artifactStatus(a.backlog)}`)).join('') || '<p class="empty-copy">No backlog stories are available.</p>'}</div>`;
  }
  if (vm.selectedArtifact === 'Tests') {
    const tests = a.tests?.test_cases || [];
    return `${artifactHeader('QA TEST CASES', 'Generated test coverage', a.tests, JSON.stringify(tests, null, 2))}${reviewFindingsPanel(a.ai_review)}<div class="test-case-list">${tests.map(test => `<article class="test-case"><header><div><p>${esc(test.id)}</p><h2>${esc(test.title || `${test.type || 'Test'} coverage`)}</h2></div><span>${esc(test.category || test.type || 'Test')}</span></header><dl><div><dt>Preconditions</dt><dd>${esc((test.preconditions || ['No preconditions were recorded.']).join(' '))}</dd></div><div><dt>Steps</dt><dd><ol>${(test.steps || ['No detailed steps were recorded.']).map(step => `<li>${esc(step)}</li>`).join('')}</ol></dd></div><div><dt>Expected result</dt><dd>${esc(test.expected_result || 'No expected result was recorded.')}</dd></div><div><dt>Coverage</dt><dd>${esc(test.coverage || 'Mapped')}</dd></div><div><dt>Source acceptance criterion</dt><dd>${esc(test.source_acceptance_criterion || test.criterion_id || 'Not recorded')}</dd></div><div><dt>Generated by</dt><dd>${esc(test.generated_by || 'QA Agent')}</dd></div></dl><details><summary>Review metadata</summary><p>${esc(artifactStatus(a.tests))} · version ${esc(a.tests?.version || 1)}</p></details></article>`).join('') || '<p class="empty-copy">No tests are available.</p>'}</div>`;
  }
  if (vm.selectedArtifact === 'Traceability') return `${artifactHeader('TRACEABILITY', 'Requirement-to-artifact coverage', a.traceability)}${traceabilityTree(a)}`;
  if (vm.selectedArtifact === 'Traceability') {
    return `<header class="artifact-head"><div><p>VALIDATION REPORT</p><h1>Traceability</h1></div></header>
      <div class="trace-path"><b>REQ</b><i>→</i><b>STORY</b><i>→</i><b>AC</b><i>→</i><b>TEST</b></div>
      <p class="coverage">${esc(a.traceability?.coverage || 'Coverage unavailable')} coverage · ${a.traceability?.test_count ?? '—'} tests linked</p>`;
  }
  if (!vm.qaReadiness) {
    return `<div class="blocked-view"><p>QA HANDOFF</p><h1>QA handoff is not ready</h1><span>Complete the following before the QA package can be created:</span>
      <ul>${vm.blockingIssues.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      <button class="primary" data-next>${esc(vm.nextAction.label)} <i>→</i></button></div>`;
  }
  return qaArtifact(vm);
}

function auditSummary() {
  const labels = {
    requirement_captured:'Requirement captured', analysis_completed:'Analysis completed', brd_generated:'BRD generated',
    brd_awaiting_approval:'BRD ready for approval', brd_approved:'BRD approved', brd_rejected:'BRD rejected',
    backlog_generated:'Backlog generated', backlog_awaiting_approval:'Backlog ready for approval', backlog_approved:'Backlog approved',
    backlog_rejected:'Backlog rejected', tests_generated:'Tests generated', traceability_validated:'Traceability validated',
    qa_handoff_ready:'QA handoff created', workflow_completed:'Workflow completed'
  };
  const events = (project.audit_events || []).slice().reverse();
  if (!events.length) return '<p class="empty-copy">No audit events have been recorded yet.</p>';
  const latest = events.slice(0, 5);
  return `<div class="audit-summary"><div><strong>${events.length} workflow events</strong><span>Latest: ${esc(labels[events[0].action] || events[0].action.replaceAll('_', ' '))} · ${time(events[0].timestamp)}</span></div>
    <details><summary>View audit history</summary><ol>${latest.map(e => `<li><b>${e.action.includes('rejected') ? '!' : '✓'}</b><div><strong>${esc(labels[e.action] || e.action.replaceAll('_', ' '))}</strong><span>${esc(e.actor || 'System')} · ${time(e.timestamp)}${e.artifact_version ? ` · v${e.artifact_version}` : ''}</span></div></li>`).join('')}</ol></details></div>`;
}

function actionControl(vm) {
  const n = vm.nextAction;
  if (n.nextScenario) return `<button class="primary" data-next-scenario>${n.label} <i>→</i></button>`;
  if (n.reset) return `<button class="primary" data-reset>${n.label}</button>`;
  if (n.approve) return `<input id="reviewer" placeholder="Reviewer name" aria-label="Reviewer name"><button class="primary" data-approve="${n.approve}">${n.label} <i>→</i></button><button class="secondary" data-reject="${n.approve}">Request changes</button>`;
  return `<button class="primary" data-run="${n.path}">${n.label} <i>→</i></button>`;
}

function elapsed(run) {
  if (!run?.started_at) return 'Not started';
  if (!run.completed_at) return 'Running now';
  const seconds = Math.max(0, Math.round((new Date(run.completed_at) - new Date(run.started_at)) / 1000));
  return seconds < 1 ? 'Completed in under 1s' : `Completed in ${seconds}s`;
}

function executionTimeline(vm) {
  const standard = project.agent_runs || [];
  const orchestration = project.orchestration_runs || [];
  const latest = (runs, agent) => runs.find(run => run.agent === agent);
  const analysis = latest(standard.slice().reverse(), 'analysis');
  const risk = latest(orchestration, 'risk');
  const tests = latest(standard.slice().reverse(), 'tests');
  const review = latest(orchestration, 'review');
  const artifact = latest(standard.slice().reverse(), 'qa_handoff');
  const approvalState = project.state.includes('AWAITING_APPROVAL') ? 'review' : (['BRD_APPROVED', 'BACKLOG_APPROVED', 'COMPLETED'].includes(project.state) ? 'completed' : 'waiting');
  const stateFor = (run, fallback = 'waiting') => run?.status === 'completed' ? 'completed' : run?.status === 'running' ? 'running' : run?.status === 'failed' ? 'failed' : fallback;
  const resultSummary = run => {
    if (!run) return 'Waiting for its workflow dependency.';
    if (run.error) return run.error;
    if (run.result?.risks?.length) return `${run.result.risks.length} recorded risk finding${run.result.risks.length === 1 ? '' : 's'}.`;
    if (run.result?.findings?.length) return `${run.result.findings.length} readiness gap${run.result.findings.length === 1 ? '' : 's'} need review.`;
    return run.output_artifact ? `Produced ${run.output_artifact}.` : 'Completed output recorded.';
  };
  const nodes = [
    {id:'requirement', title:'Requirement', role:'Captured workflow input', state:project.state === 'DRAFT' ? 'waiting' : 'completed', activity:project.state === 'DRAFT' ? 'Waiting for a requirement' : 'Requirement saved', summary:project.description || 'Workflow requirement'},
    {id:'analysis', title:'Requirements Agent', role:'Structures the captured requirement', state:stateFor(analysis, project.state === 'FAILED' ? 'failed' : 'waiting'), activity:analysis?.status === 'running' ? 'Analyzing requirement structure' : 'Maps requirement statements', summary:resultSummary(analysis), run:analysis},
    {id:'risk', title:'Risk Agent', role:'Finds risk and edge-case signals', state:stateFor(risk), activity:risk?.status === 'running' ? 'Reviewing risk signals' : 'Checks edge cases', summary:resultSummary(risk), run:risk},
    {id:'qa', title:'QA Agent', role:'Generates test scenarios', state:stateFor(tests), activity:tests?.status === 'running' ? 'Generating test scenarios' : 'Maps acceptance criteria to tests', summary:resultSummary(tests), run:tests},
    {id:'review', title:'Review Agent', role:'Assesses requirement readiness', state:stateFor(review), activity:review?.status === 'running' ? 'Reviewing workflow readiness' : 'Prepares findings for human review', summary:resultSummary(review), run:review},
    {id:'approval', title:'Human approval', role:'Required governance decision', state:approvalState, activity:approvalState === 'review' ? 'Approval required' : approvalState === 'completed' ? 'Approval recorded' : 'Waiting for review stage', summary:approvalState === 'review' ? vm.nextAction.detail : 'No approval is currently pending.'},
    {id:'artifact', title:'QA-ready artifact', role:'Traceable QA handoff', state:stateFor(artifact, project.state === 'COMPLETED' ? 'completed' : 'waiting'), activity:artifact?.status === 'running' ? 'Preparing QA handoff' : project.state === 'COMPLETED' ? 'Artifact ready' : 'Waiting for validated traceability', summary:resultSummary(artifact), run:artifact}
  ];
  return `<section class="audit execution-timeline"><div class="execution-head"><div><p>WORKFLOW EXECUTION</p><h2>Delivery timeline</h2><span>Each status is derived from persisted workflow and agent records.</span></div>${project.state === 'FAILED' ? '<button class="secondary" data-retry-workflow>Retry from requirement</button>' : ''}</div><div class="timeline-list">${nodes.map((node, index) => `<article class="timeline-node ${node.state}"><i class="timeline-connector ${index === nodes.length - 1 ? 'last' : ''}"></i><b>${node.state === 'completed' ? '✓' : node.state === 'running' ? '●' : node.state === 'failed' ? '!' : node.state === 'review' ? '◇' : '○'}</b><div class="timeline-copy"><div><strong>${esc(node.title)}</strong><em>${esc(node.state === 'review' ? 'Needs review' : node.state)}</em></div><span>${esc(node.role)} · ${esc(node.activity)}</span><small>${esc(node.summary)} ${node.run ? `· ${esc(elapsed(node.run))}` : ''}</small>${node.run ? `<details><summary>View recorded output</summary><p>Input: ${esc(node.run.input_artifact || 'Requirement context')}<br>Output: ${esc(node.run.output_artifact || node.run.result ? 'Stored agent result' : 'No output recorded')}</p></details>` : ''}</div></article>`).join('')}</div></section>`;
}

function activitySummary() {
  const runs = (project.agent_runs || []).slice().reverse();
  if (!runs.length) return '';
  return `<section class="audit agent-activity"><h2>Agent activity</h2><p>Every handoff is recorded for review.</p><div class="run-list">${runs.map(run => `<div class="run-row"><b>${run.status === 'completed' ? '✓' : '…'}</b><div><strong>${esc(run.agent.replaceAll('_', ' '))}</strong><span>${esc(run.input_artifact || 'Workflow input')} → ${esc(run.output_artifact || 'Processing')}</span></div><em class="${esc(run.status)}">${esc(run.status)}${run.completed_at ? ` · ${time(run.completed_at)}` : ''}</em></div>`).join('')}</div></section>`;
}

function metric(value) { return value === null ? '—' : esc(value); }

function setActiveNavigation(screen) {
  document.querySelectorAll('[data-library-view]').forEach(button => button.classList.toggle('active', button.dataset.libraryView === screen));
}

function stateLabel(state) { return String(state || 'DRAFT').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, char => char.toUpperCase()); }

async function showLibrary(screen = 'workflows') {
  libraryScreen = screen;
  setActiveNavigation(screen);
  $('creationView').hidden = true; $('workspaceView').hidden = true; $('libraryView').hidden = false;
  $('crumb').textContent = screen === 'workflows' ? 'Workflow library' : stateLabel(screen);
  $('libraryView').innerHTML = `<div class="library-loading">Loading ${esc(screen)}…</div>`;
  try {
    const [summaries, overview, reviews, dashboard] = await Promise.all([api('/api/projects'), api('/api/workspace/overview'), api('/api/reviews'), api('/api/dashboard')]);
    const projects = await Promise.all(summaries.map(async item => ({...(await api(`/api/projects/${item.public_id}`)), updated_at:item.updated_at, agent_run_count:item.agent_run_count})));
    renderLibrary(screen, projects, overview, reviews, dashboard);
  } catch (error) {
    $('libraryView').innerHTML = `<section class="empty-library"><h1>Unable to load this view</h1><p>${esc(error.message)}</p><button class="primary" data-library-retry>Try again</button></section>`;
    document.querySelector('[data-library-retry]').onclick = () => showLibrary(screen);
  }
}

function dashboardState(projectItem) {
  if (projectItem.state.includes('AWAITING_APPROVAL')) return {label:'Approval required', tone:'review'};
  if (projectItem.agent_runs?.some(run => run.status === 'running')) return {label:'AI analyzing', tone:'running'};
  if (projectItem.state === 'COMPLETED') return {label:'Artifact ready', tone:'ready'};
  if (projectItem.state === 'FAILED') return {label:'Needs attention', tone:'risk'};
  return {label:'In progress', tone:'running'};
}

function dashboardAction(projectItem) {
  const next = buildViewModel(projectItem, 'Requirement').nextAction;
  if (projectItem.state.includes('AWAITING_APPROVAL')) return 'Review approval';
  if (projectItem.state === 'COMPLETED') return 'Open QA handoff';
  if (projectItem.state === 'TESTS_GENERATED') return 'Open traceability';
  return next.label || 'Resume workflow';
}

function dashboardCard(projectItem, detail = '') {
  const state = dashboardState(projectItem);
  return `<article class="operations-card"><div><span class="operations-kicker ${state.tone}">${esc(state.label)}</span><h3>${esc(projectItem.name)}</h3><p>${esc(detail || buildViewModel(projectItem, 'Requirement').nextAction.detail)}</p></div><button class="secondary" data-dashboard-open="${esc(projectItem.public_id)}">${esc(dashboardAction(projectItem))}</button></article>`;
}

function renderOperationalDashboard(projects, dashboard) {
  const sorted = projects.slice().sort((a, b) => String(b.updated_at || b.created_at).localeCompare(String(a.updated_at || a.created_at)));
  const active = sorted.filter(item => !['DRAFT', 'COMPLETED', 'FAILED'].includes(item.state));
  const reviews = sorted.filter(item => item.state.includes('AWAITING_APPROVAL'));
  const ready = sorted.filter(item => item.state === 'COMPLETED');
  const riskInsights = sorted.flatMap(item => (item.orchestration_runs || []).filter(run => run.agent === 'risk' && run.status === 'completed').flatMap(run => (run.result?.risks || []).map(risk => ({project:item, risk}))));
  const coverageGaps = sorted.filter(item => item.state === 'TESTS_GENERATED' || (item.artifacts?.traceability && !item.artifacts.traceability.valid));
  const continueItem = active.find(item => !item.state.includes('AWAITING_APPROVAL')) || reviews[0] || sorted[0];
  const body = `<header class="library-header dashboard-header"><div><p>FLOWPILOT WORKSPACE</p><h1>Operational workspace</h1><span>Continue delivery work, resolve approvals, and review evidence from one place.</span></div><button class="primary" data-library-new>New workflow <i>→</i></button></header>
    <section class="workspace-metrics" aria-label="Workspace overview"><div><span>All workflows</span><b>${dashboard.metrics.total || 0}</b></div><div><span>Active</span><b>${dashboard.metrics.active || 0}</b></div><div><span>Approval required</span><b>${dashboard.metrics.awaiting_review || 0}</b></div><div><span>Artifacts ready</span><b>${dashboard.metrics.completed || 0}</b></div></section>
    ${continueItem ? `<section class="continue-work"><div><p>CONTINUE WHERE YOU LEFT OFF</p><h2>${esc(continueItem.name)}</h2><span>${esc(buildViewModel(continueItem, 'Requirement').nextAction.detail)}</span></div><button class="primary" data-dashboard-open="${esc(continueItem.public_id)}">${esc(dashboardAction(continueItem))} <i>→</i></button></section>` : `<section class="empty-library"><h1>Start your first workflow</h1><p>Capture a requirement and FlowPilot will guide the reviewed path to QA evidence.</p><button class="primary" data-library-new>New workflow <i>→</i></button></section>`}
    <div class="operations-grid"><section><div class="operations-heading"><div><p>ACTIVE DELIVERY</p><h2>What is moving</h2></div><span>${active.length}</span></div>${active.length ? active.slice(0, 3).map(item => dashboardCard(item)).join('') : '<p class="empty-copy">No active workflow is currently running.</p>'}</section><section><div class="operations-heading"><div><p>HUMAN DECISIONS</p><h2>Needs your attention</h2></div><span>${reviews.length}</span></div>${reviews.length ? reviews.slice(0, 3).map(item => dashboardCard(item, `Review the ${item.state.startsWith('BRD') ? 'BRD' : 'backlog'} before the workflow can continue.`)).join('') : '<p class="empty-copy">No approvals are waiting.</p>'}</section></div>
    <div class="operations-grid"><section><div class="operations-heading"><div><p>AI FINDINGS</p><h2>Unresolved risks</h2></div><span>${riskInsights.length}</span></div>${riskInsights.length ? riskInsights.slice(0, 3).map(({project: item, risk}) => `<article class="insight-row"><b>${esc(risk.severity)}</b><div><strong>${esc(risk.risk)}</strong><span>${esc(risk.mitigation)}</span></div><button class="secondary" data-dashboard-open="${esc(item.public_id)}">Review finding</button></article>`).join('') : '<p class="empty-copy">No recorded risk findings yet. Run the agent workflow on a captured requirement to review risks.</p>'}</section><section><div class="operations-heading"><div><p>QA EVIDENCE</p><h2>Coverage and artifacts</h2></div><span>${ready.length}</span></div>${coverageGaps.length ? coverageGaps.slice(0, 2).map(item => dashboardCard(item, 'Coverage needs traceability validation before the QA handoff can be created.')).join('') : ready.length ? ready.slice(0, 2).map(item => dashboardCard(item, 'QA-ready artifact is available with approved traceability.')).join('') : '<p class="empty-copy">QA artifacts will appear after approved backlog, generated tests, and traceability validation.</p>'}</section></div>
    <section class="event-feed dashboard-feed"><div class="operations-heading"><div><p>RECENT WORKFLOWS</p><h2>Latest activity</h2></div></div>${sorted.length ? sorted.slice(0, 5).map(item => `<button class="event-row" data-dashboard-open="${esc(item.public_id)}"><b>›</b><div><strong>${esc(item.name)}</strong><span>${esc(dashboardState(item).label)} · updated ${time(item.updated_at || item.created_at)}</span></div><em>${esc(item.public_id)}</em></button>`).join('') : ''}</section>`;
  $('libraryView').innerHTML = body;
  document.querySelectorAll('[data-dashboard-open]').forEach(button => button.onclick = async () => { project = await api(`/api/projects/${button.dataset.dashboardOpen}`); view = project.state === 'COMPLETED' ? 'QA Handoff' : 'Requirement'; render(); });
  document.querySelectorAll('[data-library-new]').forEach(button => button.onclick = () => reset());
}

function renderLibrary(screen, projects, overview, reviews = [], dashboard = {metrics:{},recent:[]}) {
  if (screen === 'dashboard') return renderOperationalDashboard(projects, dashboard);
  const completed = projects.filter(item => item.state === 'COMPLETED');
  const withTraceability = projects.filter(item => item.artifacts?.traceability?.valid);
  const auditEvents = projects.flatMap(item => (item.audit_events || []).map(event => ({...event, project:item}))).sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
  let body = '';
  if (screen === 'dashboard') {
    body = `<section class="workspace-metrics" aria-label="Dashboard metrics"><div><span>All workflows</span><b>${dashboard.metrics.total || 0}</b></div><div><span>Active</span><b>${dashboard.metrics.active || 0}</b></div><div><span>Needs review</span><b>${dashboard.metrics.awaiting_review || 0}</b></div><div><span>Completed</span><b>${dashboard.metrics.completed || 0}</b></div></section><section class="event-feed dashboard-feed"><h2>Recent workflows</h2>${dashboard.recent.length ? dashboard.recent.map(item => `<button class="event-row" data-open-project="${esc(item.public_id)}"><b>›</b><div><strong>${esc(item.name)}</strong><span>${esc(stateLabel(item.state))} · ${time(item.created_at)}</span></div><em>${esc(item.public_id)}</em></button>`).join('') : '<p class="empty-copy">Create a workflow to see activity here.</p>'}</section>`;
  } else if (screen === 'reviews') {
    body = reviews.length ? `<section class="event-feed">${reviews.map(item => `<button class="event-row" data-open-project="${esc(item.public_id)}"><b>◇</b><div><strong>${esc(item.artifact_type.toUpperCase())} review needed</strong><span>${esc(item.name)} · waiting since ${time(item.created_at)}</span></div><em>${esc(item.public_id)}</em></button>`).join('')}</section>` : `<section class="empty-library"><h1>Review inbox is clear</h1><p>Approval gates waiting for a decision will appear here.</p></section>`;
  } else if (screen === 'workflows') {
    body = projects.length ? `<div class="library-toolbar"><label for="librarySearch">Search workflows</label><input id="librarySearch" type="search" placeholder="Search by title, ID, or status" autocomplete="off"><span id="librarySearchCount">${projects.length} shown</span></div><div class="library-grid">${projects.map(item => `<button class="workflow-library-card" data-open-project="${esc(item.public_id)}" data-library-search="${esc(`${item.public_id} ${item.name} ${item.description} ${item.state}`.toLowerCase())}"><div><span class="library-kicker">${esc(item.public_id)}</span><h2>${esc(item.name)}</h2><p>${esc(item.description || 'No requirement captured yet.')}</p></div><div class="library-card-foot"><span class="state-pill ${item.state === 'COMPLETED' ? 'done' : ''}">${esc(stateLabel(item.state))}</span><span>Updated ${time(item.updated_at || item.created_at)}</span></div></button>`).join('')}</div>` : `<section class="empty-library"><h1>Start your first workflow</h1><p>Capture a requirement to create traceable QA evidence.</p><button class="primary" data-library-new>New workflow <i>→</i></button></section>`;
  } else if (screen === 'traceability') {
    body = withTraceability.length ? `<div class="library-grid">${withTraceability.map(item => { const trace = item.artifacts.traceability; return `<button class="workflow-library-card trace-card" data-open-project="${esc(item.public_id)}"><div><span class="library-kicker">${esc(item.public_id)} · TRACEABILITY</span><h2>${esc(item.name)}</h2><p>${trace.criteria_count} criteria linked to ${trace.test_count} tests.</p></div><div class="trace-meter"><b>${esc(trace.coverage || 'Validated')}</b><span>Coverage</span></div></button>`; }).join('')}</div>` : `<section class="empty-library"><h1>No validated traceability yet</h1><p>Complete the workflow through test generation to see requirement-to-test coverage here.</p></section>`;
  } else if (screen === 'handoffs') {
    body = completed.length ? `<div class="library-grid">${completed.map(item => `<button class="workflow-library-card handoff-card" data-open-project="${esc(item.public_id)}"><div><span class="library-kicker">QA HANDOFF · READY</span><h2>${esc(item.name)}</h2><p>Approved evidence package ready for QA review.</p></div><span class="handoff-arrow">→</span></button>`).join('')}</div>` : `<section class="empty-library"><h1>No QA handoffs ready</h1><p>Completed workflows will appear here as shareable QA packages.</p></section>`;
  } else {
    body = auditEvents.length ? `<section class="event-feed">${auditEvents.map(event => `<button class="event-row" data-open-project="${esc(event.project.public_id)}"><b>${event.action.includes('rejected') ? '!' : '✓'}</b><div><strong>${esc(event.action.replaceAll('_', ' '))}</strong><span>${esc(event.project.name)} · ${esc(event.actor || 'System')} · ${time(event.timestamp)}</span></div><em>${esc(event.project.public_id)}</em></button>`).join('')}</section>` : `<section class="empty-library"><h1>No recorded activity</h1><p>Workflow decisions and agent handoffs will appear here.</p></section>`;
  }
  const title = {dashboard:'Workspace dashboard', workflows:'Workflow library', reviews:'Review inbox', traceability:'Traceability center', handoffs:'QA handoffs', audit:'Audit history'}[screen];
  const metrics = screen === 'dashboard' ? '' : `<section class="workspace-metrics" aria-label="Workspace overview"><div><span>Workflows</span><b>${overview.total_workflows}</b></div><div><span>Active</span><b>${overview.active_workflows}</b></div><div><span>Needs review</span><b>${overview.awaiting_review}</b></div><div><span>QA ready</span><b>${overview.completed_workflows}</b></div></section>`;
  $('libraryView').innerHTML = `<header class="library-header"><div><p>FLOWPILOT WORKSPACE</p><h1>${title}</h1><span>${screen === 'workflows' ? `${projects.length} workflow${projects.length === 1 ? '' : 's'} in your local workspace` : 'A focused view of your governed delivery evidence.'}</span></div>${screen === 'workflows' ? '<button class="primary" data-library-new>New workflow <i>→</i></button>' : ''}</header>${metrics}${body}`;
  document.querySelectorAll('[data-open-project]').forEach(button => button.onclick = async () => { project = await api(`/api/projects/${button.dataset.openProject}`); view = 'Requirement'; render(); });
  document.querySelectorAll('[data-library-new]').forEach(button => button.onclick = () => reset());
  $('librarySearch')?.addEventListener('input', event => {
    const query = event.target.value.trim().toLowerCase(); let visible = 0;
    document.querySelectorAll('[data-library-search]').forEach(card => { const matches = card.dataset.librarySearch.includes(query); card.hidden = !matches; if (matches) visible += 1; });
    $('librarySearchCount').textContent = `${visible} shown`;
  });
}

function render() {
  const vm = buildViewModel(project, view);
  view = vm.selectedArtifact;
  remember(project);
  $('creationView').hidden = true;
  $('workspaceView').hidden = false;
  $('libraryView').hidden = true;
  setActiveNavigation('workflows');
  $('crumb').textContent = project.public_id;
  status(vm.qaReadiness === 'Ready' ? 'Ready' : vm.workflowState.includes('AWAITING') ? 'Awaiting review' : 'Workflow active');
  sidebar(vm);
  const assignmentType = project.state === 'BRD_AWAITING_APPROVAL' ? 'brd' : project.state === 'BACKLOG_AWAITING_APPROVAL' ? 'backlog' : null;
  const assignment = assignmentType ? (project.review_assignments || []).find(item => item.artifact_type === assignmentType) : null;

  $('workspaceView').innerHTML = `
    <section class="workspace-header">
      <div><p>WORKFLOW WORKSPACE</p><h1>${vm.qaReadiness === 'Ready' ? 'Ready for QA' : esc(vm.currentStage)}</h1><span>${esc(vm.nextAction.detail)}</span></div>
      <div class="workspace-actions"><button class="secondary" data-automation ${vm.workflowState.includes('AWAITING') || vm.qaReadiness === 'Ready' ? 'disabled' : ''}>Run until approval</button><span class="readiness ${vm.qaReadiness.toLowerCase().replaceAll(' ', '-')}">${vm.qaReadiness}</span></div>
    </section>

    <section class="workflow-stepper" aria-label="Workflow progress">
      ${vm.stageStatuses.map((s, i) => `<button class="step ${s.status}" data-step="${i}" title="${esc(s.label)}: ${s.status}"><b>${s.status === 'complete' ? '✓' : s.status === 'review' ? '◆' : s.status === 'blocked' ? '⌁' : s.status === 'failed' ? '!' : '●'}</b><span>${esc(s.label)}</span></button>${i < vm.stageStatuses.length - 1 ? `<i class="step-line ${i < stateRank(vm.workflowState) ? 'filled' : ''}"></i>` : ''}`).join('')}
    </section>

    <div class="workspace-layout">
      <section class="workspace-main">
        ${executionTimeline(vm)}
        <section class="audit orchestration-panel"><div class="orchestration-head"><div><p>FLOWPILOT ORCHESTRATION</p><h2>Agent plan</h2></div><div class="orchestration-actions"><button class="secondary" data-load-plan>Refresh</button><button class="primary" data-run-all-agents>Run agent workflow</button></div></div><div id="orchestrationPlan" class="empty-copy">Loading the specialized agent workflow…</div></section>
        <nav class="artifact-tabs" aria-label="Artifacts">${tabs.map(x => `<button data-artifact="${x}" class="${view === x ? 'selected' : ''}" ${vm.available[x] ? '' : 'disabled'}>${x}</button>`).join('')}</nav>
        <article class="artifact-view">${artifact(vm)}</article>
        <section class="audit">${auditSummary()}</section>
        <section class="audit review-comments"><h2>Review comments</h2><div class="comment-list">${(project.comments || []).filter(comment => comment.artifact_type === view.toLowerCase().replace(' ', '_')).map(comment => `<article><strong>${esc(comment.author)}</strong><span>${time(comment.created_at)}</span><p>${esc(comment.body)}</p></article>`).join('') || '<p class="empty-copy">No comments on this artifact yet.</p>'}</div><form id="commentForm"><input id="commentAuthor" maxlength="120" placeholder="Your name" aria-label="Your name" required><textarea id="commentBody" maxlength="2000" placeholder="Add review feedback" aria-label="Review feedback" required></textarea><button class="secondary" type="submit">Add comment</button></form></section>
        ${activitySummary()}
      </section>

      <aside class="context-rail">
        <section class="status-card"><p>WORKFLOW STATUS</p><h2>${esc(vm.currentStage)}</h2><span>${esc(vm.nextAction.detail)}</span></section>
        <section><p>COVERAGE</p><div class="metrics">
          <span><b>${metric(vm.coverage.requirements)}</b>Requirements</span>
          <span><b>${metric(vm.coverage.stories)}</b>Stories</span>
          <span><b>${metric(vm.coverage.criteria)}</b>Criteria</span>
          <span><b>${metric(vm.coverage.tests)}</b>Tests</span>
          <span class="wide"><b>${metric(vm.coverage.traceability)}</b>Traceability</span>
        </div></section>
        <section><p>NEXT ACTION</p><h2>${esc(vm.nextAction.label)}</h2>${actionControl(vm)}</section>
        ${assignmentType ? `<section class="assignment-card"><p>REVIEW OWNER</p><strong>${esc(assignment?.reviewer || 'Unassigned')}</strong><form id="assignmentForm"><input id="assignmentReviewer" maxlength="120" value="${esc(assignment?.reviewer || '')}" placeholder="Assign reviewer" aria-label="Assign reviewer"><button class="secondary" type="submit">Save assignment</button></form></section>` : ''}
      </aside>
    </div>`;

  bindWorkspace(vm);
  initPointerGlow();
  requestAnimationFrame(() => document.querySelectorAll('.reveal-card').forEach((el, i) => setTimeout(() => el.classList.add('shown'), i * 55)));
}

function bindWorkspace(vm) {
  document.querySelectorAll('[data-artifact]').forEach(button => button.onclick = () => { view = button.dataset.artifact; render(); });
  document.querySelectorAll('[data-open-artifact]').forEach(button => button.onclick = () => { view = button.dataset.openArtifact; render(); });
  document.querySelectorAll('[data-step]').forEach(button => button.onclick = () => {
    const stage = vm.stageStatuses[Number(button.dataset.step)];
    const target = stage.label.replace(' approval', '');
    if (vm.available[target]) { view = target; render(); }
    else status(`${stage.label} is blocked until ${vm.nextAction.label.toLowerCase()}.`);
  });
  document.querySelector('[data-copy]')?.addEventListener('click', e => navigator.clipboard?.writeText(e.currentTarget.dataset.copy).then(() => toast('Copied to clipboard', 'success')).catch(() => toast('Copy is unavailable in this browser.', 'error')));
  document.querySelector('[data-copy-summary]')?.addEventListener('click', () => copySummary(vm));
  document.querySelector('[data-download]')?.addEventListener('click', () => downloadHandoff(vm));
  document.querySelectorAll('[data-run]').forEach(button => button.onclick = () => run(button.dataset.run));
  document.querySelectorAll('[data-approve]').forEach(button => button.onclick = () => openReviewDialog(button.dataset.approve, true));
  document.querySelectorAll('[data-reject]').forEach(button => button.onclick = () => openReviewDialog(button.dataset.reject, false));
  document.querySelectorAll('[data-automation]').forEach(button => button.onclick = runAutomation);
  document.querySelectorAll('[data-next]').forEach(button => button.onclick = () => vm.nextAction.path ? run(vm.nextAction.path) : render());
  document.querySelectorAll('[data-reset]').forEach(button => button.onclick = reset);
  document.querySelectorAll('[data-next-scenario]').forEach(button => button.onclick = openNextScenario);
  document.querySelectorAll('[data-retry-workflow]').forEach(button => button.onclick = () => run('retry'));
  document.querySelectorAll('[data-edit-artifact]').forEach(button => button.onclick = () => { $('commentBody')?.focus(); $('commentBody')?.scrollIntoView({behavior:'smooth', block:'center'}); });
  document.querySelectorAll('[data-run-artifact-review]').forEach(button => button.onclick = async () => { button.disabled = true; button.textContent = 'Reviewing outputs…'; try { await api(`/api/projects/${project.public_id}/review/run`, {}); project = await api(`/api/projects/${project.public_id}`); render(); toast('Review findings recorded', 'success'); } catch (error) { toast(error.message || 'Unable to review generated outputs.', 'error'); button.disabled = false; button.textContent = 'Run review'; } });
  document.querySelectorAll('[data-remediate-finding]').forEach(button => button.onclick = async () => { button.disabled = true; try { await api(`/api/projects/${project.public_id}/review/remediate`, {finding_id:button.dataset.remediateFinding}); project = await api(`/api/projects/${project.public_id}`); render(); toast('Targeted remediation created a new test version', 'success'); } catch (error) { toast(error.message || 'This finding needs human review.', 'error'); button.disabled = false; } });
  document.querySelectorAll('[data-trace-open]').forEach(button => button.onclick = () => { view = button.dataset.traceOpen; render(); });
  document.querySelectorAll('[data-trace-review]').forEach(button => button.onclick = () => { view = 'Tests'; render(); window.setTimeout(() => document.querySelector('[data-run-artifact-review]')?.focus(), 0); });
  document.querySelectorAll('[data-trace-explain]').forEach(button => button.onclick = () => { toggleChat(true); askChat('Explain the current traceability relationship and any coverage gaps.'); });
  $('commentForm')?.addEventListener('submit', async event => { event.preventDefault(); try { await api(`/api/projects/${project.public_id}/comments`, {artifact_type:view.toLowerCase().replace(' ', '_'), author:$('commentAuthor').value.trim(), body:$('commentBody').value.trim()}); project = await api(`/api/projects/${project.public_id}`); render(); toast('Comment added', 'success'); } catch (error) { toast(error.message || 'Unable to add comment.', 'error'); } });
  $('assignmentForm')?.addEventListener('submit', async event => { event.preventDefault(); const artifactType = project.state === 'BRD_AWAITING_APPROVAL' ? 'brd' : 'backlog'; try { await api(`/api/projects/${project.public_id}/review-assignment`, {artifact_type:artifactType, reviewer:$('assignmentReviewer').value.trim()}); project = await api(`/api/projects/${project.public_id}`); render(); toast('Reviewer assigned', 'success'); } catch (error) { toast(error.message || 'Unable to save assignment.', 'error'); } });
  document.querySelector('[data-load-plan]')?.addEventListener('click', loadOrchestrationPlan);
  document.querySelector('[data-run-all-agents]')?.addEventListener('click', runAllOrchestrationAgents);
  loadOrchestrationPlan();
}

async function loadOrchestrationPlan() {
  const target = $('orchestrationPlan'); if (!target || !project) return;
  target.textContent = 'Loading approved agent plan…';
  try { const plan = await api(`/api/projects/${project.public_id}/orchestration/plan`); target.innerHTML = `<div class="agent-plan">${plan.steps.map((step, index) => `<article><b>${String(index + 1).padStart(2,'0')}</b><div><strong>${esc(step.agent)} agent</strong><span>${esc(step.goal)}</span></div><button class="secondary" data-run-agent="${esc(step.agent)}">Run</button></article>`).join('')}</div>`; document.querySelectorAll('[data-run-agent]').forEach(button => button.onclick = () => runOrchestrationAgent(button.dataset.runAgent)); } catch (error) { target.textContent = error.message || 'Unable to load the agent plan.'; }
}

async function runOrchestrationAgent(agent) { const target = $('orchestrationPlan'); try { target.textContent = `Running ${agent} agent…`; const result = await api(`/api/projects/${project.public_id}/orchestration/${agent}/run`, {}); target.innerHTML = `<section class="agent-result"><strong>${esc(agent)} agent completed</strong><pre>${esc(JSON.stringify(result.result, null, 2))}</pre><div><button class="secondary" data-agent-feedback="true">Useful</button><button class="secondary" data-agent-feedback="false">Not useful</button></div></section>`; document.querySelectorAll('[data-agent-feedback]').forEach(button => button.onclick = async () => { await api(`/api/projects/${project.public_id}/orchestration/${agent}/feedback`, {useful:button.dataset.agentFeedback === 'true'}); toast('Feedback recorded', 'success'); }); } catch (error) { target.textContent = error.message || `Unable to run ${agent} agent.`; } }

async function runAllOrchestrationAgents() {
  const button = document.querySelector('[data-run-all-agents]'); const target = $('orchestrationPlan');
  if (button) button.disabled = true;
  try {
    target.textContent = 'Running the dependency-aware agent workflow…';
    const result = await api(`/api/projects/${project.public_id}/orchestration/run-all`, {});
    toast(`${result.executions.filter(item => item.status === 'completed').length} agent handoffs completed`, 'success');
    await loadOrchestrationPlan();
  } catch (error) { target.textContent = error.message || 'Unable to run the agent workflow.'; }
  finally { if (button) button.disabled = false; }
}

function agentReport(agent, result) {
  if (agent === 'requirement') {
    const missing = (result.dimensions || []).filter(item => item.status !== 'Good').map(item => item.dimension);
    const score = result.overall ?? result.score ?? '—';
    return `<section class="agent-result"><p>REQUIREMENT REVIEW</p><h3>Requirement quality: ${esc(score)}</h3><strong>${missing.length ? 'Add the missing details before implementation.' : 'The requirement has the expected detail.'}</strong>${missing.length ? `<ul>${missing.map(item => `<li>${esc(item)}</li>`).join('')}</ul>` : ''}</section>`;
  }
  if (agent === 'risk') {
    const risks = result.risks || [];
    return `<section class="agent-result"><p>RISK REVIEW</p><h3>${risks.length ? `${risks.length} risk${risks.length === 1 ? '' : 's'} need attention` : 'No specific risk signals found'}</h3>${risks.length ? `<ul>${risks.map(risk => `<li><strong>${esc(risk.severity)}:</strong> ${esc(risk.risk)}<span>${esc(risk.mitigation)}</span></li>`).join('')}</ul>` : '<span>Continue with normal review; add product-specific risks if needed.</span>'}</section>`;
  }
  const findings = result.findings || [];
  return `<section class="agent-result"><p>READINESS REVIEW</p><h3>${esc(result.status || 'Review complete')}</h3>${findings.length ? `<strong>Resolve these gaps with a reviewer:</strong><ul>${findings.map(item => `<li>${esc(item)}</li>`).join('')}</ul>` : '<span>The agent found no missing requirement dimensions. Human approval is still required at the workflow gates.</span>'}</section>`;
}

async function runOrchestrationAgent(agent) {
  const target = $('orchestrationPlan');
  try {
    target.textContent = `Running ${agent} agent…`;
    const run = await api(`/api/projects/${project.public_id}/orchestration/${agent}/run`, {});
    target.innerHTML = `${agentReport(agent, run.result)}<div class="agent-feedback"><span>Was this review useful?</span><button class="secondary" data-agent-feedback="true">Useful</button><button class="secondary" data-agent-feedback="false">Not useful</button><button class="secondary" data-load-plan>Back to agent plan</button></div>`;
    document.querySelectorAll('[data-agent-feedback]').forEach(button => button.onclick = async () => { await api(`/api/projects/${project.public_id}/orchestration/${agent}/feedback`, {useful: button.dataset.agentFeedback === 'true'}); toast('Feedback recorded', 'success'); });
    document.querySelector('[data-load-plan]')?.addEventListener('click', loadOrchestrationPlan);
    toast(`${agent} agent completed`, 'success');
  } catch (error) { target.textContent = error.message || `Unable to run ${agent} agent.`; }
}

function copySummary(vm) {
  const text = `FlowPilot QA Handoff\nProject: ${project.public_id}\nStatus: ${vm.qaReadiness}\nRequirements: ${vm.coverage.requirements ?? 'Unavailable'}\nStories: ${vm.coverage.stories ?? 'Unavailable'}\nTests: ${vm.coverage.tests ?? 'Unavailable'}\nTraceability: ${vm.coverage.traceability ?? 'Unavailable'}`;
  navigator.clipboard?.writeText(text).then(() => status('Summary copied'));
}

function downloadHandoff(vm) {
  const payload = {project_id:project.public_id, name:project.name, state:project.state, readiness:vm.qaReadiness, coverage:vm.coverage, artifacts:project.artifacts, audit_events:project.audit_events};
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${project.public_id}-qa-handoff.json`;
  link.click();
  URL.revokeObjectURL(url);
  status('QA handoff downloaded');
}

function openNextScenario() {
  $('nextScenarioDialog').showModal();
  $('nextScenarioSelect').focus();
}

function openReviewDialog(stage, approved) {
  pendingReview = {stage, approved};
  const reviewer = $('reviewer')?.value || '';
  $('reviewDialogReviewer').value = reviewer;
  $('reviewDialogReason').value = '';
  $('reviewDialogError').textContent = '';
  $('reviewDialogTitle').textContent = approved ? 'Approve artifact' : 'Request changes';
  $('reviewDialogCopy').textContent = approved ? 'Record who approved this handoff before the workflow continues.' : 'Describe what must change before this artifact is regenerated.';
  $('reviewDialogEyebrow').textContent = approved ? 'APPROVAL GATE' : 'CHANGE REQUEST';
  $('reviewReasonField').hidden = approved;
  $('reviewDialogReason').required = !approved;
  $('reviewDialogSubmit').textContent = approved ? 'Approve and continue' : 'Request changes';
  $('reviewDialog').showModal();
  $('reviewDialogReviewer').focus();
}

async function run(path, body = {}) {
  const controls = [...document.querySelectorAll('[data-run], [data-approve], [data-reject], [data-automation]')];
  controls.forEach(button => { button.disabled = true; });
  try {
    status('Processing');
    await api(`/api/projects/${project.public_id}/${path}`, body);
    project = await api(`/api/projects/${project.public_id}`);
    render();
  } catch (error) { status(`Failed: ${error.message}`); toast(error.message || 'That action could not be completed.', 'error'); controls.forEach(button => { button.disabled = false; }); }
}

async function runAutomation() {
  const automation = document.querySelector('[data-automation]');
  if (automation) automation.disabled = true;
  try {
    status('Running safe automation');
    for (let step = 0; step < 6; step += 1) {
      const result = await api(`/api/projects/${project.public_id}/automation/run-next`, {});
      project = await api(`/api/projects/${project.public_id}`);
      if (result.status === 'blocked' || result.status === 'idle' || project.state.includes('AWAITING')) break;
    }
    render();
  } catch (error) { status(`Automation stopped: ${error.message}`); toast(error.message || 'Automation stopped unexpectedly.', 'error'); if (automation) automation.disabled = false; }
}

function reset(prefill = '') {
  project = null;
  view = 'Requirement';
  $('workspaceView').hidden = true;
  $('libraryView').hidden = true;
  $('creationView').hidden = false;
  $('requirement').value = prefill;
  updateRequirementCount();
  $('formError').textContent = '';
  $('formProgress').hidden = true;
  document.querySelector('.form-foot').hidden = false;
  status('');
  $('sidebarWorkflows').innerHTML = '';
  $('requirement').focus();
  initPointerGlow();
}

function progress(index) {
  $('formProgress').hidden = false;
  $('formProgress').textContent = ['Creating project', 'Capturing requirement'][index] || 'Working';
  document.querySelector('.form-foot').hidden = true;
}

function initPointerGlow() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || window.matchMedia('(pointer: coarse)').matches) return;
  document.querySelectorAll('[data-pointer-glow]').forEach(surface => {
    if (surface.dataset.glowBound) return;
    surface.dataset.glowBound = 'true';
    let frame = 0;
    surface.addEventListener('pointermove', event => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = surface.getBoundingClientRect();
        surface.style.setProperty('--pointer-x', `${event.clientX - rect.left}px`);
        surface.style.setProperty('--pointer-y', `${event.clientY - rect.top}px`);
        surface.classList.add('pointer-active');
      });
    });
    surface.addEventListener('pointerleave', () => surface.classList.remove('pointer-active'));
  });
}

$('workflowForm').addEventListener('submit', async event => {
  event.preventDefault();
  const raw = $('requirement').value.trim();
  if (!raw) return;
  $('createWorkflow').disabled = true;
  $('clearForm').disabled = true;
  progress(0);
  try {
    const created = await api('/api/projects', {name:raw.slice(0, 80), description:raw, workspace_id:activeWorkspaceId || undefined});
    progress(1);
    await api(`/api/projects/${created.public_id}/requirements`, {raw_requirement:raw});
    project = await api(`/api/projects/${created.public_id}`);
    render();
  } catch (error) {
    $('formError').textContent = error.message;
    toast(error.message, 'error');
    $('createWorkflow').disabled = false;
    $('clearForm').disabled = false;
    $('formProgress').hidden = true;
    document.querySelector('.form-foot').hidden = false;
  }
});

$('clearForm').onclick = () => { $('requirement').value = ''; $('formError').textContent = ''; updateRequirementCount(); };
$('requirement').addEventListener('input', updateRequirementCount);
$('requirementVoice').onclick = () => startVoiceInput('requirement');
document.querySelectorAll('[data-prompt]').forEach(button => button.onclick = () => {
  const templates = {'Users & personas':'Users and personas:\n- Primary user: \n- Secondary user: ','Business rules':'Business rules:\n- ','Acceptance criteria':'Acceptance criteria:\n- Given \n- When \n- Then ','Expected outcome':'Expected outcome:\n- ','Constraints':'Constraints:\n- ','Edge cases':'Edge cases:\n- '};
  const area = $('requirement'); area.value = `${area.value.trim()}${area.value.trim() ? '\n\n' : ''}${templates[button.dataset.prompt]}`; area.focus(); updateRequirementCount();
});
$('aiImprove').onclick = async () => { const raw = $('requirement').value.trim(); if (raw.length < 8) { $('formError').textContent = 'Add a short requirement before requesting guidance.'; return; } const button = $('aiImprove'); button.disabled = true; button.textContent = '✦ Reviewing brief…'; $('formProgress').hidden = false; $('formProgress').textContent = 'Analyzing requirement readiness…'; try { requirementIntelligence = await api('/api/requirement-intelligence', {raw_requirement:raw}); const missing = requirementIntelligence.dimensions.filter(item => item.status !== 'Good').map(item => item.dimension).join(', ') || 'No major gaps'; $('aiSuggestion').querySelector('p').textContent = `FLOWPILOT GUIDANCE · ${requirementIntelligence.overall.toUpperCase()}`; $('aiSuggestion').querySelector('strong').textContent = missing; $('aiSuggestion').querySelector('span').textContent = requirementIntelligence.questions.map(item => item.question).join(' ') || 'The requirement includes the core readiness signals.'; $('aiSuggestion').hidden = false; } catch (error) { toast(error.message || 'Unable to analyze the requirement.', 'error'); } finally { $('formProgress').hidden = true; button.disabled = false; button.textContent = '✦ Review brief'; } };
$('dismissAiSuggestion').onclick = () => { $('aiSuggestion').hidden = true; };
$('applyAiSuggestion').onclick = () => { if (!requirementIntelligence?.proposed_requirement) return; const area = $('requirement'); area.value = `${area.value.trim()}\n\n${requirementIntelligence.proposed_requirement}`; $('aiSuggestion').hidden = true; updateRequirementCount(); toast('Proposed structure added for your review', 'success'); };
$('themeToggle').onclick = () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
$('sidebarToggle').onclick = () => { const collapsed = $('sidebar').classList.toggle('collapsed'); localStorage.setItem('flowpilot.sidebar-collapsed', String(collapsed)); $('sidebarToggle').textContent = collapsed ? '›' : '‹'; };
setTheme(localStorage.getItem('flowpilot.theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
if (localStorage.getItem('flowpilot.sidebar-collapsed') === 'true') $('sidebarToggle').click();
$('navNew').onclick = () => reset();
document.querySelectorAll('[data-library-view]').forEach(button => button.onclick = () => showLibrary(button.dataset.libraryView));
document.querySelectorAll('[data-quality-action]').forEach(button => button.onclick = () => document.querySelector(`[data-prompt="${button.dataset.qualityAction}"]`).click());
$('qualityTipAction').onclick = () => document.querySelector(`[data-prompt="${$('qualityTipAction').textContent === 'Add constraints' ? 'Constraints' : 'Acceptance criteria'}"]`).click();
document.querySelectorAll('[data-context-action]').forEach(button => button.onclick = () => toast(button.dataset.contextAction === 'agents' ? 'Agents are configured for the next workflow stage.' : 'Two human approval gates protect BRD and backlog handoffs.'));
$('requirement').addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') $('workflowForm').requestSubmit(); });
$('startNextScenario').onclick = () => {
  const selected = samples[$('nextScenarioSelect').value];
  $('nextScenarioDialog').close();
  reset(selected?.raw_requirement || '');
  if (selected) $('formHint').textContent = `Loaded “${selected.name}”. Review it before creating the workflow.`;
};
$('reviewDialogClose').onclick = () => $('reviewDialog').close();
$('reviewDialogCancel').onclick = () => $('reviewDialog').close();
$('reviewForm').addEventListener('submit', event => {
  event.preventDefault();
  if (!pendingReview) return;
  const reviewer = $('reviewDialogReviewer').value.trim();
  const reason = $('reviewDialogReason').value.trim();
  if (!reviewer || (!pendingReview.approved && !reason)) { $('reviewDialogError').textContent = 'Add your name and a reason before continuing.'; return; }
  const action = pendingReview.approved ? 'approve' : 'reject';
  $('reviewDialog').close();
  run(`${pendingReview.stage}/${action}`, {reviewer, reason});
  pendingReview = null;
});

$('chatToggle').onclick = () => toggleChat($('chatPanel').hidden);
$('chatClose').onclick = () => toggleChat(false);
$('chatNew').onclick = () => { chatConversationId = null; $('chatMessages').replaceChildren(); addChatMessage('New conversation started. How can I help?'); };
$('chatClear').onclick = async () => { if (chatConversationId && project) await fetch(`/api/projects/${project.public_id}/assistant/conversations/${chatConversationId}`, {method:'DELETE'}); $('chatNew').click(); };
$('chatForm').addEventListener('submit', event => { event.preventDefault(); const message = $('chatInput').value; $('chatInput').value = ''; askChat(message); });
$('chatVoice').onclick = () => startVoiceInput('chat');
$('chatInput').addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); $('chatForm').requestSubmit(); } if (event.key === 'Escape' && chatAbortController) chatAbortController.abort(); });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && voiceRecognition) stopVoiceInput();
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); toggleChat(true); }
});
document.querySelectorAll('[data-chat-question]').forEach(button => button.onclick = () => askChat(button.dataset.chatQuestion));
addChatMessage('Hi, I’m your workflow guide. Ask what to do next, or choose a quick question below.');

api('/api/samples').then(data => {
  samples = data;
  const options = '<option value="">Choose a sample</option>' + data.map((s, i) => `<option value="${i}">${esc(s.name)}</option>`).join('');
  $('sampleRequirement').innerHTML = options;
  $('nextScenarioSelect').innerHTML = '<option value="">Start blank</option>' + data.map((s, i) => `<option value="${i}">${esc(s.name)}</option>`).join('');
  $('sampleRequirement').onchange = event => {
    const sample = samples[event.target.value];
    if (sample) {
      $('requirement').value = sample.raw_requirement;
      updateRequirementCount();
      $('formHint').textContent = `Loaded “${sample.name}”. Review it before creating the workflow.`;
    }
  };
}).catch(error => $('formError').textContent = error.message);

function setAnalysisStages(active, complete = false) {
  const stages = $('analysisStages');
  if (!stages) return;
  stages.hidden = false;
  stages.querySelectorAll('li').forEach((item, index) => {
    item.classList.toggle('active', !complete && index === active);
    item.classList.toggle('complete', complete || index < active);
  });
}

function autoGrowRequirement() {
  const area = $('requirement');
  area.style.height = 'auto';
  area.style.height = `${Math.max(220, Math.min(area.scrollHeight, 520))}px`;
}

$('requirement').addEventListener('input', autoGrowRequirement);
autoGrowRequirement();

const clarificationTemplates = {
  'Acceptance Criteria': 'Acceptance criteria\n- Given a valid actor\n- When they perform the requested action\n- Then the expected outcome is recorded',
  'Edge Cases': 'Edge cases\n- Handle invalid input, duplicate submissions, expired requests, and unavailable dependencies.',
  'Security': 'Security and constraints\n- Define authorization, audit requirements, and applicable limits.'
};

function renderComposerIntelligence() {
  const text = $('requirement').value.trim().toLowerCase();
  const checks = [
    ['User persona', /\b(users?|customers?|admins?|system)\b/], ['Validation rule', /\b(must|only|cannot|unless|rule|within)\b/],
    ['Acceptance criteria', /\b(given|when|then|acceptance)\b/], ['Failure scenario', /\b(error|fail|invalid|duplicate|expired|retry|edge)\b/]
  ];
  const missing = checks.filter(([, pattern]) => !pattern.test(text)).map(([name]) => name);
  const panel = document.querySelector('.intelligence-rail');
  let details = $('composerIntelligence');
  if (!details) { details = document.createElement('section'); details.id = 'composerIntelligence'; panel.append(details); }
  details.innerHTML = `<p>FLOWPILOT INTELLIGENCE</p><h2>Requirement readiness</h2><div class="quality-list">${checks.map(([name]) => `<span>${esc(name)} <b>${missing.includes(name) ? 'Missing' : 'Present'}</b></span>`).join('')}</div><p class="intelligence-caption">${missing.length ? `Missing information: ${missing.join(', ')}.` : 'The current brief has the core deterministic readiness signals.'}</p><div class="preview-stages"><span>Requirement</span><i></i><span>Analysis</span><i></i><span>Review</span><i></i><span>QA handoff</span></div>`;
  const preview = $('workflowPreview');
  preview.querySelector('span').textContent = missing.length ? `${missing.length} area${missing.length === 1 ? '' : 's'} need clarification before the strongest handoff.` : 'The requirement is ready to create and progress through the governed workflow.';
}

function renderClarifications(intelligence) {
  const questions = intelligence.questions || [];
  const panel = $('clarificationPanel');
  if (!questions.length) { panel.hidden = true; return; }
  $('clarificationQuestions').innerHTML = questions.map(item => `<label><input type="checkbox" data-clarification="${esc(item.dimension)}" checked><span><strong>${esc(item.dimension)}</strong>${esc(item.question)}</span></label>`).join('');
  panel.hidden = false;
}

$('requirement').addEventListener('input', renderComposerIntelligence);
renderComposerIntelligence();

$('aiImprove').onclick = async () => {
  const raw = $('requirement').value.trim();
  if (raw.length < 8) { $('formError').textContent = 'Add a short requirement before requesting guidance.'; $('requirement').focus(); return; }
  const button = $('aiImprove');
  button.disabled = true; button.textContent = 'Reviewing requirement…';
  $('formProgress').hidden = false; $('formProgress').textContent = 'FlowPilot is checking the requirement structure.';
  setAnalysisStages(0);
  try {
    requirementIntelligence = await api('/api/requirement-intelligence', {raw_requirement:raw});
    setAnalysisStages(4, true);
    const missing = requirementIntelligence.dimensions.filter(item => item.status !== 'Good').map(item => item.dimension);
    $('aiSuggestion').querySelector('p').textContent = `FLOWPILOT SUGGESTION · ${requirementIntelligence.overall.toUpperCase()}`;
    $('aiSuggestion').querySelector('strong').textContent = missing.length ? `Before: ${missing.join(', ')} missing` : 'Before: core readiness signals detected';
    $('aiSuggestion').querySelector('span').textContent = `After applying selected additions: ${requirementIntelligence.proposed_requirement.slice(0, 180)}…`;
    $('applyAiSuggestion').textContent = 'Apply selected';
    $('aiSuggestion').hidden = false;
    renderClarifications(requirementIntelligence);
    renderComposerIntelligence();
  } catch (error) { toast(error.message || 'Unable to analyze the requirement.', 'error'); }
  finally { $('formProgress').hidden = true; button.disabled = false; button.textContent = '✦ Improve requirement'; }
};

$('applyAiSuggestion').onclick = () => {
  if (!requirementIntelligence) return;
  const selected = [...document.querySelectorAll('[data-clarification]:checked')].map(item => clarificationTemplates[item.dataset.clarification]).filter(Boolean);
  if (!selected.length) { toast('Select at least one suggested addition to apply.', 'info'); return; }
  const area = $('requirement');
  area.value = `${area.value.trim()}\n\n${selected.join('\n\n')}`;
  $('aiSuggestion').hidden = true; $('clarificationPanel').hidden = true;
  updateRequirementCount(); autoGrowRequirement(); renderComposerIntelligence();
  toast('Selected additions were appended for your review.', 'success');
};

function openCommandPalette() { $('commandDialog').showModal(); $('commandSearch').value = ''; $('commandSearch').focus(); document.querySelectorAll('[data-command]').forEach(button => button.hidden = false); }
function runCommand(command) {
  $('commandDialog').close();
  if (command === 'improve') { if (!$('creationView').hidden) $('aiImprove').click(); else { reset(); $('requirement').focus(); toast('Add a requirement, then choose Improve requirement.', 'info'); } }
  if (command === 'coverage') { toggleChat(true); askChat('Show my current coverage'); }
  if (command === 'workflow') { toggleChat(true); askChat('Explain this workflow'); }
}
$('commandSearch').addEventListener('input', event => { const query = event.target.value.toLowerCase(); document.querySelectorAll('[data-command]').forEach(button => { button.hidden = !button.textContent.toLowerCase().includes(query); }); });
document.querySelectorAll('[data-command]').forEach(button => button.onclick = () => runCommand(button.dataset.command));
document.addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); event.stopImmediatePropagation(); openCommandPalette(); } }, true);

initPointerGlow();

try {
  const user = JSON.parse(localStorage.getItem('flowpilot.user') || 'null');
  if (!user?.name) window.location.replace('/');
  else $('accountName').textContent = user.name;
} catch (_) { localStorage.removeItem('flowpilot.user'); window.location.replace('/'); }
applyWorkspaceIdentity();
loadActiveWorkspace().catch(() => {});
$('signOut').onclick = async () => { try { await fetch('/api/auth/logout', {method:'POST'}); } finally { localStorage.removeItem('flowpilot.user'); window.location.assign('/'); } };
$('helpOpen').onclick = () => $('helpDialog').showModal();
$('brandHome').onclick = () => showLibrary('dashboard');
$('workspaceOwner').onclick = async () => { try { await loadActiveWorkspace(); editingWorkspaceId = null; $('workspaceNameInput').value = ''; renderWorkspaces(); $('workspaceDialog').showModal(); } catch (error) { toast('Unable to load workspaces.', 'error'); } };
$('settingsOpen').onclick = () => { const identity = workspaceIdentity(); $('settingsWorkspaceName').value = identity.name || 'FlowPilot'; $('settingsOwnerName').value = identity.owner || $('accountName').textContent || ''; $('settingsTheme').value = document.documentElement.dataset.theme || 'light'; $('settingsSidebar').checked = localStorage.getItem('flowpilot.sidebar-collapsed') === 'true'; $('settingsDialog').showModal(); };
document.querySelectorAll('[data-close-dialog]').forEach(button => button.onclick = () => $(button.dataset.closeDialog).close());
$('helpStartWorkflow').onclick = () => { $('helpDialog').close(); reset(); };
$('settingsForm').addEventListener('submit', event => { event.preventDefault(); setTheme($('settingsTheme').value); localStorage.setItem('flowpilot.workspace', JSON.stringify({name:$('settingsWorkspaceName').value.trim() || 'FlowPilot', owner:$('settingsOwnerName').value.trim() || $('accountName').textContent || 'Your workspace'})); applyWorkspaceIdentity(); const shouldCollapse = $('settingsSidebar').checked; const isCollapsed = $('sidebar').classList.contains('collapsed'); if (shouldCollapse !== isCollapsed) $('sidebarToggle').click(); $('settingsDialog').close(); toast('Preferences saved', 'success'); });
$('workspaceNew').onclick = () => { editingWorkspaceId = null; $('workspaceNameInput').value = ''; $('workspaceNameInput').focus(); };
$('workspaceForm').addEventListener('submit', async event => { event.preventDefault(); const name = $('workspaceNameInput').value.trim(); try { const endpoint = editingWorkspaceId ? `/api/workspaces/${editingWorkspaceId}/update` : '/api/workspaces'; const saved = await api(endpoint, {name, owner:$('accountName').textContent || 'FlowPilot Admin'}); if (!editingWorkspaceId) activeWorkspaceId = saved.public_id; localStorage.setItem('flowpilot.active-workspace', activeWorkspaceId); await loadActiveWorkspace(); editingWorkspaceId = null; renderWorkspaces(); applyWorkspaceIdentity(); toast('Workspace saved', 'success'); } catch (error) { toast(error.message || 'Unable to save workspace.', 'error'); } });
