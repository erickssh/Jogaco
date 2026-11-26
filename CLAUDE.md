# Jogaço — notas do projeto

Portal de jogos de navegador com sistema de recompensas (moedas, missões, sequência de dias).
Público brasileiro: **toda a interface e os textos dos jogos em português do Brasil**.

## Stack
- Next.js 16 (App Router) + React 19 + TypeScript. Estilos em `app/globals.css` (sem Tailwind).
- Supabase: banco do xadrez online + Realtime (Presence/Broadcast) para salas da Arena das Lendas.
- Deploy: Vercel, ligado ao GitHub `erickssh/Jogaco`. Projeto público: `jogaco-mxp3.vercel.app`.
  (Existe um segundo projeto Vercel `jogaco` ligado ao mesmo repositório — provavelmente sobra de importação.)
- Progresso do jogador fica no `localStorage` (moedas não são confiáveis contra trapaça ainda).

## Comandos
- `npm run dev` — servidor local (porta 3000).
- `npm run build` — sempre rodar antes de enviar.
- `npm run gerar:susdoku` — regenera `lib/susdoku/fases.json` (casos fixos, com semente).
- Na máquina do usuário, conexões Node → Supabase falham com erro de certificado; para testar
  o online localmente, rodar o dev com `node --use-system-ca node_modules/next/dist/bin/next dev`.
- Testar 2 jogadores locais: `localhost:3000` e `127.0.0.1:3000` (localStorage separados;
  `allowedDevOrigins` já permite 127.0.0.1).

## Branches e publicação
- `main` = site público. `teste-susdoku` = link de teste (preview da Vercel, protegido por login Vercel):
  `https://jogaco-mxp3-git-teste-susdoku-erickssh.vercel.app/susdoku`
- Fluxo combinado: mudanças vão para a branch de teste; só junta na `main` quando o usuário aprovar.
- Commits terminam com: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- Git no Windows: `C:\Program Files\Git\cmd\git.exe` (pode não estar no PATH). Login do GitHub já salvo.

## Variáveis de ambiente (`.env.local`, fora do Git; também cadastradas na Vercel)
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable), `SUPABASE_SERVICE_ROLE_KEY` (secret).
Pendente: o usuário precisa **trocar a chave secreta** (ela foi colada num chat) e atualizar `.env.local` e a Vercel.

## Jogos
- Serpente Neon, Memória Mágica, Esquiva Espacial — `components/games/`.
- Xadrez (`/xadrez`): contra IA, 2 jogadores, online via `app/api/xadrez/route.ts` (servidor valida lances).
- Arena das Lendas (`/lendas`): 12 lendas do folclore (conteúdo 100% original — NÃO usar nada de Pokémon).
  Modos Tática e Ação (movimento/mira), exploração com mapa e captura com amuletos (`/lendas/explorar`),
  salas online Tática (`/lendas/sala/[codigo]`) e duelo Ação (`/lendas/duelo/[codigo]`; anfitrião simula).
  Lógica pura em `lib/lendas/` (engine.ts, acao.ts, mapa.ts, online.ts). Balanceamento foi feito com simulações.
- **Susdoku** (`/susdoku`) — em desenvolvimento, só na branch `teste-susdoku`. Ver abaixo.

## Susdoku (sudoku de detetive) — estado atual
Regras: planta n×n dividida em cômodos; uma pessoa por linha e por coluna; o culpado é a única pessoa
sozinha no cômodo do ocorrido. "Perto de um objeto" = na mesma casa do objeto. Pessoas só por nome.
Nome "Susdoku" (suspect + sudoku) — NÃO usar "Murdoku" nem copiar casos do livro (direito autoral).
- `lib/susdoku/dados.ts` — nomes, lugares (escola, casa), cômodos, objetos, cenários (leves, médios, crimes).
- `lib/susdoku/motor.ts` — contagem de soluções, resolvedor lógico humano (técnicas com pesos = dificuldade),
  gerador de casos (solução única, resolvível só por lógica, sem pista que entregue o culpado), dica, textos.
- `lib/susdoku/progresso.ts` — estrelas, modo, Caso do Dia (5×5 gerado pela data; `/susdoku/diario-AAAA-MM-DD`).
- `components/susdoku/arte/` — visual caricato em SVG: `Planta.tsx` (pisos, paredes com portas, cômodo alvo),
  `Moveis.tsx` (27 objetos em perspectiva 3/4), `Rosto.tsx` (personagens montados por partes, 4 expressões).
- Capítulo 1 Escola: 10 casos 4×4 com tutorial. Modos Normal (avisa erro na hora, 3 vidas) e Difícil
  (só confere quando pede; diz quantas pessoas estão erradas). Acusar a qualquer momento (erro = perde vida;
  acerto antecipado = selo Detetive Brilhante). Estrelas: resolver / sem perder vida / sem dica.

### Próximos passos combinados
1. Usuário testando o link de teste; corrigir o que ele encontrar.
2. Capítulo 2 Casa (5×5) com **móveis grandes que ocupam 2 casas** como mecânica nova ("perto" vale para qualquer uma).
3. Completar 15 casos por capítulo e criar Restaurante (6×6), Hospital (7×7), Prédio comercial (8×8).
   Para grades ≥6 o contador de soluções por força bruta fica lento: trocar por busca com poda.
4. Ranking do Caso do Dia (precisa salvar tempos no Supabase).
5. No celular as pistas ficam abaixo da planta (rolagem) — avaliar layout melhor.
6. Recompensas/moedas do Susdoku: o usuário quer decidir depois.

## Ideias e decisões gerais do usuário
- Querem distribuidoras de jogos (GameDistribution/GamePix) no futuro; precisa domínio próprio e páginas legais.
- Vercel Hobby não permite uso comercial: ao colocar anúncios, migrar (Cloudflare Pages) ou assinar Pro.
- Antes de publicar no Google: sitemap, robots, Política de Privacidade, Termos, aviso de cookies, domínio próprio.
