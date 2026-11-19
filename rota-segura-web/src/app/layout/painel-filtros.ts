import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { OpcoesDeFiltro } from '../core/api/modelos';
import { FiltrosGlobais, FiltrosStore } from '../core/filtros/filtros.store';
import { Icone } from '../shared/ui/icone';

/**
 * Gaveta de filtros globais: lateral no computador, folha de baixo no celular.
 * Trabalha sobre um rascunho; só "Aplicar" muda a URL (e com ela todas as telas).
 */
@Component({
  selector: 'rs-painel-filtros',
  imports: [Icone],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog
      #dialogo
      class="rs-gaveta"
      aria-labelledby="titulo-filtros"
      (click)="fecharSeFora($event)"
      (close)="aberto.set(false)"
    >
      @if (aberto()) {
        <form class="corpo" method="dialog" (submit)="aplicar($event)">
          <header>
            <h2 id="titulo-filtros">Filtros</h2>
            <button type="button" class="fechar" (click)="fechar()" aria-label="Fechar filtros">
              <rs-icone nome="x" [tamanho]="20" />
            </button>
          </header>

          <fieldset>
            <legend>Ano letivo</legend>
            <div class="opcoes">
              <button
                type="button"
                [attr.aria-pressed]="rascunho().anoLetivo === null"
                (click)="mudar({ anoLetivo: null })"
              >
                Todos
              </button>
              @for (ano of anosLetivos(); track ano) {
                <button
                  type="button"
                  [attr.aria-pressed]="rascunho().anoLetivo === ano"
                  (click)="mudar({ anoLetivo: ano })"
                >
                  {{ ano }}
                </button>
              }
            </div>
          </fieldset>

          <label class="campo">
            <span>Escola</span>
            <select
              class="rs-campo"
              [disabled]="!opcoes()"
              (change)="mudarEscola($any($event.target).value)"
            >
              <option value="" [selected]="rascunho().escolaId === null">Todas as escolas</option>
              @for (e of opcoes()?.escolas ?? []; track e.id) {
                <option [value]="e.id" [selected]="rascunho().escolaId === e.id">
                  {{ e.nome }}
                </option>
              }
            </select>
          </label>

          @if ((opcoes()?.anosEscolares ?? []).length) {
            <fieldset>
              <legend>Ano escolar</legend>
              <div class="opcoes">
                <button
                  type="button"
                  [attr.aria-pressed]="rascunho().anoEscolar === null"
                  (click)="mudar({ anoEscolar: null, turmaId: null })"
                >
                  Todos
                </button>
                @for (a of opcoes()?.anosEscolares ?? []; track a) {
                  <button
                    type="button"
                    [attr.aria-pressed]="rascunho().anoEscolar === a"
                    (click)="mudar({ anoEscolar: a, turmaId: null })"
                  >
                    {{ a }}
                  </button>
                }
              </div>
            </fieldset>
          }

          <label class="campo">
            <span>Turma</span>
            <select
              class="rs-campo"
              [disabled]="!opcoes() || turmas().length === 0"
              (change)="mudarTurma($any($event.target).value)"
            >
              <option value="" [selected]="rascunho().turmaId === null">
                {{ turmas().length ? 'Todas as turmas' : 'Nenhuma turma para este filtro' }}
              </option>
              @for (t of turmas(); track t.id) {
                <option [value]="t.id" [selected]="rascunho().turmaId === t.id">
                  {{ t.nome }}
                </option>
              }
            </select>
          </label>

          <footer>
            <p class="rs-nota">O filtro vale para todas as telas e fica no endereço da página.</p>
            <div class="botoes">
              <button type="button" class="rs-botao" (click)="limpar()">Limpar</button>
              <button type="submit" class="rs-botao rs-botao--primario">Aplicar</button>
            </div>
          </footer>
        </form>
      }
    </dialog>
  `,
})
export class PainelFiltros {
  private readonly filtros = inject(FiltrosStore);
  readonly opcoes = input<OpcoesDeFiltro | null>(null);
  readonly anosLetivos = input<number[]>([]);

  private readonly dialogo = viewChild.required<ElementRef<HTMLDialogElement>>('dialogo');
  protected readonly aberto = signal(false);
  protected readonly rascunho = signal<FiltrosGlobais>(this.filtros.filtros());

  protected readonly turmas = computed(() => {
    const r = this.rascunho();
    return (this.opcoes()?.turmas ?? []).filter(
      (t) =>
        (r.escolaId === null || t.escolaId === r.escolaId) &&
        (r.anoEscolar === null || t.anoEscolar === r.anoEscolar),
    );
  });

  abrir(): void {
    this.rascunho.set(this.filtros.filtros());
    this.aberto.set(true);
    const d = this.dialogo().nativeElement;
    if (!d.open) {
      d.showModal();
    }
  }

  fechar(): void {
    this.dialogo().nativeElement.close();
  }

  protected mudar(parcial: Partial<FiltrosGlobais>): void {
    this.rascunho.update((r) => ({ ...r, ...parcial }));
  }

  protected mudarEscola(valor: string): void {
    // A turma pertence à escola: trocar a escola limpa a turma.
    this.mudar({ escolaId: valor ? Number(valor) : null, turmaId: null });
  }

  protected mudarTurma(valor: string): void {
    this.mudar({ turmaId: valor ? Number(valor) : null });
  }

  protected limpar(): void {
    this.rascunho.set({ anoLetivo: null, escolaId: null, anoEscolar: null, turmaId: null });
  }

  protected aplicar(evento: Event): void {
    evento.preventDefault();
    void this.filtros.definir(this.rascunho());
    this.fechar();
  }

  /** Clique no fundo escurecido (fora do formulário) fecha a gaveta. */
  protected fecharSeFora(evento: MouseEvent): void {
    if (evento.target === this.dialogo().nativeElement) {
      this.fechar();
    }
  }
}
