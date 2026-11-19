import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { carga } from '../../core/api/carga';
import { LinhaJornada } from '../../core/api/modelos';
import { PainelApi } from '../../core/api/painel-api.service';
import { FiltrosStore } from '../../core/filtros/filtros.store';
import { IndicadorConexao } from '../../core/sse/indicador-conexao';
import { SseService } from '../../core/sse/sse.service';
import { hora, isoLocal, minutos } from '../../shared/formato';
import { ChartCard } from '../../shared/ui/chart-card';
import { StatusBadge } from '../../shared/ui/status-badge';
import { EstadoJornada, JORNADA } from '../../shared/ui/tom';
import {
  COLUNAS,
  TEXTO_DIVERGENCIA,
  aplicarAtualizacao,
  pertence,
  porColuna,
} from './jornada.logica';
import { MapaJornada } from './mapa-jornada';

/** Tamanho máximo pedido ao backend por quadro (o limite do servidor é 200). */
const TAMANHO = 200;

/** Jornada do dia em colunas por estado. Os cards mudam de coluna em tempo real (SSE `jornada.atualizada`). */
import { Icone } from '../../shared/ui/icone';
@Component({
  selector: 'rs-jornada',
  imports: [Icone, ChartCard, StatusBadge, IndicadorConexao, MapaJornada],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rs-pagina">
      <div class="rs-pagina__topo">
        <h1>Jornada do aluno</h1>
        <div class="rs-pagina__acoes">
          <label>
            <span class="rs-somente-leitor">Dia</span>
            <input
              class="rs-campo"
              type="date"
              [value]="dia()"
              [max]="hoje"
              (change)="mudarDia($event)"
            />
          </label>
          <label>
            <span class="rs-somente-leitor">Veículo</span>
            <select
              class="rs-campo"
              (change)="mudarVeiculo($event)"
              aria-label="Filtrar por veículo"
            >
              <option value="" [selected]="veiculoId() === null">Todos os veículos</option>
              @for (v of veiculos(); track v) {
                <option [value]="v" [selected]="veiculoId() === v">Veículo #{{ v }}</option>
              }
            </select>
          </label>
          <rs-indicador-conexao />
        </div>
      </div>

      <rs-chart-card
        titulo="Quadro do dia"
        [estado]="quadro.estado()"
        [atualizadoEm]="quadro.atualizadoEm()"
        mensagemVazio="Nenhum aluno para os filtros selecionados."
        (tentarDeNovo)="quadro.recarregar()"
      >
        @if (truncado()) {
          <p class="rs-aviso">
            Mostrando {{ linhas().length }} de {{ quadro.dados()?.jornadas?.total }} alunos. Use os
            filtros de escola ou turma para ver todos.
          </p>
        }
        <div class="colunas">
          @for (coluna of colunas; track coluna) {
            <section
              class="coluna"
              [attr.data-estado]="coluna"
              [attr.aria-labelledby]="'col-' + coluna"
            >
              <h2 [id]="'col-' + coluna">
                <rs-status-badge [texto]="jornada[coluna].rotulo" [tom]="jornada[coluna].tom" />
                <span class="contador" [attr.aria-label]="contadores()[coluna] + ' alunos'">{{
                  contadores()[coluna]
                }}</span>
              </h2>
              <ul>
                @for (linha of grupos()[coluna]; track linha.aluno.id) {
                  <li>
                    <button
                      type="button"
                      class="cartao"
                      [attr.data-aluno]="linha.aluno.id"
                      (click)="abrir(linha.aluno.id)"
                    >
                      <span class="rs-avatar" aria-hidden="true">{{
                        linha.aluno.iniciais || '?'
                      }}</span>
                      <span class="info">
                        <strong
                          >{{ linha.aluno.iniciais || 'Aluno' }} · #{{ linha.aluno.id }}</strong
                        >
                        <span>{{ linha.aluno.turma || 'Sem turma' }}</span>
                        <span class="rs-mono">
                          {{
                            linha.jornada.veiculoId
                              ? 'Veíc. #' + linha.jornada.veiculoId
                              : 'Sem veículo'
                          }}
                          · {{ hora(linha.jornada.embarqueEm) }} →
                          {{ hora(linha.jornada.chegadaEm) }}
                          @if (linha.jornada.tempoTrajetoMin !== null) {
                            · {{ minutos(linha.jornada.tempoTrajetoMin) }}
                          }
                        </span>
                      </span>
                    </button>
                  </li>
                } @empty {
                  <li class="rs-nota vazio">Ninguém aqui.</li>
                }
              </ul>
            </section>
          }
        </div>
      </rs-chart-card>
    </div>

    @if (selecionada(); as linha) {
      <aside
        class="rs-painel-lateral"
        role="dialog"
        aria-modal="false"
        aria-labelledby="titulo-painel"
        (keydown.escape)="fechar()"
      >
        <div class="rs-pagina__topo">
          <h2 id="titulo-painel">{{ linha.aluno.nome || 'Aluno #' + linha.aluno.id }}</h2>
          <button
            type="button"
            class="rs-botao rs-botao--pequeno"
            (click)="fechar()"
            aria-label="Fechar painel"
          >
            <rs-icone nome="x" />
          </button>
        </div>
        <p class="rs-nota">
          {{ linha.aluno.turma || 'Sem turma' }} ·
          {{ linha.aluno.escolaNome || 'Escola não informada' }}
        </p>
        <p>
          <rs-status-badge
            [texto]="jornada[linha.jornada.estado].rotulo"
            [tom]="jornada[linha.jornada.estado].tom"
          />
        </p>

        @for (d of linha.jornada.divergencias; track d.tipo) {
          <p class="rs-aviso">
            {{ textoDivergencia[d.tipo] || d.tipo }} · {{ hora(d.detectadaEm) }}
          </p>
        }

        <h3>Linha do tempo</h3>
        <ol class="tempo">
          @for (passo of linha.jornada.passos; track $index) {
            <li>
              <span class="rs-mono">{{ hora(passo.dataHora) }}</span>
              <span>
                {{ passo.tipo === 'EMBARQUE' ? 'Embarque' : 'Chegada na escola' }}
                <span class="rs-nota">
                  · leitor #{{ passo.leitorId }}
                  {{ passo.veiculoId ? '· veículo #' + passo.veiculoId : '' }}
                  {{ passo.escolaId ? '· escola #' + passo.escolaId : '' }}
                </span>
              </span>
            </li>
          } @empty {
            <li class="rs-nota">Nenhuma leitura hoje.</li>
          }
        </ol>
        @if (
          linha.jornada.leiturasIgnoradas.duplicadas + linha.jornada.leiturasIgnoradas.foraDeOrdem >
          0
        ) {
          <p class="rs-nota">
            Leituras ignoradas: {{ linha.jornada.leiturasIgnoradas.duplicadas }} duplicadas,
            {{ linha.jornada.leiturasIgnoradas.foraDeOrdem }} fora de ordem.
          </p>
        }
        @if (linha.jornada.passos.length) {
          <h3>Onde embarcou e chegou</h3>
          @defer (on viewport) {
            <rs-mapa-jornada [alunoId]="linha.aluno.id" [data]="dia()" />
          } @placeholder {
            <p class="rs-nota">Mapa do embarque</p>
          }
        }
        <p>
          <a
            class="rs-botao"
            [href]="'/alunos/' + linha.aluno.id"
            (click)="irParaAluno($event, linha.aluno.id)"
            >Abrir perfil do aluno</a
          >
        </p>
      </aside>
    }
  `,
  styles: `
    /* As 5 colunas cabem lado a lado em telas largas; em telas menores quebram para a linha de baixo
       em vez de cortar a última coluna (Ausente) fora da tela. */
    .colunas {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      gap: 12px;
    }
    .coluna {
      min-width: 0;
      padding: 8px;
      border-radius: var(--raio-sm);
      background: var(--superficie-sutil);
    }
    .coluna h2 {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 13px;
    }
    .contador {
      font-variant-numeric: tabular-nums;
    }
    ul,
    ol {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .cartao {
      display: flex;
      gap: 8px;
      width: 100%;
      padding: 8px;
      border: 1px solid var(--borda);
      border-radius: var(--raio-sm);
      background: var(--superficie);
      text-align: left;
      cursor: pointer;
    }
    .cartao:hover {
      border-color: var(--borda-forte);
    }
    .info {
      display: flex;
      flex-direction: column;
      min-width: 0;
      font-size: 12px;
    }
    .vazio {
      padding: 6px;
    }
    .tempo li {
      display: flex;
      gap: 10px;
      padding-left: 10px;
      border-left: 2px solid var(--marca-secundaria);
    }
    h3 {
      margin: 16px 0 8px;
      font-size: 14px;
    }
  `,
})
export class Jornada {
  private readonly api = inject(PainelApi);
  private readonly filtros = inject(FiltrosStore);
  private readonly router = inject(Router);

  /** `?aluno=<id>` abre o painel lateral direto (vindo da Presença). Só o id vai na URL. */
  readonly aluno = input<string | undefined>();

  protected readonly colunas = COLUNAS;
  protected readonly jornada = JORNADA;
  protected readonly textoDivergencia = TEXTO_DIVERGENCIA;
  protected readonly hora = hora;
  protected readonly minutos = minutos;
  protected readonly hoje = isoLocal(new Date());

  protected readonly dia = signal(this.hoje);
  protected readonly veiculoId = signal<number | null>(null);
  protected readonly selecionadoId = signal<number | null>(null);
  /** Linhas exibidas: começam no que veio do servidor e recebem as atualizações SSE. */
  protected readonly linhas = signal<LinhaJornada[]>([]);

  protected readonly quadro = carga(
    () =>
      this.api.jornadas({
        ...this.filtros.parametros(),
        data: this.dia(),
        veiculoId: this.veiculoId(),
        tamanho: TAMANHO,
      }),
    { vazio: (q) => q.jornadas.total === 0 },
  );

  protected readonly grupos = computed(() => porColuna(this.linhas()));
  protected readonly contadores = computed(() => {
    const g = this.grupos();
    return Object.fromEntries(COLUNAS.map((c) => [c, g[c].length])) as Record<
      EstadoJornada,
      number
    >;
  });
  protected readonly truncado = computed(
    () => (this.quadro.dados()?.jornadas.total ?? 0) > this.linhas().length,
  );
  protected readonly veiculos = computed(() => {
    const ids = new Set<number>();
    for (const l of this.linhas()) {
      const v = l.jornada.veiculoId ?? l.aluno.veiculoId;
      if (v !== null) {
        ids.add(v);
      }
    }
    const atual = this.veiculoId();
    if (atual !== null) {
      ids.add(atual);
    }
    return [...ids].sort((a, b) => a - b);
  });
  protected readonly selecionada = computed(() => {
    const id = this.selecionadoId();
    return id === null ? null : (this.linhas().find((l) => l.aluno.id === id) ?? null);
  });

  constructor() {
    effect(() => {
      const dados = this.quadro.dados();
      untracked(() => this.linhas.set(dados?.jornadas.itens ?? []));
    });
    effect(() => {
      const id = Number(this.aluno());
      untracked(() => this.selecionadoId.set(Number.isInteger(id) && id > 0 ? id : null));
    });

    inject(SseService)
      .de<LinhaJornada>('jornada.atualizada')
      .pipe(takeUntilDestroyed())
      .subscribe((linha) => {
        const f = this.filtros.filtros();
        const filtro = {
          data: this.dia(),
          escolaId: f.escolaId,
          veiculoId: this.veiculoId(),
          anoEscolar: f.anoEscolar,
          turmaId: f.turmaId,
        };
        if (pertence(linha, filtro)) {
          this.linhas.update((atuais) => aplicarAtualizacao(atuais, linha));
        }
      });
  }

  protected mudarDia(evento: Event): void {
    const valor = (evento.target as HTMLInputElement).value;
    if (valor) {
      this.dia.set(valor);
    }
  }

  protected mudarVeiculo(evento: Event): void {
    const valor = (evento.target as HTMLSelectElement).value;
    this.veiculoId.set(valor ? Number(valor) : null);
  }

  protected abrir(id: number): void {
    this.selecionadoId.set(id);
  }

  protected fechar(): void {
    this.selecionadoId.set(null);
  }

  protected irParaAluno(evento: Event, id: number): void {
    evento.preventDefault();
    void this.router.navigate(['/alunos', id], { queryParamsHandling: 'preserve' });
  }
}
