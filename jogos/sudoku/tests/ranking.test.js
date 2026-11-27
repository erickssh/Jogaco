const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createRanking } = require('../ranking-server');
const { dailyPuzzle, encode } = require('../dist/engine');

test('registra o tempo no servidor, publica por opção e preserva o resultado ao reiniciar', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sudoku-ranking-'));
  const database = path.join(directory, 'test.sqlite');
  let time = 10000;
  let ranking = createRanking(database, () => time);
  const request = (route, body) => ranking.handle('POST', '/api/ranking/' + route, null, body);
  const list = level => ranking.handle('GET', '/api/ranking', new URLSearchParams({ level })).data.entries;

  try {
    const match = request('partidas', { level: 'easy' });
    assert.equal(match.status, 201);
    const { token, solution } = match.data;
    assert.equal(request('publicar', { token, nickname: 'Jogadora' }).status, 409);
    time += 84500;
    const invalid = (solution[0] % 9 + 1) + solution.slice(1).join('');
    const signature = token.split('.')[1];
    const changed = token.replace('.' + signature, (signature[0] === 'a' ? '.b' : '.a') + signature.slice(1));
    assert.equal(request('concluir', { token, values: invalid }).status, 400);
    assert.equal(request('concluir', { token: changed, values: solution.join('') }).status, 400);
    assert.deepEqual(request('concluir', { token, values: solution.join(''), seconds: 1 }).data, { seconds: 84 });
    assert.deepEqual(list('easy'), []);
    time += 8000;
    assert.deepEqual(request('concluir', { token, values: solution.join('') }).data, { seconds: 84 });
    assert.equal(request('publicar', { token, nickname: '<script>' }).status, 400);
    assert.equal(request('publicar', { token, nickname: 'São Paulo' }).status, 200);
    assert.equal(request('publicar', { token, nickname: 'Outro nome' }).data.nickname, 'São Paulo');
    ranking.close();
    ranking = null;
    ranking = createRanking(database, () => time);
    assert.deepEqual(list('easy').map(entry => ({ ...entry })), [{ nickname: 'São Paulo', seconds: 84 }]);
    assert.deepEqual(list('medium'), []);
    assert.deepEqual(list('hard'), []);
  } finally {
    ranking?.close();
    fs.rmSync(database, { force: true });
    fs.rmSync(database + '-shm', { force: true });
    fs.rmSync(database + '-wal', { force: true });
    fs.rmdirSync(directory);
  }
});

