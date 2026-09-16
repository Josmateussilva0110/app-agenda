---
name: react-native-app
description: Padrões do app React Native — camadas tela/estado/repositório/service, estado em hooks e context com regra de negócio fora da tela, repositório atrás de interface para trocar mock por API ou banco local, camada de rede que devolve envelope em vez de lançar, mapeamento de JSON num único lugar e componentes compartilhados com tokens de tema. Use sempre que a tarefa tocar qualquer arquivo em src/ ou nos testes do app, mesmo que o pedido não cite React Native — criar ou alterar tela, formulário, componente, hook, estado, repositório, chamada de API, modelo, navegação, tema ou teste. Vale também para pedidos que chegam pelo lado visual ("a tela tal está estranha", "adiciona um campo no formulário") e para os que chegam pelo backend e precisam aparecer no app.
---

# App React Native — camadas, estado e rede

O app é organizado para que a interface possa ser construída e testada sem
depender do backend, e para que trocar a origem dos dados — API, banco local,
mock em memória — não encoste em nenhuma tela.

Se existir `references/project.md` ao lado deste arquivo, leia também: é onde
ficam as escolhas específicas do projeto (rotas, sessão, biblioteca de estado,
o que já está ligado na API e o que ainda é mock).

## Camadas

```
tela (features/) → estado (hooks/, context/) → repositório (database/, data/) → service (services/) → cliente HTTP
```

```
src/
├── app/         arquivos de rota (expo-router) ou navigators — finos, só apontam
├── constants/   tema, espaçamento, validação, chaves de configuração
├── context/     providers globais (tema, sessão, banco)
├── database/    cliente local, schema e repositories/
├── services/    uma função por endpoint ou integração externa
├── types/       entidades e tipos de entrada (Create*/Update*)
├── hooks/       estado de domínio consumido pelas telas
├── features/    uma pasta por domínio; screens/ e components/ dentro dela
├── components/  componentes compartilhados entre features
└── utils/       funções puras (data, formatação, hash)
```

A regra que mantém isso honesto: **tela não conhece repositório nem service.**
Ela fala com o hook de estado, e só. Se uma tela precisa importar algo de
`database/` ou `services/`, provavelmente falta um método no hook.

O arquivo de rota é fino de propósito. Ele existe para o roteador encontrar a
tela, não para conter a tela:

```tsx
// app/(tabs)/index.tsx
export default function Index() {
  return <AgendaScreen />;
}
```

Assim a tela de verdade vive em `features/`, pode ser renderizada num teste sem
subir o roteador, e trocar de biblioteca de navegação não reescreve a interface.

## Nomenclatura e comentários

**Identificadores em inglês** — componentes, funções, variáveis, arquivos.
**Comentários em português**, curtos e só quando fazem falta.

O vocabulário em volta já é inglês (`render`, `props`, `state`, `effect`), e
misturar idiomas produz coisas como `construirCardComponent`. Comentário é
conversa entre pessoas do time, e ali o português comunica melhor.

Texto que o usuário lê — rótulos, mensagens, títulos — é português, e mora no
componente, não em constante distante.

Arquivos em `kebab-case` (`task-item.tsx`), componentes em `PascalCase`, hooks
com prefixo `use`. Um arquivo, um componente exportado; os pedaços privados
dele podem ficar no mesmo arquivo enquanto forem pequenos.

Comentário bom explica **por quê**. O código já diz o quê.

## Estado

Estado de domínio mora em **hooks**, um por domínio (`useTasks`,
`useSession`), e as telas consomem só o hook. O hook expõe dados, estados de
carga e erro, e as ações:

```ts
const { tasks, loading, error, addTask, removeTask } = useTasks(date);
```

Regra de negócio mora no hook, não na tela. Cálculo derivado (totais, filtros,
agrupamentos) é `useMemo` sobre o estado — assim duas telas que mostram o mesmo
número não podem discordar, e não existe um segundo `useState` para manter em
sincronia (dois estados que precisam concordar sempre divergem; o segundo é
derivação disfarçada).

