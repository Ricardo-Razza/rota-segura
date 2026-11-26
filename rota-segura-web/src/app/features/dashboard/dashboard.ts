import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { auditTime, bufferTime, filter, merge } from 'rxjs';
import { carga } from '../../core/api/carga';
import { Alerta, PosicaoAoVivo, RastreioVeiculo, Severidade } from '../../core/api/modelos';
import { PainelApi } from '../../core/api/painel-api.service';
import { ROTULO_PERFIL, Perfil } from '../../core/auth/auth.models';
import { AuthService } from '../../core/auth/auth.service';
import { FiltrosStore } from '../../core/filtros/filtros.store';
import { SseService } from '../../core/sse/sse.service';
import { Grafico } from '../../shared/graficos/grafico';
import { haQuanto } from '../../shared/formato';
import { Anel } from '../../shared/ui/anel';
import { Icone } from '../../shared/ui/icone';
import {
  contarFaixas,
  escolasAcimaDoCritico,
  manchete,
  pontosDeEscolas,
} from '../escolas/escolas.logica';
import { MapaVeiculos } from '../veiculos/mapa-veiculos';
import { aplicarPosicoes, JANELA_POSICOES_MS } from '../veiculos/veiculos.logica';
import { ChartCard } from '../../shared/ui/chart-card';
import { Coluna, DataTable } from '../../shared/ui/data-table';
import { barrasPorEscola, barrasPorEtapa, linhasMatriculas } from './dashboard.graficos';

interface LinhaAnoEscolar {
  anoEscolar: string;
  alunos: number;
  turmas: number;
  docentes: number | null;
}

