import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** true quando as variáveis do Supabase foram configuradas. */
export const onlineEnabled = Boolean(url && anon);

let browserClient: SupabaseClient | null = null;

/** Cliente do navegador: só LÊ partidas e recebe atualizações em tempo real. */
export function supabaseBrowser() {
  if (!onlineEnabled) return null;
  browserClient ??= createClient(url!, anon!, { auth: { persistSession: false } });
  return browserClient;
}

export type ChessGameRow = {
  id: string;
  created_at: string;
  updated_at: string;
  status: "waiting" | "active" | "finished";
  fen: string;
  pgn: string;
  last_move: { from: string; to: string } | null;
  result: "1-0" | "0-1" | "1/2-1/2" | null;
  reason: string | null;
  white_name: string | null;
  black_name: string | null;
};
