import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { convertToParamMap, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AnaliseFrota, GrupoFrequencia } from '../../core/api/modelos';
import { Grafico } from '../../shared/graficos/grafico';
import { AbaFrota } from './aba-frota';
import { Analises } from './analises';
import {
  contarFiltros,
  filtroDaUrl,
  paraApi,
  paraUrl,
  periodoDoPreset,
  rotuloTipoAlerta,
} from './analises.filtro';
import {
  barrasFaltasPorDia,
  barrasVariacao,
  diaQueMaisFalta,
  rotuloGrupo,
  variacao,
} from './analises.graficos';

// Dados fictícios.
const HOJE = new Date(2026, 2, 13); // sexta, 13/03/2026

function url(texto: string) {
  return convertToParamMap(Object.fromEntries(new URLSearchParams(texto)));
}

function grupo(
  chave: string,
  frequencia: number | null,
  variacaoPp: number | null,
): GrupoFrequencia {
  return {
    chave,
    rotulo: `Escola Fictícia ${chave}`,
    esperados: 100,
    presentes: frequencia ?? 0,
    frequencia,
    anterior: frequencia === null || variacaoPp === null ? null : frequencia - variacaoPp,
    variacao: variacaoPp,
    faixa:
      frequencia === null
        ? null
        : frequencia < 60
          ? 'CRITICO'
          : frequencia <= 85
            ? 'ATENCAO'
            : 'OK',
  };
}

describe('filtro das análises', () => {
  it('sem nada na URL: últimos 30 dias comparando com o período anterior', () => {
    const f = filtroDaUrl(url(''), HOJE);
    expect(f).toMatchObject({
      preset: '30dias',
      inicio: '2026-02-12',
      fim: '2026-03-13',
      comparar: 'PERIODO_ANTERIOR',
      escolas: [],
    });
    expect(contarFiltros(f)).toBe(0);
  });

  it('ignora valores inválidos e período acima de 366 dias', () => {
    const f = filtroDaUrl(
      url(
        'periodo=personalizado&inicio=2024-01-01&fim=2026-03-13&comparar=X&escolas=1,a,1,2&turmaId=x',
      ),
      HOJE,
    );
    expect(f.preset).toBe('30dias');
    expect(f.comparar).toBe('PERIODO_ANTERIOR');
    expect(f.escolas).toEqual([1, 2]);
    expect(f.turmaId).toBeNull();
  });

  it('a escola do filtro global vira a lista de escolas', () => {
    expect(filtroDaUrl(url('escolaId=50'), HOJE).escolas).toEqual([50]);
    expect(filtroDaUrl(url('escolaId=50&escolas=60,70'), HOJE).escolas).toEqual([60, 70]);
  });

  it('ano letivo passado vai de janeiro a dezembro', () => {
    expect(periodoDoPreset('ano', HOJE, 2025)).toEqual({ inicio: '2025-01-01', fim: '2025-12-31' });
    expect(periodoDoPreset('ano', HOJE)).toEqual({ inicio: '2026-01-01', fim: '2026-03-13' });
  });

  it('ida e volta pela URL preserva o filtro; o ônibus só vai para a aba de frota', () => {
    const original = filtroDaUrl(
      url(
        'periodo=personalizado&inicio=2026-03-01&fim=2026-03-10&comparar=ANO_ANTERIOR&escolas=5&etapa=INFANTIL&veiculoId=7',
      ),
      HOJE,
    );
    const gravado = paraUrl(original);
    expect(gravado['escolaId']).toBeNull();
    const relido = filtroDaUrl(
      url(
        new URLSearchParams(
          Object.entries(gravado).filter(([, v]) => v !== null) as [string, string][],
        ).toString(),
      ),
      HOJE,
    );
    expect(relido).toEqual(original);
    expect(paraApi(relido, 'frequencia')['veiculoId']).toBeNull();
    expect(paraApi(relido, 'frota')).toMatchObject({
      veiculoId: 7,
      escolaIds: '5',
      comparar: 'ANO_ANTERIOR',
    });
    expect(contarFiltros(relido)).toBe(3);
  });

  it('tipo de alerta sempre com rótulo legível', () => {
    expect(rotuloTipoAlerta('EMBARCOU_SEM_CHEGADA')).toBe('Embarcou e não chegou');
    expect(rotuloTipoAlerta('NOVO_TIPO')).toBe('novo tipo');
  });
});

