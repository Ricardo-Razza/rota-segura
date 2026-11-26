# Rota Segura · Gestão Escolar

Painel de gestão que acompanha a **jornada do aluno** no transporte escolar por reconhecimento facial:
embarque (leitor no ônibus) → chegada (leitor na escola), com divergências, alertas, tempo real e relatórios.

| Pasta | O que é |
| --- | --- |
| `rota-segura-api/` | Backend Java 21 · Spring Boot 3.5 · MySQL 8.4/Flyway · JWT · Resilience4j · Caffeine |
| `rota-segura-web/` | Frontend Angular 22 (standalone, signals, zoneless) · ngx-echarts · Leaflet/OSM · SSE |
| `docker-compose.yml` | Banco + API + web (nginx) |
| `.github/workflows/ci.yml` | Build, testes, cobertura, e2e e imagens Docker |

A API externa é usada **somente com GET**. Tudo o que o painel grava (usuários, alertas tratados,
auditoria, agendamentos) fica no banco próprio.

---

## Como rodar

### Com Docker (tudo junto)

```bash
cp .env.example .env        # preencha ROTA_JWT_SECRET, ROTA_DB_SENHA, ROTA_API_BASE_URL, ROTA_ADMIN_*
docker compose up --build
```

Abra <http://localhost:8081> e entre com o `ROTA_ADMIN_LOGIN` / `ROTA_ADMIN_SENHA` definidos no `.env`
(o administrador é criado na primeira subida). A API fica só na rede interna do compose; o nginx repassa `/api`.

### Em desenvolvimento

Pré-requisitos: JDK 21, Node 24, Docker (para o MySQL e para os testes com Testcontainers).

```bash
docker run -d --name rota-db -p 3306:3306 -e MYSQL_DATABASE=rota_segura -e MYSQL_USER=rota_segura -e MYSQL_PASSWORD=troque-esta-senha -e MYSQL_RANDOM_ROOT_PASSWORD=yes mysql:8.4
```

Backend (as variáveis do `.env` precisam estar no ambiente; `ROTA_COOKIE_SECURE=false` sem HTTPS):

```bash
cd rota-segura-api && ./mvnw spring-boot:run
```

Frontend (proxy de `/api` para `localhost:8080` em `proxy.conf.json`):

```bash
cd rota-segura-web && npm ci && npx ng serve --proxy-config proxy.conf.json
```

Abra <http://localhost:4200>. A vitrine de componentes fica em `/design-system`.

---

## Variáveis de ambiente

Todas estão comentadas em [`.env.example`](.env.example). Nenhuma chave fica no código.

| Variável | Obrigatória | Uso |
| --- | --- | --- |
| `ROTA_API_BASE_URL` | sim | URL da API externa (somente GET) |
| `ROTA_API_AUTHORIZATION` | não | Valor do cabeçalho `Authorization` da API externa |
| `ROTA_DB_URL` / `ROTA_DB_USUARIO` / `ROTA_DB_SENHA` | sim | Banco próprio do painel (MySQL 8.4; ex.: `jdbc:mysql://localhost:3306/rota_segura`). Datas gravadas em UTC |
| `ROTA_JWT_SECRET` | sim | Segredo do JWT (≥ 32 caracteres aleatórios) |
| `ROTA_ADMIN_LOGIN` / `ROTA_ADMIN_SENHA` | 1ª subida | Administrador inicial |
| `ROTA_CORS_ORIGENS` | não | Origens do frontend autorizadas |
| `ROTA_COOKIE_SECURE` | não | `false` só em desenvolvimento sem HTTPS |
| `ROTA_FORWARD_HEADERS` | não | `native` atrás de proxy (IP real na auditoria e no rate limit) |
| `ROTA_ALERTAS_HABILITADOS` | não | Liga o ciclo de alertas de 30 s |
| `ROTA_RASTREAMENTO_HABILITADO` | não | Liga o GPS ao vivo dos veículos (padrão `true`) |
| `ROTA_RASTREAMENTO_INTERVALO` | não | Intervalo entre consultas ao rastreador (padrão `5s`) |
| `ROTA_RASTREAMENTO_RETENCAO` | não | Por quanto tempo o trajeto dos ônibus fica no banco antes de ser apagado (padrão `90d`) |
| `ROTA_API_REVALIDACAO_COMPLETA` | não | De quanto em quanto tempo as páginas antigas da presença são relidas por inteiro; nos outros ciclos só as últimas páginas são lidas (padrão `30m`) |
| `ROTA_INDICE_RESPONSAVEIS` | não | Liga o índice aluno → responsáveis em segundo plano |
| `ROTA_SWAGGER_HABILITADO` | não | Swagger UI do painel (`/swagger-ui.html`) |
| `SPRING_MAIL_*` | não | SMTP dos relatórios semanais; sem host, o envio é ignorado |

