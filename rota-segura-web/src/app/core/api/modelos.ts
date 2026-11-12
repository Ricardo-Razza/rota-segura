/**
 * Formatos das respostas do backend (/api/v1). Espelham os records Java; nenhum campo inventado.
 * Datas chegam como texto ISO (LocalDate "aaaa-mm-dd", LocalDateTime sem fuso, Instant com "Z").
 */
import { EstadoJornada } from '../../shared/ui/tom';

export type { EstadoJornada };

export interface Pagina<T> {
  itens: T[];
  pagina: number;
  tamanho: number;
  total: number;
  totalPaginas: number;
}

export type TipoLeitor = 'EMBARQUE' | 'CHEGADA';
export type TipoDivergencia =
  | 'EMBARCOU_SEM_CHEGADA'
  | 'CHEGOU_SEM_EMBARQUE'
  | 'VEICULO_DIFERENTE_DO_CADASTRO'
  | 'EMBARQUE_DUPLICADO';
export type Severidade = 'CRITICO' | 'ATENCAO' | 'INFO';

export interface AlunoResumo {
  id: number;
  nome: string | null;
  iniciais: string | null;
  turmaId: number | null;
  turma: string | null;
  anoEscolar: string | null;
  turno: string | null;
  anoLetivo: number | null;
  escolaNome: string | null;
  escolaId: number | null;
  veiculoId: number | null;
  biometria: boolean | null;
}

export interface Divergencia {
  tipo: TipoDivergencia;
  detectadaEm: string;
}

export interface Passo {
  dataHora: string;
  tipo: TipoLeitor;
  leitorId: number;
  veiculoId: number | null;
  escolaId: number | null;
  estadoResultante: EstadoJornada;
}

export interface JornadaDoDia {
  alunoId: number;
  data: string;
  estado: EstadoJornada;
  embarqueEm: string | null;
  veiculoId: number | null;
  chegadaEm: string | null;
  escolaId: number | null;
  tempoTrajetoMin: number | null;
  divergencias: Divergencia[];
  passos: Passo[];
  leiturasIgnoradas: { duplicadas: number; foraDeOrdem: number };
}

/** Uma linha do quadro do dia: o aluno, a jornada e se era esperado na escola. */
export interface LinhaJornada {
  aluno: AlunoResumo;
  jornada: JornadaDoDia;
  esperado: boolean;
}

export interface Descartes {
  duplicadas: number;
  foraDeOrdem: number;
  tipoDeLeitorDesconhecido: number;
  leitorNaoCadastrado: number;
  semDadosValidos: number;
}

export interface QuadroDoDia {
  data: string;
  avaliadoEm: string;
  porEstado: Partial<Record<EstadoJornada, number>>;
  jornadas: Pagina<LinhaJornada>;
  descartes: Descartes;
  desatualizado: boolean;
  incompleto: boolean;
}

export interface Contagem {
  esperados: number;
  naEscola: number;
  embarcados: number;
  aguardando: number;
  ausentes: number;
  divergentes: number;
  frequencia: number | null;
}

export interface PresencaHoje {
  data: string;
  avaliadoEm: string;
  diaLetivo: boolean;
  contagem: Contagem;
  semPresenca: Pagina<LinhaJornada>;
  desatualizado: boolean;
  incompleto: boolean;
}

export interface FrequenciaDoDia {
  data: string;
  esperados: number;
  presentes: number;
  frequencia: number | null;
}

export interface PresencaPeriodo {
  inicio: string;
  fim: string;
  dias: FrequenciaDoDia[];
  frequenciaMedia: number | null;
  desatualizado: boolean;
  incompleto: boolean;
}

export type SituacaoLeitor = 'ONLINE' | 'OFFLINE' | 'SEM_LEITURA';

export interface SaudeLeitor {
  id: number;
  descricao: string | null;
  tipoUso: TipoLeitor | 'DESCONHECIDO' | null;
  tipoUsoDescricao: string | null;
  veiculoId: number | null;
  veiculoPrefixo: string | null;
  escolaId: number | null;
  ultimaLeitura: string | null;
  leiturasUltimaHora: number;
  situacao: SituacaoLeitor;
}

export interface SaudeDosLeitores {
  avaliadoEm: string;
  limiteOfflineMin: number;
  porSituacao: Record<string, number>;
  leitores: SaudeLeitor[];
  desatualizado: boolean;
  incompleto: boolean;
}

export type EstadoVeiculo = 'EM_ROTA' | 'CONCLUIDO' | 'SEM_EMBARQUE';
export type FaixaOcupacao = 'OK' | 'ATENCAO' | 'CRITICO';

export interface StatusVeiculo {
  id: number;
  placa: string | null;
  prefixo: string | null;
  descricao: string | null;
  estado: EstadoVeiculo;
  embarcados: number;
  aBordo: number;
  chegaram: number;
  esperados: number;
  capacidade: number | null;
  ocupacao: number | null;
  faixaOcupacao: FaixaOcupacao | null;
  escolaId: number | null;
  /** Coordenadas da escola de destino (não é o GPS do veículo). */
  latitude: number | null;
  longitude: number | null;
  leitores: number[];
  ultimaLeitura: string | null;
  saida: string | null;
  tempoMedioMin: number | null;
  previsaoChegada: string | null;
}

export interface StatusDosVeiculos {
  avaliadoEm: string;
  porEstado: Partial<Record<EstadoVeiculo, number>>;
  veiculos: StatusVeiculo[];
  capacidadeNaoConfigurada: boolean;
  desatualizado: boolean;
  incompleto: boolean;
}

