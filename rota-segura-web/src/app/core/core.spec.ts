import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { TemaService } from './tema/tema.service';
import { ToastService } from './toast/toast.service';

describe('TemaService', () => {
  beforeEach(() => localStorage.clear());

  it('usa o tema escuro por padrão e aplica no documento', () => {
    const tema = TestBed.inject(TemaService);

    expect(tema.tema()).toBe('escuro');
    expect(document.documentElement.getAttribute('data-tema')).toBe('escuro');
  });

  it('alterna para o claro e lembra a escolha', () => {
    TestBed.inject(TemaService).alternar();

    expect(document.documentElement.getAttribute('data-tema')).toBe('claro');
    expect(localStorage.getItem('rs.tema')).toBe('claro');

    TestBed.resetTestingModule();
    expect(TestBed.inject(TemaService).tema()).toBe('claro');
  });
});

describe('ToastService', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('some sozinho depois do tempo, a menos que seja persistente', () => {
    const toasts = TestBed.inject(ToastService);
    toasts.mostrar('Salvo.', 'sucesso');
    toasts.mostrar('Alerta crítico.', 'critico', { persistente: true });

    vi.advanceTimersByTime(6_000);

    expect(toasts.toasts().map((t) => t.mensagem)).toEqual(['Alerta crítico.']);
  });

  it('não empilha a mesma mensagem e fecha por id', () => {
    const toasts = TestBed.inject(ToastService);
    const id = toasts.erro('Falhou.');
    toasts.erro('Falhou.');

    expect(toasts.toasts()).toHaveLength(1);

    toasts.fechar(id);
    expect(toasts.toasts()).toEqual([]);
  });
});
