import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Tom } from './tom';

const RAIO = 46;
const CIRCUNFERENCIA = 2 * Math.PI * RAIO;

const COR: Record<Tom, string> = {
  sucesso: 'var(--sucesso)',
  atencao: 'var(--atencao)',
  critico: 'var(--critico)',
  info: 'var(--info)',
  neutro: 'var(--texto-mudo)',
};

/** Anel de percentual (SVG puro, sem biblioteca de gráfico). O texto central é o valor. */
@Component({
  selector: 'rs-anel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      viewBox="0 0 120 120"
      [attr.width]="tamanho()"
      [attr.height]="tamanho()"
      role="img"
      [attr.aria-label]="rotulo() + ': ' + texto()"
    >
      <circle cx="60" cy="60" [attr.r]="raio" class="trilho" />
      <circle
        cx="60"
        cy="60"
        [attr.r]="raio"
        class="valor"
        [attr.stroke]="cor()"
        [attr.stroke-dasharray]="traco()"
        transform="rotate(-90 60 60)"
      />
      <text x="60" y="68" text-anchor="middle">{{ texto() }}</text>
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      flex: none;
    }
    circle {
      fill: none;
      stroke-width: 12;
    }
    .trilho {
      stroke: var(--vidro-borda);
    }
    .valor {
      stroke-linecap: round;
      transition: stroke-dasharray 0.6s ease;
    }
    text {
      fill: var(--texto);
      font-family: var(--fonte-mono);
      font-size: 24px;
      font-weight: 700;
    }
  `,
})
export class Anel {
  /** 0 a 100; nulo mostra "—". */
  readonly valor = input<number | null>(null);
  readonly tom = input<Tom>('sucesso');
  readonly tamanho = input(120);
  readonly rotulo = input('Percentual');

  protected readonly raio = RAIO;
  protected readonly cor = computed(() => COR[this.tom()]);
  protected readonly texto = computed(() => {
    const v = this.valor();
    return v === null ? '—' : `${Math.round(v)}%`;
  });
  protected readonly traco = computed(() => {
    const v = Math.max(0, Math.min(100, this.valor() ?? 0));
    return `${(v / 100) * CIRCUNFERENCIA} ${CIRCUNFERENCIA}`;
  });
}
