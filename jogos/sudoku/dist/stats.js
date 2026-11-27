(function (root) {
  'use strict';

  const PREFIX = 'sudoku-pausa-win-v1:';

  function createStore(getStorage) {
    const sessionWins = new Map();

    function record({ id, level, seconds, mistakes, hints, difficultyRating }) {
      const key = PREFIX + id;
      if (sessionWins.has(key)) return;
      const win = { level, seconds, clean: mistakes === 0 };
      if (Number.isInteger(hints) && hints >= 0 && hints <= 3) win.hintsUsed = 3 - hints;
      if (Number.isFinite(difficultyRating?.score) && Number.isInteger(difficultyRating.version)) {
        win.difficultyRating = difficultyRating;
      }
      try {
        const storage = getStorage();
        if (storage.getItem(key) === null) storage.setItem(key, JSON.stringify(win));
      } catch {
        sessionWins.set(key, win);
      }
    }

    function forLevel(level) {
      const wins = new Map(sessionWins);
      try {
        const storage = getStorage();
        for (let i = 0; i < storage.length; i++) {
          const key = storage.key(i);
          if (!key?.startsWith(PREFIX)) continue;
          try { wins.set(key, JSON.parse(storage.getItem(key))); }
          catch { /* Ignora um registro inválido. */ }
        }
      } catch { /* Usa as vitórias desta sessão se o armazenamento estiver bloqueado. */ }

      let bestSeconds = null;
      let cleanWins = 0;
      for (const win of wins.values()) {
        if (win?.level !== level || !Number.isFinite(win.seconds) || win.seconds < 0) continue;
        if (bestSeconds === null || win.seconds < bestSeconds) bestSeconds = win.seconds;
        if (win.clean === true) cleanWins++;
      }
      return { bestSeconds, cleanWins };
    }

    return { record, forLevel };
  }

  const api = { createStore };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SudokuStats = api;
})(globalThis);
