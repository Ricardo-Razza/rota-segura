import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { auditTime, merge } from 'rxjs';
import { AlertasAoVivo } from '../../core/alertas/alertas-ao-vivo.service';
import { carga } from '../../core/api/carga';
import { Alerta, Severidade, StatusAlerta } from '../../core/api/modelos';
import { PainelApi } from '../../core/api/painel-api.service';
import { SseService } from '../../core/sse/sse.service';
import { ToastService } from '../../core/toast/toast.service';
import { dataHora } from '../../shared/formato';
import { ChartCard } from '../../shared/ui/chart-card';
import { FilterChips, OpcaoChip } from '../../shared/ui/filter-chips';
import { KpiCard } from '../../shared/ui/kpi-card';
import { StatusBadge } from '../../shared/ui/status-badge';
import { Tom } from '../../shared/ui/tom';

export const SEVERIDADE: Record<Severidade, { rotulo: string; tom: Tom }> = {
  CRITICO: { rotulo: 'Crítico', tom: 'critico' },
  ATENCAO: { rotulo: 'Atenção', tom: 'atencao' },
  INFO: { rotulo: 'Informativo', tom: 'info' },
};

const ABAS: { status: StatusAlerta; rotulo: string }[] = [
  { status: 'ABERTO', rotulo: 'Abertos' },
  { status: 'EM_ANALISE', rotulo: 'Em análise' },
  { status: 'RESOLVIDO', rotulo: 'Resolvidos' },
];

/** Destino da ação "ir para a entidade": só ids na URL. */
export function rotaDaEntidade(a: Alerta): { caminho: string[]; params: Record<string, string> } {
  switch (a.entidade) {
    case 'ALUNO':
      return { caminho: ['/alunos', a.entidadeId], params: {} };
    case 'VEICULO':
      return { caminho: ['/veiculos'], params: { veiculo: a.entidadeId } };
    default:
      return { caminho: ['/veiculos'], params: {} };
  }
}