Três cuidados que evitam os bugs típicos:

- **Ações expostas por hook vão em `useCallback`.** Sem isso, cada render cria
  uma função nova, o `React.memo` dos filhos não segura nada e qualquer
  `useEffect` que dependa dela dispara de novo — o famoso laço infinito.
- **Context re-renderiza todos os consumidores** quando o valor muda. Separe
  contexts por frequência de mudança: tema e sessão mudam raramente e podem ser
  globais; uma lista que muda a cada toque não deve estar no mesmo provider que
  o tema. O valor do provider vai em `useMemo`, senão ele é um objeto novo a
  cada render e anula o ganho.
- **Quando o app cresce e o re-render vira problema**, um store com seletor
  (Zustand, Redux Toolkit) resolve o que o Context não resolve: o componente
  assina um campo e só reconstrói quando aquele campo muda. Adote quando a dor
  aparecer, não antes.

O que é efêmero e de uma tela só (um modal aberto, o texto de um campo) fica na
tela, em `useState`. Subir isso para um estado global é o que transforma
provider em depósito.

## Repositório atrás de interface

O hook de estado depende de uma **interface** de repositório, nunca de uma
implementação. Em TypeScript isso é um `type` com as funções, e as
implementações são módulos que o satisfazem. Paga em três momentos:

- a interface pode ter uma implementação em memória, e aí a tela inteira é
  construída e navegável antes de o backend existir;
- os testes rodam sem rede e sem banco;
- trocar a origem dos dados — API, SQLite, arquivo — é mudar uma linha na
  injeção, sem tocar em tela.

Persistência local entra aqui como qualquer outra origem: quem lê SQLite ou
`AsyncStorage` é o repositório, e a tela não sabe a diferença entre um dado que
veio do disco e um que veio da rede.

Implementações parciais são legítimas: quando só parte dos endpoints existe, a
implementação de API delega o resto para a de memória, numa seção marcada. É
melhor que travar a interface esperando o backend ficar pronto.

## Rede

**A camada de API nunca lança.** Toda chamada volta num envelope com `success`,
`message` e o dado — inclusive falha de rede. Assim nenhum ponto do app precisa
de `try/catch` para uma chamada dar errado; o código decide olhando o
resultado.

Duas armadilhas do `fetch` que essa camada tem que resolver de uma vez, porque
esquecê-las custa horas:

- **`fetch` não rejeita em 4xx/5xx.** Só falha de rede vira exceção. Quem não
  olha `response.ok` trata um 500 como sucesso e tenta ler o JSON de uma página
  de erro.
- **`fetch` não tem timeout.** Numa rede móvel ruim a promessa fica pendurada e
  a tela gira para sempre. Use `AbortController` com um prazo, sempre.

A conversão acontece na fronteira do repositório: ele expõe valores (`Task[]`,
não envelope), então traduz falha em **erro tipado** do app.

O hook é quem captura esse erro. E aqui está a regra que evita o bug mais chato
dessa arquitetura: **quando a escrita falha, o estado local não muda.** Se a
lista da tela for atualizada antes da confirmação do servidor, o usuário vê
algo que não foi salvo e que some no próximo boot.

```ts
const addTask = useCallback(async (input: CreateTaskInput) => {
  const created = await guard(() => repository.createTask(input));
  if (!created) return;   // falhou: avisou o usuário e não mexeu na lista

  await refresh();
  return created;
}, [refresh]);
```

Atualização otimista é o contrário disso e só vale com **rollback escrito
junto** — se não há o caminho de desfazer, não há otimismo, há bug.

Na carga inicial, falha **não pode** travar a tela de abertura nem parecer
sessão expirada: mostre o motivo e abra o app vazio, para o usuário poder
tentar de novo.

## Modelos e formato de rede

