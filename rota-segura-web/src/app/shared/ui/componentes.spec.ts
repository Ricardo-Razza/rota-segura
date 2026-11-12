import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Coluna, DataTable } from './data-table';
import { DateRangePicker, periodoDoPreset } from './date-range-picker';
import { FilterChips } from './filter-chips';
import { KpiCard } from './kpi-card';
import { StatusBadge } from './status-badge';
import { JORNADA } from './tom';

describe('KpiCard', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  function criar(entradas: Record<string, unknown>): HTMLElement {
    const fixture = TestBed.createComponent(KpiCard);
    for (const [nome, valor] of Object.entries(entradas)) {
      fixture.componentRef.setInput(nome, valor);
    }
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  it('formata número em pt-BR e aplica o tom', () => {
    const el = criar({ rotulo: 'Alunos ativos', valor: 1284, tom: 'info' });

    expect(el.querySelector('.valor')?.textContent).toBe('1.284');
    expect(el.querySelector('.kpi--info')).not.toBeNull();
    expect(el.querySelector('a')).toBeNull();
  });

  it('sem dado mostra travessão, nunca zero', () => {
    expect(criar({ rotulo: 'Frequência', valor: null }).querySelector('.valor')?.textContent).toBe(
      '—',
    );
  });

  it('com link vira um atalho navegável', () => {
    const el = criar({ rotulo: 'Alertas abertos', valor: 3, link: '/alertas' });

    expect(el.querySelector('a')?.getAttribute('href')).toBe('/alertas');
  });

  it('carregando sinaliza aria-busy', () => {
    const el = criar({ rotulo: 'Na escola', carregando: true });

    expect(el.querySelector('.valor')?.getAttribute('aria-busy')).toBe('true');
    expect(el.querySelector('.valor')?.textContent).toBe('…');
  });
});

describe('StatusBadge', () => {
  it('mostra texto e tom; os cinco estados da jornada têm rótulo e tom', () => {
    const fixture = TestBed.createComponent(StatusBadge);
    fixture.componentRef.setInput('texto', JORNADA.DIVERGENTE.rotulo);
    fixture.componentRef.setInput('tom', JORNADA.DIVERGENTE.tom);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.badge--critico')?.textContent).toContain(
      'Divergente',
    );
    expect(Object.keys(JORNADA)).toEqual([
      'AGUARDANDO',
      'EMBARCADO',
      'NA_ESCOLA',
      'AUSENTE',
      'DIVERGENTE',
    ]);
  });
});

describe('FilterChips', () => {
  function criar(multiplo: boolean) {
    const fixture = TestBed.createComponent(FilterChips);
    fixture.componentRef.setInput('rotulo', 'Severidade');
    fixture.componentRef.setInput('multiplo', multiplo);
    fixture.componentRef.setInput('opcoes', [
      { valor: 'critico', rotulo: 'Críticos', contador: 3 },
      { valor: 'atencao', rotulo: 'Atenção', contador: 0 },
    ]);
    fixture.detectChanges();
    const botoes = () => [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')];
    return { fixture, botoes };
  }

  it('seleção única: escolher outro troca, clicar de novo limpa', () => {
    const { fixture, botoes } = criar(false);

    botoes()[0].click();
    botoes()[1].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.selecionados()).toEqual(['atencao']);
    expect(botoes()[1].getAttribute('aria-pressed')).toBe('true');
    expect(botoes()[0].getAttribute('aria-pressed')).toBe('false');

    botoes()[1].click();
    expect(fixture.componentInstance.selecionados()).toEqual([]);
  });

  it('seleção múltipla acumula e mostra contador, inclusive zero', () => {
    const { fixture, botoes } = criar(true);

    botoes()[0].click();
    botoes()[1].click();

    expect(fixture.componentInstance.selecionados()).toEqual(['critico', 'atencao']);
    expect(botoes()[0].querySelector('.contador')?.textContent).toBe('3');
    expect(botoes()[1].querySelector('.contador')?.textContent).toBe('0');
  });
});

