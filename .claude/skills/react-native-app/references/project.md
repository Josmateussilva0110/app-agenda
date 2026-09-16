# Minha Agenda — especificidades do projeto

Complemento do `SKILL.md`. Aqui ficam as decisões deste app: o que já existe, o
que foi decidido de propósito diferente do padrão genérico, e as armadilhas que
só aparecem depois de quebrar.

## O app é local-first e não tem backend próprio

Expo SDK 54 + React Native + TypeScript, Android como alvo principal. Os dados
moram em SQLite criptografado no aparelho. **Não existe API do projeto** — a
única rede é a do Google Calendar, opcional, falada direto do dispositivo.

Consequências ao aplicar o `SKILL.md`:

- A seção de rede vale só para `services/google-calendar/`. Funcionalidade nova
  começa no banco, não em endpoint.
- Offline é o caminho normal, não o degradado: criar, editar e concluir tarefa
  nunca depende de conexão.
- A fronteira de confiança muda de lugar. Sem servidor, não há segunda
  validação: o schema Zod do formulário e o `CHECK` da tabela são a validação
  que existe. Isso não afrouxa a regra sobre segredos — o que vai no bundle
  continua legível.

## O mapa real das camadas

```
tela (features/*/screens) → hook (hooks/) → repositório (database/repositories/) → getDatabase() → SQLite
                                         ↘ service (services/notifications, services/google-calendar)
```

- `src/app/(tabs)/index.tsx` → `AgendaScreen`; `src/app/(tabs)/rotina.tsx` →
  `RecurringScreen`. Os arquivos de rota são de três linhas e devem continuar
  assim. A aba se chama **"Mural"** na interface e `rotina` no arquivo.
- Provedores globais em `src/app/_layout.tsx`, nesta ordem:
  `AppErrorBoundary → SafeAreaProvider → DatabaseProvider → ThemeProvider`.
  `DatabaseProvider` segura a árvore com um spinner até o banco abrir e o cache
  de preferências hidratar — por isso qualquer código abaixo dele pode ler
  preferência de forma síncrona.
- Alias `@/` aponta para `src/` (`tsconfig.json`, `strict: true`).

## Repositório é módulo de funções, não interface

Diferente do padrão genérico, aqui **não existe interface de repositório nem
implementação em memória**, e isso é deliberado: a origem dos dados é uma só e
não vai mudar. `tasks.repository.ts`, `recurring-tasks.repository.ts` e
`settings.repository.ts` exportam funções soltas que falam SQL.

Ao mexer: mantenha o formato. Não introduza camada de interface "por
arquitetura" — ela só se paga quando existe uma segunda origem.

O que os repositórios já garantem e deve continuar valendo:

- **SQL sempre parametrizado** (`?`), nunca interpolado.
- `mapRow` é o único lugar que traduz `snake_case` do banco para `camelCase` do
  app. Nenhuma tela lê `row.google_event_id`.
- `title` e `description` passam por `truncateText` com os limites de
  `constants/validation.ts` antes do `INSERT`.

## Banco: migrações append-only e SQLCipher

`src/database/schema.ts` é uma lista de statements executados em ordem a cada
abertura, e `runMigrations` **engole o erro "duplicate column name"**. É o que
faz `ALTER TABLE ... ADD COLUMN` ser idempotente.

Daí duas regras que não podem ser quebradas:

- **Nunca edite ou remova um statement existente.** Aparelho com o banco antigo
  depende da ordem exata. Mudança de schema é sempre uma linha nova no fim da
  lista.
- **Todo `CREATE` usa `IF NOT EXISTS`**, e toda coluna nova entra por `ALTER
  TABLE`, nunca reescrevendo o `CREATE TABLE` original.

A criptografia (`database/encryption.ts`) gera uma chave de 32 bytes na primeira
execução e guarda no SecureStore. `configureDatabaseEncryption` detecta banco em
texto puro de versões antigas e faz `PRAGMA rekey` uma única vez, marcando a
migração. Não mexa nessa ordem: `PRAGMA key` antes de qualquer consulta, e o
`journal_mode = WAL` depois.

`resetDatabaseForDev()` existe e apaga só `tasks` e `sync_metadata`.

## Preferências: cache síncrono em memória

