/* Saved Anki review and explicit, recoverable backup actions. No original keys are written. */
(function () {
  if (document.getElementById('ankiBackupPanel')) return;
  const api = window.flashcardsAnki, schema = window.NURAnkiState, store = window.NURAnkiPersistence;
  const get = id => document.getElementById(id);
  let history = store?.initial?.cards || {}, pendingImport = null, pendingRecovery = null, blocked = false;
  let heldSession = store?.initial?.session || null;
  const note = document.querySelector('.fc-preview-state');
  note.setAttribute('role', 'status'); note.setAttribute('aria-live', 'polite');
  function status(message, error = false) {
    note.textContent = window.NURMinimalDefault ? message.replace(/Original Flashcards/g, 'Legacy Flashcards').replace(/original Flashcards/g, 'legacy Flashcards') : message;
    note.classList.toggle('anki-save-error', error);
    // Quiet normal saving on the default page; keep blocking/errors visible.
    note.hidden = !!window.NURMinimalDefault && !error && /^Anki review (saved|loaded|saves)/.test(message);
  }
  const resume = document.createElement('button');
  resume.type = 'button'; resume.id = 'ankiResume'; resume.className = 'anki-study-button';
  resume.textContent = 'Resume saved session'; resume.hidden = true;
  get('gridView').insertBefore(resume, get('gridView').firstChild);
  resume.addEventListener('click', () => { if (!blocked) switchMode('study'); });
  const backup = document.createElement('details');
  backup.id = 'ankiBackupPanel'; backup.className = 'anki-backup';
  backup.innerHTML = '<summary>Backup &amp; restore</summary><p>Anki review is saved in this browser, separately from original Flashcards progress. Export a copy before clearing browser data or moving devices.</p><div class="anki-backup-actions"><button type="button" id="ankiExport">Export saved Anki data</button><button type="button" id="ankiRecover">Review recovery backup</button></div><label for="ankiBackupCode">Backup code</label><textarea id="ankiBackupCode" rows="5" spellcheck="false" placeholder="Export a backup or paste one to restore"></textarea><p id="ankiBackupStatus" role="status" aria-live="polite"></p><div class="anki-backup-actions"><button type="button" id="ankiCopy">Copy code</button><button type="button" id="ankiValidate">Validate import</button></div><label class="anki-backup-confirm"><input type="checkbox" id="ankiBackupConfirm" disabled>Replace saved Anki data with the validated backup. Current data will become the recovery backup.</label><div class="anki-backup-actions"><button type="button" id="ankiRestore" disabled>Back up &amp; restore</button></div>';
  get('gridView').appendChild(backup);
  if (window.NURMinimalDefault) backup.querySelector('p').textContent = 'Anki review is saved in this browser. Older Flashcards history is retained separately in hub backups. Export a copy before clearing browser data or moving devices.';
  function backupStatus(message) { get('ankiBackupStatus').textContent = message; }
  function invalidate() { pendingImport = null; pendingRecovery = null; get('ankiBackupConfirm').checked = false; get('ankiBackupConfirm').disabled = true; get('ankiRestore').disabled = true; }
  get('ankiBackupCode').addEventListener('input', invalidate);
  get('ankiBackupConfirm').addEventListener('change', () => { get('ankiRestore').disabled = !(get('ankiBackupConfirm').checked && !get('ankiBackupConfirm').disabled && (pendingImport || pendingRecovery)); });
  function snapshot() {
    return { version: 1, updatedAt: new Date().toISOString(), cards: history, cardState: schema.snapshot(localStorage), session: heldSession || api.captureSession() };
  }
  function syncResume() {
    const s = heldSession || api.captureSession();
    resume.hidden = !s || s.position >= s.queue.length;
    resume.disabled = blocked;
    if (s) resume.textContent = 'Resume session · ' + (s.queue.length - s.position) + ' cards remaining';
  }
  function transact(action, rating = null, replacing = false) {
    if (blocked || !store || store.error) { status('Saving is unavailable. Reload after resolving the storage issue; no new review changes were applied.', true); return; }
    if (heldSession && rating) { status('The saved session contains unavailable cards. Start a new deck before rating; the saved session remains in your backup.', true); return; }
    const before = snapshot(), revealed = get('cardA').classList.contains('visible');
    try {
      store.fresh();
      if (replacing) heldSession = null;
      const result = action();
      if (rating) {
        const prior = history[rating.id] || { ratings: [0, 0, 0, 0] };
        const counts = prior.ratings.slice(); counts[rating.value - 1]++;
        history = { ...history, [rating.id]: { ratings: counts, lastRating: rating.value, reviewedAt: Date.now() } };
      }
      const unfinished = before.session && before.session.position < before.session.queue.length;
      store.save(snapshot(), !!(replacing && unfinished));
      status('Anki review saved on this device. Original Flashcards progress is separate.'); syncResume();
      return result;
    } catch (error) {
      history = before.cards; schema.hydrate(localStorage, before.cardState); heldSession = null;
      try { api.restoreSession(before.session); if (revealed) revealAnswer(); } catch (_) { heldSession = before.session; }
      updateFocusCount(); renderDashboard();
      if (get('focusView').classList.contains('active')) renderFocus();
      blocked = true; syncResume();
      status('Not saved: ' + error.message + ' The last saved data is intact. Reload before continuing.', true);
    }
  }
  window.NURAnkiSession = { transact };
  const originalBegin = beginRound;
  beginRound = cards => transact(() => originalBegin(cards), null, true);
  const originalFocus = toggleFocused;
  toggleFocused = id => {
    const previous = isFocused(id);
    const result = transact(() => originalFocus(id));
    return result === undefined ? previous : result;
  };
  get('ankiExport').addEventListener('click', () => {
    invalidate();
    try {
      const raw = window.localStorage.getItem(schema.KEY);
      if (raw === null) throw new Error('No saved Anki review yet. Study a card or save a Focus card first.');
      // Export exact bytes even when a newer or damaged record cannot be resumed.
      get('ankiBackupCode').value = JSON.stringify({ _version: 'NUR2460_v3', _exportDate: new Date().toISOString(), [schema.KEY]: raw }, null, 2);
      backupStatus('Saved data exported. Copy this code somewhere safe.');
    } catch (error) { backupStatus(error.message); }
  });
  get('ankiCopy').addEventListener('click', async () => {
    const field = get('ankiBackupCode'); field.select();
    try { if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(field.value); else if (!document.execCommand('copy')) throw new Error(); backupStatus('Copied. Keep the code in a safe place.'); }
    catch (_) { backupStatus('Copy was unavailable. Select the code and copy it manually.'); }
  });
  get('ankiValidate').addEventListener('click', () => {
    invalidate();
    try {
      const raw = get('ankiBackupCode').value.trim(), value = JSON.parse(raw);
      if (!['NUR2460_v1', 'NUR2460_v2', 'NUR2460_v3'].includes(value?._version) || !Object.hasOwn(value, schema.KEY)) throw new Error('This code has no Anki review category. Import older original Flashcards backups through the hub.');
      schema.parse(value[schema.KEY]); pendingImport = { raw, value: value[schema.KEY] };
      get('ankiBackupConfirm').disabled = false;
      backupStatus('Validated. Only Anki review, ratings, Focus, schedules, and session will be replaced. Original Flashcards and all other categories stay unchanged.');
    } catch (error) { backupStatus(error.message); }
  });
  get('ankiRecover').addEventListener('click', () => {
    invalidate();
    try { const value = store.recover(); pendingRecovery = JSON.stringify(value); get('ankiBackupConfirm').disabled = false; backupStatus('Recovery snapshot from ' + value.savedAt + '. Confirm to restore it; current Anki data becomes the next recovery backup.'); }
    catch (error) { backupStatus(error.message); }
  });
  get('ankiRestore').addEventListener('click', () => {
    if (!get('ankiBackupConfirm').checked) return;
    try {
      if (pendingImport) {
        if (get('ankiBackupCode').value.trim() !== pendingImport.raw) throw new Error('The code changed. Validate it again.');
        store.save(schema.parse(pendingImport.value), true);
      } else if (pendingRecovery) store.restoreRecovery(pendingRecovery);
      else throw new Error('Validate an import or review recovery first.');
      blocked = true; invalidate(); syncResume();
      status('Anki data restored. Reload this page to use it. Your previous data is in the recovery backup.');
      backupStatus('Restored successfully. Reload this page before studying.');
    } catch (error) { invalidate(); backupStatus(error.message); }
  });
  if (!store || store.error) { blocked = true; status('Anki saving unavailable: ' + (store?.error || 'storage support did not load') + '. Existing saved data has not been changed.', true); }
  else {
    if (heldSession) {
      try { api.restoreSession(heldSession); heldSession = null; }
      catch (error) { status(error.message, true); resume.disabled = true; }
    }
    if (!heldSession) status(store.initial ? 'Anki review loaded. Choose Resume session to continue; decks stay closed.' : 'Anki review saves on this device, separately from original Flashcards progress.');
  }
  syncResume();
  if (heldSession) resume.disabled = true;
  // A restore/reset elsewhere must not be silently overwritten by this tab.
  window.addEventListener('storage', event => { if (event.key === null || event.key === schema.KEY) { blocked = true; syncResume(); status('Saved Anki data changed elsewhere. Reload to continue safely.', true); } });
})();
