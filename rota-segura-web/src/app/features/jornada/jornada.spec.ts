import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, Subject, filter, map } from 'rxjs';
import { LinhaJornada, QuadroDoDia } from '../../core/api/modelos';
import { SseService } from '../../core/sse/sse.service';
import { isoLocal } from '../../shared/formato';
import { EstadoJornada } from '../../shared/ui/tom';
import { Jornada } from './jornada';
import { aplicarAtualizacao, pertence, porColuna } from './jornada.logica';

const HOJE = isoLocal(new Date());

/** Linha fictícia: aluno com iniciais e turma inventadas. */
function linha(
  id: number,
  estado: EstadoJornada,
  extra: Partial<LinhaJornada['jornada']> = {},
): LinhaJornada {
  return {
    aluno: {
      id,
      nome: `Aluno Fictício ${id}`,
      iniciais: 'AF',
      turmaId: 9,
      turma: 'Turma Fictícia',
      anoEscolar: '1º ano',
      turno: 'Matutino',
      anoLetivo: 2026,
      escolaNome: 'Escola Fictícia',
      escolaId: 50,
      veiculoId: 7,
      biometria: true,
    },
    jornada: {
      alunoId: id,
      data: HOJE,
      estado,
      embarqueEm: null,
      veiculoId: 7,
      chegadaEm: null,
      escolaId: 50,
      tempoTrajetoMin: null,
      divergencias: [],
      passos: [],
      leiturasIgnoradas: { duplicadas: 0, foraDeOrdem: 0 },
      ...extra,
    },
    esperado: true,
  };
}

function quadro(linhas: LinhaJornada[]): QuadroDoDia {
  return {
    data: HOJE,
    avaliadoEm: `${HOJE}T07:00:00`,
    porEstado: {},
    jornadas: { itens: linhas, pagina: 0, tamanho: 200, total: linhas.length, totalPaginas: 1 },
    descartes: {
      duplicadas: 0,
      foraDeOrdem: 0,
      tipoDeLeitorDesconhecido: 0,
      leitorNaoCadastrado: 0,
      semDadosValidos: 0,
    },
    desatualizado: false,
    incompleto: false,
  };
}

describe('jornada.logica', () => {
  it('substitui a linha do aluno em vez de duplicar', () => {
    const lista = [linha(1, 'AGUARDANDO'), linha(2, 'AGUARDANDO')];
    const nova = aplicarAtualizacao(lista, linha(1, 'EMBARCADO'));
    expect(nova).toHaveLength(2);
    expect(porColuna(nova).EMBARCADO.map((l) => l.aluno.id)).toEqual([1]);
    expect(lista[0].jornada.estado).toBe('AGUARDANDO'); // imutável
  });

  it('ignora atualização de outro dia ou fora do filtro', () => {
    const filtro = { data: HOJE, escolaId: 50, veiculoId: null, anoEscolar: null, turmaId: null };
    expect(pertence(linha(1, 'NA_ESCOLA'), filtro)).toBe(true);
    expect(pertence(linha(1, 'NA_ESCOLA', { data: '2020-01-01' }), filtro)).toBe(false);
    expect(pertence(linha(1, 'NA_ESCOLA', { escolaId: 60 }), filtro)).toBe(false);
  });
});

describe('Jornada (tela)', () => {
  let fixture: ComponentFixture<Jornada>;
  let http: HttpTestingController;
  const eventos = new Subject<{ tipo: string; dados: unknown }>();

  const sseFalso = {
    estado: signal('online'),
    atrasadoHaMin: signal<number | null>(null),
    de: <T>(tipo: string): Observable<T> =>
      eventos.pipe(
        filter((e) => e.tipo === tipo),
        map((e) => e.dados as T),
      ),
  };

  function coluna(estado: EstadoJornada): number[] {
    const secao = (fixture.nativeElement as HTMLElement).querySelector(
      `[data-estado="${estado}"]`,
    )!;
    return [...secao.querySelectorAll<HTMLElement>('[data-aluno]')].map((b) =>
      Number(b.dataset['aluno']),
    );
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: SseService, useValue: sseFalso },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Jornada);
    fixture.detectChanges();
    http
      .expectOne((r) => r.url === '/api/v1/jornadas')
      .flush(quadro([linha(101, 'AGUARDANDO'), linha(102, 'EMBARCADO')]));
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('mostra cada aluno na coluna do seu estado', () => {
    expect(coluna('AGUARDANDO')).toEqual([101]);
    expect(coluna('EMBARCADO')).toEqual([102]);
  });

  it('evento SSE jornada.atualizada move o card para a coluna certa', async () => {
    eventos.next({
      tipo: 'jornada.atualizada',
      dados: linha(102, 'NA_ESCOLA', {
        embarqueEm: `${HOJE}T07:00:00`,
        chegadaEm: `${HOJE}T07:25:00`,
      }),
    });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(coluna('EMBARCADO')).toEqual([]);
    expect(coluna('NA_ESCOLA')).toEqual([102]);
    expect(coluna('AGUARDANDO')).toEqual([101]);
  });

  it('evento de outro dia não mexe no quadro', async () => {
    eventos.next({
      tipo: 'jornada.atualizada',
      dados: linha(101, 'NA_ESCOLA', { data: '2020-01-01' }),
    });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(coluna('AGUARDANDO')).toEqual([101]);
  });
});
