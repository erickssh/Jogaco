(() => {
  'use strict';

  const opening = document.getElementById('opening');
  const buttons = document.querySelectorAll('[data-option]');
  const concepts = [
    '<div class="intro-brand"><div class="intro-mark" aria-hidden="true"><span>1</span><span>2</span><span>3</span><span>3</span><span>1</span><span>2</span><span>2</span><span>3</span><span>1</span></div><span class="intro-wordmark">sudoku<span>.</span></span></div>',
    '<div class="concept"><div class="pieces-mark" aria-hidden="true"><span>1</span><span>2</span><span>3</span><span>3</span><span>1</span><span>2</span><span>2</span><span>3</span><span>1</span></div><span class="concept-name">sudoku<em>.</em></span></div>',
    '<div class="concept"><svg class="outline-mark" viewBox="0 0 100 100" aria-hidden="true"><rect x="7" y="7" width="86" height="86" rx="12" pathLength="260"></rect><path d="M36 8v84M64 8v84M8 36h84M8 64h84" pathLength="120"></path><text x="17" y="29">4</text><text x="44" y="58">7</text><text x="73" y="86">2</text></svg><span class="concept-name">sudoku<em>.</em></span></div>',
    '<div class="concept"><div class="reveal-mark" aria-hidden="true"><span>1</span><span>4</span><span>7</span><span>2</span><span>6</span><span>9</span></div><span class="concept-name">sudoku<em>.</em></span></div>'
  ];
  let fadeTimer, hideTimer;

  function play(option) {
    clearTimeout(fadeTimer);
    clearTimeout(hideTimer);
    buttons.forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.option) === option)));
    opening.hidden = false;
    opening.classList.remove('leaving');
    opening.replaceChildren();
    opening.insertAdjacentHTML('afterbegin', concepts[option]);
    fadeTimer = setTimeout(() => {
      opening.classList.add('leaving');
      hideTimer = setTimeout(() => { opening.hidden = true; }, 350);
    }, 1700);
  }

  buttons.forEach(button => button.addEventListener('click', () => play(Number(button.dataset.option))));
})();
