package br.com.rotasegura.veiculos.domain;

import java.math.BigDecimal;

/**
 * Faixa de lotação de um veículo. É a única regra de lotação do sistema: o card do veículo, o mapa
 * e os alertas usam esta mesma classificação (evita "95% de lotação e 0 alertas").
 */
public enum FaixaOcupacao {
    OK,
    /** Acima do limite de atenção (padrão 90%). */
    ATENCAO,
    /** Acima do limite crítico (padrão 100%). */
    CRITICO;

    /** @return nulo quando a ocupação é desconhecida (veículo sem capacidade cadastrada) */
    public static FaixaOcupacao de(BigDecimal ocupacao, int limiteAtencao, int limiteCritico) {
        if (ocupacao == null) {
            return null;
        }
        if (ocupacao.compareTo(BigDecimal.valueOf(limiteCritico)) > 0) {
            return CRITICO;
        }
        if (ocupacao.compareTo(BigDecimal.valueOf(limiteAtencao)) > 0) {
            return ATENCAO;
        }
        return OK;
    }
}
