import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import type * as L from 'leaflet';
import { carga } from '../../core/api/carga';
import { PainelApi } from '../../core/api/painel-api.service';
import { hora } from '../../shared/formato';
import { ChartCard } from '../../shared/ui/chart-card';
import { Icone } from '../../shared/ui/icone';
import { CONFIG_MAPA } from './mapa.config';
import { VELOCIDADES_REPLAY, hojeIso, instante, posicaoNoInstante } from './veiculos.logica';

/** "07:03" de um instante em ms (horário local, o da operação). */
function horaDe(ms: number): string {
  return new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function cor(token: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim() || '#888';
}

/**
 * Replay do trajeto de um dia: escolhe a data, arrasta a linha do tempo (ou dá play) e vê o ônibus andar
 * pelo caminho guardado, com os embarques como pontos. Nada de aluno: o embarque é só hora e local.
 */
@Component({
  selector: 'rs-replay-trajeto',
  imports: [ChartCard, Icone],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <rs-chart-card
      titulo="Replay do trajeto"
      [estado]="trajeto.estado()"
      [atualizadoEm]="trajeto.atualizadoEm()"
      mensagemVazio="Sem trajeto guardado nesse dia. O GPS do ônibus fica guardado por 90 dias."
      (tentarDeNovo)="trajeto.recarregar()"
    >
      <label acoes class="data">
        <span>Dia</span>
        <input
          class="rs-campo"
          type="date"
          [max]="hoje"
          [value]="data()"
          (change)="escolherData($any($event.target).value)"
        />
      </label>
      <div
        #mapa
        class="mapa"
        role="region"
        aria-label="Mapa do replay: caminho do ônibus no dia, posição no momento escolhido e embarques"
      ></div>
      @if (trajeto.dados(); as t) {
        <div class="controles">
          <button
            type="button"
            class="rs-botao rs-botao--pequeno"
            [attr.aria-label]="tocando() ? 'Pausar replay' : 'Reproduzir replay'"
            (click)="alternar()"
          >
            <rs-icone [nome]="tocando() ? 'pause' : 'play'" />
          </button>
          <label class="linha-tempo">
            <span class="rs-somente-leitor">Momento do replay</span>
            <input
              type="range"
              [min]="inicio()"
              [max]="fim()"
              [step]="1000"
              [value]="cursor()"
              [attr.aria-valuetext]="horaCursor()"
              (input)="arrastar(+$any($event.target).value)"
            />
          </label>
          <strong class="rs-mono" aria-live="off">{{ horaCursor() }}</strong>
          <div class="velocidades" role="group" aria-label="Velocidade do replay">
            @for (v of velocidades; track v) {
              <button
                type="button"
                class="rs-botao rs-botao--pequeno"
                [attr.aria-pressed]="velocidade() === v"
                [title]="v + ' min de trajeto por segundo'"
                (click)="velocidade.set(v)"
              >
                {{ v }}×
              </button>
            }
          </div>
        </div>
        <p class="rs-nota">
          {{ t.pontos.length }} pontos de GPS de {{ hora(t.pontos[0]?.em) }} a
          {{ hora(t.pontos[t.pontos.length - 1]?.em) }} · {{ embarcados() }} de
          {{ t.embarques.length }} embarque(s) até agora
          @if (semLocal() > 0) {
            · {{ semLocal() }} sem local (sem GPS naquela hora)
          }
        </p>
        <ul class="legenda" aria-label="Legenda do replay">
          <li><span class="ponto" style="background: var(--info)"></span>Ônibus</li>
          <li><span class="traco"></span>Caminho já feito</li>
          <li><span class="traco traco--claro"></span>Caminho do dia</li>
          <li><span class="ponto" style="background: var(--acento)"></span>Embarque</li>
          <li><span class="ponto ponto--cerca"></span>Escola</li>
        </ul>
      }
    </rs-chart-card>
  `,
  styles: `
    :host {
      display: block;
    }
    .data {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
    }
    .mapa {
      height: clamp(280px, 45dvh, 460px);
      border-radius: var(--raio-sm);
      z-index: 0;
      background: var(--fundo);
    }
    .controles {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 10px;
    }
    .linha-tempo {
      flex: 1;
      min-width: 160px;
    }
    .linha-tempo input {
      width: 100%;
      accent-color: var(--marca-secundaria);
    }
    .velocidades {
      display: flex;
      gap: 4px;
    }
    .velocidades [aria-pressed='true'] {
      border-color: var(--marca-secundaria);
      color: var(--marca-secundaria);
    }
    .legenda {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 14px;
      list-style: none;
      margin: 6px 0 0;
      padding: 0;
      font-size: 12px;
    }
    .ponto {
      display: inline-block;
      width: 10px;
      height: 10px;
      margin-right: 6px;
      border-radius: 50%;
    }
    .ponto--cerca {
      border: 2px dashed var(--marca-secundaria);
    }
    .traco {
      display: inline-block;
      width: 16px;
      height: 3px;
      margin-right: 6px;
      vertical-align: middle;
      border-radius: 2px;
      background: var(--marca-secundaria);
    }
    .traco--claro {
      opacity: 0.3;
    }
  `,
})
export class ReplayTrajeto implements OnDestroy {
  private readonly api = inject(PainelApi);

  readonly veiculoId = input.required<number>();

  protected readonly hora = hora;
  protected readonly velocidades = VELOCIDADES_REPLAY;
  protected readonly hoje = hojeIso();

  protected readonly data = signal(this.hoje);
  protected readonly velocidade = signal<number>(4);
  protected readonly tocando = signal(false);

  protected readonly trajeto = carga(() => this.api.trajeto(this.veiculoId(), this.data()), {
    vazio: (t) => t.pontos.length === 0,
  });

  private readonly tempos = computed(() =>
    (this.trajeto.dados()?.pontos ?? []).map((p) => instante(p.em)),
  );
  protected readonly inicio = computed(() => this.tempos()[0] ?? 0);
  protected readonly fim = computed(() => this.tempos()[this.tempos().length - 1] ?? 0);
  /** Momento mostrado; volta para o início a cada trajeto novo. */
  protected readonly cursor = linkedSignal(() => this.inicio());

  protected readonly horaCursor = computed(() =>
    this.trajeto.dados()?.pontos.length ? horaDe(this.cursor()) : '—',
  );
  protected readonly embarcados = computed(
    () =>
      (this.trajeto.dados()?.embarques ?? []).filter((e) => instante(e.em) <= this.cursor()).length,
  );
  protected readonly semLocal = computed(
    () => (this.trajeto.dados()?.embarques ?? []).filter((e) => e.latitude === null).length,
  );

  private readonly elemento = viewChild.required<ElementRef<HTMLDivElement>>('mapa');
  private leaflet: typeof L | null = null;
  private mapa: L.Map | null = null;
  private camadaFixa: L.LayerGroup | null = null;
  private feito: L.Polyline | null = null;
  private onibus: L.CircleMarker | null = null;
  private embarques: { marcador: L.CircleMarker; ms: number }[] = [];
  private desenhado: unknown = null;
  private quadro = 0;
  private ultimoQuadro = 0;
  private observador: ResizeObserver | null = null;
  /** Saiu da tela: o import do Leaflet pode terminar depois, e o mapa não deve nascer nem se mexer. */
  private destruido = false;

  constructor() {
    afterNextRender(async () => {
      const modulo = (await import('leaflet')) as typeof L & { default?: typeof L };
      if (this.destruido) {
        return;
      }
      this.leaflet = modulo.default ?? modulo;
      const Lf = this.leaflet;
      this.mapa = Lf.map(this.elemento().nativeElement, { preferCanvas: true }).setView(
        CONFIG_MAPA.centro,
        CONFIG_MAPA.zoom,
      );
      Lf.tileLayer(CONFIG_MAPA.urlTiles, {
        maxZoom: 19,
        attribution: CONFIG_MAPA.atribuicao,
      }).addTo(this.mapa);
      this.observador = new ResizeObserver(() => {
        this.mapa?.invalidateSize();
        this.desenhado = null;
        this.desenharTrajeto();
        this.moverOnibus();
      });
      this.observador.observe(this.elemento().nativeElement);
      this.desenharTrajeto();
      this.moverOnibus();
    });
    effect(() => {
      this.desenharTrajeto();
      this.moverOnibus();
    });
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.quadro);
    this.observador?.disconnect();
    // Para a animação de zoom antes de remover: senão o fim dela mexe num mapa que já não existe.
    this.destruido = true;
    this.mapa?.stop();
    this.mapa?.remove();
    this.mapa = null;
  }

  protected escolherData(valor: string): void {
    if (valor) {
      this.parar();
      this.data.set(valor);
    }
  }

  protected arrastar(ms: number): void {
    this.parar();
    this.cursor.set(ms);
  }

  protected alternar(): void {
    if (this.tocando()) {
      this.parar();
      return;
    }
    if (this.cursor() >= this.fim()) {
      this.cursor.set(this.inicio());
    }
    this.tocando.set(true);
    this.ultimoQuadro = performance.now();
    this.quadro = requestAnimationFrame((t) => this.passo(t));
  }

  private passo(agora: number): void {
    if (!this.tocando()) {
      return;
    }
    const decorrido = agora - this.ultimoQuadro;
    this.ultimoQuadro = agora;
    // Velocidade = minutos de trajeto por segundo de animação.
    const proximo = Math.min(this.fim(), this.cursor() + decorrido * this.velocidade() * 60);
    this.cursor.set(proximo);
    if (proximo >= this.fim()) {
      this.tocando.set(false);
      return;
    }
    this.quadro = requestAnimationFrame((t) => this.passo(t));
  }

  private parar(): void {
    this.tocando.set(false);
    cancelAnimationFrame(this.quadro);
  }

  /** Caminho, escola e embarques: só redesenha quando chega outro trajeto. */
  private desenharTrajeto(): void {
    const t = this.trajeto.dados();
    const Lf = this.leaflet;
    if (!Lf || !this.mapa || t === this.desenhado) {
      return;
    }
    this.desenhado = t;
    this.camadaFixa?.remove();
    this.camadaFixa = Lf.layerGroup().addTo(this.mapa);
    this.embarques = [];
    this.feito = null;
    this.onibus = null;
    if (!t || t.pontos.length === 0) {
      return;
    }
    const caminho = t.pontos.map((p) => [p.latitude, p.longitude] as L.LatLngExpression);
    const azul = cor('--marca-secundaria');
    const enquadrar: L.LatLngExpression[] = [...caminho];
    if (t.escola) {
      Lf.circle([t.escola.latitude, t.escola.longitude], {
        radius: t.escola.raioM,
        color: azul,
        weight: 1.5,
        dashArray: '6 6',
        fillOpacity: 0.06,
        interactive: false,
      }).addTo(this.camadaFixa);
      enquadrar.push([t.escola.latitude, t.escola.longitude]);
    }
    Lf.polyline(caminho, { color: azul, weight: 4, opacity: 0.25, interactive: false }).addTo(
      this.camadaFixa,
    );
    this.feito = Lf.polyline([], {
      color: azul,
      weight: 5,
      opacity: 0.9,
      interactive: false,
    }).addTo(this.camadaFixa);
    const amarelo = cor('--acento');
    for (const e of t.embarques) {
      if (e.latitude === null || e.longitude === null) {
        continue;
      }
      const marcador = Lf.circleMarker([e.latitude, e.longitude], {
        radius: 6,
        color: amarelo,
        weight: 2,
        fillColor: amarelo,
        fillOpacity: 0.15,
      })
        .bindTooltip(`Embarque às ${hora(e.em)}`)
        .addTo(this.camadaFixa);
      this.embarques.push({ marcador, ms: instante(e.em) });
    }
    const info = cor('--info');
    this.onibus = Lf.circleMarker(caminho[0], {
      radius: 9,
      color: cor('--texto'),
      weight: 2,
      fillColor: info,
      fillOpacity: 0.95,
    }).addTo(this.camadaFixa);
    this.mapa.fitBounds(Lf.latLngBounds(enquadrar), {
      padding: [30, 30],
      maxZoom: 16,
      animate: false,
    });
  }

  /** Ônibus, caminho já feito e embarques já ocorridos no momento escolhido. */
  private moverOnibus(): void {
    const ms = this.cursor();
    const pontos = this.trajeto.dados()?.pontos ?? [];
    if (!this.onibus || !this.feito) {
      return;
    }
    const aqui = posicaoNoInstante(pontos, ms);
    if (!aqui) {
      return;
    }
    this.onibus.setLatLng([aqui.latitude, aqui.longitude]);
    this.feito.setLatLngs([
      ...pontos
        .slice(0, aqui.indice + 1)
        .map((p) => [p.latitude, p.longitude] as L.LatLngExpression),
      [aqui.latitude, aqui.longitude],
    ]);
    for (const e of this.embarques) {
      e.marcador.setStyle({ fillOpacity: e.ms <= ms ? 0.95 : 0.15 });
    }
  }
}
