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
  viewChild,
} from '@angular/core';
import type * as L from 'leaflet';
import { catchError, of } from 'rxjs';
import { carga } from '../../core/api/carga';
import { PainelApi } from '../../core/api/painel-api.service';
import { hora, isoLocal } from '../../shared/formato';
import { ICONES, NomeIcone } from '../../shared/ui/icone';
import { CONFIG_MAPA } from '../veiculos/mapa.config';
import { pontosDaJornada, rotuloPasso, trechoDoRastro, veiculoDoEmbarque } from './locais.logica';

function cor(token: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim() || '#888';
}

function svgIcone(nome: NomeIcone): string {
  const tracos = ICONES[nome].map((d) => `<path d="${d}"/>`).join('');
  return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${tracos}</svg>`;
}

/**
 * Onde o aluno pegou o ônibus e onde chegou, num mapa pequeno com o trecho do rastro do ônibus (só hoje).
 * O embarque é a posição do ônibus na hora da leitura (trajeto guardado no backend por 90 dias); sem
 * trajeto, aparece "local exato indisponível" em vez de um ponto errado. A chegada é o ponto do leitor da
 * escola. Nada de nome no mapa, e as coordenadas não vão para a URL.
 */
@Component({
  selector: 'rs-mapa-jornada',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      #mapa
      class="mapa"
      [hidden]="!temPontos()"
      role="region"
      aria-label="Mapa com o local de embarque e de chegada do aluno"
    ></div>

    @if (locais.carregando() && !locais.dados()) {
      <p class="rs-nota" role="status">Buscando o local das leituras…</p>
    } @else if (locais.estado() === 'erro') {
      <p class="rs-aviso">
        Não foi possível buscar o local das leituras.
        <button type="button" class="rs-botao rs-botao--pequeno" (click)="locais.recarregar()">
          Tentar de novo
        </button>
      </p>
    } @else if (locais.dados(); as l) {
      @if (l.passos.length === 0) {
        <p class="rs-nota">Nenhuma leitura neste dia.</p>
      } @else if (!temPontos()) {
        <p class="rs-nota sem-local">
          Sem localização: não há trajeto do ônibus guardado para esse horário.
        </p>
      }
      @if (l.incompleto || l.desatualizado) {
        <p class="rs-nota">
          {{
            l.incompleto
              ? 'Parte dos locais não pôde ser lida agora.'
              : 'Locais do último dado disponível (API externa fora do ar).'
          }}
        </p>
      }
      <ul class="passos" aria-label="Leituras do dia com local e aviso ao responsável">
        @for (p of l.passos; track $index) {
          <li>
            <span class="marca" [class.marca--chegada]="p.tipo === 'CHEGADA'"></span>
            <span class="rs-mono">{{ hora(p.dataHora) }}</span>
            <span>
              {{ rotuloPasso(p.tipo) }}
              @if (p.latitude === null) {
                <span class="rs-nota">· local exato indisponível</span>
              } @else if (p.origemLocal === 'GPS_ONIBUS') {
                <span class="rs-nota">· pelo GPS do ônibus</span>
              }
              <span class="rs-nota">· aviso ao responsável: {{ p.statusNotificacao || '—' }}</span>
            </span>
          </li>
        }
      </ul>
      @if (temPontos()) {
        <ul class="legenda" aria-label="Legenda do mapa">
          <li><span class="marca"></span>Embarque</li>
          <li><span class="marca marca--chegada"></span>Chegada</li>
          @if (trecho().length > 1) {
            <li><span class="traco"></span>Trajeto do ônibus</li>
          }
        </ul>
      }
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .mapa {
      height: 220px;
      border-radius: var(--raio-sm);
      background: var(--fundo);
      z-index: 0;
    }
    .mapa[hidden] {
      display: block;
      height: 0;
      visibility: hidden;
    }
    .passos,
    .legenda {
      list-style: none;
      margin: 8px 0 0;
      padding: 0;
    }
    .passos li {
      display: flex;
      align-items: baseline;
      gap: 8px;
      padding: 3px 0;
    }
    .legenda {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 14px;
      font-size: 12px;
    }
    .marca {
      display: inline-block;
      flex: none;
      width: 10px;
      height: 10px;
      margin-right: 6px;
      border-radius: 50%;
      background: var(--info);
    }
    .marca--chegada {
      border-radius: 3px;
      background: var(--sucesso);
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
  `,
})
export class MapaJornada implements OnDestroy {
  private readonly api = inject(PainelApi);

