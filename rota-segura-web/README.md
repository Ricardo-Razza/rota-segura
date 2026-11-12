# rota-segura-web

Frontend do painel Rota Segura (Angular 22, standalone, signals, zoneless). Visão geral, variáveis e
limitações no [README da raiz](../README.md).

## Comandos

| Comando | O que faz |
| --- | --- |
| `npx ng serve --proxy-config proxy.conf.json` | Desenvolvimento em <http://localhost:4200>, `/api` → `localhost:8080` |
| `npx ng test --watch=false` | Testes unitários (Vitest) |
| `npx ng build --configuration production` | Build de produção em `dist/rota-segura-web/browser` |
| `npm run e2e` | Playwright com backend simulado (`e2e/api-simulada.ts`, só dados fictícios) |
| `npx prettier --check "src/**/*.{ts,html}"` | Formatação (também roda no CI) |

## Estrutura

- `src/app/core`: autenticação (JWT em memória e refresh por cookie), interceptors, SSE, toasts, tema, filtros globais e cliente do painel (`api/painel-api.service.ts`).
- `src/app/shared`: design system (`kpi-card`, `chart-card` com 4 estados, `status-badge`, `data-table`, `date-range-picker`, `filter-chips`), gráficos com o tema dos tokens e formatação pt-BR.
- `src/app/features`: dashboard, presença, jornada, veículos e leitores, alertas, alunos, relatórios e modo operação (`/operacao`), todos com lazy loading.
- `src/styles.css`: tokens do Sistema de Cores Rota Segura (tema escuro e claro). Os componentes usam sempre o token, nunca o hex.
