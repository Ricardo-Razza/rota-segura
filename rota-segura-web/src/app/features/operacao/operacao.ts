import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { auditTime, interval, merge } from 'rxjs';
import { carga } from '../../core/api/carga';
import { Alerta, SaudeLeitor, StatusVeiculo } from '../../core/api/modelos';
import { PainelApi } from '../../core/api/painel-api.service';
import { IndicadorConexao } from '../../core/sse/indicador-conexao';
import { SseService } from '../../core/sse/sse.service';
import { rotuloVeiculo } from '../../shared/formato';

export const ROTACAO_MS = 20_000;

export interface PainelEscola {
  escolaId: number | null;
  titulo: string;
  emRota: StatusVeiculo[];
  embarcados: number;
  esperados: number;
  criticos: Alerta[];
  offline: SaudeLeitor[];
}

/** Monta um painel por escola (e um geral), na ordem de rotação. */
export function paineisPorEscola(
  veiculos: StatusVeiculo[],
  alertas: Alerta[],
  leitores: SaudeLeitor[],
): PainelEscola[] {
  const escolas = new Set<number>();
  veiculos.forEach((v) => v.escolaId !== null && escolas.add(v.escolaId));
  leitores.forEach((l) => l.escolaId !== null && escolas.add(l.escolaId));
  const montar = (escolaId: number | null, titulo: string): PainelEscola => {
    const daEscola = <T extends { escolaId: number | null }>(lista: T[]) =>
      escolaId === null ? lista : lista.filter((x) => x.escolaId === escolaId);
    const vs = daEscola(veiculos);
    return {
      escolaId,
      titulo,
      emRota: vs.filter((v) => v.estado === 'EM_ROTA'),
      embarcados: vs.reduce((s, v) => s + v.embarcados, 0),
      esperados: vs.reduce((s, v) => s + v.esperados, 0),
      criticos: daEscola(alertas).filter((a) => a.severidade === 'CRITICO'),
      offline: daEscola(leitores).filter((l) => l.situacao === 'OFFLINE'),
    };
  };
  return [
    montar(null, 'Visão geral'),
    ...[...escolas].sort((a, b) => a - b).map((id) => montar(id, `Escola #${id}`)),
  ];
}