Configurações de domínio (sem segredo) ficam em `rota-segura-api/src/main/resources/application.yml`:
tipos de leitor (`tipos-leitor`), janela sem chegada, limite de ausência por turno, feriados
(`calendario.dias-sem-aula`), limites de lotação, mapeamento de etapas, horários de rota.

---

## Como testar

```bash
cd rota-segura-api && ./mvnw verify          # unitários, WireMock, MockMvc, Testcontainers, ArchUnit, JaCoCo ≥ 80%
cd rota-segura-web && npx ng test --watch=false
cd rota-segura-web && npx playwright install chromium && npm run e2e
```

- Relatório de cobertura: `rota-segura-api/target/site/jacoco/index.html`.
- O e2e (`rota-segura-web/e2e/`) sobe só o frontend e simula o backend no navegador. Fluxo coberto:
  login → dashboard → jornada → perfil do aluno → resolver alerta → exportar CSV.

### Dados fictícios

Testes, seeds e e2e usam apenas dados inventados (ex.: "Ana Exemplo", "Escola Modelo Fictícia", placa `ABC1D23`).
Nunca copie dados reais da API para o repositório, logs ou prints.

---

## Observabilidade

- `GET /actuator/health` (público, só o status), `/actuator/health/liveness` e `/readiness`.
  Detalhes (banco e circuito da API externa por recurso) só para `ADMIN`. API externa com circuito aberto = `DEGRADADO` (HTTP 200).
- `GET /actuator/metrics` (somente `ADMIN`):
  - `rota.api_externa.chamadas`: latência por recurso e resultado;
  - `rota.alertas.criados`: por tipo e severidade;
  - `rota.leitores.offline`.

---

## LGPD e segurança

- Logs só com IDs; filtro no Logback mascara CPF, telefone e e-mail.
- Nada de dado pessoal em URL: a busca por nome é `POST /alunos/busca`.
- Dados sensíveis só agregados, só para `GESTAO`/`SECRETARIA`, grupos com menos de 5 suprimidos.
- Escopo por perfil: `DIRETOR` vê suas escolas e `MONITOR` vê seus veículos. O escopo é aplicado no serviço.
- Auditoria de acesso ao perfil do aluno, revelação de contato e exportações: quem, quando, id e IP.

---

## Limitações conhecidas (dependem da API externa)

| Item | Situação atual |
| --- | --- |
| GPS do veículo | Não exposto. O mapa posiciona o veículo na escola de destino |
| Capacidade do veículo | Lida de `/api/veiculos/{id}/dados` junto com o GPS (`veiculo.capacidade`, senão `kpi.capacidadeMaxima`). Sem ela: capacidade 0, ocupação 0% e nenhum alerta de lotação |
| Etapa (Infantil/Fundamental) | Não exposta. Mapeie em `dashboard.etapas`; sem isso, o painel agrupa por ano escolar |
| Gênero/raça/deficiência | Não expostos. O card "Indicadores sensíveis" informa a indisponibilidade |
| Contato do responsável | Não exposto. "Revelar contato" fica desabilitado |
| Veículo esperado do aluno | Não está no cadastro. A divergência `VEICULO_DIFERENTE_DO_CADASTRO` não dispara |
| Falhas de leitura do leitor | Não expostas |
| `obter-notificacoes` | Fila de avisos aos responsáveis adiada até se saber se a rota envia ou só lista |
| `/api/alunos/kpi/{id}` | Formato não documentado. Os KPIs do perfil são calculados do histórico de jornadas |
