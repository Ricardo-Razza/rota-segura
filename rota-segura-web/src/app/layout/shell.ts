import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
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
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IndicadorConexao],
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
          <button type="button" class="rs-botao" (click)="tema.alternar()" [attr.aria-label]="rotuloTema()">
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
            <!-- Escola, ano escolar e turma recebem as opções quando os dados chegarem (Fase 2). -->
            @for (campo of ['Escola', 'Ano escolar', 'Turma']; track campo) {
              <label>
                <span>{{ campo }}</span>
                <select class="rs-campo" disabled title="Disponível quando os cadastros forem carregados">
                  <option>Todas</option>
                </select>
              </label>
            }
          </form>
          <rs-indicador-conexao />
        </header>

        <main id="conteudo" tabindex="-1">
          <router-outlet />
        </main>
      </div>
    </div>
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

  constructor() {
    this.sse.conectar();
  }

  ngOnDestroy(): void {
    this.sse.desconectar();
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
