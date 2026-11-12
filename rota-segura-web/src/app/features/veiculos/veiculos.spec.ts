import { SaudeLeitor, StatusVeiculo } from '../../core/api/modelos';
import { resultadosLocais } from '../../layout/busca-global';
import { agruparLeitores, filtrarVeiculos } from './veiculos.logica';

function veiculo(id: number, placa: string, estado: StatusVeiculo['estado']): StatusVeiculo {
  return {
    id,
    placa,
    prefixo: `P-${id}`,
    descricao: null,
    estado,
    embarcados: 0,
    aBordo: 0,
    chegaram: 0,
    esperados: 0,
    capacidade: null,
    ocupacao: null,
    faixaOcupacao: null,
    escolaId: 50,
    latitude: null,
    longitude: null,
    leitores: [],
    ultimaLeitura: null,
    saida: null,
    tempoMedioMin: null,
    previsaoChegada: null,
  };
}

function leitor(id: number, escolaId: number | null, veiculoId: number | null): SaudeLeitor {
  return {
    id,
    descricao: `Leitor fictício ${id}`,
    tipoUso: veiculoId ? 'EMBARQUE' : 'CHEGADA',
    tipoUsoDescricao: null,
    veiculoId,
    veiculoPrefixo: veiculoId ? `P-${veiculoId}` : null,
    escolaId,
    ultimaLeitura: null,
    leiturasUltimaHora: 0,
    situacao: 'SEM_LEITURA',
  };
}

describe('veículos', () => {
  const lista = [veiculo(7, 'AAA0A07', 'EM_ROTA'), veiculo(8, 'BBB0B08', 'CONCLUIDO')];

  it('busca placa ignorando hífen e caixa, e filtra por estado', () => {
    expect(filtrarVeiculos(lista, 'aaa-0a', []).map((v) => v.id)).toEqual([7]);
    expect(filtrarVeiculos(lista, '', ['CONCLUIDO']).map((v) => v.id)).toEqual([8]);
    expect(filtrarVeiculos(lista, 'aaa', ['CONCLUIDO'])).toEqual([]);
  });

  it('agrupa leitores por escola e veículo', () => {
    const grupos = agruparLeitores([leitor(1, 50, 7), leitor(2, 50, null), leitor(3, 50, 7)]);
    // Leitores da escola primeiro, depois os de cada veículo.
    expect(grupos.map((g) => g.leitores.length)).toEqual([1, 2]);
    expect(grupos[0].titulo).toContain('leitores da escola');
    expect(grupos[1].titulo).toContain('veículo P-7');
  });

  it('busca global encontra veículo pela placa sem mandar nada ao servidor', () => {
    const r = resultadosLocais('bbb0', lista, [leitor(1, 50, 7)]);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ tipo: 'Veículo', params: { veiculo: '8' } });
    expect(resultadosLocais('b', lista, [])).toEqual([]);
  });
});
