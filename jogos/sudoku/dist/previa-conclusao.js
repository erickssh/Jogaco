(() => {
  'use strict';
  const conclusion = window.SudokuConclusion;
  const dialog = conclusion.mount();
  const buttons = [...document.querySelectorAll('[data-example]')];
  const solutionPanel = document.getElementById('preview-solution');
  const sample = SudokuEngine.dailyPuzzle('2026-11-24');
  const examples = {
    three: { time: '51:39', mistakes: 0, hintsUsed: 0, comparison: { status: 'ready', percent: 82 } },
    two: { time: '27:13', mistakes: 1, hintsUsed: 1, comparison: { status: 'ineligible' } },
    one: { time: '34:25', mistakes: 3, hintsUsed: 2, comparison: { status: 'ineligible' } },
    waiting: { time: '22:06', mistakes: 0, hintsUsed: 0, comparison: { status: 'insufficient' } }
  };
  let current = 'three';
  let pendingFrame;

  function showExample(name) {
    current = name;
    cancelAnimationFrame(pendingFrame);
    dialog.returnValue = '';
    dialog.close();
    solutionPanel.hidden = true;
    for (const button of buttons) {
      button.setAttribute('aria-pressed', String(button.dataset.example === name));
    }
    const example = examples[name];
    conclusion.showResult(example);
    conclusion.showComparison(example.comparison);
    pendingFrame = requestAnimationFrame(() => {
      pendingFrame = requestAnimationFrame(() => dialog.show());
    });
  }

  const board = document.getElementById('preview-board');
  for (let row = 0; row < 9; row++) {
    const line = document.createElement('div');
    line.className = 'board-row';
    line.setAttribute('role', 'row');
    for (let col = 0; col < 9; col++) {
      const index = row * 9 + col;
      const cell = document.createElement('span');
      cell.className = sample.puzzle[index] ? 'cell given' : 'cell';
      cell.setAttribute('role', 'gridcell');
      cell.textContent = sample.solution[index];
      line.append(cell);
    }
    board.append(line);
  }
  for (const button of buttons) button.addEventListener('click', () => showExample(button.dataset.example));
  document.getElementById('play-again').addEventListener('click', () => location.assign('index.html'));
  document.getElementById('preview-back').addEventListener('click', () => showExample(current));
  dialog.addEventListener('close', () => {
    if (dialog.returnValue !== 'board') return;
    solutionPanel.hidden = false;
    document.getElementById('preview-back').focus();
  });
  showExample(current);
})();
