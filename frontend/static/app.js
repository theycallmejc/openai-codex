const $ = id => document.getElementById(id);
let project = null;
let view = 'Requirement';
let samples = [];

const tabs = ['Requirement', 'Analysis', 'BRD', 'Backlog', 'Tests', 'Traceability', 'QA Handoff'];
const stages = [
  ['Requirement', 'input'], ['Analysis', 'agent'], ['BRD', 'agent'], ['BRD approval', 'approval'],
  ['Backlog', 'agent'], ['Backlog approval', 'approval'], ['Tests', 'agent'], ['Traceability', 'agent'], ['QA Handoff', 'agent']
];
const esc = x => String(x ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

async function api(url, body) {
  const response = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: body ? {'Content-Type':'application/json'} : {},
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await response.json();
  if (!json.success) throw Error(json.error?.message || 'Request failed');
  return json.data;
}

function status(text) {
  $('status').hidden = !text;
  $('status').textContent = text;
}

function updateRequirementCount() {
  $('requirementCount').textContent = `${$('requirement').value.length.toLocaleString()} / 10,000`;
}

function chatReply(question) {
  const q = question.toLowerCase();
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
  $('chatMessages').append(message);
  $('chatMessages').scrollTop = $('chatMessages').scrollHeight;
}

async function askChat(question) {
  const cleaned = question.trim();
  if (!cleaned) return;
  addChatMessage(cleaned, 'user');
  const typing = document.createElement('div');
  typing.className = 'chat-message assistant typing';
  typing.innerHTML = '<i></i><i></i><i></i>';
  $('chatMessages').append(typing);
  $('chatMessages').scrollTop = $('chatMessages').scrollHeight;
  try {
    const reply = project
      ? (await api(`/api/projects/${project.public_id}/assistant`, {message:cleaned})).reply
      : chatReply(cleaned);
    typing.remove();
    addChatMessage(reply);
  } catch (_) {
    typing.remove();
    addChatMessage(chatReply(cleaned));
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

function artifact(vm) {
  const a = project.artifacts || {};
  const source = project.description || '';

  if (vm.selectedArtifact === 'Requirement') {
    return `<header class="artifact-head"><div><p>SOURCE REQUIREMENT</p><h1>Captured requirement</h1></div><button class="copy" data-copy="${esc(source)}">Copy</button></header>
      <div class="source-block rich-source">${esc(source || 'No source requirement is available.')}</div>`;
  }
  if (vm.selectedArtifact === 'Analysis') {
    const items = a.analysis?.functional_requirements || [];
    return `<header class="artifact-head"><div><p>ANALYSIS OUTPUT</p><h1>Functional requirements</h1></div></header>
      <div class="card-grid">${items.map(x => sourceCard(x.id, x.title || x.id, x.text, 'Validated')).join('') || '<p class="empty-copy">No analysis output is available.</p>'}</div>`;
  }
  if (vm.selectedArtifact === 'BRD') {
    const scope = a.brd?.scope_in || [];
    return `<header class="artifact-head"><div><p>BRD · ${esc(a.brd?.approval_state || 'PENDING')}</p><h1>Business requirements</h1></div></header>
      <div class="card-grid">${scope.map((text, i) => sourceCard(`REQ-${String(i + 1).padStart(3, '0')}`, `Business requirement ${i + 1}`, text, a.brd?.approval_state || 'Pending')).join('') || '<p class="empty-copy">No BRD scope is available.</p>'}</div>`;
  }
  if (vm.selectedArtifact === 'Backlog') {
    const stories = a.backlog?.stories || [];
    return `<header class="artifact-head"><div><p>BACKLOG · ${esc(a.backlog?.approval_state || 'PENDING')}</p><h1>Delivery backlog</h1></div></header>
      <div class="card-grid">${stories.map(x => sourceCard(x.id, x.title || 'User story', (x.acceptance_criteria || []).map(c => c.then || c.id).join(' • '), `${(x.acceptance_criteria || []).length} criteria`)).join('') || '<p class="empty-copy">No backlog stories are available.</p>'}</div>`;
  }
  if (vm.selectedArtifact === 'Tests') {
    const tests = a.tests?.test_cases || [];
    return `<header class="artifact-head"><div><p>GENERATED TESTS</p><h1>Test coverage</h1></div></header>
      <div class="card-grid">${tests.map(x => sourceCard(x.id, x.title || x.type || 'Test case', x.expected_result || x.criterion_id || '', x.type || 'Test')).join('') || '<p class="empty-copy">No tests are available.</p>'}</div>`;
  }
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

function activitySummary() {
  const runs = (project.agent_runs || []).slice().reverse();
  if (!runs.length) return '';
  return `<section class="audit agent-activity"><h2>Agent activity</h2><p>Every handoff is recorded for review.</p><div class="run-list">${runs.map(run => `<div class="run-row"><b>${run.status === 'completed' ? '✓' : '…'}</b><div><strong>${esc(run.agent.replaceAll('_', ' '))}</strong><span>${esc(run.input_artifact || 'Workflow input')} → ${esc(run.output_artifact || 'Processing')}</span></div><em class="${esc(run.status)}">${esc(run.status)}${run.completed_at ? ` · ${time(run.completed_at)}` : ''}</em></div>`).join('')}</div></section>`;
}

function metric(value) { return value === null ? '—' : esc(value); }

function render() {
  const vm = buildViewModel(project, view);
  view = vm.selectedArtifact;
  remember(project);
  $('creationView').hidden = true;
  $('workspaceView').hidden = false;
  $('crumb').textContent = project.public_id;
  status(vm.qaReadiness === 'Ready' ? 'Ready' : vm.workflowState.includes('AWAITING') ? 'Awaiting review' : 'Workflow active');
  sidebar(vm);

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
        <nav class="artifact-tabs" aria-label="Artifacts">${tabs.map(x => `<button data-artifact="${x}" class="${view === x ? 'selected' : ''}" ${vm.available[x] ? '' : 'disabled'}>${x}</button>`).join('')}</nav>
        <article class="artifact-view">${artifact(vm)}</article>
        <section class="audit">${auditSummary()}</section>
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
  document.querySelector('[data-copy]')?.addEventListener('click', e => navigator.clipboard?.writeText(e.currentTarget.dataset.copy));
  document.querySelector('[data-copy-summary]')?.addEventListener('click', () => copySummary(vm));
  document.querySelector('[data-download]')?.addEventListener('click', () => downloadHandoff(vm));
  document.querySelectorAll('[data-run]').forEach(button => button.onclick = () => run(button.dataset.run));
  document.querySelectorAll('[data-approve]').forEach(button => button.onclick = () => run(`${button.dataset.approve}/approve`, {reviewer:$('reviewer').value || 'Reviewer'}));
  document.querySelectorAll('[data-reject]').forEach(button => button.onclick = () => {
    const reason = window.prompt('Describe the changes required before regeneration:');
    if (reason?.trim()) run(`${button.dataset.reject}/reject`, {reviewer:$('reviewer').value || 'Reviewer', reason:reason.trim()});
  });
  document.querySelectorAll('[data-automation]').forEach(button => button.onclick = runAutomation);
  document.querySelectorAll('[data-next]').forEach(button => button.onclick = () => vm.nextAction.path ? run(vm.nextAction.path) : render());
  document.querySelectorAll('[data-reset]').forEach(button => button.onclick = reset);
  document.querySelectorAll('[data-next-scenario]').forEach(button => button.onclick = openNextScenario);
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

async function run(path, body = {}) {
  try {
    status('Processing');
    await api(`/api/projects/${project.public_id}/${path}`, body);
    project = await api(`/api/projects/${project.public_id}`);
    render();
  } catch (error) { status(`Failed: ${error.message}`); }
}

async function runAutomation() {
  try {
    status('Running safe automation');
    for (let step = 0; step < 6; step += 1) {
      const result = await api(`/api/projects/${project.public_id}/automation/run-next`, {});
      project = await api(`/api/projects/${project.public_id}`);
      if (result.status === 'blocked' || result.status === 'idle' || project.state.includes('AWAITING')) break;
    }
    render();
  } catch (error) { status(`Automation stopped: ${error.message}`); }
}

function reset(prefill = '') {
  project = null;
  view = 'Requirement';
  $('workspaceView').hidden = true;
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
    const created = await api('/api/projects', {name:raw.slice(0, 80), description:raw});
    progress(1);
    await api(`/api/projects/${created.public_id}/requirements`, {raw_requirement:raw});
    project = await api(`/api/projects/${created.public_id}`);
    render();
  } catch (error) {
    $('formError').textContent = error.message;
    $('createWorkflow').disabled = false;
    $('clearForm').disabled = false;
    $('formProgress').hidden = true;
    document.querySelector('.form-foot').hidden = false;
  }
});

$('clearForm').onclick = () => { $('requirement').value = ''; $('formError').textContent = ''; updateRequirementCount(); };
$('requirement').addEventListener('input', updateRequirementCount);
$('navNew').onclick = () => reset();
$('startNextScenario').onclick = () => {
  const selected = samples[$('nextScenarioSelect').value];
  $('nextScenarioDialog').close();
  reset(selected?.raw_requirement || '');
  if (selected) $('formHint').textContent = `Loaded “${selected.name}”. Review it before creating the workflow.`;
};

$('chatToggle').onclick = () => toggleChat($('chatPanel').hidden);
$('chatClose').onclick = () => toggleChat(false);
$('chatForm').addEventListener('submit', event => { event.preventDefault(); askChat($('chatInput').value); $('chatInput').value = ''; });
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

initPointerGlow();
