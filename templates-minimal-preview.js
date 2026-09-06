/* Preview chrome only. Original renderers, registry identities and print handlers remain intact. */
(function () {
  const main = document.getElementById('mainContent');
  if (!main || main.dataset.minimalLayout || document.getElementById('templatesPreviewBar')) return;
  main.dataset.minimalLayout = 'true';
  const bar = document.createElement('div');
  bar.id = 'templatesPreviewBar';
  bar.className = 'templates-preview-bar';
  bar.innerHTML = '<span>Templates · minimalist preview</span><a href="NUR2460Templates.html">Original design ↗</a>';
  const warning = document.createElement('p');
  warning.className = 'templates-preview-state';
  warning.textContent = 'Preview only — changes to stars, progress, search, and theme here are temporary. Your saved data and backups are unchanged.';
  if (!window.NURMinimalDefault) main.prepend(bar, warning);
  document.getElementById('pageTitle').textContent = 'ATI Templates';
  document.querySelectorAll('.sb-back, .back-home-mobile').forEach(link => { link.href = window.NURMinimalDefault ? 'index.html' : 'index-minimal-preview.html'; });
  document.getElementById('familySearch').setAttribute('aria-label', 'Search template families, fields, and named records');
  // The inherited renderer starts every family and evidence disclosure closed.
  // An explicit template/context or resume URL still opens the requested record.
})();
