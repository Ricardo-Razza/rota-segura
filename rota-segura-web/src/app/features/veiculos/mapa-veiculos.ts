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
import { Tom } from '../../shared/ui/tom';
import { rotuloVeiculo } from '../../shared/formato';
import { CONFIG_MAPA } from './mapa.config';
import { situacaoGps } from './veiculos.logica';

const COR_ESTADO: Record<string, string> = {
  EM_ROTA: '--info',
  CONCLUIDO: '--sucesso',
  SEM_EMBARQUE: '--texto-mudo',
};

/** Escola desenhada no mapa (quadrado na cor da faixa de presença). Coordenadas vêm do cadastro do leitor. */
export interface PontoEscola {
  id: number;
  latitude: number;
  longitude: number;
  rotulo: string;
  tom: Tom;
}

const COR_TOM: Record<Tom, string> = {
  sucesso: '--sucesso',
  atencao: '--atencao',
  critico: '--critico',
  info: '--info',
  neutro: '--texto-mudo',
};

function cor(token: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim() || '#888';
}

/** Tira do mapa as camadas cuja chave não apareceu neste desenho. */
function remover<K>(camadas: Map<K, L.Layer>, vistas: Set<K>, grupo: L.LayerGroup): void {
  for (const [chave, camada] of camadas) {
    if (!vistas.has(chave)) {
      grupo.removeLayer(camada);
      camadas.delete(chave);
    }
  }
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
      [style.height]="altura()"
      role="region"
      aria-label="Mapa com a posição GPS dos veículos, o rastro do dia e a cerca das escolas"
    ></div>
    @if (legenda()) {
      <ul class="legenda" aria-label="Legenda do mapa">
        <li><span class="ponto" style="background: var(--info)"></span>Em rota</li>
        <li><span class="ponto" style="background: var(--sucesso)"></span>Concluído</li>
        <li><span class="ponto" style="background: var(--texto-mudo)"></span>Sem embarque</li>
        <li><span class="ponto ponto--vazio"></span>Sem GPS (na escola de destino)</li>
        <li><span class="traco"></span>Rastro de hoje</li>
        <li><span class="ponto ponto--cerca"></span>Cerca da escola</li>
        @if (escolas().length) {
          <li><span class="quadrado"></span>Escola (cor da presença)</li>
        }
      </ul>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .mapa {
      border-radius: var(--raio-sm);
      z-index: 0;
      background: var(--fundo);
    }
    .quadrado {
      display: inline-block;
      width: 10px;
      height: 10px;
      margin-right: 6px;
      border-radius: 3px;
      background: var(--sucesso);
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
  readonly escolas = input<PontoEscola[]>([]);
  readonly escolaSelecionadaId = input<number | null>(null);
  readonly selecionarEscola = output<number>();
  readonly altura = input('420px');
  readonly legenda = input(true);

  private readonly elemento = viewChild.required<ElementRef<HTMLDivElement>>('mapa');
  private leaflet: typeof L | null = null;
  private mapa: L.Map | null = null;
  private camada: L.LayerGroup | null = null;
  private enquadrado = '';
  private observador: ResizeObserver | null = null;

  // Camadas guardadas por chave: a cada posição nova o marcador só anda, sem recriar o mapa inteiro.
  private readonly cercas = new Map<string, L.Circle>();
  private readonly rastros = new Map<number, L.Polyline>();
  private readonly marcadores = new Map<number, L.CircleMarker>();
  private readonly marcadoresEscola = new Map<number, { marcador: L.Marker; icone: string }>();

  constructor() {
    afterNextRender(async () => {
      // Leaflet é CommonJS: no build de produção a API vem em `default`; no servidor de dev, no próprio módulo.
      const modulo = (await import('leaflet')) as typeof L & { default?: typeof L };
      this.leaflet = modulo.default ?? modulo;
      const Lf = this.leaflet;
      // Canvas em vez de SVG: círculos e rastros num único desenho, bem mais leve com muitos veículos.
      this.mapa = Lf.map(this.elemento().nativeElement, {
        zoomControl: true,
        preferCanvas: true,
      }).setView(CONFIG_MAPA.centro, CONFIG_MAPA.zoom);
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
    const pontosEscola = this.escolas();
    const escolaAtiva = this.escolaSelecionadaId();
    const Lf = this.leaflet;
    if (!Lf || !this.mapa || !this.camada) {
      return;
    }
    const camada = this.camada;
    // Cores lidas uma vez por desenho: getComputedStyle a cada marcador força o navegador a recalcular estilos.
    const paleta = new Map<string, string>();
    const corDe = (token: string): string => {
      let valor = paleta.get(token);
      if (valor === undefined) {
        valor = cor(token);
        paleta.set(token, valor);
      }
      return valor;
    };
    const enquadrar: L.LatLngExpression[] = [];
    const cercasVistas = new Set<string>();
    const rastrosVistos = new Set<number>();
    const veiculosVistos = new Set<number>();
    let rastroNovo = false;

    for (const v of veiculos) {
      const corEstado = corDe(COR_ESTADO[v.estado]);
      const r = rastreios.get(v.id);
      const escola: L.LatLngExpression | null =
        v.latitude !== null && v.longitude !== null ? [v.latitude, v.longitude] : null;

      const chaveEscola = `${v.latitude},${v.longitude}`;
      if (escola && !cercasVistas.has(chaveEscola)) {
        cercasVistas.add(chaveEscola);
        if (raio > 0) {
          const estilo = { color: corDe('--marca-secundaria') };
          const existente = this.cercas.get(chaveEscola);
          if (existente) {
            existente.setRadius(raio).setStyle(estilo);
          } else {
            this.cercas.set(
              chaveEscola,
              Lf.circle(escola, {
                ...estilo,
                radius: raio,
                weight: 1.5,
                dashArray: '6 6',
                fillOpacity: 0.06,
                interactive: false,
              })
                .addTo(camada)
                .bringToBack(),
            );
          }
        }
        enquadrar.push(escola);
      }

      const ativo = v.id === selecionado;
      if (r && r.rastro.length > 1) {
        rastrosVistos.add(v.id);
        const linha = r.rastro.map((p) => [p.latitude, p.longitude] as L.LatLngExpression);
        const estilo = {
          color: corDe('--marca-secundaria'),
          weight: ativo ? 5 : 3,
          opacity: selecionado === null || ativo ? 0.85 : 0.3,
        };
        const existente = this.rastros.get(v.id);
        if (existente) {
          existente.setLatLngs(linha).setStyle(estilo);
        } else {
          this.rastros.set(
            v.id,
            Lf.polyline(linha, { ...estilo, interactive: false }).addTo(camada),
          );
          rastroNovo = true;
        }
      }

      const posicao: L.LatLngExpression | null = r?.posicao
        ? [r.posicao.latitude, r.posicao.longitude]
        : escola;
      if (!posicao) {
        continue;
      }
      veiculosVistos.add(v.id);
      const comGps = !!r?.posicao;
      const estilo: L.CircleMarkerOptions = {
        radius: ativo ? 11 : 9,
        color: ativo ? corDe('--texto') : corEstado,
        weight: ativo ? 3 : 2,
        dashArray: comGps ? undefined : '4 4',
        fillColor: corEstado,
        fillOpacity: !comGps ? 0.15 : r?.atrasada ? 0.4 : 0.9,
      };
      const dica =
        `${rotuloVeiculo(v)} · ${situacaoGps(r).texto} · ${v.aBordo} a bordo` +
        (r?.naCercaDaEscola ? ' · na escola' : '');
      const existente = this.marcadores.get(v.id);
      if (existente) {
        existente.setLatLng(posicao).setStyle(estilo).setRadius(estilo.radius!);
        existente.setTooltipContent(dica);
      } else {
        const id = v.id;
        this.marcadores.set(
          id,
          Lf.circleMarker(posicao, estilo)
            .bindTooltip(dica)
            .on('click', () => this.selecionar.emit(id))
            .addTo(camada),
        );
      }
      if (comGps) {
        enquadrar.push(posicao);
      }
    }

    const escolasVistas = new Set<number>();
    for (const e of pontosEscola) {
      escolasVistas.add(e.id);
      const ativa = e.id === escolaAtiva;
      const tamanho = ativa ? 22 : 16;
      const html = `<span style="background:${corDe(COR_TOM[e.tom])};${ativa ? 'box-shadow:0 0 0 3px ' + corDe('--texto') : ''}"></span>`;
      const icone = `${tamanho}|${html}`;
      const existente = this.marcadoresEscola.get(e.id);
      const divIcon = () =>
        Lf.divIcon({ className: 'rs-marcador-escola', iconSize: [tamanho, tamanho], html });
      if (existente) {
        existente.marcador.setLatLng([e.latitude, e.longitude]).setTooltipContent(e.rotulo);
        if (existente.icone !== icone) {
          existente.marcador.setIcon(divIcon());
          existente.icone = icone;
        }
      } else {
        const id = e.id;
        const marcador = Lf.marker([e.latitude, e.longitude], { keyboard: false, icon: divIcon() })
          .bindTooltip(e.rotulo)
          .on('click', () => this.selecionarEscola.emit(id))
          .addTo(camada);
        this.marcadoresEscola.set(id, { marcador, icone });
      }
      enquadrar.push([e.latitude, e.longitude]);
    }

    if (rastroNovo) {
      // Rastro recém-criado fica por cima: os veículos voltam para a frente.
      this.marcadores.forEach((m) => m.bringToFront());
    }
    remover(this.cercas, raio > 0 ? cercasVistas : new Set(), camada);
    remover(this.rastros, rastrosVistos, camada);
    remover(this.marcadores, veiculosVistos, camada);
    for (const [id, { marcador }] of this.marcadoresEscola) {
      if (!escolasVistas.has(id)) {
        camada.removeLayer(marcador);
        this.marcadoresEscola.delete(id);
      }
    }

    // Reenquadra só quando muda quem está no mapa ou quem está selecionado.
    const assinatura =
      veiculos.map((v) => `${v.id}:${rastreios.get(v.id)?.posicao ? 1 : 0}`).join() +
      `|${selecionado}|${pontosEscola.map((e) => e.id).join()}|${escolaAtiva}`;
    if (assinatura === this.enquadrado || enquadrar.length === 0) {
      return;
    }
    this.enquadrado = assinatura;
    const foco = selecionado === null ? undefined : rastreios.get(selecionado);
    const escolaFoco = pontosEscola.find((e) => e.id === escolaAtiva);
    if (escolaFoco) {
      this.mapa.setView([escolaFoco.latitude, escolaFoco.longitude], 15);
    } else if (foco?.posicao) {
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