describe('gráficos das análises', () => {
  it('variação com sinal, unidade e tom pelo sentido do indicador', () => {
    expect(variacao(2.3, 'pp')).toEqual({ texto: '+2,3 p.p.', tom: 'sucesso', sobe: true });
    expect(variacao(-4, '%')).toEqual({ texto: '−4%', tom: 'critico', sobe: false });
    expect(variacao(3, 'min', false)?.tom).toBe('critico');
    expect(variacao(null, 'pp')).toBeNull();
  });

  it('rótulo do grupo depende da granularidade', () => {
    expect(rotuloGrupo('2026-03-09', 'DIA')).toBe('09/03');
    expect(rotuloGrupo('2026-03-09', 'SEMANA')).toBe('sem 09/03');
    expect(rotuloGrupo('2026-03-01', 'MES')).toBe('mar/26');
  });

  it('quem mais mudou: maiores variações, de quem subiu para quem caiu', () => {
    const opcoes = barrasVariacao(
      [grupo('1', 90, 1), grupo('2', 70, -7), grupo('3', 80, null), grupo('4', 95, 5)],
      2,
    ) as { yAxis: { data: string[] }; series: { data: { value: number }[] }[] };
    expect(opcoes.yAxis.data).toEqual(['Escola Fictícia 4', 'Escola Fictícia 2']);
    expect(opcoes.series[0].data.map((d) => d.value)).toEqual([5, -7]);
  });

  it('faltas por dia: barra mais escura onde mais se falta e frase gerada dos números', () => {
    const dias = [
      { ...grupo('MONDAY', 80, null), rotulo: 'Seg' },
      { ...grupo('WEDNESDAY', 95, null), rotulo: 'Qua' },
    ];
    const opcoes = barrasFaltasPorDia(dias) as {
      series: { data: { value: number; itemStyle: { opacity: number } }[] }[];
    };
    expect(opcoes.series[0].data.map((d) => d.value)).toEqual([20, 5]);
    expect(opcoes.series[0].data[0].itemStyle.opacity).toBe(1);
    expect(diaQueMaisFalta(dias)).toBe('Seg concentra mais faltas: 20% contra 5% na qua.');
  });
});

@Component({ selector: 'rs-grafico', template: '' })
class GraficoFalso {
  readonly opcoes = input<unknown>();
  readonly descricao = input('');
  readonly altura = input(0);
}

function frota(): AnaliseFrota {
  const ind = (atual: number | null) => ({ atual, anterior: null, variacao: null });
  return {
    periodo: { inicio: '2026-03-09', fim: '2026-03-13' },
    referencia: null,
    granularidade: 'DIA',
    janelaMin: 40,
    embarques: ind(7),
    viagens: ind(5),
    tempoMedioMin: ind(25.8),
    noPrazo: ind(100),
    serie: [
      {
        inicio: '2026-03-09',
        embarques: 7,
        tempoMedioMin: 25.8,
        noPrazo: 100,
        alertas: 1,
        criticos: 1,
      },
    ],
    serieReferencia: [],
    veiculos: [
      {
        id: 7,
        placa: 'AAA0A07',
        prefixo: 'P-07',
        viagens: 5,
        embarques: 7,
        semChegada: 1,
        tempoMedioMin: 25.8,
        noPrazo: 100,
        alertas: 1,
      },
    ],
    alertas: {
      total: ind(1),
      abertos: 1,
      porSeveridade: { CRITICO: 1, ATENCAO: 0, INFO: 0 },
      porTipo: { EMBARCOU_SEM_CHEGADA: 1 },
      tempoMedioResolucaoMin: null,
    },
    desatualizado: false,
    incompleto: false,
  };
}

describe('tela de Análises', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'analises', component: Analises }]),
      ],
    });
    TestBed.overrideComponent(AbaFrota, {
      remove: { imports: [Grafico] },
      add: { imports: [GraficoFalso] },
    });
    http = TestBed.inject(HttpTestingController);
  });

  it('lê a aba e os filtros da URL, busca só a aba aberta e mostra os ônibus', async () => {
    const harness = await RouterTestingHarness.create(
      '/analises?aba=frota&periodo=personalizado&inicio=2026-03-09&fim=2026-03-13&escolas=50&veiculoId=7',
    );

    const pedido = http.expectOne((r) => r.url.endsWith('/analises/frota'));
    expect(pedido.request.params.get('dataInicio')).toBe('2026-03-09');
    expect(pedido.request.params.get('escolaIds')).toBe('50');
    expect(pedido.request.params.get('veiculoId')).toBe('7');
    http.expectNone((r) => r.url.includes('/analises/frequencia'));
    http
      .expectOne((r) => r.url.endsWith('/cadastro/opcoes-filtro'))
      .flush({
        anoLetivo: 2026,
        escolas: [{ id: 50, nome: 'Escola Fictícia 50' }],
        anosEscolares: [],
        turmas: [],
        etapas: [],
        turnos: [],
        desatualizado: false,
      });
    http
      .expectOne((r) => r.url.endsWith('/veiculos/status'))
      .flush({
        avaliadoEm: '2026-03-13T15:00:00',
        porEstado: {},
        veiculos: [{ id: 7, placa: 'AAA0A07', prefixo: 'P-07' }],
        desatualizado: false,
        incompleto: false,
      });
    pedido.flush(frota());
    await harness.fixture.whenStable();

    const tela = harness.routeNativeElement!;
    expect(tela.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toContain(
      'Frota e alertas',
    );
    const chips = [...tela.querySelectorAll('.rs-chip')].map((c) => c.textContent?.trim());
    expect(chips).toContain('Escola Fictícia 50');
    expect(chips).toContain('AAA0A07 · P-07');
    expect(tela.querySelector('.contador')?.textContent?.trim()).toBe('2');
    expect(tela.querySelector('tbody th')?.textContent).toContain('AAA0A07');
    expect(tela.textContent).toContain('chegaram em até 40 min');
    http.verify();
  });
});
