import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin, map } from 'rxjs';
import { carga } from '../../core/api/carga';
import { JornadaDoDia } from '../../core/api/modelos';
import { PainelApi } from '../../core/api/painel-api.service';
import { AuthService } from '../../core/auth/auth.service';
import { dataCurta, hora, isoLocal, minutos, percentual } from '../../shared/formato';
import { ChartCard } from '../../shared/ui/chart-card';
import { KpiCard } from '../../shared/ui/kpi-card';
import { StatusBadge } from '../../shared/ui/status-badge';
import { JORNADA } from '../../shared/ui/tom';
import { MapaJornada } from '../jornada/mapa-jornada';
import { avaliarRisco, janelasDeHistorico, ultimosDias } from './alunos.logica';

/** 90 dias letivos cabem em ~130 dias corridos (fins de semana e feriados). */
const DIAS_CORRIDOS = 130;
const DIAS_LETIVOS = 90;

/** Perfil do aluno (acesso auditado no backend). Foto só por URL assinada; aqui, placeholder com iniciais. */
import { Icone } from '../../shared/ui/icone';
@Component({
  selector: 'rs-perfil-aluno',
  imports: [Icone, ChartCard, KpiCard, StatusBadge, RouterLink, MapaJornada],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rs-pagina">
      <a class="voltar" routerLink="/alunos" queryParamsHandling="preserve"
        ><rs-icone nome="esq" [tamanho]="16" /> Alunos</a
      >

      <rs-chart-card
        titulo="Perfil do aluno"
        [estado]="perfil.estado()"
        [atualizadoEm]="perfil.atualizadoEm()"
        (tentarDeNovo)="perfil.recarregar()"
      >
        @if (perfil.dados(); as p) {
          <div class="cabecalho">
            <span
              class="foto"
              role="img"
              [attr.aria-label]="'Sem foto: iniciais ' + (p.aluno.iniciais || '')"
              >{{ p.aluno.iniciais || '?' }}</span
            >
            <div>
              <h1>{{ p.aluno.nome || 'Aluno #' + p.aluno.id }}</h1>
              <p class="rs-nota">
                {{ p.aluno.turma || 'Sem turma' }} · {{ p.aluno.anoEscolar || '—' }} ·
                {{ p.aluno.turno || '—' }} ·
                {{ p.aluno.escolaNome || 'Escola não informada' }}
              </p>
              <p class="rs-nota">
                Veículo:
                {{ p.aluno.veiculoId ? '#' + p.aluno.veiculoId : 'não informado no cadastro' }} ·
                Biometria:
                {{
                  p.aluno.biometria === null ? '—' : p.aluno.biometria ? 'cadastrada' : 'pendente'
                }}
              </p>
            </div>
            @if (p.jornadaHoje; as j) {
              <rs-status-badge
                [texto]="'Hoje: ' + jornada[j.estado].rotulo"
                [tom]="jornada[j.estado].tom"
              />
            }
          </div>
        }
      </rs-chart-card>

      <div class="rs-grade rs-grade--kpi">
        <rs-kpi-card
          rotulo="Frequência (90 dias letivos)"
          [valor]="kpis()?.frequencia ?? null"
          [carregando]="historico.carregando()"
        />
        <rs-kpi-card
          rotulo="Faltas"
          tom="atencao"
          [valor]="kpis()?.faltas ?? null"
          [carregando]="historico.carregando()"
        />
        <rs-kpi-card
          rotulo="Tempo médio de trajeto"
          tom="info"
          [valor]="kpis()?.trajeto ?? null"
          [carregando]="historico.carregando()"
        />
        <rs-kpi-card
          rotulo="Risco"
          [tom]="tomRisco()"
          [valor]="risco()?.nivel ?? null"
          [detalhe]="risco()?.motivos?.join(' · ') ?? ''"
          [carregando]="historico.carregando()"
        />
      </div>

      <rs-chart-card
        titulo="Presença nos últimos 90 dias letivos"
        [estado]="historico.estado()"
        [atualizadoEm]="historico.atualizadoEm()"
        mensagemVazio="Sem histórico de dias letivos."
        (tentarDeNovo)="historico.recarregar()"
      >
        <div class="mapa-calor" role="list" aria-label="Presença por dia letivo">
          @for (d of dias(); track d.data) {
            <span
              role="listitem"
              class="dia"
              [class]="'dia dia--' + d.estado"
              [title]="dataCurta(d.data) + ': ' + jornada[d.estado].rotulo"
            >
              <span class="rs-somente-leitor"
                >{{ dataCurta(d.data) }}: {{ jornada[d.estado].rotulo }}</span
              >
            </span>
          }
        </div>
        <p class="rs-nota legenda">
          <span class="dia dia--NA_ESCOLA"></span> na escola
          <span class="dia dia--AUSENTE"></span> ausente
          <span class="dia dia--DIVERGENTE"></span> divergente
          <span class="dia dia--EMBARCADO"></span> embarcado sem chegada
        </p>
      </rs-chart-card>

      <div class="rs-grade rs-grade--2">
        <rs-chart-card
          titulo="Histórico de jornadas"
          [estado]="historico.estado()"
          (tentarDeNovo)="historico.recarregar()"
        >
          <ul class="rs-lista">
            @for (d of recentes(); track d.data) {
              <li>
                <span class="rs-mono">{{ dataCurta(d.data) }}</span>
                <rs-status-badge [texto]="jornada[d.estado].rotulo" [tom]="jornada[d.estado].tom" />
                <span class="rs-nota quem"
                  >{{ hora(d.embarqueEm) }} → {{ hora(d.chegadaEm) }} ·
                  {{ minutos(d.tempoTrajetoMin) }}</span
                >
                @if (d.passos.length) {
                  <button
                    type="button"
                    class="rs-botao rs-botao--pequeno"
                    [attr.aria-expanded]="diaNoMapa() === d.data"
                    [attr.aria-label]="'Ver no mapa onde embarcou e chegou em ' + dataCurta(d.data)"
                    (click)="alternarMapa(d.data)"
                  >
                    <rs-icone nome="mapa" [tamanho]="14" />
                    Mapa
                  </button>
                }
              </li>
              @if (diaNoMapa() === d.data) {
                <li class="no-mapa">
                  <rs-mapa-jornada [alunoId]="alunoId()" [data]="d.data" />
                </li>
              }
            }
          </ul>
        </rs-chart-card>

        <rs-chart-card
          id="responsaveis"
          titulo="Responsáveis"
          [estado]="perfil.estado()"
          (tentarDeNovo)="perfil.recarregar()"
        >
          @if (perfil.dados(); as p) {
            @if (!p.situacaoResponsaveis.pronto) {
              <p class="rs-aviso">
                O índice de responsáveis ainda está sendo montado; a lista pode estar incompleta.
              </p>
            }
            <ul class="rs-lista">
              @for (r of p.responsaveis; track r.id) {
                <li>
                  <span class="quem">{{ r.nome || 'Responsável #' + r.id }}</span>
                  <span class="rs-mono">{{ r.contatoMascarado || 'contato não informado' }}</span>
                  <button
                    type="button"
                    class="rs-botao rs-botao--pequeno"
                    [disabled]="!r.contatoDisponivel || !podeRevelar()"
                    [title]="
                      !r.contatoDisponivel
                        ? 'A fonte de dados não fornece contato do responsável'
                        : !podeRevelar()
                          ? 'Seu perfil não pode revelar contatos'
                          : 'Revelar (fica registrado na auditoria)'
                    "
                  >
                    Revelar contato
                  </button>
                </li>
              } @empty {
                <li class="rs-nota">Nenhum responsável vinculado.</li>
              }
            </ul>
          }
        </rs-chart-card>
      </div>
    </div>
  `,
  styles: `
    .voltar {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      align-self: flex-start;
      font-weight: 600;
      text-decoration: none;
    }
    .cabecalho {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }
    .cabecalho > div {
      flex: 1;
    }
    h1 {
      font-size: 20px;
    }
    .foto {
      display: grid;
      place-items: center;
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: var(--info-fundo);
      color: var(--info);
      font-size: 24px;
      font-weight: 700;
    }
    .mapa-calor {
      display: grid;
      grid-template-columns: repeat(auto-fill, 16px);
      gap: 3px;
    }
    .dia {
      display: inline-block;
      width: 16px;
      height: 16px;
      border-radius: 3px;
      background: var(--neutro-fundo);
      vertical-align: middle;
    }
    .dia--NA_ESCOLA {
      background: var(--sucesso);
    }
    .dia--AUSENTE {
      background: var(--atencao);
    }
    .dia--DIVERGENTE {
      background: var(--critico);
    }
    .dia--EMBARCADO {
      background: var(--info);
    }
    .legenda .dia {
      width: 10px;
      height: 10px;
      margin-left: 8px;
    }
    .no-mapa {
      display: block;
    }
    .quem {
      flex: 1;
    }
  `,
})
export class PerfilAluno {
  private readonly api = inject(PainelApi);
  private readonly auth = inject(AuthService);

  readonly id = input.required<string>();

  protected readonly jornada = JORNADA;
  protected readonly hora = hora;
  protected readonly minutos = minutos;
  protected readonly dataCurta = dataCurta;
  private readonly hoje = isoLocal(new Date());

  protected readonly podeRevelar = computed(() => this.auth.usuario()?.podeRevelarContato === true);
  protected readonly alunoId = computed(() => Number(this.id()));
  /** Dia do histórico com o mapa aberto (um por vez: cada abertura é uma consulta auditada). */
  protected readonly diaNoMapa = signal<string | null>(null);

  protected alternarMapa(data: string): void {
    this.diaNoMapa.update((atual) => (atual === data ? null : data));
  }

  protected readonly perfil = carga(() => this.api.perfilAluno(this.alunoId()));
  protected readonly historico = carga(
    () => {
      const id = this.alunoId();
      const janelas = janelasDeHistorico(new Date(), DIAS_CORRIDOS);
      return forkJoin(janelas.map((j) => this.api.jornadasDoAluno(id, j.inicio, j.fim))).pipe(
        map((partes) => ultimosDias(partes.flat(), DIAS_LETIVOS)),
      );
    },
    { vazio: (d) => d.length === 0, desatualizado: () => false },
  );

  protected readonly dias = computed<JornadaDoDia[]>(() => this.historico.dados() ?? []);
  protected readonly recentes = computed(() => [...this.dias()].reverse().slice(0, 15));
  protected readonly risco = computed(() =>
    this.dias().length ? avaliarRisco(this.dias(), this.hoje) : null,
  );
  protected readonly tomRisco = computed(() => {
    const n = this.risco()?.nivel;
    return n === 'alto'
      ? 'critico'
      : n === 'medio'
        ? 'atencao'
        : n === 'baixo'
          ? 'sucesso'
          : 'neutro';
  });
  protected readonly kpis = computed(() => {
    const d = this.dias().filter((x) => x.data < this.hoje);
    if (d.length === 0) {
      return null;
    }
    const presentes = d.filter((x) => x.estado === 'NA_ESCOLA').length;
    const tempos = d.map((x) => x.tempoTrajetoMin).filter((t): t is number => t !== null);
    return {
      frequencia: percentual(Math.round((presentes / d.length) * 1000) / 10),
      faltas: d.length - presentes,
      trajeto: tempos.length
        ? minutos(Math.round(tempos.reduce((s, t) => s + t, 0) / tempos.length))
        : null,
    };
  });
}
