import { RastreioVeiculo, SaudeLeitor, StatusVeiculo } from '../../core/api/modelos';
import { resultadosLocais } from '../../layout/busca-global';
import {
  agruparLeitores,
  aplicarPosicao,
  distancia,
  filtrarVeiculos,
  idadePosicao,
  situacaoGps,
} from './veiculos.logica';

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

  describe('GPS ao vivo', () => {
    // Coordenadas e horários fictícios.
    const AGORA = new Date('2026-03-10T08:00:00').getTime();

    function rastreio(veiculoId: number, latitude: number, em: string): RastreioVeiculo {
      return {
        veiculoId,
        escolaId: 50,
        posicao: {
          latitude,
          longitude: -50,
          velocidadeKmh: 32.4,
          rumo: 90,
          emMovimento: true,
          registradaEm: em,
        },
        atrasada: false,
        falhando: false,
        distanciaEscolaM: 850,
        naCercaDaEscola: false,
        naCercaDesde: null,
        rastro: [],
      };
    }

    it('evento veiculo.posicao move o veículo e estende o rastro só quando é ponto novo', () => {
      const inicial = [
        {
          ...rastreio(7, -10.01, '2026-03-10T07:59:50'),
          rastro: [{ latitude: -10.01, longitude: -50, em: '2026-03-10T07:59:50' }],
        },
      ];

      const andou = aplicarPosicao(inicial, {
        veiculo: rastreio(7, -10.009, '2026-03-10T07:59:55'),
        novoPonto: true,
      });
      expect(andou[0].posicao?.latitude).toBe(-10.009);
      expect(andou[0].rastro.map((p) => p.latitude)).toEqual([-10.01, -10.009]);
      expect(inicial[0].rastro).toHaveLength(1);

      const parado = aplicarPosicao(andou, {
        veiculo: rastreio(7, -10.00901, '2026-03-10T08:00:00'),
        novoPonto: false,
      });
      expect(parado[0].posicao?.registradaEm).toBe('2026-03-10T08:00:00');
      expect(parado[0].rastro).toHaveLength(2);
    });

    it('veículo novo entra na lista e o rastro respeita o teto', () => {
      const lista = aplicarPosicao([], {
        veiculo: rastreio(8, -10.02, '2026-03-10T07:00:00'),
        novoPonto: true,
      });
      expect(lista.map((r) => r.veiculoId)).toEqual([8]);

      let atual = lista;
      for (let i = 1; i <= 5; i++) {
        atual = aplicarPosicao(
          atual,
          { veiculo: rastreio(8, -10.02 + i * 0.001, `2026-03-10T07:0${i}:00`), novoPonto: true },
          3,
        );
      }
      expect(atual[0].rastro).toHaveLength(3);
      expect(atual[0].rastro[2].em).toBe('2026-03-10T07:05:00');
    });

    it('selo do GPS: ao vivo, atrasado e sem sinal', () => {
      expect(situacaoGps(rastreio(7, -10, '2026-03-10T07:59:56'), AGORA)).toEqual({
        texto: 'GPS 32 km/h · há 4 s',
        tom: 'sucesso',
      });
      const parado = rastreio(7, -10, '2026-03-10T07:59:30');
      parado.posicao!.emMovimento = false;
      expect(situacaoGps(parado, AGORA).texto).toBe('GPS parado · há 30 s');

      const atrasado = { ...rastreio(7, -10, '2026-03-09T13:40:00'), atrasada: true };
      expect(situacaoGps(atrasado, AGORA)).toEqual({
        texto: 'GPS atrasado · há 18 h',
        tom: 'atencao',
      });
      expect(situacaoGps(undefined, AGORA)).toEqual({ texto: 'Sem GPS', tom: 'neutro' });
      expect(situacaoGps({ ...atrasado, posicao: null }, AGORA).texto).toBe('Sem GPS');
    });

    it('idade e distância em unidades legíveis', () => {
      expect(idadePosicao('2026-03-10T07:57:00', AGORA)).toBe('há 3 min');
      expect(idadePosicao('2026-03-07T08:00:00', AGORA)).toBe('há 3 d');
      expect(idadePosicao(null, AGORA)).toBe('—');
      expect(distancia(850)).toBe('850 m');
      expect(distancia(2400)).toBe('2,4 km');
      expect(distancia(null)).toBe('—');
    });
  });
});
