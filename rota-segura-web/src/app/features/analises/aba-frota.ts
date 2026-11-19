import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { carga } from '../../core/api/carga';
import { AnaliseFrota } from '../../core/api/modelos';
import { PainelApi, Parametros } from '../../core/api/painel-api.service';
import { percentual } from '../../shared/formato';
import { Grafico } from '../../shared/graficos/grafico';
import { ChartCard } from '../../shared/ui/chart-card';
import { Tom } from '../../shared/ui/tom';
import { barrasAlertas, barrasTipos, graficoViagens } from './analises.graficos';
import { IndicadorAnalise } from './indicador';

/** Pontualidade (chegadas dentro da janela): 95% ou mais é bom, abaixo de 85% é crítico. */
export function tomPontualidade(v: number | null | undefined): Tom {
  if (v === null || v === undefined) return 'neutro';
  return v >= 95 ? 'sucesso' : v >= 85 ? 'atencao' : 'critico';
}

@Component({
  selector: 'rs-aba-frota',
  imports: [ChartCard, Grafico, IndicadorAnalise, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let f = dados.dados();
    <div class="indicadores">
      <rs-indicador
        [valor]="f ? num(f.embarques.atual) : '—'"
        [variacao]="f?.embarques?.variacao ?? null"
        unidade="%"
        [legenda]="'embarques em ' + num(f?.viagens?.atual) + ' viagens'"
      />
      <rs-indicador
        [valor]="f?.tempoMedioMin?.atual != null ? num(f!.tempoMedioMin.atual) : '—'"
        complemento=" min"
        [variacao]="f?.tempoMedioMin?.variacao ?? null"
        unidade="min"
        [maiorEhMelhor]="false"
        legenda="tempo médio do embarque à escola"
      />
      <rs-indicador
        [valor]="pct(f?.noPrazo?.atual)"
        [tom]="tomPontualidade(f?.noPrazo?.atual)"
        [variacao]="f?.noPrazo?.variacao ?? null"
        unidade="pp"
        [legenda]="'chegaram em até ' + (f?.janelaMin ?? 40) + ' min'"
      />
      <rs-indicador
        [valor]="f ? num(f.alertas.total.atual) : '—'"
        [tom]="(f?.alertas?.porSeveridade?.CRITICO ?? 0) > 0 ? 'critico' : 'neutro'"
        [variacao]="f?.alertas?.total?.variacao ?? null"
        unidade="%"
        [maiorEhMelhor]="false"
        [legenda]="'alertas · ' + (f?.alertas?.abertos ?? 0) + ' ainda abertos'"
      />
    </div>

    <rs-chart-card
      titulo="Embarques e tempo de trajeto"
      [estado]="dados.estado()"
      [atualizadoEm]="dados.atualizadoEm()"
      (tentarDeNovo)="dados.recarregar()"
    >
      @if (f) {
        <rs-grafico
          [opcoes]="viagens()"
          [altura]="280"
          descricao="Embarques em barras e tempo médio de trajeto em linha, ao longo do período"
        />
      }
    </rs-chart-card>

    <div class="grade grade--dupla">
      <rs-chart-card
        titulo="Alertas no período"
        [estado]="dados.estado()"
        (tentarDeNovo)="dados.recarregar()"
      >
        @if (f) {
          <rs-grafico
            [opcoes]="alertas()"
            [altura]="240"
            descricao="Alertas abertos em cada parte do período, críticos e demais"
          />
          <p class="leitura">
            {{ f.alertas.porSeveridade.CRITICO }} críticos ·
            {{ f.alertas.porSeveridade.ATENCAO }} de atenção ·
            {{ f.alertas.porSeveridade.INFO }} informativos
            @if (f.alertas.tempoMedioResolucaoMin !== null) {
              · resolvidos em média em {{ num(f.alertas.tempoMedioResolucaoMin) }} min
            }
          </p>
        }
      </rs-chart-card>
      <rs-chart-card
        titulo="Tipos de alerta"
        [estado]="estadoTipos()"
        mensagemVazio="Nenhum alerta no período."
        (tentarDeNovo)="dados.recarregar()"
      >
        @if (f) {
          <rs-grafico
            [opcoes]="tipos()"
            [altura]="240"
            descricao="Quantidade de alertas por tipo"
          />
        }
      </rs-chart-card>
    </div>

    <rs-chart-card
      titulo="Ônibus no período"
      [estado]="estadoVeiculos()"
      mensagemVazio="Nenhum embarque no período para os filtros escolhidos."
      (tentarDeNovo)="dados.recarregar()"
    >
      @if (f) {
        <div class="tabela-rolagem">
          <table class="tabela">
            <thead>
              <tr>
                <th scope="col">Ônibus</th>
                <th scope="col" class="num">Viagens</th>
                <th scope="col" class="num">Embarques</th>
                <th scope="col" class="num">Sem chegada</th>
                <th scope="col" class="num">Tempo médio</th>
                <th scope="col" class="num">No prazo</th>
                <th scope="col" class="num">Alertas</th>
              </tr>
            </thead>
            <tbody>
              @for (v of f.veiculos; track v.id) {
                <tr>
                  <th scope="row">
                    <a routerLink="/veiculos" [queryParams]="{ veiculo: v.id }">{{
                      v.placa ?? 'Veículo #' + v.id
                    }}</a>
                    @if (v.prefixo) {
                      <span class="mudo"> · {{ v.prefixo }}</span>
                    }
                  </th>
                  <td class="num">{{ v.viagens }}</td>
                  <td class="num">{{ num(v.embarques) }}</td>
                  <td class="num" [class.tom-atencao]="v.semChegada > 0">{{ v.semChegada }}</td>
                  <td class="num">
                    {{ v.tempoMedioMin === null ? '—' : num(v.tempoMedioMin) + ' min' }}
                  </td>
                  <td [class]="'num tom-' + tomPontualidade(v.noPrazo)">{{ pct(v.noPrazo) }}</td>
                  <td class="num" [class.tom-critico]="v.alertas > 0">{{ v.alertas }}</td>
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
export class AbaFrota {
  private readonly api = inject(PainelApi);
  readonly parametros = input.required<Parametros>();

  protected readonly dados = carga(() => this.api.analiseFrota(this.parametros()), {
    vazio: (f) => (f.embarques.atual ?? 0) === 0 && (f.alertas.total.atual ?? 0) === 0,
  });

  protected readonly pct = percentual;
  protected readonly tomPontualidade = tomPontualidade;

  protected num(v: number | null | undefined): string {
    return v === null || v === undefined
      ? '—'
      : v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  }

  protected readonly viagens = computed(() => graficoViagens(this.dados.dados()!));
  protected readonly alertas = computed(() => barrasAlertas(this.dados.dados()!));
  protected readonly tipos = computed(() => barrasTipos(this.dados.dados()!.alertas.porTipo));

  private comDados(tem: (f: AnaliseFrota) => boolean) {
    const estado = this.dados.estado();
    const f = this.dados.dados();
    return (estado === 'ok' || estado === 'desatualizado') && f && !tem(f) ? 'vazio' : estado;
  }

  protected readonly estadoTipos = computed(() =>
    this.comDados((f) => Object.keys(f.alertas.porTipo).length > 0),
  );
  protected readonly estadoVeiculos = computed(() => this.comDados((f) => f.veiculos.length > 0));
}
