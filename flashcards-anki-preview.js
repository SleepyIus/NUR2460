/* Anki-inspired review interaction; its storage adapter preserves original progress.
 * Deliberately simple practice rules, not FSRS or Anki's scheduling algorithm.
 */
(function () {
  if (document.getElementById('ankiShowAnswer')) return;
  const get = id => document.getElementById(id);
  const study = get('studyView'), flashcard = get('flashcard');
  let pool = deck.slice(), ratings = [0, 0, 0, 0], completed = new Set();
  let repeats = new Set(), busy = false;
  let sessionStarted = false;
  let reviewIndex = null, currentAnswerWasRevealed = false;
  let sessionSettings = null;
  const saved = {
    beginRound, showCard, revealAnswer, updateUI, switchMode, renderGrid, renderFocus
  };
  document.body.classList.add('anki-preview');
  get('gridModeBtn').textContent = 'Decks';
  get('studyModeBtn').textContent = 'Study';
  const previewLabel = document.querySelector('#flashcardsPreviewBar span');
  if (previewLabel) previewLabel.textContent = 'Flashcards · Anki-style preview';
  flashcard.removeAttribute('onclick');
  flashcard.setAttribute('role', 'region');
  flashcard.setAttribute('aria-label', 'Flashcard');
  get('cardQ').setAttribute('tabindex', '-1');
  get('cardA').setAttribute('tabindex', '-1');
  get('tapHint').textContent = 'Think of your answer, then reveal it.';

  const queue = document.createElement('div');
  queue.className = 'anki-queue';
  queue.id = 'ankiQueue';
  queue.setAttribute('aria-live', 'polite');
  study.insertBefore(queue, study.firstChild);
  const history = document.createElement('div');
  history.className = 'anki-history';
  history.id = 'ankiHistory';
  history.innerHTML = '<div class="anki-history-nav"><button type="button" id="ankiPrevious">← Previous card</button><span id="ankiHistoryStatus" aria-live="polite">Current card</span><button type="button" id="ankiHistoryNext" hidden>Return to current →</button></div><p id="ankiHistoryHelp" hidden>Review-only: your earlier rating will not change. The answer is open so you can use its Review link.</p>';
  study.insertBefore(history, study.children[1] || null);
  const dock = document.createElement('div');
  dock.className = 'anki-answer-dock';
  dock.innerHTML = '<button type="button" id="ankiShowAnswer" class="anki-show">Show Answer <kbd>Space</kbd></button>';
  get('cardWrapper').appendChild(dock);
  dock.appendChild(get('cardActions'));
  get('cardActions').innerHTML = ['Again', 'Hard', 'Good', 'Easy'].map((name, index) =>
    '<button type="button" class="anki-rating anki-rating-' + (index + 1) + '" data-grade="' + (index + 1) + '"><span class="anki-interval"></span><span>' + name + ' <kbd>' + (index + 1) + '</kbd></span></button>'
  ).join('');
  const explanations = [
    'Again: could not recall. Repeat after up to 3 other cards.',
    'Hard: recalled with difficulty. Repeat after up to 8 other cards.',
    'Good: recalled correctly. Next review in 1 day.',
    'Easy: recalled effortlessly. Next review in 4 days.'
  ];
  get('cardActions').querySelectorAll('button').forEach((button, index) => {
    button.title = explanations[index];
    button.setAttribute('aria-label', explanations[index]);
    button.addEventListener('click', () => grade(index + 1));
  });
  get('ankiShowAnswer').addEventListener('click', () => revealAnswer());
  document.querySelector('.kbd-hints').innerHTML = '<kbd class="kbd">Space</kbd> show answer / Good · <kbd class="kbd">1–4</kbd> rate · <kbd class="kbd">←</kbd> previous · <kbd class="kbd">C</kbd> Focus · <kbd class="kbd">Esc</kbd> decks';
  const rules = document.createElement('details');
  rules.className = 'anki-rules';
  rules.innerHTML = '<summary>Review controls</summary><p>Again repeats after up to 3 other cards. Hard repeats after up to 8. Good schedules 1 day; Easy schedules 4 days. With no other cards remaining, a repeat is shown next.</p><p>This uses simple practice rules, not Anki’s adaptive scheduling. Review progress saves on this device, separately from the original Flashcards page. Use Backup &amp; restore for a portable copy.</p>';
  if (window.NURMinimalDefault) rules.lastElementChild.textContent = 'This uses simple practice rules, not Anki’s adaptive scheduling. Review progress saves on this device. Older Flashcards history is retained separately in hub backups. Use Backup & restore for a portable copy.';
  study.appendChild(rules);

  const studyFiltered = document.createElement('button');
  studyFiltered.type = 'button';
  studyFiltered.id = 'ankiStudyFiltered';
  studyFiltered.className = 'anki-study-button';
  studyFiltered.textContent = 'Study selected deck';
  studyFiltered.addEventListener('click', () => {
    const exam = get('gridExamFilter').value, topic = get('gridTopicFilter').value;
    startDeck(ACTIVE_CARDS.filter(card => (exam === 'all' || getExamForCard(card) === exam) && (topic === 'all' || card.t === topic)));
  });
  get('gridContainer').parentElement.insertBefore(studyFiltered, get('gridContainer'));
  function startDeck(cards) {
    selectedTopics = new Set(cards.map(card => card.t));
    starFilterOn = false; dueOnly = false;
    get('starFilter').classList.remove('active');
    get('dueFilter').classList.remove('active');
    buildSidebar();
    sessionSource = 'standard';
    switchMode('study');
    beginRound(cards.slice());
  }
  function sameTopicSelection(left, right) {
    if (left.length !== right.length) return false;
    const expected = new Set(right);
    return left.every(topic => expected.has(topic));
  }
  function canResumeSelectedDeck() {
    const session = captureSession();
    return !!session && session.position < session.queue.length &&
      sameTopicSelection([...selectedTopics], session.selectedTopics) &&
      shuffleOn === session.shuffleOn && starFilterOn === session.starFilterOn && dueOnly === session.dueOnly;
  }
  const sidebarStart = document.querySelector('.sb-start');
  function updateSidebarStart() {
    if (!sidebarStart) return;
    const resumable = canResumeSelectedDeck();
    sidebarStart.textContent = resumable ? 'Resume Study' : 'Start New Deck';
    sidebarStart.setAttribute('aria-label', resumable ? 'Resume the unfinished flashcard session' : 'Start a new flashcard deck with the selected options');
  }
  function startOrResumeSelectedDeck() {
    if (canResumeSelectedDeck()) switchMode('study');
    else { switchMode('study'); startRound(); }
    updateSidebarStart();
  }
  if (sidebarStart) {
    sidebarStart.removeAttribute('onclick');
    sidebarStart.addEventListener('click', startOrResumeSelectedDeck);
    document.querySelector('.sidebar')?.addEventListener('change', updateSidebarStart);
  }
  const savedSelectAll = selectAll, savedDeselectAll = deselectAll, savedToggleDueFilter = toggleDueFilter;
  selectAll = function (...args) { const result = savedSelectAll.apply(this, args); updateSidebarStart(); return result; };
  deselectAll = function (...args) { const result = savedDeselectAll.apply(this, args); updateSidebarStart(); return result; };
  toggleDueFilter = function (...args) { const result = savedToggleDueFilter.apply(this, args); updateSidebarStart(); return result; };
  function addStudyButtons() {
    get('gridContainer').querySelectorAll('details').forEach(details => {
      if (details.querySelector('.anki-deck-study') && details.classList.contains('fc-topic-group')) return;
      // Direct children only: a nested topic's button is not its exam's button.
      if ([...details.children].some(child => child.classList.contains('anki-deck-study'))) return;
      const ids = new Set([...details.querySelectorAll('.grid-card')].map(card => card.dataset.cardId));
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'anki-deck-study';
      button.textContent = details.classList.contains('fc-exam-group') ? 'Study this exam →' : 'Study this topic →';
      button.addEventListener('click', () => startDeck(ACTIVE_CARDS.filter(card => ids.has(String(card.id)))));
      details.insertBefore(button, details.children[1] || null);
    });
    get('ankiStudyFiltered').disabled = !get('gridContainer').querySelector('.grid-card');
  }
  renderGrid = function (...args) { const result = saved.renderGrid.apply(this, args); addStudyButtons(); return result; };
  renderFocus = function (...args) {
    const result = saved.renderFocus.apply(this, args);
    const note = document.querySelector('.focus-summary span');
    if (note) note.textContent = note.textContent.replace('ratings keep using the normal schedule', 'Anki-style practice · saved separately');
    return result;
  };
  addStudyButtons();

  function reviewingHistory() { return Number.isInteger(reviewIndex); }
  function displayedCard() { return deck[reviewingHistory() ? reviewIndex : current]; }
  function reviewActive() {
    return !study.classList.contains('hidden') && get('cardWrapper').style.display !== 'none' && !!displayedCard();
  }
  function overlayOpen() {
    return get('fcPrintPanelOverlay').classList.contains('show') ||
      (get('fcPrintOverlay') && get('fcPrintOverlay').classList.contains('active')) ||
      document.querySelector('.sidebar').classList.contains('open');
  }
  function syncAnswer() {
    const revealed = get('cardA').classList.contains('visible');
    const historical = reviewingHistory();
    get('ankiShowAnswer').hidden = revealed || historical;
    get('cardA').hidden = !revealed;
    get('cardActions').hidden = !revealed || historical;
    flashcard.classList.toggle('anki-revealed', revealed);
    get('cardActions').querySelectorAll('button').forEach(button => { button.disabled = !revealed || busy || historical; });
    const remaining = Math.max(0, deck.length - current - 1);
    const labels = [3, 8].map(gap => {
      const count = Math.min(gap, remaining);
      return count ? 'After ' + count + (count === 1 ? ' card' : ' cards') : 'Next card';
    });
    labels.push('1 day', '4 days');
    get('cardActions').querySelectorAll('.anki-interval').forEach((label, index) => { label.textContent = labels[index]; });
  }
  function updateHistoryControls() {
    const historical = reviewingHistory();
    const previousTarget = historical ? reviewIndex - 1 : current - 1;
    get('ankiPrevious').disabled = previousTarget < 0;
    get('ankiHistoryNext').hidden = !historical;
    get('ankiHistoryNext').textContent = historical && reviewIndex < current - 1 ? 'Next reviewed card →' : 'Return to current →';
    get('ankiHistoryStatus').textContent = historical ? 'Reviewing card ' + (reviewIndex + 1) + ' of ' + current : 'Current card';
    get('ankiHistoryHelp').hidden = !historical;
    history.classList.toggle('is-reviewing', historical);
    flashcard.classList.toggle('anki-history-review', historical);
  }
  function showHistoryCard(index) {
    if (!Number.isInteger(index) || index < 0 || index >= current || busy) return;
    if (!reviewingHistory()) currentAnswerWasRevealed = get('cardA').classList.contains('visible');
    reviewIndex = index;
    const liveCurrent = current;
    current = index;
    saved.showCard();
    current = liveCurrent;
    saved.revealAnswer();
    get('cardWrapper').style.display = '';
    get('endScreen').style.display = 'none';
    syncAnswer(); updateHistoryControls(); updateUI();
    get('cardA').focus({ preventScroll: true });
  }
  function returnToCurrentCard() {
    if (!reviewingHistory()) return;
    const restoreAnswer = currentAnswerWasRevealed;
    reviewIndex = null; currentAnswerWasRevealed = false;
    if (current >= deck.length) showEnd();
    else {
      showCard();
      if (restoreAnswer) revealAnswer();
    }
  }
  get('ankiPrevious').addEventListener('click', () => showHistoryCard(reviewingHistory() ? reviewIndex - 1 : current - 1));
  get('ankiHistoryNext').addEventListener('click', () => {
    if (!reviewingHistory()) return;
    if (reviewIndex < current - 1) showHistoryCard(reviewIndex + 1); else returnToCurrentCard();
  });
  showCard = function (...args) {
    reviewIndex = null; currentAnswerWasRevealed = false;
    const result = saved.showCard.apply(this, args);
    syncAnswer(); updateHistoryControls();
    // Focus the new question, never leave focus on a hidden rating button.
    if (reviewActive()) get('cardQ').focus({ preventScroll: true });
    return result;
  };
  revealAnswer = function () {
    if (!reviewActive() || busy) return;
    saved.revealAnswer(); syncAnswer(); get('cardA').focus({ preventScroll: true });
  };
  updateUI = function () {
    saved.updateUI();
    const schedule = getSchedule(), pending = deck.slice(current);
    const learn = pending.filter(card => repeats.has(card.id)).length;
    const fresh = pending.filter(card => !repeats.has(card.id) && !schedule[card.id]).length;
    const review = pending.length - learn - fresh;
    queue.innerHTML = '<span class="anki-new"><strong>' + fresh + '</strong> New</span><span class="anki-learn"><strong>' + learn + '</strong> Repeat</span><span class="anki-review"><strong>' + review + '</strong> Review</span>';
    const rated = ratings.reduce((a, b) => a + b, 0);
    get('cardPos').textContent = pending.length + ' remaining · ' + rated + (rated === 1 ? ' rating' : ' ratings');
    if (reviewingHistory()) get('cardPos').textContent = 'Previous card ' + (reviewIndex + 1) + ' · ' + pending.length + ' remaining';
    const pct = pool.length ? Math.round(completed.size / pool.length * 100) : 0;
    get('pctDone').textContent = pct + '%';
    get('progRight').style.width = pct + '%'; get('progWrong').style.width = '0%';
    updateHistoryControls();
  };
  beginRound = function (cards) {
    sessionStarted = true;
    pool = cards.slice(); ratings = [0, 0, 0, 0]; completed = new Set(); repeats = new Set(); busy = false;
    reviewIndex = null; currentAnswerWasRevealed = false;
    sessionSettings = { selectedTopics: [...selectedTopics], shuffleOn, starFilterOn, dueOnly };
    saved.beginRound(cards.slice());
    get('ankiSessionSummary')?.remove();
    get('sessionOverlay').classList.remove('show');
    if (!cards.length) {
      document.querySelector('.end-title').textContent = 'No cards to study';
      get('endSub').textContent = 'Choose another deck or adjust your sidebar filters.';
      get('focusReturnBtn').style.display = sessionSource === 'focus' ? '' : 'none';
    }
  };
  showEnd = function () {
    reviewIndex = null; currentAnswerWasRevealed = false;
    get('cardWrapper').style.display = 'none';
    get('endScreen').style.display = '';
    document.querySelector('.end-title').textContent = 'Session complete';
    get('endSub').textContent = completed.size + (completed.size === 1 ? ' card finished.' : ' cards finished.') + ' Your self-ratings are shown below.';
    get('reviewBtn').style.display = wrongCards.length ? '' : 'none';
    get('reviewBtn').textContent = 'Practice Again cards';
    get('focusReturnBtn').style.display = sessionSource === 'focus' ? '' : 'none';
    get('ankiSessionSummary')?.remove();
    const summary = document.createElement('div');
    summary.id = 'ankiSessionSummary';
    summary.className = 'anki-session-ratings';
    summary.innerHTML = ['Again', 'Hard', 'Good', 'Easy'].map((name, index) => '<span><strong>' + ratings[index] + '</strong>' + name + '</span>').join('');
    get('endScreen').insertBefore(summary, get('endScreen').querySelector('.end-btn'));
    updateUI(); updateHistoryControls(); renderDashboard();
  };
  function grade(value) {
    if (reviewingHistory() || ![1, 2, 3, 4].includes(value) || !reviewActive() || overlayOpen() || busy || !get('cardA').classList.contains('visible')) return;
    if (window.NURAnkiSession) return window.NURAnkiSession.transact(() => applyGrade(value), { value, id: deck[current].id });
    return applyGrade(value);
  }
  function applyGrade(value) {
    if (reviewingHistory() || ![1, 2, 3, 4].includes(value) || !reviewActive() || overlayOpen() || busy || !get('cardA').classList.contains('visible')) return;
    sessionStarted = true;
    busy = true;
    const card = deck[current]; ratings[value - 1]++;
    const recalled = value !== 1;
    if (recalled) rightN++; else { wrongN++; if (!wrongCards.some(item => item.id === card.id)) wrongCards.push(card); }
    // Existing metrics remain self-reported recall, not a claim of exam readiness.
    sessionChanges.push(updateMastery(card.id, recalled));
    updateAccuracy(card.t, recalled);
    if (!sessionTopicStats[card.t]) sessionTopicStats[card.t] = { r: 0, w: 0 };
    sessionTopicStats[card.t][recalled ? 'r' : 'w']++;
    const schedule = getSchedule();
    if (value <= 2) {
      repeats.add(card.id);
      const gap = value === 1 ? 3 : 8;
      deck.splice(Math.min(deck.length, current + gap + 1), 0, card);
      schedule[card.id] = Date.now();
    } else {
      repeats.delete(card.id); completed.add(card.id);
      schedule[card.id] = Date.now() + (value === 3 ? 1 : 4) * 86400000;
    }
    saveSchedule(schedule);
    current++;
    busy = false;
    if (current >= deck.length) showEnd(); else showCard();
    updateUI();
  }
  // Legacy boolean entry points remain safe; all ratings use one guarded path.
  answer = correct => grade(correct ? 3 : 1);
  reviewWrong = function () { beginRound(wrongCards.slice()); };
  restartAll = function () { beginRound(pool.slice()); };
  switchMode = function (mode) {
    if (mode !== 'study') { reviewIndex = null; currentAnswerWasRevealed = false; }
    const result = saved.switchMode(mode);
    document.body.classList.toggle('anki-studying', mode === 'study');
    if (mode === 'study' && reviewActive()) get('cardQ').focus({ preventScroll: true });
    updateSidebarStart();
    return result;
  };
  startDueSession = function () {
    dueOnly = true; get('dueFilter').classList.add('active');
    selectAll(); switchMode('study'); startRound();
  };
  // Do not let legacy swipe gestures silently choose between four ratings.
  flashcard.addEventListener('touchend', event => event.stopImmediatePropagation(), { capture: true, passive: true });
  document.addEventListener('keydown', event => {
    if (study.classList.contains('hidden')) return;
    const handled = [' ', 'Enter', '1', '2', '3', '4', 'Escape', 'c', 'C', 's', 'S', 'ArrowLeft', 'ArrowRight', 'j', 'J', 'k', 'K'];
    if (!handled.includes(event.key)) return;
    // Keep native controls operable, but block the older global two-rating handler.
    event.stopImmediatePropagation();
    const target = event.target;
    if (overlayOpen() || target.closest('input,textarea,select,button,a,summary,[contenteditable="true"],[role="textbox"]')) return;
    event.preventDefault();
    if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'Escape') { if (reviewingHistory()) returnToCurrentCard(); else switchMode('grid'); return; }
    if (!reviewActive()) return;
    if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'k') showHistoryCard(reviewingHistory() ? reviewIndex - 1 : current - 1);
    else if ((event.key === 'ArrowRight' || event.key.toLowerCase() === 'j') && reviewingHistory()) {
      if (reviewIndex < current - 1) showHistoryCard(reviewIndex + 1); else returnToCurrentCard();
    } else if (event.key === ' ' || event.key === 'Enter') {
      if (get('cardA').classList.contains('visible')) grade(3); else revealAnswer();
    } else if (/^[1-4]$/.test(event.key)) grade(Number(event.key));
    else if (event.key.toLowerCase() === 'c') toggleStar();
  }, true);
  function captureSession() {
    if (!sessionStarted) return null;
    const settings = sessionSettings || { selectedTopics: [...selectedTopics], shuffleOn, starFilterOn, dueOnly };
    return { pool: pool.map(card => card.id), queue: deck.map(card => card.id), position: current, ratings: ratings.slice(), completed: [...completed], repeats: [...repeats], wrong: wrongCards.map(card => card.id), source: sessionSource, focusDueOnly, selectedTopics: settings.selectedTopics.slice(), shuffleOn: settings.shuffleOn, starFilterOn: settings.starFilterOn, dueOnly: settings.dueOnly };
  }
  function restoreSession(state) {
    if (!state) { sessionStarted = false; sessionSettings = null; updateSidebarStart(); return; }
    const byId = new Map(ACTIVE_CARDS.map(card => [card.id, card]));
    if (state.pool.some(id => !byId.has(id))) throw new Error('Some saved session cards are unavailable in this version. Your backup is preserved; start another deck or export it.');
    pool = state.pool.map(id => byId.get(id)); deck = state.queue.map(id => byId.get(id)); current = state.position;
    ratings = state.ratings.slice(); completed = new Set(state.completed); repeats = new Set(state.repeats);
    wrongCards = state.wrong.map(id => byId.get(id)); wrongN = ratings[0]; rightN = ratings[1] + ratings[2] + ratings[3];
    sessionSource = state.source; focusDueOnly = state.focusDueOnly; selectedTopics = new Set(state.selectedTopics);
    shuffleOn = state.shuffleOn; starFilterOn = state.starFilterOn; dueOnly = state.dueOnly;
    sessionSettings = { selectedTopics: state.selectedTopics.slice(), shuffleOn: state.shuffleOn, starFilterOn: state.starFilterOn, dueOnly: state.dueOnly };
    get('shuffleBtn').classList.toggle('active', shuffleOn); get('starFilter').classList.toggle('active', starFilterOn); get('dueFilter').classList.toggle('active', dueOnly);
    busy = false; sessionStarted = true; reviewIndex = null; currentAnswerWasRevealed = false; resetSessionTracking(); buildSidebar();
    get('ankiSessionSummary')?.remove();
    get('cardWrapper').style.display = ''; get('endScreen').style.display = 'none';
    if (current < deck.length) showCard(); else showEnd();
    updateFocusCount(); updateUI(); updateSidebarStart(); renderDashboard();
  }
  toggleStar = function () {
    const card = displayedCard(); if (!card) return;
    const focused = toggleFocused(card.id);
    get('starBtn').textContent = focused ? '★' : '☆';
    get('starBtn').classList.toggle('starred', focused);
    get('starBtn').setAttribute('aria-pressed', String(focused));
    get('starBtn').setAttribute('aria-label', focused ? 'Remove from Focus Deck' : 'Add to Focus Deck');
    get('starBtn').title = focused ? 'Remove from Focus Deck' : 'Add to Focus Deck';
    updateFocusCount();
  };
  window.flashcardsAnki = { grade, startDeck, captureSession, restoreSession, showPrevious: () => showHistoryCard(reviewingHistory() ? reviewIndex - 1 : current - 1), returnToCurrent: returnToCurrentCard };
  syncAnswer(); updateHistoryControls(); updateUI(); updateSidebarStart();
  document.body.classList.toggle('anki-studying', !study.classList.contains('hidden'));
})();
