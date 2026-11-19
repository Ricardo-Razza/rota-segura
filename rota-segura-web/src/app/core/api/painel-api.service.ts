import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API } from '../auth/auth.models';
import { SEM_TOAST_DE_ERRO } from '../auth/erro.interceptor';
import {
  Agendamento,
  AnaliseFrequencia,
  AnaliseFrota,
  AnaliseMatriculas,
  Alerta,
  DetalheVeiculo,
  IndicadoresSensiveis,
  JornadaDoDia,
  ListaDeAlertas,
  ListaDeAlunos,
  OpcoesDeFiltro,
  Pendencias,
  PerfilAluno,
  PresencaHoje,
  PresencaPeriodo,
  PreviaRelatorio,
  QuadroDoDia,
  RastreamentoAoVivo,
  ResultadoSincronizacao,
  ResumoAlertas,
  ResumoDashboard,
  SaudeDosLeitores,
  StatusAlerta,
  StatusDosVeiculos,
  TipoPendencia,
  TipoRelatorio,
} from './modelos';

export type Parametros = Record<string, string | number | null | undefined>;

/** Leituras dos cards: o próprio card mostra o erro com "tentar de novo", então sem toast. */
const LEITURA = { context: new HttpContext().set(SEM_TOAST_DE_ERRO, true) };

function params(valores: Parametros): HttpParams {
  let saida = new HttpParams();
  for (const [chave, valor] of Object.entries(valores)) {
    if (valor !== null && valor !== undefined && valor !== '') {
      saida = saida.set(chave, String(valor));
    }
  }
  return saida;
}

/**
 * Cliente do backend do painel. Na URL vão só ids, datas e enums (nunca nome ou outro dado pessoal):
 * a busca por nome vai no corpo de um POST.
 */
@Injectable({ providedIn: 'root' })
export class PainelApi {
  private readonly http = inject(HttpClient);

  // ----- Jornada e presença
  jornadas(filtros: Parametros): Observable<QuadroDoDia> {
    return this.http.get<QuadroDoDia>(`${API}/jornadas`, { ...LEITURA, params: params(filtros) });
  }

  jornadasDoAluno(id: number, inicio: string, fim: string): Observable<JornadaDoDia[]> {
    return this.http.get<JornadaDoDia[]>(`${API}/alunos/${id}/jornadas`, {
      ...LEITURA,
      params: params({ inicio, fim }),
    });
  }

  presencaHoje(filtros: Parametros): Observable<PresencaHoje> {
    return this.http.get<PresencaHoje>(`${API}/presenca/hoje`, {
      ...LEITURA,
      params: params(filtros),
    });
  }

  presencaPeriodo(filtros: Parametros): Observable<PresencaPeriodo> {
    return this.http.get<PresencaPeriodo>(`${API}/presenca/periodo`, {
      ...LEITURA,
      params: params(filtros),
    });
  }

  // ----- Veículos e leitores
  veiculos(filtros: Parametros): Observable<StatusDosVeiculos> {
    return this.http.get<StatusDosVeiculos>(`${API}/veiculos/status`, {
      ...LEITURA,
      params: params(filtros),
    });
  }

  veiculo(id: number): Observable<DetalheVeiculo> {
    return this.http.get<DetalheVeiculo>(`${API}/veiculos/${id}`, LEITURA);
  }

  /** GPS ao vivo (posição, rastro do dia e cerca); depois disso chega pelo evento SSE `veiculo.posicao`. */
  rastreamento(): Observable<RastreamentoAoVivo> {
    return this.http.get<RastreamentoAoVivo>(`${API}/veiculos/rastreamento`, LEITURA);
  }

  leitores(filtros: Parametros): Observable<SaudeDosLeitores> {
    return this.http.get<SaudeDosLeitores>(`${API}/dispositivos/saude`, {
      ...LEITURA,
      params: params(filtros),
    });
  }

  // ----- Alertas
  alertas(filtros: Parametros): Observable<ListaDeAlertas> {
    return this.http.get<ListaDeAlertas>(`${API}/alertas`, { ...LEITURA, params: params(filtros) });
  }

  resumoAlertas(): Observable<ResumoAlertas> {
    return this.http.get<ResumoAlertas>(`${API}/alertas/resumo`, LEITURA);
  }

  /** Ações mostram o erro em toast (sem contexto silencioso). */
  alterarAlerta(id: number, status: StatusAlerta, comentario: string | null): Observable<Alerta> {
    return this.http.patch<Alerta>(`${API}/alertas/${id}`, { status, comentario });
  }

