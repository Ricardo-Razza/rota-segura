import {
  EstadoVeiculo,
  FaixaOcupacao,
  PosicaoAoVivo,
  RastreioVeiculo,
  SaudeLeitor,
  StatusVeiculo,
} from '../../core/api/modelos';
import { Tom } from '../../shared/ui/tom';

export const ESTADO_VEICULO: Record<EstadoVeiculo, { rotulo: string; tom: Tom }> = {
  EM_ROTA: { rotulo: 'Em rota', tom: 'info' },
  CONCLUIDO: { rotulo: 'Concluído', tom: 'sucesso' },
  SEM_EMBARQUE: { rotulo: 'Sem embarque', tom: 'neutro' },
};

/** Faixa de lotação vem do backend: a mesma regra que gera o alerta (nada de 95% com zero alertas). */
export const FAIXA: Record<FaixaOcupacao, Tom> = {
  OK: 'sucesso',
  ATENCAO: 'atencao',
  CRITICO: 'critico',
};

export const SITUACAO_LEITOR: Record<string, { rotulo: string; tom: Tom }> = {
  ONLINE: { rotulo: 'Online', tom: 'sucesso' },
  OFFLINE: { rotulo: 'Offline', tom: 'critico' },
  SEM_LEITURA: { rotulo: 'Sem leitura', tom: 'neutro' },
};

/** Busca por placa/prefixo ignorando caixa, espaço e hífen ("abc-1d23" acha "ABC1D23"). */
export function filtrarVeiculos(
  veiculos: StatusVeiculo[],
  termo: string,
  estados: string[],
): StatusVeiculo[] {
  const limpo = termo.replace(/[\s-]/g, '').toUpperCase();
  return veiculos.filter((v) => {
    if (estados.length > 0 && !estados.includes(v.estado)) {
      return false;
    }
    if (!limpo) {
      return true;
    }
    const alvo = `${v.placa ?? ''}|${v.prefixo ?? ''}|${v.id}`.replace(/[\s-]/g, '').toUpperCase();
    return alvo.includes(limpo);
  });
}

export interface GrupoLeitores {
  chave: string;
  titulo: string;
  leitores: SaudeLeitor[];
}

/** Agrupa leitores por escola e, dentro dela, por veículo (leitores de escola primeiro). */
export function agruparLeitores(leitores: SaudeLeitor[]): GrupoLeitores[] {
  const grupos = new Map<string, GrupoLeitores>();
  for (const l of leitores) {
    const escola = l.escolaId === null ? 'Escola não informada' : `Escola #${l.escolaId}`;
    const veiculo =
      l.veiculoId === null
        ? 'leitores da escola'
        : `veículo ${l.veiculoPrefixo || '#' + l.veiculoId}`;
    const chave = `${l.escolaId ?? '-'}|${l.veiculoId ?? '-'}`;
    if (!grupos.has(chave)) {
      grupos.set(chave, { chave, titulo: `${escola} · ${veiculo}`, leitores: [] });
    }
    grupos.get(chave)!.leitores.push(l);
  }
  return [...grupos.values()].sort((a, b) =>
    a.chave.localeCompare(b.chave, 'pt-BR', { numeric: true }),
  );
}

/** Teto de pontos do rastro guardados no navegador por veículo (o backend usa o mesmo teto). */
export const MAX_PONTOS_RASTRO = 3000;

/**
 * Aplica um evento `veiculo.posicao` à lista: atualiza a posição e, quando o backend diz que é ponto novo,
 * estende o rastro (o evento não traz o rastro inteiro). Veículo ainda desconhecido entra na lista.
 */
export function aplicarPosicao(
  lista: RastreioVeiculo[],
  evento: PosicaoAoVivo,
  maxPontos = MAX_PONTOS_RASTRO,
): RastreioVeiculo[] {
  const novo = evento.veiculo;
  const anterior = lista.find((r) => r.veiculoId === novo.veiculoId);
  let rastro = anterior?.rastro ?? [];
  if (evento.novoPonto && novo.posicao) {
    const p = novo.posicao;
    rastro = [
      ...rastro,
      { latitude: p.latitude, longitude: p.longitude, em: p.registradaEm },
    ].slice(-maxPontos);
  }
  const atualizado = { ...novo, rastro };
  return anterior ? lista.map((r) => (r === anterior ? atualizado : r)) : [...lista, atualizado];
}

/** "há 4 s", "há 3 min", "há 2 h", "há 5 d": o GPS chega a cada poucos segundos, então minuto é pouco. */
export function idadePosicao(iso: string | null | undefined, agora = Date.now()): string {
  const quando = iso ? new Date(iso).getTime() : NaN;
  if (Number.isNaN(quando)) {
    return '—';
  }
  const s = Math.max(0, Math.floor((agora - quando) / 1000));
  if (s < 60) {
    return `há ${s} s`;
  }
  if (s < 3600) {
    return `há ${Math.floor(s / 60)} min`;
  }
  if (s < 86_400) {
    return `há ${Math.floor(s / 3600)} h`;
  }
  return `há ${Math.floor(s / 86_400)} d`;
}

export interface SituacaoGps {
  texto: string;
  tom: Tom;
}

/** Selo do GPS: ao vivo (verde), atrasado (âmbar) ou sem sinal (neutro). */
export function situacaoGps(r: RastreioVeiculo | undefined, agora = Date.now()): SituacaoGps {
  if (!r?.posicao) {
    return { texto: 'Sem GPS', tom: 'neutro' };
  }
  const idade = idadePosicao(r.posicao.registradaEm, agora);
  if (r.atrasada) {
    return { texto: `GPS atrasado · ${idade}`, tom: 'atencao' };
  }
  const v = r.posicao.velocidadeKmh;
  const andando = r.posicao.emMovimento ?? (v !== null && v >= 3);
  const movimento =
    andando && v !== null ? `${Math.round(v)} km/h` : andando ? 'andando' : 'parado';
  return { texto: `GPS ${movimento} · ${idade}`, tom: 'sucesso' };
}

/** "850 m" ou "2,4 km". */
export function distancia(metros: number | null | undefined): string {
  if (metros === null || metros === undefined) {
    return '—';
  }
  return metros < 1000
    ? `${Math.round(metros)} m`
    : `${(metros / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`;
}
