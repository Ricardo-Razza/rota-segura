# Rota Segura — Gestão Escolar

Painel de gestão escolar que acompanha a **jornada do aluno** no transporte escolar por reconhecimento facial.
Este arquivo é a especificação do projeto. Leia inteiro antes de qualquer tarefa e siga as regras abaixo em todas as sessões.

---

## 1. Domínio

Cada aluno passa por dois leitores faciais por dia:

1. **Embarque** — leitor instalado no ônibus. O aluno é reconhecido e vinculado ao veículo → estado `EMBARCADO`.
2. **Chegada** — leitor instalado na escola. O aluno é reconhecido de novo → estado `NA_ESCOLA` e presença do dia confirmada.

Estados da jornada do dia: `AGUARDANDO`, `EMBARCADO`, `NA_ESCOLA`, `AUSENTE`, `DIVERGENTE`.

Quebras da sequência geram divergências e alertas:

| Divergência | Quando | Severidade |
| --- | --- | --- |
| `EMBARCOU_SEM_CHEGADA` | Embarcou e não passou no leitor da escola após a janela configurada (padrão 40 min) | Crítico |
| `CHEGOU_SEM_EMBARQUE` | Passou no leitor da escola sem embarque registrado | Info |
| `VEICULO_DIFERENTE_DO_CADASTRO` | Embarcou em veículo diferente do esperado (se o cadastro informar) | Atenção |
| `EMBARQUE_DUPLICADO` | Dois embarques no mesmo dia | Atenção |

Foco desta fase: **painel de gestão referente ao aluno**. Motoristas e responsáveis entram só como contexto.

---

## 2. Fonte de dados — API externa (somente GET nesta fase)

A documentação da API tem outras rotas, mas **nesta fase o sistema usa apenas as rotas GET abaixo**.
Nenhuma escrita na API externa. O que o painel precisa gravar (usuários, alertas tratados, auditoria, preferências) fica no banco próprio do backend.

Contrato completo (Swagger/OpenAPI): `<URL_DO_SWAGGER>` — **gere os DTOs a partir dele e não invente campos**. Se faltar um campo necessário, pare e pergunte.

| Recurso | Rotas |
| --- | --- |
| Presença | `GET /api/presenca_escolar` (paginada), `GET /api/presenca_escolar/{id}`, `GET /api/presenca_escolar/obter-notificacoes`, `GET /api/presenca_escolar/dados`, `GET /api/presenca_escolar/kpis` |
| Alunos | `GET /api/alunos` (paginada), `GET /api/alunos/{id}`, `GET /api/alunos/sincronizar`, `GET /api/alunos/kpi/{id}` |
| Leitores faciais | `GET /api/dispositivos_faciais` (paginada), `GET /api/dispositivos_faciais/{id}` |
| Responsáveis | `GET /api/responsaveis` (paginada), `GET /api/responsaveis/{id}` |
| Veículos | `GET /api/veiculos` (paginada), `GET /api/veiculos/{id}/dados` (última posição do rastreador; só o bloco `localizacao` é lido) |

### Envelope de paginação

```json
{
  "data": [ ... ],
  "meta": { "total": 0, "per_page": 0, "current_page": 0, "last_page": 0 }
}
```

### Modelo conhecido — item de `/api/dispositivos_faciais`

Todos os campos chegam como string. Converta ids e coordenadas com segurança, aceitando nulo/vazio.

```json
{
  "id": "string",
  "descricao": "string",
  "veiculo_id": "string",
  "mac": "string",
  "veiculo_prefixo": "string",
  "veiculo_identificador_rastreador": "string",
  "tipo_de_uso_dispositivo_id": "string",
  "tipo_de_uso_dispositivo_descricao": "string",
  "escola_latitude": "string",
  "escola_longitude": "string",
  "escola_id": "string"
}
```

