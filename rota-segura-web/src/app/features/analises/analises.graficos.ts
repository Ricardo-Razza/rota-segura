import {
  AnaliseFrequencia,
  AnaliseFrota,
  AnaliseMatriculas,
  Comparativo,
  Granularidade,
  GrupoFrequencia,
} from '../../core/api/modelos';
import { abreviarRotulo, eixoDeCategorias } from '../../shared/graficos/rotulos';
import { percentual } from '../../shared/formato';
import { Tom } from '../../shared/ui/tom';
import { cor } from '../dashboard/dashboard.graficos';
import { rotuloTipoAlerta } from './analises.filtro';

type Opcoes = Record<string, unknown>;

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** Rótulo do grupo da série: "09/03" por dia, "sem 09/03" por semana, "mar/26" por mês. */
export function rotuloGrupo(inicio: string, g: Granularidade): string {
  const [ano, mes, dia] = inicio.split('-');
  if (g === 'MES') {
    return `${MESES[Number(mes) - 1]}/${ano.slice(2)}`;
  }
  return g === 'SEMANA' ? `sem ${dia}/${mes}` : `${dia}/${mes}`;
}

export type Unidade = 'pp' | '%' | 'min';

/**
 * Variação formatada e o tom dela. `maiorEhMelhor` diz o sentido: frequência subir é bom,
 * alunos em risco ou tempo de trajeto subir é ruim. Variação nula (sem base) não vira zero.
 */
export function variacao(
  valor: number | null | undefined,
  unidade: Unidade,
  maiorEhMelhor = true,
): { texto: string; tom: Tom; sobe: boolean } | null {
  if (valor === null || valor === undefined) {
    return null;
  }
  const sufixo = unidade === 'pp' ? ' p.p.' : unidade === 'min' ? ' min' : '%';
  const numero = Math.abs(valor).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  const sobe = valor > 0;
  const tom: Tom = valor === 0 ? 'neutro' : sobe === maiorEhMelhor ? 'sucesso' : 'critico';
  return { texto: `${valor > 0 ? '+' : valor < 0 ? '−' : ''}${numero}${sufixo}`, tom, sobe };
}

function tooltipEixo(): Opcoes {
  return { trigger: 'axis', axisPointer: { type: 'line' } };
}

/** Linha da frequência no período, com o período de comparação tracejado por baixo. */
export function linhaEvolucao(a: AnaliseFrequencia): Opcoes {
  const rotulos = a.serie.map((p) => rotuloGrupo(p.inicio, a.granularidade));
  const valores = [...a.serie, ...a.serieReferencia]
    .map((p) => p.frequencia)
    .filter((v): v is number => v !== null);
  const minimo = valores.length ? Math.max(0, Math.floor((Math.min(...valores) - 5) / 5) * 5) : 0;
  const series: Opcoes[] = [
    {
      name: 'Período',
      type: 'line',
      smooth: 0.3,
      connectNulls: true,
      symbolSize: 6,
      data: a.serie.map((p) => p.frequencia),
      lineStyle: { width: 3, color: cor('--sucesso') },
      itemStyle: { color: cor('--sucesso') },
      areaStyle: { color: cor('--sucesso'), opacity: 0.12 },
      z: 3,
    },
  ];
  if (a.serieReferencia.length) {
    series.push({
      name: 'Comparação',
      type: 'line',
      smooth: 0.3,
      connectNulls: true,
      symbol: 'none',
      data: a.serie.map((_, i) => a.serieReferencia[i]?.frequencia ?? null),
      lineStyle: { width: 2, type: 'dashed', color: cor('--texto-mudo') },
      itemStyle: { color: cor('--texto-mudo') },
    });
  }
  return {
    tooltip: {
      ...tooltipEixo(),
      valueFormatter: (v: number | null) => percentual(v),
    },
    legend: { top: 0, right: 0, data: series.map((s) => s['name'] as string) },
    grid: { left: 44, right: 16, top: 34, bottom: 28 },
    xAxis: { ...eixoDeCategorias(rotulos, 10), boundaryGap: false },
    yAxis: { type: 'value', min: minimo, max: 100, axisLabel: { formatter: '{value}%' } },
    series,
  };
}

