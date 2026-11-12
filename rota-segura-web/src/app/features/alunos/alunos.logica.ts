import { JornadaDoDia } from '../../core/api/modelos';
import { isoLocal } from '../../shared/formato';

/** Janelas de até 31 dias (limite do endpoint de histórico) cobrindo o período, da mais recente para trás. */
export function janelasDeHistorico(
  fim: Date,
  diasCorridos: number,
  maximo = 31,
): { inicio: string; fim: string }[] {
  const janelas: { inicio: string; fim: string }[] = [];
  const limite = new Date(fim.getFullYear(), fim.getMonth(), fim.getDate() - diasCorridos + 1);
  let cursorFim = new Date(fim.getFullYear(), fim.getMonth(), fim.getDate());
  while (cursorFim >= limite) {
    const inicio = new Date(
      cursorFim.getFullYear(),
      cursorFim.getMonth(),
      cursorFim.getDate() - maximo + 1,
    );
    const inicioReal = inicio < limite ? limite : inicio;
    janelas.push({ inicio: isoLocal(inicioReal), fim: isoLocal(cursorFim) });
    cursorFim = new Date(inicioReal.getFullYear(), inicioReal.getMonth(), inicioReal.getDate() - 1);
  }
  return janelas;
}

/** Une as janelas, sem repetir dia, e fica com os N dias letivos mais recentes (ordem cronológica). */
export function ultimosDias(jornadas: JornadaDoDia[], quantidade: number): JornadaDoDia[] {
  const porDia = new Map<string, JornadaDoDia>();
  for (const j of jornadas) {
    porDia.set(j.data, j);
  }
  return [...porDia.values()].sort((a, b) => a.data.localeCompare(b.data)).slice(-quantidade);
}

export interface Risco {
  nivel: 'baixo' | 'medio' | 'alto';
  faltasSeguidas: number;
  frequenciaRecente: number | null;
  frequenciaAnterior: number | null;
  motivos: string[];
}

function frequencia(dias: JornadaDoDia[]): number | null {
  if (dias.length === 0) {
    return null;
  }
  const presentes = dias.filter((d) => d.estado === 'NA_ESCOLA').length;
  return Math.round((presentes / dias.length) * 1000) / 10;
}

/**
 * Indicador de risco a partir do histórico (cronológico): faltas seguidas mais recentes e queda
 * de frequência das últimas 20 aulas contra as 20 anteriores. Hoje (ainda em curso) não conta.
 */
export function avaliarRisco(historico: JornadaDoDia[], hoje: string): Risco {
  const encerrados = historico.filter((d) => d.data < hoje);
  let faltasSeguidas = 0;
  for (let i = encerrados.length - 1; i >= 0 && encerrados[i].estado !== 'NA_ESCOLA'; i--) {
    faltasSeguidas++;
  }
  const recente = frequencia(encerrados.slice(-20));
  const anterior = frequencia(encerrados.slice(-40, -20));
  const motivos: string[] = [];
  let pontos = 0;
  if (faltasSeguidas >= 5) {
    pontos += 2;
    motivos.push(`${faltasSeguidas} faltas seguidas`);
  } else if (faltasSeguidas >= 3) {
    pontos += 1;
    motivos.push(`${faltasSeguidas} faltas seguidas`);
  }
  if (recente !== null && anterior !== null && anterior - recente >= 15) {
    pontos += 1;
    motivos.push(`frequência caiu de ${anterior}% para ${recente}%`);
  }
  if (recente !== null && recente < 75) {
    pontos += 1;
    motivos.push(`frequência recente de ${recente}%`);
  }
  return {
    nivel: pontos >= 2 ? 'alto' : pontos === 1 ? 'medio' : 'baixo',
    faltasSeguidas,
    frequenciaRecente: recente,
    frequenciaAnterior: anterior,
    motivos,
  };
}
