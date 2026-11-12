import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Tom } from './tom';

/** Etiqueta de estado. A cor nunca é a única pista: o texto sempre acompanha. */
@Component({
  selector: 'rs-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span [class]="'badge badge--' + tom()"><span class="ponto" aria-hidden="true"></span>{{ texto() }}</span>`,
  styles: `
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 2px 9px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
    }
    .ponto {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: currentColor;
    }
    .badge--sucesso {
      color: var(--sucesso);
      background: var(--sucesso-fundo);
    }
    .badge--atencao {
      color: var(--atencao-texto);
      background: var(--atencao-fundo);
    }
    .badge--critico {
      color: var(--critico);
      background: var(--critico-fundo);
    }
    .badge--info {
      color: var(--info);
      background: var(--info-fundo);
    }
    .badge--neutro {
      color: var(--texto-suave);
      background: var(--neutro-fundo);
    }
  `,
})
export class StatusBadge {
  readonly texto = input.required<string>();
  readonly tom = input<Tom>('neutro');
}
