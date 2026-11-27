(() => {
  'use strict';

  let player;
  function playerId() {
    if (player) return player;
    try {
      const key = 'sudoku-board-player';
      player = localStorage.getItem(key);
      if (!player) {
        player = crypto.randomUUID();
        localStorage.setItem(key, player);
      }
      return player;
    } catch {
      return undefined;
    }
  }

  async function request(route, body) {
    if (location.protocol === 'file:') throw new Error('O ranking precisa do servidor do jogo.');
    const response = await fetch(`api/ranking${route}`, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(body ? 3500 : 5000)
    });
    if (!response.headers.get('content-type')?.includes('application/json')) {
      throw new Error('O ranking está indisponível.');
    }
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'O ranking está indisponível.');
    return data;
  }

  window.SudokuRanking = {
    start: (level, mode) => request('/partidas', { level, mode, player: playerId() }),
    finish: (token, values, comparison) => request('/concluir', { token, values: SudokuEngine.encode(values), ...comparison }),
    publish: (token, nickname) => request('/publicar', { token, nickname }),
    list: (level, date) => request(date ? `?date=${encodeURIComponent(date)}` : `?level=${encodeURIComponent(level)}`)
  };
})();
