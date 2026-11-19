import { LocalDoPasso, LocaisDoDia, PontoRastro } from '../../core/api/modelos';
import { hora } from '../../shared/formato';

/** Ponto desenhado no mapa da jornada. Sem nome do aluno: só o tipo do passo e a hora. */
export interface PontoJornada {
  tipo: LocalDoPasso['tipo'];
  latitude: number;
  longitude: number;
  rotulo: string;
}

export function rotuloPasso(tipo: LocalDoPasso['tipo']): string {
  return tipo === 'EMBARQUE' ? 'Embarque' : 'Chegada na escola';
}

/** Passos com coordenada viram pontos; os demais ficam só na lista. */
export function pontosDaJornada(locais: LocaisDoDia | null): PontoJornada[] {
  return (locais?.passos ?? [])
    .filter(
      (p): p is LocalDoPasso & { latitude: number; longitude: number } =>
        p.latitude !== null && p.longitude !== null,
    )
    .map((p) => ({
      tipo: p.tipo,
      latitude: p.latitude,
      longitude: p.longitude,
      rotulo: `${rotuloPasso(p.tipo)} · ${hora(p.dataHora)}`,
    }));
}

/** Veículo do primeiro embarque do dia, para buscar o rastro. */
export function veiculoDoEmbarque(locais: LocaisDoDia | null): number | null {
  return (
    locais?.passos.find((p) => p.tipo === 'EMBARQUE' && p.veiculoId !== null)?.veiculoId ?? null
  );
}

/**
 * Trecho do rastro do ônibus entre o embarque e a chegada (com folga de 2 min). Sem chegada, vai até o
 * fim do rastro; sem embarque, não há trecho.
 */
export function trechoDoRastro(rastro: PontoRastro[], locais: LocaisDoDia | null): PontoRastro[] {
  const passos = locais?.passos ?? [];
  const embarque = passos.find((p) => p.tipo === 'EMBARQUE');
  if (!embarque) {
    return [];
  }
  const chegada = passos.find((p) => p.tipo === 'CHEGADA' && p.dataHora >= embarque.dataHora);
  const folga = 2 * 60_000;
  const inicio = new Date(embarque.dataHora).getTime() - folga;
  const fim = chegada ? new Date(chegada.dataHora).getTime() + folga : Infinity;
  return rastro.filter((p) => {
    const t = new Date(p.em).getTime();
    return t >= inicio && t <= fim;
  });
}