`storage/settings.storage.ts` é um `Map` hidratado uma vez no boot por
`hydrateSettingsCache()`, gravando em `app_settings` (tabela chave/valor).
Leitura é **síncrona** (`settingsStorage.getTheme()`), escrita é `async` e
atualiza cache e banco juntos.

Preferência nova entra pelo objeto `KEYS`, com um par get/set — não espalhe
chaves em texto pelo código, e não leia `app_settings` direto de uma tela.

## Rede: só Google, e aqui ela lança de propósito

`services/google-calendar/calendar-api.ts` é a única camada HTTP. Ela **checa
`response.ok` e lança `GoogleCalendarApiError(status, body)`** — o oposto do
envelope descrito no `SKILL.md`, e funciona porque a tradução para o usuário
acontece num lugar só: `api-errors.ts` (`toGoogleCalendarUserMessage`), que
mapeia 401/403 para "sessão expirada", 429 para "tente em instantes", 5xx para
"indisponível", e descarta mensagem crua que pareça JSON ou HTML.

A fachada `services/google-calendar/index.ts` é o que as telas enxergam pelo
hook `use-google-calendar`. Ela decide o que é falha silenciosa e o que sobe:

- `syncTaskInBackground` nunca interrompe o usuário; loga só em `__DEV__`.
- `deleteLinkedEvent` engole erro de propósito — a exclusão local vale mesmo com
  o Google fora do ar.
- `connect`/`syncForDate` lançam, e o hook transforma em `error` na tela.

Detalhes do sync (`sync.ts`) que já estão resolvidos e é fácil desfazer sem
querer:

- importa a **semana** do dia âncora (`getWeekRange`), com paginação por
  `pageToken`;
- confere os ids existentes em **uma consulta batch**
  (`listExistingGoogleEventIds`), não um `SELECT` por evento;
- só reexporta tarefa cujo conteúdo mudou, comparando `google_sync_hash`
  (`utils/task-sync-hash.ts`);
- exporta em paralelo limitado a 8 (`runConcurrent`), para não estourar cota.

Token OAuth fica no SecureStore com `expiresAt`, e `auth.ts` renova sozinho via
`signInSilently` com 60s de folga. Escopo mínimo: `calendar.events`.

## Domínio: agenda e mural são separados

- **Agenda** (`tasks`): tarefa pertence a um dia (`date`, chave `YYYY-MM-DD`) e a
  um período — `manha` / `tarde` / `noite`, com faixas de hora em
  `utils/task-time.ts` (`PERIOD_HOUR_RANGE`). O período é derivado da hora
  (`periodFromHour`) e o formulário impede horário fora do período escolhido.
- **Mural** (`recurring_tasks`): rotina com `time` e `weekdays` (array de 0–6
  serializado em texto). `buildRecurringMatrix` monta a grade dia × horário.

**As duas não se encontram.** Uma rotina do mural não vira tarefa na agenda: ela
só agenda as próprias notificações semanais. Já existiu um
`ensureRecurringTasksForDate` que materializava rotinas como tarefas do dia, e
ele foi removido no commit `05a9dd7`. Sobraram a coluna `tasks.recurring_task_id`
e o índice dela no schema, sem ninguém escrever ou ler.

Se o pedido for "a atividade do mural devia aparecer na agenda", isso é
funcionalidade nova, e há duas saídas: materializar (restaurar o padrão do
commit `eec6ef2`, que cria linhas em `tasks` com `recurring_task_id` para não
duplicar) ou mesclar só na exibição, sem gravar. Decida com o usuário — as duas
têm consequência diferente em concluir tarefa e sincronizar com o Google.

## Notificações

`services/notifications/notifications-core.ts` importa `expo-notifications`
**dinamicamente** e devolve `null` na web ou se o módulo não existir. Todo
serviço de notificação começa por ele e sai quieto quando vier `null` — não
importe `expo-notifications` direto numa tela.

Dois canais Android distintos: `task-reminders` (tarefas) e `routine-reminders`
(mural). Os ids agendados voltam para o banco — `tasks.notification_id` e
`recurring_tasks.notification_ids` — porque sem eles não há como cancelar ao
concluir, editar ou excluir. Toda edição cancela antes de reagendar.

Lembrete com horário já passado não é agendado; isso é esperado, não bug.

## Tema

