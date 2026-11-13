import { Chess, Move } from "chess.js";

// IA simples: minimax com poda alfa-beta, avaliando material + posição central.
const VALUE: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
const CENTER = [0, 1, 2, 3, 3, 2, 1, 0];

function evaluate(chess: Chess): number {
  // Positivo = bom para as brancas
  if (chess.isCheckmate()) return chess.turn() === "w" ? -100000 : 100000;
  if (chess.isDraw()) return 0;
  let score = 0;
  const board = chess.board();
  for (let r = 0; r < 8; r++)
    for (let f = 0; f < 8; f++) {
      const p = board[r][f];
      if (!p) continue;
      let v = VALUE[p.type];
      if (p.type !== "k" && p.type !== "r") v += (CENTER[r] + CENTER[f]) * (p.type === "p" ? 3 : 5);
      if (p.type === "p") v += (p.color === "w" ? 7 - r : r) * 4; // incentiva avançar peões
      score += p.color === "w" ? v : -v;
    }
  return score;
}

function order(moves: Move[]) {
  // Capturas primeiro melhora a poda
  return moves.sort((a, b) => (b.captured ? VALUE[b.captured] : 0) - (a.captured ? VALUE[a.captured] : 0));
}

function search(chess: Chess, depth: number, alpha: number, beta: number, max: boolean): number {
  if (depth === 0 || chess.isGameOver()) return evaluate(chess);
  const moves = order(chess.moves({ verbose: true }));
  if (max) {
    let best = -Infinity;
    for (const m of moves) {
      chess.move(m);
      best = Math.max(best, search(chess, depth - 1, alpha, beta, false));
      chess.undo();
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  }
  let best = Infinity;
  for (const m of moves) {
    chess.move(m);
    best = Math.min(best, search(chess, depth - 1, alpha, beta, true));
    chess.undo();
    beta = Math.min(beta, best);
    if (beta <= alpha) break;
  }
  return best;
}

export type Level = 1 | 2 | 3;

/** Escolhe um lance para o lado da vez. Nível 1 = fácil (erra de propósito), 3 = mais forte. */
export function bestMove(fen: string, level: Level): Move | null {
  const chess = new Chess(fen);
  const moves = chess.moves({ verbose: true });
  if (!moves.length) return null;
  if (level === 1 && Math.random() < 0.35) return moves[Math.floor(Math.random() * moves.length)];

  const depth = level === 3 ? 3 : 2;
  const white = chess.turn() === "w";
  let best: Move[] = [];
  let bestScore = white ? -Infinity : Infinity;
  for (const m of order(moves)) {
    chess.move(m);
    const s = search(chess, depth - 1, -Infinity, Infinity, !white);
    chess.undo();
    if ((white && s > bestScore) || (!white && s < bestScore)) {
      bestScore = s;
      best = [m];
    } else if (s === bestScore) best.push(m);
  }
  return best[Math.floor(Math.random() * best.length)];
}