  // ----- Dashboard
  dashboard(filtros: Parametros): Observable<ResumoDashboard> {
    return this.http.get<ResumoDashboard>(`${API}/dashboard/resumo`, {
      ...LEITURA,
      params: params(filtros),
    });
  }

  sensiveis(): Observable<IndicadoresSensiveis> {
    return this.http.get<IndicadoresSensiveis>(`${API}/dashboard/sensiveis`, LEITURA);
  }

  // ----- Alunos
  alunos(filtros: Parametros): Observable<ListaDeAlunos> {
    return this.http.get<ListaDeAlunos>(`${API}/alunos`, { ...LEITURA, params: params(filtros) });
  }

  /** Busca por nome: o termo vai no corpo, nunca na URL. */
  buscarAlunos(termo: string, filtros: Parametros): Observable<ListaDeAlunos> {
    return this.http.post<ListaDeAlunos>(`${API}/alunos/busca`, { ...filtros, termo }, LEITURA);
  }

  perfilAluno(id: number): Observable<PerfilAluno> {
    return this.http.get<PerfilAluno>(`${API}/alunos/${id}/perfil`, LEITURA);
  }

  pendencias(filtros: Parametros & { tipo?: TipoPendencia | null }): Observable<Pendencias> {
    return this.http.get<Pendencias>(`${API}/cadastro/pendencias`, {
      ...LEITURA,
      params: params(filtros),
    });
  }

  opcoesDeFiltro(anoLetivo: number | null): Observable<OpcoesDeFiltro> {
    return this.http.get<OpcoesDeFiltro>(`${API}/cadastro/opcoes-filtro`, {
      ...LEITURA,
      params: params({ anoLetivo }),
    });
  }

  sincronizarAlunos(): Observable<ResultadoSincronizacao> {
    return this.http.post<ResultadoSincronizacao>(`${API}/alunos/sincronizar`, null);
  }

  ultimaSincronizacao(): Observable<ResultadoSincronizacao | null> {
    return this.http.get<ResultadoSincronizacao | null>(
      `${API}/alunos/sincronizacao/ultima`,
      LEITURA,
    );
  }

  // ----- Relatórios
  previaRelatorio(tipo: TipoRelatorio, filtros: Parametros): Observable<PreviaRelatorio> {
    return this.http.post<PreviaRelatorio>(
      `${API}/relatorios/previa`,
      { ...filtros, tipo },
      LEITURA,
    );
  }

  /** Baixa o arquivo com o token no cabeçalho (o link direto não levaria a autenticação). */
  exportar(tipo: TipoRelatorio, formato: 'csv' | 'pdf', filtros: Parametros): Observable<Blob> {
    const recurso = tipo === 'VEICULOS' ? 'veiculos' : 'frequencia';
    return this.http.get(`${API}/relatorios/${recurso}.${formato}`, {
      params: params(filtros),
      responseType: 'blob',
    });
  }

  agendados(): Observable<Agendamento[]> {
    return this.http.get<Agendamento[]>(`${API}/relatorios/agendados`, LEITURA);
  }

  agendar(
    tipo: TipoRelatorio,
    escolaId: number | null,
    diaSemana: string,
  ): Observable<Agendamento> {
    return this.http.post<Agendamento>(`${API}/relatorios/agendados`, {
      tipo,
      escolaId,
      diaSemana,
    });
  }

  cancelarAgendamento(id: number): Observable<void> {
    return this.http.delete<void>(`${API}/relatorios/agendados/${id}`);
  }

  // ----- Análises (filtros só com ids, datas e enums)
  analiseFrequencia(filtros: Parametros): Observable<AnaliseFrequencia> {
    return this.http.get<AnaliseFrequencia>(`${API}/analises/frequencia`, {
      ...LEITURA,
      params: params(filtros),
    });
  }

  analiseMatriculas(filtros: Parametros): Observable<AnaliseMatriculas> {
    return this.http.get<AnaliseMatriculas>(`${API}/analises/matriculas`, {
      ...LEITURA,
      params: params(filtros),
    });
  }

  analiseFrota(filtros: Parametros): Observable<AnaliseFrota> {
    return this.http.get<AnaliseFrota>(`${API}/analises/frota`, {
      ...LEITURA,
      params: params(filtros),
    });
  }
}
