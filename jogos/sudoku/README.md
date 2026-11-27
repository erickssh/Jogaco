# Sudoku incorporável

Somente a área do jogo, com tabuleiro, controles e um mini tutorial. Sem cabeçalho, navegação, slogans ou rodapé de site. HTML, CSS e JavaScript puro, sem dependências externas e sem login.

## Jogar

Abra `dist/index.html` no navegador. Não precisa instalar nada. Para um endereço local estável e salvamento consistente, com Node.js instalado:

```sh
node server.js
```

Acesse http://127.0.0.1:4173. O progresso pessoal fica no armazenamento local do navegador. O servidor usa Node.js 24 e SQLite para o ranking compartilhado.

A prévia da conclusão está em http://127.0.0.1:4173/previa-conclusao.html.

## Recursos

- Tabuleiros aleatórios com solução única, verificada por busca.
- Mini 6 × 6, Clássico 9 × 9 e Gigante 16 × 16 com quatro níveis. O Fácil se resolve com casas de candidato único. O Médio também usa a única casa onde um símbolo cabe em uma linha, coluna ou bloco. O Difícil usa candidatos restritos ou pares. No Experiente, o resolvedor procura X-Wing, XY-Wing e cadeias XY antes de eliminar candidatos por contradição.
- A classificação do Experiente usa a rota lógica mais fácil entre as que o resolvedor completa em duas ordens de busca. Os limites combinam o custo total, a técnica mais difícil e os pontos com pouco espaço para avançar. Os limites são próprios de cada tamanho. Rotações e reflexões que preservam os blocos, além de renomear símbolos, mantêm a nota. As novas vitórias livres salvam localmente as dicas usadas, além do tempo ativo e da indicação de vitória sem erros. No Experiente também salvam a nota do tabuleiro e a versão da classificação.
- No Clássico Experiente, cada partida nova tem 62 a 64 casas vazias, com preferência por 63 e 64. O gerador sorteia e rearranja grades criadas previamente pela troca de pistas e verifica a dificuldade e a solução única antes de exibi-las. A busca pelas grades de baixa densidade usou o catálogo de pesquisa de Gordon Royle e da Universidade da Austrália Ocidental como ponto de partida, sob [CC BY 2.5](https://creativecommons.org/licenses/by/2.5/). [Crédito do catálogo](https://github.com/grkuntzmd/go-sudoku#readme)
- Com mouse ou toque, selecione um símbolo embaixo e depois a casa. No teclado, use as setas e digite de 1 a 6 no Mini, de 1 a 9 no Clássico, ou de 1 a 9 e de A a G no Gigante. Pressione Esc ou selecione o mesmo símbolo de novo para cancelar a escolha feita embaixo.
- Anotações (N) e apagar (Delete ou Backspace).
- Anotações manuais rejeitam símbolos já presentes na linha, coluna ou bloco e mostram o motivo. Uma anotação existente pode sempre ser removida.
- Lápis rápido: recalcula e substitui as anotações de todas as casas vazias, considerando os números já preenchidos na linha, coluna e bloco 3 × 3. Não consulta a solução nem altera os números preenchidos. Pode ser usado novamente a qualquer momento da partida.
- Três dicas por partida.
- Destaque de linha, coluna e bloco da casa selecionada, além dos valores e anotações que correspondem ao número escolhido.
- Verificação de erros sem limite de tentativas e contagem de números corretamente posicionados no teclado.
- Cronômetro, pausa com tabuleiro escondido e tela de vitória.
- Ao abrir o jogo, aparece brevemente um logo animado antes da entrada suave do tabuleiro. A introdução respeita a preferência por movimento reduzido.
- Melhor tempo e vitórias sem erros por dificuldade. Os dados são registrados neste navegador quando a partida termina.
- Ranking dos 10 menores tempos publicados em cada dificuldade. Na vitória, o jogador pode publicar o tempo com um apelido.
- Desafio do Dia com tabuleiro clássico médio compartilhado, virada à meia-noite de Brasília, progresso separado e ranking por data. O botão vira **Ranking do dia** quando você já está no desafio de hoje. É possível jogar o desafio offline no arquivo local.
- **Desafiar um amigo** usa um link com as pistas do tabuleiro e o tempo a bater. A partida via link fica separada da partida livre e do ranking. Para funcionar em computadores diferentes, use o link gerado na versão hospedada.
- Salvamento automático. O relógio para quando a aba está oculta ou há uma janela de novo jogo aberta.

## Integrar ao site de jogos

Para disponibilizar o ranking, execute `node server.js` em um servidor Node.js e encaminhe a página e a rota `api/ranking` para a mesma instância. Por exemplo, um proxy que recebe `/jogos/sudoku/api/ranking` deve encaminhar como `/api/ranking`. Configure `SUDOKU_DATA_DIR` para uma pasta persistente e faça backup de `ranking.sqlite`. É possível definir `SUDOKU_HOST` e `SUDOKU_PORT` para a hospedagem. O padrão local é `127.0.0.1:4173`.

O servidor inicia a contagem do ranking ao entregar um novo tabuleiro e registra o tempo ao receber o tabuleiro resolvido, antes da escolha do apelido. O tempo inclui pausas até a vitória. Partidas antigas ou iniciadas sem o servidor ficam disponíveis nas estatísticas pessoais. O ranking é casual e dispensa conta. Ele valida o tempo no servidor e o tabuleiro resolvido, sem distinguir jogadas manuais de solucionadores automáticos.

Copie o conteúdo completo de `dist/` para uma pasta como `/jogos/sudoku/` da hospedagem. Os caminhos dos arquivos são relativos, então o jogo também funciona em subpastas. Ele pode ser incorporado assim:

```html
<iframe id="sudoku" src="/jogos/sudoku/" title="Sudoku"
  style="display:block;width:100%;max-width:640px;height:740px;border:0;margin:auto"></iframe>
<script>
  const sudokuFrame = document.getElementById('sudoku');
  const sudokuOrigin = new URL(sudokuFrame.src).origin;
  window.addEventListener('message', (event) => {
    if (event.source !== sudokuFrame.contentWindow || event.origin !== sudokuOrigin) return;
    if (event.data?.type !== 'sudoku:resize') return;
    const height = event.data.height;
    if (Number.isFinite(height) && height >= 200 && height <= 1500) {
      sudokuFrame.style.height = `${height}px`;
    }
  });
</script>
```

O módulo ocupa no máximo 432 pixels nos modos Clássico e Mini e até 640 no Gigante. Para aproveitar a largura do Gigante, configure o iframe com `max-width:640px`. Em áreas estreitas, o tabuleiro gigante permite rolagem horizontal e os controles ficam acessíveis embaixo. O exemplo ajusta automaticamente a altura do iframe.

Cada origem do navegador mantém as próprias partidas salvas. O jogo funciona sem contas, rastreamento ou recursos carregados de CDNs. O ranking compartilhado usa o servidor Node.js. O endereço hospedado será a base dos links de desafio.

## Estrutura e validação

- `dist/index.html`: interface e janelas.
- `dist/styles.css`: layout e adaptação para celular.
- `dist/engine.js`: geração e verificação de solução única.
- `dist/app.js`: interação, anotações, lápis rápido, cronômetro e salvamento.
- `dist/embed.js`: comunicação de altura com o iframe do portal.
- `server.js`: servidor local opcional.

```sh
node --test tests/*.test.js
node --check dist/app.js
node --check dist/engine.js
```

Os testes verificam tabuleiros dos três tamanhos, níveis, soluções únicas, compartilhamento, virada diária e rankings. Não há etapa de build.
