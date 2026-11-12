import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { auditTime } from 'rxjs';
import { carga } from '../../core/api/carga';
import { LinhaJornada } from '../../core/api/modelos';
import { PainelApi } from '../../core/api/painel-api.service';
import { FiltrosStore } from '../../core/filtros/filtros.store';
import { IndicadorConexao } from '../../core/sse/indicador-conexao';
import { SseService } from '../../core/sse/sse.service';
import { Grafico } from '../../shared/graficos/grafico';
import { eixoDeCategorias, legendaComValor } from '../../shared/graficos/rotulos';
import { dataCurta, hora, percentual } from '../../shared/formato';
import { ChartCard } from '../../shared/ui/chart-card';
import { DateRangePicker, Periodo, periodoDoPreset } from '../../shared/ui/date-range-picker';
import { KpiCard } from '../../shared/ui/kpi-card';
import { StatusBadge } from '../../shared/ui/status-badge';
import { EstadoJornada, JORNADA } from '../../shared/ui/tom';

const CORES: Record<EstadoJornada, string> = {
  NA_ESCOLA: '--sucesso',
  EMBARCADO: '--info',
  AGUARDANDO: '--texto-mudo',
  AUSENTE: '--atencao',
  DIVERGENTE: '--critico',
};

function cor(token: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim() || '#888';
}

