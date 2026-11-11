import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ChartCard, EstadoCard } from './chart-card';

@Component({
  imports: [ChartCard],
  template: `
    <rs-chart-card
      titulo="Frequência por escola"
      [estado]="estado()"
      [atualizadoEm]="atualizadoEm"
      [tempoLimiteMs]="5000"
      (tentarDeNovo)="tentativas = tentativas + 1"
    >
      <p class="grafico">conteúdo do gráfico</p>
    </rs-chart-card>
  `,
})
class Hospedeiro {
  estado = signal<EstadoCard>('carregando');
  atualizadoEm = new Date(2026, 0, 15, 7, 42);
  tentativas = 0;
}

describe('ChartCard', () => {
  let fixture: ComponentFixture<Hospedeiro>;
  let el: HTMLElement;

  function mudarPara(estado: EstadoCard): void {
    fixture.componentInstance.estado.set(estado);
    fixture.detectChanges();
  }

  beforeEach(() => {
    vi.useFakeTimers();
    fixture = TestBed.createComponent(Hospedeiro);
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  afterEach(() => vi.useRealTimers());

  it('carregando: mostra o esqueleto e esconde o conteúdo', () => {
    expect(el.querySelector('.esqueleto')).not.toBeNull();
    expect(el.querySelector('.grafico')).toBeNull();
    expect(el.querySelector('section')?.getAttribute('aria-busy')).toBe('true');
  });

  it('ok: mostra o conteúdo', () => {
    mudarPara('ok');

    expect(el.querySelector('.grafico')?.textContent).toBe('conteúdo do gráfico');
    expect(el.querySelector('.esqueleto')).toBeNull();
    expect(el.querySelector('.aviso')).toBeNull();
  });

  it('vazio: mostra a mensagem de sem dados', () => {
    mudarPara('vazio');

    expect(el.textContent).toContain('Sem dados para os filtros selecionados.');
    expect(el.querySelector('.grafico')).toBeNull();
  });

  it('erro: mostra a falha com "Tentar de novo"', () => {
    mudarPara('erro');
    const botao = el.querySelector<HTMLButtonElement>('[role="alert"] button')!;

    expect(el.textContent).toContain('Não foi possível carregar os dados.');
    expect(botao.textContent?.trim()).toBe('Tentar de novo');

    botao.click();
    expect(fixture.componentInstance.tentativas).toBe(1);
  });

  it('desatualizado: mantém o conteúdo e avisa com a hora da última atualização', () => {
    mudarPara('desatualizado');

    expect(el.querySelector('.grafico')).not.toBeNull();
    expect(el.querySelector('.aviso')?.textContent).toContain('Dados desatualizados');
    expect(el.querySelector('.aviso')?.textContent).toContain('07:42');
  });

  it('nunca fica preso no esqueleto: passa do tempo limite e vira erro com retry', () => {
    vi.advanceTimersByTime(4_999);
    fixture.detectChanges();
    expect(el.querySelector('.esqueleto')).not.toBeNull();

    vi.advanceTimersByTime(1);
    fixture.detectChanges();

    expect(el.querySelector('.esqueleto')).toBeNull();
    expect(el.textContent).toContain('O carregamento demorou demais.');

    el.querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.tentativas).toBe(1);
    expect(el.querySelector('.esqueleto')).not.toBeNull();
  });

  it('se os dados chegam antes do limite, o temporizador é cancelado', () => {
    vi.advanceTimersByTime(3_000);
    mudarPara('ok');
    vi.advanceTimersByTime(10_000);
    fixture.detectChanges();

    expect(el.querySelector('.grafico')).not.toBeNull();
    expect(el.querySelector('[role="alert"]')).toBeNull();
  });
});
