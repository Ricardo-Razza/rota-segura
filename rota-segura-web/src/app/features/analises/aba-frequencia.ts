import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { carga } from '../../core/api/carga';
import { PainelApi, Parametros } from '../../core/api/painel-api.service';
import { percentual } from '../../shared/formato';
import { Grafico } from '../../shared/graficos/grafico';
import { ChartCard } from '../../shared/ui/chart-card';
import { Tom } from '../../shared/ui/tom';
import { tomDaFaixa } from '../escolas/escolas.logica';
import {
  barrasFaltasPorDia,
  barrasFrequencia,
  barrasVariacao,
  diaQueMaisFalta,
  linhaEvolucao,
  variacao,
} from './analises.graficos';
import { IndicadorAnalise } from './indicador';

@Component({
  selector: 'rs-aba-frequencia',
  imports: [ChartCard, Grafico, IndicadorAnalise],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let a = dados.dados();
    <div class="indicadores">
      <rs-indicador
        [valor]="pct(a?.frequencia?.atual)"
        [tom]="tomFrequencia()"
        [variacao]="a?.frequencia?.variacao ?? null"
        unidade="pp"
        [legenda]="
          a?.frequencia?.anterior != null
            ? 'frequência média · antes ' + pct(a?.frequencia?.anterior)
            : 'frequência média no período'
        "
      />
      <rs-indicador
        [valor]="a ? '' + escolasOk().acima : '—'"
        [complemento]="a ? '/' + escolasOk().total : ''"
        legenda="escolas acima de 85%"
      />
      <rs-indicador
        [valor]="a ? '' + (a.abaixoDoLimite.atual ?? 0) : '—'"
        [tom]="(a?.abaixoDoLimite?.atual ?? 0) > 0 ? 'atencao' : 'neutro'"
        [variacao]="a?.abaixoDoLimite?.variacao ?? null"
        unidade="%"
        [maiorEhMelhor]="false"
        [legenda]="'alunos abaixo de ' + (a?.limiteRisco ?? 75) + '% de frequência'"
      />
      <rs-indicador
        [valor]="a ? '' + a.diasLetivos : '—'"
        [legenda]="'dias letivos com leitura · ' + (a?.alunosAvaliados ?? 0) + ' alunos'"
      />
    </div>

    <div class="grade grade--principal">
      <rs-chart-card
        titulo="Evolução da frequência"
        [estado]="dados.estado()"
        [atualizadoEm]="dados.atualizadoEm()"
        (tentarDeNovo)="dados.recarregar()"
      >
        @if (a) {
          <rs-grafico
            [opcoes]="evolucao()"
            [altura]="280"
            descricao="Frequência ao longo do período, comparada com o período de referência"
          />
        }
      </rs-chart-card>

      <rs-chart-card
        titulo="Quem mais mudou"
        [estado]="estadoVariacao()"
        mensagemVazio="Sem comparação: escolha um período para comparar."
        (tentarDeNovo)="dados.recarregar()"
      >
        @if (a) {
          <rs-grafico
            [opcoes]="mudancas()"
            [altura]="280"
            descricao="Escolas com maior variação de frequência, em pontos percentuais"
          />
        }
      </rs-chart-card>
    </div>

    <div class="grade">
      <rs-chart-card
        titulo="Quando os alunos mais faltam"
        [estado]="dados.estado()"
        (tentarDeNovo)="dados.recarregar()"
      >
        @if (a) {
          <rs-grafico
            [opcoes]="faltas()"
            [altura]="220"
            descricao="Percentual de faltas por dia da semana"
          />
          @if (leituraFaltas(); as frase) {
            <p class="leitura">{{ frase }}</p>
          }
        }
      </rs-chart-card>

      <rs-chart-card
        titulo="Por etapa"
        [estado]="dados.estado()"
        (tentarDeNovo)="dados.recarregar()"
      >
        @if (a) {
          @if (!a.etapasConfiguradas) {
            <p class="leitura">
              As etapas ainda não foram configuradas no servidor; a frequência aparece por ano
              escolar e turno.
            </p>
          }
          <div class="etapas">
            @for (e of a.porEtapa; track e.chave) {
              <div class="etapa">
                <span class="etapa__nome">{{ rotulo(e.rotulo) }}</span>
                <strong [class]="'etapa__valor tom-' + tomDaFaixa(e.faixa)">{{
                  pct(e.frequencia)
                }}</strong>
                @if (delta(e.variacao); as v) {
                  <span [class]="'etapa__var tom-' + v.tom">{{ v.texto }}</span>
                }
                <span class="etapa__base">{{ e.presentes }} de {{ e.esperados }} presenças</span>
              </div>
            }
          </div>
        }
      </rs-chart-card>

      <rs-chart-card
        titulo="Por turno"
        [estado]="dados.estado()"
        (tentarDeNovo)="dados.recarregar()"
      >
        @if (a) {
          <rs-grafico
            [opcoes]="turnos()"
            [altura]="alturaLista(a.porTurno.length)"
            descricao="Frequência por turno"
          />
        }
      </rs-chart-card>
    </div>

    <rs-chart-card
      titulo="Escolas no período"
      [estado]="dados.estado()"
      (tentarDeNovo)="dados.recarregar()"
    >
      @if (a) {
        <div class="tabela-rolagem">
          <table class="tabela">
            <thead>
              <tr>
                <th scope="col">Escola</th>
                <th scope="col" class="num">Frequência</th>
                <th scope="col" class="num">Antes</th>
                <th scope="col" class="num">Variação</th>
                <th scope="col" class="num">Presenças</th>
              </tr>
            </thead>
            <tbody>
              @for (e of a.porEscola; track e.chave) {
                <tr>
                  <th scope="row">
                    <span [class]="'ponto tom-' + tomDaFaixa(e.faixa)" aria-hidden="true"></span>
                    {{ e.rotulo }}
                  </th>
                  <td class="num">{{ pct(e.frequencia) }}</td>
                  <td class="num mudo">{{ pct(e.anterior) }}</td>
                  <td class="num">
                    @if (delta(e.variacao); as v) {
                      <span [class]="'tom-' + v.tom">{{ v.texto }}</span>
                    } @else {
                      <span class="mudo">—</span>
                    }
                  </td>
                  <td class="num mudo">{{ e.presentes }}/{{ e.esperados }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </rs-chart-card>
  `,
  styleUrl: './abas.css',
})
export class AbaFrequencia {
  private readonly api = inject(PainelApi);
  readonly parametros = input.required<Parametros>();

  protected readonly dados = carga(() => this.api.analiseFrequencia(this.parametros()), {
    vazio: (a) => a.alunosAvaliados === 0,
  });

  protected readonly pct = percentual;
  protected readonly tomDaFaixa = tomDaFaixa;
  protected readonly delta = (v: number | null) => variacao(v, 'pp');

  protected readonly evolucao = computed(() => linhaEvolucao(this.dados.dados()!));
  protected readonly mudancas = computed(() => barrasVariacao(this.dados.dados()!.porEscola));
  protected readonly faltas = computed(() => barrasFaltasPorDia(this.dados.dados()!.porDiaSemana));
  protected readonly turnos = computed(() => barrasFrequencia(this.dados.dados()!.porTurno));
  protected readonly leituraFaltas = computed(() =>
    diaQueMaisFalta(this.dados.dados()!.porDiaSemana),
  );

  protected readonly escolasOk = computed(() => {
    const escolas = (this.dados.dados()?.porEscola ?? []).filter((e) => e.frequencia !== null);
    return { acima: escolas.filter((e) => e.faixa === 'OK').length, total: escolas.length };
  });

  protected readonly tomFrequencia = computed<Tom>(() =>
    tomDaFaixa(
      this.dados.dados()?.porEscola.length ? faixa(this.dados.dados()!.frequencia.atual) : null,
    ),
  );

  /** "Quem mais mudou" só faz sentido com comparação e ao menos uma escola com variação. */
  protected readonly estadoVariacao = computed(() => {
    const estado = this.dados.estado();
    const a = this.dados.dados();
    if (
      (estado === 'ok' || estado === 'desatualizado') &&
      !a?.porEscola.some((e) => e.variacao !== null)
    ) {
      return 'vazio';
    }
    return estado;
  });

  protected rotulo(etapa: string): string {
    return etapa.charAt(0) + etapa.slice(1).toLocaleLowerCase('pt-BR');
  }

  protected alturaLista(n: number): number {
    return Math.max(120, n * 40 + 24);
  }
}

function faixa(v: number | null): 'OK' | 'ATENCAO' | 'CRITICO' | null {
  if (v === null) return null;
  return v < 60 ? 'CRITICO' : v <= 85 ? 'ATENCAO' : 'OK';
}
