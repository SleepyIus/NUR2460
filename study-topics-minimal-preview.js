/* Design-preview setup only; teaching records and save handlers stay unchanged. */
(function () {
  const main = document.querySelector('.main-content');
  if (!main || main.dataset.minimalLayout || document.getElementById('topicsPreviewBar')) return;
  main.dataset.minimalLayout = 'true';
  const bar = document.createElement('div');
  bar.id = 'topicsPreviewBar';
  bar.className = 'topics-preview-bar';
  bar.innerHTML = '<span>Topics · minimalist preview</span><a href="NUR2460StudyTool.html">Original design ↗</a>';
  const warning = document.createElement('p');
  warning.className = 'topics-preview-state';
  warning.textContent = 'Preview only — changes to notes, stars, and progress here are temporary.';
  if (!window.NURMinimalDefault) {
    main.insertBefore(warning, main.firstChild);
    main.insertBefore(bar, main.firstChild);
  }
  document.querySelectorAll('.back-home, .back-home-mobile').forEach(link => { link.href = window.NURMinimalDefault ? 'index.html' : 'index-minimal-preview.html'; });
  document.querySelectorAll('.exam-accordion, .planner-part, .nav-section').forEach(section => { section.classList.add('collapsed'); });
  document.querySelectorAll('.nav-part-label').forEach(label => {
    // Exam 4 originally used static labels; keep its newly closed groups operable.
    if (!label.getAttribute('onclick')) {
      label.addEventListener('click', () => togglePart(label));
      const caret = document.createElement('span');
      caret.className = 'caret';
      caret.setAttribute('aria-hidden', 'true');
      caret.textContent = '▾';
      label.appendChild(caret);
    }
    if (!label.classList.contains('collapsed')) togglePart(label);
    label.setAttribute('role', 'button');
    label.setAttribute('tabindex', '0');
    label.setAttribute('aria-expanded', 'false');
    label.addEventListener('click', () => label.setAttribute('aria-expanded', String(!label.classList.contains('collapsed'))));
    label.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); label.click(); }
    });
  });
})();
