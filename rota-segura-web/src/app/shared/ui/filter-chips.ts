import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

export interface OpcaoChip {
  valor: string;
  rotulo: string;
  contador?: number;
}

/** Chips de filtro com contador. Seleção única por padrão; `multiplo` permite várias. */
@Component({
  selector: 'rs-filter-chips',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chips" role="group" [attr.aria-label]="rotulo()">
      @for (opcao of opcoes(); track opcao.valor) {
        <button
          type="button"
          class="chip"
          [class.chip--ativo]="ativo(opcao.valor)"
          [attr.aria-pressed]="ativo(opcao.valor)"
          (click)="alternar(opcao.valor)"
        >
          {{ opcao.rotulo }}
          @if (opcao.contador !== undefined) {
            <span class="contador">{{ opcao.contador }}</span>
          }
        </button>
      }
    </div>
  `,
  styles: `
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px;
      border: 1px solid var(--borda);
      border-radius: 999px;
      background: var(--superficie);
      cursor: pointer;
    }
    .chip:hover {
      border-color: var(--texto-suave);
    }
    .chip--ativo {
      border-color: var(--info);
      background: var(--info-fundo);
      font-weight: 600;
    }
    .contador {
      min-width: 20px;
      padding: 0 6px;
      border-radius: 999px;
      background: var(--neutro-fundo);
      font-size: 12px;
      text-align: center;
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class FilterChips {
  readonly opcoes = input.required<OpcaoChip[]>();
  readonly rotulo = input.required<string>();
  readonly multiplo = input(false);
  /** Valores selecionados (two-way: `[(selecionados)]`). */
  readonly selecionados = model<string[]>([]);

  protected ativo(valor: string): boolean {
    return this.selecionados().includes(valor);
  }

  protected alternar(valor: string): void {
    const atuais = this.selecionados();
    if (this.multiplo()) {
      this.selecionados.set(atuais.includes(valor) ? atuais.filter((v) => v !== valor) : [...atuais, valor]);
    } else {
      this.selecionados.set(atuais.includes(valor) ? [] : [valor]);
    }
  }
}
