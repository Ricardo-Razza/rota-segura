import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin, map } from 'rxjs';
import { carga } from '../../core/api/carga';
import { JornadaDoDia } from '../../core/api/modelos';
import { PainelApi } from '../../core/api/painel-api.service';
import { AuthService } from '../../core/auth/auth.service';
import { isoLocal, minutos, percentual } from '../../shared/formato';
import { ChartCard } from '../../shared/ui/chart-card';
import { Icone } from '../../shared/ui/icone';
import { KpiCard } from '../../shared/ui/kpi-card';
import { StatusBadge } from '../../shared/ui/status-badge';
import { JORNADA } from '../../shared/ui/tom';
import { avaliarRisco, janelasDeHistorico, ultimosDias } from './alunos.logica';
import { CalendarioHistorico } from './calendario-historico';

/** 90 dias letivos cabem em ~140 dias corridos (fins de semana e feriados). */
const DIAS_CORRIDOS = 140;
const DIAS_LETIVOS = 90;

/** Perfil do aluno (acesso auditado no backend). Foto só por URL assinada; aqui, placeholder com iniciais. */
@Component({
  selector: 'rs-perfil-aluno',
  imports: [Icone, ChartCard, KpiCard, StatusBadge, RouterLink, CalendarioHistorico],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rs-pagina">
      @if (perfil.dados(); as p) {
        <section class="cabecalho" aria-label="Perfil do aluno">
          <a
            class="voltar"
            routerLink="/alunos"
            queryParamsHandling="preserve"
            aria-label="Voltar para Alunos"
            ><rs-icone nome="esq" [tamanho]="18"
          /></a>
          <span
            class="foto"
            role="img"
            [attr.aria-label]="'Sem foto: iniciais ' + (p.aluno.iniciais || '')"
            >{{ p.aluno.iniciais || '?' }}</span
          >
          <div class="dados">
            <h1>{{ p.aluno.nome || 'Aluno #' + p.aluno.id }}</h1>
            <p class="rs-nota">
              {{ p.aluno.turma || 'Sem turma' }} · {{ p.aluno.anoEscolar || '—' }} ·
              {{ p.aluno.turno || '—' }} · {{ p.aluno.escolaNome || 'Escola não informada' }} |
              Veículo
              {{ p.aluno.veiculoId ? '#' + p.aluno.veiculoId : 'não informado no cadastro' }} |
              Biometria
              {{ p.aluno.biometria === null ? '—' : p.aluno.biometria ? 'cadastrada' : 'pendente' }}
            </p>
          </div>
          @if (perfil.estado() === 'desatualizado') {
            <span class="rs-aviso" role="status">Dados desatualizados</span>
          }
          @if (p.jornadaHoje; as j) {
            <rs-status-badge
              [texto]="'Hoje: ' + jornada[j.estado].rotulo"
              [tom]="jornada[j.estado].tom"
            />
          }
        </section>
      } @else {
        <a class="voltar voltar--texto" routerLink="/alunos" queryParamsHandling="preserve"
          ><rs-icone nome="esq" [tamanho]="16" /> Alunos</a
        >
        <rs-chart-card
          titulo="Perfil do aluno"
          [estado]="perfil.estado()"
          [atualizadoEm]="perfil.atualizadoEm()"
          (tentarDeNovo)="perfil.recarregar()"
        />
      }

      <div class="rs-grade rs-grade--kpi">
        <rs-kpi-card
          class="compacto"
          rotulo="Frequência (90 dias letivos)"
          [valor]="kpis()?.frequencia ?? null"
          [carregando]="historico.carregando()"
        />
        <rs-kpi-card
          class="compacto"
          rotulo="Faltas"
          tom="atencao"
          [valor]="kpis()?.faltas ?? null"
          [carregando]="historico.carregando()"
        />
        <rs-kpi-card
          class="compacto"
          rotulo="Tempo médio de trajeto"
          tom="info"
          [valor]="kpis()?.trajeto ?? null"
          [carregando]="historico.carregando()"
        />
        <rs-kpi-card
          class="compacto"
          rotulo="Risco"
          [tom]="tomRisco()"
          [valor]="risco()?.nivel ?? null"
          [detalhe]="risco()?.motivos?.join(' · ') ?? ''"
          [carregando]="historico.carregando()"
        />
      </div>
      @if (historico.estado() === 'erro') {
        <p class="rs-aviso" role="alert">
          Não foi possível calcular os indicadores.
          <button type="button" class="rs-botao rs-botao--pequeno" (click)="historico.recarregar()">
            Tentar de novo
          </button>
        </p>
      }

      <rs-calendario-historico [alunoId]="alunoId()" />

      <rs-chart-card
        class="baixo"
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
  `,
  styles: `
    .cabecalho {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 14px;
      padding: 12px 18px;
      border: 1px solid var(--vidro-borda);
      border-radius: var(--raio-vidro);
      background: var(--vidro);
      box-shadow: var(--vidro-sombra);
    }
    .voltar {
      display: grid;
      place-items: center;
      width: 34px;
      height: 34px;
      border: 1px solid var(--borda-forte);
      border-radius: var(--raio-sm);
      background: var(--superficie-2);
    }
    .voltar--texto {
      display: inline-flex;
      gap: 4px;
      align-self: flex-start;
      width: auto;
      padding: 0 10px;
      font-weight: 600;
      text-decoration: none;
    }
    .dados {
      flex: 1;
      min-width: 220px;
    }
    h1 {
      font-size: 18px;
    }
    .foto {
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: var(--info-fundo);
      color: var(--info);
      font-size: 16px;
      font-weight: 700;
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
  private readonly hoje = isoLocal(new Date());

  protected readonly podeRevelar = computed(() => this.auth.usuario()?.podeRevelarContato === true);
  protected readonly alunoId = computed(() => Number(this.id()));

  protected readonly perfil = carga(() => this.api.perfilAluno(this.alunoId()));
  /** Base dos indicadores do topo: sempre os últimos 90 dias letivos, seja qual for o ano do calendário. */
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
