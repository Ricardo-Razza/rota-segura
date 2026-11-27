import { JornadaDoDia } from '../../core/api/modelos';
import { isoLocal } from '../../shared/formato';
import { EstadoJornada } from '../../shared/ui/tom';
import { janelasDeHistorico } from './alunos.logica';

/** Evita buscas sem sentido (ex.: 0001) quando alguém digita o ano. */
export const ANO_MINIMO = 2000;

export const NOMES_DOS_MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

/** Estados contados no resumo do mês e do ano. */
export const ESTADOS_DO_RESUMO = ['NA_ESCOLA', 'AUSENTE', 'DIVERGENTE', 'EMBARCADO'] as const;

export function soDigitos(texto: string): string {
  return texto.replace(/\D/g, '').slice(0, 4);
}

export type ValidacaoDeAno = { ano: number } | { erro: string };

export function validarAno(texto: string, anoAtual: number): ValidacaoDeAno {
  if (!/^\d{4}$/.test(texto)) {
    return { erro: 'Digite o ano com 4 números.' };
  }
  const ano = Number(texto);
  if (ano > anoAtual) {
    return { erro: `${ano} ainda não começou. O ano mais recente é ${anoAtual}.` };
  }
  if (ano < ANO_MINIMO) {
    return { erro: `Digite um ano a partir de ${ANO_MINIMO}.` };
  }
  return { ano };
}

/** Blocos de até 31 dias (limite do endpoint) de 1º de janeiro até o fim do ano ou até hoje. */
export function janelasDoAno(ano: number, hoje: Date): { inicio: string; fim: string }[] {
  const inicio = new Date(ano, 0, 1);
  const fimDoAno = new Date(ano, 11, 31);
  const fim = hoje < fimDoAno ? hoje : fimDoAno;
  // UTC na conta dos dias: horário de verão não pode somar nem tirar um dia.
  const emDias = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000;
  return janelasDeHistorico(fim, emDias(fim) - emDias(inicio) + 1);
}

export type Situacao = EstadoJornada | 'SEM_REGISTRO' | 'SEM_AULA' | 'FUTURO' | 'FIM_DE_SEMANA';

export interface Historico {
  porData: Map<string, JornadaDoDia>;
  /** Data da primeira leitura do aluno no período; antes dela não há o que afirmar. */
  primeiraLeitura: string | null;
}

export function temLeitura(j: JornadaDoDia): boolean {
  return j.passos.length > 0 || j.embarqueEm !== null || j.chegadaEm !== null;
}

export function montarHistorico(jornadas: JornadaDoDia[]): Historico {
  const porData = new Map(jornadas.map((j) => [j.data, j]));
  const comLeitura = jornadas
    .filter(temLeitura)
    .map((j) => j.data)
    .sort();
  return { porData, primeiraLeitura: comLeitura[0] ?? null };
}

export interface Celula {
  data: string;
  dia: number;
  fimDeSemana: boolean;
  hoje: boolean;
  situacao: Situacao;
  jornada: JornadaDoDia | null;
}

/** Dias de um mês (0 = janeiro) em semanas inteiras começando no domingo; `null` = fora do mês. */
export function celulasDoMes(
  historico: Historico,
  ano: number,
  mes: number,
  hoje: string,
): (Celula | null)[] {
  const vaziosNoComeco = new Date(ano, mes, 1).getDay();
  const dias = new Date(ano, mes + 1, 0).getDate();
  const total = Math.ceil((vaziosNoComeco + dias) / 7) * 7;
  return Array.from({ length: total }, (_, posicao) => {
    const dia = posicao - vaziosNoComeco + 1;
    if (dia < 1 || dia > dias) {
      return null;
    }
    const data = isoLocal(new Date(ano, mes, dia));
    const fimDeSemana = posicao % 7 === 0 || posicao % 7 === 6;
    const jornada = historico.porData.get(data) ?? null;
    let situacao: Situacao;
    if (jornada) {
      const antes = historico.primeiraLeitura === null || data < historico.primeiraLeitura;
      situacao = antes && data !== hoje ? 'SEM_REGISTRO' : jornada.estado;
    } else if (fimDeSemana) {
      situacao = 'FIM_DE_SEMANA';
    } else {
      situacao = data > hoje ? 'FUTURO' : 'SEM_AULA';
    }
    return { data, dia, fimDeSemana, hoje: data === hoje, situacao, jornada };
  });
}

/** Dias que entram nas contas: encerrados (antes de hoje) e a partir da primeira leitura. */
export function diasContados(historico: Historico, prefixo: string, hoje: string): JornadaDoDia[] {
  const primeira = historico.primeiraLeitura;
  if (primeira === null) {
    return [];
  }
  return [...historico.porData.values()]
    .filter((j) => j.data.startsWith(prefixo) && j.data >= primeira && j.data < hoje)
    .sort((a, b) => a.data.localeCompare(b.data));
}

export interface Resumo {
  total: number;
  porEstado: Record<EstadoJornada, number>;
  /** % de dias na escola; `null` sem dias para contar. */
  presenca: number | null;
}

export function resumir(dias: JornadaDoDia[]): Resumo {
  const porEstado: Record<EstadoJornada, number> = {
    AGUARDANDO: 0,
    EMBARCADO: 0,
    NA_ESCOLA: 0,
    AUSENTE: 0,
    DIVERGENTE: 0,
  };
  for (const d of dias) {
    porEstado[d.estado]++;
  }
  const presenca = dias.length ? Math.round((porEstado.NA_ESCOLA / dias.length) * 1000) / 10 : null;
  return { total: dias.length, porEstado, presenca };
}

/** Meses (0 = janeiro) do primeiro com leitura até dezembro; os que não começaram vêm marcados. */
export function mesesDoAno(
  historico: Historico,
  ano: number,
  hoje: string,
): { mes: number; futuro: boolean }[] {
  if (historico.primeiraLeitura === null) {
    return [];
  }
  const primeiro = Number(historico.primeiraLeitura.slice(5, 7)) - 1;
  return Array.from({ length: 12 - primeiro }, (_, i) => {
    const mes = primeiro + i;
    return { mes, futuro: isoLocal(new Date(ano, mes, 1)) > hoje };
  });
}

/** Mês aberto ao entrar no ano: o de hoje no ano atual; senão o último com leitura. */
export function mesInicial(historico: Historico, ano: number, hoje: string): number {
  if (hoje.startsWith(`${ano}-`)) {
    return Number(hoje.slice(5, 7)) - 1;
  }
  const ultima = [...historico.porData.values()]
    .filter(temLeitura)
    .map((j) => j.data)
    .sort()
    .at(-1);
  return ultima ? Number(ultima.slice(5, 7)) - 1 : 0;
}

/** Dia mais recente com registro no mês, para o detalhe já abrir preenchido. */
export function diaInicial(historico: Historico, mes: number, hoje: string): string | null {
  const primeira = historico.primeiraLeitura;
  return (
    [...historico.porData.keys()]
      .filter(
        (data) =>
          Number(data.slice(5, 7)) - 1 === mes &&
          data <= hoje &&
          (data === hoje || (primeira !== null && data >= primeira)),
      )
      .sort()
      .at(-1) ?? null
  );
}
