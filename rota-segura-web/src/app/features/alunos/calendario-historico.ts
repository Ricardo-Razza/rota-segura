import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { forkJoin, map } from 'rxjs';
import { carga } from '../../core/api/carga';
import { JornadaDoDia, TipoLeitor } from '../../core/api/modelos';
import { PainelApi } from '../../core/api/painel-api.service';
import { dataCurta, hora, isoLocal, minutos } from '../../shared/formato';
import { ChartCard, EstadoCard } from '../../shared/ui/chart-card';
import { Icone, NomeIcone } from '../../shared/ui/icone';
import { StatusBadge } from '../../shared/ui/status-badge';
import { EstadoJornada, JORNADA } from '../../shared/ui/tom';
import { TEXTO_DIVERGENCIA } from '../jornada/jornada.logica';
import { MapaJornada } from '../jornada/mapa-jornada';
import {
  Celula,
  ESTADOS_DO_RESUMO,
  NOMES_DOS_MESES,
  Situacao,
  celulasDoMes,
  diaInicial,
  diasContados,
  janelasDoAno,
  mesInicial,
  mesesDoAno,
  montarHistorico,
  resumir,
} from './calendario.logica';
import { CampoAno } from './campo-ano';

const ICONE_DO_ESTADO: Record<EstadoJornada, NomeIcone> = {
  NA_ESCOLA: 'check',
  AUSENTE: 'x',
  DIVERGENTE: 'alerta',
  EMBARCADO: 'onibus',
  AGUARDANDO: 'relogio',
};

function ehEstado(s: Situacao): s is EstadoJornada {
  return s in JORNADA;
}

/**
 * Histórico de jornadas do aluno em calendário: um mês com o detalhe do dia, ou o ano inteiro. Cada
 * situação tem cor, ícone e texto (a cor nunca é a única pista).
 */
