import { LinhaJornada } from '../../core/api/modelos';
import { EstadoJornada } from '../../shared/ui/tom';

/** Ordem das colunas: o caminho natural do aluno, com as exceções no fim. */
export const COLUNAS: EstadoJornada[] = [
  'AGUARDANDO',
  'EMBARCADO',
  'NA_ESCOLA',
  'AUSENTE',
  'DIVERGENTE',
];

export interface FiltroQuadro {
  data: string;
  escolaId: number | null;
  veiculoId: number | null;
  anoEscolar: string | null;
  turmaId: number | null;
}

/** Se a linha recebida por SSE pertence ao quadro aberto (mesmo dia e mesmos filtros). */
export function pertence(linha: LinhaJornada, filtro: FiltroQuadro): boolean {
  if (linha.jornada.data !== filtro.data) {
    return false;
  }
  const escola = linha.jornada.escolaId ?? linha.aluno.escolaId;
  if (filtro.escolaId !== null && escola !== filtro.escolaId) {
    return false;
  }
  if (
    filtro.veiculoId !== null &&
    (linha.jornada.veiculoId ?? linha.aluno.veiculoId) !== filtro.veiculoId
  ) {
    return false;
  }
  if (filtro.anoEscolar !== null && linha.aluno.anoEscolar !== filtro.anoEscolar) {
    return false;
  }
  return filtro.turmaId === null || linha.aluno.turmaId === filtro.turmaId;
}

/**
 * Aplica uma atualização vinda do servidor: substitui a linha do aluno (o card muda de coluna)
 * ou acrescenta, se o aluno ainda não estava no quadro. Devolve uma nova lista (imutável).
 */
export function aplicarAtualizacao(linhas: LinhaJornada[], nova: LinhaJornada): LinhaJornada[] {
  const indice = linhas.findIndex((l) => l.aluno.id === nova.aluno.id);
  if (indice === -1) {
    return [...linhas, nova];
  }
  const copia = [...linhas];
  copia[indice] = nova;
  return copia;
}

/** Agrupa por estado, ordenando cada coluna pelo horário mais recente e depois pelo nome. */
export function porColuna(linhas: LinhaJornada[]): Record<EstadoJornada, LinhaJornada[]> {
  const saida = Object.fromEntries(COLUNAS.map((c) => [c, [] as LinhaJornada[]])) as Record<
    EstadoJornada,
    LinhaJornada[]
  >;
  for (const linha of linhas) {
    saida[linha.jornada.estado].push(linha);
  }
  const momento = (l: LinhaJornada) => l.jornada.chegadaEm ?? l.jornada.embarqueEm ?? '';
  for (const coluna of COLUNAS) {
    saida[coluna].sort(
      (a, b) =>
        momento(b).localeCompare(momento(a)) ||
        (a.aluno.nome ?? '').localeCompare(b.aluno.nome ?? '', 'pt-BR'),
    );
  }
  return saida;
}

export const TEXTO_DIVERGENCIA: Record<string, string> = {
  EMBARCOU_SEM_CHEGADA: 'Embarcou e não chegou na janela',
  CHEGOU_SEM_EMBARQUE: 'Chegou sem embarque registrado',
  VEICULO_DIFERENTE_DO_CADASTRO: 'Veículo diferente do cadastro',
  EMBARQUE_DUPLICADO: 'Embarque duplicado',
};
