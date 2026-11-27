import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { JornadaDoDia } from '../../core/api/modelos';
import { EstadoJornada } from '../../shared/ui/tom';
import { CalendarioHistorico } from './calendario-historico';
import { CampoAno } from './campo-ano';

function dia(data: string, estado: EstadoJornada, extra: Partial<JornadaDoDia> = {}): JornadaDoDia {
  const comLeitura = estado !== 'AUSENTE';
  return {
    alunoId: 101,
    data,
    estado,
    embarqueEm: comLeitura ? `${data}T07:02:00` : null,
    veiculoId: comLeitura ? 7 : null,
    chegadaEm: estado === 'NA_ESCOLA' ? `${data}T07:31:00` : null,
    escolaId: 1,
    tempoTrajetoMin: estado === 'NA_ESCOLA' ? 29 : null,
    divergencias: [],
    passos: [],
    leiturasIgnoradas: { duplicadas: 0, foraDeOrdem: 0 },
    ...extra,
  };
}

describe('campo de ano letivo', () => {
  let fixture: ComponentFixture<CampoAno>;
  let emitidos: number[];

  beforeEach(async () => {
    fixture = TestBed.createComponent(CampoAno);
    fixture.componentRef.setInput('ano', 2026);
    fixture.componentRef.setInput('anoAtual', 2026);
    emitidos = [];
    fixture.componentInstance.anoEscolhido.subscribe((a) => emitidos.push(a));
    await fixture.whenStable();
  });

  const el = () => fixture.nativeElement as HTMLElement;
  const campo = () => el().querySelector('input')!;
  const erro = () => el().querySelector('[role="alert"]')!.textContent!.trim();
  const botao = (nome: string) =>
    el().querySelector<HTMLButtonElement>(`button[aria-label="${nome}"]`)!;

  async function digitar(texto: string, fim: 'enter' | 'sair' | null = 'enter') {
    campo().value = texto;
    campo().dispatchEvent(new Event('input'));
    if (fim === 'enter') {
      campo().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    } else if (fim === 'sair') {
      campo().dispatchEvent(new Event('blur'));
    }
    await fixture.whenStable();
  }

  it('ignora letras e não busca enquanto se digita', async () => {
    await digitar('2o0x25', null);
    expect(campo().value).toBe('2025');
    expect(emitidos).toEqual([]);
  });

  it('Enter ou sair do campo escolhem o ano', async () => {
    await digitar('2024');
    await digitar('2023', 'sair');
    expect(emitidos).toEqual([2024, 2023]);
    expect(erro()).toBe('');
  });

  it('ano inválido avisa e não busca', async () => {
    await digitar('20');
    expect(erro()).toBe('Digite o ano com 4 números.');
    expect(campo().getAttribute('aria-invalid')).toBe('true');
    await digitar('2030');
    expect(erro()).toBe('2030 ainda não começou. O ano mais recente é 2026.');
    expect(emitidos).toEqual([]);
  });

  it('sair com o campo vazio devolve o ano aberto', async () => {
    await digitar('', 'sair');
    expect(campo().value).toBe('2026');
    expect(erro()).toBe('');
    expect(emitidos).toEqual([]);
  });

  it('as setas passam de ano e não vão além do atual', () => {
    expect(botao('Próximo ano').disabled).toBe(true);
    botao('Ano anterior').click();
    expect(emitidos).toEqual([2025]);
  });
});

