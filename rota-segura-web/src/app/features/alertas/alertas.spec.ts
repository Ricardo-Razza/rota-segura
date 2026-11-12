import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject, filter, map } from 'rxjs';
import { AlertasAoVivo } from '../../core/alertas/alertas-ao-vivo.service';
import { Alerta } from '../../core/api/modelos';
import { SseService } from '../../core/sse/sse.service';
import { ToastService } from '../../core/toast/toast.service';
import { rotaDaEntidade } from './alertas';

function alerta(parcial: Partial<Alerta>): Alerta {
  return {
    id: 1,
    tipo: 'EMBARCOU_SEM_CHEGADA',
    severidade: 'CRITICO',
    status: 'ABERTO',
    entidade: 'ALUNO',
    entidadeId: '101',
    rotulo: 'AF #101',
    mensagem: 'AF #101 embarcou no veículo AAA0A07 às 07:00 e não chegou à escola',
    ocorrencias: 1,
    ativo: true,
    primeiraOcorrenciaEm: '2026-03-10T10:00:00Z',
    ultimaOcorrenciaEm: '2026-03-10T10:00:00Z',
    escolaId: 50,
    veiculoId: 7,
    assumidoPor: null,
    assumidoEm: null,
    resolvidoPor: null,
    resolvidoEm: null,
    comentario: null,
    ...parcial,
  };
}

describe('alertas', () => {
  it('"ir para a entidade" usa só ids', () => {
    expect(rotaDaEntidade(alerta({}))).toEqual({ caminho: ['/alunos', '101'], params: {} });
    expect(rotaDaEntidade(alerta({ entidade: 'VEICULO', entidadeId: '7' }))).toEqual({
      caminho: ['/veiculos'],
      params: { veiculo: '7' },
    });
  });

  describe('AlertasAoVivo', () => {
    const eventos = new Subject<{ tipo: string; dados: unknown }>();
    let http: HttpTestingController;
    let toasts: ToastService;
    let servico: AlertasAoVivo;

    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          {
            provide: SseService,
            useValue: {
              de: <T>(tipo: string): Observable<T> =>
                eventos.pipe(
                  filter((e) => e.tipo === tipo),
                  map((e) => e.dados as T),
                ),
            },
          },
        ],
      });
      http = TestBed.inject(HttpTestingController);
      toasts = TestBed.inject(ToastService);
      servico = TestBed.inject(AlertasAoVivo);
      servico.iniciar();
      http
        .expectOne('/api/v1/alertas/resumo')
        .flush({ abertosPorSeveridade: { CRITICO: 2, ATENCAO: 1 }, abertos: 3, emAnalise: 4 });
    });

    afterEach(() => servico.parar());

    it('o badge conta só alertas abertos (em análise fica de fora)', () => {
      expect(servico.abertos()).toBe(3);
      expect(servico.criticosAbertos()).toBe(2);
    });

    it('crítico novo vira toast persistente; atenção não', () => {
      eventos.next({
        tipo: 'alerta.criado',
        dados: alerta({ severidade: 'ATENCAO', mensagem: 'Lotação' }),
      });
      expect(toasts.toasts()).toHaveLength(0);

      eventos.next({ tipo: 'alerta.criado', dados: alerta({}) });
      expect(toasts.toasts()).toHaveLength(1);
      expect(toasts.toasts()[0]).toMatchObject({ tom: 'critico', persistente: true });
    });
  });
});
