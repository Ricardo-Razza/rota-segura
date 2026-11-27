import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, input, output } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { EMPTY } from 'rxjs';
import { DetalheVeiculo, StatusVeiculo } from '../../core/api/modelos';
import { SseService } from '../../core/sse/sse.service';
import { DetalheDoVeiculo } from './detalhe-veiculo';
import { MapaVeiculos } from './mapa-veiculos';
import { ReplayTrajeto } from './replay-trajeto';

/** Mapas de mentira: o Leaflet não desenha no ambiente de teste. */
@Component({
  selector: 'rs-replay-trajeto',
  template: '<ng-content select="[visao]" /><ng-content select="[rodape]" />',
})
class ReplayFalso {
  readonly veiculoId = input.required<number>();
  readonly paradas = input<unknown[]>([]);
  readonly oculto = input(false);
}

@Component({ selector: 'rs-mapa-veiculos', template: '' })
class MapaFalso {
  readonly veiculos = input<unknown[]>([]);
  readonly rastreios = input<unknown[]>([]);
  readonly raioCercaM = input(0);
  readonly selecionadoId = input<number | null>(null);
  readonly paradas = input<unknown[]>([]);
  readonly altura = input('');
  readonly selecionar = output<number>();
}

/** Veículo fictício. */
function status(id: number): StatusVeiculo {
  return {
    id,
    placa: `AAA0A0${id}`,
    prefixo: `R-0${id}`,
    descricao: null,
    estado: 'EM_ROTA',
    embarcados: 8,
    aBordo: 8,
    chegaram: 0,
    esperados: 22,
    capacidade: 44,
    ocupacao: 18,
    faixaOcupacao: 'OK',
    escolaId: 1,
    latitude: null,
    longitude: null,
    leitores: [],
    ultimaLeitura: '2026-03-10T07:13:00',
    saida: '2026-03-10T06:42:00',
    tempoMedioMin: 46,
    previsaoChegada: '2026-03-10T07:31:00',
    origemPrevisao: 'GPS',
    chegadaNormal: '07:27:00',
    diferencaMin: 4,
  };
}

function detalhe(id: number): DetalheVeiculo {
  return {
    veiculo: status(id),
    embarcados: [
      {
        alunoId: 101,
        iniciais: 'AE',
        turma: '3º A',
        estado: 'EMBARCADO',
        embarqueEm: '2026-03-10T06:42:00',
        chegadaEm: null,
      },
    ],
    ultimasLeituras: [
      { dataHora: '2026-03-10T07:13:00', leitorId: 507, tipo: 'EMBARQUE', alunoId: 101 },
    ],
    desatualizado: false,
    incompleto: false,
  };
}

