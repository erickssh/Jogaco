const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  generate, countSolutions, uniqueSolution, allNotes, peers, variants, grids, gradePuzzle, analyzeDifficulty,
  dayKey, dailyPuzzle, encode, readChallenge, expertRatingVersion
} = require('../dist/engine');
for (const [level, { size, grade, minScore, minAdvancedEffort, minHardestStep }] of Object.entries(variants)) {
  test(`${level}: 10 tabuleiros válidos, solução única e pistas coerentes`, () => {
    for (let run = 0; run < 10; run++) {
      const { puzzle, solution, difficultyRating } = generate(level);
      assert.equal(solution.length, size ** 2);
      for (let i = 0; i < solution.length; i++) {
        assert.ok(solution[i] >= 1 && solution[i] <= size);
        assert.ok(grids[size].peers[i].every(p => solution[p] !== solution[i]));
        assert.ok(puzzle[i] === 0 || puzzle[i] === solution[i]);
      }
      assert.equal(countSolutions(puzzle), 1);
      assert.equal(gradePuzzle(puzzle), grade);
      if (grade === 4) {
        assert.equal(gradePuzzle(puzzle, 3), null);
        const rating = analyzeDifficulty(puzzle);
        assert.ok(rating.score >= minScore);
        assert.ok(rating.advancedEffort >= minAdvancedEffort);
        assert.ok(rating.hardestStep >= minHardestStep);
        assert.deepEqual(difficultyRating, { version: expertRatingVersion, score: rating.score });
        const reoriented = size === 6 ? [...puzzle].reverse()
          : puzzle.map((_, i) => puzzle[(size - 1 - i % size) * size + Math.floor(i / size)]);
        const relabelled = reoriented.map(n => n ? size + 1 - n : 0);
        assert.deepEqual(analyzeDifficulty(relabelled), rating);
        assert.deepEqual(readChallenge(`v1.${level}.${encode(puzzle)}`).solution, solution);
      }
    }
  });
}
test('O Experiente reconhece X-Wing, XY-Wing e cadeias XY sem depender de contradições', () => {
  const puzzle = Array.from('000001004940800000060030200600003087005000400390000600007020010000508060000900000', Number);
  assert.equal(gradePuzzle(puzzle, 3), null);
  const rating = analyzeDifficulty(puzzle);
  assert.equal(rating.grade, 4);
  assert.ok(rating.techniques.xWing > 0);
  assert.ok(rating.techniques.xyWing > 0);
  assert.ok(rating.techniques.xyChain > 0);
  assert.equal(rating.techniques.refutation, 0);
  assert.equal(rating.pathsSolved, 2);
});
test('O Clássico Experiente tem opções com 64, 63 e 62 casas vazias', () => {
  for (const [pick, blanks] of [[0, 64], [.6, 63], [.95, 62]]) {
    let first = true;
    const { puzzle, solution } = generate('expert', () => {
      if (!first) return .42;
      first = false;
      return pick;
    });
    assert.equal(puzzle.filter(n => n === 0).length, blanks);
    assert.deepEqual(uniqueSolution(puzzle), solution);
    const rating = analyzeDifficulty(puzzle);
    assert.equal(rating.grade, 4);
    assert.ok(rating.score >= 218 && rating.advancedEffort >= 80 && rating.hardestStep >= 34);
  }
});
test('Rejeita conflito e reconhece múltiplas soluções', () => {
  const invalid = Array(81).fill(0); invalid[0] = invalid[8] = 1;
  assert.equal(countSolutions(invalid), 0);
  assert.equal(countSolutions(Array(81).fill(0)), 2);
  assert.equal(uniqueSolution(invalid), null);
  assert.equal(uniqueSolution(Array(81).fill(0)), null);
});

test('O dia vira à meia-noite de Brasília e reproduz o mesmo tabuleiro', () => {
  const before = dayKey(Date.UTC(2026, 10, 20, 2, 59));
  const after = dayKey(Date.UTC(2026, 10, 20, 3, 0));
  assert.equal(before, '2026-11-19');
  assert.equal(after, '2026-11-20');
  assert.deepEqual(dailyPuzzle(before), dailyPuzzle(before));
  assert.notDeepEqual(dailyPuzzle(before), dailyPuzzle(after));
});

test('O código compartilhado recria o desafio gigante e rejeita um tabuleiro sem solução única', () => {
  for (const level of ['giant', 'giant-medium', 'giant-hard']) {
    const { puzzle, solution } = generate(level);
    assert.deepEqual(readChallenge(`v1.${level}.${encode(puzzle)}.187`),
      { level, puzzle, solution, targetSeconds: 187 });
  }
  assert.equal(readChallenge('v1.giant.' + '0'.repeat(256)), null);
  assert.equal(readChallenge('v1.mini-medium.' + '9'.repeat(36)), null);
});
test('Cada casa tem 20 vizinhas únicas e a relação é simétrica', () => {
  peers.forEach((neighbors, i) => {
    assert.equal(new Set(neighbors).size, 20);
    assert.ok(!neighbors.includes(i));
    neighbors.forEach(j => assert.ok(peers[j].includes(i)));
  });
});
test('Lápis rápido respeita linha, coluna e bloco, preserva valores e recalcula', () => {
  const board = '530070000600195000098000060800060003400803001700020006060000280000419005000080079'.split('').map(Number);
  const original = [...board];
  const notes = allNotes(board);
  assert.equal(notes.length, 81);
  assert.deepEqual(notes[0], []);
  assert.deepEqual(notes[2], [1, 2, 4]);
  assert.deepEqual(notes[3], [2, 6]);
  assert.deepEqual(notes[40], [5]);
  assert.deepEqual(board, original);
  board[2] = 2;
  const updated = allNotes(board);
  assert.deepEqual(updated[2], []);
  assert.deepEqual(updated[3], [6]);
  assert.deepEqual(notes[3], [2, 6]);
});
