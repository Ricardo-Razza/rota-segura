import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { auditTime, merge } from 'rxjs';
import { cargaPorChave } from '../../core/api/carga';
import { RastreioVeiculo, StatusVeiculo } from '../../core/api/modelos';
import { PainelApi } from '../../core/api/painel-api.service';
import { SseService } from '../../core/sse/sse.service';
import { hora, minutos, percentual } from '../../shared/formato';
import { ChartCard } from '../../shared/ui/chart-card';
import { Icone } from '../../shared/ui/icone';
import { StatusBadge } from '../../shared/ui/status-badge';
import { JORNADA } from '../../shared/ui/tom';
import { MapaVeiculos } from './mapa-veiculos';
import { ReplayTrajeto } from './replay-trajeto';
import {
  ESTADO_VEICULO,
  distancia,
  horariosDaParada,
  situacaoGps,
  textoPrevisao,
} from './veiculos.logica';

type Visao = 'replay' | 'aovivo';

/**
 * Detalhe de um veículo: faixa com os dados principais, o trajeto (replay como mapa principal, ou o GPS ao
 * vivo) e, recolhida, a lista de embarques e leituras do dia. Tudo somente leitura.
 */
@Component({
  selector: 'rs-detalhe-veiculo',
  imports: [
    ChartCard,
    Icone,
    MapaVeiculos,
    NgTemplateOutlet,
    ReplayTrajeto,
    RouterLink,
    StatusBadge,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (detalhe.dados(); as d) {
      <section class="painel" aria-label="Resumo do veículo">
        <div class="topo">
          <h2>{{ titulo(d.veiculo) }}</h2>
          <rs-status-badge
            [texto]="estadoVeiculo[d.veiculo.estado].rotulo"
            [tom]="estadoVeiculo[d.veiculo.estado].tom"
          />
          <rs-status-badge [texto]="gps().texto" [tom]="gps().tom" />
          @if (detalhe.estado() === 'desatualizado') {
            <span class="rs-aviso" role="status">Dados desatualizados</span>
          }
          <button type="button" class="rs-botao rs-botao--pequeno voltar" (click)="fechar.emit()">
            Voltar ao mapa da frota <rs-icone nome="x" [tamanho]="14" />
          </button>
        </div>
        <dl class="dados">
          <div>
            <dt>Saída (1º embarque)</dt>
            <dd>{{ hora(d.veiculo.saida) }}</dd>
          </div>
          <div>
            <dt>Previsão de chegada</dt>
            @if (previsao(d.veiculo); as p) {
              <dd>
                {{ hora(d.veiculo.previsaoChegada) }}
                <rs-status-badge [texto]="p.comparacao" [tom]="p.tom" />
              </dd>
            } @else {
              <dd>—</dd>
            }
          </div>
          <div>
            <dt>Tempo médio</dt>
            <dd>{{ minutos(d.veiculo.tempoMedioMin) }}</dd>
          </div>
          @if (rastreio()?.naCercaDesde; as desde) {
            <div>
              <dt>Na escola desde</dt>
              <dd>{{ hora(desde) }}</dd>
            </div>
          } @else {
            <div>
              <dt>Até a escola</dt>
              <dd>{{ distancia(rastreio()?.distanciaEscolaM ?? null) }}</dd>
            </div>
          }
          <div>
            <dt>A bordo</dt>
            <dd>{{ d.veiculo.aBordo }} de {{ d.veiculo.esperados }}</dd>
          </div>
          <div>
            <dt>Ocupação</dt>
            @if (d.veiculo.capacidade) {
              <dd>{{ percentual(d.veiculo.ocupacao) }} de {{ d.veiculo.capacidade }}</dd>
            } @else {
              <dd title="A API não informou a capacidade deste veículo">sem capacidade</dd>
            }
          </div>
        </dl>
      </section>
    } @else {
      <rs-chart-card
        class="baixo"
        titulo="Veículo"
        [estado]="detalhe.estado()"
        (tentarDeNovo)="detalhe.recarregar()"
      >
        <button acoes type="button" class="rs-botao rs-botao--pequeno" (click)="fechar.emit()">
          Voltar ao mapa da frota
        </button>
      </rs-chart-card>
    }

    <ng-template #controles>
      <div class="controles-mapa">
        <div class="abas" role="group" aria-label="Visão do trajeto">
          <button type="button" [attr.aria-pressed]="visao() === 'replay'" (click)="ver('replay')">
            Replay
          </button>
          <button type="button" [attr.aria-pressed]="visao() === 'aovivo'" (click)="ver('aovivo')">
            Ao vivo
          </button>
        </div>
        <label class="marcar">
          <input
            type="checkbox"
            [checked]="mostrarParadas()"
            (change)="mostrarParadas.set($any($event.target).checked)"
          />
          Paradas aprendidas
        </label>
      </div>
    </ng-template>

    <ng-template #notaDasParadas>
      @if (mostrarParadas()) {
        @switch (paradas.estado()) {
          @case ('carregando') {
            <p class="rs-nota">Aprendendo as paradas…</p>
          }
          @case ('erro') {
            <p class="rs-aviso">
              Não foi possível carregar as paradas.
              <button
                type="button"
                class="rs-botao rs-botao--pequeno"
                (click)="paradas.recarregar()"
              >
                Tentar de novo
              </button>
            </p>
          }
          @default {
            @if (paradas.dados(); as p) {
              <p class="rs-nota">
                @if (p.paradas.length) {
                  {{ p.paradas.length }} parada(s) em {{ p.diasAnalisados }} dia(s) letivo(s):
                  @for (pa of p.paradas; track $index) {
                    <span class="rs-mono">{{ horarios(pa) }}</span>{{ $last ? '' : ' · ' }}
                  }
                } @else {
                  Ainda sem paradas: são precisos ao menos 3 embarques no mesmo ponto com GPS
                  guardado.
                }
              </p>
            }
          }
        }
      }
    </ng-template>

    <!-- O replay só é escondido (não destruído) no "ao vivo": o dia escolhido continua lá na volta. -->
    <rs-replay-trajeto
      [veiculoId]="veiculoId()"
      [paradas]="paradasNoMapa()"
      [oculto]="visao() !== 'replay'"
    >
      <div visao>
        @if (visao() === 'replay') {
          <ng-container *ngTemplateOutlet="controles" />
        }
      </div>
      <div rodape>
        @if (visao() === 'replay') {
          <ng-container *ngTemplateOutlet="notaDasParadas" />
        }
      </div>
    </rs-replay-trajeto>

    @if (visao() === 'aovivo') {
      <rs-chart-card
        titulo="Trajeto"
        [estado]="veiculos().length ? 'ok' : 'vazio'"
        mensagemVazio="Nenhum veículo para mostrar com esses filtros."
      >
        <div acoes><ng-container *ngTemplateOutlet="controles" /></div>
        <rs-mapa-veiculos
          altura="clamp(380px, 60dvh, 560px)"
          [veiculos]="veiculos()"
          [rastreios]="rastreios()"
          [raioCercaM]="raioCercaM()"
          [selecionadoId]="veiculoId()"
          [paradas]="paradasNoMapa()"
          (selecionar)="selecionar.emit($event)"
        />
        <ng-container *ngTemplateOutlet="notaDasParadas" />
      </rs-chart-card>
    }

    @if (detalhe.dados(); as d) {
      <section class="painel embarques" aria-labelledby="titulo-embarques">
        <div class="linha">
          <h2 id="titulo-embarques">Embarque e desembarque de hoje</h2>
          <p class="rs-nota">
            {{ d.veiculo.embarcados }} embarcados ·
            {{
              d.veiculo.ultimaLeitura
                ? 'última leitura às ' + hora(d.veiculo.ultimaLeitura)
                : 'sem leituras hoje'
            }}
          </p>
          <button
            type="button"
            class="chave"
            [attr.aria-expanded]="aberto()"
            aria-controls="corpo-embarques"
            (click)="aberto.set(!aberto())"
          >
            <i aria-hidden="true"></i>{{ aberto() ? 'Ocultar' : 'Mostrar' }}
          </button>
        </div>
        <div id="corpo-embarques">
          @if (aberto()) {
            <div class="corpo">
              <div class="rs-grade rs-grade--2">
                <div>
                  <h3>Embarcados hoje ({{ d.embarcados.length }})</h3>
                  <ul class="rs-lista" tabindex="0" aria-label="Alunos embarcados hoje">
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
                  <ul class="rs-lista" tabindex="0" aria-label="Últimas leituras do veículo">
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
              <a
                class="rs-botao rs-botao--pequeno"
                routerLink="/jornada"
                [queryParams]="{ onibus: veiculoId() }"
                queryParamsHandling="merge"
                >Abrir este veículo na Jornada do aluno →</a
              >
            </div>
          }
        </div>
      </section>
    }
  `,
  styleUrl: './detalhe-veiculo.css',
})
export class DetalheDoVeiculo {
  private readonly api = inject(PainelApi);

  readonly veiculoId = input.required<number>();
  /** Frota filtrada e GPS: usados no mapa "ao vivo". */
  readonly veiculos = input<StatusVeiculo[]>([]);
  readonly rastreios = input<RastreioVeiculo[]>([]);
  readonly raioCercaM = input(0);
  /** Relógio da tela, para o "há X s" do GPS andar sozinho. */
  readonly agora = input(Date.now());
  readonly fechar = output<void>();
  readonly selecionar = output<number>();

  protected readonly estadoVeiculo = ESTADO_VEICULO;
  protected readonly jornada = JORNADA;
  protected readonly hora = hora;
  protected readonly minutos = minutos;
  protected readonly percentual = percentual;
  protected readonly distancia = distancia;
  protected readonly previsao = textoPrevisao;
  protected readonly horarios = horariosDaParada;

  protected readonly detalhe = cargaPorChave(
    () => this.veiculoId(),
    (id) => this.api.veiculo(id),
  );

  /** Cada veículo abre no replay. */
  protected readonly visao = linkedSignal<number, Visao>({
    source: () => this.veiculoId(),
    computation: () => 'replay',
  });
  /** Lista de embarques: começa oculta e fica como o usuário deixar ao trocar de veículo. */
  protected readonly aberto = signal(false);

  /** Camada de paradas aprendidas: só busca quando ligada (a consulta é auditada). */
  protected readonly mostrarParadas = signal(false);
  protected readonly paradas = cargaPorChave(
    () => (this.mostrarParadas() ? this.veiculoId() : null),
    (id) => this.api.paradas(id),
  );
  protected readonly paradasNoMapa = computed(() => this.paradas.dados()?.paradas ?? []);

  protected readonly rastreio = computed(() =>
    this.rastreios().find((r) => r.veiculoId === this.veiculoId()),
  );
  protected readonly gps = computed(() => situacaoGps(this.rastreio(), this.agora()));

  constructor() {
    const sse = inject(SseService);
    merge(sse.de('veiculo.atualizado'), sse.de('jornada.atualizada'))
      .pipe(auditTime(3000), takeUntilDestroyed())
      .subscribe(() => this.detalhe.recarregar(true));
  }

  protected titulo(v: StatusVeiculo): string {
    return [v.prefixo, v.placa].filter(Boolean).join(' · ') || `#${v.id}`;
  }

  protected ver(visao: Visao): void {
    this.visao.set(visao);
  }
}
