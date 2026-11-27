(() => {
  const game = document.querySelector('.sudoku-game');

  if (window.parent === window) {
    const desktop = window.matchMedia('(min-width: 768px)');
    const board = game.querySelector('.board-wrap');
    const fitBoard = () => {
      game.toggleAttribute('data-fit-viewport', desktop.matches);
      if (!desktop.matches) return;

      // Reserve space for the controls and tutorial as they actually appear.
      const surroundingHeight = game.getBoundingClientRect().height - board.getBoundingClientRect().height;
      const available = document.documentElement.clientHeight - Math.ceil(surroundingHeight);
      const limit = `${Math.max(0, available)}px`;
      if (game.style.getPropertyValue('--viewport-board-limit') !== limit) {
        game.style.setProperty('--viewport-board-limit', limit);
      }
    };
    const observer = new ResizeObserver(fitBoard);
    observer.observe(game);
    observer.observe(board);
    window.addEventListener('resize', fitBoard);
    fitBoard();
    return;
  }

  // Permite ao portal ajustar a altura do iframe à largura disponível.
  let lastHeight = 0;
  const reportSize = () => {
    const height = Math.ceil(game.getBoundingClientRect().height);
    if (height !== lastHeight) {
      lastHeight = height;
      // Somente dimensões públicas; nenhum dado da partida é transmitido.
      window.parent.postMessage({ type: 'sudoku:resize', height }, '*');
    }
  };
  new ResizeObserver(reportSize).observe(game);
  reportSize();
})();
