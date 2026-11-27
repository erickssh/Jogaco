(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const E = SudokuEngine;
  const KEY = 'sudoku-pausa-v1';
  const labels = { easy: 'Fácil', medium: 'Médio', hard: 'Difícil', expert: 'Experiente' };
  const home = $('game-intro');
  const homeActions = $('home-actions');
  const gameContent = $('game-content');
  const gameElement = document.querySelector('.sudoku-game');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let selected = -1, noteMode = false, state, grid, nextLevel = 'easy', nextSize = 9, busy = false, messageTimeout;
  let activeDigit = 0;
  let lastTick = performance.now();
  let wasHidden = document.hidden;
  const conclusion = window.SudokuConclusion;
  conclusion.mount();
  const dialogs = ['new-dialog', 'win-dialog', 'stats-dialog', 'share-dialog'].map($);
  const newSizes = document.querySelectorAll('[data-size][aria-pressed]');
  const newLevels = document.querySelectorAll('[data-level]');
  const statsLevels = document.querySelectorAll('[data-stats-level]');
  const statsViews = document.querySelectorAll('[data-stats-view]');
  const playerStats = SudokuStats.createStore(() => localStorage);
  const ranking = window.SudokuRanking;
  let statsView = 'personal', statsLevel = 'easy', statsDate, rankingRequest = 0;
  let finishStatus = '';
  const cells = [], keys = [];
  const baseLevel = level => level === 'giant' ? 'easy' : level.replace(/^(mini|giant)-/, '');
  function levelFor(size, level) {
    const difficulty = baseLevel(level);
    if (size === 16) return difficulty === 'easy' ? 'giant' : 'giant-' + difficulty;
    if (size === 6) return 'mini-' + difficulty;
    return difficulty;
  }
  function levelLabel(level) {
    const size = E.variants[level].size;
    const difficulty = labels[baseLevel(level)];
    if (size === 16) return 'Gigante · ' + difficulty;
    if (size === 6) return 'Mini · ' + difficulty;
    return 'Clássico · ' + difficulty;
  }
  const dailyKey = date => KEY + ':dia:' + date;
  const friendKey = code => KEY + ':amigo:' + code;
  const activeKey = KEY + ':ativo';
  const modeKey = game => game.date ? dailyKey(game.date) : game.challenge ? friendKey(game.challenge) : KEY;

  function hasUniqueSolution({ puzzle, solution }) {
    const verified = E.uniqueSolution(puzzle);
    return Boolean(verified && Array.isArray(solution) && verified.length === solution.length
      && verified.every((value, i) => value === solution[i]));
  }

  function restore(key = KEY) {
    try {
      const s = JSON.parse(localStorage.getItem(key));
      if (!s || !E.isLevel(s.level) || modeKey(s) !== key) return null;
      if (s.date && (!E.isDay(s.date) || s.level !== E.DAILY_LEVEL)) return null;
      const { size } = E.variants[s.level];
      if (![s.puzzle, s.solution, s.values].every(values => E.validDigits(values, size)) || s.solution.includes(0)) return null;
      if (!Array.isArray(s.notes) || s.notes.length !== size ** 2 || !s.notes.every(notes =>
        Array.isArray(notes) && notes.length <= size && notes.every(n => Number.isInteger(n) && n >= 1 && n <= size))) return null;
      if (!hasUniqueSolution(s) || s.puzzle.some((n, i) => n && s.values[i] !== n)) return null;
      if (![s.seconds, s.mistakes, s.hints].every(Number.isFinite) || s.seconds < 0 || s.mistakes < 0 || s.hints < 0 || s.hints > 3) return null;
      delete s.history;
      delete s.autoCheck;
      if (typeof s.id !== 'string' || !s.id) s.id = `legacy-${s.level}-${s.puzzle.join('')}`;
      s.paused = Boolean(s.paused);
      s.completed = s.values.every((n, i) => n === s.solution[i]);
      return s;
    } catch { return null; }
  }
  function save() {
    try {
      const key = modeKey(state);
      localStorage.setItem(key, JSON.stringify(state));
      localStorage.setItem(activeKey, key);
    }
    catch { /* O jogo continua mesmo quando o armazenamento não está disponível. */ }
  }
  function resumableGame() {
    let active;
    try {
      active = localStorage.getItem(activeKey);
    } catch { /* Storage may be unavailable. */ }
    for (const key of new Set([active, KEY, dailyKey(E.dayKey())])) {
      const game = key && restore(key);
      if (game && !game.completed) return game;
    }
    return null;
  }
  function announce(text) {
    const message = $('message');
    message.textContent = text;
    if (message.classList.contains('visible')) {
      animateBriefly(message, [{ opacity: .6 }, { opacity: 1 }], 140);
    }
    message.classList.add('visible');
    clearTimeout(messageTimeout); messageTimeout = setTimeout(() => message.classList.remove('visible'), 3800);
  }
  function animateBriefly(element, frames, duration) {
    if (!reducedMotion.matches) return element.animate(frames, { duration, easing: 'ease-out' });
  }
  function formatTime(seconds) { const t = Math.floor(seconds); return `${Math.floor(t / 60).toString().padStart(2, '0')}:${(t % 60).toString().padStart(2, '0')}`; }
  function updateContinueButton() {
    const game = resumableGame();
    const details = $('continue-details');
    $('home-continue').disabled = !game;
    details.hidden = !game;
    if (!game) return;
    details.textContent = `${levelLabel(game.level)} · ${formatTime(game.seconds)}`;
  }
  function blocked() { return !state || gameContent.hidden || busy || state.paused || state.completed || dialogs.some(d => d.open); }
  function tick() {
    const now = performance.now();
    if (state && !blocked() && !wasHidden) state.seconds += (now - lastTick) / 1000;
    lastTick = now;
    wasHidden = document.hidden;
    if (state) $('time').textContent = formatTime(state.seconds);
  }
  function render({ placedIndex = -1, animateNotes = false } = {}) {
    const { size, row, col, peers } = grid;
    const chosenValue = activeDigit || (selected >= 0 ? state.values[selected] : 0);
    cells.forEach((cell, i) => {
      const value = state.values[i];
      cell.className = 'cell';
      if (state.puzzle[i]) cell.classList.add('given');
      if (selected >= 0 && peers[selected].includes(i)) cell.classList.add('related');
      if (chosenValue && value === chosenValue) cell.classList.add('same');
      if (i === selected) cell.classList.add('selected');
      const error = Boolean(value && value !== state.solution[i]);
      if (error) cell.classList.add('error');
      cell.setAttribute('aria-selected', String(i === selected));
      cell.setAttribute('aria-readonly', String(Boolean(state.puzzle[i])));
      cell.setAttribute('aria-invalid', String(error));
      cell.tabIndex = i === (selected < 0 ? 0 : selected) ? 0 : -1;
      const notes = state.notes[i];
      cell.setAttribute('aria-label', `Linha ${row(i) + 1}, coluna ${col(i) + 1}: ${value ? E.symbol(value) : notes.length ? 'anotações ' + notes.map(E.symbol).join(', ') : 'vazia'}${state.puzzle[i] ? ', valor fixo' : ''}${error ? ', incorreto' : ''}`);
      if (value && i === placedIndex) {
        const digit = document.createElement('span');
        digit.className = 'placed-digit';
        digit.textContent = E.symbol(value);
        cell.replaceChildren(digit);
      } else if (value) {
        if (cell.textContent !== E.symbol(value)) cell.textContent = E.symbol(value);
      }
      else if (notes.length) {
        let notesGrid = animateNotes ? null : cell.querySelector(':scope > .notes-grid');
        if (!notesGrid) {
          notesGrid = document.createElement('span');
          notesGrid.className = 'notes-grid';
          notesGrid.setAttribute('aria-hidden', 'true');
          for (let n = 1; n <= size; n++) notesGrid.append(document.createElement('span'));
          cell.replaceChildren(notesGrid);
        }
        if (animateNotes) {
          notesGrid.classList.add('quick-notes-in');
          notesGrid.style.setProperty('--notes-delay', `${(row(i) + col(i)) * 8}ms`);
        }
        for (let n = 1; n <= size; n++) {
          const span = notesGrid.children[n - 1];
          const noted = notes.includes(n);
          span.textContent = noted ? E.symbol(n) : '';
          span.classList.toggle('matching-note', noted && n === chosenValue);
        }
      } else cell.textContent = '';
    });
    keys.forEach((key, i) => {
      const digit = i + 1;
      const placed = state.values.filter((value, index) => value === digit && value === state.solution[index]).length;
      const remaining = size - placed;
      key.querySelector('small').textContent = remaining || '✓';
      key.classList.toggle('complete', remaining === 0);
      key.setAttribute('aria-label', `${E.symbol(digit)}, ${remaining} restantes`);
      key.setAttribute('aria-pressed', String(activeDigit === digit));
      key.disabled = state.paused || state.completed || busy;
    });
    $('level-label').textContent = state.date ? 'Desafio do dia' : state.challenge ? 'Desafio de amigo'
      : levelLabel(state.level);
    const target = $('challenge-target');
    target.hidden = !Number.isFinite(state.targetSeconds);
    if (!target.hidden) target.textContent = `Tempo a bater: ${formatTime(state.targetSeconds)}`;
    $('daily-game').textContent = state.date === E.dayKey() ? 'Ranking do dia' : 'Desafio diário';
    $('daily-game').disabled = busy;
    $('share-board').hidden = !state.completed;
    $('return-game').hidden = !state.date && !state.challenge;
    $('mistakes').textContent = state.mistakes;
    $('time').textContent = formatTime(state.seconds);
    $('notes').setAttribute('aria-pressed', String(noteMode));
    $('note-badge').textContent = noteMode ? 'ON' : 'OFF';
    $('quick-notes').disabled = !state.values.includes(0) || state.paused || state.completed || busy;
    $('erase').disabled = !canErase() || state.paused || state.completed || busy;
    $('hint').disabled = !state.hints || state.paused || state.completed || busy;
    $('hint-count').textContent = state.hints || '0';
    $('hint').title = state.date || state.challenge ? 'Desafio sem dicas' : 'Revelar uma casa';
    $('notes').disabled = state.paused || state.completed || busy;
    $('pause').disabled = state.completed || busy;
    $('pause').setAttribute('aria-label', state.paused ? 'Continuar jogo' : 'Pausar jogo');
    $('pause').title = state.paused ? 'Continuar jogo' : 'Pausar jogo';
    const cover = $('board-cover');
    cover.classList.toggle('is-visible', state.paused);
    cover.inert = !state.paused;
    cover.setAttribute('aria-hidden', String(!state.paused));
    const board = $('board');
    board.classList.toggle('is-paused', state.paused);
    board.inert = state.paused;
    board.setAttribute('aria-hidden', String(state.paused));
    const total = state.puzzle.filter(value => value === 0).length;
    const filled = state.values.filter((value, i) => state.puzzle[i] === 0 && value !== 0).length;
    $('progress-text').textContent = `${filled} de ${total} preenchidos`;
    $('progress-bar').style.width = `${total ? filled / total * 100 : 0}%`;
    save();
  }
  function select(i, focus = false) {
    if (state.paused || busy) return;
    selected = i;
    render();
    if (!focus) return;
    const cell = cells[i];
    cell.focus({ preventScroll: true });
    const scroll = $('board-scroll');
    const cellBox = cell.getBoundingClientRect(), scrollBox = scroll.getBoundingClientRect();
    if (cellBox.left < scrollBox.left) scroll.scrollLeft -= scrollBox.left - cellBox.left + 2;
    if (cellBox.right > scrollBox.right) scroll.scrollLeft += cellBox.right - scrollBox.right + 2;
  }
  function chooseDigit(digit) {
    if (blocked()) return;
    activeDigit = activeDigit === digit ? 0 : digit;
    render();
  }
  function activateCell(index) {
    if (state.paused || busy) return;
    const removingNote = noteMode && activeDigit && !state.puzzle[index]
      && !state.values[index] && state.notes[index].includes(activeDigit);
    selected = index;
    applyDigit(activeDigit);
    if (removingNote) { selected = -1; render(); }
  }
  function typeDigit(digit, target) {
    const focused = cells.indexOf(target);
    if (focused >= 0) selected = focused;
    if (selected < 0) {
      chooseDigit(digit);
      return;
    }
    activeDigit = 0;
    applyDigit(digit);
  }
  function applyDigit(digit) {
    if (!digit || blocked() || state.puzzle[selected]) {
      render();
      return;
    }
    const cell = cells[selected];
    const removedNote = noteMode && !reducedMotion.matches && state.notes[selected].includes(digit)
      ? cell.querySelector(':scope > .notes-grid')?.cloneNode(true) : null;
    const changed = placeDigit(digit);
    render({ placedIndex: changed && !noteMode ? selected : -1 });
    if (changed && noteMode) {
      if (removedNote) {
        for (const [i, span] of Array.from(removedNote.children).entries()) {
          if (i !== digit - 1) span.textContent = '';
        }
        animateRemoval(cell, removedNote);
      } else {
        const note = cell.querySelector(':scope > .notes-grid')?.children[digit - 1];
        if (note?.textContent) animateBriefly(note, [{ opacity: .15, scale: '.75' }, { opacity: 1, scale: '1' }], 160);
      }
    }
  }
  function placeDigit(n) {
    if (noteMode) {
      if (state.values[selected]) { announce('Apague o número desta casa antes de fazer anotações.'); return false; }
      const notes = state.notes[selected];
      const conflict = grid.peers[selected].find(i => state.values[i] === n);
      if (!notes.includes(n) && conflict !== undefined) {
        const area = grid.row(conflict) === grid.row(selected) ? 'nesta linha'
          : grid.col(conflict) === grid.col(selected) ? 'nesta coluna' : 'neste bloco';
        announce(`Não é possível anotar ${E.symbol(n)}: já aparece ${area}.`);
        return false;
      }
      state.notes[selected] = notes.includes(n) ? notes.filter(v => v !== n) : [...notes, n].sort((a, b) => a - b);
      return true;
    }
    if (state.values[selected] === n) return false;
    state.values[selected] = n; state.notes[selected] = [];
    logComparisonMove(selected, n);
    if (n !== state.solution[selected]) {
      state.mistakes++;
      window.playSudokuSound('mistake');
      announce('Esse número não está correto. Você pode tentar de novo.');
    } else {
      for (const peer of grid.peers[selected]) state.notes[peer] = state.notes[peer].filter(v => v !== n);
      if (!checkWin()) window.playSudokuSound('correct');
    }
    return true;
  }
  function logComparisonMove(index, digit) {
    if (typeof state.comparisonMoves !== 'string') return;
    if (state.comparisonMoves.length >= 12000) {
      state.comparisonMoves = null;
      return;
    }
    state.comparisonMoves += index.toString(16).padStart(2, '0') + E.encode([digit]);
  }
  function canErase() {
    return selected >= 0 && !state.puzzle[selected]
      && Boolean(state.values[selected] || state.notes[selected].length);
  }
  function erase() {
    if (blocked() || !canErase()) return;
    const cell = cells[selected];
    const notes = cell.querySelector(':scope > .notes-grid');
    const removed = notes ? notes.cloneNode(true) : document.createElement('span');
    if (!notes) removed.textContent = E.symbol(state.values[selected]);
    if (state.values[selected]) logComparisonMove(selected, 0);
    state.values[selected] = 0; state.notes[selected] = [];
    render();
    animateRemoval(cell, removed);
  }
  function animateRemoval(cell, content) {
    if (reducedMotion.matches) return;
    content.classList.remove('quick-notes-in');
    const fading = document.createElement('span');
    fading.className = 'removing-content';
    fading.setAttribute('aria-hidden', 'true');
    fading.append(content);
    cell.append(fading);
    const frames = content.classList.contains('notes-grid') ? [{ opacity: 1 }, { opacity: 0 }] : [
      { opacity: 1, translate: '0 0' },
      { opacity: 0, translate: '0 -3px' }
    ];
    const animation = animateBriefly(fading, frames, 140);
    const remove = () => fading.remove();
    animation.finished.then(remove, remove);
  }
  function quickNotes() {
    if (blocked()) return;
    const clear = Boolean(state.quickNotesActive);
    state.notes = clear ? state.notes.map(() => []) : E.allNotes(state.values);
    state.quickNotesActive = !clear;
    render({ animateNotes: !clear });
  }
  function toggleNotes() { if (blocked()) return; noteMode = !noteMode; render(); }
  function hint() {
    if (blocked() || !state.hints) return;
    let index = selected;
    if (index < 0 || state.values[index] === state.solution[index]) index = state.values.findIndex((n, i) => n !== state.solution[i]);
    if (index < 0) return;
    selected = index; state.values[index] = state.solution[index]; state.notes[index] = []; state.hints--;
    for (const p of grid.peers[index]) state.notes[p] = state.notes[p].filter(n => n !== state.solution[index]);
    announce(`Dica: linha ${grid.row(index) + 1}, coluna ${grid.col(index) + 1} recebe ${E.symbol(state.solution[index])}.`);
    if (!checkWin()) window.playSudokuSound('correct');
    render({ placedIndex: index });
  }
  function checkWin() {
    if (!state.completed && state.values.every((n, i) => n === state.solution[i])) {
      tick(); state.completed = true;
      if (!state.date && !state.challenge) playerStats.record(state);
      const hintsUsed = state.date || state.challenge ? undefined : 3 - state.hints;
      conclusion.showResult({ time: formatTime(state.seconds), mistakes: state.mistakes, hintsUsed });
      conclusion.showComparison(state.compare ? {
        status: state.mistakes || hintsUsed ? 'ineligible' : 'pending'
      } : null);
      const target = $('win-target');
      target.hidden = !Number.isFinite(state.targetSeconds);
      if (!target.hidden) {
        const seconds = Math.floor(state.seconds);
        target.textContent = seconds < state.targetSeconds ? 'Você bateu o tempo do desafio!'
          : seconds === state.targetSeconds ? 'Você igualou o tempo do desafio.' : `Tempo a bater: ${formatTime(state.targetSeconds)}.`;
      }
      $('win-ranking').hidden = !state.date && !state.rankingToken;
      $('win-ranking').textContent = state.date ? 'Ver ranking do dia' : 'Ver ranking';
      if (state.date) {
        $('win-rank-entry').append($('rank-entry'));
        finishStatus = state.rankingToken ? '' : 'O ranking está indisponível para esta partida.';
        updateRankForm();
      }
      $('win-dialog').showModal();
      window.playSudokuSound('victory');
      finishRankedGame(state);
      return true;
    }
    return false;
  }
  function pause(value) {
    if (!state || state.completed || busy) return;
    tick();
    state.paused = value;
    render();
    const target = value ? $('resume') : selected >= 0 ? cells[selected] : $('pause');
    target.focus({ preventScroll: true });
  }
  function showNewOptions() {
    newSizes.forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.size) === nextSize)));
    newLevels.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.level === nextLevel)));
  }
  function openNew() {
    if (busy) return;
    tick();
    const reference = state ?? restore();
    nextLevel = reference ? baseLevel(reference.level) : 'easy';
    nextSize = reference ? E.variants[reference.level].size : 9;
    showNewOptions();
    $('new-dialog').showModal();
  }
  function showStats(level) {
    statsLevel = level;
    const daily = statsView === 'daily';
    const size = E.variants[level].size;
    $('stats-size').value = size;
    $('stats-filters').hidden = daily;
    statsLevels.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.statsLevel === baseLevel(level))));
    statsViews.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.statsView === statsView)));
    $('personal-stats').hidden = statsView !== 'personal';
    $('ranking-panel').hidden = statsView === 'personal';
    rankingRequest++;
    if (statsView === 'personal') {
      const { bestSeconds, cleanWins } = playerStats.forLevel(level);
      $('best-time').textContent = bestSeconds === null ? '—' : formatTime(bestSeconds);
      $('best-time').setAttribute('aria-label', bestSeconds === null ? 'Nenhuma vitória neste nível' : formatTime(bestSeconds));
      $('clean-wins').textContent = cleanWins;
    } else {
      const dateLabel = daily ? statsDate.split('-').reverse().join('/') : '';
      $('ranking-explainer').textContent = daily
        ? `${dateLabel} · Mesmo tabuleiro para todos, sem dicas. A contagem inclui pausas.`
        : 'Os 10 melhores tempos de partidas iniciadas online. A contagem inclui pausas.';
      updateRankForm();
      loadRanking(level, daily ? statsDate : undefined);
    }
  }
  function openStats(view = 'personal') {
    if (!state || busy) return;
    tick();
    statsView = view;
    statsDate = state.date || E.dayKey();
    $('ranking-explainer').after($('rank-entry'));
    showStats(state.level);
    $('stats-dialog').showModal();
    document.querySelector('[data-stats-view][aria-pressed="true"]').focus();
  }
  async function loadRanking(level, date) {
    const request = ++rankingRequest;
    const status = $('ranking-status');
    const list = $('ranking-entries');
    list.replaceChildren();
    status.textContent = 'Carregando ranking…';
    try {
      const { entries } = await ranking.list(level, date);
      if (request !== rankingRequest) return;
      if (!entries.length) {
        status.textContent = date ? 'Ainda não há tempos publicados neste desafio.' : 'Ainda não há tempos publicados neste nível.';
        return;
      }
      list.replaceChildren(...entries.map(({ nickname, seconds }) => {
        const item = document.createElement('li');
        const name = document.createElement('span');
        const time = document.createElement('strong');
        name.textContent = nickname;
        time.textContent = formatTime(seconds);
        item.append(name, time);
        return item;
      }));
      status.textContent = '';
    } catch {
      if (request === rankingRequest) status.textContent = 'Ranking indisponível agora.';
    }
  }
  function showingRankFor(game) {
    return game.date ? statsView === 'daily' && statsDate === game.date
      : statsView === 'ranking' && statsLevel === game.level;
  }
  function canPublishInCurrentView(game) {
    return $('rank-entry').parentElement === $('win-rank-entry') ? Boolean(game.date) : showingRankFor(game);
  }
  function updateRankForm() {
    const ownRanking = canPublishInCurrentView(state);
    const ready = state.completed && ownRanking && Number.isFinite(state.rankingSeconds) && !state.rankingNickname;
    $('ranking-form').hidden = !ready;
    if (ready) $('ranking-own-time').textContent = `Seu tempo no ranking: ${formatTime(state.rankingSeconds)}`;
    const note = $('ranking-publish-status');
    const text = ownRanking ? finishStatus : '';
    note.textContent = text;
    note.hidden = !text;
  }
  async function finishRankedGame(game) {
    if (!game.rankingToken) return;
    finishStatus = 'Registrando o tempo desta partida…';
    updateRankForm();
    try {
      const hintsUsed = !game.date && !game.challenge && game.hints < 3;
      const details = game.compare ? {
        activeSeconds: Math.floor(game.seconds),
        moves: game.mistakes || hintsUsed ? null : game.comparisonMoves
      } : undefined;
      const { seconds, comparison } = await ranking.finish(game.rankingToken, game.values, details);
      if (game !== state) return;
      if (game.compare && $('win-dialog').open) conclusion.showComparison(comparison ?? { status: 'unavailable' });
      game.rankingSeconds = seconds;
      save();
      finishStatus = '';
    } catch {
      if (game !== state) return;
      if (game.compare && $('win-dialog').open) conclusion.showComparison({ status: 'unavailable' });
      finishStatus = 'Não foi possível registrar o tempo desta partida.';
    }
    updateRankForm();
  }
  async function publishRank(event) {
    event.preventDefault();
    const game = state;
    const button = $('ranking-submit');
    if (button.disabled || !game?.completed || !canPublishInCurrentView(game) || game.rankingNickname || !Number.isFinite(game.rankingSeconds)) return;
    button.disabled = true;
    finishStatus = '';
    updateRankForm();
    try {
      const { nickname } = await ranking.publish(game.rankingToken, $('ranking-nickname').value);
      if (game !== state) return;
      game.rankingNickname = nickname;
      save();
      finishStatus = 'Seu tempo foi publicado.';
      if ($('stats-dialog').open && showingRankFor(game)) loadRanking(game.level, game.date);
    } catch (error) {
      if (game === state) finishStatus = error.message || 'Não foi possível publicar agora.';
    } finally {
      button.disabled = false;
      if (game === state) updateRankForm();
    }
  }
  function leaveChallengeUrl() {
    const url = new URL(location.href);
    if (!url.searchParams.has('desafio')) return;
    url.searchParams.delete('desafio');
    history.replaceState(null, '', url);
  }
  function showGame(game) {
    const leavingHome = !home.hidden;
    if (!game.challenge) leaveChallengeUrl();
    state = game;
    const size = E.variants[game.level].size;
    if (size !== grid?.size) {
      grid = E.grids[size];
      buildBoard();
    }
    finishStatus = game.completed && game.date && !game.rankingToken ? 'O ranking está indisponível para esta partida.' : '';
    $('ranking-nickname').value = '';
    $('ranking-explainer').after($('rank-entry'));
    selected = -1; activeDigit = 0; noteMode = false;
    dialogs.forEach(d => d.close());
    $('board-scroll').scrollLeft = 0;
    lastTick = performance.now();
    render();
    home.hidden = true;
    gameContent.hidden = gameContent.inert = false;
    if (leavingHome) gameContent.focus({ preventScroll: true });
    else animateBriefly($('board'), [{ opacity: .55 }, { opacity: 1 }], 220);
    if (game.completed && game.rankingToken && !Number.isFinite(game.rankingSeconds)) finishRankedGame(game);
  }
  function createGame(level, { puzzle, solution, token, date, challenge, targetSeconds, difficultyRating, compare }) {
    const id = crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    return {
      id, puzzle, solution, values: [...puzzle], notes: puzzle.map(() => []), level,
      seconds: 0, mistakes: 0, hints: date || challenge ? 0 : 3, paused: false, completed: false,
      rankingToken: token, date, challenge, targetSeconds, difficultyRating, compare,
      comparisonMoves: compare ? '' : undefined
    };
  }
  async function generateLocal(level) {
    if (E.variants[level].grade !== 4 || location.protocol === 'file:' || !window.Worker) return E.generate(level);
    let worker;
    try {
      worker = new Worker('generate-worker.js');
      return await new Promise((resolve, reject) => {
        worker.onmessage = ({ data }) => data.error ? reject(new Error(data.error)) : resolve(data);
        worker.onerror = reject;
        worker.postMessage(level);
      });
    } catch {
      return E.generate(level);
    } finally {
      worker?.terminate();
    }
  }
  async function startGame(level, daily = false) {
    if (busy) return;
    tick();
    busy = true;
    homeActions.inert = true;
    $('start-game').disabled = $('daily-game').disabled = $('new-game').disabled = $('return-game').disabled = true;
    $('start-game').textContent = 'Preparando seu jogo…';
    if (daily) $('home-daily').textContent = 'Preparando desafio…';
    if (state) render();
    try {
      let ranked = await ranking.start(level, daily ? 'daily' : undefined).catch(() => null);
      if (ranked && !hasUniqueSolution(ranked)) ranked = null;
      if (E.variants[level].grade === 4 && ranked?.difficultyRating?.version !== E.expertRatingVersion) ranked = null;
      if (daily) {
        const date = ranked?.date || E.dayKey();
        const game = restore(dailyKey(date)) ?? createGame(E.DAILY_LEVEL, { ...(ranked?.date ? ranked : E.dailyPuzzle(date)), date });
        showGame(game);
      } else {
        showGame(createGame(level, ranked ?? await generateLocal(level)));
      }
    } catch { announce('Não foi possível preparar o jogo. Tente novamente.'); }
    finally {
      busy = false;
      homeActions.inert = false;
      $('start-game').disabled = $('daily-game').disabled = $('new-game').disabled = $('return-game').disabled = false;
      $('start-game').textContent = 'Começar jogo';
      $('home-daily').textContent = 'Desafio diário';
      lastTick = performance.now();
      if (state) render();
    }
  }
  function openDaily() {
    if (busy) return;
    const today = E.dayKey();
    if (state?.date === today) {
      openStats('daily');
      return;
    }
    const saved = restore(dailyKey(today));
    if (saved) {
      if (state) { tick(); save(); }
      showGame(saved);
      if (saved.completed) openStats('daily');
    } else startGame(E.DAILY_LEVEL, true);
  }
  function shareGame() {
    tick();
    const url = new URL(location.href);
    const code = ['v1', state.level, E.encode(state.puzzle), Math.min(9999999, Math.floor(state.seconds))].join('.');
    url.searchParams.set('desafio', code);
    $('share-link').value = url.href;
    $('share-status').textContent = '';
    $('share-dialog').showModal();
  }
  async function copyLink() {
    const input = $('share-link');
    try {
      await navigator.clipboard.writeText(input.value);
      $('share-status').textContent = 'Link copiado.';
    } catch {
      input.focus();
      input.select();
      $('share-status').textContent = 'Copie o link selecionado.';
    }
  }
  function buildBoard() {
    const { size, boxRows, boxCols } = grid;
    const board = $('board');
    const numpad = $('numpad');
    board.replaceChildren();
    numpad.replaceChildren();
    cells.length = keys.length = 0;
    gameElement.dataset.size = size;
    board.style.setProperty('--size', size);
    board.style.setProperty('--box-rows', boxRows);
    board.style.setProperty('--box-cols', boxCols);
    board.setAttribute('aria-label', `Tabuleiro de Sudoku, ${size} linhas e ${size} colunas`);
    numpad.style.setProperty('--pad-cols', size === 16 ? 8 : size);
    $('tutorial-symbols').textContent = size === 16 ? '1 a 9 e A a G' : `1 a ${size}`;
    $('tutorial-blocks').textContent = `${boxRows} × ${boxCols}`;
    for (let row = 0; row < size; row++) {
      const rowEl = document.createElement('div');
      rowEl.className = 'board-row';
      rowEl.setAttribute('role', 'row');
      for (let col = 0; col < size; col++) {
        const i = row * size + col;
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.setAttribute('role', 'gridcell');
        cell.addEventListener('click', () => activateCell(i));
        rowEl.append(cell);
        cells.push(cell);
      }
      board.append(rowEl);
    }
    function addDividers(direction, interval) {
      for (let position = interval; position < size; position += interval) {
        const line = document.createElement('span');
        line.className = 'board-line ' + direction;
        line.setAttribute('aria-hidden', 'true');
        line.style.setProperty('--line-at', `${position / size * 100}%`);
        board.append(line);
      }
    }
    addDividers('horizontal', boxRows);
    addDividers('vertical', boxCols);
    for (let n = 1; n <= size; n++) {
      const key = document.createElement('button');
      key.type = 'button';
      key.className = 'number-key';
      const value = document.createElement('span');
      value.textContent = E.symbol(n);
      key.append(value, document.createElement('small'));
      key.addEventListener('click', () => chooseDigit(n));
      numpad.append(key);
      keys.push(key);
    }
  }
  $('quick-notes').addEventListener('click', quickNotes); $('erase').addEventListener('click', erase);
  $('notes').addEventListener('click', toggleNotes); $('hint').addEventListener('click', hint);
  $('pause').addEventListener('click', () => pause(!state?.paused)); $('resume').addEventListener('click', () => pause(false));
  $('home-new').addEventListener('click', openNew);
  $('home-continue').addEventListener('click', () => {
    const game = resumableGame();
    if (!game) { updateContinueButton(); return; }
    game.paused = false;
    showGame(game);
  });
  $('home-daily').addEventListener('click', openDaily);
  $('new-game').addEventListener('click', openNew);
  $('daily-game').addEventListener('click', openDaily);
  $('return-game').addEventListener('click', () => {
    tick();
    save();
    const game = restore();
    if (game) showGame(game);
    else startGame('easy');
  });
  $('stats').addEventListener('click', () => openStats());
  $('stats-size').addEventListener('change', event => showStats(levelFor(Number(event.target.value), statsLevel)));
  statsLevels.forEach(button => button.addEventListener('click', () => showStats(levelFor(E.variants[statsLevel].size, button.dataset.statsLevel))));
  statsViews.forEach(button => button.addEventListener('click', () => {
    statsView = button.dataset.statsView;
    showStats(statsLevel);
  }));
  $('ranking-form').addEventListener('submit', publishRank);
  $('win-ranking').addEventListener('click', () => { $('win-dialog').close(); openStats(state.date ? 'daily' : 'ranking'); });
  $('share-board').addEventListener('click', shareGame);
  $('copy-link').addEventListener('click', copyLink);
  $('start-game').addEventListener('click', () => startGame(levelFor(nextSize, nextLevel)));
  newLevels.forEach(button => button.addEventListener('click', () => {
    nextLevel = button.dataset.level;
    showNewOptions();
  }));
  newSizes.forEach(button => button.addEventListener('click', () => {
    nextSize = Number(button.dataset.size);
    showNewOptions();
  }));
  $('play-again').addEventListener('click', () => { $('win-dialog').close(); openNew(); });
  dialogs.forEach(d => { d.addEventListener('close', () => { lastTick = performance.now(); }); d.addEventListener('cancel', e => { if (busy) e.preventDefault(); }); });
  document.addEventListener('keydown', event => {
    if (!state || blocked() || event.target.matches?.('input, select, textarea') || event.altKey) return;
    const key = event.key;
    if (event.ctrlKey || event.metaKey) return;
    const digit = /^[1-9a-g]$/i.test(key) ? parseInt(key, 17) : 0;
    if (digit && digit <= grid.size) { event.preventDefault(); if (!event.repeat) typeDigit(digit, event.target); }
    else if (key === 'Escape' && activeDigit) { chooseDigit(0); }
    else if (key === 'Delete' || key === 'Backspace') { event.preventDefault(); erase(); }
    else if (key.toLowerCase() === 'n') { event.preventDefault(); toggleNotes(); }
    else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
      event.preventDefault();
      const { size, row, col } = grid;
      const i = selected < 0 ? 0 : selected, r = row(i), c = col(i), last = size - 1;
      const next = key === 'ArrowUp' ? Math.max(0, r - 1) * size + c : key === 'ArrowDown' ? Math.min(last, r + 1) * size + c : key === 'ArrowLeft' ? r * size + Math.max(0, c - 1) : r * size + Math.min(last, c + 1);
      select(selected < 0 ? 0 : next, true);
    }
  });
  document.addEventListener('visibilitychange', () => { tick(); if (state) save(); });
  window.addEventListener('pagehide', () => { tick(); if (state) save(); });
  setInterval(tick, 250); setInterval(() => { if (state) save(); }, 5000);
  const challenge = new URLSearchParams(location.search).get('desafio');
  const friendGame = E.readChallenge(challenge);
  if (friendGame) {
    const button = $('home-friend');
    button.hidden = false;
    button.addEventListener('click', () => {
      const game = restore(friendKey(challenge)) ?? createGame(friendGame.level, { ...friendGame, challenge });
      showGame(game);
    });
  }
  updateContinueButton();
  const showHomeActions = () => {
    home.classList.add('is-ready');
    homeActions.inert = false;
    if (challenge !== null && !friendGame) announce('Este link de desafio é inválido.');
  };
  if (reducedMotion.matches) showHomeActions();
  else setTimeout(showHomeActions, 2000);
})();
