import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { AlertasAoVivo } from '../core/alertas/alertas-ao-vivo.service';
import { OpcoesDeFiltro } from '../core/api/modelos';
import { PainelApi } from '../core/api/painel-api.service';
import { ROTULO_PERFIL } from '../core/auth/auth.models';
import { AuthService } from '../core/auth/auth.service';
import { FiltrosGlobais, FiltrosStore } from '../core/filtros/filtros.store';
import { IndicadorConexao } from '../core/sse/indicador-conexao';
import { SseService } from '../core/sse/sse.service';
import { TemaService } from '../core/tema/tema.service';
import { Icone, NomeIcone } from '../shared/ui/icone';
import { BuscaGlobal } from './busca-global';
import { PainelFiltros } from './painel-filtros';

interface Destino {
  rota: string;
  rotulo: string;
  icone: NomeIcone;
  /** Outras rotas que contam como "dentro" deste destino (para marcar o menu). */
  inclui?: string[];
}

interface ChipDeFiltro {
  chave: keyof FiltrosGlobais;
  rotulo: string;
}

/** Destinos principais. Agora reúne Resumo, Jornada e Presença; Frota reúne veículos e leitores. */
export const DESTINOS: Destino[] = [
  { rota: '/dashboard', rotulo: 'Agora', icone: 'agora', inclui: ['/jornada', '/presenca'] },
  { rota: '/escolas', rotulo: 'Escolas', icone: 'escola' },
  { rota: '/veiculos', rotulo: 'Frota', icone: 'onibus' },
  { rota: '/alunos', rotulo: 'Alunos', icone: 'aluno' },
  { rota: '/analises', rotulo: 'Análises', icone: 'grafico' },
  { rota: '/relatorios', rotulo: 'Relatórios', icone: 'documento' },
];

/** Subnavegação de "Agora". */
export const SECOES_AGORA = [
  { rota: '/dashboard', rotulo: 'Resumo' },
  { rota: '/jornada', rotulo: 'Jornada' },
  { rota: '/presenca', rotulo: 'Presença' },
];

