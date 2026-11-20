import {
  ParadaAprendida,
  RastreioVeiculo,
  SaudeLeitor,
  StatusVeiculo,
} from '../../core/api/modelos';
import { resultadosLocais } from '../../layout/busca-global';
import {
  agruparLeitores,
  aplicarPosicao,
  aplicarPosicoes,
  avancarReplay,
  distancia,
  filtrarVeiculos,
  hojeIso,
  horariosDaParada,
  idadePosicao,
  posicaoNoInstante,
  rotuloParada,
  situacaoGps,
  textoPrevisao,
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
    origemPrevisao: null,
    chegadaNormal: null,
    diferencaMin: null,
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

    it('posições que chegam juntas são aplicadas de uma vez, na ordem', () => {
      const lista = aplicarPosicoes(
        [],
        [
          { veiculo: rastreio(7, -10.0, '2026-03-10T07:00:00'), novoPonto: true },
          { veiculo: rastreio(8, -10.5, '2026-03-10T07:00:02'), novoPonto: true },
          { veiculo: rastreio(7, -10.01, '2026-03-10T07:00:05'), novoPonto: true },
        ],
      );
      expect(lista.map((r) => r.veiculoId)).toEqual([7, 8]);
      expect(lista[0].posicao?.registradaEm).toBe('2026-03-10T07:00:05');
      expect(lista[0].rastro).toHaveLength(2);
      expect(aplicarPosicoes(lista, [])).toBe(lista);
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

  describe('previsão de chegada', () => {
    const emRota = (extra: Partial<StatusVeiculo>): StatusVeiculo => ({
      ...veiculo(8, 'BBB0B08', 'EM_ROTA'),
      previsaoChegada: '2026-03-10T07:23:00',
      ...extra,
    });

    it('pelo GPS diz quanto passa do horário de sempre', () => {
      expect(textoPrevisao(emRota({ origemPrevisao: 'GPS', diferencaMin: 15 }))).toEqual({
        chegada: 'Chega às 07:23',
        comparacao: '15 min depois do normal',
        tom: 'critico',
      });
      expect(textoPrevisao(emRota({ origemPrevisao: 'GPS', diferencaMin: 5 }))?.tom).toBe(
        'atencao',
      );
      expect(textoPrevisao(emRota({ origemPrevisao: 'GPS', diferencaMin: -6 }))?.comparacao).toBe(
        '6 min antes do normal',
      );
      expect(textoPrevisao(emRota({ origemPrevisao: 'GPS', diferencaMin: 2 }))?.comparacao).toBe(
        'no horário de sempre',
      );
    });

    it('sem GPS avisa que é estimativa pela saída e sem previsão não mostra nada', () => {
      expect(textoPrevisao(emRota({ origemPrevisao: 'SAIDA' }))?.comparacao).toBe(
        'estimativa pela hora da saída',
      );
      expect(textoPrevisao(veiculo(1, 'AAA0A01', 'CONCLUIDO'))).toBeNull();
    });
  });

  describe('paradas aprendidas', () => {
    const parada: ParadaAprendida = {
      latitude: -10.01,
      longitude: -50,
      embarques: 9,
      alunos: 2,
      dias: 5,
      horariosTipicos: ['06:51:00', '17:32:30'],
    };

    it('mostra horários típicos e só contagens, sem aluno', () => {
      expect(horariosDaParada(parada)).toBe('06:51 e 17:32');
      expect(rotuloParada(parada)).toBe(
        'Parada · 06:51 e 17:32 · 9 embarques (2 alunos) em 5 dia(s)',
      );
      expect(rotuloParada({ ...parada, alunos: 1 })).toContain('(1 aluno)');
    });
  });

  describe('replay do trajeto', () => {
    const pontos = [
      { latitude: -10.02, longitude: -50, em: '2026-03-09T06:50:00' },
      { latitude: -10.01, longitude: -50, em: '2026-03-09T07:00:00' },
      { latitude: -10.0, longitude: -50.01, em: '2026-03-09T07:10:00' },
    ];
    const ms = (h: string) => new Date(`2026-03-09T${h}`).getTime();

    it('interpola entre os pontos vizinhos', () => {
      const meio = posicaoNoInstante(pontos, ms('06:55:00'))!;
      expect(meio.latitude).toBeCloseTo(-10.015, 6);
      expect(meio.indice).toBe(0);
      const depois = posicaoNoInstante(pontos, ms('07:05:00'))!;
      expect(depois.longitude).toBeCloseTo(-50.005, 6);
      expect(depois.indice).toBe(1);
    });

    it('antes do início fica no primeiro ponto e depois do fim no último', () => {
      expect(posicaoNoInstante(pontos, ms('06:00:00'))).toEqual({
        latitude: -10.02,
        longitude: -50,
        indice: 0,
      });
      expect(posicaoNoInstante(pontos, ms('09:00:00'))?.indice).toBe(2);
      expect(posicaoNoInstante([], ms('07:00:00'))).toBeNull();
    });

    it('pula o tempo parado: garagem de madrugada e intervalo entre as rotas', () => {
      const t = [ms('02:10:00'), ms('07:00:00'), ms('07:00:30'), ms('07:01:00'), ms('17:00:00')];
      // Na garagem: vai direto para a saída das 07:00.
      expect(avancarReplay(t, t[0], 1000)).toBe(t[1]);
      // Andando: avança normalmente.
      expect(avancarReplay(t, t[1], 10_000)).toBe(t[1] + 10_000);
      // Fim da rota da manhã: pula para a da tarde.
      expect(avancarReplay(t, t[3], 1000)).toBe(t[4]);
      // Nunca passa do último ponto.
      expect(avancarReplay(t, t[4], 60_000)).toBe(t[4]);
      expect(avancarReplay([], 5, 1000)).toBe(5);
    });

    it('data de hoje no formato do campo de data', () => {
      expect(hojeIso(new Date(2026, 2, 10, 23, 30))).toBe('2026-03-10');
    });
  });
});
