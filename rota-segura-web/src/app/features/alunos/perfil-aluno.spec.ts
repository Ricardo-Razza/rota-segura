import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PerfilAluno } from './perfil-aluno';

const PERFIL = {
  aluno: {
    id: 101,
    nome: 'Ana Exemplo',
    iniciais: 'AE',
    turmaId: 1,
    turma: '3º A',
    anoEscolar: '3º ano',
    turno: 'Matutino',
    escolaId: 1,
    escolaNome: 'Escola Modelo Fictícia',
    veiculoId: 7,
    biometria: true,
  },
  jornadaHoje: null,
  responsaveis: [],
  situacaoResponsaveis: { pronto: true, completo: true },
  desatualizado: false,
};

describe('Perfil do aluno', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 27, 12, 0));
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
  });

  afterEach(() => vi.useRealTimers());

  async function abrir() {
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(PerfilAluno);
    fixture.componentRef.setInput('id', '101');
    fixture.detectChanges();
    await fixture.whenStable();
    http.expectOne((r) => r.url.endsWith('/alunos/101/perfil')).flush(PERFIL);
    const pedidos = http.match((r) => r.url.endsWith('/alunos/101/jornadas'));
    await fixture.whenStable();
    return { el: fixture.nativeElement as HTMLElement, pedidos };
  }

  it('mostra o aluno numa faixa com nome, dados em uma linha e o caminho de volta', async () => {
    const { el } = await abrir();
    const faixa = el.querySelector('.cabecalho')!;
    expect(faixa.querySelector('h1')!.textContent!.trim()).toBe('Ana Exemplo');
    expect(faixa.querySelector('p')!.textContent!.replace(/\s+/g, ' ').trim()).toBe(
      '3º A · 3º ano · Matutino · Escola Modelo Fictícia | Veículo #7 | Biometria cadastrada',
    );
    expect(faixa.querySelector('a[aria-label="Voltar para Alunos"]')).toBeTruthy();
  });

  it('troca a lista e o quadro de 90 dias pelo calendário, com indicadores compactos', async () => {
    const { el } = await abrir();
    expect(el.querySelector('rs-calendario-historico')).toBeTruthy();
    expect(el.textContent).not.toContain('Presença nos últimos 90 dias letivos');
    expect(el.querySelectorAll('rs-kpi-card.compacto').length).toBe(4);
    expect(el.querySelector('rs-chart-card.baixo')!.textContent).toContain('Responsáveis');
  });

  it('pede dias corridos suficientes para 90 dias letivos', async () => {
    const { pedidos } = await abrir();
    const inicios = pedidos.map((p) => p.request.params.get('inicio')!).sort();
    // 140 dias corridos até 27/11/2026.
    expect(inicios).toContain('2026-07-11');
  });
});
