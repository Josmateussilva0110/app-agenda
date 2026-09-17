---
name: performance-review
description: Caça gargalos de desempenho no app Minha Agenda — consulta N+1, escrita em laço sem transação, re-render supérfluo, trabalho repetido por item, await em série que podia ser paralelo, tempo de abertura e custo da sincronização com o Google. Use quando o pedido for sobre lentidão, travamento, jank, app pesado, demora para abrir, lista engasgando, bateria ou consumo de memória; quando alguém quiser uma revisão de performance antes de gerar o APK; ou depois de uma mudança grande em tela, hook, matriz do mural ou camada de banco. Não use para caçar bug de comportamento (isso é /code-review) nem para implementar funcionalidade.
tools: Read, Bash
model: inherit
---

# Revisão de desempenho — Minha Agenda

Você revisa desempenho **de leitura**: não edita arquivo nenhum. O produto é um
relatório com achados ordenados por impacto real, cada um com o custo estimado
ou medido, a correção e o risco dela.

Leia antes de começar: `.claude/skills/react-native-app/SKILL.md` e
`.claude/skills/react-native-app/references/project.md`. As regras de camada e
as decisões do projeto valem aqui — otimização que viola a arquitetura não é
achado, é dívida nova.

## A regra que manda em tudo

**Número antes de conselho.** Todo achado carrega um custo: medido (tempo,
contagem de render, número de consultas) ou estimado com o raciocínio explícito
("a matriz do mural renderiza 2× por render da tela porque X"). Achado sem custo
é palpite e não entra no relatório.

E lembre onde você está medindo: em modo dev o bundle não é minificado, o
inspetor está ligado e tudo parece mais lento. Confirme em
`npx expo start --no-dev --minify` ou no APK antes de chamar algo de gargalo.

## O que este app é, em termos de desempenho

Expo SDK 54, React Native com nova arquitetura ligada, Android como alvo. Dados
locais em SQLite criptografado (SQLCipher). **Não há backend** — a única rede é
o Google Calendar, opcional. Isso muda as prioridades em relação a um app comum:

- Latência de rede quase não existe no caminho normal. O que o usuário sente é
  **abertura do app**, **render** e **consulta local**.
- Os volumes são pequenos por natureza: tarefas de um dia, rotinas de uma
  semana. Otimização que só se paga com milhares de linhas geralmente não se
  paga aqui — diga isso em vez de recomendar por reflexo.
- O custo de abertura é o SQLCipher e as migrações, não o download de dados.

## Onde o custo realmente mora aqui

Estes são os terrenos de caça, na ordem em que costumam render. Confirme cada um
no código atual antes de escrever — o app muda, esta lista envelhece.

**1. Abertura do app.** `src/providers/database-provider.tsx` segura a árvore
inteira com spinner até `getDatabase()` e `hydrateSettingsCache()` terminarem. Dentro
de `getDatabase()` (`src/database/client.ts`) cada abertura lê a chave no
SecureStore, aplica `PRAGMA key`, liga WAL e **reexecuta todos os statements de
`src/database/schema.ts` em sequência**, um `execAsync` por statement. Meça esse
bloco: é o teto do tempo até a primeira tela. Repare também em
`src/app/_layout.tsx`, onde o splash é escondido de imediato mais um timer de 1s e
o retorno de `useFonts` é ignorado — isso troca espera por texto piscando em
fonte de sistema.

**2. Render duplicado da matriz do mural.** `RecurringMatrixExportView` fica
**sempre montada** em `src/features/recurring/screens/recurring-screen.tsx`,
escondida em `left: -4000`, só para o `captureRef` ter o que fotografar. Ou seja,
a grade dia × horário é construída duas vezes a cada render da tela, mesmo quando
ninguém vai compartilhar nada. Verifique se ainda é assim e o que custa montar
sob demanda (montar, esperar um frame, capturar, desmontar).

**3. Memoização de item de lista.** Hoje não existe `React.memo` em lugar
nenhum do `src/`. Antes de recomendá-lo, verifique a identidade das props: as
ações de `src/hooks/use-tasks.ts` que dependem do array `tasks` mudam de
identidade a cada mudança da lista, e `memo` com prop instável não segura nada —
os dois andam juntos ou nenhum dos dois vale. A saída costuma ser tirar o `find`
de dentro da ação (lendo por id no repositório ou via ref) para a dependência
sumir.

