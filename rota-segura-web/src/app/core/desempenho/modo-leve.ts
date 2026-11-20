/** O que o navegador informa sobre a máquina; todos os campos podem faltar. */
export interface InfoMaquina {
  hardwareConcurrency?: number;
  deviceMemory?: number;
  connection?: { saveData?: boolean };
}

/** Até 4 núcleos ou até 4 GB de memória: computador modesto, notebook antigo ou TV box. */
const LIMITE_NUCLEOS = 4;
const LIMITE_MEMORIA_GB = 4;

/**
 * Diz se vale ligar o modo leve (sem desfoque nos painéis). Na dúvida (navegador não informa), não liga:
 * o visual completo é o padrão.
 */
export function deveUsarModoLeve(info: InfoMaquina): boolean {
  if (info.connection?.saveData) {
    return true;
  }
  const nucleos = info.hardwareConcurrency;
  const memoria = info.deviceMemory;
  return (
    (nucleos !== undefined && nucleos > 0 && nucleos <= LIMITE_NUCLEOS) ||
    (memoria !== undefined && memoria > 0 && memoria <= LIMITE_MEMORIA_GB)
  );
}

/** Marca o documento com `data-leve` quando a máquina é modesta. Chamado antes de iniciar o app. */
export function aplicarModoLeve(
  raiz: HTMLElement = document.documentElement,
  info: InfoMaquina = navigator as InfoMaquina,
): boolean {
  const leve = deveUsarModoLeve(info);
  raiz.toggleAttribute('data-leve', leve);
  return leve;
}
