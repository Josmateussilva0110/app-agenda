# Minha Agenda — Descrição do Projeto

## Visão geral

O **Minha Agenda** é um app **local-first**: os dados principais ficam no próprio celular. Não existe servidor/backend próprio (API REST, Node, Firebase etc.). O app funciona offline para criar, editar e concluir tarefas; a sincronização com o Google é opcional e feita diretamente do dispositivo para a API do Google.

| Camada | Tecnologia | Função |
|--------|------------|--------|
| **Frontend** | Expo SDK 54 + React Native + TypeScript | Interface, navegação e lógica de negócio |
| **Banco de dados** | SQLite (SQLCipher) no dispositivo | Persistência de tarefas e configurações |
| **Integração externa** | Google Calendar API + Google Sign-In | Sincronizar eventos com a conta Google |
| **Notificações** | expo-notifications (sistema Android) | Lembretes no horário da tarefa |
| **Exportação de imagem** | react-native-view-shot + expo-sharing | Gerar e compartilhar o mural da rotina semanal como PNG |

---

## Funcionalidades principais

- Calendário mensal com dias marcados que possuem tarefas
- Tarefas organizadas por período do dia (manhã, tarde, noite)
- Criação de tarefas com horário e lembrete local
- **Mural de rotina semanal**: cadastro de tarefas recorrentes (título, horário, dias da semana) exibidas em uma matriz dia × horário
- **Compartilhar mural**: exporta a matriz de rotina como imagem (PNG) e abre o menu de compartilhamento nativo do celular
- Tema claro/escuro, com sincronização da cor da barra de navegação do Android
- Navegação por abas (Agenda / Mural)
- Conexão com Google Agenda (OAuth)
- Sincronização manual ou automática ao salvar tarefa (quando notificação + Google estão ativos)
- Lembretes configuráveis no Google Calendar (ex.: 10 min antes)
- Banco local criptografado (SQLCipher) com chave no SecureStore

---

## Arquitetura

```mermaid
flowchart TB
    subgraph Frontend["Frontend (App React Native)"]
        UI["Telas e componentes\n(features/agenda, features/recurring)"]
        Hooks["Hooks\n(use-tasks, use-recurring-tasks, use-google-calendar)"]
        Services["Serviços\n(notifications, google-calendar)"]
        Repo["Repositórios\n(tasks, recurring-tasks, settings)"]
        Export["Exportação\n(view-shot + expo-sharing)"]
    end

    subgraph Local["Dados locais (dispositivo)"]
        SQLite[("SQLite criptografado\nagenda.db")]
        SecureStore["SecureStore\n(tokens OAuth + chave DB)"]
        OSNotif["Sistema Android\n(notificações agendadas)"]
    end

    subgraph External["Serviços externos (nuvem)"]
        GoogleOAuth["Google Sign-In"]
        GoogleCalAPI["Google Calendar API"]
    end

    UI --> Hooks
    Hooks --> Services
    Hooks --> Repo
    UI --> Export
    Services --> Repo
    Repo --> SQLite
    Services --> SecureStore
    Services --> OSNotif
    Services --> GoogleOAuth
    Services --> GoogleCalAPI
    GoogleOAuth --> GoogleCalAPI
```

> **Nota:** não há backend intermediário. O app conversa diretamente com o banco local e, quando conectado, com a API pública do Google Calendar.

---

## Estrutura de pastas

```
src/
  app/
    (tabs)/                # Abas do app (Agenda, Mural) via Expo Router
  features/
    agenda/                # UI: calendário, tarefas, modais, painel Google
    recurring/             # UI: mural de rotina semanal
      components/          # Matriz de rotina, modal de criação/edição, view de exportação
      screens/              # RecurringScreen (mural)
      utils/                # build-recurring-matrix (monta a matriz dia x horário)
  hooks/                  # use-tasks, use-recurring-tasks, use-google-calendar, use-selected-date
  database/
    client.ts             # Abertura do SQLite + SQLCipher
    schema.ts             # Migrações e tabelas
    repositories/         # CRUD de tarefas, tarefas recorrentes e settings
  services/
    notifications/        # Agendamento de lembretes locais
    google-calendar/      # OAuth, sync, API do Calendar
  storage/                # Cache em memória das preferências
  context/                # Tema (claro/escuro) + cor da barra de navegação
  constants/              # Cores, validação, opções do Google
  types/                  # Tipos TypeScript (Task, RecurringTask, etc.)
  utils/                  # Datas, horários, concorrência
```

---

## Fluxo geral do aplicativo

```mermaid
sequenceDiagram
    participant User as Usuário
    participant App as App (Frontend)
    participant DB as SQLite (local)
    participant Notif as Notificações (OS)
    participant Google as Google Calendar API

    User->>App: Abre o app
    App->>DB: Inicializa banco criptografado
    App->>DB: Carrega preferências e tarefas do dia
    App->>User: Exibe agenda

    User->>App: Cria tarefa com lembrete
    App->>DB: Salva tarefa
    App->>Notif: Agenda notificação local
    App->>User: Atualiza lista na tela

    opt Google conectado + sync ativo
        App->>Google: Cria/atualiza evento (background)
        Google-->>App: Retorna event ID
        App->>DB: Salva google_event_id
    end

    User->>App: Sincronizar agenda (manual)
    App->>Google: Importa eventos da semana
    App->>DB: Cria tarefas novas
    App->>Google: Exporta tarefas alteradas (paralelo)
    App->>User: Mostra resultado do sync
```

---

## Fluxo: Frontend → Banco de dados