describe('DateRangePicker', () => {
  const quarta = new Date(2026, 10, 11, 15, 30); // 11/11/2026

  it('calcula os atalhos contando o dia de hoje', () => {
    expect(periodoDoPreset('hoje', quarta)).toEqual({
      preset: 'hoje',
      inicio: '2026-11-11',
      fim: '2026-11-11',
    });
    expect(periodoDoPreset('7dias', quarta)).toEqual({
      preset: '7dias',
      inicio: '2026-11-05',
      fim: '2026-11-11',
    });
    expect(periodoDoPreset('30dias', quarta)).toEqual({
      preset: '30dias',
      inicio: '2026-10-13',
      fim: '2026-11-11',
    });
    expect(periodoDoPreset('mes', quarta)).toEqual({
      preset: 'mes',
      inicio: '2026-11-01',
      fim: '2026-11-11',
    });
  });

  it('atravessa a virada de mês e de ano', () => {
    expect(periodoDoPreset('7dias', new Date(2027, 0, 3)).inicio).toBe('2026-12-28');
  });

  it('"7 dias" vem pré-selecionado e os atalhos trocam o período', () => {
    const fixture = TestBed.createComponent(DateRangePicker);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const ativo = () => el.querySelector('.atalho--ativo')?.textContent?.trim();

    expect(fixture.componentInstance.periodo().preset).toBe('7dias');
    expect(ativo()).toBe('7 dias');

    [...el.querySelectorAll<HTMLButtonElement>('.atalho')]
      .find((b) => b.textContent?.includes('Hoje'))!
      .click();
    fixture.detectChanges();

    expect(fixture.componentInstance.periodo().preset).toBe('hoje');
    expect(ativo()).toBe('Hoje');
  });

  it('datas digitadas viram período personalizado; intervalo invertido é recusado', () => {
    const fixture = TestBed.createComponent(DateRangePicker);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const [inicio, fim] = [...el.querySelectorAll<HTMLInputElement>('input[type="date"]')];
    const fimOriginal = fixture.componentInstance.periodo().fim;

    inicio.value = '2026-01-10';
    inicio.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(fixture.componentInstance.periodo()).toEqual({
      preset: 'personalizado',
      inicio: '2026-01-10',
      fim: fimOriginal,
    });

    fim.value = '2025-12-31';
    fim.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(fixture.componentInstance.periodo().fim).toBe(fimOriginal);
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('não pode ser depois');
  });
});

describe('DataTable', () => {
  interface Linha {
    escola: string;
    frequencia: number | null;
  }
  const colunas: Coluna<Linha>[] = [
    { chave: 'escola', titulo: 'Escola', valor: (l) => l.escola },
    { chave: 'frequencia', titulo: 'Frequência', valor: (l) => l.frequencia, alinhar: 'direita' },
  ];

  function criar(linhas: Linha[]) {
    const fixture = TestBed.createComponent(DataTable<Linha>);
    fixture.componentRef.setInput('colunas', colunas);
    fixture.componentRef.setInput('linhas', linhas);
    fixture.componentRef.setInput('legenda', 'Frequência por escola');
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const primeiraColuna = () =>
      [...el.querySelectorAll('tbody tr')].map((tr) => tr.querySelector('td')?.textContent?.trim());
    const clicar = (indice: number) => {
      el.querySelectorAll<HTMLButtonElement>('th button')[indice].click();
      fixture.detectChanges();
    };
    return { el, primeiraColuna, clicar };
  }

  const linhas: Linha[] = [
    { escola: 'Escola B', frequencia: 78.4 },
    { escola: 'Escola C', frequencia: null },
    { escola: 'Escola A', frequencia: 93.1 },
  ];

  it('ordena por coluna: crescente, decrescente e volta à ordem original', () => {
    const { el, primeiraColuna, clicar } = criar(linhas);
    expect(primeiraColuna()).toEqual(['Escola B', 'Escola C', 'Escola A']);

    clicar(0);
    expect(primeiraColuna()).toEqual(['Escola A', 'Escola B', 'Escola C']);
    expect(el.querySelector('th')?.getAttribute('aria-sort')).toBe('ascending');

    clicar(0);
    expect(primeiraColuna()).toEqual(['Escola C', 'Escola B', 'Escola A']);

    clicar(0);
    expect(primeiraColuna()).toEqual(['Escola B', 'Escola C', 'Escola A']);
  });

  it('ordena números como números e deixa "sem valor" sempre no fim', () => {
    const { el, primeiraColuna, clicar } = criar(linhas);

    clicar(1);
    expect(primeiraColuna()).toEqual(['Escola B', 'Escola A', 'Escola C']);
    clicar(1);
    expect(primeiraColuna()).toEqual(['Escola A', 'Escola B', 'Escola C']);
    expect(el.querySelectorAll('tbody tr')[2].querySelectorAll('td')[1].textContent?.trim()).toBe(
      '—',
    );
  });

  it('sem linhas mostra o estado vazio e tem legenda para leitor de tela', () => {
    const { el } = criar([]);

    expect(el.querySelector('.vazio')?.textContent).toBe('Nenhum registro encontrado.');
    expect(el.querySelector('caption')?.textContent?.trim()).toBe('Frequência por escola');
  });
});
