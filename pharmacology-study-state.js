/* Device-local Pharmacology study data. No clinical records or legacy keys change. */
(function (root) {
  'use strict';
  const KEY = 'nur2460_pharm_study_v1', RECOVERY = 'nur2460_pharm_study_recovery_v1';
  const colors = ['yellow', 'green', 'pink', 'blue'];
  const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const id = value => typeof value === 'string' && value.length > 0 && value.length <= 256 && !['__proto__', 'prototype', 'constructor'].includes(value);
  const string = (value, max) => typeof value === 'string' && value.length <= max;
  const date = value => string(value, 64) && Number.isFinite(Date.parse(value));
  const exact = (value, keys) => record(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
  const withFormat = (value, keys, version) => exact(value, keys) || (version >= 2 && exact(value, [...keys, 'noteFormat']) && (version >= 3 ? ['plain', 'markdown', 'html-v1'] : ['plain', 'markdown']).includes(value.noteFormat));
  const defaultPreferences = () => ({ examScope: 'all', lastMedication: null, headerCollapsed: true, recallMode: false });
  function validPreferences(value) {
    return exact(value, ['examScope', 'lastMedication', 'headerCollapsed', 'recallMode']) && ['all', 'Exam 1', 'Exam 2', 'Exam 3', 'Exam 4'].includes(value.examScope)
      && typeof value.headerCollapsed === 'boolean' && typeof value.recallMode === 'boolean'
      && (value.lastMedication === null || (exact(value.lastMedication, ['id', 'view']) && id(value.lastMedication.id) && ['deep', 'brief'].includes(value.lastMedication.view)));
  }
  function require(ok) { if (!ok) throw new Error('Medication study data is malformed or uses an unsupported version. Nothing was replaced.'); }
  function validate(value) {
    require(record(value) && [1, 2, 3].includes(value.version));
    require(exact(value, value.version === 1 ? ['version', 'updatedAt', 'medications'] : ['version', 'updatedAt', 'medications', 'preferences']) && date(value.updatedAt) && record(value.medications));
    if (value.version >= 2) require(validPreferences(value.preferences));
    require(Object.keys(value.medications).length <= 10000 && Object.keys(value.medications).every(id));
    const annotationIds = new Set();
    for (const med of Object.values(value.medications)) {
      require(withFormat(med, ['note', 'bookmarked', 'boxes', 'annotations'], value.version) && string(med.note, 100000) && typeof med.bookmarked === 'boolean');
      require(Array.isArray(med.boxes) && med.boxes.length <= 1000 && med.boxes.every(id) && new Set(med.boxes).size === med.boxes.length);
      require(Array.isArray(med.annotations) && med.annotations.length <= 2000);
      for (const item of med.annotations) {
        require(withFormat(item, ['id', 'scope', 'view', 'text', 'start', 'prefix', 'suffix', 'color', 'note', 'createdAt', 'updatedAt'], value.version));
        require(id(item.id) && !annotationIds.has(item.id) && id(item.scope) && ['deep', 'brief'].includes(item.view)); annotationIds.add(item.id);
        require(string(item.text, 20000) && item.text.trim().length > 0 && Number.isSafeInteger(item.start) && item.start >= 0);
        require(string(item.prefix, 80) && string(item.suffix, 80) && colors.includes(item.color) && string(item.note, 100000) && date(item.createdAt) && date(item.updatedAt));
      }
    }
    return value;
  }
  function parse(raw) {
    require(string(raw, 8000000));
    try { return validate(JSON.parse(raw)); } catch (_) { throw new Error('Medication study data is malformed or uses an unsupported version. Nothing was replaced.'); }
  }
  const empty = () => ({ version: 1, updatedAt: new Date().toISOString(), medications: {} });
  const emptyMedication = () => ({ note: '', bookmarked: false, boxes: [], annotations: [] });
  const clone = value => JSON.parse(JSON.stringify(value));
  // Lossless, on-write migration: v1 notes remain literal text, and every identity survives.
  function upgrade(value) { const next = clone(validate(value)); if (next.version === 1) next.preferences = defaultPreferences(); next.version = 3; return next; }
  function connect(storage) {
    let expected = null, state = empty(), error = null;
    function reload() {
      try { const raw = storage.getItem(KEY), next = raw === null ? empty() : parse(raw); expected = raw; state = next; error = null; }
      catch (failure) { error = failure.message; }
      return !error;
    }
    reload();
    function fresh() {
      if (error) throw new Error(error);
      if (storage.getItem(KEY) !== expected) throw new Error('Medication study data changed in another tab or was restored. Copy any unsaved note, then reload this page before saving.');
    }
    function save(value, backup = false) {
      fresh(); validate(value); const raw = JSON.stringify(value); parse(raw);
      if (backup) storage.setItem(RECOVERY, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), raw: expected }));
      storage.setItem(KEY, raw); // Atomic write: advance memory only after it succeeds.
      expected = raw; state = clone(value);
    }
    function update(medicationId, change) {
      require(id(medicationId)); fresh(); const next = upgrade(state);
      const med = Object.hasOwn(next.medications, medicationId) ? next.medications[medicationId] : emptyMedication();
      change(med); next.medications[medicationId] = med; next.updatedAt = new Date().toISOString(); save(next);
      return clone(med);
    }
    function preferences(change) {
      fresh(); const next = upgrade(state), before = JSON.stringify(next.preferences);
      change(next.preferences); require(validPreferences(next.preferences));
      if (before === JSON.stringify(next.preferences)) return;
      next.updatedAt = new Date().toISOString(); save(next);
    }
    function recovery() {
      const raw = storage.getItem(RECOVERY); if (!raw) throw new Error('No medication-study recovery backup is available.');
      const value = JSON.parse(raw); require(exact(value, ['version', 'savedAt', 'raw']) && value.version === 1 && date(value.savedAt));
      if (value.raw !== null) parse(value.raw); return value;
    }
    function restoreRecovery(reviewed) {
      fresh(); const before = recovery();
      if (JSON.stringify(before) !== reviewed) throw new Error('The recovery backup changed. Review it again.');
      storage.setItem(RECOVERY, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), raw: expected }));
      try { if (before.raw === null) storage.removeItem(KEY); else storage.setItem(KEY, before.raw); }
      catch (failure) { storage.setItem(RECOVERY, JSON.stringify(before)); throw failure; }
      expected = before.raw; state = before.raw === null ? empty() : parse(before.raw);
    }
    return { update, preferences, save, fresh, reload, recovery, restoreRecovery, read: () => clone(state), raw: () => expected, error: () => error };
  }
  // Never relocate to an arbitrary repeated phrase after teaching text changes.
  function offsets(text, item) {
    const candidates = []; let from = 0;
    while (from <= text.length) { const start = text.indexOf(item.text, from); if (start < 0) break; candidates.push(start); from = start + Math.max(1, item.text.length); }
    const contextual = candidates.filter(start => text.slice(Math.max(0, start - item.prefix.length), start) === item.prefix && text.slice(start + item.text.length, start + item.text.length + item.suffix.length) === item.suffix);
    if (contextual.length === 1) return [contextual[0], contextual[0] + item.text.length];
    if (candidates.length === 1) return [candidates[0], candidates[0] + item.text.length];
    return null;
  }
  root.NURPharmStudyState = { KEY, RECOVERY, colors, empty, emptyMedication, defaultPreferences, upgrade, validate, parse, connect, offsets };
})(window);
