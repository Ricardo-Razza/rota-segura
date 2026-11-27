import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, input, output, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { EMPTY } from 'rxjs';
import { SseService } from '../../core/sse/sse.service';
import { DetalheDoVeiculo } from './detalhe-veiculo';
import { MapaVeiculos } from './mapa-veiculos';
import { Veiculos } from './veiculos';

@Component({ selector: 'rs-mapa-veiculos', template: '' })
class MapaFalso {
  readonly veiculos = input<unknown[]>([]);
  readonly rastreios = input<unknown[]>([]);
  readonly raioCercaM = input(0);
  readonly selecionadoId = input<number | null>(null);
  readonly altura = input('');
  readonly selecionar = output<number>();
}

@Component({ selector: 'rs-detalhe-veiculo', template: '' })
class DetalheFalso {
  readonly veiculoId = input.required<number>();
  readonly veiculos = input<unknown[]>([]);
  readonly rastreios = input<unknown[]>([]);
  readonly raioCercaM = input(0);
  readonly agora = input(0);
  readonly fechar = output<void>();
  readonly selecionar = output<number>();
}

describe('Frota (tela)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: SseService,
          useValue: { estado: signal('online'), atrasadoHaMin: signal(null), de: () => EMPTY },
        },
      ],
    });
    TestBed.overrideComponent(Veiculos, {
      remove: { imports: [MapaVeiculos, DetalheDoVeiculo] },
      add: { imports: [MapaFalso, DetalheFalso] },
    });
  });

  it('o detalhe do veículo ocupa o lugar do mapa da frota, e fechar devolve o mapa', async () => {
    const fixture = TestBed.createComponent(Veiculos);
    const el = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    await fixture.whenStable();
    // O card só mostra o mapa depois que a lista de veículos chega.
    TestBed.inject(HttpTestingController)
      .expectOne((r) => r.url === '/api/v1/veiculos/status')
      .flush({
        avaliadoEm: '2026-03-10T07:00:00',
        porEstado: {},
        veiculos: [{ id: 7, placa: 'AAA0A07', prefixo: 'R-07', estado: 'EM_ROTA', leitores: [] }],
        desatualizado: false,
        incompleto: false,
      });
    await fixture.whenStable();
    expect(el.querySelector('rs-mapa-veiculos')).toBeTruthy();
    expect(el.querySelector('rs-detalhe-veiculo')).toBeNull();

    fixture.componentRef.setInput('veiculo', '7');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el.querySelector('rs-detalhe-veiculo')).toBeTruthy();
    expect(el.querySelector('rs-mapa-veiculos')).toBeNull();

    const detalhe = fixture.debugElement.query((d) => d.componentInstance instanceof DetalheFalso);
    (detalhe.componentInstance as DetalheFalso).fechar.emit();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el.querySelector('rs-detalhe-veiculo')).toBeNull();
    expect(el.querySelector('rs-mapa-veiculos')).toBeTruthy();
  });
});
