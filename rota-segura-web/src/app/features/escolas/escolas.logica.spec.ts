import { FrequenciaEscola, StatusVeiculo } from '../../core/api/modelos';
import {
  contarFaixas,
  diasEmQueda,
  escolasAcimaDoCritico,
  manchete,
  ordenarPorPresenca,
  pontosDeEscolas,
  ultimosDias,
} from './escolas.logica';

// Dados fictícios.
function escola(id: number, frequencia: number | null): FrequenciaEscola {
  const faixa =
    frequencia === null ? null : frequencia < 60 ? 'CRITICO' : frequencia <= 85 ? 'ATENCAO' : 'OK';
  return {
    escolaId: id,
    escolaNome: `Escola Fictícia ${id}`,
    esperados: 10,
    presentes: 5,
    frequencia,
    faixa,
  };
}

function veiculo(id: number, escolaId: number | null, lat: number | null): StatusVeiculo {
  return {
    id,
    placa: `AAA0A0${id}`,
    prefixo: null,
    descricao: null,
    estado: 'EM_ROTA',
    embarcados: 0,
    aBordo: 0,
    chegaram: 0,
    esperados: 0,
    capacidade: null,
    ocupacao: null,
    faixaOcupacao: null,
    escolaId,
    latitude: lat,
    longitude: lat === null ? null : -47,
    leitores: [],
    ultimaLeitura: null,
    saida: null,
    tempoMedioMin: null,
    previsaoChegada: null,
  } as StatusVeiculo;
}

describe('lógica das escolas', () => {
  const escolas = [escola(1, 92), escola(2, 55), escola(3, null), escola(4, 70)];

  it('ordena da menor presença para a maior, sem dado no fim', () => {
    expect(ordenarPorPresenca(escolas).map((e) => e.escolaId)).toEqual([2, 4, 1, 3]);
  });

  it('conta escolas por faixa e as acima do crítico', () => {
    expect(contarFaixas(escolas)).toEqual({ critico: 1, atencao: 1, ok: 1, semDados: 1 });
    expect(escolasAcimaDoCritico(escolas)).toEqual({ acima: 2, total: 3 });
  });

  it('um ponto por escola, com a cor da faixa, ignorando veículo sem coordenada', () => {
    const pontos = pontosDeEscolas(
      [veiculo(1, 2, -15), veiculo(2, 2, -15), veiculo(3, 1, null), veiculo(4, 4, -16)],
      escolas,
    );
    expect(pontos.map((p) => [p.id, p.tom])).toEqual([
      [2, 'critico'],
      [4, 'atencao'],
    ]);
    expect(pontos[0].rotulo).toBe('Escola Fictícia 2 · 55%');
  });

  it('manchete vem dos números, no singular e no plural', () => {
    expect(manchete(0, 0)).toEqual({
      destaque: 'bem',
      tom: 'sucesso',
      complemento: 'sem problemas críticos.',
    });
    expect(manchete(1, 0)).toEqual({
      destaque: 'bem',
      tom: 'sucesso',
      complemento: 'com 1 problema crítico.',
    });
    expect(manchete(1, 1).destaque).toBe('pedindo atenção');
    expect(manchete(2, 3)).toEqual({
      destaque: 'pedindo atenção',
      tom: 'critico',
      complemento: 'com 5 problemas críticos.',
    });
  });

  it('dias em queda contam do mais recente para trás', () => {
    const dias = [90, 95, 93, 91, 88].map((f, i) => ({
      data: `2026-11-0${i + 1}`,
      esperados: 10,
      presentes: 9,
      frequencia: f,
    }));
    expect(diasEmQueda(dias)).toBe(3);
    expect(
      ultimosDias([...dias, { data: 'x', esperados: 0, presentes: 0, frequencia: null }], 2),
    ).toHaveLength(2);
  });
});