/** Alertas: resumo só de abertos, abas por status, assumir e resolver com comentário obrigatório. */
@Component({
  selector: 'rs-alertas',
  imports: [ChartCard, FilterChips, KpiCard, StatusBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rs-pagina">
      <div class="rs-pagina__topo">
        <h1>Alertas</h1>
        <div class="rs-pagina__acoes">
          <label class="som">
            <input type="checkbox" [checked]="aoVivo.som()" (change)="aoVivo.alternarSom()" />
            Som para alertas críticos
          </label>
        </div>
      </div>

      <div class="rs-grade rs-grade--kpi" aria-label="Resumo de alertas abertos">
        <rs-kpi-card
          rotulo="Críticos abertos"
          tom="critico"
          [valor]="resumo()?.abertosPorSeveridade?.CRITICO ?? (resumo() ? 0 : null)"
        />
        <rs-kpi-card
          rotulo="Atenção abertos"
          tom="atencao"
          [valor]="resumo()?.abertosPorSeveridade?.ATENCAO ?? (resumo() ? 0 : null)"
        />
        <rs-kpi-card
          rotulo="Informativos abertos"
          tom="info"
          [valor]="resumo()?.abertosPorSeveridade?.INFO ?? (resumo() ? 0 : null)"
        />
        <rs-kpi-card rotulo="Em análise" [valor]="resumo()?.emAnalise ?? null" />
      </div>

      <div class="rs-abas" role="tablist" aria-label="Status dos alertas">
        @for (a of abas; track a.status) {
          <button
            type="button"
            role="tab"
            [attr.aria-selected]="status() === a.status"
            (click)="status.set(a.status)"
          >
            {{ a.rotulo }}
          </button>
        }
      </div>
      <rs-filter-chips
        rotulo="Severidade"
        [opcoes]="chipsSeveridade"
        [(selecionados)]="severidades"
      />

      <rs-chart-card
        [titulo]="tituloLista()"
        [estado]="lista.estado()"
        [atualizadoEm]="lista.atualizadoEm()"
        mensagemVazio="Nenhum alerta aqui."
        (tentarDeNovo)="lista.recarregar()"
      >
        <ul class="rs-lista">
          @for (a of alertas(); track a.id) {
            <li class="alerta">
              <rs-status-badge
                [texto]="severidade[a.severidade].rotulo"
                [tom]="severidade[a.severidade].tom"
              />
              <div class="texto">
                <strong>{{ a.mensagem }}</strong>
                <span class="rs-nota">
                  {{ a.rotulo }}
                  @if (a.ocorrencias > 1) {
                    · {{ a.ocorrencias }} ocorrências
                  }
                  · última {{ dataHora(a.ultimaOcorrenciaEm) }}
                  @if (!a.ativo && a.status !== 'RESOLVIDO') {
                    · condição já não ocorre
                  }
                </span>
                @if (a.comentario) {
                  <span class="rs-nota">Comentário: {{ a.comentario }}</span>
                }
              </div>
              <div class="acoes">
                @if (a.status === 'ABERTO') {
                  <button type="button" class="rs-botao rs-botao--pequeno" (click)="assumir(a)">
                    Assumir
                  </button>
                }
                @if (a.status !== 'RESOLVIDO') {
                  <button
                    type="button"
                    class="rs-botao rs-botao--pequeno rs-botao--primario"
                    (click)="pedirResolucao(a)"
                  >
                    Resolver
                  </button>
                }
                <button type="button" class="rs-botao rs-botao--pequeno" (click)="irPara(a)">
                  Ir para {{ nomeEntidade(a) }}
                </button>
              </div>
            </li>
          }
        </ul>
      </rs-chart-card>
    </div>

    <dialog
      #dialogo
      class="rs-dialogo"
      aria-labelledby="titulo-resolver"
      (close)="resolvendo.set(null)"
    >
      <form method="dialog" (submit)="confirmarResolucao($event)">
        <h2 id="titulo-resolver">Resolver alerta</h2>
        <p class="rs-nota">{{ resolvendo()?.mensagem }}</p>
        <label class="campo">
          <span>Comentário (obrigatório)</span>
          <textarea
            class="rs-campo"
            rows="4"
            maxlength="1000"
            required
            [value]="comentario()"
            (input)="comentario.set($any($event.target).value)"
          ></textarea>
        </label>
        @if (erroComentario()) {
          <p class="rs-faixa-critico" role="alert">Descreva o que foi feito antes de resolver.</p>
        }
        <div class="rs-pagina__acoes">
          <button type="button" class="rs-botao" (click)="dialogo.close()">Cancelar</button>
          <button type="submit" class="rs-botao rs-botao--primario">Resolver</button>
        </div>
      </form>
    </dialog>
  `,
  styles: `
    .alerta {
      align-items: flex-start;
      flex-wrap: wrap;
    }
    .texto {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-width: 240px;
    }
    .acoes {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .campo {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin: 12px 0;
    }
    .som {
      display: flex;
      gap: 6px;
      align-items: center;
    }
  `,
})
export class Alertas {
  private readonly api = inject(PainelApi);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);
  protected readonly aoVivo = inject(AlertasAoVivo);

  protected readonly abas = ABAS;
  protected readonly severidade = SEVERIDADE;
  protected readonly dataHora = dataHora;
  protected readonly chipsSeveridade: OpcaoChip[] = (Object.keys(SEVERIDADE) as Severidade[]).map(
    (s) => ({
      valor: s,
      rotulo: SEVERIDADE[s].rotulo,
    }),
  );

  protected readonly status = signal<StatusAlerta>('ABERTO');
  protected readonly severidades = signal<string[]>([]);
  protected readonly resolvendo = signal<Alerta | null>(null);
  protected readonly comentario = signal('');
  protected readonly erroComentario = signal(false);
  private readonly dialogo = viewChild.required<ElementRef<HTMLDialogElement>>('dialogo');

  protected readonly lista = carga(
    () =>
      this.api.alertas({
        status: this.status(),
        severidade: this.severidades()[0] ?? null,
        tamanho: 100,
      }),
    { vazio: (l) => l.alertas.total === 0, desatualizado: () => false },
  );
  protected readonly resumo = computed(() => this.lista.dados()?.resumo ?? null);
  protected readonly alertas = computed(() => this.lista.dados()?.alertas.itens ?? []);
  protected readonly tituloLista = computed(
    () => ABAS.find((a) => a.status === this.status())!.rotulo,
  );

  constructor() {
    const sse = inject(SseService);
    merge(sse.de('alerta.criado'), sse.de('alerta.atualizado'))
      .pipe(auditTime(1500), takeUntilDestroyed())
      .subscribe(() => this.lista.recarregar(true));
  }

  protected nomeEntidade(a: Alerta): string {
    return a.entidade === 'ALUNO' ? 'aluno' : a.entidade === 'VEICULO' ? 'veículo' : 'leitor';
  }

  protected irPara(a: Alerta): void {
    const destino = rotaDaEntidade(a);
    void this.router.navigate(destino.caminho, {
      queryParams: destino.params,
      queryParamsHandling: 'merge',
    });
  }

  protected assumir(a: Alerta): void {
    this.api.alterarAlerta(a.id, 'EM_ANALISE', null).subscribe(() => {
      this.toasts.mostrar('Alerta assumido.', 'sucesso');
      this.atualizar();
    });
  }

  protected pedirResolucao(a: Alerta): void {
    this.resolvendo.set(a);
    this.comentario.set('');
    this.erroComentario.set(false);
    this.dialogo().nativeElement.showModal();
  }

  protected confirmarResolucao(evento: Event): void {
    evento.preventDefault();
    const alerta = this.resolvendo();
    const texto = this.comentario().trim();
    if (!alerta) {
      return;
    }
    if (!texto) {
      this.erroComentario.set(true);
      return;
    }
    this.api.alterarAlerta(alerta.id, 'RESOLVIDO', texto).subscribe(() => {
      this.dialogo().nativeElement.close();
      this.toasts.mostrar('Alerta resolvido.', 'sucesso');
      this.atualizar();
    });
  }

  private atualizar(): void {
    this.lista.recarregar(true);
    this.aoVivo.atualizarResumo();
  }
}
