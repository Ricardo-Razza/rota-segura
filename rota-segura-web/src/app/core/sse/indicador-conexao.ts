import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { SseService } from './sse.service';

/** Selo de tempo real: mostra o estado verdadeiro da conexão, nunca um "ao vivo" fixo. */
@Component({
  selector: 'rs-indicador-conexao',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="selo" [class]="'selo selo--' + situacao().tom" role="status" aria-live="polite">
      <span class="ponto" aria-hidden="true"></span>
      {{ situacao().texto }}
    </span>
  `,
  styles: `
    .selo {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
    }
    .ponto {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: currentColor;
    }
    .selo--ok {
      color: var(--sucesso);
      background: var(--sucesso-fundo);
    }
    .selo--atencao {
      color: var(--atencao);
      background: var(--atencao-fundo);
    }
    .selo--neutro {
      color: var(--texto-suave);
      background: var(--neutro-fundo);
    }
  `,
})
export class IndicadorConexao {
  private readonly sse = inject(SseService);

  protected readonly situacao = computed(() => {
    const atraso = this.sse.atrasadoHaMin();
    if (atraso !== null) {
      return { tom: 'atencao', texto: `Atrasado há ${atraso} min` };
    }
    switch (this.sse.estado()) {
      case 'online':
        return { tom: 'ok', texto: 'Ao vivo' };
      case 'reconectando':
        return { tom: 'atencao', texto: 'Reconectando…' };
      default:
        return { tom: 'neutro', texto: 'Desconectado' };
    }
  });
}
