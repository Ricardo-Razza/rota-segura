import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from './toast.service';

/** Pilha de avisos no canto da tela. Críticos usam role="alert"; os demais, role="status". */
@Component({
  selector: 'rs-toasts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pilha">
      @for (toast of servico.toasts(); track toast.id) {
        <div class="toast" [class]="'toast toast--' + toast.tom" [attr.role]="toast.tom === 'critico' ? 'alert' : 'status'">
          <span>{{ toast.mensagem }}</span>
          <button type="button" class="fechar" (click)="servico.fechar(toast.id)" aria-label="Fechar aviso">×</button>
        </div>
      }
    </div>
  `,
  styles: `
    .pilha {
      position: fixed;
      right: 16px;
      bottom: 16px;
      z-index: 1000;
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-width: min(420px, calc(100vw - 32px));
    }
    .toast {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 10px 12px;
      border: 1px solid var(--borda);
      border-left-width: 4px;
      border-radius: var(--raio);
      background: var(--superficie);
      box-shadow: var(--sombra);
    }
    .toast span {
      flex: 1;
    }
    .toast--info {
      border-left-color: var(--info);
    }
    .toast--sucesso {
      border-left-color: var(--sucesso);
    }
    .toast--atencao {
      border-left-color: var(--atencao);
    }
    .toast--critico {
      border-left-color: var(--critico);
    }
    .fechar {
      border: 0;
      background: none;
      cursor: pointer;
      font-size: 18px;
      line-height: 1;
      color: var(--texto-suave);
    }
  `,
})
export class Toasts {
  protected readonly servico = inject(ToastService);
}
