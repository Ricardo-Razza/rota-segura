import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Icone } from '../../shared/ui/icone';
import { Tom } from '../../shared/ui/tom';
import { Unidade, variacao } from './analises.graficos';

/** Número grande com a variação contra o período de comparação e uma legenda curta. */
@Component({
  selector: 'rs-indicador',
  imports: [Icone],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ind rs-vidro">
      <p class="valor" [class]="'valor tom-' + tom()">
        {{ valor() }}
        @if (complemento()) {
          <small>{{ complemento() }}</small>
        }
      </p>
      @if (delta(); as v) {
        <span class="var" [class]="'var tom-' + v.tom">
          <rs-icone [nome]="v.sobe ? 'sobe' : 'seta'" [tamanho]="12" />
          {{ v.texto }}
        </span>
      }
      <p class="legenda">{{ legenda() }}</p>
    </div>
  `,
  styles: `
    .ind {
      display: grid;
      grid-template-columns: auto 1fr;
      align-items: center;
      gap: 4px 10px;
      height: 100%;
      padding: 16px 20px;
      border-radius: var(--raio-vidro);
    }
    .valor {
      margin: 0;
      font-family: var(--fonte-mono);
      font-size: clamp(24px, 3vw, 32px);
      font-weight: 700;
      letter-spacing: -0.02em;
      line-height: 1.1;
    }
    .valor small {
      color: var(--texto-mudo);
      font-size: 0.55em;
    }
    .var {
      display: inline-flex;
      align-items: center;
      justify-self: start;
      gap: 3px;
      padding: 2px 8px;
      border-radius: 999px;
      background: var(--neutro-fundo);
      font-size: 12px;
      font-weight: 700;
    }
    .legenda {
      grid-column: 1 / -1;
      margin: 0;
      color: var(--texto-suave);
      font-size: 13px;
    }
    .tom-sucesso {
      color: var(--sucesso);
    }
    .tom-atencao {
      color: var(--atencao-texto, var(--atencao));
    }
    .tom-critico {
      color: var(--critico);
    }
    .tom-info {
      color: var(--info);
    }
    .tom-neutro {
      color: var(--texto);
    }
    .var.tom-neutro {
      color: var(--texto-suave);
    }
  `,
})
export class IndicadorAnalise {
  readonly valor = input.required<string>();
  readonly complemento = input<string>('');
  readonly legenda = input.required<string>();
  readonly tom = input<Tom>('neutro');
  readonly variacao = input<number | null>(null);
  readonly unidade = input<Unidade>('pp');
  readonly maiorEhMelhor = input(true);

  protected readonly delta = computed(() =>
    variacao(this.variacao(), this.unidade(), this.maiorEhMelhor()),
  );
}
