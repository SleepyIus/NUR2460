/* The preview shadows storage with an in-memory copy. Existing hub scripts use
   these bindings, so preview controls never write the user's saved state. */
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