- `tipo_de_uso_dispositivo_id` define se o leitor é de **embarque (veículo)** ou de **chegada (escola)**. Mapeie os valores em `application.yml`; nada fixo no código. Tipo desconhecido gera alerta de configuração e o evento é ignorado — nunca classificar por palpite.
- `veiculo_id` / `veiculo_prefixo` ligam o leitor ao veículo; `escola_id` liga à escola.
- `escola_latitude`, `escola_longitude` e `veiculo_identificador_rastreador` permitem cerca virtual (ônibus entrou no raio da escola → painel passa a esperar os desembarques).
- **GPS ao vivo:** o backend consulta `GET /api/veiculos/{id}/dados` a cada 5 s (`rota-segura.rastreamento.intervalo`) e usa só `localizacao` (formato Traccar: `latitude`, `longitude`, `speed` em nós, `course`, `fixTime`, `valid`, `attributes.motion`). O Swagger não descreve essa resposta; os nomes foram conferidos na API real. O bloco `alunos_na_rota` traz nome de aluno e **não é lido**. `GET /api/veiculos/{id}/localizacao` não é usada: devolve erro 401 do rastreador no próprio ERP.

### Perguntas em aberto (pergunte ao usuário quando chegar nelas)

- Quais valores existem em `tipo_de_uso_dispositivo_id` e o que cada um significa?
- A leitura em `presenca_escolar` aponta para o leitor pelo id do dispositivo ou pelo `mac`?
- O cadastro do aluno informa o veículo/rota esperado?
- `obter-notificacoes` envia avisos aos responsáveis ou só lista?

---

## 3. Stack

**Backend** — `rota-segura-api/`
- Java 21, Spring Boot 3.x, Maven
- PostgreSQL (ou MySQL), Flyway
- Spring Security + JWT (acesso 15 min, refresh rotativo em cookie httpOnly/Secure/SameSite=Strict)
- RestClient, Resilience4j, Caffeine, springdoc-openapi
- JUnit 5, Mockito, WireMock, Testcontainers, ArchUnit, JaCoCo

**Frontend** — `rota-segura-web/`
- Angular 22: standalone components, signals, zoneless, lazy loading por feature
- ngx-echarts (gráficos), Leaflet (mapa, tiles OpenStreetMap por padrão)
- SSE (EventSource) para tempo real
- Playwright (e2e)

**Infra**: Docker multi-stage, docker-compose (api + banco + web), GitHub Actions.

---

## 4. Regras inegociáveis

1. **LGPD — dados de menores.** Nunca logar nome, CPF, foto, telefone ou e-mail: logar só IDs. Nunca colocar dado pessoal em URL/query string. Filtro no Logback removendo padrões de CPF, telefone e e-mail.
2. **Somente dados fictícios** em testes, seeds, exemplos, prints e commits. Nunca copiar dados reais da API para o repositório.
3. **Nenhuma chave no código** (API, mapa, e-mail, JWT): sempre variável de ambiente. Fornecer `.env.example`.
4. **Somente GET na API externa** nesta fase.
5. Fotos nunca em base64 no JSON: backend devolve URL temporária assinada (5 min) de um endpoint autenticado.
6. Dados sensíveis (gênero, raça, deficiência) só agregados, só para perfis `GESTAO`/`SECRETARIA`, e suprimindo grupos com menos de 5 alunos.
7. Todo código vem com testes. Não marque uma fase como concluída com testes falhando.
8. Arquitetura por feature, camadas `integration` → `domain` → `application` → `web`. `web` nunca acessa `integration` direto (validar com ArchUnit). Records para DTOs.
9. Responda e comente em português. Nomes de código podem ser em português (domínio) seguindo o padrão já usado.
10. Antes de cada fase: apresente um plano curto e espere aprovação. Ao fim: liste o que foi feito, como rodar e como testar.

---

## 5. Identidade visual