  readonly alunoId = input.required<number>();
  readonly data = input.required<string>();

  protected readonly hora = hora;
  protected readonly rotuloPasso = rotuloPasso;

  protected readonly locais = carga(() => this.api.locaisDaJornada(this.alunoId(), this.data()), {
    vazio: (l) => l.passos.length === 0,
  });
  private readonly pontos = computed(() => pontosDaJornada(this.locais.dados()));
  protected readonly temPontos = computed(() => this.pontos().length > 0);

  /** Rastro só existe para hoje; sem permissão para o veículo, o mapa fica só com os pontos. */
  private readonly rastro = carga(() => {
    const veiculo = veiculoDoEmbarque(this.locais.dados());
    if (veiculo === null || this.data() !== isoLocal(new Date())) {
      return null;
    }
    return this.api.rastreamentoDoVeiculo(veiculo).pipe(catchError(() => of(null)));
  });
  protected readonly trecho = computed(() =>
    trechoDoRastro(this.rastro.dados()?.rastro ?? [], this.locais.dados()),
  );

  private readonly elemento = viewChild.required<ElementRef<HTMLDivElement>>('mapa');
  private leaflet: typeof L | null = null;
  private mapa: L.Map | null = null;
  private camada: L.LayerGroup | null = null;
  private observador: ResizeObserver | null = null;

  constructor() {
    afterNextRender(async () => {
      const modulo = (await import('leaflet')) as typeof L & { default?: typeof L };
      this.leaflet = modulo.default ?? modulo;
      const Lf = this.leaflet;
      this.mapa = Lf.map(this.elemento().nativeElement, {
        zoomControl: true,
        zoomAnimation: false,
      }).setView(CONFIG_MAPA.centro, CONFIG_MAPA.zoom);
      Lf.tileLayer(CONFIG_MAPA.urlTiles, {
        maxZoom: 19,
        attribution: CONFIG_MAPA.atribuicao,
      }).addTo(this.mapa);
      this.camada = Lf.layerGroup().addTo(this.mapa);
      // O mapa nasce escondido (altura 0) até chegar um ponto: remede quando o tamanho muda.
      if (typeof ResizeObserver !== 'undefined') {
        this.observador = new ResizeObserver(() => {
          this.mapa?.invalidateSize();
          this.desenhar();
        });
        this.observador.observe(this.elemento().nativeElement);
      }
      this.desenhar();
    });
    effect(() => this.desenhar());
  }

  ngOnDestroy(): void {
    this.observador?.disconnect();
    this.mapa?.remove();
  }

  private desenhar(): void {
    const pontos = this.pontos();
    const trecho = this.trecho();
    const Lf = this.leaflet;
    if (!Lf || !this.mapa || !this.camada) {
      return;
    }
    this.camada.clearLayers();
    if (pontos.length === 0) {
      return;
    }
    const enquadrar: L.LatLngExpression[] = pontos.map((p) => [p.latitude, p.longitude]);
    if (trecho.length > 1) {
      const linha = trecho.map((p) => [p.latitude, p.longitude] as L.LatLngExpression);
      Lf.polyline(linha, {
        color: cor('--marca-secundaria'),
        weight: 4,
        opacity: 0.85,
        interactive: false,
      }).addTo(this.camada);
      enquadrar.push(...linha);
    }
    for (const p of pontos) {
      const chegada = p.tipo === 'CHEGADA';
      Lf.marker([p.latitude, p.longitude], {
        keyboard: false,
        title: p.rotulo,
        icon: Lf.divIcon({
          className: 'rs-marcador-jornada',
          iconSize: [28, 28],
          html: `<span style="background:${cor(chegada ? '--sucesso' : '--info')};border-radius:${chegada ? '7px' : '50%'}">${svgIcone(chegada ? 'escola' : 'onibus')}</span>`,
        }),
      })
        .bindTooltip(p.rotulo)
        .addTo(this.camada);
    }
    if (enquadrar.length === 1) {
      this.mapa.setView(enquadrar[0], 16, { animate: false });
    } else {
      this.mapa.fitBounds(Lf.latLngBounds(enquadrar), {
        padding: [24, 24],
        maxZoom: 16,
        animate: false,
      });
    }
  }
}
