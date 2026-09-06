/* Layout-only exploration. Move existing elements; keep their content and IDs. */
(function () {
  const main = document.getElementById('mainContent');
  if (!main || main.dataset.minimalLayout || document.getElementById('minimalPreviewNote')) return;
  main.dataset.minimalLayout = 'true';
  const note = document.createElement('div');
  note.id = 'minimalPreviewNote';
  note.className = 'preview-note';
  note.innerHTML = '<span>Minimalist preview</span><a href="index.html">Back to main index ↗</a>';
  const topbar = main.querySelector('.topbar');
  const hero = main.querySelector('.hero');
  const jumps = main.querySelector('.jump-links');
  const search = main.querySelector('.search-wrap');
  const toolsTitle = document.getElementById('studyToolsTitle');
  const cards = main.querySelector('.cards');
  const exams = main.querySelector('.exams');
  const pickup = document.getElementById('pickupPanel');
  const footer = main.querySelector('footer');

  function disclosure(node, heading) {
    const details = document.createElement('details');
    details.className = 'minimal-disclosure';
    const summary = document.createElement('summary');
    summary.appendChild(heading);
    details.appendChild(summary);
    details.appendChild(node);
    return details;
  }
  const practice = disclosure(document.getElementById('weakSpots'), document.getElementById('focusTitle'));
  const progress = disclosure(main.querySelector('.sync-section'), document.getElementById('syncTitle'));
  const safetyNote = document.createElement('p');
  safetyNote.className = 'import-warning';
  safetyNote.textContent = 'Design preferences on this page are temporary. Backup tools use saved device data; study-tool links open the existing tools.';
  if (!window.NURMinimalDefault) progress.insertBefore(safetyNote, progress.querySelector('.sync-section'));

  // DOM order and keyboard reading order match the new visual order.
  const first = main.firstChild;
  [window.NURMinimalDefault ? null : note, topbar, hero, jumps, search, toolsTitle, cards, exams, pickup, practice, progress, footer].filter(Boolean)
    .forEach(node => main.insertBefore(node, first));

  const tabs = document.createElement('nav');
  tabs.className = 'minimal-exam-tabs';
  tabs.setAttribute('aria-label', 'Choose course-map exam');
  const items = [...exams.querySelectorAll('.exam-item')];
  items.forEach((item, index) => {
    item.id = 'minimalExam' + (index + 1);
    item.hidden = index !== 0;
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Exam ' + (index + 1);
    button.setAttribute('aria-pressed', String(index === 0));
    button.setAttribute('aria-controls', item.id);
    button.addEventListener('click', () => {
      items.forEach((panel, panelIndex) => { panel.hidden = panelIndex !== index; });
      [...tabs.children].forEach((tab, tabIndex) => tab.setAttribute('aria-pressed', String(tabIndex === index)));
    });
    tabs.appendChild(button);
  });
  exams.insertBefore(tabs, exams.querySelector('.exams-grid'));
  main.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;
    const id = link.getAttribute('href').slice(1);
    const target = document.getElementById(id);
    const details = target?.closest('.minimal-disclosure');
    if (details) details.open = true;
  });
})();