test('mostra só os 10 menores tempos da dificuldade consultada', () => {
  let time = 10000;
  const ranking = createRanking(':memory:', () => time);
  const request = (route, body) => ranking.handle('POST', '/api/ranking/' + route, null, body);
  try {
    for (let seconds = 12; seconds >= 1; seconds--) {
      const { token, solution } = request('partidas', { level: 'medium' }).data;
      time += seconds * 1000;
      request('concluir', { token, values: solution.join('') });
      request('publicar', { token, nickname: 'Jogador ' + seconds });
    }
    const { entries } = ranking.handle('GET', '/api/ranking', new URLSearchParams({ level: 'medium' })).data;
    assert.deepEqual(entries.map(entry => entry.seconds), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    assert.ok(entries.every(entry => !Object.hasOwn(entry, 'id')));
  } finally {
    ranking.close();
  }
});

test('o desafio usa a mesma grade até meia-noite e publica em um ranking separado por data', () => {
  let time = Date.UTC(2026, 10, 20, 2, 58);
  const ranking = createRanking(':memory:', () => time);
  const request = (route, body) => ranking.handle('POST', '/api/ranking/' + route, null, body);
  const list = params => ranking.handle('GET', '/api/ranking', new URLSearchParams(params)).data.entries;
  try {
    const first = request('partidas', { mode: 'daily' }).data;
    const other = request('partidas', { mode: 'daily', level: 'giant' }).data;
    assert.equal(first.date, '2026-11-19');
    assert.deepEqual(first.puzzle, dailyPuzzle(first.date).puzzle);
    assert.deepEqual(first.puzzle, other.puzzle);
    assert.notEqual(first.token, other.token);

    time += 180000;
    const tomorrow = request('partidas', { mode: 'daily' }).data;
    assert.equal(tomorrow.date, '2026-11-20');
    assert.notDeepEqual(tomorrow.puzzle, first.puzzle);

    assert.equal(request('concluir', { token: first.token, values: encode(first.solution) }).status, 200);
    assert.equal(request('publicar', { token: first.token, nickname: 'Jogadora' }).status, 200);
    assert.deepEqual(list({ date: first.date }).map(entry => entry.seconds), [180]);
    assert.deepEqual(list({ date: tomorrow.date }), []);
    assert.deepEqual(list({ level: 'medium' }), []);
  } finally {
    ranking.close();
  }
});

test('mini e gigante aceitam suas soluções e mantêm o ranking de cada formato separado', () => {
  const ranking = createRanking(':memory:');
  const request = (route, body) => ranking.handle('POST', '/api/ranking/' + route, null, body);
  const list = level => ranking.handle('GET', '/api/ranking', new URLSearchParams({ level })).data.entries;
  try {
    for (const level of ['mini-hard', 'giant', 'giant-medium', 'giant-hard', 'expert', 'mini-expert', 'giant-expert']) {
      const { token, solution } = request('partidas', { level }).data;
      assert.equal(request('concluir', { token, values: encode(solution) }).status, 200);
      assert.equal(request('publicar', { token, nickname: level }).status, 200);
      assert.equal(list(level)[0].nickname, level);
    }
    assert.deepEqual(list('hard'), []);
  } finally {
    ranking.close();
  }
});

test('a comparação por tabuleiro usa tempo ativo, ignora empates e exclui erros e repetições', () => {
  let now = Date.UTC(2026, 10, 24, 12);
  const ranking = createRanking(':memory:', () => now);
  const post = (route, body) => ranking.handle('POST', '/api/ranking/' + route, null, body);
  const start = (player = randomUUID()) => post('partidas', { mode: 'daily', player }).data;
  const finish = (game, activeSeconds, alterMoves = moves => moves) => {
    const moves = game.puzzle.map((digit, i) =>
      digit ? '' : i.toString(16).padStart(2, '0') + game.solution[i]).join('');
    now += 101000;
    return post('concluir', {
      token: game.token, values: encode(game.solution), activeSeconds, moves: alterMoves(moves)
    }).data;
  };
  try {
    const player = randomUUID();
    assert.deepEqual(finish(start(player), 21).comparison, { status: 'insufficient' });
    assert.deepEqual(finish(start(player), 1).comparison, { status: 'replay' });
    assert.deepEqual(finish(start(), 90, moves => {
      const wrong = Number(moves[2]) % 9 + 1;
      return moves.slice(0, 2) + wrong + moves;
    }).comparison, { status: 'ineligible' });
    assert.deepEqual(finish(start(), 90, () => null).comparison, { status: 'ineligible' });
    assert.deepEqual(finish(start(), 999).comparison, { status: 'ineligible' });
    for (const seconds of [10, 15, 20, 30, 31, 32, 33, 34, 35]) finish(start(), seconds);
    const target = start();
    assert.deepEqual(finish(target, 20), {
      seconds: 101, comparison: { status: 'ready', total: 10, percent: 70 }
    });
    assert.deepEqual(finish(target, 5).comparison, { status: 'ready', total: 10, percent: 70 });
    now += 86_400_000;
    assert.deepEqual(finish(start(), 20).comparison, { status: 'insufficient' });
  } finally {
    ranking.close();
  }
});

test('a partida livre distribui o mesmo catálogo e alterna grades por navegador', () => {
  const ranking = createRanking(':memory:');
  try {
    const boards = player => Array.from({ length: 33 }, () => {
      const result = ranking.handle('POST', '/api/ranking/partidas', null, { level: 'expert', player });
      assert.equal(result.status, 201);
      assert.ok(result.data.compare);
      assert.ok(result.data.puzzle.filter(digit => digit === 0).length >= 62);
      return encode(result.data.puzzle);
    });
    const first = boards(randomUUID());
    const other = boards(randomUUID());
    assert.equal(new Set(first).size, 32);
    assert.equal(first[32], first[0]);
    assert.deepEqual(new Set(first), new Set(other));
  } finally {
    ranking.close();
  }
});
