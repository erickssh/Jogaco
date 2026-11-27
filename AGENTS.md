<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Overdrive: idiomas

Toda nova funcionalidade e todo texto visível ao jogador devem oferecer suporte, desde a implementação inicial, a português brasileiro, inglês, espanhol, francês e alemão. Use o catálogo compartilhado `public/volta-rapida/i18n.js` e declare as novas chaves em `i18n.d.ts`. Mantenha as traduções centralizadas e reutilizáveis, incluindo mensagens dinâmicas, acessibilidade, corrida e multiplayer. A escolha de idioma é individual, deve ser persistida e aplicada imediatamente. Verifique textos longos no modo incorporado e em tela cheia.
