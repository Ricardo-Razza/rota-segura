import {
  EstadoVeiculo,
  FaixaOcupacao,
  ParadaAprendida,
  PontoRastro,
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

/** Janela em que as posições do SSE são juntadas antes de atualizar a tela (um redesenho por janela). */
export const JANELA_POSICOES_MS = 1000;

/**
 * Aplica de uma vez as posições que chegaram juntas. Cada veículo manda uma a cada 5 s; com a frota inteira,
 * aplicar uma por uma redesenharia o mapa várias vezes por segundo.
 */
export function aplicarPosicoes(
  lista: RastreioVeiculo[],
  eventos: PosicaoAoVivo[],
  maxPontos = MAX_PONTOS_RASTRO,
): RastreioVeiculo[] {
  return eventos.reduce((atual, evento) => aplicarPosicao(atual, evento, maxPontos), lista);
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

export interface TextoPrevisao {
  /** "Chega às 07:23". */
  chegada: string;
  /** "15 min depois do normal", "no horário de sempre", "pela hora da saída"... */
  comparacao: string;
  tom: Tom;
}

/** "07:23" de um ISO local ou de um "HH:mm:ss". */
function hhmm(valor: string): string {
  const m = /(\d{2}):(\d{2})/.exec(valor.includes('T') ? valor.split('T')[1] : valor);
  return m ? `${m[1]}:${m[2]}` : '—';
}

/**
 * Previsão de chegada em linguagem simples. Pelo GPS compara com o horário de sempre (até 3 min de diferença é
 * "no horário"); sem GPS recente ou sem histórico, diz que é estimativa pela saída.
 */
export function textoPrevisao(v: StatusVeiculo): TextoPrevisao | null {
  if (!v.previsaoChegada) {
    return null;
  }
  const chegada = `Chega às ${hhmm(v.previsaoChegada)}`;
  if (v.origemPrevisao !== 'GPS' || v.diferencaMin === null) {
    return { chegada, comparacao: 'estimativa pela hora da saída', tom: 'neutro' };
  }
  const d = v.diferencaMin;
  if (Math.abs(d) <= 3) {
    return { chegada, comparacao: 'no horário de sempre', tom: 'sucesso' };
  }
  return d > 0
    ? { chegada, comparacao: `${d} min depois do normal`, tom: d >= 10 ? 'critico' : 'atencao' }
    : { chegada, comparacao: `${-d} min antes do normal`, tom: 'info' };
}

/** Horários típicos de uma parada: "06:50" ou "06:50 e 17:32". */
export function horariosDaParada(p: ParadaAprendida): string {
  return p.horariosTipicos.map(hhmm).join(' e ') || '—';
}

/** Dica da parada no mapa, sem aluno: só contagens. */
export function rotuloParada(p: ParadaAprendida): string {
  const alunos = p.alunos === 1 ? '1 aluno' : `${p.alunos} alunos`;
  return `Parada · ${horariosDaParada(p)} · ${p.embarques} embarques (${alunos}) em ${p.dias} dia(s)`;
}

/** Milissegundos de um LocalDateTime ISO (sem fuso: horário local, o da operação). */
export function instante(iso: string): number {
  return new Date(iso).getTime();
}

/**
 * Onde o ônibus estava num instante do replay: interpola entre os dois pontos vizinhos (o rastro só ganha
 * ponto quando o ônibus anda, então entre dois pontos ele estava indo de um ao outro). Antes do primeiro
 * ponto fica no primeiro; depois do último, no último. Também devolve quantos pontos já passaram.
 */
export function posicaoNoInstante(
  pontos: PontoRastro[],
  ms: number,
): { latitude: number; longitude: number; indice: number } | null {
  if (pontos.length === 0) {
    return null;
  }
  const tempos = pontos.map((p) => instante(p.em));
  if (ms <= tempos[0]) {
    return { latitude: pontos[0].latitude, longitude: pontos[0].longitude, indice: 0 };
  }
  const ultimo = pontos.length - 1;
  if (ms >= tempos[ultimo]) {
    return {
      latitude: pontos[ultimo].latitude,
      longitude: pontos[ultimo].longitude,
      indice: ultimo,
    };
  }
  let baixo = 0;
  let alto = ultimo;
  while (alto - baixo > 1) {
    const meio = (baixo + alto) >> 1;
    if (tempos[meio] <= ms) {
      baixo = meio;
    } else {
      alto = meio;
    }
  }
  const a = pontos[baixo];
  const b = pontos[alto];
  const f = (ms - tempos[baixo]) / (tempos[alto] - tempos[baixo] || 1);
  return {
    latitude: a.latitude + (b.latitude - a.latitude) * f,
    longitude: a.longitude + (b.longitude - a.longitude) * f,
    indice: baixo,
  };
}

/** Velocidades do replay: minutos de trajeto por segundo de animação. */
export const VELOCIDADES_REPLAY = [1, 4, 16] as const;

/** Data local de hoje no formato do input date ("2026-03-10"). */
export function hojeIso(agora = new Date()): string {
  const d = new Date(agora.getTime() - agora.getTimezoneOffset() * 60_000);
  return d.toISOString().slice(0, 10);
}
