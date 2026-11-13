"use client";

import { Chess, Square, PieceSymbol, Color } from "chess.js";
import { useMemo, useState } from "react";

// ︎ força a versão "texto" do símbolo (evita virar emoji no iPhone)
const GLYPH: Record<PieceSymbol, string> = {
  k: "♚︎", q: "♛︎", r: "♜︎", b: "♝︎", n: "♞︎", p: "♟︎",
};
const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

export type MoveInput = { from: Square; to: Square; promotion?: PieceSymbol };

type Props = {
  fen: string;
  orientation?: Color;
  /** Quais peças o usuário pode mover agora ("both" = mesmo aparelho). null = ninguém. */
  movable: Color | "both" | null;
  onMove: (m: MoveInput) => void;
  lastMove?: { from: string; to: string } | null;
};

export function ChessBoard({ fen, orientation = "w", movable, onMove, lastMove }: Props) {
  const chess = useMemo(() => new Chess(fen), [fen]);
  const [selected, setSelected] = useState<Square | null>(null);
  const [promo, setPromo] = useState<{ from: Square; to: Square } | null>(null);

  const turn = chess.turn();
  const canMoveNow = movable === "both" || movable === turn;

  const targets = useMemo(() => {
    if (!selected) return new Set<string>();
    return new Set(chess.moves({ square: selected, verbose: true }).map((m) => m.to));
  }, [chess, selected]);

  const checkSquare = useMemo(() => {
    if (!chess.inCheck()) return null;
    for (const row of chess.board()) for (const p of row) if (p && p.type === "k" && p.color === turn) return p.square;
    return null;
  }, [chess, turn]);

  const ranks = orientation === "w" ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
  const files = orientation === "w" ? FILES : [...FILES].reverse();

  const click = (sq: Square) => {
    if (!canMoveNow || promo) return;
    const piece = chess.get(sq);
    if (selected && targets.has(sq)) {
      const moving = chess.get(selected);
      const isPromo = moving?.type === "p" && (sq[1] === "8" || sq[1] === "1");
      if (isPromo) setPromo({ from: selected, to: sq });
      else onMove({ from: selected, to: sq });
      setSelected(null);
      return;
    }
    if (piece && piece.color === turn) setSelected(sq === selected ? null : sq);
    else setSelected(null);
  };

  return (
    <div className="board-wrap">
      <div className="board" role="grid" aria-label="Tabuleiro de xadrez">
        {ranks.map((r, ri) =>
          files.map((f, fi) => {
            const sq = `${f}${r}` as Square;
            const p = chess.get(sq);
            const dark = (FILES.indexOf(f) + r) % 2 === 1;
            const cls = [
              "sq",
              dark ? "dark" : "light",
              selected === sq ? "sel" : "",
              lastMove && (lastMove.from === sq || lastMove.to === sq) ? "last" : "",
              checkSquare === sq ? "check" : "",
            ].join(" ");
            return (
              <button key={sq} className={cls} onClick={() => click(sq)} aria-label={`${sq}${p ? ` ${p.color === "w" ? "branca" : "preta"} ${p.type}` : ""}`}>
                {p && <span className={`pc ${p.color === "w" ? "pw" : "pb"}`}>{GLYPH[p.type]}</span>}
                {targets.has(sq) && <span className={p ? "hint cap" : "hint"} />}
                {fi === 0 && <span className="coord rank">{r}</span>}
                {ri === 7 && <span className="coord file">{f}</span>}
              </button>
            );
          }),
        )}
        {promo && (
          <div className="promo">
            <span>Promover para:</span>
            <div>
              {(["q", "r", "b", "n"] as PieceSymbol[]).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    onMove({ ...promo, promotion: t });
                    setPromo(null);
                  }}
                >
                  <span className={`pc ${turn === "w" ? "pw" : "pb"}`}>{GLYPH[t]}</span>
                </button>
              ))}
            </div>
            <button className="btn small-btn" onClick={() => setPromo(null)}>Cancelar</button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Texto de status da partida, em português. */
export function statusText(chess: Chess): string {
  const side = chess.turn() === "w" ? "Brancas" : "Pretas";
  if (chess.isCheckmate()) return `Xeque-mate! ${chess.turn() === "w" ? "Pretas" : "Brancas"} vencem.`;
  if (chess.isStalemate()) return "Empate por afogamento.";
  if (chess.isThreefoldRepetition()) return "Empate por repetição.";
  if (chess.isInsufficientMaterial()) return "Empate por material insuficiente.";
  if (chess.isDraw()) return "Empate (regra dos 50 lances).";
  return chess.inCheck() ? `${side} em xeque!` : `Vez das ${side.toLowerCase()}.`;
}

export function resultFor(chess: Chess): "1-0" | "0-1" | "1/2-1/2" | null {
  if (chess.isCheckmate()) return chess.turn() === "w" ? "0-1" : "1-0";
  if (chess.isDraw() || chess.isStalemate()) return "1/2-1/2";
  return null;
}
