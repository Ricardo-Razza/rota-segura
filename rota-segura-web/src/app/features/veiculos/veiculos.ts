import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { auditTime, bufferTime, filter, merge } from 'rxjs';
import { carga } from '../../core/api/carga';
import { PosicaoAoVivo, RastreioVeiculo } from '../../core/api/modelos';
import { PainelApi } from '../../core/api/painel-api.service';
import { FiltrosStore } from '../../core/filtros/filtros.store';
import { IndicadorConexao } from '../../core/sse/indicador-conexao';
import { SseService } from '../../core/sse/sse.service';
import { haQuanto, hora, minutos, percentual, rotuloVeiculo } from '../../shared/formato';
import { ChartCard } from '../../shared/ui/chart-card';
import { FilterChips, OpcaoChip } from '../../shared/ui/filter-chips';
import { StatusBadge } from '../../shared/ui/status-badge';
import { JORNADA } from '../../shared/ui/tom';
import { MapaVeiculos } from './mapa-veiculos';
import {
  ESTADO_VEICULO,
  FAIXA,
  SITUACAO_LEITOR,
  agruparLeitores,
  aplicarPosicoes,
  JANELA_POSICOES_MS,
  distancia,
  filtrarVeiculos,
  situacaoGps,
} from './veiculos.logica';
import { Icone } from '../../shared/ui/icone';

type Aba = 'veiculos' | 'leitores';

/** O GPS chega a cada 5 s: o "há X s" dos cards anda no mesmo passo. */
const RELOGIO_MS = 5000;

/** Veículos (status do dia, mapa, detalhe) e saúde dos leitores faciais. Tudo somente leitura. */
@Component({
  selector: 'rs-veiculos',
  imports: [Icone, ChartCard, FilterChips, StatusBadge, MapaVeiculos, IndicadorConexao],
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
        @if (status.dados()?.capacidadeNaoConfigurada) {
          <p class="rs-aviso">
            Capacidade de alguns veículos não configurada: a ocupação desses aparece como "—" e não
            gera alerta de lotação.
          </p>
        }
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

        <div class="frota">
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
                        <span class="rs-nota">Ocupação —</span>
                      }
                    </span>
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
              [selecionadoId]="selecionadoId()"
              (selecionar)="selecionar($event)"
            />
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
            } @else if (rastreio.dados(); as g) {
              <p class="rs-nota">
                {{ comGps() }} de {{ filtrados().length }} veículo(s) com GPS · posição consultada a
                cada {{ g.intervaloS }} s
              </p>
            }
          </rs-chart-card>
        </div>

        @if (selecionadoId() !== null) {
          <rs-chart-card
            titulo="Detalhe do veículo"
            [estado]="detalhe.estado()"
            [atualizadoEm]="detalhe.atualizadoEm()"
            (tentarDeNovo)="detalhe.recarregar()"
          >
            <button
              acoes
              type="button"
              class="rs-botao rs-botao--pequeno"
              (click)="selecionar(-1)"
              aria-label="Fechar detalhe"
            >
              <rs-icone nome="x" />
            </button>
            @if (detalhe.dados(); as d) {
              <dl class="resumo">
                <div>
                  <dt>Veículo</dt>
                  <dd class="rs-mono">{{ rotulo(d.veiculo) }}</dd>
                </div>
                <div>
                  <dt>Saída (1º embarque)</dt>
                  <dd>{{ hora(d.veiculo.saida) }}</dd>
                </div>
                <div>
                  <dt>Tempo médio (histórico)</dt>
                  <dd>{{ minutos(d.veiculo.tempoMedioMin) }}</dd>
                </div>
                <div>
                  <dt>Previsão de chegada</dt>
                  <dd>{{ hora(d.veiculo.previsaoChegada) }}</dd>
                </div>
                <div>
                  <dt>Capacidade</dt>
                  <dd>{{ d.veiculo.capacidade ?? '—' }}</dd>
                </div>
                <div>
                  <dt>GPS</dt>
                  <dd>
                    <rs-status-badge
                      [texto]="gps(d.veiculo.id).texto"
                      [tom]="gps(d.veiculo.id).tom"
                    />
                  </dd>
                </div>
                @if (rastreioDe(d.veiculo.id); as r) {
                  <div>
                    <dt>Distância até a escola</dt>
                    <dd>{{ distancia(r.distanciaEscolaM) }}</dd>
                  </div>
                  <div>
                    <dt>Na escola desde</dt>
                    <dd>{{ hora(r.naCercaDesde) }}</dd>
                  </div>
                }
              </dl>
              <div class="rs-grade rs-grade--2">
                <div>
                  <h3>Embarcados hoje ({{ d.embarcados.length }})</h3>
                  <ul class="rs-lista">
                    @for (e of d.embarcados; track e.alunoId) {
                      <li>
                        <span class="rs-avatar" aria-hidden="true">{{ e.iniciais || '?' }}</span>
                        <span class="cresce"
                          >{{ e.iniciais || 'Aluno' }} · {{ e.turma || 'Sem turma' }}</span
                        >
                        <rs-status-badge
                          [texto]="jornada[e.estado].rotulo"
                          [tom]="jornada[e.estado].tom"
                        />
                        <span class="rs-mono">{{ hora(e.embarqueEm) }}</span>
                      </li>
                    } @empty {
                      <li class="rs-nota">Ninguém embarcou hoje.</li>
                    }
                  </ul>
                </div>
                <div>
                  <h3>Últimas leituras</h3>
                  <ul class="rs-lista">
                    @for (l of d.ultimasLeituras; track $index) {
                      <li>
                        <span class="rs-mono">{{ hora(l.dataHora) }}</span>
                        <span class="cresce"
                          >{{ l.tipo === 'EMBARQUE' ? 'Embarque' : 'Chegada' }} · aluno #{{
                            l.alunoId
                          }}</span
                        >
                        <span class="rs-nota">leitor #{{ l.leitorId }}</span>
                      </li>
                    } @empty {
                      <li class="rs-nota">Sem leituras hoje.</li>
                    }
                  </ul>
                </div>
              </div>
            }
          </rs-chart-card>
        }
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
    .frota__mapa {
      order: 2;
    }
    @media (max-width: 1000px) {
      .frota {
        grid-template-columns: 1fr;
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
    .resumo {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      margin: 0 0 12px;
    }
    dt {
      color: var(--texto-suave);
      font-size: 12px;
    }
    dd {
      margin: 0;
      font-weight: 600;
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
  protected readonly jornada = JORNADA;
  protected readonly hora = hora;
  protected readonly minutos = minutos;
  protected readonly percentual = percentual;
  protected readonly haQuanto = haQuanto;
  protected readonly rotulo = rotuloVeiculo;
  protected readonly distancia = distancia;

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
  protected readonly detalhe = carga(() => {
    const id = this.selecionadoId();
    return id === null ? null : this.api.veiculo(id);
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
  private readonly agora = signal(Date.now());

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
      .subscribe(() => {
        this.status.recarregar(true);
        if (this.selecionadoId() !== null) {
          this.detalhe.recarregar(true);
        }
      });
  }

  protected rastreioDe(id: number): RastreioVeiculo | undefined {
    return this.porVeiculo().get(id);
  }

  protected gps(id: number) {
    return situacaoGps(this.porVeiculo().get(id), this.agora());
  }

  protected selecionar(id: number): void {
    this.escolhido.set(id);
  }

  protected situacao(s: string) {
    return SITUACAO_LEITOR[s] ?? { rotulo: s, tom: 'neutro' as const };
  }
}
