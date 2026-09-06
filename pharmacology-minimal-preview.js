/* Presentation/accessibility only; medication renderers and stored identities are retained. */
(function () {
  const main = document.querySelector('.main-content');
  if (!main || main.dataset.minimalLayout || document.getElementById('pharmacologyPreviewBar')) return;
  main.dataset.minimalLayout = 'true';
  const get = id => document.getElementById(id);
  const bar = document.createElement('div');
  bar.id = 'pharmacologyPreviewBar'; bar.className = 'pharm-preview-bar';
  bar.innerHTML = '<span>Pharmacology · minimalist preview</span><a href="NUR2460Pharmacology.html">Original design ↗</a>';
  const warning = document.createElement('p'); warning.className = 'pharm-preview-state';
  warning.textContent = 'Design preview — review marks and theme changes here are temporary. Original saved progress and backups are unchanged.';
  if (!window.NURMinimalDefault) { main.insertBefore(warning, main.firstChild); main.insertBefore(bar, main.firstChild); }
  main.querySelector('.main-desc').textContent = 'Medication reference organized by exam. Open a medication for Brief or Deep study, comparisons, and self-checks where available.';
  document.querySelectorAll('.back-home, .back-home-mobile').forEach(link => { link.href = window.NURMinimalDefault ? 'index.html' : 'index-minimal-preview.html'; });
  const tools = document.createElement('div'); tools.className = 'pharm-preview-tools';
  main.insertBefore(tools, get('compareBtn'));
  main.querySelectorAll('.compare-btn').forEach(button => tools.appendChild(button));
  const modalTools = document.createElement('div'); modalTools.className = 'pharm-preview-modal-tools';
  get('modalRefs').parentElement.appendChild(modalTools); modalTools.appendChild(get('qrFab')); modalTools.appendChild(get('printBtn'));
  get('searchInput').setAttribute('aria-label', 'Search medications');
  document.querySelector('.sidebar-toggle').setAttribute('aria-label', 'Toggle medication navigation');
  get('qrFab').setAttribute('aria-label', 'Switch to Brief view');

  function keyboard(button) {
    if (button.dataset.previewKeyboard) return;
    button.dataset.previewKeyboard = 'true'; button.setAttribute('role', 'button'); button.setAttribute('tabindex', '0');
    button.addEventListener('keydown', event => {
      if (event.target === button && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); button.click(); }
    });
  }
  const groups = '.exam-accordion, .pharm-cat, .nav-exam-group, .nav-cat';
  const heads = '.exam-header, .pharm-cat-header, .nav-exam-label, .nav-cat-label';
  function syncGroups() { document.querySelectorAll(heads).forEach(header => header.setAttribute('aria-expanded', String(!header.parentElement.classList.contains('collapsed')))); }
  document.querySelectorAll(groups).forEach(group => group.classList.add('collapsed'));
  document.querySelectorAll(heads).forEach(header => { keyboard(header); header.addEventListener('click', syncGroups); });
  document.querySelectorAll('.nav-drug').forEach(keyboard);
  const oldExpand = expandAllSidebar, oldCollapse = collapseAllSidebar;
  expandAllSidebar = function () { oldExpand(); syncGroups(); };
  collapseAllSidebar = function () { oldCollapse(); syncGroups(); };
  function progressLabels() {
    const progress = getPharmProgress();
    document.querySelectorAll('.pharm-check').forEach(control => {
      keyboard(control);
      const title = control.parentElement.querySelector('.pharm-pill')?.textContent.trim() || control.dataset.drug;
      const state = progress[control.dataset.drug], level = state === true || state === 2 ? 2 : state === 1 ? 1 : 0;
      control.setAttribute('aria-label', title + ' — ' + ['Not reviewed. Mark reviewed.', 'Reviewed. Mark mastered.', 'Mastered. Clear review mark.'][level]);
    });
  }
  const oldCheck = togglePharmCheck, oldLoad = loadPharmProgress, oldReset = resetPharmProgress;
  loadPharmProgress = function () { oldLoad(); progressLabels(); };
  togglePharmCheck = function (control) { oldCheck(control); loadPharmProgress(); };
  resetPharmProgress = function () { oldReset(); loadPharmProgress(); };
  syncGroups(); progressLabels();

  // A7 is a layout reference only. Move the existing nine field nodes without
  // rebuilding their content, attribution, links, or medication identities.
  function arrangeMedicationBoxes() {
    const grid = get('modalBody').querySelector('.pharm-grid');
    if (!grid || grid.classList.contains('pharm-a7-layout')) return;
    const boxes = [...grid.children].filter(node => node.classList.contains('pharm-grid-cell'));
    const labels = ['Expected Pharmacological Action', 'Therapeutic Use', 'Complications / Adverse Effects', 'Medication Administration', 'Contraindications / Precautions', 'Nursing Interventions', 'Interactions', 'Client Education', 'Evaluation of Medication Effectiveness'];
    if (boxes.length !== labels.length || boxes.some((box, i) => box.querySelector('h4')?.textContent !== labels[i])) return;
    const [action, use, complications, administration, precautions, nursing, interactions, education, evaluation] = boxes;
    const node = (tag, className) => { const element = document.createElement(tag); element.className = className; return element; };
    const purpose = node('section', 'pharm-a7-purpose');
    purpose.setAttribute('aria-label', 'Purpose of Medication');
    const heading = node('h3', 'pharm-a7-purpose-title'); heading.textContent = 'Purpose of Medication';
    const pair = node('div', 'pharm-a7-purpose-grid'); pair.appendChild(action); pair.appendChild(use);
    purpose.appendChild(heading); purpose.appendChild(pair);
    const body = node('div', 'pharm-a7-body');
    const left = node('div', 'pharm-a7-column pharm-a7-left');
    [complications, precautions, interactions, evaluation].forEach(box => left.appendChild(box));
    const right = node('div', 'pharm-a7-column pharm-a7-right');
    const care = node('div', 'pharm-a7-care');
    const connector = node('span', 'pharm-a7-connector'); connector.setAttribute('aria-hidden', 'true');
    care.appendChild(nursing); care.appendChild(connector); care.appendChild(education);
    right.appendChild(administration); right.appendChild(care);
    body.appendChild(left); body.appendChild(right);
    grid.appendChild(purpose); grid.appendChild(body); grid.classList.add('pharm-a7-layout');
  }

  let returnFocus = null;
  function syncDialogs(focus = false) {
    const ids = ['modalOverlay', 'compareOverlay', 'pharmPrintOverlay', 'printOverlay', 'pharmStudyOverlay', 'pharmNotePopover'];
    const overlays = ids.map(get).filter(Boolean);
    const active = overlays.filter(overlay => overlay.classList.contains('show') || overlay.classList.contains('active'));
    const top = active[active.length - 1];
    overlays.forEach(overlay => { overlay.inert = overlay !== top; });
    document.querySelector('.layout').inert = !!top;
    document.querySelectorAll('.sidebar-toggle, .back-home-mobile').forEach(node => { node.inert = !!top; });
    document.body.style.overflow = top ? 'hidden' : '';
    if (top && focus) {
      const dialog = top.querySelector('.modal, .compare-modal, .pharm-print-panel, .pharm-study-dialog') || top;
      dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true'); dialog.setAttribute('tabindex', '-1');
      dialog.setAttribute('aria-label', top.id === 'pharmNotePopover' ? 'Medication note editor' : top.id === 'pharmStudyOverlay' ? 'Medication notes and saved study items' : top === get('modalOverlay') ? get('modalTitle').textContent : top === get('compareOverlay') ? 'Drug comparison' : 'Print medications');
      dialog.focus({ preventScroll: true });
    } else if (!top && returnFocus?.isConnected) { returnFocus.focus({ preventScroll: true }); returnFocus = null; }
    return top;
  }
  function opened(fn) { return function (...args) { if (!syncDialogs()) returnFocus = document.activeElement; const result = fn.apply(this, args); syncDialogs(true); syncGroups(); return result; }; }
  function closed(fn) { return function (...args) { const result = fn.apply(this, args); syncDialogs(true); return result; }; }
  const oldOpen = openDrug;
  openDrug = opened(function (...args) { const result = oldOpen.apply(this, args); arrangeMedicationBoxes(); get('qrFab').setAttribute('aria-label', 'Switch to Brief view'); return result; });
  closeDrug = closed(closeDrug);
  showComparison = opened(showComparison); closeComparison = closed(closeComparison);
  openPharmPrintPanel = opened(openPharmPrintPanel); closePharmPrintPanel = closed(closePharmPrintPanel);
  rebuildPharmPrint = opened(rebuildPharmPrint); closePharmPrintOverlay = closed(closePharmPrintOverlay);
  const oldQuick = togglePharmQuickReview;
  togglePharmQuickReview = function () { const result = oldQuick(); if (!isInQuickReview) arrangeMedicationBoxes(); get('qrFab').setAttribute('aria-label', isInQuickReview ? 'Switch to Deep view' : 'Switch to Brief view'); return result; };
  const oldSearch = searchDrugs;
  searchDrugs = function (...args) { const result = oldSearch.apply(this, args); get('searchResults').querySelectorAll('.sr-item').forEach(keyboard); return result; };
  document.querySelectorAll('.modal-close').forEach(button => button.setAttribute('aria-label', 'Close dialog'));
  document.addEventListener('keydown', event => {
    const top = syncDialogs(); if (!top) return;
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopImmediatePropagation();
      if (top.id === 'modalOverlay' && window.NURPharmStudy?.dismissSelection()) return;
      if (top.id === 'pharmNotePopover') window.NURPharmStudy.closeNotePopover(); else if (top.id === 'pharmStudyOverlay') window.NURPharmStudy.closePanel(); else if (top.id === 'printOverlay') closePharmPrintOverlay(); else if (top.id === 'pharmPrintOverlay') closePharmPrintPanel(); else if (top.id === 'compareOverlay') closeComparison(); else closeDrug();
    } else if (event.key === 'Tab') {
      const items = [...top.querySelectorAll('button, a[href], input, textarea, select, summary, [contenteditable="true"], [tabindex="0"]')].filter(node => !node.disabled && !node.hidden && node.getClientRects().length);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || !items.includes(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !items.includes(document.activeElement))) { event.preventDefault(); first.focus(); }
    } else if (['pharmStudyOverlay', 'pharmNotePopover'].includes(top.id) && event.key.toLowerCase() === 'b' && !event.ctrlKey && !event.metaKey) event.stopImmediatePropagation();
  }, true);
  window.NURPharmPreviewDialogs = { sync: syncDialogs };
  syncDialogs();
  let printState = null;
  window.addEventListener('beforeprint', () => {
    if (printState) return;
    printState = [...document.querySelectorAll('#modalBody details, #printOverlay details')].map(node => [node, node.open]);
    printState.forEach(([node]) => { node.open = true; });
  });
  window.addEventListener('afterprint', () => {
    if (!printState) return;
    printState.forEach(([node, open]) => { node.open = open; }); printState = null;
  });
})();