/** Modo operação (TV): tela cheia, letras grandes, tempo real e rotação entre escolas a cada 20 s. */
@Component({
  selector: 'rs-operacao',
  imports: [IndicadorConexao, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tv">
      <header>
        <span class="rs-marca"
          ><img src="logo.svg" alt="" width="40" height="32" /><span class="rs-marca__rota"
            >Rota </span
          ><span class="rs-marca__segura">Segura</span></span
        >
        <h1>{{ atual()?.titulo ?? 'Carregando…' }}</h1>
        <span class="rs-nota">{{ indice() + 1 }} / {{ paineis().length || 1 }}</span>
        <rs-indicador-conexao />
        <button type="button" class="rs-botao" (click)="telaCheia()">Tela cheia</button>
        <a class="rs-botao" routerLink="/dashboard">Sair</a>
      </header>

      @if (falhou()) {
        <p class="rs-aviso">
          Não foi possível atualizar os dados. Nova tentativa automática em instantes.
        </p>
      }

      @if (atual(); as p) {
        <div class="numeros">
          <div class="numero">
            <span>Veículos em rota</span><strong>{{ p.emRota.length }}</strong>
          </div>
          <div class="numero">
            <span>Embarcados × esperados</span
            ><strong
              >{{ p.embarcados }} <small>/ {{ p.esperados }}</small></strong
            >
          </div>
          <div class="numero" [class.numero--critico]="p.criticos.length > 0">
            <span>Críticos abertos</span><strong>{{ p.criticos.length }}</strong>
          </div>
          <div class="numero" [class.numero--atencao]="p.offline.length > 0">
            <span>Leitores offline</span><strong>{{ p.offline.length }}</strong>
          </div>
        </div>
        <div class="listas">
          <section>
            <h2>Em rota</h2>
            <ul>
              @for (v of p.emRota; track v.id) {
                <li>
                  <span class="rs-mono">{{ rotulo(v) }}</span> {{ v.aBordo }} a bordo
                </li>
              } @empty {
                <li class="vazio">Nenhum veículo em rota.</li>
              }
            </ul>
          </section>
          <section>
            <h2>Críticos</h2>
            <ul>
              @for (a of p.criticos.slice(0, 6); track a.id) {
                <li class="critico">{{ a.mensagem }}</li>
              } @empty {
                <li class="vazio">Nenhum alerta crítico aberto.</li>
              }
            </ul>
          </section>
          <section>
            <h2>Leitores offline</h2>
            <ul>
              @for (l of p.offline.slice(0, 6); track l.id) {
                <li>{{ l.descricao || 'Leitor #' + l.id }}</li>
              } @empty {
                <li class="vazio">Todos os leitores respondendo.</li>
              }
            </ul>
          </section>
        </div>
      }
    </div>
  `,
  styles: `
    .tv {
      min-height: 100vh;
      padding: 24px 32px;
      background: var(--fundo);
      font-size: 22px;
    }
    header {
      display: flex;
      align-items: center;
      gap: 20px;
      margin-bottom: 24px;
    }
    h1 {
      flex: 1;
      font-size: 36px;
    }
    .numeros {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 20px;
    }
    .numero {
      display: flex;
      flex-direction: column;
      padding: 20px;
      border: 1px solid var(--borda);
      border-left: 8px solid var(--info);
      border-radius: var(--raio);
      background: var(--superficie);
    }
    .numero span {
      color: var(--texto-suave);
    }
    .numero strong {
      font-size: 64px;
      line-height: 1.1;
    }
    .numero--critico {
      border-left-color: var(--critico);
    }
    .numero--atencao {
      border-left-color: var(--atencao);
    }
    small {
      font-size: 32px;
      color: var(--texto-suave);
    }
    .listas {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 20px;
      margin-top: 24px;
    }
    h2 {
      font-size: 24px;
      margin-bottom: 8px;
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    li {
      padding: 8px 0;
      border-bottom: 1px solid var(--borda);
    }
    .critico {
      color: var(--critico);
    }
    .vazio {
      color: var(--texto-suave);
    }
  `,
})
export class Operacao implements OnDestroy {
  private readonly api = inject(PainelApi);
  private readonly sse = inject(SseService);

  protected readonly rotulo = rotuloVeiculo;
  protected readonly indice = signal(0);

  protected readonly veiculos = carga(() => this.api.veiculos({}));
  protected readonly alertas = carga(() =>
    this.api.alertas({ status: 'ABERTO', severidade: 'CRITICO', tamanho: 200 }),
  );
  protected readonly leitores = carga(() => this.api.leitores({}));

  protected readonly paineis = computed(() =>
    paineisPorEscola(
      this.veiculos.dados()?.veiculos ?? [],
      this.alertas.dados()?.alertas.itens ?? [],
      this.leitores.dados()?.leitores ?? [],
    ),
  );
  protected readonly atual = computed(() => {
    const lista = this.paineis();
    return lista.length ? lista[this.indice() % lista.length] : null;
  });
  protected readonly falhou = computed(() =>
    [this.veiculos, this.alertas, this.leitores].some(
      (c) => c.estado() === 'erro' || c.estado() === 'desatualizado',
    ),
  );

  constructor() {
    this.sse.conectar();
    interval(ROTACAO_MS)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.indice.update((i) => (i + 1) % Math.max(1, this.paineis().length)));
    merge(
      this.sse.de('veiculo.atualizado'),
      this.sse.de('alerta.criado'),
      this.sse.de('alerta.atualizado'),
    )
      .pipe(auditTime(3000), takeUntilDestroyed())
      .subscribe(() => {
        this.veiculos.recarregar(true);
        this.alertas.recarregar(true);
      });
    // Sem SSE de leitores: atualiza a cada minuto, e tudo a cada minuto como rede de segurança.
    interval(60_000)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.leitores.recarregar(true);
        this.veiculos.recarregar(true);
        this.alertas.recarregar(true);
      });
  }

  ngOnDestroy(): void {
    this.sse.desconectar();
  }

  protected telaCheia(): void {
    void document.documentElement.requestFullscreen?.().catch(() => undefined);
  }
}