`constants/theme.ts` exporta `Colors.light` / `Colors.dark` com tokens
semânticos já nomeados por uso (`fabBackground`, `calendarSelected`,
`periodBadgeBg`, `emptyBorder`…). Componente lê por `useTheme()`; nada de hex
literal fora desse arquivo.

O tema é **escolha explícita do usuário**, persistida em `settings.theme` e lida
de forma síncrona no primeiro render — por isso não há piscada. `useColorScheme()`
do sistema não é consultado; não o adicione sem combinar, porque hoje ele
contrariaria a escolha manual.

O `ThemeProvider` também acerta a `StatusBar` e, no Android, a cor da barra de
navegação (`expo-navigation-bar` + o plugin `plugins/with-navigation-bar-contrast`).
Cor de barra nova passa por lá, não por tela.

Fontes: Plus Jakarta Sans, via `constants/font-family.ts`. Sombra de FAB em
`constants/elevation.ts` (`Platform.select`, porque `elevation` é só Android).

## Formulários

`react-hook-form` + `zod` via `@hookform/resolvers`. O schema mora em
`features/<domínio>/schemas/` e é a fonte da validação — mensagem de erro em
português, dentro do schema.

No mural, **um modal só serve criação, edição e exclusão**
(`NewRecurringTaskModal`, que recebe a rotina existente e um `onDelete`). Na
agenda, `NewTaskModal` hoje só cria: o hook `use-tasks` expõe `editTask`, mas
nenhuma tela chama. Se a edição de tarefa entrar, o caminho é estender esse
modal — não criar um segundo com os mesmos campos.

## Compartilhar o mural

`RecurringMatrixExportView` é uma segunda renderização da matriz, montada fora
da área visível só para virar imagem: `captureRef` (react-native-view-shot) gera
o PNG e `expo-sharing` abre o menu nativo. Nada sobe para servidor nenhum.

Ao mexer na matriz, lembre que existem **duas** versões para manter coerentes —
a da tela e a de exportação.

## Configuração e build

`app.config.js` estende `app.json`, lê a versão de `package.json` e o
`versionCode` de `version.build.json` (mexido pelos scripts em `scripts/`).

Os Client IDs do Google vêm de `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` e
`EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`, com fallback para `expoConfig.extra`,
resolvidos num lugar só: `services/google-calendar/config.ts`. Sem client id,
`isGoogleCalendarConfigured()` devolve `false` e a interface esconde a
integração em vez de quebrar — preserve esse caminho.

Client ID **não é segredo** (identifica o app, não autentica), mas continua
valendo: nenhum client secret entra aqui, e OAuth é nativo, sem servidor.

Comandos:

```bash
npx expo start
```

```bash
npm run lint
```

```bash
npx tsc --noEmit
```

APK via Docker: `./build-apk.sh`.

## Testes

**O projeto não tem infraestrutura de teste hoje** — não há `jest`, nem
`@testing-library/react-native`, nem pasta de testes, e `npm test` não existe.
Não escreva arquivo de teste importando essas bibliotecas como se estivessem
configuradas.

Enquanto for assim, a verificação antes de encerrar é `npx tsc --noEmit` mais
`npm run lint`, e o teste real é rodar o app. Se for o caso de introduzir
testes, isso é uma tarefa própria (dependências, preset do Expo, mock do
`expo-sqlite`) e precisa ser combinada antes.

## Pontos em aberto

Conhecidos, não resolvidos. Não são bug do dia, mas apareça para eles se a
tarefa passar por perto:

- `calendarRequest` usa `fetch` **sem timeout**: numa rede móvel ruim a
  sincronização fica pendurada.
- `tasks.recurring_task_id` e seu índice continuam no schema sem uso desde
  `05a9dd7`.
- `formatDateKey` está duplicado em `utils/date.ts` e em `tasks.repository.ts`
  (`use-selected-date` importa a do repositório).
- `settingsStorage.getSelectedDate/setSelectedDate` existem mas ninguém chama —
  a data escolhida vive só em memória e volta para hoje a cada abertura.
- `resetDatabaseForDev` não limpa `recurring_tasks` nem `app_settings`.
- `useTasks.editTask` está implementado (cancela e reagenda a notificação,
  ressincroniza com o Google) e nunca é chamado — falta a interface de edição de
  tarefa na agenda.
