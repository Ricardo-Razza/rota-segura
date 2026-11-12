import { FaixaFrequencia, FrequenciaEscola, ResumoDashboard } from '../../core/api/modelos';
import { abreviarRotulo, eixoDeCategorias } from '../../shared/graficos/rotulos';
import { percentual } from '../../shared/formato';

const TOKEN_FAIXA: Record<FaixaFrequencia, string> = {
  OK: '--sucesso',
  ATENCAO: '--atencao',
  CRITICO: '--critico',
};

export function cor(token: string): string {
  if (typeof document === 'undefined') {
    return '#888';
  }
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim() || '#888';
}

/** Média simples das frequências que existem (escola sem esperados não entra). */
export function media(escolas: FrequenciaEscola[]): number | null {
  const valores = escolas.map((e) => e.frequencia).filter((v): v is number => v !== null);
  if (valores.length === 0) {
    return null;
  }
  return Math.round((valores.reduce((s, v) => s + v, 0) / valores.length) * 10) / 10;
}

function nomeEscola(e: FrequenciaEscola): string {
  return e.escolaNome || `Escola #${e.escolaId}`;
}

/**
 * Barras horizontais ordenadas (pior em cima), cor pela faixa (< 60 crítico, 60–85 atenção, > 85 ok)
 * e linha de média rotulada. Os rótulos longos são abreviados com o nome inteiro no tooltip.
 */
export function barrasPorEscola(
  escolas: FrequenciaEscola[],
  destaque: number | null = null,
): Record<string, unknown> {
  const ordenadas = [...escolas].sort((a, b) => (b.frequencia ?? -1) - (a.frequencia ?? -1));
  const m = media(ordenadas);
  return {
    tooltip: {
      trigger: 'item',
      formatter: (p: { dataIndex: number }) => {
        const e = ordenadas[p.dataIndex];
        return `${nomeEscola(e)}<br/>${percentual(e.frequencia)} (${e.presentes} de ${e.esperados})`;
      },
    },
    // Topo reservado para o rótulo da média, que fica acima das barras e nunca sobre o valor de uma delas.
    grid: { left: 130, right: 60, top: 34, bottom: 24 },
    xAxis: { type: 'value', min: 0, max: 100, axisLabel: { formatter: '{value}%' } },
    yAxis: { ...eixoDeCategorias(ordenadas.map(nomeEscola), 18), inverse: true },
    series: [
      {
        type: 'bar',
        data: ordenadas.map((e) => ({
          value: e.frequencia,
          itemStyle: {
            color: e.faixa ? cor(TOKEN_FAIXA[e.faixa]) : cor('--texto-mudo'),
            opacity: destaque === null || destaque === e.escolaId ? 1 : 0.35,
          },
        })),
        label: {
          show: true,
          position: 'right',
          formatter: (p: { value: number | null }) => percentual(p.value),
        },
        markLine:
          m === null
            ? undefined
            : {
                symbol: 'none',
                data: [{ xAxis: m }],
                label: {
                  formatter: `Média ${percentual(m)}`,
                  // Eixo Y invertido: o "início" da linha é o topo do gráfico.
                  position: 'start',
                  distance: 6,
                  color: cor('--texto'),
                },
                lineStyle: { type: 'dashed' },
              },
      },
    ],
  };
}

/** Matrículas por etapa (ou ano escolar), uma linha por ano letivo, com o ano atual destacado. */
export function linhasMatriculas(m: ResumoDashboard['matriculas']): Record<string, unknown> {
  const anos = Object.keys(m.porAno).sort();
  const categorias = [...new Set(anos.flatMap((a) => Object.keys(m.porAno[a])))].sort((a, b) =>
    a.localeCompare(b, 'pt-BR', { numeric: true }),
  );
  return {
    tooltip: { trigger: 'axis' },
    legend: { top: 0 },
    grid: { left: 40, right: 20, top: 30, bottom: 40 },
    xAxis: eixoDeCategorias(categorias, 10),
    yAxis: { type: 'value', minInterval: 1 },
    series: anos.map((ano) => {
      const atual = Number(ano) === m.anoAtual;
      return {
        type: 'line',
        name: atual ? `${ano} (atual)` : ano,
        data: categorias.map((c) => m.porAno[ano][c] ?? 0),
        lineStyle: { width: atual ? 4 : 1.5, opacity: atual ? 1 : 0.6 },
        symbolSize: atual ? 8 : 4,
        z: atual ? 10 : 1,
        label: { show: atual, position: 'top' },
      };
    }),
  };
}

export function barrasPorEtapa(
  etapas: ResumoDashboard['frequenciaPorEtapa'],
): Record<string, unknown> {
  return {
    tooltip: {
      trigger: 'item',
      formatter: (p: { dataIndex: number }) => {
        const e = etapas[p.dataIndex];
        return `${e.etapa}<br/>${percentual(e.frequencia)} (${e.presentes} de ${e.esperados})`;
      },
    },
    grid: { left: 40, right: 20, top: 20, bottom: 30 },
    xAxis: eixoDeCategorias(
      etapas.map((e) => e.etapa),
      12,
    ),
    yAxis: { type: 'value', min: 0, max: 100, axisLabel: { formatter: '{value}%' } },
    series: [
      {
        type: 'bar',
        data: etapas.map((e) => e.frequencia),
        itemStyle: { color: cor('--marca-secundaria') },
        label: {
          show: true,
          position: 'top',
          formatter: (p: { value: number | null }) => percentual(p.value),
        },
      },
    ],
  };
}

export { abreviarRotulo };