/** Quem mais mudou: barras divergentes da variação em p.p. (verde subiu, vermelho caiu). */
export function barrasVariacao(grupos: GrupoFrequencia[], maximo = 8): Opcoes {
  const comVariacao = grupos
    .filter((g) => g.variacao !== null)
    .sort((a, b) => Math.abs(b.variacao!) - Math.abs(a.variacao!))
    .slice(0, maximo)
    .sort((a, b) => b.variacao! - a.variacao!);
  return {
    tooltip: {
      trigger: 'item',
      formatter: (p: { dataIndex: number }) => {
        const g = comVariacao[p.dataIndex];
        return `${g.rotulo}<br/>${percentual(g.anterior)} → ${percentual(g.frequencia)} (${variacao(g.variacao, 'pp')?.texto})`;
      },
    },
    grid: { left: 130, right: 56, top: 8, bottom: 8 },
    xAxis: { type: 'value', show: false },
    yAxis: {
      ...eixoDeCategorias(
        comVariacao.map((g) => g.rotulo),
        18,
      ),
      inverse: true,
      axisTick: { show: false },
    },
    series: [
      {
        type: 'bar',
        barWidth: 12,
        data: comVariacao.map((g) => ({
          value: g.variacao,
          itemStyle: {
            color: cor(g.variacao! >= 0 ? '--sucesso' : '--critico'),
            borderRadius: g.variacao! >= 0 ? [0, 6, 6, 0] : [6, 0, 0, 6],
          },
        })),
        label: {
          show: true,
          position: 'right',
          formatter: (p: { value: number }) => variacao(p.value, 'pp')?.texto ?? '',
          color: cor('--texto-suave'),
        },
      },
    ],
  };
}

/** Faltas por dia da semana (100 − frequência): mostra onde as ausências se concentram. */
export function barrasFaltasPorDia(grupos: GrupoFrequencia[]): Opcoes {
  const faltas = grupos.map((g) =>
    g.frequencia === null ? null : Math.round((100 - g.frequencia) * 10) / 10,
  );
  const maior = Math.max(0, ...faltas.filter((v): v is number => v !== null));
  return {
    tooltip: {
      trigger: 'item',
      formatter: (p: { dataIndex: number }) => {
        const g = grupos[p.dataIndex];
        return `${g.rotulo}<br/>${percentual(faltas[p.dataIndex])} de faltas (${g.esperados - g.presentes} de ${g.esperados})`;
      },
    },
    grid: { left: 36, right: 12, top: 24, bottom: 28 },
    xAxis: eixoDeCategorias(
      grupos.map((g) => g.rotulo),
      6,
    ),
    yAxis: { type: 'value', min: 0, axisLabel: { formatter: '{value}%' } },
    series: [
      {
        type: 'bar',
        barWidth: '55%',
        data: faltas.map((v) => ({
          value: v,
          itemStyle: {
            color: cor('--critico'),
            opacity: v === null || maior === 0 ? 0.3 : 0.35 + 0.65 * (v / maior),
            borderRadius: [6, 6, 0, 0],
          },
        })),
        label: {
          show: true,
          position: 'top',
          formatter: (p: { value: number | null }) => percentual(p.value),
        },
      },
    ],
  };
}

/** Frase de leitura do gráfico de faltas, gerada dos números. */
export function diaQueMaisFalta(grupos: GrupoFrequencia[]): string | null {
  const validos = grupos.filter((g) => g.frequencia !== null && g.esperados > 0);
  if (validos.length < 2) {
    return null;
  }
  const pior = validos.reduce((a, b) => (b.frequencia! < a.frequencia! ? b : a));
  const melhor = validos.reduce((a, b) => (b.frequencia! > a.frequencia! ? b : a));
  if (pior.frequencia === melhor.frequencia) {
    return null;
  }
  return `${pior.rotulo} concentra mais faltas: ${percentual(100 - pior.frequencia!)} contra ${percentual(100 - melhor.frequencia!)} na ${melhor.rotulo.toLowerCase()}.`;
}

