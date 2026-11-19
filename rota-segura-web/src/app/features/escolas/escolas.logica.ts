import {
  FaixaFrequencia,
  FrequenciaDoDia,
  FrequenciaEscola,
  StatusVeiculo,
} from '../../core/api/modelos';
import { percentual } from '../../shared/formato';
import { Tom } from '../../shared/ui/tom';
import { PontoEscola } from '../veiculos/mapa-veiculos';

export const TOM_FAIXA: Record<FaixaFrequencia, Tom> = {
  OK: 'sucesso',
  ATENCAO: 'atencao',
  CRITICO: 'critico',
};

export function tomDaFaixa(faixa: FaixaFrequencia | null | undefined): Tom {
  return faixa ? TOM_FAIXA[faixa] : 'neutro';
}

export function nomeEscola(e: { escolaId: number; escolaNome: string | null }): string {
  return e.escolaNome || `Escola #${e.escolaId}`;
}

/**
 * Escolas no mapa. A API não tem coordenada própria da escola: usamos a escola de destino
 * dos veículos (cadastro do leitor facial). Escola sem veículo com coordenada não aparece.
 */
export function pontosDeEscolas(
  veiculos: StatusVeiculo[],
  frequencias: FrequenciaEscola[],
): PontoEscola[] {
  const porEscola = new Map(frequencias.map((f) => [f.escolaId, f]));
  const vistos = new Set<number>();
  const pontos: PontoEscola[] = [];
  for (const v of veiculos) {
    if (v.escolaId === null || v.latitude === null || v.longitude === null) {
      continue;
    }
    if (vistos.has(v.escolaId)) {
      continue;
    }
    vistos.add(v.escolaId);
    const f = porEscola.get(v.escolaId);
    pontos.push({
      id: v.escolaId,
      latitude: v.latitude,
      longitude: v.longitude,
      rotulo: f ? `${nomeEscola(f)} · ${percentual(f.frequencia)}` : `Escola #${v.escolaId}`,
      tom: tomDaFaixa(f?.faixa),
    });
  }
  return pontos;
}

/** Ordena da menor para a maior presença (quem precisa de atenção primeiro); sem dado vai ao fim. */
export function ordenarPorPresenca(escolas: FrequenciaEscola[]): FrequenciaEscola[] {
  return [...escolas].sort((a, b) => {
    if (a.frequencia === null) return b.frequencia === null ? 0 : 1;
    if (b.frequencia === null) return -1;
    return a.frequencia - b.frequencia;
  });
}

export interface ContagemFaixas {
  critico: number;
  atencao: number;
  ok: number;
  semDados: number;
}

export function contarFaixas(escolas: FrequenciaEscola[]): ContagemFaixas {
  const c: ContagemFaixas = { critico: 0, atencao: 0, ok: 0, semDados: 0 };
  for (const e of escolas) {
    if (e.faixa === 'CRITICO') c.critico++;
    else if (e.faixa === 'ATENCAO') c.atencao++;
    else if (e.faixa === 'OK') c.ok++;
    else c.semDados++;
  }
  return c;
}

/** Escolas com presença acima do limite crítico (60%), entre as que têm dado hoje. */
export function escolasAcimaDoCritico(escolas: FrequenciaEscola[]): {
  acima: number;
  total: number;
} {
  const comDado = escolas.filter((e) => e.frequencia !== null);
  return { acima: comDado.filter((e) => e.faixa !== 'CRITICO').length, total: comDado.length };
}

export interface Manchete {
  /** Palavra de destaque, colorida pelo tom. */
  destaque: string;
  tom: Tom;
  /** Complemento depois da vírgula. */
  complemento: string;
}

/**
 * Frase do topo de "Agora", gerada só dos números: alertas críticos abertos e escolas em faixa
 * crítica. Nunca usa texto fixo de teste.
 */
export function manchete(criticosAbertos: number, escolasCriticas: number): Manchete {
  const problemas = criticosAbertos + escolasCriticas;
  if (problemas === 0) {
    return { destaque: 'bem', tom: 'sucesso', complemento: 'sem problemas críticos.' };
  }
  const texto =
    problemas === 1 ? 'com 1 problema crítico.' : `com ${problemas} problemas críticos.`;
  if (problemas === 1) {
    return { destaque: 'bem', tom: 'sucesso', complemento: texto };
  }
  return { destaque: 'pedindo atenção', tom: 'critico', complemento: texto };
}

/** Últimos N dias letivos com dado (a API já devolve só dias letivos). */
export function ultimosDias(dias: FrequenciaDoDia[], n = 10): FrequenciaDoDia[] {
  return dias.filter((d) => d.esperados > 0).slice(-n);
}

/** Quantos dias letivos seguidos a presença caiu, contando do mais recente para trás. */
export function diasEmQueda(dias: FrequenciaDoDia[]): number {
  let n = 0;
  for (let i = dias.length - 1; i > 0; i--) {
    const atual = dias[i].frequencia;
    const anterior = dias[i - 1].frequencia;
    if (atual === null || anterior === null || atual >= anterior) {
      break;
    }
    n++;
  }
  return n;
}