@Component({
  selector: 'rs-calendario-historico',
  imports: [CampoAno, ChartCard, Icone, MapaJornada, StatusBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <rs-chart-card
      titulo="Histórico de jornadas"
      [estado]="estado()"
      [atualizadoEm]="consulta.atualizadoEm()"
      (tentarDeNovo)="consulta.recarregar()"
    >
      <div acoes class="comandos">
        <div class="grupo grupo--ano">
          <span class="rotulo">Ano letivo</span>
          <rs-campo-ano [ano]="ano()" [anoAtual]="anoAtual" (anoEscolhido)="abrirAno($event)" />
          @if (ano() !== anoAtual) {
            <button type="button" class="rs-botao rs-botao--pequeno" (click)="abrirAno(anoAtual)">
              Voltar para hoje
            </button>
          }
        </div>
        <div class="grupo">
          <span class="rotulo">Ver</span>
          <div class="abas" role="group" aria-label="Visão do calendário">
            <button
              type="button"
              [attr.aria-pressed]="vista() === 'mes'"
              (click)="vista.set('mes')"
            >
              Mês
            </button>
            <button
              type="button"
              [attr.aria-pressed]="vista() === 'ano'"
              (click)="vista.set('ano')"
            >
              Ano inteiro
            </button>
          </div>
        </div>
      </div>

      @if (historico().primeiraLeitura === null) {
        <div class="sem-registro" role="status">
          <strong>Nenhum registro em {{ ano() }}</strong>
          <p class="rs-nota">Não há leituras deste aluno nesse ano.</p>
          @if (ano() !== anoAtual) {
            <button type="button" class="rs-botao" (click)="abrirAno(anoAtual)">
              Voltar para {{ anoAtual }}
            </button>
          }
        </div>
      } @else {
        <div class="barra">
          @if (vista() === 'mes') {
            <div class="abas abas--meses" role="group" aria-label="Mês">
              @for (m of meses(); track m.mes) {
                <button
                  type="button"
                  [disabled]="m.futuro"
                  [attr.aria-pressed]="m.mes === mes()"
                  (click)="abrirMes(m.mes)"
                >
                  {{ nomesDosMeses[m.mes].slice(0, 3) }}
                </button>
              }
            </div>
          } @else {
            <div>
              <h3>Resumo de {{ ano() }}</h3>
              <p class="rs-nota">
                {{ resumo().total }} dias letivos · {{ presencaTexto(resumo().presenca) }} · clique
                em um mês para abrir
              </p>
            </div>
          }
          <ul class="contagens" aria-label="Dias por situação">
            @for (c of contagens(); track c.estado) {
              <li [class]="'tom-' + jornada[c.estado].tom">
                <rs-icone [nome]="icone[c.estado]" [tamanho]="15" />
                <strong>{{ c.total }}</strong>
                <span>{{ jornada[c.estado].rotulo }}</span>
              </li>
            }
          </ul>
        </div>

        @if (vista() === 'mes') {
          <div class="corpo">
            <div class="grade">
              @for (s of diasDaSemana; track s) {
                <span class="semana">{{ s }}</span>
              }
              @for (c of celulas(); track $index) {
                @if (!c) {
                  <span></span>
                } @else if (estadoDa(c); as estado) {
                  <button
                    type="button"
                    [class]="'celula celula--estado tom-' + jornada[estado].tom"
                    [class.celula--hoje]="c.hoje"
                    [attr.aria-current]="c.hoje ? 'date' : null"
                    [attr.aria-pressed]="c.data === dia()"
                    [attr.aria-label]="dataCurta(c.data) + ': ' + jornada[estado].rotulo"
                    (click)="abrirDia(c.data)"
                  >
                    <span class="topo">
                      <b>{{ c.dia }}</b>
                      @if (c.hoje) {
                        <em>HOJE</em>
                      }
                      <span class="marcas">
                        @if (estado === 'NA_ESCOLA' && c.jornada!.divergencias.length) {
                          <rs-icone class="aviso-dia" nome="alerta" [tamanho]="13" />
                        }
                        <rs-icone [nome]="icone[estado]" [tamanho]="15" />
                      </span>
                    </span>
                    <span class="situacao">{{ jornada[estado].rotulo }}</span>
                    <span class="horas">{{ linhas(c.jornada!)[0] }}</span>
                    <span class="trajeto">{{ linhas(c.jornada!)[1] }}</span>
                  </button>
                } @else {
                  <div [class]="'celula celula--' + c.situacao" [class.celula--fds]="c.fimDeSemana">
                    <span class="topo"
                      ><b>{{ c.dia }}</b></span
                    >
                    @if (c.situacao === 'SEM_AULA') {
                      <span class="legenda">Sem aula</span>
                    } @else if (c.situacao === 'SEM_REGISTRO') {
                      <span class="legenda">Sem registro</span>
                    }
                  </div>
                }
              }
            </div>

            <aside class="detalhe-dia" aria-live="polite">
              @if (selecionado(); as j) {
                <div>
                  <h3>{{ dataPorExtenso(j.data) }}</h3>
                  <p class="rs-nota">{{ diaDaSemana(j.data) }}</p>
                </div>
                <rs-status-badge [texto]="jornada[j.estado].rotulo" [tom]="jornada[j.estado].tom" />
                @for (d of j.divergencias; track d.tipo) {
                  <p class="rs-aviso">{{ textoDivergencia[d.tipo] }}</p>
                }
                <ol class="passos">
                  <li [class.faltou]="!j.embarqueEm">
                    <span class="quando">{{ hora(j.embarqueEm) }}</span>
                    <strong>Embarque</strong>
                    <span class="rs-nota">{{
                      leitor(j, 'EMBARQUE', 'Nenhuma leitura no ônibus')
                    }}</span>
                  </li>
                  <li [class.faltou]="!j.chegadaEm">
                    <span class="quando">{{ hora(j.chegadaEm) }}</span>
                    <strong>Chegada na escola</strong>
                    <span class="rs-nota">{{
                      leitor(j, 'CHEGADA', 'Nenhuma leitura na escola')
                    }}</span>
                  </li>
                </ol>
                <dl>
                  <dt>Tempo de trajeto</dt>
                  <dd>{{ minutos(j.tempoTrajetoMin) }}</dd>
                  <dt>Veículo</dt>
                  <dd>{{ j.veiculoId ? '#' + j.veiculoId : '—' }}</dd>
                </dl>
                @if (j.passos.length) {
                  <button
                    type="button"
                    class="rs-botao"
                    [attr.aria-expanded]="mapaDe() === j.data"
                    [attr.aria-label]="'Ver no mapa onde embarcou e chegou em ' + dataCurta(j.data)"
                    (click)="alternarMapa(j.data)"
                  >
                    <rs-icone nome="mapa" [tamanho]="16" />
                    {{ mapaDe() === j.data ? 'Fechar mapa' : 'Ver no mapa' }}
                  </button>
                }
              } @else {
                <p class="rs-nota">Escolha um dia no calendário.</p>
              }
            </aside>
          </div>
          @if (mapaDe(); as data) {
            <rs-mapa-jornada [alunoId]="alunoId()" [data]="data" />
          }
        } @else {
          <div class="ano">
            @for (m of miniaturas(); track m.mes) {
              <button
                type="button"
                class="mini"
                [class.mini--atual]="m.atual"
                [attr.aria-label]="
                  nomesDosMeses[m.mes] + ': ' + presencaTexto(m.presenca) + '. Abrir mês'
                "
                (click)="abrirMes(m.mes)"
              >
                <span class="mini-topo">
                  <strong>{{ nomesDosMeses[m.mes] }}</strong>
                  <span class="rs-nota">{{ presencaTexto(m.presenca) }}</span>
                </span>
                <span class="mini-grade" aria-hidden="true">
                  @for (s of diasDaSemana; track s) {
                    <small>{{ s[0] }}</small>
                  }
                  @for (c of m.celulas; track $index) {
                    @if (!c) {
                      <span></span>
                    } @else if (estadoDa(c); as estado) {
                      <span
                        [class]="'q q--estado tom-' + jornada[estado].tom"
                        [title]="dataCurta(c.data) + ': ' + jornada[estado].rotulo"
                        >{{ c.dia }}</span
                      >
                    } @else {
                      <span [class]="'q q--' + c.situacao">{{ c.dia }}</span>
                    }
                  }
                </span>
              </button>
            }
          </div>
        }
      }
    </rs-chart-card>
  `,
  styleUrl: './calendario-historico.css',
})
export class CalendarioHistorico {
  private readonly api = inject(PainelApi);

  readonly alunoId = input.required<number>();

  protected readonly jornada = JORNADA;
  protected readonly icone = ICONE_DO_ESTADO;
  protected readonly textoDivergencia = TEXTO_DIVERGENCIA;
  protected readonly nomesDosMeses = NOMES_DOS_MESES;
  protected readonly diasDaSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  protected readonly hora = hora;
  protected readonly minutos = minutos;
  protected readonly dataCurta = dataCurta;

  private readonly hoje = isoLocal(new Date());
  protected readonly anoAtual = new Date().getFullYear();

  protected readonly ano = signal(this.anoAtual);
  protected readonly vista = signal<'mes' | 'ano'>('mes');
  /** null = usa o padrão do ano (mês) ou do mês (dia). Trocar de aluno limpa as escolhas. */
  private readonly mesEscolhido = linkedSignal<number, number | null>({
    source: () => this.alunoId(),
    computation: () => null,
  });
  private readonly diaEscolhido = linkedSignal<number, string | null>({
    source: () => this.alunoId(),
    computation: () => null,
  });
  /** Dia com o mapa aberto (um por vez: cada abertura é uma consulta auditada). */
  protected readonly mapaDe = linkedSignal<number, string | null>({
    source: () => this.alunoId(),
    computation: () => null,
  });

  protected readonly consulta = carga(
    () => {
      const id = this.alunoId();
      const ano = this.ano();
      const janelas = janelasDoAno(ano, new Date());
      return forkJoin(janelas.map((j) => this.api.jornadasDoAluno(id, j.inicio, j.fim))).pipe(
        map((partes) => ({ id, ano, jornadas: partes.flat() })),
      );
    },
    { desatualizado: () => false },
  );

  /** Só o dado do aluno e do ano abertos: o anterior não pode aparecer enquanto o novo carrega ou falha. */
  private readonly doAno = computed<JornadaDoDia[] | null>(() => {
    const dados = this.consulta.dados();
    return dados?.id === this.alunoId() && dados.ano === this.ano() ? dados.jornadas : null;
  });
  protected readonly estado = computed<EstadoCard>(() => {
    if (this.doAno()) {
      return this.consulta.estado();
    }
    return this.consulta.carregando() ? 'carregando' : 'erro';
  });

  protected readonly historico = computed(() => montarHistorico(this.doAno() ?? []));
  protected readonly meses = computed(() => mesesDoAno(this.historico(), this.ano(), this.hoje));
  protected readonly mes = computed(
    () => this.mesEscolhido() ?? mesInicial(this.historico(), this.ano(), this.hoje),
  );
  protected readonly dia = computed(
    () => this.diaEscolhido() ?? diaInicial(this.historico(), this.mes(), this.hoje),
  );
  protected readonly selecionado = computed(() => {
    const data = this.dia();
    return data ? (this.historico().porData.get(data) ?? null) : null;
  });
  protected readonly celulas = computed(() =>
    celulasDoMes(this.historico(), this.ano(), this.mes(), this.hoje),
  );

  private readonly prefixoDoMes = (mes: number) =>
    `${this.ano()}-${String(mes + 1).padStart(2, '0')}`;

  /** Resumo do que está na tela: o mês aberto ou o ano. */
  protected readonly resumo = computed(() => {
    const prefixo = this.vista() === 'mes' ? this.prefixoDoMes(this.mes()) : `${this.ano()}`;
    return resumir(diasContados(this.historico(), prefixo, this.hoje));
  });
  protected readonly contagens = computed(() =>
    ESTADOS_DO_RESUMO.map((estado) => ({ estado, total: this.resumo().porEstado[estado] })).filter(
      // "Embarcado" num dia encerrado é exceção; só aparece se houver.
      (c) => c.estado !== 'EMBARCADO' || c.total > 0,
    ),
  );
  protected readonly miniaturas = computed(() =>
    this.meses()
      .filter((m) => !m.futuro)
      .map(({ mes }) => ({
        mes,
        atual: this.hoje.startsWith(this.prefixoDoMes(mes)),
        celulas: celulasDoMes(this.historico(), this.ano(), mes, this.hoje),
        presenca: resumir(diasContados(this.historico(), this.prefixoDoMes(mes), this.hoje))
          .presenca,
      })),
  );

  protected abrirAno(ano: number): void {
    this.ano.set(ano);
    this.mesEscolhido.set(null);
    this.diaEscolhido.set(null);
    this.mapaDe.set(null);
  }

  protected abrirMes(mes: number): void {
    this.mesEscolhido.set(mes);
    this.diaEscolhido.set(null);
    this.mapaDe.set(null);
    this.vista.set('mes');
  }

  protected abrirDia(data: string): void {
    this.diaEscolhido.set(data);
    this.mapaDe.set(null);
  }

  protected alternarMapa(data: string): void {
    this.mapaDe.update((atual) => (atual === data ? null : data));
  }

  /** null = célula sem jornada para mostrar (fora do mês, futura, sem aula ou sem registro). */
  protected estadoDa(c: Celula | null): EstadoJornada | null {
    return c && ehEstado(c.situacao) ? c.situacao : null;
  }

  /** As duas linhas de baixo da célula: horários e trajeto, ou o que faltou. */
  protected linhas(j: JornadaDoDia): [string, string] {
    if (j.estado === 'AUSENTE') {
      return ['Nenhuma leitura', ''];
    }
    if (j.estado === 'AGUARDANDO') {
      return ['Aguardando leitura', ''];
    }
    if (!j.embarqueEm && j.chegadaEm) {
      return ['Sem embarque', `Chegou ${hora(j.chegadaEm)}`];
    }
    const trajeto =
      j.tempoTrajetoMin !== null
        ? `${minutos(j.tempoTrajetoMin)} de trajeto`
        : j.estado === 'DIVERGENTE'
          ? 'Sem chegada'
          : '';
    return [`${hora(j.embarqueEm)} → ${hora(j.chegadaEm)}`, trajeto];
  }

  protected leitor(j: JornadaDoDia, tipo: TipoLeitor, semLeitura: string): string {
    const passo = j.passos.find((p) => p.tipo === tipo);
    if (passo) {
      return `Leitor #${passo.leitorId}`;
    }
    const quando = tipo === 'EMBARQUE' ? j.embarqueEm : j.chegadaEm;
    return quando ? 'Leitor não informado' : semLeitura;
  }

  protected presencaTexto(presenca: number | null): string {
    return presenca === null ? 'sem dias encerrados' : `${Math.round(presenca)}% de presença`;
  }

  protected dataPorExtenso(iso: string): string {
    return new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'long',
    });
  }

  protected diaDaSemana(iso: string): string {
    const nome = new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR', { weekday: 'long' });
    return nome.charAt(0).toUpperCase() + nome.slice(1);
  }
}