describe('calendário do histórico', () => {
  let fixture: ComponentFixture<CalendarioHistorico>;
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 2, 10, 12, 0));
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CalendarioHistorico);
    fixture.componentRef.setInput('alunoId', 101);
  });

  afterEach(() => vi.useRealTimers());

  const el = () => fixture.nativeElement as HTMLElement;
  const texto = (seletor: string) =>
    el().querySelector(seletor)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const botao = (nome: string) =>
    [...el().querySelectorAll('button')].find(
      (b) => (b.getAttribute('aria-label') ?? b.textContent!.trim()) === nome,
    )!;

  /** Responde cada janela pedida só com os dias dela. Devolve os parâmetros pedidos. */
  async function responder(jornadas: JornadaDoDia[]) {
    fixture.detectChanges();
    await fixture.whenStable();
    const pedidos = http.match((r) => r.url.endsWith('/alunos/101/jornadas'));
    const janelas = pedidos.map((p) => ({
      inicio: p.request.params.get('inicio')!,
      fim: p.request.params.get('fim')!,
    }));
    pedidos.forEach((p, i) =>
      p.flush(jornadas.filter((j) => j.data >= janelas[i].inicio && j.data <= janelas[i].fim)),
    );
    await fixture.whenStable();
    return janelas;
  }

  const DIAS = [
    dia('2026-02-27', 'NA_ESCOLA'),
    dia('2026-03-05', 'AUSENTE'),
    dia('2026-03-09', 'DIVERGENTE', {
      divergencias: [{ tipo: 'EMBARCOU_SEM_CHEGADA', detectadaEm: '2026-03-09T07:45:00' }],
      passos: [
        {
          dataHora: '2026-03-09T07:02:00',
          tipo: 'EMBARQUE',
          leitorId: 501,
          veiculoId: 7,
          escolaId: 1,
          estadoResultante: 'EMBARCADO',
          leituraId: 1,
        },
      ],
    }),
  ];

  it('busca o ano atual do começo até hoje e abre o mês de hoje', async () => {
    const janelas = await responder(DIAS);
    expect(janelas.map((j) => j.inicio).sort()[0]).toBe('2026-01-01');
    expect(
      janelas
        .map((j) => j.fim)
        .sort()
        .at(-1),
    ).toBe('2026-03-10');
    expect(botao('05/03: Ausente')).toBeTruthy();
    expect(botao('09/03: Divergente')).toBeTruthy();
    expect(botao('Mar').getAttribute('aria-pressed')).toBe('true');
    expect(botao('Abr').disabled).toBe(true);
  });

  it('abre o detalhe do dia mais recente e troca ao clicar em outro', async () => {
    await responder(DIAS);
    expect(texto('.detalhe-dia')).toContain('9 de março');
    expect(texto('.detalhe-dia')).toContain('Embarcou e não chegou na janela');
    expect(texto('.detalhe-dia')).toContain('Leitor #501');
    expect(botao('Ver no mapa onde embarcou e chegou em 09/03')).toBeTruthy();

    botao('05/03: Ausente').click();
    await fixture.whenStable();
    expect(texto('.detalhe-dia')).toContain('5 de março');
    expect(texto('.detalhe-dia')).toContain('Nenhuma leitura no ônibus');
  });

  it('visão do ano mostra os meses com a presença, e clicar abre o mês', async () => {
    await responder(DIAS);
    botao('Ano inteiro').click();
    await fixture.whenStable();
    expect(botao('Fevereiro: 100% de presença. Abrir mês')).toBeTruthy();
    botao('Fevereiro: 100% de presença. Abrir mês').click();
    await fixture.whenStable();
    expect(botao('27/02: Na escola')).toBeTruthy();
  });

  it('ao trocar de aluno, não mostra os dias nem a escolha do aluno anterior', async () => {
    await responder(DIAS);
    botao('05/03: Ausente').click();
    await fixture.whenStable();

    fixture.componentRef.setInput('alunoId', 102);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el().querySelector('.grade')).toBeNull();

    http
      .match((r) => r.url.endsWith('/alunos/102/jornadas'))
      .forEach((p) =>
        p.flush(
          DIAS.filter((d) => d.data.slice(0, 7) === p.request.params.get('fim')!.slice(0, 7)),
        ),
      );
    await fixture.whenStable();
    expect(texto('.detalhe-dia')).toContain('9 de março');
  });

  it('se a busca do outro aluno falhar, não sobra o calendário do anterior', async () => {
    await responder(DIAS);
    fixture.componentRef.setInput('alunoId', 102);
    fixture.detectChanges();
    await fixture.whenStable();
    // A primeira janela que falha cancela as demais.
    http
      .match((r) => r.url.endsWith('/alunos/102/jornadas'))[0]
      .flush('', { status: 500, statusText: 'Erro' });
    await fixture.whenStable();
    expect(el().querySelector('.grade')).toBeNull();
    expect(el().textContent).toContain('Tentar de novo');
  });

  it('trocar de ano busca o ano inteiro; sem leitura, mostra "Nenhum registro"', async () => {
    await responder(DIAS);
    botao('Ano anterior').click();
    const janelas = await responder([dia('2025-05-05', 'AUSENTE')]);
    expect(janelas.length).toBe(12);
    expect(texto('.sem-registro')).toContain('Nenhum registro em 2025');
    expect(el().querySelector('.grade')).toBeNull();

    botao('Voltar para 2026').click();
    await responder(DIAS);
    expect(botao('09/03: Divergente')).toBeTruthy();
  });
});
