import { FrequenciaEscola } from '../../core/api/modelos';
import { barrasPorEscola, linhasMatriculas, media } from './dashboard.graficos';

function escola(
  id: number,
  frequencia: number | null,
  faixa: FrequenciaEscola['faixa'],
): FrequenciaEscola {
  return {
    escolaId: id,
    escolaNome: `Escola Municipal Fictícia de Nome Longo ${id}`,
    esperados: 10,
    presentes: 5,
    frequencia,
    faixa,
  };
}

type Serie = {
  data: { value: number | null; itemStyle: { opacity: number } }[];
  markLine?: { data: { xAxis: number }[]; label: { formatter: string } };
};

describe('gráficos do dashboard', () => {
  const escolas = [
    escola(1, 55, 'CRITICO'),
    escola(2, 92, 'OK'),
    escola(3, null, null),
    escola(4, 70, 'ATENCAO'),
  ];

  it('média ignora escola sem esperados', () => {
    expect(media(escolas)).toBe(72.3);
  });

  it('barras ordenadas da maior para a menor, com linha de média rotulada', () => {
    const opcoes = barrasPorEscola(escolas) as { yAxis: { data: string[] }; series: Serie[] };
    expect(opcoes.yAxis.data.map((n) => n.slice(-1))).toEqual(['2', '4', '1', '3']);
    expect(opcoes.series[0].markLine!.data[0].xAxis).toBe(72.3);
    expect(opcoes.series[0].markLine!.label.formatter).toContain('Média');
  });

  it('destacar uma escola esmaece as outras', () => {
    const opcoes = barrasPorEscola(escolas, 4) as { series: Serie[] };
    expect(opcoes.series[0].data.map((d) => d.itemStyle.opacity)).toEqual([0.35, 1, 0.35, 0.35]);
  });

  it('matrículas: uma linha por ano com o atual destacado', () => {
    const opcoes = linhasMatriculas({
      agrupamento: 'ETAPA',
      anoAtual: 2026,
      porAno: { '2025': { INFANTIL: 10 }, '2026': { INFANTIL: 12, FUNDAMENTAL: 30 } },
    }) as { series: { name: string; data: number[]; lineStyle: { width: number } }[] };
    expect(opcoes.series.map((s) => s.name)).toEqual(['2025', '2026 (atual)']);
    expect(opcoes.series[0].data).toEqual([0, 10]);
    expect(opcoes.series[1].lineStyle.width).toBeGreaterThan(opcoes.series[0].lineStyle.width);
  });
});
