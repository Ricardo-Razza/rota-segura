package br.com.rotasegura.alertas.domain;

import java.util.Set;

/** Ciclo do alerta: ABERTO → EM_ANALISE → RESOLVIDO (também ABERTO → RESOLVIDO). Resolvido é final. */
public enum StatusAlerta {
    ABERTO,
    EM_ANALISE,
    RESOLVIDO;

    public boolean podeIrPara(StatusAlerta destino) {
        return switch (this) {
            case ABERTO -> Set.of(EM_ANALISE, RESOLVIDO).contains(destino);
            case EM_ANALISE -> destino == RESOLVIDO;
            case RESOLVIDO -> false;
        };
    }
}