Manter o padrão das telas atuais do sistema:
- Fonte da verdade: **Sistema de Cores Rota Segura (Design System v0.1)**, aplicado em `rota-segura-web/src/styles.css`. Componentes usam sempre o token, nunca o hex literal.
- Marca (derivada do logo): verde `#2F8A44` (primária: confirmar/avançar), azul `#1D54A8` (secundária: navegação, links, mapas), amarelo `#F8C807` (acento pontual, sempre com texto escuro), teal `#2EA482` (apoio). Proporção 60% neutro · 30% verde+azul · 10% amarelo.
- Tema escuro padrão: fundo `#07111F`, superfície `#0F1C30`, elevada `#142440`, borda `#1F2F48`, texto `#EEF2F8` / secundário `#AEBAC9`; marca `#6FC285`. Tema claro alternável: fundo `#F4F6F8`, superfície `#FFFFFF`, borda `#E2E7ED`, texto `#0F1D33` / secundário `#4A5668`.
- Semânticas (claro / escuro): sucesso `#2F8A44`/`#6FC285`, info `#1D54A8`/`#7FA6EC`, atenção `#D8AA00`/`#FFDB47`, crítico `#CF2E2E`/`#FF6B6B`. Texto em âmbar no tema claro usa `--atencao-texto` `#7A5F00` (AA).
- Tipografia: Plus Jakarta Sans (interface) e JetBrains Mono (valores técnicos). Logo: `rota-segura-web/public/logo.svg` (só o símbolo), acompanhado do nome "Rota" em azul e "Segura" em verde.
- Menu lateral recolhível com grupos **OPERACIONAL** (Dashboard, Presença, Jornada, Veículos, Alertas) e **GESTÃO** (Alunos, Relatórios); rodapé com usuário, perfil, troca de tema e sair.
- Filtros globais no topo (ano letivo, escola, ano escolar, turma) guardados num store e refletidos na URL.
- Todo card trata quatro estados: **carregando, vazio, erro (com "tentar de novo") e desatualizado**.
- Acessibilidade AA, navegação por teclado, i18n pt-BR.

### Problemas da versão atual que NÃO podem se repetir

| Tela | Problema | Correção |
| --- | --- | --- |
| Dashboard | Card preso no skeleton de carregamento | Estados de erro/vazio com timeout e retry |
| Dashboard | Infantil e Fundamental com a mesma média de frequência | Cálculo por etapa + teste que falha se repetir |
| Dashboard | Rótulos do eixo X sobrepostos; donuts sem valores; linha de média sem rótulo | Abreviar com tooltip; valor e % na legenda; rotular a média |
| Dashboard | Gráficos sensíveis visíveis a todos | Regra 6 |
| Presença | Diz "atualiza a cada 60 s" mas mostra "há 2h" | Indicador real de conexão SSE e aviso de dados atrasados |
| Presença | Tendência inclui fim de semana | Só dias letivos |
| Veículos | Mapa com marca d'água "API KEY REQUIRED" | OSM por padrão; outro provedor só com chave em env |
| Veículos/Alertas | 95% de lotação e 0 alertas | Regra de lotação consistente |
| Alertas | Alertas duplicados, placa no texto diferente da etiqueta, texto fixo de teste | Deduplicação; mensagem gerada a partir dos dados |
| Alertas | Verificados contando como críticos | Contadores só de alertas abertos |
| Relatórios | Exportação bloqueada até escolher datas | "7 dias" pré-selecionado + prévia |

---

## 6. Plano por fases

Execute **uma fase por vez**, na ordem. Ao terminar cada uma: testes passando, resumo do que foi feito, e espere o "ok" para seguir.

### Fase 1 — Fundação

**1.1 Backend: projeto e cliente da API externa**
1. Projeto `rota-segura-api`, pacotes: `alunos, presenca, veiculos, dispositivos, responsaveis, jornada, alertas, dashboard, relatorios, auth, shared`.
2. Um cliente por recurso com RestClient, **somente métodos GET**, base URL e token via env.
3. `record PaginaApi<T>(List<T> data, Meta meta)`; utilitário que percorre até `last_page` (limite máximo configurável) e também busca página a página.
4. Resilience4j: timeout 5 s, retry com backoff em 5xx/timeout, circuit breaker por recurso; com circuito aberto, devolver último valor em cache marcado como desatualizado.
5. Caffeine: alunos, veículos, responsáveis, dispositivos 10 min; presença e KPIs 30 s.
6. Erros globais com ProblemDetail (RFC 9457).
7. Testes com WireMock: paginação, erro 500, timeout.

