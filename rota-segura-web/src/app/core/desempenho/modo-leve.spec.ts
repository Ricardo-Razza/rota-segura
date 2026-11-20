import { describe, expect, it } from 'vitest';
import { aplicarModoLeve, deveUsarModoLeve } from './modo-leve';

describe('modo leve', () => {
  it('liga em máquina com poucos núcleos ou pouca memória', () => {
    expect(deveUsarModoLeve({ hardwareConcurrency: 4, deviceMemory: 8 })).toBe(true);
    expect(deveUsarModoLeve({ hardwareConcurrency: 8, deviceMemory: 2 })).toBe(true);
  });

  it('liga quando o usuário pediu economia de dados', () => {
    expect(deveUsarModoLeve({ hardwareConcurrency: 16, connection: { saveData: true } })).toBe(
      true,
    );
  });

  it('não liga em máquina boa nem quando o navegador não informa nada', () => {
    expect(deveUsarModoLeve({ hardwareConcurrency: 8, deviceMemory: 8 })).toBe(false);
    expect(deveUsarModoLeve({})).toBe(false);
    expect(deveUsarModoLeve({ hardwareConcurrency: 0 })).toBe(false);
  });

  it('marca e desmarca o atributo data-leve na raiz', () => {
    const raiz = document.createElement('html');
    expect(aplicarModoLeve(raiz, { hardwareConcurrency: 2 })).toBe(true);
    expect(raiz.hasAttribute('data-leve')).toBe(true);
    aplicarModoLeve(raiz, { hardwareConcurrency: 12 });
    expect(raiz.hasAttribute('data-leve')).toBe(false);
  });
});
