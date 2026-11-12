import { ChangeDetectionStrategy, Component, model, signal } from '@angular/core';

export type PresetPeriodo = 'hoje' | '7dias' | '30dias' | 'mes' | 'personalizado';

/** Período em datas ISO (aaaa-mm-dd), nas duas pontas inclusive. */
export interface Periodo {
  preset: PresetPeriodo;
  inicio: string;
  fim: string;
}

const PRESETS: { valor: Exclude<PresetPeriodo, 'personalizado'>; rotulo: string }[] = [
  { valor: 'hoje', rotulo: 'Hoje' },
  { valor: '7dias', rotulo: '7 dias' },
  { valor: '30dias', rotulo: '30 dias' },
  { valor: 'mes', rotulo: 'Este mês' },
];

function iso(data: Date): string {
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${data.getFullYear()}-${mes}-${dia}`;
}

/** Datas de um atalho de período, contando o dia de hoje (7 dias = hoje e os 6 anteriores). */
export function periodoDoPreset(
  preset: Exclude<PresetPeriodo, 'personalizado'>,
  hoje = new Date(),
): Periodo {
  const fim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const inicio = new Date(fim);
  if (preset === '7dias') {
    inicio.setDate(fim.getDate() - 6);
  } else if (preset === '30dias') {
    inicio.setDate(fim.getDate() - 29);
  } else if (preset === 'mes') {
    inicio.setDate(1);
  }
  return { preset, inicio: iso(inicio), fim: iso(fim) };
}

/**
 * Seletor de período com atalhos. "7 dias" já vem selecionado, para nenhuma tela
 * (relatórios, presença) ficar bloqueada esperando o usuário escolher datas.
 */
@Component({
  selector: 'rs-date-range-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <fieldset>
      <legend class="rs-somente-leitor">Período</legend>
      <div class="atalhos">
        @for (preset of presets; track preset.valor) {
          <button
            type="button"
            class="atalho"
            [class.atalho--ativo]="periodo().preset === preset.valor"
            [attr.aria-pressed]="periodo().preset === preset.valor"
            (click)="escolher(preset.valor)"
          >
            {{ preset.rotulo }}
          </button>
        }
      </div>
      <label>
        <span class="rs-somente-leitor">Data inicial</span>
        <input
          class="rs-campo"
          type="date"
          [value]="periodo().inicio"
          [max]="periodo().fim"
          (change)="mudarInicio($event)"
        />
      </label>
      <span aria-hidden="true">até</span>
      <label>
        <span class="rs-somente-leitor">Data final</span>
        <input
          class="rs-campo"
          type="date"
          [value]="periodo().fim"
          [min]="periodo().inicio"
          (change)="mudarFim($event)"
        />
      </label>
      @if (erro()) {
        <span class="erro" role="alert">{{ erro() }}</span>
      }
    </fieldset>
  `,
  styles: `
    fieldset {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      margin: 0;
      padding: 0;
      border: 0;
    }
    .atalhos {
      display: inline-flex;
      border: 1px solid var(--borda);
      border-radius: 8px;
      overflow: hidden;
    }
    .atalho {
      padding: 7px 12px;
      border: 0;
      border-right: 1px solid var(--borda);
      background: var(--superficie);
      cursor: pointer;
    }
    .atalho:last-child {
      border-right: 0;
    }
    .atalho--ativo {
      background: var(--info-fundo);
      font-weight: 600;
    }
    .atalho:focus-visible {
      outline-offset: -2px;
    }
    .erro {
      color: var(--critico);
      font-size: 12px;
    }
  `,
})
export class DateRangePicker {
  protected readonly presets = PRESETS;
  /** Período selecionado (two-way: `[(periodo)]`). */
  readonly periodo = model<Periodo>(periodoDoPreset('7dias'));
  protected readonly erro = signal('');

  protected escolher(preset: Exclude<PresetPeriodo, 'personalizado'>): void {
    this.erro.set('');
    this.periodo.set(periodoDoPreset(preset));
  }

  protected mudarInicio(evento: Event): void {
    this.personalizar((evento.target as HTMLInputElement).value, this.periodo().fim);
  }

  protected mudarFim(evento: Event): void {
    this.personalizar(this.periodo().inicio, (evento.target as HTMLInputElement).value);
  }

  private personalizar(inicio: string, fim: string): void {
    if (!inicio || !fim) {
      this.erro.set('Informe as duas datas.');
      return;
    }
    if (inicio > fim) {
      this.erro.set('A data inicial não pode ser depois da final.');
      return;
    }
    this.erro.set('');
    this.periodo.set({ preset: 'personalizado', inicio, fim });
  }
}
