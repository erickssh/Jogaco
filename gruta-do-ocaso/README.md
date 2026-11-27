# Gruta do Ocaso

A Gruta aparece no catálogo do Jogaço em `/gruta-do-ocaso`. O treino contra bots roda no navegador. Nas salas online, 4 a 12 jogadores compartilham um código e o anfitrião inicia a partida.

## Rodar localmente

Na raiz do repositório, inicie o servidor de salas com Node.js 22.13 ou mais recente.

```sh
node gruta-do-ocaso/server/ocaso/run.mjs
```

O jogo independente abre em `http://127.0.0.1:4286`. Para jogar pelo catálogo, adicione `OCASO_ROOMS_ORIGIN=http://127.0.0.1:4286` ao `.env.local` do Jogaço e execute `npm run dev` em outro terminal.

## Hospedar as salas

Suba o servidor Node em uma instância contínua com HTTPS. O processo usa `PORT` e deve escutar em `OCASO_HOST=0.0.0.0` no ambiente de hospedagem. A rota `/healthz` informa a versão disponível. Se o provedor usar Docker, execute o build na raiz do repositório.

```sh
docker build -f gruta-do-ocaso/Dockerfile -t gruta-do-ocaso .
```

No ambiente da Vercel, defina `OCASO_ROOMS_ORIGIN` como a origem HTTPS do servidor de salas, sem caminho nem barra final. O catálogo abre o jogo nesse endereço, e as atualizações da partida vão diretamente para o servidor Node. Enquanto a variável estiver ausente, o catálogo abre a versão de treino hospedada no Jogaço.

As salas ficam na memória do servidor e são encerradas quando ele reinicia. Mantenha uma única instância para que todos os jogadores encontrem as mesmas salas.
