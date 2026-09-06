/* Preview learning tools: stable medication/field identity; clinical text is never rewritten. */
(function () {
  'use strict';
  if (document.getElementById('pharmStudyTools') || !window.NURPharmStudyState) return;
  const S = window.NURPharmStudyState, get = id => document.getElementById(id), body = get('modalBody');
  let native; try { native = window.localStorage; } catch (_) { native = { getItem() { throw new Error('Browser storage is unavailable. Copy your note before closing.'); } }; }
  const store = S.connect(native);
  const order = [...new Set([...Object.values(PHARM_CATS).flat(), ...Object.keys(DRUGS)])].filter(id => Object.hasOwn(DRUGS, id));
  const exams = Object.fromEntries(Object.entries(PHARM_EXAM_CATS).map(([exam, categories]) => [exam, new Set(categories.flatMap(key => PHARM_CATS[key] || []))]));
  const preferences = () => store.read().preferences || S.defaultPreferences();
  const inExam = (id, scope) => scope === 'all' || !!exams[scope]?.has(id);
  const navigationOrder = () => order.filter(id => inExam(id, preferences().examScope));
  const fieldNames = { 'Expected Pharmacological Action': 'action', 'Therapeutic Use': 'use', 'Complications / Adverse Effects': 'complications', 'Medication Administration': 'admin', 'Contraindications / Precautions': 'contraindications', 'Nursing Interventions': 'nursing', 'Interactions': 'interactions', 'Client Education': 'education', 'Evaluation of Medication Effectiveness': 'evaluation' };
  let pending = null, draft = null, draftTimer = null, editor = null, editorDirty = false, returnFocus = null, noteReturnFocus = null, restorePlan = null;
  const mode = () => isInQuickReview ? 'brief' : 'deep';
  const current = () => get('modalOverlay').classList.contains('show') ? currentDrugId : null;
  const medState = id => store.read().medications[id] || S.emptyMedication();
  function element(tag, className, text) { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; }
  function button(text, action, className = '') { const node = element('button', className, text); node.type = 'button'; node.addEventListener('click', action); return node; }
  function notify(message, error = false) {
    for (const id of ['pharmStudyStatus', 'pharmPanelStatus', 'pharmNoteStatus']) { const node = get(id); if (node) { node.textContent = message; node.classList.toggle('is-error', error); } }
  }
  function mutate(id, change) {
    try { store.update(id, change); notify('Saved on this device.'); updateTools(); return true; }
    catch (error) { notify('Not saved. ' + error.message, true); return false; }
  }
  function savePreference(change) {
    try { store.preferences(change); updateTools(); return true; }
    catch (error) { notify('Preference not saved. ' + error.message, true); updateTools(); return false; }
  }
  function rememberMedication() { const id = current(); if (id) savePreference(value => { value.lastMedication = { id, view: mode() }; }); }

  const tools = element('div', 'pharm-study-tools'); tools.id = 'pharmStudyTools'; tools.setAttribute('aria-label', 'Medication study tools'); tools.dataset.pharmUi = 'true';
  tools.innerHTML = '<div class="pharm-med-navigation"><button type="button" id="pharmPrevious">← Previous</button><span id="pharmPosition"></span><button type="button" id="pharmNext">Next →</button></div><button type="button" id="pharmMedicationBookmark" aria-pressed="false">☆ Bookmark</button><button type="button" id="pharmNotesButton">Notes & highlights</button><button type="button" id="pharmHighlightButton">Highlight selection</button><button type="button" id="pharmSavedButton">Saved study items</button><p id="pharmStudyStatus" class="pharm-study-status" role="status" aria-live="polite"></p>';
  get('modalRefs').parentElement.appendChild(tools);
  const mainSaved = button('Saved study items', () => openPanel('saved'), 'compare-btn'); mainSaved.id = 'pharmSavedLibrary'; document.querySelector('.pharm-preview-tools').appendChild(mainSaved);
  const overlay = element('div', 'pharm-study-overlay'); overlay.id = 'pharmStudyOverlay'; overlay.setAttribute('aria-hidden', 'true'); overlay.dataset.pharmUi = 'true';
  overlay.innerHTML = '<section class="pharm-study-dialog" role="dialog" aria-modal="true" aria-labelledby="pharmStudyTitle" tabindex="-1"><header><h2 id="pharmStudyTitle">Notes & saved study items</h2><button type="button" id="pharmStudyClose" aria-label="Close notes and saved study items">×</button></header><div class="pharm-study-panel-body"><p id="pharmPanelStatus" class="pharm-study-status" role="status" aria-live="polite"></p><section id="pharmWholeNote" hidden><label id="pharmNoteLabel" for="pharmNoteInput">Medication note</label><textarea id="pharmNoteInput" rows="6" maxlength="100000" placeholder="Your own study notes…"></textarea><div class="pharm-note-actions"><button type="button" id="pharmNoteSave">Save note</button><button type="button" id="pharmNoteCopy">Copy note</button><span>Notes save automatically on this device.</span></div></section><section id="pharmPassageEditor" hidden><h3>Passage note</h3><blockquote id="pharmPassageQuote"></blockquote><label for="pharmPassageColor">Highlight color</label><select id="pharmPassageColor"><option value="yellow">Yellow</option><option value="green">Green</option><option value="pink">Pink</option><option value="blue">Blue</option></select><label for="pharmPassageNote">Your note</label><textarea id="pharmPassageNote" rows="5" maxlength="100000"></textarea><div class="pharm-note-actions"><button type="button" id="pharmPassageSave">Save passage note</button><button type="button" id="pharmPassageCancel">Cancel</button></div></section><div class="pharm-library-heading"><h3>Saved items</h3><label for="pharmLibraryScope">Show</label><select id="pharmLibraryScope"><option value="current">This medication</option><option value="all">All medications</option></select></div><div id="pharmStudyList"></div><details class="pharm-study-backup"><summary>Backup & restore</summary><p>Includes medication notes, highlights, bookmarks, and starred boxes. Hub backups include these too; existing Topics and Anki data stay separate.</p><div class="pharm-note-actions"><button type="button" id="pharmStudyExport">Export</button><button type="button" id="pharmStudyValidate">Validate import</button><button type="button" id="pharmStudyRecover">Review recovery backup</button></div><label for="pharmStudyBackupCode">Backup code</label><textarea id="pharmStudyBackupCode" rows="5" spellcheck="false"></textarea><label class="pharm-restore-confirm"><input type="checkbox" id="pharmStudyConfirm" disabled> Replace medication notes, highlights, bookmarks, and starred boxes only. Save an export first; a recovery backup is also required before replacement.</label><button type="button" id="pharmStudyRestore" disabled>Restore</button><p id="pharmRestoreStatus" role="status"></p></details></div></section>';
  document.body.appendChild(overlay);
  const extraTools = element('div', 'pharm-extra-tools'); extraTools.id = 'pharmExtraTools';
  for (const id of ['pharmMedicationBookmark', 'pharmNotesButton', 'pharmHighlightButton', 'pharmSavedButton']) extraTools.appendChild(get(id));
  tools.insertBefore(extraTools, get('pharmStudyStatus'));
  const examLabel = element('label', 'pharm-exam-scope', 'Navigate '), examSelect = element('select'); examSelect.id = 'pharmExamScope'; examLabel.htmlFor = examSelect.id;
  for (const scope of ['all', ...Object.keys(exams)]) { const option = element('option', '', scope === 'all' ? 'All medications' : scope); option.value = scope; examSelect.appendChild(option); }
  examLabel.appendChild(examSelect); tools.insertBefore(examLabel, tools.firstChild);
  const startExam = button('Start this exam', () => { const first = navigationOrder()[0]; if (first) openDrug(first); }); startExam.id = 'pharmStartExam'; startExam.hidden = true; tools.querySelector('.pharm-med-navigation').appendChild(startExam);
  const collapseHeader = button('Show study tools', () => savePreference(value => { value.headerCollapsed = !value.headerCollapsed; })); collapseHeader.id = 'pharmHeaderToggle'; collapseHeader.setAttribute('aria-controls', 'modalSub modalRefs pharmExtraTools');
  document.querySelector('.pharm-preview-modal-tools').appendChild(collapseHeader);
  const recallToggle = button('Recall mode', () => { if (savePreference(value => { value.recallMode = !value.recallMode; })) { resetSelection(); applyRecall(); } }); recallToggle.id = 'pharmRecallToggle'; document.querySelector('.pharm-preview-modal-tools').appendChild(recallToggle);
  const recallHint = element('p', 'pharm-recall-hint', 'Recall: explain each box, then reveal it. This does not change your progress marks.'); recallHint.id = 'pharmRecallHint'; recallHint.dataset.pharmUi = 'true'; tools.appendChild(recallHint);
  const resume = button('Resume medication', resumeMedication, 'compare-btn'); resume.id = 'pharmResume'; resume.hidden = true; document.querySelector('.pharm-preview-tools').prepend(resume);
  const filters = element('div', 'pharm-library-filters');
  filters.innerHTML = '<label for="pharmLibrarySearch">Search saved items<input type="search" id="pharmLibrarySearch" placeholder="Medication, note, passage, or box…"></label><label for="pharmLibraryExam">Exam<select id="pharmLibraryExam"><option value="all">All exams & additional records</option><option>Exam 1</option><option>Exam 2</option><option>Exam 3</option><option>Exam 4</option></select></label><label for="pharmLibraryType">Item type<select id="pharmLibraryType"><option value="all">All saved items</option><option value="note">Notes</option><option value="annotation">Highlights & passage notes</option><option value="box">Starred boxes</option><option value="bookmark">Medication bookmarks</option></select></label>';
  get('pharmStudyList').before(filters);
  const printNotes = button('Print saved notes', printPersonalNotes); printNotes.id = 'pharmPrintNotes'; filters.appendChild(printNotes);
  const notePopover = element('section', 'pharm-note-popover'); notePopover.id = 'pharmNotePopover'; notePopover.dataset.pharmUi = 'true'; notePopover.setAttribute('role', 'dialog'); notePopover.setAttribute('aria-modal', 'true'); notePopover.setAttribute('aria-labelledby', 'pharmNotePopoverTitle'); notePopover.setAttribute('aria-hidden', 'true'); notePopover.tabIndex = -1;
  notePopover.innerHTML = '<header id="pharmNoteDragHandle"><h2 id="pharmNotePopoverTitle">✎ Note</h2><span aria-hidden="true">⠿ drag</span><button type="button" id="pharmNoteClose" aria-label="Close note">×</button></header><p id="pharmNoteStatus" class="pharm-study-status" role="status" aria-live="polite"></p>';
  const noteDismiss = element('div', 'pharm-note-dismiss'); noteDismiss.id = 'pharmNoteDismiss'; noteDismiss.dataset.pharmUi = 'true'; noteDismiss.setAttribute('aria-hidden', 'true'); noteDismiss.hidden = true; noteDismiss.addEventListener('click', () => closeNotePopover());
  notePopover.append(get('pharmWholeNote'), get('pharmPassageEditor')); document.body.append(noteDismiss, notePopover);
  for (const id of ['pharmNoteInput', 'pharmPassageNote']) {
    const old = get(id), field = element('div', 'pharm-rich-note'); field.id = id; field.contentEditable = 'true'; field.setAttribute('contenteditable', 'true'); field.setAttribute('role', 'textbox'); field.setAttribute('aria-multiline', 'true'); field.setAttribute('aria-label', id === 'pharmNoteInput' ? 'Medication note' : 'Note for selected text'); field.dataset.placeholder = id === 'pharmNoteInput' ? 'Your medication note…' : 'Add a note to this highlight…'; old.replaceWith(field); installFormatting(id);
  }
  get('pharmWholeNote').querySelector('.pharm-note-actions span').textContent = 'Autosaved on this device';
  const popColors = element('div', 'pharm-pop-colors'); popColors.setAttribute('role', 'group'); popColors.setAttribute('aria-label', 'Highlight color');
  for (const color of S.colors) { const swatch = button('', () => { get('pharmPassageColor').value = color; editorDirty = true; syncNoteColors(); }, 'pharm-highlight-swatch'); swatch.dataset.color = color; swatch.setAttribute('aria-label', color[0].toUpperCase() + color.slice(1) + ' highlight'); popColors.appendChild(swatch); }
  get('pharmPassageColor').hidden = true; get('pharmPassageColor').previousElementSibling.hidden = true; get('pharmPassageNote').previousElementSibling.prepend(popColors);
  const passageDelete = button('Delete', () => { if (!editor) return; if (deleteAnnotation(editor.id, editor.annotationId)) closeNotePopover(false); }, 'pharm-note-delete'); passageDelete.id = 'pharmPassageDelete'; get('pharmPassageEditor').querySelector('.pharm-note-actions').prepend(passageDelete);
  get('pharmPassageSave').textContent = 'Save'; get('pharmNoteSave').textContent = 'Save';
  const noteActions = element('div', 'pharm-current-note-actions'); noteActions.id = 'pharmCurrentNoteActions'; noteActions.appendChild(button('Medication note', () => editMedicationNote(current()))); noteActions.appendChild(button('Print notes', printPersonalNotes)); noteActions.appendChild(button('All saved study items', () => openPanel('saved'))); get('pharmPanelStatus').after(noteActions);
  const noteList = element('div'); noteList.id = 'pharmAnnotationList'; noteActions.after(noteList);
  const notesFab = button('', () => openPanel('notes'), 'pharm-annotation-fab'); notesFab.id = 'pharmAnnotationFab'; notesFab.dataset.pharmUi = 'true'; notesFab.innerHTML = '<span>Highlights &amp; Notes</span><span id="pharmAnnotationCount"></span>'; get('modalOverlay').appendChild(notesFab);
  overlay.querySelector('.pharm-study-backup p').textContent = 'Includes plain and formatted notes, highlights, bookmarks, starred boxes, exam navigation, resume location, and display preferences. Hub backups include these too; existing Topics and Anki data stay separate.';
  overlay.querySelector('.pharm-restore-confirm').lastChild.textContent = ' Replace medication study items and preferences only. Save an export first; a recovery backup is also required before replacement.';
  const selectionTools = element('div', 'pharm-selection-toolbar'); selectionTools.id = 'pharmSelectionTools'; selectionTools.hidden = true; selectionTools.dataset.pharmUi = 'true'; selectionTools.setAttribute('role', 'toolbar'); selectionTools.setAttribute('aria-label', 'Selected medication text');
  for (const color of S.colors) { const swatch = button('', () => createHighlight(color, false), 'pharm-highlight-swatch'); swatch.dataset.color = color; swatch.setAttribute('aria-label', 'Highlight selected text ' + color); swatch.title = 'Highlight ' + color; selectionTools.appendChild(swatch); }
  const selectionNote = button('✎ Note', () => createHighlight('yellow', true)); selectionNote.id = 'pharmSelectionNote'; selectionTools.appendChild(selectionNote);
  selectionTools.addEventListener('mousedown', event => event.preventDefault()); get('modalOverlay').appendChild(selectionTools);
  const previewState = document.querySelector('.pharm-preview-state');
  if (previewState) previewState.textContent = 'Medication notes, highlights, saved items, resume location, and study preferences save on this device and are included in backups. Review marks and theme changes in this design preview remain temporary.';

  function updateTools() {
    const order = navigationOrder();
    const id = current(), index = order.indexOf(id), saved = id ? medState(id) : S.emptyMedication();
    get('pharmPrevious').disabled = index <= 0; get('pharmNext').disabled = index < 0 || index >= order.length - 1;
    get('pharmPosition').textContent = index < 0 ? (id ? 'Outside selected exam' : '') : (index + 1) + ' / ' + order.length;
    get('pharmPrevious').setAttribute('aria-label', index > 0 ? 'Previous medication: ' + DRUGS[order[index - 1]].title : 'Previous medication');
    get('pharmNext').setAttribute('aria-label', index >= 0 && index < order.length - 1 ? 'Next medication: ' + DRUGS[order[index + 1]].title : 'Next medication');
    get('pharmMedicationBookmark').textContent = saved.bookmarked ? '★ Bookmarked' : '☆ Bookmark'; get('pharmMedicationBookmark').setAttribute('aria-pressed', String(saved.bookmarked));
    const noteCount = saved.annotations.length + (saved.note ? 1 : 0); get('pharmNotesButton').textContent = 'Highlights & Notes' + (noteCount ? ' (' + noteCount + ')' : '');
    notesFab.hidden = !id || !noteCount; get('pharmAnnotationCount').textContent = noteCount; notesFab.setAttribute('aria-label', 'Highlights and notes: ' + noteCount);
    for (const star of body.querySelectorAll('.pharm-box-star')) { const on = saved.boxes.includes(star.dataset.scope); star.textContent = on ? '★' : '☆'; star.setAttribute('aria-pressed', String(on)); star.setAttribute('aria-label', (on ? 'Unstar ' : 'Star ') + star.dataset.label + ' box'); }
    const prefs = preferences(); examSelect.value = prefs.examScope; startExam.hidden = !id || index >= 0 || !order.length;
    for (const node of [get('modalSub'), get('modalRefs'), extraTools]) node.hidden = prefs.headerCollapsed;
    collapseHeader.setAttribute('aria-expanded', String(!prefs.headerCollapsed)); collapseHeader.textContent = prefs.headerCollapsed ? 'Show study tools' : 'Hide study tools';
    recallToggle.setAttribute('aria-pressed', String(prefs.recallMode)); recallToggle.textContent = prefs.recallMode ? 'Recall on' : 'Recall mode'; recallToggle.disabled = mode() === 'brief';
    recallHint.hidden = !prefs.recallMode || mode() === 'brief';
    const last = prefs.lastMedication; resume.hidden = !last; resume.disabled = !!last && !Object.hasOwn(DRUGS, last.id);
    if (last) resume.textContent = Object.hasOwn(DRUGS, last.id) ? 'Resume: ' + DRUGS[last.id].title + ' · ' + (last.view === 'brief' ? 'Brief' : 'Deep') : 'Last medication unavailable — saved data retained';
  }
  function scopes() { return [...body.querySelectorAll('[data-pharm-scope]')]; }
  function scopeByKey(key) { return scopes().find(node => node.dataset.pharmScope === key); }
  function prepareScopes() {
    for (const box of body.querySelectorAll('.pharm-grid-cell')) {
      const heading = box.querySelector('h4'), label = [...heading.childNodes].filter(node => !(node.nodeType === 1 && node.hasAttribute('data-pharm-ui'))).map(node => node.textContent).join('');
      const key = fieldNames[label]; if (!key) continue; box.dataset.pharmScope = 'deep:' + key;
      if (!box.querySelector('.pharm-box-star')) {
        const star = button('☆', () => { const id = current(); if (id) mutate(id, state => { const index = state.boxes.indexOf('deep:' + key); index < 0 ? state.boxes.push('deep:' + key) : state.boxes.splice(index, 1); }); }, 'pharm-box-star');
        star.dataset.pharmUi = 'true'; star.dataset.scope = 'deep:' + key; star.dataset.label = label; heading.appendChild(star);
      }
    }
    for (const section of body.querySelectorAll('.qr-section')) { const key = ['tldr', 'facts', 'flags'].find(name => section.classList.contains(name)); if (key) section.dataset.pharmScope = 'brief:' + key; }
    body.querySelectorAll('.e1-learning').forEach((node, i) => { node.dataset.pharmScope = 'deep:learning:' + i; });
    updateTools();
    applyRecall();
  }
  function resumeMedication() {
    const last = preferences().lastMedication; if (!last || !Object.hasOwn(DRUGS, last.id)) return;
    if (openDrug(last.id) === false) return;
    if (last.view === 'brief') togglePharmQuickReview();
  }
  // The original heading and clinical nodes keep their identity. Only a reversible wrapper is added.
  function applyRecall() {
    const on = preferences().recallMode && mode() === 'deep';
    for (const box of body.querySelectorAll('.pharm-grid-cell[data-pharm-scope]')) {
      let content = box.querySelector(':scope > .pharm-recall-content'), control = box.querySelector(':scope > .pharm-recall-reveal');
      if (!on) { if (content) content.replaceWith(...content.childNodes); control?.remove(); continue; }
      if (!content) {
        content = element('div', 'pharm-recall-content'); content.id = 'pharmRecall-' + box.dataset.pharmScope.replace(':', '-');
        for (const node of [...box.childNodes]) if (node !== box.querySelector('h4') && !(node.nodeType === 1 && node.hasAttribute('data-pharm-ui'))) content.appendChild(node);
        content.hidden = true; box.appendChild(content);
        control = button('Reveal box', () => { content.hidden = !content.hidden; syncRecallButton(control, content); }, 'pharm-recall-reveal');
        control.dataset.pharmUi = 'true'; control.setAttribute('aria-controls', content.id); box.insertBefore(control, content);
      }
      syncRecallButton(control, content);
    }
  }
  function syncRecallButton(control, content) { control.textContent = content.hidden ? 'Reveal box' : 'Hide box'; control.setAttribute('aria-expanded', String(!content.hidden)); }
  function revealRecall(node) {
    const box = node.closest('.pharm-grid-cell'), content = box?.querySelector('.pharm-recall-content');
    if (content) { content.hidden = false; syncRecallButton(box.querySelector('.pharm-recall-reveal'), content); }
  }

  // Deliberately small Markdown subset: emphasis and lists only, no HTML, images, or executable links.
  function renderInline(target, text, depth = 0) {
    let buffer = '';
    const flush = () => { if (buffer) target.appendChild(document.createTextNode(buffer)); buffer = ''; };
    for (let i = 0; i < text.length;) {
      if (text[i] === '\\' && i + 1 < text.length) { buffer += text[i + 1]; i += 2; continue; }
      const token = text.startsWith('**', i) ? '**' : text[i] === '*' ? '*' : null;
      if (token && depth < 2) {
        let end = i + token.length;
        while (end < text.length) { if (text[end] === '\\') { end += 2; continue; } if (text.startsWith(token, end)) break; end++; }
        if (end < text.length && end > i + token.length) { flush(); const node = element(token === '**' ? 'strong' : 'em'); renderInline(node, text.slice(i + token.length, end), depth + 1); target.appendChild(node); i = end + token.length; continue; }
      }
      buffer += text[i++];
    }
    flush();
  }
  function renderNote(text, format = 'plain') {
    const result = element('div', 'pharm-saved-note'); result.dataset.format = format;
    if (format === 'html-v1') { result.appendChild(sanitizeNote(text)); return result; }
    if (format !== 'markdown') { result.textContent = text; return result; }
    let list = null, listType = null;
    for (const line of text.split('\n')) {
      const match = line.match(/^\s*(-|\d+\.)\s+(.*)$/), type = match ? (match[1] === '-' ? 'ul' : 'ol') : null;
      if (type) { if (listType !== type) { list = element(type); result.appendChild(list); listType = type; } const item = element('li'); renderInline(item, match[2]); list.appendChild(item); }
      else { list = null; listType = null; const paragraph = element('p'); if (line) renderInline(paragraph, line); else paragraph.appendChild(element('br')); result.appendChild(paragraph); }
    }
    return result;
  }
  function noteSearchText(item) {
    return notePlain(renderNote(item.note, item.noteFormat));
  }
  function sanitizeNote(html) {
    const source = document.createElement('template'); source.innerHTML = html || '';
    const result = document.createDocumentFragment(), allowed = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'BR', 'P', 'DIV', 'UL', 'OL', 'LI']);
    function copy(from, to, depth = 0) {
      if (depth > 80) { to.appendChild(document.createTextNode(from.textContent || '')); return; }
      for (const child of from.childNodes) {
        if (child.nodeType === 3) to.appendChild(document.createTextNode(child.nodeValue));
        else if (child.nodeType === 1 && !['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH', 'TEMPLATE', 'IMG', 'VIDEO', 'AUDIO', 'INPUT'].includes(child.tagName)) {
          if (allowed.has(child.tagName)) { const node = element(child.tagName.toLowerCase()); copy(child, node, depth + 1); to.appendChild(node); }
          else copy(child, to, depth + 1);
        }
      }
    }
    copy(source.content, result); return result;
  }
  function notePlain(node) {
    let value = ''; for (const child of node.childNodes) { if (child.nodeType === 3) value += child.nodeValue; else if (child.tagName === 'BR') value += '\n'; else { value += notePlain(child); if (['P', 'DIV', 'LI'].includes(child.tagName)) value += '\n'; } } return value.replace(/\n+$/, '');
  }
  function noteHtml(field) { const safe = element('div'); safe.appendChild(sanitizeNote(field.innerHTML)); return notePlain(safe).trim() ? safe.innerHTML : ''; }
  function loadNoteField(field, note) { field.replaceChildren(...renderNote(note.note, note.noteFormat).childNodes); field.dataset.format = 'html-v1'; }
  function installFormatting(id) {
    const field = get(id), toolbar = element('div', 'pharm-format-toolbar'); toolbar.setAttribute('role', 'toolbar'); toolbar.setAttribute('aria-label', id === 'pharmNoteInput' ? 'Medication note formatting' : 'Passage note formatting');
    for (const [label, action, glyph] of [['Bold', 'bold', 'B'], ['Italic', 'italic', 'I'], ['Underline', 'underline', 'U'], ['Bullet list', 'bullet', '•'], ['Numbered list', 'numbered', '1.']]) {
      const control = button(glyph, () => formatNote(field, action)); control.dataset.formatAction = action; control.setAttribute('aria-label', label); control.title = label; control.addEventListener('mousedown', event => event.preventDefault()); toolbar.appendChild(control);
    }
    field.before(toolbar);
    field.addEventListener('keydown', event => { if (!(event.metaKey || event.ctrlKey)) return; const action = { b: 'bold', i: 'italic', u: 'underline' }[event.key.toLowerCase()]; if (action) { event.preventDefault(); event.stopPropagation(); formatNote(field, action); } });
    field.addEventListener('paste', event => { event.preventDefault(); insertNoteText(field, event.clipboardData?.getData('text/plain') || ''); });
    field.addEventListener('drop', event => { event.preventDefault(); insertNoteText(field, event.dataTransfer?.getData('text/plain') || ''); });
  }
  function editorRange(field) { const selection = window.getSelection(); let range = selection.rangeCount ? selection.getRangeAt(0) : null; if (!range || !field.contains(range.startContainer) || !field.contains(range.endContainer)) { range = document.createRange(); range.selectNodeContents(field); range.collapse(false); selection.removeAllRanges(); selection.addRange(range); } return range; }
  function insertNoteText(field, text) { const range = editorRange(field); range.deleteContents(); const node = document.createTextNode(text); range.insertNode(node); range.setStartAfter(node); range.collapse(true); field.dispatchEvent(new Event('input', { bubbles: true })); }
  function formatNote(field, action) {
    field.focus(); const range = editorRange(field), command = { bullet: 'insertUnorderedList', numbered: 'insertOrderedList' }[action] || action;
    let applied = false; try { document.execCommand?.('styleWithCSS', false, false); applied = !!document.execCommand?.(command, false, null); } catch (_) { /* Range fallback below. */ }
    if (!applied) {
      if (range.collapsed) { notify('Select note text to format it.'); return; }
      const fragment = range.extractContents(), wrapper = element({ bold: 'strong', italic: 'em', underline: 'u', bullet: 'ul', numbered: 'ol' }[action]);
      if (action === 'bullet' || action === 'numbered') {
        const existing = fragment.firstChild; if (fragment.childNodes.length === 1 && ['UL', 'OL'].includes(existing?.tagName)) wrapper.append(...existing.childNodes);
        else { const lines = notePlain(fragment).split('\n'); for (const line of lines) wrapper.appendChild(element('li', '', line)); }
      } else wrapper.appendChild(fragment);
      range.insertNode(wrapper); range.selectNodeContents(wrapper); const selected = window.getSelection(); selected.removeAllRanges(); selected.addRange(range);
    }
    field.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function printPersonalNotes() {
    if (!flushNote()) return;
    if (editorDirty) { notify('Save or cancel your passage-note edit before printing.', true); return; }
    const report = element('section', 'pharm-personal-print'); report.id = 'pharmPersonalPrint';
    report.appendChild(element('h1', '', 'Pharmacology — personal study notes'));
    report.appendChild(element('p', '', 'Your personal notes, not verified teaching content. Scope: ' + (get('pharmLibraryScope').value === 'current' ? DRUGS[current()]?.title || 'This medication' : get('pharmLibraryExam').selectedOptions[0].textContent) + '.'));
    let count = 0;
    for (const [id, med] of filteredLibrary()) {
      const note = med.note && itemMatches(id, 'note', noteSearchText(med)), passages = med.annotations.filter(item => item.note && itemMatches(id, 'annotation', item.text + ' ' + noteSearchText(item) + ' ' + item.scope, true));
      if (!note && !passages.length) continue;
      const section = element('section'); section.appendChild(element('h2', '', DRUGS[id]?.title || id + ' — unavailable medication'));
      if (note) section.appendChild(renderNote(med.note, med.noteFormat));
      for (const item of passages) { section.appendChild(element('h3', '', 'Passage note · ' + item.view)); section.appendChild(element('blockquote', '', item.text)); section.appendChild(renderNote(item.note, item.noteFormat)); }
      report.appendChild(section); count++;
    }
    if (!count) { notify('No saved personal notes match these filters. Choose All saved items or Notes, or add a note first.'); return; }
    get('pharmPersonalPrint')?.remove(); document.body.appendChild(report); document.body.classList.add('pharm-print-personal');
    try { window.print(); } catch (error) { window.dispatchEvent(new Event('afterprint')); notify('Printing could not start. ' + error.message, true); }
  }
  function clearPersonalPrint() { get('pharmPersonalPrint')?.remove(); document.body.classList.remove('pharm-print-personal'); }
  function textMap(scope) {
    let text = ''; const segments = [];
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, { acceptNode(node) { return node.parentElement.closest('[data-pharm-ui],button,script,style,input,textarea,select') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; } });
    let node; while ((node = walker.nextNode())) { const start = text.length; text += node.nodeValue; segments.push({ node, start, end: text.length }); }
    return { text, segments };
  }
  function point(map, node, offset) {
    if (node.nodeType === 3) { const part = map.segments.find(piece => piece.node === node); return part ? part.start + offset : null; }
    const child = node.childNodes[offset];
    if (child) { const part = map.segments.find(piece => piece.node === child || child.contains(piece.node)); return part ? part.start : null; }
    const parts = map.segments.filter(piece => node.contains(piece.node)); return offset === node.childNodes.length && parts.length ? parts[parts.length - 1].end : null;
  }
  function unwrap() { for (const mark of body.querySelectorAll('mark.pharm-annotation')) { const parent = mark.parentNode; while (mark.firstChild) parent.insertBefore(mark.firstChild, mark); parent.removeChild(mark); parent.normalize(); } }
  function applyHighlights() {
    unwrap(); const id = current(); if (!id) return; const occupied = new Map();
    for (const item of medState(id).annotations) {
      if (item.view !== mode()) continue; const scope = scopeByKey(item.scope); if (!scope) continue;
      const map = textMap(scope), found = S.offsets(map.text, item); if (!found) continue;
      const ranges = occupied.get(item.scope) || []; if (ranges.some(([a, b]) => found[0] < b && found[1] > a)) continue; ranges.push(found); occupied.set(item.scope, ranges);
      for (const part of map.segments.slice().reverse()) {
        const start = Math.max(found[0], part.start), end = Math.min(found[1], part.end); if (start >= end) continue;
        const range = document.createRange(); range.setStart(part.node, start - part.start); range.setEnd(part.node, end - part.start);
        const mark = element('mark', 'pharm-annotation'); mark.dataset.annotationId = item.id; mark.dataset.color = item.color; mark.dataset.hasNote = String(!!item.note); mark.tabIndex = 0; mark.setAttribute('role', 'button'); mark.setAttribute('aria-label', item.note ? 'Edit highlighted passage and note' : 'Edit highlighted passage');
        range.surroundContents(mark);
      }
    }
  }
  function resetSelection() { pending = null; selectionTools.hidden = true; }
  function captureSelection(focus = false) {
    const selection = window.getSelection();
    if (!current() || overlay.classList.contains('show') || notePopover.classList.contains('show') || !selection || selection.isCollapsed || !selection.rangeCount) { resetSelection(); return; }
    const range = selection.getRangeAt(0), startNode = range.startContainer.nodeType === 3 ? range.startContainer.parentElement : range.startContainer, endNode = range.endContainer.nodeType === 3 ? range.endContainer.parentElement : range.endContainer;
    const scope = startNode.closest('[data-pharm-scope]');
    if (!scope || !body.contains(scope) || scope !== endNode.closest('[data-pharm-scope]')) { resetSelection(); if (focus) notify('Select text within one medication box or Brief section.'); return; }
    const map = textMap(scope), start = point(map, range.startContainer, range.startOffset), end = point(map, range.endContainer, range.endOffset);
    if (start === null || end === null || end <= start || !map.text.slice(start, end).trim()) { resetSelection(); return; }
    pending = { drug: current(), scope: scope.dataset.pharmScope, view: mode(), text: map.text.slice(start, end), start, prefix: map.text.slice(Math.max(0, start - 40), start), suffix: map.text.slice(end, end + 40) };
    selectionTools.hidden = false;
    const rect = range.getBoundingClientRect(), width = selectionTools.offsetWidth || 204, height = selectionTools.offsetHeight || 44; selectionTools.style.left = Math.max(8, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - 8)) + 'px'; selectionTools.style.top = (rect.top - height - 8 >= 8 ? rect.top - height - 8 : Math.min(rect.bottom + 8, window.innerHeight - height - 8)) + 'px';
    if (focus) selectionTools.querySelector('button').focus();
  }
  function createHighlight(color, withNote) {
    if (!pending || pending.drug !== current() || pending.view !== mode()) return;
    const scope = scopeByKey(pending.scope); if (!scope) return; const full = textMap(scope).text, found = S.offsets(full, pending); if (!found) { notify('Select a longer passage so this highlight can be located reliably.'); resetSelection(); return; }
    const saved = medState(current());
    if (saved.annotations.some(item => { if (item.scope !== pending.scope || item.view !== pending.view) return false; const range = S.offsets(full, item); return range && found[0] < range[1] && found[1] > range[0]; })) { notify('This passage overlaps an existing highlight. Click that highlight to edit it.'); resetSelection(); return; }
    const now = new Date().toISOString(), { drug, ...anchor } = pending;
    const item = { ...anchor, start: found[0], id: 'ph-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10), color, note: '', createdAt: now, updatedAt: now };
    if (!mutate(drug, med => med.annotations.push(item))) return;
    window.getSelection().removeAllRanges(); resetSelection(); applyHighlights(); if (withNote) editAnnotation(drug, item.id);
  }
  function flushNote() {
    if (draftTimer) { clearTimeout(draftTimer); draftTimer = null; }
    if (!draft) return true;
    if (!mutate(draft.id, med => { med.note = draft.text; med.noteFormat = 'html-v1'; })) return false;
    draft = null; return true;
  }
  function canLeaveEditor() { return !editorDirty || confirm('Discard the unsaved passage-note edit? The saved highlight and previous note will remain.'); }
  function closeNotePopover(ask = true) {
    if (!notePopover.classList.contains('show')) return flushNote();
    if (!flushNote() || (ask && !canLeaveEditor())) return false;
    editor = null; editorDirty = false; get('pharmWholeNote').hidden = true; get('pharmPassageEditor').hidden = true;
    notePopover.classList.remove('show'); notePopover.setAttribute('aria-hidden', 'true'); noteDismiss.hidden = true; window.NURPharmPreviewDialogs.sync(true);
    const target = [noteReturnFocus, notesFab, get('pharmNotesButton'), mainSaved].find(node => node?.isConnected && !node.hidden && !node.closest('[hidden],[inert]') && node.getClientRects().length); target?.focus(); noteReturnFocus = null; return true;
  }
  function showNotePopover(whole) {
    if (!closeNotePopover()) return false;
    noteReturnFocus = document.activeElement; if (overlay.classList.contains('show') && !closePanel()) return false;
    resetSelection(); get('pharmWholeNote').hidden = !whole; get('pharmPassageEditor').hidden = whole; get('pharmNotePopoverTitle').textContent = whole ? '✎ Medication note' : '✎ Note';
    notePopover.style.left = '50%'; notePopover.style.top = '50%'; get('pharmNoteStatus').textContent = ''; notePopover.classList.add('show'); notePopover.setAttribute('aria-hidden', 'false'); noteDismiss.hidden = false; window.NURPharmPreviewDialogs.sync(); return true;
  }
  function editMedicationNote(id) {
    if (!id || !showNotePopover(true)) return false;
    get('pharmNoteInput').dataset.drug = id; loadNoteField(get('pharmNoteInput'), medState(id)); get('pharmNoteLabel').textContent = DRUGS[id]?.title || id; get('pharmNoteInput').focus(); return true;
  }
  function syncNoteColors() { for (const node of popColors.children) node.setAttribute('aria-pressed', String(node.dataset.color === get('pharmPassageColor').value)); }
  function closePanel() {
    if (!closeNotePopover()) return false;
    overlay.classList.remove('show'); overlay.setAttribute('aria-hidden', 'true'); window.NURPharmPreviewDialogs.sync(true);
    if (returnFocus?.isConnected && !returnFocus.closest('[inert]')) returnFocus.focus(); returnFocus = null; return true;
  }
  function openPanel(kind = 'notes') {
    if (!closeNotePopover()) return false;
    returnFocus = document.activeElement; resetSelection(); const id = current(), notesOnly = kind === 'notes' && !!id;
    overlay.classList.toggle('is-annotations', notesOnly); get('pharmStudyTitle').textContent = notesOnly ? 'Highlights & Notes' : 'Saved study items'; noteList.hidden = !notesOnly; noteActions.hidden = !notesOnly;
    for (const node of [overlay.querySelector('.pharm-library-heading'), filters, get('pharmStudyList'), overlay.querySelector('.pharm-study-backup')]) node.hidden = notesOnly;
    get('pharmLibraryScope').value = notesOnly ? 'current' : 'all'; get('pharmLibraryScope').querySelector('option[value="current"]').disabled = !id;
    if (notesOnly) { get('pharmLibrarySearch').value = ''; get('pharmLibraryExam').value = 'all'; get('pharmLibraryType').value = 'all'; }
    renderLibrary(); overlay.classList.add('show'); overlay.setAttribute('aria-hidden', 'false'); window.NURPharmPreviewDialogs.sync(true);
    get('pharmStudyClose').focus(); return true;
  }
  function reveal(node) { revealRecall(node); for (let parent = node.parentElement; parent && parent !== body; parent = parent.parentElement) if (parent.tagName === 'DETAILS') parent.open = true; node.scrollIntoView({ block: 'center' }); node.setAttribute('tabindex', '0'); node.focus(); }
  function goTo(id, view = 'deep', scopeKey = null, annotationId = null, showNote = false) {
    if (!Object.hasOwn(DRUGS, id) || !closePanel()) return;
    openDrug(id); if (view === 'brief') togglePharmQuickReview();
    if (showNote) { editMedicationNote(id); return; }
    const target = annotationId ? [...body.querySelectorAll('mark.pharm-annotation')].find(node => node.dataset.annotationId === annotationId) : scopeKey ? scopeByKey(scopeKey) : null;
    if (target) reveal(target); else if (annotationId || scopeKey) notify('The saved passage or box is not available in this view. Your saved item has been kept.');
  }
  function editAnnotation(id, annotationId) {
    const item = medState(id).annotations.find(note => note.id === annotationId); if (!item) return;
    if (!showNotePopover(false)) return;
    editor = { id, annotationId }; editorDirty = false; get('pharmPassageQuote').textContent = item.text; loadNoteField(get('pharmPassageNote'), item); get('pharmPassageColor').value = item.color; syncNoteColors(); get('pharmPassageNote').focus();
  }
  function deleteAnnotation(id, annotationId) { if (!confirm('Delete this highlight and its passage note?')) return false; if (!mutate(id, med => { med.annotations = med.annotations.filter(item => item.id !== annotationId); })) return false; applyHighlights(); renderLibrary(); return true; }
  function renderAnnotations() {
    noteList.replaceChildren(); const id = current(); if (!id) return; const med = medState(id);
    if (med.note) { const row = element('article', 'pharm-annotation-card'); row.appendChild(element('strong', '', 'Medication note')); row.appendChild(renderNote(med.note, med.noteFormat)); const actions = element('div', 'pharm-annotation-actions'); actions.appendChild(button('Edit', () => editMedicationNote(id))); row.appendChild(actions); noteList.appendChild(row); }
    for (const item of med.annotations) {
      const row = element('article', 'pharm-annotation-card'); row.dataset.color = item.color; row.appendChild(element('blockquote', '', '“' + item.text + '”')); if (item.note) row.appendChild(renderNote(item.note, item.noteFormat));
      const actions = element('div', 'pharm-annotation-actions'); actions.append(button('Go to', () => goTo(id, item.view, item.scope, item.id)), button('Edit', () => editAnnotation(id, item.id)), button('Delete', () => deleteAnnotation(id, item.id), 'pharm-note-delete')); row.appendChild(actions); noteList.appendChild(row);
    }
    if (!noteList.children.length) noteList.appendChild(element('p', 'pharm-study-empty', 'No highlights yet. Select text in the medication, then choose a color or Note.'));
  }
  function boxLabel(key) { return Object.entries(fieldNames).find(([, value]) => key === 'deep:' + value)?.[0] || key; }
  function itemMatches(id, kind, text, hasNote = false) {
    const type = get('pharmLibraryType').value, query = get('pharmLibrarySearch').value.trim().toLocaleLowerCase();
    return (type === 'all' || type === kind || (type === 'note' && kind === 'annotation' && hasNote)) && (!query || [id, DRUGS[id]?.title || '', text].join(' ').toLocaleLowerCase().includes(query));
  }
  function filteredLibrary() {
    return Object.entries(store.read().medications).filter(([id, med]) => (get('pharmLibraryScope').value === 'all' || id === current()) && inExam(id, get('pharmLibraryExam').value)
      && ((med.bookmarked && itemMatches(id, 'bookmark', 'Medication bookmark')) || (med.note && itemMatches(id, 'note', noteSearchText(med))) || med.boxes.some(key => itemMatches(id, 'box', boxLabel(key))) || med.annotations.some(item => itemMatches(id, 'annotation', item.text + ' ' + noteSearchText(item) + ' ' + item.scope, !!item.note))));
  }
  function renderLibrary() {
    renderAnnotations();
    const list = get('pharmStudyList'); list.replaceChildren(); const entries = filteredLibrary();
    if (!entries.length) { list.appendChild(element('p', 'pharm-study-empty', 'No saved items match this scope or search. Clear the filters, or add a note, highlight, or starred box.')); return; }
    for (const [id, med] of entries) {
      const available = Object.hasOwn(DRUGS, id), group = element('details', 'pharm-saved-medication'); group.appendChild(element('summary', '', available ? DRUGS[id].title : id + ' — unavailable medication (saved data retained)'));
      const content = element('div', 'pharm-saved-content'); group.appendChild(content);
      if (med.bookmarked && itemMatches(id, 'bookmark', 'Medication bookmark')) { const row = element('div', 'pharm-saved-item'); row.appendChild(element('strong', '', '★ Medication bookmark')); const go = button('Open medication', () => goTo(id)); go.disabled = !available; row.appendChild(go); row.appendChild(button('Remove bookmark', () => { if (mutate(id, item => { item.bookmarked = false; })) renderLibrary(); })); content.appendChild(row); }
      if (med.note && itemMatches(id, 'note', noteSearchText(med))) { const row = element('article', 'pharm-saved-item'); row.appendChild(element('h4', '', 'Your medication note')); row.appendChild(renderNote(med.note, med.noteFormat)); const go = button('Edit medication note', () => goTo(id, 'deep', null, null, true)); go.disabled = !available; row.appendChild(go); content.appendChild(row); }
      for (const key of med.boxes) { const label = boxLabel(key); if (!itemMatches(id, 'box', label)) continue; const row = element('div', 'pharm-saved-item'); row.appendChild(element('strong', '', '★ ' + label)); const go = button('Go to box', () => goTo(id, 'deep', key)); go.disabled = !available; row.appendChild(go); row.appendChild(button('Unstar box', () => { if (mutate(id, item => { item.boxes = item.boxes.filter(value => value !== key); })) renderLibrary(); })); content.appendChild(row); }
      for (const item of med.annotations) { if (!itemMatches(id, 'annotation', item.text + ' ' + noteSearchText(item) + ' ' + item.scope, !!item.note)) continue; const row = element('article', 'pharm-saved-item pharm-saved-highlight'); row.dataset.color = item.color; row.appendChild(element('small', '', (item.view === 'brief' ? 'Brief' : 'Deep') + ' · ' + item.scope.replace(/^(deep|brief):/, ''))); row.appendChild(element('blockquote', '', item.text)); if (item.note) row.appendChild(renderNote(item.note, item.noteFormat)); const actions = element('div', 'pharm-note-actions'), go = button('Go to passage', () => goTo(id, item.view, item.scope, item.id)); go.disabled = !available; actions.appendChild(go); actions.appendChild(button('Edit', () => editAnnotation(id, item.id))); actions.appendChild(button('Delete', () => deleteAnnotation(id, item.id))); row.appendChild(actions); content.appendChild(row); }
      list.appendChild(group);
    }
  }
  function step(direction) {
    const order = navigationOrder();
    const index = order.indexOf(current()), next = order[index + direction]; if (index < 0 || !next || !flushNote()) return;
    const brief = isInQuickReview; if (openDrug(next) === false) return; if (brief) togglePharmQuickReview();
    get('modalOverlay').scrollTop = 0; get(direction < 0 ? 'pharmPrevious' : 'pharmNext').focus();
  }
  get('pharmPrevious').addEventListener('click', () => step(-1)); get('pharmNext').addEventListener('click', () => step(1));
  examSelect.addEventListener('change', () => { if (!flushNote() || !canLeaveEditor()) { updateTools(); return; } const scope = examSelect.value; if (savePreference(value => { value.examScope = scope; })) notify(scope === 'all' ? 'Navigation includes all medication records.' : scope + ' navigation uses the existing exam categories. Additional topic-linked records remain available under All medications.'); });
  get('pharmMedicationBookmark').addEventListener('click', () => { const id = current(); if (id) mutate(id, med => { med.bookmarked = !med.bookmarked; }); });
  get('pharmNotesButton').addEventListener('click', () => openPanel('notes')); get('pharmSavedButton').addEventListener('click', () => openPanel('saved')); get('pharmStudyClose').addEventListener('click', closePanel);
  get('pharmHighlightButton').addEventListener('mousedown', event => event.preventDefault()); get('pharmHighlightButton').addEventListener('click', () => { captureSelection(true); if (!pending) notify('Select a passage in one medication box, then choose a highlight color.'); });
  body.addEventListener('mouseup', () => captureSelection()); body.addEventListener('keyup', event => { if (!['Tab', 'Enter', 'Escape'].includes(event.key)) captureSelection(); });
  body.addEventListener('touchend', () => setTimeout(() => captureSelection(), 50));
  document.addEventListener('scroll', resetSelection, true);
  body.addEventListener('click', event => { const mark = event.target.closest('mark.pharm-annotation'); if (mark && window.getSelection().isCollapsed) editAnnotation(current(), mark.dataset.annotationId); });
  body.addEventListener('keydown', event => { const mark = event.target.closest('mark.pharm-annotation'); if (mark && ['Enter', ' '].includes(event.key)) { event.preventDefault(); editAnnotation(current(), mark.dataset.annotationId); } });
  overlay.addEventListener('click', event => { if (event.target === overlay) closePanel(); });
  get('pharmLibraryScope').addEventListener('change', renderLibrary);
  get('pharmLibrarySearch').addEventListener('input', renderLibrary); get('pharmLibraryExam').addEventListener('change', renderLibrary); get('pharmLibraryType').addEventListener('change', renderLibrary);
  get('pharmNoteInput').addEventListener('input', () => { draft = { id: get('pharmNoteInput').dataset.drug, text: noteHtml(get('pharmNoteInput')) }; if (draftTimer) clearTimeout(draftTimer); notify('Saving note…'); draftTimer = setTimeout(() => { if (flushNote()) renderLibrary(); }, 500); });
  get('pharmNoteSave').addEventListener('click', () => { if (flushNote()) { renderLibrary(); closeNotePopover(); } });
  get('pharmNoteCopy').addEventListener('click', async () => { const field = get('pharmNoteInput'), range = document.createRange(); range.selectNodeContents(field); window.getSelection().removeAllRanges(); window.getSelection().addRange(range); try { await navigator.clipboard.writeText(notePlain(field)); notify('Note copied.'); } catch (_) { notify('Your note is selected. Copy it with your keyboard or text-selection menu.'); } });
  for (const id of ['pharmPassageNote', 'pharmPassageColor']) get(id).addEventListener('input', () => { editorDirty = true; });
  get('pharmPassageCancel').addEventListener('click', () => closeNotePopover(false)); get('pharmNoteClose').addEventListener('click', () => closeNotePopover());
  get('pharmPassageSave').addEventListener('click', () => { if (!editor) return; const active = editor; if (mutate(active.id, med => { const item = med.annotations.find(value => value.id === active.annotationId); if (!item) throw new Error('This passage was removed. Your draft has not been saved.'); item.note = noteHtml(get('pharmPassageNote')); item.noteFormat = 'html-v1'; item.color = get('pharmPassageColor').value; item.updatedAt = new Date().toISOString(); })) { editorDirty = false; closeNotePopover(false); applyHighlights(); renderLibrary(); } });
  const dragHandle = get('pharmNoteDragHandle'); let drag = null;
  dragHandle.addEventListener('pointerdown', event => { if (event.target.closest('button') || event.button > 0) return; const rect = notePopover.getBoundingClientRect(); drag = { x: event.clientX, y: event.clientY, cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 }; dragHandle.setPointerCapture?.(event.pointerId); event.preventDefault(); });
  dragHandle.addEventListener('pointermove', event => { if (!drag) return; const rect = notePopover.getBoundingClientRect(), halfW = Math.min(rect.width / 2, window.innerWidth / 2 - 8), halfH = Math.min(rect.height / 2, window.innerHeight / 2 - 8); notePopover.style.left = Math.max(halfW + 8, Math.min(drag.cx + event.clientX - drag.x, window.innerWidth - halfW - 8)) + 'px'; notePopover.style.top = Math.max(halfH + 8, Math.min(drag.cy + event.clientY - drag.y, window.innerHeight - halfH - 8)) + 'px'; });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) dragHandle.addEventListener(event, () => { drag = null; });
  window.addEventListener('resize', () => { resetSelection(); if (notePopover.classList.contains('show')) { notePopover.style.left = '50%'; notePopover.style.top = '50%'; } });

  function clearRestore() { restorePlan = null; get('pharmStudyConfirm').checked = false; get('pharmStudyConfirm').disabled = true; get('pharmStudyRestore').disabled = true; }
  function reviewRestore(plan, message) { restorePlan = plan; get('pharmStudyConfirm').checked = false; get('pharmStudyConfirm').disabled = false; get('pharmStudyRestore').disabled = true; get('pharmRestoreStatus').textContent = message; }
  get('pharmStudyExport').addEventListener('click', () => { try { const raw = native.getItem(S.KEY); get('pharmStudyBackupCode').value = JSON.stringify({ _version: 'NUR2460_v3', _exportDate: new Date().toISOString(), [S.KEY]: raw === null ? JSON.stringify(S.empty()) : raw }, null, 2); get('pharmStudyBackupCode').select(); clearRestore(); get('pharmRestoreStatus').textContent = 'Saved-data export is selected. Copy it somewhere safe.' + (draft || editorDirty ? ' Unsaved edits are not included; copy those separately.' : ''); } catch (error) { notify(error.message, true); } });
  get('pharmStudyBackupCode').addEventListener('input', clearRestore);
  get('pharmStudyConfirm').addEventListener('change', () => { get('pharmStudyRestore').disabled = !(restorePlan && get('pharmStudyConfirm').checked); });
  get('pharmStudyValidate').addEventListener('click', () => { clearRestore(); try { const code = get('pharmStudyBackupCode').value, envelope = JSON.parse(code); if (!['NUR2460_v1', 'NUR2460_v2', 'NUR2460_v3'].includes(envelope._version) || typeof envelope[S.KEY] !== 'string') throw new Error('Use a medication-study export or a hub backup that includes medication study items.'); S.parse(envelope[S.KEY]); reviewRestore({ type: 'import', code, raw: envelope[S.KEY] }, 'Validated. Only medication study items will be replaced; Topics, Anki, and progress marks stay unchanged.'); } catch (error) { get('pharmRestoreStatus').textContent = error.message; } });
  get('pharmStudyRecover').addEventListener('click', () => { clearRestore(); try { const backup = store.recovery(); reviewRestore({ type: 'recovery', reviewed: JSON.stringify(backup) }, 'Recovery backup from ' + new Date(backup.savedAt).toLocaleString() + '. Confirm to restore medication study items only.'); } catch (error) { get('pharmRestoreStatus').textContent = error.message; } });
  get('pharmStudyRestore').addEventListener('click', () => {
    if (!restorePlan || !get('pharmStudyConfirm').checked || !flushNote() || !canLeaveEditor()) return;
    try { if (restorePlan.type === 'import') { if (get('pharmStudyBackupCode').value !== restorePlan.code) throw new Error('The code changed. Validate it again.'); store.save(S.parse(restorePlan.raw), true); } else store.restoreRecovery(restorePlan.reviewed);
      clearRestore(); closeNotePopover(false); prepareScopes(); applyHighlights(); renderLibrary(); get('pharmRestoreStatus').textContent = 'Medication study items and preferences restored. The previous saved state is available in the recovery backup.';
    } catch (error) { get('pharmRestoreStatus').textContent = error.message; }
  });
  const oldOpen = openDrug, oldClose = closeDrug, oldQuick = togglePharmQuickReview;
  openDrug = function (...args) { if (!Object.hasOwn(DRUGS, args[0])) return false; if (!closeNotePopover() || (overlay.classList.contains('show') && !closePanel())) return false; resetSelection(); const result = oldOpen.apply(this, args); prepareScopes(); applyHighlights(); rememberMedication(); return result; };
  closeDrug = function (...args) { if (!closeNotePopover() || (overlay.classList.contains('show') && !closePanel())) return false; resetSelection(); const result = oldClose.apply(this, args); updateTools(); return result; };
  togglePharmQuickReview = function (...args) { if (!closeNotePopover()) return false; resetSelection(); const result = oldQuick.apply(this, args); prepareScopes(); applyHighlights(); rememberMedication(); return result; };
  window.addEventListener('beforeunload', event => { if (!flushNote() || editorDirty) { event.preventDefault(); event.returnValue = ''; } });
  window.addEventListener('storage', event => { if (event.key !== S.KEY && event.key !== null) return; if (draft || editor) { notify('Saved medication study data changed elsewhere. Copy any unsaved note, then reload before editing or saving.', true); return; } if (store.reload()) { if (current()) loadNoteField(get('pharmNoteInput'), medState(current())); prepareScopes(); applyHighlights(); if (overlay.classList.contains('show')) renderLibrary(); } else notify(store.error(), true); });
  let printHidden = null;
  function restorePrintView() { if (printHidden) printHidden.forEach(([node, hidden]) => { node.hidden = hidden; }); printHidden = null; clearPersonalPrint(); }
  window.addEventListener('beforeprint', () => { resetSelection(); if (printHidden) return; printHidden = [...body.querySelectorAll('.pharm-recall-content'), get('modalSub'), get('modalRefs')].map(node => [node, node.hidden]); printHidden.forEach(([node]) => { node.hidden = false; }); });
  window.addEventListener('afterprint', restorePrintView);
  window.NURPharmStudy = { closePanel, openPanel, closeNotePopover, editMedicationNote, flushNote, dismissSelection() { if (selectionTools.hidden) return false; resetSelection(); window.getSelection().removeAllRanges(); return true; } };
  window.NURPharmPreviewDialogs.sync();
  updateTools(); if (store.error()) notify('Medication notes cannot be loaded. ' + store.error(), true);
})();
