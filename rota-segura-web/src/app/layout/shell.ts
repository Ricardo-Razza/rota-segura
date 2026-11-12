import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnDestroy,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AlertasAoVivo } from '../core/alertas/alertas-ao-vivo.service';
import { OpcoesDeFiltro } from '../core/api/modelos';
import { PainelApi } from '../core/api/painel-api.service';
import { BuscaGlobal } from './busca-global';
import { ROTULO_PERFIL } from '../core/auth/auth.models';
import { AuthService } from '../core/auth/auth.service';
import { FiltrosStore } from '../core/filtros/filtros.store';
import { IndicadorConexao } from '../core/sse/indicador-conexao';
import { SseService } from '../core/sse/sse.service';
import { TemaService } from '../core/tema/tema.service';

interface ItemDeMenu {
  rota: string;
  rotulo: string;
  sigla: string;
}

const CHAVE_MENU = 'rs.menu-recolhido';

/** Moldura das telas autenticadas: menu lateral recolhível, filtros globais no topo e conteúdo. */
@Component({
  selector: 'rs-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IndicadorConexao, BuscaGlobal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="pular" href="#conteudo">Pular para o conteúdo</a>
    <div class="shell" [class.shell--recolhido]="recolhido()">
      <aside class="menu">
        <div class="marca">
          <span class="rs-marca nome">
            <img src="logo.svg" alt="" width="40" height="32" />
            <span [class.rs-somente-leitor]="recolhido()">
              <span class="rs-marca__rota">Rota </span><span class="rs-marca__segura">Segura</span>
            </span>
          </span>
          <button
            type="button"
            class="recolher"
            (click)="alternarMenu()"
            [attr.aria-expanded]="!recolhido()"
            aria-controls="menu-principal"
            [attr.aria-label]="recolhido() ? 'Expandir menu' : 'Recolher menu'"
          >
            {{ recolhido() ? '»' : '«' }}
          </button>
        </div>

        <nav id="menu-principal" aria-label="Menu principal">
          @for (grupo of grupos; track grupo.titulo) {
            <div class="grupo">
              @if (!recolhido()) {
                <h2>{{ grupo.titulo }}</h2>
              }
              <ul>
                @for (item of grupo.itens; track item.rota) {
                  <li>
                    <a
                      [routerLink]="item.rota"
                      routerLinkActive="ativo"
                      ariaCurrentWhenActive="page"
                      queryParamsHandling="preserve"
                      [attr.title]="recolhido() ? item.rotulo : null"
                    >
                      <span class="sigla" aria-hidden="true">{{ item.sigla }}</span>
                      <span [class.rs-somente-leitor]="recolhido()">{{ item.rotulo }}</span>
                      @if (item.rota === '/alertas' && (alertas.abertos() ?? 0) > 0) {
                        <span
                          class="badge"
                          [class.badge--critico]="alertas.criticosAbertos() > 0"
                          [attr.aria-label]="alertas.abertos() + ' alertas abertos'"
                          >{{ alertas.abertos() }}</span
                        >
                      }
                    </a>
                  </li>
                }
              </ul>
            </div>
          }
        </nav>

        <footer>
          @if (!recolhido()) {
            <div class="usuario">
              <strong>{{ auth.usuario()?.nome }}</strong>
              <span>{{ perfil() }}</span>
            </div>
          }
          <button
            type="button"
            class="rs-botao"
            (click)="tema.alternar()"
            [attr.aria-label]="rotuloTema()"
          >
            {{ tema.tema() === 'escuro' ? '☀' : '☾' }}
            @if (!recolhido()) {
              <span>{{ tema.tema() === 'escuro' ? 'Tema claro' : 'Tema escuro' }}</span>
            }
          </button>
          <button type="button" class="rs-botao" (click)="sair()" aria-label="Sair do painel">
            ⎋
            @if (!recolhido()) {
              <span>Sair</span>
            }
          </button>
        </footer>
      </aside>

      <div class="principal">
        <header class="topo">
          <form class="filtros" aria-label="Filtros globais" (submit)="$event.preventDefault()">
            <label>
              <span>Ano letivo</span>
              <select class="rs-campo" (change)="mudarAnoLetivo($event)">
                <option value="" [selected]="filtros.anoLetivo() === null">Todos</option>
                @for (ano of anosLetivos; track ano) {
                  <option [value]="ano" [selected]="filtros.anoLetivo() === ano">{{ ano }}</option>
                }
              </select>
            </label>
            <label>
              <span>Escola</span>
              <select class="rs-campo" (change)="mudarEscola($event)" [disabled]="!opcoes()">
                <option value="" [selected]="filtros.escolaId() === null">Todas</option>
                @for (e of opcoes()?.escolas ?? []; track e.id) {
                  <option [value]="e.id" [selected]="filtros.escolaId() === e.id">
                    {{ e.nome }}
                  </option>
                }
              </select>
            </label>
            <label>
              <span>Ano escolar</span>
              <select class="rs-campo" (change)="mudarAnoEscolar($event)" [disabled]="!opcoes()">
                <option value="" [selected]="filtros.anoEscolar() === null">Todos</option>
                @for (a of opcoes()?.anosEscolares ?? []; track a) {
                  <option [value]="a" [selected]="filtros.anoEscolar() === a">{{ a }}</option>
                }
              </select>
            </label>
            <label>
              <span>Turma</span>
              <select class="rs-campo" (change)="mudarTurma($event)" [disabled]="!opcoes()">
                <option value="" [selected]="filtros.turmaId() === null">Todas</option>
                @for (t of turmas(); track t.id) {
                  <option [value]="t.id" [selected]="filtros.turmaId() === t.id">
                    {{ t.nome }}
                  </option>
                }
              </select>
            </label>
          </form>
          <div class="topo-acoes">
            <button
              type="button"
              class="rs-botao rs-botao--pequeno"
              (click)="busca.abrir()"
              aria-keyshortcuts="Control+K"
            >
              Buscar <kbd>Ctrl K</kbd>
            </button>
            <a
              class="rs-botao rs-botao--pequeno"
              routerLink="/operacao"
              queryParamsHandling="preserve"
              >Modo operação</a
            >
            <rs-indicador-conexao />
          </div>
        </header>

        <main id="conteudo" tabindex="-1">
          <router-outlet />
        </main>
      </div>
    </div>
    <rs-busca-global #busca />
  `,
  styles: `
    .pular {
      position: absolute;
      left: -9999px;
      top: 8px;
      z-index: 100;
      padding: 8px 12px;
      background: var(--superficie);
      border-radius: 8px;
    }
    .pular:focus {
      left: 8px;
    }
    .shell {
      display: grid;
      grid-template-columns: 240px 1fr;
      min-height: 100vh;
    }
    .shell--recolhido {
      grid-template-columns: 64px 1fr;
    }
    .menu {
      position: sticky;
      top: 0;
      display: flex;
      flex-direction: column;
      height: 100vh;
      border-right: 1px solid var(--borda);
      background: var(--superficie);
      overflow-y: auto;
    }
    .marca {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 12px;
      border-bottom: 1px solid var(--borda);
    }
    .shell--recolhido .marca {
      flex-direction: column;
    }
    .nome {
      flex: 1;
      min-width: 0;
      font-size: 17px;
    }
    .shell--recolhido .nome {
      flex: none;
    }
    .recolher {
      border: 1px solid var(--borda);
      border-radius: 6px;
      background: none;
      color: var(--texto-suave);
      cursor: pointer;
      padding: 2px 8px;
    }
    .recolher:hover {
      border-color: var(--borda-forte);
      color: var(--texto);
    }
    nav {
      flex: 1;
      padding: 8px;
    }
    .grupo h2 {
      padding: 14px 8px 6px;
      color: var(--texto-mudo);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.14em;
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    nav a {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px;
      border-radius: 8px;
      color: var(--texto);
      text-decoration: none;
    }
    nav a:hover {
      background: var(--superficie-2);
    }
    nav a.ativo {
      background: var(--info-fundo);
      box-shadow: inset 3px 0 0 var(--marca-secundaria);
      font-weight: 600;
    }
    .sigla {
      display: grid;
      place-items: center;
      flex: none;
      width: 28px;
      height: 28px;
      border: 1px solid var(--borda);
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      color: var(--texto-suave);
    }
    .badge {
      margin-left: auto;
      min-width: 20px;
      padding: 0 6px;
      border-radius: 999px;
      background: var(--atencao);
      color: #07111f;
      font-size: 11px;
      font-weight: 700;
      text-align: center;
    }
    .badge--critico {
      background: var(--critico);
    }
    .topo-acoes {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    kbd {
      font-family: var(--fonte-mono);
      font-size: 11px;
      color: var(--texto-suave);
    }
    nav a.ativo .sigla {
      border-color: var(--info);
      color: var(--info);
    }
    footer {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 12px;
      border-top: 1px solid var(--borda);
    }
    footer .rs-botao {
      justify-content: center;
    }
    .usuario {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .usuario strong {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .usuario span {
      color: var(--texto-suave);
      font-size: 12px;
    }
    .principal {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .topo {
      position: sticky;
      top: 0;
      z-index: 10;
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
      padding: 10px 20px;
      border-bottom: 1px solid var(--borda);
      background: var(--superficie);
    }
    .filtros {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }
    .filtros label {
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-size: 11px;
      color: var(--texto-suave);
    }
    .filtros select {
      min-width: 130px;
      color: var(--texto);
    }
    main {
      flex: 1;
      padding: 20px;
    }
    main:focus {
      outline: none;
    }
    @media (max-width: 760px) {
      .shell,
      .shell--recolhido {
        grid-template-columns: 64px 1fr;
      }
    }
  `,
})
export class Shell implements OnDestroy {
  protected readonly auth = inject(AuthService);
  protected readonly tema = inject(TemaService);
  protected readonly filtros = inject(FiltrosStore);
  private readonly sse = inject(SseService);
  private readonly router = inject(Router);

  protected readonly grupos: { titulo: string; itens: ItemDeMenu[] }[] = [
    {
      titulo: 'OPERACIONAL',
      itens: [
        { rota: '/dashboard', rotulo: 'Dashboard', sigla: 'Da' },
        { rota: '/presenca', rotulo: 'Presença', sigla: 'Pr' },
        { rota: '/jornada', rotulo: 'Jornada', sigla: 'Jo' },
        { rota: '/veiculos', rotulo: 'Veículos', sigla: 'Ve' },
        { rota: '/alertas', rotulo: 'Alertas', sigla: 'Al' },
      ],
    },
    {
      titulo: 'GESTÃO',
      itens: [
        { rota: '/alunos', rotulo: 'Alunos', sigla: 'Au' },
        { rota: '/relatorios', rotulo: 'Relatórios', sigla: 'Re' },
      ],
    },
  ];

  private readonly anoAtual = new Date().getFullYear();
  protected readonly anosLetivos = [this.anoAtual, this.anoAtual - 1, this.anoAtual - 2];
  protected readonly recolhido = signal(this.lerMenuRecolhido());
  protected readonly perfil = computed(() => {
    const usuario = this.auth.usuario();
    return usuario ? ROTULO_PERFIL[usuario.perfil] : '';
  });
  protected readonly rotuloTema = computed(() =>
    this.tema.tema() === 'escuro' ? 'Mudar para o tema claro' : 'Mudar para o tema escuro',
  );

  protected readonly alertas = inject(AlertasAoVivo);
  private readonly api = inject(PainelApi);
  protected readonly opcoes = signal<OpcoesDeFiltro | null>(null);
  /** Turmas da escola escolhida (ou todas), respeitando o ano escolar escolhido. */
  protected readonly turmas = computed(() =>
    (this.opcoes()?.turmas ?? []).filter(
      (t) =>
        (this.filtros.escolaId() === null || t.escolaId === this.filtros.escolaId()) &&
        (this.filtros.anoEscolar() === null || t.anoEscolar === this.filtros.anoEscolar()),
    ),
  );

  constructor() {
    this.sse.conectar();
    this.alertas.iniciar();
    effect((aoLimpar) => {
      const ano = this.filtros.anoLetivo();
      const assinatura = this.api.opcoesDeFiltro(ano).subscribe({
        next: (o) => this.opcoes.set(o),
        error: () => this.opcoes.set(null),
      });
      aoLimpar(() => assinatura.unsubscribe());
    });
  }

  ngOnDestroy(): void {
    this.sse.desconectar();
    this.alertas.parar();
  }

  @HostListener('document:keydown', ['$event'])
  protected atalho(evento: KeyboardEvent): void {
    if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === 'k') {
      evento.preventDefault();
      this.busca().abrir();
    }
  }

  private readonly busca = viewChild.required(BuscaGlobal);

  protected mudarEscola(evento: Event): void {
    const valor = (evento.target as HTMLSelectElement).value;
    void this.filtros.definir({ escolaId: valor ? Number(valor) : null });
  }

  protected mudarAnoEscolar(evento: Event): void {
    const valor = (evento.target as HTMLSelectElement).value;
    void this.filtros.definir({ anoEscolar: valor || null, turmaId: null });
  }

  protected mudarTurma(evento: Event): void {
    const valor = (evento.target as HTMLSelectElement).value;
    void this.filtros.definir({ turmaId: valor ? Number(valor) : null });
  }

  protected alternarMenu(): void {
    this.recolhido.update((valor) => !valor);
    try {
      localStorage.setItem(CHAVE_MENU, String(this.recolhido()));
    } catch {
      // Sem armazenamento: a preferência vale só para esta sessão.
    }
  }

  protected mudarAnoLetivo(evento: Event): void {
    const valor = (evento.target as HTMLSelectElement).value;
    void this.filtros.definir({ anoLetivo: valor ? Number(valor) : null });
  }

  protected sair(): void {
    this.auth.sair().subscribe(() => void this.router.navigate(['/login']));
  }

  private lerMenuRecolhido(): boolean {
    try {
      return localStorage.getItem(CHAVE_MENU) === 'true';
    } catch {
      return false;
    }
  }
}
