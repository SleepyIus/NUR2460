/* Exam folders are a view of the existing box bookmarks, not a new collection.
   Browsing never writes, migrates, or replaces learner records. */
(function () {
  'use strict';
  if (window.StudyStarredBoxes) return;
  const overlay = document.getElementById('boxBookmarkOverlay');
  const panel = document.getElementById('boxBookmarkPanelBody');
  if (!overlay || !panel || typeof loadBoxBookmarks !== 'function') return;

  const examByTopic = new Map();
  const topicOrder = new Map();
  const exams = ['1', '2', '3', '4'];
  exams.forEach(exam => {
    document.querySelectorAll('#exam' + exam + 'acc .planner-row[data-id]').forEach(row => {
      examByTopic.set(row.dataset.id, exam);
      if (!topicOrder.has(row.dataset.id)) topicOrder.set(row.dataset.id, topicOrder.size);
    });
  });
  let selectedExam = 'all';
  let returnFocus = null;
  let inertBefore = [];
  let overflowBefore = '';
  let visibleRecords = [];
  let message = '';
  const expanded = new Set();
  const escape = value => annotationEscape(String(value ?? ''));
  const owns = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const topicFor = id => typeof id === 'string' && owns(TOPICS, id) ? TOPICS[id] : null;

  const folders = document.createElement('nav');
  folders.className = 'starred-folder-nav';
  folders.setAttribute('aria-label', 'Starred box exam folders');
  overlay.querySelector('.annotation-panel').insertBefore(folders, panel);
  document.getElementById('boxBookmarkPanelTitle').textContent = 'Starred boxes';

  function records() {
    return Object.entries(loadBoxBookmarks()).filter(([, item]) =>
      item && typeof item === 'object' && typeof item.topicId === 'string' && typeof item.clusterId === 'string'
    ).map(([key, item]) => ({ ...item, key, exam: examByTopic.get(item.topicId) || 'other' }))
      .sort((a, b) => (topicOrder.get(a.topicId) ?? 999) - (topicOrder.get(b.topicId) ?? 999)
        || String(a.createdAt || '').localeCompare(String(b.createdAt || '')) || a.key.localeCompare(b.key));
  }

  function updateFolders() {
    const saved = records();
    const choices = ['all', ...exams];
    if (saved.some(item => item.exam === 'other')) choices.push('other');
    if (!choices.includes(selectedExam)) selectedExam = 'all';
    const focused = folders.contains(document.activeElement) ? document.activeElement.dataset.starredExam : null;
    folders.innerHTML = choices.map(exam => {
      const count = saved.filter(item => exam === 'all' || item.exam === exam).length;
      const label = exam === 'all' ? 'All boxes' : exam === 'other' ? 'Unassigned' : 'Exam ' + exam;
      return '<button type="button" data-starred-exam="' + exam + '" aria-pressed="' + (selectedExam === exam)
        + '">' + label + ' <span class="starred-folder-count">' + count + '</span></button>';
    }).join('');
    if (focused) folders.querySelector('[data-starred-exam="' + focused + '"]')?.focus();
    document.querySelectorAll('[data-starred-launch]').forEach(button => {
      const exam = button.dataset.starredLaunch;
      const count = saved.filter(item => item.exam === exam).length;
      button.innerHTML = '<span aria-hidden="true">📁</span> Starred boxes <span class="starred-folder-count">' + count + '</span>';
      button.setAttribute('aria-label', 'Exam ' + exam + ' starred boxes, ' + count + ' saved');
    });
  }

  function render() {
    updateFolders();
    visibleRecords = records().filter(item => selectedExam === 'all' || item.exam === selectedExam);
    const label = selectedExam === 'all' ? 'All exams' : selectedExam === 'other' ? 'Unassigned' : 'Exam ' + selectedExam;
    const count = visibleRecords.length;
    let html = '<p class="starred-folder-summary" role="status">' + label + ' · ' + count + ' starred '
      + (count === 1 ? 'box' : 'boxes') + '</p><p class="starred-folder-help">Expand a box to read it here, or open its topic for the full context.</p>';
    if (message) html += '<p class="starred-folder-error" role="alert">' + escape(message) + '</p>';
    if (!count) html += '<div class="annotation-empty">No starred boxes in this folder yet. Open a topic in this exam and select ☆ in a content box.</div>';
    let lastTopic = null;
    visibleRecords.forEach((item, index) => {
      const topic = topicFor(item.topicId);
      if (item.topicId !== lastTopic) {
        html += '<h3 class="starred-topic-heading">' + escape(topic ? boxBookmarkText(topic.title) : 'Unavailable topic: ' + item.topicId) + '</h3>';
        lastTopic = item.topicId;
      }
      html += '<article class="box-bookmark-card"><details class="starred-box-detail" data-starred-index="' + index + '"'
        + (expanded.has(item.key) ? ' open' : '') + '><summary>' + escape(item.label || item.clusterId)
        + '</summary><div class="starred-box-content"></div></details><div class="box-bookmark-actions">'
        + (topic ? '<button type="button" data-starred-action="go" data-starred-index="' + index + '">Open in topic →</button>' : '')
        + '<button type="button" class="danger" data-starred-action="remove" data-starred-index="' + index + '">Unstar</button></div></article>';
    });
    panel.innerHTML = html;
    panel.querySelectorAll('.starred-box-detail').forEach(details => {
      if (details.open) fillPreview(details);
      details.addEventListener('toggle', () => {
        if (!details.isConnected) return;
        const item = visibleRecords[Number(details.dataset.starredIndex)];
        if (!item) return;
        if (details.open) { expanded.add(item.key); fillPreview(details); }
        else expanded.delete(item.key);
      });
    });
  }

  function sourceBox(item) {
    const topic = topicFor(item.topicId);
    if (!topic) return null;
    const aliases = topic.boxBookmarkAliases || {};
    const cluster = owns(aliases, item.clusterId) ? aliases[item.clusterId] : item.clusterId;
    const template = document.createElement('template');
    template.innerHTML = renderAdpieTopic(topic, 'overview');
    const candidates = [...template.content.querySelectorAll('[data-cluster].content-block,[data-cluster].callout,.tab-panel > .content-block:not([data-cluster]),.tab-panel > .callout:not([data-cluster])')];
    return candidates.find((box, index) => (box.dataset.cluster || fallbackBoxId(box, index)) === cluster) || null;
  }

  function fillPreview(details) {
    const content = details.querySelector('.starred-box-content');
    if (content.dataset.loaded) return;
    const index = Number(details.dataset.starredIndex);
    const item = visibleRecords[index];
    const box = item && sourceBox(item);
    if (!box) {
      content.textContent = 'This saved box could not be matched to the current content. Your star is preserved; open the topic to locate it.';
      content.dataset.loaded = 'true';
      return;
    }
    // Detached presentation copy only: preserve the full box and source labels,
    // while preventing duplicate anchors from intercepting the teaching links.
    const clone = box.cloneNode(true);
    const nodes = [clone, ...clone.querySelectorAll('*')];
    const prefix = 'starred-preview-' + index + '-';
    const ids = new Map();
    nodes.forEach(node => { if (node.id) ids.set(node.id, prefix + node.id); });
    nodes.forEach(node => {
      if (node.id) node.id = ids.get(node.id);
      ['data-cluster', 'data-fact', 'data-anchor'].forEach(attr => {
        if (node.hasAttribute(attr)) { node.setAttribute('data-starred-original-' + attr.slice(5), node.getAttribute(attr)); node.removeAttribute(attr); }
      });
      ['aria-labelledby', 'aria-describedby', 'for', 'headers'].forEach(attr => {
        if (node.hasAttribute(attr)) node.setAttribute(attr, node.getAttribute(attr).split(/\s+/).map(id => ids.get(id) || id).join(' '));
      });
      const href = node.getAttribute('href');
      if (href?.startsWith('#') && ids.has(href.slice(1))) node.setAttribute('href', '#' + ids.get(href.slice(1)));
    });
    content.appendChild(clone);
    content.dataset.loaded = 'true';
  }

  function open(exam) {
    selectedExam = exams.includes(String(exam)) ? String(exam) : examByTopic.get(currentTopicId) || 'all';
    message = '';
    if (!overlay.classList.contains('show')) {
      returnFocus = document.activeElement;
      overflowBefore = document.body.style.overflow;
      inertBefore = [...document.body.children].filter(node => node !== overlay).map(node => [node, node.inert]);
      inertBefore.forEach(([node]) => { node.inert = true; });
    }
    render();
    overlay.classList.add('show');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    document.getElementById('boxBookmarkPanelClose').focus();
  }

  function close(restoreFocus) {
    if (!overlay.classList.contains('show')) return;
    overlay.classList.remove('show');
    overlay.setAttribute('aria-hidden', 'true');
    inertBefore.forEach(([node, wasInert]) => { node.inert = wasInert; });
    inertBefore = [];
    document.body.style.overflow = overflowBefore;
    // Clear previews so hidden copied anchors cannot catch topic navigation.
    panel.innerHTML = '';
    if (restoreFocus !== false && returnFocus?.isConnected) returnFocus.focus();
  }

  folders.addEventListener('click', event => {
    const button = event.target.closest('button[data-starred-exam]');
    if (!button) return;
    selectedExam = button.dataset.starredExam;
    message = '';
    render();
    folders.querySelector('[data-starred-exam="' + selectedExam + '"]')?.focus();
    panel.scrollTop = 0;
  });
  panel.addEventListener('click', event => {
    const button = event.target.closest('button[data-starred-action]');
    if (!button) return;
    const index = Number(button.dataset.starredIndex);
    const item = visibleRecords[index];
    if (!item) return;
    if (button.dataset.starredAction === 'remove') {
      const saved = loadBoxBookmarks();
      delete saved[item.key];
      try {
        message = '';
        saveBoxBookmarks(saved);
        expanded.delete(item.key);
      } catch (_) { message = 'Your star could not be removed because saving is unavailable. Nothing was changed.'; render(); }
      (panel.querySelectorAll('[data-starred-action="remove"]')[index] || document.getElementById('boxBookmarkPanelClose')).focus();
    } else {
      close(false);
      openSavedBox(item.topicId, item.clusterId);
    }
  });
  document.addEventListener('keydown', event => {
    if (!overlay.classList.contains('show')) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close(true); return; }
    if (event.key !== 'Tab') return;
    const controls = [...overlay.querySelectorAll('button,summary,a[href],input,select,textarea,[tabindex="0"]')]
      .filter(node => !node.disabled && node.getClientRects().length);
    const first = controls[0], last = controls[controls.length - 1];
    if (!first) return;
    if (!overlay.contains(document.activeElement) || event.shiftKey && document.activeElement === first || !event.shiftKey && document.activeElement === last) {
      event.preventDefault(); (event.shiftKey ? last : first).focus();
    }
  }, true);

  function addLauncher(parent, exam, sidebar) {
    if (!parent) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'starred-folder-launch' + (sidebar ? ' starred-folder-sidebar' : '');
    button.dataset.starredLaunch = exam;
    button.setAttribute('aria-haspopup', 'dialog');
    button.addEventListener('click', event => { event.stopPropagation(); open(exam); });
    if (sidebar) parent.insertBefore(button, parent.querySelector('.nav-part-label'));
    else parent.appendChild(button);
  }
  exams.forEach(exam => {
    addLauncher(document.querySelector('#exam' + exam + 'acc .exam-header'), exam, false);
    addLauncher(document.getElementById('exam' + exam), exam, true);
  });
  const previousCount = updateBoxBookmarkCount;
  updateBoxBookmarkCount = function () { previousCount(); updateFolders(); };
  renderBoxBookmarkPanel = render;
  openBoxBookmarkPanel = open;
  closeBoxBookmarkPanel = close;
  window.addEventListener('storage', event => {
    if (event.key && event.key !== BOX_BOOKMARKS_KEY) return;
    updateBoxBookmarkCount();
    if (overlay.classList.contains('show')) render();
  });
  window.StudyStarredBoxes = { open };
  updateFolders();
})();
