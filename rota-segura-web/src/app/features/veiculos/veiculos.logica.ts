import { EstadoVeiculo, FaixaOcupacao, SaudeLeitor, StatusVeiculo } from '../../core/api/modelos';
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
