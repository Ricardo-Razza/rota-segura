import { ScrollingModule } from '@angular/cdk/scrolling';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Observable, Subscription, debounceTime } from 'rxjs';
import { carga } from '../../core/api/carga';
import { AlunoComSituacao, ListaDeAlunos, TipoPendencia } from '../../core/api/modelos';
import { PainelApi } from '../../core/api/painel-api.service';
import { AuthService } from '../../core/auth/auth.service';
import { FiltrosStore } from '../../core/filtros/filtros.store';
import { ToastService } from '../../core/toast/toast.service';
import { dataHora } from '../../shared/formato';
import { ChartCard } from '../../shared/ui/chart-card';
import { FilterChips, OpcaoChip } from '../../shared/ui/filter-chips';
import { StatusBadge } from '../../shared/ui/status-badge';
import { JORNADA } from '../../shared/ui/tom';

type Aba = 'lista' | 'pendencias';
const TAMANHO = 200;

const PENDENCIA: Record<TipoPendencia, string> = {
  SEM_BIOMETRIA: 'Sem biometria',
  SEM_RESPONSAVEL: 'Sem responsável',
};

/** Alunos: lista com busca e rolagem virtual, pendências de cadastro e sincronização com a API. */
@Component({
  selector: 'rs-alunos',
  imports: [ChartCard, StatusBadge, FilterChips, RouterLink, ScrollingModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rs-pagina">
      <div class="rs-pagina__topo">
        <h1>Alunos</h1>
        @if (podeSincronizar()) {
          <div class="rs-pagina__acoes">
            @if (ultima(); as u) {
              <span class="rs-nota">
                Última sincronização {{ dataHora(u.concluidoEm || u.iniciadoEm) }} ·
                {{
                  u.sucesso
                    ? 'concluída'
                    : 'falhou' + (u.httpStatus ? ' (HTTP ' + u.httpStatus + ')' : '')
                }}
              </span>
            }
            <button
              type="button"
              class="rs-botao rs-botao--primario"
              [disabled]="sincronizando()"
              (click)="confirmarSincronizacao()"
            >
              {{ sincronizando() ? 'Sincronizando…' : 'Sincronizar alunos' }}
            </button>
          </div>
        }
      </div>

      <div class="rs-abas" role="tablist" aria-label="Seções">
        <button
          type="button"
          role="tab"
          [attr.aria-selected]="aba() === 'lista'"
          (click)="aba.set('lista')"
        >
          Lista
        </button>
        <button
          type="button"
          role="tab"
          [attr.aria-selected]="aba() === 'pendencias'"
          (click)="aba.set('pendencias')"
        >
          Pendências de cadastro
        </button>
      </div>

      @if (aba() === 'lista') {
        <div class="rs-pagina__acoes">
          <label>
            <span class="rs-somente-leitor">Buscar por nome</span>
            <input
              class="rs-campo"
              type="search"
              placeholder="Buscar por nome (mín. 2 letras)"
              [value]="termo()"
              (input)="termo.set($any($event.target).value)"
            />
          </label>
          <label>
            <span class="rs-somente-leitor">Turno</span>
            <select
              class="rs-campo"
              aria-label="Turno"
              (change)="turno.set($any($event.target).value || null)"
            >
              <option value="">Todos os turnos</option>
              @for (t of turnos(); track t) {
                <option [value]="t" [selected]="turno() === t">{{ t }}</option>
              }
            </select>
          </label>
          <span class="rs-nota">{{ total() }} aluno(s)</span>
        </div>

        <rs-chart-card
          titulo="Alunos"
          [estado]="estadoLista()"
          [atualizadoEm]="atualizadoEm()"
          mensagemVazio="Nenhum aluno encontrado."
          (tentarDeNovo)="recarregar()"
        >
          <!-- Só cria a lista quando o card a mostra: criada escondida (carregando), a rolagem virtual
               mede altura zero e desenha só as primeiras linhas, cortando a lista. -->
          @if (estadoLista() === 'ok' || estadoLista() === 'desatualizado') {
            <cdk-virtual-scroll-viewport
              itemSize="64"
              class="viewport"
              (scrolledIndexChange)="aoRolar($event)"
            >
              <a
                *cdkVirtualFor="let item of itens(); trackBy: porId"
                class="linha"
                [routerLink]="['/alunos', item.aluno.id]"
                queryParamsHandling="preserve"
              >
                <span class="rs-avatar" aria-hidden="true">{{ item.aluno.iniciais || '?' }}</span>
                <span class="quem">
                  <strong>{{ item.aluno.nome || 'Aluno #' + item.aluno.id }}</strong>
                  <span class="rs-nota"
                    >{{ item.aluno.turma || 'Sem turma' }} · {{ item.aluno.turno || '—' }} ·
                    {{ item.aluno.escolaNome || '—' }}</span
                  >
                </span>
                <span class="selos">
                  @if (item.estadoHoje; as e) {
                    <rs-status-badge [texto]="jornada[e].rotulo" [tom]="jornada[e].tom" />
                  }
                  @if (alertasPorAluno().get(item.aluno.id); as n) {
                    <rs-status-badge [texto]="n + ' alerta(s)'" tom="critico" />
                  }
                </span>
              </a>
            </cdk-virtual-scroll-viewport>
          }
        </rs-chart-card>
      } @else {
        <rs-filter-chips
          rotulo="Tipo de pendência"
          [opcoes]="chipsPendencia()"
          [(selecionados)]="tipoPendencia"
        />
        <rs-chart-card
          titulo="Pendências de cadastro"
          [estado]="pendencias.estado()"
          [atualizadoEm]="pendencias.atualizadoEm()"
          mensagemVazio="Nenhuma pendência para os filtros."
          (tentarDeNovo)="pendencias.recarregar()"
        >
          @if (pendencias.dados(); as p) {
            @if (!p.responsaveisAvaliados) {
              <p class="rs-aviso">
                "Sem responsável" não foi avaliado: o índice de responsáveis ainda não está
                completo.
              </p>
            }
            <ul class="rs-lista">
              @for (item of p.alunos.itens; track item.aluno.id) {
                <li>
                  <span class="rs-avatar" aria-hidden="true">{{ item.aluno.iniciais || '?' }}</span>
                  <a class="quem" [routerLink]="['/alunos', item.aluno.id]">{{
                    item.aluno.nome || 'Aluno #' + item.aluno.id
                  }}</a>
                  @for (t of item.pendencias; track t) {
                    <rs-status-badge [texto]="pendencia[t]" tom="atencao" />
                  }
                </li>
              }
            </ul>
            <p class="rs-nota">
              Veículo esperado não é avaliado: o cadastro da API não informa o veículo do aluno.
            </p>
          }
        </rs-chart-card>
      }
    </div>
  `,
  styles: `
    .viewport {
      height: min(560px, 62dvh);
    }
    .linha {
      display: flex;
      align-items: center;
      gap: 10px;
      height: 64px;
      padding: 0 8px;
      border-bottom: 1px solid var(--borda);
      color: var(--texto);
      text-decoration: none;
    }
    .linha:hover {
      background: var(--superficie-2);
    }
    .quem {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-width: 0;
    }
    .linha .quem > * {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .selos {
      display: flex;
      flex: none;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 4px;
      max-width: 50%;
    }
  `,
})
export class Alunos {
  private readonly api = inject(PainelApi);
  private readonly filtros = inject(FiltrosStore);
  private readonly auth = inject(AuthService);
  private readonly toasts = inject(ToastService);

  protected readonly jornada = JORNADA;
  protected readonly pendencia = PENDENCIA;
  protected readonly dataHora = dataHora;

  protected readonly aba = signal<Aba>('lista');
  protected readonly termo = signal('');
  protected readonly turno = signal<string | null>(null);
  protected readonly tipoPendencia = signal<string[]>([]);
  protected readonly sincronizando = signal(false);

  private readonly paginas = signal<AlunoComSituacao[]>([]);
  private readonly totalServidor = signal(0);
  /** O backend numera as páginas a partir de 1. */
  private readonly proximaPagina = signal(1);
  private readonly estadoBusca = signal<'carregando' | 'ok' | 'erro'>('carregando');
  private readonly desatualizado = signal(false);
  protected readonly atualizadoEm = signal<Date | null>(null);
  private carregandoMais = false;
  private requisicao: Subscription | null = null;
  private readonly termoDebounced = signal('');

  protected readonly itens = this.paginas.asReadonly();
  protected readonly total = this.totalServidor.asReadonly();
  protected readonly podeSincronizar = computed(() =>
    ['ADMIN', 'GESTAO', 'SECRETARIA'].includes(this.auth.usuario()?.perfil ?? ''),
  );
  protected readonly turnos = computed(() =>
    [
      ...new Set(
        this.paginas()
          .map((a) => a.aluno.turno)
          .filter((t): t is string => !!t),
      ),
    ].sort(),
  );
  protected readonly estadoLista = computed(() => {
    const e = this.estadoBusca();
    if (e !== 'ok') {
      return e;
    }
    if (this.paginas().length === 0) {
      return 'vazio';
    }
    return this.desatualizado() ? 'desatualizado' : 'ok';
  });

  protected readonly alertas = carga(() => this.api.alertas({ status: 'ABERTO', tamanho: 200 }));
  protected readonly alertasPorAluno = computed(() => {
    const mapa = new Map<number, number>();
    for (const a of this.alertas.dados()?.alertas.itens ?? []) {
      if (a.entidade === 'ALUNO') {
        const id = Number(a.entidadeId);
        mapa.set(id, (mapa.get(id) ?? 0) + 1);
      }
    }
    return mapa;
  });

  protected readonly pendencias = carga(
    () =>
      this.aba() === 'pendencias'
        ? this.api.pendencias({
            ...this.filtros.parametros(),
            tipo: (this.tipoPendencia()[0] as TipoPendencia | undefined) ?? null,
            tamanho: 200,
          })
        : null,
    { vazio: (p) => p.alunos.total === 0 },
  );
  protected readonly chipsPendencia = computed<OpcaoChip[]>(() => {
    const por = this.pendencias.dados()?.porTipo ?? {};
    return (Object.keys(PENDENCIA) as TipoPendencia[]).map((t) => ({
      valor: t,
      rotulo: PENDENCIA[t],
      contador: por[t] ?? 0,
    }));
  });

  protected readonly ultima = signal<{
    iniciadoEm: string;
    concluidoEm: string | null;
    sucesso: boolean;
    httpStatus: number | null;
  } | null>(null);

  constructor() {
    toObservable(this.termo)
      .pipe(debounceTime(300), takeUntilDestroyed())
      .subscribe((t) => this.termoDebounced.set(t.trim()));

    // Recomeça a lista quando muda filtro, termo ou turno.
    effect(() => {
      this.filtros.parametros();
      this.termoDebounced();
      this.turno();
      untracked(() => this.recarregar());
    });

    if (this.podeSincronizar()) {
      this.api
        .ultimaSincronizacao()
        .subscribe({ next: (u) => this.ultima.set(u), error: () => undefined });
    }
  }

  protected porId = (_: number, item: AlunoComSituacao) => item.aluno.id;

  protected recarregar(): void {
    // Descarta a página que ainda estava a caminho (era de outro filtro).
    this.requisicao?.unsubscribe();
    this.carregandoMais = false;
    this.paginas.set([]);
    this.proximaPagina.set(1);
    this.estadoBusca.set('carregando');
    this.carregarPagina();
  }

  protected aoRolar(indice: number): void {
    if (indice + 30 >= this.paginas().length && this.paginas().length < this.totalServidor()) {
      this.carregarPagina();
    }
  }

  protected confirmarSincronizacao(): void {
    if (
      !confirm(
        'Sincronizar o cadastro de alunos com a fonte de dados agora? A operação fica registrada em seu nome.',
      )
    ) {
      return;
    }
    this.sincronizando.set(true);
    this.api.sincronizarAlunos().subscribe({
      next: (r) => {
        this.sincronizando.set(false);
        this.ultima.set(r);
        if (r.sucesso) {
          this.toasts.mostrar('Sincronização concluída.', 'sucesso');
          this.recarregar();
        } else {
          this.toasts.mostrar(
            `A sincronização falhou${r.httpStatus ? ` (HTTP ${r.httpStatus})` : ''}.`,
            'critico',
          );
        }
      },
      error: () => this.sincronizando.set(false),
    });
  }

  private carregarPagina(): void {
    if (this.carregandoMais) {
      return;
    }
    this.carregandoMais = true;
    const pagina = this.proximaPagina();
    const filtros = { ...this.filtros.parametros(), turno: this.turno(), pagina, tamanho: TAMANHO };
    const termo = this.termoDebounced();
    const fonte: Observable<ListaDeAlunos> =
      termo.length >= 2 ? this.api.buscarAlunos(termo, filtros) : this.api.alunos(filtros);
    this.requisicao = fonte.subscribe({
      next: (lista) => {
        this.carregandoMais = false;
        this.paginas.update((atuais) =>
          pagina === 1 ? lista.alunos.itens : [...atuais, ...lista.alunos.itens],
        );
        this.totalServidor.set(lista.alunos.total);
        this.proximaPagina.set(pagina + 1);
        this.desatualizado.set(lista.desatualizado);
        this.atualizadoEm.set(new Date());
        this.estadoBusca.set('ok');
      },
      error: () => {
        this.carregandoMais = false;
        if (pagina === 1) {
          this.estadoBusca.set('erro');
        }
      },
    });
  }
}
