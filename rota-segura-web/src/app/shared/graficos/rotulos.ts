/** Corta rótulos longos com reticências. O nome completo continua disponível no tooltip. */
export function abreviarRotulo(texto: string, maximo = 14): string {
  const limpo = texto.trim();
  if (limpo.length <= maximo) {
    return limpo;
  }
  return limpo.slice(0, Math.max(1, maximo - 1)).trimEnd() + '…';
}

/**
 * Configuração de eixo de categorias que evita rótulos sobrepostos: abrevia o texto,
 * mantém todos os rótulos visíveis e mostra o nome completo ao passar o mouse.
 */
export function eixoDeCategorias(nomes: string[], maximo = 14): Record<string, unknown> {
  return {
    type: 'category',
    data: nomes,
    axisLabel: {
      interval: 0,
      hideOverlap: true,
      formatter: (nome: string) => abreviarRotulo(nome, maximo),
    },
    axisPointer: { label: { formatter: (ponto: { value: string }) => ponto.value } },
    triggerEvent: true,
  };
}

/** Rótulo de legenda com valor e percentual, para donuts nunca ficarem "sem números". */
export function legendaComValor(nome: string, valor: number, total: number): string {
  const percentual = total > 0 ? (valor / total) * 100 : 0;
  return `${nome}: ${valor.toLocaleString('pt-BR')} (${percentual.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%)`;
}
