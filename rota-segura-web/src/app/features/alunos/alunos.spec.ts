import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { JornadaDoDia } from '../../core/api/modelos';
import { EstadoJornada } from '../../shared/ui/tom';
import { Alunos } from './alunos';
import { avaliarRisco, janelasDeHistorico, ultimosDias } from './alunos.logica';

describe('Alunos (tela)', () => {
  it('pede a primeira página como 1 (o backend recusa 0 com 400)', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(Alunos);
    fixture.detectChanges();
    await fixture.whenStable();
    const pedidos = http.match((r) => r.url === '/api/v1/alunos');
    expect(pedidos).toHaveLength(1);
    expect(pedidos[0].request.params.get('pagina')).toBe('1');
  });
});

function dia(data: string, estado: EstadoJornada): JornadaDoDia {
  return {
    alunoId: 1,
    data,
    estado,
    embarqueEm: null,
    veiculoId: null,
    chegadaEm: null,
    escolaId: null,
    tempoTrajetoMin: null,
    divergencias: [],
    passos: [],
    leiturasIgnoradas: { duplicadas: 0, foraDeOrdem: 0 },
  };
}

function seq(n: number, estado: (i: number) => EstadoJornada): JornadaDoDia[] {
  return Array.from({ length: n }, (_, i) =>
    dia(`2026-01-${String(i + 1).padStart(2, '0')}`, estado(i)),
  );
}

describe('perfil do aluno', () => {
  it('quebra o histórico em janelas de até 31 dias, sem buraco nem sobreposição', () => {
    const janelas = janelasDeHistorico(new Date(2026, 2, 31), 70);
    expect(janelas).toEqual([
      { inicio: '2026-03-01', fim: '2026-03-31' },
      { inicio: '2026-01-29', fim: '2026-02-28' },
      { inicio: '2026-01-21', fim: '2026-01-28' },
    ]);
  });

  it('fica com os últimos N dias, sem repetir', () => {
    const dias = ultimosDias(
      [dia('2026-01-03', 'AUSENTE'), dia('2026-01-01', 'NA_ESCOLA'), dia('2026-01-03', 'AUSENTE')],
      2,
    );
    expect(dias.map((d) => d.data)).toEqual(['2026-01-01', '2026-01-03']);
  });

  it('risco alto com 5 faltas seguidas; hoje não conta', () => {
    const historico = [
      ...seq(10, () => 'NA_ESCOLA'),
      ...seq(5, () => 'AUSENTE').map((d, i) => ({ ...d, data: `2026-02-0${i + 1}` })),
    ];
    const risco = avaliarRisco([...historico, dia('2026-02-10', 'AGUARDANDO')], '2026-02-10');
    expect(risco.faltasSeguidas).toBe(5);
    expect(risco.nivel).toBe('alto');
  });

  it('detecta queda de frequência entre as últimas 20 aulas e as 20 anteriores', () => {
    const historico = seq(40, (i) =>
      i < 20 ? 'NA_ESCOLA' : i % 2 === 0 ? 'AUSENTE' : 'NA_ESCOLA',
    );
    const risco = avaliarRisco(historico, '2026-12-31');
    expect(risco.frequenciaAnterior).toBe(100);
    expect(risco.frequenciaRecente).toBe(50);
    expect(risco.motivos.join(' ')).toContain('caiu de 100% para 50%');
  });

  it('frequência estável e sem faltas = risco baixo', () => {
    expect(
      avaliarRisco(
        seq(30, () => 'NA_ESCOLA'),
        '2026-12-31',
      ).nivel,
    ).toBe('baixo');
  });
});