A API costuma usar `snake_case` (espelhando o banco) e o TypeScript usa
`camelCase`. Essa tradução mora em **mappers** — uma função de leitura e uma de
escrita por entidade, ao lado do tipo ou do repositório — **e em nenhum outro
lugar**. Espalhar `json.card_id` pelas telas é o que faz uma renomeação no
backend virar caça ao tesouro.

Três cuidados que economizam depuração:

- **O tipo não é validação.** `as Task` num JSON de rede é uma promessa que
  ninguém verificou; o app quebra longe da origem, ao usar o campo. Se o
  projeto já tem um validador de schema (Zod e semelhantes), valide na
  fronteira — é o mesmo lugar onde os formulários já validam.
- **Campo nulo tem significado.** Decida no mapper o que ele vira e comente. Um
  `card_id` nulo pode ser "cartão removido", não erro.
- **A escrita não manda o `id`** em criação: quem o define é o servidor.

Quando o `POST`/`PUT` responde só com o id, o objeto é remontado localmente a
partir do que foi enviado, em vez de um `GET` para reler o que o app acabou de
mandar.

Datas trafegam como texto ISO e só viram `Date` na borda de exibição. Guardar
`Date` no estado convida fuso horário e serialização a brigarem no meio do
caminho.

## Componentes

**Cores, espaçamentos e raios vêm dos tokens do tema**, nunca literais no
componente. O tema existe para o modo escuro não apodrecer: um `#fff` cravado
fica invisível no escuro e ninguém percebe até alguém reclamar.

**Estilos em `StyleSheet.create`**, fora do corpo do componente. Objeto de
estilo criado no render é novo a cada passada e derruba comparação de props.
Quando o estilo depende do tema, gere-o uma vez por mudança de tema com uma
função `makeStyles(colors)` memoizada, e reserve o array
(`style={[styles.card, { borderColor: colors.border }]}`) para o pedaço que
realmente varia.

**Componentes modularizados.** Um componente resolve uma coisa, recebe o que
precisa por props e não busca dado do estado por conta própria. Componente que
aparece em duas telas vira compartilhado; componente que só serve a uma tela
mora em `features/<domínio>/components/`.

**Formulário é um arquivo só, usado por criar e editar.** O padrão são três
peças: os campos, a tela de criação e a de edição, ambas importando os mesmos
campos e o **mesmo schema de validação**. Duplicar o formulário parece mais
simples no dia, e o resultado é sempre o mesmo: um dos dois ganha uma validação
ou um campo novo e o outro fica para trás, sem ninguém notar até o usuário
reclamar. O arquivo de campos devolve valores já validados; quem decide o que
fazer com eles é cada tela.

Quando um componente cresce, extraia **componentes**, não funções
`renderAlgo()`. Componente extraído tem `React.memo`, chave própria e
reconstrói sozinho; função privada reconstrói junto com o pai e ainda perde o
estado interno se for chamada de forma condicional.

Detalhes de React Native que dão erro em runtime e não em compilação: texto
solto precisa estar dentro de `<Text>`; `<Image>` sem largura e altura não
aparece; toque só acontece dentro da área do componente, então `padding`
resolve alvo pequeno melhor que aumentar a fonte do ícone.

## Tema central e cores

**Um arquivo de tema para o app inteiro**, exposto por um hook
(`useTheme()`), com as paletas clara e escura e a escala de espaçamento. Nunca
uma cor literal dentro de um componente: além de quebrar o tema escuro, espalha
uma decisão visual por dezenas de arquivos, e mudar a identidade do app vira
busca e substituição.

Ao escolher cores, use as relações entre elas em vez de gosto pontual:

- **Uma cor semente gera o esquema.** Primária, superfícies e estados saem dela
  em harmonia; inventar uma cor por tela produz um app que parece remendado.
- **Matiz carrega significado, e isso é convenção cultural.** Verde para
  entrada e confirmação, vermelho para erro e saída, âmbar para atenção.
  Contrariar isso obriga o usuário a ler o que poderia reconhecer.
- **Contraste é requisito, não estética.** Texto precisa de contraste
  suficiente com o fundo nos dois temas — o que fica elegante no claro costuma
  sumir no escuro.
