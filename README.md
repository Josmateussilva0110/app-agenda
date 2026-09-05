# Minha Agenda

App mobile de agenda diária com calendário, tarefas por período (manhã, tarde, noite), mural de rotina semanal recorrente e notificações locais.

## Stack

- **Expo SDK 54** + React Native
- **expo-sqlite** — tarefas, rotinas recorrentes e preferências
- **expo-notifications** — lembretes de tarefas (APK / development build)
- **react-native-view-shot + expo-sharing** — exportar e compartilhar o mural de rotina como imagem

## Desenvolvimento

```bash
npm install
npx expo start
```

## Build APK (Docker)

```bash
./build-apk.sh
./build-apk.sh --clean-prebuild   # regera projeto Android nativo
./build-apk.sh --rebuild-image    # reconstrói imagem Docker
```

O APK será gerado em `./build/app.apk`.

## Google Agenda (MVP)

1. Copie `.env.example` para `.env` e preencha os Client IDs do Google Cloud.
2. No Google Cloud Console:
   - Habilite **Google Calendar API**
   - Configure a tela de consentimento OAuth (tipo **Externo**)
   - Adicione seu e-mail em **Usuários de teste**
   - Crie credencial OAuth **Aplicativo da Web** → `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
   - Crie credencial OAuth **Android** (`com.mateus0110.minhaagenda` + SHA-1) → `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`
3. Reinicie o Expo após alterar o `.env`.
4. No app: **Conectar Google** → **Sincronizar agenda** (manual).

O login usa **Google Sign-In nativo** (sem redirect `localhost`).

Após mudanças nativas (SQLCipher, permissões, backup), gere um novo APK:

```bash
./build-apk.sh --clean-prebuild
```

O banco local (`agenda.db`) passa a ser criptografado com chave no SecureStore. Na primeira abertura após a atualização, bancos antigos são migrados automaticamente com `PRAGMA rekey`.

## Estrutura

```
src/
  app/                 # rotas (Expo Router), abas Agenda / Mural
  database/            # SQLite (tarefas, rotinas recorrentes e settings)
  storage/             # cache em memória das preferências
  services/
    google-calendar/   # OAuth + sync com Google Agenda
    notifications/     # agendamento de lembretes
  features/
    agenda/            # UI da agenda diária
    recurring/         # UI do mural de rotina semanal + exportação como imagem
```
