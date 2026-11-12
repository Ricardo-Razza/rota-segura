package br.com.rotasegura.jornada.domain;

import java.util.EnumSet;
import java.util.Set;

/**
 * Estados da jornada do dia e as transições válidas entre eles.
 *
 * <pre>
 * AGUARDANDO ──embarque──▶ EMBARCADO ──chegada──▶ NA_ESCOLA
 *     │                       │
 *     │ chegada (sem embarque)│ passou a janela sem chegada
 *     ▼                       ▼
 * NA_ESCOLA               DIVERGENTE ──chegada tardia──▶ NA_ESCOLA
 *
 * AGUARDANDO ──passou o limite do dia sem leitura──▶ AUSENTE ──embarque/chegada tardia──▶ EMBARCADO/NA_ESCOLA
 * </pre>
 *
 * EMBARCADO → EMBARCADO e DIVERGENTE → DIVERGENTE: segundo embarque no dia; o estado se mantém e
 * gera {@code EMBARQUE_DUPLICADO}. NA_ESCOLA é final: leituras depois dela são descartadas como fora de ordem
 * (o trajeto de volta para casa está fora do escopo desta fase).
 */
public enum EstadoJornada {
    AGUARDANDO,
    EMBARCADO,
    NA_ESCOLA,
    AUSENTE,
    DIVERGENTE;

    /** Estados para os quais este pode seguir. */
    public Set<EstadoJornada> proximosValidos() {
        return switch (this) {
            case AGUARDANDO -> EnumSet.of(EMBARCADO, NA_ESCOLA, AUSENTE);
            case EMBARCADO -> EnumSet.of(EMBARCADO, NA_ESCOLA, DIVERGENTE);
            case DIVERGENTE -> EnumSet.of(DIVERGENTE, NA_ESCOLA);
            case AUSENTE -> EnumSet.of(EMBARCADO, NA_ESCOLA);
            case NA_ESCOLA -> EnumSet.noneOf(EstadoJornada.class);
        };
    }

    public boolean podeIrPara(EstadoJornada destino) {
        return proximosValidos().contains(destino);
    }
}
