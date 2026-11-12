package br.com.rotasegura.dashboard.domain;

import java.math.BigDecimal;

/** Cor das barras de frequência: abaixo de 60% crítico, de 60% a 85% atenção, acima de 85% ok. */
public enum FaixaFrequencia {
    CRITICO,
    ATENCAO,
    OK;

    public static FaixaFrequencia de(BigDecimal frequencia) {
        if (frequencia == null) {
            return null;
        }
        if (frequencia.compareTo(BigDecimal.valueOf(60)) < 0) {
            return CRITICO;
        }
        return frequencia.compareTo(BigDecimal.valueOf(85)) <= 0 ? ATENCAO : OK;
    }
}
