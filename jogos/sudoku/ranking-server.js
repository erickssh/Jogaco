const { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { generate, isLevel, variants, dayKey, isDay, dailyPuzzle, DAILY_LEVEL, encode } = require('./dist/engine');
const catalog = require('./board-catalog.json');

const MATCH_LIFETIME = 7 * 24 * 60 * 60 * 1000;
const COMPARISON_SAMPLE = 10;
const PLAYER_ID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const symbols = '0123456789ABCDEFG';
const hash = digits => createHash('sha256').update(digits).digest('base64url');
const boardsByLevel = Object.fromEntries(Object.entries(catalog).map(([level, boards]) => [
  level, boards.map(board => ({ ...board, id: hash(board.puzzle) }))
]));
const boardsById = new Map(Object.values(boardsByLevel).flat().map(board => [board.id, board]));

function cleanSolve(puzzle, solution, moves) {
  if (typeof moves !== 'string' || moves.length > 12000 || !/^(?:[0-9a-f]{2}[0-9A-G])+$/.test(moves)) return false;
  const values = Array.from(puzzle);
  for (let i = 0; i < moves.length; i += 3) {
    const index = parseInt(moves.slice(i, i + 2), 16);
    const digit = moves[i + 2];
    if (puzzle[index] !== '0' || (digit !== '0' && digit !== solution[index])) return false;
    values[index] = digit;
  }
  return values.join('') === solution;
}

function response(status, data) {
  return { status, data };
}

function createRanking(path, now = Date.now) {
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 3000;
    CREATE TABLE IF NOT EXISTS ranking_secret (id INTEGER PRIMARY KEY CHECK (id = 1), secret TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS ranking_times (
      id TEXT PRIMARY KEY,
      level TEXT NOT NULL,
      seconds INTEGER NOT NULL,
      finished_at INTEGER NOT NULL,
      nickname TEXT
    );
    CREATE INDEX IF NOT EXISTS ranking_by_time
      ON ranking_times (level, seconds, finished_at, id) WHERE nickname IS NOT NULL;
    CREATE TABLE IF NOT EXISTS board_rotation (
      player TEXT NOT NULL, level TEXT NOT NULL, position INTEGER NOT NULL,
      PRIMARY KEY (player, level)
    );
    CREATE TABLE IF NOT EXISTS board_completions (
      board TEXT NOT NULL, player TEXT NOT NULL, match TEXT NOT NULL, active_seconds INTEGER,
      PRIMARY KEY (board, player)
    );
    CREATE INDEX IF NOT EXISTS board_completions_by_time
      ON board_completions (board, active_seconds) WHERE active_seconds IS NOT NULL;
  `);
  db.prepare('INSERT OR IGNORE INTO ranking_secret VALUES (1, ?)').run(randomBytes(32).toString('hex'));
  const secret = Buffer.from(db.prepare('SELECT secret FROM ranking_secret WHERE id = 1').get().secret, 'hex');
  const find = db.prepare('SELECT seconds, level, nickname FROM ranking_times WHERE id = ?');
  const finish = db.prepare('INSERT OR IGNORE INTO ranking_times (id, level, seconds, finished_at) VALUES (?, ?, ?, ?)');
  const publish = db.prepare('UPDATE ranking_times SET nickname = ? WHERE id = ? AND nickname IS NULL');
  const clearExpired = db.prepare('DELETE FROM ranking_times WHERE nickname IS NULL AND finished_at < ?');
  const list = db.prepare(`
    SELECT nickname, seconds FROM ranking_times
    WHERE level = ? AND nickname IS NOT NULL
    ORDER BY seconds, finished_at, id LIMIT 10
  `);

  const advanceRotation = db.prepare(`
    INSERT INTO board_rotation VALUES (?, ?, ?)
    ON CONFLICT (player, level) DO UPDATE SET position = (position + 1) % ?
    RETURNING position
  `);
  const recordBoard = db.prepare('INSERT OR IGNORE INTO board_completions VALUES (?, ?, ?, ?)');
  const findBoardResult = db.prepare('SELECT match, active_seconds FROM board_completions WHERE board = ? AND player = ?');
  const countBoardResults = db.prepare(`
    SELECT COUNT(*) AS total, COUNT(CASE WHEN active_seconds > ? THEN 1 END) AS slower
    FROM board_completions WHERE board = ? AND player != ? AND active_seconds IS NOT NULL
  `);
  const sign = payload => createHmac('sha256', secret).update(payload).digest();

  function sharedBoard(level, player) {
    const boards = boardsByLevel[level];
    const offset = createHash('sha256').update(player + level).digest().readUInt32BE() % boards.length;
    const { position } = advanceRotation.get(player, level, offset, boards.length);
    const board = boards[position];
    return {
      puzzle: Array.from(board.puzzle, digit => symbols.indexOf(digit)),
      solution: Array.from(board.solution, digit => symbols.indexOf(digit)),
      difficultyRating: board.difficultyRating
    };
  }

  function compareBoard(game, body, wallSeconds) {
    const puzzle = game.level.startsWith('daily:')
      ? encode(dailyPuzzle(game.level.slice(6)).puzzle)
      : boardsById.get(game.boardHash)?.puzzle;
    const board = game.level + ':' + game.boardHash;
    const seconds = body.activeSeconds;
    const qualified = puzzle && hash(puzzle) === game.boardHash
      && Number.isSafeInteger(seconds) && seconds >= 0 && seconds <= wallSeconds
      && cleanSolve(puzzle, body.values, body.moves);
    recordBoard.run(board, game.player, game.id, qualified ? seconds : null);
    const result = findBoardResult.get(board, game.player);
    if (result.match !== game.id) return { status: 'replay' };
    if (result.active_seconds === null) return { status: 'ineligible' };
    const { total, slower } = countBoardResults.get(result.active_seconds, board, game.player);
    if (total < COMPARISON_SAMPLE) return { status: 'insufficient' };
    return { status: 'ready', total, percent: Math.floor(100 * slower / total) };
  }

  function readToken(token) {
    if (typeof token !== 'string' || !/^[\w-]{30,500}\.[\w-]{43}$/.test(token)) return null;
    try {
      const [payload, signature] = token.split('.');
      const given = Buffer.from(signature, 'base64url');
      if (given.length !== 32 || !timingSafeEqual(given, sign(payload))) return null;
      const game = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
      const elapsed = now() - game.startedAt;
      return elapsed >= 0 && elapsed <= MATCH_LIFETIME ? game : null;
    } catch {
      return null;
    }
  }

  function handle(method, route, query, body = {}) {
    if (method === 'GET' && route === '/api/ranking') {
      const date = query.get('date');
      if (date !== null) {
        if (!isDay(date) || date > dayKey(now())) return response(400, { error: 'Escolha uma data válida.' });
        return response(200, { entries: list.all('daily:' + date) });
      }
      const level = query.get('level');
      if (!isLevel(level)) return response(400, { error: 'Escolha uma dificuldade.' });
      return response(200, { entries: list.all(level) });
    }
    if (method === 'POST' && route === '/api/ranking/partidas') {
      const startedAt = now();
      const daily = body.mode === 'daily';
      const level = daily ? DAILY_LEVEL : body.level;
      if (!isLevel(level)) return response(400, { error: 'Escolha uma dificuldade.' });
      const date = daily ? dayKey(startedAt) : undefined;
      const player = typeof body.player === 'string' && PLAYER_ID.test(body.player) ? body.player : undefined;
      const { puzzle, solution, difficultyRating } = daily ? dailyPuzzle(date)
        : player ? sharedBoard(level, player) : generate(level);
      const game = {
        id: randomUUID(), level: date ? 'daily:' + date : level, startedAt,
        size: variants[level].size, solutionHash: hash(encode(solution)),
        player, boardHash: player ? hash(encode(puzzle)) : undefined
      };
      const payload = Buffer.from(JSON.stringify(game)).toString('base64url');
      return response(201, {
        puzzle, solution, difficultyRating, date, compare: Boolean(player),
        token: `${payload}.${sign(payload).toString('base64url')}`
      });
    }
    if (method !== 'POST' || !['/api/ranking/concluir', '/api/ranking/publicar'].includes(route)) {
      return response(404, { error: 'Página não encontrada.' });
    }
    const game = readToken(body.token);
    if (!game) return response(400, { error: 'Esta partida ficou indisponível para o ranking.' });

    if (route === '/api/ranking/concluir') {
      if (typeof body.values !== 'string' || body.values.length !== (game.size ?? 9) ** 2
        || hash(body.values) !== game.solutionHash) {
        return response(400, { error: 'O tabuleiro ainda não está resolvido.' });
      }
      const finishedAt = now();
      const seconds = Math.max(1, Math.floor((finishedAt - game.startedAt) / 1000));
      clearExpired.run(finishedAt - MATCH_LIFETIME);
      finish.run(game.id, game.level, seconds, finishedAt);
      const comparison = game.player && game.boardHash ? compareBoard(game, body, seconds) : null;
      return response(200, { seconds: find.get(game.id).seconds, ...(comparison ? { comparison } : {}) });
    }

    const nickname = typeof body.nickname === 'string' ? body.nickname.normalize('NFC').trim().replace(/ +/g, ' ') : '';
    if (!/^[\p{L}\p{N}][\p{L}\p{N} ._-]{1,19}$/u.test(nickname)) {
      return response(400, { error: 'Use de 2 a 20 caracteres. Letras, números, espaços, pontos, hífens e sublinhados.' });
    }
    const result = find.get(game.id);
    if (!result) return response(409, { error: 'Complete a partida antes de publicar.' });
    publish.run(nickname, game.id);
    return response(200, { nickname: find.get(game.id).nickname });
  }

  return { handle, close: () => db.close() };
}

module.exports = { createRanking };
