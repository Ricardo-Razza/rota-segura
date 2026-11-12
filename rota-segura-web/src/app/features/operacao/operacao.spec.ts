import { Alerta, SaudeLeitor, StatusVeiculo } from '../../core/api/modelos';
import { paineisPorEscola } from './operacao';

const v = (
  id: number,
  escolaId: number,
  estado: StatusVeiculo['estado'],
  embarcados: number,
  esperados: number,
) =>
  ({
    id,
    placa: `AAA0A0${id}`,
    escolaId,
    estado,
    embarcados,
    esperados,
    aBordo: 0,
  }) as StatusVeiculo;
const a = (id: number, escolaId: number, severidade: Alerta['severidade']) =>
  ({ id, escolaId, severidade }) as Alerta;
const l = (id: number, escolaId: number, situacao: SaudeLeitor['situacao']) =>
  ({ id, escolaId, situacao }) as SaudeLeitor;

describe('modo operação', () => {
  it('um painel geral e um por escola, com embarcados × esperados, críticos e leitores offline', () => {
    const paineis = paineisPorEscola(
      [v(1, 50, 'EM_ROTA', 10, 12), v(2, 60, 'CONCLUIDO', 5, 5)],
      [a(1, 50, 'CRITICO'), a(2, 60, 'ATENCAO')],
      [l(1, 60, 'OFFLINE'), l(2, 50, 'ONLINE')],
    );
    expect(paineis.map((p) => p.titulo)).toEqual(['Visão geral', 'Escola #50', 'Escola #60']);
    expect(paineis[0]).toMatchObject({ embarcados: 15, esperados: 17 });
    expect(paineis[1].emRota).toHaveLength(1);
    expect(paineis[1].criticos).toHaveLength(1);
    expect(paineis[2].criticos).toHaveLength(0);
    expect(paineis[2].offline).toHaveLength(1);
  });
});