/** Presença do dia: KPIs, distribuição por estado, tendência (só dias letivos) e quem ainda não chegou. */
@Component({
  selector: 'rs-presenca',
  imports: [
    ChartCard,
    KpiCard,
    Grafico,
    DateRangePicker,
    StatusBadge,
    RouterLink,
    IndicadorConexao,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rs-pagina">
      <div class="rs-pagina__topo">
        <h1>Presença do dia</h1>
        <div class="rs-pagina__acoes">
          <rs-indicador-conexao />
        </div>
      </div>

      @if (hoje.dados(); as h) {
        @if (!h.diaLetivo) {
          <p class="rs-aviso">Hoje não é dia letivo: ninguém é esperado na escola.</p>
        }
      }

      <div class="rs-grade rs-grade--kpi">
        <rs-kpi-card
          rotulo="Esperados"
          [valor]="contagem()?.esperados ?? null"
          [carregando]="hoje.carregando()"
        />
        <rs-kpi-card
          rotulo="Na escola"
          tom="sucesso"
          [valor]="contagem()?.naEscola ?? null"
          [carregando]="hoje.carregando()"
        />
        <rs-kpi-card
          rotulo="Embarcados"
          tom="info"
          [valor]="contagem()?.embarcados ?? null"
          [carregando]="hoje.carregando()"
        />
        <rs-kpi-card
          rotulo="Ausentes"
          tom="atencao"
          [valor]="contagem()?.ausentes ?? null"
          [carregando]="hoje.carregando()"
        />
        <rs-kpi-card
          rotulo="Divergentes"
          tom="critico"
          [valor]="contagem()?.divergentes ?? null"
          link="/alertas"
          [carregando]="hoje.carregando()"
        />
        <rs-kpi-card rotulo="Frequência" [valor]="frequencia()" [carregando]="hoje.carregando()" />
      </div>

      <div class="rs-grade rs-grade--2">
        <rs-chart-card
          titulo="Situação de hoje"
          [estado]="hoje.estado()"
          [atualizadoEm]="hoje.atualizadoEm()"
          mensagemVazio="Nenhum aluno esperado hoje."
          (tentarDeNovo)="hoje.recarregar()"
        >
          <rs-grafico [opcoes]="donut()" [descricao]="descricaoDonut()" />
        </rs-chart-card>

        <rs-chart-card
          titulo="Tendência da frequência (dias letivos)"
          [estado]="periodo.estado()"
          [atualizadoEm]="periodo.atualizadoEm()"
          mensagemVazio="Nenhum dia letivo no período."
          (tentarDeNovo)="periodo.recarregar()"
        >
          <rs-date-range-picker acoes [(periodo)]="intervalo" />
          <rs-grafico [opcoes]="tendencia()" [descricao]="descricaoTendencia()" />
        </rs-chart-card>
      </div>

      <rs-chart-card
        titulo="Ainda sem presença hoje"
        [estado]="hoje.estado()"
        [atualizadoEm]="hoje.atualizadoEm()"
        mensagemVazio="Todos os esperados já chegaram."
        (tentarDeNovo)="hoje.recarregar()"
      >
        @if (semPresenca().length === 0) {
          <p class="rs-nota">Todos os esperados já chegaram.</p>
        } @else {
          <ul class="rs-lista" aria-label="Alunos sem presença">
            @for (linha of semPresenca(); track linha.aluno.id) {
              <li>
                <span class="rs-avatar" aria-hidden="true">{{ linha.aluno.iniciais || '?' }}</span>
                <span class="quem">
                  <strong>{{ linha.aluno.nome || 'Aluno #' + linha.aluno.id }}</strong>
                  <span class="rs-nota"
                    >{{ linha.aluno.turma || 'Sem turma' }} ·
                    {{ linha.aluno.escolaNome || 'Escola não informada' }}</span
                  >
                </span>
                <rs-status-badge [texto]="rotulo(linha)" [tom]="tom(linha)" />
                <span class="rs-nota">{{
                  linha.jornada.embarqueEm ? 'embarcou ' + hora(linha.jornada.embarqueEm) : ''
                }}</span>
                <a
                  class="rs-botao rs-botao--pequeno"
                  [routerLink]="['/jornada']"
                  [queryParams]="{ aluno: linha.aluno.id }"
                  queryParamsHandling="merge"
                  >Ver jornada</a
                >
                <a
                  class="rs-botao rs-botao--pequeno"
                  [routerLink]="['/alunos', linha.aluno.id]"
                  fragment="responsaveis"
                  >Contatar responsável</a
                >
              </li>
            }
          </ul>
          @if ((hoje.dados()?.semPresenca?.total ?? 0) > semPresenca().length) {
            <p class="rs-nota">
              Mostrando {{ semPresenca().length }} de {{ hoje.dados()?.semPresenca?.total }}.
            </p>
          }
        }
      </rs-chart-card>
    </div>
  `,
  styles: `
    .quem {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-width: 0;
    }
    li {
      flex-wrap: wrap;
    }
  `,
})
export class Presenca {
  private readonly api = inject(PainelApi);
  private readonly filtros = inject(FiltrosStore);

  protected readonly hora = hora;
  protected readonly intervalo = signal<Periodo>(periodoDoPreset('7dias'));

  protected readonly hoje = carga(
    () => this.api.presencaHoje({ ...this.filtros.parametros(), tamanho: 100 }),
    {
      vazio: (h) => h.contagem.esperados === 0,
    },
  );

  protected readonly periodo = carga(
    () =>
      this.api.presencaPeriodo({
        ...this.filtros.parametros(),
        dataInicio: this.intervalo().inicio,
        dataFim: this.intervalo().fim,
      }),
    { vazio: (p) => p.dias.length === 0 },
  );

  protected readonly contagem = computed(() => this.hoje.dados()?.contagem ?? null);
  protected readonly frequencia = computed(() => {
    const c = this.contagem();
    return c ? percentual(c.frequencia) : null;
  });
  protected readonly semPresenca = computed(() => this.hoje.dados()?.semPresenca.itens ?? []);

  protected readonly donut = computed(() => {
    const c = this.contagem();
    if (!c) {
      return {};
    }
    const fatias: [EstadoJornada, number][] = [
      ['NA_ESCOLA', c.naEscola],
      ['EMBARCADO', c.embarcados],
      ['AGUARDANDO', c.aguardando],
      ['AUSENTE', c.ausentes],
      ['DIVERGENTE', c.divergentes],
    ];
    const total = fatias.reduce((s, [, v]) => s + v, 0);
    const nomes = new Map(
      fatias.map(([e, v]) => [JORNADA[e].rotulo, legendaComValor(JORNADA[e].rotulo, v, total)]),
    );
    return {
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: {
        orient: 'vertical',
        right: 0,
        top: 'middle',
        formatter: (nome: string) => nomes.get(nome) ?? nome,
      },
      series: [
        {
          type: 'pie',
          radius: ['48%', '72%'],
          center: ['32%', '50%'],
          label: { show: true, formatter: '{c}' },
          data: fatias.map(([e, v]) => ({
            name: JORNADA[e].rotulo,
            value: v,
            itemStyle: { color: cor(CORES[e]) },
          })),
        },
      ],
    };
  });

  protected readonly descricaoDonut = computed(() => {
    const c = this.contagem();
    return c
      ? `Hoje: ${c.naEscola} na escola, ${c.embarcados} embarcados, ${c.aguardando} aguardando, ${c.ausentes} ausentes e ${c.divergentes} divergentes`
      : 'Situação de hoje';
  });

  protected readonly tendencia = computed(() => {
    const p = this.periodo.dados();
    if (!p) {
      return {};
    }
    const media = p.frequenciaMedia;
    return {
      tooltip: { trigger: 'axis', valueFormatter: (v: number | null) => percentual(v) },
      grid: { left: 40, right: 70, top: 20, bottom: 30 },
      xAxis: eixoDeCategorias(
        p.dias.map((d) => dataCurta(d.data)),
        6,
      ),
      yAxis: { type: 'value', min: 0, max: 100, axisLabel: { formatter: '{value}%' } },
      series: [
        {
          type: 'line',
          name: 'Frequência',
          smooth: true,
          data: p.dias.map((d) => d.frequencia),
          markLine:
            media === null
              ? undefined
              : {
                  symbol: 'none',
                  data: [{ yAxis: media, name: 'Média' }],
                  label: { formatter: `Média ${percentual(media)}`, position: 'end' },
                },
        },
      ],
    };
  });

  protected readonly descricaoTendencia = computed(() => {
    const p = this.periodo.dados();
    return p
      ? `Frequência em ${p.dias.length} dias letivos de ${dataCurta(p.inicio)} a ${dataCurta(p.fim)}, média ${percentual(p.frequenciaMedia)}`
      : 'Tendência da frequência';
  });

  constructor() {
    // Ao vivo: cada sinal do servidor recarrega em silêncio (sem piscar o esqueleto).
    inject(SseService)
      .de<unknown>('presenca.atualizada')
      .pipe(auditTime(2000), takeUntilDestroyed())
      .subscribe(() => this.hoje.recarregar(true));
  }

  protected rotulo(linha: LinhaJornada): string {
    return JORNADA[linha.jornada.estado].rotulo;
  }

  protected tom(linha: LinhaJornada) {
    return JORNADA[linha.jornada.estado].tom;
  }
}
