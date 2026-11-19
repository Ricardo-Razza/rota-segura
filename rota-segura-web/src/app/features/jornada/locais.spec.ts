import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { LocaisDoDia, LocalDoPasso } from '../../core/api/modelos';
import { isoLocal } from '../../shared/formato';
import { pontosDaJornada, trechoDoRastro, veiculoDoEmbarque } from './locais.logica';
import { MapaJornada } from './mapa-jornada';

// Dados fictícios: coordenadas inventadas, sem nenhum aluno real.
function passo(tipo: LocalDoPasso['tipo'], dataHora: string, extra: Partial<LocalDoPasso> = {}) {
  return {
    dataHora,
    tipo,
    veiculoId: tipo === 'EMBARQUE' ? 7 : null,
    escolaId: 50,
    estadoResultante: tipo === 'EMBARQUE' ? 'EMBARCADO' : 'NA_ESCOLA',
    latitude: -10.1,
    longitude: -50.1,
    statusNotificacao: 'Enviada',
    ...extra,
  } as LocalDoPasso;
}

function locais(passos: LocalDoPasso[], data = '2026-03-10'): LocaisDoDia {
  return { alunoId: 101, data, passos, desatualizado: false, incompleto: false };
}

describe('locais da jornada', () => {
  it('só passos com coordenada viram ponto, rotulados sem nome do aluno', () => {
    const l = locais([
      passo('EMBARQUE', '2026-03-10T07:00:00'),
      passo('CHEGADA', '2026-03-10T07:25:00', { latitude: null, longitude: null }),
    ]);
    expect(pontosDaJornada(l)).toEqual([
      { tipo: 'EMBARQUE', latitude: -10.1, longitude: -50.1, rotulo: 'Embarque · 07:00' },
    ]);
    expect(pontosDaJornada(null)).toEqual([]);
    expect(veiculoDoEmbarque(l)).toBe(7);
  });

  it('trecho do rastro vai do embarque à chegada, com folga de 2 min', () => {
    const l = locais([
      passo('EMBARQUE', '2026-03-10T07:00:00'),
      passo('CHEGADA', '2026-03-10T07:25:00'),
    ]);
    const em = (h: string) => new Date(`2026-03-10T${h}`).toISOString();
    const rastro = ['06:50:00', '06:59:00', '07:10:00', '07:26:00', '07:40:00'].map((h) => ({
      latitude: -10,
      longitude: -50,
      em: em(h),
    }));
    expect(trechoDoRastro(rastro, l).map((p) => p.em)).toEqual([
      em('06:59:00'),
      em('07:10:00'),
      em('07:26:00'),
    ]);
    expect(trechoDoRastro(rastro, locais([passo('CHEGADA', '2026-03-10T07:25:00')]))).toEqual([]);
  });
});

describe('mapa da jornada', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  function montar(data: string) {
    const fixture = TestBed.createComponent(MapaJornada);
    fixture.componentRef.setInput('alunoId', 101);
    fixture.componentRef.setInput('data', data);
    fixture.detectChanges();
    return fixture;
  }

  it('leitores sem GPS: mostra "sem localização" e o aviso ao responsável, sem buscar rastro', async () => {
    const fixture = montar('2026-03-10');
    http
      .expectOne((r) => r.url.endsWith('/alunos/101/jornadas/2026-03-10/locais'))
      .flush(
        locais([
          passo('EMBARQUE', '2026-03-10T07:00:00', { latitude: null, longitude: null }),
          passo('CHEGADA', '2026-03-10T07:25:00', {
            latitude: null,
            longitude: null,
            statusNotificacao: null,
          }),
        ]),
      );
    await fixture.whenStable();

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Sem localização');
    expect(texto).toContain('aviso ao responsável: Enviada');
    expect(texto).toContain('aviso ao responsável: —');
    // Dia passado: o backend não guarda rastro antigo, então nem pergunta.
    http.expectNone((r) => r.url.includes('/rastreamento'));
    http.verify();
  });

  it('hoje com embarque: busca o rastro do ônibus do embarque', async () => {
    const hoje = isoLocal(new Date());
    const fixture = montar(hoje);
    http
      .expectOne((r) => r.url.endsWith(`/alunos/101/jornadas/${hoje}/locais`))
      .flush(locais([passo('EMBARQUE', `${hoje}T07:00:00`)], hoje));
    await fixture.whenStable();
    http.expectOne((r) => r.url.endsWith('/veiculos/7/rastreamento')).flush({ rastro: [] });
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).not.toContain('Sem localização');
    http.verify();
  });

  it('erro na busca oferece tentar de novo', async () => {
    const fixture = montar('2026-03-10');
    http.expectOne((r) => r.url.includes('/locais')).flush({}, { status: 500, statusText: 'Erro' });
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Tentar de novo');
  });
});
