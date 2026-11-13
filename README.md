# Jogaço 🎮🪙

Portal de jogos grátis no navegador com **sistema de recompensas**: o jogador ganha moedas em cada partida, completa missões diárias, mantém uma sequência de dias e troca moedas por itens.

## Como rodar

```bash
npm install
npm run dev
```

Abra http://localhost:3000

## O que já existe (MVP)

- **Catálogo** com busca e filtro por categoria
- **3 jogos próprios** (pontuação controlada pelo site):
  - Serpente Neon (arcade)
  - Memória Mágica (puzzle)
  - Esquiva Espacial (ação)
- **Recompensas**
  - Moedas por partida, com limite diário (`DAILY_GAME_COIN_CAP`) contra farm
  - Bônus diário que cresce com a sequência (até 7 dias)
  - 3 missões diárias (iguais para todos naquele dia)
  - XP e níveis
  - Loja de avatares
- Layout responsivo (celular e computador), com controles por toque

## Estrutura

```
app/                 páginas (Next.js App Router)
  page.tsx           home / catálogo
  jogo/[slug]/       página de cada jogo
  recompensas/       missões, bônus, loja, recordes
components/
  RewardsProvider    estado do jogador (moedas, missões…)
  GamePlayer         moldura do jogo (início, fim, moedas ganhas)
  games/             os jogos
lib/
  games.ts           catálogo e conversão pontos → moedas
  rewards.ts         regras de missões, níveis, loja, bônus
```

### Adicionar um jogo
1. Crie o componente em `components/games/` recebendo `onGameOver(score)`.
2. Cadastre em `lib/games.ts` e em `COMPONENTS` dentro de `components/GamePlayer.tsx`.

## Xadrez ♞

Página `/xadrez` com 3 modos:
- **Contra o computador** (fácil / médio / difícil) — vale moedas
- **2 jogadores no mesmo aparelho**
- **Online** — partidas em tempo real com link de convite (precisa do Supabase)

No modo online, todo lance passa pelo servidor (`app/api/xadrez/route.ts`), que confere
o jogador, a vez e a legalidade do lance. O navegador só lê as partidas.

### Ativar o xadrez online
1. Crie um projeto grátis em [supabase.com](https://supabase.com).
2. No Supabase, abra **SQL Editor → New query**, cole o conteúdo de `supabase/schema.sql` e clique em **Run**.
3. Em **Project Settings → API**, copie a URL e as chaves.
4. **No computador:** copie `.env.example` para `.env.local` e preencha.
5. **Na Vercel:** Settings → Environment Variables → cadastre as 3 variáveis e faça um Redeploy.

> A chave `SUPABASE_SERVICE_ROLE_KEY` é secreta: nunca coloque no GitHub nem compartilhe.

## Próximos passos

1. **Contas e backend (Supabase)**: hoje o progresso fica no navegador (`localStorage`), o que é fácil de burlar. Antes de qualquer recompensa com valor real, mover o registro de partidas e moedas para o servidor, com validação.
2. **Ranking semanal** (depende do backend).
3. **Mais jogos**: jogos próprios + catálogo de distribuidoras (GameDistribution, GamePix, GameMonetize) via iframe. Jogos de parceiros não informam a pontuação, então devem render moedas só por missões/tempo com limite.
4. **Anúncios**: AdSense ou SDK da distribuidora (intervalo entre partidas, vídeo recompensado).
5. **Recompensas reais** (cupons/vale-presente): validar antes com um advogado (Lei 5.768/71 e Lei 14.790/23).

## Deploy

Recomendado: [Vercel](https://vercel.com). Conecte o repositório do GitHub e clique em Deploy.
