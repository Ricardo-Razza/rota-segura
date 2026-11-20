import { Comparacao } from '../../core/api/modelos';
import { Parametros } from '../../core/api/painel-api.service';

export type AbaAnalise = 'frequencia' | 'matriculas' | 'frota';
export type PresetAnalise = '7dias' | '30dias' | 'mes' | 'ano' | 'personalizado';

export const ABAS: { valor: AbaAnalise; rotulo: string }[] = [
  { valor: 'frequencia', rotulo: 'Frequência' },
  { valor: 'matriculas', rotulo: 'Matrículas e cadastro' },
  { valor: 'frota', rotulo: 'Frota e alertas' },
];

export const PRESETS: { valor: Exclude<PresetAnalise, 'personalizado'>; rotulo: string }[] = [
  { valor: '7dias', rotulo: '7 dias' },
  { valor: '30dias', rotulo: '30 dias' },
  { valor: 'mes', rotulo: 'Este mês' },
  { valor: 'ano', rotulo: 'Ano letivo' },
];

export const COMPARACOES: { valor: Comparacao; rotulo: string }[] = [
  { valor: 'PERIODO_ANTERIOR', rotulo: 'Período anterior' },
  { valor: 'ANO_ANTERIOR', rotulo: 'Ano anterior' },
  { valor: 'NENHUMA', rotulo: 'Não comparar' },
];

/** Máximo aceito pelo backend. */
export const MAXIMO_DIAS = 366;

/**
 * Filtro da tela de Análises. Mora na URL (só ids, datas e enums; nada pessoal):
 * ano letivo, ano escolar e turma usam os mesmos nomes dos filtros globais.
 */
