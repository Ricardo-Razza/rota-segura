import { abreviarRotulo, eixoDeCategorias, legendaComValor } from './rotulos';
import { TokensDeTema, corDaFrequencia, lerTokens, temaEcharts } from './tema-echarts';

const TOKENS: TokensDeTema = {
  fundo: '#0b1220',
  superficie: '#111a2e',
  borda: '#1e2a44',
  texto: '#e6eaf2',
  textoSuave: '#9aa7bd',
  sucesso: '#22c55e',
  atencao: '#f59e0b',
  critico: '#ef4444',
  info: '#3b82f6',
};

describe('rótulos de gráfico', () => {
  it('abrevia nomes longos com reticências e preserva os curtos', () => {
    expect(abreviarRotulo('Escola Municipal Exemplo do Vale Verde', 16)).toBe('Escola Municipa…');
    expect(abreviarRotulo('Escola A', 16)).toBe('Escola A');
    expect(abreviarRotulo('  Escola A  ')).toBe('Escola A');
    expect(abreviarRotulo('Escola Municipal Exemplo', 16).length).toBeLessThanOrEqual(16);
  });

  it('o eixo mostra o rótulo abreviado e mantém o nome completo para o tooltip', () => {
    const nomes = ['Escola Municipal Exemplo do Vale Verde', 'Escola A'];
    const eixo = eixoDeCategorias(nomes, 16) as {
      data: string[];
      axisLabel: { formatter: (nome: string) => string; hideOverlap: boolean };
      axisPointer: { label: { formatter: (ponto: { value: string }) => string } };
    };

    expect(eixo.data).toEqual(nomes);
    expect(eixo.axisLabel.formatter(nomes[0])).toBe('Escola Municipa…');
    expect(eixo.axisLabel.hideOverlap).toBe(true);
    expect(eixo.axisPointer.label.formatter({ value: nomes[0] })).toBe(nomes[0]);
  });

  it('a legenda do donut traz valor e percentual', () => {
    expect(legendaComValor('Na escola', 846, 1284)).toBe('Na escola: 846 (65,9%)');
    expect(legendaComValor('Ausente', 0, 0)).toBe('Ausente: 0 (0%)');
  });
});

describe('tema do ECharts', () => {
  it('é montado só com os tokens do tema', () => {
    const tema = temaEcharts(TOKENS) as {
      color: string[];
      textStyle: { color: string };
      tooltip: { backgroundColor: string };
      categoryAxis: { axisLabel: { color: string } };
    };

    expect(tema.color.slice(0, 4)).toEqual([TOKENS.info, TOKENS.sucesso, TOKENS.atencao, TOKENS.critico]);
    expect(tema.textStyle.color).toBe(TOKENS.texto);
    expect(tema.tooltip.backgroundColor).toBe(TOKENS.superficie);
    expect(tema.categoryAxis.axisLabel.color).toBe(TOKENS.textoSuave);
  });

  it('lê os tokens das variáveis CSS do elemento', () => {
    const elemento = document.createElement('div');
    elemento.style.setProperty('--texto', ' #101828 ');
    elemento.style.setProperty('--critico', '#b91c1c');
    document.body.appendChild(elemento);

    const tokens = lerTokens(elemento);

    expect(tokens.texto).toBe('#101828');
    expect(tokens.critico).toBe('#b91c1c');
    elemento.remove();
  });

  it('colore a frequência por faixa: <60 crítico, 60–85 atenção, >85 ok', () => {
    expect(corDaFrequencia(59.9, TOKENS)).toBe(TOKENS.critico);
    expect(corDaFrequencia(60, TOKENS)).toBe(TOKENS.atencao);
    expect(corDaFrequencia(85, TOKENS)).toBe(TOKENS.atencao);
    expect(corDaFrequencia(85.1, TOKENS)).toBe(TOKENS.sucesso);
  });
});
