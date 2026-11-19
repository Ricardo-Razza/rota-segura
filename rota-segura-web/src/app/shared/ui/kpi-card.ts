import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Tom } from './tom';

/** Indicador do topo das telas. Com `link`, o card inteiro vira um atalho navegável por teclado. */
@Component({
  selector: 'rs-kpi-card',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (link(); as destino) {
      <a
        [class]="'kpi kpi--link kpi--' + tom()"
        [routerLink]="destino"
        queryParamsHandling="preserve"
      >
        <span class="rotulo">{{ rotulo() }}</span>
        <span class="valor" [attr.aria-busy]="carregando()">{{ exibido() }}</span>
        @if (detalhe()) {
          <span class="detalhe">{{ detalhe() }}</span>
        }
      </a>
    } @else {
      <div [class]="'kpi kpi--' + tom()">
        <span class="rotulo">{{ rotulo() }}</span>
        <span class="valor" [attr.aria-busy]="carregando()">{{ exibido() }}</span>
        @if (detalhe()) {
          <span class="detalhe">{{ detalhe() }}</span>
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .kpi {
      display: flex;
      flex-direction: column;
      gap: 4px;
      height: 100%;
      padding: 16px 20px;
      border: 1px solid var(--vidro-borda);
      border-left: 4px solid var(--vidro-borda);
      border-radius: var(--raio-vidro);
      background: var(--vidro);
      color: var(--texto);
      text-decoration: none;
      box-shadow: var(--vidro-sombra);
    }
    .kpi--link:hover {
      background: var(--superficie-2);
    }
    .kpi--sucesso {
      border-left-color: var(--sucesso);
    }
    .kpi--atencao {
      border-left-color: var(--atencao);
    }
    .kpi--critico {
      border-left-color: var(--critico);
    }
    .kpi--info {
      border-left-color: var(--info);
    }
    .rotulo {
      color: var(--texto-suave);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .valor {
      font-size: 28px;
      font-weight: 700;
      line-height: 1.1;
      font-variant-numeric: tabular-nums;
    }
    .detalhe {
      color: var(--texto-suave);
      font-size: 12px;
    }
  `,
})
export class KpiCard {
  readonly rotulo = input.required<string>();
  /** null = sem dado (mostra travessão, nunca zero inventado). */
  readonly valor = input<string | number | null>(null);
  readonly detalhe = input<string>('');
  readonly tom = input<Tom>('neutro');
  readonly link = input<string | null>(null);
  readonly carregando = input(false);

  protected readonly exibido = computed(() => {
    if (this.carregando()) {
      return '…';
    }
    const valor = this.valor();
    if (valor === null || valor === '') {
      return '—';
    }
    return typeof valor === 'number' ? valor.toLocaleString('pt-BR') : valor;
  });
}
