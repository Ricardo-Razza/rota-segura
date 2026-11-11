import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { IndicadorConexao } from './indicador-conexao';
import { EstadoConexao, SseService } from './sse.service';

describe('IndicadorConexao', () => {
  const estado = signal<EstadoConexao>('desconectado');
  const atrasadoHaMin = signal<number | null>(null);

  function texto(): string {
    const fixture = TestBed.createComponent(IndicadorConexao);
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).textContent!.trim();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: SseService, useValue: { estado, atrasadoHaMin } }],
    });
  });

  it('mostra o estado real da conexão', () => {
    estado.set('online');
    atrasadoHaMin.set(null);
    expect(texto()).toBe('Ao vivo');

    estado.set('reconectando');
    expect(texto()).toBe('Reconectando…');

    estado.set('desconectado');
    expect(texto()).toBe('Desconectado');
  });

  it('o atraso tem prioridade: nunca diz "ao vivo" com dados velhos', () => {
    estado.set('online');
    atrasadoHaMin.set(120);

    expect(texto()).toBe('Atrasado há 120 min');
  });
});