/** Frequência por grupo (turno, etapa) em barras horizontais coloridas pela faixa. */
export function barrasFrequencia(grupos: GrupoFrequencia[]): Opcoes {
  const token = (g: GrupoFrequencia) =>
    g.faixa === 'OK'
      ? '--sucesso'
      : g.faixa === 'ATENCAO'
        ? '--atencao'
        : g.faixa === 'CRITICO'
          ? '--critico'
          : '--texto-mudo';
  return {
    tooltip: {
      trigger: 'item',
      formatter: (p: { dataIndex: number }) => {
        const g = grupos[p.dataIndex];
        return `${g.rotulo}<br/>${percentual(g.frequencia)} (${g.presentes} de ${g.esperados})`;
      },
    },
    grid: { left: 96, right: 52, top: 8, bottom: 8 },
    xAxis: { type: 'value', min: 0, max: 100, show: false },
    yAxis: {
      ...eixoDeCategorias(
        grupos.map((g) => g.rotulo),
        12,
      ),
      inverse: true,
      axisTick: { show: false },
    },
    series: [
      {
        type: 'bar',
        barWidth: 14,
        data: grupos.map((g) => ({
          value: g.frequencia,
          itemStyle: { color: cor(token(g)), borderRadius: [0, 6, 6, 0] },
        })),
        label: {
          show: true,
          position: 'right',
          formatter: (p: { value: number | null }) => percentual(p.value),
        },
      },
    ],
  };
}

const PALETA = [
  '--rs-azul-300',
  '--rs-verde-300',
  '--rs-teal-500',
  '--rs-amarelo-400',
  '--rs-azul-500',
  '--rs-verde-500',
];

/** Matrículas por ano letivo, empilhadas por etapa (ou ano escolar), com o total no topo. */
export function barrasMatriculas(m: AnaliseMatriculas): Opcoes {
  const anos = m.porAno.map((a) => String(a.ano));
  const grupos = [...new Set(m.porAno.flatMap((a) => Object.keys(a.porGrupo)))].sort((a, b) =>
    a.localeCompare(b, 'pt-BR', { numeric: true }),
  );
  const series: Opcoes[] = grupos.map((g, i) => ({
    name: g,
    type: 'bar',
    stack: 'total',
    barWidth: '46%',
    data: m.porAno.map((a) => a.porGrupo[g] ?? 0),
    itemStyle: { color: cor(PALETA[i % PALETA.length]) || cor('--info') },
  }));
  series.push({
    name: 'Total',
    type: 'bar',
    stack: 'total',
    data: m.porAno.map(() => 0),
    label: {
      show: true,
      position: 'top',
      color: cor('--texto'),
      fontWeight: 700,
      formatter: (p: { dataIndex: number }) => m.porAno[p.dataIndex].total.toLocaleString('pt-BR'),
    },
    tooltip: { show: false },
  });
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { top: 0, data: grupos },
    grid: { left: 44, right: 12, top: grupos.length > 4 ? 56 : 34, bottom: 28 },
    xAxis: { type: 'category', data: anos },
    yAxis: { type: 'value', minInterval: 1 },
    series,
  };
}

/** Atual × anterior por categoria (ano escolar, turno), barras lado a lado. */
export function barrasComparativo(
  itens: Comparativo[],
  anoAtual: number,
  maximoRotulo = 10,
): Opcoes {
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { top: 0, data: [String(anoAtual - 1), String(anoAtual)] },
    grid: { left: 40, right: 12, top: 34, bottom: 28 },
    xAxis: eixoDeCategorias(
      itens.map((c) => c.rotulo),
      maximoRotulo,
    ),
    yAxis: { type: 'value', minInterval: 1 },
    series: [
      {
        name: String(anoAtual - 1),
        type: 'bar',
        data: itens.map((c) => c.anterior),
        itemStyle: { color: cor('--texto-mudo'), opacity: 0.55, borderRadius: [4, 4, 0, 0] },
      },
      {
        name: String(anoAtual),
        type: 'bar',
        data: itens.map((c) => c.atual),
        itemStyle: { color: cor('--info'), borderRadius: [4, 4, 0, 0] },
      },
    ],
  };
}

