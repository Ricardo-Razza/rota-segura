import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { carga } from '../../core/api/carga';
import { PainelApi, Parametros } from '../../core/api/painel-api.service';
import { Icone } from '../../shared/ui/icone';
import { AbaFrequencia } from './aba-frequencia';
import { AbaFrota } from './aba-frota';
import { AbaMatriculas } from './aba-matriculas';
import {
  ABAS,
  AbaAnalise,
  FiltroAnalise,
  contarFiltros,
  filtroDaUrl,
  paraApi,
  paraUrl,
  rotuloComparacao,
  rotuloPeriodo,
} from './analises.filtro';
import { FiltrosAnalise, OpcaoVeiculo } from './filtros-analise';

interface Chip {
  chave: keyof FiltroAnalise;
  rotulo: string;
}

function mesmosParametros(a: Parametros, b: Parametros): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Análises: tendências de frequência, matrículas e cadastro, frota e alertas. Cada aba busca só
 * quando está aberta; o filtro (período, comparação, escolas, etapa, turma, turno, ônibus) mora na
 * URL, então dá para voltar, recarregar e compartilhar o link mantendo a mesma visão.
 */
@Component({
  selector: 'rs-analises',
  imports: [AbaFrequencia, AbaFrota, AbaMatriculas, FiltrosAnalise, Icone],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="topo">
      <div>
        <h1>Análises</h1>
        <p class="sub">{{ rotuloPeriodo(filtro()) }} · {{ rotuloComparacao(filtro().comparar) }}</p>
      </div>
      <div class="acoes">
        <button type="button" class="rs-chip periodo" (click)="painel().abrir()">
          <rs-icone nome="cal" [tamanho]="15" />
          {{ rotuloPeriodo(filtro()) }}
        </button>
        @for (c of chips(); track c.chave) {
          <span class="rs-chip">
            {{ c.rotulo }}
            <button
              type="button"
              [attr.aria-label]="'Remover filtro ' + c.rotulo"
              (click)="remover(c.chave)"
            >
              <rs-icone nome="x" [tamanho]="13" />
            </button>
          </span>
        }
        <button
          type="button"
          class="rs-botao filtros"
          (click)="abrirFiltros()"
          [attr.aria-label]="'Filtros' + (quantos() ? ', ' + quantos() + ' ativos' : '')"
        >
          <rs-icone nome="filtro" [tamanho]="16" />
          Filtros
          @if (quantos()) {
            <span class="contador">{{ quantos() }}</span>
          }
        </button>
      </div>
    </header>

    <div class="rs-pilulas abas" role="tablist" aria-label="Análises">
      @for (a of abas; track a.valor) {
        <button
          type="button"
          role="tab"
          [id]="'aba-' + a.valor"
          [attr.aria-selected]="aba() === a.valor"
          [attr.aria-controls]="'painel-' + a.valor"
          [attr.tabindex]="aba() === a.valor ? 0 : -1"
          (click)="escolherAba(a.valor)"
          (keydown)="navegarAbas($event)"
        >
          {{ a.rotulo }}
        </button>
      }
    </div>

    <section
      class="painel"
      role="tabpanel"
      [id]="'painel-' + aba()"
      [attr.aria-labelledby]="'aba-' + aba()"
    >
      @switch (aba()) {
        @case ('frequencia') {
          <rs-aba-frequencia [parametros]="parametros()" />
        }
        @case ('matriculas') {
          <rs-aba-matriculas [parametros]="parametros()" />
        }
        @case ('frota') {
          <rs-aba-frota [parametros]="parametros()" />
        }
      }
    </section>

    <rs-filtros-analise
      [filtro]="filtro()"
      [opcoes]="opcoes.dados()"
      [veiculos]="veiculos()"
      (aplicado)="aplicar($event)"
    />
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .topo {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      justify-content: space-between;
      gap: 12px;
    }
    h1 {
      font-size: clamp(24px, 3vw, 30px);
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .sub {
      margin: 2px 0 0;
      color: var(--texto-suave);
    }
    .acoes {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
    }
    .periodo {
      gap: 6px;
      cursor: pointer;
    }
    .filtros {
      gap: 6px;
      border-radius: 12px;
    }
    .contador {
      display: inline-grid;
      place-items: center;
      min-width: 20px;
      height: 20px;
      padding: 0 6px;
      border-radius: 999px;
      background: var(--rs-verde-500);
      color: #fff;
      font-size: 12px;
      font-weight: 800;
    }
    .abas {
      align-self: flex-start;
      max-width: 100%;
      overflow-x: auto;
    }
    .painel {
      min-width: 0;
    }
    @media (max-width: 760px) {
      .topo {
        align-items: stretch;
      }
      .acoes {
        justify-content: flex-start;
      }
      .abas {
        align-self: stretch;
      }
    }
  `,
})
export class Analises {
  private readonly api = inject(PainelApi);
  private readonly router = inject(Router);
  private readonly rota = inject(ActivatedRoute);

  protected readonly abas = ABAS;
  protected readonly rotuloPeriodo = rotuloPeriodo;
  protected readonly rotuloComparacao = rotuloComparacao;
  protected readonly painel = viewChild.required(FiltrosAnalise);

  private readonly consulta = toSignal(this.rota.queryParamMap, {
    initialValue: this.rota.snapshot.queryParamMap,
  });

  protected readonly filtro = computed(() => filtroDaUrl(this.consulta()));
  protected readonly aba = computed<AbaAnalise>(() => {
    const pedida = this.consulta().get('aba');
    return ABAS.some((a) => a.valor === pedida) ? (pedida as AbaAnalise) : 'frequencia';
  });
  /** Igualdade por valor: trocar só o ônibus não recarrega a aba de frequência. */
  protected readonly parametros = computed(() => paraApi(this.filtro(), this.aba()), {
    equal: mesmosParametros,
  });
  protected readonly quantos = computed(() => contarFiltros(this.filtro()));

  protected readonly opcoes = carga(() => this.api.opcoesDeFiltro(this.filtro().anoLetivo));

  /** A lista de ônibus só é buscada quando o usuário abre a gaveta ou filtra por um ônibus. */
  private readonly querVeiculos = signal(false);
  private readonly frota = carga(() =>
    this.querVeiculos() || this.filtro().veiculoId !== null
      ? this.api.veiculos({}).pipe(
          map((s) =>
            s.veiculos.map<OpcaoVeiculo>((v) => ({
              id: v.id,
              rotulo: [v.placa ?? `Ônibus #${v.id}`, v.prefixo].filter(Boolean).join(' · '),
            })),
          ),
        )
      : null,
  );
  protected readonly veiculos = computed(() => this.frota.dados() ?? []);

  /** Chips só dos filtros próprios das Análises; ano letivo, ano escolar e turma já aparecem no topo global. */
  protected readonly chips = computed<Chip[]>(() => {
    const f = this.filtro();
    const chips: Chip[] = [];
    if (f.escolas.length) {
      const nomes = new Map((this.opcoes.dados()?.escolas ?? []).map((e) => [e.id, e.nome]));
      chips.push({
        chave: 'escolas',
        rotulo:
          f.escolas.length === 1
            ? (nomes.get(f.escolas[0]) ?? `Escola #${f.escolas[0]}`)
            : `${f.escolas.length} escolas`,
      });
    }
    if (f.etapa) {
      chips.push({ chave: 'etapa', rotulo: f.etapa.charAt(0) + f.etapa.slice(1).toLowerCase() });
    }
    if (f.turno) {
      chips.push({ chave: 'turno', rotulo: `Turno: ${f.turno.toLowerCase()}` });
    }
    if (f.veiculoId !== null) {
      const v = this.veiculos().find((x) => x.id === f.veiculoId);
      chips.push({ chave: 'veiculoId', rotulo: v ? v.rotulo : `Ônibus #${f.veiculoId}` });
    }
    return chips;
  });

  protected abrirFiltros(): void {
    this.querVeiculos.set(true);
    this.painel().abrir();
  }

  protected aplicar(f: FiltroAnalise): void {
    void this.router.navigate([], {
      relativeTo: this.rota,
      queryParams: paraUrl(f),
      queryParamsHandling: 'merge',
    });
  }

  protected remover(chave: keyof FiltroAnalise): void {
    const vazio: Partial<FiltroAnalise> =
      chave === 'escolas' ? { escolas: [], turmaId: null } : { [chave]: null };
    this.aplicar({ ...this.filtro(), ...vazio });
  }

  protected escolherAba(aba: AbaAnalise): void {
    void this.router.navigate([], {
      relativeTo: this.rota,
      queryParams: { aba: aba === 'frequencia' ? null : aba },
      queryParamsHandling: 'merge',
    });
  }

  /** Setas esquerda/direita trocam de aba (padrão de tablist acessível). */
  protected navegarAbas(evento: KeyboardEvent): void {
    if (evento.key !== 'ArrowRight' && evento.key !== 'ArrowLeft') {
      return;
    }
    evento.preventDefault();
    const i = ABAS.findIndex((a) => a.valor === this.aba());
    const proxima = ABAS[(i + (evento.key === 'ArrowRight' ? 1 : ABAS.length - 1)) % ABAS.length];
    this.escolherAba(proxima.valor);
    queueMicrotask(() => document.getElementById(`aba-${proxima.valor}`)?.focus());
  }
}
