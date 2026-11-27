(() => {
  'use strict';

  const star = `<svg viewBox="0 0 64 64" aria-hidden="true" class="win-star">
    <path class="star-depth" d="M32 3 41 21 61 24v4L47 42l3 17-18-8-18 8 3-17L3 28v-4l20-3Z"/>
    <path class="star-face" d="M32 3 41 21 61 24 47 38 50 56 32 48 14 56 17 38 3 24 23 21Z"/>
    <path class="star-light" d="m32 3 0 30-9-12Zm29 21-29 9 9-12ZM32 33l-15 5-3 18Zm0 0 18 23-18-8Z"/>
    <path class="star-shade" d="m32 3 9 18-9 12Zm0 30 29-9-14 14Zm0 0 0 15-18 8ZM3 24l29 9-15 5Z"/>
    <path class="star-edge" d="M4 24.5 23.5 22 32 4.5M42 22l17 2.5M18 39l-2.5 14"/>
  </svg>`;

  function mount() {
    const dialog = document.createElement('dialog');
    dialog.id = 'win-dialog';
    dialog.setAttribute('aria-labelledby', 'win-title');
    dialog.innerHTML = `
      <h2 id="win-title" tabindex="-1" autofocus>Muito bem pensado!</h2>
      <div id="win-stars" class="win-stars" role="img">${star.repeat(3)}</div>
      <dl id="win-stats" class="win-stats"></dl>
      <p id="win-comparison" class="win-comparison" role="status" hidden></p>
      <p id="win-target" hidden></p>
      <div id="win-rank-entry"></div>
      <div class="win-actions">
        <button class="primary mode-button" id="play-again" type="button">Novo jogo</button>
        <form method="dialog"><button class="primary mode-button" value="board">Ver meu tabuleiro</button></form>
      </div>
      <button class="secondary win-ranking" id="win-ranking" type="button" hidden>Ver ranking</button>
    `;
    document.body.append(dialog);
    return dialog;
  }

  function showResult({ time, mistakes, hintsUsed }) {
    const dialog = document.getElementById('win-dialog');
    const breaks = mistakes + (hintsUsed ?? 0);
    const stars = breaks === 0 ? 3 : breaks <= 2 ? 2 : 1;
    const rating = dialog.querySelector('#win-stars');
    rating.setAttribute('aria-label', `${stars} de 3 estrelas`);
    [...rating.children].forEach((shape, index) => {
      shape.classList.toggle('earned', index < stars);
      shape.style.setProperty('--star-index', index);
    });
    const stats = [['Tempo', time], ['Erros', mistakes]];
    if (hintsUsed != null) stats.push(['Dicas usadas', hintsUsed]);
    dialog.querySelector('#win-stats').replaceChildren(...stats.map(([label, value]) => {
      const metric = document.createElement('div');
      const name = document.createElement('dt');
      const number = document.createElement('dd');
      name.textContent = label;
      number.textContent = value;
      metric.append(name, number);
      return metric;
    }));
  }

  function showComparison(comparison) {
    const output = document.getElementById('win-comparison');
    output.hidden = !comparison;
    output.replaceChildren();
    if (!comparison) return;
    if (comparison.status === 'ready') {
      const percentage = document.createElement('strong');
      percentage.textContent = `${comparison.percent}%`;
      output.append('Você foi mais rápido que ', percentage, ' dos jogadores neste tabuleiro.');
      return;
    }
    output.textContent = {
      pending: 'Comparando seu tempo…',
      insufficient: 'Ainda há poucos resultados sem erros e sem dicas neste tabuleiro.',
      ineligible: 'A comparação de tempo vale para partidas sem erros e sem dicas.',
      replay: 'Seu primeiro resultado neste tabuleiro é o que conta para a comparação.',
      unavailable: 'A comparação de tempo está indisponível nesta partida.'
    }[comparison.status] ?? '';
  }

  window.SudokuConclusion = { mount, showResult, showComparison };
})();
