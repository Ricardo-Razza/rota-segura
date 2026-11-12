import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { carga } from '../../core/api/carga';
import { Agendamento, TipoRelatorio } from '../../core/api/modelos';
import { PainelApi } from '../../core/api/painel-api.service';
import { FiltrosStore } from '../../core/filtros/filtros.store';
import { ToastService } from '../../core/toast/toast.service';
import { dataHora } from '../../shared/formato';
import { ChartCard } from '../../shared/ui/chart-card';
import { DateRangePicker, Periodo, periodoDoPreset } from '../../shared/ui/date-range-picker';

const DIAS: { valor: string; rotulo: string }[] = [
  { valor: 'MONDAY', rotulo: 'segunda-feira' },
  { valor: 'TUESDAY', rotulo: 'terça-feira' },
  { valor: 'WEDNESDAY', rotulo: 'quarta-feira' },
  { valor: 'THURSDAY', rotulo: 'quinta-feira' },
  { valor: 'FRIDAY', rotulo: 'sexta-feira' },
];

export const TIPOS: { valor: TipoRelatorio; rotulo: string }[] = [
  { valor: 'FREQUENCIA', rotulo: 'Frequência por aluno' },
  { valor: 'VEICULOS', rotulo: 'Operação por veículo' },
];

/** Dispara o download de um Blob com o nome dado (o arquivo nunca passa por URL com dado pessoal). */
export function baixar(blob: Blob, nome: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Relatórios: "7 dias" já selecionado (nada bloqueado), prévia antes de exportar e envio semanal. */
@Component({
  selector: 'rs-relatorios',
  imports: [ChartCard, DateRangePicker],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rs-pagina">
      <div class="rs-pagina__topo">
        <h1>Relatórios</h1>
      </div>

      <div class="rs-pagina__acoes">
        <label>
          <span class="rs-somente-leitor">Tipo de relatório</span>
          <select
            class="rs-campo"
            aria-label="Tipo de relatório"
            (change)="tipo.set($any($event.target).value)"
          >
            @for (t of tipos; track t.valor) {
              <option [value]="t.valor" [selected]="tipo() === t.valor">{{ t.rotulo }}</option>
            }
          </select>
        </label>
        <rs-date-range-picker [(periodo)]="periodo" />
        <button
          type="button"
          class="rs-botao rs-botao--primario"
          [disabled]="exportando()"
          (click)="exportar('csv')"
        >
          Exportar CSV
        </button>
        <button type="button" class="rs-botao" [disabled]="exportando()" (click)="exportar('pdf')">
          Exportar PDF
        </button>
      </div>
      <p class="rs-nota">
        Os filtros do topo (escola, ano escolar, turma) também valem aqui. Toda exportação fica
        registrada na auditoria.
      </p>

      <rs-chart-card
        titulo="Prévia"
        [estado]="previa.estado()"
        [atualizadoEm]="previa.atualizadoEm()"
        mensagemVazio="Nenhuma linha no período."
        mensagemErro="Não foi possível gerar a prévia (o período máximo é de 92 dias)."
        (tentarDeNovo)="previa.recarregar()"
      >
        @if (previa.dados(); as p) {
          <p class="rs-nota">
            {{ p.tabela.titulo }} · {{ p.tabela.periodo }} · mostrando
            {{ p.tabela.linhas.length }} de {{ p.totalLinhas }} linhas
          </p>
          <div class="rolagem" tabindex="0" role="region" aria-label="Prévia do relatório">
            <table>
              <thead>
                <tr>
                  @for (c of p.tabela.colunas; track $index) {
                    <th scope="col">{{ c }}</th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (linha of p.tabela.linhas; track $index) {
                  <tr>
                    @for (v of linha; track $index) {
                      <td>{{ v || '—' }}</td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </rs-chart-card>

      <rs-chart-card
        titulo="Envio semanal por e-mail"
        [estado]="agendados.estado() === 'vazio' ? 'ok' : agendados.estado()"
        (tentarDeNovo)="agendados.recarregar()"
      >
        <p class="rs-nota">
          O relatório vai para o e-mail cadastrado no seu usuário, com os últimos 7 dias.
        </p>
        <div class="rs-pagina__acoes">
          <label>
            <span class="rs-somente-leitor">Dia do envio</span>
            <select
              class="rs-campo"
              aria-label="Dia do envio"
              (change)="diaSemana.set($any($event.target).value)"
            >
              @for (d of dias; track d.valor) {
                <option [value]="d.valor" [selected]="diaSemana() === d.valor">
                  Toda {{ d.rotulo }}
                </option>
              }
            </select>
          </label>
          <button type="button" class="rs-botao" (click)="agendar()">
            Agendar {{ rotuloTipo() }}
          </button>
        </div>
        <ul class="rs-lista">
          @for (a of agendados.dados() ?? []; track a.id) {
            <li>
              <span class="cresce">
                {{ rotuloDe(a.tipo) }} · toda {{ rotuloDia(a.diaSemana)
                }}{{ a.escolaId ? ' · escola #' + a.escolaId : '' }}
                <span class="rs-nota">
                  · último envio
                  {{ a.ultimoEnvioEm ? dataHora(a.ultimoEnvioEm) : 'ainda não enviado' }}</span
                >
              </span>
              <button
                type="button"
                class="rs-botao rs-botao--pequeno rs-botao--perigo"
                (click)="cancelar(a)"
              >
                Cancelar
              </button>
            </li>
          } @empty {
            <li class="rs-nota">Nenhum envio agendado.</li>
          }
        </ul>
      </rs-chart-card>
    </div>
  `,
  styles: `
    .rolagem {
      overflow-x: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    th,
    td {
      padding: 6px 10px;
      border-bottom: 1px solid var(--borda);
      text-align: left;
      white-space: nowrap;
    }
    th {
      color: var(--texto-suave);
      background: var(--superficie-2);
    }
    .cresce {
      flex: 1;
    }
  `,
})
export class Relatorios {
  private readonly api = inject(PainelApi);
  private readonly filtros = inject(FiltrosStore);
  private readonly toasts = inject(ToastService);

  protected readonly tipos = TIPOS;
  protected readonly dias = DIAS;
  protected readonly dataHora = dataHora;

  protected readonly tipo = signal<TipoRelatorio>('FREQUENCIA');
  /** "7 dias" pré-selecionado: a exportação nunca fica bloqueada esperando datas. */
  protected readonly periodo = signal<Periodo>(periodoDoPreset('7dias'));
  protected readonly diaSemana = signal('MONDAY');
  protected readonly exportando = signal(false);

  private readonly parametros = computed(() => ({
    ...this.filtros.parametros(),
    dataInicio: this.periodo().inicio,
    dataFim: this.periodo().fim,
  }));

  protected readonly previa = carga(
    () => this.api.previaRelatorio(this.tipo(), this.parametros()),
    {
      vazio: (p) => p.totalLinhas === 0,
      desatualizado: () => false,
    },
  );
  protected readonly agendados = carga(() => this.api.agendados(), {
    vazio: (l) => l.length === 0,
    desatualizado: () => false,
  });
  protected readonly rotuloTipo = computed(() => this.rotuloDe(this.tipo()).toLowerCase());

  protected exportar(formato: 'csv' | 'pdf'): void {
    this.exportando.set(true);
    const p = this.periodo();
    this.api.exportar(this.tipo(), formato, this.parametros()).subscribe({
      next: (blob) => {
        this.exportando.set(false);
        baixar(blob, `${this.tipo().toLowerCase()}_${p.inicio}_${p.fim}.${formato}`);
      },
      error: () => this.exportando.set(false),
    });
  }

  protected agendar(): void {
    this.api.agendar(this.tipo(), this.filtros.escolaId(), this.diaSemana()).subscribe(() => {
      this.toasts.mostrar('Envio semanal agendado.', 'sucesso');
      this.agendados.recarregar(true);
    });
  }

  protected cancelar(a: Agendamento): void {
    this.api.cancelarAgendamento(a.id).subscribe(() => this.agendados.recarregar(true));
  }

  protected rotuloDe(tipo: TipoRelatorio): string {
    return TIPOS.find((t) => t.valor === tipo)?.rotulo ?? tipo;
  }

  protected rotuloDia(dia: string): string {
    return DIAS.find((d) => d.valor === dia)?.rotulo ?? dia;
  }
}
