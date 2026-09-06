/* Presentation-only wrappers: move original cards without replacing their content or handlers. */
(function () {
  const app = document.querySelector('.app');
  if (!app || app.dataset.minimalLayout || document.getElementById('flashcardsPreviewBar')) return;
  app.dataset.minimalLayout = 'true';
  const bar = document.createElement('div');
  bar.id = 'flashcardsPreviewBar';
  bar.className = 'fc-preview-bar';
  bar.innerHTML = '<span>Flashcards · minimalist preview</span><a href="NUR2460Flashcards.html">Original design ↗</a>';
  const warning = document.createElement('p');
  warning.className = 'fc-preview-state';
  warning.textContent = 'Preview only — Focus Deck, ratings, and review progress here are temporary.';
  app.insertBefore(warning, app.firstChild);
  if (!window.NURMinimalDefault) app.insertBefore(bar, app.firstChild);
  document.querySelectorAll('.sb-back, .mob-back').forEach(link => { link.href = window.NURMinimalDefault ? 'index.html' : 'index-minimal-preview.html'; });
  document.getElementById('gridExamFilter').setAttribute('aria-label', 'Filter Browse by exam');
  document.getElementById('gridTopicFilter').setAttribute('aria-label', 'Filter Browse by topic');

  const dashboard = document.getElementById('perfDashboard');
  const performance = document.createElement('details');
  performance.className = 'fc-performance';
  performance.id = 'flashcardsPerformance';
  const performanceSummary = document.createElement('summary');
  performanceSummary.textContent = 'Performance Tracker';
  dashboard.parentElement.insertBefore(performance, dashboard);
  performance.appendChild(performanceSummary);
  performance.appendChild(dashboard);

  const openGroups = new Set();
  function group(className, title, key) {
    const details = document.createElement('details');
    details.className = className;
    details.dataset.previewGroup = key;
    details.open = openGroups.has(key);
    const summary = document.createElement('summary');
    const label = document.createElement('span');
    label.className = 'fc-group-title';
    label.textContent = title;
    summary.appendChild(label);
    details.appendChild(summary);
    details.addEventListener('toggle', () => {
      if (!details.isConnected) return;
      if (details.open) openGroups.add(key); else openGroups.delete(key);
    });
    return details;
  }
  function groupBrowseCards() {
    const container = document.getElementById('gridContainer');
    if (!container || container.querySelector('.fc-exam-group')) return;
    const nodes = [...container.children];
    let examName = document.getElementById('gridExamFilter').value;
    let examBody = null, topicGroup = null;
    function startExam(name) {
      examName = name;
      const exam = group('fc-exam-group', name, 'exam:' + name);
      examBody = document.createElement('div');
      examBody.className = 'fc-exam-body';
      exam.appendChild(examBody);
      container.appendChild(exam);
    }
    nodes.forEach(node => {
      if (node.classList.contains('grid-exam-label')) {
        startExam(node.textContent);
        node.remove();
      } else if (node.classList.contains('grid-topic-label')) {
        if (!examBody) startExam(examName);
        const topic = node.textContent.replace(/\s+\(\d+\)$/, '');
        topicGroup = group('fc-topic-group', node.textContent, 'topic:' + examName + ':' + topic);
        examBody.appendChild(topicGroup);
        node.remove();
      } else if (node.classList.contains('grid-cards') && topicGroup) {
        topicGroup.appendChild(node);
      }
    });
    container.querySelectorAll('.fc-exam-group').forEach(exam => {
      const count = document.createElement('span');
      count.className = 'fc-group-count';
      count.textContent = exam.querySelectorAll('.grid-card').length + ' cards';
      exam.querySelector('summary').appendChild(count);
    });
  }
  const originalRenderGrid = renderGrid;
  renderGrid = function (...args) {
    // Capture open state before the original renderer replaces the card nodes.
    document.querySelectorAll('#gridContainer details').forEach(details => {
      const key = details.dataset.previewGroup;
      if (details.open) openGroups.add(key); else openGroups.delete(key);
    });
    const result = originalRenderGrid.apply(this, args);
    groupBrowseCards();
    return result;
  };
  groupBrowseCards();

  let printState = null;
  window.addEventListener('beforeprint', () => {
    if (printState) return;
    printState = [...document.querySelectorAll('#gridContainer details')].map(details => [details, details.open]);
    printState.forEach(([details]) => { details.open = true; });
  });
  window.addEventListener('afterprint', () => {
    if (!printState) return;
    printState.forEach(([details, open]) => { details.open = open; });
    printState = null;
  });

  function updateSidebarState() {
    document.querySelectorAll('.sb-section-label').forEach(label => {
      label.setAttribute('aria-expanded', String(!label.parentElement.classList.contains('collapsed')));
    });
  }
  function setupSidebar() {
    document.querySelectorAll('.sb-section-label').forEach(label => {
      if (label.dataset.previewKeyboard) return;
      label.dataset.previewKeyboard = 'true';
      label.setAttribute('role', 'button');
      label.setAttribute('tabindex', '0');
      label.addEventListener('click', updateSidebarState);
      label.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); label.click(); }
      });
    });
    updateSidebarState();
  }
  const originalBuildSidebar = buildSidebar;
  buildSidebar = function (...args) { const result = originalBuildSidebar.apply(this, args); setupSidebar(); return result; };
  const originalExpand = expandAllSidebar, originalCollapse = collapseAllSidebar;
  expandAllSidebar = function (...args) { const result = originalExpand.apply(this, args); updateSidebarState(); return result; };
  collapseAllSidebar = function (...args) { const result = originalCollapse.apply(this, args); updateSidebarState(); return result; };
  setupSidebar();
})();
