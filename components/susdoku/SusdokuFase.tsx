"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Caso } from "@/lib/susdoku/motor";
import { casoDoDia, faseDoId, hoje } from "@/lib/susdoku/progresso";
import { SusdokuJogo } from "./SusdokuJogo";

/** Carrega a fase pelo id (ou o Caso do Dia) e abre o jogo. */
export function SusdokuFase({ id }: { id: string }) {
  const [dados, setDados] = useState<{ caso: Caso; rotulo: string; proximo: string | null; diario: boolean } | null | "erro">(null);

  useEffect(() => {
    // "diario" = hoje; "diario-AAAA-MM-DD" = caso de um dia específico (para compartilhar)
    const dataPedida = id.match(/^diario-(\d{4}-\d{2}-\d{2})$/)?.[1];
    if (id === "diario" || dataPedida) {
      const data = dataPedida ?? hoje();
      const caso = casoDoDia(data);
      const [a, m, d] = data.split("-");
      setDados(caso ? { caso, rotulo: `📅 Caso do Dia · ${d}/${m}/${a}`, proximo: null, diario: true } : "erro");
      return;
    }
    const f = faseDoId(id);
    if (!f) return setDados("erro");
    const proximo = f.capitulo.fases[f.indice + 1]?.id ?? null;
    setDados({ caso: f.caso, rotulo: `${f.capitulo.emoji} ${f.capitulo.nome} · Caso ${f.indice + 1}`, proximo, diario: false });
  }, [id]);

  if (dados === "erro") return <p className="muted center">Caso não encontrado. <Link href="/susdoku">Voltar</Link></p>;
  if (!dados) return <p className="muted center">Preparando o caso…</p>;
  return <SusdokuJogo key={dados.caso.id} caso={dados.caso} rotulo={dados.rotulo} diario={dados.diario} proximo={dados.proximo} />;
}