function caminho(url: string): string {
  return url.split(/[?#]/)[0] || '/';
}

/** Iniciais do usuário do painel (servidor da secretaria), para o avatar. */
export function iniciais(nome: string | null | undefined): string {
  const partes = (nome ?? '').trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) {
    return '?';
  }
  const primeira = partes[0][0];
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
  return (primeira + ultima).toUpperCase();
}

/**
 * Moldura das telas autenticadas (direção B): barra de vidro no topo com os destinos,
 * filtros, busca, alertas e menu do usuário. No celular os destinos descem para uma barra
 * fixa embaixo e os filtros abrem numa folha de baixo.
 */
@Component({
  selector: 'rs-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    IndicadorConexao,
    BuscaGlobal,
    PainelFiltros,
    Icone,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="pular" href="#conteudo">Pular para o conteúdo</a>

    <header class="topo" #topo>
      <a class="marca" routerLink="/dashboard" queryParamsHandling="preserve" aria-label="Início">
        <img src="logo.svg" alt="" width="36" height="29" />
        <span class="marca__nome rs-marca"
          ><span class="rs-marca__rota">Rota</span
          ><span class="rs-marca__segura">Segura</span></span
        >
      </a>

      <nav class="nav" aria-label="Menu principal">
        @for (d of destinos; track d.rota) {
          <a
            [routerLink]="d.rota"
            queryParamsHandling="preserve"
            [class.ativo]="ativo(d)"
            [attr.aria-current]="ativo(d) ? 'page' : null"
          >
            <rs-icone [nome]="d.icone" [tamanho]="20" />
            <span>{{ d.rotulo }}</span>
          </a>
        }
      </nav>

      <div class="acoes">
        <rs-indicador-conexao class="so-largo" />
        <button
          type="button"
          class="acao acao--filtros"
          (click)="painel().abrir()"
          [attr.aria-label]="
            filtrosAtivos() ? 'Filtros, ' + filtrosAtivos() + ' ativos' : 'Abrir filtros'
          "
        >
          <rs-icone nome="filtro" />
          <span class="so-largo">Filtros</span>
          @if (filtrosAtivos()) {
            <span class="contador">{{ filtrosAtivos() }}</span>
          }
        </button>
        <button
          type="button"
          class="acao"
          (click)="busca().abrir()"
          aria-keyshortcuts="Control+K"
          aria-label="Buscar aluno, placa ou leitor"
        >
          <rs-icone nome="busca" />
          <kbd class="so-largo">Ctrl K</kbd>
        </button>
        <a
          class="acao sino"
          routerLink="/alertas"
          queryParamsHandling="preserve"
          routerLinkActive="ativo"
          [attr.aria-label]="rotuloSino()"
        >
          <rs-icone nome="sino" />
          @if ((alertas.abertos() ?? 0) > 0) {
            <span class="contador" [class.contador--critico]="alertas.criticosAbertos() > 0">{{
              alertas.abertos()
            }}</span>
          }
        </a>

        <div class="usuario">
          <button
            #botaoUsuario
            type="button"
            class="avatar"
            (click)="menuAberto.set(!menuAberto())"
            [attr.aria-expanded]="menuAberto()"
            aria-controls="menu-usuario"
            aria-haspopup="menu"
            [attr.aria-label]="'Menu de ' + (auth.usuario()?.nome ?? 'usuário')"
          >
            {{ siglaUsuario() }}
          </button>
          @if (menuAberto()) {
            <div
              id="menu-usuario"
              class="menu-usuario rs-vidro"
              role="menu"
              (keydown.escape)="fecharMenu(true)"
            >
              <div class="quem">
                <strong>{{ auth.usuario()?.nome }}</strong>
                <span>{{ perfil() }}</span>
              </div>
              <button type="button" role="menuitem" (click)="tema.alternar()">
                <rs-icone [nome]="tema.tema() === 'escuro' ? 'sol' : 'lua'" />
                {{ tema.tema() === 'escuro' ? 'Tema claro' : 'Tema escuro' }}
              </button>
              <button
                type="button"
                role="menuitemcheckbox"
                [attr.aria-checked]="alertas.som()"
                (click)="alertas.alternarSom()"
              >
                <rs-icone [nome]="alertas.som() ? 'som' : 'mudo'" />
                Som em alerta crítico: {{ alertas.som() ? 'ligado' : 'desligado' }}
              </button>
              <a
                role="menuitem"
                routerLink="/operacao"
                queryParamsHandling="preserve"
                (click)="fecharMenu()"
              >
                <rs-icone nome="tv" /> Modo TV
              </a>
              <button type="button" role="menuitem" class="sair" (click)="sair()">
                <rs-icone nome="sair" /> Sair
              </button>
            </div>
          }
        </div>
      </div>
    </header>

    <!-- Sempre presente (some com :empty) para o ResizeObserver medir o espaço acima do conteúdo. -->
    <div class="contexto" #contexto>
      @if (secaoAgora() || chips().length) {
        @if (secaoAgora()) {
          <nav class="rs-pilulas" aria-label="Seções de Agora">
            @for (s of secoesAgora; track s.rota) {
              <a
                [routerLink]="s.rota"
                queryParamsHandling="preserve"
                routerLinkActive="ativo"
                ariaCurrentWhenActive="page"
                >{{ s.rotulo }}</a
              >
            }
          </nav>
        }
        @if (chips().length) {
          <ul class="chips" aria-label="Filtros ativos">
            @for (c of chips(); track c.chave) {
              <li class="rs-chip">
                {{ c.rotulo }}
                <button
                  type="button"
                  (click)="removerFiltro(c.chave)"
                  [attr.aria-label]="'Remover filtro ' + c.rotulo"
                >
                  <rs-icone nome="x" [tamanho]="14" />
                </button>
              </li>
            }
            <li>
              <button type="button" class="limpar" (click)="filtros.limpar()">Limpar</button>
            </li>
          </ul>
        }
      }
    </div>

    <main id="conteudo" tabindex="-1" #conteudo>
      <router-outlet />
    </main>

    <rs-busca-global />
    <rs-painel-filtros [opcoes]="opcoes()" [anosLetivos]="anosLetivos" />
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      min-height: 100dvh;
    }
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

    /* Barra de vidro. O desfoque fica num pseudo-elemento: assim ele não vira "bloco de
       contenção" e a nav pode ser fixa no rodapé do celular. */
    .topo {
      position: sticky;
      top: 12px;
      z-index: 30;
      display: flex;
      align-items: center;
      gap: 16px;
      margin: 12px 16px 0;
      padding: 8px 10px 8px 16px;
      min-height: 64px;
    }
    .topo::before {
      content: '';
      position: absolute;
      inset: 0;
      z-index: -1;
      border: 1px solid var(--vidro-borda);
      border-radius: var(--raio-vidro);
      background: var(--vidro);
      box-shadow: var(--vidro-sombra);
      -webkit-backdrop-filter: var(--vidro-desfoque);
      backdrop-filter: var(--vidro-desfoque);
    }
    .marca {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      flex: none;
      text-decoration: none;
      font-size: 18px;
    }
    .marca__nome {
      gap: 0.28em;
    }
    .marca img {
      width: 36px;
      height: auto;
    }
    .nav {
      display: flex;
      gap: 4px;
      flex: 1;
      min-width: 0;
    }
    .nav a {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 9px 14px;
      border-radius: 12px;
      color: var(--texto-suave);
      font-weight: 700;
      text-decoration: none;
      white-space: nowrap;
    }
    .nav a:hover {
      color: var(--texto);
      background: var(--neutro-fundo);
    }
    .nav a.ativo {
      background: var(--realce);
      color: var(--texto-sobre-realce);
    }
    .acoes {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-left: auto;
    }
    .acao {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-width: 44px;
      height: 44px;
      padding: 0 12px;
      border: 1px solid var(--vidro-borda);
      border-radius: 14px;
      background: none;
      color: var(--texto);
      font-weight: 700;
      text-decoration: none;
      cursor: pointer;
    }
    .acao:hover,
    .acao.ativo {
      background: var(--neutro-fundo);
    }
    .acao--filtros {
      background: var(--realce);
      color: var(--texto-sobre-realce);
      border-color: transparent;
    }
    .acao--filtros:hover {
      background: var(--realce);
      opacity: 0.9;
    }
    kbd {
      font-family: var(--fonte-mono);
      font-size: 11px;
      color: var(--texto-mudo);
    }
    .contador {
      min-width: 20px;
      padding: 1px 6px;
      border-radius: 999px;
      background: var(--atencao);
      color: #07111f;
      font-size: 11px;
      font-weight: 800;
      line-height: 18px;
      text-align: center;
    }
    .acao--filtros .contador {
      background: var(--rs-verde-500);
      color: #fff;
    }
    .sino .contador {
      position: absolute;
      top: -6px;
      right: -6px;
    }
    .contador--critico {
      background: var(--critico);
    }
    .usuario {
      position: relative;
    }
    .avatar {
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      border: 0;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--rs-azul-500), var(--rs-teal-500));
      color: #fff;
      font-weight: 800;
      font-size: 14px;
      cursor: pointer;
    }
    .menu-usuario {
      position: absolute;
      top: calc(100% + 10px);
      right: 0;
      z-index: 40;
      display: flex;
      flex-direction: column;
      min-width: 260px;
      padding: 8px;
      background: var(--vidro-forte);
    }
    .quem {
      display: flex;
      flex-direction: column;
      padding: 8px 10px 10px;
      margin-bottom: 4px;
      border-bottom: 1px solid var(--vidro-borda);
    }
    .quem span {
      color: var(--texto-suave);
      font-size: 12px;
    }
    .menu-usuario button,
    .menu-usuario a {
      display: flex;
      align-items: center;
      gap: 10px;
      min-height: 42px;
      padding: 8px 10px;
      border: 0;
      border-radius: 10px;
      background: none;
      color: var(--texto);
      font-weight: 600;
      text-align: left;
      text-decoration: none;
      cursor: pointer;
    }
    .menu-usuario button:hover,
    .menu-usuario a:hover {
      background: var(--neutro-fundo);
    }
    .menu-usuario .sair {
      color: var(--critico);
    }

    .contexto {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      margin: 14px 16px 0;
    }
    .contexto:empty {
      display: none;
    }
    .chips {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .limpar {
      padding: 4px 8px;
      border: 0;
      background: none;
      color: var(--link);
      font-weight: 700;
      cursor: pointer;
    }
    main {
      flex: 1;
      width: 100%;
      max-width: 1600px;
      margin: 0 auto;
      padding: 18px 16px 32px;
    }
    main:focus {
      outline: none;
    }

    @media (max-width: 1180px) {
      .marca__nome,
      .so-largo {
        display: none;
      }
    }

    /* Celular: destinos numa barra fixa embaixo, ao alcance do polegar. */
    @media (max-width: 760px) {
      .topo {
        top: 8px;
        margin: 8px 8px 0;
        padding: 6px 6px 6px 12px;
        min-height: 56px;
        gap: 8px;
      }
      .marca__nome {
        display: inline-flex;
        font-size: 16px;
      }
      .nav {
        position: fixed;
        left: 8px;
        right: 8px;
        bottom: calc(8px + env(safe-area-inset-bottom));
        z-index: 30;
        justify-content: space-around;
        padding: 6px;
        border: 1px solid var(--vidro-borda);
        border-radius: 22px;
        background: var(--vidro-forte);
        box-shadow: var(--vidro-sombra);
      }
      .nav a {
        flex: 1;
        flex-direction: column;
        gap: 2px;
        padding: 7px 4px;
        font-size: 11px;
      }
      .nav a.ativo {
        background: none;
        color: var(--marca);
      }
      .acoes {
        gap: 4px;
      }
      .acao {
        min-width: 40px;
        height: 40px;
        padding: 0 8px;
        border-color: transparent;
      }
      .avatar {
        width: 40px;
        height: 40px;
      }
      .contexto {
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
        margin: 10px 8px 0;
      }
      .contexto .rs-pilulas {
        align-self: flex-start;
      }
      .chips {
        flex-wrap: nowrap;
        overflow-x: auto;
        scrollbar-width: none;
      }
      .chips > li {
        flex: none;
      }
      main {
        padding: 14px 8px calc(96px + env(safe-area-inset-bottom));
      }
    }
    @media (max-width: 380px) {
      .marca__nome {
        display: none;
      }
    }
  `,
})
export class Shell implements OnDestroy {
  protected readonly auth = inject(AuthService);
  protected readonly tema = inject(TemaService);
  protected readonly filtros = inject(FiltrosStore);
  protected readonly alertas = inject(AlertasAoVivo);
  private readonly sse = inject(SseService);
  private readonly router = inject(Router);
  private readonly api = inject(PainelApi);
  private readonly host = inject(ElementRef<HTMLElement>);

  protected readonly destinos = DESTINOS;
  protected readonly secoesAgora = SECOES_AGORA;

  private readonly anoAtual = new Date().getFullYear();
  protected readonly anosLetivos = [this.anoAtual, this.anoAtual - 1, this.anoAtual - 2];
  protected readonly opcoes = signal<OpcoesDeFiltro | null>(null);
  protected readonly menuAberto = signal(false);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => caminho(e.urlAfterRedirects)),
    ),
    { initialValue: caminho(this.router.url) },
  );

  protected readonly secaoAgora = computed(() =>
    SECOES_AGORA.some((s) => this.url().startsWith(s.rota)),
  );

  protected readonly perfil = computed(() => {
    const usuario = this.auth.usuario();
    return usuario ? ROTULO_PERFIL[usuario.perfil] : '';
  });
  protected readonly siglaUsuario = computed(() => iniciais(this.auth.usuario()?.nome));
  protected readonly rotuloSino = computed(() => {
    const n = this.alertas.abertos() ?? 0;
    return n > 0 ? `Alertas, ${n} abertos` : 'Alertas';
  });

  /** Filtros ativos como chips, com os nomes vindos das opções (sem dado pessoal). */
  protected readonly chips = computed<ChipDeFiltro[]>(() => {
    const f = this.filtros.filtros();
    const o = this.opcoes();
    const saida: ChipDeFiltro[] = [];
    if (f.anoLetivo !== null) {
      saida.push({ chave: 'anoLetivo', rotulo: `Ano letivo ${f.anoLetivo}` });
    }
    if (f.escolaId !== null) {
      const nome = o?.escolas.find((e) => e.id === f.escolaId)?.nome;
      saida.push({ chave: 'escolaId', rotulo: nome ?? `Escola #${f.escolaId}` });
    }
    if (f.anoEscolar !== null) {
      saida.push({ chave: 'anoEscolar', rotulo: f.anoEscolar });
    }
    if (f.turmaId !== null) {
      const nome = o?.turmas.find((t) => t.id === f.turmaId)?.nome;
      saida.push({ chave: 'turmaId', rotulo: nome ? `Turma ${nome}` : `Turma #${f.turmaId}` });
    }
    return saida;
  });
  protected readonly filtrosAtivos = computed(() => this.chips().length);

  protected readonly busca = viewChild.required(BuscaGlobal);
  protected readonly painel = viewChild.required(PainelFiltros);
  private readonly botaoUsuario = viewChild<ElementRef<HTMLButtonElement>>('botaoUsuario');
  private readonly topo = viewChild.required<ElementRef<HTMLElement>>('topo');
  private readonly contexto = viewChild.required<ElementRef<HTMLElement>>('contexto');
  private readonly conteudo = viewChild.required<ElementRef<HTMLElement>>('conteudo');
  private observadorAltura: ResizeObserver | null = null;

  constructor() {
    this.sse.conectar();
    this.alertas.iniciar();
    // Telas de altura fixa (mapa do Resumo, Escolas) descontam o espaço real acima e abaixo do conteúdo,
    // que muda com os filtros ativos, a subnavegação de "Agora" e a largura da tela.
    afterNextRender(() => {
      this.medirReservado();
      if (typeof ResizeObserver !== 'undefined') {
        this.observadorAltura = new ResizeObserver(() => this.medirReservado());
        this.observadorAltura.observe(this.topo().nativeElement);
        this.observadorAltura.observe(this.contexto().nativeElement);
      }
    });
    effect((aoLimpar) => {
      const ano = this.filtros.anoLetivo();
      const assinatura = this.api.opcoesDeFiltro(ano).subscribe({
        next: (o) => this.opcoes.set(o),
        error: () => this.opcoes.set(null),
      });
      aoLimpar(() => assinatura.unsubscribe());
    });
    // Trocar de tela fecha o menu do usuário.
    effect(() => {
      this.url();
      this.menuAberto.set(false);
    });
  }

  ngOnDestroy(): void {
    this.sse.desconectar();
    this.alertas.parar();
    this.observadorAltura?.disconnect();
    (this.host.nativeElement as HTMLElement).style.removeProperty('--rs-reservado');
  }

  @HostListener('window:resize')
  protected medirReservado(): void {
    const main = this.conteudo().nativeElement;
    const estilo = getComputedStyle(main);
    // main.offsetTop já inclui margens do topo e a linha de contexto (o host não é posicionado).
    const reservado =
      main.offsetTop +
      parseFloat(estilo.paddingTop || '0') +
      parseFloat(estilo.paddingBottom || '0');
    if (reservado > 0) {
      (this.host.nativeElement as HTMLElement).style.setProperty(
        '--rs-reservado',
        `${Math.round(reservado)}px`,
      );
    }
  }

  protected ativo(d: Destino): boolean {
    const atual = this.url();
    return [d.rota, ...(d.inclui ?? [])].some((r) => atual === r || atual.startsWith(r + '/'));
  }

  @HostListener('document:keydown', ['$event'])
  protected atalho(evento: KeyboardEvent): void {
    if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === 'k') {
      evento.preventDefault();
      this.busca().abrir();
    }
  }

  /** Clique fora do menu do usuário fecha o menu. */
  @HostListener('document:click', ['$event'])
  protected cliqueFora(evento: MouseEvent): void {
    if (!this.menuAberto()) {
      return;
    }
    const usuario = (this.host.nativeElement as HTMLElement).querySelector('.usuario');
    if (usuario && !usuario.contains(evento.target as Node)) {
      this.menuAberto.set(false);
    }
  }

  protected fecharMenu(devolverFoco = false): void {
    this.menuAberto.set(false);
    if (devolverFoco) {
      this.botaoUsuario()?.nativeElement.focus();
    }
  }

  protected removerFiltro(chave: keyof FiltrosGlobais): void {
    const parcial: Partial<FiltrosGlobais> = { [chave]: null };
    if (chave === 'anoEscolar' || chave === 'escolaId') {
      parcial.turmaId = null;
    }
    void this.filtros.definir(parcial);
  }

  protected sair(): void {
    this.auth.sair().subscribe(() => void this.router.navigate(['/login']));
  }
}
