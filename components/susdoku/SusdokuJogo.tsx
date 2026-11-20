"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { LUGARES } from "@/lib/susdoku/dados";
import { Planta } from "./arte/Planta";
import { Rosto } from "./arte/Rosto";
import { Caso, emComodo, nomeCom, proximaDica, textoCaso, textoDesfecho, textoPista } from "@/lib/susdoku/motor";
import { Modo, formatarTempo, lerProgresso, salvarProgresso } from "@/lib/susdoku/progresso";

type Props = {
  caso: Caso;
  /** rótulo como "Escola · Fase 3" */
  rotulo: string;
  diario?: boolean;
  proximo?: string | null;
};

type Fim =
  | { tipo: "ganhou"; estrelas: number; selo: boolean; tempo?: number; recorde?: boolean }
  | { tipo: "perdeu" };

type Instante = { colocados: (number | null)[]; marcas: number[] };

const VIDAS = 3;

export function SusdokuJogo({ caso, rotulo, diario, proximo }: Props) {
  const n = caso.n;
  const [modo, setModo] = useState<Modo>("normal");
  const [colocados, setColocados] = useState<(number | null)[]>(() => Array(n).fill(null));
  const [marcas, setMarcas] = useState<Set<number>>(new Set());
  const [selecionado, setSelecionado] = useState<number | null>(null);
  const [modoX, setModoX] = useState(false);
  const [vidas, setVidas] = useState(VIDAS);
  const [perdeuVida, setPerdeuVida] = useState(false);
  const [dicas, setDicas] = useState(0);
  const [dica, setDica] = useState<{ pessoa: number; casa: number; texto: string } | null>(null);
  const [riscadas, setRiscadas] = useState<Set<number>>(new Set());
  const [historico, setHistorico] = useState<Instante[]>([]);
  const [aviso, setAviso] = useState<{ texto: string; tipo: "erro" | "info" | "ok" } | null>(null);
  const [erroCasa, setErroCasa] = useState<number | null>(null);
  const [fim, setFim] = useState<Fim | null>(null);
  const [acusando, setAcusando] = useState(false);
  const [tutorial, setTutorial] = useState(false);
  const [regras, setRegras] = useState(false);
  const inicio = useRef<number>(0);
  const [agora, setAgora] = useState(0);
  const avisoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Configuração e tutorial
  useEffect(() => {
    const p = lerProgresso();
    setModo(p.modo);
    if (caso.tutorial?.length && !p.tutoriais[caso.id]) setTutorial(true);
    inicio.current = Date.now();
  }, [caso]);

  // Cronômetro (só no Caso do Dia)
  useEffect(() => {
    if (!diario || fim) return;
    const t = setInterval(() => setAgora(Date.now()), 250);
    return () => clearInterval(t);
  }, [diario, fim]);

  const avisar = (texto: string, tipo: "erro" | "info" | "ok" = "info") => {
    setAviso({ texto, tipo });
    if (avisoTimer.current) clearTimeout(avisoTimer.current);
    avisoTimer.current = setTimeout(() => setAviso(null), 2800);
  };

  // ---------- Ações ----------
  const guardar = () => setHistorico((h) => [...h.slice(-50), { colocados: [...colocados], marcas: [...marcas] }]);

  const perder = (msg: string) => {
    const v = vidas - 1;
    setVidas(v);
    setPerdeuVida(true);
    avisar(msg, "erro");
    if (v <= 0) setFim({ tipo: "perdeu" });
  };

  const ganhar = (porAcusacao: boolean) => {
    const estrelas = 1 + (perdeuVida ? 0 : 1) + (dicas === 0 ? 1 : 0);
    const selo = porAcusacao && colocados.some((c) => c == null);
    const tempo = diario ? Math.round((Date.now() - inicio.current) / 1000) : undefined;
    setColocados([...caso.solucao]);
    setSelecionado(null);
    setDica(null);
    const p = lerProgresso();
    p.estrelas[caso.id] = Math.max(p.estrelas[caso.id] ?? 0, estrelas);
    if (selo) p.selos[caso.id] = true;
    let recorde = false;
    if (diario && tempo != null) {
      const data = caso.id.replace("diario-", "");
      const antes = p.diario[data];
      recorde = !antes || tempo < antes.tempo;
      if (recorde) p.diario[data] = { tempo, estrelas: Math.max(estrelas, antes?.estrelas ?? 0) };
    }
    salvarProgresso(p);
    setFim({ tipo: "ganhou", estrelas, selo, tempo, recorde });
  };

  const colocar = (p: number, c: number) => {
    if (modo === "normal" && caso.solucao[p] !== c) {
      setErroCasa(c);
      setTimeout(() => setErroCasa(null), 600);
      perder(`${nomeCom(caso.pessoas[p], true)} não estava nessa casa.`);
      return;
    }
    guardar();
    const novo = [...colocados];
    const outro = novo.indexOf(c);
    if (outro >= 0) novo[outro] = null;
    novo[p] = c;
    setColocados(novo);
    setMarcas((m) => {
      const x = new Set(m);
      x.delete(c);
      return x;
    });
    setSelecionado(null);
    if (dica?.pessoa === p) setDica(null);
    if (novo.every((x) => x != null)) {
      if (modo === "normal") ganhar(false);
      else avisar("Todos posicionados! Toque em ✅ Conferir.", "info");
    }
  };

  const clicarCasa = (c: number) => {
    if (fim) return;
    const quem = colocados.indexOf(c);
    if (modoX) {
      if (quem >= 0) return;
      guardar();
      setMarcas((m) => {
        const x = new Set(m);
        if (x.has(c)) x.delete(c);
        else x.add(c);
        return x;
      });
      return;
    }
    if (selecionado != null) return colocar(selecionado, c);
    if (quem >= 0) {
      if (modo === "dificil") setSelecionado(quem); // pega a pessoa para mudar de lugar
      return;
    }
    avisar("Escolha uma pessoa embaixo da planta primeiro.");
  };

  const tirarDaPlanta = (p: number) => {
    guardar();
    const novo = [...colocados];
    novo[p] = null;
    setColocados(novo);
  };

  const desfazer = () => {
    const ult = historico[historico.length - 1];
    if (!ult || fim) return;
    setHistorico((h) => h.slice(0, -1));
    setColocados(ult.colocados);
    setMarcas(new Set(ult.marcas));
  };

  const pedirDica = () => {
    if (fim) return;
    const certos = colocados.map((c, p) => (c === caso.solucao[p] ? c : null));
    const passo = proximaDica(caso, certos);
    if (!passo || passo.pessoa == null || passo.casa == null) return;
    setDicas((d) => d + 1);
    const pessoa = caso.pessoas[passo.pessoa];
    const pistas = passo.pistas.map((i) => caso.pistas.indexOf(caso.pistas[i]) + 1).sort((a, b) => a - b);
    const ref = pistas.length
      ? ` Releia ${pistas.length > 1 ? "as pistas" : "a pista"} ${pistas.join(", ")} e veja as linhas e colunas já ocupadas.`
      : " Veja as linhas e colunas já ocupadas.";
    setDica({ pessoa: passo.pessoa, casa: passo.casa, texto: `${nomeCom(pessoa, true)} só pode estar na casa destacada.${ref}` });
    setSelecionado(passo.pessoa);
  };

  const conferir = () => {
    if (fim || colocados.some((c) => c == null)) return;
    const errados = colocados.filter((c, p) => c !== caso.solucao[p]).length;
    if (errados === 0) ganhar(false);
    else perder(`${errados} ${errados === 1 ? "pessoa está" : "pessoas estão"} fora do lugar.`);
  };

  const acusar = (p: number) => {
    setAcusando(false);
    if (p === caso.culpado) ganhar(true);
    else perder(`Não foi ${nomeCom(caso.pessoas[p])}! Continue investigando.`);
  };

  const recomecar = () => {
    setColocados(Array(n).fill(null));
    setMarcas(new Set());
    setSelecionado(null);
    setVidas(VIDAS);
    setPerdeuVida(false);
    setDicas(0);
    setDica(null);
    setRiscadas(new Set());
    setHistorico([]);
    setFim(null);
    inicio.current = Date.now();
  };

  const trocarModo = (m: Modo) => {
    const p = lerProgresso();
    p.modo = m;
    salvarProgresso(p);
    setModo(m);
    recomecar();
  };

  const fecharTutorial = () => {
    const p = lerProgresso();
    p.tutoriais[caso.id] = true;
    salvarProgresso(p);
    setTutorial(false);
  };

  const alvo = caso.comodos[caso.alvo];
  const adulto = !LUGARES[caso.lugar]?.criancas;
  const tempoAtual = diario ? Math.max(0, Math.round(((fim?.tipo === "ganhou" && fim.tempo != null ? inicio.current + fim.tempo * 1000 : agora || Date.now()) - inicio.current) / 1000)) : 0;
  const todosColocados = colocados.every((c) => c != null);

  return (
    <div className="sd">
      <div className="sd-topo">
        <Link href="/susdoku" className="back">← Casos</Link>
        <span className="sd-rotulo">{rotulo}</span>
        <span className="sd-vidas" title="Vidas">{"❤️".repeat(vidas)}{"🖤".repeat(VIDAS - vidas)}</span>
        {diario && <span className="pill">⏱ {formatarTempo(tempoAtual)}</span>}
      </div>

      <section className="sd-caso card">
        <h2>{caso.titulo}</h2>
        <p>{textoCaso(caso)}</p>
        <p className="sd-objetivo">
          Descubra onde cada um estava. Quem estava <b>sozinho</b>{" "}
          <span className="sd-comodo-tag" style={{ background: alvo.cor }}>🔎 {emComodo(alvo)}</span> é o culpado.
        </p>
      </section>

      <div className="sd-meio">
        <div className="sd-planta-box">
          <Planta
            caso={caso}
            colocados={colocados}
            marcas={marcas}
            dicaCasa={fim ? null : dica?.casa ?? null}
            erroCasa={erroCasa}
            revelado={fim?.tipo === "ganhou"}
            selecionado={selecionado}
            onClicar={clicarCasa}
          />

          <div className="sd-pessoas">
            {caso.pessoas.map((p, i) => {
              const colocado = colocados[i] != null;
              return (
                <button
                  key={i}
                  className={`sd-chip ${selecionado === i ? "sel" : ""} ${colocado ? "colocado" : ""} ${dica?.pessoa === i ? "dica" : ""}`}
                  onClick={() => {
                    if (fim) return;
                    setModoX(false);
                    if (colocado && modo === "normal") return;
                    setSelecionado(selecionado === i ? null : i);
                  }}
                  onDoubleClick={() => modo === "dificil" && colocado && tirarDaPlanta(i)}
                >
                  <Rosto nome={p.nome} g={p.g} adulto={adulto} expressao={selecionado === i ? "nervoso" : "neutro"} tamanho={34} />
                  <span>{p.nome}</span>
                  {colocado && <span className="sd-ok">✓</span>}
                </button>
              );
            })}
          </div>

          <div className="sd-acoes">
            <button className={`btn small-btn ${modoX ? "gold" : ""}`} onClick={() => { setModoX((x) => !x); setSelecionado(null); }} disabled={!!fim}>
              ✖ Marcar
            </button>
            <button className="btn small-btn" onClick={desfazer} disabled={!historico.length || !!fim}>↶ Desfazer</button>
            <button className="btn small-btn" onClick={pedirDica} disabled={!!fim}>💡 Dica</button>
            {modo === "dificil" && (
              <button className="btn small-btn gold" onClick={conferir} disabled={!todosColocados || !!fim}>✅ Conferir</button>
            )}
            <button className="btn small-btn sd-acusar" onClick={() => setAcusando(true)} disabled={!!fim}>🔎 Acusar</button>
          </div>
          {selecionado != null && !fim && (
            <p className="sd-instrucao">
              Toque na casa onde {nomeCom(caso.pessoas[selecionado])} estava.
              {modo === "dificil" && colocados[selecionado] != null && (
                <button className="sd-link" onClick={() => { tirarDaPlanta(selecionado); setSelecionado(null); }}>Tirar da planta</button>
              )}
            </p>
          )}
          {modoX && <p className="sd-instrucao">✖ Toque nas casas onde você tem certeza que não havia ninguém.</p>}
          {dica && !fim && <p className="sd-dica-texto">💡 {dica.texto}</p>}
        </div>

        <aside className="sd-pistas card">
          <div className="sd-pistas-topo">
            <h3>Pistas</h3>
            <button className="sd-link" onClick={() => setRegras(true)}>📜 Regras</button>
          </div>
          <ol>
            {caso.pistas.map((ps, i) => (
              <li
                key={i}
                className={riscadas.has(i) ? "riscada" : ""}
                onClick={() => setRiscadas((r) => {
                  const x = new Set(r);
                  if (x.has(i)) x.delete(i);
                  else x.add(i);
                  return x;
                })}
              >
                {textoPista(caso, ps)}
              </li>
            ))}
          </ol>
          <p className="muted small">Toque numa pista para riscá-la quando já tiver usado.</p>
          <div className="sd-modo">
            <span className="muted small">Modo:</span>
            <button className={`chip ${modo === "normal" ? "on" : ""}`} onClick={() => modo !== "normal" && trocarModo("normal")}>Normal</button>
            <button className={`chip ${modo === "dificil" ? "on" : ""}`} onClick={() => modo !== "dificil" && trocarModo("dificil")}>Difícil</button>
          </div>
          <p className="muted small">
            {modo === "normal" ? "Normal: o jogo avisa na hora quando alguém é colocado errado." : "Difícil: nada é avisado. Quando todos estiverem posicionados, use ✅ Conferir."}
          </p>
        </aside>
      </div>

      {aviso && <div className={`sd-aviso ${aviso.tipo}`}>{aviso.texto}</div>}

      {/* Acusar */}
      {acusando && (
        <div className="modal-bg" onClick={() => setAcusando(false)}>
          <div className="modal card" onClick={(e) => e.stopPropagation()}>
            <button className="modal-x" onClick={() => setAcusando(false)} aria-label="Fechar">×</button>
            <h2>🔎 Quem foi?</h2>
            <p className="muted small">Se acertar antes de posicionar todos, você ganha o selo <b>Detetive Brilhante</b>. Se errar, perde uma vida.</p>
            <div className="sd-acusar-lista">
              {caso.pessoas.map((p, i) => (
                <button key={i} className="btn sd-acusar-pessoa" onClick={() => acusar(i)}><Rosto nome={p.nome} g={p.g} adulto={adulto} expressao="nervoso" tamanho={56} /><span>{p.nome}</span></button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tutorial da fase */}
      {tutorial && caso.tutorial && (
        <div className="modal-bg">
          <div className="modal card">
            <h2>🕵️ Como jogar</h2>
            <ul className="sd-tutorial">{caso.tutorial.map((t, i) => <li key={i}>{t}</li>)}</ul>
            <button className="btn gold" onClick={fecharTutorial}>Entendi, vamos lá!</button>
          </div>
        </div>
      )}

      {/* Regras gerais */}
      {regras && (
        <div className="modal-bg" onClick={() => setRegras(false)}>
          <div className="modal card" onClick={(e) => e.stopPropagation()}>
            <button className="modal-x" onClick={() => setRegras(false)} aria-label="Fechar">×</button>
            <h2>📜 Regras do Susdoku</h2>
            <ul className="sd-tutorial">
              <li>Cada <b>linha</b> e cada <b>coluna</b> da planta tem exatamente <b>uma pessoa</b>.</li>
              <li>As linhas grossas separam os <b>cômodos</b>. Um cômodo pode ter várias pessoas ou nenhuma.</li>
              <li>&quot;Perto de um objeto&quot; quer dizer <b>na mesma casa</b> do objeto.</li>
              <li>&quot;Mais à esquerda&quot; compara colunas; &quot;mais acima&quot; compara linhas (não precisa ser vizinho).</li>
              <li>O culpado é quem estava <b>sozinho</b> no cômodo do ocorrido.</li>
              <li>⭐ resolveu · ⭐⭐ sem perder vida · ⭐⭐⭐ sem usar dica.</li>
            </ul>
          </div>
        </div>
      )}

      {/* Fim */}
      {fim && (
        <div className="modal-bg">
          <div className="modal card sd-fim">
            {fim.tipo === "ganhou" ? (
              <>
                <div className="sd-estrelas">{[1, 2, 3].map((k) => <span key={k} className={k <= fim.estrelas ? "on" : ""}>★</span>)}</div>
                <h2>Caso resolvido!</h2>
                <Rosto nome={caso.pessoas[caso.culpado].nome} g={caso.pessoas[caso.culpado].g} adulto={adulto} expressao="flagrado" tamanho={110} className="sd-flagrado" />
                <p>{textoDesfecho(caso)}</p>
                {fim.selo && <p className="badge ok">🔎 Detetive Brilhante: acusou antes de posicionar todos!</p>}
                {fim.tempo != null && <p className="earned">⏱ {formatarTempo(fim.tempo)}{fim.recorde ? " · seu melhor tempo hoje!" : ""}</p>}
                <p className="muted small">
                  {fim.estrelas < 3 && (perdeuVida ? "Resolva sem perder vida para ganhar mais estrelas. " : "")}
                  {fim.estrelas < 3 && dicas > 0 ? "Sem dicas vale a 3ª estrela." : ""}
                </p>
                <div className="row">
                  {proximo && <Link className="btn gold" href={`/susdoku/${proximo}`}>Próximo caso →</Link>}
                  <button className="btn" onClick={() => setFim(null)}>Ver planta</button>
                  <Link className="btn" href="/susdoku">Casos</Link>
                </div>
              </>
            ) : (
              <>
                <div className="overlay-emoji">🗂️</div>
                <h2>Caso arquivado…</h2>
                <p className="muted">Suas vidas acabaram. Que tal tentar de novo com calma?</p>
                <div className="row">
                  <button className="btn gold" onClick={recomecar}>↻ Tentar de novo</button>
                  <Link className="btn" href="/susdoku">Casos</Link>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
