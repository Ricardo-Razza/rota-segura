import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  afterNextRender,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';
import type * as L from 'leaflet';
import { StatusVeiculo } from '../../core/api/modelos';
import { rotuloVeiculo } from '../../shared/formato';
import { CONFIG_MAPA } from './mapa.config';

const COR_ESTADO: Record<string, string> = {
  EM_ROTA: '--info',
  CONCLUIDO: '--sucesso',
  SEM_EMBARQUE: '--texto-mudo',
};

function cor(token: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim() || '#888';
}

/**
 * Mapa Leaflet com tiles do OpenStreetMap (sem chave). Os marcadores ficam na escola de destino de
 * cada veículo: a API autorizada nesta fase não traz a posição GPS do ônibus.
 */
@Component({
  selector: 'rs-mapa-veiculos',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      #mapa
      class="mapa"
      role="region"
      aria-label="Mapa das escolas de destino dos veículos"
    ></div>
    <ul class="legenda" aria-label="Legenda do mapa">
      <li><span class="ponto" style="background: var(--info)"></span>Em rota</li>
      <li><span class="ponto" style="background: var(--sucesso)"></span>Concluído</li>
      <li><span class="ponto" style="background: var(--texto-mudo)"></span>Sem embarque</li>
    </ul>
    <p class="rs-nota">
      Marcadores na escola de destino (a posição GPS do veículo não está disponível nesta fase).
    </p>
  `,
  styles: `
    .mapa {
      height: 360px;
      border-radius: var(--raio-sm);
      z-index: 0;
    }
    .legenda {
      display: flex;
      gap: 14px;
      list-style: none;
      margin: 8px 0 0;
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
  `,
})
export class MapaVeiculos implements OnDestroy {
  readonly veiculos = input.required<StatusVeiculo[]>();
  readonly selecionar = output<number>();

  private readonly elemento = viewChild.required<ElementRef<HTMLDivElement>>('mapa');
  private leaflet: typeof L | null = null;
  private mapa: L.Map | null = null;
  private camada: L.LayerGroup | null = null;

  constructor() {
    afterNextRender(async () => {
      this.leaflet = await import('leaflet');
      const Lf = this.leaflet;
      this.mapa = Lf.map(this.elemento().nativeElement, { zoomControl: true }).setView(
        CONFIG_MAPA.centro,
        CONFIG_MAPA.zoom,
      );
      Lf.tileLayer(CONFIG_MAPA.urlTiles, {
        maxZoom: 19,
        attribution: CONFIG_MAPA.atribuicao,
      }).addTo(this.mapa);
      this.camada = Lf.layerGroup().addTo(this.mapa);
      this.desenhar(this.veiculos());
    });
    effect(() => this.desenhar(this.veiculos()));
  }

  ngOnDestroy(): void {
    this.mapa?.remove();
  }

  private desenhar(veiculos: StatusVeiculo[]): void {
    const Lf = this.leaflet;
    if (!Lf || !this.mapa || !this.camada) {
      return;
    }
    this.camada.clearLayers();
    const pontos: L.LatLngExpression[] = [];
    for (const v of veiculos) {
      if (v.latitude === null || v.longitude === null) {
        continue;
      }
      const ponto: L.LatLngExpression = [v.latitude, v.longitude];
      pontos.push(ponto);
      Lf.circleMarker(ponto, {
        radius: 9,
        color: cor(COR_ESTADO[v.estado]),
        fillColor: cor(COR_ESTADO[v.estado]),
        fillOpacity: 0.75,
      })
        .bindTooltip(`${rotuloVeiculo(v)} · ${v.embarcados} embarcados`)
        .on('click', () => this.selecionar.emit(v.id))
        .addTo(this.camada);
    }
    if (pontos.length > 0) {
      this.mapa.fitBounds(Lf.latLngBounds(pontos), { padding: [30, 30], maxZoom: 15 });
    }
  }
}