**1.2 Backend: segurança e perfis**
1. Login JWT + refresh rotativo; rate limit no login; CORS restrito; cabeçalhos de segurança.
2. Perfis: `ADMIN`, `GESTAO`, `SECRETARIA`, `DIRETOR` (escopo: suas escolas), `MONITOR` (escopo: seus veículos). Escopo aplicado no serviço.
3. Auditoria de acesso a perfil de aluno e exportações (quem, quando, id, IP) sem dado pessoal.
4. Contato de responsáveis mascarado por padrão; revelar exige permissão e gera auditoria.
5. Testes: cada perfil só vê seu escopo.

**1.3 Frontend: base e design system**
1. Projeto `rota-segura-web` conforme seção 3 e 5.
2. Componentes: `kpi-card`, `chart-card` (4 estados), `status-badge`, `data-table`, `date-range-picker` (Hoje, 7 dias, 30 dias, Este mês), `filter-chips`.
3. Tema ECharts a partir dos tokens; rótulos longos abreviados com tooltip.
4. Interceptors de JWT/refresh e de erro (toast); serviço SSE com reconexão e indicador (online / reconectando / atrasado há X min).

### Fase 2 — Núcleo: jornada do aluno

**2.1 Backend: motor da jornada**
1. Classificar leitores por `tipo_de_uso_dispositivo_id` (seção 2).
2. `JornadaService`: por dia e escola (opcional), lê `presenca_escolar`, cruza com o leitor e monta `JornadaDoDia` por aluno: estado, hora de embarque, veículo, hora de chegada, escola, tempo de trajeto (min), divergências.
3. Máquina de estados explícita (enum + transições válidas). Eventos fora de ordem ou duplicados (mesmo aluno, mesmo leitor, < 2 min) são ignorados e contados.
4. Divergências da seção 1, janela configurável.
5. Testes unitários de cada transição e divergência com `java.time.Clock` injetável.

**2.2 Backend: endpoints do painel** (`/api/v1`, paginação e filtros `anoLetivo, escolaId, anoEscolar, turmaId, turno, dataInicio, dataFim`)
- `GET /dashboard/resumo`, `GET /dashboard/sensiveis`
- `GET /presenca/hoje`, `GET /presenca/periodo`
- `GET /jornadas?data=`, `GET /alunos/{id}/jornadas?inicio&fim`
- `GET /veiculos/status` (embarcados x esperados, ocupação %, estado, última leitura)
- `GET /dispositivos/saude` (online/offline pela última leitura, leituras na última hora, falhas)
- `GET /alunos`, `GET /alunos/{id}/perfil`
- `POST /alunos/sincronizar` (chama `GET /api/alunos/sincronizar` externo, registra quem disparou e o resultado)
- `GET /cadastro/pendencias` (sem biometria, sem responsável, sem veículo)
- springdoc-openapi + testes MockMvc.

**2.3 Frontend: Presença do Dia e Jornada**
1. `/presenca`: KPIs, donut, tendência só de dias letivos, lista de ausentes com "ver jornada" e "contatar responsável" (mascarado), range picker único, selo "ao vivo".
2. `/jornada` (tela nova): colunas por estado com contadores; card com iniciais, turma, veículo, horários e tempo de trajeto; cards mudam de coluna em tempo real; filtro por veículo/escola; painel lateral com linha do tempo do dia e leitor usado em cada passo.
3. Teste: evento SSE `jornada.atualizada` move o card para a coluna certa.

### Fase 3 — Operação

**3.1 Backend: alertas e tempo real**
1. Entidade `Alerta` (tipo, severidade, entidade, mensagem gerada dos dados, status `ABERTO|EM_ANALISE|RESOLVIDO`, resolvido_por/em, comentário).
2. Regras plugáveis (`RegraAlerta`) avaliadas a cada 30 s: embarcou e não chegou; lotação > 90% (atenção) e > 100% (crítico); leitor sem leitura em horário de rota; chegada sem embarque; veículo diferente; cerca virtual (ônibus no raio da escola e aluno embarcado não passou no leitor em X min).
3. Deduplicação: chave = tipo + entidade + janela; alerta aberto igual é atualizado, não recriado.
4. `GET /alertas`, `PATCH /alertas/{id}` (comentário obrigatório ao resolver).
5. SSE `GET /api/v1/stream`: `presenca.atualizada`, `jornada.atualizada`, `veiculo.atualizado`, `alerta.criado`, `alerta.atualizado`, `heartbeat` (15 s); reconexão com `Last-Event-ID`.
6. Fila de avisos aos responsáveis a partir de `obter-notificacoes`.

