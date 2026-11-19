import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { carga } from '../../core/api/carga';
import { Cobertura } from '../../core/api/modelos';
import { PainelApi, Parametros } from '../../core/api/painel-api.service';
import { percentual } from '../../shared/formato';
import { Grafico } from '../../shared/graficos/grafico';
import { Anel } from '../../shared/ui/anel';
import { ChartCard } from '../../shared/ui/chart-card';
import { Tom } from '../../shared/ui/tom';
import { barrasComparativo, barrasMatriculas, variacao } from './analises.graficos';
import { IndicadorAnalise } from './indicador';

/** Cobertura do cadastro: 95% ou mais é bom, abaixo de 80% pede ação. */
export function tomCobertura(c: Cobertura): Tom {
  if (!c.disponivel || c.percentual === null) return 'neutro';
  return c.percentual >= 95 ? 'sucesso' : c.percentual >= 80 ? 'atencao' : 'critico';
}

@Component({
  selector: 'rs-aba-matriculas',
  imports: [Anel, ChartCard, Grafico, IndicadorAnalise],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let m = dados.dados();
    <div class="indicadores">
      <rs-indicador
        [valor]="m ? num(m.total.atual) : '—'"
        [variacao]="m?.total?.variacao ?? null"
        unidade="%"
        [legenda]="
          'matrículas em ' +
          (m?.anoLetivo ?? '') +
          ' · ' +
          num(m?.total?.anterior) +
          ' no ano anterior'
        "
      />
      <rs-indicador
        [valor]="m ? num(m.turmas.atual) : '—'"
        [variacao]="m?.turmas?.variacao ?? null"
        unidade="%"
        legenda="turmas com alunos"
      />
      @for (c of coberturaPrincipal(); track c.chave) {
        <rs-indicador
          [valor]="c.disponivel ? pct(c.percentual) : '—'"
          [tom]="tomCobertura(c)"
          [legenda]="c.rotulo.toLowerCase()"
        />
      }
    </div>

    <div class="grade grade--principal">
      <rs-chart-card
        [titulo]="
          m?.agrupamento === 'ETAPA'
            ? 'Matrículas por etapa, ano a ano'
            : 'Matrículas por ano escolar, ano a ano'
        "
        [estado]="dados.estado()"
        [atualizadoEm]="dados.atualizadoEm()"
        (tentarDeNovo)="dados.recarregar()"
      >
        @if (m) {
          <rs-grafico
            [opcoes]="porAno()"
            [altura]="300"
            descricao="Matrículas dos últimos anos letivos, empilhadas por etapa"
          />
        }
      </rs-chart-card>

      <rs-chart-card
        titulo="Cadastro completo"
        [estado]="dados.estado()"
        (tentarDeNovo)="dados.recarregar()"
      >
        @if (m) {
          <div class="aneis">
            @for (c of m.cobertura; track c.chave) {
              <div class="anel">
                <rs-anel
                  [valor]="c.disponivel ? c.percentual : null"
                  [tom]="tomCobertura(c)"
                  [tamanho]="92"
                  [rotulo]="c.rotulo"
                />
                <div>
                  <strong>{{ c.rotulo }}</strong>
                  <span class="mudo">
                    @if (c.disponivel) {
                      {{ num(c.com) }} de {{ num(c.total) }}
                    } @else {
                      ainda sem dados completos
                    }
                  </span>
                </div>
              </div>
            }
          </div>
        }
      </rs-chart-card>
    </div>

    <div class="grade grade--dupla">
      <rs-chart-card
        titulo="Por ano escolar"
        [estado]="dados.estado()"
        (tentarDeNovo)="dados.recarregar()"
      >
        @if (m) {
          <rs-grafico
            [opcoes]="porAnoEscolar()"
            [altura]="260"
            descricao="Matrículas por ano escolar, ano atual comparado ao anterior"
          />
        }
      </rs-chart-card>
      <rs-chart-card
        titulo="Por turno"
        [estado]="dados.estado()"
        (tentarDeNovo)="dados.recarregar()"
      >
        @if (m) {
          <rs-grafico
            [opcoes]="porTurno()"
            [altura]="260"
            descricao="Matrículas por turno, ano atual comparado ao anterior"
          />
        }
      </rs-chart-card>
    </div>

    <rs-chart-card
      titulo="Escolas que mais cresceram"
      [estado]="dados.estado()"
      (tentarDeNovo)="dados.recarregar()"
    >
      @if (m) {
        <div class="tabela-rolagem">
          <table class="tabela">
            <thead>
              <tr>
                <th scope="col">Escola</th>
                <th scope="col" class="num">{{ m.anoLetivo - 1 }}</th>
                <th scope="col" class="num">{{ m.anoLetivo }}</th>
                <th scope="col" class="num">Variação</th>
              </tr>
            </thead>
            <tbody>
              @for (e of escolas(); track e.chave) {
                <tr>
                  <th scope="row">{{ e.rotulo }}</th>
                  <td class="num mudo">{{ num(e.anterior) }}</td>
                  <td class="num">{{ num(e.atual) }}</td>
                  <td class="num">
                    @if (delta(e.variacao); as v) {
                      <span [class]="'tom-' + v.tom">{{ v.texto }}</span>
                    } @else {
                      <span class="mudo">{{ e.anterior === 0 && e.atual > 0 ? 'nova' : '—' }}</span>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </rs-chart-card>
  `,
  styleUrl: './abas.css',
  styles: `
    .aneis {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .anel {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .anel div {
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-size: 14px;
    }
  `,
})
export class AbaMatriculas {
  private readonly api = inject(PainelApi);
  readonly parametros = input.required<Parametros>();

  protected readonly dados = carga(() => this.api.analiseMatriculas(this.parametros()), {
    vazio: (m) => m.porAno.length === 0 && (m.total.atual ?? 0) === 0,
  });

  protected readonly pct = percentual;
  protected readonly tomCobertura = tomCobertura;
  protected readonly delta = (v: number | null) => variacao(v, '%');

  protected num(v: number | null | undefined): string {
    return v === null || v === undefined ? '—' : v.toLocaleString('pt-BR');
  }

  protected readonly coberturaPrincipal = computed(() =>
    (this.dados.dados()?.cobertura ?? []).filter((c) => c.chave !== 'RESPONSAVEL'),
  );
  protected readonly porAno = computed(() => barrasMatriculas(this.dados.dados()!));
  protected readonly porAnoEscolar = computed(() =>
    barrasComparativo(this.dados.dados()!.porAnoEscolar, this.dados.dados()!.anoLetivo),
  );
  protected readonly porTurno = computed(() =>
    barrasComparativo(this.dados.dados()!.porTurno, this.dados.dados()!.anoLetivo, 12),
  );
  /** Maior crescimento primeiro; escola nova (sem matrícula no ano anterior) aparece no topo. */
  protected readonly escolas = computed(() =>
    [...(this.dados.dados()?.porEscola ?? [])].sort(
      (a, b) =>
        (b.variacao ?? (b.anterior === 0 ? 1e6 : -1e6)) -
        (a.variacao ?? (a.anterior === 0 ? 1e6 : -1e6)),
    ),
  );
}
