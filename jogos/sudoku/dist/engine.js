(function (root) {
  'use strict';

  const SYMBOLS = '0123456789ABCDEFG';
  const variants = {
    easy: { size: 9, clues: 41, grade: 1 },
    medium: { size: 9, clues: 33, grade: 2 },
    hard: { size: 9, clues: 27, grade: 3 },
    expert: { size: 9, clues: 19, minClues: 17, grade: 4, minScore: 218, minAdvancedEffort: 80, minHardestStep: 34 },
    'mini-easy': { size: 6, clues: 20, grade: 1 },
    'mini-medium': { size: 6, clues: 15, grade: 2 },
    'mini-hard': { size: 6, grade: 3 },
    'mini-expert': { size: 6, clues: 12, grade: 4, minScore: 62, minAdvancedEffort: 15, minHardestStep: 12 },
    giant: { size: 16, clues: 145, grade: 1 },
    'giant-medium': { size: 16, clues: 120, grade: 2 },
    'giant-hard': { size: 16, clues: 112, grade: 3 },
    'giant-expert': { size: 16, clues: 112, grade: 4, minScore: 390, minAdvancedEffort: 60, minHardestStep: 18 }
  };
  // A grade 3 is infrequent in 6×6. These generated boards can be relabelled
  // and rearranged within their blocks without changing their solving logic.
  const miniHardBoards = [
    '006050000100000300304005003064000000',
    '000000043500300100015340000000051200',
    '000000400301100060604020000000300005',
    '000003200000020400465031000000640300',
    '300200060050100000020060040020000005',
    '046000300460050030130006000002003600',
    '003200006000000050200300310400000000',
    '306000000060050400020001000000000102'
  ];
  // Original boards produced by this generator for the rare case in which
  // the live search reaches its attempt limit.
  const expertFallbacks = {
    6: '006052000160002500060000000000005240',
    16: 'A0070CF9E0802G0B0000A070G0420C001000400007A0600D000B0ED6CF0005A028D060EA0090000000000D080000A00E300000C4700A0D0G60700F000G284000E00A591000G002005000C2400000D600C004G080000F70000D00E000200B09010000F490A000G000D00000050200C4F90040B02G1300EA00B080D00009FC0003'
  };
  // Sparse layouts mined in advance by removing and replacing clues in
  // benchmark grids. Each new game rearranges a layout and verifies it again.
  const sparseClassicLayouts = {
    17: [
      '700009300000200000604000000100080060000000052000000004000010800005400000020000000',
      '000400030100000800000000000500029000000000070600000004007500000001080200034000000',
      '040000780300100000000000000103500000000080400200000000000000003000067000002000051',
      '008020010500037000000000000200000730000504000000000000310060000000100004000000500'
    ],
    18: [
      '030700000000080020010000000400000090000100500290060000000000103800020000000600700',
      '021000000000040070000800000050010203800070000000000000000205600700000080400300000',
      '852000000400000000000000160010000070000830000000040050000501600300000008000400000',
      '000000073056000000000020000109000040002050800300000000200000605700400000000100000',
      '143500000000000062000800000600000401000200300000708000400010000080000070000000000',
      '080000500900801000300000000000360000000200410070000900200000036000059000000000000',
      '060200000003000500000000107700005000000180400000000060100600040508000000000030000'
    ],
    19: [
      '010007000000030600000000420000000308400200000000670000600400050009000007002010000',
      '170005000000060840000000000000640200800000000500000460030000007000080050006200000',
      '000014032901800000000000940030002000600000100000040000020080000000700600700000000',
      '160000003000200000000065000000004650300000007000700000040000580200300000009010000',
      '080000300040050070010000400209070000000500800000000004000308000400000096000100000',
      '500002870030000000010500000000080304600000200001000000200000010080030000000410000'
    ]
  };
  const preferredClassicClueCounts = [17, 17, 17, 18, 18, 19];
  const expertRatingVersion = 3;
  const DAILY_LEVEL = 'medium';
  const dayFormat = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', dateStyle: 'short' });
  const range = length => Array.from({ length }, (_, i) => i);
  const bit = digit => 1 << (digit - 1);
  const single = mask => mask !== 0 && (mask & (mask - 1)) === 0;
  const uniquenessBudget = 18000;
  const digitsFrom = mask => {
    const digits = [];
    while (mask) {
      const lowest = mask & -mask;
      digits.push(32 - Math.clz32(lowest));
      mask ^= lowest;
    }
    return digits;
  };

  function createGrid(size, boxRows, boxCols) {
    const row = i => Math.floor(i / size);
    const col = i => i % size;
    const box = i => Math.floor(row(i) / boxRows) * boxRows + Math.floor(col(i) / boxCols);
    const indices = range(size * size);
    const units = Array.from({ length: size * 3 }, () => []);
    for (const i of indices) {
      units[row(i)].push(i);
      units[size + col(i)].push(i);
      units[size * 2 + box(i)].push(i);
    }
    const peers = indices.map(i => [...new Set([
      ...units[row(i)], ...units[size + col(i)], ...units[size * 2 + box(i)]
    ])].filter(j => j !== i));
    return { size, boxRows, boxCols, indices, row, col, box, units, peers, fullMask: (1 << size) - 1 };
  }

  const grids = { 6: createGrid(6, 2, 3), 9: createGrid(9, 3, 3), 16: createGrid(16, 4, 4) };
  const gridFor = board => grids[Math.sqrt(board.length)];
  const isLevel = level => typeof level === 'string' && Object.hasOwn(variants, level);
  const dayKey = (time = Date.now()) => dayFormat.format(time);
  const isDay = date => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
    && new Date(date + 'T00:00:00Z').toJSON()?.slice(0, 10) === date;
  const symbol = digit => SYMBOLS[digit] || '';
  const encode = values => values.map(symbol).join('');

  function validDigits(values, size) {
    return Array.isArray(values) && values.length === size * size
      && values.every(n => Number.isInteger(n) && n >= 0 && n <= size);
  }

  function shuffle(values, random) {
    const copy = [...values];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function seededRandom(seed) {
    let state = 2166136261;
    for (const c of seed) state = Math.imul(state ^ c.charCodeAt(0), 16777619);
    return () => {
      state = (state + 0x6D2B79F5) | 0;
      let n = Math.imul(state ^ (state >>> 15), state | 1);
      n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
      return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
    };
  }

  function candidateMask(board, i, grid) {
    let mask = grid.fullMask;
    for (const j of grid.peers[i]) if (board[j]) mask &= ~bit(board[j]);
    return mask;
  }

  function candidates(board, i, grid = gridFor(board)) {
    return digitsFrom(candidateMask(board, i, grid));
  }

  function allNotes(board) {
    const grid = gridFor(board);
    return board.map((value, i) => value ? [] : candidates(board, i, grid));
  }

  function search(input, limit = 2, nodeLimit = Infinity, random) {
    const grid = Array.isArray(input) && gridFor(input);
    const result = { count: 0, solution: null, exhausted: false };
    if (!grid || !validDigits(input, grid.size)) return result;
    const { size, indices, row, col, box, units, fullMask } = grid;
    const board = [...input];
    const rows = new Uint32Array(size), cols = new Uint32Array(size), boxes = new Uint32Array(size);
    const taken = i => rows[row(i)] | cols[col(i)] | boxes[box(i)];
    function toggle(i, valueBit) {
      rows[row(i)] ^= valueBit;
      cols[col(i)] ^= valueBit;
      boxes[box(i)] ^= valueBit;
    }
    for (const i of indices) {
      if (!board[i]) continue;
      const valueBit = bit(board[i]);
      if (taken(i) & valueBit) return result;
      toggle(i, valueBit);
    }
    let visited = 0;
    const masks = new Uint32Array(board.length);
    function visit() {
      if (++visited > nodeLimit) {
        result.exhausted = true;
        return;
      }
      let next = -1, options = 0, fewest = size + 1;
      for (const i of indices) {
        if (board[i]) { masks[i] = 0; continue; }
        const mask = fullMask & ~taken(i);
        if (!mask) return;
        masks[i] = mask;
        let count = 0;
        for (let bits = mask; bits; bits &= bits - 1) count++;
        if (count >= fewest) continue;
        next = i;
        options = mask;
        fewest = count;
        if (count === 1) break;
      }
      if (next === -1) {
        result.count++;
        result.solution ??= [...board];
        return;
      }
      let unitChoices = null;
      let forcedBit = 0;
      if (!random && fewest > 1) {
        // Also branch on a missing digit with few possible positions in a unit.
        const filled = [...rows, ...cols, ...boxes];
        for (let u = 0; u < units.length && fewest > 1; u++) {
          for (let missing = fullMask & ~filled[u]; missing; missing &= missing - 1) {
            const valueBit = missing & -missing;
            const spots = [];
            for (const i of units[u]) {
              if (masks[i] & valueBit) spots.push(i);
              if (spots.length === fewest) break;
            }
            if (!spots.length) return;
            if (spots.length >= fewest) continue;
            fewest = spots.length;
            unitChoices = spots;
            forcedBit = valueBit;
            if (fewest === 1) break;
          }
        }
      }
      if (unitChoices) {
        const digit = 32 - Math.clz32(forcedBit);
        for (const i of unitChoices) {
          if (result.count >= limit || result.exhausted) return;
          board[i] = digit;
          toggle(i, forcedBit);
          visit();
          toggle(i, forcedBit);
          board[i] = 0;
        }
        return;
      }
      const choices = digitsFrom(options);
      for (const digit of random ? shuffle(choices, random) : choices) {
        if (result.count >= limit || result.exhausted) return;
        const valueBit = bit(digit);
        board[next] = digit;
        toggle(next, valueBit);
        visit();
        toggle(next, valueBit);
        board[next] = 0;
      }
    }
    visit();
    return result;
  }

  function countSolutions(board, limit = 2) {
    return search(board, limit).count;
  }

  function placeSingle(masks, board, grid, i, valueBit) {
    masks[i] = 0;
    board[i] = 32 - Math.clz32(valueBit);
    for (const j of grid.peers[i]) masks[j] &= ~valueBit;
  }

  function placeHiddenSingle(masks, board, grid) {
    for (const unit of grid.units) {
      let seen = 0, repeated = 0;
      for (const i of unit) {
        repeated |= seen & masks[i];
        seen |= masks[i];
      }
      const unique = seen & ~repeated;
      if (!unique) continue;
      const valueBit = unique & -unique;
      const index = unit.find(i => masks[i] & valueBit);
      placeSingle(masks, board, grid, index, valueBit);
      return true;
    }
    return false;
  }

  function removeLocked(masks, grid) {
    const { size, units, row, col, box } = grid;
    for (let u = 0; u < units.length; u++) {
      const unit = units[u];
      for (let valueBit = 1; valueBit <= bit(size); valueBit <<= 1) {
        const possible = unit.filter(i => masks[i] & valueBit);
        if (possible.length < 2) continue;
        const first = possible[0];
        const across = u < 2 * size ? [2 * size + box(first)]
          : [row(first), size + col(first)];
        for (const other of across) {
          if (!possible.every(i => units[other].includes(i))) continue;
          let removed = false;
          for (const i of units[other]) {
            if (!(masks[i] & valueBit) || unit.includes(i)) continue;
            masks[i] &= ~valueBit;
            removed = true;
          }
          if (removed) return true;
        }
      }
    }
    return false;
  }

  function removePair(masks, grid) {
    for (const unit of grid.units) {
      for (const i of unit) {
        const pair = masks[i];
        const rest = pair & (pair - 1);
        if (!single(rest)) continue;
        if (unit.filter(j => masks[j] === pair).length !== 2) continue;
        let removed = false;
        for (const j of unit) {
          if (masks[j] === pair || !(masks[j] & pair)) continue;
          masks[j] &= ~pair;
          removed = true;
        }
        if (removed) return true;
      }
    }
    return false;
  }

  function removeXWing(masks, grid) {
    const { size, units } = grid;
    for (const offset of [0, size]) {
      for (let value = 1; value <= bit(size); value <<= 1) {
        const lineByCrossings = new Map();
        for (let line = 0; line < size; line++) {
          let crossings = 0;
          const cells = units[offset + line];
          for (let cross = 0; cross < size; cross++) {
            if (masks[cells[cross]] & value) crossings |= 1 << cross;
          }
          if (!single(crossings & (crossings - 1))) continue;
          const other = lineByCrossings.get(crossings);
          if (other === undefined) {
            lineByCrossings.set(crossings, line);
            continue;
          }
          const crosses = digitsFrom(crossings).map(digit => digit - 1);
          let removed = false;
          for (let base = 0; base < size; base++) {
            if (base === line || base === other) continue;
            for (const cross of crosses) {
              const i = units[offset + base][cross];
              if (!(masks[i] & value)) continue;
              masks[i] &= ~value;
              removed = true;
            }
          }
          if (removed) return true;
        }
      }
    }
    return false;
  }

  function removeXYChain(masks, grid, indices) {
    // Follow implications through cells with two candidates. When both ends
    // share a candidate, it must be true at one end and false in common peers.
    const pairs = masks.map(mask => single(mask & (mask - 1)) ? mask : 0);
    let best = null;
    for (const start of indices) {
      if (!pairs[start]) continue;
      for (const digit of digitsFrom(pairs[start])) {
        const endpoint = bit(digit);
        const queue = [{ i: start, forced: pairs[start] ^ endpoint, length: 1 }];
        const seen = new Uint32Array(masks.length);
        for (let head = 0; head < queue.length; head++) {
          const { i, forced, length } = queue[head];
          if (length >= Math.min(7, (best?.length ?? 8) - 1)) continue;
          for (const next of grid.peers[i]) {
            if (next === start || !(pairs[next] & forced)) continue;
            const nextValue = pairs[next] ^ forced;
            if (seen[next] & nextValue) continue;
            seen[next] |= nextValue;
            if (nextValue === endpoint && length >= 2) {
              const targets = grid.peers[next].filter(j => (masks[j] & endpoint) && grid.peers[start].includes(j));
              if (targets.length) {
                if (length === 2) {
                  for (const j of targets) masks[j] &= ~endpoint;
                  return 3; // An XY-Wing is an XY-Chain with three cells.
                }
                best = { length: length + 1, targets, endpoint };
              }
            }
            queue.push({ i: next, forced: nextValue, length: length + 1 });
          }
        }
      }
    }
    if (!best) return 0;
    for (const j of best.targets) masks[j] &= ~best.endpoint;
    return best.length;
  }

  function refutationLength(masks, board, grid, indices, units) {
    let length = 1;
    while (true) {
      let placed = false;
      for (const i of indices) {
        if (board[i]) continue;
        if (!masks[i]) return length;
        if (!single(masks[i])) continue;
        placeSingle(masks, board, grid, i, masks[i]);
        length++;
        placed = true;
      }
      if (placed) continue;
      for (const unit of units) {
        let filled = 0, seen = 0, repeated = 0;
        for (const i of unit) {
          if (board[i]) filled |= bit(board[i]);
          repeated |= seen & masks[i];
          seen |= masks[i];
        }
        if ((filled | seen) !== grid.fullMask) return length;
        const unique = seen & ~repeated;
        if (!unique) continue;
        const valueBit = unique & -unique;
        placeSingle(masks, board, grid, unit.find(i => masks[i] & valueBit), valueBit);
        length++;
        placed = true;
        break;
      }
      if (!placed) return 0;
    }
  }

  function removeByContradiction(masks, board, grid, indices, units) {
    // A candidate can be ruled out when assuming it leads to an impossible
    // position using only forced placements. The real board stays untouched.
    const open = indices.filter(i => !board[i])
      .map(i => ({ i, digits: digitsFrom(masks[i]) }))
      .sort((a, b) => a.digits.length - b.digits.length);
    for (const { i, digits } of open) {
      for (const digit of digits) {
        const valueBit = bit(digit);
        const trialMasks = masks.slice();
        const trialBoard = board.slice();
        placeSingle(trialMasks, trialBoard, grid, i, valueBit);
        const length = refutationLength(trialMasks, trialBoard, grid, indices, units);
        if (!length) continue;
        masks[i] &= ~valueBit;
        return length;
      }
    }
    return 0;
  }

  function gradeBasicPuzzle(input, maxGrade) {
    const grid = gridFor(input);
    const board = [...input];
    const masks = input.map((n, i) => n ? 0 : candidateMask(input, i, grid));
    let grade = 1;
    while (true) {
      let singlePlaced = false, open = false;
      for (const i of grid.indices) {
        if (board[i]) continue;
        open = true;
        if (!masks[i]) return null;
        if (single(masks[i])) {
          placeSingle(masks, board, grid, i, masks[i]);
          singlePlaced = true;
        }
      }
      if (!open) return grade;
      if (singlePlaced) continue;
      if (maxGrade >= 2 && placeHiddenSingle(masks, board, grid)) {
        grade = Math.max(grade, 2);
        continue;
      }
      if (maxGrade >= 3 && (removeLocked(masks, grid) || removePair(masks, grid))) {
        grade = Math.max(grade, 3);
        continue;
      }
      return null;
    }
  }

  function canonicalPuzzle(puzzle, { size, boxRows, boxCols }) {
    // A reflection, rotation or symbol relabelling should not affect a score.
    // Transposing is only a symmetry when blocks are square.
    let smallest;
    for (const transpose of boxRows === boxCols ? [false, true] : [false]) {
      for (const flipRows of [false, true]) {
        for (const flipCols of [false, true]) {
          const names = [0];
          let nextName = 1;
          let key = '';
          for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
              const row = flipRows ? size - 1 - r : r;
              const col = flipCols ? size - 1 - c : c;
              const value = puzzle[transpose ? col * size + row : row * size + col];
              names[value] ??= nextName++;
              key += SYMBOLS[names[value]];
            }
          }
          if (smallest === undefined || key < smallest) smallest = key;
        }
      }
    }
    return Array.from(smallest, value => SYMBOLS.indexOf(value));
  }

  function collectSingles(masks, indices, units, moves) {
    moves.fill(0);
    let direct = -1;
    let hidden = -1;
    let choices = 0;
    for (const i of indices) {
      if (!single(masks[i])) continue;
      if (direct === -1) direct = i;
      moves[i] = masks[i];
      choices++;
    }
    for (const unit of units) {
      let seen = 0, repeated = 0;
      for (const i of unit) {
        repeated |= seen & masks[i];
        seen |= masks[i];
      }
      for (let unique = seen & ~repeated; unique; unique &= unique - 1) {
        const value = unique & -unique;
        const i = unit.find(cell => masks[cell] & value);
        if (moves[i]) continue;
        if (hidden === -1) hidden = i;
        moves[i] = value;
        choices++;
      }
    }
    return { i: direct === -1 ? hidden : direct, choices, cost: direct === -1 ? 2 : 1 };
  }

  function advancedDeduction(masks, board, grid, indices, units) {
    if (removeXWing(masks, grid)) return { name: 'xWing', cost: 10 };
    const chainLength = removeXYChain(masks, grid, indices);
    if (chainLength) {
      return chainLength === 3 ? { name: 'xyWing', cost: 12 }
        : { name: 'xyChain', cost: 12 + (chainLength - 3) * 3 };
    }
    const length = removeByContradiction(masks, board, grid, indices, units);
    return length ? { name: 'refutation', cost: 14 + Math.min(length, 20) } : null;
  }

  function ratePath(input, grid, reverse) {
    const board = [...input];
    const masks = input.map((n, i) => n ? 0 : candidateMask(input, i, grid));
    const indices = reverse ? [...grid.indices].reverse() : grid.indices;
    const units = reverse ? [...grid.units].reverse() : grid.units;
    const moves = new Uint32Array(board.length);
    const techniques = { xWing: 0, xyWing: 0, xyChain: 0, refutation: 0 };
    let remaining = board.filter(n => !n).length;
    let effort = 0, advancedEffort = 0, hardestStep = 0, advancedSteps = 0, bottlenecks = 0;
    let grade = 1;
    while (remaining) {
      if (indices.some(i => !board[i] && !masks[i])) return null;
      const { i, choices, cost } = collectSingles(masks, indices, units, moves);
      if (i !== -1) {
        if (remaining > grid.size && choices <= 2) bottlenecks += 3 - choices;
        placeSingle(masks, board, grid, i, moves[i]);
        effort += cost;
        grade = Math.max(grade, cost);
        remaining--;
        continue;
      }
      if (removeLocked(masks, grid)) {
        effort += 4;
        grade = Math.max(grade, 3);
        continue;
      }
      if (removePair(masks, grid)) {
        effort += 5;
        grade = Math.max(grade, 3);
        continue;
      }
      const step = advancedDeduction(masks, board, grid, indices, units);
      if (!step) return null;
      grade = 4;
      techniques[step.name]++;
      hardestStep = Math.max(hardestStep, step.cost);
      effort += step.cost;
      advancedEffort += step.cost;
      advancedSteps++;
      bottlenecks += 4;
    }
    return { grade, score: effort + bottlenecks, advancedEffort, hardestStep, advancedSteps, bottlenecks, techniques };
  }

  function analyzeDifficulty(input, maxGrade = 4) {
    const grid = Array.isArray(input) && gridFor(input);
    if (!grid || !validDigits(input, grid.size)) return null;
    if (input.some((n, i) => n && grid.peers[i].some(j => input[j] === n))) return null;
    const canonical = maxGrade > 3 ? canonicalPuzzle(input, grid) : input;
    const basic = gradeBasicPuzzle(canonical, Math.min(maxGrade, 3));
    if (basic !== null) return { grade: basic, advancedSteps: 0 };
    if (maxGrade <= 3) return null;
    const paths = [ratePath(canonical, grid, false), ratePath(canonical, grid, true)].filter(Boolean);
    // Judge by the easier successful route found by the solver.
    paths.sort((a, b) => a.grade - b.grade || a.score - b.score || a.hardestStep - b.hardestStep);
    return paths.length ? { ...paths[0], pathsSolved: paths.length } : null;
  }

  function gradePuzzle(input, maxGrade = 4) {
    return maxGrade <= 3 ? gradeBasicPuzzle(input, maxGrade) : analyzeDifficulty(input, maxGrade)?.grade ?? null;
  }


  function rearrange(grid, random, gridValue) {
    const { size, boxRows, boxCols } = grid;
    const order = groupSize => shuffle(range(size / groupSize), random)
      .flatMap(g => shuffle(range(groupSize), random).map(i => g * groupSize + i));
    const rows = order(boxRows);
    const cols = order(boxCols);
    const digits = [0, ...shuffle(range(size).map(n => n + 1), random)];
    return rows.flatMap(r => cols.map(c => digits[gridValue(r, c)]));
  }

  function uniqueSolution(puzzle, nodeBudget = uniquenessBudget) {
    const result = search(puzzle, 2, nodeBudget);
    return !result.exhausted && result.count === 1 ? result.solution : null;
  }

  function makeSolution(grid, random) {
    const { size, boxRows, boxCols } = grid;
    if (size === 6) return search(Array(size * size).fill(0), 1, Infinity, random).solution;
    return rearrange(grid, random, (r, c) => 1 + (r * boxCols + Math.floor(r / boxRows) + c) % size);
  }

  function carveWithLogic(solution, { size, clues, grade }, random) {
    const puzzle = [...solution];
    let remaining = puzzle.length;
    let actualGrade = 1;
    for (const i of shuffle(grids[size].indices, random)) {
      puzzle[i] = 0;
      const rating = gradePuzzle(puzzle, grade);
      if (rating === null) {
        puzzle[i] = solution[i];
        continue;
      }
      remaining--;
      actualGrade = rating;
      if (remaining <= clues && actualGrade === grade) break;
    }
    return actualGrade === grade ? puzzle : null;
  }

  function expertRating(puzzle, { clues, minClues, minScore, minAdvancedEffort, minHardestStep }) {
    if (minClues !== undefined) {
      const count = puzzle.filter(Boolean).length;
      if (count < minClues || count > clues) return null;
    }
    const rating = analyzeDifficulty(puzzle);
    if (rating?.grade !== 4 || rating.score < minScore
        || rating.advancedEffort < minAdvancedEffort || rating.hardestStep < minHardestStep) return null;
    return { version: expertRatingVersion, score: rating.score };
  }

  function generateSparseClassic(variant, random) {
    const grid = grids[9];
    const target = preferredClassicClueCounts[Math.floor(random() * preferredClassicClueCounts.length)];
    for (const encoded of shuffle(sparseClassicLayouts[target], random)) {
      const layout = Array.from(encoded, Number);
      const rearranged = rearrange(grid, random, (row, col) => layout[row * grid.size + col]);
      // Relabelling alone preserves the score when a rearrangement makes
      // the deductions easier to spot.
      const digits = [0, ...shuffle(range(grid.size).map(n => n + 1), random)];
      const relabelled = layout.map(n => digits[n]);
      for (const puzzle of [rearranged, relabelled]) {
        const difficultyRating = expertRating(puzzle, variant);
        if (!difficultyRating) continue;
        const solution = uniqueSolution(puzzle);
        if (solution) return { puzzle, solution, difficultyRating };
      }
    }
    throw new Error('Não foi possível verificar um Clássico Experiente.');
  }

  function generateExpert(variant, random) {
    const { size, clues } = variant;
    if (size === 9) return generateSparseClassic(variant, random);
    const grid = grids[size];
    const attempts = size === 16 ? 16 : 48;
    for (let attempt = 0; attempt < attempts; attempt++) {
      const solution = makeSolution(grid, random);
      const puzzle = size === 16 ? carveWithLogic(solution, variants['giant-hard'], random) : [...solution];
      if (!puzzle) continue;
      let remaining = puzzle.filter(Boolean).length;
      for (const i of shuffle(grid.indices, random)) {
        if (!puzzle[i]) continue;
        puzzle[i] = 0;
        if (!uniqueSolution(puzzle, 3000)) {
          puzzle[i] = solution[i];
          continue;
        }
        if (--remaining > clues) continue;
        const difficultyRating = expertRating(puzzle, variant);
        if (difficultyRating) return { puzzle, solution, difficultyRating };
      }
    }
    const fallback = Array.from(expertFallbacks[size], value => SYMBOLS.indexOf(value));
    for (let attempt = 0; attempt < 5; attempt++) {
      const shuffled = rearrange(grid, random, (r, c) => fallback[r * size + c]);
      const difficultyRating = expertRating(shuffled, variant);
      if (!difficultyRating) continue;
      const solution = uniqueSolution(shuffled);
      if (solution) return { puzzle: shuffled, solution, difficultyRating };
    }
    const solution = uniqueSolution(fallback);
    const difficultyRating = expertRating(fallback, variant);
    if (solution && difficultyRating) return { puzzle: fallback, solution, difficultyRating };
    throw new Error('Não foi possível gerar um tabuleiro Experiente.');
  }

  function generate(level = 'easy', random = Math.random) {
    const variant = isLevel(level) ? variants[level] : variants.easy;
    const { size, grade } = variant;
    const grid = grids[size];
    if (grade === 4) return generateExpert(variant, random);
    if (level === 'mini-hard') {
      const template = miniHardBoards[Math.floor(random() * miniHardBoards.length)];
      const puzzle = rearrange(grid, random, (r, c) => Number(template[r * size + c]));
      const solution = uniqueSolution(puzzle);
      if (!solution) throw new Error('O tabuleiro Mini não passou na verificação de solução única.');
      return { puzzle, solution };
    }
    for (let attempt = 0; attempt < 32; attempt++) {
      const solution = makeSolution(grid, random);
      const puzzle = carveWithLogic(solution, variant, random);
      if (puzzle && uniqueSolution(puzzle)) return { puzzle, solution };
    }
    throw new Error('Não foi possível gerar um tabuleiro nesta dificuldade.');
  }

  function dailyPuzzle(date) {
    return generate(DAILY_LEVEL, seededRandom('sudoku-dia-v1:' + date));
  }

  function readChallenge(code) {
    if (typeof code !== 'string' || code.length > 300) return null;
    const parts = /^v1\.([a-z-]+)\.([0-9A-G]+)(?:\.(\d{1,7}))?$/.exec(code);
    if (!parts || !isLevel(parts[1])) return null;
    const [, level, encoded, seconds] = parts;
    const { size } = variants[level];
    const puzzle = Array.from(encoded, ch => SYMBOLS.indexOf(ch));
    if (!validDigits(puzzle, size) || !puzzle.includes(0)) return null;
    const solution = uniqueSolution(puzzle);
    if (!solution) return null;
    return { level, puzzle, solution, targetSeconds: seconds === undefined ? null : Number(seconds) };
  }

  const api = {
    generate, countSolutions, uniqueSolution, candidates, allNotes, gradePuzzle, analyzeDifficulty, validDigits, grids, variants,
    peers: grids[9].peers, DAILY_LEVEL, dayKey, isDay, dailyPuzzle, symbol, encode, isLevel, readChallenge, expertRatingVersion
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SudokuEngine = api;
})(globalThis);