**3.2 Frontend: Veículos e leitores**
- Lista com busca por placa e chips de estado com contadores; card com ocupação colorida por faixa, GPS e leitor.
- Mapa Leaflet com marcadores por estado e legenda.
- Detalhe do veículo: embarcados (iniciais + turma), saída, previsão de chegada pelo histórico, últimas leituras.
- Aba "Leitores faciais": online/offline, última leitura, leituras/hora, falhas, tipo de uso, prefixo do veículo e escola (somente leitura, vindos da API), agrupados por escola e veículo.

**3.3 Frontend: Alertas**
- Resumo Críticos/Atenção/Informativos só de abertos; abas Abertos/Em análise/Resolvidos; chips de severidade.
- Alerta deduplicado mostra "x ocorrências" e última hora.
- Ações: assumir, resolver com comentário, ir para a entidade.
- Crítico novo via SSE: toast persistente, som opcional, badge no menu.

### Fase 4 — Gestão

**4.1 Frontend: Dashboard**
- KPIs clicáveis no topo: alunos ativos, frequência de hoje, na escola agora, veículos em rota, alertas abertos.
- Matrículas por etapa (linhas por ano, ano atual destacado).
- Frequência diária por escola em barras horizontais ordenadas, linha de média rotulada, cores por faixa (< 60% crítico, 60–85% atenção, > 85% ok).
- Frequência anual por escola com destaque de uma escola.
- Alunos, turmas e docentes por ano escolar; usuários conectados por perfil.
- "Indicadores sensíveis" só para perfis autorizados.

**4.2 Frontend: Alunos**
- Lista com busca, filtro por escola e turno, virtual scroll; card com status de hoje e alertas pendentes.
- Perfil: foto por URL assinada (placeholder com iniciais), turma, escola, veículo, responsáveis mascarados com "revelar" auditado, KPIs (`/api/alunos/kpi/{id}`), heatmap de presença dos últimos 90 dias letivos, histórico de jornadas, indicador de risco (faltas seguidas, queda de frequência).
- Aba "Pendências de cadastro" e botão "Sincronizar alunos" com confirmação, progresso e resultado.

**4.3 Relatórios (backend + frontend)**
- `POST /relatorios/previa`; `GET /relatorios/frequencia.csv` (streaming, UTF-8 com BOM) e `.pdf`; relatório de veículos (viagens, embarcados, tempo médio, atrasos).
- Relatórios agendados semanais por e-mail para o próprio usuário. Toda exportação auditada.
- Tela com "7 dias" pré-selecionado, filtros, prévia antes de exportar.

**4.4 Frontend: modo operação e busca global**
- `/operacao` (modo TV): tela cheia, letras grandes, SSE, veículos em rota, embarcados x esperados por escola, críticos abertos, leitores offline, rotação entre escolas a cada 20 s.
- Busca global Ctrl+K (alunos, veículos, leitores).

### Fase 5 — Entrega
1. Testcontainers; cobertura ≥ 80% em `domain` e `application` (JaCoCo); ArchUnit.
2. Actuator (health do banco e da API externa) e métricas Micrometer (latência por rota externa, alertas criados, leitores offline).
3. Dockerfile multi-stage, docker-compose, GitHub Actions (build, testes, análise estática, imagem).
4. Playwright: login → dashboard → jornada → abrir aluno → resolver alerta → exportar CSV, com backend mockado e dados fictícios.
5. README: como rodar, variáveis de ambiente, seed fictício.

---

## 7. Checklist antes de cada entrega

- [ ] DTOs gerados do Swagger, sem campos inventados
- [ ] Nenhuma chamada à API externa além de GET
- [ ] Nenhum dado real de aluno em código, testes, seeds, prints ou logs
- [ ] Todo card com estados carregando, vazio, erro e desatualizado
- [ ] Infantil e Fundamental com médias calculadas separadamente (teste passando)
- [ ] Alertas sem duplicatas; contadores só de abertos
- [ ] Chaves apenas em variáveis de ambiente
- [ ] Cada perfil só vê seu escopo (teste passando)
