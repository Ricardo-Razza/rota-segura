import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { NgxEchartsDirective } from 'ngx-echarts';
import { TemaService } from '../../core/tema/tema.service';
import { lerTokens, temaEcharts } from './tema-echarts';

/** Gráfico ECharts já com o tema do painel. Recria o tema quando o usuário alterna claro/escuro. */
@Component({
  selector: 'rs-grafico',
  imports: [NgxEchartsDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      echarts
      class="grafico"
      role="img"
      [attr.aria-label]="descricao()"
      [options]="opcoes()"
      [theme]="tema()"
      [style.height.px]="altura()"
    ></div>
  `,
  styles: `
    :host {
      display: block;
    }
    .grafico {
      width: 100%;
    }
  `,
})
export class Grafico {
  private readonly temaAtual = inject(TemaService).tema;

  readonly opcoes = input.required<Record<string, unknown>>();
  /** Texto alternativo que descreve o gráfico para leitores de tela. */
  readonly descricao = input.required<string>();
  readonly altura = input(260);

  protected readonly tema = computed(() => {
    this.temaAtual(); // dependência: reler os tokens quando o tema muda
    return temaEcharts(lerTokens());
  });
}
