/** Cores lidas dos tokens CSS do tema ativo. */
export interface TokensDeTema {
  fundo: string;
  superficie: string;
  borda: string;
  texto: string;
  textoSuave: string;
  sucesso: string;
  atencao: string;
  critico: string;
  info: string;
}

const VARIAVEIS: Record<keyof TokensDeTema, string> = {
  fundo: '--fundo',
  superficie: '--superficie',
  borda: '--borda',
  texto: '--texto',
  textoSuave: '--texto-suave',
  sucesso: '--sucesso',
  atencao: '--atencao',
  critico: '--critico',
  info: '--info',
};

export function lerTokens(elemento: Element = document.documentElement): TokensDeTema {
  const estilo = getComputedStyle(elemento);
  const tokens = {} as TokensDeTema;
  for (const [chave, variavel] of Object.entries(VARIAVEIS) as [keyof TokensDeTema, string][]) {
    tokens[chave] = estilo.getPropertyValue(variavel).trim();
  }
  return tokens;
}

/** Tema do ECharts montado só a partir dos tokens: trocar o tema do painel troca os gráficos junto. */
export function temaEcharts(t: TokensDeTema): Record<string, unknown> {
  const eixo = {
    axisLine: { lineStyle: { color: t.borda } },
    axisTick: { lineStyle: { color: t.borda } },
    axisLabel: { color: t.textoSuave },
    splitLine: { lineStyle: { color: t.borda, type: 'dashed' } },
    nameTextStyle: { color: t.textoSuave },
  };
  return {
    color: [t.info, t.sucesso, t.atencao, t.critico, t.textoSuave],
    backgroundColor: 'transparent',
    // O canvas do ECharts não herda a fonte do CSS: repetimos a pilha do token --fonte.
    textStyle: { color: t.texto, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" },
    title: { textStyle: { color: t.texto }, subtextStyle: { color: t.textoSuave } },
    legend: { textStyle: { color: t.texto }, inactiveColor: t.textoSuave },
    tooltip: {
      backgroundColor: t.superficie,
      borderColor: t.borda,
      textStyle: { color: t.texto },
    },
    categoryAxis: eixo,
    valueAxis: eixo,
    timeAxis: eixo,
    line: { symbolSize: 6, lineStyle: { width: 2 } },
    bar: { itemStyle: { borderRadius: 4 } },
    pie: { itemStyle: { borderColor: t.superficie, borderWidth: 2 }, label: { color: t.texto } },
    markLine: { label: { color: t.texto }, lineStyle: { color: t.textoSuave } },
  };
}

/** Faixas de frequência do painel: abaixo de 60% crítico, de 60% a 85% atenção, acima de 85% ok. */
export function corDaFrequencia(percentual: number, t: TokensDeTema): string {
  if (percentual < 60) {
    return t.critico;
  }
  return percentual <= 85 ? t.atencao : t.sucesso;
}
