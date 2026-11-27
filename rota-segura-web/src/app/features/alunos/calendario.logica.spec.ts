import { JornadaDoDia } from '../../core/api/modelos';
import { EstadoJornada } from '../../shared/ui/tom';
import {
  celulasDoMes,
  diaInicial,
  diasContados,
  janelasDoAno,
  mesInicial,
  mesesDoAno,
  montarHistorico,
  resumir,
  soDigitos,
  validarAno,
} from './calendario.logica';

/** Jornada fictícia; `leitura` diz se houve embarque nesse dia. */
function dia(data: string, estado: EstadoJornada, leitura = estado !== 'AUSENTE'): JornadaDoDia {
  return {
    alunoId: 1,
    data,
    estado,
    embarqueEm: leitura ? `${data}T07:00:00` : null,
    veiculoId: null,
    chegadaEm: null,
    escolaId: null,
    tempoTrajetoMin: null,
    divergencias: [],
    passos: [],
    leiturasIgnoradas: { duplicadas: 0, foraDeOrdem: 0 },
  };
}

describe('campo de ano', () => {
  it('só deixa passar números, no máximo quatro', () => {
    expect(soDigitos('ano 20a5!')).toBe('205');
    expect(soDigitos('202645')).toBe('2026');
    expect(soDigitos('-1.5e3')).toBe('153');
  });

  it('aceita um ano entre 2000 e o atual', () => {
    expect(validarAno('2025', 2026)).toEqual({ ano: 2025 });
    expect(validarAno('2000', 2026)).toEqual({ ano: 2000 });
    expect(validarAno('2026', 2026)).toEqual({ ano: 2026 });
  });

  it('explica por que o ano não vale', () => {
    expect(validarAno('20', 2026)).toEqual({ erro: 'Digite o ano com 4 números.' });
    expect(validarAno('2030', 2026)).toEqual({
      erro: '2030 ainda não começou. O ano mais recente é 2026.',
    });
    expect(validarAno('1890', 2026)).toEqual({ erro: 'Digite um ano a partir de 2000.' });
  });
});

describe('janelas do ano', () => {
  it('no ano atual, vai de 1º de janeiro até hoje, em blocos de até 31 dias', () => {
    const janelas = janelasDoAno(2026, new Date(2026, 1, 10));
    expect(janelas).toEqual([
      { inicio: '2026-01-11', fim: '2026-02-10' },
      { inicio: '2026-01-01', fim: '2026-01-10' },
    ]);
  });

  it('em ano passado, cobre o ano inteiro', () => {
    const janelas = janelasDoAno(2025, new Date(2026, 1, 10));
    expect(janelas.length).toBe(12);
    expect(janelas[0].fim).toBe('2025-12-31');
    expect(janelas.at(-1)!.inicio).toBe('2025-01-01');
  });
});

describe('calendário do mês', () => {
  // Março/2026 começa num domingo. A primeira leitura é no dia 4.
  const historico = montarHistorico([
    dia('2026-03-02', 'AUSENTE'),
    dia('2026-03-04', 'NA_ESCOLA'),
    dia('2026-03-05', 'AUSENTE'),
    dia('2026-03-07', 'NA_ESCOLA'),
    dia('2026-03-10', 'AGUARDANDO', false),
  ]);
  const celulas = celulasDoMes(historico, 2026, 2, '2026-03-10');
  const situacao = (data: string) => celulas.find((c) => c?.data === data)?.situacao;

  it('completa semanas inteiras começando no domingo', () => {
    expect(celulas.length % 7).toBe(0);
    expect(celulas[0]?.data).toBe('2026-03-01');
    expect(celulasDoMes(historico, 2026, 3, '2026-03-10').slice(0, 3)).toEqual([null, null, null]);
  });

  it('dia antes da primeira leitura é "sem registro", não falta', () => {
    expect(situacao('2026-03-02')).toBe('SEM_REGISTRO');
  });

  it('depois da primeira leitura vale o estado da jornada', () => {
    expect(situacao('2026-03-04')).toBe('NA_ESCOLA');
    expect(situacao('2026-03-05')).toBe('AUSENTE');
    expect(situacao('2026-03-10')).toBe('AGUARDANDO');
  });

  it('dia útil que a API não devolveu é "sem aula"; fim de semana só aparece se teve leitura', () => {
    expect(situacao('2026-03-06')).toBe('SEM_AULA');
    expect(situacao('2026-03-08')).toBe('FIM_DE_SEMANA');
    expect(situacao('2026-03-07')).toBe('NA_ESCOLA');
  });

  it('dias depois de hoje são futuros', () => {
    expect(situacao('2026-03-11')).toBe('FUTURO');
  });

  it('marca o dia de hoje', () => {
    expect(celulas.filter((c) => c?.hoje).map((c) => c!.data)).toEqual(['2026-03-10']);
  });
});

describe('resumo e navegação', () => {
  const historico = montarHistorico([
    dia('2026-02-02', 'AUSENTE'),
    dia('2026-03-04', 'NA_ESCOLA'),
    dia('2026-03-05', 'AUSENTE'),
    dia('2026-03-09', 'DIVERGENTE'),
    dia('2026-03-10', 'EMBARCADO'),
  ]);

  it('conta só dias encerrados a partir da primeira leitura', () => {
    expect(diasContados(historico, '2026', '2026-03-10').map((d) => d.data)).toEqual([
      '2026-03-04',
      '2026-03-05',
      '2026-03-09',
    ]);
    expect(diasContados(historico, '2026-02', '2026-03-10')).toEqual([]);
  });

  it('presença é a fração de dias na escola; sem dias, não inventa zero', () => {
    const r = resumir(diasContados(historico, '2026', '2026-03-10'));
    expect(r.total).toBe(3);
    expect(r.porEstado.AUSENTE).toBe(1);
    expect(r.porEstado.EMBARCADO).toBe(0);
    expect(r.presenca).toBe(33.3);
    expect(resumir([]).presenca).toBeNull();
  });

  it('meses vão do primeiro com leitura até dezembro, com os futuros marcados', () => {
    const meses = mesesDoAno(historico, 2026, '2026-03-10');
    expect(meses[0]).toEqual({ mes: 2, futuro: false });
    expect(meses[1]).toEqual({ mes: 3, futuro: true });
    expect(meses.at(-1)).toEqual({ mes: 11, futuro: true });
  });

  it('abre no mês de hoje; em outro ano, no último mês com leitura', () => {
    expect(mesInicial(historico, 2026, '2026-03-10')).toBe(2);
    const passado = montarHistorico([dia('2025-11-28', 'NA_ESCOLA'), dia('2025-12-01', 'AUSENTE')]);
    expect(mesInicial(passado, 2025, '2026-03-10')).toBe(10);
  });

  it('seleciona o dia mais recente com registro no mês', () => {
    expect(diaInicial(historico, 2, '2026-03-10')).toBe('2026-03-10');
    expect(diaInicial(historico, 1, '2026-03-10')).toBeNull();
  });
});
