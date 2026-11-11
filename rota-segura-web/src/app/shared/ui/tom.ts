/** Tons semânticos do design system: verde = sucesso, âmbar = atenção, vermelho = crítico, azul = info. */
export type Tom = 'sucesso' | 'atencao' | 'critico' | 'info' | 'neutro';

export type EstadoJornada = 'AGUARDANDO' | 'EMBARCADO' | 'NA_ESCOLA' | 'AUSENTE' | 'DIVERGENTE';

export const JORNADA: Record<EstadoJornada, { rotulo: string; tom: Tom }> = {
  AGUARDANDO: { rotulo: 'Aguardando', tom: 'neutro' },
  EMBARCADO: { rotulo: 'Embarcado', tom: 'info' },
  NA_ESCOLA: { rotulo: 'Na escola', tom: 'sucesso' },
  AUSENTE: { rotulo: 'Ausente', tom: 'atencao' },
  DIVERGENTE: { rotulo: 'Divergente', tom: 'critico' },
};