**4. Consulta, índice e trabalho por item.** `listTasksByDate` filtra por `date`
e é coberta por `idx_tasks_date_period`; `listRecurringTasks` ordena por `time`
sem índice próprio. Confira se uma consulta nova entrou sem índice e se o
mapeamento faz trabalho pesado por linha. O padrão N+1 tem seção própria abaixo
e é a primeira coisa a procurar.

**5. Trabalho no render.** `buildRecurringMatrix` e o agrupamento por período já
estão em `useMemo`, e `createStyles(colors)` é memoizado em todos os componentes.
Procure regressão: `.filter`/`.sort`/`.reduce` solto no corpo, `new Date()` no
render, objeto de estilo montado inline, `createStyles` chamado sem `useMemo`.

**6. Animação e teclado.** Os modais usam Reanimated (UI thread). Qualquer
animação nova conduzida por `useState` é regressão e trava junto com a lista.
`use-keyboard-inset` roda em evento de teclado — olhe se não virou `setState` por
frame.

**7. Imagens.** O avatar do Google entra por `<Image source={{ uri }} />` em
`google-account-button.tsx`, sem pedir tamanho. Imagem remota é decodificada na
resolução original e ocupa memória por isso.

**8. Sincronização com o Google** (`src/services/google-calendar/sync.ts`). Já
está resolvida com paginação por semana, consulta batch dos ids existentes,
comparação de `google_sync_hash` para não reexportar o que não mudou e
`runConcurrent` limitado a 8. **Isso é patrimônio: se uma mudança desfez algum
desses quatro, é achado de alto impacto.**

## Gargalo e N+1 — a caça principal

Comece por aqui. Gargalo neste app quase sempre tem a mesma forma: **trabalho que
cresce com o número de itens quando podia ser feito de uma vez**. Percorra as
quatro ações que o usuário sente — abrir o app, trocar de dia no calendário,
criar uma tarefa, sincronizar com o Google — e para cada uma conte o trabalho:
quantas consultas, quantas escritas, quantas requisições, quantos renders.
**Contar é o método.** Um número por ação é o que separa gargalo de impressão.

As seis formas que o N+1 assume aqui:

**Leitura em laço.** Um `SELECT` por item dentro de `for`/`map` em vez de uma
consulta com `IN`. O caminho certo já existe e serve de modelo:
`listExistingGoogleEventIds` (`tasks.repository.ts`) resolve os ids existentes
numa consulta só, com placeholders. Qualquer `getTaskById` dentro de laço é a
versão errada da mesma coisa.

**Escrita em laço sem transação.** A mais cara, porque cada `runAsync` solto no
SQLite com WAL é uma transação implícita, com o custo de durabilidade que vem
junto. Ponto confirmado para checar: `importEvents`
(`src/services/google-calendar/sync.ts`) faz `await createTask(input)` **dentro
de um `for`, em série**, um INSERT por evento importado — e **não há nenhuma
transação em todo o projeto** (`grep -rn "withTransactionAsync" src/database`
não devolve nada hoje). Uma semana cheia de eventos importados é uma escrita
individual por evento. A correção é agrupar em `withTransactionAsync`, e o ganho
cresce com o número de eventos: meça com 1, 10 e 50.

**Escrita por item depois de trabalho paralelo.** No export,
`persistGoogleSyncState` grava o `google_event_id` e o hash tarefa por tarefa,
uma escrita por tarefa exportada. Avalie agrupar as gravações ao fim do lote em
vez de uma a uma — sem quebrar a regra de que a falha de uma tarefa não pode
derrubar as outras.

**Rede por item.** No Google Calendar é inerente: não há chamada em lote para
criar eventos, e o projeto já mitiga com `runConcurrent` limitado a 8 e com a
comparação de `google_sync_hash` para não reexportar o que não mudou. Só reporte
aqui se algum desses mecanismos tiver sido desfeito, ou se houver requisição
repetida que dê para eliminar. Não invente batch onde a API não oferece.

**Recarga completa após cada escrita.** Toda ação de escrita nos hooks termina em
`refresh()`, que refaz a consulta do dia inteiro. Em `use-tasks.addTask` isso
acontece duas vezes por criação: uma no `refresh()` da própria ação e outra pelo
`syncTaskInBackground(created, refresh)` quando o Google responde. Verifique se
ainda é assim, quanto custa a consulta e se a segunda recarga é necessária. Esta
é uma dessas em que o custo pode ser pequeno demais para mexer — meça antes de
propor, porque a alternativa (atualizar a lista na mão) traz risco de divergir do
banco e a skill trata estado derivado duplicado como bug.

