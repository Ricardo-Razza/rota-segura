import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { auditTime, merge } from 'rxjs';
import { carga } from '../../core/api/carga';
import { FrequenciaEscola } from '../../core/api/modelos';
import { PainelApi } from '../../core/api/painel-api.service';
import { FiltrosStore } from '../../core/filtros/filtros.store';
import { SseService } from '../../core/sse/sse.service';
import { dataCurta, isoLocal, percentual } from '../../shared/formato';
import { Anel } from '../../shared/ui/anel';
import { ChartCard } from '../../shared/ui/chart-card';
import { Icone } from '../../shared/ui/icone';
import { MapaVeiculos } from '../veiculos/mapa-veiculos';
import {
  contarFaixas,
  diasEmQueda,
  nomeEscola,
  ordenarPorPresenca,
  pontosDeEscolas,
  tomDaFaixa,
  ultimosDias,
} from './escolas.logica';

type FiltroFaixa = 'TODAS' | 'CRITICO' | 'ATENCAO' | 'OK';

const ROTULO_FAIXA = { CRITICO: 'Crítico', ATENCAO: 'Atenção', OK: 'Bem' } as const;

/**
 * Escolas da rede ordenadas pela presença de hoje, no mapa e com o detalhe da escola escolhida.
 * Só lê endpoints existentes do painel (nenhuma chamada nova à API externa).
 */
