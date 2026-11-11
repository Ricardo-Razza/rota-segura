package br.com.rotasegura.shared.integration;

import java.util.List;

/**
 * Resultado de percorrer todas as páginas de um recurso.
 *
 * @param truncada verdadeiro quando o limite de páginas foi atingido antes do fim
 */
public record ColecaoPaginada<T>(List<T> itens, int paginasLidas, boolean truncada) {

    public ColecaoPaginada {
        itens = List.copyOf(itens);
    }
}
