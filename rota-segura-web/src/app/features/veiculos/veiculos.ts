import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { auditTime, bufferTime, filter, merge } from 'rxjs';
import { carga } from '../../core/api/carga';
import { PosicaoAoVivo, RastreioVeiculo } from '../../core/api/modelos';
import { PainelApi } from '../../core/api/painel-api.service';
import { FiltrosStore } from '../../core/filtros/filtros.store';
import { IndicadorConexao } from '../../core/sse/indicador-conexao';
import { SseService } from '../../core/sse/sse.service';
import { haQuanto, percentual, rotuloVeiculo } from '../../shared/formato';
import { ChartCard } from '../../shared/ui/chart-card';
import { FilterChips, OpcaoChip } from '../../shared/ui/filter-chips';
import { StatusBadge } from '../../shared/ui/status-badge';
import { DetalheDoVeiculo } from './detalhe-veiculo';
import { MapaVeiculos } from './mapa-veiculos';
import {
  ESTADO_VEICULO,
  FAIXA,
  SITUACAO_LEITOR,
  agruparLeitores,
  aplicarPosicoes,
  JANELA_POSICOES_MS,
  filtrarVeiculos,
  situacaoGps,
  textoPrevisao,
} from './veiculos.logica';

type Aba = 'veiculos' | 'leitores';

/** O GPS chega a cada 5 s: o "há X s" dos cards anda no mesmo passo. */
const RELOGIO_MS = 5000;