export interface Embarcado {
  alunoId: number;
  iniciais: string | null;
  turma: string | null;
  estado: EstadoJornada;
  embarqueEm: string | null;
  chegadaEm: string | null;
}

export interface LeituraRecente {
  dataHora: string;
  leitorId: number;
  tipo: TipoLeitor;
  alunoId: number;
}

export interface DetalheVeiculo {
  veiculo: StatusVeiculo;
  embarcados: Embarcado[];
  ultimasLeituras: LeituraRecente[];
  desatualizado: boolean;
  incompleto: boolean;
}

export type StatusAlerta = 'ABERTO' | 'EM_ANALISE' | 'RESOLVIDO';
export type EntidadeAlerta = 'ALUNO' | 'VEICULO' | 'LEITOR';

export interface Alerta {
  id: number;
  tipo: string;
  severidade: Severidade;
  status: StatusAlerta;
  entidade: EntidadeAlerta;
  entidadeId: string;
  rotulo: string;
  mensagem: string;
  ocorrencias: number;
  ativo: boolean;
  primeiraOcorrenciaEm: string;
  ultimaOcorrenciaEm: string;
  escolaId: number | null;
  veiculoId: number | null;
  assumidoPor: number | null;
  assumidoEm: string | null;
  resolvidoPor: number | null;
  resolvidoEm: string | null;
  comentario: string | null;
}

export interface ResumoAlertas {
  abertosPorSeveridade: Partial<Record<Severidade, number>>;
  abertos: number;
  emAnalise: number;
}

export interface ListaDeAlertas {
  resumo: ResumoAlertas;
  alertas: Pagina<Alerta>;
}

export type FaixaFrequencia = 'OK' | 'ATENCAO' | 'CRITICO';

export interface FrequenciaEscola {
  escolaId: number;
  escolaNome: string | null;
  esperados: number;
  presentes: number;
  frequencia: number | null;
  faixa: FaixaFrequencia | null;
}

export interface ResumoDashboard {
  data: string;
  avaliadoEm: string;
  anoLetivo: number;
  kpis: {
    alunosAtivos: number;
    frequenciaHoje: number | null;
    naEscolaAgora: number;
    veiculosEmRota: number;
    alertasAbertos: number;
    diaLetivo: boolean;
  };
  etapasConfiguradas: boolean;
  frequenciaPorEtapa: {
    etapa: string;
    esperados: number;
    presentes: number;
    frequencia: number | null;
  }[];
  matriculas: {
    agrupamento: 'ETAPA' | 'ANO_ESCOLAR';
    anoAtual: number;
    porAno: Record<string, Record<string, number>>;
  };
  frequenciaHojePorEscola: FrequenciaEscola[];
  frequenciaAnualPorEscola: FrequenciaEscola[];
  porAnoEscolar: { anoEscolar: string; alunos: number; turmas: number; docentes: number | null }[];
  usuariosConectados: Record<string, number>;
  desatualizado: boolean;
  incompleto: boolean;
}

export interface IndicadoresSensiveis {
  disponivel: boolean;
  motivo: string | null;
  minimoPorGrupo: number;
  indicadores: {
    nome: string;
    grupos: { rotulo: string; quantidadeReal: number | null; suprimido: boolean }[];
  }[];
}

export interface AlunoComSituacao {
  aluno: AlunoResumo;
  estadoHoje: EstadoJornada | null;
}

export interface ListaDeAlunos {
  anoLetivo: number;
  alunos: Pagina<AlunoComSituacao>;
  desatualizado: boolean;
  incompleto: boolean;
}

export interface PerfilAluno {
  aluno: AlunoResumo;
  jornadaHoje: JornadaDoDia | null;
  responsaveis: {
    id: number;
    nome: string | null;
    contatoMascarado: string | null;
    contatoDisponivel: boolean;
  }[];
  situacaoResponsaveis: { pronto: boolean; completo: boolean };
  desatualizado: boolean;
}

export type TipoPendencia = 'SEM_BIOMETRIA' | 'SEM_RESPONSAVEL';

export interface Pendencias {
  anoLetivo: number;
  porTipo: Partial<Record<TipoPendencia, number>>;
  alunos: Pagina<{ aluno: AlunoResumo; pendencias: TipoPendencia[] }>;
  responsaveisAvaliados: boolean;
  desatualizado: boolean;
  incompleto: boolean;
}

export interface ResultadoSincronizacao {
  id: number;
  usuarioId: number;
  iniciadoEm: string;
  concluidoEm: string | null;
  sucesso: boolean;
  httpStatus: number | null;
  erroTipo: string | null;
}

export interface OpcoesDeFiltro {
  anoLetivo: number;
  escolas: { id: number; nome: string }[];
  anosEscolares: string[];
  turmas: { id: number; nome: string; escolaId: number | null; anoEscolar: string | null }[];
  desatualizado: boolean;
}

export type TipoRelatorio = 'FREQUENCIA' | 'VEICULOS';

export interface Tabela {
  titulo: string;
  periodo: string;
  colunas: string[];
  linhas: string[][];
}

export interface PreviaRelatorio {
  tabela: Tabela;
  totalLinhas: number;
}

export interface Agendamento {
  id: number;
  tipo: TipoRelatorio;
  escolaId: number | null;
  diaSemana: string;
  criadoEm: string;
  ultimoEnvioEm: string | null;
}
