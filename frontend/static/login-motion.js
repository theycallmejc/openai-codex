(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const story = document.getElementById('productStory');
  const demo = document.getElementById('workflowDemo');
  if (!story || !demo) return;

  const agents = [...demo.querySelectorAll('[data-agent]')];
  const connectors = [...demo.querySelectorAll('[data-connector]')];
  const artifact = demo.querySelector('.demo-artifact');
  const artifactIcon = document.getElementById('artifactIcon');
  const artifactMessage = document.getElementById('artifactMessage');
  const status = document.getElementById('demoStatus');
  const statusDetail = document.getElementById('demoStatusDetail');
  const labels = {
    requirements: ['Analyzing', 'Business rules extracted', 'Analyzing requirement'],
    risk: ['Reviewing', 'Edge cases identified', 'Reviewing risk'],
    qa: ['Generating', 'QA scenarios generated', 'Generating QA coverage'],
  };
  let timer = 0;
  let frame = 0;

  function setAgent(agent, state) {
    const node = agents.find(item => item.dataset.agent === agent);
    if (!node) return;
    node.dataset.state = state;
    node.querySelector('em').textContent = state === 'active' ? labels[agent][0] : state === 'complete' ? 'Complete' : 'Waiting';
    node.querySelector('span').textContent = state === 'complete' ? labels[agent][1] : agent === 'requirements' ? 'Extracting business rules' : agent === 'risk' ? 'Checking edge cases' : 'Generating test scenarios';
  }

  function setConnector(name, active) {
    const connector = connectors.find(item => item.dataset.connector === name);
    if (connector) connector.dataset.active = String(active);
  }

  function reset() {
    demo.dataset.phase = 'initial';
    agents.forEach(node => setAgent(node.dataset.agent, 'waiting'));
    connectors.forEach(node => { node.dataset.active = 'false'; });
    artifact.dataset.state = 'waiting';
    artifactIcon.innerHTML = '&#9675;';
    artifactMessage.textContent = 'Preparing traceable evidence';
    status.textContent = 'FlowPilot Intelligence active';
    statusDetail.textContent = 'Illustrative workflow demonstration';
  }

  function step(agent, connector) {
    const prior = agents.find(item => item.dataset.state === 'active');
    if (prior) setAgent(prior.dataset.agent, 'complete');
    if (connector) setConnector(connector, true);
    setAgent(agent, 'active');
    demo.dataset.phase = agent;
    status.textContent = labels[agent][2];
    statusDetail.textContent = 'Illustrative workflow demonstration';
  }

  function complete() {
    const active = agents.find(item => item.dataset.state === 'active');
    if (active) setAgent(active.dataset.agent, 'complete');
    setConnector('artifact', true);
    demo.dataset.phase = 'artifact';
    artifact.dataset.state = 'complete';
    artifactIcon.innerHTML = '&#10003;';
    artifactMessage.textContent = 'Traceable evidence ready';
    status.textContent = 'Artifact ready';
    statusDetail.textContent = 'Illustrative workflow demonstration';
  }

  function scheduleCycle() {
    reset();
    const steps = [
      [450, () => step('requirements', 'requirements')],
      [2250, () => step('risk', 'risk')],
      [3950, () => step('qa', 'qa')],
      [5950, complete],
      [8800, scheduleCycle],
    ];
    let index = 0;
    const next = () => {
      if (document.hidden) return;
      const [delay, action] = steps[index++];
      timer = window.setTimeout(() => { action(); if (index < steps.length) next(); }, index === 1 ? delay : delay - steps[index - 2][0]);
    };
    next();
  }

  function initializePointerLight() {
    if (reduceMotion || window.matchMedia('(pointer: coarse)').matches) return;
    story.addEventListener('pointermove', event => {
      const rect = story.getBoundingClientRect();
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        story.style.setProperty('--mouse-x', `${event.clientX - rect.left}px`);
        story.style.setProperty('--mouse-y', `${event.clientY - rect.top}px`);
      });
    });
  }

  document.getElementById('passwordToggle')?.addEventListener('click', event => {
    const input = document.getElementById('premiumLoginPassword');
    const visible = input.type === 'text';
    input.type = visible ? 'password' : 'text';
    event.currentTarget.textContent = visible ? 'Show' : 'Hide';
    event.currentTarget.setAttribute('aria-label', visible ? 'Show password' : 'Hide password');
    event.currentTarget.setAttribute('aria-pressed', String(!visible));
  });

  document.addEventListener('visibilitychange', () => {
    window.clearTimeout(timer);
    if (!document.hidden && !reduceMotion) scheduleCycle();
  });
  initializePointerLight();
  if (reduceMotion) { reset(); setAgent('requirements', 'active'); }
  else scheduleCycle();
})();
