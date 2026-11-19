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
import { RastreioVeiculo, StatusVeiculo } from '../../core/api/modelos';
import { rotuloVeiculo } from '../../shared/formato';
import { CONFIG_MAPA } from './mapa.config';
import { situacaoGps } from './veiculos.logica';

const COR_ESTADO: Record<string, string> = {
  EM_ROTA: '--info',
  CONCLUIDO: '--sucesso',
  SEM_EMBARQUE: '--texto-mudo',
};

function cor(token: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim() || '#888';
}

/**
 * Mapa Leaflet com tiles do OpenStreetMap (sem chave). Mostra o GPS ao vivo de cada veículo, o rastro do dia
 * e a cerca virtual da escola de destino. Veículo sem GPS aparece na escola de destino, com contorno tracejado.
 *
 * O enquadramento só muda quando muda o conjunto de veículos ou a seleção: a cada posição nova (5 s) o
 * marcador anda, mas o mapa não pula.
 */
@Component({
  selector: 'rs-mapa-veiculos',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      #mapa
      class="mapa"
      role="region"
      aria-label="Mapa com a posição GPS dos veículos, o rastro do dia e a cerca das escolas"
    ></div>
    <ul class="legenda" aria-label="Legenda do mapa">
      <li><span class="ponto" style="background: var(--info)"></span>Em rota</li>
      <li><span class="ponto" style="background: var(--sucesso)"></span>Concluído</li>
      <li><span class="ponto" style="background: var(--texto-mudo)"></span>Sem embarque</li>
      <li><span class="ponto ponto--vazio"></span>Sem GPS (na escola de destino)</li>
      <li><span class="traco"></span>Rastro de hoje</li>
      <li><span class="ponto ponto--cerca"></span>Cerca da escola</li>
    </ul>
  `,
  styles: `
    .mapa {
      height: 420px;
      border-radius: var(--raio-sm);
      z-index: 0;
    }
    .legenda {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 14px;
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
    .ponto--vazio {
      border: 2px dashed var(--texto-mudo);
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
  `,
})
export class MapaVeiculos implements OnDestroy {
  readonly veiculos = input.required<StatusVeiculo[]>();
  readonly rastreios = input<RastreioVeiculo[]>([]);
  readonly raioCercaM = input(0);
  readonly selecionadoId = input<number | null>(null);
  readonly selecionar = output<number>();

  private readonly elemento = viewChild.required<ElementRef<HTMLDivElement>>('mapa');
  private leaflet: typeof L | null = null;
  private mapa: L.Map | null = null;
  private camada: L.LayerGroup | null = null;
  private enquadrado = '';
  private observador: ResizeObserver | null = null;

  constructor() {
    afterNextRender(async () => {
      // Leaflet é CommonJS: no build de produção a API vem em `default`; no servidor de dev, no próprio módulo.
      const modulo = (await import('leaflet')) as typeof L & { default?: typeof L };
      this.leaflet = modulo.default ?? modulo;
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
      // O card esconde o conteúdo enquanto carrega: o Leaflet mede o contêiner com tamanho errado e deixa
      // o mapa cinza. Sempre que o tamanho muda, o mapa é remedido e reenquadrado.
      this.observador = new ResizeObserver(() => {
        this.mapa?.invalidateSize();
        this.enquadrado = '';
        this.desenhar();
      });
      this.observador.observe(this.elemento().nativeElement);
      this.desenhar();
    });
    effect(() => this.desenhar());
  }

  ngOnDestroy(): void {
    this.observador?.disconnect();
    this.mapa?.remove();
  }

  private desenhar(): void {
    // Lidos antes do retorno antecipado para o effect acompanhar todos os inputs.
    const veiculos = this.veiculos();
    const rastreios = new Map(this.rastreios().map((r) => [r.veiculoId, r]));
    const raio = this.raioCercaM();
    const selecionado = this.selecionadoId();
    const Lf = this.leaflet;
    if (!Lf || !this.mapa || !this.camada) {
      return;
    }
    this.camada.clearLayers();
    const enquadrar: L.LatLngExpression[] = [];
    const escolas = new Set<string>();

    for (const v of veiculos) {
      const corEstado = cor(COR_ESTADO[v.estado]);
      const r = rastreios.get(v.id);
      const escola: L.LatLngExpression | null =
        v.latitude !== null && v.longitude !== null ? [v.latitude, v.longitude] : null;

      const chaveEscola = `${v.latitude},${v.longitude}`;
      if (escola && !escolas.has(chaveEscola)) {
        escolas.add(chaveEscola);
        if (raio > 0) {
          Lf.circle(escola, {
            radius: raio,
            color: cor('--marca-secundaria'),
            weight: 1.5,
            dashArray: '6 6',
            fillOpacity: 0.06,
            interactive: false,
          }).addTo(this.camada);
        }
        enquadrar.push(escola);
      }

      const ativo = v.id === selecionado;
      if (r && r.rastro.length > 1) {
        Lf.polyline(
          r.rastro.map((p) => [p.latitude, p.longitude] as L.LatLngExpression),
          {
            color: cor('--marca-secundaria'),
            weight: ativo ? 5 : 3,
            opacity: selecionado === null || ativo ? 0.85 : 0.3,
            interactive: false,
          },
        ).addTo(this.camada);
      }

      const posicao: L.LatLngExpression | null = r?.posicao
        ? [r.posicao.latitude, r.posicao.longitude]
        : escola;
      if (!posicao) {
        continue;
      }
      const comGps = !!r?.posicao;
      Lf.circleMarker(posicao, {
        radius: ativo ? 11 : 9,
        color: ativo ? cor('--texto') : corEstado,
        weight: ativo ? 3 : 2,
        dashArray: comGps ? undefined : '4 4',
        fillColor: corEstado,
        fillOpacity: !comGps ? 0.15 : r?.atrasada ? 0.4 : 0.9,
      })
        .bindTooltip(
          `${rotuloVeiculo(v)} · ${situacaoGps(r).texto} · ${v.aBordo} a bordo` +
            (r?.naCercaDaEscola ? ' · na escola' : ''),
        )
        .on('click', () => this.selecionar.emit(v.id))
        .addTo(this.camada);
      if (comGps) {
        enquadrar.push(posicao);
      }
    }

    // Reenquadra só quando muda quem está no mapa ou quem está selecionado.
    const assinatura =
      veiculos.map((v) => `${v.id}:${rastreios.get(v.id)?.posicao ? 1 : 0}`).join() +
      `|${selecionado}`;
    if (assinatura === this.enquadrado || enquadrar.length === 0) {
      return;
    }
    this.enquadrado = assinatura;
    const foco = selecionado === null ? undefined : rastreios.get(selecionado);
    if (foco?.posicao) {
      const pontos: L.LatLngExpression[] = [
        [foco.posicao.latitude, foco.posicao.longitude],
        ...foco.rastro.map((p) => [p.latitude, p.longitude] as L.LatLngExpression),
      ];
      this.mapa.fitBounds(Lf.latLngBounds(pontos), { padding: [40, 40], maxZoom: 16 });
    } else {
      this.mapa.fitBounds(Lf.latLngBounds(enquadrar), { padding: [30, 30], maxZoom: 15 });
    }
  }
}