/** Embarques por grupo (barras) e tempo médio de trajeto (linha no eixo da direita). */
export function graficoViagens(f: AnaliseFrota): Opcoes {
  const rotulos = f.serie.map((p) => rotuloGrupo(p.inicio, f.granularidade));
  const series: Opcoes[] = [
    {
      name: 'Embarques',
      type: 'bar',
      barMaxWidth: 28,
      data: f.serie.map((p) => p.embarques),
      itemStyle: { color: cor('--info'), borderRadius: [5, 5, 0, 0] },
    },
    {
      name: 'Tempo médio',
      type: 'line',
      yAxisIndex: 1,
      smooth: 0.3,
      connectNulls: true,
      data: f.serie.map((p) => p.tempoMedioMin),
      lineStyle: { width: 3, color: cor('--atencao') },
      itemStyle: { color: cor('--atencao') },
      tooltip: { valueFormatter: (v: number | null) => (v === null ? '—' : `${v} min`) },
    },
  ];
  if (f.serieReferencia.length) {
    series.push({
      name: 'Embarques (comparação)',
      type: 'line',
      symbol: 'none',
      data: f.serie.map((_, i) => f.serieReferencia[i]?.embarques ?? null),
      lineStyle: { width: 2, type: 'dashed', color: cor('--texto-mudo') },
      itemStyle: { color: cor('--texto-mudo') },
    });
  }
  return {
    tooltip: tooltipEixo(),
    legend: { top: 0, data: series.map((s) => s['name'] as string) },
    grid: { left: 44, right: 44, top: 36, bottom: 28 },
    xAxis: eixoDeCategorias(rotulos, 10),
    yAxis: [
      { type: 'value', minInterval: 1 },
      { type: 'value', axisLabel: { formatter: '{value} min' }, splitLine: { show: false } },
    ],
    series,
  };
}

/** Alertas abertos em cada grupo: críticos em vermelho, os demais em âmbar, empilhados. */
export function barrasAlertas(f: AnaliseFrota): Opcoes {
  const rotulos = f.serie.map((p) => rotuloGrupo(p.inicio, f.granularidade));
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { top: 0, data: ['Críticos', 'Outros'] },
    grid: { left: 36, right: 12, top: 34, bottom: 28 },
    xAxis: eixoDeCategorias(rotulos, 10),
    yAxis: { type: 'value', minInterval: 1 },
    series: [
      {
        name: 'Críticos',
        type: 'bar',
        stack: 'a',
        barMaxWidth: 24,
        data: f.serie.map((p) => p.criticos),
        itemStyle: { color: cor('--critico') },
      },
      {
        name: 'Outros',
        type: 'bar',
        stack: 'a',
        data: f.serie.map((p) => p.alertas - p.criticos),
        itemStyle: { color: cor('--atencao'), borderRadius: [4, 4, 0, 0] },
      },
    ],
  };
}

/** Alertas por tipo (rótulo legível, nunca o código cru). */
export function barrasTipos(porTipo: Record<string, number>): Opcoes {
  const tipos = Object.entries(porTipo).sort((a, b) => b[1] - a[1]);
  return {
    tooltip: { trigger: 'item' },
    grid: { left: 150, right: 40, top: 8, bottom: 8 },
    xAxis: { type: 'value', show: false, minInterval: 1 },
    yAxis: {
      ...eixoDeCategorias(
        tipos.map(([t]) => rotuloTipoAlerta(t)),
        22,
      ),
      inverse: true,
      axisTick: { show: false },
    },
    series: [
      {
        type: 'bar',
        barWidth: 12,
        data: tipos.map(([, n]) => n),
        itemStyle: { color: cor('--atencao'), borderRadius: [0, 6, 6, 0] },
        label: { show: true, position: 'right' },
      },
    ],
  };
}

export { abreviarRotulo };
