import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';

export type EstadoCard = 'carregando' | 'vazio' | 'erro' | 'ok' | 'desatualizado';

/**
 * Moldura de todo card de dados. Trata os quatro estados obrigatórios — carregando, vazio,
 * erro (com "tentar de novo") e desatualizado — e nunca fica preso no esqueleto: se o
 * carregamento passar do tempo limite, vira erro com opção de repetir.
 */
@Component({
  selector: 'rs-chart-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="card"
      [attr.aria-busy]="efetivo() === 'carregando'"
      [attr.aria-labelledby]="idTitulo"
    >
      <header>
        <h2 [id]="idTitulo">{{ titulo() }}</h2>
        @if (efetivo() === 'desatualizado') {
          <span class="aviso" role="status">
            Dados desatualizados
            @if (atualizadoEm(); as quando) {
              <span> · última atualização {{ hora(quando) }}</span>
            }
          </span>
        }
        <ng-content select="[acoes]" />
      </header>

      @switch (efetivo()) {
        @case ('carregando') {
          <div class="estado" role="status">
            <div class="esqueleto" aria-hidden="true"></div>
            <span class="rs-somente-leitor">Carregando {{ titulo() }}</span>
          </div>
        }
        @case ('vazio') {
          <div class="estado" role="status">
            <p>{{ mensagemVazio() }}</p>
          </div>
        }
        @case ('erro') {
          <div class="estado" role="alert">
            <p>{{ estourou() ? 'O carregamento demorou demais.' : mensagemErro() }}</p>
            <button type="button" class="rs-botao" (click)="repetir()">Tentar de novo</button>
          </div>
        }
        @default {
          <div class="conteudo"><ng-content /></div>
        }
      }
    </section>
  `,
  styles: `
    :host {
      display: block;
    }
    .card {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 220px;
      border: 1px solid var(--borda);
      border-radius: var(--raio);
      background: var(--superficie);
      box-shadow: var(--sombra);
    }
    header {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      padding: 12px 16px;
      border-bottom: 1px solid var(--borda);
    }
    h2 {
      flex: 1;
      font-size: 14px;
    }
    .aviso {
      padding: 2px 8px;
      border-radius: 999px;
      color: var(--atencao-texto);
      background: var(--atencao-fundo);
      font-size: 12px;
      font-weight: 600;
    }
    .conteudo {
      flex: 1;
      padding: 12px 16px;
      min-height: 0;
    }
    .estado {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 24px 16px;
      color: var(--texto-suave);
      text-align: center;
    }
    .estado p {
      margin: 0;
    }
    .esqueleto {
      width: 100%;
      height: 140px;
      border-radius: 8px;
      background: linear-gradient(
        90deg,
        var(--superficie-2) 25%,
        var(--borda) 50%,
        var(--superficie-2) 75%
      );
      background-size: 200% 100%;
      animation: brilho 1.4s linear infinite;
    }
    @keyframes brilho {
      to {
        background-position: -200% 0;
      }
    }
  `,
})
export class ChartCard {
  private static proximoId = 0;

  readonly titulo = input.required<string>();
  readonly estado = input<EstadoCard>('carregando');
  readonly atualizadoEm = input<Date | null>(null);
  readonly mensagemVazio = input('Sem dados para os filtros selecionados.');
  readonly mensagemErro = input('Não foi possível carregar os dados.');
  /** Tempo máximo no estado "carregando" antes de virar erro. */
  readonly tempoLimiteMs = input(15_000);
  readonly tentarDeNovo = output<void>();

  protected readonly idTitulo = `rs-card-${ChartCard.proximoId++}`;
  protected readonly estourou = signal(false);
  protected readonly efetivo = computed<EstadoCard>(() =>
    this.estado() === 'carregando' && this.estourou() ? 'erro' : this.estado(),
  );

  constructor() {
    effect((aoLimpar) => {
      if (this.estado() !== 'carregando') {
        this.estourou.set(false);
        return;
      }
      const temporizador = setTimeout(() => this.estourou.set(true), this.tempoLimiteMs());
      aoLimpar(() => clearTimeout(temporizador));
    });
  }

  protected repetir(): void {
    this.estourou.set(false);
    this.tentarDeNovo.emit();
  }

  protected hora(quando: Date): string {
    return quando.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
}