describe('detalhe do veículo', () => {
  let fixture: ComponentFixture<DetalheDoVeiculo>;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: SseService, useValue: { de: () => EMPTY } },
      ],
    });
    TestBed.overrideComponent(DetalheDoVeiculo, {
      remove: { imports: [MapaVeiculos, ReplayTrajeto] },
      add: { imports: [MapaFalso, ReplayFalso] },
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(DetalheDoVeiculo);
    fixture.componentRef.setInput('veiculoId', 7);
    fixture.componentRef.setInput('veiculos', [status(7), status(8)]);
    await atualizar();
  });

  const el = () => fixture.nativeElement as HTMLElement;
  const texto = (seletor = ':scope') =>
    (seletor === ':scope' ? el() : el().querySelector(seletor))?.textContent
      ?.replace(/\s+/g, ' ')
      .trim() ?? '';
  const botao = (nome: string) =>
    [...el().querySelectorAll('button')].find(
      (b) => (b.getAttribute('aria-label') ?? b.textContent!.trim()) === nome,
    )!;
  const replay = () =>
    fixture.debugElement.query(By.directive(ReplayFalso))?.componentInstance as ReplayFalso;
  const mapaAoVivo = () => el().querySelector('rs-mapa-veiculos');

  async function atualizar() {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function responder(id: number) {
    http.expectOne(`/api/v1/veiculos/${id}`).flush(detalhe(id));
    await atualizar();
  }

  it('mostra o resumo numa faixa e o replay como mapa principal', async () => {
    await responder(7);
    expect(texto('h2')).toBe('R-07 · AAA0A07');
    const resumo = [...el().querySelectorAll('.dados div')].map((d) =>
      [...d.querySelectorAll('dt, dd')]
        .map((e) => e.textContent!.replace(/\s+/g, ' ').trim())
        .join(': '),
    );
    expect(resumo).toContain('Saída (1º embarque): 06:42');
    expect(resumo.find((r) => r.startsWith('Previsão de chegada: 07:31'))).toBeTruthy();
    expect(resumo).toContain('Tempo médio: 46 min');
    expect(resumo).toContain('A bordo: 8 de 22');
    expect(resumo.find((r) => /^Ocupação: .*% de 44$/.test(r))).toBeTruthy();
    expect(replay().veiculoId()).toBe(7);
    expect(replay().oculto()).toBe(false);
    expect(mapaAoVivo()).toBeNull();
  });

  it('embarque e desembarque começa oculto; o botão mostra e oculta', async () => {
    await responder(7);
    expect(texto('.embarques')).toContain('8 embarcados · última leitura às 07:13');
    expect(el().querySelector('.rs-lista')).toBeNull();
    expect(botao('Mostrar').getAttribute('aria-expanded')).toBe('false');

    botao('Mostrar').click();
    await atualizar();
    expect(texto('.embarques')).toContain('AE · 3º A');
    expect(texto('.embarques')).toContain('aluno #101');
    expect(el().querySelector('.embarques a')!.getAttribute('href')).toBe('/jornada?onibus=7');

    botao('Ocultar').click();
    await atualizar();
    expect(el().querySelector('.rs-lista')).toBeNull();
  });

  it('"Ao vivo" troca o mapa, e outro veículo volta a abrir no replay', async () => {
    await responder(7);
    botao('Ao vivo').click();
    await atualizar();
    expect(mapaAoVivo()).toBeTruthy();
    expect(replay().oculto()).toBe(true);

    fixture.componentRef.setInput('veiculoId', 8);
    await atualizar();
    await responder(8);
    expect(mapaAoVivo()).toBeNull();
    expect(replay().oculto()).toBe(false);
  });

  it('paradas aprendidas só são consultadas quando ligadas (a consulta é auditada)', async () => {
    await responder(7);
    http.expectNone('/api/v1/veiculos/7/paradas');
    el().querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
    await atualizar();
    http.expectOne('/api/v1/veiculos/7/paradas').flush({
      veiculoId: 7,
      diasAnalisados: 9,
      embarquesLocalizados: 9,
      paradas: [
        {
          latitude: -10,
          longitude: -50,
          embarques: 9,
          alunos: 1,
          dias: 9,
          horariosTipicos: ['06:51:00'],
        },
      ],
    });
    await atualizar();
    expect(replay().paradas()).toHaveLength(1);
    expect(texto()).toContain('1 parada(s) em 9 dia(s)');
  });

  it('não mostra o veículo anterior enquanto o novo carrega nem se a busca falhar', async () => {
    await responder(7);
    fixture.componentRef.setInput('veiculoId', 8);
    await atualizar();
    expect(texto()).not.toContain('AAA0A07');

    http.expectOne('/api/v1/veiculos/8').flush('', { status: 500, statusText: 'Erro' });
    await atualizar();
    expect(texto()).not.toContain('AAA0A07');
    expect(texto()).toContain('Tentar de novo');
  });

  it('"Voltar ao mapa da frota" avisa a tela', async () => {
    await responder(7);
    let fechou = false;
    fixture.componentInstance.fechar.subscribe(() => (fechou = true));
    botao('Voltar ao mapa da frota').click();
    expect(fechou).toBe(true);
  });
});