/** Veículos (status do dia, mapa, detalhe) e saúde dos leitores faciais. Tudo somente leitura. */
@Component({
  selector: 'rs-veiculos',
  imports: [ChartCard, FilterChips, StatusBadge, MapaVeiculos, DetalheDoVeiculo, IndicadorConexao],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rs-pagina">
      <div class="rs-pagina__topo">
        <h1>Frota</h1>
        <div class="rs-pagina__acoes"><rs-indicador-conexao /></div>
      </div>

      <div class="rs-abas" role="tablist" aria-label="Seções">
        <button
          type="button"
          role="tab"
          [attr.aria-selected]="aba() === 'veiculos'"
          (click)="aba.set('veiculos')"
        >
          Mapa ao vivo
        </button>
        <button
          type="button"
          role="tab"
          [attr.aria-selected]="aba() === 'leitores'"
          (click)="aba.set('leitores')"
        >
          Leitores faciais
        </button>
      </div>

      @if (aba() === 'veiculos') {
        <div class="rs-pagina__acoes">
          <label>
            <span class="rs-somente-leitor">Buscar por placa</span>
            <input
              class="rs-campo"
              type="search"
              placeholder="Buscar placa ou prefixo"
              [value]="termo()"
              (input)="termo.set($any($event.target).value)"
            />
          </label>
          <rs-filter-chips
            rotulo="Estado do veículo"
            [opcoes]="chips()"
            [(selecionados)]="estados"
          />
        </div>

        @if (rastreio.estado() === 'erro') {
          <p class="rs-aviso">
            Não foi possível carregar o GPS.
            <button
              type="button"
              class="rs-botao rs-botao--pequeno"
              (click)="rastreio.recarregar()"
            >
              Tentar de novo
            </button>
          </p>
        }

        <div class="frota" [class.frota--detalhe]="selecionadoId() !== null">
          <rs-chart-card
            class="frota__lista"
            titulo="Veículos hoje"
            [estado]="status.estado()"
            [atualizadoEm]="status.atualizadoEm()"
            mensagemVazio="Nenhum veículo no seu escopo."
            (tentarDeNovo)="status.recarregar()"
          >
            <ul class="cards">
              @for (v of filtrados(); track v.id) {
                <li>
                  <button
                    type="button"
                    class="cartao"
                    [class.cartao--ativo]="v.id === selecionadoId()"
                    (click)="selecionar(v.id)"
                  >
                    <span class="linha">
                      <strong class="rs-mono">{{ rotulo(v) }}</strong>
                      <rs-status-badge
                        [texto]="estadoVeiculo[v.estado].rotulo"
                        [tom]="estadoVeiculo[v.estado].tom"
                      />
                    </span>
                    <span class="linha">
                      <span
                        >{{ v.embarcados }} embarcados · {{ v.aBordo }} a bordo ·
                        {{ v.esperados }} esperados</span
                      >
                      @if (v.faixaOcupacao; as faixa) {
                        <rs-status-badge
                          [texto]="'Ocupação ' + percentual(v.ocupacao)"
                          [tom]="faixas[faixa]"
                        />
                      } @else {
                        <!-- Sem capacidade na API: ocupação zerada e sem faixa (não gera alerta). -->
                        <span class="rs-nota" title="A API não informou a capacidade deste veículo"
                          >Ocupação 0%</span
                        >
                      }
                    </span>
                    @if (previsao(v); as p) {
                      <span class="linha">
                        <span class="rs-mono">{{ p.chegada }}</span>
                        <rs-status-badge [texto]="p.comparacao" [tom]="p.tom" />
                      </span>
                    }
                    <span class="linha">
                      <rs-status-badge [texto]="gps(v.id).texto" [tom]="gps(v.id).tom" />
                      @if (rastreioDe(v.id)?.naCercaDaEscola) {
                        <rs-status-badge texto="Na escola" tom="info" />
                      }
                      <span class="rs-nota">
                        {{ v.leitores.length }} leitor(es) · última leitura
                        {{ haQuanto(v.ultimaLeitura) }}
                      </span>
                    </span>
                  </button>
                </li>
              } @empty {
                <li class="rs-nota">Nenhum veículo com esses filtros.</li>
              }
            </ul>
          </rs-chart-card>

          @if (selecionadoId(); as id) {
            <rs-detalhe-veiculo
              class="frota__mapa"
              [veiculoId]="id"
              [veiculos]="filtrados()"
              [rastreios]="rastreios()"
              [raioCercaM]="rastreio.dados()?.raioCercaM ?? 0"
              [agora]="agora()"
              (fechar)="selecionar(-1)"
              (selecionar)="selecionar($event)"
            />
          } @else {
            <rs-chart-card
              class="frota__mapa"
              titulo="Mapa ao vivo"
              [estado]="status.estado()"
              (tentarDeNovo)="status.recarregar()"
            >
              <rs-mapa-veiculos
                altura="clamp(380px, calc(100dvh - 400px), 720px)"
                [veiculos]="filtrados()"
                [rastreios]="rastreios()"
                [raioCercaM]="rastreio.dados()?.raioCercaM ?? 0"
                (selecionar)="selecionar($event)"
              />
              @if (rastreio.dados(); as g) {
                <p class="rs-nota">
                  {{ comGps() }} de {{ filtrados().length }} veículo(s) com GPS · posição consultada
                  a cada {{ g.intervaloS }} s
                </p>
              }
            </rs-chart-card>
          }
        </div>
      } @else {
        <rs-chart-card
          titulo="Leitores faciais"
          [estado]="leitores.estado()"
          [atualizadoEm]="leitores.atualizadoEm()"
          mensagemVazio="Nenhum leitor no seu escopo."
          (tentarDeNovo)="leitores.recarregar()"
        >
          @if (leitores.dados(); as s) {
            <p class="rs-nota">
              Offline = sem leitura há mais de {{ s.limiteOfflineMin }} min (fora do horário de rota
              isso é esperado). Online {{ s.porSituacao['ONLINE'] ?? 0 }} · offline
              {{ s.porSituacao['OFFLINE'] ?? 0 }} · sem leitura
              {{ s.porSituacao['SEM_LEITURA'] ?? 0 }}.
            </p>
          }
          @for (grupo of gruposLeitores(); track grupo.chave) {
            <h3>{{ grupo.titulo }}</h3>
            <ul class="rs-lista">
              @for (l of grupo.leitores; track l.id) {
                <li>
                  <rs-status-badge
                    [texto]="situacao(l.situacao).rotulo"
                    [tom]="situacao(l.situacao).tom"
                  />
                  <span class="cresce">
                    {{ l.descricao || 'Leitor #' + l.id }}
                    <span class="rs-nota"
                      >· {{ l.tipoUsoDescricao || l.tipoUso || 'tipo não informado' }}</span
                    >
                  </span>
                  <span class="rs-nota">{{ l.leiturasUltimaHora }} leituras/h</span>
                  <span class="rs-nota">última {{ haQuanto(l.ultimaLeitura) }}</span>
                </li>
              }
            </ul>
          }
          <p class="rs-nota">
            Contagem de falhas de leitura não disponível: a API não informa tentativas sem
            reconhecimento.
          </p>
        </rs-chart-card>
      }
    </div>
  `,
  styles: `
    .frota {
      display: grid;
      grid-template-columns: minmax(300px, 420px) 1fr;
      gap: 16px;
      align-items: start;
    }
    .frota--detalhe {
      grid-template-columns: minmax(280px, 340px) minmax(0, 1fr);
    }
    .frota__mapa {
      order: 2;
      scroll-margin-top: 90px;
    }
    @media (max-width: 1000px) {
      .frota,
      .frota--detalhe {
        grid-template-columns: minmax(0, 1fr);
      }
      .frota__mapa {
        order: -1;
      }
    }
    .cards {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: clamp(380px, calc(100dvh - 400px), 720px);
      overflow-y: auto;
    }
    .frota--detalhe .cards {
      max-height: 820px;
    }
    .cartao {
      display: flex;
      flex-direction: column;
      gap: 4px;
      width: 100%;
      padding: 10px;
      border: 1px solid var(--vidro-borda);
      border-radius: 14px;
      background: var(--neutro-fundo);
      text-align: left;
      cursor: pointer;
    }
    .cartao:hover {
      border-color: var(--borda-forte);
    }
    .cartao--ativo {
      border-color: var(--marca-secundaria);
    }
    .linha {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      flex-wrap: wrap;
    }
    .cresce {
      flex: 1;
    }
    h3 {
      margin: 12px 0 4px;
      font-size: 13px;
    }
  `,
})
export class Veiculos {
  private readonly api = inject(PainelApi);
  private readonly filtros = inject(FiltrosStore);

  /** `?veiculo=<id>` (vindo de alerta ou busca) abre o detalhe. */
  readonly veiculo = input<string | undefined>();

  protected readonly estadoVeiculo = ESTADO_VEICULO;
  protected readonly faixas = FAIXA;
  protected readonly percentual = percentual;
  protected readonly haQuanto = haQuanto;
  protected readonly rotulo = rotuloVeiculo;
  protected readonly previsao = textoPrevisao;

  protected readonly aba = signal<Aba>('veiculos');
  protected readonly termo = signal('');
  protected readonly estados = signal<string[]>([]);
  private readonly escolhido = signal<number | null>(null);
  protected readonly selecionadoId = computed(() => {
    const manual = this.escolhido();
    if (manual !== null) {
      return manual === -1 ? null : manual;
    }
    const daUrl = Number(this.veiculo());
    return Number.isInteger(daUrl) && daUrl > 0 ? daUrl : null;
  });

  protected readonly status = carga(() => this.api.veiculos(this.filtros.parametros()), {
    vazio: (s) => s.veiculos.length === 0,
  });
  protected readonly leitores = carga(() => this.api.leitores(this.filtros.parametros()), {
    vazio: (s) => s.leitores.length === 0,
  });
  /** GPS ao vivo: carga inicial (com o rastro do dia) e depois o evento SSE `veiculo.posicao`. */
  protected readonly rastreio = carga(() => this.api.rastreamento());
  protected readonly rastreios = linkedSignal<RastreioVeiculo[]>(
    () => this.rastreio.dados()?.veiculos ?? [],
  );
  private readonly porVeiculo = computed(
    () => new Map(this.rastreios().map((r) => [r.veiculoId, r])),
  );
  /** Relógio para o "há X s" do GPS andar sozinho (o GPS chega a cada 5 s; mais rápido não muda nada). */
  protected readonly agora = signal(Date.now());

  private readonly injetor = inject(Injector);
  private readonly painelDoDetalhe = viewChild(DetalheDoVeiculo, { read: ElementRef });

  protected readonly filtrados = computed(() =>
    filtrarVeiculos(this.status.dados()?.veiculos ?? [], this.termo(), this.estados()),
  );
  protected readonly comGps = computed(
    () => this.filtrados().filter((v) => this.porVeiculo().get(v.id)?.posicao).length,
  );
  protected readonly chips = computed<OpcaoChip[]>(() => {
    const por = this.status.dados()?.porEstado ?? {};
    return (Object.keys(ESTADO_VEICULO) as (keyof typeof ESTADO_VEICULO)[]).map((e) => ({
      valor: e,
      rotulo: ESTADO_VEICULO[e].rotulo,
      contador: por[e] ?? 0,
    }));
  });
  protected readonly gruposLeitores = computed(() =>
    agruparLeitores(this.leitores.dados()?.leitores ?? []),
  );

  constructor() {
    const sse = inject(SseService);
    sse
      .de<PosicaoAoVivo>('veiculo.posicao')
      .pipe(
        bufferTime(JANELA_POSICOES_MS),
        filter((eventos) => eventos.length > 0),
        takeUntilDestroyed(),
      )
      .subscribe((eventos) => this.rastreios.update((lista) => aplicarPosicoes(lista, eventos)));
    // Com a aba escondida ninguém vê o "há X s": não recalcula os cards à toa.
    const relogio = setInterval(() => {
      if (!document.hidden) {
        this.agora.set(Date.now());
      }
    }, RELOGIO_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(relogio));
    merge(sse.de('veiculo.atualizado'), sse.de('jornada.atualizada'))
      .pipe(auditTime(3000), takeUntilDestroyed())
      .subscribe(() => this.status.recarregar(true));
  }

  protected rastreioDe(id: number): RastreioVeiculo | undefined {
    return this.porVeiculo().get(id);
  }

  protected gps(id: number) {
    return situacaoGps(this.porVeiculo().get(id), this.agora());
  }

  protected selecionar(id: number): void {
    this.escolhido.set(id);
    // Em tela estreita o detalhe fica acima da lista: leva a tela até ele.
    if (id > 0 && window.matchMedia?.('(max-width: 1000px)').matches) {
      afterNextRender(
        () => this.painelDoDetalhe()?.nativeElement.scrollIntoView({ block: 'start' }),
        { injector: this.injetor },
      );
    }
  }

  protected situacao(s: string) {
    return SITUACAO_LEITOR[s] ?? { rotulo: s, tom: 'neutro' as const };
  }
}
