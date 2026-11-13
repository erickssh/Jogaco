import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Chess } from "chess.js";

// Toda gravação de partida passa por aqui: o servidor confere o token do jogador,
// a vez de jogar e a legalidade do lance. O navegador nunca grava direto no banco.

export const dynamic = "force-dynamic";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

const err = (msg: string, status = 400) => NextResponse.json({ error: msg }, { status });

function cleanName(v: unknown) {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, 24) : "Jogador";
}

function token() {
  return crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
}

function outcome(chess: Chess) {
  if (chess.isCheckmate()) return { result: chess.turn() === "w" ? "0-1" : "1-0", reason: "xeque-mate" };
  if (chess.isStalemate()) return { result: "1/2-1/2", reason: "afogamento" };
  if (chess.isThreefoldRepetition()) return { result: "1/2-1/2", reason: "repetição" };
  if (chess.isInsufficientMaterial()) return { result: "1/2-1/2", reason: "material insuficiente" };
  if (chess.isDraw()) return { result: "1/2-1/2", reason: "regra dos 50 lances" };
  return null;
}

export async function POST(req: Request) {
  const db = admin();
  if (!db) return err("Modo online não configurado no servidor.", 503);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return err("JSON inválido.");
  }
  const action = body.action;

  // ---------- Criar partida ----------
  if (action === "create") {
    const fen = new Chess().fen();
    const { data: game, error } = await db
      .from("chess_games")
      .insert({ fen, white_name: cleanName(body.name) })
      .select("id")
      .single();
    if (error || !game) {
      console.error("[xadrez] create:", error);
      return err("Não foi possível criar a partida.", 500);
    }
    const t = token();
    const { error: e2 } = await db.from("chess_seats").insert({ game_id: game.id, color: "w", token: t });
    if (e2) {
      console.error("[xadrez] seat:", e2);
      return err("Não foi possível reservar o lugar.", 500);
    }
    return NextResponse.json({ id: game.id, color: "w", token: t });
  }

  const id = typeof body.id === "string" ? body.id : "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return err("Partida inválida.");

  // ---------- Entrar como pretas ----------
  if (action === "join") {
    const t = token();
    // A chave primária (game_id, color) garante que só uma pessoa pega as pretas.
    const { error } = await db.from("chess_seats").insert({ game_id: id, color: "b", token: t });
    if (error) return err("Essa partida já tem dois jogadores.", 409);
    const { error: e2 } = await db
      .from("chess_games")
      .update({ status: "active", black_name: cleanName(body.name), updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "waiting");
    if (e2) return err("Não foi possível entrar.", 500);
    return NextResponse.json({ id, color: "b", token: t });
  }

  // As ações abaixo exigem o token do jogador
  const tk = typeof body.token === "string" ? body.token : "";
  const { data: seat } = await db.from("chess_seats").select("color").eq("game_id", id).eq("token", tk).maybeSingle();
  if (!seat) return err("Você não é jogador desta partida.", 403);

  const { data: game } = await db.from("chess_games").select("*").eq("id", id).single();
  if (!game) return err("Partida não encontrada.", 404);
  if (game.status !== "active") return err(game.status === "waiting" ? "Aguardando o adversário entrar." : "A partida já terminou.", 409);

  // ---------- Desistir ----------
  if (action === "resign") {
    await db
      .from("chess_games")
      .update({ status: "finished", result: seat.color === "w" ? "0-1" : "1-0", reason: "desistência", updated_at: new Date().toISOString() })
      .eq("id", id);
    return NextResponse.json({ ok: true });
  }

  // ---------- Jogar ----------
  if (action === "move") {
    const chess = new Chess();
    if (game.pgn) chess.loadPgn(game.pgn);
    if (chess.turn() !== seat.color) return err("Não é a sua vez.", 409);
    let move;
    try {
      move = chess.move({
        from: String(body.from),
        to: String(body.to),
        promotion: typeof body.promotion === "string" ? body.promotion : undefined,
      });
    } catch {
      return err("Lance ilegal.");
    }
    const end = outcome(chess);
    // Só grava se ninguém mudou a partida no meio do caminho (evita lances duplicados)
    const { data: updated, error } = await db
      .from("chess_games")
      .update({
        fen: chess.fen(),
        pgn: chess.pgn(),
        last_move: { from: move.from, to: move.to },
        status: end ? "finished" : "active",
        result: end?.result ?? null,
        reason: end?.reason ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("fen", game.fen)
      .select("id");
    if (error) return err("Erro ao salvar o lance.", 500);
    if (!updated?.length) return err("A partida mudou, recarregando…", 409);
    return NextResponse.json({ ok: true });
  }

  return err("Ação desconhecida.");
}
