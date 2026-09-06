/* Shared, nonclinical schema and atomic device-local storage for Anki-style study. */
(function (root) {
  'use strict';
  const KEY = 'nur2460_fc_anki_v1', RECOVERY = 'nur2460_fc_anki_recovery_v1';
  const CARD_KEYS = ['nur2460_fc_stars', 'nur2460_fc_collections_v1', 'nur2460_fc_mastery', 'nur2460_fc_accuracy', 'nur2460_fc_schedule', 'nur2460_fc_state_version'];
  const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const count = value => Number.isSafeInteger(value) && value >= 0;
  const id = value => typeof value === 'string' && value.length > 0 && value.length <= 256 && !['__proto__', 'constructor', 'prototype'].includes(value);
  const ids = value => Array.isArray(value) && value.length <= 100000 && value.every(id);
  const unique = value => ids(value) && new Set(value).size === value.length;
  const four = value => Array.isArray(value) && value.length === 4 && value.every(count);
  const exact = (value, keys) => record(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
  function require(condition) { if (!condition) throw new Error('Anki review data is malformed or uses an unsupported version. Nothing was replaced.'); }
  function validateCardState(state) {
    require(exact(state, CARD_KEYS));
    for (const key of CARD_KEYS) {
      const raw = state[key];
      if (raw === null) continue;
      require(typeof raw === 'string');
      if (key === 'nur2460_fc_state_version') { require(['1', '2'].includes(raw)); continue; }
      const value = JSON.parse(raw);
      require(record(value));
      if (key === 'nur2460_fc_collections_v1') {
        require(value.version === 1 && record(value.collections) && record(value.collections.focus) && unique(value.collections.focus.cardIds));
      } else {
        require(Object.keys(value).every(id));
        const values = Object.values(value);
        if (key === 'nur2460_fc_stars') require(values.every(item => typeof item === 'boolean'));
        if (key === 'nur2460_fc_mastery') require(values.every(count));
        if (key === 'nur2460_fc_schedule') require(values.every(item => Number.isFinite(item) && item >= 0));
        if (key === 'nur2460_fc_accuracy') require(values.every(item => record(item) && count(item.r ?? 0) && count(item.w ?? 0)));
      }
    }
    if (state.nur2460_fc_collections_v1 && state.nur2460_fc_stars) {
      const focused = JSON.parse(state.nur2460_fc_collections_v1).collections.focus.cardIds;
      const stars = Object.entries(JSON.parse(state.nur2460_fc_stars)).filter(([, on]) => on).map(([key]) => key);
      require(stars.length === focused.length && stars.every(key => focused.includes(key)));
    }
  }
  function validate(value) {
    require(exact(value, ['version', 'updatedAt', 'cards', 'cardState', 'session']) && value.version === 1 && typeof value.updatedAt === 'string' && Number.isFinite(Date.parse(value.updatedAt)));
    validateCardState(value.cardState);
    require(record(value.cards) && Object.keys(value.cards).every(id));
    for (const item of Object.values(value.cards)) require(exact(item, ['ratings', 'lastRating', 'reviewedAt']) && four(item.ratings) && [1, 2, 3, 4].includes(item.lastRating) && Number.isFinite(item.reviewedAt) && item.reviewedAt >= 0);
    const s = value.session;
    if (s === null) return value;
    require(exact(s, ['pool', 'queue', 'position', 'ratings', 'completed', 'repeats', 'wrong', 'source', 'focusDueOnly', 'selectedTopics', 'shuffleOn', 'starFilterOn', 'dueOnly']));
    require(unique(s.pool) && ids(s.queue) && count(s.position) && s.position <= s.queue.length && four(s.ratings));
    require(unique(s.completed) && unique(s.repeats) && unique(s.wrong) && unique(s.selectedTopics));
    require(['standard', 'focus'].includes(s.source) && ['focusDueOnly', 'shuffleOn', 'starFilterOn', 'dueOnly'].every(key => typeof s[key] === 'boolean'));
    const pool = new Set(s.pool), completed = new Set(s.completed), pending = s.queue.slice(s.position);
    require([s.queue, s.completed, s.repeats, s.wrong].every(list => list.every(key => pool.has(key))));
    require(new Set(pending).size === pending.length && s.completed.every(key => !pending.includes(key)) && s.repeats.every(key => pending.includes(key) && !completed.has(key)));
    require(completed.size + pending.length === pool.size && s.ratings.reduce((a, b) => a + b, 0) === s.position);
    return value;
  }
  function parse(raw) {
    require(typeof raw === 'string' && raw.length <= 8000000);
    try { return validate(JSON.parse(raw)); } catch (_) { throw new Error('Anki review data is malformed or uses an unsupported version. Nothing was replaced.'); }
  }
  const snapshot = storage => Object.fromEntries(CARD_KEYS.map(key => [key, storage.getItem(key)]));
  function hydrate(storage, state) { for (const key of CARD_KEYS) state[key] === null ? storage.removeItem(key) : storage.setItem(key, state[key]); }
  function connect(native, memory) {
    let expected = null, initial = null, error = null, originalSnapshot = null;
    try { originalSnapshot = JSON.stringify(snapshot(native)); expected = native.getItem(KEY); if (expected !== null) { initial = parse(expected); hydrate(memory, initial.cardState); } }
    catch (failure) { error = failure.message; }
    function fresh(replacement = false) {
      if (error && !replacement) throw new Error(error);
      if (native.getItem(KEY) !== expected) throw new Error('Saved Anki data changed in another tab or was restored. Reload this page before continuing.');
      if (!replacement && expected === null && JSON.stringify(snapshot(native)) !== originalSnapshot) throw new Error('Original Flashcards progress changed before this Anki session was saved. Reload to use the current saved data.');
    }
    function save(value, backup = false) {
      fresh(backup); validate(value);
      const raw = JSON.stringify(value);
      if (backup) native.setItem(RECOVERY, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), raw: expected }));
      native.setItem(KEY, raw); // One atomic write holds ratings, schedules, Focus, and queue.
      expected = raw;
    }
    function recover() {
      const raw = native.getItem(RECOVERY);
      if (!raw) throw new Error('No Anki recovery backup is available.');
      const value = JSON.parse(raw);
      require(exact(value, ['version', 'savedAt', 'raw']) && value.version === 1 && typeof value.savedAt === 'string' && Number.isFinite(Date.parse(value.savedAt)));
      if (value.raw !== null) parse(value.raw);
      return value;
    }
    function restoreRecovery(reviewed) {
      fresh(true);
      const recovery = recover();
      if (JSON.stringify(recovery) !== reviewed) throw new Error('The recovery backup changed. Review it again before restoring.');
      const before = expected;
      native.setItem(RECOVERY, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), raw: before }));
      try { if (recovery.raw === null) native.removeItem(KEY); else native.setItem(KEY, recovery.raw); }
      catch (failure) { native.setItem(RECOVERY, JSON.stringify(recovery)); throw failure; }
      expected = recovery.raw;
    }
    return { initial, error, save, fresh, recover, restoreRecovery, current: () => expected };
  }
  root.NURAnkiState = { KEY, RECOVERY, CARD_KEYS, validate, parse, snapshot, hydrate, connect };
})(window);
