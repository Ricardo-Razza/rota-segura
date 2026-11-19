import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Comparacao, OpcoesDeFiltro } from '../../core/api/modelos';
import { Icone } from '../../shared/ui/icone';
import {
  COMPARACOES,
  FiltroAnalise,
  MAXIMO_DIAS,
  PRESETS,
  PresetAnalise,
  diasEntre,
  periodoDoPreset,
} from './analises.filtro';

export interface OpcaoVeiculo {
  id: number;
  rotulo: string;
}

const LIMPO: Omit<FiltroAnalise, 'preset' | 'inicio' | 'fim' | 'comparar'> = {
  escolas: [],
  etapa: null,
  anoEscolar: null,
  turmaId: null,
  turno: null,
  veiculoId: null,
  anoLetivo: null,
};

/**
 * Gaveta de filtros das Análises (mesmo visual da gaveta global). Trabalha num rascunho;
 * só "Aplicar" emite o filtro, que a página grava na URL e vale para as três abas.
 */
@Component({
  selector: 'rs-filtros-analise',
  imports: [Icone],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog
      #dialogo
      class="rs-gaveta"
      aria-labelledby="titulo-filtros-analise"
      (click)="fecharSeFora($event)"
      (close)="aberto.set(false)"
    >
      @if (aberto()) {
        <form class="corpo" (submit)="aplicar($event)">
          <header>
            <h2 id="titulo-filtros-analise">Filtros</h2>
            <button type="button" class="fechar" (click)="fechar()" aria-label="Fechar filtros">
              <rs-icone nome="x" [tamanho]="20" />
            </button>
          </header>

          <fieldset>
            <legend>Período</legend>
            <div class="opcoes">
              @for (p of presets; track p.valor) {
                <button
                  type="button"
                  [attr.aria-pressed]="rascunho().preset === p.valor"
                  (click)="escolherPreset(p.valor)"
                >
                  {{ p.rotulo }}
                </button>
              }
              <button
                type="button"
                [attr.aria-pressed]="rascunho().preset === 'personalizado'"
                (click)="mudar({ preset: 'personalizado' })"
              >
                Personalizado
              </button>
            </div>
            <div class="datas">
              <label>
                <span class="rs-somente-leitor">Início</span>
                <input
                  class="rs-campo"
                  type="date"
                  [value]="rascunho().inicio"
                  [max]="rascunho().fim"
                  (change)="mudarData('inicio', $any($event.target).value)"
                />
              </label>
              <label>
                <span class="rs-somente-leitor">Fim</span>
                <input
                  class="rs-campo"
                  type="date"
                  [value]="rascunho().fim"
                  [min]="rascunho().inicio"
                  (change)="mudarData('fim', $any($event.target).value)"
                />
              </label>
            </div>
            @if (erroPeriodo(); as erro) {
              <p class="erro" role="alert">{{ erro }}</p>
            }
          </fieldset>

          <fieldset>
            <legend>Comparar com</legend>
            <div class="opcoes">
              @for (c of comparacoes; track c.valor) {
                <button
                  type="button"
                  [attr.aria-pressed]="rascunho().comparar === c.valor"
                  (click)="mudar({ comparar: c.valor })"
                >
                  {{ c.rotulo }}
                </button>
              }
            </div>
          </fieldset>

          <fieldset>
            <legend>Escolas · {{ (opcoes()?.escolas ?? []).length }} disponíveis</legend>
            <input
              class="rs-campo busca"
              type="search"
              placeholder="Buscar escola"
              aria-label="Buscar escola"
              [value]="buscaEscola()"
              (input)="buscaEscola.set($any($event.target).value)"
            />
            <div class="lista-escolas">
              <label class="marcar">
                <input
                  type="checkbox"
                  [checked]="rascunho().escolas.length === 0"
                  (change)="mudar({ escolas: [], turmaId: null })"
                />
                Todas
              </label>
              @for (e of escolasVisiveis(); track e.id) {
                <label class="marcar">
                  <input
                    type="checkbox"
                    [checked]="rascunho().escolas.includes(e.id)"
                    (change)="alternarEscola(e.id)"
                  />
                  {{ e.nome }}
                </label>
              }
            </div>
          </fieldset>

          @if ((opcoes()?.etapas ?? []).length) {
            <fieldset>
              <legend>Etapa</legend>
              <div class="opcoes">
                <button
                  type="button"
                  [attr.aria-pressed]="rascunho().etapa === null"
                  (click)="mudar({ etapa: null })"
                >
                  Todas
                </button>
                @for (e of opcoes()?.etapas ?? []; track e) {
                  <button
                    type="button"
                    [attr.aria-pressed]="rascunho().etapa === e"
                    (click)="mudar({ etapa: e })"
                  >
                    {{ rotuloEtapa(e) }}
                  </button>
                }
              </div>
            </fieldset>
          }

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

          <div class="dupla">
            <label class="campo">
              <span>Turno</span>
              <select
                class="rs-campo"
                (change)="mudar({ turno: $any($event.target).value || null })"
              >
                <option value="" [selected]="rascunho().turno === null">Todos</option>
                @for (t of opcoes()?.turnos ?? []; track t) {
                  <option [value]="t" [selected]="rascunho().turno === t">{{ t }}</option>
                }
              </select>
            </label>
            <label class="campo">
              <span>Turma</span>
              <select
                class="rs-campo"
                [disabled]="turmas().length === 0"
                (change)="mudarNumero('turmaId', $any($event.target).value)"
              >
                <option value="" [selected]="rascunho().turmaId === null">
                  {{ turmas().length ? 'Todas' : 'Escolha uma escola' }}
                </option>
                @for (t of turmas(); track t.id) {
                  <option [value]="t.id" [selected]="rascunho().turmaId === t.id">
                    {{ t.nome }}
                  </option>
                }
              </select>
            </label>
          </div>

          <label class="campo">
            <span>Ônibus <small>(aba Frota e alertas)</small></span>
            <select class="rs-campo" (change)="mudarNumero('veiculoId', $any($event.target).value)">
              <option value="" [selected]="rascunho().veiculoId === null">
                Todos ({{ veiculos().length }})
              </option>
              @for (v of veiculos(); track v.id) {
                <option [value]="v.id" [selected]="rascunho().veiculoId === v.id">
                  {{ v.rotulo }}
                </option>
              }
            </select>
          </label>

          <footer>
            <p class="rs-nota">O filtro vale para as três abas e fica no endereço da página.</p>
            <div class="botoes">
              <button type="button" class="rs-botao" (click)="limpar()">Limpar</button>
              <button
                type="submit"
                class="rs-botao rs-botao--primario"
                [disabled]="!!erroPeriodo()"
              >
                Aplicar
              </button>
            </div>
          </footer>
        </form>
      }
    </dialog>
  `,
  styles: `
    .datas,
    .dupla {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-top: 10px;
    }
    .dupla {
      margin-top: 0;
    }
    .datas input {
      width: 100%;
      min-height: 42px;
      border-radius: 12px;
      color-scheme: dark light;
    }
    .busca {
      width: 100%;
      min-height: 42px;
      border-radius: 12px;
    }
    .lista-escolas {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px 12px;
      max-height: 188px;
      margin-top: 8px;
      overflow-y: auto;
    }
    .marcar {
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 34px;
      font-size: 14px;
      cursor: pointer;
    }
    .marcar input {
      width: 18px;
      height: 18px;
      accent-color: var(--rs-verde-500);
    }
    .campo small {
      font-weight: 600;
      letter-spacing: 0;
      text-transform: none;
    }
    .erro {
      margin: 8px 0 0;
      color: var(--critico);
      font-size: 13px;
    }
    @media (max-width: 760px) {
      .lista-escolas {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class FiltrosAnalise {
  readonly filtro = input.required<FiltroAnalise>();
  readonly opcoes = input<OpcoesDeFiltro | null>(null);
  readonly veiculos = input<OpcaoVeiculo[]>([]);
  readonly aplicado = output<FiltroAnalise>();

  protected readonly presets = PRESETS;
  protected readonly comparacoes = COMPARACOES;
  private readonly dialogo = viewChild.required<ElementRef<HTMLDialogElement>>('dialogo');
  protected readonly aberto = signal(false);
  protected readonly rascunho = signal<FiltroAnalise>({
    preset: '30dias',
    inicio: '',
    fim: '',
    comparar: 'PERIODO_ANTERIOR',
    ...LIMPO,
  });
  protected readonly buscaEscola = signal('');

  protected readonly escolasVisiveis = computed(() => {
    const termo = this.buscaEscola().trim().toLocaleLowerCase('pt-BR');
    const todas = this.opcoes()?.escolas ?? [];
    return termo ? todas.filter((e) => e.nome.toLocaleLowerCase('pt-BR').includes(termo)) : todas;
  });

  protected readonly turmas = computed(() => {
    const r = this.rascunho();
    if (r.escolas.length !== 1) {
      return [];
    }
    return (this.opcoes()?.turmas ?? []).filter(
      (t) =>
        t.escolaId === r.escolas[0] && (r.anoEscolar === null || t.anoEscolar === r.anoEscolar),
    );
  });

  protected readonly erroPeriodo = computed(() => {
    const { inicio, fim } = this.rascunho();
    if (!inicio || !fim) return 'Informe as duas datas.';
    if (fim < inicio) return 'A data de fim é anterior à de início.';
    if (diasEntre(inicio, fim) > MAXIMO_DIAS)
      return `O período pode ter no máximo ${MAXIMO_DIAS} dias.`;
    return null;
  });

  abrir(): void {
    this.rascunho.set({ ...this.filtro(), escolas: [...this.filtro().escolas] });
    this.buscaEscola.set('');
    this.aberto.set(true);
    const d = this.dialogo().nativeElement;
    if (!d.open) {
      d.showModal();
    }
  }

  fechar(): void {
    this.dialogo().nativeElement.close();
  }

  protected rotuloEtapa(etapa: string): string {
    return etapa.charAt(0) + etapa.slice(1).toLocaleLowerCase('pt-BR');
  }

  protected mudar(parcial: Partial<FiltroAnalise>): void {
    this.rascunho.update((r) => ({ ...r, ...parcial }));
  }

  protected escolherPreset(preset: Exclude<PresetAnalise, 'personalizado'>): void {
    this.mudar({ preset, ...periodoDoPreset(preset, new Date(), this.rascunho().anoLetivo) });
  }

  protected mudarData(campo: 'inicio' | 'fim', valor: string): void {
    this.mudar({ preset: 'personalizado', [campo]: valor });
  }

  protected mudarNumero(campo: 'turmaId' | 'veiculoId', valor: string): void {
    this.mudar({ [campo]: valor ? Number(valor) : null });
  }

  protected alternarEscola(id: number): void {
    const atuais = this.rascunho().escolas;
    const escolas = atuais.includes(id) ? atuais.filter((e) => e !== id) : [...atuais, id];
    // A turma pertence a uma escola só: mudar as escolas limpa a turma.
    this.mudar({ escolas, turmaId: null });
  }

  protected limpar(): void {
    this.rascunho.update((r) => ({ ...r, ...LIMPO, comparar: 'PERIODO_ANTERIOR' as Comparacao }));
  }

  protected aplicar(evento: Event): void {
    evento.preventDefault();
    if (this.erroPeriodo()) {
      return;
    }
    this.aplicado.emit(this.rascunho());
    this.fechar();
  }

  protected fecharSeFora(evento: MouseEvent): void {
    if (evento.target === this.dialogo().nativeElement) {
      this.fechar();
    }
  }
}
