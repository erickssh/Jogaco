import Link from "next/link";

export default function NotFound() {
  return (
    <div className="center" style={{ padding: "60px 0" }}>
      <div style={{ fontSize: "4rem" }}>🕹️</div>
      <h1>Página não encontrada</h1>
      <p className="muted">Esse jogo saiu do catálogo ou o link está errado.</p>
      <Link href="/" className="btn gold">Ver todos os jogos</Link>
    </div>
  );
}
