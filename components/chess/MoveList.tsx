"use client";

import { useEffect, useRef } from "react";

export function MoveList({ history }: { history: string[] }) {
  const ref = useRef<HTMLOListElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [history.length]);

  const pairs: [string, string?][] = [];
  for (let i = 0; i < history.length; i += 2) pairs.push([history[i], history[i + 1]]);

  return (
    <ol className="movelist" ref={ref}>
      {pairs.length === 0 && <li className="muted">Nenhum lance ainda.</li>}
      {pairs.map(([w, b], i) => (
        <li key={i}>
          <span className="mn">{i + 1}.</span>
          <span>{w}</span>
          <span>{b ?? ""}</span>
        </li>
      ))}
    </ol>
  );
}