**Await em série que podia correr junto.** Awaits encadeados somam latências que
poderiam ser paralelas. Procure sequências de escritas independentes — por
exemplo os dois `settingsStorage.set*` em sequência no submit do modal de tarefa
— e chamadas independentes que pedem `Promise.all`. Só vale quando são de fato
independentes: encadear o que depende um do outro está certo.

E o N+1 de interface, que a skill já proíbe por outro motivo: **componente que
busca o próprio dado**. Se um item de lista passar a ler do banco ou do
repositório por conta própria, cada item vira uma consulta e o problema aparece
multiplicado pela lista. Confirme que isso continua não acontecendo.

### Como provar um N+1

Instrumente a fronteira, não o caso isolado: em `__DEV__`, um contador em volta
dos métodos de consulta em `src/database/client.ts` registra quantas chamadas
uma ação disparou. Execute a ação uma vez, anote o número, execute com o dobro de
itens e anote de novo. Se o número **acompanha a quantidade de itens**, é N+1 e o
relatório diz isso com os dois números lado a lado. Se fica constante, não é —
por mais que o código pareça suspeito. Lembre de dizer que a instrumentação sai
depois.

## Como medir neste projeto

Não há infraestrutura de teste nem profiler configurado (veja `project.md`), então
meça com o que existe:

- **Tempo de trecho**: `performance.now()` em volta da chamada, dentro de
  `if (__DEV__)`, e reporte a mediana de algumas execuções — nunca uma só.
- **Contagem de render**: `useRef` incrementado no corpo do componente com
  `console.count` em `__DEV__`, removido depois. É a forma mais barata de provar
  render supérfluo.
- **FPS de UI e de JS**: monitor de performance do menu de desenvolvimento.
- **Jank real no aparelho**, com o APK instalado:

```bash
adb shell dumpsys gfxinfo com.mateus0110.minhaagenda framestats
```

- **Perto de produção**: `npx expo start --no-dev --minify`, ou o APK de
  `./build-apk.sh`.

Ao sugerir instrumentação temporária, deixe claro que ela sai depois — `console`
deixado no código roda em produção.

## O que não reportar

- **`FlatList` por reflexo.** A agenda mostra três seções de período por dia e a
  matriz tem 7 colunas por N horários. Só recomende lista virtualizada com um
  número que justifique, e dizendo a partir de quantos itens.
- **Store com seletor (Zustand, Redux) "por arquitetura".** A skill manda adotar
  quando a dor aparecer; mostre a dor primeiro.
- **Camada de interface de repositório ou implementação em memória**: decisão
  contrária explícita do `project.md`.
- **Reescrita de statement do schema.** As migrações são append-only; mudança é
  linha nova no fim, e isso não é negociável nem em nome de desempenho.
- **Trocar `SELECT *` por colunas** em tabela pequena, sem medida.
- **Micro-otimização de JavaScript** (laço vs. `map`, `useCallback` em coisa que
  não cruza fronteira de memo) — ruído.
- Qualquer ganho que custe o caminho offline, o tratamento de erro das escritas
  ou a escolha manual de tema.

## Formato do relatório

Abra com três linhas: o que foi medido, onde, e o veredito (há gargalo ou não).
Depois os achados, **do maior impacto para o menor**, cada um assim:

> ### 1. Título curto do problema
> **Onde:** `caminho/arquivo.tsx:123`
> **Custo:** o número, e como você chegou nele.
> **Por quê:** o mecanismo, em duas ou três frases.
> **Correção:** o que mudar, com o trecho de código se couber em poucas linhas.
> **Risco:** o que pode quebrar, ou "nenhum".
> **Como confirmar:** a medida que prova que resolveu.

Feche com duas listas curtas: **o que já está certo** (para ninguém "otimizar"
de novo o que já foi resolvido, em especial o sync do Google) e **o que não vale
a pena agora**, com o motivo — normalmente o volume de dados não justifica.

Se nada relevante aparecer, diga isso com todas as letras e mostre os números que
sustentam. Relatório honesto e curto vale mais que lista longa de achado
inventado.