export interface FiltroAnalise {
  preset: PresetAnalise;
  inicio: string;
  fim: string;
  comparar: Comparacao;
  escolas: number[];
  etapa: string | null;
  anoEscolar: string | null;
  turmaId: number | null;
  turno: string | null;
  veiculoId: number | null;
  anoLetivo: number | null;
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dataValida(texto: string | null): texto is string {
  return !!texto && /^\d{4}-\d{2}-\d{2}$/.test(texto) && !Number.isNaN(Date.parse(texto));
}

function inteiro(texto: string | null): number | null {
  return texto !== null && /^\d{1,12}$/.test(texto) ? Number(texto) : null;
}

function texto(valor: string | null, maximo = 40): string | null {
  return valor && valor.trim() && valor.length <= maximo ? valor : null;
}

/** Datas de um atalho. "Ano letivo" vai de 1º de janeiro até hoje (ou 31/12 de um ano passado). */
export function periodoDoPreset(
  preset: Exclude<PresetAnalise, 'personalizado'>,
  hoje = new Date(),
  anoLetivo: number | null = null,
): { inicio: string; fim: string } {
  const fim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  if (preset === 'ano') {
    const ano = anoLetivo ?? fim.getFullYear();
    const ultimo = ano < fim.getFullYear() ? new Date(ano, 11, 31) : fim;
    return { inicio: `${ano}-01-01`, fim: iso(ultimo) };
  }
  const inicio = new Date(fim);
  if (preset === '7dias') inicio.setDate(fim.getDate() - 6);
  else if (preset === '30dias') inicio.setDate(fim.getDate() - 29);
  else inicio.setDate(1);
  return { inicio: iso(inicio), fim: iso(fim) };
}

export function diasEntre(inicio: string, fim: string): number {
  return Math.round((Date.parse(fim) - Date.parse(inicio)) / 86_400_000) + 1;
}

/** Lê o filtro da URL. Valor inválido é ignorado e o padrão (30 dias, período anterior) assume. */
export function filtroDaUrl(
  p: { get(nome: string): string | null },
  hoje = new Date(),
): FiltroAnalise {
  const anoLetivo = inteiro(p.get('anoLetivo'));
  const pedido = p.get('periodo') as PresetAnalise | null;
  let preset: PresetAnalise =
    pedido && ['7dias', '30dias', 'mes', 'ano', 'personalizado'].includes(pedido)
      ? pedido
      : '30dias';
  let { inicio, fim } = periodoDoPreset(
    preset === 'personalizado' ? '30dias' : preset,
    hoje,
    anoLetivo,
  );
  if (preset === 'personalizado') {
    const i = p.get('inicio');
    const f = p.get('fim');
    if (dataValida(i) && dataValida(f) && i <= f && diasEntre(i, f) <= MAXIMO_DIAS) {
      inicio = i;
      fim = f;
    } else {
      preset = '30dias';
    }
  }
  const comparar = p.get('comparar') as Comparacao | null;
  const escolas = (p.get('escolas') ?? '')
    .split(',')
    .map((v) => inteiro(v))
    .filter((v): v is number => v !== null);
  const escolaGlobal = inteiro(p.get('escolaId'));
  return {
    preset,
    inicio,
    fim,
    comparar:
      comparar && ['PERIODO_ANTERIOR', 'ANO_ANTERIOR', 'NENHUMA'].includes(comparar)
        ? comparar
        : 'PERIODO_ANTERIOR',
    escolas: escolas.length ? [...new Set(escolas)] : escolaGlobal !== null ? [escolaGlobal] : [],
    etapa: texto(p.get('etapa')),
    anoEscolar: texto(p.get('anoEscolar'), 30),
    turmaId: inteiro(p.get('turmaId')),
    turno: texto(p.get('turno')),
    veiculoId: inteiro(p.get('veiculoId')),
    anoLetivo,
  };
}

/**
 * Parâmetros da URL para gravar o filtro (nulo apaga). A escola única dos filtros globais
 * passa a viver em "escolas", que aceita várias.
 */
export function paraUrl(f: FiltroAnalise): Record<string, string | null> {
  return {
    periodo: f.preset === '30dias' ? null : f.preset,
    inicio: f.preset === 'personalizado' ? f.inicio : null,
    fim: f.preset === 'personalizado' ? f.fim : null,
    comparar: f.comparar === 'PERIODO_ANTERIOR' ? null : f.comparar,
    escolas: f.escolas.length ? f.escolas.join(',') : null,
    escolaId: null,
    etapa: f.etapa,
    anoEscolar: f.anoEscolar,
    turmaId: f.turmaId === null ? null : String(f.turmaId),
    turno: f.turno,
    veiculoId: f.veiculoId === null ? null : String(f.veiculoId),
    anoLetivo: f.anoLetivo === null ? null : String(f.anoLetivo),
  };
}

/** Parâmetros para o backend. O ônibus só vale para a aba de frota. */
export function paraApi(f: FiltroAnalise, aba: AbaAnalise): Parametros {
  return {
    dataInicio: f.inicio,
    dataFim: f.fim,
    comparar: f.comparar,
    escolaIds: f.escolas.length ? f.escolas.join(',') : null,
    etapa: f.etapa,
    anoEscolar: f.anoEscolar,
    turmaId: f.turmaId,
    turno: f.turno,
    veiculoId: aba === 'frota' ? f.veiculoId : null,
    anoLetivo: f.anoLetivo,
  };
}

/** Quantos filtros além do período e da comparação estão ativos (número no botão "Filtros"). */
export function contarFiltros(f: FiltroAnalise): number {
  return (
    (f.escolas.length ? 1 : 0) +
    [f.etapa, f.anoEscolar, f.turmaId, f.turno, f.veiculoId, f.anoLetivo].filter((v) => v !== null)
      .length
  );
}

export function rotuloPeriodo(f: FiltroAnalise): string {
  const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
  const preset = PRESETS.find((p) => p.valor === f.preset);
  if (preset && f.preset !== 'ano') {
    return preset.rotulo;
  }
  if (f.preset === 'ano') {
    return `Ano letivo ${f.anoLetivo ?? f.inicio.slice(0, 4)}`;
  }
  return `${dm(f.inicio)}–${dm(f.fim)}/${f.fim.slice(0, 4)}`;
}

export function rotuloComparacao(c: Comparacao): string {
  return c === 'PERIODO_ANTERIOR'
    ? 'vs período anterior'
    : c === 'ANO_ANTERIOR'
      ? 'vs ano anterior'
      : 'sem comparação';
}

export const TIPOS_ALERTA: Record<string, string> = {
  EMBARCOU_SEM_CHEGADA: 'Embarcou e não chegou',
  CHEGOU_SEM_EMBARQUE: 'Chegou sem embarque',
  EMBARQUE_DUPLICADO: 'Embarque duplicado',
  LOTACAO: 'Lotação',
  LEITOR_SEM_LEITURA: 'Leitor sem leitura',
  LEITOR_TIPO_DESCONHECIDO: 'Leitor sem tipo',
  CERCA_VIRTUAL_SEM_DESEMBARQUE: 'Ônibus na escola sem desembarque',
  DESVIO_DE_ROTA: 'Desvio de rota',
  PARADA_FORA_DO_PADRAO: 'Parada fora do padrão',
};

export function rotuloTipoAlerta(tipo: string): string {
  return TIPOS_ALERTA[tipo] ?? tipo.replaceAll('_', ' ').toLowerCase();
}