/** Dashboard de gestão. Indicadores sensíveis só para GESTAO/SECRETARIA (regra 6), sempre agregados. */
@Component({
  selector: 'rs-dashboard',
  imports: [ChartCard, Grafico, DataTable, MapaVeiculos, Anel, Icone, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rs-pagina">
      <h1 class="rs-somente-leitor">Resumo da rede</h1>

      <section class="hero" aria-label="A rede agora">
        <div class="hero__mapa rs-hero-mapa">
          <rs-mapa-veiculos
            [veiculos]="veiculos.dados()?.veiculos ?? []"
            [rastreios]="rastreios()"
            [escolas]="pontosEscolas()"
            altura="100%"
            [legenda]="false"
            (selecionar)="abrirVeiculo($event)"
            (selecionarEscola)="abrirEscola($event)"
          />
        </div>

        <div class="painel painel--rede rs-vidro" [attr.aria-busy]="resumo.carregando()">
          <p class="data">{{ hojeExtenso }}</p>
          @switch (resumo.estado()) {
            @case ('carregando') {
              <p class="manchete" role="status">Carregando a rede…</p>
            }
            @case ('erro') {
              <p class="manchete">Não foi possível carregar a rede.</p>
              <button type="button" class="rs-botao" (click)="resumo.recarregar()">
                Tentar de novo
              </button>
            }
            @default {
              <p class="manchete">
                A rede está
                <span [class]="'txt--' + frase().tom">{{ frase().destaque }}</span>,
                {{ frase().complemento }}
              </p>
              @if (resumo.estado() === 'desatualizado') {
                <p class="rs-aviso">Dados desatualizados.</p>
              }
              @if (resumo.dados(); as r) {
                @if (!r.kpis.diaLetivo) {
                  <p class="rs-nota">Hoje não é dia letivo.</p>
                }
              }
              <a class="anel-link" routerLink="/presenca" queryParamsHandling="preserve">
                <rs-anel
                  [valor]="kpis()?.frequenciaHoje ?? null"
                  [tom]="tomFrequencia()"
                  [tamanho]="112"
                  rotulo="Frequência de hoje"
                />
                <span>
                  <strong>chegaram à escola</strong>
                  <span class="rs-mono">{{ chegada().presentes }} / {{ chegada().esperados }}</span>
                </span>
              </a>
              <div class="mini">
                <a routerLink="/veiculos" queryParamsHandling="preserve" class="mini--info">
                  <b class="rs-mono">{{ kpis()?.veiculosEmRota ?? '—' }}</b><small class="rs-mono"
                    >/{{ totalVeiculos() }}</small
                  >
                  <span>ônibus em rota</span>
                </a>
                <a routerLink="/escolas" queryParamsHandling="preserve" class="mini--sucesso">
                  <b class="rs-mono">{{ acima().acima }}</b><small class="rs-mono"
                    >/{{ acima().total }}</small
                  >
                  <span>escolas acima de 60%</span>
                </a>
                <a routerLink="/jornada" queryParamsHandling="preserve">
                  <b class="rs-mono">{{ kpis()?.naEscolaAgora ?? '—' }}</b>
                  <span>na escola agora</span>
                </a>
                <a routerLink="/alunos" queryParamsHandling="preserve">
                  <b class="rs-mono">{{ kpis()?.alunosAtivos ?? '—' }}</b>
                  <span>alunos ativos</span>
                </a>
              </div>
            }
          }
        </div>

        <div class="painel painel--pendencias rs-vidro">
          <h2>
            Precisa de você
            @if (totalAbertos() > 0) {
              <span class="contador">{{ totalAbertos() }}</span>
            }
          </h2>
          @switch (pendencias.estado()) {
            @case ('carregando') {
              <p class="rs-nota" role="status">Carregando alertas…</p>
            }
            @case ('erro') {
              <p class="rs-nota" role="alert">
                Não foi possível carregar os alertas.
                <button
                  type="button"
                  class="rs-botao rs-botao--pequeno"
                  (click)="pendencias.recarregar()"
                >
                  Tentar de novo
                </button>
              </p>
            }
            @default {
              <ul class="alertas">
                @for (a of principais(); track a.id; let primeiro = $first) {
                  <li>
                    <a
                      [class]="'alerta alerta--' + a.severidade"
                      [class.alerta--destaque]="primeiro && a.severidade === 'CRITICO'"
                      routerLink="/alertas"
                      queryParamsHandling="preserve"
                    >
                      <span class="alerta__topo">
                        <span class="ponto" aria-hidden="true"></span>
                        {{ rotuloSeveridade[a.severidade] }} · {{ haQuanto(a.ultimaOcorrenciaEm) }}
                      </span>
                      <strong>{{ a.rotulo }}</strong>
                      <span class="alerta__msg">{{ a.mensagem }}</span>
                    </a>
                  </li>
                } @empty {
                  <li class="tudo-certo">
                    <rs-icone nome="check" [tamanho]="20" />
                    Nada pendente agora.
                  </li>
                }
              </ul>
              <a class="ver-todos" routerLink="/alertas" queryParamsHandling="preserve"
                >Ver todos os alertas <rs-icone nome="dir" [tamanho]="16"
              /></a>
            }
          }
        </div>
      </section>

      <div class="rs-grade rs-grade--2">
        <rs-chart-card
          titulo="Frequência de hoje por escola"
          [estado]="estadoDe(resumo.dados()?.frequenciaHojePorEscola?.length ?? 0)"
          [atualizadoEm]="resumo.atualizadoEm()"
          mensagemVazio="Sem alunos esperados hoje."
          (tentarDeNovo)="resumo.recarregar()"
        >
          <rs-grafico
            [opcoes]="graficoHoje()"
            [altura]="alturaHoje()"
            descricao="Frequência de hoje por escola, ordenada, com linha de média e cores por faixa"
          />
          <p class="rs-nota">
            Faixas: abaixo de 60% crítico · 60 a 85% atenção · acima de 85% adequado.
          </p>
        </rs-chart-card>

        <rs-chart-card
          titulo="Frequência anual por escola"
          [estado]="estadoDe(resumo.dados()?.frequenciaAnualPorEscola?.length ?? 0)"
          [atualizadoEm]="resumo.atualizadoEm()"
          (tentarDeNovo)="resumo.recarregar()"
        >
          <label acoes>
            <span class="rs-somente-leitor">Destacar escola</span>
            <select class="rs-campo" (change)="destacar($event)" aria-label="Destacar escola">
              <option value="">Destacar escola…</option>
              @for (e of resumo.dados()?.frequenciaAnualPorEscola ?? []; track e.escolaId) {
                <option [value]="e.escolaId">{{ e.escolaNome || 'Escola #' + e.escolaId }}</option>
              }
            </select>
          </label>
          <rs-grafico
            [opcoes]="graficoAnual()"
            [altura]="alturaAnual()"
            descricao="Frequência no ano letivo por escola, com uma escola destacada"
          />
        </rs-chart-card>

        <rs-chart-card
          titulo="Frequência por etapa (7 dias letivos)"
          [estado]="estadoEtapas()"
          [atualizadoEm]="resumo.atualizadoEm()"
          mensagemVazio="Etapas não configuradas: defina rota-segura.dashboard.etapas no backend."
          (tentarDeNovo)="resumo.recarregar()"
        >
          <rs-grafico
            [opcoes]="graficoEtapas()"
            descricao="Frequência por etapa nos últimos 7 dias letivos, calculada separadamente para cada etapa"
          />
        </rs-chart-card>

        <rs-chart-card
          titulo="Matrículas por etapa"
          [estado]="estadoDe(anosMatricula())"
          [atualizadoEm]="resumo.atualizadoEm()"
          (tentarDeNovo)="resumo.recarregar()"
        >
          @if (resumo.dados()?.matriculas?.agrupamento === 'ANO_ESCOLAR') {
            <p class="rs-nota">Etapas não configuradas: agrupado por ano escolar.</p>
          }
          <rs-grafico
            [opcoes]="graficoMatriculas()"
            descricao="Matrículas por etapa, uma linha por ano letivo, com o ano atual destacado"
          />
        </rs-chart-card>

        <rs-chart-card
          titulo="Alunos, turmas e docentes por ano escolar"
          [estado]="estadoDe(porAnoEscolar().length)"
          [atualizadoEm]="resumo.atualizadoEm()"
          (tentarDeNovo)="resumo.recarregar()"
        >
          <rs-data-table
            legenda="Alunos, turmas e docentes por ano escolar"
            [colunas]="colunasAno"
            [linhas]="porAnoEscolar()"
          />
          <p class="rs-nota">Docentes: a API autorizada não informa (aparece "—").</p>
        </rs-chart-card>

        <rs-chart-card
          titulo="Usuários conectados agora"
          [estado]="resumo.estado()"
          [atualizadoEm]="resumo.atualizadoEm()"
          (tentarDeNovo)="resumo.recarregar()"
        >
          <ul class="rs-lista">
            @for (p of conectados(); track p.perfil) {
              <li>
                <span class="cresce">{{ p.rotulo }}</span><strong>{{ p.total }}</strong>
              </li>
            } @empty {
              <li class="rs-nota">Ninguém conectado ao tempo real.</li>
            }
          </ul>
        </rs-chart-card>
      </div>

      @if (podeVerSensiveis()) {
        <rs-chart-card
          titulo="Indicadores sensíveis (agregados)"
          [estado]="sensiveis.estado()"
          [atualizadoEm]="sensiveis.atualizadoEm()"
          (tentarDeNovo)="sensiveis.recarregar()"
        >
          @if (sensiveis.dados(); as s) {
            @if (!s.disponivel) {
              <p class="rs-nota">{{ s.motivo || 'Indicadores indisponíveis.' }}</p>
            }
            @for (ind of s.indicadores; track ind.nome) {
              <h3>{{ ind.nome }}</h3>
              <ul class="rs-lista">
                @for (g of ind.grupos; track g.rotulo) {
                  <li>
                    <span class="cresce">{{ g.rotulo }}</span><strong>{{
                      g.suprimido ? 'menos de ' + s.minimoPorGrupo : g.quantidadeReal
                    }}</strong>
                  </li>
                }
              </ul>
            }
            <p class="rs-nota">Grupos com menos de {{ s.minimoPorGrupo }} alunos são suprimidos.</p>
          }
        </rs-chart-card>
      }
    </div>
  `,
  styles: `
    /* isolation: os painéis sobre o mapa (z-index 500, acima do Leaflet) ficam presos nesta camada e
       nunca passam por cima da barra do topo nem do menu da conta (z-index 30).
       --rs-reservado: espaço do topo, filtros ativos e margens, medido pelo shell. */
    .hero {
      position: relative;
      isolation: isolate;
      height: clamp(500px, calc(100dvh - var(--rs-reservado, 190px)), 760px);
    }
    .hero__mapa {
      position: absolute;
      inset: 0;
      overflow: hidden;
      border: 1px solid var(--vidro-borda);
      border-radius: 26px;
    }
    .hero__mapa rs-mapa-veiculos {
      height: 100%;
    }
    .painel {
      position: absolute;
      top: 16px;
      z-index: 500;
      width: min(380px, 40%);
      max-height: calc(100% - 32px);
      overflow-y: auto;
      padding: 22px 24px;
      border-radius: 24px;
    }
    .painel--rede {
      left: 16px;
    }
    .painel--pendencias {
      right: 16px;
    }
    .data {
      margin: 0;
      color: var(--texto-suave);
      font-weight: 600;
    }
    .manchete {
      margin: 4px 0 16px;
      font-size: 28px;
      font-weight: 800;
      line-height: 1.12;
      letter-spacing: -0.02em;
    }
    .txt--sucesso {
      color: var(--sucesso);
    }
    .txt--critico {
      color: var(--critico);
    }
    .anel-link {
      display: flex;
      align-items: center;
      gap: 18px;
      color: var(--texto);
      text-decoration: none;
    }
    .anel-link > span {
      display: flex;
      flex-direction: column;
    }
    .anel-link .rs-mono {
      color: var(--texto-suave);
    }
    .mini {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-top: 18px;
    }
    .mini a {
      display: block;
      padding: 12px 14px;
      border-radius: 16px;
      background: var(--neutro-fundo);
      color: var(--texto);
      text-decoration: none;
    }
    .mini a:hover {
      outline: 1px solid var(--borda-forte);
    }
    .mini b {
      font-size: 26px;
    }
    .mini small {
      color: var(--texto-mudo);
      font-size: 14px;
    }
    .mini span {
      display: block;
      color: var(--texto-suave);
      font-size: 13px;
    }
    .mini a.mini--info {
      background: var(--info-fundo);
    }
    .mini--info b {
      color: var(--info);
    }
    .mini a.mini--sucesso {
      background: var(--sucesso-fundo);
    }
    .mini--sucesso b {
      color: var(--sucesso);
    }
    .painel h2 {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 14px;
      font-size: 19px;
      font-weight: 800;
    }
    .contador {
      min-width: 26px;
      padding: 2px 8px;
      border-radius: 999px;
      background: var(--critico-fundo);
      color: var(--critico);
      font-size: 13px;
      text-align: center;
    }
    .alertas {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .alerta {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 12px 14px;
      border: 1px solid var(--vidro-borda);
      border-radius: 16px;
      background: var(--neutro-fundo);
      color: var(--texto);
      text-decoration: none;
    }
    .alerta:hover {
      border-color: var(--borda-forte);
    }
    .alerta__topo {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .alerta .ponto {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: currentColor;
    }
    .alerta--CRITICO .alerta__topo {
      color: var(--critico);
    }
    .alerta--ATENCAO .alerta__topo {
      color: var(--atencao-texto);
    }
    .alerta--INFO .alerta__topo {
      color: var(--info);
    }
    .alerta--destaque {
      border-color: color-mix(in srgb, var(--critico) 45%, transparent);
      background: var(--critico-fundo);
    }
    .alerta--destaque strong {
      font-size: 18px;
    }
    .alerta__msg {
      color: var(--texto-suave);
      font-size: 13px;
    }
    .tudo-certo {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px;
      border-radius: 16px;
      background: var(--sucesso-fundo);
      color: var(--sucesso);
      font-weight: 700;
    }
    .ver-todos {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-top: 12px;
      font-weight: 700;
      text-decoration: none;
    }
    @media (max-width: 900px) {
      .hero {
        display: flex;
        flex-direction: column;
        gap: 12px;
        height: auto;
      }
      .hero__mapa {
        position: relative;
        order: 1;
        height: 280px;
        border-radius: 20px;
      }
      .painel {
        position: static;
        width: auto;
        max-height: none;
        padding: 18px;
      }
      .manchete {
        font-size: 24px;
      }
    }
    .cresce {
      flex: 1;
    }
    h3 {
      margin: 10px 0 4px;
      font-size: 13px;
    }
  `,
})
export class Dashboard {
  private readonly api = inject(PainelApi);
  private readonly filtros = inject(FiltrosStore);
  private readonly auth = inject(AuthService);

  protected readonly destaque = signal<number | null>(null);
  protected readonly podeVerSensiveis = computed(
    () => this.auth.usuario()?.podeVerIndicadoresSensiveis === true,
  );

  protected readonly resumo = carga(() => this.api.dashboard(this.filtros.parametros()), {
    vazio: (r) => r.kpis.alunosAtivos === 0,
  });
  protected readonly sensiveis = carga(() =>
    this.podeVerSensiveis() ? this.api.sensiveis() : null,
  );

  protected readonly kpis = computed(() => this.resumo.dados()?.kpis ?? null);
  protected readonly tomFrequencia = computed(() => {
    const f = this.kpis()?.frequenciaHoje;
    if (f === null || f === undefined) {
      return 'neutro';
    }
    return f < 60 ? 'critico' : f <= 85 ? 'atencao' : 'sucesso';
  });

  // ----- Mapa e painéis do topo
  protected readonly haQuanto = haQuanto;
  protected readonly rotuloSeveridade: Record<Severidade, string> = {
    CRITICO: 'Crítico',
    ATENCAO: 'Atenção',
    INFO: 'Informativo',
  };
  protected readonly hojeExtenso = capitalizar(
    new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }),
  );
  protected readonly veiculos = carga(() => this.api.veiculos(this.filtros.parametros()));
  protected readonly rastreio = carga(() => this.api.rastreamento());
  protected readonly rastreios = linkedSignal<RastreioVeiculo[]>(
    () => this.rastreio.dados()?.veiculos ?? [],
  );
  protected readonly pendencias = carga(() =>
    this.api.alertas({ ...this.filtros.parametros(), status: 'ABERTO', tamanho: 50 }),
  );
  protected readonly totalAbertos = computed(() => this.pendencias.dados()?.resumo.abertos ?? 0);
  protected readonly principais = computed(() =>
    priorizar(this.pendencias.dados()?.alertas.itens ?? []).slice(0, 3),
  );
  protected readonly pontosEscolas = computed(() =>
    pontosDeEscolas(
      this.veiculos.dados()?.veiculos ?? [],
      this.resumo.dados()?.frequenciaHojePorEscola ?? [],
    ),
  );
  protected readonly totalVeiculos = computed(() => this.veiculos.dados()?.veiculos.length ?? '—');
  protected readonly acima = computed(() =>
    escolasAcimaDoCritico(this.resumo.dados()?.frequenciaHojePorEscola ?? []),
  );
  protected readonly chegada = computed(() => {
    const escolas = this.resumo.dados()?.frequenciaHojePorEscola ?? [];
    return {
      presentes: escolas.reduce((t, e) => t + e.presentes, 0),
      esperados: escolas.reduce((t, e) => t + e.esperados, 0),
    };
  });
  protected readonly frase = computed(() =>
    manchete(
      this.pendencias.dados()?.resumo.abertosPorSeveridade.CRITICO ?? 0,
      contarFaixas(this.resumo.dados()?.frequenciaHojePorEscola ?? []).critico,
    ),
  );

  protected readonly graficoHoje = computed(() =>
    barrasPorEscola(this.resumo.dados()?.frequenciaHojePorEscola ?? []),
  );
  protected readonly alturaHoje = computed(() =>
    Math.max(200, (this.resumo.dados()?.frequenciaHojePorEscola.length ?? 0) * 32 + 50),
  );
  protected readonly graficoAnual = computed(() =>
    barrasPorEscola(this.resumo.dados()?.frequenciaAnualPorEscola ?? [], this.destaque()),
  );
  protected readonly alturaAnual = computed(() =>
    Math.max(200, (this.resumo.dados()?.frequenciaAnualPorEscola.length ?? 0) * 32 + 50),
  );
  protected readonly graficoEtapas = computed(() =>
    barrasPorEtapa(this.resumo.dados()?.frequenciaPorEtapa ?? []),
  );
  protected readonly graficoMatriculas = computed(() => {
    const m = this.resumo.dados()?.matriculas;
    return m ? linhasMatriculas(m) : {};
  });
  protected readonly anosMatricula = computed(
    () => Object.keys(this.resumo.dados()?.matriculas.porAno ?? {}).length,
  );
  protected readonly porAnoEscolar = computed<LinhaAnoEscolar[]>(
    () => this.resumo.dados()?.porAnoEscolar ?? [],
  );
  protected readonly conectados = computed(() =>
    Object.entries(this.resumo.dados()?.usuariosConectados ?? {}).map(([perfil, total]) => ({
      perfil,
      rotulo: ROTULO_PERFIL[perfil as Perfil] ?? perfil,
      total,
    })),
  );
  protected readonly estadoEtapas = computed(() => {
    const r = this.resumo.dados();
    if (r && (!r.etapasConfiguradas || r.frequenciaPorEtapa.length === 0)) {
      return 'vazio' as const;
    }
    return this.resumo.estado();
  });

  protected readonly colunasAno: Coluna<LinhaAnoEscolar>[] = [
    { chave: 'ano', titulo: 'Ano escolar', valor: (l) => l.anoEscolar },
    { chave: 'alunos', titulo: 'Alunos', valor: (l) => l.alunos, alinhar: 'direita' },
    { chave: 'turmas', titulo: 'Turmas', valor: (l) => l.turmas, alinhar: 'direita' },
    { chave: 'docentes', titulo: 'Docentes', valor: (l) => l.docentes, alinhar: 'direita' },
  ];

  private readonly router = inject(Router);

  constructor() {
    const sse = inject(SseService);
    merge(sse.de('presenca.atualizada'), sse.de('alerta.criado'), sse.de('alerta.atualizado'))
      .pipe(auditTime(5000), takeUntilDestroyed())
      .subscribe(() => {
        this.resumo.recarregar(true);
        this.pendencias.recarregar(true);
      });
    merge(sse.de('veiculo.atualizado'), sse.de('jornada.atualizada'))
      .pipe(auditTime(5000), takeUntilDestroyed())
      .subscribe(() => this.veiculos.recarregar(true));
    sse
      .de<PosicaoAoVivo>('veiculo.posicao')
      .pipe(
        bufferTime(JANELA_POSICOES_MS),
        filter((eventos) => eventos.length > 0),
        takeUntilDestroyed(),
      )
      .subscribe((eventos) => this.rastreios.update((lista) => aplicarPosicoes(lista, eventos)));
  }

  protected abrirVeiculo(id: number): void {
    void this.router.navigate(['/veiculos'], {
      queryParams: { veiculo: id },
      queryParamsHandling: 'merge',
    });
  }

  protected abrirEscola(id: number): void {
    void this.router.navigate(['/escolas'], {
      queryParams: { escola: id },
      queryParamsHandling: 'merge',
    });
  }

  /** Estado de um card derivado do resumo: vazio quando a série dele não tem itens. */
  protected estadoDe(itens: number) {
    const estado = this.resumo.estado();
    return estado === 'ok' && itens === 0 ? 'vazio' : estado;
  }

  protected destacar(evento: Event): void {
    const valor = (evento.target as HTMLSelectElement).value;
    this.destaque.set(valor ? Number(valor) : null);
  }
}

const PESO: Record<Severidade, number> = { CRITICO: 0, ATENCAO: 1, INFO: 2 };

/** Críticos primeiro; dentro da mesma severidade, o mais recente primeiro. */
export function priorizar(alertas: Alerta[]): Alerta[] {
  return [...alertas].sort(
    (a, b) =>
      PESO[a.severidade] - PESO[b.severidade] ||
      b.ultimaOcorrenciaEm.localeCompare(a.ultimaOcorrenciaEm),
  );
}

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
