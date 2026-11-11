package br.com.rotasegura.shared.integration;

import java.time.Instant;

/**
 * Valor vindo da API externa, com a hora em que foi obtido.
 *
 * @param desatualizado verdadeiro quando a API falhou e este é o último valor bom conhecido
 */
public record ResultadoCache<T>(T valor, Instant obtidoEm, boolean desatualizado) {

    public ResultadoCache<T> comoDesatualizado() {
        return new ResultadoCache<>(valor, obtidoEm, true);
    }
}
