/* Transactional working copy for Anki. The persistence layer commits the whole
   card state atomically under nur2460_fc_anki_v1; legacy progress is untouched. */
function minimalPreviewStorage(source) {
  const copy = new Map();
  try {
    for (let i = 0; i < source.length; i++) {
      const key = source.key(i);
      if (key !== null) copy.set(key, source.getItem(key));
    }
  } catch (_) { /* An unavailable store gives an empty, temporary preview. */ }
  return {
    get length() { return copy.size; },
    key(index) { return [...copy.keys()][index] ?? null; },
    getItem(key) { return copy.get(String(key)) ?? null; },
    setItem(key, value) { copy.set(String(key), String(value)); },
    removeItem(key) { copy.delete(String(key)); },
    clear() { copy.clear(); }
  };
}
const localStorage = minimalPreviewStorage((() => { try { return window.localStorage; } catch (_) { return null; } })());
const sessionStorage = minimalPreviewStorage((() => { try { return window.sessionStorage; } catch (_) { return null; } })());

// Theme remains a shared device preference, outside the atomic card record.
(function () {
  const get = localStorage.getItem, set = localStorage.setItem;
  localStorage.getItem = key => {
    if (key === 'studyTheme') { try { return window.localStorage.getItem(key); } catch (_) {} }
    return get(key);
  };
  localStorage.setItem = (key, value) => {
    if (key === 'studyTheme') window.localStorage.setItem(key, value);
    set(key, value);
  };
})();