- **Saturação alta em área grande cansa.** Cor forte funciona em acento (botão,
  ícone, badge); fundo pede tom dessaturado.
- **Categorias com cor fixa por rótulo**, derivada de hash, mantêm a mesma
  pessoa ou etiqueta sempre da mesma cor em todas as telas — o usuário passa a
  reconhecer sem ler.

Espaçamento e raio de borda seguem a mesma lógica: constantes no tema, não
números soltos. Uma escala pequena e repetida é o que faz telas diferentes
parecerem o mesmo app.

A preferência do usuário (claro, escuro, sistema) é estado persistido, lido uma
vez na abertura. Espalhar `useColorScheme()` pelos componentes ignora a escolha
manual e faz metade da tela trocar de tema sozinha.

## Fronteira de confiança

**O cliente nunca é fonte de verdade.** Ele roda no aparelho do usuário, o
bundle JavaScript pode ser extraído e lido, e as requisições podem ser forjadas.
Disso decorre:

- **Regra de negócio e validação valem no backend.** A validação no app é
  conveniência — evita ida à rede e dá erro imediato no campo certo. Ela não
  substitui a do servidor; as duas existem, e a que protege é a de lá.
- **Nunca envie identificador de dono.** Quem é o usuário sai do token, no
  servidor. Se o app manda `user_id` no corpo e o backend confia, trocar um
  número na requisição alcança dado alheio.
- **Filtros, ordenação e paginação vêm do backend.** Trazer tudo e filtrar em
  JavaScript parece mais rápido de escrever e quebra na primeira conta com
  muitos registros: gasta rede, memória e bateria para descartar a maior parte.
  O banco tem índice para isso; o app não.
- **Cálculo que vira dinheiro ou permissão é do servidor.** O app pode exibir um
  total, mas quem o confirma é quem grava.

## Segredos e dados sensíveis

**Tudo que é embarcado no app é legível.** Variáveis com prefixo público
(`EXPO_PUBLIC_*`) e valores em `extra` são substituídos no bundle em tempo de
build — ficam em texto no APK. Não existe "esconder" chave no cliente.
Portanto:

- **Nenhuma chave de serviço, credencial de banco ou segredo de integração vai
  para o app.** Se uma operação precisa de segredo, ela é um endpoint no
  backend, não uma chamada direta do cliente.
- **Senha nunca é persistida.** Nem em cache, nem em `AsyncStorage`, nem
  "temporariamente".
- **Token de sessão é a exceção necessária, e tem lugar certo.** Um app que
  mantém o usuário logado precisa guardar o token de renovação em algum lugar; o
  lugar é o **armazenamento criptografado do sistema** (`expo-secure-store`,
  Keychain/Keystore), nunca `AsyncStorage`, que é texto puro no disco do app. O
  token de acesso, curto, pode viver em memória. E o backup automático do
  sistema deve excluir esse armazenamento, senão a credencial vaza junto com o
  backup.
- **Nada sensível em log.** Token, senha e corpo de requisição autenticada fora
  do console — log de app vai para o dispositivo e para ferramentas de crash.
  `console.log` deixado no código roda em produção.
- **Falha de autenticação não conta detalhe.** "Email ou senha incorreto", sem
  dizer qual dos dois; a distinção confirma quais contas existem.

## Desempenho e cache

Meça antes de otimizar, mas estes evitam retrabalho:

- **Lista longa é `FlatList`**, com `keyExtractor` estável e `renderItem`
  memoizado — nunca um `ScrollView` com `map` montando tudo de uma vez. Chave
  por índice reordena errado e reaproveita o item errado na hora de animar.
- **`React.memo` no item da lista**, junto com `useCallback` nos callbacks que
  ele recebe. Um sem o outro não vale nada: a função nova a cada render já
  quebra a comparação.
- **Trabalho pesado fora do render.** Ordenar, agrupar e formatar entram em
  `useMemo`; o render roda a cada toque.
