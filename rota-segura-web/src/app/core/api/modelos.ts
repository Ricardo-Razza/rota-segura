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
  /** Leitura que gerou o passo (para buscar o local); nula em dados antigos. */
  leituraId: number | null;
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

/** Posição do GPS do veículo (hora do GPS no fuso das escolas). */
export interface PosicaoVeiculo {
  latitude: number;
  longitude: number;
  velocidadeKmh: number | null;
  rumo: number | null;
  emMovimento: boolean | null;
  registradaEm: string;
}

export interface PontoRastro {
  latitude: number;
  longitude: number;
  em: string;
}

export interface RastreioVeiculo {
  veiculoId: number;
  escolaId: number | null;
  posicao: PosicaoVeiculo | null;
  /** Posição mais antiga que o limite do backend (ou nenhuma). */
  atrasada: boolean;
  /** A última consulta ao rastreador falhou; a posição é a última boa. */
  falhando: boolean;
  distanciaEscolaM: number | null;
  naCercaDaEscola: boolean;
  naCercaDesde: string | null;
  /** Pontos do dia; vem vazio nos eventos de tempo real. */
  rastro: PontoRastro[];
}

export interface RastreamentoAoVivo {
  avaliadoEm: string;
  intervaloS: number;
  raioCercaM: number;
  veiculos: RastreioVeiculo[];
}

/** Evento SSE `veiculo.posicao`. */
export interface PosicaoAoVivo {
  veiculo: RastreioVeiculo;
  novoPonto: boolean;
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
  /** Etapas configuradas no backend (vazio quando não há mapa de etapas). */
  etapas: string[];
  turnos: string[];
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

// ----- Análises

export type Comparacao = 'PERIODO_ANTERIOR' | 'ANO_ANTERIOR' | 'NENHUMA';
export type Granularidade = 'DIA' | 'SEMANA' | 'MES';

export interface PeriodoDatas {
  inicio: string;
  fim: string;
}

/** Valor do período, do período de referência e a variação (p.p., minutos ou %, conforme o indicador). */
export interface Indicador {
  atual: number | null;
  anterior: number | null;
  variacao: number | null;
}

export interface PontoFrequencia {
  inicio: string;
  esperados: number;
  presentes: number;
  frequencia: number | null;
}

export interface GrupoFrequencia {
  chave: string;
  rotulo: string;
  esperados: number;
  presentes: number;
  frequencia: number | null;
  anterior: number | null;
  variacao: number | null;
  faixa: FaixaFrequencia | null;
}

export interface AnaliseFrequencia {
  periodo: PeriodoDatas;
  referencia: PeriodoDatas | null;
  granularidade: Granularidade;
  frequencia: Indicador;
  diasLetivos: number;
  alunosAvaliados: number;
  abaixoDoLimite: Indicador;
  limiteRisco: number;
  serie: PontoFrequencia[];
  serieReferencia: PontoFrequencia[];
  porEscola: GrupoFrequencia[];
  porEtapa: GrupoFrequencia[];
  porTurno: GrupoFrequencia[];
  porDiaSemana: GrupoFrequencia[];
  etapasConfiguradas: boolean;
  desatualizado: boolean;
  incompleto: boolean;
}

export interface Comparativo {
  chave: string;
  rotulo: string;
  atual: number;
  anterior: number;
  variacao: number | null;
}

export interface Cobertura {
  chave: 'BIOMETRIA' | 'VEICULO' | 'RESPONSAVEL';
  rotulo: string;
  com: number;
  total: number;
  percentual: number | null;
  disponivel: boolean;
}

export interface AnaliseMatriculas {
  anoLetivo: number;
  agrupamento: 'ETAPA' | 'ANO_ESCOLAR';
  total: Indicador;
  turmas: Indicador;
  porAno: { ano: number; total: number; porGrupo: Record<string, number> }[];
  porAnoEscolar: Comparativo[];
  porEscola: Comparativo[];
  porTurno: Comparativo[];
  cobertura: Cobertura[];
  desatualizado: boolean;
  incompleto: boolean;
}

export interface PontoFrota {
  inicio: string;
  embarques: number;
  tempoMedioMin: number | null;
  noPrazo: number | null;
  alertas: number;
  criticos: number;
}

export interface VeiculoAnalise {
  id: number;
  placa: string | null;
  prefixo: string | null;
  viagens: number;
  embarques: number;
  semChegada: number;
  tempoMedioMin: number | null;
  noPrazo: number | null;
  alertas: number;
}

export interface AnaliseFrota {
  periodo: PeriodoDatas;
  referencia: PeriodoDatas | null;
  granularidade: Granularidade;
  janelaMin: number;
  embarques: Indicador;
  viagens: Indicador;
  tempoMedioMin: Indicador;
  noPrazo: Indicador;
  serie: PontoFrota[];
  serieReferencia: PontoFrota[];
  veiculos: VeiculoAnalise[];
  alertas: {
    total: Indicador;
    abertos: number;
    porSeveridade: Record<Severidade, number>;
    porTipo: Record<string, number>;
    tempoMedioResolucaoMin: number | null;
  };
  desatualizado: boolean;
  incompleto: boolean;
}

export type OrigemLocal = 'GPS_ONIBUS' | 'LEITOR';

/** Um passo da jornada com o local (nulo quando não há local confiável). */
export interface LocalDoPasso {
  dataHora: string;
  tipo: TipoLeitor;
  veiculoId: number | null;
  escolaId: number | null;
  estadoResultante: EstadoJornada;
  latitude: number | null;
  longitude: number | null;
  /** GPS_ONIBUS: posição do ônibus na hora do embarque; LEITOR: coordenada da leitura (escola). */
  origemLocal: OrigemLocal | null;
  /** Situação do aviso ao responsável, como a API descreve. */
  statusNotificacao: string | null;
}

/** Onde o aluno embarcou e chegou num dia. Cada consulta é auditada no backend. */
export interface LocaisDoDia {
  alunoId: number;
  data: string;
  passos: LocalDoPasso[];
  desatualizado: boolean;
  /** Algum detalhe não pôde ser lido da API externa. */
  incompleto: boolean;
}
