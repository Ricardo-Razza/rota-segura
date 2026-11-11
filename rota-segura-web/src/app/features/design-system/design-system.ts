import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TemaService } from '../../core/tema/tema.service';
import { ToastService } from '../../core/toast/toast.service';
import { Grafico } from '../../shared/graficos/grafico';
import { eixoDeCategorias, legendaComValor } from '../../shared/graficos/rotulos';
import { ChartCard, EstadoCard } from '../../shared/ui/chart-card';
import { Coluna, DataTable } from '../../shared/ui/data-table';
import { DateRangePicker, Periodo, periodoDoPreset } from '../../shared/ui/date-range-picker';
import { FilterChips, OpcaoChip } from '../../shared/ui/filter-chips';
import { KpiCard } from '../../shared/ui/kpi-card';
import { StatusBadge } from '../../shared/ui/status-badge';
import { EstadoJornada, JORNADA } from '../../shared/ui/tom';

interface LinhaDemo {
  escola: string;
  alunos: number;
  frequencia: number | null;
}

/** Vitrine dos componentes do design system. Todos os dados aqui são fictícios. */
@Component({
  selector: 'rs-design-system',
  imports: [KpiCard, ChartCard, StatusBadge, DataTable, DateRangePicker, FilterChips, Grafico],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="pagina">
      <header class="cabecalho">
        <h1>Design system</h1>
        <button type="button" class="rs-botao" (click)="tema.alternar()">
          Tema {{ tema.tema() === 'escuro' ? 'claro' : 'escuro' }}
        </button>
      </header>
      <p class="nota">Dados fictícios, só para demonstrar os componentes.</p>

      <h2>kpi-card</h2>
      <div class="grade grade--kpi">
        <rs-kpi-card rotulo="Alunos ativos" [valor]="1284" tom="info" detalhe="Exemplo com link" link="/design-system" />
        <rs-kpi-card rotulo="Frequência de hoje" valor="91,4%" tom="sucesso" />
        <rs-kpi-card rotulo="Alertas abertos" [valor]="3" tom="critico" />
        <rs-kpi-card rotulo="Sem dado" [valor]="null" />
        <rs-kpi-card rotulo="Carregando" [carregando]="true" tom="atencao" />
      </div>

      <h2>chart-card — quatro estados</h2>
      <rs-filter-chips rotulo="Estado do card" [opcoes]="estados" [(selecionados)]="estadoEscolhido" />
      <div class="grade grade--cards">
        <rs-chart-card
          titulo="Frequência por escola"
          [estado]="estado()"
          [atualizadoEm]="atualizadoEm"
          [tempoLimiteMs]="6000"
          (tentarDeNovo)="toasts.mostrar('Tentando de novo…')"
        >
          <rs-grafico [opcoes]="barras" descricao="Frequência por escola, com linha de média de 81%" />
        </rs-chart-card>
        <rs-chart-card titulo="Jornada de hoje" estado="ok">
          <rs-grafico [opcoes]="donut" descricao="Distribuição dos alunos por estado da jornada" />
        </rs-chart-card>
      </div>

      <h2>status-badge</h2>
      <div class="linha">
        @for (item of jornada; track item.rotulo) {
          <rs-status-badge [texto]="item.rotulo" [tom]="item.tom" />
        }
      </div>

      <h2>date-range-picker</h2>
      <rs-date-range-picker [(periodo)]="periodo" />
      <p class="nota">Selecionado: {{ periodo().inicio }} a {{ periodo().fim }} ({{ periodo().preset }})</p>

      <h2>data-table</h2>
      <rs-data-table [colunas]="colunas" [linhas]="linhas" legenda="Frequência por escola (exemplo)" />

      <h2>toasts</h2>
      <div class="linha">
        <button type="button" class="rs-botao" (click)="toasts.mostrar('Sincronização concluída.', 'sucesso')">Sucesso</button>
        <button type="button" class="rs-botao" (click)="toasts.erro('A fonte de dados está indisponível.')">Erro</button>
        <button
          type="button"
          class="rs-botao"
          (click)="toasts.mostrar('Alerta crítico de exemplo.', 'critico', { persistente: true })"
        >
          Crítico persistente
        </button>
      </div>
    </main>
  `,
  styles: `
    .pagina {
      max-width: 1180px;
      margin: 0 auto;
      padding: 24px 20px 80px;
    }
    .cabecalho {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    h1 {
      font-size: 24px;
    }
    h2 {
      margin: 28px 0 10px;
      font-size: 13px;
      color: var(--texto-suave);
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .nota {
      color: var(--texto-suave);
    }
    .grade {
      display: grid;
      gap: 12px;
    }
    .grade--kpi {
      grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
    }
    .grade--cards {
      grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
      margin-top: 12px;
    }
    .linha {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
  `,
})
export class DesignSystem {
  protected readonly tema = inject(TemaService);
  protected readonly toasts = inject(ToastService);

  protected readonly estados: OpcaoChip[] = [
    { valor: 'ok', rotulo: 'Com dados' },
    { valor: 'carregando', rotulo: 'Carregando (vira erro em 6 s)' },
    { valor: 'vazio', rotulo: 'Vazio' },
    { valor: 'erro', rotulo: 'Erro' },
    { valor: 'desatualizado', rotulo: 'Desatualizado' },
  ];
  protected readonly estadoEscolhido = signal<string[]>(['ok']);
  protected readonly estado = computed(() => (this.estadoEscolhido()[0] ?? 'ok') as EstadoCard);
  protected readonly atualizadoEm = new Date(2026, 0, 15, 7, 42);

  protected readonly periodo = signal<Periodo>(periodoDoPreset('7dias'));
  protected readonly jornada = (Object.keys(JORNADA) as EstadoJornada[]).map((estado) => JORNADA[estado]);

  protected readonly linhas: LinhaDemo[] = [
    { escola: 'Escola Municipal Exemplo do Vale Verde', alunos: 412, frequencia: 93.1 },
    { escola: 'Escola Fictícia Professora Modelo', alunos: 365, frequencia: 78.4 },
    { escola: 'Centro Educacional Demonstração', alunos: 298, frequencia: 54.9 },
    { escola: 'Escola Rural Amostra', alunos: 209, frequencia: null },
  ];
  protected readonly colunas: Coluna<LinhaDemo>[] = [
    { chave: 'escola', titulo: 'Escola', valor: (l) => l.escola },
    { chave: 'alunos', titulo: 'Alunos', valor: (l) => l.alunos, alinhar: 'direita' },
    { chave: 'frequencia', titulo: 'Frequência %', valor: (l) => l.frequencia, alinhar: 'direita' },
  ];

  private readonly comFrequencia = this.linhas.filter((l) => l.frequencia !== null);
  private readonly media = 81;

  protected readonly barras: Record<string, unknown> = {
    grid: { left: 8, right: 56, top: 24, bottom: 8, containLabel: true },
    tooltip: { trigger: 'axis' },
    xAxis: eixoDeCategorias(this.comFrequencia.map((l) => l.escola), 16),
    yAxis: { type: 'value', max: 100, axisLabel: { formatter: '{value}%' } },
    series: [
      {
        type: 'bar',
        name: 'Frequência',
        data: this.comFrequencia.map((l) => l.frequencia),
        markLine: {
          symbol: 'none',
          data: [{ yAxis: this.media }],
          label: { formatter: `Média ${this.media}%`, position: 'end' },
        },
      },
    ],
  };

  private readonly fatias = [
    { name: 'Na escola', value: 846 },
    { name: 'Embarcado', value: 212 },
    { name: 'Aguardando', value: 171 },
    { name: 'Ausente', value: 55 },
  ];
  private readonly totalFatias = this.fatias.reduce((soma, f) => soma + f.value, 0);

  protected readonly donut: Record<string, unknown> = {
    tooltip: { trigger: 'item' },
    legend: {
      orient: 'vertical',
      right: 0,
      top: 'middle',
      formatter: (nome: string) =>
        legendaComValor(nome, this.fatias.find((f) => f.name === nome)?.value ?? 0, this.totalFatias),
    },
    series: [
      {
        type: 'pie',
        radius: ['48%', '72%'],
        center: ['28%', '50%'],
        label: { show: false },
        data: this.fatias,
      },
    ],
  };
}