- **Chamadas independentes em paralelo** (`Promise.all`), não em sequência —
  `await` encadeado soma latências que poderiam correr juntas.
- **Animação na UI thread** (Reanimated, `useNativeDriver`). Animar via estado
  do React trava junto com a lista.
- **Imagem custa memória na resolução original.** Redimensione na origem ou peça
  ao backend o tamanho que a tela usa.

Cache vale quando o dado é caro de obter e muda pouco. Quando aplicar:

- **Mostre o que já tem enquanto revalida em segundo plano** — a tela abre na
  hora e se corrige sozinha, em vez de encarar um spinner a cada abertura.
- **Invalide na escrita.** Cache que não é invalidado quando o próprio app
  altera o dado é pior que não ter cache: mostra o valor antigo com confiança.
- **Não guarde dado autenticado de um usuário onde outro possa ler**, e limpe
  tudo no logout — senão o próximo login herda a tela do anterior.

## Efeitos assíncronos e desmontagem

Toda vez que um `await` for seguido de atualização de estado, a tela pode já ter
saído. Cancele:

```ts
useEffect(() => {
  let active = true;

  void (async () => {
    const result = await repository.list();
    if (!active) return;   // a tela saiu durante a espera
    setItems(result);
  })();

  return () => { active = false; };
}, []);
```

O mesmo vale para `setTimeout`, listeners e `AbortController`: o que foi criado
no efeito é desfeito no retorno dele. Sem isso sobra atualização em componente
desmontado e timer que dispara depois — falhas que não aparecem em teste e são
difíceis de reproduzir.

Recarregar ao voltar para a tela usa o efeito de foco da navegação, com a função
de refresh estável (`useCallback`); dependência instável ali vira recarga em
laço, com a rede batendo sem parar.

## Configuração

O bundler **substitui as variáveis no código em tempo de build**, não lê nada em
runtime. Duas consequências práticas: **recarregar o app não relê esses
valores** (é preciso reiniciar o bundler, às vezes limpando o cache), e um valor
ausente vira `undefined` silencioso — a falha aparece depois, como timeout
inexplicável ou URL `undefined/api`.

Por isso: leia configuração num **único módulo**, com valor padrão explícito,
e registre em `__DEV__` qual configuração foi carregada. E lembre que tudo ali é
público (ver segredos, acima).

## Testes

Teste que renderiza **a tela de verdade** com um adaptador de rede falso vale
mais que teste de unidade com tudo simulado: exercita árvore, estado,
repositório e navegação juntos, que é onde os erros realmente moram. Prefira
consultas por texto e rótulo de acessibilidade — o que o usuário vê — a
consultas por estrutura interna.

O adaptador falso responde por rota e registra o que saiu, o que permite
verificar o corpo enviado — é assim que se pega um `snake_case` trocado.

Cubra especialmente:

- os **fluxos** (login, logout, sessão restaurada) ponta a ponta;
- as **costuras** de formato (leitura e escrita do JSON, campo nulo);
- os **caminhos de erro** (credencial errada, 422 com campo, falha de rede), que
  são os que ninguém testa à mão.

Cuidado com timers pendentes: um toast com auto-dismiss ou uma latência simulada
que não terminou fazem o teste falhar por motivo alheio ao que ele verifica.
Avance o relógio com timers falsos e espere o estado assentar antes de encerrar.

## Passo a passo para uma tela nova

1. Tipo da entidade e das entradas (`Create*`/`Update*`), com o mapper de JSON
   se houver dado novo
2. Função do endpoint em `services/` (ou a consulta no repositório local)
3. Método na interface do repositório e nas implementações
4. Hook de estado: dados, `loading`, `error`, ações com tratamento de falha e
   derivados em `useMemo`
5. Tela em `features/<domínio>/screens/`, lendo o hook e usando os componentes
   compartilhados
6. Arquivo de rota fino apontando para a tela
7. Teste do fluxo, e teste do mapeamento se houver JSON novo
8. Checagem de tipos, lint e testes antes de encerrar
