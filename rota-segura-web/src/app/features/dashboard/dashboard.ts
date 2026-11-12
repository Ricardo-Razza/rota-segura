import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { auditTime, merge } from 'rxjs';
import { carga } from '../../core/api/carga';
import { PainelApi } from '../../core/api/painel-api.service';
import { ROTULO_PERFIL, Perfil } from '../../core/auth/auth.models';
import { AuthService } from '../../core/auth/auth.service';
import { FiltrosStore } from '../../core/filtros/filtros.store';
import { SseService } from '../../core/sse/sse.service';
import { Grafico } from '../../shared/graficos/grafico';
import { percentual } from '../../shared/formato';
import { ChartCard } from '../../shared/ui/chart-card';
import { Coluna, DataTable } from '../../shared/ui/data-table';
import { KpiCard } from '../../shared/ui/kpi-card';
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
  imports: [ChartCard, KpiCard, Grafico, DataTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rs-pagina">
      <div class="rs-pagina__topo">
        <h1>Dashboard</h1>
        @if (resumo.dados(); as r) {
          <p class="rs-nota">
            Ano letivo {{ r.anoLetivo }}{{ r.kpis.diaLetivo ? '' : ' · hoje não é dia letivo' }}
          </p>
        }
      </div>

      <div class="rs-grade rs-grade--kpi">
        <rs-kpi-card
          rotulo="Alunos ativos"
          tom="info"
          link="/alunos"
          [valor]="kpis()?.alunosAtivos ?? null"
          [carregando]="resumo.carregando()"
        />
        <rs-kpi-card
          rotulo="Frequência de hoje"
          link="/presenca"
          [tom]="tomFrequencia()"
          [valor]="frequenciaHoje()"
          [carregando]="resumo.carregando()"
        />
        <rs-kpi-card
          rotulo="Na escola agora"
          tom="sucesso"
          link="/jornada"
          [valor]="kpis()?.naEscolaAgora ?? null"
          [carregando]="resumo.carregando()"
        />
        <rs-kpi-card
          rotulo="Veículos em rota"
          tom="info"
          link="/veiculos"
          [valor]="kpis()?.veiculosEmRota ?? null"
          [carregando]="resumo.carregando()"
        />
        <rs-kpi-card
          rotulo="Alertas abertos"
          link="/alertas"
          [tom]="(kpis()?.alertasAbertos ?? 0) > 0 ? 'critico' : 'neutro'"
          [valor]="kpis()?.alertasAbertos ?? null"
          [carregando]="resumo.carregando()"
        />
      </div>

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
  protected readonly frequenciaHoje = computed(() => {
    const k = this.kpis();
    return k ? percentual(k.frequenciaHoje) : null;
  });
  protected readonly tomFrequencia = computed(() => {
    const f = this.kpis()?.frequenciaHoje;
    if (f === null || f === undefined) {
      return 'neutro';
    }
    return f < 60 ? 'critico' : f <= 85 ? 'atencao' : 'sucesso';
  });

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

  constructor() {
    const sse = inject(SseService);
    merge(sse.de('presenca.atualizada'), sse.de('alerta.criado'), sse.de('alerta.atualizado'))
      .pipe(auditTime(5000), takeUntilDestroyed())
      .subscribe(() => this.resumo.recarregar(true));
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
