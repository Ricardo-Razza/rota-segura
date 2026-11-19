package br.com.rotasegura.analises.application;

import br.com.rotasegura.shared.application.Periodo;
import java.time.temporal.ChronoUnit;

/** Período usado como referência para as variações. */
public enum Comparacao {
    /** Mesmo número de dias, imediatamente antes do início. */
    PERIODO_ANTERIOR,
    /** As mesmas datas, um ano antes. */
    ANO_ANTERIOR,
    /** Sem comparação. */
    NENHUMA;

    /** Período de referência; nulo quando não há comparação. */
    public Periodo referencia(Periodo periodo) {
        return switch (this) {
            case PERIODO_ANTERIOR -> {
                long dias = ChronoUnit.DAYS.between(periodo.inicio(), periodo.fim()) + 1;
                yield new Periodo(periodo.inicio().minusDays(dias), periodo.inicio().minusDays(1));
            }
            case ANO_ANTERIOR -> new Periodo(periodo.inicio().minusYears(1), periodo.fim().minusYears(1));
            case NENHUMA -> null;
        };
    }
}