@Component({
  selector: 'rs-escolas',
  imports: [ChartCard, MapaVeiculos, Anel, Icone, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="rs-somente-leitor">Escolas</h1>
    <div class="tela">
      <section class="lista rs-vidro" aria-labelledby="titulo-lista">
        <header>
          <h2 id="titulo-lista">
            {{ escolas().length }} {{ escolas().length === 1 ? 'escola' : 'escolas' }}
          </h2>
          <p class="rs-nota">Ordenadas pela presença de hoje</p>
        </header>
        <div class="faixas" role="group" aria-label="Filtrar por faixa de presença">
          <button
            type="button"
            [attr.aria-pressed]="faixa() === 'TODAS'"
            (click)="faixa.set('TODAS')"
          >
            Todas
          </button>
          @for (f of faixasComContagem(); track f.valor) {
            <button
              type="button"
              [class]="'faixa faixa--' + f.tom"
              [attr.aria-pressed]="faixa() === f.valor"
              [attr.aria-label]="f.rotulo + ': ' + f.total"
              (click)="faixa.set(f.valor)"
            >
              <span class="ponto" aria-hidden="true"></span>{{ f.total }}
            </button>
          }
        </div>
        <label class="busca">
          <rs-icone nome="busca" [tamanho]="16" />
          <span class="rs-somente-leitor">Buscar escola</span>
          <input
            type="search"
            placeholder="Buscar escola"
            [value]="termo()"
            (input)="termo.set($any($event.target).value)"
          />
        </label>

        @switch (resumo.estado()) {
          @case ('carregando') {
            <p class="rs-nota" role="status">Carregando escolas…</p>
          }
          @case ('erro') {
            <div class="rs-nota" role="alert">
              Não foi possível carregar as escolas.
              <button
                type="button"
                class="rs-botao rs-botao--pequeno"
                (click)="resumo.recarregar()"
              >
                Tentar de novo
              </button>
            </div>
          }
          @default {
            @if (resumo.estado() === 'desatualizado') {
              <p class="rs-aviso">Dados desatualizados.</p>
            }
            <ul class="itens">
              @for (e of visiveis(); track e.escolaId) {
                <li>
                  <button
                    type="button"
                    class="item"
                    [class.item--ativo]="e.escolaId === selecionadaId()"
                    [attr.aria-pressed]="e.escolaId === selecionadaId()"
                    (click)="escolher(e.escolaId)"
                  >
                    <span [class]="'ponto ponto--' + tom(e)" aria-hidden="true"></span>
                    <span class="nome">{{ nome(e) }}</span>
                    <span class="barra" aria-hidden="true"
                      ><span
                        [class]="'barra__valor barra__valor--' + tom(e)"
                        [style.width.%]="e.frequencia ?? 0"
                      ></span
                    ></span>
                    <span [class]="'pct rs-mono txt--' + tom(e)">{{ pct(e.frequencia) }}</span>
                  </button>
                </li>
              } @empty {
                <li class="rs-nota">Nenhuma escola com esses filtros.</li>
              }
            </ul>
          }
        }
      </section>

      <div class="mapa rs-vidro">
        <rs-mapa-veiculos
          [veiculos]="[]"
          [escolas]="pontos()"
          [escolaSelecionadaId]="selecionadaId()"
          (selecionarEscola)="escolher($event)"
          altura="100%"
          [legenda]="false"
        />
        @if (veiculos.dados() && pontos().length === 0) {
          <p class="sem-mapa rs-nota">Nenhuma escola com coordenada no cadastro dos leitores.</p>
        }
      </div>

      <section class="detalhe" aria-live="polite">
        @if (selecionada(); as e) {
          <rs-chart-card
            [titulo]="nome(e)"
            [estado]="hoje.estado()"
            [atualizadoEm]="hoje.atualizadoEm()"
            (tentarDeNovo)="hoje.recarregar()"
          >
            <span acoes [class]="'selo selo--' + tom(e)">{{ rotuloFaixa(e) }}</span>
            @if (hoje.dados(); as h) {
              <p class="rs-nota sub">
                {{ h.contagem.esperados }} alunos esperados hoje · {{ onibusDaEscola() }} ônibus
              </p>
              <div class="numeros">
                <rs-anel
                  [valor]="h.contagem.frequencia"
                  [tom]="tom(e)"
                  [tamanho]="116"
                  rotulo="Presença de hoje"
                />
                <dl>
                  <div>
                    <dt class="rs-mono txt--sucesso">{{ h.contagem.naEscola }}</dt>
                    <dd>na escola</dd>
                  </div>
                  <div>
                    <dt class="rs-mono txt--info">{{ h.contagem.embarcados }}</dt>
                    <dd>a caminho</dd>
                  </div>
                  <div>
                    <dt class="rs-mono txt--critico">
                      {{ h.contagem.aguardando + h.contagem.ausentes }}
                    </dt>
                    <dd>não embarcaram</dd>
                  </div>
                </dl>
              </div>

              <h3>
                {{
                  dias().length === 1
                    ? 'Último dia letivo'
                    : 'Últimos ' + dias().length + ' dias letivos'
                }}
              </h3>
              @if (dias().length) {
                <ol class="dias" aria-label="Presença nos últimos dias letivos">
                  @for (d of dias(); track d.data; let ultimo = $last) {
                    <li
                      [class.dias__hoje]="ultimo"
                      [style.--altura.%]="d.frequencia ?? 0"
                      [attr.title]="dataCurta(d.data) + ': ' + pct(d.frequencia)"
                    >
                      <span class="rs-somente-leitor"
                        >{{ dataCurta(d.data) }}: {{ pct(d.frequencia) }}</span
                      >
                    </li>
                  }
                </ol>
                @if (queda() >= 2) {
                  <p class="txt--atencao alerta-queda">
                    Presença caindo há {{ queda() }} dias letivos
                  </p>
                }
              } @else {
                <p class="rs-nota">{{ periodo.carregando() ? 'Carregando…' : 'Sem histórico.' }}</p>
              }

              <div class="botoes">
                <a
                  class="rs-botao rs-botao--primario"
                  routerLink="/presenca"
                  [queryParams]="{ escolaId: e.escolaId }"
                  queryParamsHandling="merge"
                  >Ver alunos ausentes</a
                >
                <a
                  class="rs-botao"
                  routerLink="/veiculos"
                  [queryParams]="{ escolaId: e.escolaId }"
                  queryParamsHandling="merge"
                  ><rs-icone nome="onibus" [tamanho]="16" /> Ônibus</a
                >
              </div>
            }
          </rs-chart-card>
        }
      </section>
    </div>
  `,
  styles: `
    .tela {
      display: grid;
      grid-template-columns: minmax(280px, 340px) 1fr minmax(320px, 400px);
      grid-template-areas: 'lista mapa detalhe';
      gap: 16px;
      /* isolation: o aviso sobre o mapa (z-index 500) não passa por cima da barra do topo nem do menu
         da conta. --rs-reservado: espaço do topo, filtros ativos e margens, medido pelo shell. */
      isolation: isolate;
      height: calc(100dvh - var(--rs-reservado, 130px));
      min-height: 560px;
    }
    .lista {
      grid-area: lista;
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-height: 0;
      padding: 20px;
    }
    .lista h2 {
      font-size: 24px;
      font-weight: 800;
    }
    .faixas {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .faixas button {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 32px;
      padding: 4px 12px;
      border: 1px solid var(--vidro-borda);
      border-radius: 999px;
      background: none;
      color: var(--texto-suave);
      font-weight: 700;
      cursor: pointer;
    }
    .faixas button[aria-pressed='true'] {
      background: var(--realce);
      color: var(--texto-sobre-realce);
    }
    .busca {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 12px;
      min-height: 44px;
      border: 1px solid var(--vidro-borda);
      border-radius: 12px;
      color: var(--texto-mudo);
    }
    .busca input {
      flex: 1;
      min-width: 0;
      border: 0;
      background: none;
      outline: none;
    }
    .busca:focus-within {
      border-color: var(--foco);
    }
    .itens {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      margin: 0 -8px;
      padding: 0 8px;
      list-style: none;
    }
    .item {
      display: grid;
      grid-template-columns: 10px 1fr 56px 44px;
      align-items: center;
      gap: 10px;
      width: 100%;
      min-height: 48px;
      padding: 8px 12px;
      border: 1px solid transparent;
      border-radius: 12px;
      background: none;
      text-align: left;
      cursor: pointer;
    }
    .item:hover {
      background: var(--neutro-fundo);
    }
    .item--ativo {
      border-color: var(--borda-forte);
      background: var(--neutro-fundo);
    }
    .nome {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: 700;
    }
    .ponto {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: currentColor;
    }
    .ponto--sucesso,
    .faixas .faixa--sucesso {
      color: var(--sucesso);
    }
    .ponto--atencao,
    .faixas .faixa--atencao {
      color: var(--atencao-texto);
    }
    .ponto--critico,
    .faixas .faixa--critico {
      color: var(--critico);
    }
    .ponto--neutro {
      color: var(--texto-mudo);
    }
    .barra {
      height: 6px;
      border-radius: 3px;
      background: var(--vidro-borda);
      overflow: hidden;
    }
    .barra__valor {
      display: block;
      height: 100%;
      border-radius: 3px;
    }
    .barra__valor--sucesso {
      background: var(--sucesso);
    }
    .barra__valor--atencao {
      background: var(--atencao);
    }
    .barra__valor--critico {
      background: var(--critico);
    }
    .pct {
      text-align: right;
      font-weight: 700;
    }
    .txt--sucesso {
      color: var(--sucesso);
    }
    .txt--atencao {
      color: var(--atencao-texto);
    }
    .txt--critico {
      color: var(--critico);
    }
    .txt--info {
      color: var(--info);
    }
    .txt--neutro {
      color: var(--texto-mudo);
    }
    .mapa {
      grid-area: mapa;
      position: relative;
      overflow: hidden;
      padding: 0;
    }
    .mapa rs-mapa-veiculos {
      height: 100%;
    }
    .sem-mapa {
      position: absolute;
      inset: auto 16px 16px;
      z-index: 500;
      padding: 10px 14px;
      border-radius: 12px;
      background: var(--vidro-forte);
    }
    .detalhe {
      grid-area: detalhe;
      min-height: 0;
      overflow-y: auto;
    }
    .detalhe rs-chart-card {
      height: auto;
    }
    .selo {
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .selo--sucesso {
      background: var(--sucesso-fundo);
      color: var(--sucesso);
    }
    .selo--atencao {
      background: var(--atencao-fundo);
      color: var(--atencao-texto);
    }
    .selo--critico {
      background: var(--critico-fundo);
      color: var(--critico);
    }
    .selo--neutro {
      background: var(--neutro-fundo);
      color: var(--texto-suave);
    }
    .sub {
      margin-top: -4px;
    }
    .numeros {
      display: flex;
      align-items: center;
      gap: 20px;
      margin: 14px 0 18px;
    }
    dl {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin: 0;
    }
    dl div {
      display: flex;
      align-items: baseline;
      gap: 6px;
    }
    dt {
      font-size: 20px;
      font-weight: 700;
    }
    dd {
      margin: 0;
      color: var(--texto-suave);
    }
    h3 {
      margin-bottom: 10px;
      font-size: 14px;
    }
    .dias {
      display: flex;
      align-items: flex-end;
      gap: 6px;
      height: 72px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .dias li {
      flex: 1;
      max-width: 36px;
      height: max(8%, var(--altura));
      border-radius: 6px 6px 3px 3px;
      background: var(--superficie-muda);
    }
    .dias .dias__hoje {
      background: var(--info);
    }
    .alerta-queda {
      margin: 8px 0 0;
      font-weight: 700;
      font-size: 13px;
    }
    .botoes {
      display: flex;
      gap: 10px;
      margin-top: 18px;
    }
    .botoes .rs-botao {
      justify-content: center;
      min-height: 44px;
      text-decoration: none;
    }
    .botoes .rs-botao--primario {
      flex: 1;
    }

    @media (max-width: 1180px) {
      .tela {
        grid-template-columns: minmax(260px, 320px) 1fr;
        /* O mapa garante 320px; o detalhe da escola usa o resto e rola por dentro (não esmaga o mapa). */
        grid-template-rows: minmax(320px, 3fr) minmax(0, 2fr);
        grid-template-areas:
          'lista mapa'
          'lista detalhe';
      }
    }
    @media (max-width: 760px) {
      .tela {
        display: flex;
        flex-direction: column;
        height: auto;
        min-height: 0;
      }
      .detalhe {
        order: -1;
        overflow: visible;
      }
      .mapa {
        height: 260px;
      }
      .itens {
        max-height: 60dvh;
      }
    }
  `,
})
export class Escolas {
  private readonly api = inject(PainelApi);
  private readonly filtros = inject(FiltrosStore);

  /** Escola aberta, vinda da URL (?escola=ID) para o link poder ser compartilhado. */
  readonly escola = input<string | undefined>();

  protected readonly dataCurta = dataCurta;
  protected readonly termo = signal('');
  protected readonly faixa = signal<FiltroFaixa>('TODAS');
  private readonly escolhida = signal<number | null>(null);

  protected readonly resumo = carga(() => this.api.dashboard(this.filtros.parametros()), {
    vazio: (r) => r.frequenciaHojePorEscola.length === 0,
  });
  protected readonly veiculos = carga(() => this.api.veiculos(this.filtros.parametros()));

  protected readonly escolas = computed(() =>
    ordenarPorPresenca(this.resumo.dados()?.frequenciaHojePorEscola ?? []),
  );
  protected readonly faixasComContagem = computed(() => {
    const c = contarFaixas(this.escolas());
    return [
      { valor: 'CRITICO' as const, rotulo: 'Crítico', tom: 'critico', total: c.critico },
      { valor: 'ATENCAO' as const, rotulo: 'Atenção', tom: 'atencao', total: c.atencao },
      { valor: 'OK' as const, rotulo: 'Bem', tom: 'sucesso', total: c.ok },
    ];
  });
  protected readonly visiveis = computed(() => {
    const t = this.termo().normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
    const f = this.faixa();
    return this.escolas().filter(
      (e) =>
        (f === 'TODAS' || e.faixa === f) &&
        (!t || nomeEscola(e).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().includes(t)),
    );
  });
  protected readonly pontos = computed(() =>
    pontosDeEscolas(this.veiculos.dados()?.veiculos ?? [], this.escolas()),
  );

  /** Escolhida pelo usuário, senão a da URL, senão a de menor presença (quem mais precisa). */
  protected readonly selecionadaId = computed(() => {
    const manual = this.escolhida();
    if (manual !== null) {
      return manual;
    }
    const daUrl = Number(this.escola());
    if (Number.isInteger(daUrl) && this.escolas().some((e) => e.escolaId === daUrl)) {
      return daUrl;
    }
    return this.escolas()[0]?.escolaId ?? null;
  });
  protected readonly selecionada = computed(
    () => this.escolas().find((e) => e.escolaId === this.selecionadaId()) ?? null,
  );
  protected readonly onibusDaEscola = computed(
    () =>
      (this.veiculos.dados()?.veiculos ?? []).filter((v) => v.escolaId === this.selecionadaId())
        .length,
  );

  protected readonly hoje = carga(() => {
    const id = this.selecionadaId();
    return id === null
      ? null
      : this.api.presencaHoje({ ...this.filtros.parametros(), escolaId: String(id), tamanho: 1 });
  });
  protected readonly periodo = carga(() => {
    const id = this.selecionadaId();
    if (id === null) {
      return null;
    }
    const fim = new Date();
    const inicio = new Date(fim);
    inicio.setDate(inicio.getDate() - 20);
    return this.api.presencaPeriodo({
      ...this.filtros.parametros(),
      escolaId: String(id),
      dataInicio: isoLocal(inicio),
      dataFim: isoLocal(fim),
    });
  });
  protected readonly dias = computed(() => ultimosDias(this.periodo.dados()?.dias ?? []));
  protected readonly queda = computed(() => diasEmQueda(this.dias()));

  constructor() {
    const sse = inject(SseService);
    merge(sse.de('presenca.atualizada'), sse.de('jornada.atualizada'))
      .pipe(auditTime(5000), takeUntilDestroyed())
      .subscribe(() => {
        this.resumo.recarregar(true);
        this.hoje.recarregar(true);
      });
  }

  protected escolher(id: number): void {
    this.escolhida.set(id);
  }

  protected nome(e: FrequenciaEscola): string {
    return nomeEscola(e);
  }

  protected tom(e: FrequenciaEscola) {
    return tomDaFaixa(e.faixa);
  }

  protected rotuloFaixa(e: FrequenciaEscola): string {
    return e.faixa ? ROTULO_FAIXA[e.faixa] : 'Sem dado';
  }

  protected pct(v: number | null): string {
    return percentual(v, 0);
  }
}