Toda operação de tarefa segue o mesmo padrão em camadas:

```mermaid
flowchart LR
    A["Componente UI\n(AgendaScreen, NewTaskModal)"] --> B["Hook\n(use-tasks)"]
    B --> C["Repositório\n(tasks.repository)"]
    C --> D["Database Client\n(getDatabase)"]
    D --> E[("SQLite\nagenda.db")]
```

### Exemplo — criar tarefa

1. Usuário preenche o modal e confirma
2. `AgendaScreen` chama `addTask` do hook `use-tasks`
3. `createTask` no repositório faz `INSERT` parametrizado no SQLite
4. `scheduleTaskNotification` agenda lembrete no sistema operacional
5. `refresh` recarrega a lista do dia a partir do banco
6. Se Google estiver conectado, `syncTaskInBackground` envia o evento sem travar a UI


---

## Fluxo: Conexão com Google Agenda

Não há backend próprio para autenticação. O OAuth é feito **nativamente no celular** via `@react-native-google-signin/google-signin`.

```mermaid
sequenceDiagram
    participant User as Usuário
    participant UI as Frontend
    participant Auth as google-calendar/auth
    participant Secure as SecureStore
    participant GSignIn as Google Sign-In (nativo)
    participant API as Google Calendar API

    User->>UI: Toca em "Conectar Google"
    UI->>Auth: connectGoogleAccount()
    Auth->>GSignIn: signIn() + hasPlayServices()
    GSignIn-->>Auth: accessToken
    Auth->>Secure: Salva token (criptografado)
    Auth-->>UI: Conexão OK

    Note over User,API: Sincronização (manual ou ao salvar tarefa)

    UI->>Auth: getGoogleAccessToken()
    Auth->>Secure: Lê token (valida expiração)
    alt Token expirado
        Auth->>GSignIn: signInSilently() + getTokens()
        Auth->>Secure: Atualiza token
    end
    Auth-->>UI: accessToken válido
    UI->>API: GET/POST/PATCH eventos (HTTPS)
    API-->>UI: Eventos / confirmação
    UI->>UI: Atualiza SQLite (google_event_id, hash de sync)
```

### Escopo OAuth

- Permissão mínima: `https://www.googleapis.com/auth/calendar.events`
- Apenas leitura/escrita de eventos — sem acesso total à conta Google

---

## Fluxo: Notificações locais

Lembretes do app são **independentes** do Google Calendar.

```mermaid
flowchart TD
    A["Tarefa criada/editada\ncom notifyAt"] --> B{"Permissão\nde notificação?"}
    B -->|Não| C["Não agenda"]
    B -->|Sim| D["expo-notifications\nscheduleNotificationAsync"]
    D --> E["Sistema Android\nalarme no horário"]
    E --> F["Usuário recebe\nnotificação do app"]
```

- Canal Android: `task-reminders` (alta prioridade)
- ID da notificação salvo em `tasks.notification_id` para cancelar ao concluir/remover

---

## Fluxo: Mural de rotina semanal

Tarefas recorrentes ficam em uma tabela própria (`recurring_tasks`), separada das tarefas do dia. Cada rotina tem título, horário e uma lista de dias da semana em que se repete.

```mermaid
flowchart LR
    A["RecurringScreen\n(Mural)"] --> B["use-recurring-tasks"]
    B --> C["recurring-tasks.repository"]
    C --> D[("SQLite\nrecurring_tasks")]
    A --> E["build-recurring-matrix"]
    E --> F["RecurringMatrix\n(grade dia x horário)"]
```

- `buildRecurringMatrix` agrupa as rotinas por horário único e por célula `dia-horário`, montando a grade exibida na tela
- Tocar em uma tarefa da matriz abre o modal de edição (`NewRecurringTaskModal`), que também permite excluir a rotina

### Compartilhar o mural como imagem

```mermaid
sequenceDiagram
    participant User as Usuário
    participant Screen as RecurringScreen
    participant ExportView as RecurringMatrixExportView
    participant Shot as react-native-view-shot
    participant Share as expo-sharing

    User->>Screen: Toca no ícone de compartilhar
    Screen->>Shot: captureRef(exportView, "png")
    Shot-->>Screen: URI da imagem temporária
    Screen->>Share: shareAsync(uri)
    Share-->>User: Abre menu nativo de compartilhamento
```

- `RecurringMatrixExportView` é uma versão da matriz renderizada fora da tela (invisível ao usuário) e usada só para gerar a imagem
- Não há upload para nenhum servidor: o compartilhamento usa o menu nativo do sistema (WhatsApp, e-mail, etc.)

---

## Fluxo: Sincronização Google Calendar

```mermaid
flowchart TD
    Start["Sync iniciado"] --> Import["Importar eventos da semana\n(GET com paginação)"]
    Import --> BatchCheck["Verificar IDs já existentes\n(1 query batch no SQLite)"]
    BatchCheck --> CreateLocal["Criar tarefas locais novas"]

    CreateLocal --> ExportFilter["Filtrar tarefas que mudaram\n(hash de sync)"]
    ExportFilter --> Parallel["Exportar em paralelo\n(até 8 requisições)"]
    Parallel --> Done["Atualizar google_event_id\ne google_sync_hash"]

    Done --> End["Retorna: importados,\nexportados, atualizados"]
```

**Import:** Google → SQLite (eventos que ainda não existem localmente)  
**Export:** SQLite → Google (tarefas com notificação + sync Google ativo)  
**Otimização:** só reenvia ao Google se o conteúdo mudou (hash); export paralelo para semanas com muitas tarefas


